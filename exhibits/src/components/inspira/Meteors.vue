<script setup>
// 改编自 inspira-ui 的 Meteors 组件（MIT License）
// 源文件：https://github.com/unovue/inspira-ui/blob/main/app/components/inspira/ui/meteors/Meteors.vue
// 为普通 Vite + Vue 项目做的适配：
//   1. lang="ts" 改为纯 JS；
//   2. cn 从 "@inspira-ui/plugins" 改为本地 src/lib/utils.js（clsx + tailwind-merge）；
//   3. inspira 预设里提供的 animate-meteor-effect 动画补进本组件 scoped 样式；
//   4. left 由随机 px（-400~400）改为随机百分比，任意宽度容器都能铺满。
import { cn } from '../../lib/utils'

defineProps({
  count: {
    type: Number,
    default: 20,
  },
  class: String,
})
</script>

<template>
  <span
    v-for="index in count"
    :key="`meteor ${index}`"
    :style="{
      top: 0,
      left: `${Math.floor(Math.random() * 100)}%`,
      animationDelay: `${Math.random() * (0.8 - 0.2) + 0.2}s`,
      animationDuration: `${Math.floor(Math.random() * (10 - 2) + 2)}s`,
    }"
    :class="
      cn(
        `animate-meteor-effect absolute h-0.5 w-0.5 rotate-45 rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10] before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-[50%] before:transform before:bg-linear-to-r before:from-[#64748b] before:to-transparent before:content-['']`,
        $props.class,
      )
    "
  />
</template>

<style scoped>
@keyframes meteor {
  0% {
    transform: rotate(215deg) translateX(0);
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: rotate(215deg) translateX(-500px);
    opacity: 0;
  }
}

.animate-meteor-effect {
  animation: meteor 5s linear infinite;
}
</style>
