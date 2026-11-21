// actors.js — the living city of LEONIDA PROTOCOL.
// The player (on foot, driving, or boating), traffic that drives the road
// graph, pedestrians who wander and flee, and police who answer the wanted
// level. All physics is small arcade math with circle-vs-building collision.

import { WORLD, isSolidGround, isWater, hitsBuilding, route, nearestNode } from "./city.js";
import { sfx } from "./audio.js";

export const CAR_COLORS = ["#ff8c69", "#2ec4b6", "#f7a8b8", "#ffd23f", "#a8d8ea", "#ff6b4a", "#b8e6c9", "#e6c3f0", "#fff3e0", "#7fc7bd"];
const SHIRTS = ["#ffd23f", "#2ec4b6", "#f7a8b8", "#a8d8ea", "#ff8c69", "#b8e6c9", "#fff3e0", "#e6c3f0"];

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function angleTurn(current, target, maxStep) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + clamp(d, -maxStep, maxStep);
}

// ------------------------------------------------------------ factories

export function createPlayer(x, y) {
  return { x, y, angle: -Math.PI / 2, mode: "foot", car: null, boat: null, moving: false, shootCd: 0 };
}

export function makeCar(x, y, angle, opts = {}) {
  return {
    kind: "car", x, y, angle, speed: 0,
    color: opts.color ?? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    convertible: opts.convertible ?? Math.random() < 0.3,
    police: opts.police ?? false,
    marked: opts.marked ?? false,
    driver: opts.driver ?? "parked",
    health: 100, smoke: 0, wrecked: false,
    path: null, pathI: 0, cruise: 140 + Math.random() * 70,
    id: Math.random().toString(36).slice(2),
  };
}

export function spawnParkedCars(city) {
  const cars = city.parkingSpots.map((s) => makeCar(s.x, s.y, s.angle, { driver: "parked" }));
  // a few kerbside cars on the coast road and downtown
  cars.push(makeCar(3360, 420, Math.PI / 2, { driver: "parked", color: "#ffd23f" }));
  cars.push(makeCar(1824, 900, Math.PI / 2, { driver: "parked", color: "#2ec4b6" }));
  cars.push(makeCar(672, 1600, -Math.PI / 2, { driver: "parked", color: "#f7a8b8" }));
  return cars;
}

export function spawnBoats(city) {
  const boats = [];
  city.docks.forEach((d, i) => {
    boats.push({
      kind: "boat", x: d.x + d.w + 26, y: d.y + d.h / 2, angle: Math.PI, speed: 0,
      color: ["#ff8c69", "#2ec4b6", "#ffd23f"][i % 3], marked: false, wake: 0,
      id: `boat-${i}`,
    });
  });
  return boats;
}

function randomIntersection(state, minD, maxD) {
  const { nodes } = state.city.graph;
  for (let tries = 0; tries < 24; tries++) {
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    const d = Math.hypot(n.x - state.player.x, n.y - state.player.y);
    if (d >= minD && d <= maxD) return n;
  }
  return null;
}

export function maintainTraffic(state) {
  const target = 13;
  const mine = state.cars.filter((c) => c.driver === "traffic");
  // retire distant traffic
  for (const c of mine) {
    if (dist(c, state.player) > 1900) c.retire = true;
  }
  state.cars = state.cars.filter((c) => !c.retire);
  let count = state.cars.filter((c) => c.driver === "traffic").length;
  while (count < target) {
    const n = randomIntersection(state, 760, 1500);
    if (!n) break;
    const car = makeCar(n.x, n.y, 0, { driver: "traffic" });
    giveTrafficRoute(state, car);
    state.cars.push(car);
    count++;
  }
}

function giveTrafficRoute(state, car) {
  const dest = randomIntersection(state, 300, 4000) ?? { x: car.x + 300, y: car.y };
  car.path = route(state.city, car, dest);
  car.pathI = 1;
}

