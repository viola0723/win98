/* ============================================================
 * 桌面图标注册表 —— 增删网站功能只改这个文件！
 * ------------------------------------------------------------
 * type: 'window' 打开内置功能窗口（app 对应 js/apps.js 里的函数名）
 * type: 'link'   打开外部链接（url，新标签页）
 * width/height   窗口初始尺寸（可选；手机端一律默认最大化，忽略此项）
 * showInStartMenu 是否出现在开始菜单（可选，默认 true）
 * ============================================================ */
window.WIN98_MODULES = [
  {
    id: 'about',
    title: '我的电脑',
    icon: 'assets/icons/computer.png',
    type: 'window',
    app: 'about',
    width: 460,
    height: 500
  },
  {
    id: 'mine',
    title: '扫雷',
    icon: 'assets/icons/mine.png',
    type: 'window',
    app: 'mine',
    /* 初始尺寸仅为占位：模块打开后由 js/apps/minesweeper.js 的 fitWindow()
       按当前难度棋盘的实测尺寸自动贴合（此处值 ≈ 初级 9×9 的实测量） */
    width: 262,
    height: 364
  },
  {
    id: 'poker',
    title: '德州扑克',
    icon: 'assets/icons/poker.png',
    type: 'window',
    app: 'poker',
    width: 560,
    height: 720
  },
  {
    id: 'friend-link',
    title: '友情链接',
    icon: 'assets/icons/globe.png',
    type: 'link',
    url: 'https://www.mihoyo.com'
  },
  /* 展览馆：特效作品的统一入口（iframe 加载展厅大厅，渲染器见 js/apps/exhibit.js）。
     新展品不再动这里，全部进馆：① 组件源从本地镜像 ../tools/inspira-ui 拷进 exhibits/src/components/inspira/
     ② exhibits/src/exhibits/ 加 xxx.vue 舞台组件 + manifest.js 加一条记录 → npm run build
     ③ 大厅自动列出（?ex=xxx 直达单个展品；?chrome=0 隐藏返回按钮，供屏保嵌入） */
  {
    id: 'gallery',
    title: '展览馆',
    icon: 'assets/icons/gallery.png',
    type: 'window',
    app: 'exhibit',
    exhibit: 'exhibits/dist/index.html',
    width: 720,
    height: 560
  }
];
