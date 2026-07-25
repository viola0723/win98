# AGENTS.md — 旧电脑（Win98 桌面网站）· 迭代锚点文件

> 给未来的自己 / AI 协作者：读这份文件 30 秒即可上手。

## 文档地图（什么时候读哪份）

| 文件 | 定位 | 什么时候读 |
|---|---|---|
| `AGENTS.md` | 迭代锚点（本文件） | 每次开工必读 |
| `PROJECT_PLAN.md` | 项目宪法：愿景、架构约定、加模块步骤、路线图 | 加模块/动架构前 |
| `THEME.md` | 主题宪章：方向、内容容器规划、作品档案规范 | 开工/阶段收尾各一遍，方向变就迭代版本 |
| `DEVLOG.md` | 迭代日志（只增不删，新→旧） | 写接力上下文、查历史时；平时不读 |
| `PITFALLS.md` | 踩坑录：现象→根因→规则 | 改触屏/窗口/图标相关代码前翻对应类别 |
| `COLLAB.md` | 多电脑协作（换机 setup、pull/push 节奏、在役机器互认） | 换机/凭据/网络问题时 |
| `README.md` | 对外门面 | 基本不用动 |

## 项目一句话

仿 Windows 98 桌面的个人网站「旧电脑」：复古的壳 × 现代的芯——1998 年的桌面里装着 AI 时代的新作品（歌/画/文/游戏/特效），每个桌面图标 = 一个作品/功能模块或一个外链入口，纯静态零构建，模块按 A/B/C 级定多端适配范围（见 PROJECT_PLAN.md §5.4）。

## 当前阶段（只记最近动态，全史见 DEVLOG.md）

- 2026-07-25｜**随身听卡顿定修 = jsDelivr 镜像（钉 commit）+ 回退 + 预载 + 缓冲指示**：github.io 直连实测 23.7KB/s 供不上 256kbps 实时码率（纯网络问题）→ 音频/封面走 `MEDIA_CDN`（钉 commit hash——分支地址 301 落点不稳，已记 PITFALLS）实测 1.8MB/s，error 自动回退本地。push 新歌要同步 hash。双探针 10 断言全过
- 2026-07-25｜**新模块「卡带随身听」上线（A 级，双端 14 断言全过）**：每首歌 = 一盘磁带，点磁带飞行入舱 → 相框封面 + 真实波形 → 自动播放；机身斜二轴测 2.5D、主题色随磁带变色（`--accent`）。`js/apps/tapeplayer.js` 单文件模块（数据注册表 `WIN98_TAPES` 在头部，加歌三步见注释）、波形提取器 `tools/waveform-extractor.html`（OfflineAudioContext，零依赖）、tape.png 图标（24×20 字符矩阵，`make_icons.py` 与一次性 Node 脚本双实现同源——本机无 Python）。原型评审废弃：鼠标视差（没用）、机械音效（不拟真且与音乐混叠）、下载的 3 首 CC 歌（只留原创）。修触屏播放键全灭（tap 处理器漏写 `(e)` 形参，PC 用例漏网，已记 PITFALLS）。默认曲《月之暗面》（用户原创）
- 2026-07-25｜**记忆碎片定性 = 1998 年的老物件**：`FRAG_OBJECTS` 22 件（= 理论最大获得数）洗牌不重复抽取，获得碎片 toast 报物件名；结局定型——成功 = 回信「未来的你，还好吗……会为票根和树叶发呆的少年」+ 晒出拾得清单，失败 = 「坏道无法修复，信件没有找到，请重新开始」（残缺信方案废弃）。双端 30 断言全过
- 2026-07-25｜收尾流程堵漏：清掉上次漏杀的 8098 残留服务（npx http-server）；铁律 9 扩成独立「收尾清单」小节（杀服务必验证端口释放 / 删 `../tools` 本次产物 / 工作区只剩预期改动）；验收脚本定性**一次性**（现写现删，别找旧的，结论在 DEVLOG）；Windows 预览命令补 `-c-1` 禁缓存
- 2026-07-25｜地下城四连修 + 双结局文案重写：踩雷计数器不减根治（remainingFlags 计 exploded + core 钩子先预置状态再回调）；声呐/探测仪不再浪费在已插旗的雷；HUD 金币/碎片加文字标签、碎片去 0/5 只显数量；B11 讲清「无出口须全清」（toast 加可选时长）；好/坏结局信件重写。双端 24 断言全过
- 2026-07-25｜存量 emoji 全量像素化：JS 运行代码 emoji 清零（♠♥♦♣ 仅作数据字符保留）。各模块局部 `PX` 表 + `px()` 内联 SVG（pixelarticons MIT，缺的手绘 24×24）；扑克牌面花色数据不动、渲染走 `suitIcon()`；经典扫雷像素旗/雷/叉/四态黄脸。合流双端 11 断言全过
- 2026-07-24｜iOS/安卓真机触控三连修（`js/touchTap.js` 补发 click + isTrusted 去重、safe-area 让位、开窗吞串扰 click），Playwright 三端断言全过，**真机终验待用户确认**

