import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "../hooks/useToast";
import type { LoginResult } from "./LoginScreen";
import type { MoodResponses } from "./MoodFlow";
import {
  fetchLearnerDashboardState,
  submitAssignmentSubmission,
  updateLearnerProfile,
  upsertAssignmentProgress,
} from "../lib/dataAccess";
import { getPublicUrl } from "../lib/storage";
import type {
  AssignmentProgressRecord,
  AssignmentRecord,
  AssignmentStatus as AssignmentStatusType,
  LearnerProfileRecord,
} from "../types/database";

export type AssignmentStatus = AssignmentStatusType;

type ModalState =
  | { type: "unlock"; assignmentId: string }
  | { type: "hint"; assignmentId: string }
  | { type: "submit"; assignmentId: string }
  | null;

interface AssignmentAsset {
  path: string;
  url: string;
}

interface AssignmentCard {
  id: string;
  slug: string;
  day: string;
  title: string;
  summaryLines: string[];
  due: string;
  status: AssignmentStatus;
  locked: boolean;
  unlockCost: number;
  hintCost: number;
  isCurrentDay: boolean;
  hints: string[];
  hintsUnlocked: boolean;
  submissionLink: string | null;
  submissionNotes: string | null;
  submissionAssets: AssignmentAsset[];
  submittedAt: string | null;
  feedback: string | null;
  coinsSpentOnUnlocks: number;
  coinsSpentOnHints: number;
}

interface SubmissionDraft {
  link: string;
  files: File[];
}

interface DashboardProps {
  user: LoginResult;
  moodResponses: MoodResponses;
  onUserChange: (user: LoginResult) => void;
}

function mapAssignment(assignment: AssignmentRecord, progress: AssignmentProgressRecord | null): AssignmentCard {
  const assetPaths = progress?.submission_asset_paths ?? [];
  const submissionAssets: AssignmentAsset[] = assetPaths.map((path) => ({
    path,
    url: getPublicUrl(path),
  }));

  return {
    id: assignment.id,
    slug: assignment.slug,
    day: assignment.day_label,
    title: assignment.title,
    summaryLines: assignment.summary_lines,
    due: assignment.due_label,
    status: progress?.status ?? assignment.base_status,
    locked: progress?.locked ?? assignment.is_locked_by_default,
    unlockCost: assignment.unlock_cost,
    hintCost: assignment.hint_cost,
    isCurrentDay: assignment.is_current_day,
    hints: assignment.hints,
    hintsUnlocked: progress?.hints_unlocked ?? false,
    submissionLink: progress?.submission_link ?? null,
    submissionNotes: progress?.submission_notes ?? null,
    submissionAssets,
    submittedAt: progress?.submitted_at ?? null,
    feedback: progress?.feedback ?? null,
    coinsSpentOnUnlocks: progress?.coins_spent_on_unlocks ?? 0,
    coinsSpentOnHints: progress?.coins_spent_on_hints ?? 0,
  };
}

