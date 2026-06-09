import './style.css';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const environmentMapUrl = new URL('../orlando_stadium_4k.hdr', import.meta.url).href;
const stadiumModelUrl = new URL('../trackfield_22fbx.glb', import.meta.url).href;

const CAMERA_START = new THREE.Vector3(0, 1.5, 35);
const MIN_MOVE_SPEED = 2;
const MAX_MOVE_SPEED = 60;
const MOVE_SPEED_STEP = 2;
const DEFAULT_MOVE_SPEED = 2;
const LOOK_SENSITIVITY = 0.0022;
const KEYBOARD_TURN_SPEED = THREE.MathUtils.degToRad(35);
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const DEFAULT_SWAY_FREQUENCY = 10;

const telemetry = document.querySelector('#telemetry');
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

const loadStatus = document.createElement('div');
loadStatus.className = 'load-status';
loadStatus.textContent = 'Loading stadium assets...';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x091019, 45, 180);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.copy(CAMERA_START);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const app = document.querySelector('#app');
app.appendChild(renderer.domElement);
app.appendChild(loadStatus);

const crosshair = document.createElement('div');
crosshair.className = 'crosshair';
crosshair.setAttribute('aria-hidden', 'true');
app.appendChild(crosshair);

const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

scene.add(new THREE.HemisphereLight(0xdde7ff, 0x1d1308, 0.3));

const sun = new THREE.DirectionalLight(0xfff2cf, 0.6);
sun.position.set(18, 28, 12);
scene.add(sun);

const grid = new THREE.GridHelper(180, 36, 0xc59a62, 0x38516c);
grid.position.y = -0.01;
scene.add(grid);

const loader = new GLTFLoader();
const rgbeLoader = new RGBELoader();

rgbeLoader.load(
  environmentMapUrl,
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.backgroundIntensity = 1.5;
    scene.backgroundRotation.set(0, Math.PI / 2, 0);
    scene.environment = texture;
    scene.environmentIntensity = 0.45;
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

function setLoadStatus(message, tone = 'info') {
  loadStatus.textContent = message;
  loadStatus.dataset.tone = tone;
}

function createFallbackTrack() {
  const fallbackGroup = new THREE.Group();

  const field = new THREE.Mesh(
    new THREE.CircleGeometry(28, 96),
    new THREE.MeshStandardMaterial({ color: 0x2c6b3f, roughness: 0.95, metalness: 0.02 }),
  );
  field.rotation.x = -Math.PI / 2;
  field.position.y = -0.005;
  fallbackGroup.add(field);

  const track = new THREE.Mesh(
    new THREE.RingGeometry(30, 42, 128),
    new THREE.MeshStandardMaterial({ color: 0xb65e2f, roughness: 0.98, metalness: 0.01 }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.y = -0.004;
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

scene.add(createFallbackTrack());

loader.load(
  stadiumModelUrl,
  (gltf) => {
    gltf.scene.traverse((node) => {
      if (node.isMesh) {
        applyAnisotropicFiltering(node.material);
      }
    });

    scene.add(gltf.scene);
    setLoadStatus('Stadium model loaded.', 'success');
  },
  undefined,
  (error) => {
    console.error(error);
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
let swayPhase = 0;

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

window.addEventListener('keydown', (event) => {
  if (!event.repeat && event.code === 'Digit1') {
    moveSpeed = Math.max(MIN_MOVE_SPEED, moveSpeed - MOVE_SPEED_STEP);
    moveSpeedInput.value = String(moveSpeed);
    updateMoveSpeed();
  }

  if (!event.repeat && event.code === 'Digit2') {
    moveSpeed = Math.min(MAX_MOVE_SPEED, moveSpeed + MOVE_SPEED_STEP);
    moveSpeedInput.value = String(moveSpeed);
    updateMoveSpeed();
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
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function updateMovement(deltaSeconds) {
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
    movement.normalize().multiplyScalar(moveSpeed * deltaSeconds);
    camera.position.add(movement);
    swayPhase += deltaSeconds * swayFrequency;
  } else {
    swayPhase = 0;
  }
}

function applyCameraSway() {
  // Chest harness: minimal lateral translation
  const swayX = Math.sin(swayPhase) * swayHorizontalAmount;
  // abs(sin) fires twice per stride cycle, creating U-shaped valleys between each upward bounce
  const swayY = Math.abs(Math.sin(swayPhase)) * swayVerticalAmount;
  // Slight forward pitch impulse at each footfall, in phase with the bounce
  const pitchNoise = Math.abs(Math.sin(swayPhase)) * swayPitchAmount;
  // Roll alternates L/R with each step — the dominant visual in chest harness footage
  const rollNoise = Math.sin(swayPhase) * swayRollAmount;
  // Yaw counter-rotates relative to roll (arm-swing), so negate
  const yawNoise = -Math.sin(swayPhase) * swayYawAmount;

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

  renderer.render(scene, camera);
  camera.position.copy(baseCameraPosition);
  requestAnimationFrame(animate);
}

updateTelemetry();
updateMoveSpeed();
updateSwaySettings();
animate();