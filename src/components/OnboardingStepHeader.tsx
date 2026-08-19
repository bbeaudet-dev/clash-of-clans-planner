import type { ReactNode } from "react";

export function OnboardingStepHeader({
  step,
  title,
  accentClassName,
  children,
}: {
  step: string;
  title: string;
  accentClassName: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${accentClassName}`}>
          {step}
        </p>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
