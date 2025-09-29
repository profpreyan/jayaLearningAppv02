export type UserRole = "admin" | "learner";

export interface UserRecord {
  id: string;
  code: string;
  role: UserRole;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface UserInsert extends Partial<Pick<UserRecord, "id" | "created_at" | "updated_at">> {
  code: string;
  role: UserRole;
  full_name: string;
}

export type UserUpdate = Partial<UserRecord>;

export interface LearnerProfileRecord {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  coins_balance: number;
  streak_days: number;
  badges_earned: number;
  total_check_ins: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearnerProfileInsert
  extends Partial<Pick<LearnerProfileRecord, "id" | "avatar_url" | "coins_balance" | "streak_days" | "badges_earned" | "total_check_ins" | "last_login_at" | "created_at" | "updated_at">> {
  user_id: string;
  display_name: string;
}

export type LearnerProfileUpdate = Partial<LearnerProfileRecord>;

export type AssignmentStatus = "Pending" | "Submitted" | "Checked";

export interface AssignmentRecord {
  id: string;
  slug: string;
  day_label: string;
  title: string;
  summary_lines: string[];
  due_label: string;
  base_status: AssignmentStatus;
  is_locked_by_default: boolean;
  unlock_cost: number;
  hint_cost: number;
  is_current_day: boolean;
  hints: string[];
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AssignmentInsert
  extends Partial<Pick<AssignmentRecord, "id" | "created_at" | "updated_at" | "base_status" | "is_locked_by_default" | "unlock_cost" | "hint_cost" | "is_current_day" | "hints" | "display_order">> {
  slug: string;
  day_label: string;
  title: string;
  summary_lines: string[];
  due_label: string;
}

export type AssignmentUpdate = Partial<AssignmentRecord>;

export interface AssignmentProgressRecord {
  id: string;
  assignment_id: string;
  user_id: string;
  status: AssignmentStatus;
  locked: boolean;
  hints_unlocked: boolean;
  submission_link: string | null;
  submission_notes: string | null;
  submission_asset_paths: string[];
  submitted_at: string | null;
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  coins_spent_on_unlocks: number;
  coins_spent_on_hints: number;
  created_at: string;
  updated_at: string;
}

export interface AssignmentProgressInsert
  extends Partial<
    Pick<
      AssignmentProgressRecord,
      | "id"
      | "status"
      | "locked"
      | "hints_unlocked"
      | "submission_link"
      | "submission_notes"
      | "submission_asset_paths"
      | "submitted_at"
      | "feedback"
      | "reviewed_by"
      | "reviewed_at"
      | "coins_spent_on_unlocks"
      | "coins_spent_on_hints"
      | "created_at"
      | "updated_at"
    >
  > {
  assignment_id: string;
  user_id: string;
}

export type AssignmentProgressUpdate = Partial<AssignmentProgressRecord>;

export interface MoodEntryRecord {
  id: string;
  user_id: string;
  emotion: string | null;
  motivation: string | null;
  energy: string | null;
  created_at: string;
}

export interface MoodEntryInsert extends Partial<Pick<MoodEntryRecord, "id" | "created_at">> {
  user_id: string;
  emotion: string | null;
  motivation: string | null;
  energy: string | null;
}

export type MoodEntryUpdate = Partial<MoodEntryRecord>;

export interface LoginEventRecord {
  id: string;
  user_id: string;
  logged_in_at: string;
  client_notes: string | null;
}

export interface LoginEventInsert extends Partial<Pick<LoginEventRecord, "id">> {
  user_id: string;
  logged_in_at: string;
  client_notes: string | null;
}

export type LoginEventUpdate = Partial<LoginEventRecord>;

export interface SupabaseDatabase {
  public: {
    Tables: {
      users: {
        Row: UserRecord;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      learner_profiles: {
        Row: LearnerProfileRecord;
        Insert: LearnerProfileInsert;
        Update: LearnerProfileUpdate;
      };
      assignments: {
        Row: AssignmentRecord;
        Insert: AssignmentInsert;
        Update: AssignmentUpdate;
      };
      assignment_progress: {
        Row: AssignmentProgressRecord;
        Insert: AssignmentProgressInsert;
        Update: AssignmentProgressUpdate;
      };
      mood_entries: {
        Row: MoodEntryRecord;
        Insert: MoodEntryInsert;
        Update: MoodEntryUpdate;
      };
      login_events: {
        Row: LoginEventRecord;
        Insert: LoginEventInsert;
        Update: LoginEventUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      assignment_status: AssignmentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
