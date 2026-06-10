import './style.css';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';

const environmentMapUrl = new URL('../orlando_stadium_4k.hdr', import.meta.url).href;
const stadiumModelUrl = new URL('../trackfield_22fbx.glb', import.meta.url).href;

const CAMERA_START = new THREE.Vector3(0, 1.6, 35);
const MIN_MOVE_SPEED = 2;
const MAX_MOVE_SPEED = 60;
const MOVE_SPEED_STEP = 2;
const DEFAULT_MOVE_SPEED = 2;
const LOOK_SENSITIVITY = 0.0022;
const KEYBOARD_TURN_SPEED = THREE.MathUtils.degToRad(35);
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const DEFAULT_SWAY_FREQUENCY = 10;
const MAX_PIXEL_RATIO = 2;

const telemetry = document.querySelector('#telemetry');
const presetToggle = document.querySelector('#presetToggle');
const moveSpeedInput = document.querySelector('#moveSpeed');
const swayHorizontalInput = document.querySelector('#swayHorizontal');
const swayVerticalInput = document.querySelector('#swayVertical');
const swayFrequencyInput = document.querySelector('#swayFrequency');
const swayRollInput = document.querySelector('#swayRoll');
const swayPitchInput = document.querySelector('#swayPitch');
const swayYawInput = document.querySelector('#swayYaw');
const moveSpeedValue = document.querySelector('#moveSpeedValue');
const swayHorizontalValue = document.querySelector('#swayHorizontalValue');
const swayVerticalValue = document.querySelector('#swayVerticalValue');
const swayFrequencyValue = document.querySelector('#swayFrequencyValue');
const swayRollValue = document.querySelector('#swayRollValue');
const swayPitchValue = document.querySelector('#swayPitchValue');
const swayYawValue = document.querySelector('#swayYawValue');

const SWAY_PRESETS = {
  JOGGING: {
    moveSpeed: 4,
    swayHorizontal: 0.14,
    swayVertical: 0.12,
    swayFrequency: 9.5,
    swayRoll: 0.06,
    swayPitch: 0.02,
    swayYaw: 0.015,
    swayNoise: 0.008,
    swayNoiseFrequency: 19,
  },
  RUNNING: {
    moveSpeed: 6,
    swayHorizontal: 0.18,
    swayVertical: 0.2,
    swayFrequency: 10,
    swayRoll: 0.05,
    swayPitch: 0.035,
    swayYaw: 0.024,
    swayNoise: 0.014,
    swayNoiseFrequency: 27,
  },
};

const PRESET_ORDER = ['JOGGING', 'RUNNING'];

const loadStatus = document.createElement('div');
loadStatus.className = 'load-status';
loadStatus.textContent = 'Loading stadium assets...';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x091019, 45, 180);
scene.backgroundBlurriness = 0.03;

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.copy(CAMERA_START);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMappingExposure = 0.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
const app = document.querySelector('#app');
app.appendChild(renderer.domElement);
app.appendChild(loadStatus);

const crosshair = document.createElement('div');
crosshair.className = 'crosshair';
crosshair.setAttribute('aria-hidden', 'true');
app.appendChild(crosshair);

const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
composer.setSize(window.innerWidth, window.innerHeight);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 18;
ssaoPass.minDistance = 0.002;
ssaoPass.maxDistance = 0.035;
composer.addPass(ssaoPass);

const bokehPass = new BokehPass(scene, camera, {
  focus: 38,
  aperture: 0.00012,
  maxblur: 0.0035,
});
composer.addPass(bokehPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.15, 0.9, 0.82);
composer.addPass(bloomPass);

