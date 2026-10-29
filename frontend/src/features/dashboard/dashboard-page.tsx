import { useQueries } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Users } from 'lucide-react'
import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { RankedBarChart, type BarDatum } from '@/components/bar-chart'
import { SearchSelect } from '@/components/search-select'
import { StatTile } from '@/components/stat-tile'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type SalaryStats } from '@/lib/api'
import { currencyName, formatCount, formatMoney } from '@/lib/format'

const COUNT_UP_SECONDS = 0.9

// Headcounts are plain counts, so adding them across currencies is safe; salaries never are.
function headcountByGroup(rows: SalaryStats[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const group = row.group ?? ''
    totals.set(group, (totals.get(group) ?? 0) + row.headcount)
  }
  return totals
}

function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion()
  const [counted, setCounted] = useState(0)

  useEffect(() => {
    if (reduceMotion) {
      return
    }
    const controls = animate(0, value, {
      duration: COUNT_UP_SECONDS,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setCounted(Math.round(latest)),
    })
    // Browsers pause animation frames in background tabs; this timer still lands on the true number.
    const settle = setTimeout(() => setCounted(value), (COUNT_UP_SECONDS + 0.2) * 1000)
    return () => {
      controls.stop()
      clearTimeout(settle)
    }
  }, [value, reduceMotion])

  return (
    <>
      <span className="sr-only">{formatCount(value)}</span>
      <span aria-hidden="true">{formatCount(reduceMotion ? value : counted)}</span>
    </>
  )
}

function PayRange({ stats }: { stats: SalaryStats }) {
  const span = stats.max_salary - stats.min_salary
  const medianPosition = span === 0 ? 0.5 : (stats.median_salary - stats.min_salary) / span

  return (
    <div className="mt-6">
      <div className="relative h-2 rounded-full bg-linear-to-r from-muted via-primary/25 to-muted">
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-highlight ring-2 ring-card"
          style={{ left: `${medianPosition * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>Lowest {formatMoney(stats.min_salary, stats.currency)}</span>
        <span>Highest {formatMoney(stats.max_salary, stats.currency)}</span>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        The marker shows the median, {formatMoney(stats.median_salary, stats.currency)}
      </p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const [summary, byCountry, byDepartment, lookups] = useQueries({
    queries: [
      { queryKey: ['insights', 'summary'], queryFn: () => api.getSalarySummary(new URLSearchParams()) },
      { queryKey: ['insights', 'by-country'], queryFn: () => api.getBreakdown('by-country') },
      { queryKey: ['insights', 'by-department'], queryFn: () => api.getBreakdown('by-department') },
      { queryKey: ['lookups'], queryFn: api.getLookups, staleTime: 300000 },
    ],
  })
  const queries = [summary, byCountry, byDepartment]

  const countryNames = useMemo(
    () => new Map((lookups.data?.countries ?? []).map((country) => [country.code, country.name])),
    [lookups.data],
  )
  const countryData: BarDatum[] = [...headcountByGroup(byCountry.data ?? [])].map(([code, value]) => ({
    key: code,
    label: countryNames.get(code) ?? code,
    value,
  }))
  const departmentData: BarDatum[] = [...headcountByGroup(byDepartment.data ?? [])].map(([name, value]) => ({
    key: name,
    label: name,
    value,
  }))

  const currencyRows = [...(summary.data?.salary_by_currency ?? [])].sort(
    (a, b) => b.headcount - a.headcount || a.currency.localeCompare(b.currency),
  )
  const selected = currencyRows.find((row) => row.currency === params.get('currency')) ?? currencyRows[0]
  const headcount = summary.data?.headcount ?? 0

  let content
  if (queries.some((query) => query.isError)) {
    content = (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-6 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <p className="font-medium">Couldn't load the dashboard</p>
        <p className="max-w-sm text-sm text-muted-foreground">Check that the API is running, then try again.</p>
        <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={() => queries.forEach((query) => query.refetch())}>
          Try again
        </Button>
      </div>
    )
  } else if (queries.some((query) => query.isPending)) {
    content = <DashboardSkeleton />
  } else if (headcount === 0) {
    content = (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-6 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Users className="size-5" />
        </span>
        <p className="font-medium">No employees yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">Add your first employee and the dashboard fills in.</p>
        <Button asChild variant="outline" size="sm" className="mt-2 rounded-full">
          <Link to="/employees">Go to Employees</Link>
        </Button>
      </div>
    )
  } else {
    content = (
      <div className="grid gap-6">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <section
            aria-label="Total employees"
            className="rounded-xl border border-primary/20 bg-linear-to-br from-primary/10 via-card/60 to-card/60 p-5"
          >
            <p className="text-xs font-medium text-muted-foreground">Total employees</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight">
              <CountUp value={headcount} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">on the payroll right now</p>
          </section>
          <StatTile label="Countries" value={formatCount(countryData.length)} detail="where ACME employs people" />
          <StatTile label="Departments" value={formatCount(departmentData.length)} detail="across the organisation" />
          <StatTile label="Currencies" value={formatCount(currencyRows.length)} detail="salaries are paid in" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RankedBarChart
            title="Employees by country"
            subtitle="Where people work"
            data={countryData}
            total={headcount}
            noun="countries"
          />
          <RankedBarChart
            title="Employees by department"
            subtitle="How the organisation is split"
            data={departmentData}
            total={headcount}
            noun="departments"
          />
        </div>

        {selected && (
          <section
            aria-label={`Pay in ${selected.currency}`}
            className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-xs backdrop-blur"
          >
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold tracking-tight">Pay in {selected.currency}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatCount(selected.headcount)} {selected.headcount === 1 ? 'person is' : 'people are'} paid in{' '}
                  {currencyName(selected.currency)}
                </p>
              </div>
              <div className="w-64">
                <SearchSelect
                  id="dashboard-currency"
                  label="Currency"
                  placeholder="Choose a currency"
                  value={selected.currency}
                  options={currencyRows.map((row) => ({
                    value: row.currency,
                    label: `${row.currency} · ${currencyName(row.currency)}`,
                    hint: formatCount(row.headcount),
                    keywords: [row.currency],
                  }))}
                  onChange={(currency) => setParams({ currency }, { replace: true })}
                />
              </div>
            </header>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Lowest" value={formatMoney(selected.min_salary, selected.currency)} />
              <StatTile label="Median" value={formatMoney(selected.median_salary, selected.currency)} />
              <StatTile label="Average" value={formatMoney(selected.average_salary, selected.currency)} />
              <StatTile label="Highest" value={formatMoney(selected.max_salary, selected.currency)} />
            </div>
            <PayRange stats={selected} />

            <Button asChild variant="ghost" size="sm" className="mt-4 -ml-2 text-primary hover:text-primary">
              <Link to="/insights">
                See the full breakdown <ArrowRight />
              </Link>
            </Button>
          </section>
        )}
      </div>
    )
  }

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Dashboard</h1>
        <p className="mt-1.5 text-muted-foreground">A quick read on headcount and pay across ACME.</p>
      </header>
      {content}
    </section>
  )
}
