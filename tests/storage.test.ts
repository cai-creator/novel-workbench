import { equal, ok, test, throws } from './harness'
import { createBook, importBookJson, isProjectData, loadData, migrateProseCandidates, normalizeNotes, normalizeProjectData, normalizeStats, recordChapterVersion, releaseCorruptDataProtection, saveData, takeCorruptDataNotice } from '../src/storage'
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

const MAIN_KEY = 'novel-workbench-next/v1'
const STASH_KEYS = ['novel-workbench-next/v1-corrupt', 'novel-workbench-next/v1-corrupt-2', 'novel-workbench-next/v1-corrupt-3']
const resetCorruptState = () => {
  localStorage.removeItem(MAIN_KEY)
  for (const key of STASH_KEYS) localStorage.removeItem(key)
  releaseCorruptDataProtection()
  takeCorruptDataNotice()
}
const usableData = (): ProjectData => ({ ...project(), books: [createBook('完好作品')] })

test('loadData 检出损坏 JSON 时暂存原文并给出提示，不再静默开空白工作台', () => {
  resetCorruptState()
  const broken = '{"version":2,"books":['
  localStorage.setItem(MAIN_KEY, broken)
  equal(loadData().books, [], '读不到内容时退回空状态')
  const notice = takeCorruptDataNotice()
  ok(notice?.includes('检测到本地数据损坏'), '弹出损坏提示')
  ok(notice?.includes(STASH_KEYS[0]), '提示指明原文暂存位置')
  equal(localStorage.getItem(STASH_KEYS[0]), broken, '损坏原文被搬到暂存键')
  equal(localStorage.getItem(MAIN_KEY), null, '主键让位，随后的自动保存碰不到原文')
  equal(takeCorruptDataNotice(), null, '同一次提示只取走一次')
})

test('loadData 对结构不符的数据同样暂存原文', () => {
  resetCorruptState()
  const broken = '{"version":3,"books":[]}'
  localStorage.setItem(MAIN_KEY, broken)
  equal(loadData().books, [], '结构不符时退回空状态')
  ok(takeCorruptDataNotice(), '同样给出损坏提示')
  equal(localStorage.getItem(STASH_KEYS[0]), broken, '原文仍在暂存键里')
})

test('损坏原文暂存后自动保存写主键，原文不被覆盖', () => {
  resetCorruptState()
  const broken = '{"version":2,"books":[{"id":"b1"'
  localStorage.setItem(MAIN_KEY, broken)
  loadData()
  saveData(usableData())
  equal(localStorage.getItem(STASH_KEYS[0]), broken, '自动保存之后损坏原文仍完整留在暂存键')
  equal(loadData().books.length, 1, '主键里此时是可用的新数据')
})

test('暂存区已满时拒绝写入，保住主键里的损坏原文', () => {
  resetCorruptState()
  for (const key of STASH_KEYS) localStorage.setItem(key, '更早的损坏原文')
  const broken = '{"version":2,"books":['
  localStorage.setItem(MAIN_KEY, broken)
  loadData()
  ok(takeCorruptDataNotice()?.includes('暂存区已满'), '提示说明暂存区已满')
  equal(localStorage.getItem(MAIN_KEY), broken, '原文还留在主键里')
  throws(() => saveData(usableData()), '保护生效时拒绝写入')
  equal(localStorage.getItem(MAIN_KEY), broken, '写入被拒后原文仍在')
})

test('用户确认覆盖恢复后可解除写入保护', () => {
  resetCorruptState()
  for (const key of STASH_KEYS) localStorage.setItem(key, '更早的损坏原文')
  localStorage.setItem(MAIN_KEY, '{"version":2,"books":[')
  loadData()
  throws(() => saveData(usableData()), '保护生效时不能写')
  releaseCorruptDataProtection()
  saveData(usableData())
  equal(loadData().books.length, 1, '解除保护后恢复备份可正常落盘')
})

test('正常数据不受影响：不给提示、不产生暂存键', () => {
  resetCorruptState()
  saveData(usableData())
  equal(takeCorruptDataNotice(), null, '正常加载没有损坏提示')
  equal(loadData().books.length, 1, '正常数据原样读回')
  for (const key of STASH_KEYS) equal(localStorage.getItem(key), null, '不产生暂存键')
})
