<script setup>
// 展品 001 · 流星雨：全屏深色舞台 + inspira-ui Meteors 特效
import { onMounted, reactive, ref } from 'vue'
import Meteors from '../components/inspira/Meteors.vue'

onMounted(() => {
  document.title = '展品 001 · 流星雨'
})

// 指针视差：标题组随指针轻微漂移（Pointer Events，触屏拖动同样生效）
const tilt = reactive({ x: 0, y: 0 })
function onMove(e) {
  const r = e.currentTarget.getBoundingClientRect()
  tilt.x = (e.clientX - r.left) / r.width - 0.5
  tilt.y = (e.clientY - r.top) / r.height - 0.5
}
function onLeave() {
  tilt.x = 0
  tilt.y = 0
}

// 点击夜空：额外召唤一阵流星。每阵是独立的 Meteors 实例（随机参数在渲染时定死），
// 数秒后整阵撤下，不打乱常驻星雨。
const bursts = ref([])
let burstSeq = 0
function summon() {
  const id = ++burstSeq
  bursts.value.push(id)
  setTimeout(() => {
    bursts.value = bursts.value.filter((b) => b !== id)
  }, 3200)
}
</script>

<template>
  <div
    class="relative h-dvh w-full overflow-hidden bg-[#0a0f1e] font-sans"
    @pointermove="onMove"
    @pointerleave="onLeave"
    @pointerdown="summon"
  >
    <!-- 夜空底色：顶部微光的径向渐变 -->
    <div
      class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1b2745_0%,#0a0f1e_62%)]"
    ></div>

    <!-- 常驻星雨 + 点击召唤的阵雨（inspira-ui Meteors） -->
    <Meteors :count="40" />
    <Meteors v-for="b in bursts" :key="b" :count="8" />

    <!-- 作品题签：编号 / 作品名 / 创作阐述 -->
    <div
      class="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-6 text-center select-none"
      :style="{
        transform: `translate(${tilt.x * 10}px, ${tilt.y * 7}px)`,
        transition: 'transform 0.35s ease-out',
      }"
    >
      <p class="text-[11px] tracking-[0.55em] text-slate-500">EXHIBIT · 001</p>
      <h1 class="text-4xl font-bold text-slate-100">流星雨</h1>
      <p class="fade-in text-sm text-slate-300" style="animation-delay: 0.8s">
        把一场 2026 年的流星雨，塞进 1998 年的窗口。
      </p>
      <p class="fade-in text-xs text-slate-500" style="animation-delay: 1.8s">
        点击夜空，唤一场更大的雨。
      </p>
    </div>

    <!-- 组件署名（角落小字） -->
    <p class="absolute right-3 bottom-2 z-10 text-[10px] text-slate-600 select-none">
      Meteors · 特效组件来自 inspira-ui（MIT License）
    </p>
  </div>
</template>

<style scoped>
.fade-in {
  opacity: 0;
  animation: fade-in 1.6s ease forwards;
}
@keyframes fade-in {
  to {
    opacity: 1;
  }
}
</style>
