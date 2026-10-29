import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { SearchSelect } from '@/components/search-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ApiError, api, type Employee, type EmployeeInput, type Lookups } from '@/lib/api'
import { formatMoney, hueFor, initials } from '@/lib/format'

type FormValues = {
  first_name: string
  last_name: string
  email: string
  department: string
  job_title: string
  hire_date: string
  country: string
  currency: string
  annual_salary: string
}

type FieldName = keyof FormValues
type FormErrors = Partial<Record<FieldName | 'form', string>>

const REQUIRED_MESSAGES: Record<FieldName, string> = {
  first_name: 'Enter a first name',
  last_name: 'Enter a last name',
  email: 'Enter an email address',
  department: 'Choose a department',
  job_title: 'Enter a job title',
  hire_date: 'Enter a hire date',
  country: 'Choose a country',
  currency: 'Choose a currency',
  annual_salary: 'Enter an annual salary',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Same rule as the API: start with a letter, then letters, spaces, hyphens, apostrophes or full stops.
const NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’.-]*$/u

// Same limits as the API: from 1950, and up to 30 days ahead for people about to join.
const EARLIEST_HIRE_DATE = '1950-01-01'
const MAX_DAYS_AHEAD_FOR_HIRE_DATE = 30

function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function latestHireDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + MAX_DAYS_AHEAD_FOR_HIRE_DATE)
  return localIsoDate(date)
}

function nameError(value: string): string | undefined {
  const name = value.trim()
  if (!name) {
    return undefined
  }
  if (!NAME_PATTERN.test(name)) {
    return 'Start with a letter and use only letters, spaces, hyphens or apostrophes'
  }
  if (name.length < 2) {
    return 'Use at least 2 characters'
  }
  return undefined
}

function initialValues(employee: Employee | undefined): FormValues {
  if (!employee) {
    return {
      first_name: '',
      last_name: '',
      email: '',
      department: '',
      job_title: '',
      hire_date: '',
      country: '',
      currency: '',
      annual_salary: '',
    }
  }
  return {
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email,
    department: String(employee.department),
    job_title: employee.job_title,
    hire_date: employee.hire_date,
    country: employee.country,
    currency: employee.currency,
    annual_salary: String(employee.annual_salary),
  }
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}
  for (const [field, message] of Object.entries(REQUIRED_MESSAGES) as [FieldName, string][]) {
    if (!values[field].trim()) {
      errors[field] = message
    }
  }
  for (const field of ['first_name', 'last_name'] as const) {
    const error = nameError(values[field])
    if (error) {
      errors[field] = error
    }
  }
  if (values.hire_date && values.hire_date < EARLIEST_HIRE_DATE) {
    errors.hire_date = "Hire date can't be before 1 January 1950"
  } else if (values.hire_date && values.hire_date > latestHireDate()) {
    errors.hire_date = 'Hire date can be at most 30 days from today'
  }
  if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address'
  }
  const salary = Number(values.annual_salary)
  if (values.annual_salary.trim() && (!Number.isInteger(salary) || salary < 1)) {
    errors.annual_salary = 'Enter a whole amount above zero'
  }
  return errors
}

function errorsFromServer(error: unknown): FormErrors {
  if (error instanceof ApiError && error.status === 409) {
    return { email: 'An employee with this email already exists.' }
  }
  if (error instanceof ApiError && error.status === 400 && error.details && typeof error.details === 'object') {
    const errors: FormErrors = {}
    for (const [field, messages] of Object.entries(error.details)) {
      const message = Array.isArray(messages) ? messages.join(' ') : String(messages)
      errors[field in REQUIRED_MESSAGES ? (field as FieldName) : 'form'] = message
    }
    return errors
  }
  return { form: "Couldn't save. Check that the API is running and try again." }
}

