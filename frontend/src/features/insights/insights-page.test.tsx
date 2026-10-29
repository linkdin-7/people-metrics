import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { InsightsPage } from '@/features/insights/insights-page'
import type { Employee, Lookups, SalaryStats } from '@/lib/api'

const LOOKUPS: Lookups = {
  countries: [
    { code: 'DE', name: 'Germany', currency: 'EUR' },
    { code: 'IN', name: 'India', currency: 'INR' },
  ],
  currencies: ['EUR', 'INR'],
  departments: [
    { id: 1, name: 'Engineering' },
    { id: 2, name: 'Sales' },
  ],
  job_titles: [],
  countries_in_use: ['DE', 'IN'],
}

function row(overrides: Partial<SalaryStats> & Pick<SalaryStats, 'currency' | 'headcount'>): SalaryStats {
  return { min_salary: 100, median_salary: 200, average_salary: 210, max_salary: 400, ...overrides }
}

const SUMMARY_ALL = {
  headcount: 8,
  salary_by_currency: [
    row({ currency: 'EUR', headcount: 2, min_salary: 50, median_salary: 55, average_salary: 56, max_salary: 62 }),
    row({ currency: 'INR', headcount: 6, min_salary: 100, median_salary: 250, average_salary: 260.5, max_salary: 400 }),
  ],
}

const DISTRIBUTIONS: Record<string, { bucket_width: number; buckets: { min_salary: number; max_salary: number; headcount: number }[] }> = {
  INR: {
    bucket_width: 101,
    buckets: [
      { min_salary: 100, max_salary: 200, headcount: 2 },
      { min_salary: 201, max_salary: 301, headcount: 3 },
      { min_salary: 302, max_salary: 400, headcount: 1 },
    ],
  },
  EUR: {
    bucket_width: 7,
    buckets: [
      { min_salary: 50, max_salary: 56, headcount: 1 },
      { min_salary: 57, max_salary: 62, headcount: 1 },
    ],
  },
}

const BREAKDOWNS: Record<string, SalaryStats[]> = {
  'by-country': [
    row({ group: 'IN', currency: 'INR', headcount: 6, min_salary: 100, median_salary: 250, average_salary: 260.5, max_salary: 400 }),
    row({ group: 'DE', currency: 'EUR', headcount: 2, min_salary: 50, median_salary: 55, average_salary: 56, max_salary: 62 }),
  ],
  'by-department': [
    row({ group: 'Engineering', currency: 'INR', headcount: 4, min_salary: 100, median_salary: 180, average_salary: 190, max_salary: 300 }),
    row({ group: 'Sales', currency: 'INR', headcount: 2, min_salary: 300, median_salary: 350, average_salary: 350, max_salary: 400 }),
  ],
  'by-job-title': [
    row({ group: 'Software Engineer', currency: 'INR', headcount: 3, min_salary: 100, median_salary: 200, average_salary: 200, max_salary: 300 }),
    row({ group: 'Sales Executive', currency: 'INR', headcount: 2, min_salary: 300, median_salary: 350, average_salary: 350, max_salary: 400 }),
    row({ group: 'Accountant', currency: 'INR', headcount: 1, min_salary: 120, median_salary: 120, average_salary: 120, max_salary: 120 }),
  ],
}

function person(id: number, first: string, last: string, salary: number, title = 'Sales Executive'): Employee {
  return {
    id,
    first_name: first,
    last_name: last,
    email: `${first}@example.com`.toLowerCase(),
    department: 2,
    department_name: 'Sales',
    job_title: title,
    country: 'IN',
    currency: 'INR',
    annual_salary: salary,
    hire_date: '2022-04-01',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  }
}

