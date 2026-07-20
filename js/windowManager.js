/* ============================================================
 * 窗口系统：创建 / 拖拽 / 聚焦 / 最小化 / 最大化 / 关闭
 * 对外暴露 window.WindowManager
 * ============================================================ */
(function () {
  'use strict';

  var LAYER_ID = 'windows';
  var MOBILE_BREAKPOINT = 640;

  var zCounter = 100;          // 递增的置顶序号
  var cascadeCount = 0;        // 新窗口级联偏移计数
  var openWindows = [];        // 所有窗口句柄

  function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function getLayer() {
    return document.getElementById(LAYER_ID);
  }

  /* 通知任务栏刷新（任务栏加载后会把同步函数挂到 window.WIN98_TASKBAR.sync） */
  function notifyTaskbar() {
    if (window.WIN98_TASKBAR && typeof window.WIN98_TASKBAR.sync === 'function') {
      window.WIN98_TASKBAR.sync();
    }
  }

  function focusWindow(handle) {
    openWindows.forEach(function (h) {
      h.el.classList.toggle('active', h === handle);
    });
    handle.el.style.zIndex = ++zCounter;
    if (handle.minimized) {
      handle.minimized = false;
      handle.el.style.display = '';
    }
    notifyTaskbar();
  }

  function minimizeWindow(handle) {
    handle.minimized = true;
    handle.el.style.display = 'none';
    // 焦点让给当前最上层的可见窗口
    var next = visibleTopMost();
    if (next) {
      next.el.style.zIndex = ++zCounter;
      next.el.classList.add('active');
    }
    handle.el.classList.remove('active');
    notifyTaskbar();
  }

  function visibleTopMost() {
    var best = null;
    openWindows.forEach(function (h) {
      if (!h.minimized && (!best || Number(h.el.style.zIndex) > Number(best.el.style.zIndex))) {
        best = h;
      }
    });
    return best;
  }

  function toggleMaximize(handle) {
    if (handle.maximized) {
      handle.el.classList.remove('maximized');
      var r = handle.prevRect;
      handle.el.style.left = r.x + 'px';
      handle.el.style.top = r.y + 'px';
      handle.el.style.width = r.w + 'px';
      handle.el.style.height = r.h + 'px';
      handle.maximized = false;
      setMaximizeButton(handle, false);
    } else {
      handle.prevRect = {
        x: handle.el.offsetLeft,
        y: handle.el.offsetTop,
        w: handle.el.offsetWidth,
        h: handle.el.offsetHeight
      };
      handle.el.classList.add('maximized');
      handle.maximized = true;
      setMaximizeButton(handle, true);
    }
    focusWindow(handle);
  }

  function setMaximizeButton(handle, isMaximized) {
    var btn = handle.el.querySelector('[aria-label="Maximize"], [aria-label="Restore"]');
    if (btn) btn.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
  }

  function closeWindow(handle) {
    var idx = openWindows.indexOf(handle);
    if (idx !== -1) openWindows.splice(idx, 1);
    handle.el.remove();
    var next = visibleTopMost();
    if (next) focusWindow(next);
    notifyTaskbar();
  }

  /* 标题栏拖拽（Pointer Events：鼠标 / 触屏通用） */
  function enableDrag(handle, titleBar) {
    var startX, startY, originX, originY, dragging = false;

    titleBar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('.title-bar-controls')) return; // 点到按钮不拖
      if (handle.maximized) return;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      originX = handle.el.offsetLeft;
      originY = handle.el.offsetTop;
      titleBar.setPointerCapture(e.pointerId);
      document.body.classList.add('dragging');
      focusWindow(handle);
    });

    titleBar.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var layer = getLayer();
      var newX = originX + e.clientX - startX;
      var newY = originY + e.clientY - startY;
      // 限制在窗口层范围内（允许左右稍微拖出去一点，但标题栏要够得着）
      newX = Math.max(-handle.el.offsetWidth + 60, Math.min(newX, layer.clientWidth - 60));
      newY = Math.max(0, Math.min(newY, layer.clientHeight - 30));
      handle.el.style.left = newX + 'px';
      handle.el.style.top = newY + 'px';
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('dragging');
      if (titleBar.hasPointerCapture && titleBar.hasPointerCapture(e.pointerId)) {
        titleBar.releasePointerCapture(e.pointerId);
      }
    }
    titleBar.addEventListener('pointerup', endDrag);
    titleBar.addEventListener('pointercancel', endDrag);

    // 双击标题栏 = 最大化 / 还原
    titleBar.addEventListener('dblclick', function (e) {
      if (e.target.closest('.title-bar-controls')) return;
      toggleMaximize(handle);
    });
  }

  /**
   * 打开一个模块窗口（单例：已打开则聚焦）
   * @param {Object} moduleConfig config.js 里 WIN98_MODULES 的一条记录
   * @returns {Object} 窗口句柄
   */
  function open(moduleConfig) {
    // 单例检查
    var existing = null;
    openWindows.forEach(function (h) {
      if (h.id === moduleConfig.id) existing = h;
    });
    if (existing) {
      focusWindow(existing);
      return existing;
    }

    var layer = getLayer();

    // --- 组装 DOM（结构遵循 98.css 约定） ---
    var el = document.createElement('div');
    el.className = 'window app-window';
    el.dataset.moduleId = moduleConfig.id;

    var titleBar = document.createElement('div');
    titleBar.className = 'title-bar';

    var titleText = document.createElement('div');
    titleText.className = 'title-bar-text';
    var icon = document.createElement('img');
    icon.src = moduleConfig.icon;
    icon.alt = '';
    titleText.appendChild(icon);
    titleText.appendChild(document.createTextNode(moduleConfig.title));

    var controls = document.createElement('div');
    controls.className = 'title-bar-controls';

    var btnMin = document.createElement('button');
    btnMin.setAttribute('aria-label', 'Minimize');
    var btnMax = document.createElement('button');
    btnMax.setAttribute('aria-label', 'Maximize');
    var btnClose = document.createElement('button');
    btnClose.setAttribute('aria-label', 'Close');
    controls.appendChild(btnMin);
    controls.appendChild(btnMax);
    controls.appendChild(btnClose);

    titleBar.appendChild(titleText);
    titleBar.appendChild(controls);

    var body = document.createElement('div');
    body.className = 'window-body';

    el.appendChild(titleBar);
    el.appendChild(body);
    layer.appendChild(el);

    // --- 句柄 ---
    var handle = {
      id: moduleConfig.id,
      module: moduleConfig,
      el: el,
      body: body,
      minimized: false,
      maximized: false,
      prevRect: null,
      focus: function () { focusWindow(handle); },
      minimize: function () { minimizeWindow(handle); },
      toggleMaximize: function () { toggleMaximize(handle); },
      close: function () { closeWindow(handle); }
    };
    openWindows.push(handle);

    // --- 尺寸与初始位置 ---
    var w = Math.min(moduleConfig.width || 420, layer.clientWidth);
    var h = Math.min(moduleConfig.height || 320, layer.clientHeight);
    var offset = (cascadeCount++ % 8) * 24;
    // x 起点避开左侧图标列（图标列宽约 90px）
    var x = Math.max(0, Math.min(100 + offset, layer.clientWidth - w));
    var y = Math.max(0, Math.min(20 + offset, layer.clientHeight - h));
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    // --- 事件 ---
    btnMin.addEventListener('click', function () { minimizeWindow(handle); });
    btnMax.addEventListener('click', function () { toggleMaximize(handle); });
    btnClose.addEventListener('click', function () { closeWindow(handle); });
    el.addEventListener('pointerdown', function () { focusWindow(handle); });
    enableDrag(handle, titleBar);

    // 手机端默认最大化
    if (isMobile()) {
      toggleMaximize(handle);
    }

    focusWindow(handle);

    // --- 填充内容 ---
    var app = window.WIN98_APPS && window.WIN98_APPS[moduleConfig.app];
    if (typeof app === 'function') {
      app(body, handle, moduleConfig);
    } else {
      body.textContent = '模块 "' + moduleConfig.app + '" 未在 js/apps.js 中注册。';
    }

    return handle;
  }

  window.WindowManager = {
    open: open,
    focus: focusWindow,
    minimize: minimizeWindow,
    toggleMaximize: toggleMaximize,
    close: closeWindow,
    list: function () { return openWindows.slice(); },
    isMobile: isMobile
  };
})();
