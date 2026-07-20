/* ============================================================
 * 桌面：按 js/config.js 的配置渲染图标，处理选中与打开
 * 鼠标：单击选中、双击打开；触屏：点按选中、再点一次打开
 * ============================================================ */
(function () {
  'use strict';

  var DOUBLE_TAP_MS = 450;
  var lastTapId = null;
  var lastTapTime = 0;

  function getDesktop() {
    return document.getElementById('desktop');
  }

  /* 打开一个模块（供桌面图标和开始菜单共用） */
  function openModule(moduleConfig) {
    if (moduleConfig.type === 'link') {
      window.open(moduleConfig.url, '_blank', 'noopener');
    } else {
      window.WindowManager.open(moduleConfig);
    }
  }

  function clearSelection() {
    var selected = getDesktop().querySelectorAll('.desktop-icon.selected');
    for (var i = 0; i < selected.length; i++) selected[i].classList.remove('selected');
  }

  function selectIcon(el) {
    clearSelection();
    el.classList.add('selected');
  }

  function createIcon(moduleConfig) {
    var el = document.createElement('div');
    el.className = 'desktop-icon';
    el.dataset.id = moduleConfig.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', moduleConfig.title);

    var img = document.createElement('img');
    img.src = moduleConfig.icon;
    img.alt = '';
    img.draggable = false;

    var label = document.createElement('span');
    label.className = 'icon-label';
    label.textContent = moduleConfig.title;

    el.appendChild(img);
    el.appendChild(label);

    // 鼠标：单击选中，双击打开
    el.addEventListener('click', function (e) {
      if (e.pointerType === 'touch') return; // 触屏走 pointerup 逻辑
      selectIcon(el);
    });
    el.addEventListener('dblclick', function () {
      openModule(moduleConfig);
    });

    // 触屏：点按选中；在已选中的图标上再点一次（间隔较短）打开
    el.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'touch') return;
      var now = Date.now();
      var wasSelected = el.classList.contains('selected');
      selectIcon(el);
      if (wasSelected && lastTapId === moduleConfig.id && now - lastTapTime < DOUBLE_TAP_MS) {
        openModule(moduleConfig);
        lastTapId = null;
      } else {
        lastTapId = moduleConfig.id;
        lastTapTime = now;
      }
    });

    // 键盘：回车打开
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') openModule(moduleConfig);
    });

    return el;
  }

  function render() {
    var desktop = getDesktop();
    desktop.innerHTML = '';
    (window.WIN98_MODULES || []).forEach(function (m) {
      desktop.appendChild(createIcon(m));
    });

    // 点击桌面空白处取消选中
    desktop.addEventListener('click', function (e) {
      if (e.target === desktop) clearSelection();
    });
  }

  window.WIN98_DESKTOP = {
    render: render,
    openModule: openModule
  };
})();
