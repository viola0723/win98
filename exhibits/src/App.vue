<script setup>
// 展览馆壳：无 ?ex= 参数时展示大厅（展品墙），带 ?ex=xxx 时动态加载对应展品。
// 新增展品只需 src/exhibits/ 加 xxx.vue + manifest.js 加一条记录，本文件零改动。
// 附加参数：?chrome=0 隐藏「返回大厅」按钮（屏保等嵌入场景用）。
import { defineAsyncComponent, onMounted } from 'vue'
import { EXHIBITS } from './exhibits/manifest'

const modules = import.meta.glob('./exhibits/*.vue')
const params = new URLSearchParams(window.location.search)
const exName = params.get('ex')
const bare = params.get('chrome') === '0'
const loader = exName ? modules[`./exhibits/${exName}.vue`] : null

const Exhibit = loader ? defineAsyncComponent(loader) : null
// 大厅只列出确有对应组件的展品（防止 manifest 与文件脱节）
const items = EXHIBITS.filter((e) => modules[`./exhibits/${e.id}.vue`])

onMounted(() => {
  if (!Exhibit) document.title = '展览馆 · 旧电脑'
})
</script>

<template>
  <!-- 展品页：全屏展出 + 左上角返回大厅 -->
  <template v-if="Exhibit">
    <component :is="Exhibit" />
    <a
      v-if="!bare"
      href="./index.html"
      class="fixed top-3 left-3 z-50 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-slate-300 backdrop-blur-sm transition hover:border-white/25 hover:text-white"
      >← 返回大厅</a
    >
  </template>

  <!-- 大厅：暗色展厅 + 展品墙 -->
  <div
    v-else
    class="relative h-dvh w-full overflow-y-auto bg-[#0a0f1e] font-sans select-none"
  >
    <!-- 展厅顶光 -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,#1b2745_0%,transparent_65%)]"
    ></div>

    <div class="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col px-6 py-12">
      <!-- 馆头 -->
      <header class="flex flex-col items-center gap-3 text-center">
        <p class="text-[11px] tracking-[0.55em] text-slate-500">GALLERY</p>
        <h1 class="text-3xl font-bold text-slate-100">旧电脑 · 展览馆</h1>
        <p class="text-sm text-slate-400">机器会旧，人会老，想象力不会。</p>
        <p v-if="exName" class="mt-1 text-sm text-amber-400/80">
          没有找到展品「{{ exName }}」，请从展厅进入：
        </p>
      </header>

      <!-- 展品墙 -->
      <main class="mt-10 grid flex-1 grid-cols-1 content-start gap-6 sm:grid-cols-2">
        <a
          v-for="e in items"
          :key="e.id"
          :href="`?ex=${e.id}`"
          class="group block rounded-sm border border-[#3a3226] bg-linear-to-b from-[#17130c] to-[#0d0b08] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition duration-300 hover:-translate-y-1 hover:border-[#6b5a3a] hover:shadow-[0_18px_44px_rgba(0,0,0,0.75)]"
        >
          <!-- 画框内芯：暗色展位，未来可换封面图 -->
          <div
            class="flex aspect-[4/3] flex-col items-center justify-center gap-2 border border-white/5 bg-[#0a0f1e] px-5 text-center"
          >
            <p class="text-[10px] tracking-[0.5em] text-slate-500">
              EXHIBIT · {{ e.no }}
            </p>
            <h2
              class="text-xl font-bold text-slate-100 transition group-hover:text-white"
            >
              {{ e.title }}
            </h2>
            <p class="text-xs leading-relaxed text-slate-400">{{ e.desc }}</p>
          </div>
        </a>
      </main>

      <footer class="mt-10 text-center text-[11px] text-slate-600">
        共 {{ items.length }} 件藏品 · 展品持续入藏中
      </footer>
    </div>
  </div>
</template>
