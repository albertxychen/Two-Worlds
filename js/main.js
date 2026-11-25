import * as THREE from 'three';
import { Soundscape } from './audio.js';
import { Soul } from './soulGenerator.js';
import { createUI } from './ui.js';
import {
  DAIS,
  canOccupy,
  createWorld,
  inJudgmentZone,
  randomPointInCourtyard,
  routeToward,
  tryMove,
} from './world.js';

const SAVE_KEY = 'soul-ledger-v1';
const SPEED = [7.4, 8.73, 10.06, 11.39, 12.73];
const MULT = [1, 1.5, 2, 3];
const LENS_DURATION = [0, 2.6, 4.1, 5.6];
const LENS_COOLDOWN = [0, 22, 15, 10];

const UPGRADES = {
  speed: {
    name: 'Swift Step',
    blurb: 'A longer stride between the court and the gate.',
    max: 4,
    costs: [15, 32, 60, 100],
    details: ['Office pace.', '+18% stride.', '+36% stride.', '+54% stride.', '+72% stride.'],
  },
  lens: {
    name: 'Truth Lens',
    blurb: 'Flares hidden marks. Press T.',
    max: 3,
    costs: [28, 46, 78],
    details: ['Not inscribed.', 'A short flare.', 'A longer flare.', 'A patient flare.'],
  },
  mult: {
    name: 'Coin Rite',
    blurb: 'The office pays more for a clean filing.',
    max: 3,
    costs: [22, 50, 90],
    details: ['Payout ×1.', 'Payout ×1.5.', 'Payout ×2.', 'Payout ×3.'],
  },
};

window.addEventListener('error', (event) => {
  const boot = document.getElementById('boot');
  if (!boot || boot.classList.contains('hidden')) return;
  boot.textContent = 'The ledger failed to open. Reload, or serve this folder with a local web server.';
  console.error(event.error || event.message);
});

const canvas = document.getElementById('game');
const ui = createUI();
const audio = new Soundscape();
const world = createWorld(canvas);
const { scene, camera, renderer } = world;

const player = new THREE.Vector3(0, 0, 3.2);
const velocity = new THREE.Vector3();
const keys = new Set();

const state = {
  started: false,
  coins: 0,
  streak: 0,
  best: 0,
  filed: 0,
  correct: 0,
  speedLevel: 0,
  lensLevel: 0,
  multLevel: 0,
  lensActive: 0,
  lensCooldown: 0,
};

let yaw = 0;
let pitch = -0.05;
let dragging = false;
let lockFailed = false;
let menuTime = 0;
let bobPhase = 0;
let bobX = 0;
let bobY = 0;
let stepTimer = 0;
let bellTimer = 18;
let shake = 0;
let zoneTimer = 0;
let resolving = null;

const waiting = [];
let escort = null;

loadSave();

const clock = new THREE.Clock();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.coins = clampInt(data.coins, 0, 99999);
    state.streak = clampInt(data.streak, 0, 999);
    state.best = clampInt(data.best, 0, 999);
    state.filed = clampInt(data.filed, 0, 99999);
    state.correct = clampInt(data.correct, 0, 99999);
    state.speedLevel = clampInt(data.speedLevel, 0, UPGRADES.speed.max);
    state.lensLevel = clampInt(data.lensLevel, 0, UPGRADES.lens.max);
    state.multLevel = clampInt(data.multLevel, 0, UPGRADES.mult.max);
  } catch {
    // A bad save should not stop the audit.
  }
}

function save() {
  const data = {
    coins: state.coins,
    streak: state.streak,
    best: state.best,
    filed: state.filed,
    correct: state.correct,
    speedLevel: state.speedLevel,
    lensLevel: state.lensLevel,
    multLevel: state.multLevel,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Private mode can refuse storage. The session still plays.
  }
}

function clampInt(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function spawnSoul() {
  const blocked = living().map((soul) => soul.group.position);
  blocked.push(player);
  const point = randomPointInCourtyard(blocked, 5);
  const soul = new Soul(point);
  scene.add(soul.group);
  waiting.push(soul);
  return soul;
}

function living() {
  const list = [...waiting];
  if (escort) list.push(escort);
  if (resolving) list.push(resolving);
  return list;
}

function ensurePopulation() {
  const loose = waiting.length + (escort ? 1 : 0);
  if (loose < 2 && !resolving) spawnSoul();
}

spawnSoul();
spawnSoul();

function playerSpeed() {
  return SPEED[state.speedLevel];
}

function multiplier() {
  return MULT[state.multLevel];
}

function canMove() {
  return state.started && !ui.shopOpen() && !ui.dialogueOpen() && !resolving;
}

function canLook() {
  return state.started && !ui.blocksLook();
}

function horizDist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function nearestWaiting(maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const soul of waiting) {
    const dist = horizDist(player, soul.group.position);
    if (dist < bestDist) {
      best = soul;
      bestDist = dist;
    }
  }
  return best;
}

