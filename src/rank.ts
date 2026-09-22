/**
 * 扫榜：抓取/导入榜单快照 → 排名对照、分类分布、标签风向、竞品跟踪、作者趋势，
 * 并让 AI 依据本机快照写榜单解读。移植自 easy-writing 的 local-rank-store /
 * local-rank-analysis / local-rank-crawler，与本项目适配的改动有三：
 * 1. 存储从 IndexedDB 改成本项目的 localStorage 单键方案（与 breakdown.ts 一致）；
 * 2. 番茄 HTML 解析从 DOMParser 改成正则扫描，Node 单测不依赖浏览器环境；
 * 3. 抓取不再依赖 Tauri HTTP：优先走 Vite 内置 /rank-proxy 代理，跨域失败时如实提示，
 *    并保留「粘贴榜单页 HTML / 接口 JSON」的手动导入兜底，快照也能存档互传。
 */

import { fanqieFontDict } from './rank-font-dict'
import {
  findRankCategory,
  findRankCategoryByCode,
  findRankSource,
  RANK_SOURCES,
  rankCategoryOptions,
  rankPlatformOptions,
  type RankSeedSource,
} from './rank-sources'
import { writeStorage } from './quota'

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface RankPlatform {
  code: string
  name: string
  baseUrl?: string
}

export interface RankCategoryOption {
  id: number
  code: string
  name: string
}

export interface RankSource {
  id: number
  siteCode: string
  rankType: string
  title: string
  url: string
  categoryId: number | null
  categoryName: string | null
  categoryCode: string | null
  gender: string | null
  scope: 'all' | 'category'
  metricName: string | null
  metricMode: 'value' | 'none'
}

export interface RankItem {
  rankNo: number
  rankChange: number
  bookTitle: string
  bookId: string | null
  bookUrl: string
  intro: string | null
  authorName: string | null
  statusText: string | null
  metricName: string | null
  metricValue: number
  metricText: string | null
  readingCount: number
  readingText: string | null
  /** 以下四个对照字段由 attachCompare 依据上一份快照补上 */
  prevRankNo?: number | null
  rankChangeDelta?: number | null
  prevMetricValue?: number | null
  metricDelta?: number | null
  coverUrl: string | null
  lastChapterTitle: string | null
  lastChapterUrl: string | null
  lastUpdateTimeText: string | null
  categoryName: string | null
  categorySubName: string | null
}

export type RankSnapshotOrigin = 'crawl' | 'paste' | 'import'

export interface RankSnapshotDoc {
  sourceId: number
  statDate: string
  fetchedAt: number
  pageTitle: string | null
  cutoffText: string | null
  origin: RankSnapshotOrigin
  items: RankItem[]
}

export interface RankSnapshotMeta {
  sourceId: number
  statDate: string
  pageTitle: string | null
  cutoffText: string | null
  itemCount: number
}

export interface RankStore {
  version: 1
  /** 最近浏览过的榜单源（首页快捷入口，去重保序，上限 12） */
  viewedSourceIds: number[]
  snapshots: RankSnapshotDoc[]
}

export interface RankCategorySlice {
  categoryName: string
  count: number
  ratio: number
}

export interface RankCategoryDistribution {
  statDate: string | null
  total: number
  list: RankCategorySlice[]
}

export interface RankTagTrendSeries {
  date: string
  count: number
}

export interface RankTagTrendItem {
  tag: string
  series: RankTagTrendSeries[]
}

export interface RankTagTrend {
  startDate: string
  endDate: string
  days: number
  list: RankTagTrendItem[]
}

export interface RankChangeRow {
  bookId: string | null
  bookTitle: string
  rankNo: number
  rankChange: number
  metricValue: number
  metricText: string | null
}

export interface RankChangeResult {
  statDate: string | null
  compareDate: string | null
  list: RankChangeRow[]
}

export interface RankCompetitorSeries {
  date: string
  rankNo: number | null
  metricValue: number | null
  metricText: string | null
}

export interface RankCompetitorBook {
  bookId: string
  bookTitle: string
  series: RankCompetitorSeries[]
}

export interface RankCompetitorResult {
  startDate: string
  endDate: string
  days: number
  list: RankCompetitorBook[]
}

