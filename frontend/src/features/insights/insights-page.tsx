import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, RotateCcw, SearchX } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'

import { FilterCombobox } from '@/components/filter-combobox'
import { SearchSelect } from '@/components/search-select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BreakdownTable } from '@/features/insights/breakdown-table'
import { DistributionChart } from '@/features/insights/distribution-chart'
import { api, type BreakdownKind, type Employee } from '@/lib/api'
import { currencyName, formatCount, formatMoney, hueFor, initials } from '@/lib/format'

const BUCKET_COUNT = 10
const EARNERS_SHOWN = 5

const TABS: { value: string; kind: BreakdownKind; label: string; groupLabel: string }[] = [
  { value: 'country', kind: 'by-country', label: 'By country', groupLabel: 'Country' },
  { value: 'department', kind: 'by-department', label: 'By department', groupLabel: 'Department' },
  { value: 'job-title', kind: 'by-job-title', label: 'By job title', groupLabel: 'Job title' },
]

function SectionMessage({ children, onRetry }: { children: string; onRetry?: () => void }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
      {children}
      {onRetry && (
        <Button variant="outline" size="sm" className="ml-auto rounded-full" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

function EarnersCard({ title, employees, currency }: { title: string; employees: Employee[] | undefined; currency: string }) {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-xs backdrop-blur"
    >
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">In {currencyName(currency)}</p>
      <ol className="mt-4 grid gap-1">
        {employees
          ? employees.map((employee, index) => (
              <li key={employee.id}>
                <Link
                  to={`/employees?${new URLSearchParams({ q: employee.email })}`}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="w-4 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                  <span
                    aria-hidden="true"
                    className="avatar-tint grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold"
                    style={{ '--avatar-hue': hueFor(employee.email) } as CSSProperties}
                  >
                    {initials(employee.first_name, employee.last_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium group-hover:text-primary">
                      {employee.first_name} {employee.last_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {employee.job_title} · {employee.department_name}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(employee.annual_salary, employee.currency)}</span>
                </Link>
              </li>
            ))
          : Array.from({ length: EARNERS_SHOWN }, (_, index) => (
              <li key={index} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </li>
            ))}
      </ol>
    </section>
  )
}

export function InsightsPage() {
  const [params, setParams] = useSearchParams()
  const country = params.get('country')
  const department = params.get('department')
  const tab = TABS.find((candidate) => candidate.value === params.get('tab')) ?? TABS[0]

  const filters = useMemo(() => {
    const next = new URLSearchParams()
    if (country) next.set('country', country)
    if (department) next.set('department', department)
    return next
  }, [country, department])

  function update(changes: Record<string, string | null>) {
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
        return next
      },
      { replace: true },
    )
  }

  const lookups = useQuery({ queryKey: ['lookups'], queryFn: api.getLookups, staleTime: 300000 })
  const summary = useQuery({
    queryKey: ['insights', 'summary', filters.toString()],
    queryFn: () => api.getSalarySummary(filters),
    placeholderData: keepPreviousData,
  })

  const currencyRows = [...(summary.data?.salary_by_currency ?? [])].sort(
    (a, b) => b.headcount - a.headcount || a.currency.localeCompare(b.currency),
  )
  const selected = currencyRows.find((row) => row.currency === params.get('currency')) ?? currencyRows[0]
  const scoped = new URLSearchParams(filters)
  scoped.set('currency', selected?.currency ?? '')
  const scopeKey = scoped.toString()
  const enabled = Boolean(selected)

  const distribution = useQuery({
    queryKey: ['insights', 'distribution', scopeKey],
    queryFn: () => api.getDistribution(new URLSearchParams({ ...Object.fromEntries(scoped), buckets: String(BUCKET_COUNT) })),
    enabled,
    placeholderData: keepPreviousData,
  })
  const breakdown = useQuery({
    queryKey: ['insights', tab.kind, scopeKey],
    queryFn: () => api.getBreakdown(tab.kind, scoped),
    enabled,
    placeholderData: keepPreviousData,
  })
  const earnersQuery = (order: 'highest' | 'lowest') => ({
    queryKey: ['insights', 'earners', order, scopeKey],
    queryFn: () =>
      api.getEarners(new URLSearchParams({ ...Object.fromEntries(scoped), order, limit: String(EARNERS_SHOWN) })),
    enabled,
    placeholderData: keepPreviousData,
  })
  const highest = useQuery(earnersQuery('highest'))
  const lowest = useQuery(earnersQuery('lowest'))

  const countryNames = useMemo(
    () => new Map((lookups.data?.countries ?? []).map((item) => [item.code, item.name])),
    [lookups.data],
  )
  const labelOf = (group: string) => (tab.value === 'country' ? (countryNames.get(group) ?? group) : group)

  const inUse = new Set(lookups.data?.countries_in_use)
  const countryOptions = (lookups.data?.countries ?? [])
    .filter((item) => inUse.has(item.code))
    .map((item) => ({ value: item.code, label: item.name, hint: item.code, keywords: [item.code] }))
  const departmentOptions = (lookups.data?.departments ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }))
  const hasFilters = Boolean(country || department)
  const clearFilters = () => update({ country: null, department: null })

  const retryAll = () => [summary, distribution, breakdown, highest, lowest].forEach((query) => query.refetch())

  let body
  if (summary.isError) {
    body = (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-6 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <p className="font-medium">Couldn't load the insights</p>
        <p className="max-w-sm text-sm text-muted-foreground">Check that the API is running, then try again.</p>
        <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={retryAll}>
          Try again
        </Button>
      </div>
    )
  } else if (summary.isPending) {
    body = (
      <div className="grid gap-6" aria-hidden="true">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  } else if (!selected) {
    body = (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-6 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </span>
        <p className="font-medium">No employees match these filters</p>
        <p className="max-w-sm text-sm text-muted-foreground">Try a different country or department.</p>
        <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
    )
  } else {
    body = (
      <div className="grid gap-6">
        <DistributionChart
          currency={selected.currency}
          distribution={distribution.data}
          isError={distribution.isError}
          onRetry={() => distribution.refetch()}
          median={selected.median_salary}
          total={selected.headcount}
        />

        <section
          aria-label="Pay breakdown"
          className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-xs backdrop-blur"
        >
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Pay breakdown</h2>
              <p className="text-sm text-muted-foreground">Compare pay across groups, in {selected.currency}</p>
            </div>
            <Tabs value={tab.value} onValueChange={(value) => update({ tab: value === TABS[0].value ? null : value })}>
              <TabsList>
                {TABS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </header>
          {breakdown.data ? (
            <div className={breakdown.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <BreakdownTable key={tab.value} rows={breakdown.data} groupLabel={tab.groupLabel} labelOf={labelOf} />
            </div>
          ) : breakdown.isError ? (
            <SectionMessage onRetry={() => breakdown.refetch()}>Couldn't load this breakdown.</SectionMessage>
          ) : (
            <Skeleton className="mt-4 h-48 rounded-xl" />
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <EarnersCard title="Highest paid" employees={highest.data} currency={selected.currency} />
          <EarnersCard title="Lowest paid" employees={lowest.data} currency={selected.currency} />
        </div>
      </div>
    )
  }

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Insights</h1>
        <p className="mt-1.5 text-muted-foreground">How ACME pays people, by country, department and role.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {selected && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Pay in</span>
            <div className="w-60">
              <SearchSelect
                id="insights-currency"
                label="Currency"
                placeholder="Choose a currency"
                value={selected.currency}
                options={currencyRows.map((row) => ({
                  value: row.currency,
                  label: `${row.currency} · ${currencyName(row.currency)}`,
                  hint: formatCount(row.headcount),
                  keywords: [row.currency],
                }))}
                onChange={(currency) => update({ currency })}
              />
            </div>
          </div>
        )}
        <FilterCombobox
          label="Country"
          value={country}
          options={countryOptions}
          onChange={(value) => update({ country: value })}
        />
        <FilterCombobox
          label="Department"
          value={department}
          options={departmentOptions}
          onChange={(value) => update({ department: value })}
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
      {selected && (
        <p className="-mt-3 text-sm text-muted-foreground">
          {`${formatCount(selected.headcount)} ${selected.headcount === 1 ? 'employee is' : 'employees are'} paid in ${currencyName(selected.currency)}`}
        </p>
      )}

      {body}
    </section>
  )
}
