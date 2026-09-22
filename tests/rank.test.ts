import {
  attachCompare,
  crawlRankSnapshot,
  exportRankCsv,
  exportRankStore,
  findRankSource,
  importRankPaste,
  importRankStore,
  listRankSnapshotDates,
  loadRankStore,
  localDate,
  markRankSourceViewed,
  parseChineseNumber,
  parseFanqieRankHtml,
  parseQimaoRankJson,
  parseRankPaste,
  rankAuthorTrend,
  rankCategoryDistribution,
  rankChange,
  rankCompetitor,
  rankLatest,
  rankLatestAll,
  rankReportPrompt,
  rankSourceLabel,
  rankSourcesFor,
  rankTagTrends,
  RANK_FILE_FORMAT,
  RANK_MAX_SNAPSHOTS,
  RANK_RETENTION_DAYS,
  readNewestRankSnapshot,
  readRankSnapshot,
  removeRankSnapshot,
  saveRankStore,
  toSourceOption,
  writeRankSnapshot,
  type RankItem,
  type RankSnapshotDoc,
  type RankStore,
} from '../src/rank'
import { equal, ok, runAll, test, throws } from './harness'

// ---------------------------------------------------------------------------
//  fixtures
// ---------------------------------------------------------------------------

/** 番茄私用区字符（字典里 58670 → '0'），用来验证字体解码 */
const pua = (code: number) => String.fromCharCode(code)

const fanqieItem = (params: {
  no: string
  title: string
  href: string
  author: string
  count: string
  change?: string
  last?: string
}) => `
      <div class="rank-book-item">
        <div class="book-item-index"><h1>${params.no}</h1><p>${params.change ? `<span class="${params.change.split('|')[0]}">${params.change.split('|')[1]}</span>` : '<span>0</span>'}</p></div>
        <div class="book-cover"><a href="${params.href}"><img src="//fqnovelpic.com/novel-pic/x.jpg" /></a></div>
        <div class="book-item-content">
          <div class="title"><a href="${params.href}">${params.title}</a></div>
          <div class="author"><a href="/author/1"><span>${params.author}</span></a></div>
          <div class="desc">这是简介</div>
          <div class="book-item-count">${params.count}</div>
          <div class="book-item-footer">
            <div class="book-item-footer-last"><a class="chapter" href="${params.href}/1">${params.last ? `最近更新：${params.last}` : '第1章 开局'}</a></div>
            <div class="book-item-footer-status">连载中</div>
            <div class="book-item-footer-time">2小时前</div>
          </div>
        </div>
      </div>`

const fanqieHtml = (items: string[]) => `<html><body>
  <div class="muye-rank-wrap-header"><h1>阅读榜</h1><p>统计范围：昨日 0 点</p></div>
  <div class="muye-rank-book-list">${items.join('')}
  </div>
</body></html>`

const sampleFanqieHtml = () =>
  fanqieHtml([
    fanqieItem({ no: '1', title: '第一本书', href: '/page/7401', author: '作者甲', count: '在读 123.5万', change: 'up|2', last: '第100章 终局' }),
    fanqieItem({ no: '2', title: '第二本书', href: '/page/7402', author: '作者乙', count: '在读 98万', change: 'down|3' }),
    fanqieItem({ no: '3', title: '第三本书', href: '/page/7403', author: '作者丙', count: '在读 56.2万' }),
  ])

const qimaoJson = () => ({
  data: {
    table_data: [
      {
        book_id: '9001',
        title: '七猫第一书',
        book_url: '',
        author: '猫作者',
        number: '12.5',
        unit: '万',
        index_change: '1',
        surge_rank: '3',
        latest_chapter_id: '77',
        latest_chapter_title: '第七十七章 反转',
        update_time: '1小时前',
        category1_name: '都市',
        category2_name: '都市高武',
        is_over: '0',
        intro: '七猫简介',
        image_link: 'https://img.example.com/1.jpg',
      },
      {
        book_id: '9002',
        title: '七猫第二书',
        book_url: 'https://www.qimao.com/shuku/9002/',
        author: '另一位',
        number: '1.2',
        unit: '亿',
        index_change: '-1',
        surge_rank: '5',
        latest_chapter_id: '12',
        latest_chapter_title: '第十二章',
        update_time: '3小时前',
        category1_name: '玄幻',
        category2_name: '东方玄幻',
        is_over: '1',
        intro: '',
        image_link: '',
      },
    ],
  },
})

