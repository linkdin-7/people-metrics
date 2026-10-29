import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test, vi } from 'vitest'

import { EmployeesPage } from '@/features/employees/employees-page'
import type { Employee, Lookups } from '@/lib/api'

const LOOKUPS: Lookups = {
  countries: [
    { code: 'DE', name: 'Germany', currency: 'EUR' },
    { code: 'IN', name: 'India', currency: 'INR' },
  ],
  currencies: ['EUR', 'INR', 'USD'],
  departments: [
    { id: 1, name: 'Engineering' },
    { id: 2, name: 'Sales' },
  ],
  job_titles: ['Account Executive', 'Software Engineer'],
}

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    first_name: 'Asha',
    last_name: 'Rao',
    email: 'asha.rao.1@example.com',
    department: 1,
    department_name: 'Engineering',
    job_title: 'Software Engineer',
    country: 'IN',
    currency: 'INR',
    annual_salary: 1300000,
    hire_date: '2022-04-01',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type ApiOptions = { employees?: Employee[]; count?: number; failEmployees?: boolean }

function mockApi({ employees = [employee()], count, failEmployees = false }: ApiOptions = {}) {
  const employeeQueries: URLSearchParams[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'http://localhost')
      if (url.pathname === '/api/v1/lookups') {
        return json(LOOKUPS)
      }
      if (url.pathname === '/api/v1/employees') {
        employeeQueries.push(url.searchParams)
        if (failEmployees) {
          return json({ detail: 'Server error' }, 500)
        }
        return json({ count: count ?? employees.length, next: null, previous: null, results: employees })
      }
      return json({ detail: 'Not found.' }, 404)
    }),
  )
  return {
    employeeQueries,
    lastQuery: () => employeeQueries[employeeQueries.length - 1],
  }
}

function renderPage(path = '/employees') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/employees" element={<EmployeesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return user
}

async function chooseFromFilter(user: ReturnType<typeof userEvent.setup>, filter: RegExp, option: string) {
  await user.click(screen.getByRole('combobox', { name: filter }))
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('employee list', () => {
  test('shows each employee with department, country and salary in their currency', async () => {
    mockApi({
      employees: [
        employee(),
        employee({
          id: 2,
          first_name: 'Lena',
          last_name: 'Mueller',
          email: 'lena.mueller.2@example.com',
          department_name: 'Sales',
          job_title: 'Account Executive',
          country: 'DE',
          currency: 'EUR',
          annual_salary: 65000,
          hire_date: '2019-11-15',
        }),
      ],
    })
    renderPage()

    const asha = (await screen.findByText('Asha Rao')).closest('tr')!
    expect(within(asha).getByText('asha.rao.1@example.com')).toBeInTheDocument()
    expect(within(asha).getByText('Software Engineer')).toBeInTheDocument()
    expect(within(asha).getByText('Engineering')).toBeInTheDocument()
    expect(await within(asha).findByText('India')).toBeInTheDocument()
    expect(within(asha).getByText('₹1,300,000')).toBeInTheDocument()
    expect(within(asha).getByText('1 Apr 2022')).toBeInTheDocument()

    const lena = screen.getByText('Lena Mueller').closest('tr')!
    expect(within(lena).getByText('€65,000')).toBeInTheDocument()
    expect(screen.getByText(/Showing 1–2 of 2/)).toBeInTheDocument()
  })

  test('reads its search and filters from the URL', async () => {
    const api = mockApi()
    renderPage('/employees?q=rao&country=IN')

    await screen.findByText('Asha Rao')
    expect(api.lastQuery().get('q')).toBe('rao')
    expect(api.lastQuery().get('country')).toBe('IN')
    expect(screen.getByRole('searchbox', { name: 'Search employees' })).toHaveValue('rao')
    expect(await screen.findByRole('combobox', { name: /Country: India/ })).toBeInTheDocument()
  })

  test('searching sends the query after a short pause and returns to the first page', async () => {
    const api = mockApi({ count: 60 })
    const user = renderPage('/employees?page=2')
    await screen.findByText('Asha Rao')

    await user.type(screen.getByRole('searchbox', { name: 'Search employees' }), 'asha')

    await waitFor(() => expect(api.lastQuery().get('q')).toBe('asha'))
    expect(api.lastQuery().get('page')).toBeNull()
    expect(api.employeeQueries.some((query) => query.get('q') === 'a')).toBe(false)
  })

  test.each([
    [/Department/, 'Sales', 'department', '2'],
    [/Country/, 'Germany', 'country', 'DE'],
    [/Job title/, 'Account Executive', 'job_title', 'Account Executive'],
  ])('choosing %s "%s" filters the list', async (filter, option, param, value) => {
    const api = mockApi()
    const user = renderPage()
    await screen.findByText('Asha Rao')

    await chooseFromFilter(user, filter, option)

    await waitFor(() => expect(api.lastQuery().get(param)).toBe(value))
  })

  test('a salary range is applied, and an impossible one is refused', async () => {
    const api = mockApi()
    const user = renderPage()
    await screen.findByText('Asha Rao')
    await user.click(screen.getByRole('button', { name: /Salary range/ }))

    await user.type(screen.getByRole('spinbutton', { name: 'Minimum salary' }), '500')
    await user.type(screen.getByRole('spinbutton', { name: 'Maximum salary' }), '100')
    expect(screen.getByText('The minimum is above the maximum.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()

    await user.clear(screen.getByRole('spinbutton', { name: 'Maximum salary' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Maximum salary' }), '900')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(api.lastQuery().get('min_salary')).toBe('500'))
    expect(api.lastQuery().get('max_salary')).toBe('900')
  })

  test('clicking the salary header sorts ascending, then descending', async () => {
    const api = mockApi()
    const user = renderPage()
    await screen.findByText('Asha Rao')
    const header = screen.getByRole('columnheader', { name: /Salary/ })
    expect(header).toHaveAttribute('aria-sort', 'none')

    await user.click(within(header).getByRole('button'))
    await waitFor(() => expect(api.lastQuery().get('sort')).toBe('annual_salary'))
    expect(screen.getByRole('columnheader', { name: /Salary/ })).toHaveAttribute('aria-sort', 'ascending')

    await user.click(within(screen.getByRole('columnheader', { name: /Salary/ })).getByRole('button'))
    await waitFor(() => expect(api.lastQuery().get('sort')).toBe('-annual_salary'))
    expect(screen.getByRole('columnheader', { name: /Salary/ })).toHaveAttribute('aria-sort', 'descending')
  })

  test('pagination moves between pages and stops at both ends', async () => {
    const api = mockApi({ count: 60 })
    const user = renderPage()
    await screen.findByText('Asha Rao')

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(api.lastQuery().get('page')).toBe('2'))
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
  })

  test('the last page disables the next button', async () => {
    mockApi({ count: 60 })
    renderPage('/employees?page=3')

    expect(await screen.findByText('Page 3 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  test('no matches shows an empty state that can clear the filters', async () => {
    const api = mockApi({ employees: [] })
    const user = renderPage('/employees?q=nobody&department=2')

    expect(await screen.findByText('No employees match these filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(api.lastQuery().toString()).toBe(''))
    expect(screen.getByRole('searchbox', { name: 'Search employees' })).toHaveValue('')
  })

  test('a failed request shows an error that can be retried', async () => {
    const api = mockApi({ failEmployees: true })
    const user = renderPage()

    expect(await screen.findByText("Couldn't load employees")).toBeInTheDocument()
    const requestsBefore = api.employeeQueries.length
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(api.employeeQueries.length).toBe(requestsBefore + 1))
  })
})
