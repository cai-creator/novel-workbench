<template>
  <div class="bd-page">
    <!-- 项目列表 -->
    <template v-if="!activeProject">
      <header class="bd-hero">
        <small>BOOK BREAKDOWN · 竞品拆书</small>
        <h1>把别人的好书拆开看</h1>
        <p>导入整本 TXT，逐章拆解细纲、关键节点、爽点节奏与人物关系；前三章附带黄金三章深拆，全部拆完自动生成全书报告。</p>
      </header>
      <div class="bd-layout">
        <section class="bd-upload" :class="{ over: dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="handleDrop">
          <small>IMPORT</small>
          <h2>导入一本竞品</h2>
          <p>把 TXT 文件拖到这里，或点击选择。分卷分章按「第N章 / 第N卷」标题行识别，正文里的回指句不会误切。</p>
          <button class="primary" type="button" @click="fileInput?.click()">选择 TXT 文件</button>
          <input ref="fileInput" type="file" accept=".txt,text/plain" hidden @change="handleTxtChange" />
          <div v-if="props.initialBook" class="bd-rank-seed"><small>来自扫榜</small><strong>《{{ props.initialBook.title }}》</strong><span>{{ props.initialBook.author || '作者未知' }}</span><button class="secondary" type="button" @click="rankImportOpen = true">连接番茄下载器</button></div>
          <div class="bd-upload-actions">
            <button class="secondary" type="button" @click="jsonInput?.click()">导入拆书存档</button>
            <input ref="jsonInput" type="file" accept=".json,application/json" hidden @change="handleJsonChange" />
          </div>
          <p v-if="listError" class="bd-error" role="alert">{{ listError }}</p>
        </section>
        <section class="bd-list">
          <div class="bd-list-head">
            <div><small>YOUR PROJECTS</small><h2>拆书项目 <span>{{ store.projects.length }}</span></h2></div>
            <button v-if="store.projects.length" class="secondary" type="button" @click="exportAll">导出全部存档</button>
          </div>
          <p v-if="!store.projects.length" class="bd-empty"><span>✦</span>还没有拆书项目。导入一本同类型的畅销书，看看它每章在做什么。</p>
          <article v-for="project in store.projects" :key="project.id" class="bd-card" :class="project.status">
            <div class="bd-card-top">
              <h3>{{ project.title }}</h3>
              <span class="bd-status" :class="project.status">{{ breakdownStatusLabel[project.status] }}</span>
            </div>
            <p class="bd-card-meta">{{ project.chapterCount }} 章 · {{ project.wordCount.toLocaleString() }} 字 · 已拆 {{ doneCount(project) }} 章{{ project.characterCount ? ` · ${project.characterCount} 位角色` : '' }}</p>
            <div class="bd-progress" role="progressbar" :aria-valuenow="project.progress" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: project.progress + '%' }"></i></div>
            <div class="bd-card-actions">
              <button class="primary" type="button" @click="openProject(project.id)">打开工作台</button>
              <button class="secondary" type="button" @click="exportMarkdown(project)">导出 Markdown</button>
              <button class="secondary" type="button" @click="exportOne(project)">存档 JSON</button>
              <button class="text-danger" type="button" @click="removeProject(project.id)">删除</button>
            </div>
            <time :datetime="project.updateTime">更新于 {{ formatTime(project.updateTime) }}</time>
          </article>
        </section>
      </div>
    </template>

    <!-- 工作台 -->
    <template v-else-if="activeChapter">
      <header class="bd-work-head">
        <div class="bd-work-title">
          <button class="secondary" type="button" @click="closeProject">← 全部项目</button>
          <div><small>BREAKDOWN WORKBENCH</small><h1>{{ activeProject.title }}</h1></div>
        </div>
        <p class="bd-work-meta">{{ activeProject.chapterCount }} 章 · {{ activeProject.wordCount.toLocaleString() }} 字 · 已拆 {{ doneCount(activeProject) }} 章{{ activeProject.characterCount ? ` · ${activeProject.characterCount} 位角色` : '' }}</p>
        <div class="bd-work-actions">
          <div class="bd-work-views" role="group" aria-label="工作台视图">
            <button type="button" :class="{ active: workView === 'chapters' }" @click="workView = 'chapters'">按章拆解</button>
            <button type="button" :class="{ active: workView === 'materials' }" @click="workView = 'materials'">分类素材 {{ materialTotal }}</button>
          </div>
          <label class="bd-batch">每批<select v-model.number="batchCount" :disabled="running"><option :value="1">1 章</option><option :value="3">3 章</option><option :value="5">5 章</option><option :value="10">10 章</option></select></label>
          <button class="primary" type="button" :disabled="running || !retryable.length" @click="runBatch(retryable.slice(0, batchCount))">
            {{ running ? `拆解中 ${activeProject.progress}%` : `拆解 ${Math.min(batchCount, retryable.length)} 章` }}
          </button>
          <button v-if="running" class="secondary" type="button" @click="stopRun">停止</button>
          <button class="secondary" type="button" :disabled="running || reportBusy || !doneCount(activeProject)" @click="generateReport">{{ reportBusy ? '生成中…' : '生成全书报告' }}</button>
          <button class="secondary" type="button" @click="exportMarkdown(activeProject)">导出 Markdown</button>
        </div>
        <p v-if="workError" class="bd-error" role="alert">{{ workError }}</p>
        <div class="bd-work-progress" role="progressbar" :aria-valuenow="activeProject.progress" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: activeProject.progress + '%' }"></i></div>
      </header>

      <!-- 分类素材 -->
      <div v-if="workView === 'materials'" class="bd-materials">
        <header class="bd-materials-head">
          <div><small>MATERIAL LIBRARY</small><h2>分类素材 <span>{{ materialTotal }}</span></h2></div>
          <div class="bd-materials-head-actions">
            <button class="secondary" type="button" :disabled="!materialTotal" @click="copyMaterials(breakdownMaterialKinds)">复制全部</button>
            <button class="secondary" type="button" @click="exportMarkdown(activeProject)">导出 Markdown</button>
          </div>
        </header>
        <p class="bd-materials-note">素材按类型分开存放，随拆书存档和全量备份一起保存。到「建书」流程里，可以按类型带进对应的字段。</p>
        <p v-if="copyNotice" class="bd-materials-note bd-copy-notice" role="status">{{ copyNotice }}</p>
        <p v-if="!materialTotal" class="bd-empty"><span>◇</span>还没有可用的素材。先拆解几章，或生成全书报告。</p>
        <section v-for="kind in breakdownMaterialKinds" :key="kind" class="bd-material-group">
          <header>
            <h3>{{ breakdownMaterialLabels[kind] }}<span>{{ activeMaterials[kind].length }}</span></h3>
            <button class="secondary" type="button" :disabled="!activeMaterials[kind].length" @click="copyMaterials([kind])">复制本类</button>
          </header>
          <p v-if="!activeMaterials[kind].length" class="bd-material-empty">这一类还没有素材。</p>
          <ul v-else>
            <li v-for="(item, index) in activeMaterials[kind]" :key="`${kind}-${index}`">
              <strong v-if="item.label">{{ item.label }}</strong>
              <span>{{ item.text }}</span>
              <small :title="item.chapterTitle">{{ item.chapterSortNo ? `第${item.chapterSortNo}章` : '全书报告' }}</small>
            </li>
          </ul>
        </section>
      </div>

      <div v-else class="bd-work-grid">
        <nav class="bd-chapters" aria-label="章节列表">
          <button
            v-for="chapter in activeProject.chapters"
            :key="chapter.id"
            type="button"
            class="bd-chapter"
            :class="[{ active: chapter.id === activeChapter.id }, chapter.status]"
            @click="selectedChapterId = chapter.id"
          >
            <i class="dot" :class="chapter.status"></i>
            <span class="bd-chapter-title">{{ chapter.sortNo }}. {{ chapter.title }}</span>
            <small>{{ chapter.wordCount }} 字</small>
          </button>
        </nav>

        <section class="bd-reader">
          <header class="bd-reader-head">
            <div><h2>{{ activeChapter.title }}</h2><small>第 {{ activeChapter.sortNo }} 章 · {{ activeChapter.paragraphs.length }} 段{{ activeInsightId !== null ? ` · 高亮节点 ${activeInsightId}` : '' }}</small></div>
            <button v-if="!running && activeChapter.status !== 'done'" class="secondary" type="button" @click="runBatch([activeChapter])">拆解本章</button>
          </header>
          <div class="bd-reader-body">
            <p
              v-for="(paragraph, index) in activeChapter.paragraphs"
              :key="index"
              class="bd-paragraph"
              :class="{ highlight: activeInsightId !== null && activeChapter.insightIds[index] === activeInsightId }"
              @click="toggleInsight(activeChapter.insightIds[index])"
            >{{ paragraph }}</p>
          </div>
          <p v-if="activeChapter.status === 'failed'" class="bd-error" role="alert">{{ activeChapter.errorMessage || '拆解失败，请重试' }}</p>
        </section>

        <aside class="bd-insight">
          <header class="bd-insight-head">
            <strong>解析面板</strong>
            <small v-if="activeChapter.analysis">节点 {{ activeChapter.analysis.outline.length }} · 细纲已生成</small>
            <small v-else>尚未拆解</small>
          </header>
          <div v-if="!activeChapter.analysis" class="bd-insight-empty">
            <p>点击「拆解本章」或上方批量拆解，AI 会把本章拆成可学习的结构。</p>
          </div>
          <template v-else>
            <section v-if="activeChapter.analysis.golden" class="bd-golden">
              <h3>♛ 黄金三章深拆</h3>
              <dl>
                <div v-if="activeChapter.analysis.golden.hook300"><dt>前300字钩子</dt><dd>{{ activeChapter.analysis.golden.hook300 }}</dd></div>
                <div v-if="activeChapter.analysis.golden.characterEstablish"><dt>人设立住判定</dt><dd>{{ activeChapter.analysis.golden.characterEstablish }}</dd></div>
                <div v-if="activeChapter.analysis.golden.coreDilemma"><dt>核心困境</dt><dd>{{ activeChapter.analysis.golden.coreDilemma }}</dd></div>
                <div v-for="(anchor, index) in activeChapter.analysis.golden.anchors" :key="index">
                  <dt>原文锚点</dt>
                  <dd>「{{ anchor.quote }}」—— {{ anchor.comment }}</dd>
                </div>
              </dl>
            </section>
            <section v-if="activeChapter.analysis.summary" class="bd-summary">
              <h3>剧情细纲</h3>
              <p>{{ activeChapter.analysis.summary }}</p>
            </section>
            <section v-if="activeChapter.analysis.outline.length">
              <h3>关键节点拆解</h3>
              <button
                v-for="node in activeChapter.analysis.outline"
                :key="node.id"
                type="button"
                class="bd-node"
                :class="{ active: node.id === activeInsightId }"
                @click="activeInsightId = activeInsightId === node.id ? null : node.id"
              >
                <span class="bd-node-head"><strong>{{ node.title }}</strong><small>{{ node.range }}</small></span>
                <span class="bd-node-text">{{ node.text }}</span>
                <span v-if="node.tags.length" class="bd-node-tags"><em v-for="tag in node.tags" :key="tag.text" :class="tag.tone">{{ tag.text }}</em></span>
              </button>
            </section>
            <section v-if="activeChapter.analysis.rhythm.length">
              <h3>爽点节奏</h3>
              <dl class="bd-dims">
                <div v-for="(item, index) in activeChapter.analysis.rhythm" :key="index"><dt>{{ item.label }}<em v-if="item.value">·{{ item.value }}</em></dt><dd>{{ item.desc }}</dd></div>
              </dl>
            </section>
            <section v-if="activeChapter.analysis.setting.length">
              <h3>世界观设定</h3>
              <dl class="bd-dims">
                <div v-for="(item, index) in activeChapter.analysis.setting" :key="index"><dt>{{ item.name }}<em v-if="item.type">·{{ item.type }}</em></dt><dd>{{ item.desc }}<span v-for="tag in item.tags" :key="tag" class="bd-tag">{{ tag }}</span></dd></div>
              </dl>
            </section>
            <section v-if="activeChapter.analysis.relations.length">
              <h3>人物关系</h3>
              <dl class="bd-dims">
                <div v-for="(item, index) in activeChapter.analysis.relations" :key="index"><dt>{{ item.from }} → {{ item.to }}<em>{{ item.relation }}</em></dt><dd>{{ item.desc }}</dd></div>
              </dl>
            </section>
          </template>
        </aside>
      </div>
    </template>

    <p v-else class="bd-empty"><span>◇</span>这个拆书项目没有可显示的章节。</p>

    <!-- 全书报告 -->
    <div v-if="showReport && activeProject?.report" class="overlay" @click.self="showReport = false">
      <section class="modal bd-report" role="dialog" aria-modal="true" aria-label="全书拆书报告">
        <div class="modal-head"><div><small>BOOK REPORT</small><h2>《{{ activeProject.title }}》全书报告</h2></div><button class="icon-button" aria-label="关闭" @click="showReport = false">×</button></div>
        <p class="modal-note">基于已拆解的 {{ doneCount(activeProject) }} 章产物聚合。报告随拆书存档一起保存。</p>
        <div class="bd-report-body">
          <section v-if="activeProject.report.editorNotes"><h3>编辑手记</h3><p>{{ activeProject.report.editorNotes }}</p></section>
          <section v-if="activeProject.report.outlineRecovery.length"><h3>大纲反推</h3><ul><li v-for="(item, index) in activeProject.report.outlineRecovery" :key="index"><strong>{{ item.stage }}</strong>（{{ item.chapters }}）目标：{{ item.goal }}<span v-if="item.payoff">；兑现：{{ item.payoff }}</span></li></ul></section>
          <section v-if="activeProject.report.characterArcs.length"><h3>人物弧线</h3><ul><li v-for="(item, index) in activeProject.report.characterArcs" :key="index"><strong>{{ item.name }}</strong>：{{ item.arc }}</li></ul></section>
          <section v-if="activeProject.report.foreshadowLedger.length"><h3>伏笔账本</h3><ul><li v-for="(item, index) in activeProject.report.foreshadowLedger" :key="index">第{{ item.plantChapter }}章埋设{{ item.status === 'recovered' ? ` → 第${item.payoffChapter}章回收` : '（未回收）' }}：{{ item.item }}</li></ul></section>
          <section v-if="activeProject.report.pacingCurve.length"><h3>爽点曲线</h3><ul class="bd-pacing"><li v-for="(item, index) in activeProject.report.pacingCurve" :key="index">第{{ item.chapterNo }}章<em>{{ item.score }} 分</em>{{ item.label }}</li></ul></section>
          <section v-if="activeProject.report.reusableTechniques.length"><h3>可复用技巧</h3><ol><li v-for="(item, index) in activeProject.report.reusableTechniques" :key="index">{{ item }}</li></ol></section>
        </div>
        <div class="modal-actions"><button class="secondary" @click="exportMarkdown(activeProject)">导出 Markdown</button><button class="primary" @click="showReport = false">完成</button></div>
      </section>
    </div>
    <div v-if="rankImportOpen" class="overlay" @click.self="rankImportOpen = false">
      <section class="modal preview-modal" role="dialog" aria-modal="true" aria-label="从榜单书籍创建拆书项目">
        <div class="modal-head"><div><small>RANK → BREAKDOWN</small><h2>从榜单书籍创建拆书项目</h2></div><button class="icon-button" aria-label="关闭" @click="rankImportOpen = false">×</button></div>
        <p class="modal-note">当前选中：{{ props.initialBook?.title }}。工作台通过本机运行的 Tomato-Novel-Downloader Web API 预览书籍并创建下载任务，不解析网页。下载完成后，在番茄下载器的文件库中下载 TXT，再回到这里导入。</p>
        <div class="tomato-settings-grid">
          <label>番茄下载器地址<input v-model="tomatoSettings.baseUrl" type="url" placeholder="http://127.0.0.1:18423" /></label>
          <label>访问密码（可选）<input v-model="tomatoSettings.password" type="password" autocomplete="off" placeholder="未设置可留空" /></label>
        </div>
        <div class="tomato-actions"><button class="secondary" :disabled="tomatoChecking" @click="checkTomato">{{ tomatoChecking ? '连接中…' : '检查连接' }}</button><span v-if="tomatoStatus" :class="tomatoConnected ? 'tomato-ok' : 'tomato-bad'">{{ tomatoStatus }}</span></div>
        <section v-if="tomatoPreview" class="tomato-preview">
          <strong>《{{ tomatoPreview.title || props.initialBook?.title }}》</strong><span>{{ tomatoPreview.author || props.initialBook?.author || '作者未知' }} · {{ tomatoPreview.chapterCount || '未知' }} 章</span>
          <p v-if="tomatoPreview.description">{{ tomatoPreview.description }}</p>
        </section>
        <div class="tomato-range"><label>起始章节（可选）<input v-model.number="tomatoRangeStart" type="number" min="1" :max="tomatoPreview?.chapterCount || undefined" placeholder="1" /></label><label>结束章节（可选）<input v-model.number="tomatoRangeEnd" type="number" min="1" :max="tomatoPreview?.chapterCount || undefined" placeholder="全书" /></label></div>
        <div v-if="tomatoJob" class="tomato-job" role="status"><div><strong>下载任务 #{{ tomatoJob.id }}</strong><span>{{ tomatoStateLabel(tomatoJob.state) }}</span></div><div class="tomato-progress"><i :style="{ width: `${tomatoJob.progress.percent}%` }"></i></div><small>{{ tomatoJob.progress.total ? `${tomatoJob.progress.current}/${tomatoJob.progress.total} 章` : (tomatoJob.message || '等待下载器响应') }}</small></div>
        <div v-if="tomatoDownloads.length" class="tomato-downloads"><strong>可导入文件</strong><a v-for="item in tomatoDownloads" :key="item.relPath" :href="tomatoDownloadUrl(tomatoSettings, item.relPath)" target="_blank" rel="noreferrer">下载 {{ item.name }}</a></div>
        <label>项目名称<input v-model="rankImportTitle" maxlength="120" /></label>
        <p v-if="rankImportError" class="workflow-error" role="alert">{{ rankImportError }}</p>
        <div class="modal-actions"><button class="secondary" @click="rankImportOpen = false">关闭</button><button class="primary" :disabled="rankImporting || !props.initialBook?.bookId" @click="createTomatoDownload">{{ rankImporting ? '创建中…' : tomatoJob ? '重新创建下载任务' : '预览并创建下载任务' }}</button></div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ModelSettings } from './storage'
