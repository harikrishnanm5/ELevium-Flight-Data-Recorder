/**
 * AERO // FLOW • Real-Time Telemetry Data Flow Architecture
 * Routes Normal flight data packets to MicroSD Card (FAT32)
 * Diverts Critical Danger incidents to Ferroelectric FRAM (150ns Non-Volatile)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 1. STATE MANAGEMENT
  // ==========================================================================
  const FlowState = {
    totalPackets: 0,
    sdPackets: 0,
    framPackets: 0,
    
    // Auto-stream settings
    streamingActive: true,
    streamRateHz: 2, // 1, 2, 5, 10 Hz
    dangerProbability: 20, // 0 - 100%
    flowSpeedMultiplier: 1.0, // 0.4 - 2.5
    
    // Audio
    soundEnabled: true,
    
    // Audit log
    auditLogs: [],
    auditFilter: 'all', // 'all', 'normal', 'danger'
    
    // Stream timer
    streamTimerId: null,
    
    // MET Clock (Mission Elapsed Time)
    metSeconds: 1184.2,
    
    // Active custom status selection
    customStatus: 'NORMAL'
  };

  // Danger Scenarios Preset Definitions
  const DangerScenarios = {
    high_g: {
      name: 'High-G Impact Shock',
      gforce: 7.82,
      temp: 46.2,
      volt: 15.2,
      reason: 'G-Force exceeded 3.5G threshold (Peak 7.82G)',
      desc: 'Severe aerodynamic shock or structural impact event detected.'
    },
    esc_thermal: {
      name: 'Motor ESC Thermal Runaway',
      gforce: 1.45,
      temp: 94.2,
      volt: 14.8,
      reason: 'ESC Temp exceeded 80°C threshold (94.2°C)',
      desc: 'Motor driver MOSFET thermal saturation. Imminent coil meltdown.'
    },
    volt_sag: {
      name: 'Battery Voltage Collapse',
      gforce: 1.05,
      temp: 48.0,
      volt: 11.2,
      reason: 'Battery voltage collapsed below 13.5V threshold (11.2V)',
      desc: 'Severe cell brownout. Emergency auto-land failsafe sequence engaged.'
    },
    gps_denied: {
      name: 'Complete GNSS Loss / Jamming',
      gforce: 1.12,
      temp: 43.1,
      volt: 15.6,
      reason: 'RTK GPS Fix lost (0 satellites). Position uncertainty > 50m',
      desc: 'Electronic warfare jamming or antenna disconnect. Dead-reckoning mode.'
    },
    rotor_stall: {
      name: 'Aerodynamic Stall & Tumbling',
      gforce: 4.88,
      temp: 52.4,
      volt: 15.0,
      reason: 'Angular rate > 400°/s with rapid altitude drop (-18 m/s)',
      desc: 'Uncontrolled spatial disorientation. Autonomous ballistic parachute armed.'
    },
    geofence_breach: {
      name: 'Geofence Boundary Breach',
      gforce: 2.10,
      temp: 44.0,
      volt: 15.4,
      reason: 'Horizontal position exceeded 1,000m security cylinder perimeter',
      desc: 'Class-B restricted airspace encroachment. RTH beacon override.'
    }
  };

  // ==========================================================================
  // 2. SYNTHESIZED WEB AUDIO API
  // ==========================================================================
  let audioCtx = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playNormalChime() {
    if (!FlowState.soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08); // A5 -> D6 pleasant chime

      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  function playDangerAlarm() {
    if (!FlowState.soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      
      // Dual tone tactical alarm
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';

      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.linearRampToValueAtTime(220, now + 0.22); // Warping siren drop

      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.linearRampToValueAtTime(440, now + 0.22);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.25);
    } catch (e) {}
  }

  // ==========================================================================
  // 3. CANVAS HIGH-FPS PARTICLE FLOW SYSTEM
  // ==========================================================================
  const canvas = document.getElementById('flow-particle-canvas');
  const ctx = canvas?.getContext('2d');
  const particles = [];
  const impactBursts = [];

  // Canvas Logical Dimensions (1200 x 320)
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 320;

  // Origin & Target Waypoints
  const ORIGIN_PT = { x: 600, y: 20 };
  const TARGET_SD_PT = { x: 220, y: 300 };
  const TARGET_FRAM_PT = { x: 980, y: 300 };

  // Cubic Bezier Evaluation
  function getBezierPoint(p0, p1, p2, p3, t) {
    const oneMinusT = 1 - t;
    const a = oneMinusT * oneMinusT * oneMinusT;
    const b = 3 * oneMinusT * oneMinusT * t;
    const c = 3 * oneMinusT * t * t;
    const d = t * t * t;

    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
    };
  }

  // Control points matching the SVG curves
  // Left SD Curve: M 600,20 C 600,100 250,90 220,300
  const SD_BEZIER = {
    p0: { x: 600, y: 20 },
    p1: { x: 600, y: 100 },
    p2: { x: 250, y: 90 },
    p3: { x: 220, y: 300 }
  };

  // Right FRAM Curve: M 600,20 C 600,100 950,90 980,300
  const FRAM_BEZIER = {
    p0: { x: 600, y: 20 },
    p1: { x: 600, y: 100 },
    p2: { x: 950, y: 90 },
    p3: { x: 980, y: 300 }
  };

  /**
   * Spawn a new traveling packet capsule on the canvas
   */
  function spawnParticle(packet) {
    const isNormal = packet.status === 'NORMAL';
    const curve = isNormal ? SD_BEZIER : FRAM_BEZIER;

    // Normal travels smoothly; Danger bursts at ultra-fast DMA speed
    const baseDuration = isNormal ? 1.4 : 0.85;
    const adjustedDuration = baseDuration / FlowState.flowSpeedMultiplier;

    particles.push({
      id: packet.id,
      status: packet.status,
      target: packet.target,
      packetData: packet,
      curve: curve,
      progress: 0,
      duration: adjustedDuration,
      trail: [],
      maxTrail: isNormal ? 16 : 24,
      color: isNormal ? '#00f0ff' : '#ef4444',
      glowColor: isNormal ? '#10b981' : '#ff0055',
      size: isNormal ? 6.5 : 8.5
    });
  }

  /**
   * Spawn an impact shockwave burst when packet reaches target block
   */
  function spawnImpactBurst(x, y, isNormal) {
    const burstCount = isNormal ? 14 : 26;
    for (let i = 0; i < burstCount; i++) {
      const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5);
      const speed = isNormal ? (2 + Math.random() * 4) : (3.5 + Math.random() * 7);
      impactBursts.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: isNormal ? 0.045 : 0.035,
        color: isNormal ? (Math.random() > 0.5 ? '#00f0ff' : '#34d399') : (Math.random() > 0.5 ? '#ef4444' : '#f59e0b'),
        size: isNormal ? (2 + Math.random() * 2.5) : (2.5 + Math.random() * 4)
      });
    }
  }

  let lastFrameTime = performance.now();

  function renderParticleLoop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    if (ctx) {
      // Clear with slight alpha fade for motion trails
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Draw subtle conduit pulse dots
      const conduitTime = now * 0.002;
      for (let i = 0; i < 4; i++) {
        const tSD = (conduitTime * 0.4 + i * 0.25) % 1;
        const ptSD = getBezierPoint(SD_BEZIER.p0, SD_BEZIER.p1, SD_BEZIER.p2, SD_BEZIER.p3, tSD);
        ctx.beginPath();
        ctx.arc(ptSD.x, ptSD.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.fill();

        const tFRAM = (conduitTime * 0.5 + i * 0.25) % 1;
        const ptFRAM = getBezierPoint(FRAM_BEZIER.p0, FRAM_BEZIER.p1, FRAM_BEZIER.p2, FRAM_BEZIER.p3, tFRAM);
        ctx.beginPath();
        ctx.arc(ptFRAM.x, ptFRAM.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.fill();
      }

      // 2. Render Active Traveling Packets
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.progress += dt / p.duration;

        const currentPos = getBezierPoint(p.curve.p0, p.curve.p1, p.curve.p2, p.curve.p3, Math.min(p.progress, 1));

        // Save position to trail
        p.trail.unshift({ x: currentPos.x, y: currentPos.y });
        if (p.trail.length > p.maxTrail) p.trail.pop();

        // Draw Motion Trail (Glowing comet tail)
        for (let j = 1; j < p.trail.length; j++) {
          const tp1 = p.trail[j - 1];
          const tp2 = p.trail[j];
          const ratio = 1 - j / p.trail.length;

          ctx.beginPath();
          ctx.moveTo(tp1.x, tp1.y);
          ctx.lineTo(tp2.x, tp2.y);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * ratio;
          ctx.globalAlpha = ratio * 0.65;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Draw Traveling Capsule / Orb Head
        ctx.save();
        ctx.shadowColor = p.glowColor;
        ctx.shadowBlur = p.status === 'NORMAL' ? 14 : 22;

        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.status === 'NORMAL' ? '#00f0ff' : '#ff0055';
        ctx.fill();

        // Inner hot core
        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Floating Packet Label Chip
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillStyle = p.status === 'NORMAL' ? '#34d399' : '#f87171';
        ctx.shadowBlur = 0;
        const tagText = p.status === 'NORMAL' ? `PKT #${p.id}` : `⚠️ DANGER #${p.id}`;
        ctx.fillText(tagText, currentPos.x + 12, currentPos.y + 3);

        ctx.restore();

        // Check Arrival
        if (p.progress >= 1.0) {
          spawnImpactBurst(currentPos.x, currentPos.y, p.status === 'NORMAL');
          onPacketArrival(p.packetData);
          particles.splice(i, 1);
        }
      }

      // 3. Render Impact Bursts
      for (let i = impactBursts.length - 1; i >= 0; i--) {
        const b = impactBursts[i];
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.94;
        b.vy *= 0.94;
        b.life -= b.decay;

        if (b.life <= 0) {
          impactBursts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = b.life;
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size * b.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    requestAnimationFrame(renderParticleLoop);
  }

  requestAnimationFrame(renderParticleLoop);

  // ==========================================================================
  // 4. PACKET DISPATCHING & ROUTING ARBITER
  // ==========================================================================
  /**
   * Dispatches a flight telemetry packet into the routing system.
   * If status === 'NORMAL', routes to SD Card.
   * If status === 'DANGER', diverts to FRAM.
   */
  function dispatchPacket(customOptions = null) {
    FlowState.totalPackets++;

    let packet = null;

    if (customOptions) {
      // Custom crafted packet
      packet = {
        id: FlowState.totalPackets,
        met: formatMET(FlowState.metSeconds),
        status: customOptions.status,
        target: customOptions.status === 'NORMAL' ? 'SD' : 'FRAM',
        gforce: customOptions.gforce,
        temp: customOptions.temp,
        volt: customOptions.volt,
        reason: customOptions.reason || (customOptions.status === 'NORMAL' ? 'Manual Normal Ingest' : 'Manual Danger Alert'),
        protocol: customOptions.status === 'NORMAL' ? 'SDIO 4-Bit (FAT32)' : 'Direct DMA SPI (150ns)',
        latency: customOptions.status === 'NORMAL' ? '2.4 ms' : '150 ns',
        note: customOptions.note || (customOptions.status === 'NORMAL' ? 'Manual Normal Telemetry' : 'Manual Danger Event')
      };
    } else {
      // Auto-generated packet based on danger probability
      const isDanger = (Math.random() * 100) < FlowState.dangerProbability;

      if (isDanger) {
        // Select random or dropdown danger scenario
        const scenarioKeys = Object.keys(DangerScenarios);
        const randomKey = scenarioKeys[Math.floor(Math.random() * scenarioKeys.length)];
        const scenario = DangerScenarios[randomKey];

        packet = {
          id: FlowState.totalPackets,
          met: formatMET(FlowState.metSeconds),
          status: 'DANGER',
          target: 'FRAM',
          gforce: scenario.gforce + (Math.random() * 0.4 - 0.2),
          temp: scenario.temp + (Math.random() * 1.0 - 0.5),
          volt: scenario.volt + (Math.random() * 0.2 - 0.1),
          reason: scenario.reason,
          protocol: 'Direct DMA SPI (150ns)',
          latency: '148 ns',
          note: scenario.name
        };
      } else {
        // Normal Telemetry Stream
        packet = {
          id: FlowState.totalPackets,
          met: formatMET(FlowState.metSeconds),
          status: 'NORMAL',
          target: 'SD',
          gforce: +(1.0 + (Math.random() * 0.18 - 0.08)).toFixed(2),
          temp: +(42.0 + (Math.random() * 2.2 - 1.0)).toFixed(1),
          volt: +(15.82 + (Math.random() * 0.14 - 0.07)).toFixed(2),
          reason: 'Nominal flight conditions (G < 3.5, Temp < 80°C)',
          protocol: 'SDIO 4-Bit (FAT32)',
          latency: '2.3 ms',
          note: 'Continuous 1000Hz Ingest'
        };
      }
    }

    // Update Central Top MCU Active Display
    updateActivePacketDisplay(packet);

    // Spawn animated particle traveling to its destination
    spawnParticle(packet);
  }

  /**
   * Update the Central MCU packet serialization box & gate indicator
   */
  function updateActivePacketDisplay(packet) {
    const isNormal = packet.status === 'NORMAL';

    // Elements
    const dispBox = document.getElementById('current-packet-display');
    const idTag = document.getElementById('disp-pkt-id');
    const timeTag = document.getElementById('disp-pkt-time');
    const badge = document.getElementById('disp-pkt-badge');
    const payload = document.getElementById('disp-pkt-payload');
    const route = document.getElementById('disp-pkt-route');

    const gateSd = document.getElementById('gate-path-sd');
    const gateFram = document.getElementById('gate-path-fram');

    if (idTag) idTag.textContent = `PKT #${String(packet.id).padStart(4, '0')}`;
    if (timeTag) timeTag.textContent = `MET ${packet.met}`;

    if (badge) {
      badge.textContent = `STATUS: ${packet.status}`;
      badge.className = `pkt-status-badge ${isNormal ? 'normal' : 'danger'}`;
    }

    if (payload) {
      payload.textContent = `[G: ${packet.gforce}G | ESC: ${packet.temp}°C | ${packet.volt}V | ${packet.note}]`;
    }

    if (route) {
      if (isNormal) {
        route.textContent = `➔ ARBITER: STATUS IS NORMAL ➔ ROUTE TO SD CARD`;
        route.style.color = 'var(--hud-cyan)';
      } else {
        route.textContent = `⚠️ ARBITER: DANGER DETECTED ➔ EMERGENCY DIVERT TO FRAM`;
        route.style.color = 'var(--hud-crimson)';
      }
    }

    // Flash border on decision box
    if (dispBox) {
      dispBox.classList.remove('flash-normal', 'flash-danger');
      void dispBox.offsetWidth; // trigger reflow
      dispBox.classList.add(isNormal ? 'flash-normal' : 'flash-danger');
    }

    // Toggle active demux path indicator
    if (gateSd && gateFram) {
      if (isNormal) {
        gateSd.classList.add('active');
        gateFram.classList.remove('active');
      } else {
        gateFram.classList.add('active');
        gateSd.classList.remove('active');
      }
    }

    // Update live sensor readout numbers in MCU
    const gEl = document.getElementById('val-gforce');
    const escEl = document.getElementById('val-esc');
    const pwrEl = document.getElementById('val-power');
    if (gEl) {
      gEl.textContent = `${packet.gforce} G ${isNormal ? '(Nominal)' : '⚠️ HAZARD'}`;
      gEl.className = `s-val ${isNormal ? 'cyan' : 'crimson'}`;
    }
    if (escEl) {
      escEl.textContent = `${packet.temp}°C ${packet.temp > 80 ? '🔥 OVERHEAT' : '(Normal)'}`;
    }
    if (pwrEl) {
      pwrEl.textContent = `${packet.volt} V ${packet.volt < 13.5 ? '⚡ CRITICAL' : '| 24.2 A'}`;
    }
  }

  // ==========================================================================
  // 5. PACKET ARRIVAL HANDLER (BLOCK REACTIONS & LOGGING)
  // ==========================================================================
  function onPacketArrival(packet) {
    const isNormal = packet.status === 'NORMAL';

    if (isNormal) {
      // -------------------------------------------------------------
      // ARRIVAL AT SD CARD BLOCK
      // -------------------------------------------------------------
      FlowState.sdPackets++;
      playNormalChime();

      // 1. Update Block Stats & Counters
      const sdCnt = document.getElementById('sd-counter-packets');
      if (sdCnt) sdCnt.textContent = FlowState.sdPackets.toLocaleString();

      // 2. Flash SD Activity LED and Card Overlay
      const sdLed = document.getElementById('sd-activity-led');
      const sdOverlay = document.getElementById('sd-flash-overlay');
      const sdBlock = document.getElementById('block-sd-unit');

      if (sdLed) {
        sdLed.classList.add('blinking');
        setTimeout(() => sdLed.classList.remove('blinking'), 150);
      }
      if (sdOverlay) {
        sdOverlay.classList.add('flashing');
        setTimeout(() => sdOverlay.classList.remove('flashing'), 200);
      }
      if (sdBlock) {
        sdBlock.classList.add('sd-write-active');
        setTimeout(() => sdBlock.classList.remove('sd-write-active'), 250);
      }

      // 3. Allocate Cluster in 64-Sector Grid
      allocateSdCluster();

      // 4. Add Entry to SD Live Terminal Feed
      addTerminalLog('sd', `[WRITE] PKT #${packet.id} (${packet.met}): G=${packet.gforce}G, ESC=${packet.temp}°C ➔ /LOGS/FLIGHT_0042.BIN [OK]`);

    } else {
      // -------------------------------------------------------------
      // ARRIVAL AT FRAM BLOCK (EMERGENCY FREEZE)
      // -------------------------------------------------------------
      FlowState.framPackets++;
      playDangerAlarm();

      // 1. Update Block Stats & Counters
      const framCnt = document.getElementById('fram-counter-packets');
      if (framCnt) framCnt.textContent = FlowState.framPackets.toLocaleString();

      const lastTrigger = document.getElementById('fram-last-trigger');
      if (lastTrigger) lastTrigger.textContent = packet.note.toUpperCase();

      // 2. Flash FRAM Hazard Strobe and Overlay
      const framLed = document.getElementById('fram-activity-led');
      const framOverlay = document.getElementById('fram-strobe-overlay');
      const framBlock = document.getElementById('block-fram-unit');

      if (framLed) {
        framLed.classList.add('blinking');
        setTimeout(() => framLed.classList.remove('blinking'), 300);
      }
      if (framOverlay) {
        framOverlay.classList.add('flashing');
        setTimeout(() => framOverlay.classList.remove('flashing'), 350);
      }
      if (framBlock) {
        framBlock.classList.add('fram-write-active');
        setTimeout(() => framBlock.classList.remove('fram-write-active'), 450);
      }

      // 3. Allocate Ferroelectric Dipole Cell
      allocateFramCell();

      // 4. Add Entry to FRAM Emergency Incident Terminal
      addTerminalLog('fram', `[CRITICAL ⚠️] 0x00F${String(FlowState.framPackets * 16).padStart(3, '0')}: ${packet.reason} ➔ NON-VOLATILE LATCH SECURED [150ns]`);

      // 5. Toast Notification for Danger Incident
      showToastNotification(`🚨 CRITICAL DANGER: ${packet.note}`, packet.reason);
    }

    // Update Top Ribbon KPIs
    updateKPIs();

    // Append to Bottom Audit Log Table
    FlowState.auditLogs.unshift(packet);
    if (FlowState.auditLogs.length > 100) FlowState.auditLogs.pop(); // keep last 100
    renderAuditTable();
  }

  // ==========================================================================
  // 6. TOP KPI RIBBON & TERMINAL LOGGERS
  // ==========================================================================
  function updateKPIs() {
    const totalEl = document.getElementById('kpi-total-packets');
    const sdEl = document.getElementById('kpi-sd-packets');
    const sdPctEl = document.getElementById('kpi-sd-pct');
    const framEl = document.getElementById('kpi-fram-packets');
    const framPctEl = document.getElementById('kpi-fram-pct');

    if (totalEl) totalEl.textContent = FlowState.totalPackets.toLocaleString();
    if (sdEl) sdEl.textContent = FlowState.sdPackets.toLocaleString();
    if (framEl) framEl.textContent = FlowState.framPackets.toLocaleString();

    if (FlowState.totalPackets > 0) {
      const sdPct = ((FlowState.sdPackets / FlowState.totalPackets) * 100).toFixed(1);
      const framPct = ((FlowState.framPackets / FlowState.totalPackets) * 100).toFixed(1);
      if (sdPctEl) sdPctEl.textContent = `${sdPct}% of stream`;
      if (framPctEl) framPctEl.textContent = `${framPct}% emergency snapshots`;
    }
  }

  function addTerminalLog(target, message) {
    const container = target === 'sd' 
      ? document.getElementById('sd-terminal-scroller') 
      : document.getElementById('fram-terminal-scroller');

    if (!container) return;

    const line = document.createElement('div');
    line.className = `t-line ${target === 'sd' ? 'normal' : 'danger'}`;
    line.textContent = message;

    container.insertBefore(line, container.firstChild);

    // Limit lines to 25
    while (container.children.length > 25) {
      container.removeChild(container.lastChild);
    }
  }

  function showToastNotification(title, message) {
    const container = document.getElementById('flow-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'flow-toast toast-danger';
    toast.innerHTML = `
      <span style="font-size: 1.4rem;">🚨</span>
      <div style="display:flex; flex-direction:column;">
        <strong style="color:#fff; font-size:0.85rem;">${title}</strong>
        <span style="color:var(--text-muted); font-size:0.75rem; font-family:var(--font-mono);">${message}</span>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ==========================================================================
  // 7. MEMORY MATRICES: CLUSTERS & QUANTUM CELLS
  // ==========================================================================
  const SD_TOTAL_CLUSTERS = 64;
  let sdAllocatedCount = 16; // Initial FAT32 clusters

  function initSdClusters() {
    const grid = document.getElementById('sd-clusters-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < SD_TOTAL_CLUSTERS; i++) {
      const cell = document.createElement('div');
      cell.className = 'cluster-cell';
      cell.id = `sd-cell-${i}`;
      if (i < sdAllocatedCount) cell.classList.add('allocated');
      grid.appendChild(cell);
    }
  }

  function allocateSdCluster() {
    const cellIdx = Math.floor(Math.random() * SD_TOTAL_CLUSTERS);
    const cell = document.getElementById(`sd-cell-${cellIdx}`);
    if (cell) {
      cell.classList.add('flash-cell');
      setTimeout(() => {
        cell.classList.remove('flash-cell');
        cell.classList.add('allocated');
      }, 250);
    }

    if (sdAllocatedCount < SD_TOTAL_CLUSTERS && Math.random() > 0.6) {
      sdAllocatedCount++;
      const pct = ((sdAllocatedCount / SD_TOTAL_CLUSTERS) * 100).toFixed(1);
      const fillBar = document.getElementById('sd-progress-fill');
      const valLabel = document.getElementById('sd-cluster-pct');
      if (fillBar) fillBar.style.width = `${pct}%`;
      if (valLabel) valLabel.textContent = `${(15.8 + sdAllocatedCount * 0.1).toFixed(1)} GB / 64 GB (${pct}%)`;
    }
  }

  const FRAM_TOTAL_CELLS = 64;
  let framAllocatedCount = 3; // Initial FRAM hazard records

  function initFramCells() {
    const grid = document.getElementById('fram-clusters-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < FRAM_TOTAL_CELLS; i++) {
      const cell = document.createElement('div');
      cell.className = 'cluster-cell';
      cell.id = `fram-cell-${i}`;
      if (i < framAllocatedCount) cell.classList.add('allocated');
      grid.appendChild(cell);
    }
  }

  function allocateFramCell() {
    const cellIdx = (framAllocatedCount++) % FRAM_TOTAL_CELLS;
    const cell = document.getElementById(`fram-cell-${cellIdx}`);
    if (cell) {
      cell.classList.add('flash-cell');
      setTimeout(() => {
        cell.classList.remove('flash-cell');
        cell.classList.add('allocated');
      }, 350);
    }

    const pct = ((framAllocatedCount / FRAM_TOTAL_CELLS) * 100).toFixed(1);
    const fillBar = document.getElementById('fram-progress-fill');
    const valLabel = document.getElementById('fram-usage-val');
    if (fillBar) fillBar.style.width = `${Math.min(pct, 100)}%`;
    if (valLabel) valLabel.textContent = `${(384 + framAllocatedCount * 64)} KB / 8,192 KB (${pct}%)`;
  }

  initSdClusters();
  initFramCells();

  // ==========================================================================
  // 8. AUDIT LOG TABLE & FILTERING
  // ==========================================================================
  function renderAuditTable() {
    const tbody = document.getElementById('flow-audit-tbody');
    if (!tbody) return;

    // Filter
    const filtered = FlowState.auditLogs.filter(item => {
      if (FlowState.auditFilter === 'normal') return item.status === 'NORMAL';
      if (FlowState.auditFilter === 'danger') return item.status === 'DANGER';
      return true;
    });

    // Update filter counts
    const allCount = document.getElementById('audit-count-all');
    const normalCount = document.getElementById('audit-count-normal');
    const dangerCount = document.getElementById('audit-count-danger');
    if (allCount) allCount.textContent = FlowState.auditLogs.length;
    if (normalCount) normalCount.textContent = FlowState.auditLogs.filter(i => i.status === 'NORMAL').length;
    if (dangerCount) dangerCount.textContent = FlowState.auditLogs.filter(i => i.status === 'DANGER').length;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr class="audit-empty-row">
          <td colspan="8">No packets matched this filter.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(pkt => `
      <tr class="${pkt.status === 'DANGER' ? 'row-danger' : ''}">
        <td><strong>#${String(pkt.id).padStart(4, '0')}</strong></td>
        <td>${pkt.met}</td>
        <td>
          <span class="audit-badge ${pkt.status === 'NORMAL' ? 'normal' : 'danger'}">
            ${pkt.status === 'NORMAL' ? '🟢 NORMAL' : '🚨 DANGER'}
          </span>
        </td>
        <td>
          <span class="audit-target ${pkt.target === 'SD' ? 'sd' : 'fram'}">
            ${pkt.target === 'SD' ? '💾 MicroSD Card' : '⚡ Ferroelectric FRAM'}
          </span>
        </td>
        <td>G=${pkt.gforce}G • ${pkt.temp}°C • ${pkt.volt}V</td>
        <td>${pkt.protocol}</td>
        <td>${pkt.latency}</td>
        <td>${pkt.reason}</td>
      </tr>
    `).join('');
  }

  // Audit Filter Buttons
  document.querySelectorAll('.audit-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.audit-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      FlowState.auditFilter = btn.dataset.auditFilter || 'all';
      renderAuditTable();
    });
  });

  // Clear Audit Log Button
  document.getElementById('btn-clear-audit-log')?.addEventListener('click', () => {
    FlowState.auditLogs = [];
    renderAuditTable();
  });

  // ==========================================================================
  // 9. CONTINUOUS AUTO-STREAM CONTROLLER
  // ==========================================================================
  function restartStreamTimer() {
    if (FlowState.streamTimerId) {
      clearInterval(FlowState.streamTimerId);
      FlowState.streamTimerId = null;
    }

    if (FlowState.streamingActive) {
      const intervalMs = 1000 / FlowState.streamRateHz;
      FlowState.streamTimerId = setInterval(() => {
        dispatchPacket();
      }, intervalMs);
    }
  }

  // Toggle Stream Button
  const btnToggleStream = document.getElementById('btn-toggle-stream');
  btnToggleStream?.addEventListener('click', () => {
    FlowState.streamingActive = !FlowState.streamingActive;

    const icon = document.getElementById('stream-btn-icon');
    const text = document.getElementById('stream-btn-text');

    if (FlowState.streamingActive) {
      btnToggleStream.className = 'btn-stream-toggle running';
      if (icon) icon.textContent = '⏸';
      if (text) text.textContent = 'Streaming Active';
    } else {
      btnToggleStream.className = 'btn-stream-toggle paused';
      if (icon) icon.textContent = '▶';
      if (text) text.textContent = 'Streaming Paused';
    }

    restartStreamTimer();
  });

  // Rate Buttons
  document.querySelectorAll('.rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rate-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      FlowState.streamRateHz = parseFloat(btn.dataset.rate) || 2;
      restartStreamTimer();
    });
  });

  // Danger Probability Slider
  const sliderProb = document.getElementById('slider-danger-prob');
  const valProb = document.getElementById('val-danger-prob');
  sliderProb?.addEventListener('input', (e) => {
    FlowState.dangerProbability = parseInt(e.target.value, 10);
    if (valProb) valProb.textContent = `${FlowState.dangerProbability}%`;
  });

  // Flow Speed Slider
  const sliderSpeed = document.getElementById('slider-flow-speed');
  const valSpeed = document.getElementById('val-flow-speed');
  sliderSpeed?.addEventListener('input', (e) => {
    FlowState.flowSpeedMultiplier = parseFloat(e.target.value);
    if (valSpeed) valSpeed.textContent = `${FlowState.flowSpeedMultiplier.toFixed(1)}x`;
  });

  // ==========================================================================
  // 10. MANUAL BUTTONS & CUSTOM PACKET BUILDER
  // ==========================================================================
  // Quick Normal Dispatch
  document.getElementById('btn-dispatch-normal')?.addEventListener('click', () => {
    dispatchPacket({
      status: 'NORMAL',
      gforce: 1.02,
      temp: 42.4,
      volt: 15.84,
      reason: 'Manual Dispatch: Nominal cruise sensor telemetry',
      note: 'Routine Sector 7 Waypoint Telemetry'
    });
  });

  // Quick Danger Dispatch
  document.getElementById('btn-dispatch-danger')?.addEventListener('click', () => {
    const select = document.getElementById('select-danger-scenario');
    const key = select?.value || 'high_g';
    const sc = DangerScenarios[key] || DangerScenarios.high_g;

    dispatchPacket({
      status: 'DANGER',
      gforce: sc.gforce,
      temp: sc.temp,
      volt: sc.volt,
      reason: sc.reason,
      note: sc.name
    });
  });

  // Custom Status Toggle Buttons
  const btnCustomNormal = document.getElementById('btn-custom-normal');
  const btnCustomDanger = document.getElementById('btn-custom-danger');

  btnCustomNormal?.addEventListener('click', () => {
    FlowState.customStatus = 'NORMAL';
    btnCustomNormal.className = 'pill-btn active-normal';
    btnCustomDanger.className = 'pill-btn';
    const gInput = document.getElementById('custom-gforce');
    const tempInput = document.getElementById('custom-temp');
    if (gInput) gInput.value = '1.04';
    if (tempInput) tempInput.value = '42.5';
  });

  btnCustomDanger?.addEventListener('click', () => {
    FlowState.customStatus = 'DANGER';
    btnCustomDanger.className = 'pill-btn active-danger';
    btnCustomNormal.className = 'pill-btn';
    const gInput = document.getElementById('custom-gforce');
    const tempInput = document.getElementById('custom-temp');
    if (gInput) gInput.value = '6.80';
    if (tempInput) tempInput.value = '88.0';
  });

  // Custom Inject Button
  document.getElementById('btn-inject-custom')?.addEventListener('click', () => {
    const gforce = parseFloat(document.getElementById('custom-gforce')?.value) || 1.0;
    const temp = parseFloat(document.getElementById('custom-temp')?.value) || 40.0;
    const volt = parseFloat(document.getElementById('custom-volt')?.value) || 15.8;
    const note = document.getElementById('custom-note')?.value || 'Custom Injected Telemetry';

    // Auto-detect if hazardous
    let determinedStatus = FlowState.customStatus;
    if (gforce > 3.5 || temp > 80.0 || volt < 13.5) {
      determinedStatus = 'DANGER';
    }

    let reason = determinedStatus === 'NORMAL' 
      ? 'Custom packet nominal flight parameters'
      : `Critical threshold exceeded (G: ${gforce}G, Temp: ${temp}°C, Volt: ${volt}V)`;

    dispatchPacket({
      status: determinedStatus,
      gforce: gforce,
      temp: temp,
      volt: volt,
      reason: reason,
      note: note
    });
  });

  // ==========================================================================
  // 11. AUDIO & RESET & KEYBOARD CONTROLS
  // ==========================================================================
  const btnAudio = document.getElementById('btn-flow-audio');
  const audioIcon = document.getElementById('flow-audio-icon');

  function toggleAudio() {
    FlowState.soundEnabled = !FlowState.soundEnabled;
    if (audioIcon) {
      audioIcon.textContent = FlowState.soundEnabled ? '🔊' : '🔇';
    }
  }

  btnAudio?.addEventListener('click', toggleAudio);

  // Reset Counters
  document.getElementById('btn-flow-reset')?.addEventListener('click', () => {
    FlowState.totalPackets = 0;
    FlowState.sdPackets = 0;
    FlowState.framPackets = 0;
    FlowState.auditLogs = [];
    updateKPIs();
    renderAuditTable();
    initSdClusters();
    initFramCells();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ignore if typing inside input
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (e.key === 'n' || e.key === 'N') {
      document.getElementById('btn-dispatch-normal')?.click();
    } else if (e.key === 'd' || e.key === 'D') {
      document.getElementById('btn-dispatch-danger')?.click();
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      document.getElementById('btn-toggle-stream')?.click();
    } else if (e.key === 'm' || e.key === 'M') {
      toggleAudio();
    }
  });

  // Mission Elapsed Time (MET) Clock Ticker
  function formatMET(sec) {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  }

  setInterval(() => {
    FlowState.metSeconds += 0.1;
    const clock = document.getElementById('flow-clock');
    if (clock) clock.textContent = formatMET(FlowState.metSeconds);
  }, 100);

  // ==========================================================================
  // 12. INITIAL STARTUP BOOTSTRAP
  // ==========================================================================
  // Start autonomous streaming ticker
  restartStreamTimer();

  // Seed with 2 initial normal packets and 1 danger incident to showcase immediate visual life
  setTimeout(() => {
    dispatchPacket({
      status: 'NORMAL',
      gforce: 1.02,
      temp: 42.1,
      volt: 15.84,
      reason: 'Bootstrap initialization: IMU gyro calibrated and nominal',
      note: 'Pre-Flight BIT Diagnostic Stream'
    });
  }, 300);

  setTimeout(() => {
    dispatchPacket({
      status: 'DANGER',
      gforce: 7.82,
      temp: 45.0,
      volt: 15.2,
      reason: 'G-Force exceeded 3.5G threshold (Peak 7.82G)',
      note: 'High-G Shock Demonstration'
    });
  }, 1100);

});
