/**
 * 竞品拆书：TXT 整本导入 → 逐章 AI 拆解（细纲/关键节点/爽点节奏/设定/人物关系），
 * 前三章附加黄金三章深拆，全部拆完可生成全书汇总报告，产物可导出 Markdown。
 * 移植自已归档的 easy-writing 项目（local-breakdown + breakdown engine），存储改成本项目的
 * localStorage 单键方案，AI 调用复用 src/ai.ts，界面在 BreakdownView.vue。
 */

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type BreakdownStatus = 'wait' | 'processing' | 'done' | 'failed'

export interface BreakdownTag {
  text: string
  tone?: string
}

export interface BreakdownOutlineNode {
  id: number
  title: string
  range: string
  text: string
  tags: BreakdownTag[]
}

export interface BreakdownRhythmItem {
  label: string
  value: string
  desc: string
}

export interface BreakdownSettingItem {
  name: string
  type: string
  desc: string
  tags: string[]
}

export interface BreakdownRelationItem {
  from: string
  to: string
  relation: string
  desc: string
}

export interface BreakdownGolden {
  hook300: string
  characterEstablish: string
  coreDilemma: string
  anchors: Array<{ quote: string; comment: string }>
}

export interface BreakdownAnalysis {
  summary: string
  outline: BreakdownOutlineNode[]
  rhythm: BreakdownRhythmItem[]
  setting: BreakdownSettingItem[]
  relations: BreakdownRelationItem[]
  golden?: BreakdownGolden
}

export interface BreakdownChapter {
  id: string
  title: string
  status: BreakdownStatus
  wordCount: number
  sortNo: number
  errorMessage?: string
  paragraphs: string[]
  analysis: BreakdownAnalysis | null
  /** 段落 → 节点卡高亮映射，与 analysis.outline 的 id 对应。 */
  insightIds: Array<number | null>
}

export interface BreakdownReport {
  editorNotes: string
  outlineRecovery: Array<{ stage: string; chapters: string; goal: string; payoff: string }>
  characterArcs: Array<{ name: string; keyChapters: number[]; arc: string }>
  foreshadowLedger: Array<{ item: string; plantChapter: number; payoffChapter: number; status: 'recovered' | 'pending' }>
  pacingCurve: Array<{ chapterNo: number; score: number; label: string }>
  reusableTechniques: string[]
}

export interface BreakdownProject {
  id: string
  title: string
  author: string
  tags: string[]
  mood: string
  characterCount: number
  wordCount: number
  chapterCount: number
  progress: number
  status: BreakdownStatus
  createTime: string
  updateTime: string
  chapters: BreakdownChapter[]
  report: BreakdownReport | null
  characterNames: string[]
  /** 按类型分开存放的素材，供建书流程等后续环节取用。 */
  materials: BreakdownMaterials
}

export interface BreakdownStore {
  version: 1
  projects: BreakdownProject[]
}

/** 拆解素材的类型：按建书流程要用到的地方分开存，也按这个分组展示。 */
export type BreakdownMaterialKind = 'character' | 'rhythm' | 'setting' | 'outline' | 'technique'

export interface BreakdownMaterial {
  kind: BreakdownMaterialKind
  /** 条目标题：人物名、节奏维度、设定名、节点名 */
  label: string
  /** 正文，可直接阅读与粘走 */
  text: string
  /** 来源章节序号，0 表示来自全书报告 */
  chapterSortNo: number
  chapterTitle: string
}

export type BreakdownMaterials = Record<BreakdownMaterialKind, BreakdownMaterial[]>

export const breakdownMaterialKinds: BreakdownMaterialKind[] = ['character', 'rhythm', 'setting', 'outline', 'technique']

export const breakdownMaterialLabels: Record<BreakdownMaterialKind, string> = {
  character: '人设',
  rhythm: '节奏',
  setting: '设定',
  outline: '节点',
  technique: '技巧',
}

/** 每个类型最多留多少条，避免大书把素材库和建书字段撑爆。 */
export const BREAKDOWN_MATERIAL_LIMIT = 60

export const BREAKDOWN_STORAGE_KEY = 'novel-workbench-next/breakdown-v1'
export const BREAKDOWN_FILE_FORMAT = 'novel-workbench-next/breakdown-v1'
export const GOLDEN_CHAPTER_LIMIT = 3
export const BREAKDOWN_PROMPT_PARAGRAPH_LIMIT = 400
export const BREAKDOWN_MAX_PROJECTS = 30
export const BREAKDOWN_MAX_CHAPTERS = 200
export const BREAKDOWN_MAX_PARAGRAPHS = 2000

export const emptyStore = (): BreakdownStore => ({ version: 1, projects: [] })
const asText = (value: unknown) => String(value ?? '').trim()
const nowIso = () => new Date().toISOString()
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

