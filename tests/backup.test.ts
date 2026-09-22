import { equal, ok, test } from './harness'
import { BACKUP_SIZE_LIMIT, bookToTxt, buildWorkspaceBackup, chapterToTxt, mergeSideStores, mergeWorkflowRecords, mergeWorkspaceBackup, parseWorkspaceBackup, safeFileName, serializeWorkspaceBackup } from '../src/backup'
import { emptyStatsState, recordWords, type StatsState } from '../src/stats'
import type { Book, Chapter, ProjectData } from '../src/storage'
import type { WorkflowRecord } from '../src/workflow'
import type { RankSnapshotDoc } from '../src/rank'
import type { BreakdownProject } from '../src/breakdown'

const chapter = (id: string, title: string, content: string): Chapter => ({ id, title, content, updatedAt: '2026-09-20T00:00:00.000Z' })
const book = (id: string, title: string, chapters: Chapter[]): Book => ({ id, title, premise: '', chapters, lore: [], chat: [], updatedAt: '2026-09-20T00:00:00.000Z' })
const project = (books: Book[], notes: ProjectData['notes'] = []): ProjectData => ({ version: 2, books, model: { baseUrl: '', model: '', apiKey: '' }, stats: emptyStatsState(), notes })

test('备份文件可序列化并被解析回同样内容', () => {
  const data = project([book('b1', '夜行者档案', [chapter('c1', '第一章', '正文一')])])
  const backup = buildWorkspaceBackup(data, { version: 2, activeId: null, records: [] }, '2026-09-22T10:00:00.000Z')
  equal(backup.counts, { books: 1, chapters: 1, notes: 0, records: 0 })
  const parsed = parseWorkspaceBackup(JSON.parse(serializeWorkspaceBackup(backup)))
  ok(parsed !== null, '备份应能解析')
  equal(parsed?.data.books[0].title, '夜行者档案')
  equal(parsed?.exportedAt, '2026-09-22T10:00:00.000Z')
})

test('格式错误或数据损坏的备份被拒绝', () => {
  equal(parseWorkspaceBackup(null), null)
  equal(parseWorkspaceBackup({}), null)
  equal(parseWorkspaceBackup({ format: 'other', exportedAt: '2026-09-22T10:00:00.000Z', data: {} }), null)
  equal(parseWorkspaceBackup({ format: 'novel-workbench-next/backup-v1', exportedAt: 'not-a-date', data: {} }), null)
  const broken = { format: 'novel-workbench-next/backup-v1', exportedAt: '2026-09-22T10:00:00.000Z', data: { version: 2, books: 'nope' } }
  equal(parseWorkspaceBackup(broken), null)
})

test('备份里的畸形 draft 归一为安全草稿，不再冻结历史列表与建书页', () => {
  const parsed = parseWorkspaceBackup({
    format: 'novel-workbench-next/backup-v1',
    exportedAt: '2026-09-22T10:00:00.000Z',
    data: project([]),
    workflow: {
      version: 2,
      activeId: 'r1',
      records: [
        { id: 'r1', status: 'draft', updatedAt: '2026-09-21T00:00:00.000Z', draft: {} },
        { id: 'r2', status: 'draft', updatedAt: '2026-09-21T00:00:00.000Z', draft: { title: 42, outline: { bad: true }, step: 9 } },
        { id: 'r3', status: 'draft', updatedAt: '2026-09-21T00:00:00.000Z', draft: { title: '  正常标题 ', step: 3 } },
        { id: 'r4', status: 'draft', updatedAt: '2026-09-21T00:00:00.000Z', draft: '不是对象' },
      ],
    },
  })
  ok(parsed !== null, '备份本身仍可解析')
  const records = parsed?.workflow?.records || []
  equal(records.length, 3, 'draft 非对象的记录被剔除')
  const r1 = records.find(item => item.id === 'r1')!
  equal(r1.draft.title, '', '缺失字段补空串，title.trim() 不再崩')
  equal(r1.draft.step, 1, '缺失步骤回落第 1 步')
  const r2 = records.find(item => item.id === 'r2')!
  equal(r2.draft.title, '', '非字符串书名重置为空')
  equal(r2.draft.outline, '', '非字符串大纲重置为空，parseChapterPlan 不再崩')
  equal(r2.draft.step, 1, '越界步骤重置为第 1 步，workflowSteps[step-1] 不再越界')
  const r3 = records.find(item => item.id === 'r3')!
  equal(r3.draft.title, '  正常标题 ', '合法字段原样保留（trim 由展示层处理）')
  equal(r3.draft.step, 3, '合法步骤保留')
})

test('合并恢复只添加不存在的作品并保留本地模型设置', () => {
  const current = project([book('b1', '在写作品', [chapter('c1', '第一章', '本地正文')])])
  current.model = { baseUrl: 'http://127.0.0.1:6799/v1', model: 'mock', apiKey: 'local-key' }
  const incoming = project([book('b1', '备份里的旧版', [chapter('c9', '第一章', '备份正文')]), book('b2', '另一部', [chapter('c2', '第二章', '第二部正文')])])
  const { data, summary } = mergeWorkspaceBackup(current, incoming)
  equal(data.books.map(item => item.id), ['b1', 'b2'], '同 ID 作品保留本地版本')
  equal(data.books[0].title, '在写作品')
  equal(data.model.apiKey, 'local-key', '合并模式不改模型设置')
  equal(summary, { addedBooks: 1, keptBooks: 1, addedNotes: 0, addedRecords: 0, changedDays: 0 })
})

