# AGENTS.md — 旧电脑（Win98 桌面网站）· 迭代锚点文件

> 给未来的自己 / AI 协作者：读这份文件 30 秒即可上手。详细设计规范见同目录 `PROJECT_PLAN.md`（项目宪法），两份文件要保持同步。主题与发展方向见 `THEME.md`：每次项目开启 / 阶段收尾都读一遍，方向有变就迭代它的版本。

## 项目一句话

仿 Windows 98 桌面的个人网站「旧电脑」：复古的壳 × 现代的芯——1998 年的桌面里装着 AI 时代的新作品（歌/画/文/游戏/特效），每个桌面图标 = 一个作品/功能模块或一个外链入口，纯静态零构建，PC/手机双端适配。

## 当前状态（v0.7，2026-07-23）

- 展柜工程优化落地：① inspira-ui 组件源本地镜像就位（浅克隆 `../tools/inspira-ui`，组件源在 `app/components/inspira/ui/<组件名>/`；官方 CLI 验证结论：shadcn-vue CLI + inspira registry 支持纯 Vite，但依赖体系重，本项目坚持镜像手工拷贝，结论详见 `exhibits/CANDIDATES.md` 待办区）② 展品页 `?ex=` 参数路由：`exhibits/src/App.vue` 改为路由壳，`import.meta.glob('./exhibits/*.vue')` 按参数动态加载，新展品 = 加 `src/exhibits/xxx.vue` + rebuild + config.js 传 `?ex=xxx`，壳代码零改动；无参/未知参数自动列出全部展品
- 扫雷模块修复+增强：修掉 PC 端窗口默认尺寸总比内容小一截的问题（fitWindow 改为按棋盘实测尺寸反推窗口，勿再用估算常数）；修掉手机端中/高级横滚后左侧内容永远看不到的问题（`.app-mine` 弃用 `align-items:center` 负溢出，改 `margin-inline:auto` 居中）；新增 chord 快开（点已翻开数字格、周围旗数凑够时批量翻开）、按下 😮 反馈、每难度最佳时间记录（localStorage `win98.mine.best.*`）；雷区凹框改经典银灰底
- 定名「旧电脑」，新增主题宪章 `THEME.md`（现 v1.1）：确立"复古壳 × 现代芯"方向、slogan「机器会旧，人会老，想象力不会」、内容容器规划（文/画/歌/视频/屏保/游戏）、作品档案（右键属性）规范
- 「现代的芯」双通道落地：欢迎窗原生特效（星空跃迁 Canvas + 乱序解码标题，零依赖）＋ `exhibits/` 展柜通道（唯一允许构建的目录：Vite+Vue+Tailwind，dist 提交进 git；通用 iframe 渲染器 `js/apps/exhibit.js`，新展品只改 `config.js` 的 exhibit 路径；选题表 `exhibits/CANDIDATES.md`）
- URL 深链接：`#open=模块id` 直接打开对应窗口（便于分享与自动化验收）
- 已可用：桌面图标渲染、窗口系统（拖拽/置顶/最小化/最大化/关闭/单例/右下角拖柄自由缩放）、任务栏（开始按钮、开始菜单、任务按钮、时钟）、关机彩蛋、手机端适配（窗口默认最大化、双触打开图标）
- 已有模块（见 `js/config.js`）：我的电脑(about)、扫雷(mine)、德州扑克(poker)、友情链接(link → mihoyo.com)、展品 001(exhibit → 流星雨，组件来自 inspira-ui/Meteors，MIT)
- 已下架：记事本、计算器、回收站、留言本（渲染函数已从 apps.js 一并移除，git 历史可恢复）
- 图标已全部替换为自绘无版权像素图标（`tools/make_icons.py` 生成，微软原版素材已移除）
- 已部署 GitHub Pages（见文末「环境备忘」），无头浏览器截图验收流程已就绪

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
| `js/config.js` | **图标注册表 `WIN98_MODULES`，增删功能只改这里** |
| `js/apps.js` | 模块渲染函数注册表 `WIN98_APPS['id'] = fn(bodyEl, win, cfg)` |
| `js/apps/minesweeper.js` | 扫雷模块（大模块单文件示例，index.html 里单独 `<script>` 引入） |
| `js/apps/poker.js` | 德州扑克模块（移植自独立版单文件游戏；样式在 style.css 末尾以 `.app-poker` 为作用域） |
| `js/apps/exhibit.js` | 展柜通用渲染器：iframe 加载 `cfg.exhibit` 指定的展品页（exhibits/dist/...） |
| `js/windowManager.js` | 窗口生命周期，对外 `WindowManager.open(module)` |
| `js/desktop.js` | 图标渲染与打开（`WIN98_DESKTOP.openModule`，link→新标签页 / window→开窗） |
| `js/taskbar.js` | 任务栏、开始菜单、时钟；`WIN98_TASKBAR.sync()` 由窗口系统回调 |
| `js/main.js` | 启动：渲染桌面 → 初始化任务栏 → 自动打开 about（PC）→ 处理 `#open=` 深链接 |
| `css/98.css` + 字体 | 第三方库（**勿改**）；自定义样式一律进 `css/style.css` |
| `assets/icons/` | 自绘像素图标 PNG（生成器产出，**勿手改**） |
| `tools/make_icons.py` | 像素图标生成器（需 Pillow），加图标：写 `draw_xxx` → 注册 `ICONS` → 重跑 |
| `exhibits/` | 展柜工程：现代特效展品（唯一允许构建工具链的目录，Vite+Vue+Tailwind；`dist` 提交进 git、勿 ignore；选题库 inspira-ui.com）。`src/App.vue` 是路由壳，按 `?ex=xxx` 动态加载 `src/exhibits/xxx.vue`；组件源本地镜像 `../tools/inspira-ui` |

