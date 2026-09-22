import { equal, ok, test, throws } from './harness'
import { createBook, importBookJson, isProjectData, migrateProseCandidates, normalizeNotes, normalizeProjectData, normalizeStats, recordChapterVersion } from '../src/storage'
import { emptyStatsState, MAX_STATS_DAYS } from '../src/stats'
import type { Chapter, ProjectData } from '../src/storage'

const chapter = (over: Partial<Chapter> = {}): Chapter => ({ id: 'c1', title: '第一章', content: '正文', updatedAt: '2026-09-20T00:00:00.000Z', ...over })
const project = (): ProjectData => ({ version: 2, books: [], model: { baseUrl: '', model: '', apiKey: '' }, stats: emptyStatsState(), notes: [] })

test('isProjectData 拒绝结构与版本不符的数据', () => {
  ok(isProjectData(project()), '完整数据应通过')
  ok(!isProjectData(null), 'null 应被拒绝')
  ok(!isProjectData({ version: 3, books: [], model: { baseUrl: '', model: '', apiKey: '' } }), '未知版本应被拒绝')
  ok(!isProjectData({ version: 2, books: [{}], model: { baseUrl: '', model: '', apiKey: '' } }), '缺少字段的作品应被拒绝')
  ok(!isProjectData({ version: 2, books: [], model: {} }), '缺少模型设置应被拒绝')
})

test('normalizeStats 清洗越界与损坏的统计', () => {
  const state = normalizeStats({
    days: [
      { date: '2026-09-20', manual: -5, ai: 12.4, books: { b1: { manual: 3, ai: 'x' } } },
      { date: 'not-a-date', manual: 1, ai: 1, books: {} },
      { date: '2026-09-21', manual: 20, ai: 0, books: {} },
    ],
    dailyGoal: 999999,
  })
  equal(state.days.length, 2, '坏日期的记录被剔除')
  equal(state.days[0].manual, 0, '负字数归零')
  equal(state.days[0].ai, 12, '字数取整')
  equal(state.days[0].books, {}, '无效的分作品统计被剔除')
  equal(state.dailyGoal, 100000, '目标上限 10 万')
})

test('normalizeStats 只保留最近的天数', () => {
  const days = Array.from({ length: MAX_STATS_DAYS + 12 }, (_, index) => {
    const date = new Date(2020, 0, 1 + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { date: key, manual: 1, ai: 0, books: {} }
  })
  const state = normalizeStats({ days, dailyGoal: 0 })
  equal(state.days.length, MAX_STATS_DAYS)
  equal(state.dailyGoal, 2000, '非法目标回落默认值 2000')
})

test('normalizeNotes 过滤无效灵感并限制长度', () => {
  const notes = normalizeNotes([
    { id: 'n1', content: '有效灵感', createdAt: '2026-09-20T00:00:00.000Z' },
    { id: 'n2', content: '缺创建时间', createdAt: 'nope' },
    { content: '缺 ID', createdAt: '2026-09-20T00:00:00.000Z' },
    { id: 'n3', content: 'x'.repeat(10), createdAt: '2026-09-20T00:00:00.000Z', tags: ['  悬疑  ', '', 42], pinned: 1 },
  ])
  equal(notes.map(item => item.id), ['n1', 'n3'])
  equal(notes[1].tags, ['悬疑'], '标签去空白并过滤非字符串')
  equal(notes[1].pinned, true, '置顶标记归一为布尔')
  equal(notes[1].updatedAt, '2026-09-20T00:00:00.000Z', '缺更新时间时用创建时间兜底')
})

test('normalizeProjectData 统一输出版本与结构', () => {
  const normalized = normalizeProjectData({ version: 1, books: [], model: { baseUrl: '', model: '', apiKey: '' }, stats: { days: 'bad' }, notes: 'bad' })
  ok(normalized !== null, '旧版本数据应能归一')
  equal(normalized?.version, 2, '旧版本数据归一为新版本')
  equal(normalized?.stats.days, [])
  equal(normalized?.notes, [])
})

test('migrateProseCandidates 兼容单候选并清理无效数据', () => {
  const legacy = chapter({ proseCandidate: { id: 'old', content: '旧候选', instruction: '续写', createdAt: '2026-09-20T00:00:00.000Z', baseUpdatedAt: '2026-09-19T00:00:00.000Z' } } as Partial<Chapter>)
  migrateProseCandidates(legacy)
  equal(legacy.proseCandidates?.length, 1, '单候选迁移为数组')
  ok(!('proseCandidate' in legacy), '旧字段被删除')

  const broken = chapter({ proseCandidates: [{ content: '缺时间' }, { id: 'good', content: '可用', instruction: '润色', createdAt: '2026-09-20T00:00:00.000Z', baseUpdatedAt: '2026-09-19T00:00:00.000Z' }] } as Partial<Chapter>)
  migrateProseCandidates(broken)
  equal(broken.proseCandidates?.map(item => item.id), ['good'], '无效候选被剔除')

  const none = chapter({ proseCandidate: { content: '坏数据' } } as Partial<Chapter>)
  migrateProseCandidates(none)
  ok(!none.proseCandidates?.length, '没有有效候选时不保留数组')
})

test('recordChapterVersion 跳过重复内容并限制历史条数', () => {
  const target = chapter({ history: [] })
  equal(recordChapterVersion(target, 'manual')?.content, '正文', '首次保存成功')
  equal(recordChapterVersion(target, 'manual'), null, '内容相同不再保存')
  target.content = '润色后的正文'
  recordChapterVersion(target, 'ai')
  equal(target.history?.length, 2)
  equal(target.history?.[1].source, 'manual', '旧版本保留来源')
  target.history = Array.from({ length: 30 }, (_, index) => ({ id: `v${index}`, title: 't', content: `c${index}`, savedAt: '2026-09-20T00:00:00.000Z', source: 'manual' as const }))
  target.content = '新正文'
  recordChapterVersion(target, 'manual')
  equal(target.history?.length, 30, '历史最多 30 条')
  equal(target.history?.[0].content, '新正文', '新版本排在最前')
})

test('createBook 生成带第一章的空作品', () => {
  const created = createBook('  新作品  ')
  equal(created.title, '新作品', '书名去首尾空白')
  equal(created.chapters.length, 1)
  equal(created.chapters[0].title, '第一章')
  equal(created.chapters[0].content, '')
  equal(created.lore, [])
})

test('importBookJson 重建 ID 且不导入模型密钥', () => {
  const imported = importBookJson({
    format: 'novel-workbench-next/book-v1',
    book: { id: 'same', title: '导入作', premise: '概念', chapters: [{ id: 'c1', title: '第一章', content: '正文', updatedAt: '2026-09-20T00:00:00.000Z' }], lore: [], chat: [], updatedAt: '2026-09-20T00:00:00.000Z' },
  })
  ok(imported.id !== 'same', '作品 ID 重建')
  ok(imported.chapters[0].id !== 'c1', '章节 ID 重建')
  equal(imported.title, '导入作')
  equal(imported.chapters[0].content, '正文')
})

test('importBookJson 拒绝不受支持的文件', () => {
  throws(() => importBookJson(null), 'null 应抛错')
  throws(() => importBookJson({ book: {} }), '缺少格式标记应抛错')
  throws(() => importBookJson({ format: 'other-v1', book: { id: 'x' } }), '错误格式标记应抛错')
})
