/* ============================================================
 * 扫雷 —— 模式容器 + 经典模式
 * 容器 WIN98_APPS['mine']：Tab 行（经典模式 / 寻找时间胶囊）+ 模式挂载点，
 *   模式实现注册在 WIN98_MINE_CORE.MODES（引擎见 js/apps/mine-core.js）；
 *   地下城脚本未加载时 Tab 整行隐藏，退化为纯经典模式（优雅降级）。
 * 经典模式 MODES.classic：三档难度 + 自定义、LCD 计数、笑脸重开、
 *   每难度最佳时间，棋盘数据与输入全部交给 WIN98_MINE_CORE.createBoard。
 * 误触保护：对局进行中点难度按钮 / 模式 Tab 先弹「放弃当前对局」确认框
 *   （confirmGiveUp；模式经 ctx.setGuard 向容器登记「有进度」判断）。
 * ============================================================ */
window.WIN98_APPS = window.WIN98_APPS || {};
(function () {
  'use strict';

  var CORE = window.WIN98_MINE_CORE;

  /* 引擎未加载时优雅降级（script 顺序见 index.html，正常不会走到） */
  if (!CORE) {
    WIN98_APPS['mine'] = function (bodyEl) {
      bodyEl.textContent = '扫雷引擎 js/apps/mine-core.js 未加载。';
    };
    return;
  }

  /* localStorage 安全读写：file:// 或隐私模式下可能抛异常 */
  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* 忽略 */ }
  }

  /* ---------------- 误触保护：放弃对局确认框 ----------------
   * 覆盖整个窗口内容区的模态层（锚 window-body，同自定义对话框）；
   * 打开期间 app 根元素 inert——指针与键盘都够不到棋盘和其余按钮。 */
  function confirmGiveUp(bodyEl, lockEl, message, onConfirm) {
    bodyEl.scrollLeft = 0;   // 覆盖层锚在 window-body（position:relative），先滚回原点保证对齐
    bodyEl.scrollTop = 0;
    var overlay = document.createElement('div');
    overlay.className = 'mine-dialog-overlay';
    overlay.innerHTML =
      '<div class="window mine-dialog" role="dialog" aria-label="确认">' +
      '  <div class="title-bar"><div class="title-bar-text">确认</div></div>' +
      '  <div class="window-body">' +
      '    <div class="mine-dialog-text">' + message + '</div>' +
      '    <div class="field-row mine-dialog-buttons">' +
      '      <button type="button" data-role="ok">确定</button>' +
      '      <button type="button" data-role="cancel">取消</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    bodyEl.appendChild(overlay);
    if (lockEl && 'inert' in lockEl) lockEl.inert = true;

    function close() {
      if (lockEl) lockEl.inert = false;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    overlay.querySelector('[data-role="ok"]').addEventListener('click', function () {
      close();
      onConfirm();
    });
    overlay.querySelector('[data-role="cancel"]').addEventListener('click', close);
    // 点遮罩空白处 = 取消
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    // 默认焦点给「取消」：误触进来时连打回车也不误伤
    overlay.querySelector('[data-role="cancel"]').focus();
  }

  /* ==================== 经典模式 ==================== */

  var LEVELS = {
    beginner:     { label: '初级', cols: 9,  rows: 9,  mines: 10 },
    intermediate: { label: '中级', cols: 16, rows: 16, mines: 40 },
    expert:       { label: '高级', cols: 30, rows: 16, mines: 99 }
  };
  var CUSTOM_KEY = 'win98.mine.custom';
  var CUSTOM_DEFAULT = { cols: 16, rows: 16, mines: 40 };   // 未配置过自定义时的默认值

  CORE.MODES.classic = function (containerEl, ctx) {
    var win = ctx.win;
    var bodyEl = ctx.bodyEl;

    var levelKey = 'beginner';
    var seconds = 0;
    var timerId = null;
    var dialogOpen = false;   // 自定义对话框打开期间锁棋盘输入（core 的 canInteract 钩子）

    containerEl.innerHTML =
      '<div class="mine-toolbar" role="group" aria-label="难度选择">' +
      Object.keys(LEVELS).map(function (key) {
        return '<button type="button" data-level="' + key + '">' + LEVELS[key].label + '</button>';
      }).join('') +
      '  <button type="button" data-level="custom">自定义</button>' +
      '  <span class="mine-best" data-role="best"></span>' +
      '</div>' +
      '<div class="mine-panel">' +
      '  <div class="mine-header sunken-panel">' +
      '    <span class="mine-lcd" data-role="mines">000</span>' +
      '    <button type="button" class="mine-face" data-role="face" aria-label="重新开始">🙂</button>' +
      '    <span class="mine-lcd" data-role="time">000</span>' +
      '  </div>' +
      '  <div class="mine-board sunken-panel" data-role="board" aria-label="雷区"></div>' +
      '</div>';

    var appEl = bodyEl.querySelector('.app-mine');   // fitWindowToContent 的锚点根
    var toolbarEl = containerEl.querySelector('.mine-toolbar');
    var panelEl = containerEl.querySelector('.mine-panel');
    var boardEl = containerEl.querySelector('[data-role="board"]');
    var faceEl = containerEl.querySelector('[data-role="face"]');
    var minesEl = containerEl.querySelector('[data-role="mines"]');
    var timeEl = containerEl.querySelector('[data-role="time"]');
    var bestEl = containerEl.querySelector('[data-role="best"]');

    /* ---------------- 计数器 / 计时器 ---------------- */

    function updateCounters() {
      minesEl.textContent = CORE.pad3(board.remainingFlags());
      timeEl.textContent = CORE.pad3(seconds);
    }

    function startTimer() {
      stopTimer();
      timerId = setInterval(function () {
        if (!timeEl.isConnected) { stopTimer(); return; } // 窗口关闭或模式已切换，自我清理
        if (seconds < 999) {
          seconds++;
          timeEl.textContent = CORE.pad3(seconds);
        }
      }, 1000);
    }

    function stopTimer() {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    /* ---------------- 最佳时间（localStorage，每难度一条；自定义档不记） ---------------- */

    function bestKey() { return 'win98.mine.best.' + levelKey; }

    function loadBest() {
      var v = parseInt(storageGet(bestKey()), 10);
      return v > 0 ? v : 0;   // 0 = 暂无记录
    }

    function saveBest(v) {
      storageSet(bestKey(), String(v));
    }

    function updateBestLabel() {
      if (levelKey === 'custom') {
        bestEl.textContent = '';
        bestEl.title = '';
        return;
      }
      var b = loadBest();
      bestEl.textContent = b > 0 ? '最佳 ' + b + 's' : '';
      bestEl.title = LEVELS[levelKey].label + '最佳时间';
    }

    /* ---------------- 棋盘（引擎驱动，经典侧只留 UI 钩子） ---------------- */

    var board = CORE.createBoard({
      boardEl: boardEl,
      cols: LEVELS.beginner.cols,   // 初始值，随后 newGame 会按难度 reset
      rows: LEVELS.beginner.rows,
      mines: LEVELS.beginner.mines,
      hooks: {
        canInteract: function () { return !dialogOpen; },
        onMineHit: function () {
          stopTimer();
          faceEl.textContent = '😵';
          return true;   // 经典模式踩雷即死，core 走 lose 全盘揭示
        },
        onAllClear: function () {
          // core 已置 over 并自动给剩余雷插旗，这里只做经典侧收尾：停表、😎、存最佳
          stopTimer();
          faceEl.textContent = '😎';
          updateCounters();
          if (levelKey !== 'custom') {
            var elapsed = Math.max(1, seconds);   // 首击即胜的极端情况按 1 秒记
            var best = loadBest();
            if (!best || elapsed < best) saveBest(elapsed);
          }
          updateBestLabel();
        },
        onFlagsChanged: function () { updateCounters(); },
        onFirstClick: function () { startTimer(); },
        onPressMood: function (mood) {
          faceEl.textContent = mood === 'o' ? '😮' : '🙂';
        }
      }
    });

    // 误触保护：向容器登记「对局进行中」判断，切模式 Tab 前容器会先弹确认
    if (ctx.setGuard) ctx.setGuard(function () { return board.started && !board.over; });

    /* ---------------- 自定义难度 ---------------- */

    /* 钳制：宽 9–30、高 9–24、雷 10 – (宽-1)×(高-1)；「|0」顺带把非数字输入兜成 0 再夹到下限 */
    function clampCustom(c) {
      var cols = Math.max(9, Math.min(30, c.cols | 0));
      var rows = Math.max(9, Math.min(24, c.rows | 0));
      var mines = Math.max(10, Math.min((cols - 1) * (rows - 1), c.mines | 0));
      return { cols: cols, rows: rows, mines: mines };
    }

    function loadCustom() {
      try {
        var c = JSON.parse(storageGet(CUSTOM_KEY) || 'null');
        if (c && c.cols > 0 && c.rows > 0 && c.mines > 0) return clampCustom(c);
      } catch (err) { /* JSON 损坏按未配置处理 */ }
      return null;
    }

    function currentConfig() {
      if (levelKey === 'custom') {
        return loadCustom() || { cols: CUSTOM_DEFAULT.cols, rows: CUSTOM_DEFAULT.rows, mines: CUSTOM_DEFAULT.mines };
      }
      return LEVELS[levelKey];
    }

    /* 自定义雷区对话框：窗口 body 内的绝对定位覆盖层（即使当前已是自定义也弹出，便于改参数） */
    function openCustomDialog() {
      if (dialogOpen) return;
      dialogOpen = true;
      var cur = loadCustom() || CUSTOM_DEFAULT;

      // 覆盖层锚在 window-body（position:relative，见 style.css），先滚回原点避免错位
      bodyEl.scrollLeft = 0;
      bodyEl.scrollTop = 0;

      var overlay = document.createElement('div');
      overlay.className = 'mine-dialog-overlay';
      overlay.innerHTML =
        '<div class="window mine-dialog" role="dialog" aria-label="自定义雷区">' +
        '  <div class="title-bar"><div class="title-bar-text">自定义雷区</div></div>' +
        '  <div class="window-body">' +
        '    <div class="field-row">' +
        '      <label for="mine-custom-cols">宽度：</label>' +
        '      <input id="mine-custom-cols" type="number" min="9" max="30" value="' + cur.cols + '">' +
        '      <span class="mine-dialog-hint">9 – 30</span>' +
        '    </div>' +
        '    <div class="field-row">' +
        '      <label for="mine-custom-rows">高度：</label>' +
        '      <input id="mine-custom-rows" type="number" min="9" max="24" value="' + cur.rows + '">' +
        '      <span class="mine-dialog-hint">9 – 24</span>' +
        '    </div>' +
        '    <div class="field-row">' +
        '      <label for="mine-custom-mines">雷数：</label>' +
        '      <input id="mine-custom-mines" type="number" min="10" value="' + cur.mines + '">' +
        '      <span class="mine-dialog-hint" data-role="mine-range"></span>' +
        '    </div>' +
        '    <div class="field-row mine-dialog-buttons">' +
        '      <button type="button" data-role="ok">确定</button>' +
        '      <button type="button" data-role="cancel">取消</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      // 挂在模式挂载点里：切 Tab 时随模式内容一起销毁，不会残留
      containerEl.appendChild(overlay);

      var colsInput = overlay.querySelector('#mine-custom-cols');
      var rowsInput = overlay.querySelector('#mine-custom-rows');
      var minesInput = overlay.querySelector('#mine-custom-mines');
      var rangeEl = overlay.querySelector('[data-role="mine-range"]');

      /* 雷数允许范围提示随宽高输入联动更新（按钳制后的宽高算） */
      function updateRange() {
        var c = clampCustom({ cols: colsInput.value, rows: rowsInput.value, mines: 10 });
        rangeEl.textContent = '10 – ' + ((c.cols - 1) * (c.rows - 1));
      }
      colsInput.addEventListener('input', updateRange);
      rowsInput.addEventListener('input', updateRange);
      updateRange();

      function close() {
        dialogOpen = false;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
      overlay.querySelector('[data-role="ok"]').addEventListener('click', function () {
        var cfg = clampCustom({ cols: colsInput.value, rows: rowsInput.value, mines: minesInput.value });
        storageSet(CUSTOM_KEY, JSON.stringify(cfg));
        close();
        newGame('custom');
      });
      overlay.querySelector('[data-role="cancel"]').addEventListener('click', close);
      // 点遮罩空白处 = 取消
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      colsInput.focus();
    }

    /* ---------------- 开新局 ---------------- */

    function newGame(key) {
      levelKey = key;
      storageSet('win98.mine.level', key);
      var lv = currentConfig();
      seconds = 0;
      stopTimer();
      faceEl.textContent = '🙂';
      toolbarEl.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.level === key);
      });
      board.reset({ cols: lv.cols, rows: lv.rows, mines: lv.mines });
      bodyEl.scrollLeft = 0;   // 切换难度后滚回左上角（手机端上个难度的横向滚动位置会残留）
      bodyEl.scrollTop = 0;
      updateCounters();
      updateBestLabel();
      CORE.fitWindowToContent(win, bodyEl, appEl, toolbarEl, panelEl);
    }

    /* 难度切换带误触保护：对局进行中先确认再开新局（未开局/已结束直接换） */
    function requestNewGame(key) {
      if (board.started && !board.over) {
        confirmGiveUp(bodyEl, appEl, '当前对局尚未结束，确定放弃并开始新游戏吗？', function () { newGame(key); });
      } else {
        newGame(key);
      }
    }

    // 难度切换（「自定义」只弹对话框，确定后才开新局）/ 笑脸重开（专职重开钮，不拦截）
    toolbarEl.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button[data-level]') : null;
      if (!btn) return;
      if (btn.dataset.level === 'custom') { openCustomDialog(); return; }
      requestNewGame(btn.dataset.level);
    });
    faceEl.addEventListener('click', function () { newGame(levelKey); });

    // 恢复上次难度（默认初级）
    var savedLevel = storageGet('win98.mine.level');
    if (savedLevel !== 'custom' && !LEVELS[savedLevel]) savedLevel = 'beginner';
    newGame(savedLevel);
  };

  /* ==================== 模式容器 ==================== */

  var MODE_DEFS = [
    { id: 'classic', label: '经典模式' },
    { id: 'dungeon', label: '寻找时间胶囊' }
  ];

  WIN98_APPS['mine'] = function (bodyEl, win) {
    bodyEl.innerHTML =
      '<div class="app-mine">' +
      '  <div class="mine-tabs" role="group" aria-label="模式选择"></div>' +
      '  <div class="mine-mode-body"></div>' +
      '</div>';

    var tabsEl = bodyEl.querySelector('.mine-tabs');
    var mountEl = bodyEl.querySelector('.mine-mode-body');
    var appEl = bodyEl.querySelector('.app-mine');
    var currentMode = null;
    var guardFn = null;   // 当前模式经 ctx.setGuard 登记的「有未结束对局」判断（误触保护）

    // 只渲染已注册的模式：地下城脚本未加载/加载失败时整行 Tab 隐藏（优雅降级）
    var available = MODE_DEFS.filter(function (m) { return typeof CORE.MODES[m.id] === 'function'; });
    if (available.length > 1) {
      available.forEach(function (m) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.mode = m.id;
        btn.textContent = m.label;
        tabsEl.appendChild(btn);
      });
    } else {
      tabsEl.style.display = 'none';
    }

    function switchMode(id) {
      storageSet('win98.mine.mode', id);
      currentMode = id;
      guardFn = null;   // 旧模式的 guard 随 DOM 一起销毁，等新模式重新登记
      tabsEl.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.mode === id);
      });
      mountEl.innerHTML = '';
      CORE.MODES[id](mountEl, {
        win: win, bodyEl: bodyEl,
        setGuard: function (fn) { guardFn = fn; }
      });
    }

    tabsEl.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button[data-mode]') : null;
      if (!btn || typeof CORE.MODES[btn.dataset.mode] !== 'function') return;
      var id = btn.dataset.mode;
      if (id === currentMode) return;   // 点已激活的 Tab 不重置当前模式
      if (guardFn && guardFn()) {       // 对局进行中：先确认，防误触丢进度
        confirmGiveUp(bodyEl, appEl, '当前对局尚未结束，切换模式将放弃进度。确定切换吗？', function () { switchMode(id); });
        return;
      }
      switchMode(id);
    });

    // 恢复上次模式（默认经典）；记录的模式未注册时回落经典
    var savedMode = storageGet('win98.mine.mode');
    if (typeof CORE.MODES[savedMode] !== 'function') savedMode = 'classic';
    switchMode(savedMode);
  };
})();