// ---------------------------------------------------------------------------
// TXT 解析（章节识别规则与旧版一致：序号必须前进，排除正文里的回指句）
// ---------------------------------------------------------------------------

const txtVolumePattern = /^第([零一二三四五六七八九十百千万两\d]+)卷([\s:：、.-]*)(.*)$/
const txtChapterPattern = /^第([零一二三四五六七八九十百千万两\d]+)[章节回]([\s:：、.-]*)(.*)$/

const CN_DIGIT: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const CN_UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }

function parseHeadingNo(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return Number(text)
  let total = 0
  let section = 0
  let current = 0
  for (const ch of text) {
    if (ch in CN_DIGIT) current = CN_DIGIT[ch]
    else if (ch in CN_UNIT) { section += (current || 1) * CN_UNIT[ch]; current = 0 }
    else if (ch === '万') { total += (section + current || 1) * 10000; section = 0; current = 0 }
    else return null
  }
  return total + section + current
}

/** 标题候选行排雷：带句读的是句子；序号不往前走的是回指，都不拿来切章。 */
function acceptHeading(match: RegExpMatchArray, lastNo: number): { pass: boolean; no: number | null } {
  const [, noText, separator, rest] = match
  if (/[。！？!?…]/.test(rest)) return { pass: false, no: null }
  if (!separator && /[，,、；;：:]/.test(rest)) return { pass: false, no: null }
  const no = parseHeadingNo(noText)
  if (no != null && lastNo > 0 && no <= lastNo) return { pass: false, no }
  return { pass: true, no }
}

export interface ParsedTxtBook {
  title: string
  chapters: Array<{ title: string; text: string }>
}

/** 按卷/章标题行切分整本 TXT；识别不出章节时整本作为一章。 */
export function parseTxtBook(text: string, fallbackTitle: string): ParsedTxtBook {
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const volumes: Array<{ title: string; chapters: ParsedTxtBook['chapters'] }> = []
  let currentVolume = { title: '第一卷', chapters: [] as ParsedTxtBook['chapters'] }
  let currentChapter: ParsedTxtBook['chapters'][number] | null = null

  const pushVolume = () => { if (currentVolume.chapters.length) volumes.push(currentVolume) }
  const appendLine = (line: string) => {
    if (!currentChapter) {
      currentChapter = { title: '第1章', text: '' }
      currentVolume.chapters.push(currentChapter)
    }
    currentChapter.text += `${line}\n`
  }

  let lastVolumeNo = 0
  let lastChapterNo = 0
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()
    const volumeMatch = line.match(txtVolumePattern)
    if (volumeMatch && line.length <= 40) {
      const verdict = acceptHeading(volumeMatch, lastVolumeNo)
      if (verdict.pass) {
        pushVolume()
        currentVolume = { title: line, chapters: [] }
        currentChapter = null
        if (verdict.no != null) lastVolumeNo = verdict.no
        lastChapterNo = 0
        continue
      }
    }
    const chapterMatch = line.match(txtChapterPattern)
    if (chapterMatch && line.length <= 60) {
      const verdict = acceptHeading(chapterMatch, lastChapterNo)
      if (verdict.pass) {
        currentChapter = { title: line, text: '' }
        currentVolume.chapters.push(currentChapter)
        if (verdict.no != null) lastChapterNo = verdict.no
        continue
      }
    }
    appendLine(rawLine)
  }
  pushVolume()

  // 空章节（卷标题后的空行、连续标题行）不构成可拆解单元，直接丢弃
  const chapters = volumes.flatMap(volume => volume.chapters).map(chapter => ({ ...chapter, text: chapter.text.trim() })).filter(chapter => chapter.text)
  return { title: fallbackTitle, chapters: chapters.length ? chapters : [{ title: '第1章', text: source.trim() }] }
}

export const countBreakdownWords = (text: string) => text.replace(/\s+/g, '').length

const splitParagraphs = (text: string) => text.split(/\n+/).map(line => line.trim()).filter(Boolean)

// ---------------------------------------------------------------------------
// 项目生命周期
// ---------------------------------------------------------------------------

export function createBreakdownProject(parsed: ParsedTxtBook, author = ''): BreakdownProject {
  const chapters = parsed.chapters.slice(0, BREAKDOWN_MAX_CHAPTERS)
  if (!chapters.length) throw new Error('没有解析出任何章节，请检查文件内容')
  let totalWords = 0
  const items: BreakdownChapter[] = chapters.map((chapter, index) => {
    const paragraphs = splitParagraphs(chapter.text).slice(0, BREAKDOWN_MAX_PARAGRAPHS)
    const wordCount = countBreakdownWords(chapter.text)
    totalWords += wordCount
    return {
      id: newId(),
      title: chapter.title || `第${index + 1}章`,
      status: 'wait',
      wordCount,
      sortNo: index + 1,
      paragraphs,
      analysis: null,
      insightIds: paragraphs.map(() => null),
    }
  })
  const project: BreakdownProject = {
    id: newId(),
    title: parsed.title,
    author,
    tags: [],
    mood: '',
    characterCount: 0,
    wordCount: totalWords,
    chapterCount: items.length,
    progress: 0,
    status: 'wait',
    createTime: nowIso(),
    updateTime: nowIso(),
    chapters: items,
    report: null,
    characterNames: [],
    materials: { character: [], rhythm: [], setting: [], outline: [], technique: [] },
  }
  recalcBreakdownProject(project)
  return project
}

