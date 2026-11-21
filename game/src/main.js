// main.js — LEONIDA PROTOCOL entry point.
// Owns the game state and the loop: title → briefing → play → … → final,
// plus pause/help overlays, free roam, the localStorage save, the camera,
// and the ?demo= attract/test modes that drive the game on autopilot.

import { buildCity, LANDMARKS, WORLD } from "./city.js";
import { createInput } from "./input.js";
import { createPlayer, spawnParkedCars, spawnBoats, maintainTraffic, maintainPeds, maintainPolice, updateActors } from "./actors.js";
import { MISSIONS, startMission, beginMission, updateMission, retryMission } from "./missions.js";
import { createAutopilot } from "./autopilot.js";
import { drawWorld, drawLighting, drawBoat, drawCar, drawPed, drawPlayer, drawObjectiveMarker } from "./render.js";
import { drawHUD, drawTitle, drawBriefing, drawPause, drawHelp, drawFailed, drawFinal } from "./hud.js";
import { sfx } from "./audio.js";

const SAVE_KEY = "leonida-protocol-save-v1";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const input = createInput(canvas);
const autopilot = createAutopilot();

const params = new URLSearchParams(location.search);
const DEMO = params.get("demo"); // story | drive | chase | marina | night

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const state = {
  city: buildCity(),
  player: createPlayer(LANDMARKS.playerStart.x, LANDMARKS.playerStart.y),
  cars: [],
  boats: [],
  peds: [],
  screen: "title",
  helpReturn: "title",
  freeroam: false,
  mission: null,
  missionIdx: 0,
  steps: [],
  stepIdx: 0,
  missionTime: 0,
  storyTime: 0,
  missionsDone: 0,
  money: 0,
  heat: 0,
  wanted: 0,
  bust: 0,
  busted: false,
  policeNear: false,
  marker: null,
  objectiveText: "",
  markedCar: null,
  markedBoat: null,
  lastCar: null,
  muzzle: 0,
  muzzleRange: 0,
  dayPhase: 0.08,
  dayPhaseTarget: 0.08,
  time: 0,
  camera: { x: 2300, y: 1300 },
  toastMsg: "",
  toastT: 0,
  buttons: [],
  mouse: input.mouse,
  save: loadSave(),
  failReason: "",
  storyComplete: false,
  demo: DEMO,
  briefingT: 0,
  failT: 0,
  lastError: "",
  toast(msg) {
    this.toastMsg = msg;
    this.toastT = 3.2;
  },
  saveGame() {
    try {
      const data = {
        money: this.money,
        nextMission: this.storyComplete ? MISSIONS.length - 1 : this.missionIdx + (this.screen === "briefing" ? 0 : 0),
        storyComplete: this.storyComplete,
      };
      if (this.screen === "briefing") data.nextMission = this.missionIdx;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.save = data;
    } catch { /* storage unavailable — the run simply won't persist */ }
  },
};

state.cars = spawnParkedCars(state.city);
state.boats = spawnBoats(state.city);
maintainPeds(state);
maintainTraffic(state);

window.addEventListener("error", (e) => { state.lastError = String(e.message ?? e); });
window.LEONIDA = state;

// ------------------------------------------------------------ flow control

function resetWorldForStory() {
  state.cars = state.cars.filter((c) => c.driver === "parked");
  if (state.markedCar) state.markedCar = null;
  if (state.markedBoat) { state.markedBoat.marked = false; state.markedBoat = null; }
  const p = state.player;
  p.mode = "foot"; p.car = null; p.boat = null;
  p.x = LANDMARKS.playerStart.x; p.y = LANDMARKS.playerStart.y;
  state.heat = 0; state.wanted = 0; state.bust = 0; state.busted = false;
}

function startStory(fromMission = 0, keepMoney = false) {
  resetWorldForStory();
  if (!keepMoney) state.money = 0;
  state.missionsDone = fromMission;
  state.storyTime = 0;
  state.storyComplete = false;
  state.freeroam = false;
  startMission(state, fromMission);
}

function enterFreeroam() {
  state.freeroam = true;
  state.mission = null;
  state.steps = [];
  state.marker = null;
  state.objectiveText = "Explore Port Leonida — the city is yours";
  state.screen = "play";
}

function activate(id) {
  sfx.click();
  switch (id) {
    case "start": startStory(0); break;
    case "continue":
      if (state.save?.storyComplete) { state.money = state.save.money; enterFreeroam(); }
      else { state.money = state.save?.money ?? 0; startStory(state.save?.nextMission ?? 0, true); }
      break;
    case "freeroam": enterFreeroam(); break;
    case "help": state.helpReturn = state.screen; state.screen = "help"; break;
    case "back": state.screen = state.helpReturn === "help" ? "title" : state.helpReturn; break;
    case "roll": beginMission(state); break;
    case "resume": state.screen = "play"; break;
    case "retry": retryMission(state); break;
    case "quit-title":
      state.screen = "title";
      state.heat = 0; state.wanted = 0; state.marker = null;
      state.dayPhaseTarget = 0.08;
      break;
  }
}

// ------------------------------------------------------------ input → ctl

function humanCtl() {
  return {
    up: input.down("KeyW", "ArrowUp"),
    down: input.down("KeyS", "ArrowDown"),
    left: input.down("KeyA", "ArrowLeft"),
    right: input.down("KeyD", "ArrowRight"),
    run: input.down("ShiftLeft", "ShiftRight"),
    interact: input.pressed("KeyE"),
    shoot: input.down("KeyF"),
  };
}
const IDLE_CTL = { up: false, down: false, left: false, right: false, run: false, interact: false, shoot: false };

