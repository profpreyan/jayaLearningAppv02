import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "./ToastContext";
import type { LoginResult } from "./LoginScreen";
import {
  fetchAdminAssignmentOverview,
  fetchLearners,
  type AdminAssignmentOverview,
  type LearnerSummary,
  updateAssignmentStatus,
} from "../lib/dataAccess";
import { getPublicUrl } from "../lib/storage";
import type { AssignmentStatus, LearnerProfileRecord } from "../types/database";

interface AdminDashboardProps {
  admin: LoginResult;
}

interface AssignmentAsset {
  path: string;
  url: string;
}

interface AssignmentRow {
  record: AdminAssignmentOverview;
  assets: AssignmentAsset[];
}

interface AssignmentEditState {
  status: AssignmentStatus;
  feedback: string;
}

const statusOptions: AssignmentStatus[] = ["Pending", "Submitted", "Checked"];

export function AdminDashboard({ admin }: AdminDashboardProps) {
  const { pushToast } = useToast();
  const [learners, setLearners] = useState<LearnerSummary[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [selectedLearnerProfile, setSelectedLearnerProfile] = useState<LearnerProfileRecord | null>(null);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [edits, setEdits] = useState<Record<string, AssignmentEditState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingAssignmentId, setSavingAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const learnerList = await fetchLearners();
        setLearners(learnerList);
        setSelectedLearnerId((current) => current ?? learnerList[0]?.user.id ?? null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load learners.";
        pushToast(message, "error");
      }
    })();
  }, [pushToast]);

  const refreshAssignments = useCallback(
    async (learnerId: string) => {
      setIsLoading(true);
      try {
        const overview = await fetchAdminAssignmentOverview(learnerId);
        if (!overview.length) {
          const fallbackProfile = learners.find((item) => item.user.id === learnerId)?.profile ?? null;
          setSelectedLearnerProfile(fallbackProfile);
          setRows([]);
          setEdits({});
          return;
        }
        setSelectedLearnerProfile(overview[0].learner);
        const mappedRows: AssignmentRow[] = overview.map((entry) => ({
          record: entry,
          assets: (entry.progress?.submission_asset_paths ?? []).map((path) => ({
            path,
            url: getPublicUrl(path),
          })),
        }));
        const nextEdits: Record<string, AssignmentEditState> = {};
        for (const row of mappedRows) {
          nextEdits[row.record.assignment.id] = {
            status: row.record.progress?.status ?? row.record.assignment.base_status,
            feedback: row.record.progress?.feedback ?? "",
          };
        }
        setRows(mappedRows);
        setEdits(nextEdits);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load assignments.";
        pushToast(message, "error");
      } finally {
        setIsLoading(false);
      }
    },
    [learners, pushToast]
  );

  useEffect(() => {
    if (!selectedLearnerId) {
      setRows([]);
      setSelectedLearnerProfile(null);
      return;
    }
    void refreshAssignments(selectedLearnerId);
  }, [selectedLearnerId, refreshAssignments]);

  const selectedLearner = useMemo(() => {
    if (!selectedLearnerId) return null;
    return learners.find((item) => item.user.id === selectedLearnerId) ?? null;
  }, [learners, selectedLearnerId]);

  function handleLearnerChange(event: ChangeEvent<HTMLSelectElement>) {
    const learnerId = event.target.value || null;
    setSelectedLearnerId(learnerId);
  }

  function handleStatusChange(assignmentId: string, nextStatus: AssignmentStatus) {
    const baseline = rows.find((row) => row.record.assignment.id === assignmentId);
    const currentFeedback = edits[assignmentId]?.feedback ?? baseline?.record.progress?.feedback ?? "";
    setEdits((prev) => ({
      ...prev,
      [assignmentId]: {
        status: nextStatus,
        feedback: currentFeedback,
      },
    }));
  }

  function handleFeedbackChange(assignmentId: string, value: string) {
    const baseline = rows.find((row) => row.record.assignment.id === assignmentId);
    const baseStatus = baseline?.record.progress?.status ?? baseline?.record.assignment.base_status ?? "Pending";
    setEdits((prev) => ({
      ...prev,
      [assignmentId]: {
        status: prev[assignmentId]?.status ?? baseStatus,
        feedback: value,
      },
    }));
  }

  async function handleSave(assignmentId: string) {
    if (!selectedLearnerId) {
      return;
    }
    const edit = edits[assignmentId];
    if (!edit) {
      return;
    }
    setSavingAssignmentId(assignmentId);
    try {
      const trimmedFeedback = edit.feedback.trim();
      await updateAssignmentStatus(
        selectedLearnerId,
        assignmentId,
        edit.status,
        admin.userId,
        trimmedFeedback.length ? trimmedFeedback : undefined
      );
      pushToast("Assignment updated.", "success");
      await refreshAssignments(selectedLearnerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update assignment.";
      pushToast(message, "error");
    } finally {
      setSavingAssignmentId(null);
    }
  }

  return (
    <section className="panel admin-dashboard">
      <header className="admin-header">
        <h1>Welcome back, {admin.name}</h1>
        <p className="helper">Review learner submissions and keep statuses in sync.</p>
        <div className="admin-controls">
          <label htmlFor="learner-select">Reviewing learner</label>
          <select id="learner-select" value={selectedLearnerId ?? ""} onChange={handleLearnerChange}>
            {learners.length === 0 && <option value="">No learners available</option>}
            {learners.map((learner) => (
              <option key={learner.user.id} value={learner.user.id}>
                {learner.profile.display_name || learner.user.full_name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {selectedLearner && selectedLearnerProfile && (
        <section className="learner-summary">
          <h2>{selectedLearner.profile.display_name || selectedLearner.user.full_name}</h2>
          <div className="summary-grid" role="group" aria-label="Learner metrics">
            <div>
              <p className="eyebrow">Coins</p>
              <p>{selectedLearnerProfile.coins_balance}</p>
            </div>
            <div>
              <p className="eyebrow">Streak</p>
              <p>{selectedLearnerProfile.streak_days} days</p>
            </div>
            <div>
              <p className="eyebrow">Badges</p>
              <p>{selectedLearnerProfile.badges_earned}</p>
            </div>
            <div>
              <p className="eyebrow">Last login</p>
              <p>{selectedLearnerProfile.last_login_at ? new Date(selectedLearnerProfile.last_login_at).toLocaleString() : "No logins yet"}</p>
            </div>
          </div>
        </section>
      )}

      <section className="admin-assignment-list" aria-busy={isLoading}>
        {rows.length === 0 && !isLoading && (
          <p className="helper">No assignment records yet for this learner.</p>
        )}
        {rows.map(({ record, assets }) => {
          const edit = edits[record.assignment.id];
          const originalStatus = record.progress?.status ?? record.assignment.base_status;
          const originalFeedback = record.progress?.feedback ?? "";
          const hasProgress = Boolean(record.progress);
          const isDirty =
            edit !== undefined &&
            (edit.status !== originalStatus || edit.feedback.trim() !== originalFeedback.trim());
          const isSaving = savingAssignmentId === record.assignment.id;

          return (
            <article key={record.assignment.id} className="admin-assignment-card">
              <header>
                <p className="eyebrow">{record.assignment.day_label}</p>
                <h3>{record.assignment.title}</h3>
                <p className="helper">Due: {record.assignment.due_label}</p>
              </header>
              <div className="admin-body">
                <div className="status-row">
                  <label htmlFor={`status-${record.assignment.id}`}>Status</label>
                  <select
                    id={`status-${record.assignment.id}`}
                    value={edit?.status ?? originalStatus}
                    onChange={(event) => handleStatusChange(record.assignment.id, event.target.value as AssignmentStatus)}
                    disabled={isSaving}
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="feedback-row">
                  <label htmlFor={`feedback-${record.assignment.id}`}>Feedback for learner</label>
                  <textarea
                    id={`feedback-${record.assignment.id}`}
                    rows={3}
                    placeholder="Share reviewer notes or next steps"
                    value={edit?.feedback ?? originalFeedback}
                    onChange={(event) => handleFeedbackChange(record.assignment.id, event.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="submission-details">
                  <p className="eyebrow">Submission</p>
                  {record.progress?.submission_link ? (
                    <p>
                      Link: {" "}
                      <a href={record.progress.submission_link} target="_blank" rel="noopener noreferrer">
                        Open submission
                      </a>
                    </p>
                  ) : (
                    <p>No link submitted yet.</p>
                  )}
                  {assets.length > 0 && (
                    <ul>
                      {assets.map((asset) => (
                        <li key={asset.path}>
                          <a href={asset.url} target="_blank" rel="noopener noreferrer">
                            View image
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {record.progress?.submitted_at && (
                    <p className="helper">Submitted {new Date(record.progress.submitted_at).toLocaleString()}</p>
                  )}
                  {record.progress?.reviewed_at && (
                    <p className="helper">Last reviewed {new Date(record.progress.reviewed_at).toLocaleString()}</p>
                  )}
                  {!hasProgress && <p className="helper">No learner submission yet for this assignment.</p>}
                </div>
              </div>
              <footer>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleSave(record.assignment.id)}
                  disabled={!hasProgress || !isDirty || isSaving}
                >
                  {isSaving ? "Saving..." : "Save updates"}
                </button>
              </footer>
            </article>
          );
        })}
      </section>
    </section>
  );
}
