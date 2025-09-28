import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "./ToastContext";
import type { LoginResult } from "./LoginScreen";
import type { MoodResponses } from "./MoodFlow";

export type AssignmentStatus = "Pending" | "Submitted" | "Checked";

type ModalState =
  | { type: "unlock"; assignmentId: string }
  | { type: "hint"; assignmentId: string }
  | { type: "submit"; assignmentId: string }
  | null;

interface Assignment {
  id: string;
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

const initialAssignments: Assignment[] = [
  {
    id: "mon",
    day: "Monday",
    title: "Kickoff Reflection",
    summaryLines: [
      "Share a win from last week",
      "List your top 3 learning goals",
      "Record one question for your mentor",
      "Describe the environment you are working in",
      "Estimate 2 hours for deep work",
    ],
    due: "Due Monday by 8 PM",
    status: "Checked",
    locked: false,
    unlockCost: 0,
    hintCost: 3,
    isCurrentDay: false,
    hints: [
      "Focus on specific, measurable goals to help your mentor respond.",
      "Use the question to unblock a challenge you encountered recently.",
    ],
  },
  {
    id: "tue",
    day: "Tuesday",
    title: "Concept Drill",
    summaryLines: [
      "Watch the Chapter 3 walkthrough",
      "Summarize the 3 core takeaways",
      "Implement the sample snippet",
      "Note one area to improve",
      "Upload your edited code",
    ],
    due: "Due Tuesday by 8 PM",
    status: "Submitted",
    locked: false,
    unlockCost: 0,
    hintCost: 4,
    isCurrentDay: false,
    hints: [
      "Keep your summary under 120 words for quick review.",
      "Highlight the snippet differences so mentors can scan fast.",
    ],
  },
  {
    id: "wed",
    day: "Wednesday",
    title: "Project Milestone",
    summaryLines: [
      "Complete user research interviews",
      "Translate findings into 3 insights",
      "Upload the interview notes",
      "Sketch a draft solution",
      "Define one success metric",
    ],
    due: "Due Wednesday by 8 PM",
    status: "Pending",
    locked: false,
    unlockCost: 0,
    hintCost: 5,
    isCurrentDay: true,
    hints: [
      "Use quotes from interviews to back each insight.",
      "Choose a metric you can actually capture this week.",
    ],
  },
  {
    id: "thu",
    day: "Thursday",
    title: "Mentor Sync Prep",
    summaryLines: [
      "Prepare 2 demo talking points",
      "Outline blockers that need support",
      "Draft questions about this week’s content",
      "Upload supporting visuals",
      "Share the meeting agenda",
    ],
    due: "Unlock to view due date",
    status: "Pending",
    locked: true,
    unlockCost: 10,
    hintCost: 6,
    isCurrentDay: false,
    hints: [
      "Think about where your mentor can remove ambiguity.",
      "Your agenda should include time for feedback loops.",
    ],
  },
  {
    id: "fri",
    day: "Friday",
    title: "Demo Day Rehearsal",
    summaryLines: [
      "Record a short walkthrough video",
      "List feedback from teammates",
      "Plan updates before next sprint",
      "Upload revised slides",
      "Leave a link to your rehearsal clip",
    ],
    due: "Unlock to view due date",
    status: "Pending",
    locked: true,
    unlockCost: 12,
    hintCost: 6,
    isCurrentDay: false,
    hints: [
      "Keep the walkthrough under 5 minutes for quick critique.",
      "Capture action items in bullet points for clarity.",
    ],
  },
  {
    id: "week",
    day: "Weekend Wrap",
    title: "Weekly Reflection",
    summaryLines: [
      "Summarize your biggest insight",
      "Call out one blocker",
      "Set your intention for next week",
      "Upload any supporting artifacts",
      "Celebrate a win from the week",
    ],
    due: "Unlock to view due date",
    status: "Pending",
    locked: true,
    unlockCost: 8,
    hintCost: 5,
    isCurrentDay: false,
    hints: [
      "Use the blocker call-out to request mentor support early.",
      "Intentions work best when they include a measurable target.",
    ],
  },
];

export function Dashboard({ user, moodResponses, onUserChange }: DashboardProps) {
  const { pushToast } = useToast();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [expandedCards, setExpandedCards] = useState(() =>
    initialAssignments.filter((item) => !item.locked && (item.isCurrentDay || item.status !== "Pending")).map((item) => item.id)
  );
  const [modalState, setModalState] = useState<ModalState>(null);
  const [drafts, setDrafts] = useState<Record<string, SubmissionDraft>>({});
  const [hintRevealed, setHintRevealed] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const unlockedCount = assignments.filter((assignment) => !assignment.locked).length;
  const completedCount = assignments.filter((assignment) => assignment.status !== "Pending").length;
  const completionPercent = Math.round((completedCount / assignments.length) * 100);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  function toggleCard(id: string) {
    setExpandedCards((prev) =>
      prev.includes(id) ? prev.filter((cardId) => cardId !== id) : [...prev, id]
    );
  }

  function updateAssignment(assignmentId: string, updater: (assignment: Assignment) => Assignment) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId ? updater(assignment) : assignment
      )
    );
  }

  function openModal(state: Exclude<ModalState, null>) {
    setFormError(null);
    setModalState(state);
  }

  function closeModal() {
    setModalState(null);
    setFormError(null);
  }

  function handleUnlock(assignmentId: string) {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    if (assignment.unlockCost > user.coins) {
      pushToast("You do not have enough coins to unlock this assignment yet.", "error");
      return;
    }
    onUserChange({ ...user, coins: user.coins - assignment.unlockCost });
    updateAssignment(assignmentId, (item) => ({ ...item, locked: false }));
    setExpandedCards((prev) => [...prev, assignmentId]);
    pushToast(`${assignment.title} unlocked. Ready when you are!`, "success");
    closeModal();
  }

  function handleHints(assignmentId: string) {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    if (assignment.hintCost > user.coins) {
      pushToast("Not enough coins for hints. Complete more work to earn them!", "error");
      return;
    }
    onUserChange({ ...user, coins: user.coins - assignment.hintCost });
    setHintRevealed((prev) => ({ ...prev, [assignmentId]: true }));
    pushToast("Hints unlocked. Make the most of them!", "success");
    closeModal();
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
        link: prev[assignmentId]?.link ?? "",
        files: fileList,
      },
    }));
  }

  function handleSubmitAssignment(assignmentId: string) {
    const draft = drafts[assignmentId];
    if (!draft || (!draft.link && draft.files.length === 0)) {
      setFormError("Add an external link or at least one image before submitting.");
      return;
    }
    updateAssignment(assignmentId, (item) => ({
      ...item,
      status: "Submitted",
    }));
    pushToast("Submission received! Your mentor will review it soon.", "success");
    closeModal();
  }

  function cardStatusClass(status: AssignmentStatus) {
    if (status === "Checked") return "status-pill checked";
    if (status === "Submitted") return "status-pill submitted";
    return "status-pill pending";
  }

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div className="header-intro">
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>
            {greeting}, {user.name}
          </h1>
          <p className="helper">Thanks for completing your mood check{moodResponses.emotion ? ", we logged your vibe." : "."}</p>
        </div>
        <div className="metrics" role="group" aria-label="Status metrics">
          <div className="metric" tabIndex={0} title="Coins you can spend unlocking future work">
            <span className="metric-icon" aria-hidden="true">??</span>
            <div>
              <p className="metric-label">Coins</p>
              <p className="metric-value">{user.coins}</p>
            </div>
          </div>
          <div className="metric" tabIndex={0} title="Keep your streak alive with daily submissions">
            <span className="metric-icon" aria-hidden="true">??</span>
            <div>
              <p className="metric-label">Streak</p>
              <p className="metric-value">{user.streak} days</p>
            </div>
          </div>
          <div className="metric" tabIndex={0} title="Badges show completed milestones">
            <span className="metric-icon" aria-hidden="true">??</span>
            <div>
              <p className="metric-label">Badges</p>
              <p className="metric-value">{user.badges}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="dashboard-body">
        <section className="week-context">
          <div>
            <p className="eyebrow">Week Progress</p>
            <h2>Week 4 of 12</h2>
            <p className="helper">{completedCount} of {assignments.length} assignments completed</p>
          </div>
          <div className="progress-shell" aria-label="Weekly progress">
            <div className="progress-bar" style={{ width: `${completionPercent}%` }} />
            <span className="progress-label">{completionPercent}%</span>
          </div>
        </section>

        <section className="resource-links">
          <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer">
            Custom GPT for the Week
          </a>
          <a href="https://www.notion.so" target="_blank" rel="noopener noreferrer">
            Notebook for the Week
          </a>
        </section>

        <section className="assignment-list" aria-label="Weekly assignments">
          {assignments.map((assignment) => {
            const isExpanded = expandedCards.includes(assignment.id) && !assignment.locked;
            const draft = drafts[assignment.id];
            const statusLabel = assignment.locked ? "Locked" : assignment.status;
            const statusClass = assignment.locked ? "status-pill locked" : cardStatusClass(assignment.status);
            return (
              <article key={assignment.id} className={`assignment-card ${assignment.isCurrentDay ? "current" : ""} ${assignment.locked ? "locked" : ""}`}>
                <header>
                  <button
                    type="button"
                    className="card-toggle"
                    onClick={() => toggleCard(assignment.id)}
                    disabled={assignment.locked}
                    aria-expanded={isExpanded}
                    aria-controls={`assignment-${assignment.id}`}
                  >
                    <div>
                      <p className="eyebrow">{assignment.day}</p>
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
                      Unlock Assignment · {assignment.unlockCost} coins
                    </button>
                    {assignment.unlockCost > user.coins && <p className="helper">Earn more coins by completing pending tasks.</p>}
                  </div>
                )}
                {isExpanded && (
                  <div className="card-body" id={`assignment-${assignment.id}`}>
                    <ul>
                      {assignment.summaryLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="due">{assignment.due}</p>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => openModal({ type: "hint", assignmentId: assignment.id })}
                      >
                        Hints will cost you {assignment.hintCost} coins
                      </button>
                      <div className="action-spacer" />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openModal({ type: "submit", assignmentId: assignment.id })}
                        disabled={assignment.status === "Checked"}
                      >
                        {assignment.status === "Pending" ? "Submit Assignment" : assignment.status === "Submitted" ? "Edit Submission" : "Submission Locked"}
                      </button>
                    </div>
                    {hintRevealed[assignment.id] && (
                      <div className="hint-panel" role="status">
                        <p className="eyebrow">Hints</p>
                        <ul>
                          {assignment.hints.map((hint) => (
                            <li key={hint}>{hint}</li>
                          ))}
                        </ul>
                      </div>
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
        <div>
          <p className="eyebrow">Weekly Completion</p>
          <strong>{completionPercent}% complete</strong>
        </div>
        <p className="motivation">Keep the streak alive! You've unlocked {unlockedCount} out of {assignments.length} assignments.</p>
      </footer>

      {modalState?.type === "unlock" && (
        <Modal
          title="Unlock assignment"
          onClose={closeModal}
          primaryAction={{ label: "Confirm unlock", onClick: () => handleUnlock(modalState.assignmentId) }}
          secondaryAction={{ label: "Cancel", onClick: closeModal }}
        >
          <p>Spend coins to access this assignment early?</p>
        </Modal>
      )}

      {modalState?.type === "hint" && (
        <Modal
          title="Unlock hints"
          onClose={closeModal}
          primaryAction={{ label: "Unlock hints", onClick: () => handleHints(modalState.assignmentId) }}
          secondaryAction={{ label: "Not now", onClick: closeModal }}
        >
          <p>Hints cost coins but can save time. Continue?</p>
        </Modal>
      )}

      {modalState?.type === "submit" && (
        <Modal
          title="Submit assignment"
          onClose={closeModal}
          primaryAction={{ label: "Submit", onClick: () => handleSubmitAssignment(modalState.assignmentId) }}
          secondaryAction={{ label: "Cancel", onClick: closeModal }}
        >
          <form className="submission-form">
            <label htmlFor="submission-link">External link</label>
            <input
              id="submission-link"
              type="url"
              placeholder="https://"
              value={drafts[modalState.assignmentId]?.link ?? ""}
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
              <p className="helper">{drafts[modalState.assignmentId].files.length} files selected.</p>
            ) : (
              <p className="helper">Choose images or add a link. At least one field is required.</p>
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
