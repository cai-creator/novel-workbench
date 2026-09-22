<template>
  <div class="app-shell">
    <header class="topbar">
      <button class="brand brand-button" type="button" @click="goShelf" aria-label="返回作品书架"><span class="brand-mark">文</span><span><strong>小说创作工作台</strong><small>新版 · 从故事到正文</small></span></button>
      <button class="top-menu-toggle" type="button" :aria-expanded="topMenuOpen" aria-label="打开菜单" @click="topMenuOpen = !topMenuOpen"><span class="top-menu-icon" :class="{ open: topMenuOpen }"></span>菜单</button>
      <div class="top-actions" :class="{ open: topMenuOpen }" @click="topMenuOpen = false">
        <span class="save-indicator" role="status">{{ saveStatus }}</span>
        <button v-if="screen !== 'shelf'" class="quiet" @click="goShelf">作品书架</button>
        <button v-else-if="book" class="quiet" @click="screen = 'editor'">返回写作</button>
        <button v-if="screen !== 'workflow'" class="quiet" @click="openWorkflow">工作流建书</button>
        <button v-if="screen !== 'workflow-history'" class="quiet" @click="openWorkflowHistory">建书记录 <span class="top-count">{{ workflowRecordCount }}</span></button>
        <button v-if="book && screen !== 'production'" class="quiet" @click="openProduction">逐章生文 <span class="top-count">{{ productionDoneCount }}/{{ book.chapters.length }}</span></button>
        <button v-if="screen !== 'breakdown'" class="quiet" @click="screen = 'breakdown'">竞品拆书</button>
        <button v-if="screen !== 'rank'" class="quiet" @click="screen = 'rank'">扫榜</button>
        <button v-if="screen !== 'inspiration'" class="quiet" @click="openInspiration">灵感收集 <span class="top-count">{{ data.notes.length }}</span></button>
        <button v-if="screen !== 'stats'" class="quiet" @click="openStats">写作统计</button>
        <button class="quiet" @click="importInput?.click()">导入作品</button>
        <input ref="importInput" type="file" accept=".json,application/json" hidden @change="handleImport" />
        <button class="quiet" @click="showBackup = true">备份与导出</button>
        <button v-if="screen === 'editor'" class="quiet" @click="exportBook" :disabled="!book">导出作品</button>
        <button class="quiet" @click="showModel = true">模型设置</button>
      </div>
    </header>

    <main v-if="screen === 'workflow'" class="workflow-page">
      <div class="workflow-shell">
        <header class="workflow-hero"><small>STORY LAB · 从灵感到可写的书</small><h1>建立你的下一部连载</h1><p>四步完成可编辑的创意、大纲与设定。每份 AI 候选都由你决定是否采纳。</p></header>
        <nav class="workflow-steps" aria-label="建书步骤"><button v-for="item in workflowSteps" :key="item.step" type="button" :class="{ active: workflow.step === item.step, done: workflow.step > item.step }" @click="workflow.step = item.step"><span>{{ String(item.step).padStart(2, '0') }}</span>{{ item.label }}</button></nav>
        <section class="workflow-card">
          <div class="workflow-card-head"><div><small>第 {{ workflow.step }} 步 / 共 4 步</small><h2>{{ workflowSteps[workflow.step - 1].title }}</h2><p>{{ workflowSteps[workflow.step - 1].description }}</p></div><div class="workflow-card-links"><button class="workflow-reset" @click="openWorkflowHistory">查看记录</button><button class="workflow-reset" @click="startNewWorkflow">保存并新建</button></div></div>
          <div v-if="workflow.step === 1" class="workflow-fields">
            <div class="workflow-field-row"><label>作品类型<input v-model="workflow.genre" placeholder="例如：都市悬疑、玄幻冒险" /></label><label>目标读者<input v-model="workflow.audience" placeholder="例如：喜欢快节奏悬疑的读者" /></label><label>叙事风格<input v-model="workflow.tone" placeholder="例如：克制、诡谲、带少量幽默" /></label></div>
            <div class="workflow-field-head"><label for="workflow-seed">原始灵感</label><button class="secondary" @click="openNotePicker">从灵感库选择</button></div><textarea id="workflow-seed" v-model="workflow.seed" placeholder="哪怕只有一句话：主角遇到了什么异常？他非解决不可的事是什么？" />
            <div class="workflow-field-head"><label for="workflow-idea">可用创意</label><span class="workflow-field-tools"><button class="secondary" @click="openBreakdownPicker('idea')">从拆书带入</button><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('idea')">✦ AI 完善创意</button></span></div><textarea id="workflow-idea" v-model="workflow.idea" placeholder="把创意改成你愿意写下去的版本。AI 生成内容需要先预览和采纳。" />
          </div>
          <div v-else-if="workflow.step === 2" class="workflow-fields">
            <div class="workflow-field-head"><label for="workflow-title">作品名称</label><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('title')">✦ AI 取书名</button></div><input id="workflow-title" v-model="workflow.title" maxlength="60" placeholder="先起一个工作书名，随时可以改" />
            <div class="workflow-field-head"><label for="workflow-outline">故事主线与章节规划</label><span class="workflow-field-tools"><button class="secondary" @click="openBreakdownPicker('outline')">从拆书带入</button><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('outline')">✦ AI 生成大纲</button></span></div><textarea id="workflow-outline" v-model="workflow.outline" class="workflow-long" placeholder="先写故事主线，再逐行写：第1章｜标题｜具体事件与章节钩子。建书时会识别最多 20 个章节。" />
            <p class="workflow-help">已识别 {{ workflowChapters.length }} 个章节；章节摘要会跟随正文保存，并提供给 AI 写正文时参考。</p>
          </div>
          <div v-else-if="workflow.step === 3" class="workflow-fields">
            <div class="workflow-field-head"><label for="workflow-world">世界观与规则</label><span class="workflow-field-tools"><button class="secondary" @click="openBreakdownPicker('world')">从拆书带入</button><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('world')">✦ AI 补全世界观</button></span></div><textarea id="workflow-world" v-model="workflow.world" placeholder="规则、限制、代价与对故事的影响" />
            <div class="workflow-field-head"><label for="workflow-characters">主要人物</label><span class="workflow-field-tools"><button class="secondary" @click="openBreakdownPicker('characters')">从拆书带入</button><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('characters')">✦ AI 塑造人物</button></span></div><textarea id="workflow-characters" v-model="workflow.characters" placeholder="人物目标、弱点、秘密、关系与变化" />
            <div class="workflow-field-head"><label for="workflow-timeline">故事时间线</label><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('timeline')">✦ AI 整理时间线</button></div><textarea id="workflow-timeline" v-model="workflow.timeline" placeholder="第一天｜事件｜后果；逐行记录重要节点" />
          </div>
          <div v-else class="workflow-review">
            <div class="workflow-review-book"><span>即将创建</span><h3>{{ workflow.title || '尚未命名的作品' }}</h3><p>{{ workflow.idea || workflow.seed || '还没有填写创意。' }}</p></div>
            <div class="workflow-review-stats"><div><strong>{{ workflowChapters.length || 1 }}</strong><span>初始章节</span></div><div><strong>{{ workflowLoreCount }}</strong><span>作品资料</span></div><div><strong>{{ workflow.idea ? '已确定' : '待补充' }}</strong><span>核心创意</span></div></div>
            <div class="workflow-review-list"><strong>章节目录预览</strong><p v-if="!workflowChapters.length">没有识别到“第1章｜标题｜摘要”格式；建书时会先创建空白第一章，大纲仍保留在资料库中。</p><ol v-else><li v-for="item in workflowChapters" :key="item.title"><b>{{ item.title }}</b><span>{{ item.outline }}</span></li></ol></div>
          </div>
          <p v-if="workflowError" class="workflow-error" role="alert">{{ workflowError }}</p>
          <div class="workflow-footer"><span>{{ workflowSaveStatus }}</span><div><button v-if="workflowBusy" class="secondary" @click="stopWorkflow">停止生成</button><button v-if="workflow.step > 1" class="secondary" @click="previousWorkflow">上一步</button><button v-if="workflow.step < 4" class="primary" @click="nextWorkflow">下一步 →</button><button v-else class="primary" :disabled="!workflow.title.trim() || workflowBusy" @click="finishWorkflow">创建作品并开始写作 →</button></div></div>
        </section>
      </div>
    </main>

    <main v-else-if="screen === 'workflow-history'" class="workflow-page">
      <div class="workflow-shell">
        <header class="workflow-hero"><small>STORY LAB · 建书记录</small><h1>故事从这里接着长大</h1><p>继续未完成的草稿，或把过去的方案复制成新的创作方向。</p></header>
        <section class="workflow-history-panel">
          <div class="workflow-history-head"><div><small>YOUR PROJECTS</small><h2>建书记录 <span>{{ workflowRecordCount }}</span></h2></div><div class="workflow-history-head-actions"><button class="secondary" :disabled="!workflowRecordCount" @click="exportWorkflowRecords">导出记录</button><button class="secondary" @click="workflowImportInput?.click()">导入记录</button><input ref="workflowImportInput" type="file" accept=".json,application/json" hidden @change="handleWorkflowImport" /><button class="primary" @click="startNewWorkflow">＋ 新建草稿</button></div></div>
          <div class="workflow-history-filters" role="group" aria-label="建书记录筛选"><button v-for="item in workflowHistoryFilters" :key="item.id" :class="{ active: workflowHistoryFilter === item.id }" @click="workflowHistoryFilter = item.id">{{ item.label }}</button></div>
          <p v-if="workflowHistoryError" class="workflow-error" role="alert">{{ workflowHistoryError }}</p>
          <p v-if="workflowHistoryNotice" class="workflow-history-notice" role="status">{{ workflowHistoryNotice }}</p>
          <div v-if="!workflowRecords.length" class="workflow-history-empty"><span>✦</span><h3>{{ workflowHistoryFilter === 'all' ? '还没有建书记录' : '这一类还没有记录' }}</h3><p>从一条灵感开始，创作方向和大纲会自动留在这里。</p><button class="primary" @click="startNewWorkflow">开始新故事</button></div>
          <div v-else class="workflow-history-grid">
            <article v-for="record in workflowRecords" :key="record.id" class="workflow-history-card">
              <div class="workflow-history-card-head"><span :class="record.status">{{ record.status === 'draft' ? '未完成草稿' : '已建书' }}</span><time :datetime="record.updatedAt">{{ formatVersionTime(record.updatedAt) }}</time></div>
              <h3>{{ workflowRecordTitle(record) }}</h3><p>{{ record.draft.idea || record.draft.seed || '这份草稿尚未写下创意。' }}</p>
              <div class="workflow-history-meta"><span>{{ record.draft.genre || '类型未定' }}</span><span>{{ parseChapterPlan(record.draft.outline).length }} 个章节规划</span><span v-if="record.status === 'draft'">第 {{ record.draft.step }} 步</span></div>
              <div class="workflow-history-actions"><button v-if="record.status === 'draft'" class="primary" @click="resumeWorkflowRecord(record.id)">继续编辑</button><button v-else-if="data.books.some(item => item.id === record.bookId)" class="primary" @click="openCompletedBook(record)">打开作品</button><span v-else class="missing-book">作品已不在当前书架</span><button class="secondary" @click="duplicateWorkflowRecord(record.id)">复制为新草稿</button><button class="workflow-delete" :aria-label="`删除 ${workflowRecordTitle(record)} 的建书记录`" @click="deleteWorkflowRecord(record.id)">删除</button></div>
            </article>
          </div>
        </section>
      </div>
    </main>

    <main v-else-if="screen === 'inspiration'" class="notes-page">
      <div class="notes-shell">
        <header class="notes-hero"><small>INSPIRATION · 灵感收集</small><h1>别让好念头溜走</h1><p>随手记下一句话、一个画面或一段对话。日后可以整理、检索，或直接送去建书。</p></header>
        <div class="notes-layout">
          <section class="notes-composer">
            <div class="notes-composer-head"><small>{{ editingNoteId ? 'EDITING' : 'NEW NOTE' }}</small><h2>{{ editingNoteId ? '修改这条灵感' : '记下此刻的念头' }}</h2></div>
            <textarea v-model="noteDraft" class="notes-input" placeholder="例如：主角每次说谎，口袋里就会多一枚陌生的钥匙。" @keydown.ctrl.enter.prevent="saveNote" />
            <label class="notes-tags-label" for="note-tags">标签<input id="note-tags" v-model="noteTagDraft" placeholder="用逗号分隔，例如：悬疑，开局" /></label>
            <div class="notes-composer-footer"><span>Ctrl + Enter 保存</span><button v-if="editingNoteId" class="secondary" @click="cancelEditNote">取消编辑</button><button class="primary" :disabled="!noteDraft.trim()" @click="saveNote">{{ editingNoteId ? '保存修改' : '存入灵感库' }}</button></div>
            <p v-if="notesError" class="workflow-error" role="alert">{{ notesError }}</p>
          </section>
          <section class="notes-panel">
            <div class="notes-panel-head"><div><small>YOUR NOTES</small><h2>灵感库 <span>{{ filteredNotes.length }}</span></h2></div><button class="secondary" @click="openWorkflow">去建书 →</button></div>
            <div class="notes-filters">
              <input v-model="noteQuery" type="search" aria-label="搜索灵感" placeholder="搜索内容或标签" />
              <div v-if="noteTagList.length" class="notes-tag-chips" role="group" aria-label="标签筛选">
                <button v-for="tag in noteTagList" :key="tag" type="button" :class="{ active: noteTagFilter === tag }" @click="noteTagFilter = noteTagFilter === tag ? '' : tag">#{{ tag }}</button>
              </div>
            </div>
            <p v-if="!data.notes.length" class="notes-empty"><span>✦</span>灵感库还空着。把突然冒出来的想法先扔进来，建书时再挑。</p>
            <p v-else-if="!filteredNotes.length" class="notes-empty"><span>◇</span>没有匹配的灵感。换个关键词或清空标签筛选。</p>
            <div v-else class="notes-grid">
              <article v-for="note in filteredNotes" :key="note.id" class="note-card" :class="{ pinned: note.pinned }">
                <div class="note-card-top"><button class="note-pin" type="button" @click="toggleNotePin(note.id)">{{ note.pinned ? '★ 已置顶' : '☆ 置顶' }}</button><time :datetime="note.updatedAt">{{ formatDate(note.updatedAt) }}</time></div>
                <p class="note-content">{{ note.content }}</p>
                <div v-if="note.tags.length" class="note-tags"><span v-for="tag in note.tags" :key="tag">#{{ tag }}</span></div>
                <div class="note-actions"><button class="secondary" @click="startEditNote(note)">编辑</button><button class="secondary" @click="sendNoteToWorkflow(note.id)">送去建书 →</button><button class="text-danger" @click="removeNote(note.id)">删除</button></div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </main>

    <main v-else-if="screen === 'stats'" class="stats-page">
      <div class="stats-shell">
        <header class="stats-hero"><small>WRITING STATS · 写作统计</small><h1>每一页都算数</h1><p>按天记录手写与 AI 采纳的正文字数。数据只保存在本机浏览器。</p></header>
        <div class="stats-toolbar">
          <label class="stats-book-filter">作品<select v-model="statsBookFilter"><option value="">全部作品</option><option v-for="item in data.books" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
          <div class="stats-range" role="group" aria-label="趋势区间"><button v-for="span in statsSpanOptions" :key="span" type="button" :class="{ active: statsSpan === span }" @click="statsSpan = span">近 {{ span }} 天</button></div>
        </div>
        <section class="stats-cards" aria-label="写作概览">
          <div class="stats-card"><strong>{{ todayStats.total.toLocaleString() }}</strong><span>今日字数</span><small>手写 {{ todayStats.manual.toLocaleString() }} · AI {{ todayStats.ai.toLocaleString() }}</small></div>
          <div class="stats-card"><strong>{{ statsStreak }}</strong><span>连续写作天数</span><small>{{ statsStreak >= 7 ? '状态正酣' : '再写一天就连起来' }}</small></div>
          <div class="stats-card"><strong>{{ statsTotals.total.toLocaleString() }}</strong><span>累计字数</span><small>手写 {{ statsTotals.manual.toLocaleString() }} · AI {{ statsTotals.ai.toLocaleString() }}</small></div>
          <div class="stats-card"><strong>{{ statsAiShare }}%</strong><span>AI 采纳占比</span><small>采纳后计入正文字数</small></div>
        </section>
        <section class="stats-goal">
          <div class="stats-goal-text"><strong>今日目标</strong><span>已完成 {{ todayStats.total.toLocaleString() }} / {{ data.stats.dailyGoal.toLocaleString() }} 字</span></div>
          <div class="stats-progress" role="progressbar" :aria-valuenow="goalPercent" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: goalPercent + '%' }"></i></div>
          <label class="stats-goal-input">调整目标<input v-model.number="data.stats.dailyGoal" type="number" min="100" max="100000" step="100" @change="saveStatsGoal" /></label>
        </section>
        <section class="stats-trend">
          <div class="stats-section-head"><h3>近 {{ statsSpan }} 天写作量</h3><div class="stats-legend"><span><i class="manual"></i>手写</span><span><i class="ai"></i>AI 采纳</span></div></div>
          <div class="stats-bars">
            <div v-for="point in statsTrend" :key="point.date" class="stats-bar-col" :title="`${point.date}：手写 ${point.manual} 字，AI ${point.ai} 字`">
              <div class="stats-bar-stack"><i class="ai" :style="{ height: barHeight(point.ai) + '%' }"></i><i class="manual" :style="{ height: barHeight(point.manual) + '%' }"></i></div>
              <small>{{ point.date.slice(5).replace('-', '/') }}</small>
            </div>
          </div>
        </section>
        <section class="stats-calendar">
          <header class="stats-section-head"><h3>写作日历</h3><div class="stats-month-nav"><button type="button" aria-label="上个月" @click="shiftStatsMonth(-1)">←</button><strong>{{ calendarTitle }}</strong><button type="button" aria-label="下个月" @click="shiftStatsMonth(1)">→</button></div></header>
          <div class="stats-calendar-grid">
            <em v-for="label in weekdayLabels" :key="label">{{ label }}</em>
            <button v-for="cell in calendarCells" :key="cell.date" type="button" class="stats-calendar-cell" :class="['heat-' + heatLevel(cell.total), { out: !cell.inMonth, today: cell.isToday }]" :title="`${cell.date} · ${cell.total} 字`">{{ Number(cell.date.slice(8)) }}</button>
          </div>
        </section>
      </div>
    </main>

    <main v-else-if="screen === 'breakdown'" class="breakdown-page"><BreakdownView :model="data.model" :data-epoch="dataEpoch" /></main>

    <main v-else-if="screen === 'rank'" class="rank-page"><RankView :model="data.model" :data-epoch="dataEpoch" /></main>

    <main v-else-if="screen === 'production' && book" class="production-page">
      <div class="production-shell">
        <header class="production-hero"><div><small>CHAPTER STUDIO · {{ book.title }}</small><h1>把章纲写成故事</h1><p>按章节生成可编辑的候选稿。每章都由你审阅并采纳，正文才会更新。</p></div><button class="secondary" @click="screen = 'editor'">返回写作 →</button></header>
        <div class="production-summary"><div><strong>{{ productionDoneCount }} / {{ book.chapters.length }}</strong><span>已有正文</span></div><div><strong>{{ productionCandidateCount }}</strong><span>待审候选</span></div><div><strong>{{ bookWords.toLocaleString() }}</strong><span>全书字数</span></div><button class="secondary" :disabled="!nextUnwrittenChapter" @click="selectProductionChapter(nextUnwrittenChapter!.id)">定位下一章 →</button></div>
        <div class="production-layout">
          <nav class="production-chapters" aria-label="生文章节列表"><div class="production-list-title"><strong>章节进度</strong><span>按目录顺序</span></div><button v-for="(item, index) in book.chapters" :key="item.id" type="button" :class="{ active: item.id === selectedChapterId }" @click="selectProductionChapter(item.id)"><b>{{ String(index + 1).padStart(2, '0') }}</b><span><strong>{{ item.title }}</strong><small>{{ item.proseCandidates?.length ? `${item.proseCandidates.length} 份候选待审` : item.content.trim() ? `${countWords(item.content)} 字 · 已写` : '等待生文' }}</small></span><i>{{ item.proseCandidates?.length ? '✦' : item.content.trim() ? '✓' : '→' }}</i></button></nav>
          <section v-if="chapter" class="production-stage">
            <div class="production-stage-head"><div><small>CHAPTER {{ String(book.chapters.findIndex(item => item.id === selectedChapterId) + 1).padStart(2, '0') }}</small><h2>{{ chapter.title }}</h2></div><span :class="{ ready: !!chapter.proseCandidates?.length }">{{ chapter.proseCandidates?.length ? `${chapter.proseCandidates.length} 份候选` : chapter.content.trim() ? '已有正文' : '待生成' }}</span></div>
            <div class="production-outline"><strong>本章提纲</strong><p>{{ chapter.outline || '还没有章纲。可以先在写作页补充，以便 AI 把握本章事件。' }}</p></div>
            <div class="production-controls"><div class="production-fields"><label>写作任务<select v-model="productionKind"><option value="continue" :disabled="!chapter.content.trim()">接着本章写</option><option value="rewrite">从头写本章</option></select></label><label>目标篇幅<select v-model.number="productionLength"><option :value="800">约 800 字</option><option :value="1500">约 1500 字</option><option :value="2000">约 2000 字</option></select></label><label>写作要求<textarea v-model="productionInstruction" placeholder="可选：指定视角、重点场景、对话节奏或需要避开的情节。" /></label></div><div class="production-generate"><span>会参考故事概念、人物和世界设定，以及上一章结尾。新稿会作为另一份候选保存。</span><button v-if="productionBusy" class="secondary" @click="stopProduction">停止生成</button><button v-else class="primary" @click="generateProduction">✦ 生成新候选</button></div><p v-if="productionError" class="workflow-error" role="alert">{{ productionError }}</p></div>
            <div v-if="selectedProseCandidate" class="production-candidate">
              <div class="production-section-head"><div><small>AI CANDIDATES</small><h3>候选正文 <span>{{ chapter.proseCandidates?.length }} 份可选</span></h3></div><button class="production-delete" @click="deleteProductionCandidate">删除当前候选</button></div>
              <div class="production-variants" role="tablist" aria-label="正文候选版本"><button v-for="(candidate, index) in chapter.proseCandidates" :key="candidate.id" type="button" role="tab" :aria-selected="selectedProseCandidate.id === candidate.id" :class="{ active: selectedProseCandidate.id === candidate.id }" @click="selectProductionCandidate(candidate.id)"><strong>方案 {{ String(index + 1).padStart(2, '0') }}</strong><span>{{ candidate.kind === 'rewrite' ? '从头重写' : '续写' }} · {{ countWords(candidate.content) }} 字</span></button></div>
              <div class="production-candidate-meta"><span>{{ selectedProseCandidate.instruction || '没有额外写作要求' }}</span><time :datetime="selectedProseCandidate.createdAt">{{ formatVersionTime(selectedProseCandidate.createdAt) }}</time></div>
              <p v-if="selectedProseCandidate.baseUpdatedAt !== chapter.updatedAt" class="production-warning">生成后本章又有修改，请确认候选与现稿衔接。</p>
              <div class="production-compare-toolbar"><strong>{{ compareProduction && chapter.content.trim() ? '现稿与候选的文字差异' : '编辑候选正文' }}</strong><button v-if="chapter.content.trim()" class="secondary" @click="compareProduction = !compareProduction">{{ compareProduction ? '返回编辑候选' : '查看文字差异' }}</button></div>
              <TextDiff v-if="compareProduction && chapter.content.trim()" :before="chapter.content" :after="selectedProseCandidate.content" before-label="当前正文" after-label="候选方案" />
              <div v-else class="production-edit"><label for="production-candidate-text">候选方案 · {{ countWords(selectedProseCandidate.content) }} 字</label><textarea id="production-candidate-text" v-model="selectedProseCandidate.content" aria-label="可编辑的正文候选" spellcheck="false" /></div>
              <div class="production-adopt"><label>写入方式<select v-model="productionInsert"><option value="append">追加到本章末尾</option><option value="replace">替换本章正文</option></select></label><button class="primary" :disabled="!selectedProseCandidate.content.trim()" @click="adoptProduction">采纳这份候选 →</button></div><p>采纳前不会改动正文。已有正文会先存入版本历史；其他候选继续保留。</p>
            </div>
            <div v-if="chapter.content.trim()" class="production-existing"><details><summary>查看当前正文 · {{ countWords(chapter.content) }} 字</summary><div>{{ chapter.content }}</div></details></div>
          </section>
        </div>
      </div>
    </main>

    <main v-else-if="screen === 'shelf'" class="shelf-page">
      <div class="shelf-inner">
        <section class="shelf-hero">
          <div><small>我的连载书房</small><h1>每一个故事，都有下一章。</h1><p>在这里整理作品，随时回到最近写下的那一章。</p>
            <div class="shelf-hero-actions"><button class="primary large" @click="openWorkflow">✦ 工作流建书</button><button class="shelf-import" @click="openWorkflowHistory">建书记录 →</button><button class="shelf-import" @click="openInspiration">灵感收集 →</button><button class="shelf-import" @click="openStats">写作统计 →</button><button class="shelf-import" @click="addBook">手动创建 →</button><button class="shelf-import" @click="importInput?.click()">导入已有作品 →</button></div>
          </div>
          <div class="shelf-hero-art" aria-hidden="true"><span>故</span><span>事</span><span>未</span><span>完</span></div>
        </section>
        <div v-if="data.books.length" class="shelf-stats" aria-label="创作概览">
          <div><strong>{{ data.books.length }}</strong><span>部作品</span></div><div><strong>{{ shelfChapterCount }}</strong><span>个章节</span></div><div><strong>{{ shelfWordCount.toLocaleString() }}</strong><span>已写字数</span></div>
        </div>
        <section class="shelf-library">
          <div class="shelf-section-head"><div><small>YOUR STORIES</small><h2>作品书架 <span>{{ data.books.length }}</span></h2></div><div v-if="data.books.length" class="shelf-controls"><input v-model="shelfQuery" type="search" aria-label="搜索作品" placeholder="搜索书名或故事概念" /><select v-model="shelfSort" aria-label="作品排序"><option value="recent">最近写作</option><option value="title">按书名排序</option></select></div></div>
          <div v-if="!data.books.length" class="shelf-empty"><span>✦</span><h3>书架还空着</h3><p>新建作品后，你的章节、设定和写作进度都会汇集在这里。</p><button class="primary" @click="addBook">创建第一本书</button></div>
          <div v-else-if="!shelfBooks.length" class="shelf-empty"><span>◇</span><h3>没有找到作品</h3><p>试试其他书名或故事关键词。</p><button class="secondary" @click="shelfQuery = ''">清空搜索</button></div>
          <div v-else class="shelf-grid">
            <article v-for="(item, index) in shelfBooks" :key="item.id" class="shelf-card">
              <div class="shelf-cover" :style="{ '--cover-hue': `${(index * 41) % 130}deg` }"><span class="shelf-cover-symbol">✦</span><strong>{{ item.title.slice(0, 8) }}</strong><small>连载手稿</small></div>
              <div class="shelf-card-body"><div class="shelf-card-top"><span>原创小说</span><time :datetime="latestUpdate(item)">{{ formatDate(latestUpdate(item)) }}</time></div><h3>{{ item.title }}</h3><p>{{ item.premise || '这个故事的核心冲突还没写下。打开作品，写下第一句灵感。' }}</p><div class="shelf-card-meta"><span>{{ item.chapters.length }} 章</span><span>{{ countBookWords(item).toLocaleString() }} 字</span><span>{{ item.lore.length }} 条资料</span></div><button class="shelf-continue" @click="selectBook(item.id)">继续写 · {{ latestChapter(item)?.title || '第一章' }} <span>→</span></button></div>
            </article>
          </div>
        </section>
      </div>
    </main>

    <div v-else class="workspace" :class="{ focus: focusMode }">
      <aside class="book-rail">
        <div class="rail-heading"><span>我的作品</span><button class="icon-button" aria-label="新建作品" title="新建作品" @click="addBook">＋</button></div>
        <div class="book-list">
          <button v-for="item in data.books" :key="item.id" class="book-item" :class="{ active: item.id === selectedBookId }" @click="selectBook(item.id)">
            <span class="book-icon">◈</span><span class="book-name">{{ item.title }}</span>
          </button>
          <p v-if="!data.books.length" class="empty-rail">还没有作品。新建一本，从第一章开始。</p>
        </div>
        <div v-if="book" class="rail-bottom">
          <span>{{ book.chapters.length }} 章 · {{ bookWords }} 字</span>
          <button class="text-danger" @click="removeBook">删除作品</button>
        </div>
      </aside>

      <template v-if="book">
        <aside class="chapter-rail">
          <div class="rail-heading"><span>章节目录</span><button class="icon-button" aria-label="新建章节" title="新建章节" @click="addChapter">＋</button></div>
          <div class="chapter-list">
            <button v-for="(item, index) in book.chapters" :key="item.id" class="chapter-item" :class="{ active: item.id === selectedChapterId }" @click="selectedChapterId = item.id">
              <span class="chapter-number">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="chapter-name">{{ item.title || '未命名章节' }}</span>
              <small>{{ countWords(item.content) }} 字</small>
            </button>
          </div>
          <button class="chapter-add" @click="addChapter">＋ 新建章节</button>
          <div class="rail-bottom"><button class="text-danger" @click="removeChapter" :disabled="book.chapters.length <= 1">删除当前章节</button></div>
        </aside>

        <main class="editor-area">
          <div class="editor-head">
            <div class="breadcrumbs">{{ book.title }} <span>/</span> {{ chapter?.title }}</div>
            <div class="editor-tools"><button class="quiet" @click="openFind">查找替换</button><button class="quiet" @click="openProduction">逐章生文</button><button class="quiet" @click="openHistory">版本历史 <span class="count-pill">{{ chapter?.history?.length || 0 }}</span></button><button class="quiet" @click="showPremise = true">故事概念</button><button class="quiet" @click="sideView = 'reference'">作品资料 <span class="count-pill">{{ book.lore.length }}</span></button><span class="font-size-group"><button class="quiet" aria-label="减小正文字号" @click="changeFontSize(-1)">A−</button><small>{{ editorPrefs.fontSize }}</small><button class="quiet" aria-label="增大正文字号" @click="changeFontSize(1)">A＋</button></span><button class="quiet" @click="toggleFocusMode">{{ focusMode ? '退出专注' : '专注模式' }}</button></div>
          </div>
          <div v-if="findOpen" class="find-bar">
            <div class="find-row"><input v-model="findQuery" class="find-input" aria-label="查找内容" placeholder="查找本章内容" @keydown.enter.prevent="nextMatch" @keydown.shift.enter.prevent="prevMatch" @keydown.esc.prevent="closeFind" /><span class="find-count">{{ findStatusText }}</span><button class="quiet" aria-label="上一处" :disabled="!findMatches.length" @click="prevMatch">↑</button><button class="quiet" aria-label="下一处" :disabled="!findMatches.length" @click="nextMatch">↓</button><label class="find-option"><input v-model="findCaseSensitive" type="checkbox" />区分大小写</label><button class="quiet" @click="closeFind">关闭</button></div>
            <div class="find-row"><input v-model="replaceQuery" class="find-input" aria-label="替换为" placeholder="替换为（留空则删除匹配内容）" @keydown.esc.prevent="closeFind" /><button class="secondary" :disabled="!findMatches.length" @click="replaceCurrentMatch">替换</button><button class="secondary" :disabled="!findMatches.length" @click="replaceAllMatches">全部替换</button></div>
          </div>
          <div v-if="chapter" class="paper">
            <input v-model="chapter.title" class="chapter-title" aria-label="章节标题" placeholder="章节标题" @input="touchChapter" />
            <div class="paper-meta"><span class="goal-chip" :class="{ done: !!chapterWordGoal && countWords(chapter.content) >= chapterWordGoal }">{{ countWords(chapter.content) }} 字<template v-if="chapterWordGoal"> / 目标 {{ chapterWordGoal }}</template></span><span>·</span> {{ chapter.content ? '继续写下去' : '在这里写下故事的第一句' }}<button class="goal-set" @click="toggleGoalEditor">{{ chapterWordGoal ? '修改目标' : '设置字数目标' }}</button></div>
            <div v-if="chapterWordGoal" class="goal-progress" role="progressbar" :aria-valuenow="chapterGoalPercent" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: chapterGoalPercent + '%' }"></i></div>
            <div v-if="goalEditing" class="goal-editor"><input v-model.number="goalDraft" type="number" min="0" max="1000000" placeholder="本章目标字数" aria-label="本章目标字数" @keydown.enter.prevent="saveChapterGoal" /><button class="secondary" @click="saveChapterGoal">保存目标</button><button class="quiet" @click="clearChapterGoal">清除</button></div>
            <details class="chapter-outline"><summary>本章提纲 <span>{{ chapter.outline ? '已填写' : '可选' }}</span></summary><textarea v-model="chapter.outline" placeholder="这一章要发生什么？结尾留下什么悬念？" @input="touchChapter" /></details>
            <textarea ref="manuscriptEl" v-model="chapter.content" class="manuscript" aria-label="章节正文" placeholder="故事从这里开始……" spellcheck="false" :style="{ fontSize: manuscriptFontSize + 'px' }" @input="touchChapter" @mouseup="updateSelectionBubble" @keyup="updateSelectionBubble" @touchend="updateSelectionBubble" />
            <div v-if="selectionBubble" class="selection-bubble" :style="{ top: selectionBubble.top + 'px', left: selectionBubble.left + 'px' }" @mousedown.prevent>
              <template v-if="selectionBusy"><span class="selection-busy">生成中…</span><button class="quiet" @click="selectionController?.abort()">停止</button></template>
              <template v-else-if="!selectionCustomOpen"><button v-for="action in selectionActions" :key="action.id" type="button" @click="runSelectionAction(action.id)">{{ action.label }}</button><button class="quiet" aria-label="关闭选区工具" @click="selectionBubble = null">×</button></template>
              <template v-else><input v-model="selectionInstruction" placeholder="想怎么改？回车执行" aria-label="自定义修改要求" @keydown.enter.prevent="runSelectionAction('custom')" @keydown.esc.prevent="selectionCustomOpen = false" /><button class="primary" @click="runSelectionAction('custom')">执行</button></template>
            </div>
          </div>
          <div v-else class="empty-main">选择一章，开始写作。</div>
        </main>

        <aside class="assistant">
          <div class="assistant-nav" role="tablist" aria-label="写作侧栏">
            <button type="button" role="tab" :aria-selected="sideView === 'ai'" :class="{ active: sideView === 'ai' }" @click="sideView = 'ai'">✦ AI 共创</button>
            <button type="button" role="tab" :aria-selected="sideView === 'reference'" :class="{ active: sideView === 'reference' }" @click="sideView = 'reference'">▤ 作品资料 <span>{{ book.lore.length }}</span></button>
          </div>
          <template v-if="sideView === 'ai'">
            <div class="assistant-head"><div><span class="spark">✦</span><strong>创作助手</strong><p>从想法直接走到可用的稿件</p></div></div>
            <div class="mode-grid" role="group" aria-label="创作任务">
              <button v-for="item in modes" :key="item.id" :class="{ active: mode === item.id }" @click="mode = item.id">{{ item.label }}</button>
            </div>
            <div class="chat-scroll">
              <div v-if="!book.chat.length" class="assistant-empty"><div class="empty-star">✦</div><strong>{{ modeHint.title }}</strong><p>{{ modeHint.description }}</p></div>
              <div v-for="entry in book.chat" :key="entry.id" class="message" :class="entry.role">
                <div class="message-label">{{ entry.role === 'user' ? '我' : '创作助手' }} · {{ modeLabel(entry.mode) }}</div>
                <div class="message-body">{{ entry.content }}</div>
                <button v-if="entry.role === 'assistant' && !entry.adopted" class="adopt-link" @click="openPreview(entry)">预览并采纳 →</button>
                <span v-if="entry.adopted" class="adopted">✓ 已采纳</span>
              </div>
            </div>
            <div class="compose">
              <div class="compose-label">{{ modeHint.title }}</div>
              <textarea v-model="instruction" :placeholder="modeHint.placeholder" @keydown.ctrl.enter.prevent="send" @keydown.meta.enter.prevent="send" />
              <div class="compose-footer"><span>Ctrl + Enter 发送</span><button v-if="working" class="secondary" @click="stop">停止</button><button v-else class="primary" :disabled="!instruction.trim()" @click="send">生成内容 ↗</button></div>
              <p v-if="aiError" class="error" role="alert">{{ aiError }}</p>
            </div>
          </template>
          <template v-else>
            <div class="reference-head"><small>STORY BIBLE</small><strong>作品资料库</strong><p>写作时随手查看设定，让故事前后一致。</p></div>
            <div class="reference-categories" role="group" aria-label="作品资料分类">
              <button v-for="category in loreCategories.slice(1)" :key="category.id" type="button" :class="{ active: loreCategory === category.id }" @click="loreCategory = category.id">
                <span class="category-symbol">{{ category.symbol }}</span><span>{{ category.label }}</span><b>{{ loreCount(category.id) }}</b>
              </button>
            </div>
            <div class="reference-list-head"><strong>{{ loreCategory === 'all' ? '全部资料' : loreLabel(loreCategory) }}</strong><button type="button" @click="loreCategory = 'all'">查看全部</button></div>
            <div class="reference-list">
              <p v-if="!visibleLore.length" class="reference-empty">这一类还没有内容。可以手动添加，也可以先让 AI 帮你构思。</p>
              <article v-for="item in visibleLore" :key="item.id" class="reference-card">
                <div class="reference-card-top"><span>{{ loreLabel(item.mode) }}</span><small v-if="item.timeLabel">{{ item.timeLabel }}</small></div>
                <h3>{{ item.title || '未命名条目' }}</h3><p>{{ item.content || '还没有填写内容。' }}</p>
                <button type="button" @click="openLoreLibrary(item.mode, item.id)">查看与编辑 →</button>
              </article>
            </div>
            <div class="reference-footer"><button class="primary" type="button" @click="addLore(loreCategory === 'all' ? 'world' : loreCategory)">＋ 新增{{ loreCategory === 'all' ? '资料' : loreLabel(loreCategory) }}</button><button class="secondary" type="button" @click="openLoreLibrary(loreCategory)">集中管理</button></div>
          </template>
        </aside>
      </template>

      <main v-else class="welcome">
        <div class="welcome-symbol">✦</div>
        <h1>写下一个值得继续的故事</h1>
        <p>先建立作品，再进入专注的写作空间。AI 可以写正文、补设定、塑造人物和规划后续剧情。</p>
        <button class="primary large" @click="addBook">创建第一本书</button>
        <div class="welcome-cards">
          <button type="button" @click="addBook"><span>01</span><strong>开启新连载</strong><small>从书名和一句灵感开始</small></button>
          <button type="button" @click="importInput?.click()"><span>02</span><strong>导入已有作品</strong><small>继续写你的旧故事</small></button>
          <button type="button" @click="showModel = true"><span>03</span><strong>设置创作助手</strong><small>连接你自己的模型</small></button>
        </div>
      </main>
    </div>

    <div v-if="showCreateBook" class="overlay" @click.self="showCreateBook = false">
      <section class="modal create-modal" role="dialog" aria-modal="true" aria-label="创建作品">
        <div class="modal-head"><div><small>新的连载，从这里开始</small><h2>创建作品</h2></div><button class="icon-button" aria-label="关闭" @click="showCreateBook = false">×</button></div>
        <p class="modal-note">先给故事一个名字。灵感可以只写一句，随时能在写作页继续完善。</p>
        <label>作品名称<input v-model="newBookTitle" maxlength="60" autofocus placeholder="例如：夜行者档案" @keydown.enter.prevent="createAndOpenBook" /></label>
        <label>一句话灵感<span class="optional">可稍后填写</span><textarea v-model="newBookPremise" class="modal-textarea" maxlength="1000" placeholder="主角想要什么？谁在阻止他？" /></label>
        <div class="modal-actions"><button class="secondary" @click="showCreateBook = false">再想想</button><button class="primary" :disabled="!newBookTitle.trim()" @click="createAndOpenBook">创建并开始写作</button></div>
      </section>
    </div>

    <div v-if="showModel" class="overlay" @click.self="showModel = false"><section class="modal settings-modal" role="dialog" aria-modal="true" aria-label="模型设置">
      <div class="modal-head"><div><small>创作助手</small><h2>模型设置</h2></div><button class="icon-button" aria-label="关闭" @click="showModel = false">×</button></div>
      <p class="modal-note">填写兼容 Chat Completions 的接口。地址和密钥只保存在当前浏览器中；浏览器直连需要服务商允许跨域请求。</p>
      <button class="agnes-preset" type="button" @click="useAgnesPreset">使用 Agnes 3.0 Flash 官方接口预设 →</button>
      <label>API 地址<input v-model.trim="data.model.baseUrl" placeholder="例如：https://apihub.agnes-ai.com/v1" /></label><label>模型 ID<input v-model.trim="data.model.model" placeholder="例如：agnes-3.0-flash" /></label><label>API Key<input v-model="data.model.apiKey" type="password" autocomplete="off" placeholder="填写服务商提供的 API Key" /></label>
      <p v-if="modelTestStatus" class="model-test-status" role="status">{{ modelTestStatus }}</p>
      <div class="modal-actions"><button class="secondary" :disabled="testingModel" @click="testModelConnection">{{ testingModel ? '正在测试…' : '测试连接' }}</button><button class="primary" @click="showModel = false">保存设置</button></div>
    </section></div>

    <div v-if="showPremise && book" class="overlay" @click.self="showPremise = false"><section class="modal" role="dialog" aria-modal="true" aria-label="故事概念"><div class="modal-head"><div><small>作品底稿</small><h2>故事概念</h2></div><button class="icon-button" aria-label="关闭" @click="showPremise = false">×</button></div><p class="modal-note">写下核心冲突、人物目标或一句话梗概。创作助手会把它纳入上下文。</p><textarea v-model="book.premise" class="modal-textarea" placeholder="例如：一个不愿成为英雄的人，被迫继承了会吞噬记忆的王国。" /><div class="modal-actions"><button class="primary" @click="showPremise = false">完成</button></div></section></div>

    <div v-if="selectionSuggestion" class="overlay" @click.self="selectionSuggestion = null">
      <section class="modal preview-modal" role="dialog" aria-modal="true" aria-label="AI 选区修改建议">
        <div class="modal-head"><div><small>选区修改 · 可先调整</small><h2>{{ selectionSuggestion.label }}建议</h2></div><button class="icon-button" aria-label="关闭" @click="selectionSuggestion = null">×</button></div>
        <p class="modal-note">采纳后只会替换选中的文字，原稿会先存入版本历史。可以直接修改下方文本再采纳。</p>
        <TextDiff :before="selectionSuggestion.original" :after="selectionSuggestion.replacement" before-label="原文" after-label="建议" />
        <label class="selection-suggestion-edit">修改后文字<textarea v-model="selectionSuggestion.replacement" class="preview-textarea" aria-label="可编辑的修改后文字" /></label>
        <div class="modal-actions"><button class="secondary" @click="selectionSuggestion = null">暂不采纳</button><button class="primary" :disabled="!selectionSuggestion.replacement.trim()" @click="adoptSelectionSuggestion">采纳这段修改 →</button></div>
      </section>
    </div>

    <div v-if="toastMessage" class="toast" role="status">{{ toastMessage }}</div>

    <div v-if="showBackup" class="overlay" @click.self="showBackup = false">
      <section class="modal backup-modal" role="dialog" aria-modal="true" aria-label="备份与导出">
        <div class="modal-head"><div><small>本机数据</small><h2>备份与导出</h2></div><button class="icon-button" aria-label="关闭" @click="showBackup = false">×</button></div>
        <h3 class="backup-title">全量备份</h3>
        <p class="modal-note">备份包含全部作品、章节、设定、灵感、建书记录、写作统计，以及扫榜快照和竞品拆书库，可在更换设备或清理浏览器后完整恢复。备份文件里也会写入当前模型密钥，请只保存在自己信任的地方。</p>
        <p class="backup-summary">当前共有 <strong>{{ data.books.length }}</strong> 部作品 · <strong>{{ backupChapterCount }}</strong> 章 · <strong>{{ data.notes.length }}</strong> 条灵感 · <strong>{{ workflowRecordCount }}</strong> 条建书记录</p>
        <div class="modal-actions">
          <button class="primary" @click="exportWorkspaceBackup">下载全量备份</button>
          <button class="secondary" @click="backupInput?.click()">选择备份文件恢复</button>
          <input ref="backupInput" type="file" accept=".json,application/json" hidden @change="handleBackupImport" />
        </div>
        <div class="backup-modes" role="radiogroup" aria-label="恢复方式">
          <label><input v-model="backupMode" type="radio" value="merge" /><span><strong>合并恢复</strong><small>保留当前数据，只添加备份里没有的作品、灵感、建书记录与扫榜快照；统计按天取较大值。</small></span></label>
          <label><input v-model="backupMode" type="radio" value="overwrite" /><span><strong>覆盖恢复</strong><small>清空当前全部数据，完全改用备份内容，包括模型设置、扫榜快照与拆书库。</small></span></label>
        </div>
        <p v-if="backupNotice" class="backup-notice" role="status">{{ backupNotice }}</p>
        <h3 class="backup-title">导出阅读稿</h3>
        <p class="modal-note">把正文导出为 TXT 文本，方便打印、存档或用其他阅读软件打开。</p>
        <div class="modal-actions">
          <button class="secondary" :disabled="!book" @click="exportBookTxt">导出《{{ book?.title || '当前作品' }}》全部章节</button>
          <button class="secondary" :disabled="!chapter" @click="exportChapterTxt">导出当前章节</button>
        </div>
      </section>
    </div>

    <div v-if="showLore && book" class="overlay" @click.self="showLore = false">
      <section class="modal lore-modal" role="dialog" aria-modal="true" aria-label="作品资料库">
        <div class="modal-head"><div><small>故事资料</small><h2>作品资料库</h2></div><button class="icon-button" aria-label="关闭" @click="showLore = false">×</button></div>
        <p class="modal-note">世界观、人物、时间线和剧情都保存在当前作品中，AI 创作时会参考这些资料。</p>
        <div class="lore-tabs" role="group" aria-label="资料分类">
          <button v-for="category in loreCategories" :key="category.id" type="button" :class="{ active: loreCategory === category.id }" @click="loreCategory = category.id">{{ category.label }} <span>{{ loreCount(category.id) }}</span></button>
        </div>
        <div class="lore-actions">
          <button class="secondary" @click="addLore('world')">＋ 世界观</button>
          <button class="secondary" @click="addLore('character')">＋ 人物</button>
          <button class="secondary" @click="addLore('timeline')">＋ 时间节点</button>
          <button class="secondary" @click="addLore('plot')">＋ 剧情</button>
        </div>
        <div class="lore-list">
          <p v-if="!visibleLore.length" class="muted">这一类还没有资料。可以手动添加，也可以让创作助手生成后采纳。</p>
          <div v-for="item in visibleLore" :id="`lore-${item.id}`" :key="item.id" class="lore-card" :class="{ 'is-focused': focusedLoreId === item.id }">
            <div><span class="tag">{{ loreLabel(item.mode) }}</span><input v-model="item.title" aria-label="资料标题" placeholder="条目标题" /></div>
            <label v-if="item.mode === 'timeline'" class="timeline-label">故事内时间<input v-model="item.timeLabel" placeholder="例如：第一卷 · 第三天夜里" /></label>
            <textarea v-model="item.content" aria-label="资料内容" placeholder="写下规则、关系、事件或剧情细节" />
            <button class="text-danger" @click="removeLore(item.id)">删除</button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="showHistory && chapter" class="overlay" @click.self="showHistory = false">
      <section class="modal history-modal" role="dialog" aria-modal="true" aria-label="章节版本历史">
        <div class="modal-head"><div><small>每一步都留得住</small><h2>章节版本历史</h2></div><button class="icon-button" aria-label="关闭" @click="showHistory = false">×</button></div>
        <p class="modal-note">手动保存当前稿；AI 写入正文前也会自动保留一份。历史最多保留最近 30 个版本，并随作品一起导出。</p>
        <div class="history-toolbar"><strong>{{ chapter.title }}</strong><button class="primary" @click="saveCurrentVersion">保存当前版本</button></div>
        <p v-if="historyNotice" class="history-notice" role="status">{{ historyNotice }}</p>
        <div v-if="!chapter.history?.length" class="history-empty">还没有历史版本。先保存一次当前稿，之后就能在这里找回。</div>
        <div v-else class="history-layout">
          <div class="history-list" aria-label="版本列表">
            <button v-for="version in chapter.history" :key="version.id" type="button" :class="{ active: selectedVersionId === version.id }" @click="selectedVersionId = version.id">
              <span>{{ versionSourceLabel(version.source) }} <small>{{ countWords(version.content) }} 字</small></span>
              <time :datetime="version.savedAt">{{ formatVersionTime(version.savedAt) }}</time>
            </button>
          </div>
          <div v-if="selectedVersion" class="history-preview"><div class="history-preview-head"><strong>{{ selectedVersion.title }}</strong><div><span>{{ formatVersionTime(selectedVersion.savedAt) }}</span><button class="secondary" @click="historyDiff = !historyDiff">{{ historyDiff ? '查看历史全文' : '与当前稿对比' }}</button></div></div><TextDiff v-if="historyDiff" :before="selectedVersion.content" :after="chapter.content" before-label="历史版本" after-label="当前正文" /><textarea v-else :value="selectedVersion.content" readonly aria-label="历史版本正文" /><div class="history-preview-actions"><span>恢复前会先保存当前稿</span><button class="primary" @click="restoreVersion">恢复这个版本</button></div></div>
        </div>
      </section>
    </div>

    <div v-if="workflowCandidate" class="overlay" @click.self="workflowCandidate = null"><section class="modal preview-modal" role="dialog" aria-modal="true" aria-label="预览建书候选">
      <div class="modal-head"><div><small>候选稿 · 可先修改</small><h2>预览并采纳{{ workflowFieldLabel(workflowCandidate.field) }}</h2></div><button class="icon-button" aria-label="关闭" @click="workflowCandidate = null">×</button></div>
      <p class="modal-note">模型生成结果不会自动覆盖草稿。你可以直接修改下方文本，再决定是否采纳。</p><textarea v-model="workflowCandidate.text" class="preview-textarea" aria-label="建书候选内容" /><div class="modal-actions"><button class="secondary" @click="workflowCandidate = null">暂不采纳</button><button class="primary" :disabled="!workflowCandidate.text.trim()" @click="adoptWorkflowCandidate">采纳到草稿</button></div>
    </section></div>

    <div v-if="showNotePicker" class="overlay" @click.self="showNotePicker = false">
      <section class="modal preview-modal" role="dialog" aria-modal="true" aria-label="从灵感库选择">
        <div class="modal-head"><div><small>INSPIRATION</small><h2>从灵感库选择</h2></div><button class="icon-button" aria-label="关闭" @click="showNotePicker = false">×</button></div>
        <p class="modal-note">点击一条灵感填入原始灵感，之后仍可自由修改。</p>
        <input v-model="notePickerQuery" type="search" aria-label="搜索灵感" placeholder="搜索内容或标签" />
        <div class="note-picker-list">
          <button v-for="note in pickerNotes" :key="note.id" type="button" class="note-picker-item" @click="pickNoteForSeed(note.id)"><span>{{ note.content }}</span><small v-if="note.tags.length">{{ note.tags.map(tag => `#${tag}`).join(' ') }}</small></button>
          <p v-if="!pickerNotes.length" class="muted">灵感库是空的。可以先在「灵感收集」页记下一条。</p>
        </div>
      </section>
    </div>

    <div v-if="showBreakdownPicker" class="overlay" @click.self="showBreakdownPicker = false">
      <section class="modal preview-modal" role="dialog" aria-modal="true" aria-label="从拆书带入素材">
        <div class="modal-head"><div><small>BREAKDOWN</small><h2>{{ breakdownPickerStage === 'tweak' ? '微调后再带入' : `从拆书带入 · ${breakdownPickerFieldLabels[breakdownPickerField]}` }}</h2></div><button class="icon-button" aria-label="关闭" @click="showBreakdownPicker = false">×</button></div>
        <p class="modal-note">拆书库里按类型分开存放的素材。勾选要带进的类型，内容会追加到当前字段，之后仍可自由修改。</p>
        <p v-if="breakdownPickerNotice" class="workflow-history-notice" role="status">{{ breakdownPickerNotice }}</p>
        <div v-if="breakdownPickerStage === 'pick'" class="bd-picker-list">
          <article v-for="project in breakdownPickerProjects" :key="project.id" class="bd-picker-card">
            <header><h3>{{ project.title }}</h3><span>已拆 {{ project.chapters.filter(item => item.status === 'done').length }} 章 · 素材 {{ countBreakdownMaterials(project.materials) }} 条</span></header>
            <div class="bd-picker-kinds" role="group" :aria-label="`${project.title} 的素材类型`">
              <label v-for="kind in breakdownMaterialKinds" :key="kind" :class="{ disabled: !project.materials[kind].length }">
                <input type="checkbox" :checked="(breakdownPickerKinds[project.id] || []).includes(kind)" :disabled="!project.materials[kind].length" @change="toggleBreakdownKind(project.id, kind)" />
                {{ breakdownMaterialLabels[kind] }}<small>{{ project.materials[kind].length }}</small>
              </label>
            </div>
            <button class="primary" type="button" @click="prepareBreakdownMaterials(project.id)">带进{{ breakdownPickerFieldLabels[breakdownPickerField] }}</button>
          </article>
          <p v-if="!breakdownPickerProjects.length" class="muted">拆书库还是空的。先去「竞品拆书」页导入一本书，拆出素材后就能在这里按类型取用。</p>
        </div>
        <div v-else class="bd-picker-tweak">
          <p class="bd-picker-tweak-meta">带入{{ breakdownPickerFieldLabels[breakdownPickerField] }}：{{ breakdownDraftMeta }}</p>
          <textarea v-model="breakdownDraftText" class="preview-textarea" aria-label="待带入的素材内容，可自行修改" />
          <div class="modal-actions"><button class="secondary" type="button" @click="breakdownPickerStage = 'pick'">← 重新选择</button><button class="primary" type="button" :disabled="!breakdownDraftText.trim()" @click="confirmBreakdownMaterials">确认带入</button></div>
        </div>
      </section>
    </div>

    <div v-if="preview" class="overlay" @click.self="preview = null"><section class="modal preview-modal" role="dialog" aria-modal="true" aria-label="预览 AI 内容"><div class="modal-head"><div><small>先审阅，再落稿</small><h2>预览并采纳</h2></div><button class="icon-button" aria-label="关闭" @click="preview = null">×</button></div><p class="modal-note">你可以先修改生成内容。只有点击采纳，内容才会进入作品。</p><label v-if="preview.mode !== 'prose'">设定标题<input v-model="preview.title" placeholder="给这条设定起名" /></label><label v-else>写入位置<select v-model="preview.insert"><option value="append">追加到本章末尾</option><option value="replace">替换本章正文</option></select></label><textarea v-model="preview.content" class="preview-textarea" aria-label="生成内容" /><div class="modal-actions"><button class="secondary" @click="preview = null">暂不采纳</button><button class="primary" :disabled="!preview.content.trim()" @click="adoptPreview">采纳到作品</button></div></section></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { generateChapterProse, generateDraft, refineSelection, requestChatCompletion, type SelectionAction } from './ai'
