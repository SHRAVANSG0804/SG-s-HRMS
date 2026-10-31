// All business dates are 'YYYY-MM-DD' strings in IST (Asia/Kolkata).
// Arithmetic is done on UTC midnight so the browser's own time zone never leaks in.

const IST = 'Asia/Kolkata'

export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function nowTimeIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
}

function toUTC(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

function fromUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function addDays(d: string, n: number): string {
  const x = toUTC(d)
  x.setUTCDate(x.getUTCDate() + n)
  return fromUTC(x)
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(d: string): number {
  return toUTC(d).getUTCDay()
}

export function isSunday(d: string): boolean {
  return weekday(d) === 0
}

export function daysBetweenInclusive(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** 'YYYY-MM' of a date */
export function monthOf(d: string): string {
  return d.slice(0, 7)
}

export function daysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return fromUTC(d).slice(0, 7)
}

export function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: 'UTC' }).format(toUTC(d))
}

export function fmtMonth(month: string): string {
  return fmtDate(`${month}-01`, { month: 'long', year: 'numeric' })
}

export function fmtDay(d: string): string {
  return fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Hours between two 'HH:MM' times, 0 if either is missing. */
export function hoursBetween(inT?: string, outT?: string): number {
  if (!inT || !outT) return 0
  const [h1, m1] = inT.split(':').map(Number)
  const [h2, m2] = outT.split(':').map(Number)
  return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60)
}
