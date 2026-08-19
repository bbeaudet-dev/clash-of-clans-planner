import type { ReactNode } from "react";

export function StepHelpTooltip({
  label,
  align = "left",
  children,
}: {
  label: string;
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-violet-300 bg-violet-50 text-[10px] font-bold leading-none text-violet-700 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
      >
        ?
      </button>
      <div
        className={`invisible absolute z-20 mt-6 w-72 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-600 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