/** 按章节清单重算状态/进度/统计/分类素材，所有写路径共用同一口径。 */
export function recalcBreakdownProject(project: BreakdownProject): BreakdownProject {
  const chapters = project.chapters
  const done = chapters.filter(item => item.status === 'done').length
  const processing = chapters.filter(item => item.status === 'processing').length
  const failed = chapters.filter(item => item.status === 'failed').length
  project.chapterCount = chapters.length
  project.wordCount = chapters.reduce((sum, item) => sum + (item.wordCount || 0), 0)
  project.progress = chapters.length ? Math.round((done / chapters.length) * 100) : 0
  project.status = processing > 0 ? 'processing' : chapters.length > 0 && done === chapters.length ? 'done' : failed > 0 ? 'failed' : 'wait'
  project.characterCount = project.characterNames.length
  project.updateTime = nowIso()
  project.materials = collectBreakdownMaterials(project)
  return project
}

/**
 * 把已拆章节与全书报告按类型聚合成分开的素材库：
 * 人设取人物关系与人物弧线，节奏取爽点节奏，设定取世界观设定，
 * 节点取关键节点与大纲反推，技巧取可复用技巧与编辑手记。
 */
export function collectBreakdownMaterials(project: BreakdownProject): BreakdownMaterials {
  const materials: BreakdownMaterials = { character: [], rhythm: [], setting: [], outline: [], technique: [] }
  const push = (kind: BreakdownMaterialKind, label: string, text: string, chapterSortNo: number, chapterTitle: string) => {
    const cleanLabel = asText(label)
    const cleanText = asText(text)
    if (!cleanText) return
    const bucket = materials[kind]
    if (bucket.length >= BREAKDOWN_MATERIAL_LIMIT) return
    bucket.push({ kind, label: cleanLabel, text: cleanText, chapterSortNo, chapterTitle })
  }
  const doneChapters = project.chapters
    .filter(item => item.status === 'done' && item.analysis)
    .sort((a, b) => a.sortNo - b.sortNo)
  for (const chapter of doneChapters) {
    const analysis = chapter.analysis as BreakdownAnalysis
    for (const item of analysis.relations) {
      push('character', `${item.from} → ${item.to}${item.relation ? `（${item.relation}）` : ''}`, item.desc, chapter.sortNo, chapter.title)
    }
    for (const item of analysis.rhythm) {
      push('rhythm', `${item.label}${item.value ? `（${item.value}）` : ''}`, item.desc, chapter.sortNo, chapter.title)
    }
    for (const item of analysis.setting) {
      const tags = item.tags.length ? `【${item.tags.join('、')}】` : ''
      push('setting', `${item.name}${item.type ? `·${item.type}` : ''}`, `${item.desc}${tags}`, chapter.sortNo, chapter.title)
    }
    for (const node of analysis.outline) {
      const tags = node.tags.length ? `【${node.tags.map(tag => tag.text).join('、')}】` : ''
      push('outline', `${node.title}（${node.range}）`, `${node.text}${tags}`, chapter.sortNo, chapter.title)
    }
  }
  const report = project.report
  if (report) {
    for (const arc of report.characterArcs) {
      const chapters = arc.keyChapters.length ? `（第${arc.keyChapters.join('、')}章）` : ''
      push('character', `${arc.name}${chapters}`, arc.arc, 0, '全书报告')
    }
    for (const stage of report.outlineRecovery) {
      push('outline', `${stage.stage}（${stage.chapters}）`, `目标：${stage.goal}${stage.payoff ? `；兑现：${stage.payoff}` : ''}`, 0, '全书报告')
    }
    for (const item of report.reusableTechniques) push('technique', '可复用技巧', item, 0, '全书报告')
    if (report.editorNotes) push('technique', '编辑手记', report.editorNotes, 0, '全书报告')
  }
  return materials
}

/** 素材总量，用于判断这本书有没有可带入的东西。 */
export function countBreakdownMaterials(materials: BreakdownMaterials | undefined): number {
  if (!materials) return 0
  return breakdownMaterialKinds.reduce((sum, kind) => sum + materials[kind].length, 0)
}

