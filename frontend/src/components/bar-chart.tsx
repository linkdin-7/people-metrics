import { motion } from 'motion/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

export type BarDatum = { key: string; label: string; value: number }

const SHARE_FORMAT = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })
const DEFAULT_LIMIT = 10

type RankedBarChartProps = {
  title: string
  subtitle: string
  data: BarDatum[]
  total: number
  noun: string
  limit?: number
}

function countLabel(value: number): string {
  return `${formatCount(value)} ${value === 1 ? 'employee' : 'employees'}`
}

// Horizontal bars ranked largest first: one colour, thin, rounded only at the data end, value at the tip.
export function RankedBarChart({ title, subtitle, data, total, noun, limit = DEFAULT_LIMIT }: RankedBarChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [expanded, setExpanded] = useState(false)
  const ranked = [...data].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  const shown = expanded || view === 'table' ? ranked : ranked.slice(0, limit)
  const largest = ranked[0]?.value ?? 1
  const shareOf = (value: number) => SHARE_FORMAT.format(total ? value / total : 0)

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

      {view === 'chart' ? (
        <ul className="mt-4 grid gap-0.5">
          {shown.map((datum) => (
            <li
              key={datum.key}
              tabIndex={0}
              aria-label={`${datum.label}: ${countLabel(datum.value)}, ${shareOf(datum.value)} of all`}
              className="group rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3 rounded-md px-2 py-1 transition-colors group-hover:bg-muted/60 sm:grid-cols-[9rem_1fr]">
                    <span className="truncate text-sm">{datum.label}</span>
                    <div className="flex items-center gap-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(2, (datum.value / largest) * 80)}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                        className="h-5 shrink-0 rounded-r-[4px] bg-chart-1"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">{formatCount(datum.value)}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {datum.label} · {countLabel(datum.value)} · {shareOf(datum.value)}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      ) : (
        <Table className="mt-3">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{noun.charAt(0).toUpperCase() + noun.slice(1)}</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map((datum) => (
              <TableRow key={datum.key}>
                <TableCell>{datum.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(datum.value)}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {shareOf(datum.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {view === 'chart' && ranked.length > limit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 -ml-2 text-muted-foreground"
        >
          {expanded ? 'Show fewer' : `Show all ${ranked.length} ${noun}`}
        </Button>
      )}
    </section>
  )
}
