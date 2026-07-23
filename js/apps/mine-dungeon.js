/* ============================================================
 * 扫雷·寻找时间胶囊（mine-dungeon，原「地下城」2.0）—— 经典扫雷 × 肉鸽
 *
 * 故事：硬盘深处 11 层坏道区，最底层（B11）封存着一枚 1998 年的时间胶囊——
 *       机主小时候写给未来的信。数据散成了碎片，下去把它修好。
 * 一局流程：选职业（3 选 1）→ B1–B10 找出口🕳️下楼（每层藏 1 个宝箱🎁：随机金币、
 *       概率掉记忆碎片）→ 每次下楼三选一强化 → 每过完 2 层（B2/4/6/8/10）进商店
 *       → B11 Boss 层（无出口必须全清、踩雷伤害 2）→ 结局判定：
 *       记忆碎片 ≥ FRAG_GOAL → 好结局（胶囊修复，读完整的信），不足 → 坏结局（残缺的信）。
 * 体系：职业技能（每层 1 次主动 + 被动）、装备（永久被动，三选一/商店获得）、
 *       消耗品（数量制，装备栏点击使用；📡/🔮 均为一次性，显示数量 = 可用次数）。
 * 防误触：ctx.setGuard 向容器登记进度判断（本层已开局 / 已深入 B2+ 且未结束），
 *       切模式 Tab 前容器会弹「放弃当前对局」确认。
 * 本文件只注册模式：WIN98_MINE_CORE.MODES.dungeon。
 * 棋盘/输入/首击安全/插旗长按全部由共享引擎 js/apps/mine-core.js 提供；
 * 引擎未加载时静默 return（加载顺序须 core 在前）。
 * ============================================================ */
