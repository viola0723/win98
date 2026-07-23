/* ============================================================
 * 扫雷 —— 经典 Win98 扫雷
 * 操作：左键/轻点翻开格子，右键/长按（触屏）插旗
 * 代码量较大，按 PROJECT_PLAN.md 第 6 节单独成文件，
 * 在 index.html 里用普通 <script> 引入，注册方式不变。
 * ============================================================ */
window.WIN98_APPS = window.WIN98_APPS || {};
(function () {
  'use strict';

  var LEVELS = {
    beginner:     { label: '初级', cols: 9,  rows: 9,  mines: 10 },
    intermediate: { label: '中级', cols: 16, rows: 16, mines: 40 },
    expert:       { label: '高级', cols: 30, rows: 16, mines: 99 }
  };
  var LONG_PRESS_MS = 450;   // 触屏长按插旗的判定时长

  WIN98_APPS['mine'] = function (bodyEl, win) {
    var levelKey = 'beginner';
    var cols = 0, rows = 0, mineTotal = 0;
    var cells = [];            // { mine, count, revealed, flagged }
    var started = false;       // 首次翻开后才布雷并开始计时（保证首击不踩雷）
    var over = false;
    var revealedCount = 0;
    var flagCount = 0;
    var seconds = 0;
    var timerId = null;
    var pressTimer = null;     // 触屏长按计时
    var lastFlagTime = 0;      // 上次「长按插旗」的时间，仅用于给系统随后派发的 contextmenu 去重
    var suppressClick = false; // 长按插旗后抑制紧随的 click，避免又翻开

    bodyEl.innerHTML =
      '<div class="app-mine">' +
      '  <div class="mine-toolbar" role="group" aria-label="难度选择">' +
      Object.keys(LEVELS).map(function (key) {
        return '<button type="button" data-level="' + key + '">' + LEVELS[key].label + '</button>';
      }).join('') +
      '    <span class="mine-best" data-role="best"></span>' +
      '  </div>' +
      '  <div class="mine-panel">' +
      '    <div class="mine-header sunken-panel">' +
      '      <span class="mine-lcd" data-role="mines">000</span>' +
      '      <button type="button" class="mine-face" data-role="face" aria-label="重新开始">🙂</button>' +
      '      <span class="mine-lcd" data-role="time">000</span>' +
      '    </div>' +
      '    <div class="mine-board sunken-panel" data-role="board" aria-label="雷区"></div>' +
      '  </div>' +
      '</div>';

    var appEl = bodyEl.querySelector('.app-mine');
    var toolbarEl = bodyEl.querySelector('.mine-toolbar');
    var panelEl = bodyEl.querySelector('.mine-panel');
    var boardEl = bodyEl.querySelector('[data-role="board"]');
    var faceEl = bodyEl.querySelector('[data-role="face"]');
    var minesEl = bodyEl.querySelector('[data-role="mines"]');
    var timeEl = bodyEl.querySelector('[data-role="time"]');
    var bestEl = bodyEl.querySelector('[data-role="best"]');

    /* ---------------- 计数器 / 计时器 ---------------- */

    function pad3(n) {
      n = Math.max(-99, Math.min(999, n));
      if (n < 0) return '-' + ('0' + Math.abs(n)).slice(-2);
      return ('00' + n).slice(-3);
    }

    function updateCounters() {
      minesEl.textContent = pad3(mineTotal - flagCount);
      timeEl.textContent = pad3(seconds);
    }

    function startTimer() {
      stopTimer();
      timerId = setInterval(function () {
        if (!bodyEl.isConnected) { stopTimer(); return; } // 窗口已关闭，自我清理
        if (seconds < 999) {
          seconds++;
          timeEl.textContent = pad3(seconds);
        }
      }, 1000);
    }

    function stopTimer() {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    /* ---------------- 最佳时间（localStorage，每难度一条） ---------------- */

    function bestKey() { return 'win98.mine.best.' + levelKey; }

    function loadBest() {
      try {
        var v = parseInt(window.localStorage.getItem(bestKey()), 10);
        return v > 0 ? v : 0;   // 0 = 暂无记录
      } catch (err) {           // file:// 或隐私模式下 localStorage 可能不可用
        return 0;
      }
    }

    function saveBest(v) {
      try { window.localStorage.setItem(bestKey(), String(v)); } catch (err) { /* 忽略 */ }
    }

    function updateBestLabel() {
      var b = loadBest();
      bestEl.textContent = b > 0 ? '最佳 ' + b + 's' : '';
      bestEl.title = LEVELS[levelKey].label + '最佳时间';
    }

    /* ---------------- 雷区数据 ---------------- */

    function neighbors(i) {
      var x = i % cols, y = Math.floor(i / cols), out = [];
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          var nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) out.push(ny * cols + nx);
        }
      }
      return out;
    }

    /* 首击后布雷：首击格及其周围 8 格保证无雷（尽量首击就开一片） */
    function placeMines(safeIdx) {
      var forbidden = {};
      forbidden[safeIdx] = true;
      neighbors(safeIdx).forEach(function (i) { forbidden[i] = true; });
      var pool = [], i;
      for (i = 0; i < cells.length; i++) if (!forbidden[i]) pool.push(i);
      if (pool.length < mineTotal) { // 极端情况放宽：只禁首击格
        pool = [];
        for (i = 0; i < cells.length; i++) if (i !== safeIdx) pool.push(i);
      }
      for (var m = 0; m < mineTotal; m++) {
        var k = Math.floor(Math.random() * pool.length);
        cells[pool.splice(k, 1)[0]].mine = true;
      }
      for (i = 0; i < cells.length; i++) {
        if (cells[i].mine) continue;
        cells[i].count = neighbors(i).filter(function (j) { return cells[j].mine; }).length;
      }
    }

    /* ---------------- 渲染 ---------------- */

    function paint(i) {
      var c = cells[i], el = boardEl.children[i];
      el.className = 'mine-cell' +
        (c.revealed ? ' revealed' : '') +
        (!c.revealed && c.flagged ? ' flagged' : '') +
        (c.revealed && c.count > 0 ? ' n' + c.count : '');
      el.textContent = c.revealed ? (c.count > 0 ? String(c.count) : '') : (c.flagged ? '🚩' : '');
    }

    /* ---------------- 游戏流程 ---------------- */

    function reveal(i) {
      if (over) return;
      var c = cells[i];
      if (c.revealed || c.flagged) return;
      if (!started) {
        started = true;
        placeMines(i);
        startTimer();
      }
      if (c.mine) { lose(i); return; }
      //  flood fill：翻开空白格时连带翻开周围
      var stack = [i];
      while (stack.length) {
        var cur = stack.pop();
        var cc = cells[cur];
        if (cc.revealed || cc.flagged) continue;
        cc.revealed = true;
        revealedCount++;
        paint(cur);
        if (cc.count === 0) {
          neighbors(cur).forEach(function (j) {
            if (!cells[j].revealed && !cells[j].mine) stack.push(j);
          });
        }
      }
      if (revealedCount === cols * rows - mineTotal) winGame();
    }

    /* 点已翻开的数字格：周围旗数凑够时一次翻开其余格子（经典双键快开的单键版，触屏同样可用） */
    function chord(i) {
      if (over) return;
      var c = cells[i];
      if (!c.revealed || c.count === 0) return;
      var ns = neighbors(i);
      var flags = 0;
      ns.forEach(function (j) { if (cells[j].flagged) flags++; });
      if (flags !== c.count) return;
      ns.forEach(function (j) {
        if (!cells[j].revealed && !cells[j].flagged) reveal(j);
      });
    }

    function toggleFlag(i) {
      if (over) return;
      var c = cells[i];
      if (c.revealed) return;
      c.flagged = !c.flagged;
      flagCount += c.flagged ? 1 : -1;
      paint(i);
      updateCounters();
    }

    function lose(hitIdx) {
      over = true;
      stopTimer();
      faceEl.textContent = '😵';
      cells.forEach(function (c, i) {
        var el = boardEl.children[i];
        if (c.mine && !c.flagged) {
          el.className = 'mine-cell revealed' + (i === hitIdx ? ' mine-hit' : '');
          el.textContent = '💣';
        } else if (!c.mine && c.flagged) {
          el.className = 'mine-cell revealed';
          el.textContent = '❌'; // 插错的旗
        }
      });
    }

    function winGame() {
      over = true;
      stopTimer();
      faceEl.textContent = '😎';
      cells.forEach(function (c, i) { // 自动给剩余雷插旗
        if (c.mine && !c.flagged) { c.flagged = true; paint(i); }
      });
      flagCount = mineTotal;
      updateCounters();
      var elapsed = Math.max(1, seconds);   // 首击即胜的极端情况按 1 秒记
      var best = loadBest();
      if (!best || elapsed < best) saveBest(elapsed);
      updateBestLabel();
    }

    /* 切换难度后按棋盘实际大小调整窗口（最大化/手机端不动）。
       不用估算常数，直接量「内容需要多大」+「窗口框架占多少」反推：
       - 框架 = win 与 body 的 offset 尺寸差（窗口 padding + 标题栏 + body margin 全在里面，
         因为 body 的 margin 占窗口空间却不计入 body 自身 offset，勿再加一遍）；
       - 内容高 = 工具栏 + 面板（offsetHeight 是布局尺寸，不受当前窗口裁切影响）；
       - 内容宽 = 面板与工具栏的较大者（toolbar 宽 100%，其内容宽由子元素逐个求和得到）。 */
    function fitWindow() {
      if (win.maximized) return;
      var layer = document.getElementById('windows');
      if (!layer) return;
      var chromeW = win.el.offsetWidth - bodyEl.offsetWidth;
      var chromeH = win.el.offsetHeight - bodyEl.offsetHeight;
      var gap = parseFloat(window.getComputedStyle(appEl).rowGap) || 0;
      var toolbarGap = parseFloat(window.getComputedStyle(toolbarEl).columnGap) || 0;
      var toolbarNeed = 0;
      for (var t = 0; t < toolbarEl.children.length; t++) {
        toolbarNeed += toolbarEl.children[t].offsetWidth;
      }
      if (toolbarEl.children.length > 1) toolbarNeed += toolbarGap * (toolbarEl.children.length - 1);
      var needW = Math.max(panelEl.offsetWidth, toolbarNeed);
      var needH = toolbarEl.offsetHeight + gap + panelEl.offsetHeight;
      var w = Math.min(Math.ceil(needW + chromeW), layer.clientWidth);
      var h = Math.min(Math.ceil(needH + chromeH), layer.clientHeight);
      win.el.style.width = w + 'px';
      win.el.style.height = h + 'px';
      // 尺寸变化后若右/下边缘越出屏幕，把窗口拉回来
      win.el.style.left = Math.max(0, Math.min(win.el.offsetLeft, layer.clientWidth - w)) + 'px';
      win.el.style.top = Math.max(0, Math.min(win.el.offsetTop, layer.clientHeight - h)) + 'px';
    }

    function newGame(key) {
      levelKey = key;
      var lv = LEVELS[key];
      cols = lv.cols;
      rows = lv.rows;
      mineTotal = lv.mines;
      cells = [];
      for (var i = 0; i < cols * rows; i++) {
        cells.push({ mine: false, count: 0, revealed: false, flagged: false });
      }
      started = false;
      over = false;
      revealedCount = 0;
      flagCount = 0;
      seconds = 0;
      suppressClick = false;
      clearTimeout(pressTimer);
      pressTimer = null;
      stopTimer();
      faceEl.textContent = '🙂';
      bodyEl.querySelectorAll('.mine-toolbar button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.level === key);
      });
      boardEl.style.gridTemplateColumns = 'repeat(' + cols + ', var(--mine-cell))';
      boardEl.innerHTML = '';
      var frag = document.createDocumentFragment();
      cells.forEach(function (_, idx) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'mine-cell';
        el.dataset.idx = idx;
        el.setAttribute('aria-label', '格子');
        frag.appendChild(el);
      });
      boardEl.appendChild(frag);
      bodyEl.scrollLeft = 0;   // 切换难度后滚回左上角（手机端上个难度的横向滚动位置会残留）
      bodyEl.scrollTop = 0;
      updateCounters();
      updateBestLabel();
      fitWindow();
    }

    /* ---------------- 输入：鼠标 + 触屏（Pointer Events） ---------------- */

    function cellFromEvent(e) {
      var cell = e.target && e.target.closest ? e.target.closest('.mine-cell') : null;
      return cell ? Number(cell.dataset.idx) : -1;
    }

    // 翻开（鼠标左键 / 触屏轻点）；点已翻开的数字格则尝试 chord 快开
    boardEl.addEventListener('click', function (e) {
      var idx = cellFromEvent(e);
      if (idx < 0) return;
      if (suppressClick) { suppressClick = false; return; }
      if (cells[idx].revealed) chord(idx); else reveal(idx);
    });

    // 插旗（鼠标右键；部分触屏系统的长按也会派发此事件，需与长按去重）
    boardEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var idx = cellFromEvent(e);
      if (idx < 0) return;
      if (Date.now() - lastFlagTime < LONG_PRESS_MS) return; // 刚被长按处理过
      toggleFlag(idx);
    });

    // 插旗（触屏长按；鼠标右键走上面的 contextmenu，不重复处理）。
    // 顺带还原经典细节：按下格子时笑脸张嘴 😮，松开/移出恢复（右键插旗不变脸）
    boardEl.addEventListener('pointerdown', function (e) {
      var idx = cellFromEvent(e);
      if (idx < 0) return;
      if (!over && e.button !== 2) faceEl.textContent = '😮';
      if (e.pointerType === 'mouse') return;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        suppressClick = true;
        toggleFlag(idx);
        lastFlagTime = Date.now(); // 只记长按插旗：部分触屏系统随后还会派发 contextmenu，靠它去重
      }, LONG_PRESS_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      boardEl.addEventListener(type, function () {
        clearTimeout(pressTimer);
        pressTimer = null;
        if (!over) faceEl.textContent = '🙂';
      });
    });

    // 难度切换 / 笑脸重开
    bodyEl.querySelector('.mine-toolbar').addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button[data-level]') : null;
      if (btn) newGame(btn.dataset.level);
    });
    faceEl.addEventListener('click', function () { newGame(levelKey); });

    newGame(levelKey);
  };
})();
