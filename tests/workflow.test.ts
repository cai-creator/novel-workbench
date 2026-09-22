import { equal, ok, test, throws } from './harness'
import { buildBookFromWorkflow, createWorkflowRecord, emptyWorkflow, exportWorkflowArchive, importWorkflowArchive, loadWorkflowArchive, parseChapterPlan, saveWorkflowArchive, workflowPrompt, type WorkflowDraft } from '../src/workflow'

const LEGACY_KEY = 'novel-workbench-next/workflow-v1'
const ARCHIVE_KEY = 'novel-workbench-next/workflow-archive-v2'
const draft = (over: Partial<WorkflowDraft> = {}): WorkflowDraft => ({ ...emptyWorkflow(), genre: '悬疑', audience: '成年读者', tone: '冷峻', ...over })
const bare = (over: Partial<WorkflowDraft> = {}): WorkflowDraft => ({ ...emptyWorkflow(), ...over })
const clearStorage = () => { localStorage.removeItem(LEGACY_KEY); localStorage.removeItem(ARCHIVE_KEY) }

test('parseChapterPlan 解析中文章号、标题与要点', () => {
  const plan = parseChapterPlan([
    '故事主线：主角追查一桩旧案，线索层层反转。',
    '- 第一章｜雨夜｜主角在码头遇见神秘人；捡到一枚旧怀表',
    '第2章: 归乡',
    '第十章｜旧信｜',
    '普通的一句话',
    '第二十三章',
  ].join('\n'))
  equal(plan.map(item => item.title), ['第一章 雨夜', '第2章 归乡', '第十章 旧信', '第二十三章'])
  equal(plan[0].outline, '主角在码头遇见神秘人；捡到一枚旧怀表', '多个要点用分号连接')
  equal(plan[2].outline, '旧信', '没有要点时退回标题')
  equal(plan[3].outline, '', '只有章名时概要为空')
})

test('parseChapterPlan 跳过无法识别的内容并限制 20 章', () => {
  equal(parseChapterPlan(''), [], '空大纲没有章节')
  equal(parseChapterPlan('前言\n人物设定\n第一章'), [{ title: '第一章', outline: '' }], '非章节行被跳过')
  const many = Array.from({ length: 25 }, (_, index) => `第${index + 1}章｜标题${index + 1}`).join('\n')
  equal(parseChapterPlan(many).length, 20, '最多取前 20 章')
})

test('buildBookFromWorkflow 把草稿转成作品、设定与章节', () => {
  const book = buildBookFromWorkflow(draft({
    title: '  夜行者  ', idea: '记者在雨夜捡到怀表。', seed: '怀表与旧案',
    outline: '主线冲突写在这里。\n第一章｜雨夜｜码头相遇',
    world: '旧城有一条不能过桥的规矩', characters: '沈砚：记者，想查明真相', timeline: '第一周｜捡到怀表｜卷入调查',
  }))
  equal(book.title, '夜行者', '书名去空白')
  equal(book.premise, '记者在雨夜捡到怀表。', '优先采用已确定创意')
  equal(book.lore.map(item => item.title), ['创作方向', '故事主线与章节规划', '世界规则', '主要人物', '故事时间线'])
  equal(book.lore[0].mode, 'plot')
  equal(book.lore[0].content, ['类型：悬疑', '目标读者：成年读者', '叙事风格：冷峻'].join('\n'), '空的定位项不写进行')
  equal(book.lore[4].mode, 'timeline')
  equal(book.chapters.length, 1)
  equal(book.chapters[0].title, '第一章 雨夜')
  equal(book.chapters[0].outline, '码头相遇')
  equal(book.chapters[0].content, '', '新章节正文为空')
})

test('buildBookFromWorkflow 跳过空白设定并在缺书名时报错', () => {
  const book = buildBookFromWorkflow(bare({ title: '空白设定', seed: '只有灵感', outline: '第一章｜开篇' }))
  equal(book.premise, '只有灵感', '没有创意时退回原始灵感')
  equal(book.lore.map(item => item.title), ['故事主线与章节规划'], '空白的世界、人物、时间线不生成设定')
  equal(book.lore[0].content, '第一章｜开篇', '大纲只作为剧情设定收录')
  const bare2 = buildBookFromWorkflow(bare({ title: '无大纲', outline: '一段没有章名的文字' }))
  equal(bare2.chapters.map(item => item.title), ['第一章'], '没有识别到章名时保留默认首章')
  equal(bare2.lore.map(item => item.title), ['故事主线与章节规划'], '只有大纲时设定列表只剩主线')
  const nothing = buildBookFromWorkflow(bare({ title: '只有书名' }))
  equal(nothing.lore, [], '大纲也为空时设定列表为空')
  throws(() => buildBookFromWorkflow(bare({ title: '   ' })), '空白书名应抛错')
})