/** 把选中类型的素材排成可直接粘进建书字段的文本，每条带上出处便于回查原书。 */
export function formatBreakdownMaterials(project: BreakdownProject, kinds: BreakdownMaterialKind[]): string {
  const picked = breakdownMaterialKinds.filter(kind => kinds.includes(kind) && project.materials[kind].length)
  if (!picked.length) return ''
  const author = project.author ? `（作者：${project.author}）` : ''
  const lines = [`以下素材拆自《${project.title}》${author}，只作结构参考，不要照抄原文：`]
  for (const kind of picked) {
    lines.push('', `【${breakdownMaterialLabels[kind]}】`)
    for (const item of project.materials[kind]) {
      const from = item.chapterSortNo ? `第${item.chapterSortNo}章` : '全书报告'
      lines.push(`- ${item.label ? `${item.label}：` : ''}${item.text}（${from}）`)
    }
  }
  return lines.join('\n')
}

export function retryableBreakdownChapters(project: BreakdownProject): BreakdownChapter[] {
  return project.chapters.filter(item => item.status === 'wait' || item.status === 'failed').sort((a, b) => a.sortNo - b.sortNo)
}

// ---------------------------------------------------------------------------
// 提示词（与旧版 md 提示词库默认值一致）
// ---------------------------------------------------------------------------

const promptText = {
  systemShape: [
    '{"summary":"本章细纲：150-250字讲清本章发生什么、冲突与结果",',
    '"outline":[{"title":"节点名（4-8字）","startPara":1,"endPara":5,"text":"该节点做了什么、为什么有效（40-80字）",',
    '"tags":[{"text":"钩子","tone":"hot"},{"text":"铺垫","tone":""}]}],',
    '"rhythm":[{"label":"维度名（如 开篇钩子/冲突密度/章末悬念）","value":"强/中/弱或数值","desc":"一句话点评"}],',
    '"setting":[{"name":"设定名","type":"类型（力量体系/地点/组织/道具等）","desc":"一句话说明","tags":["标签"]}],',
    '"relations":[{"from":"甲","to":"乙","relation":"关系（师徒/敌对等）","desc":"本章体现"}]}',
  ].join(''),
  goldenShape: [
    '{"hook300":"前300字用什么钩住读者、是否奏效（60-100字）",',
    '"characterEstablish":"主角人设是否立住、靠什么立住（60-100字）",',
    '"coreDilemma":"本章抛出的核心困境与读者期待（60-100字）",',
    '"anchors":[{"quote":"原文摘句（≤40字）","comment":"这句好在哪（≤40字）"}]}',
  ].join(''),
  reportShape: [
    '{"editorNotes":"编辑手记：这本书最值得学的两三点（120-200字）",',
    '"outlineRecovery":[{"stage":"阶段名","chapters":"1-10","goal":"该阶段目标","payoff":"兑现方式"}],',
    '"characterArcs":[{"name":"人物名","keyChapters":[1,5],"arc":"弧线概述（40-80字）"}],',
    '"foreshadowLedger":[{"item":"伏笔内容","plantChapter":1,"payoffChapter":8,"status":"recovered"}],',
    '"pacingCurve":[{"chapterNo":1,"score":4,"label":"开篇钩子"}],',
    '"reusableTechniques":["可直接套用的技巧1","技巧2"]}',
  ].join(''),
  chapterNote: [
    'outline 节点 3-6 个，按剧情顺序排列；startPara/endPara 是段落编号（对应正文里的 [n] 标号），',
    '节点区间按顺序覆盖、不重叠。tags 的 tone 只允许 "hot"（爽点/钩子类）或空串。',
  ].join('\n'),
  goldenNote: '这是全书前三章之一，额外产出 golden 黄金三章深拆（anchors 摘 2-3 句原文）。',
  chapterTask: '拆解本章：细纲、关键节点（带段落区间）、爽点节奏、世界观设定、人物关系。',
  reportNote: [
    'pacingCurve 按章给 1-5 的爽点强度分，每个已拆章一条；',
    'foreshadowLedger 的 status 只允许 "recovered"（已回收，payoffChapter 必填）或 "pending"（未回收，payoffChapter 填 0）。',
  ].join('\n'),
  reportTask: '汇总成全书拆解报告：大纲反推、人物弧线、伏笔账本、爽点曲线、可复用技巧、编辑手记。',
}

const jsonSystem = (shape: string, extra: string) => [
  '你是一位中文网文章节拆解分析师（资深网文编辑），负责把竞品内容拆成结构化分析结果。',
  '只输出一个 JSON 对象，禁止 Markdown、解释、额外前后缀。',
  `JSON 形状：${shape}`,
  '所有文案用中文，评语要具体可学习，不写空话；所有描述必须基于给到的章节内容，不得编造正文里不存在的关键事实。',
  extra,
].filter(Boolean).join('\n')