import { BACKUP_SIZE_LIMIT, buildWorkspaceBackup, bookToTxt, chapterToTxt, mergeSideStores, mergeWorkflowRecords, mergeWorkspaceBackup, parseWorkspaceBackup, safeFileName, serializeWorkspaceBackup } from './backup'
import { designFixture } from './design-fixture'
import TextDiff from './TextDiff.vue'
import BreakdownView from './BreakdownView.vue'
import RankView from './RankView.vue'
import { breakdownMaterialKinds, breakdownMaterialLabels, countBreakdownMaterials, emptyStore as emptyBreakdownStore, formatBreakdownMaterials, loadBreakdownStore, saveBreakdownStore, type BreakdownMaterialKind, type BreakdownStore } from './breakdown'
import { emptyRankStore, loadRankStore, saveRankStore } from './rank'
import { FONT_SIZE_RANGE, loadEditorPrefs, saveEditorPrefs } from './prefs'
import { createBook, importBookJson, loadData, now, recordChapterVersion, releaseCorruptDataProtection, saveData, takeCorruptDataNotice, uid, type Book, type ChatEntry, type Chapter, type ChapterVersion, type InspirationNote, type LoreMode, type Mode } from './storage'
import { currentStreak, dateKey, DEFAULT_DAILY_GOAL, heatLevel, monthMatrix, pruneStatsBooks, recordWords, totalsFor, trendSeries } from './stats'
import { buildBookFromWorkflow, createWorkflowRecord, emptyWorkflow, exportWorkflowArchive, importWorkflowArchive, loadWorkflowArchive, MAX_WORKFLOW_RECORDS, parseChapterPlan, saveWorkflowArchive, workflowPrompt, type WorkflowArchive, type WorkflowDraft, type WorkflowField, type WorkflowRecord } from './workflow'
import { assertStorageFits, onQuotaWarning } from './quota'

