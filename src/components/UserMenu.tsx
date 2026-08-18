"use client";

import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "convex/react";

interface AccountOption {
  _id: Id<"cocAccounts">;
  tag: string;
  name: string;
  townHallLevel: number;
}

export function UserMenu({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onSaveCurrent,
  saveDisabled,
  saving,
}: {
  accounts: AccountOption[] | undefined;
  selectedAccountId: Id<"cocAccounts"> | null;
  onSelectAccount: (accountId: Id<"cocAccounts"> | null) => void;
  onSaveCurrent: () => void;
  saveDisabled: boolean;
  saving: boolean;
}) {
  const user = useQuery(api.auth.getCurrentUser);
  const accountsLoading = accounts === undefined;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {user?.name || user?.email || "Signed in"}
          </p>
          {user?.email && (
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {user.email}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void authClient.signOut()}
          className="shrink-0 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Sign out
        </button>
      </div>

      <label className="mt-3 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Clash account
      </label>
      <select
        value={selectedAccountId ?? ""}
        disabled={accountsLoading}
        onChange={(e) =>
          onSelectAccount((e.target.value || null) as Id<"cocAccounts"> | null)
        }
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {accountsLoading ? (
          <option value="">Loading accounts...</option>
        ) : (
          <>
            <option value="">Current lookup</option>
            {accounts.map((account) => (
              <option key={account._id} value={account._id}>
                {account.name} ({account.tag})
              </option>
            ))}
          </>
        )}
      </select>

      <button
        type="button"
        onClick={onSaveCurrent}
        disabled={saveDisabled || saving}
        className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {saving ? "Saving..." : "Save current as account"}
      </button>
    </section>
  );
}