const smaaPass = new SMAAPass();
composer.addPass(smaaPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

scene.add(new THREE.HemisphereLight(0xdde7ff, 0x1d1308, 0.16));

const keyLight = new THREE.DirectionalLight(0xfff2cf, 1.8);
keyLight.position.set(30, 34, 18);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(4096, 4096);
keyLight.shadow.bias = -0.00008;
keyLight.shadow.normalBias = 0.02;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 160;
keyLight.shadow.camera.left = -60;
keyLight.shadow.camera.right = 60;
keyLight.shadow.camera.top = 60;
keyLight.shadow.camera.bottom = -60;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9fc6ff, 0.65);
fillLight.position.set(-26, 16, 24);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffc18f, 1.05);
rimLight.position.set(-24, 20, -34);
scene.add(rimLight);

const loader = new GLTFLoader();
const rgbeLoader = new RGBELoader();

rgbeLoader.load(
  environmentMapUrl,
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.backgroundIntensity = 1.1;
    scene.backgroundRotation.set(0, Math.PI / 2, 0);
    const environmentTarget = pmremGenerator.fromEquirectangular(texture);
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 1.15;
    scene.environmentRotation.set(0, Math.PI / 2, 0);
  },
  undefined,
  (error) => {
    console.error(error);
  },
);

function applyAnisotropicFiltering(material) {
  const materials = Array.isArray(material) ? material : [material];

  for (const entry of materials) {
    if (!entry) {
      continue;
    }

    for (const value of Object.values(entry)) {
      if (value && value.isTexture) {
        value.anisotropy = maxAnisotropy;
      }
    }
  }
}

function configureTexture(texture, options = {}) {
  if (!texture) {
    return;
  }

  texture.anisotropy = maxAnisotropy;

  if (options.colorSpace) {
    texture.colorSpace = options.colorSpace;
  }

  if (options.repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.copy(options.repeat);
  }

  if (options.channel !== undefined) {
    texture.channel = options.channel;
  }

  texture.needsUpdate = true;
}

function ensureSecondaryUvSet(geometry) {
  if (!geometry?.attributes?.uv || geometry.attributes.uv1) {
    return;
  }

  geometry.setAttribute('uv1', geometry.attributes.uv.clone());
}

function tunePhysicalMaterial(material, geometry) {
  ensureSecondaryUvSet(geometry);
  configureTexture(material.map, { colorSpace: THREE.SRGBColorSpace });
  configureTexture(material.emissiveMap, { colorSpace: THREE.SRGBColorSpace });
  configureTexture(material.normalMap);
  configureTexture(material.roughnessMap);
  configureTexture(material.metalnessMap);
  configureTexture(material.aoMap, { channel: 1 });
  material.envMapIntensity = Math.max(material.envMapIntensity ?? 0, 1.1);
  material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.8, 0.12, 1);
  material.metalness = THREE.MathUtils.clamp(material.metalness ?? 0.1, 0, 1);
  material.aoMapIntensity = Math.max(material.aoMapIntensity ?? 0.85, 0.85);
  material.clearcoat = Math.max(material.clearcoat ?? 0, 0.04);
  material.clearcoatRoughness = material.clearcoatRoughness ?? 0.68;
  applyAnisotropicFiltering(material);
  material.needsUpdate = true;
}

function promoteMaterial(material, geometry) {
  if (!material) {
    return material;
  }

  if (material.isMeshPhysicalMaterial) {
    tunePhysicalMaterial(material, geometry);
    return material;
  }

  if (
    !material.isMeshStandardMaterial
    && !material.isMeshBasicMaterial
    && !material.isMeshLambertMaterial
    && !material.isMeshPhongMaterial
  ) {
    applyAnisotropicFiltering(material);
    return material;
  }

  const physicalMaterial = new THREE.MeshPhysicalMaterial({
    name: material.name,
    color: material.color ? material.color.clone() : new THREE.Color(0xffffff),
    map: material.map ?? null,
    normalMap: material.normalMap ?? null,
    roughnessMap: material.roughnessMap ?? null,
    metalnessMap: material.metalnessMap ?? null,
    aoMap: material.aoMap ?? null,
    alphaMap: material.alphaMap ?? null,
    emissiveMap: material.emissiveMap ?? null,
    emissive: material.emissive ? material.emissive.clone() : new THREE.Color(0x000000),
    transparent: material.transparent,
    opacity: material.opacity,
    side: material.side,
    alphaTest: material.alphaTest,
    depthWrite: material.depthWrite,
    depthTest: material.depthTest,
    wireframe: material.wireframe,
    flatShading: material.flatShading,
    metalness: material.metalness ?? 0.08,
    roughness: material.roughness ?? 0.82,
    envMapIntensity: material.envMapIntensity ?? 1.1,
    clearcoat: 0.04,
    clearcoatRoughness: 0.68,
  });

  if (material.normalScale && physicalMaterial.normalScale) {
    physicalMaterial.normalScale.copy(material.normalScale);
  }

  tunePhysicalMaterial(physicalMaterial, geometry);
  return physicalMaterial;
}