## 快速上手

```bash
cd win98
python3 -m http.server 8098        # 预览 http://localhost:8098（双击 index.html 也行）
for f in js/*.js; do node --check "$f"; done   # 改动后跑一遍语法检查
```

验证清单：桌面图标出现 → 双击开窗 → 拖标题栏 → 最小化后点任务栏还原 → 开始菜单能开模块和「关机」→ 手机宽度（DevTools ≤640px）窗口自动全屏。

## 架构速览

| 文件 | 职责 |
|---|---|
| `js/config.js` | **图标注册表 `WIN98_MODULES`，增删功能只改这里**；每条记录标注多端适配级别 |
| `js/apps.js` | 模块渲染函数注册表 `WIN98_APPS['id'] = fn(bodyEl, win, cfg)` |
| `js/apps/mine-core.js` | 扫雷共享引擎 `WIN98_MINE_CORE`：棋盘数据/首击安全/输入（点按/右键/长按）/绘制，钩子制；`MODES` 模式注册表（ctx 含 `setGuard` 误触保护登记）；`fitWindowToContent` 锚点=容器根 `.app-mine` |
| `js/apps/minesweeper.js` | 扫雷容器 `WIN98_APPS['mine']`（Tab 切模式，缺失模式自动隐藏 Tab）+ 经典模式（三档+自定义难度） |
| `js/apps/mine-dungeon.js` | 扫雷·寻找时间胶囊（肉鸽）：三职业、装备/消耗品分家、宝箱+商店、11 层主线双结局；数据驱动 CLASSES/GEAR/ITEMS/PACKS；**挂载即 fitWindowToContent** |
| `js/apps/poker.js` | 德州扑克模块（移植自独立版单文件游戏；样式在 style.css 末尾以 `.app-poker` 为作用域） |
| `js/apps/exhibit.js` | 展览馆渲染器：iframe 加载 `cfg.exhibit` 指定的展厅/展品页（exhibits/dist/...） |
| `js/apps/tapeplayer.js` | 卡带随身听（A 级）：数据注册表 `WIN98_TAPES` 在头部（加歌三步见注释）；飞行入带 / 斜二轴测 2.5D 机身 / 相框封面 / 真实波形 seek / 按住快进快退；SVG 按钮非 button 不吃 touchTap，自带 pointerup tap 判定；状态挂 `bodyEl.win98Tape`（+ `win98TapeAudio`） |
| `js/screensaver.js` | 屏幕保护：闲置 60s 全屏播放展品，任意输入退出；`WIN98_SAVER.show()` 供开始菜单预览 |
| `js/windowManager.js` | 窗口生命周期，对外 `WindowManager.open(module)`；动态切换 `#windows` pointer-events（勿静态写死） |
| `js/touchTap.js` | 触屏轻点激活兜底（iOS 真机 click 不派发）：pointerup 校验后 `el.click()` 补发 + isTrusted 去重；鼠标路径不动 |
| `js/desktop.js` | 图标渲染与打开（`WIN98_DESKTOP.openModule`，link→新标签页 / window→开窗）；触屏开窗吞串扰 click |
| `js/taskbar.js` | 任务栏、开始菜单、时钟；`WIN98_TASKBAR.sync()` 由窗口系统回调 |
| `js/main.js` | 启动：渲染桌面 → 初始化任务栏 → 自动打开 about（PC）→ 处理 `#open=` 深链接 |
| `css/98.css` + 字体 | 第三方库（**勿改**）；自定义样式一律进 `css/style.css` |
| `assets/icons/` | 自绘像素图标 PNG（生成器产出，**勿手改**） |
| `tools/make_icons.py` | 像素图标生成器（需 Pillow），加图标：写 `draw_xxx` → 注册 `ICONS` → 重跑 |
| `tools/waveform-extractor.html` | 波形提取器（卡带配套，零依赖）：http 预览下开 `?src=/assets/music/xxx.mp3` 出 duration/peaks JSON |
| `exhibits/` | 展柜工程：现代特效展品（唯一允许构建工具链的目录，Vite+Vue+Tailwind；`dist` 提交进 git、勿 ignore；选题库 inspira-ui.com）。`src/App.vue` 是壳：无参 = 展览馆大厅，`?ex=xxx` 动态加载 `src/exhibits/xxx.vue`，`?chrome=0` 隐藏返回按钮；展品清单 `src/exhibits/manifest.js`（纯数据）；组件源本地镜像 `../tools/inspira-ui` |

