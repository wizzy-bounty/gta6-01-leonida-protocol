// hud.js — everything drawn over the world in LEONIDA PROTOCOL:
// the mission bar, money, wanted stars, timer, minimap, toasts, and the
// title / briefing / pause / help / failed / final screens. Screens register
// their clickable buttons on state.buttons for main.js to hit-test.

import { WORLD, ROADS_X, ROADS_Y, WATER_X, ISLAND } from "./city.js";
import { timeLeft } from "./missions.js";

const INK = "#22303a";
const PAPER = "rgba(255, 248, 235, 0.92)";
const GOLD = "#ffb03a";

function panel(ctx, x, y, w, h, fill = PAPER) {
  ctx.fillStyle = "rgba(34, 48, 58, 0.25)";
  ctx.fillRect(x + 4, y + 5, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#2ec4b6";
  ctx.fillRect(x, y, w, 5);
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? "#ffcf3f" : "rgba(20, 30, 40, 0.45)";
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 30, 40, 0.8)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHUD(ctx, state, view) {
  const { width: W, height: H } = view;
  ctx.textBaseline = "alphabetic";

  // ---- mission / objective (top-left) ----------------------------------
  const title = state.freeroam ? "FREE ROAM" : (state.mission ? `MISSION ${state.missionIdx + 1} — ${state.mission.title.toUpperCase()}` : "");
  if (title) {
    panel(ctx, 16, 14, 430, 64);
    ctx.fillStyle = INK;
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillText(title, 30, 40);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#43545f";
    const obj = state.objectiveText ?? "";
    ctx.fillText(obj.length > 52 ? obj.slice(0, 51) + "…" : obj, 30, 63);
  }

  // ---- money + wanted (top-right) ---------------------------------------
  panel(ctx, W - 216, 14, 200, 64);
  ctx.fillStyle = INK;
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`$${state.money.toLocaleString("en-US")}`, W - 30, 44);
  ctx.textAlign = "left";
  for (let i = 0; i < 5; i++) star(ctx, W - 178 + i * 34, 64, 11, i < state.wanted);
  if (state.bust > 0.05) {
    ctx.fillStyle = "rgba(20,30,40,0.5)";
    ctx.fillRect(W - 196, 84, 160, 8);
    ctx.fillStyle = "#e63946";
    ctx.fillRect(W - 196, 84, 160 * Math.min(1, state.bust / 2.1), 8);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText("BUSTED?", W - 196, 82);
  }

  // ---- timer (top-center) -------------------------------------------------
  const left = state.screen === "play" ? timeLeft(state) : null;
  if (left !== null) {
    const total = state.mission.timeLimit;
    panel(ctx, W / 2 - 110, 14, 220, 44);
    ctx.fillStyle = left < 20 ? "#c1272d" : INK;
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`, W / 2, 42);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(20,30,40,0.25)";
    ctx.fillRect(W / 2 - 96, 48, 192, 5);
    ctx.fillStyle = left < 20 ? "#c1272d" : "#2ec4b6";
    ctx.fillRect(W / 2 - 96, 48, 192 * (left / total), 5);
  }

  // ---- toast ---------------------------------------------------------------
  if (state.toastT > 0 && state.toastMsg) {
    ctx.globalAlpha = Math.min(1, state.toastT);
    ctx.font = "bold 17px system-ui, sans-serif";
    const tw = ctx.measureText(state.toastMsg).width + 36;
    panel(ctx, W / 2 - tw / 2, 84, tw, 38, "rgba(34, 48, 58, 0.88)");
    ctx.fillStyle = "#fff8eb";
    ctx.textAlign = "center";
    ctx.fillText(state.toastMsg, W / 2, 109);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  drawMinimap(ctx, state, 16, H - 176);
  drawEdgeMarker(ctx, state, view);

  // ---- speed + hints ---------------------------------------------------------
  const p = state.player;
  if (p.mode !== "foot") {
    const v = p.mode === "car" ? p.car : p.boat;
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillStyle = "#fff8eb";
    ctx.strokeStyle = "rgba(20,30,40,0.6)";
    const s = `${Math.round(Math.abs(v.speed) * 0.22)} mph`;
    ctx.textAlign = "right";
    ctx.strokeText(s, W - 22, H - 24);
    ctx.fillText(s, W - 22, H - 24);
    ctx.textAlign = "left";
  }
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,248,235,0.75)";
  const hint = p.mode === "foot" ? "WASD walk · E enter car/boat · F sidearm · H help" : "WASD drive · E exit · P pause · H help";
  ctx.textAlign = "right";
  ctx.fillText(hint, W - 22, H - 6);
  ctx.textAlign = "left";
}

function drawMinimap(ctx, state, x, y) {
  const w = 208, h = 160;
  const sx = w / WORLD.w, sy = h / WORLD.h;
  ctx.fillStyle = "rgba(16, 34, 44, 0.82)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,248,235,0.5)";
  ctx.strokeRect(x, y, w, h);
  // land & water
  ctx.fillStyle = "#8a7f5c";
  ctx.fillRect(x, y, WATER_X * sx, h);
  ctx.fillStyle = "#3d7ea6";
  ctx.fillRect(x + WATER_X * sx, y, w - WATER_X * sx, h);
  ctx.fillStyle = "#8a7f5c";
  ctx.fillRect(x + ISLAND.x * sx, y + ISLAND.y * sy, ISLAND.w * sx, ISLAND.h * sy);
  // roads
  ctx.strokeStyle = "rgba(255,248,235,0.55)";
  ctx.lineWidth = 1;
  for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + h); ctx.stroke(); }
  for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + (state.marker ? w : w), y + ry * sy); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x + 3360 * sx, y + 1440 * sy); ctx.lineTo(x + w, y + 1440 * sy); ctx.stroke();
  // police
  ctx.fillStyle = "#ff5964";
  for (const c of state.cars) {
    if (c.driver !== "police" || c.wrecked) continue;
    ctx.fillRect(x + c.x * sx - 2, y + c.y * sy - 2, 4, 4);
  }
  // objective
  if (state.marker && state.screen === "play") {
    const blink = Math.sin(state.time * 6) > -0.3;
    if (blink) {
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(x + state.marker.x * sx, y + state.marker.y * sy, 5, 0, 6.29);
      ctx.fill();
      ctx.strokeStyle = "#fff8eb";
      ctx.stroke();
    }
  }
  // player
  const p = state.player;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x + p.x * sx, y + p.y * sy, 3.5, 0, 6.29);
  ctx.fill();
  ctx.strokeStyle = "#22303a";
  ctx.stroke();
}

function drawEdgeMarker(ctx, state, view) {
  if (!state.marker || state.screen !== "play") return;
  const cam = state.camera;
  const mx = state.marker.x - cam.x + view.width / 2;
  const my = state.marker.y - cam.y + view.height / 2;
  if (mx > 30 && mx < view.width - 30 && my > 30 && my < view.height - 30) return;
  const cx = view.width / 2, cy = view.height / 2;
  const a = Math.atan2(my - cy, mx - cx);
  const ex = Math.max(36, Math.min(view.width - 36, mx));
  const ey = Math.max(36, Math.min(view.height - 36, my));
  const d = Math.round(Math.hypot(state.marker.x - state.player.x, state.marker.y - state.player.y) / 9);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#fff8eb";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${d}m`, ex, ey + 26);
  ctx.textAlign = "left";
}

