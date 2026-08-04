import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-panel/80 backdrop-blur-sm ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">
        {children}
      </h2>
      {right ? <div className="text-xs text-ink-3">{right}</div> : null}
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </header>
  );
}

/**
 * Photo de profil, avec repli sur l'emoji quand il n'y en a pas.
 *
 * `<img>` brut et non `next/image` : la source est un data URI déjà
 * redimensionné, il n'y a donc rien à optimiser ni à servir depuis un CDN.
 */
export function Avatar({
  photo,
  emoji,
  size = 36,
  className = "",
}: {
  photo: string | null;
  emoji: string;
  size?: number;
  className?: string;
}) {
  const base = `shrink-0 overflow-hidden rounded-full ring-2 ring-violet/40 ${className}`;

  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        width={size}
        height={size}
        className={`${base} object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${base} grid place-items-center bg-panel-3`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {emoji}
    </span>
  );
}

/** Pastille de catégorie : point coloré + libellé en encre neutre. */
export function CategoryChip({
  color,
  label,
  icon,
}: {
  color: string;
  label: string;
  icon?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-ink-2">
      {icon ? (
        <span aria-hidden>{icon}</span>
      ) : (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  color = "var(--color-violet)",
  height = 8,
  shimmer = false,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
  shimmer?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-panel-3"
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={`relative h-full rounded-full transition-[width] duration-500 ${
          shimmer ? "xp-shimmer overflow-hidden" : ""
        }`}
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 60%, white))`,
        }}
      />
    </div>
  );
}

export function Stat({
  icon,
  value,
  label,
  accent = "var(--color-violet-bright)",
  hint,
}: {
  icon: string;
  value: ReactNode;
  label: string;
  accent?: string;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-6 size-24 rounded-full blur-2xl"
        style={{ background: `color-mix(in oklab, ${accent} 26%, transparent)` }}
      />
      <div className="relative">
        <div className="text-xl" aria-hidden>
          {icon}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-ink-2">{label}</div>
        {hint ? <div className="mt-1 text-[11px] text-ink-3">{hint}</div> : null}
      </div>
    </Card>
  );
}