const designPreview = import.meta.env.DEV && new URLSearchParams(location.search).has('ui-preview')
const data = ref(designPreview ? designFixture() : loadData())
/** 主数据损坏时原文已被 loadData 暂存到单独键，启动时把原因告诉用户，不再静默开一个空白工作台 */
const corruptDataNotice = designPreview ? null : takeCorruptDataNotice()
/** 备份恢复后自增，提醒拆书与扫榜两个自管存储的页面重新读盘 */
const dataEpoch = ref(0)
const importInput = ref<HTMLInputElement | null>(null)
const workflowImportInput = ref<HTMLInputElement | null>(null)
const previewPanel = designPreview ? new URLSearchParams(location.search).get('panel') : null
const screen = ref<'shelf' | 'editor' | 'workflow' | 'workflow-history' | 'production' | 'inspiration' | 'stats' | 'breakdown' | 'rank'>(previewPanel === 'workflow' ? 'workflow' : previewPanel === 'workflow-history' ? 'workflow-history' : previewPanel === 'production' || previewPanel === 'production-compare' ? 'production' : previewPanel === 'inspiration' ? 'inspiration' : previewPanel === 'stats' ? 'stats' : previewPanel === 'breakdown' ? 'breakdown' : previewPanel === 'rank' ? 'rank' : !data.value.books.length || previewPanel === 'shelf' ? 'shelf' : 'editor')
function designWorkflowArchive(): WorkflowArchive {
  const draft = createWorkflowRecord({ ...emptyWorkflow(), step: 2, title: '星门长夜', genre: '东方奇幻', seed: '每个人在成年那天都能看见自己的终局。', idea: '一个看不见终局的少年，被帝国认定为灾厄。他必须在三十天内找出预言失效的原因。', outline: '第1章｜看不见的终局｜成人礼上，主角的命盘一片空白\n第2章｜追捕令｜帝国使者抵达村庄' })
  draft.id = 'design-workflow-draft'
  draft.updatedAt = '2026-09-20T09:30:00.000Z'
  const completed = createWorkflowRecord({ ...emptyWorkflow(), step: 4, title: '夜行者档案', genre: '都市悬疑', idea: '林澈追查在所有人记忆中消失的妹妹。', outline: '第1章｜午夜之后｜第十三声钟响' })
  completed.id = 'design-workflow-completed'
  completed.status = 'completed'
  completed.bookId = 'design-book'
  completed.updatedAt = '2026-09-19T16:00:00.000Z'
  completed.completedAt = completed.updatedAt
  return { version: 2, activeId: draft.id, records: [draft, completed] }
}
/** 设计预览只显示样例存档；真实数据下启动时读回本机保存的建书记录，否则刷新后记录与备份都会丢。 */
const workflowArchive = ref<WorkflowArchive>(designPreview && ['workflow-history', 'backup'].includes(previewPanel || '') ? designWorkflowArchive() : designPreview ? { version: 2, activeId: null, records: [] } : loadWorkflowArchive())
const workflow = ref<WorkflowDraft>({ ...(workflowArchive.value.records.find(item => item.id === workflowArchive.value.activeId)?.draft || emptyWorkflow()) })
const workflowHistoryFilter = ref<'all' | 'draft' | 'completed'>('all')
const workflowHistoryFilters = [{ id: 'all', label: '全部' }, { id: 'draft', label: '未完成' }, { id: 'completed', label: '已建书' }] as const
const workflowHistoryError = ref('')
const workflowHistoryNotice = ref('')

