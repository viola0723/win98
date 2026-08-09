<script setup>
// 展品 005 · 云桥：「会动的画」首件试点——AI 油画 + 图生视频（即梦 seedance2.0_vip）
// + ffmpeg 0.6x 减速 + minterpolate 运动补偿补帧回 24fps（8.3s 硬循环，详见 DEVLOG 2026-08-09）。
// 循环策略分级：本作含人物缓行（有方向运动），不用正反打；无方向运动的画面才用 ping-pong。
// 观感设计：先进海报帧（静画），视频 ready 后淡入覆盖——「画活了」。
import { onMounted, ref } from 'vue'

defineProps({ bare: Boolean })

const alive = ref(false) // 视频真正开始渲染帧后置真，驱动淡入
const asset = (p) => `${import.meta.env.BASE_URL}${p}`

onMounted(() => {
  document.title = '展品 005 · 云桥'
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
            :src="asset('covers/cloudbridge-poster.jpg')"
            alt="云桥"
            draggable="false"
            class="absolute inset-0 h-full w-full object-cover select-none"
          />
          <!-- 活画层：静音自动循环，开始渲染后淡入盖过静画 -->
          <video
            :src="asset('covers/cloudbridge.mp4')"
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
      <p class="text-[11px] tracking-[0.55em] text-slate-500">EXHIBIT · 005</p>
      <h1 class="text-4xl font-bold text-slate-100">云桥</h1>
      <p class="fade-in text-sm text-slate-300" style="animation-delay: 0.8s">
        云上长桥通天宫，看云的人在桥上站成了一幅画。
      </p>
      <p class="fade-in text-xs text-slate-500" style="animation-delay: 1.8s">静心看，这幅画是活的。</p>
    </div>

    <!-- 署名（角落小字） -->
    <p class="absolute right-3 bottom-2 z-10 text-[10px] text-slate-600 select-none">
      即梦 seedance 图生视频 · ffmpeg 减速补帧循环
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
