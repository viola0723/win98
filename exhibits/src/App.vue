<script setup>
// 展品 001 · 流星雨：全屏深色舞台 + inspira-ui Meteors 特效
import Meteors from './components/inspira/Meteors.vue'
</script>

<template>
  <div class="relative h-dvh w-full overflow-hidden bg-[#0a0f1e] font-sans">
    <!-- 夜空底色：顶部微光的径向渐变 -->
    <div
      class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1b2745_0%,#0a0f1e_62%)]"
    ></div>

    <!-- 流星特效（inspira-ui Meteors） -->
    <Meteors :count="40" />

    <!-- 标题 / 署名 -->
    <div
      class="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-6 text-center select-none"
    >
      <p class="text-[11px] tracking-[0.55em] text-slate-500">EXHIBIT · 001</p>
      <h1 class="text-4xl font-bold text-slate-100">流星雨</h1>
      <p class="text-sm text-slate-400">
        Meteors · 特效组件来自 inspira-ui（MIT License）
      </p>
    </div>
  </div>
</template>
