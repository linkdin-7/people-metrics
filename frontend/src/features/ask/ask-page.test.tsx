import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, test, vi } from 'vitest'

import { AskPage } from '@/features/ask/ask-page'
import type { AskAnswer } from '@/lib/api'

const MEDIAN: AskAnswer = {
  status: 'answered',
  question: 'median salary of software engineers in India',
  interpretation: [
    { label: 'Statistic', value: 'Median salary' },
    { label: 'Country', value: 'India' },
  ],
  answer: 'Median salary (Software Engineer, India): 1,250,000 INR across 77 employees.',
  notes: [],
  columns: [
    { key: 'currency', label: 'Currency', kind: 'text' },
    { key: 'headcount', label: 'Employees', kind: 'count' },
    { key: 'value', label: 'Median salary', kind: 'money' },
  ],
  rows: [{ currency: 'INR', headcount: 77, value: 1250000 }],
  suggestions: [],
}

const BY_COUNTRY: AskAnswer = {
  ...MEDIAN,
  answer: 'Employees by country, highest first:',
  interpretation: [{ label: 'Statistic', value: 'Employees' }],
  columns: [
    { key: 'group', label: 'Country', kind: 'text' },
    { key: 'value', label: 'Employees', kind: 'count' },
  ],
  rows: [
    { group: 'India', value: 2196 },
    { group: 'Germany', value: 724 },
  ],
}

const TOTAL: AskAnswer = {
  ...MEDIAN,
  answer: '10,000 employees in total.',
  columns: [{ key: 'value', label: 'Employees', kind: 'count' }],
  rows: [{ value: 10000 }],
}

const CLARIFY: AskAnswer = {
  ...MEDIAN,
  status: 'needs_clarification',
  answer: "I couldn't find 'gernany'. Did you mean Germany?",
  interpretation: [],
  columns: [],
  rows: [],
  suggestions: ['median salary in Germany'],
}

const UNSUPPORTED: AskAnswer = {
  ...CLARIFY,
  status: 'unsupported',
  answer: 'I can answer questions about employee counts and salary statistics. Here are some examples.',
  suggestions: ['What is the median salary of software engineers in India?', 'Top 5 job titles by average salary in the UK'],
}

function mockApi(respond: (question: string) => AskAnswer | Response) {
  const asked: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: string, init?: RequestInit) => {
      const question = JSON.parse(String(init?.body)).question as string
      asked.push(question)
      const result = respond(question)
      return result instanceof Response
        ? result
        : new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
  return asked
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AskPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return user
}

const questionBox = () => screen.getByRole('textbox', { name: 'Your question' })

describe('asking', () => {
  test('starts with a question box and a few examples to click', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Ask a Question' })).toBeInTheDocument()
    expect(questionBox()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: /\?$|^Top / }).length).toBeGreaterThanOrEqual(3)
  })

  test('shows the answer, the table and how the question was understood', async () => {
    const asked = mockApi(() => MEDIAN)
    const user = renderPage()

    await user.type(questionBox(), 'median salary of software engineers in India')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    expect(await screen.findByText(MEDIAN.answer)).toBeInTheDocument()
    expect(asked).toEqual(['median salary of software engineers in India'])
    const table = screen.getByRole('table')
    expect(within(table).getByText('₹1,250,000')).toBeInTheDocument()
    expect(within(table).getByText('77')).toBeInTheDocument()
    expect(screen.getByText('Statistic: Median salary · Country: India')).toBeInTheDocument()
  })

  test('pressing Enter asks the question', async () => {
    const asked = mockApi(() => MEDIAN)
    const user = renderPage()

    await user.type(questionBox(), 'median salary in India{Enter}')

    await waitFor(() => expect(asked).toEqual(['median salary in India']))
  })

  test('shows each row of a grouped answer with its own value', async () => {
    mockApi(() => BY_COUNTRY)
    const user = renderPage()

    await user.type(questionBox(), 'headcount by country{Enter}')

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('row', { name: /India 2,196/ })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /Germany 724/ })).toBeInTheDocument()
  })

  test('a single number needs no table', async () => {
    mockApi(() => TOTAL)
    const user = renderPage()

    await user.type(questionBox(), 'how many employees{Enter}')

    expect(await screen.findByText('10,000 employees in total.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  test('clicking an example fills the box and asks it straight away', async () => {
    const asked = mockApi(() => MEDIAN)
    const user = renderPage()
    const example = screen.getAllByRole('button', { name: /^What is the median salary/ })[0]

    await user.click(example)

    await waitFor(() => expect(asked).toHaveLength(1))
    expect(questionBox()).toHaveValue(asked[0])
    expect(await screen.findByText(MEDIAN.answer)).toBeInTheDocument()
  })
})

describe('when it needs help', () => {
  test('a clarification shows its message and suggestions that can be clicked', async () => {
    const asked = mockApi((question) => (question === 'median salary in Germany' ? MEDIAN : CLARIFY))
    const user = renderPage()

    await user.type(questionBox(), 'median salary in Gernany{Enter}')
    expect(await screen.findByText("I couldn't find 'gernany'. Did you mean Germany?")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'median salary in Germany' }))

    expect(await screen.findByText(MEDIAN.answer)).toBeInTheDocument()
    expect(asked).toEqual(['median salary in Gernany', 'median salary in Germany'])
    expect(questionBox()).toHaveValue('median salary in Germany')
  })

  test('an unsupported question explains and offers examples', async () => {
    mockApi(() => UNSUPPORTED)
    const user = renderPage()

    await user.type(questionBox(), 'tell me a joke{Enter}')

    expect(await screen.findByText(/I can answer questions about employee counts/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Top 5 job titles by average salary in the UK' }).length).toBeGreaterThan(0)
  })

  test('notes about assumptions are shown with the answer', async () => {
    mockApi(() => ({ ...MEDIAN, notes: ['Salaries are compared in INR, the usual currency in India.'] }))
    const user = renderPage()

    await user.type(questionBox(), 'median salary in India{Enter}')

    expect(await screen.findByText('Salaries are compared in INR, the usual currency in India.')).toBeInTheDocument()
  })

  test('a failed request says so and the box stays usable', async () => {
    mockApi(() => new Response('{}', { status: 500 }))
    const user = renderPage()

    await user.type(questionBox(), 'median salary in India{Enter}')

    expect(await screen.findByText("Couldn't get an answer. Please try again.")).toBeInTheDocument()
    expect(questionBox()).toHaveValue('median salary in India')
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled()
  })

  test('the question length is limited to what the API accepts', () => {
    renderPage()

    expect(questionBox()).toHaveAttribute('maxlength', '300')
  })
})
