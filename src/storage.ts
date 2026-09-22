import type { StatsState } from './stats'
import { emptyStatsState, pruneStats } from './stats'
import { writeStorage } from './quota'

export type Mode = 'prose' | 'world' | 'character' | 'plot'
export type LoreMode = Exclude<Mode, 'prose'> | 'timeline'

export interface Chapter {
  id: string
  title: string
  outline?: string
  content: string
  updatedAt: string
  /** 本章正文字数目标；不设置时不显示进度。 */
  wordGoal?: number
  history?: ChapterVersion[]
  proseCandidates?: ChapterProseCandidate[]
  /** 旧版单候选字段，仅用于读取迁移。 */
  proseCandidate?: Omit<ChapterProseCandidate, 'id' | 'kind'>
}

export interface ChapterProseCandidate {
  id: string
  content: string
  instruction: string
  createdAt: string
  /** 生成时章节正文的更新时间，用于提示候选稿可能已过期。 */
  baseUpdatedAt: string
  kind: 'continue' | 'rewrite'
}

export interface ChapterVersion {
  id: string
  title: string
  content: string
  savedAt: string
  source: 'manual' | 'ai' | 'restore'
}

export interface Lore {
  id: string
  title: string
  content: string
  mode: LoreMode
  /** 时间线条目的故事内时间或顺序。 */
  timeLabel?: string
}

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  mode: Mode
  content: string
  chapterId?: string
  adopted?: boolean
}

export interface Book {
  id: string
  title: string
  premise: string
  chapters: Chapter[]
  lore: Lore[]
  chat: ChatEntry[]
  updatedAt: string
}

export interface ModelSettings {
  baseUrl: string
  model: string
  apiKey: string
}

export interface InspirationNote {
  id: string
  content: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectData {
  version: 1 | 2
  books: Book[]
  model: ModelSettings
  /** 按天聚合的写作统计；v1 数据读取时补默认值。 */
  stats: StatsState
  /** 灵感随手记，可送入建书工作流。 */
  notes: InspirationNote[]
}

const STORAGE_KEY = 'novel-workbench-next/v1'
/** 主数据损坏时的暂存键：原文先搬到这里，随后的自动保存就没有机会把它覆盖掉 */
const CORRUPT_STORAGE_KEY = 'novel-workbench-next/v1-corrupt'
/** 损坏原文最多暂存几份，避免暂存键无限堆积把共享配额占满 */
const CORRUPT_STASH_SLOTS = 3

/** 最近一次 loadData 检出的损坏提示；App 启动时取走弹给用户，不能让「空白工作台」没有任何解释 */
let corruptDataNotice: string | null = null
/** 损坏原文没能暂存、还留在主键里：此时拒绝写入，宁可保存失败也不抹掉唯一副本 */
let corruptDataProtected = false

/** 取走一次「检测到损坏数据」提示；没有损坏时返回 null。 */
export function takeCorruptDataNotice(): string | null {
  const notice = corruptDataNotice
  corruptDataNotice = null
  return notice
}

/** 用户显式恢复备份时调用：确认过覆盖后果后，允许写入取代主键里的损坏原文。 */
export function releaseCorruptDataProtection(): void {
  corruptDataProtected = false
}

export function loadData(): ProjectData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw)
      const normalized = normalizeProjectData(parsed)
      if (normalized) {
        for (const book of normalized.books) for (const chapter of book.chapters) migrateProseCandidates(chapter)
        return normalized
      }
    } catch { /* 解析失败与结构不符都按损坏处理，走下面的暂存逻辑 */ }
    preserveCorruptData(raw)
  }
  return { version: 2, books: [], model: { baseUrl: '', model: '', apiKey: '' }, stats: emptyStatsState(), notes: [] }
}

