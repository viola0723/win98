/* ============================================================
 * 桌面图标注册表 —— 增删网站功能只改这个文件！
 * ------------------------------------------------------------
 * type: 'window' 打开内置功能窗口（app 对应 js/apps.js 里的函数名）
 * type: 'link'   打开外部链接（url，新标签页）
 * width/height   窗口初始尺寸（可选；手机端一律默认最大化，忽略此项）
 * showInStartMenu 是否出现在开始菜单（可选，默认 true）
 *
 * 多端适配分级（每条记录用行尾注释标注，新模块注册必须先定级；
 * 级别定义与验收要求详见 PROJECT_PLAN.md §5.4）：
 *   A = 双端完整适配（核心交互/游戏，双端 Playwright 验收 + 触屏改动真机复测）
 *   B = 手机可用、允许简化呈现（内容展示型，核心内容手机上不可缺失）
 *   C = PC 优先（精确指针操作型，手机端给「建议 PC 体验」兜底，不强行适配）
 * ============================================================ */
window.WIN98_MODULES = [
  {
    id: 'about',
    title: '我的电脑',
    icon: 'assets/icons/computer.png',
    type: 'window',
    app: 'about', /* adapt: B（内容展示） */
    width: 460,
    height: 500
  },
  {
    id: 'mine',
    title: '扫雷',
    icon: 'assets/icons/mine.png',
    type: 'window',
    app: 'mine', /* adapt: A（核心游戏，双端完整） */
    /* 初始尺寸仅为占位：模块打开后由 js/apps/mine-core.js 的 fitWindowToContent()
       按当前模式/难度棋盘的实测尺寸自动贴合（此处值 ≈ 经典初级 9×9 + Tab 行的实测量） */
    width: 262,
    height: 364
  },
  {
    id: 'poker',
    title: '德州扑克',
    icon: 'assets/icons/poker.png',
    type: 'window',
    app: 'poker', /* adapt: A（核心游戏，双端完整） */
    width: 560,
    height: 720
  },
  {
    id: 'friend-link',
    title: '友情链接',
    icon: 'assets/icons/globe.png',
    type: 'link', /* 外链跳转，无适配分级 */
    url: 'https://www.mihoyo.com'
  },
  /* 展览馆：特效作品的统一入口（iframe 加载展厅大厅，渲染器见 js/apps/exhibit.js）。
     新展品不再动这里，全部进馆：① 组件源从本地镜像 ../tools/inspira-ui 拷进 exhibits/src/components/inspira/
     ② exhibits/src/exhibits/ 加 xxx.vue 舞台组件 + manifest.js 加一条记录（含 cover 封面：AI 生成
        多画风候选挑一张 → ffmpeg 1024px -q:v 3 压缩 → public/covers/xxx.jpg，4:3 无字纯画）→ npm run build
     ③ 大厅自动列出（封面画自动进画框轮播、享受单灯追画+黑镜倒影；?ex=xxx 直达单个展品；
        ?chrome=0 嵌入模式 = 隐藏返回按钮 + 展品按 bare prop 精简渲染，供屏保） */
  {
    id: 'gallery',
    title: '展览馆',
    icon: 'assets/icons/gallery.png',
    type: 'window',
    app: 'exhibit', /* adapt: B（内容展示，手机端允许简化） */
    exhibit: 'exhibits/dist/index.html',
    width: 720,
    height: 560
  },
  /* 卡带随身听：数据注册表 WIN98_TAPES 与加歌流程见 js/apps/tapeplayer.js 头部注释 */
  {
    id: 'tape',
    title: '卡带随身听',
    icon: 'assets/icons/tape.png',
    type: 'window',
    app: 'tape', /* adapt: A（核心交互，双端完整） */
    width: 970,
    height: 480
  }
];