export interface RankAuthorTrend {
  startDate: string
  endDate: string
  days: number
  list: Array<{ date: string; bookCount: number; metricSum: number; metricAvg: number }>
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

export const RANK_STORAGE_KEY = 'novel-workbench-next/rank-v1'
export const RANK_FILE_FORMAT = 'novel-workbench-next/rank-v1'
export const RANK_RETENTION_DAYS = 120
export const RANK_MAX_SNAPSHOTS = 400
export const RANK_MAX_ITEMS = 200
/** 竞品对比一次最多比对的 ID 数：上限太高会把同步计算和结果渲染拖垮 */
export const RANK_MAX_RIVAL_IDS = 50
export const RANK_MAX_VIEWED_SOURCES = 12
const MANUAL_RECRAWL_MIN_MS = 30 * 60 * 1000
const FETCH_TIMEOUT_MS = 20_000
const PAGE_GAP_MS = 500

export const RANK_TYPE_LABEL: Record<string, string> = {
  reading: '阅读榜',
  new: '新书榜',
  hot: '大热榜',
  collect: '收藏榜',
}

export const RANK_ORIGIN_LABEL: Record<RankSnapshotOrigin, string> = {
  crawl: '在线抓取',
  paste: '手动导入',
  import: '存档导入',
}

const BROWSER_CORS_HINT =
  '浏览器受同源策略限制读不到平台站点。用 pnpm dev 启动（已内置 /rank-proxy 代理）可在线抓榜；或把榜单页 HTML / 接口 JSON 粘贴进来手动导入。'

// ---------------------------------------------------------------------------
// 源清单（种子配置 → 页面消费的形状）
// ---------------------------------------------------------------------------

export { rankPlatformOptions, rankCategoryOptions, findRankCategory, findRankCategoryByCode, findRankSource }

export const rankSourcesFor = (
  siteCode: string,
  filters: { rankType?: string; gender?: string } = {}
): RankSeedSource[] =>
  RANK_SOURCES.filter(source => {
    if (source.siteCode !== siteCode || source.enabled !== 1) return false
    if (filters.rankType && source.rankType !== filters.rankType) return false
    if (filters.gender) {
      const option = toSourceOption(source)
      if (option.gender && option.gender !== filters.gender) return false
    }
    return true
  })

export const toSourceOption = (source: RankSeedSource): RankSource => {
  const category = findRankCategory(source.categoryLegacyId)
  const meta = source.meta || {}
  return {
    id: source.legacyId,
    siteCode: source.siteCode,
    rankType: source.rankType,
    title: source.title || RANK_TYPE_LABEL[source.rankType] || source.rankType,
    url: source.url,
    categoryId: category?.legacyId ?? null,
    categoryName: category?.name ?? null,
    categoryCode: category?.code ?? null,
    gender: (meta.gender as string | undefined) || category?.gender || null,
    scope: (meta.scope as 'all' | 'category' | undefined) || (category ? 'category' : 'all'),
    metricName: (meta.metricName as string | undefined) || (source.siteCode === 'fanqie' ? '在读' : null),
    metricMode: (meta.metricMode as 'value' | 'none' | undefined) || 'value',
  }
}

export const rankSourceLabel = (source: RankSeedSource | RankSource): string => {
  const option = 'categoryName' in source ? (source as RankSource) : toSourceOption(source as RankSeedSource)
  const type = RANK_TYPE_LABEL[option.rankType] || option.title || option.rankType
  const site = option.gender === 'female' ? '女频' : option.gender === 'male' ? '男频' : ''
  return [site, type, option.categoryName || '全站'].filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------------------
// 日期与文本小工具
// ---------------------------------------------------------------------------

export const localDate = (offsetDays = 0): string => {
  // 按日历天数回退而不是减固定毫秒数：夏令时切换日的 ±23/25 小时不会造成日期错位
  const date = new Date()
  date.setDate(date.getDate() - offsetDays)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const dateRange = (days: number, endDate?: string): string[] => {
  const end = endDate || localDate()
  const list: string[] = []
  const endTime = new Date(`${end}T00:00:00`).getTime()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(endTime - offset * 86400000)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    list.push(`${y}-${m}-${d}`)
  }
  return list
}

const stripTags = (html: string): string =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')

const decodeEntities = (text: string): string =>
  String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const normalizeSpaces = (text: string): string => decodeEntities(stripTags(text)).replace(/\s+/g, ' ').trim()

const normalizeUrlAttr = (url?: string | null): string => String(url || '').trim().replace(/&amp;/g, '&')

/** 入库链接只放行 http(s) 与站点内相对路径：手填 JSON 入口可能带 javascript: 等可执行协议 */
const safeHttpUrl = (url?: string | null): string => {
  const text = normalizeUrlAttr(url)
  return /^https?:\/\//i.test(text) || text.startsWith('/') ? text : ''
}

const toAbsoluteUrl = (base: string, maybePath?: string | null): string => {
  const path = String(maybePath || '').trim()
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

/** 番茄私用区字体解码 */
const decodeFanqieText = (text: string): string =>
  Array.from(String(text || ''))
    .map(char => fanqieFontDict[String(char.charCodeAt(0))] ?? char)
    .join('')

const countPuaChars = (text: string): number => {
  let count = 0
  for (const char of String(text || '')) {
    const code = char.codePointAt(0) || 0
    if (code >= 0xe000 && code <= 0xf8ff) count += 1
  }
  return count
}

export const parseChineseNumber = (input: string): number => {
  const match = normalizeSpaces(input).match(/([\d.]+)\s*([万亿]?)/)
  if (!match) return 0
  const value = Number(match[1])
  if (!Number.isFinite(value)) return 0
  const factor = match[2] === '亿' ? 100000000 : match[2] === '万' ? 10000 : 1
  return Math.round(value * factor)
}

/** 取 html 里第一个 <tag ...>inner</tag> 的内容 */
const firstTag = (html: string, tag: string): string => {
  const match = String(html || '').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'i'))
  return match ? match[1] : ''
}

const attrOf = (tag: string, name: string): string => {
  const match = String(tag || '').match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))
  return match ? match[2].trim() : ''
}

/**
 * 按 class 名切出一段闭合的块内容。
 * 给了 tag 就只认这个标签；没给则按实际出现的标签配平深度——番茄的
 * book-item-count / footer-status 等字段在 div 和 span 之间换过包裹，两种都要能吃下。
 */
const blockSlice = (html: string, cls: string, tag?: string): string => {
  const open = tag
    ? new RegExp(`<${tag}\\b[^>]*\\bclass\\s*=\\s*(["'])[^"']*\\b${cls}\\b[^"']*\\1[^>]*>`, 'i').exec(html)
    : new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*\\bclass\\s*=\\s*(["'])[^"']*\\b${cls}\\b[^"']*\\2[^>]*>`, 'i').exec(html)
  if (!open) return ''
  const name = tag || open[1]
  const start = open.index + open[0].length
  const scan = new RegExp(`<${name}\\b|</${name}\\s*>`, 'gi')
  scan.lastIndex = start
  let depth = 1
  let hit: RegExpExecArray | null
  while ((hit = scan.exec(html))) {
    depth += hit[0][1] === '/' ? -1 : 1
    if (depth === 0) return html.slice(start, hit.index)
  }
  return html.slice(start)
}

interface AnchorHit {
  href: string
  text: string
}

const firstAnchor = (html: string): AnchorHit => {
  const match = String(html || '').match(/<a\b[^>]*\bhref\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/i)
  if (!match) return { href: '', text: '' }
  return { href: match[2], text: match[3] }
}

/** 从页面脚本里抠出 `marker = {...}` 的完整 JSON（字符串感知的括号配平） */
const extractAssignedJson = (raw: string, marker: string): string => {
  const input = String(raw || '')
  const index = input.indexOf(marker)
  if (index < 0) return ''
  let i = index + marker.length
  while (i < input.length && /\s/.test(input[i]!)) i += 1
  if (input[i] === '=') {
    i += 1
    while (i < input.length && /\s/.test(input[i]!)) i += 1
  }
  const start = i
  if (input[start] !== '{' && input[start] !== '[') return ''
  const stack: Array<'{' | '['> = []
  let inString = false
  let escaped = false
  for (let pos = start; pos < input.length; pos += 1) {
    const ch = input[pos] as string
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') {
      const last = stack.pop()
      if (!last || (ch === '}' && last !== '{') || (ch === ']' && last !== '[')) return ''
      if (!stack.length) return input.slice(start, pos + 1)
    }
  }
  return ''
}

// ---------------------------------------------------------------------------
// 番茄：HTML 解析（正则版，选择器与 easy-writing 的 DOMParser 版一致）
// ---------------------------------------------------------------------------

const FANQIE_BASE = 'https://fanqienovel.com'
const FANQIE_ITEM_SPLIT = /<div\b[^>]*\bclass\s*=\s*["'][^"']*\brank-book-item\b[^"']*["'][^>]*>/gi

const isFanqiePlaceholderCover = (url?: string): boolean => normalizeUrlAttr(url).includes('novel-static')

const pickBestCoverUrl = (candidates: Array<string | undefined>): string => {
  const normalized = candidates.map(item => normalizeUrlAttr(item)).filter(Boolean)
  const real = normalized.find(url => url.includes('fqnovelpic.com/novel-pic/'))
  if (real) return real
  return normalized.find(url => !isFanqiePlaceholderCover(url)) || normalized[0] || ''
}

const coverMapFromInitialState = (html: string): Map<string, string> => {
  const map = new Map<string, string>()
  const jsonText = extractAssignedJson(html, 'window.__INITIAL_STATE__')
  if (!jsonText) return map
  try {
    const state = JSON.parse(jsonText) as { rank?: { book_list?: Array<{ bookId?: string; thumbUri?: string }> } }
    const list = state?.rank?.book_list
    if (!Array.isArray(list)) return map
    for (const item of list) {
      const bookId = String(item?.bookId || '').trim()
      const thumbUri = String(item?.thumbUri || '').trim()
      if (bookId && thumbUri) map.set(bookId, toAbsoluteUrl('https:', thumbUri.startsWith('//') ? thumbUri : `//${thumbUri.replace(/^https?:\/\//, '')}`))
    }
  } catch {
    // INITIAL_STATE 结构变化时只损失封面，不影响条目
  }
  return map
}

