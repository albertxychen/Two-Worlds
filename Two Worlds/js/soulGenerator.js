import * as THREE from 'three';

// Appearance is randomized independently of alignment.
// Every soul carries 1–2 clues. Hell souls are sometimes unmarked
// (dialogue only) and sometimes well-spoken (visual only).

const ROBES = [0x8d93a3, 0x6e7c86, 0x9a8f88, 0x7f8c9b, 0xa39890, 0x6c7580, 0x8a8494, 0x758078, 0x90897f];
const BONES = [0xddd4c8, 0xd2c6b8, 0xe4dcd2, 0xcfc3b6, 0xe8e0d6];

const VISUAL_TEXT = {
  horns: 'stubby red horns',
  redEyes: 'glowing red eyes',
  tail: 'a pointed tail',
  redAura: 'a faint red aura',
  halo: 'a faint golden halo',
  blueAura: 'a pale blue aura',
};

const HELL_VISUALS = ['horns', 'redEyes', 'tail', 'redAura'];
const HEAVEN_VISUALS = ['halo', 'blueAura'];

const QUESTIONS = [
  'What was your biggest regret?',
  'How did you treat the people around you?',
  'Why do you think you are here?',
];

const HELL_SLIPS = [
  [
    { a: 'I regret that the fire was seen from the road.', label: 'regretted that the fire was seen' },
    { a: 'My only regret is leaving a witness.', label: 'regretted leaving a witness' },
    { a: 'I should have buried the ledger before they asked for it.', label: 'tried to hide a crooked ledger' },
  ],
  [
    { a: "I only took what wasn't nailed down.", label: "took what wasn't nailed down" },
    { a: 'People were levers. You learn where to push.', label: 'spoke of people as levers' },
    { a: 'I smiled at them. It made the taking easier.', label: 'smiled to make the taking easier' },
  ],
  [
    { a: 'Fire always fascinated me. It solves arguments.', label: 'admitted fire solves arguments' },
    { a: 'I am here because the last door I opened was not mine.', label: 'opened a door that was not theirs' },
    { a: 'I kept lists of everyone who slighted me, and I settled them.', label: 'settled a list of slights' },
  ],
];

const HELL_COVERS = [
  [
    { a: 'I wish I had traveled. I stayed home. That is all.' },
    { a: 'I cannot remember a single loud mistake.' },
    { a: 'Regret is a strong word. I feel mostly tired.' },
  ],
  [
    { a: 'I nodded to my neighbors and meant it most days.' },
    { a: 'I was quiet at gatherings. No one complained.' },
    { a: 'I paid what I owed and kept my voice down.' },
  ],
  [
    { a: 'I lived a long time and then I did not. That is the whole reason.' },
    { a: 'I think there has been a clerical error, but I will walk.' },
    { a: 'I am here because everyone is here, eventually.' },
  ],
];

const HEAVEN_KIND = [
  [
    { a: 'I wish I had written my sister while the ink was still wet.', label: 'an unsent letter to their sister' },
    { a: "I promised the baker's boy I would see his recital. I died on the way.", label: 'died keeping a small promise' },
    { a: 'I never broke a promise, even the small ones.', label: 'never broke a promise' },
  ],
  [
    { a: 'I miss my stray dogs. I still hope someone feeds them.', label: 'misses the stray dogs' },
    { a: 'I kept a chair at the table for anyone who knocked.', label: 'kept a chair for strangers' },
    { a: 'I stayed late so the night nurse could sit down.', label: 'stayed so a nurse could rest' },
  ],
  [
    { a: 'I am here because the road ended. I tried to walk it kindly.', label: 'tried to walk the road kindly' },
    { a: 'Someone should have told my neighbor her cat came home. I did, and then I went.', label: 'went out of their way for a neighbor' },
    { a: 'I gave what I could spare, and sometimes what I could not.', label: 'gave more than they could spare' },
  ],
];

const HEAVEN_NEUTRAL = [
  [
    { a: 'I worked, I ate, I slept. The regrets are small and blurred.' },
    { a: 'I suppose I was impatient in queues. That is the worst of it.' },
    { a: 'Nothing dramatic. A life of average weather.' },
  ],
  [
    { a: 'I treated people decently enough, as far as memory serves.' },
    { a: 'I kept to myself. It seemed polite.' },
    { a: 'I did my job and left other people to theirs.' },
  ],
  [
    { a: "I am here because I died. I don't have a speech prepared." },
    { a: "Everyone arrives, don't they? I arrived." },
    { a: 'I followed the others. The road was the only one there.' },
  ],
];

