"use client";

import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { OnboardingStepHeader } from "@/components/OnboardingStepHeader";

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
  editingAccountId,
  editAccountName,
  onStartEditAccount,
  onEditAccountName,
  onRenameAccount,
  onCancelEditAccount,
  onRequestDeleteAccount,
  renaming,
}: {
  accounts: AccountOption[] | undefined;
  selectedAccountId: Id<"cocAccounts"> | null;
  onSelectAccount: (accountId: Id<"cocAccounts"> | null) => void;
  editingAccountId: Id<"cocAccounts"> | null;
  editAccountName: string;
  onStartEditAccount: () => void;
  onEditAccountName: (name: string) => void;
  onRenameAccount: () => void;
  onCancelEditAccount: () => void;
  onRequestDeleteAccount: () => void;
  renaming: boolean;
}) {
  const user = useQuery(api.auth.getCurrentUser);
  const accountsLoading = accounts === undefined;
  const selectedAccount = accounts?.find((account) => account._id === selectedAccountId);
  const editingSelectedAccount =
    Boolean(selectedAccountId) && editingAccountId === selectedAccountId;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <OnboardingStepHeader
        step="Step 3"
        title="Save your accounts to come back anytime"
        accentClassName="text-violet-600 dark:text-violet-400"
      />
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

      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Clash account
        </label>
        {selectedAccount && !editingSelectedAccount && (
          <button
            type="button"
            onClick={onStartEditAccount}
            className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline hover:underline-offset-2 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Edit Account
          </button>
        )}
      </div>
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
            <option value="">Tag lookup</option>
            {accounts.map((account) => (
              <option key={account._id} value={account._id}>
                {account.name} ({account.tag})
              </option>
            ))}
          </>
        )}
      </select>

      {selectedAccount && editingSelectedAccount && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Account name
          </label>
          <input
            value={editAccountName}
            onChange={(e) => onEditAccountName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRenameAccount}
              disabled={renaming}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {renaming ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancelEditAccount}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-950"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onRequestDeleteAccount}
              className="ml-auto rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              Delete Account
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
