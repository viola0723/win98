/* ============================================================
 * 卡带随身听（WIN98_APPS['tape']）—— 复古的壳 × 现代的芯
 * ------------------------------------------------------------
 * 窗口内自定义深色现代风（壳仍由窗口系统保持 Win98）：
 *   左 = 磁带架（书脊行，点击放入，飞行入带动画）
 *   中 = 斜二轴测 2.5D 卡带机（播放时卷轴转动、左右带量随进度此消彼长）
 *   右 = 相框封面 + 波形进度条（真实峰值，点击/拖动 seek）
 * 交互：⏮⏭ 短按换带 / 按住 ≈8 倍速快进快退；空格播放暂停；←→ ±5s；
 *   音量滑杆；唱完自动换下一盘；关窗自动停声（rAF 循环检测 isConnected）。
 * 注意：SVG 按钮不是 <button>，touchTap 不覆盖，一律 pointerup 自检测激活（iOS 真机
 *   click 不派发，见 PITFALLS 触屏类）；iOS 上 audio.volume 被系统忽略，音量键仅 UI。
 *
 * 数据注册表 WIN98_TAPES —— 加歌三步：
 *   ① 音频 + 封面丢进 assets/music/ 并压缩（mp3 128k / 封面长边 512px，ffmpeg 优先，audio-optimizer 兜底）
 *   ② 提取 duration/peaks（ffmpeg 解码 + Node 脚本复刻算法，或 tools/waveform-extractor.html?src=/assets/music/xxx.mp3）
 *   ③ 下面加一条记录（title/artist/color/src/cover/dur/peaks）
 * ============================================================ */
