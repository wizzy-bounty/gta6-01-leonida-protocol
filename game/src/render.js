// render.js — every pixel of the world of LEONIDA PROTOCOL.
// Draws Port Leonida in a slight-angle 2D style: pastel art-deco blocks with
// extruded roofs, a beach and marina, the causeway, the airport runway, and a
// day-to-night grade driven by the story's day phase (golden hour → night).

import { WORLD, ROADS_X, ROADS_Y, ROAD_HALF, COAST_X, WATER_X, CAUSEWAY_Y, ISLAND, RUNWAY, isWater } from "./city.js";

// The day grade: phase 0 is golden hour, 0.5 sunset, 0.75 dusk, 1 full night.
export function dayGrade(phase) {
  const stops = [
    { p: 0.0, tint: "rgba(255,166,66,0.10)", lit: 0.0 },
    { p: 0.5, tint: "rgba(255,102,82,0.15)", lit: 0.25 },
    { p: 0.75, tint: "rgba(64,54,138,0.26)", lit: 0.8 },
    { p: 1.0, tint: "rgba(8,12,52,0.44)", lit: 1.0 },
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (phase >= stops[i].p && phase <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = b.p === a.p ? 0 : (phase - a.p) / (b.p - a.p);
  const lit = a.lit + (b.lit - a.lit) * t;
  return { tint: t < 0.5 ? a.tint : b.tint, lit };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

let glowSprite = null;
function getGlowSprite() {
  if (glowSprite) return glowSprite;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,214,140,0.85)");
  grad.addColorStop(0.4, "rgba(255,190,110,0.28)");
  grad.addColorStop(1, "rgba(255,180,100,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowSprite = c;
  return c;
}

// ---------------------------------------------------------------- world

export function drawWorld(ctx, state, view) {
  const { city } = state;
  const grade = dayGrade(state.dayPhase);

  // water, everywhere east of the sand and around the island
  ctx.fillStyle = "#2b7f9e";
  ctx.fillRect(view.x - 40, view.y - 40, view.w + 80, view.h + 80);
  ctx.fillStyle = "#3598b5";
  for (let gx = Math.floor((view.x - 40) / 90) * 90; gx < view.x + view.w + 40; gx += 90) {
    for (let gy = Math.floor((view.y - 40) / 90) * 90; gy < view.y + view.h + 40; gy += 90) {
      const s = Math.sin((gx * 12.9898 + gy * 78.233) % 6.28 + state.time * 0.7) * 0.5 + 0.5;
      ctx.globalAlpha = 0.12 + s * 0.15;
      ctx.fillRect(gx + s * 22, gy + ((gx + gy) % 37), 26, 3);
    }
  }
  ctx.globalAlpha = 1;

  // landmass: the mainland, the island, the causeway bed
  ctx.fillStyle = "#e3cfa3";
  ctx.fillRect(-40, -40, COAST_X + 40, WORLD.h + 80);
  ctx.fillStyle = "#eed9ab";
  ctx.fillRect(ISLAND.x, ISLAND.y, ISLAND.w, ISLAND.h);
  // sand strip
  ctx.fillStyle = "#f2d492";
  ctx.fillRect(COAST_X, -40, WATER_X - COAST_X, WORLD.h + 80);
  ctx.fillStyle = "rgba(190,150,90,0.35)";
  for (let gy = 60; gy < WORLD.h; gy += 130) ctx.fillRect(COAST_X + 30 + ((gy * 7) % 120), gy, 34, 5);

  drawParksAndLots(ctx, state, view);
  drawRoads(ctx, state, view);
  drawRunway(ctx, state, view);
  drawDocks(ctx, state, view);
  drawPalms(ctx, state, view, false);
  drawBuildings(ctx, state, view, grade);
  drawPalms(ctx, state, view, true);
}

function inView(view, x, y, pad = 80) {
  return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
}

function drawParksAndLots(ctx, state, view) {
  for (const p of state.city.parks) {
    if (!inView(view, p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h))) continue;
    if (p.lot) {
      ctx.fillStyle = "#9aa0a8";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      for (let px = p.x + 34; px < p.x + p.w - 20; px += 52) {
        ctx.beginPath(); ctx.moveTo(px, p.y + 14); ctx.lineTo(px, p.y + p.h - 14); ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#8fce7e";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#a8dd97";
      ctx.fillRect(p.x + 14, p.y + 14, p.w - 28, p.h - 28);
      ctx.fillStyle = "#e8f6ff";
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 16, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "#7fc7bd"; ctx.lineWidth = 3; ctx.stroke();
    }
  }
}

function drawRoads(ctx, state, view) {
  ctx.fillStyle = "#cfc4ae"; // sidewalk band under every road
  for (const x of ROADS_X) ctx.fillRect(x - ROAD_HALF - 9, -40, ROAD_HALF * 2 + 18, WORLD.h + 80);
  for (const y of ROADS_Y) ctx.fillRect(-40, y - ROAD_HALF - 9, COAST_X + 40, ROAD_HALF * 2 + 18);
  ctx.fillRect(3360 - 9, CAUSEWAY_Y - ROAD_HALF - 9, ISLAND.x + ISLAND.w - 3360 + 18, ROAD_HALF * 2 + 18);

  ctx.fillStyle = "#4c4c58"; // asphalt
  for (const x of ROADS_X) ctx.fillRect(x - ROAD_HALF, -40, ROAD_HALF * 2, WORLD.h + 80);
  for (const y of ROADS_Y) ctx.fillRect(-40, y - ROAD_HALF, COAST_X + 40, ROAD_HALF * 2);
  ctx.fillRect(3360, CAUSEWAY_Y - ROAD_HALF, ISLAND.x + ISLAND.w - 3360, ROAD_HALF * 2);
  // the coast road runs into the sand to the marina
  ctx.fillRect(3360 - ROAD_HALF, -40, ROAD_HALF * 2, WORLD.h + 80);

  ctx.strokeStyle = "rgba(255,238,190,0.75)";
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const x of ROADS_X) { ctx.moveTo(x, -20); ctx.lineTo(x, WORLD.h + 20); }
  for (const y of ROADS_Y) { ctx.moveTo(-20, y); ctx.lineTo(COAST_X, y); }
  ctx.moveTo(3360, CAUSEWAY_Y); ctx.lineTo(ISLAND.x + ISLAND.w, CAUSEWAY_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  void view;
}

function drawRunway(ctx, state, view) {
  if (!inView(view, RUNWAY.x + RUNWAY.w / 2, RUNWAY.y + RUNWAY.h / 2, 800)) return;
  ctx.fillStyle = "#3f3f49";
  ctx.fillRect(RUNWAY.x, RUNWAY.y, RUNWAY.w, RUNWAY.h);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 4;
  ctx.setLineDash([34, 26]);
  ctx.beginPath();
  ctx.moveTo(RUNWAY.x + 20, RUNWAY.y + RUNWAY.h / 2);
  ctx.lineTo(RUNWAY.x + RUNWAY.w - 20, RUNWAY.y + RUNWAY.h / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 5; i++) ctx.fillRect(RUNWAY.x + 8 + i * 14, RUNWAY.y + 10, 7, RUNWAY.h - 20);
  // the waiting plane, drawn as part of the scenery
  const px = RUNWAY.x + RUNWAY.w - 190, py = RUNWAY.y + RUNWAY.h / 2;
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = "#f4f7fa";
  ctx.beginPath(); ctx.ellipse(0, 0, 74, 15, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-58, 0); ctx.lineTo(-92, -30); ctx.lineTo(-74, 0); ctx.lineTo(-92, 30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#2ec4b6";
  ctx.beginPath(); ctx.moveTo(30, -12); ctx.lineTo(2, -40); ctx.lineTo(-16, -38); ctx.lineTo(2, -12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(30, 12); ctx.lineTo(2, 40); ctx.lineTo(-16, 38); ctx.lineTo(2, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#bfe8f5";
  for (let i = 0; i < 6; i++) ctx.fillRect(-30 + i * 15, -4, 7, 7);
  ctx.restore();
}

function drawDocks(ctx, state, view) {
  for (const d of state.city.docks) {
    if (!inView(view, d.x + d.w / 2, d.y, 200)) continue;
    ctx.fillStyle = "#a97c50";
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let x = d.x + 12; x < d.x + d.w; x += 24) ctx.fillRect(x, d.y + 2, 3, d.h - 4);
  }
}

function drawPalms(ctx, state, view, front) {
  for (const p of state.city.palms) {
    if ((p.y > state.player.y) !== front) continue;
    if (!inView(view, p.x, p.y, 60)) continue;
    drawPalm(ctx, p.x, p.y, p.s);
  }
}

function drawPalm(ctx, x, y, s) {
  ctx.strokeStyle = "#8a6844";
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 5 * s, y - 18 * s, x + 10 * s, y - 30 * s);
  ctx.stroke();
  ctx.strokeStyle = "#3f9e4d";
  ctx.lineWidth = 3.4 * s;
  const topX = x + 10 * s, topY = y - 30 * s;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI - 0.2;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * 16 * s, topY - Math.abs(Math.sin(a)) * 10 * s - 4, topX + Math.cos(a) * 26 * s, topY + 6 * s - Math.sin(a) * 6 * s);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath(); ctx.ellipse(x, y + 2, 9 * s, 3.4 * s, 0, 0, 6.29); ctx.fill();
}

function drawBuildings(ctx, state, view, grade) {
  const sorted = state.city.buildings.slice().sort((a, b) => a.y - b.y);
  for (const b of sorted) {
    if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) + 120)) continue;
    const lift = b.height * 0.34;
    // shadow
    ctx.fillStyle = "rgba(60,40,20,0.18)";
    ctx.fillRect(b.x + 7, b.y + 8, b.w, b.h);
    // south and east walls
    ctx.fillStyle = shade(b.color, 0.72);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h - lift); ctx.lineTo(b.x, b.y + b.h - lift);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(b.color, 0.86);
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h - lift); ctx.lineTo(b.x + b.w, b.y - lift);
    ctx.closePath(); ctx.fill();
    // windows on the south wall, lit warm once the day turns
    const rows = Math.max(1, Math.floor(lift / 15));
    const cols = Math.max(2, Math.floor(b.w / 24));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = (b.windowsSeed + r * 131 + c * 17) % 10;
        const lit = grade.lit > 0.15 && seed < grade.lit * 7;
        ctx.fillStyle = lit ? "#ffd76e" : "rgba(38,54,74,0.55)";
        ctx.fillRect(b.x + 8 + c * ((b.w - 14) / cols), b.y + b.h - lift + 5 + r * 13, 8, 7);
      }
    }
    // roof with a deco trim
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y - lift, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x + 5, b.y - lift + 5, b.w - 10, b.h - 10);
    if (b.deco === "band") {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(b.x + 5, b.y - lift + b.h * 0.42, b.w - 10, 5);
    } else if (b.deco === "step") {
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + b.w * 0.3, b.y - lift - 7, b.w * 0.4, 9);
    }
    if (b.name) {
      ctx.fillStyle = "rgba(30,24,40,0.8)";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h - lift / 2 + 4);
    }
  }
}

