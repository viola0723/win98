/* ============================================================
 * 德州扑克 · 单挑对决 —— 移植自独立版《德州扑克.html》v2.0
 * 大模块单文件（PROJECT_PLAN.md 第 6 节），在 index.html 里单独 <script> 引入。
 * 窗口化适配：
 *   - 样式在 css/style.css 中统一以 .app-poker 为作用域；
 *   - 元素查询收敛到游戏根容器 rootEl；localStorage 键沿用 pk_/pk2_ 前缀；
 *   - 快捷键仅本窗口活动时响应；定时器/彩带动画在窗口关闭后自动停止。
 * ============================================================ */
window.WIN98_APPS = window.WIN98_APPS || {};
(function () {
  'use strict';

  WIN98_APPS['poker'] = function (bodyEl, win) {
    bodyEl.classList.add('poker-body');
    bodyEl.innerHTML =
      '<div class="app-poker">' + `
<!-- ============ 顶栏 ============ -->
<header class="topbar">
  <div class="brand"><span class="suits">♠♥</span> 德州扑克 · 单挑 <small>HEADS-UP HOLD'EM v2.0</small></div>
  <div class="top-actions">
    <button class="icon-btn" id="btn-hint" title="胜率提示开关">💡</button>
    <button class="icon-btn" id="btn-sound" title="音效开关">🔊</button>
    <button class="icon-btn" id="btn-history" title="战绩统计">📊</button>
    <button class="icon-btn" id="btn-rules" title="规则说明">📖</button>
    <button class="icon-btn" id="btn-newmatch" title="开始新比赛">🔄</button>
  </div>
</header>

<!-- ============ 主区域 ============ -->
<main class="main">
  <div class="table" id="table">
    <!-- AI 座位 -->
    <div class="seat ai" id="seat-ai">
      <div class="who">
        <div class="avatar">🤖</div>
        <div class="name">电脑 <span class="role-tag" id="ai-role"></span></div>
        <div class="stack" id="ai-stack">🪙 <span id="ai-chips">1000</span></div>
      </div>
      <div class="cards" id="ai-cards"></div>
      <div class="dealer-btn" id="dealer-ai">D</div>
      <div class="bet-badge" id="ai-bet"><span class="mini-chip"></span><span id="ai-bet-amt">0</span></div>
      <div class="toast" id="ai-toast"></div>
    </div>

    <!-- 中央 -->
    <div class="center-area">
      <div class="pot-display" id="pot-display"><span class="lbl">底池</span>🪙 <span id="pot-amount">0</span></div>
      <div class="cards" id="community-cards"></div>
      <div class="phase-label" id="phase-label">— 准备开始 —</div>
    </div>

    <!-- 玩家座位 -->
    <div class="seat me" id="seat-player">
      <div class="who">
        <div class="avatar">😎</div>
        <div class="name">你 <span class="role-tag" id="player-role"></span></div>
        <div class="stack" id="player-stack">🪙 <span id="player-chips">1000</span></div>
      </div>
      <div class="cards" id="player-cards"></div>
      <div class="dealer-btn" id="dealer-player">D</div>
      <div class="bet-badge" id="player-bet"><span class="mini-chip"></span><span id="player-bet-amt">0</span></div>
      <div class="toast" id="player-toast"></div>
    </div>
  </div>

  <!-- 手牌强度 -->
  <div class="strength-bar" id="strength-bar">
    <span>🃏 当前牌型：<span class="hand-name" id="hand-name">—</span></span>
    <div class="eq-wrap" id="eq-wrap">
      <span style="font-size:11px;color:var(--txt-dim)">胜率</span>
      <div class="eq-track"><div class="eq-fill" id="eq-fill" style="width:0%"></div></div>
      <span class="eq-num" id="eq-num">—</span>
    </div>
  </div>

  <!-- 日志 -->
  <div class="log" id="log"></div>
</main>

<!-- ============ 操作栏 ============ -->
<footer class="action-bar" id="action-bar">
  <div class="raise-panel" id="raise-panel">
    <div class="raise-top">
      <input type="range" class="raise-slider" id="raise-slider" min="0" max="100" value="0">
      <div class="raise-amt" id="raise-amt">0</div>
    </div>
    <div class="quick-bets" id="quick-bets"></div>
  </div>
  <div class="btn-row" id="btn-row">
    <button class="act-btn gold" id="btn-start">开始游戏</button>
  </div>
</footer>

<!-- ============ 结算弹窗 ============ -->
<div class="overlay" id="result-overlay">
  <div class="modal">
    <h2 id="result-title"></h2>
    <div class="detail" id="result-detail"></div>
    <div class="sub" id="result-sub"></div>
    <div class="showdown-cards" id="result-cards"></div>
    <div class="btn-col">
      <button class="act-btn gold" id="result-next">下一局 ▶</button>
      <button class="act-btn ghost" id="result-close">先看看牌桌</button>
    </div>
  </div>
</div>

<!-- ============ 战绩弹窗 ============ -->
<div class="overlay" id="history-overlay">
  <div class="modal">
    <h2 style="color:var(--gold)">📊 战绩统计</h2>
    <div class="stat-grid">
      <div class="stat-cell"><div class="v" id="st-wins">0</div><div class="k">胜</div></div>
      <div class="stat-cell"><div class="v" id="st-losses">0</div><div class="k">负</div></div>
      <div class="stat-cell"><div class="v" id="st-ties">0</div><div class="k">平</div></div>
      <div class="stat-cell"><div class="v" id="st-winrate">0%</div><div class="k">胜率</div></div>
      <div class="stat-cell"><div class="v" id="st-maxpot">0</div><div class="k">最大底池</div></div>
      <div class="stat-cell"><div class="v" id="st-streak">0</div><div class="k">当前连胜</div></div>
    </div>
    <div class="history-list" id="history-list"></div>
    <div class="btn-col">
      <button class="act-btn fold" id="btn-reset-stats">清空战绩</button>
      <button class="act-btn ghost" id="history-close">关闭</button>
    </div>
  </div>
</div>

<!-- ============ 规则弹窗 ============ -->
<div class="overlay" id="rules-overlay">
  <div class="modal">
    <h2 style="color:var(--gold)">📖 玩法说明</h2>
    <div class="rules-body">
      <h3>基本规则（1v1 单挑）</h3>
      每人 1000 筹码，小盲 10 / 大盲 20。庄家（D）兼小盲，翻前先行动；翻后由大盲先行动。庄家每局轮换。一方筹码归零则比赛结束。
      <h3>牌型大小</h3>
      <div class="rank-line"><b>皇家同花顺</b><span>A-K-Q-J-10 同花</span></div>
      <div class="rank-line"><b>同花顺</b><span>五张连牌同花</span></div>
      <div class="rank-line"><b>四条</b><span>四张同点</span></div>
      <div class="rank-line"><b>葫芦</b><span>三条 + 一对</span></div>
      <div class="rank-line"><b>同花</b><span>五张同花色</span></div>
      <div class="rank-line"><b>顺子</b><span>五张连牌</span></div>
      <div class="rank-line"><b>三条</b><span>三张同点</span></div>
      <div class="rank-line"><b>两对</b><span>两对 + 单张</span></div>
      <div class="rank-line"><b>一对</b><span>一对 + 三单张</span></div>
      <div class="rank-line"><b>高牌</b><span>无以上组合</span></div>
      <h3>电脑快捷键</h3>
      <kbd>F</kbd> 弃牌　<kbd>C</kbd> 看牌/跟注　<kbd>R</kbd> 确认加注　<kbd>A</kbd> 全下　<kbd>1~4</kbd> 快捷注额
      <h3>小提示</h3>
      点击顶栏 💡 可开启实时胜率提示；电脑会学习你的弃牌/加注习惯并调整策略，别总用一个套路哦。
    </div>
    <div class="btn-col">
      <button class="act-btn gold" id="rules-close">知道了</button>
    </div>
  </div>
</div>

<canvas id="confetti-canvas"></canvas>
      ` + '</div>';
    var rootEl = bodyEl.querySelector('.app-poker');

/* ==================================================================
 * CORE-BEGIN —— 纯逻辑层（无 DOM 依赖，可被 Node 测试复用）
 * ================================================================== */
const CFG = Object.freeze({
  START_STACK: 1000,
  SB: 10,
  BB: 20,
  AI_DELAY: [650, 1300],      // AI 思考延迟区间（毫秒）
  MC_FLOP: 600, MC_TURN: 500, MC_RIVER: 500, MC_PREFLOP: 350,
  RANKS: ['2','3','4','5','6','7','8','9','10','J','Q','K','A'],
  SUITS: ['♠','♥','♦','♣'],
});
const RV = Object.freeze({'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14});
const HAND_NAMES = Object.freeze(['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺','皇家同花顺']);

const Cards = {
  isRed: c => c.suit === '♥' || c.suit === '♦',
  deck() {
    const d = [];
    for (const s of CFG.SUITS) for (const r of CFG.RANKS) d.push({ suit: s, rank: r });
    return d;
  },
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  combos(arr, k) {
    const out = [];
    (function rec(st, cb) {
      if (cb.length === k) { out.push(cb.slice()); return; }
      for (let i = st; i < arr.length; i++) { cb.push(arr[i]); rec(i + 1, cb); cb.pop(); }
    })(0, []);
    return out;
  },
};

const Eval5 = {
  /** 评估 5 张 → {rank, name, score[]} */
  eval5(cards) {
    const ranks = cards.map(c => RV[c.rank]).sort((a, b) => b - a);
    const flush = cards.every(c => c.suit === cards[0].suit);
    const cnt = {};
    for (const r of ranks) cnt[r] = (cnt[r] || 0) + 1;
    const g = Object.entries(cnt).map(([r, c]) => ({ r: +r, c }))
      .sort((a, b) => b.c - a.c || b.r - a.r);
    let straight = false, sHigh = 0;
    const u = [...new Set(ranks)].sort((a, b) => b - a);
    if (u.length === 5) {
      if (u[0] - u[4] === 4) { straight = true; sHigh = u[0]; }
      else if (u[0] === 14 && u[1] === 5) { straight = true; sHigh = 5; } // 轮子 A-5
    }
    if (flush && straight && sHigh === 14) return { rank: 9, name: HAND_NAMES[9], score: [9] };
    if (flush && straight) return { rank: 8, name: HAND_NAMES[8], score: [8, sHigh] };
    if (g[0].c === 4) return { rank: 7, name: HAND_NAMES[7], score: [7, g[0].r, g[1].r] };
    if (g[0].c === 3 && g[1].c === 2) return { rank: 6, name: HAND_NAMES[6], score: [6, g[0].r, g[1].r] };
    if (flush) return { rank: 5, name: HAND_NAMES[5], score: [5, ...ranks] };
    if (straight) return { rank: 4, name: HAND_NAMES[4], score: [4, sHigh] };
    if (g[0].c === 3) return { rank: 3, name: HAND_NAMES[3], score: [3, g[0].r, g[1].r, g[2].r] };
    if (g[0].c === 2 && g[1].c === 2)
      return { rank: 2, name: HAND_NAMES[2], score: [2, Math.max(g[0].r, g[1].r), Math.min(g[0].r, g[1].r), g[2].r] };
    if (g[0].c === 2) return { rank: 1, name: HAND_NAMES[1], score: [1, g[0].r, g[1].r, g[2].r, g[3].r] };
    return { rank: 0, name: HAND_NAMES[0], score: [0, ...ranks] };
  },
  best(cards) {
    if (!cards || cards.length < 5) return null;
    let best = null;
    for (const cb of Cards.combos(cards, 5)) {
      const r = this.eval5(cb);
      if (!best || this.cmp(r, best) > 0) best = r;
    }
    return best;
  },
  cmp(a, b) {
    const n = Math.max(a.score.length, b.score.length);
    for (let i = 0; i < n; i++) {
      const d = (a.score[i] || 0) - (b.score[i] || 0);
      if (d) return d;
    }
    return 0;
  },
};

/* ==================================================================
 * GameEngine — 规则状态机（v2.0 重写）
 * 修复：①翻后由大盲先行动 ②任一方全下即自动发完牌比牌
 *       ③标准最小加注(当前注+上次加注幅度) ④短筹码盲注按全下处理
 * ================================================================== */
class GameEngine {
  constructor() { this.matchReset(); }

  matchReset() {
    this.chips = [CFG.START_STACK, CFG.START_STACK]; // [玩家, 电脑]
    this.button = 0;   // 庄家座位号（0=玩家 1=电脑），兼小盲
    this.handNo = 0;
    this.s = null;
  }

  /** 开新一手。返回 false 表示有人破产无法开始 */
  startHand() {
    if (this.chips[0] <= 0 || this.chips[1] <= 0) return false;
    this.handNo++;
    const s = this.s = {
      deck: Cards.shuffle(Cards.deck()),
      hand: [[], []],
      board: [],
      bets: [0, 0],          // 本轮已下注
      currentBet: 0,
      lastRaise: CFG.BB,     // 上一次加注幅度（最小加注用）
      pot: 0,
      phase: 'preflop',
      actor: this.button,    // 翻前庄家(小盲)先行动
      acted: [false, false],
      inHand: true,
      pfAggressor: -1,       // 翻前最后加注者（0=玩家 1=电脑），供 c-bet 策略使用
    };
    s.hand[0] = [s.deck.pop(), s.deck.pop()];
    s.hand[1] = [s.deck.pop(), s.deck.pop()];
    // 盲注：庄家=小盲；短筹码自动全下
    this._post(this.button, Math.min(CFG.SB, this.chips[this.button]));
    this._post(1 - this.button, Math.min(CFG.BB, this.chips[1 - this.button]));
    s.currentBet = Math.max(s.bets[0], s.bets[1]);
    return true;
  }

  _post(p, amt) { this.chips[p] -= amt; this.s.bets[p] += amt; this.s.pot += amt; }

  toCall(p) { return Math.max(0, this.s.currentBet - this.s.bets[p]); }

  /** 合法动作集 */
  legal(p) {
    const s = this.s;
    const call = this.toCall(p);
    const maxTo = s.bets[p] + this.chips[p];
    const oppAllIn = this.chips[1 - p] === 0;
    let minTo = Math.min(maxTo, s.currentBet + s.lastRaise);
    if (s.currentBet === 0) minTo = Math.min(maxTo, CFG.BB); // 无人下注时最小打 1BB
    return {
      call,
      canCheck: call === 0,
      canRaise: this.chips[p] > call && !oppAllIn,
      minTo, maxTo,
    };
  }

  /** 执行动作。action: fold/check/call/raise, raiseTo=加注到的总额 */
  apply(p, action, raiseTo = 0) {
    const s = this.s;
    if (!s || !s.inHand) return null;

    if (action === 'fold') {
      s.inHand = false;
      return { type: 'fold', actor: p };
    }
    if (action === 'check') {
      if (this.toCall(p) !== 0) return null;
      s.acted[p] = true;
      return { type: 'check', actor: p };
    }
    if (action === 'call') {
      const amt = Math.min(this.chips[p], this.toCall(p));
      this._post(p, amt);
      s.acted[p] = true;
      return { type: amt === 0 ? 'check' : 'call', actor: p, amount: amt, allIn: this.chips[p] === 0 };
    }
    if (action === 'raise') {
      let target = Math.min(raiseTo, s.bets[p] + this.chips[p]);
      const amt = target - s.bets[p];
      if (amt <= 0) return null;
      const isBet = s.currentBet === 0; // 无人下注时的主动出手叫"下注"
      const raiseSize = target - s.currentBet;
      this._post(p, amt);
      if (target > s.currentBet) {
        if (raiseSize >= s.lastRaise) s.lastRaise = raiseSize; // 全下不足最小加注不改变加注幅度
        s.currentBet = target;
      }
      s.acted[p] = true;
      s.acted[1 - p] = false;
      if (s.phase === 'preflop') s.pfAggressor = p; // 记录翻前进攻者
      return { type: 'raise', actor: p, to: target, amount: amt, allIn: this.chips[p] === 0, isBet };
    }
    return null;
  }

  /** 本轮下注是否结束 */
  bettingComplete() {
    const s = this.s;
    if (!s || !s.inHand) return false;
    const settled = s.bets[0] === s.bets[1] || this.chips[0] === 0 || this.chips[1] === 0;
    return (s.acted[0] || this.chips[0] === 0) &&
           (s.acted[1] || this.chips[1] === 0) && settled;
  }

  someoneAllIn() { return this.chips[0] === 0 || this.chips[1] === 0; }

  /** 推进到下一阶段；有人全下则直接发完所有公共牌 */
  advance() {
    const s = this.s;
    const order = { preflop: 'flop', flop: 'turn', turn: 'river', river: 'showdown' };
    const next = order[s.phase];
    const runout = this.someoneAllIn();

    if (next === 'showdown') {
      s.phase = 'showdown'; s.inHand = false;
      return { type: 'showdown', runout: false };
    }
    const n = next === 'flop' ? 3 : 1;
    for (let i = 0; i < n; i++) s.board.push(s.deck.pop());

    if (runout) { // 全下后直接发完，不再下注
      while (s.board.length < 5) s.board.push(s.deck.pop());
      s.phase = 'showdown'; s.inHand = false;
      return { type: 'showdown', runout: true };
    }

    s.phase = next;
    s.bets = [0, 0]; s.currentBet = 0; s.lastRaise = CFG.BB;
    s.acted = [false, false];
    s.actor = 1 - this.button; // ★ 翻后由大盲（非庄家）先行动
    return { type: 'street', phase: next };
  }

  /** 摊牌比大小 → 0 / 1 / -1(平分) */
  showdownWinner() {
    const s = this.s;
    const e0 = Eval5.best([...s.hand[0], ...s.board]);
    const e1 = Eval5.best([...s.hand[1], ...s.board]);
    const c = Eval5.cmp(e0, e1);
    return { winner: c > 0 ? 0 : c < 0 ? 1 : -1, evals: [e0, e1] };
  }

  /** 结算底池（自动退回未被跟注的多余部分）。winner: 0/1/-1 */
  settle(winner) {
    const s = this.s;
    // 退回未匹配部分（全下筹码较少时）
    const diff = s.bets[0] - s.bets[1];
    if (diff > 0) { this.chips[0] += diff; s.pot -= diff; }
    else if (diff < 0) { this.chips[1] += -diff; s.pot += diff; }

    const payouts = [0, 0];
    if (winner === -1) {
      payouts[0] = Math.floor(s.pot / 2);
      payouts[1] = s.pot - payouts[0]; // 单数筹码给大盲位
    } else {
      payouts[winner] = s.pot;
    }
    this.chips[0] += payouts[0];
    this.chips[1] += payouts[1];
    const potWon = s.pot;
    s.pot = 0;
    this.button = 1 - this.button; // 庄家轮换
    return { payouts, pot: potWon };
  }
}

/* ==================================================================
 * AIPlayer v2.1 — 全链路 GTO 思路重构
 * 翻前: 对随机手胜率分档开局 + 底池赔率(MDF)/对范围胜率防守 + 短码推弃 + 混合频率
 * 翻后: 蒙卡胜率 + SPR 套池 + 位置 + 牌面湿度 c-bet 调频 + MDF 防守
 *       + 听牌半诈唬配比 + 河牌价值/诈唬二分 + 对手建模
 * ================================================================== */
class AIPlayer {
  constructor() { this.rng = Math.random; }

  /** Chen 公式翻前评分 */
  chen(hole) {
    const r1 = RV[hole[0].rank], r2 = RV[hole[1].rank];
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    const suited = hole[0].suit === hole[1].suit;
    let sc;
    if (r1 === r2) { sc = Math.max(5, ({ 14: 10, 13: 8, 12: 7, 11: 6 }[hi] || hi / 2) * 2); }
    else {
      sc = ({ 14: 10, 13: 8, 12: 7, 11: 6 }[hi] || hi / 2);
      if (suited) sc += 2;
      const gap = hi - lo - 1;
      sc -= [0, 0, 1, 2, 4][gap] != null ? [0, 0, 1, 2, 4][gap] : 5;
      if (gap >= 4) sc -= 0; // 已含在上式
      if (gap <= 1 && hi < 12) sc += 1;
    }
    return Math.ceil(Math.max(0, sc));
  }

  /** 蒙特卡洛胜率（0~1） */
  winProb(hole, board, trials) {
    const known = hole.concat(board);
    const rest = Cards.deck().filter(c => !known.some(k => k.suit === c.suit && k.rank === c.rank));
    const need = 5 - board.length;
    let w = 0;
    for (let t = 0; t < trials; t++) {
      const d = Cards.shuffle(rest.slice());
      const opp = [d[0], d[1]];
      const finalBoard = board.concat(d.slice(2, 2 + need));
      const me = Eval5.best(hole.concat(finalBoard));
      const op = Eval5.best(opp.concat(finalBoard));
      const c = Eval5.cmp(me, op);
      w += c > 0 ? 1 : c === 0 ? 0.5 : 0;
    }
    return w / trials;
  }

  /**
   * 对"范围"的蒙特卡洛胜率：对手手牌按 Chen≥minChen 过滤采样。
   * 用于估计"面对一个加注者"时的真实胜率，而不是对任意两张牌的胜率。
   */
  winProbVsRange(hole, board, minChen, trials) {
    const known = hole.concat(board);
    const rest = Cards.deck().filter(c => !known.some(k => k.suit === c.suit && k.rank === c.rank));
    const need = 5 - board.length;
    let w = 0, done = 0, guard = 0;
    while (done < trials && guard < trials * 30) {
      guard++;
      const d = Cards.shuffle(rest.slice());
      const opp = [d[0], d[1]];
      if (this.chen(opp) < minChen) continue; // 对手范围过滤
      done++;
      const finalBoard = board.concat(d.slice(2, 2 + need));
      const me = Eval5.best(hole.concat(finalBoard));
      const op = Eval5.best(opp.concat(finalBoard));
      const c = Eval5.cmp(me, op);
      w += c > 0 ? 1 : c === 0 ? 0.5 : 0;
    }
    return done ? w / done : 0.5;
  }

  /** 听牌识别：同花听 / 两头顺听 / 卡顺 */
  draws(hole, board) {
    const all = hole.concat(board);
    const suitCnt = {};
    for (const c of all) suitCnt[c.suit] = (suitCnt[c.suit] || 0) + 1;
    const flushDraw = Math.max(...Object.values(suitCnt)) === 4;
    const ranks = [...new Set(all.map(c => RV[c.rank]))];
    if (ranks.includes(14)) ranks.push(1); // A 可当 1
    ranks.sort((a, b) => a - b);
    let oesd = false, gutshot = false;
    for (let lo = 1; lo <= 10; lo++) {
      const inWin = ranks.filter(r => r >= lo && r <= lo + 4).length;
      if (inWin === 4) {
        const consec = ranks.some((r, i) => i + 3 < ranks.length &&
          ranks[i + 3] - r === 3 && r >= lo && ranks[i + 3] <= lo + 4);
        if (consec) oesd = true; else gutshot = true;
      }
    }
    return { flushDraw, oesd, gutshot };
  }

  /** 牌面湿润度 */
  wetBoard(board) {
    if (board.length < 3) return false;
    const suits = new Set(board.map(c => c.suit)).size;
    const rs = [...new Set(board.map(c => RV[c.rank]))].sort((a, b) => a - b);
    let conn = 0;
    for (let i = 0; i < rs.length - 1; i++) if (rs[i + 1] - rs[i] <= 2) conn++;
    return suits <= 2 || conn >= 2;
  }

  _jitter(x) { return x + (this.rng() * 2 - 1); }

  /**
   * 决策入口
   * @param view {hole, board, pot, toCall, currentBet, myBet, myChips, phase, isButton, legal, oppModel}
   */
  decide(v) {
    if (v.phase === 'preflop') return this._preflop(v);
    return this._postflop(v);
  }

  /**
   * 翻前决策 —— 借鉴 GTO 思路重构：
   * ① 开局范围按"对随机手胜率 eqR"分档（等效 GTO 起手牌表的百分位）
   * ② 面对加注用 底池赔率(MDF) + 对"加注范围"的胜率 决策，
   *    弃牌率不再随对手加注尺度失控（旧版 Chen 固定门槛：加注越大弃得越多，
   *    对手全下时连 AA 都弃，可被无脑加注/全下剥削）
   * ③ 混合频率：同一手牌按概率采取不同动作，避免被读牌
   */
  _preflop(v) {
    const L = v.legal, BB = CFG.BB, rng = this.rng;
    const eqR = this.winProb(v.hole, [], CFG.MC_PREFLOP); // 对随机手胜率
    const clamp = to => Math.max(Math.min(Math.round(to / 5) * 5, L.maxTo), Math.min(L.minTo, L.maxTo));
    const myBB = (v.myBet + v.myChips) / BB;              // 己方总筹码（大盲数）

    /* ---- A. 短筹码（≤10BB）且未被加注：推/弃（GTO 短码表思路） ---- */
    if (myBB <= 10 && v.currentBet <= BB) {
      if (eqR >= 0.46 && L.canRaise) return { action: 'raise', to: L.maxTo, tag: '短码全下' };
      if (v.toCall === 0) return { action: 'check' };
      return eqR >= 0.36 ? { action: 'call', tag: '短码补齐' } : { action: 'fold', tag: '短码弃牌' };
    }

    /* ---- B. 未被加注（只有盲注） ---- */
    if (v.currentBet <= BB) {
      if (v.isButton) {
        // 按钮位(小盲)：GTO 单挑开局极宽（~85%+），小加注为主，跛入/弃牌混合
        if (!L.canRaise) return { action: 'call', tag: '补齐' };
        if (eqR >= 0.55) return { action: 'raise', to: clamp(BB * this._jitter(2.5)), tag: '价值开局' };
        if (eqR >= 0.45) return rng() < 0.7
          ? { action: 'raise', to: clamp(BB * this._jitter(2.5)), tag: '常规开局' }
          : { action: 'call', tag: '混合跛入' };
        if (eqR >= 0.38) return rng() < 0.6
          ? { action: 'call', tag: '弱牌跛入' }
          : (rng() < 0.3 ? { action: 'raise', to: clamp(BB * 2.5), tag: '平衡加注' } : { action: 'fold', tag: '垃圾弃牌' });
        return rng() < 0.12 && L.canRaise
          ? { action: 'raise', to: clamp(BB * 2.5), tag: '诈唬偷盲' }
          : { action: 'fold', tag: '垃圾弃牌' };
      }
      // 大盲选择权（对手跛入）：多数看牌，强牌加注惩罚
      if (v.toCall === 0) {
        if (!L.canRaise) return { action: 'check' };
        if (eqR >= 0.60) return { action: 'raise', to: clamp(BB * this._jitter(3.5)), tag: '惩罚跛入' };
        if (eqR >= 0.45 && rng() < 0.12) return { action: 'raise', to: clamp(BB * 3), tag: '混合加注' };
        return { action: 'check' };
      }
      return { action: 'call', tag: '大盲补齐' };
    }

    /* ---- C. 面对加注：底池赔率 + 对范围胜率（核心修复） ---- */
    const req = v.toCall / (v.pot + v.toCall);           // 跟注所需胜率
    const mult = v.currentBet / BB;                       // 对手加注尺度（大盲倍数）
    // 估计对手加注范围：加注越大范围越紧（Chen 过滤采样）
    const minChen = mult <= 2.2 ? 3 : mult <= 3.5 ? 4 : mult <= 6 ? 5 : 6;
    const eq = this.winProbVsRange(v.hole, [], minChen, 280);
    const committed = v.myChips <= (v.pot + v.toCall) * 0.45;

    // 面对全下 / 无法再加注 / 已深度套池：纯赔率决策 —— AA/KK 面对全下永不弃牌
    if (v.toCall >= v.myChips || !L.canRaise || committed) {
      if (eq >= req) {
        return L.canRaise && v.myChips > v.toCall
          ? { action: 'raise', to: L.maxTo, tag: '赔率全下' }
          : { action: 'call', tag: '赔率跟注' };
      }
      return { action: 'fold', tag: '赔率不足弃牌' };
    }
    // 顶端范围（~7-10%）：价值 3-bet，约 3 倍对方加注
    if (eq >= 0.62) return { action: 'raise', to: clamp(v.currentBet * this._jitter(3)), tag: '价值3-bet' };
    // MDF 防守：胜率 ≥ 所需赔率即跟注 —— 小注宽防、大注紧防，自动合理
    if (eq >= req + 0.03) return { action: 'call', tag: '赔率防守' };
    // 已投入盲注、价格极便宜时再宽一档
    if (eq >= req && v.toCall <= BB * 1.5) return { action: 'call', tag: '便宜防守' };
    // 低频诈唬 3-bet（有潜力的牌），保持进攻频率不可读
    if (eqR >= 0.45 && rng() < 0.07 && v.myChips > v.toCall * 4)
      return { action: 'raise', to: clamp(v.currentBet * 3), tag: '诈唬3-bet' };
    return { action: 'fold', tag: '范围劣势弃牌' };
  }

  /**
   * 翻后决策 —— GTO 求解器思路简化版：
   * ① 位置意识：按钮位翻后最后行动，更多试探性下注与缠打
   * ② SPR（筹码底池比）：低 SPR 放宽打光标准（短码不 fold 顶对），高 SPR 收紧
   * ③ 持续下注(c-bet)按牌面湿度调频：干牌面高频小注、湿牌面精选大注
   * ④ 防守按 MDF（最低防守频率）：直赔率+隐含赔率，不被小注随便剥削
   * ⑤ 价值:诈唬 ~2:1 配比：听牌半诈唬加注混入价值加注范围
   * ⑥ 河牌独立处理：无出路，纯价值/诈唬二分，破产听牌是最佳诈唬候选
   */
  _postflop(v) {
    const L = v.legal, BB = CFG.BB, rng = this.rng;
    const board = v.board;
    const trials = board.length === 3 ? CFG.MC_FLOP : board.length === 4 ? CFG.MC_TURN : CFG.MC_RIVER;
    const eq = this.winProb(v.hole, board, trials); // 蒙卡已含听牌出路价值
    const { flushDraw, oesd, gutshot } = this.draws(v.hole, board);
    const wet = this.wetBoard(board);
    const river = board.length === 5;
    const inPos = v.isButton;               // 翻后按钮位最后行动 = 有位置
    const pot = Math.max(v.pot, BB);
    const spr = v.myChips / pot;            // 有效筹码底池比
    const strongDraw = !river && (flushDraw || oesd);
    const betTo = frac => { // 按底池比例换算"加注到"总额
      const size = Math.max(BB, Math.round(pot * frac / 5) * 5);
      return Math.max(Math.min(v.myBet + size, L.maxTo), Math.min(L.minTo, L.maxTo));
    };

    // 对手建模：玩家弃牌率高 → 多诈唬；很少弃牌 → 少诈唬多价值；爱加注 → 跟注更紧
    const m = v.oppModel || { foldRate: 0.35, raiseRate: 0.25, hands: 10 };
    const bluffMult = m.hands < 8 ? 1 : (m.foldRate > 0.5 ? 1.5 : m.foldRate < 0.18 ? 0.4 : 1);
    const callMargin = m.hands < 8 ? 0.03 : (m.raiseRate > 0.4 ? 0.06 : 0.03);

    const committed = spr <= 1.5;           // 低 SPR 套池

    /* ============ A. 无人下注：主动出击 ============ */
    if (v.toCall === 0) {
      if (!L.canRaise) return { action: 'check' };

      // —— 河牌：价值/诈唬二分 ——
      if (river) {
        if (eq >= 0.68) return { action: 'raise', to: betTo(this._jitter(0.66)), tag: '河牌价值' };
        if (eq >= 0.55 && rng() < 0.5) return { action: 'raise', to: betTo(0.5), tag: '河牌薄价值' };
        // 无摊牌价值（破产听牌/空气）按频率诈唬，使对手抓诈无利可图
        if (eq < 0.32 && rng() < 0.28 * bluffMult)
          return { action: 'raise', to: betTo(this._jitter(0.66)), tag: '河牌诈唬' };
        return { action: 'check' };
      }

      // —— 翻/转牌 ——
      if (committed && eq >= 0.5) return { action: 'raise', to: L.maxTo, tag: '低SPR打光' };

      if (v.isPfAggressor) {
        // 持续下注：干牌面高频小注，湿牌面精选大注
        const size = wet ? this._jitter(0.66) : this._jitter(0.4);
        if (eq >= 0.62) return { action: 'raise', to: betTo(size), tag: '价值c-bet' };
        if (strongDraw && rng() < 0.65) return { action: 'raise', to: betTo(size), tag: '听牌c-bet' };
        const airFreq = (wet ? 0.35 : 0.65) * bluffMult * (eq >= 0.4 ? 1 : 0.7);
        if (rng() < airFreq) return { action: 'raise', to: betTo(size), tag: '空气c-bet' };
        return { action: 'check' };
      }

      // 非进攻者：对手示弱（无人下注）→ 按位置试探
      if (eq >= 0.65) return { action: 'raise', to: betTo(this._jitter(0.66)), tag: '价值下注' };
      if (strongDraw && rng() < 0.5) return { action: 'raise', to: betTo(0.55), tag: '听牌半诈唬' };
      const stab = (inPos ? 0.45 : 0.22) * bluffMult;
      if (rng() < stab) return { action: 'raise', to: betTo(0.5), tag: '试探下注' };
      return { action: 'check' };
    }

    /* ============ B. 面对下注 ============ */
    const odds = v.toCall / (v.pot + v.toCall);   // 直赔率所需胜率
    const betRatio = v.toCall / pot;              // 对手下注相对底池尺度
    const facingAllIn = v.toCall >= v.myChips || !L.canRaise;

    // 坚果级：价值加注；低 SPR 直接全下
    if (eq >= 0.78) {
      if (L.canRaise)
        return { action: 'raise', to: (committed || spr <= 2) ? L.maxTo : betTo(1.2), tag: '强牌加注' };
      return { action: 'call', tag: '强牌跟注' };
    }
    // 面对全下/无法加注：纯赔率决策（蒙卡胜率已含听牌出路）
    if (facingAllIn)
      return eq >= odds ? { action: 'call', tag: '赔率跟注' } : { action: 'fold', tag: '赔率不足弃牌' };

    // 中强牌：跟注为主；低 SPR 混合打光
    if (eq >= 0.60) {
      if (spr <= 2.5 && rng() < 0.45) return { action: 'raise', to: L.maxTo, tag: '低SPR加注' };
      return { action: 'call', tag: '中强跟注' };
    }
    // MDF 防守：直赔率够就跟，不被小注剥削
    if (eq >= odds + callMargin) return { action: 'call', tag: 'MDF跟注' };
    // 强听牌：隐含赔率跟注 + 半诈唬加注混合（与价值加注约 1:2）
    if (strongDraw) {
      if (rng() < 0.25 && v.myChips > v.toCall * 3)
        return { action: 'raise', to: betTo(1.1), tag: '半诈唬加注' };
      if (odds < 0.36) return { action: 'call', tag: '听牌跟注' };
    }
    if (gutshot && !river && odds < 0.20 && rng() < 0.6) return { action: 'call', tag: '卡顺跟注' };
    // 河牌抓诈：下注越小防守越宽（MDF），中等牌力按频率抓
    if (river && eq >= 0.38 && betRatio <= 0.6 && rng() < 0.55) return { action: 'call', tag: '河牌抓诈' };
    // 极便宜小注不轻言弃牌
    if (eq >= 0.40 && v.toCall <= BB * 1.5) return { action: 'call', tag: '小注纠缠' };
    // 低频诈唬加注（仅翻/转、有出路时）
    if (!river && (strongDraw || gutshot) && rng() < 0.05 * bluffMult && v.myChips > v.toCall * 4)
      return { action: 'raise', to: betTo(1), tag: '诈唬加注' };
    return { action: 'fold', tag: '弃牌' };
  }
}
/* CORE-END */
/* ==================================================================
 * 表现层 —— 音效 / 彩带 / UI / 控制器
 * ================================================================== */
const $ = id => rootEl.querySelector('#' + id);

/* ---------- WebAudio 音效合成（无外部资源） ---------- */
const FX = {
  ctx: null, on: localStorage.getItem('pk_sound') !== '0',
  ensure() {
    if (!this.on) return false;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch (e) { return false; }
  },
  tone(f, t = 0.08, type = 'sine', vol = 0.12, delay = 0) {
    if (!this.ensure()) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    const t0 = c.currentTime + delay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + t + 0.02);
  },
  click() { this.tone(900, 0.05, 'square', 0.05); },
  deal() { this.tone(520, 0.06, 'triangle', 0.1); this.tone(760, 0.05, 'triangle', 0.08, 0.04); },
  chip() { this.tone(2200, 0.04, 'square', 0.05); this.tone(1600, 0.05, 'square', 0.05, 0.03); },
  fold() { this.tone(180, 0.18, 'sawtooth', 0.07); },
  check() { this.tone(600, 0.06, 'sine', 0.08); },
  allin() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.12, i * 0.07)); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.14, i * 0.1)); },
  lose() { [400, 340, 280].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.1, i * 0.12)); },
};

