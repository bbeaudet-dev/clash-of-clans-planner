"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useAccountSelection({
  isAuthenticated,
  selectedAccountId,
}: {
  isAuthenticated: boolean;
  selectedAccountId: Id<"cocAccounts"> | null | undefined;
}) {
  const accounts = useQuery(
    api.accounts.listMyAccounts,
    isAuthenticated ? {} : "skip"
  );
  const selectedAccount = accounts?.find(
    (account) => account._id === selectedAccountId
  );
  const effectiveSelectedAccountId: Id<"cocAccounts"> | null = isAuthenticated
    ? selectedAccountId === undefined
      ? (accounts?.[0]?._id ?? null)
      : (selectedAccount?._id ?? null)
    : null;
  const effectiveSelectedAccount = accounts?.find(
    (account) => account._id === effectiveSelectedAccountId
  );
  const accountData = useQuery(
    api.accounts.getAccountData,
    effectiveSelectedAccountId ? { accountId: effectiveSelectedAccountId } : "skip"
  );
  const snapshotsLoading =
    isAuthenticated &&
    effectiveSelectedAccountId !== null &&
    accountData === undefined;

  return {
    accountData,
    accounts,
    effectiveSelectedAccount,
    effectiveSelectedAccountId,
    snapshotsLoading,
  };
}
