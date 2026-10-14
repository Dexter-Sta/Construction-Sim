const svg = document.getElementById("site");
const NS = "http://www.w3.org/2000/svg";
const SITE = { w: 1920, h: 1240 };
const START = { x: 480, y: 310 };
const MIN_VIEW_W = 160;
const layerAreas = document.getElementById("layer-areas");
const layerUtilities = document.getElementById("layer-utilities");
const layerLinework = document.getElementById("layer-linework");
const layerHaul = document.getElementById("layer-haul");
const layerActors = document.getElementById("layer-actors");
const layerMeasures = document.getElementById("layer-measures");
const layerUi = document.getElementById("layer-ui");

const EQUIP_R = 28;
const BLOCK = 24;
const HANDLE_R = 8;
const LINE_HIT = 10;
const AREA_HANDLE = 8;
const SNAP = 14;
const DIM_OFF = 22;
const MAX_EQUIPMENT = 24;
const MAX_DUMPS = 8;
const MAX_HAULS = 8;
const MAX_MEASURES = 24;
const MAX_SUPPLIES = 80;
const MAX_UTILITIES = 24;
const MAX_DRAWINGS = 80;
const MIN_AREA = 56;

const DRAW_TOOLS = [
  { id: "line", label: "Line", clicks: 2, hint: "Click start, then end. Shift locks H/V." },
  { id: "polyline", label: "Polyline", min: 2, enter: true, hint: "Click vertices. Enter or double-click finishes." },
  { id: "arc", label: "Arc", clicks: 3, hint: "Click start, a point on the arc, then end." },
  { id: "circle", label: "Circle", clicks: 2, hint: "Click center, then a point on the rim." },
  { id: "rect", label: "Rectangle", clicks: 2, hint: "Click two corners. Shift makes a square." },
  { id: "polygon", label: "Polygon", min: 3, enter: true, closed: true, hint: "Click vertices. Enter or double-click closes." },
  { id: "freehand", label: "Freehand line", drag: true, min: 2, hint: "Click and drag to sketch a line." },
  { id: "spline", label: "Spline", min: 2, enter: true, hint: "Click control points. Enter or double-click finishes the curve." },
  { id: "point", label: "Point", clicks: 1, hint: "Click to place a point." },
  { id: "text", label: "Text box", clicks: 1, hint: "Click to place a note, then type." },
  { id: "leader", label: "Leader", clicks: 2, hint: "Click the target, then the text. Type to edit." },
  { id: "arrow", label: "Arrow", clicks: 2, hint: "Click tail, then head. Shift locks H/V." },
  { id: "hatch", label: "Hatch / fill", min: 3, enter: true, closed: true, hint: "Click a boundary. Enter or double-click fills it." },
];

const EQUIP_CATALOG = {
  excavator: {
    label: "Excavator",
    short: "EX",
    role: "load",
    color: "#ef6c00",
    rate: 380,
    bucket: 2.5,
    sprite: true,
  },
  "hydraulic-excavator": {
    label: "Hydraulic excavator",
    short: "HEX",
    role: "load",
    color: "#ef6c00",
    rate: 380,
    bucket: 2.5,
  },
  "articulated-dump": {
    label: "Articulated dump truck",
    short: "ADT",
    role: "haul",
    color: "#e0a800",
    rate: 0,
    cap: 22,
    destinations: ["stockpile"],
    truckSprite: "sprite-adt",
  },
  bulldozer: {
    label: "Bulldozer",
    short: "DOZ",
    role: "support",
    color: "#f9a825",
    rate: 200,
  },
  "wheel-loader": {
    label: "Wheel loader",
    short: "WL",
    role: "load",
    color: "#fb8c00",
    rate: 320,
    bucket: 4,
  },
  "soil-compactor": {
    label: "Soil compactor / roller",
    short: "ROL",
    role: "support",
    color: "#546e7a",
    rate: 150,
  },
  "on-road-dump": {
    label: "Dump truck",
    short: "DT",
    role: "haul",
    color: "#1565c0",
    rate: 0,
    cap: 14,
    destinations: ["offsite", "stockpile"],
    truckSprite: "sprite-truck",
  },
  "compact-track-loader": {
    label: "Compact track loader",
    short: "CTL",
    role: "load",
    color: "#6d4c41",
    rate: 180,
    bucket: 0.9,
  },
  "backhoe-loader": {
    label: "Backhoe loader",
    short: "BHL",
    role: "load",
    color: "#ff8f00",
    rate: 140,
    bucket: 1,
  },
  trencher: {
    label: "Trencher",
    short: "TRN",
    role: "load",
    color: "#8d6e63",
    rate: 80,
    bucket: 0.5,
  },
};

const MATERIALS = {
  soil: { label: "Soil", swell: 25, compaction: 10 },
  clay: { label: "Clay", swell: 35, compaction: 15 },
  sand: { label: "Sand", swell: 12, compaction: 10 },
  gravel: { label: "Gravel", swell: 12, compaction: 8 },
  asphalt: { label: "Asphalt", swell: 40, compaction: 5 },
  concrete: { label: "Concrete", swell: 60, compaction: 5 },
};

function materialSpec(area) {
  return MATERIALS[area.material] || MATERIALS.soil;
}

function materialLabel(area) {
  return materialSpec(area).label;
}

function resetMaterialFactors(area) {
  const spec = materialSpec(area);
  area.swellPct = spec.swell;
  area.compactPct = spec.compaction;
}

function factorOn(area) {
  return area.kind === "cut" ? !!area.swellOn : !!area.compactOn;
}

function factorPct(area) {
  return area.kind === "cut" ? area.swellPct : area.compactPct;
}

function adjustedVolume(area) {
  const vol = terrain.areaVolumes.get(area.id) || 0;
  return factorOn(area) ? vol * (1 + factorPct(area) / 100) : vol;
}

function areaVolumeText(area) {
  const vol = terrain.areaVolumes.get(area.id) || 0;
  const material = materialLabel(area).toLowerCase();
  if (!factorOn(area)) {
    return `${area.kind === "cut" ? "Cut" : "Fill"} ${formatCy(vol)} ${material}`;
  }
  return area.kind === "cut"
    ? `Cut ${formatCy(vol)} bank · ${formatCy(adjustedVolume(area))} loose ${material}`
    : `Fill ${formatCy(vol)} compacted · ${formatCy(adjustedVolume(area))} ${material} needed`;
}

const UTILITY_CATALOG = {
  sanitary: { label: "Sanitary", short: "SS", color: "#43a047", depth: 8, diameter: 8 },
  gas: { label: "Gas", short: "G", color: "#fdd835", depth: 3, diameter: 2 },
  water: { label: "Water", short: "W", color: "#1e88e5", depth: 5, diameter: 8 },
  electric: { label: "Electric", short: "E", color: "#e53935", depth: 3, diameter: 4 },
};

const SUPPLY_CATALOG = {
  "traffic-cone": { label: "Traffic cones", short: "TC", color: "#ff6d00", size: 10 },
  "candlestick-cone": { label: "Candlestick cones", short: "CS", color: "#ff9100", size: 10 },
  "jersey-barrier": { label: "Jersey barriers", short: "JB", color: "#9e9e9e", size: 14 },
  "mafia-block": { label: "Mafia blocks", short: "MB", color: "#757575", size: 14 },
  sign: { label: "Sign", short: "SGN", color: "#f9a825", size: 12, text: true },
  fence: { label: "Fence", short: "FEN", color: "#8d6e63", size: 14 },
  rope: { label: "Rope", short: "RP", color: "#a1887f", size: 10 },
  stakes: { label: "Stakes", short: "STK", color: "#795548", size: 10 },
  "connex-box": { label: "Connex box", short: "CNX", color: "#2e7d32", size: 20 },
  "jobsite-trailer": { label: "Jobsite trailer", short: "TRL", color: "#546e7a", size: 22 },
  "portable-toilet": { label: "Portable toilets", short: "PT", color: "#1e88e5", size: 12 },
  "water-diversion-barrier": { label: "Water diversion barriers", short: "WDB", color: "#0277bd", size: 14 },
  sandbags: { label: "Sandbags", short: "SB", color: "#a68a55", size: 12 },
  "steel-plates": { label: "Steel plates", short: "SP", color: "#455a64", size: 16 },
  "temp-lighting": { label: "Temp lighting", short: "LT", color: "#f57f17", size: 12 },
  generator: { label: "Generators", short: "GEN", color: "#e65100", size: 14 },
  "water-hose": { label: "Water hose", short: "HOS", color: "#00897b", size: 10 },
  "fuel-tank": { label: "Fuel tank", short: "FT", color: "#c62828", size: 14 },
  "spill-kit": { label: "Spill kit", short: "SK", color: "#ad1457", size: 10 },
  ladder: { label: "Ladder", short: "LAD", color: "#616161", size: 10 },
  "traffic-drum": { label: "Traffic drum", short: "TD", color: "#e64a19", size: 11 },
};

const state = {
  feetPerPx: 4,
  nextId: 9,
  selectedId: 1,
  focus: { kind: "equipment", id: 1 },
  equipment: [
    makePiece(1, "excavator", START.x + 180, START.y + 310, { areaId: 4 }),
    makePiece(5, "on-road-dump", START.x + 70, START.y + 520, { areaId: 4, haulId: 3 }),
    makePiece(6, "on-road-dump", START.x + 142, START.y + 520, { areaId: 4, haulId: 3 }),
    makePiece(7, "on-road-dump", START.x + 214, START.y + 520, { areaId: 4, haulId: 3 }),
    makePiece(8, "on-road-dump", START.x + 286, START.y + 520, { areaId: 4, haulId: 3 }),
  ],
  workAreas: [
    {
      id: 4,
      kind: "cut",
      name: "Cut 1",
      x: START.x + 100,
      y: START.y + 225,
      w: 220,
      h: 150,
      designElev: null,
      sideSlope: 2,
      material: "soil",
    },
  ],
  drawings: [],
  placing: null,
  drawing: false,
  measuring: false,
  grading: false,
  hoverPt: null,
  view: "plan",
  vexag: 6,
  showExisting: true,
  drawKind: "line",
  freehand: false,
  draft: [],
  hover: null,
  measures: [],
  supplies: [],
  utilities: [],
  dumps: [{ id: 2, kind: "offsite", x: START.x + 780, y: START.y + 220, hauled: 0 }],
  haulRoads: [
    {
      id: 3,
      dumpId: 2,
      waypoints: [
        { x: START.x + 340, y: START.y + 420 },
        { x: START.x + 560, y: START.y + 430 },
        { x: START.x + 700, y: START.y + 300 },
      ],
    },
  ],
  drag: null,
  pan: null,
  camera: { x: START.x, y: START.y, w: 960, h: 620 },
};

function makePiece(id, type, x, y, extra = {}) {
  const spec = EQUIP_CATALOG[type];
  return {
    id,
    type,
    x,
    y,
    rate: spec.rate,
    cap: spec.cap || 0,
    loadMode: "live",
    prodMode: "rate",
    bucket: spec.bucket || 1,
    fillSec: 8,
    dumpSec: 6,
    returnSec: 6,
    stockpileId: null,
    haulId: null,
    areaId: null,
    live: null,
    ...extra,
  };
}

const GRID = 5;
const DATUM = 100;
const CONTOUR_FT = 2;
const MIN_ELEV = DATUM - 80;
const MAX_ELEV = DATUM + 120;
const terrain = {
  cols: SITE.w / GRID + 1,
  rows: SITE.h / GRID + 1,
  ground: null,
  final: null,
  version: 0,
  surfaceVersion: 0,
  surfaceKey: "",
  minH: 0,
  maxH: 1,
  cut: 0,
  fill: 0,
  areaVolumes: new Map(),
  tin: { vertices: [], triangles: [] },
  tinTris: [],
  tinVersion: 0,
  tinKey: "",
};
terrain.ground = new Float32Array(terrain.cols * terrain.rows);
terrain.final = new Float32Array(terrain.cols * terrain.rows);

const grade = { active: false, pos: null, target: 0 };

function initialGround(sx, sy) {
  const x = sx - START.x;
  const y = sy - START.y;
  const hill = 42 * Math.exp(-((x - 210) ** 2 + (y - 300) ** 2) / (2 * 130 ** 2));
  const ridge =
    16 * Math.exp(-((x - 620) ** 2) / (2 * 90 ** 2)) * (0.6 + 0.4 * Math.sin(y / 90));
  const roll = 4 * Math.sin(x / 110 + 1.3) * Math.cos(y / 95);
  const tilt = -14 * (x / 960) + 5 * (y / 620);
  return DATUM + hill + ridge + roll + tilt;
}

function resetGround() {
  const { cols, rows, ground } = terrain;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) ground[r * cols + c] = initialGround(c * GRID, r * GRID);
  }
  terrain.version++;
}

function sampleGrid(arr, x, y) {
  const { cols, rows } = terrain;
  const fx = Math.max(0, Math.min(cols - 1.0001, x / GRID));
  const fy = Math.max(0, Math.min(rows - 1.0001, y / GRID));
  const c = Math.floor(fx);
  const r = Math.floor(fy);
  const u = fx - c;
  const v = fy - r;
  const i = r * cols + c;
  return (
    arr[i] * (1 - u) * (1 - v) +
    arr[i + 1] * u * (1 - v) +
    arr[i + cols] * (1 - u) * v +
    arr[i + cols + 1] * u * v
  );
}

function groundAt(p) {
  return sampleGrid(terrain.ground, p.x, p.y);
}

function surfaceAt(p) {
  return sampleGrid(terrain.final, p.x, p.y);
}

function meanGround(area) {
  const { cols, ground } = terrain;
  const c0 = Math.ceil(area.x / GRID);
  const c1 = Math.floor((area.x + area.w) / GRID);
  const r0 = Math.ceil(area.y / GRID);
  const r1 = Math.floor((area.y + area.h) / GRID);
  let sum = 0;
  let n = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      sum += ground[r * cols + c];
      n++;
    }
  }
  return n ? sum / n : groundAt({ x: area.x + area.w / 2, y: area.y + area.h / 2 });
}

function ensureDesign(area) {
  if (area.kind === "zone") return;
  if (!Number.isFinite(area.designElev)) {
    const mean = meanGround(area);
    area.designElev = Math.round(area.kind === "cut" ? mean - 12 : mean + 6);
  }
  if (!Number.isFinite(area.sideSlope) || area.sideSlope <= 0) area.sideSlope = 2;
  if (!Number.isFinite(area.swellPct) || !Number.isFinite(area.compactPct)) {
    resetMaterialFactors(area);
  }
}

function rectGap(x, y, area) {
  const dx = Math.max(area.x - x, 0, x - area.x - area.w);
  const dy = Math.max(area.y - y, 0, y - area.y - area.h);
  return Math.hypot(dx, dy);
}

const SURFACE_GRADED = new Set(["line", "polyline", "arc", "freehand", "spline", "arrow"]);
const SURFACE_LEVEL = new Set(["rect", "polygon", "circle", "hatch", "point"]);

function surfaceKind(kind) {
  return SURFACE_GRADED.has(kind) || SURFACE_LEVEL.has(kind);
}

function decimateStroke(points, step) {
  if (points.length <= 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const out = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= step) {
      out.push({ x: points[i].x, y: points[i].y });
    }
  }
  const end = points[points.length - 1];
  const last = out[out.length - 1];
  if (Math.hypot(end.x - last.x, end.y - last.y) > 0.5) out.push({ x: end.x, y: end.y });
  if (out.length <= 80) return out;
  const stride = Math.ceil(out.length / 80);
  const slim = out.filter((_, i) => i % stride === 0);
  const tail = out[out.length - 1];
  if (slim[slim.length - 1] !== tail) slim.push(tail);
  return slim;
}

function elevLabel(drawing) {
  if (!Number.isFinite(drawing?.z0)) return "";
  if (
    SURFACE_GRADED.has(drawing.kind) &&
    Number.isFinite(drawing.z1) &&
    drawing.z1 !== drawing.z0
  ) {
    return `${drawing.z0}–${drawing.z1} ft`;
  }
  return `${drawing.z0} ft`;
}

function lineworkFromDrawings(drawings) {
  const lines = [];
  for (const drawing of drawings) {
    if (!surfaceKind(drawing.kind) || !Number.isFinite(drawing.z0)) continue;
    const z1 = Number.isFinite(drawing.z1) ? drawing.z1 : drawing.z0;
    if (drawing.kind === "point") {
      const p = drawing.points[0];
      if (p) lines.push({ points: [{ x: p.x, y: p.y, z: drawing.z0 }] });
      continue;
    }
    const stroke = decimateStroke(drawingStroke(drawing), 8);
    if (stroke.length < 2) continue;
    const level = SURFACE_LEVEL.has(drawing.kind);
    let total = 0;
    const at = [0];
    for (let i = 1; i < stroke.length; i++) {
      total += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
      at.push(total);
    }
    lines.push({
      closed: level,
      points: stroke.map((p, i) => ({
        x: p.x,
        y: p.y,
        z: level || total === 0 ? drawing.z0 : drawing.z0 + ((z1 - drawing.z0) * at[i]) / total,
      })),
    });
  }
  return lines;
}

function indexTin(tin) {
  const tris = [];
  const { vertices, triangles } = tin;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = vertices[triangles[i]];
    const b = vertices[triangles[i + 1]];
    const c = vertices[triangles[i + 2]];
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-6) continue;
    tris.push({
      a,
      b,
      c,
      area,
      minX: Math.min(a.x, b.x, c.x),
      maxX: Math.max(a.x, b.x, c.x),
      minY: Math.min(a.y, b.y, c.y),
      maxY: Math.max(a.y, b.y, c.y),
    });
  }
  return tris;
}

function sampleTin(x, y) {
  for (const t of terrain.tinTris) {
    if (x < t.minX || x > t.maxX || y < t.minY || y > t.maxY) continue;
    const { a, b, c, area } = t;
    const w0 = ((b.x - x) * (c.y - y) - (b.y - y) * (c.x - x)) / area;
    const w1 = ((c.x - x) * (a.y - y) - (c.y - y) * (a.x - x)) / area;
    const w2 = ((a.x - x) * (b.y - y) - (a.y - y) * (b.x - x)) / area;
    if (w0 >= -1e-4 && w1 >= -1e-4 && w2 >= -1e-4) return w0 * a.z + w1 * b.z + w2 * c.z;
  }
  return null;
}

function rebuildTin() {
  const lines = lineworkFromDrawings(state.drawings);
  const key = JSON.stringify(lines);
  if (key === terrain.tinKey) return;
  terrain.tinKey = key;
  terrain.tin = createSurfaceFromLinework(lines);
  terrain.tinTris = indexTin(terrain.tin);
  terrain.tinVersion++;
}