/** 单章拆解；前三章附带黄金三章深拆（golden 字段）。 */
export function chapterBreakdownPrompt(params: { bookTitle: string; chapterTitle: string; chapterNo: number; paragraphs: string[]; isGolden: boolean }): { system: string; user: string } {
  const numbered = params.paragraphs.map((text, index) => `[${index + 1}] ${text}`).join('\n')
  // golden 深拆是把黄金三章形状拼进单章形状的收尾大括号
  const merged = promptText.systemShape.replace(/\}\s*$/, `,"golden":${promptText.goldenShape}}`)
  const shape = params.isGolden ? (merged !== promptText.systemShape ? merged : `${promptText.systemShape}\ngolden 字段形状：${promptText.goldenShape}`) : promptText.systemShape
  const extra = [promptText.chapterNote, params.isGolden ? promptText.goldenNote : ''].filter(Boolean).join('\n')
  return {
    system: jsonSystem(shape, extra),
    user: [
      `【书名】${params.bookTitle}`,
      `【章节】第${params.chapterNo}章《${params.chapterTitle}》`,
      `【正文（段落已编号）】\n${numbered}`,
      `【任务】${promptText.chapterTask}`,
    ].join('\n\n'),
  }
}

/** 全书汇总报告：基于各章拆解产物聚合。 */
export function bookReportPrompt(params: { bookTitle: string; chapterBriefs: string[] }): { system: string; user: string } {
  return {
    system: jsonSystem(promptText.reportShape, promptText.reportNote),
    user: [
      `【书名】${params.bookTitle}`,
      `【各章拆解摘要】\n${params.chapterBriefs.join('\n')}`,
      `【任务】${promptText.reportTask}`,
    ].join('\n\n'),
  }
}

// ---------------------------------------------------------------------------
// AI 产物整形
// ---------------------------------------------------------------------------

/** 从模型回复里抠出 JSON 对象：容忍 Markdown 代码块与前后缀杂音。 */
export function extractJsonObject(raw: string): Record<string, unknown> {
  const text = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 内容，请重试')
  const candidate = text.slice(start, end + 1)
  try {
    const parsed: unknown = JSON.parse(candidate)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch { /* 落到底层括号配平 */ }
  let depth = 0
  let inString = false
  let escaped = false
  let objectStart = -1
  for (let index = start; index <= end; index += 1) {
    const ch = text[index]!
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') { if (depth === 0) objectStart = index; depth += 1 }
    else if (ch === '}') {
      depth -= 1
      if (depth === 0 && objectStart >= 0) {
        try {
          const parsed: unknown = JSON.parse(text.slice(objectStart, index + 1))
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
        } catch { /* 继续找下一个 */ }
      }
    }
  }
  throw new Error('模型返回的 JSON 无法解析，请重试')
}

const dims = (list: unknown, fields: string[]): Record<string, string | string[]>[] => (Array.isArray(list) ? list : [])
  .map(item => Object.fromEntries(fields.map(field => [field, field === 'tags'
    ? (Array.isArray((item as Record<string, unknown>)?.tags) ? ((item as Record<string, unknown>).tags as unknown[]).map(asText).filter(Boolean) : [])
    : asText((item as Record<string, unknown>)?.[field])])))
  .filter(item => Object.values(item).some(value => (Array.isArray(value) ? value.length : value)))

/**
 * 把模型 JSON 整成 analysis 与段落高亮映射：节点段落区间裁剪到正文范围内，
 * 区间按顺序打点，已打点的段落不重复覆盖。
 */
export function normalizeChapterAnalysis(parsed: Record<string, unknown>, paragraphCount: number): { analysis: BreakdownAnalysis; insightIds: Array<number | null> } {
  const insightIds: Array<number | null> = Array.from({ length: paragraphCount }, () => null)
  const outline: BreakdownOutlineNode[] = []
  const rawOutline = Array.isArray(parsed.outline) ? parsed.outline : []
  rawOutline.forEach((node, index) => {
    const record = (node || {}) as Record<string, unknown>
    const title = asText(record.title)
    if (!title) return
    const id = index + 1
    const start = Math.max(1, Math.min(paragraphCount, Math.round(Number(record.startPara)) || 1))
    const end = Math.max(start, Math.min(paragraphCount, Math.round(Number(record.endPara)) || start))
    for (let paragraph = start; paragraph <= end; paragraph += 1) {
      if (insightIds[paragraph - 1] === null) insightIds[paragraph - 1] = id
    }
    outline.push({
      id,
      title,
      range: `${start}-${end}段`,
      text: asText(record.text),
      tags: Array.isArray(record.tags)
        ? record.tags.map(tag => ({ text: asText((tag as Record<string, unknown>).text), tone: asText((tag as Record<string, unknown>).tone) || undefined })).filter(tag => tag.text)
        : [],
    })
  })
  const golden = parsed.golden
  const analysis: BreakdownAnalysis = {
    summary: asText(parsed.summary),
    outline,
    rhythm: dims(parsed.rhythm, ['label', 'value', 'desc']) as unknown as BreakdownRhythmItem[],
    setting: dims(parsed.setting, ['name', 'type', 'desc', 'tags']) as unknown as BreakdownSettingItem[],
    relations: dims(parsed.relations, ['from', 'to', 'relation', 'desc']) as unknown as BreakdownRelationItem[],
  }
  if (golden && typeof golden === 'object') {
    const record = golden as Record<string, unknown>
    analysis.golden = {
      hook300: asText(record.hook300),
      characterEstablish: asText(record.characterEstablish),
      coreDilemma: asText(record.coreDilemma),
      anchors: Array.isArray(record.anchors)
        ? record.anchors.map(anchor => ({ quote: asText((anchor as Record<string, unknown>).quote), comment: asText((anchor as Record<string, unknown>).comment) })).filter(anchor => anchor.quote)
        : [],
    }
  }
  // 产物是否可用（有细纲或节点）由调用方判定，保证读取旧存档时不误丢仅含节奏/设定的数据
  return { analysis, insightIds }
}

/** 读取存档时校验 analysis 形状：段落区间从已生成的 range 文本还原。 */
export function normalizeAnalysis(value: unknown, paragraphCount: number): BreakdownAnalysis | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const outline = Array.isArray(source.outline) ? source.outline : []
  const withRanges = outline.map((node, index) => {
    const record = (node || {}) as Record<string, unknown>
    const matched = asText(record.range).match(/(\d+)\s*-\s*(\d+)/)
    return {
      ...record,
      title: asText(record.title) || `节点${index + 1}`,
      startPara: matched ? Number(matched[1]) : 1,
      endPara: matched ? Number(matched[2]) : Number(matched?.[1]) || 1,
    }
  })
  try {
    const analysis = normalizeChapterAnalysis({ ...source, outline: withRanges }, paragraphCount).analysis
    const empty = !analysis.summary && !analysis.outline.length && !analysis.rhythm.length && !analysis.setting.length && !analysis.relations.length
    return empty ? null : analysis
  } catch {
    return null
  }
}