export function maintainPeds(state) {
  const target = 26;
  while (state.peds.length < target) {
    const blocks = state.city.parks;
    const b = blocks[Math.floor(Math.random() * blocks.length)];
    const x = b.x + 10 + Math.random() * (b.w - 20);
    const y = b.y + 10 + Math.random() * (b.h - 20);
    state.peds.push({
      kind: "ped", x, y, angle: Math.random() * 6.28, shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
      state: "wander", timer: Math.random() * 3, phase: Math.random() * 9, moving: false, fallen: false,
      home: b, tx: x, ty: y,
    });
  }
  state.peds = state.peds.filter((p) => dist(p, state.player) < 2400 || p.fallen);
}

export function maintainPolice(state) {
  const want = state.wanted;
  const mine = state.cars.filter((c) => c.driver === "police" && !c.wrecked);
  if (want === 0) {
    for (const c of mine) if (dist(c, state.player) > 900) c.retire = true;
    state.cars = state.cars.filter((c) => !c.retire);
    return;
  }
  let guard = 0;
  while (mine.length < want && guard++ < 6) {
    const n = randomIntersection(state, 640, 980);
    if (!n) break;
    const cop = makeCar(n.x, n.y, 0, { driver: "police", police: true, color: "#f4f7fa", convertible: false });
    state.cars.push(cop);
    mine.push(cop);
    if (Math.random() < 0.5) sfx.siren();
  }
}

// ------------------------------------------------------------ crime & heat

export function commitCrime(state, amount) {
  state.heat = clamp(state.heat + amount, 0, 5);
  state.wanted = Math.ceil(state.heat);
}

export function witnessed(state, x, y, radius = 320) {
  if (state.cars.some((c) => c.driver === "police" && Math.hypot(c.x - x, c.y - y) < radius + 140)) return true;
  return state.peds.some((p) => !p.fallen && Math.hypot(p.x - x, p.y - y) < radius);
}

// ------------------------------------------------------------ movement