export function parseFanqieRankHtml(html: string): { pageTitle: string; cutoffText: string; items: RankItem[] } {
  const source = String(html || '')
  const coverByBookId = coverMapFromInitialState(source)

  const header = blockSlice(source, 'muye-rank-wrap-header')
  const pageTitle = normalizeSpaces(decodeFanqieText(firstTag(header, 'h1')))
  const cutoffText = normalizeSpaces(decodeFanqieText(firstTag(header, 'p')))

  const items: RankItem[] = []
  const segments = source.split(FANQIE_ITEM_SPLIT).slice(1)
  segments.forEach((segment, index) => {
    const indexBlock = blockSlice(segment, 'book-item-index')
    const rankNo = Number(normalizeSpaces(decodeFanqieText(firstTag(indexBlock, 'h1')))) || index + 1

    const changeMatch = indexBlock.match(/class\s*=\s*(["'])[^"']*\b(up|down)\b[^"']*\1[^>]*>\s*([\d.]+)/i)
    const rankChange = changeMatch ? (changeMatch[2] === 'up' ? 1 : -1) * (Number(changeMatch[3]) || 0) : 0

    const titleAnchor = firstAnchor(blockSlice(segment, 'title'))
    const bookTitle = normalizeSpaces(decodeFanqieText(titleAnchor.text))
    const bookUrl = normalizeUrlAttr(toAbsoluteUrl(FANQIE_BASE, titleAnchor.href))
    if (!bookTitle || !bookUrl) return
    const bookId = titleAnchor.href.match(/\/page\/(\d+)/)?.[1] || null

    const authorName = normalizeSpaces(decodeFanqieText(firstAnchor(blockSlice(segment, 'author')).text)) || null

    const imgTag = blockSlice(segment, 'book-cover').match(/<img\b[^>]*>/i)?.[0] || ''
    const coverUrl =
      (bookId && coverByBookId.get(bookId)) ||
      pickBestCoverUrl([attrOf(imgTag, 'src'), attrOf(imgTag, 'data-src'), attrOf(imgTag, 'data-original')]) ||
      null

    // 页面把“在读：”和数字用注释节点隔开，去标签后会留下一个空格
    const readingText = normalizeSpaces(decodeFanqieText(blockSlice(segment, 'book-item-count'))).replace(/：\s+/, '：') || null
    const lastAnchor = firstAnchor(blockSlice(segment, 'book-item-footer-last'))
    const lastChapterTitle =
      normalizeSpaces(decodeFanqieText(lastAnchor.text).replace(/^最近更新[:：]/, '')) || null

    items.push({
      rankNo,
      rankChange,
      bookTitle,
      bookId,
      bookUrl,
      authorName,
      coverUrl,
      intro: normalizeSpaces(decodeFanqieText(blockSlice(segment, 'desc'))) || null,
      statusText: normalizeSpaces(decodeFanqieText(blockSlice(segment, 'book-item-footer-status'))) || null,
      readingText,
      readingCount: readingText ? parseChineseNumber(readingText) : 0,
      metricName: '在读',
      metricText: readingText,
      metricValue: readingText ? parseChineseNumber(readingText) : 0,
      lastChapterTitle,
      lastChapterUrl: normalizeUrlAttr(toAbsoluteUrl(FANQIE_BASE, lastAnchor.href)) || null,
      lastUpdateTimeText: normalizeSpaces(decodeFanqieText(blockSlice(segment, 'book-item-footer-time'))) || null,
      categoryName: null,
      categorySubName: null,
    })
  })

  // 字体乱码熔断：书名普遍残留私用区字符 = 番茄换了字体、静态字典失效——
  // 报错跳过入库，保住上一份好快照
  const garbled = items.filter(item => countPuaChars(item.bookTitle) >= 2).length
  if (items.length >= 3 && garbled / items.length > 0.5) {
    throw new Error('番茄字体解码失败（疑似目标站更换字体），本次不入库以保留上一份数据')
  }
  if (!items.length) {
    throw new Error('没有解析到榜单条目（页面结构可能已变更，或粘贴的不是榜单页 HTML）')
  }
  return { pageTitle, cutoffText, items }
}

// ---------------------------------------------------------------------------
// 七猫：JSON 接口解析（与 easy-writing 同字段映射）
// ---------------------------------------------------------------------------

const QIMAO_BASE = 'https://www.qimao.com'

export function parseQimaoRankJson(input: unknown): RankItem[] {
  const root = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const data = (root.data && typeof root.data === 'object' ? root.data : {}) as Record<string, unknown>
  const list = Array.isArray(data.table_data) ? data.table_data : []
  const items: RankItem[] = []
  for (let index = 0; index < list.length; index += 1) {
    const row = (list[index] || {}) as Record<string, unknown>
    const bookId = String(row.book_id || '').trim() || null
    const bookTitle = normalizeSpaces(String(row.title || ''))
    const bookUrl = safeHttpUrl(String(row.book_url || '')) || toAbsoluteUrl(QIMAO_BASE, `/shuku/${bookId || ''}/`)
    if (!bookTitle || !bookUrl) continue
    const metricValue = (() => {
      const value = Number(String(row.number || '').trim())
      if (!Number.isFinite(value)) return 0
      const unit = String(row.unit || '').trim()
      return Math.round(value * (unit === '亿' ? 100000000 : unit === '万' ? 10000 : 1))
    })()
    const direction = Number(String(row.index_change || '').trim())
    const magnitude = Number(String(row.surge_rank || '').trim())
    const latestChapterId = String(row.latest_chapter_id || '').trim()
    items.push({
      rankNo: index + 1,
      rankChange:
        Number.isFinite(magnitude) && magnitude > 0 && (direction === 1 || direction === -1) ? direction * magnitude : 0,
      bookTitle,
      bookId,
      bookUrl,
      authorName: normalizeSpaces(String(row.author || '')) || null,
      coverUrl: String(row.image_link || '').trim() || null,
      intro: String(row.intro || '').trim() || null,
      statusText: String(row.is_over || '').trim() === '1' ? '已完结' : '连载中',
      readingText: null,
      readingCount: 0,
      metricName: '热度',
      metricText: normalizeSpaces(`${String(row.number || '')}${String(row.unit || '')}`) || null,
      metricValue,
      lastChapterTitle: normalizeSpaces(String(row.latest_chapter_title || '')) || null,
      lastChapterUrl: latestChapterId ? toAbsoluteUrl(QIMAO_BASE, `/shuku/${bookId || ''}-${latestChapterId}/`) : null,
      lastUpdateTimeText: normalizeSpaces(String(row.update_time || '')) || null,
      categoryName: normalizeSpaces(String(row.category1_name || '')) || null,
      categorySubName: normalizeSpaces(String(row.category2_name || '')) || null,
    })
  }
  return items
}

/** 番茄条目不带分类：从源配置补，榜单分布与标签风向才有东西可聚 */
const attachSourceCategory = (items: RankItem[], source: RankSeedSource): RankItem[] => {
  const category = findRankCategory(source.categoryLegacyId)
  if (!category) return items
  return items.map(item => (item.categoryName ? item : { ...item, categoryName: category.name }))
}

// ---------------------------------------------------------------------------
// 快照存档（localStorage 单键）
// ---------------------------------------------------------------------------

export const emptyRankStore = (): RankStore => ({ version: 1, viewedSourceIds: [], snapshots: [] })

const asInt = (value: unknown, fallback = 0): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeItem(value: unknown): RankItem | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const bookTitle = String(row.bookTitle || '').trim()
  const bookUrl = safeHttpUrl(String(row.bookUrl || ''))
  if (!bookTitle || !bookUrl) return null
  return {
    rankNo: asInt(row.rankNo, 0),
    rankChange: asInt(row.rankChange, 0),
    bookTitle,
    bookId: String(row.bookId || '').trim() || null,
    bookUrl,
    intro: String(row.intro || '').trim() || null,
    authorName: String(row.authorName || '').trim() || null,
    statusText: String(row.statusText || '').trim() || null,
    metricName: String(row.metricName || '').trim() || null,
    metricValue: asInt(row.metricValue, 0),
    metricText: String(row.metricText || '').trim() || null,
    readingCount: asInt(row.readingCount, 0),
    readingText: String(row.readingText || '').trim() || null,
    prevRankNo: row.prevRankNo == null ? null : asInt(row.prevRankNo, 0),
    rankChangeDelta: row.rankChangeDelta == null ? null : asInt(row.rankChangeDelta, 0),
    prevMetricValue: row.prevMetricValue == null ? null : asInt(row.prevMetricValue, 0),
    metricDelta: row.metricDelta == null ? null : asInt(row.metricDelta, 0),
    coverUrl: safeHttpUrl(String(row.coverUrl || '')) || null,
    lastChapterTitle: String(row.lastChapterTitle || '').trim() || null,
    lastChapterUrl: safeHttpUrl(String(row.lastChapterUrl || '')) || null,
    lastUpdateTimeText: String(row.lastUpdateTimeText || '').trim() || null,
    categoryName: String(row.categoryName || '').trim() || null,
    categorySubName: String(row.categorySubName || '').trim() || null,
  }
}

