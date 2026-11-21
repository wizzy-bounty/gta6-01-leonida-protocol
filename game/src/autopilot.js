// autopilot.js — a demo driver for LEONIDA PROTOCOL.
// Steers the player through the current objective with the same controls a
// human uses (it returns a control object, never touches the car directly).
// Powers the attract mode, the screenshot scenes and the end-to-end test.

import { route, WATER_X } from "./city.js";

export function createAutopilot() {
  return {
    path: null,
    pathKey: "",
    repath: 0,
    update(state, dt) {
      const ctl = { up: false, down: false, left: false, right: false, run: true, interact: false, shoot: false };
      const step = state.steps[state.stepIdx];
      if (!step || state.screen !== "play") return ctl;
      const p = state.player;

      // --- decide the target and the vehicle we need ----------------------
      let target = null;
      let wantMode = "any";
      if (step.type === "enterMarkedCar") {
        if (p.mode === "car") return ctl;
        target = state.markedCar;
        wantMode = "enter";
      } else if (step.type === "enterMarkedBoat") {
        if (p.mode === "boat") return ctl;
        target = state.markedBoat;
        wantMode = "enter";
      } else {
        target = { x: step.x, y: step.y };
        wantMode = step.mode;
      }
      if (!target) return ctl;

      // --- on foot ---------------------------------------------------------
      if (p.mode === "foot") {
        // need a car for a driving step and not next to one? walk to the
        // nearest car first (the marked one when the step names it)
        const needsCar = wantMode === "car" || (wantMode === "any" && state.missionIdx !== 3);
        if (wantMode === "enter" || needsCar) {
          let carTarget = wantMode === "enter" && step.type === "enterMarkedCar" ? state.markedCar : null;
          if (wantMode === "enter" && step.type === "enterMarkedBoat") carTarget = null;
          if (!carTarget && needsCar) {
            let bestD = 1e9;
            for (const c of state.cars) {
              if (c.wrecked || c.driver === "police") continue;
              const d = Math.hypot(c.x - p.x, c.y - p.y);
              if (d < bestD) { bestD = d; carTarget = c; }
            }
          }
          const goal = step.type === "enterMarkedBoat" ? target : (carTarget ?? target);
          const dGoal = Math.hypot(goal.x - p.x, goal.y - p.y);
          if (step.type !== "enterMarkedBoat" && carTarget && dGoal < 34) { ctl.interact = true; return ctl; }
          if (step.type === "enterMarkedBoat" && dGoal < 58) { ctl.interact = true; return ctl; }
          walkToward(ctl, p, footWaypoint(state, p, goal));
          return ctl;
        }
        walkToward(ctl, p, footWaypoint(state, p, target));
        return ctl;
      }

      // --- in a boat --------------------------------------------------------
      if (p.mode === "boat") {
        steerVehicle(ctl, p.boat, target.x, target.y, dt, this);
        return ctl;
      }

      // --- in a car ----------------------------------------------------------
      if (p.mode === "car") {
        if (wantMode === "boat") {
          // drive to the dock road end, then get out and walk
          const dockGate = { x: 3420, y: 2080 };
          if (Math.hypot(p.car.x - dockGate.x, p.car.y - dockGate.y) > 90) {
            this.driveTo(state, ctl, dockGate, dt);
          } else {
            ctl.interact = Math.abs(p.car.speed) < 20;
          }
          return ctl;
        }
        this.driveTo(state, ctl, target, dt);
        return ctl;
      }
      return ctl;
    },

    driveTo(state, ctl, target, dt) {
      const car = state.player.car;
      const key = `${state.missionIdx}:${state.stepIdx}:${Math.round(target.x)},${Math.round(target.y)}`;
      this.repath -= dt;
      if (this.pathKey !== key || !this.path || this.repath <= 0) {
        this.path = route(state.city, car, target);
        this.pathKey = key;
        this.repath = 3;
        // find the first waypoint ahead of us
        this.pathI = 1;
      }
      let wp = this.path[Math.min(this.pathI, this.path.length - 1)];
      while (wp && Math.hypot(wp.x - car.x, wp.y - car.y) < 52 && this.pathI < this.path.length - 1) {
        this.pathI++;
        wp = this.path[this.pathI];
      }
      steerVehicle(ctl, car, wp.x, wp.y, dt, this);
    },
  };
}

// Walking waypoint: if the goal is across the waterline (a dock), first walk
// to the shoreline at the goal's height so we step onto the planks; once we
// are at the shoreline, head for the goal itself across the dock.
function footWaypoint(state, p, goal) {
  if (goal.x > WATER_X && p.x < WATER_X - 6) {
    const shore = { x: WATER_X - 8, y: goal.y };
    if (Math.hypot(shore.x - p.x, shore.y - p.y) > 14) return shore;
  }
  return goal;
}

function walkToward(ctl, p, target) {
  const dx = target.x - p.x, dy = target.y - p.y;
  if (Math.abs(dx) > 4) { if (dx < 0) ctl.left = true; else ctl.right = true; }
  if (Math.abs(dy) > 4) { if (dy < 0) ctl.up = true; else ctl.down = true; }
}

function steerVehicle(ctl, v, tx, ty, dt, self) {
  const desired = Math.atan2(ty - v.y, tx - v.x);
  let diff = desired - v.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > 0.06) ctl.right = true;
  else if (diff < -0.06) ctl.left = true;
  const d = Math.hypot(tx - v.x, ty - v.y);
  if (Math.abs(diff) > 2.5 && d < 130) {
    // badly turned around: back up while steering
    ctl.down = true;
    ctl.left = diff > 0;
    ctl.right = diff < 0;
  } else if (Math.abs(diff) < 0.9) {
    ctl.up = true;
  } else {
    ctl.up = Math.abs(v.speed) < 120;
    ctl.down = Math.abs(v.speed) >= 120;
  }
  void dt; void self;
}
