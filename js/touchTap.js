/* ============================================================
 * 触屏轻点激活（touchTap）—— iOS Safari 真机「click 不派发」的兜底
 *
 * 背景：真机 iOS 上窗口打开后，Pointer Events（pointerdown/up）能正常到达
 *   窗口内元素（按下变脸 😮、长按插旗都正常），但系统合成的 click 不派发——
 *   标题栏三键、难度按钮、Tab、格子轻点全部「有反应但没效果」。
 *   疑似 WebKit 的点击命中测试与 DOM 事件不一致（与 #windows 曾设
 *   pointer-events:none 一类祖传怪癖同源）；无头 WebKit 无法复现，真机专属。
 *
 * 方案：触屏轻点不等系统 click，统一在 pointerup 里直接调 el.click() 激活：
 *   - pointerdown 记录落点并 preventDefault（Pointer Events 规范：取消
 *     pointerdown 可抑制随后的合成鼠标事件/click，Android Chrome 生效）；
 *   - pointerup 校验时长 / 位移 / 起落同控件后，同步补发 click
 *     （.click() 会完整走冒泡链，document 级委托与 onclick 属性都覆盖）；
 *   - preventDefault 不生效的平台（iOS 偶发、旧浏览器），迟到的原生 click
 *     由捕获阶段按「同控件 700ms 窗口」去重，保证只激活一次。
 * 鼠标（pointerType=mouse）完全走原生 click，一字未动。
 * 覆盖：全站 <button>、开始菜单 <li>、关机遮罩。桌面图标在 desktop.js
 *   自带 pointerup 逻辑，不在此列；input/链接等原生控件不受影响。
 * ============================================================ */
(function () {
  'use strict';

  var TAP_MS = 600;    // 轻点最大时长；须 > 扫雷长按插旗 450ms（长按后抬手由插旗守卫挡住，不会误翻开）
  var MOVE_PX = 12;    // 位移容差：超过视为滑动/滚动，不激活
  var DEDUP_MS = 700;  // 合成 click 去重窗口

  var SELECTOR = 'button, #start-menu-items li, #shutdown-overlay';

  var down = null;        // 进行中的轻点 { el, x, y, t, id }
  var lastSynth = null;   // 最近一次补发 { el, t }，用于吞掉迟到的原生合成 click

  function activatable(target) {
    if (!target || !target.closest) return null;
    var el = target.closest(SELECTOR);
    if (!el || el.disabled) return null;
    return el;
  }

  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    var el = activatable(e.target);
    if (!el) return;
    down = { el: el, x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    e.preventDefault();   // 抑制浏览器随后派发的合成 click，激活统一走下面的 pointerup
  }, true);

  document.addEventListener('pointerup', function (e) {
    if (!down || e.pointerId !== down.id) return;
    var d = down;
    down = null;
    if (Date.now() - d.t > TAP_MS) return;   // 长按（扫雷插旗等手势）不补 click
    if (Math.abs(e.clientX - d.x) > MOVE_PX || Math.abs(e.clientY - d.y) > MOVE_PX) return;
    if (activatable(e.target) !== d.el) return;
    d.el.click();   // 同步走完整个 click 监听链（含 document 级委托与 onclick）
    lastSynth = { el: d.el, t: Date.now() };  // 须在 click() 之后记录，否则会吞掉自己
  }, true);

  document.addEventListener('pointercancel', function (e) {
    if (down && e.pointerId === down.id) down = null;
  }, true);

  // 兜底去重：preventDefault 不生效的平台，原生 click 会迟到——同一控件 700ms 内只认补发的那次
  document.addEventListener('click', function (e) {
    if (!lastSynth) return;
    if (Date.now() - lastSynth.t >= DEDUP_MS) { lastSynth = null; return; }
    if (e.target === lastSynth.el || (lastSynth.el.contains && lastSynth.el.contains(e.target))) {
      e.stopPropagation();
      e.preventDefault();
      lastSynth = null;
    }
  }, true);
})();