function normalizeSnapshot(value: unknown): RankSnapshotDoc | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const statDate = String(row.statDate || '').trim()
  const sourceId = asInt(row.sourceId, 0)
  if (!statDate || !sourceId) return null
  const items = (Array.isArray(row.items) ? row.items : [])
    .map(item => normalizeItem(item))
    .filter((item): item is RankItem => Boolean(item))
  // 一条目都没有的快照没有展示价值，导入时直接跳过
  if (!items.length) return null
  return {
    sourceId,
    statDate,
    fetchedAt: asInt(row.fetchedAt, Date.now()),
    pageTitle: String(row.pageTitle || '').trim() || null,
    cutoffText: String(row.cutoffText || '').trim() || null,
    origin: row.origin === 'crawl' || row.origin === 'paste' ? row.origin : 'import',
    items: items.slice(0, RANK_MAX_ITEMS),
  }
}

function normalizeRankStore(value: unknown): RankStore {
  const store = emptyRankStore()
  if (!value || typeof value !== 'object') return store
  const row = value as Record<string, unknown>
  store.viewedSourceIds = (Array.isArray(row.viewedSourceIds) ? row.viewedSourceIds : [])
    .map(id => asInt(id, 0))
    .filter(Boolean)
    .filter((id, index, list) => list.indexOf(id) === index)
    .slice(0, RANK_MAX_VIEWED_SOURCES)
  const snapshots = (Array.isArray(row.snapshots) ? row.snapshots : [])
    .map(item => normalizeSnapshot(item))
    .filter((item): item is RankSnapshotDoc => Boolean(item))
  store.snapshots = pruneRankSnapshots(snapshots)
  return store
}

export function loadRankStore(): RankStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RANK_STORAGE_KEY) || 'null')
    if (parsed && typeof parsed === 'object') return normalizeRankStore(parsed)
  } catch { /* 读不出来按空库处理，不影响页面 */ }
  return emptyRankStore()
}

/** 归一化全库不便宜（4MB 库实测 ~27ms）：组件每次挂载都重读一遍纯属浪费，同版本数据复用缓存 */
let rankStoreCache: RankStore | null = null
export function loadRankStoreCached(): RankStore {
  rankStoreCache ||= loadRankStore()
  return rankStoreCache
}

export function saveRankStore(store: RankStore): void {
  writeStorage(RANK_STORAGE_KEY, store)
  rankStoreCache = store
}

/** 保留策略：裁回最近 N 份/120 天，写库与备份覆盖恢复共用同一口径。 */
export const pruneRankSnapshots = (snapshots: RankSnapshotDoc[]): RankSnapshotDoc[] => {
  const cutoff = localDate(RANK_RETENTION_DAYS)
  const kept = snapshots.filter(item => item.statDate >= cutoff)
  return kept
    .sort((a, b) => (a.statDate < b.statDate ? 1 : a.statDate > b.statDate ? -1 : b.fetchedAt - a.fetchedAt))
    .slice(0, RANK_MAX_SNAPSHOTS)
}

export const rankSnapshotKey = (sourceId: number, statDate: string): string => `${sourceId}:${statDate}`

export function listRankSnapshotDates(store: RankStore, sourceId: number): string[] {
  return store.snapshots
    .filter(item => item.sourceId === sourceId)
    .map(item => item.statDate)
    .sort()
    .reverse()
}

export function readRankSnapshot(store: RankStore, sourceId: number, statDate: string): RankSnapshotDoc | null {
  return store.snapshots.find(item => item.sourceId === sourceId && item.statDate === statDate) || null
}

export function readNewestRankSnapshot(store: RankStore, sourceId: number, notAfter?: string): RankSnapshotDoc | null {
  const dates = listRankSnapshotDates(store, sourceId)
  const statDate = dates.find(item => !notAfter || item <= notAfter)
  return statDate ? readRankSnapshot(store, sourceId, statDate) : null
}

/** 写一份快照：同源同日覆盖，超出保留期/总量的旧快照被清掉 */
export function writeRankSnapshot(store: RankStore, doc: RankSnapshotDoc): RankStore {
  const key = rankSnapshotKey(doc.sourceId, doc.statDate)
  const rest = store.snapshots.filter(item => rankSnapshotKey(item.sourceId, item.statDate) !== key)
  rest.push({
    ...doc,
    items: doc.items.slice(0, RANK_MAX_ITEMS),
  })
  store.snapshots = pruneRankSnapshots(rest)
  return store
}