let pointSprite = null;

function pointTexture() {
  if (pointSprite) return pointSprite;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  pointSprite = new THREE.CanvasTexture(canvas);
  return pointSprite;
}

const geos = {
  robe: new THREE.CylinderGeometry(0.2, 0.46, 1.18, 12),
  head: new THREE.SphereGeometry(0.22, 20, 16),
  neck: new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8),
  arm: new THREE.CapsuleGeometry(0.055, 0.42, 3, 6),
  foot: new THREE.SphereGeometry(0.07, 10, 8),
  horn: new THREE.ConeGeometry(0.055, 0.2, 6),
  tail: new THREE.ConeGeometry(0.045, 0.42, 6),
  halo: new THREE.TorusGeometry(0.3, 0.018, 8, 28),
  collar: new THREE.TorusGeometry(0.16, 0.03, 6, 14),
  satchel: new THREE.BoxGeometry(0.16, 0.18, 0.08),
  eye: new THREE.SphereGeometry(0.028, 8, 8),
  eyeGlow: new THREE.SphereGeometry(0.05, 8, 8),
};

let serial = 140 + Math.floor(Math.random() * 500);

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickN(list, n) {
  const copy = [...list];
  const out = [];
  for (let i = 0; i < n && copy.length; i += 1) {
    const index = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(index, 1)[0]);
  }
  return out;
}

function rollMode() {
  const roll = Math.random();
  if (roll < 0.4) return 'visual';
  if (roll < 0.8) return 'dialogue';
  return 'both';
}

export function generateProfile() {
  const alignment = Math.random() < 0.5 ? 'HEAVEN' : 'HELL';
  const mode = rollMode();
  const pool = alignment === 'HELL' ? HELL_VISUALS : HEAVEN_VISUALS;
  let visualCount = 0;
  if (mode === 'visual') visualCount = Math.random() < 0.35 ? 2 : 1;
  if (mode === 'both') visualCount = 1;
  visualCount = Math.min(visualCount, pool.length);
  const visuals = pickN(pool, visualCount);

  let slipCount = 0;
  if (alignment === 'HELL' && mode === 'dialogue') slipCount = 2;
  if (alignment === 'HELL' && mode === 'both') slipCount = 1;
  const slipSet = new Set(pickN([0, 1, 2], slipCount));
  const kind = alignment === 'HEAVEN' && mode !== 'visual';

  const evidence = visuals.map((id) => VISUAL_TEXT[id]);
  const questions = QUESTIONS.map((prompt, index) => {
    let line;
    if (alignment === 'HELL') {
      line = slipSet.has(index) ? pick(HELL_SLIPS[index]) : pick(HELL_COVERS[index]);
    } else {
      line = kind ? pick(HEAVEN_KIND[index]) : pick(HEAVEN_NEUTRAL[index]);
    }
    if (line.label) evidence.push(line.label);
    return {
      q: prompt,
      a: line.a,
      slip: Boolean(line.label) && alignment === 'HELL',
    };
  });

  return { alignment, visuals, questions, evidence, mode };
}

function tagMaterial(material, baseOpacity = material.opacity ?? 1) {
  material.userData.baseOpacity = baseOpacity;
  material.userData.baseEmissiveIntensity = material.emissiveIntensity ?? 1;
  return material;
}

export class Soul {
  constructor(position) {
    this.profile = generateProfile();
    this.alignment = this.profile.alignment;
    this.questions = this.profile.questions;
    this.evidence = this.profile.evidence;
    this.visuals = new Set(this.profile.visuals);
    this.caseId = serial;
    serial += 1 + Math.floor(Math.random() * 3);
    this.asked = [false, false, false];

    this.group = new THREE.Group();
    this.group.name = `Case ${this.caseId}`;
    this.group.position.set(position.x, 0, position.z);

    this.bob = new THREE.Group();
    this.group.add(this.bob);

    this.state = 'wander';
    this.wander = null;
    this.wanderTime = 0;
    this.wait = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.yaw = Math.random() * Math.PI * 2;
    this.walking = false;
    this.resolveT = 0;
    this.lens = false;
    this.stuck = 0;
    this.clueMats = [];
    this.aura = null;

    this._build();
  }