function updateSurface() {
  rebuildTin();
  const shaped = state.workAreas.filter((a) => a.kind !== "zone");
  shaped.forEach(ensureDesign);
  const key = `${terrain.version}|${terrain.tinVersion}|${state.feetPerPx}|${shaped
    .map((a) => [a.id, a.kind, a.x, a.y, a.w, a.h, a.designElev, a.sideSlope].join(","))
    .join(";")}`;
  if (key === terrain.surfaceKey) return;
  terrain.surfaceKey = key;

  const { cols, rows, ground, final } = terrain;
  const fpp = state.feetPerPx;
  const cellCy = (GRID * fpp) ** 2 / 27;
  const perArea = new Map(shaped.map((a) => [a.id, 0]));
  let cut = 0;
  let fill = 0;
  let minH = Infinity;
  let maxH = -Infinity;
  for (let r = 0; r < rows; r++) {
    const y = r * GRID;
    for (let c = 0; c < cols; c++) {
      const x = c * GRID;
      const i = r * cols + c;
      const g = ground[i];
      const tinZ = sampleTin(x, y);
      let z = g;
      if (tinZ == null) {
        for (const a of shaped) {
          const rise = (rectGap(x, y, a) * fpp) / a.sideSlope;
          if (a.kind === "cut") {
            const design = a.designElev + rise;
            if (design < g) perArea.set(a.id, perArea.get(a.id) + (g - design) * cellCy);
            if (design < z) z = design;
          } else {
            const design = a.designElev - rise;
            if (design > g) perArea.set(a.id, perArea.get(a.id) + (design - g) * cellCy);
            if (design > z) z = design;
          }
        }
      } else {
        z = tinZ;
      }
      final[i] = z;
      if (z < g) cut += (g - z) * cellCy;
      else fill += (z - g) * cellCy;
      if (z < minH) minH = z;
      if (z > maxH) maxH = z;
    }
  }
  terrain.cut = cut;
  terrain.fill = fill;
  terrain.minH = minH;
  terrain.maxH = maxH;
  terrain.areaVolumes = perArea;
  terrain.surfaceVersion++;
}

function gradeSettings() {
  return {
    mode: document.getElementById("gradeMode").value,
    radius: Number(document.getElementById("gradeRadius").value) || 45,
    strength: Number(document.getElementById("gradeStrength").value) || 8,
  };
}

function beginGrade(p) {
  grade.active = true;
  grade.pos = p;
  grade.target = groundAt(p);
  state.hoverPt = p;
}

function moveGrade(p) {
  if (grade.active) grade.pos = p;
  state.hoverPt = p;
}

function endGrade() {
  grade.active = false;
}

function applyGrade(dt) {
  if (!grade.active || !grade.pos || dt <= 0) return;
  const { mode, radius, strength } = gradeSettings();
  const { cols, rows, ground } = terrain;
  const { x, y } = grade.pos;
  const c0 = Math.max(0, Math.floor((x - radius) / GRID));
  const c1 = Math.min(cols - 1, Math.ceil((x + radius) / GRID));
  const r0 = Math.max(0, Math.floor((y - radius) / GRID));
  const r1 = Math.min(rows - 1, Math.ceil((y + radius) / GRID));
  const ease = Math.min(1, (strength / 8) * dt * 4);
  const src = mode === "smooth" ? ground.slice() : ground;
  const at = (c, r) =>
    src[Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const d = Math.hypot(c * GRID - x, r * GRID - y);
      if (d > radius) continue;
      const f = 0.5 + 0.5 * Math.cos((Math.PI * d) / radius);
      const i = r * cols + c;
      let h = ground[i];
      if (mode === "raise") h += strength * dt * f;
      else if (mode === "lower") h -= strength * dt * f;
      else if (mode === "flatten") h += (grade.target - h) * ease * f;
      else {
        const avg =
          (at(c - 2, r) + at(c + 2, r) + at(c, r - 2) + at(c, r + 2) +
            at(c - 2, r - 2) + at(c + 2, r - 2) + at(c - 2, r + 2) + at(c + 2, r + 2)) /
          8;
        h += (avg - src[i]) * ease * f;
      }
      ground[i] = Math.max(MIN_ELEV, Math.min(MAX_ELEV, h));
    }
  }
  terrain.version++;
}

const RAMP_LOW = [104, 148, 66];
const RAMP_HIGH = [200, 184, 112];
const CUT_RGB = [214, 96, 44];
const FILL_RGB = [64, 132, 200];

function earthColor(h, depth, out) {
  const span = terrain.maxH - terrain.minH || 1;
  const t = Math.max(0, Math.min(1, (h - terrain.minH) / span));
  let r = RAMP_LOW[0] + (RAMP_HIGH[0] - RAMP_LOW[0]) * t;
  let g = RAMP_LOW[1] + (RAMP_HIGH[1] - RAMP_LOW[1]) * t;
  let b = RAMP_LOW[2] + (RAMP_HIGH[2] - RAMP_LOW[2]) * t;
  const tint = depth > 0.05 ? CUT_RGB : depth < -0.05 ? FILL_RGB : null;
  if (tint) {
    const k = Math.min(0.85, 0.35 + Math.abs(depth) / 14);
    r += (tint[0] - r) * k;
    g += (tint[1] - g) * k;
    b += (tint[2] - b) * k;
  }
  out[0] = r;
  out[1] = g;
  out[2] = b;
  return out;
}

function surfaceRGB(i, out) {
  return earthColor(terrain.final[i], terrain.ground[i] - terrain.final[i], out);
}

const TEX = { w: SITE.w / 2, h: SITE.h / 2, canvas: null, ctx: null, img: null, version: -1, at: 0 };

function renderTerrainImage(force = false) {
  if (TEX.version === terrain.surfaceVersion) return;
  const now = performance.now();
  if (!force && grade.active && now - TEX.at < 120) return;
  const { w, h } = TEX;
  if (!TEX.canvas) {
    TEX.canvas = document.createElement("canvas");
    TEX.canvas.width = w;
    TEX.canvas.height = h;
    TEX.ctx = TEX.canvas.getContext("2d");
    TEX.img = TEX.ctx.createImageData(w, h);
    TEX.heights = new Float32Array(w * h);
    TEX.depth = new Float32Array(w * h);
  }
  const { heights, depth } = TEX;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const k = py * w + px;
      const x = (px + 0.5) * 2;
      const y = (py + 0.5) * 2;
      const z = sampleGrid(terrain.final, x, y);
      heights[k] = z;
      depth[k] = sampleGrid(terrain.ground, x, y) - z;
    }
  }
  const data = TEX.img.data;
  const spacing = 2 * state.feetPerPx;
  const exag = 3;
  const light = [-0.55, -0.55, 0.63];
  const rgb = [0, 0, 0];
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const k = py * w + px;
      const h0 = heights[k];
      const hl = heights[px > 0 ? k - 1 : k];
      const hr = heights[px < w - 1 ? k + 1 : k];
      const hu = heights[py > 0 ? k - w : k];
      const hd = heights[py < h - 1 ? k + w : k];
      const nx = (-(hr - hl) / (2 * spacing)) * exag;
      const ny = (-(hd - hu) / (2 * spacing)) * exag;
      const len = Math.hypot(nx, ny, 1);
      const dot = (nx * light[0] + ny * light[1] + light[2]) / len;
      const shade = Math.max(0.55, Math.min(1.15, 0.4 + 0.75 * dot));
      earthColor(h0, depth[k], rgb);
      const b = Math.floor(h0 / CONTOUR_FT);
      const br = Math.floor(hr / CONTOUR_FT);
      const bd = Math.floor(hd / CONTOUR_FT);
      let line = 1;
      if (b !== br || b !== bd) line = Math.max(b, br, bd) % 5 === 0 ? 0.55 : 0.78;
      const o = k * 4;
      data[o] = Math.min(255, rgb[0] * shade * line);
      data[o + 1] = Math.min(255, rgb[1] * shade * line);
      data[o + 2] = Math.min(255, rgb[2] * shade * line);
      data[o + 3] = 255;
    }
  }
  TEX.ctx.putImageData(TEX.img, 0, 0);
  document.getElementById("terrainImage").setAttribute("href", TEX.canvas.toDataURL());
  TEX.version = terrain.surfaceVersion;
  TEX.at = now;
}

let readoutText = "";

function updateReadout() {
  const faces = terrain.tin.triangles.length / 3;
  const tinText = faces ? `Surface ${faces} triangles` : "Surface: set elevations on lines";
  const tinEl = document.getElementById("tinReadout");
  if (tinEl.textContent !== tinText) tinEl.textContent = tinText;
  const p = state.hoverPt;
  let text = "Hover the site for elevation";
  if (p) {
    const s = surfaceAt(p);
    const g = groundAt(p);
    const diff = g - s;
    text = `Elev ${s.toFixed(1)} ft`;
    if (Math.abs(diff) > 0.05) {
      text += ` · existing ${g.toFixed(1)} ft · ${diff > 0 ? "cut" : "fill"} ${Math.abs(diff).toFixed(1)} ft`;
    }
  }
  if (text !== readoutText) {
    document.getElementById("elevReadout").textContent = text;
    readoutText = text;
  }
}

function formatCy(cy) {
  return `${Math.round(cy).toLocaleString()} cy`;
}

function focusItem(kind, id) {
  if (kind === "equipment") state.selectedId = id;
  state.focus = { kind, id };
  syncSelectionPanel();
}

function clearSelection() {
  state.focus = { kind: null, id: null };
  syncSelectionPanel();
}

function setView(view) {
  state.view = view;
  document.getElementById("views").dataset.view = view;
  document.querySelectorAll(".view-toggle [data-view]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.view === view ? "true" : "false");
  });
  syncSelectionPanel();
}

function specFor(piece) {
  return EQUIP_CATALOG[piece.type] || EQUIP_CATALOG.excavator;
}

function isLoader(piece) {
  return specFor(piece).role === "load";
}

function loaders() {
  return state.equipment.filter(isLoader);
}

function excavators() {
  return loaders();
}

function isTruck(piece) {
  return specFor(piece).role === "haul";
}

function bucketCycleSec(piece) {
  return piece.fillSec + piece.dumpSec + piece.returnSec;
}

function cycleRate(piece) {
  const sec = bucketCycleSec(piece);
  return sec > 0 ? (piece.bucket * 3600) / sec : 0;
}

function productionRate(piece) {
  return piece.prodMode === "cycle" ? cycleRate(piece) : piece.rate || 0;
}

function liveLoaders() {
  return loaders().filter((e) => e.loadMode !== "stockpile");
}

function stockpilers() {
  return loaders().filter((e) => e.loadMode === "stockpile" && findDump(e.stockpileId));
}

function canHaulTo(piece, road) {
  const dest = dumpForRoad(road);
  return !dest || specFor(piece).destinations.includes(dest.kind);
}

function truckRoad(piece) {
  const road = piece.haulId ? findHaul(piece.haulId) : null;
  return road && routePoints(road).length >= 2 && canHaulTo(piece, road) ? road : null;
}

function destinationsText(piece) {
  return specFor(piece).destinations.map((k) => DUMP_KINDS[k].label.toLowerCase()).join(" or ");
}

function trucksOnRoad(road) {
  return state.equipment.filter((e) => isTruck(e) && e.haulId === road.id);
}

function loaderForTruck(truck, start) {
  const live = liveLoaders();
  const inArea = live.filter((e) => truck.areaId && e.areaId === truck.areaId);
  const pool = inArea.length ? inArea : live;
  let best = null;
  for (const e of pool) if (!best || dist(e, start) < dist(best, start)) best = e;
  return best;
}

function typeIndex(piece) {
  return (
    state.equipment.filter((e) => e.type === piece.type).findIndex((e) => e.id === piece.id) + 1
  );
}

function equipmentLabel(piece) {
  if (!piece) return "None";
  const spec = specFor(piece);
  const n = typeIndex(piece);
  return n > 1 ? `${spec.label} ${n}` : spec.label;
}

function selectedEquipment() {
  return (
    state.equipment.find((e) => e.id === state.selectedId) ||
    state.equipment[0] ||
    null
  );
}

function nextWorkAreaName() {
  const used = new Set(state.workAreas.map((a) => a.name));
  if (!used.has("Work Area")) return "Work Area";
  let i = 2;
  while (used.has(`Work Area ${i}`)) i += 1;
  return `Work Area ${i}`;
}

function findArea(id) {
  return state.workAreas.find((a) => a.id === id) || null;
}

function findDrawing(id) {
  return state.drawings.find((d) => d.id === id) || null;
}

function drawSpec(kind = state.drawKind) {
  return DRAW_TOOLS.find((t) => t.id === kind) || DRAW_TOOLS[0];
}

function drawingLabel(drawing) {
  if (!drawing) return "Drawing";
  const spec = drawSpec(drawing.kind);
  const n =
    state.drawings.filter((d) => d.kind === drawing.kind).findIndex((d) => d.id === drawing.id) + 1;
  return n > 1 ? `${spec.label} ${n}` : spec.label;
}

function labelForSelection() {
  const { kind, id } = state.focus;
  if (kind === "equipment") {
    const piece = state.equipment.find((e) => e.id === id);
    return equipmentLabel(piece);
  }
  if (kind === "dump") return dumpLabel(findDump(id));
  if (kind === "haul") {
    const road = findHaul(id);
    return road ? `Haul road ${haulIndex(road)}` : "Haul road";
  }
  if (kind === "area") {
    const area = findArea(id);
    return area?.name || "Work Area";
  }
  if (kind === "drawing") {
    return drawingLabel(findDrawing(id));
  }
  if (kind === "measure") {
    const measure = findMeasure(id);
    return measure ? `Measure ${measureIndex(measure)}` : "Measure";
  }
  if (kind === "supply") return supplyLabel(findSupply(id));
  if (kind === "utility") return utilityLabel(findUtility(id));
  return "None";
}

function findMeasure(id) {
  return state.measures.find((m) => m.id === id) || null;
}

function findSupply(id) {
  return state.supplies.find((s) => s.id === id) || null;
}

function supplySpec(supply) {
  return SUPPLY_CATALOG[supply.type] || SUPPLY_CATALOG["traffic-cone"];
}

function supplyReach(supply) {
  const spec = supplySpec(supply);
  return spec.lines ? Math.max(8, spec.radiusFt / state.feetPerPx) : spec.size;
}

function addCustomSupply(item) {
  return addCustomItem(item, "custom");
}

function addCustomStructure(item) {
  return addCustomItem(item, "structure");
}

function addCustomItem({ label, short, color, lines }, prefix) {
  const pts = lines.flat();
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  const cx = (lo[0] + hi[0]) / 2;
  const cz = (lo[2] + hi[2]) / 2;
  const centered = lines.map((line) => line.map(([x, y, z]) => [x - cx, y - lo[1], z - cz]));
  const n = Object.keys(SUPPLY_CATALOG).filter((k) => k.startsWith(`${prefix}-`)).length + 1;
  const key = `${prefix}-${n}`;
  SUPPLY_CATALOG[key] = {
    label,
    short: short || label.slice(0, 3).toUpperCase(),
    color,
    size: 12,
    lines: centered,
    radiusFt: Math.max(hi[0] - lo[0], hi[2] - lo[2]) / 2,
  };
  return key;
}

function supplyLabel(supply) {
  if (!supply) return "Supply";
  const spec = supplySpec(supply);
  if (spec.text && supply.text) return `Sign: ${supply.text}`;
  const n =
    state.supplies.filter((s) => s.type === supply.type).findIndex((s) => s.id === supply.id) + 1;
  return n > 1 ? `${spec.label} ${n}` : spec.label;
}

function findUtility(id) {
  return state.utilities.find((u) => u.id === id) || null;
}

function utilitySpec(utility) {
  return UTILITY_CATALOG[utility.type] || UTILITY_CATALOG.water;
}

function utilityLabel(utility) {
  if (!utility) return "Utility";
  const spec = utilitySpec(utility);
  const n =
    state.utilities.filter((u) => u.type === utility.type).findIndex((u) => u.id === utility.id) + 1;
  return `${spec.label} line${n > 1 ? ` ${n}` : ""}`;
}

function utilityTopAt(utility, p) {
  return utility.mode === "elev" ? utility.elev : surfaceAt(p) - utility.depth;
}

function utilityTag(utility) {
  const spec = utilitySpec(utility);
  const where =
    utility.mode === "elev" ? `top ${utility.elev.toFixed(1)} ft` : `${utility.depth} ft deep`;
  return `${spec.short} ${utility.diameter}" · ${where}`;
}

function utilityFacts(utility) {
  const pts = utility.points;
  const tops = pts.map((p) => utilityTopAt(utility, p));
  const covers = pts.map((p, i) => surfaceAt(p) - tops[i]);
  const bits = [`${formatFt(polylineLength(pts))} run`, `${utility.diameter}" dia`];
  if (utility.mode === "elev") {
    bits.push(`Top ${utility.elev.toFixed(1)} ft`);
    bits.push(`Cover ${Math.min(...covers).toFixed(1)}–${Math.max(...covers).toFixed(1)} ft`);
  } else {
    bits.push(`${utility.depth} ft below surface`);
    bits.push(`Top ${Math.min(...tops).toFixed(1)}–${Math.max(...tops).toFixed(1)} ft`);
  }
  if (Math.min(...covers) < 0) bits.push("Exposed above grade");
  return bits.join(" · ");
}

function measureIndex(measure) {
  return state.measures.findIndex((m) => m.id === measure.id) + 1;
}

function findDump(id) {
  return state.dumps.find((d) => d.id === id) || null;
}

function findHaul(id) {
  return state.haulRoads.find((h) => h.id === id) || null;
}

const DUMP_KINDS = {
  offsite: { label: "Offsite dump", tag: "OFFSITE" },
  stockpile: { label: "Stockpile", tag: "STOCKPILE" },
};

function dumpIndex(dump) {
  return state.dumps.filter((d) => d.kind === dump.kind).findIndex((d) => d.id === dump.id) + 1;
}

function dumpLabel(dump) {
  if (!dump) return "Dump site";
  return `${DUMP_KINDS[dump.kind].label} ${dumpIndex(dump)}`;
}

function hauledTotal(kind) {
  return state.dumps
    .filter((d) => !kind || d.kind === kind)
    .reduce((sum, d) => sum + d.hauled, 0);
}

function pileScale(dump) {
  return 0.7 + 0.8 * Math.min(1, Math.cbrt(dump.hauled / 6000));
}

