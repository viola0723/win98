<script setup>
// 展览馆壳：无 ?ex= 参数时展示大厅（无字画框轮播），带 ?ex=xxx 时动态加载对应展品。
// 新增展品只需 src/exhibits/ 加 xxx.vue + manifest.js 加一条记录（含 cover 封面），本文件零改动。
// 附加参数：?chrome=0 隐藏返回按钮（屏保等嵌入场景用）。
//
// 大厅设计（2026-08-09 第二轮改版）：极简虚空 + 黑镜倒影 + 单灯追画。
//   · 背景 = 纯 CSS 深色渐变虚空（零图片资产），不要房间/射灯实拍图——灯与画必须同一坐标系
//   · 每幅画 = CSS 复古相框 + 封面画（manifest 的 cover 字段），画下悬浮实时倒影（翻转克隆+渐隐）
//   · 灯光只打给当前选中的画（顶部光锥 + 框周溢光 + 地面光池），跟选中态走，两侧画隐入暗处
//   · 交互：拖拽/左右滑切换，点两侧画 = 选中，点中间画 = 进入展品；PC 支持 ← → Enter 键
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { EXHIBITS } from './exhibits/manifest'
import Review from './Review.vue'

const modules = import.meta.glob('./exhibits/*.vue')
const params = new URLSearchParams(window.location.search)
const exName = params.get('ex')
const bare = params.get('chrome') === '0'
// img2threejs 评审隐藏路由（?review=<模型名>，加载 src/models/，不进 manifest）
const reviewName = params.get('review')
const loader = exName ? modules[`./exhibits/${exName}.vue`] : null

const Exhibit = loader ? defineAsyncComponent(loader) : null
// 大厅只列出确有对应组件的展品（防止 manifest 与文件脱节）
const items = EXHIBITS.filter((e) => modules[`./exhibits/${e.id}.vue`])
const asset = (p) => `${import.meta.env.BASE_URL}${p}`

/* ---------- 画框轮播 ---------- */
const current = ref(0)
const dragX = ref(0) // 拖拽中的实时位移（px），松开归零
const isDown = ref(false)
let startX = 0
let moved = 0

const wrap = (i) => ((i % items.length) + items.length) % items.length

// 每幅画与当前画的环形距离：0 = 居中（有灯），±1 = 左右邻座（隐入暗处）
function offsetOf(i) {
  const n = items.length
  let off = i - current.value
  if (n > 2) {
    if (off > n / 2) off -= n
    if (off < -n / 2) off += n
  }
  return off
}

function frameStyle(i) {
  const off = offsetOf(i)
  const abs = Math.abs(off)
  const x = `calc(-50% + ${off * 38}vmin + ${dragX.value}px)`
  return {
    transform: `translate(${x}, -50%) rotateY(${-off * 14}deg) scale(${off === 0 ? 1 : 0.62})`,
    zIndex: 10 - abs,
    opacity: abs > 1 ? 0 : 1,
    filter: `brightness(${off === 0 ? 1 : 0.5})`,
    pointerEvents: abs > 1 ? 'none' : 'auto',
  }
}

function go(step) {
  current.value = wrap(current.value + step)
}

function openExhibit(i) {
  window.location.href = `?ex=${items[i].id}`
}

// 拖拽/滑动（Pointer Events，双端统一）；位移 < 8px 视为点按
function onPointerDown(e) {
  isDown.value = true
  startX = e.clientX
  moved = 0
  e.currentTarget.setPointerCapture(e.pointerId)
}
function onPointerMove(e) {
  if (!isDown.value) return
  moved = e.clientX - startX
  dragX.value = moved
}
function onPointerUp(e) {
  if (!isDown.value) return
  isDown.value = false
  dragX.value = 0
  if (Math.abs(moved) >= 8) {
    if (Math.abs(moved) > 60) go(moved < 0 ? 1 : -1)
    return // 拖拽不触发点按
  }
  // 墙容器做了 pointer capture，pointerup 的 target 恒为容器自身，
  // 需用 elementFromPoint 找实际点中的画框
  const hit = document.elementFromPoint(e.clientX, e.clientY)
  const idx = Number(hit?.closest('[data-idx]')?.dataset.idx)
  if (Number.isNaN(idx)) return
  if (offsetOf(idx) === 0) openExhibit(idx)
  else current.value = wrap(idx)
}

function onKeydown(e) {
  if (Exhibit) return
  if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'Enter') openExhibit(current.value)
}

