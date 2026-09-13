export type AutomationFrequency =
  | 'once'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'yearly'

export type ScheduleInput = {
  frequency: AutomationFrequency
  timezone: string
  localTime: string
  weekday?: number
  monthday?: number
  month?: number
  onceOn?: string
}

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Warsaw',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
]

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function assertValidTimeZone(timeZone: string): void {
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Invalid IANA timezone: ${timeZone}`)
  }
}

export function parseLocalTime(localTime: string): {
  hour: number
  minute: number
  second: number
} {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(localTime.trim())
  if (!match) {
    throw new Error(`Invalid local time: ${localTime}`)
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] ?? 0)
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Invalid local time: ${localTime}`)
  }
  return { hour, minute, second }
}

export function normalizeLocalTime(localTime: string): string {
  const { hour, minute, second } = parseLocalTime(localTime)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hour)}:${pad(minute)}:${pad(second)}`
}

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const weekday = WEEKDAY_SHORT.indexOf(map.weekday as (typeof WEEKDAY_SHORT)[number])
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: weekday < 0 ? 0 : weekday,
  }
}

function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  let instant = new Date(desiredAsUtc)
  for (let i = 0; i < 3; i++) {
    const parts = getZonedParts(instant, timeZone)
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
    const offset = asUtc - instant.getTime()
    instant = new Date(desiredAsUtc - offset)
  }
  return instant
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + delta))
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  }
}

function addCalendarMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const dt = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1 }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function clampMonthDay(year: number, month: number, monthday: number): number {
  return Math.min(monthday, daysInMonth(year, month))
}

function nextMatchingDay(
  timeZone: string,
  from: Date,
  hour: number,
  minute: number,
  second: number,
  predicate: (weekday: number) => boolean
): Date | null {
  const parts = getZonedParts(from, timeZone)
  for (let i = 0; i < 14; i++) {
    const d = addCalendarDays(parts.year, parts.month, parts.day, i)
    const instant = zonedWallClockToUtc(d.year, d.month, d.day, hour, minute, second, timeZone)
    const wd = getZonedParts(instant, timeZone).weekday
    if (predicate(wd) && instant.getTime() >= from.getTime()) {
      return instant
    }
  }
  return null
}

/**
 * Next fire instant in UTC for a grok-style schedule.
 * Default: first occurrence >= `from`.
 * `exclusive: true` (after a successful enqueue): first occurrence strictly after `from`.
 */
export function computeNextRunAt(
  input: ScheduleInput,
  from: Date,
  options?: { exclusive?: boolean }
): Date | null {
  assertValidTimeZone(input.timezone)
  const { hour, minute, second } = parseLocalTime(input.localTime)
  const fromMs = options?.exclusive ? from.getTime() + 1 : from.getTime()
  const fromCmp = new Date(fromMs)

  switch (input.frequency) {
    case 'once': {
      if (!input.onceOn || !/^\d{4}-\d{2}-\d{2}$/.test(input.onceOn)) {
        return null
      }
      const [y, m, d] = input.onceOn.split('-').map(Number)
      const instant = zonedWallClockToUtc(y, m, d, hour, minute, second, input.timezone)
      return instant.getTime() >= fromCmp.getTime() ? instant : null
    }
    case 'daily':
      return nextMatchingDay(input.timezone, fromCmp, hour, minute, second, () => true)
    case 'weekdays':
      return nextMatchingDay(input.timezone, fromCmp, hour, minute, second, (wd) => wd <= 4)
    case 'weekly': {
      if (input.weekday == null || input.weekday < 0 || input.weekday > 6) {
        throw new Error('weekday (Monday=0) is required for weekly schedules')
      }
      const weekday = input.weekday
      return nextMatchingDay(input.timezone, fromCmp, hour, minute, second, (wd) => wd === weekday)
    }
    case 'monthly': {
      if (input.monthday == null || input.monthday < 1 || input.monthday > 31) {
        throw new Error('monthday (1–31) is required for monthly schedules')
      }
      const parts = getZonedParts(fromCmp, input.timezone)
      for (let i = 0; i < 16; i++) {
        const ym = addCalendarMonths(parts.year, parts.month, i)
        const day = clampMonthDay(ym.year, ym.month, input.monthday)
        const instant = zonedWallClockToUtc(ym.year, ym.month, day, hour, minute, second, input.timezone)
        if (instant.getTime() >= fromCmp.getTime()) return instant
      }
      return null
    }
    case 'yearly': {
      if (input.month == null || input.month < 1 || input.month > 12) {
        throw new Error('month (1–12) is required for yearly schedules')
      }
      if (input.monthday == null || input.monthday < 1 || input.monthday > 31) {
        throw new Error('monthday (1–31) is required for yearly schedules')
      }
      const parts = getZonedParts(fromCmp, input.timezone)
      for (let i = 0; i < 6; i++) {
        const year = parts.year + i
        const day = clampMonthDay(year, input.month, input.monthday)
        const instant = zonedWallClockToUtc(year, input.month, day, hour, minute, second, input.timezone)
        if (instant.getTime() >= fromCmp.getTime()) return instant
      }
      return null
    }
    default:
      throw new Error(`Unsupported frequency: ${String(input.frequency)}`)
  }
}

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

function formatTimeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

export function formatCadence(input: ScheduleInput): string {
  assertValidTimeZone(input.timezone)
  const sampleFrom = new Date('2026-01-07T12:00:00Z')
  let sample: Date | null = null
  try {
    sample = computeNextRunAt(
      input.frequency === 'once' && input.onceOn ? input : { ...input, frequency: 'daily' },
      sampleFrom
    )
  } catch {
    sample = null
  }
  const { hour, minute } = parseLocalTime(input.localTime)
  const timeLabel = sample
    ? formatTimeInZone(sample, input.timezone)
    : `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`

  switch (input.frequency) {
    case 'once': {
      if (!input.onceOn) return `Once at ${timeLabel}`
      const [y, m, d] = input.onceOn.split('-').map(Number)
      const onceDate = zonedWallClockToUtc(y, m, d, hour, minute, 0, input.timezone)
      const dateLabel = new Intl.DateTimeFormat('en-US', {
        timeZone: input.timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(onceDate)
      return `Once on ${dateLabel} at ${formatTimeInZone(onceDate, input.timezone)}`
    }
    case 'daily':
      return `Daily at ${timeLabel}`
    case 'weekdays':
      return `Weekdays at ${timeLabel}`
    case 'weekly': {
      const day = input.weekday != null ? WEEKDAY_NAMES[input.weekday] : 'selected day'
      return `Weekly on ${day} at ${timeLabel}`
    }
    case 'monthly': {
      const day = input.monthday != null ? ordinal(input.monthday) : 'selected day'
      return `Monthly on the ${day} at ${timeLabel}`
    }
    case 'yearly': {
      const month = input.month != null ? MONTH_NAMES[input.month - 1] : 'selected month'
      const day = input.monthday != null ? String(input.monthday) : '1'
      return `Yearly on ${month} ${day} at ${timeLabel}`
    }
    default:
      return timeLabel
  }
}

export function scheduleFromAutomation(row: {
  frequency: string
  timezone: string
  local_time: string
  weekday: number | null
  monthday: number | null
  month: number | null
  once_on: string | null
}): ScheduleInput {
  return {
    frequency: row.frequency as AutomationFrequency,
    timezone: row.timezone,
    localTime: row.local_time,
    weekday: row.weekday ?? undefined,
    monthday: row.monthday ?? undefined,
    month: row.month ?? undefined,
    onceOn: row.once_on ?? undefined,
  }
}
