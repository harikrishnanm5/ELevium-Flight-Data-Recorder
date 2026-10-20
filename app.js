/**
 * AERO // QUANTUM • Next-Gen Autonomous Flight Telemetry & 3D Drone Holo-Deck
 * Three.js 3D Drone, Force Field Energy Shield, Tactical LIDAR Point Cloud, and PFD.
 */

// ============================================================================
// 1. Flight State & Telemetry Variables
// ============================================================================
const FlightState = {
  armed: true,
  mode: 'hover', // 'hover', 'bank', 'acro', 'neural', 'manual'
  lightsOn: true,
  shieldOn: true,
  sensorMode: 'radar', // 'radar' or 'lidar'

  // Futuristic State
  isWarping: false,
  shaderMode: 'holo',
  peakG: 1.48,
  
  // Current Filtered Gyro Values (Degrees)
  pitch: 0.0,
  roll: 0.0,
  yaw: 142.0,
  altitude: 24.5,
  throttle: 52,
  airspeed: 42.0,
  vsi: 0.4,
  gforce: 1.02,
  
  // Position Coordinates (meters relative to Home RTH)
  posX: 95.0,
  posZ: -105.0,
  
  // Targets for spring interpolation
  targetPitch: 0.0,
  targetRoll: 0.0,
  targetYaw: 142.0,
  targetAlt: 24.5,
  
  // Derived IMU Rates (deg/s) and Accel (g)
  gyroRateX: 0.0,
  gyroRateY: 0.0,
  gyroRateZ: 0.0,
  accelX: 0.02,
  accelY: -0.01,
  accelZ: 1.02,
  
  // Power & Battery
  voltage: 15.84,
  current: 24.2,
  capacityUsed: 620,
  
  // Replay Controller
  isReplaying: false,
  replayTime: 48.0,
  replaySpeed: 1.0,
  replayLogData: [],

  // Historic breadcrumbs for radar
  trail: []
};

// ============================================================================
// 2. Synthesized Cockpit Audio System (Web Audio API)
// ============================================================================
let audioCtx = null;
let soundEnabled = true;

function initCockpitAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playCockpitBeep(freq = 880, duration = 0.08, type = 'sine') {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function playWarpSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
  } catch (e) {}
}

function playShieldHarmonic() {
  if (!soundEnabled || !audioCtx) return;
  try {
    [440, 660, 880].forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.05);
      gain.gain.setValueAtTime(0.03, audioCtx.currentTime + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + idx * 0.05);
      osc.stop(audioCtx.currentTime + 0.45);
    });
  } catch (e) {}
}

function playCyberChirp() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
    osc.frequency.setValueAtTime(2200, audioCtx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.025, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.09);
  } catch (e) {}
}

document.getElementById('btn-audio-toggle')?.addEventListener('click', (e) => {
  initCockpitAudio();
  soundEnabled = !soundEnabled;
  const icon = document.getElementById('audio-icon');
  if (icon) icon.textContent = soundEnabled ? '🔊' : '🔇';
  if (soundEnabled) playCockpitBeep(1200, 0.1, 'sine');
});


// ============================================================================
// 3. Three.js 3D Drone Model with Force Field & Ion Thrusters
// ============================================================================
let scene, camera, renderer, droneGroup;
let propellers = [];
let rotorBlurDiscs = [];
let headlights = [];
let thrusterCones = [];
let warpStarfield = null;
let droneBodyMesh = null;
let droneCanopyMesh = null;
let energyShield = null;
let altitudeLaserBeam = null;
let groundShadow = null;
let flightTrailLine = null;
let flightTrailPositions = null;
const flightTrailHistory = [];
const maxTrailPoints = 140;
let cameraMode = 'orbit'; // 'orbit', 'top', 'cockpit', 'tactical'
let isDraggingOrbit = false;
let orbitPrevMouse = { x: 0, y: 0 };
let orbitAngles = { theta: 0.6, phi: 0.45, radius: 10.5 };

function initThreeDDrone() {
  const container = document.getElementById('drone-container');
  const canvasEl = document.getElementById('drone-canvas');
  const loader = document.getElementById('drone-loader');
  if (!container || !canvasEl || typeof THREE === 'undefined') {
    if (loader) loader.classList.add('hidden');
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene & Camera
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060a, 0.035);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  updateCameraPosition();

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Ambient & Directional Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
  keyLight.position.set(8, 12, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xec4899, 1.2);
  rimLight.position.set(-8, 5, -8);
  scene.add(rimLight);

  // Ground Grid Floor
  const gridHelper = new THREE.GridHelper(36, 36, 0x00f0ff, 0x1e293b);
  gridHelper.position.y = -2.5;
  scene.add(gridHelper);

  // Ground Cardinal Compass Ring (N, S, E, W)
  const ringGeo = new THREE.RingGeometry(5.8, 6.0, 36);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
  const compassRing = new THREE.Mesh(ringGeo, ringMat);
  compassRing.rotation.x = Math.PI / 2;
  compassRing.position.y = -2.48;
  scene.add(compassRing);

  // Dynamic Ground Elevation Shadow
  const shadowGeo = new THREE.CircleGeometry(1.8, 24);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 });
  groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = -2.47;
  scene.add(groundShadow);

  // Vertical Laser Down-Beam from Drone to Ground
  const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8);
  const laserMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.45 });
  altitudeLaserBeam = new THREE.Mesh(laserGeo, laserMat);
  altitudeLaserBeam.position.set(0, -1.25, 0);
  scene.add(altitudeLaserBeam);

  // BUILD THE 3D DRONE
  droneGroup = new THREE.Group();

  // 1. Center Fuselage
  const bodyGeo = new THREE.BoxGeometry(1.6, 0.4, 2.2);
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.3,
    metalness: 0.85
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, carbonMat);
  bodyMesh.castShadow = true;
  droneGroup.add(bodyMesh);
  droneBodyMesh = bodyMesh;

  // Center Canopy
  const canopyGeo = new THREE.CylinderGeometry(0.5, 0.7, 0.35, 16);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.2
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 0.35;
  droneGroup.add(canopy);
  droneCanopyMesh = canopy;

  // Front Camera Gimbal Lens
  const lensGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.0
  });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, -0.05, 1.2);
  droneGroup.add(lens);

  // 2. Dual High-Beam Forward Headlights
  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(0, -2.5, 10);
  droneGroup.add(lightTarget);

  [-0.6, 0.6].forEach(xOff => {
    const spot = new THREE.SpotLight(0x00f0ff, 2.5, 22, Math.PI / 5, 0.4, 1);
    spot.position.set(xOff, 0, 1.1);
    spot.target = lightTarget;
    droneGroup.add(spot);
    headlights.push(spot);
  });

  // 3. Holographic Force Field Energy Shield (Wireframe Geodesic Sphere)
  const shieldGeo = new THREE.IcosahedronGeometry(3.4, 2);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.25
  });
  energyShield = new THREE.Mesh(shieldGeo, shieldMat);
  droneGroup.add(energyShield);

  // 4. 4 Quad Arms (X-Frame)
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.8,
    roughness: 0.25
  });

  const motorPositions = [
    { x: 2.2, z: 2.0, led: 0x10b981 },  // Front Right (Green)
    { x: -2.2, z: 2.0, led: 0xef4444 }, // Front Left (Red)
    { x: 2.2, z: -2.0, led: 0xffffff }, // Rear Right (White)
    { x: -2.2, z: -2.0, led: 0x00f0ff } // Rear Left (Cyan)
  ];

  motorPositions.forEach((pos, idx) => {
    // Arm Tube
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8);
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(pos.x * 0.5, 0, pos.z * 0.5);
    arm.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(pos.x, 0, pos.z).normalize()
    );
    droneGroup.add(arm);

    // Motor Bell Nacelle
    const motorGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 });
    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.position.set(pos.x, 0.2, pos.z);
    droneGroup.add(motor);

    // Navigation LED Strobe
    const ledGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const ledMat = new THREE.MeshStandardMaterial({
      color: pos.led,
      emissive: pos.led,
      emissiveIntensity: 1.6
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(pos.x, -0.15, pos.z);
    droneGroup.add(led);

    // Spinning Dual-Blade Propeller
    const propGroup = new THREE.Group();
    propGroup.position.set(pos.x, 0.48, pos.z);

    const bladeGeo = new THREE.BoxGeometry(2.4, 0.04, 0.22);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    propGroup.add(blade);

    // Propeller Motion Blur Disc
    const blurGeo = new THREE.CircleGeometry(1.25, 24);
    const blurMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const blurDisc = new THREE.Mesh(blurGeo, blurMat);
    blurDisc.rotation.x = Math.PI / 2;
    blurDisc.position.y = 0.05;
    propGroup.add(blurDisc);
    rotorBlurDiscs.push(blurDisc);

    // Inverted Ion Plasma Thruster Jet Cone
    const thrusterGeo = new THREE.ConeGeometry(0.35, 1.2, 16);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.65,
      wireframe: false
    });
    const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    thruster.position.set(pos.x, -0.6, pos.z);
    thruster.rotation.x = Math.PI; // point downwards
    droneGroup.add(thruster);
    thrusterCones.push(thruster);

    droneGroup.add(propGroup);
    propellers.push({ group: propGroup, direction: idx % 2 === 0 ? 1 : -1 });
  });

  scene.add(droneGroup);

  // 3D Quantum Dust & Warp Hyperspace Starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 600;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 36;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 24;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 36;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0x00f0ff,
    size: 0.14,
    transparent: true,
    opacity: 0.75
  });
  warpStarfield = new THREE.Points(starGeo, starMat);
  scene.add(warpStarfield);

  // 3D Holographic Flight Trajectory Breadcrumb Ribbon
  const trailPositions = new Float32Array(maxTrailPoints * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setDrawRange(0, 0);

  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.75,
    linewidth: 2
  });
  flightTrailLine = new THREE.Line(trailGeometry, trailMaterial);
  flightTrailPositions = trailPositions;
  scene.add(flightTrailLine);

  // Hide loader
  if (loader) loader.classList.add('hidden');

  // Handle Resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Orbit Mouse Interaction
  container.addEventListener('pointerdown', (e) => {
    isDraggingOrbit = true;
    orbitPrevMouse = { x: e.clientX, y: e.clientY };
    container.setPointerCapture(e.pointerId);
  });

  container.addEventListener('pointermove', (e) => {
    if (!isDraggingOrbit) return;
    const dx = e.clientX - orbitPrevMouse.x;
    const dy = e.clientY - orbitPrevMouse.y;
    orbitPrevMouse = { x: e.clientX, y: e.clientY };

    orbitAngles.theta -= dx * 0.008;
    orbitAngles.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, orbitAngles.phi + dy * 0.008));
    updateCameraPosition();
  });

  container.addEventListener('pointerup', (e) => {
    isDraggingOrbit = false;
    container.releasePointerCapture(e.pointerId);
  });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbitAngles.radius = Math.max(5, Math.min(22, orbitAngles.radius + e.deltaY * 0.015));
    updateCameraPosition();
  }, { passive: false });
}

function updateCameraPosition() {
  if (!camera) return;
  const targetX = droneGroup ? droneGroup.position.x : 0;
  const targetY = droneGroup ? droneGroup.position.y : 0;
  const targetZ = droneGroup ? droneGroup.position.z : 0;

  if (cameraMode === 'top') {
    camera.position.set(targetX, targetY + 12, targetZ + 0.001);
    camera.lookAt(targetX, targetY, targetZ);
  } else if (cameraMode === 'cockpit') {
    // FPV Chase Mode: smoothly trailing behind the drone's heading & position
    const yawRad = droneGroup ? droneGroup.rotation.y : 0;
    const dist = 5.2;
    const height = 1.8;
    camera.position.set(
      targetX - Math.sin(yawRad) * dist,
      targetY + height,
      targetZ - Math.cos(yawRad) * dist
    );
    camera.lookAt(
      targetX + Math.sin(yawRad) * 4,
      targetY + 0.2,
      targetZ + Math.cos(yawRad) * 4
    );
  } else if (cameraMode === 'tactical') {
    camera.position.set(targetX + 9, targetY + 7.5, targetZ + 9);
    camera.lookAt(targetX, targetY, targetZ);
  } else {
    // Orbit Spherical coordinates relative to drone
    const r = orbitAngles.radius;
    const phi = orbitAngles.phi;
    const theta = orbitAngles.theta;
    camera.position.x = targetX + r * Math.sin(phi) * Math.sin(theta);
    camera.position.y = targetY + r * Math.cos(phi);
    camera.position.z = targetZ + r * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(targetX, targetY + 0.3, targetZ);
  }
}

// 2D Tactical Reticle HUD Tracker (locks onto 3D drone in screen space)
function updateReticleHUD() {
  const reticle = document.querySelector('.tactical-osd-reticle');
  const container = document.getElementById('drone-container');
  if (!reticle || !container || !camera || !droneGroup) return;

  const w = container.clientWidth;
  const h = container.clientHeight;
  const v = droneGroup.position.clone();
  v.project(camera);

  // If drone is in front of camera
  if (v.z < 1) {
    const screenX = (v.x * 0.5 + 0.5) * w;
    const screenY = (-(v.y * 0.5) + 0.5) * h;
    reticle.style.left = `${screenX}px`;
    reticle.style.top = `${screenY}px`;
    reticle.style.opacity = '1';

    const tag = reticle.querySelector('.reticle-tag');
    if (tag) {
      const modeTxt = FlightState.isReplaying ? 'REPLAY_TRACK' : 'LOCK: QUANTUM_01';
      tag.textContent = `${modeTxt} • ALT: ${FlightState.altitude.toFixed(1)}m • G: ${FlightState.gforce.toFixed(2)}G`;
    }
  } else {
    reticle.style.opacity = '0';
  }
}

// Camera Mode Button Triggers
document.querySelectorAll('.cam-btn[data-cam]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.cam-btn[data-cam]').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    cameraMode = e.currentTarget.dataset.cam;
    updateCameraPosition();
    playCockpitBeep(640, 0.05, 'sine');
  });
});

document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
  orbitAngles = { theta: 0.6, phi: 0.45, radius: 10.5 };
  cameraMode = 'orbit';
  document.querySelectorAll('.cam-btn[data-cam]').forEach(b => b.classList.remove('active'));
  document.querySelector('.cam-btn[data-cam="orbit"]')?.classList.add('active');
  updateCameraPosition();
  playCockpitBeep(780, 0.06, 'sine');
});

// Force Field Shield Toggle
document.getElementById('btn-toggle-shield')?.addEventListener('click', (e) => {
  FlightState.shieldOn = !FlightState.shieldOn;
  const btn = e.currentTarget;
  const label = btn.querySelector('.toggle-label');

  if (energyShield) {
    energyShield.visible = FlightState.shieldOn;
  }

  if (FlightState.shieldOn) {
    btn.classList.add('active');
    label.textContent = 'Shield: ON';
  } else {
    btn.classList.remove('active');
    label.textContent = 'Shield: OFF';
  }
  playCockpitBeep(980, 0.08, 'square');
});