// ---------------------------------------------------------------------------
// 拆书素材带入：建书各字段按类型取用拆书库里分开存放的素材
// ---------------------------------------------------------------------------

/** 设计预览不读用户拆书库，避免示例页串进真实数据 */
const breakdownStore = ref<BreakdownStore>(designPreview ? emptyBreakdownStore() : loadBreakdownStore())

type BreakdownPickerField = 'idea' | 'outline' | 'world' | 'characters'
const breakdownPickerFieldLabels: Record<BreakdownPickerField, string> = {
  idea: '可用创意',
  outline: '故事主线与章节规划',
  world: '世界观与规则',
  characters: '主要人物',
}
/** 每个字段默认带哪几类素材：节点和节奏管大纲，设定和人物管世界，技巧管创意 */
const breakdownPickerDefaults: Record<BreakdownPickerField, BreakdownMaterialKind[]> = {
  idea: ['technique'],
  outline: ['outline', 'rhythm'],
  world: ['setting'],
  characters: ['character'],
}
const showBreakdownPicker = ref(false)
const breakdownPickerField = ref<BreakdownPickerField>('idea')
const breakdownPickerKinds = ref<Record<string, BreakdownMaterialKind[]>>({})
const breakdownPickerNotice = ref('')
/** 选取器两步：先勾类型，再把排好的素材改到满意才带入字段 */
const breakdownPickerStage = ref<'pick' | 'tweak'>('pick')
/** 每本书暂存一份改过的素材文本，回上一步重选类型再回来不会丢；类型变了才重新生成 */
const breakdownDrafts = ref<Record<string, { kinds: string; text: string }>>({})
const breakdownDraftProjectId = ref('')
const breakdownDraftText = computed({
  get: () => breakdownDrafts.value[breakdownDraftProjectId.value]?.text || '',
  set: (value: string) => {
    const current = breakdownDrafts.value[breakdownDraftProjectId.value]
    if (!current) return
    breakdownDrafts.value = { ...breakdownDrafts.value, [breakdownDraftProjectId.value]: { ...current, text: value } }
  },
})
const breakdownDraftMeta = ref('')
const breakdownPickerProjects = computed(() => breakdownStore.value.projects.filter(item => countBreakdownMaterials(item.materials) > 0))

