import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import type { Lookups, SalaryStats } from '@/lib/api'

const LOOKUPS: Lookups = {
  countries: [
    { code: 'DE', name: 'Germany', currency: 'EUR' },
    { code: 'IN', name: 'India', currency: 'INR' },
    { code: 'US', name: 'United States', currency: 'USD' },
  ],
  currencies: ['EUR', 'INR', 'USD'],
  departments: [],
  job_titles: [],
  countries_in_use: ['DE', 'IN', 'US'],
}

function stats(overrides: Partial<SalaryStats> & Pick<SalaryStats, 'currency' | 'headcount'>): SalaryStats {
  return { min_salary: 1, median_salary: 1, average_salary: 1, max_salary: 1, ...overrides }
}

const SUMMARY = {
  headcount: 10,
  salary_by_currency: [
    stats({ currency: 'EUR', headcount: 2, min_salary: 50, median_salary: 55, average_salary: 56, max_salary: 62 }),
    stats({ currency: 'INR', headcount: 6, min_salary: 100, median_salary: 250, average_salary: 260.5, max_salary: 400 }),
    stats({ currency: 'USD', headcount: 2, min_salary: 70, median_salary: 75, average_salary: 76, max_salary: 80 }),
  ],
}

// Germany has one person paid in USD, so its headcount is split across two currency rows.
const BY_COUNTRY = [
  stats({ group: 'DE', currency: 'EUR', headcount: 2 }),
  stats({ group: 'DE', currency: 'USD', headcount: 1 }),
  stats({ group: 'IN', currency: 'INR', headcount: 6 }),
  stats({ group: 'US', currency: 'USD', headcount: 1 }),
]

const BY_DEPARTMENT = [
  stats({ group: 'Engineering', currency: 'EUR', headcount: 1 }),
  stats({ group: 'Engineering', currency: 'INR', headcount: 4 }),
  stats({ group: 'Engineering', currency: 'USD', headcount: 1 }),
  stats({ group: 'Sales', currency: 'EUR', headcount: 1 }),
  stats({ group: 'Sales', currency: 'INR', headcount: 2 }),
  stats({ group: 'Sales', currency: 'USD', headcount: 1 }),
]

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

type ApiOptions = { summary?: typeof SUMMARY; byCountry?: SalaryStats[]; byDepartment?: SalaryStats[]; fail?: boolean }

function mockApi({ summary = SUMMARY, byCountry = BY_COUNTRY, byDepartment = BY_DEPARTMENT, fail = false }: ApiOptions = {}) {
  const requests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'http://localhost')
      requests.push(url.pathname)
      if (fail && url.pathname.startsWith('/api/v1/insights')) {
        return new Response('{}', { status: 500 })
      }
      const bodies: Record<string, unknown> = {
        '/api/v1/lookups': LOOKUPS,
        '/api/v1/insights/summary': summary,
        '/api/v1/insights/by-country': byCountry,
        '/api/v1/insights/by-department': byDepartment,
      }
      return url.pathname in bodies ? json(bodies[url.pathname]) : new Response('{}', { status: 404 })
    }),
  )
  return { requests }
}

function renderPage(path = '/dashboard') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return user
}