import { requestChatCompletion } from './ai'
import {
  BREAKDOWN_PROMPT_PARAGRAPH_LIMIT,
  GOLDEN_CHAPTER_LIMIT,
  bookReportPrompt,
  breakdownMaterialKinds,
  breakdownMaterialLabels,
  breakdownStatusLabel,
  buildBreakdownMarkdown,
  chapterBreakdownPrompt,
  countBreakdownMaterials,
  createBreakdownProject,
  exportBreakdownStore,
  extractJsonObject,
  emptyStore,
  formatBreakdownMaterials,
  importBreakdownStore,
  loadBreakdownStoreCached,
  mergeCharacterNames,
  normalizeChapterAnalysis,
  normalizeReport,
  parseTxtBook,
  recalcBreakdownProject,
  retryableBreakdownChapters,
  saveBreakdownStore,
  type BreakdownChapter,
  type BreakdownMaterialKind,
  type BreakdownMaterials,
  type BreakdownProject,
} from './breakdown'
import { designSideStores } from './design-fixture'
import {
  checkTomatoService,
  createTomatoJob,
  getTomatoJob,
  listTomatoLibrary,
  loadTomatoJobSnapshot,
  loadTomatoSettings,
  previewTomatoBook,
  saveTomatoJobSnapshot,
  saveTomatoSettings,
  tomatoDownloadUrl,
  type TomatoBookPreview,
  type TomatoJob,
  type TomatoLibraryItem,
  type TomatoSettings,
} from './tomato'

