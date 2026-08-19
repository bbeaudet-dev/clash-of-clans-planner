"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface AccountOption {
  _id: Id<"cocAccounts">;
  tag: string;
  name: string;
  townHallLevel: number;
}

export function useAccountEditor({
  accounts,
  effectiveSelectedAccount,
  onDeleted,
  onError,
}: {
  accounts: AccountOption[] | undefined;
  effectiveSelectedAccount: AccountOption | undefined;
  onDeleted: (accountId: Id<"cocAccounts"> | null) => void;
  onError: (message: string | null) => void;
}) {
  const renameAccount = useMutation(api.accounts.renameAccount);
  const deleteAccount = useMutation(api.accounts.deleteAccount);
  const [editingAccountId, setEditingAccountId] =
    useState<Id<"cocAccounts"> | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [renamingAccount, setRenamingAccount] = useState(false);
  const [deleteAccountId, setDeleteAccountId] =
    useState<Id<"cocAccounts"> | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const deleteAccountTarget =
    accounts?.find((account) => account._id === deleteAccountId) ?? null;

  function startEdit() {
    if (!effectiveSelectedAccount) return;
    setEditingAccountId(effectiveSelectedAccount._id);
    setEditAccountName(effectiveSelectedAccount.name);
  }

  function cancelEdit() {
    setEditingAccountId(null);
  }

  function requestDelete(accountId: Id<"cocAccounts"> | null) {
    if (accountId) {
      setDeleteAccountId(accountId);
    }
  }

  function cancelDelete() {
    setDeleteAccountId(null);
  }

  async function saveName() {
    if (!editingAccountId) return;
    setRenamingAccount(true);
    onError(null);
    try {
      await renameAccount({
        accountId: editingAccountId,
        name: editAccountName,
      });
      setEditingAccountId(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not rename account.");
    } finally {
      setRenamingAccount(false);
    }
  }

  async function confirmDelete() {
    if (!deleteAccountId) return;
    setDeletingAccount(true);
    onError(null);
    try {
      const remainingAccounts =
        accounts?.filter((account) => account._id !== deleteAccountId) ?? [];
      await deleteAccount({ accountId: deleteAccountId });
      setDeleteAccountId(null);
      setEditingAccountId(null);
      onDeleted(remainingAccounts[0]?._id ?? null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete account.");
    } finally {
      setDeletingAccount(false);
    }
  }

  return {
    cancelDelete,
    cancelEdit,
    confirmDelete,
    deleteAccountTarget,
    deletingAccount,
    editAccountName,
    editingAccountId,
    renamingAccount,
    requestDelete,
    saveName,
    setEditAccountName,
    startEdit,
  };
}
