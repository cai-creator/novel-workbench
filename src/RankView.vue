<template>
  <div class="rk-page">
    <!-- 首页：选榜 + 抓榜 + 已抓榜单 -->
    <template v-if="!detailSource">
      <header class="rk-hero">
        <small>RANK SCOUT · 扫榜</small>
        <h1>看清榜单上什么在火</h1>
        <p>抓番茄、七猫的公开榜单存成本机快照。天天攒下来，就能看名次变动、分类分布、标签风向，还能盯竞品、追作者，让 AI 按数据写解读。</p>
      </header>
      <div class="rk-layout">
        <section class="rk-panel rk-crawl">
          <small>SOURCE</small>
          <h2>选一个榜单</h2>
          <div class="rk-tabs" role="tablist" aria-label="平台">
            <button v-for="item in platforms" :key="item.code" type="button" role="tab" :aria-selected="platform === item.code" :class="{ on: platform === item.code }" @click="platform = item.code">{{ item.name }}</button>
          </div>
          <div class="rk-fields">
            <label>榜单类型
              <select v-model="rankType">
                <option value="">全部类型</option>
                <option v-for="item in rankTypeOptions" :key="item" :value="item">{{ RANK_TYPE_LABEL[item] || item }}</option>
              </select>
            </label>
            <label>频道
              <select v-model="gender">
                <option value="">全部频道</option>
                <option value="male">男频</option>
                <option value="female">女频</option>
              </select>
            </label>
          </div>
          <label class="rk-field">榜单源
            <select v-model="activeSourceId">
              <option v-for="item in sources" :key="item.id" :value="item.id">{{ rankSourceLabel(item) }}</option>
            </select>
          </label>
          <div class="rk-actions">
            <button class="primary" type="button" :disabled="crawling || activeSourceId == null" @click="crawl">{{ crawling ? '抓取中…' : '抓取今日快照' }}</button>
            <button class="secondary" type="button" :disabled="activeSourceId == null" @click="openPaste">手动导入</button>
          </div>
          <p class="rk-hint">在线抓榜走开发代理（<code>pnpm dev</code> 已内置）；跨域被拦时，可把榜单页 HTML 或接口 JSON 粘进来手动导入，快照同样参与对照与分析。</p>
          <p v-if="crawlError" class="rk-error" role="alert">{{ crawlError }}</p>
          <p v-if="notice" class="rk-notice" role="status">{{ notice }}</p>
        </section>

        <section class="rk-panel rk-sources">
          <div class="rk-list-head">
            <div><small>SNAPSHOTS</small><h2>已抓榜单 <span>{{ sourceCards.length }}</span></h2></div>
            <div class="rk-list-actions">
              <button class="secondary" type="button" @click="archiveInput?.click()">导入存档</button>
              <input ref="archiveInput" type="file" accept=".json,application/json" hidden @change="handleArchive" />
              <button class="secondary" type="button" :disabled="!store.snapshots.length" @click="exportArchive">导出存档</button>
            </div>
          </div>
          <p v-if="!sourceCards.length" class="rk-empty"><span>✦</span>还没有快照。选个榜单点「抓取今日快照」，或先手动导入一份。</p>
          <article v-for="card in sourceCards" :key="card.id" class="rk-card">
            <div class="rk-card-top">
              <h3>{{ card.label }}</h3>
              <span class="rk-origin" :class="card.origin">{{ RANK_ORIGIN_LABEL[card.origin] }}</span>
            </div>
            <p class="rk-card-meta">{{ card.dates.length }} 份快照 · 最新 {{ card.newestDate || '—' }} · 最新一份 {{ card.itemCount }} 条</p>
            <div class="rk-card-actions">
              <button class="primary" type="button" @click="openSource(card.id)">看榜</button>
              <button class="text-danger" type="button" @click="removeSource(card.id)">删除</button>
            </div>
          </article>
          <section v-if="store.viewedSourceIds.length" class="rk-recent">
            <small>最近看过</small>
            <div class="rk-chips">
              <button v-for="id in store.viewedSourceIds" :key="id" type="button" class="rk-chip" @click="openSource(id)">{{ labelOf(id) }}</button>
            </div>
          </section>
        </section>
      </div>
    </template>

    <!-- 榜单详情 -->
    <template v-else-if="detailSource">
      <header class="rk-work-head">
        <div class="rk-work-title">
          <button class="secondary" type="button" @click="closeSource">← 全部榜单</button>
          <div><small>RANK DETAIL · {{ detailSource.siteCode === 'qimao' ? '七猫' : '番茄' }}</small><h1>{{ rankSourceLabel(detailSource) }}</h1></div>
        </div>
        <p class="rk-work-meta">
          <template v-if="latest?.snapshot">快照 {{ latest.snapshot.statDate }} · {{ latest.total }} 条 · 指标 {{ detailSource.metricName || '无' }}</template>
          <template v-else>还没有快照</template>
          <template v-if="latest?.compareDate"> · 对照 {{ latest.compareDate }}</template>
        </p>
        <div class="rk-work-actions">
          <label class="rk-inline">快照日期
            <select v-model="statDate" :disabled="!dates.length">
              <option value="">最新</option>
              <option v-for="date in dates" :key="date" :value="date">{{ date }}</option>
            </select>
          </label>
          <label class="rk-inline">对照日期
            <select v-model="compareDate" :disabled="!dates.length">
              <option value="">自动（上一份）</option>
              <option v-for="date in dates" :key="date" :value="date">{{ date }}</option>
            </select>
          </label>
          <input v-model="keyword" type="search" placeholder="搜书名 / 作者" aria-label="搜索榜单" />
          <button class="secondary" type="button" :disabled="crawling" @click="crawl">{{ crawling ? '抓取中…' : '重抓今日' }}</button>
          <button class="secondary" type="button" :disabled="!latest?.total" @click="exportCsv">导出 CSV</button>
        </div>
        <p v-if="crawlError" class="rk-error" role="alert">{{ crawlError }}</p>
        <p v-if="notice" class="rk-notice" role="status">{{ notice }}</p>
      </header>

      <template v-if="latest?.snapshot">
        <section class="rk-table-wrap">
          <table class="rk-table">
            <thead>
              <tr><th>名次</th><th>书名</th><th>作者</th><th>分类</th><th>指标</th><th>名次变动</th><th>状态</th><th>最新章节</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in latest.list" :key="row.bookId || row.bookUrl">
                <td class="rk-rank">{{ row.rankNo }}</td>
                <td class="rk-book">
                  <img v-if="row.coverUrl" :src="row.coverUrl" alt="" loading="lazy" />
                  <div>
                    <a :href="row.bookUrl" target="_blank" rel="noreferrer">{{ row.bookTitle }}</a>
                    <small v-if="row.lastUpdateTimeText">更新于 {{ row.lastUpdateTimeText }}</small>
                  </div>
                </td>
                <td>{{ row.authorName || '—' }}</td>
                <td>{{ row.categoryName || '—' }}</td>
                <td class="rk-metric">{{ row.metricText || formatMetric(row.metricValue) }}</td>
                <td class="rk-delta" :class="deltaTone(row.rankChangeDelta ?? row.rankChange)">{{ deltaText(row.rankChangeDelta ?? row.rankChange) }}</td>
                <td>{{ row.statusText || '—' }}</td>
                <td class="rk-last">{{ row.lastChapterTitle || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="latest.total > latest.list.length" class="rk-more">仅显示前 {{ latest.list.length }} 条，用搜索或导出 CSV 看全部 {{ latest.total }} 条。</p>
        </section>

        <nav class="rk-tabs rk-analysis-tabs" role="tablist" aria-label="分析口径">
          <button v-for="tab in analysisTabs" :key="tab" type="button" role="tab" :aria-selected="analysisTab === tab" :class="{ on: analysisTab === tab }" @click="analysisTab = tab">{{ tab }}</button>
        </nav>

        <section v-if="analysisTab === '分类分布'" class="rk-analysis">
          <h2>分类分布<span>共 {{ distribution.total }} 条</span></h2>
          <p v-if="!distribution.list.length" class="rk-empty">这份快照没有可聚合的分类信息。</p>
          <ul v-else class="rk-bars">
            <li v-for="row in distribution.list" :key="row.categoryName">
              <span class="rk-bar-label">{{ row.categoryName }}</span>
              <span class="rk-bar-track"><i :style="{ width: Math.max(row.ratio * 100, 2) + '%' }"></i></span>
              <span class="rk-bar-value">{{ row.count }} 条 · {{ Math.round(row.ratio * 100) }}%</span>
            </li>
          </ul>
        </section>

        <section v-else-if="analysisTab === '名次变动'" class="rk-analysis">
          <h2>名次变动<span>{{ changeResult.compareDate ? `对照 ${changeResult.compareDate}` : '暂无对照快照' }}</span></h2>
          <p v-if="!changeResult.compareDate" class="rk-empty">攒两天快照后，这里会告诉你是谁在涨、谁在跌。</p>
          <table v-else class="rk-table rk-table-compact">
            <thead><tr><th>书名</th><th>当前名次</th><th>名次变动</th><th>指标</th></tr></thead>
            <tbody>
              <tr v-for="row in changeResult.list" :key="row.bookId || row.bookTitle">
                <td>{{ row.bookTitle }}</td>
                <td class="rk-rank">{{ row.rankNo }}</td>
                <td class="rk-delta" :class="deltaTone(row.rankChange)">{{ deltaText(row.rankChange) }}</td>
                <td class="rk-metric">{{ row.metricText || formatMetric(row.metricValue) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-else-if="analysisTab === '标签风向'" class="rk-analysis">
          <h2>标签风向<span>近 {{ tagTrend.days }} 天 · 按天计数</span></h2>
          <p v-if="!tagTrend.list.length" class="rk-empty">多抓几天，这里会长出分类热度的趋势线。</p>
          <table v-else class="rk-table rk-table-compact">
            <thead>
              <tr><th>标签</th><th v-for="date in tagTrend.seriesDates" :key="date">{{ date.slice(5) }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in tagTrend.list" :key="row.tag">
                <td>{{ row.tag }}</td>
                <td v-for="point in row.series" :key="point.date" :class="{ zero: !point.count }">{{ point.count || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-else-if="analysisTab === '竞品跟踪'" class="rk-analysis">
          <h2>竞品跟踪<span>填书名右侧链接里的 book id，逗号分隔</span></h2>
          <div class="rk-fields">
            <label class="rk-field">竞品 ID
              <input v-model="rivalIds" type="text" placeholder="例如 740123456,740987654" />
            </label>
            <label>天数
              <select v-model.number="rivalDays">
                <option :value="7">7 天</option>
                <option :value="14">14 天</option>
                <option :value="30">30 天</option>
              </select>
            </label>
            <button class="secondary" type="button" :disabled="!rivalIds.trim()" @click="runRival">看曲线</button>
          </div>
          <p v-if="!rivalResult.list.length" class="rk-empty">填好 ID 点「看曲线」，每天的名次和指标会连成一条线。</p>
          <table v-else class="rk-table rk-table-compact">
            <thead>
              <tr><th>竞品</th><th v-for="date in rivalResult.seriesDates" :key="date">{{ date.slice(5) }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in rivalResult.list" :key="row.bookId">
                <td>{{ row.bookTitle }}</td>
                <td v-for="point in row.series" :key="point.date" :class="{ zero: point.rankNo == null }">
                  {{ point.rankNo == null ? '—' : `第${point.rankNo}名` }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-else class="rk-analysis">
          <h2>作者趋势<span>看某位作者每天有几本在榜、热度多少</span></h2>
          <div class="rk-fields">
            <label class="rk-field">作者名
              <input v-model="authorName" type="text" placeholder="与榜单显示的作者名一致" />
            </label>
            <label>天数
              <select v-model.number="authorDays">
                <option :value="7">7 天</option>
                <option :value="14">14 天</option>
                <option :value="30">30 天</option>
              </select>
            </label>
            <button class="secondary" type="button" :disabled="!authorName.trim()" @click="runAuthor">看趋势</button>
          </div>
          <p v-if="!authorResult.list.length" class="rk-empty">填好作者名点「看趋势」。</p>
          <table v-else class="rk-table rk-table-compact">
            <thead><tr><th>日期</th><th>在榜书本</th><th>热度合计</th><th>热度均值</th></tr></thead>
            <tbody>
              <tr v-for="row in authorResult.list" :key="row.date">
                <td>{{ row.date }}</td>
                <td :class="{ zero: !row.bookCount }">{{ row.bookCount || '—' }}</td>
                <td class="rk-metric">{{ row.metricSum ? formatMetric(row.metricSum) : '—' }}</td>
                <td class="rk-metric">{{ row.metricAvg ? formatMetric(row.metricAvg) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="rk-ai">
          <div class="rk-ai-head">
            <div><small>AI READ</small><h2>AI 榜单解读</h2></div>
            <button class="primary" type="button" :disabled="aiBusy" @click="runReport">{{ aiBusy ? '解读中…' : '让 AI 读这份榜' }}</button>
          </div>
          <p class="rk-hint">按当前快照的头部条目、名次变动和分类分布生成三段式解读，只讲数据里有的东西；没有对照数据时会如实说明。</p>
          <p v-if="aiError" class="rk-error" role="alert">{{ aiError }}</p>
          <div v-if="aiText" class="rk-ai-body">
            <p v-for="(para, index) in aiParagraphs" :key="index">{{ para }}</p>
          </div>
        </section>
      </template>

      <section v-else class="rk-panel rk-first">
        <small>NO SNAPSHOT</small>
        <h2>这个榜单还没有快照</h2>
        <p>点「重抓今日」在线抓一份，或把手里的榜单页 HTML / 接口 JSON 粘进来。有了第一份，第二天再抓就能看名次变动了。</p>
        <div class="rk-actions">
          <button class="primary" type="button" :disabled="crawling" @click="crawl">{{ crawling ? '抓取中…' : '重抓今日' }}</button>
          <button class="secondary" type="button" @click="openPaste">手动导入</button>
        </div>
      </section>
    </template>

    <!-- 手动导入弹窗 -->
    <div v-if="showPaste" class="rk-modal" @click.self="showPaste = false">
      <div class="rk-modal-card" role="dialog" aria-modal="true" aria-label="手动导入榜单数据">
        <h2>手动导入{{ pasteLabel }}</h2>
        <p class="rk-hint">番茄：打开榜单页 → 右键「查看源代码」→ 全选复制，粘贴到下面。七猫：粘贴榜单接口返回的 JSON。</p>
        <textarea v-model="pasteText" rows="12" placeholder="把榜单页 HTML 或接口 JSON 粘贴到这里"></textarea>
        <p v-if="pasteError" class="rk-error" role="alert">{{ pasteError }}</p>
        <div class="rk-modal-actions">
          <button class="secondary" type="button" @click="showPaste = false">取消</button>
          <button class="primary" type="button" :disabled="!pasteText.trim()" @click="submitPaste">导入为今日快照</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ModelSettings } from './storage'
import { requestChatCompletion } from './ai'
import {
  RANK_ORIGIN_LABEL,
  RANK_TYPE_LABEL,
  crawlRankSnapshot,
  exportRankCsv,
  exportRankStore,
  findRankSource,
  importRankPaste,
  importRankStore,
  listRankSnapshotDates,
  loadRankStore,
  rankAuthorTrend,
  rankChange,
  rankCompetitor,
  rankLatest,
  rankReportPrompt,
  rankSnapshotDistribution,
  rankSourceLabel,
  rankSourcesFor,
  rankTagTrends,
  readRankSnapshot,
  removeRankSnapshot,
  saveRankStore,
  toSourceOption,
  writeRankSnapshot,
  type RankAuthorTrend,
  type RankChangeResult,
  type RankCompetitorResult,
  type RankItem,
  type RankSnapshotDoc,
  type RankSnapshotOrigin,
  type RankSource,
  type RankTagTrend,
} from './rank'

const props = defineProps<{ model: ModelSettings; dataEpoch?: number }>()

const store = ref(loadRankStore())
const persist = () => saveRankStore(store.value)

/** 备份恢复后重新读盘：本地存储已被 App 改写，内存里的旧快照要作废 */
watch(() => props.dataEpoch, () => {
  store.value = loadRankStore()
  detailSourceId.value = null
})

const platform = ref<'fanqie' | 'qimao'>('fanqie')
const rankType = ref('')
const gender = ref('')
/** 左侧面板里选中的榜单源，抓取和手动导入都作用在它身上 */
const activeSourceId = ref<number | null>(null)
/** 正在看的榜单详情；为空时停留在榜单列表页 */
const detailSourceId = ref<number | null>(null)
const statDate = ref('')
const compareDate = ref('')
const keyword = ref('')
const analysisTab = ref('分类分布')
const crawling = ref(false)
const crawlError = ref('')
const notice = ref('')

const showPaste = ref(false)
const pasteText = ref('')
const pasteError = ref('')

const rivalIds = ref('')
const rivalDays = ref(14)
const rivalResult = ref<{ list: RankCompetitorResult['list']; seriesDates: string[] }>({ list: [], seriesDates: [] })
const authorName = ref('')
const authorDays = ref(14)
const authorResult = ref<RankAuthorTrend>({ startDate: '', endDate: '', days: 0, list: [] })

const aiBusy = ref(false)
const aiError = ref('')
const aiText = ref('')
const archiveInput = ref<HTMLInputElement>()

const platforms = computed(() => [
  { code: 'fanqie' as const, name: '番茄小说' },
  { code: 'qimao' as const, name: '七猫小说' },
])

const sources = computed<RankSource[]>(() =>
  rankSourcesFor(platform.value, {
    rankType: rankType.value || undefined,
    gender: gender.value || undefined,
  }).map(toSourceOption)
)

const rankTypeOptions = computed(() => [...new Set(sources.value.map(item => item.rankType))])

/** 列表变化时兜底选中第一项：否则下拉看着有值、模型却是空的，抓取和导入会一直是禁用态 */
watch(
  sources,
  list => {
    if (!list.length) {
      activeSourceId.value = null
      return
    }
    if (activeSourceId.value == null || !list.some(item => item.id === activeSourceId.value)) activeSourceId.value = list[0].id
  },
  { immediate: true }
)

const activeSource = computed<RankSource | null>(() => {
  if (activeSourceId.value == null) return null
  const seeded = findRankSource(activeSourceId.value)
  return seeded ? toSourceOption(seeded) : null
})

const detailSource = computed<RankSource | null>(() => {
  if (detailSourceId.value == null) return null
  const seeded = findRankSource(detailSourceId.value)
  return seeded ? toSourceOption(seeded) : null
})

/** 抓取/导入落在哪个榜单上：详情页里就是当前看的这个，列表页里就是面板选中的那个 */
const currentSourceId = computed(() => detailSourceId.value ?? activeSourceId.value)

const analysisTabs = ['分类分布', '名次变动', '标签风向', '竞品跟踪', '作者趋势']

const dates = computed(() => (detailSourceId.value == null ? [] : listRankSnapshotDates(store.value, detailSourceId.value)))

const latest = computed(() => {
  if (detailSourceId.value == null) return null
  return rankLatest(
    {
      sourceId: detailSourceId.value,
      statDate: statDate.value || undefined,
      compareDate: compareDate.value || undefined,
      keyword: keyword.value || undefined,
      page: 1,
      size: 100,
    },
    store.value
  )
})

const activeDoc = computed<RankSnapshotDoc | null>(() => {
  if (detailSourceId.value == null || !latest.value?.snapshot) return null
  return readRankSnapshot(store.value, detailSourceId.value, latest.value.snapshot.statDate)
})

const distribution = computed(() => rankSnapshotDistribution(activeDoc.value))

/** 标签风向跟随当前榜单的平台与类型，避免在番茄详情里算出七猫的趋势 */
const trendSite = computed(() => (detailSource.value || activeSource.value)?.siteCode || platform.value)
const trendRankType = computed(() => (detailSource.value || activeSource.value)?.rankType || '')

const changeResult = computed<RankChangeResult>(() => {
  if (detailSourceId.value == null) return { statDate: null, compareDate: null, list: [] }
  return rankChange(
    { sourceId: detailSourceId.value, statDate: statDate.value || undefined, compareDate: compareDate.value || undefined },
    store.value
  )
})

const tagTrend = computed<RankTagTrend & { seriesDates: string[] }>(() => {
  const result = rankTagTrends(
    { siteCode: trendSite.value, rankType: trendRankType.value || undefined, gender: gender.value || undefined, days: 7 },
    store.value
  )
  return { ...result, seriesDates: result.list[0]?.series.map(point => point.date) || [] }
})

interface SourceCard {
  id: number
  label: string
  dates: string[]
  newestDate: string
  itemCount: number
  origin: RankSnapshotOrigin
}

const sourceCards = computed<SourceCard[]>(() => {
  const map = new Map<number, SourceCard>()
  for (const doc of store.value.snapshots) {
    const card = map.get(doc.sourceId) || {
      id: doc.sourceId,
      label: labelOf(doc.sourceId),
      dates: [],
      newestDate: '',
      itemCount: 0,
      origin: doc.origin,
    }
    card.dates.push(doc.statDate)
    if (doc.statDate >= card.newestDate) {
      card.newestDate = doc.statDate
      card.itemCount = doc.items.length
      card.origin = doc.origin
    }
    map.set(doc.sourceId, card)
  }
  return [...map.values()].sort((a, b) => (a.newestDate < b.newestDate ? 1 : -1))
})

function labelOf(sourceId: number): string {
  const seeded = findRankSource(sourceId)
  return seeded ? rankSourceLabel(seeded) : `榜单 #${sourceId}`
}

const formatMetric = (value: number): string => {
  if (!value) return '—'
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)} 亿`
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`
  return String(value)
}

const deltaTone = (delta: number | null | undefined): string => {
  if (delta == null || delta === 0) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

const deltaText = (delta: number | null | undefined): string => {
  if (delta == null) return '无对照'
  if (delta === 0) return '持平'
  return delta > 0 ? `升 ${delta}` : `降 ${Math.abs(delta)}`
}

const safeName = (text: string): string => text.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '榜单'

const download = (payload: string, filename: string, type: string): void => {
  const url = URL.createObjectURL(new Blob([payload], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function openSource(sourceId: number): void {
  detailSourceId.value = sourceId
  statDate.value = ''
  compareDate.value = ''
  keyword.value = ''
  crawlError.value = ''
  notice.value = ''
  aiText.value = ''
  aiError.value = ''
  markRankSourceViewedLocal(sourceId)
}

function closeSource(): void {
  detailSourceId.value = null
}

function markRankSourceViewedLocal(sourceId: number): void {
  const ids = [sourceId, ...store.value.viewedSourceIds.filter(id => id !== sourceId)].slice(0, 12)
  store.value = { ...store.value, viewedSourceIds: ids }
  persist()
}

async function crawl(): Promise<void> {
  const sourceId = currentSourceId.value
  if (sourceId == null) return
  crawling.value = true
  crawlError.value = ''
  notice.value = ''
  try {
    const outcome = await crawlRankSnapshot(store.value, sourceId)
    notice.value = outcome.message
    statDate.value = outcome.statDate || ''
    detailSourceId.value = sourceId
    persist()
  } catch (error) {
    crawlError.value = error instanceof Error ? error.message : String(error)
  } finally {
    crawling.value = false
  }
}

const pasteLabel = computed(() => {
  const source = detailSource.value || activeSource.value
  return source ? rankSourceLabel(source) : '榜单'
})

function openPaste(): void {
  pasteText.value = ''
  pasteError.value = ''
  showPaste.value = true
}

function submitPaste(): void {
  const sourceId = currentSourceId.value
  if (sourceId == null) return
  pasteError.value = ''
  try {
    const outcome = importRankPaste(store.value, sourceId, pasteText.value)
    notice.value = outcome.message
    statDate.value = outcome.statDate || ''
    detailSourceId.value = sourceId
    showPaste.value = false
    pasteText.value = ''
    persist()
  } catch (error) {
    pasteError.value = error instanceof Error ? error.message : String(error)
  }
}

function removeSource(sourceId: number): void {
  const confirmed = confirm(`删除「${labelOf(sourceId)}」的全部快照？删除后趋势与分析数据一起没了。`)
  if (!confirmed) return
  store.value = {
    ...store.value,
    snapshots: store.value.snapshots.filter(doc => doc.sourceId !== sourceId),
    viewedSourceIds: store.value.viewedSourceIds.filter(id => id !== sourceId),
  }
  if (detailSourceId.value === sourceId) closeSource()
  persist()
}

function exportCsv(): void {
  const sourceId = detailSourceId.value
  if (sourceId == null) return
  try {
    const csv = exportRankCsv(
      { sourceId, statDate: statDate.value || undefined, compareDate: compareDate.value || undefined },
      store.value
    )
    download(csv, `${safeName(pasteLabel.value)}-${statDate.value || '最新'}.csv`, 'text/csv;charset=utf-8')
  } catch (error) {
    crawlError.value = error instanceof Error ? error.message : String(error)
  }
}

function exportArchive(): void {
  download(exportRankStore(store.value), `扫榜存档-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
}

async function handleArchive(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const docs = importRankStore(JSON.parse(await file.text()))
    for (const doc of docs) writeRankSnapshot(store.value, doc)
    notice.value = `已导入 ${docs.length} 份快照`
    persist()
  } catch (error) {
    crawlError.value = error instanceof Error ? error.message : String(error)
  }
}

function runRival(): void {
  const result = rankCompetitor(
    { siteCode: platform.value, bookIds: rivalIds.value, days: rivalDays.value },
    store.value
  )
  rivalResult.value = { list: result.list, seriesDates: result.list[0]?.series.map(point => point.date) || [] }
}

function runAuthor(): void {
  authorResult.value = rankAuthorTrend(
    { siteCode: platform.value, authorName: authorName.value, days: authorDays.value },
    store.value
  )
}

const aiParagraphs = computed(() => aiText.value.split(/\n+/).map(line => line.trim()).filter(Boolean))

async function runReport(): Promise<void> {
  if (detailSourceId.value == null || !latest.value?.snapshot) return
  aiBusy.value = true
  aiError.value = ''
  try {
    const prompt = rankReportPrompt({
      sourceLabel: pasteLabel.value,
      statDate: latest.value.snapshot.statDate,
      compareDate: latest.value.compareDate,
      items: latest.value.list as RankItem[],
      distribution: distribution.value.list,
    })
    aiText.value = await requestChatCompletion({ model: props.model, system: prompt.system, user: prompt.user, signal: new AbortController().signal, maxTokens: 1200 })
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : String(error)
  } finally {
    aiBusy.value = false
  }
}
</script>

<style scoped>
.rk-page { flex: 1; min-height: 0; overflow-y: auto; padding: 26px 32px 44px; background: radial-gradient(circle at 85% 0, #e3ecf5, transparent 32%), #f4f5f8; }
.rk-hero { max-width: 880px; }
.rk-hero small { color: var(--accent); letter-spacing: 3px; font-size: 11px; }
.rk-hero h1 { margin: 6px 0 8px; font-size: 30px; }
.rk-hero p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.9; }
.rk-layout { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 22px; margin-top: 22px; align-items: start; }

.rk-panel { padding: 22px; border: 1px solid var(--line); border-radius: 18px; background: var(--paper); box-shadow: 0 8px 26px #4a3b5210; }
.rk-panel > small { color: var(--muted); letter-spacing: 2px; font-size: 10px; }
.rk-panel h2 { margin: 6px 0 12px; font-size: 19px; }
.rk-panel p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.9; }
.rk-crawl { position: sticky; top: 0; }

.rk-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.rk-tabs button { flex: 1; padding: 9px 10px; border: 1px solid var(--line); border-radius: 9px; color: var(--muted); background: #fff; font-size: 12px; font-weight: 700; }
.rk-tabs button.on { border-color: var(--accent); color: var(--accent-deep); background: #fff2f4; }
.rk-fields { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.rk-fields label, .rk-field { display: block; color: #6a5566; font-size: 12px; font-weight: 700; }
.rk-fields label { flex: 1; min-width: 120px; }
.rk-fields select, .rk-fields input, .rk-field select, .rk-field input, .rk-work-actions input, .rk-inline select { margin-top: 6px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; color: #4c3b4a; background: #fff; font-size: 12.5px; font-weight: 400; }
.rk-fields select, .rk-fields input, .rk-field select, .rk-field input { width: 100%; }
.rk-field { margin-bottom: 14px; }
.rk-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.rk-hint { margin-top: 12px; color: var(--muted); font-size: 11.5px; line-height: 1.8; }
.rk-hint code { padding: 1px 5px; border-radius: 5px; background: #f1ecf0; font-size: 11px; }
.rk-error { margin-top: 12px; padding: 10px 13px; border: 1px solid #f0b4bf; border-radius: 9px; color: #ac3857; background: #fff0f2; font-size: 12px; line-height: 1.7; }
.rk-notice { margin-top: 12px; padding: 10px 13px; border: 1px solid #bfe3cd; border-radius: 9px; color: #2f6b46; background: #f0faf4; font-size: 12px; }

.rk-list-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 14px; }
.rk-list-head small { color: var(--muted); letter-spacing: 2px; font-size: 10px; }
.rk-list-head h2 { margin: 4px 0 0; font-size: 20px; }
.rk-list-head h2 span { color: var(--accent); }
.rk-list-actions { display: flex; gap: 8px; }
.rk-card { padding: 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: #fff; }
.rk-card + .rk-card { margin-top: 10px; }
.rk-card-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.rk-card-top h3 { margin: 0; font-size: 15px; }
.rk-origin { padding: 2px 9px; border-radius: 99px; background: #eef1f6; color: #6b7484; font-size: 11px; }
.rk-origin.crawl { background: #e8f2fb; color: #2f6690; }
.rk-origin.paste { background: #fdf1e3; color: #a4671f; }
.rk-card-meta { margin: 6px 0 10px; color: var(--muted); font-size: 12px; }
.rk-card-actions { display: flex; gap: 8px; }
.rk-recent { margin-top: 18px; }
.rk-recent small { color: var(--muted); letter-spacing: 2px; font-size: 10px; }
.rk-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.rk-chip { padding: 5px 11px; border: 1px solid var(--line); border-radius: 99px; color: #6a5566; background: #fff; font-size: 11.5px; }
.rk-chip:hover { border-color: var(--accent); color: var(--accent-deep); }
.rk-empty { padding: 30px; border: 1px solid var(--line); border-radius: 14px; background: #ffffffb0; color: var(--muted); font-size: 12.5px; text-align: center; line-height: 2; }
.rk-empty span { display: block; color: var(--accent); font-size: 17px; }

.rk-work-head { margin-bottom: 18px; }
.rk-work-title { display: flex; align-items: center; gap: 14px; }
.rk-work-title small { color: var(--muted); letter-spacing: 2px; font-size: 10px; }
.rk-work-title h1 { margin: 4px 0 0; font-size: 24px; }
.rk-work-meta { margin: 10px 0 0; color: var(--muted); font-size: 12.5px; }
.rk-work-actions { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-top: 12px; }
.rk-inline { color: #6a5566; font-size: 12px; font-weight: 700; }

.rk-table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); }
.rk-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.rk-table th { padding: 11px 12px; border-bottom: 1px solid var(--line); color: var(--muted); background: #faf7f9; font-size: 11px; text-align: left; white-space: nowrap; }
.rk-table td { padding: 11px 12px; border-bottom: 1px solid #f3eef1; color: #4c3b4a; vertical-align: middle; }
.rk-table tbody tr:last-child td { border-bottom: 0; }
.rk-table tbody tr:hover { background: #fdf8fa; }
.rk-table-compact { width: auto; min-width: 100%; }
.rk-rank { color: var(--accent-deep); font-weight: 700; font-variant-numeric: tabular-nums; }
.rk-book { min-width: 190px; }
.rk-book > div { display: flex; flex-direction: column; gap: 2px; }
.rk-book img { width: 30px; height: 40px; float: left; margin-right: 9px; border-radius: 5px; object-fit: cover; background: #efe9ee; }
.rk-book a { color: #3f3242; font-weight: 700; text-decoration: none; }
.rk-book a:hover { color: var(--accent-deep); text-decoration: underline; }
.rk-book small { color: var(--muted); font-size: 11px; }
.rk-metric { font-variant-numeric: tabular-nums; white-space: nowrap; }
.rk-delta { font-weight: 700; white-space: nowrap; }
.rk-delta.up { color: #2f8a52; }
.rk-delta.down { color: #c2452f; }
.rk-delta.flat { color: var(--muted); font-weight: 400; }
.rk-last { max-width: 220px; color: var(--muted); }
.rk-more { margin: 10px 2px 0; color: var(--muted); font-size: 11.5px; }

.rk-analysis-tabs { margin: 22px 0 12px; }
.rk-analysis-tabs button { flex: none; padding: 8px 16px; }
.rk-analysis { padding: 20px 22px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.rk-analysis h2 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin: 0 0 14px; font-size: 16px; }
.rk-analysis h2 span { color: var(--muted); font-size: 11.5px; font-weight: 400; }
.rk-bars { margin: 0; padding: 0; list-style: none; }
.rk-bars li { display: grid; grid-template-columns: 130px minmax(0, 1fr) 120px; align-items: center; gap: 12px; padding: 7px 0; }
.rk-bar-label { color: #4c3b4a; font-size: 12.5px; }
.rk-bar-track { height: 9px; border-radius: 99px; background: #f0eaee; overflow: hidden; }
.rk-bar-track i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #ed526d, #ff9d6e); }
.rk-bar-value { color: var(--muted); font-size: 11.5px; text-align: right; font-variant-numeric: tabular-nums; }
.rk-table .zero { color: #c3b9c1; }

.rk-ai { margin-top: 22px; padding: 20px 22px; border: 1px solid var(--line); border-radius: 16px; background: linear-gradient(120deg, #fff6f8, #f7f9ff); }
.rk-ai-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.rk-ai-head small { color: var(--muted); letter-spacing: 2px; font-size: 10px; }
.rk-ai-head h2 { margin: 4px 0 0; font-size: 16px; }
.rk-ai-body { margin-top: 14px; }
.rk-ai-body p { margin: 0 0 10px; color: #4c3b4a; font-size: 13px; line-height: 1.95; }
.rk-first { margin-top: 6px; }

.rk-modal { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 24px; background: #241a2ecc; }
.rk-modal-card { width: min(620px, 100%); max-height: 86vh; overflow-y: auto; padding: 24px; border-radius: 16px; background: var(--paper); }
.rk-modal-card h2 { margin: 0 0 8px; font-size: 18px; }
.rk-modal-card textarea { width: 100%; margin-top: 6px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; color: #4c3b4a; background: #fff; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.7; resize: vertical; }
.rk-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }

@media (max-width: 1080px) {
  .rk-layout { grid-template-columns: 1fr; }
  .rk-crawl { position: static; }
}
@media (max-width: 760px) {
  .rk-page { padding: 16px 14px 32px; }
  .rk-bars li { grid-template-columns: 96px minmax(0, 1fr) 92px; }
  .rk-list-head { flex-direction: column; align-items: flex-start; }
}
</style>
