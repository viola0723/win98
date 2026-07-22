# 旧电脑

一台 1998 年的「旧电脑」，装着 AI 时代的新作品。整个网站是一张仿 Windows 98 的桌面：
每个图标是一个作品/功能模块窗口或一个链接入口——复古的壳 × 现代的芯，要的就是反差感。
纯静态、零构建，PC / 手机双端适配。

## 本地运行

双击 `index.html`，或：

```bash
python3 -m http.server 8098
# 打开 http://localhost:8098
```

## 在线访问

通过 GitHub Pages 部署：**https://viola0723.github.io/win98/**

## 开发文档

- `THEME.md` — 主题宪章：站点定位、内容容器规划、作品档案规范（每次开启/收尾读一遍）
- `AGENTS.md` — 项目总结与迭代锚点（先读这个）
- `PROJECT_PLAN.md` — 详细项目规划提示词（架构约定、加模块步骤、路线图）
- `tools/make_icons.py` — 自绘像素图标生成器（需 Pillow），新模块的图标用它生成
- `exhibits/` — 展柜工程：现代特效展品（唯一允许构建工具链的目录；改动后 `cd exhibits && npm run build` 并把 dist 提交进 git）

## 加一个新桌面图标（30 秒版）

1. `tools/make_icons.py` 里画图标并重跑
2. `js/apps.js` 注册渲染函数（窗口型模块）
3. `js/config.js` 的 `WIN98_MODULES` 加一条记录