const TIMELINE_OVERRIDE = {
  currentWeek: 1,
  totalWeeks: 12,
} as const;
export function Dashboard({ user, moodResponses, onUserChange }: DashboardProps) {
  const { pushToast } = useToast();
  const [profile, setProfile] = useState<LearnerProfileRecord | null>(null);
  const [assignments, setAssignments] = useState<AssignmentCard[]>([]);
  const [expandedCards, setExpandedCards] = useState<string[]>([]);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [drafts, setDrafts] = useState<Record<string, SubmissionDraft>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const previousLockedRef = useRef<Record<string, boolean>>({});
  const hasInitializedExpandedRef = useRef(false);
  const lastDefaultCardIdRef = useRef<string | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const submittedCount = assignments.filter(
    (assignment) => assignment.status === "Submitted" || assignment.status === "Checked"
  ).length;
  const submittedPercent = assignments.length
    ? Math.round((submittedCount / assignments.length) * 100)
    : 0;
  const weekNumbers = useMemo(() => {
    const numbers = assignments
      .map((assignment) => {
        const match = assignment.slug.match(/week(\d+)/i);
        if (!match) {
          return null;
        }
        const parsed = Number.parseInt(match[1] ?? "", 10);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => value !== null);
    if (!numbers.length) {
      return [] as number[];
    }
    const unique = Array.from(new Set(numbers));
    unique.sort((a, b) => a - b);
    return unique;
  }, [assignments]);
  const derivedTotalWeeks = weekNumbers.length ? weekNumbers[weekNumbers.length - 1] : 0;
  const derivedCurrentWeek = useMemo(() => {
    const currentAssignment = assignments.find((assignment) => assignment.isCurrentDay);
    if (currentAssignment) {
      const match = currentAssignment.slug.match(/week(\d+)/i);
      if (match) {
        const parsed = Number.parseInt(match[1] ?? "", 10);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    if (weekNumbers.length) {
      return weekNumbers[weekNumbers.length - 1];
    }
    return 0;
  }, [assignments, weekNumbers]);
  const totalWeeks = TIMELINE_OVERRIDE.totalWeeks ?? derivedTotalWeeks;
  const currentWeek = TIMELINE_OVERRIDE.currentWeek ?? derivedCurrentWeek;
  const weekProgressPercent = totalWeeks
    ? Math.max(0, Math.min(100, Math.round((currentWeek / totalWeeks) * 100)))
    : 0;
  const weeklyRewardEstimate = submittedCount * 15;
  const monthlyRewardEstimate = weeklyRewardEstimate * 4;
  const hasMoodResponses = Boolean(
    moodResponses.emotion || moodResponses.motivation || moodResponses.energy
  );

  const refreshDashboard = useCallback(async () => {
    if (user.role !== "learner") {
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchLearnerDashboardState(user.userId);
      setProfile(data.profile);
      const nextAssignments = data.assignments.map(({ assignment, progress }) =>
        mapAssignment(assignment, progress)
      );
      setAssignments(nextAssignments);
      setExpandedCards((prev) => {
        const allowed = new Set(nextAssignments.filter((item) => !item.locked).map((item) => item.id));
        const filteredPrev = prev.filter((id) => allowed.has(id));
        const currentAssignment = nextAssignments.find((item) => item.isCurrentDay && !item.locked);
        const currentId = currentAssignment?.id ?? null;
        const shouldApplyDefault =
          currentId !== null && (!hasInitializedExpandedRef.current || lastDefaultCardIdRef.current !== currentId);

        let nextExpanded = filteredPrev;
        if (shouldApplyDefault && currentId !== null && !filteredPrev.includes(currentId)) {
          nextExpanded = [...filteredPrev, currentId];
        }

        hasInitializedExpandedRef.current = true;
        lastDefaultCardIdRef.current = currentId;

        return nextExpanded;
      });
      onUserChange({
        ...user,
        coins: data.profile.coins_balance,
        streak: data.profile.streak_days,
        badges: data.profile.badges_earned,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load dashboard data.";
      pushToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [user, onUserChange, pushToast]);

  useEffect(() => {
    if (user.role === "learner") {
      void refreshDashboard();
    }
  }, [user.role, refreshDashboard]);

  useEffect(() => {
    if (!assignments.length) {
      previousLockedRef.current = {};
      hasInitializedExpandedRef.current = false;
      lastDefaultCardIdRef.current = null;
      return;
    }

    const newlyUnlocked: string[] = [];
    for (const assignment of assignments) {
      const wasLocked = previousLockedRef.current[assignment.id];
      if (wasLocked === true && !assignment.locked) {
        newlyUnlocked.push(assignment.id);
      }
      previousLockedRef.current[assignment.id] = assignment.locked;
    }

    if (newlyUnlocked.length > 0) {
      setExpandedCards((prev) => {
        const next = [...prev];
        for (const id of newlyUnlocked) {
          if (!next.includes(id)) {
            next.push(id);
          }
        }
        return next;
      });
    }
  }, [assignments]);

  function toggleCard(id: string) {
    setExpandedCards((prev) =>
      prev.includes(id) ? prev.filter((cardId) => cardId !== id) : [...prev, id]
    );
  }

  function openModal(state: Exclude<ModalState, null>) {
    setFormError(null);
    if (state.type === "submit") {
      setDrafts((prev) => {
        if (prev[state.assignmentId]) {
          return prev;
        }
        const assignment = assignments.find((item) => item.id === state.assignmentId);
        if (!assignment) {
          return prev;
        }
        return {
          ...prev,
          [state.assignmentId]: {
            link: assignment.submissionLink ?? "",
            files: [],
          },
        };
      });
    }
    setModalState(state);
  }

  function closeModal() {
    setModalState(null);
    setFormError(null);
    setIsActionBusy(false);
  }

  async function handleUnlock(assignmentId: string) {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    if (!assignment.locked) {
      closeModal();
      return;
    }
    const coinsAvailable = profile?.coins_balance ?? user.coins;
    if (assignment.unlockCost > coinsAvailable) {
      pushToast("You do not have enough coins to unlock this assignment yet.", "error");
      return;
    }
    setIsActionBusy(true);
    try {
      const newBalance = coinsAvailable - assignment.unlockCost;
      await updateLearnerProfile(user.userId, { coins_balance: newBalance });
      await upsertAssignmentProgress({
        assignmentId,
        userId: user.userId,
        link: assignment.submissionLink,
        notes: assignment.submissionNotes,
        assetPaths: assignment.submissionAssets.map((asset) => asset.path),
        status: assignment.status,
        hintsUnlocked: assignment.hintsUnlocked,
        locked: false,
        coinsSpentOnUnlocks: assignment.coinsSpentOnUnlocks + assignment.unlockCost,
        coinsSpentOnHints: assignment.coinsSpentOnHints,
      });
      setProfile((prev) => (prev ? { ...prev, coins_balance: newBalance } : prev));
      onUserChange({ ...user, coins: newBalance });
      pushToast(`${assignment.title} unlocked. Ready when you are!`, "success");
      closeModal();
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to unlock assignment right now.";
      pushToast(message, "error");
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handleHints(assignmentId: string) {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    if (assignment.hintsUnlocked) {
      pushToast("Hints are already unlocked for this assignment.", "info");
      closeModal();
      return;
    }
    const coinsAvailable = profile?.coins_balance ?? user.coins;
    if (assignment.hintCost > coinsAvailable) {
      pushToast("Not enough coins for hints. Complete more work to earn them!", "error");
      return;
    }
    setIsActionBusy(true);
    try {
      const newBalance = coinsAvailable - assignment.hintCost;
      await updateLearnerProfile(user.userId, { coins_balance: newBalance });
      await upsertAssignmentProgress({
        assignmentId,
        userId: user.userId,
        link: assignment.submissionLink,
        notes: assignment.submissionNotes,
        assetPaths: assignment.submissionAssets.map((asset) => asset.path),
        status: assignment.status,
        hintsUnlocked: true,
        locked: assignment.locked,
        coinsSpentOnUnlocks: assignment.coinsSpentOnUnlocks,
        coinsSpentOnHints: assignment.coinsSpentOnHints + assignment.hintCost,
      });
      setProfile((prev) => (prev ? { ...prev, coins_balance: newBalance } : prev));
      onUserChange({ ...user, coins: newBalance });
      pushToast("Hints unlocked. Make the most of them!", "success");
      closeModal();
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to unlock hints right now.";
      pushToast(message, "error");
    } finally {
      setIsActionBusy(false);
    }
  }

  function handleDraftChange(assignmentId: string, event: ChangeEvent<HTMLInputElement>) {
    const { value } = event.target;
    setDrafts((prev) => ({
      ...prev,
      [assignmentId]: {
        link: value,
        files: prev[assignmentId]?.files ?? [],
      },
    }));
  }

  function handleFileChange(assignmentId: string, event: ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(event.target.files ?? []).slice(0, 10);
    setDrafts((prev) => ({
      ...prev,
      [assignmentId]: {
        link: prev[assignmentId]?.link ?? assignments.find((item) => item.id === assignmentId)?.submissionLink ?? "",
        files: fileList,
      },
    }));
  }

  async function handleSubmitAssignment(assignmentId: string) {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    const draft = drafts[assignmentId];
    const linkValue = draft?.link?.trim() ?? "";
    const files = draft?.files ?? [];

    if (!linkValue && files.length === 0 && !assignment.submissionLink && assignment.submissionAssets.length === 0) {
      setFormError("Add an external link or at least one image before submitting.");
      return;
    }

    setIsActionBusy(true);
    setFormError(null);
    try {
      const submissionLink = linkValue.length ? linkValue : assignment.submissionLink;
      await submitAssignmentSubmission({
        userId: user.userId,
        assignmentId,
        link: submissionLink ?? null,
        notes: assignment.submissionNotes,
        files,
        existingAssetPaths: assignment.submissionAssets.map((asset) => asset.path),
        status: "Submitted",
        hintsUnlocked: assignment.hintsUnlocked,
        coinsSpentOnHints: assignment.coinsSpentOnHints,
        coinsSpentOnUnlocks: assignment.coinsSpentOnUnlocks,
      });
      setDrafts((prev) => {
        const nextDrafts = { ...prev };
        delete nextDrafts[assignmentId];
        return nextDrafts;
      });
      pushToast("Submission received! Your mentor will review it soon.", "success");
      closeModal();
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit assignment right now.";
      setFormError(message);
    } finally {
      setIsActionBusy(false);
    }
  }

  function cardStatusClass(status: AssignmentStatus) {
    if (status === "Checked") return "status-pill checked";
    if (status === "Submitted") return "status-pill submitted";
    return "status-pill pending";
  }

  if (user.role !== "learner") {
    return null;
  }

  return (
    <section className={`dashboard ${isLoading ? "loading" : ""}`}>
      <header className="dashboard-header" role="banner">
        <div className="header-intro">
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>
            {greeting}, {user.name}
          </h1>
          <p className="helper">
            {hasMoodResponses
              ? "Thanks for completing your mood check, we logged your vibe."
              : "Jump into your focus block when you're ready."}
          </p>
        </div>
        <div className="metrics" role="group" aria-label="Status metrics">
          <div className="metric-counters">
            <div className="metric" tabIndex={0} title="Coins you can spend unlocking future work">
              <span className="metric-icon" aria-hidden="true">💰</span>
              <div>
                <p className="metric-label">Coins</p>
                <p className="metric-value">{user.coins}</p>
              </div>
            </div>
            <div className="metric" tabIndex={0} title="Keep your streak alive with daily submissions">
              <span className="metric-icon" aria-hidden="true">🔥</span>
              <div>
                <p className="metric-label">Streak</p>
                <p className="metric-value">{user.streak} days</p>
              </div>
            </div>
            <div className="metric" tabIndex={0} title="Badges show completed milestones">
              <span className="metric-icon" aria-hidden="true">🏅</span>
              <div>
                <p className="metric-label">Badges</p>
                <p className="metric-value">{user.badges}</p>
              </div>
            </div>
          </div>
          <div className="metric-rewards">
            <div className="reward" title="Projected coins you can earn for this week's submissions">
              <p className="reward-label">Weekly reward</p>
              <p className="reward-value">+{weeklyRewardEstimate} coins</p>
            </div>
            <div className="reward" title="Projected coins you can earn across the month">
              <p className="reward-label">Monthly reward</p>
              <p className="reward-value">+{monthlyRewardEstimate} coins</p>
            </div>
          </div>
        </div>
      </header>

      <main className="dashboard-body" aria-busy={isLoading}>
        <section className="week-context">
          <div className="week-copy">
            <p className="eyebrow">Cohort timeline</p>
            <h2>
              Week {currentWeek ?? "--"} of {totalWeeks ?? "--"}
            </h2>
            <p className="helper">
              {totalWeeks
                ? `You're currently pacing through week ${currentWeek} of ${totalWeeks}.`
                : "We'll update your cohort schedule soon."}
            </p>
          </div>
          <div className="week-progress" aria-label="Cohort week progress">
            <div className="progress-track">
              <div className="progress-shell">
                <div className="progress-bar" style={{ width: `${weekProgressPercent}%` }} />
              </div>
              <span className="progress-label week-progress-label">
                {totalWeeks ? `Week ${currentWeek}/${totalWeeks}` : "No data"}
              </span>
            </div>
            <div className="resource-links">
              <a href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">
                Gemini Gem
              </a>
              <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer">
                Custom GPT
              </a>
              <a href="https://noteboom.lk" target="_blank" rel="noopener noreferrer">
                NoteboomLK
              </a>
            </div>
          </div>
        </section>

        <section className="assignment-list" aria-label="Weekly assignments">
          {assignments.map((assignment) => {
            const isExpanded = expandedCards.includes(assignment.id) && !assignment.locked;
            const draft = drafts[assignment.id];
            const statusLabel = assignment.locked ? "Locked" : assignment.status;
            const statusClass = assignment.locked ? "status-pill locked" : cardStatusClass(assignment.status);
            const cardStateClass = assignment.locked ? "locked" : isExpanded ? "expanded" : "collapsed";
            return (
              <article
                key={assignment.id}
                className={`assignment-card ${assignment.isCurrentDay ? "current" : ""} ${cardStateClass}`}
              >
                <header>
                  <button
                    type="button"
                    className="card-toggle"
                    onClick={() => toggleCard(assignment.id)}
                    disabled={assignment.locked}
                    aria-expanded={isExpanded}
                    aria-controls={`assignment-${assignment.id}`}
                  >
                    <div className="card-heading">
                      <div className="day-row">
                        <p className="eyebrow">{assignment.day}</p>
                        <span className="due">{assignment.due}</span>
                      </div>
                      <h3>{assignment.title}</h3>
                    </div>
                    <span className={statusClass}>{statusLabel}</span>
                  </button>
                </header>
                {assignment.locked && (
                  <div className="locked-body" id={`assignment-${assignment.id}`}>
                    <p className="helper">Unlock to preview requirements and start early.</p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => openModal({ type: "unlock", assignmentId: assignment.id })}
                      disabled={assignment.unlockCost > user.coins}
                    >
                      Unlock Assignment - {assignment.unlockCost} coins
                    </button>
                    {assignment.unlockCost > user.coins && (
                      <p className="helper">Earn more coins by completing pending tasks.</p>
                    )}
                  </div>
                )}
                {isExpanded && (
                  <div className="card-body" id={`assignment-${assignment.id}`}>
                    <p className="summary">{assignment.summaryLines.join(" ")}</p>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => openModal({ type: "hint", assignmentId: assignment.id })}
                        disabled={assignment.hintsUnlocked}
                      >
                        {assignment.hintsUnlocked ? "Hints unlocked" : `Hints will cost you ${assignment.hintCost} coins`}
                      </button>
                      <div className="action-spacer" />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openModal({ type: "submit", assignmentId: assignment.id })}
                        disabled={assignment.status === "Checked"}
                      >
                        {assignment.status === "Pending"
                          ? "Submit Assignment"
                          : assignment.status === "Submitted"
                          ? "Edit Submission"
                          : "Submission Locked"}
                      </button>
                    </div>
                    {assignment.hintsUnlocked && assignment.hints.length > 0 && (
                      <div className="hint-panel" role="status">
                        <p className="eyebrow">Hints</p>
                        <ul>
                          {assignment.hints.map((hint) => (
                            <li key={hint}>{hint}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {assignment.submissionLink && (
                      <p className="helper">
                        Submission link: {" "}
                        <a href={assignment.submissionLink} target="_blank" rel="noopener noreferrer">
                          Open work
                        </a>
                      </p>
                    )}
                    {assignment.submissionAssets.length > 0 && (
                      <div className="submitted-assets">
                        <p className="helper">Uploaded images:</p>
                        <ul>
                          {assignment.submissionAssets.map((asset) => (
                            <li key={asset.path}>
                              <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                View image
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {assignment.submittedAt && (
                      <p className="helper">Submitted on {new Date(assignment.submittedAt).toLocaleString()}</p>
                    )}
                    {assignment.feedback && (
                      <p className="helper" role="status">Mentor feedback: {assignment.feedback}</p>
                    )}
                    {draft?.files?.length ? (
                      <p className="helper">Draft in progress: {draft.files.length} file{draft.files.length > 1 ? "s" : ""} and {draft.link ? "a link" : "no link yet"}.</p>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </main>

      <footer className="dashboard-footer">
        <div className="footer-heading">
          <p className="eyebrow">Assignments submitted</p>
          <strong>
            {submittedCount} / {assignments.length}
          </strong>
        </div>
        <div className="progress-track" aria-label="Assignments submitted">
          <div className="progress-shell">
            <div className="progress-bar" style={{ width: `${submittedPercent}%` }} />
          </div>
          <span className="progress-label">{submittedPercent}%</span>
        </div>
        <p className="motivation">
          Keep the streak alive! You've submitted {submittedCount} out of {assignments.length} assignments.
        </p>
      </footer>

      {modalState?.type === "unlock" && (
        <Modal
          title="Unlock assignment"
          onClose={closeModal}
          primaryAction={{ label: isActionBusy ? "Unlocking..." : "Confirm unlock", onClick: () => { void handleUnlock(modalState.assignmentId); }, disabled: isActionBusy }}
          secondaryAction={{ label: "Cancel", onClick: closeModal }}
        >
          <p>Spend coins to access this assignment early?</p>
        </Modal>
      )}

      {modalState?.type === "hint" && (
        <Modal
          title="Unlock hints"
          onClose={closeModal}
          primaryAction={{ label: isActionBusy ? "Processing..." : "Unlock hints", onClick: () => { void handleHints(modalState.assignmentId); }, disabled: isActionBusy }}
          secondaryAction={{ label: "Not now", onClick: closeModal }}
        >
          <p>Hints cost coins but can save time. Continue?</p>
        </Modal>
      )}

      {modalState?.type === "submit" && (
        <Modal
          title="Submit assignment"
          onClose={closeModal}
          primaryAction={{ label: isActionBusy ? "Submitting..." : "Submit", onClick: () => { void handleSubmitAssignment(modalState.assignmentId); }, disabled: isActionBusy }}
          secondaryAction={{ label: "Cancel", onClick: closeModal }}
        >
          <form className="submission-form">
            <label htmlFor="submission-link">External link</label>
            <input
              id="submission-link"
              type="url"
              placeholder="https://"
              value={drafts[modalState.assignmentId]?.link ?? assignments.find((item) => item.id === modalState.assignmentId)?.submissionLink ?? ""}
              onChange={(event) => handleDraftChange(modalState.assignmentId, event)}
            />
            <label htmlFor="submission-files">Upload up to 10 images</label>
            <input
              id="submission-files"
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => handleFileChange(modalState.assignmentId, event)}
            />
            {drafts[modalState.assignmentId]?.files?.length ? (
              <p className="helper">{drafts[modalState.assignmentId].files.length} file{drafts[modalState.assignmentId].files.length > 1 ? "s" : ""} selected.</p>
            ) : (
              <p className="helper">Choose images or add a link. At least one field is helpful.</p>
            )}
            {formError && (
              <p className="helper error" role="alert">
                {formError}
              </p>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}











