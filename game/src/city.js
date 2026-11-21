// city.js — Port Leonida: the world of LEONIDA PROTOCOL.
// Builds the whole city deterministically from a seeded RNG: a pastel art-deco
// street grid, a beach and marina on the east coast, a causeway to a small
// island, and an airport in the north-west. Also owns the ground rules (what is
// road, water, walkable) and the road graph that traffic and pursuers drive on.

export const WORLD = { w: 4608, h: 2688 };

// Main street centrelines. Blocks sit between consecutive roads.
export const ROADS_X = [288, 672, 1056, 1440, 1824, 2208, 2592, 2976, 3360];
export const ROADS_Y = [288, 672, 1056, 1440, 1824, 2208, 2496];
export const ROAD_HALF = 54;

export const COAST_X = 3744; // sand starts here
export const WATER_X = 3968; // open water starts here
export const CAUSEWAY_Y = 1440;
export const ISLAND = { x: 4272, y: 1152, w: 336, h: 576 };
export const RUNWAY = { x: 120, y: 176, w: 1380, h: 88 };

// A small seeded RNG so the city is the same city on every visit.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_COLORS = [
  "#ffd9b3", "#ffc4a3", "#f7a8b8", "#a8d8ea", "#b8e6c9", "#f9e79f",
  "#e6c3f0", "#ffb3a0", "#c9e7ff", "#fdebd3", "#ffe0cc", "#d5f0e0",
];
const ROOF_COLORS = ["#e8977a", "#d97f66", "#7fc7bd", "#5fb3a9", "#e8b4c8", "#c9a86a", "#8fb8d8", "#d98c8c"];

export const LANDMARKS = {
  palmsHotel: { x: 1630, y: 800, name: "Palms Hotel" },
  beachClub: { x: 3470, y: 1050, name: "Coral Beach Club" },
  marinaOffice: { x: 3480, y: 2190, name: "Marina Office" },
  diner: { x: 2380, y: 1180, name: "Cora's Diner" },
  terminal: { x: 1660, y: 330, name: "Leonida Int'l Terminal" },
  islandEnd: { x: 4520, y: 1440, name: "Isla Serena" },
  buoy: { x: 4400, y: 2120, name: "The Buoy" },
  playerStart: { x: 1470, y: 612, name: "Start" },
};

function rectsOverlap(a, b, pad = 0) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

export function buildCity() {
  const rng = mulberry32(20261121);
  const buildings = [];
  const palms = [];
  const lamps = [];
  const parks = [];
  const parkingSpots = [];

  const addBuilding = (x, y, w, h, height, name = null) => {
    const color = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
    const roof = ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)];
    const b = {
      x, y, w, h, height, color, roof, name,
      windowsSeed: Math.floor(rng() * 1e9),
      deco: rng() < 0.4 ? "band" : rng() < 0.5 ? "step" : "flat",
    };
    buildings.push(b);
    return b;
  };

  // --- city blocks between the roads -------------------------------------
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) {
      const bx = ROADS_X[i] + ROAD_HALF + 14;
      const by = ROADS_Y[j] + ROAD_HALF + 14;
      const bw = ROADS_X[i + 1] - ROADS_X[i] - ROAD_HALF * 2 - 28;
      const bh = ROADS_Y[j + 1] - ROADS_Y[j] - ROAD_HALF * 2 - 28;
      if (bw < 120 || bh < 120) continue;
      const roll = rng();
      const downtown = i >= 2 && i <= 4 && j >= 1 && j <= 3;
      if (roll < 0.14) {
        // a park block: lawn, palms, a fountain square
        parks.push({ x: bx, y: by, w: bw, h: bh });
        for (let p = 0; p < 7; p++) {
          palms.push({ x: bx + 20 + rng() * (bw - 40), y: by + 20 + rng() * (bh - 40), s: 0.8 + rng() * 0.5 });
        }
      } else if (roll < 0.24) {
        // a parking lot block: asphalt with rows of parked cars to steal
        parks.push({ x: bx, y: by, w: bw, h: bh, lot: true });
        for (let px = bx + 34; px < bx + bw - 30; px += 52) {
          for (let py = by + 40; py < by + bh - 30; py += 84) {
            if (rng() < 0.72) parkingSpots.push({ x: px, y: py, angle: Math.PI / 2 });
          }
        }
      } else {
        // buildings: one tower or a pair of smaller deco blocks
        if (downtown || rng() < 0.45) {
          addBuilding(bx + bw * 0.14, by + bh * 0.12, bw * 0.72, bh * 0.76, downtown ? 64 + rng() * 60 : 34 + rng() * 30);
        } else {
          addBuilding(bx + 6, by + 8, bw * 0.44, bh * 0.6, 20 + rng() * 22);
          addBuilding(bx + bw * 0.54, by + bh * 0.3, bw * 0.42, bh * 0.62, 18 + rng() * 22);
        }
        if (rng() < 0.6) palms.push({ x: bx + 8, y: by + bh - 10, s: 0.75 + rng() * 0.4 });
      }
    }
  }

  // --- named landmark buildings ------------------------------------------
  const hotel = addBuilding(1500, 734, 260, 200, 110, "PALMS HOTEL");
  hotel.color = "#ffe3ba"; hotel.roof = "#e8977a";
  const club = addBuilding(3520, 1114, 190, 140, 26, "CORAL BEACH CLUB");
  club.color = "#ffd1dc"; club.roof = "#5fb3a9";
  const marina = addBuilding(3540, 2266, 170, 120, 22, "MARINA OFFICE");
  marina.color = "#c9e7ff"; marina.roof = "#e8977a";
  const diner = addBuilding(2300, 1114, 150, 100, 16, "CORA'S DINER");
  diner.color = "#fff3e0"; diner.roof = "#d94f4f";
  const terminal = addBuilding(1560, 130, 210, 96, 30, "LEONIDA INT'L");
  terminal.color = "#e8f4ff"; terminal.roof = "#7fc7bd";
  // island buildings on Isla Serena
  addBuilding(4330, 1210, 110, 90, 20, "ISLA SERENA");
  addBuilding(4380, 1560, 130, 100, 26);
  for (let p = 0; p < 6; p++) palms.push({ x: 4300 + rng() * 280, y: 1180 + rng() * 520, s: 0.9 + rng() * 0.5 });

  // --- palms along the beach and the coast road ---------------------------
  for (let y = 160; y < WORLD.h - 120; y += 120 + rng() * 90) {
    palms.push({ x: COAST_X + 30 + rng() * 60, y, s: 0.9 + rng() * 0.6 });
    if (rng() < 0.7) palms.push({ x: 3340 - rng() * 30, y: y + 40, s: 0.8 + rng() * 0.4 });
  }
  // lamps along every road
  for (const x of ROADS_X) for (let y = 120; y < WORLD.h; y += 210) lamps.push({ x: x - ROAD_HALF - 8, y });
  for (const y of ROADS_Y) for (let x = 140; x < COAST_X; x += 230) lamps.push({ x, y: y - ROAD_HALF - 8 });

  // marina docks: planks over the water, walkable, with moored boats
  const docks = [1900, 2080, 2260].map((y) => ({ x: WATER_X, y: y - 13, w: 190, h: 26 }));

  const city = {
    buildings, palms, lamps, parks, parkingSpots, docks,
    graph: buildRoadGraph(),
  };
  return city;
}

