import "./App.css";
import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { AdminDashboard } from "./components/AdminDashboard";
import type { LoginResult } from "./components/LoginScreen";
import { LoginScreen } from "./components/LoginScreen";
import { MoodFlow } from "./components/MoodFlow";
import type { MoodResponses } from "./components/MoodFlow";
import { ToastProvider } from "./components/ToastContext";
import { useToast } from "./hooks/useToast";
import {
  fetchUserByCode,
  logMoodEntry,
  recordLoginEvent,
  updateLearnerProfile,
} from "./lib/dataAccess";

type Stage = "login" | "mood" | "learner-dashboard" | "admin-dashboard";

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
    const result = await fetchUserByCode(code);

    if (!result) {
      throw new Error("This user does not exist. Check your code.");
    }

    const { user: supabaseUser, learnerProfile: profile } = result;

    if (supabaseUser.role === "admin") {
      const adminProfile: LoginResult = {
        userId: supabaseUser.id,
        profileId: null,
        role: "admin",
        name: supabaseUser.full_name,
        code: supabaseUser.code,
        coins: 0,
        streak: 0,
        badges: 0,
      };
      setUser(adminProfile);
      setStage("admin-dashboard");
      return adminProfile;
    }

    if (!profile) {
      throw new Error("Learner profile not found for this code. Contact your mentor.");
    }

    const learnerResult: LoginResult = {
      userId: supabaseUser.id,
      profileId: profile.id,
      role: "learner",
      name: profile.display_name || supabaseUser.full_name,
      code: supabaseUser.code,
      coins: profile.coins_balance,
      streak: profile.streak_days,
      badges: profile.badges_earned,
    };

    const loginTimestamp = new Date().toISOString();

    setUser(learnerResult);

    await Promise.all([
      recordLoginEvent(supabaseUser.id, "webapp-login"),
      updateLearnerProfile(supabaseUser.id, {
        last_login_at: loginTimestamp,
        total_check_ins: profile.total_check_ins + 1,
      }),
    ]);

    setStage("mood");
    return learnerResult;
  }

  function handleMoodComplete(responses: MoodResponses) {
    setMoodResponses(responses);
    if (user?.role === "learner") {
      logMoodEntry(user.userId, {
        emotion: responses.emotion,
        motivation: responses.motivation,
        energy: responses.energy,
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to save mood check right now.";
        pushToast(message, "error");
      });
    }
    pushToast("Mood check saved. Have a focused session!", "success");
    setStage("learner-dashboard");
  }

  function handleExitMoodFlow() {
    setStage("learner-dashboard");
  }

  const resetSession = useCallback(() => {
    setUser(null);
    setMoodResponses({ emotion: null, motivation: null, energy: null });
    setStage("login");
  }, [setMoodResponses, setStage, setUser]);

  useEffect(() => {
    if (stage !== "learner-dashboard") {
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
      {stage === "learner-dashboard" && user && (
        <Dashboard
          user={user}
          moodResponses={moodResponses}
          onUserChange={setUser}
        />
      )}
      {stage === "admin-dashboard" && user && user.role === "admin" && (
        <AdminDashboard admin={user} />
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