脚本加载顺序（index.html）：config → windowManager → apps → apps/minesweeper → apps/poker → apps/exhibit → desktop → taskbar → main。普通 script 标签（非 module），保证 `file://` 可跑（注意：展品 iframe 是 ES module，`file://` 下加载不了，需 http 预览或线上访问）。

## 铁律

1. 配置驱动：图标只注册在 `config.js`，UI 只写在 `apps.js`（或 `js/apps/xxx.js` 单文件模块）。
2. 零构建纯静态，不引框架/打包器/CDN 外链，素材全部本地化（唯一例外：`exhibits/` 展柜目录，构建产物静态化提交进 git）。
3. 新模块 UI 必须用 98.css 组件类，保持 Win98 观感。
4. 触屏用 Pointer Events；手机上窗口默认最大化（`WindowManager.isMobile()`）。
5. 每次迭代改完：更新 `config.js` 注释、本文件「当前状态」、`PROJECT_PLAN.md` 第 8 节。
6. 阶段性收尾：提交部署前，杀掉本地临时服务（如 `python3 -m http.server 8098`）、删除临时验证脚本/截图等产物（仓库外 `../tools/` 下的东西），工作区保持干净。

## 加模块三步（详见 PROJECT_PLAN.md 第 6 节）

1. 图标：在 `tools/make_icons.py` 里加一个 `draw_xxx` 函数并注册进 `ICONS`，运行 `python3 tools/make_icons.py` 生成到 `assets/icons/`（自绘像素风，无版权问题）
2. `apps.js` 注册 `WIN98_APPS['新id']`
3. `config.js` 加一条记录 → 双端验证

## Backlog 快照

Markdown 文章阅读器（我的文档，图标已备 `folder.png`）、右键菜单+属性对话框（作品档案）、画图、图标拖拽排序、壁纸/音效、更多 Inspira 展品（选题表 `exhibits/CANDIDATES.md`，走 `src/exhibits/xxx.vue` + `?ex=xxx` 流程）。每次只挑一两个，做完不留半成品。

## 环境备忘

- 预览：本地 8098 端口（`python3 -m http.server 8098`）
- 无头浏览器：已装 Playwright Chromium，验收截图命令
  `npx -y playwright screenshot --viewport-size=1280,800(或390,844) <url> <输出.png>`
- 部署：已上线 GitHub Pages —— https://viola0723.github.io/win98/ （仓库 https://github.com/viola0723/win98 ，推送后约 1-3 分钟自动更新）
- GitHub 凭据：token 已存 macOS 钥匙串（repo 权限），`git push` 直接可用；本机 gh CLI 在 `../tools/gh_2.96.0_macOS_amd64/bin/gh`（注意：因 token 只有 repo scope，gh 本体拒绝登录，如需完整 gh 功能要重新设备授权并勾选完整 scope）
- 图标版权：已全部替换为自绘像素图标（`tools/make_icons.py`），无版权顾虑；需要新图标就改脚本重跑
- inspira-ui 镜像：`../tools/inspira-ui`（浅克隆，长期保留，勿当临时产物清理；更新用 `git -C ../tools/inspira-ui pull`）
