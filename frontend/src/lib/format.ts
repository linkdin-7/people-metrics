const moneyFormatters = new Map<string, Intl.NumberFormat>()
const countFormatter = new Intl.NumberFormat('en-US')
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatMoney(amount: number, currency: string): string {
  let formatter = moneyFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
    moneyFormatters.set(currency, formatter)
  }
  return formatter.format(amount)
}

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' })

export function currencyName(code: string): string {
  return currencyNames.of(code) ?? code
}

export function formatCompactMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

export function formatCount(value: number): string {
  return countFormatter.format(value)
}

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate))
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

const DAY_IN_MS = 86400000

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

export function describeTenure(hireDate: string, today: Date = new Date()): string {
  const [year, month, day] = hireDate.split('-').map(Number)
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((todayUtc - Date.UTC(year, month - 1, day)) / DAY_IN_MS)
  if (days < 0) {
    return days === -1 ? 'Starts tomorrow' : `Starts in ${-days} days`
  }
  if (days === 0) {
    return 'Joined today'
  }

  let months = (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month)
  if (today.getDate() < day) {
    months -= 1
  }
  if (months < 1) {
    return plural(days, 'day')
  }
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  return [years && plural(years, 'year'), remainingMonths && plural(remainingMonths, 'month')]
    .filter(Boolean)
    .join(' ')
}

type PeerPay = { min_salary: number; median_salary: number; max_salary: number }

export function comparePay(salary: number, peers: PeerPay) {
  const span = peers.max_salary - peers.min_salary
  const positionOf = (amount: number) =>
    span === 0 ? 0.5 : Math.min(1, Math.max(0, (amount - peers.min_salary) / span))
  const percent = Math.round(((salary - peers.median_salary) / peers.median_salary) * 100)
  const label =
    percent === 0
      ? 'Right at the median'
      : `${Math.abs(percent)}% ${percent > 0 ? 'above' : 'below'} the median`
  return { label, percent, position: positionOf(salary), medianPosition: positionOf(peers.median_salary) }
}

// Same text always gives the same hue, so each person keeps their avatar colour.
export function hueFor(text: string): number {
  let hash = 0
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360
  }
  return hash
}
