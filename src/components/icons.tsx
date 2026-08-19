import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function SkipIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.5 13.5h4.25c3.25 0 5.25-1.75 5.25-5.25V5" />
      <path d="M10.25 7.75 13 5l2.75 2.75" />
      <path d="M3.5 6.5h2.75c1.5 0 2.75.5 3.5 1.5" />
    </svg>
  );
}

export function UpgradeIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 16V4" />
      <path d="M5.5 8.5 10 4l4.5 4.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}