// Headlights Toggle
document.getElementById('btn-toggle-lights')?.addEventListener('click', (e) => {
  FlightState.lightsOn = !FlightState.lightsOn;
  const btn = e.currentTarget;
  const label = btn.querySelector('.toggle-label');

  headlights.forEach(light => {
    light.intensity = FlightState.lightsOn ? 2.5 : 0;
  });

  if (FlightState.lightsOn) {
    btn.classList.add('active');
    label.textContent = 'Ion Beams: ON';
  } else {
    btn.classList.remove('active');
    label.textContent = 'Ion Beams: OFF';
  }
  playCockpitBeep(880, 0.05, 'triangle');
});

// Arming Switch Toggle
document.getElementById('arm-status-pill')?.addEventListener('click', () => {
  FlightState.armed = !FlightState.armed;
  const pill = document.getElementById('arm-status-pill');
  const label = document.getElementById('arm-label');

  if (FlightState.armed) {
    pill.className = 'flight-state-badge armed';
    label.textContent = 'QUANTUM ARMED';
    playCockpitBeep(1200, 0.15, 'sine');
  } else {
    pill.className = 'flight-state-badge disarmed';
    label.textContent = 'DISARMED (SAFE)';
    FlightState.throttle = 0;
    playCockpitBeep(440, 0.25, 'sawtooth');
  }
});


// ============================================================================
// 4. Primary Flight Display (PFD) / Artificial Horizon
// ============================================================================
const pfdCanvas = document.getElementById('pfd-canvas');
const pfdCtx = pfdCanvas ? pfdCanvas.getContext('2d') : null;

function renderPFD() {
  if (!pfdCtx || !pfdCanvas) return;
  const w = pfdCanvas.width;
  const h = pfdCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  pfdCtx.clearRect(0, 0, w, h);

  // Pitch & Roll transforms
  const rollRad = THREE.MathUtils.degToRad(FlightState.roll);
  const pitchPx = FlightState.pitch * 3.2;

  pfdCtx.save();
  pfdCtx.translate(cx, cy);
  pfdCtx.rotate(-rollRad);

  // Sky & Ground
  const skyGrad = pfdCtx.createLinearGradient(0, -h * 2, 0, pitchPx);
  skyGrad.addColorStop(0, '#0369a1');
  skyGrad.addColorStop(1, '#0284c7');
  pfdCtx.fillStyle = skyGrad;
  pfdCtx.fillRect(-w * 2, -h * 2, w * 4, h * 2 + pitchPx);

  const groundGrad = pfdCtx.createLinearGradient(0, pitchPx, 0, h * 2);
  groundGrad.addColorStop(0, '#78350f');
  groundGrad.addColorStop(1, '#451a03');
  pfdCtx.fillStyle = groundGrad;
  pfdCtx.fillRect(-w * 2, pitchPx, w * 4, h * 2);

  // White Horizon Line
  pfdCtx.strokeStyle = '#ffffff';
  pfdCtx.lineWidth = 2.5;
  pfdCtx.beginPath();
  pfdCtx.moveTo(-w * 2, pitchPx);
  pfdCtx.lineTo(w * 2, pitchPx);
  pfdCtx.stroke();

  // Pitch Ladder
  pfdCtx.fillStyle = '#ffffff';
  pfdCtx.font = '10px JetBrains Mono, monospace';
  pfdCtx.textAlign = 'center';
  pfdCtx.textBaseline = 'middle';

  for (let deg = -30; deg <= 30; deg += 5) {
    if (deg === 0) continue;
    const yLine = pitchPx - deg * 3.2;
    const lineLen = deg % 10 === 0 ? 36 : 20;

    pfdCtx.lineWidth = 1.5;
    pfdCtx.beginPath();
    pfdCtx.moveTo(-lineLen, yLine);
    pfdCtx.lineTo(lineLen, yLine);
    pfdCtx.stroke();

    if (deg % 10 === 0) {
      pfdCtx.fillText(Math.abs(deg).toString(), -lineLen - 12, yLine);
      pfdCtx.fillText(Math.abs(deg).toString(), lineLen + 12, yLine);
    }
  }

  pfdCtx.restore();

  // Aircraft Reference Symbol
  pfdCtx.strokeStyle = '#facc15';
  pfdCtx.lineWidth = 3.5;
  pfdCtx.fillStyle = '#facc15';

  pfdCtx.beginPath();
  pfdCtx.moveTo(cx - 55, cy);
  pfdCtx.lineTo(cx - 18, cy);
  pfdCtx.lineTo(cx - 18, cy + 7);
  pfdCtx.stroke();

  pfdCtx.beginPath();
  pfdCtx.moveTo(cx + 55, cy);
  pfdCtx.lineTo(cx + 18, cy);
  pfdCtx.lineTo(cx + 18, cy + 7);
  pfdCtx.stroke();

  pfdCtx.beginPath();
  pfdCtx.arc(cx, cy, 3, 0, Math.PI * 2);
  pfdCtx.fill();

  // Roll Pointer
  pfdCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  pfdCtx.lineWidth = 1.5;
  pfdCtx.beginPath();
  pfdCtx.arc(cx, cy, 95, Math.PI * 1.25, Math.PI * 1.75);
  pfdCtx.stroke();

  pfdCtx.save();
  pfdCtx.translate(cx, cy);
  pfdCtx.rotate(-rollRad);
  pfdCtx.fillStyle = '#00f0ff';
  pfdCtx.beginPath();
  pfdCtx.moveTo(0, -95);
  pfdCtx.lineTo(-6, -85);
  pfdCtx.lineTo(6, -85);
  pfdCtx.closePath();
  pfdCtx.fill();
  pfdCtx.restore();

  // Roll Readout
  pfdCtx.fillStyle = '#00f0ff';
  pfdCtx.font = '11px JetBrains Mono, monospace';
  pfdCtx.textAlign = 'center';
  pfdCtx.fillText(`ROLL: ${FlightState.roll > 0 ? '+' : ''}${FlightState.roll.toFixed(1)}°`, cx, 22);

  // Speed Tape
  pfdCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  pfdCtx.fillRect(8, 28, 48, h - 56);
  pfdCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  pfdCtx.strokeRect(8, 28, 48, h - 56);

  pfdCtx.fillStyle = '#38bdf8';
  pfdCtx.font = '9px JetBrains Mono, monospace';
  pfdCtx.textAlign = 'center';
  pfdCtx.fillText('SPD', 32, 42);

  pfdCtx.font = '12px JetBrains Mono, monospace';
  pfdCtx.fillStyle = '#ffffff';
  pfdCtx.fillText(Math.round(FlightState.airspeed).toString(), 32, cy);

  // Altitude Tape
  pfdCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  pfdCtx.fillRect(w - 56, 28, 48, h - 56);
  pfdCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  pfdCtx.strokeRect(w - 56, 28, 48, h - 56);

  pfdCtx.fillStyle = '#10b981';
  pfdCtx.font = '9px JetBrains Mono, monospace';
  pfdCtx.textAlign = 'center';
  pfdCtx.fillText('ALT', w - 32, 42);

  pfdCtx.font = '12px JetBrains Mono, monospace';
  pfdCtx.fillStyle = '#ffffff';
  pfdCtx.fillText(Math.round(FlightState.altitude).toString(), w - 32, cy);
}


// ============================================================================
// 5. Sensor Suite (Removed as requested)
// ============================================================================
function renderSensorSuite() {
  // Module 06 Tactical Radar/LIDAR decommissioned
}


// ============================================================================
// 6. Multi-Channel Real-Time Gyro Strip Chart (Oscilloscope)
// ============================================================================
const chartCanvas = document.getElementById('telemetry-chart');
const chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;

const maxHistoryPoints = 180;
const historyBuffers = {
  pitch: new Array(maxHistoryPoints).fill(0),
  roll: new Array(maxHistoryPoints).fill(0),
  yaw: new Array(maxHistoryPoints).fill(142),
  alt: new Array(maxHistoryPoints).fill(24.5)
};

function updateHistoryBuffers() {
  historyBuffers.pitch.push(FlightState.pitch);
  historyBuffers.pitch.shift();

  historyBuffers.roll.push(FlightState.roll);
  historyBuffers.roll.shift();

  historyBuffers.yaw.push(FlightState.yaw);
  historyBuffers.yaw.shift();

  historyBuffers.alt.push(FlightState.altitude);
  historyBuffers.alt.shift();
}

function renderTelemetryChart() {
  if (!chartCtx || !chartCanvas) return;
  const w = chartCanvas.width;
  const h = chartCanvas.height;
  const cy = h / 2;

  chartCtx.clearRect(0, 0, w, h);

  chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  chartCtx.lineWidth = 1;

  for (let y = 20; y < h; y += 30) {
    chartCtx.beginPath();
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(w, y);
    chartCtx.stroke();
  }

  chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  chartCtx.setLineDash([4, 4]);
  chartCtx.beginPath();
  chartCtx.moveTo(0, cy);
  chartCtx.lineTo(w, cy);
  chartCtx.stroke();
  chartCtx.setLineDash([]);

  function drawStream(buffer, color, scale, offsetY = cy) {
    chartCtx.strokeStyle = color;
    chartCtx.lineWidth = 2;
    chartCtx.beginPath();

    const stepX = w / (maxHistoryPoints - 1);
    for (let i = 0; i < maxHistoryPoints; i++) {
      const val = buffer[i];
      const yPos = offsetY - val * scale;
      if (i === 0) chartCtx.moveTo(0, yPos);
      else chartCtx.lineTo(i * stepX, yPos);
    }
    chartCtx.stroke();
  }

  drawStream(historyBuffers.pitch, '#00f0ff', 1.4, cy);
  drawStream(historyBuffers.roll, '#ec4899', 1.4, cy);
  const altNormalized = historyBuffers.alt.map(a => a - 25);
  drawStream(altNormalized, '#10b981', 3.0, cy);
}


// ============================================================================
// 7. Interactive Flight Profiles & Simulation Controller
// ============================================================================
let simTick = 0;