const item = (params: Partial<RankItem> & { rankNo: number; bookTitle: string; bookUrl: string }): RankItem => ({
  rankChange: 0,
  bookId: null,
  intro: null,
  authorName: null,
  statusText: null,
  metricName: '在读',
  metricValue: 0,
  metricText: null,
  readingCount: 0,
  readingText: null,
  coverUrl: null,
  lastChapterTitle: null,
  lastChapterUrl: null,
  lastUpdateTimeText: null,
  categoryName: null,
  categorySubName: null,
  ...params,
})

const snapshot = (sourceId: number, statDate: string, items: RankItem[]): RankSnapshotDoc => ({
  sourceId,
  statDate,
  fetchedAt: Date.now(),
  pageTitle: null,
  cutoffText: null,
  origin: 'crawl',
  items,
})

const storeOf = (...docs: RankSnapshotDoc[]): RankStore => ({ version: 1, viewedSourceIds: [], snapshots: docs })

// ---------------------------------------------------------------------------
// 解析：番茄 HTML
// ---------------------------------------------------------------------------

/** 线上页面的真实结构：在读、状态、最新章节这些字段用 span 包裹，并用注释节点隔开文字与数字 */
const fanqieItemSpan = (params: {
  no: string
  title: string
  href: string
  author: string
  count: string
  last: string
  time: string
}) => `
      <div class="rank-book-item">
        <div class="book-item-index"><h1>${params.no}</h1><p><span>0</span></p></div>
        <div class="book-cover"><a href="${params.href}"><img src="//fqnovelpic.com/novel-pic/x.jpg" /></a></div>
        <div class="book-item-content">
          <div class="title"><a href="${params.href}">${params.title}</a></div>
          <div class="author"><a href="/author/1"><span>${params.author}</span></a></div>
          <div class="desc">这是简介</div>
          <span class="book-item-count">在读：<!-- -->${params.count}</span>
          <div class="book-item-footer">
            <span class="book-item-footer-last"><a class="chapter" href="${params.href}/1">最近更新：<!-- -->${params.last}</a></span>
            <span class="book-item-footer-status">连载中</span>
            <span class="book-item-footer-time">${params.time}</span>
          </div>
        </div>
      </div>`

const realFanqieHtml = () => `<html><body>
  <header class="muye-rank-wrap-header"><div><h1>阅读榜</h1><p>统计时间截止至<!-- -->09-21 24:00</p></div></header>
  <div class="muye-rank-book-list">
  ${fanqieItemSpan({ no: '1', title: '第一本书', href: '/page/7401', author: '作者甲', count: '123.5万', last: '第100章 终局', time: '2026-09-21 20:35' })}
  ${fanqieItemSpan({ no: '2', title: '第二本书', href: '/page/7402', author: '作者乙', count: '98万', last: '第99章 中局', time: '2026-09-21 22:01' })}
  </div>
</body></html>`

test('parseFanqieRankHtml 解析榜单条目与头部说明', () => {
  const parsed = parseFanqieRankHtml(sampleFanqieHtml())
  equal(parsed.pageTitle, '阅读榜')
  equal(parsed.cutoffText, '统计范围：昨日 0 点')
  equal(parsed.items.length, 3)
  const first = parsed.items[0]
  equal(first.rankNo, 1)
  equal(first.bookTitle, '第一本书')
  equal(first.bookId, '7401')
  equal(first.bookUrl, 'https://fanqienovel.com/page/7401')
  equal(first.authorName, '作者甲')
  equal(first.rankChange, 2, 'up 表示名次上升')
  equal(first.metricText, '在读 123.5万')
  equal(first.metricValue, 1235000)
  equal(first.lastChapterTitle, '第100章 终局', '最近更新前缀被剥掉')
  equal(first.intro, '这是简介')
  equal(first.statusText, '连载中')
  equal(parsed.items[1].rankChange, -3, 'down 表示名次下降')
  equal(parsed.items[2].rankChange, 0, '没有升降标记时持平')
  equal(parsed.items[0].categoryName, null, '番茄条目本身不带分类，由源配置补')
})

test('parseFanqieRankHtml 吃下线上 span 包裹与注释节点结构', () => {
  // 番茄在 div 和 span 之间换过包裹，header 也从 div 换成了 header；两种都要能解析
  const parsed = parseFanqieRankHtml(realFanqieHtml())
  equal(parsed.pageTitle, '阅读榜')
  equal(parsed.cutoffText, '统计时间截止至 09-21 24:00', '注释节点只留一个空格')
  equal(parsed.items.length, 2)
  const first = parsed.items[0]
  equal(first.bookTitle, '第一本书')
  equal(first.authorName, '作者甲')
  equal(first.metricText, '在读：123.5万')
  equal(first.metricValue, 1235000)
  equal(first.statusText, '连载中')
  equal(first.lastChapterTitle, '第100章 终局')
  equal(first.lastUpdateTimeText, '2026-09-21 20:35')
  equal(parsed.items[1].lastUpdateTimeText, '2026-09-21 22:01')
})

