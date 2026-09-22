import { test, equal, ok, throws, runAll } from './harness'
import './setup.mjs'
import {
  BREAKDOWN_FILE_FORMAT,
  buildBreakdownMarkdown,
  chapterBreakdownPrompt,
  collectBreakdownMaterials,
  countBreakdownWords,
  countBreakdownMaterials,
  createBreakdownProject,
  exportBreakdownStore,
  extractJsonObject,
  formatBreakdownMaterials,
  importBreakdownStore,
  loadBreakdownStore,
  bookReportPrompt,
  REPORT_BRIEF_MAX_CHARS,
  REPORT_BRIEFS_TOTAL_CHARS,
  mergeCharacterNames,
  normalizeAnalysis,
  normalizeChapterAnalysis,
  normalizeProject,
  parseTxtBook,
  recalcBreakdownProject,
  retryableBreakdownChapters,
  saveBreakdownStore,
  type BreakdownProject,
} from '../src/breakdown'

const sampleBook = [
  '第一卷 黄昏之城',
  '',
  '第一章 零点钟声',
  '凌晨零点，钟声敲了十三下。',
  '他站在巷口，数到第十三声时停了手。',
  '',
  '第二章 回声',
  '回声在灰墙上撞碎。',
  '她问：你听见了吗？',
  '',
  '第三章 回指',
  '第三章正文在此，讲了别的。',
  '这一章只写她转身走进雨里。',
  '',
  '尾声',
  '雨停之后，城市重新计数。',
].join('\n')

const projectOf = (chapters: Array<{ title: string; text: string }>, title = '测试书') => createBreakdownProject({ title, chapters })

test('parseTxtBook 按卷章标题切分并跳过正文回指', () => {
  const parsed = parseTxtBook(sampleBook, '备份名')
  equal(parsed.chapters.length, 3, '尾声不算标题行，正文里的“第三章正文在此”不切章，空章节被丢弃')
  equal(parsed.chapters[0].title, '第一章 零点钟声')
  equal(parsed.chapters[2].title, '第三章 回指')
  ok(parsed.chapters[2].text.includes('尾声'), '无标题的尾声文字并回上一章')
  equal(parsed.chapters[0].text.split('\n').filter(Boolean).length, 2, '第一章收两段正文')
  ok(parsed.chapters[2].text.includes('第三章正文在此'), '回指句留在正文里')
})

test('parseTxtBook 识别不出章节时整本作为一章', () => {
  const parsed = parseTxtBook('只有一段没有标题行的正文。', '无章节')
  equal(parsed.chapters.length, 1)
  equal(parsed.chapters[0].title, '第1章')
})

test('createBreakdownProject 统计字数并初始化为待拆解', () => {
  const project = projectOf([{ title: '第一章 起点', text: '一二三\n四五六' }, { title: '第二章 折返', text: '七\n八' }])
  equal(project.chapterCount, 2)
  equal(project.status, 'wait')
  equal(project.progress, 0)
  equal(project.wordCount, countBreakdownWords('一二三\n四五六') + countBreakdownWords('七\n八'))
  equal(project.chapters[0].paragraphs.length, 2)
  equal(project.chapters[0].insightIds.length, 2)
  equal(project.chapters[1].sortNo, 2)
})

test('createBreakdownProject 空章节清单报错', () => {
  throws(() => createBreakdownProject({ title: '空', chapters: [] }), '没有解析出任何章节')
})

