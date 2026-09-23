import type { Book, Mode, ModelSettings } from './storage'
import { chatEndpoint, modelRequestBody } from './model'

function responseText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(part =>
    typeof part === 'string' ? part :
    part && typeof part === 'object' && 'text' in part ? String(part.text) : ''
  ).join('')
  return ''
}

export async function requestChatCompletion(args: {
  model: ModelSettings
  system: string
  user: string
  signal: AbortSignal
  maxTokens?: number
  /** 输出因长度上限被截断但已有可用片段时回调：调用方借此给内容补「未写完」提示。 */
  onTruncated?: (message: string) => void
}): Promise<string> {
  const { model, system, user, signal, maxTokens } = args
  if (!model.model.trim()) throw new Error('请先在模型设置中填写模型 ID')
  const url = chatEndpoint(model.baseUrl)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(model.apiKey.trim() ? { Authorization: `Bearer ${model.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify(modelRequestBody({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], maxTokens, stream: false })),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw new Error('已停止生成')
    throw new Error(`连接模型失败：${error instanceof Error ? error.message : String(error)}。请检查 API 地址、网络或浏览器跨域限制。`)
  }
  const raw = await response.text()
  let data: any
  try { data = JSON.parse(raw) } catch { throw new Error(`模型返回非 JSON 内容（HTTP ${response.status}）：${raw.slice(0, 220)}`) }
  if (!response.ok || data?.error) {
    const detail = data?.error?.message || data?.message || raw.slice(0, 220)
    throw new Error(`模型请求失败（HTTP ${response.status}）：${detail}`)
  }
  const content = responseText(data?.choices?.[0]?.message?.content).trim()
  if (!content) throw new Error('模型没有返回可用内容。请检查模型 ID 和账户权限。')
  // 截断不整条丢弃：已生成的片段照常返回，是否可用由调用方结合提示判断
  if (data?.choices?.[0]?.finish_reason === 'length') {
    args.onTruncated?.('模型输出达到长度上限被截断，已保留未写完的片段。')
  }
  return content
}

export async function generateDraft(args: {
  model: ModelSettings
  book: Book
  chapterId: string
  mode: Mode
  instruction: string
  signal: AbortSignal
}): Promise<string> {
  const { model, book, chapterId, mode, instruction, signal } = args
  const chapter = book.chapters.find(item => item.id === chapterId)
  const brief = [
    `作品：${book.title}`,
    book.premise && `故事概念：${book.premise}`,
    ...book.lore.slice(-20).map(item => `${({ world: '世界观', character: '人物设定', timeline: '时间线', plot: '剧情规划' })[item.mode]}｜${item.timeLabel ? `${item.timeLabel}｜` : ''}${item.title}：${item.content.slice(0, 800)}`),
    chapter && `当前章节：${chapter.title}\n本章提纲：${chapter.outline || '未填写'}\n已有正文（末尾）：${chapter.content.slice(-5000)}`,
  ].filter(Boolean).join('\n\n')
  const task: Record<Mode, string> = {
    prose: '直接写可用的小说正文，承接已有正文，不复述前文。写出具体动作、感官、对话与冲突推进；不要解释思路、不要标题或 Markdown。',
    world: '写出可直接收录到作品设定库的世界观条目，明确规则、边界、代价和对剧情的影响。不要空泛建议。',
    character: '写出可直接收录的人物设定，含欲望、弱点、矛盾、关系和可变化的行动。不要空泛建议。',
    plot: '写出可直接收录的后续剧情方案，包含目标、阻碍、转折、代价及下一章钩子。不要空泛建议。',
  }
  return requestChatCompletion({ model, system: `你是小说共创写手。保持人物和设定一致。${task[mode]}`, user: `${brief}\n\n本次要求：${instruction.trim()}`, signal })
}

/** 根据已确认的作品资料与相邻章节写可审阅的正文候选，不修改作品。 */
export function chapterProsePrompt(book: Book, chapterId: string, instruction: string, targetLength: number, kind: 'continue' | 'rewrite' = 'continue'): { system: string; user: string } {
  const index = book.chapters.findIndex(item => item.id === chapterId)
  if (index < 0) throw new Error('目标章节已不存在')
  const chapter = book.chapters[index]
  const previous = book.chapters[index - 1]
  const next = book.chapters[index + 1]
  const lore = book.lore.slice(-24).map(item => `${({ world: '世界规则', character: '人物', timeline: '时间线', plot: '剧情规划' })[item.mode]}｜${item.title}：${item.content.slice(0, 600)}`).join('\n')
  return {
    system: '你是中文连载小说的正文写手。只交付可以直接刊入章节的小说正文，不输出标题、提纲、解释、创作建议、Markdown 或“以下是”。保持既有世界规则、人物性格、视角与时间顺序一致。用行动、场景、对话和具体细节推动冲突，避免总结式叙述和空泛抒情。不要提前写完下一章的事件。',
    user: [
      `作品：《${book.title}》`,
      book.premise && `故事核心：${book.premise.slice(0, 1600)}`,
      lore && `已确认的作品资料：\n${lore}`,
      previous && `上一章「${previous.title}」结尾（仅用于承接，不要重复）：\n${previous.content.slice(-2600) || previous.outline?.slice(-800) || '暂无'}`,
      `当前章节：${chapter.title}\n本章提纲：${chapter.outline?.trim() || '尚未填写，请按作品核心和前文自然推进。'}`,
      chapter.scenePlan?.approved && chapter.scenePlan.beats.length
        ? `已确认的事件与场景顺序（必须全部覆盖，不得改变顺序）：\n${chapter.scenePlan.beats.map((beat, index) => `${index + 1}. [${beat.kind === 'scene' ? '场景' : '事件'}] ${beat.text}`).join('\n')}`
        : '本章尚未确认事件与场景框架。',
      chapter.content.trim() && (kind === 'rewrite' ? `本章现稿（只作参考；请重新构思写法，不要逐句改写）：\n${chapter.content.slice(0, 2600)}` : `本章已有正文结尾（直接接上，不要重复）：\n${chapter.content.slice(-2600)}`),
      next?.outline && `下一章边界（留伏笔，不提前展开）：${next.outline.slice(0, 500)}`,
      `本次目标：约 ${targetLength} 个汉字，写出完整场景和至少一次明确推进。${kind === 'rewrite' || !chapter.content.trim() ? '从本章开头写一份完整的新稿，与现稿可独立比较。' : '接续本章已有正文，不重复开头。'}`,
      instruction.trim() && `作者额外要求：${instruction.trim().slice(0, 1200)}`,
    ].filter(Boolean).join('\n\n'),
  }
}

export async function generateChapterProse(args: { model: ModelSettings; book: Book; chapterId: string; instruction: string; targetLength: number; kind: 'continue' | 'rewrite'; signal: AbortSignal; onTruncated?: (message: string) => void }): Promise<string> {
  const { model, book, chapterId, instruction, targetLength, kind, signal, onTruncated } = args
  const prompt = chapterProsePrompt(book, chapterId, instruction, targetLength, kind)
  return requestChatCompletion({ model, system: prompt.system, user: prompt.user, signal, maxTokens: Math.min(8000, Math.max(2400, targetLength * 3)), onTruncated })
}

export type SelectionAction = 'polish' | 'expand' | 'proofread' | 'custom'

const SELECTION_TASKS: Record<SelectionAction, string> = {
  polish: '润色以下文字：保持原意、人物口吻与情节不变，让表达更准确、更有画面感。',
  expand: '扩写以下文字：补充具体的动作、感官、对话或环境细节，不改变情节走向和结果。',
  proofread: '校对以下文字：纠正错别字、语法、标点和拗口重复，保持原意与风格。',
  custom: '按作者的要求修改以下文字，未提及的部分保持原样。',
}

/** 对正文选区做定向修改，只返回修改后的片段，由界面替换原选区。 */
export async function refineSelection(args: {
  model: ModelSettings
  book: Book
  chapterId: string
  action: SelectionAction
  text: string
  instruction?: string
  signal: AbortSignal
}): Promise<string> {
  const { model, book, chapterId, action, text, instruction, signal } = args
  const chapter = book.chapters.find(item => item.id === chapterId)
  const context = [
    `作品：《${book.title}》`,
    book.premise && `故事核心：${book.premise.slice(0, 800)}`,
    chapter && `当前章节：${chapter.title}`,
    chapter?.outline?.trim() && `本章提纲：${chapter.outline.slice(0, 500)}`,
  ].filter(Boolean).join('\n')
  return requestChatCompletion({
    model,
    system: '你是中文小说的细读编辑。只输出修改后的正文片段，不要解释思路、不要标题、不要 Markdown、不要引号。',
    user: `${context}\n\n${SELECTION_TASKS[action]}\n\n原文：\n${text}${action === 'custom' && instruction?.trim() ? `\n\n作者要求：${instruction.trim().slice(0, 800)}` : ''}`,
    signal,
    maxTokens: Math.min(2400, Math.max(600, Math.ceil(text.length * 3))),
  })
}
