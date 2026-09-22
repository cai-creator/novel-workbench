import { createBook, now, uid, type Book, type Chapter } from './storage'
import { writeStorage } from './quota'

export type WorkflowField = 'idea' | 'title' | 'outline' | 'world' | 'characters' | 'timeline'
export interface WorkflowDraft {
  step: 1 | 2 | 3 | 4
  title: string
  genre: string
  audience: string
  tone: string
  seed: string
  idea: string
  outline: string
  world: string
  characters: string
  timeline: string
}

const LEGACY_STORAGE_KEY = 'novel-workbench-next/workflow-v1'
const ARCHIVE_STORAGE_KEY = 'novel-workbench-next/workflow-archive-v2'
const ARCHIVE_FILE_FORMAT = 'novel-workbench-next/workflow-archive-v2'
export const emptyWorkflow = (): WorkflowDraft => ({ step: 1, title: '', genre: '', audience: '', tone: '', seed: '', idea: '', outline: '', world: '', characters: '', timeline: '' })

export interface WorkflowRecord {
  id: string
  status: 'draft' | 'completed'
  draft: WorkflowDraft
  updatedAt: string
  completedAt?: string
  bookId?: string
}
export interface WorkflowArchive {
  version: 2
  activeId: string | null
  records: WorkflowRecord[]
}

const emptyArchive = (): WorkflowArchive => ({ version: 2, activeId: null, records: [] })
const draftFields = ['title', 'genre', 'audience', 'tone', 'seed', 'idea', 'outline', 'world', 'characters', 'timeline'] as const
function normalizeDraft(value: unknown): WorkflowDraft {
  const draft = emptyWorkflow()
  if (!value || typeof value !== 'object') return draft
  const source = value as Record<string, unknown>
  for (const key of draftFields) if (typeof source[key] === 'string') draft[key] = source[key] as string
  if ([1, 2, 3, 4].includes(Number(source.step))) draft.step = Number(source.step) as WorkflowDraft['step']
  return draft
}
const hasDraftContent = (draft: WorkflowDraft) => draftFields.some(key => draft[key].trim())
export function createWorkflowRecord(draft: WorkflowDraft = emptyWorkflow()): WorkflowRecord {
  return { id: uid(), status: 'draft', draft: { ...draft }, updatedAt: now() }
}

/** 首次读取时接续旧版单草稿；原值在成功保存新版记录后才删除。 */
export function loadWorkflowArchive(): WorkflowArchive {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) || 'null')
    if (value && typeof value === 'object') {
      const source = value as Partial<WorkflowArchive>
      if (source.version === 2 && Array.isArray(source.records)) {
        const records = source.records.filter(item => item && typeof item.id === 'string' &&
          ['draft', 'completed'].includes(item.status) && typeof item.updatedAt === 'string' &&
          Number.isFinite(Date.parse(item.updatedAt)))
          .map(item => ({ id: item.id, status: item.status, draft: normalizeDraft(item.draft), updatedAt: item.updatedAt,
            completedAt: typeof item.completedAt === 'string' && Number.isFinite(Date.parse(item.completedAt)) ? item.completedAt : undefined,
            bookId: typeof item.bookId === 'string' ? item.bookId : undefined }))
        const activeId = records.some(item => item.id === source.activeId && item.status === 'draft') ? source.activeId! : null
        return { version: 2, records, activeId }
      }
    }
  } catch { /* 无法读取的记录保留在原存储键，不自动覆盖 */ }
  try {
    const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null')
    const draft = normalizeDraft(legacy)
    if (hasDraftContent(draft)) {
      const record = createWorkflowRecord(draft)
      return { version: 2, activeId: record.id, records: [record] }
    }
  } catch { /* 无法读取的旧草稿保留在原存储键 */ }
  return emptyArchive()
}
export function saveWorkflowArchive(archive: WorkflowArchive): void {
  writeStorage(ARCHIVE_STORAGE_KEY, archive)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}
