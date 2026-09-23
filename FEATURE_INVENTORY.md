# 旧版功能清单与新版范围

盘点对象：仓库根目录的易创 1.0.7，按 **2026-09-19 工作区代码**核对。这里的“已有”表示页面与调用链存在，并不代表每个外部模型、榜单源或系统环境都已实测通过。新项目在本目录，旧版代码不作为运行依赖。

## 1. 总览与导航

- 首页：书架入口、写作进度、常用工具、随手记。
- 主导航：我的作品、工作流建书、建书历史、提示词管理、写作统计、小说榜单、拆书、灵感素材、AI 模型管理、反馈、设置、检查更新。
- 部分入口受功能开关控制，不能仅凭路由存在判断每个用户都能在菜单中看到。

核对：[路由](../easy-writing/src/router/index.ts)、[首页](../easy-writing/src/views/Home/index.vue)、[侧边栏](../easy-writing/src/layouts/components/Sidebar.vue)。

## 2. 书架与作品

- 新建作品、修改书籍信息、封面和分类标签；书籍分组新建与管理。
- 按书名、分类、简介、标签搜索；按分组筛选；排序；网格和列表视图。
- 删除与回收站恢复；作品 TXT / JSON 导出；TXT / JSON 导入，导入前预览并可调整书名和简介。
- JSON 备份包含正文以及大纲、角色、设定、时间线、故事线；TXT 偏向阅读稿。

核对：[书架](../easy-writing/src/views/MyBooks/index.vue)、[导入](../easy-writing/src/views/MyBooks/components/ImportBookModal.vue)、[导出](../easy-writing/src/views/MyBooks/components/ExportBookModal.vue)。

## 3. 手动写作与章节目录

- 建卷、建章、改名、编辑章节资料与摘要、删除；卷简介；章节与卷拖动排序、按章号或创建时间排序；全书目录搜索。
- 章节 TXT 导入、预览与追加；按单章、选中章节或分卷合并导出 TXT。
- 正文编辑、章节标题编辑、实时字数和全书字数、撤销/重做、排版、查找替换、全屏、移动端预览。
- 自动保存、章节历史版本与恢复；编辑期间敏感词提示、角色和设定词高亮、写作特效、专注偏好与 AI 自动补全。
- 选中文字可做 AI 润色、扩写、纠错、自定义修改；可添加到对话、灵感库，或绑定到时间线与故事线。

核对：[目录](../easy-writing/src/views/Writing/components/WritingSidebar.vue)、[编辑器](../easy-writing/src/views/Writing/components/WritingEditor.vue)、[划词工具](../easy-writing/src/views/Writing/components/EditorBubbleMenu.vue)、[导入章节](../easy-writing/src/views/Writing/components/ImportChaptersModal.vue)、[导出章节](../easy-writing/src/views/Writing/components/ExportChaptersModal.vue)。

## 4. 写作参考资料

- 大纲：分类文件夹、条目编辑、AI 润色和恢复润色前内容。
- 角色：角色卡与人物关系图；角色资料编辑和 AI 辅助。
- 世界设定：分组管理，地理位置、势力宗门、功法技能、物品道具、等级体系等分类；AI 生成。
- 时间线：事件节点、关联正文、AI 从章节提取、补全缺口、检查矛盾。
- 故事线：思维导图、时间轴、节点连线、自动排列、正文绑定、AI 建议与采纳。
- 右侧工具可展开；参考面板可以弹出为独立窗口或网页浮窗。

核对：[右侧工具](../easy-writing/src/views/Writing/components/WritingRightPanel.vue)、[大纲](../easy-writing/src/views/Writing/components/OutlinePanel.vue)、[角色](../easy-writing/src/views/Writing/components/CharacterPanel.vue)、[设定](../easy-writing/src/views/Writing/components/SettingPanel.vue)、[时间线](../easy-writing/src/views/Writing/components/TimelinePanel.vue)、[故事线](../easy-writing/src/views/Writing/components/StorylinePanel.vue)。

## 5. 妙笔 AI 对话

- 对话模式：直接写正文、共创世界观、完善人物、规划后续剧情，也保留顾问式问答。
- 可关联章节和正文选区；按相关性选取大纲、角色、世界设定等上下文。
- 生成后预览、编辑再采纳：正文落入章节，设定类内容进入相应资料；采纳状态写入聊天记录。
- 流式回答、停止生成、复制、重新回答、删除消息；新建、切换、重命名、删除本地会话。

核对：[妙笔面板](../easy-writing/src/views/Writing/components/AiChatPanel.vue)、[上下文选取](../easy-writing/src/utils/ai-story-context.ts)。

## 6. 工作流建书