function promoteMaterialCollection(material, geometry) {
  if (Array.isArray(material)) {
    return material.map((entry) => promoteMaterial(entry, geometry));
  }

  return promoteMaterial(material, geometry);
}

function createCanvasTexture(size, drawTexture, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  drawTexture(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  configureTexture(texture, options);
  return texture;
}

function createWaveNormalTexture(size, repeat) {
  const data = new Uint8Array(size * size * 4);
  const sampleHeight = (x, y) => {
    const normalizedX = x / size;
    const normalizedY = y / size;
    return (
      0.55
      + Math.sin(normalizedX * Math.PI * 18) * 0.08
      + Math.cos(normalizedY * Math.PI * 24) * 0.06
      + Math.sin((normalizedX + normalizedY) * Math.PI * 12) * 0.04
    );
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = sampleHeight(x - 1, y);
      const right = sampleHeight(x + 1, y);
      const down = sampleHeight(x, y - 1);
      const up = sampleHeight(x, y + 1);
      const normal = new THREE.Vector3(left - right, down - up, 1).normalize();
      const index = (y * size + x) * 4;
      data[index] = Math.round((normal.x * 0.5 + 0.5) * 255);
      data[index + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      data[index + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  configureTexture(texture, { repeat });
  return texture;
}

function createSurfaceTextures({
  primaryColor,
  secondaryColor,
  detailColor,
  repeat,
  stripeScale,
  roughnessBase,
  aoBase,
}) {
  const map = createCanvasTexture(
    512,
    (context, size) => {
      context.fillStyle = primaryColor;
      context.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y += 8) {
        const mix = 0.5 + 0.5 * Math.sin((y / size) * Math.PI * stripeScale);
        context.fillStyle = mix > 0.52 ? secondaryColor : primaryColor;
        context.fillRect(0, y, size, 6);
      }

      context.globalAlpha = 0.12;
      context.fillStyle = detailColor;
      for (let index = 0; index < 900; index += 1) {
        const x = (index * 61) % size;
        const y = (index * 37) % size;
        const radius = 1 + ((index * 13) % 4);
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    },
    { colorSpace: THREE.SRGBColorSpace, repeat },
  );

  const roughnessMap = createCanvasTexture(
    512,
    (context, size) => {
      context.fillStyle = `rgb(${roughnessBase}, ${roughnessBase}, ${roughnessBase})`;
      context.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y += 12) {
        const tone = roughnessBase + Math.round(Math.sin((y / size) * Math.PI * stripeScale) * 18);
        context.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
        context.fillRect(0, y, size, 8);
      }
    },
    { repeat },
  );

  const aoMap = createCanvasTexture(
    512,
    (context, size) => {
      context.fillStyle = `rgb(${aoBase}, ${aoBase}, ${aoBase})`;
      context.fillRect(0, 0, size, size);
      const vignette = context.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size * 0.6);
      vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, size, size);
    },
    { repeat, channel: 1 },
  );

  const normalMap = createWaveNormalTexture(256, repeat);

  return { map, roughnessMap, aoMap, normalMap };
}

const grassTextures = createSurfaceTextures({
  primaryColor: '#2b693d',
  secondaryColor: '#347d47',
  detailColor: '#7db96f',
  repeat: new THREE.Vector2(12, 12),
  stripeScale: 28,
  roughnessBase: 208,
  aoBase: 228,
});

const trackTextures = createSurfaceTextures({
  primaryColor: '#9f5632',
  secondaryColor: '#b86438',
  detailColor: '#d2a07b',
  repeat: new THREE.Vector2(10, 10),
  stripeScale: 18,
  roughnessBase: 196,
  aoBase: 220,
});

function setLoadStatus(message, tone = 'info') {
  loadStatus.textContent = message;
  loadStatus.dataset.tone = tone;
}

function createFallbackTrack() {
  const fallbackGroup = new THREE.Group();

  const field = new THREE.Mesh(
    new THREE.CircleGeometry(28, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: grassTextures.map,
      roughnessMap: grassTextures.roughnessMap,
      aoMap: grassTextures.aoMap,
      normalMap: grassTextures.normalMap,
      roughness: 0.98,
      metalness: 0.01,
      envMapIntensity: 1.1,
      clearcoat: 0.02,
      clearcoatRoughness: 0.85,
    }),
  );
  ensureSecondaryUvSet(field.geometry);
  field.rotation.x = -Math.PI / 2;
  field.position.y = -0.005;
  field.receiveShadow = true;
  fallbackGroup.add(field);

  const track = new THREE.Mesh(
    new THREE.RingGeometry(30, 42, 128),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: trackTextures.map,
      roughnessMap: trackTextures.roughnessMap,
      aoMap: trackTextures.aoMap,
      normalMap: trackTextures.normalMap,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 1.15,
      clearcoat: 0.03,
      clearcoatRoughness: 0.74,
    }),
  );
  ensureSecondaryUvSet(track.geometry);
  track.rotation.x = -Math.PI / 2;
  track.position.y = -0.004;
  track.receiveShadow = true;
  fallbackGroup.add(track);

  const laneLines = new THREE.Group();
  for (let radius = 32; radius <= 40; radius += 2) {
    const lane = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.06, radius + 0.06, 128),
      new THREE.MeshBasicMaterial({ color: 0xf5f0db }),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.y = -0.003;
    laneLines.add(lane);
  }
  fallbackGroup.add(laneLines);

  const infieldLine = new THREE.Mesh(
    new THREE.RingGeometry(27.7, 27.9, 128),
    new THREE.MeshBasicMaterial({ color: 0xf5f0db }),
  );
  infieldLine.rotation.x = -Math.PI / 2;
  infieldLine.position.y = -0.003;
  fallbackGroup.add(infieldLine);

  return fallbackGroup;
}

