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
  WIN98_APPS['about'] = function (bodyEl) {
    bodyEl.innerHTML =
      '<div class="app-about">' +
      '  <h3>欢迎来到我的桌面！</h3>' +
      '  <p>这是一个仿 Windows 98 风格的个人网站。桌面上的每个图标都是一个功能模块或一个链接入口，以后会不断增加新图标、新功能。</p>' +
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
      '      <li>操作系统：Win98 Web Edition 1.0</li>' +
      '      <li>内存：640K（对任何人来说都应该够用了）</li>' +
      '      <li>硬盘：剩余空间 取决于站长的心情</li>' +
      '    </ul>' +
      '  </fieldset>' +
      '</div>';
  };

  /* ---------------- 记事本（localStorage 自动保存） ---------------- */
  WIN98_APPS['notepad'] = function (bodyEl) {
    var STORAGE_KEY = 'win98.notepad.content';

    bodyEl.innerHTML =
      '<div class="app-notepad">' +
      '  <div class="sunken-panel"><textarea spellcheck="false" placeholder="在这里写点什么……（会自动保存）"></textarea></div>' +
      '  <div class="status-bar">' +
      '    <p class="status-bar-field" data-role="status">就绪</p>' +
      '    <p class="status-bar-field" data-role="count">0 个字符</p>' +
      '  </div>' +
      '</div>';

    var textarea = bodyEl.querySelector('textarea');
    var statusEl = bodyEl.querySelector('[data-role="status"]');
    var countEl = bodyEl.querySelector('[data-role="count"]');
    var saveTimer = null;

    function refreshCount() {
      countEl.textContent = textarea.value.length + ' 个字符';
    }

    try {
      textarea.value = localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) { /* localStorage 不可用时静默降级 */ }
    refreshCount();

    textarea.addEventListener('input', function () {
      refreshCount();
      statusEl.textContent = '正在输入……';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try {
          localStorage.setItem(STORAGE_KEY, textarea.value);
          var now = new Date();
          statusEl.textContent = '已自动保存 ' +
            ('0' + now.getHours()).slice(-2) + ':' +
            ('0' + now.getMinutes()).slice(-2) + ':' +
            ('0' + now.getSeconds()).slice(-2);
        } catch (e) {
          statusEl.textContent = '保存失败（浏览器存储不可用）';
        }
      }, 400);
    });

    textarea.focus();
  };

  /* ---------------- 计算器 ---------------- */
  WIN98_APPS['calculator'] = function (bodyEl) {
    bodyEl.innerHTML =
      '<div class="app-calculator">' +
      '  <input class="calc-display" type="text" value="0" readonly aria-label="计算结果显示">' +
      '  <div class="calc-grid">' +
      ['C', '←', '±', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '=']
        .map(function (label) { return '<button type="button" data-key="' + label + '">' + label + '</button>'; })
        .join('') +
      '  </div>' +
      '</div>';

    var display = bodyEl.querySelector('.calc-display');
    var current = '0';      // 当前输入
    var stored = null;      // 暂存的操作数
    var pendingOp = null;   // 待执行的运算符
    var waiting = false;    // 是否等待输入新数字

    function show(value) {
      display.value = value;
    }

    function calculate(a, b, op) {
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '×': return a * b;
        case '÷':
          if (b === 0) return null;
          return a / b;
      }
      return b;
    }

    function format(num) {
      // 去掉浮点误差长尾
      return String(parseFloat(num.toPrecision(12)));
    }

    function inputDigit(d) {
      if (waiting) {
        current = d;
        waiting = false;
      } else {
        current = current === '0' ? d : current + d;
      }
      show(current);
    }

    function inputDot() {
      if (waiting) {
        current = '0.';
        waiting = false;
      } else if (current.indexOf('.') === -1) {
        current += '.';
      }
      show(current);
    }

    function applyOp(nextOp) {
      var value = parseFloat(current);
      if (pendingOp && !waiting) {
        var result = calculate(stored, value, pendingOp);
        if (result === null) {
          show('除数不能为零');
          current = '0'; stored = null; pendingOp = null; waiting = true;
          return;
        }
        current = format(result);
        show(current);
        value = result;
      }
      stored = value;
      pendingOp = nextOp;
      waiting = true;
    }

    function equals() {
      if (pendingOp === null || stored === null) return;
      var result = calculate(stored, parseFloat(current), pendingOp);
      if (result === null) {
        show('除数不能为零');
        current = '0';
      } else {
        current = format(result);
        show(current);
      }
      stored = null;
      pendingOp = null;
      waiting = true;
    }

    bodyEl.querySelector('.calc-grid').addEventListener('click', function (e) {
      var key = e.target.dataset && e.target.dataset.key;
      if (!key) return;
      if (/^[0-9]$/.test(key)) inputDigit(key);
      else if (key === '.') inputDot();
      else if (key === 'C') { current = '0'; stored = null; pendingOp = null; waiting = false; show(current); }
      else if (key === '←') { current = current.length > 1 ? current.slice(0, -1) : '0'; show(current); }
      else if (key === '±') { current = format(-parseFloat(current) || 0); show(current); }
      else if (key === '=') equals();
      else applyOp(key);
    });
  };

  /* ---------------- 回收站（彩蛋） ---------------- */
  WIN98_APPS['recycle'] = function (bodyEl, win) {
    bodyEl.innerHTML =
      '<div class="app-recycle">' +
      '  <img src="assets/icons/bin.png" alt="回收站">' +
      '  <p>回收站是空的。</p>' +
      '  <p>就像新电脑开机的第一天，干干净净。</p>' +
      '  <button type="button" data-role="ok" style="min-width:88px">确定</button>' +
      '</div>';
    bodyEl.querySelector('[data-role="ok"]').addEventListener('click', function () {
      win.close();
    });
  };
})();
