/* ============================================================
 * 启动入口
 * ============================================================ */
(function () {
  'use strict';

  function boot() {
    window.WIN98_DESKTOP.render();   // 渲染桌面图标
    window.WIN98_TASKBAR_INIT();     // 初始化任务栏 / 开始菜单 / 时钟

    // PC 端首次打开自动弹出「我的电脑」让访客知道怎么玩；
    // 手机端窗口会全屏挡住图标，不自动弹，直接展示桌面
    var about = (window.WIN98_MODULES || []).filter(function (m) { return m.id === 'about'; })[0];
    if (about && !window.WindowManager.isMobile()) window.WindowManager.open(about);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