test('parseFanqieRankHtml 用字体字典解码私用区字符', () => {
  const html = fanqieHtml([
    fanqieItem({ no: '1', title: `书名${pua(58670)}`, href: '/page/1', author: '甲', count: '在读 1万' }),
    fanqieItem({ no: '2', title: '正常书名', href: '/page/2', author: '乙', count: '在读 2万' }),
  ])
  const parsed = parseFanqieRankHtml(html)
  equal(parsed.items[0].bookTitle, '书名0')
  equal(parsed.items[1].bookTitle, '正常书名')
})

test('parseFanqieRankHtml 字体乱码超半数时熔断报错', () => {
  // 私用区里字典查不到的码点：番茄换字体后解码失效，残留即为乱码
  const garbled = (no: string) => fanqieItem({ no, title: `${pua(0xe000)}${pua(0xe001)}书`, href: `/page/${no}`, author: '甲', count: '在读 1万' })
  throws(() => parseFanqieRankHtml(fanqieHtml([garbled('1'), garbled('2'), garbled('3')])), '疑似目标站更换字体')
})

test('parseFanqieRankHtml 页面没有条目时如实报错', () => {
  throws(() => parseFanqieRankHtml('<html><body><div class="muye-rank-book-list"></div></body></html>'), '没有解析到榜单条目')
  throws(() => parseFanqieRankHtml(''), '没有解析到榜单条目')
})

// ---------------------------------------------------------------------------
// 解析：七猫 JSON
// ---------------------------------------------------------------------------

test('parseQimaoRankJson 映射字段与热度单位', () => {
  const items = parseQimaoRankJson(qimaoJson())
  equal(items.length, 2)
  const first = items[0]
  equal(first.rankNo, 1)
  equal(first.bookId, '9001')
  equal(first.bookTitle, '七猫第一书')
  equal(first.bookUrl, 'https://www.qimao.com/shuku/9001/', 'book_url 为空时按 ID 兜底')
  equal(first.authorName, '猫作者')
  equal(first.metricText, '12.5万')
  equal(first.metricValue, 125000)
  equal(first.rankChange, 3, 'index_change=1 且 surge_rank=3 表示升 3 名')
  equal(first.statusText, '连载中')
  equal(first.categoryName, '都市')
  equal(first.categorySubName, '都市高武')
  equal(first.lastChapterUrl, 'https://www.qimao.com/shuku/9001-77/')
  const second = items[1]
  equal(second.metricValue, 120000000, '亿为单位')
  equal(second.rankChange, -5)
  equal(second.statusText, '已完结')
  equal(second.bookUrl, 'https://www.qimao.com/shuku/9002/', '保留原始 book_url')
})

test('parseQimaoRankJson 结构不对时返回空列表', () => {
  equal(parseQimaoRankJson(null).length, 0)
  equal(parseQimaoRankJson({ data: {} }).length, 0)
  equal(parseQimaoRankJson('坏数据').length, 0)
})

test('parseChineseNumber 解析万/亿', () => {
  equal(parseChineseNumber('在读 123.5万'), 1235000)
  equal(parseChineseNumber('1.2亿'), 120000000)
  equal(parseChineseNumber('876'), 876)
  equal(parseChineseNumber('暂无'), 0)
})

// ---------------------------------------------------------------------------
// 快照存档
// ---------------------------------------------------------------------------

test('writeRankSnapshot 同源同日覆盖并保留多日历史', () => {
  const store = storeOf()
  const today = localDate()
  const yesterday = localDate(1)
  writeRankSnapshot(store, snapshot(1, yesterday, [item({ rankNo: 1, bookTitle: '旧', bookUrl: '/a' })]))
  writeRankSnapshot(store, snapshot(1, today, [item({ rankNo: 1, bookTitle: '新', bookUrl: '/a' })]))
  writeRankSnapshot(store, snapshot(1, today, [item({ rankNo: 1, bookTitle: '更新', bookUrl: '/a' })]))
  equal(store.snapshots.length, 2, '同日只留一份')
  equal(readRankSnapshot(store, 1, today)?.items[0].bookTitle, '更新')
  equal(listRankSnapshotDates(store, 1).join(','), `${today},${yesterday}`, '日期倒序')
})