export function removeRankSnapshot(store: RankStore, sourceId: number, statDate: string): RankStore {
  const key = rankSnapshotKey(sourceId, statDate)
  store.snapshots = store.snapshots.filter(item => rankSnapshotKey(item.sourceId, item.statDate) !== key)
  return store
}

export function markRankSourceViewed(store: RankStore, sourceId: number): RankStore {
  const id = asInt(sourceId, 0)
  if (!id) return store
  store.viewedSourceIds = [id, ...store.viewedSourceIds.filter(item => item !== id)].slice(0, RANK_MAX_VIEWED_SOURCES)
  return store
}

const toSnapshotMeta = (doc: RankSnapshotDoc): RankSnapshotMeta => ({
  sourceId: doc.sourceId,
  statDate: doc.statDate,
  pageTitle: doc.pageTitle,
  cutoffText: doc.cutoffText,
  itemCount: doc.items.length,
})

// ---------------------------------------------------------------------------
// 排名查询与对照
// ---------------------------------------------------------------------------

/** 对照上一份快照补差值字段（prevRankNo / 名次变动 / 指标变动） */
export const attachCompare = (items: RankItem[], previous: RankSnapshotDoc | null): RankItem[] => {
  if (!previous) return items.map(item => ({ ...item, prevRankNo: null, rankChangeDelta: null, prevMetricValue: null, metricDelta: null }))
  const prevByKey = new Map<string, RankItem>()
  for (const item of previous.items) prevByKey.set(item.bookId || item.bookTitle, item)
  return items.map(item => {
    const prev = prevByKey.get(item.bookId || item.bookTitle)
    if (!prev) return { ...item, prevRankNo: null, rankChangeDelta: null, prevMetricValue: null, metricDelta: null }
    return {
      ...item,
      prevRankNo: prev.rankNo,
      rankChangeDelta: prev.rankNo - item.rankNo,
      prevMetricValue: prev.metricValue ?? null,
      metricDelta: item.metricValue != null && prev.metricValue != null ? item.metricValue - prev.metricValue : null,
    }
  })
}

// categoryCode → 分类名：快照条目只存分类名文本，用种子表还原后按名字匹配。
// code 给了但种子表查不到时返回空列表（如实呈现「无数据」，不静默回退成未过滤全量）。
const filterCategory = (items: RankItem[], categoryCode?: string): RankItem[] => {
  const code = String(categoryCode || '').trim()
  if (!code) return items
  const name = findRankCategoryByCode(code)?.name || ''
  if (!name) return []
  return items.filter(item =>
    [item.categoryName].some(value => String(value || '').trim() === name)
  )
}

const filterKeyword = (items: RankItem[], keyword?: string): RankItem[] => {
  const text = String(keyword || '').trim().toLowerCase()
  if (!text) return items
  return items.filter(item =>
    `${item.bookTitle} ${item.authorName || ''} ${item.categoryName || ''}`.toLowerCase().includes(text)
  )
}

const paged = <T>(list: T[], page = 1, size = 20) => ({
  page,
  size,
  total: list.length,
  list: list.slice((page - 1) * size, page * size),
})

export interface RankLatestParams {
  sourceId: number
  statDate?: string
  compareDate?: string
  keyword?: string
  categoryCode?: string
  page?: number
  size?: number
}

export interface RankLatestResult {
  snapshot: RankSnapshotMeta | null
  page: number
  size: number
  total: number
  list: RankItem[]
  compareDate: string | null
}

export function rankLatest(params: RankLatestParams, store: RankStore = loadRankStore()): RankLatestResult {
  const doc = params.statDate
    ? readRankSnapshot(store, params.sourceId, params.statDate)
    : readNewestRankSnapshot(store, params.sourceId)
  const size = params.size || 20
  if (!doc) {
    return { snapshot: null, page: params.page || 1, size, total: 0, list: [], compareDate: null }
  }
  // 对照快照：显式指定日期优先，否则取严格早于当前快照的最近一份
  const dates = listRankSnapshotDates(store, params.sourceId)
  const compareDate = params.compareDate || dates.find(date => date < doc.statDate) || ''
  const compare = compareDate ? readRankSnapshot(store, params.sourceId, compareDate) : null
  const items = filterKeyword(filterCategory(attachCompare(doc.items, compare), params.categoryCode), params.keyword)
  const { page, total, list } = paged(items, params.page || 1, size)
  return { snapshot: toSnapshotMeta(doc), page, size, total, list, compareDate: compare?.statDate || null }
}

export interface RankLatestAllParams {
  siteCode: string
  rankType?: string
  gender?: string
  statDate?: string
  keyword?: string
  page?: number
  size?: number
}

