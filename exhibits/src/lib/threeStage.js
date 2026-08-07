// 展品共用 three.js 舞台：渲染器 / 相机 / 轨道控制 / 自适应 / 帧循环 / 销毁
// 约定：贴图放 public/textures/，用 texURL() 取址（base './' 下相对当前页，dev/build 通用）
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export const isMobile = () =>
  window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768

export const texURL = (name) => import.meta.env.BASE_URL + 'textures/' + name

export function createStage(container, opts = {}) {
  const { fov = 40, cameraPos = [0, 0, 3], orbit: orbitOpts = {}, toneExposure = 1.1 } = opts

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 1.5 : 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = toneExposure
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    fov,
    container.clientWidth / container.clientHeight,
    0.1,
    200,
  )
  camera.position.set(...cameraPos)

  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.enableDamping = true
  orbit.dampingFactor = 0.06
  orbit.enablePan = false
  Object.assign(orbit, orbitOpts)

  const tickFns = []
  let renderFn = () => renderer.render(scene, camera)
  let resizeFn = null
  const clock = new THREE.Clock()
  let raf = 0

  function loop() {
    raf = requestAnimationFrame(loop)
    const delta = Math.min(clock.getDelta(), 0.1) // 切标签页回来不跳变
    tickFns.forEach((fn) => fn(delta, clock.elapsedTime))
    orbit.update()
    renderFn()
  }

  function onResize() {
    const w = container.clientWidth
    const h = container.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    if (resizeFn) resizeFn(w, h)
  }
  window.addEventListener('resize', onResize)

  loop()

  return {
    renderer,
    scene,
    camera,
    orbit,
    onTick: (fn) => tickFns.push(fn),
    setRender: (fn) => {
      renderFn = fn
    },
    onResizeFn: (fn) => {
      resizeFn = fn
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      orbit.dispose()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
        mats.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v && v.isTexture) v.dispose()
          })
          m.dispose()
        })
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