interface RankBookSeed { title: string; author: string; url: string; bookId: string | null }
const props = defineProps<{ model: ModelSettings; dataEpoch?: number; initialBook?: RankBookSeed | null }>()
const emit = defineEmits<{ (event: 'clear-handoff'): void }>()

const designPreview = import.meta.env.DEV && new URLSearchParams(location.search).has('ui-preview')
// 设计预览下不读不写真实 localStorage，避免预览操作污染本机数据
const store = ref(designPreview ? designSideStores().breakdown : loadBreakdownStoreCached())
/** 统一落盘：配额等写失败由 quota 模块广播告警，这里再落到页面错误区，不再让异常乱飞 */
const persist = (): boolean => {
  if (designPreview) return true
  try {
    saveBreakdownStore(store.value)
    return true
  } catch (error) {
    listError.value = error instanceof Error ? error.message : String(error)
    return false
  }
}

/** 备份恢复后重新读盘：本地存储已被 App 改写，内存里的旧项目要作废 */
watch(() => props.dataEpoch, () => {
  store.value = loadBreakdownStoreCached()
  if (!store.value.projects.some(item => item.id === activeId.value)) activeId.value = store.value.projects[0]?.id || null
})

const activeId = ref<string | null>(null)
const activeProject = computed<BreakdownProject | null>(() => store.value.projects.find(item => item.id === activeId.value) || null)
const selectedChapterId = ref('')
const activeChapter = computed<BreakdownChapter | null>(() => {
  const project = activeProject.value
  if (!project) return null
  return project.chapters.find(item => item.id === selectedChapterId.value) || project.chapters[0] || null
})
const retryable = computed(() => (activeProject.value ? retryableBreakdownChapters(activeProject.value) : []))
const activeInsightId = ref<number | null>(null)

