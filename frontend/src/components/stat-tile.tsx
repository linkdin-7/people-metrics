import { cn } from '@/lib/utils'

type StatTileProps = { label: string; value: string; detail?: string; className?: string }

// Stat tile: a label, one proportional-figure value and an optional note. A region, so it can be named.
export function StatTile({ label, value, detail, className }: StatTileProps) {
  return (
    <section
      aria-label={label}
      className={cn('rounded-xl border border-border/70 bg-card/60 p-4', className)}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
    </section>
  )
}