function soulContext(inZone) {
  return {
    player,
    playerSpeed: playerSpeed(),
    inZone,
    dialogue: ui.dialogueOpen(),
    dais: DAIS,
    tryMove,
    canOccupy,
    route: routeToward,
    pickWander() {
      return randomPointInCourtyard([player, ...living().map((soul) => soul.group.position)], 3);
    },
  };
}

function update(dt) {
  if (!state.started) {
    menuTime += dt;
    yaw = Math.sin(menuTime * 0.13) * 0.22;
    pitch = -0.08 + Math.sin(menuTime * 0.09) * 0.035;
  } else if (canMove()) {
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    // Camera right when facing +Z is world -X, so strafe follows the view.
    const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const wish = new THREE.Vector3();
    if (keys.has('w') || keys.has('arrowup')) wish.add(forward);
    if (keys.has('s') || keys.has('arrowdown')) wish.sub(forward);
    if (keys.has('d') || keys.has('arrowright')) wish.add(right);
    if (keys.has('a') || keys.has('arrowleft')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();
    const speed = playerSpeed();
    velocity.x = THREE.MathUtils.damp(velocity.x, wish.x * speed, 10, dt);
    velocity.z = THREE.MathUtils.damp(velocity.z, wish.z * speed, 10, dt);
    tryMove(player, velocity.x * dt, velocity.z * dt, 0.42);
  } else {
    velocity.x = THREE.MathUtils.damp(velocity.x, 0, 12, dt);
    velocity.z = THREE.MathUtils.damp(velocity.z, 0, 12, dt);
  }

  separateFromSouls();

  const inZone = Boolean(escort) && inJudgmentZone(player.x, player.z) && !resolving;
  const ctx = soulContext(inZone);

  for (const soul of waiting) soul.update(dt, ctx);
  if (escort) {
    escort.update(dt, ctx);
    if (inZone) {
      zoneTimer += dt;
      const dist = horizDist(escort.group.position, DAIS);
      if (zoneTimer > 4.5 && dist > 1.2) {
        escort.group.position.x = DAIS.x;
        escort.group.position.z = DAIS.z;
        if (!escort.drawn) {
          escort.drawn = true;
          ui.toast('The mark draws the soul the last of the way.', 'info');
        }
      }
    } else {
      zoneTimer = 0;
    }
  }
  if (resolving) {
    resolving.update(dt, ctx);
    if (resolving.state === 'gone') {
      scene.remove(resolving.group);
      resolving.dispose();
      resolving = null;
      ensurePopulation();
    }
  }

  if (state.lensActive > 0) {
    state.lensActive -= dt;
    if (state.lensActive <= 0) {
      state.lensActive = 0;
      state.lensCooldown = LENS_COOLDOWN[state.lensLevel];
      living().forEach((soul) => soul.setLens(false));
    }
  } else if (state.lensCooldown > 0) {
    state.lensCooldown = Math.max(0, state.lensCooldown - dt);
  }

  const moving = canMove() && velocity.length() > 1.4;
  if (moving) {
    bobPhase += dt * velocity.length() * 0.95;
    bobY = Math.sin(bobPhase) * 0.028;
    bobX = Math.cos(bobPhase * 0.5) * 0.012;
    stepTimer -= dt;
    if (stepTimer <= 0) {
      audio.footstep();
      stepTimer = THREE.MathUtils.clamp(0.52 - velocity.length() * 0.012, 0.28, 0.52);
    }
  } else {
    bobY = THREE.MathUtils.damp(bobY, 0, 8, dt);
    bobX = THREE.MathUtils.damp(bobX, 0, 8, dt);
  }

  if (state.started) {
    bellTimer -= dt;
    if (bellTimer <= 0) {
      audio.bell();
      bellTimer = 36 + Math.random() * 28;
    }
  }

  shake = Math.max(0, shake - dt * 1.3);
  const eye = camera.position;
  eye.set(player.x + bobX, 1.68 + bobY, player.z);
  const look = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );
  if (shake > 0) {
    look.x += (Math.random() - 0.5) * shake * 0.08;
    look.y += (Math.random() - 0.5) * shake * 0.08;
  }
  camera.lookAt(eye.x + look.x, eye.y + look.y, eye.z + look.z);
  world.update(dt);
  syncHud(inZone);
}