function haulIndex(road) {
  return state.haulRoads.findIndex((h) => h.id === road.id) + 1;
}

function selectedHaul() {
  if (state.focus.kind === "haul") return findHaul(state.focus.id);
  if (state.focus.kind === "equipment") {
    const piece = selectedEquipment();
    if (piece && isTruck(piece) && piece.haulId) return findHaul(piece.haulId);
  }
  const assigned = state.haulRoads.find((road) => trucksOnRoad(road).length);
  return assigned || state.haulRoads[0] || null;
}

function dumpForRoad(road) {
  if (!road?.dumpId) return null;
  return findDump(road.dumpId);
}

function equipmentOnArea(areaId) {
  return state.equipment.filter((e) => e.areaId === areaId);
}

function linkedAreaId() {
  if (state.focus.kind === "area") return state.focus.id;
  if (state.focus.kind === "equipment") {
    return selectedEquipment()?.areaId ?? null;
  }
  return null;
}

function routePoints(road) {
  const r = road || selectedHaul();
  if (!r) return [];
  const pts = r.waypoints.map((p) => ({ ...p }));
  const dump = dumpForRoad(r);
  if (dump) pts.push(dump);
  return pts;
}

function fillSelect(select, options, value) {
  if (document.activeElement === select) return;
  const current = String(value ?? "");
  select.innerHTML = "";
  for (const opt of options) {
    const node = document.createElement("option");
    node.value = opt.value;
    node.textContent = opt.label;
    node.disabled = !!opt.disabled;
    select.appendChild(node);
  }
  select.value = current;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polylineLength(points) {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += dist(points[i - 1], points[i]);
  return n;
}

function pointOnPolyline(points, t) {
  const total = polylineLength(points);
  if (total === 0) return { ...points[0] };
  let remain = t * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = dist(a, b);
    if (remain <= seg || i === points.length - 1) {
      const u = seg === 0 ? 0 : remain / seg;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    remain -= seg;
  }
  return { ...points[points.length - 1] };
}

function closestOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { point: { ...a }, t: 0, d: dist(p, a) };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { point, t, d: dist(p, point) };
}

function pxToFt(px) {
  return px * state.feetPerPx;
}

function formatFt(px) {
  const ft = pxToFt(px);
  if (!Number.isFinite(ft)) return "—";
  return `${ft.toFixed(ft >= 100 ? 0 : 1)} ft`;
}

function dimCopy(a, b) {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return {
    length: dist(a, b),
    dx,
    dy,
    text: `${formatFt(dist(a, b))} · ΔX ${formatFt(dx)} · ΔY ${formatFt(dy)}`,
  };
}

function ftToMiles(ft) {
  return ft / 5280;
}

function readNumber(id) {
  return Number(document.getElementById(id).value) || 0;
}

function formatMin(min) {
  if (!Number.isFinite(min)) return "—";
  if (min < 1) return `${(min * 60).toFixed(0)} sec`;
  return `${min.toFixed(2)} min`;
}

function formatHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  return `${h} hr ${m} min`;
}

function applySelectedRateFromInput() {
  const sel = selectedEquipment();
  if (!sel) return;
  if (isTruck(sel)) {
    sel.cap = Math.max(1, readNumber("truckCapEq"));
    return;
  }
  if (sel.prodMode !== "cycle") sel.rate = Math.max(10, readNumber("excavatorRate"));
  if (!isLoader(sel)) return;
  sel.bucket = Math.max(0.1, readNumber("bucketCy"));
  sel.fillSec = Math.max(0, readNumber("fillSec"));
  sel.dumpSec = Math.max(0, readNumber("bucketDumpSec"));
  sel.returnSec = Math.max(0, readNumber("returnSec"));
}

function combinedLoadRate() {
  return liveLoaders().reduce((sum, e) => sum + productionRate(e), 0);
}

function averageLoadRate() {
  const list = liveLoaders();
  if (list.length === 0) return 0;
  return combinedLoadRate() / list.length;
}

function setTool(next) {
  if (state.drawing && next !== "draw") finishDraft();
  if (state.measuring && next !== "measure") finishMeasure();
  const current = state.drawing
    ? "draw"
    : state.measuring
      ? "measure"
      : state.grading
        ? "grade"
        : null;
  const tool = current === next ? null : next;
  if (!tool) {
    if (current === "draw") finishDraft();
    if (current === "measure") {
      state.draft = [];
    }
    state.hover = null;
  }
  if (tool !== "grade") endGrade();
  state.drawing = tool === "draw";
  state.measuring = tool === "measure";
  state.grading = tool === "grade";
  const drawBtn = document.getElementById("drawLineBtn");
  drawBtn.setAttribute("aria-pressed", state.drawing ? "true" : "false");
  drawBtn.textContent = state.drawing ? `Draw: ${drawSpec().label}` : "Draw";
  document.getElementById("measureBtn").setAttribute("aria-pressed", state.measuring ? "true" : "false");
  document.getElementById("gradeBtn").setAttribute("aria-pressed", state.grading ? "true" : "false");
  svg.classList.toggle("drawing", state.drawing);
  svg.classList.toggle("measuring", state.measuring);
  svg.classList.toggle("grading", state.grading);
  updateHint();
}

function setDrawing(on) {
  if (on) setTool("draw");
  else if (state.drawing) setTool("draw");
}

function setMeasuring(on) {
  if (on) setTool("measure");
  else if (state.measuring) setTool("measure");
}

function updateHint() {
  const hint = document.getElementById("hint");
  if (state.placing) {
    hint.textContent = state.placing.dragging
      ? `Drop ${state.placing.label} on the site plan or 3D view. Esc cancels.`
      : `Click the site plan or 3D view to place ${state.placing.label}. Esc cancels.`;
    return;
  }
  if (state.drawing) {
    hint.textContent = `${drawSpec().hint} Esc cancels.`;
    return;
  }
  if (state.measuring) {
    const a = state.draft[0];
    const b = state.hover;
    if (a && b) {
      hint.textContent = `${dimCopy(a, b).text}. Click to place. Shift locks H/V. Esc cancels.`;
      return;
    }
    hint.textContent =
      "Click start, then end. Snaps to machines, dumps, corners, and vertices. Shift locks a horizontal or vertical dimension.";
    return;
  }
  if (state.grading) {
    const mode = document.getElementById("gradeMode").value;
    hint.textContent = `Click and drag on the plan or the 3D view to ${mode} the existing ground. Size and strength are in the terrain bar. Esc exits.`;
    return;
  }
  hint.textContent =
    "Draw a line and set its elevation. Elevated lines are triangulated into a surface. A second elevation grades the line from start to end.";
}

function syncSelectionPanel() {
  const nameEl = document.getElementById("selectedName");
  const metaEl = document.getElementById("selectionMeta");
  const removeBtn = document.getElementById("removeEquipBtn");
  const addBtn = document.getElementById("addEquipBtn");
  const equipFields = document.getElementById("equipFields");
  const rateFields = document.getElementById("rateFields");
  const haulFields = document.getElementById("haulFields");
  const { kind, id } = state.focus;

  nameEl.textContent = labelForSelection();
  addBtn.disabled = state.equipment.length >= MAX_EQUIPMENT;
  document.getElementById("addSupplyBtn").disabled = state.supplies.length >= MAX_SUPPLIES;
  document.getElementById("addStructureBtn").disabled = state.supplies.length >= MAX_SUPPLIES;
  document.getElementById("addUtilityBtn").disabled = state.utilities.length >= MAX_UTILITIES;
  document.getElementById("addOffsiteBtn").disabled = state.dumps.length >= MAX_DUMPS;
  document.getElementById("addStockpileBtn").disabled = state.dumps.length >= MAX_DUMPS;
  document.getElementById("addHaulBtn").disabled = state.haulRoads.length >= MAX_HAULS;
  document.getElementById("straightenBtn").disabled = !selectedHaul();
  document.getElementById("copyBtn").disabled = !focusedItem();
  document.getElementById("pasteBtn").disabled = !clipboard || !canPaste();
  equipFields.hidden = kind !== "equipment";
  haulFields.hidden = kind !== "haul";
  document.getElementById("areaFields").hidden = kind !== "area";
  document.getElementById("drawFields").hidden = kind !== "drawing";
  document.getElementById("supplyFields").hidden = kind !== "supply";
  document.getElementById("utilityFields").hidden = kind !== "utility";

  if (kind === "equipment") {
    const sel = selectedEquipment();
    const spec = sel ? specFor(sel) : null;
    const loader = !!sel && isLoader(sel);
    const truck = !!sel && isTruck(sel);
    const byCycle = loader && sel.prodMode === "cycle";
    document.getElementById("loaderFields").hidden = !loader;
    document.getElementById("stockpileField").hidden = !loader || sel.loadMode !== "stockpile";
    document.getElementById("cycleFields").hidden = !byCycle;
    document.getElementById("equipHaulField").hidden = !truck;
    rateFields.hidden = !sel || truck || byCycle;
    const setInput = (inputId, value) => {
      const el = document.getElementById(inputId);
      if (document.activeElement !== el) el.value = String(value);
    };
    if (sel && !truck) setInput("excavatorRate", sel.rate || spec.rate);
    if (loader) {
      fillSelect(document.getElementById("loadModeSelect"), [
        { value: "live", label: "Live load trucks" },
        { value: "stockpile", label: "Stockpile on site" },
      ], sel.loadMode);
      fillSelect(document.getElementById("prodModeSelect"), [
        { value: "rate", label: "Enter cy/hr" },
        { value: "cycle", label: "Calculate from cycle times" },
      ], sel.prodMode);
      fillSelect(
        document.getElementById("equipStockpileSelect"),
        [
          { value: "", label: "None" },
          ...state.dumps
            .filter((d) => d.kind === "stockpile")
            .map((d) => ({ value: String(d.id), label: dumpLabel(d) })),
        ],
        sel.stockpileId ?? ""
      );
      setInput("bucketCy", sel.bucket);
      setInput("fillSec", sel.fillSec);
      setInput("bucketDumpSec", sel.dumpSec);
      setInput("returnSec", sel.returnSec);
      const sec = bucketCycleSec(sel);
      document.getElementById("cycleResult").textContent =
        sec > 0
          ? `${sec.toFixed(1)} sec per bucket · ${(3600 / sec).toFixed(0)} buckets/hr · ${cycleRate(sel).toFixed(0)} cy/hr`
          : "Enter cycle times to calculate production.";
    }
    fillSelect(
      document.getElementById("equipAreaSelect"),
      [
        { value: "", label: "None" },
        ...state.workAreas.map((area) => ({
          value: String(area.id),
          label: area.name,
        })),
      ],
      sel?.areaId ?? ""
    );
    fillSelect(
      document.getElementById("equipHaulSelect"),
      [
        { value: "", label: "None" },
        ...state.haulRoads.map((road) => {
          const dest = dumpForRoad(road);
          const allowed = !truck || canHaulTo(sel, road);
          return {
            value: String(road.id),
            label: `Haul road ${haulIndex(road)}${dest ? ` to ${dumpLabel(dest)}` : ""}${allowed ? "" : " (not allowed)"}`,
            disabled: !allowed && sel.haulId !== road.id,
          };
        }),
      ],
      sel?.haulId ?? ""
    );
    document.getElementById("truckFields").hidden = !truck;
    if (truck) setInput("truckCapEq", sel.cap);
    const assignedArea = sel?.areaId ? findArea(sel.areaId) : null;
    const bits = [];
    if (assignedArea) bits.push(`Work area: ${assignedArea.name}`);
    if (loader) {
      const rate = `${productionRate(sel).toFixed(0)} cy/hr`;
      if (sel.loadMode === "stockpile") {
        const pile = findDump(sel.stockpileId);
        bits.push(pile ? `Stockpiling to ${dumpLabel(pile)} at ${rate}` : "Pick a stockpile to dig into.");
      } else {
        const fed = state.equipment.filter((e) => {
          const road = isTruck(e) ? truckRoad(e) : null;
          return road && loaderForTruck(e, routePoints(road)[0])?.id === sel.id;
        });
        bits.push(`Live loading at ${rate} · ${fed.length} truck${fed.length === 1 ? "" : "s"}`);
      }
    }
    if (truck) {
      const road = sel.haulId ? findHaul(sel.haulId) : null;
      const dest = dumpForRoad(road);
      bits.push(`${sel.cap} cy · hauls to ${destinationsText(sel)}`);
      if (road && !canHaulTo(sel, road)) {
        bits.push(`Parked: ${spec.label}s can't go to ${dumpLabel(dest)}. Pick a haul road to a ${destinationsText(sel)}.`);
      } else if (road) {
        bits.push(`Haul road ${haulIndex(road)}${dest ? ` to ${dumpLabel(dest)}` : ""}`);
      } else {
        bits.push("Parked. Assign a haul road to put this truck to work.");
      }
      if (road && !liveLoaders().length) bits.push("No excavator is live loading.");
    }
    metaEl.textContent = bits.length
      ? bits.join(" · ")
      : spec?.role === "support"
        ? "Support unit. Assign a work area if this machine works that zone."
        : "No work area assigned.";
    removeBtn.disabled = !sel;
  } else if (kind === "area") {
    const area = findArea(id);
    const assigned = area ? equipmentOnArea(area.id) : [];
    const names = assigned.map(equipmentLabel).join(", ");
    const shaped = area && area.kind !== "zone" && Number.isFinite(area.designElev);
    metaEl.textContent = [
      area ? `${pxToFt(area.w).toFixed(0)} × ${pxToFt(area.h).toFixed(0)} ft` : "",
      shaped ? `Pad ${area.designElev} ft at ${area.sideSlope}:1` : "",
      shaped ? areaVolumeText(area) : "",
      names ? `Equipment: ${names}` : "No equipment assigned.",
    ]
      .filter(Boolean)
      .join(" · ");
    removeBtn.disabled = !area;
    syncAreaPopover();
  } else if (kind === "drawing") {
    const drawing = findDrawing(id);
    metaEl.textContent = drawing ? drawingMeta(drawing) : "";
    removeBtn.disabled = !drawing;
    syncDrawPopover();
  } else if (kind === "measure") {
    const measure = findMeasure(id);
    const a = measure?.points[0];
    const b = measure?.points[1];
    metaEl.textContent = a && b ? dimCopy(a, b).text : "";
    removeBtn.disabled = !measure;
  } else if (kind === "supply") {
    const supply = findSupply(id);
    const spec = supply ? supplySpec(supply) : null;
    metaEl.textContent = spec
      ? spec.text
        ? "Sign · type the text below."
        : `${supply.type.startsWith("structure-") ? "Structure" : "Field supply"} · ${spec.label}`
      : "";
    removeBtn.disabled = !supply;
    syncSupplyPopover();
  } else if (kind === "utility") {
    const utility = findUtility(id);
    metaEl.textContent = utility ? utilityFacts(utility) : "";
    removeBtn.disabled = !utility;
    syncUtilityPopover();
  } else if (kind === "dump") {
    const dump = findDump(id);
    const sources = dump
      ? [
          ...state.haulRoads.filter((r) => r.dumpId === dump.id).map((r) => `Haul road ${haulIndex(r)}`),
          ...stockpilers().filter((e) => e.stockpileId === dump.id).map(equipmentLabel),
        ]
      : [];
    metaEl.textContent = dump
      ? [
          dump.kind === "offsite"
            ? `Material leaves the site · ${formatCy(dump.hauled)} exported`
            : `Material stays on site · ${formatCy(dump.hauled)} stockpiled`,
          sources.length ? `Fed by ${sources.join(", ")}` : "Nothing feeds this site yet.",
        ].join(" · ")
      : "";
    removeBtn.disabled = !dump;
  } else if (kind === "haul") {
    const road = findHaul(id);
    const pts = routePoints(road);
    const assigned = road ? trucksOnRoad(road) : [];
    const blocked = assigned.filter((e) => !canHaulTo(e, road));
    fillSelect(
      document.getElementById("haulDumpSelect"),
      [
        { value: "", label: "None" },
        ...state.dumps.map((dump) => ({
          value: String(dump.id),
          label: dumpLabel(dump),
        })),
      ],
      road?.dumpId ?? ""
    );
    const names = assigned.map(equipmentLabel).join(", ");
    const dest = dumpForRoad(road);
    metaEl.textContent = [
      pts.length > 1 ? `${pxToFt(polylineLength(pts)).toFixed(0)} ft` : "",
      dest ? `Trucks haul to ${dumpLabel(dest)}` : "No destination. Trucks turn around at the road end.",
      names ? `Trucks: ${names}` : "No trucks assigned. Select a truck and pick this haul road.",
      blocked.length
        ? `Parked: ${blocked.map(equipmentLabel).join(", ")} can't go to ${dumpLabel(dest)}.`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    removeBtn.disabled = !road;
  } else {
    metaEl.textContent = "";
    removeBtn.disabled = true;
  }
}

function syncUtilityPopover() {
  const fields = document.getElementById("utilityFields");
  const utility = state.focus.kind === "utility" ? findUtility(state.focus.id) : null;
  if (!utility) {
    fields.hidden = true;
    return;
  }
  fields.hidden = false;
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (document.activeElement !== el) el.value = String(value);
  };
  setValue("utilityKindSelect", utility.type);
  setValue("utilityModeSelect", utility.mode);
  setValue("utilityDepth", utility.depth);
  setValue("utilityElev", utility.elev);
  setValue("utilityDiameter", utility.diameter);
  document.getElementById("utilityDepthLabel").hidden = utility.mode !== "depth";
  document.getElementById("utilityElevLabel").hidden = utility.mode !== "elev";
  document.getElementById("utilityNote").textContent = utilityFacts(utility);
}

function syncSupplyPopover() {
  const fields = document.getElementById("supplyFields");
  const supply = state.focus.kind === "supply" ? findSupply(state.focus.id) : null;
  if (!supply || !supplySpec(supply).text) {
    fields.hidden = true;
    return;
  }
  fields.hidden = false;
  const input = document.getElementById("supplyTextInput");
  if (document.activeElement !== input) input.value = supply.text || "";
}

function readElev(input) {
  const value = input.value.trim();
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(MIN_ELEV, Math.min(MAX_ELEV, n)) : null;
}