function openBreakdownPicker(field: BreakdownPickerField) {
  // 拆书库由拆书页自己写盘，打开选取器时重读一次，保证刚拆出来的素材就在眼前
  if (!designPreview) breakdownStore.value = loadBreakdownStore()
  breakdownPickerField.value = field
  breakdownPickerKinds.value = Object.fromEntries(breakdownPickerProjects.value.map(item => [item.id, [...breakdownPickerDefaults[field]]]))
  breakdownPickerNotice.value = ''
  breakdownPickerStage.value = 'pick'
  breakdownDrafts.value = {}
  breakdownDraftProjectId.value = ''
  showBreakdownPicker.value = true
}

function toggleBreakdownKind(projectId: string, kind: BreakdownMaterialKind) {
  const current = breakdownPickerKinds.value[projectId] || []
  breakdownPickerKinds.value = {
    ...breakdownPickerKinds.value,
    [projectId]: current.includes(kind) ? current.filter(item => item !== kind) : [...current, kind],
  }
}

/** 把选中类型排成文本，停在可编辑的微调步，由用户改完再确认带入 */
function prepareBreakdownMaterials(projectId: string) {
  const project = breakdownStore.value.projects.find(item => item.id === projectId)
  if (!project) return
  const kinds = (breakdownPickerKinds.value[projectId] || []).filter(kind => project.materials[kind].length)
  if (!kinds.length) { breakdownPickerNotice.value = '先勾选至少一类有素材的类型。'; return }
  const signature = kinds.join(',')
  const draft = breakdownDrafts.value[projectId]
  breakdownDraftProjectId.value = projectId
  breakdownDrafts.value = {
    ...breakdownDrafts.value,
    [projectId]: { kinds: signature, text: draft && draft.kinds === signature ? draft.text : formatBreakdownMaterials(project, kinds) },
  }
  breakdownDraftMeta.value = `《${project.title}》的${kinds.map(kind => breakdownMaterialLabels[kind]).join('、')}素材`
  breakdownPickerNotice.value = ''
  breakdownPickerStage.value = 'tweak'
}

function confirmBreakdownMaterials() {
  const text = breakdownDraftText.value.trim()
  if (!text) { breakdownPickerNotice.value = '内容已清空，没有可带入的素材。'; return }
  const field = breakdownPickerField.value
  const current = workflow.value[field].trim()
  workflow.value = { ...workflow.value, [field]: current ? `${current}\n\n${text}` : text }
  breakdownPickerNotice.value = `已把微调后的${breakdownDraftMeta.value}带进${breakdownPickerFieldLabels[field]}。`
  showBreakdownPicker.value = false
}