const fallbackTrack = createFallbackTrack();

loader.load(
  stadiumModelUrl,
  (gltf) => {
    gltf.scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.material = promoteMaterialCollection(node.material, node.geometry);
      }
    });

    scene.add(gltf.scene);
    setLoadStatus('Stadium model loaded.', 'success');
  },
  undefined,
  (error) => {
    console.error(error);
    scene.add(fallbackTrack);
    setLoadStatus('Stadium model missing. Running fallback track preview.', 'warning');
  },
);

const clock = new THREE.Clock();
const keyState = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ArrowLeft: false,
  ArrowRight: false,
};

let yaw = THREE.MathUtils.degToRad(-90);
let pitch = 0;
let moveSpeed = DEFAULT_MOVE_SPEED;
let swayHorizontalAmount = Number(swayHorizontalInput.value);
let swayVerticalAmount = Number(swayVerticalInput.value);
let swayFrequency = DEFAULT_SWAY_FREQUENCY;
let swayRollAmount = Number(swayRollInput.value);
let swayPitchAmount = Number(swayPitchInput.value);
let swayYawAmount = Number(swayYawInput.value);
let swayNoiseAmount = SWAY_PRESETS.JOGGING.swayNoise;
let swayNoiseFrequency = SWAY_PRESETS.JOGGING.swayNoiseFrequency;
let swayPhase = 0;
let swayBlend = 0;
let activePreset = 'JOGGING';

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const movement = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const baseCameraPosition = new THREE.Vector3();
const swayCameraPosition = new THREE.Vector3();

