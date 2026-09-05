import type { ReactNode } from "react";

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
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        {(title || badge) && (
          <h2 className="card-title">
            {badge && (
              <span className="badge badge-sm text-base-content border-primary">
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