脚本加载顺序（index.html）：config → windowManager → touchTap → apps → apps/mine-core → apps/minesweeper → apps/mine-dungeon → apps/poker → apps/exhibit → apps/tapeplayer → desktop → taskbar → screensaver → main。普通 script 标签（非 module），保证 `file://` 可跑（注意：展品 iframe 是 ES module，`file://` 下加载不了，需 http 预览或线上访问）。

## 铁律

1. 配置驱动：图标只注册在 `config.js`，UI 只写在 `apps.js`（或 `js/apps/xxx.js` 单文件模块）。
2. 零构建纯静态，不引框架/打包器/CDN 外链，素材全部本地化（唯一例外：`exhibits/` 展柜目录，构建产物静态化提交进 git）。
3. 桌面壳层（图标/窗口框架/任务栏/开始菜单）必须保持 Win98 观感；窗口内部风格自由（可用 98.css 组件，也可完全自定义——壳守 98、芯可自由，见 THEME.md）。
4. 触屏用 Pointer Events；手机上窗口默认最大化（`WindowManager.isMobile()`）。
5. 每次迭代改完：更新 `config.js` 注释、`DEVLOG.md` 顶部加一条、本文件「当前阶段」重写为最新动态（旧的不留，全史在 DEVLOG）。
6. 修完任何「查了半天才发现」的 bug：在 `PITFALLS.md` 对应类别加一条（现象→根因→规则）。
7. 桌面图标一律自绘像素 PNG（`tools/make_icons.py`）；模块内图标用 **pixelarticons**（MIT）path 内联 SVG（参照 mine-dungeon.js `PX` 表 + `px()`）；emoji 不承担关键状态的唯一表达，增量禁用 emoji 图标（存量清单与理由见 `PITFALLS.md`）。
8. 新模块注册时必须定多端适配级别（A=双端完整 / B=手机可用可简化 / C=PC 优先，定义见 PROJECT_PLAN.md §5.4），验收范围按级别执行。
9. 阶段性收尾必过「收尾清单」（见下节，逐项打钩）：杀临时服务**并验证端口已释放**、删 `../tools/` 下本次临时产物、工作区只剩预期改动。

## 收尾清单（每次阶段收尾逐项打钩，勿凭记忆）

1. **杀临时服务**：本次起过的预览/调试服务全部杀掉，杀完**验证端口真的空了**——Windows：`netstat -ano | grep 8098` 无 LISTENING；Mac：`lsof -i :8098` 无输出。没空就按 PID 补杀（`taskkill //PID <pid> //F`）——**npx 会派生子进程，杀父进程/停后台任务常常不够**。（2026-07-25 教训二连：一次是上次收尾漏杀 npx http-server 把 8098 占了一整天；一次是 TaskStop 只杀了 npx 壳、子进程还占着端口。）
2. **删临时产物**：`../tools/` 下本次的验证脚本、截图、临时 npm 工程（`package.json`/`node_modules`）全删；**保留**长期资产 `../tools/inspira-ui`、`../tools/gh_*`。
3. **工作区干净**：`git status` 只剩本次预期改动；文档已同步（DEVLOG 顶部新条目 + AGENTS 当前阶段 + 有坑则 PITFALLS）。