test('快照读取：最新一份、限定不晚于某天、缺失返回 null', () => {
  const store = storeOf(
    snapshot(1, localDate(3), [item({ rankNo: 1, bookTitle: '三天前', bookUrl: '/a' })]),
    snapshot(1, localDate(1), [item({ rankNo: 1, bookTitle: '一天前', bookUrl: '/a' })]),
    snapshot(2, localDate(1), [item({ rankNo: 1, bookTitle: '别处', bookUrl: '/b' })])
  )
  equal(readNewestRankSnapshot(store, 1)?.items[0].bookTitle, '一天前')
  equal(readNewestRankSnapshot(store, 1, localDate(2))?.items[0].bookTitle, '三天前')
  equal(readNewestRankSnapshot(store, 1, localDate(5)), null)
  equal(readNewestRankSnapshot(store, 99), null)
  equal(readRankSnapshot(store, 1, '1999-01-01'), null)
})

test('快照清理：超期与超量都会淘汰最旧的', () => {
  const store = storeOf()
  writeRankSnapshot(store, snapshot(1, localDate(RANK_RETENTION_DAYS + 5), [item({ rankNo: 1, bookTitle: '太老', bookUrl: '/a' })]))
  writeRankSnapshot(store, snapshot(1, localDate(), [item({ rankNo: 1, bookTitle: '今天', bookUrl: '/a' })]))
  equal(store.snapshots.length, 1, '超过保留期的快照不入库')

  const many = storeOf()
  for (let index = 1; index <= RANK_MAX_SNAPSHOTS + 5; index += 1) {
    // 前 5 份是昨天的，其余是今天的：总量超限时先淘汰旧日期的
    const statDate = index <= 5 ? localDate(1) : localDate()
    writeRankSnapshot(many, snapshot(index, statDate, [item({ rankNo: 1, bookTitle: `书${index}`, bookUrl: `/b${index}` })]))
  }
  equal(many.snapshots.length, RANK_MAX_SNAPSHOTS, '超出总量上限时截断')
  equal(many.snapshots.some(doc => doc.statDate === localDate(1)), false, '旧日期的快照被挤掉')
})

test('removeRankSnapshot 只删指定源指定日期', () => {
  const store = storeOf(
    snapshot(1, localDate(2), [item({ rankNo: 1, bookTitle: 'a', bookUrl: '/a' })]),
    snapshot(1, localDate(1), [item({ rankNo: 1, bookTitle: 'b', bookUrl: '/b' })]),
    snapshot(2, localDate(1), [item({ rankNo: 1, bookTitle: 'c', bookUrl: '/c' })])
  )
  removeRankSnapshot(store, 1, localDate(1))
  equal(listRankSnapshotDates(store, 1).join(','), localDate(2))
  equal(listRankSnapshotDates(store, 2).length, 1)
})

test('存档可写入 localStorage 再读回', () => {
  const store = storeOf(snapshot(1, localDate(), [item({ rankNo: 1, bookTitle: '落盘', bookUrl: '/a', bookId: '7401' })]))
  saveRankStore(store)
  const loaded = loadRankStore()
  equal(loaded.snapshots.length, 1)
  equal(loaded.snapshots[0].items[0].bookTitle, '落盘')
  saveRankStore({ version: 1, viewedSourceIds: [], snapshots: [] })
  equal(loadRankStore().snapshots.length, 0)
})

test('markRankSourceViewed 去重保序并设上限', () => {
  const store = storeOf()
  markRankSourceViewed(store, 5)
  markRankSourceViewed(store, 7)
  markRankSourceViewed(store, 5)
  equal(store.viewedSourceIds.join(','), '5,7')
  for (let id = 10; id < 40; id += 1) markRankSourceViewed(store, id)
  ok(store.viewedSourceIds.length <= 12, '最多记 12 个')
  equal(store.viewedSourceIds[0], 39)
})

// ---------------------------------------------------------------------------
// 排名对照与查询
// ---------------------------------------------------------------------------

test('attachCompare 对照上一份快照补差值', () => {
  const previous = snapshot(1, localDate(1), [
    item({ rankNo: 1, bookTitle: '掉下去的', bookUrl: '/a', bookId: '1', metricValue: 100 }),
    item({ rankNo: 2, bookTitle: '升上去的', bookUrl: '/b', bookId: '2', metricValue: 200 }),
  ])
  const current = [
    item({ rankNo: 2, bookTitle: '掉下去的', bookUrl: '/a', bookId: '1', metricValue: 180 }),
    item({ rankNo: 1, bookTitle: '升上去的', bookUrl: '/b', bookId: '2', metricValue: 150 }),
    item({ rankNo: 3, bookTitle: '新来的', bookUrl: '/c', bookId: '3', metricValue: 10 }),
  ]
  const compared = attachCompare(current, previous)
  equal(compared[0].rankChangeDelta, -1, '名次下滑为负值')
  equal(compared[0].prevRankNo, 1)
  equal(compared[0].prevMetricValue, 100)
  equal(compared[0].metricDelta, 80)
  equal(compared[1].rankChangeDelta, 1, '名次上升为正值')
  equal(compared[1].metricDelta, -50)
  equal(compared[2].rankChangeDelta, null, '新书没有对照')
  const none = attachCompare(current, null)
  ok(none.every(row => row.rankChangeDelta === null), '没有上一份快照时全部无对照')
})