window.WIN98_APPS = window.WIN98_APPS || {};
(function () {
  'use strict';

  var WIN98_TAPES = [
    { title: '月之暗面', artist: '旧电脑', color: '#d8c27a',
      src: 'assets/music/月之暗面.mp3', cover: 'assets/music/月之暗面.jpg', dur: 246.6,
      peaks: [0.17, 0.3, 0.38, 0.38, 0.43, 0.42, 0.43, 0.43, 0.43, 0.42, 0.54, 0.51, 0.8, 0.82, 0.82, 0.78, 0.64, 0.78, 0.73, 0.74, 0.77, 0.75, 0.67, 0.67, 0.73, 0.64, 0.71, 0.66, 0.65, 0.63, 0.79, 0.91, 0.95, 0.9, 0.9, 0.92, 0.88, 0.89, 0.93, 0.92, 0.83, 0.64, 0.65, 0.61, 0.62, 0.61, 0.65, 0.61, 0.59, 0.67, 0.77, 0.75, 0.75, 0.71, 0.76, 0.75, 0.78, 0.65, 0.43, 0.71, 0.79, 0.85, 0.82, 0.76, 0.49, 0.84, 0.91, 0.96, 0.9, 0.85, 0.86, 0.8, 0.86, 0.85, 0.88, 0.67, 0.54, 0.9, 0.85, 0.76, 0.82, 0.76, 0.84, 0.85, 0.82, 0.9, 0.91, 0.89, 0.86, 0.85, 0.64, 0.56, 0.68, 0.88, 0.88, 0.98, 0.85, 0.81, 0.79, 0.84, 0.81, 0.96, 1, 0.95, 0.83, 0.83, 0.87, 0.81, 0.51, 0.52, 0.43, 0.33] },
    { title: '夜晚', artist: '旧电脑', color: '#8f7fd4',
      src: 'assets/music/夜晚.mp3', cover: 'assets/music/夜晚.jpg', dur: 172.1,
      peaks: [0.32, 0.28, 0.31, 0.27, 0.27, 0.31, 0.28, 0.32, 0.29, 0.31, 0.4, 0.36, 0.38, 0.41, 0.37, 0.41, 0.38, 0.39, 0.4, 0.38, 0.85, 0.54, 0.69, 0.63, 0.5, 0.9, 0.57, 0.78, 0.74, 0.57, 0.84, 0.61, 0.77, 0.72, 0.65, 0.8, 0.61, 0.8, 0.87, 0.79, 0.94, 0.63, 0.81, 0.77, 0.61, 0.86, 0.55, 0.72, 0.77, 0.74, 0.86, 0.59, 0.8, 0.75, 0.67, 0.78, 0.65, 0.71, 0.77, 0.74, 0.52, 0.33, 0.39, 0.27, 0.35, 0.36, 0.32, 0.4, 0.29, 0.44, 0.49, 0.48, 0.55, 0.5, 0.61, 0.61, 0.59, 0.7, 0.66, 0.79, 1, 0.68, 0.72, 0.72, 0.66, 0.73, 0.56, 0.77, 0.77, 0.76, 0.81, 0.59, 0.77, 0.72, 0.71, 0.79, 0.55, 0.71, 0.71, 0.62, 0.5, 0.37, 0.44, 0.35, 0.39, 0.38, 0.33, 0.51, 0.36, 0.32, 0.19, 0.15] },
    { title: '应龙', artist: '旧电脑', color: '#6fae9f',
      src: 'assets/music/应龙.mp3', cover: 'assets/music/应龙.jpg', dur: 237.8,
      peaks: [0.36, 0.26, 0.4, 0.42, 0.74, 0.52, 0.54, 0.3, 0.72, 0.83, 0.62, 0.79, 0.68, 0.54, 0.61, 0.62, 0.49, 0.68, 0.57, 0.56, 0.88, 0.83, 0.86, 0.95, 0.82, 0.82, 0.9, 0.8, 0.8, 0.78, 0.53, 0.65, 0.97, 0.92, 0.9, 0.77, 0.95, 1, 0.82, 0.89, 0.6, 0.66, 0.87, 0.79, 0.64, 0.82, 0.62, 0.57, 0.66, 0.68, 0.71, 0.8, 0.88, 0.83, 0.79, 0.83, 0.66, 0.71, 0.8, 0.74, 0.77, 0.84, 0.81, 0.77, 0.73, 0.89, 0.87, 0.76, 0.84, 0.83, 0.87, 0.91, 0.86, 0.79, 0.86, 0.73, 0.8, 0.88, 0.78, 0.79, 0.79, 0.67, 0.77, 0.93, 0.99, 1, 0.97, 0.8, 0.95, 0.92, 0.76, 0.93, 0.75, 0.94, 0.97, 0.77, 0.47, 0.84, 0.83, 0.59, 0.92, 0.85, 0.73, 0.76, 0.66, 0.56, 0.77, 0.74, 0.7, 0.62, 0.39, 0.19] },
    { title: 'Moonlit Tide', artist: '旧电脑', color: '#dfa63e',
      src: 'assets/music/moonlit-tide.mp3', cover: 'assets/music/moonlit-tide.jpg', dur: 166.5,
      peaks: [0.36, 0.59, 0.54, 0.42, 0.58, 0.41, 0.47, 0.36, 0.43, 0.44, 0.7, 0.54, 0.64, 0.53, 0.5, 0.51, 0.47, 0.73, 0.66, 0.7, 0.55, 0.65, 0.61, 0.57, 0.45, 0.68, 0.71, 0.74, 0.65, 0.49, 0.6, 0.54, 0.65, 0.82, 1, 0.92, 0.87, 0.71, 0.64, 0.65, 0.72, 0.64, 0.75, 0.62, 0.79, 0.72, 0.8, 0.75, 0.81, 0.73, 0.79, 0.87, 0.82, 0.77, 0.91, 0.76, 0.6, 0.55, 0.31, 0.39, 0.37, 0.37, 0.39, 0.49, 0.45, 0.51, 0.46, 0.28, 0.54, 0.52, 0.5, 0.46, 0.54, 0.46, 0.52, 0.46, 0.82, 0.65, 0.74, 0.73, 0.72, 0.77, 0.63, 0.78, 0.64, 0.91, 0.76, 0.87, 0.65, 0.77, 0.69, 0.69, 0.7, 0.61, 0.39, 0.48, 0.41, 0.42, 0.34, 0.43, 0.34, 0.37, 0.41, 0.4, 0.43, 0.35, 0.46, 0.41, 0.51, 0.36, 0.4, 0.19] },
    { title: 'Rainy Morning', artist: '旧电脑', color: '#8fa08a',
      src: 'assets/music/rainy-morning.mp3', cover: 'assets/music/rainy-morning.jpg', dur: 159.7,
      peaks: [0.22, 0.28, 0.62, 0.5, 0.65, 0.62, 0.55, 0.67, 0.66, 0.7, 0.58, 0.57, 0.61, 0.54, 0.61, 0.43, 0.42, 0.47, 0.66, 0.63, 0.71, 0.6, 0.62, 0.68, 0.63, 0.7, 0.61, 0.61, 0.65, 0.62, 0.68, 0.63, 0.68, 0.62, 0.63, 0.69, 0.74, 0.66, 0.63, 0.64, 0.75, 0.73, 0.74, 0.77, 0.74, 0.78, 0.63, 0.8, 0.66, 0.59, 0.57, 0.5, 0.49, 0.48, 0.53, 0.59, 0.6, 0.56, 0.5, 0.53, 0.47, 0.43, 0.58, 0.53, 0.84, 0.91, 0.75, 0.8, 0.73, 0.85, 0.79, 0.9, 0.7, 0.76, 0.75, 0.7, 0.76, 0.71, 0.8, 0.79, 0.76, 0.68, 0.73, 0.76, 0.83, 0.77, 0.86, 0.76, 0.84, 0.73, 0.89, 0.73, 0.75, 0.61, 0.73, 0.55, 0.41, 0.72, 0.69, 0.55, 0.75, 0.57, 1, 0.57, 0.72, 0.56, 0.66, 0.51, 0.6, 0.61, 0.66, 0.2] },
    { title: '孟婆', artist: '旧电脑', color: '#db170b',
      src: 'assets/music/孟婆.mp3', cover: 'assets/music/孟婆.jpg', dur: 260.3,
      peaks: [0.25, 0.52, 0.67, 0.35, 0.28, 0.5, 0.71, 0.51, 0.64, 0.53, 0.62, 0.72, 0.43, 0.61, 0.51, 0.58, 0.62, 0.62, 0.66, 0.58, 0.68, 0.69, 0.38, 1, 0.98, 0.72, 0.74, 0.71, 0.65, 0.78, 0.98, 0.95, 0.84, 0.96, 0.83, 0.95, 0.89, 0.79, 0.85, 0.88, 0.96, 0.73, 0.51, 0.83, 0.63, 0.45, 0.35, 0.36, 0.39, 0.59, 0.96, 0.79, 0.77, 0.7, 0.71, 0.65, 0.8, 0.84, 0.77, 0.68, 0.61, 0.85, 0.88, 0.89, 0.82, 0.85, 0.93, 0.89, 0.92, 0.96, 0.94, 0.94, 0.93, 0.96, 0.9, 0.65, 0.47, 0.72, 0.64, 0.66, 0.69, 0.71, 0.72, 0.71, 0.71, 0.74, 0.71, 0.94, 0.91, 0.82, 0.92, 0.92, 0.95, 0.76, 0.57, 0.96, 0.98, 0.98, 0.95, 0.9, 0.96, 0.94, 0.87, 0.82, 0.94, 0.94, 0.82, 0.57, 0.38, 0.43, 0.59, 0.3] },
    { title: '七情六欲', artist: '旧电脑', color: '#64625c',
      src: 'assets/music/七情六欲.mp3', cover: 'assets/music/七情六欲.jpg', dur: 238.1,
      peaks: [0.43, 0.34, 0.46, 0.6, 0.41, 0.3, 0.34, 0.55, 0.7, 0.55, 0.56, 0.53, 0.56, 0.7, 0.58, 0.5, 0.25, 0.69, 0.64, 0.75, 0.71, 0.7, 0.61, 0.55, 0.88, 0.88, 0.93, 0.92, 0.83, 0.81, 0.8, 0.78, 0.85, 0.85, 0.79, 0.78, 0.62, 0.82, 0.73, 0.84, 0.78, 0.72, 0.76, 0.77, 0.84, 0.76, 0.81, 0.8, 0.61, 0.65, 0.76, 0.84, 0.78, 0.72, 0.83, 0.83, 0.8, 0.83, 0.76, 0.8, 0.86, 0.8, 0.65, 0.63, 0.73, 0.88, 0.94, 0.91, 0.87, 0.8, 0.91, 0.72, 0.65, 0.66, 0.68, 0.68, 0.65, 0.55, 0.86, 0.82, 0.82, 0.57, 0.7, 0.82, 0.82, 0.82, 0.84, 0.77, 0.88, 0.71, 0.76, 0.74, 1, 0.92, 0.96, 0.88, 0.79, 0.89, 0.85, 0.97, 0.9, 0.89, 0.89, 0.59, 0.76, 0.88, 0.82, 0.95, 0.94, 0.55, 0.29, 0.16] }
  ];

  /* 媒体 CDN 前缀（当前 = ''：全部走站点本地）。
     国内访问本站媒体通道的实测结论（2026-07-25，详见 DEVLOG/PITFALLS）：
     github.io 直连 ~24KB/s（Fastly HIT，稳定但慢）——故素材必须压缩（mp3 128kbps = 16KB/s，
     封面 ≤100KB，经 tools/audio-optimizer.html 处理）才能在该通道流畅播放；
     jsDelivr 对 mp3 只做 301 到 raw.githubusercontent.com（时而有 1.8MB/s 时而 335B/s，不稳定）；
     statically.io / raw.githack.com 本网络不可达。
     若未来发现可用的稳定镜像，把前缀填回此处即可恢复「CDN 优先 + error 回退本地」逻辑。 */
  var MEDIA_CDN = '';

  /* ================= 形状工具 ================= */
  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2);
  }
  /* 阶梯圆角矩形（像素味圆角） */
  function srr(x, y, w, h, r) {
    var a = Math.round(r), b = Math.round(r * 0.4), c = Math.round(r * 0.13);
    return 'M' + (x + a) + ' ' + y + 'H' + (x + w - a)
      + 'L' + (x + w - b) + ' ' + (y + c) + 'L' + (x + w - c) + ' ' + (y + b) + 'L' + (x + w) + ' ' + (y + a)
      + 'V' + (y + h - a)
      + 'L' + (x + w - c) + ' ' + (y + h - b) + 'L' + (x + w - b) + ' ' + (y + h - c) + 'L' + (x + w - a) + ' ' + (y + h)
      + 'H' + (x + a)
      + 'L' + (x + b) + ' ' + (y + h - c) + 'L' + (x + c) + ' ' + (y + h - b) + 'L' + x + ' ' + (y + h - a)
      + 'V' + (y + a)
      + 'L' + (x + c) + ' ' + (y + b) + 'L' + (x + b) + ' ' + (y + c) + 'Z';
  }
  /* 像素圆（逐行扫描） */
  function pcircle(cx, cy, r) {
    var d = '';
    for (var y = -r; y <= r; y++) {
      var hw = Math.floor(Math.sqrt(r * r - y * y));
      if (hw > 0) d += 'M' + (cx - hw) + ' ' + (cy + y) + 'h' + (hw * 2) + 'v1h-' + (hw * 2) + 'z';
    }
    return d;
  }

  /* ================= 图标（24 格像素 path） ================= */
  var ICONS = {
    prev:  'M5 5h2v14H5zM19 5h-1v2h-3v2h-3v2h-3v2h3v2h3v2h3v2h1z',
    play:  'M9 5h1v2h3v2h3v2h3v2h-3v2h-3v2h-3v2h-1z',
    pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
    stop:  'M7 7h10v10H7z',
    next:  'M9 5h1v2h3v2h3v2h3v2h-3v2h-3v2h-3v2h-1zM17 5h2v14h-2z',
    eject: 'M11 5h2v2h1v2h1v2h1v2h1v2h-10v-2h1v-2h1v-2h1v-2h1zM6 17h12v2H6z'
  };
  function glyph(name, cx, cy, scale, color) {
    var off = 12 * scale;
    return '<path d="' + ICONS[name] + '" fill="' + color + '" transform="translate(' + (cx - off) + ',' + (cy - off) + ') scale(' + scale + ')"/>';
  }

  /* ================= 独立磁带 SVG（架子缩略 / 飞行动画） ================= */
  function cassetteSVG(t) {
    var reels = '';
    [47, 103].forEach(function (cx) {
      reels += '<g transform="translate(' + cx + ',53)">'
        + '<circle r="13" fill="#3a2418"/>'
        + '<circle r="7" fill="#e8e8e8" stroke="#101014"/>'
        + '<rect x="-1.5" y="-6.5" width="3" height="13" fill="#101014"/>'
        + '<rect x="-1.5" y="-6.5" width="3" height="13" fill="#101014" transform="rotate(60)"/>'
        + '<rect x="-1.5" y="-6.5" width="3" height="13" fill="#101014" transform="rotate(120)"/>'
        + '<circle r="1.8" fill="#101014"/></g>';
    });
    return '<svg viewBox="0 0 150 96" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="' + srr(2, 2, 146, 92, 6) + '" fill="#26262e" stroke="#101014" stroke-width="2"/>'
      + '<path d="' + srr(8, 8, 134, 22, 3) + '" fill="' + t.color + '"/>'
      + '<text x="75" y="24" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff" font-family="inherit">' + t.title + '</text>'
      + '<path d="' + srr(8, 34, 134, 34, 3) + '" fill="#101016"/>'
      + '<path d="M47 66 L103 66" stroke="#3a2418" stroke-width="1.5"/>'
      + reels
      + '<polygon points="55,94 95,94 88,80 62,80" fill="#3d3d46"/>'
      + '<rect x="16" y="82" width="7" height="6" fill="#3d3d46"/>'
      + '<rect x="127" y="82" width="7" height="6" fill="#3d3d46"/>'
      + '<text x="11" y="79" font-size="7" fill="#6a6a76" font-family="inherit">A</text>'
      + '<circle cx="8" cy="8" r="1.8" fill="#4a4a56"/><circle cx="142" cy="8" r="1.8" fill="#4a4a56"/>'
      + '<circle cx="8" cy="88" r="1.8" fill="#4a4a56"/><circle cx="142" cy="88" r="1.8" fill="#4a4a56"/>'
      + '</svg>';
  }

  /* ================= 播放器机身（斜二轴测 2.5D：顶面 + 右面 + 正面） ================= */
  function buildPlayerSVG() {
    var s = '';
    s += '<polygon points="10,18 24,4 306,4 292,18" fill="#34343e" stroke="#101014" stroke-width="1.5"/>';
    [64, 96, 128, 160].forEach(function (gx) {
      s += '<line x1="' + gx + '" y1="14.5" x2="' + (gx + 11) + '" y2="7.5" stroke="#26262e" stroke-width="2"/>';
    });
    s += '<polygon points="292,18 306,4 306,194 292,208" fill="#1a1a20" stroke="#101014" stroke-width="1.5"/>';
    s += '<path d="' + srr(8, 18, 284, 190, 10) + '" fill="#26262e" stroke="#101014" stroke-width="1.5"/>'
      + '<path d="' + srr(10, 20, 280, 186, 9) + '" fill="none" stroke="#ffffff" stroke-width="1" opacity=".06"/>';
    s += '<rect x="26" y="32" width="72" height="3" class="acc"/>'
      + '<text x="106" y="36" font-size="6" fill="#7a7a86" letter-spacing="1">WM-1998</text>'
      + '<text x="274" y="36" font-size="7" fill="#7a7a86" text-anchor="end" letter-spacing="1">TAPE DECK</text>';
    /* 带舱窗（凹陷感：内上暗下亮） */
    s += '<path d="' + srr(24, 50, 176, 112, 8) + '" fill="#0b0b10" stroke="#101014" stroke-width="1.5"/>'
      + '<rect x="28" y="52" width="168" height="2" fill="#000" opacity=".45"/>'
      + '<rect x="28" y="158" width="168" height="1" fill="#fff" opacity=".05"/>'
      + '<text class="tp-no-tape" x="112" y="110" text-anchor="middle" font-size="8" fill="#2e2e3a" letter-spacing="2">NO TAPE</text>';
    /* 舱内磁带 */
    s += '<g class="tp-deck-tape" opacity="0">'
      + '<path d="' + srr(34, 56, 156, 100, 5) + '" fill="#2b2b33" stroke="#101014" stroke-width="1"/>'
      + '<path d="' + srr(40, 62, 144, 16, 2) + '" class="acc"/>'
      + '<text class="tp-dt-title" x="112" y="74" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff"></text>'
      + '<path d="' + srr(40, 82, 144, 64, 4) + '" fill="#101016"/>'
      + '<path class="tp-tape-run" stroke="#3a2418" stroke-width="1.5" fill="none" d="M74 136 L150 136"/>';
    [74, 150].forEach(function (cx, i) {
      s += '<g transform="translate(' + cx + ',114)">'
        + '<circle class="tp-spool-' + (i === 0 ? 'l' : 'r') + '" r="' + (i === 0 ? 22 : 8) + '" fill="#3a2418"/>'
        + '<g class="reel-spin">'
        + '<circle r="9" fill="#e8e8e8" stroke="#101014" stroke-width="1"/>'
        + '<rect x="-1.5" y="-8.5" width="3" height="17" fill="#101014"/>'
        + '<rect x="-1.5" y="-8.5" width="3" height="17" fill="#101014" transform="rotate(60)"/>'
        + '<rect x="-1.5" y="-8.5" width="3" height="17" fill="#101014" transform="rotate(120)"/>'
        + '<circle r="2.2" fill="#101014"/>'
        + '</g></g>';
    });
    s += '<polygon points="96,156 128,156 122,146 102,146" fill="#3d3d46"/>'
      + '<circle cx="40" cy="61" r="1.2" fill="#4a4a56"/><circle cx="184" cy="61" r="1.2" fill="#4a4a56"/>'
      + '<circle cx="40" cy="151" r="1.2" fill="#4a4a56"/><circle cx="184" cy="151" r="1.2" fill="#4a4a56"/>'
      + '</g>';
    s += '<polygon points="42,50 84,50 56,162 24,162" fill="#ffffff" opacity=".03" pointer-events="none"/>';
    /* LCD */
    s += '<path d="' + srr(212, 50, 64, 46, 5) + '" fill="#101016" stroke="#101014" stroke-width="1"/>'
      + '<g class="tp-lcd-state">' + glyph('play', 221, 59, 0.3, '#d8c27a') + '</g>'
      + '<text class="tp-lcd-track" x="272" y="62" font-size="6" fill="#8a8a96" text-anchor="end">TRK --</text>'
      + '<text class="tp-lcd-time" x="218" y="82" font-size="11" fill="#e8e8f0">00:00</text>';
    /* EJECT */
    s += '<g class="tp-btn" data-act="eject" transform="translate(244,116)" role="button" aria-label="退带"><g class="tp-btn-body">'
      + '<path d="' + pcircle(0, 2, 12) + '" fill="#000" opacity=".3"/>'
      + '<path d="' + pcircle(0, 0, 12) + '" fill="#34343e" stroke="#101014" stroke-width="1"/>'
      + glyph('eject', 0, 0, 0.45, '#e8e8f0')
      + '<path d="' + pcircle(0, 0, 15) + '" fill="#000" opacity="0"/>'
      + '</g></g>'
      + '<text x="244" y="138" font-size="5" fill="#6a6a76" text-anchor="middle" letter-spacing="1">EJECT</text>';
    /* 音量滑杆 */
    s += '<text x="214" y="150" font-size="5" fill="#6a6a76" letter-spacing="1">VOL</text>'
      + '<g class="tp-vol">'
      + '<path d="' + srr(214, 154, 60, 5, 2) + '" fill="#101016" stroke="#101014" stroke-width="1"/>'
      + '<path class="tp-vol-fill" d="' + srr(214, 154, 48, 5, 2) + '" class="acc"/>'
      + '<circle class="tp-vol-knob" cx="262" cy="156.5" r="5.5" fill="#e8e8f0" stroke="#101014" stroke-width="1"/>'
      + '<rect class="tp-vol-hit" x="214" y="146" width="60" height="20" fill="#000" opacity="0"/>'
      + '</g>';
    /* 底部控制排 */
    function btn(act, cx, r, glyphScale) {
      return '<g class="tp-btn" data-act="' + act + '" transform="translate(' + cx + ',184)" role="button"><g class="tp-btn-body">'
        + '<path d="' + pcircle(0, 2, r) + '" fill="#000" opacity=".3"/>'
        + '<path d="' + pcircle(0, 0, r) + '" fill="#34343e" stroke="#101014" stroke-width="1"/>'
        + glyph(act, 0, 0, glyphScale, '#e8e8f0')
        + '<path d="' + pcircle(0, 0, r + 5) + '" fill="#000" opacity="0"/>'
        + '</g></g>';
    }
    s += btn('prev', 104, 11, 0.5);
    s += '<g class="tp-btn" data-act="play" transform="translate(148,184)" role="button" aria-label="播放/暂停"><g class="tp-btn-body">'
      + '<path d="' + pcircle(0, 2, 17) + '" fill="#000" opacity=".3"/>'
      + '<path d="' + pcircle(0, 0, 17) + '" class="acc"/>'
      + '<path d="' + pcircle(0, 0, 13) + '" fill="#26262e"/>'
      + '<g class="tp-play-glyphs">' + glyph('play', 0, 0, 0.66, '#e8e8f0') + '</g>'
      + '<path d="' + pcircle(0, 0, 21) + '" fill="#000" opacity="0"/>'
      + '</g></g>';
    s += btn('next', 192, 11, 0.5);
    s += btn('stop', 240, 9, 0.4);
    [[16, 26], [284, 26], [16, 200], [284, 200]].forEach(function (p) {
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.8" fill="#3a3a44" stroke="#101014" stroke-width=".5"/>';
    });
    return s;
  }

  /* ================= 模块入口 ================= */
  window.WIN98_APPS['tape'] = function (bodyEl, win, cfg) {
    bodyEl.classList.add('app-tape');
    bodyEl.innerHTML =
      '<div class="tp-zones">'
      + '<div class="tp-shelf"><div class="tp-shelf-h">TAPES · ' + WIN98_TAPES.length + '</div><div class="tp-slots"></div></div>'
      + '<div class="tp-stage">'
      + '<div class="tp-player-wrap"><div class="tp-glow"></div>'
      + '<svg class="tp-player" viewBox="0 0 322 224" aria-label="卡带机">' + buildPlayerSVG() + '</svg></div>'
      + '<div class="tp-hint">点击左侧磁带放入 · ⏮⏭ 短按换带 / 按住快进快退 · 空格 = 播放/暂停</div>'
      + '</div>'
      + '<div class="tp-side">'
      + '<div class="tp-frame dim"><div class="tp-frame-inner"><img class="tp-cover" src="' + mediaURL(WIN98_TAPES[0].cover) + '" alt="封面"></div></div>'
      + '<div class="tp-wf-wrap"><canvas class="tp-wf dim" width="416" height="72"></canvas><div class="tp-cap">未放入磁带</div></div>'
      + '</div>'
      + '</div>';

    function $(sel) { return bodyEl.querySelector(sel); }
    function $all(sel) { return Array.prototype.slice.call(bodyEl.querySelectorAll(sel)); }

    var S = { deck: -1, playing: false, t: 0, busy: false, raf: 0, last: 0, seeking: 0, vol: 0.8 };
    var audio = new Audio();
    audio.preload = 'auto';
    var wfCtx = $('.tp-wf').getContext('2d');
    var wfData = [];
    var slotEls = [];
    bodyEl.win98Tape = S;   /* 验收探针（PITFALLS 惯例：状态挂容器根） */
    bodyEl.win98TapeAudio = audio;

    /* ---- 媒体加载：CDN 优先，失败回退本地；开窗即预载第一盘（preload='auto'） ---- */
    function mediaURL(localPath) { return MEDIA_CDN ? MEDIA_CDN + encodeURI(localPath) : encodeURI(localPath); }
    function setAudioSrc(localPath) {
      if (audio.dataset.cur === localPath) return;   // 同址不重设，保住预载成果
      audio.dataset.cur = localPath;
      audio.addEventListener('error', function fb() {
        audio.removeEventListener('error', fb);
        if (!MEDIA_CDN) return;
        audio.src = encodeURI(localPath);            // 回退 github.io 本地
      });
      audio.src = mediaURL(localPath);
    }
    function setCover(localPath) {
      var img = $('.tp-cover');
      img.onerror = function () { img.onerror = null; img.src = encodeURI(localPath); };
      img.src = mediaURL(localPath);
    }
    /* 缓冲状态：waiting/stalled → LCD 显 LOAD，恢复后回时间码 */
    S.buffering = false;
    ['waiting', 'stalled'].forEach(function (ev) {
      audio.addEventListener(ev, function () {
        if (S.deck < 0) return;
        S.buffering = true;
        $('.tp-lcd-time').textContent = 'LOAD';
      });
    });
    ['playing', 'canplay', 'canplaythrough'].forEach(function (ev) {
      audio.addEventListener(ev, function () {
        if (!S.buffering) return;
        S.buffering = false;
        tickUI();
      });
    });
    setAudioSrc(WIN98_TAPES[0].src);   // 开窗即预载，入带时不必从零缓冲
    (function () {
      var img = $('.tp-cover');
      img.onerror = function () { img.onerror = null; img.src = encodeURI(WIN98_TAPES[0].cover); };
    })();

    function curTrack() { return S.deck >= 0 ? WIN98_TAPES[S.deck] : null; }
    function setAccent(color) {
      bodyEl.style.setProperty('--accent', color);
      $('.tp-lcd-state').innerHTML = glyph(S.playing ? 'pause' : 'play', 221, 59, 0.3, color);
    }
    function setPlayGlyphs(playing) {
      $('.tp-play-glyphs').innerHTML = glyph(playing ? 'pause' : 'play', 0, 0, 0.66, '#e8e8f0');
      var tr = curTrack();
      $('.tp-lcd-state').innerHTML = glyph(playing ? 'pause' : 'play', 221, 59, 0.3, tr ? tr.color : WIN98_TAPES[0].color);
      slotEls.forEach(function (el, i) { el.classList.toggle('playing', playing && i === S.deck); });
    }

    /* ---------- 波形 ---------- */
    function drawWave(p, color) {
      var W = 416, H = 72;
      wfCtx.clearRect(0, 0, W, H);
      var n = wfData.length, step = W / n;
      for (var i = 0; i < n; i++) {
        var h = Math.max(3, wfData[i] * (H - 10));
        wfCtx.fillStyle = (i / n <= p) ? color : '#3a3a46';
        wfCtx.fillRect(Math.round(i * step), Math.round((H - h) / 2), 2, Math.round(h));
      }
      wfCtx.fillStyle = '#e8e8f0';
      wfCtx.fillRect(Math.round(p * W) - 1, 0, 2, H);
    }

    /* ---------- UI 刷新 ---------- */
    function tickUI() {
      var tr = curTrack();
      if (!tr) return;
      var p = Math.min(1, S.t / tr.dur);
      $('.tp-lcd-track').textContent = 'TRK 0' + (S.deck + 1);
      $('.tp-lcd-time').textContent = fmt(S.t);
      $('.tp-spool-l').setAttribute('r', (8 + 14 * Math.sqrt(1 - p)).toFixed(2));
      $('.tp-spool-r').setAttribute('r', (8 + 14 * Math.sqrt(p)).toFixed(2));
      $('.tp-tape-run').setAttribute('d', 'M74 ' + (114 + 8 + 14 * Math.sqrt(1 - p)).toFixed(1) + ' L150 ' + (114 + 8 + 14 * Math.sqrt(p)).toFixed(1));
      drawWave(p, tr.color);
      $('.tp-cap').textContent = tr.title + ' · ' + fmt(S.t) + ' / ' + fmt(tr.dur);
    }

    /* ---------- 播放循环（窗口被关 = bodyEl 脱离文档 → 自动停声自清） ---------- */
    function loop(now) {
      if (!bodyEl.isConnected) {
        audio.pause();
        window.removeEventListener('keydown', onKey);
        return;
      }
      if (!S.playing && !S.seeking) return;
      var tr = curTrack(), dt = (now - S.last) / 1000;
      S.last = now;
      if (S.seeking) {
        S.t = Math.min(tr.dur, Math.max(0, S.t + S.seeking * dt * 10));
        audio.currentTime = S.t;
      } else {
        S.t = audio.currentTime;
      }
      tickUI();
      S.raf = requestAnimationFrame(loop);
    }
    function startLoop() {
      cancelAnimationFrame(S.raf);
      S.last = performance.now();
      S.raf = requestAnimationFrame(loop);
    }
    function startPlay() {
      if (S.deck < 0 || S.playing) return;
      var p = audio.play();
      if (p && p.catch) p.catch(function () { /* 手势窗口外被拦：保持暂停态 */ });
      S.playing = true;
      setPlayGlyphs(true);
      $('.tp-deck-tape').classList.add('playing');
      startLoop();
    }
    function pausePlay() {
      S.playing = false;
      audio.pause();
      setPlayGlyphs(false);
      $('.tp-deck-tape').classList.remove('playing');
      if (!S.seeking) cancelAnimationFrame(S.raf);
    }
    function stopPlay() {
      pausePlay();
      S.t = 0;
      audio.currentTime = 0;
      tickUI();
    }
    audio.addEventListener('ended', function () {
      var ni = (S.deck + 1) % WIN98_TAPES.length;
      ejectTrack(function () { insertTrack(ni, true); });
    });

    /* ---------- 入带 / 退带（FLIP 飞行） ---------- */
    function fly(fromRect, toRect, track, done) {
      var f = document.createElement('div');
      f.className = 'tp-flyer';
      f.innerHTML = cassetteSVG(track);
      f.style.left = fromRect.left + 'px';
      f.style.top = fromRect.top + 'px';
      f.style.width = fromRect.width + 'px';
      f.style.height = fromRect.height + 'px';
      document.body.appendChild(f);
      f.getBoundingClientRect();
      f.style.left = toRect.left + 'px';
      f.style.top = toRect.top + 'px';
      f.style.width = toRect.width + 'px';
      f.style.height = toRect.height + 'px';
      f.style.transform = 'rotate(-3deg)';
      var finished = false;
      function fin() { if (finished) return; finished = true; f.remove(); done(); }
      f.addEventListener('transitionend', fin);
      setTimeout(fin, 800);
    }
    function deckRect() { return $('.tp-deck-tape').getBoundingClientRect(); }
    function slotMiniRect(i) { return slotEls[i].querySelector('.tp-mini').getBoundingClientRect(); }

    function insertTrack(i, autoplay) {
      S.busy = true;
      slotEls[i].classList.add('in-deck');
      fly(slotMiniRect(i), deckRect(), WIN98_TAPES[i], function () {
        if (!bodyEl.isConnected) return;   // 飞行途中窗口被关：弃疗，元素随窗口回收
        S.deck = i; S.t = 0;
        var tr = WIN98_TAPES[i];
        setAccent(tr.color);
        wfData = tr.peaks;
        $('.tp-dt-title').textContent = tr.title;
        $('.tp-deck-tape').setAttribute('opacity', '1');
        $('.tp-no-tape').setAttribute('visibility', 'hidden');
        setCover(tr.cover);
        $('.tp-frame').classList.remove('dim');
        $('.tp-wf').classList.remove('dim');
        setAudioSrc(tr.src);
        audio.volume = S.vol;
        tickUI();
        S.busy = false;
        if (autoplay) startPlay();
      });
    }
    function ejectTrack(next) {
      if (S.deck < 0) { if (next) next(); return; }
      S.busy = true;
      pausePlay();
      var i = S.deck, tr = WIN98_TAPES[i];
      $('.tp-deck-tape').setAttribute('opacity', '0');
      fly(deckRect(), slotMiniRect(i), tr, function () {
        if (!bodyEl.isConnected) return;
        slotEls[i].classList.remove('in-deck');
        slotEls[i].classList.remove('playing');
        S.deck = -1; S.t = 0;
        audio.removeAttribute('src');
        delete audio.dataset.cur;
        audio.load();
        $('.tp-no-tape').removeAttribute('visibility');
        $('.tp-lcd-track').textContent = 'TRK --';
        $('.tp-lcd-time').textContent = '00:00';
        $('.tp-frame').classList.add('dim');
        $('.tp-wf').classList.add('dim');
        $('.tp-cap').textContent = '未放入磁带';
        S.busy = false;
        if (next) next();
      });
    }

    /* ---------- 事件 ---------- */
    function onSlot(i) {
      if (S.busy || S.deck === i) return;
      if (S.deck >= 0) ejectTrack(function () { insertTrack(i, true); });
      else insertTrack(i, true);
    }
    function skipTrack(dir) {
      if (S.deck < 0) return;
      var ni = (S.deck + dir + WIN98_TAPES.length) % WIN98_TAPES.length;
      ejectTrack(function () { insertTrack(ni, true); });
    }
    function onBtn(act) {
      if (S.busy) return;
      if (act === 'play') { S.playing ? pausePlay() : startPlay(); }
      else if (act === 'stop') { if (S.deck >= 0) stopPlay(); }
      else if (act === 'eject') { ejectTrack(null); }
    }

    /* 磁带架 */
    var slotsBox = $('.tp-slots');
    WIN98_TAPES.forEach(function (t, i) {
      var d = document.createElement('button');
      d.className = 'tp-row';
      d.type = 'button';
      d.innerHTML = '<span class="tp-mini">' + cassetteSVG(t) + '</span>'
        + '<span class="tp-meta"><span class="tp-t">' + t.title + '</span>'
        + '<span class="tp-a">' + t.artist + ' · ' + fmt(t.dur) + '</span></span>'
        + '<span class="tp-eq"><i></i><i></i><i></i></span>';
      d.setAttribute('aria-label', '放入磁带 ' + t.title);
      d.addEventListener('click', function () { onSlot(i); });
      slotsBox.appendChild(d);
      slotEls.push(d);
    });

    /* SVG 按钮：非 <button>，touchTap 不覆盖 → pointerup 自检测激活（iOS click 不派发） */
    var TAP_MS = 600, TAP_PX = 12;
    $all('.tp-btn').forEach(function (el) {
      var act = el.dataset.act;
      var down = null, holdT = 0, held = false;
      el.addEventListener('pointerdown', function (e) {
        el.classList.add('pressed');
        down = { x: e.clientX, y: e.clientY, t: Date.now() };
        if ((act === 'prev' || act === 'next') && !S.busy && S.deck >= 0) {
          var dir = act === 'next' ? 1 : -1;
          held = false;
          holdT = setTimeout(function () {
            held = true;
            S.seeking = dir;
            $('.tp-deck-tape').classList.add('seeking');
            startLoop();
          }, 350);
        }
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
        el.addEventListener(ev, function (e) {
          el.classList.remove('pressed');
          clearTimeout(holdT);
          var dir = act === 'next' ? 1 : -1;
          if (S.seeking && (act === 'prev' || act === 'next')) {
            if (S.seeking === dir) {
              S.seeking = 0;
              $('.tp-deck-tape').classList.remove('seeking');
              if (!S.playing) cancelAnimationFrame(S.raf);
            }
            down = null;
            return;
          }
          if (ev !== 'pointerup' || !down) return;
          var okTap = Date.now() - down.t <= TAP_MS
            && Math.abs(e.clientX - down.x) <= TAP_PX
            && Math.abs(e.clientY - down.y) <= TAP_PX;
          down = null;
          if (!okTap || S.busy) return;
          if (act === 'prev' || act === 'next') {
            if (S.deck >= 0 && !held) skipTrack(dir);
          } else {
            onBtn(act);
          }
        });
      });
    });

    /* 键盘（仅本窗口聚焦时；空格 / ←→） */
    function onKey(e) {
      if (!win.el.classList.contains('active')) return;
      if (e.code === 'Space') { e.preventDefault(); onBtn('play'); }
      if (S.deck >= 0 && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        var tr = curTrack();
        S.t = Math.min(tr.dur, Math.max(0, S.t + (e.code === 'ArrowRight' ? 5 : -5)));
        audio.currentTime = S.t;
        tickUI();
      }
    }
    window.addEventListener('keydown', onKey);

    /* 音量滑杆（iOS 上 audio.volume 被系统忽略，仅 UI 反馈） */
    (function () {
      var hit = $('.tp-vol-hit'), dragging = false;
      function setVol(e) {
        var hitR = hit.getBoundingClientRect();
        S.vol = Math.min(1, Math.max(0, (e.clientX - hitR.left) / hitR.width));
        audio.volume = S.vol;
        $('.tp-vol-fill').setAttribute('d', srr(214, 154, Math.max(5, S.vol * 60), 5, 2));
        $('.tp-vol-knob').setAttribute('cx', (214 + S.vol * 60).toFixed(1));
      }
      hit.addEventListener('pointerdown', function (e) {
        dragging = true;
        hit.setPointerCapture(e.pointerId);
        setVol(e);
      });
      hit.addEventListener('pointermove', function (e) { if (dragging) setVol(e); });
      ['pointerup', 'pointercancel'].forEach(function (ev) {
        hit.addEventListener(ev, function () { dragging = false; });
      });
    })();

    /* 波形 seek（点击/拖动） */
    (function () {
      var wf = $('.tp-wf'), dragging = false;
      function seek(e) {
        var tr = curTrack();
        if (!tr) return;
        var r = wf.getBoundingClientRect();
        S.t = tr.dur * Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        audio.currentTime = S.t;
        tickUI();
      }
      wf.addEventListener('pointerdown', function (e) {
        if (!curTrack()) return;
        dragging = true;
        wf.setPointerCapture(e.pointerId);
        seek(e);
      });
      wf.addEventListener('pointermove', function (e) { if (dragging) seek(e); });
      ['pointerup', 'pointercancel'].forEach(function (ev) {
        wf.addEventListener(ev, function () { dragging = false; });
      });
    })();

    /* 初始画面：第一盘磁带的波形做底纹（灰显） */
    wfData = WIN98_TAPES[0].peaks;
    drawWave(0, '#3a3a46');
  };
})();