test('normalizeChapterAnalysis 裁剪段落区间并生成高亮映射', () => {
  const parsed = {
    summary: '主角在巷口数钟声。',
    outline: [
      { title: '零点', startPara: 1, endPara: 1, text: '开篇定调', tags: [{ text: '钩子', tone: 'hot' }] },
      { title: '越界', startPara: 2, endPara: 99, text: '区间超出段落数应被裁剪', tags: [] },
      { title: '', startPara: 1, endPara: 1, text: '没有标题的节点被丢弃' },
      { title: '补位', startPara: 5, endPara: 2, text: '起点大于终点时收敛为起点', tags: [{ text: '' }] },
    ],
    rhythm: [{ label: '开篇钩子', value: '强', desc: '第一句即悬念' }],
    setting: [{ name: '钟墙', type: '地点', desc: '会回响的墙', tags: ['地标'] }],
    relations: [{ from: '他', to: '她', relation: '旧识', desc: '一句对话带出关系' }],
    golden: { hook300: '钟声即钩子', characterEstablish: '靠行动立住', coreDilemma: '数不数第十三声', anchors: [{ quote: '数到第十三声时停了手', comment: '动作即性格' }, { quote: '', comment: '空摘句被丢弃' }] },
  }
  const { analysis, insightIds } = normalizeChapterAnalysis(parsed, 3)
  equal(analysis.outline.length, 3, '无标题节点被丢弃')
  equal(analysis.outline[0].range, '1-1段')
  equal(analysis.outline[0].tags.length, 1)
  equal(analysis.outline[0].tags[0].text, '钩子')
  equal(analysis.outline[0].tags[0].tone, 'hot')
  equal(analysis.outline[1].range, '2-3段', '越界区间裁剪到末段')
  equal(insightIds[0], 1, '第一段属于节点一')
  equal(insightIds[1], 2, '第二段属于节点二')
  equal(insightIds[2], 2, '越界裁剪后第三段也归节点二')
  equal(analysis.rhythm.length, 1)
  equal(analysis.setting[0].name, '钟墙')
  equal(analysis.relations[0].from, '他')
  ok(!!analysis.golden, '黄金三章深拆产物保留')
  equal(analysis.golden!.anchors.length, 1, '空摘句被丢弃')
  equal(analysis.summary, '主角在巷口数钟声。')
})

test('normalizeAnalysis 读取存档时从 range 还原高亮映射', () => {
  const project = projectOf([{ title: '第一章', text: '一段。\n二段。\n三段。' }])
  const chapter = project.chapters[0]
  chapter.status = 'done'
  chapter.analysis = {
    summary: '细纲',
    outline: [{ id: 1, title: '开篇', range: '1-2段', text: '节点说明', tags: [] }],
    rhythm: [{ label: '钩子', value: '中', desc: '有效' }],
    setting: [],
    relations: [],
  }
  saveBreakdownStore({ version: 1, projects: [project] })
  const reloaded = loadBreakdownStore().projects[0]
  const analysis = reloaded.chapters[0].analysis
  ok(!!analysis, '存档里的 analysis 能读回')
  equal(analysis!.outline[0].range, '1-2段')
  const expected = normalizeAnalysis(chapter.analysis, 3)
  equal(expected?.outline[0].title, '开篇')
  ok(normalizeAnalysis({ rhythm: [{ label: '钩子', value: '中', desc: '仅节奏也算有效产物' }] }, 3) !== null, '没有细纲的旧数据仍能读回')
  ok(normalizeAnalysis(null, 3) === null, '空 analysis 归一为 null')
  ok(normalizeAnalysis({}, 3) === null, '空对象归一为 null')
})

test('mergeCharacterNames 滚动聚合人物关系名字', () => {
  const project = projectOf([{ title: '第一章', text: '一段。' }])
  const { analysis } = normalizeChapterAnalysis({ summary: 's', outline: [], relations: [{ from: '林七', to: '钟摆', relation: '同盟' }, { from: '钟摆', to: '林七', relation: '旧怨' }] }, 1)
  mergeCharacterNames(project, analysis)
  mergeCharacterNames(project, { ...analysis, relations: [{ from: '白鹭', to: '林七', relation: '旁观', desc: '冷眼旁观' }] })
  equal(project.characterNames.length, 3, '去重后三个名字')
  equal(project.characterCount, 3)
})

test('recalcBreakdownProject 汇总状态与进度', () => {
  const project = projectOf([
    { title: '第一章', text: '一。' },
    { title: '第二章', text: '二。' },
    { title: '第三章', text: '三。' },
  ])
  project.chapters[0].status = 'done'
  recalcBreakdownProject(project)
  equal(project.progress, 33)
  equal(project.status, 'wait', '拆了一半且无失败仍算待拆解')
  project.chapters[1].status = 'failed'
  recalcBreakdownProject(project)
  equal(project.status, 'failed', '有失败章报失败')
  project.chapters[1].status = 'done'
  project.chapters[2].status = 'done'
  recalcBreakdownProject(project)
  equal(project.status, 'done')
  equal(project.progress, 100)
  project.chapters[2].status = 'processing'
  recalcBreakdownProject(project)
  equal(project.status, 'processing', '有在跑的就是拆解中')
})

