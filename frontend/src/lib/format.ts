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

export function formatCount(value: number): string {
  return countFormatter.format(value)
}

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate))
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// Same text always gives the same hue, so each person keeps their avatar colour.
export function hueFor(text: string): number {
  let hash = 0
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360
  }
  return hash
}
