import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SalaryStats } from '@/lib/api'
import { formatCount, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

type SortField = 'group' | 'headcount' | 'min_salary' | 'median_salary' | 'average_salary' | 'max_salary'
type Sort = { field: SortField; direction: 'ascending' | 'descending' }

const COLUMNS: { field: SortField; label: string }[] = [
  { field: 'headcount', label: 'Employees' },
  { field: 'min_salary', label: 'Lowest' },
  { field: 'median_salary', label: 'Median' },
  { field: 'average_salary', label: 'Average' },
  { field: 'max_salary', label: 'Highest' },
]

function sortRows(rows: SalaryStats[], sort: Sort, labelOf: (group: string) => string): SalaryStats[] {
  const direction = sort.direction === 'ascending' ? 1 : -1
  return [...rows].sort((a, b) => {
    const difference =
      sort.field === 'group'
        ? labelOf(a.group ?? '').localeCompare(labelOf(b.group ?? ''))
        : a[sort.field] - b[sort.field]
    return difference * direction || labelOf(a.group ?? '').localeCompare(labelOf(b.group ?? ''))
  })
}

type SortHeadProps = { label: string; field: SortField; sort: Sort; onSort: (field: SortField) => void; align?: 'right' }

function SortHead({ label, field, sort, onSort, align }: SortHeadProps) {
  const active = sort.field === field
  const Icon = !active ? ArrowUpDown : sort.direction === 'ascending' ? ArrowUp : ArrowDown
  return (
    <TableHead aria-sort={active ? sort.direction : 'none'} className={cn(align === 'right' && 'text-right')}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-md py-1 font-medium transition-colors hover:text-foreground',
          active && 'text-foreground',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {label}
        <Icon
          aria-hidden="true"
          className={cn('size-3.5 transition-opacity', active ? 'text-primary' : 'opacity-0 group-hover:opacity-60')}
        />
      </button>
    </TableHead>
  )
}

type BreakdownTableProps = { rows: SalaryStats[]; groupLabel: string; labelOf: (group: string) => string }

// Rows share one scale, so the spread bars are comparable: lowest to highest, with a tick at the median.
export function BreakdownTable({ rows, groupLabel, labelOf }: BreakdownTableProps) {
  const [sort, setSort] = useState<Sort>({ field: 'median_salary', direction: 'descending' })
  const currency = rows[0]?.currency ?? ''
  const scaleMin = Math.min(...rows.map((row) => row.min_salary))
  const scaleSpan = Math.max(1, Math.max(...rows.map((row) => row.max_salary)) - scaleMin)
  const position = (amount: number) => ((amount - scaleMin) / scaleSpan) * 100

  function changeSort(field: SortField) {
    setSort((current) =>
      current.field === field
        ? { field, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { field, direction: field === 'group' ? 'ascending' : 'descending' },
    )
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortHead label={groupLabel} field="group" sort={sort} onSort={changeSort} />
            {COLUMNS.map((column) => (
              <SortHead key={column.field} {...column} sort={sort} onSort={changeSort} align="right" />
            ))}
            <TableHead className="hidden w-48 lg:table-cell">Pay spread</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortRows(rows, sort, labelOf).map((row) => (
            <TableRow key={row.group}>
              <TableCell className="font-medium">{labelOf(row.group ?? '')}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCount(row.headcount)}</TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {formatMoney(row.min_salary, currency)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(row.median_salary, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(row.average_salary, currency)}</TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {formatMoney(row.max_salary, currency)}
              </TableCell>
              <TableCell aria-hidden="true" className="hidden lg:table-cell">
                <div className="relative h-5">
                  <span className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-border" />
                  <span
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-chart-1/70"
                    style={{ left: `${position(row.min_salary)}%`, width: `${Math.max(1, position(row.max_salary) - position(row.min_salary))}%` }}
                  />
                  <span
                    className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-highlight ring-2 ring-card"
                    style={{ left: `${position(row.median_salary)}%` }}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