function handleScreenKeys() {
  if (input.mouse.clicked && state.buttons.length) {
    const { clickX: mx, clickY: my } = input.mouse;
    for (const b of state.buttons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { activate(b.id); return; }
    }
  }
  switch (state.screen) {
    case "title":
      if (input.pressed("Enter")) activate("start");
      break;
    case "briefing":
      if (input.pressed("Enter")) activate("roll");
      break;
    case "play":
      if (input.pressed("KeyP") || input.pressed("Escape")) { state.screen = "paused"; }
      else if (input.pressed("KeyH")) { state.helpReturn = "play"; state.screen = "help"; }
      break;
    case "paused":
      if (input.pressed("KeyP") || input.pressed("Escape") || input.pressed("Enter")) state.screen = "play";
      break;
    case "help":
      if (input.pressed("Escape") || input.pressed("Enter")) activate("back");
      break;
    case "failed":
      if (input.pressed("KeyR")) activate("retry");
      break;
    case "final":
      if (input.pressed("KeyF")) activate("freeroam");
      else if (input.pressed("Enter")) activate("quit-title");
      break;
  }
}

// ------------------------------------------------------------ update

function ambient(dt) {
  updateActors(state, dt, IDLE_CTL);
  maintainTraffic(state);
  maintainPeds(state);
  maintainPolice(state);
}

function update(dt) {
  state.time += dt;
  state.toastT = Math.max(0, state.toastT - dt);
  state.dayPhase += (state.dayPhaseTarget - state.dayPhase) * Math.min(1, dt * 0.35);
  handleScreenKeys();

  if (state.screen === "title") {
    ambient(dt);
    const t = state.time;
    state.camera.x += ((2350 + Math.sin(t * 0.045) * 950) - state.camera.x) * Math.min(1, dt * 0.8);
    state.camera.y += ((1350 + Math.cos(t * 0.033) * 520) - state.camera.y) * Math.min(1, dt * 0.8);
    return;
  }
  if (state.screen === "briefing") {
    ambient(dt);
    followCamera(dt);
    if (state.demo) {
      state.briefingT += dt;
      if (state.briefingT > 0.9) { state.briefingT = 0; beginMission(state); }
    }
    return;
  }
  if (state.screen === "failed") {
    if (state.demo) {
      state.failT += dt;
      if (state.failT > 1.4) { state.failT = 0; retryMission(state); }
    }
    return;
  }
  if (state.screen !== "play") {
    if (state.screen === "final") ambient(dt);
    return;
  }

  // --- play ---
  const ctl = state.demo ? autopilot.update(state, dt) : humanCtl();
  updateActors(state, dt, ctl);
  maintainTraffic(state);
  maintainPeds(state);
  maintainPolice(state);

  // heat cools when no police are close (never below the mission's floor)
  if (!state.policeNear) {
    const floor = state.freeroam ? 0 : (state.mission?.heatFloor ?? 0) * 0.7;
    state.heat = Math.max(floor, state.heat - dt * 0.055);
    state.wanted = Math.ceil(state.heat);
  }
  if (!state.freeroam) {
    state.storyTime += dt;
    updateMission(state, dt);
  }
  followCamera(dt);
}

function followCamera(dt) {
  const p = state.player;
  const k = Math.min(1, dt * 5);
  state.camera.x += (p.x - state.camera.x) * k;
  state.camera.y += (p.y - state.camera.y) * k;
}

// ------------------------------------------------------------ draw

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function draw() {
  const view = { width: canvas.width, height: canvas.height };
  const cam = state.camera;
  cam.x = view.width >= WORLD.w ? WORLD.w / 2 : Math.max(view.width / 2, Math.min(WORLD.w - view.width / 2, cam.x));
  cam.y = view.height >= WORLD.h ? WORLD.h / 2 : Math.max(view.height / 2, Math.min(WORLD.h - view.height / 2, cam.y));

  state.buttons = [];
  // world pass: the context is translated so the camera centre sits in the
  // middle of the screen, and render.js gets the world-space viewport
  const wv = { x: cam.x - view.width / 2, y: cam.y - view.height / 2, w: view.width, h: view.height };
  ctx.save();
  ctx.translate(-wv.x, -wv.y);
  drawWorld(ctx, state, wv);
  for (const boat of state.boats) drawBoat(ctx, boat);
  for (const ped of state.peds) drawPed(ctx, ped, state);
  for (const car of state.cars) drawCar(ctx, car, state);
  drawPlayer(ctx, state);
  if (state.screen === "play" || state.screen === "paused") drawObjectiveMarker(ctx, state);
  drawLighting(ctx, state, wv);
  ctx.restore();
  if (state.screen !== "title") drawHUD(ctx, state, view);

  switch (state.screen) {
    case "title": drawTitle(ctx, state, view); break;
    case "briefing": drawBriefing(ctx, state, view); break;
    case "paused": drawPause(ctx, state, view); break;
    case "help": drawHelp(ctx, state, view); break;
    case "failed": drawFailed(ctx, state, view); break;
    case "final": drawFinal(ctx, state, view); break;
  }
}

// ------------------------------------------------------------ demo boot

if (DEMO) {
  const startAt = { story: 0, drive: 0, chase: 2, marina: 3, night: 4 }[DEMO] ?? 0;
  state.money = startAt * 500;
  startStory(startAt, true);
}

// ------------------------------------------------------------ loop

let last = performance.now();
function frame(now) {
  const rawDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const scale = state.demo === "story" ? 2.4 : state.demo ? 1.7 : 1;
  let dt = rawDt * scale;
  while (dt > 0) {
    const step = Math.min(dt, 1 / 30);
    update(step);
    dt -= step;
  }
  draw();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
