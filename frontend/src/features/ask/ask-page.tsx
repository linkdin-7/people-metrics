import { useMutation } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, type AskAnswer, type AskColumn } from '@/lib/api'
import { formatCount, formatMoney } from '@/lib/format'

const MAX_QUESTION_LENGTH = 300

const EXAMPLES = [
  'What is the median salary of software engineers in India?',
  'Which department has the highest average salary in Germany?',
  'How many employees earn more than 100,000 USD?',
  'Top 5 job titles by average salary in the UK',
]

function ExampleButtons({ questions, onAsk }: { questions: string[]; onAsk: (question: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((question) => (
        <Button
          key={question}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAsk(question)}
          className="h-auto rounded-full px-3 py-1.5 text-left font-normal whitespace-normal"
        >
          {question}
        </Button>
      ))}
    </div>
  )
}

function cellText(column: AskColumn, row: AskAnswer['rows'][number]): string {
  const value = row[column.key]
  if (column.kind === 'money') {
    return formatMoney(Number(value), String(row.currency))
  }
  return column.kind === 'count' ? formatCount(Number(value)) : String(value)
}

function AnswerTable({ answer }: { answer: AskAnswer }) {
  return (
    <Table className="mt-4">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {answer.columns.map((column) => (
            <TableHead key={column.key} className={column.kind === 'text' ? '' : 'text-right'}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {answer.rows.map((row, index) => (
          <TableRow key={index}>
            {answer.columns.map((column) => (
              <TableCell key={column.key} className={column.kind === 'text' ? '' : 'text-right tabular-nums'}>
                {cellText(column, row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function AskPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const ask = useMutation({
    mutationFn: (text: string) => api.askQuestion(text),
    onSuccess: setAnswer,
  })

  function submit(text: string) {
    const trimmed = text.trim()
    if (trimmed) {
      setQuestion(text)
      ask.mutate(trimmed)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit(question)
  }

  const showTable = answer && answer.rows.length > 0 && (answer.rows.length > 1 || answer.columns.length > 1)

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Ask a Question</h1>
        <p className="mt-1.5 text-muted-foreground">Ask about pay or headcount.</p>
      </header>

      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Your question"
            placeholder="For example: median salary of software engineers in India"
            maxLength={MAX_QUESTION_LENGTH}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <Button type="submit" disabled={!question.trim() || ask.isPending} className="h-11 min-w-20">
          {ask.isPending ? <Loader2 className="animate-spin" /> : null}
          Ask
        </Button>
      </form>

      {!answer && <ExampleButtons questions={EXAMPLES} onAsk={submit} />}

      {ask.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn't get an answer. Please try again.
        </p>
      )}

      {answer && (
        <div
          className={`rounded-2xl border border-border/70 bg-card/70 p-5 shadow-xs transition-opacity ${ask.isPending ? 'opacity-60' : ''}`}
        >
          <p className="text-lg font-medium text-balance">{answer.answer}</p>

          {showTable && <AnswerTable answer={answer} />}

          {answer.suggestions.length > 0 && (
            <div className="mt-4">
              <ExampleButtons questions={answer.suggestions} onAsk={submit} />
            </div>
          )}

          {answer.notes.map((note) => (
            <p key={note} className="mt-3 text-sm text-muted-foreground">
              {note}
            </p>
          ))}

          {answer.interpretation.length > 0 && (
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              {answer.interpretation.map((part) => `${part.label}: ${part.value}`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