function setKeyState(code, pressed) {
  if (code in keyState) {
    keyState[code] = pressed;
  }
}

function updateTelemetry() {
  const yawDegrees = THREE.MathUtils.radToDeg(yaw);
  telemetry.textContent = `x: ${camera.position.x.toFixed(2)} y: ${camera.position.y.toFixed(2)} z: ${camera.position.z.toFixed(2)} yaw: ${yawDegrees.toFixed(2)} speed: ${moveSpeed.toFixed(2)}`;
}

function updateMoveSpeed() {
  moveSpeed = Number(moveSpeedInput.value);
  moveSpeedValue.textContent = moveSpeed.toFixed(0);
}

function updatePresetToggle() {
  presetToggle.textContent = activePreset;
  presetToggle.dataset.preset = activePreset;
}

function applyPreset(presetName) {
  const preset = SWAY_PRESETS[presetName];

  if (!preset) {
    return;
  }

  activePreset = presetName;
  moveSpeedInput.value = String(preset.moveSpeed);
  swayHorizontalInput.value = String(preset.swayHorizontal);
  swayVerticalInput.value = String(preset.swayVertical);
  swayFrequencyInput.value = String(preset.swayFrequency);
  swayRollInput.value = String(preset.swayRoll);
  swayPitchInput.value = String(preset.swayPitch);
  swayYawInput.value = String(preset.swayYaw);
  swayNoiseAmount = preset.swayNoise;
  swayNoiseFrequency = preset.swayNoiseFrequency;
  updateMoveSpeed();
  updateSwaySettings();
  updatePresetToggle();
}

function updateSwaySettings() {
  swayHorizontalAmount = Number(swayHorizontalInput.value);
  swayVerticalAmount = Number(swayVerticalInput.value);
  swayFrequency = Number(swayFrequencyInput.value);
  swayRollAmount = Number(swayRollInput.value);
  swayPitchAmount = Number(swayPitchInput.value);
  swayYawAmount = Number(swayYawInput.value);

  swayHorizontalValue.textContent = swayHorizontalAmount.toFixed(2);
  swayVerticalValue.textContent = swayVerticalAmount.toFixed(2);
  swayFrequencyValue.textContent = swayFrequency.toFixed(1);
  swayRollValue.textContent = swayRollAmount.toFixed(3);
  swayPitchValue.textContent = swayPitchAmount.toFixed(3);
  swayYawValue.textContent = swayYawAmount.toFixed(3);
}

moveSpeedInput.addEventListener('input', updateMoveSpeed);
swayHorizontalInput.addEventListener('input', updateSwaySettings);
swayVerticalInput.addEventListener('input', updateSwaySettings);
swayFrequencyInput.addEventListener('input', updateSwaySettings);
swayRollInput.addEventListener('input', updateSwaySettings);
swayPitchInput.addEventListener('input', updateSwaySettings);
swayYawInput.addEventListener('input', updateSwaySettings);
presetToggle.addEventListener('click', () => {
  const currentIndex = PRESET_ORDER.indexOf(activePreset);
  const nextPreset = PRESET_ORDER[(currentIndex + 1) % PRESET_ORDER.length];
  applyPreset(nextPreset);
});

window.addEventListener('keydown', (event) => {
  if (!event.repeat && event.code === 'Digit1') {
    applyPreset('JOGGING');
  }

  if (!event.repeat && event.code === 'Digit2') {
    applyPreset('RUNNING');
  }

  setKeyState(event.code, true);
});

window.addEventListener('keyup', (event) => {
  setKeyState(event.code, false);
});

renderer.domElement.addEventListener('click', () => {
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  updateTelemetry();
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement) {
    return;
  }

  yaw -= event.movementX * LOOK_SENSITIVITY;
  pitch -= event.movementY * LOOK_SENSITIVITY;
  pitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);
  bokehPass.uniforms.aspect.value = camera.aspect;
});

