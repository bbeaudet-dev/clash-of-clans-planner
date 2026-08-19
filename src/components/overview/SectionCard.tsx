import type { ReactNode } from "react";

export function SectionCard({
  title,
  count,
  locked = false,
  note,
  children,
}: {
  title: string;
  count?: number;
  /** Renders the whole section muted (e.g. not yet unlocked at this TH). */
  locked?: boolean;
  /** A muted line to show in place of rows (locked reason, empty state, ...). */
  note?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={`mb-6 break-inside-avoid rounded-xl border p-4 ${
        locked
          ? "border-zinc-200/70 bg-zinc-50/50 dark:border-zinc-800/60 dark:bg-zinc-950/40"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <h3
        className={`mb-1 text-sm font-semibold uppercase tracking-wide ${
          locked
            ? "text-zinc-400 dark:text-zinc-600"
            : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {title}
        {count !== undefined && !locked && (
          <span className="ml-2 font-normal normal-case text-zinc-400">
            ({count})
          </span>
        )}
      </h3>
      {note ? (
        <p className="py-1 text-xs italic text-zinc-400 dark:text-zinc-600">
          {note}
        </p>
      ) : (
        <ul>{children}</ul>
      )}
    </section>
  );
}

export function LoadingSectionCard({ title }: { title: string }) {
  return (
    <section className="mb-6 break-inside-avoid rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      <div className="space-y-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-12 rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ))}
      </div>
    </section>
  );
}
