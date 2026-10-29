import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2, Pencil, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { StatTile } from '@/components/stat-tile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ApiError, api, type Employee, type SalaryStats } from '@/lib/api'
import { comparePay, describeTenure, formatDate, formatMoney, hueFor, initials } from '@/lib/format'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}

function PeerComparison({ employee, peers }: { employee: Employee; peers: SalaryStats }) {
  if (peers.headcount <= 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {employee.first_name} is the only person in this role paid in {employee.currency}, so there's
        nobody to compare with yet.
      </p>
    )
  }

  const comparison = comparePay(employee.annual_salary, peers)
  return (
    <>
      <p className="text-lg font-semibold tracking-tight">{comparison.label}</p>
      <p className="text-sm text-muted-foreground">
        {peers.headcount} people in this role are paid in {peers.currency}
      </p>
      <div className="relative mt-6 h-2 rounded-full bg-linear-to-r from-muted via-primary/25 to-muted">
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/35"
          style={{ left: `${comparison.medianPosition * 100}%` }}
        />
        <motion.span
          aria-hidden="true"
          initial={{ left: `${comparison.medianPosition * 100}%`, scale: 0.6 }}
          animate={{ left: `${comparison.position * 100}%`, scale: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-md ring-4 ring-primary/15"
        />
      </div>
      <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>{formatMoney(peers.min_salary, peers.currency)}</span>
        <span>Median {formatMoney(peers.median_salary, peers.currency)}</span>
        <span>{formatMoney(peers.max_salary, peers.currency)}</span>
      </div>
    </>
  )
}

type EmployeeProfileProps = {
  employee: Employee
  countryName: string | undefined
  onEdit: () => void
  onClose: () => void
}

export function EmployeeProfile({ employee, countryName, onEdit, onClose }: EmployeeProfileProps) {
  const queryClient = useQueryClient()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const fullName = `${employee.first_name} ${employee.last_name}`

  function refreshEmployeeData() {
    for (const key of ['employees', 'lookups', 'salary-summary', 'insights']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  // Runs from the toast after the panel has closed, so it uses the shared query client directly.
  async function undoDelete() {
    try {
      await api.restoreEmployee(employee.id)
      refreshEmployeeData()
      toast.success(`Restored ${fullName}`)
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status === 409
          ? `Couldn't restore ${fullName}: an active employee now uses this email.`
          : `Couldn't restore ${fullName}. Please try again.`,
      )
    }
  }

  const remove = useMutation({
    mutationFn: () => api.deleteEmployee(employee.id),
    onSuccess: () => {
      refreshEmployeeData()
      setConfirmingDelete(false)
      onClose()
      toast.success(`Deleted ${fullName}`, { action: { label: 'Undo', onClick: undoDelete } })
    },
    onError: () => {
      setConfirmingDelete(false)
      toast.error(`Couldn't delete ${fullName}. Please try again.`)
    },
  })

  const peers = useQuery({
    queryKey: ['salary-summary', employee.job_title, employee.currency],
    queryFn: () =>
      api.getSalarySummary(new URLSearchParams({ job_title: employee.job_title, currency: employee.currency })),
  })
  const peerStats = peers.data?.salary_by_currency.find((row) => row.currency === employee.currency)
  const startsLater = describeTenure(employee.hire_date).startsWith('Starts')

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(employee.email)
      toast.success('Email copied')
    } catch {
      toast.error("Couldn't copy the email")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 slide-in-from-right-2 duration-300">
      <SheetHeader className="border-b px-6 py-6 sm:px-8">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="avatar-tint grid size-16 shrink-0 place-items-center rounded-2xl text-lg font-semibold"
            style={{ '--avatar-hue': hueFor(employee.email) } as CSSProperties}
          >
            {initials(employee.first_name, employee.last_name)}
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-xl">
              {employee.first_name} {employee.last_name}
            </SheetTitle>
            <SheetDescription>
              {employee.job_title} · {employee.department_name}
            </SheetDescription>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="rounded-full font-normal">
                {countryName ?? employee.country}
              </Badge>
              <Badge variant="outline" className="rounded-full font-mono font-normal">
                {employee.currency}
              </Badge>
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Annual salary"
            value={formatMoney(employee.annual_salary, employee.currency)}
            detail="per year"
          />
          <StatTile
            label="Monthly"
            value={formatMoney(Math.round(employee.annual_salary / 12), employee.currency)}
            detail="per month"
          />
          <StatTile
            label="Tenure"
            value={describeTenure(employee.hire_date)}
            detail={`${startsLater ? 'Starting' : 'Since'} ${formatDate(employee.hire_date)}`}
          />
        </section>

        <section className="rounded-2xl border border-border/70 bg-linear-to-br from-primary/6 to-transparent p-5">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Pay compared with peers
          </h3>
          <div className="mt-3">
            {peers.isPending && (
              <div className="grid gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="mt-4 h-2 w-full" />
              </div>
            )}
            {peers.isError && (
              <p className="text-sm text-muted-foreground">Couldn't load the comparison right now.</p>
            )}
            {peerStats && <PeerComparison employee={employee} peers={peerStats} />}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Details</h3>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Email">
              <span className="flex items-center gap-1.5">
                <span className="truncate">{employee.email}</span>
                <Button variant="ghost" size="icon-xs" aria-label="Copy email" onClick={copyEmail}>
                  <Copy />
                </Button>
              </span>
            </Detail>
            <Detail label="Department">{employee.department_name}</Detail>
            <Detail label="Job title">{employee.job_title}</Detail>
            <Detail label="Country">{countryName ?? employee.country}</Detail>
            <Detail label="Currency">{employee.currency}</Detail>
            <Detail label="Hire date">{formatDate(employee.hire_date)}</Detail>
            <Detail label="Last updated">{formatDate(employee.updated_at.slice(0, 10))}</Detail>
          </dl>
        </section>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmingDelete(true)}
          className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 />
          Delete
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button type="button" onClick={onEdit} className="min-w-28">
          <Pencil />
          Edit
        </Button>
      </SheetFooter>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll disappear from the employee list, insights and reports. The record is kept,
              and you can undo this straight after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault()
                remove.mutate()
              }}
            >
              {remove.isPending && <Loader2 className="animate-spin" />}
              Delete employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