// ------------------------------------------------------------ screens

function dim(ctx, view, alpha = 0.45) {
  ctx.fillStyle = `rgba(18, 26, 38, ${alpha})`;
  ctx.fillRect(0, 0, view.width, view.height);
}

function button(ctx, state, id, x, y, w, h, label, accent = false) {
  const hover = state.mouse.x >= x && state.mouse.x <= x + w && state.mouse.y >= y && state.mouse.y <= y + h;
  ctx.fillStyle = accent ? "#ff6b4a" : hover ? "#ffd9a0" : PAPER;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = accent ? "#fff8eb" : INK;
  ctx.font = "bold 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  ctx.textAlign = "left";
  state.buttons.push({ id, x, y, w, h });
}

export function drawTitle(ctx, state, view) {
  const { width: W, height: H } = view;
  dim(ctx, view, 0.25);
  state.buttons = [];
  // deco sun disc
  ctx.fillStyle = "rgba(255, 176, 58, 0.9)";
  ctx.beginPath();
  ctx.arc(W / 2, 208, 86, 0, 6.29);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 111, 74, 0.85)";
  for (let i = 0; i < 4; i++) ctx.fillRect(W / 2 - 86, 178 + i * 22, 172, 7);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff8eb";
  ctx.strokeStyle = "rgba(34,48,58,0.85)";
  ctx.lineWidth = 8;
  ctx.font = "900 84px system-ui, sans-serif";
  ctx.strokeText("LEONIDA", W / 2, 190);
  ctx.fillText("LEONIDA", W / 2, 190);
  ctx.font = "900 44px system-ui, sans-serif";
  ctx.lineWidth = 6;
  ctx.strokeText("P R O T O C O L", W / 2, 246);
  ctx.fillText("P R O T O C O L", W / 2, 246);
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillStyle = "#fff8eb";
  ctx.fillText("Five jobs. One city. Don't get caught.", W / 2, 282);
  ctx.textAlign = "left";

  const bw = 300, bx = W / 2 - bw / 2;
  let by = H - 300;
  button(ctx, state, "start", bx, by, bw, 52, "START THE STORY", true); by += 66;
  if (state.save && (state.save.nextMission > 0 || state.save.storyComplete)) {
    button(ctx, state, "continue", bx, by, bw, 52, state.save.storyComplete ? "CONTINUE — STORY DONE" : `CONTINUE — MISSION ${state.save.nextMission + 1}`);
    by += 66;
  }
  button(ctx, state, "freeroam", bx, by, bw, 52, "FREE ROAM"); by += 66;
  button(ctx, state, "help", bx, by, bw, 52, "HOW TO PLAY");
  ctx.textAlign = "center";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,248,235,0.8)";
  ctx.fillText("Click a button, or press ENTER to start", W / 2, H - 28);
  ctx.textAlign = "left";
}

