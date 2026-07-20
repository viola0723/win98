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
  var CELL_PX = 24;          // 与 css/style.css 里 --mine-cell 保持一致（仅用于自适应窗口尺寸）
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

    var boardEl = bodyEl.querySelector('[data-role="board"]');
    var faceEl = bodyEl.querySelector('[data-role="face"]');
    var minesEl = bodyEl.querySelector('[data-role="mines"]');
    var timeEl = bodyEl.querySelector('[data-role="time"]');

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
    }

    /* 切换难度后按棋盘实际大小调整窗口（最大化/手机端不动，超出屏幕则收敛） */
    function fitWindow() {
      if (win.maximized) return;
      var layer = document.getElementById('windows');
      if (!layer) return;
      win.el.style.width = Math.min(cols * CELL_PX + 52, layer.clientWidth) + 'px';
      win.el.style.height = Math.min(rows * CELL_PX + 140, layer.clientHeight) + 'px';
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
      updateCounters();
      fitWindow();
    }

    /* ---------------- 输入：鼠标 + 触屏（Pointer Events） ---------------- */

    function cellFromEvent(e) {
      var cell = e.target && e.target.closest ? e.target.closest('.mine-cell') : null;
      return cell ? Number(cell.dataset.idx) : -1;
    }

    // 翻开（鼠标左键 / 触屏轻点）
    boardEl.addEventListener('click', function (e) {
      var idx = cellFromEvent(e);
      if (idx < 0) return;
      if (suppressClick) { suppressClick = false; return; }
      reveal(idx);
    });

    // 插旗（鼠标右键；部分触屏系统的长按也会派发此事件，需与长按去重）
    boardEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var idx = cellFromEvent(e);
      if (idx < 0) return;
      if (Date.now() - lastFlagTime < LONG_PRESS_MS) return; // 刚被长按处理过
      toggleFlag(idx);
    });

    // 插旗（触屏长按；鼠标右键走上面的 contextmenu，不重复处理）
    boardEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      var idx = cellFromEvent(e);
      if (idx < 0) return;
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
