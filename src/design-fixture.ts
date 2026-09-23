import { dateKey, type StatsState } from './stats'
import type { ProjectData } from './storage'
import { createBreakdownProject, normalizeChapterAnalysis, parseTxtBook, recalcBreakdownProject } from './breakdown'

/** 预览用统计：围绕今天生成两周记录，让日历和趋势图看起来是“正在连载”的状态。 */
function designStats(): StatsState {
  const today = new Date()
  const manualPlan = [0, 320, 1180, 0, 2400, 640, 1520]
  const aiPlan = [0, 0, 480, 0, 900, 0, 300]
  const days = []
  for (let offset = 13; offset >= 0; offset--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const seed = ((offset * 7) % 11) % 7
    const manual = offset === 0 ? 860 : manualPlan[seed]
    const ai = offset === 0 ? 640 : aiPlan[seed]
    days.push({ date: dateKey(date), manual, ai, books: { 'design-book': { manual, ai } } })
  }
  return { days, dailyGoal: 2000 }
}

/** 只在开发环境 ?ui-preview=1 使用；不会写入读者的本地作品。 */
export function designFixture(): ProjectData {
  return {
    version: 1,
    model: { baseUrl: '', model: '', apiKey: '' },
    stats: designStats(),
    notes: [
      { id: 'design-note-1', content: '守夜人交换记忆的代价，是交换者会慢慢忘记自己曾经记住的人。让主角发现：他记得妹妹，是因为有人替他付过代价。', tags: ['悬疑', '核心设定'], pinned: true, createdAt: '2026-09-18T21:12:00.000Z', updatedAt: '2026-09-18T21:12:00.000Z' },
      { id: 'design-note-2', content: '开场画面：凌晨的便利店，所有人都同时抬头看钟，只有主角在看人。', tags: ['开局'], pinned: false, createdAt: '2026-09-17T09:40:00.000Z', updatedAt: '2026-09-17T09:40:00.000Z' },
      { id: 'design-note-3', content: '红雨衣女孩每次出现，天气都会变。可以做成“她即异常”的伏笔。', tags: ['人物', '伏笔'], pinned: false, createdAt: '2026-09-16T23:05:00.000Z', updatedAt: '2026-09-16T23:05:00.000Z' },
    ],
    books: [{
      id: 'design-book',
      title: '夜行者档案',
      premise: '一座城市会在午夜交换居民的记忆，守夜人林澈发现自己的妹妹从所有人的记忆中消失了。',
      updatedAt: '2026-09-20T00:00:00.000Z',
      chapters: [
        {
          id: 'design-chapter-1',
          title: '第一章 午夜之后',
          wordGoal: 3000,
          content: '凌晨零点，城市的钟声敲了十三下。\n\n林澈停在便利店门口，手里的热咖啡忽然凉了。街对面的人群仍在走动，仿佛谁都没有听见多出来的那一声。只有他看见，路灯下那个穿红雨衣的女孩抬起头，朝他做了个噤声的手势。\n\n下一秒，手机亮起。一条没有署名的短信写着：别回家。你妹妹已经不在那里了。\n\n他拨出那个熟悉的号码。提示音响了很久，接通的人却问：“你找谁？”',
          updatedAt: '2026-09-20T00:00:00.000Z',
          history: [{ id: 'design-version-1', title: '第一章 午夜之后', content: '凌晨零点，城市的钟声敲了十二下。\n\n林澈停在便利店门口，手里的咖啡凉了。街对面的人群仍在走动，仿佛谁都没有听见钟声。路灯下那个穿红雨衣的女孩抬起头，朝他做了个噤声的手势。\n\n手机亮起。一条短信写着：别回家。\n\n他拨出那个熟悉的号码。提示音响了很久，接通的人却问：“你找谁？”', savedAt: '2026-09-19T22:30:00.000Z', source: 'manual' }],
        },
        { id: 'design-chapter-2', title: '第二章 被抹去的名字', outline: '林澈回到家，发现妹妹的所有痕迹都被抹去；一张旧合照却留下了她的影子。结尾有人在门外喊出她的名字。', content: '门锁只转了半圈就开了。\n\n玄关的灯亮着，鞋柜上摆着两双拖鞋，一双是他的，另一双也是他的。', updatedAt: '2026-09-20T00:00:00.000Z', proseCandidates: [
          { id: 'design-candidate-1', kind: 'rewrite', content: '林澈把钥匙插进锁孔，门从里面轻轻弹开。\n\n客厅的灯亮着。母亲坐在餐桌旁，正把两副碗筷往桌上摆。林澈盯着那张桌子，数了一遍，又数了一遍。以前这里总有第三只杯子，杯沿缺了一小块，是小雨摔过的。\n\n“你在找什么？”母亲问。\n\n林澈没有回答。他走进妹妹的房间。墙上没有海报，书架空了，床头却留着一道浅浅的灰痕，像有东西刚被人拿走。\n\n他翻出抽屉里的旧相册。合照上只站着他和母亲，可照片右下角，一只小小的手正攥着他的衣角。', instruction: '用细节表现妹妹被抹去，结尾保留悬念。', createdAt: '2026-09-20T00:10:00.000Z', baseUpdatedAt: '2026-09-20T00:00:00.000Z' },
          { id: 'design-candidate-2', kind: 'continue', content: '林澈没有脱鞋。他顺着走廊往里看，妹妹房门原来的位置，竟多了一面墙。\n\n墙漆还没干透，空气里有一股刺鼻的味道。他伸手摸过去，指尖沾上一点白。墙的另一边，像有什么东西轻轻敲了两下。', instruction: '从门口的异常继续写，节奏紧一点。', createdAt: '2026-09-20T00:08:00.000Z', baseUpdatedAt: '2026-09-20T00:00:00.000Z' },
        ] },
        { id: 'design-chapter-3', title: '第三章 红雨衣', content: '', updatedAt: '2026-09-20T00:00:00.000Z' },
        { id: 'design-chapter-4', title: '第四章 守夜人的规矩', content: '', updatedAt: '2026-09-20T00:00:00.000Z' },
      ],
      lore: [
        { id: 'design-lore-1', title: '午夜交换', mode: 'world', content: '每天午夜，城市会随机交换两个人关于同一件事的记忆。交换不可逆，但保留纸质记录的人可以发现差异。' },
        { id: 'design-lore-2', title: '林澈', mode: 'character', content: '二十七岁，城市夜班档案员。害怕遗忘，却必须不断用自己的记忆换取线索。' },
        { id: 'design-lore-4', title: '第十三声钟响', mode: 'timeline', timeLabel: '第一卷 · 第一天 00:00', content: '林澈听见城市时钟敲了十三下，并收到关于妹妹失踪的匿名短信。' },
        { id: 'design-lore-3', title: '第一卷目标', mode: 'plot', content: '林澈追查妹妹消失的原因，最终发现记忆交换由守夜人主动维持。' },
      ],
      chat: [
        { id: 'design-user', role: 'user', mode: 'prose', chapterId: 'design-chapter-1', content: '接着写他推开家门后的场景。用细节表现“不对劲”，不要直接解释真相。' },
        { id: 'design-ai', role: 'assistant', mode: 'prose', chapterId: 'design-chapter-1', content: '门锁只转了半圈就开了。\n\n玄关的灯亮着，鞋柜上摆着两双拖鞋，一双是他的，另一双也是他的。林澈弯下腰，手指摸到鞋柜侧面那道铅笔刻痕：小雨，十四岁。\n\n刻痕还在。可他抬头时，客厅里传来母亲的声音：“你怎么又把妹妹的名字写在柜子上？”' },
      ],
    }],
  }
}

