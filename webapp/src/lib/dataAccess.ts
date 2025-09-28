import { supabase } from "./supabaseClient";
import { uploadSubmissionAssets } from "./storage";
import type {
  AssignmentProgressInsert,
  AssignmentProgressRecord,
  AssignmentProgressUpdate,
  AssignmentRecord,
  AssignmentStatus,
  LearnerProfileRecord,
  LearnerProfileUpdate,
  LoginEventInsert,
  MoodEntryInsert,
  MoodEntryRecord,
  UserRecord,
} from "../types/database";

export interface UserWithProfile {
  user: UserRecord;
  learnerProfile: LearnerProfileRecord | null;
}

interface RawUserWithProfile extends UserRecord {
  learner_profiles: LearnerProfileRecord[] | LearnerProfileRecord | null;
}

export async function fetchUserByCode(code: string): Promise<UserWithProfile | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  const { data, error } = await supabase
    .from("users")
    .select("*, learner_profiles(*)")
    .eq("code", normalized)
    .limit(1)
    .maybeSingle<RawUserWithProfile>();

  if (error) {
    throw new Error(error.message || "Unable to reach Supabase");
  }
  if (!data) {
    return null;
  }

  const learnerProfiles = data.learner_profiles;
  const learnerProfile = Array.isArray(learnerProfiles)
    ? learnerProfiles[0] ?? null
    : learnerProfiles ?? null;

  return { user: data, learnerProfile };
}

export async function recordLoginEvent(userId: string, note?: string) {
  const timestamp = new Date().toISOString();
  const payload: LoginEventInsert = {
    user_id: userId,
    logged_in_at: timestamp,
    client_notes: note ?? null,
  };
  const { error } = await supabase.from("login_events").insert(payload);
  if (error) {
    throw new Error(error.message || "Failed to record login event");
  }
}

export interface LearnerDashboardState {
  profile: LearnerProfileRecord;
  assignments: AssignmentWithProgress[];
}

export interface AssignmentWithProgress {
  assignment: AssignmentRecord;
  progress: AssignmentProgressRecord | null;
}

export async function fetchLearnerDashboardState(userId: string): Promise<LearnerDashboardState> {
  const profilePromise = supabase
    .from("learner_profiles")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const assignmentsPromise = supabase
    .from("assignments")
    .select("*")
    .order("display_order", { ascending: true });

  const progressPromise = supabase
    .from("assignment_progress")
    .select("*")
    .eq("user_id", userId);

  const [{ data: profile, error: profileError }, { data: assignments, error: assignmentError }, { data: progress, error: progressError }] =
    await Promise.all([profilePromise, assignmentsPromise, progressPromise]);

  if (profileError) {
    throw new Error(profileError.message || "Unable to load learner profile");
  }
  const profileRow = profile as LearnerProfileRecord | null;
  if (!profileRow) {
    throw new Error("Learner profile missing for this user.");
  }
  if (assignmentError) {
    throw new Error(assignmentError.message || "Unable to load assignments");
  }
  if (!assignments) {
    throw new Error("Assignments not configured.");
  }
  if (progressError) {
    throw new Error(progressError.message || "Unable to load assignment progress");
  }

  const assignmentRows = (assignments ?? []) as AssignmentRecord[];
  const progressRows = (progress ?? []) as AssignmentProgressRecord[];

  const progressByAssignment = new Map<string, AssignmentProgressRecord>();
  for (const item of progressRows) {
    progressByAssignment.set(item.assignment_id, item);
  }

  const assignmentWithProgress: AssignmentWithProgress[] = assignmentRows.map((assignment) => ({
    assignment,
    progress: progressByAssignment.get(assignment.id) ?? null,
  }));

  return {
    profile: profileRow,
    assignments: assignmentWithProgress,
  };
}

export interface SubmissionPayload {
  assignmentId: string;
  userId: string;
  link: string | null;
  notes?: string | null;
  assetPaths?: string[];
  status?: AssignmentStatus;
}

export async function upsertAssignmentProgress(payload: SubmissionPayload & {
  hintsUnlocked?: boolean;
  locked?: boolean;
  submittedAt?: string | null;
  coinsSpentOnUnlocks?: number;
  coinsSpentOnHints?: number;
}) {
  const { assignmentId, userId, link, notes, assetPaths, status, hintsUnlocked, locked, submittedAt, coinsSpentOnHints, coinsSpentOnUnlocks } = payload;
  const upsertPayload: AssignmentProgressInsert = {
    assignment_id: assignmentId,
    user_id: userId,
    status: status ?? undefined,
    locked: locked ?? undefined,
    hints_unlocked: hintsUnlocked ?? undefined,
    submission_link: link ?? undefined,
    submission_notes: notes ?? undefined,
    submission_asset_paths: assetPaths ?? undefined,
    submitted_at: submittedAt ?? undefined,
    coins_spent_on_hints: coinsSpentOnHints ?? undefined,
    coins_spent_on_unlocks: coinsSpentOnUnlocks ?? undefined,
  };

  const { error } = await supabase
    .from("assignment_progress")
    .upsert(upsertPayload, { onConflict: "assignment_id,user_id" });
  if (error) {
    throw new Error(error.message || "Unable to update assignment progress");
  }
}

