import type { ReactNode } from "react";

export function CompletionCard({
  title,
  primary,
  secondary,
  children,
}: {
  title: string;
  primary: string;
  secondary: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {primary}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>{secondary}</span>
        {children}
      </div>
    </div>
  );
}
