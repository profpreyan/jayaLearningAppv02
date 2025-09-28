import "./App.css";
import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import type { LoginResult } from "./components/LoginScreen";
import { LoginScreen } from "./components/LoginScreen";
import { MoodFlow } from "./components/MoodFlow";
import type { MoodResponses } from "./components/MoodFlow";
import { ToastProvider, useToast } from "./components/ToastContext";

type Stage = "login" | "mood" | "dashboard";

function AppContent() {
  const [stage, setStage] = useState<Stage>("login");
  const [user, setUser] = useState<LoginResult | null>(null);
  const [moodResponses, setMoodResponses] = useState<MoodResponses>({
    emotion: null,
    motivation: null,
    energy: null,
  });
  const { pushToast } = useToast();

  async function authenticate(code: string): Promise<LoginResult> {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const normalized = code.toUpperCase();
    const learnerNames = ["Jaya", "Avery", "Morgan", "Priya", "Taylor"];
    const hash = normalized.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const chosenName = learnerNames[hash % learnerNames.length];
    const profile: LoginResult = {
      name: chosenName,
      code: normalized,
      coins: 65,
      streak: 6,
      badges: 3,
    };
    setUser(profile);
    setStage("mood");
    return profile;
  }

  function handleMoodComplete(responses: MoodResponses) {
    setMoodResponses(responses);
    pushToast("Mood check saved. Have a focused session!", "success");
    setStage("dashboard");
  }

  function handleExitMoodFlow() {
    setStage("dashboard");
  }

  function resetSession() {
    setUser(null);
    setMoodResponses({ emotion: null, motivation: null, energy: null });
    setStage("login");
  }

  return (
    <div className="app-shell">
      {stage === "login" && <LoginScreen onAuthenticate={authenticate} />}
      {stage === "mood" && (
        <MoodFlow
          onComplete={handleMoodComplete}
          onExit={handleExitMoodFlow}
        />
      )}
      {stage === "dashboard" && user && (
        <Dashboard
          user={user}
          moodResponses={moodResponses}
          onUserChange={setUser}
        />
      )}
      {stage === "dashboard" && (
        <button type="button" className="logout" onClick={resetSession}>
          Log out
        </button>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