// ---------------------------------------------------------------------------
// 竞品拆书与扫榜的预览样例：让 ?panel=breakdown / ?panel=rank 两个设计页有内容可看
// ---------------------------------------------------------------------------

function designBreakdownStore(): import('./breakdown').BreakdownStore {
  const parsed = parseTxtBook([
    '第一章 第十三声钟响',
    '凌晨零点，城市的钟声敲了十三下。林澈停在便利店门口，手里的热咖啡忽然凉了。',
    '街对面的人群仍在走动，仿佛谁都没有听见多出来的那一声。',
    '路灯下，穿红雨衣的女孩抬起头，朝他做了个噤声的手势。',
    '手机亮起，一条没有署名的短信写着：别回家。',
    '第二章 被抹去的名字',
    '门锁只转了半圈就开了。玄关的灯亮着，鞋柜上摆着两双拖鞋，一双是他的，另一双也是他的。',
    '他翻出抽屉里的旧相册，合照上只站着他和母亲。',
  ].join('\n'), '夜行者档案')
  const project = createBreakdownProject(parsed)
  const first = project.chapters[0]
  const { analysis, insightIds } = normalizeChapterAnalysis({
    summary: '第十三声钟响只被主角听见，红雨衣女孩的噤声手势埋下「异常同伴」的钩子。',
    outline: [
      { title: '异常的钟声', startPara: 1, endPara: 1, text: '只有林澈听见第十三声，确立他的感知异于常人。' },
      { title: '噤声手势', startPara: 3, endPara: 4, text: '女孩主动示警，匿名短信把悬念推向家门。' },
    ],
    rhythm: [
      { label: '开篇钩子', desc: '钟声异常 + 短信威胁，两段内完成双重悬念' },
    ],
    setting: [
      { name: '午夜交换', type: '世界观', desc: '每天午夜城市交换记忆，纸质记录可以发现差异。', tags: ['核心规则'] },
    ],
    relations: [
      { from: '林澈', to: '红雨衣女孩', relation: '可疑的同伴', desc: '她最早知道异常，主动示意噤声。' },
    ],
  }, first.paragraphs.length)
  first.status = 'done'
  first.analysis = analysis
  first.insightIds = insightIds
  recalcBreakdownProject(project)
  return { version: 1, projects: [project] }
}

function designRankStore(): import('./rank').RankStore {
  const statDate = dateKey(new Date())
  const items = Array.from({ length: 10 }, (_, index) => ({
    rankNo: index + 1,
    rankChange: index % 3 === 0 ? 2 : index % 3 === 1 ? -1 : 0,
    bookTitle: `样例榜单书${index + 1}`,
    bookId: `7401${index}`,
    bookUrl: `https://fanqienovel.com/page/7401${index}`,
    intro: null,
    authorName: '样例作者',
    statusText: index % 2 ? '连载中' : '已完结',
    metricName: '在读',
    metricValue: 100000 - index * 6300,
    metricText: `${((100000 - index * 6300) / 10000).toFixed(1)}万`,
    readingCount: 100000 - index * 6300,
    readingText: null,
    lastChapterTitle: `第${120 - index}章 夜行`,
    lastChapterUrl: null,
    lastUpdateTimeText: '1小时前',
    coverUrl: null,
    categoryName: '都市',
    categorySubName: null,
  }))
  return {
    version: 1,
    viewedSourceIds: [1],
    snapshots: [{ sourceId: 1, statDate, fetchedAt: Date.now(), pageTitle: '番茄都市榜', cutoffText: null, origin: 'crawl', items }],
  }
}

/** 仅开发预览用：拆书与扫榜面板的样例库，不落盘。 */
export function designSideStores(): { breakdown: import('./breakdown').BreakdownStore; rank: import('./rank').RankStore } {
  return { breakdown: designBreakdownStore(), rank: designRankStore() }
}
