import * as THREE from 'three';

const obstacles = [];

export const DAIS = Object.freeze({ x: 0, z: 124 });

export function registerObstacle(x, z, r) {
  obstacles.push({ x, z, r });
}

export function inJudgmentZone(x, z) {
  return z >= 117.5 && z <= 134 && Math.abs(x) <= 10.5;
}

function inRegion(x, z, r) {
  const courtyard = z >= -2.6 + r && z <= 29.15 && x >= -22.4 + r && x <= 22.4 - r;
  const door = z >= 27.6 && z <= 32.4 && Math.abs(x) <= 4.55 - r;
  const bridge = z >= 30 && z <= 111.2 && Math.abs(x) <= 4.55 - r;
  const platform = z >= 110.6 && z <= 140.2 && Math.abs(x) <= 14.6 - r;
  return courtyard || door || bridge || platform;
}

export function canOccupy(x, z, radius = 0.42) {
  if (!inRegion(x, z, radius)) return false;
  for (const obstacle of obstacles) {
    if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.r + radius) return false;
  }
  return true;
}

export function tryMove(pos, dx, dz, radius = 0.42) {
  if (dx === 0 && dz === 0) return false;
  if (canOccupy(pos.x + dx, pos.z + dz, radius)) {
    pos.x += dx;
    pos.z += dz;
    return true;
  }
  if (Math.abs(dx) > 0 && canOccupy(pos.x + dx, pos.z, radius)) {
    pos.x += dx;
    return true;
  }
  if (Math.abs(dz) > 0 && canOccupy(pos.x, pos.z + dz, radius)) {
    pos.z += dz;
    return true;
  }
  return false;
}

// Souls crossing between the court and the bridge must use the gate mouth.
export function routeToward(from, to) {
  const needsDoor = (from.z < 29.2 && to.z > 30.8) || (to.z < 29.2 && from.z > 30.8);
  const wide = Math.abs(from.x) > 3.55 || Math.abs(to.x) > 4.15;
  if (needsDoor && wide) {
    const doorX = THREE.MathUtils.clamp(from.z < 29.2 ? from.x : to.x, -3.05, 3.05);
    const doorZ = from.z < 29.2 ? 28.6 : 30.5;
    if (Math.hypot(from.x - doorX, from.z - doorZ) > 0.55) {
      return { x: doorX, z: doorZ };
    }
  }
  return { x: to.x, z: to.z };
}

export function randomPointInCourtyard(blocked = [], minDist = 4) {
  for (let i = 0; i < 40; i += 1) {
    const x = THREE.MathUtils.lerp(-16, 16, Math.random());
    const z = THREE.MathUtils.lerp(8, 26, Math.random());
    if (!canOccupy(x, z, 0.9)) continue;
    if (blocked.some((point) => Math.hypot(point.x - x, point.z - z) < minDist)) continue;
    return { x, z };
  }
  return { x: 0, z: 16 };
}

function pointTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function stoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6a625c';
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 92) {
    let x = (Math.floor(y / 92) % 2) * -36;
    while (x < 512) {
      const w = 78 + Math.random() * 54;
      const h = 78 + Math.random() * 22;
      const shade = 92 + Math.random() * 34;
      ctx.fillStyle = `rgb(${shade - 6}, ${shade - 2}, ${shade + 6})`;
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = `rgba(255,255,255,${0.025 + Math.random() * 0.04})`;
      for (let i = 0; i < 6; i += 1) {
        ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 2, 2);
      }
      x += w;
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function labelTexture(text, width = 512, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f3e6c8';
  ctx.font = `600 ${Math.floor(height * 0.46)}px Georgia, Palatino, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function portalTexture(inner, mid) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 122);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.45, mid);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x080d18, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080d18);
  scene.fog = new THREE.FogExp2(0x0c1222, 0.0088);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.08, 240);

  const hemi = new THREE.HemisphereLight(0xc5d4ee, 0x231c16, 0.82);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xc5d2ff, 1.15);
  moon.position.set(18, 72, 24);
  moon.target.position.set(0, 0, 68);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 8;
  moon.shadow.camera.far = 190;
  moon.shadow.camera.left = -70;
  moon.shadow.camera.right = 70;
  moon.shadow.camera.top = 90;
  moon.shadow.camera.bottom = -90;
  moon.shadow.bias = -0.00045;
  moon.shadow.normalBias = 0.035;
  scene.add(moon);
  scene.add(moon.target);

  const fill = new THREE.DirectionalLight(0x8ea0c8, 0.28);
  fill.position.set(-24, 18, -10);
  scene.add(fill);

  const map = stoneTexture();
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const courtMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, map, roughness: 0.92, metalness: 0.04 });
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xa8b1be, map, roughness: 0.88, metalness: 0.05 });
  const platformMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, map, roughness: 0.86, metalness: 0.06 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x626b7c, roughness: 0.92, metalness: 0.05 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x3e4553, roughness: 0.95, metalness: 0.04 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8d836f, roughness: 0.7, metalness: 0.18, emissive: 0x2a2418, emissiveIntensity: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9a27a, roughness: 0.45, metalness: 0.6, emissive: 0x3a2e16, emissiveIntensity: 0.25 });

  const floorTexCourt = map.clone();
  floorTexCourt.repeat.set(4, 3);
  courtMat.map = floorTexCourt;
  const floorTexBridge = map.clone();
  floorTexBridge.repeat.set(1.4, 8);
  bridgeMat.map = floorTexBridge;
  const floorTexPlat = map.clone();
  floorTexPlat.repeat.set(3, 2.5);
  platformMat.map = floorTexPlat;
  [floorTexCourt, floorTexBridge, floorTexPlat].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = map.anisotropy;
    texture.needsUpdate = true;
  });

  const voidMat = new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 1 });
  const voidMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), voidMat);
  voidMesh.rotation.x = -Math.PI / 2;
  voidMesh.position.y = -0.08;
  voidMesh.receiveShadow = true;
  scene.add(voidMesh);

  function slab(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    scene.add(mesh);
    return mesh;
  }

  slab(new THREE.BoxGeometry(46, 0.4, 33), courtMat, 0, -0.2, 13.2);
  slab(new THREE.BoxGeometry(10.2, 0.4, 84), bridgeMat, 0, -0.2, 71);
  slab(new THREE.BoxGeometry(31, 0.4, 36), platformMat, 0, -0.2, 124);

  const runner = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.05, 122),
    trim,
  );
  runner.position.set(0, 0.035, 63);
  runner.receiveShadow = true;
  scene.add(runner);

  const threshold = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.06, 0.28), metal);
  threshold.position.set(0, 0.07, 117.5);
  scene.add(threshold);

  const mark = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.02, 40),
    new THREE.MeshBasicMaterial({ color: 0xd7b56a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(DAIS.x, 0.08, DAIS.z);
  scene.add(mark);

  function wall(x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  wall(-14.2, 1.15, 30.15, 16.5, 2.3, 0.7);
  wall(14.2, 1.15, 30.15, 16.5, 2.3, 0.7);
  wall(-22.7, 1.15, 13.2, 0.7, 2.3, 34);
  wall(22.7, 1.15, 13.2, 0.7, 2.3, 34);
  wall(0, 1.15, -3.15, 46, 2.3, 0.7);

  function railing(x, z0, z1) {
    const length = z1 - z0;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, length), stoneDark);
    rail.position.set(x, 0.48, (z0 + z1) / 2);
    rail.castShadow = true;
    rail.receiveShadow = true;
    scene.add(rail);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, length), trim);
    cap.position.set(x, 0.88, (z0 + z1) / 2);
    scene.add(cap);
  }
  railing(-4.85, 32, 110);
  railing(4.85, 32, 110);
  railing(-14.9, 112, 139);
  railing(14.9, 112, 139);

  const lanterns = [];
  function lantern(x, z, height = 2.3) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, height, 8), stoneDark);
    post.position.set(x, height / 2, z);
    post.castShadow = true;
    scene.add(post);
    const cage = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.36, 0.28),
      new THREE.MeshStandardMaterial({
        color: 0xffd7a4,
        emissive: 0xffb15a,
        emissiveIntensity: 1.4,
        roughness: 0.35,
      }),
    );
    cage.position.set(x, height + 0.05, z);
    scene.add(cage);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 6), stoneDark);
    cap.position.set(x, height + 0.3, z);
    scene.add(cap);
    const light = new THREE.PointLight(0xffb36a, 1.35, 11, 2);
    light.position.set(x, height + 0.05, z);
    scene.add(light);
    lanterns.push(light);
  }

  for (const z of [40, 58, 76, 94]) {
    lantern(-5.15, z);
    lantern(5.15, z);
  }
  [[-12, 6], [12, 7], [-8, 24], [9, 20], [-18, 14], [18, 16]].forEach(([x, z]) => lantern(x, z, 2.05));

  function pier(x, z) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 3.4, 8), stone);
    column.position.set(x, 1.7, z);
    column.castShadow = true;
    column.receiveShadow = true;
    scene.add(column);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 1.05), stoneDark);
    cap.position.set(x, 3.5, z);
    cap.castShadow = true;
    scene.add(cap);
  }
  for (const z of [46, 70, 92]) {
    pier(-7.4, z);
    pier(7.4, z);
  }

  function column(x, z, height, radius = 0.42) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius, height, 10), stone);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    registerObstacle(x, z, radius + 0.15);
    return mesh;
  }
  for (const z of [2, 10, 18, 26]) {
    column(-21.2, z, z === 18 ? 3.2 : 4.6, 0.48);
    column(21.2, z, z === 10 ? 2.8 : 4.6, 0.48);
  }

  function statue(x, z, turn) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.1), stoneDark);
    base.position.y = 0.2;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), stone);
    body.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), stone);
    head.position.y = 1.9;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 3, 6), stone);
    arm.position.set(0.32, 1.25, 0);
    arm.rotation.z = -0.5;
    group.add(base, body, head, arm);
    group.position.set(x, 0, z);
    group.rotation.y = turn;
    group.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    scene.add(group);
    registerObstacle(x, z, 0.85);
  }
  statue(-14.5, 17.5, 0.4);
  statue(13.8, 22.5, -0.6);

  function fountain(x, z) {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.48, 18), stone);
    basin.position.set(x, 0.24, z);
    basin.castShadow = true;
    basin.receiveShadow = true;
    scene.add(basin);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 20),
      new THREE.MeshStandardMaterial({ color: 0x1c2838, roughness: 0.2, metalness: 0.4, emissive: 0x0c121c, emissiveIntensity: 0.4 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.5, z);
    scene.add(water);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8), stoneDark);
    stem.position.set(x, 0.9, z);
    scene.add(stem);
    registerObstacle(x, z, 1.55);
  }
  fountain(-11.5, 8.5);

  const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3.2, 8), stone);
  fallen.rotation.z = Math.PI / 2;
  fallen.position.set(11.5, 0.32, 13.5);
  fallen.castShadow = true;
  scene.add(fallen);
  registerObstacle(11.5, 13.5, 1.35);

  function tree(x, z, scale) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.16 * scale, 2.4 * scale, 6),
      new THREE.MeshStandardMaterial({ color: 0x241c22, roughness: 1 }),
    );
    trunk.position.y = 1.2 * scale;
    group.add(trunk);
    for (let i = 0; i < 4; i += 1) {
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03 * scale, 0.05 * scale, 1.1 * scale, 5),
        trunk.material,
      );
      branch.position.set(Math.cos(i) * 0.2, 1.6 * scale + i * 0.15, Math.sin(i) * 0.2);
      branch.rotation.z = 0.7 + i * 0.2;
      branch.rotation.y = i;
      group.add(branch);
    }
    group.position.set(x, 0, z);
    scene.add(group);
  }
  tree(-28, 8, 1.4);
  tree(-30, 22, 1.8);
  tree(29, 12, 1.5);
  tree(27, 28, 1.2);
  tree(-18, 36, 1.6);
  tree(20, 38, 1.3);
  tree(-8, -8, 1.5);
  tree(12, -7, 1.1);

  const gatePillarGeo = new THREE.CylinderGeometry(0.72, 0.86, 9.2, 12);
  function gatePillar(x) {
    const mesh = new THREE.Mesh(gatePillarGeo, stone);
    mesh.position.set(x, 4.6, 130);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 2.1), stoneDark);
    cap.position.set(x, 9.35, 130);
    cap.castShadow = true;
    scene.add(cap);
    registerObstacle(x, 130, 1.05);
  }
  gatePillar(-10.6);
  gatePillar(10.6);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(23.4, 1.15, 1.8), stone);
  lintel.position.set(0, 9.15, 130);
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  scene.add(lintel);

  const inscription = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.15),
    new THREE.MeshBasicMaterial({ map: labelTexture('JUDGMENT'), transparent: true, side: THREE.DoubleSide }),
  );
  inscription.position.set(0, 10.15, 129.05);
  inscription.rotation.y = Math.PI;
  scene.add(inscription);

  const scales = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.06), metal);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), metal);
  stand.position.y = 0.4;
  [-0.9, 0.9].forEach((x) => {
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.45, 0.02), metal);
    chain.position.set(x, -0.22, 0);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.06, 10), metal);
    pan.position.set(x, -0.46, 0);
    scales.add(chain, pan);
  });
  scales.add(beam, stand);
  scales.position.set(0, 8.35, 129.15);
  scene.add(scales);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(36, 8, 0.8), stoneDark);
  backWall.position.set(0, 4, 141.2);
  backWall.receiveShadow = true;
  scene.add(backWall);

  function makePortal(x, z, colors, name) {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.55, 40),
      new THREE.MeshBasicMaterial({
        map: portalTexture(colors.inner, colors.mid),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.07, 10, 40),
      new THREE.MeshStandardMaterial({
        color: colors.ring,
        emissive: colors.ring,
        emissiveIntensity: 0.8,
        roughness: 0.35,
        metalness: 0.4,
      }),
    );
    const rune = new THREE.Mesh(
      new THREE.TorusGeometry(1.86, 0.025, 8, 40),
      new THREE.MeshBasicMaterial({ color: colors.ring, transparent: true, opacity: 0.7 }),
    );
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.5),
      new THREE.MeshBasicMaterial({ map: labelTexture(name, 512, 128), transparent: true, side: THREE.DoubleSide }),
    );
    label.position.y = 2.25;
    group.add(disc, ring, rune, label);
    group.position.set(x, 2.15, z);
    group.rotation.y = Math.PI;
    scene.add(group);
    const light = new THREE.PointLight(colors.light, colors.intensity, 16, 2);
    light.position.set(x, 2.2, z - 0.4);
    scene.add(light);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.35, 8), stoneDark);
    plinth.position.set(x, 0.18, z);
    plinth.castShadow = true;
    scene.add(plinth);
    registerObstacle(x, z, 1.15);
    return { group, disc, ring, rune, light, base: colors.intensity };
  }

  const archLight = new THREE.PointLight(0xd5e2ff, 0.7, 26, 2);
  archLight.position.set(0, 6.2, 127.5);
  scene.add(archLight);

  // Looking toward +Z, world +X sits on the viewer's left.
  const heavenPortal = makePortal(6.3, 136.2, {
    inner: '#fff8e8',
    mid: 'rgba(214, 164, 70, 0.55)',
    ring: 0xf0d39a,
    light: 0xffe1a8,
    intensity: 2.4,
  }, 'HEAVEN');

  const hellPortal = makePortal(-6.3, 136.2, {
    inner: '#ffd0c4',
    mid: 'rgba(140, 24, 18, 0.6)',
    ring: 0xc44838,
    light: 0xff5533,
    intensity: 1.8,
  }, 'HELL');

  const heavenBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 1.35, 16, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe7b8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  heavenBeam.position.set(DAIS.x, 8, DAIS.z);
  heavenBeam.visible = false;
  scene.add(heavenBeam);

  const hellVortex = new THREE.Group();
  hellVortex.position.set(DAIS.x, 0.06, DAIS.z);
  const vortexDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 32),
    new THREE.MeshBasicMaterial({ color: 0x140204, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
  );
  vortexDisc.rotation.x = -Math.PI / 2;
  const vortexRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.055, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xff3b2a }),
  );
  vortexRing.rotation.x = Math.PI / 2;
  const vortexRingB = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.04, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xffb199 }),
  );
  vortexRingB.rotation.x = Math.PI / 2;
  hellVortex.add(vortexDisc, vortexRing, vortexRingB);
  hellVortex.visible = false;
  scene.add(hellVortex);

  const dustCount = 320;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = (Math.random() - 0.5) * 48;
      y = 0.5 + Math.random() * 4.2;
      z = 6 + Math.random() * 136;
    } while (Math.hypot(x, z - 3.2) < 6);
    dustPositions[i * 3] = x;
    dustPositions[i * 3 + 1] = y;
    dustPositions[i * 3 + 2] = z;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xc9d4ea,
      map: pointTexture(),
      size: 0.045,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  scene.add(dust);

  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5.5, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0xf4efe4 }),
  );
  moonMesh.position.set(-32, 26, 96);
  scene.add(moonMesh);

  let effect = null;
  let time = 0;

  function update(dt) {
    time += dt;
    lanterns.forEach((light, index) => {
      light.intensity = 1.15 + Math.sin(time * 2.1 + index * 1.3) * 0.18 + Math.sin(time * 6.5 + index) * 0.04;
    });
    scales.rotation.z = Math.sin(time * 0.55) * 0.07;
    heavenPortal.rune.rotation.z = time * 0.15;
    hellPortal.rune.rotation.z = -time * 0.22;
    heavenPortal.disc.material.opacity = 0.82 + Math.sin(time * 1.4) * 0.12;
    hellPortal.disc.material.opacity = 0.78 + Math.sin(time * 1.8 + 1) * 0.12;

    const dustArray = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i += 1) {
      dustArray[i * 3 + 1] += Math.sin(time + i) * 0.002;
      dustArray[i * 3] += 0.004;
      if (dustArray[i * 3] > 26) dustArray[i * 3] = -26;
    }
    dustGeo.attributes.position.needsUpdate = true;

    if (!effect) {
      heavenBeam.visible = false;
      hellVortex.visible = false;
      heavenPortal.light.intensity = heavenPortal.base;
      hellPortal.light.intensity = hellPortal.base;
      return;
    }

    effect.t += dt;
    const chosenHeaven = effect.type === 'HEAVEN';
    heavenBeam.visible = chosenHeaven;
    hellVortex.visible = !chosenHeaven;
    if (chosenHeaven) {
      heavenBeam.visible = true;
      const fade = Math.min(1, effect.t / 0.4) * Math.max(0, 1 - Math.max(0, effect.t - 2.4) / 0.9);
      heavenBeam.material.opacity = 0.4 * fade;
      heavenBeam.scale.setScalar(1 + Math.sin(time * 3) * 0.03);
      heavenPortal.light.intensity = heavenPortal.base + 3.5 * fade;
      heavenPortal.disc.scale.setScalar(1 + 0.08 * fade);
    } else {
      hellVortex.visible = true;
      const grow = Math.min(1, effect.t / 0.45);
      const fade = Math.max(0, 1 - Math.max(0, effect.t - 2.2) / 0.8);
      hellVortex.scale.set(grow, 1, grow);
      vortexDisc.material.opacity = 0.94 * fade;
      vortexRing.rotation.z += dt * 3.4;
      vortexRingB.rotation.z -= dt * 5;
      hellPortal.light.intensity = hellPortal.base + 3.2 * grow * fade;
      hellPortal.disc.scale.setScalar(1 + 0.1 * grow);
    }
    if (effect.t > 3.4) {
      effect = null;
      heavenPortal.disc.scale.setScalar(1);
      hellPortal.disc.scale.setScalar(1);
    }
  }

  function triggerVerdictEffect(type) {
    effect = { type, t: 0 };
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    scene,
    camera,
    renderer,
    update,
    triggerVerdictEffect,
  };
}
