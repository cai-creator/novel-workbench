import { equal, ok, test } from './harness'
import { currentStreak, dateKey, dayTotal, emptyStatsState, heatLevel, MAX_STATS_DAYS, mergeStats, monthMatrix, pruneStats, pruneStatsBooks, recordWords, totalsFor, trendSeries, type DayStats } from '../src/stats'

const day = (date: string, manual: number, ai = 0, books: Record<string, { manual: number; ai: number }> = {}): DayStats => ({ date, manual, ai, books })
const state = (...days: DayStats[]) => ({ days: [...days], dailyGoal: 2000 })

test('recordWords 只记净增并按作品与来源分账', () => {
  const stats = emptyStatsState()
  recordWords(stats, { date: '2026-09-20', bookId: 'b1', source: 'manual', chars: 120 })
  recordWords(stats, { date: '2026-09-20', bookId: 'b1', source: 'ai', chars: 80 })
  recordWords(stats, { date: '2026-09-20', bookId: 'b2', source: 'manual', chars: 30 })
  recordWords(stats, { date: '2026-09-20', bookId: 'b1', source: 'manual', chars: -500 })
  recordWords(stats, { date: '2026-09-20', bookId: '', source: 'manual', chars: 10 })
  recordWords(stats, { date: '', bookId: 'b1', source: 'manual', chars: 10 })
  const target = stats.days[0]
  equal(stats.days.length, 1, '同一天只留一条记录')
  equal(target.manual, 150, '删除不计入，空 ID 被忽略，两部作品相加')
  equal(target.ai, 80)
  equal(target.books, { b1: { manual: 120, ai: 80 }, b2: { manual: 30, ai: 0 } }, '分作品统计与总量一致')
})

test('pruneStats 只保留最近的统计天数', () => {
  const days = Array.from({ length: MAX_STATS_DAYS + 20 }, (_, index) => day(dateKey(new Date(2026, 0, 1 + index)), 1))
  const stats = state(...days)
  pruneStats(stats)
  equal(stats.days.length, MAX_STATS_DAYS)
  equal(stats.days[MAX_STATS_DAYS - 1].date, dateKey(new Date(2026, 0, 1 + MAX_STATS_DAYS + 19)), '留下的是最近的一天')
})

test('trendSeries 按跨度补零并可按作品筛选', () => {
  const days = [day('2026-09-20', 100, 50, { b1: { manual: 100, ai: 50 } }), day('2026-09-22', 200, 0, { b1: { manual: 200, ai: 0 }, b2: { manual: 999, ai: 0 } })]
  const series = trendSeries(days, new Date(2026, 8, 22), 3)
  equal(series.map(point => point.date), ['2026-09-20', '2026-09-21', '2026-09-22'], '没有记录的日子补零')
  equal(series.map(point => point.total), [150, 0, 200])
  const forBook = trendSeries(days, new Date(2026, 8, 22), 3, 'b1')
  equal(forBook.map(point => point.total), [150, 0, 200], '按作品筛选')
  const other = trendSeries(days, new Date(2026, 8, 22), 3, 'b2')
  equal(other.map(point => point.total), [0, 0, 999], '其他作品只统计自己的字数')
})

test('currentStreak 从今天或昨天起算连续天数', () => {
  const days = [day('2026-09-18', 10), day('2026-09-19', 10), day('2026-09-20', 10)]
  equal(currentStreak(days, new Date(2026, 8, 20)), 3, '今天写过就连到今天')
  equal(currentStreak(days, new Date(2026, 8, 21)), 3, '今天还没写时从昨天续上')
  equal(currentStreak(days, new Date(2026, 8, 23)), 0, '断档超过一天归零')
  equal(currentStreak([], new Date(2026, 8, 20)), 0, '没有记录时为 0')
  const split = [day('2026-09-19', 10, 0, { b1: { manual: 10, ai: 0 } }), day('2026-09-20', 10, 0, { b1: { manual: 0, ai: 10 } })]
  equal(currentStreak(split, new Date(2026, 8, 20), 'b1'), 2, '手写与 AI 都算连续')
  equal(currentStreak(split, new Date(2026, 8, 20), 'b2'), 0, '没写过的作品没有连续天数')
})