function syncDrawPopover() {
  const fields = document.getElementById("drawFields");
  const drawing =
    state.focus.kind === "drawing" ? findDrawing(state.focus.id) : null;
  const showText = drawing && (drawing.kind === "text" || drawing.kind === "leader");
  const showElev = drawing && surfaceKind(drawing.kind);
  if (!showText && !showElev) {
    fields.hidden = true;
    return;
  }
  fields.hidden = false;
  document.getElementById("drawTextFields").hidden = !showText;
  document.getElementById("drawElevFields").hidden = !showElev;
  if (showText) {
    const input = document.getElementById("drawTextInput");
    if (document.activeElement !== input) input.value = drawing.text || "";
  }
  if (showElev) {
    const start = document.getElementById("drawElevStart");
    const end = document.getElementById("drawElevEnd");
    if (document.activeElement !== start) start.value = Number.isFinite(drawing.z0) ? String(drawing.z0) : "";
    if (document.activeElement !== end) end.value = Number.isFinite(drawing.z1) ? String(drawing.z1) : "";
    document.getElementById("drawElevEndLabel").hidden = !SURFACE_GRADED.has(drawing.kind);
    const faces = terrain.tin.triangles.length / 3;
    document.getElementById("drawSurfaceNote").textContent = Number.isFinite(drawing.z0)
      ? faces
        ? `In the surface · ${faces} triangles`
        : "Add elevations until the points are not all in one line."
      : "Set an elevation to include this line in the surface.";
  }
}

function syncAreaPopover() {
  const fields = document.getElementById("areaFields");
  const area = state.focus.kind === "area" ? findArea(state.focus.id) : null;
  if (!area) {
    fields.hidden = true;
    return;
  }
  fields.hidden = false;
  const nameInput = document.getElementById("areaNameInput");
  const kindSelect = document.getElementById("areaKindSelect");
  if (document.activeElement !== nameInput) nameInput.value = area.name;
  if (document.activeElement !== kindSelect) kindSelect.value = area.kind;
  const design = document.getElementById("areaDesignFields");
  design.hidden = area.kind === "zone";
  if (area.kind !== "zone") {
    const materialSelect = document.getElementById("areaMaterialSelect");
    if (document.activeElement !== materialSelect) materialSelect.value = area.material || "soil";
    document.getElementById("areaFactorName").textContent =
      area.kind === "cut" ? "Swell" : "Compaction";
    document.getElementById("areaFactorOn").checked = factorOn(area);
    const pctInput = document.getElementById("areaFactorPct");
    if (document.activeElement !== pctInput) pctInput.value = String(factorPct(area) ?? "");
    const elevInput = document.getElementById("areaDesignElev");
    const slopeInput = document.getElementById("areaSideSlope");
    if (document.activeElement !== elevInput) elevInput.value = String(area.designElev ?? "");
    if (document.activeElement !== slopeInput) slopeInput.value = String(area.sideSlope ?? 2);
    document.getElementById("areaVolume").textContent =
      `${areaVolumeText(area)} · existing avg ${meanGround(area).toFixed(1)} ft`;
  }
}

function addEquipment(type, at = null) {
  if (state.equipment.length >= MAX_EQUIPMENT) return;
  const spec = EQUIP_CATALOG[type];
  if (!spec) return;
  const n = state.equipment.length;
  const piece = makePiece(
    state.nextId++,
    type,
    at ? at.x : Math.min(SITE.w - 40, 70 + (n % 7) * 72),
    at ? at.y : Math.min(SITE.h - 40, 520 - Math.floor(n / 7) * 70)
  );
  state.equipment.push(piece);
  state.selectedId = piece.id;
  state.focus = { kind: "equipment", id: piece.id };
  syncSelectionPanel();
}

function addSupply(type, at = null) {
  if (state.supplies.length >= MAX_SUPPLIES) return;
  const spec = SUPPLY_CATALOG[type];
  if (!spec) return;
  const n = state.supplies.length;
  const supply = {
    id: state.nextId++,
    type,
    x: at ? at.x : 420 + (n % 12) * 38,
    y: at ? at.y : 470 + (Math.floor(n / 12) % 4) * 34,
    text: spec.text ? "SIGN" : "",
  };
  state.supplies.push(supply);
  state.focus = { kind: "supply", id: supply.id };
  syncSelectionPanel();
}

function addUtility(type, at = null) {
  if (state.utilities.length >= MAX_UTILITIES) return;
  const spec = UTILITY_CATALOG[type];
  if (!spec) return;
  const n = state.utilities.length;
  const y = at ? at.y : 120 + (n % 8) * 50;
  const a = { x: at ? Math.max(8, at.x - 180) : 120, y };
  const b = { x: at ? Math.min(SITE.w - 8, at.x + 180) : 840, y };
  const utility = {
    id: state.nextId++,
    type,
    points: [a, b],
    mode: "depth",
    depth: spec.depth,
    elev: Math.round((surfaceAt(a) - spec.depth) * 10) / 10,
    diameter: spec.diameter,
  };
  state.utilities.push(utility);
  state.focus = { kind: "utility", id: utility.id };
  syncSelectionPanel();
}

function addDump(kind) {
  if (state.dumps.length >= MAX_DUMPS) return;
  const n = state.dumps.length;
  const c = viewCenter();
  const dump = clampPoint({ x: c.x + 160 - (n % 4) * 60, y: c.y - 80 + (n % 3) * 60 });
  Object.assign(dump, { id: state.nextId++, kind, hauled: 0 });
  state.dumps.push(dump);
  state.focus = { kind: "dump", id: dump.id };
  syncSelectionPanel();
}

function addHaulRoad() {
  if (state.haulRoads.length >= MAX_HAULS) return;
  const n = state.haulRoads.length;
  const c = viewCenter();
  const x0 = c.x - 190 + (n % 4) * 36;
  const y0 = c.y + 40 + (n % 4) * 32;
  const road = {
    id: state.nextId++,
    dumpId: null,
    waypoints: [
      clampPoint({ x: x0, y: y0 }),
      clampPoint({ x: x0 + 200, y: y0 + 24 }),
      clampPoint({ x: x0 + 380, y: y0 - 30 }),
    ],
  };
  state.haulRoads.push(road);
  state.focus = { kind: "haul", id: road.id };
  syncSelectionPanel();
}

function addWorkArea() {
  const n = state.workAreas.length;
  const area = {
    id: state.nextId++,
    kind: "zone",
    name: nextWorkAreaName(),
    x: Math.max(8, Math.min(SITE.w - 228, viewCenter().x - 110 + (n % 4) * 28)),
    y: Math.max(8, Math.min(SITE.h - 138, viewCenter().y - 65 + (n % 3) * 24)),
    w: 220,
    h: 130,
    material: "soil",
  };
  state.workAreas.push(area);
  state.focus = { kind: "area", id: area.id };
  syncSelectionPanel();
}

function finishDraft() {
  commitDrawing();
}

function commitDrawing() {
  if (state.drawings.length >= MAX_DRAWINGS) {
    state.draft = [];
    state.hover = null;
    state.freehand = false;
    syncSelectionPanel();
    return;
  }
  const spec = drawSpec();
  const min = spec.min || spec.clicks || 1;
  if (state.draft.length >= min) {
    const drawing = {
      id: state.nextId++,
      kind: spec.id,
      points: state.draft.map((p) => ({ x: p.x, y: p.y })),
      text: spec.id === "text" || spec.id === "leader" ? "Note" : "",
    };
    state.drawings.push(drawing);
    state.focus = { kind: "drawing", id: drawing.id };
  }
  state.draft = [];
  state.hover = null;
  state.freehand = false;
  syncSelectionPanel();
  updateHint();
}

function finishMeasure() {
  if (state.draft.length >= 2 && state.measures.length < MAX_MEASURES) {
    const a = state.draft[0];
    const b = state.draft[state.draft.length - 1];
    if (dist(a, b) >= 2) {
      const measure = {
        id: state.nextId++,
        points: [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
        ],
      };
      state.measures.push(measure);
      state.focus = { kind: "measure", id: measure.id };
    }
  }
  state.draft = [];
  state.hover = null;
  syncSelectionPanel();
  updateHint();
}

function cancelDraft() {
  state.draft = [];
  state.hover = null;
}

function constrainOrtho(from, to) {
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
    return { x: to.x, y: from.y };
  }
  return { x: from.x, y: to.y };
}

function snapCandidates() {
  const pts = [];
  for (const piece of state.equipment) pts.push(piece);
  for (const dump of state.dumps) pts.push(dump);
  for (const supply of state.supplies) pts.push(supply);
  for (const utility of state.utilities) pts.push(...utility.points);
  for (const road of state.haulRoads) {
    pts.push(...road.waypoints);
    const dump = dumpForRoad(road);
    if (dump) pts.push(dump);
  }
  for (const area of state.workAreas) {
    pts.push(...Object.values(areaHandles(area)));
  }
  for (const drawing of state.drawings) pts.push(...drawing.points);
  for (const measure of state.measures) pts.push(...measure.points);
  return pts;
}

function snapPoint(p) {
  let best = null;
  let bestD = SNAP;
  for (const candidate of snapCandidates()) {
    const d = dist(p, candidate);
    if (d < bestD) {
      bestD = d;
      best = candidate;
    }
  }
  return best
    ? { x: best.x, y: best.y, snapped: true }
    : { x: p.x, y: p.y, snapped: false };
}

function measurePointer(event) {
  let p = snapPoint(clampPoint(sitePoint(event)));
  const from = state.draft[0];
  if (from && event.shiftKey) p = { ...constrainOrtho(from, p), snapped: false };
  return p;
}

const ITEM_LIST = {
  equipment: () => state.equipment,
  area: () => state.workAreas,
  drawing: () => state.drawings,
  measure: () => state.measures,
  supply: () => state.supplies,
  utility: () => state.utilities,
  dump: () => state.dumps,
  haul: () => state.haulRoads,
};
const ITEM_MAX = {
  equipment: MAX_EQUIPMENT,
  drawing: MAX_DRAWINGS,
  measure: MAX_MEASURES,
  supply: MAX_SUPPLIES,
  utility: MAX_UTILITIES,
  dump: MAX_DUMPS,
  haul: MAX_HAULS,
};
const PASTE_STEP = 36;
let clipboard = null;
let pasteCount = 0;

function focusedItem() {
  const list = ITEM_LIST[state.focus.kind];
  if (!list) return null;
  return list().find((item) => item.id === state.focus.id) || null;
}

function canPaste() {
  if (!clipboard) return false;
  const max = ITEM_MAX[clipboard.kind];
  return !max || ITEM_LIST[clipboard.kind]().length < max;
}

function nudgePoints(points, dx, dy) {
  if (!points.length) return points;
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const ax = Math.max(8 - minX, Math.min(dx, SITE.w - 8 - maxX));
  const ay = Math.max(8 - minY, Math.min(dy, SITE.h - 8 - maxY));
  return points.map((p) => ({ ...p, x: p.x + ax, y: p.y + ay }));
}

function nudgeBox(x, y, w, h, dx, dy) {
  return {
    x: Math.max(8, Math.min(SITE.w - w - 8, x + dx)),
    y: Math.max(8, Math.min(SITE.h - h - 8, y + dy)),
  };
}

function copySelected() {
  const item = focusedItem();
  if (!item) return;
  const data = JSON.parse(JSON.stringify(item));
  delete data.id;
  delete data.live;
  if (state.focus.kind === "dump") data.hauled = 0;
  clipboard = { kind: state.focus.kind, data };
  pasteCount = 0;
  syncSelectionPanel();
}

function pasteSelected() {
  if (!clipboard) return;
  if (!canPaste()) {
    document.getElementById("hint").textContent =
      "Can't paste. The site already has as many of these as it allows.";
    return;
  }
  pasteCount += 1;
  const step = PASTE_STEP * pasteCount;
  const copy = JSON.parse(JSON.stringify(clipboard.data));
  copy.id = state.nextId++;
  if (copy.points) copy.points = nudgePoints(copy.points, step, step);
  if (copy.waypoints) copy.waypoints = nudgePoints(copy.waypoints, step, step);
  if (Number.isFinite(copy.w) && Number.isFinite(copy.h)) {
    const p = nudgeBox(copy.x, copy.y, copy.w, copy.h, step, step);
    copy.x = p.x;
    copy.y = p.y;
  } else if (Number.isFinite(copy.x) && Number.isFinite(copy.y)) {
    const p = nudgeBox(copy.x, copy.y, 0, 0, step, step);
    copy.x = Math.max(8, Math.min(SITE.w - 8, p.x));
    copy.y = Math.max(8, Math.min(SITE.h - 8, p.y));
  }
  if (clipboard.kind === "equipment") copy.live = null;
  ITEM_LIST[clipboard.kind]().push(copy);
  if (clipboard.kind === "equipment") state.selectedId = copy.id;
  state.focus = { kind: clipboard.kind, id: copy.id };
  syncSelectionPanel();
}

function removeSelected() {
  const { kind, id } = state.focus;
  if (kind === "equipment") {
    state.equipment = state.equipment.filter((e) => e.id !== id);
    const next = state.equipment[0];
    if (next) {
      state.selectedId = next.id;
      state.focus = { kind: "equipment", id: next.id };
    } else {
      state.selectedId = null;
      state.focus = { kind: null, id: null };
    }
  } else if (kind === "area") {
    state.workAreas = state.workAreas.filter((a) => a.id !== id);
    for (const piece of state.equipment) {
      if (piece.areaId === id) piece.areaId = null;
    }
    state.focus = { kind: "equipment", id: state.selectedId };
  } else if (kind === "drawing") {
    state.drawings = state.drawings.filter((d) => d.id !== id);
    state.focus = { kind: "equipment", id: state.selectedId };
  } else if (kind === "dump") {
    state.dumps = state.dumps.filter((d) => d.id !== id);
    for (const road of state.haulRoads) {
      if (road.dumpId === id) road.dumpId = null;
    }
    for (const piece of state.equipment) {
      if (piece.stockpileId === id) piece.stockpileId = null;
    }
    state.focus = { kind: "equipment", id: state.selectedId };
  } else if (kind === "haul") {
    state.haulRoads = state.haulRoads.filter((h) => h.id !== id);
    for (const piece of state.equipment) {
      if (piece.haulId === id) piece.haulId = null;
    }
    state.focus = { kind: "equipment", id: state.selectedId };
  } else if (kind === "measure") {
    state.measures = state.measures.filter((m) => m.id !== id);
    state.focus = { kind: "equipment", id: state.selectedId };
  } else if (kind === "supply") {
    state.supplies = state.supplies.filter((s) => s.id !== id);
    state.focus = { kind: "equipment", id: state.selectedId };
  } else if (kind === "utility") {
    state.utilities = state.utilities.filter((u) => u.id !== id);
    state.focus = { kind: "equipment", id: state.selectedId };
  }
  syncSelectionPanel();
}

function compute() {
  const volInput = document.getElementById("volume");
  const fromSurface =
    document.getElementById("useSurfaceVolume").checked && terrain.cut > 0;
  volInput.readOnly = fromSurface;
  const looseCut = state.workAreas
    .filter((a) => a.kind === "cut")
    .reduce((sum, a) => sum + adjustedVolume(a) - (terrain.areaVolumes.get(a.id) || 0), terrain.cut);
  if (fromSurface && document.activeElement !== volInput) {
    const shown = String(Math.round(looseCut));
    if (volInput.value !== shown) volInput.value = shown;
  }
  const volume = fromSurface ? looseCut : readNumber("volume");
  const loaderRate = combinedLoadRate();
  const perMachine = averageLoadRate();
  const loadedMph = readNumber("loadedMph");
  const emptyMph = readNumber("emptyMph");
  const spotMin = readNumber("spotMin");

  const cycleFor = (road, cap) => {
    const loadMin = perMachine > 0 ? (cap / perMachine) * 60 : Infinity;
    const dumpMin = dumpForRoad(road) ? readNumber("dumpMin") : 0;
    const haulFt = pxToFt(polylineLength(road ? routePoints(road) : []));
    const haulMi = ftToMiles(haulFt);
    const haulMin = road && loadedMph > 0 ? (haulMi / loadedMph) * 60 : 0;
    const returnMin = road && emptyMph > 0 ? (haulMi / emptyMph) * 60 : 0;
    const cycleMin = loadMin + haulMin + dumpMin + returnMin + spotMin;
    return { haulFt, loadMin, haulMin, dumpMin, returnMin, cycleMin };
  };
  const cycles = new Map();
  let fleetProd = 0;
  let truckCount = 0;
  for (const piece of state.equipment) {
    const road = isTruck(piece) ? truckRoad(piece) : null;
    if (!road) continue;
    const cycle = cycleFor(road, piece.cap);
    cycles.set(piece.id, cycle);
    const cycleHr = cycle.cycleMin / 60;
    if (cycleHr > 0 && Number.isFinite(cycleHr)) fleetProd += piece.cap / cycleHr;
    truckCount++;
  }
  const activeRoad = selectedHaul();
  const sel = selectedEquipment();
  const activeTruck =
    (state.focus.kind === "equipment" && sel && isTruck(sel) && sel) ||
    (activeRoad && trucksOnRoad(activeRoad).find((e) => truckRoad(e))) ||
    null;
  const truckCap = activeTruck?.cap || EQUIP_CATALOG["on-road-dump"].cap;
  const active = cycleFor(activeRoad, truckCap);
  const stockRate = stockpilers().reduce((sum, e) => sum + productionRate(e), 0);
  const matched = Math.min(loaderRate, fleetProd);
  const digRate = matched + stockRate;
  const durationHr = digRate > 0 ? volume / digRate : Infinity;
  const truckProd = active.cycleMin > 0 ? truckCap / (active.cycleMin / 60) : 0;
  const trucksToMatch = truckProd > 0 ? loaderRate / truckProd : Infinity;
  const count = liveLoaders().length;
  const loaderWord = `${count} live-loading machine${count === 1 ? "" : "s"}`;
  let limitedBy;
  if (count === 0) {
    limitedBy = stockRate > 0 ? "Everything is being stockpiled on site. Trucks are idle." : "No excavator is digging.";
  } else if (truckCount === 0) {
    limitedBy = `No trucks on a haul road. Assign trucks to a haul road to move material from ${loaderWord}.`;
  } else if (fleetProd < loaderRate) {
    limitedBy = `Haul-limited. About ${Math.ceil(trucksToMatch)} trucks would keep up with ${loaderWord}.`;
  } else {
    limitedBy = `Loading-limited. Extra trucks wait on ${loaderWord}.`;
  }
  if (count > 0 && stockRate > 0) limitedBy += ` Plus ${stockRate.toFixed(0)} cy/hr stockpiled on site.`;
  const parked = state.equipment.filter((e) => {
    const road = isTruck(e) && e.haulId ? findHaul(e.haulId) : null;
    return road && !canHaulTo(e, road);
  });
  if (parked.length) {
    limitedBy += ` ${parked.length} truck${parked.length === 1 ? " is" : "s are"} parked because ${parked.length === 1 ? "its" : "their"} haul road goes somewhere ${parked.length === 1 ? "it" : "they"} can't dump.`;
  }

  return {
    volume,
    truckCap,
    ...active,
    cycles,
    fleetProd,
    matched,
    durationHr,
    limitedBy,
    loaderRate,
    truckCount,
  };
}