function updateFlightSimulation() {
  simTick += 0.03;

  if (!FlightState.armed) {
    FlightState.targetPitch = 0;
    FlightState.targetRoll = 0;
    FlightState.throttle = 0;
    FlightState.airspeed = 0;
    FlightState.vsi = -1.2;
    FlightState.gforce = 1.0;
  }
  else if (FlightState.isReplaying) {
    // When replaying, flight attitudes & metrics are dictated directly by the BlackBox flight log
    FlightState.pitch = FlightState.targetPitch;
    FlightState.roll = FlightState.targetRoll;
    FlightState.yaw = FlightState.targetYaw;
    FlightState.altitude = FlightState.targetAlt;
  }
  else if (FlightState.mode === 'hover') {
    const gustPitch = Math.sin(simTick * 1.8) * 3.2 + Math.cos(simTick * 0.9) * 1.8;
    const gustRoll = Math.cos(simTick * 1.4) * 4.1 + Math.sin(simTick * 2.3) * 1.5;
    const gustAlt = 24.5 + Math.sin(simTick * 0.7) * 0.6;

    FlightState.targetPitch = gustPitch;
    FlightState.targetRoll = gustRoll;
    FlightState.targetAlt = gustAlt;
    FlightState.throttle = 52 + Math.round(Math.sin(simTick) * 4);
    FlightState.airspeed = 40 + Math.sin(simTick * 0.5) * 5;
    FlightState.vsi = Math.sin(simTick * 0.7) * 0.4;

    FlightState.posX += Math.sin(simTick * 0.5) * 0.15;
    FlightState.posZ += Math.cos(simTick * 0.5) * 0.15;
  }
  else if (FlightState.mode === 'bank') {
    FlightState.targetRoll = 28.0;
    FlightState.targetPitch = 6.0;
    FlightState.targetYaw = (FlightState.targetYaw + 1.2) % 360;
    FlightState.targetAlt = 28.0;
    FlightState.airspeed = 68.0;
    FlightState.gforce = 1.22;

    FlightState.posX = Math.sin(simTick * 0.8) * 3.5;
    FlightState.posZ = Math.cos(simTick * 0.8) * 2.5;
  }
  else if (FlightState.mode === 'acro') {
    FlightState.targetPitch = 4.0;
    FlightState.targetRoll = (FlightState.targetRoll + 6.0);
    if (FlightState.targetRoll > 180) FlightState.targetRoll -= 360;
    FlightState.airspeed = 82.0;
    FlightState.gforce = 1.85;
  }
  else if (FlightState.mode === 'neural') {
    // Neural Autopilot trajectory calculation
    const neuralPitch = Math.sin(simTick * 0.9) * 14;
    const neuralRoll = Math.cos(simTick * 0.7) * 22;
    FlightState.targetPitch = neuralPitch;
    FlightState.targetRoll = neuralRoll;
    FlightState.targetYaw = (FlightState.targetYaw + 0.8) % 360;
    FlightState.targetAlt = 26.0 + Math.sin(simTick * 0.4) * 5;
    FlightState.airspeed = 58.0;
    FlightState.gforce = 1.15;

    FlightState.posX = Math.sin(simTick * 0.5) * 3.8;
    FlightState.posZ = Math.cos(simTick * 0.5) * 2.6;
  }
  else if (FlightState.mode === 'manual') {
    FlightState.airspeed = 35 + Math.abs(FlightState.pitch) * 1.2;
    FlightState.gforce = 1.0 + Math.abs(FlightState.roll) * 0.015;
  }

  // Smooth Spring Interpolation for live interactive modes
  if (!FlightState.isReplaying) {
    const springK = 0.12;
    FlightState.pitch += (FlightState.targetPitch - FlightState.pitch) * springK;
    FlightState.roll += (FlightState.targetRoll - FlightState.roll) * springK;
    FlightState.yaw += (FlightState.targetYaw - FlightState.yaw) * 0.08;
    FlightState.altitude += (FlightState.targetAlt - FlightState.altitude) * 0.08;
  }

  // IMU Rates
  FlightState.gyroRateX = (FlightState.targetPitch - FlightState.pitch) * 4.5;
  FlightState.gyroRateY = (FlightState.targetRoll - FlightState.roll) * 4.5;
  FlightState.gyroRateZ = (FlightState.targetYaw - FlightState.yaw) * 1.5;

  // Sync to 3D Drone Model
  if (droneGroup) {
    // 1. Attitude Rotation (as per readings)
    droneGroup.rotation.x = THREE.MathUtils.degToRad(FlightState.pitch);
    droneGroup.rotation.z = THREE.MathUtils.degToRad(-FlightState.roll);
    droneGroup.rotation.y = THREE.MathUtils.degToRad(FlightState.yaw);

    // 2. 3D Spatial Translation (as per altitude and flight trajectory)
    // Altitude mapping: 0m (ground) is -2.1; 20m (nominal hover) is 0.0; 40m is +1.8
    const baseDroneY = -2.1 + (FlightState.altitude / 20) * 2.1;
    const clampedY = Math.max(-2.2, Math.min(3.2, baseDroneY));

    // Dynamic Kinematic Sway & Surge from Attitude
    const rollRad = THREE.MathUtils.degToRad(FlightState.roll);
    const pitchRad = THREE.MathUtils.degToRad(FlightState.pitch);
    const sway = Math.sin(rollRad) * 1.4;
    const surge = -Math.sin(pitchRad) * 1.4;

    let targetDroneX = (FlightState.posX || 0) + sway;
    let targetDroneZ = (FlightState.posZ || 0) + surge;
    let targetDroneY = clampedY;

    // Physical Shock / Vibration Recoil under G-Force & Anomalies
    if (FlightState.gforce > 1.35) {
      const shockAmp = Math.min(0.65, (FlightState.gforce - 1.0) * 0.28);
      targetDroneX += (Math.random() - 0.5) * shockAmp;
      targetDroneY += (Math.random() - 0.5) * shockAmp;
      targetDroneZ += (Math.random() - 0.5) * shockAmp;
      droneGroup.rotation.z += (Math.random() - 0.5) * shockAmp * 0.08;
    }

    // Smooth position interpolation
    const posLerp = FlightState.isReplaying ? 0.35 : 0.18;
    droneGroup.position.x += (targetDroneX - droneGroup.position.x) * posLerp;
    droneGroup.position.y += (targetDroneY - droneGroup.position.y) * posLerp;
    droneGroup.position.z += (targetDroneZ - droneGroup.position.z) * posLerp;

    // 3. Dynamic Vertical Laser Down-Beam
    if (altitudeLaserBeam) {
      const groundY = -2.48;
      const currentDroneBottomY = droneGroup.position.y - 0.15;
      const beamHeight = Math.max(0.04, currentDroneBottomY - groundY);
      altitudeLaserBeam.position.set(
        droneGroup.position.x,
        groundY + beamHeight / 2,
        droneGroup.position.z
      );
      altitudeLaserBeam.scale.set(1, beamHeight / 2.5, 1);
      altitudeLaserBeam.visible = currentDroneBottomY > groundY;
    }

    // 4. Dynamic Ground Shadow following Drone Position
    if (groundShadow) {
      groundShadow.position.set(droneGroup.position.x, -2.47, droneGroup.position.z);
      const heightAboveGround = Math.max(0.08, droneGroup.position.y - (-2.48));
      const s = Math.max(0.5, 1.8 - heightAboveGround * 0.22);
      groundShadow.scale.set(s, s, 1);
      groundShadow.material.opacity = Math.max(0.12, 0.65 - heightAboveGround * 0.1);
    }

    // 5. Dynamic 3D Holographic Flight Trajectory Breadcrumbs
    if (flightTrailLine && flightTrailPositions) {
      flightTrailHistory.push({
        x: droneGroup.position.x,
        y: droneGroup.position.y,
        z: droneGroup.position.z
      });
      if (flightTrailHistory.length > maxTrailPoints) {
        flightTrailHistory.shift();
      }
      const len = flightTrailHistory.length;
      for (let i = 0; i < len; i++) {
        flightTrailPositions[i * 3] = flightTrailHistory[i].x;
        flightTrailPositions[i * 3 + 1] = flightTrailHistory[i].y;
        flightTrailPositions[i * 3 + 2] = flightTrailHistory[i].z;
      }
      flightTrailLine.geometry.attributes.position.needsUpdate = true;
      flightTrailLine.geometry.setDrawRange(0, len);
    }

    // 6. Propellers & Energy Shield
    if (FlightState.armed) {
      const propSpeed = (FlightState.throttle / 100) * 0.85 + 0.25;
      propellers.forEach(prop => {
        prop.group.rotation.y += propSpeed * prop.direction;
      });
      rotorBlurDiscs.forEach(disc => {
        disc.material.opacity = 0.15 + (FlightState.throttle / 100) * 0.25;
      });

      if (energyShield) {
        energyShield.rotation.y += 0.015;
        energyShield.rotation.x += 0.01;
        const pulse = 0.2 + Math.abs(Math.sin(simTick * 2)) * 0.15;
        energyShield.material.opacity = pulse;
      }
    } else {
      rotorBlurDiscs.forEach(disc => { disc.material.opacity = 0; });
    }

    // 7. Dynamic Ion Plasma Thruster Cones
    if (thrusterCones.length > 0) {
      const throtRatio = FlightState.armed ? (FlightState.throttle / 100) : 0;
      thrusterCones.forEach((cone, idx) => {
        let motorScale = throtRatio * 1.5 + 0.3;
        if (idx === 0) motorScale += FlightState.roll * 0.015;
        if (idx === 1) motorScale -= FlightState.roll * 0.015;
        cone.scale.set(1, Math.max(0.1, motorScale), 1);
        cone.material.opacity = FlightState.armed ? (0.3 + throtRatio * 0.5) : 0;
      });
    }

    // 8. Warp Starfield Particles (Drifting with airspeed)
    if (warpStarfield) {
      const positions = warpStarfield.geometry.attributes.position.array;
      const speedMult = FlightState.isWarping ? 18.0 : Math.max(0.6, FlightState.airspeed / 40);
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= (0.05 * speedMult);
        if (positions[i + 1] < -12) positions[i + 1] = 12;
      }
      warpStarfield.geometry.attributes.position.needsUpdate = true;
    }

    // 9. Camera & HUD Reticle Tracking
    updateCameraPosition();
    updateReticleHUD();
  }

  // Update ESC FLIR Matrix
  const baseTemp = 38.0 + (FlightState.throttle / 100) * 14.0;
  document.getElementById('esc-1-temp')?.replaceChildren(document.createTextNode(`${(baseTemp + Math.abs(FlightState.roll * 0.15)).toFixed(1)}°C`));
  document.getElementById('esc-2-temp')?.replaceChildren(document.createTextNode(`${(baseTemp + Math.abs(FlightState.pitch * 0.15)).toFixed(1)}°C`));
  document.getElementById('esc-3-temp')?.replaceChildren(document.createTextNode(`${(baseTemp + Math.abs(FlightState.gyroRateZ * 0.08)).toFixed(1)}°C`));
  document.getElementById('esc-4-temp')?.replaceChildren(document.createTextNode(`${(baseTemp + Math.abs(FlightState.vsi * 0.2)).toFixed(1)}°C`));

  syncUIElements();
}

function syncUIElements() {
  const elPitch = document.getElementById('gyro-disp-pitch');
  const elRoll = document.getElementById('gyro-disp-roll');
  const elYaw = document.getElementById('gyro-disp-yaw');
  const elAlt = document.getElementById('gyro-disp-alt');

  if (elPitch) elPitch.textContent = `${FlightState.pitch >= 0 ? '+' : ''}${FlightState.pitch.toFixed(1)}°`;
  if (elRoll) elRoll.textContent = `${FlightState.roll >= 0 ? '+' : ''}${FlightState.roll.toFixed(1)}°`;
  if (elYaw) elYaw.textContent = `${Math.round((FlightState.yaw + 360) % 360).toString().padStart(3, '0')}°`;
  if (elAlt) elAlt.textContent = `${FlightState.altitude.toFixed(1)} m`;

  const valPitch = document.getElementById('val-pitch-slider');
  const valRoll = document.getElementById('val-roll-slider');
  const valYaw = document.getElementById('val-yaw-slider');
  const valThrot = document.getElementById('val-throttle-slider');

  if (valPitch) valPitch.textContent = `${FlightState.pitch >= 0 ? '+' : ''}${FlightState.pitch.toFixed(1)}°`;
  if (valRoll) valRoll.textContent = `${FlightState.roll >= 0 ? '+' : ''}${FlightState.roll.toFixed(1)}°`;
  if (valYaw) valYaw.textContent = `${Math.round((FlightState.yaw + 360) % 360)}°`;
  if (valThrot) valThrot.textContent = `${Math.round(FlightState.throttle)}%`;

  const pfdAirspeed = document.getElementById('pfd-airspeed');
  const pfdVsi = document.getElementById('pfd-vsi');
  const pfdGforce = document.getElementById('pfd-gforce');

  if (pfdAirspeed) pfdAirspeed.textContent = `${Math.round(FlightState.airspeed)} km/h`;
  if (pfdVsi) pfdVsi.textContent = `${FlightState.vsi >= 0 ? '+' : ''}${FlightState.vsi.toFixed(1)} m/s`;
  if (pfdGforce) pfdGforce.textContent = `${FlightState.gforce.toFixed(2)} G`;

  const baseRpm = FlightState.armed ? (FlightState.throttle * 240 + 2000) : 0;
  document.getElementById('m1-rpm')?.replaceChildren(document.createTextNode(`M1: ${(baseRpm + Math.round(FlightState.roll * 8)).toLocaleString()}`));
  document.getElementById('m2-rpm')?.replaceChildren(document.createTextNode(`M2: ${(baseRpm - Math.round(FlightState.roll * 8)).toLocaleString()}`));
  document.getElementById('m3-rpm')?.replaceChildren(document.createTextNode(`M3: ${(baseRpm + Math.round(FlightState.pitch * 8)).toLocaleString()}`));
  document.getElementById('m4-rpm')?.replaceChildren(document.createTextNode(`M4: ${(baseRpm - Math.round(FlightState.pitch * 8)).toLocaleString()}`));
}

// Mode Selection Pill Switcher
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    FlightState.mode = e.currentTarget.dataset.mode;
    playCockpitBeep(880, 0.08, 'sine');
  });
});


// ============================================================================
// 8. Manual Gyro Sliders & 2-Axis Virtual Flight Stick
// ============================================================================
const sliderPitch = document.getElementById('slider-pitch');
const sliderRoll = document.getElementById('slider-roll');
const sliderYaw = document.getElementById('slider-yaw');
const sliderThrottle = document.getElementById('slider-throttle');

sliderPitch?.addEventListener('input', (e) => {
  FlightState.mode = 'manual';
  activateManualPill();
  FlightState.targetPitch = parseFloat(e.target.value);
});

sliderRoll?.addEventListener('input', (e) => {
  FlightState.mode = 'manual';
  activateManualPill();
  FlightState.targetRoll = parseFloat(e.target.value);
});

sliderYaw?.addEventListener('input', (e) => {
  FlightState.mode = 'manual';
  activateManualPill();
  FlightState.targetYaw = parseFloat(e.target.value);
});

sliderThrottle?.addEventListener('input', (e) => {
  FlightState.throttle = parseFloat(e.target.value);
  FlightState.targetAlt = 10 + (FlightState.throttle / 100) * 35;
});

function activateManualPill() {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.mode-btn[data-mode="manual"]')?.classList.add('active');
}

document.getElementById('btn-zero-attitude')?.addEventListener('click', () => {
  FlightState.mode = 'manual';
  activateManualPill();
  FlightState.targetPitch = 0;
  FlightState.targetRoll = 0;
  if (sliderPitch) sliderPitch.value = 0;
  if (sliderRoll) sliderRoll.value = 0;
  playCockpitBeep(520, 0.08, 'sine');
});

// 2-Axis Interactive Virtual Flight Stick
const stickArena = document.getElementById('stick-arena');
const stickPuck = document.getElementById('stick-puck');

if (stickArena && stickPuck) {
  let isStickDragging = false;

  stickArena.addEventListener('pointerdown', (e) => {
    isStickDragging = true;
    stickArena.setPointerCapture(e.pointerId);
    handleStickMove(e);
    playCockpitBeep(600, 0.04, 'triangle');
  });

  stickArena.addEventListener('pointermove', (e) => {
    if (!isStickDragging) return;
    handleStickMove(e);
  });

  function handleStickMove(e) {
    const rect = stickArena.getBoundingClientRect();
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;

    const normX = Math.max(-1, Math.min(1, (e.clientX - rect.left - halfW) / (halfW - 20)));
    const normY = Math.max(-1, Math.min(1, (e.clientY - rect.top - halfH) / (halfH - 20)));

    stickPuck.style.transform = `translate3d(${normX * (halfW - 20)}px, ${normY * (halfH - 20)}px, 0)`;

    FlightState.mode = 'manual';
    activateManualPill();
    FlightState.targetRoll = normX * 45;
    FlightState.targetPitch = -normY * 45;

    if (sliderRoll) sliderRoll.value = FlightState.targetRoll;
    if (sliderPitch) sliderPitch.value = FlightState.targetPitch;
  }

  stickArena.addEventListener('pointerup', (e) => {
    if (!isStickDragging) return;
    isStickDragging = false;
    stickArena.releasePointerCapture(e.pointerId);

    stickPuck.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    stickPuck.style.transform = 'translate3d(0, 0, 0)';
    FlightState.targetRoll = 0;
    FlightState.targetPitch = 0;
    if (sliderRoll) sliderRoll.value = 0;
    if (sliderPitch) sliderPitch.value = 0;

    setTimeout(() => {
      stickPuck.style.transition = '';
    }, 400);
  });
}


// ============================================================================
// 9. BlackBox Flight Log Replay Engine & CSV Export
// ============================================================================
function generateBlackBoxLog() {
  const log = [];
  for (let t = 0; t <= 120; t += 0.2) {
    const pitch = Math.sin(t * 0.4) * 12 + Math.cos(t * 0.8) * 4;
    const roll = Math.cos(t * 0.3) * 22 + Math.sin(t * 1.2) * 8;
    const yaw = (t * 14) % 360;
    const alt = 20 + Math.sin(t * 0.15) * 8;
    const speed = 40 + Math.abs(roll) * 1.1;
    const gforce = 1.0 + Math.abs(roll) * 0.018 + Math.abs(pitch) * 0.012;
    const m1Rpm = 13800 + Math.round(speed * 25 + alt * 30);
    // Smooth 3D tactical flight course (figure-8 / loop maneuver)
    const x = Math.sin(t * 0.18) * 3.8;
    const z = Math.sin(t * 0.36) * 2.4;
    log.push({ t: parseFloat(t.toFixed(1)), pitch, roll, yaw, alt, speed, gforce, m1Rpm, x, z });
  }
  return log;
}
FlightState.replayLogData = generateBlackBoxLog();

const btnPlayPause = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const playLabel = document.getElementById('play-label');
const logScrubber = document.getElementById('log-scrubber');
const logCurrentTime = document.getElementById('log-current-time');
const logStatus = document.getElementById('log-status-indicator');

btnPlayPause?.addEventListener('click', () => {
  FlightState.isReplaying = !FlightState.isReplaying;
  if (FlightState.isReplaying) {
    playIcon.textContent = '⏸';
    playLabel.textContent = 'Pause';
    logStatus.textContent = 'REPLAYING';
    logStatus.className = 'log-indicator';
    logStatus.style.background = 'rgba(0, 240, 255, 0.15)';
    logStatus.style.color = '#38bdf8';
    playCockpitBeep(920, 0.08, 'sine');
  } else {
    playIcon.textContent = '▶';
    playLabel.textContent = 'Play Log';
    logStatus.textContent = 'RECORDING';
    logStatus.className = 'log-indicator live';
    logStatus.style.background = '';
    logStatus.style.color = '';
  }
});

logScrubber?.addEventListener('input', (e) => {
  FlightState.replayTime = parseFloat(e.target.value);
  applyReplayFrame(FlightState.replayTime);
});

// Speed Toggles
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    FlightState.replaySpeed = parseFloat(e.currentTarget.dataset.speed);
    playCockpitBeep(720, 0.05, 'sine');
  });
});