// ---------------------------------------------------------------- actors

export function drawBoat(ctx, boat) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(2, 5, 30, 10, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = boat.color;
  ctx.beginPath();
  ctx.moveTo(30, 0); ctx.lineTo(14, -9); ctx.lineTo(-26, -9); ctx.lineTo(-30, 0); ctx.lineTo(-26, 9); ctx.lineTo(14, 9);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff7ea";
  ctx.fillRect(-16, -6, 24, 12);
  ctx.fillStyle = "#2b7f9e";
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
  if (boat.wake > 0.05) {
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(boat.x - Math.cos(boat.angle) * 36, boat.y - Math.sin(boat.angle) * 36, 10 + boat.wake * 16, 0, 6.29);
    ctx.stroke();
  }
}

export function drawCar(ctx, car, state) {
  const grade = dayGrade(state.dayPhase);
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // headlight cones at dusk and night
  if (grade.lit > 0.4 && !car.wrecked) {
    const grad = ctx.createLinearGradient(20, 0, 120, 0);
    grad.addColorStop(0, "rgba(255,230,160,0.30)");
    grad.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(20, -7); ctx.lineTo(122, -24); ctx.lineTo(122, 24); ctx.lineTo(20, 7);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  roundRect(ctx, -21, -9 + 4, 44, 20, 6); ctx.fill();
  ctx.fillStyle = car.wrecked ? "#5a5a5a" : car.color;
  roundRect(ctx, -22, -10, 44, 20, 6); ctx.fill();
  if (car.convertible) {
    ctx.fillStyle = "#3a2e2a";
    roundRect(ctx, -12, -7, 20, 14, 4); ctx.fill();
    ctx.fillStyle = "#f2c894";
    ctx.beginPath(); ctx.arc(-2, 0, 4.4, 0, 6.29); ctx.fill();
  } else {
    ctx.fillStyle = shade(car.color, 1.18);
    roundRect(ctx, -11, -8, 21, 16, 4); ctx.fill();
    ctx.fillStyle = "#22384a";
    roundRect(ctx, 2, -7, 7, 14, 2); ctx.fill();
    roundRect(ctx, -11, -7, 5, 14, 2); ctx.fill();
  }
  ctx.fillStyle = "#1c1c22";
  for (const [wx, wy] of [[-14, -11], [13, -11], [-14, 9], [13, 9]]) {
    ctx.fillRect(wx, wy, 8, 3.4);
  }
  if (car.police) {
    ctx.fillStyle = "#f4f7fa";
    roundRect(ctx, -20, -9, 40, 18, 5); ctx.fill();
    ctx.fillStyle = "#147d74";
    ctx.fillRect(-20, -3, 40, 6);
    roundRect(ctx, -11, -8, 21, 16, 4); ctx.fill();
    ctx.fillStyle = "#22384a";
    roundRect(ctx, 2, -7, 7, 14, 2); ctx.fill();
    const flash = Math.floor(state.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? "#ff4444" : "#ff8888";
    ctx.fillRect(-7, -3, 6, 6);
    ctx.fillStyle = flash ? "#4488ff" : "#2255cc";
    ctx.fillRect(1, -3, 6, 6);
  }
  if (car.marked) {
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 2.4;
    roundRect(ctx, -25, -13, 50, 26, 8); ctx.stroke();
  }
  ctx.restore();
  if (car.smoke > 0) {
    ctx.fillStyle = `rgba(70,70,70,${0.25 + car.smoke * 0.3})`;
    const s = 5 + car.smoke * 9 + Math.sin(state.time * 7 + car.x) * 2;
    ctx.beginPath(); ctx.arc(car.x + 8, car.y - 12 - car.smoke * 8, s, 0, 6.29); ctx.fill();
  }
}

export function drawPed(ctx, ped, state) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(0, 3, 6, 2.6, 0, 0, 6.29); ctx.fill();
  if (ped.fallen) {
    ctx.rotate(1.5);
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -8, -3, 16, 6, 3); ctx.fill();
    ctx.fillStyle = "#f2c894";
    ctx.beginPath(); ctx.arc(10, 0, 3.6, 0, 6.29); ctx.fill();
  } else {
    const bob = ped.moving ? Math.sin(state.time * 11 + ped.phase) * 1.4 : 0;
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -4, -4 + bob * 0.3, 8, 11, 3); ctx.fill();
    ctx.fillStyle = "#f2c894";
    ctx.beginPath(); ctx.arc(0, -7 + bob * 0.3, 4, 0, 6.29); ctx.fill();
  }
  ctx.restore();
}

