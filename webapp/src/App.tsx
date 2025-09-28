import "./App.css";
import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import type { LoginResult } from "./components/LoginScreen";
import { LoginScreen } from "./components/LoginScreen";
import { MoodFlow } from "./components/MoodFlow";
import type { MoodResponses } from "./components/MoodFlow";
import { ToastProvider, useToast } from "./components/ToastContext";

type Stage = "login" | "mood" | "dashboard";

function millisecondsUntilNextThreePmIST(from: Date): number {
  const istOffsetMinutes = 330;
  const currentIST = new Date(from.getTime() + istOffsetMinutes * 60 * 1000);
  const targetIST = new Date(currentIST);
  targetIST.setHours(15, 0, 0, 0);

  if (currentIST.getTime() >= targetIST.getTime()) {
    targetIST.setDate(targetIST.getDate() + 1);
  }

  return targetIST.getTime() - currentIST.getTime();
}

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

  const resetSession = useCallback(() => {
    setUser(null);
    setMoodResponses({ emotion: null, motivation: null, energy: null });
    setStage("login");
  }, [setMoodResponses, setStage, setUser]);

  useEffect(() => {
    if (stage !== "dashboard") {
      return;
    }

    const msUntilExpiry = millisecondsUntilNextThreePmIST(new Date());

    if (msUntilExpiry <= 0) {
      resetSession();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      resetSession();
    }, msUntilExpiry);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [stage, resetSession]);

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
