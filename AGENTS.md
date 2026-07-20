# AGENTS.md — Win98 桌面网站 · 迭代锚点文件

> 给未来的自己 / AI 协作者：读这份文件 30 秒即可上手。详细设计规范见同目录 `PROJECT_PLAN.md`（项目宪法），两份文件要保持同步。

## 项目一句话

仿 Windows 98 桌面的个人网站：每个桌面图标 = 一个功能模块窗口或一个外链入口，纯静态零构建，PC/手机双端适配。

## 当前状态（v0.1，2026-07-20）

- 已可用：桌面图标渲染、窗口系统（拖拽/置顶/最小化/最大化/关闭/单例）、任务栏（开始按钮、开始菜单、任务按钮、时钟）、关机彩蛋、手机端适配（窗口默认最大化、双触打开图标）
- 已有模块（见 `js/config.js`）：我的电脑(about)、记事本(notepad)、计算器(calculator)、友情链接(link 示例)、回收站(recycle)
- 图标已全部替换为自绘无版权像素图标（`tools/make_icons.py` 生成，微软原版素材已移除）
- 待办决策：无头浏览器、GitHub Pages 部署（见文末「环境备忘」）

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
| `js/windowManager.js` | 窗口生命周期，对外 `WindowManager.open(module)` |
| `js/desktop.js` | 图标渲染与打开（`WIN98_DESKTOP.openModule`，link→新标签页 / window→开窗） |
| `js/taskbar.js` | 任务栏、开始菜单、时钟；`WIN98_TASKBAR.sync()` 由窗口系统回调 |
| `js/main.js` | 启动：渲染桌面 → 初始化任务栏 → 自动打开 about |
| `css/98.css` + 字体 | 第三方库（**勿改**）；自定义样式一律进 `css/style.css` |
| `assets/icons/` | 自绘像素图标 PNG（生成器产出，**勿手改**） |
| `tools/make_icons.py` | 像素图标生成器（需 Pillow），加图标：写 `draw_xxx` → 注册 `ICONS` → 重跑 |

脚本加载顺序（index.html）：config → windowManager → apps → desktop → taskbar → main。普通 script 标签（非 module），保证 `file://` 可跑。

## 铁律

1. 配置驱动：图标只注册在 `config.js`，UI 只写在 `apps.js`（或 `js/apps/xxx.js` 单文件模块）。
2. 零构建纯静态，不引框架/打包器/CDN 外链，素材全部本地化。
3. 新模块 UI 必须用 98.css 组件类，保持 Win98 观感。
4. 触屏用 Pointer Events；手机上窗口默认最大化（`WindowManager.isMobile()`）。
5. 每次迭代改完：更新 `config.js` 注释、本文件「当前状态」、`PROJECT_PLAN.md` 第 8 节。

## 加模块三步（详见 PROJECT_PLAN.md 第 6 节）

1. 图标：在 `tools/make_icons.py` 里加一个 `draw_xxx` 函数并注册进 `ICONS`，运行 `python3 tools/make_icons.py` 生成到 `assets/icons/`（自绘像素风，无版权问题）
2. `apps.js` 注册 `WIN98_APPS['新id']`
3. `config.js` 加一条记录 → 双端验证

## Backlog 快照

扫雷（图标已备 `mine.png`）、Markdown 文章阅读器（我的文档，图标已备 `folder.png`）、画图、留言板、图标拖拽排序、右键菜单、壁纸/音效。每次只挑一两个，做完不留半成品。

## 环境备忘

- 预览：本地 8098 端口（`python3 -m http.server 8098`）
- 无头浏览器：（待安装）用于改动后自动截图验收双端渲染
- 部署：（待办）目标 GitHub Pages，仓库未建
- 图标版权：已全部替换为自绘像素图标（`tools/make_icons.py`），无版权顾虑；需要新图标就改脚本重跑