export function exportWorkflowArchive(archive: WorkflowArchive): string {
  return JSON.stringify({ format: ARCHIVE_FILE_FORMAT, records: archive.records }, null, 2)
}
/** 导入的记录重新分配 ID；作品内容仍需单独导入，完成记录不会自动绑定作品。 */
export function importWorkflowArchive(value: unknown): WorkflowRecord[] {
  if (!value || typeof value !== 'object') throw new Error('不是有效的建书记录文件')
  const payload = value as { format?: unknown; records?: unknown }
  if (payload.format !== ARCHIVE_FILE_FORMAT || !Array.isArray(payload.records) || payload.records.length > 200 ||
      !payload.records.every(item => item && typeof item === 'object' &&
        ['draft', 'completed'].includes(item.status) && item.draft && typeof item.draft === 'object')) {
    throw new Error('建书记录文件格式不受支持或记录超过 200 条。')
  }
  return payload.records.map(item => ({
    id: uid(), status: item.status as WorkflowRecord['status'], draft: normalizeDraft(item.draft),
    updatedAt: typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) ? item.updatedAt : now(),
    completedAt: typeof item.completedAt === 'string' && Number.isFinite(Date.parse(item.completedAt)) ? item.completedAt : undefined,
  }))
}

export function parseChapterPlan(outline: string): { title: string; outline: string }[] {
  const result: { title: string; outline: string }[] = []
  for (const raw of outline.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-*•]\s*/, '')
    const match = line.match(/^(第[一二三四五六七八九十百千万零〇两0-9]+章)\s*(?:[:：|｜—-]\s*)?(.*)$/)
    if (!match) continue
    const [name, ...details] = match[2].split(/[｜|]/).map(part => part.trim()).filter(Boolean)
    result.push({ title: [match[1], name].filter(Boolean).join(' '), outline: details.join('；') || name || '' })
    if (result.length === 20) break
  }
  return result
}

export function buildBookFromWorkflow(draft: WorkflowDraft): Book {
  if (!draft.title.trim()) throw new Error('请先填写作品名称')
  const book = createBook(draft.title)
  book.premise = (draft.idea || draft.seed).trim()
  const addLore = (mode: Book['lore'][number]['mode'], title: string, content: string) => {
    if (content.trim()) book.lore.push({ id: uid(), mode, title, content: content.trim() })
  }
  addLore('plot', '创作方向', [`类型：${draft.genre}`, `目标读者：${draft.audience}`, `叙事风格：${draft.tone}`].filter(line => !line.endsWith('：')).join('\n'))
  addLore('plot', '故事主线与章节规划', draft.outline)
  addLore('world', '世界规则', draft.world)
  addLore('character', '主要人物', draft.characters)
  addLore('timeline', '故事时间线', draft.timeline)
  const chapters = parseChapterPlan(draft.outline)
  if (chapters.length) book.chapters = chapters.map((part): Chapter => ({ id: uid(), title: part.title, outline: part.outline, content: '', updatedAt: now() }))
  return book
}

export function workflowPrompt(field: WorkflowField, draft: WorkflowDraft): { system: string; user: string } {
  const context = [
    `类型：${draft.genre || '未定'}`,
    `目标读者：${draft.audience || '未定'}`,
    `叙事风格：${draft.tone || '未定'}`,
    `原始灵感：${draft.seed || '未填写'}`,
    `已确定创意：${draft.idea || '未填写'}`,
    `书名：${draft.title || '未定'}`,
    `故事大纲：${draft.outline || '未填写'}`,
    `世界设定：${draft.world || '未填写'}`,
    `人物设定：${draft.characters || '未填写'}`,
  ].join('\n')
  const tasks: Record<WorkflowField, string> = {
    idea: '将原始灵感发展成一条适合连载小说的创意，140—220 字。写明主角的迫切目标、阻力、独特机制、失败代价与第一章悬念。只给可直接采用的创意正文。',
    title: '给这个故事取一个简洁、有辨识度的中文书名。只输出一个书名，不加书名号、解释或备选。',
    outline: '写出可执行的故事主线与前 8 章规划。先用一段话说明主线冲突与阶段转折，再逐行按“第1章｜标题｜具体事件、阻碍和结尾钩子”的格式列出 8 章。每章都推进因果，避免重复遭遇和空泛分析。',
    world: '写可直接收录的世界设定：核心规则、边界、代价、例外、社会影响，以及两处可推动剧情的矛盾。与已有创意和大纲保持一致。',
    characters: '写 3 位主要人物的可用角色卡。每人写姓名、当前目标、弱点或秘密、与主角的关系、关键选择和可能变化。人物行动须与故事主线发生因果联系。',
    timeline: '根据已确定创意和大纲，写一份故事内时间线。每行按“时间｜事件｜造成的后果”书写，至少 6 个关键事件；时间可以用第一天、第二天等相对标记，前后顺序必须自洽。',
  }
  return {
    system: '你是中文连载小说的共创写手。把用户已确定的内容视为约束，输出可以直接编辑和采用的稿件，不写思维过程、免责声明或 Markdown 代码块。',
    user: `${context}\n\n本次任务：${tasks[field]}`,
  }
}