/** 人物关系里的名字滚动聚合进项目，供"主要角色"计数。 */
export function mergeCharacterNames(project: BreakdownProject, analysis: BreakdownAnalysis): void {
  const names = new Set(project.characterNames)
  for (const relation of analysis.relations || []) {
    if (relation.from) names.add(relation.from)
    if (relation.to) names.add(relation.to)
  }
  project.characterNames = [...names]
  project.characterCount = names.size
}

// ---------------------------------------------------------------------------
// 存储
// ---------------------------------------------------------------------------

function normalizeChapter(value: unknown, index: number): BreakdownChapter | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<BreakdownChapter>
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs.filter(p => typeof p === 'string').slice(0, BREAKDOWN_MAX_PARAGRAPHS) : []
  const status: BreakdownStatus = ['wait', 'processing', 'done', 'failed'].includes(String(source.status)) ? source.status as BreakdownStatus : 'wait'
  return {
    id: typeof source.id === 'string' && source.id ? source.id : newId(),
    title: typeof source.title === 'string' && source.title.trim() ? source.title : `第${index + 1}章`,
    // 应用中途关闭留下的 processing 读作 failed（可重试）
    status: status === 'processing' ? 'failed' : status,
    wordCount: typeof source.wordCount === 'number' && Number.isFinite(source.wordCount) ? source.wordCount : 0,
    sortNo: typeof source.sortNo === 'number' && Number.isFinite(source.sortNo) ? source.sortNo : index + 1,
    errorMessage: typeof source.errorMessage === 'string' ? source.errorMessage : undefined,
    paragraphs,
    analysis: normalizeAnalysis(source.analysis, paragraphs.length),
    insightIds: Array.isArray(source.insightIds) && source.insightIds.length === paragraphs.length
      ? source.insightIds.map(id => (typeof id === 'number' && Number.isFinite(id) ? id : null))
      : paragraphs.map(() => null),
  }
}

export function normalizeReport(value: unknown): BreakdownReport | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const list = (input: unknown, fields: string[]): Record<string, unknown>[] => (Array.isArray(input) ? input : [])
    .map(item => {
      const record = (item || {}) as Record<string, unknown>
      const keyChapters = Array.isArray(record.keyChapters) ? record.keyChapters.map(Number).filter(Number.isFinite) : []
      return Object.fromEntries(fields.map(field => [field, field === 'keyChapters'
        ? keyChapters
        : field === 'payoffChapter' || field === 'plantChapter' || field === 'chapterNo' || field === 'score'
          ? Number(record?.[field]) || 0
          : asText(record?.[field])]))
    })
    .filter(item => Object.values(item).some(value => (Array.isArray(value) ? value.length : value)))
  const report: BreakdownReport = {
    editorNotes: asText(source.editorNotes),
    outlineRecovery: list(source.outlineRecovery, ['stage', 'chapters', 'goal', 'payoff']) as unknown as BreakdownReport['outlineRecovery'],
    characterArcs: list(source.characterArcs, ['name', 'keyChapters', 'arc']) as unknown as BreakdownReport['characterArcs'],
    foreshadowLedger: list(source.foreshadowLedger, ['item', 'plantChapter', 'payoffChapter', 'status'])
      .map(item => ({ ...item, status: item.status === 'recovered' ? 'recovered' : 'pending' })) as unknown as BreakdownReport['foreshadowLedger'],
    pacingCurve: list(source.pacingCurve, ['chapterNo', 'score', 'label']) as unknown as BreakdownReport['pacingCurve'],
    reusableTechniques: Array.isArray(source.reusableTechniques) ? source.reusableTechniques.map(asText).filter(Boolean) : [],
  }
  return report.editorNotes || report.outlineRecovery.length || report.reusableTechniques.length ? report : null
}

