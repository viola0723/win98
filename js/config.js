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
    width: 280,
    height: 380
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
  /* 展柜：exhibits/ 下的 Inspira UI 特效展品（iframe 加载，渲染器见 js/apps/exhibit.js）。
     未来新展品复用 app: 'exhibit'，只改 id/title 和 exhibit 路径即可 */
  {
    id: 'exhibit-001',
    title: '展品 001',
    icon: 'assets/icons/exhibit.png',
    type: 'window',
    app: 'exhibit',
    exhibit: 'exhibits/dist/index.html',
    width: 640,
    height: 480
  }
];
