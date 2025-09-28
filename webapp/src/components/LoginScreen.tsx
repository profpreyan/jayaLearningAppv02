import type { FormEvent } from "react";
import { useMemo, useState } from "react";

export interface LoginResult {
  name: string;
  code: string;
  coins: number;
  streak: number;
  badges: number;
}

interface LoginScreenProps {
  onAuthenticate: (code: string) => Promise<LoginResult>;
}

export function LoginScreen({ onAuthenticate }: LoginScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = useMemo(() => /^[A-Za-z0-9]{5}$/.test(code), [code]);

  function handleCodeChange(value: string) {
    const next = value.toUpperCase();
    if (/^[A-Za-z0-9]*$/.test(next)) {
      setCode(next);
      setError(null);
    } else {
      setError("Use only letters and numbers.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      await onAuthenticate(code);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel login-panel">
      <header>
        <h1>Welcome back</h1>
        <p className="eyebrow">Enter your 5-character access code to continue.</p>
      </header>
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="code-input" className="sr-only">
          Enter your access code
        </label>
        <input
          id="code-input"
          autoFocus
          maxLength={5}
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          placeholder="Enter your Code"
          aria-invalid={!!error}
          aria-describedby={error ? "code-help" : undefined}
        />
        <button type="submit" className="btn-primary" disabled={!isValid || isLoading}>
          {isLoading ? "Checking..." : "Log In"}
        </button>
        <p id="code-help" role="status" className={`helper ${error ? "error" : "hint"}`}>
          {error ? error : "Codes are 5 letters or numbers. Press Enter to submit."}
        </p>
      </form>
    </section>
  );
}
