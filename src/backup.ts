import type { Book, Chapter, ProjectData } from './storage'
import { normalizeProjectData } from './storage'
import { pruneStats, type DayStats, type StatsState } from './stats'
import type { WorkflowArchive, WorkflowRecord } from './workflow'
import { normalizeDraft } from './workflow'
import { mergeRankSnapshots, rankSnapshotsFromBackup, type RankSnapshotDoc } from './rank'
import { breakdownProjectsFromBackup, mergeBreakdownProjects, type BreakdownProject } from './breakdown'

export const BACKUP_FORMAT = 'novel-workbench-next/backup-v1'
export const BACKUP_SIZE_LIMIT = 50 * 1024 * 1024

export interface WorkspaceBackup {
  format: typeof BACKUP_FORMAT
  exportedAt: string
  counts: { books: number; chapters: number; notes: number; records: number }
  data: ProjectData
  workflow?: WorkflowArchive
  /** 扫榜快照：天天攒出来的趋势数据，清浏览器前只能靠备份留住 */
  rank?: { snapshots: RankSnapshotDoc[] }
  /** 竞品拆书库：带章节正文与全部分析结果，单独占一份 */
  breakdown?: { projects: BreakdownProject[] }
}

export interface RestoreSummary {
  addedBooks: number
  keptBooks: number
  addedNotes: number
  addedRecords: number
  changedDays: number
}

const backupCounts = (data: ProjectData, workflow?: WorkflowArchive) => ({
  books: data.books.length,
  chapters: data.books.reduce((sum, item) => sum + item.chapters.length, 0),
  notes: data.notes.length,
  records: workflow?.records.length ?? 0,
})

export function buildWorkspaceBackup(
  data: ProjectData,
  workflow: WorkflowArchive | undefined,
  exportedAt: string,
  side?: { rank?: RankSnapshotDoc[]; breakdown?: BreakdownProject[] }
): WorkspaceBackup {
  return {
    format: BACKUP_FORMAT,
    exportedAt,
    counts: backupCounts(data, workflow),
    data,
    workflow,
    rank: side?.rank?.length ? { snapshots: side.rank } : undefined,
    breakdown: side?.breakdown?.length ? { projects: side.breakdown } : undefined,
  }
}

export function serializeWorkspaceBackup(backup: WorkspaceBackup): string {
  return JSON.stringify(backup, null, 2)
}

function normalizeBackupRecord(value: unknown): WorkflowRecord | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<WorkflowRecord>
  if (typeof source.id !== 'string' || !source.id) return null
  if (source.status !== 'draft' && source.status !== 'completed') return null
  if (typeof source.updatedAt !== 'string' || !Number.isFinite(Date.parse(source.updatedAt))) return null
  if (!source.draft || typeof source.draft !== 'object') return null
  // draft 归一后再入库：缺字段补空、step 越界重置，历史列表与建书页不会再被畸形备份冻结
  return {
    id: source.id,
    status: source.status,
    draft: normalizeDraft(source.draft),
    updatedAt: source.updatedAt,
    completedAt: typeof source.completedAt === 'string' && Number.isFinite(Date.parse(source.completedAt)) ? source.completedAt : undefined,
    bookId: typeof source.bookId === 'string' ? source.bookId : undefined,
  }
}

function normalizeBackupWorkflow(value: unknown): WorkflowArchive | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Partial<WorkflowArchive>
  if (!Array.isArray(source.records)) return undefined
  const records = source.records.map(normalizeBackupRecord).filter((item): item is WorkflowRecord => item !== null)
  return { version: 2, activeId: typeof source.activeId === 'string' ? source.activeId : null, records }
}

/** 解析备份文件；内层作品数据会走与本地加载相同的归一化流程。 */
export function parseWorkspaceBackup(value: unknown): WorkspaceBackup | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<WorkspaceBackup>
  if (candidate.format !== BACKUP_FORMAT) return null
  if (typeof candidate.exportedAt !== 'string' || !Number.isFinite(Date.parse(candidate.exportedAt))) return null
  const data = normalizeProjectData(candidate.data)
  if (!data) return null
  const workflow = normalizeBackupWorkflow(candidate.workflow)
  const rank = rankSnapshotsFromBackup(candidate.rank)
  const breakdown = breakdownProjectsFromBackup(candidate.breakdown)
  return {
    format: BACKUP_FORMAT,
    exportedAt: candidate.exportedAt,
    counts: backupCounts(data, workflow),
    data,
    workflow,
    rank: rank.length ? { snapshots: rank } : undefined,
    breakdown: breakdown.length ? { projects: breakdown } : undefined,
  }
}

function findDay(days: DayStats[], date: string): DayStats | undefined {
  return days.find(item => item.date === date)
}

