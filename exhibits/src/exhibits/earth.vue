<script setup>
// 展品 002 · 蓝色弹珠：真实感地球（three.js）
// 手法借鉴（详见 DEVLOG 2026-08-07）：昼夜贴图按太阳方向混合 + 晨昏线暖色带
// （three.js 官方 tsl_earth 范式）+ fresnel 大气辉光背面球（SO #16269815 经典做法）
// + 云层独立球差速自转。贴图：NASA Blue Marble / three-globe（MIT）/ Solar System Scope（CC BY 4.0）。
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { createStage, texURL } from '../lib/threeStage'

defineProps({ bare: Boolean })

const stageEl = ref(null)
const loaded = ref(false)
let stage = null

onMounted(() => {
  document.title = '展品 002 · 蓝色弹珠'
  stage = createStage(stageEl.value, {
    fov: 38,
    cameraPos: [0, 0.7, 3.2],
    orbit: { minDistance: 1.7, maxDistance: 6, autoRotate: true, autoRotateSpeed: 0.35 },
    toneExposure: 1.2,
  })
  const { scene } = stage

  const manager = new THREE.LoadingManager(() => {
    loaded.value = true
  })
  const loader = new THREE.TextureLoader(manager)
  const load = (name) => {
    const t = loader.load(texURL(name))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }
  const dayTex = load('earth-day.jpg')
  const nightTex = load('earth-night.jpg')
  const cloudTex = load('2k_earth_clouds.jpg')

  // 星空背景（NASA 夜景全景，equirect 直接做 scene.background）
  const skyTex = load('night-sky.jpg')
  skyTex.mapping = THREE.EquirectangularReflectionMapping
  scene.background = skyTex
  scene.backgroundIntensity = 0.5

  // 太阳方向（世界空间；shader 内转视线空间，相机怎么动都对）
  const sunDir = new THREE.Vector3(2.5, 1.4, 4.2).normalize()

  // 地轴倾角 23.4°：倾角给父组，自转给孩子，互不干扰
  const tilt = new THREE.Group()
  tilt.rotation.z = THREE.MathUtils.degToRad(23.4)
  scene.add(tilt)

  // ---- 地球本体：昼夜混合 + 晨昏线 + 边缘蓝雾（fresnel 内发光）----
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayTex },
      nightMap: { value: nightTex },
      sunDirection: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 sunDirView = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
        float sunDot = dot(n, sunDirView);

        // 昼夜混合：晨昏线 ±0.12 柔边（官方 tsl_earth 同款 smoothstep）
        float dayMix = smoothstep(-0.12, 0.12, sunDot);
        vec3 day = texture2D(dayMap, vUv).rgb * 1.15;
        vec3 night = texture2D(nightMap, vUv).rgb * 1.8; // 夜图偏暗，提亮城市灯光
        vec3 col = mix(night, day, dayMix) + vec3(0.015, 0.02, 0.035); // 微弱环境光防死黑

        // 晨昏线一抹暮光橙
        float twilight = smoothstep(-0.28, 0.0, sunDot) * (1.0 - smoothstep(0.0, 0.28, sunDot));
        col += vec3(0.9, 0.42, 0.12) * twilight * 0.10;

        // 地表边缘 fresnel 蓝雾（昼侧强、夜侧保留一点）
        float fres = pow(1.0 - abs(dot(n, normalize(vViewDir))), 2.5);
        col += vec3(0.35, 0.6, 1.0) * fres * 0.28 * max(dayMix, 0.12);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), earthMat)
  tilt.add(earth)

  // ---- 云层：独立球、差速自转，昼白夜隐 ----
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: {
      cloudMap: { value: cloudTex },
      sunDirection: { value: sunDir },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D cloudMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        float a = texture2D(cloudMap, vUv).r;
        vec3 n = normalize(vNormal);
        vec3 sunDirView = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
        float light = smoothstep(-0.15, 0.2, dot(n, sunDirView)) * 0.92 + 0.08;
        gl_FragColor = vec4(vec3(light), a * 0.85);
      }
    `,
  })
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 96), cloudMat)
  tilt.add(clouds)

  // ---- 大气辉光：fresnel 背面球（additive），昼侧更亮 ----
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { sunDirection: { value: sunDir } },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDirection;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float rim = pow(0.62 - dot(n, vec3(0.0, 0.0, 1.0)), 2.0);
        vec3 sunDirView = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
        float daySide = 0.45 + 0.55 * smoothstep(-0.4, 0.4, dot(n, sunDirView));
        vec3 col = vec3(0.38, 0.66, 1.0) * 1.15;
        gl_FragColor = vec4(col, 1.0) * rim * daySide;
      }
    `,
  })
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 96), glowMat)
  scene.add(glow)

  // 自转：地球 90s 一圈，云层略快（差速出层次感）
  stage.onTick((delta) => {
    earth.rotation.y += delta * ((2 * Math.PI) / 90)
    clouds.rotation.y += delta * ((2 * Math.PI) / 90) * 1.35
  })
})

onBeforeUnmount(() => {
  stage?.dispose()
})
</script>

<template>
  <div class="relative h-dvh w-full overflow-hidden bg-[#04060e] font-sans">
    <!-- three.js 画布容器 -->
    <div ref="stageEl" class="absolute inset-0 touch-none"></div>

    <!-- 装载提示 -->
    <div
      v-if="!loaded"
      class="absolute inset-0 z-10 flex items-center justify-center text-xs tracking-[0.4em] text-slate-500 select-none"
    >
      正在装载星光…
    </div>

    <!-- 作品题签：底部居中，不挡星球，不吞指针（bare = chrome=0 嵌入模式不渲染） -->
    <div
      v-if="!bare"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-6 pb-9 text-center select-none"
    >
      <p class="text-[11px] tracking-[0.55em] text-slate-500">EXHIBIT · 002</p>
      <h1 class="text-4xl font-bold text-slate-100">蓝色弹珠</h1>
      <p class="fade-in text-sm text-slate-300" style="animation-delay: 0.8s">
        1972 年，阿波罗 17 号回头看了一眼。此后我们都住在那张照片里。
      </p>
      <p class="fade-in text-xs text-slate-500" style="animation-delay: 1.8s">
        拖动，转动这颗星球；滚轮，靠近一点。
      </p>
    </div>

    <!-- 署名（角落小字） -->
    <p class="absolute right-3 bottom-2 z-10 text-[10px] text-slate-600 select-none">
      three.js · 贴图 NASA Blue Marble（公有领域）/ three-globe（MIT）/ Solar System Scope（CC BY 4.0）
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
