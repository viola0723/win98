/* ============================================================
 * 展柜通用渲染器 —— 用 iframe 加载 exhibits/dist 里的特效展品页
 * 所有展品模块复用本渲染器：config.js 里 app 都写 'exhibit'，
 * 只用 exhibit 字段区分展品页路径（见 config.js 末尾注释）。
 *   bodyEl：窗口内容区域 DOM（.window-body）
 *   win：窗口句柄
 *   cfg：config.js 中该模块的配置对象（cfg.exhibit = 展品页 URL）
 * ============================================================ */
window.WIN98_APPS = window.WIN98_APPS || {};
(function () {
  'use strict';

  WIN98_APPS['exhibit'] = function (bodyEl, win, cfg) {
    bodyEl.classList.add('exhibit-body');
    var iframe = document.createElement('iframe');
    iframe.className = 'exhibit-frame';
    iframe.src = cfg.exhibit;
    iframe.title = cfg.title || 'exhibit';
    bodyEl.appendChild(iframe);
  };
})();
