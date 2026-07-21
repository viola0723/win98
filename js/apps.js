/* ============================================================
 * 功能模块注册表 —— 每个窗口型桌面图标对应这里的一个渲染函数
 * 新增模块：WIN98_APPS['模块id'] = function (bodyEl, win, cfg) { ... }
 *   bodyEl：窗口内容区域 DOM（.window-body）
 *   win：窗口句柄（win.close() 可关闭窗口）
 *   cfg：config.js 中该模块的配置对象
 * ============================================================ */
window.WIN98_APPS = window.WIN98_APPS || {};
(function () {
  'use strict';

  /* ---------------- 我的电脑（关于本站） ---------------- */
  WIN98_APPS['about'] = function (bodyEl) {
    bodyEl.innerHTML =
      '<div class="app-about">' +
      '  <h3>欢迎来到我的桌面！</h3>' +
      '  <p>这是一个仿 Windows 98 风格的个人网站。桌面上的每个图标都是一个功能模块或一个链接入口，以后会不断增加新图标、新功能。</p>' +
      '  <fieldset>' +
      '    <legend>使用说明</legend>' +
      '    <ul>' +
      '      <li>双击桌面图标，打开对应的功能窗口或链接</li>' +
      '      <li>拖动标题栏可以移动窗口，双击标题栏最大化</li>' +
      '      <li>点击左下角的「开始」按钮，可以看到全部功能</li>' +
      '      <li>手机上访问时，窗口会自动全屏显示</li>' +
      '    </ul>' +
      '  </fieldset>' +
      '  <fieldset>' +
      '    <legend>系统信息</legend>' +
      '    <ul>' +
      '      <li>操作系统：Win98 Web Edition 1.0</li>' +
      '      <li>内存：640K（对任何人来说都应该够用了）</li>' +
      '      <li>硬盘：剩余空间 取决于站长的心情</li>' +
      '    </ul>' +
      '  </fieldset>' +
      '</div>';
  };
})();
