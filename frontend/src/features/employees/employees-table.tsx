import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from 'lucide-react'
import type { CSSProperties } from 'react'

import { Badge } from '@/components/ui/badge'
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
import type { Employee } from '@/lib/api'
import { formatDate, formatMoney, hueFor, initials } from '@/lib/format'
import { cn } from '@/lib/utils'

const DEFAULT_SORT = 'last_name'

type SortableHeadProps = {
  label: string
  field: string
  sort: string
  onSort: (sort: string) => void
  className?: string
}

function SortableHead({ label, field, sort, onSort, className }: SortableHeadProps) {
  const direction = sort === field ? 'ascending' : sort === `-${field}` ? 'descending' : 'none'
  const Icon = direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ArrowUpDown

  return (
    <TableHead aria-sort={direction} className={className}>
      <button
        type="button"
        onClick={() => onSort(sort === field ? `-${field}` : field)}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-md py-1 font-medium transition-colors hover:text-foreground',
          direction !== 'none' && 'text-foreground',
        )}
      >
        {label}
        <Icon
          className={cn(
            'size-3.5 transition-opacity',
            direction === 'none' ? 'opacity-0 group-hover:opacity-60' : 'text-primary',
          )}
        />
      </button>
    </TableHead>
  )
}

type EmployeesTableProps = {
  employees: Employee[] | undefined
  countryNames: Map<string, string>
  sort: string | null
  onSort: (sort: string) => void
  hasFilters: boolean
  onClearFilters: () => void
}

export function EmployeesTable({
  employees,
  countryNames,
  sort,
  onSort,
  hasFilters,
  onClearFilters,
}: EmployeesTableProps) {
  const activeSort = sort ?? DEFAULT_SORT
  const headProps = { sort: activeSort, onSort }

  if (employees && employees.length === 0) {
    return (
      <div className="grid place-items-center gap-3 px-6 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </span>
        <p className="font-medium">
          {hasFilters ? 'No employees match these filters' : 'No employees yet'}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? 'Try a broader search, or clear the filters to see everyone.'
            : 'Add the first employee, or run the seed command to load demo data.'}
        </p>
        {hasFilters && (
          <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortableHead label="Name" field="last_name" className="pl-5" {...headProps} />
          <SortableHead label="Job title" field="job_title" {...headProps} />
          <TableHead>Department</TableHead>
          <SortableHead label="Country" field="country" {...headProps} />
          <SortableHead label="Salary" field="annual_salary" className="text-right [&>button]:ml-auto" {...headProps} />
          <SortableHead label="Hired" field="hire_date" className="pr-5" {...headProps} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees
          ? employees.map((employee, index) => (
              <TableRow
                key={employee.id}
                className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none"
                style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}
              >
                <TableCell className="pl-5">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="avatar-tint grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold"
                      style={{ '--avatar-hue': hueFor(employee.email) } as CSSProperties}
                    >
                      {initials(employee.first_name, employee.last_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {employee.first_name} {employee.last_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{employee.job_title}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="rounded-full font-normal">
                    {employee.department_name}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span>{countryNames.get(employee.country) ?? employee.country}</span>
                    <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                      {employee.country}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(employee.annual_salary, employee.currency)}
                </TableCell>
                <TableCell className="pr-5 text-muted-foreground tabular-nums">
                  {formatDate(employee.hire_date)}
                </TableCell>
              </TableRow>
            ))
          : Array.from({ length: 8 }, (_, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                <TableCell className="pl-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="grid gap-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                </TableCell>
                {[28, 20, 20, 16, 16].map((width, cell) => (
                  <TableCell key={cell}>
                    <Skeleton className="h-3.5" style={{ width: `${width * 4}px` }} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