function updateMovement(deltaSeconds) {
  let isMoving = false;

  if (keyState.ArrowLeft) {
    yaw += KEYBOARD_TURN_SPEED * deltaSeconds;
  }

  if (keyState.ArrowRight) {
    yaw -= KEYBOARD_TURN_SPEED * deltaSeconds;
  }

  forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;

  if (forward.lengthSq() > 0) {
    forward.normalize();
  }

  right.crossVectors(forward, worldUp).normalize();
  movement.set(0, 0, 0);

  if (keyState.KeyW) {
    movement.add(forward);
  }
  if (keyState.KeyS) {
    movement.sub(forward);
  }
  if (keyState.KeyD) {
    movement.add(right);
  }
  if (keyState.KeyA) {
    movement.sub(right);
  }

  if (movement.lengthSq() > 0) {
    isMoving = true;
    movement.normalize().multiplyScalar(moveSpeed * deltaSeconds);
    camera.position.add(movement);
    swayPhase += deltaSeconds * swayFrequency;
  }

  const blendLerp = 1 - Math.exp(-deltaSeconds * 10);
  swayBlend = THREE.MathUtils.lerp(swayBlend, isMoving ? 1 : 0, blendLerp);
}

function applyCameraSway() {
  const noisePhase = swayPhase * (swayNoiseFrequency / Math.max(swayFrequency, 0.001));
  const swayMicroX = Math.sin(noisePhase * 1.17 + 0.6) * swayNoiseAmount * swayBlend;
  const swayMicroY = Math.sin(noisePhase * 0.83 + 1.4) * swayNoiseAmount * 0.8 * swayBlend;
  const pitchMicroNoise = Math.sin(noisePhase * 1.31 + 2.1) * swayNoiseAmount * 0.35 * swayBlend;
  const rollMicroNoise = Math.sin(noisePhase * 1.73 + 0.2) * swayNoiseAmount * 0.65 * swayBlend;
  const yawMicroNoise = Math.sin(noisePhase * 1.09 + 2.8) * swayNoiseAmount * 0.4 * swayBlend;
  // Chest harness: minimal lateral translation
  const swayX = Math.sin(swayPhase) * swayHorizontalAmount * swayBlend + swayMicroX;
  // abs(sin) fires twice per stride cycle, creating U-shaped valleys between each upward bounce
  const swayY = Math.abs(Math.sin(swayPhase)) * swayVerticalAmount * swayBlend + swayMicroY;
  // Slight forward pitch impulse at each footfall, in phase with the bounce
  const pitchNoise = Math.abs(Math.sin(swayPhase)) * swayPitchAmount * swayBlend + pitchMicroNoise;
  // Roll alternates L/R with each step — the dominant visual in chest harness footage
  const rollNoise = Math.sin(swayPhase) * swayRollAmount * swayBlend + rollMicroNoise;
  // Yaw counter-rotates relative to roll (arm-swing), so negate
  const yawNoise = -Math.sin(swayPhase) * swayYawAmount * swayBlend + yawMicroNoise;

  swayCameraPosition.copy(baseCameraPosition);
  swayCameraPosition.addScaledVector(right, swayX);
  swayCameraPosition.y += swayY;
  camera.position.copy(swayCameraPosition);
  camera.rotation.y = yaw + yawNoise;
  camera.rotation.x = pitch + pitchNoise;
  camera.rotation.z = rollNoise;
}

function animate() {
  const deltaSeconds = clock.getDelta();

  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.rotation.z = 0;
  updateMovement(deltaSeconds);
  updateTelemetry();
  baseCameraPosition.copy(camera.position);
  applyCameraSway();

  composer.render(deltaSeconds);
  camera.position.copy(baseCameraPosition);
  requestAnimationFrame(animate);
}

updateTelemetry();
updateMoveSpeed();
applyPreset(activePreset);
animate();