test('importWorkflowArchive 重建 ID 并校验文件格式', () => {
  const badStep = { ...draft({ title: '导入的草稿' }), step: 9 } as unknown as WorkflowDraft
  const imported = importWorkflowArchive({
    format: 'novel-workbench-next/workflow-archive-v2',
    records: [
      { id: 'old', status: 'draft', draft: badStep, updatedAt: '2026-09-20T00:00:00.000Z' },
      { id: 'done', status: 'completed', draft: draft({ title: '完成的草稿' }), updatedAt: '坏时间', completedAt: '坏时间', bookId: 'b9' },
    ],
  })
  equal(imported.length, 2)
  ok(imported[0].id !== 'old', '记录 ID 重建')
  ok(imported[0].id !== imported[1].id, 'ID 互不相同')
  equal(imported[0].draft.title, '导入的草稿')
  equal(imported[0].draft.step, 1, '非法步骤回落默认值')
  ok(Number.isFinite(Date.parse(imported[1].updatedAt)), '坏时间用当前时间兜底')
  equal(imported[1].completedAt, undefined, '坏完成时间被丢弃')
  equal(imported[1].bookId, undefined, '不导入作品绑定')
  throws(() => importWorkflowArchive(null), 'null 应抛错')
  throws(() => importWorkflowArchive({ format: 'other', records: [] }), '错误格式应抛错')
  throws(() => importWorkflowArchive({ format: 'novel-workbench-next/workflow-archive-v2', records: Array.from({ length: 201 }, () => ({ status: 'draft', draft: {} })) }), '超过 200 条应抛错')
  throws(() => importWorkflowArchive({ format: 'novel-workbench-next/workflow-archive-v2', records: [{ status: 'draft', draft: {} }, { status: 'other', draft: {} }] }), '未知状态应抛错')
  throws(() => importWorkflowArchive({ format: 'novel-workbench-next/workflow-archive-v2', records: [{ status: 'draft' }] }), '缺少草稿应抛错')
})

test('workflowPrompt 带上全部已有上下文与对应任务', () => {
  const prompt = workflowPrompt('outline', draft({ title: '夜行者', idea: '记者追查旧案。', outline: '已有大纲', characters: '沈砚' }))
  ok(prompt.system.includes('中文连载小说'), '系统提示定位共创写手')
  ok(prompt.user.includes('类型：悬疑'), '上下文带上类型')
  ok(prompt.user.includes('已确定创意：记者追查旧案。'), '上下文带上已确定创意')
  ok(prompt.user.includes('人物设定：沈砚'), '上下文带上已填设定')
  ok(prompt.user.includes('世界设定：未填写'), '未填字段有兜底文案')
  ok(prompt.user.includes('本次任务：'), '任务与上下文分开')
  ok(prompt.user.includes('前 8 章规划'), '大纲字段有自己的任务描述')
  const titlePrompt = workflowPrompt('title', emptyWorkflow())
  ok(titlePrompt.user.includes('类型：未定'), '空草稿同样有兜底文案')
  ok(titlePrompt.user.includes('只输出一个书名'), '书名字段只要一个书名')
})

test('建书记录可保存、导出并再次导入', () => {
  clearStorage()
  const record = createWorkflowRecord(draft({ title: '暂存的草稿' }))
  equal(record.status, 'draft')
  saveWorkflowArchive({ version: 2, activeId: record.id, records: [record] })
  const archive = loadWorkflowArchive()
  equal(archive.records.length, 1)
  equal(archive.activeId, record.id, '当前草稿被记住')
  equal(archive.records[0].draft.title, '暂存的草稿')
  const exported = JSON.parse(exportWorkflowArchive(archive))
  equal(exported.format, 'novel-workbench-next/workflow-archive-v2')
  const again = importWorkflowArchive(exported)
  equal(again[0].draft.title, '暂存的草稿', '导出后可再导入')
})

test('首次读取接续旧版单草稿并清理旧存储键', () => {
  clearStorage()
  localStorage.setItem(LEGACY_KEY, JSON.stringify(draft({ title: '旧版草稿', step: 3 })))
  const archive = loadWorkflowArchive()
  equal(archive.records.length, 1, '旧草稿转为一条记录')
  equal(archive.records[0].draft.title, '旧版草稿')
  equal(archive.records[0].draft.step, 3)
  equal(archive.activeId, archive.records[0].id)
  saveWorkflowArchive(archive)
  equal(localStorage.getItem(LEGACY_KEY), null, '保存新版后删除旧键')
  equal(loadWorkflowArchive().records.length, 1, '新版记录可再次读回')
})

test('读取时丢弃损坏的建书记录', () => {
  clearStorage()
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify({
    version: 2, activeId: 'x',
    records: [{ id: 'ok', status: 'draft', draft: draft({ title: '可用' }), updatedAt: '2026-09-20T00:00:00.000Z' },
      { id: 'bad-time', status: 'draft', draft: {}, updatedAt: 'nope' },
      { id: 'bad-status', status: 'done', draft: {}, updatedAt: '2026-09-20T00:00:00.000Z' },
      null],
  }))
  const archive = loadWorkflowArchive()
  equal(archive.records.map(item => item.id), ['ok'], '无效记录被过滤')
  equal(archive.activeId, null, '指向失效记录的当前草稿被清空')
  clearStorage()
  equal(loadWorkflowArchive().records, [], '没有记录时返回空存档')
})
