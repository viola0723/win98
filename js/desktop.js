/* ============================================================
 * 桌面：按 js/config.js 的配置渲染图标，处理选中与打开
 * 鼠标：单击选中、双击打开；触屏：点按选中、再点一次打开
 * ============================================================ */
(function () {
  'use strict';

  var lastTapId = null;

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

  /* 触屏第二击在 pointerup 里同步开了窗，但浏览器随后派发的合成 click
     会落在「图标原屏幕位置」——此时那里已经是新窗口的内容（Tab/格子/按钮），
     造成误点（真实案例：双触扫雷直接点进了「寻找时间胶囊」Tab）。
     开窗后吞掉紧随的一次 click（500ms 保险期内没来就撤掉） */
  function suppressNextClick() {
    function swallow(e) {
      e.stopPropagation();
      e.preventDefault();
    }
    document.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(function () {
      document.removeEventListener('click', swallow, { capture: true });
    }, 500);
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

    // 触屏：点按选中；再点一次已选中的图标即打开。
    // 不限时间窗——手机上「快速双击」节奏不可靠，限时会导致怎么点都打不开
    el.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'touch') return;
      var wasSelected = el.classList.contains('selected');
      selectIcon(el);
      if (wasSelected && lastTapId === moduleConfig.id) {
        lastTapId = null;
        suppressNextClick();
        openModule(moduleConfig);
      } else {
        lastTapId = moduleConfig.id;
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