/** 工作台两种看法：按章读拆解结果，或按类型看汇总出来的素材。 */
const workView = ref<'chapters' | 'materials'>('chapters')
const activeMaterials = computed<BreakdownMaterials>(() => activeProject.value?.materials ?? { character: [], rhythm: [], setting: [], outline: [], technique: [] })
const materialTotal = computed(() => countBreakdownMaterials(activeMaterials.value))

const dragging = ref(false)
const listError = ref('')
const workError = ref('')
const running = ref(false)
const reportBusy = ref(false)
const showReport = ref(false)
const batchCount = ref(3)
const controller = ref<AbortController | null>(null)
const fileInput = ref<HTMLInputElement>()
const jsonInput = ref<HTMLInputElement>()
const rankImportOpen = ref(false)
const rankImporting = ref(false)
const rankImportTitle = ref('')
const rankImportError = ref('')
const tomatoSettings = ref<TomatoSettings>(loadTomatoSettings())
const tomatoChecking = ref(false)
const tomatoConnected = ref(false)
const tomatoStatus = ref('')
const tomatoPreview = ref<TomatoBookPreview | null>(null)
const tomatoJob = ref<TomatoJob | null>(null)
const tomatoDownloads = ref<TomatoLibraryItem[]>([])
const tomatoRangeStart = ref<number | undefined>()
const tomatoRangeEnd = ref<number | undefined>()
let tomatoPollTimer: number | null = null

watch(() => props.initialBook, value => {
  if (!value) return
  rankImportTitle.value = value.title
  rankImportError.value = ''
  tomatoPreview.value = null
  tomatoJob.value = null
  tomatoDownloads.value = []
  tomatoRangeStart.value = undefined
  tomatoRangeEnd.value = undefined
  const savedJob = value.bookId ? loadTomatoJobSnapshot(value.bookId) : null
  if (savedJob) {
    tomatoJob.value = savedJob
    if (!['Done', 'Failed', 'Canceled'].includes(savedJob.state)) void pollTomatoJob(savedJob.id)
  }
  rankImportOpen.value = true
}, { immediate: true })

const doneCount = (project: BreakdownProject) => project.chapters.filter(item => item.status === 'done').length

/** 点击段落或节点卡：同一节点再点一次取消高亮。 */
function toggleInsight(id: number | null | undefined) {
  if (id == null) return
  activeInsightId.value = activeInsightId.value === id ? null : id
}

const formatTime = (value: string) => {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : value
}