function separateFromSouls() {
  if (!state.started) {
    for (const soul of waiting) {
      const pos = soul.group.position;
      const dx = pos.x - player.x;
      const dz = pos.z - player.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      if (dist < 1.5) tryMove(pos, (dx / dist) * 0.05, (dz / dist) * 0.05, 0.4);
    }
    return;
  }
  const prevX = player.x;
  const prevZ = player.z;
  for (const soul of living()) {
    if (soul.state === 'ascend' || soul.state === 'fall' || soul.state === 'gone') continue;
    const dx = player.x - soul.group.position.x;
    const dz = player.z - soul.group.position.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    if (dist < 0.78) {
      const push = (0.78 - dist) / dist;
      player.x += dx * push;
      player.z += dz * push;
    }
  }
  if (!canOccupy(player.x, player.z, 0.4)) {
    player.x = prevX;
    player.z = prevZ;
  }
}

function syncHud(inZone) {
  const compass = compassReading();
  const near = nearestWaiting(3.1);
  let kicker = 'Open court';
  let objective = 'Find a wandering soul';
  let prompt = near ? `${near.caseLabel}  ·  E  Claim` : 'Search the courtyard';

  if (escort) {
    kicker = escort.caseLabel;
    const atMark = horizDist(escort.group.position, DAIS) < 1.25;
    if (inZone && !atMark) {
      objective = 'The soul is taking the mark';
      prompt = 'Wait at the threshold';
    } else if (inZone && atMark) {
      objective = 'Cast the verdict';
      prompt = '1  Heaven     2  Hell';
    } else {
      objective = 'Escort them to the Judgment Gate';
      prompt = 'Stop to inspect  ·  F  Interrogate';
    }
  }

  if (resolving) {
    kicker = 'Filing';
    objective = 'The ledger takes the name';
    prompt = '';
  }

  let lensText = 'Truth Lens · ready';
  if (state.lensActive > 0) lensText = `Truth Lens · ${state.lensActive.toFixed(1)}s`;
  else if (state.lensCooldown > 0) lensText = `Truth Lens · ${Math.ceil(state.lensCooldown)}s`;

  ui.sync({
    coins: state.coins,
    streak: state.streak,
    best: state.best,
    filed: state.filed,
    multiplier: multiplier(),
    kicker,
    objective,
    prompt: ui.shopOpen() || ui.dialogueOpen() ? '' : prompt,
    compassLabel: compass.label,
    compassAngle: compass.angle,
    lensOwned: state.lensLevel > 0,
    lensHot: state.lensActive > 0,
    lensText,
    showLookHint: state.started && !canLook() ? false : state.started && document.pointerLockElement !== canvas,
    lookHint: lockFailed ? 'Drag to look' : 'Click to look',
    showVerdict: Boolean(escort) && inZone && horizDist(escort.group.position, DAIS) < 1.25 && !ui.shopOpen() && !ui.dialogueOpen() && !resolving,
  });
}

function compassReading() {
  let target = null;
  let label = 'Court';
  if (escort || resolving) {
    target = DAIS;
    label = resolving ? 'Filing' : 'Gate';
  } else if (waiting.length) {
    let best = waiting[0];
    let bestDist = horizDist(player, best.group.position);
    for (const soul of waiting) {
      const dist = horizDist(player, soul.group.position);
      if (dist < bestDist) {
        best = soul;
        bestDist = dist;
      }
    }
    target = best.group.position;
    label = `Soul ${Math.max(1, Math.round(bestDist))}m`;
  }
  if (!target) return { label: '—', angle: 0 };
  const angle = Math.atan2(target.x - player.x, target.z - player.z) - yaw;
  const dist = horizDist(player, target);
  if (escort) label = `Gate ${Math.max(0, Math.round(dist))}m`;
  return { label, angle };
}

function claimSoul() {
  if (!state.started || resolving || ui.shopOpen() || ui.dialogueOpen()) return;
  if (escort) {
    ui.toast('Finish the open case before claiming another.', 'info');
    return;
  }
  const soul = nearestWaiting(3.1);
  if (!soul) {
    ui.toast('No soul within reach.', 'info');
    return;
  }
  waiting.splice(waiting.indexOf(soul), 1);
  escort = soul;
  escort.state = 'follow';
  escort.stuck = 0;
  audio.claim();
  ui.toast(`${soul.caseLabel} claimed. Stop and look. Ask if the body is quiet.`, 'info');
  ensurePopulation();
}

