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
      className={`inline-flex items-center font-mono text-xs ${className}`}
      title={title}
    >
      {count}
      {icon}
    </span>
  );
}
