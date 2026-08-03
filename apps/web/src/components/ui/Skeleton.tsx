export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`motion-safe:animate-pulse rounded-md bg-slate-800 ${className ?? ""}`}
      aria-hidden="true"
      {...props}
    />
  );
}