describe('headcount', () => {
  test('leads with the total headcount and counts countries, departments and currencies', async () => {
    mockApi()
    renderPage()

    const total = await screen.findByRole('region', { name: 'Total employees' })
    expect(within(total).getByText('10')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Countries' })).getByText('3')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Departments' })).getByText('2')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Currencies' })).getByText('3')).toBeInTheDocument()
  })

  test('the country chart adds up people across currencies and ranks the largest first', async () => {
    mockApi()
    renderPage()

    const chart = within(await screen.findByRole('region', { name: 'Employees by country' }))
    const rows = chart.getAllByRole('listitem').map((row) => row.getAttribute('aria-label'))
    expect(rows).toEqual([
      'India: 6 employees, 60% of all',
      'Germany: 3 employees, 30% of all',
      'United States: 1 employee, 10% of all',
    ])
  })

  test('the department chart ranks departments by headcount', async () => {
    mockApi()
    renderPage()

    const chart = within(await screen.findByRole('region', { name: 'Employees by department' }))
    expect(chart.getAllByRole('listitem').map((row) => row.getAttribute('aria-label'))).toEqual([
      'Engineering: 6 employees, 60% of all',
      'Sales: 4 employees, 40% of all',
    ])
  })

  test('a long list shows the top ten and can be expanded', async () => {
    const manyCountries = Array.from({ length: 12 }, (_, index) =>
      stats({ group: `C${String(index).padStart(2, '0')}`, currency: 'USD', headcount: 12 - index }),
    )
    mockApi({ byCountry: manyCountries })
    const user = renderPage()

    const chart = within(await screen.findByRole('region', { name: 'Employees by country' }))
    expect(chart.getAllByRole('listitem')).toHaveLength(10)

    await user.click(chart.getByRole('button', { name: 'Show all 12 countries' }))

    expect(chart.getAllByRole('listitem')).toHaveLength(12)
    expect(chart.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument()
  })

  test('every chart has a table view with the same numbers', async () => {
    mockApi()
    const user = renderPage()
    const chart = within(await screen.findByRole('region', { name: 'Employees by country' }))

    await user.click(chart.getByRole('button', { name: 'Table' }))

    const table = chart.getByRole('table')
    expect(within(table).getByRole('row', { name: /Germany 3 30%/ })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /India 6 60%/ })).toBeInTheDocument()
    expect(chart.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('pay by currency', () => {
  test('starts with the currency most people are paid in', async () => {
    mockApi()
    renderPage()

    const pay = within(await screen.findByRole('region', { name: 'Pay in INR' }))
    expect(pay.getByText('₹100')).toBeInTheDocument()
    expect(pay.getByText('₹250')).toBeInTheDocument()
    expect(pay.getByText('₹261')).toBeInTheDocument()
    expect(pay.getByText('₹400')).toBeInTheDocument()
    expect(pay.getByText('6 people are paid in Indian Rupee')).toBeInTheDocument()
  })

  test('choosing another currency switches every figure and keeps currencies apart', async () => {
    mockApi()
    const user = renderPage()
    await screen.findByRole('region', { name: 'Pay in INR' })

    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(await screen.findByRole('option', { name: /EUR/ }))

    const pay = within(await screen.findByRole('region', { name: 'Pay in EUR' }))
    expect(pay.getByText('€50')).toBeInTheDocument()
    expect(pay.getByText('€55')).toBeInTheDocument()
    expect(pay.getByText('€56')).toBeInTheDocument()
    expect(pay.getByText('€62')).toBeInTheDocument()
    expect(pay.queryByText('₹250')).not.toBeInTheDocument()
  })

  test('the chosen currency comes from the URL, and an unknown one falls back', async () => {
    mockApi()
    renderPage('/dashboard?currency=USD')
    expect(await screen.findByRole('region', { name: 'Pay in USD' })).toBeInTheDocument()
  })

  test('an unknown currency in the URL falls back to the most common one', async () => {
    mockApi()
    renderPage('/dashboard?currency=ZZZ')
    expect(await screen.findByRole('region', { name: 'Pay in INR' })).toBeInTheDocument()
  })
})

describe('states', () => {
  test('a failed load explains it and can be retried', async () => {
    const api = mockApi({ fail: true })
    const user = renderPage()

    expect(await screen.findByText("Couldn't load the dashboard")).toBeInTheDocument()
    const requestsBefore = api.requests.length
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(api.requests.length).toBeGreaterThan(requestsBefore))
  })

  test('with no employees it points to the Employees page instead of showing empty charts', async () => {
    mockApi({
      summary: { headcount: 0, salary_by_currency: [] },
      byCountry: [],
      byDepartment: [],
    })
    renderPage()

    expect(await screen.findByText('No employees yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Employees' })).toHaveAttribute('href', '/employees')
    expect(screen.queryByRole('region', { name: 'Employees by country' })).not.toBeInTheDocument()
  })
})