/** 损坏原文搬去暂存键：主键留给新的空状态，350ms 后的自动保存再也碰不到它 */
function preserveCorruptData(raw: string): void {
  for (let slot = 1; slot <= CORRUPT_STASH_SLOTS; slot += 1) {
    const key = slot === 1 ? CORRUPT_STORAGE_KEY : `${CORRUPT_STORAGE_KEY}-${slot}`
    if (localStorage.getItem(key) !== null) continue
    try {
      localStorage.setItem(key, raw)
      localStorage.removeItem(STORAGE_KEY)
      corruptDataNotice = `检测到本地数据损坏，原文已暂存到本地存储的「${key}」键，不会被自动保存覆盖。本次以空白工作台打开。`
      return
    } catch {
      // 暂存键也写不进去（配额被其他键占满）：原文留在主键，靠拒绝写入保住
      corruptDataProtected = true
      corruptDataNotice = '检测到本地数据损坏，但暂存失败（存储空间不足）。请先导出备份并清理存储空间，在此之前不会自动保存。'
      return
    }
  }
  corruptDataProtected = true
  corruptDataNotice = '检测到本地数据损坏，但损坏暂存区已满。请先导出备份并清理旧数据，在此之前不会自动保存。'
}

export function saveData(data: ProjectData): void {
  if (corruptDataProtected) throw new Error('保存失败：本地数据仍处于损坏状态，请先导出备份再清理')
  writeStorage(STORAGE_KEY, data)
}

export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()

export function normalizeStats(value: unknown): StatsState {
  const state = emptyStatsState()
  if (!value || typeof value !== 'object') return state
  const source = value as Partial<StatsState>
  if (Array.isArray(source.days)) {
    state.days = source.days.filter(day => day && typeof day.date === 'string' &&
      Number.isFinite(Date.parse(`${day.date}T00:00:00`)) &&
      typeof day.manual === 'number' && Number.isFinite(day.manual) &&
      typeof day.ai === 'number' && Number.isFinite(day.ai))
      .map(day => ({
        date: day.date,
        manual: Math.max(0, Math.round(day.manual)),
        ai: Math.max(0, Math.round(day.ai)),
        books: Object.fromEntries(Object.entries(day.books || {})
          .filter(([, value]) => value && Number.isFinite(value.manual) && Number.isFinite(value.ai))
          .map(([bookId, value]) => [bookId, { manual: Math.max(0, Math.round(value.manual)), ai: Math.max(0, Math.round(value.ai)) }])),
      }))
    pruneStats(state)
  }
  if (typeof source.dailyGoal === 'number' && Number.isFinite(source.dailyGoal) && source.dailyGoal > 0) {
    state.dailyGoal = Math.min(100000, Math.round(source.dailyGoal))
  }
  return state
}

export function normalizeNotes(value: unknown): InspirationNote[] {
  if (!Array.isArray(value)) return []
  return value.filter(item => item && typeof item.id === 'string' && typeof item.content === 'string' &&
    typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)))
    .slice(0, 500)
    .map(item => ({
      id: item.id,
      content: item.content,
      tags: Array.isArray(item.tags) ? item.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim()).slice(0, 12).map((tag: string) => tag.trim().slice(0, 20)) : [],
      pinned: !!item.pinned,
      createdAt: item.createdAt,
      updatedAt: typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) ? item.updatedAt : item.createdAt,
    }))
}

export function normalizeProjectData(value: unknown): ProjectData | null {
  if (!isProjectData(value)) return null
  return {
    version: 2,
    books: normalizeBooks(value.books),
    model: value.model,
    stats: normalizeStats(value.stats),
    notes: normalizeNotes(value.notes),
  }
}

const LORE_MODES: LoreMode[] = ['world', 'character', 'plot', 'timeline']
const CHAT_MODES: Mode[] = ['prose', 'world', 'character', 'plot']

const asText = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback
const asTimestamp = (value: unknown, fallback: string) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback

