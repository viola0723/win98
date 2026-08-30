# PITFALLS.md — 旧电脑 · 踩坑录

> 修 bug 修出来的经验教训，按类别归档。每条 = 现象 → 根因 → 规则，三行说完。
> **累积义务（铁律 6）**：修完任何「查了半天才发现」的 bug，必须在对应类别加一条；改某块代码前，先翻翻对应类别。
> 详细事故经过见 `DEVLOG.md` 对应日期的条目。

## 触屏 / 移动端（本项目中招最密集区）

- **iOS 真机窗口内 click 整个不派发**（2026-07-24）
  现象：iPhone 上窗口内按钮/格子轻点全灭，但 pointerdown、长按计时器正常。
  根因：WebKit 点击命中测试与 DOM 事件不一致的怪癖（与 `#windows` 曾设 `pointer-events:none` 同源），无头 WebKit 复现不了，真机专属。
  规则：触屏激活不能依赖系统合成 click——`js/touchTap.js` 在 pointerup 校验后 `el.click()` 补发（时长 ≤600ms、位移 ≤12px、起落同控件）。**TAP_MS 600 必须 > 扫雷长按判定 450ms**。
- **Android Chrome 的 pointerdown preventDefault() 抑不住原生 click**（2026-07-24）
  现象：安卓上每次点按 = 补发 click + 原生 click 双发，按钮被「点两次」。
  根因：平台差异（iOS 可抑制，安卓不行），别信「preventDefault 一定抑制合成 click」的假设。
  规则：补发/原生去重用 **`isTrusted` 判定**——补发事件（不可信）永远放行，补发后 700ms 内的可信 click 一律吞；不按命中控件比对（DOM/inert 重定向会骗过比对）；新 pointerdown 作废旧记录。
- **inert 会让迟到的幽灵 click 改道**（2026-07-24）
  现象：确认框一弹出就被「自己」瞬间关掉。
  根因：模态框给 app 根元素上 `inert` 后原按钮退出命中测试，迟到的原生 click 被重定向到弹窗遮罩，被当成「点空白取消」。
  规则：模态框 + 事件吞并逻辑联保时，吞并判定不能依赖事件落在哪个元素上。
- **iOS 下父元素 `pointer-events:none` 会断子元素触摸**（2026-07-24）
  现象：iOS 上开窗后窗口内容全部点不动，桌面却正常。
  根因：iOS Safari 下 `#windows` 设 `pointer-events:none` 时，子元素声明 `auto` 也接收不到触摸（与桌面浏览器行为不同）。
  规则：`windowManager.js` 动态切换——有最大化窗口时 `#windows` 设 `auto`，否则恢复 `none` 不挡桌面。勿再静态写死。
- **刘海/状态栏会吃掉最大化窗口的标题栏按钮**（2026-07-23）
  现象：iOS 真机上最大化窗口的最小化/最大化/关闭点不动。
  根因：按钮陷进 safe-area，iOS 把该区域触摸拦截给系统；无头浏览器没有刘海，测不出来。
  规则：`#windows` 四向让出 `env(safe-area-inset-*)`；触屏热区 `@media (pointer: coarse)` 加大到 32×28。
- **触屏开窗的合成 click 会落进新窗口**（2026-07-23）
  现象：手机双触图标开窗，紧随的合成 click 落在图标原位置——已是新窗口内容，直接误点。
  根因：pointerup 同步开窗，浏览器随后派发的 click 按屏幕坐标派发。
  规则：`desktop.js` 开窗即 `suppressNextClick()`（capture 拦截，新 pointerdown 撤防，500ms 兜底）。
- **长按插旗后的「防误吞」别用布尔标志**（2026-07-24）
  现象：补发 click 路径下，长按后下一次轻点被误吞。
  根因：布尔 `suppressClick` 在补发链路会残留。
  规则：用时间戳判定（`lastFlagTime` + 700ms 窗口），不用布尔。
- **其他已立过的移动端规矩**：触屏一律 Pointer Events（铁律 4）；手机上双击节奏不可靠——触屏打开图标不设时限（点选后再点一次即开）；body 级 `touch-action: manipulation` 防 iOS 双击缩放（iOS 10+ 忽略 user-scalable=no）；`color-scheme: light` 防 iOS 深色模式反色控件；长按交互配 `-webkit-touch-callout:none`。
- **Playwright WebKit 的合成 tap 在全屏覆盖层上不派发事件**（harness 局限，真机正常）——屏保退出这类用例要手动 dispatch pointerdown 验证，别误判成产品 bug。
- **容器 setPointerCapture 后 pointerup 的 target 恒为容器自身**（2026-08-09）
  现象：展览馆大厅点「画框」完全无响应，但拖拽、箭头按钮都正常；PC 鼠标与触屏同样中招。
  根因：墙容器在 pointerdown 时 `setPointerCapture(pointerId)`，后续 move/up 全部被重定向到容器，pointerup 的 `e.target` 恒为容器本身，`e.target.closest('[data-idx]')` 永远拿不到实际点中的画框。
  规则：拖拽容器上做 tap 判定时，用 `document.elementFromPoint(clientX, clientY)` 解析命中目标，别信 pointerup 的 target。