export function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.mode !== "foot") return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.ellipse(0, 4, 7, 3, 0, 0, 6.29); ctx.fill();
  const bob = p.moving ? Math.sin(state.time * 12) * 1.6 : 0;
  ctx.fillStyle = "#ff6b4a";
  roundRect(ctx, -5, -5 + bob * 0.3, 10, 13, 4); ctx.fill();
  ctx.fillStyle = "#f2c894";
  ctx.beginPath(); ctx.arc(0, -8 + bob * 0.3, 4.6, 0, 6.29); ctx.fill();
  ctx.fillStyle = "#263238";
  ctx.beginPath(); ctx.arc(0, -9.6 + bob * 0.3, 4.6, 3.4, 6.0); ctx.fill();
  // facing tick / gun
  ctx.strokeStyle = "#263238";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(4 + Math.cos(p.angle) * 10, Math.sin(p.angle) * 10);
  ctx.stroke();
  ctx.restore();
  if (state.muzzle > 0) {
    ctx.strokeStyle = "rgba(255,210,90,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
    ctx.lineTo(p.x + Math.cos(p.angle) * state.muzzleRange, p.y + Math.sin(p.angle) * state.muzzleRange);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- marker + light

export function drawObjectiveMarker(ctx, state) {
  const m = state.marker;
  if (!m) return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.16;
  ctx.save();
  ctx.translate(m.x, m.y);
  const grad = ctx.createLinearGradient(0, -150, 0, 0);
  grad.addColorStop(0, "rgba(255,210,63,0)");
  grad.addColorStop(1, "rgba(255,210,63,0.4)");
  ctx.fillStyle = grad;
  ctx.fillRect(-9, -150, 18, 150);
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, 6.29); ctx.stroke();
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.29); ctx.fill();
  ctx.fillStyle = "#fff3c4";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  const bobY = -44 + Math.sin(state.time * 4) * 5;
  ctx.beginPath();
  ctx.moveTo(0, bobY + 14); ctx.lineTo(-9, bobY); ctx.lineTo(9, bobY);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawLighting(ctx, state, view) {
  const grade = dayGrade(state.dayPhase);
  ctx.fillStyle = grade.tint;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  if (grade.lit > 0.35) {
    const sprite = getGlowSprite();
    for (const lamp of state.city.lamps) {
      if (!inView(view, lamp.x, lamp.y, 90)) continue;
      ctx.globalAlpha = 0.5 * grade.lit;
      ctx.drawImage(sprite, lamp.x - 42, lamp.y - 42, 84, 84);
    }
    ctx.globalAlpha = 1;
  }
  void isWater;
}
