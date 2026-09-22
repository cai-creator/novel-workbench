import { equal, ok, test } from './harness'
import { BACKUP_SIZE_LIMIT, bookToTxt, buildWorkspaceBackup, chapterToTxt, mergeWorkflowRecords, mergeWorkspaceBackup, parseWorkspaceBackup, safeFileName, serializeWorkspaceBackup } from '../src/backup'
import { emptyStatsState, recordWords, type StatsState } from '../src/stats'
import type { Book, Chapter, ProjectData } from '../src/storage'
import type { WorkflowRecord } from '../src/workflow'

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
