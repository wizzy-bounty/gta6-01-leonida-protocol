// missions.js — the story of LEONIDA PROTOCOL: five chained jobs for the
// fixer Vela, from a golden-hour favour to a night flight out of Port Leonida.
// Owns the mission data, the objective runner, timers, rewards and failures.

import { LANDMARKS } from "./city.js";
import { makeCar, commitCrime } from "./actors.js";
import { sfx } from "./audio.js";

export const MISSIONS = [
  {
    id: "getaway",
    title: "Golden Hour Getaway",
    from: "VELA — the fixer",
    brief: [
      "Jules. Your cousin Rico left his convertible at the Palms Hotel",
      "and the valet is asking questions I don't like.",
      "Take the car. Drive it to the Coral Beach Club. Smile for no one.",
    ],
    reward: 450, dayPhase: 0.08, heatFloor: 0, timeLimit: 0,
    setup(state) {
      const car = makeCar(1466, 640, Math.PI / 2, { driver: "parked", color: "#ff6b4a", convertible: true, marked: true });
      state.cars.push(car);
      state.markedCar = car;
      return [
        { type: "enterMarkedCar", text: "Get into Rico's convertible" },
        { type: "goto", x: LANDMARKS.beachClub.x, y: LANDMARKS.beachClub.y, mode: "car", radius: 70, text: "Drive to the Coral Beach Club" },
      ];
    },
  },
  {
    id: "courier",
    title: "The Courier Run",
    from: "VELA — the fixer",
    brief: [
      "A pouch is waiting at the Marina Office, south end of the beach.",
      "Pick it up and get it to Leonida Int'l — a man in a teal suit",
      "is flying out and he does not wait. Neither should you.",
    ],
    reward: 700, dayPhase: 0.32, heatFloor: 0, timeLimit: 115,
    setup() {
      return [
        { type: "pickup", x: LANDMARKS.marinaOffice.x, y: LANDMARKS.marinaOffice.y, mode: "any", radius: 58, text: "Pick up the pouch at the Marina Office" },
        { type: "goto", x: LANDMARKS.terminal.x, y: LANDMARKS.terminal.y, mode: "any", radius: 66, text: "Deliver it to Leonida Int'l Terminal" },
      ];
    },
  },
  {
    id: "causeway",
    title: "Causeway Chase",
    from: "RICO — your cousin",
    brief: [
      "The drop on the causeway went bad, Jules. Badges everywhere.",
      "Floor it east, across the water, and don't stop until",
      "Isla Serena. Whatever you do — don't get boxed in.",
    ],
    reward: 900, dayPhase: 0.55, heatFloor: 3, timeLimit: 0,
    setup(state) {
      teleportToCar(state, 2380, 1083, 0, "#2ec4b6");
      return [
        { type: "goto", x: LANDMARKS.islandEnd.x, y: LANDMARKS.islandEnd.y, mode: "car", radius: 76, text: "Escape to Isla Serena, far end of the causeway" },
      ];
    },
  },
  {
    id: "marina",
    title: "Marina Escape",
    from: "SAL — the marina keeper",
    brief: [
      "Roads are watched, kid. Water isn't.",
      "My speedboat's moored at the middle dock, gassed and ready.",
      "Take her out to the buoy past the bay and kill the engine.",
    ],
    reward: 1100, dayPhase: 0.78, heatFloor: 2, timeLimit: 0,
    setup(state) {
      const p = state.player;
      p.mode = "foot"; p.car = null; p.boat = null;
      p.x = LANDMARKS.beachClub.x; p.y = LANDMARKS.beachClub.y + 90;
      const boat = state.boats[1] ?? state.boats[0];
      boat.marked = true;
      state.markedBoat = boat;
      return [
        { type: "goto", x: 4060, y: 2080, mode: "any", radius: 60, text: "Reach the middle dock at the marina" },
        { type: "enterMarkedBoat", text: "Board Sal's speedboat (E)" },
        { type: "goto", x: LANDMARKS.buoy.x, y: LANDMARKS.buoy.y, mode: "boat", radius: 90, text: "Sail to the buoy beyond the bay" },
      ];
    },
  },
  {
    id: "flight",
    title: "Last Flight Out",
    from: "VELA — the fixer",
    brief: [
      "Last job, Jules. The ledger flies tonight and you're on it.",
      "Every badge in Port Leonida knows your face by now.",
      "Get to the plane on the runway before it leaves without you.",
    ],
    reward: 1500, dayPhase: 1.0, heatFloor: 4, timeLimit: 120,
    setup(state) {
      teleportToCar(state, 1850, 1467, 0, "#ffd23f");
      return [
        { type: "goto", x: 1300, y: 220, mode: "any", radius: 88, text: "Reach the plane on the runway" },
      ];
    },
  },
];