// Move a circle against buildings and the ground rules of its mode.
// mode 'wheels' | 'foot' cannot enter water; mode 'boat' cannot leave it.
export function slideMove(state, e, dx, dy, r, mode) {
  const city = state.city;
  const ok = (x, y) => {
    if (mode === "boat") return isWater(city, x, y) || state.dockNear;
    return isSolidGround(city, x, y) && !hitsBuilding(city, x, y, r);
  };
  if (ok(e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; return false; }
  if (ok(e.x + dx, e.y)) { e.x += dx; return true; }
  if (ok(e.x, e.y + dy)) { e.y += dy; return true; }
  return true;
}

// ------------------------------------------------------------ updates

export function updateActors(state, dt, ctl) {
  updatePlayer(state, dt, ctl);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  for (const b of state.boats) b.wake = Math.max(0, Math.abs(b.speed) / 240);
  state.muzzle = Math.max(0, state.muzzle - dt);
}

function playerPos(state) {
  const p = state.player;
  if (p.mode === "car") return p.car;
  if (p.mode === "boat") return p.boat;
  return p;
}

function updatePlayer(state, dt, ctl) {
  const p = state.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  state.dockNear = state.city.docks.some((d) => Math.abs(p.x - (d.x + d.w)) < 60 && Math.abs(p.y - (d.y + d.h / 2)) < 60);

  if (ctl.interact) {
    if (p.mode === "foot") tryEnter(state);
    else exitVehicle(state);
  }

  if (p.mode === "foot") {
    const run = ctl.run ? 1.55 : 1;
    const sp = 128 * run;
    let dx = 0, dy = 0;
    if (ctl.up) dy -= 1;
    if (ctl.down) dy += 1;
    if (ctl.left) dx -= 1;
    if (ctl.right) dx += 1;
    p.moving = dx !== 0 || dy !== 0;
    if (p.moving) {
      const len = Math.hypot(dx, dy);
      p.angle = Math.atan2(dy, dx);
      slideMove(state, p, (dx / len) * sp * dt, (dy / len) * sp * dt, 7, "foot");
    }
    if (ctl.shoot && p.shootCd <= 0) playerShoot(state);
  } else if (p.mode === "car") {
    const car = p.car;
    driveCar(state, car, dt, ctl, 392);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    carCrashChecks(state, car, dt);
  } else if (p.mode === "boat") {
    const boat = p.boat;
    const accel = ctl.up ? 190 : ctl.down ? -120 : 0;
    boat.speed = clamp(boat.speed + accel * dt - boat.speed * 0.55 * dt, -70, 265);
    const steer = (ctl.left ? -1 : 0) + (ctl.right ? 1 : 0);
    boat.angle += steer * dt * 1.5 * (boat.speed >= 0 ? 1 : -1) * clamp(Math.abs(boat.speed) / 120, 0.25, 1);
    const dx = Math.cos(boat.angle) * boat.speed * dt;
    const dy = Math.sin(boat.angle) * boat.speed * dt;
    if (slideMove(state, boat, dx, dy, 15, "boat")) boat.speed *= 0.5;
    p.x = boat.x; p.y = boat.y; p.angle = boat.angle;
  }
}

// Shared arcade driving model for the player, traffic and police.
export function driveCar(state, car, dt, ctl, topSpeed) {
  const accel = ctl.up ? 265 : 0;
  const brake = ctl.down ? (car.speed > 12 ? 420 : -150) : 0;
  car.speed += (accel + (brake < 0 ? brake : 0)) * dt;
  if (brake > 0) car.speed = Math.max(0, car.speed - brake * dt);
  car.speed -= car.speed * 0.62 * dt; // drag
  if (!ctl.up && !ctl.down) car.speed -= car.speed * 0.5 * dt;
  car.speed = clamp(car.speed, -128, topSpeed);
  const steer = (ctl.left ? -1 : 0) + (ctl.right ? 1 : 0);
  const grip = clamp(Math.abs(car.speed) / 90, 0, 1);
  car.angle += steer * dt * 2.15 * grip * (car.speed >= 0 ? 1 : -1);
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const hit = slideMove(state, car, dx, dy, 15, "wheels");
  if (hit) {
    if (Math.abs(car.speed) > 165) damageCar(state, car, 9, true);
    car.speed *= -0.22;
  }
}

export function damageCar(state, car, amount, loud = false) {
  if (car.wrecked) return;
  car.health -= amount;
  car.smoke = clamp(1 - car.health / 100, 0, 1);
  if (loud) sfx.crash();
  if (car.health <= 0) {
    car.wrecked = true;
    car.speed = 0;
    if (car.driver === "traffic") car.driver = "parked";
  }
}

function carCrashChecks(state, car, dt) {
  // pedestrians in the path
  for (const ped of state.peds) {
    if (ped.fallen) continue;
    if (Math.abs(car.speed) > 55 && Math.hypot(ped.x - car.x, ped.y - car.y) < 16) {
      ped.fallen = true;
      ped.state = "fallen";
      commitCrime(state, 1.4);
      state.toast("You hit a pedestrian!");
      sfx.crash();
    }
  }
  // other cars
  for (const other of state.cars) {
    if (other === car) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 30 && d > 0.01) {
      const push = (30 - d) / 2;
      const nx = (other.x - car.x) / d, ny = (other.y - car.y) / d;
      other.x += nx * push; other.y += ny * push;
      if (Math.abs(car.speed) > 130) {
        damageCar(state, other, 12, true);
        damageCar(state, car, 7, false);
        if (other.driver === "police") commitCrime(state, 0.4);
        car.speed *= 0.55;
      }
    }
  }
  void dt;
}

function tryEnter(state) {
  const p = state.player;
  // boats first when standing on a dock
  for (const boat of state.boats) {
    if (Math.hypot(boat.x - p.x, boat.y - p.y) < 64) {
      p.mode = "boat"; p.boat = boat;
      state.toast(boat.marked ? "You take the speedboat." : "You board the boat.");
      sfx.enter();
      return;
    }
  }
  let best = null, bestD = 40;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  const wasTraffic = best.driver === "traffic";
  if (wasTraffic) {
    // the driver bails out and runs
    state.peds.push({
      kind: "ped", x: best.x + 14, y: best.y, angle: 0, shirt: SHIRTS[0], state: "flee",
      timer: 5, phase: Math.random() * 9, moving: true, fallen: false,
      home: { x: best.x - 60, y: best.y - 60, w: 120, h: 120 }, tx: best.x + 90, ty: best.y,
    });
    commitCrime(state, witnessed(state, best.x, best.y) ? 0.9 : 0.3);
    state.toast("You stole a car!");
  }
  best.driver = "player";
  best.path = null;
  p.mode = "car";
  p.car = best;
  state.lastCar = best;
  sfx.enter();
}