function getReplayFrameAtTime(timeSec) {
  const data = FlightState.replayLogData;
  if (!data || data.length === 0) return null;
  if (data.length === 1) return data[0];

  if (timeSec <= data[0].t) return data[0];
  if (timeSec >= data[data.length - 1].t) return data[data.length - 1];

  let low = 0;
  let high = data.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (data[mid].t === timeSec) return data[mid];
    if (data[mid].t < timeSec) low = mid + 1;
    else high = mid - 1;
  }

  const f0 = data[Math.max(0, high)];
  const f1 = data[Math.min(data.length - 1, low)];
  if (f0 === f1 || f1.t === f0.t) return f0;

  const alpha = Math.max(0, Math.min(1, (timeSec - f0.t) / (f1.t - f0.t)));
  return {
    t: timeSec,
    pitch: f0.pitch + (f1.pitch - f0.pitch) * alpha,
    roll: f0.roll + (f1.roll - f0.roll) * alpha,
    yaw: f0.yaw + (f1.yaw - f0.yaw) * alpha,
    alt: f0.alt + (f1.alt - f0.alt) * alpha,
    speed: f0.speed + (f1.speed - f0.speed) * alpha,
    gforce: (f0.gforce || 1.0) + ((f1.gforce || 1.0) - (f0.gforce || 1.0)) * alpha,
    m1Rpm: (f0.m1Rpm || 14200) + ((f1.m1Rpm || 14200) - (f0.m1Rpm || 14200)) * alpha,
    x: (f0.x || 0) + ((f1.x || 0) - (f0.x || 0)) * alpha,
    z: (f0.z || 0) + ((f1.z || 0) - (f0.z || 0)) * alpha,
    flag: alpha > 0.5 ? f1.flag : f0.flag,
    statusClass: alpha > 0.5 ? f1.statusClass : f0.statusClass
  };
}

function applyReplayFrame(timeSec) {
  const frame = getReplayFrameAtTime(timeSec);
  if (!frame) return;

  FlightState.mode = 'manual';
  activateManualPill();
  FlightState.targetPitch = frame.pitch;
  FlightState.targetRoll = frame.roll;
  FlightState.targetYaw = frame.yaw;
  FlightState.targetAlt = frame.alt;
  FlightState.airspeed = frame.speed;
  if (frame.gforce) FlightState.gforce = frame.gforce;

  // Set instantaneous coordinates & values for immediate responsive 3D feedback
  FlightState.pitch = frame.pitch;
  FlightState.roll = frame.roll;
  FlightState.yaw = frame.yaw;
  FlightState.altitude = frame.alt;
  FlightState.posX = frame.x || 0;
  FlightState.posZ = frame.z || 0;

  if (logCurrentTime) {
    const mins = Math.floor(timeSec / 60).toString().padStart(2, '0');
    const secs = (timeSec % 60).toFixed(1).padStart(4, '0');
    logCurrentTime.textContent = `${mins}:${secs}`;
  }
}

// Export CSV Flight Log
document.getElementById('btn-export-log')?.addEventListener('click', () => {
  playCockpitBeep(1100, 0.12, 'sine');
  let csvContent = "data:text/csv;charset=utf-8,Time_s,Pitch_deg,Roll_deg,Yaw_deg,Altitude_m,Speed_kmh\n";
  FlightState.replayLogData.forEach(row => {
    csvContent += `${row.t},${row.pitch.toFixed(2)},${row.roll.toFixed(2)},${row.yaw.toFixed(2)},${row.alt.toFixed(2)},${row.speed.toFixed(2)}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `AEROLOG_FLIGHT_DATA_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});


// ============================================================================
// 10. Spotlight Cursor Glow On Cards (Framer Aesthetic)
// ============================================================================
document.querySelectorAll('.spotlight-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  });
});


// ============================================================================
// Module 08: Cyber Command Terminal & Quantum Data Bus
// ============================================================================
const termOutput = document.getElementById('terminal-log-output');
const termInput = document.getElementById('term-command-input');
const termForm = document.getElementById('term-command-form');
const termHex = document.getElementById('term-hex-stream');

function appendTerminalLine(text, type = 'info') {
  if (!termOutput) return;
  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  line.textContent = text;
  termOutput.appendChild(line);
  termOutput.scrollTop = termOutput.scrollHeight;
  playCyberChirp();
}

// Hex generator
setInterval(() => {
  if (!termHex) return;
  const randHex = () => '0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  termHex.textContent = `${randHex()} ${randHex()} ${randHex()} ${randHex()} [STREAM_OK]`;
}, 240);

function executeTerminalCommand(cmdRaw) {
  const cmd = cmdRaw.trim().toLowerCase();
  if (!cmd) return;

  appendTerminalLine(`> ${cmdRaw}`, 'user');

  if (cmd === 'help') {
    appendTerminalLine('AVAILABLE: calibrate, warp, shield, rth, mode <hover|bank|acro|neural>, zero, status', 'sys');
  } else if (cmd === 'calibrate' || cmd === 'cal') {
    appendTerminalLine('[CAL] INITIATING DUAL IMU 6-AXIS RE-ZEROING...', 'info');
    setTimeout(() => {
      FlightState.pitch = 0;
      FlightState.roll = 0;
      FlightState.targetPitch = 0;
      FlightState.targetRoll = 0;
      appendTerminalLine('[CAL] BIAS VECTORS COMPENSATED // EKF2 VARIANCE: 0.0001 (PERFECT)', 'ok');
      playCockpitBeep(1200, 0.15, 'sine');
    }, 400);
  } else if (cmd.includes('warp')) {
    triggerWarpJump();
  } else if (cmd.includes('shield')) {
    FlightState.shieldOn = !FlightState.shieldOn;
    if (energyShield) energyShield.visible = FlightState.shieldOn;
    const btn = document.getElementById('btn-toggle-shield');
    if (btn) {
      btn.classList.toggle('active', FlightState.shieldOn);
      btn.querySelector('.toggle-label').textContent = FlightState.shieldOn ? 'Shield: ON' : 'Shield: OFF';
    }
    appendTerminalLine(`[SHIELD] 3D FORCE FIELD: ${FlightState.shieldOn ? 'OVERCHARGED 140%' : 'OFFLINE'}`, FlightState.shieldOn ? 'ok' : 'warn');
    playShieldHarmonic();
  } else if (cmd === 'rth') {
    FlightState.mode = 'hover';
    FlightState.targetAlt = 30.0;
    FlightState.posX = 0;
    FlightState.posZ = 0;
    appendTerminalLine('[AUTONOMOUS] RTH BEACON LOCKED // RETURNING TO HOME BASE...', 'info');
    playCockpitBeep(880, 0.2, 'triangle');
  } else if (cmd.startsWith('mode ')) {
    const modeName = cmd.split(' ')[1];
    if (['hover', 'bank', 'acro', 'neural', 'manual'].includes(modeName)) {
      FlightState.mode = modeName;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      document.querySelector(`.mode-btn[data-mode="${modeName}"]`)?.classList.add('active');
      appendTerminalLine(`[FLIGHT_CTRL] MODE SWITCHED TO: ${modeName.toUpperCase()}`, 'ok');
    } else {
      appendTerminalLine(`[ERROR] UNKNOWN FLIGHT MODE: ${modeName}`, 'warn');
    }
  } else if (cmd === 'zero') {
    document.getElementById('btn-zero-attitude')?.click();
    appendTerminalLine('[OVERRIDE] ZEROING ALL ATTITUDE OFFSETS', 'ok');
  } else {
    appendTerminalLine(`[CMD] EXECUTING: '${cmdRaw}' // ACK RECEIVED (CRC: OK)`, 'info');
  }
}

termForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!termInput) return;
  executeTerminalCommand(termInput.value);
  termInput.value = '';
});

// Macro Chips
document.querySelectorAll('.macro-chip[data-cmd]').forEach(chip => {
  chip.addEventListener('click', (e) => {
    const cmdType = e.currentTarget.dataset.cmd;
    if (cmdType === 'CALIBRATE') executeTerminalCommand('calibrate');
    else if (cmdType === 'SHIELD_BOOST') executeTerminalCommand('shield');
    else if (cmdType === 'WARP_HOP') triggerWarpJump();
    else if (cmdType === 'RTH_ENGAGE') executeTerminalCommand('rth');
  });
});


// ============================================================================
// Module 09: 6-Axis G-Force Vector Ball & Accelerometer Spectrum
// ============================================================================
const gballCanvas = document.getElementById('gball-canvas');
const gballCtx = gballCanvas ? gballCanvas.getContext('2d') : null;
let smoothedGx = 0;
let smoothedGy = 0;

function renderGForceBall() {
  if (!gballCtx || !gballCanvas) return;
  const w = gballCanvas.width;
  const h = gballCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxRadius = 55;

  gballCtx.clearRect(0, 0, w, h);

  // Concentric G-Limit Rings (1G, 2G, 3G)
  [0.33, 0.66, 1.0].forEach((ratio, idx) => {
    gballCtx.strokeStyle = idx === 2 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 240, 255, 0.15)';
    gballCtx.lineWidth = 1;
    gballCtx.beginPath();
    gballCtx.arc(cx, cy, maxRadius * ratio, 0, Math.PI * 2);
    gballCtx.stroke();
  });

  // Crosshairs
  gballCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  gballCtx.beginPath();
  gballCtx.moveTo(cx - maxRadius - 10, cy);
  gballCtx.lineTo(cx + maxRadius + 10, cy);
  gballCtx.moveTo(cx, cy - maxRadius - 10);
  gballCtx.lineTo(cx, cy + maxRadius + 10);
  gballCtx.stroke();

  // Instantaneous G-Components
  const rollRad = THREE.MathUtils.degToRad(FlightState.roll);
  const pitchRad = THREE.MathUtils.degToRad(FlightState.pitch);
  const targetGx = Math.sin(rollRad) * FlightState.gforce;
  const targetGy = -Math.sin(pitchRad) * FlightState.gforce;
  const targetGz = Math.cos(rollRad) * Math.cos(pitchRad) * FlightState.gforce;

  smoothedGx += (targetGx - smoothedGx) * 0.15;
  smoothedGy += (targetGy - smoothedGy) * 0.15;

  const ballX = cx + smoothedGx * (maxRadius / 2.5);
  const ballY = cy + smoothedGy * (maxRadius / 2.5);

  // Vector Line from center to ball
  gballCtx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
  gballCtx.lineWidth = 2;
  gballCtx.beginPath();
  gballCtx.moveTo(cx, cy);
  gballCtx.lineTo(ballX, ballY);
  gballCtx.stroke();

  // Inertial Ball
  const totalG = Math.sqrt(targetGx * targetGx + targetGy * targetGy + targetGz * targetGz);
  const isHighG = totalG > 2.2;

  gballCtx.fillStyle = isHighG ? '#ef4444' : '#00f0ff';
  gballCtx.shadowColor = isHighG ? '#ef4444' : '#00f0ff';
  gballCtx.shadowBlur = 10;
  gballCtx.beginPath();
  gballCtx.arc(ballX, ballY, 6, 0, Math.PI * 2);
  gballCtx.fill();
  gballCtx.shadowBlur = 0;

  // Center Target Ring
  gballCtx.strokeStyle = '#ffffff';
  gballCtx.lineWidth = 1.5;
  gballCtx.beginPath();
  gballCtx.arc(cx, cy, 3, 0, Math.PI * 2);
  gballCtx.stroke();

  // Update DOM readouts
  const elGx = document.getElementById('g-val-x');
  const elGy = document.getElementById('g-val-y');
  const elGz = document.getElementById('g-val-z');
  const barGx = document.getElementById('g-bar-x');
  const barGy = document.getElementById('g-bar-y');
  const barGz = document.getElementById('g-bar-z');
  const pillG = document.getElementById('g-status-pill');
  const textG = document.getElementById('g-status-text');

  if (elGx) elGx.textContent = `${targetGx >= 0 ? '+' : ''}${targetGx.toFixed(2)} G`;
  if (elGy) elGy.textContent = `${targetGy >= 0 ? '+' : ''}${targetGy.toFixed(2)} G`;
  if (elGz) elGz.textContent = `${targetGz.toFixed(2)} G`;

  if (barGx) barGx.style.width = `${Math.min(100, Math.abs(targetGx) * 35)}%`;
  if (barGy) barGy.style.width = `${Math.min(100, Math.abs(targetGy) * 35)}%`;
  if (barGz) barGz.style.width = `${Math.min(100, Math.abs(targetGz) * 30)}%`;

  if (pillG && textG) {
    if (isHighG) {
      pillG.className = 'g-status-indicator high';
      textG.textContent = 'HIGH G WARNING';
    } else {
      pillG.className = 'g-status-indicator normal';
      textG.textContent = 'NOMINAL LOAD';
    }
  }

  if (totalG > FlightState.peakG) {
    FlightState.peakG = totalG;
    const elPeak = document.getElementById('g-val-peak');
    if (elPeak) elPeak.textContent = `${FlightState.peakG.toFixed(2)} G / 5.0 G`;
  }
}


// ============================================================================
// Module 10: Autonomous Tactical Waypoint Mission Tracker
// ============================================================================
function updateWaypointTracker() {
  const elDist = document.getElementById('wp2-dist');
  const elEta = document.getElementById('wp2-eta');
  const elProg = document.getElementById('mission-progress-percent');
  const barProg = document.getElementById('mission-progress-bar');

  // Calculate distance from current posX, posZ to WP02 target (120, -110)
  const dx = 120 - FlightState.posX;
  const dz = -110 - FlightState.posZ;
  const distWp = Math.max(10, Math.round(Math.sqrt(dx * dx + dz * dz)));
  const speedMs = Math.max(1, (FlightState.airspeed * 1000) / 3600);
  const etaSec = Math.round(distWp / speedMs);

  if (elDist) elDist.textContent = `${distWp}m`;
  if (elEta) elEta.textContent = `${etaSec}s`;

  // Dynamic mission progress
  const progress = Math.min(99, Math.max(30, Math.round(50 + (simTick * 0.4) % 45)));
  if (elProg) elProg.textContent = `${progress}%`;
  if (barProg) barProg.style.width = `${progress}%`;
}


// ============================================================================
// Holo-Shader Mode Switcher & Quantum Warp Jump
// ============================================================================
document.querySelectorAll('.holo-pill[data-shader]').forEach(pill => {
  pill.addEventListener('click', (e) => {
    document.querySelectorAll('.holo-pill[data-shader]').forEach(p => p.classList.remove('active'));
    e.currentTarget.classList.add('active');
    const shader = e.currentTarget.dataset.shader;
    applyShaderMode(shader);
    playCockpitBeep(1020, 0.06, 'sine');
  });
});

