/* ============================================================
 * 扫雷共享引擎（mine-core）—— 棋盘数据 / 输入 / 绘制，与模式 UI 解耦
 * 暴露 window.WIN98_MINE_CORE：
 *   MODES               模式注册表：MODES.xxx = function (containerEl, ctx)，ctx = { win, bodyEl }
 *   pad3(n)             LCD 三位补零（-99~999，负数如 -09）
 *   fitWindowToContent  按内容实测尺寸反推窗口（原 minesweeper.js fitWindow 的泛化）
 *   createBoard(opts)   创建一块雷区，返回 board（见下）
 *
 * createBoard opts = { boardEl, cols, rows, mines, hooks }
 * hooks（全部可选）：
 *   canInteract() -> bool              false 时忽略一切格子输入与表情变化（覆盖层打开时用）
 *   onMineHit(idx, board) -> bool      踩雷。true=致命（core 走 lose 全盘揭示）；
 *                                      false=存活（该格标 exploded 已爆，游戏继续）
 *   onAllClear(board)                  所有非雷格翻开（core 已先置 over 并自动给剩余雷插旗）
 *   onCellRevealed(idx, board)         每格翻开时回调（含 flood fill 连带翻开的）
 *   onRevealedClick(idx, board)->bool  点击已翻开格；返回 true=已处理，跳过 chord 快开
 *   onFlagsChanged(board)              插旗/拔旗后
 *   onFirstClick(board)                首击布雷完成后（此时 cells 的 mine/count 已就绪）
 *   decorateCell(idx, cell, el)        paint 收尾时调用，模式方追加装饰（出口/已爆/探测标记）
 *   onPressMood(mood)                  'o'=按下张嘴脸 | 'smile'=恢复（仅未 over 且 canInteract 时触发）
 *
 * board = { cols, rows, mines, cells, started, over, revealedCount, flagCount,
 *           neighbors, reveal, chord, toggleFlag, paint, paintAll, lose, reset,
 *           revealRandomSafe, markRandomMines, remainingFlags }
 * cell = { mine, count, revealed, flagged, known, exploded }
 *   known：已标记雷——禁止翻开、chord 时计为旗数（地下城探测仪用；经典永远 false）
 *   exploded：已爆雷——revealed=true、chord 计为旗数、不计入 revealedCount（雷格本就不计）
 * ============================================================ */