/** 恢复用合并：同一天只保留较大值，避免同一台设备的备份被重复累计。 */
function mergeStatsKeepLarger(base: StatsState, incoming: StatsState): { stats: StatsState; changedDays: number } {
  // 每日目标跟模型设置一样以当前设备为准：取较大值会让半年前备份里的大目标悄悄覆盖用户现在的设定
  const merged: StatsState = { dailyGoal: base.dailyGoal, days: base.days.map(day => ({ ...day, books: { ...day.books } })) }
  let changedDays = 0
  for (const day of incoming.days) {
    const target = findDay(merged.days, day.date)
    if (!target) {
      merged.days.push({ date: day.date, manual: day.manual, ai: day.ai, books: { ...day.books } })
      changedDays += 1
      continue
    }
    const before = target.manual + target.ai
    target.manual = Math.max(target.manual, day.manual)
    target.ai = Math.max(target.ai, day.ai)
    for (const [bookId, value] of Object.entries(day.books || {})) {
      const book = target.books[bookId] || (target.books[bookId] = { manual: 0, ai: 0 })
      book.manual = Math.max(book.manual, value.manual || 0)
      book.ai = Math.max(book.ai, value.ai || 0)
    }
    if (target.manual + target.ai !== before) changedDays += 1
  }
  pruneStats(merged)
  return { stats: merged, changedDays }
}

/** 合并恢复：保留当前数据，只补齐备份中不存在的内容；模型设置以当前设备为准。 */
export function mergeWorkspaceBackup(current: ProjectData, incoming: ProjectData): { data: ProjectData; summary: RestoreSummary } {
  const bookIds = new Set(current.books.map(item => item.id))
  const addedBooks = incoming.books.filter(item => !bookIds.has(item.id))
  const noteKeys = new Set(current.notes.map(item => item.id))
  const addedNotes = incoming.notes.filter(item => !noteKeys.has(item.id)).slice(0, Math.max(0, 500 - current.notes.length))
  const { stats, changedDays } = mergeStatsKeepLarger(current.stats, incoming.stats)
  return {
    data: { version: 2, books: [...current.books, ...addedBooks], model: current.model, stats, notes: [...current.notes, ...addedNotes] },
    summary: {
      addedBooks: addedBooks.length,
      keptBooks: current.books.length,
      addedNotes: addedNotes.length,
      addedRecords: 0,
      changedDays,
    },
  }
}

/** 建书记录按 ID 合并，同 ID 保留当前设备的一份。 */
export function mergeWorkflowRecords(current: WorkflowRecord[], incoming: WorkflowRecord[]): { records: WorkflowRecord[]; added: number } {
  const known = new Set(current.map(item => item.id))
  const added = incoming.filter(item => !known.has(item.id))
  return { records: [...current, ...added], added: added.length }
}

export interface SideStoreMerge {
  rank: RankSnapshotDoc[]
  breakdown: BreakdownProject[]
  addedRank: number
  updatedRank: number
  addedBreakdown: number
  updatedBreakdown: number
}

/** 合并扫榜快照与拆书库：同键保留较新的一份，因此除了「新增」还有「更新」，计数要分开报 */
export function mergeSideStores(current: SideStoreInput, incoming: SideStoreInput): SideStoreMerge {
  const currentRank = current.rank || []
  const incomingRank = incoming.rank || []
  const currentProjects = current.breakdown || []
  const incomingProjects = incoming.breakdown || []
  const localRank = new Map(currentRank.map(item => [`${item.sourceId}|${item.statDate}`, item]))
  const localProjects = new Map(currentProjects.map(item => [item.id, item]))
  let addedRank = 0
  let updatedRank = 0
  for (const item of incomingRank) {
    const prev = localRank.get(`${item.sourceId}|${item.statDate}`)
    if (!prev) addedRank += 1
    else if (item.fetchedAt > prev.fetchedAt) updatedRank += 1
  }
  let addedBreakdown = 0
  let updatedBreakdown = 0
  for (const item of incomingProjects) {
    const prev = localProjects.get(item.id)
    if (!prev) addedBreakdown += 1
    else if (item.updateTime > prev.updateTime) updatedBreakdown += 1
  }
  return {
    rank: mergeRankSnapshots(currentRank, incomingRank),
    breakdown: mergeBreakdownProjects(currentProjects, incomingProjects),
    addedRank,
    updatedRank,
    addedBreakdown,
    updatedBreakdown,
  }
}

interface SideStoreInput {
  rank?: RankSnapshotDoc[]
  breakdown?: BreakdownProject[]
}

const normalizeParagraphs = (text: string) => text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()

/** 单章阅读稿：书名与章名作题，正文原样输出。 */
export function chapterToTxt(book: Book, chapter: Chapter): string {
  const title = chapter.title.trim() || '未命名章节'
  const body = normalizeParagraphs(chapter.content)
  return `《${book.title}》\n${title}\n\n${body}\n`
}

/** 整书阅读稿：跳过没有正文的章节。 */
export function bookToTxt(book: Book): string {
  const parts: string[] = [`《${book.title}》`]
  if (book.premise.trim()) parts.push(book.premise.trim())
  for (const chapter of book.chapters) {
    const body = normalizeParagraphs(chapter.content)
    if (!body) continue
    parts.push(`${chapter.title.trim() || '未命名章节'}\n\n${body}`)
  }
  return `${parts.join('\n\n\n')}\n`
}

export function safeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\r\n]+/g, '_').replace(/\s+/g, ' ').trim().replace(/^_+|_+$/g, '')
  return cleaned || fallback
}