function applyShaderMode(mode) {
  FlightState.shaderMode = mode;
  if (!droneBodyMesh) return;

  if (mode === 'matrix') {
    droneBodyMesh.material.wireframe = true;
    droneBodyMesh.material.color.setHex(0x10b981);
    if (droneCanopyMesh) droneCanopyMesh.material.wireframe = true;
    if (energyShield) energyShield.material.color.setHex(0x10b981);
    rotorBlurDiscs.forEach(disc => disc.material.color.setHex(0x10b981));
    appendTerminalLine('[OS_SHADERS] GREEN CYBER-MATRIX MESH ACTIVATED', 'ok');
  } else if (mode === 'stealth') {
    droneBodyMesh.material.wireframe = false;
    droneBodyMesh.material.color.setHex(0x0a0a0c);
    droneBodyMesh.material.roughness = 0.9;
    if (droneCanopyMesh) droneCanopyMesh.material.wireframe = false;
    if (energyShield) energyShield.material.color.setHex(0xec4899);
    rotorBlurDiscs.forEach(disc => disc.material.color.setHex(0xec4899));
    appendTerminalLine('[OS_SHADERS] TITANIUM STEALTH ABSORPTION ACTIVE', 'info');
  } else {
    // holo (default)
    droneBodyMesh.material.wireframe = false;
    droneBodyMesh.material.color.setHex(0x111827);
    droneBodyMesh.material.roughness = 0.3;
    if (droneCanopyMesh) droneCanopyMesh.material.wireframe = false;
    if (energyShield) energyShield.material.color.setHex(0x00f0ff);
    rotorBlurDiscs.forEach(disc => disc.material.color.setHex(0x00f0ff));
    appendTerminalLine('[OS_SHADERS] STANDARD QUANTUM HOLO-GLOW RESTORED', 'info');
  }
}

function triggerWarpJump() {
  if (FlightState.isWarping) return;
  FlightState.isWarping = true;
  FlightState.airspeed = 340.0;

  appendTerminalLine('[WARP_DRIVE] TACHYON DRIVE SPUN UP // HYPERSPACE JUMP ENGAGED', 'ok');
  playWarpSound();

  document.body.classList.add('warp-active');

  // Camera Zoom in and back
  if (camera) {
    const originalFov = camera.fov;
    camera.fov = 68;
    camera.updateProjectionMatrix();

    setTimeout(() => {
      camera.fov = originalFov;
      camera.updateProjectionMatrix();
      document.body.classList.remove('warp-active');
      FlightState.isWarping = false;
      FlightState.airspeed = 55.0;
      FlightState.posX += (Math.random() - 0.5) * 80;
      FlightState.posZ += (Math.random() - 0.5) * 80;
      appendTerminalLine('[WARP_DRIVE] HYPERSPACE HOP SUCCESSFUL // VECTOR STABILIZED', 'info');
    }, 1200);
  } else {
    setTimeout(() => {
      document.body.classList.remove('warp-active');
      FlightState.isWarping = false;
    }, 1200);
  }
}

document.getElementById('btn-warp-jump')?.addEventListener('click', () => {
  triggerWarpJump();
});


// ============================================================================
// 11. Mission Clock (MET) & Master High-Frequency 120 FPS Loop
// ============================================================================
let lastChartUpdate = 0;
const missionStart = performance.now();
const missionClockEl = document.getElementById('mission-clock');

function updateMissionClock(now) {
  if (!missionClockEl) return;
  const elapsed = (now - missionStart) / 1000 + 1122.8;
  const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toFixed(1).padStart(4, '0');
  missionClockEl.textContent = `${hours}:${minutes}:${seconds}`;
}

function masterDashboardLoop(timestamp) {
  updateMissionClock(timestamp);

  // If in Replay mode, advance playback smoothly within log time bounds
  if (FlightState.isReplaying && FlightState.replayLogData.length > 0) {
    const minT = FlightState.replayLogData[0].t;
    const maxT = FlightState.replayLogData[FlightState.replayLogData.length - 1].t;
    FlightState.replayTime += (0.016 * FlightState.replaySpeed);
    if (FlightState.replayTime > maxT) {
      FlightState.replayTime = minT;
    }
    if (logScrubber) logScrubber.value = FlightState.replayTime;
    applyReplayFrame(FlightState.replayTime);
  }

  // Update Flight Dynamics (drives 3D drone position, attitude, and animations from readings)
  updateFlightSimulation();

  // Render Primary Flight Display (PFD)
  renderPFD();

  // Render Module 09 6-Axis G-Force Vector Ball
  renderGForceBall();

  // Update Module 10 Tactical Waypoints
  updateWaypointTracker();

  // Render 3D Drone Scene
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }

  // Update History Strip Chart at 30Hz
  if (timestamp - lastChartUpdate > 33) {
    updateHistoryBuffers();
    renderTelemetryChart();
    lastChartUpdate = timestamp;
  }

  requestAnimationFrame(masterDashboardLoop);
}

// ============================================================================
// Module 11: Aerospace BlackBox Logger (SD Card & FRAM Dual Storage) Engine
// ============================================================================

// 1. Storage Data Models: SD Card (Normal Data) & FRAM (Danger / Warning Data)
const BlackBoxStore = {
  activeFilter: 'all',
  searchQuery: '',
  viewMode: 'split', // 'split' or 'grid'
  currentInspectorLog: null,
  activeChartChannels: { pitch: true, roll: true, gforce: true, alt: true, temp: true, volt: true },

  // SD Card Normal Flight Data Logs
  sdLogs: [
    {
      id: 'sd_0042',
      name: 'FLIGHT_LOG_0042_SURVEY.BIN',
      storage: 'sd',
      type: 'BIN',
      severity: 'nominal',
      statusText: 'NOMINAL FLIGHT',
      timestamp: '2026-10-06 10:45:12 UTC',
      met: '00:18:42.8',
      duration: '18m 42s',
      durationSec: 1122,
      records: 1122000,
      odr: '1,000 Hz Dual IMU',
      size: '42.8 MB',
      address: 'CLUSTER: 0x004F80 (FAT32 Sector 1024)',
      crc: 'CRC32: 0x98A4C2E1',
      synopsis: 'Routine Sector 7 Quad-LiDAR mapping mission. 1000Hz Dual IMU, RTK GPS, and motor RPM nominal.',
      peakG: 1.04,
      avgPitch: '+0.4°',
      avgRoll: '-0.2°',
      maxAlt: '34.2 m',
      avgSpeed: '42.5 km/h',
      batt: '15.84 V',
      temp: '38.4°C',
      anomalyIndex: -1,
      diagnosis: {
        summary: 'Nominal survey mission completed without sensor divergence or mechanical excursion.',
        flightProfile: 'Autonomous waypoint navigation with active LiDAR obstacle clearance at 24m AGL.',
        rootCause: 'All 8 mounted sensors operating within 99.8% Kalman residual confidence margin.',
        action: 'Routine pre-flight battery balance check recommended before next mission sortie.'
      }
    },
    {
      id: 'sd_0041',
      name: 'TELEMETRY_HOVER_HOLD_0041.CSV',
      storage: 'sd',
      type: 'CSV',
      severity: 'nominal',
      statusText: 'NOMINAL HOVER',
      timestamp: '2026-10-06 09:20:44 UTC',
      met: '00:12:10.5',
      duration: '12m 10s',
      durationSec: 730,
      records: 730000,
      odr: '500 Hz RTK Precision',
      size: '28.4 MB',
      address: 'CLUSTER: 0x003A20 (FAT32 Sector 768)',
      crc: 'CRC32: 0x47B19DE0',
      synopsis: 'Precision GPS-RTK stationary hover hold stability test. Position variance < 0.04m horizontal.',
      peakG: 1.02,
      avgPitch: '+0.1°',
      avgRoll: '+0.0°',
      maxAlt: '15.0 m',
      avgSpeed: '1.2 km/h',
      batt: '15.98 V',
      temp: '36.8°C',
      anomalyIndex: -1,
      diagnosis: {
        summary: 'Hover hold stability benchmark successfully validated RTK carrier phase fix (24 Sats).',
        flightProfile: 'Zero groundspeed hold in 12 knot crosswind with active motor differential compensation.',
        rootCause: 'Barometric and RTK altitude fusion showed zero drift (< 0.02m residual variance).',
        action: 'Benchmark logs archived to flight dynamics reference dataset.'
      }
    },
    {
      id: 'sd_0040',
      name: 'CRUISE_CORRIDOR_WAYPOINTS_0040.DAT',
      storage: 'sd',
      type: 'DAT',
      severity: 'nominal',
      statusText: 'NOMINAL TRANSIT',
      timestamp: '2026-10-06 08:05:19 UTC',
      met: '00:24:15.0',
      duration: '24m 15s',
      durationSec: 1455,
      records: 1455000,
      odr: '1,000 Hz Multi-Sensor',
      size: '55.2 MB',
      address: 'CLUSTER: 0x002B40 (FAT32 Sector 512)',
      crc: 'CRC32: 0xA194EC77',
      synopsis: 'Long-distance waypoint transit between Base Launch and Vector Alpha. Ground track nominal.',
      peakG: 1.28,
      avgPitch: '+2.1°',
      avgRoll: '+1.4°',
      maxAlt: '58.0 m',
      avgSpeed: '54.2 km/h',
      batt: '15.42 V',
      temp: '41.2°C',
      anomalyIndex: -1,
      diagnosis: {
        summary: 'High-speed transit along restricted aerospace corridor completed on schedule.',
        flightProfile: 'Continuous 54 km/h cruising flight with neural wind-vector angle estimation.',
        rootCause: 'Battery consumption curve matched theoretical model within 2.3% margin.',
        action: 'Corridor waypoint path verified for autonomous commercial delivery operations.'
      }
    },
    {
      id: 'sd_0039',
      name: 'ESC_QUAD_BENCH_CALIB_0039.BIN',
      storage: 'sd',
      type: 'BIN',
      severity: 'nominal',
      statusText: 'NOMINAL CALIBRATION',
      timestamp: '2026-10-05 18:30:00 UTC',
      met: '00:08:30.0',
      duration: '08m 30s',
      durationSec: 510,
      records: 510000,
      odr: '1,000 Hz CAN-FD',
      size: '19.3 MB',
      address: 'CLUSTER: 0x001F10 (FAT32 Sector 256)',
      crc: 'CRC32: 0x33DF7882',
      synopsis: '4-Motor ESC synchronous RPM ramp & TCAN334 CAN-FD bus telemetry calibration protocol.',
      peakG: 1.01,
      avgPitch: '+0.0°',
      avgRoll: '+0.0°',
      maxAlt: '0.0 m (Bench)',
      avgSpeed: '0.0 km/h',
      batt: '16.20 V',
      temp: '42.4°C',
      anomalyIndex: -1,
      diagnosis: {
        summary: 'Synchronous motor speed sweep confirmed linear throttle-to-RPM curves across all 4 ESCs.',
        flightProfile: 'Static ground test stand motor spin-up to 16,000 RPM at 10% duty cycle increments.',
        rootCause: 'Phase commutation timing jitter measured < 2.8 microseconds across CAN-FD bus.',
        action: 'Motor ESC firmware calibrated and approved for flight envelope expansion.'
      }
    },
    {
      id: 'sd_0038',
      name: 'BARO_STEP_CLIMB_0038.CSV',
      storage: 'sd',
      type: 'CSV',
      severity: 'nominal',
      statusText: 'NOMINAL CLIMB',
      timestamp: '2026-10-05 16:12:15 UTC',
      met: '00:15:05.2',
      duration: '15m 05s',
      durationSec: 905,
      records: 905000,
      odr: '1,000 Hz Precision',
      size: '34.6 MB',
      address: 'CLUSTER: 0x001200 (FAT32 Sector 128)',
      crc: 'CRC32: 0x7E1854C9',
      synopsis: 'Stepped vertical climb 0m -> 120m AGL profiling atmospheric lapse rate and pressure curves.',
      peakG: 1.35,
      avgPitch: '+4.5°',
      avgRoll: '+0.2°',
      maxAlt: '120.0 m',
      avgSpeed: '18.4 km/h',
      batt: '15.65 V',
      temp: '37.1°C',
      anomalyIndex: -1,
      diagnosis: {
        summary: 'Atmospheric pressure vertical climb verified BMP390 sensor accuracy against RTK datum.',
        flightProfile: '10-meter stepped vertical altitude holding with vertical climb rate at 2.4 m/s.',
        rootCause: 'Altitude estimate covariance stayed below 0.05m throughout full altitude ceiling.',
        action: 'Vertical climb flight envelope verified up to maximum authorized regulatory limit.'
      }
    },
    {
      id: 'sd_0037',
      name: 'MAG_ELLIPSOID_CALIB_0037.DAT',
      storage: 'sd',
      type: 'DAT',
      severity: 'nominal',
      statusText: 'NOMINAL COMPASS',
      timestamp: '2026-10-05 14:00:30 UTC',
      met: '00:05:20.0',
      duration: '05m 20s',
      durationSec: 320,
      records: 320000,
      odr: '1,000 Hz Magnetometer',
      size: '12.1 MB',
      address: 'CLUSTER: 0x000E00 (FAT32 Sector 64)',
      crc: 'CRC32: 0x5C80B32E',
      synopsis: '3-Axis RM3100 magnetic compass calibration in 360° pitch and yaw sphere rotation sequence.',
      peakG: 1.12,
      avgPitch: '+0.0°',
      avgRoll: '+0.0°',
      maxAlt: '3.0 m',
      avgSpeed: '4.2 km/h',
      batt: '16.02 V',
      temp: '35.9°C',
      anomalyIndex: -1,
      diagnosis: {
        summary: 'Geomagnetic sphere fit calibration achieved 99.7% circularity with zero hard-iron bias.',
        flightProfile: '360-degree slow spherical yaw and roll maneuvers in magnetically clean airspace.',
        rootCause: 'Hard and soft iron compensation matrices successfully calculated and saved to NVRAM.',
        action: 'Heading accuracy confirmed within ± 0.5 degrees across all 4 cardinal quadrants.'
      }
    }
  ],

  // FRAM Danger & Warning Incident Snapshots
  framLogs: [
    {
      id: 'fram_00a1',
      name: 'FRAM_EVT_0x00A1_HIGH_G_IMPACT',
      storage: 'fram',
      type: 'FRAM',
      severity: 'danger',
      statusText: 'CRITICAL DANGER',
      trigger: 'High-G Shock Load (+4.82 G Load Vector)',
      address: '0x00A1F0 - 0x00B2E0 (120 ns Flush)',
      timestamp: '2026-10-06 10:59:04 UTC (MET 00:14:22.4)',
      met: '00:14:22.4',
      duration: '4.2s Incident Freeze',
      durationSec: 4.2,
      records: 4200,
      odr: '1,000 Hz Zero-Latency',
      size: '64 KB Non-Volatile',
      crc: 'CRC16: 0xC3F1 [VALID]',
      synopsis: 'Severe angular jerk during high-rate collision avoidance roll. Accelerometer peaked at +4.82G Z-axis.',
      peakG: 4.82,
      avgPitch: '+38.5°',
      avgRoll: '-42.1°',
      maxAlt: '28.4 m',
      avgSpeed: '58.0 km/h',
      batt: '15.10 V',
      temp: '44.8°C',
      anomalyIndex: 26,
      diagnosis: {
        summary: 'Extreme dynamic load spike of 4.82 G detected during sharp banking evasive roll.',
        flightProfile: 'High-rate acrobatic collision avoidance vector engaged to clear airborne obstacle.',
        rootCause: 'Rapid roll reversal generated 4.82 G combined centripetal and vertical load vector.',
        action: 'CRITICAL: Inspect carbon-fiber airframe motor arms and prop hub mounts for structural micro-fractures before clearing aircraft for next flight.'
      }
    },
    {
      id: 'fram_0078',
      name: 'FRAM_EVT_0x0078_ESC2_OVERHEAT',
      storage: 'fram',
      type: 'FRAM',
      severity: 'warning',
      statusText: 'HIGH WARNING',
      trigger: 'ESC #2 FET Junction Exceeded 89.2°C Threshold',
      address: '0x007820 - 0x008400 (140 ns Flush)',
      timestamp: '2026-10-06 10:55:48 UTC (MET 00:11:05.8)',
      met: '00:11:05.8',
      duration: '3.8s Incident Freeze',
      durationSec: 3.8,
      records: 3800,
      odr: '1,000 Hz CAN-FD Thermal',
      size: '48 KB Non-Volatile',
      crc: 'CRC16: 0x8DF2 [VALID]',
      synopsis: 'FET junction temperature on Front-Left ESC #2 reached 89.2°C under sustained maximum climb current.',
      peakG: 1.22,
      avgPitch: '+12.4°',
      avgRoll: '+1.0°',
      maxAlt: '45.0 m',
      avgSpeed: '32.1 km/h',
      batt: '14.88 V',
      temp: '89.2°C (PEAK)',
      anomalyIndex: 22,
      diagnosis: {
        summary: 'Front-Left ESC #2 exceeded 85°C thermal safety margin, triggering autonomous thermal throttling.',
        flightProfile: 'Prolonged high-thrust vertical ascent against 18 knot headwind.',
        rootCause: 'Reduced slipstream airflow over ESC heatsink during steep climb angle accumulated thermal debt.',
        action: 'Verify ESC thermal paste bonding and clean motor ventilation cooling duct ducts.'
      }
    },
    {
      id: 'fram_0045',
      name: 'FRAM_EVT_0x0045_BATT_VOLT_SAG',
      storage: 'fram',
      type: 'FRAM',
      severity: 'warning',
      statusText: 'HIGH WARNING',
      trigger: 'Solid-State Battery Cell 3 Sag (< 3.18V @ 68A Load)',
      address: '0x004500 - 0x005120 (110 ns Flush)',
      timestamp: '2026-10-06 10:53:01 UTC (MET 00:08:19.1)',
      met: '00:08:19.1',
      duration: '3.5s Incident Freeze',
      durationSec: 3.5,
      records: 3500,
      odr: '1,000 Hz Power Bus',
      size: '42 KB Non-Volatile',
      crc: 'CRC16: 0x51E9 [VALID]',
      synopsis: 'Transient 68.4A current draw caused cell #3 voltage to dip to 3.18V before power distributor balanced load.',
      peakG: 1.65,
      avgPitch: '+18.0°',
      avgRoll: '-6.2°',
      maxAlt: '31.2 m',
      avgSpeed: '48.9 km/h',
      batt: '13.12 V (SAG)',
      temp: '42.0°C',
      anomalyIndex: 20,
      diagnosis: {
        summary: 'High transient current draw produced cell voltage sag to 3.18V, triggering non-volatile freeze.',
        flightProfile: 'Aggressive four-motor full throttle punch to clear terrain ridge line.',
        rootCause: 'Internal resistance in Cell #3 slightly higher than cells 1, 2, and 4 during cold air intake.',
        action: 'Run automated battery pack impedance analysis and cycle test through battery management system.'
      }
    },
    {
      id: 'fram_002b',
      name: 'FRAM_EVT_0x002B_GEOFENCE_PROXIMITY',
      storage: 'fram',
      type: 'FRAM',
      severity: 'danger',
      statusText: 'CRITICAL DANGER',
      trigger: 'Tactical Geofence Margin < 12.4m to 1000m Cylinder',
      address: '0x002B10 - 0x0037A0 (130 ns Flush)',
      timestamp: '2026-10-06 10:50:26 UTC (MET 00:05:44.2)',
      met: '00:05:44.2',
      duration: '4.0s Incident Freeze',
      durationSec: 4.0,
      records: 4000,
      odr: '1,000 Hz RTK Nav',
      size: '56 KB Non-Volatile',
      crc: 'CRC16: 0xA412 [VALID]',
      synopsis: 'Aircraft transit speed approached outer perimeter boundary. Autopilot engaged auto-braking reverse thrust.',
      peakG: 2.41,
      avgPitch: '-22.0°',
      avgRoll: '+4.5°',
      maxAlt: '22.0 m',
      avgSpeed: '62.0 km/h',
      batt: '15.30 V',
      temp: '39.2°C',
      anomalyIndex: 24,
      diagnosis: {
        summary: 'Aircraft breached 20m warning corridor, approaching within 12.4m of authorized 1,000m security cylinder.',
        flightProfile: 'High-speed autonomous cruise along designated mission boundary.',
        rootCause: 'Wind gust vector at 048° accelerated groundspeed beyond planned braking deceleration distance.',
        action: 'Autopilot counter-thrust braking succeeded in preventing perimeter violation. Expand safety margin to 40m for future high-wind flight plans.'
      }
    },
    {
      id: 'fram_0014',
      name: 'FRAM_EVT_0x0014_IMU_RESIDUAL_DELTA',
      storage: 'fram',
      type: 'FRAM',
      severity: 'warning',
      statusText: 'WARNING // SENSOR DELTA',
      trigger: 'Dual IMU Accelerometer Discrepancy > 0.092g',
      address: '0x001440 - 0x002010 (125 ns Flush)',
      timestamp: '2026-10-06 10:46:53 UTC (MET 00:02:11.7)',
      met: '00:02:11.7',
      duration: '3.0s Incident Freeze',
      durationSec: 3.0,
      records: 3000,
      odr: '1,000 Hz Dual IMU',
      size: '36 KB Non-Volatile',
      crc: 'CRC16: 0x3F90 [VALID]',
      synopsis: 'Motor acoustic vibration excited ICM-42688P #1 resonant filter; divergence from IMU #2 was auto-suppressed by EKF2.',
      peakG: 1.15,
      avgPitch: '+1.2°',
      avgRoll: '-0.8°',
      maxAlt: '18.5 m',
      avgSpeed: '22.0 km/h',
      batt: '15.75 V',
      temp: '38.0°C',
      anomalyIndex: 18,
      diagnosis: {
        summary: 'Sensor variance between primary and secondary ICM-42688P IMUs exceeded 0.08g EKF2 threshold.',
        flightProfile: 'Hover transitions into forward flight with motor RPM ramp.',
        rootCause: 'Acoustic vibration harmonic from propeller blade tip turbulence matched IMU 1 mounting resonance.',
        action: 'Check silicone vibration isolator dampers on flight controller PCB stack.'
      }
    },
    {
      id: 'fram_0008',
      name: 'FRAM_EVT_0x0008_MOTOR3_DESYNC',
      storage: 'fram',
      type: 'FRAM',
      severity: 'danger',
      statusText: 'CRITICAL DANGER',
      trigger: 'Motor 3 Commutation Phase Loss & Back-EMF Anomaly',
      address: '0x000800 - 0x001390 (95 ns Flush)',
      timestamp: '2026-10-06 10:45:47 UTC (MET 00:01:04.9)',
      met: '00:01:04.9',
      duration: '3.2s Incident Freeze',
      durationSec: 3.2,
      records: 3200,
      odr: '1,000 Hz High-Speed Comm',
      size: '44 KB Non-Volatile',
      crc: 'CRC16: 0x77D1 [VALID]',
      synopsis: 'Microsecond commutation jitter on Motor 3 stator phase. Neural controller re-timed ESC pulses in 12ms.',
      peakG: 1.88,
      avgPitch: '-5.0°',
      avgRoll: '+14.2°',
      maxAlt: '12.0 m',
      avgSpeed: '14.0 km/h',
      batt: '15.80 V',
      temp: '43.1°C',
      anomalyIndex: 21,
      diagnosis: {
        summary: 'Motor 3 stator winding Phase C experienced instantaneous back-EMF desynchronization.',
        flightProfile: 'Rapid altitude transition from 10m to 15m immediately following takeoff.',
        rootCause: 'Rapid throttle step caused transient magnetic saturation in motor stator pole iron.',
        action: 'Perform motor winding resistance bench test and re-flash ESC firmware timing parameters.'
      }
    }
  ]
};