const download = (payload: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([payload], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

const safeName = (title: string) => title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '拆书'

const copyNotice = ref('')

/** 复制某一类或全部素材：浏览器不给剪贴板权限时退回选中复制。 */
async function copyMaterials(kinds: BreakdownMaterialKind[]) {
  const project = activeProject.value
  if (!project) return
  const text = formatBreakdownMaterials(project, kinds)
  if (!text) { copyNotice.value = '这一类还没有素材可复制。'; return }
  try {
    await navigator.clipboard.writeText(text)
    copyNotice.value = `已复制 ${kinds.map(kind => breakdownMaterialLabels[kind]).join('、')}素材`
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const okCopy = document.execCommand('copy')
    document.body.removeChild(area)
    copyNotice.value = okCopy ? `已复制 ${kinds.map(kind => breakdownMaterialLabels[kind]).join('、')}素材` : '复制失败，请手动选中文本复制'
  }
}

// ---------------------------------------------------------------------------
// 项目列表
// ---------------------------------------------------------------------------

async function readTxtText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let encoding: string | null = null
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = 'utf-8'
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le'
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be'
  try {
    if (encoding) return new TextDecoder(encoding, { fatal: true }).decode(bytes)
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return new TextDecoder('gb18030', { fatal: true }).decode(bytes)
    }
  } catch {
    throw new Error('无法正确读取 TXT 编码（已依次尝试 UTF-8 与 GB18030，文件可能损坏或使用其他编码）。请将原文件另存为 UTF-8 后重新导入')
  }
}

async function importTxt(file: File) {
  listError.value = ''
  if (file.size > 10 * 1024 * 1024) { listError.value = 'TXT 文件超过 10MB，暂不支持导入。请先分卷处理。'; return }
  try {
    const text = await readTxtText(file)
    if (!text.trim()) throw new Error('文件是空的，没有可拆解的内容')
    const title = file.name.replace(/\.[^.]+$/, '').trim() || '导入拆书'
    const parsed = parseTxtBook(text, title)
    const project = createBreakdownProject(parsed)
    const merged = [project, ...store.value.projects].slice(0, 30)
    const dropped = store.value.projects.length + 1 - merged.length
    store.value = { ...store.value, projects: merged }
    let hint = ''
    if (parsed.chapters.length > project.chapters.length) hint = `章节较多，已截断至前 ${project.chapters.length} 章。`
    if (dropped > 0) hint += `因拆书库最多保留 30 个项目，已丢弃最旧的 ${dropped} 个项目。`
    if (hint) { listError.value = hint; workError.value = hint }
    // 落盘失败时留在列表页：错误区能显示原因，也不装作导入成功
    if (!persist()) return
    openProject(project.id)
  } catch (error) {
    listError.value = error instanceof Error ? error.message : String(error)
  }
}

function tomatoStateLabel(state: string) {
  const labels: Record<string, string> = { Queued: '排队中', Running: '下载中', Done: '已完成', Failed: '失败', Canceled: '已取消' }
  return labels[state] || state
}

async function checkTomato() {
  tomatoChecking.value = true
  tomatoStatus.value = ''
  try {
    saveTomatoSettings(tomatoSettings.value)
    await checkTomatoService(tomatoSettings.value)
    tomatoConnected.value = true
    tomatoStatus.value = '已连接本机番茄下载器'
    if (props.initialBook?.bookId) tomatoPreview.value = await previewTomatoBook(tomatoSettings.value, props.initialBook.bookId)
  } catch (error) {
    tomatoConnected.value = false
    tomatoStatus.value = error instanceof Error ? error.message : String(error)
  } finally {
    tomatoChecking.value = false
  }
}

function stopTomatoPolling() {
  if (tomatoPollTimer !== null) window.clearTimeout(tomatoPollTimer)
  tomatoPollTimer = null
}

async function pollTomatoJob(id: number) {
  stopTomatoPolling()
  let retryCount = 0
  const poll = async (): Promise<void> => {
    try {
      const job = await getTomatoJob(tomatoSettings.value, id)
      if (!job) throw new Error('番茄下载器没有返回这个任务，可能已清理任务记录。')
      retryCount = 0
      tomatoConnected.value = true
      tomatoJob.value = job
      saveTomatoJobSnapshot(job)
      if (job.state === 'Done') {
        tomatoStatus.value = '下载完成，请下载 TXT 后导入拆书'
        tomatoDownloads.value = (await listTomatoLibrary(tomatoSettings.value)).filter(item => item.kind === 'file' && item.ext === 'txt').sort((a, b) => (b.modifiedMs || 0) - (a.modifiedMs || 0)).slice(0, 8)
        return
      }
      if (['Failed', 'Canceled'].includes(job.state)) return
      tomatoStatus.value = `番茄下载器${tomatoStateLabel(job.state)}，正在同步进度`
      tomatoPollTimer = window.setTimeout(() => void poll(), 1800)
    } catch (error) {
      retryCount += 1
      tomatoConnected.value = false
      if (retryCount <= 6) {
        tomatoStatus.value = `番茄下载器连接中断，正在重试（${retryCount}/6）`
        tomatoPollTimer = window.setTimeout(() => void poll(), Math.min(7000, 900 * retryCount))
      } else {
        tomatoStatus.value = '番茄下载器暂时无法连接，请确认服务仍在运行后点击检查连接'
        rankImportError.value = error instanceof Error ? error.message : String(error)
      }
    }
  }
  await poll()
}

async function createTomatoDownload() {
  const bookId = props.initialBook?.bookId
  if (rankImporting.value || !bookId) return
  rankImporting.value = true
  rankImportError.value = ''
  try {
    saveTomatoSettings(tomatoSettings.value)
    tomatoPreview.value = await previewTomatoBook(tomatoSettings.value, bookId)
    const created = await createTomatoJob(tomatoSettings.value, bookId, tomatoRangeStart.value, tomatoRangeEnd.value)
    tomatoJob.value = { id: created.id, bookId: created.bookId, title: tomatoPreview.value.title, author: tomatoPreview.value.author, state: created.state, message: '', progress: { current: 0, total: tomatoPreview.value.chapterCount, percent: 0 }, updatedMs: Date.now() }
    saveTomatoJobSnapshot(tomatoJob.value)
    tomatoStatus.value = '任务已提交，番茄下载器正在处理'
    await pollTomatoJob(created.id)
  } catch (error) { rankImportError.value = error instanceof Error ? error.message : String(error) }
  finally { rankImporting.value = false }
}

function handleTxtChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void importTxt(file)
  ;(event.target as HTMLInputElement).value = ''
}

function handleDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  // accept 属性只约束文件选择器，拖拽入口要自己验类型
  if (!/\.(txt|text|md)$/i.test(file.name) && file.type !== 'text/plain') { listError.value = '只支持拖入 TXT 文本文件。'; return }
  void importTxt(file)
}

function handleJsonChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  listError.value = ''
  if (file.size > 20 * 1024 * 1024) { listError.value = '文件超过 20MB，暂不支持导入。'; return }
  void file.text().then(text => {
    try {
      const imported = importBreakdownStore(JSON.parse(text))
      const known = new Set(store.value.projects.map(item => item.id))
      const fresh = imported.filter(item => !known.has(item.id))
      const skipped = imported.length - fresh.length
      if (!fresh.length) { listError.value = `导入的 ${skipped} 个项目本机都已存在，没有新增。`; return }
      const merged = [...fresh, ...store.value.projects].slice(0, 30)
      const dropped = store.value.projects.length + fresh.length - merged.length
      store.value = { ...store.value, projects: merged }
      listError.value = `已导入 ${fresh.length} 个项目${skipped ? `，跳过 ${skipped} 个重复` : ''}${dropped ? `；因拆书库最多保留 30 个项目，已丢弃最旧的 ${dropped} 个` : ''}。`
      persist()
    } catch (error) {
      listError.value = error instanceof Error ? error.message : String(error)
    }
  })
}

function openProject(id: string) {
  activeId.value = id
  selectedChapterId.value = ''
  activeInsightId.value = null
  workError.value = ''
  showReport.value = false
  workView.value = 'chapters'
}

function closeProject() {
  activeId.value = null
  showReport.value = false
}

function removeProject(id: string) {
  // 批处理闭包持有项目引用：删掉后改动不落盘、成果全丢，先挡下来
  if (running.value) { workError.value = '正在批量拆解中，请先停止批处理，再删除项目。'; return }
  const project = store.value.projects.find(item => item.id === id)
  if (project && !confirm(`删除《${project.title}》的拆书项目？章节正文与拆解产物会一起删除。`)) return
  store.value = { ...store.value, projects: store.value.projects.filter(item => item.id !== id) }
  persist()
  if (activeId.value === id) activeId.value = null
}

function exportOne(project: BreakdownProject) {
  download(exportBreakdownStore({ version: 1, projects: [project] }), `${safeName(project.title)}-拆书存档.json`, 'application/json')
}

