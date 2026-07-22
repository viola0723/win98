/* ============================================================
 * 功能模块注册表 —— 每个窗口型桌面图标对应这里的一个渲染函数
 * 新增模块：WIN98_APPS['模块id'] = function (bodyEl, win, cfg) { ... }
 *   bodyEl：窗口内容区域 DOM（.window-body）
 *   win：窗口句柄（win.close() 可关闭窗口）
 *   cfg：config.js 中该模块的配置对象
 * ============================================================ */
window.WIN98_APPS = window.WIN98_APPS || {};
(function () {
  'use strict';

  /* ---------------- 我的电脑（关于本站） ---------------- */
  /* 复古的壳 × 现代的芯：窗口头部「星空跃迁 + 乱序解码标题」为原生 Canvas/JS 实现、
     零依赖，灵感来自 inspira-ui 的 warp-background / hyper-text（MIT 协议） */

  /* 星空跃迁：恒星从画面中心向外飞散，近大远小带拖尾；窗口关闭后自动停止 */
  function startAboutStarfield(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var STAR_COUNT = 160;
    var W = 0, H = 0, CX = 0, CY = 0;
    var stars = [];

    function resize() {
      var r = canvas.parentElement.getBoundingClientRect();
      W = Math.max(1, Math.floor(r.width));
      H = Math.max(1, Math.floor(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      CX = W / 2;
      CY = H / 2;
      ctx.fillStyle = '#020412';
      ctx.fillRect(0, 0, W, H);
    }

    function spawn(s) {
      s.x = Math.random() * 2 - 1;       // -1 ~ 1
      s.y = Math.random() * 2 - 1;
      s.z = Math.random() * 0.9 + 0.1;   // 深度：越小越近
      s.pz = s.z;
      return s;
    }

    for (var i = 0; i < STAR_COUNT; i++) stars.push(spawn({}));

    window.addEventListener('resize', resize);
    resize();

    function frame() {
      // canvas 脱离文档（窗口已关闭）则停止循环并摘掉 resize 监听
      if (!canvas.isConnected) {
        window.removeEventListener('resize', resize);
        return;
      }
      ctx.fillStyle = 'rgba(2, 4, 18, 0.35)'; // 半透明覆盖形成拖尾
      ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.pz = s.z;
        s.z -= 0.008;
        if (s.z <= 0.02) { spawn(s); continue; }
        var sx = CX + (s.x / s.z) * CX;
        var sy = CY + (s.y / s.z) * CY;
        var px = CX + (s.x / s.pz) * CX;
        var py = CY + (s.y / s.pz) * CY;
        if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) { spawn(s); continue; }
        var near = 1 - s.z;
        ctx.strokeStyle = 'rgba(170, 215, 255,' + (0.3 + near * 0.7).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.5, near * 2.4);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* 乱序解码：标题从随机字符逐位收敛为最终文字 */
  function startAboutScramble(el) {
    var finalText = el.getAttribute('data-text') || el.textContent;
    var glyphs = '01<>/\\{}[]#$%&*+-=~';
    var frame = 0;
    var TOTAL = 55;
    function tick() {
      if (!el.isConnected) return;
      frame++;
      var progress = frame / TOTAL;
      var out = '';
      for (var i = 0; i < finalText.length; i++) {
        var reveal = 0.2 + (i / finalText.length) * 0.75;
        out += progress >= reveal
          ? finalText[i]
          : glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      el.textContent = out;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = finalText;
    }
    requestAnimationFrame(tick);
  }

  WIN98_APPS['about'] = function (bodyEl) {
    bodyEl.innerHTML =
      '<div class="app-about">' +
      '  <div class="app-about-banner">' +
      '    <canvas class="app-about-stars"></canvas>' +
      '    <div class="app-about-banner-text">' +
      '      <div class="app-about-glitch" data-text="旧电脑">旧电脑</div>' +
      '      <div class="app-about-sub">OLD COMPUTER · EST. 1998</div>' +
      '    </div>' +
      '  </div>' +
      '  <p>这是一台 1998 年的旧电脑，里面装的却是 AI 时代的新作品——游戏、文章、画作、音乐、动画……都会以桌面图标的形式陆续住进来。复古的壳，现代的芯，要的就是这个反差。</p>' +
      '  <fieldset>' +
      '    <legend>使用说明</legend>' +
      '    <ul>' +
      '      <li>双击桌面图标，打开对应的功能窗口或链接</li>' +
      '      <li>拖动标题栏可以移动窗口，双击标题栏最大化</li>' +
      '      <li>点击左下角的「开始」按钮，可以看到全部功能</li>' +
      '      <li>手机上访问时，窗口会自动全屏显示</li>' +
      '    </ul>' +
      '  </fieldset>' +
      '  <fieldset>' +
      '    <legend>系统信息</legend>' +
      '    <ul>' +
      '      <li>操作系统：旧电脑 OS 1.0（Win98 兼容模式）</li>' +
      '      <li>内存：640K（对任何人来说都应该够用了）</li>' +
      '      <li>硬盘：剩余空间 取决于站长的心情</li>' +
      '    </ul>' +
      '  </fieldset>' +
      '</div>';

    startAboutStarfield(bodyEl.querySelector('.app-about-stars'));
    startAboutScramble(bodyEl.querySelector('.app-about-glitch'));
  };
})();
