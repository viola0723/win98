# Win98 复古桌面网站

把整个网站做成一张 Windows 98 桌面：每个桌面图标是一个功能模块窗口或一个链接入口。
纯静态、零构建，PC / 手机双端适配。

## 本地运行

双击 `index.html`，或：

```bash
python3 -m http.server 8098
# 打开 http://localhost:8098
```

## 在线访问

通过 GitHub Pages 部署：`https://<用户名>.github.io/win98/`

## 开发文档

- `AGENTS.md` — 项目总结与迭代锚点（先读这个）
- `PROJECT_PLAN.md` — 详细项目规划提示词（架构约定、加模块步骤、路线图）
- `tools/make_icons.py` — 自绘像素图标生成器（需 Pillow），新模块的图标用它生成

## 加一个新桌面图标（30 秒版）

1. `tools/make_icons.py` 里画图标并重跑
2. `js/apps.js` 注册渲染函数（窗口型模块）
3. `js/config.js` 的 `WIN98_MODULES` 加一条记录