test('recalcBreakdownProject 重新汇总总字数', () => {
  const project = projectOf([{ title: '第一章', text: '一二三' }, { title: '第二章', text: '四五六' }])
  const total = project.wordCount
  project.wordCount = 0
  recalcBreakdownProject(project)
  equal(project.wordCount, total, '刷新页面后总字数不会归零')
})

test('retryableBreakdownChapters 按章序返回待拆与失败章', () => {
  const project = projectOf([
    { title: '第一章', text: '一。' },
    { title: '第二章', text: '二。' },
    { title: '第三章', text: '三。' },
  ])
  project.chapters[0].status = 'done'
  project.chapters[1].status = 'failed'
  const retryable = retryableBreakdownChapters(project)
  equal(retryable.length, 2)
  equal(retryable[0].sortNo, 2)
  equal(retryable[1].sortNo, 3)
})

test('loadBreakdownStore 丢弃损坏记录并把 processing 翻成 failed', () => {
  const project = projectOf([{ title: '第一章', text: '一。\n二。' }])
  project.chapters[0].status = 'processing'
  saveBreakdownStore({ version: 1, projects: [project, null as unknown as BreakdownProject, { id: 'x' } as unknown as BreakdownProject] })
  const loaded = loadBreakdownStore()
  equal(loaded.projects.length, 1)
  equal(loaded.projects[0].chapters[0].status, 'failed', '中断的 processing 读作可重试的 failed')
  localStorage.removeItem('novel-workbench-next/breakdown-v1')
  equal(loadBreakdownStore().projects.length, 0, '空存档返回空列表')
})

test('extractJsonObject 容忍代码块、前后缀与嵌套括号', () => {
  const raw = '好的，结果如下：\n```json\n{"a": {"b": "}"}, "c": [1, 2]}\n```\n以上。'
  const parsed = extractJsonObject(raw)
  equal(typeof parsed.a, 'object')
  equal((parsed.a as unknown as { b: string }).b, '}', '字符串里的右花括号不干扰配平')
  equal(JSON.stringify(parsed.c), '[1,2]')
  throws(() => extractJsonObject('没有 JSON'), '模型没有返回 JSON')
  throws(() => extractJsonObject('{坏掉的 json'), '无法解析')
})

test('chapterBreakdownPrompt 带上编号正文，前三章附黄金三章形状', () => {
  const golden = chapterBreakdownPrompt({ bookTitle: '测试书', chapterTitle: '零点钟声', chapterNo: 1, paragraphs: ['第一段', '第二段'], isGolden: true })
  ok(golden.user.includes('[1] 第一段') && golden.user.includes('[2] 第二段'))
  ok(golden.system.includes('"golden"'), '黄金三章附加深拆形状')
  ok(golden.system.includes('黄金三章深拆'))
  const normal = chapterBreakdownPrompt({ bookTitle: '测试书', chapterTitle: '回声', chapterNo: 4, paragraphs: ['一段'], isGolden: false })
  ok(!normal.system.includes('"golden"'), '非前三章不带深拆形状')
  ok(normal.user.includes('第4章《回声》'))
})

