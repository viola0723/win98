<script setup>
// img2threejs 评审页（隐藏路由，不进 manifest，不对用户展示）：
//   ?review=<模型名>  动态加载 src/models/<模型名>.ts 工厂并渲染
//   bg=#rrggbb        背景色（默认中灰 #808080，尽量贴近参考图底色方便对比）
//   az= / el=         取景角覆盖（透传 frameXxxCamera 的 azimuthDeg/elevationDeg）
// 确定性截图约定（grimoire/feedback/render_capture.md）：orbit 禁用 + 无阻尼，
// 相机只由 frameXxxCamera 取景一次，场景无自动动画——同一构建截图可复现。
import { onMounted, ref } from 'vue'
import * as THREE from 'three'
import { createStage } from './lib/threeStage'

const modules = import.meta.glob('./models/*.ts')
const params = new URLSearchParams(window.location.search)
const name = params.get('review')
const bg = params.get('bg') || '#808080'
const az = params.has('az') ? Number(params.get('az')) : null
const el = params.has('el') ? Number(params.get('el')) : null

const box = ref(null)
const error = ref('')

// 工厂模块的命名约定：create<Name>Model / create<Name>Environment / frame<Name>Camera
const pick = (mod, prefix, suffix) =>
  Object.entries(mod).find(
    ([k, v]) => k.startsWith(prefix) && k.endsWith(suffix) && typeof v === 'function',
  )?.[1]

onMounted(async () => {
  const loader = modules[`./models/${name}.ts`]
  if (!loader) {
    error.value = `模型不存在：src/models/${name}.ts`
    return
  }
  try {
    const mod = await loader()
    const factory = pick(mod, 'create', 'Model')
    if (!factory) throw new Error('找不到 create*Model 导出')
    const envFn = pick(mod, 'create', 'Environment')
    const frameFn = pick(mod, 'frame', 'Camera')

    const stage = createStage(box.value, { cameraPos: [0, 0, 3] })
    stage.scene.background = new THREE.Color(bg)
    const group = factory()
    // orbit.update() 每帧会用 lookAt 重置相机朝向，roll 作用不到相机上——
    // 改为滚转模型（对面内剪影等效），且要在取景之前应用
    if (params.has('roll')) group.rotateZ((Number(params.get('roll')) * Math.PI) / 180)
    // ax=：微调天线族节点的 x 偏移（剪影对齐扫描用，调定后回写 spec）
    if (params.has('ax')) {
      const ax = Number(params.get('ax'))
      group.traverse((o) => {
        if (o.name.includes('天线') && o.name.endsWith('__pivot')) {
          o.position.x = o.name.includes('杆') ? ax : ax // 杆/头/座同轴
        }
      })
    }
    stage.scene.add(group)
    // PBR 硬需求：不挂 environment 材质发灰（生成器注释明示）
    if (envFn) stage.scene.environment = envFn(stage.renderer)
    // LookDev 灯（neutral；生成器导出的 key/fill/rim 四灯）+ 地面接触阴影：
    // 参考图带棚拍接触影，前景剪影提取会把影子算进 bbox——渲染必须对齐这一事实
    const lightsFn = pick(mod, 'create', 'LookDevLights')
    if (lightsFn) stage.scene.add(lightsFn(params.get('lights') || 'neutral'))
    stage.renderer.shadowMap.enabled = true
    stage.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({ opacity: 0.3 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = new THREE.Box3().setFromObject(group).min.y
    ground.name = 'review-ground'
    stage.scene.add(ground)
    // 软接触影（低俯角下投影贴地几乎不可见，参考图的影子会占剪影面积，用渐变片补足）
    const shCanvas = document.createElement('canvas')
    shCanvas.width = shCanvas.height = 256
    const ctx = shCanvas.getContext('2d')
    const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 126)
    grad.addColorStop(0, 'rgba(0,0,0,0.38)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0.12)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)
    const shadowTex = new THREE.CanvasTexture(shCanvas)
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.85),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    )
    blob.rotation.x = -Math.PI / 2
    blob.position.set(0.15, ground.position.y + 0.01, 0.18)
    blob.name = 'review-ground'
    stage.scene.add(blob)
    if (frameFn) {
      const opts = {}
      if (az != null) opts.azimuthDeg = az
      if (el != null) opts.elevationDeg = el
      if (params.has('margin')) opts.margin = Number(params.get('margin'))
      frameFn(stage.camera, group, opts)
      // 关键：OrbitControls 每帧 update() 会把相机重新对准 orbit.target（默认原点），
      // 必须把 target 同步到包围盒中心，否则取景被逐帧拉回 (0,0,0)
      const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3())
      if (params.has('cy')) center.y += Number(params.get('cy')) // 剪影垂直对齐微调
      stage.orbit.target.copy(center)
      stage.camera.lookAt(center)
    }
    // 确定性：禁用交互与阻尼，相机不再变动
    stage.orbit.enabled = false
    stage.orbit.enableDamping = false
    // flat=1：剥离材质贴图（blockout 评审的 map-stripped render 契约）
    if (params.get('flat') === '1') {
      const flat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.85, metalness: 0 })
      group.traverse((o) => { if (o.isMesh) o.material = flat })
      stage.scene.environment = null
    }
    window.__stage = stage // 调试探针
  } catch (e) {
    error.value = String(e)
  }
})
</script>

<template>
  <div class="relative h-dvh w-full">
    <div ref="box" class="h-full w-full"></div>
    <p v-if="error" class="absolute top-3 left-3 text-sm text-red-400">{{ error }}</p>
  </div>
</template>