function exitVehicle(state) {
  const p = state.player;
  if (p.mode === "car") {
    const car = p.car;
    if (Math.abs(car.speed) > 26) return;
    car.driver = "parked";
    for (const [ox, oy] of [[0, 26], [0, -26], [26, 0], [-26, 0]]) {
      const nx = car.x + ox, ny = car.y + oy;
      if (isSolidGround(state.city, nx, ny) && !hitsBuilding(state.city, nx, ny, 7)) {
        p.x = nx; p.y = ny; break;
      }
    }
    p.mode = "foot"; p.car = null;
    sfx.enter();
  } else if (p.mode === "boat") {
    const boat = p.boat;
    if (Math.abs(boat.speed) > 22) return;
    for (const d of state.city.docks) {
      if (Math.abs(boat.y - (d.y + d.h / 2)) < 46 && boat.x > d.x - 30 && boat.x < d.x + d.w + 70) {
        p.x = d.x + d.w / 2; p.y = d.y + d.h / 2;
        p.mode = "foot"; p.boat = null;
        sfx.enter();
        return;
      }
    }
    state.toast("Find a dock to step ashore.");
  }
}

function playerShoot(state) {
  const p = state.player;
  p.shootCd = 0.34;
  sfx.shot();
  state.muzzle = 0.07;
  // nearest police car, then any car, then a ped — inside range
  const range = 280;
  let target = null, bestD = range;
  for (const c of state.cars) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD && (c.police || target === null || !target.police)) { target = c; bestD = d; }
  }
  state.muzzleRange = target ? bestD : range * 0.5;
  if (target && bestD < range) {
    damageCar(state, target, 34, false);
    commitCrime(state, target.police ? 0.8 : 0.4);
    if (target.wrecked) state.toast(target.police ? "Police car disabled!" : "You wrecked a car!");
  }
  for (const ped of state.peds) {
    if (!ped.fallen && Math.hypot(ped.x - p.x, ped.y - p.y) < 190) { ped.state = "flee"; ped.timer = 4; }
  }
}

// ------------------------------------------------------------ AI updates

function steerToward(car, tx, ty, dt, turnRate = 2.6) {
  const target = Math.atan2(ty - car.y, tx - car.x);
  car.angle = angleTurn(car.angle, target, turnRate * dt * clamp(Math.abs(car.speed) / 120 + 0.35, 0.35, 1));
  return Math.abs(((target - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
}

function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver !== "traffic" || car.wrecked) continue;
    if (!car.path || car.pathI >= car.path.length) giveTrafficRoute(state, car);
    const node = car.path[car.pathI];
    // right-hand lane offset
    const prev = car.path[car.pathI - 1] ?? car;
    const segA = Math.atan2(node.y - prev.y, node.x - prev.x);
    const tx = node.x + Math.cos(segA + Math.PI / 2) * 24;
    const ty = node.y + Math.sin(segA + Math.PI / 2) * 24;
    const off = steerToward(car, tx, ty, dt, 2.2);
    let want = car.cruise * (off > 1.1 ? 0.45 : 1);
    // slow for the car ahead
    for (const other of state.cars) {
      if (other === car) continue;
      const ahead = Math.hypot(other.x - (car.x + Math.cos(car.angle) * 46), other.y - (car.y + Math.sin(car.angle) * 46));
      if (ahead < 26) { want = Math.min(want, Math.max(0, (other.speed ?? 0) - 6)); break; }
    }
    const ctl = { up: car.speed < want, down: car.speed > want + 26, left: false, right: false };
    // translate steering into the shared driving model by nudging angle directly
    driveCar(state, car, dt, { up: ctl.up, down: ctl.down, left: false, right: false }, 235);
    car.angle = angleTurn(car.angle, Math.atan2(ty - car.y, tx - car.x), 1.9 * dt * clamp(Math.abs(car.speed) / 100 + 0.3, 0.3, 1));
    if (Math.hypot(node.x - car.x, node.y - car.y) < 42) car.pathI++;
    carCrashChecksLight(state, car);
  }
}