- **非 `<button>` 自定义控件（SVG `<g>` 等）吃不到 touchTap；激活处理器别漏写 `(e)` 形参**（2026-07-25）
  现象：卡带随身听触屏点播放/停止/退带全灭，PC 鼠标却正常。
  根因：两层——① `js/touchTap.js` 只给 `button` / 开始菜单 `li` / 关机遮罩补发 click，SVG `<g>` 控件不在其列，必须自己在 pointerup 校验时长/位移后激活；② 自实现 tap 判定的事件处理器漏写 `(e)` 形参还引用了 `e.clientX`，抛 ReferenceError，激活逻辑整个死掉。
  规则：新控件先看构成（button 白捡 touchTap；非 button 自己写 pointerup tap 判定 ≤600ms/≤12px）；事件处理器形参写全再引用；**PC 探针没点过的路径 = 没测过**（本次 play 键在 PC 用例里恰好从未被点，bug 漏网到触屏用例才暴露——双端用例要覆盖同一组交互）。

## 窗口系统

- **fitWindowToContent 锚点必须是容器根**（2026-07-23）
  现象：扫雷窗口算出来的贴合尺寸总比内容小一截。
  根因：锚在模式内层根，少算了容器 Tab 行高度；更早还用过估算常数，同样不准。
  规则：锚点统一为容器根 `.app-mine`（含 Tab 行），按内容实测反推，禁用估算常数。
- **挂载即 fit，勿等数据就绪**（2026-07-23）
  现象：PC 切扫雷模式 Tab 瞬间窗口不贴合、内容被裁。
  根因：`fitWindowToContent` 只在选完职业（startFloor）执行，过渡期间窗口沿用上模式尺寸。
  规则：内容一挂载就 fit；后续尺寸变化再 fit 一次。

## 扫雷引擎（mine-core / 模式钩子）

- **模式方在钩子里读到的必须是「已应用」的状态**（2026-07-25）
  现象：地下城踩雷后左上剩余雷计数器不减。
  根因：双层——`remainingFlags()` 没减 exploded（已爆雷仍占「未发现」名额）；且 core 先调 `onMineHit` 钩子、返回 false 后才置 exploded，模式方在钩子里 refresh HUD，算出的永远是爆前状态。
  规则：① 凡「视为已确认的雷」的状态（flagged/known/exploded），`remainingFlags` 与 chord 两处口径必须同步收录；② core 钩子一律**先预置状态再回调**（onMineHit 预置 exploded/revealed，致命再收回），写新钩子时就按这个顺序设计。
- **探测类功能的池子要排除「已发现」**（2026-07-25）
  现象：声呐脉冲/探测仪会标记玩家已插旗的雷，白白浪费一次道具。
  根因：`markRandomMines` / `unmarkedMines()` 的候选池只排除 known/revealed，没排除 flagged。
  规则：「可标记」= 雷 && !known && !revealed && !flagged；已插旗即已发现，任何自动标记功能不得重复消费。
- **验收脚本选择器撞名会读出「假 bug」**（2026-07-25）
  现象：Playwright 断言「踩雷后 LCD 不变」失败，但手动调 `remainingFlags()` 返回值正确。
  根因：经典与地下城面板的 LCD 同名 `[data-role="mines"]`，`querySelector` 命中先挂载的经典面板，读数永远不动。
  规则：两模式共享容器、data-role 大量同名（mines/panel/board/face…），验收脚本一律加模式作用域（如 `.app-mine-dg [data-role="mines"]`）。

## 素材 / 图标

- **98.css 按钮文字是「透明字 + text-shadow」画的**（2026-07-25）
  现象：button 内嵌 svg 图标用 `fill="currentColor"` 渲染成全透明、完全不可见。
  根因：98.css `button { color:transparent; text-shadow:0 0 #222 }`——字是阴影画的，currentColor = 透明。
  规则：98.css 按钮内的 svg/图标必须显式 `fill`（enabled #222 / disabled grey，见 style.css `.app-mine-dg button svg.px-icon`）；按钮外的普通元素用 currentColor 没问题。