test('rankLatest 自动选对照日期并支持关键词/分类过滤与分页', () => {
  const store = storeOf(
    snapshot(1, localDate(2), [
      item({ rankNo: 1, bookTitle: '旧王', bookUrl: '/a', bookId: '1', metricValue: 500, categoryName: '都市高武' }),
      item({ rankNo: 2, bookTitle: '旧人', bookUrl: '/b', bookId: '2', metricValue: 400, categoryName: '玄幻脑洞' }),
    ]),
    snapshot(1, localDate(1), [
      item({ rankNo: 1, bookTitle: '新人', bookUrl: '/b', bookId: '2', metricValue: 460, categoryName: '玄幻脑洞' }),
      item({ rankNo: 2, bookTitle: '旧王', bookUrl: '/a', bookId: '1', metricValue: 420, categoryName: '都市高武' }),
    ])
  )
  const latest = rankLatest({ sourceId: 1 }, store)
  equal(latest.snapshot?.statDate, localDate(1))
  equal(latest.compareDate, localDate(2))
  equal(latest.list[0].bookTitle, '新人')
  equal(latest.list[0].rankChangeDelta, 1, '从第 2 名升到第 1 名')

  const keyword = rankLatest({ sourceId: 1, keyword: '旧王' }, store)
  equal(keyword.total, 1)
  equal(keyword.list[0].bookTitle, '旧王')

  const category = rankLatest({ sourceId: 1, categoryCode: '1_2_1014' }, store)
  equal(category.total, 1, '分类 code 还原成分类名后过滤')
  equal(category.list[0].categoryName, '都市高武')

  const unknown = rankLatest({ sourceId: 1, categoryCode: '不存在的code' }, store)
  equal(unknown.total, 0, '查不到的 code 如实返回空，不静默回退全量')

  const page = rankLatest({ sourceId: 1, page: 2, size: 1 }, store)
  equal(page.list.length, 1)
  equal(page.list[0].bookTitle, '旧王')
  equal(page.total, 2)

  const empty = rankLatest({ sourceId: 42 }, store)
  equal(empty.snapshot, null)
  equal(empty.list.length, 0)

  const explicit = rankLatest({ sourceId: 1, statDate: localDate(2), compareDate: localDate(1) }, store)
  equal(explicit.snapshot?.statDate, localDate(2))
  equal(explicit.compareDate, localDate(1), '显式指定对照日期优先')
})

test('rankLatestAll 合并站点各源快照并按指标重排', () => {
  const store = storeOf(
    snapshot(1, localDate(1), [item({ rankNo: 1, bookTitle: '甲榜一书', bookUrl: '/a', bookId: '1', metricValue: 300, categoryName: '都市高武' })]),
    snapshot(2, localDate(1), [item({ rankNo: 1, bookTitle: '乙榜一书', bookUrl: '/b', bookId: '2', metricValue: 900 })]),
    snapshot(2, localDate(1), [item({ rankNo: 2, bookTitle: '重复书', bookUrl: '/a', bookId: '1', metricValue: 999 })])
  )
  const merged = rankLatestAll({ siteCode: 'fanqie' }, store)
  equal(merged.total, 2, '同书跨榜只留一条')
  equal(merged.list[0].bookTitle, '乙榜一书', '按指标重排')
  equal(merged.list[0].rankNo, 1)
  ok(merged.list.every(row => row.categoryName), '分类名从源配置补齐')
})

// ---------------------------------------------------------------------------
// 分析口径
// ---------------------------------------------------------------------------