// Generate realistic telemetry rows for table & waveforms
function generateLogTelemetryData(logItem) {
  const points = [];
  const isFram = logItem.storage === 'fram';
  const totalRows = isFram ? 45 : 60;
  const anomalyIdx = logItem.anomalyIndex >= 0 ? logItem.anomalyIndex : -1;
  const baseTime = 10.0;

  for (let i = 0; i < totalRows; i++) {
    const time = parseFloat((baseTime + i * 0.1).toFixed(2));
    let pitch = Math.sin(i * 0.25) * 4.0;
    let roll = Math.cos(i * 0.2) * 3.5;
    let yaw = (140 + i * 0.8) % 360;
    let alt = 24.0 + Math.sin(i * 0.1) * 3.0;
    let speed = 42.0 + Math.cos(i * 0.15) * 4.0;
    let gforce = 1.0 + Math.sin(i * 0.3) * 0.05;
    let batt = 15.8 - (i * 0.005);
    let temp = 38.0 + (i * 0.08);
    let rpm = 14200 + Math.round(Math.sin(i * 0.4) * 200);
    let flag = 'NOMINAL';
    let statusClass = 'ok';
    let x = Math.sin((i / totalRows) * Math.PI * 2) * 3.5;
    let z = Math.cos((i / totalRows) * Math.PI * 2) * 2.2;

    // Inject danger / warning anomalies if this is an incident log
    if (isFram && anomalyIdx >= 0) {
      if (i === anomalyIdx) {
        if (logItem.id.includes('G_IMPACT') || logItem.id.includes('G_SHOCK')) {
          gforce = logItem.peakG;
          pitch = 38.5;
          roll = -42.1;
          alt = 12.0;
          speed = 58.0;
          x += 1.8;
          z += 1.2;
          flag = `🚨 IMPACT SPIKE +${logItem.peakG}G`;
          statusClass = 'danger';
        } else if (logItem.id.includes('OVERHEAT')) {
          temp = 89.2;
          rpm = 15800;
          flag = '⚠️ ESC2 OVERHEAT 89.2°C';
          statusClass = 'warning';
        } else if (logItem.id.includes('VOLT_SAG')) {
          batt = 13.12;
          rpm = 15400;
          alt = 18.0;
          flag = '⚠️ VOLT SAG 3.18V/CELL';
          statusClass = 'warning';
        } else if (logItem.id.includes('GEOFENCE')) {
          gforce = 2.41;
          pitch = -22.0;
          speed = 62.0;
          z += 2.4;
          flag = '🚨 GEOFENCE BREACH RISK';
          statusClass = 'danger';
        } else if (logItem.id.includes('IMU')) {
          gforce = 1.15;
          flag = '⚠️ IMU RESIDUAL Δ 0.092g';
          statusClass = 'warning';
        } else if (logItem.id.includes('MOTOR')) {
          gforce = 1.88;
          rpm = 11800;
          roll = 14.2;
          flag = '🚨 MOTOR 3 DESYNC';
          statusClass = 'danger';
        }
      } else if (i === anomalyIdx - 1 || i === anomalyIdx + 1) {
        // Shoulder around anomaly
        gforce = 1.0 + (logItem.peakG - 1.0) * 0.45;
        if (logItem.id.includes('OVERHEAT')) temp = 82.0;
        if (logItem.id.includes('VOLT_SAG')) batt = 13.9;
        flag = isFram && logItem.severity === 'danger' ? 'RECOVERY' : 'ADJUSTING';
        statusClass = logItem.severity === 'danger' ? 'danger' : 'warning';
      }
    }

    points.push({
      idx: i + 1,
      time,
      pitch: parseFloat(pitch.toFixed(2)),
      roll: parseFloat(roll.toFixed(2)),
      yaw: parseFloat(yaw.toFixed(1)),
      alt: parseFloat(alt.toFixed(2)),
      speed: parseFloat(speed.toFixed(1)),
      gforce: parseFloat(gforce.toFixed(2)),
      batt: parseFloat(batt.toFixed(2)),
      temp: parseFloat(temp.toFixed(1)),
      m1Rpm: rpm,
      m2Rpm: rpm - 20,
      m3Rpm: rpm + 15,
      m4Rpm: rpm - 10,
      x: parseFloat(x.toFixed(2)),
      z: parseFloat(z.toFixed(2)),
      flag,
      statusClass
    });
  }

  return points;
}

// 2. Render Cards in Logger Directory
function renderAllLogCards() {
  const sdListEl = document.getElementById('list-sd-logs');
  const framListEl = document.getElementById('list-fram-logs');
  if (!sdListEl || !framListEl) return;

  sdListEl.innerHTML = '';
  framListEl.innerHTML = '';

  const q = BlackBoxStore.searchQuery.toLowerCase();
  const filter = BlackBoxStore.activeFilter;

  // Filter SD logs
  const filteredSD = BlackBoxStore.sdLogs.filter(item => {
    if (filter === 'fram' || filter === 'danger' || filter === 'warning') return false;
    if (!q) return true;
    return item.name.toLowerCase().includes(q) ||
           item.synopsis.toLowerCase().includes(q) ||
           item.type.toLowerCase().includes(q);
  });

  // Filter FRAM logs
  const filteredFRAM = BlackBoxStore.framLogs.filter(item => {
    if (filter === 'sd') return false;
    if (filter === 'danger' && item.severity !== 'danger') return false;
    if (filter === 'warning' && item.severity !== 'warning') return false;
    if (!q) return true;
    return item.name.toLowerCase().includes(q) ||
           item.trigger.toLowerCase().includes(q) ||
           item.synopsis.toLowerCase().includes(q);
  });

  // Update badge counters
  const totalCount = BlackBoxStore.sdLogs.length + BlackBoxStore.framLogs.length;
  const dangerCount = BlackBoxStore.framLogs.filter(x => x.severity === 'danger').length;
  const warningCount = BlackBoxStore.framLogs.filter(x => x.severity === 'warning').length;

  const bAll = document.getElementById('badge-count-all');
  const bSD = document.getElementById('badge-count-sd');
  const bFRAM = document.getElementById('badge-count-fram');
  const bDanger = document.getElementById('badge-count-danger');
  const bWarning = document.getElementById('badge-count-warning');

  if (bAll) bAll.textContent = totalCount;
  if (bSD) bSD.textContent = BlackBoxStore.sdLogs.length;
  if (bFRAM) bFRAM.textContent = BlackBoxStore.framLogs.length;
  if (bDanger) bDanger.textContent = dangerCount;
  if (bWarning) bWarning.textContent = warningCount;

  const colSDBadge = document.getElementById('col-sd-badge');
  const colFRAMBadge = document.getElementById('col-fram-badge');
  if (colSDBadge) colSDBadge.textContent = `${filteredSD.length} Sessions Available`;
  if (colFRAMBadge) colFRAMBadge.textContent = `${filteredFRAM.length} Incidents Frozen`;

  // Render SD cards
  if (filteredSD.length === 0) {
    sdListEl.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--text-dim); font-family:var(--font-mono); font-size:0.75rem;">No SD Card logs match current filter criteria.</div>`;
  } else {
    filteredSD.forEach(item => {
      sdListEl.appendChild(createLogCardElement(item));
    });
  }

  // Render FRAM cards
  if (filteredFRAM.length === 0) {
    framListEl.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--text-dim); font-family:var(--font-mono); font-size:0.75rem;">No FRAM incident logs match current filter criteria.</div>`;
  } else {
    filteredFRAM.forEach(item => {
      framListEl.appendChild(createLogCardElement(item));
    });
  }

  // Spotlight card mouse tracking
  document.querySelectorAll('.log-entry-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });
}

