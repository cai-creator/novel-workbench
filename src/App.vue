<template>
  <div class="app-shell">
    <header class="topbar">
      <button class="brand brand-button" type="button" @click="goShelf" aria-label="返回作品书架"><span class="brand-mark">文</span><span><strong>小说创作工作台</strong><small>新版 · 从故事到正文</small></span></button>
      <div class="top-actions">
        <span class="save-indicator" role="status">{{ saveStatus }}</span>
        <button v-if="screen !== 'shelf'" class="quiet" @click="goShelf">作品书架</button>
        <button v-else-if="book" class="quiet" @click="screen = 'editor'">返回写作</button>
        <button v-if="screen !== 'workflow'" class="quiet" @click="openWorkflow">工作流建书</button>
        <button class="quiet" @click="importInput?.click()">导入作品</button>
        <input ref="importInput" type="file" accept=".json,application/json" hidden @change="handleImport" />
        <button v-if="screen === 'editor'" class="quiet" @click="exportBook" :disabled="!book">导出作品</button>
        <button class="quiet" @click="showModel = true">模型设置</button>
      </div>
    </header>

    <main v-if="screen === 'workflow'" class="workflow-page">
      <div class="workflow-shell">
        <header class="workflow-hero"><small>STORY LAB · 从灵感到可写的书</small><h1>建立你的下一部连载</h1><p>四步完成可编辑的创意、大纲与设定。每份 AI 候选都由你决定是否采纳。</p></header>
        <nav class="workflow-steps" aria-label="建书步骤"><button v-for="item in workflowSteps" :key="item.step" type="button" :class="{ active: workflow.step === item.step, done: workflow.step > item.step }" @click="workflow.step = item.step"><span>{{ String(item.step).padStart(2, '0') }}</span>{{ item.label }}</button></nav>
        <section class="workflow-card">
          <div class="workflow-card-head"><div><small>第 {{ workflow.step }} 步 / 共 4 步</small><h2>{{ workflowSteps[workflow.step - 1].title }}</h2><p>{{ workflowSteps[workflow.step - 1].description }}</p></div><button class="workflow-reset" @click="resetWorkflow">清空草稿</button></div>
          <div v-if="workflow.step === 1" class="workflow-fields">
            <div class="workflow-field-row"><label>作品类型<input v-model="workflow.genre" placeholder="例如：都市悬疑、玄幻冒险" /></label><label>目标读者<input v-model="workflow.audience" placeholder="例如：喜欢快节奏悬疑的读者" /></label><label>叙事风格<input v-model="workflow.tone" placeholder="例如：克制、诡谲、带少量幽默" /></label></div>
            <label>原始灵感<textarea v-model="workflow.seed" placeholder="哪怕只有一句话：主角遇到了什么异常？他非解决不可的事是什么？" /></label>
            <div class="workflow-field-head"><label for="workflow-idea">可用创意</label><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('idea')">✦ AI 完善创意</button></div><textarea id="workflow-idea" v-model="workflow.idea" placeholder="把创意改成你愿意写下去的版本。AI 生成内容需要先预览和采纳。" />
          </div>
          <div v-else-if="workflow.step === 2" class="workflow-fields">
            <div class="workflow-field-head"><label for="workflow-title">作品名称</label><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('title')">✦ AI 取书名</button></div><input id="workflow-title" v-model="workflow.title" maxlength="60" placeholder="先起一个工作书名，随时可以改" />
            <div class="workflow-field-head"><label for="workflow-outline">故事主线与章节规划</label><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('outline')">✦ AI 生成大纲</button></div><textarea id="workflow-outline" v-model="workflow.outline" class="workflow-long" placeholder="先写故事主线，再逐行写：第1章｜标题｜具体事件与章节钩子。建书时会识别最多 20 个章节。" />
            <p class="workflow-help">已识别 {{ workflowChapters.length }} 个章节；章节摘要会跟随正文保存，并提供给 AI 写正文时参考。</p>
          </div>
          <div v-else-if="workflow.step === 3" class="workflow-fields">
            <div class="workflow-field-head"><label for="workflow-world">世界观与规则</label><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('world')">✦ AI 补全世界观</button></div><textarea id="workflow-world" v-model="workflow.world" placeholder="规则、限制、代价与对故事的影响" />
            <div class="workflow-field-head"><label for="workflow-characters">主要人物</label><button class="secondary" :disabled="workflowBusy" @click="generateWorkflow('characters')">✦ AI 塑造人物</button></div><textarea id="workflow-characters" v-model="workflow.characters" placeholder="人物目标、弱点、秘密、关系与变化" />
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

    <main v-else-if="screen === 'shelf'" class="shelf-page">
      <div class="shelf-inner">
        <section class="shelf-hero">
          <div><small>我的连载书房</small><h1>每一个故事，都有下一章。</h1><p>在这里整理作品，随时回到最近写下的那一章。</p>
            <div class="shelf-hero-actions"><button class="primary large" @click="openWorkflow">✦ 工作流建书</button><button class="shelf-import" @click="addBook">手动创建 →</button><button class="shelf-import" @click="importInput?.click()">导入已有作品 →</button></div>
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

    <div v-else class="workspace">
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
            <div class="editor-tools"><button class="quiet" @click="openHistory">版本历史 <span class="count-pill">{{ chapter?.history?.length || 0 }}</span></button><button class="quiet" @click="showPremise = true">故事概念</button><button class="quiet" @click="sideView = 'reference'">作品资料 <span class="count-pill">{{ book.lore.length }}</span></button></div>
          </div>
          <div v-if="chapter" class="paper">
            <input v-model="chapter.title" class="chapter-title" aria-label="章节标题" placeholder="章节标题" @input="touchChapter" />
            <div class="paper-meta">{{ countWords(chapter.content) }} 字 <span>·</span> {{ chapter.content ? '继续写下去' : '在这里写下故事的第一句' }}</div>
            <details class="chapter-outline"><summary>本章提纲 <span>{{ chapter.outline ? '已填写' : '可选' }}</span></summary><textarea v-model="chapter.outline" placeholder="这一章要发生什么？结尾留下什么悬念？" @input="touchChapter" /></details>
            <textarea v-model="chapter.content" class="manuscript" aria-label="章节正文" placeholder="故事从这里开始……" spellcheck="false" @input="touchChapter" />
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
          <div v-if="selectedVersion" class="history-preview"><div><strong>{{ selectedVersion.title }}</strong><span>{{ formatVersionTime(selectedVersion.savedAt) }}</span></div><textarea :value="selectedVersion.content" readonly aria-label="历史版本正文" /><div class="history-preview-actions"><span>恢复前会先保存当前稿</span><button class="primary" @click="restoreVersion">恢复这个版本</button></div></div>
        </div>
      </section>
    </div>

    <div v-if="workflowCandidate" class="overlay" @click.self="workflowCandidate = null"><section class="modal preview-modal" role="dialog" aria-modal="true" aria-label="预览建书候选">
      <div class="modal-head"><div><small>候选稿 · 可先修改</small><h2>预览并采纳{{ workflowFieldLabel(workflowCandidate.field) }}</h2></div><button class="icon-button" aria-label="关闭" @click="workflowCandidate = null">×</button></div>
      <p class="modal-note">模型生成结果不会自动覆盖草稿。你可以直接修改下方文本，再决定是否采纳。</p><textarea v-model="workflowCandidate.text" class="preview-textarea" aria-label="建书候选内容" /><div class="modal-actions"><button class="secondary" @click="workflowCandidate = null">暂不采纳</button><button class="primary" :disabled="!workflowCandidate.text.trim()" @click="adoptWorkflowCandidate">采纳到草稿</button></div>
    </section></div>

    <div v-if="preview" class="overlay" @click.self="preview = null"><section class="modal preview-modal" role="dialog" aria-modal="true" aria-label="预览 AI 内容"><div class="modal-head"><div><small>先审阅，再落稿</small><h2>预览并采纳</h2></div><button class="icon-button" aria-label="关闭" @click="preview = null">×</button></div><p class="modal-note">你可以先修改生成内容。只有点击采纳，内容才会进入作品。</p><label v-if="preview.mode !== 'prose'">设定标题<input v-model="preview.title" placeholder="给这条设定起名" /></label><label v-else>写入位置<select v-model="preview.insert"><option value="append">追加到本章末尾</option><option value="replace">替换本章正文</option></select></label><textarea v-model="preview.content" class="preview-textarea" aria-label="生成内容" /><div class="modal-actions"><button class="secondary" @click="preview = null">暂不采纳</button><button class="primary" :disabled="!preview.content.trim()" @click="adoptPreview">采纳到作品</button></div></section></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { generateDraft, requestChatCompletion } from './ai'
