export type Employee = {
  id: number
  first_name: string
  last_name: string
  email: string
  department: number
  department_name: string
  job_title: string
  country: string
  currency: string
  annual_salary: number
  hire_date: string
  created_at: string
  updated_at: string
}

export type Page<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type Country = { code: string; name: string; currency: string | null }

export type Department = { id: number; name: string }

export type Lookups = {
  countries: Country[]
  currencies: string[]
  departments: Department[]
  job_titles: string[]
  countries_in_use: string[]
}

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, details: unknown) {
    super(`Request failed with status ${status}`)
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, body)
  }
  return body as T
}

export type EmployeeInput = Omit<Employee, 'id' | 'department_name' | 'created_at' | 'updated_at'>

export type SalaryStats = {
  group?: string
  currency: string
  headcount: number
  min_salary: number
  median_salary: number
  average_salary: number
  max_salary: number
}

export type SalarySummary = { headcount: number; salary_by_currency: SalaryStats[] }

export const api = {
  listEmployees: (query: URLSearchParams) => request<Page<Employee>>(`/employees?${query}`),
  getLookups: () => request<Lookups>('/lookups'),
  createEmployee: (input: EmployeeInput) =>
    request<Employee>('/employees', { method: 'POST', body: JSON.stringify(input) }),
  updateEmployee: (id: number, input: EmployeeInput) =>
    request<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteEmployee: (id: number) => request<null>(`/employees/${id}`, { method: 'DELETE' }),
  restoreEmployee: (id: number) => request<Employee>(`/employees/${id}/restore`, { method: 'POST' }),
  getSalarySummary: (query: URLSearchParams) => request<SalarySummary>(`/insights/summary?${query}`),
}