function createLogCardElement(item) {
  const card = document.createElement('div');
  const isSD = item.storage === 'sd';
  card.className = `log-entry-card ${isSD ? 'type-sd' : 'type-fram'} ${!isSD ? (item.severity === 'danger' ? 'sev-danger' : 'sev-warning') : ''}`;

  let severityBadgeHtml = '';
  if (isSD) {
    severityBadgeHtml = `<span class="log-severity-pill nominal">✅ NOMINAL</span>`;
  } else if (item.severity === 'danger') {
    severityBadgeHtml = `<span class="log-severity-pill danger">🚨 CRITICAL DANGER</span>`;
  } else {
    severityBadgeHtml = `<span class="log-severity-pill warning">⚠️ HIGH WARNING</span>`;
  }

  const storageBadge = isSD
    ? `<span class="badge-storage-type sd">💾 SD CARD FAT32</span>`
    : `<span class="badge-storage-type fram">⚡ FRAM NON-VOLATILE</span>`;

  card.innerHTML = `
    <div class="log-card-top-row">
      <div class="card-title-group">
        ${storageBadge}
        <span class="log-file-name" title="${item.name}">${item.name}</span>
      </div>
      ${severityBadgeHtml}
    </div>

    <div class="log-synopsis">
      ${isSD ? item.synopsis : `<strong>Trigger:</strong> ${item.trigger}. ${item.synopsis}`}
    </div>

    <div class="log-card-metrics-strip">
      <div class="l-metric"><span class="k">PEAK G:</span><span class="v ${item.peakG > 2.0 ? 'red' : 'green'}">${item.peakG} G</span></div>
      <div class="l-metric"><span class="k">${isSD ? 'DURATION:' : 'FLUSH:'}</span><span class="v cyan">${isSD ? item.duration : '120 ns'}</span></div>
      <div class="l-metric"><span class="k">${isSD ? 'RECORDS:' : 'OFFSET:'}</span><span class="v">${isSD ? item.records.toLocaleString() : item.address.split(' ')[0]}</span></div>
      <div class="l-metric"><span class="k">${isSD ? 'RATE:' : 'TEMP:'}</span><span class="v amber">${isSD ? '1000 Hz' : item.temp}</span></div>
    </div>

    <div class="log-card-footer">
      <span class="log-card-time">📅 ${item.timestamp}</span>
      <div class="log-card-actions">
        <button class="btn-card-action inspect-btn" title="Inspect complete telemetry table, waveforms, and raw hex">
          <span>👁️ Inspect Data Inside</span>
        </button>
        <button class="btn-card-action replay-btn" title="Load and replay this log in 3D Cockpit">
          <span>▶ Replay</span>
        </button>
      </div>
    </div>
  `;

  // Clicking anywhere on card or on Inspect button opens inspector
  card.addEventListener('click', (e) => {
    // If replay button clicked specifically
    if (e.target.closest('.replay-btn')) {
      e.stopPropagation();
      replayLogInCockpit(item);
      return;
    }
    openBlackBoxInspector(item);
  });

  return card;
}

// 3. Data Inspector Modal Engine
function openBlackBoxInspector(logItem) {
  BlackBoxStore.currentInspectorLog = logItem;
  playCockpitBeep(880, 0.08, 'sine');

  const backdrop = document.getElementById('inspector-modal-backdrop');
  if (!backdrop) return;

  // Populate Header & Meta
  document.getElementById('modal-log-title').textContent = logItem.name;
  document.getElementById('modal-log-desc').textContent = logItem.synopsis;

  const storagePill = document.getElementById('modal-storage-pill');
  if (logItem.storage === 'sd') {
    storagePill.textContent = '💾 SD CARD (FAT32)';
    storagePill.className = 'modal-storage-pill';
    storagePill.style.background = 'rgba(0, 240, 255, 0.15)';
    storagePill.style.color = '#00f0ff';
    storagePill.style.borderColor = 'rgba(0, 240, 255, 0.4)';
  } else {
    storagePill.textContent = '⚡ FRAM NON-VOLATILE';
    storagePill.className = 'modal-storage-pill';
    storagePill.style.background = 'rgba(245, 158, 11, 0.2)';
    storagePill.style.color = '#fbbf24';
    storagePill.style.borderColor = 'rgba(245, 158, 11, 0.5)';
  }

  const sevPill = document.getElementById('modal-severity-pill');
  if (logItem.severity === 'nominal') {
    sevPill.textContent = '✅ NOMINAL FLIGHT';
    sevPill.className = 'modal-severity-pill';
    sevPill.style.background = 'rgba(16, 185, 129, 0.15)';
    sevPill.style.color = '#10b981';
    sevPill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
  } else if (logItem.severity === 'danger') {
    sevPill.textContent = '🚨 CRITICAL DANGER';
    sevPill.className = 'modal-severity-pill';
    sevPill.style.background = 'rgba(239, 68, 68, 0.25)';
    sevPill.style.color = '#fca5a5';
    sevPill.style.borderColor = 'rgba(239, 68, 68, 0.6)';
  } else {
    sevPill.textContent = '⚠️ HIGH WARNING';
    sevPill.className = 'modal-severity-pill';
    sevPill.style.background = 'rgba(245, 158, 11, 0.2)';
    sevPill.style.color = '#fde047';
    sevPill.style.borderColor = 'rgba(245, 158, 11, 0.55)';
  }

  document.getElementById('modal-address-chip').textContent = logItem.address;
  document.getElementById('modal-meta-time').textContent = logItem.timestamp;
  document.getElementById('modal-meta-duration').textContent = logItem.duration;
  document.getElementById('modal-meta-records').textContent = `${logItem.records.toLocaleString()} Pkts`;
  document.getElementById('modal-meta-odr').textContent = logItem.odr;
  document.getElementById('modal-meta-g').textContent = `${logItem.peakG} G`;
  document.getElementById('modal-meta-crc').textContent = logItem.crc;

  // Generate telemetry rows
  const telemetryData = generateLogTelemetryData(logItem);
  logItem._cachedTelemetry = telemetryData;

  // Render Table
  renderInspectorTable(telemetryData);

  // Render Waveform Canvas
  renderInspectorChart(logItem, BlackBoxStore.activeChartChannels);

  // Render Raw Hex
  renderInspectorHex(logItem);

  // Render Diagnosis
  renderInspectorDiagnosis(logItem);

  // Default to Table tab
  switchModalTab('table');

  // Open backdrop
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBlackBoxInspector() {
  const backdrop = document.getElementById('inspector-modal-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
  }
  document.body.style.overflow = '';
  playCockpitBeep(640, 0.05, 'sine');
}

// Render Telemetry Table inside Modal
function renderInspectorTable(rows) {
  const tbody = document.getElementById('modal-table-tbody');
  const countEl = document.getElementById('modal-table-rowcount');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (countEl) countEl.textContent = `Showing ${rows.length} sample data packets (1,000 Hz stream)`;

  rows.forEach(r => {
    const tr = document.createElement('tr');
    if (r.statusClass === 'danger') tr.className = 'row-danger';
    else if (r.statusClass === 'warning') tr.className = 'row-warning';

    tr.innerHTML = `
      <td>${r.idx}</td>
      <td><strong>${r.time.toFixed(2)}s</strong></td>
      <td>${r.pitch > 0 ? '+' : ''}${r.pitch.toFixed(1)}°</td>
      <td>${r.roll > 0 ? '+' : ''}${r.roll.toFixed(1)}°</td>
      <td>${r.yaw.toFixed(0)}°</td>
      <td>${r.alt.toFixed(1)}m</td>
      <td>${r.speed.toFixed(1)}</td>
      <td><strong>${r.gforce.toFixed(2)}G</strong></td>
      <td>${r.batt.toFixed(2)}V</td>
      <td>${r.temp.toFixed(1)}°C</td>
      <td>${r.m1Rpm}</td>
      <td><span class="tag-row-flag ${r.statusClass}">${r.flag}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Table Search Filter inside Modal
document.getElementById('modal-table-search')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const log = BlackBoxStore.currentInspectorLog;
  if (!log || !log._cachedTelemetry) return;

  if (!term) {
    renderInspectorTable(log._cachedTelemetry);
    return;
  }

  const filtered = log._cachedTelemetry.filter(r => {
    return r.time.toString().includes(term) ||
           r.flag.toLowerCase().includes(term) ||
           r.pitch.toString().includes(term) ||
           r.roll.toString().includes(term) ||
           r.gforce.toString().includes(term) ||
           r.alt.toString().includes(term);
  });
  renderInspectorTable(filtered);
});

// Render High-DPI Waveform Chart Canvas inside Modal
function renderInspectorChart(logItem, channels) {
  const canvas = document.getElementById('inspector-waveform-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth || 940;
  const h = 320;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  // Background grid
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.lineWidth = 1;

  const cols = 10;
  const rows = 6;
  for (let c = 0; c <= cols; c++) {
    const x = (w / cols) * c;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = (h / rows) * r;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const data = logItem._cachedTelemetry || [];
  if (data.length < 2) return;

  const n = data.length;
  const anomalyIdx = logItem.anomalyIndex >= 0 ? logItem.anomalyIndex : -1;

  // Channel definitions: color & normalization mapping
  const chanDefs = [
    { key: 'pitch', label: 'Pitch', color: '#00f0ff', enabled: channels.pitch, min: -45, max: 45 },
    { key: 'roll', label: 'Roll', color: '#ec4899', enabled: channels.roll, min: -45, max: 45 },
    { key: 'gforce', label: 'G-Force', color: '#f59e0b', enabled: channels.gforce, min: 0, max: 5.0 },
    { key: 'alt', label: 'Altitude', color: '#10b981', enabled: channels.alt, min: 0, max: 100 },
    { key: 'temp', label: 'Temperature', color: '#c084fc', enabled: channels.temp, min: 20, max: 100 },
    { key: 'batt', label: 'Voltage', color: '#eab308', enabled: channels.volt, min: 12, max: 17 }
  ];

  chanDefs.forEach(ch => {
    if (!ch.enabled) return;

    ctx.strokeStyle = ch.color;
    ctx.lineWidth = ch.key === 'gforce' ? 2.5 : 1.8;
    ctx.beginPath();

    data.forEach((pt, i) => {
      const x = (i / (n - 1)) * (w - 40) + 20;
      const val = pt[ch.key];
      const norm = (val - ch.min) / (ch.max - ch.min);
      const clamped = Math.max(0, Math.min(1, norm));
      const y = h - (clamped * (h - 40) + 20);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // Vertical anomaly incident line
  if (anomalyIdx >= 0 && anomalyIdx < n) {
    const anomX = (anomalyIdx / (n - 1)) * (w - 40) + 20;

    // Glowing alert stripe
    ctx.strokeStyle = logItem.severity === 'danger' ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(anomX, 10);
    ctx.lineTo(anomX, h - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Callout box on chart
    ctx.fillStyle = logItem.severity === 'danger' ? 'rgba(239, 68, 68, 0.85)' : 'rgba(245, 158, 11, 0.85)';
    ctx.fillRect(anomX - 60, 16, 120, 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(logItem.severity === 'danger' ? '⚡ CRITICAL SPIKE' : '⚠️ WARNING THRESHOLD', anomX, 32);

    const anomTag = document.getElementById('modal-chart-anomaly-tag');
    if (anomTag) {
      anomTag.style.display = 'inline-block';
      anomTag.textContent = `⚡ TRIGGER MET: ${data[anomalyIdx].time}s | G: ${data[anomalyIdx].gforce}G`;
    }
  } else {
    const anomTag = document.getElementById('modal-chart-anomaly-tag');
    if (anomTag) anomTag.textContent = 'NOMINAL FLIGHT PROFILE // ZERO EXCURSIONS';
  }
}

// Channel checkbox listeners inside modal
['pitch', 'roll', 'gforce', 'alt', 'temp', 'volt'].forEach(chKey => {
  const chk = document.getElementById(`chk-${chKey}`);
  chk?.addEventListener('change', (e) => {
    BlackBoxStore.activeChartChannels[chKey] = e.target.checked;
    if (BlackBoxStore.currentInspectorLog) {
      renderInspectorChart(BlackBoxStore.currentInspectorLog, BlackBoxStore.activeChartChannels);
    }
  });
});

// Render Raw Hex Monospace Dump inside Modal
function renderInspectorHex(logItem) {
  const pre = document.getElementById('modal-hex-pre');
  if (!pre) return;

  const hexLines = [];
  const baseOffset = logItem.storage === 'fram' ? 0x00A1F0 : 0x004F80;
  const isFram = logItem.storage === 'fram';

  for (let l = 0; l < 16; l++) {
    const offset = (baseOffset + l * 16).toString(16).toUpperCase().padStart(6, '0');
    const bytes = [];
    const ascii = [];

    for (let b = 0; b < 16; b++) {
      let byteVal;
      if (l === 0 && b === 0) byteVal = 0x7F;
      else if (l === 0 && b === 1) byteVal = 0xAA;
      else if (l === 0 && b === 2) byteVal = isFram ? 0x14 : 0x01;
      else if (l === 0 && b === 3) byteVal = isFram ? 0x88 : 0x22;
      else {
        byteVal = Math.floor(Math.sin(l * 16 + b) * 127 + 128);
      }
      bytes.push(byteVal.toString(16).toUpperCase().padStart(2, '0'));
      ascii.push(byteVal >= 32 && byteVal <= 126 ? String.fromCharCode(byteVal) : '.');
    }

    const byteStr = bytes.slice(0, 8).join(' ') + '  ' + bytes.slice(8).join(' ');
    const asciiStr = '|' + ascii.join('') + '|';
    hexLines.push(`0x${offset}: ${byteStr}  ${asciiStr}`);
  }

  pre.textContent = hexLines.join('\n');
}

// Copy Hex to Clipboard
document.getElementById('btn-copy-hex')?.addEventListener('click', () => {
  const pre = document.getElementById('modal-hex-pre');
  if (pre) {
    navigator.clipboard.writeText(pre.textContent).then(() => {
      const btn = document.getElementById('btn-copy-hex');
      if (btn) btn.textContent = '✓ Copied!';
      setTimeout(() => { if (btn) btn.textContent = '📋 Copy Raw Hex'; }, 2000);
    });
  }
});

// Render Avionics Diagnosis & Root Cause inside Modal
function renderInspectorDiagnosis(logItem) {
  const container = document.getElementById('modal-report-content');
  if (!container) return;

  const diag = logItem.diagnosis || {};
  const isDanger = logItem.severity === 'danger';
  const isWarning = logItem.severity === 'warning';

  container.innerHTML = `
    <div class="report-section">
      <h4>Executive Telemetry Summary</h4>
      <p>${diag.summary || logItem.synopsis}</p>
    </div>

    <div class="report-grid-two">
      <div class="report-section">
        <h4>Operational Flight Profile</h4>
        <p>${diag.flightProfile || 'Standard autonomous flight path executed within mission envelope parameters.'}</p>
      </div>
      <div class="report-section">
        <h4>Telemetry Root-Cause Analysis</h4>
        <p>${diag.rootCause || 'All sensor channels converged within standard EKF2 kalman filter thresholds.'}</p>
      </div>
    </div>

    <div class="report-alert-box ${isDanger ? '' : (isWarning ? 'warning' : 'nominal')}">
      <h4>${isDanger ? '🚨 CRITICAL ADVISORY // GROUND MAINTENANCE REQUIRED' : (isWarning ? '⚠️ SYSTEM ADVISORY // MONITOR METRICS' : '✅ FLIGHT READINESS // ALL SYSTEMS CLEAR')}</h4>
      <p>${diag.action || 'No maintenance intervention required. Systems cleared for standard flight operations.'}</p>
    </div>
  `;
}

// Interior Modal Tabs Switcher
function switchModalTab(tabId) {
  document.querySelectorAll('.m-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.modaltab === tabId);
  });
  document.querySelectorAll('.m-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane-modal-${tabId}`);
  });
  playCockpitBeep(980, 0.04, 'sine');
}