// --- ground rules -----------------------------------------------------------

export function onCauseway(x, y) {
  return Math.abs(y - CAUSEWAY_Y) < ROAD_HALF + 6 && x >= ROADS_X[ROADS_X.length - 1] && x <= ISLAND.x + 6;
}

export function onIsland(x, y) {
  return x >= ISLAND.x && x <= ISLAND.x + ISLAND.w && y >= ISLAND.y && y <= ISLAND.y + ISLAND.h;
}

export function onDock(city, x, y) {
  return city.docks.some((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h);
}

export function isWater(city, x, y) {
  if (x < WATER_X) return false;
  if (onIsland(x, y) || onCauseway(x, y) || onDock(city, x, y)) return false;
  return true;
}

// Ground a pedestrian or a car can be on: anything that is not open water.
export function isSolidGround(city, x, y) {
  return x >= 8 && y >= 8 && x <= WORLD.w - 8 && y <= WORLD.h - 8 && !isWater(city, x, y);
}

export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// --- road graph -------------------------------------------------------------

function buildRoadGraph() {
  const nodes = [];
  const index = new Map();
  const addNode = (x, y) => {
    const key = `${x},${y}`;
    if (index.has(key)) return index.get(key);
    const node = { x, y, edges: [] };
    index.set(key, nodes.length);
    nodes.push(node);
    return nodes.length - 1;
  };
  const link = (a, b) => {
    nodes[a].edges.push(b);
    nodes[b].edges.push(a);
  };
  for (const x of ROADS_X) for (const y of ROADS_Y) addNode(x, y);
  for (const y of ROADS_Y) {
    for (let i = 0; i < ROADS_X.length - 1; i++) link(index.get(`${ROADS_X[i]},${y}`), index.get(`${ROADS_X[i + 1]},${y}`));
  }
  for (const x of ROADS_X) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) link(index.get(`${x},${ROADS_Y[j]}`), index.get(`${x},${ROADS_Y[j + 1]}`));
  }
  // the causeway chain east to the island
  const chain = [3360, 3744, 4010, 4272, 4440].map((x) => addNode(x, CAUSEWAY_Y));
  for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1]);
  return { nodes };
}

export function nearestNode(city, x, y) {
  let best = 0, bestD = Infinity;
  city.graph.nodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

// Shortest road route between two points, as world-space waypoints (the two
// endpoints included). Cars drive it lane-offset; see actors.js.
export function route(city, from, to) {
  const { nodes } = city.graph;
  const start = nearestNode(city, from.x, from.y);
  const goal = nearestNode(city, to.x, to.y);
  if (start === goal) return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
  const prev = new Array(nodes.length).fill(-1);
  const seen = new Array(nodes.length).fill(false);
  const queue = [start];
  seen[start] = true;
  while (queue.length) {
    const cur = queue.shift();
    if (cur === goal) break;
    for (const next of nodes[cur].edges) {
      if (!seen[next]) { seen[next] = true; prev[next] = cur; queue.push(next); }
    }
  }
  const path = [];
  let cur = goal;
  while (cur !== -1) { path.push({ x: nodes[cur].x, y: nodes[cur].y }); cur = prev[cur]; }
  path.reverse();
  path[0] = { x: from.x, y: from.y };
  path.push({ x: to.x, y: to.y });
  return path;
}