test('rankCategoryDistribution 统计分类占比', () => {
  const store = storeOf(
    snapshot(1, localDate(1), [
      item({ rankNo: 1, bookTitle: 'a', bookUrl: '/a', categoryName: '都市高武' }),
      item({ rankNo: 2, bookTitle: 'b', bookUrl: '/b', categoryName: '都市高武' }),
      item({ rankNo: 3, bookTitle: 'c', bookUrl: '/c', categoryName: '玄幻脑洞' }),
    ]),
    snapshot(2, localDate(1), [item({ rankNo: 1, bookTitle: 'd', bookUrl: '/d' })])
  )
  const result = rankCategoryDistribution({ siteCode: 'fanqie' }, store)
  equal(result.statDate, localDate(1))
  equal(result.total, 4)
  equal(result.list[0].categoryName, '都市高武')
  equal(result.list[0].count, 2)
  ok(Math.abs(result.list[0].ratio - 0.5) < 1e-9)
  ok(result.list.some(row => row.categoryName === '玄幻脑洞' && row.count === 2), '没带分类的条目用源配置的分类名归并')
  const empty = rankCategoryDistribution({ siteCode: 'qimao' }, store)
  equal(empty.total, 0)
  equal(empty.list.length, 0)
})

test('rankTagTrends 逐日计数并取 Top N', () => {
  const store = storeOf()
  const days = 3
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = localDate(offset)
    const hot = 3 - offset
    writeRankSnapshot(store, snapshot(1, date, [
      ...Array.from({ length: hot }, (_, index) => item({ rankNo: index + 1, bookTitle: `热${index}`, bookUrl: `/h${date}${index}`, categoryName: '都市高武' })),
      item({ rankNo: 99, bookTitle: '温', bookUrl: `/w${date}`, categoryName: '玄幻脑洞' }),
    ]))
  }
  const trend = rankTagTrends({ siteCode: 'fanqie', days, topN: 2 }, store)
  equal(trend.days, 3)
  equal(trend.startDate, localDate(2))
  equal(trend.endDate, localDate())
  equal(trend.list.length, 2)
  equal(trend.list[0].tag, '都市高武')
  equal(trend.list[0].series.map(point => point.count).join(','), '1,2,3', '按日期对齐')
  equal(trend.list[1].series.map(point => point.count).join(','), '1,1,1')
})

test('rankChange 按名次波动幅度排序', () => {
  const store = storeOf(
    snapshot(1, localDate(1), [
      item({ rankNo: 1, bookTitle: '老王', bookUrl: '/a', bookId: '1' }),
      item({ rankNo: 5, bookTitle: '新人', bookUrl: '/b', bookId: '2' }),
    ]),
    snapshot(1, localDate(), [
      item({ rankNo: 3, bookTitle: '老王', bookUrl: '/a', bookId: '1', metricValue: 88, metricText: '88万' }),
      item({ rankNo: 2, bookTitle: '新人', bookUrl: '/b', bookId: '2' }),
    ])
  )
  const result = rankChange({ sourceId: 1, topN: 2 }, store)
  equal(result.statDate, localDate())
  equal(result.compareDate, localDate(1))
  equal(result.list[0].bookTitle, '新人', '升幅最大排最前')
  equal(result.list[0].rankChange, 3)
  equal(result.list[1].bookTitle, '老王')
  equal(result.list[1].rankChange, -2)
  const noHistory = rankChange({ sourceId: 1, statDate: localDate(1) }, store)
  equal(noHistory.compareDate, null)
  const missing = rankChange({ sourceId: 9 }, store)
  equal(missing.statDate, null)
  equal(missing.list.length, 0)
})

test('rankCompetitor 逐日给出名次与指标曲线', () => {
  const store = storeOf()
  for (let offset = 2; offset >= 0; offset -= 1) {
    const date = localDate(offset)
    writeRankSnapshot(store, snapshot(1, date, [
      item({ rankNo: offset === 2 ? 1 : 2, bookTitle: '竞品甲', bookUrl: '/a', bookId: '1', metricValue: 100 * (3 - offset) }),
      item({ rankNo: 2, bookTitle: '竞品乙', bookUrl: '/b', bookId: '2', metricValue: 50 }),
    ]))
  }
  const result = rankCompetitor({ siteCode: 'fanqie', bookIds: '1,3', days: 3 }, store)
  equal(result.list.length, 2)
  const first = result.list[0]
  equal(first.bookTitle, '竞品甲', '标题从快照里认领')
  equal(first.series.map(point => point.rankNo).join(','), '1,2,2')
  equal(first.series[0].metricValue, 100)
  const missing = result.list[1]
  equal(missing.bookTitle, '3', '查无此书时退回 ID')
  ok(missing.series.every(point => point.rankNo === null), '缺那天的名次留空')
})