function renderResults(result) {
  document.getElementById("outEarthwork").textContent =
    `${formatCy(terrain.cut)} / ${formatCy(terrain.fill)}`;
  document.getElementById("outHauled").textContent =
    `${formatCy(hauledTotal("offsite"))} / ${formatCy(hauledTotal("stockpile"))}`;
  document.getElementById("outDistance").textContent =
    `${result.haulFt.toFixed(0)} ft (${ftToMiles(result.haulFt).toFixed(2)} mi)`;
  document.getElementById("outLoad").textContent = formatMin(result.loadMin);
  document.getElementById("outCycle").textContent = formatMin(result.cycleMin);
  document.getElementById("outFleet").textContent =
    `${result.fleetProd.toFixed(0)} cy/hr · ${result.truckCount} truck${result.truckCount === 1 ? "" : "s"}`;
  document.getElementById("outMatch").textContent =
    `${result.matched.toFixed(0)} cy/hr`;
  document.getElementById("outDuration").textContent = formatHours(
    result.durationHr
  );
  document.getElementById("constraint").textContent =
    `${result.limitedBy} Live loading ${result.loaderRate.toFixed(0)} cy/hr.`;
}

function areaHandles(area) {
  return {
    nw: { x: area.x, y: area.y },
    ne: { x: area.x + area.w, y: area.y },
    sw: { x: area.x, y: area.y + area.h },
    se: { x: area.x + area.w, y: area.y + area.h },
  };
}

function pointInArea(p, area) {
  return (
    p.x >= area.x &&
    p.x <= area.x + area.w &&
    p.y >= area.y &&
    p.y <= area.y + area.h
  );
}

function svgEl(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  if (parent) parent.appendChild(node);
  return node;
}

function stampSprite(id, parent) {
  const src = document.getElementById(id);
  const clone = src.cloneNode(true);
  clone.removeAttribute("id");
  parent.appendChild(clone);
  return clone;
}

function keyed(parent, key, factory) {
  let node = parent.querySelector(`[data-key="${key}"]`);
  if (!node) {
    node = factory();
    node.setAttribute("data-key", key);
    parent.appendChild(node);
  }
  return node;
}

function pruneLayer(parent, live) {
  [...parent.children].forEach((child) => {
    if (!live.has(child.getAttribute("data-key"))) child.remove();
  });
}

function pathFromPoints(points) {
  if (!points.length) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function rectFromCorners(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

function rectPoly(a, b) {
  const r = rectFromCorners(a, b);
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

function polygonArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    a += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(a) / 2;
}

function pointInPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    const hit =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

function circleThrough(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-4) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { cx, cy, r: Math.hypot(a.x - cx, a.y - cy) };
}

function wrap2pi(from, to) {
  return (to - from + Math.PI * 2) % (Math.PI * 2);
}

function arcPath(a, m, b) {
  const c = circleThrough(a, m, b);
  if (!c) return pathFromPoints([a, b]);
  const ang = (p) => Math.atan2(p.y - c.cy, p.x - c.cx);
  const a0 = ang(a);
  const a1 = ang(m);
  const a2 = ang(b);
  const sum = wrap2pi(a0, a1) + wrap2pi(a1, a2);
  const sweep = sum <= Math.PI * 2 + 1e-6 ? 1 : 0;
  const total = sweep ? sum : Math.PI * 4 - sum;
  const large = total > Math.PI ? 1 : 0;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${c.r.toFixed(2)} ${c.r.toFixed(2)} 0 ${large} ${sweep} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function sampleArc(a, m, b, steps = 24) {
  const c = circleThrough(a, m, b);
  if (!c) return [a, b];
  const ang = (p) => Math.atan2(p.y - c.cy, p.x - c.cx);
  const a0 = ang(a);
  const a1 = ang(m);
  const a2 = ang(b);
  const sum = wrap2pi(a0, a1) + wrap2pi(a1, a2);
  const dir = sum <= Math.PI * 2 + 1e-6 ? 1 : -1;
  const total = dir === 1 ? sum : Math.PI * 4 - sum;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + dir * (total * i) / steps;
    pts.push({ x: c.cx + c.r * Math.cos(t), y: c.cy + c.r * Math.sin(t) });
  }
  return pts;
}

function sampleCircle(center, rim, steps = 32) {
  const r = dist(center, rim);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({ x: center.x + r * Math.cos(t), y: center.y + r * Math.sin(t) });
  }
  return pts;
}