function toInput(values: FormValues): EmployeeInput {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim(),
    department: Number(values.department),
    job_title: values.job_title.trim(),
    hire_date: values.hire_date,
    country: values.country,
    currency: values.currency,
    annual_salary: Number(values.annual_salary),
  }
}

type FieldProps = { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }

function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive animate-in fade-in-0 slide-in-from-top-1">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h3>
  )
}

type EmployeeFormProps = {
  employee: Employee | undefined
  lookups: Lookups | undefined
  onDone: () => void
}

function EmployeeForm({ employee, lookups, onDone }: EmployeeFormProps) {
  const queryClient = useQueryClient()
  const countries = lookups?.countries ?? []
  const defaultCurrencyOf = (code: string) => countries.find((country) => country.code === code)?.currency ?? ''

  const [values, setValues] = useState(() => initialValues(employee))
  // A field shows its error only after it was edited and then left, or after Save is pressed.
  const [edited, setEdited] = useState<Set<FieldName>>(new Set())
  const [touched, setTouched] = useState<Set<FieldName>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<FormErrors>({})
  const [currencyFollowsCountry, setCurrencyFollowsCountry] = useState(
    () => !employee || employee.currency === defaultCurrencyOf(employee.country),
  )

  const clientErrors = validate(values)
  const errorFor = (field: FieldName) =>
    serverErrors[field] ??
    (submitted || (edited.has(field) && touched.has(field)) ? clientErrors[field] : undefined)

  const save = useMutation({
    mutationFn: (input: EmployeeInput) =>
      employee ? api.updateEmployee(employee.id, input) : api.createEmployee(input),
    onSuccess: (_saved, input) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['lookups'] })
      const name = `${input.first_name} ${input.last_name}`
      toast.success(employee ? `Saved ${name}` : `Added ${name}`)
      onDone()
    },
    onError: (error) => setServerErrors(errorsFromServer(error)),
  })

  function change(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setEdited((current) => new Set(current).add(field))
    setServerErrors((current) => ({ ...current, [field]: undefined, form: undefined }))
  }

  function touch(field: FieldName) {
    setTouched((current) => new Set(current).add(field))
  }

  function changeCountry(code: string) {
    change('country', code)
    if (currencyFollowsCountry) {
      change('currency', defaultCurrencyOf(code))
    }
  }

  function changeCurrency(code: string) {
    setCurrencyFollowsCountry(false)
    change('currency', code)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const firstInvalid = (Object.keys(REQUIRED_MESSAGES) as FieldName[]).find((field) => clientErrors[field])
    if (firstInvalid) {
      document.getElementById(`employee-${firstInvalid}`)?.focus()
      return
    }
    save.mutate(toInput(values))
  }

  function inputProps(field: FieldName) {
    const error = errorFor(field)
    return {
      id: `employee-${field}`,
      value: values[field],
      onChange: (event: ChangeEvent<HTMLInputElement>) => change(field, event.target.value),
      onBlur: () => touch(field),
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `employee-${field}-error` : undefined,
      className: 'h-10',
    }
  }

  const countryName = countries.find((country) => country.code === values.country)?.name
  const countryCurrency = defaultCurrencyOf(values.country)
  const salary = Number(values.annual_salary)
  const salaryPreview =
    values.currency && Number.isInteger(salary) && salary > 0
      ? `${formatMoney(salary, values.currency)} per year`
      : 'Whole amount in the chosen currency'
  const currencyHint =
    countryName && countryCurrency
      ? values.currency && values.currency !== countryCurrency
        ? `Paid in ${values.currency}, which differs from ${countryName}'s ${countryCurrency}`
        : `Default for ${countryName}`
      : 'Fills in from the country'

  const fullName = `${values.first_name} ${values.last_name}`.trim()
  const title = employee ? `Edit ${employee.first_name} ${employee.last_name}` : 'New employee'

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="avatar-tint grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-semibold transition-colors duration-300"
            style={{ '--avatar-hue': hueFor(values.email || fullName) } as CSSProperties}
          >
            {initials(values.first_name, values.last_name) || '?'}
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            <SheetDescription className="truncate">
              {fullName || 'Fill in the details below'}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6 sm:px-8">
        <section className="grid gap-4">
          <SectionTitle>Person</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="employee-first_name" label="First name" error={errorFor('first_name')}>
              <Input autoComplete="off" {...inputProps('first_name')} />
            </Field>
            <Field id="employee-last_name" label="Last name" error={errorFor('last_name')}>
              <Input autoComplete="off" {...inputProps('last_name')} />
            </Field>
          </div>
          <Field id="employee-email" label="Email" error={errorFor('email')}>
            <Input type="email" autoComplete="off" {...inputProps('email')} />
          </Field>
        </section>

        <section className="grid gap-4">
          <SectionTitle>Role</SectionTitle>
          <Field id="employee-department" label="Department" error={errorFor('department')}>
            <SearchSelect
              id="employee-department"
              label="Department"
              placeholder="Select a department"
              value={values.department}
              options={(lookups?.departments ?? []).map((department) => ({
                value: String(department.id),
                label: department.name,
              }))}
              onChange={(value) => change('department', value)}
              onClose={() => touch('department')}
              invalid={Boolean(errorFor('department'))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="employee-job_title" label="Job title" error={errorFor('job_title')}>
              <Input list="employee-job-titles" autoComplete="off" {...inputProps('job_title')} />
              <datalist id="employee-job-titles">
                {(lookups?.job_titles ?? []).map((title) => (
                  <option key={title} value={title} />
                ))}
              </datalist>
            </Field>
            <Field id="employee-hire_date" label="Hire date" error={errorFor('hire_date')}>
              <Input type="date" min={EARLIEST_HIRE_DATE} max={latestHireDate()} {...inputProps('hire_date')} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <SectionTitle>Pay</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="employee-country" label="Country" error={errorFor('country')}>
              <SearchSelect
                id="employee-country"
                label="Country"
                placeholder="Select a country"
                value={values.country}
                options={countries.map((country) => ({
                  value: country.code,
                  label: country.name,
                  hint: country.code,
                  keywords: [country.code],
                }))}
                suggestions={{
                  values: lookups?.countries_in_use ?? [],
                  heading: 'Countries with employees',
                  otherHeading: 'Other countries',
                }}
                onChange={changeCountry}
                onClose={() => touch('country')}
                invalid={Boolean(errorFor('country'))}
              />
            </Field>
            <Field id="employee-currency" label="Currency" error={errorFor('currency')} hint={currencyHint}>
              <SearchSelect
                id="employee-currency"
                label="Currency"
                placeholder="Select a currency"
                value={values.currency}
                options={(lookups?.currencies ?? []).map((code) => ({ value: code, label: code }))}
                onChange={changeCurrency}
                onClose={() => touch('currency')}
                invalid={Boolean(errorFor('currency'))}
              />
            </Field>
          </div>
          <Field id="employee-annual_salary" label="Annual salary" error={errorFor('annual_salary')} hint={salaryPreview}>
            <Input type="number" min={1} step={1} inputMode="numeric" {...inputProps('annual_salary')} className="h-10 tabular-nums" />
          </Field>
        </section>

        {serverErrors.form && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverErrors.form}
          </p>
        )}
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending} className="min-w-32">
          {save.isPending && <Loader2 className="animate-spin" />}
          {employee ? 'Save changes' : 'Add employee'}
        </Button>
      </SheetFooter>
    </form>
  )
}

type EmployeeSheetProps = {
  open: boolean
  employee: Employee | undefined
  lookups: Lookups | undefined
  onClose: () => void
}

export function EmployeeSheet({ open, employee, lookups, onClose }: EmployeeSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:xl:max-w-3xl">
        {open && <EmployeeForm key={employee?.id ?? 'new'} employee={employee} lookups={lookups} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  )
}
