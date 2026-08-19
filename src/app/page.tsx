"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useConvexAuth, useMutation } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ApiPlayer, buildVillageStats } from "@/lib/gameData";
import { parseVillageExport, VillageExport } from "@/lib/villageExport";
import { AccountDeleteDialog } from "@/components/AccountDeleteDialog";
import { AuthPanel } from "@/components/AuthPanel";
import { Overview } from "@/components/Overview";
import { TagLookupPanel } from "@/components/TagLookupPanel";
import { TimingPanel } from "@/components/TimingPanel";
import { UserMenu } from "@/components/UserMenu";
import { VillageImportPanel } from "@/components/VillageImportPanel";
import { useAccountEditor } from "@/hooks/useAccountEditor";
import { useAccountMutations } from "@/hooks/useAccountMutations";
import { useAccountSelection } from "@/hooks/useAccountSelection";
import { useSkipDrafts } from "@/hooks/useSkipDrafts";
import {
  clearPendingOnboarding,
  readPendingOnboarding,
  writePendingOnboarding,
} from "@/lib/pendingOnboarding";

const DEFAULT_TAG = "";
const MAX_BUILDERS = 7;

function normalizeTag(tag: string): string {
  return tag.trim().toUpperCase().replace(/^#/, "").replace(/O/g, "0");
}

function clampBuilderCount(builderCount: number): number {
  return Math.min(MAX_BUILDERS, Math.max(1, Math.floor(builderCount)));
}

export default function Home() {
  const fetchPlayer = useAction(api.players.fetchPlayer);
  const importVillageData = useMutation(api.players.importVillageData);
  const { saveCurrentAccount, updateAccountSettings, updateAccountSkips } =
    useAccountMutations();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const [tag, setTag] = useState(DEFAULT_TAG);
  const [player, setPlayer] = useState<ApiPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<
    Id<"cocAccounts"> | null | undefined
  >(undefined);
  const [savingAccount, setSavingAccount] = useState(false);

  const [village, setVillage] = useState<VillageExport | null>(null);
  const [apiUpdatedAt, setApiUpdatedAt] = useState<number | null>(null);
  const [builderCount, setBuilderCount] = useState(5);
  const [goldPass, setGoldPass] = useState(false);
  const [skips, setSkips] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [pendingSavePrompt, setPendingSavePrompt] = useState(false);
  const [pending, setPending] = useState<{
    parsed: VillageExport;
    raw: unknown;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydratedAccountIdRef = useRef<Id<"cocAccounts"> | null>(null);
  const restoredPendingRef = useRef(false);

  const {
    accountData,
    accounts,
    effectiveSelectedAccount,
    effectiveSelectedAccountId,
    snapshotsLoading,
  } = useAccountSelection({ isAuthenticated, selectedAccountId });
  // While an account is active, the tag field is locked; users switch the
  // account selector to "Tag lookup" to look something else up.
  const lookupLocked = Boolean(effectiveSelectedAccountId);
  const skipDraftKey = effectiveSelectedAccountId
    ? `account:${effectiveSelectedAccountId}`
    : `tag:${normalizeTag(player?.tag ?? tag)}`;
  const {
    activeSkips,
    clearDraft: clearSkipDraft,
    dirty: skipDraftDirty,
    discard: handleDiscardSkipDraft,
    enter: handleEnterSkipMode,
    save: handleSaveSkips,
    setCount: handleSetSkipCount,
    setSkipMode,
    skipMode,
  } = useSkipDrafts({
    skips,
    draftKey: skipDraftKey,
    onCommit: (nextSkips) => {
      setSkips(nextSkips);
      if (!effectiveSelectedAccountId) return;
      void updateAccountSkips({
        accountId: effectiveSelectedAccountId,
        skips: nextSkips,
      });
    },
  });
  const accountEditor = useAccountEditor({
    accounts,
    effectiveSelectedAccount,
    onDeleted: handleSelectAccount,
    onError: setError,
  });
  const playerAccountExists =
    !!player &&
    !!accounts?.some(
      (account) => normalizeTag(account.tag) === normalizeTag(player.tag)
    );
  const canSaveCurrentAccount =
    isAuthenticated &&
    !lookupLocked &&
    !!player &&
    !playerAccountExists &&
    !savingAccount;

  function persistPendingOnboarding() {
    if (!tag.trim() && !player && !importText.trim()) return;
    writePendingOnboarding({
      tag: player?.tag ?? tag,
      player,
      apiUpdatedAt,
      importText,
      builderCount,
      goldPass,
      savedAt: Date.now(),
    });
  }

  useEffect(() => {
    if (selectedAccountId === null) return;
    if (!accountData) return;
    if (hydratedAccountIdRef.current === accountData.account._id) return;

    hydratedAccountIdRef.current = accountData.account._id;
    queueMicrotask(() => {
      setTag(accountData.account.tag);
      setBuilderCount(clampBuilderCount(accountData.account.builderCount ?? 5));
      setGoldPass(accountData.account.goldPass ?? false);
      setSkips(accountData.account.skips ?? []);
      setSkipMode(false);
      if (accountData.apiSnapshot?.raw) {
        setPlayer(accountData.apiSnapshot.raw as ApiPlayer);
        setApiUpdatedAt(accountData.apiSnapshot.fetchedAt);
      } else {
        setPlayer(null);
        setApiUpdatedAt(null);
      }

      // Refresh army/hero levels from the API in the background so a cached
      // snapshot (e.g. a hero that finished upgrading yesterday) doesn't linger
      // as stale. Falls back silently to the snapshot if the fetch fails.
      if (accountData.account.tag) {
        void fetchPlayer({ tag: accountData.account.tag })
          .then((fresh) => {
            setPlayer(fresh as ApiPlayer);
            setApiUpdatedAt(Date.now());
          })
          .catch(() => {});
      }

      if (accountData.exportSnapshot?.raw) {
        try {
          const parsed = parseVillageExport(accountData.exportSnapshot.raw);
          setVillage(parsed);
          const asOf = parsed.timestamp
            ? new Date(parsed.timestamp * 1000).toLocaleString()
            : new Date(accountData.exportSnapshot.fetchedAt).toLocaleString();
          setImportSuccess(`Last import: ${asOf}`);
        } catch {
          setVillage(null);
          setImportSuccess(null);
        }
      } else {
        setVillage(null);
        setImportSuccess(null);
      }
    });
  }, [accountData, fetchPlayer, selectedAccountId, setSkipMode]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || restoredPendingRef.current) return;
    const pendingOnboarding = readPendingOnboarding();
    if (!pendingOnboarding) return;

    restoredPendingRef.current = true;
    clearPendingOnboarding();
    queueMicrotask(() => {
      hydratedAccountIdRef.current = null;
      setSelectedAccountId(null);
      setTag(pendingOnboarding.tag);
      setBuilderCount(clampBuilderCount(pendingOnboarding.builderCount));
      setGoldPass(pendingOnboarding.goldPass);
      if (pendingOnboarding.player) {
        setPlayer(pendingOnboarding.player);
        setApiUpdatedAt(pendingOnboarding.apiUpdatedAt ?? Date.now());
        setPendingSavePrompt(true);
      }
      if (pendingOnboarding.importText.trim()) {
        setImportText(pendingOnboarding.importText);
        try {
          const raw = JSON.parse(pendingOnboarding.importText);
          const parsed = parseVillageExport(raw);
          setVillage(parsed);
          const asOf = parsed.timestamp
            ? new Date(parsed.timestamp * 1000).toLocaleString()
            : new Date(pendingOnboarding.savedAt).toLocaleString();
          setImportSuccess(`Restored import: ${asOf}`);
          setImportOpen(false);
        } catch {
          setImportError(
            "Sign-in restored your pasted JSON, but it needs re-importing."
          );
          setImportOpen(true);
        }
      }
    });
  }, [authLoading, isAuthenticated]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = (await fetchPlayer({ tag })) as ApiPlayer;
      setPlayer(result);
      setApiUpdatedAt(Date.now());
      setTag(result.tag);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }

  function handleTagChange(nextTag: string) {
    setTag(nextTag);
    setSelectedAccountId(null);
    setSkips([]);
    clearSkipDraft();
    setSkipMode(false);
  }

  async function applyImport(parsed: VillageExport, raw: unknown) {
    setVillage(parsed);
    setPending(null);
    setImportError(null);
    setImportOpen(false);
    const asOf = parsed.timestamp
      ? new Date(parsed.timestamp * 1000).toLocaleString()
      : new Date().toLocaleString();
    setImportSuccess(`Last import: ${asOf}`);
    try {
      await importVillageData({
        tag: parsed.tag ?? tag,
        townHallLevel: parsed.townHallLevel,
        raw,
        exportTimestamp: parsed.timestamp ?? undefined,
        cocAccountId: effectiveSelectedAccountId ?? undefined,
      });
    } catch (err) {
      setImportError(
        err instanceof Error
          ? `Imported locally, but could not save it: ${err.message}`
          : "Imported locally, but could not save it."
      );
    }
  }

  function handleImport() {
    setImportError(null);
    try {
      const raw = JSON.parse(importText);
      const parsed = parseVillageExport(raw);
      const loadedTag = player?.tag ? normalizeTag(player.tag) : null;
      const exportTag = parsed.tag ? normalizeTag(parsed.tag) : null;
      if (loadedTag && exportTag && loadedTag !== exportTag) {
        setPending({ parsed, raw });
        return;
      }
      void applyImport(parsed, raw);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Could not parse that JSON."
      );
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportText(await file.text());
    setImportOpen(true);
  }

  async function handleSaveAccount() {
    if (!player || playerAccountExists) return;
    setSavingAccount(true);
    setError(null);
    try {
      const accountId = await saveCurrentAccount({
        tag: player.tag,
        name: player.name,
        townHallLevel: player.townHallLevel,
        builderCount,
        goldPass,
      });
      if (importText.trim()) {
        try {
          const raw = JSON.parse(importText);
          const parsed = parseVillageExport(raw);
          await importVillageData({
            tag: parsed.tag ?? player.tag,
            townHallLevel: parsed.townHallLevel,
            raw,
            exportTimestamp: parsed.timestamp ?? undefined,
            cocAccountId: accountId,
          });
        } catch (err) {
          setImportError(
            err instanceof Error
              ? `Saved account, but could not attach village data: ${err.message}`
              : "Saved account, but could not attach village data."
          );
        }
      }
      setPendingSavePrompt(false);
      clearPendingOnboarding();
      setSelectedAccountId(accountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save account.");
    } finally {
      setSavingAccount(false);
    }
  }

  function handleSelectAccount(accountId: Id<"cocAccounts"> | null) {
    hydratedAccountIdRef.current = null;
    setSelectedAccountId(accountId);
    accountEditor.cancelEdit();
    accountEditor.cancelDelete();
    clearSkipDraft();
    if (!accountId) {
      setSkips([]);
      setSkipMode(false);
      return;
    }

    const account = accounts?.find((a) => a._id === accountId);
    if (!account) return;

    setTag(account.tag);
    setBuilderCount(clampBuilderCount(account.builderCount ?? 5));
    setGoldPass(account.goldPass ?? false);
    setSkips(account.skips ?? []);
    setSkipMode(false);
    setPlayer(null);
    setApiUpdatedAt(null);
    setVillage(null);
    setImportSuccess(null);
    setPendingSavePrompt(false);
  }

  function persistAccountSettings(nextBuilderCount: number, nextGoldPass: boolean) {
    if (!effectiveSelectedAccountId) return;
    void updateAccountSettings({
      accountId: effectiveSelectedAccountId,
      builderCount: nextBuilderCount,
      goldPass: nextGoldPass,
    });
  }

  function handleBuilderCount(nextBuilderCount: number) {
    const clamped = clampBuilderCount(nextBuilderCount);
    setBuilderCount(clamped);
    persistAccountSettings(clamped, goldPass);
  }

  function handleGoldPass(nextGoldPass: boolean) {
    setGoldPass(nextGoldPass);
    persistAccountSettings(builderCount, nextGoldPass);
  }

  const stats = player ? buildVillageStats(player) : null;
  const hasData = stats || village;
  const overviewName = player?.name ?? effectiveSelectedAccount?.name ?? null;
  const overviewTag = player?.tag ?? effectiveSelectedAccount?.tag ?? null;
  const overviewTownHallLevel =
    effectiveSelectedAccount && !stats && !village
      ? effectiveSelectedAccount.townHallLevel
      : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="w-full max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Clash of Clans Planner
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Look up your army by tag, and import your village data for defenses.
          </p>
        </header>

        <div className="mb-6 grid items-start gap-4 sm:grid-cols-3">
          <TagLookupPanel
            tag={tag}
            loading={loading}
            lookupLocked={lookupLocked}
            apiUpdatedAt={apiUpdatedAt}
            isAuthenticated={isAuthenticated}
            canSaveCurrentAccount={canSaveCurrentAccount}
            savingAccount={savingAccount}
            playerAccountExists={playerAccountExists}
            onTagChange={handleTagChange}
            onSubmit={handleSubmit}
            onSaveAccount={() => void handleSaveAccount()}
          />

          <VillageImportPanel
            village={village}
            importOpen={importOpen}
            importText={importText}
            importError={importError}
            importSuccess={importSuccess}
            fileRef={fileRef}
            onToggleOpen={() => setImportOpen((o) => !o)}
            onImportText={setImportText}
            onImport={handleImport}
            onFile={handleFile}
          />

          {authLoading ? (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-3 w-44 rounded bg-zinc-100 dark:bg-zinc-900" />
              <div className="mt-4 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            </section>
          ) : isAuthenticated ? (
            <UserMenu
              accounts={accounts}
              selectedAccountId={
                selectedAccountId === undefined
                  ? effectiveSelectedAccountId
                  : selectedAccountId
              }
              onSelectAccount={handleSelectAccount}
              editingAccountId={accountEditor.editingAccountId}
              editAccountName={accountEditor.editAccountName}
              onStartEditAccount={accountEditor.startEdit}
              onEditAccountName={accountEditor.setEditAccountName}
              onRenameAccount={() => void accountEditor.saveName()}
              onCancelEditAccount={accountEditor.cancelEdit}
              onRequestDeleteAccount={() =>
                accountEditor.requestDelete(effectiveSelectedAccountId)
              }
              renaming={accountEditor.renamingAccount}
            />
          ) : (
            <AuthPanel onBeforeAuth={persistPendingOnboarding} />
          )}
        </div>

        {pendingSavePrompt && canSaveCurrentAccount && (
          <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                You are signed in. Save this looked-up village now so you can
                come back to it without re-entering everything.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveAccount()}
                  disabled={savingAccount}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {savingAccount ? "Saving..." : "Save account"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingSavePrompt(false)}
                  className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-900"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        )}

        {pending && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            This export is for{" "}
            <span className="font-mono">{pending.parsed.tag}</span>, but you
            looked up <span className="font-mono">{player?.tag}</span>. Import it
            anyway?
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void applyImport(pending.parsed, pending.raw)}
                className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                Use it anyway
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded border border-amber-400 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {accountEditor.deleteAccountTarget && (
          <AccountDeleteDialog
            account={accountEditor.deleteAccountTarget}
            deleting={accountEditor.deletingAccount}
            onCancel={accountEditor.cancelDelete}
            onDelete={() => void accountEditor.confirmDelete()}
          />
        )}

        {(hasData || snapshotsLoading) && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Overview
              playerName={overviewName}
              playerTag={overviewTag}
              fallbackTownHallLevel={overviewTownHallLevel}
              loading={snapshotsLoading}
              stats={stats}
              village={village}
              activeSkips={activeSkips}
              skipMode={skipMode}
              builderCount={builderCount}
              onBuilderCount={handleBuilderCount}
              goldPass={goldPass}
              onGoldPass={handleGoldPass}
              maxBuilderCount={MAX_BUILDERS}
              onEnterSkipMode={handleEnterSkipMode}
              onSaveSkips={handleSaveSkips}
              onDiscardSkipDraft={handleDiscardSkipDraft}
              skipDraftDirty={skipDraftDirty}
              onSetSkipCount={handleSetSkipCount}
            />
            <TimingPanel
              builderCount={builderCount}
              goldPass={goldPass}
              loading={snapshotsLoading}
              stats={stats}
              village={village}
              skips={activeSkips}
            />
          </div>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span>
            This material is unofficial and is not endorsed by Supercell.
          </span>
          <Link href="/privacy" className="text-sky-600 hover:underline dark:text-sky-400">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-sky-600 hover:underline dark:text-sky-400">
            Terms
          </Link>
        </footer>
      </main>
    </div>
  );
}