export function drawBriefing(ctx, state, view) {
  const { width: W, height: H } = view;
  dim(ctx, view, 0.5);
  state.buttons = [];
  const m = state.mission;
  const w = 620, h = 320, x = W / 2 - w / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h);
  ctx.fillStyle = "#ff6b4a";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillText(`MISSION ${state.missionIdx + 1} OF 5`, x + 30, y + 44);
  ctx.fillStyle = INK;
  ctx.font = "900 34px system-ui, sans-serif";
  ctx.fillText(m.title, x + 30, y + 86);
  ctx.font = "italic 14px system-ui, sans-serif";
  ctx.fillStyle = "#43545f";
  ctx.fillText(m.from, x + 30, y + 112);
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillStyle = INK;
  m.brief.forEach((line, i) => ctx.fillText(line, x + 30, y + 152 + i * 26));
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.fillStyle = "#1d7a4f";
  ctx.fillText(`Pays $${m.reward}`, x + 30, y + h - 64);
  if (m.timeLimit > 0) {
    ctx.fillStyle = "#c1272d";
    ctx.fillText(`Clock: ${m.timeLimit} seconds once you roll`, x + 200, y + h - 64);
  }
  button(ctx, state, "roll", x + w / 2 - 110, y + h - 52, 220, 40, "ROLL OUT ▸", true);
}