const EARNERS = {
  highest: [person(1, 'Asha', 'Rao', 400), person(2, 'Ravi', 'Patel', 380)],
  lowest: [person(3, 'Meera', 'Iyer', 100), person(4, 'Kabir', 'Shah', 110)],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Request = { path: string; params: URLSearchParams }

function mockApi({ fail = false, empty = false }: { fail?: boolean; empty?: boolean } = {}) {
  const requests: Request[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'http://localhost')
      const path = url.pathname.replace('/api/v1', '')
      requests.push({ path, params: url.searchParams })
      if (path === '/lookups') {
        return json(LOOKUPS)
      }
      if (fail) {
        return new Response('{}', { status: 500 })
      }
      const currency = url.searchParams.get('currency')
      if (path === '/insights/summary') {
        if (empty) {
          return json({ headcount: 0, salary_by_currency: [] })
        }
        const onlyGermany = url.searchParams.get('country') === 'DE'
        return json(
          onlyGermany
            ? { headcount: 2, salary_by_currency: SUMMARY_ALL.salary_by_currency.filter((r) => r.currency === 'EUR') }
            : SUMMARY_ALL,
        )
      }
      if (path === '/insights/distribution') {
        return json({ currency, ...DISTRIBUTIONS[currency ?? 'INR'] })
      }
      if (path === '/insights/earners') {
        return json(EARNERS[url.searchParams.get('order') === 'lowest' ? 'lowest' : 'highest'])
      }
      const breakdown = BREAKDOWNS[path.replace('/insights/', '')]
      if (breakdown) {
        return json(breakdown.filter((r) => r.currency === currency))
      }
      return new Response('{}', { status: 404 })
    }),
  )
  return {
    requests,
    last: (path: string) => requests.filter((request) => request.path === path).at(-1),
  }
}

function renderPage(path = '/insights') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/insights" element={<InsightsPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return user
}

function firstColumn(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((tableRow) => within(tableRow).getAllByRole('cell')[0].textContent ?? '')
}

describe('scope', () => {
  test('uses the most common currency and sends it, with the filters, to every request', async () => {
    const api = mockApi()
    renderPage()

    expect(await screen.findByText('6 employees are paid in Indian Rupee')).toBeInTheDocument()
    await screen.findByRole('region', { name: 'Salary distribution' })
    for (const path of ['/insights/distribution', '/insights/by-country']) {
      await waitFor(() => expect(api.last(path)?.params.get('currency')).toBe('INR'))
    }
    await waitFor(() => expect(api.last('/insights/earners')?.params.get('currency')).toBe('INR'))
  })

  test('choosing another currency changes every figure', async () => {
    const api = mockApi()
    const user = renderPage()
    await screen.findByText('6 employees are paid in Indian Rupee')

    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(await screen.findByRole('option', { name: /EUR/ }))

    expect(await screen.findByText('2 employees are paid in Euro')).toBeInTheDocument()
    await waitFor(() => expect(api.last('/insights/distribution')?.params.get('currency')).toBe('EUR'))
  })

  test('country and department filters narrow every section and can be reset', async () => {
    const api = mockApi()
    const user = renderPage()
    await screen.findByText('6 employees are paid in Indian Rupee')

    await user.click(screen.getByRole('combobox', { name: 'Country' }))
    await user.click(await screen.findByRole('option', { name: /Germany/ }))
    await user.click(screen.getByRole('combobox', { name: 'Department' }))
    await user.click(await screen.findByRole('option', { name: 'Sales' }))

    expect(await screen.findByText('2 employees are paid in Euro')).toBeInTheDocument()
    for (const path of ['/insights/summary', '/insights/distribution', '/insights/by-country', '/insights/earners']) {
      await waitFor(() => {
        expect(api.last(path)?.params.get('country')).toBe('DE')
        expect(api.last(path)?.params.get('department')).toBe('2')
      })
    }

    await user.click(screen.getByRole('button', { name: 'Reset all filters' }))
    await waitFor(() => expect(api.last('/insights/summary')?.params.get('country')).toBeNull())
  })

  test('the currency and filters can come from the URL', async () => {
    const api = mockApi()
    renderPage('/insights?currency=EUR&country=DE')

    expect(await screen.findByText('2 employees are paid in Euro')).toBeInTheDocument()
    expect(api.last('/insights/summary')?.params.get('country')).toBe('DE')
  })

  test('no matching employees explains it and offers a reset', async () => {
    mockApi({ empty: true })
    renderPage('/insights?country=DE')

    expect(await screen.findByText('No employees match these filters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Salary distribution' })).not.toBeInTheDocument()
  })

  test('a failed load can be retried', async () => {
    const api = mockApi({ fail: true })
    const user = renderPage()

    expect(await screen.findByText("Couldn't load the insights")).toBeInTheDocument()
    const before = api.requests.length
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(api.requests.length).toBeGreaterThan(before))
  })
})