const workflowRecords = computed(() => [...workflowArchive.value.records].filter(item => workflowHistoryFilter.value === 'all' || item.status === workflowHistoryFilter.value).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const workflowRecordCount = computed(() => workflowArchive.value.records.length)
const workflowRecordTitle = (record: WorkflowRecord) => record.draft.title.trim() || record.draft.idea.trim().slice(0, 24) || record.draft.seed.trim().slice(0, 24) || '未命名草稿'
const workflowSteps = [
  { step: 1, label: '创作方向', title: '让灵感有一个抓手', description: '先确定类型、读者和故事的核心冲突。' },
  { step: 2, label: '故事骨架', title: '从创意走到章节', description: '定下书名、主线与前几章的具体推进。' },
  { step: 3, label: '人物世界', title: '让设定支撑情节', description: '补齐世界规则、人物行动和关键事件顺序。' },
  { step: 4, label: '确认建书', title: '检查后开始写作', description: '确认作品资料与章节目录，再创建新书。' },
] as const
const workflowChapters = computed(() => parseChapterPlan(workflow.value.outline))
const workflowLoreCount = computed(() => [workflow.value.genre || workflow.value.audience || workflow.value.tone, workflow.value.outline, workflow.value.world, workflow.value.characters, workflow.value.timeline].filter(value => value.trim()).length)
const workflowBusy = ref(false)
const workflowError = ref('')
const workflowSaveStatus = ref('草稿已保存在本机')
const workflowCandidate = ref<{ field: WorkflowField; text: string } | null>(null)
const workflowFieldLabel = (field: WorkflowField) => ({ idea: '创意', title: '书名', outline: '大纲', world: '世界观', characters: '人物', timeline: '时间线' })[field]
let workflowController: AbortController | null = null
let workflowSaveTimer: ReturnType<typeof setTimeout> | null = null
const shelfQuery = ref('')
const shelfSort = ref<'recent' | 'title'>('recent')
const selectedBookId = ref(data.value.books[0]?.id || '')
const selectedChapterId = ref(data.value.books[0]?.chapters[0]?.id || '')
if (designPreview && ['production', 'production-compare'].includes(previewPanel || '')) selectedChapterId.value = data.value.books[0]?.chapters[1]?.id || selectedChapterId.value
const book = computed(() => data.value.books.find(item => item.id === selectedBookId.value))
const chapter = computed(() => book.value?.chapters.find(item => item.id === selectedChapterId.value))
const bookWords = computed(() => book.value?.chapters.reduce((sum, item) => sum + countWords(item.content), 0) || 0)
const productionDoneCount = computed(() => book.value?.chapters.filter(item => item.content.trim()).length || 0)
const productionCandidateCount = computed(() => book.value?.chapters.reduce((sum, item) => sum + (item.proseCandidates?.length || 0), 0) || 0)
const nextUnwrittenChapter = computed(() => book.value?.chapters.find(item => !item.content.trim() && !item.proseCandidates?.length) || null)
const productionLength = ref(1500)
const productionInstruction = ref('')
const productionKind = ref<'continue' | 'rewrite'>(chapter.value?.content.trim() ? 'continue' : 'rewrite')
const productionInsert = ref<'append' | 'replace'>(chapter.value?.content.trim() ? 'append' : 'replace')
const selectedCandidateId = ref('')
const selectedProseCandidate = computed(() => chapter.value?.proseCandidates?.find(item => item.id === selectedCandidateId.value) || chapter.value?.proseCandidates?.[0])
const compareProduction = ref(designPreview && previewPanel === 'production-compare')
const productionBusy = ref(false)
const productionError = ref('')
let productionController: AbortController | null = null
const countBookWords = (item: Book) => item.chapters.reduce((sum, part) => sum + countWords(part.content), 0)
const latestChapter = (item: Book) => [...item.chapters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
const latestUpdate = (item: Book) => [item.updatedAt, ...item.chapters.map(part => part.updatedAt)].sort().at(-1) || item.updatedAt
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
const shelfChapterCount = computed(() => data.value.books.reduce((sum, item) => sum + item.chapters.length, 0))
const shelfWordCount = computed(() => data.value.books.reduce((sum, item) => sum + countBookWords(item), 0))
const shelfBooks = computed(() => {
  const query = shelfQuery.value.trim().toLocaleLowerCase()
  const items = data.value.books.filter(item => !query || `${item.title} ${item.premise}`.toLocaleLowerCase().includes(query))
  return [...items].sort((a, b) => shelfSort.value === 'title' ? a.title.localeCompare(b.title, 'zh-CN') : latestUpdate(b).localeCompare(latestUpdate(a)))
})
const showHistory = ref(designPreview && previewPanel === 'history-diff')
const selectedVersionId = ref(designPreview && previewPanel === 'history-diff' ? data.value.books[0]?.chapters[0]?.history?.[0]?.id || '' : '')
const historyDiff = ref(designPreview && previewPanel === 'history-diff')
const historyNotice = ref('')
const showBackup = ref(designPreview && previewPanel === 'backup')
const backupMode = ref<'merge' | 'overwrite'>('merge')
const backupNotice = ref('')
const backupInput = ref<HTMLInputElement | null>(null)
const backupChapterCount = computed(() => data.value.books.reduce((sum, item) => sum + item.chapters.length, 0))
const topMenuOpen = ref(false)
const selectedVersion = computed(() => chapter.value?.history?.find(item => item.id === selectedVersionId.value))
const versionSourceLabel = (source: ChapterVersion['source']) => ({ manual: '手动留存', ai: 'AI 写入前', restore: '恢复前备份' })[source]
const formatVersionTime = (value: string) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
type LoreCategory = LoreMode | 'all'
const sideView = ref<'ai' | 'reference'>(designPreview && new URLSearchParams(location.search).get('panel') === 'reference' ? 'reference' : 'ai')
const loreCategory = ref<LoreCategory>('all')
const focusedLoreId = ref('')
const loreCategories: { id: LoreCategory; label: string; symbol: string }[] = [
  { id: 'all', label: '全部', symbol: '▤' },
  { id: 'world', label: '世界观', symbol: '◈' },
  { id: 'character', label: '人物设定', symbol: '♙' },
  { id: 'timeline', label: '时间线', symbol: '◷' },
  { id: 'plot', label: '剧情规划', symbol: '◇' },
]
const loreLabel = (category: LoreCategory) => loreCategories.find(item => item.id === category)?.label || '作品资料'
const loreCount = (category: LoreCategory) => category === 'all' ? (book.value?.lore.length || 0) : (book.value?.lore.filter(item => item.mode === category).length || 0)
const visibleLore = computed(() => loreCategory.value === 'all' ? (book.value?.lore || []) : (book.value?.lore.filter(item => item.mode === loreCategory.value) || []))
const mode = ref<Mode>('prose')
const modes: { id: Mode; label: string; title: string; description: string; placeholder: string }[] = [
  { id: 'prose', label: '写正文', title: '直接写正文', description: '给我场景目标、人物和冲突。我会写成可预览、可采纳的小说正文。', placeholder: '例如：写主角第一次进入禁城，发现城里所有人都忘了自己的名字。约 800 字。' },
  { id: 'world', label: '世界观', title: '完善世界观', description: '补全世界规则、限制和代价，采纳后进入设定库。', placeholder: '例如：完善记忆交易的规则、代价和漏洞。' },
  { id: 'character', label: '塑人物', title: '完善人物', description: '让人物拥有目标、弱点、关系和成长空间。', placeholder: '例如：设计女主角的欲望、秘密和她与主角的冲突。' },
  { id: 'plot', label: '推剧情', title: '规划后续剧情', description: '给出具体行动与转折，可采纳到剧情设定。', placeholder: '例如：主角发现真相后，未来三章如何推进？' },
]
const modeHint = computed(() => modes.find(item => item.id === mode.value) || modes[0])
const modeLabel = (value: Mode) => modes.find(item => item.id === value)?.label || value
const countWords = (text: string) => [...(text || '').replace(/\s/g, '')].length

// —— 灵感收集 ——
const noteDraft = ref('')
const noteTagDraft = ref('')
const noteQuery = ref('')
const noteTagFilter = ref('')
const editingNoteId = ref('')
const notesError = ref('')
const showNotePicker = ref(false)
const notePickerQuery = ref('')
const noteTagList = computed(() => [...new Set(data.value.notes.flatMap(item => item.tags))].slice(0, 24))
const filteredNotes = computed(() => {
  const query = noteQuery.value.trim().toLocaleLowerCase()
  return data.value.notes
    .filter(item => (!noteTagFilter.value || item.tags.includes(noteTagFilter.value)) &&
      (!query || item.content.toLocaleLowerCase().includes(query) || item.tags.some(tag => tag.toLocaleLowerCase().includes(query))))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
})
const pickerNotes = computed(() => {
  const query = notePickerQuery.value.trim().toLocaleLowerCase()
  return data.value.notes
    .filter(item => !query || item.content.toLocaleLowerCase().includes(query) || item.tags.some(tag => tag.toLocaleLowerCase().includes(query)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
})
function parseNoteTags(text: string): string[] {
  return [...new Set(text.split(/[,，、;；\s#]+/).map(tag => tag.trim()).filter(Boolean))].slice(0, 8).map(tag => tag.slice(0, 20))
}
function saveNote() {
  const content = noteDraft.value.trim()
  if (!content) return
  const tags = parseNoteTags(noteTagDraft.value)
  const timestamp = now()
  if (editingNoteId.value) {
    const note = data.value.notes.find(item => item.id === editingNoteId.value)
    if (!note) { notesError.value = '要编辑的灵感已不存在，已退出编辑。'; cancelEditNote(); return }
    note.content = content
    note.tags = tags
    note.updatedAt = timestamp
  } else {
    data.value.notes.unshift({ id: uid(), content, tags, pinned: false, createdAt: timestamp, updatedAt: timestamp })
  }
  noteDraft.value = ''
  noteTagDraft.value = ''
  editingNoteId.value = ''
  notesError.value = ''
}
function startEditNote(note: InspirationNote) {
  editingNoteId.value = note.id
  noteDraft.value = note.content
  noteTagDraft.value = note.tags.join('，')
  notesError.value = ''
}
function cancelEditNote() { editingNoteId.value = ''; noteDraft.value = ''; noteTagDraft.value = '' }
function toggleNotePin(id: string) {
  const note = data.value.notes.find(item => item.id === id)
  if (note) { note.pinned = !note.pinned; note.updatedAt = now() }
}
function removeNote(id: string) {
  if (!confirm('删除这条灵感？此操作无法撤销。')) return
  data.value.notes = data.value.notes.filter(item => item.id !== id)
  if (editingNoteId.value === id) cancelEditNote()
}
function sendNoteToWorkflow(id: string) {
  const note = data.value.notes.find(item => item.id === id)
  if (!note) return
  startNewWorkflow()
  workflow.value.seed = note.content
  workflow.value.step = 1
  workflowError.value = ''
}
function openNotePicker() { notePickerQuery.value = ''; showNotePicker.value = true }
function pickNoteForSeed(id: string) {
  const note = data.value.notes.find(item => item.id === id)
  if (!note) return
  workflow.value.seed = note.content
  showNotePicker.value = false
}
function openInspiration() { screen.value = 'inspiration' }

// —— 写作统计 ——
const statsSpanOptions = [7, 15, 30] as const
const statsSpan = ref<number>(7)
const statsBookFilter = ref('')
const statsMonth = ref({ year: new Date().getFullYear(), month: new Date().getMonth() })
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
const statsFilter = computed(() => statsBookFilter.value || undefined)
const todayStats = computed(() => trendSeries(data.value.stats.days, new Date(), 1, statsFilter.value)[0])
const statsTrend = computed(() => trendSeries(data.value.stats.days, new Date(), statsSpan.value, statsFilter.value))
const statsTrendMax = computed(() => Math.max(500, ...statsTrend.value.map(point => point.total)))
const barHeight = (value: number) => Math.round((value / statsTrendMax.value) * 100)
const statsStreak = computed(() => currentStreak(data.value.stats.days, new Date(), statsFilter.value))
const statsTotals = computed(() => totalsFor(data.value.stats.days, statsFilter.value))
const statsAiShare = computed(() => statsTotals.value.total ? Math.round((statsTotals.value.ai / statsTotals.value.total) * 100) : 0)
const goalPercent = computed(() => Math.min(100, Math.round((todayStats.value.total / data.value.stats.dailyGoal) * 100)))
const calendarCells = computed(() => monthMatrix(data.value.stats.days, statsMonth.value.year, statsMonth.value.month, new Date(), statsFilter.value).flat())
const calendarTitle = computed(() => `${statsMonth.value.year} 年 ${statsMonth.value.month + 1} 月`)
function shiftStatsMonth(delta: number) {
  const cursor = new Date(statsMonth.value.year, statsMonth.value.month + delta, 1)
  statsMonth.value = { year: cursor.getFullYear(), month: cursor.getMonth() }
}
function saveStatsGoal() {
  const goal = Math.round(Number(data.value.stats.dailyGoal))
  data.value.stats.dailyGoal = Number.isFinite(goal) ? Math.min(100000, Math.max(100, goal)) : DEFAULT_DAILY_GOAL
}
function openStats() { screen.value = 'stats' }
function recordWordDelta(source: 'manual' | 'ai', bookId: string, chars: number) {
  if (chars > 0) recordWords(data.value.stats, { date: dateKey(new Date()), bookId, source, chars })
}
/** 记录每章已统计的正文字数，手写增量在 touchChapter 中按差值记账。 */
const chapterLengths = new Map<string, number>()
function rememberChapterLength() {
  if (chapter.value) chapterLengths.set(chapter.value.id, countWords(chapter.value.content))
}
watch(selectedChapterId, rememberChapterLength)

// —— 编辑器增强：查找替换、字数目标、专注模式、字号、划词修改 ——
const manuscriptEl = ref<HTMLTextAreaElement | null>(null)
const editorPrefs = ref(loadEditorPrefs())
/** 触屏上正文字号低于 16px 时，聚焦输入框会触发系统缩放，这里抬高下限。 */
const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
const manuscriptFontSize = computed(() => Math.max(editorPrefs.value.fontSize, coarsePointer ? 16 : 0))
const focusMode = ref(false)
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(message: string) {
  toastMessage.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 2400)
}
/** 任何一次存储写失败都弹一次 toast：配额满时不再静默丢数据，也不再把英文异常抛给用户 */
onQuotaWarning(showToast)
function changeFontSize(delta: number) {
  editorPrefs.value.fontSize = Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, editorPrefs.value.fontSize + delta * FONT_SIZE_RANGE.step))
  try { saveEditorPrefs(editorPrefs.value) }
  catch { /* 配额告警已由 writeStorage 弹出，这里只保证点击处理器不被异常打断 */ }
}
function toggleFocusMode() { focusMode.value = !focusMode.value }

const goalEditing = ref(false)
const goalDraft = ref(0)
const chapterWordGoal = computed(() => chapter.value?.wordGoal || 0)
const chapterGoalPercent = computed(() => chapterWordGoal.value ? Math.min(100, Math.round((countWords(chapter.value?.content || '') / chapterWordGoal.value) * 100)) : 0)
watch(selectedChapterId, () => { goalEditing.value = false; goalDraft.value = chapter.value?.wordGoal || 0; selectionBubble.value = null; selectionSuggestion.value = null })
function toggleGoalEditor() { goalDraft.value = chapter.value?.wordGoal || 0; goalEditing.value = !goalEditing.value }
function saveChapterGoal() {
  if (!chapter.value) return
  const goal = Math.round(Number(goalDraft.value))
  chapter.value.wordGoal = Number.isFinite(goal) && goal > 0 ? Math.min(1000000, goal) : undefined
  goalEditing.value = false
  touchChapter()
  showToast(chapter.value.wordGoal ? `本章目标设为 ${chapter.value.wordGoal} 字` : '已清除本章目标')
}
function clearChapterGoal() {
  if (!chapter.value) return
  chapter.value.wordGoal = undefined
  goalEditing.value = false
  touchChapter()
  showToast('已清除本章目标')
}

const findOpen = ref(false)
const findQuery = ref('')
const replaceQuery = ref('')
const findCaseSensitive = ref(false)
const findIndex = ref(0)
const findMatches = ref<{ start: number; end: number }[]>([])
function escapeRegExp(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
watch([findQuery, findCaseSensitive, () => chapter.value?.content], () => {
  const query = findQuery.value
  if (!query || !chapter.value) { findMatches.value = []; findIndex.value = 0; return }
  const regex = new RegExp(escapeRegExp(query), findCaseSensitive.value ? 'g' : 'gi')
  const matches: { start: number; end: number }[] = []
  // 不设匹配数上限：「全部替换」必须覆盖整章，截断列表会让高频词替换静默漏掉后半章
  let hit = regex.exec(chapter.value.content)
  while (hit) {
    matches.push({ start: hit.index, end: hit.index + hit[0].length })
    if (hit[0].length === 0) regex.lastIndex++
    hit = regex.exec(chapter.value.content)
  }
  findMatches.value = matches
  if (findIndex.value >= matches.length) findIndex.value = 0
})
const findStatusText = computed(() => {
  if (!findQuery.value.trim()) return '输入要查找的内容'
  if (!findMatches.value.length) return '没有匹配'
  return `第 ${findIndex.value + 1} / ${findMatches.value.length} 处`
})
function selectMatch(index: number) {
  const match = findMatches.value[index]
  const element = manuscriptEl.value
  if (!match || !element || !chapter.value) return
  findIndex.value = index
  element.focus({ preventScroll: true })
  element.setSelectionRange(match.start, match.end)
  const lines = chapter.value.content.slice(0, match.start).split('\n').length - 1
  const totalLines = Math.max(1, chapter.value.content.split('\n').length)
  element.scrollTop = Math.max(0, Math.round((element.scrollHeight - element.clientHeight) * (lines / totalLines)))
}
function nextMatch() { if (findMatches.value.length) selectMatch((findIndex.value + 1) % findMatches.value.length) }
function prevMatch() { if (findMatches.value.length) selectMatch((findIndex.value - 1 + findMatches.value.length) % findMatches.value.length) }
function openFind() {
  findOpen.value = true
  void nextTick(() => document.querySelector<HTMLInputElement>('.find-bar .find-input')?.focus())
}
function closeFind() { findOpen.value = false; findQuery.value = ''; replaceQuery.value = ''; findMatches.value = []; findIndex.value = 0 }
function replaceCurrentMatch() {
  const match = findMatches.value[findIndex.value]
  if (!chapter.value || !match) return
  chapter.value.content = chapter.value.content.slice(0, match.start) + replaceQuery.value + chapter.value.content.slice(match.end)
  touchChapter()
  void nextTick(() => {
    // 跳过与刚写入的替换结果重叠的匹配：替换文本含查找词时光标才不会原地卡住
    const after = match.start + replaceQuery.value.length
    const index = findMatches.value.findIndex(item => item.start >= after)
    if (findMatches.value.length) selectMatch(index === -1 ? 0 : index)
  })
}
function replaceAllMatches() {
  if (!chapter.value || !findMatches.value.length) return
  const count = findMatches.value.length
  if (!confirm(`将本章 ${count} 处「${findQuery.value}」替换为「${replaceQuery.value || '（空）'}」？`)) return
  let content = chapter.value.content
  for (let index = count - 1; index >= 0; index--) {
    const match = findMatches.value[index]
    content = content.slice(0, match.start) + replaceQuery.value + content.slice(match.end)
  }
  chapter.value.content = content
  touchChapter()
  findIndex.value = 0
  showToast(`已替换 ${count} 处`)
}

const selectionActions: { id: SelectionAction; label: string }[] = [
  { id: 'polish', label: '润色' },
  { id: 'expand', label: '扩写' },
  { id: 'proofread', label: '纠错' },
  { id: 'custom', label: '自定义' },
]
const selectionBubble = ref<{ top: number; left: number; start: number; end: number; text: string } | null>(null)
const selectionCustomOpen = ref(false)
const selectionInstruction = ref('')
const selectionBusy = ref(false)
const selectionSuggestion = ref<{ bookId: string; chapterId: string; start: number; end: number; original: string; replacement: string; label: string } | null>(null)
let selectionController: AbortController | null = null
/** 用镜像元素测量选区在正文区的像素位置，让气泡贴近选中的文字。 */
function selectionMirrorPosition(element: HTMLTextAreaElement, start: number, end: number): { top: number; left: number } | null {
  const mirror = document.createElement('div')
  const style = getComputedStyle(element)
  for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'padding', 'border', 'width', 'boxSizing', 'whiteSpace', 'overflowWrap', 'wordBreak'] as const) {
    mirror.style[key] = style[key] as string
  }
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.textContent = element.value.slice(0, start)
  const marker = document.createElement('span')
  marker.textContent = element.value.slice(start, end) || '.'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const mirrorRect = mirror.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  document.body.removeChild(mirror)
  const paper = element.closest('.paper')?.getBoundingClientRect()
  if (!paper) return null
  return {
    top: Math.max(4, markerRect.top - mirrorRect.top + (elementRect.top - paper.top) - 46),
    left: Math.min(paper.width - 40, Math.max(4, markerRect.left - mirrorRect.left + (elementRect.left - paper.left))),
  }
}
function updateSelectionBubble() {
  const element = manuscriptEl.value
  if (!element || screen.value !== 'editor' || !chapter.value) { selectionBubble.value = null; return }
  const start = element.selectionStart
  const end = element.selectionEnd
  if (start === end || selectionBusy.value) { selectionBubble.value = null; return }
  const position = selectionMirrorPosition(element, start, end)
  if (!position) { selectionBubble.value = null; return }
  selectionBubble.value = { ...position, start, end, text: element.value.slice(start, end) }
}
async function runSelectionAction(action: SelectionAction) {
  const bubble = selectionBubble.value
  if (!bubble || !book.value || !chapter.value || selectionBusy.value) return
  const instruction = action === 'custom' ? selectionInstruction.value.trim() : ''
  if (action === 'custom' && !instruction) { showToast('先写下想怎么改'); return }
  selectionBusy.value = true
  const requestController = new AbortController()
  selectionController = requestController
  try {
    const replacement = await refineSelection({ model: data.value.model, book: book.value, chapterId: chapter.value.id, action, text: bubble.text, instruction, signal: requestController.signal })
    if (requestController.signal.aborted) return
    selectionSuggestion.value = { bookId: book.value.id, chapterId: chapter.value.id, start: bubble.start, end: bubble.end, original: bubble.text, replacement, label: selectionActions.find(item => item.id === action)?.label || 'AI' }
    selectionBubble.value = null
    selectionCustomOpen.value = false
    selectionInstruction.value = ''
  } catch (error) { if (!requestController.signal.aborted) showToast(error instanceof Error ? error.message : String(error)) }
  finally { if (selectionController === requestController) { selectionBusy.value = false; selectionController = null } }
}
function adoptSelectionSuggestion() {
  const suggestion = selectionSuggestion.value
  if (!suggestion || !chapter.value || !book.value) return
  const content = chapter.value.content
  if (content.slice(suggestion.start, suggestion.end) !== suggestion.original) {
    showToast('正文已发生变化，请重新生成或手动修改。')
    return
  }
  const replacement = suggestion.replacement
  if (!replacement.trim()) return
  const previous = content.slice(0, suggestion.start) + suggestion.original + content.slice(suggestion.end)
  recordChapterVersion(chapter.value, 'ai')
  chapter.value.content = content.slice(0, suggestion.start) + replacement + content.slice(suggestion.end)
  recordWordDelta('ai', book.value.id, countWords(chapter.value.content) - countWords(previous))
  chapterLengths.set(chapter.value.id, countWords(chapter.value.content))
  touchChapter()
  selectionSuggestion.value = null
  showToast('已应用这段修改')
}

function handleEditorShortcuts(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (topMenuOpen.value) { topMenuOpen.value = false; return }
    if (findOpen.value) { closeFind(); return }
    if (focusMode.value) { focusMode.value = false; return }
  }
  if (screen.value !== 'editor' || !chapter.value) return
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 's') {
    event.preventDefault()
    saveCurrentVersion()
    showToast('已保存当前版本')
  }
  if ((event.ctrlKey || event.metaKey) && key === 'f') {
    event.preventDefault()
    openFind()
  }
}
const instruction = ref('')
const showCreateBook = ref(false)
const newBookTitle = ref('')
const newBookPremise = ref('')
const showModel = ref(false)
const testingModel = ref(false)
const modelTestStatus = ref('')
const showPremise = ref(false)
const showLore = ref(false)
const aiError = ref('')
const working = ref(false)
const saveStatus = ref(designPreview ? '设计预览 · 不保存' : '已保存在本机')
const preview = ref<{ bookId: string; entryId: string; mode: Mode; content: string; title: string; insert: 'append' | 'replace'; chapterId: string } | null>(
  designPreview && new URLSearchParams(location.search).get('panel') === 'preview'
    ? { bookId: 'design-book', entryId: 'design-ai', mode: 'prose', content: data.value.books[0]?.chat.find(item => item.id === 'design-ai')?.content || '', title: '', insert: 'append', chapterId: 'design-chapter-1' }
    : null
)
let controller: AbortController | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(data, () => {
  if (designPreview) return
  saveStatus.value = '正在保存…'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { saveData(data.value); saveStatus.value = '已保存在本机' }
    catch { saveStatus.value = '保存失败：请检查浏览器存储空间' }
  }, 350)
}, { deep: true })

