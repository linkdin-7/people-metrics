import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, RotateCcw, Search, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { FilterCombobox } from '@/components/filter-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmployeeSheet } from '@/features/employees/employee-form'
import { EmployeesTable } from '@/features/employees/employees-table'
import { api, type Employee } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

const FILTER_PARAMS = ['q', 'country', 'department', 'job_title', 'min_salary', 'max_salary']
const PAGE_SIZES = ['25', '50', '100']
const DEFAULT_PAGE_SIZE = 25
const SEARCH_DELAY_MS = 300

type SalaryRangeFilterProps = {
  min: string | null
  max: string | null
  onApply: (min: string | null, max: string | null) => void
}

function SalaryRangeFilter({ min, max, onApply }: SalaryRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [low, setLow] = useState('')
  const [high, setHigh] = useState('')
  const invalid = low !== '' && high !== '' && Number(low) > Number(high)
  const active = Boolean(min || max)

  function openChange(next: boolean) {
    setOpen(next)
    if (next) {
      setLow(min ?? '')
      setHigh(max ?? '')
    }
  }

  function apply(nextMin: string | null, nextMax: string | null) {
    onApply(nextMin, nextMax)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 gap-2 rounded-full bg-background/60 font-normal',
            active && 'border-primary/40 bg-primary/8 font-medium text-primary hover:text-primary',
          )}
        >
          <Wallet className="size-3.5 opacity-70" />
          {active
            ? `Salary ${min ? formatCount(Number(min)) : 'any'} – ${max ? formatCount(Number(max)) : 'any'}`
            : 'Salary range'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <p className="text-sm font-medium">Salary range</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Compared in each employee's own currency.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Min"
            aria-label="Minimum salary"
            value={low}
            onChange={(event) => setLow(event.target.value)}
          />
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Max"
            aria-label="Maximum salary"
            value={high}
            onChange={(event) => setHigh(event.target.value)}
          />
        </div>
        {invalid && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            The minimum is above the maximum.
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => apply(null, null)}>
            Clear
          </Button>
          <Button size="sm" disabled={invalid} onClick={() => apply(low || null, high || null)}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function EmployeesPage() {
  const [params, setParams] = useSearchParams()
  const employees = useQuery({
    queryKey: ['employees', params.toString()],
    queryFn: () => api.listEmployees(params),
    placeholderData: keepPreviousData,
  })
  const lookups = useQuery({ queryKey: ['lookups'], queryFn: api.getLookups, staleTime: 300000 })

  const updateParams = useCallback(
    (changes: Record<string, string | null>, replace = false) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value) {
              next.set(key, value)
            } else {
              next.delete(key)
            }
          }
          if (!('page' in changes)) {
            next.delete('page')
          }
          return next
        },
        { replace },
      )
    },
    [setParams],
  )

  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const urlSearch = params.get('q') ?? ''
  const [search, setSearch] = useState(urlSearch)

  useEffect(() => {
    if (search.trim() === urlSearch) {
      return
    }
    const timer = setTimeout(() => updateParams({ q: search.trim() || null }, true), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, urlSearch, updateParams])

  const countryNames = useMemo(
    () => new Map((lookups.data?.countries ?? []).map((country) => [country.code, country.name])),
    [lookups.data],
  )
  const countriesInUse = new Set(lookups.data?.countries_in_use)
  const countryOptions = (lookups.data?.countries ?? [])
    .filter((country) => countriesInUse.has(country.code))
    .map((country) => ({ value: country.code, label: country.name, hint: country.code, keywords: [country.code] }))
  const departmentOptions = (lookups.data?.departments ?? []).map((department) => ({
    value: String(department.id),
    label: department.name,
  }))
  const jobTitleOptions = (lookups.data?.job_titles ?? []).map((title) => ({ value: title, label: title }))

  const hasFilters = FILTER_PARAMS.some((key) => params.has(key))
  const page = Number(params.get('page') ?? 1)
  const pageSize = Number(params.get('page_size') ?? DEFAULT_PAGE_SIZE)
  const count = employees.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(count / pageSize))
  const firstShown = count === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = Math.min(page * pageSize, count)

  function clearFilters() {
    setSearch('')
    updateParams(Object.fromEntries(FILTER_PARAMS.map((key) => [key, null])))
  }

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Employees</h1>
          <p className="mt-1.5 text-muted-foreground">
            {employees.data
              ? `${formatCount(count)} ${count === 1 ? 'person' : 'people'} ${hasFilters ? 'match your filters' : 'on the payroll'}`
              : 'Loading the payroll…'}
          </p>
        </div>
        <Button onClick={() => setEditing('new')} className="rounded-full shadow-sm shadow-primary/20">
          <Plus />
          Add employee
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 sm:max-w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search employees"
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 rounded-full bg-background/60 pl-9"
          />
        </div>
        <FilterCombobox
          label="Country"
          value={params.get('country')}
          options={countryOptions}
          onChange={(value) => updateParams({ country: value })}
        />
        <FilterCombobox
          label="Department"
          value={params.get('department')}
          options={departmentOptions}
          onChange={(value) => updateParams({ department: value })}
        />
        <FilterCombobox
          label="Job title"
          value={params.get('job_title')}
          options={jobTitleOptions}
          onChange={(value) => updateParams({ job_title: value })}
        />
        <SalaryRangeFilter
          min={params.get('min_salary')}
          max={params.get('max_salary')}
          onApply={(min, max) => updateParams({ min_salary: min, max_salary: max })}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Reset all filters"
            onClick={clearFilters}
            className="h-9 gap-1.5 rounded-full text-muted-foreground animate-in fade-in-0 zoom-in-95"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-xs backdrop-blur">
        {employees.isFetching && employees.data && <div className="loading-bar" aria-hidden="true" />}
        {employees.isError ? (
          <div className="grid place-items-center gap-3 px-6 py-20 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <p className="font-medium">Couldn't load employees</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Check that the API is running, then try again.
            </p>
            <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={() => employees.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              'overflow-x-auto transition-opacity duration-200',
              employees.isPlaceholderData && 'opacity-60',
            )}
          >
            <EmployeesTable
              employees={employees.data?.results}
              countryNames={countryNames}
              sort={params.get('sort')}
              onSort={(sort) => updateParams({ sort })}
              onEdit={setEditing}
              hasFilters={hasFilters}
              onClearFilters={clearFilters}
            />
          </div>
        )}
      </div>

      {employees.data && count > 0 && (
        <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p className="tabular-nums">
            Showing {formatCount(firstShown)}–{formatCount(lastShown)} of {formatCount(count)}
          </p>
          <div className="flex items-center gap-3">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => updateParams({ page_size: value === String(DEFAULT_PAGE_SIZE) ? null : value })}
            >
              <SelectTrigger size="sm" aria-label="Rows per page" className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="tabular-nums">
              Page {formatCount(page)} of {formatCount(pageCount)}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => updateParams({ page: page - 1 > 1 ? String(page - 1) : null })}
                className="rounded-full"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => updateParams({ page: String(page + 1) })}
                className="rounded-full"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </footer>
      )}

      <EmployeeSheet
        open={editing !== null}
        employee={editing === 'new' ? undefined : (editing ?? undefined)}
        lookups={lookups.data}
        onClose={() => setEditing(null)}
      />
    </section>
  )
}