test('rankAuthorTrend 统计作者每日在榜书本与热度', () => {
  const store = storeOf()
  for (let offset = 1; offset >= 0; offset -= 1) {
    const date = localDate(offset)
    writeRankSnapshot(store, snapshot(1, date, [
      item({ rankNo: 1, bookTitle: '书一', bookUrl: '/a', bookId: '1', authorName: '跟踪作者', metricValue: 300 }),
      item({ rankNo: 2, bookTitle: '书二', bookUrl: '/b', bookId: '2', authorName: '跟踪作者', metricValue: 100 }),
      item({ rankNo: 3, bookTitle: '别人的书', bookUrl: '/c', bookId: '3', authorName: '别人', metricValue: 900 }),
    ]))
  }
  const trend = rankAuthorTrend({ siteCode: 'fanqie', authorName: '跟踪作者', days: 2 }, store)
  equal(trend.list.length, 2)
  equal(trend.list[1].bookCount, 2)
  equal(trend.list[1].metricSum, 400)
  equal(trend.list[1].metricAvg, 200)
  const none = rankAuthorTrend({ siteCode: 'fanqie', authorName: '查无此人', days: 2 }, store)
  ok(none.list.every(point => point.bookCount === 0 && point.metricAvg === 0))
})

// ---------------------------------------------------------------------------
// 导出与导入
// ---------------------------------------------------------------------------

test('exportRankCsv 带 BOM 与转义', () => {
  const store = storeOf(snapshot(1, localDate(), [
    item({ rankNo: 1, bookTitle: '带,逗号"引号"的书', bookUrl: '/a', authorName: '甲', categoryName: '都市', statusText: '连载中', metricText: '12万', rankChangeDelta: 2, lastChapterTitle: '第1章 开局' }),
    item({ rankNo: 2, bookTitle: '=HYPERLINK("https://evil.com")', bookUrl: '/b', authorName: '+8613800000000', categoryName: '都市', statusText: '连载中', metricText: '11万', rankChange: -1, lastChapterTitle: '@echo 危险' }),
  ]))
  const csv = exportRankCsv({ sourceId: 1 }, store)
  ok(csv.startsWith('﻿'), 'BOM 让 Excel 识别 UTF-8')
  const [header, row1, row2] = csv.slice(1).split('\n')
  equal(header, '名次,书名,作者,分类,状态,指标,名次变动,最新章节')
  ok(row1!.includes('"带,逗号""引号""的书"'), '逗号与引号按 CSV 规则转义')
  ok(row1!.includes('2'), '名次变动取对照值')
  ok(row2!.includes("'=HYPERLINK"), '等号开头的单元格降级为文本，不再构成公式')
  ok(row2!.includes("'+8613800000000"), '加号开头同样降级')
  ok(row2!.includes("'@echo"), '@ 开头同样降级')
  ok(row2!.includes(',-1,'), '负数名次变动是合法数据，不加前缀')
  throws(() => exportRankCsv({ sourceId: 99 }, store), '没有可导出的榜单数据')
})

test('扫榜存档可导出并再次导入', () => {
  const store = storeOf(snapshot(1, localDate(), [item({ rankNo: 1, bookTitle: '存档书', bookUrl: '/a', bookId: '7401', metricValue: 10 })]))
  const exported = JSON.parse(exportRankStore(store))
  equal(exported.format, RANK_FILE_FORMAT)
  const docs = importRankStore(exported)
  equal(docs.length, 1)
  equal(docs[0].items[0].bookTitle, '存档书')
  equal(docs[0].sourceId, 1)
  const target = storeOf()
  for (const doc of docs) writeRankSnapshot(target, doc)
  equal(readRankSnapshot(target, 1, localDate())?.items.length, 1)
})

test('importRankStore 拒绝坏文件但容忍坏快照', () => {
  throws(() => importRankStore(null), '不是有效的扫榜存档文件')
  throws(() => importRankStore({ format: 'other', snapshots: [] }), '文件格式不受支持')
  throws(() => importRankStore({ format: RANK_FILE_FORMAT }), '没有快照列表')
  throws(() => importRankStore({ format: RANK_FILE_FORMAT, snapshots: [{ sourceId: 1, statDate: localDate(), items: [] }, { sourceId: 0, statDate: '', items: [] }] }), '没有可导入的快照')
  const docs = importRankStore({
    format: RANK_FILE_FORMAT,
    snapshots: [
      { sourceId: 1, statDate: localDate(), items: [{ rankNo: 1, bookTitle: '好书', bookUrl: '/a' }] },
      { sourceId: 1, statDate: localDate(), items: '坏的' },
      null,
    ],
  })
  equal(docs.length, 1, '坏快照被跳过，好快照照常导入')
})

// ---------------------------------------------------------------------------
// 手动导入
// ---------------------------------------------------------------------------

