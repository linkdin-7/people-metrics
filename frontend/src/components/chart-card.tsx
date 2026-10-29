import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type ChartView = 'chart' | 'table'

type ChartCardProps = {
  title: string
  subtitle: string
  children: (view: ChartView) => ReactNode
}

// A named card with a Chart / Table switch, so every chart has an accessible table twin.
export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  const [view, setView] = useState<ChartView>('chart')

  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-xs backdrop-blur"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div role="group" aria-label={`${title} view`} className="inline-flex rounded-full bg-muted p-0.5 text-xs">
          {(['chart', 'table'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={cn(
                'rounded-full px-3 py-1 font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === option && 'bg-background text-foreground shadow-xs',
              )}
            >
              {option === 'chart' ? 'Chart' : 'Table'}
            </button>
          ))}
        </div>
      </header>
      {children(view)}
    </section>
  )
}
