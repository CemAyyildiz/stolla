"use client";

type SkipLinkProps = {
  targetId?: string;
  label?: string;
};

export function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (!target) return;

        event.preventDefault();
        target.focus();
        target.scrollIntoView({ block: "start" });
        window.history.replaceState(null, "", `#${targetId}`);
      }}
    >
      {label}
    </a>
  );
}
