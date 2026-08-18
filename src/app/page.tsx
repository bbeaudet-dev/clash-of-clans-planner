"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ApiPlayer, buildVillageStats } from "@/lib/gameData";
import { parseVillageExport, VillageExport } from "@/lib/villageExport";
import { AuthPanel } from "@/components/AuthPanel";
import { Overview } from "@/components/Overview";
import { TimingPanel } from "@/components/TimingPanel";
import { UserMenu } from "@/components/UserMenu";

const DEFAULT_TAG = "#Q8JJJ2UP";
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
  const [builderCount, setBuilderCount] = useState(6);
  const [goldPass, setGoldPass] = useState(false);
  const [skips, setSkips] = useState<string[]>([]);
  const [skipMode, setSkipMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    parsed: VillageExport;
    raw: unknown;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydratedAccountIdRef = useRef<Id<"cocAccounts"> | null>(null);

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
  const accountData = useQuery(
    api.accounts.getAccountData,
    effectiveSelectedAccountId ? { accountId: effectiveSelectedAccountId } : "skip"
  );
  const snapshotsLoading =
    isAuthenticated &&
    effectiveSelectedAccountId !== null &&
    accountData === undefined;

  useEffect(() => {
    if (!accountData) return;
    if (hydratedAccountIdRef.current === accountData.account._id) return;

    hydratedAccountIdRef.current = accountData.account._id;
    queueMicrotask(() => {
      setTag(accountData.account.tag);
      setBuilderCount(clampBuilderCount(accountData.account.builderCount ?? 6));
      setGoldPass(accountData.account.goldPass ?? false);
      setSkips(accountData.account.skips ?? []);
      if (accountData.apiSnapshot?.raw) {
        setPlayer(accountData.apiSnapshot.raw as ApiPlayer);
      } else {
        setPlayer(null);
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
  }, [accountData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = (await fetchPlayer({ tag })) as ApiPlayer;
      setPlayer(result);
      setTag(result.tag);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPlayer(null);
    } finally {
      setLoading(false);
    }
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
    if (!player) return;
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
    if (!accountId) {
      setSkips([]);
      setSkipMode(false);
      return;
    }

    const account = accounts?.find((a) => a._id === accountId);
    if (!account) return;

    setTag(account.tag);
    setBuilderCount(clampBuilderCount(account.builderCount ?? 6));
    setGoldPass(account.goldPass ?? false);
    setSkips(account.skips ?? []);
    setSkipMode(false);
    setPlayer(null);
    setVillage(null);
    setImportSuccess(null);
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

  function handleToggleSkip(key: string) {
    const nextSkips = skips.includes(key)
      ? skips.filter((skip) => skip !== key)
      : [...skips, key];
    setSkips(nextSkips);
    if (!effectiveSelectedAccountId) return;
    void updateAccountSkips({
      accountId: effectiveSelectedAccountId,
      skips: nextSkips,
    });
  }

  const stats = player ? buildVillageStats(player) : null;
  const hasData = stats || village;
  const overviewName = player?.name ?? selectedAccount?.name ?? null;
  const overviewTag = player?.tag ?? selectedAccount?.tag ?? null;
  const overviewTownHallLevel =
    selectedAccount && !stats && !village ? selectedAccount.townHallLevel : null;

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
              onSaveCurrent={() => void handleSaveAccount()}
              saveDisabled={!player}
              saving={savingAccount}
            />
          ) : (
            <AuthPanel />
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setSelectedAccountId(null);
                setSkips([]);
                setSkipMode(false);
              }}
              placeholder="#PLAYERTAG"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-mono text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={loading || tag.trim().length === 0}
              className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {loading ? "Loading…" : "Look up"}
            </button>
          </form>

          <div>
            <button
              type="button"
              onClick={() => setImportOpen((o) => !o)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Import village data
            </button>

            {importSuccess && !importOpen && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <span aria-hidden>✓</span>
                {importSuccess}
              </p>
            )}

            {importOpen && (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  In Clash of Clans, tap the <strong>Settings</strong> button
                  (gear icon), then <strong>More Settings</strong>. Scroll to the{" "}
                  <strong>Data Export</strong> section and tap{" "}
                  <strong>copy</strong> on &ldquo;Export village data in JSON
                  format&rdquo;. Paste it below (or upload the file).
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your village-data JSON here…"
                  rows={4}
                  spellCheck={false}
                  className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importText.trim().length === 0}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Import
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Upload file
                  </button>
                </div>
                {importError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {importError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

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

        {(hasData || snapshotsLoading) && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Overview
              playerName={overviewName}
              playerTag={overviewTag}
              fallbackTownHallLevel={overviewTownHallLevel}
              loading={snapshotsLoading}
              stats={stats}
              village={village}
              skips={skips}
              skipMode={skipMode}
              onSkipMode={setSkipMode}
              onToggleSkip={handleToggleSkip}
            />
            <TimingPanel
              builderCount={builderCount}
              onBuilderCount={handleBuilderCount}
              goldPass={goldPass}
              onGoldPass={handleGoldPass}
              loading={snapshotsLoading}
              stats={stats}
              village={village}
              skips={skips}
            />
          </div>
        )}
      </main>
    </div>
  );
}