/* ---------- 彩带 ---------- */
const Confetti = {
  canvas: null, ctx: null, parts: [], raf: null,
  init() { this.canvas = $('confetti-canvas'); this.ctx = this.canvas.getContext('2d'); },
  fire(n = 90) {
    const c = this.canvas;
    c.width = rootEl.clientWidth; c.height = rootEl.clientHeight;
    const colors = ['#e9c46a', '#7bed7b', '#3f8ef7', '#ff6b6b', '#ffffff', '#f4a261'];
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: rootEl.clientWidth / 2 + (Math.random() - 0.5) * 220,
        y: rootEl.clientHeight * 0.35,
        vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3,
        w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, life: 130 + Math.random() * 60,
      });
    }
    if (!this.raf) this._tick();
  },
  _tick() {
    if (!rootEl.isConnected) { this.raf = null; return; }   // 窗口已关闭，彩带循环自停
    this.raf = requestAnimationFrame(() => this._tick());
    const g = this.ctx;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.parts = this.parts.filter(p => p.life > 0 && p.y < rootEl.clientHeight + 30);
    if (!this.parts.length) { cancelAnimationFrame(this.raf); this.raf = null; return; }
    for (const p of this.parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.vx *= 0.99; p.rot += p.vr; p.life--;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.globalAlpha = Math.min(1, p.life / 40);
      g.fillStyle = p.color; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
  },
};