/** 归一化单个项目：字段不合法就返回 null，旧存档缺的字段在这里补齐。 */
export function normalizeProject(value: unknown): BreakdownProject | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<BreakdownProject>
  if (typeof source.id !== 'string' || !Array.isArray(source.chapters)) return null
  const chapters = source.chapters.map(normalizeChapter).filter((item): item is BreakdownChapter => item !== null)
    .sort((a, b) => a.sortNo - b.sortNo).slice(0, BREAKDOWN_MAX_CHAPTERS)
  if (!chapters.length) return null
  const project: BreakdownProject = {
    id: source.id,
    title: typeof source.title === 'string' && source.title.trim() ? source.title : '未命名拆书',
    author: typeof source.author === 'string' ? source.author : '',
    tags: Array.isArray(source.tags) ? source.tags.filter(tag => typeof tag === 'string' && tag.trim()).slice(0, 12) : [],
    mood: typeof source.mood === 'string' ? source.mood : '',
    characterCount: 0,
    wordCount: 0,
    chapterCount: 0,
    progress: 0,
    status: 'wait',
    createTime: typeof source.createTime === 'string' && Number.isFinite(Date.parse(source.createTime)) ? source.createTime : nowIso(),
    updateTime: typeof source.updateTime === 'string' && Number.isFinite(Date.parse(source.updateTime)) ? source.updateTime : nowIso(),
    chapters,
    report: normalizeReport(source.report),
    characterNames: Array.isArray(source.characterNames)
      ? Array.from(new Set(source.characterNames.filter((name): name is string => typeof name === 'string' && !!name.trim()).map(name => name.trim())))
      : [],
    materials: { character: [], rhythm: [], setting: [], outline: [], technique: [] },
  }
  // 素材一律由当前章节与报告重新聚合，旧存档缺这个字段也能补上
  recalcBreakdownProject(project)
  return project
}

export function loadBreakdownStore(): BreakdownStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BREAKDOWN_STORAGE_KEY) || 'null')
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { projects?: unknown }).projects)) {
      const projects = (parsed as BreakdownStore).projects.map(normalizeProject).filter((item): item is BreakdownProject => item !== null)
      return { version: 1, projects: projects.slice(0, BREAKDOWN_MAX_PROJECTS) }
    }
  } catch { /* 损坏数据保留在浏览器里，不自动覆盖 */ }
  return emptyStore()
}

export function saveBreakdownStore(store: BreakdownStore): void {
  localStorage.setItem(BREAKDOWN_STORAGE_KEY, JSON.stringify({ version: 1, projects: store.projects.slice(0, BREAKDOWN_MAX_PROJECTS) }))
}

export function exportBreakdownStore(store: BreakdownStore): string {
  return JSON.stringify({ format: BREAKDOWN_FILE_FORMAT, projects: store.projects.slice(0, BREAKDOWN_MAX_PROJECTS) }, null, 2)
}

/** 导入的拆书项目整体重分配 ID；章节正文与分析一并带入。 */
export function importBreakdownStore(value: unknown): BreakdownProject[] {
  if (!value || typeof value !== 'object') throw new Error('不是有效的拆书文件')
  const payload = value as { format?: unknown; projects?: unknown }
  if (payload.format !== BREAKDOWN_FILE_FORMAT || !Array.isArray(payload.projects) || payload.projects.length > BREAKDOWN_MAX_PROJECTS) {
    throw new Error(`拆书文件格式不受支持或项目超过 ${BREAKDOWN_MAX_PROJECTS} 个。`)
  }
  const imported: BreakdownProject[] = []
  for (const item of payload.projects) {
    const project = normalizeProject(item)
    if (project) imported.push({ ...project, id: newId() })
  }
  if (!imported.length) throw new Error('文件里没有可导入的拆书项目')
  return imported
}