watch(workflow, () => {
  if (designPreview || screen.value !== 'workflow') return
  workflowSaveStatus.value = '正在保存草稿…'
  if (workflowSaveTimer) clearTimeout(workflowSaveTimer)
  workflowSaveTimer = setTimeout(flushWorkflowSave, 350)
}, { deep: true })

function flushWorkflowSave() {
  if (designPreview || screen.value !== 'workflow') return
  if (workflowSaveTimer) clearTimeout(workflowSaveTimer)
  const record = workflowArchive.value.records.find(item => item.id === workflowArchive.value.activeId && item.status === 'draft')
  if (!record) return
  record.draft = { ...workflow.value }
  record.updatedAt = now()
  persistWorkflowArchive()
}
function persistWorkflowArchive(): boolean {
  if (designPreview) return true
  try {
    const before = workflowArchive.value.records.length
    saveWorkflowArchive(workflowArchive.value)
    if (workflowArchive.value.records.length < before) showToast(`建书记录超过 ${MAX_WORKFLOW_RECORDS} 条，已清理最旧的草稿`)
    workflowSaveStatus.value = '草稿已保存在本机'; workflowHistoryError.value = ''; return true
  }
  catch { workflowSaveStatus.value = '建书记录保存失败：请检查浏览器存储空间'; workflowHistoryError.value = workflowSaveStatus.value; return false }
}

function flushSave() {
  flushWorkflowSave()
  if (designPreview) return
  if (saveTimer) clearTimeout(saveTimer)
  try { saveData(data.value); saveStatus.value = '已保存在本机' }
  catch { saveStatus.value = '保存失败：请检查浏览器存储空间' }
}
onMounted(() => {
  if (corruptDataNotice) showToast(corruptDataNotice)
  window.addEventListener('beforeunload', flushSave)
  window.addEventListener('keydown', handleEditorShortcuts)
  document.addEventListener('selectionchange', handleSelectionChange)
  rememberChapterLength()
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushSave)
  window.removeEventListener('keydown', handleEditorShortcuts)
  document.removeEventListener('selectionchange', handleSelectionChange)
  workflowController?.abort()
  productionController?.abort()
  selectionController?.abort()
  flushSave()
})
/** 触屏拖动选区手柄时也会触发 selectionchange，用来补上 touchend 覆盖不到的情况。 */
function handleSelectionChange() {
  if (document.activeElement !== manuscriptEl.value) return
  updateSelectionBubble()
}

