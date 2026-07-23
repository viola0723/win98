/* ============================================================
 * 屏幕保护程序（.scr 容器）：闲置 60 秒自动全屏播放展品，任意输入退出。
 * 对外接口：window.WIN98_SAVER.show() / .hide()（开始菜单可手动预览）。
 * 触发内容复用展览馆展品页（?chrome=0 隐藏返回按钮），未来换展品只改 EXHIBIT_URL。
 * ============================================================ */
(function () {
  'use strict';

  var IDLE_MS = 60 * 1000;   // 闲置多久后触发
  var GRACE_MS = 800;        // 触发后的宽限期：此期间内的输入不退出，防止手动预览被误触退出
  var CHECK_MS = 5000;       // 巡检间隔
  var EXHIBIT_URL = 'exhibits/dist/index.html?ex=meteors&chrome=0';

  var overlay = null, iframe = null, hint = null, hintTimer = null;
  var active = false, lastInput = Date.now(), shownAt = 0;

  var INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

  function onInput() {
    lastInput = Date.now();
    if (active && lastInput - shownAt > GRACE_MS) hide();
  }

  function show() {
    if (active) return;
    // 关机彩蛋播放中 = 机器已关，不触发屏保
    var off = document.getElementById('shutdown-overlay');
    if (off && !off.hidden) return;
    active = true;
    shownAt = Date.now();
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'screensaver-overlay';
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:99999;background:#000;display:none;touch-action:none;';
      document.body.appendChild(overlay);
    }
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.src = EXHIBIT_URL;
      iframe.title = '屏幕保护';
      // pointer-events:none 关键：事件穿透到覆盖层，否则 iframe 会吞掉所有
      // 鼠标/触摸输入（iframe 内事件不冒泡到父页面），屏保将无法退出
      iframe.style.cssText =
        'width:100%;height:100%;border:0;display:block;pointer-events:none;';
      overlay.appendChild(iframe);
    }
    if (!hint) {
      hint = document.createElement('div');
      hint.textContent = '移动指针、触摸屏幕或按任意键退出';
      hint.style.cssText =
        'position:absolute;left:0;right:0;bottom:48px;text-align:center;' +
        'color:#7f8ea3;font:12px/1.5 sans-serif;letter-spacing:.15em;' +
        'opacity:0;transition:opacity .8s;pointer-events:none;';
      overlay.appendChild(hint);
    }
    overlay.style.display = 'block';
    // 退出提示短暂出现后淡出（每次触发重新提示一次）
    hint.style.opacity = '1';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.style.opacity = '0'; }, 3500);
  }

  function hide() {
    if (!active) return;
    active = false;
    clearTimeout(hintTimer);
    overlay.style.display = 'none';
  }

  function init() {
    INPUT_EVENTS.forEach(function (t) {
      window.addEventListener(t, onInput, { passive: true, capture: true });
    });
    // 页面隐藏（切标签页/锁屏）时不计闲置，回来不会一开门就撞进屏保
    setInterval(function () {
      if (!active && document.visibilityState === 'visible' &&
          Date.now() - lastInput >= IDLE_MS) {
        show();
      }
    }, CHECK_MS);
    window.WIN98_SAVER = { show: show, hide: hide };
  }

  window.WIN98_SAVER_INIT = init;
})();
