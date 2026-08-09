<script setup>
// 展品 004 · 大哥大：img2threejs 流水线产物（参考图 → 8 pass 质量门 → 纯代码 THREE.Group）
// 模型工厂 src/models/createBrickPhoneModel.ts（生成器骨架 + refine_ts 手工精修层，
// 生成过程与评审记录见 ../tools/i2t-runs/dynatac 与 DEVLOG 2026-08-09）。
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { createStage } from '../lib/threeStage'
import {
  createBrickPhoneModel,
  createBrickPhoneEnvironment,
  createBrickPhoneLookDevLights,
  frameBrickPhoneCamera,
} from '../models/createBrickPhoneModel.ts'

defineProps({ bare: Boolean })

const stageEl = ref(null)
let stage = null

onMounted(() => {
  document.title = '展品 004 · 大哥大'
  stage = createStage(stageEl.value, {
    fov: 40,
    orbit: { enableDamping: true },
    toneExposure: 1.0,
  })
  const { scene, camera, renderer } = stage
  scene.background = new THREE.Color('#07080e')

  const model = createBrickPhoneModel()
  scene.add(model)
  // PBR 硬需求：不挂 environment 材质发灰
  scene.environment = createBrickPhoneEnvironment(renderer)
  // reference 灯位（暖 key + fill + rim），博物馆展柜打光
  scene.add(createBrickPhoneLookDevLights('reference'))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // 地面软接触影
  const shCanvas = document.createElement('canvas')
  shCanvas.width = shCanvas.height = 256
  const ctx = shCanvas.getContext('2d')
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 126)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)')
  grad.addColorStop(0.5, 'rgba(0,0,0,0.2)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCanvas), transparent: true, depthWrite: false }),
  )
  blob.rotation.x = -Math.PI / 2
  blob.position.set(0.1, new THREE.Box3().setFromObject(model).min.y + 0.01, 0.2)
  scene.add(blob)

  // 初始取景：3/4 侧前（与评审参考视角一致），之后用户自由环顾
  // margin 1.8 + 视线下移 0.15：模型偏小偏上，避开底部题签
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3())
  center.y -= 0.15
  frameBrickPhoneCamera(camera, model, { azimuthDeg: 38, elevationDeg: 10, margin: 1.8 })
  stage.orbit.target.copy(center)
  stage.camera.lookAt(center)
  stage.orbit.update()

  // 展柜转台：90 秒一圈，几乎察觉不到在转
  stage.onTick((delta) => {
    model.rotation.y += delta * ((2 * Math.PI) / 90)
  })
  window.__stage = stage // 验收探针
})

onBeforeUnmount(() => {
  stage?.dispose()
})
</script>

<template>
  <div class="relative h-dvh w-full overflow-hidden bg-[#07080e] font-sans">
    <!-- three.js 画布容器 -->
    <div ref="stageEl" class="absolute inset-0 touch-none"></div>

    <!-- 作品题签：底部居中，不吞指针（bare = chrome=0 嵌入模式不渲染） -->
    <div
      v-if="!bare"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-6 pb-9 text-center select-none"
    >
      <p class="text-[11px] tracking-[0.55em] text-slate-500">EXHIBIT · 004</p>
      <h1 class="text-4xl font-bold text-slate-100">大哥大</h1>
      <p class="fade-in text-sm text-slate-300" style="animation-delay: 0.8s">
        1983 年的移动自由，一块能打电话的砖头。
      </p>
      <p class="fade-in text-xs text-slate-500" style="animation-delay: 1.8s">
        拖动环顾，看看这台机器的每个面。
      </p>
    </div>

    <!-- 署名（角落小字） -->
    <p class="absolute right-3 bottom-2 z-10 text-[10px] text-slate-600 select-none">
      img2threejs · 参考图重建，纯代码无网格
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