document.querySelectorAll('.m-tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    switchModalTab(e.currentTarget.dataset.modaltab);
  });
});

// Close Modal events
document.getElementById('btn-modal-close')?.addEventListener('click', closeBlackBoxInspector);
document.getElementById('btn-modal-close-bottom')?.addEventListener('click', closeBlackBoxInspector);
document.getElementById('inspector-modal-backdrop')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('inspector-modal-backdrop')) {
    closeBlackBoxInspector();
  }
});

// Replay this log in 3D Cockpit Deck
function replayLogInCockpit(logItem) {
  closeBlackBoxInspector();
  switchMasterTab('telemetry');

  // Populate FlightState replay log with this log's telemetry
  const telemetry = logItem._cachedTelemetry || generateLogTelemetryData(logItem);
  FlightState.replayLogData = telemetry.map(pt => ({
    t: pt.time,
    pitch: pt.pitch,
    roll: pt.roll,
    yaw: pt.yaw,
    alt: pt.alt,
    speed: pt.speed,
    gforce: pt.gforce || 1.0,
    m1Rpm: pt.m1Rpm || 14200,
    x: pt.x || 0,
    z: pt.z || 0,
    flag: pt.flag,
    statusClass: pt.statusClass
  }));

  // Set scrubber and play
  FlightState.isReplaying = true;
  FlightState.replayTime = logItem.anomalyIndex >= 0 ? telemetry[logItem.anomalyIndex].time : telemetry[0].time;
  if (logScrubber) {
    logScrubber.min = telemetry[0].time;
    logScrubber.max = telemetry[telemetry.length - 1].time;
    logScrubber.step = 0.05;
    logScrubber.value = FlightState.replayTime;
  }

  // Update total duration readout
  const durationRow = document.querySelector('.timeline-time-row span:last-child');
  if (durationRow && telemetry.length > 0) {
    const totalDuration = telemetry[telemetry.length - 1].time;
    const mins = Math.floor(totalDuration / 60).toString().padStart(2, '0');
    const secs = (totalDuration % 60).toFixed(1).padStart(4, '0');
    durationRow.textContent = `/ ${mins}:${secs}`;
  }

  // Update metadata code label
  const metaCode = document.querySelector('.log-file-meta code');
  if (metaCode) metaCode.textContent = logItem.name;

  if (playIcon) playIcon.textContent = '⏸';
  if (playLabel) playLabel.textContent = 'Pause';
  if (logStatus) {
    logStatus.textContent = 'REPLAYING';
    logStatus.className = 'log-indicator';
    logStatus.style.background = 'rgba(0, 240, 255, 0.2)';
    logStatus.style.color = '#38bdf8';
  }

  // Immediately apply initial frame so 3D drone snaps to the reading
  applyReplayFrame(FlightState.replayTime);

  playCockpitBeep(1200, 0.15, 'sine');
}

document.getElementById('btn-modal-replay-3d')?.addEventListener('click', () => {
  if (BlackBoxStore.currentInspectorLog) {
    replayLogInCockpit(BlackBoxStore.currentInspectorLog);
  }
});

// Export CSV for current inspected log
function exportDatasetCSV(logItem) {
  playCockpitBeep(1100, 0.12, 'sine');
  const rows = logItem._cachedTelemetry || generateLogTelemetryData(logItem);
  let csv = "Index,MET_s,Pitch_deg,Roll_deg,Yaw_deg,Altitude_m,Speed_kmh,GForce,Battery_V,Temp_C,Motor1_RPM,Status\n";
  rows.forEach(r => {
    csv += `${r.idx},${r.time},${r.pitch},${r.roll},${r.yaw},${r.alt},${r.speed},${r.gforce},${r.batt},${r.temp},${r.m1Rpm},${r.flag}\n`;
  });

  const uri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  const a = document.createElement('a');
  a.setAttribute('href', uri);
  a.setAttribute('download', `${logItem.name.replace('.BIN', '').replace('.CSV', '').replace('.DAT', '')}_TELEMETRY.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

document.getElementById('btn-modal-export-csv')?.addEventListener('click', () => {
  if (BlackBoxStore.currentInspectorLog) exportDatasetCSV(BlackBoxStore.currentInspectorLog);
});

// Export JSON for current inspected log
function exportDatasetJSON(logItem) {
  playCockpitBeep(1100, 0.12, 'sine');
  const rows = logItem._cachedTelemetry || generateLogTelemetryData(logItem);
  const exportPayload = {
    file: logItem.name,
    storageType: logItem.storage,
    severity: logItem.severity,
    timestamp: logItem.timestamp,
    crc: logItem.crc,
    hardwareAddress: logItem.address,
    synopsis: logItem.synopsis,
    diagnosis: logItem.diagnosis,
    telemetryPacketCount: rows.length,
    packets: rows
  };

  const uri = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', uri);
  a.setAttribute('download', `${logItem.name.replace('.BIN', '').replace('.CSV', '').replace('.DAT', '')}_ARCHIVE.json`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

document.getElementById('btn-modal-export-json')?.addEventListener('click', () => {
  if (BlackBoxStore.currentInspectorLog) exportDatasetJSON(BlackBoxStore.currentInspectorLog);
});

// 4. Master Navigation View Switching (3D Holo-Deck vs BlackBox Logger)
function switchMasterTab(tabName) {
  const paneTelemetry = document.getElementById('view-telemetry');
  const paneLogger = document.getElementById('view-logger');
  const btnTelemetry = document.getElementById('tab-btn-telemetry');
  const btnLogger = document.getElementById('tab-btn-logger');

  if (tabName === 'logger') {
    paneTelemetry?.classList.remove('active');
    paneLogger?.classList.add('active');
    btnTelemetry?.classList.remove('active');
    btnLogger?.classList.add('active');
    window.location.hash = 'logger';
    renderAllLogCards();
    playCockpitBeep(780, 0.08, 'sine');
  } else {
    paneLogger?.classList.remove('active');
    paneTelemetry?.classList.add('active');
    btnLogger?.classList.remove('active');
    btnTelemetry?.classList.add('active');
    window.location.hash = 'telemetry';
    // Re-trigger Three.js canvas resize
    onWindowResize();
    playCockpitBeep(880, 0.08, 'sine');
  }
}

// Master Tab Button click handlers
document.getElementById('tab-btn-telemetry')?.addEventListener('click', () => switchMasterTab('telemetry'));
document.getElementById('tab-btn-logger')?.addEventListener('click', () => switchMasterTab('logger'));
document.getElementById('btn-jump-to-logger')?.addEventListener('click', () => switchMasterTab('logger'));

// Keyboard navigation
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeBlackBoxInspector();
  } else if (e.key === '1' && e.target.tagName !== 'INPUT') {
    switchMasterTab('telemetry');
  } else if (e.key === '2' && e.target.tagName !== 'INPUT') {
    switchMasterTab('logger');
  }
});

// Check URL hash on page load
if (window.location.hash === '#logger') {
  setTimeout(() => switchMasterTab('logger'), 100);
}

// 5. Logger Toolbar Filters & Search
document.querySelectorAll('#log-filter-track .filter-tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('#log-filter-track .filter-tab-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    BlackBoxStore.activeFilter = e.currentTarget.dataset.filter;
    renderAllLogCards();
    playCockpitBeep(820, 0.04, 'sine');
  });
});

const logSearchInput = document.getElementById('log-search-input');
const btnClearSearch = document.getElementById('btn-clear-search');

logSearchInput?.addEventListener('input', (e) => {
  BlackBoxStore.searchQuery = e.target.value.trim();
  if (btnClearSearch) {
    btnClearSearch.style.display = BlackBoxStore.searchQuery ? 'block' : 'none';
  }
  renderAllLogCards();
});

btnClearSearch?.addEventListener('click', () => {
  if (logSearchInput) logSearchInput.value = '';
  BlackBoxStore.searchQuery = '';
  btnClearSearch.style.display = 'none';
  renderAllLogCards();
});

// View mode switcher: Split vs Grid
document.getElementById('btn-view-split')?.addEventListener('click', () => {
  document.getElementById('btn-view-split')?.classList.add('active');
  document.getElementById('btn-view-grid')?.classList.remove('active');
  const dir = document.getElementById('logger-directory-container');
  if (dir) dir.classList.remove('unified-grid');
  playCockpitBeep(750, 0.04, 'sine');
});

document.getElementById('btn-view-grid')?.addEventListener('click', () => {
  document.getElementById('btn-view-grid')?.classList.add('active');
  document.getElementById('btn-view-split')?.classList.remove('active');
  const dir = document.getElementById('logger-directory-container');
  if (dir) dir.classList.add('unified-grid');
  playCockpitBeep(750, 0.04, 'sine');
});

// 6. Live Hazard Simulation (Real-time FRAM flash)
document.getElementById('btn-simulate-hazard')?.addEventListener('click', () => {
  simulateLiveHazardIncident();
});

function simulateLiveHazardIncident() {
  // Synthesize realistic live hazard snapshot
  playCockpitBeep(440, 0.25, 'sawtooth');
  setTimeout(() => playCockpitBeep(880, 0.15, 'sawtooth'), 120);

  const randId = Math.floor(Math.random() * 899 + 100);
  const now = new Date();
  const timeStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]} UTC`;
  const peakGVal = parseFloat((Math.random() * 1.8 + 3.8).toFixed(2));

  const newHazard = {
    id: `fram_live_${randId}`,
    name: `FRAM_EVT_LIVE_0x${randId.toString(16).toUpperCase()}_G_SHOCK`,
    storage: 'fram',
    severity: 'danger',
    statusText: 'CRITICAL DANGER',
    trigger: `Real-Time Autonomous Shock Vector (+${peakGVal} G Peak Load)`,
    address: `0x00D${randId}0 - 0x00E${randId}0 (118 ns Flash)`,
    timestamp: `${timeStr} (LIVE TRIGGER)`,
    met: '00:18:44.2',
    duration: '3.6s Real-Time Freeze',
    durationSec: 3.6,
    records: 3600,
    odr: '1,000 Hz Burst',
    size: '52 KB Non-Volatile',
    crc: `CRC16: 0x${Math.floor(Math.random()*65535).toString(16).toUpperCase()} [VALID]`,
    synopsis: `Simulated live hazard event flashed directly to non-volatile ferroelectric RAM. Shock vector reached ${peakGVal}G.`,
    peakG: peakGVal,
    avgPitch: '+41.2°',
    avgRoll: '-38.4°',
    maxAlt: '26.8 m',
    avgSpeed: '59.4 km/h',
    batt: '15.02 V',
    temp: '46.2°C',
    anomalyIndex: 22,
    diagnosis: {
      summary: `Live test hazard simulation executed successfully. Zero-latency FRAM register lock confirmed under 118ns.`,
      flightProfile: 'Autonomous flight control system registered artificial inertial perturbation.',
      rootCause: `Manual simulation command sent from Command Cockpit Module 11 interface.`,
      action: 'FRAM non-volatile write verified intact. Register ready for post-flight inspection.'
    }
  };

  // Prepend to FRAM incidents
  BlackBoxStore.framLogs.unshift(newHazard);

  // Update FRAM usage
  const framUsageBar = document.getElementById('fram-usage-bar');
  const framUsageText = document.getElementById('fram-usage-text');
  const currentCount = BlackBoxStore.framLogs.length;
  const kb = currentCount * 64;
  if (framUsageBar) framUsageBar.style.width = `${((kb / 8192) * 100).toFixed(1)}%`;
  if (framUsageText) framUsageText.textContent = `${kb} KB / 8,192 KB (${((kb / 8192) * 100).toFixed(1)}%)`;

  renderAllLogCards();

  // Open inspector directly so the user immediately sees the newly generated danger data
  setTimeout(() => {
    openBlackBoxInspector(newHazard);
  }, 400);
}

// Export All Logs Button
document.getElementById('btn-export-all-logs')?.addEventListener('click', () => {
  playCockpitBeep(1100, 0.15, 'sine');
  const allLogs = {
    exportedAt: new Date().toISOString(),
    system: 'AERO // BLACKBOX V6.2',
    sdCardStorage: {
      capacity: '64 GB',
      available: '48.2 GB',
      filesystem: 'FAT32',
      sessions: BlackBoxStore.sdLogs
    },
    framStorage: {
      capacity: '8 MB',
      protocol: 'Octal-SPI Parallel 150ns',
      hazardIncidents: BlackBoxStore.framLogs
    }
  };

  const uri = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allLogs, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', uri);
  a.setAttribute('download', `AERO_BLACKBOX_FULL_ARCHIVE_${Date.now()}.json`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// Flush Temp Cache Button
document.getElementById('btn-flush-temp')?.addEventListener('click', () => {
  playCockpitBeep(620, 0.08, 'sine');
  alert('Temporary volatile cache flushed. Non-volatile FRAM registers and SD Card allocations re-indexed successfully.');
});

// Initial render of cards
renderAllLogCards();

// Bootstrap
window.addEventListener('load', () => {
  initThreeDDrone();
  requestAnimationFrame(masterDashboardLoop);
  console.log('🛸 AERO // QUANTUM Holo-Deck & BlackBox Logger V6.2 Online.');
});