function carCrashChecksLight(state, car) {
  for (const ped of state.peds) {
    if (ped.fallen) continue;
    if (Math.abs(car.speed) > 60 && Math.hypot(ped.x - car.x, ped.y - car.y) < 15) {
      ped.fallen = true; ped.state = "fallen";
    }
  }
}

function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.fallen) continue;
    ped.timer -= dt;
    // flee anything fast and close, or gunfire nearby
    const threat = state.player.mode !== "foot" ? playerPos(state) : (state.muzzle > 0 ? state.player : null);
    if (ped.state !== "flee" && threat && Math.hypot(threat.x - ped.x, threat.y - ped.y) < 90 && Math.abs(threat.speed ?? 99) > 40) {
      ped.state = "flee"; ped.timer = 2.6;
    }
    let tx, ty, speed;
    if (ped.state === "flee") {
      const from = playerPos(state);
      const a = Math.atan2(ped.y - from.y, ped.x - from.x);
      tx = ped.x + Math.cos(a) * 90; ty = ped.y + Math.sin(a) * 90;
      speed = 168;
      if (ped.timer <= 0) ped.state = "wander";
    } else {
      if (ped.timer <= 0 || Math.hypot(ped.tx - ped.x, ped.ty - ped.y) < 9) {
        const b = ped.home;
        const side = Math.floor(Math.random() * 4);
        ped.tx = side === 0 ? b.x - 12 : side === 1 ? b.x + b.w + 12 : b.x + Math.random() * b.w;
        ped.ty = side === 2 ? b.y - 12 : side === 3 ? b.y + b.h + 12 : b.y + Math.random() * b.h;
        ped.timer = 4 + Math.random() * 5;
      }
      tx = ped.tx; ty = ped.ty;
      speed = 52;
    }
    const d = Math.hypot(tx - ped.x, ty - ped.y);
    ped.moving = d > 4;
    if (ped.moving) {
      ped.angle = Math.atan2(ty - ped.y, tx - ped.x);
      slideMove(state, ped, Math.cos(ped.angle) * speed * dt, Math.sin(ped.angle) * speed * dt, 6, "foot");
    }
  }
}

function updatePolice(state, dt) {
  const target = playerPos(state);
  let anyClose = false;
  for (const cop of state.cars) {
    if (cop.driver !== "police" || cop.wrecked) continue;
    const d = dist(cop, target);
    if (d < 560) anyClose = true;
    const lead = 0.35;
    const tx = target.x + Math.cos(target.angle ?? 0) * (target.speed ?? 0) * lead;
    const ty = target.y + Math.sin(target.angle ?? 0) * (target.speed ?? 0) * lead;
    steerToward(cop, tx, ty, dt, 2.9);
    const top = 330 + state.wanted * 26;
    driveCar(state, cop, dt, { up: d > 34, down: false, left: false, right: false }, top);
    cop.angle = angleTurn(cop.angle, Math.atan2(ty - cop.y, tx - cop.x), 2.4 * dt);
    carCrashChecksLight(state, cop);
  }
  // the bust meter: a close police car and a slow player is trouble
  const pSpeed = Math.abs(target.speed ?? (state.player.moving ? 120 : 0));
  const closeCop = state.cars.some((c) => c.driver === "police" && !c.wrecked && dist(c, target) < 58);
  if (closeCop && pSpeed < 42 && state.wanted > 0) {
    state.bust += dt;
    if (state.bust > 2.1) state.busted = true;
  } else {
    state.bust = Math.max(0, state.bust - dt * 1.6);
  }
  state.policeNear = anyClose;
  void WORLD;
  void nearestNode;
}
