/** 写作统计：按天聚合正文字数，区分手写与 AI 采纳来源。 */

export type StatsSource = 'manual' | 'ai'

export interface DayBookStats { manual: number; ai: number }
export interface DayStats { date: string; manual: number; ai: number; books: Record<string, DayBookStats> }
export interface StatsState { days: DayStats[]; dailyGoal: number }

export const DEFAULT_DAILY_GOAL = 2000
export const MAX_STATS_DAYS = 400

/** 本地时区的 YYYY-MM-DD；统计按读者所在的一天计算。 */
export function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function emptyStatsState(): StatsState {
  return { days: [], dailyGoal: DEFAULT_DAILY_GOAL }
}

export function dayTotal(day: DayStats | undefined): number {
  return day ? day.manual + day.ai : 0
}

function findDay(days: DayStats[], date: string): DayStats {
  let day = days.find(item => item.date === date)
  if (!day) {
    day = { date, manual: 0, ai: 0, books: {} }
    days.push(day)
    days.sort((a, b) => a.date.localeCompare(b.date))
  }
  return day
}

/** 记录一次字数增长；只记净增，删除文本不计入。 */
export function recordWords(state: StatsState, args: { date: string; bookId: string; source: StatsSource; chars: number }): void {
  const chars = Math.round(args.chars)
  if (!args.date || !args.bookId || chars <= 0) return
  const day = findDay(state.days, args.date)
  const book = day.books[args.bookId] || (day.books[args.bookId] = { manual: 0, ai: 0 })
  book[args.source] += chars
  day[args.source] += chars
  pruneStats(state)
}

/** 只保留最近若干天，避免本机存储无限增长。 */
export function pruneStats(state: StatsState, keepDays = MAX_STATS_DAYS): void {
  if (state.days.length <= keepDays) return
  state.days.sort((a, b) => a.date.localeCompare(b.date))
  state.days = state.days.slice(-keepDays)
}

export interface TrendPoint { date: string; manual: number; ai: number; total: number }

/** 以 endDate 结束、向前 span 天的趋势序列，没有记录的日子补零。 */
export function trendSeries(days: DayStats[], endDate: Date, span: number, bookId?: string): TrendPoint[] {
  const pick = (date: string): DayBookStats => {
    const day = days.find(item => item.date === date)
    if (!day) return { manual: 0, ai: 0 }
    if (!bookId) return { manual: day.manual, ai: day.ai }
    return day.books[bookId] || { manual: 0, ai: 0 }
  }
  const points: TrendPoint[] = []
  for (let offset = span - 1; offset >= 0; offset--) {
    const date = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - offset)
    const key = dateKey(date)
    const value = pick(key)
    points.push({ date: key, manual: value.manual, ai: value.ai, total: value.manual + value.ai })
  }
  return points
}

/** 连续写作天数；今天还没写时从昨天算起，避免刚过午夜就断档。 */
export function currentStreak(days: DayStats[], today: Date, bookId?: string): number {
  const written = new Set(days.filter(day => {
    if (bookId) return (day.books[bookId]?.manual || 0) + (day.books[bookId]?.ai || 0) > 0
    return dayTotal(day) > 0
  }).map(day => day.date))
  if (!written.size) return 0
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!written.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (written.has(dateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function totalsFor(days: DayStats[], bookId?: string): { manual: number; ai: number; total: number } {
  const totals = days.reduce((sum, day) => {
    const value = bookId ? day.books[bookId] : { manual: day.manual, ai: day.ai }
    return { manual: sum.manual + (value?.manual || 0), ai: sum.ai + (value?.ai || 0) }
  }, { manual: 0, ai: 0 })
  return { ...totals, total: totals.manual + totals.ai }
}

export interface CalendarCell { date: string; inMonth: boolean; total: number; isToday: boolean }

/** 以周一开头的月历网格，覆盖 6 行，附带当月强度与今天标记。 */
export function monthMatrix(days: DayStats[], year: number, month: number, today: Date, bookId?: string): CalendarCell[][] {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const totalFor = (date: string): number => {
    const day = days.find(item => item.date === date)
    if (!day) return 0
    if (bookId) return (day.books[bookId]?.manual || 0) + (day.books[bookId]?.ai || 0)
    return dayTotal(day)
  }
  const todayKeyValue = dateKey(today)
  const weeks: CalendarCell[][] = []
  for (let week = 0; week < 6; week++) {
    const row: CalendarCell[] = []
    for (let day = 0; day < 7; day++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day)
      const key = dateKey(date)
      row.push({ date: key, inMonth: date.getMonth() === month, total: totalFor(key), isToday: key === todayKeyValue })
    }
    weeks.push(row)
  }
  return weeks
}

/** 0—4 的热度级别，用于日历着色。 */
export function heatLevel(total: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0) return 0
  if (total < 500) return 1
  if (total < 1500) return 2
  if (total < 3000) return 3
  return 4
}

/** 恢复备份时合并统计：按天相加，保留较大的目标值。 */
export function mergeStats(base: StatsState, incoming: StatsState): StatsState {
  const merged: StatsState = { dailyGoal: Math.max(base.dailyGoal, incoming.dailyGoal), days: base.days.map(day => ({ ...day, books: { ...day.books } })) }
  for (const day of incoming.days) {
    const target = findDay(merged.days, day.date)
    target.manual += day.manual
    target.ai += day.ai
    for (const [bookId, value] of Object.entries(day.books || {})) {
      const book = target.books[bookId] || (target.books[bookId] = { manual: 0, ai: 0 })
      book.manual += value.manual || 0
      book.ai += value.ai || 0
    }
  }
  pruneStats(merged)
  return merged
}

/** 丢弃已删除作品的统计，避免书架删书后仍占用日历格子。 */
export function pruneStatsBooks(state: StatsState, bookIds: Set<string>): boolean {
  let changed = false
  for (const day of state.days) {
    for (const bookId of Object.keys(day.books)) {
      if (!bookIds.has(bookId)) { delete day.books[bookId]; changed = true }
    }
  }
  return changed
}
