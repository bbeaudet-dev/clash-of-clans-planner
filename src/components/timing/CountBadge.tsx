import type { ReactNode } from "react";

export function CountBadge({
  count,
  icon,
  className,
  title,
}: {
  count: number;
  icon: ReactNode;
  className: string;
  title: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[11px] ${className}`}
      title={title}
    >
      {count}
      {icon}
    </span>
  );
}