/** 章节级校验：手改或损坏的 localStorage、畸形备份都从这里过一遍，坏字段就地修复而不是带病上线 */
export function normalizeBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) return []
  return value.filter(item => item && typeof item === 'object').map((book: Partial<Book>) => {
    const updatedAt = asTimestamp(book.updatedAt, now())
    const chapters = (Array.isArray(book.chapters) ? book.chapters : [])
      .filter(item => item && typeof item === 'object')
      .map((item: Partial<Chapter>) => {
        const chapter: Chapter = {
          id: asText(item.id, '') || uid(),
          title: asText(item.title, '未命名章节'),
          outline: asText(item.outline, ''),
          content: asText(item.content, ''),
          updatedAt: asTimestamp(item.updatedAt, updatedAt),
        }
        if (typeof item.wordGoal === 'number' && Number.isFinite(item.wordGoal) && item.wordGoal > 0) chapter.wordGoal = item.wordGoal
        if (Array.isArray(item.history)) {
          chapter.history = item.history.filter((version: Partial<ChapterVersion>) => version && typeof version === 'object' &&
            typeof version.content === 'string' && typeof version.title === 'string')
        }
        if (item.proseCandidates !== undefined) chapter.proseCandidates = item.proseCandidates as Chapter['proseCandidates']
        if (item.proseCandidate !== undefined) chapter.proseCandidate = item.proseCandidate
        return chapter
      })
    const lore = (Array.isArray(book.lore) ? book.lore : [])
      .filter(item => item && typeof item === 'object' && typeof item.title === 'string' &&
        typeof item.content === 'string' && LORE_MODES.includes(item.mode as LoreMode))
      .map((item: Partial<Lore>) => ({ id: asText(item.id, '') || uid(), title: item.title as string, content: item.content as string,
        mode: item.mode as LoreMode, timeLabel: asText(item.timeLabel, '') || undefined }))
    const chat = (Array.isArray(book.chat) ? book.chat : [])
      .filter(item => item && typeof item === 'object' && typeof item.content === 'string' &&
        ['user', 'assistant'].includes(item.role as string) && CHAT_MODES.includes(item.mode as Mode))
      .map((item: Partial<ChatEntry>) => ({ id: asText(item.id, '') || uid(), role: item.role as ChatEntry['role'],
        mode: item.mode as ChatEntry['mode'], content: item.content as string,
        chapterId: asText(item.chapterId, '') || undefined, adopted: !!item.adopted }))
    return {
      id: asText(book.id, '') || uid(),
      title: asText(book.title, '未命名作品'),
      premise: asText(book.premise, ''),
      chapters,
      lore,
      chat,
      updatedAt,
    }
  })
}

/** 兼容此前的单候选作品，并过滤备份中的无效候选。 */
export function migrateProseCandidates(chapter: Chapter): void {
  const source = Array.isArray(chapter.proseCandidates) && chapter.proseCandidates.length ? chapter.proseCandidates : chapter.proseCandidate ? [chapter.proseCandidate] : []
  const normalized = source.filter(item => item && typeof item.content === 'string' &&
    typeof item.instruction === 'string' && typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) && typeof item.baseUpdatedAt === 'string')
    .map(item => ({ id: 'id' in item && typeof item.id === 'string' && item.id ? item.id : uid(),
      content: item.content, instruction: item.instruction, createdAt: item.createdAt,
      baseUpdatedAt: item.baseUpdatedAt,
      kind: 'kind' in item && item.kind === 'rewrite' ? 'rewrite' : 'continue' } satisfies ChapterProseCandidate))
  if (normalized.length) chapter.proseCandidates = normalized
  else delete chapter.proseCandidates
  delete chapter.proseCandidate
}

/** 留存章稿，跳过与最新版本相同的内容，并限制浏览器内的历史体积。 */
export function recordChapterVersion(chapter: Chapter, source: ChapterVersion['source']): ChapterVersion | null {
  const history = chapter.history ||= []
  const latest = history[0]
  if (latest?.title === chapter.title && latest.content === chapter.content) return null
  const version: ChapterVersion = { id: uid(), title: chapter.title, content: chapter.content, savedAt: now(), source }
  history.unshift(version)
  if (history.length > 30) history.length = 30
  return version
}

