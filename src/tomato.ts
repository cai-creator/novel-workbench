export interface TomatoSettings {
  baseUrl: string
  password: string
}

export interface TomatoBookPreview {
  bookId: string
  title: string
  author: string
  description: string
  chapterCount: number
  wordCount: number
  coverUrl: string
  finished: boolean
  category: string
}

export interface TomatoJob {
  id: number
  bookId: string
  title: string
  author: string
  state: string
  message: string
  progress: { current: number; total: number; percent: number }
  updatedMs: number
}

export interface TomatoLibraryItem {
  kind: 'file' | 'dir'
  name: string
  relPath: string
  ext: string
  size: number
  modifiedMs: number | null
}

const SETTINGS_KEY = 'novel-workbench-next/tomato-downloader-v1'
const ACTIVE_JOB_KEY = 'novel-workbench-next/tomato-active-job-v1'
export const defaultTomatoSettings: TomatoSettings = {
  baseUrl: 'http://127.0.0.1:18423',
  password: '',
}

export function loadTomatoSettings(): TomatoSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<TomatoSettings>
    return {
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim() ? parsed.baseUrl.trim().replace(/\/+$/, '') : defaultTomatoSettings.baseUrl,
      password: typeof parsed.password === 'string' ? parsed.password : '',
    }
  } catch {
    return { ...defaultTomatoSettings }
  }
}

export function saveTomatoSettings(settings: TomatoSettings) {
  const normalized = {
    baseUrl: settings.baseUrl.trim().replace(/\/+$/, '') || defaultTomatoSettings.baseUrl,
    password: settings.password,
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized))
}

export function saveTomatoJobSnapshot(job: TomatoJob) {
  try {
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({
      id: job.id,
      bookId: job.bookId,
      title: job.title,
      author: job.author,
      state: job.state,
      message: job.message,
      progress: job.progress,
      updatedMs: job.updatedMs,
    }))
  } catch { /* 任务状态保存失败不应中断下载 */ }
}

export function loadTomatoJobSnapshot(bookId?: string): TomatoJob | null {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVE_JOB_KEY) || 'null') as Partial<TomatoJob> | null
    if (!raw || typeof raw.id !== 'number' || (bookId && raw.bookId !== bookId)) return null
    return {
      id: raw.id,
      bookId: String(raw.bookId || ''),
      title: String(raw.title || ''),
      author: String(raw.author || ''),
      state: String(raw.state || 'Unknown'),
      message: String(raw.message || ''),
      progress: raw.progress && typeof raw.progress === 'object' ? {
        current: Number(raw.progress.current) || 0,
        total: Number(raw.progress.total) || 0,
        percent: Number(raw.progress.percent) || 0,
      } : { current: 0, total: 0, percent: 0 },
      updatedMs: Number(raw.updatedMs) || 0,
    }
  } catch {
    return null
  }
}

export function clearTomatoJobSnapshot() {
  try { localStorage.removeItem(ACTIVE_JOB_KEY) } catch { /* ignore */ }
}

function servicePrefix(settings: TomatoSettings) {
  const base = settings.baseUrl.trim().replace(/\/+$/, '') || defaultTomatoSettings.baseUrl
  // The bundled dev/preview proxy avoids browser CORS for the default local server.
  if (/^https?:\/\/127\.0\.0\.1:18423$/i.test(base) || /^https?:\/\/localhost:18423$/i.test(base)) return '/tomato-proxy'
  return base
}

function endpoint(settings: TomatoSettings, path: string) {
  return `${servicePrefix(settings)}${path.startsWith('/') ? path : `/${path}`}`
}

async function tomatoRequest<T>(settings: TomatoSettings, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (settings.password.trim()) headers.set('x-tomato-password', settings.password.trim())
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(endpoint(settings, path), { ...init, headers })
      if (!response.ok) {
        const detail = (await response.text()).trim().slice(0, 240)
        throw new Error(`番茄下载器请求失败（HTTP ${response.status}）${detail ? `：${detail}` : ''}`)
      }
      return await response.json() as T
    } catch (error) {
      lastError = error
      if (init.signal?.aborted || error instanceof DOMException && error.name === 'AbortError') throw error
      if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 450 * (attempt + 1)))
    }
  }
  if (lastError instanceof Error && /番茄下载器请求失败/.test(lastError.message)) throw lastError
  throw new Error('无法连接番茄下载器，请确认服务仍在运行并检查地址、端口和密码。')
}

export async function checkTomatoService(settings: TomatoSettings) {
  return await tomatoRequest<Record<string, unknown>>(settings, '/api/status')
}

