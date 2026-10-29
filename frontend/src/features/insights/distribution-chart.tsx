import { motion } from 'motion/react'

import { ChartCard } from '@/components/chart-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Distribution } from '@/lib/api'
import { formatCompactMoney, formatCount, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const SHARE_FORMAT = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })

type DistributionChartProps = {
  currency: string
  distribution: Distribution | undefined
  isError: boolean
  onRetry: () => void
  median: number
  total: number
}

// Columns of equal-width pay ranges; the column holding the median is the one highlighted.
export function DistributionChart({ currency, distribution, isError, onRetry, median, total }: DistributionChartProps) {
  const buckets = distribution?.buckets ?? []
  const tallest = Math.max(1, ...buckets.map((bucket) => bucket.headcount))
  const rangeLabel = (min: number, max: number) => `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
  const people = (count: number) => `${formatCount(count)} ${count === 1 ? 'employee' : 'employees'}`

  return (
    <ChartCard title="Salary distribution" subtitle={`How many people fall in each pay range, in ${currency}`}>
      {(view) =>
        !distribution ? (
          isError ? (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              Couldn't load the distribution.
              <Button variant="outline" size="sm" className="ml-auto rounded-full" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : (
            <Skeleton className="mt-6 h-60 rounded-xl" />
          )
        ) : view === 'table' ? (
          <Table className="mt-3">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Pay range</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((bucket) => (
                <TableRow key={bucket.min_salary}>
                  <TableCell>{rangeLabel(bucket.min_salary, bucket.max_salary)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(bucket.headcount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {SHARE_FORMAT.format(total ? bucket.headcount / total : 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <>
            <ul className="mt-6 flex h-60 items-stretch gap-1.5 sm:gap-2">
              {buckets.map((bucket) => {
                const holdsMedian = median >= bucket.min_salary && median <= bucket.max_salary
                return (
                  <li
                    key={bucket.min_salary}
                    tabIndex={0}
                    data-median={holdsMedian}
                    aria-label={`${rangeLabel(bucket.min_salary, bucket.max_salary)}: ${people(bucket.headcount)}`}
                    className="group flex min-w-0 flex-1 flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex min-h-0 flex-1 flex-col items-center justify-end gap-1 rounded-md px-0.5 transition-colors group-hover:bg-muted/60">
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {formatCount(bucket.headcount)}
                          </span>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${(bucket.headcount / tallest) * 82}%` }}
                            transition={{ type: 'spring', stiffness: 110, damping: 20 }}
                            className={cn(
                              'w-full max-w-6 rounded-t-[4px]',
                              holdsMedian ? 'bg-highlight' : 'bg-chart-1',
                            )}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {rangeLabel(bucket.min_salary, bucket.max_salary)} · {people(bucket.headcount)}
                        {holdsMedian && ' · holds the median'}
                      </TooltipContent>
                    </Tooltip>
                    <span className="mt-1.5 block truncate text-center text-[10px] text-muted-foreground tabular-nums">
                      {formatCompactMoney(bucket.min_salary, currency)}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              The gold column holds the median, {formatMoney(median, currency)}. Each column is a pay range of about{' '}
              {formatMoney(distribution.bucket_width, currency)}.
            </p>
          </>
        )
      }
    </ChartCard>
  )
}