- 四步向导：创作方向与灵感 → 写作参数 → 生成大纲 → 生成设定。
- 创作方向包含发布平台、目标读者、类型、风格标签与工作流模型；支持输入原始灵感或生成随机灵感，先预览再采用。
- 写作参数包含目标篇幅、单章篇幅、主角倾向、叙述视角与创作重点。
- 大纲包含推荐书名、作品简介、世界概览、卷纲、阶段锚点、章节大纲预览；可手动改、按要求调整、生成候选比较、重新生成。
- 设定包含世界背景、核心设定、角色卡、故事线；可逐项编辑、定向调整、候选确认、重新生成。
- 草稿与历史记录、保存进度、继续编辑、错误提示与重试、取消当前生成；完成后创建书籍并进入自动生文。

核对：[建书页](../easy-writing/src/views/WorkflowBook/index.vue)、[向导](../easy-writing/src/views/WorkflowBook/components/WorkflowShell.vue)、[灵感](../easy-writing/src/views/WorkflowBook/components/WorkflowModeStep.vue)、[大纲](../easy-writing/src/views/WorkflowBook/components/WorkflowOutlineStep.vue)、[设定](../easy-writing/src/views/WorkflowBook/components/WorkflowSettingStep.vue)、[历史](../easy-writing/src/views/WorkflowBook/History.vue)。

## 7. 自动生文与改稿

- 根据大纲与设定逐章规划、生成正文，显示进度、断点和生成记录。
- 生成任务可暂停、继续、停止；章节可审阅后接受并继续；提供需要确认的问题与修改建议。
- 运行期间可调整作品参数、写作规则、章纲；从下一章生效。
- 单章重写可填写意见，选择重写方式，先看新章纲或正文候选，再比较原稿与候选并决定应用；原稿进入历史版本。

核对：[工作流控制](../easy-writing/src/views/Writing/components/WorkflowControlPanel.vue)、[侧轨](../easy-writing/src/views/Writing/components/workflow-rail/WorkflowSideRail.vue)、[规则](../easy-writing/src/views/Writing/components/workflow-rail/WorkflowRulesPanel.vue)、[重写](../easy-writing/src/views/Writing/components/workflow-rail/RewritePanel.vue)。

## 8. 灵感、辅助生成与拆书

- 灵感素材：快速记录、标签、分类筛选、搜索、置顶、编辑、删除；热门素材与 AI 每日推荐。
- 写作辅助：取名、作品简介生成或润色、AI 封面画面与图片生成入口、章节标题和章纲提炼。
- 拆书：导入本地 TXT、识别章节、按章 AI 拆解、失败重试、黄金三章分析、全书报告、拆书历史、Markdown 导出。

核对：[灵感](../easy-writing/src/views/Inspiration/index.vue)、[取名](../easy-writing/src/views/Writing/components/NameGeneratorModal.vue)、[画师](../easy-writing/src/views/Writing/components/ArtistModal.vue)、[拆书入口](../easy-writing/src/views/BookBreakdown/index.vue)、[拆书工作台](../easy-writing/src/views/BookBreakdown/Workbench.vue)。

## 9. 榜单与写作数据

- 榜单：本机抓取开关（关闭、手动、每日自动补抓）、分类与日期筛选、作品/作者搜索、排名和变化、作品对比、数据导出。
- 榜单分析：分类、标签、排名变化、竞品趋势、AI 趋势解读。作者趋势面板在当前页面代码中被注释，暂不列为可用功能。
- 写作统计：今日手写/AI 字数、7/15/30 天趋势、按书筛选的码字日历、日/月目标与完成率。

核对：[榜单](../easy-writing/src/views/NovelRank/index.vue)、[统计](../easy-writing/src/views/WriteStatistics/index.vue)。

## 10. 模型、提示词与设置

- BYOK 模型：多个服务商预设与自定义兼容接口；添加、编辑、删除、拉取模型、连接测试、建书创意测试；文本、图像、工作流分别选默认模型。
- 服务商预设代码包含 OpenAI、DeepSeek、MiniMax、通义千问、火山方舟、智谱、硅基流动、OpenRouter、Agnes AI、Gemini 兼容、xAI、本地部署与自定义 OpenAI 兼容接口；Claude 原生协议尚未接入。是否可用取决于具体模型与接口。
- 提示词管理：写作、建书、自动生文、拆书、榜单与封面等提示词可本地编辑、调整采样温度、恢复默认；桌面版以 Markdown 文件保存。
- 设置中心：写作体验、外观与主题、字体与背景、敏感词库、AI 调用记录、存储与缓存、自动备份频率与保留份数、备份目录和立即备份。
- 桌面版使用 Tauri + 本地 SQLite，浏览器版使用 IndexedDB；核心内容保存在本机。AI 调用需配置自己的模型密钥和可访问的接口。