export async function updateLearnerProfile(userId: string, updates: Partial<Pick<LearnerProfileRecord, "coins_balance" | "streak_days" | "badges_earned" | "total_check_ins" | "last_login_at">>) {
  const { error } = await supabase
    .from("learner_profiles")
    .update(updates as LearnerProfileUpdate)
    .eq("user_id", userId);
  if (error) {
    throw new Error(error.message || "Unable to update learner profile");
  }
}

export async function logMoodEntry(userId: string, updates: Pick<MoodEntryRecord, "emotion" | "motivation" | "energy">) {
  const payload: MoodEntryInsert = {
    user_id: userId,
    emotion: updates.emotion ?? null,
    motivation: updates.motivation ?? null,
    energy: updates.energy ?? null,
  };
  const { error } = await supabase.from("mood_entries").insert(payload);
  if (error) {
    throw new Error(error.message || "Unable to log mood entry");
  }
}

export interface SubmissionRequest {
  userId: string;
  assignmentId: string;
  link: string | null;
  notes?: string | null;
  files: File[];
  existingAssetPaths?: string[];
  keepExistingAssets?: boolean;
  status?: AssignmentStatus;
  hintsUnlocked?: boolean;
  coinsSpentOnHints?: number;
  coinsSpentOnUnlocks?: number;
}

export interface SubmissionResult {
  assetPaths: string[];
  uploadedPaths: string[];
}

export async function submitAssignmentSubmission(request: SubmissionRequest): Promise<SubmissionResult> {
  const {
    userId,
    assignmentId,
    link,
    notes,
    files,
    existingAssetPaths,
    keepExistingAssets = true,
    status = "Submitted",
    hintsUnlocked,
    coinsSpentOnHints,
    coinsSpentOnUnlocks,
  } = request;

  const uploads = await uploadSubmissionAssets(userId, assignmentId, files);
  const assetPaths = [
    ...(keepExistingAssets ? existingAssetPaths ?? [] : []),
    ...uploads.map((asset) => asset.path),
  ];

  await upsertAssignmentProgress({
    assignmentId,
    userId,
    link,
    notes,
    assetPaths,
    status,
    hintsUnlocked,
    locked: false,
    submittedAt: new Date().toISOString(),
    coinsSpentOnHints,
    coinsSpentOnUnlocks,
  });

  return {
    assetPaths,
    uploadedPaths: uploads.map((asset) => asset.path),
  };
}

export async function updateAssignmentStatus(
  userId: string,
  assignmentId: string,
  nextStatus: AssignmentStatus,
  reviewerId?: string,
  reviewerNote?: string
) {
  const { error } = await supabase
    .from("assignment_progress")
    .update({
      status: nextStatus,
      reviewed_by: reviewerId ?? null,
      reviewed_at: reviewerId ? new Date().toISOString() : null,
      feedback: reviewerNote ?? null,
    } as AssignmentProgressUpdate)
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId);

  if (error) {
    throw new Error(error.message || "Unable to update assignment status");
  }
}

export interface AdminAssignmentOverview {
  assignment: AssignmentRecord;
  progress: AssignmentProgressRecord | null;
  learner: LearnerProfileRecord;
}

export async function fetchAdminAssignmentOverview(learnerUserId: string): Promise<AdminAssignmentOverview[]> {
  const [{ data: assignments, error: assignmentError }, { data: progress, error: progressError }, { data: learner, error: learnerError }] =
    await Promise.all([
      supabase.from("assignments").select("*").order("display_order", { ascending: true }),
      supabase.from("assignment_progress").select("*").eq("user_id", learnerUserId),
      supabase.from("learner_profiles").select("*").eq("user_id", learnerUserId).limit(1).maybeSingle(),
    ]);

  if (assignmentError) {
    throw new Error(assignmentError.message || "Unable to load assignments");
  }
  if (progressError) {
    throw new Error(progressError.message || "Unable to load learner submissions");
  }
  if (learnerError) {
    throw new Error(learnerError.message || "Unable to load learner profile");
  }
  const learnerProfile = learner as LearnerProfileRecord | null;
  if (!assignments || !learnerProfile) {
    return [];
  }

  const assignmentRows = (assignments ?? []) as AssignmentRecord[];
  const progressRows = (progress ?? []) as AssignmentProgressRecord[];

  const progressByAssignment = new Map<string, AssignmentProgressRecord>();
  for (const item of progressRows) {
    progressByAssignment.set(item.assignment_id, item);
  }

  return assignmentRows.map((assignment) => ({
    assignment,
    progress: progressByAssignment.get(assignment.id) ?? null,
    learner: learnerProfile,
  }));
}

interface RawLearnerRow extends UserRecord {
  learner_profiles: LearnerProfileRecord[] | LearnerProfileRecord | null;
}

export interface LearnerSummary {
  user: UserRecord;
  profile: LearnerProfileRecord;
}

export async function fetchLearners(): Promise<LearnerSummary[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*, learner_profiles(*)")
    .eq("role", "learner")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load learners");
  }
  const rows = (data ?? []) as RawLearnerRow[];
  if (!rows.length) {
    return [];
  }

  const summaries: LearnerSummary[] = [];
  for (const row of rows) {
    const learnerProfiles = row.learner_profiles;
    const profile = Array.isArray(learnerProfiles) ? learnerProfiles[0] : learnerProfiles;
    if (!profile) {
      continue;
    }
    summaries.push({ user: row, profile });
  }

  return summaries;
}