test('统计合并按天取较大值，不会重复累计', () => {
  const base: StatsState = emptyStatsState()
  recordWords(base, { date: '2026-09-21', bookId: 'b1', source: 'manual', chars: 100 })
  const incoming: StatsState = emptyStatsState()
  recordWords(incoming, { date: '2026-09-21', bookId: 'b1', source: 'manual', chars: 60 })
  recordWords(incoming, { date: '2026-09-22', bookId: 'b1', source: 'ai', chars: 40 })
  const { data } = mergeWorkspaceBackup(project([book('b1', '书', [])]), project([], []))
  const merged = mergeWorkspaceBackup({ ...project([book('b1', '书', [])]), stats: base }, { ...project([book('b1', '书', [])]), stats: incoming })
  const day21 = merged.data.stats.days.find(item => item.date === '2026-09-21')
  const day22 = merged.data.stats.days.find(item => item.date === '2026-09-22')
  equal(day21?.manual, 100, '同一天保留较大值')
  equal(day22?.ai, 40, '备份中多出的天被并入')
  ok(data.stats.days.length === 0, '空数据合并不产生统计')
})

test('建书记录按 ID 合并，同 ID 保留当前设备的一份', () => {
  const record = (id: string, title: string): WorkflowRecord => ({ id, status: 'draft', draft: { ...emptyDraft(), title }, updatedAt: '2026-09-20T00:00:00.000Z' })
  const merged = mergeWorkflowRecords([record('r1', '本地草稿')], [record('r1', '备份草稿'), record('r2', '备份新草稿')])
  equal(merged.records.map(item => item.draft.title), ['本地草稿', '备份新草稿'])
  equal(merged.added, 1)
})

const rankSnapshot = (sourceId: number, statDate: string, fetchedAt: number): RankSnapshotDoc => ({
  sourceId,
  statDate,
  fetchedAt,
  pageTitle: null,
  cutoffText: null,
  origin: 'crawl',
  items: [{
    rankNo: 1,
    rankChange: 0,
    bookId: '7401',
    bookTitle: `书${statDate}`,
    bookUrl: 'https://fanqienovel.com/page/7401',
    authorName: '作者甲',
    coverUrl: null,
    intro: null,
    statusText: null,
    metricName: '在读',
    metricValue: 1000,
    metricText: '在读 1000',
    readingCount: 1000,
    readingText: '在读 1000',
    lastChapterTitle: null,
    lastChapterUrl: null,
    lastUpdateTimeText: null,
    categoryName: null,
    categorySubName: null,
  }],
})

const breakdownProject = (id: string, title: string, updateTime: string): BreakdownProject => ({
  id,
  title,
  author: '作者甲',
  tags: [],
  mood: '',
  characterCount: 0,
  wordCount: 0,
  chapterCount: 0,
  progress: 0,
  status: 'done',
  createTime: updateTime,
  updateTime,
  chapters: [{ id: `${id}-c1`, title: '第一章', status: 'done', wordCount: 10, sortNo: 1, paragraphs: ['第一段。'], analysis: null, insightIds: [null] }],
  report: null,
  characterNames: [],
  materials: { character: [], rhythm: [], setting: [], outline: [], technique: [] },
})

test('全量备份带上扫榜快照与拆书库，并能原样解析回来', () => {
  const data = project([book('b1', '夜行者档案', [chapter('c1', '第一章', '正文一')])])
  const backup = buildWorkspaceBackup(data, undefined, '2026-09-22T10:00:00.000Z', {
    rank: [rankSnapshot(1, '2026-09-22', 100)],
    breakdown: [breakdownProject('p1', '竞品一', '2026-09-22T00:00:00.000Z')],
  })
  ok(backup.rank !== undefined, '有快照时才写 rank 段')
  const parsed = parseWorkspaceBackup(JSON.parse(serializeWorkspaceBackup(backup)))
  equal(parsed?.rank?.snapshots.length, 1)
  equal(parsed?.rank?.snapshots[0].items[0].bookTitle, '书2026-09-22')
  equal(parsed?.breakdown?.projects.map(item => item.title), ['竞品一'])
})

test('没有扫榜与拆书数据时备份不写这两个段，旧备份也能解析', () => {
  const backup = buildWorkspaceBackup(project([]), undefined, '2026-09-22T10:00:00.000Z')
  equal(backup.rank, undefined)
  equal(backup.breakdown, undefined)
  const legacy = { format: 'novel-workbench-next/backup-v1', exportedAt: '2026-09-22T10:00:00.000Z', counts: { books: 0, chapters: 0, notes: 0, records: 0 }, data: project([]) }
  const parsed = parseWorkspaceBackup(legacy)
  ok(parsed !== null, '旧版备份不带这两个段也要能恢复')
  equal(parsed?.rank, undefined)
  equal(parsed?.breakdown, undefined)
})

