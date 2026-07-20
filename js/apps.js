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

  /* ---------------- 留言本（localStorage 持久化） ---------------- */
  WIN98_APPS['guestbook'] = function (bodyEl) {
    var STORAGE_KEY = 'win98.guestbook.messages';
    var NAME_KEY = 'win98.guestbook.name';
    var MAX_MESSAGES = 200;   // 超出后丢弃最早的留言，避免撑爆 localStorage

    bodyEl.innerHTML =
      '<div class="app-guestbook">' +
      '  <div class="sunken-panel guestbook-list" data-role="list"></div>' +
      '  <div class="guestbook-form">' +
      '    <div class="field-row">' +
      '      <label for="gb-name">昵称</label>' +
      '      <input id="gb-name" type="text" maxlength="20" placeholder="匿名" data-role="name">' +
      '    </div>' +
      '    <div class="field-row">' +
      '      <input type="text" maxlength="200" placeholder="写点什么……" data-role="text">' +
      '      <button type="button" data-role="submit">提交</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="status-bar">' +
      '    <p class="status-bar-field" data-role="status">就绪</p>' +
      '    <p class="status-bar-field" data-role="count">共 0 条留言</p>' +
      '  </div>' +
      '</div>';

    var listEl = bodyEl.querySelector('[data-role="list"]');
    var nameInput = bodyEl.querySelector('[data-role="name"]');
    var textInput = bodyEl.querySelector('[data-role="text"]');
    var statusEl = bodyEl.querySelector('[data-role="status"]');
    var countEl = bodyEl.querySelector('[data-role="count"]');

    var messages = [];
    try {
      messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(messages)) messages = [];
      nameInput.value = localStorage.getItem(NAME_KEY) || '';
    } catch (e) { /* localStorage 不可用时静默降级 */ }

    function save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        return true;
      } catch (e) {
        return false;
      }
    }

    function formatTime(ts) {
      var d = new Date(ts);
      return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function renderList() {
      listEl.innerHTML = '';
      if (!messages.length) {
        var empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = '还没有留言，来抢沙发！';
        listEl.appendChild(empty);
      } else {
        messages.forEach(function (m) {
          var item = document.createElement('div');
          item.className = 'guestbook-item';
          var head = document.createElement('p');
          head.className = 'guestbook-head';
          head.textContent = m.name + ' · ' + formatTime(m.ts);
          var text = document.createElement('p');
          text.className = 'guestbook-text';
          text.textContent = m.text;   // 一律 textContent 写入，杜绝注入
          item.appendChild(head);
          item.appendChild(text);
          listEl.appendChild(item);
        });
      }
      countEl.textContent = '共 ' + messages.length + ' 条留言';
      listEl.scrollTop = listEl.scrollHeight;
    }

    function submit() {
      var text = textInput.value.trim();
      if (!text) {
        statusEl.textContent = '留言内容不能为空';
        return;
      }
      var name = nameInput.value.trim() || '匿名';
      messages.push({ name: name, text: text, ts: Date.now() });
      if (messages.length > MAX_MESSAGES) messages.shift();
      if (save()) {
        statusEl.textContent = '留言成功';
        try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
      } else {
        statusEl.textContent = '保存失败（浏览器存储不可用）';
      }
      textInput.value = '';
      renderList();
      textInput.focus();
    }

    bodyEl.querySelector('[data-role="submit"]').addEventListener('click', submit);
    textInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });

    renderList();
    textInput.focus();
  };
})();