function openDialogue() {
  if (!escort || resolving || ui.shopOpen()) return;
  if (ui.dialogueOpen()) {
    closeDialogue();
    return;
  }
  clearMoveKeys();
  document.exitPointerLock?.();
  ui.openDialogue(escort);
}

function closeDialogue() {
  ui.closeDialogue();
  requestLook();
}

function ask(index) {
  if (!escort || escort.asked[index]) return;
  escort.asked[index] = true;
  const entry = escort.questions[index];
  ui.markAsked(index, entry);
  const pulses = Math.min(7, Math.ceil(entry.a.length / 18));
  for (let i = 0; i < pulses; i += 1) {
    window.setTimeout(() => audio.blip(), i * 70);
  }
}

function judge(choice) {
  if (!escort || resolving) return;
  if (!inJudgmentZone(player.x, player.z)) return;
  if (horizDist(escort.group.position, DAIS) >= 1.25) return;
  if (ui.shopOpen() || ui.dialogueOpen()) return;

  const soul = escort;
  escort = null;
  resolving = soul;
  zoneTimer = 0;
  soul.group.position.x = DAIS.x;
  soul.group.position.z = DAIS.z;
  soul.group.position.y = 0;

  const correct = choice === soul.alignment;
  const evidence = soul.evidenceText();
  let delta = 0;
  if (correct) {
    delta = Math.round((12 + state.streak * 3) * multiplier());
    state.streak += 1;
    state.best = Math.max(state.best, state.streak);
    state.coins += delta;
    state.correct += 1;
    audio.coin(state.streak);
  } else {
    delta = -Math.min(8, state.coins);
    state.coins = Math.max(0, state.coins - 8);
    state.streak = 0;
    audio.wrong();
    shake = Math.max(shake, 0.55);
  }
  state.filed += 1;
  if (choice === 'HEAVEN') {
    audio.heaven();
    ui.flashScreen(correct ? 'heaven' : 'bad');
  } else {
    audio.hell();
    ui.flashScreen('hell');
    shake = Math.max(shake, 0.85);
  }
  world.triggerVerdictEffect(choice);
  soul.beginResolution(choice);
  save();

  const place = choice === 'HEAVEN' ? 'Heaven' : 'Hell';
  const truth = soul.alignment === 'HEAVEN' ? 'Heaven' : 'Hell';
  ui.showResult({
    correct,
    kicker: correct ? 'Entry accepted' : 'Entry corrected',
    title: correct ? `Filed to ${place}` : `Misfiled to ${place}`,
    detail: correct ? `You caught: ${evidence}.` : `Missed clue: ${evidence}. They belonged to ${truth}.`,
    coins: correct
      ? `+${delta} Soul Coins  ·  Streak ${state.streak}`
      : (delta < 0 ? `${delta} Soul Coins  ·  Streak lost` : 'No coins left to lose  ·  Streak lost'),
  });
}

function toggleShop() {
  if (!state.started || resolving) return;
  if (ui.dialogueOpen()) closeDialogue();
  if (ui.shopOpen()) {
    closeShop();
    return;
  }
  clearMoveKeys();
  document.exitPointerLock?.();
  ui.renderShop(shopModel());
}

function closeShop() {
  ui.closeShop();
  requestLook();
}

function shopModel() {
  return {
    coins: state.coins,
    upgrades: Object.entries(UPGRADES).map(([id, upgrade]) => {
      const level = state[`${id}Level`];
      const maxed = level >= upgrade.max;
      const cost = maxed ? 0 : upgrade.costs[level];
      return {
        id,
        name: upgrade.name,
        blurb: upgrade.blurb,
        detail: upgrade.details[level],
        level,
        max: upgrade.max,
        maxed,
        cost,
        affordable: !maxed && state.coins >= cost,
      };
    }),
  };
}

function buy(id) {
  const upgrade = UPGRADES[id];
  if (!upgrade || resolving) return;
  const key = `${id}Level`;
  const level = state[key];
  if (level >= upgrade.max) return;
  const cost = upgrade.costs[level];
  if (state.coins < cost) {
    ui.toast('The ledger declines. Not enough Soul Coins.', 'bad');
    return;
  }
  state.coins -= cost;
  state[key] += 1;
  save();
  audio.buy();
  ui.toast(`${upgrade.name} inscribed.`, 'good');
  if (ui.shopOpen()) ui.renderShop(shopModel());
}

