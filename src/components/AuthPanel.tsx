"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { OnboardingStepHeader } from "@/components/OnboardingStepHeader";

export function AuthPanel({ onBeforeAuth }: { onBeforeAuth?: () => void }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function social(provider: "google" | "apple") {
    setError(null);
    onBeforeAuth?.();
    await authClient.signIn.social({
      provider,
      callbackURL: "/",
      errorCallbackURL: "/",
    });
  }

  async function emailPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onBeforeAuth?.();
      if (mode === "sign-in") {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/",
        });
        if (result.error) throw new Error(result.error.message);
      } else {
        const displayName = email.split("@")[0] || email;
        const result = await authClient.signUp.email({
          email,
          password,
          name: displayName,
          callbackURL: "/",
        });
        if (result.error) throw new Error(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <OnboardingStepHeader
        step="Step 3"
        title="Return to your accounts anytime"
      />
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={() => void social("google")}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => void social("apple")}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Continue with Apple
        </button>
      </div>

      {!emailOpen ? (
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          className="mt-3 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Use email and password instead
        </button>
      ) : (
        <form onSubmit={emailPassword} className="mt-3 grid gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={busy || !email || !password}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {busy
              ? "Working..."
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {mode === "sign-in"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
    </section>
  );
}