test('buildBreakdownMarkdown 汇总报告与各章拆解', () => {
  const project = projectOf([{ title: '第一章 零点钟声', text: '一。\n二。' }, { title: '第二章 回声', text: '三。' }])
  const { analysis } = normalizeChapterAnalysis({
    summary: '主角数钟声。',
    outline: [{ title: '零点', startPara: 1, endPara: 2, text: '定调', tags: [{ text: '钩子', tone: 'hot' }] }],
    rhythm: [{ label: '开篇钩子', value: '强', desc: '第一句即悬念' }],
    setting: [{ name: '钟墙', type: '地点', desc: '会回响的墙' }],
    relations: [{ from: '他', to: '她', relation: '旧识', desc: '对话带出' }],
  }, 2)
  project.chapters[0].status = 'done'
  project.chapters[0].analysis = analysis
  project.chapters[0].insightIds = [1, 1]
  project.report = {
    editorNotes: '最值得学的是开篇钩子。',
    outlineRecovery: [{ stage: '开局', chapters: '1', goal: '立住主角', payoff: '第十三声' }],
    characterArcs: [{ name: '他', keyChapters: [1], arc: '从数钟到听钟' }],
    foreshadowLedger: [{ item: '第十三声', plantChapter: 1, payoffChapter: 2, status: 'recovered' }],
    pacingCurve: [{ chapterNo: 1, score: 4, label: '开篇钩子' }],
    reusableTechniques: ['先声夺人'],
  }
  recalcBreakdownProject(project)
  const markdown = buildBreakdownMarkdown(project)
  ok(markdown.startsWith('# 《测试书》拆书报告'))
  ok(markdown.includes('- 已拆解：1 章'))
  ok(markdown.includes('### 编辑手记') && markdown.includes('最值得学的是开篇钩子。'))
  ok(markdown.includes('- 开局（1）：立住主角；兑现：第十三声'))
  ok(markdown.includes('- 第1章埋设 → 第2章回收：第十三声'))
  ok(markdown.includes('## 第一章 零点钟声'), '标题自带章节号时不重复编号')
  ok(!markdown.includes('## 第1章 第一章'), '不会出现“第1章 第一章”叠字')
  ok(markdown.includes(`- 总字数：${project.wordCount}`))
  ok(markdown.includes('**细纲**：主角数钟声。'))
  ok(markdown.includes('- 零点（1-2段）：定调【钩子】'))
  ok(markdown.includes('- 开篇钩子（强）：第一句即悬念'))
  ok(markdown.includes('- 钟墙·地点：会回响的墙'))
  ok(markdown.includes('- 他 → 她（旧识）：对话带出'))
  ok(!markdown.includes('## 第2章'), '未拆解的章不进报告')
})

test('拆书存档可导出并再次导入（ID 重建）', () => {
  const project = projectOf([{ title: '第一章', text: '一。\n二。' }])
  project.chapters[0].status = 'done'
  project.chapters[0].analysis = normalizeChapterAnalysis({ summary: 's', outline: [{ title: '开篇', startPara: 1, endPara: 1, text: '定调' }] }, 2).analysis
  const exported = exportBreakdownStore({ version: 1, projects: [project] })
  const imported = importBreakdownStore(JSON.parse(exported))
  equal(imported.length, 1)
  ok(imported[0].id !== project.id, '导入后整体重分配 ID')
  equal(imported[0].chapters[0].title, '第一章')
  ok(!!imported[0].chapters[0].analysis, '拆解产物一并导入')
  equal(imported[0].status, 'done')
  equal(imported[0].wordCount, project.wordCount, '导入后总字数不丢')
  throws(() => importBreakdownStore({ format: 'other', projects: [] }), '格式不受支持')
  throws(() => importBreakdownStore(null), '不是有效的拆书文件')
})

test('importBreakdownStore 拒绝超大与空文件', () => {
  throws(() => importBreakdownStore({ format: BREAKDOWN_FILE_FORMAT, projects: Array.from({ length: 31 }, () => ({ id: 'x', chapters: [{ id: 'c', title: 't', paragraphs: ['p'], status: 'wait', wordCount: 1, sortNo: 1, insightIds: [], analysis: null }] })) }), '项目超过')
  throws(() => importBreakdownStore({ format: BREAKDOWN_FILE_FORMAT, projects: [{ id: 'x', chapters: [] }] }), '没有可导入')
})

