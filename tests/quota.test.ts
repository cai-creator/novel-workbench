import { equal, ok, test } from './harness'
import { onQuotaWarning, reportQuotaWarning, assertStorageFits, STORAGE_QUOTA_MESSAGE, StorageQuotaError, writeStorage } from '../src/quota'
import { loadData, saveData } from '../src/storage'
import { emptyStatsState } from '../src/stats'
import { emptyRankStore, loadRankStore, saveRankStore } from '../src/rank'
import { emptyStore, loadBreakdownStore, saveBreakdownStore } from '../src/breakdown'
import { loadWorkflowArchive, saveWorkflowArchive } from '../src/workflow'
import { loadEditorPrefs, saveEditorPrefs } from '../src/prefs'

const KEYS = [
  'novel-workbench-next/v1',
  'novel-workbench-next/workflow-v1',
  'novel-workbench-next/workflow-archive-v2',
  'novel-workbench-next/editor-prefs',
  'novel-workbench-next/breakdown-v1',
  'novel-workbench-next/rank-v1',
]
const originalSetItem = localStorage.setItem.bind(localStorage)
const warnings: string[] = []
onQuotaWarning(message => warnings.push(message))
const clearStorage = () => { for (const key of KEYS) localStorage.removeItem(key) }

/** 让 setItem 一律抛配额错误，复现浏览器存储写满。 */
function blockStorage(): void {
  localStorage.setItem = () => {
    const error = new Error("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.")
    error.name = 'QuotaExceededError'
    throw error
  }
}
const restoreStorage = () => { localStorage.setItem = originalSetItem }

test('writeStorage 正常写入并读回，不触发告警', () => {
  clearStorage()
  warnings.length = 0
  writeStorage('test/quota-key', { hello: '工作台' })
  equal(JSON.parse(localStorage.getItem('test/quota-key') || 'null'), { hello: '工作台' })
  equal(warnings, [], '写入成功不告警')
  localStorage.removeItem('test/quota-key')
})

test('writeStorage 配额溢出时抛中文错误并广播告警', () => {
  clearStorage()
  warnings.length = 0
  blockStorage()
  const caught: unknown[] = []
  for (let i = 0; i < 2; i += 1) {
    try { writeStorage('test/quota-key', { a: 1 }) } catch (error) { caught.push(error) }
  }
  restoreStorage()
  equal(caught.length, 2, '两次写入都抛出')
  for (const error of caught) {
    ok(error instanceof StorageQuotaError, '抛出 StorageQuotaError 而不是原始 DOMException')
    equal((error as Error).name, 'StorageQuotaError')
    equal((error as Error).message, STORAGE_QUOTA_MESSAGE, '文案是面向用户的中文提示')
  }
  equal(warnings, [STORAGE_QUOTA_MESSAGE, STORAGE_QUOTA_MESSAGE], '每次失败都广播一次告警')
  writeStorage('test/quota-key', { a: 1 })
  equal(JSON.parse(localStorage.getItem('test/quota-key') || 'null'), { a: 1 }, '恢复后仍可正常写入')
  localStorage.removeItem('test/quota-key')
  clearStorage()
})

test('writeStorage 拒绝超过 5MB 的单次写入', () => {
  clearStorage()
  warnings.length = 0
  let attempts = 0
  localStorage.setItem = (...args: [string, string]) => { attempts += 1; return originalSetItem(...args) }
  let caught: unknown = null
  try { writeStorage('test/quota-key', { blob: 'x'.repeat(6 * 1024 * 1024) }) } catch (error) { caught = error }
  restoreStorage()
  ok(caught instanceof StorageQuotaError, '超限写入同样抛 StorageQuotaError')
  ok((caught as Error).message.includes('MB'), '提示里带上体量：' + (caught as Error).message)
  equal(attempts, 0, '超限内容不进 setItem')
  equal(localStorage.getItem('test/quota-key'), null, '键里不留半截数据')
  ok(warnings.some(item => item.includes('MB')), '超限也广播告警')
  clearStorage()
})