(function () {
  'use strict';

  var CORE = window.WIN98_MINE_CORE;
  if (!CORE || typeof CORE.createBoard !== 'function') return;   // 引擎未就位，静默退出
  CORE.MODES = CORE.MODES || {};

  var MAX_FLOOR = 11;      // 总层数，B11 为 Boss 层
  var FRAG_GOAL = 5;       // 好结局所需记忆碎片

  /* ---------------- 职业（数据驱动，加职业 = 这里加一条） ----------------
   * hp          生命上限（被动）；
   * startItems  开局自带消耗品；startGold 开局金币；chestBonus 宝箱金币加成；
   * skill       主动技能：每层 1 次（装备🔋备用电池可 +1），use(api) 返回 toast 文案。
   * api = { run, board, unmarkedMines }，每次调用现取，数据表可安全放顶层。 */
  var CLASSES = [
    { id: 'tech', icon: '🧰', name: '维修技师', hp: 4,
      passive: '生命上限 4',
      skill: { icon: '🔧', name: '紧急修复', desc: '回复 1 点生命',
        use: function (api) {
          api.run.hp = Math.min(api.run.maxHp, api.run.hp + 1);
          return '🔧 紧急修复 +1 ❤️';
        } } },
    { id: 'scout', icon: '🔍', name: '探测员', hp: 3,
      passive: '开局自带 📡×2、🔮×1',
      startItems: { radar: 2, xray: 1 },
      skill: { icon: '📡', name: '声呐脉冲', desc: '标记 1 颗随机雷',
        use: function (api) {
          api.board.markRandomMines(1);
          return '📡 声呐标记了 1 颗雷';
        } } },
    { id: 'scav', icon: '💰', name: '拾荒者', hp: 3,
      passive: '宝箱金币 +50%，开局 +15 金',
      startGold: 15, chestBonus: 0.5,
      skill: { icon: '⛏️', name: '淘金热', desc: '随机获得 3–8 金币',
        use: function (api) {
          var g = 3 + Math.floor(Math.random() * 6);
          api.run.gold += g;
          return '⛏️ 淘金 +' + g + ' 💰';
        } } }
  ];

  /* ---------------- 装备（永久被动） ----------------
   * stack:false 拥有后从三选一/商店池中剔除；apply 负责 run.gear 计数与副作用。 */
  var GEAR = [
    { id: 'shield', icon: '🛡️', name: '防爆护甲', desc: '每层抵挡第 1 次踩雷', stack: false,
      apply: function (run) { run.gear.shield = 1; } },
    { id: 'vital', icon: '💗', name: '强心剂', desc: '生命上限 +1，并回复 1 点', stack: true,
      apply: function (run) {
        run.maxHp += 1;
        run.hp = Math.min(run.maxHp, run.hp + 1);
        run.gear.vital = (run.gear.vital || 0) + 1;
      } },
    { id: 'gloves', icon: '🧤', name: '拾荒手套', desc: '宝箱金币 +25%', stack: true,
      apply: function (run) { run.gear.gloves = (run.gear.gloves || 0) + 1; } },
    { id: 'member', icon: '🏷️', name: '会员卡', desc: '商店价格 -20%', stack: false,
      apply: function (run) { run.gear.member = 1; } },
    { id: 'battery', icon: '🔋', name: '备用电池', desc: '职业技能每层多用 1 次', stack: true,
      apply: function (run) { run.gear.battery = (run.gear.battery || 0) + 1; } }
  ];

  /* ---------------- 消耗品（数量制，装备栏点击使用；首击布雷后才可用） ----------------
   * canUse(api) 返回 false 时禁用并提示 cantMsg；use(api) 返回 toast 文案。 */
  var ITEMS = {
    radar: { icon: '📡', name: '探测仪', desc: '标记 1 颗随机未标记雷', price: 8,
      canUse: function (api) { return api.unmarkedMines() > 0; },
      cantMsg: '这一层没有可标记的雷了',
      use: function (api) { api.board.markRandomMines(1); return '📡 探测仪标记了 1 颗雷'; } },
    xray: { icon: '🔮', name: '透视', desc: '随机翻开 3 个安全格', price: 10,
      use: function (api) { api.board.revealRandomSafe(3); return '🔮 透视翻开了 3 个安全格'; } },
    med: { icon: '💊', name: '急救包', desc: '回复 2 点生命', price: 12,
      canUse: function (api) { return api.run.hp < api.run.maxHp; },
      cantMsg: '生命已满',
      use: function (api) {
        api.run.hp = Math.min(api.run.maxHp, api.run.hp + 2);
        return '💊 +2 ❤️';
      } }
  };
  var ITEM_IDS = ['radar', 'xray', 'med'];

  /* 三选一混池里的消耗品包（装备之外的填充位） */
  var PACKS = [
    { kind: 'pack', icon: '📡', name: '探测仪 ×2', desc: '消耗品：标记 1 颗随机雷', pack: { radar: 2 } },
    { kind: 'pack', icon: '🔮', name: '透视 ×1', desc: '消耗品：翻开 3 个随机安全格', pack: { xray: 1 } },
    { kind: 'pack', icon: '💊', name: '急救包 ×1', desc: '消耗品：回复 2 点生命', pack: { med: 1 } }
  ];

  /* ---------------- 文案 ---------------- */
  var STORY_INTRO = '硬盘深处检测到 11 层坏道区。最底层封存着一枚 1998 年的时间胶囊——' +
    '机主小时候写给未来的信。信号越来越弱，带上工具，下去把它修好吧。';

  var LETTER_GOOD = [
    '你好，未来的人：',
    '今天是 1998 年 6 月 12 日，我把这封信存在硬盘最深的扇区里。',
    '爸爸说这块硬盘能存下整个世界。我不信，世界那么大，硬盘这么小。可我还是想试试。',
    '我想知道，未来的电脑会不会像人一样说话？未来的你们，还会不会在扫雷里踩到雷？',
    '他们总说机器会旧，人会老。可我觉得，想象力不会。',
    '如果你读到了这封信，说明它熬过了所有的坏道。那就请你，替我好好看看未来。',
    '—— 一个 1998 年的小孩'
  ];

  /* 坏结局：同一封信，关键句在坏道里丢了 */
  var LETTER_BAD = [
    '你好，未来的人：',
    '今天是 1998 年 □ 月 □□ 日，我把这封信存在硬盘最深的扇区里。',
    '爸爸说这块硬盘能存下 □□□□。我不信，世界那么大，硬盘这么小。可我还是想试试。',
    '我想知道，未来的电脑会不会 □□□□□□？未来的你们，还会不会在 □□ 里踩到雷？',
    '他们总说机器会旧，人会老。可我觉得，□□□□□。',
    '如果你读到了这封信，说明它 □□□□□□□□。那就请你，替我好好看看 □□。',
    '—— 一个 1998 年的小孩'
  ];

  var DEEPEST_KEY = 'win98.mine.dungeon.deepest';   // localStorage：历史最深抵达层数
  var ENDING_KEY = 'win98.mine.dungeon.ending';     // localStorage：好结局达成过 = 'good'

  /* ---------------- 楼层参数 ----------------
   * B1–2 = 9×9，之后每两层 +1、封顶 12（配 30px 格子，手机 390px 刚好放下）；
   * 坏道密度 12% 起每层 +1%、常规封顶 22%，Boss 层 24%。 */
  function floorSize(floor) {
    return Math.min(9 + Math.floor((floor - 1) / 2), 12);
  }
  function floorDensity(floor) {
    if (floor >= MAX_FLOOR) return 0.24;
    return Math.min(0.12 + 0.01 * (floor - 1), 0.22);
  }
  function floorMines(floor) {
    var size = floorSize(floor);
    return Math.round(size * size * floorDensity(floor));
  }

  function pad2(n) { return ('0' + n).slice(-2); }

  /* ---------------- localStorage（不可用时静默降级） ---------------- */
  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* 忽略 */ }
  }
  function loadDeepest() {
    var v = parseInt(storageGet(DEEPEST_KEY), 10);
    return v > 0 ? v : 0;
  }
  function saveDeepest(floor) {
    if (floor <= loadDeepest()) return;   // 只在新纪录时写入
    storageSet(DEEPEST_KEY, String(floor));
  }

  /* ================ 模式主体 ================ */
  CORE.MODES.dungeon = function (containerEl, ctx) {
    var win = ctx.win;
    var bodyEl = ctx.bodyEl;

    /* 本局状态（newRun 时重建；run 为 null = 还在职业选择，没有对局可丢）；
       shieldFloor = 本层护甲是否已充能：每层开始若拥有护甲自动充能，
       本层首次踩雷消耗掉置 false（实现「每层抵挡第 1 次踩雷」）。 */
    var run = null;
    var classDef = null;
    var board = null;
    var runToken = 0;        // 每开一局 +1：让上一局遗留的 setTimeout 回调失效
    var exitFound = false;   // 本层出口是否已显形（提示 toast 每层只弹一次）
    var overlayOpen = false; // 覆盖层（职业/抽卡/商店/结局）打开时冻结棋盘输入
    var inputLocked = false; // 下楼流程中冻结棋盘输入
    var toastTimer = null;
    var clearTimer = null;   // 全清后自动下楼的延时

    /* --- DOM：HUD(第一排) + panel(棋盘) + belt(装备栏) + toast --- */
    containerEl.innerHTML =
      '<div class="app-mine-dg">' +
      '  <div class="mine-dg-hud" data-role="hud">' +
      '    <span class="mine-dg-floor" data-role="floor">B1/' + MAX_FLOOR + '</span>' +
      '    <span class="mine-dg-hearts" data-role="hearts"></span>' +
      '    <span class="mine-dg-gold" data-role="gold">💰 0</span>' +
      '    <span class="mine-dg-frags" data-role="frags" title="记忆碎片：集满 ' + FRAG_GOAL + ' 片可修复时间胶囊">◆ 0/' + FRAG_GOAL + '</span>' +
      '    <span class="mine-dg-deepest" data-role="deepest"></span>' +
      '  </div>' +
      '  <div class="mine-panel" data-role="panel">' +
      '    <div class="mine-header sunken-panel">' +
      '      <span class="mine-lcd" data-role="mines">010</span>' +
      '      <button type="button" class="mine-face" data-role="face" aria-label="重新开始">🙂</button>' +
      '      <span class="mine-lcd" data-role="floorlcd">B01</span>' +
      '    </div>' +
      '    <div class="mine-board sunken-panel" data-role="board" aria-label="雷区"></div>' +
      '    <div class="mine-dg-toast" data-role="toast"></div>' +
      '  </div>' +
      '  <div class="mine-dg-belt" data-role="belt">' +
      '    <button type="button" class="mine-dg-skill" data-role="skill"></button>' +
      '    <span class="mine-dg-items" data-role="items"></span>' +
      '    <span class="mine-dg-gear" data-role="gear"></span>' +
      '  </div>' +
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
    var goldEl = containerEl.querySelector('[data-role="gold"]');
    var fragsEl = containerEl.querySelector('[data-role="frags"]');
    var deepestEl = containerEl.querySelector('[data-role="deepest"]');
    var skillBtn = containerEl.querySelector('[data-role="skill"]');
    var itemsEl = containerEl.querySelector('[data-role="items"]');
    var gearEl = containerEl.querySelector('[data-role="gear"]');
    var toastEl = containerEl.querySelector('[data-role="toast"]');

    /* ---------------- HUD / 装备栏 ---------------- */

    function updateMinesLcd() {
      minesEl.textContent = CORE.pad3(board ? board.remainingFlags() : 0);
    }

    function updateHud() {
      floorEl.textContent = 'B' + run.floor + '/' + MAX_FLOOR;
      floorLcdEl.textContent = 'B' + pad2(run.floor);
      var hearts = '';
      for (var i = 0; i < run.maxHp; i++) hearts += i < run.hp ? '❤️' : '🖤';
      heartsEl.textContent = hearts;
      heartsEl.title = '生命 ' + run.hp + ' / ' + run.maxHp;
      goldEl.textContent = '💰 ' + run.gold;
      goldEl.title = '金币：每过 2 层可在商店消费';
      fragsEl.textContent = '◆ ' + Math.min(run.fragments, 99) + '/' + FRAG_GOAL + (run.fragments >= FRAG_GOAL ? ' ✓' : '');
      deepestEl.textContent = '最深 B' + Math.max(loadDeepest(), run.floor);
    }

    /* 装备栏 = 职业技能按钮 + 消耗品（点击使用）+ 已拥有装备图标 */
    function updateBelt() {
      var sk = classDef.skill;
      skillBtn.textContent = sk.icon + ' ' + sk.name + ' ×' + run.skillCharges;
      skillBtn.title = sk.name + '：' + sk.desc;
      skillBtn.disabled = run.skillCharges <= 0 || !board.started || run.over;

      itemsEl.innerHTML = '';
      ITEM_IDS.forEach(function (id) {
        var it = ITEMS[id];
        var n = run.items[id] || 0;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mine-dg-item';
        b.dataset.item = id;
        b.textContent = it.icon + '×' + n;
        b.title = it.name + '：' + it.desc;
        b.disabled = n <= 0 || !board.started || run.over;
        itemsEl.appendChild(b);
      });

      gearEl.innerHTML = '';
      GEAR.forEach(function (g) {
        var n = run.gear[g.id] || 0;
        if (!n) return;
        var s = document.createElement('span');
        s.className = 'mine-dg-perk' + (g.id === 'shield' && !run.shieldFloor ? ' off' : '');
        s.title = g.name + '：' + g.desc +
          (g.id === 'shield' ? (run.shieldFloor ? '（本层已充能）' : '（本层已消耗）') : '');
        s.textContent = g.icon + (n > 1 ? '×' + n : '');
        gearEl.appendChild(s);
      });
    }

    function refresh() {
      updateMinesLcd();
      updateHud();
      updateBelt();
    }

    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.remove('show');
      void toastEl.offsetWidth;   // 强制回流，让连续 toast 重新播放出现动画
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1200);
    }

    /* ---------------- 消耗品 / 技能 ---------------- */

    function unmarkedMines() {
      if (!board) return 0;
      var n = 0;
      for (var i = 0; i < board.cells.length; i++) {
        var c = board.cells[i];
        if (c.mine && !c.known && !c.revealed) n++;
      }
      return n;
    }

    function useItem(id) {
      var it = ITEMS[id];
      if (!it || !run || run.over || !board.started) return;
      if ((run.items[id] || 0) <= 0) return;
      var api = { run: run, board: board, unmarkedMines: unmarkedMines };
      if (it.canUse && !it.canUse(api)) { toast(it.cantMsg || '现在用不了'); return; }
      run.items[id] -= 1;
      toast(it.use(api));
      refresh();
    }

    skillBtn.addEventListener('click', function () {
      if (!run || run.over || !board.started || run.skillCharges <= 0) return;
      run.skillCharges -= 1;
      toast(classDef.skill.use({ run: run, board: board, unmarkedMines: unmarkedMines }));
      refresh();
    });
    itemsEl.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-item]') : null;
      if (b && !b.disabled) useItem(b.dataset.item);
    });

    /* ---------------- 覆盖层（职业选择 / 三选一 / 商店 / 结束 / 结局） ---------------- */

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

    /* 职业选择：故事引入 + 三张职业卡；对局进行中经笑脸进入时给「继续当前探索」 */
    function showClassSelect() {
      var seenGood = storageGet(ENDING_KEY) === 'good';
      var ov = document.createElement('div');
      ov.className = 'mine-dg-overlay';
      ov.innerHTML =
        '<div class="mine-dg-dialog mine-dg-wide">' +
        '  <div class="mine-dg-title">扫雷 · 寻找时间胶囊</div>' +
        '  <div class="mine-dg-story">' + STORY_INTRO + '</div>' +
        (seenGood ? '<div class="mine-dg-badge">💊 时间胶囊已解封</div>' : '') +
        '  <div class="mine-dg-cards" data-role="classes"></div>' +
        (run && !run.over ? '<button type="button" data-role="resume">继续当前探索</button>' : '') +
        '</div>';
      var box = ov.querySelector('[data-role="classes"]');
      CLASSES.forEach(function (c) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mine-dg-card';
        btn.dataset.cls = c.id;
        var hearts = '';
        for (var i = 0; i < c.hp; i++) hearts += '❤️';
        btn.innerHTML =
          '<span class="mine-dg-card-icon">' + c.icon + '</span>' +
          '<span class="mine-dg-card-name">' + c.name + '　' + hearts + '</span>' +
          '<span class="mine-dg-card-desc">被动：' + c.passive +
          '<br>技能：' + c.skill.name + '——' + c.skill.desc + '</span>';
        btn.addEventListener('click', function () { newRun(c.id); });
        box.appendChild(btn);
      });
      var resume = ov.querySelector('[data-role="resume"]');
      if (resume) resume.addEventListener('click', closeOverlays);
      openOverlay(ov);
    }

    /* 三选一：装备池（已拥有的非 stack 装备剔除）+ 消耗品包，洗牌取 3 */
    function offerCards(onPick) {
      var avail = [];
      GEAR.forEach(function (g) {
        if (g.stack || !run.gear[g.id]) avail.push({ kind: 'gear', ref: g, icon: g.icon, name: g.name, desc: g.desc });
      });
      PACKS.forEach(function (p) { avail.push(p); });
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

    /* 商店：三种消耗品 + 1 件随机装备；会员卡 -20%；每货位限购 1 次 */
    function openShop(onLeave) {
      var discount = run.gear.member ? 0.8 : 1;
      var stock = ITEM_IDS.map(function (id) { return { kind: 'item', id: id, price: ITEMS[id].price }; });
      var gearAvail = GEAR.filter(function (g) { return g.stack || !run.gear[g.id]; });
      if (gearAvail.length) {
        stock.push({ kind: 'gear', ref: gearAvail[Math.floor(Math.random() * gearAvail.length)], price: 22 });
      }

      var ov = document.createElement('div');
      ov.className = 'mine-dg-overlay';
      ov.innerHTML =
        '<div class="mine-dg-dialog">' +
        '  <div class="mine-dg-title">🛒 深层商店</div>' +
        '  <div class="mine-dg-stats" data-role="shop-gold"></div>' +
        '  <div class="mine-dg-cards" data-role="shop-cards"></div>' +
        '  <button type="button" data-role="leave">离开商店</button>' +
        '</div>';
      var shopGoldEl = ov.querySelector('[data-role="shop-gold"]');
      var cardsEl = ov.querySelector('[data-role="shop-cards"]');

      function priceOf(p) { return Math.max(1, Math.round(p * discount)); }
      function renderShop() {
        shopGoldEl.textContent = '金币 💰 ' + run.gold + (discount < 1 ? '（会员 -20%）' : '');
        cardsEl.innerHTML = '';
        stock.forEach(function (s) {
          var meta = s.kind === 'item' ? ITEMS[s.id] : s.ref;
          var price = priceOf(s.price);
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'mine-dg-card';
          b.innerHTML =
            '<span class="mine-dg-card-icon">' + meta.icon + '</span>' +
            '<span class="mine-dg-card-name">' + meta.name + ' · 💰' + price + '</span>' +
            '<span class="mine-dg-card-desc">' + (s.sold ? '已购入' : meta.desc) + '</span>';
          b.disabled = s.sold || run.gold < price;
          if (!s.sold) {
            b.addEventListener('click', function () {
              if (run.gold < price) return;
              run.gold -= price;
              if (s.kind === 'item') run.items[s.id] = (run.items[s.id] || 0) + 1;
              else s.ref.apply(run);
              s.sold = true;
              refresh();
              renderShop();
            });
          }
          cardsEl.appendChild(b);
        });
      }
      ov.querySelector('[data-role="leave"]').addEventListener('click', function () {
        closeOverlays();
        onLeave();
      });
      renderShop();
      openOverlay(ov);
    }

    function showGameOver() {
      var ov = document.createElement('div');
      ov.className = 'mine-dg-overlay';
      ov.innerHTML =
        '<div class="mine-dg-dialog">' +
        '  <div class="mine-dg-title">信号中断…</div>' +
        '  <div class="mine-dg-stats">抵达层数：B' + run.floor + ' / ' + MAX_FLOOR + '</div>' +
        '  <div class="mine-dg-stats">历史最深：B' + loadDeepest() + '</div>' +
        '  <button type="button" class="mine-dg-again">再来一局</button>' +
        '</div>';
      ov.querySelector('.mine-dg-again').addEventListener('click', function () { showClassSelect(); });
      openOverlay(ov);
    }

    /* 结局：B11 全清后按碎片数判定；信以「时间胶囊.txt」记事本样式呈现 */
    function showEnding(good) {
      run.over = true;   // 对局完结（防误触 guard 据此放行）
      if (good) storageSet(ENDING_KEY, 'good');
      var letter = (good ? LETTER_GOOD : LETTER_BAD).join('\n');
      var ov = document.createElement('div');
      ov.className = 'mine-dg-overlay';
      ov.innerHTML =
        '<div class="mine-dg-dialog mine-dg-wide">' +
        '  <div class="mine-dg-title">' + (good ? '💊 时间胶囊 · 修复完成' : '💊 时间胶囊 · 数据残缺') + '</div>' +
        '  <div class="mine-dg-letter"><span class="mine-dg-notepad">时间胶囊.txt</span>' + letter + '</div>' +
        (good ? '' : '<div class="mine-dg-story">数据损坏过严重，只恢复了这些。……也许下次，能把它修得更完整一些。</div>') +
        '  <div class="mine-dg-stats">记忆碎片 ◆' + run.fragments + ' / ' + FRAG_GOAL + '</div>' +
        '  <button type="button" class="mine-dg-again">再来一局</button>' +
        '</div>';
      ov.querySelector('.mine-dg-again').addEventListener('click', function () { showClassSelect(); });
      openOverlay(ov);
    }

    /* ---------------- 游戏流程 ---------------- */

    /* 下楼：冻结输入 → 三选一 → 生效 → 层数+1 →（刚过完偶数层则进商店）→ 重开棋盘 */
    function descend() {
      inputLocked = true;
      offerCards(function (card) {
        closeOverlays();
        if (card.kind === 'gear') {
          card.ref.apply(run);
        } else {
          for (var id in card.pack) run.items[id] = (run.items[id] || 0) + card.pack[id];
        }
        run.floor += 1;
        saveDeepest(run.floor);   // 抵达新层存一次纪录
        var arrived = run.floor;
        var proceed = function () {
          startFloor();
          toast(arrived === MAX_FLOOR
            ? '信号很强……胶囊就在这一层。小心，坏道会反扑。'
            : 'B' + arrived + ' · 坏道密度 ' + Math.round(floorDensity(arrived) * 100) + '%');
          inputLocked = false;
        };
        if (arrived % 2 === 1) {   // 过完 B2/4/6/8/10 抵达奇数层前，先进商店
          openShop(proceed);
        } else {
          proceed();
        }
      });
    }

    function startFloor() {
      var size = floorSize(run.floor);
      exitFound = false;
      clearTimeout(clearTimer);
      run.skillCharges = 1 + (run.gear.battery || 0);   // 技能每层重置：1 + 备用电池
      run.shieldFloor = !!run.gear.shield;              // 护甲每层开始自动充能
      board.reset({ cols: size, rows: size, mines: floorMines(run.floor) });
      // 换层后滚回左上角（手机端上一层的横向滚动位置会残留）
      containerEl.scrollLeft = 0;
      containerEl.scrollTop = 0;
      bodyEl.scrollLeft = 0;
      bodyEl.scrollTop = 0;
      refresh();
      if (typeof CORE.fitWindowToContent === 'function') {
        CORE.fitWindowToContent(win, bodyEl, rootEl, hudEl, panelEl);
      }
    }

    function newRun(clsId) {
      runToken++;   // 上一局遗留的延时回调（死亡弹层/全清下楼）凭 token 失效
      classDef = null;
      for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].id === clsId) classDef = CLASSES[i];
      if (!classDef) classDef = CLASSES[0];
      run = {
        cls: classDef.id, floor: 1,
        hp: classDef.hp, maxHp: classDef.hp,
        gold: classDef.startGold || 0, fragments: 0,
        skillCharges: 1,
        gear: {}, items: {},
        shieldFloor: false, over: false
      };
      var st = classDef.startItems || {};
      for (var k in st) run.items[k] = st[k];
      inputLocked = false;
      closeOverlays();
      faceEl.textContent = '🙂';
      appEl.win98DgRun = run;   // 供自动化验收读取对局状态（只读）
      startFloor();
      toast('B1 · 坏道密度 ' + Math.round(floorDensity(1) * 100) + '%');
    }

    /* ---------------- 引擎钩子 ---------------- */

    /* 踩雷减伤链：护甲（每层一次，整次抵挡）→ HP（Boss 层伤害 2）；
       返回 false = 存活（引擎标该格已爆💥继续），true = 致命（引擎揭全盘） */
    function onMineHit(idx, b) {
      if (run.shieldFloor) {
        run.shieldFloor = false;
        refresh();
        toast('🛡️ 护甲抵挡了这次踩雷');
        return false;
      }
      var dmg = run.floor === MAX_FLOOR ? 2 : 1;
      run.hp -= dmg;
      refresh();
      if (run.hp > 0) {
        toast(dmg > 1 ? '坏道反扑！-2 ❤️（剩 ' + run.hp + ' 点）' : '踩中坏扇区！剩 ' + run.hp + ' 点生命');
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

    /* 全清：记忆碎片 +1。常规层稍事停留自动下楼；Boss 层（B11）= 结局判定。
       注意：契约里引擎全清时已先置 board.over + 自动插旗，本层没有可下的棋了。 */
    function onAllClear(b) {
      if (run.over) return;
      run.fragments += 1;
      refresh();
      if (run.floor === MAX_FLOOR) {
        var token = runToken;
        setTimeout(function () {
          if (token === runToken && !run.over) showEnding(run.fragments >= FRAG_GOAL);
        }, 900);
        return;
      }
      toast('全清奖励 ◆碎片 +1');
      var token2 = runToken;
      clearTimer = setTimeout(function () {
        if (token2 === runToken && !run.over && !overlayOpen) descend();
      }, 900);
    }

    /* 出口显形（每层只 toast 一次）/ 宝箱拾取（金币 + 概率碎片） */
    function onCellRevealed(idx, b) {
      var cell = b.cells[idx];
      if (cell.exit && !exitFound) {
        exitFound = true;
        toast('发现出口 🕳️ 点它下到 B' + (run.floor + 1));
      }
      if (cell.chest && !cell.looted) {
        cell.looted = true;
        var base = 5 + Math.floor(Math.random() * 11);   // 5–15
        var mult = 1 + (classDef.chestBonus || 0) + 0.25 * (run.gear.gloves || 0);
        var g = Math.round(base * mult);
        run.gold += g;
        var msg = '🎁 宝箱 +' + g + ' 💰';
        if (Math.random() < 0.35) {
          run.fragments += 1;
          msg += ' ◆+1';
        }
        toast(msg);
        refresh();
      }
    }

    /* 点已翻开格：是出口 → 下楼（返回 true 跳过引擎 chord）；否则交回引擎 */
    function onRevealedClick(idx, b) {
      var cell = b.cells[idx];
      if (!cell.exit || run.over) return false;
      descend();
      return true;
    }

    /* 首击布雷完成后：埋出口（Boss 层无出口）与宝箱（各随机一个非雷格，互不相同），
       再解锁技能/消耗品按钮 */
    function onFirstClick(b) {
      var safe = [];
      for (var i = 0; i < b.cells.length; i++) {
        if (!b.cells[i].mine) safe.push(i);
      }
      if (run.floor < MAX_FLOOR && safe.length) {
        b.cells[safe.splice(Math.floor(Math.random() * safe.length), 1)[0]].exit = true;
      }
      if (safe.length) {
        b.cells[safe[Math.floor(Math.random() * safe.length)]].chest = true;
      }
      refresh();
    }

    /* paint 收尾追加装饰：出口🕳️ / 已爆💥 / 已标记📡（宝箱不开不现形） */
    function decorateCell(idx, cell, el) {
      if (cell.revealed) {
        if (cell.exploded) {
          el.textContent = '💥';
        } else if (cell.exit) {
          el.textContent = '🕳️';
          el.classList.add('mine-dg-exit');
          el.title = '出口：下到 B' + ((run ? run.floor : 1) + 1);
        }
      } else if (cell.known && !cell.flagged) {
        el.textContent = '📡';
        el.title = '已标记的坏扇区';
      }
    }

    function onPressMood(mood) {
      if (!run || run.over) return;
      faceEl.textContent = mood === 'o' ? '😮' : '🙂';
    }

    /* ---------------- 棋盘（引擎驱动；先按 B1 建底，职业选定后 startFloor 按层重置） ---------------- */
    board = CORE.createBoard({
      boardEl: boardEl,
      cols: floorSize(1),
      rows: floorSize(1),
      mines: floorMines(1),
      hooks: {
        canInteract: function () { return !!run && !run.over && !overlayOpen && !inputLocked; },
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
    updateMinesLcd();

    /* 挂载即贴合窗口：经典模式在 newGame 里 fit，地下城若等选完职业（startFloor）才 fit，
       切 Tab 到职业选择这段时间窗口仍是上一模式的尺寸，内容会被裁出滚动条 */
    if (typeof CORE.fitWindowToContent === 'function') {
      CORE.fitWindowToContent(win, bodyEl, rootEl, hudEl, panelEl);
    }

    /* ---------------- 脸按钮 = 回职业选择（放弃当前局） ---------------- */
    faceEl.addEventListener('click', function () { showClassSelect(); });

    /* 误触保护：向容器登记「有未结束进度」判断——
       未选职业（run 为 null）或 B1 未开局 = 没有可丢的进度直接放行 */
    if (ctx.setGuard) {
      ctx.setGuard(function () {
        if (!run || run.over) return false;
        return run.floor > 1 || !!(board && board.started);
      });
    }

    /* 进模式先进职业选择（覆盖层压住棋盘，选完开第一局） */
    showClassSelect();
  };
})();
