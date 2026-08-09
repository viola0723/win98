import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ['base'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Brick Phone
// Sculpt build pass: surface-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createBrickPhoneModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Brick Phone";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["mat-housing"] = createSculptMaterial(
    "mat-housing",
    {"id": "mat-housing", "name": "机身磨砂塑料", "type": "standard", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#1b1d1f", "color": "#1b1d1f", "albedo": {"dominant": "#1b1d1f", "secondary": ["#2d3034", "#101214"], "samplingNotes": "取自参考图局部色域"}, "colorVariation": {"palette": ["#1b1d1f", "#2d3034", "#101214"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "世界尺度稳定，不随组件拉伸"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.3, "role": "大面积明度起伏"}, {"id": "meso", "frequency": 18.0, "amplitude": 0.68, "role": "pebble grain bump", "pattern": "grain"}, {"id": "micro", "frequency": 60.0, "amplitude": 0.2, "role": "高光细碎化"}], "roughness": {"base": 0.62, "variation": 0.15, "map": "independent-procedural-field", "localResponse": "凹陷处更糙、棱边处更低"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.55, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "凹陷/键隙/孔位加深"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#141517"}, "localOverrides": [{"id": "pebble-grain", "note": "细颗粒注塑纹理", "bump": {"amplitude": 0.35, "scale": 32.0}}, {"id": "edge-satin", "note": "棱边缎面低粗糙度", "roughness": {"base": 0.28}}], "shaderNotes": ["albedo/roughness/normal 独立生成，不互用"], "notes": "近黑磨砂 ABS", "clearcoat": {"base": 0.18}, "clearcoatRoughness": {"base": 0.5}},
    options
  );
  materialMap["mat-antenna"] = createSculptMaterial(
    "mat-antenna",
    {"id": "mat-antenna", "name": "天线缎面塑料", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#17181a", "color": "#17181a", "albedo": {"dominant": "#17181a", "secondary": ["#26282b", "#0d0e10"], "samplingNotes": "取自参考图局部色域"}, "colorVariation": {"palette": ["#17181a", "#26282b", "#0d0e10"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "世界尺度稳定，不随组件拉伸"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.2, "role": "明度起伏"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.2, "role": "轻微拉丝"}, {"id": "micro", "frequency": 48.0, "amplitude": 0.1, "role": "高光细碎"}], "roughness": {"base": 0.38, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "凹陷处更糙、棱边处更低"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "凹陷/键隙/孔位加深"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#141517"}, "localOverrides": [], "shaderNotes": ["albedo/roughness/normal 独立生成，不互用"], "notes": "比机身略光滑"},
    options
  );
  materialMap["mat-screen"] = createSculptMaterial(
    "mat-screen",
    {"id": "mat-screen", "name": "屏幕玻璃", "type": "standard", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#79857c", "color": "#79857c", "albedo": {"dominant": "#79857c", "secondary": ["#5d6a62", "#93a097"], "samplingNotes": "取自参考图局部色域"}, "colorVariation": {"palette": ["#79857c", "#5d6a62", "#93a097"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "世界尺度稳定，不随组件拉伸"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.1, "role": "轻微色带"}, {"id": "meso", "frequency": 10.0, "amplitude": 0.05, "role": "近无痕"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.03, "role": "近无痕"}], "roughness": {"base": 0.08, "variation": 0.04, "map": "independent-procedural-field", "localResponse": "凹陷处更糙、棱边处更低"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "凹陷/键隙/孔位加深"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#141517"}, "localOverrides": [{"id": "screen-tint", "note": "灰绿液晶底色", "roughness": {"base": 0.08}}], "shaderNotes": ["albedo/roughness/normal 独立生成，不互用"], "notes": "熄灭态灰绿玻璃", "clearcoat": {"base": 0.8}, "clearcoatRoughness": {"base": 0.12}, "envMapIntensity": 1.0},
    options
  );
  materialMap["mat-keycap"] = createSculptMaterial(
    "mat-keycap",
    {"id": "mat-keycap", "name": "键帽黑塑料", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#101112", "color": "#101112", "albedo": {"dominant": "#101112", "secondary": ["#1e2023", "#08090a"], "samplingNotes": "取自参考图局部色域"}, "colorVariation": {"palette": ["#101112", "#1e2023", "#08090a"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "世界尺度稳定，不随组件拉伸"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.15, "role": "明度起伏"}, {"id": "meso", "frequency": 16.0, "amplitude": 0.2, "role": "细磨砂"}, {"id": "micro", "frequency": 50.0, "amplitude": 0.1, "role": "高光细碎"}], "roughness": {"base": 0.42, "variation": 0.08, "map": "independent-procedural-field", "localResponse": "凹陷处更糙、棱边处更低"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "凹陷/键隙/孔位加深"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#141517"}, "localOverrides": [], "shaderNotes": ["albedo/roughness/normal 独立生成，不互用"], "notes": "缎面黑键帽"},
    options
  );
  materialMap["mat-fn-red"] = createSculptMaterial(
    "mat-fn-red",
    {"id": "mat-fn-red", "name": "功能键红", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#c24030", "color": "#c24030", "albedo": {"dominant": "#c24030", "secondary": ["#dd6a5c", "#9a2f20"], "samplingNotes": "取自参考图局部色域"}, "colorVariation": {"palette": ["#c24030", "#dd6a5c", "#9a2f20"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "世界尺度稳定，不随组件拉伸"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.12, "role": "明度起伏"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.15, "role": "细磨砂"}, {"id": "micro", "frequency": 46.0, "amplitude": 0.08, "role": "高光细碎"}], "roughness": {"base": 0.35, "variation": 0.08, "map": "independent-procedural-field", "localResponse": "凹陷处更糙、棱边处更低"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "凹陷/键隙/孔位加深"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#141517"}, "localOverrides": [], "shaderNotes": ["albedo/roughness/normal 独立生成，不互用"], "notes": ""},
    options
  );
  materialMap["mat-fn-yellow"] = createSculptMaterial(
    "mat-fn-yellow",
    {"id": "mat-fn-yellow", "name": "功能键黄", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#e8bb35", "color": "#e8bb35", "albedo": {"dominant": "#e8bb35", "secondary": ["#f5d678", "#c09422"], "samplingNotes": "取自参考图局部色域"}, "colorVariation": {"palette": ["#e8bb35", "#f5d678", "#c09422"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "世界尺度稳定，不随组件拉伸"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.12, "role": "明度起伏"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.15, "role": "细磨砂"}, {"id": "micro", "frequency": 46.0, "amplitude": 0.08, "role": "高光细碎"}], "roughness": {"base": 0.35, "variation": 0.08, "map": "independent-procedural-field", "localResponse": "凹陷处更糙、棱边处更低"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "凹陷/键隙/孔位加深"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#141517"}, "localOverrides": [], "shaderNotes": ["albedo/roughness/normal 独立生成，不互用"], "notes": ""},
    options
  );
  materialMap["mat-fn-green"] = createSculptMaterial(
    "mat-fn-green",
    {"id": "mat-fn-green", "name": "功能键绿", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#35a060", "color": "#35a060", "albedo": {"dominant": "#35a060", "secondary": ["#52c489", "#267d48"], "samplingNotes": "取自参考图局部色域"}, "colorVariation": {"palette": ["#35a060", "#52c489", "#267d48"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "世界尺度稳定，不随组件拉伸"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.12, "role": "明度起伏"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.15, "role": "细磨砂"}, {"id": "micro", "frequency": 46.0, "amplitude": 0.08, "role": "高光细碎"}], "roughness": {"base": 0.35, "variation": 0.08, "map": "independent-procedural-field", "localResponse": "凹陷处更糙、棱边处更低"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "凹陷/键隙/孔位加深"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#141517"}, "localOverrides": [], "shaderNotes": ["albedo/roughness/normal 独立生成，不互用"], "notes": ""},
    options
  );
  materialMap["mat-grille"] = createSculptMaterial(
    "mat-grille",
    {"id": "mat-grille", "name": "听筒网面深灰", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#242628", "color": "#242628", "albedo": {"dominant": "#242628", "secondary": ["#33363a", "#141517"], "samplingNotes": "取自参考图局部色域"}, "colorVariation": {"palette": ["#242628", "#33363a", "#141517"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "世界尺度稳定，不随组件拉伸"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.25, "role": "明度起伏"}, {"id": "meso", "frequency": 20.0, "amplitude": 0.3, "role": "网面颗粒"}, {"id": "micro", "frequency": 55.0, "amplitude": 0.1, "role": "高光细碎"}], "roughness": {"base": 0.7, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "凹陷处更糙、棱边处更低"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "凹陷/键隙/孔位加深"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#141517"}, "localOverrides": [], "shaderNotes": ["albedo/roughness/normal 独立生成，不互用"], "notes": ""},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "\u673a\u8eab\u58f3\u4f53\uff08\u542b\u9876\u9762/\u4fa7\u8fb9/\u4e0b\u5df4\uff09__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "机身壳体（含顶面/侧边/下巴）", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1.18, "height": 2.65, "depth": 0.78, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1.0, 1.0, 1.0]}, "actionProfile": {"animationRole": "body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-housing", "materialLayers": ["mat-housing"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "shell-seam", "note": "前后壳沿侧边中线合模缝（细凹槽）"}, {"id": "side-slash-grooves", "note": "右侧边三条斜切凹槽"}, {"id": "chin-ridge", "note": "下巴弧面装饰棱线"}], "surfaceDetail": {"macroRoughness": 0.62, "microRoughness": 0.3, "bumpAmplitude": 0.35, "normalPattern": "pebble grain", "displacementPattern": "", "occlusionPattern": "seam darkening", "edgeWearPattern": "edge satin", "notes": "磨砂颗粒+棱边缎面"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27,29,31,1)", "secondaryAlbedo": "rgba(45,48,52,1)", "materialClass": "plastic", "materialClassConfidence": 0.9, "finishStyle": "matte pebble-grain molded plastic"}};
  node_root_0.userData.actionProfile = {"animationRole": "body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new RoundedBoxGeometry(1.18, 2.65, 0.78, 4, 0.07);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["mat-housing"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "\u673a\u8eab\u58f3\u4f53\uff08\u542b\u9876\u9762/\u4fa7\u8fb9/\u4e0b\u5df4\uff09";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "机身壳体（含顶面/侧边/下巴）", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1.18, "height": 2.65, "depth": 0.78, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1.0, 1.0, 1.0]}, "actionProfile": {"animationRole": "body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-housing", "materialLayers": ["mat-housing"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "shell-seam", "note": "前后壳沿侧边中线合模缝（细凹槽）"}, {"id": "side-slash-grooves", "note": "右侧边三条斜切凹槽"}, {"id": "chin-ridge", "note": "下巴弧面装饰棱线"}], "surfaceDetail": {"macroRoughness": 0.62, "microRoughness": 0.3, "bumpAmplitude": 0.35, "normalPattern": "pebble grain", "displacementPattern": "", "occlusionPattern": "seam darkening", "edgeWearPattern": "edge satin", "notes": "磨砂颗粒+棱边缎面"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27,29,31,1)", "secondaryAlbedo": "rgba(45,48,52,1)", "materialClass": "plastic", "materialClassConfidence": 0.9, "finishStyle": "matte pebble-grain molded plastic"}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const attachment_antenna_1 = {"parentSocket": "top-face-antenna-socket", "contactType": "embedded", "localStart": [0.24, 1.28, -0.08], "localEnd": [0.24, 2.47, -0.08], "contactNormal": [0, 1, 0], "embedDepth": 0.08, "overlap": 0, "gapTolerance": 0.01, "baseRadius": 0.055, "endRadius": 0.045, "evidenceRefs": ["full-object"]};
  const endpoint_antenna_1 = makeAttachmentEndpoint(attachment_antenna_1);
  const node_antenna_1 = new THREE.Group();
  node_antenna_1.name = "\u5929\u7ebf\u6746__pivot";
  if (endpoint_antenna_1) {
    node_antenna_1.position.copy(endpoint_antenna_1.start);
    node_antenna_1.rotation.set(0, 0, 0);
    node_antenna_1.scale.set(1, 1, 1);
  } else {
    node_antenna_1.position.set(0.0, 0.0, 0.0);
    node_antenna_1.rotation.set(0.0, 0.0, 0.0);
    node_antenna_1.scale.set(1.0, 1.0, 1.0);
  }
  node_antenna_1.userData.sculptComponent = {"id": "antenna", "name": "天线杆", "level": "macro", "role": "antenna", "importance": 1.0, "confidence": 0.9, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": {"parentSocket": "top-face-antenna-socket", "contactType": "embedded", "localStart": [0.24, 1.28, -0.08], "localEnd": [0.24, 2.47, -0.08], "contactNormal": [0, 1, 0], "embedDepth": 0.08, "overlap": 0, "gapTolerance": 0.01, "baseRadius": 0.055, "endRadius": 0.045, "evidenceRefs": ["full-object"]}, "dimensions": {"radius": 0.075, "length": 1.85, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "antenna", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-antenna", "materialLayers": ["mat-antenna"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23,24,26,1)", "secondaryAlbedo": "rgba(38,40,43,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "satin plastic"}};
  node_antenna_1.userData.actionProfile = {"animationRole": "antenna", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_antenna_1);
  nodes["antenna"] = node_antenna_1;
  const mesh_antenna_1Geometry = endpoint_antenna_1
    ? new THREE.CylinderGeometry(endpoint_antenna_1.endRadius, endpoint_antenna_1.baseRadius, endpoint_antenna_1.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_antenna_1 = new THREE.Mesh(
    mesh_antenna_1Geometry,
    materialMap["mat-antenna"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_antenna_1.name = "\u5929\u7ebf\u6746";
  if (endpoint_antenna_1) {
    mesh_antenna_1.position.copy(endpoint_antenna_1.midpoint);
    mesh_antenna_1.quaternion.copy(endpoint_antenna_1.quaternion);
  }
  mesh_antenna_1.castShadow = options.castShadow ?? true;
  mesh_antenna_1.receiveShadow = options.receiveShadow ?? true;
  mesh_antenna_1.userData.sculptComponent = {"id": "antenna", "name": "天线杆", "level": "macro", "role": "antenna", "importance": 1.0, "confidence": 0.9, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": {"parentSocket": "top-face-antenna-socket", "contactType": "embedded", "localStart": [0.24, 1.28, -0.08], "localEnd": [0.24, 2.47, -0.08], "contactNormal": [0, 1, 0], "embedDepth": 0.08, "overlap": 0, "gapTolerance": 0.01, "baseRadius": 0.055, "endRadius": 0.045, "evidenceRefs": ["full-object"]}, "dimensions": {"radius": 0.075, "length": 1.85, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "antenna", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-antenna", "materialLayers": ["mat-antenna"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23,24,26,1)", "secondaryAlbedo": "rgba(38,40,43,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "satin plastic"}};
  node_antenna_1.add(mesh_antenna_1);
  meshes["antenna"] = mesh_antenna_1;
  colliders["antenna"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_antenna_1);

  const attachment_antenna_tip_2 = null;
  const endpoint_antenna_tip_2 = makeAttachmentEndpoint(attachment_antenna_tip_2);
  const node_antenna_tip_2 = new THREE.Group();
  node_antenna_tip_2.name = "\u5929\u7ebf\u9876\u7aef\u5706\u5934__pivot";
  if (endpoint_antenna_tip_2) {
    node_antenna_tip_2.position.copy(endpoint_antenna_tip_2.start);
    node_antenna_tip_2.rotation.set(0, 0, 0);
    node_antenna_tip_2.scale.set(1, 1, 1);
  } else {
    node_antenna_tip_2.position.set(0.24, 2.48, -0.08);
    node_antenna_tip_2.rotation.set(0.0, 0.0, 0.0);
    node_antenna_tip_2.scale.set(0.1, 0.13, 0.1);
  }
  node_antenna_tip_2.userData.sculptComponent = {"id": "antenna-tip", "name": "天线顶端圆头", "level": "meso", "role": "cap", "importance": 0.8, "confidence": 0.9, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.11, "height": 0.15, "depth": 0.11, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, 2.48, -0.08], "rotation": [0, 0, 0], "scale": [0.1, 0.13, 0.1]}, "actionProfile": {"animationRole": "cap", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-antenna", "materialLayers": ["mat-antenna"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23,24,26,1)", "secondaryAlbedo": "rgba(38,40,43,1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finishStyle": "satin domed cap"}};
  node_antenna_tip_2.userData.actionProfile = {"animationRole": "cap", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_antenna_tip_2);
  nodes["antenna-tip"] = node_antenna_tip_2;
  const mesh_antenna_tip_2Geometry = endpoint_antenna_tip_2
    ? new THREE.CylinderGeometry(endpoint_antenna_tip_2.endRadius, endpoint_antenna_tip_2.baseRadius, endpoint_antenna_tip_2.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_antenna_tip_2 = new THREE.Mesh(
    mesh_antenna_tip_2Geometry,
    materialMap["mat-antenna"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_antenna_tip_2.name = "\u5929\u7ebf\u9876\u7aef\u5706\u5934";
  if (endpoint_antenna_tip_2) {
    mesh_antenna_tip_2.position.copy(endpoint_antenna_tip_2.midpoint);
    mesh_antenna_tip_2.quaternion.copy(endpoint_antenna_tip_2.quaternion);
  }
  mesh_antenna_tip_2.castShadow = options.castShadow ?? true;
  mesh_antenna_tip_2.receiveShadow = options.receiveShadow ?? true;
  mesh_antenna_tip_2.userData.sculptComponent = {"id": "antenna-tip", "name": "天线顶端圆头", "level": "meso", "role": "cap", "importance": 0.8, "confidence": 0.9, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.11, "height": 0.15, "depth": 0.11, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, 2.48, -0.08], "rotation": [0, 0, 0], "scale": [0.1, 0.13, 0.1]}, "actionProfile": {"animationRole": "cap", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-antenna", "materialLayers": ["mat-antenna"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23,24,26,1)", "secondaryAlbedo": "rgba(38,40,43,1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finishStyle": "satin domed cap"}};
  node_antenna_tip_2.add(mesh_antenna_tip_2);
  meshes["antenna-tip"] = mesh_antenna_tip_2;
  colliders["antenna-tip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_antenna_tip_2);

  const attachment_antenna_collar_3 = null;
  const endpoint_antenna_collar_3 = makeAttachmentEndpoint(attachment_antenna_collar_3);
  const node_antenna_collar_3 = new THREE.Group();
  node_antenna_collar_3.name = "\u5929\u7ebf\u5e95\u90e8\u73af\u5ea7__pivot";
  if (endpoint_antenna_collar_3) {
    node_antenna_collar_3.position.copy(endpoint_antenna_collar_3.start);
    node_antenna_collar_3.rotation.set(0, 0, 0);
    node_antenna_collar_3.scale.set(1, 1, 1);
  } else {
    node_antenna_collar_3.position.set(0.24, 1.34, -0.08);
    node_antenna_collar_3.rotation.set(1.5708, 0.0, 0.0);
    node_antenna_collar_3.scale.set(0.22, 0.22, 0.55);
  }
  node_antenna_collar_3.userData.sculptComponent = {"id": "antenna-collar", "name": "天线底部环座", "level": "meso", "role": "collar", "importance": 0.8, "confidence": 0.9, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.28}, "parent": null, "attachment": null, "dimensions": {"width": 0.2, "height": 0.08, "depth": 0.2, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, 1.34, -0.08], "rotation": [1.5708, 0, 0], "scale": [0.22, 0.22, 0.55]}, "actionProfile": {"animationRole": "collar", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-antenna", "materialLayers": ["mat-antenna"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "collar-rings", "note": "叠层环座（两圈台阶）"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23,24,26,1)", "secondaryAlbedo": "rgba(38,40,43,1)", "materialClass": "plastic", "materialClassConfidence": 0.75, "finishStyle": "stacked collar rings"}};
  node_antenna_collar_3.userData.actionProfile = {"animationRole": "collar", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_antenna_collar_3);
  nodes["antenna-collar"] = node_antenna_collar_3;
  const mesh_antenna_collar_3Geometry = endpoint_antenna_collar_3
    ? new THREE.CylinderGeometry(endpoint_antenna_collar_3.endRadius, endpoint_antenna_collar_3.baseRadius, endpoint_antenna_collar_3.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.126, 24, 96);
  const mesh_antenna_collar_3 = new THREE.Mesh(
    mesh_antenna_collar_3Geometry,
    materialMap["mat-antenna"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_antenna_collar_3.name = "\u5929\u7ebf\u5e95\u90e8\u73af\u5ea7";
  if (endpoint_antenna_collar_3) {
    mesh_antenna_collar_3.position.copy(endpoint_antenna_collar_3.midpoint);
    mesh_antenna_collar_3.quaternion.copy(endpoint_antenna_collar_3.quaternion);
  }
  mesh_antenna_collar_3.castShadow = options.castShadow ?? true;
  mesh_antenna_collar_3.receiveShadow = options.receiveShadow ?? true;
  mesh_antenna_collar_3.userData.sculptComponent = {"id": "antenna-collar", "name": "天线底部环座", "level": "meso", "role": "collar", "importance": 0.8, "confidence": 0.9, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.28}, "parent": null, "attachment": null, "dimensions": {"width": 0.2, "height": 0.08, "depth": 0.2, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, 1.34, -0.08], "rotation": [1.5708, 0, 0], "scale": [0.22, 0.22, 0.55]}, "actionProfile": {"animationRole": "collar", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-antenna", "materialLayers": ["mat-antenna"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "collar-rings", "note": "叠层环座（两圈台阶）"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23,24,26,1)", "secondaryAlbedo": "rgba(38,40,43,1)", "materialClass": "plastic", "materialClassConfidence": 0.75, "finishStyle": "stacked collar rings"}};
  node_antenna_collar_3.add(mesh_antenna_collar_3);
  meshes["antenna-collar"] = mesh_antenna_collar_3;
  colliders["antenna-collar"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_antenna_collar_3);

  const attachment_earpiece_ring_4 = null;
  const endpoint_earpiece_ring_4 = makeAttachmentEndpoint(attachment_earpiece_ring_4);
  const node_earpiece_ring_4 = new THREE.Group();
  node_earpiece_ring_4.name = "\u542c\u7b52\u51f9\u4f4d\u8fb9\u6846__pivot";
  if (endpoint_earpiece_ring_4) {
    node_earpiece_ring_4.position.copy(endpoint_earpiece_ring_4.start);
    node_earpiece_ring_4.rotation.set(0, 0, 0);
    node_earpiece_ring_4.scale.set(1, 1, 1);
  } else {
    node_earpiece_ring_4.position.set(0.0, 0.92, 0.395);
    node_earpiece_ring_4.rotation.set(0.0, 0.0, 0.0);
    node_earpiece_ring_4.scale.set(0.5, 0.38, 0.18);
  }
  node_earpiece_ring_4.userData.sculptComponent = {"id": "earpiece-ring", "name": "听筒凹位边框", "level": "meso", "role": "trim", "importance": 0.8, "confidence": 0.9, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.1}, "parent": null, "attachment": null, "dimensions": {"width": 0.5, "height": 0.38, "depth": 0.1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.92, 0.395], "rotation": [0, 0, 0], "scale": [0.5, 0.38, 0.18]}, "actionProfile": {"animationRole": "trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-housing", "materialLayers": ["mat-housing"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27,29,31,1)", "secondaryAlbedo": "rgba(45,48,52,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "rounded-square recess rim"}};
  node_earpiece_ring_4.userData.actionProfile = {"animationRole": "trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_earpiece_ring_4);
  nodes["earpiece-ring"] = node_earpiece_ring_4;
  const mesh_earpiece_ring_4Geometry = endpoint_earpiece_ring_4
    ? new THREE.CylinderGeometry(endpoint_earpiece_ring_4.endRadius, endpoint_earpiece_ring_4.baseRadius, endpoint_earpiece_ring_4.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.045, 24, 96);
  const mesh_earpiece_ring_4 = new THREE.Mesh(
    mesh_earpiece_ring_4Geometry,
    materialMap["mat-housing"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_earpiece_ring_4.name = "\u542c\u7b52\u51f9\u4f4d\u8fb9\u6846";
  if (endpoint_earpiece_ring_4) {
    mesh_earpiece_ring_4.position.copy(endpoint_earpiece_ring_4.midpoint);
    mesh_earpiece_ring_4.quaternion.copy(endpoint_earpiece_ring_4.quaternion);
  }
  mesh_earpiece_ring_4.castShadow = options.castShadow ?? true;
  mesh_earpiece_ring_4.receiveShadow = options.receiveShadow ?? true;
  mesh_earpiece_ring_4.userData.sculptComponent = {"id": "earpiece-ring", "name": "听筒凹位边框", "level": "meso", "role": "trim", "importance": 0.8, "confidence": 0.9, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.1}, "parent": null, "attachment": null, "dimensions": {"width": 0.5, "height": 0.38, "depth": 0.1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.92, 0.395], "rotation": [0, 0, 0], "scale": [0.5, 0.38, 0.18]}, "actionProfile": {"animationRole": "trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-housing", "materialLayers": ["mat-housing"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27,29,31,1)", "secondaryAlbedo": "rgba(45,48,52,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "rounded-square recess rim"}};
  node_earpiece_ring_4.add(mesh_earpiece_ring_4);
  meshes["earpiece-ring"] = mesh_earpiece_ring_4;
  colliders["earpiece-ring"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_earpiece_ring_4);

  const attachment_earpiece_grille_5 = null;
  const endpoint_earpiece_grille_5 = makeAttachmentEndpoint(attachment_earpiece_grille_5);
  const node_earpiece_grille_5 = new THREE.Group();
  node_earpiece_grille_5.name = "\u542c\u7b52\u7f51\u9762__pivot";
  if (endpoint_earpiece_grille_5) {
    node_earpiece_grille_5.position.copy(endpoint_earpiece_grille_5.start);
    node_earpiece_grille_5.rotation.set(0, 0, 0);
    node_earpiece_grille_5.scale.set(1, 1, 1);
  } else {
    node_earpiece_grille_5.position.set(0.0, 0.92, 0.365);
    node_earpiece_grille_5.rotation.set(0.0, 0.0, 0.0);
    node_earpiece_grille_5.scale.set(0.42, 0.32, 0.08);
  }
  node_earpiece_grille_5.userData.sculptComponent = {"id": "earpiece-grille", "name": "听筒网面", "level": "meso", "role": "grille", "importance": 0.8, "confidence": 0.9, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.42, "height": 0.32, "depth": 0.08, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.92, 0.365], "rotation": [0, 0, 0], "scale": [0.42, 0.32, 0.08]}, "actionProfile": {"animationRole": "grille", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-grille", "materialLayers": ["mat-grille"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "perf-holes", "note": "蜂窝开孔（同心环排布，真实几何孔）"}], "surfaceDetail": {"macroRoughness": 0.7, "microRoughness": 0.4, "bumpAmplitude": 0.2, "normalPattern": "perforated", "displacementPattern": "", "occlusionPattern": "hole interior dark", "edgeWearPattern": "", "notes": "孔内近黑"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(36,38,40,1)", "secondaryAlbedo": "rgba(20,21,23,1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finishStyle": "perforated dark grille"}};
  node_earpiece_grille_5.userData.actionProfile = {"animationRole": "grille", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_earpiece_grille_5);
  nodes["earpiece-grille"] = node_earpiece_grille_5;
  const mesh_earpiece_grille_5Geometry = endpoint_earpiece_grille_5
    ? new THREE.CylinderGeometry(endpoint_earpiece_grille_5.endRadius, endpoint_earpiece_grille_5.baseRadius, endpoint_earpiece_grille_5.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_earpiece_grille_5 = new THREE.Mesh(
    mesh_earpiece_grille_5Geometry,
    materialMap["mat-grille"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_earpiece_grille_5.name = "\u542c\u7b52\u7f51\u9762";
  if (endpoint_earpiece_grille_5) {
    mesh_earpiece_grille_5.position.copy(endpoint_earpiece_grille_5.midpoint);
    mesh_earpiece_grille_5.quaternion.copy(endpoint_earpiece_grille_5.quaternion);
  }
  mesh_earpiece_grille_5.castShadow = options.castShadow ?? true;
  mesh_earpiece_grille_5.receiveShadow = options.receiveShadow ?? true;
  mesh_earpiece_grille_5.userData.sculptComponent = {"id": "earpiece-grille", "name": "听筒网面", "level": "meso", "role": "grille", "importance": 0.8, "confidence": 0.9, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.42, "height": 0.32, "depth": 0.08, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.92, 0.365], "rotation": [0, 0, 0], "scale": [0.42, 0.32, 0.08]}, "actionProfile": {"animationRole": "grille", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-grille", "materialLayers": ["mat-grille"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "perf-holes", "note": "蜂窝开孔（同心环排布，真实几何孔）"}], "surfaceDetail": {"macroRoughness": 0.7, "microRoughness": 0.4, "bumpAmplitude": 0.2, "normalPattern": "perforated", "displacementPattern": "", "occlusionPattern": "hole interior dark", "edgeWearPattern": "", "notes": "孔内近黑"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(36,38,40,1)", "secondaryAlbedo": "rgba(20,21,23,1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finishStyle": "perforated dark grille"}};
  node_earpiece_grille_5.add(mesh_earpiece_grille_5);
  meshes["earpiece-grille"] = mesh_earpiece_grille_5;
  colliders["earpiece-grille"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_earpiece_grille_5);

  const attachment_screen_bezel_6 = null;
  const endpoint_screen_bezel_6 = makeAttachmentEndpoint(attachment_screen_bezel_6);
  const node_screen_bezel_6 = new THREE.Group();
  node_screen_bezel_6.name = "\u5c4f\u5e55\u8fb9\u6846__pivot";
  if (endpoint_screen_bezel_6) {
    node_screen_bezel_6.position.copy(endpoint_screen_bezel_6.start);
    node_screen_bezel_6.rotation.set(0, 0, 0);
    node_screen_bezel_6.scale.set(1, 1, 1);
  } else {
    node_screen_bezel_6.position.set(0.0, 0.38, 0.36);
    node_screen_bezel_6.rotation.set(0.0, 0.0, 0.0);
    node_screen_bezel_6.scale.set(1.0, 1.0, 1.0);
  }
  node_screen_bezel_6.userData.sculptComponent = {"id": "screen-bezel", "name": "屏幕边框", "level": "meso", "role": "frame", "importance": 0.8, "confidence": 0.9, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.31, -0.23], [0.31, -0.23], [0.31, 0.23], [-0.31, 0.23]], "depth": 0.06, "holes": [[[-0.26, -0.18], [0.26, -0.18], [0.26, 0.18], [-0.26, 0.18]]]}}, "parent": null, "attachment": null, "dimensions": {"width": 0.62, "height": 0.46, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.38, 0.36], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-housing", "materialLayers": ["mat-housing"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27,29,31,1)", "secondaryAlbedo": "rgba(45,48,52,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "raised bezel frame"}};
  node_screen_bezel_6.userData.actionProfile = {"animationRole": "frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_screen_bezel_6);
  nodes["screen-bezel"] = node_screen_bezel_6;
  const mesh_screen_bezel_6Geometry = endpoint_screen_bezel_6
    ? new THREE.CylinderGeometry(endpoint_screen_bezel_6.endRadius, endpoint_screen_bezel_6.baseRadius, endpoint_screen_bezel_6.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.31, -0.23], [0.31, -0.23], [0.31, 0.23], [-0.31, 0.23]], "depth": 0.06, "holes": [[[-0.26, -0.18], [0.26, -0.18], [0.26, 0.18], [-0.26, 0.18]]]});
  const mesh_screen_bezel_6 = new THREE.Mesh(
    mesh_screen_bezel_6Geometry,
    materialMap["mat-housing"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_screen_bezel_6.name = "\u5c4f\u5e55\u8fb9\u6846";
  if (endpoint_screen_bezel_6) {
    mesh_screen_bezel_6.position.copy(endpoint_screen_bezel_6.midpoint);
    mesh_screen_bezel_6.quaternion.copy(endpoint_screen_bezel_6.quaternion);
  }
  mesh_screen_bezel_6.castShadow = options.castShadow ?? true;
  mesh_screen_bezel_6.receiveShadow = options.receiveShadow ?? true;
  mesh_screen_bezel_6.userData.sculptComponent = {"id": "screen-bezel", "name": "屏幕边框", "level": "meso", "role": "frame", "importance": 0.8, "confidence": 0.9, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.31, -0.23], [0.31, -0.23], [0.31, 0.23], [-0.31, 0.23]], "depth": 0.06, "holes": [[[-0.26, -0.18], [0.26, -0.18], [0.26, 0.18], [-0.26, 0.18]]]}}, "parent": null, "attachment": null, "dimensions": {"width": 0.62, "height": 0.46, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.38, 0.36], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-housing", "materialLayers": ["mat-housing"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27,29,31,1)", "secondaryAlbedo": "rgba(45,48,52,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "raised bezel frame"}};
  node_screen_bezel_6.add(mesh_screen_bezel_6);
  meshes["screen-bezel"] = mesh_screen_bezel_6;
  colliders["screen-bezel"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_screen_bezel_6);

  const attachment_screen_glass_7 = null;
  const endpoint_screen_glass_7 = makeAttachmentEndpoint(attachment_screen_glass_7);
  const node_screen_glass_7 = new THREE.Group();
  node_screen_glass_7.name = "\u5c4f\u5e55\u73bb\u7483__pivot";
  if (endpoint_screen_glass_7) {
    node_screen_glass_7.position.copy(endpoint_screen_glass_7.start);
    node_screen_glass_7.rotation.set(0, 0, 0);
    node_screen_glass_7.scale.set(1, 1, 1);
  } else {
    node_screen_glass_7.position.set(0.0, 0.38, 0.375);
    node_screen_glass_7.rotation.set(0.0, 0.0, 0.0);
    node_screen_glass_7.scale.set(0.52, 0.36, 0.04);
  }
  node_screen_glass_7.userData.sculptComponent = {"id": "screen-glass", "name": "屏幕玻璃", "level": "meso", "role": "screen", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.52, "height": 0.36, "depth": 0.04, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.38, 0.375], "rotation": [0, 0, 0], "scale": [0.52, 0.36, 0.04]}, "actionProfile": {"animationRole": "screen", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-screen", "materialLayers": ["mat-screen"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(121,133,124,1)", "secondaryAlbedo": "rgba(93,106,98,1)", "materialClass": "glass", "materialClassConfidence": 0.9, "finishStyle": "green-gray LCD glass, off"}};
  node_screen_glass_7.userData.actionProfile = {"animationRole": "screen", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_screen_glass_7);
  nodes["screen-glass"] = node_screen_glass_7;
  const mesh_screen_glass_7Geometry = endpoint_screen_glass_7
    ? new THREE.CylinderGeometry(endpoint_screen_glass_7.endRadius, endpoint_screen_glass_7.baseRadius, endpoint_screen_glass_7.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_screen_glass_7 = new THREE.Mesh(
    mesh_screen_glass_7Geometry,
    materialMap["mat-screen"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_screen_glass_7.name = "\u5c4f\u5e55\u73bb\u7483";
  if (endpoint_screen_glass_7) {
    mesh_screen_glass_7.position.copy(endpoint_screen_glass_7.midpoint);
    mesh_screen_glass_7.quaternion.copy(endpoint_screen_glass_7.quaternion);
  }
  mesh_screen_glass_7.castShadow = options.castShadow ?? true;
  mesh_screen_glass_7.receiveShadow = options.receiveShadow ?? true;
  mesh_screen_glass_7.userData.sculptComponent = {"id": "screen-glass", "name": "屏幕玻璃", "level": "meso", "role": "screen", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.52, "height": 0.36, "depth": 0.04, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.38, 0.375], "rotation": [0, 0, 0], "scale": [0.52, 0.36, 0.04]}, "actionProfile": {"animationRole": "screen", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-screen", "materialLayers": ["mat-screen"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(121,133,124,1)", "secondaryAlbedo": "rgba(93,106,98,1)", "materialClass": "glass", "materialClassConfidence": 0.9, "finishStyle": "green-gray LCD glass, off"}};
  node_screen_glass_7.add(mesh_screen_glass_7);
  meshes["screen-glass"] = mesh_screen_glass_7;
  colliders["screen-glass"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_screen_glass_7);

  const attachment_keypad_well_8 = null;
  const endpoint_keypad_well_8 = makeAttachmentEndpoint(attachment_keypad_well_8);
  const node_keypad_well_8 = new THREE.Group();
  node_keypad_well_8.name = "\u952e\u76d8\u51f9\u677f__pivot";
  if (endpoint_keypad_well_8) {
    node_keypad_well_8.position.copy(endpoint_keypad_well_8.start);
    node_keypad_well_8.rotation.set(0, 0, 0);
    node_keypad_well_8.scale.set(1, 1, 1);
  } else {
    node_keypad_well_8.position.set(0.0, -0.52, 0.375);
    node_keypad_well_8.rotation.set(0.0, 0.0, 0.0);
    node_keypad_well_8.scale.set(0.74, 1.04, 0.05);
  }
  node_keypad_well_8.userData.sculptComponent = {"id": "keypad-well", "name": "键盘凹板", "level": "meso", "role": "panel", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.74, "height": 1.04, "depth": 0.05, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, -0.52, 0.375], "rotation": [0, 0, 0], "scale": [0.74, 1.04, 0.05]}, "actionProfile": {"animationRole": "panel", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-housing", "materialLayers": ["mat-housing"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "key-glyphs", "note": "键帽白色印刷字符（1-9/*/0/#）"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27,29,31,1)", "secondaryAlbedo": "rgba(45,48,52,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "recessed keypad panel"}};
  node_keypad_well_8.userData.actionProfile = {"animationRole": "panel", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_keypad_well_8);
  nodes["keypad-well"] = node_keypad_well_8;
  const mesh_keypad_well_8Geometry = endpoint_keypad_well_8
    ? new THREE.CylinderGeometry(endpoint_keypad_well_8.endRadius, endpoint_keypad_well_8.baseRadius, endpoint_keypad_well_8.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_keypad_well_8 = new THREE.Mesh(
    mesh_keypad_well_8Geometry,
    materialMap["mat-housing"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_keypad_well_8.name = "\u952e\u76d8\u51f9\u677f";
  if (endpoint_keypad_well_8) {
    mesh_keypad_well_8.position.copy(endpoint_keypad_well_8.midpoint);
    mesh_keypad_well_8.quaternion.copy(endpoint_keypad_well_8.quaternion);
  }
  mesh_keypad_well_8.castShadow = options.castShadow ?? true;
  mesh_keypad_well_8.receiveShadow = options.receiveShadow ?? true;
  mesh_keypad_well_8.userData.sculptComponent = {"id": "keypad-well", "name": "键盘凹板", "level": "meso", "role": "panel", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.74, "height": 1.04, "depth": 0.05, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, -0.52, 0.375], "rotation": [0, 0, 0], "scale": [0.74, 1.04, 0.05]}, "actionProfile": {"animationRole": "panel", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-housing", "materialLayers": ["mat-housing"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "key-glyphs", "note": "键帽白色印刷字符（1-9/*/0/#）"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(27,29,31,1)", "secondaryAlbedo": "rgba(45,48,52,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "recessed keypad panel"}};
  node_keypad_well_8.add(mesh_keypad_well_8);
  meshes["keypad-well"] = mesh_keypad_well_8;
  colliders["keypad-well"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_keypad_well_8);

  const attachment_key_fn_red_9 = null;
  const endpoint_key_fn_red_9 = makeAttachmentEndpoint(attachment_key_fn_red_9);
  const node_key_fn_red_9 = new THREE.Group();
  node_key_fn_red_9.name = "\u529f\u80fd\u952e__pivot";
  if (endpoint_key_fn_red_9) {
    node_key_fn_red_9.position.copy(endpoint_key_fn_red_9.start);
    node_key_fn_red_9.rotation.set(0, 0, 0);
    node_key_fn_red_9.scale.set(1, 1, 1);
  } else {
    node_key_fn_red_9.position.set(-0.24, -0.15, 0.395);
    node_key_fn_red_9.rotation.set(0.0, 0.0, 0.0);
    node_key_fn_red_9.scale.set(0.18, 0.1, 0.06);
  }
  node_key_fn_red_9.userData.sculptComponent = {"id": "key-fn-red", "name": "功能键", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.1, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.15, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.1, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-fn-red", "materialLayers": ["mat-fn-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(194,64,48,1)", "secondaryAlbedo": "rgba(194,64,48,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "colored function keycap"}};
  node_key_fn_red_9.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_fn_red_9);
  nodes["key-fn-red"] = node_key_fn_red_9;
  const mesh_key_fn_red_9Geometry = endpoint_key_fn_red_9
    ? new THREE.CylinderGeometry(endpoint_key_fn_red_9.endRadius, endpoint_key_fn_red_9.baseRadius, endpoint_key_fn_red_9.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_fn_red_9 = new THREE.Mesh(
    mesh_key_fn_red_9Geometry,
    materialMap["mat-fn-red"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_fn_red_9.name = "\u529f\u80fd\u952e";
  if (endpoint_key_fn_red_9) {
    mesh_key_fn_red_9.position.copy(endpoint_key_fn_red_9.midpoint);
    mesh_key_fn_red_9.quaternion.copy(endpoint_key_fn_red_9.quaternion);
  }
  mesh_key_fn_red_9.castShadow = options.castShadow ?? true;
  mesh_key_fn_red_9.receiveShadow = options.receiveShadow ?? true;
  mesh_key_fn_red_9.userData.sculptComponent = {"id": "key-fn-red", "name": "功能键", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.1, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.15, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.1, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-fn-red", "materialLayers": ["mat-fn-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(194,64,48,1)", "secondaryAlbedo": "rgba(194,64,48,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "colored function keycap"}};
  node_key_fn_red_9.add(mesh_key_fn_red_9);
  meshes["key-fn-red"] = mesh_key_fn_red_9;
  colliders["key-fn-red"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_fn_red_9);

  const attachment_key_fn_yellow_10 = null;
  const endpoint_key_fn_yellow_10 = makeAttachmentEndpoint(attachment_key_fn_yellow_10);
  const node_key_fn_yellow_10 = new THREE.Group();
  node_key_fn_yellow_10.name = "\u529f\u80fd\u952e__pivot";
  if (endpoint_key_fn_yellow_10) {
    node_key_fn_yellow_10.position.copy(endpoint_key_fn_yellow_10.start);
    node_key_fn_yellow_10.rotation.set(0, 0, 0);
    node_key_fn_yellow_10.scale.set(1, 1, 1);
  } else {
    node_key_fn_yellow_10.position.set(0.0, -0.15, 0.395);
    node_key_fn_yellow_10.rotation.set(0.0, 0.0, 0.0);
    node_key_fn_yellow_10.scale.set(0.18, 0.1, 0.06);
  }
  node_key_fn_yellow_10.userData.sculptComponent = {"id": "key-fn-yellow", "name": "功能键", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.1, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.15, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.1, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-fn-yellow", "materialLayers": ["mat-fn-yellow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(232,187,53,1)", "secondaryAlbedo": "rgba(232,187,53,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "colored function keycap"}};
  node_key_fn_yellow_10.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_fn_yellow_10);
  nodes["key-fn-yellow"] = node_key_fn_yellow_10;
  const mesh_key_fn_yellow_10Geometry = endpoint_key_fn_yellow_10
    ? new THREE.CylinderGeometry(endpoint_key_fn_yellow_10.endRadius, endpoint_key_fn_yellow_10.baseRadius, endpoint_key_fn_yellow_10.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_fn_yellow_10 = new THREE.Mesh(
    mesh_key_fn_yellow_10Geometry,
    materialMap["mat-fn-yellow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_fn_yellow_10.name = "\u529f\u80fd\u952e";
  if (endpoint_key_fn_yellow_10) {
    mesh_key_fn_yellow_10.position.copy(endpoint_key_fn_yellow_10.midpoint);
    mesh_key_fn_yellow_10.quaternion.copy(endpoint_key_fn_yellow_10.quaternion);
  }
  mesh_key_fn_yellow_10.castShadow = options.castShadow ?? true;
  mesh_key_fn_yellow_10.receiveShadow = options.receiveShadow ?? true;
  mesh_key_fn_yellow_10.userData.sculptComponent = {"id": "key-fn-yellow", "name": "功能键", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.1, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.15, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.1, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-fn-yellow", "materialLayers": ["mat-fn-yellow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(232,187,53,1)", "secondaryAlbedo": "rgba(232,187,53,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "colored function keycap"}};
  node_key_fn_yellow_10.add(mesh_key_fn_yellow_10);
  meshes["key-fn-yellow"] = mesh_key_fn_yellow_10;
  colliders["key-fn-yellow"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_fn_yellow_10);

  const attachment_key_fn_green_11 = null;
  const endpoint_key_fn_green_11 = makeAttachmentEndpoint(attachment_key_fn_green_11);
  const node_key_fn_green_11 = new THREE.Group();
  node_key_fn_green_11.name = "\u529f\u80fd\u952e__pivot";
  if (endpoint_key_fn_green_11) {
    node_key_fn_green_11.position.copy(endpoint_key_fn_green_11.start);
    node_key_fn_green_11.rotation.set(0, 0, 0);
    node_key_fn_green_11.scale.set(1, 1, 1);
  } else {
    node_key_fn_green_11.position.set(0.24, -0.15, 0.395);
    node_key_fn_green_11.rotation.set(0.0, 0.0, 0.0);
    node_key_fn_green_11.scale.set(0.18, 0.1, 0.06);
  }
  node_key_fn_green_11.userData.sculptComponent = {"id": "key-fn-green", "name": "功能键", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.1, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.15, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.1, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-fn-green", "materialLayers": ["mat-fn-green"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(53,160,96,1)", "secondaryAlbedo": "rgba(53,160,96,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "colored function keycap"}};
  node_key_fn_green_11.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_fn_green_11);
  nodes["key-fn-green"] = node_key_fn_green_11;
  const mesh_key_fn_green_11Geometry = endpoint_key_fn_green_11
    ? new THREE.CylinderGeometry(endpoint_key_fn_green_11.endRadius, endpoint_key_fn_green_11.baseRadius, endpoint_key_fn_green_11.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_fn_green_11 = new THREE.Mesh(
    mesh_key_fn_green_11Geometry,
    materialMap["mat-fn-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_fn_green_11.name = "\u529f\u80fd\u952e";
  if (endpoint_key_fn_green_11) {
    mesh_key_fn_green_11.position.copy(endpoint_key_fn_green_11.midpoint);
    mesh_key_fn_green_11.quaternion.copy(endpoint_key_fn_green_11.quaternion);
  }
  mesh_key_fn_green_11.castShadow = options.castShadow ?? true;
  mesh_key_fn_green_11.receiveShadow = options.receiveShadow ?? true;
  mesh_key_fn_green_11.userData.sculptComponent = {"id": "key-fn-green", "name": "功能键", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.1, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.15, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.1, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-fn-green", "materialLayers": ["mat-fn-green"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(53,160,96,1)", "secondaryAlbedo": "rgba(53,160,96,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "colored function keycap"}};
  node_key_fn_green_11.add(mesh_key_fn_green_11);
  meshes["key-fn-green"] = mesh_key_fn_green_11;
  colliders["key-fn-green"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_fn_green_11);

  const attachment_key_1_12 = null;
  const endpoint_key_1_12 = makeAttachmentEndpoint(attachment_key_1_12);
  const node_key_1_12 = new THREE.Group();
  node_key_1_12.name = "\u6570\u5b57\u952e 1__pivot";
  if (endpoint_key_1_12) {
    node_key_1_12.position.copy(endpoint_key_1_12.start);
    node_key_1_12.rotation.set(0, 0, 0);
    node_key_1_12.scale.set(1, 1, 1);
  } else {
    node_key_1_12.position.set(-0.24, -0.31, 0.395);
    node_key_1_12.rotation.set(0.0, 0.0, 0.0);
    node_key_1_12.scale.set(0.18, 0.13, 0.06);
  }
  node_key_1_12.userData.sculptComponent = {"id": "key-1", "name": "数字键 1", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.31, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_1_12.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_1_12);
  nodes["key-1"] = node_key_1_12;
  const mesh_key_1_12Geometry = endpoint_key_1_12
    ? new THREE.CylinderGeometry(endpoint_key_1_12.endRadius, endpoint_key_1_12.baseRadius, endpoint_key_1_12.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_1_12 = new THREE.Mesh(
    mesh_key_1_12Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_1_12.name = "\u6570\u5b57\u952e 1";
  if (endpoint_key_1_12) {
    mesh_key_1_12.position.copy(endpoint_key_1_12.midpoint);
    mesh_key_1_12.quaternion.copy(endpoint_key_1_12.quaternion);
  }
  mesh_key_1_12.castShadow = options.castShadow ?? true;
  mesh_key_1_12.receiveShadow = options.receiveShadow ?? true;
  mesh_key_1_12.userData.sculptComponent = {"id": "key-1", "name": "数字键 1", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.31, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_1_12.add(mesh_key_1_12);
  meshes["key-1"] = mesh_key_1_12;
  colliders["key-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_1_12);

  const attachment_key_2_13 = null;
  const endpoint_key_2_13 = makeAttachmentEndpoint(attachment_key_2_13);
  const node_key_2_13 = new THREE.Group();
  node_key_2_13.name = "\u6570\u5b57\u952e 2__pivot";
  if (endpoint_key_2_13) {
    node_key_2_13.position.copy(endpoint_key_2_13.start);
    node_key_2_13.rotation.set(0, 0, 0);
    node_key_2_13.scale.set(1, 1, 1);
  } else {
    node_key_2_13.position.set(0.0, -0.31, 0.395);
    node_key_2_13.rotation.set(0.0, 0.0, 0.0);
    node_key_2_13.scale.set(0.18, 0.13, 0.06);
  }
  node_key_2_13.userData.sculptComponent = {"id": "key-2", "name": "数字键 2", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.31, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_2_13.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_2_13);
  nodes["key-2"] = node_key_2_13;
  const mesh_key_2_13Geometry = endpoint_key_2_13
    ? new THREE.CylinderGeometry(endpoint_key_2_13.endRadius, endpoint_key_2_13.baseRadius, endpoint_key_2_13.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_2_13 = new THREE.Mesh(
    mesh_key_2_13Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_2_13.name = "\u6570\u5b57\u952e 2";
  if (endpoint_key_2_13) {
    mesh_key_2_13.position.copy(endpoint_key_2_13.midpoint);
    mesh_key_2_13.quaternion.copy(endpoint_key_2_13.quaternion);
  }
  mesh_key_2_13.castShadow = options.castShadow ?? true;
  mesh_key_2_13.receiveShadow = options.receiveShadow ?? true;
  mesh_key_2_13.userData.sculptComponent = {"id": "key-2", "name": "数字键 2", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.31, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_2_13.add(mesh_key_2_13);
  meshes["key-2"] = mesh_key_2_13;
  colliders["key-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_2_13);

  const attachment_key_3_14 = null;
  const endpoint_key_3_14 = makeAttachmentEndpoint(attachment_key_3_14);
  const node_key_3_14 = new THREE.Group();
  node_key_3_14.name = "\u6570\u5b57\u952e 3__pivot";
  if (endpoint_key_3_14) {
    node_key_3_14.position.copy(endpoint_key_3_14.start);
    node_key_3_14.rotation.set(0, 0, 0);
    node_key_3_14.scale.set(1, 1, 1);
  } else {
    node_key_3_14.position.set(0.24, -0.31, 0.395);
    node_key_3_14.rotation.set(0.0, 0.0, 0.0);
    node_key_3_14.scale.set(0.18, 0.13, 0.06);
  }
  node_key_3_14.userData.sculptComponent = {"id": "key-3", "name": "数字键 3", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.31, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_3_14.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_3_14);
  nodes["key-3"] = node_key_3_14;
  const mesh_key_3_14Geometry = endpoint_key_3_14
    ? new THREE.CylinderGeometry(endpoint_key_3_14.endRadius, endpoint_key_3_14.baseRadius, endpoint_key_3_14.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_3_14 = new THREE.Mesh(
    mesh_key_3_14Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_3_14.name = "\u6570\u5b57\u952e 3";
  if (endpoint_key_3_14) {
    mesh_key_3_14.position.copy(endpoint_key_3_14.midpoint);
    mesh_key_3_14.quaternion.copy(endpoint_key_3_14.quaternion);
  }
  mesh_key_3_14.castShadow = options.castShadow ?? true;
  mesh_key_3_14.receiveShadow = options.receiveShadow ?? true;
  mesh_key_3_14.userData.sculptComponent = {"id": "key-3", "name": "数字键 3", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.31, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_3_14.add(mesh_key_3_14);
  meshes["key-3"] = mesh_key_3_14;
  colliders["key-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_3_14);

  const attachment_key_4_15 = null;
  const endpoint_key_4_15 = makeAttachmentEndpoint(attachment_key_4_15);
  const node_key_4_15 = new THREE.Group();
  node_key_4_15.name = "\u6570\u5b57\u952e 4__pivot";
  if (endpoint_key_4_15) {
    node_key_4_15.position.copy(endpoint_key_4_15.start);
    node_key_4_15.rotation.set(0, 0, 0);
    node_key_4_15.scale.set(1, 1, 1);
  } else {
    node_key_4_15.position.set(-0.24, -0.49, 0.395);
    node_key_4_15.rotation.set(0.0, 0.0, 0.0);
    node_key_4_15.scale.set(0.18, 0.13, 0.06);
  }
  node_key_4_15.userData.sculptComponent = {"id": "key-4", "name": "数字键 4", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.49, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_4_15.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_4_15);
  nodes["key-4"] = node_key_4_15;
  const mesh_key_4_15Geometry = endpoint_key_4_15
    ? new THREE.CylinderGeometry(endpoint_key_4_15.endRadius, endpoint_key_4_15.baseRadius, endpoint_key_4_15.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_4_15 = new THREE.Mesh(
    mesh_key_4_15Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_4_15.name = "\u6570\u5b57\u952e 4";
  if (endpoint_key_4_15) {
    mesh_key_4_15.position.copy(endpoint_key_4_15.midpoint);
    mesh_key_4_15.quaternion.copy(endpoint_key_4_15.quaternion);
  }
  mesh_key_4_15.castShadow = options.castShadow ?? true;
  mesh_key_4_15.receiveShadow = options.receiveShadow ?? true;
  mesh_key_4_15.userData.sculptComponent = {"id": "key-4", "name": "数字键 4", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.49, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_4_15.add(mesh_key_4_15);
  meshes["key-4"] = mesh_key_4_15;
  colliders["key-4"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_4_15);

  const attachment_key_5_16 = null;
  const endpoint_key_5_16 = makeAttachmentEndpoint(attachment_key_5_16);
  const node_key_5_16 = new THREE.Group();
  node_key_5_16.name = "\u6570\u5b57\u952e 5__pivot";
  if (endpoint_key_5_16) {
    node_key_5_16.position.copy(endpoint_key_5_16.start);
    node_key_5_16.rotation.set(0, 0, 0);
    node_key_5_16.scale.set(1, 1, 1);
  } else {
    node_key_5_16.position.set(0.0, -0.49, 0.395);
    node_key_5_16.rotation.set(0.0, 0.0, 0.0);
    node_key_5_16.scale.set(0.18, 0.13, 0.06);
  }
  node_key_5_16.userData.sculptComponent = {"id": "key-5", "name": "数字键 5", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.49, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_5_16.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_5_16);
  nodes["key-5"] = node_key_5_16;
  const mesh_key_5_16Geometry = endpoint_key_5_16
    ? new THREE.CylinderGeometry(endpoint_key_5_16.endRadius, endpoint_key_5_16.baseRadius, endpoint_key_5_16.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_5_16 = new THREE.Mesh(
    mesh_key_5_16Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_5_16.name = "\u6570\u5b57\u952e 5";
  if (endpoint_key_5_16) {
    mesh_key_5_16.position.copy(endpoint_key_5_16.midpoint);
    mesh_key_5_16.quaternion.copy(endpoint_key_5_16.quaternion);
  }
  mesh_key_5_16.castShadow = options.castShadow ?? true;
  mesh_key_5_16.receiveShadow = options.receiveShadow ?? true;
  mesh_key_5_16.userData.sculptComponent = {"id": "key-5", "name": "数字键 5", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.49, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_5_16.add(mesh_key_5_16);
  meshes["key-5"] = mesh_key_5_16;
  colliders["key-5"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_5_16);

  const attachment_key_6_17 = null;
  const endpoint_key_6_17 = makeAttachmentEndpoint(attachment_key_6_17);
  const node_key_6_17 = new THREE.Group();
  node_key_6_17.name = "\u6570\u5b57\u952e 6__pivot";
  if (endpoint_key_6_17) {
    node_key_6_17.position.copy(endpoint_key_6_17.start);
    node_key_6_17.rotation.set(0, 0, 0);
    node_key_6_17.scale.set(1, 1, 1);
  } else {
    node_key_6_17.position.set(0.24, -0.49, 0.395);
    node_key_6_17.rotation.set(0.0, 0.0, 0.0);
    node_key_6_17.scale.set(0.18, 0.13, 0.06);
  }
  node_key_6_17.userData.sculptComponent = {"id": "key-6", "name": "数字键 6", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.49, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_6_17.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_6_17);
  nodes["key-6"] = node_key_6_17;
  const mesh_key_6_17Geometry = endpoint_key_6_17
    ? new THREE.CylinderGeometry(endpoint_key_6_17.endRadius, endpoint_key_6_17.baseRadius, endpoint_key_6_17.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_6_17 = new THREE.Mesh(
    mesh_key_6_17Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_6_17.name = "\u6570\u5b57\u952e 6";
  if (endpoint_key_6_17) {
    mesh_key_6_17.position.copy(endpoint_key_6_17.midpoint);
    mesh_key_6_17.quaternion.copy(endpoint_key_6_17.quaternion);
  }
  mesh_key_6_17.castShadow = options.castShadow ?? true;
  mesh_key_6_17.receiveShadow = options.receiveShadow ?? true;
  mesh_key_6_17.userData.sculptComponent = {"id": "key-6", "name": "数字键 6", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.49, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_6_17.add(mesh_key_6_17);
  meshes["key-6"] = mesh_key_6_17;
  colliders["key-6"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_6_17);

  const attachment_key_7_18 = null;
  const endpoint_key_7_18 = makeAttachmentEndpoint(attachment_key_7_18);
  const node_key_7_18 = new THREE.Group();
  node_key_7_18.name = "\u6570\u5b57\u952e 7__pivot";
  if (endpoint_key_7_18) {
    node_key_7_18.position.copy(endpoint_key_7_18.start);
    node_key_7_18.rotation.set(0, 0, 0);
    node_key_7_18.scale.set(1, 1, 1);
  } else {
    node_key_7_18.position.set(-0.24, -0.6699999999999999, 0.395);
    node_key_7_18.rotation.set(0.0, 0.0, 0.0);
    node_key_7_18.scale.set(0.18, 0.13, 0.06);
  }
  node_key_7_18.userData.sculptComponent = {"id": "key-7", "name": "数字键 7", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.6699999999999999, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_7_18.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_7_18);
  nodes["key-7"] = node_key_7_18;
  const mesh_key_7_18Geometry = endpoint_key_7_18
    ? new THREE.CylinderGeometry(endpoint_key_7_18.endRadius, endpoint_key_7_18.baseRadius, endpoint_key_7_18.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_7_18 = new THREE.Mesh(
    mesh_key_7_18Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_7_18.name = "\u6570\u5b57\u952e 7";
  if (endpoint_key_7_18) {
    mesh_key_7_18.position.copy(endpoint_key_7_18.midpoint);
    mesh_key_7_18.quaternion.copy(endpoint_key_7_18.quaternion);
  }
  mesh_key_7_18.castShadow = options.castShadow ?? true;
  mesh_key_7_18.receiveShadow = options.receiveShadow ?? true;
  mesh_key_7_18.userData.sculptComponent = {"id": "key-7", "name": "数字键 7", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.6699999999999999, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_7_18.add(mesh_key_7_18);
  meshes["key-7"] = mesh_key_7_18;
  colliders["key-7"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_7_18);

  const attachment_key_8_19 = null;
  const endpoint_key_8_19 = makeAttachmentEndpoint(attachment_key_8_19);
  const node_key_8_19 = new THREE.Group();
  node_key_8_19.name = "\u6570\u5b57\u952e 8__pivot";
  if (endpoint_key_8_19) {
    node_key_8_19.position.copy(endpoint_key_8_19.start);
    node_key_8_19.rotation.set(0, 0, 0);
    node_key_8_19.scale.set(1, 1, 1);
  } else {
    node_key_8_19.position.set(0.0, -0.6699999999999999, 0.395);
    node_key_8_19.rotation.set(0.0, 0.0, 0.0);
    node_key_8_19.scale.set(0.18, 0.13, 0.06);
  }
  node_key_8_19.userData.sculptComponent = {"id": "key-8", "name": "数字键 8", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.6699999999999999, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_8_19.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_8_19);
  nodes["key-8"] = node_key_8_19;
  const mesh_key_8_19Geometry = endpoint_key_8_19
    ? new THREE.CylinderGeometry(endpoint_key_8_19.endRadius, endpoint_key_8_19.baseRadius, endpoint_key_8_19.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_8_19 = new THREE.Mesh(
    mesh_key_8_19Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_8_19.name = "\u6570\u5b57\u952e 8";
  if (endpoint_key_8_19) {
    mesh_key_8_19.position.copy(endpoint_key_8_19.midpoint);
    mesh_key_8_19.quaternion.copy(endpoint_key_8_19.quaternion);
  }
  mesh_key_8_19.castShadow = options.castShadow ?? true;
  mesh_key_8_19.receiveShadow = options.receiveShadow ?? true;
  mesh_key_8_19.userData.sculptComponent = {"id": "key-8", "name": "数字键 8", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.6699999999999999, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_8_19.add(mesh_key_8_19);
  meshes["key-8"] = mesh_key_8_19;
  colliders["key-8"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_8_19);

  const attachment_key_9_20 = null;
  const endpoint_key_9_20 = makeAttachmentEndpoint(attachment_key_9_20);
  const node_key_9_20 = new THREE.Group();
  node_key_9_20.name = "\u6570\u5b57\u952e 9__pivot";
  if (endpoint_key_9_20) {
    node_key_9_20.position.copy(endpoint_key_9_20.start);
    node_key_9_20.rotation.set(0, 0, 0);
    node_key_9_20.scale.set(1, 1, 1);
  } else {
    node_key_9_20.position.set(0.24, -0.6699999999999999, 0.395);
    node_key_9_20.rotation.set(0.0, 0.0, 0.0);
    node_key_9_20.scale.set(0.18, 0.13, 0.06);
  }
  node_key_9_20.userData.sculptComponent = {"id": "key-9", "name": "数字键 9", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.6699999999999999, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_9_20.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_9_20);
  nodes["key-9"] = node_key_9_20;
  const mesh_key_9_20Geometry = endpoint_key_9_20
    ? new THREE.CylinderGeometry(endpoint_key_9_20.endRadius, endpoint_key_9_20.baseRadius, endpoint_key_9_20.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_9_20 = new THREE.Mesh(
    mesh_key_9_20Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_9_20.name = "\u6570\u5b57\u952e 9";
  if (endpoint_key_9_20) {
    mesh_key_9_20.position.copy(endpoint_key_9_20.midpoint);
    mesh_key_9_20.quaternion.copy(endpoint_key_9_20.quaternion);
  }
  mesh_key_9_20.castShadow = options.castShadow ?? true;
  mesh_key_9_20.receiveShadow = options.receiveShadow ?? true;
  mesh_key_9_20.userData.sculptComponent = {"id": "key-9", "name": "数字键 9", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.6699999999999999, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_9_20.add(mesh_key_9_20);
  meshes["key-9"] = mesh_key_9_20;
  colliders["key-9"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_9_20);

  const attachment_key_star_21 = null;
  const endpoint_key_star_21 = makeAttachmentEndpoint(attachment_key_star_21);
  const node_key_star_21 = new THREE.Group();
  node_key_star_21.name = "\u6570\u5b57\u952e star__pivot";
  if (endpoint_key_star_21) {
    node_key_star_21.position.copy(endpoint_key_star_21.start);
    node_key_star_21.rotation.set(0, 0, 0);
    node_key_star_21.scale.set(1, 1, 1);
  } else {
    node_key_star_21.position.set(-0.24, -0.8500000000000001, 0.395);
    node_key_star_21.rotation.set(0.0, 0.0, 0.0);
    node_key_star_21.scale.set(0.18, 0.13, 0.06);
  }
  node_key_star_21.userData.sculptComponent = {"id": "key-star", "name": "数字键 star", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.8500000000000001, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_star_21.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_star_21);
  nodes["key-star"] = node_key_star_21;
  const mesh_key_star_21Geometry = endpoint_key_star_21
    ? new THREE.CylinderGeometry(endpoint_key_star_21.endRadius, endpoint_key_star_21.baseRadius, endpoint_key_star_21.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_star_21 = new THREE.Mesh(
    mesh_key_star_21Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_star_21.name = "\u6570\u5b57\u952e star";
  if (endpoint_key_star_21) {
    mesh_key_star_21.position.copy(endpoint_key_star_21.midpoint);
    mesh_key_star_21.quaternion.copy(endpoint_key_star_21.quaternion);
  }
  mesh_key_star_21.castShadow = options.castShadow ?? true;
  mesh_key_star_21.receiveShadow = options.receiveShadow ?? true;
  mesh_key_star_21.userData.sculptComponent = {"id": "key-star", "name": "数字键 star", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.24, -0.8500000000000001, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_star_21.add(mesh_key_star_21);
  meshes["key-star"] = mesh_key_star_21;
  colliders["key-star"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_star_21);

  const attachment_key_0_22 = null;
  const endpoint_key_0_22 = makeAttachmentEndpoint(attachment_key_0_22);
  const node_key_0_22 = new THREE.Group();
  node_key_0_22.name = "\u6570\u5b57\u952e 0__pivot";
  if (endpoint_key_0_22) {
    node_key_0_22.position.copy(endpoint_key_0_22.start);
    node_key_0_22.rotation.set(0, 0, 0);
    node_key_0_22.scale.set(1, 1, 1);
  } else {
    node_key_0_22.position.set(0.0, -0.8500000000000001, 0.395);
    node_key_0_22.rotation.set(0.0, 0.0, 0.0);
    node_key_0_22.scale.set(0.18, 0.13, 0.06);
  }
  node_key_0_22.userData.sculptComponent = {"id": "key-0", "name": "数字键 0", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.8500000000000001, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_0_22.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_0_22);
  nodes["key-0"] = node_key_0_22;
  const mesh_key_0_22Geometry = endpoint_key_0_22
    ? new THREE.CylinderGeometry(endpoint_key_0_22.endRadius, endpoint_key_0_22.baseRadius, endpoint_key_0_22.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_0_22 = new THREE.Mesh(
    mesh_key_0_22Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_0_22.name = "\u6570\u5b57\u952e 0";
  if (endpoint_key_0_22) {
    mesh_key_0_22.position.copy(endpoint_key_0_22.midpoint);
    mesh_key_0_22.quaternion.copy(endpoint_key_0_22.quaternion);
  }
  mesh_key_0_22.castShadow = options.castShadow ?? true;
  mesh_key_0_22.receiveShadow = options.receiveShadow ?? true;
  mesh_key_0_22.userData.sculptComponent = {"id": "key-0", "name": "数字键 0", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.0, -0.8500000000000001, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_0_22.add(mesh_key_0_22);
  meshes["key-0"] = mesh_key_0_22;
  colliders["key-0"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_0_22);

  const attachment_key_hash_23 = null;
  const endpoint_key_hash_23 = makeAttachmentEndpoint(attachment_key_hash_23);
  const node_key_hash_23 = new THREE.Group();
  node_key_hash_23.name = "\u6570\u5b57\u952e hash__pivot";
  if (endpoint_key_hash_23) {
    node_key_hash_23.position.copy(endpoint_key_hash_23.start);
    node_key_hash_23.rotation.set(0, 0, 0);
    node_key_hash_23.scale.set(1, 1, 1);
  } else {
    node_key_hash_23.position.set(0.24, -0.8500000000000001, 0.395);
    node_key_hash_23.rotation.set(0.0, 0.0, 0.0);
    node_key_hash_23.scale.set(0.18, 0.13, 0.06);
  }
  node_key_hash_23.userData.sculptComponent = {"id": "key-hash", "name": "数字键 hash", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.8500000000000001, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_hash_23.userData.actionProfile = {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_key_hash_23);
  nodes["key-hash"] = node_key_hash_23;
  const mesh_key_hash_23Geometry = endpoint_key_hash_23
    ? new THREE.CylinderGeometry(endpoint_key_hash_23.endRadius, endpoint_key_hash_23.baseRadius, endpoint_key_hash_23.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_key_hash_23 = new THREE.Mesh(
    mesh_key_hash_23Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_key_hash_23.name = "\u6570\u5b57\u952e hash";
  if (endpoint_key_hash_23) {
    mesh_key_hash_23.position.copy(endpoint_key_hash_23.midpoint);
    mesh_key_hash_23.quaternion.copy(endpoint_key_hash_23.quaternion);
  }
  mesh_key_hash_23.castShadow = options.castShadow ?? true;
  mesh_key_hash_23.receiveShadow = options.receiveShadow ?? true;
  mesh_key_hash_23.userData.sculptComponent = {"id": "key-hash", "name": "数字键 hash", "level": "micro", "role": "key", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.06, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.24, -0.8500000000000001, 0.395], "rotation": [0, 0, 0], "scale": [0.18, 0.13, 0.06]}, "actionProfile": {"animationRole": "key", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(30,32,35,1)", "materialClass": "plastic", "materialClassConfidence": 0.85, "finishStyle": "black keycap with white glyph"}};
  node_key_hash_23.add(mesh_key_hash_23);
  meshes["key-hash"] = mesh_key_hash_23;
  colliders["key-hash"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_key_hash_23);

  const attachment_side_btn_1_24 = null;
  const endpoint_side_btn_1_24 = makeAttachmentEndpoint(attachment_side_btn_1_24);
  const node_side_btn_1_24 = new THREE.Group();
  node_side_btn_1_24.name = "\u4fa7\u952e\uff08\u4e0a\uff09__pivot";
  if (endpoint_side_btn_1_24) {
    node_side_btn_1_24.position.copy(endpoint_side_btn_1_24.start);
    node_side_btn_1_24.rotation.set(0, 0, 0);
    node_side_btn_1_24.scale.set(1, 1, 1);
  } else {
    node_side_btn_1_24.position.set(0.595, 0.45, 0.05);
    node_side_btn_1_24.rotation.set(0.0, 0.0, 0.0);
    node_side_btn_1_24.scale.set(0.05, 0.16, 0.1);
  }
  node_side_btn_1_24.userData.sculptComponent = {"id": "side-btn-1", "name": "侧键（上）", "level": "micro", "role": "button", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.05, "height": 0.16, "depth": 0.1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.595, 0.45, 0.05], "rotation": [0, 0, 0], "scale": [0.05, 0.16, 0.1]}, "actionProfile": {"animationRole": "button", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(16,17,18,1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finishStyle": "side button"}};
  node_side_btn_1_24.userData.actionProfile = {"animationRole": "button", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_side_btn_1_24);
  nodes["side-btn-1"] = node_side_btn_1_24;
  const mesh_side_btn_1_24Geometry = endpoint_side_btn_1_24
    ? new THREE.CylinderGeometry(endpoint_side_btn_1_24.endRadius, endpoint_side_btn_1_24.baseRadius, endpoint_side_btn_1_24.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_side_btn_1_24 = new THREE.Mesh(
    mesh_side_btn_1_24Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_side_btn_1_24.name = "\u4fa7\u952e\uff08\u4e0a\uff09";
  if (endpoint_side_btn_1_24) {
    mesh_side_btn_1_24.position.copy(endpoint_side_btn_1_24.midpoint);
    mesh_side_btn_1_24.quaternion.copy(endpoint_side_btn_1_24.quaternion);
  }
  mesh_side_btn_1_24.castShadow = options.castShadow ?? true;
  mesh_side_btn_1_24.receiveShadow = options.receiveShadow ?? true;
  mesh_side_btn_1_24.userData.sculptComponent = {"id": "side-btn-1", "name": "侧键（上）", "level": "micro", "role": "button", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.05, "height": 0.16, "depth": 0.1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.595, 0.45, 0.05], "rotation": [0, 0, 0], "scale": [0.05, 0.16, 0.1]}, "actionProfile": {"animationRole": "button", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(16,17,18,1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finishStyle": "side button"}};
  node_side_btn_1_24.add(mesh_side_btn_1_24);
  meshes["side-btn-1"] = mesh_side_btn_1_24;
  colliders["side-btn-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_side_btn_1_24);

  const attachment_side_btn_2_25 = null;
  const endpoint_side_btn_2_25 = makeAttachmentEndpoint(attachment_side_btn_2_25);
  const node_side_btn_2_25 = new THREE.Group();
  node_side_btn_2_25.name = "\u4fa7\u952e\uff08\u4e0b\uff09__pivot";
  if (endpoint_side_btn_2_25) {
    node_side_btn_2_25.position.copy(endpoint_side_btn_2_25.start);
    node_side_btn_2_25.rotation.set(0, 0, 0);
    node_side_btn_2_25.scale.set(1, 1, 1);
  } else {
    node_side_btn_2_25.position.set(0.595, 0.24, 0.05);
    node_side_btn_2_25.rotation.set(0.0, 0.0, 0.0);
    node_side_btn_2_25.scale.set(0.05, 0.12, 0.1);
  }
  node_side_btn_2_25.userData.sculptComponent = {"id": "side-btn-2", "name": "侧键（下）", "level": "micro", "role": "button", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.05, "height": 0.12, "depth": 0.1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.595, 0.24, 0.05], "rotation": [0, 0, 0], "scale": [0.05, 0.12, 0.1]}, "actionProfile": {"animationRole": "button", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(16,17,18,1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finishStyle": "side button"}};
  node_side_btn_2_25.userData.actionProfile = {"animationRole": "button", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_side_btn_2_25);
  nodes["side-btn-2"] = node_side_btn_2_25;
  const mesh_side_btn_2_25Geometry = endpoint_side_btn_2_25
    ? new THREE.CylinderGeometry(endpoint_side_btn_2_25.endRadius, endpoint_side_btn_2_25.baseRadius, endpoint_side_btn_2_25.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_side_btn_2_25 = new THREE.Mesh(
    mesh_side_btn_2_25Geometry,
    materialMap["mat-keycap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_side_btn_2_25.name = "\u4fa7\u952e\uff08\u4e0b\uff09";
  if (endpoint_side_btn_2_25) {
    mesh_side_btn_2_25.position.copy(endpoint_side_btn_2_25.midpoint);
    mesh_side_btn_2_25.quaternion.copy(endpoint_side_btn_2_25.quaternion);
  }
  mesh_side_btn_2_25.castShadow = options.castShadow ?? true;
  mesh_side_btn_2_25.receiveShadow = options.receiveShadow ?? true;
  mesh_side_btn_2_25.userData.sculptComponent = {"id": "side-btn-2", "name": "侧键（下）", "level": "micro", "role": "button", "importance": 0.8, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "独立的硬质注塑成型件，与相邻件装配/嵌接组合，非连续有机曲面", "geometryDescriptor": {"topologyIntent": "hard-surface molded part, bevel handled in TS refinement", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.05, "height": 0.12, "depth": 0.1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.595, 0.24, 0.05], "rotation": [0, 0, 0], "scale": [0.05, 0.12, 0.1]}, "actionProfile": {"animationRole": "button", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mat-keycap", "materialLayers": ["mat-keycap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "skeleton", "colorMaterialRecipe": {"dominantAlbedo": "rgba(16,17,18,1)", "secondaryAlbedo": "rgba(16,17,18,1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finishStyle": "side button"}};
  node_side_btn_2_25.add(mesh_side_btn_2_25);
  meshes["side-btn-2"] = mesh_side_btn_2_25;
  colliders["side-btn-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "simplified proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_side_btn_2_25);

  // repetition system: perf-ring-inner (InstancedMesh, radial, count=8, level=micro)
  {
    const parent = nodes["earpiece-grille"] ?? root;
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
    const mat = materialMap["mat-grille"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.035, 0.035, 0.06];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.12;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 8);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 8; i++) {
      const ang = ((0.0) + (i * 360) / 8) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "perf-ring-inner";
    parent.add(cluster);
  }

  // repetition system: perf-ring-mid (InstancedMesh, radial, count=14, level=micro)
  {
    const parent = nodes["earpiece-grille"] ?? root;
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
    const mat = materialMap["mat-grille"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.035, 0.035, 0.06];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.22;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 14);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 14; i++) {
      const ang = ((0.0) + (i * 360) / 14) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "perf-ring-mid";
    parent.add(cluster);
  }

  // repetition system: perf-ring-outer (InstancedMesh, radial, count=20, level=micro)
  {
    const parent = nodes["earpiece-grille"] ?? root;
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
    const mat = materialMap["mat-grille"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.035, 0.035, 0.06];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.3;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 20);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 20; i++) {
      const ang = ((0.0) + (i * 360) / 20) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "perf-ring-outer";
    parent.add(cluster);
  }


  // ---- hand-refined details (form-refinement) ----
  function squirclePoints(a, b, n = 4, seg = 48) {
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      pts.push(new THREE.Vector2(
        a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
        b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n),
      ));
    }
    return pts;
  }
  function squircleShape(a, b) { return new THREE.Shape().setFromPoints(squirclePoints(a, b)); }
  // 听筒凹位边框 → 圆角方形环（外 0.26×0.20 / 内 0.215×0.16）
  {
    const ringMesh = meshes["earpiece-ring"];
    if (ringMesh) {
      const shape = squircleShape(0.26, 0.2);
      shape.holes.push(new THREE.Path().setFromPoints(squirclePoints(0.215, 0.16)));
      ringMesh.geometry.dispose();
      ringMesh.geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 48 });
      const pivot = nodes["earpiece-ring"];
      pivot.scale.set(1, 1, 1);
      pivot.position.set(0, 0.92, 0.37);
      pivot.rotation.set(0, 0, 0);
    }
    const grilleMesh = meshes["earpiece-grille"];
    if (grilleMesh) {
      grilleMesh.geometry.dispose();
      grilleMesh.geometry = new THREE.ExtrudeGeometry(squircleShape(0.215, 0.16), { depth: 0.05, bevelEnabled: false, curveSegments: 48 });
      const pivot = nodes["earpiece-grille"];
      pivot.scale.set(1, 1, 1);
      pivot.position.set(0, 0.92, 0.352);
      pivot.rotation.set(0, 0, 0);
    }
    // 生成器的 radial 孔环在父缩放系下错位，移除，改手写蜂窝孔阵（真实几何孔）
    const grilleNode = nodes["earpiece-grille"];
    if (grilleNode) {
      grilleNode.children.filter((c) => c.name.startsWith("perf-ring-")).forEach((c) => grilleNode.remove(c));
    }
    const plugs = [];
    const step = 0.042;
    for (let r = -2; r <= 2; r++) {
      const y = r * step * 0.9;
      for (let c = -3; c <= 3; c++) {
        const x = c * step + (Math.abs(r) % 2 === 1 ? step / 2 : 0);
        if ((x / 0.17) ** 2 + (y / 0.125) ** 2 <= 1) plugs.push([x, y]);
      }
    }
    const holeGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.016, 12);
    holeGeo.rotateX(Math.PI / 2);
    const cluster = new THREE.InstancedMesh(holeGeo, materialMap["mat-keycap"], plugs.length);
    const hm = new THREE.Matrix4();
    plugs.forEach(([x, y], i) => { hm.makeTranslation(x, 0.92 + y, 0.402); cluster.setMatrixAt(i, hm); });
    cluster.instanceMatrix.needsUpdate = true;
    cluster.name = "perf-honeycomb";
    root.add(cluster);
  }
  // 下巴弧面装饰棱线
  {
    const ridge = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.035, 0.03, 2, 0.012), materialMap["mat-keycap"]);
    ridge.position.set(0, -1.12, 0.378);
    ridge.castShadow = true;
    root.add(ridge);
  }
  // 右侧边三条斜切凹槽
  for (let i = 0; i < 3; i++) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.05), materialMap["mat-keycap"]);
    groove.position.set(0.592, 0.52 - i * 0.14, 0.02);
    groove.rotation.x = 0.5;
    root.add(groove);
  }
  // 前后壳合模缝（左右侧边中线细线）
  for (const sx of [-0.592, 0.592]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.008, 2.55, 0.02), materialMap["mat-keycap"]);
    seam.position.set(sx, 0, 0);
    root.add(seam);
  }
  // 键帽白色字符（canvas 纹理贴在 +Z 面，材质数组第 5 位）
  {
    const glyphOf = { "key-1": "1", "key-2": "2", "key-3": "3", "key-4": "4", "key-5": "5", "key-6": "6",
      "key-7": "7", "key-8": "8", "key-9": "9", "key-star": "*", "key-0": "0", "key-hash": "#" };
    const keycapMat = materialMap["mat-keycap"];
    for (const [id, ch] of Object.entries(glyphOf)) {
      const mesh = meshes[id];
      if (!mesh) continue;
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      const g = cv.getContext("2d");
      g.fillStyle = "#101112";
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = "#e8e8e8";
      g.font = "bold 68px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(ch, 64, 68);
      const tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 4;
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0 });
      mesh.material = [keycapMat, keycapMat, keycapMat, keycapMat, face, keycapMat];
    }
  }

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "全部材质为平面纯色塑料/玻璃，无图案涂装——按 grimoire「flat paint → solid albedo」法则走程序化调色板，不做 reference PBR 提取；若后续发现图案化区域再补 extract_pbr_evidence"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createBrickPhoneLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Brick Phone look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["key light：前左上方大面积柔和棚光，中性白，中等强度，软阴影过渡", "fill light：正前方低位补光抬升暗部，低强度，环境 ambient 浅灰", "rim/environment：顶部轮廓光分离天线与浅灰无缝背景（environment light 弱反射）", "exposure/tone mapping：中调曝光，ACES filmic tone mapping 保住磨砂塑料的明度区间", "contact shadow：机身底部在无缝地面上有柔和接触阴影（contact shadow 清晰）"];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "全部材质为平面纯色塑料/玻璃，无图案涂装——按 grimoire「flat paint → solid albedo」法则走程序化调色板，不做 reference PBR 提取；若后续发现图案化区域再补 extract_pbr_evidence"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createBrickPhoneEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameBrickPhoneCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createBrickPhonePresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureBrickPhoneRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createBrickPhoneInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