/* ---------- 战绩 & 对手建模 ---------- */
const Stats = {
  KEY: 'pk2_stats', BEH: 'pk2_behavior', HIST: 'pk2_history',
  data: { wins: 0, losses: 0, ties: 0, maxPot: 0, streak: 0 },
  beh: { folds: 0, calls: 0, raises: 0 },
  history: [],
  load() {
    try {
      const d = localStorage.getItem(this.KEY); if (d) Object.assign(this.data, JSON.parse(d));
      const b = localStorage.getItem(this.BEH); if (b) Object.assign(this.beh, JSON.parse(b));
      const h = localStorage.getItem(this.HIST); if (h) this.history = JSON.parse(h);
    } catch (e) {}
  },
  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
      localStorage.setItem(this.BEH, JSON.stringify(this.beh));
      localStorage.setItem(this.HIST, JSON.stringify(this.history));
    } catch (e) {}
  },
  recordHand(winner, pot, snap) {
    if (winner === 0) { this.data.wins++; this.data.streak = Math.max(1, this.data.streak + 1); }
    else if (winner === 1) { this.data.losses++; this.data.streak = Math.min(-1, this.data.streak - 1); }
    else { this.data.ties++; this.data.streak = 0; }
    this.data.maxPot = Math.max(this.data.maxPot, pot);
    this.history.unshift({
      t: new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      winner, pot, ...snap,
    });
    if (this.history.length > 20) this.history.length = 20;
    this.save();
  },
  recordAction(a) {
    if (a === 'fold') this.beh.folds++;
    else if (a === 'raise') this.beh.raises++;
    else this.beh.calls++;
    this.save();
  },
  opponentModel() {
    const t = this.beh.folds + this.beh.calls + this.beh.raises;
    return {
      hands: t,
      foldRate: t ? this.beh.folds / t : 0.35,
      raiseRate: t ? this.beh.raises / t : 0.25,
    };
  },
  reset() {
    this.data = { wins: 0, losses: 0, ties: 0, maxPot: 0, streak: 0 };
    this.beh = { folds: 0, calls: 0, raises: 0 };
    this.history = [];
    this.save();
  },
};

