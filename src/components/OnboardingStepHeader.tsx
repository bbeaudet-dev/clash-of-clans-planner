import type { ReactNode } from "react";

export function OnboardingStepHeader({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            {step}
          </p>
          {children}
        </div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      </div>
    </div>
  );
}