function goShelf() {
  if (screen.value === 'workflow') { flushWorkflowSave(); cancelWorkflowGeneration(); workflowCandidate.value = null }
  screen.value = 'shelf'
}
function openWorkflow() {
  const active = workflowArchive.value.records.find(item => item.id === workflowArchive.value.activeId && item.status === 'draft')
  if (active) resumeWorkflowRecord(active.id)
  else startNewWorkflow()
}
function openWorkflowHistory() {
  if (screen.value === 'workflow') flushWorkflowSave()
  cancelWorkflowGeneration()
  workflowCandidate.value = null
  screen.value = 'workflow-history'
}
function startNewWorkflow() {
  if (screen.value === 'workflow') flushWorkflowSave()
  cancelWorkflowGeneration()
  workflowCandidate.value = null
  const record = createWorkflowRecord()
  workflowArchive.value.records.unshift(record)
  workflowArchive.value.activeId = record.id
  workflow.value = { ...record.draft }
  workflowError.value = ''
  screen.value = 'workflow'
  persistWorkflowArchive()
}
function resumeWorkflowRecord(id: string) {
  if (screen.value === 'workflow' && workflowArchive.value.activeId !== id) flushWorkflowSave()
  const record = workflowArchive.value.records.find(item => item.id === id && item.status === 'draft')
  if (!record) return
  cancelWorkflowGeneration()
  workflowCandidate.value = null
  workflowArchive.value.activeId = id
  workflow.value = { ...record.draft }
  workflowError.value = ''
  screen.value = 'workflow'
  persistWorkflowArchive()
}
function duplicateWorkflowRecord(id: string) {
  const source = workflowArchive.value.records.find(item => item.id === id)
  if (!source) return
  cancelWorkflowGeneration()
  const record = createWorkflowRecord(source.draft)
  workflowArchive.value.records.unshift(record)
  workflowArchive.value.activeId = record.id
  workflow.value = { ...record.draft }
  workflowError.value = ''
  screen.value = 'workflow'
  persistWorkflowArchive()
}
function deleteWorkflowRecord(id: string) {
  const record = workflowArchive.value.records.find(item => item.id === id)
  if (!record || !confirm(`删除「${workflowRecordTitle(record)}」的建书记录？已经创建的作品不会被删除。`)) return
  workflowArchive.value.records = workflowArchive.value.records.filter(item => item.id !== id)
  if (workflowArchive.value.activeId === id) { workflowArchive.value.activeId = null; workflow.value = emptyWorkflow() }
  persistWorkflowArchive()
}
function openCompletedBook(record: WorkflowRecord) {
  if (record.bookId && data.value.books.some(item => item.id === record.bookId)) selectBook(record.bookId)
}
function exportWorkflowRecords() {
  const payload = exportWorkflowArchive(workflowArchive.value)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `建书记录-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function handleWorkflowImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  workflowHistoryError.value = ''
  workflowHistoryNotice.value = ''
  if (file.size > 20 * 1024 * 1024) { workflowHistoryError.value = '文件超过 20MB，无法导入。'; return }
  try {
    const records = importWorkflowArchive(JSON.parse(await file.text()))
    if (!records.length) { workflowHistoryNotice.value = '文件中没有建书记录。'; return }
    const previous = workflowArchive.value.records
    workflowArchive.value.records = [...records, ...previous]
    if (!persistWorkflowArchive()) { workflowArchive.value.records = previous; throw new Error('浏览器空间不足，建书记录未导入。') }
    workflowHistoryFilter.value = 'all'
    workflowHistoryNotice.value = `已导入 ${records.length} 条记录；完成记录中的作品请单独导入。`
  } catch (error) { workflowHistoryError.value = error instanceof Error ? error.message : '导入失败，请检查文件内容。' }
}
function nextWorkflow() { if (workflow.value.step < 4) workflow.value.step = (workflow.value.step + 1) as WorkflowDraft['step'] }
function previousWorkflow() { if (workflow.value.step > 1) workflow.value.step = (workflow.value.step - 1) as WorkflowDraft['step'] }
function stopWorkflow() { workflowController?.abort() }
function cancelWorkflowGeneration() { workflowController?.abort(); workflowController = null; workflowBusy.value = false }
async function generateWorkflow(field: WorkflowField) {
  if (workflowBusy.value) return
  if (![workflow.value.seed, workflow.value.idea, workflow.value.genre].some(value => value.trim())) { workflowError.value = '先填写原始灵感或作品类型，再请 AI 生成。'; return }
  workflowError.value = ''
  workflowBusy.value = true
  const requestController = new AbortController()
  const requestRecordId = workflowArchive.value.activeId
  workflowController = requestController
  const prompt = workflowPrompt(field, workflow.value)
  try {
    const text = await requestChatCompletion({ model: data.value.model, system: prompt.system, user: prompt.user, signal: requestController.signal, maxTokens: field === 'title' ? 80 : field === 'outline' ? 2400 : 1100 })
    if (screen.value === 'workflow' && workflowArchive.value.activeId === requestRecordId && workflowController === requestController) workflowCandidate.value = { field, text }
  } catch (error) { if (screen.value === 'workflow' && workflowArchive.value.activeId === requestRecordId && workflowController === requestController) workflowError.value = error instanceof Error ? error.message : String(error) }
  finally { if (workflowController === requestController) { workflowBusy.value = false; workflowController = null } }
}
function adoptWorkflowCandidate() {
  if (!workflowCandidate.value) return
  const { field, text } = workflowCandidate.value
  workflow.value[field] = field === 'title' ? text.trim().split(/\r?\n/)[0].replace(/^[《“"']|[》”"']$/g, '').slice(0, 60) : text.trim()
  workflowCandidate.value = null
  workflowError.value = ''
}
function finishWorkflow() {
  try {
    const created = buildBookFromWorkflow(workflow.value)
    if (!designPreview) saveData({ ...data.value, books: [created, ...data.value.books] })
    data.value.books.unshift(created)
    const record = workflowArchive.value.records.find(item => item.id === workflowArchive.value.activeId && item.status === 'draft')
    if (record) {
      record.draft = { ...workflow.value }
      record.status = 'completed'
      record.bookId = created.id
      record.updatedAt = now()
      record.completedAt = record.updatedAt
    }
    workflowArchive.value.activeId = null
    selectBook(created.id)
    selectedChapterId.value = created.chapters[0].id
    workflow.value = emptyWorkflow()
    if (!persistWorkflowArchive()) alert('作品已创建，但建书记录未能保存。请先导出作品备份。')
    flushSave()
  } catch (error) { workflowError.value = error instanceof Error ? error.message : String(error) }
}
function useAgnesPreset() {
  data.value.model.baseUrl = 'https://apihub.agnes-ai.com/v1'
  data.value.model.model = 'agnes-3.0-flash'
  modelTestStatus.value = '已填入 Agnes 3.0 Flash 的官方 API 地址和模型 ID，请填写 API Key 后测试连接。'
}
async function testModelConnection() {
  if (testingModel.value) return
  testingModel.value = true
  modelTestStatus.value = '正在测试连接…'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    await requestChatCompletion({ model: data.value.model, system: '你是连接测试助手。', user: '请只回复“连接成功”。', maxTokens: 24, signal: controller.signal })
    modelTestStatus.value = '连接成功，模型已返回内容。'
  } catch (error) { modelTestStatus.value = controller.signal.aborted ? '连接测试超过 15 秒，请检查 API 地址、网络或浏览器跨域限制。' : error instanceof Error ? error.message : String(error) }
  finally { clearTimeout(timeout); testingModel.value = false }
}

function selectBook(id: string) {
  selectedBookId.value = id
  const target = data.value.books.find(item => item.id === id)
  selectedChapterId.value = target ? latestChapter(target)?.id || '' : ''
  screen.value = target ? 'editor' : 'shelf'
  showHistory.value = false
  aiError.value = ''
}
function openProduction() {
  if (!book.value) return
  if (!book.value.chapters.some(item => item.id === selectedChapterId.value)) selectedChapterId.value = book.value.chapters[0]?.id || ''
  selectProductionChapter(selectedChapterId.value)
  productionError.value = ''
  screen.value = 'production'
}
function selectProductionChapter(id: string) {
  if (!book.value?.chapters.some(item => item.id === id)) return
  if (selectedChapterId.value !== id) productionInstruction.value = ''
  selectedChapterId.value = id
  selectedCandidateId.value = chapter.value?.proseCandidates?.[0]?.id || ''
  productionKind.value = chapter.value?.content.trim() ? 'continue' : 'rewrite'
  productionInsert.value = selectedProseCandidate.value?.kind === 'rewrite' || !chapter.value?.content.trim() ? 'replace' : 'append'
  compareProduction.value = false
  productionError.value = ''
}
function selectProductionCandidate(id: string) {
  if (!chapter.value?.proseCandidates?.some(item => item.id === id)) return
  selectedCandidateId.value = id
  productionInsert.value = selectedProseCandidate.value?.kind === 'rewrite' || !chapter.value.content.trim() ? 'replace' : 'append'
}
function stopProduction() { productionController?.abort() }
async function generateProduction() {
  if (!book.value || !chapter.value || productionBusy.value) return
  const targetBook = book.value
  const targetChapter = chapter.value
  const baseUpdatedAt = targetChapter.updatedAt
  const instruction = productionInstruction.value.trim()
  const kind = productionKind.value
  const requestController = new AbortController()
  productionController = requestController
  productionBusy.value = true
  productionError.value = ''
  let truncated = false
  try {
    const content = await generateChapterProse({ model: data.value.model, book: targetBook, chapterId: targetChapter.id, instruction, targetLength: productionLength.value, kind, signal: requestController.signal, onTruncated: (message) => { truncated = true; showToast(message) } })
    if (requestController.signal.aborted) return
    if (!data.value.books.some(item => item.id === targetBook.id) || !targetBook.chapters.some(item => item.id === targetChapter.id)) return
    const candidate = { id: uid(), content, instruction: truncated ? `${instruction ? `${instruction}；` : ''}输出被截断，未写完` : instruction, createdAt: now(), baseUpdatedAt, kind }
    ;(targetChapter.proseCandidates ||= []).unshift(candidate)
    if (selectedBookId.value === targetBook.id && selectedChapterId.value === targetChapter.id) selectProductionCandidate(candidate.id)
    targetBook.updatedAt = now()
    flushSave()
  } catch (error) { if (!requestController.signal.aborted) productionError.value = error instanceof Error ? error.message : String(error) }
  finally { if (productionController === requestController) { productionBusy.value = false; productionController = null } }
}
function deleteProductionCandidate() {
  if (!chapter.value || !book.value || !selectedProseCandidate.value) return
  if (!confirm('确定删除当前候选稿吗？此操作无法撤销。')) return
  const id = selectedProseCandidate.value.id
  chapter.value.proseCandidates = chapter.value.proseCandidates?.filter(item => item.id !== id)
  const nextCandidateId = chapter.value.proseCandidates?.[0]?.id || ''
  selectedCandidateId.value = nextCandidateId
  if (nextCandidateId) selectProductionCandidate(nextCandidateId)
  book.value.updatedAt = now()
  flushSave()
}
function adoptProduction() {
  if (!book.value || !chapter.value || !selectedProseCandidate.value) return
  const candidate = selectedProseCandidate.value
  const content = candidate.content.trim()
  if (!content) return
  if (productionInsert.value === 'replace' && chapter.value.content.trim() && !confirm('确定替换本章现有正文吗？原稿会先保存到版本历史。')) return
  if (chapter.value.content.trim()) recordChapterVersion(chapter.value, 'ai')
  const previousContent = chapter.value.content
  chapter.value.content = productionInsert.value === 'replace' ? content : [chapter.value.content.trimEnd(), content].filter(Boolean).join('\n\n')
  recordWordDelta('ai', book.value.id, countWords(chapter.value.content) - (productionInsert.value === 'replace' ? 0 : countWords(previousContent)))
  chapterLengths.set(chapter.value.id, countWords(chapter.value.content))
  chapter.value.proseCandidates = chapter.value.proseCandidates?.filter(item => item.id !== candidate.id)
  const nextCandidateId = chapter.value.proseCandidates?.[0]?.id || ''
  selectedCandidateId.value = nextCandidateId
  touchChapter()
  if (nextCandidateId) selectProductionCandidate(nextCandidateId)
  flushSave()
  const next = book.value.chapters.find(item => !item.content.trim() && !item.proseCandidates?.length)
  if (next) selectProductionChapter(next.id)
}
function touchChapter() {
  if (!chapter.value || !book.value) return
  const current = countWords(chapter.value.content)
  const previous = chapterLengths.get(chapter.value.id)
  if (previous !== undefined && current > previous) recordWordDelta('manual', book.value.id, current - previous)
  chapterLengths.set(chapter.value.id, current)
  const timestamp = now()
  chapter.value.updatedAt = timestamp
  book.value.updatedAt = timestamp
}
function openHistory() {
  selectedVersionId.value = chapter.value?.history?.[0]?.id || ''
  historyDiff.value = false
  historyNotice.value = ''
  showHistory.value = true
}
function saveCurrentVersion() {
  if (!chapter.value) return
  const version = recordChapterVersion(chapter.value, 'manual')
  historyNotice.value = version ? '当前稿已保存为一个版本。' : '当前稿与最新版本相同，无需重复保存。'
  if (version) selectedVersionId.value = version.id
}
function restoreVersion() {
  if (!chapter.value || !book.value || !selectedVersion.value) return
  const target = selectedVersion.value
  if (chapter.value.title === target.title && chapter.value.content === target.content) { historyNotice.value = '当前稿已经是这个版本。'; return }
  if (!confirm(`恢复「${target.title}」在 ${formatVersionTime(target.savedAt)} 的版本？当前稿会先保留在历史中。`)) return
  recordChapterVersion(chapter.value, 'restore')
  chapter.value.title = target.title
  chapter.value.content = target.content
  // 恢复不记手写增量，但要把已统计字数刷新成恢复后的长度：否则下次手动输入会把整段差值误记为手写
  chapterLengths.set(chapter.value.id, countWords(chapter.value.content))
  const timestamp = now()
  chapter.value.updatedAt = timestamp
  book.value.updatedAt = timestamp
  showHistory.value = false
}
function addBook() {
  newBookTitle.value = ''
  newBookPremise.value = ''
  showCreateBook.value = true
}
function createAndOpenBook() {
  const title = newBookTitle.value.trim()
  if (!title) return
  const item = createBook(title)
  item.premise = newBookPremise.value.trim()
  data.value.books.unshift(item)
  selectBook(item.id)
  showCreateBook.value = false
}
function removeBook() {
  if (!book.value || !confirm(`确定删除《${book.value.title}》及全部章节和设定吗？此操作无法撤销。建议先导出作品。`)) return
  data.value.books = data.value.books.filter(item => item.id !== selectedBookId.value)
  pruneStatsBooks(data.value.stats, new Set(data.value.books.map(item => item.id)))
  if (statsBookFilter.value && !data.value.books.some(item => item.id === statsBookFilter.value)) statsBookFilter.value = ''
  selectBook(data.value.books[0]?.id || '')
}
function addChapter() {
  if (!book.value) return
  const item = { id: uid(), title: `第${book.value.chapters.length + 1}章`, content: '', updatedAt: now() }
  book.value.chapters.push(item)
  book.value.updatedAt = item.updatedAt
  selectedChapterId.value = item.id
}
function removeChapter() {
  if (!book.value || book.value.chapters.length <= 1 || !chapter.value || !confirm(`确定删除「${chapter.value.title}」吗？`)) return
  book.value.chapters = book.value.chapters.filter(item => item.id !== selectedChapterId.value)
  selectedChapterId.value = book.value.chapters[0].id
  book.value.updatedAt = now()
}
function openLoreLibrary(category: LoreCategory = 'all', itemId = '') {
  loreCategory.value = category
  focusedLoreId.value = itemId
  showLore.value = true
  if (itemId) void nextTick(() => document.getElementById(`lore-${itemId}`)?.scrollIntoView({ block: 'nearest' }))
}
function addLore(kind: LoreMode) {
  const id = uid()
  book.value?.lore.unshift({ id, title: kind === 'timeline' ? '新时间节点' : '新设定', content: '', mode: kind, ...(kind === 'timeline' ? { timeLabel: '' } : {}) })
  openLoreLibrary(kind, id)
}
function removeLore(id: string) { if (book.value && confirm('删除这条设定？')) book.value.lore = book.value.lore.filter(item => item.id !== id) }
function stop() { controller?.abort() }
async function send() {
  if (!book.value || !chapter.value || !instruction.value.trim() || working.value) return
  const target = book.value
  const chapterId = chapter.value.id
  const taskMode = mode.value
  const promptText = instruction.value.trim()
  aiError.value = ''
  working.value = true
  controller = new AbortController()
  target.chat.push({ id: uid(), role: 'user', mode: taskMode, content: promptText, chapterId })
  instruction.value = ''
  try {
    const content = await generateDraft({ model: data.value.model, book: target, chapterId, mode: taskMode, instruction: promptText, signal: controller.signal })
    const entry: ChatEntry = { id: uid(), role: 'assistant', mode: taskMode, content, chapterId }
    target.chat.push(entry)
    openPreview(entry, chapterId, target.id)
  } catch (error) { aiError.value = error instanceof Error ? error.message : String(error) }
  finally { working.value = false; controller = null }
}
function openPreview(entry: ChatEntry, chapterId = entry.chapterId || selectedChapterId.value, bookId = selectedBookId.value) {
  preview.value = { bookId, entryId: entry.id, mode: entry.mode, content: entry.content, title: '', insert: 'append', chapterId }
}
function adoptPreview() {
  if (!preview.value) return
  const draft = preview.value
  const targetBook = data.value.books.find(item => item.id === draft.bookId)
  if (!targetBook) { aiError.value = '原作品已不存在，请重新生成。'; return }
  const content = draft.content.trim()
  if (!content) return
  if (draft.mode === 'prose') {
    const target = targetBook.chapters.find(item => item.id === draft.chapterId)
    if (!target) { aiError.value = '原章节已不存在，请重新生成。'; return }
    if (draft.insert === 'replace' && target.content.trim() && !confirm('确定替换本章现有正文吗？')) return
    if (target.content.trim()) recordChapterVersion(target, 'ai')
    const previousContent = target.content
    target.content = draft.insert === 'replace' ? content : [target.content.trimEnd(), content].filter(Boolean).join('\n\n')
    recordWordDelta('ai', targetBook.id, countWords(target.content) - (draft.insert === 'replace' ? 0 : countWords(previousContent)))
    chapterLengths.set(target.id, countWords(target.content))
    target.updatedAt = now()
    targetBook.updatedAt = target.updatedAt
    selectedBookId.value = targetBook.id
    selectedChapterId.value = target.id
  } else {
    targetBook.lore.push({ id: uid(), title: draft.title.trim() || `${modeLabel(draft.mode)} ${targetBook.lore.length + 1}`, content, mode: draft.mode })
    targetBook.updatedAt = now()
    selectedBookId.value = targetBook.id
    loreCategory.value = draft.mode
    sideView.value = 'reference'
  }
  const entry = targetBook.chat.find(item => item.id === draft.entryId)
  if (entry) entry.adopted = true
  preview.value = null
}
function exportBook() {
  if (!book.value) return
  const payload = JSON.stringify({ format: 'novel-workbench-next/book-v1', book: book.value }, null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${book.value.title.replace(/[\\/:*?"<>|]/g, '_')}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 50 * 1024 * 1024) { alert('文件超过 50MB，暂不支持导入。'); return }
  try {
    const imported = importBookJson(JSON.parse(await file.text()))
    // 先算账再动内存：装不进存储配额就直接拒绝导入，不留一本「只在内存里」的书拖垮后续自动保存
    assertStorageFits({ ...data.value, books: [imported, ...data.value.books] })
    data.value.books.unshift(imported)
    selectBook(imported.id)
    flushSave()
  } catch (error) {
    alert(error instanceof Error ? error.message : '导入失败，请检查文件内容。')
  }
}
function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportWorkspaceBackup() {
  const backup = buildWorkspaceBackup(data.value, workflowArchive.value, new Date().toISOString(), {
    rank: loadRankStore().snapshots,
    breakdown: loadBreakdownStore().projects,
  })
  downloadText(`小说工作台备份-${backup.exportedAt.slice(0, 10)}.json`, serializeWorkspaceBackup(backup), 'application/json')
  const side = [backup.rank ? `${backup.rank.snapshots.length} 份扫榜快照` : '', backup.breakdown ? `${backup.breakdown.projects.length} 个拆书项目` : ''].filter(Boolean)
  backupNotice.value = `已导出备份：${backup.counts.books} 部作品、${backup.counts.chapters} 章、${backup.counts.notes} 条灵感${side.length ? `、${side.join('、')}` : ''}。`
}
async function handleBackupImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  backupNotice.value = ''
  if (!file) return
  if (file.size > BACKUP_SIZE_LIMIT) { backupNotice.value = `文件超过 ${Math.round(BACKUP_SIZE_LIMIT / 1024 / 1024)}MB，暂不支持恢复。`; return }
  let parsed: unknown
  try { parsed = JSON.parse(await file.text()) } catch { backupNotice.value = '备份文件不是有效的 JSON，无法恢复。'; return }
  const backup = parseWorkspaceBackup(parsed)
  if (!backup) { backupNotice.value = '备份文件格式不受支持，请确认它来自本软件的“下载全量备份”。'; return }
  const overwrite = backupMode.value === 'overwrite'
  if (overwrite && !confirm('覆盖恢复会清空当前全部作品、灵感、统计、扫榜快照与拆书库，确定继续吗？')) return
  // 用户已确认覆盖：解除「主数据损坏禁止写入」，让恢复能取代主键里的损坏原文
  if (overwrite) releaseCorruptDataProtection()
  let addedRecords = 0
  let sideNote = ''
  if (overwrite) {
    try { assertStorageFits(backup.data) } catch (error) { backupNotice.value = error instanceof Error ? error.message : '备份体积超出浏览器存储上限，无法恢复。'; return }
    data.value = backup.data
    if (backup.workflow) { workflowArchive.value = backup.workflow; saveWorkflowArchive(backup.workflow) }
    saveRankStore({ ...emptyRankStore(), snapshots: backup.rank?.snapshots || [] })
    saveBreakdownStore({ ...emptyBreakdownStore(), projects: backup.breakdown?.projects || [] })
  } else {
    const merged = mergeWorkspaceBackup(data.value, backup.data)
    try { assertStorageFits(merged.data) } catch (error) { backupNotice.value = error instanceof Error ? error.message : '备份体积超出浏览器存储上限，无法合并。'; return }
    data.value = merged.data
    const records = mergeWorkflowRecords(workflowArchive.value.records, backup.workflow?.records || [])
    addedRecords = records.added
    if (addedRecords) { workflowArchive.value = { ...workflowArchive.value, records: records.records }; saveWorkflowArchive(workflowArchive.value) }
    const currentRank = loadRankStore()
    const currentBreakdown = loadBreakdownStore()
    const side = mergeSideStores(
      { rank: currentRank.snapshots, breakdown: currentBreakdown.projects },
      { rank: backup.rank?.snapshots || [], breakdown: backup.breakdown?.projects || [] }
    )
    saveRankStore({ ...currentRank, snapshots: side.rank })
    saveBreakdownStore({ ...currentBreakdown, projects: side.breakdown })
    const sideParts = [
      side.addedRank || side.updatedRank ? `扫榜快照 新增 ${side.addedRank} 份、更新 ${side.updatedRank} 份` : '',
      side.addedBreakdown || side.updatedBreakdown ? `拆书项目 新增 ${side.addedBreakdown} 个、更新 ${side.updatedBreakdown} 个` : '',
    ].filter(Boolean)
    sideNote = sideParts.length ? `；${sideParts.join('、')}` : ''
    backupNotice.value = `合并完成：新增 ${merged.summary.addedBooks} 部作品、${merged.summary.addedNotes} 条灵感、${addedRecords} 条建书记录${sideNote}；统计合并了 ${merged.summary.changedDays} 天。`
  }
  if (overwrite) backupNotice.value = `已用备份覆盖当前数据：${backup.counts.books} 部作品、${backup.counts.chapters} 章。`
  dataEpoch.value += 1
  const firstBook = data.value.books[0]
  if (!firstBook) { selectedBookId.value = ''; selectedChapterId.value = ''; screen.value = 'shelf' }
  else if (!data.value.books.some(item => item.id === selectedBookId.value)) { selectBook(firstBook.id) }
  else if (!data.value.books.find(item => item.id === selectedBookId.value)?.chapters.some(item => item.id === selectedChapterId.value)) {
    selectedChapterId.value = data.value.books.find(item => item.id === selectedBookId.value)?.chapters[0]?.id || ''
  }
  flushSave()
  showToast(overwrite ? '已从备份恢复' : '已合并备份内容')
}
function exportBookTxt() {
  if (!book.value) return
  downloadText(`${safeFileName(book.value.title, '未命名作品')}.txt`, bookToTxt(book.value), 'text/plain')
  backupNotice.value = `已导出《${book.value.title}》的 TXT 阅读稿。`
}
function exportChapterTxt() {
  if (!book.value || !chapter.value) return
  const title = chapter.value.title.trim() || '未命名章节'
  downloadText(`${safeFileName(`${book.value.title}-${title}`, '章节')}.txt`, chapterToTxt(book.value, chapter.value), 'text/plain')
  backupNotice.value = `已导出《${title}》的 TXT 阅读稿。`
}
</script>