function resetSave() {
  if (!window.confirm('Resign the post and clear coins, streak, and inscriptions?')) return;
  localStorage.removeItem(SAVE_KEY);
  state.coins = 0;
  state.streak = 0;
  state.best = 0;
  state.filed = 0;
  state.correct = 0;
  state.speedLevel = 0;
  state.lensLevel = 0;
  state.multLevel = 0;
  state.lensActive = 0;
  state.lensCooldown = 0;
  living().forEach((soul) => soul.setLens(false));
  save();
  ui.toast('The post is vacant. A new auditor begins at zero.', 'info');
  if (ui.shopOpen()) ui.renderShop(shopModel());
}

function useLens() {
  if (!state.started || state.lensLevel <= 0 || resolving) return;
  if (state.lensActive > 0) return;
  if (state.lensCooldown > 0) {
    ui.toast(`The lens is settling · ${Math.ceil(state.lensCooldown)}s`, 'info');
    return;
  }
  state.lensActive = LENS_DURATION[state.lensLevel];
  living().forEach((soul) => soul.setLens(soul.visuals.size > 0));
  const nearest = escort || nearestWaiting(6);
  if (nearest && nearest.visuals.size > 0) ui.toast('The lens catches on a mark.', 'good');
  else ui.toast('No mark on the nearest soul. Listen instead.', 'info');
  audio.click();
}

function clearMoveKeys() {
  ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].forEach((key) => keys.delete(key));
}

function requestLook() {
  if (!state.started || ui.blocksLook()) return;
  const lock = canvas.requestPointerLock?.();
  if (lock?.catch) {
    lock.catch(() => {
      lockFailed = true;
    });
  }
}

ui.api.onBegin = async () => {
  await audio.start();
  state.started = true;
  yaw = 0;
  pitch = -0.06;
  ui.hideMenu();
  requestLook();
  ui.toast('Two souls are already in the court.', 'info');
};

ui.api.onQuestion = ask;
ui.api.onVerdict = judge;
ui.api.onCloseDialogue = closeDialogue;
ui.api.onCloseShop = closeShop;
ui.api.onBuy = buy;
ui.api.onReset = resetSave;
ui.api.onToggleMute = () => {
  const muted = audio.toggleMute();
  ui.setMuted(muted);
  if (!muted) audio.start();
};

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (event.key === 'Tab' || key === ' ') event.preventDefault();
  if (event.key === 'Tab') {
    if (!event.repeat) toggleShop();
    return;
  }
  keys.add(key);
  if (event.repeat || !state.started) return;
  if (key === 'e') claimSoul();
  if (key === 'f') openDialogue();
  if (key === 't') useLens();
  if (key === 'escape') {
    if (ui.shopOpen()) closeShop();
    else if (ui.dialogueOpen()) closeDialogue();
  }
  if (ui.dialogueOpen() && key >= '1' && key <= '3') ask(Number(key) - 1);
  else if ((key === '1' || key === '2') && escort && !ui.shopOpen() && !ui.dialogueOpen()) {
    judge(key === '1' ? 'HEAVEN' : 'HELL');
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) keys.clear();
});

window.addEventListener('mousemove', (event) => {
  if (!canLook()) return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && !dragging) return;
  yaw -= event.movementX * 0.00215;
  pitch -= event.movementY * 0.00215;
  pitch = THREE.MathUtils.clamp(pitch, -1.2, 1.15);
});

canvas.addEventListener('pointerdown', (event) => {
  if (!state.started || ui.blocksLook()) return;
  dragging = true;
  canvas.focus();
  if (event.button === 0 && document.pointerLockElement !== canvas) requestLook();
});

window.addEventListener('pointerup', () => {
  dragging = false;
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('pointerlockerror', () => {
  lockFailed = true;
});

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
}

ui.ready();
frame();

if (new URLSearchParams(location.search).has('debug')) {
  window.__LEDGER = {
    state,
    player,
    world,
    get yaw() { return yaw; },
    set yaw(value) { yaw = value; },
    get pitch() { return pitch; },
    waiting: () => waiting,
    escort: () => escort,
    resolving: () => resolving,
    claimSoul,
    judge,
    spawnSoul,
    keys,
  };
}