核对：[模型设置](../easy-writing/src/views/Writing/components/AiModelSettingsPane.vue)、[提示词](../easy-writing/src/views/Prompts/index.vue)、[设置中心](../easy-writing/src/views/SettingsCenter/SettingsCenterModal.vue)、[备份](../easy-writing/src/views/SettingsCenter/panes/SyncPane.vue)、[本地存储](../easy-writing/src/storage/index.ts)。

## 明确没有列为现有功能

- 作品“生成视频”“转为剧本”按钮在书架源码中处于注释状态。
- README 中提到的无限画布工作流、剧本创作与分镜属于后续计划。
- 旧版没有可依赖的云端账号与跨设备同步服务；本地保存不能等同于云同步。
- 模型供应商、网络抓取和生图的成功率受外部接口限制，代码存在不等于当前账号已能稳定使用。

## 新版第一阶段的实际范围

已实现：独立 Vue 项目、作品书架与章节管理、正文编辑、本机自动保存、故事概念与设定库、四类 AI 生成、预览后采纳、四步建书工作流、多草稿与建书历史、章节版本历史及差异高亮、逐章生成正文候选、续写与重写、多候选保存及现稿差异对照、新版 JSON 作品及建书记录导入导出、灵感收集、写作统计（每日目标、趋势、码字日历）、编辑器查找替换与字数目标、全量备份与恢复、TXT 阅读稿导出、竞品拆书、拆书分类素材与建书带入、扫榜、移动端适配，以及覆盖文本差异、存储迁移、统计、建书解析、拆书解析、扫榜快照和模型请求转换的逻辑测试。模型管理支持多档案、服务商预设、连接测试、拉取模型列表、思考模式、输出上限和写作/工作流角色路由；Agnes 只在手动选择后启用。未实现：旧版数据迁移、桌面容器、无人值守批量生文、提示词管理和图片生成。超长且大幅改写的段落会整段标记，暂不提供语义级对齐。

### 扫榜与拆书的移植范围

扫榜（对应旧版“小说榜单”）：番茄与七猫两个平台的榜单源、在线抓取与本机快照、手动粘贴榜单页 HTML 或接口 JSON 导入、快照存档导入导出、CSV 导出、名次对照、分类分布、标签风向、竞品跟踪、作者趋势，以及按本机快照生成的三段式 AI 解读。旧版的抓取开关（每日自动补抓）没有移植，改为手动抓取加“同源同日 30 分钟内走缓存”的节流；旧版的作者趋势面板当时被注释，新版按可用功能实现。

拆书（对应旧版“拆书”）：TXT 整本导入、章节识别、逐章 AI 拆解（细纲、关键节点、爽点节奏、设定、人物关系）、前三章黄金三章深拆、失败重试、全书汇总报告、竞品库留存、Markdown 导出与 JSON 导入导出。旧版的拆书历史列表合并为竞品库，靠项目创建时间排序。

新版在旧版能力之外补了一层“分类素材”：拆解产物按人设、节奏、设定、节点、技巧五类聚合，随项目一起分开存放（旧存档读盘时按当前章节与报告重新算出），工作台里可按类查看、按类复制，Markdown 导出也带这一节；建书流程的可用创意、故事主线与章节规划、世界观与规则、主要人物四个字段各有一个“从拆书带入”入口，按字段默认勾选对应类型（技巧／节点+节奏／设定／人设），带入前会停在可编辑的微调步（改过的内容回上一步重选类型不丢，类型改了才按新选择重新生成），确认后追加进字段并作为上下文参与后续 AI 生成。

## 与旧版能力的对应关系

| 旧版能力 | 新版状态 |
|---|---|
| 书架、章节、正文编辑、自动保存 | 已实现基础版本，尚无回收站、拖动排序与卷结构 |
| 参考资料（大纲、角色、设定、时间线、故事线） | 已实现四类资料库与集中编辑，尚无人物关系图、思维导图与图形时间轴 |
| 妙笔 AI 对话 | 已实现为右侧 AI 共创面板，没有多会话管理 |
| 工作流建书 | 已实现四步向导、AI 候选预览、章节提纲生成、多草稿与历史 |
| 自动生文与改稿 | 已实现逐章候选、续写与重写、差异审阅；没有暂停继续的无人值守任务 |
| 灵感和随手记 | 已实现灵感收集与标签，没有每日推荐 |
| 写作统计 | 已实现今日/累计/连续天数、目标进度、趋势与码字日历 |
| 榜单、拆书 | 已实现：扫榜含在线抓取、快照趋势与 AI 解读；拆书含逐章 AI 拆解、全书报告与按类型分开的分类素材（可带入建书流程）。旧版的自动补抓开关、评论抓取与封面生图未移植 |
| 取名、封面生图 | 未实现 |
| 提示词管理 | 未实现，任务提示词固定写在代码里 |
| 备份与多端同步 | 已实现本机全量备份与恢复，没有自动备份和云同步 |
