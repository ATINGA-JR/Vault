import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow, title, subtitle, action,
}: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && (
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div>
        )}
        <h1 className="mt-1 font-serif text-4xl tracking-tight md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function Section({ title, subtitle, action, children, className }: {
  title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn("mb-10", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            {title && <h2 className="font-serif text-2xl tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">{icon}</div>}
      <h3 className="font-serif text-xl">{title}</h3>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, onClick, accent }: {
  label: string; value: ReactNode; hint?: string; onClick?: () => void; accent?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-lg border border-border bg-card p-5 text-left transition-all",
        onClick && "hover:border-border-strong hover:shadow-sm",
        accent && "border-primary/30 bg-primary/[0.04]",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-serif text-3xl tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Tag>
  );
}