  get caseLabel() {
    return `Case ${String(this.caseId).padStart(4, '0')}`;
  }

  evidenceText() {
    return this.evidence.slice(0, 2).join(' & ');
  }

  setLens(active) {
    this.lens = active;
    for (const entry of this.clueMats) {
      const material = entry.material;
      material.emissiveIntensity = active ? entry.lensIntensity : entry.baseIntensity;
      if (entry.lensOpacity != null) {
        material.opacity = active ? entry.lensOpacity : entry.baseOpacity;
      }
      if (entry.lensColor != null) {
        material.color.setHex(active ? entry.lensColor : entry.baseColor);
      }
    }
    if (this.auraMat) {
      this.auraMat.opacity = active ? Math.min(1, this.auraBaseOpacity * 2.1) : this.auraBaseOpacity;
      this.auraMat.size = active ? this.auraBaseSize * 2.1 : this.auraBaseSize;
    }
    if (this.eyeGlows) {
      const scale = active ? 1.7 : 1;
      this.eyeGlows.forEach((glow) => glow.scale.setScalar(scale));
    }
  }

  beginResolution(choice) {
    this.setLens(false);
    this.state = choice === 'HEAVEN' ? 'ascend' : 'fall';
    this.resolveT = 0;
    this.walking = false;
  }

