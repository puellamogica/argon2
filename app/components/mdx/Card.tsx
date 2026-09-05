import type { ReactNode } from "react";

const badgeVariants: Record<string, string> = {
  primary: "badge-primary",
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
  info: "badge-info",
  neutral: "badge-neutral",
};

export function Card({
  title,
  badge,
  children,
}: {
  title?: string;
  badge?: { label: string; variant?: string };
  children: ReactNode;
}) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        {(title || badge) && (
          <h2 className="card-title">
            {badge && (
              <span
                className={`badge badge-sm ${badgeVariants[badge.variant ?? "primary"] ?? "badge-primary"}`}
              >
                {badge.label}
              </span>
            )}
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
