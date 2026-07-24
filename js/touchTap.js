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
 *   - pointerdown 记录落点并 preventDefault（能抑制随后原生 click 的平台
 *     就单发了；实测 Android Chrome 抑制不了，click 照发，需靠下方去重）；
 *   - pointerup 校验时长 / 位移 / 起落同控件后，同步补发 click
 *     （.click() 会完整走冒泡链，document 级委托与 onclick 属性都覆盖）；
 *   - 仍被派发的原生 click 由捕获阶段去重：补发后 700ms 内的可信 click
 *     一律吞掉。判定用 isTrusted 而非「同控件」——补发 click 的处理器
 *     可能已改变 UI（弹确认框并 inert 锁面板、关覆盖层重建棋盘），原生
 *     click 派发时命中目标会被重定向到遮罩/格子/别的按钮上，按控件比对
 *     必然漏吞，幽灵点击就会误触发「点遮罩取消」或翻开格子（安卓实测：
 *     开局后点难度按钮，确认框被自己的幽灵 click 瞬间取消，按钮看似失灵）。
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
  var lastSynth = 0;      // 最近一次补发 click 的时间戳（0=无），用于吞掉迟到的原生 click

  function activatable(target) {
    if (!target || !target.closest) return null;
    var el = target.closest(SELECTOR);
    if (!el || el.disabled) return null;
    return el;
  }

  document.addEventListener('pointerdown', function (e) {
    lastSynth = 0;   // 新手势开始：上一手势的原生 click 早已派发完毕，记录作废，
                     // 避免把这次真实点按的激活（或 700ms 内的下一次真实点按）误吞
    if (e.pointerType !== 'touch') return;
    var el = activatable(e.target);
    if (!el) return;
    down = { el: el, x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    e.preventDefault();   // 能抑制原生 click 的平台就此单发；抑制不了的由下方去重兜底
  }, true);

  document.addEventListener('pointerup', function (e) {
    if (!down || e.pointerId !== down.id) return;
    var d = down;
    down = null;
    if (Date.now() - d.t > TAP_MS) return;   // 长按（扫雷插旗等手势）不补 click
    if (Math.abs(e.clientX - d.x) > MOVE_PX || Math.abs(e.clientY - d.y) > MOVE_PX) return;
    if (activatable(e.target) !== d.el) return;
    d.el.click();   // 同步走完整个 click 监听链（含 document 级委托与 onclick）
    lastSynth = Date.now();   // 须在 click() 之后记录：补发事件不可信本就放行，时序双保险
  }, true);

  document.addEventListener('pointercancel', function (e) {
    if (down && e.pointerId === down.id) down = null;
  }, true);

  // 兜底去重：preventDefault 抑制不住原生 click 的平台（实测 Android Chrome 即如此），
  // 补发后 700ms 内到达的可信 click 一律吞掉。不按控件比对——补发 click 的处理器
  // 可能已改变 UI（确认框 inert、覆盖层移除），原生 click 的命中目标会被重定向，
  // 比对必然漏吞；补发的 el.click() 是不可信事件（isTrusted=false），天然放行。
  document.addEventListener('click', function (e) {
    if (!lastSynth) return;
    if (!e.isTrusted) return;
    if (Date.now() - lastSynth >= DEDUP_MS) { lastSynth = 0; return; }
    e.stopPropagation();
    e.preventDefault();
    lastSynth = 0;
  }, true);
})();