- **Unicode/emoji 跨端渲染不可控**（2026-07-25 立规）
  现象：同一个 emoji，iOS 是彩色大图、Windows 可能单色甚至缺字豆腐块、安卓随厂商 ROM 各异；尺寸基线也不一致，破坏像素观感。
  规则（铁律 7）：UI 图标增量禁用 emoji——首选 **pixelarticons**（MIT，https://github.com/halfmage/pixelarticons ，取 path 内联 SVG，参照各模块的 `PX` 表 + `px()`；库没有的按 2px 方块风格手绘 24×24 path）；桌面图标仍走 `make_icons.py` 自绘 PNG。emoji 不承担关键状态的唯一表达。
  **通用经验（跨项目）**：图标风格跟项目特点走——本项目是复古壳所以选像素风；其他项目该用更现代/更丰富的库就用（Lucide、Heroicons、Tabler 等，照样 MIT 可内联）。可复用的是机制不是风格：本地化不引 CDN、许可干净、内联 SVG path、显式 fill、建模块级 `PX` 表按需取用。
  存量：**2026-07-25 已全量清零**（mine-dungeon 45、poker 40、minesweeper+mine-core+touchTap 13 全部替换；扑克 ♠♥♦♣ 仅作数据字符保留，渲染走 SVG；`.app-poker` 两处 CSS content 装饰字形未动）。
- 桌面/系统图标版权：已全部自绘（2026-07-20 起微软原版素材移除），新图标只走 `make_icons.py`，禁止网上下载。

## 工程 / 环境

- **hover 位移顶出横向滚动条：滚动容器里 hover transform 必须配 overflow-x:hidden**（2026-08-30）
  现象：随身听架子（`.tp-slots` 独立滚动后）鼠标悬停某行下边框附近，整个架子区域快速抖动；「有时候」才出现。
  根因：`.tp-row:hover { transform: translateX(4px) }` 让行右溢 4px；CSS 规范里 overflow-y:auto 会把 overflow-x:visible 升级为 auto → 溢出即渲染横向滚动条（Windows Chrome 经典滚动条占 ~15px 高）→ 列表内容整体上跳 → 行脱开鼠标 → hover 丢失 → 位移撤销 → 滚动条消失 → 行回位 → hover 恢复……死循环。「有时候」= 只有悬停行贴近可视区底边时上跳才会把它移出鼠标。无头浏览器用 overlay 滚动条不占布局，复现不了。
  规则：滚动/限高容器内若有 hover transform（或任何可能溢出的动效），显式写死 `overflow-x:hidden`；验收指标要看「滚动条出现与否」（clientHeight 变化），scrollWidth 在 hidden 下仍报溢出值，不能当判据。
- **新增 CSS class 前先全仓搜一遍——模块内联 SVG 里也全是 class**（2026-08-30）
  现象：随身听 VOL 分辑标签起名 `.tp-vol`，验收发现页面多出第 4 个空「分辑标签」、搜索过滤也藏不掉它。
  根因：机身内联 SVG 的音量滑杆组早已占用 `class="tp-vol"`（buildPlayerSVG）；SVG 元素的 className 是 SVGAnimatedString 对象，DOM 排查时parent链看着像「没有类名」，且 CSS 规则会同时打到 SVG 组上。
  规则：加新 class 名先全仓 Grep（含 js 里的内联 SVG 字符串）；SVG 组与 HTML 元素同在 document 级选择器范围内，没有「SVG 里撞不到」这回事。
  现象：`npx -y playwright screenshot` 报 `Executable doesn't exist ... chromium_headless_shell-1234`。
  根因：`npx -y` 拉最新 CLI，它要的浏览器 build 比本机已装的新。
  规则：报错即跑 `npx -y playwright install chromium` 升级浏览器；或钉版本（如 `playwright@1.61.1` ↔ chromium-1228，查 `unpkg.com/playwright-core@<版本>/browsers.json` 的 revision）。
- **iframe 内事件不冒泡到父页面**（2026-07-23）
  现象：屏保（iframe 播展品）触发后点不动、退不出。
  规则：覆盖层要能收事件，iframe 必须 `pointer-events:none` 穿透（勿删）；屏保 `show()` 每次重设 `iframe.src`，规避隐藏 iframe 复显的 GPU 合成层怪癖（无头环境复现不了此类问题）。
- **展品 iframe 是 ES module，`file://` 下加载不了**——主站本体坚持 `file://` 可跑（普通 script 标签），但验收展品必须起 http 预览或线上访问。
- 真机专属问题（GPU 合成、safe-area、click 派发）无头浏览器测不出来：无头过了≠真机过了，发布触屏相关改动后必须真机复测。
- **调试「事件发了没反应」先挂 `pageerror` 监听**（2026-07-25）
  现象：Playwright 里元素事件明明触发了，逻辑却没执行，反复猜根因。
  根因：事件处理器内抛异常时 Playwright 默认不输出，表现与「事件没派发」一模一样。
  规则：`page.on('pageerror', ...)` 是第一件乐器，再逐层 spy（capture/bubble 侦听、方法替换）。
