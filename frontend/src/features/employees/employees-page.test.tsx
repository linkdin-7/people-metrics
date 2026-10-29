import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test, vi } from 'vitest'

import { ThemeProvider } from '@/components/theme'
import { Toaster } from '@/components/ui/sonner'
import { EmployeesPage } from '@/features/employees/employees-page'
import type { Employee, Lookups } from '@/lib/api'

const LOOKUPS: Lookups = {
  countries: [
    { code: 'IO', name: 'British Indian Ocean Territory', currency: 'USD' },
    { code: 'DE', name: 'Germany', currency: 'EUR' },
    { code: 'HM', name: 'Heard Island and McDonald Islands', currency: 'AUD' },
    { code: 'IN', name: 'India', currency: 'INR' },
    { code: 'ID', name: 'Indonesia', currency: 'IDR' },
  ],
  countries_in_use: ['DE', 'IN'],
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

type Write = { method: string; path: string; body: Record<string, unknown> }

type ApiOptions = {
  employees?: Employee[]
  count?: number
  failEmployees?: boolean
  writeResponse?: (write: Write) => Response
  peerHeadcount?: number
}

function savedEmployee(write: Write) {
  if (write.method === 'DELETE') {
    return new Response(null, { status: 204 })
  }
  return json({ ...employee(), ...write.body, id: 99 }, write.method === 'POST' ? 201 : 200)
}

function mockApi({
  employees = [employee()],
  count,
  failEmployees = false,
  writeResponse = savedEmployee,
  peerHeadcount = 312,
}: ApiOptions = {}) {
  const employeeQueries: URLSearchParams[] = []
  const summaryQueries: URLSearchParams[] = []
  const writes: Write[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost')
      const method = init?.method ?? 'GET'
      if (method !== 'GET') {
        const write = { method, path: url.pathname, body: JSON.parse(String(init?.body ?? '{}')) }
        writes.push(write)
        return writeResponse(write)
      }
      if (url.pathname === '/api/v1/lookups') {
        return json(LOOKUPS)
      }
      if (url.pathname === '/api/v1/insights/summary') {
        summaryQueries.push(url.searchParams)
        return json({
          headcount: peerHeadcount,
          salary_by_currency: [
            {
              currency: 'INR',
              headcount: peerHeadcount,
              min_salary: 800000,
              median_salary: 1200000,
              average_salary: 1250000,
              max_salary: 2000000,
            },
          ],
        })
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
    summaryQueries,
    writes,
    lastQuery: () => employeeQueries[employeeQueries.length - 1],
  }
}

function renderPage(path = '/employees') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/employees" element={<EmployeesPage />} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </ThemeProvider>
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

type User = ReturnType<typeof userEvent.setup>

async function openNewEmployeeForm(user: User) {
  await screen.findByText('Asha Rao')
  await user.click(screen.getByRole('button', { name: 'Add employee' }))
  return screen.findByRole('dialog', { name: 'New employee' })
}

async function pick(user: User, panel: HTMLElement, field: string, option: string) {
  await user.click(within(panel).getByRole('combobox', { name: field }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function fillNewEmployee(user: User, panel: HTMLElement) {
  await user.type(within(panel).getByLabelText('First name'), 'Grace')
  await user.type(within(panel).getByLabelText('Last name'), 'Okafor')
  await user.type(within(panel).getByLabelText('Email'), 'grace.okafor@example.com')
  await pick(user, panel, 'Department', 'Sales')
  await user.type(within(panel).getByLabelText('Job title'), 'Account Executive')
  fireEvent.change(within(panel).getByLabelText('Hire date'), { target: { value: '2024-03-15' } })
  await pick(user, panel, 'Country', 'India')
  await user.type(within(panel).getByLabelText('Annual salary'), '1500000')
}

describe('adding and editing', () => {
  test('saving an empty form explains what is missing and sends nothing', async () => {
    const api = mockApi()
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await user.click(within(panel).getByRole('button', { name: 'Add employee' }))

    for (const message of [
      'Enter a first name',
      'Enter a last name',
      'Enter an email address',
      'Choose a department',
      'Enter a job title',
      'Enter a hire date',
      'Choose a country',
      'Enter an annual salary',
    ]) {
      expect(within(panel).getByText(message)).toBeInTheDocument()
    }
    expect(within(panel).getByLabelText('First name')).toHaveAttribute('aria-invalid', 'true')
    expect(api.writes).toHaveLength(0)
  })

  test('a complete new employee is saved with the country currency and the list refreshes', async () => {
    const api = mockApi()
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await fillNewEmployee(user, panel)
    expect(within(panel).getByRole('combobox', { name: 'Currency' })).toHaveTextContent('INR')
    expect(within(panel).getByText('₹1,500,000 per year')).toBeInTheDocument()
    const listRequestsBefore = api.employeeQueries.length
    await user.click(within(panel).getByRole('button', { name: 'Add employee' }))

    await waitFor(() => expect(api.writes).toHaveLength(1))
    expect(api.writes[0]).toEqual({
      method: 'POST',
      path: '/api/v1/employees',
      body: {
        first_name: 'Grace',
        last_name: 'Okafor',
        email: 'grace.okafor@example.com',
        department: 2,
        job_title: 'Account Executive',
        hire_date: '2024-03-15',
        country: 'IN',
        currency: 'INR',
        annual_salary: 1500000,
      },
    })
    expect(await screen.findByText('Added Grace Okafor')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(api.employeeQueries.length).toBeGreaterThan(listRequestsBefore))
  })

  test('a currency picked by hand is kept when the country changes', async () => {
    mockApi()
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await pick(user, panel, 'Country', 'India')
    expect(within(panel).getByRole('combobox', { name: 'Currency' })).toHaveTextContent('INR')
    await pick(user, panel, 'Currency', 'USD')
    await pick(user, panel, 'Country', 'Germany')

    expect(within(panel).getByRole('combobox', { name: 'Currency' })).toHaveTextContent('USD')
    expect(within(panel).getByText(/differs from Germany's EUR/)).toBeInTheDocument()
  })

  test('invalid email and salary are explained once the field is left', async () => {
    mockApi()
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await user.type(within(panel).getByLabelText('Email'), 'not-an-email')
    await user.type(within(panel).getByLabelText('Annual salary'), '0')
    await user.tab()

    expect(within(panel).getByText('Enter a valid email address')).toBeInTheDocument()
    expect(within(panel).getByText('Enter a whole amount above zero')).toBeInTheDocument()
    expect(within(panel).queryByText('Enter a first name')).not.toBeInTheDocument()
  })

  test('the country picker lists countries that already have employees first', async () => {
    mockApi()
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await user.click(within(panel).getByRole('combobox', { name: 'Country' }))

    const inUse = await screen.findByRole('group', { name: 'Countries with employees' })
    expect(within(inUse).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'GermanyDE',
      'IndiaIN',
    ])
    expect(within(screen.getByRole('group', { name: 'Other countries' })).getByRole('option', { name: /Indonesia/ })).toBeInTheDocument()
  })

  test('searching puts the best match first and ignores scattered letters', async () => {
    mockApi()
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await user.click(within(panel).getByRole('combobox', { name: 'Country' }))
    await user.type(screen.getByPlaceholderText('Search country…'), 'india')

    const results = screen.getAllByRole('option').map((option) => option.textContent)
    expect(results).toEqual(['IndiaIN', 'British Indian Ocean TerritoryIO'])
  })

  test('the toolbar country filter only offers countries that have employees', async () => {
    mockApi()
    const user = renderPage()
    await screen.findByText('Asha Rao')

    await user.click(screen.getByRole('combobox', { name: 'Country' }))

    const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
    expect(options).toEqual(['Any country', 'GermanyDE', 'IndiaIN'])
  })

  test('names must start with a letter and have at least two characters', async () => {
    mockApi()
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await user.type(within(panel).getByLabelText('First name'), '.')
    await user.type(within(panel).getByLabelText('Last name'), 'A')
    await user.tab()

    expect(within(panel).getByText('Start with a letter and use only letters, spaces, hyphens or apostrophes')).toBeInTheDocument()
    expect(within(panel).getByText('Use at least 2 characters')).toBeInTheDocument()

    await user.clear(within(panel).getByLabelText('First name'))
    await user.type(within(panel).getByLabelText('First name'), "O'Brien")
    await user.clear(within(panel).getByLabelText('Last name'))
    await user.type(within(panel).getByLabelText('Last name'), 'Ng')

    expect(within(panel).queryByText(/Start with a letter|at least 2 characters/)).not.toBeInTheDocument()
  })

  test('hire dates are limited to 1950 onwards and at most 30 days ahead', async () => {
    mockApi()
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)
    const hireDate = within(panel).getByLabelText('Hire date')
    const daysFromToday = (days: number) => {
      const date = new Date()
      date.setDate(date.getDate() + days)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    expect(hireDate).toHaveAttribute('min', '1950-01-01')
    expect(hireDate).toHaveAttribute('max', daysFromToday(30))

    fireEvent.change(hireDate, { target: { value: daysFromToday(31) } })
    fireEvent.blur(hireDate)
    expect(within(panel).getByText('Hire date can be at most 30 days from today')).toBeInTheDocument()

    fireEvent.change(hireDate, { target: { value: '1949-12-31' } })
    expect(within(panel).getByText("Hire date can't be before 1 January 1950")).toBeInTheDocument()

    fireEvent.change(hireDate, { target: { value: daysFromToday(30) } })
    expect(within(panel).queryByText(/Hire date can/)).not.toBeInTheDocument()
  })

  test('a duplicate email is shown on the email field and the panel stays open', async () => {
    mockApi({
      writeResponse: () => json({ detail: 'An employee with this email already exists.' }, 409),
    })
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await fillNewEmployee(user, panel)
    await user.click(within(panel).getByRole('button', { name: 'Add employee' }))

    expect(await within(panel).findByText('An employee with this email already exists.')).toBeInTheDocument()
    expect(within(panel).getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('dialog', { name: 'New employee' })).toBeInTheDocument()
  })

  test('server validation errors appear on the matching field', async () => {
    mockApi({
      writeResponse: () =>
        json({ annual_salary: ['Ensure this value is less than or equal to 2147483647.'] }, 400),
    })
    const user = renderPage()
    const panel = await openNewEmployeeForm(user)

    await fillNewEmployee(user, panel)
    await user.click(within(panel).getByRole('button', { name: 'Add employee' }))

    expect(
      await within(panel).findByText('Ensure this value is less than or equal to 2147483647.'),
    ).toBeInTheDocument()
  })

  test('editing from the profile sends the change and returns to the updated profile', async () => {
    const api = mockApi()
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'View Asha Rao' }))
    const profile = await screen.findByRole('dialog', { name: 'Asha Rao' })
    await user.click(within(profile).getByRole('button', { name: 'Edit' }))
    const panel = await screen.findByRole('dialog', { name: 'Edit Asha Rao' })
    expect(within(panel).getByLabelText('First name')).toHaveValue('Asha')
    expect(within(panel).getByRole('combobox', { name: 'Department' })).toHaveTextContent('Engineering')
    expect(within(panel).getByLabelText('Annual salary')).toHaveValue(1300000)

    await user.clear(within(panel).getByLabelText('Annual salary'))
    await user.type(within(panel).getByLabelText('Annual salary'), '1400000')
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.writes).toHaveLength(1))
    expect(api.writes[0].method).toBe('PATCH')
    expect(api.writes[0].path).toBe('/api/v1/employees/1')
    expect(api.writes[0].body).toMatchObject({ annual_salary: 1400000, currency: 'INR', department: 1 })
    expect(await screen.findByText('Saved Asha Rao')).toBeInTheDocument()
    const updated = await screen.findByRole('dialog', { name: 'Asha Rao' })
    expect(within(updated).getByText('₹1,400,000')).toBeInTheDocument()
  })
})

describe('employee profile', () => {
  async function openProfile(user: User) {
    await user.click(await screen.findByRole('button', { name: 'View Asha Rao' }))
    return screen.findByRole('dialog', { name: 'Asha Rao' })
  }

  test('clicking an employee shows their profile, not a form', async () => {
    mockApi()
    const user = renderPage()

    const profile = await openProfile(user)

    expect(within(profile).getByText('Software Engineer · Engineering')).toBeInTheDocument()
    expect(within(profile).getByText('₹1,300,000')).toBeInTheDocument()
    expect(within(profile).getByText('₹108,333')).toBeInTheDocument()
    expect(within(profile).getByText(/Since 1 Apr 2022/)).toBeInTheDocument()
    expect(within(profile).queryByRole('textbox')).not.toBeInTheDocument()
  })

  test('compares the salary with peers in the same role and currency', async () => {
    const api = mockApi()
    const user = renderPage()

    const profile = await openProfile(user)

    expect(await within(profile).findByText('8% above the median')).toBeInTheDocument()
    expect(within(profile).getByText('312 people in this role are paid in INR')).toBeInTheDocument()
    expect(within(profile).getByText('Median ₹1,200,000')).toBeInTheDocument()
    expect(api.summaryQueries[0].get('job_title')).toBe('Software Engineer')
    expect(api.summaryQueries[0].get('currency')).toBe('INR')
  })

  test('says when nobody else shares the role and currency', async () => {
    mockApi({ peerHeadcount: 1 })
    const user = renderPage()

    const profile = await openProfile(user)

    expect(await within(profile).findByText(/only person in this role paid in INR/)).toBeInTheDocument()
    expect(within(profile).queryByText(/the median/)).not.toBeInTheDocument()
  })

  test('the email can be copied', async () => {
    mockApi()
    const user = renderPage()
    const profile = await openProfile(user)

    await user.click(within(profile).getByRole('button', { name: 'Copy email' }))

    expect(await navigator.clipboard.readText()).toBe('asha.rao.1@example.com')
    expect(await screen.findByText('Email copied')).toBeInTheDocument()
  })

  test('deleting asks for confirmation, then removes the employee and refreshes the list', async () => {
    const api = mockApi()
    const user = renderPage()
    const profile = await openProfile(user)

    await user.click(within(profile).getByRole('button', { name: 'Delete' }))
    const confirmation = await screen.findByRole('alertdialog', { name: 'Delete Asha Rao?' })
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
    expect(api.writes).toHaveLength(0)
    expect(screen.getByRole('dialog', { name: 'Asha Rao' })).toBeInTheDocument()

    await user.click(within(profile).getByRole('button', { name: 'Delete' }))
    const listRequestsBefore = api.employeeQueries.length
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete employee' }),
    )

    await waitFor(() => expect(api.writes).toEqual([{ method: 'DELETE', path: '/api/v1/employees/1', body: {} }]))
    expect(await screen.findByText('Deleted Asha Rao')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(api.employeeQueries.length).toBeGreaterThan(listRequestsBefore))
  })

  test('a deleted employee can be brought back with Undo', async () => {
    const api = mockApi()
    const user = renderPage()
    const profile = await openProfile(user)

    await user.click(within(profile).getByRole('button', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete employee' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(() =>
      expect(api.writes.map((write) => `${write.method} ${write.path}`)).toEqual([
        'DELETE /api/v1/employees/1',
        'POST /api/v1/employees/1/restore',
      ]),
    )
    expect(await screen.findByText('Restored Asha Rao')).toBeInTheDocument()
  })

  test('a failed delete keeps the profile open and says so', async () => {
    mockApi({ writeResponse: () => json({ detail: 'Server error' }, 500) })
    const user = renderPage()
    const profile = await openProfile(user)

    await user.click(within(profile).getByRole('button', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete employee' }),
    )

    expect(await screen.findByText("Couldn't delete Asha Rao. Please try again.")).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Asha Rao' })).toBeInTheDocument()
  })

  test('cancelling an edit returns to the profile without saving', async () => {
    const api = mockApi()
    const user = renderPage()
    const profile = await openProfile(user)

    await user.click(within(profile).getByRole('button', { name: 'Edit' }))
    const form = await screen.findByRole('dialog', { name: 'Edit Asha Rao' })
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('dialog', { name: 'Asha Rao' })).toBeInTheDocument()
    expect(api.writes).toHaveLength(0)
  })
})