test('parseRankPaste 自动判别番茄 HTML 与七猫 JSON', () => {
  const htmlParsed = parseRankPaste(sampleFanqieHtml(), findRankSource(1)!)
  equal(htmlParsed.items.length, 3)
  equal(htmlParsed.pageTitle, '阅读榜')
  const jsonParsed = parseRankPaste(JSON.stringify(qimaoJson()), findRankSource(25)!)
  equal(jsonParsed.items.length, 2)
  throws(() => parseRankPaste('', findRankSource(1)!), '先粘贴内容')
  throws(() => parseRankPaste('随便一段文字', findRankSource(1)!), '认不出内容')
  throws(() => parseRankPaste('{坏 JSON', findRankSource(25)!), '不是合法的 JSON')
  throws(() => parseRankPaste('{"data":{"table_data":[]}}', findRankSource(25)!), '没有榜单条目')
})

test('importRankPaste 落今日快照并补上分类', () => {
  const store = storeOf()
  const outcome = importRankPaste(store, 1, sampleFanqieHtml())
  equal(outcome.crawled, true)
  equal(outcome.statDate, localDate())
  const doc = readRankSnapshot(store, 1, localDate())
  ok(!!doc, '快照已写入')
  equal(doc!.origin, 'paste')
  equal(doc!.items[0].categoryName, '都市高武', '分类从源配置补')
  equal(doc!.items.length, 3)
  throws(() => importRankPaste(store, 999, sampleFanqieHtml()), '榜单源不存在')
})

// ---------------------------------------------------------------------------
// 源清单与抓取入口
// ---------------------------------------------------------------------------

test('源清单：平台、分类、源形状', () => {
  const sources = rankSourcesFor('fanqie', { gender: 'male', rankType: 'reading' })
  ok(sources.length > 0)
  ok(sources.every(source => source.rankType === 'reading'), '按榜单类型过滤')
  const option = toSourceOption(sources[0])
  equal(option.metricName, '在读', '番茄源默认在读指标')
  equal(option.scope, 'category')
  equal(option.gender, 'male')
  ok(!!option.categoryName, '带分类名')
  const qimao = rankSourcesFor('qimao')
  ok(qimao.length >= 3, '七猫大热/新书/收藏三个源')
  const label = rankSourceLabel(qimao[0])
  ok(label.includes('大热榜') || label.includes('新书榜') || label.includes('收藏榜'), '标签可读')
  equal(rankSourcesFor('qidian').length, 0, '起点未接入')
})

test('crawlRankSnapshot 拒绝不存在的榜单源', async () => {
  let message = ''
  try {
    await crawlRankSnapshot(storeOf(), 999)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  equal(message, '榜单源不存在或未启用')
})

// ---------------------------------------------------------------------------
// AI 解读提示词
// ---------------------------------------------------------------------------

test('rankReportPrompt 只喂数据并要求如实说明缺对照', () => {
  const store = storeOf(snapshot(1, localDate(), [
    item({ rankNo: 1, bookTitle: '头部书', bookUrl: '/a', bookId: '1', authorName: '甲', categoryName: '都市高武', metricText: '在读 300万', metricValue: 3000000, rankChangeDelta: 2 }),
  ]))
  const latest = rankLatest({ sourceId: 1 }, store)
  const prompt = rankReportPrompt({
    sourceLabel: '男频 · 阅读榜 · 都市高武',
    statDate: latest.snapshot?.statDate || null,
    compareDate: latest.compareDate,
    items: latest.list,
    distribution: rankCategoryDistribution({ siteCode: 'fanqie' }, store).list,
  })
  ok(prompt.system.includes('只依据给到的数据说话'), '系统设定要求不编造')
  ok(prompt.system.includes('暂无变化数据'), '没有对照时如实说明')
  ok(prompt.user.includes('男频 · 阅读榜 · 都市高武'))
  ok(prompt.user.includes('无对照'), '条目缺对照时标注清楚')
  ok(prompt.user.includes('都市高武 1 条'), '带上分类分布')

  const fresh = storeOf(snapshot(1, localDate(), [item({ rankNo: 1, bookTitle: '新书', bookUrl: '/a' })]))
  const noCompare = rankLatest({ sourceId: 1 }, fresh)
  const prompt2 = rankReportPrompt({
    sourceLabel: '榜单',
    statDate: noCompare.snapshot?.statDate || null,
    compareDate: noCompare.compareDate,
    items: noCompare.list,
    distribution: [],
  })
  ok(prompt2.user.includes('暂无历史快照'), '明确告诉模型没有对照')
})

runAll('rank')
