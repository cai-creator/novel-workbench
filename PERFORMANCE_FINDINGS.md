# 小说工作台（novel-workbench-next）性能问题清单

测量环境：dev server 127.0.0.1:6793，Chromium，IAB。压测数据：8 部书 × 60 章 × 约 4.2 万字正文 + 每章 30 版历史（主数据 4.97MB），榜单库 200 份快照 × 60 条（4.4MB）。
测试方法：页面内 `performance.now()` 对真实模块（经 Vite ESM 导入）与 UI 交互逐项计时；`countWords` 为 App.vue 内实际实现 `[...(text||'').replace(/\s/g,'')].length`。

| # | 问题 | 位置 | 实测/推断 | 建议方向 |
|---|---|---|---|---|
| P-1 | 编辑器逐键延迟约 959ms/键（大库下）：App.vue 单组件 1600 行，任何一处响应式变化都会重建整个模板的 vdom 并重跑全部绑定 | `src/App.vue`（全局） | 实测 12 次模拟输入总计 11508ms，平均 959ms/键 | 把重列表（章节目录、书架、历史）拆成子组件或 memo 化；活跃屏幕外模板不参与 diff |
| P-2 | 编辑器章节目录 v-for 每行调用 `countWords(item.content)`，绑定随每次渲染重跑：60 章 × 4.2 万字 ≈ 68ms/次 | `src/App.vue:226` | countWords 单章实测 1.13ms × 60 | 每章字数缓存化（按 updatedAt 失效）或由子组件承载 |
| P-3 | 逐章生文侧栏同样的 v-for countWords（60 行列表每次渲染重算全部章节字数） | `src/App.vue:158` | 同上 ≈ 68ms/次 | 同 P-2 |
| P-4 | `bookWords` computed 依赖当前书全部章节内容：任何一键都会对全书 60 章 countWords | `src/App.vue:635` | 实测全书一遍 25.5ms（8 书），单书 ≈ 3.2ms/键 | 字数随 touchChapter 增量维护（chapterLengths 已有现成缓存） |
| P-5 | `countWords` 实现双重分配：先 `replace` 拷贝全串、再 spread 成单字符数组；所有列表/统计的调用成本都被它放大 3–5 倍 | `src/App.vue:698` | 4.2 万字单次 1.13ms；改成单遍循环预计 <0.3ms | 改单遍循环计数（空白跳过，不建中间串/数组） |
| P-6 | 自动保存为 deep watch + 全量 `JSON.stringify`：5MB 库每次落盘停顿约 25ms，且 deep watch 深遍历在每键触发 | `src/App.vue:1054-1063`、`src/storage.ts` | 实测 JSON.parse+stringify 5MB = 24.8ms | 保持 350ms 防抖但把保存改为空闲期（requestIdleCallback 兜底 setTimeout）；遍历成本随 P-1 缓解 |
| P-7 | 章节字数在一键内被重复计算多次：touchChapter 一次、paper-meta 绑定一次、chapterGoalPercent 一次、bookWords 一次 | `src/App.vue:244/851/635/1381` | 单键至少 4 次整章扫描 | 统一收敛到 touchChapter 维护的缓存值，模板只读缓存 |
| P-8 | `selectionMirrorPosition` 每次选区事件把选区起点之前的全文塞进镜像 DOM 再读布局，成本 O(全文)；选中章末尾时最贵 | `src/App.vue:955-967` | 1.3 万字尾部 ≈ 0.4ms，4.2 万字按比例 ≈ 2–6ms/事件 | 镜像只放选区所在行（上一处换行到选区末尾），行内偏移按行高估算 |
| P-9 | 版本历史弹窗列表对每个历史版本 countWords：打开弹窗即 30 版 × 整章扫描 | `src/App.vue:412` | 30 × 1.13ms ≈ 34ms + 渲染 | 保存版本时写入字数（ChapterVersion 冗余一个字段）或弹窗打开时算一次缓存 |
| P-10 | 冷启动同步归一化三库：loadData 25.2ms + loadRankStore 27.2ms + 拆书库（按需加载时才算）；本机合计 ~50ms，慢设备放大 3–5 倍 | `src/storage.ts`、`src/rank.ts:667` | 实测如上；DOM ready 267ms | 榜单/拆书库本就按需加载（组件挂载才读），主数据归一化保留；榜单归一化可分帧或按需 |

## 修正说明（重要）
首轮「逐键 959ms」的数字是**测量假象**：IAB 隐藏标签页里 `setTimeout(20ms)` 被 Chrome 节流钳到 1000ms，12 次模拟输入的 11.5s 几乎全是节流时间。改用微任务排空法（同步段 + Vue 调度器 flush）实测的真实逐键成本为 **约 4.4ms**（优化后）。下表各项的模块级实测数字不受影响（均为同步计时）。

## 修复记录（修完一条在标题后追加）
✅ P-2 已修复（commit ba29e35）：章节目录 v-for 的字数改走 wordOf 缓存（key+内容串命中），重渲染 O(1)。
✅ P-3 已修复（commit ba29e35）：逐章生文列表同上。
✅ P-4 已修复（commit ba29e35）：bookWords 依赖 wordOf 缓存，重渲染不再逐章重扫。
✅ P-5 已修复（commit ba29e35）：countWords 单遍码点计数，口径不变，不再分配中间串/数组。
✅ P-6 已修复（commit ba29e35 + 0ee8ff0）：自动保存防抖后让到 requestIdleCallback；历史版本 markRaw 脱离响应式后 deep watch 追踪量大幅下降（全树遍历实测 40ms → 4.5ms）。
✅ P-7 已修复（commit ba29e35）：paper-meta/chapterGoalPercent/bookWords 统一收敛到 wordOf，一键内不再 4 次整章扫描。
✅ P-8 已修复（commit ba29e35，部分）：选区镜像节点跨事件复用；正文串本身的布局成本保留（完全消除需按行估算，风险大于收益）。
✅ P-9 已修复（commit ba29e35）：历史列表字数走 wordOf（version.id + 内容命中）。
🔶 P-1 部分缓解（commit ba29e35 + 0ee8ff0）：重列表绑定全部缓存化 + 历史脱离响应式后，真实逐键成本约 4.4ms（微任务法实测）；单组件拆分未做，若未来模板继续膨胀再评估。
🔶 P-10 维持现状：榜单/拆书库本就按需加载（切换视图才读），主数据归一化实测 25ms 属可接受冷启动成本，慢设备收益有限不值得引入复杂度。