/** 备份合并：同 ID 保留较新更新的一份，不重分配 ID，避免同一份备份重复导入越攒越多 */
export function mergeBreakdownProjects(current: BreakdownProject[], incoming: BreakdownProject[]): BreakdownProject[] {
  const byId = new Map<string, BreakdownProject>()
  for (const project of [...current, ...incoming]) {
    const prev = byId.get(project.id)
    if (!prev || project.updateTime > prev.updateTime) byId.set(project.id, project)
  }
  return [...byId.values()].slice(0, BREAKDOWN_MAX_PROJECTS)
}

/** 从全量备份里取拆书项目：整体结构不对就当没有，单个坏了只跳过那个 */
export function breakdownProjectsFromBackup(value: unknown): BreakdownProject[] {
  if (!value || typeof value !== 'object') return []
  const projects = (value as { projects?: unknown }).projects
  if (!Array.isArray(projects)) return []
  return projects
    .map(item => normalizeProject(item))
    .filter((item): item is BreakdownProject => item !== null)
}

// ---------------------------------------------------------------------------
// Markdown 导出
// ---------------------------------------------------------------------------

export function buildBreakdownMarkdown(project: BreakdownProject): string {
  const lines: string[] = [
    `# 《${project.title}》拆书报告`,
    '',
    `- 总字数：${project.wordCount}`,
    `- 章节数：${project.chapterCount}`,
    `- 已拆解：${project.chapters.filter(item => item.status === 'done').length} 章`,
    '',
  ]
  const filledKinds = breakdownMaterialKinds.filter(kind => project.materials[kind].length)
  if (filledKinds.length) {
    lines.push('## 分类素材', '', '> 按类型汇总，可直接取用进建书流程。', '')
    for (const kind of filledKinds) {
      lines.push(`### ${breakdownMaterialLabels[kind]}`, '')
      for (const item of project.materials[kind]) {
        const from = item.chapterSortNo ? `第${item.chapterSortNo}章` : '全书报告'
        lines.push(`- ${item.label ? `${item.label}：` : ''}${item.text}（${from}）`)
      }
      lines.push('')
    }
  }
  const report = project.report
  if (report) {
    lines.push('## 全书汇总')
    if (report.editorNotes) lines.push('', '### 编辑手记', '', report.editorNotes)
    if (report.outlineRecovery.length) {
      lines.push('', '### 大纲反推', '')
      report.outlineRecovery.forEach(item => lines.push(`- ${item.stage}（${item.chapters}）：${item.goal}${item.payoff ? `；兑现：${item.payoff}` : ''}`))
    }
    if (report.characterArcs.length) {
      lines.push('', '### 人物弧线', '')
      report.characterArcs.forEach(item => lines.push(`- ${item.name}：${item.arc}`))
    }
    if (report.foreshadowLedger.length) {
      lines.push('', '### 伏笔账本', '')
      report.foreshadowLedger.forEach(item => lines.push(`- 第${item.plantChapter}章埋设${item.status === 'recovered' ? ` → 第${item.payoffChapter}章回收` : '（未回收）'}：${item.item}`))
    }
    if (report.reusableTechniques.length) {
      lines.push('', '### 可复用技巧', '')
      report.reusableTechniques.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
    }
    lines.push('')
  }
  for (const chapter of [...project.chapters].sort((a, b) => a.sortNo - b.sortNo)) {
    if (chapter.status !== 'done' || !chapter.analysis) continue
    const analysis = chapter.analysis
    // 标题里已带「第N章」时不重复编号，未识别的标题（序幕/尾声等）才补章节序号
    const heading = txtChapterPattern.test(chapter.title) ? chapter.title : `第${chapter.sortNo}章 ${chapter.title}`
    lines.push(`## ${heading}`, '')
    if (analysis.summary) lines.push(`**细纲**：${analysis.summary}`, '')
    if (analysis.outline.length) {
      lines.push('**关键节点**：', '')
      analysis.outline.forEach(node => lines.push(`- ${node.title}（${node.range}）：${node.text}${node.tags.length ? `【${node.tags.map(tag => tag.text).join('、')}】` : ''}`))
      lines.push('')
    }
    if (analysis.rhythm.length) {
      lines.push('**爽点节奏**：', '')
      analysis.rhythm.forEach(item => lines.push(`- ${item.label}${item.value ? `（${item.value}）` : ''}：${item.desc}`))
      lines.push('')
    }
    if (analysis.setting.length) {
      lines.push('**世界观设定**：', '')
      analysis.setting.forEach(item => lines.push(`- ${item.name}${item.type ? `·${item.type}` : ''}：${item.desc}`))
      lines.push('')
    }
    if (analysis.relations.length) {
      lines.push('**人物关系**：', '')
      analysis.relations.forEach(item => lines.push(`- ${item.from} → ${item.to}（${item.relation}）：${item.desc}`))
      lines.push('')
    }
  }
  return lines.join('\n')
}

export const breakdownStatusLabel: Record<BreakdownStatus, string> = { wait: '待拆解', processing: '拆解中', done: '已拆解', failed: '失败' }