/* ---------- UI 渲染 ---------- */
const UI = {
  cardEl(card, opts = {}) {
    const d = document.createElement('div');
    if (opts.slot) { d.className = 'card slot'; return d; }
    if (opts.hidden) { d.className = 'card back'; return d; }
    d.className = 'card' + (Cards.isRed(card) ? ' red' : '');
    d.innerHTML = `<div class="c-top"><b>${card.rank}</b><span>${card.suit}</span></div><div class="c-pip">${card.suit}</div>`;
    return d;
  },

  render(engine, opts = {}) {
    const s = engine.s;
    // 文本
    $('player-chips').textContent = engine.chips[0];
    $('ai-chips').textContent = engine.chips[1];
    $('player-stack').classList.toggle('low', engine.chips[0] <= 200);
    $('ai-stack').classList.toggle('low', engine.chips[1] <= 200);
    $('pot-amount').textContent = s ? s.pot : 0;

    const phaseNames = { preflop: '翻前', flop: '翻牌圈', turn: '转牌圈', river: '河牌圈', showdown: '摊牌' };
    $('phase-label').innerHTML = s && s.inHand
      ? `第 <b>${engine.handNo}</b> 局 · ${phaseNames[s.phase] || s.phase}`
      : (engine.handNo ? `第 ${engine.handNo} 局结束` : '— 准备开始 —');

    // 角色徽章 & 庄家按钮
    if (s || engine.handNo) {
      $('player-role').textContent = engine.button === 0 ? '小盲' : '大盲';
      $('ai-role').textContent = engine.button === 0 ? '大盲' : '小盲';
      $('player-role').className = 'role-tag blind';
      $('ai-role').className = 'role-tag blind';
      $('dealer-player').classList.toggle('show', engine.button === 0);
      $('dealer-ai').classList.toggle('show', engine.button === 1);
    }

    // 轮次/下注徽章（手牌进行中才显示）
    const live = s && s.inHand;
    this._betBadge(0, live ? s.bets[0] : 0);
    this._betBadge(1, live ? s.bets[1] : 0);
    $('seat-player').classList.toggle('turn', live && s.actor === 0);
    $('seat-ai').classList.toggle('turn', live && s.actor === 1);

    // 卡牌
    this._cards(engine, opts);
    // 手牌强度
    this._strength(engine);
  },

  _betBadge(p, amt) {
    const el = $(p === 0 ? 'player-bet' : 'ai-bet');
    el.classList.toggle('show', amt > 0);
    $(p === 0 ? 'player-bet-amt' : 'ai-bet-amt').textContent = amt;
  },

  _cards(engine, opts) {
    const s = engine.s;
    const showAI = opts.showAI != null ? opts.showAI : (s && !s.inHand && s.phase === 'showdown');

    // 玩家手牌（只在变化或要求动画时重建）
    this._renderInto($('player-cards'), s ? s.hand[0] : [], { anim: opts.dealAnim });
    this._renderInto($('ai-cards'), s ? s.hand[1] : [], { hidden: !showAI, anim: opts.dealAnim && !showAI, flip: opts.revealAI });

    // 公共牌
    const board = s ? s.board : [];
    const cEl = $('community-cards');
    cEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      if (i < board.length) {
        const c = this.cardEl(board[i]);
        if (opts.newBoardIdx != null && i >= opts.newBoardIdx) {
          c.classList.add('flip');
          c.style.animationDelay = ((i - opts.newBoardIdx) * 0.12) + 's';
        }
        cEl.appendChild(c);
      } else cEl.appendChild(this.cardEl(null, { slot: true }));
    }
  },

  _renderInto(el, cards, opts = {}) {
    el.innerHTML = '';
    cards.forEach((c, i) => {
      const d = this.cardEl(c, { hidden: opts.hidden });
      if (opts.anim) { d.classList.add('deal'); d.style.animationDelay = (i * 0.14) + 's'; }
      if (opts.flip) { d.classList.add('flip'); d.style.animationDelay = (i * 0.15) + 's'; }
      el.appendChild(d);
    });
  },

  _strength(engine) {
    const s = engine.s;
    let name = '—';
    if (s && s.hand[0].length) {
      if (s.board.length >= 3) {
        const b = Eval5.best([...s.hand[0], ...s.board]);
        name = b ? b.name : '—';
      } else {
        const [a, b] = s.hand[0];
        const r1 = RV[a.rank], r2 = RV[b.rank];
        if (r1 === r2) name = a.rank + ' 对子';
        else {
          const hi = Math.max(r1, r2);
          name = (hi >= 11 ? { 14: 'A', 13: 'K', 12: 'Q', 11: 'J' }[hi] : hi) + ' 高牌' + (a.suit === b.suit ? ' · 同花潜质' : '');
        }
      }
    }
    $('hand-name').textContent = name;
  },

  toast(p, text, cls = '') {
    const el = $(p === 0 ? 'player-toast' : 'ai-toast');
    el.textContent = text;
    el.className = 'toast show ' + cls;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1700);
  },

  potBump() {
    const el = $('pot-display');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  },

  log(msg, cls = '') {
    const e = document.createElement('div');
    if (cls) e.className = cls;
    e.textContent = msg;
    $('log').appendChild(e);
    $('log').scrollTop = $('log').scrollHeight;
  },

  clearWinnerGlow() {
    $('seat-player').classList.remove('winner');
    $('seat-ai').classList.remove('winner');
  },
};

