/* ============================================================
 * 启动入口
 * ============================================================ */
(function () {
  'use strict';

  function boot() {
    window.WIN98_DESKTOP.render();   // 渲染桌面图标
    window.WIN98_TASKBAR_INIT();     // 初始化任务栏 / 开始菜单 / 时钟
    window.WIN98_SAVER_INIT();       // 屏幕保护（闲置触发）

    // PC 端首次打开自动弹出「我的电脑」让访客知道怎么玩；
    // 手机端窗口会全屏挡住图标，不自动弹，直接展示桌面
    var about = (window.WIN98_MODULES || []).filter(function (m) { return m.id === 'about'; })[0];
    if (about && !window.WindowManager.isMobile()) window.WindowManager.open(about);

    // 深链接：URL 带 #open=模块id 时直接打开对应模块（便于分享直达某个作品，也便于自动化验收）
    var match = (location.hash || '').match(/^#open=([\w-]+)$/);
    if (match) {
      var target = (window.WIN98_MODULES || []).filter(function (m) { return m.id === match[1]; })[0];
      if (target && target.type === 'window') window.WindowManager.open(target);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