test('reportQuotaWarning 广播给所有订阅者，某个订阅者抛错不影响其他', () => {
  warnings.length = 0
  const extra: string[] = []
  const offBad = onQuotaWarning(() => { throw new Error('坏订阅者') })
  const offGood = onQuotaWarning(message => extra.push(message))
  reportQuotaWarning('广播测试')
  offBad()
  offGood()
  equal(warnings, ['广播测试'], '先注册的订阅者照常收到')
  equal(extra, ['广播测试'], '后注册的订阅者也能收到')
})

test('五个存储的保存函数统一走配额处理，不再静默或抛英文异常', () => {
  clearStorage()
  const cases: [string, () => void, string][] = [
    ['主数据', () => saveData({ version: 2, books: [], model: { baseUrl: '', model: '', apiKey: '' }, stats: emptyStatsState(), notes: [] }), 'novel-workbench-next/v1'],
    ['建书记录', () => saveWorkflowArchive({ version: 2, activeId: null, records: [] }), 'novel-workbench-next/workflow-archive-v2'],
    ['编辑器偏好', () => saveEditorPrefs({ fontSize: 17 }), 'novel-workbench-next/editor-prefs'],
    ['拆书库', () => saveBreakdownStore(emptyStore()), 'novel-workbench-next/breakdown-v1'],
    ['榜单库', () => saveRankStore(emptyRankStore()), 'novel-workbench-next/rank-v1'],
  ]
  blockStorage()
  for (const [name, save, key] of cases) {
    let caught: unknown = null
    try { save() } catch (error) { caught = error }
    ok(caught instanceof StorageQuotaError, `${name}配额溢出时抛出中文 StorageQuotaError`)
    equal(localStorage.getItem(key), null, `${name}写失败后键里不留半截数据`)
  }
  restoreStorage()
  clearStorage()
})

test('assertStorageFits 只预检不落盘：装得下不吭声，装不下抛中文错误', () => {
  clearStorage()
  warnings.length = 0
  assertStorageFits({ blob: 'x'.repeat(1024) })
  equal(localStorage.length, 0, '预检不写任何键')
  let caught: unknown = null
  try { assertStorageFits({ blob: 'x'.repeat(6 * 1024 * 1024) }) } catch (error) { caught = error }
  ok(caught instanceof StorageQuotaError, '超限抛 StorageQuotaError')
  ok((caught as Error).message.includes('MB'), '提示带体量')
  equal(localStorage.length, 0, '超限同样不落盘')
  clearStorage()
})

test('保存与读取仍走原有键名，存量存档照常兼容', () => {
  clearStorage()
  saveData({ version: 2, books: [], model: { baseUrl: '', model: '', apiKey: '' }, stats: emptyStatsState(), notes: [] })
  saveWorkflowArchive({ version: 2, activeId: null, records: [] })
  saveEditorPrefs({ fontSize: 19 })
  saveBreakdownStore(emptyStore())
  saveRankStore(emptyRankStore())
  localStorage.setItem('novel-workbench-next/workflow-v1', JSON.stringify({ step: 1, title: '旧草稿' }))
  saveWorkflowArchive({ version: 2, activeId: null, records: [] })
  equal(localStorage.getItem('novel-workbench-next/workflow-v1'), null, '旧草稿键仍会被清理')
  ok((localStorage.getItem('novel-workbench-next/v1') || '').includes('"version":2'), '主数据键名与结构未变')
  equal(loadData().books, [], '主数据写回原键并可读回')
  equal(loadWorkflowArchive().records, [], '建书记录写回原键并可读回')
  equal(loadEditorPrefs().fontSize, 19, '偏好写回原键并可读回')
  equal(loadBreakdownStore().projects, [], '拆书库写回原键并可读回')
  equal(loadRankStore().snapshots, [], '榜单库写回原键并可读回')
  clearStorage()
})
