/* ============================================================
 * 扫雷·寻找时间胶囊（mine-dungeon，原「地下城」2.0）—— 经典扫雷 × 肉鸽
 *
 * 故事：硬盘深处 11 层坏道区，最底层（B11）封存着一枚 1998 年的时间胶囊——
 *       机主小时候写给未来的信。数据散成了碎片，下去把它修好。
 * 一局流程：选职业（3 选 1）→ B1–B10 找出口下楼（每层藏 1 个宝箱：随机金币、
 *       概率掉记忆碎片）→ 每次下楼三选一强化 → 每过完 2 层（B2/4/6/8/10）进商店
 *       → B11 Boss 层（无出口必须全清、踩雷伤害 2）→ 结局判定：
 *       记忆碎片 ≥ FRAG_GOAL → 修复成功（1998 年的回信 + 晒出本局拾得的老物件）；
 *       不足 → 修复失败（坏道无法修复、信件没有找到，请重新开始）。
 * 记忆碎片：每一枚都是一件 1998 年的老物件（FRAG_OBJECTS 22 件 = 理论最大获得数，
 *       一局内洗牌抽取不重复，获得时 toast 物件名）。
 * 体系：职业技能（每层 1 次主动 + 被动）、装备（永久被动，三选一/商店获得）、
 *       消耗品（数量制，装备栏点击使用；探测仪/透视均为一次性，显示数量 = 可用次数）。
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

  /* ---------------- 像素图标（pixelarticons，MIT 协议） ----------------
   * 内联 SVG（fill=currentColor 继承文字色），替代 emoji —— 跨端渲染一致、风格统一
   *（emoji 禁令见 PITFALLS.md）。加图标 = 在 PX 加一条 path d 字符串，
   * 图标库 https://github.com/halfmage/pixelarticons （取 svg/<名>.svg 的 path）。
   * heart-fill/hole/boom/face-smile/face-wow 为手绘补位（库里没有的图形），
   * 风格参照库：24×24 网格、2px 方块堆叠。 */
  var PX = {
    'tool-case': 'M2 11h20v2H2zm0 2h2v8H2zm2 8h16v2H4zm16-8h2v8h-2zM9 15h6v2H9zM4 8h2v3H4zm2-2h6v2H6zm6 2h2v3h-2zM8 4h2v2H8zm10 0h2v7h-2zm-8-2h8v2h-8z',
    'plus-box': 'M4 2h16v2H4zm0 18h16v2H4zM2 4h2v16H2zm18 0h2v16h-2zM7 11h10v2H7zM11 17V7h2v10z',
    'search': 'M22 22h-2v-2h2v2Zm-2-2h-2v-2h2v2Zm-6-2H6v-2h8v2Zm4 0h-2v-2h2v2ZM6 16H4v-2h2v2Zm10 0h-2v-2h2v2ZM4 14H2V6h2v8Zm14 0h-2V6h2v8ZM6 6H4V4h2v2Zm10 0h-2V6h2v2Zm-2-2H6V2h8v2Z',
    'signal': 'M19 3h2v18h-2zm-4 4h2v14h-2zm-4 4h2v10h-2zm-4 4h2v6H7zm-4 4h2v2H3z',
    'coins': 'M6 2h6v2H6zM4 4h2v2H4zm8 0h2v2h-2zm-8 8h2v2H4zm8 0h2v2h-2zm-6 2h6v2H6zM2 6h2v6H2zm12 0h2v6h-2zM14 8h4v2h-4zm-4 10h2v2h-2zm8-8h2v2h-2zm-6 10h2v2h-2zm6-2h2v2h-2zM12 20h6v2h-6zm-4-6h2v4H8zm12-2h2v6h-2zM7 6h4v2H7zM9 6h2v6H9zm6 8h2v4h-2zm-1-2h3v2h-3z',
    'diamond-gem': 'M7 1h10v2H7zM5 3h2v2H5zm12 0h2v2h-2zm2 2h2v2h-2zm0 8h2v2h-2zm-2 2h2v2h-2zm-2 2h2v2h-2zm-2 2h2v2h-2zm-2 2h2v2h-2zm-2-2h2v2H9zm-2-2h2v2H7zm-2-2h2v2H5zm-2-2h2v2H3zm0-8h2v2H3zM1 7h2v6H1zm20 0h2v6h-2zM3 9h18v2H3zm6-6h2v3H9zM7 6h2v3H7zm8 0h2v3h-2zm-8 5h2v2H7zm2 2h2v3H9zm2 3h2v3h-2zm2-3h2v3h-2zm2-2h2v2h-2zm-2-8h2v3h-2z',
    'eye': 'M16 20H8v-2h8v2Zm-8-2H4v-2h4v2Zm12 0h-4v-2h4v2ZM4 16H2v-2h2v2Zm10-6h-2v2h2v-2h2v4h-2v2h-4v-2H8v-4h2V8h4v2Zm8 6h-2v-2h2v2ZM2 14H0v-4h2v4Zm22 0h-2v-4h2v4ZM4 10H2V8h2v2Zm18 0h-2V8h2v2ZM8 8H4V6h4v2Zm12 0h-4V6h4v2Zm-4-2H8V4h8v2Z',
    'potion': 'M8 6h8v2H8zm0-4h8v2H8zm0 6h2v2H8zm6 0h2v2h-2zM6 20h12v2H6zm-2-8h2v8H4zm14 0h2v8h-2zM6 10h2v2H6zm10 0h2v2h-2zM6 4h2v2H6zm10 0h2v2h-2z',
    'shield': 'M4 2h16v2H4zM2 4h2v10H2zm18 0h2v10h-2zM4 14h2v2H4zm2 2h2v2H6zm4 4h4v2h-4zm10-6h-2v2h2zm-2 2h-2v2h2zm-2 2h-2v2h2zm-6 0H8v2h2z',
    'heart': 'M13 22h-2v-2h2v2Zm-2-2H9v-2h2v2Zm4 0h-2v-2h2v2Zm-6-2H7v-2h2v2Zm8 0h-2v-2h2v2ZM7 16H5v-2h2v2Zm12 0h-2v-2h2v2ZM5 14H3v-2h2v2Zm16 0h-2v-2h2v2ZM3 12H1V6h2v6Zm20 0h-2V6h2v6ZM13 8h-2V6h2v2ZM5 6H3V4h2v2Zm6 0H9V4h2v2Zm4 0h-2V4h2v2Zm6 0h-2V4h2v2ZM9 4H5V2h4v2Zm10 0h-4V2h4v2Z',
    'hand': 'M21 7h2v5h-2zm-4-2h2v7h-2zm-4-2h2v8h-2zM9 3h2v8H9zM5 5h2v8H5zm14 0h2v2h-2zm-4-2h2v2h-2zm-4-2h2v2h-2zM7 3h2v2H7zm-4 8h2v2H3zm-2 2h2v2H1zm0 2h2v2H1zm2 2h2v2H3zm2 2h2v2H5zm2 2h2v2H7zm12-2h2v2h-2zm2-7h2v7h-2zM5 13h2v2H5zm2 2h2v2H7z',
    'membercard': 'M20 19H15V23H13V21H11V23H9V19H4V17H20V19ZM4 17H2V7H4V17ZM22 17H20V7H22V17ZM14 15H6V13H14V15ZM18 11H6V9H18V11ZM20 7H4V5H20V7Z',
    'battery-full': 'M4 5h14v2H4zm0 12h14v2H4zM2 7h2v10H2zm16-2h2v14h-2zm2 4h2v6h-2zM6 9h2v6H6zm4 0h2v6H6zm4 0h2v6h-2z',
    'heart-fill': 'M5 2h4v2H5zm10 0h4v2h-4zM3 4h8v2H3zm10 0h8v2h-8zM1 6h10v2H1zm12 0h10v2H11zM1 8h22v4H1zM3 12h18v2H3zM5 14h14v2H5zM7 16h10v2H7zM9 18h6v2H9zm2 2h2v2h-2z',
    'skull': 'M7 20h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm-6-4h2v4H9zm4 0h2v4h-2zm-8-2h2v6H5zm12 0h2v6h-2zM3 14h4v2H3zM1 4h2v10H1zm20 0h2v10h-2zM3 2h18v2H3zm14 12h4v2h-4zM8 7h2v4H8zm6 0h2v4h-2z',
    'hole': 'M7 7h10v2H7zM5 9h14v2H5zM3 11h18v2H3zM5 13h14v2H5zM7 15h10v2H7z',
    'boom': 'M11 2h2v6h-2zM11 16h2v6h-2zM2 11h6v2H2zM16 11h6v2h-6zM5 5h2v2H5zm12 0h2v2h-2zM7 7h2v2H7zm8 0h2v2h-2zM9 9h6v6H9zM7 15h2v2H7zm8 0h2v2h-2zM5 17h2v2H5zm12 0h2v2h-2z',
    'face-smile': 'M8 2h8v2H8zM5 4h3v2H5zm11 0h3v2h-3zM3 6h2v2H3zm16 0h2v2h-2zM2 8h2v8H2zm18 0h2v8h-2zM3 16h2v2H3zm16 0h2v2h-2zM5 18h3v2H5zm11 0h3v2h-3zM8 20h8v2H8zM7 8h2v3H7zm8 0h2v3h-2zM6 14h2v2H6zm10 0h2v2h-2zM8 16h8v2H8z',
    'face-wow': 'M8 2h8v2H8zM5 4h3v2H5zm11 0h3v2h-3zM3 6h2v2H3zm16 0h2v2h-2zM2 8h2v8H2zm18 0h2v8h-2zM3 16h2v2H3zm16 0h2v2h-2zM5 18h3v2H5zm11 0h3v2h-3zM8 20h8v2H8zM7 8h2v3H7zm8 0h2v3h-2zM10 13h4v4h-4z'
  };
  function px(name, cls) {
    return '<svg class="px-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + PX[name] + '"/></svg>';
  }

  /* ---------------- 职业（数据驱动，加职业 = 这里加一条） ----------------
   * hp          生命上限（被动）；
   * startItems  开局自带消耗品；startGold 开局金币；chestBonus 宝箱金币加成；
   * skill       主动技能：每层 1 次（装备「备用电池」可 +1），use(api) 返回 toast 文案。
   * api = { run, board, unmarkedMines }，每次调用现取，数据表可安全放顶层。 */
  var CLASSES = [
    { id: 'tech', icon: px('tool-case'), name: '维修技师', hp: 4,
      passive: '生命上限 4',
      skill: { icon: px('plus-box'), name: '紧急修复', desc: '回复 1 点生命',
        use: function (api) {
          api.run.hp = Math.min(api.run.maxHp, api.run.hp + 1);
          return '紧急修复 +1 生命';
        } } },
    { id: 'scout', icon: px('search'), name: '探测员', hp: 3,
      passive: '开局自带 探测仪×2、透视×1',
      startItems: { radar: 2, xray: 1 },
      skill: { icon: px('signal'), name: '声呐脉冲', desc: '标记 1 颗随机雷',
        use: function (api) {
          api.board.markRandomMines(1);
          return '声呐标记了 1 颗雷';
        } } },
    { id: 'scav', icon: px('coins'), name: '拾荒者', hp: 3,
      passive: '宝箱金币 +50%，开局 +15 金',
      startGold: 15, chestBonus: 0.5,
      skill: { icon: px('diamond-gem'), name: '淘金热', desc: '随机获得 3–8 金币',
        use: function (api) {
          var g = 3 + Math.floor(Math.random() * 6);
          api.run.gold += g;
          return '淘金 +' + g + ' 金币';
        } } }
  ];

  /* ---------------- 装备（永久被动） ----------------
   * stack:false 拥有后从三选一/商店池中剔除；apply 负责 run.gear 计数与副作用。 */
  var GEAR = [
    { id: 'shield', icon: px('shield'), name: '防爆护甲', desc: '每层抵挡第 1 次踩雷', stack: false,
      apply: function (run) { run.gear.shield = 1; } },
    { id: 'vital', icon: px('heart'), name: '强心剂', desc: '生命上限 +1，并回复 1 点', stack: true,
      apply: function (run) {
        run.maxHp += 1;
        run.hp = Math.min(run.maxHp, run.hp + 1);
        run.gear.vital = (run.gear.vital || 0) + 1;
      } },
    { id: 'gloves', icon: px('hand'), name: '拾荒手套', desc: '宝箱金币 +25%', stack: true,
      apply: function (run) { run.gear.gloves = (run.gear.gloves || 0) + 1; } },
    { id: 'member', icon: px('membercard'), name: '会员卡', desc: '商店价格 -20%', stack: false,
      apply: function (run) { run.gear.member = 1; } },
    { id: 'battery', icon: px('battery-full'), name: '备用电池', desc: '职业技能每层多用 1 次', stack: true,
      apply: function (run) { run.gear.battery = (run.gear.battery || 0) + 1; } }
  ];

  /* ---------------- 消耗品（数量制，装备栏点击使用；首击布雷后才可用） ----------------
   * canUse(api) 返回 false 时禁用并提示 cantMsg；use(api) 返回 toast 文案。 */
  var ITEMS = {
    radar: { icon: px('signal'), name: '探测仪', desc: '标记 1 颗随机未标记雷', price: 8,
      canUse: function (api) { return api.unmarkedMines() > 0; },
      cantMsg: '这一层没有可标记的雷了',
      use: function (api) { api.board.markRandomMines(1); return '探测仪标记了 1 颗雷'; } },
    xray: { icon: px('eye'), name: '透视', desc: '随机翻开 3 个安全格', price: 10,
      use: function (api) { api.board.revealRandomSafe(3); return '透视翻开了 3 个安全格'; } },
    med: { icon: px('potion'), name: '急救包', desc: '回复 2 点生命', price: 12,
      canUse: function (api) { return api.run.hp < api.run.maxHp; },
      cantMsg: '生命已满',
      use: function (api) {
        api.run.hp = Math.min(api.run.maxHp, api.run.hp + 2);
        return '急救包 +2 生命';
      } }
  };
  var ITEM_IDS = ['radar', 'xray', 'med'];

  /* 三选一混池里的消耗品包（装备之外的填充位） */
  var PACKS = [
    { kind: 'pack', icon: px('signal'), name: '探测仪 ×2', desc: '消耗品：标记 1 颗随机雷', pack: { radar: 2 } },
    { kind: 'pack', icon: px('eye'), name: '透视 ×1', desc: '消耗品：翻开 3 个随机安全格', pack: { xray: 1 } },
    { kind: 'pack', icon: px('potion'), name: '急救包 ×1', desc: '消耗品：回复 2 点生命', pack: { med: 1 } }
  ];

  /* ---------------- 文案 ---------------- */
  var STORY_INTRO = '硬盘深处检测到 11 层坏道区。最底层封存着一枚 1998 年的时间胶囊——' +
    '机主小时候写给未来的信。数据散成了记忆碎片，沿途散落的每一件，都是 1998 年的老物件。' +
    '信号越来越弱，带上工具，下去把它修好吧。';

  /* ---------------- 记忆碎片 = 1998 年的老物件 ----------------
   * 每获得 1 枚碎片随机拾得其中一件（一局内洗牌抽取、不重复）；
   * 22 件 = 理论最大获得数（B1–B10 全清各 +1 共 10、每层宝箱 35% 共 11、B11 全清 +1）。 */
  var FRAG_OBJECTS = [
    '一张 3.5 英寸软盘', '一张 1998 年的电影票根', '一片夹在课本里的树叶',
    '一张小浣熊水浒卡', '一卷大大泡泡糖', '一个铁皮铅笔盒',
    '一盘手抄歌名的磁带', '一颗玻璃弹珠', '一只电子宠物蛋',
    '一张 IC 电话卡', '一张还珠格格贴纸', '一盘小霸王游戏卡带',
    '一张三好学生奖状', '一辆四驱车', '一罐手折的幸运星',
    '一页同学录', '一张大头贴', '一只发条铁皮青蛙',
    '一根演唱会荧光棒', '一张手画的贺卡', '一包跳跳糖',
    '一张《泰坦尼克号》VCD'
  ];

  /* 好结局（碎片 ≥ FRAG_GOAL）：1998 年的小孩写给未来的你 */
  var LETTER_GOOD = [
    '未来的你，还好吗？',
    '时间会让人变老，让机器变旧，但我希望，你还是当初的那个少年。',
    '我没有什么值钱的东西能留给你，只有这些记忆的碎片——放心，它们从来没有离开过。',
    '如果累了，就回来吧。重新当一个会为一张票根、一片树叶发呆半天的少年。',
    '—— 1998 年的你'
  ];

  /* 坏结局（碎片不足）：不再出示信件——坏道无法修复，信件没有找到（见 showEnding） */

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
    var PICK_TOAST_MS = 2800;  // 报老物件名的 toast 挂久一点（默认 1200ms 读不完）
    var CLEAR_DESCEND_MS = 1800; // 全清后自动下楼的延时（≥ toast 阅读时间，别让覆盖层抢戏）

    /* --- DOM：HUD(第一排) + panel(棋盘) + belt(装备栏) + toast --- */
    containerEl.innerHTML =
      '<div class="app-mine-dg">' +
      '  <div class="mine-dg-hud" data-role="hud">' +
      '    <span class="mine-dg-floor" data-role="floor">B1/' + MAX_FLOOR + '</span>' +
      '    <span class="mine-dg-hearts" data-role="hearts"></span>' +
      '    <span class="mine-dg-gold" data-role="gold">' + px('coins', 'px-gold') + ' 金币 0</span>' +
      '    <span class="mine-dg-frags" data-role="frags" title="记忆碎片：每件都是 1998 年的老物件，集满 ' + FRAG_GOAL + ' 片可修复时间胶囊">' + px('diamond-gem', 'px-frag') + ' 碎片 0</span>' +
      '    <span class="mine-dg-deepest" data-role="deepest"></span>' +
      '  </div>' +
      '  <div class="mine-panel" data-role="panel">' +
      '    <div class="mine-header sunken-panel">' +
      '      <span class="mine-lcd" data-role="mines">010</span>' +
      '      <button type="button" class="mine-face" data-role="face" aria-label="重新开始">' + px('face-smile') + '</button>' +
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
      for (var i = 0; i < run.maxHp; i++) hearts += i < run.hp ? px('heart-fill', 'px-hp') : px('heart', 'px-hp-empty');
      heartsEl.innerHTML = hearts;
      heartsEl.title = '生命 ' + run.hp + ' / ' + run.maxHp;
      goldEl.innerHTML = px('coins', 'px-gold') + ' 金币 ' + run.gold;
      goldEl.title = '金币：每过 2 层可在商店消费';
      fragsEl.innerHTML = px('diamond-gem', 'px-frag') + ' 碎片 ' + run.fragments +
        (run.fragments >= FRAG_GOAL ? ' · 已集满' : '');
      fragsEl.title = '记忆碎片：每件都是 1998 年的老物件，集满 ' + FRAG_GOAL + ' 片可修复时间胶囊（当前 ' +
        Math.min(run.fragments, FRAG_GOAL) + '/' + FRAG_GOAL + '）';
      deepestEl.textContent = '最深 B' + Math.max(loadDeepest(), run.floor);
    }

    /* 装备栏 = 职业技能按钮 + 消耗品（点击使用）+ 已拥有装备图标 */
    function updateBelt() {
      var sk = classDef.skill;
      skillBtn.innerHTML = sk.icon + ' ' + sk.name + ' ×' + run.skillCharges;
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
        b.innerHTML = it.icon + '×' + n;
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
        s.innerHTML = g.icon + (n > 1 ? '×' + n : '');
        gearEl.appendChild(s);
      });
    }

    function refresh() {
      updateMinesLcd();
      updateHud();
      updateBelt();
    }

    function toast(msg, ms) {
      toastEl.textContent = msg;
      toastEl.classList.remove('show');
      void toastEl.offsetWidth;   // 强制回流，让连续 toast 重新播放出现动画
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 1200);
    }

    /* ---------------- 消耗品 / 技能 ---------------- */

    function unmarkedMines() {
      if (!board) return 0;
      var n = 0;
      for (var i = 0; i < board.cells.length; i++) {
        var c = board.cells[i];
        // 已插旗的雷视为已发现，不再占「可标记」名额（与 core.markRandomMines 同口径）
        if (c.mine && !c.known && !c.revealed && !c.flagged) n++;
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
        (seenGood ? '<div class="mine-dg-badge">' + px('potion') + ' 时间胶囊已解封</div>' : '') +
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
        for (var i = 0; i < c.hp; i++) hearts += px('heart-fill', 'px-hp');
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
        '  <div class="mine-dg-title">深层商店</div>' +
        '  <div class="mine-dg-stats" data-role="shop-gold"></div>' +
        '  <div class="mine-dg-cards" data-role="shop-cards"></div>' +
        '  <button type="button" data-role="leave">离开商店</button>' +
        '</div>';
      var shopGoldEl = ov.querySelector('[data-role="shop-gold"]');
      var cardsEl = ov.querySelector('[data-role="shop-cards"]');

      function priceOf(p) { return Math.max(1, Math.round(p * discount)); }
      function renderShop() {
        shopGoldEl.innerHTML = '金币 ' + px('coins', 'px-gold') + ' ' + run.gold + (discount < 1 ? '（会员 -20%）' : '');
        cardsEl.innerHTML = '';
        stock.forEach(function (s) {
          var meta = s.kind === 'item' ? ITEMS[s.id] : s.ref;
          var price = priceOf(s.price);
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'mine-dg-card';
          b.innerHTML =
            '<span class="mine-dg-card-icon">' + meta.icon + '</span>' +
            '<span class="mine-dg-card-name">' + meta.name + ' · ' + px('coins', 'px-gold') + price + '</span>' +
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

    /* 结局：B11 全清后按碎片数判定。
       成功 = 「时间胶囊.txt」记事本样式的回信 + 晒出本局拾得的老物件；
       失败 = 坏道无法修复、信件没有找到（捡到几件也一并晒出，提示碎片还不够） */
    function showEnding(good) {
      run.over = true;   // 对局完结（防误触 guard 据此放行）
      if (good) storageSet(ENDING_KEY, 'good');
      var foundLine = run.fragFound.length
        ? '<div class="mine-dg-story">' + (good ? '你带回的记忆：' : '你只捡回了：') +
          run.fragFound.join('、') + (good ? '。' : '……它们还拼不出那封信。') + '</div>'
        : '';
      var ov = document.createElement('div');
      ov.className = 'mine-dg-overlay';
      ov.innerHTML =
        '<div class="mine-dg-dialog mine-dg-wide">' +
        '  <div class="mine-dg-title">' + px('potion') + (good ? ' 时间胶囊 · 修复完成' : ' 时间胶囊 · 修复失败') + '</div>' +
        (good
          ? '  <div class="mine-dg-letter"><span class="mine-dg-notepad">时间胶囊.txt</span>' + LETTER_GOOD.join('\n') + '</div>'
          : '  <div class="mine-dg-story">硬盘坏道已经无法修复，信件没有找到。请重新开始。</div>') +
        foundLine +
        '  <div class="mine-dg-stats">记忆碎片 ' + px('diamond-gem', 'px-frag') + ' ' + run.fragments +
        (good ? ' · 已集满' : ' · 还差 ' + (FRAG_GOAL - run.fragments) + ' 片') + '</div>' +
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
          if (arrived === MAX_FLOOR) {
            // B11 规则提示较长，toast 多挂一会（默认 1.2s 读不完）
            toast('信号最强的一层……这层没有出口，全清所有安全格才能挖出时间胶囊。小心，坏道会反扑（踩雷 -2）。', 4200);
          } else {
            toast('B' + arrived + ' · 坏道密度 ' + Math.round(floorDensity(arrived) * 100) + '%');
          }
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
        fragPool: FRAG_OBJECTS.slice(),   // 本局老物件池（下面洗牌，获得碎片时 pop 一件，不重复）
        fragFound: [],                    // 已拾得的老物件名（结局晒出）
        shieldFloor: false, over: false
      };
      for (var s = run.fragPool.length - 1; s > 0; s--) {   // Fisher-Yates 洗牌
        var r = Math.floor(Math.random() * (s + 1));
        var tmp = run.fragPool[s]; run.fragPool[s] = run.fragPool[r]; run.fragPool[r] = tmp;
      }
      var st = classDef.startItems || {};
      for (var k in st) run.items[k] = st[k];
      inputLocked = false;
      closeOverlays();
      faceEl.innerHTML = px('face-smile');
      appEl.win98DgRun = run;   // 供自动化验收读取对局状态（只读）
      startFloor();
      toast('B1 · 坏道密度 ' + Math.round(floorDensity(1) * 100) + '%');
    }

    /* ---------------- 引擎钩子 ---------------- */

    /* 碎片 +1：从本局物件池抽一件不重复的老物件，返回物件名（用于 toast/结局清单）。
       池子 22 件 ≥ 理论最大获得数，正常流程不会抽空；抽空兜底为无名小物件。 */
    function gainFragment() {
      var name = run.fragPool.length ? run.fragPool.pop() : '一件无名的小物件';
      run.fragFound.push(name);
      run.fragments += 1;
      return name;
    }

    /* 踩雷减伤链：护甲（每层一次，整次抵挡）→ HP（Boss 层伤害 2）；
       返回 false = 存活（引擎标该格已爆继续），true = 致命（引擎揭全盘） */
    function onMineHit(idx, b) {
      if (run.shieldFloor) {
        run.shieldFloor = false;
        refresh();
        toast('护甲抵挡了这次踩雷');
        return false;
      }
      var dmg = run.floor === MAX_FLOOR ? 2 : 1;
      run.hp -= dmg;
      refresh();
      if (run.hp > 0) {
        toast(dmg > 1 ? '坏道反扑！-2 生命（剩 ' + run.hp + ' 点）' : '踩中坏扇区！剩 ' + run.hp + ' 点生命');
        return false;
      }
      // HP 归零：致命。引擎随即揭全盘；延迟再弹结束层，让玩家先看清盘面
      run.over = true;
      faceEl.innerHTML = px('skull');
      saveDeepest(run.floor);   // 死亡时存一次纪录
      var token = runToken;
      setTimeout(function () {
        if (token === runToken && run.over) showGameOver();
      }, 700);
      return true;
    }

    /* 全清：记忆碎片 +1（= 拾得一件老物件）。常规层稍事停留自动下楼；
       Boss 层（B11）= 结局判定。注意：契约里引擎全清时已先置 board.over + 自动插旗，
       本层没有可下的棋了。 */
    function onAllClear(b) {
      if (run.over) return;
      var picked = gainFragment();
      refresh();
      if (run.floor === MAX_FLOOR) {
        var token = runToken;
        setTimeout(function () {
          if (token === runToken && !run.over) showEnding(run.fragments >= FRAG_GOAL);
        }, 900);
        return;
      }
      toast('全清奖励：捡到' + picked, PICK_TOAST_MS);
      var token2 = runToken;
      clearTimer = setTimeout(function () {
        if (token2 === runToken && !run.over && !overlayOpen) descend();
      }, CLEAR_DESCEND_MS);
    }

    /* 出口显形（每层只 toast 一次）/ 宝箱拾取（金币 + 概率碎片老物件） */
    function onCellRevealed(idx, b) {
      var cell = b.cells[idx];
      if (cell.exit && !exitFound) {
        exitFound = true;
        toast('发现出口，点它下到 B' + (run.floor + 1));
      }
      if (cell.chest && !cell.looted) {
        cell.looted = true;
        var base = 5 + Math.floor(Math.random() * 11);   // 5–15
        var mult = 1 + (classDef.chestBonus || 0) + 0.25 * (run.gear.gloves || 0);
        var g = Math.round(base * mult);
        run.gold += g;
        var msg = '宝箱 +' + g + ' 金币';
        var picked = null;
        if (Math.random() < 0.35) picked = gainFragment();
        if (picked) msg += '，还捡到' + picked;
        toast(msg, picked ? PICK_TOAST_MS : undefined);
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

    /* paint 收尾追加装饰：出口洞 / 已爆星 / 已标记雷达（宝箱不开不现形） */
    function decorateCell(idx, cell, el) {
      if (cell.revealed) {
        if (cell.exploded) {
          el.innerHTML = px('boom', 'px-boom');
        } else if (cell.exit) {
          el.innerHTML = px('hole', 'px-hole');
          el.classList.add('mine-dg-exit');
          el.title = '出口：下到 B' + ((run ? run.floor : 1) + 1);
        }
      } else if (cell.known && !cell.flagged) {
        el.innerHTML = px('signal', 'px-radar');
        el.title = '已标记的坏扇区';
      }
    }

    function onPressMood(mood) {
      if (!run || run.over) return;
      faceEl.innerHTML = mood === 'o' ? px('face-wow') : px('face-smile');
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
