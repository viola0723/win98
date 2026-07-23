<script setup>
// 展柜路由壳：按 ?ex= 参数动态加载 src/exhibits/ 下的展品组件。
// 新增展品只需把 xxx.vue 丢进 src/exhibits/ 并重新 build，本文件零改动；
// 主站 config.js 里 exhibit 路径写 'exhibits/dist/index.html?ex=xxx' 即可。
import { defineAsyncComponent } from 'vue'

const exhibits = import.meta.glob('./exhibits/*.vue')
const exName = new URLSearchParams(window.location.search).get('ex')
const loader = exName ? exhibits[`./exhibits/${exName}.vue`] : null

const Exhibit = loader ? defineAsyncComponent(loader) : null
const available = Object.keys(exhibits)
  .map((p) => p.replace(/^\.\/exhibits\/|\.vue$/g, ''))
  .sort()
</script>

<template>
  <component :is="Exhibit" v-if="Exhibit" />

  <!-- 未带参数 / 展品不存在：列出全部展品入口 -->
  <div
    v-else
    class="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-[#0a0f1e] px-6 text-center font-sans select-none"
  >
    <p class="text-[11px] tracking-[0.55em] text-slate-500">EXHIBITS</p>
    <h1 class="text-3xl font-bold text-slate-100">旧电脑 · 展柜</h1>
    <p v-if="exName" class="text-sm text-amber-400/80">
      没有找到展品「{{ exName }}」，以下是现有展品：
    </p>
    <ul class="mt-2 flex flex-col gap-2">
      <li v-for="name in available" :key="name">
        <a
          :href="`?ex=${name}`"
          class="text-sm text-sky-300 underline underline-offset-4 hover:text-sky-200"
          >?ex={{ name }}</a
        >
      </li>
    </ul>
  </div>
</template>
