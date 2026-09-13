/* NEON BOSS RUSH - Complete 3D Boss Rush Game */
(function () {
  'use strict';

  // ========== CONFIG ==========
  const CONFIG = {
    arenaSize: 40,
    playerH: 1.6,
    gravity: 0,
    maxParticles: 280,
    bulletSpeed: 28,
    dashCooldown: 1.2,
    specialCooldown: 6,
    powerupSpawnInterval: 12
  };

  const CHARS = [
    { id: 0, name: 'THE SOLDIER', role: 'Balanced', hp: 100, speed: 7, dmg: 10, color: 0xff4400, special: 'Heavy Burst', desc: 'Auto-cannon specialist' },
    { id: 1, name: 'THE RUNNER', role: 'Speed', hp: 75, speed: 11, dmg: 7, color: 0x00ff88, special: 'Dash Strike', desc: 'High mobility striker' },
    { id: 2, name: 'THE TANK', role: 'Tank', hp: 150, speed: 5, dmg: 13, color: 0x4488ff, special: 'Ground Slam', desc: 'Heavy ground assaults' },
    { id: 3, name: 'THE TECH', role: 'Specialist', hp: 90, speed: 8, dmg: 8, color: 0xaa44ff, special: 'Plasma Orb', desc: 'Homing energy orbs' }
  ];

  const BOSSES = [
    { name: 'IRON BEAST', color: 0x888888, hp: 800, scale: 2.8, arena: 0, attacks: ['shot','charge','melee','missiles'] },
    { name: 'THE NECRO CORE', color: 0x440066, hp: 900, scale: 2.2, arena: 1, attacks: ['ring','beam','teleport','summon'] },
    { name: 'INFERNO TITAN', color: 0xff4400, hp: 1000, scale: 3.0, arena: 3, attacks: ['melee','shockwave','meteors','shot'] },
    { name: 'VOID HUNTER', color: 0x220033, hp: 850, scale: 2.0, arena: 4, attacks: ['teleport','shot','clones'] },
    { name: 'THE OVERLORD', color: 0xff00aa, hp: 1400, scale: 3.2, arena: 4, attacks: ['ring','charge','barrage','teleport','melee'] },
    { name: 'VOLT SPIDER', color: 0x00ffcc, hp: 1000, scale: 2.4, arena: 2, attacks: ['eshot','web','edash','lightning'] },
    { name: 'FROST GOLEM', color: 0x44aaff, hp: 1200, scale: 3.0, arena: 2, attacks: ['iceshot','icewave','icecircle','smash'] },
    { name: 'TOXIC BOT', color: 0x44ff44, hp: 1100, scale: 2.5, arena: 0, attacks: ['tshot','tzone','rocket','spin'] },
    { name: 'SKY REAPER', color: 0xff2244, hp: 1050, scale: 2.3, arena: 4, attacks: ['airshot','dive','ringshot','wind'] },
    { name: 'MAGMA WORM', color: 0xff6600, hp: 1300, scale: 2.8, arena: 3, attacks: ['fshot','lavazone','burrow','lavaburst'] },
    { name: 'NEON PHANTOM', color: 0xff00ff, hp: 1500, scale: 2.6, arena: 4, attacks: ['pshot','teleport','clone','neonburst'] }
  ];
  const DIFF = { easy:{dmgMul:0.7,atkSpeed:1.25,powerMul:1.3}, normal:{dmgMul:1,atkSpeed:1,powerMul:1}, hard:{dmgMul:1.25,atkSpeed:0.78,powerMul:0.7} };
  let difficulty = 'normal';
  let zones=[], telegraphs=[], clones=[];
  let shieldActive=false, magnetTimer=0, chainShot=false, rapidTimer=0;
  let finisherActive=false, finisherTimer=0, overheat=0, momentum=0, energyBar=0, comboMilestone=0, lastAttack='', globalAtkCD=0, maxCombo=0;

  // ========== STATE ==========
  let scene, camera, renderer, clock;
  let player, boss, bullets = [], particles = [], powerups = [], damageNums = [];
  let keys = {}, mouse = { x: 0, y: 0, down: false, rdown: false };
  let selectedChar = 0, currentBoss = 0, score = 0, combo = 0, comboTimer = 0;
  let gameState = 'menu'; // menu, play, pause, defeat, victory, final
  let startTime = 0, elapsed = 0, specialCD = 0, dashCD = 0;
  let activePower = null, powerTimer = 0;
  let camShake = 0, camZoom = 1;
  let audioCtx = null, musicGain, sfxGain, muted = false;
  let musicVol = 0.4, sfxVol = 0.6;
  let touchJoy = { active: false, dx: 0, dy: 0 };
  let isMobile = false;
  let arenaGroup, lights = {};
  let saved = { defeated: 0, bestTime: 9999, bestScore: 0, lastChar: 0 };

  // ========== AUDIO (Web Audio + fallback silent) ==========
  function initAudio() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = audioCtx.createGain();
      sfxGain = audioCtx.createGain();
      musicGain.gain.value = musicVol;
      sfxGain.gain.value = sfxVol;
      musicGain.connect(audioCtx.destination);
      sfxGain.connect(audioCtx.destination);
    } catch (e) { audioCtx = null; }
  }

  function playTone(freq, dur, type, vol, dest) {
    if (!audioCtx || muted) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol * (dest === musicGain ? musicVol : sfxVol), audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g);
      g.connect(dest || sfxGain);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  function sfxShoot() { playTone(220 + Math.random() * 80, 0.08, 'square', 0.15); }
  function sfxHit() { playTone(80, 0.12, 'sawtooth', 0.25); }
  function sfxDash() { playTone(400, 0.15, 'sine', 0.2); }
  function sfxPower() { playTone(600, 0.2, 'triangle', 0.3); playTone(900, 0.25, 'sine', 0.2); }
  function sfxDamage() { playTone(60, 0.2, 'sawtooth', 0.35); }
  function sfxVictory() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'triangle', 0.25), i * 120));
  }
  function sfxBossHit() { playTone(40, 0.25, 'sawtooth', 0.4); }

  // ========== DOM ==========
  const $ = id => document.getElementById(id);
  const clickStart = $('click-start');
  const menuScreen = $('menu-screen');
  const charScreen = $('char-screen');
  const settingsScreen = $('settings-screen');
  const creditsScreen = $('credits-screen');
  const hud = $('hud');
  const pauseScreen = $('pause-screen');
  const defeatScreen = $('defeat-screen');
  const victoryScreen = $('victory-screen');
  const finalScreen = $('final-screen');
  const mobileControls = $('mobile-controls');

  function showNotif(txt,dur){var n=$('notif');if(!n)return;n.textContent=txt;n.classList.add('show');clearTimeout(n._t);n._t=setTimeout(function(){n.classList.remove('show');},dur||1000);}
  function showScreen(s) {
    [menuScreen, charScreen, settingsScreen, creditsScreen, pauseScreen, defeatScreen, victoryScreen, finalScreen].forEach(el => el.classList.remove('active'));
    if (s) s.classList.add('active');
  }

  function loadSave() {
    try {
      const d = localStorage.getItem('neonBossRush');
      if (d) saved = JSON.parse(d);
    } catch (e) {}
  }
  function saveGame() {
    try { localStorage.setItem('neonBossRush', JSON.stringify(saved)); } catch (e) {}
  }

  // ========== THREE SETUP ==========
  function initThree() {
    const canvas = $('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.FogExp2(0x050508, 0.025);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 12, 18);

    clock = new THREE.Clock();

    // Ambient
    const amb = new THREE.AmbientLight(0x222233, 0.6);
    scene.add(amb);
    lights.amb = amb;

    // Main directional
    const dir = new THREE.DirectionalLight(0xffaa88, 0.7);
    dir.position.set(10, 20, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 60;
    dir.shadow.camera.left = -25;
    dir.shadow.camera.right = 25;
    dir.shadow.camera.top = 25;
    dir.shadow.camera.bottom = -25;
    scene.add(dir);
    lights.dir = dir;

    // Point lights for neon
    lights.red = new THREE.PointLight(0xff2200, 1.2, 30);
    lights.red.position.set(-12, 6, -12);
    scene.add(lights.red);
    lights.violet = new THREE.PointLight(0xaa00ff, 1, 25);
    lights.violet.position.set(12, 5, 12);
    scene.add(lights.violet);
    lights.green = new THREE.PointLight(0x00ff66, 0.8, 20);
    lights.green.position.set(0, 4, -15);
    scene.add(lights.green);

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ========== ARENA ==========
  function clearArena() {
    if (arenaGroup) {
      scene.remove(arenaGroup);
      arenaGroup.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    }
    arenaGroup = new THREE.Group();
    scene.add(arenaGroup);
  }

  function buildArena(idx) {
    clearArena();
    const size = CONFIG.arenaSize;
    const mats = [
      { floor: 0x1a1a22, wall: 0x2a2a33, accent: 0xff2200 }, // industrial
      { floor: 0x110818, wall: 0x1a0a22, accent: 0x8800ff }, // dark temple
      { floor: 0x0a1520, wall: 0x0f2030, accent: 0x00aaff }, // lab
      { floor: 0x1a0a05, wall: 0x2a1508, accent: 0xff4400 }, // volcanic
      { floor: 0x050510, wall: 0x0a0a1a, accent: 0xff00aa }  // void
    ];
    const m = mats[idx % 5];

    // Floor
    const floorGeo = new THREE.PlaneGeometry(size, size, 8, 8);
    const floorMat = new THREE.MeshStandardMaterial({ color: m.floor, roughness: 0.85, metalness: 0.3 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arenaGroup.add(floor);

    // Grid lines
    const grid = new THREE.GridHelper(size, 20, m.accent, 0x111118);
    grid.position.y = 0.02;
    arenaGroup.add(grid);

    // Walls / barriers
    const wallH = 4;
    const wallMat = new THREE.MeshStandardMaterial({ color: m.wall, roughness: 0.7, metalness: 0.4 });
    const sides = [
      [0, wallH / 2, -size / 2, size, wallH, 1],
      [0, wallH / 2, size / 2, size, wallH, 1],
      [-size / 2, wallH / 2, 0, 1, wallH, size],
      [size / 2, wallH / 2, 0, 1, wallH, size]
    ];
    sides.forEach(([x, y, z, w, h, d]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      arenaGroup.add(mesh);
    });

    // Decorative pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: m.accent, emissive: m.accent, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = size * 0.38;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3.5, 6), pillarMat);
      p.position.set(Math.cos(a) * r, 1.75, Math.sin(a) * r);
      p.castShadow = true;
      arenaGroup.add(p);
    }

    // Center pad
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3.2, 0.15, 16),
      new THREE.MeshStandardMaterial({ color: m.accent, emissive: m.accent, emissiveIntensity: 0.4, metalness: 0.7 })
    );
    pad.position.y = 0.08;
    arenaGroup.add(pad);

    // Hazard zones for certain arenas
    if (idx === 2 || idx === 4) {
      for (let i = 0; i < 3; i++) {
        const hz = new THREE.Mesh(
          new THREE.CircleGeometry(1.5 + Math.random(), 12),
          new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.25 })
        );
        hz.rotation.x = -Math.PI / 2;
        hz.position.set((Math.random() - 0.5) * 20, 0.05, (Math.random() - 0.5) * 20);
        hz.userData.hazard = true;
        arenaGroup.add(hz);
      }
    }

    // Update lights
    lights.red.color.setHex(m.accent);
    lights.red.intensity = 1.4;
  }

  // ========== PLAYER ==========
  function createPlayerMesh(char) {
    const g = new THREE.Group();
    const col = char.color;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.0, 0.45),
      new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.4 })
    );
    body.position.y = 0.9;
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6 })
    );
    head.position.y = 1.55;
    head.castShadow = true;
    g.add(head);

    // Visor
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.12, 0.1),
      new THREE.MeshBasicMaterial({ color: col })
    );
    visor.position.set(0, 1.55, 0.2);
    g.add(visor);

    // Arms
    const armMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.5 });
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), armMat);
    lArm.position.set(-0.5, 0.95, 0);
    g.add(lArm);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), armMat);
    rArm.position.set(0.5, 0.95, 0);
    g.add(rArm);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.3), legMat);
    lLeg.position.set(-0.2, 0.3, 0);
    g.add(lLeg);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.3), legMat);
    rLeg.position.set(0.2, 0.3, 0);
    g.add(rLeg);

    // Weapon
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
    );
    gun.position.set(0.55, 0.95, 0.3);
    g.add(gun);

    g.userData = { body, head, lArm, rArm, lLeg, rLeg, gun, animT: 0 };
    return g;
  }

  function spawnPlayer() {
    if (player && player.mesh) scene.remove(player.mesh);
    const c = CHARS[selectedChar];
    const mesh = createPlayerMesh(c);
    mesh.position.set(0, 0, 12);
    scene.add(mesh);
    player = {
      mesh,
      hp: c.hp,
      maxHp: c.hp,
      speed: c.speed,
      dmg: c.dmg,
      char: c,
      vel: new THREE.Vector3(),
      facing: 0,
      alive: true,
      invuln: 0,
      dashTimer: 0,
      attackAnim: 0
    };
  }

  // ========== BOSS ==========
  function createBossMesh(b) {
    const g = new THREE.Group();
    const col = b.color;
    if (b.name === 'THE NECRO CORE') {
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.4, 1),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.2 })
      );
      core.castShadow = true;
      g.add(core);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.12, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xaa00ff })
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      g.userData = { core, ring, type: 'sphere' };
    } else if (b.name === 'VOID HUNTER') {
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 2.5, 6),
        new THREE.MeshStandardMaterial({ color: col, emissive: 0x220033, emissiveIntensity: 0.4, metalness: 0.5 })
      );
      body.rotation.x = Math.PI;
      body.castShadow = true;
      g.add(body);
      g.userData = { body, type: 'hunter' };
    } else if (b.name === 'VOLT SPIDER') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111122, emissive: col, emissiveIntensity: 0.35, metalness: 0.7 }));
      body.position.y = 1.2; body.castShadow = true; g.add(body);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0x222233, emissive: col, emissiveIntensity: 0.2 }));
        leg.position.set(Math.cos(a) * 1.1, 0.6, Math.sin(a) * 1.1);
        leg.rotation.z = Math.cos(a) * 0.6; g.add(leg);
      }
      g.userData = { body, type: 'spider' };
    } else if (b.name === 'FROST GOLEM') {
      const torso = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 1.6), new THREE.MeshStandardMaterial({ color: col, emissive: 0x2244aa, emissiveIntensity: 0.25, metalness: 0.4 }));
      torso.position.y = 2.0; torso.castShadow = true; g.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.2), new THREE.MeshStandardMaterial({ color: 0xaaddff, emissive: col, emissiveIntensity: 0.3 }));
      head.position.y = 3.6; g.add(head);
      g.userData = { torso, head, type: 'golem' };
    } else if (b.name === 'TOXIC BOT') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 1.5), new THREE.MeshStandardMaterial({ color: 0x113311, emissive: col, emissiveIntensity: 0.4, metalness: 0.6 }));
      body.position.y = 1.6; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      head.position.y = 3.0; g.add(head);
      g.userData = { body, type: 'bot' };
    } else if (b.name === 'SKY REAPER') {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.0, 5), new THREE.MeshStandardMaterial({ color: 0x110011, emissive: col, emissiveIntensity: 0.35 }));
      body.position.y = 2.5; body.castShadow = true; g.add(body);
      for (let s = -1; s <= 1; s += 2) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.8), new THREE.MeshStandardMaterial({ color: 0x220011, emissive: col, emissiveIntensity: 0.25 }));
        wing.position.set(s * 1.6, 2.8, 0); wing.rotation.z = s * 0.3; g.add(wing);
      }
      g.userData = { body, type: 'flyer' };
    } else if (b.name === 'MAGMA WORM') {
      for (let i = 0; i < 5; i++) {
        const seg = new THREE.Mesh(new THREE.SphereGeometry(0.9 - i * 0.08, 8, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff4400 : 0x331100, emissive: 0xff6600, emissiveIntensity: 0.4 }));
        seg.position.set(0, 1.0, -i * 1.5); seg.castShadow = true; g.add(seg);
      }
      g.userData = { type: 'worm' };
    } else if (b.name === 'NEON PHANTOM') {
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({ color: 0x110011, emissive: 0xff00aa, emissiveIntensity: 0.55, transparent: true, opacity: 0.75 }));
      body.position.y = 2.0; body.castShadow = true; g.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.08, 6, 20), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 2; g.add(ring);
      g.userData = { body, ring, type: 'phantom' };
    } else {
      // Humanoid / beast
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(2.2 * b.scale / 2.5, 2.4 * b.scale / 2.5, 1.4 * b.scale / 2.5),
        new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.35, emissive: col, emissiveIntensity: 0.15 })
      );
      torso.position.y = 1.8 * b.scale / 2.5;
      torso.castShadow = true;
      g.add(torso);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(1.1 * b.scale / 2.5, 1.0 * b.scale / 2.5, 1.0 * b.scale / 2.5),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7 })
      );
      head.position.y = 3.3 * b.scale / 2.5;
      head.castShadow = true;
      g.add(head);
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 * b.scale / 2.5, 0.25, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      eye.position.set(0, 3.35 * b.scale / 2.5, 0.55 * b.scale / 2.5);
      g.add(eye);
      // Arms
      const armGeo = new THREE.BoxGeometry(0.5, 1.8 * b.scale / 2.5, 0.5);
      const armMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.5 });
      const lA = new THREE.Mesh(armGeo, armMat);
      lA.position.set(-1.4 * b.scale / 2.5, 1.8 * b.scale / 2.5, 0);
      g.add(lA);
      const rA = new THREE.Mesh(armGeo, armMat);
      rA.position.set(1.4 * b.scale / 2.5, 1.8 * b.scale / 2.5, 0);
      g.add(rA);
      g.userData = { torso, head, eye, lA, rA, type: 'humanoid' };
    }
    return g;
  }

  function spawnBoss(idx) {
    if (boss && boss.mesh) scene.remove(boss.mesh);
    const b = BOSSES[idx];
    const mesh = createBossMesh(b);
    mesh.position.set(0, 0, -8);
    mesh.scale.setScalar(b.scale / 2.2);
    scene.add(mesh);
    boss = {
      mesh,
      name: b.name,
      hp: b.hp,
      maxHp: b.hp,
      phase: 1,
      atkTimer: 2,
      atkCD: 2.2,
      alive: true,
      vel: new THREE.Vector3(),
      chargeDir: null,
      teleportCD: 0,
      summonTimer: 0,
      data: b
    };
    updateBossHUD();
  }

  // ========== BULLETS & PARTICLES ==========
  function spawnBullet(pos, dir, dmg, speed, color, owner, homing) {
    const geo = new THREE.SphereGeometry(0.18, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    bullets.push({
      mesh, dir: dir.clone().normalize(), speed: speed || CONFIG.bulletSpeed,
      dmg, owner, life: 2.5, homing: !!homing, radius: 0.25
    });
  }

  function spawnParticle(pos, color, count, speed, life) {
    for (let i = 0; i < count && particles.length < CONFIG.maxParticles; i++) {
      const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.1, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8,
        (Math.random() - 0.5) * speed
      );
      particles.push({ mesh, vel, life: life || 0.6, maxLife: life || 0.6 });
    }
  }

  function spawnDamageNum(pos, val) {
    // Simple: we skip 3D text for performance; score/combo covers feedback
  }

  // ========== POWERUPS ==========
  const POWER_TYPES = [
    { id: 'blood', name: 'BLOOD BATTERY', color: 0xff0022, dur: 0 },
    { id: 'overdrive', name: 'OVERDRIVE', color: 0xff8800, dur: 8 },
    { id: 'phase', name: 'PHASE SHIFT', color: 0xaa44ff, dur: 5 },
    { id: 'triple', name: 'TRIPLE CORE', color: 0x00ff44, dur: 7 },
    { id: 'gravity', name: 'GRAVITY BREAKER', color: 0x2244ff, dur: 4 },
    { id: 'mirror', name: 'SOUL MIRROR', color: 0xcccccc, dur: 6 },
    { id: 'berserk', name: 'BERSERK', color: 0xff2200, dur: 6 },
    { id: 'magnet', name: 'MAGNET', color: 0x00ffff, dur: 8 },
    { id: 'shield', name: 'SHIELD', color: 0xffff00, dur: 0 },
    { id: 'chain', name: 'CHAIN SHOT', color: 0xffaa00, dur: 7 },
    { id: 'rapid', name: 'RAPID FIRE', color: 0x00ffaa, dur: 6 },
    { id: 'healcore', name: 'HEAL CORE', color: 0x88ff88, dur: 0 }
  ];

  function spawnPowerup() {
    if (powerups.length >= 3) return;
    const t = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
    const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const mat = new THREE.MeshStandardMaterial({ color: t.color, emissive: t.color, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    const ang = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 10;
    mesh.position.set(Math.cos(ang) * r, 0.8, Math.sin(ang) * r);
    scene.add(mesh);
    powerups.push({ mesh, type: t, life: 18, bob: Math.random() * 10 });
  }

  function applyPowerup(t) {
    sfxPower();
    if (t.id === 'blood' || t.id === 'healcore') {
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * (t.id === 'healcore' ? 0.18 : 0.25));
      updatePlayerHUD();
      return;
    }
    if (t.id === 'shield') { shieldActive = true; return; }
    if (t.id === 'magnet') { magnetTimer = t.dur; return; }
    if (t.id === 'chain') { chainShot = true; }
    if (t.id === 'rapid') { rapidTimer = t.dur; }
    activePower = t;
    powerTimer = t.dur || 6;
    $('powerup-status').textContent = 'POWER: ' + t.name;
  }

  // ========== COMBAT HELPERS ==========
  function playerShoot() {
    if (!player.alive || gameState !== 'play') return;
    const origin = player.mesh.position.clone();
    origin.y += 1.1;
    const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    let dmg = player.dmg;
    let spd = CONFIG.bulletSpeed;
    if (activePower && activePower.id === 'overdrive') {
      dmg *= 1.3;
      spd *= 1.25;
    }
    const col = player.char.color;
    if (activePower && activePower.id === 'triple') {
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      spawnBullet(origin, dir, dmg, spd, col, 'player');
      spawnBullet(origin, dir.clone().add(right.clone().multiplyScalar(0.25)).normalize(), dmg * 0.8, spd, col, 'player');
      spawnBullet(origin, dir.clone().add(right.clone().multiplyScalar(-0.25)).normalize(), dmg * 0.8, spd, col, 'player');
    } else {
      spawnBullet(origin, dir, dmg, spd, col, 'player');
    }
    sfxShoot();
    player.attackAnim = 0.15;
    camShake = Math.max(camShake, 0.08);
  }

  function playerSpecial() {
    if (specialCD > 0 || !player.alive || gameState !== 'play') return;
    specialCD = CONFIG.specialCooldown;
    $('special-ready').textContent = 'SPECIAL: COOLING';
    sfxDash();
    const c = player.char;
    const origin = player.mesh.position.clone();
    origin.y += 1;
    if (c.id === 0) { // Heavy Burst
      for (let i = 0; i < 7; i++) {
        setTimeout(() => {
          if (!player.alive) return;
          const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
          spawnBullet(origin.clone(), dir, player.dmg * 1.8, 32, 0xffaa00, 'player');
          camShake = 0.2;
        }, i * 60);
      }
    } else if (c.id === 1) { // Dash Strike
      player.dashTimer = 0.35;
      const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
      player.vel.copy(dir.multiplyScalar(28));
      spawnParticle(player.mesh.position, 0x00ff88, 12, 6, 0.4);
      // Damage on contact during dash handled in update
      player.mesh.userData.dashDmg = true;
      setTimeout(() => { if (player) player.mesh.userData.dashDmg = false; }, 350);
    } else if (c.id === 2) { // Ground Slam
      spawnParticle(player.mesh.position, 0x4488ff, 25, 10, 0.7);
      camShake = 0.45;
      const dist = player.mesh.position.distanceTo(boss.mesh.position);
      if (dist < 10 && boss.alive) {
        damageBoss(player.dmg * 3.5);
      }
    } else if (c.id === 3) { // Plasma Orb
      const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
      spawnBullet(origin, dir, player.dmg * 2.5, 14, 0xaa44ff, 'player', true);
    }
  }

  function playerDash() {
    if (dashCD > 0 || !player.alive || gameState !== 'play') return;
    dashCD = CONFIG.dashCooldown;
    player.dashTimer = 0.25;
    const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    if (keys['w'] || keys['a'] || keys['s'] || keys['d'] || touchJoy.active) {
      // Use move dir if available
    }
    player.vel.copy(dir.multiplyScalar(18));
    spawnParticle(player.mesh.position, player.char.color, 8, 5, 0.3);
    sfxDash();
    player.invuln = 0.3;
  }

  function damagePlayer(amount) {
    if (!player.alive || player.invuln > 0) return;
    if (shieldActive) { shieldActive = false; spawnParticle(player.mesh.position, 0xffff00, 12, 5, 0.35); return; }
    amount *= (DIFF[difficulty] ? DIFF[difficulty].dmgMul : 1);
    if (player.char && player.char.id === 2) amount *= 0.7;
    if (activePower && activePower.id === 'phase') amount *= 0.25;
    if (activePower && activePower.id === 'mirror' && boss.alive) {
      damageBoss(amount * 0.4);
    }
    player.hp -= amount;
    player.invuln = 0.4;
    camShake = 0.35;
    sfxDamage();
    // Flash
    let flash = document.querySelector('.damage-flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.className = 'damage-flash';
      document.body.appendChild(flash);
    }
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 80);
    combo = 0;
    updatePlayerHUD();
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      spawnParticle(player.mesh.position, 0xff0000, 30, 8, 1);
      endGame(false);
    }
  }

  function damageBoss(amount) {
    if (!boss.alive) return;
    if (activePower && activePower.id === 'gravity') amount *= 1.15;
    boss.hp -= amount;
    combo++;
    comboTimer = 2;
    score += Math.floor(amount * (1 + combo * 0.05));
    sfxBossHit();
    spawnParticle(boss.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xff4400, 8, 5, 0.4);
    camShake = Math.max(camShake, 0.12);
    updateBossHUD();
    updatePlayerHUD();
    // Combo milestones
    if (combo === 10 && comboMilestone < 10) { comboMilestone = 10; }
    if (combo === 25 && comboMilestone < 25) { comboMilestone = 25; }
    if (combo === 50 && comboMilestone < 50) { comboMilestone = 50; }
    if (combo > maxCombo) maxCombo = combo;
    // Phase transitions 66%/33%
    const pct = boss.hp / boss.maxHp;
    if (pct < 0.05 && !finisherActive && boss.hp > 0) {
      finisherActive = true; finisherTimer = 2.2;
    }
    if (pct < 0.33 && boss.phase < 3) {
      boss.phase = 3;
      boss.atkCD = Math.max(0.85, boss.atkCD * 0.72);
      $('boss-phase').textContent = 'PHASE 3 - ENRAGED';
      camShake = 0.5;
      spawnParticle(boss.mesh.position, boss.data.color, 25, 9, 0.7);
    } else if (pct < 0.66 && boss.phase < 2) {
      boss.phase = 2;
      boss.atkCD = Math.max(1.05, boss.atkCD * 0.88);
      $('boss-phase').textContent = 'PHASE 2';
      camShake = 0.3;
    }
    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.alive = false;
      spawnParticle(boss.mesh.position, 0xffaa00, 55, 14, 1.3);
      camShake = 0.9;
      sfxVictory();
      score += 500 + (currentBoss + 1) * 200 + Math.floor(combo * 8) + Math.floor(player.hp * 2);
      endBoss();
    }
  }

  // ========== BOSS AI ==========
  function updateBossAI(dt) {
    if (!boss.alive || !player.alive) return;
    boss.atkTimer -= dt;
    const toPlayer = player.mesh.position.clone().sub(boss.mesh.position);
    const dist = toPlayer.length();
    toPlayer.normalize();

    // Face player
    boss.mesh.lookAt(player.mesh.position.x, boss.mesh.position.y, player.mesh.position.z);

    // Idle motion
    if (boss.mesh.userData.type === 'sphere') {
      boss.mesh.position.y = 2.5 + Math.sin(clock.elapsedTime * 2) * 0.4;
      if (boss.mesh.userData.ring) boss.mesh.userData.ring.rotation.z += dt * 2;
    } else if (boss.mesh.userData.type === 'hunter') {
      boss.mesh.position.y = 1.2 + Math.sin(clock.elapsedTime * 3) * 0.3;
    } else {
      boss.mesh.position.y = 0;
    }

    // Gravity breaker slow
    let spdMul = 1;
    if (activePower && activePower.id === 'gravity') spdMul = 0.45;

    if (boss.atkTimer <= 0) {
      boss.atkTimer = boss.atkCD * (0.85 + Math.random() * 0.3);
      const phase = boss.phase;
      const r = Math.random();

      if (boss.name === 'IRON BEAST') {
        if (r < 0.3) { // projectiles
          for (let i = 0; i < 3 + phase; i++) {
            const ang = (i - 1) * 0.2;
            const d = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
            spawnBullet(boss.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), d, 12 + phase * 3, 16, 0xff4400, 'boss');
          }
        } else if (r < 0.55) { // charge
          boss.chargeDir = toPlayer.clone().multiplyScalar(14 * spdMul);
          boss.atkTimer = 1.2;
        } else if (r < 0.75) { // melee
          if (dist < 6) damagePlayer(18 + phase * 4);
          camShake = 0.3;
        } else { // missiles
          for (let i = 0; i < 4; i++) {
            setTimeout(() => {
              if (!boss.alive) return;
              const p = player.mesh.position.clone();
              p.y = 1;
              const dir = p.sub(boss.mesh.position).normalize();
              spawnBullet(boss.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), dir, 15, 12, 0xff8800, 'boss');
            }, i * 150);
          }
        }
      } else if (boss.name === 'THE NECRO CORE') {
        if (r < 0.35) { // ring shots
          for (let i = 0; i < 8 + phase * 2; i++) {
            const a = (i / (8 + phase * 2)) * Math.PI * 2;
            const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
            spawnBullet(boss.mesh.position.clone(), d, 10, 10, 0xaa00ff, 'boss');
          }
        } else if (r < 0.55) { // beam
          spawnBullet(boss.mesh.position.clone(), toPlayer, 20, 22, 0xff00ff, 'boss');
        } else if (r < 0.75) { // teleport
          const ang = Math.random() * Math.PI * 2;
          boss.mesh.position.set(Math.cos(ang) * 12, boss.mesh.position.y, Math.sin(ang) * 12);
          spawnParticle(boss.mesh.position, 0xaa00ff, 15, 6, 0.5);
        } else { // summons (mini bullets)
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            spawnBullet(boss.mesh.position.clone().add(new THREE.Vector3(Math.cos(a) * 2, 0, Math.sin(a) * 2)), toPlayer, 8, 8, 0x6600aa, 'boss');
          }
        }
      } else if (boss.name === 'INFERNO TITAN') {
        if (r < 0.3) {
          if (dist < 7) { damagePlayer(22); camShake = 0.4; }
        } else if (r < 0.5) { // shockwave
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            spawnBullet(boss.mesh.position.clone(), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 12, 9, 0xff4400, 'boss');
          }
          camShake = 0.5;
        } else if (r < 0.75) { // meteors
          for (let i = 0; i < 3 + phase; i++) {
            const target = player.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4));
            const dir = target.sub(boss.mesh.position).normalize();
            spawnBullet(boss.mesh.position.clone().add(new THREE.Vector3(0, 4, 0)), dir, 16, 11, 0xff6600, 'boss');
          }
        } else {
          spawnBullet(boss.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), toPlayer, 14, 14, 0xff2200, 'boss');
        }
      } else if (boss.name === 'VOID HUNTER') {
        if (r < 0.4) { // teleport + strike
          const ang = Math.random() * Math.PI * 2;
          boss.mesh.position.set(player.mesh.position.x + Math.cos(ang) * 5, 1.2, player.mesh.position.z + Math.sin(ang) * 5);
          spawnParticle(boss.mesh.position, 0x440066, 12, 5, 0.4);
          if (boss.mesh.position.distanceTo(player.mesh.position) < 4) damagePlayer(16);
        } else if (r < 0.65) {
          for (let i = 0; i < 5; i++) {
            const a = (i - 2) * 0.25;
            const d = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
            spawnBullet(boss.mesh.position.clone(), d, 11, 18, 0x220044, 'boss');
          }
        } else { // clones (fake bullets)
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            const pos = boss.mesh.position.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
            spawnBullet(pos, toPlayer, 9, 12, 0x330055, 'boss');
          }
        }
      } else if (boss.name === 'THE OVERLORD') {
        if (r < 0.25) {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + clock.elapsedTime;
            spawnBullet(boss.mesh.position.clone(), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 13, 11, 0xff00aa, 'boss');
          }
        } else if (r < 0.45) {
          boss.chargeDir = toPlayer.clone().multiplyScalar(16 * spdMul);
          boss.atkTimer = 1.0;
        } else if (r < 0.65) {
          for (let i = 0; i < 6; i++) {
            setTimeout(() => {
              if (!boss.alive) return;
              spawnBullet(boss.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), toPlayer, 14, 15, 0xff44cc, 'boss');
            }, i * 80);
          }
        } else if (r < 0.8) {
          const ang = Math.random() * Math.PI * 2;
          boss.mesh.position.set(Math.cos(ang) * 10, 0, Math.sin(ang) * 10);
          spawnParticle(boss.mesh.position, 0xff00aa, 20, 7, 0.5);
        } else {
          if (dist < 8) damagePlayer(25);
          camShake = 0.45;
        }
      } else {
        // Generic for new bosses: shot / wave / dash / zone mix
        const col = boss.data.color;
        if (r < 0.3) {
          for (let i = 0; i < 3 + boss.phase; i++) {
            const a = (i - 1) * 0.2;
            const d = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
            spawnBullet(boss.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), d, 12 + boss.phase * 2, 15, col, 'boss');
          }
        } else if (r < 0.5) {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            spawnBullet(boss.mesh.position.clone(), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 11, 10, col, 'boss');
          }
          camShake = 0.3;
        } else if (r < 0.7) {
          boss.chargeDir = toPlayer.clone().multiplyScalar(15 * spdMul);
          boss.atkTimer = 0.9;
        } else {
          const ang = Math.random() * Math.PI * 2;
          boss.mesh.position.set(Math.cos(ang) * 11, boss.mesh.position.y, Math.sin(ang) * 11);
          spawnParticle(boss.mesh.position, col, 15, 6, 0.45);
        }
      }
    }

    // Charge movement
    if (boss.chargeDir) {
      boss.mesh.position.add(boss.chargeDir.clone().multiplyScalar(dt));
      boss.chargeDir.multiplyScalar(0.92);
      if (boss.chargeDir.length() < 0.5) boss.chargeDir = null;
      // Collision with player
      if (boss.mesh.position.distanceTo(player.mesh.position) < 3.5) {
        damagePlayer(15 + boss.phase * 3);
        boss.chargeDir = null;
      }
      // Bounds
      clampPos(boss.mesh.position, 16);
    }
  }

  function clampPos(pos, lim) {
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
  }

  // ========== UPDATE LOOP ==========
  function update(dt) {
    if (gameState !== 'play') return;
    elapsed = (performance.now() - startTime) / 1000;
    updateTimer();

    // Cooldowns
    if (specialCD > 0) {
      specialCD -= dt;
      if (specialCD <= 0) $('special-ready').textContent = 'SPECIAL: READY';
    }
    if (dashCD > 0) dashCD -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (player.dashTimer > 0) player.dashTimer -= dt;
    if (player.attackAnim > 0) player.attackAnim -= dt;
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (activePower) {
      powerTimer -= dt;
      if (powerTimer <= 0) {
        activePower = null;
        $('powerup-status').textContent = 'POWER: NONE';
      }
    }

    // Player movement
    if (player.alive) {
      let mx = 0, mz = 0;
      if (keys['w'] || keys['arrowup']) mz -= 1;
      if (keys['s'] || keys['arrowdown']) mz += 1;
      if (keys['a'] || keys['arrowleft']) mx -= 1;
      if (keys['d'] || keys['arrowright']) mx += 1;
      if (touchJoy.active) {
        mx += touchJoy.dx;
        mz += touchJoy.dy;
      }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len; mz /= len;
        let spd = player.speed;
        if (activePower && activePower.id === 'overdrive') spd *= 1.4;
        if (player.dashTimer <= 0) {
          player.vel.x = mx * spd;
          player.vel.z = mz * spd;
        }
        // Face move dir or mouse
        if (len > 0.1) player.facing = Math.atan2(mx, mz);
      } else if (player.dashTimer <= 0) {
        player.vel.x *= 0.8;
        player.vel.z *= 0.8;
      }

      // Mouse aim
      if (!isMobile) {
        // Aim based on mouse relative to center roughly via last known
      }

      player.mesh.position.x += player.vel.x * dt;
      player.mesh.position.z += player.vel.z * dt;
      clampPos(player.mesh.position, 18);

      // Simple walk anim
      const ud = player.mesh.userData;
      ud.animT += dt * (len > 0.1 ? 10 : 2);
      if (ud.lLeg) {
        ud.lLeg.rotation.x = Math.sin(ud.animT) * 0.4 * (len > 0.1 ? 1 : 0.1);
        ud.rLeg.rotation.x = -Math.sin(ud.animT) * 0.4 * (len > 0.1 ? 1 : 0.1);
        ud.lArm.rotation.x = -Math.sin(ud.animT) * 0.3;
        ud.rArm.rotation.x = Math.sin(ud.animT) * 0.3;
      }
      if (player.attackAnim > 0 && ud.gun) ud.gun.position.z = 0.5;
      else if (ud.gun) ud.gun.position.z = 0.3;

      // Dash damage
      if (player.mesh.userData.dashDmg && boss.alive) {
        if (player.mesh.position.distanceTo(boss.mesh.position) < 3.5) {
          damageBoss(player.dmg * 2);
          player.mesh.userData.dashDmg = false;
        }
      }

      // Rotate mesh
      player.mesh.rotation.y = player.facing;
    }

    updateBossAI(dt);

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.homing && boss.alive && b.owner === 'player') {
        const to = boss.mesh.position.clone().sub(b.mesh.position).normalize();
        b.dir.lerp(to, 0.04).normalize();
      }
      b.mesh.position.add(b.dir.clone().multiplyScalar(b.speed * dt));
      b.life -= dt;
      // Bounds
      if (b.life <= 0 || Math.abs(b.mesh.position.x) > 22 || Math.abs(b.mesh.position.z) > 22) {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        bullets.splice(i, 1);
        continue;
      }
      // Collisions
      if (b.owner === 'player' && boss.alive) {
        if (b.mesh.position.distanceTo(boss.mesh.position) < 2.2 * (boss.data.scale / 2.5)) {
          damageBoss(b.dmg);
          spawnParticle(b.mesh.position, 0xffaa00, 5, 4, 0.3);
          scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          b.mesh.material.dispose();
          bullets.splice(i, 1);
        }
      } else if (b.owner === 'boss' && player.alive) {
        if (b.mesh.position.distanceTo(player.mesh.position) < 1.0) {
          damagePlayer(b.dmg);
          spawnParticle(b.mesh.position, 0xff0000, 5, 3, 0.25);
          scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          b.mesh.material.dispose();
          bullets.splice(i, 1);
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.vel.y -= 8 * dt;
      p.life -= dt;
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        particles.splice(i, 1);
      }
    }

    // Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.bob += dt * 3;
      pu.mesh.position.y = 0.8 + Math.sin(pu.bob) * 0.25;
      pu.mesh.rotation.y += dt * 2;
      pu.life -= dt;
      if (pu.life <= 0) {
        scene.remove(pu.mesh);
        pu.mesh.geometry.dispose();
        pu.mesh.material.dispose();
        powerups.splice(i, 1);
        continue;
      }
      if (player.alive && player.mesh.position.distanceTo(pu.mesh.position) < 1.5) {
        applyPowerup(pu.type);
        score += 50;
        scene.remove(pu.mesh);
        pu.mesh.geometry.dispose();
        pu.mesh.material.dispose();
        powerups.splice(i, 1);
      }
    }

    // Spawn powerups
    if (Math.random() < dt / CONFIG.powerupSpawnInterval) spawnPowerup();

    // Camera follow
    if (player && player.mesh) {
      const target = player.mesh.position.clone();
      target.y += 10;
      target.z += 14;
      camera.position.lerp(target, 1 - Math.pow(0.02, dt));
      const look = player.mesh.position.clone();
      look.y += 1;
      camera.lookAt(look);
      // Shake
      if (camShake > 0) {
        camera.position.x += (Math.random() - 0.5) * camShake * 2;
        camera.position.y += (Math.random() - 0.5) * camShake * 1.5;
        camShake *= 0.9;
        if (camShake < 0.01) camShake = 0;
      }
    }

    // Neon light pulse
    if (lights.red) lights.red.intensity = 1.1 + Math.sin(clock.elapsedTime * 3) * 0.3;
  }

  function updatePlayerHUD() {
    const pct = Math.max(0, player.hp / player.maxHp * 100);
    $('health-bar').style.width = pct + '%';
    $('health-text').textContent = Math.ceil(player.hp) + '/' + player.maxHp;
    $('player-name').textContent = player.char.name;
    $('combo-display').textContent = 'COMBO: ' + combo;
    $('score').textContent = 'SCORE: ' + score;
  }

  function updateBossHUD() {
    const pct = Math.max(0, boss.hp / boss.maxHp * 100);
    $('boss-bar').style.width = pct + '%';
    $('boss-hp-text').textContent = Math.ceil(pct) + '%';
    $('boss-name').textContent = boss.name;
    $('boss-phase').textContent = 'PHASE ' + boss.phase;
  }

  function updateTimer() {
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    $('timer').textContent = 'TIME: ' + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ========== GAME FLOW ==========
  function startBossRush() {
    currentBoss = 0;
    score = 0;
    combo = 0;
    startBoss(0);
  }

  function startBoss(idx) {
    currentBoss = idx;
    clearEntities();
    buildArena(BOSSES[idx].arena);
    spawnPlayer();
    spawnBoss(idx);
    startTime = performance.now() - elapsed * 1000;
    if (idx === 0) {
      elapsed = 0;
      startTime = performance.now();
    }
    specialCD = 0;
    dashCD = 0;
    activePower = null;
    powerTimer = 0;
    $('special-ready').textContent = 'SPECIAL: READY';
    $('powerup-status').textContent = 'POWER: NONE';
    gameState = 'play';
    showScreen(null);
    hud.classList.remove('hidden');
    if (isMobile) mobileControls.classList.remove('hidden');
    updatePlayerHUD();
    updateBossHUD();
  }

  function clearEntities() {
    bullets.forEach(b => { scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); });
    particles.forEach(p => { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
    powerups.forEach(p => { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
    if (typeof zones !== 'undefined') zones.forEach(z => { try{scene.remove(z.mesh);z.mesh.geometry.dispose();z.mesh.material.dispose();}catch(e){} });
    if (typeof telegraphs !== 'undefined') telegraphs.forEach(t => { try{scene.remove(t.mesh);t.mesh.geometry.dispose();t.mesh.material.dispose();}catch(e){} });
    if (typeof clones !== 'undefined') clones.forEach(cl => { try{scene.remove(cl.mesh);}catch(e){} });
    bullets = []; particles = []; powerups = []; zones = []; telegraphs = []; clones = [];
    if (player && player.mesh) scene.remove(player.mesh);
    if (boss && boss.mesh) scene.remove(boss.mesh);
    player = null; boss = null;
  }

  function endBoss() {
    gameState = 'victory';
    hud.classList.add('hidden');
    mobileControls.classList.add('hidden');
    saved.defeated = Math.max(saved.defeated, currentBoss + 1);
    if (score > saved.bestScore) saved.bestScore = score;
    saved.lastChar = selectedChar;
    saveGame();
    $('victory-stats').textContent = 'Score: ' + score + ' | Time: ' + Math.floor(elapsed) + 's | Max Combo: ' + maxCombo;
    if (currentBoss >= BOSSES.length - 1) {
      showScreen(finalScreen);
      $('final-stats').textContent = 'Final Score: ' + score + ' | Total Time: ' + Math.floor(elapsed) + 's';
      if (elapsed < saved.bestTime) saved.bestTime = elapsed;
      saveGame();
    } else {
      showScreen(victoryScreen);
    }
  }

  function endGame(win) {
    gameState = 'defeat';
    hud.classList.add('hidden');
    mobileControls.classList.add('hidden');
    $('defeat-stats').textContent = 'Score: ' + score + ' | Boss: ' + (boss ? boss.name : '-');
    showScreen(defeatScreen);
  }

  function togglePause() {
    if (gameState === 'play') {
      gameState = 'pause';
      showScreen(pauseScreen);
      hud.classList.add('hidden');
    } else if (gameState === 'pause') {
      gameState = 'play';
      showScreen(null);
      hud.classList.remove('hidden');
    }
  }

  // ========== INPUT ==========
  function setupInput() {
    window.addEventListener('keydown', e => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape') togglePause();
      if (gameState === 'play') {
        if (e.key === ' ') { e.preventDefault(); playerDash(); }
        if (e.key.toLowerCase() === 'q') playerSpecial();
        if (e.key.toLowerCase() === 'e' && powerups.length) {
          // nearest
          let best = null, bd = 99;
          powerups.forEach(p => {
            const d = player.mesh.position.distanceTo(p.mesh.position);
            if (d < bd) { bd = d; best = p; }
          });
          if (best && bd < 3) {
            applyPowerup(best.type);
            scene.remove(best.mesh);
            best.mesh.geometry.dispose();
            best.mesh.material.dispose();
            powerups.splice(powerups.indexOf(best), 1);
          }
        }
      }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    const canvas = $('game-canvas');
    canvas.addEventListener('mousedown', e => {
      if (gameState !== 'play') return;
      if (e.button === 0) { mouse.down = true; playerShoot(); }
      if (e.button === 2) mouse.rdown = true;
    });
    canvas.addEventListener('mouseup', e => {
      if (e.button === 0) mouse.down = false;
      if (e.button === 2) mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousemove', e => {
      // Approximate facing from mouse offset from center
      const dx = (e.clientX / window.innerWidth - 0.5) * 2;
      const dy = (e.clientY / window.innerHeight - 0.5) * 2;
      if (player) player.facing = Math.atan2(dx, -dy + 0.3);
    });

    // Auto fire while held
    setInterval(() => {
      if (mouse.down && gameState === 'play' && player && player.alive) playerShoot();
    }, 180);

    // Mobile
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      const joyBase = $('joystick-base');
      const knob = $('joystick-knob');
      let joyId = null;
      joyBase.addEventListener('touchstart', e => {
        e.preventDefault();
        joyId = e.changedTouches[0].identifier;
        touchJoy.active = true;
      }, { passive: false });
      window.addEventListener('touchmove', e => {
        for (const t of e.changedTouches) {
          if (t.identifier === joyId) {
            const rect = joyBase.getBoundingClientRect();
            let dx = (t.clientX - rect.left - 60) / 50;
            let dy = (t.clientY - rect.top - 60) / 50;
            const len = Math.hypot(dx, dy);
            if (len > 1) { dx /= len; dy /= len; }
            touchJoy.dx = dx;
            touchJoy.dy = dy;
            knob.style.left = (35 + dx * 30) + 'px';
            knob.style.top = (35 + dy * 30) + 'px';
          }
        }
      }, { passive: false });
      window.addEventListener('touchend', e => {
        for (const t of e.changedTouches) {
          if (t.identifier === joyId) {
            touchJoy.active = false;
            touchJoy.dx = 0; touchJoy.dy = 0;
            knob.style.left = '35px';
            knob.style.top = '35px';
            joyId = null;
          }
        }
      });
      $('btn-attack-m').addEventListener('touchstart', e => { e.preventDefault(); playerShoot(); });
      $('btn-dash-m').addEventListener('touchstart', e => { e.preventDefault(); playerDash(); });
      $('btn-special-m').addEventListener('touchstart', e => { e.preventDefault(); playerSpecial(); });
      $('btn-power-m').addEventListener('touchstart', e => { e.preventDefault(); /* pickup nearest handled by proximity */ });
    }
  }

  // ========== UI BINDINGS ==========
  function setupUI() {
    $('btn-play').onclick = () => {
      selectedChar = saved.lastChar || 0;
      startBossRush();
    };
    $('btn-chars').onclick = () => {
      buildCharSelect();
      showScreen(charScreen);
    };
    $('btn-settings').onclick = () => showScreen(settingsScreen);
    $('btn-credits').onclick = () => showScreen(creditsScreen);
    $('btn-back-menu').onclick = () => showScreen(menuScreen);
    $('btn-back-settings').onclick = () => showScreen(menuScreen);
    $('btn-back-credits').onclick = () => showScreen(menuScreen);
    $('btn-start-rush').onclick = () => startBossRush();
    $('btn-resume').onclick = () => togglePause();
    $('btn-restart').onclick = () => { elapsed = 0; startBoss(currentBoss); };
    $('btn-quit').onclick = () => { clearEntities(); gameState = 'menu'; showScreen(menuScreen); hud.classList.add('hidden'); mobileControls.classList.add('hidden'); };
    $('btn-retry').onclick = () => { elapsed = 0; startBoss(currentBoss); };
    $('btn-menu-defeat').onclick = () => { clearEntities(); gameState = 'menu'; showScreen(menuScreen); };
    $('btn-continue').onclick = () => startBoss(currentBoss + 1);
    $('btn-menu-victory').onclick = () => { clearEntities(); gameState = 'menu'; showScreen(menuScreen); };
    $('btn-play-again').onclick = () => { elapsed = 0; startBossRush(); };
    $('btn-menu-final').onclick = () => { clearEntities(); gameState = 'menu'; showScreen(menuScreen); };

    $('music-vol').oninput = e => { musicVol = +e.target.value; if (musicGain) musicGain.gain.value = musicVol; };
    $('sfx-vol').oninput = e => { sfxVol = +e.target.value; if (sfxGain) sfxGain.gain.value = sfxVol; };
    $('mute-toggle').onchange = e => { muted = e.target.checked; };
    const ds = $('difficulty-select');
    if (ds) { ds.value = difficulty; ds.onchange = e => { difficulty = e.target.value; }; }
  }

  function buildCharSelect() {
    const list = $('char-list');
    list.innerHTML = '';
    CHARS.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'char-card' + (i === selectedChar ? ' selected' : '');
      card.innerHTML = `<h3>${c.name}</h3><p>${c.desc}</p><div class="stats">HP:${c.hp} SPD:${c.speed} DMG:${c.dmg}<br>Special: ${c.special}</div>`;
      card.onclick = () => {
        selectedChar = i;
        document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        $('btn-start-rush').disabled = false;
      };
      list.appendChild(card);
    });
    $('btn-start-rush').disabled = false;
  }

  // ========== MAIN LOOP ==========
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    update(dt);
    renderer.render(scene, camera);
  }

  // ========== BOOT ==========
  function boot() {
    loadSave();
    initThree();
    setupInput();
    setupUI();
    buildArena(0);
    showScreen(menuScreen);

    clickStart.onclick = () => {
      clickStart.style.display = 'none';
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      animate();
    };
  }

  boot();
})();
