import { useState } from "react";

export type MoodStepKey = "emotion" | "motivation" | "energy";

export interface MoodResponses {
  emotion: string | null;
  motivation: string | null;
  energy: string | null;
}

interface MoodFlowProps {
  onComplete: (responses: MoodResponses) => void;
  onExit?: () => void;
}

interface MoodOption {
  value: string;
  label: string;
  emoji: string;
  description: string;
}

const moodSteps: Array<{ key: MoodStepKey; title: string; prompt: string; options: MoodOption[] }> = [
  {
    key: "emotion",
    title: "Emotion Check",
    prompt: "How are you feeling today?",
    options: [
      { value: "energized", label: "Energized", emoji: "?", description: "Ready to take on anything" },
      { value: "focused", label: "Focused", emoji: "??", description: "Dialed in and present" },
      { value: "neutral", label: "Neutral", emoji: "??", description: "Steady and calm" },
      { value: "stressed", label: "Stressed", emoji: "??", description: "Carrying some pressure" },
      { value: "reflective", label: "Reflective", emoji: "??", description: "In a thoughtful mood" },
    ],
  },
  {
    key: "motivation",
    title: "Motivation Check",
    prompt: "How motivated do you feel?",
    options: [
      { value: "fired-up", label: "Fired Up", emoji: "??", description: "Nothing can stop me" },
      { value: "steady", label: "Steady", emoji: "??", description: "Cruising with intention" },
      { value: "curious", label: "Curious", emoji: "??", description: "Ready to explore" },
      { value: "seeking", label: "Seeking", emoji: "??", description: "Looking for a spark" },
      { value: "recharging", label: "Recharging", emoji: "??", description: "Saving energy for later" },
    ],
  },
  {
    key: "energy",
    title: "Energy Check",
    prompt: "Where is your energy level?",
    options: [
      { value: "high", label: "High", emoji: "??", description: "Plenty in the tank" },
      { value: "balanced", label: "Balanced", emoji: "??", description: "Even and grounded" },
      { value: "medium", label: "Medium", emoji: "??", description: "Growth in progress" },
      { value: "low", label: "Low", emoji: "??", description: "Taking things gently" },
      { value: "resetting", label: "Resetting", emoji: "??", description: "Need a pause to recover" },
    ],
  },
];

export function MoodFlow({ onComplete, onExit }: MoodFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<MoodResponses>({ emotion: null, motivation: null, energy: null });

  const step = moodSteps[stepIndex];
  const currentValue = responses[step.key];
  const isLastStep = stepIndex === moodSteps.length - 1;

  function handleSelect(option: MoodOption) {
    setResponses((prev) => ({ ...prev, [step.key]: option.value }));
  }

  function moveForward(nextResponses: MoodResponses) {
    if (isLastStep) {
      onComplete(nextResponses);
    } else {
      setStepIndex((prev) => prev + 1);
    }
  }

  function handleNext() {
    if (!currentValue) return;
    moveForward(responses);
  }

  function handleBack() {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  function handleSkip() {
    const nextResponses = { ...responses, [step.key]: null } as MoodResponses;
    setResponses(nextResponses);
    moveForward(nextResponses);
  }

  return (
    <section className="panel mood-panel">
      <header>
        <p className="eyebrow">Mood Affirmations</p>
        <h1>{step.title}</h1>
        <p className="prompt">{step.prompt}</p>
      </header>
      <div className="mood-options" role="radiogroup" aria-label={step.prompt}>
        {step.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`mood-option ${currentValue === option.value ? "selected" : ""}`}
            onClick={() => handleSelect(option)}
            role="radio"
            aria-checked={currentValue === option.value}
          >
            <span aria-hidden="true" className="emoji">{option.emoji}</span>
            <span className="label">{option.label}</span>
            <span className="description">{option.description}</span>
          </button>
        ))}
      </div>
      <footer className="mood-actions">
        {onExit && (
          <button type="button" className="btn-secondary" onClick={onExit}>
            Exit
          </button>
        )}
        <div className="spacer" />
        <button type="button" className="btn-tertiary" onClick={handleSkip}>
          Skip
        </button>
        {stepIndex > 0 && (
          <button type="button" className="btn-secondary" onClick={handleBack}>
            Back
          </button>
        )}
        <button type="button" className="btn-primary" onClick={handleNext} disabled={!currentValue}>
          {isLastStep ? "Finish" : "Next"}
        </button>
      </footer>
      <p className="step-indicator" aria-live="polite">
        Step {stepIndex + 1} of {moodSteps.length}
      </p>
    </section>
  );
}