## 加模块三步（详见 PROJECT_PLAN.md 第 6 节）

1. 图标：在 `tools/make_icons.py` 里加一个 `draw_xxx` 函数并注册进 `ICONS`，运行 `python3 tools/make_icons.py` 生成到 `assets/icons/`（自绘像素风，无版权问题）
2. `apps.js` 注册 `WIN98_APPS['新id']`
3. `config.js` 加一条记录（标定适配级别）→ 按级别验证

## Backlog 快照

Markdown 文章阅读器（我的文档，图标已备 `folder.png`）、右键菜单+属性对话框（作品档案）、画图、图标拖拽排序、壁纸/音效、更多 Inspira 展品（选题表 `exhibits/CANDIDATES.md`，进馆 = `src/exhibits/xxx.vue` + `manifest.js` 一条 + build）、存量 emoji 图标像素化替换。每次只挑一两个，做完不留半成品。

## 环境备忘

- 多电脑协作：见 `COLLAB.md`（新电脑 = clone + 配 push 凭据 + 装 Node；开工 pull、收工 push）
- 预览：本地 8098 端口（Mac：`python3 -m http.server 8098`；Windows 机未装 Python：`npx -y http-server -p 8098 -s -c-1`，`-c-1` 禁缓存防改完刷不到新版）。**起服务前先查端口**（有 LISTENING 说明有残留，先杀再起，查法见收尾清单）
- 加歌/波形提取：音频 + 封面丢 `assets/music/` → 起 8098 后开 `http://localhost:8098/tools/waveform-extractor.html?src=/assets/music/xxx.mp3` 抄 JSON 进 `js/apps/tapeplayer.js` 的 `WIN98_TAPES` 注册表 → push 后把该文件顶部 `MEDIA_CDN` 的 commit hash 更新为最新（`git rev-parse --short HEAD`）
- 无头浏览器：双机均已装 Playwright Chromium，验收截图命令
  `npx -y playwright screenshot --viewport-size=1280,800(或390,844) <url> <输出.png>`
  若报浏览器缺失（CLI 版本与浏览器 build 不配套）：`npx -y playwright install chromium`
- **验收脚本是一次性的**：每次验收现写到 `../tools/`（不进 git），收尾即删——不要去找上一次的脚本，需要历史断言结论就翻 DEVLOG 对应条目；脚本里读棋盘/对局状态用引擎暴露的 `boardEl.win98Board` / `appEl.win98DgRun`，选择器记得加模式作用域（见 PITFALLS 扫雷引擎类）
- 部署：已上线 GitHub Pages —— https://viola0723.github.io/win98/ （仓库 https://github.com/viola0723/win98 ，推送后约 1-3 分钟自动更新）
- GitHub 凭据（双机）：Mac = PAT 存 macOS 钥匙串（repo 权限），`git push` 直接可用；gh CLI 在 `../tools/gh_2.96.0_macOS_amd64/bin/gh`（注意：因 token 只有 repo scope，gh 本体拒绝登录，如需完整 gh 功能要重新设备授权并勾选完整 scope）。Windows 机（`C:/Kimi Code/win98`）= SSH 密钥——私钥在仓库 `.git/ssh/`（不进 git、勿外传），remote 为 `ssh://git@ssh.github.com:443/viola0723/win98.git`，仓库级 `core.sshCommand` 已配好；该机 github.com 直连不稳，克隆备用镜像 `https://gh-proxy.com/https://github.com/viola0723/win98.git`
- 图标版权：已全部替换为自绘像素图标（`tools/make_icons.py`），无版权顾虑；需要新图标就改脚本重跑
- inspira-ui 镜像：`../tools/inspira-ui`（浅克隆，长期保留，勿当临时产物清理；更新用 `git -C ../tools/inspira-ui pull`）