test('collectBreakdownMaterials 按类型分开聚合素材并记住出处', () => {
  const project = projectOf([{ title: '第一章 零点钟声', text: '一。\n二。' }, { title: '第二章 回声', text: '三。' }], '素材书')
  const { analysis } = normalizeChapterAnalysis({
    summary: '主角数钟声。',
    outline: [{ title: '零点', startPara: 1, endPara: 1, text: '定调', tags: [{ text: '钩子', tone: 'hot' }] }],
    rhythm: [{ label: '开篇钩子', value: '强', desc: '第一句即悬念' }],
    setting: [{ name: '钟墙', type: '地点', desc: '会回响的墙' }],
    relations: [{ from: '他', to: '她', relation: '旧识', desc: '对话带出' }],
  }, 2)
  project.chapters[0].status = 'done'
  project.chapters[0].analysis = analysis
  project.report = {
    editorNotes: '最值得学的是开篇钩子。',
    outlineRecovery: [{ stage: '开局', chapters: '1', goal: '立住主角', payoff: '第十三声' }],
    characterArcs: [{ name: '他', keyChapters: [1], arc: '从数钟到听钟' }],
    foreshadowLedger: [],
    pacingCurve: [],
    reusableTechniques: ['先声夺人'],
  }
  recalcBreakdownProject(project)
  const materials = project.materials
  equal(countBreakdownMaterials(materials), 8)
  equal(materials.character.length, 2, '人物关系与人物弧线都进人设')
  equal(materials.character[0].label, '他 → 她（旧识）')
  equal(materials.character[0].chapterSortNo, 1)
  equal(materials.character[1].label, '他（第1章）', '全书报告的条目不记章节号')
  equal(materials.character[1].chapterSortNo, 0)
  equal(materials.rhythm[0].label, '开篇钩子（强）')
  equal(materials.setting[0].label, '钟墙·地点')
  equal(materials.outline[0].label, '零点（1-1段）')
  ok(materials.outline[0].text.includes('定调【钩子】'), '节点标签跟着正文走')
  equal(materials.outline.length, 2, '关键节点与全书报告的大纲反推都进节点')
  equal(materials.outline[1].label, '开局（1）')
  equal(materials.technique.length, 2, '可复用技巧与编辑手记都进技巧')
  equal(materials.technique[1].label, '编辑手记')
})

test('collectBreakdownMaterials 跳过未拆解的章', () => {
  const project = projectOf([{ title: '第一章', text: '一。' }, { title: '第二章', text: '二。' }])
  const { analysis } = normalizeChapterAnalysis({ summary: 's', relations: [{ from: '甲', to: '乙', relation: '师徒', desc: '传功' }] }, 1)
  project.chapters[1].status = 'done'
  project.chapters[1].analysis = analysis
  recalcBreakdownProject(project)
  equal(project.materials.character.length, 1)
  equal(project.materials.character[0].chapterSortNo, 2, '素材记的是真实章序')
})

test('formatBreakdownMaterials 只带选中的类型并标注出处', () => {
  const project = projectOf([{ title: '第一章 零点钟声', text: '一。' }], '素材书')
  project.author = '作者甲'
  const { analysis } = normalizeChapterAnalysis({
    summary: 's',
    outline: [{ title: '零点', startPara: 1, endPara: 1, text: '定调' }],
    rhythm: [{ label: '开篇钩子', value: '强', desc: '第一句即悬念' }],
    setting: [{ name: '钟墙', type: '地点', desc: '会回响的墙' }],
    relations: [{ from: '他', to: '她', relation: '旧识', desc: '对话带出' }],
  }, 1)
  project.chapters[0].status = 'done'
  project.chapters[0].analysis = analysis
  recalcBreakdownProject(project)
  const outlineText = formatBreakdownMaterials(project, ['outline'])
  ok(outlineText.includes('《素材书》（作者：作者甲）'), '带上来历提示这是参考')
  ok(outlineText.includes('【节点】'))
  ok(outlineText.includes('- 零点（1-1段）：定调（第1章）'))
  ok(!outlineText.includes('【人设】') && !outlineText.includes('【节奏】'), '没选中的类型不带进去')
  equal(formatBreakdownMaterials(project, []), '', '一类都没选就不产出文本')
})

test('normalizeProject 为没有素材字段的旧存档补出分类素材', () => {
  const project = projectOf([{ title: '第一章', text: '一。' }])
  const { analysis } = normalizeChapterAnalysis({ summary: 's', relations: [{ from: '甲', to: '乙', relation: '敌对', desc: '对峙' }] }, 1)
  project.chapters[0].status = 'done'
  project.chapters[0].analysis = analysis
  recalcBreakdownProject(project)
  const legacy = JSON.parse(JSON.stringify(project)) as Record<string, unknown>
  delete legacy.materials
  const restored = normalizeProject(legacy)
  ok(restored !== null)
  equal(restored!.materials.character.length, 1, '旧存档读盘时按当前章节重新聚合')
  equal(restored!.materials.character[0].text, '对峙')
})