export function drawPause(ctx, state, view) {
  const { width: W, height: H } = view;
  dim(ctx, view, 0.55);
  state.buttons = [];
  const w = 340, h = 300, x = W / 2 - w / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h);
  ctx.fillStyle = INK;
  ctx.font = "900 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", W / 2, y + 56);
  ctx.textAlign = "left";
  button(ctx, state, "resume", x + 40, y + 84, w - 80, 46, "RESUME", true);
  button(ctx, state, "help", x + 40, y + 144, w - 80, 46, "HOW TO PLAY");
  button(ctx, state, "quit-title", x + 40, y + 204, w - 80, 46, "QUIT TO TITLE");
}

export function drawHelp(ctx, state, view) {
  const { width: W, height: H } = view;
  dim(ctx, view, 0.6);
  state.buttons = [];
  const w = 560, h = 430, x = W / 2 - w / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h);
  ctx.fillStyle = INK;
  ctx.font = "900 26px system-ui, sans-serif";
  ctx.fillText("HOW TO PLAY", x + 30, y + 48);
  ctx.font = "15px system-ui, sans-serif";
  const lines = [
    "WASD / Arrow keys — walk and drive",
    "SHIFT — run        E — enter / exit cars and boats",
    "F — sidearm (on foot)        P / ESC — pause",
    "",
    "Follow the gold marker. The minimap shows the job,",
    "you (white) and the police (red).",
    "",
    "Stars mean heat. Crash, steal or shoot and they rise;",
    "police cars will chase and try to box you in — if one",
    "stays close while you're slow, the bust meter fills.",
    "Lose them and your heat cools down.",
    "",
    "Finish all five of Vela's jobs to beat the story.",
  ];
  lines.forEach((line, i) => ctx.fillText(line, x + 30, y + 92 + i * 24));
  button(ctx, state, "back", x + w / 2 - 90, y + h - 56, 180, 40, "BACK", true);
}

export function drawFailed(ctx, state, view) {
  const { width: W, height: H } = view;
  dim(ctx, view, 0.55);
  state.buttons = [];
  const w = 520, h = 240, x = W / 2 - w / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h, "rgba(255, 240, 235, 0.95)");
  ctx.fillStyle = "#c1272d";
  ctx.font = "900 36px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(state.failReason?.startsWith("BUSTED") ? "BUSTED" : "JOB FAILED", W / 2, y + 66);
  ctx.fillStyle = INK;
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(state.failReason ?? "", W / 2, y + 106);
  ctx.textAlign = "left";
  button(ctx, state, "retry", x + 50, y + h - 70, 190, 44, "RETRY (R)", true);
  button(ctx, state, "quit-title", x + w - 240, y + h - 70, 190, 44, "TITLE");
}

export function drawFinal(ctx, state, view) {
  const { width: W, height: H } = view;
  dim(ctx, view, 0.4);
  state.buttons = [];
  const w = 540, h = 330, x = W / 2 - w / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff6b4a";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillText("THE LEDGER IS GONE · THE PLANE IS GONE · YOU MADE IT", W / 2, y + 42);
  ctx.fillStyle = INK;
  ctx.font = "900 36px system-ui, sans-serif";
  ctx.fillText("STORY COMPLETE", W / 2, y + 88);
  ctx.font = "17px system-ui, sans-serif";
  const mins = Math.floor(state.storyTime / 60), secs = Math.floor(state.storyTime % 60);
  ctx.fillText(`Jobs finished: 5 of 5`, W / 2, y + 140);
  ctx.fillText(`Money earned: $${state.money.toLocaleString("en-US")}`, W / 2, y + 172);
  ctx.fillText(`Time on the run: ${mins}:${String(secs).padStart(2, "0")}`, W / 2, y + 204);
  ctx.textAlign = "left";
  button(ctx, state, "freeroam", x + 45, y + h - 70, 200, 44, "FREE ROAM", true);
  button(ctx, state, "quit-title", x + w - 245, y + h - 70, 200, 44, "TITLE");
}