function teleportToCar(state, x, y, angle, color) {
  const p = state.player;
  const car = makeCar(x, y, angle, { driver: "player", color, convertible: false });
  state.cars.push(car);
  p.mode = "car";
  p.car = car;
  p.boat = null;
  p.x = x; p.y = y; p.angle = angle;
  state.lastCar = car;
}

// ------------------------------------------------------------ runner

export function startMission(state, idx) {
  const m = MISSIONS[idx];
  state.missionIdx = idx;
  state.mission = m;
  state.steps = m.setup(state);
  state.stepIdx = 0;
  state.missionTime = 0;
  state.screen = "briefing";
  state.busted = false;
  state.bust = 0;
  state.dayPhaseTarget = m.dayPhase;
  refreshMarker(state);
}

export function beginMission(state) {
  const m = state.mission;
  state.screen = "play";
  state.heat = Math.max(m.heatFloor, Math.min(state.heat, m.heatFloor + 0.5));
  state.wanted = Math.ceil(state.heat);
  state.toast(`${m.title} — go!`);
  sfx.click();
}

export function currentStep(state) {
  return state.steps[state.stepIdx] ?? null;
}

function refreshMarker(state) {
  const step = currentStep(state);
  if (!step) { state.marker = null; return; }
  if (step.type === "enterMarkedCar" && state.markedCar) {
    state.marker = { x: state.markedCar.x, y: state.markedCar.y };
  } else if (step.type === "enterMarkedBoat" && state.markedBoat) {
    state.marker = { x: state.markedBoat.x, y: state.markedBoat.y };
  } else {
    state.marker = { x: step.x, y: step.y };
  }
  state.objectiveText = step.text;
}

function stepDone(state, step) {
  const p = state.player;
  switch (step.type) {
    case "enterMarkedCar":
      return p.mode === "car" && p.car === state.markedCar;
    case "enterMarkedBoat":
      return p.mode === "boat" && p.boat === state.markedBoat;
    case "pickup":
    case "goto": {
      const pos = p.mode === "car" ? p.car : p.mode === "boat" ? p.boat : p;
      if (step.mode === "car" && p.mode !== "car") return false;
      if (step.mode === "boat" && p.mode !== "boat") return false;
      return Math.hypot(pos.x - step.x, pos.y - step.y) < step.radius;
    }
    default:
      return false;
  }
}

export function updateMission(state, dt) {
  if (state.screen !== "play") return;
  const m = state.mission;
  state.missionTime += dt;
  refreshMarker(state);

  if (state.markedCar && state.markedCar.wrecked && state.missionIdx === 0) {
    return failMission(state, "Rico's convertible is wrecked.");
  }
  if (state.busted) return failMission(state, "BUSTED — the police boxed you in.");
  if (m.timeLimit > 0 && state.missionTime > m.timeLimit) {
    return failMission(state, "Out of time — the job moved on without you.");
  }

  const step = currentStep(state);
  if (step && stepDone(state, step)) {
    if (step.type === "pickup") {
      sfx.pickup();
      state.toast("Pouch collected. Move!");
      commitCrime(state, 0.2);
    }
    state.stepIdx++;
    if (state.stepIdx >= state.steps.length) return completeMission(state);
    refreshMarker(state);
  }
}

function completeMission(state) {
  const m = state.mission;
  state.money += m.reward;
  state.missionsDone++;
  sfx.success();
  state.toast(`Job done — $${m.reward} earned`);
  state.saveGame();
  if (state.markedCar) state.markedCar.marked = false;
  if (state.markedBoat) state.markedBoat.marked = false;
  state.markedCar = null;
  state.markedBoat = null;
  const next = state.missionIdx + 1;
  if (next >= MISSIONS.length) {
    state.screen = "final";
    state.storyComplete = true;
    state.saveGame();
  } else {
    startMission(state, next);
  }
}

export function failMission(state, reason) {
  state.screen = "failed";
  state.failReason = reason;
  sfx.fail();
}

export function retryMission(state) {
  // clean up mission-spawned vehicles before the setup runs again
  if (state.markedCar) {
    state.cars = state.cars.filter((c) => c !== state.markedCar);
    state.markedCar = null;
  }
  if (state.markedBoat) {
    state.markedBoat.marked = false;
    state.markedBoat = null;
  }
  if (state.player.mode === "car" && state.player.car) {
    state.cars = state.cars.filter((c) => c !== state.player.car);
  }
  state.player.mode = "foot";
  state.player.car = null;
  state.player.boat = null;
  state.heat = 0;
  state.wanted = 0;
  state.busted = false;
  state.bust = 0;
  startMission(state, state.missionIdx);
}

export function timeLeft(state) {
  const m = state.mission;
  if (!m || m.timeLimit <= 0) return null;
  return Math.max(0, m.timeLimit - state.missionTime);
}