function exportAll() {
  download(exportBreakdownStore(store.value), `拆书存档-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
}

function exportMarkdown(project: BreakdownProject) {
  const markdown = buildBreakdownMarkdown(project)
  if (!markdown.trim()) { workError.value = '还没有可导出的拆解内容'; return }
  download(markdown, `${safeName(project.title)}-拆书报告.md`, 'text/markdown;charset=utf-8')
}

// ---------------------------------------------------------------------------
// 拆解引擎
// ---------------------------------------------------------------------------

onBeforeUnmount(() => { controller.value?.abort(); stopTomatoPolling() })

function stopRun() {
  controller.value?.abort()
}

async function runBatch(chapters: BreakdownChapter[]) {
  const project = activeProject.value
  if (!project || !chapters.length || running.value) return
  if (!props.model.model.trim()) { workError.value = '请先在右上角模型设置中填写模型 ID'; return }
  running.value = true
  workError.value = ''
  controller.value = new AbortController()
  const signal = controller.value.signal
  try {
    for (const chapter of chapters) {
      chapter.status = 'processing'
      chapter.errorMessage = undefined
      if (!persist()) notifyPersistFailure()
      try {
        const prompt = chapterBreakdownPrompt({
          bookTitle: project.title,
          chapterTitle: chapter.title,
          chapterNo: chapter.sortNo,
          paragraphs: chapter.paragraphs.slice(0, BREAKDOWN_PROMPT_PARAGRAPH_LIMIT),
          isGolden: chapter.sortNo <= GOLDEN_CHAPTER_LIMIT,
        })
        const raw = await requestChatCompletion({ model: props.model, system: prompt.system, user: prompt.user, signal, maxTokens: 4200 })
        const { analysis, insightIds } = normalizeChapterAnalysis(extractJsonObject(raw), chapter.paragraphs.length)
        if (!analysis.summary && !analysis.outline.length) throw new Error('拆解结果缺少细纲与关键节点，请重试')
        chapter.analysis = analysis
        chapter.insightIds = insightIds
        chapter.status = 'done'
        if (analysis.relations.length) mergeCharacterNames(project, analysis)
      } catch (error) {
        // 用户主动停止不是失败：该章退回待拆状态，不带 AbortError 文案
        if (signal.aborted) {
          chapter.status = 'wait'
          chapter.errorMessage = undefined
        } else {
          chapter.status = 'failed'
          chapter.errorMessage = error instanceof Error ? error.message : String(error)
        }
      }
      recalcBreakdownProject(project)
      if (!persist()) notifyPersistFailure()
      if (signal.aborted) break
    }
  } finally {
    running.value = false
    controller.value = null
  }
}

/** 批处理中的落盘失败要在当前视图看得见：结果只在内存里，刷新就会丢 */
function notifyPersistFailure() {
  workError.value = '本地存储写入失败，拆解结果暂时只在内存里，刷新页面就会丢失。请先清理浏览器存储空间或导出备份，再继续拆解。'
}

async function generateReport() {
  const project = activeProject.value
  if (!project || reportBusy.value) return
  if (!props.model.model.trim()) { workError.value = '请先在右上角模型设置中填写模型 ID'; return }
  reportBusy.value = true
  workError.value = ''
  const reportController = new AbortController()
  try {
    const briefs: string[] = []
    for (const chapter of project.chapters.filter(item => item.status === 'done').sort((a, b) => a.sortNo - b.sortNo)) {
      const analysis = chapter.analysis
      if (!analysis) continue
      briefs.push([
        `第${chapter.sortNo}章《${chapter.title}》：${analysis.summary}`,
        analysis.rhythm.length ? `节奏：${analysis.rhythm.map(item => `${item.label}${item.value ? `(${item.value})` : ''}`).join('、')}` : '',
      ].filter(Boolean).join('；'))
    }
    if (!briefs.length) throw new Error('还没有已拆解的章节，先拆解后再生成报告')
    const prompt = bookReportPrompt({ bookTitle: project.title, chapterBriefs: briefs })
    const raw = await requestChatCompletion({ model: props.model, system: prompt.system, user: prompt.user, signal: reportController.signal, maxTokens: 3600 })
    const report = normalizeReport(extractJsonObject(raw))
    if (!report) throw new Error('报告生成结果无法解析，请重试')
    project.report = report
    recalcBreakdownProject(project)
    persist()
    showReport.value = true
  } catch (error) {
    workError.value = error instanceof Error ? error.message : String(error)
  } finally {
    reportBusy.value = false
  }
}
</script>

<style scoped>
.bd-page { flex: 1; min-height: 0; overflow-y: auto; padding: 26px 32px 40px; background: radial-gradient(circle at 85% 0, #e7f0e4, transparent 32%), #f5f3f5; }
.bd-hero { max-width: 860px; }
.bd-hero small { color: var(--accent); letter-spacing: 3px; font-size: 11px; }
.bd-hero h1 { margin: 6px 0 8px; font-size: 30px; }
.bd-hero p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.8; }
.bd-layout { display: grid; grid-template-columns: 320px 1fr; gap: 22px; margin-top: 22px; align-items: start; }
.bd-upload { position: sticky; top: 0; padding: 22px; border: 1.5px dashed #cdbfc8; border-radius: 18px; background: var(--paper); text-align: left; }
.bd-upload.over { border-color: var(--accent); background: #fff5f7; }
.bd-upload small { color: var(--muted); letter-spacing: 2px; font-size: 10px; }
.bd-upload h2 { margin: 6px 0 8px; font-size: 19px; }
.bd-upload p { margin: 0 0 14px; color: var(--muted); font-size: 12px; line-height: 1.8; }
.bd-upload-actions { margin-top: 10px; }
.bd-list-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; }
.bd-list-head small { color: var(--muted); letter-spacing: 2px; font-size: 10px; }
.bd-list-head h2 { margin: 4px 0 0; font-size: 20px; }
.bd-list-head h2 span { color: var(--accent); }
.bd-empty { padding: 34px; border: 1px solid var(--line); border-radius: 16px; background: #ffffffb0; color: var(--muted); font-size: 13px; text-align: center; line-height: 2; }
.bd-empty span { display: block; color: var(--accent); font-size: 18px; }
.bd-card { padding: 18px 20px; border: 1px solid var(--line); border-radius: 16px; background: #fff; margin-bottom: 14px; }
.bd-card-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.bd-card-top h3 { margin: 0; font-size: 17px; }
.bd-status { padding: 3px 10px; border-radius: 99px; font-size: 11px; background: #f1ecf0; color: var(--muted); }
.bd-status.done { background: #e6f4ea; color: #237a3b; }
.bd-status.processing { background: #fdf1e3; color: #a4651a; }
.bd-status.failed { background: #fdeaec; color: #b3283d; }
.bd-card-meta { margin: 8px 0 10px; color: var(--muted); font-size: 12px; }
.bd-progress { height: 7px; border-radius: 99px; background: #f0e9ec; overflow: hidden; }
.bd-progress i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--gold)); transition: width .3s; }
.bd-card-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 6px; }
.bd-card time { color: #b3a8b5; font-size: 11px; }
.bd-error { margin: 10px 0 0; color: #b3283d; font-size: 12px; }
.tomato-settings-grid, .tomato-range { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.tomato-settings-grid label, .tomato-range label { display: grid; gap: 5px; color: var(--muted); font-size: 11px; }
.tomato-settings-grid input, .tomato-range input { width: 100%; box-sizing: border-box; padding: 8px 9px; border: 1px solid var(--line); border-radius: 8px; background: #fff; font: inherit; }
.tomato-actions { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
.tomato-ok { color: #237a3b; font-size: 11px; }
.tomato-bad { color: #b3283d; font-size: 11px; line-height: 1.5; }
.tomato-preview, .tomato-job, .tomato-downloads { display: grid; gap: 6px; margin: 10px 0; padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; background: #fffafc; }
.tomato-preview strong, .tomato-job strong, .tomato-downloads strong { color: #6c3554; font-size: 13px; }
.tomato-preview span, .tomato-preview p, .tomato-job small { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
.tomato-preview p { max-height: 74px; overflow: auto; }
.tomato-job > div:first-child { display: flex; justify-content: space-between; gap: 8px; }
.tomato-job > div:first-child span { color: var(--accent); font-size: 11px; }
.tomato-progress { height: 6px; border-radius: 99px; background: #f0e9ec; overflow: hidden; }
.tomato-progress i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--gold)); transition: width .3s; }
.tomato-downloads a { color: var(--accent); font-size: 12px; text-decoration: none; }
.tomato-downloads a:hover { text-decoration: underline; }

/* 工作台 */
.bd-work-head { padding: 18px 22px; border: 1px solid var(--line); border-radius: 18px; background: var(--paper); }
.bd-work-title { display: flex; align-items: center; gap: 16px; }
.bd-work-title small { color: var(--accent); letter-spacing: 2px; font-size: 10px; }
.bd-work-title h1 { margin: 3px 0 0; font-size: 22px; }
.bd-work-meta { margin: 10px 0 12px; color: var(--muted); font-size: 12px; }
.bd-work-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.bd-batch { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.bd-batch select { padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.bd-work-progress { height: 6px; margin-top: 12px; border-radius: 99px; background: #f0e9ec; overflow: hidden; }
.bd-work-progress i { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--gold)); transition: width .3s; }
.bd-work-grid { display: grid; grid-template-columns: 230px minmax(0, 1fr) 340px; gap: 16px; margin-top: 16px; align-items: start; }
.bd-chapters { max-height: calc(100vh - 210px); overflow-y: auto; padding: 10px; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); }
.bd-chapter { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px; border: 0; border-radius: 10px; background: transparent; text-align: left; font-size: 12px; }
.bd-chapter:hover { background: #f6eff3; }
.bd-chapter.active { background: #fbe9ee; }
.bd-chapter-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bd-chapter small { color: #b3a8b5; font-size: 10px; }
.bd-chapter .dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: #d8ccd4; }
.bd-chapter .dot.done { background: #43a35c; }
.bd-chapter .dot.failed { background: #d8455d; }
.bd-chapter .dot.processing { background: var(--gold); }
.bd-reader { padding: 18px 22px; border: 1px solid var(--line); border-radius: 16px; background: #fff; }
.bd-reader-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.bd-reader-head h2 { margin: 0 0 4px; font-size: 17px; }
.bd-reader-head small { color: var(--muted); font-size: 11px; }
.bd-reader-body { padding: 6px 0; }
.bd-paragraph { margin: 0 0 12px; font-size: 13.5px; line-height: 2; text-indent: 2em; border-radius: 6px; transition: background .2s; }
.bd-paragraph.highlight { background: #fdeef2; box-shadow: 0 0 0 3px #fdeef2; cursor: pointer; }
.bd-insight { max-height: calc(100vh - 210px); overflow-y: auto; padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.bd-insight-head { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.bd-insight-head strong { font-size: 14px; }
.bd-insight-head small { color: var(--muted); font-size: 11px; }
.bd-insight-empty { padding: 26px 6px; color: var(--muted); font-size: 12px; line-height: 1.9; text-align: center; }
.bd-insight h3 { margin: 16px 0 8px; font-size: 13px; }
.bd-golden { padding: 12px 14px; border-radius: 12px; background: linear-gradient(135deg, #fff8ec, #fdeef2); }
.bd-golden h3 { margin-top: 0; color: #a4651a; }
.bd-golden dl, .bd-dims { margin: 0; }
.bd-golden dl > div, .bd-dims > div { margin-bottom: 10px; }
.bd-golden dt, .bd-dims dt { color: #6c3554; font-size: 12px; font-weight: 600; }
.bd-golden dt em, .bd-dims dt em { color: var(--muted); font-style: normal; font-weight: 400; }
.bd-golden dd, .bd-dims dd { margin: 3px 0 0; color: #4c4351; font-size: 12px; line-height: 1.8; }
.bd-summary p { margin: 0; padding: 12px 14px; border-radius: 10px; background: #f8f3f6; font-size: 12.5px; line-height: 1.9; }
.bd-node { display: block; width: 100%; margin-bottom: 8px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: #fff; text-align: left; }
.bd-node.active { border-color: var(--accent); background: #fff5f7; }
.bd-node-head { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; }
.bd-node-head small { color: var(--muted); }
.bd-node-text { display: block; margin: 4px 0; color: #4c4351; font-size: 12px; line-height: 1.7; }
.bd-node-tags em { margin-right: 5px; padding: 1px 7px; border-radius: 99px; background: #f1ecf0; color: #7d7283; font-size: 10px; font-style: normal; }
.bd-node-tags em.hot { background: #fdeaec; color: #b3283d; }
.bd-tag { margin-left: 5px; padding: 1px 7px; border-radius: 99px; background: #f1ecf0; color: #7d7283; font-size: 10px; }

/* 分类素材 */
.bd-work-views { display: inline-flex; padding: 3px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.bd-work-views button { padding: 6px 12px; border: 0; border-radius: 8px; background: transparent; color: #806778; font-size: 12px; }
.bd-work-views button.active { background: #fbe9ee; color: #bd496e; font-weight: 700; }
.bd-materials { margin-top: 16px; }
.bd-materials-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 10px; }
.bd-materials-head small { color: var(--accent); letter-spacing: 3px; font-size: 11px; }
.bd-materials-head h2 { margin: 4px 0 0; font-size: 20px; }
.bd-materials-head h2 span { display: inline-grid; place-items: center; min-width: 24px; height: 24px; margin-left: 6px; border-radius: 50%; color: #bd5371; background: #f9dfe9; font: 700 11px system-ui, sans-serif; vertical-align: middle; }
.bd-materials-head-actions { display: flex; gap: 8px; }
.bd-materials-note { margin: 8px 0 0; color: var(--muted); font-size: 12px; line-height: 1.8; }
.bd-copy-notice { color: #3f8a55; }
.bd-material-group { margin-top: 14px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); }
.bd-material-group > header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.bd-material-group h3 { margin: 0; font-size: 14px; }
.bd-material-group h3 span { display: inline-grid; place-items: center; min-width: 22px; height: 22px; margin-left: 6px; border-radius: 99px; color: #6c3554; background: #f1e7ee; font: 700 11px system-ui, sans-serif; vertical-align: middle; }
.bd-material-empty { margin: 8px 0 0; color: #b3a8b5; font-size: 12px; }
.bd-material-group ul { margin: 10px 0 0; padding: 0; list-style: none; }
.bd-material-group li { display: grid; grid-template-columns: minmax(120px, 220px) minmax(0, 1fr) auto; gap: 10px; padding: 9px 0; border-top: 1px dashed var(--line); font-size: 12px; line-height: 1.8; }
.bd-material-group li:first-child { border-top: 0; }
.bd-material-group li strong { color: #6c3554; font-weight: 600; }
.bd-material-group li span { color: #4c4351; }
.bd-material-group li small { color: #b3a8b5; font-size: 10px; white-space: nowrap; }

/* 全书报告 */
.bd-report { width: min(760px, 94vw); max-height: 86vh; overflow-y: auto; }
.bd-report-body section { margin-bottom: 18px; }
.bd-report-body h3 { margin: 0 0 8px; font-size: 14px; }
.bd-report-body p { margin: 0; font-size: 13px; line-height: 1.9; }
.bd-report-body ul, .bd-report-body ol { margin: 0; padding-left: 20px; font-size: 12.5px; line-height: 1.9; }
.bd-report-body li { margin-bottom: 5px; }
.bd-pacing em { margin: 0 6px; padding: 1px 8px; border-radius: 99px; background: #fdeef2; color: #b3283d; font-style: normal; font-size: 11px; }

@media (max-width: 1080px) {
  .bd-work-grid { grid-template-columns: 200px minmax(0, 1fr); }
  .bd-insight { grid-column: 1 / -1; max-height: none; }
}
@media (max-width: 760px) {
  .bd-material-group li { grid-template-columns: 1fr; gap: 2px; }
  .bd-material-group li small { justify-self: start; }
}
@media (max-width: 760px) {
  .bd-page { padding: 16px 14px 30px; }
  .bd-layout { grid-template-columns: 1fr; }
  .bd-upload { position: static; }
  .bd-work-grid { grid-template-columns: 1fr; }
  .bd-chapters { max-height: 220px; }
}
</style>