import { designFixture } from './design-fixture'
import { createBook, importBookJson, loadData, now, recordChapterVersion, saveData, uid, type Book, type ChatEntry, type ChapterVersion, type LoreMode, type Mode } from './storage'
import { buildBookFromWorkflow, clearWorkflow, emptyWorkflow, loadWorkflow, parseChapterPlan, saveWorkflow, workflowPrompt, type WorkflowDraft, type WorkflowField } from './workflow'

const designPreview = import.meta.env.DEV && new URLSearchParams(location.search).has('ui-preview')
const data = ref(designPreview ? designFixture() : loadData())
const importInput = ref<HTMLInputElement | null>(null)
const previewPanel = designPreview ? new URLSearchParams(location.search).get('panel') : null
const screen = ref<'shelf' | 'editor' | 'workflow'>(previewPanel === 'workflow' ? 'workflow' : !data.value.books.length || previewPanel === 'shelf' ? 'shelf' : 'editor')
const workflow = ref<WorkflowDraft>(designPreview ? emptyWorkflow() : loadWorkflow())
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
const book = computed(() => data.value.books.find(item => item.id === selectedBookId.value))
const chapter = computed(() => book.value?.chapters.find(item => item.id === selectedChapterId.value))
const bookWords = computed(() => book.value?.chapters.reduce((sum, item) => sum + countWords(item.content), 0) || 0)
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
const showHistory = ref(false)
const selectedVersionId = ref('')
const historyNotice = ref('')
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
  try { saveWorkflow(workflow.value); workflowSaveStatus.value = '草稿已保存在本机' }
  catch { workflowSaveStatus.value = '草稿保存失败：请检查浏览器存储空间' }
}