function splinePath(pts) {
  if (pts.length < 2) return pathFromPoints(pts);
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function sampleSpline(pts, per = 8) {
  if (pts.length < 2) return pts.slice();
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function arrowHead(from, to, size = 12) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  return [
    to,
    {
      x: to.x - size * Math.cos(ang - 0.42),
      y: to.y - size * Math.sin(ang - 0.42),
    },
    {
      x: to.x - size * Math.cos(ang + 0.42),
      y: to.y - size * Math.sin(ang + 0.42),
    },
  ];
}

function textBox(drawing) {
  const p = drawing.kind === "leader" ? drawing.points[drawing.points.length - 1] : drawing.points[0];
  const label = drawing.text || "Note";
  const w = Math.max(72, label.length * 7.2 + 16);
  const h = 26;
  return { x: p.x, y: p.y, w, h, label };
}

function drawingStroke(drawing) {
  const pts = drawing.points;
  if (!pts.length) return [];
  const kind = drawing.kind;
  if (kind === "rect" && pts.length >= 2) return rectPoly(pts[0], pts[1]);
  if (kind === "circle" && pts.length >= 2) return sampleCircle(pts[0], pts[1]);
  if (kind === "arc" && pts.length >= 3) return sampleArc(pts[0], pts[1], pts[2]);
  if (kind === "spline") return sampleSpline(pts);
  if (kind === "polygon" || kind === "hatch") {
    return pts.length > 2 ? [...pts, pts[0]] : pts;
  }
  return pts;
}

function drawingPath(drawing) {
  const pts = drawing.points;
  const kind = drawing.kind;
  if (kind === "arc" && pts.length >= 3) return arcPath(pts[0], pts[1], pts[2]);
  if (kind === "circle" && pts.length >= 2) {
    const r = dist(pts[0], pts[1]);
    if (r < 1) return "";
    return `M ${pts[0].x + r} ${pts[0].y} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${pts[0].x - r} ${pts[0].y} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${pts[0].x + r} ${pts[0].y}`;
  }
  if (kind === "rect" && pts.length >= 2) {
    const poly = rectPoly(pts[0], pts[1]);
    return `${pathFromPoints(poly)} Z`;
  }
  if (kind === "spline") return splinePath(pts);
  if (kind === "polygon" || kind === "hatch") {
    return pts.length ? `${pathFromPoints(pts)} Z` : "";
  }
  return pathFromPoints(pts);
}

function drawingMeta(drawing) {
  const elev = elevLabel(drawing);
  const base = drawingFacts(drawing);
  return elev ? (base ? `${base} · ${elev}` : elev) : base;
}

function drawingFacts(drawing) {
  const pts = drawing.points;
  const kind = drawing.kind;
  if (kind === "circle" && pts.length >= 2) {
    const r = dist(pts[0], pts[1]);
    return `Ø ${formatFt(r * 2)}`;
  }
  if (kind === "rect" && pts.length >= 2) {
    const r = rectFromCorners(pts[0], pts[1]);
    return `${formatFt(r.w)} × ${formatFt(r.h)}`;
  }
  if ((kind === "polygon" || kind === "hatch") && pts.length >= 3) {
    const sf = polygonArea(pts) * state.feetPerPx * state.feetPerPx;
    return `${sf.toFixed(0)} sf`;
  }
  if (kind === "point" && pts[0]) {
    return `${formatFt(pts[0].x)} E, ${formatFt(pts[0].y)} N`;
  }
  if (kind === "text" || kind === "leader") return drawing.text || "Note";
  const stroke = drawingStroke(drawing);
  return stroke.length > 1 ? formatFt(polylineLength(stroke)) : "";
}

function drawPointer(event) {
  const spec = drawSpec();
  let p = clampPoint(sitePoint(event));
  if (spec.id !== "freehand") p = snapPoint(p);
  else p = { ...p, snapped: false };
  const from = state.draft[0];
  if (from && event.shiftKey) {
    if (spec.id === "rect") {
      const dx = p.x - from.x || 1;
      const dy = p.y - from.y || 1;
      const s = Math.max(Math.abs(dx), Math.abs(dy));
      p = {
        x: from.x + Math.sign(dx) * s,
        y: from.y + Math.sign(dy) * s,
        snapped: false,
      };
    } else if (spec.id !== "circle") {
      p = { ...constrainOrtho(from, p), snapped: false };
    }
  }
  return p;
}

function drawDimGraphic(key, a, b, selected, live, handles) {
  live.add(key);
  const g = keyed(layerMeasures, key, () => {
    const group = svgEl("g", { class: "dim" }, layerMeasures);
    svgEl("path", { class: "dim-witness" }, group);
    svgEl("path", { class: "dim-line" }, group);
    svgEl("path", { class: "dim-ticks" }, group);
    const label = svgEl("g", { class: "dim-label" }, group);
    svgEl("rect", { rx: 4 }, label);
    svgEl("text", {}, label);
    svgEl("circle", { class: "handle measure", r: HANDLE_R, "data-end": "0" }, group);
    svgEl("circle", { class: "handle measure", r: HANDLE_R, "data-end": "1" }, group);
    return group;
  });
  g.setAttribute("class", `dim${selected ? " selected" : ""}`);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const sign = ny > 0.01 || (Math.abs(ny) <= 0.01 && nx > 0) ? 1 : -1;
  const off = DIM_OFF * sign;
  const a1 = { x: a.x + nx * off, y: a.y + ny * off };
  const b1 = { x: b.x + nx * off, y: b.y + ny * off };
  const aW = { x: a.x + nx * (off + 8), y: a.y + ny * (off + 8) };
  const bW = { x: b.x + nx * (off + 8), y: b.y + ny * (off + 8) };
  const tick = 5;
  g.querySelector(".dim-witness").setAttribute(
    "d",
    `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${aW.x.toFixed(1)} ${aW.y.toFixed(1)} M ${b.x.toFixed(1)} ${b.y.toFixed(1)} L ${bW.x.toFixed(1)} ${bW.y.toFixed(1)}`
  );
  g.querySelector(".dim-line").setAttribute("d", pathFromPoints([a1, b1]));
  g.querySelector(".dim-ticks").setAttribute(
    "d",
    `M ${(a1.x - nx * tick).toFixed(1)} ${(a1.y - ny * tick).toFixed(1)} L ${(a1.x + nx * tick).toFixed(1)} ${(a1.y + ny * tick).toFixed(1)} M ${(b1.x - nx * tick).toFixed(1)} ${(b1.y - ny * tick).toFixed(1)} L ${(b1.x + nx * tick).toFixed(1)} ${(b1.y + ny * tick).toFixed(1)}`
  );
  const mid = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const label = g.querySelector(".dim-label");
  label.setAttribute("transform", `translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
  const text = label.querySelector("text");
  text.textContent = formatFt(len);
  const box = label.querySelector("rect");
  const w = Math.max(44, text.textContent.length * 6.6 + 10);
  box.setAttribute("x", String(-w / 2));
  box.setAttribute("y", "-9");
  box.setAttribute("width", String(w));
  box.setAttribute("height", "18");
  g.querySelectorAll("[data-end]").forEach((handle) => {
    const pt = handle.getAttribute("data-end") === "0" ? a : b;
    handle.setAttribute("cx", pt.x);
    handle.setAttribute("cy", pt.y);
    handle.setAttribute("display", handles && selected ? "block" : "none");
  });
}

function drawSketch(drawing, selected, live, draft = false) {
  const key = draft ? "draft" : `dw-${drawing.id}`;
  live.add(key);
  const g = keyed(layerLinework, key, () => {
    const group = svgEl("g", {}, layerLinework);
    svgEl("path", { class: "line-path" }, group);
    svgEl("polygon", { class: "draw-arrow-head" }, group);
    svgEl("circle", { class: "draw-point-dot", r: 4 }, group);
    svgEl("path", { class: "draw-point-cross" }, group);
    svgEl("rect", { class: "draw-text-box", rx: 4 }, group);
    svgEl("text", { class: "draw-text" }, group);
    return group;
  });
  g.setAttribute("class", `draw-group${selected ? " selected" : ""}`);
  const path = g.querySelector(".line-path");
  const kind = drawing.kind;
  path.setAttribute("d", drawingPath(drawing));
  const classes = ["line-path"];
  if (selected) classes.push("selected");
  if (draft) classes.push("line-draft");
  if (Number.isFinite(drawing.z0)) classes.push("on-surface");
  if (kind === "hatch") classes.push("draw-fill");
  if (kind === "polygon" || kind === "rect") classes.push("draw-closed");
  path.setAttribute("class", classes.join(" "));
  if (kind === "hatch") path.setAttribute("fill", "url(#hatch-lines)");
  else if (kind === "polygon" || kind === "rect") path.setAttribute("fill", "rgba(142,202,230,0.12)");
  else path.setAttribute("fill", "none");

  const head = g.querySelector(".draw-arrow-head");
  if ((kind === "arrow" || kind === "leader") && drawing.points.length >= 2) {
    const a = drawing.points[0];
    const b = drawing.points[drawing.points.length - 1];
    const pts = kind === "leader" ? arrowHead(b, a) : arrowHead(a, b);
    head.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
    head.setAttribute("display", "block");
  } else {
    head.setAttribute("display", "none");
  }

  const dot = g.querySelector(".draw-point-dot");
  const cross = g.querySelector(".draw-point-cross");
  if (kind === "point" && drawing.points[0]) {
    const p = drawing.points[0];
    dot.setAttribute("cx", p.x);
    dot.setAttribute("cy", p.y);
    dot.setAttribute("display", "block");
    cross.setAttribute(
      "d",
      `M ${p.x - 8} ${p.y} L ${p.x + 8} ${p.y} M ${p.x} ${p.y - 8} L ${p.x} ${p.y + 8}`
    );
    cross.setAttribute("display", "block");
  } else {
    dot.setAttribute("display", "none");
    cross.setAttribute("display", "none");
  }

  const box = g.querySelector(".draw-text-box");
  const text = g.querySelector(".draw-text");
  if (kind === "text" || kind === "leader") {
    const tb = textBox(drawing);
    box.setAttribute("x", tb.x);
    box.setAttribute("y", tb.y);
    box.setAttribute("width", tb.w);
    box.setAttribute("height", tb.h);
    box.setAttribute("display", "block");
    text.setAttribute("x", tb.x + 8);
    text.setAttribute("y", tb.y + 17);
    text.textContent = tb.label;
    text.setAttribute("display", "block");
  } else if (Number.isFinite(drawing.z0) && drawing.points[0]) {
    box.setAttribute("display", "none");
    const stroke = drawingStroke(drawing);
    const mid = stroke[Math.floor(stroke.length / 2)] || drawing.points[0];
    text.setAttribute("x", mid.x + 6);
    text.setAttribute("y", mid.y - 6);
    text.textContent = elevLabel(drawing);
    text.setAttribute("display", "block");
  } else {
    box.setAttribute("display", "none");
    text.setAttribute("display", "none");
  }

  if (selected && !draft) {
    drawing.points.forEach((pt, i) => {
      const hk = `lv-${drawing.id}-${i}`;
      live.add(hk);
      const handle = keyed(layerLinework, hk, () =>
        svgEl("circle", { r: HANDLE_R, class: "handle line" }, layerLinework)
      );
      handle.setAttribute("cx", pt.x);
      handle.setAttribute("cy", pt.y);
    });
  }
  if (draft) {
    state.draft.forEach((pt, i) => {
      const hk = `draft-h-${i}`;
      live.add(hk);
      const handle = keyed(layerLinework, hk, () =>
        svgEl("circle", { r: HANDLE_R, class: "handle draft" }, layerLinework)
      );
      handle.setAttribute("cx", pt.x);
      handle.setAttribute("cy", pt.y);
    });
  }
}

let tinPathVersion = -1;

function drawTin() {
  if (tinPathVersion === terrain.tinVersion) return;
  tinPathVersion = terrain.tinVersion;
  const path = document.getElementById("tinEdges");
  const { vertices, triangles } = terrain.tin;
  if (!triangles.length) {
    path.setAttribute("d", "");
    return;
  }
  const seen = new Set();
  let d = "";
  for (let i = 0; i < triangles.length; i += 3) {
    const ids = [triangles[i], triangles[i + 1], triangles[i + 2]];
    for (let e = 0; e < 3; e++) {
      const a = ids[e];
      const b = ids[(e + 1) % 3];
      const k = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const pa = vertices[a];
      const pb = vertices[b];
      d += `M${pa.x.toFixed(1)} ${pa.y.toFixed(1)}L${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`;
    }
  }
  path.setAttribute("d", d);
}

function drawSite() {
  drawTin();
  const liveAreas = new Set();
  for (const area of state.workAreas) {
    liveAreas.add(`area-${area.id}`);
    drawWorkArea(area);
  }
  pruneLayer(layerAreas, liveAreas);

  const liveUtilities = new Set();
  for (const utility of state.utilities) drawUtility(utility, liveUtilities);
  pruneLayer(layerUtilities, liveUtilities);

  const liveLines = new Set();
  for (const drawing of state.drawings) {
    const selected = state.focus.kind === "drawing" && state.focus.id === drawing.id;
    drawSketch(drawing, selected, liveLines);
  }
  if (state.drawing && state.draft.length) {
    const pts = state.hover ? [...state.draft, state.hover] : state.draft.slice();
    drawSketch(
      { id: "draft", kind: state.drawKind, points: pts, text: "Note" },
      false,
      liveLines,
      true
    );
  }
  pruneLayer(layerLinework, liveLines);

  const liveHaul = new Set();
  for (const road of state.haulRoads) {
    const pts = routePoints(road);
    const haulD = pathFromPoints(pts);
    const selected = state.focus.kind === "haul" && state.focus.id === road.id;
    const bedKey = `haul-bed-${road.id}`;
    const surfKey = `haul-surface-${road.id}`;
    const dashKey = `haul-dash-${road.id}`;
    liveHaul.add(bedKey);
    liveHaul.add(surfKey);
    liveHaul.add(dashKey);
    keyed(layerHaul, bedKey, () => svgEl("path", { class: "haul-bed" }, layerHaul)).setAttribute("d", haulD);
    keyed(layerHaul, surfKey, () => svgEl("path", { class: "haul-surface" }, layerHaul)).setAttribute("d", haulD);
    const dash = keyed(layerHaul, dashKey, () => svgEl("path", { class: "haul-dash" }, layerHaul));
    dash.setAttribute("d", haulD);
    dash.setAttribute("class", `haul-dash${selected ? " selected" : ""}`);
    if (selected) {
      road.waypoints.forEach((wp, i) => {
        const key = `wp-${road.id}-${i}`;
        liveHaul.add(key);
        const handle = keyed(layerHaul, key, () =>
          svgEl("circle", { r: HANDLE_R, class: "handle haul" }, layerHaul)
        );
        handle.setAttribute("cx", wp.x);
        handle.setAttribute("cy", wp.y);
      });
    }
  }
  pruneLayer(layerHaul, liveHaul);

  const liveActors = new Set();
  for (const dump of state.dumps) {
    liveActors.add(`dump-${dump.id}-${dump.kind}`);
    drawDump(dump);
  }
  for (const supply of state.supplies) {
    liveActors.add(`sup-${supply.id}`);
    drawSupply(supply);
  }
  for (const piece of state.equipment) {
    if (piece.live) {
      liveActors.add(`truck-${piece.id}`);
      drawTruck(piece);
      continue;
    }
    liveActors.add(`eq-${piece.id}`);
    if (specFor(piece).sprite) drawExcavator(piece);
    else drawEquipBlock(piece);
  }
  pruneLayer(layerActors, liveActors);

  const liveDims = new Set();
  for (const measure of state.measures) {
    const selected = state.focus.kind === "measure" && state.focus.id === measure.id;
    drawDimGraphic(`m-${measure.id}`, measure.points[0], measure.points[1], selected, liveDims, true);
  }
  if (state.focus.kind === "area") {
    const area = findArea(state.focus.id);
    if (area) {
      drawDimGraphic(
        `area-w-${area.id}`,
        { x: area.x, y: area.y },
        { x: area.x + area.w, y: area.y },
        false,
        liveDims,
        false
      );
      drawDimGraphic(
        `area-h-${area.id}`,
        { x: area.x + area.w, y: area.y },
        { x: area.x + area.w, y: area.y + area.h },
        false,
        liveDims,
        false
      );
    }
  }
  if (state.measuring && state.draft.length) {
    const end = state.hover || state.draft[0];
    drawDimGraphic("draft-measure", state.draft[0], end, true, liveDims, false);
    if (end.snapped) {
      liveDims.add("snap");
      const snap = keyed(layerMeasures, "snap", () =>
        svgEl("circle", { r: 7, class: "dim-snap" }, layerMeasures)
      );
      snap.setAttribute("cx", end.x);
      snap.setAttribute("cy", end.y);
    }
  } else if (state.measuring && state.hover?.snapped) {
    liveDims.add("snap");
    const snap = keyed(layerMeasures, "snap", () =>
      svgEl("circle", { r: 7, class: "dim-snap" }, layerMeasures)
    );
    snap.setAttribute("cx", state.hover.x);
    snap.setAttribute("cy", state.hover.y);
  }
  pruneLayer(layerMeasures, liveDims);

  const u = unitsPerScreenPx();
  const ftPerScreenPx = state.feetPerPx * u;
  const barFt = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((ft) => ft / ftPerScreenPx >= 70) || 5000;
  const barPx = barFt / ftPerScreenPx;
  const chipW = 78 + barPx;
  const scale = keyed(layerUi, "scale", () => {
    const g = svgEl("g", {}, layerUi);
    svgEl("rect", { class: "scale-chip", x: 0, y: 0, height: 28, rx: 6 }, g);
    svgEl("text", { class: "scale-chip-text", x: 10, y: 18 }, g);
    svgEl("line", { y1: 18, y2: 18, stroke: "#fff8e7", "stroke-width": 2 }, g);
    return g;
  });
  const cam = state.camera;
  scale.setAttribute(
    "transform",
    `translate(${cam.x + cam.w - (chipW + 12) * u} ${cam.y + cam.h - 40 * u}) scale(${u})`
  );
  scale.querySelector("text").textContent = `${barFt.toLocaleString()} ft`;
  scale.querySelector("rect").setAttribute("width", String(chipW));
  scale.querySelector("line").setAttribute("x1", "66");
  scale.querySelector("line").setAttribute("x2", String(66 + barPx));

  const brush = keyed(layerUi, "brush", () => svgEl("circle", { class: "grade-brush" }, layerUi));
  if (state.grading && state.hoverPt) {
    brush.setAttribute("cx", state.hoverPt.x);
    brush.setAttribute("cy", state.hoverPt.y);
    brush.setAttribute("r", gradeSettings().radius);
    brush.setAttribute("display", "block");
  } else {
    brush.setAttribute("display", "none");
  }

}

function drawUtility(utility, live) {
  const spec = utilitySpec(utility);
  const selected = state.focus.kind === "utility" && state.focus.id === utility.id;
  const key = `ut-${utility.id}`;
  live.add(key);
  const g = keyed(layerUtilities, key, () => {
    const group = svgEl("g", {}, layerUtilities);
    svgEl("path", { class: "utility-casing" }, group);
    svgEl("path", { class: "utility-line" }, group);
    svgEl("text", { class: "utility-label" }, group);
    return group;
  });
  g.setAttribute("class", `utility${selected ? " selected" : ""}`);
  const d = pathFromPoints(utility.points);
  g.querySelector(".utility-casing").setAttribute("d", d);
  const line = g.querySelector(".utility-line");
  line.setAttribute("d", d);
  line.setAttribute("stroke", spec.color);
  const a = utility.points[0];
  const b = utility.points[1] || a;
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const label = g.querySelector(".utility-label");
  label.setAttribute(
    "transform",
    `translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) rotate(${angle.toFixed(1)}) translate(0 -8)`
  );
  label.textContent = utilityTag(utility);
  if (selected) {
    utility.points.forEach((pt, i) => {
      const hk = `ut-${utility.id}-v${i}`;
      live.add(hk);
      const handle = keyed(layerUtilities, hk, () =>
        svgEl("circle", { r: HANDLE_R, class: "handle utility" }, layerUtilities)
      );
      handle.setAttribute("cx", pt.x);
      handle.setAttribute("cy", pt.y);
    });
  }
}

function drawWorkArea(area) {
  const selected = state.focus.kind === "area" && state.focus.id === area.id;
  const g = keyed(layerAreas, `area-${area.id}`, () => {
    const group = svgEl("g", {}, layerAreas);
    svgEl("rect", { class: "pit", rx: 22 }, group);
    svgEl("ellipse", { class: "pit-hole" }, group);
    svgEl("path", { class: "mound", "stroke-width": 2, stroke: "#8d6a3e" }, group);
    svgEl("text", { class: "work-area-label" }, group);
    ["nw", "ne", "sw", "se"].forEach((corner) => {
      svgEl("circle", { class: "handle area", r: HANDLE_R, "data-corner": corner }, group);
    });
    return group;
  });
  const linked = linkedAreaId() === area.id;
  g.setAttribute(
    "class",
    `work-area ${area.kind}${selected ? " selected" : ""}${linked && !selected ? " linked" : ""}`
  );
  const pit = g.querySelector(".pit");
  pit.setAttribute("x", area.x);
  pit.setAttribute("y", area.y);
  pit.setAttribute("width", area.w);
  pit.setAttribute("height", area.h);
  const hole = g.querySelector(".pit-hole");
  hole.setAttribute("display", area.kind === "cut" ? "block" : "none");
  hole.setAttribute("cx", area.x + area.w / 2);
  hole.setAttribute("cy", area.y + area.h / 2 + 6);
  hole.setAttribute("rx", area.w * 0.34);
  hole.setAttribute("ry", area.h * 0.28);
  const mound = g.querySelector(".mound");
  if (area.kind === "fill") {
    mound.setAttribute("display", "block");
    mound.setAttribute("fill", "#c9a36a");
    mound.setAttribute(
      "d",
      `M ${area.x + 18} ${area.y + area.h - 18} Q ${area.x + area.w * 0.35} ${area.y + 18} ${area.x + area.w / 2} ${area.y + area.h - 22} Q ${area.x + area.w * 0.72} ${area.y + 10} ${area.x + area.w - 18} ${area.y + area.h - 18} Z`
    );
  } else {
    mound.setAttribute("display", "none");
  }
  const text = g.querySelector("text");
  text.setAttribute("x", area.x + 16);
  text.setAttribute("y", area.y + 24);
  text.textContent =
    area.kind !== "zone" && Number.isFinite(area.designElev)
      ? `${area.name} · ${materialLabel(area)} · pad ${area.designElev} ft`
      : area.name;
  const handles = areaHandles(area);
  g.querySelectorAll("[data-corner]").forEach((handle) => {
    const pt = handles[handle.getAttribute("data-corner")];
    handle.setAttribute("cx", pt.x);
    handle.setAttribute("cy", pt.y);
    handle.setAttribute("display", selected ? "block" : "none");
  });
}

function drawExcavator(p) {
  const selected = state.focus.kind === "equipment" && p.id === state.focus.id;
  const g = keyed(layerActors, `eq-${p.id}`, () => {
    const group = svgEl("g", { filter: "url(#soft-shadow)" }, layerActors);
    stampSprite("sprite-excavator", group);
    svgEl("text", { class: "work-area-label", x: 0, y: 32, "text-anchor": "middle", "font-size": "11" }, group);
    return group;
  });
  const onArea =
    state.focus.kind === "area" && p.areaId === state.focus.id;
  g.setAttribute(
    "class",
    `actor-excavator${selected ? " selected" : ""}${onArea ? " on-area" : ""}`
  );
  g.setAttribute("transform", `translate(${p.x} ${p.y})`);
  g.querySelector("text").textContent = specFor(p).short;
}

function drawEquipBlock(p) {
  const spec = specFor(p);
  const selected = state.focus.kind === "equipment" && p.id === state.focus.id;
  const g = keyed(layerActors, `eq-${p.id}`, () => {
    const group = svgEl("g", {}, layerActors);
    svgEl("rect", {
      class: "equip-block-body",
      x: -BLOCK,
      y: -BLOCK,
      width: BLOCK * 2,
      height: BLOCK * 2,
      rx: 6,
    }, group);
    svgEl("text", { class: "equip-block-code", x: 0, y: 4 }, group);
    svgEl("text", { class: "equip-block-name", x: 0, y: BLOCK + 14 }, group);
    return group;
  });
  const onArea =
    state.focus.kind === "area" && p.areaId === state.focus.id;
  g.setAttribute(
    "class",
    `equip-block${selected ? " selected" : ""}${onArea ? " on-area" : ""}`
  );
  g.setAttribute("transform", `translate(${p.x} ${p.y})`);
  g.querySelector(".equip-block-body").setAttribute("fill", spec.color);
  g.querySelector(".equip-block-code").textContent = spec.short;
  g.querySelector(".equip-block-name").textContent = equipmentLabel(p);
}

function drawSupply(s) {
  const spec = supplySpec(s);
  const selected = state.focus.kind === "supply" && state.focus.id === s.id;
  const g = keyed(layerActors, `sup-${s.id}`, () => {
    const group = svgEl("g", {}, layerActors);
    svgEl("rect", { class: "equip-block-body", rx: 3 }, group);
    if (spec.lines) svgEl("path", { class: "supply-linework" }, group);
    svgEl("text", { class: "equip-block-code", x: 0, y: 3 }, group);
    svgEl("text", { class: "equip-block-name" }, group);
    return group;
  });
  g.setAttribute("class", `equip-block supply-block${spec.lines ? " custom" : ""}${selected ? " selected" : ""}`);
  g.setAttribute("transform", `translate(${s.x} ${s.y})`);
  if (spec.lines) {
    const fpp = state.feetPerPx;
    const reach = supplyReach(s);
    const path = g.querySelector(".supply-linework");
    if (path.dataset.fpp !== String(fpp)) {
      path.dataset.fpp = String(fpp);
      path.setAttribute(
        "d",
        spec.lines
          .map((line) => line.map(([x, , z], i) => `${i ? "L" : "M"}${(x / fpp).toFixed(2)} ${(z / fpp).toFixed(2)}`).join(""))
          .join("")
      );
    }
    path.setAttribute("stroke", spec.color);
    const body = g.querySelector(".equip-block-body");
    body.setAttribute("x", -reach);
    body.setAttribute("y", -reach);
    body.setAttribute("width", reach * 2);
    body.setAttribute("height", reach * 2);
    g.querySelector(".equip-block-code").textContent = "";
    const name = g.querySelector(".equip-block-name");
    name.setAttribute("y", reach + 12);
    name.textContent = selected ? supplyLabel(s) : spec.short;
    return;
  }
  const body = g.querySelector(".equip-block-body");
  body.setAttribute("x", -spec.size);
  body.setAttribute("y", -spec.size);
  body.setAttribute("width", spec.size * 2);
  body.setAttribute("height", spec.size * 2);
  body.setAttribute("fill", spec.color);
  g.querySelector(".equip-block-code").textContent = spec.short;
  const name = g.querySelector(".equip-block-name");
  name.setAttribute("y", spec.size + 12);
  name.textContent = spec.text ? s.text || "" : selected ? supplyLabel(s) : "";
}

function drawDump(p) {
  const selected = state.focus.kind === "dump" && state.focus.id === p.id;
  const g = keyed(layerActors, `dump-${p.id}-${p.kind}`, () => {
    const group = svgEl("g", { class: "actor-dump", filter: "url(#soft-shadow)" }, layerActors);
    svgEl("circle", { class: "dump-select", r: 38 }, group);
    const sprite = stampSprite(p.kind === "offsite" ? "sprite-offsite-gate" : "sprite-dump-pile", group);
    sprite.setAttribute("class", "dump-sprite");
    svgEl("text", { class: "work-area-label", x: 0, y: 32, "text-anchor": "middle", "font-size": "11" }, group);
    return group;
  });
  g.setAttribute("class", `actor-dump${selected ? " selected" : ""}`);
  g.setAttribute("transform", `translate(${p.x} ${p.y})`);
  g.querySelector(".dump-select").setAttribute("display", selected ? "block" : "none");
  if (p.kind === "stockpile") {
    const s = pileScale(p);
    g.querySelector(".dump-sprite").setAttribute("transform", `translate(0 16) scale(${s}) translate(0 -16)`);
  }
  g.querySelector("text").textContent = `${DUMP_KINDS[p.kind].tag} ${dumpIndex(p)}`;
}

function drawTruck(piece) {
  const t = piece.live;
  const selected = state.focus.kind === "equipment" && piece.id === state.focus.id;
  const g = keyed(layerActors, `truck-${piece.id}`, () => {
    const group = svgEl("g", {}, layerActors);
    svgEl("circle", { class: "truck-select", r: 30 }, group);
    stampSprite(specFor(piece).truckSprite, group);
    return group;
  });
  g.setAttribute("display", t.x == null ? "none" : "inline");
  if (t.x == null) return;
  const deg = ((t.angle || 0) * 180) / Math.PI;
  g.querySelector(".truck-select").setAttribute("display", selected ? "block" : "none");
  g.setAttribute("class", `actor-truck ${t.phase || "haul"}`);
  g.setAttribute("transform", `translate(${t.x} ${t.y}) rotate(${deg})`);
}

function hitTest(p) {
  for (let i = state.equipment.length - 1; i >= 0; i--) {
    const piece = state.equipment[i];
    const at = piece.live || piece;
    if (at.x != null && dist(p, at) < EQUIP_R) {
      return { kind: "equipment", id: piece.id };
    }
  }
  for (let i = state.dumps.length - 1; i >= 0; i--) {
    const dump = state.dumps[i];
    if (dist(p, dump) < EQUIP_R + 8) return { kind: "dump", id: dump.id };
  }
  for (let i = state.supplies.length - 1; i >= 0; i--) {
    const supply = state.supplies[i];
    const reach = supplyReach(supply) + 4;
    if (Math.abs(p.x - supply.x) <= reach && Math.abs(p.y - supply.y) <= reach) {
      return { kind: "supply", id: supply.id };
    }
  }

  for (let i = state.measures.length - 1; i >= 0; i--) {
    const measure = state.measures[i];
    for (let v = 0; v < measure.points.length; v++) {
      if (dist(p, measure.points[v]) < HANDLE_R + 6) {
        return { kind: "measure-vertex", id: measure.id, index: v };
      }
    }
    if (measure.points.length >= 2) {
      const hit = closestOnSegment(p, measure.points[0], measure.points[1]);
      if (hit.d < 14) return { kind: "measure", id: measure.id };
    }
  }

  for (let i = state.drawings.length - 1; i >= 0; i--) {
    const drawing = state.drawings[i];
    for (let v = 0; v < drawing.points.length; v++) {
      if (dist(p, drawing.points[v]) < HANDLE_R + 6) {
        return { kind: "drawing-vertex", id: drawing.id, index: v };
      }
    }
    if (drawing.kind === "text" || drawing.kind === "leader") {
      const tb = textBox(drawing);
      if (p.x >= tb.x && p.x <= tb.x + tb.w && p.y >= tb.y && p.y <= tb.y + tb.h) {
        return { kind: "drawing", id: drawing.id };
      }
    }
    if (drawing.kind === "hatch" || drawing.kind === "polygon" || drawing.kind === "rect") {
      const poly =
        drawing.kind === "rect" && drawing.points.length >= 2
          ? rectPoly(drawing.points[0], drawing.points[1])
          : drawing.points;
      if (poly.length >= 3 && pointInPoly(p, poly)) {
        return { kind: "drawing", id: drawing.id };
      }
    }
    if (drawing.kind === "circle" && drawing.points.length >= 2) {
      const r = dist(drawing.points[0], drawing.points[1]);
      if (Math.abs(dist(p, drawing.points[0]) - r) < LINE_HIT + 4) {
        return { kind: "drawing", id: drawing.id };
      }
    }
    if (drawing.kind === "point" && drawing.points[0] && dist(p, drawing.points[0]) < 12) {
      return { kind: "drawing", id: drawing.id };
    }
    const stroke = drawingStroke(drawing);
    for (let s = 1; s < stroke.length; s++) {
      const hit = closestOnSegment(p, stroke[s - 1], stroke[s]);
      if (hit.d < LINE_HIT) return { kind: "drawing", id: drawing.id };
    }
  }

  for (let r = state.haulRoads.length - 1; r >= 0; r--) {
    const road = state.haulRoads[r];
    for (let i = 0; i < road.waypoints.length; i++) {
      if (dist(p, road.waypoints[i]) < HANDLE_R + 6) {
        return { kind: "waypoint", id: road.id, index: i };
      }
    }
    const route = routePoints(road);
    for (let i = 1; i < route.length; i++) {
      const hit = closestOnSegment(p, route[i - 1], route[i]);
      if (hit.d < 14) {
        return { kind: "segment", id: road.id, index: i - 1, point: hit.point };
      }
    }
  }

  for (let u = state.utilities.length - 1; u >= 0; u--) {
    const utility = state.utilities[u];
    for (let i = 0; i < utility.points.length; i++) {
      if (dist(p, utility.points[i]) < HANDLE_R + 6) {
        return { kind: "utility-vertex", id: utility.id, index: i };
      }
    }
    for (let i = 1; i < utility.points.length; i++) {
      const hit = closestOnSegment(p, utility.points[i - 1], utility.points[i]);
      if (hit.d < LINE_HIT) {
        return { kind: "utility", id: utility.id, index: i - 1, point: hit.point };
      }
    }
  }

  if (state.focus.kind === "area") {
    const area = findArea(state.focus.id);
    if (area) {
      const handles = areaHandles(area);
      for (const [corner, pt] of Object.entries(handles)) {
        if (dist(p, pt) < AREA_HANDLE + 4) {
          return { kind: "area-resize", id: area.id, corner };
        }
      }
    }
  }

  for (let i = state.workAreas.length - 1; i >= 0; i--) {
    const area = state.workAreas[i];
    if (pointInArea(p, area)) return { kind: "area", id: area.id };
  }

  return null;
}

function sitePoint(event) {
  const rect = svg.getBoundingClientRect();
  const cam = state.camera;
  return {
    x: cam.x + ((event.clientX - rect.left) / rect.width) * cam.w,
    y: cam.y + ((event.clientY - rect.top) / rect.height) * cam.h,
  };
}

function viewCenter() {
  const cam = state.camera;
  return clampPoint({ x: cam.x + cam.w / 2, y: cam.y + cam.h / 2 });
}

function unitsPerScreenPx() {
  const rect = svg.getBoundingClientRect();
  return rect.width ? state.camera.w / rect.width : 1;
}

function applyCamera() {
  const rect = svg.getBoundingClientRect();
  const cam = state.camera;
  if (rect.width && rect.height) cam.h = cam.w * (rect.height / rect.width);
  const maxW = Math.max(SITE.w, SITE.h * (rect.width / Math.max(1, rect.height))) * 1.1;
  if (cam.w > maxW) {
    const k = maxW / cam.w;
    cam.w *= k;
    cam.h *= k;
  }
  const cx = Math.max(0, Math.min(SITE.w, cam.x + cam.w / 2));
  const cy = Math.max(0, Math.min(SITE.h, cam.y + cam.h / 2));
  cam.x = cx - cam.w / 2;
  cam.y = cy - cam.h / 2;
  svg.setAttribute("viewBox", `${cam.x} ${cam.y} ${cam.w} ${cam.h}`);
}

function zoomAt(factor, client = null) {
  const rect = svg.getBoundingClientRect();
  const cam = state.camera;
  const fx = client ? (client.clientX - rect.left) / rect.width : 0.5;
  const fy = client ? (client.clientY - rect.top) / rect.height : 0.5;
  const ax = cam.x + fx * cam.w;
  const ay = cam.y + fy * cam.h;
  const w = Math.max(MIN_VIEW_W, cam.w * factor);
  cam.h *= w / cam.w;
  cam.w = w;
  cam.x = ax - fx * cam.w;
  cam.y = ay - fy * cam.h;
  applyCamera();
}

function fitSite() {
  const rect = svg.getBoundingClientRect();
  const aspect = rect.width / Math.max(1, rect.height);
  const cam = state.camera;
  cam.w = Math.max(SITE.w, SITE.h * aspect) * 1.04;
  cam.x = SITE.w / 2 - cam.w / 2;
  cam.y = SITE.h / 2 - cam.w / aspect / 2;
  applyCamera();
}

function clampPoint(p) {
  return {
    x: Math.max(8, Math.min(SITE.w - 8, p.x)),
    y: Math.max(8, Math.min(SITE.h - 8, p.y)),
  };
}

function resizeArea(area, corner, p) {
  const right = area.x + area.w;
  const bottom = area.y + area.h;
  let x1 = area.x;
  let y1 = area.y;
  let x2 = right;
  let y2 = bottom;
  if (corner.includes("w")) x1 = p.x;
  if (corner.includes("e")) x2 = p.x;
  if (corner.includes("n")) y1 = p.y;
  if (corner.includes("s")) y2 = p.y;
  area.x = Math.min(x1, x2);
  area.y = Math.min(y1, y2);
  area.w = Math.max(MIN_AREA, Math.abs(x2 - x1));
  area.h = Math.max(MIN_AREA, Math.abs(y2 - y1));
}

const CLICK_PX = 5;

function beginPan(event, clickClears = false) {
  state.pan = {
    sx: event.clientX,
    sy: event.clientY,
    cx: state.camera.x,
    cy: state.camera.y,
    moved: false,
    clickClears,
  };
  svg.setPointerCapture(event.pointerId);
}

svg.addEventListener("pointerdown", (event) => {
  if (event.button === 1 || event.button === 2) {
    event.preventDefault();
    beginPan(event);
    return;
  }
  const p = clampPoint(sitePoint(event));
  if (state.grading) {
    if (event.button === 0) {
      beginGrade(p);
      svg.setPointerCapture(event.pointerId);
    }
    return;
  }
  if (state.drawing) {
    const spec = drawSpec();
    const pt = drawPointer(event);
    if (spec.drag) {
      state.draft = [pt];
      state.freehand = true;
    } else {
      state.draft.push(pt);
      if (spec.clicks && state.draft.length >= spec.clicks) commitDrawing();
    }
    svg.setPointerCapture(event.pointerId);
    return;
  }
  if (state.measuring) {
    state.draft.push(measurePointer(event));
    if (state.draft.length >= 2) finishMeasure();
    svg.setPointerCapture(event.pointerId);
    return;
  }

  const hit = hitTest(p);
  if (!hit) {
    if (event.button === 0) beginPan(event, true);
    return;
  }
  if (hit.kind === "equipment") {
    state.selectedId = hit.id;
    state.focus = { kind: "equipment", id: hit.id };
    state.drag = hit;
  } else if (hit.kind === "area") {
    state.focus = { kind: "area", id: hit.id };
    state.drag = { kind: "area-move", id: hit.id, dx: p.x - findArea(hit.id).x, dy: p.y - findArea(hit.id).y };
  } else if (hit.kind === "area-resize") {
    state.focus = { kind: "area", id: hit.id };
    state.drag = hit;
  } else if (hit.kind === "drawing" || hit.kind === "drawing-vertex") {
    state.focus = { kind: "drawing", id: hit.id };
    if (hit.kind === "drawing") {
      const drawing = findDrawing(hit.id);
      state.drag = {
        kind: "drawing-move",
        id: hit.id,
        ox: p.x,
        oy: p.y,
        origin: drawing.points.map((pt) => ({ ...pt })),
      };
    } else {
      state.drag = hit;
    }
  } else if (hit.kind === "dump") {
    state.focus = { kind: "dump", id: hit.id };
    state.drag = hit;
  } else if (hit.kind === "supply") {
    state.focus = { kind: "supply", id: hit.id };
    state.drag = hit;
  } else if (hit.kind === "utility-vertex") {
    state.focus = { kind: "utility", id: hit.id };
    state.drag = hit;
  } else if (hit.kind === "utility") {
    const utility = findUtility(hit.id);
    const wasSelected = state.focus.kind === "utility" && state.focus.id === hit.id;
    state.focus = { kind: "utility", id: hit.id };
    if (utility && wasSelected) {
      utility.points.splice(hit.index + 1, 0, hit.point);
      state.drag = { kind: "utility-vertex", id: utility.id, index: hit.index + 1 };
    } else if (utility) {
      state.drag = {
        kind: "utility-move",
        id: utility.id,
        ox: p.x,
        oy: p.y,
        origin: utility.points.map((pt) => ({ ...pt })),
      };
    }
  } else if (hit.kind === "waypoint") {
    state.focus = { kind: "haul", id: hit.id };
    state.drag = hit;
  } else if (hit.kind === "measure" || hit.kind === "measure-vertex") {
    state.focus = { kind: "measure", id: hit.id };
    state.drag = hit;
  } else if (hit.kind === "segment") {
    const road = findHaul(hit.id);
    state.focus = { kind: "haul", id: hit.id };
    if (road) {
      const insertAt = Math.min(road.waypoints.length, hit.index + 1);
      road.waypoints.splice(insertAt, 0, hit.point);
      state.drag = { kind: "waypoint", id: road.id, index: insertAt };
    }
  }

  syncSelectionPanel();
  svg.classList.add("dragging");
  svg.setPointerCapture(event.pointerId);
});

svg.addEventListener("pointermove", (event) => {
  if (state.pan) {
    if (!state.pan.moved && Math.hypot(event.clientX - state.pan.sx, event.clientY - state.pan.sy) <= CLICK_PX) {
      return;
    }
    state.pan.moved = true;
    svg.classList.add("panning");
    const u = unitsPerScreenPx();
    state.camera.x = state.pan.cx - (event.clientX - state.pan.sx) * u;
    state.camera.y = state.pan.cy - (event.clientY - state.pan.sy) * u;
    applyCamera();
    return;
  }
  const p = clampPoint(sitePoint(event));
  state.hoverPt = p;
  if (state.grading) {
    moveGrade(p);
    return;
  }
  if (state.drawing) {
    const pt = drawPointer(event);
    if (state.freehand) {
      const last = state.draft[state.draft.length - 1];
      if (!last || dist(last, pt) > 2.5) {
        if (state.draft.length < 400) state.draft.push(pt);
      }
    } else {
      state.hover = pt;
    }
    updateHint();
    return;
  }
  if (state.measuring) {
    state.hover = measurePointer(event);
    updateHint();
    return;
  }
  if (!state.drag) return;

  if (state.drag.kind === "equipment") {
    const piece = state.equipment.find((e) => e.id === state.drag.id);
    if (piece) {
      piece.x = p.x;
      piece.y = p.y;
    }
  } else if (state.drag.kind === "dump") {
    const dump = findDump(state.drag.id);
    if (dump) {
      dump.x = p.x;
      dump.y = p.y;
    }
  } else if (state.drag.kind === "supply") {
    const supply = findSupply(state.drag.id);
    if (supply) {
      supply.x = p.x;
      supply.y = p.y;
    }
  } else if (state.drag.kind === "utility-vertex") {
    const utility = findUtility(state.drag.id);
    if (utility) utility.points[state.drag.index] = { x: p.x, y: p.y };
  } else if (state.drag.kind === "utility-move") {
    const utility = findUtility(state.drag.id);
    if (utility) {
      const dx = p.x - state.drag.ox;
      const dy = p.y - state.drag.oy;
      utility.points = state.drag.origin.map((pt) => clampPoint({ x: pt.x + dx, y: pt.y + dy }));
    }
  } else if (state.drag.kind === "waypoint") {
    const road = findHaul(state.drag.id);
    if (road) road.waypoints[state.drag.index] = p;
  } else if (state.drag.kind === "area-move") {
    const area = findArea(state.drag.id);
    if (area) {
      area.x = Math.max(8, Math.min(SITE.w - area.w - 8, p.x - state.drag.dx));
      area.y = Math.max(8, Math.min(SITE.h - area.h - 8, p.y - state.drag.dy));
    }
  } else if (state.drag.kind === "area-resize") {
    const area = findArea(state.drag.id);
    if (area) resizeArea(area, state.drag.corner, p);
  } else if (state.drag.kind === "drawing-vertex") {
    const drawing = findDrawing(state.drag.id);
    if (drawing) {
      const snapped = snapPoint(p);
      drawing.points[state.drag.index] = { x: snapped.x, y: snapped.y };
    }
  } else if (state.drag.kind === "drawing-move") {
    const drawing = findDrawing(state.drag.id);
    if (drawing) {
      const dx = p.x - state.drag.ox;
      const dy = p.y - state.drag.oy;
      drawing.points = state.drag.origin.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
    }
  } else if (state.drag.kind === "measure-vertex") {
    const measure = findMeasure(state.drag.id);
    if (measure) {
      const snapped = event.shiftKey && measure.points[1 - state.drag.index]
        ? constrainOrtho(measure.points[1 - state.drag.index], snapPoint(p))
        : snapPoint(p);
      measure.points[state.drag.index] = { x: snapped.x, y: snapped.y };
    }
  }
});

svg.addEventListener("pointerup", () => {
  if (state.pan) {
    const clear = state.pan.clickClears && !state.pan.moved;
    state.pan = null;
    svg.classList.remove("panning");
    if (clear) clearSelection();
    return;
  }
  endGrade();
  if (state.freehand) commitDrawing();
  state.drag = null;
  svg.classList.remove("dragging");
});

svg.addEventListener("contextmenu", (event) => event.preventDefault());

svg.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    zoomAt(Math.exp(Math.max(-60, Math.min(60, delta)) * 0.004), event);
  },
  { passive: false }
);

new ResizeObserver(() => applyCamera()).observe(svg);
document.getElementById("zoomInBtn").addEventListener("click", () => zoomAt(1 / 1.4));
document.getElementById("zoomOutBtn").addEventListener("click", () => zoomAt(1.4));
document.getElementById("zoomFitBtn").addEventListener("click", fitSite);

svg.addEventListener("pointerleave", () => {
  if (!grade.active) state.hoverPt = null;
});

svg.addEventListener("dblclick", (event) => {
  const p = sitePoint(event);
  if (state.drawing) {
    if (state.draft.length) state.draft.pop();
    commitDrawing();
    event.preventDefault();
    return;
  }
  if (state.measuring) {
    cancelDraft();
    setMeasuring(false);
    event.preventDefault();
    return;
  }
  const hit = hitTest(p);
  if (hit?.kind === "waypoint") {
    const road = findHaul(hit.id);
    if (road) road.waypoints.splice(hit.index, 1);
  } else if (hit?.kind === "utility-vertex") {
    const utility = findUtility(hit.id);
    if (utility && utility.points.length > 2) utility.points.splice(hit.index, 1);
  } else if (hit?.kind === "drawing-vertex") {
    const drawing = findDrawing(hit.id);
    const spec = drawing ? drawSpec(drawing.kind) : null;
    const min = spec?.min || spec?.clicks || 2;
    if (drawing && drawing.points.length > min) drawing.points.splice(hit.index, 1);
  }
});

const EQUIP_MENU = [
  { type: "hydraulic-excavator" },
  { type: "on-road-dump", note: "Offsite or stockpile" },
  { type: "articulated-dump", note: "Stockpile only" },
  { type: "bulldozer" },
  { type: "wheel-loader" },
  { type: "soil-compactor" },
  { type: "compact-track-loader" },
  { type: "backhoe-loader" },
  { type: "trencher" },
];
const SCALES = [2, 4, 8];
const PLACERS = { equipment: addEquipment, supply: addSupply, utility: addUtility };
const pickMenu = document.getElementById("pickMenu");
const placeGhost = document.getElementById("placeGhost");
let pickAnchor = null;

function placingSpec(kind, type) {
  if (kind === "equipment") return EQUIP_CATALOG[type];
  if (kind === "utility") return UTILITY_CATALOG[type];
  return SUPPLY_CATALOG[type];
}

function closePickMenu() {
  pickMenu.hidden = true;
  pickMenu.replaceChildren();
  pickAnchor?.setAttribute("aria-expanded", "false");
  pickAnchor = null;
}

function menuEl(tag, className, text, parent) {
  const el = document.createElement(tag);
  el.className = className;
  if (text != null) el.textContent = text;
  parent.append(el);
  return el;
}

function openPickMenu(anchor, sections) {
  if (pickAnchor === anchor) {
    closePickMenu();
    return;
  }
  closePickMenu();
  const close = menuEl("button", "pick-menu-close", "✕", pickMenu);
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", closePickMenu);
  for (const { heading, items, empty } of sections) {
    if (heading) menuEl("p", "pick-menu-heading", heading, pickMenu);
    if (!items.length && empty) menuEl("p", "pick-menu-empty", empty, pickMenu);
    for (const item of items) {
      const btn = menuEl("button", "pick-menu-item", null, pickMenu);
      btn.type = "button";
      btn.setAttribute("role", "menuitem");
      if (item.checked) btn.classList.add("checked");
      if (item.action) btn.classList.add("action");
      if (item.color) {
        const swatch = menuEl("span", "pick-swatch", item.short || "", btn);
        swatch.style.background = item.color;
      }
      const text = menuEl("span", "pick-menu-text", null, btn);
      menuEl("span", "pick-menu-label", item.label, text);
      if (item.note) menuEl("span", "pick-menu-note", item.note, text);
      if (item.place) {
        btn.title = "Drag onto the site, or click then click the site";
        btn.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          closePickMenu();
          beginPlacing(item.place.kind, item.place.type, event);
        });
        btn.addEventListener("click", (event) => {
          if (event.detail !== 0) return;
          closePickMenu();
          beginPlacing(item.place.kind, item.place.type);
        });
      } else {
        btn.addEventListener("click", () => {
          closePickMenu();
          item.action();
        });
      }
    }
  }
  pickMenu.hidden = false;
  pickAnchor = anchor;
  anchor.setAttribute("aria-expanded", "true");
  const r = anchor.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 16;
  const above = r.top - 16;
  const up = below < Math.min(pickMenu.scrollHeight, 240) && above > below;
  pickMenu.style.maxHeight = `${Math.max(160, up ? above : below)}px`;
  pickMenu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pickMenu.offsetWidth - 8))}px`;
  pickMenu.style.top = up ? `${Math.max(8, r.top - 4 - pickMenu.offsetHeight)}px` : `${r.bottom + 4}px`;
  pickMenu.querySelector(".pick-menu-item")?.focus({ preventScroll: true });
}

function placeItem(kind, type, extra = {}) {
  const spec = placingSpec(kind, type);
  return { label: spec.label, short: spec.short, color: spec.color, place: { kind, type }, ...extra };
}

function supplyItems(filter) {
  return Object.keys(SUPPLY_CATALOG)
    .filter(filter)
    .map((type) => placeItem("supply", type));
}

function openItemEditor(mode) {
  window.itemEditor?.open(mode);
}

function beginPlacing(kind, type, event = null) {
  const spec = placingSpec(kind, type);
  if (!spec) return;
  if (state.drawing || state.measuring || state.grading) setTool(null);
  state.placing = { kind, type, label: spec.label, dragging: !!event };
  placeGhost.querySelector(".place-ghost-swatch").style.background = spec.color;
  placeGhost.querySelector(".place-ghost-label").textContent = spec.label;
  placeGhost.style.transform = "translate(-9999px, 0)";
  placeGhost.hidden = false;
  document.body.classList.add("placing");
  if (event) moveGhost(event);
  updateHint();
}

function dropPoint(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (target?.closest("#site")) return clampPoint(sitePoint(event));
  if (target?.tagName === "CANVAS" && target.closest("#view3d")) {
    return window.siteApi.pickGround?.(event) || null;
  }
  return null;
}

function moveGhost(event) {
  placeGhost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;
  placeGhost.classList.toggle("over-site", !!dropPoint(event));
}

function finishPlacing(event) {
  const at = dropPoint(event);
  if (!at) return false;
  const { kind, type } = state.placing;
  cancelPlacing();
  PLACERS[kind](type, at);
  return true;
}

function cancelPlacing() {
  if (!state.placing) return;
  state.placing = null;
  placeGhost.hidden = true;
  document.body.classList.remove("placing");
  updateHint();
}

window.addEventListener(
  "pointerdown",
  (event) => {
    const inMenu = pickMenu.contains(event.target);
    const onPicker = !!event.target.closest?.(".pick-btn");
    if (!pickMenu.hidden && !inMenu && !onPicker) closePickMenu();
    if (!state.placing || state.placing.dragging || inMenu) return;
    if (onPicker || event.button !== 0) {
      cancelPlacing();
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    if (!finishPlacing(event)) cancelPlacing();
  },
  true
);
window.addEventListener(
  "pointermove",
  (event) => {
    if (state.placing) moveGhost(event);
  },
  true
);
window.addEventListener(
  "pointerup",
  (event) => {
    if (!state.placing?.dragging) return;
    state.placing.dragging = false;
    if (finishPlacing(event)) event.stopPropagation();
    else updateHint();
  },
  true
);

document.getElementById("addEquipBtn").addEventListener("click", (event) => {
  openPickMenu(event.currentTarget, [
    { items: EQUIP_MENU.map(({ type, note }) => placeItem("equipment", type, { note })) },
  ]);
});
document.getElementById("addSupplyBtn").addEventListener("click", (event) => {
  openPickMenu(event.currentTarget, [
    { items: supplyItems((type) => !type.startsWith("custom-") && !type.startsWith("structure-")) },
    { heading: "Custom items", items: supplyItems((type) => type.startsWith("custom-")) },
    { items: [{ label: "New item…", note: "Build one in 3D", action: () => openItemEditor("supply") }] },
  ]);
});
document.getElementById("addStructureBtn").addEventListener("click", (event) => {
  openPickMenu(event.currentTarget, [
    {
      heading: "Structures",
      items: supplyItems((type) => type.startsWith("structure-")),
      empty: "No structures yet.",
    },
    { items: [{ label: "New structure…", note: "Build pieces in 3D", action: () => openItemEditor("structure") }] },
  ]);
});
document.getElementById("addUtilityBtn").addEventListener("click", (event) => {
  openPickMenu(event.currentTarget, [
    { items: Object.keys(UTILITY_CATALOG).map((type) => placeItem("utility", type)) },
  ]);
});
document.getElementById("addAreaBtn").addEventListener("click", addWorkArea);
document.getElementById("addOffsiteBtn").addEventListener("click", () => addDump("offsite"));
document.getElementById("addStockpileBtn").addEventListener("click", () => addDump("stockpile"));
function focusedUtility() {
  return state.focus.kind === "utility" ? findUtility(state.focus.id) : null;
}
document.getElementById("utilityKindSelect").addEventListener("change", (event) => {
  const utility = focusedUtility();
  if (utility) utility.type = event.target.value;
});
document.getElementById("utilityModeSelect").addEventListener("change", (event) => {
  const utility = focusedUtility();
  if (!utility) return;
  const p = utility.points[0];
  if (event.target.value === "elev") {
    utility.elev = Math.round((surfaceAt(p) - utility.depth) * 10) / 10;
  } else {
    utility.depth = Math.max(0, Math.round((surfaceAt(p) - utility.elev) * 2) / 2);
  }
  utility.mode = event.target.value;
});
document.getElementById("utilityDepth").addEventListener("input", (event) => {
  const utility = focusedUtility();
  const value = Number(event.target.value);
  if (utility && event.target.value !== "" && Number.isFinite(value)) {
    utility.depth = Math.max(0, value);
  }
});
document.getElementById("utilityElev").addEventListener("input", (event) => {
  const utility = focusedUtility();
  const value = readElev(event.target);
  if (utility && value != null) utility.elev = value;
});
document.getElementById("utilityDiameter").addEventListener("input", (event) => {
  const utility = focusedUtility();
  const value = Number(event.target.value);
  if (utility && Number.isFinite(value) && value > 0) utility.diameter = value;
});
document.getElementById("supplyTextInput").addEventListener("input", (event) => {
  const supply = state.focus.kind === "supply" ? findSupply(state.focus.id) : null;
  if (!supply) return;
  supply.text = event.target.value;
  document.getElementById("selectedName").textContent = supplyLabel(supply);
});
document.getElementById("addHaulBtn").addEventListener("click", addHaulRoad);
document.getElementById("copyBtn").addEventListener("click", copySelected);
document.getElementById("pasteBtn").addEventListener("click", pasteSelected);
document.getElementById("removeEquipBtn").addEventListener("click", removeSelected);
document.getElementById("areaNameInput").addEventListener("input", (event) => {
  const area = findArea(state.focus.id);
  if (area) area.name = event.target.value;
});
document.getElementById("areaKindSelect").addEventListener("change", (event) => {
  const area = findArea(state.focus.id);
  if (!area) return;
  area.kind = event.target.value;
  area.designElev = null;
});
document.getElementById("areaMaterialSelect").addEventListener("change", (event) => {
  const area = findArea(state.focus.id);
  if (!area) return;
  area.material = event.target.value;
  resetMaterialFactors(area);
});
document.getElementById("areaFactorOn").addEventListener("change", (event) => {
  const area = findArea(state.focus.id);
  if (!area) return;
  if (area.kind === "cut") area.swellOn = event.target.checked;
  else area.compactOn = event.target.checked;
});
document.getElementById("areaFactorPct").addEventListener("input", (event) => {
  const area = findArea(state.focus.id);
  const value = Number(event.target.value);
  if (!area || event.target.value === "" || !Number.isFinite(value)) return;
  const pct = Math.max(0, Math.min(100, value));
  if (area.kind === "cut") area.swellPct = pct;
  else area.compactPct = pct;
});
document.getElementById("areaDesignElev").addEventListener("input", (event) => {
  const area = findArea(state.focus.id);
  const value = Number(event.target.value);
  if (area && event.target.value !== "" && Number.isFinite(value)) {
    area.designElev = Math.max(MIN_ELEV, Math.min(MAX_ELEV, value));
  }
});
document.getElementById("areaSideSlope").addEventListener("input", (event) => {
  const area = findArea(state.focus.id);
  const value = Number(event.target.value);
  if (area && Number.isFinite(value) && value > 0) area.sideSlope = Math.max(0.25, value);
});
document.getElementById("gradeBtn").addEventListener("click", () => {
  setTool("grade");
});
document.getElementById("gradeMode").addEventListener("change", updateHint);
document.getElementById("resetGroundBtn").addEventListener("click", resetGround);
document.querySelectorAll(".view-toggle [data-view]").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});
document.getElementById("vexag").addEventListener("input", (event) => {
  state.vexag = Number(event.target.value) || 1;
  document.getElementById("vexagOut").textContent = `${state.vexag}×`;
});
document.getElementById("showExisting").addEventListener("change", (event) => {
  state.showExisting = event.target.checked;
});
document.getElementById("drawLineBtn").addEventListener("click", (event) => {
  if (state.drawing) {
    closePickMenu();
    setTool("draw");
    return;
  }
  openPickMenu(event.currentTarget, [
    {
      items: DRAW_TOOLS.map((tool) => ({
        label: tool.label,
        checked: tool.id === state.drawKind,
        action: () => {
          state.drawKind = tool.id;
          setTool("draw");
        },
      })),
    },
  ]);
});
document.getElementById("drawTextInput").addEventListener("input", (event) => {
  const drawing = findDrawing(state.focus.id);
  if (drawing) drawing.text = event.target.value;
});
document.getElementById("drawElevStart").addEventListener("input", (event) => {
  const drawing = findDrawing(state.focus.id);
  if (drawing && state.focus.kind === "drawing") drawing.z0 = readElev(event.target);
});
document.getElementById("drawElevEnd").addEventListener("input", (event) => {
  const drawing = findDrawing(state.focus.id);
  if (drawing && state.focus.kind === "drawing") drawing.z1 = readElev(event.target);
});
document.getElementById("drawUseGroundBtn").addEventListener("click", () => {
  const drawing = findDrawing(state.focus.id);
  if (!drawing || !drawing.points[0]) return;
  drawing.z0 = Math.round(groundAt(drawing.points[0]) * 10) / 10;
  drawing.z1 = null;
  syncSelectionPanel();
});
document.getElementById("measureBtn").addEventListener("click", () => {
  setTool("measure");
});

document.getElementById("equipAreaSelect").addEventListener("change", (event) => {
  const piece = selectedEquipment();
  if (!piece) return;
  const value = event.target.value;
  piece.areaId = value ? Number(value) : null;
  syncSelectionPanel();
});
document.getElementById("equipHaulSelect").addEventListener("change", (event) => {
  const piece = selectedEquipment();
  if (!piece) return;
  const value = event.target.value;
  piece.haulId = value ? Number(value) : null;
  syncSelectionPanel();
});
document.getElementById("loadModeSelect").addEventListener("change", (event) => {
  const piece = selectedEquipment();
  if (!piece || !isLoader(piece)) return;
  piece.loadMode = event.target.value;
  if (piece.loadMode === "stockpile" && !findDump(piece.stockpileId)) {
    const existing = state.dumps.find((d) => d.kind === "stockpile");
    if (existing) {
      piece.stockpileId = existing.id;
    } else if (state.dumps.length < MAX_DUMPS) {
      const pile = {
        id: state.nextId++,
        kind: "stockpile",
        x: Math.min(SITE.w - 40, piece.x + 90),
        y: Math.max(40, piece.y - 60),
        hauled: 0,
      };
      state.dumps.push(pile);
      piece.stockpileId = pile.id;
    }
  }
  syncSelectionPanel();
});
document.getElementById("equipStockpileSelect").addEventListener("change", (event) => {
  const piece = selectedEquipment();
  if (!piece) return;
  const value = event.target.value;
  piece.stockpileId = value ? Number(value) : null;
  syncSelectionPanel();
});
document.getElementById("prodModeSelect").addEventListener("change", (event) => {
  const piece = selectedEquipment();
  if (!piece || !isLoader(piece)) return;
  piece.prodMode = event.target.value;
  syncSelectionPanel();
});
document.getElementById("haulDumpSelect").addEventListener("change", (event) => {
  const road = findHaul(state.focus.id);
  if (!road) return;
  const value = event.target.value;
  road.dumpId = value ? Number(value) : null;
  syncSelectionPanel();
});
document.getElementById("straightenBtn").addEventListener("click", () => {
  const road = state.focus.kind === "haul" ? findHaul(state.focus.id) : selectedHaul();
  if (!road || road.waypoints.length < 2) return;
  const a = road.waypoints[0];
  const b = dumpForRoad(road) || road.waypoints[road.waypoints.length - 1];
  const midCount = Math.max(1, road.waypoints.length - 1);
  const pts = [];
  for (let i = 0; i <= midCount; i++) {
    const t = i / midCount;
    pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  if (dumpForRoad(road) && pts.length) pts.pop();
  road.waypoints = pts.length >= 2 ? pts : [a, b];
});

document.getElementById("scaleBtn").addEventListener("click", (event) => {
  const btn = event.currentTarget;
  openPickMenu(btn, [
    {
      items: SCALES.map((fpp) => ({
        label: `1 px = ${fpp} ft`,
        checked: fpp === state.feetPerPx,
        action: () => {
          state.feetPerPx = fpp;
          btn.textContent = `Scale: 1 px = ${fpp} ft`;
        },
      })),
    },
  ]);
});

document.getElementById("inputs").addEventListener("input", (event) => {
  if (event.target instanceof HTMLSelectElement) return;
  applySelectedRateFromInput();
  if (state.focus.kind === "equipment") syncSelectionPanel();
});

window.addEventListener("keydown", (event) => {
  const typing =
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement;
  if (event.key === "Escape" && (state.placing || !pickMenu.hidden)) {
    cancelPlacing();
    closePickMenu();
    event.preventDefault();
    return;
  }
  if (typing) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "c") {
    copySelected();
    event.preventDefault();
  } else if ((event.ctrlKey || event.metaKey) && key === "v") {
    pasteSelected();
    event.preventDefault();
  } else if (event.key === "Enter" && state.drawing) {
    commitDrawing();
    event.preventDefault();
  } else if (event.key === "Enter" && state.measuring) {
    if (state.draft.length >= 2) finishMeasure();
    else setMeasuring(false);
    event.preventDefault();
  } else if (event.key === "Escape" && (state.drawing || state.measuring || state.grading)) {
    cancelDraft();
    if (state.drawing) setDrawing(false);
    if (state.measuring) setMeasuring(false);
    if (state.grading) setTool("grade");
    event.preventDefault();
  } else if (
    (event.key === "Delete" || event.key === "Backspace") &&
    !state.drawing &&
    !state.measuring
  ) {
    if (state.focus.kind && state.focus.kind !== "none") {
      removeSelected();
      event.preventDefault();
    }
  }
});

function setTruckPose(live, path, t) {
  const pos = pointOnPolyline(path, t);
  const look = pointOnPolyline(path, Math.min(1, t + 0.02));
  live.x = pos.x;
  live.y = pos.y;
  live.angle = Math.atan2(look.y - pos.y, look.x - pos.x);
}

function advanceTrucks(result) {
  const waitFactor =
    result.loaderRate > 0 ? Math.max(1, result.fleetProd / result.loaderRate) : 1;
  const queued = new Map();

  for (const road of state.haulRoads) {
    const trucks = trucksOnRoad(road).filter((e) => truckRoad(e));
    if (!trucks.length) continue;
    const dest = dumpForRoad(road);
    const out = routePoints(road);
    const back = [...out].reverse();

    trucks.forEach((truck, i) => {
      const cycle = result.cycles.get(truck.id);
      const cycleMin = cycle.cycleMin * waitFactor;
      const cycleSec = cycleMin * 60;
      const haulShare = (cycle.haulMin + cycle.loadMin * 0.15) / cycleMin;
      const dumpShare = cycle.dumpMin / cycleMin;
      const returnShare = cycle.returnMin / cycleMin;
      const loader = loaderForTruck(truck, out[0]);
      if (!loader || !Number.isFinite(cycleSec) || cycleSec <= 0) {
        truck.live = null;
        return;
      }
      const live = truck.live || (truck.live = { phase: null, x: truck.x, y: truck.y, angle: 0 });
      live.loaderId = loader.id;
      const u = (performance.now() / 1000 / cycleSec + i / trucks.length) % 1;
      const wasHauling = live.phase === "haul";
      if (u < haulShare) {
        live.phase = "haul";
        setTruckPose(live, out, u / haulShare);
      } else if (u < haulShare + dumpShare) {
        live.phase = "dump";
        if (dest?.kind === "offsite") {
          live.x = null;
        } else {
          const end = out[out.length - 1];
          live.x = end.x;
          live.y = end.y;
        }
      } else if (u < haulShare + dumpShare + returnShare) {
        live.phase = "return";
        setTruckPose(live, back, (u - haulShare - dumpShare) / returnShare);
      } else {
        const slot = queued.get(loader.id) || 0;
        queued.set(loader.id, slot + 1);
        live.phase = "load";
        live.x = loader.x + 58;
        live.y = loader.y + 34 + (slot % 3) * 16;
        live.angle = 0;
      }
      if (dest && wasHauling && live.phase !== "haul") {
        const remaining = Math.max(0, result.volume - hauledTotal());
        dest.hauled += Math.min(truck.cap, remaining);
      }
    });
  }
  for (const piece of state.equipment) {
    if (isTruck(piece) && !truckRoad(piece)) piece.live = null;
    if (piece.live && !liveLoaders().some((e) => e.id === piece.live.loaderId)) piece.live = null;
  }
}

function advanceStockpiling(dt, result) {
  for (const piece of stockpilers()) {
    const pile = findDump(piece.stockpileId);
    const remaining = Math.max(0, result.volume - hauledTotal());
    pile.hauled += Math.min((productionRate(piece) * dt) / 3600, remaining);
  }
}

applyCamera();
resetGround();
updateSurface();
renderTerrainImage(true);
syncSelectionPanel();
updateHint();

window.siteApi = {
  SITE,
  DATUM,
  state,
  terrain,
  specFor,
  supplySpec,
  supplyReach,
  addCustomSupply,
  addCustomStructure,
  beginPlacing,
  utilitySpec,
  utilityTopAt,
  equipmentLabel,
  routePoints,
  pileScale,
  surfaceAt,
  groundAt,
  surfaceRGB,
  earthColor,
  focusItem,
  clearSelection,
  beginGrade,
  moveGrade,
  endGrade,
  gradeSettings,
  isGrading: () => state.grading,
  setHover: (p) => {
    if (!grade.active) state.hoverPt = p;
  },
  vscale: () => state.vexag / state.feetPerPx,
};

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  applyGrade(dt);
  updateSurface();
  if (state.view !== "3d") renderTerrainImage();
  updateReadout();
  const result = compute();
  renderResults(result);
  if (
    state.focus.kind === "area" ||
    state.focus.kind === "drawing" ||
    state.focus.kind === "measure" ||
    state.focus.kind === "utility" ||
    state.focus.kind === "dump"
  ) {
    syncSelectionPanel();
  }
  advanceTrucks(result);
  advanceStockpiling(dt, result);
  drawSite();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
