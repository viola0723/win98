/* ============================================================
 * 任务栏：开始按钮 / 开始菜单 / 任务按钮 / 时钟 / 关机彩蛋
 * ============================================================ */
(function () {
  'use strict';

  var startMenu, startButton, taskButtons, clockEl, shutdownOverlay;

  /* ---------- 时钟 ---------- */
  function tickClock() {
    var now = new Date();
    clockEl.textContent =
      ('0' + now.getHours()).slice(-2) + ':' +
      ('0' + now.getMinutes()).slice(-2);
  }

  /* ---------- 任务按钮（窗口状态同步入口，由 windowManager 触发） ---------- */
  function syncTaskButtons() {
    var wins = window.WindowManager.list();
    // 找出当前最上层的可见窗口
    var top = null;
    wins.forEach(function (h) {
      if (!h.minimized && (!top || Number(h.el.style.zIndex) > Number(top.el.style.zIndex))) {
        top = h;
      }
    });

    taskButtons.innerHTML = '';
    wins.forEach(function (h) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'task-button' + (h === top ? ' active' : '');

      var img = document.createElement('img');
      img.src = h.module.icon;
      img.alt = '';
      var text = document.createElement('span');
      text.textContent = h.module.title;

      btn.appendChild(img);
      btn.appendChild(text);

      btn.addEventListener('click', function () {
        if (h.minimized) {
          window.WindowManager.focus(h);       // 还原
        } else if (h === top) {
          window.WindowManager.minimize(h);    // 已是前台 → 最小化
        } else {
          window.WindowManager.focus(h);       // 提到前台
        }
      });

      taskButtons.appendChild(btn);
    });
  }

  /* ---------- 开始菜单 ---------- */
  function buildStartMenu() {
    var list = document.getElementById('start-menu-items');
    list.innerHTML = '';

    (window.WIN98_MODULES || []).forEach(function (m) {
      if (m.showInStartMenu === false) return;
      var li = document.createElement('li');
      li.tabIndex = 0;

      var img = document.createElement('img');
      img.src = m.icon;
      img.alt = '';
      li.appendChild(img);
      li.appendChild(document.createTextNode(m.title));

      li.addEventListener('click', function () {
        closeStartMenu();
        window.WIN98_DESKTOP.openModule(m);
      });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          closeStartMenu();
          window.WIN98_DESKTOP.openModule(m);
        }
      });
      list.appendChild(li);
    });

    // 屏幕保护（手动预览，触发逻辑见 js/screensaver.js）
    var saver = document.createElement('li');
    saver.tabIndex = 0;
    var svImg = document.createElement('img');
    svImg.src = 'assets/icons/saver.png';
    svImg.alt = '';
    saver.appendChild(svImg);
    saver.appendChild(document.createTextNode('屏幕保护'));
    saver.addEventListener('click', function () {
      closeStartMenu();
      if (window.WIN98_SAVER) window.WIN98_SAVER.show();
    });
    list.appendChild(saver);

    // 分隔线 + 关机
    var sep = document.createElement('li');
    sep.className = 'menu-separator';
    list.appendChild(sep);

    var shutdown = document.createElement('li');
    shutdown.tabIndex = 0;
    var sdImg = document.createElement('img');
    sdImg.src = 'assets/icons/shutdown.png';
    sdImg.alt = '';
    shutdown.appendChild(sdImg);
    shutdown.appendChild(document.createTextNode('关机(U)...'));
    shutdown.addEventListener('click', function () {
      closeStartMenu();
      shutdownOverlay.hidden = false;
    });
    list.appendChild(shutdown);
  }

  function openStartMenu() {
    startMenu.hidden = false;
    startButton.classList.add('active');
  }

  function closeStartMenu() {
    startMenu.hidden = true;
    startButton.classList.remove('active');
  }

  function toggleStartMenu() {
    if (startMenu.hidden) openStartMenu();
    else closeStartMenu();
  }

  function init() {
    startMenu = document.getElementById('start-menu');
    startButton = document.getElementById('start-button');
    taskButtons = document.getElementById('task-buttons');
    clockEl = document.getElementById('clock');
    shutdownOverlay = document.getElementById('shutdown-overlay');

    buildStartMenu();
    tickClock();
    setInterval(tickClock, 5000);

    startButton.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleStartMenu();
    });

    // 点击菜单外部时收起
    document.addEventListener('click', function (e) {
      if (!startMenu.hidden && !startMenu.contains(e.target) && e.target !== startButton) {
        closeStartMenu();
      }
    });
    // 触屏补一道：iOS 真机 click 可能不派发，点到菜单外（含非按钮区域）也该收起；
    // 开始按钮自身走上面的 click 切换（stopPropagation 到不了这里），这里仅判断包含关系兜底
    document.addEventListener('pointerup', function (e) {
      if (!startMenu.hidden && !startMenu.contains(e.target) && !startButton.contains(e.target)) {
        closeStartMenu();
      }
    });

    // 关机彩蛋：点击任意处“重新开机”
    shutdownOverlay.addEventListener('click', function () {
      shutdownOverlay.hidden = true;
    });

    // 挂到全局，供 windowManager 在窗口状态变化时调用
    window.WIN98_TASKBAR = { sync: syncTaskButtons };
  }

  window.WIN98_TASKBAR_INIT = init;
})();