export function rankLatestAll(params: RankLatestAllParams, store: RankStore = loadRankStore()): RankLatestResult {
  const sources = rankSourcesFor(params.siteCode, params)
  const merged: RankItem[] = []
  const seen = new Set<string>()
  let newest: RankSnapshotDoc | null = null
  for (const source of sources) {
    const doc = params.statDate
      ? readRankSnapshot(store, source.legacyId, params.statDate)
      : readNewestRankSnapshot(store, source.legacyId)
    if (!doc) continue
    if (!newest || doc.statDate > newest.statDate) newest = doc
    const option = toSourceOption(source)
    for (const item of doc.items) {
      const key = item.bookId || `${item.bookTitle}:${item.authorName || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push({ ...item, categoryName: item.categoryName || option.categoryName || null })
    }
  }
  merged.sort((a, b) => Number(b.metricValue || 0) - Number(a.metricValue || 0))
  const ranked = merged.map((item, index) => ({ ...item, rankNo: index + 1 }))
  const items = filterKeyword(ranked, params.keyword)
  const { page, size, total, list } = paged(items, params.page || 1, params.size || 20)
  return { snapshot: newest ? toSnapshotMeta(newest) : null, page, size, total, list, compareDate: null }
}

// ---------------------------------------------------------------------------
// 分析口径（全部从本机快照现算，快照攒得越多越有料）
// ---------------------------------------------------------------------------

/** 单份快照的分类分布（榜单详情页用，不受站点其他源影响） */
export function rankSnapshotDistribution(doc: RankSnapshotDoc | null): RankCategoryDistribution {
  if (!doc) return { statDate: null, total: 0, list: [] }
  const counter = new Map<string, number>()
  let total = 0
  for (const item of doc.items) {
    const name = item.categoryName || '未分类'
    counter.set(name, (counter.get(name) || 0) + 1)
    total += 1
  }
  const list = [...counter.entries()]
    .map(([categoryName, count]) => ({ categoryName, count, ratio: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
  return { statDate: doc.statDate, total, list }
}

export function rankCategoryDistribution(
  params: { siteCode: string; rankType?: string; gender?: string; statDate?: string },
  store: RankStore = loadRankStore()
): RankCategoryDistribution {
  const sources = rankSourcesFor(params.siteCode, params)
  const counter = new Map<string, number>()
  let statDate: string | null = null
  let total = 0
  for (const source of sources) {
    const doc = params.statDate
      ? readRankSnapshot(store, source.legacyId, params.statDate)
      : readNewestRankSnapshot(store, source.legacyId)
    if (!doc) continue
    if (!statDate || doc.statDate > statDate) statDate = doc.statDate
    const option = toSourceOption(source)
    for (const item of doc.items) {
      const name = item.categoryName || option.categoryName || '未分类'
      counter.set(name, (counter.get(name) || 0) + 1)
      total += 1
    }
  }
  const list = [...counter.entries()]
    .map(([categoryName, count]) => ({ categoryName, count, ratio: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
  return { statDate, total, list }
}

/** 站点某天各源快照合并（分析用；同书取最好名次） */
const mergedDayItems = (
  siteCode: string,
  filters: { rankType?: string; gender?: string },
  date: string,
  store: RankStore
): Map<string, RankItem> => {
  const sources = rankSourcesFor(siteCode, filters)
  const byKey = new Map<string, RankItem>()
  for (const source of sources) {
    const doc = readRankSnapshot(store, source.legacyId, date)
    if (!doc) continue
    for (const item of doc.items) {
      const key = item.bookId || item.bookTitle
      const existing = byKey.get(key)
      if (!existing || item.rankNo < existing.rankNo) byKey.set(key, item)
    }
  }
  return byKey
}

/**
 * 标签风向：把每日各源快照合并后按「二级分类（无则一级分类）」逐日计数，
 * 取总量 Top N 出趋势线。番茄条目只有一级分类，退化为分类热度。
 */
export function rankTagTrends(
  params: { siteCode: string; rankType?: string; gender?: string; days?: number; topN?: number },
  store: RankStore = loadRankStore()
): RankTagTrend {
  const days = Math.max(2, Math.min(Number(params.days || 7), 60))
  const topN = Math.max(1, Math.min(Number(params.topN || 6), 12))
  const dates = dateRange(days)

  const countsByTag = new Map<string, Map<string, number>>()
  const totals = new Map<string, number>()
  for (const date of dates) {
    const merged = mergedDayItems(params.siteCode, params, date, store)
    for (const item of merged.values()) {
      const tag = String(item.categorySubName || item.categoryName || '').trim()
      if (!tag) continue
      let series = countsByTag.get(tag)
      if (!series) {
        series = new Map<string, number>()
        countsByTag.set(tag, series)
      }
      series.set(date, (series.get(date) || 0) + 1)
      totals.set(tag, (totals.get(tag) || 0) + 1)
    }
  }

  const list = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([tag]) => ({
      tag,
      series: dates.map(date => ({ date, count: countsByTag.get(tag)?.get(date) || 0 })),
    }))
  return { startDate: dates[0], endDate: dates[dates.length - 1], days, list }
}

export function rankChange(
  params: { sourceId: number; statDate?: string; compareDate?: string; topN?: number },
  store: RankStore = loadRankStore()
): RankChangeResult {
  const doc = params.statDate
    ? readRankSnapshot(store, params.sourceId, params.statDate)
    : readNewestRankSnapshot(store, params.sourceId)
  if (!doc) return { statDate: null, compareDate: null, list: [] }
  const dates = listRankSnapshotDates(store, params.sourceId)
  const compareDate = params.compareDate || dates.find(date => date < doc.statDate) || null
  const compare = compareDate ? readRankSnapshot(store, params.sourceId, compareDate) : null
  const items = attachCompare(doc.items, compare)
  const list = items
    .map(item => ({
      bookId: item.bookId ?? null,
      bookTitle: item.bookTitle,
      rankNo: item.rankNo,
      rankChange: item.rankChangeDelta ?? item.rankChange ?? 0,
      metricValue: Number(item.metricValue || 0),
      metricText: item.metricText ?? null,
    }))
    .sort((a, b) => Math.abs(b.rankChange) - Math.abs(a.rankChange))
    .slice(0, Math.max(1, Number(params.topN || 10)))
  return { statDate: doc.statDate, compareDate: compare?.statDate || null, list }
}

export function rankCompetitor(
  params: { siteCode: string; bookIds: string; rankType?: string; gender?: string; endDate?: string; days?: number },
  store: RankStore = loadRankStore()
): RankCompetitorResult {
  const days = Math.max(2, Math.min(Number(params.days || 14), 60))
  const dates = dateRange(days, params.endDate)
  // 去重并封顶：粘贴上千个 ID 会让同步计算与表格渲染冻住页面
  const wanted = [...new Set(String(params.bookIds || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean))].slice(0, RANK_MAX_RIVAL_IDS)
  const seriesByBook = new Map<string, { bookTitle: string; series: RankCompetitorSeries[] }>()
  for (const bookId of wanted) seriesByBook.set(bookId, { bookTitle: '', series: [] })
  for (const date of dates) {
    const merged = mergedDayItems(params.siteCode, params, date, store)
    const byId = new Map<string, RankItem>()
    for (const item of merged.values()) if (item.bookId) byId.set(item.bookId, item)
    for (const bookId of wanted) {
      const entry = seriesByBook.get(bookId)!
      const item = byId.get(bookId)
      if (item?.bookTitle) entry.bookTitle = item.bookTitle
      entry.series.push({
        date,
        rankNo: item ? item.rankNo : null,
        metricValue: item?.metricValue ?? null,
        metricText: item?.metricText ?? null,
      })
    }
  }
  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    days,
    list: wanted.map(bookId => ({
      bookId,
      bookTitle: seriesByBook.get(bookId)!.bookTitle || bookId,
      series: seriesByBook.get(bookId)!.series,
    })),
  }
}

export function rankAuthorTrend(
  params: { siteCode: string; authorName: string; rankType?: string; gender?: string; endDate?: string; days?: number },
  store: RankStore = loadRankStore()
): RankAuthorTrend {
  const days = Math.max(2, Math.min(Number(params.days || 14), 60))
  const dates = dateRange(days, params.endDate)
  const author = String(params.authorName || '').trim()
  const list: RankAuthorTrend['list'] = []
  for (const date of dates) {
    const merged = mergedDayItems(params.siteCode, params, date, store)
    let bookCount = 0
    let metricSum = 0
    for (const item of merged.values()) {
      if ((item.authorName || '').trim() !== author) continue
      bookCount += 1
      metricSum += Number(item.metricValue || 0)
    }
    list.push({ date, bookCount, metricSum, metricAvg: bookCount ? Math.round(metricSum / bookCount) : 0 })
  }
  return { startDate: dates[0], endDate: dates[dates.length - 1], days, list }
}

// ---------------------------------------------------------------------------
// 导出（CSV + 存档 JSON）
// ---------------------------------------------------------------------------

const csvEscape = (value: unknown): string => {
  let text = String(value ?? '')
  // 公式注入防护：=、+、@ 开头（以及 - 开头的非纯数字）会被表格软件当公式执行，前置单引号降级为文本
  if (/^[=+@]/.test(text) || /^-\D/.test(text)) text = `'${text}`
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const RANK_CSV_HEADER = ['名次', '书名', '作者', '分类', '状态', '指标', '名次变动', '最新章节']

export function exportRankCsv(
  params: { sourceId?: number; siteCode?: string; rankType?: string; gender?: string; statDate?: string; compareDate?: string; keyword?: string; categoryCode?: string },
  store: RankStore = loadRankStore()
): string {
  const items = params.sourceId
    ? rankLatest({ sourceId: params.sourceId, statDate: params.statDate, compareDate: params.compareDate, keyword: params.keyword, categoryCode: params.categoryCode, page: 1, size: 1000 }, store).list
    : params.siteCode
      ? rankLatestAll({ siteCode: params.siteCode, rankType: params.rankType, gender: params.gender, statDate: params.statDate, keyword: params.keyword, page: 1, size: 1000 }, store).list
      : []
  if (!items.length) throw new Error('没有可导出的榜单数据，先抓取或导入一份快照')
  const rows = items.map(item =>
    [
      item.rankNo,
      item.bookTitle,
      item.authorName || '',
      item.categoryName || '',
      item.statusText || '',
      item.metricText || '',
      item.rankChangeDelta ?? item.rankChange ?? 0,
      item.lastChapterTitle || '',
    ]
      .map(csvEscape)
      .join(',')
  )
  // BOM 让 Excel 正确识别 UTF-8 中文
  return `\uFEFF${[RANK_CSV_HEADER.join(','), ...rows].join('\n')}`
}

export function exportRankStore(store: RankStore): string {
  return JSON.stringify(
    {
      format: RANK_FILE_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshots: store.snapshots,
    },
    null,
    2
  )
}

/** 解析扫榜存档：只认本格式，快照逐份校验，坏份跳过不拖垮整包 */
export function importRankStore(value: unknown): RankSnapshotDoc[] {
  if (!value || typeof value !== 'object') throw new Error('不是有效的扫榜存档文件')
  const row = value as Record<string, unknown>
  if (row.format !== RANK_FILE_FORMAT) throw new Error('文件格式不受支持（缺少 novel-workbench-next/rank-v1 标识）')
  if (!Array.isArray(row.snapshots)) throw new Error('存档里没有快照列表')
  const docs = row.snapshots
    .map(item => normalizeSnapshot(item))
    .filter((item): item is RankSnapshotDoc => Boolean(item))
  if (!docs.length) throw new Error('没有可导入的快照')
  return docs
}

/** 备份合并：同榜单源同日期只留较新抓取的一份，再按保留策略裁剪 */
export function mergeRankSnapshots(current: RankSnapshotDoc[], incoming: RankSnapshotDoc[]): RankSnapshotDoc[] {
  const byKey = new Map<string, RankSnapshotDoc>()
  for (const doc of [...current, ...incoming]) {
    const key = `${doc.sourceId}|${doc.statDate}`
    const prev = byKey.get(key)
    if (!prev || doc.fetchedAt > prev.fetchedAt) byKey.set(key, doc)
  }
  return pruneRankSnapshots([...byKey.values()])
}

/** 从全量备份里取扫榜快照：整体结构不对就当没有，单份坏了只跳过那一份 */
export function rankSnapshotsFromBackup(value: unknown): RankSnapshotDoc[] {
  if (!value || typeof value !== 'object') return []
  const snapshots = (value as { snapshots?: unknown }).snapshots
  if (!Array.isArray(snapshots)) return []
  return snapshots
    .map(item => normalizeSnapshot(item))
    .filter((item): item is RankSnapshotDoc => Boolean(item))
}

// ---------------------------------------------------------------------------
// 抓取（浏览器里走 /rank-proxy 代理；跨域失败时如实提示）
// ---------------------------------------------------------------------------

const PROXY_HOSTS = ['fanqienovel.com', 'www.qimao.com']

/** 代理路径：只放行种子表里的两个域名，别把代理变成开放转发器 */
const proxyPathFor = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    if (!PROXY_HOSTS.includes(parsed.host)) return null
    return `/rank-proxy/${parsed.host}${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

async function fetchRankText(url: string, accept: string): Promise<string> {
  const proxied = proxyPathFor(url)
  const attempts = proxied ? [proxied, url] : [url]
  const problems: string[] = []
  for (const attempt of attempts) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(attempt, {
        method: 'GET',
        // User-Agent 是浏览器禁头，带上它 fetch 直接抛 TypeError，抓取永远失败
        headers: { Accept: accept },
        signal: controller.signal,
      })
      if (!response.ok) {
        problems.push(`${attempt} → HTTP ${response.status}`)
        continue
      }
      return await response.text()
    } catch (error) {
      problems.push(`${attempt} → ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`抓取失败（${problems.join('；')}）。${BROWSER_CORS_HINT}`)
}

export interface CrawledRank {
  items: RankItem[]
  pageTitle?: string
  cutoffText?: string
}

const fetchFanqieRank = async (url: string, maxPages: number): Promise<CrawledRank> => {
  const html = await fetchRankText(url, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
  const parsed = parseFanqieRankHtml(html)
  if (maxPages <= 1) return parsed
  // 多页：番茄榜单页按 page 参数翻页，合并去重（懒加载后续页在桌面版才处理）
  const merged = [...parsed.items]
  const seen = new Set(merged.map(item => item.bookId || item.bookUrl))
  for (let page = 2; page <= Math.min(maxPages, 5); page += 1) {
    const target = new URL(url)
    target.searchParams.set('page', String(page))
    try {
      const pageHtml = await fetchRankText(target.toString(), 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
      const more = parseFanqieRankHtml(pageHtml)
      let added = 0
      for (const item of more.items) {
        const key = item.bookId || item.bookUrl
        if (seen.has(key)) continue
        seen.add(key)
        merged.push({ ...item, rankNo: merged.length + 1 })
        added += 1
      }
      if (!added) break
    } catch {
      break // 翻页失败就用已拿到的首屏，宁少勿断
    }
    await new Promise(resolve => setTimeout(resolve, PAGE_GAP_MS))
  }
  return { items: merged, pageTitle: parsed.pageTitle, cutoffText: parsed.cutoffText }
}

const fetchQimaoRank = async (baseUrl: string, maxPages: number): Promise<RankItem[]> => {
  const items: RankItem[] = []
  const seen = new Set<string>()
  for (let page = 1; page <= Math.max(1, Math.min(maxPages, 5)); page += 1) {
    const url = new URL(baseUrl)
    // 日榜固定年月会把快照写旧：清掉 date 用实时榜
    if (String(url.searchParams.get('date_type') || '') === '1') url.searchParams.delete('date')
    url.searchParams.set('page', String(page))
    const text = await fetchRankText(url.toString(), 'application/json, text/plain, */*')
    let pageItems: RankItem[]
    try {
      pageItems = parseQimaoRankJson(JSON.parse(text))
    } catch {
      throw new Error('七猫接口未返回 JSON（可能触发风控或接口变更），已停止抓取。')
    }
    if (!pageItems.length) break
    for (const item of pageItems) {
      const key = item.bookId || item.bookUrl
      if (seen.has(key)) continue
      seen.add(key)
      items.push({ ...item, rankNo: items.length + 1 })
    }
    if (page < maxPages) await new Promise(resolve => setTimeout(resolve, PAGE_GAP_MS))
  }
  if (!items.length) throw new Error('七猫接口没有返回榜单条目（接口可能已变更）')
  return items
}

/** 抓取一个榜单源（按站点分派适配器）；抛出的错误一律可读 */
export const crawlRankSource = async (source: RankSeedSource): Promise<CrawledRank> => {
  const maxPages = Number(source.meta?.maxPages || 1)
  if (source.siteCode === 'fanqie') {
    const crawled = await fetchFanqieRank(source.url, maxPages)
    return { items: attachSourceCategory(crawled.items, source), pageTitle: crawled.pageTitle, cutoffText: crawled.cutoffText }
  }
  if (source.siteCode === 'qimao') {
    const items = await fetchQimaoRank(source.url, maxPages)
    return { items: attachSourceCategory(items, source) }
  }
  throw new Error(`站点 ${source.siteCode} 的抓取适配器尚未接入`)
}

export interface RankCrawlOutcome {
  crawled: boolean
  message: string
  statDate: string | null
}

/** 抓取并落快照；同源同日 30 分钟内重抓走缓存，避免把接口打爆 */
export async function crawlRankSnapshot(store: RankStore, sourceId: number): Promise<RankCrawlOutcome> {
  const source = findRankSource(sourceId)
  if (!source || source.enabled !== 1) throw new Error('榜单源不存在或未启用')
  const today = localDate()
  const existing = readRankSnapshot(store, sourceId, today)
  if (existing && Date.now() - existing.fetchedAt < MANUAL_RECRAWL_MIN_MS) {
    // 文案如实区分上一份快照是抓来的还是粘来的
    return { crawled: false, message: existing.origin === 'paste' ? '半小时内刚粘贴导入过，展示当前数据' : '半小时内刚抓过，展示当前数据', statDate: today }
  }
  const crawled = await crawlRankSource(source)
  const items = attachSourceCategory(crawled.items, source)
  writeRankSnapshot(store, {
    sourceId,
    statDate: today,
    fetchedAt: Date.now(),
    pageTitle: crawled.pageTitle || null,
    cutoffText: crawled.cutoffText || null,
    origin: 'crawl',
    items,
  })
  return { crawled: true, message: `已抓取 ${items.length} 条`, statDate: today }
}

// ---------------------------------------------------------------------------
// 手动导入（粘贴榜单页 HTML / 接口 JSON）
// ---------------------------------------------------------------------------

/** 把粘贴进来的内容解析成快照条目：番茄 HTML 或七猫 JSON 自动判别 */
export function parseRankPaste(text: string, source: RankSeedSource): { items: RankItem[]; pageTitle?: string; cutoffText?: string } {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('先把榜单页 HTML 或接口 JSON 粘贴进来')
  if (raw.startsWith('{') || raw.startsWith('[')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('这段内容不是合法的 JSON，检查是否粘贴完整')
    }
    const items = parseQimaoRankJson(parsed)
    if (!items.length) throw new Error('JSON 里没有榜单条目（七猫接口应为 data.table_data 结构）')
    return { items }
  }
  if (/<[a-z]/i.test(raw)) {
    const parsed = parseFanqieRankHtml(raw)
    return { items: parsed.items, pageTitle: parsed.pageTitle, cutoffText: parsed.cutoffText }
  }
  throw new Error('认不出这段内容：请粘贴番茄榜单页 HTML，或七猫榜单接口返回的 JSON')
}

/** 手动导入落一份今日快照（手动导入同样参与对照与分析） */
export function importRankPaste(store: RankStore, sourceId: number, text: string): RankCrawlOutcome {
  const source = findRankSource(sourceId)
  if (!source || source.enabled !== 1) throw new Error('榜单源不存在或未启用')
  const parsed = parseRankPaste(text, source)
  const items = attachSourceCategory(parsed.items, source)
  const today = localDate()
  const existing = readRankSnapshot(store, sourceId, today)
  // 粘贴会覆盖同日快照：顶掉刚抓取的新鲜数据时如实告知
  const overwroteFreshCrawl = !!existing && existing.origin === 'crawl' && Date.now() - existing.fetchedAt < MANUAL_RECRAWL_MIN_MS
  writeRankSnapshot(store, {
    sourceId,
    statDate: today,
    fetchedAt: Date.now(),
    pageTitle: parsed.pageTitle || null,
    cutoffText: parsed.cutoffText || null,
    origin: 'paste',
    items,
  })
  return { crawled: true, message: `已导入 ${items.length} 条${overwroteFreshCrawl ? '（已覆盖半小时内抓取的快照，如需保留可重新抓取）' : ''}`, statDate: today }
}

// ---------------------------------------------------------------------------
// AI 榜单解读
// ---------------------------------------------------------------------------

export function rankReportPrompt(params: {
  sourceLabel: string
  statDate: string | null
  compareDate: string | null
  items: RankItem[]
  distribution: RankCategorySlice[]
}): { system: string; user: string } {
  const system = [
    '你是网文作者的榜单分析助理。只依据给到的数据说话，数据没体现的不要编造。',
    '用大白话输出一份简短趋势解读（300 字以内），分三段：',
    '1. 榜单格局：头部是什么类型的书在打，热度量级如何；',
    '2. 变动信号：谁在涨谁在跌，可能说明什么风向；',
    '3. 给作者的建议：结合以上，一两条选题或跟进建议。',
    '没有对照数据时如实说明"暂无变化数据，攒几天快照后更准"，不要硬编趋势。',
  ].join('\n')

  const top = params.items.slice(0, 12)
  const lines: string[] = [
    `榜单：${params.sourceLabel}`,
    `快照日期：${params.statDate || '无'}`,
    `对照日期：${params.compareDate || '无（暂无历史快照）'}`,
    '',
    '头部条目（名次｜书名｜作者｜分类｜指标｜名次变动）：',
    ...top.map(item =>
      [
        item.rankNo,
        item.bookTitle,
        item.authorName || '佚名',
        item.categoryName || '未分类',
        item.metricText || (item.metricValue ? String(item.metricValue) : '无指标'),
        item.rankChangeDelta == null ? '无对照' : item.rankChangeDelta > 0 ? `升 ${item.rankChangeDelta}` : item.rankChangeDelta < 0 ? `降 ${Math.abs(item.rankChangeDelta)}` : '持平',
      ].join('｜')
    ),
  ]
  if (params.distribution.length) {
    lines.push('', '分类分布：', ...params.distribution.slice(0, 10).map(item => `${item.categoryName} ${item.count} 条（${Math.round(item.ratio * 100)}%）`))
  }
  return { system, user: lines.join('\n') }
}