describe('salary distribution', () => {
  test('shows how many people fall in each pay range and marks the one holding the median', async () => {
    mockApi()
    renderPage()

    const chart = within(await screen.findByRole('region', { name: 'Salary distribution' }))
    const columns = await chart.findAllByRole('listitem')
    expect(columns.map((column) => column.getAttribute('aria-label'))).toEqual([
      '₹100 – ₹200: 2 employees',
      '₹201 – ₹301: 3 employees',
      '₹302 – ₹400: 1 employee',
    ])
    expect(columns.map((column) => column.dataset.median)).toEqual(['false', 'true', 'false'])
    expect(chart.getByText(/The gold column holds the median, ₹250/)).toBeInTheDocument()
  })

  test('has a table view with the same ranges', async () => {
    mockApi()
    const user = renderPage()
    const chart = within(await screen.findByRole('region', { name: 'Salary distribution' }))
    await chart.findAllByRole('listitem')

    await user.click(chart.getByRole('button', { name: 'Table' }))

    expect(within(chart.getByRole('table')).getByRole('row', { name: /₹201 – ₹301 3/ })).toBeInTheDocument()
  })
})

describe('pay breakdown', () => {
  async function breakdown() {
    return within(await screen.findByRole('region', { name: 'Pay breakdown' }))
  }

  test('starts with countries and ranks them by median pay', async () => {
    mockApi()
    renderPage()

    const table = await (await breakdown()).findByRole('table')
    await waitFor(() => expect(firstColumn(table)).toEqual(['India']))
    const india = within(table).getAllByRole('row')[1]
    expect(within(india).getByText('₹250')).toBeInTheDocument()
    expect(within(india).getByText('₹261')).toBeInTheDocument()
  })

  test('switches between countries, departments and job titles', async () => {
    const api = mockApi()
    const user = renderPage()
    const panel = await breakdown()

    await user.click(panel.getByRole('tab', { name: 'By department' }))
    await waitFor(() => expect(firstColumn(panel.getByRole('table'))).toEqual(['Sales', 'Engineering']))
    expect(api.last('/insights/by-department')?.params.get('currency')).toBe('INR')

    await user.click(panel.getByRole('tab', { name: 'By job title' }))
    await waitFor(() =>
      expect(firstColumn(panel.getByRole('table'))).toEqual(['Sales Executive', 'Software Engineer', 'Accountant']),
    )
  })

  test('clicking a column header sorts, and clicking again reverses', async () => {
    mockApi()
    const user = renderPage()
    const panel = await breakdown()
    await user.click(panel.getByRole('tab', { name: 'By job title' }))
    await waitFor(() => expect(firstColumn(panel.getByRole('table'))).toHaveLength(3))

    await user.click(panel.getByRole('button', { name: 'Employees' }))
    expect(firstColumn(panel.getByRole('table'))).toEqual(['Software Engineer', 'Sales Executive', 'Accountant'])
    expect(panel.getByRole('columnheader', { name: /Employees/ })).toHaveAttribute('aria-sort', 'descending')

    await user.click(panel.getByRole('button', { name: 'Employees' }))
    expect(firstColumn(panel.getByRole('table'))).toEqual(['Accountant', 'Sales Executive', 'Software Engineer'])

    await user.click(panel.getByRole('button', { name: 'Job title' }))
    expect(firstColumn(panel.getByRole('table'))).toEqual(['Accountant', 'Sales Executive', 'Software Engineer'])
  })
})

describe('highest and lowest paid', () => {
  test('lists the top and bottom earners in the chosen currency', async () => {
    const api = mockApi()
    renderPage()

    const highest = within(await screen.findByRole('region', { name: 'Highest paid' }))
    expect(await highest.findByText('Asha Rao')).toBeInTheDocument()
    expect(highest.getByText('₹400')).toBeInTheDocument()
    expect(highest.getByText('Ravi Patel')).toBeInTheDocument()

    const lowest = within(screen.getByRole('region', { name: 'Lowest paid' }))
    expect(await lowest.findByText('Meera Iyer')).toBeInTheDocument()
    expect(lowest.getByText('₹100')).toBeInTheDocument()
    expect(api.last('/insights/earners')?.params.get('limit')).toBe('5')
  })

  test('each person links to them in the Employees list', async () => {
    mockApi()
    renderPage()

    const highest = within(await screen.findByRole('region', { name: 'Highest paid' }))
    const link = await highest.findByRole('link', { name: /Asha Rao/ })

    expect(link).toHaveAttribute('href', '/employees?q=asha%40example.com')
  })
})