onMounted(() => {
  if (!Exhibit) {
    document.title = '展览馆 · 旧电脑'
    window.addEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!-- img2threejs 评审隐藏路由 -->
  <Review v-if="reviewName" />

  <!-- 展品页：全屏展出 + 左上角返回大厅（bare = chrome=0 嵌入模式，透传给展品） -->
  <template v-else-if="Exhibit">
    <component :is="Exhibit" :bare="bare" />
    <a
      v-if="!bare"
      href="./index.html"
      aria-label="返回大厅"
      class="fixed top-3 left-3 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/35 text-slate-300 backdrop-blur-sm transition hover:border-white/25 hover:text-white"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
    </a>
  </template>

  <!-- 大厅：虚空 + 画框轮播 + 单灯追画 + 黑镜倒影 -->
  <div v-else class="lobby relative h-dvh w-full overflow-hidden select-none">
    <!-- 画框墙（全屏拖拽层） -->
    <div
      class="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      style="perspective: 1400px"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        v-for="(e, i) in items"
        :key="e.id"
        :data-idx="i"
        class="frame absolute left-1/2 top-[38%]"
        :class="[isDown ? 'transition-none' : 'transition-all duration-500 ease-out', { lit: offsetOf(i) === 0 }]"
        :style="frameStyle(i)"
      >
        <!-- 顶部光锥（只有选中的画亮；blur 挂外层，防止 clip-path 裁掉模糊） -->
        <div class="cone"><i></i></div>
        <div class="frame-mat">
          <img :src="asset(e.cover)" :alt="e.title" draggable="false" class="block h-full w-full object-cover" />
        </div>
        <!-- 地面光池（只有选中的画亮） -->
        <div class="pool"></div>
        <!-- 黑镜倒影（随画框变换，侧画自动被 brightness 压暗） -->
        <div class="reflect">
          <img :src="asset(e.cover)" alt="" draggable="false" class="block w-full" />
        </div>
      </div>
    </div>

    <!-- 左右切换（纯图标，全馆无字） -->
    <div class="absolute inset-x-0 bottom-6 flex justify-center gap-5">
      <button
        type="button"
        aria-label="上一幅"
        class="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 text-slate-300 backdrop-blur-sm transition hover:border-white/35 hover:text-white"
        @click="go(-1)"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <button
        type="button"
        aria-label="下一幅"
        class="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 text-slate-300 backdrop-blur-sm transition hover:border-white/35 hover:text-white"
        @click="go(1)"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 极简虚空：纯 CSS 渐变，零图片资产 */
.lobby {
  background: radial-gradient(120% 90% at 50% 22%, #101527 0%, #090c16 52%, #04050a 100%);
}

/* 复古画框：深木外框 + 做旧金线 + 卡纸内衬，纯 CSS 无图片资源 */
.frame {
  width: min(46vw, 52vh);
  padding: min(1.6vmin, 14px);
  background: linear-gradient(145deg, #4a3520 0%, #2a1d10 45%, #1d130a 100%);
  border-radius: 3px;
  box-shadow:
    0 24px 50px rgba(0, 0, 0, 0.65),
    0 6px 16px rgba(0, 0, 0, 0.5),
    inset 0 1px 1px rgba(255, 220, 160, 0.25),
    inset 0 -1px 2px rgba(0, 0, 0, 0.6),
    0 0 90px 8px rgba(255, 232, 180, 0); /* 溢光占位，lit 时点亮，保证过渡平滑 */
}
.frame.lit {
  box-shadow:
    0 24px 50px rgba(0, 0, 0, 0.65),
    0 6px 16px rgba(0, 0, 0, 0.5),
    inset 0 1px 1px rgba(255, 220, 160, 0.25),
    inset 0 -1px 2px rgba(0, 0, 0, 0.6),
    0 0 90px 8px rgba(255, 232, 180, 0.15);
}
.frame-mat {
  height: 100%;
  padding: min(2.4vmin, 22px);
  background: linear-gradient(180deg, #efe9da 0%, #e3dbc8 100%);
  box-shadow:
    inset 0 0 0 2px #b08d4f,
    inset 0 2px 6px rgba(0, 0, 0, 0.35);
}
.frame-mat img {
  aspect-ratio: 4 / 3;
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.4);
}

/* 顶部光锥：从虚空上方落下，只给选中的画 */
.cone {
  position: absolute;
  bottom: calc(100% - 1vmin);
  left: -10%;
  width: 120%;
  height: 30vmin;
  filter: blur(14px); /* blur 必须在 clip-path 外层，否则模糊被裁成硬边 */
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
}
.cone i {
  display: block;
  width: 100%;
  height: 100%;
  clip-path: polygon(46% 0, 54% 0, 105% 100%, -5% 100%);
  background: linear-gradient(
    to bottom,
    rgba(255, 240, 205, 0) 0%,
    rgba(255, 240, 205, 0.05) 55%,
    rgba(255, 240, 205, 0.16) 100%
  );
}
.frame.lit .cone {
  opacity: 1;
}

/* 地面光池：光落在「镜面地板」上的位置，只给选中的画 */
.pool {
  position: absolute;
  top: calc(100% + 1.5vmin);
  left: -35%;
  width: 170%;
  height: 9vmin;
  background: radial-gradient(ellipse at center, rgba(255, 240, 205, 0.3) 0%, rgba(255, 240, 205, 0) 65%);
  filter: blur(9px);
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
}
.frame.lit .pool {
  opacity: 1;
}

/* 黑镜倒影：封面翻转克隆 + 渐隐蒙版，作为画框子元素天然跟随轮播变换 */
.reflect {
  position: absolute;
  top: calc(100% + 2.5vmin);
  left: 0;
  width: 100%;
  padding: 3px;
  background: #171009;
  opacity: 0.55;
  filter: blur(1px) saturate(0.85);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.75) 0%, transparent 72%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.75) 0%, transparent 72%);
}
.reflect img {
  aspect-ratio: 4 / 3;
  object-fit: cover;
  transform: scaleY(-1);
}
</style>
