export type Mode = 'prose' | 'world' | 'character' | 'plot'
export type LoreMode = Exclude<Mode, 'prose'> | 'timeline'

export interface Chapter {
  id: string
  title: string
  content: string
  updatedAt: string
  history?: ChapterVersion[]
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

export interface ProjectData {
  version: 1
  books: Book[]
  model: ModelSettings
}

const STORAGE_KEY = 'novel-workbench-next/v1'

export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()

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

export function loadData(): ProjectData {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (isProjectData(parsed)) return parsed
  } catch { /* 损坏数据保留在浏览器里，避免自动覆盖 */ }
  return { version: 1, books: [], model: { baseUrl: '', model: '', apiKey: '' } }
}

export function saveData(data: ProjectData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function isProjectData(value: unknown): value is ProjectData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<ProjectData>
  return data.version === 1 && Array.isArray(data.books) &&
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
    chapterIds.set(String(item.id), id)
    const history = Array.isArray(item.history) ? item.history.filter(version => version &&
      typeof version.title === 'string' && typeof version.content === 'string' &&
      typeof version.savedAt === 'string' && Number.isFinite(Date.parse(version.savedAt)) &&
      ['manual', 'ai', 'restore'].includes(version.source))
      .slice(0, 30).map(version => ({ id: uid(), title: version.title, content: version.content,
        savedAt: version.savedAt, source: version.source })) : []
    return { id, title: item.title, content: item.content, updatedAt: now(), history }
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