function flushSave() {
  flushWorkflowSave()
  if (designPreview) return
  if (saveTimer) clearTimeout(saveTimer)
  try { saveData(data.value); saveStatus.value = '已保存在本机' }
  catch { saveStatus.value = '保存失败：请检查浏览器存储空间' }
}
onMounted(() => window.addEventListener('beforeunload', flushSave))
onBeforeUnmount(() => { window.removeEventListener('beforeunload', flushSave); workflowController?.abort(); flushSave() })

function goShelf() {
  if (screen.value === 'workflow') { flushWorkflowSave(); workflowController?.abort(); workflowCandidate.value = null }
  screen.value = 'shelf'
}
function openWorkflow() { workflowError.value = ''; screen.value = 'workflow' }
function resetWorkflow() {
  if (!confirm('确定清空当前建书草稿？已填写的创意、大纲和设定将被删除。')) return
  workflowController?.abort()
  workflow.value = emptyWorkflow()
  workflowCandidate.value = null
  workflowError.value = ''
  if (!designPreview) clearWorkflow()
}
function nextWorkflow() { if (workflow.value.step < 4) workflow.value.step = (workflow.value.step + 1) as WorkflowDraft['step'] }
function previousWorkflow() { if (workflow.value.step > 1) workflow.value.step = (workflow.value.step - 1) as WorkflowDraft['step'] }
function stopWorkflow() { workflowController?.abort() }
async function generateWorkflow(field: WorkflowField) {
  if (workflowBusy.value) return
  if (![workflow.value.seed, workflow.value.idea, workflow.value.genre].some(value => value.trim())) { workflowError.value = '先填写原始灵感或作品类型，再请 AI 生成。'; return }
  workflowError.value = ''
  workflowBusy.value = true
  workflowController = new AbortController()
  const prompt = workflowPrompt(field, workflow.value)
  try {
    const text = await requestChatCompletion({ model: data.value.model, system: prompt.system, user: prompt.user, signal: workflowController.signal, maxTokens: field === 'title' ? 80 : field === 'outline' ? 2400 : 1100 })
    if (screen.value === 'workflow') workflowCandidate.value = { field, text }
  } catch (error) { if (screen.value === 'workflow') workflowError.value = error instanceof Error ? error.message : String(error) }
  finally { workflowBusy.value = false; workflowController = null }
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
    data.value.books.unshift(created)
    selectBook(created.id)
    selectedChapterId.value = created.chapters[0].id
    workflow.value = emptyWorkflow()
    if (!designPreview) clearWorkflow()
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
function touchChapter() {
  if (!chapter.value || !book.value) return
  const timestamp = now()
  chapter.value.updatedAt = timestamp
  book.value.updatedAt = timestamp
}
function openHistory() {
  selectedVersionId.value = chapter.value?.history?.[0]?.id || ''
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
    target.content = draft.insert === 'replace' ? content : [target.content.trimEnd(), content].filter(Boolean).join('\n\n')
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
    data.value.books.unshift(imported)
    selectBook(imported.id)
    flushSave()
  } catch (error) {
    alert(error instanceof Error ? error.message : '导入失败，请检查文件内容。')
  }
}
</script>
