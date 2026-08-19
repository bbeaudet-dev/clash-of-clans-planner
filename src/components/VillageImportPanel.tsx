import type { ChangeEvent, RefObject } from "react";
import { OnboardingStepHeader } from "@/components/OnboardingStepHeader";
import { VillageExport } from "@/lib/villageExport";

export function VillageImportPanel({
  village,
  importOpen,
  importText,
  importError,
  importSuccess,
  fileRef,
  onToggleOpen,
  onImportText,
  onImport,
  onFile,
}: {
  village: VillageExport | null;
  importOpen: boolean;
  importText: string;
  importError: string | null;
  importSuccess: string | null;
  fileRef: RefObject<HTMLInputElement | null>;
  onToggleOpen: () => void;
  onImportText: (value: string) => void;
  onImport: () => void;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <OnboardingStepHeader
        step="Step 2"
        title="Copy/paste your village data JSON from Settings"
        accentClassName="text-amber-600 dark:text-amber-400"
      >
        <div className="group relative shrink-0">
          <button
            type="button"
            aria-label="How to copy village data"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-xs font-bold text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
          >
            ?
          </button>
          <div className="invisible absolute right-0 z-20 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-600 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <p>
              Some village data is private and can be accessed through in-game{" "}
              <strong>Settings</strong> - <strong>More settings</strong> -{" "}
              <strong>Copy village data JSON</strong>.
            </p>
            <p className="mt-2">
              You will need to repeat this step when you want an updated
              analysis, but the snapshot still gives useful planning insights.
              We do not share this private info. See the{" "}
              <a
                href="/privacy"
                className="font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                Privacy Policy
              </a>{" "}
              for more.
            </p>
          </div>
        </div>
      </OnboardingStepHeader>
      <button
        type="button"
        onClick={onToggleOpen}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
          village
            ? "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            : "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
        }`}
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
            In Clash of Clans, tap the <strong>Settings</strong> button (gear
            icon), then <strong>More Settings</strong>. Scroll to the{" "}
            <strong>Data Export</strong> section and tap <strong>copy</strong>{" "}
            on &ldquo;Export village data in JSON format&rdquo;. Paste it below
            (or upload the file).
          </p>
          <textarea
            value={importText}
            onChange={(e) => onImportText(e.target.value)}
            placeholder="Paste your village-data JSON here…"
            rows={4}
            spellCheck={false}
            className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onImport}
              disabled={importText.trim().length === 0}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={onFile}
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
  );
}
