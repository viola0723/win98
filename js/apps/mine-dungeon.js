/* ============================================================
 * 扫雷·地下城（mine-dungeon）—— 经典扫雷 × 地下城肉鸽
 * 设定：往旧电脑的硬盘深处钻，层数 B1、B2…，雷 = 坏扇区；
 *       每层雷区藏 1 个「出口」🕳️，翻到显形、点它下楼抽增益。
 * 本文件只注册模式：WIN98_MINE_CORE.MODES.dungeon。
 * 棋盘/输入/首击安全/插旗长按全部由共享引擎 js/apps/mine-core.js 提供，
 * 本文件严格按引擎契约编程（契约见任务书/引擎注释）；
 * 引擎未加载时静默 return 不报错（两文件并行开发，加载顺序须 core 在前）。
 * ============================================================ */
(function () {
  'use strict';

  var CORE = window.WIN98_MINE_CORE;
  if (!CORE || typeof CORE.createBoard !== 'function') return;   // 引擎未就位，静默退出
  CORE.MODES = CORE.MODES || {};

  /* ---------------- 增益池（数据驱动，加卡 = 这里加一条） ----------------
   * stack:true   可重复抽取、效果叠加；
   * stack:false  拥有后不再出现在抽卡池（目前仅护甲）；
   * instant:true 抽中立即生效、无持续效果（不进 HUD 增益列表，效果已体现在心心上）。
   * stackOf(run) 返回 HUD 图标旁的堆叠数，返回 null 表示不显示数字。
   * 局外成长（解锁/图鉴）留口子：未来在抽卡前按 unlock 表过滤 POOL 即可。 */
  var POOL = [
    { id: 'scanner', icon: '📡', name: '探测仪', desc: '每层开始自动标记 1 颗雷', stack: true,
      apply: function (run) { run.scanner += 1; },
      stackOf: function (run) { return run.scanner; } },
    { id: 'shield', icon: '🛡️', name: '护甲', desc: '每层抵挡第一次踩雷', stack: false,
      apply: function (run) { run.shield = true; },
      stackOf: function () { return null; } },
    { id: 'vitality', icon: '💗', name: '强心剂', desc: '生命上限 +1，并回复 1 点', stack: true,
      apply: function (run) { run.maxHp += 1; run.hp = Math.min(run.maxHp, run.hp + 1); },
      stackOf: function (run) { return run.perks.vitality || 0; } },
    { id: 'boots', icon: '🥾', name: '排雷靴', desc: '抵挡 2 次踩雷伤害', stack: true,
      apply: function (run) { run.boots += 2; },
      stackOf: function (run) { return run.boots; } },
    { id: 'xray', icon: '🔮', name: '透视', desc: '每层开始随机翻开 3 个安全格', stack: true,
      apply: function (run) { run.xray += 3; },
      stackOf: function (run) { return run.xray; } },
    { id: 'medkit', icon: '💊', name: '急救包', desc: '立即回复 2 点生命', stack: true, instant: true,
      apply: function (run) { run.hp = Math.min(run.maxHp, run.hp + 2); },
      stackOf: function () { return null; } }
  ];

  var DEEPEST_KEY = 'win98.mine.dungeon.deepest';   // localStorage：历史最深抵达层数

  /* ---------------- 楼层参数 ----------------
   * B1 = 9×9/10 雷（同经典初级）；尺寸每两层 +1、封顶 16；
   * 坏道密度从 12% 起每层 +0.8%、封顶 22%。 */
  function floorSize(floor) {
    return Math.min(9 + Math.floor((floor - 1) / 2), 16);
  }
  function floorDensity(floor) {
    return Math.min(0.12 + 0.008 * (floor - 1), 0.22);
  }
  function floorMines(floor) {
    var size = floorSize(floor);
    return Math.round(size * size * floorDensity(floor));
  }

  function pad2(n) { return ('0' + n).slice(-2); }

  /* ---------------- 最深纪录（localStorage 不可用时静默降级） ---------------- */
  function loadDeepest() {
    try {
      var v = parseInt(window.localStorage.getItem(DEEPEST_KEY), 10);
      return v > 0 ? v : 0;
    } catch (err) {
      return 0;
    }
  }
  function saveDeepest(floor) {
    if (floor <= loadDeepest()) return;   // 只在新纪录时写入
    try { window.localStorage.setItem(DEEPEST_KEY, String(floor)); } catch (err) { /* 忽略 */ }
  }

  /* ================ 模式主体 ================ */
  CORE.MODES.dungeon = function (containerEl, ctx) {
    var win = ctx.win;
    var bodyEl = ctx.bodyEl;

    /* 本局状态（形状固定，方便以后做局外存档）；
       shieldFloor = 本层护甲是否已充能：每层开始若拥有护甲自动充能，
       本层首次踩雷消耗掉置 false（实现「每层抵挡第一次踩雷」）。 */
    var run;
    var board = null;
    var runToken = 0;        // 每开一局 +1：让上一局遗留的 setTimeout 回调失效
    var exitFound = false;   // 本层出口是否已显形（提示 toast 每层只弹一次）
    var overlayOpen = false; // 覆盖层（抽卡/结束）打开时冻结棋盘输入
    var inputLocked = false; // 下楼流程中冻结棋盘输入
    var toastTimer = null;
    var clearTimer = null;   // 全清后自动下楼的延时

    /* --- DOM：toolbar(HUD) + panel 两排结构（fitWindowToContent 的要求） --- */
    containerEl.innerHTML =
      '<div class="app-mine-dg">' +
      '  <div class="mine-dg-hud" data-role="hud">' +
      '    <span class="mine-dg-floor" data-role="floor">B1</span>' +
      '    <span class="mine-dg-hearts" data-role="hearts"></span>' +
      '    <span class="mine-dg-perks" data-role="perks"></span>' +
      '    <span class="mine-dg-deepest" data-role="deepest"></span>' +
      '  </div>' +
      '  <div class="mine-panel" data-role="panel">' +
      '    <div class="mine-header sunken-panel">' +
      '      <span class="mine-lcd" data-role="mines">010</span>' +
      '      <button type="button" class="mine-face" data-role="face" aria-label="重新开始">🙂</button>' +
      '      <span class="mine-lcd" data-role="floorlcd">B01</span>' +
      '    </div>' +
      '    <div class="mine-board sunken-panel" data-role="board" aria-label="雷区"></div>' +
      '  </div>' +
      '  <div class="mine-dg-toast" data-role="toast"></div>' +
      '</div>';

    var appEl = containerEl.querySelector('.app-mine-dg');
    // fitWindowToContent 的锚点根：与经典模式一致用容器根 .app-mine（含 Tab 行），
    // 否则窗口高度会少算 Tab 行一截、棋盘下缘被裁
    var rootEl = bodyEl.querySelector('.app-mine') || appEl;
    var hudEl = containerEl.querySelector('[data-role="hud"]');
    var panelEl = containerEl.querySelector('[data-role="panel"]');
    var boardEl = containerEl.querySelector('[data-role="board"]');
    var faceEl = containerEl.querySelector('[data-role="face"]');
    var minesEl = containerEl.querySelector('[data-role="mines"]');
    var floorLcdEl = containerEl.querySelector('[data-role="floorlcd"]');
    var floorEl = containerEl.querySelector('[data-role="floor"]');
    var heartsEl = containerEl.querySelector('[data-role="hearts"]');
    var perksEl = containerEl.querySelector('[data-role="perks"]');
    var deepestEl = containerEl.querySelector('[data-role="deepest"]');
    var toastEl = containerEl.querySelector('[data-role="toast"]');

    /* ---------------- HUD / LCD ---------------- */

    function updateMinesLcd() {
      minesEl.textContent = CORE.pad3(board ? board.remainingFlags() : 0);
    }

    function updateHud() {
      floorEl.textContent = 'B' + run.floor;
      floorLcdEl.textContent = 'B' + pad2(run.floor);
      var hearts = '';
      for (var i = 0; i < run.maxHp; i++) hearts += i < run.hp ? '❤️' : '🖤';
      heartsEl.textContent = hearts;
      heartsEl.title = '生命 ' + run.hp + ' / ' + run.maxHp;
      // 已拥有增益列表：icon + 堆叠数，title = 名称 + 描述（instant 卡无持续效果，不进列表）
      perksEl.innerHTML = '';
      POOL.forEach(function (p) {
        if (p.instant || !run.perks[p.id]) return;
        var n = p.stackOf ? p.stackOf(run) : null;
        var s = document.createElement('span');
        s.className = 'mine-dg-perk' + (p.id === 'shield' && !run.shieldFloor ? ' off' : '');
        s.title = p.name + '：' + p.desc +
          (p.id === 'shield' ? (run.shieldFloor ? '（本层已充能）' : '（本层已消耗）') : '');
        s.textContent = p.icon + (n === null || n === undefined ? '' : '×' + n);
        perksEl.appendChild(s);
      });
      deepestEl.textContent = '最深 B' + Math.max(loadDeepest(), run.floor);
    }

    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.remove('show');
      void toastEl.offsetWidth;   // 强制回流，让连续 toast 重新播放出现动画
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1200);
    }

    /* ---------------- 覆盖层（抽卡 / 本局结束） ---------------- */

    function openOverlay(node) {
      closeOverlays();
      appEl.appendChild(node);
      overlayOpen = true;
    }
    function closeOverlays() {
      var list = appEl.querySelectorAll('.mine-dg-overlay');
      for (var i = 0; i < list.length; i++) list[i].parentNode.removeChild(list[i]);
      overlayOpen = false;
    }

    /* 三选一抽卡：随机取 3 张不同 id；已拥有的非 stack 卡不再出现 */
    function offerCards(onPick) {
      var avail = [];
      POOL.forEach(function (p) {
        if (p.instant || p.stack || !run.perks[p.id]) avail.push(p);
      });
      for (var i = avail.length - 1; i > 0; i--) {   // Fisher-Yates 洗牌
        var j = Math.floor(Math.random() * (i + 1));
        var t = avail[i]; avail[i] = avail[j]; avail[j] = t;
      }
      var picks = avail.slice(0, 3);
      var ov = document.createElement('div');
      ov.className = 'mine-dg-overlay';
      ov.innerHTML =
        '<div class="mine-dg-dialog">' +
        '  <div class="mine-dg-title">选择一项强化</div>' +
        '  <div class="mine-dg-cards"></div>' +
        '</div>';
      var box = ov.querySelector('.mine-dg-cards');
      picks.forEach(function (p) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mine-dg-card';
        btn.innerHTML =
          '<span class="mine-dg-card-icon">' + p.icon + '</span>' +
          '<span class="mine-dg-card-name">' + p.name + '</span>' +
          '<span class="mine-dg-card-desc">' + p.desc + '</span>';
        btn.addEventListener('click', function () { onPick(p); });
        box.appendChild(btn);
      });
      openOverlay(ov);
    }

    function showGameOver() {
      var ov = document.createElement('div');
      ov.className = 'mine-dg-overlay';
      ov.innerHTML =
        '<div class="mine-dg-dialog">' +
        '  <div class="mine-dg-title">信号中断…</div>' +
        '  <div class="mine-dg-stats">抵达层数：B' + run.floor + '</div>' +
        '  <div class="mine-dg-stats">历史最深：B' + loadDeepest() + '</div>' +
        '  <button type="button" class="mine-dg-again">再来一局</button>' +
        '</div>';
      ov.querySelector('.mine-dg-again').addEventListener('click', function () { newRun(); });
      openOverlay(ov);
    }

    /* ---------------- 游戏流程 ---------------- */

    /* 下楼：冻结输入 → 抽卡 → 生效 → 层数+1 重开棋盘 → toast → 恢复输入 */
    function descend() {
      inputLocked = true;
      offerCards(function (card) {
        closeOverlays();
        card.apply(run);
        run.perks[card.id] = (run.perks[card.id] || 0) + 1;
        run.floor += 1;
        saveDeepest(run.floor);   // 抵达新层存一次纪录
        startFloor();
        toast('B' + run.floor + ' · 坏道密度 ' + Math.round(floorDensity(run.floor) * 100) + '%');
        inputLocked = false;
      });
    }

    function startFloor() {
      var size = floorSize(run.floor);
      exitFound = false;
      clearTimeout(clearTimer);
      run.shieldFloor = run.shield;   // 护甲每层开始自动充能（未拥有则为 false）
      if (board) {
        board.reset({ cols: size, rows: size, mines: floorMines(run.floor) });
      } else {
        board = CORE.createBoard({
          boardEl: boardEl,
          cols: size,
          rows: size,
          mines: floorMines(run.floor),
          hooks: {
            canInteract: function () { return !overlayOpen && !inputLocked; },
            onMineHit: onMineHit,
            onAllClear: onAllClear,
            onCellRevealed: onCellRevealed,
            onRevealedClick: onRevealedClick,
            onFlagsChanged: function () { updateMinesLcd(); },
            onFirstClick: onFirstClick,
            decorateCell: decorateCell,
            onPressMood: onPressMood
          }
        });
      }
      updateMinesLcd();
      updateHud();
      // 换层后滚回左上角（手机端上一层的横向滚动位置会残留）
      containerEl.scrollLeft = 0;
      containerEl.scrollTop = 0;
      bodyEl.scrollLeft = 0;
      bodyEl.scrollTop = 0;
      if (typeof CORE.fitWindowToContent === 'function') {
        CORE.fitWindowToContent(win, bodyEl, rootEl, hudEl, panelEl);
      }
    }

    function newRun() {
      runToken++;   // 上一局遗留的延时回调（死亡弹层/全清下楼）凭 token 失效
      run = {
        floor: 1, hp: 3, maxHp: 3,
        shield: false, shieldFloor: false,
        boots: 0, scanner: 0, xray: 0,
        perks: {}, over: false
      };
      inputLocked = false;
      closeOverlays();
      faceEl.textContent = '🙂';
      startFloor();
    }

    /* ---------------- 引擎钩子 ---------------- */

    /* 踩雷减伤链：护甲（每层一次）> 排雷靴（次数）> HP；
       返回 false = 存活（引擎标该格已爆💥继续），true = 致命（引擎揭全盘） */
    function onMineHit(idx, b) {
      if (run.shieldFloor) {
        run.shieldFloor = false;
        updateHud();
        toast('🛡️ 护甲抵挡了这次踩雷');
        return false;
      }
      if (run.boots > 0) {
        run.boots -= 1;
        updateHud();
        toast('🥾 排雷靴抵挡了这次踩雷（剩 ' + run.boots + ' 次）');
        return false;
      }
      run.hp -= 1;
      updateHud();
      if (run.hp > 0) {
        toast('踩中坏扇区！剩 ' + run.hp + ' 点生命');
        return false;
      }
      // HP 归零：致命。引擎随即揭全盘；延迟再弹结束层，让玩家先看清盘面
      run.over = true;
      faceEl.textContent = '💀';
      saveDeepest(run.floor);   // 死亡时存一次纪录
      var token = runToken;
      setTimeout(function () {
        if (token === runToken && run.over) showGameOver();
      }, 700);
      return true;
    }

    /* 全清奖励：回复 1 点 HP（不超上限）。
       注意：契约里引擎全清时已先置 board.over + 自动插旗，出口再点不动、
       本层也没有可下的棋了 —— 稍事停留让玩家看清盘面后自动下楼。
       （「贪不贪全清」的选择权在翻到出口那一刻，全清本身强制收尾） */
    function onAllClear(b) {
      if (run.over) return;
      run.hp = Math.min(run.maxHp, run.hp + 1);
      updateHud();
      toast('全清奖励 +1 ❤️');
      var token = runToken;
      clearTimer = setTimeout(function () {
        if (token === runToken && !run.over && !overlayOpen) descend();
      }, 900);
    }

    /* 出口翻到即显形（每层只 toast 一次） */
    function onCellRevealed(idx, b) {
      var cell = b.cells[idx];
      if (cell.exit && !exitFound) {
        exitFound = true;
        toast('发现出口 🕳️ 点它下到 B' + (run.floor + 1));
      }
    }

    /* 点已翻开格：是出口 → 下楼（返回 true 跳过引擎 chord）；否则交回引擎 */
    function onRevealedClick(idx, b) {
      var cell = b.cells[idx];
      if (!cell.exit || run.over) return false;
      descend();
      return true;
    }

    /* 首击布雷完成后：埋出口（随机一个非雷格，契约允许扩展 cell 字段），
       再上自动效果——探测仪标雷、透视开格 */
    function onFirstClick(b) {
      var safe = [];
      for (var i = 0; i < b.cells.length; i++) {
        if (!b.cells[i].mine) safe.push(i);
      }
      if (safe.length) {
        b.cells[safe[Math.floor(Math.random() * safe.length)]].exit = true;
      }
      if (run.scanner > 0) b.markRandomMines(run.scanner);
      if (run.xray > 0) b.revealRandomSafe(run.xray);
    }

    /* paint 收尾追加装饰：出口🕳️ / 已爆💥 / 探测📡 */
    function decorateCell(idx, cell, el) {
      if (cell.revealed) {
        if (cell.exploded) {
          el.textContent = '💥';
        } else if (cell.exit) {
          el.textContent = '🕳️';
          el.classList.add('mine-dg-exit');
          el.title = '出口：下到 B' + (run.floor + 1);
        }
      } else if (cell.known && !cell.flagged) {
        el.textContent = '📡';
        el.title = '探测仪标记的坏扇区';
      }
    }

    function onPressMood(mood) {
      if (run.over) return;
      faceEl.textContent = mood === 'o' ? '😮' : '🙂';
    }

    /* ---------------- 脸按钮 = 重开一局（回 B1，状态全重置） ---------------- */
    faceEl.addEventListener('click', function () { newRun(); });

    newRun();
  };
})();
