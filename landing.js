/**
 * AERO // LOGGER • Igloo-Style 3D Scrollytelling Motion Architecture
 * High-Precision Motion Graphics powered by Anime.js & Three.js WebGL Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // Ensure libraries are loaded
  if (typeof anime === 'undefined') {
    console.error('Anime.js not loaded');
  }
  if (typeof THREE === 'undefined') {
    console.error('Three.js not loaded');
    return;
  }

  // ==========================================================================
  // 1. Initial Hero Entrance Stagger (Anime.js)
  // ==========================================================================
  if (typeof anime !== 'undefined') {
    anime.timeline({ easing: 'easeOutExpo', duration: 1100 })
      .add({
        targets: ['.hero-badge', '.hero-title', '.hero-description', '.hero-motion-controls', '.hero-stats-row', '.scroll-cue-prompt'],
        opacity: [0, 1],
        translateY: [25, 0],
        delay: anime.stagger(100),
        duration: 900
      })
      .add({
        targets: '.orbital-ring.ring-outer',
        rotate: 360,
        duration: 34000,
        loop: true,
        easing: 'linear'
      }, 0)
      .add({
        targets: '.orbital-ring.ring-middle',
        rotate: -360,
        duration: 24000,
        loop: true,
        easing: 'linear'
      }, 0)
      .add({
        targets: '.orbital-ring.ring-inner',
        rotate: 360,
        duration: 16000,
        loop: true,
        easing: 'linear'
      }, 0);
  }

  // ==========================================================================
  // 2. Sensor Database & Specifications
  // ==========================================================================
  const SENSORS_DB = {
    imu: {
      name: 'ICM-42688P Dual 6-DOF IMU',
      category: 'INERTIAL DYNAMICS',
      chipLabel: 'ICM-42688P',
      rate: '1,000 Hz',
      status: 'CALIBRATED (EKF2)',
      val: 'X: +0.02g | Y: -0.01g | Z: 1.00g',
      protocol: 'SPI @ 24 MHz',
      bandwidth: '1000 Hz ODR',
      range: '±32g / ±4000°/s',
      shock: '20,000 G',
      desc: 'Primary 6-axis motion sensor capturing ultra-high frequency rotational velocities and linear accelerations across Pitch, Roll, and Yaw. Essential for high-rate maneuver analysis, vibration harmonics, and instantaneous impact shock vectors during crash investigations.',
      camOffset: { x: -1.2, y: 2.2, z: 2.8 },
      targetLook: { x: -1.2, y: 1.5, z: 0.8 }
    },
    baro: {
      name: 'BMP390 Precision Barometric Altimeter',
      category: 'ATMOSPHERIC PRESSURE',
      chipLabel: 'BMP390',
      rate: '200 Hz',
      status: 'SEALED & COMPENSATED',
      val: '1013.25 hPa | Alt: 24.8 m | VSI: +0.2 m/s',
      protocol: 'I2C / SPI',
      bandwidth: '200 Hz ODR',
      range: '300 to 1250 hPa (0.2m Res)',
      shock: '10,000 G',
      desc: 'High-accuracy MEMS pressure transducer measuring atmospheric pressure and temperature. Derives true barometric altitude, cabin pressurization rate, and vertical climb/sink velocity (VSI) without GPS satellite latency.',
      camOffset: { x: 1.2, y: 2.2, z: 2.8 },
      targetLook: { x: 1.2, y: 1.5, z: 0.8 }
    },
    mag: {
      name: 'RM3100 3-Axis Geomagnetic Compass',
      category: 'MAGNETIC HEADING',
      chipLabel: 'RM3100',
      rate: '150 Hz',
      status: 'INTERFERENCE REJECTED',
      val: 'Heading: 142° | Mag: 48.2 μT',
      protocol: 'SPI @ 1 MHz',
      bandwidth: '150 Hz ODR',
      range: '±800 μT (High Sensitivity)',
      shock: '10,000 G',
      desc: 'Magneto-inductive sensor eliminating gyro drift over extended flight envelopes. Measures the Earth’s 3D magnetic flux vectors to calculate absolute magnetic heading and feed the 15-state Kalman orientation filter.',
      camOffset: { x: -1.4, y: 2.2, z: 1.2 },
      targetLook: { x: -1.4, y: 1.5, z: -0.6 }
    },
    gnss: {
      name: 'u-blox ZED-F9P Multi-Band GNSS RTK',
      category: 'SATELLITE POSITIONING',
      chipLabel: 'ZED-F9P',
      rate: '25 Hz RTK',
      status: '3D FIX (28 SATS)',
      val: 'Lat: 37.7749° | Lon: -122.4194° | RTK-FIX',
      protocol: 'UART / USB / SPI',
      bandwidth: '25 Hz Navigation Rate',
      range: 'Concurrent 4-GNSS (1cm CEP)',
      shock: '5,000 G',
      desc: 'Multi-constellation global positioning receiver tracking GPS, GLONASS, Galileo, and BeiDou simultaneously. Provides centimeter-level RTK spatial positioning, ground speed vectors, and atomic UTC time synchronization.',
      camOffset: { x: 0.0, y: 2.3, z: 1.0 },
      targetLook: { x: 0.0, y: 1.5, z: -0.9 }
    },
    flash: {
      name: 'Micron 3D NAND Solid-State Flash (128GB)',
      category: 'CRASH-PROOF MEMORY',
      chipLabel: 'NAND-128G',
      rate: '480 MB/s',
      status: 'CONTINUOUS WRITE RING',
      val: 'Buffer: 99.8% | Write: 320 MB/s | CRC: PASS',
      protocol: 'QSPI / 8-Bit Parallel',
      bandwidth: '480 MB/s DMA Bus',
      range: '128 GB NVRAM Storage',
      shock: '50,000 G Survival',
      desc: 'High-density industrial-grade solid state storage array engineered for survivable flight data recording. Employs wear-leveling ring buffers and cryptographic hardware hashing to guarantee uncorrupted flight logs even in violent shock events.',
      camOffset: { x: 1.4, y: 2.2, z: 1.2 },
      targetLook: { x: 1.4, y: 1.5, z: -0.5 }
    },
    can: {
      name: 'TCAN334 High-Speed CAN-FD Transceiver',
      category: 'DIGITAL VEHICLE BUS',
      chipLabel: 'TCAN334',
      rate: '5 Mbps',
      status: 'BUS ACTIVE (0 ERRORS)',
      val: 'Packets: 12,450/s | Bus Load: 34%',
      protocol: 'ISO 11898-2:2016',
      bandwidth: 'Up to 5 Mbps CAN-FD',
      range: '±58V Fault Tolerant',
      shock: '25,000 G',
      desc: 'Automotive and aerospace CAN Flexible Data-Rate transceiver. Ingests high-bandwidth telemetry streams from electronic speed controllers (ESCs), motor RPM sensors, battery management systems (BMS), and autopilot actuators.',
      camOffset: { x: -0.6, y: 2.2, z: 2.8 },
      targetLook: { x: -0.6, y: 1.5, z: 0.9 }
    },
    mcu: {
      name: 'STM32H743 ARM Cortex-M7 Core (480 MHz)',
      category: 'REAL-TIME COMPUTE',
      chipLabel: 'STM32H7',
      rate: '480 MHz',
      status: '15-STATE EKF2 NOMINAL',
      val: 'CPU Load: 28% | DMA Channels: 12 Active',
      protocol: 'Internal AXI Bus Matrix',
      bandwidth: '2400 CoreMark Compute',
      range: '2MB Flash / 1MB SRAM',
      shock: '20,000 G',
      desc: 'The master intelligence hub of the flight data logger. Executes real-time sensor fusion, DMA packet routing, lossless flight log compression, and blackbox telemetry encryption at microsecond latency.',
      camOffset: { x: 0.0, y: 2.5, z: 2.5 },
      targetLook: { x: 0.0, y: 1.5, z: 0.1 }
    },
    supercap: {
      name: 'Emergency Ultracapacitor Power Reserve',
      category: 'POWER PROTECTION',
      chipLabel: 'SUPERCAP',
      rate: 'Instant Backup',
      status: '100% CHARGED (5.5V)',
      val: 'Voltage: 5.48V | Backup Hold: 5.2s',
      protocol: 'Power Rail Monitor',
      bandwidth: 'Zero-Switchover Latency',
      range: '5.5V @ 2.5F Capacitance',
      shock: '30,000 G',
      desc: 'Auxiliary energy reservoir ensuring non-volatile flash buffers complete writing and unmount cleanly during sudden power interruptions or mid-air main battery disconnection.',
      camOffset: { x: 0.7, y: 2.2, z: 2.8 },
      targetLook: { x: 0.7, y: 1.5, z: 0.8 }
    }
  };

  // ==========================================================================
  // 3. Three.js Full-Viewport Sticky 3D WebGL Engine
  // ==========================================================================
  let boxScene, boxCamera, boxRenderer;
  let mainAssembly, lidGroup, gasketGroup, pcbGroup, baseGroup;
  let internalCoreLight, ambientLight, keyLight, rimLight, hazardAlarmLight;
  let particlePoints;
  let sensorMeshes = {};
  
  // Scrollytelling physics state
  let targetScrollT = 0;
  let smoothScrollT = 0;
  let currentExplodeT = 0;
  let targetExplodeT = 0;
  let activeStageIndex = 0;
  let isUserInteractingSlider = false;
  let isAutoRotating = false;
  let isWireframe = false;
  let activeSensorKey = 'imu';

  // Manual 3D orbit dragging state
  let isDragging3D = false;
  let userOrbitActive = false;
  let prevMouse3D = { x: 0, y: 0 };
  let orbit3D = { theta: 0.85, phi: 0.58, radius: 11.2 };
  let baseScrollOrbit = { theta: 0.85, phi: 0.58, radius: 11.2 };
  let targetLookAt = new THREE.Vector3(1.2, 0.4, 0);
  let currentLookAt = new THREE.Vector3(1.2, 0.4, 0);

  // Stage camera choreography waypoints for smooth scrollytelling
  const STAGE_WAYPOINTS = [
    // Stage 0: Hero Overview (t ~ 0.0)
    { theta: 0.85, phi: 0.58, radius: 11.2, look: { x: 1.2, y: 0.4, z: 0 }, explode: 0.0 },
    // Stage 1: Chassis Exploded (t ~ 0.25)
    { theta: 0.52, phi: 0.42, radius: 10.0, look: { x: -1.1, y: 1.2, z: 0 }, explode: 0.85 },
    // Stage 2: Sensor Pipelines Close-Up (t ~ 0.50)
    { theta: 0.16, phi: 0.32, radius: 7.2, look: { x: 0.0, y: 1.8, z: 0.2 }, explode: 0.90 },
    // Stage 3: Dual-Bus Storage Vault (t ~ 0.75)
    { theta: 1.15, phi: 0.62, radius: 8.5, look: { x: 1.1, y: 1.4, z: -0.2 }, explode: 0.85 },
    // Stage 4: Cockpit Bridge Launch (t ~ 1.00)
    { theta: 1.57, phi: 0.38, radius: 11.8, look: { x: 0.0, y: 0.8, z: 0 }, explode: 0.30 }
  ];

  function initExplodedBox3D() {
    const canvas = document.getElementById('exploded-box-canvas');
    const loader = document.getElementById('box-loader');
    const canvasWrap = document.getElementById('sticky-3d-wrap');

    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene & Fog
    boxScene = new THREE.Scene();
    boxScene.fog = new THREE.FogExp2(0x04060a, 0.024);

    // Camera
    boxCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    updateBoxCamera();

    // WebGL Renderer
    boxRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    boxRenderer.setSize(width, height);
    boxRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    boxRenderer.shadowMap.enabled = true;
    boxRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    boxScene.add(ambientLight);

    keyLight = new THREE.DirectionalLight(0x00f0ff, 1.8);
    keyLight.position.set(10, 15, 10);
    keyLight.castShadow = true;
    boxScene.add(keyLight);

    rimLight = new THREE.DirectionalLight(0xec4899, 1.4);
    rimLight.position.set(-10, 8, -10);
    boxScene.add(rimLight);

    const bottomFillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    bottomFillLight.position.set(0, -10, 5);
    boxScene.add(bottomFillLight);

    // Internal Core Glow Light (flares open when box separates)
    internalCoreLight = new THREE.PointLight(0x00f0ff, 0.2, 14);
    internalCoreLight.position.set(0, 1.0, 0);
    boxScene.add(internalCoreLight);

    // Emergency Hazard Light (red pulse on 50,000G shock simulation)
    hazardAlarmLight = new THREE.PointLight(0xef4444, 0.0, 18);
    hazardAlarmLight.position.set(0, 2.5, 0);
    boxScene.add(hazardAlarmLight);

    // Floor Reflection Grid
    const grid = new THREE.GridHelper(30, 30, 0x00f0ff, 0x1e293b);
    grid.position.y = -2.8;
    boxScene.add(grid);

    // Drop Shadow Disk
    const shadowGeo = new THREE.CircleGeometry(4.2, 32);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 });
    const floorShadow = new THREE.Mesh(shadowGeo, shadowMat);
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = -2.78;
    boxScene.add(floorShadow);

    // Ambient Ethereal Cyber Particles Cloud
    createParticleCloud();

    // Assemble the Flight Data Logger 3D Model
    buildLoggerAssembly();

    // Hide loader
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.style.display = 'none', 600);
    }

    // Window Resize Handler
    window.addEventListener('resize', onWindowResize, { passive: true });

    // Orbit Drag & Pointer Events on Canvas
    canvas.addEventListener('pointerdown', (e) => {
      isDragging3D = true;
      userOrbitActive = true;
      prevMouse3D = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvasWrap?.classList.add('is-dragging');
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isDragging3D) return;
      const dx = e.clientX - prevMouse3D.x;
      const dy = e.clientY - prevMouse3D.y;
      prevMouse3D = { x: e.clientX, y: e.clientY };

      orbit3D.theta -= dx * 0.007;
      orbit3D.phi = Math.max(0.12, Math.min(Math.PI / 2 - 0.06, orbit3D.phi + dy * 0.007));
      updateBoxCamera();
    });

    canvas.addEventListener('pointerup', (e) => {
      isDragging3D = false;
      canvas.releasePointerCapture(e.pointerId);
      canvasWrap?.classList.remove('is-dragging');
    });

    canvas.addEventListener('wheel', (e) => {
      // Allow slight pinch/zoom with modifier or direct wheel without preventing page scroll
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        orbit3D.radius = Math.max(5.5, Math.min(22, orbit3D.radius + e.deltaY * 0.015));
        updateBoxCamera();
      }
    }, { passive: false });

    // Raycast Click on 3D Sensor Modules
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    canvas.addEventListener('click', (e) => {
      mouseVector.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseVector.y = -(e.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouseVector, boxCamera);
      const intersects = raycaster.intersectObjects(Object.values(sensorMeshes), true);

      if (intersects.length > 0) {
        let hit = intersects[0].object;
        while (hit && !hit.userData.sensorKey && hit.parent) {
          hit = hit.parent;
        }
        if (hit && hit.userData.sensorKey) {
          selectSensor(hit.userData.sensorKey);
        }
      }
    });

    // Start 3D Render Loop
    requestAnimationFrame(renderBoxLoop);
  }

  function onWindowResize() {
    if (!boxCamera || !boxRenderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    boxCamera.aspect = w / h;
    boxCamera.updateProjectionMatrix();
    boxRenderer.setSize(w, h);
  }

  function createParticleCloud() {
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 24;
      positions[i + 1] = (Math.random() - 0.2) * 14;
      positions[i + 2] = (Math.random() - 0.5) * 24;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.12,
      transparent: true,
      opacity: 0.45
    });

    particlePoints = new THREE.Points(particleGeo, particleMat);
    boxScene.add(particlePoints);
  }

  function buildLoggerAssembly() {
    mainAssembly = new THREE.Group();

    // Materials
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.25
    });

    const brushedAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.35
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2
    });

    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      metalness: 0.4,
      roughness: 0.6
    });

    const gasketMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.8,
      metalness: 0.1
    });

    // 1. BASE CHASSIS (Bottom Tub)
    baseGroup = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(5.6, 1.2, 4.4);
    const baseMesh = new THREE.Mesh(baseGeo, brushedAlloyMat);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    baseGroup.add(baseMesh);

    // 4 Corner Shock Mounts
    const cornerPositions = [
      { x: 2.6, z: 2.0 }, { x: -2.6, z: 2.0 },
      { x: 2.6, z: -2.0 }, { x: -2.6, z: -2.0 }
    ];

    cornerPositions.forEach(pos => {
      const damperGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.5, 16);
      const damper = new THREE.Mesh(damperGeo, gasketMat);
      damper.position.set(pos.x, -0.65, pos.z);
      baseGroup.add(damper);

      const footGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.15, 16);
      const foot = new THREE.Mesh(footGeo, titaniumMat);
      foot.position.set(pos.x, -0.85, pos.z);
      baseGroup.add(foot);
    });

    // Connector Header Block with Gold Pins
    const connGeo = new THREE.BoxGeometry(2.4, 0.45, 0.35);
    const conn = new THREE.Mesh(connGeo, new THREE.MeshStandardMaterial({ color: 0x111827 }));
    conn.position.set(0, 0, 2.25);
    baseGroup.add(conn);

    for (let p = -1.0; p <= 1.0; p += 0.22) {
      const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8);
      const pin = new THREE.Mesh(pinGeo, goldMat);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(p, 0, 2.45);
      baseGroup.add(pin);
    }

    mainAssembly.add(baseGroup);

    // 2. AVIONICS SENSOR PCB (Multi-Layer Board)
    pcbGroup = new THREE.Group();
    pcbGroup.position.y = 0.65;

    const pcbGeo = new THREE.BoxGeometry(5.1, 0.12, 3.9);
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.receiveShadow = true;
    pcbGroup.add(pcbMesh);

    const borderGeo = new THREE.BoxGeometry(5.15, 0.02, 3.95);
    const borderMesh = new THREE.Mesh(borderGeo, goldMat);
    borderMesh.position.y = 0.06;
    pcbGroup.add(borderMesh);

    // MOUNTED SENSORS ON PCB
    // A. Dual 6-DOF IMU
    const imuGroup = new THREE.Group();
    imuGroup.position.set(-1.2, 0.12, 0.8);
    const imuBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 }));
    imuGroup.add(imuBody);
    const xArrow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    xArrow.position.set(0.18, 0.11, 0);
    const yArrow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
    yArrow.position.set(0, 0.24, 0);
    const zArrow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.35), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    zArrow.position.set(0, 0.11, 0.18);
    imuGroup.add(xArrow, yArrow, zArrow);
    imuGroup.userData.sensorKey = 'imu';
    sensorMeshes['imu'] = imuGroup;
    pcbGroup.add(imuGroup);

    // B. Barometric Pressure Altimeter (BMP390)
    const baroGroup = new THREE.Group();
    baroGroup.position.set(1.2, 0.14, 0.8);
    const baroCan = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 20), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.95, roughness: 0.2 }));
    baroGroup.add(baroCan);
    const baroHole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 12), new THREE.MeshBasicMaterial({ color: 0x04060a }));
    baroGroup.add(baroHole);
    baroGroup.userData.sensorKey = 'baro';
    sensorMeshes['baro'] = baroGroup;
    pcbGroup.add(baroGroup);

    // C. 3-Axis Magnetometer (RM3100)
    const magGroup = new THREE.Group();
    magGroup.position.set(-1.4, 0.12, -0.6);
    const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.65), new THREE.MeshStandardMaterial({ color: 0x1e1e24, metalness: 0.7 }));
    magGroup.add(magBody);
    const magRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 16), new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 0.5 }));
    magRing.rotation.x = Math.PI / 2;
    magRing.position.y = 0.12;
    magGroup.add(magRing);
    magGroup.userData.sensorKey = 'mag';
    sensorMeshes['mag'] = magGroup;
    pcbGroup.add(magGroup);

    // D. Multi-GNSS RTK Module (ZED-F9P)
    const gnssGroup = new THREE.Group();
    gnssGroup.position.set(0.0, 0.14, -0.9);
    const gnssShield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 1.2), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.15 }));
    gnssGroup.add(gnssShield);
    const gnssPort = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12), goldMat);
    gnssPort.position.set(0.6, 0.18, 0.35);
    gnssGroup.add(gnssPort);
    gnssGroup.userData.sensorKey = 'gnss';
    sensorMeshes['gnss'] = gnssGroup;
    pcbGroup.add(gnssGroup);

    // E. 3D NAND Solid-State Flash (128GB)
    const flashGroup = new THREE.Group();
    flashGroup.position.set(1.4, 0.12, -0.5);
    const flashBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.9), new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.85, roughness: 0.3 }));
    flashGroup.add(flashBody);
    for (let f = -0.5; f <= 0.5; f += 0.2) {
      const pinL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.12), goldMat);
      pinL.position.set(f, 0, 0.48);
      const pinR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.12), goldMat);
      pinR.position.set(f, 0, -0.48);
      flashGroup.add(pinL, pinR);
    }
    flashGroup.userData.sensorKey = 'flash';
    sensorMeshes['flash'] = flashGroup;
    pcbGroup.add(flashGroup);

    // F. CAN-FD Transceiver (TCAN334)
    const canGroup = new THREE.Group();
    canGroup.position.set(-0.6, 0.1, 0.9);
    const canBody = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.35), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 }));
    canGroup.add(canBody);
    canGroup.userData.sensorKey = 'can';
    sensorMeshes['can'] = canGroup;
    pcbGroup.add(canGroup);

    // G. ARM Cortex-M7 Core MCU (STM32H7 480MHz)
    const mcuGroup = new THREE.Group();
    mcuGroup.position.set(0.0, 0.12, 0.1);
    const mcuBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 1.1), new THREE.MeshStandardMaterial({ color: 0x0b0f19, metalness: 0.9, roughness: 0.3 }));
    mcuGroup.add(mcuBody);
    const mcuCoreBadge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.4 }));
    mcuCoreBadge.position.y = 0.08;
    mcuGroup.add(mcuCoreBadge);
    mcuGroup.userData.sensorKey = 'mcu';
    sensorMeshes['mcu'] = mcuGroup;
    pcbGroup.add(mcuGroup);

    // H. Supercapacitor Emergency Backup
    const capGroup = new THREE.Group();
    capGroup.position.set(0.7, 0.22, 0.8);
    const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.7 }));
    cap1.position.x = -0.22;
    const cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.7 }));
    cap2.position.x = 0.22;
    capGroup.add(cap1, cap2);
    capGroup.userData.sensorKey = 'supercap';
    sensorMeshes['supercap'] = capGroup;
    pcbGroup.add(capGroup);

    mainAssembly.add(pcbGroup);

    // 3. SILICONE EMI / DUST SEAL GASKET
    gasketGroup = new THREE.Group();
    gasketGroup.position.y = 0.75;
    const gasketFrameGeo = new THREE.BoxGeometry(5.45, 0.1, 4.25);
    const gasketMesh = new THREE.Mesh(gasketFrameGeo, gasketMat);
    gasketGroup.add(gasketMesh);
    mainAssembly.add(gasketGroup);

    // 4. TOP TITANIUM LID (Protective Shell)
    lidGroup = new THREE.Group();
    lidGroup.position.y = 0.95;

    const lidGeo = new THREE.BoxGeometry(5.6, 0.45, 4.4);
    const lidMesh = new THREE.Mesh(lidGeo, titaniumMat);
    lidMesh.castShadow = true;
    lidGroup.add(lidMesh);

    // Cooling Fins
    for (let f = -1.8; f <= 1.8; f += 0.6) {
      const finGeo = new THREE.BoxGeometry(0.12, 0.28, 3.2);
      const fin = new THREE.Mesh(finGeo, brushedAlloyMat);
      fin.position.set(f, 0.32, 0);
      lidGroup.add(fin);
    }

    // 4 Corner Screws
    cornerPositions.forEach(pos => {
      const screwGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 6);
      const screw = new THREE.Mesh(screwGeo, goldMat);
      screw.position.set(pos.x * 0.92, 0.25, pos.z * 0.92);
      lidGroup.add(screw);
    });

    // Branding Stencil Plaque
    const plateGeo = new THREE.BoxGeometry(2.4, 0.04, 0.9);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.35,
      metalness: 0.9
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.24, -1.2);
    lidGroup.add(plate);

    mainAssembly.add(lidGroup);
    boxScene.add(mainAssembly);
  }

  function updateBoxCamera() {
    if (!boxCamera) return;
    const r = orbit3D.radius;
    const phi = orbit3D.phi;
    const theta = orbit3D.theta;

    boxCamera.position.x = targetLookAt.x + r * Math.sin(phi) * Math.sin(theta);
    boxCamera.position.y = targetLookAt.y + r * Math.cos(phi);
    boxCamera.position.z = targetLookAt.z + r * Math.sin(phi) * Math.cos(theta);

    currentLookAt.lerp(targetLookAt, 0.1);
    boxCamera.lookAt(currentLookAt);

    // Update Telemetry Ticker HUD
    const tickerCoords = document.getElementById('ticker-coords');
    if (tickerCoords) {
      tickerCoords.textContent = `ORBIT: ${theta.toFixed(2)} • ${phi.toFixed(2)} • ${r.toFixed(1)}x`;
    }
  }

  function setExplodeProgress(t) {
    t = Math.max(0, Math.min(1, t));
    currentExplodeT = t;

    if (lidGroup) {
      lidGroup.position.y = 0.95 + t * 4.6;
      lidGroup.rotation.x = t * 0.16;
    }
    if (gasketGroup) {
      gasketGroup.position.y = 0.75 + t * 3.1;
    }
    if (pcbGroup) {
      pcbGroup.position.y = 0.65 + t * 1.6;
    }
    if (baseGroup) {
      baseGroup.position.y = -t * 0.9;
    }

    if (internalCoreLight) {
      internalCoreLight.intensity = 0.2 + t * 2.8;
      internalCoreLight.position.y = 1.0 + t * 1.5;
    }

    // Sync Slider
    const slider = document.getElementById('slider-explode');
    if (slider && !isUserInteractingSlider) {
      slider.value = t * 100;
    }

    const pctLabel = document.getElementById('explode-percent-label');
    if (pctLabel) {
      const pct = Math.round(t * 100);
      pctLabel.textContent = `${pct}% (${pct === 0 ? 'Box Closed' : (pct === 100 ? 'Full Explosion' : 'Separating')})`;
    }

    const statusPill = document.getElementById('box-status-pill');
    if (statusPill) {
      const pct = Math.round(t * 100);
      statusPill.textContent = pct === 0 ? 'BOX: SEALED (0%)' : `BOX: EXPLODED (${pct}%)`;
      statusPill.style.color = pct > 0 ? 'var(--hud-cyan)' : 'var(--hud-emerald)';
    }

    // Anchor pill highlights
    document.querySelectorAll('.anchor-point').forEach(anchor => {
      const anchorVal = parseFloat(anchor.dataset.val);
      const isNear = Math.abs(t * 100 - anchorVal) < 18;
      anchor.classList.toggle('active', isNear);
    });
  }

  // ==========================================================================
  // 4. Igloo-Style Scrollytelling Engine with Physics Lerping
  // ==========================================================================
  const stages = [
    document.getElementById('hero-stage'),
    document.getElementById('stage-chassis'),
    document.getElementById('stage-sensors'),
    document.getElementById('stage-memory'),
    document.getElementById('stage-cockpit')
  ];

  const STAGE_TITLES = [
    'STAGE 00 // QUANTUM LOGGER CORE',
    'STAGE 01 // MODULAR CHASSIS & SENSORS',
    'STAGE 02 // 1,000 HZ DMA SENSOR PIPELINES',
    'STAGE 03 // DUAL-BUS STORAGE (SD & FRAM)',
    'STAGE 04 // LIVE HOLO-DECK COCKPIT'
  ];

  function onScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    targetScrollT = Math.min(1, Math.max(0, scrollTop / maxScroll));
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function updateScrollytelling(dt) {
    // Smooth lerp scroll progress for silk-like fluidity
    smoothScrollT += (targetScrollT - smoothScrollT) * 0.085;

    // Determine active stage (0 to 4)
    const stageFloat = smoothScrollT * 4;
    const currIdx = Math.min(4, Math.floor(stageFloat));
    const nextIdx = Math.min(4, currIdx + 1);
    const stageBlend = stageFloat - currIdx;

    activeStageIndex = Math.min(4, Math.round(stageFloat));

    // Update bottom scrubber track & pct label
    const trackFill = document.getElementById('timeline-track-fill');
    const pctLabel = document.getElementById('timeline-pct-label');
    const hudFill = document.getElementById('hud-scroll-fill');
    const hudPct = document.getElementById('hud-scroll-pct');
    const stageNameEl = document.getElementById('timeline-stage-name');

    const pctVal = Math.round(smoothScrollT * 100);
    if (trackFill) trackFill.style.width = `${pctVal}%`;
    if (pctLabel) pctLabel.textContent = `${pctVal}%`;
    if (hudFill) hudFill.style.height = `${pctVal}%`;
    if (hudPct) hudPct.textContent = `${pctVal}%`;
    if (stageNameEl && STAGE_TITLES[activeStageIndex]) {
      stageNameEl.textContent = STAGE_TITLES[activeStageIndex];
    }

    // Update active chapter button
    document.querySelectorAll('.t-chapter').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === activeStageIndex);
    });

    document.querySelectorAll('.stage-dot').forEach((dot, idx) => {
      dot.classList.toggle('active', idx === activeStageIndex);
    });

    // Interpolate camera waypoint if not actively dragging
    if (!isDragging3D && !userOrbitActive) {
      const w1 = STAGE_WAYPOINTS[currIdx];
      const w2 = STAGE_WAYPOINTS[nextIdx];

      // Smoothstep easing for stage transitions
      const tSmooth = stageBlend * stageBlend * (3 - 2 * stageBlend);

      orbit3D.theta = THREE.MathUtils.lerp(w1.theta, w2.theta, tSmooth);
      orbit3D.phi = THREE.MathUtils.lerp(w1.phi, w2.phi, tSmooth);
      orbit3D.radius = THREE.MathUtils.lerp(w1.radius, w2.radius, tSmooth);

      targetLookAt.x = THREE.MathUtils.lerp(w1.look.x, w2.look.x, tSmooth);
      targetLookAt.y = THREE.MathUtils.lerp(w1.look.y, w2.look.y, tSmooth);
      targetLookAt.z = THREE.MathUtils.lerp(w1.look.z, w2.look.z, tSmooth);

      // Interpolate chassis explode depth
      if (!isUserInteractingSlider) {
        const targetExplode = THREE.MathUtils.lerp(w1.explode, w2.explode, tSmooth);
        setExplodeProgress(targetExplode);
      }
    }
  }

  // ==========================================================================
  // 5. Sensor Selection & Focus Logic
  // ==========================================================================
  function selectSensor(key) {
    const data = SENSORS_DB[key];
    if (!data) return;

    activeSensorKey = key;

    // Highlight chip button
    document.querySelectorAll('.sensor-chip-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sensor === key);
    });

    // Update text elements
    const nameEl = document.getElementById('inspector-sensor-name');
    const catEl = document.getElementById('inspector-sensor-category');
    const labelEl = document.getElementById('microchip-label');
    const rateEl = document.getElementById('live-rate');
    const statusEl = document.getElementById('live-status');
    const valEl = document.getElementById('live-val');
    const descEl = document.getElementById('dossier-description-text');
    const protoEl = document.getElementById('spec-protocol');
    const bandEl = document.getElementById('spec-bandwidth');
    const rangeEl = document.getElementById('spec-range');
    const shockEl = document.getElementById('spec-shock');

    if (nameEl) nameEl.textContent = data.name;
    if (catEl) catEl.textContent = data.category;
    if (labelEl) labelEl.textContent = data.chipLabel;
    if (rateEl) rateEl.textContent = data.rate;
    if (statusEl) statusEl.textContent = data.status;
    if (valEl) valEl.textContent = data.val;
    if (descEl) descEl.textContent = data.desc;
    if (protoEl) protoEl.textContent = data.protocol;
    if (bandEl) bandEl.textContent = data.bandwidth;
    if (rangeEl) rangeEl.textContent = data.range;
    if (shockEl) shockEl.textContent = data.shock;

    // Pulse microchip visual
    const visual = document.querySelector('.microchip-visual');
    if (visual && typeof anime !== 'undefined') {
      anime({ targets: visual, scale: [0.9, 1], duration: 400, easing: 'easeOutBack' });
    }

    // Highlight 3D sensor mesh
    Object.keys(sensorMeshes).forEach(k => {
      const mesh = sensorMeshes[k];
      if (!mesh) return;
      mesh.traverse(child => {
        if (child.isMesh && child.material) {
          if (child.material.emissive && typeof child.material.emissive.setHex === 'function') {
            if (k === key) {
              child.material.emissive.setHex(0x00f0ff);
              child.material.emissiveIntensity = 0.85;
            } else {
              child.material.emissive.setHex(0x000000);
              child.material.emissiveIntensity = 0.0;
            }
          }
        }
      });
    });

    // Ensure box is opened enough so sensor is visible
    if (currentExplodeT < 0.6) {
      animateExplodeTo(0.85);
    }
  }

  function focusSensorIn3D(key) {
    const data = SENSORS_DB[key];
    if (!data || !boxCamera) return;

    userOrbitActive = true;
    targetLookAt.set(data.targetLook.x, data.targetLook.y + (currentExplodeT * 1.6), data.targetLook.z);
    orbit3D.radius = 7.2;
    orbit3D.theta = Math.atan2(data.camOffset.x, data.camOffset.z);
    orbit3D.phi = 0.42;
  }

  function animateExplodeTo(target) {
    if (typeof anime !== 'undefined') {
      anime({
        targets: { val: currentExplodeT },
        val: target,
        duration: 800,
        easing: 'easeOutCubic',
        update: function(anim) {
          setExplodeProgress(anim.animations[0].currentValue);
        }
      });
    } else {
      setExplodeProgress(target);
    }
  }

  // ==========================================================================
  // 6. Interactive Controls & Buttons
  // ==========================================================================
  // Sensor selector chips
  document.querySelectorAll('.sensor-chip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectSensor(e.currentTarget.dataset.sensor);
    });
  });

  document.getElementById('btn-focus-in-3d')?.addEventListener('click', () => {
    focusSensorIn3D(activeSensorKey);
  });

  // Explode slider
  const slider = document.getElementById('slider-explode');
  slider?.addEventListener('input', (e) => {
    isUserInteractingSlider = true;
    const t = parseFloat(e.target.value) / 100;
    setExplodeProgress(t);
  });
  slider?.addEventListener('change', () => {
    isUserInteractingSlider = false;
  });

  document.querySelectorAll('.anchor-point').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const val = parseFloat(e.currentTarget.dataset.val) / 100;
      animateExplodeTo(val);
    });
  });

  document.getElementById('btn-quick-open')?.addEventListener('click', () => animateExplodeTo(1.0));
  document.getElementById('btn-quick-close')?.addEventListener('click', () => animateExplodeTo(0.0));

  // Camera Presets
  document.getElementById('btn-cam-persp')?.addEventListener('click', (e) => {
    setActiveCamBtn(e.currentTarget);
    userOrbitActive = false;
    orbit3D = { theta: 0.85, phi: 0.58, radius: 11.2 };
    targetLookAt.set(0, 0.8, 0);
  });

  document.getElementById('btn-cam-top')?.addEventListener('click', (e) => {
    setActiveCamBtn(e.currentTarget);
    userOrbitActive = true;
    orbit3D = { theta: 0.001, phi: 0.05, radius: 10.0 };
    targetLookAt.set(0, 1.2, 0);
    if (currentExplodeT < 0.6) animateExplodeTo(0.85);
  });

  document.getElementById('btn-cam-side')?.addEventListener('click', (e) => {
    setActiveCamBtn(e.currentTarget);
    userOrbitActive = true;
    orbit3D = { theta: Math.PI / 2, phi: 0.78, radius: 11.0 };
    targetLookAt.set(0, 1.2, 0);
    if (currentExplodeT < 0.4) animateExplodeTo(0.9);
  });

  document.getElementById('btn-toggle-wireframe')?.addEventListener('click', (e) => {
    isWireframe = !isWireframe;
    e.currentTarget.classList.toggle('active', isWireframe);
    [lidGroup, baseGroup].forEach(grp => {
      grp?.traverse(child => {
        if (child.isMesh) child.material.wireframe = isWireframe;
      });
    });
  });

  document.getElementById('btn-toggle-autorotate')?.addEventListener('click', (e) => {
    isAutoRotating = !isAutoRotating;
    e.currentTarget.classList.toggle('active', isAutoRotating);
  });

  function setActiveCamBtn(btn) {
    document.querySelectorAll('.v-cam-btn').forEach(b => {
      if (b.id !== 'btn-toggle-wireframe' && b.id !== 'btn-toggle-autorotate') {
        b.classList.remove('active');
      }
    });
    btn.classList.add('active');
  }

  // Hero Kinetic Action Buttons
  document.getElementById('btn-anim-pulse')?.addEventListener('click', (e) => {
    setActiveTriggerBtn(e.currentTarget);
    if (internalCoreLight) {
      if (typeof anime !== 'undefined') {
        anime({
          targets: internalCoreLight,
          intensity: [0.2, 4.0, 0.8],
          duration: 900,
          easing: 'easeOutQuad'
        });
      }
    }
  });

  let heroExploded = false;
  document.getElementById('btn-anim-explode')?.addEventListener('click', (e) => {
    setActiveTriggerBtn(e.currentTarget);
    heroExploded = !heroExploded;
    animateExplodeTo(heroExploded ? 0.9 : 0.0);
  });

  document.getElementById('btn-anim-stream')?.addEventListener('click', (e) => {
    setActiveTriggerBtn(e.currentTarget);
    const sampleEl = document.getElementById('stat-sample-rate');
    if (sampleEl && typeof anime !== 'undefined') {
      anime({
        targets: { val: 1000 },
        val: 2400,
        round: 1,
        duration: 900,
        easing: 'easeInOutExpo',
        update: anim => sampleEl.textContent = Math.round(anim.animations[0].currentValue).toLocaleString(),
        complete: () => {
          anime({
            targets: { val: 2400 },
            val: 1000,
            round: 1,
            duration: 700,
            easing: 'easeOutQuad',
            update: anim => sampleEl.textContent = Math.round(anim.animations[0].currentValue).toLocaleString()
          });
        }
      });
    }
  });

  document.getElementById('btn-anim-reset')?.addEventListener('click', (e) => {
    setActiveTriggerBtn(e.currentTarget);
    heroExploded = false;
    userOrbitActive = false;
    animateExplodeTo(0.0);
    orbit3D = { theta: 0.85, phi: 0.58, radius: 11.2 };
    targetLookAt.set(1.2, 0.4, 0);
  });

  function setActiveTriggerBtn(btn) {
    document.querySelectorAll('.trigger-btn').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
  }

  // ==========================================================================
  // 7. Bottom Timeline Chapter Jumping & Scrubbing
  // ==========================================================================
  document.querySelectorAll('.t-chapter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const stageIdx = parseInt(e.currentTarget.dataset.stage, 10);
      const stageEl = stages[stageIdx];
      if (stageEl) {
        userOrbitActive = false;
        stageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Keyboard navigation (Arrow Up / Down)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      const nextIdx = Math.min(4, activeStageIndex + 1);
      stages[nextIdx]?.scrollIntoView({ behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      const prevIdx = Math.max(0, activeStageIndex - 1);
      stages[prevIdx]?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // ==========================================================================
  // 8. Stage 02: Dynamic 1000Hz Waveform Oscilloscope Canvas
  // ==========================================================================
  const oscCanvas = document.getElementById('pipeline-waveform-canvas');
  let oscCtx = oscCanvas ? oscCanvas.getContext('2d') : null;
  let oscTime = 0;
  let harmonicNoise = 0;
  let shockManeuverAmp = 0;

  function renderOscilloscope() {
    if (!oscCtx || !oscCanvas) return;

    const w = oscCanvas.width;
    const h = oscCanvas.height;
    oscCtx.clearRect(0, 0, w, h);

    // Draw Subtle Grid Lines
    oscCtx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    oscCtx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      oscCtx.beginPath();
      oscCtx.moveTo(x, 0);
      oscCtx.lineTo(x, h);
      oscCtx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      oscCtx.beginPath();
      oscCtx.moveTo(0, y);
      oscCtx.lineTo(w, y);
      oscCtx.stroke();
    }

    // Baseline horizontal line
    oscCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    oscCtx.beginPath();
    oscCtx.moveTo(0, h / 2);
    oscCtx.lineTo(w, h / 2);
    oscCtx.stroke();

    oscTime += 0.04;
    harmonicNoise *= 0.98; // decay harmonic vibration
    shockManeuverAmp *= 0.97; // decay shock impulse

    // Channel X (Roll) - Cyan
    oscCtx.strokeStyle = '#00f0ff';
    oscCtx.lineWidth = 2;
    oscCtx.beginPath();
    for (let x = 0; x < w; x++) {
      const t = oscTime + x * 0.03;
      const y = h / 2 + Math.sin(t * 1.8) * 18 + Math.cos(t * 4.2) * 6 + (Math.sin(t * 24.0) * harmonicNoise * 22);
      if (x === 0) oscCtx.moveTo(x, y);
      else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();

    // Channel Y (Pitch) - Magenta
    oscCtx.strokeStyle = '#ec4899';
    oscCtx.lineWidth = 2;
    oscCtx.beginPath();
    for (let x = 0; x < w; x++) {
      const t = oscTime + x * 0.025;
      const y = h / 2 + Math.cos(t * 1.4) * 22 + Math.sin(t * 3.6) * 8 + (Math.sin(t * 18.0) * harmonicNoise * 18) - (shockManeuverAmp * 35);
      if (x === 0) oscCtx.moveTo(x, y);
      else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();

    // Channel Z (Yaw) - Green
    oscCtx.strokeStyle = '#10b981';
    oscCtx.lineWidth = 1.8;
    oscCtx.beginPath();
    for (let x = 0; x < w; x++) {
      const t = oscTime + x * 0.02;
      const y = h / 2 + Math.sin(t * 0.9) * 14 + Math.cos(t * 2.8) * 5 + (shockManeuverAmp * 20);
      if (x === 0) oscCtx.moveTo(x, y);
      else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();
  }

  document.getElementById('btn-inject-harmonic')?.addEventListener('click', () => {
    harmonicNoise = 1.0;
  });

  document.getElementById('btn-simulate-shock')?.addEventListener('click', () => {
    shockManeuverAmp = 1.0;
  });

  document.getElementById('btn-reset-pipeline')?.addEventListener('click', () => {
    harmonicNoise = 0;
    shockManeuverAmp = 0;
  });

  // ==========================================================================
  // 9. Stage 03: Interactive 50,000G Crash Hazard Shock Event Simulator
  // ==========================================================================
  let framIncidentCount = 6;
  const framBadge = document.getElementById('fram-badge-counter');

  document.getElementById('btn-simulate-fram-shock')?.addEventListener('click', () => {
    framIncidentCount++;
    if (framBadge) {
      framBadge.textContent = `${framIncidentCount} DANGER & WARNING ⚠️`;
      framBadge.classList.add('amber');
    }

    // Flash emergency red hazard light in 3D scene
    if (hazardAlarmLight) {
      hazardAlarmLight.intensity = 8.0;
      if (typeof anime !== 'undefined') {
        anime({
          targets: hazardAlarmLight,
          intensity: [8.0, 0.0],
          duration: 1200,
          easing: 'easeOutQuad'
        });
      }
    }

    // Visual button feedback
    const btn = document.getElementById('btn-simulate-fram-shock');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>⚡ 50,000G CAPTURED! FROZEN IN 142ns (FRAM BLOCK 0x08F2)</span>';
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 2500);
    }
  });

  // ==========================================================================
  // 10. Main 3D Render Loop & Animation Step
  // ==========================================================================
  function renderBoxLoop() {
    updateScrollytelling();

    if (isAutoRotating && !isDragging3D) {
      orbit3D.theta += 0.005;
    }

    // Particle drift
    if (particlePoints) {
      particlePoints.rotation.y += 0.0006;
    }

    updateBoxCamera();

    if (boxRenderer && boxScene && boxCamera) {
      boxRenderer.render(boxScene, boxCamera);
    }

    renderOscilloscope();

    requestAnimationFrame(renderBoxLoop);
  }

  // Initialize
  initExplodedBox3D();
  selectSensor('imu');
});