/* ---------- 胜率提示（异步计算，避免卡顿） ---------- */
const Equity = {
  hintOn: localStorage.getItem('pk_hint') === '1',
  timer: null,
  update(engine) {
    $('eq-wrap').classList.toggle('show', this.hintOn);
    if (!this.hintOn) return;
    const s = engine.s;
    if (!s || !s.hand[0].length || s.phase === 'showdown') { $('eq-num').textContent = '—'; $('eq-fill').style.width = '0%'; return; }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!rootEl.isConnected) return;   // 窗口已关闭
      const trials = s.board.length === 0 ? CFG.MC_PREFLOP : s.board.length === 3 ? 400 : 300;
      const ai = new AIPlayer();
      const eq = ai.winProb(s.hand[0], s.board, trials);
      const pct = Math.round(eq * 100);
      $('eq-num').textContent = pct + '%';
      $('eq-fill').style.width = pct + '%';
    }, 60);
  },
};

/* ---------- 主控制器 ---------- */
const Game = {
  engine: new GameEngine(),
  ai: new AIPlayer(),
  busy: false,          // 动画/AI 行动中，锁定输入
  _timers: [],

  _later(fn, ms) { const t = setTimeout(() => { if (rootEl.isConnected) fn(); }, ms); this._timers.push(t); return t; },   // 窗口关闭后不再触发
  _clearTimers() { this._timers.forEach(clearTimeout); this._timers = []; },

  /* ===== 开始一手 ===== */
  startHand() {
    this._clearTimers();
    UI.clearWinnerGlow();
    $('result-overlay').classList.remove('show');

    if (this.engine.chips[0] <= 0 || this.engine.chips[1] <= 0) {
      // loser: 0=玩家破产 1=电脑破产（勿再写反！）
      this._gameOver(this.engine.chips[0] <= 0 ? 0 : 1);
      return;
    }
    if (!this.engine.startHand()) return;

    FX.deal();
    const btnIsPlayer = this.engine.button === 0;
    UI.log(`—— 第 ${this.engine.handNo} 局 —— ${btnIsPlayer ? '你坐庄（小盲），翻前你先行动' : '电脑坐庄（小盲），翻前电脑先行动'}`, 'l-sys');
    UI.render(this.engine, { dealAnim: true });
    Equity.update(this.engine);
    this._next();
  },

  /* ===== 轮到某方行动 ===== */
  _next() {
    const e = this.engine, s = e.s;
    if (!s || !s.inHand) return;
    UI.render(e);
    Equity.update(e);
    if (s.actor === 0) {
      this.busy = false;
      this._showActions();
    } else {
      this.busy = true;
      this._showThinking();
      const delay = CFG.AI_DELAY[0] + Math.random() * (CFG.AI_DELAY[1] - CFG.AI_DELAY[0]);
      this._later(() => this._aiMove(), delay);
    }
  },

  _aiView() {
    const e = this.engine, s = e.s;
    const legal = e.legal(1);
    return {
      hole: s.hand[1], board: s.board, pot: s.pot,
      toCall: legal.call, currentBet: s.currentBet,
      myBet: s.bets[1], myChips: e.chips[1],
      phase: s.phase, isButton: e.button === 1, legal,
      isPfAggressor: s.pfAggressor === 1,
      oppModel: Stats.opponentModel(),
    };
  },

  _aiMove() {
    const e = this.engine, s = e.s;
    if (!s || !s.inHand || s.actor !== 1) return;
    const d = this.ai.decide(this._aiView());
    let res = null;
    if (d.action === 'raise') {
      const to = Math.max(d.to || 0, Math.min(e.legal(1).minTo, e.legal(1).maxTo));
      res = e.apply(1, 'raise', to);
    } else if (d.action) {
      res = e.apply(1, d.action);
    }
    // 兜底链：加注失败→跟注；非法看牌→跟注/看牌；最后保证 fold 永远合法
    if (!res) res = e.apply(1, e.toCall(1) > 0 ? 'call' : 'check');
    if (!res) res = e.apply(1, 'fold');
    this._afterAction(res, 1, d.tag);
  },

  /* ===== 玩家行动（按钮/快捷键入口） ===== */
  playerAction(action, raiseTo = 0) {
    if (this.busy) return;
    const e = this.engine, s = e.s;
    if (!s || !s.inHand || s.actor !== 0) return;
    this.busy = true;
    Stats.recordAction(action);
    let res;
    if (action === 'raise') res = e.apply(0, 'raise', raiseTo);
    else res = e.apply(0, action);
    if (!res) { this.busy = false; return; }
    this._afterAction(res, 0);
  },

  /* ===== 行动后统一处理 ===== */
  _afterAction(res, actor, aiTag) {
    const who = actor === 0 ? '你' : '电脑';
    const e = this.engine;

    switch (res.type) {
      case 'fold':
        FX.fold();
        UI.toast(actor, '弃牌', 'fold');
        UI.log(`${who}弃牌`, 'l-fold');
        this._later(() => this._endHand(1 - actor, true), 700);
        return;
      case 'check':
        FX.check();
        UI.toast(actor, '看牌');
        UI.log(`${who}看牌`);
        break;
      case 'call':
        FX.chip(); UI.potBump();
        UI.toast(actor, res.allIn ? `全下跟注 ${res.amount}` : `跟注 ${res.amount}`, res.allIn ? 'allin' : '');
        UI.log(`${who}跟注 ${res.amount}${res.allIn ? '（全下）' : ''}`);
        break;
      case 'raise': {
        const word = res.isBet ? '下注' : '加注到';
        if (res.allIn) { FX.allin(); UI.toast(actor, `ALL-IN ${res.to}`, 'allin'); UI.log(`${who}全下到 ${res.to}！`, 'l-gold'); }
        else {
          FX.chip(); UI.potBump();
          UI.toast(actor, `${word} ${res.to}`, 'raise');
          UI.log(`${who}${word} ${res.to}`);
        }
        break;
      }
    }
    if (aiTag) { /* AI 内部标签不展示给玩家（保持神秘） */ }

    UI.render(e);
    Equity.update(e);

    if (e.bettingComplete()) {
      this._later(() => this._advance(), 650);
    } else {
      e.s.actor = 1 - actor;
      this._later(() => this._next(), 650);
    }
  },

  /* ===== 推进阶段 ===== */
  _advance() {
    const e = this.engine;
    const prevBoard = e.s.board.length;
    const r = e.advance();
    if (r.type === 'showdown') {
      if (r.runout) {
        FX.deal();
        UI.log('全下！发完剩余公共牌…', 'l-gold');
        UI.render(e, { newBoardIdx: prevBoard, showAI: false });
        this._later(() => this._showdown(), 1200);
      } else {
        this._showdown();
      }
      return;
    }
    FX.deal();
    const names = { flop: '翻牌', turn: '转牌', river: '河牌' };
    const newCards = e.s.board.slice(prevBoard).map(c => c.rank + c.suit).join(' ');
    UI.log(`▼ ${names[r.phase]}：${newCards}`, 'l-sys');
    UI.render(e, { newBoardIdx: prevBoard });
    Equity.update(e);
    this._later(() => this._next(), 800);
  },

  /* ===== 摊牌 ===== */
  _showdown() {
    const e = this.engine;
    FX.deal();
    UI.render(e, { showAI: true, revealAI: true });
    const { winner, evals } = e.showdownWinner();
    UI.log(`你：${evals[0].name} ｜ 电脑：${evals[1].name}`);
    this._later(() => this._endHand(winner, false, evals), 900);
  },

  /* ===== 结束一手 ===== */
  _endHand(winner, isFold, evals = null) {
    const e = this.engine, s = e.s;
    const st = e.settle(winner);
    UI.clearWinnerGlow();

    // 结果弹窗
    const title = $('result-title'), detail = $('result-detail'), sub = $('result-sub');
    if (winner === 0) {
      title.textContent = '🎉 你赢了！'; title.className = 'win';
      FX.win(); Confetti.fire(st.pot >= 400 ? 140 : 80);
      $('seat-player').classList.add('winner');
      detail.textContent = `赢得底池 ${st.pot} 🪙`;
    } else if (winner === 1) {
      title.textContent = '😔 这局输了'; title.className = 'lose';
      FX.lose();
      $('seat-ai').classList.add('winner');
      detail.textContent = `电脑赢得底池 ${st.pot}`;
    } else {
      title.textContent = '🤝 平分秋色'; title.className = 'tie';
      FX.check();
      detail.textContent = `底池 ${st.pot} 平分`;
    }
    sub.textContent = isFold ? '对手弃牌，无需比牌' : '';
    UI.log(winner === 0 ? `🎉 你赢得 ${st.pot}` : winner === 1 ? `电脑赢得 ${st.pot}` : '🤝 平局', 'l-win');

    // 弹窗内展示双方手牌
    const rc = $('result-cards');
    rc.innerHTML = '';
    if (!isFold && evals) {
      rc.appendChild(this._miniRow('你', s.hand[0], evals[0].name));
      rc.appendChild(this._miniRow('电脑', s.hand[1], evals[1].name));
    }

    // 记录
    Stats.recordHand(winner, st.pot, {
      ph: s.hand[0].map(c => c.rank + c.suit).join(' '),
      ah: s.hand[1].map(c => c.rank + c.suit).join(' '),
      bd: s.board.map(c => c.rank + c.suit).join(' '),
    });

    UI.render(e);
    Equity.update(e);

    // 破产检查
    this._later(() => {
      if (e.chips[0] <= 0 || e.chips[1] <= 0) {
        // loser: 0=玩家破产 1=电脑破产（勿再写反！）
        this._gameOver(e.chips[0] <= 0 ? 0 : 1);
      } else {
        $('result-overlay').classList.add('show');
        $('result-next').textContent = '下一局 ▶';
      }
      this._renderIdleButtons();
    }, 1000);
  },

  _miniRow(label, cards, handName) {
    const row = document.createElement('div');
    row.className = 'sc-row';
    row.innerHTML = `<span class="who-lbl">${label}</span><span>` +
      cards.map(c => `<span class="mini-card ${Cards.isRed(c) ? 'red' : ''}">${c.rank}<br>${c.suit}</span>`).join('') +
      `</span><span class="hand-tag">${handName}</span>`;
    return row;
  },

  _gameOver(loser) {
    const youWin = loser === 1;
    $('result-title').textContent = youWin ? '🏆 电脑破产，你赢下整场！' : '💀 你破产了…';
    $('result-title').className = youWin ? 'win' : 'lose';
    $('result-detail').textContent = youWin ? '漂亮的胜利！点击按钮开启新一场比赛。' : '别灰心，点击按钮重新挑战。';
    $('result-sub').textContent = '';
    $('result-cards').innerHTML = '';
    $('result-next').textContent = '🔄 开始新比赛';
    $('result-overlay').classList.add('show');
    if (youWin) { FX.win(); Confetti.fire(160); } else FX.lose();
    this._renderIdleButtons();
  },

  newMatch() {
    this._clearTimers();
    this.engine.matchReset();
    UI.clearWinnerGlow();
    $('result-overlay').classList.remove('show');
    UI.log('🔄 新比赛开始，双方各 1000 筹码', 'l-sys');
    UI.render(this.engine);
    Equity.update(this.engine);
    this._renderIdleButtons();
  },

  /* ===== 操作按钮区 ===== */
  _btnRow() { return $('btn-row'); },

  _showThinking() {
    $('raise-panel').classList.remove('show');
    this._btnRow().innerHTML = `<div class="thinking">🤖 电脑思考中<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;
  },

  _renderIdleButtons() {
    const e = this.engine;
    $('raise-panel').classList.remove('show');
    const row = this._btnRow();
    const broke = e.chips[0] <= 0 || e.chips[1] <= 0;
    row.innerHTML = broke
      ? `<button class="act-btn gold" id="btn-restart">🔄 开始新比赛</button>`
      : `<button class="act-btn gold" id="btn-start">开始游戏</button>`;
    $(broke ? 'btn-restart' : 'btn-start').onclick = () => {
      FX.click();
      if (broke) { this.newMatch(); this._later(() => this.startHand(), 200); }
      else this.startHand();
    };
  },

  _showActions() {
    const e = this.engine, s = e.s;
    const L = e.legal(0);
    const row = this._btnRow();
    row.innerHTML = '';

    // 弃牌
    const bFold = document.createElement('button');
    bFold.className = 'act-btn fold';
    bFold.innerHTML = `弃牌<span class="kbd-hint">F</span>`;
    bFold.onclick = () => this.playerAction('fold');
    row.appendChild(bFold);

    // 看牌 / 跟注
    const bCall = document.createElement('button');
    bCall.className = 'act-btn check';
    if (L.canCheck) {
      bCall.innerHTML = `看牌<span class="kbd-hint">C</span>`;
      bCall.onclick = () => this.playerAction('check');
    } else {
      const pay = Math.min(L.call, e.chips[0]);
      const isAllInCall = pay >= e.chips[0];
      bCall.innerHTML = isAllInCall
        ? `全下跟注<small>${pay}</small>`
        : `跟注<small>${pay}</small>`;
      bCall.onclick = () => this.playerAction('call');
    }
    row.appendChild(bCall);

    // 加注（展开滑杆）
    if (L.canRaise) {
      const bRaise = document.createElement('button');
      bRaise.className = 'act-btn raise';
      bRaise.innerHTML = `加注<span class="kbd-hint">R</span>`;
      bRaise.onclick = () => this._confirmRaise();
      row.appendChild(bRaise);
      this._setupRaisePanel(L, e);
      $('raise-panel').classList.add('show');

      // 全下
      const bAll = document.createElement('button');
      bAll.className = 'act-btn allin';
      bAll.innerHTML = `全下<small>${L.maxTo}</small>`;
      bAll.onclick = () => this.playerAction('raise', L.maxTo);
      row.appendChild(bAll);
    } else {
      $('raise-panel').classList.remove('show');
    }
  },

  _setupRaisePanel(L, e) {
    const slider = $('raise-slider'), amt = $('raise-amt');
    const s = e.s;
    const min = L.minTo, max = L.maxTo;
    slider.min = min; slider.max = max;
    const open = s.currentBet > 0 ? Math.min(max, Math.max(min, s.currentBet * 2)) : Math.min(max, Math.max(min, CFG.BB * 2));
    slider.value = open;
    amt.textContent = open;

    slider.oninput = () => { amt.textContent = slider.value; };
    slider.onchange = () => FX.click();

    // 快捷注额
    const qb = $('quick-bets');
    qb.innerHTML = '';
    const potBase = Math.max(s.pot, CFG.BB);
    const opts = [
      ['最小', min],
      ['½ 底池', s.bets[0] + Math.round(potBase * 0.5 / 5) * 5],
      ['¾ 底池', s.bets[0] + Math.round(potBase * 0.75 / 5) * 5],
      ['1 底池', s.bets[0] + Math.round(potBase / 5) * 5],
      ['全下', max],
    ];
    opts.forEach(([label, val], i) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => {
        const v = Math.max(min, Math.min(max, val));
        slider.value = v; amt.textContent = v; FX.click();
      };
      qb.appendChild(b);
    });
  },

  _confirmRaise() {
    const v = parseInt($('raise-slider').value, 10);
    if (!isNaN(v)) this.playerAction('raise', v);
  },

  /* ===== 弹窗 ===== */
  showHistory() {
    const d = Stats.data;
    $('st-wins').textContent = d.wins;
    $('st-losses').textContent = d.losses;
    $('st-ties').textContent = d.ties;
    const total = d.wins + d.losses + d.ties;
    $('st-winrate').textContent = total ? Math.round(d.wins / total * 100) + '%' : '—';
    $('st-maxpot').textContent = d.maxPot;
    $('st-streak').textContent = d.streak > 0 ? d.streak + '🔥' : d.streak;
    const hl = $('history-list');
    hl.innerHTML = Stats.history.length ? Stats.history.map(h => {
      const cls = h.winner === 0 ? 'w' : h.winner === 1 ? 'l' : 't';
      const res = h.winner === 0 ? '胜' : h.winner === 1 ? '负' : '平';
      return `<div class="h-item"><span>${h.t}</span><span>你 ${h.ph} ｜ 电脑 ${h.ah}</span><b class="${cls}">${res} ${h.pot}</b></div>`;
    }).join('') : '<div class="h-item"><span>暂无对局记录</span></div>';
    $('history-overlay').classList.add('show');
  },
};

/* ---------- 初始化 ---------- */
(function init() {
  Stats.load();
  Confetti.init();

  // 顶栏按钮状态
  $('btn-sound').textContent = FX.on ? '🔊' : '🔇';
  $('btn-sound').classList.toggle('off', !FX.on);
  $('btn-hint').classList.toggle('on', Equity.hintOn);

  $('btn-sound').onclick = () => {
    FX.on = !FX.on;
    localStorage.setItem('pk_sound', FX.on ? '1' : '0');
    $('btn-sound').textContent = FX.on ? '🔊' : '🔇';
    $('btn-sound').classList.toggle('off', !FX.on);
    FX.click();
  };
  $('btn-hint').onclick = () => {
    Equity.hintOn = !Equity.hintOn;
    localStorage.setItem('pk_hint', Equity.hintOn ? '1' : '0');
    $('btn-hint').classList.toggle('on', Equity.hintOn);
    Equity.update(Game.engine);
    FX.click();
  };
  $('btn-history').onclick = () => { FX.click(); Game.showHistory(); };
  $('btn-rules').onclick = () => { FX.click(); $('rules-overlay').classList.add('show'); };
  $('btn-newmatch').onclick = () => { FX.click(); Game.newMatch(); };

  $('history-close').onclick = () => $('history-overlay').classList.remove('show');
  $('rules-close').onclick = () => $('rules-overlay').classList.remove('show');
  $('btn-reset-stats').onclick = () => {
    if (confirm('确定清空所有战绩和对局记录吗？')) { Stats.reset(); Game.showHistory(); }
  };
  $('result-next').onclick = () => {
    FX.click();
    $('result-overlay').classList.remove('show');
    if (Game.engine.chips[0] <= 0 || Game.engine.chips[1] <= 0) Game.newMatch();
    Game._later(() => Game.startHand(), 150);
  };
  $('result-close').onclick = () => { FX.click(); $('result-overlay').classList.remove('show'); };

  // 点击遮罩关闭（结算弹窗除外，防止误触）
  ['history-overlay', 'rules-overlay'].forEach(id => {
    $(id).addEventListener('click', ev => { if (ev.target === $(id)) $(id).classList.remove('show'); });
  });

  // 键盘快捷键（仅本窗口活动时响应；窗口关闭后自动移除监听）
  const onGameKeydown = ev => {
    if (!rootEl.isConnected) { document.removeEventListener('keydown', onGameKeydown); return; }
    if (!win.el.classList.contains('active')) return;
    if (ev.target.tagName === 'INPUT' && ev.target.type !== 'range') return;
    const s = Game.engine.s;
    if (!s || !s.inHand || s.actor !== 0 || Game.busy) {
      // 空格快捷开下一局
      if (ev.key === ' ' && $('result-overlay').classList.contains('show')) { ev.preventDefault(); $('result-next').click(); }
      return;
    }
    const k = ev.key.toLowerCase();
    const L = Game.engine.legal(0);
    if (k === 'f') { ev.preventDefault(); Game.playerAction('fold'); }
    else if (k === 'c') { ev.preventDefault(); Game.playerAction(L.canCheck ? 'check' : 'call'); }
    else if (k === 'r') { ev.preventDefault(); Game._confirmRaise(); }
    else if (k === 'a') { ev.preventDefault(); if (L.canRaise) Game.playerAction('raise', L.maxTo); }
    else if (['1', '2', '3', '4'].includes(k)) {
      const btns = $('quick-bets').children;
      const idx = +k - 1;
      if (btns[idx]) { ev.preventDefault(); btns[idx].click(); }
    }
  };
  document.addEventListener('keydown', onGameKeydown);

  // 首次交互解锁音频
  rootEl.addEventListener('pointerdown', () => FX.ensure(), { once: true });

  UI.log('欢迎来到德州单挑！点击"开始游戏"发牌。', 'l-sys');
  UI.log('💡 点击右上角灯泡可开启实时胜率提示。', 'l-sys');
  UI.render(Game.engine);
  Game._renderIdleButtons();

})();
  };
})();