export function createBook(title: string): Book {
  return {
    id: uid(), title: title.trim(), premise: '',
    chapters: [{ id: uid(), title: '第一章', content: '', updatedAt: now() }],
    lore: [], chat: [], updatedAt: now(),
  }
}

export function isProjectData(value: unknown): value is ProjectData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<ProjectData>
  return (data.version === 1 || data.version === 2) && Array.isArray(data.books) &&
    data.books.every(book => typeof book?.id === 'string' && typeof book?.title === 'string' &&
      Array.isArray(book?.chapters) && Array.isArray(book?.lore) && Array.isArray(book?.chat)) &&
    typeof data.model?.baseUrl === 'string' && typeof data.model?.model === 'string' &&
    typeof data.model?.apiKey === 'string'
}

/** 导入时重建所有 ID，避免与现有作品碰撞；不导入任何模型密钥。 */
export function importBookJson(value: unknown): Book {
  if (!value || typeof value !== 'object') throw new Error('不是有效的作品文件')
  const payload = value as { format?: unknown; book?: unknown }
  if (payload.format !== 'novel-workbench-next/book-v1' || !payload.book || typeof payload.book !== 'object') {
    throw new Error('文件格式不受支持。请使用新版工作台导出的 JSON 作品文件。')
  }
  const source = payload.book as Partial<Book>
  if (typeof source.title !== 'string' || !source.title.trim() || !Array.isArray(source.chapters) || !source.chapters.length ||
      !source.chapters.every(item => item && typeof item.title === 'string' && typeof item.content === 'string') ||
      !Array.isArray(source.lore) || !source.lore.every(item => item && typeof item.title === 'string' &&
        typeof item.content === 'string' && ['world', 'character', 'timeline', 'plot'].includes(item.mode))) {
    throw new Error('作品缺少必要章节或设定字段，无法导入。')
  }
  const chapterIds = new Map<string, string>()
  const chapters = source.chapters.map(item => {
    const id = uid()
    const updatedAt = now()
    chapterIds.set(String(item.id), id)
    const history = Array.isArray(item.history) ? item.history.filter(version => version &&
      typeof version.title === 'string' && typeof version.content === 'string' &&
      typeof version.savedAt === 'string' && Number.isFinite(Date.parse(version.savedAt)) &&
      ['manual', 'ai', 'restore'].includes(version.source))
      .slice(0, 30).map(version => ({ id: uid(), title: version.title, content: version.content,
        savedAt: version.savedAt, source: version.source })) : []
    const chapter: Chapter = { id, title: item.title, outline: typeof item.outline === 'string' ? item.outline : '', content: item.content, updatedAt, history,
      wordGoal: typeof item.wordGoal === 'number' && Number.isFinite(item.wordGoal) && item.wordGoal > 0 ? Math.min(1000000, Math.round(item.wordGoal)) : undefined,
      proseCandidates: item.proseCandidates, proseCandidate: item.proseCandidate }
    migrateProseCandidates(chapter)
    for (const candidate of chapter.proseCandidates || []) {
      candidate.id = uid()
      if (candidate.baseUpdatedAt === item.updatedAt) candidate.baseUpdatedAt = updatedAt
    }
    return chapter
  })
  const lore = source.lore.map(item => ({ id: uid(), title: item.title, content: item.content,
    mode: item.mode, timeLabel: typeof item.timeLabel === 'string' ? item.timeLabel : undefined }))
  const chat = Array.isArray(source.chat)
    ? source.chat.filter(item => item && ['user', 'assistant'].includes(item.role) &&
        ['prose', 'world', 'character', 'plot'].includes(item.mode) && typeof item.content === 'string')
      .map(item => ({ id: uid(), role: item.role, mode: item.mode, content: item.content,
        chapterId: chapterIds.get(String(item.chapterId || '')), adopted: !!item.adopted }))
    : []
  return { id: uid(), title: source.title.trim(), premise: typeof source.premise === 'string' ? source.premise : '',
    chapters, lore, chat, updatedAt: now() }
}
