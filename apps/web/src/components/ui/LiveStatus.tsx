import type { ReactNode } from "react";

type LiveStatusProps = {
  children: ReactNode;
  tone?: "routine" | "error";
  id?: string;
  className?: string;
};

/**
 * Keeps visual feedback and its live-region semantics in one stable node.
 * React leaves unchanged text alone on ordinary re-renders, so assistive
 * technology only receives meaningful message transitions.
 */
export function LiveStatus({
  children,
  tone = "routine",
  id,
  className,
}: LiveStatusProps) {
  const isError = tone === "error";

  return (
    <p
      id={id}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={className}
    >
      {children}
    </p>
  );
}
