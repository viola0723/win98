<script setup>
// 展品 006 · 归鞘：「会动的画」第二件——国风剑舞视频末 3 秒 × 2 倍减速
// + minterpolate 运动补偿补帧至 48fps（6s 硬循环）。
// 循环策略沿用云桥分级：收势含衣袖定向飘落，不用正反打。
// 观感设计同云桥：先进海报帧（静画），视频 ready 后淡入覆盖——「画活了」。
import { onMounted, ref } from 'vue'

defineProps({ bare: Boolean })

const alive = ref(false) // 视频真正开始渲染帧后置真，驱动淡入
const asset = (p) => `${import.meta.env.BASE_URL}${p}`

onMounted(() => {
  document.title = '展品 006 · 归鞘'
})
</script>

<template>
  <div class="flex h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#04050a] font-sans">
    <!-- 画框：与大厅同款深木框 + 卡纸内衬，墙上那幅画走进去还是那幅画 -->
    <div class="frame">
      <div class="frame-mat">
        <div class="relative aspect-video w-full overflow-hidden bg-[#0a1220]">
          <!-- 静画层：永远兜底，视频未 ready / 加载失败时停留在这帧 -->
          <img
            :src="asset('covers/sheath-poster.jpg')"
            alt="归鞘"
            draggable="false"
            class="absolute inset-0 h-full w-full object-cover select-none"
          />
          <!-- 活画层：静音自动循环，开始渲染后淡入盖过静画 -->
          <video
            :src="asset('covers/sheath.mp4')"
            muted
            autoplay
            loop
            playsinline
            preload="auto"
            disablepictureinpicture
            class="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-out"
            :class="alive ? 'opacity-100' : 'opacity-0'"
            @playing="alive = true"
          ></video>
        </div>
      </div>
    </div>

    <!-- 作品题签（bare = chrome=0 嵌入模式不渲染） -->
    <div
      v-if="!bare"
      class="pointer-events-none mt-7 flex flex-col items-center gap-2 px-6 text-center select-none"
    >
      <p class="text-[11px] tracking-[0.55em] text-slate-500">EXHIBIT · 006</p>
      <h1 class="text-4xl font-bold text-slate-100">归鞘</h1>
      <p class="fade-in text-sm text-slate-300" style="animation-delay: 0.8s">
        竹林剑舞的最后一息，袖落，剑沉，人定。
      </p>
      <p class="fade-in text-xs text-slate-500" style="animation-delay: 1.8s">静心看，这幅画是活的。</p>
    </div>

    <!-- 署名（角落小字） -->
    <p class="absolute right-3 bottom-2 z-10 text-[10px] text-slate-600 select-none">
      国风剑舞 · ffmpeg 2x 减速 + 光流补帧 48fps
    </p>
  </div>
</template>

<style scoped>
/* 画框：与大厅轮播同款工艺（深木外框 + 做旧金线 + 卡纸内衬），保持进馆连续性 */
.frame {
  width: min(92vw, 108dvh);
  padding: min(1.6vmin, 14px);
  background: linear-gradient(145deg, #4a3520 0%, #2a1d10 45%, #1d130a 100%);
  border-radius: 3px;
  box-shadow:
    0 24px 50px rgba(0, 0, 0, 0.65),
    0 6px 16px rgba(0, 0, 0, 0.5),
    inset 0 1px 1px rgba(255, 220, 160, 0.25),
    inset 0 -1px 2px rgba(0, 0, 0, 0.6),
    0 0 90px 8px rgba(255, 232, 180, 0.12);
}
.frame-mat {
  height: 100%;
  padding: min(2.4vmin, 22px);
  background: linear-gradient(180deg, #efe9da 0%, #e3dbc8 100%);
  box-shadow:
    inset 0 0 0 2px #b08d4f,
    inset 0 2px 6px rgba(0, 0, 0, 0.35);
}

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
