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
    height: 380
  },
  {
    id: 'notepad',
    title: '记事本',
    icon: 'assets/icons/notepad.png',
    type: 'window',
    app: 'notepad',
    width: 520,
    height: 400
  },
  {
    id: 'calculator',
    title: '计算器',
    icon: 'assets/icons/calculator.png',
    type: 'window',
    app: 'calculator',
    width: 280,
    height: 320
  },
  {
    id: 'friend-link',
    title: '友情链接',
    icon: 'assets/icons/globe.png',
    type: 'link',
    url: 'https://example.com'   // TODO: 替换成你自己的链接
  },
  {
    id: 'recycle',
    title: '回收站',
    icon: 'assets/icons/bin.png',
    type: 'window',
    app: 'recycle',
    width: 340,
    height: 240
  }
];