- **npx 跑不了 ffmpeg-static；提取波形/时长用浏览器 OfflineAudioContext**（2026-07-25）
  现象：`npx -y ffmpeg-static` 报 `could not determine executable to run`。
  根因：ffmpeg-static 是纯库包（无 bin 入口，只供 require 拿二进制路径），新版 npm 拒绝当 CLI 执行；且其 postinstall 要去 github 拉二进制，本机直连不稳。
  规则：波形提取走 `tools/waveform-extractor.html`（http 预览下 `?src=/assets/music/xxx.mp3` → fetch → OfflineAudioContext.decodeAudioData → 分桶 RMS，零依赖双机通用）；批量提取 = Playwright 脚本开该页读 `#out`（注意 src 相对页面路径解析，传站点根路径）。
- **外部 CDN 镜像媒体文件前：先验它真缓存该文件类型 + 测最终数据落点 + 多时点多测**（2026-07-26）
  现象：jsDelivr 镜像音频「上午测 1.8MB/s 上线、用户照卡」；statically.io / raw.githack.com 本网络直接不可达。
  根因：jsDelivr /gh/ 对 mp3 不缓存，301 甩给 raw.githubusercontent.com（国内极不稳，同 URL 不同时点 1.8MB/s ↔ 335B/s）；钉 commit 只稳住了跳转层，数据层仍看 raw.githubusercontent 脸色。且 error 回退只兜「硬失败」，兜不住「慢而不死」。
  规则：① 验 CDN 方案 = `curl -L -o /dev/null -w "%{speed_download}" <url>` 测**最终落点**，不同时点测多次，别信单次峰值；② 国内访问本站唯一稳定通道实测是 github.io 自身（~24KB/s），素材码率必须压出余量（128kbps = 16KB/s），压缩走 `tools/audio-optimizer.html`。
- **clip-path 会把同元素的 blur 裁成硬边**（2026-08-09）
  现象：CSS 光锥 div 同时写 `clip-path`（梯形）和 `filter: blur()`，边缘依然锋利，渐变透明区末端还有一条硬截止线。
  根因：渲染管线顺序 filter → clip-path → mask——模糊先算、裁剪后算，模糊晕出的部分被 clip 一刀切掉。
  规则：做「柔和的异形发光体」必须拆两层——外层容器 `filter: blur()`，内层元素 `clip-path` + 渐变。
- **img2threejs 生成器把子件挂进带缩放的父节点：root scale 必须 [1,1,1]**（2026-08-09）
  现象：大哥大天线渲染时飞到机身上方一倍多高、还被拉长 2.7 倍。
  根因：生成器 `(nodes["root"] ?? root).add(child)`——parent=null 的子件挂到 id 为 "root" 的组件节点下，继承其 scale；root scale=[1,2.7,0.78] 时子件的坐标与几何同步畸变。
  规则：root 组件 scale 保持 [1,1,1]，机身尺寸直接烘焙进几何参数（refine 层 `RoundedBoxGeometry(1.18,2.65,0.78)`）；所有子件坐标即模型空间坐标。
- **OrbitControls 每帧 update() 会用 lookAt(target) 重置相机朝向**（2026-08-09）
  现象：评审页 `frameXxxCamera` 取景后物体总比预期高半截；`camera.rotateZ` 的 roll 完全无效。
  根因：舞台帧循环每帧 `orbit.update()` 会把相机重新对准 `orbit.target`（默认原点），一切一次性 lookAt/rotateZ 都被逐帧抹掉。
  规则：取景后必须 `orbit.target.copy(包围盒中心)`；roll 效果只能通过滚转模型实现（取景前应用）。
- **Tier1 色彩门对小面积饱和点缀色系统性误报；但报错也可能揪出真 bug**（2026-08-09）
  现象：material-pass 起 per-part deltaE 63 持续超标（红黄绿三个功能键），调 k/提亮材质均无效。
  根因：kmeans k=5 对 <1% 面积的颜色不成簇（上游文档明示 coarse signal）+ ACES 下饱和 albedo 渲染偏暗 20-40；且本例三个键的 recipe 误写成同一红色（真 bug，先修）。
  规则：遇色彩门先核 recipe 本身对不对；确认是点缀色统计盲区后按透明原则记录（像素级证据+对比图人评）继续，不刷分不改 gate。
- **便携 Python（embeddable zip）的 `._pth` 隔离会吃 PYTHONPATH 与脚本目录**（2026-08-09）
  现象：`python.exe forge/stage3_build/generate_threejs_factory.py` 报 `ModuleNotFoundError: orchestrate_passes`（同目录模块）。
  根因：embeddable 发行版的 `python312._pth` 精确控制 sys.path，忽略 PYTHONPATH，也不把脚本所在目录加入。
  规则：把 forge 各 stage 目录（stage1_intake/stage2_spec/stage3_build/stage4_review/_shared）以绝对路径写进 `python312._pth`。
