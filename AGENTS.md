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

- 2026-08-09｜**展品 004「大哥大」：img2threejs 首件 AI 重建展品，8 pass 质量门全过（双端 24 断言全过）**：`../tools/img2threejs`（v1.4.3）+ Kimi 适配层 `~/.agents/skills/img2threejs/SKILL.md`（便携 Python `../tools/python-embed`，`._pth` 要写 stage 目录）；参考图 dreamina 生成（4.0/5.0Pro 混合出候选用户挑）。流程：spec 手工深化（`../tools/i2t-runs/dynatac/deepen_spec.py` 幂等）→ 8 pass「生成骨架 → `refine_ts.py` 精修 → `?review=` 评审页截图 → Tier1 诊断 → 对比图人评 → 记录同步」。坑四枚（PITFALLS 已记）：root scale 必须 [1,1,1]（尺寸烘焙进几何，否则子件继承缩放飞出）；OrbitControls 每帧 lookAt 会抹掉取景（target 同步包围盒中心，roll 只能滚模型）；Tier1 IoU 是全图逐像素比对（取景比例/位置必须贴参考图，有扫参法）；Tier1 色彩门对 <1% 饱和点缀色系统性误报（kmeans k=5 + ACES 偏暗，按透明原则记录继续）。产物：工厂 `exhibits/src/models/`、展品壳 `brickphone.vue`（转台 90s）、封面油画静物（dreamina 四候选选定）。落选素材与流水线档案留 `../tools/i2t-runs/dynatac/`

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
| `js/screensaver.js` | 屏幕保护：闲置 5 分钟全屏播放展品，任意输入退出；`WIN98_SAVER.show()` 供开始菜单预览 |
| `js/windowManager.js` | 窗口生命周期，对外 `WindowManager.open(module)`；动态切换 `#windows` pointer-events（勿静态写死） |
| `js/touchTap.js` | 触屏轻点激活兜底（iOS 真机 click 不派发）：pointerup 校验后 `el.click()` 补发 + isTrusted 去重；鼠标路径不动 |
| `js/desktop.js` | 图标渲染与打开（`WIN98_DESKTOP.openModule`，link→新标签页 / window→开窗）；触屏开窗吞串扰 click |
| `js/taskbar.js` | 任务栏、开始菜单、时钟；`WIN98_TASKBAR.sync()` 由窗口系统回调 |
| `js/main.js` | 启动：渲染桌面 → 初始化任务栏 → 自动打开 about（PC）→ 处理 `#open=` 深链接 |
| `css/98.css` + 字体 | 第三方库（**勿改**）；自定义样式一律进 `css/style.css` |
| `assets/icons/` | 自绘像素图标 PNG（生成器产出，**勿手改**） |
| `tools/make_icons.py` | 像素图标生成器（需 Pillow），加图标：写 `draw_xxx` → 注册 `ICONS` → 重跑 |
| `tools/waveform-extractor.html` | 波形提取器（卡带配套，零依赖）：http 预览下开 `?src=/assets/music/xxx.mp3` 出 duration/peaks JSON |
| `exhibits/` | 展柜工程：现代特效展品（唯一允许构建工具链的目录，Vite+Vue+Tailwind；`dist` 提交进 git、勿 ignore；选题库 inspira-ui.com）。`src/App.vue` 是壳：无参 = 展览馆大厅（无字画框轮播：CSS 虚空 + 单灯追画 + 黑镜倒影，封面在 `public/covers/` 由 manifest 的 `cover` 指定），`?ex=xxx` 动态加载 `src/exhibits/xxx.vue`，`?chrome=0` 隐藏返回按钮，`?review=<模型名>` = img2threejs 评审隐藏路由（加载 `src/models/*.ts` 工厂，参数 bg/az/el/margin/cy/roll/ax/flat/lights，确定性截图用）；展品清单 `src/exhibits/manifest.js`（纯数据）；`src/models/` = img2threejs 生成的模型工厂（three/addons 风格 import）；组件源本地镜像 `../tools/inspira-ui` |

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
2. **删临时产物**：`../tools/` 下本次的验证脚本、截图、临时 npm 工程（`package.json`/`node_modules`）全删；**保留**长期资产 `../tools/inspira-ui`、`../tools/gh_*`、`../tools/ffmpeg`。
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
- 加歌：① 源音频 + 封面丢 `assets/music/`，**先压缩**（国内通道刚需）：优先本机 ffmpeg（mp3 `-b:a 128k -ar 44100`、封面长边 512px `-q:v 4`，覆盖同名文件）；零安装兜底 = `tools/audio-optimizer.html?src=/assets/music/xxx.mp3&cover=/assets/music/xxx.jpg` ② 波形：ffmpeg 解码 s16le mono 44100 管道进 Node 脚本复刻提取器算法（N=112 RMS，参考 DEVLOG 2026-07-26 新歌二连），或浏览器 `tools/waveform-extractor.html?src=/assets/music/xxx.mp3` 抄 duration/peaks ③ `js/apps/tapeplayer.js` 的 `WIN98_TAPES` 加一条
- 本机 ffmpeg：`../tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg.exe`（6.1.1 gyan essentials，含 libmp3lame/libopus/x264/x265，解码冒烟已过；装法 `cd ../tools/ffmpeg && npm i ffmpeg-static`，长期资产勿清）。大文件/批量音视频处理优先用它，`tools/audio-optimizer.html` 仍是零安装兜底
- 无头浏览器：双机均已装 Playwright Chromium，验收截图命令
  `npx -y playwright screenshot --viewport-size=1280,800(或390,844) <url> <输出.png>`
  若报浏览器缺失（CLI 版本与浏览器 build 不配套）：`npx -y playwright install chromium`
