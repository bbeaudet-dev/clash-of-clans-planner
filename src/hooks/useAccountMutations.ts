"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAccountMutations() {
  const saveCurrentAccount = useMutation(api.accounts.saveCurrentAccount);
  const updateAccountSettings = useMutation(
    api.accounts.updateAccountSettings
  ).withOptimisticUpdate((store, args) => {
    const accounts = store.getQuery(api.accounts.listMyAccounts, {});
    if (accounts) {
      store.setQuery(
        api.accounts.listMyAccounts,
        {},
        accounts.map((account) =>
          account._id === args.accountId
            ? {
                ...account,
                builderCount: args.builderCount,
                goldPass: args.goldPass,
              }
            : account
        )
      );
    }

    const accountData = store.getQuery(api.accounts.getAccountData, {
      accountId: args.accountId,
    });
    if (accountData) {
      store.setQuery(
        api.accounts.getAccountData,
        { accountId: args.accountId },
        {
          ...accountData,
          account: {
            ...accountData.account,
            builderCount: args.builderCount,
            goldPass: args.goldPass,
          },
        }
      );
    }
  });
  const updateAccountSkips = useMutation(
    api.accounts.updateAccountSkips
  ).withOptimisticUpdate((store, args) => {
    const accounts = store.getQuery(api.accounts.listMyAccounts, {});
    if (accounts) {
      store.setQuery(
        api.accounts.listMyAccounts,
        {},
        accounts.map((account) =>
          account._id === args.accountId
            ? {
                ...account,
                skips: args.skips,
              }
            : account
        )
      );
    }

    const accountData = store.getQuery(api.accounts.getAccountData, {
      accountId: args.accountId,
    });
    if (accountData) {
      store.setQuery(
        api.accounts.getAccountData,
        { accountId: args.accountId },
        {
          ...accountData,
          account: {
            ...accountData.account,
            skips: args.skips,
          },
        }
      );
    }
  });

  return {
    saveCurrentAccount,
    updateAccountSettings,
    updateAccountSkips,
  };
}
