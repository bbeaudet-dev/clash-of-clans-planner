"use client";

import type { FormEvent } from "react";
import { OnboardingStepHeader } from "@/components/OnboardingStepHeader";
import { StepHelpTooltip } from "@/components/StepHelpTooltip";

export function TagLookupPanel({
  tag,
  loading,
  lookupLocked,
  apiUpdatedAt,
  isAuthenticated,
  canSaveCurrentAccount,
  savingAccount,
  playerAccountExists,
  onTagChange,
  onSubmit,
  onSaveAccount,
}: {
  tag: string;
  loading: boolean;
  lookupLocked: boolean;
  apiUpdatedAt: number | null;
  isAuthenticated: boolean;
  canSaveCurrentAccount: boolean;
  savingAccount: boolean;
  playerAccountExists: boolean;
  onTagChange: (tag: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSaveAccount: () => void;
}) {
  return (
    <div>
      <OnboardingStepHeader
        step="Step 1"
        title="Enter your player tag"
      >
        <StepHelpTooltip label="What player tag lookup can access">
          <p>
            Player tags let us look up public Clash of Clans profile data
            through RoyaleAPI, including your name, Town Hall, heroes, troops,
            spells, siege machines, pets, and hero equipment.
          </p>
          <p className="mt-2">
            Public tag lookup does not include private base details like exact
            building, trap, collector, or wall levels. That is why Step 2 is
            needed for a full base analysis.
          </p>
        </StepHelpTooltip>
      </OnboardingStepHeader>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={tag}
          onChange={(e) => onTagChange(e.target.value)}
          placeholder="#PLAYER_TAG"
          spellCheck={false}
          disabled={lookupLocked}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-mono text-zinc-900 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={lookupLocked || loading || tag.trim().length === 0}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? "Loading..." : "Look up"}
        </button>
      </form>

      {apiUpdatedAt ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <span aria-hidden>✓</span>
          Last updated: {new Date(apiUpdatedAt).toLocaleString()}
        </p>
      ) : (
        lookupLocked && (
          <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
            Switch the account selector to{" "}
            <span className="font-medium">Tag lookup</span> to look up another
            player.
          </p>
        )
      )}

      {isAuthenticated && !lookupLocked && (
        <button
          type="button"
          onClick={onSaveAccount}
          disabled={!canSaveCurrentAccount}
          className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {savingAccount
            ? "Saving..."
            : playerAccountExists
              ? "Account already saved"
              : "Save current as account"}
        </button>
      )}
    </div>
  );
}
