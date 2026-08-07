<script setup>
// 展品 003 · 亿万星尘：程序化旋涡银河（three.js Points + 自定义 shader）
// 手法借鉴（详见 DEVLOG 2026-08-07）：Bruno Simon《Three.js Journey》Galaxy Generator
// 旋臂参数化算法（branch/angle/spin/randomness 幂次扰动）+ Galaxy Shader 课的软圆点
// （gl_PointCoord 径向衰减）+ 核心 bulge 加密 + PC 端 UnrealBloomPass（移动端关，
// additive 软点自带辉光观感）。
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { createStage, isMobile } from '../lib/threeStage'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

defineProps({ bare: Boolean })

const stageEl = ref(null)
let stage = null
let composer = null

// ---- 银河生成参数（在 Galaxy Generator 基础上调过：4 臂、核心加密、颜色内暖外冷）----
const P = {
  branches: 4,
  radius: 5,
  spin: 1.15,
  randomness: 0.38,
  randomnessPower: 3.2,
  insideColor: new THREE.Color('#ff9e5e'),
  outsideColor: new THREE.Color('#4a72d4'),
  coreColor: new THREE.Color('#ffe3b8'),
}

function generateGalaxy(count) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const scales = new Float32Array(count)
  const coreCount = Math.floor(count * 0.12) // 核心 bulge：一团压扁的暖白星球

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    let x, y, z, r
    if (i < coreCount) {
      // 核心：三轴高斯近似球，半径小、略压扁
      r = Math.abs((Math.random() + Math.random() + Math.random() - 1.5) / 1.5) * P.radius * 0.22
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      x = r * Math.sin(phi) * Math.cos(theta)
      z = r * Math.sin(phi) * Math.sin(theta)
      y = r * Math.cos(phi) * 0.55
      const c = P.coreColor.clone().lerp(P.insideColor, r / (P.radius * 0.22))
      colors[i3] = c.r
      colors[i3 + 1] = c.g
      colors[i3 + 2] = c.b
      scales[i] = 0.6 + Math.random() * 0.9
    } else {
      // 旋臂：Math.pow 让密度向核心收；幂次扰动偏 0、偶发大偏离（星尘弥散感）
      r = Math.pow(Math.random(), 2.0) * P.radius
      const branchAngle = ((i % P.branches) / P.branches) * Math.PI * 2
      const angle = branchAngle + r * P.spin
      const rx = Math.pow(Math.random(), P.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * P.randomness * r
      const ry = Math.pow(Math.random(), P.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * P.randomness * r
      const rz = Math.pow(Math.random(), P.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * P.randomness * r
      x = Math.cos(angle) * r + rx
      z = Math.sin(angle) * r + rz
      y = ry * 0.5 // 银盘压扁
      const c = P.insideColor.clone().lerp(P.outsideColor, Math.pow(r / P.radius, 0.8))
      colors[i3] = c.r
      colors[i3 + 1] = c.g
      colors[i3 + 2] = c.b
      scales[i] = 0.4 + Math.random() * 1.1
    }
    positions[i3] = x
    positions[i3 + 1] = y
    positions[i3 + 2] = z
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: 22 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, isMobile() ? 1.5 : 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uPixelRatio;
      attribute vec3 aColor;
      attribute float aScale;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * aScale * uPixelRatio * (1.0 / -mv.z);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        // 软圆点：径向衰减（Galaxy Shader 课手法，弃用 PointsMaterial 方点）
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        float strength = pow(1.0 - d * 2.0, 2.5);
        gl_FragColor = vec4(vColor * strength, strength);
      }
    `,
  })

  return new THREE.Points(geo, mat)
}

onMounted(() => {
  document.title = '展品 003 · 亿万星尘'
  const mobile = isMobile()
  stage = createStage(stageEl.value, {
    fov: 45,
    cameraPos: [4.2, 3.0, 4.2],
    orbit: { minDistance: 2.5, maxDistance: 15, autoRotate: true, autoRotateSpeed: 0.25 },
    toneExposure: 1.0,
  })
  const { scene, camera, renderer } = stage
  scene.background = new THREE.Color('#04050d')

  const points = generateGalaxy(mobile ? 50000 : 200000)
  scene.add(points)

  // 整个银河缓缓自转（星点本身不动，转的是盘子）
  stage.onTick((delta) => {
    points.rotation.y += delta * 0.05
  })

  // Bloom：PC 开（半分辨率省 GPU），移动端关——additive 软点本身就有辉光
  if (!mobile) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2())
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.38, 0.35, 0.2),
    )
    composer.addPass(new OutputPass())
    stage.setRender(() => composer.render())
    stage.onResizeFn((w, h) => composer.setSize(w, h))
  }
})

onBeforeUnmount(() => {
  composer?.dispose?.()
  stage?.dispose()
})
</script>

<template>
  <div class="relative h-dvh w-full overflow-hidden bg-[#04050d] font-sans">
    <!-- three.js 画布容器 -->
    <div ref="stageEl" class="absolute inset-0 touch-none"></div>

    <!-- 作品题签：底部居中，不吞指针（bare = chrome=0 嵌入模式不渲染） -->
    <div
      v-if="!bare"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-6 pb-9 text-center select-none"
    >
      <p class="text-[11px] tracking-[0.55em] text-slate-500">EXHIBIT · 003</p>
      <h1 class="text-4xl font-bold text-slate-100">亿万星尘</h1>
      <p class="fade-in text-sm text-slate-300" style="animation-delay: 0.8s">
        十万颗星尘在指尖旋转。你也是星尘，恰好会看星星的那种。
      </p>
      <p class="fade-in text-xs text-slate-500" style="animation-delay: 1.8s">
        拖动环顾，滚轮穿越星海。
      </p>
    </div>

    <!-- 署名（角落小字） -->
    <p class="absolute right-3 bottom-2 z-10 text-[10px] text-slate-600 select-none">
      three.js · 算法灵感 Three.js Journey「Galaxy Generator」
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
