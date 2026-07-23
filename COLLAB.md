# COLLAB.md — 多电脑协作指南

> 项目本体全部在 GitHub 仓库里（含 `exhibits/dist` 构建产物）。换电脑 = clone + 配推送凭据 + 装 Node，三件套齐活；日常节奏 = 开工 pull、收工 push。

## 新电脑首次 setup（约 5 分钟）

1. 装好 **git** 和 **Node.js**（`node --check` 语法检查、验收脚本都要用，是唯一硬依赖）。
2. `git clone https://github.com/viola0723/win98.git`（公开仓库，clone 不需要登录）。
3. 预览验证：`python3 -m http.server 8098` → http://localhost:8098 ，双击桌面「扫雷」能开窗即正常（没装 Python 的机器用 `npx -y http-server -p 8098 -s`，等价）。
4. **推送凭据**：首次 `git push` 时 git 会要认证 —— GitHub 用户名 + PAT（GitHub 网页 Settings → Developer settings → Personal access tokens 生成，勾 `repo` 权限），填一次后系统凭据管理器会记住，之后免输。
   - 注意：登录的是 git 凭据，不是 VS Code 账户；VS Code 的 GitHub 登录与本流程无关。
   - 备选（github.com 网页/443 直连被墙的网络）：SSH 密钥方案——`ssh-keygen -t ed25519` 生成密钥对，公钥加到 GitHub 网页 Settings → SSH Keys（任何能开 github.com 的设备上加都行，加一次全账号通用）；remote 改用 `ssh://git@ssh.github.com:443/<owner>/<repo>.git`（SSH 走 443 通常能穿墙），配仓库级 `core.sshCommand` 指向私钥即可，push/pull 都不依赖代理。
5. 让 agent 接力：在仓库目录启动 agent，它读 `AGENTS.md`（30 秒上手锚点：当前状态、架构、铁律、环境备忘）即可续作，不需要解释前情。

### 当前在役机器（互认信息）

| 机器 | 仓库位置 | 推送凭据 | 预览 | 备注 |
|---|---|---|---|---|
| Mac（主力） | （本仓库所在机） | PAT 存 macOS 钥匙串；gh CLI 在 `../tools/gh_2.96.0_macOS_amd64/bin/gh` | `python3 -m http.server 8098` | Playwright Chromium 已装 |
| Windows | `C:/Kimi Code/win98` | SSH 密钥（私钥在仓库 `.git/ssh/`，公钥名 `win98-relay-windows`），走 ssh.github.com:443，`core.sshCommand` 已配好 | `npx -y http-server -p 8098 -s`（未装 Python） | Playwright Chromium 已装；github.com 直连不稳，克隆备用镜像 `https://gh-proxy.com/https://github.com/viola0723/win98.git` |

### 按需安装（不做对应工作就不用装）

| 要做什么 | 要装什么 |
|---|---|
| 重新 build 展柜展品 | `cd exhibits && npm install`（`node_modules` 不进 git） |
| 生成新像素图标 | `pip install Pillow`（跑 `tools/make_icons.py`） |
| 无头浏览器验收截图 | `npx -y playwright` + Chromium（命令见 AGENTS.md 环境备忘） |
| 挑新展品组件 | 浅克隆 inspira-ui 镜像到仓库外（`git clone --depth 1`） |

## 日常节奏（所有电脑通用）

- **开工**：`git pull` → 扫一眼 `AGENTS.md` 当前状态 + `git log --oneline -5`，知道另一台电脑最近干了什么。
- **干活**：正常迭代，遵守 `AGENTS.md` 铁律。
- **收工**：`git commit && git push`。铁律 5 要求每轮迭代同步更新 `AGENTS.md` 当前状态与 `PROJECT_PLAN.md` 第 8 节——**这些文档就是接力上下文**，哪台机器的下一个 agent 都靠它们接上思路。
- **不要做**：两台电脑同时压着未提交的改动改同一批文件——必然撞合并冲突，纯属给自己添麻烦。

## 不跟机器走的东西（都无关紧要）

- 浏览器 localStorage（扫雷最佳时间、地下城最深纪录）：本机游戏数据。
- `exhibits/node_modules/`：已 gitignore，需要时 `npm install` 重建。
- 仓库外 `../tools/`（inspira-ui 镜像、gh CLI 等）：随时可重新下载。
- agent 会话历史：由 `AGENTS.md` / `PROJECT_PLAN.md` / `THEME.md` 三份文档替代，在哪台机器读都一样。

## 万一冲突了

`git pull` 报冲突 → 打开冲突文件找 `<<<<<<<` 标记，手动取舍保留哪边 → `git add` + `git commit` 收尾。高发区是 `AGENTS.md`、`js/config.js` 这类人人都动的文件——这正是「收工即 push」最重要的原因。