test('扫榜快照与拆书库合并时按日期和 ID 去重，同键保留较新的一份', () => {
  const merged = mergeSideStores(
    { rank: [rankSnapshot(1, '2026-09-21', 100), rankSnapshot(1, '2026-09-22', 200)], breakdown: [breakdownProject('p1', '本地竞品', '2026-09-21T00:00:00.000Z')] },
    { rank: [rankSnapshot(1, '2026-09-22', 999), rankSnapshot(1, '2026-09-20', 50)], breakdown: [breakdownProject('p1', '备份竞品', '2026-09-20T00:00:00.000Z'), breakdownProject('p2', '备份新竞品', '2026-09-22T00:00:00.000Z')] }
  )
  const keys = merged.rank.map(item => `${item.sourceId}|${item.statDate}`)
  equal(keys.length, 3, '同源同日只留一份')
  const today = merged.rank.find(item => item.statDate === '2026-09-22')
  equal(today?.fetchedAt, 999, '同键保留较新抓取的一份')
  equal(merged.breakdown.map(item => item.title), ['本地竞品', '备份新竞品'], '同 ID 保留本地，只补没有的')
  equal(merged.addedRank, 1, '只把 09-20 算作新增')
  equal(merged.addedBreakdown, 1)
  equal(merged.updatedRank, 1, '被顶掉的 09-22 计为更新，不少报')
  equal(merged.updatedBreakdown, 0, '备份里较旧的拆书项目不构成更新')
})

test('合并恢复的每日目标以当前设备为准，不被备份里的大目标抬走', () => {
  const current = project([book('b1', '书', [])])
  current.stats.dailyGoal = 800
  const incoming = project([book('b2', '备份里的书', [])])
  incoming.stats.dailyGoal = 5000
  const { data } = mergeWorkspaceBackup(current, incoming)
  equal(data.stats.dailyGoal, 800, '保留用户当前设定')
  equal(data.stats.days, [], '空统计合并不产生天数')
})

test('合并恢复的每日目标为默认值时同样以当前设备为准', () => {
  const current = project([])
  current.stats.dailyGoal = 2000
  const incoming = project([])
  incoming.stats.dailyGoal = 800
  const { data } = mergeWorkspaceBackup(current, incoming)
  equal(data.stats.dailyGoal, 2000, '当前是默认值也不拿备份的小目标覆盖')
})

test('备份里结构错误的扫榜与拆书段被当成没有，不拖垮恢复', () => {
  const merged = mergeSideStores({}, { rank: undefined, breakdown: undefined })
  equal(merged.rank, [])
  equal(merged.breakdown, [])
  const parsed = parseWorkspaceBackup({ format: 'novel-workbench-next/backup-v1', exportedAt: '2026-09-22T10:00:00.000Z', data: project([]), rank: { snapshots: 'nope' }, breakdown: 7 })
  ok(parsed !== null, '作品数据仍能恢复')
  equal(parsed?.rank, undefined)
  equal(parsed?.breakdown, undefined)
})

function emptyDraft() {
  return { step: 1 as const, title: '', genre: '', audience: '', tone: '', seed: '', idea: '', outline: '', world: '', characters: '', timeline: '' }
}

test('TXT 阅读稿包含书名、章名与正文，跳过空章节', () => {
  const target = book('b1', '夜行者档案', [chapter('c1', '第一章 起点', '第一段。\n\n第二段。'), chapter('c2', '第二章 空', '   ')])
  const txt = bookToTxt(target)
  ok(txt.startsWith('《夜行者档案》'), '以书名开头')
  ok(txt.includes('第一章 起点'), '包含章名')
  ok(txt.includes('第一段。\n\n第二段。'), '正文原样输出')
  ok(!txt.includes('第二章 空'), '跳过没有正文的章节')
  const single = chapterToTxt(target, target.chapters[0])
  equal(single, '《夜行者档案》\n第一章 起点\n\n第一段。\n\n第二段。\n')
})

test('文件名清理掉非法字符', () => {
  equal(safeFileName('夜行者/档案:1*?', 'fallback'), '夜行者_档案_1', '非法字符替换为下划线并去掉首尾下划线')
  equal(safeFileName('   ', 'fallback'), 'fallback', '空名回退到备用名')
})

test('备份大小上限是 50MB', () => {
  equal(BACKUP_SIZE_LIMIT, 50 * 1024 * 1024)
  equal(parseWorkspaceBackup({ format: 'novel-workbench-next/backup-v1', exportedAt: '2026-09-22T10:00:00.000Z', data: { version: 3, books: [] } }), null, 'version 3 数据应被拒绝')
  equal(parseWorkspaceBackup({ format: 'novel-workbench-next/backup-v1', exportedAt: '2026-09-22T10:00:00.000Z', data: { version: 2, books: [{ id: 'b' }] } }), null, '缺少字段的作品应被拒绝')
})