- **验收脚本是一次性的**：每次验收现写到 `../tools/`（不进 git），收尾即删——不要去找上一次的脚本，需要历史断言结论就翻 DEVLOG 对应条目；脚本里读棋盘/对局状态用引擎暴露的 `boardEl.win98Board` / `appEl.win98DgRun`，选择器记得加模式作用域（见 PITFALLS 扫雷引擎类）
- 部署：已上线 GitHub Pages —— https://viola0723.github.io/win98/ （仓库 https://github.com/viola0723/win98 ，推送后约 1-3 分钟自动更新）
- GitHub 凭据（双机）：Mac = PAT 存 macOS 钥匙串（repo 权限），`git push` 直接可用；gh CLI 在 `../tools/gh_2.96.0_macOS_amd64/bin/gh`（注意：因 token 只有 repo scope，gh 本体拒绝登录，如需完整 gh 功能要重新设备授权并勾选完整 scope）。Windows 机（`C:/Kimi Code/win98`）= SSH 密钥——私钥在仓库 `.git/ssh/`（不进 git、勿外传），remote 为 `ssh://git@ssh.github.com:443/viola0723/win98.git`，仓库级 `core.sshCommand` 已配好；该机 github.com 直连不稳，克隆备用镜像 `https://gh-proxy.com/https://github.com/viola0723/win98.git`
- 图标版权：已全部替换为自绘像素图标（`tools/make_icons.py`），无版权顾虑；需要新图标就改脚本重跑
- inspira-ui 镜像：`../tools/inspira-ui`（浅克隆，长期保留，勿当临时产物清理；更新用 `git -C ../tools/inspira-ui pull`）
- img2threejs 流水线：`../tools/img2threejs`（v1.4.3 钉版，长期保留）+ 便携 Python `../tools/python-embed`（stdlib 专用，embeddable zip；`python312._pth` 已配 forge 各 stage 目录，**勿改勿删**）+ Kimi 适配 skill `~/.agents/skills/img2threejs/SKILL.md`（完整命令序列与评审页参数）。单图 → three.js 展品全流程：dreamina 出参考图候选用户挑 → spec 深化 → 8 pass 评审闭环 → `src/models/` 工厂 + 展品壳 + 封面。运行档案 `../tools/i2t-runs/<物体名>/`（含 spec/reviewHistory/对比图/落选素材）