window.WIN98_MINE_CORE = (function () {
  'use strict';

  var LONG_PRESS_MS = 450;   // 触屏长按插旗的判定时长

  /* LCD 三位补零：-99~999，负数显示如 -09（经典扫雷计数器风格） */
  function pad3(n) {
    n = Math.max(-99, Math.min(999, n));
    if (n < 0) return '-' + ('0' + Math.abs(n)).slice(-2);
    return ('00' + n).slice(-3);
  }

  /* flex 布局下宽 100% 的行（工具栏/Tab 行）自身 offsetWidth 被拉伸、不可信，
     内容宽由子元素逐个求和 + columnGap 得到（原 fitWindow 量工具栏的思路）；
     无子元素（纯文本等）退回自身 offsetWidth */
  function rowContentWidth(el) {
    if (!el.children.length) return el.offsetWidth;
    var gap = parseFloat(window.getComputedStyle(el).columnGap) || 0;
    var w = 0, n = 0;
    for (var i = 0; i < el.children.length; i++) {
      if (window.getComputedStyle(el.children[i]).display === 'none') continue;
      w += el.children[i].offsetWidth;
      n++;
    }
    if (n > 1) w += gap * (n - 1);
    return w;
  }

  /* 切换难度/模式后按内容实际大小调整窗口（最大化/手机端不动）。
     不用估算常数，直接量「内容需要多大」+「窗口框架占多少」反推：
     - 框架 = win 与 body 的 offset 尺寸差（窗口 padding + 标题栏 + body margin 全在里面，
       因为 body 的 margin 占窗口空间却不计入 body 自身 offset，勿再加一遍）；
     - 内容高 = appEl 各可见直接子元素高度求和 + rowGap（offsetHeight 是布局尺寸，
       不受当前窗口裁切影响；隐藏子元素如未显示的 Tab 行不计）；
     - 内容宽 = 面板实测宽、工具栏内容宽、其他直接子元素（如 Tab 行）内容宽 的较大者。
       面板靠 margin-inline:auto 收缩贴合、棋盘格子定宽，offsetWidth 可信。 */
  function fitWindowToContent(win, bodyEl, appEl, toolbarEl, panelEl) {
    if (win.maximized) return;
    if (window.WindowManager && window.WindowManager.isMobile && window.WindowManager.isMobile()) return;
    var layer = document.getElementById('windows');
    if (!layer) return;
    var chromeW = win.el.offsetWidth - bodyEl.offsetWidth;
    var chromeH = win.el.offsetHeight - bodyEl.offsetHeight;
    var gap = parseFloat(window.getComputedStyle(appEl).rowGap) || 0;
    var needW = 0, needH = 0, visCount = 0;
    for (var i = 0; i < appEl.children.length; i++) {
      var child = appEl.children[i];
      if (window.getComputedStyle(child).display === 'none') continue;
      needH += child.offsetHeight;
      visCount++;
      if (child.contains(toolbarEl) || child.contains(panelEl)) {
        // 工具栏/面板本身或其包装元素（模式挂载点）：宽由内部 toolbar/panel 决定
        needW = Math.max(needW, panelEl.offsetWidth, rowContentWidth(toolbarEl));
      } else {
        needW = Math.max(needW, rowContentWidth(child));
      }
    }
    if (visCount > 1) needH += gap * (visCount - 1);
    var w = Math.min(Math.ceil(needW + chromeW), layer.clientWidth);
    var h = Math.min(Math.ceil(needH + chromeH), layer.clientHeight);
    win.el.style.width = w + 'px';
    win.el.style.height = h + 'px';
    // 尺寸变化后若右/下边缘越出屏幕，把窗口拉回来
    win.el.style.left = Math.max(0, Math.min(win.el.offsetLeft, layer.clientWidth - w)) + 'px';
    win.el.style.top = Math.max(0, Math.min(win.el.offsetTop, layer.clientHeight - h)) + 'px';
  }

  /* ---------------- 雷区 ---------------- */

  function createBoard(opts) {
    var boardEl = opts.boardEl;
    var hooks = opts.hooks || {};
    var cols = 0, rows = 0, mines = 0;
    var cells = [];
    var pressTimer = null;     // 触屏长按计时
    var lastFlagTime = 0;      // 上次「长按插旗」的时间，仅用于给系统随后派发的 contextmenu 去重
    var suppressClick = false; // 长按插旗后抑制紧随的 click，避免又翻开

    var board = {
      cols: 0, rows: 0, mines: 0,
      cells: cells,
      started: false,      // 首次翻开后才布雷（保证首击不踩雷）
      over: false,
      revealedCount: 0,
      flagCount: 0,
      neighbors: neighbors,
      reveal: reveal,
      chord: chord,
      toggleFlag: toggleFlag,
      paint: paint,
      paintAll: paintAll,
      lose: lose,
      reset: reset,
      revealRandomSafe: revealRandomSafe,
      markRandomMines: markRandomMines,
      remainingFlags: function () { return board.mines - board.flagCount; }
    };

    /* 未结束且模式方未拦截（覆盖层打开等）时才响应格子输入与表情变化 */
    function interactable() {
      if (board.over) return false;
      if (hooks.canInteract && !hooks.canInteract()) return false;
      return true;
    }

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
      if (pool.length < mines) { // 极端情况放宽：只禁首击格
        pool = [];
        for (i = 0; i < cells.length; i++) if (i !== safeIdx) pool.push(i);
      }
      for (var m = 0; m < mines; m++) {
        var k = Math.floor(Math.random() * pool.length);
        cells[pool.splice(k, 1)[0]].mine = true;
      }
      for (i = 0; i < cells.length; i++) {
        if (cells[i].mine) continue;
        cells[i].count = neighbors(i).filter(function (j) { return cells[j].mine; }).length;
      }
    }

    /* ---------------- 绘制 ---------------- */

    function paint(i) {
      var c = cells[i], el = boardEl.children[i];
      if (!el) return;
      el.className = 'mine-cell' +
        (c.revealed ? ' revealed' : '') +
        (!c.revealed && c.flagged ? ' flagged' : '') +
        (c.revealed && c.count > 0 ? ' n' + c.count : '');
      el.textContent = c.revealed ? (c.count > 0 ? String(c.count) : '') : (c.flagged ? '🚩' : '');
      // className 重设会抹掉模式方的装饰，收尾时交给钩子重画（出口/已爆/探测标记）
      if (hooks.decorateCell) hooks.decorateCell(i, c, el);
    }

    function paintAll() {
      for (var i = 0; i < cells.length; i++) paint(i);
    }

    /* ---------------- 游戏流程 ---------------- */

    function reveal(i) {
      if (board.over) return;
      var c = cells[i];
      if (c.revealed || c.flagged || c.known) return;
      if (!board.started) {
        board.started = true;
        placeMines(i);
        if (hooks.onFirstClick) hooks.onFirstClick(board);
      }
      if (c.mine) {
        var fatal = hooks.onMineHit ? hooks.onMineHit(i, board) : true;
        if (fatal) {
          lose(i);
        } else {
          // 存活雷：标已爆、算翻开（雷格不计入 revealedCount），游戏继续
          c.exploded = true;
          c.revealed = true;
          paint(i);
        }
        return;
      }
      // flood fill：翻开空白格时连带翻开周围
      var stack = [i];
      while (stack.length) {
        var cur = stack.pop();
        var cc = cells[cur];
        if (cc.revealed || cc.flagged || cc.known) continue;
        cc.revealed = true;
        board.revealedCount++;
        paint(cur);
        if (hooks.onCellRevealed) hooks.onCellRevealed(cur, board);
        if (cc.count === 0) {
          neighbors(cur).forEach(function (j) {
            if (!cells[j].revealed && !cells[j].mine) stack.push(j);
          });
        }
      }
      if (board.revealedCount === cols * rows - mines) {
        // 胜利：core 先置 over、自动给剩余雷插旗，再交给模式方收尾（停表/表情/存最佳）
        board.over = true;
        cells.forEach(function (cc, idx) {
          if (cc.mine && !cc.flagged) { cc.flagged = true; paint(idx); }
        });
        board.flagCount = board.mines;
        if (hooks.onAllClear) hooks.onAllClear(board);
      }
    }

    /* 点已翻开的数字格：周围旗数凑够时一次翻开其余格子（经典双键快开的单键版，触屏同样可用）。
       旗数统计含 known（探测标记）与 exploded（已爆雷），二者都视为已确认的雷 */
    function chord(i) {
      if (board.over) return;
      var c = cells[i];
      if (!c.revealed || c.count === 0) return;
      var ns = neighbors(i);
      var flags = 0;
      ns.forEach(function (j) { if (cells[j].flagged || cells[j].known || cells[j].exploded) flags++; });
      if (flags !== c.count) return;
      ns.forEach(function (j) {
        if (!cells[j].revealed && !cells[j].flagged && !cells[j].known) reveal(j);
      });
    }

    function toggleFlag(i) {
      if (board.over) return;
      var c = cells[i];
      if (c.revealed) return;
      c.flagged = !c.flagged;
      board.flagCount += c.flagged ? 1 : -1;
      paint(i);
      if (hooks.onFlagsChanged) hooks.onFlagsChanged(board);
    }

    function lose(hitIdx) {
      board.over = true;
      cells.forEach(function (c, i) {
        var el = boardEl.children[i];
        if (c.mine && !c.flagged) {
          el.className = 'mine-cell revealed' + (i === hitIdx ? ' mine-hit' : '');
          el.textContent = '💣';
        } else if (!c.mine && c.flagged) {
          el.className = 'mine-cell revealed';
          el.textContent = '❌'; // 插错的旗
        }
        // 同样收尾装饰（地雷💣上会盖掉模式标记，是否保留由模式方决定）
        if (hooks.decorateCell) hooks.decorateCell(i, c, el);
      });
    }

    /* 重开一局：按 cols 重建格子按钮；不传参则沿用当前尺寸 */
    function reset(o) {
      o = o || {};
      cols = board.cols = (o.cols != null ? o.cols : cols);
      rows = board.rows = (o.rows != null ? o.rows : rows);
      mines = board.mines = (o.mines != null ? o.mines : mines);
      cells = [];
      board.cells = cells;
      for (var i = 0; i < cols * rows; i++) {
        cells.push({ mine: false, count: 0, revealed: false, flagged: false, known: false, exploded: false });
      }
      board.started = false;
      board.over = false;
      board.revealedCount = 0;
      board.flagCount = 0;
      clearTimeout(pressTimer);
      pressTimer = null;
      suppressClick = false;
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
      paintAll();   // 走一遍 paint 让模式方的 decorateCell 在新棋盘上就位
      boardEl.win98Board = board;   // 供自动化验收读取棋盘状态
    }

    /* 随机翻开 k 个未翻开的非雷格（走正常 flood reveal；地下城道具用） */
    function revealRandomSafe(k) {
      var pool = [];
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (c.mine || c.revealed || c.flagged || c.known) continue;
        pool.push(i);
      }
      for (var n = 0; n < k && pool.length; n++) {
        reveal(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
    }

    /* 随机把 k 颗未标记雷标为 known=true 并 paint（地下城探测仪用） */
    function markRandomMines(k) {
      var pool = [];
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].mine && !cells[i].known && !cells[i].revealed) pool.push(i);
      }
      for (var n = 0; n < k && pool.length; n++) {
        var idx = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        cells[idx].known = true;
        paint(idx);
      }
    }

    /* ---------------- 输入：鼠标 + 触屏（Pointer Events） ---------------- */

    function cellFromEvent(e) {
      var cell = e.target && e.target.closest ? e.target.closest('.mine-cell') : null;
      return cell && boardEl.contains(cell) ? Number(cell.dataset.idx) : -1;
    }

    // 翻开（鼠标左键 / 触屏轻点）；点已翻开的数字格先问模式方，未处理则 chord 快开
    boardEl.addEventListener('click', function (e) {
      var idx = cellFromEvent(e);
      if (idx < 0) return;
      if (suppressClick) { suppressClick = false; return; }
      if (!interactable()) return;
      if (cells[idx].revealed) {
        if (hooks.onRevealedClick && hooks.onRevealedClick(idx, board)) return;
        chord(idx);
      } else {
        reveal(idx);
      }
    });

    // 插旗（鼠标右键；部分触屏系统的长按也会派发此事件，需与长按去重）
    boardEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var idx = cellFromEvent(e);
      if (idx < 0) return;
      if (!interactable()) return;
      if (Date.now() - lastFlagTime < LONG_PRESS_MS) return; // 刚被长按处理过
      toggleFlag(idx);
    });

    // 插旗（触屏长按；鼠标右键走上面的 contextmenu，不重复处理）。
    // 顺带还原经典细节：按下格子时笑脸张嘴 😮，松开/移出恢复（右键插旗不变脸）
    boardEl.addEventListener('pointerdown', function (e) {
      var idx = cellFromEvent(e);
      if (idx < 0) return;
      if (interactable() && e.button !== 2 && hooks.onPressMood) hooks.onPressMood('o');
      if (e.pointerType === 'mouse') return;
      if (!interactable()) return;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        pressTimer = null;
        if (!interactable()) return;
        suppressClick = true;
        toggleFlag(idx);
        lastFlagTime = Date.now(); // 只记长按插旗：部分触屏系统随后还会派发 contextmenu，靠它去重
      }, LONG_PRESS_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      boardEl.addEventListener(type, function () {
        clearTimeout(pressTimer);
        pressTimer = null;
        if (interactable() && hooks.onPressMood) hooks.onPressMood('smile');
      });
    });

    // 用初始配置建第一局（之后由模式方调 reset 换难度）
    reset({ cols: opts.cols, rows: opts.rows, mines: opts.mines });

    return board;
  }

  return {
    MODES: {},
    pad3: pad3,
    fitWindowToContent: fitWindowToContent,
    createBoard: createBoard
  };
})();