test('totalsFor 汇总全部或单部作品', () => {
  const days = [day('2026-09-20', 100, 50, { b1: { manual: 100, ai: 50 } }), day('2026-09-21', 200, 0, { b1: { manual: 200, ai: 0 }, b2: { manual: 20, ai: 0 } })]
  equal(totalsFor(days), { manual: 300, ai: 50, total: 350 })
  equal(totalsFor(days, 'b1'), { manual: 300, ai: 50, total: 350 })
  equal(totalsFor(days, 'b2'), { manual: 20, ai: 0, total: 20 })
  equal(totalsFor(days, 'b3'), { manual: 0, ai: 0, total: 0 }, '没有记录的作品为零')
})

test('monthMatrix 以周一开头铺满 6 行并标记今天', () => {
  const weeks = monthMatrix([day('2026-09-01', 300)], 2026, 8, new Date(2026, 8, 22))
  equal(weeks.length, 6, '固定 6 行')
  equal(weeks[0].length, 7)
  equal(weeks[0][0].date, '2026-08-31', '第一行从周一开始')
  equal(weeks[0][0].inMonth, false, '上个月的尾日不算当月')
  const flat = weeks.flat()
  ok(flat.every(cell => cell.date >= '2026-08-31' && cell.date <= '2026-10-11'), '网格覆盖 6 个完整的周')
  equal(flat.filter(cell => cell.inMonth).length, 30, '当月 30 天全部在网格内')
  const today = flat.find(cell => cell.date === '2026-09-22')
  equal(today?.isToday, true, '今天被标记')
  equal(flat.filter(cell => cell.isToday).length, 1, '今天只出现一次')
  equal(flat.find(cell => cell.date === '2026-09-01')?.total, 300, '当月字数带入格子')
  equal(monthMatrix([], 2026, 1, new Date(2026, 1, 10))[2][0].date, '2026-02-09', '2 月同样以周一开头')
})

test('heatLevel 按字数分四级热度', () => {
  equal(heatLevel(0), 0)
  equal(heatLevel(1), 1)
  equal(heatLevel(499), 1)
  equal(heatLevel(500), 2)
  equal(heatLevel(1499), 2)
  equal(heatLevel(1500), 3)
  equal(heatLevel(2999), 3)
  equal(heatLevel(3000), 4)
  equal(heatLevel(99999), 4)
})

test('mergeStats 按天相加并保留较大目标', () => {
  const base = state(day('2026-09-20', 100, 0, { b1: { manual: 100, ai: 0 } }))
  base.dailyGoal = 3000
  const incoming = state(day('2026-09-20', 50, 20, { b1: { manual: 50, ai: 20 } }), day('2026-09-21', 10))
  const merged = mergeStats(base, incoming)
  equal(merged.dailyGoal, 3000, '目标取较大值')
  equal(merged.days.map(item => [item.manual, item.ai]), [[150, 20], [10, 0]], '同一天相加，新一天追加')
  equal(merged.days[0].books.b1, { manual: 150, ai: 20 }, '分作品统计同样相加')
  equal(base.days[0].manual, 100, '合并不改动原状态')
})

test('pruneStatsBooks 丢弃已删除作品的统计', () => {
  const stats = state(day('2026-09-20', 100, 0, { b1: { manual: 100, ai: 0 } }), day('2026-09-21', 10, 0, { b2: { manual: 10, ai: 0 } }))
  equal(pruneStatsBooks(stats, new Set(['b1'])), true, '有删除时返回 true')
  equal(stats.days[0].books, { b1: { manual: 100, ai: 0 } })
  equal(stats.days[1].books, {}, '不存在作品的格子被清空')
  equal(pruneStatsBooks(stats, new Set(['b1', 'b2'])), false, '无事可做时返回 false')
})

test('dayTotal 对空记录返回零', () => {
  equal(dayTotal(undefined), 0)
  equal(dayTotal(day('2026-09-20', 5, 7)), 12)
})