  update(dt, ctx) {
    this.phase += dt;
    if (this.state === 'ascend' || this.state === 'fall' || this.state === 'gone') {
      this._updateResolution(dt);
      this._animateBody(dt);
      return;
    }

    if (this.state === 'wander') this._updateWander(dt, ctx);
    else if (this.state === 'follow') this._updateFollow(dt, ctx);
    else if (this.state === 'dais') this._updateDais(dt, ctx);

    this.group.rotation.y = dampAngle(this.group.rotation.y, this.yaw, dt, 7);
    this._animateBody(dt);
    this._animateAura();
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj.material) {
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        list.forEach((material) => material.dispose());
      }
      if (obj.geometry?.userData.owned) obj.geometry.dispose();
    });
  }

  _updateWander(dt, ctx) {
    if (!this.wander) this.wander = ctx.pickWander();
    this.wanderTime += dt;
    if (this.wait > 0) {
      this.wait -= dt;
      this.walking = false;
      this.yaw += Math.sin(this.phase * 0.35) * dt * 0.15;
      return;
    }
    const dx = this.wander.x - this.group.position.x;
    const dz = this.wander.z - this.group.position.z;
    if (Math.hypot(dx, dz) < 0.45 || this.wanderTime > 8) {
      this.wait = 1.1 + Math.random() * 2.4;
      this.wander = ctx.pickWander();
      this.wanderTime = 0;
      this.walking = false;
      return;
    }
    const moved = this._stepToward(this.wander.x, this.wander.z, 1.15, dt, ctx);
    if (!moved) this.wanderTime += dt * 3;
  }

  _updateFollow(dt, ctx) {
    if (ctx.inZone) {
      this.state = 'dais';
      this.stuck = 0;
      return;
    }
    const pos = this.group.position;
    const player = ctx.player;
    const dist = Math.hypot(player.x - pos.x, player.z - pos.z);
    if (dist > 12 || (dist > 5 && this.stuck > 1.25)) {
      const gate = ctx.route(pos, player);
      const direct = Math.hypot(gate.x - player.x, gate.z - player.z) < 0.08;
      if (!direct && ctx.canOccupy(gate.x, gate.z, 0.4)) {
        pos.x = gate.x;
        pos.z = gate.z;
      } else if (direct) {
        const dx = pos.x - player.x || 0.2;
        const dz = pos.z - player.z || 0.2;
        const len = Math.hypot(dx, dz) || 1;
        const sx = player.x + (dx / len) * 1.8;
        const sz = player.z + (dz / len) * 1.8;
        if (ctx.canOccupy(sx, sz, 0.4)) {
          pos.x = sx;
          pos.z = sz;
        }
      }
      this.stuck = 0;
    }
    if (ctx.dialogue) this._faceToward(player.x, player.z, dt);

    if (dist > 2.05) {
      const chase = ctx.route(pos, player);
      let tx = chase.x;
      let tz = chase.z;
      const direct = Math.hypot(chase.x - player.x, chase.z - player.z) < 0.08;
      if (direct) {
        const dx = pos.x - player.x;
        const dz = pos.z - player.z;
        const len = Math.hypot(dx, dz) || 1;
        tx = player.x + (dx / len) * 1.7;
        tz = player.z + (dz / len) * 1.7;
      }
      const speed = dist > 6 ? ctx.playerSpeed + 3.4 : Math.max(4.4, ctx.playerSpeed + 1);
      const moved = this._stepToward(tx, tz, speed, dt, ctx);
      this.stuck = moved ? 0 : this.stuck + dt;
    } else {
      this.walking = false;
      this.stuck = 0;
      if (ctx.dialogue) this._faceToward(player.x, player.z, dt);
    }
  }

  _updateDais(dt, ctx) {
    if (!ctx.inZone) {
      this.state = 'follow';
      this.stuck = 0;
      return;
    }
    const dais = ctx.dais;
    const dist = Math.hypot(dais.x - this.group.position.x, dais.z - this.group.position.z);
    if (dist > 0.35) {
      const gate = ctx.route(this.group.position, dais);
      this._stepToward(gate.x, gate.z, 4.6, dt, ctx);
    } else {
      this.walking = false;
      if (ctx.dialogue) this._faceToward(ctx.player.x, ctx.player.z, dt);
      else this.yaw = dampAngle(this.yaw, 0, dt, 4);
    }
  }

  _stepToward(tx, tz, speed, dt, ctx) {
    const pos = this.group.position;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.04) {
      this.walking = false;
      return false;
    }
    const step = Math.min(dist, speed * dt);
    const moved = ctx.tryMove(pos, (dx / dist) * step, (dz / dist) * step, 0.38);
    this.walking = moved;
    if (moved) this.yaw = Math.atan2(dx, dz);
    return moved;
  }

  _faceToward(x, z, dt) {
    this.yaw = dampAngle(this.yaw, Math.atan2(x - this.group.position.x, z - this.group.position.z), dt, 6);
  }

  _updateResolution(dt) {
    this.resolveT += dt;
    if (this.state === 'ascend') {
      this.group.position.y = this.resolveT * 1.45;
      this.yaw += dt * 0.35;
      this._setFade(Math.max(0, 1 - this.resolveT / 3.15));
      if (this.resolveT > 3.25) this.state = 'gone';
    } else if (this.state === 'fall') {
      this.group.position.y = -Math.min(2.6, this.resolveT * 1.05);
      this.yaw += dt * 2.4;
      this._setFade(Math.max(0, 1 - Math.max(0, this.resolveT - 0.25) / 2.3));
      if (this.resolveT > 2.9) this.state = 'gone';
    }
  }

  _setFade(amount) {
    this.group.traverse((obj) => {
      if (!obj.material) return;
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of list) {
        const base = material.userData.baseOpacity ?? 1;
        material.transparent = true;
        material.opacity = base * amount;
      }
    });
    if (this.light) this.light.intensity = 0.35 * amount;
  }

  _animateBody(dt) {
    const moving = this.walking;
    const swing = Math.sin(this.phase * (moving ? 7.2 : 1.4)) * (moving ? 0.55 : 0.06);
    if (this.armL) this.armL.rotation.x = swing;
    if (this.armR) this.armR.rotation.x = -swing;
    const step = moving ? Math.abs(Math.sin(this.phase * 7.2)) : 0;
    if (this.footL) this.footL.position.z = 0.05 + Math.sin(this.phase * 7.2) * 0.08;
    if (this.footR) this.footR.position.z = 0.05 - Math.sin(this.phase * 7.2) * 0.08;
    this.bob.position.y = Math.sin(this.phase * (moving ? 7.2 : 1.6)) * (moving ? 0.035 : 0.02) + step * 0.01;
    this.bob.rotation.z = Math.sin(this.phase * (moving ? 3.6 : 0.8)) * (moving ? 0.03 : 0.012);
    if (this.halo) this.halo.rotation.z += dt * 0.35;
  }

  _animateAura() {
    if (!this.aura) return;
    const array = this.aura.geometry.attributes.position.array;
    for (let i = 0; i < this.auraCount; i += 1) {
      const angle = this.phase * this.auraSpeed + this.auraSeed[i];
      array[i * 3] = Math.cos(angle) * this.auraRadius[i];
      array[i * 3 + 1] = this.auraBaseY[i] + Math.sin(this.phase * 2 + i) * 0.07;
      array[i * 3 + 2] = Math.sin(angle) * this.auraRadius[i];
    }
    this.aura.geometry.attributes.position.needsUpdate = true;
  }

  _build() {
    const robeColor = new THREE.Color(pick(ROBES));
    robeColor.offsetHSL((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.05);
    const bone = new THREE.Color(pick(BONES));
    const stature = 0.92 + Math.random() * 0.2;
    this.bob.scale.setScalar(stature);

    const robeMat = tagMaterial(new THREE.MeshStandardMaterial({
      color: robeColor,
      roughness: 0.86,
      metalness: 0.02,
    }));
    const boneMat = tagMaterial(new THREE.MeshStandardMaterial({
      color: bone,
      roughness: 0.72,
      metalness: 0.01,
    }));

    const robe = new THREE.Mesh(geos.robe, robeMat);
    robe.position.y = 0.62;
    robe.castShadow = true;
    robe.receiveShadow = true;
    this.bob.add(robe);

    const neck = new THREE.Mesh(geos.neck, boneMat);
    neck.position.y = 1.26;
    neck.castShadow = true;
    this.bob.add(neck);

    const head = new THREE.Mesh(geos.head, boneMat);
    head.position.y = 1.52;
    head.scale.set(0.96 + Math.random() * 0.1, 1.02, 0.98);
    head.castShadow = true;
    this.bob.add(head);

    if (Math.random() < 0.55) {
      const collar = new THREE.Mesh(geos.collar, robeMat);
      collar.position.y = 1.18;
      collar.rotation.x = Math.PI / 2;
      this.bob.add(collar);
    }

    this.armL = this._arm(-1, robeMat);
    this.armR = this._arm(1, robeMat);
    this.bob.add(this.armL, this.armR);

    this.footL = new THREE.Mesh(geos.foot, boneMat);
    this.footR = new THREE.Mesh(geos.foot, boneMat);
    this.footL.position.set(-0.12, 0.06, 0.05);
    this.footR.position.set(0.12, 0.06, 0.05);
    this.bob.add(this.footL, this.footR);

    if (Math.random() < 0.4) {
      const satchelMat = tagMaterial(new THREE.MeshStandardMaterial({ color: 0x5c5348, roughness: 0.9 }));
      const satchel = new THREE.Mesh(geos.satchel, satchelMat);
      satchel.position.set(0.02, -0.34, 0.08);
      this.armL.add(satchel);
    }

    this._addEyes(head);
    for (const visual of this.visuals) {
      if (visual === 'horns') this._addHorns(head);
      if (visual === 'tail') this._addTail();
      if (visual === 'halo') this._addHalo();
      if (visual === 'redAura') this._addAura(true);
      if (visual === 'blueAura') this._addAura(false);
    }

    this.light = new THREE.PointLight(0xd7e2ff, 0.38, 5.5, 2);
    this.light.position.set(0, 1.4, 0.2);
    this.group.add(this.light);
  }

  _arm(side, material) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.32, 1.18, 0);
    const limb = new THREE.Mesh(geos.arm, material);
    limb.position.y = -0.28;
    limb.castShadow = true;
    pivot.add(limb);
    return pivot;
  }

  _addEyes(head) {
    const evil = this.visuals.has('redEyes');
    const mat = tagMaterial(new THREE.MeshStandardMaterial({
      color: evil ? 0x2a0508 : 0xd5dbe6,
      emissive: evil ? 0xff1e2a : 0x242a36,
      emissiveIntensity: evil ? 0.9 : 0.35,
      roughness: 0.35,
    }));
    if (evil) {
      this._registerClue(mat, { lensIntensity: 3.2, baseIntensity: 0.9 });
    }
    const left = new THREE.Mesh(geos.eye, mat);
    const right = new THREE.Mesh(geos.eye, mat);
    left.position.set(-0.075, 0.025, 0.2);
    right.position.set(0.075, 0.025, 0.2);
    head.add(left, right);

    if (evil) {
      const glowMat = tagMaterial(new THREE.MeshBasicMaterial({
        color: 0xff2233,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      this._registerClue(glowMat, { lensOpacity: 0.95, baseOpacity: 0.55, lensIntensity: 1, baseIntensity: 1 });
      const glowL = new THREE.Mesh(geos.eyeGlow, glowMat);
      const glowR = new THREE.Mesh(geos.eyeGlow, glowMat);
      glowL.position.copy(left.position);
      glowR.position.copy(right.position);
      head.add(glowL, glowR);
      this.eyeGlows = [glowL, glowR];
    }
  }

  _addHorns(head) {
    const mat = tagMaterial(new THREE.MeshStandardMaterial({
      color: 0x5a1522,
      emissive: 0x8d1c2c,
      emissiveIntensity: 0.45,
      roughness: 0.55,
    }));
    this._registerClue(mat, { lensIntensity: 2.4, baseIntensity: 0.45 });
    const left = new THREE.Mesh(geos.horn, mat);
    const right = new THREE.Mesh(geos.horn, mat);
    left.position.set(-0.13, 0.18, -0.04);
    right.position.set(0.13, 0.18, -0.04);
    left.rotation.z = 0.85;
    right.rotation.z = -0.85;
    left.rotation.x = -0.25;
    right.rotation.x = -0.25;
    head.add(left, right);
  }

  _addTail() {
    const mat = tagMaterial(new THREE.MeshStandardMaterial({
      color: 0x4a1018,
      emissive: 0x7a1824,
      emissiveIntensity: 0.4,
      roughness: 0.5,
    }));
    this._registerClue(mat, { lensIntensity: 2.2, baseIntensity: 0.4 });
    const tail = new THREE.Mesh(geos.tail, mat);
    tail.position.set(0.14, 0.26, -0.55);
    tail.rotation.x = Math.PI * 0.58;
    tail.rotation.z = -0.65;
    tail.castShadow = true;
    this.bob.add(tail);
  }

  _addHalo() {
    const mat = tagMaterial(new THREE.MeshBasicMaterial({
      color: 0xe4c27a,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    this._registerClue(mat, {
      lensOpacity: 0.95,
      baseOpacity: 0.42,
      lensColor: 0xfff3c8,
      baseColor: 0xe4c27a,
      lensIntensity: 1,
      baseIntensity: 1,
    });
    this.halo = new THREE.Mesh(geos.halo, mat);
    this.halo.position.y = 1.86;
    this.halo.rotation.x = Math.PI / 2;
    this.bob.add(this.halo);
  }

  _addAura(evil) {
    const count = 26;
    const positions = new Float32Array(count * 3);
    const seeds = [];
    const radii = [];
    const baseY = [];
    for (let i = 0; i < count; i += 1) {
      seeds.push(Math.random() * Math.PI * 2);
      radii.push(0.28 + Math.random() * (evil ? 0.38 : 0.28));
      baseY.push(0.35 + Math.random() * 1.25);
      positions[i * 3 + 1] = baseY[i];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.userData.owned = true;
    const material = new THREE.PointsMaterial({
      color: evil ? 0xff3344 : 0xd5ecff,
      map: pointTexture(),
      size: evil ? 0.16 : 0.13,
      transparent: true,
      opacity: evil ? 0.5 : 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    material.userData.baseOpacity = material.opacity;
    this.aura = new THREE.Points(geometry, material);
    this.auraMat = material;
    this.auraBaseOpacity = material.opacity;
    this.auraBaseSize = material.size;
    this.auraCount = count;
    this.auraSeed = seeds;
    this.auraRadius = radii;
    this.auraBaseY = baseY;
    this.auraSpeed = evil ? 1.4 : 0.7;
    this.bob.add(this.aura);
  }

  _registerClue(material, opts) {
    this.clueMats.push({
      material,
      baseIntensity: opts.baseIntensity ?? material.emissiveIntensity ?? 1,
      lensIntensity: opts.lensIntensity ?? 2,
      baseOpacity: opts.baseOpacity ?? material.userData.baseOpacity,
      lensOpacity: opts.lensOpacity ?? null,
      baseColor: opts.baseColor ?? null,
      lensColor: opts.lensColor ?? null,
    });
  }
}

function dampAngle(current, target, dt, lambda) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * dt));
}