export async function previewTomatoBook(settings: TomatoSettings, bookId: string): Promise<TomatoBookPreview> {
  const raw = await tomatoRequest<Record<string, unknown>>(settings, `/api/preview/${encodeURIComponent(bookId)}`)
  return {
    bookId: String(raw.book_id ?? bookId),
    title: String(raw.book_name ?? raw.title ?? ''),
    author: String(raw.author ?? ''),
    description: String(raw.description ?? ''),
    chapterCount: Number(raw.chapter_count ?? 0) || 0,
    wordCount: Number(raw.word_count ?? 0) || 0,
    coverUrl: String(raw.cover_url ?? ''),
    finished: Boolean(raw.finished),
    category: String(raw.category ?? ''),
  }
}

export async function createTomatoJob(settings: TomatoSettings, bookId: string, rangeStart?: number, rangeEnd?: number): Promise<{ id: number; bookId: string; state: string }> {
  const body: Record<string, unknown> = { book_id: bookId }
  if (rangeStart && rangeEnd) {
    body.range_start = rangeStart
    body.range_end = rangeEnd
  }
  const raw = await tomatoRequest<Record<string, unknown>>(settings, '/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { id: Number(raw.id), bookId: String(raw.book_id ?? bookId), state: String(raw.state ?? 'Queued') }
}

function normalizeProgress(raw: unknown) {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const current = Number(value.current ?? value.completed ?? value.done ?? value.saved_chapters ?? value.group_done ?? 0) || 0
  const total = Number(value.total ?? value.count ?? value.chapter_total ?? value.group_total ?? 0) || 0
  const percent = Number(value.percent ?? (total ? current / total * 100 : 0)) || 0
  return { current, total, percent: Math.max(0, Math.min(100, percent)) }
}

export function normalizeTomatoJob(raw: Record<string, unknown>): TomatoJob {
  return {
    id: Number(raw.id) || 0,
    bookId: String(raw.book_id ?? ''),
    title: String(raw.title ?? ''),
    author: String(raw.author ?? ''),
    state: String(raw.state ?? 'Unknown'),
    message: String(raw.message ?? ''),
    progress: normalizeProgress(raw.progress),
    updatedMs: Number(raw.updated_ms ?? 0) || 0,
  }
}

export async function getTomatoJob(settings: TomatoSettings, id: number): Promise<TomatoJob | null> {
  const raw = await tomatoRequest<{ items?: Record<string, unknown>[] }>(settings, `/api/jobs?id=${encodeURIComponent(String(id))}`)
  const item = raw.items?.[0]
  return item ? normalizeTomatoJob(item) : null
}

export async function listTomatoLibrary(settings: TomatoSettings): Promise<TomatoLibraryItem[]> {
  const raw = await tomatoRequest<{ items?: Record<string, unknown>[] }>(settings, '/api/library?start=true')
  return (raw.items || []).map(item => ({
    kind: item.kind === 'dir' ? 'dir' : 'file',
    name: String(item.name ?? ''),
    relPath: String(item.rel_path ?? ''),
    ext: String(item.ext ?? '').toLowerCase(),
    size: Number(item.size ?? 0) || 0,
    modifiedMs: item.modified_ms == null ? null : Number(item.modified_ms) || null,
  }))
}

function normalizeBookName(value: string) {
  return value.toLowerCase().replace(/[\s《》“”"'‘’：:·,，。！？!?\-_/\\]/g, '')
}

/** 下载器完成后扫描可能还没结束，最多等待几轮再决定是否提示用户手动选择。 */
export async function findLatestTomatoText(settings: TomatoSettings, title: string, attempts = 6): Promise<TomatoLibraryItem | null> {
  const wanted = normalizeBookName(title)
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const files = (await listTomatoLibrary(settings)).filter(item => item.kind === 'file' && item.ext === 'txt')
    const matched = files
      .filter(item => wanted && normalizeBookName(item.name).includes(wanted))
      .sort((a, b) => (b.modifiedMs || 0) - (a.modifiedMs || 0))
    if (matched[0]) return matched[0]
    if (attempt === attempts - 1 && files.length) return files.sort((a, b) => (b.modifiedMs || 0) - (a.modifiedMs || 0))[0]
    await new Promise(resolve => setTimeout(resolve, 900))
  }
  return null
}

export async function fetchTomatoText(settings: TomatoSettings, relPath: string): Promise<Uint8Array> {
  const headers = new Headers()
  if (settings.password.trim()) headers.set('x-tomato-password', settings.password.trim())
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(tomatoDownloadUrl(settings, relPath), { headers })
      if (!response.ok) throw new Error(`下载 TXT 失败（HTTP ${response.status}）`)
      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      lastError = error
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 450 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('无法下载番茄 TXT 文件')
}

export function tomatoDownloadUrl(settings: TomatoSettings, relPath: string) {
  const encoded = relPath.split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/')
  return `${servicePrefix(settings)}/download/${encoded}`
}

export async function cancelTomatoJob(settings: TomatoSettings, id: number) {
  await tomatoRequest(settings, `/api/jobs/${encodeURIComponent(String(id))}/cancel`, { method: 'POST' })
}