test('buildBreakdownMarkdown 带上按类型分开的素材', () => {
  const project = projectOf([{ title: '第一章 零点钟声', text: '一。\n二。' }, { title: '第二章 回声', text: '三。' }])
  const { analysis } = normalizeChapterAnalysis({
    summary: '主角数钟声。',
    outline: [{ title: '零点', startPara: 1, endPara: 2, text: '定调', tags: [{ text: '钩子', tone: 'hot' }] }],
    rhythm: [{ label: '开篇钩子', value: '强', desc: '第一句即悬念' }],
    setting: [{ name: '钟墙', type: '地点', desc: '会回响的墙' }],
    relations: [{ from: '他', to: '她', relation: '旧识', desc: '对话带出' }],
  }, 2)
  project.chapters[0].status = 'done'
  project.chapters[0].analysis = analysis
  project.chapters[0].insightIds = [1, 1]
  project.report = {
    editorNotes: '最值得学的是开篇钩子。',
    outlineRecovery: [{ stage: '开局', chapters: '1', goal: '立住主角', payoff: '第十三声' }],
    characterArcs: [{ name: '他', keyChapters: [1], arc: '从数钟到听钟' }],
    foreshadowLedger: [{ item: '第十三声', plantChapter: 1, payoffChapter: 2, status: 'recovered' }],
    pacingCurve: [{ chapterNo: 1, score: 4, label: '开篇钩子' }],
    reusableTechniques: ['先声夺人'],
  }
  recalcBreakdownProject(project)
  const markdown = buildBreakdownMarkdown(project)
  ok(markdown.includes('## 分类素材'), '导出文件里也有按类型分开的素材')
  ok(markdown.includes('### 人设') && markdown.includes('### 节奏') && markdown.includes('### 设定') && markdown.includes('### 节点') && markdown.includes('### 技巧'))
  ok(markdown.includes('- 他（第1章）：从数钟到听钟（全书报告）'), '素材条目带出处')
  const materialSection = markdown.slice(markdown.indexOf('## 分类素材'), markdown.indexOf('## 全书汇总'))
  ok(!materialSection.includes('伏笔'), '伏笔账本不混进素材分组，仍只在全书汇总里')
})

test('bookReportPrompt 对章节摘要做输入截断并如实标注收录范围', () => {
  const short = bookReportPrompt({ bookTitle: '小书', chapterBriefs: ['第1章《开篇》：钩子很稳；节奏：快'] })
  ok(short.user.includes('第1章《开篇》：钩子很稳；节奏：快'), '短摘要原样收录')
  ok(!short.user.includes('因篇幅所限'), '没有截断时不加标注')

  const longBrief = '长'.repeat(REPORT_BRIEF_MAX_CHARS + 50)
  const single = bookReportPrompt({ bookTitle: '单章超长', chapterBriefs: [longBrief] })
  ok(single.user.includes('长'.repeat(REPORT_BRIEF_MAX_CHARS)), '单条摘要按上限截断')
  ok(!single.user.includes('长'.repeat(REPORT_BRIEF_MAX_CHARS + 10)), '超出部分被裁掉')

  // 90 章 × ~300 字摘要 = 27000 字，超过 24000 的总预算
  const many = Array.from({ length: 90 }, (_, index) => `第${index + 1}章《章${index}》：${'述'.repeat(REPORT_BRIEF_MAX_CHARS - 20)}`)
  const capped = bookReportPrompt({ bookTitle: '大部头', chapterBriefs: many })
  const note = capped.user.match(/因篇幅所限，仅收录前 (\d+) \/ 90 章/)
  ok(note !== null, '总量超限时截断并标注收录范围')
  ok(Number(note?.[1]) < 90 && Number(note?.[1]) > 0, '收录数在 1 到 89 之间')
  ok(!capped.user.includes('第90章'), '未收录的章节不出现在 prompt 里')
})

runAll('breakdown')
