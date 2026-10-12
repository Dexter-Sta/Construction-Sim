const svg = document.getElementById("site");
const NS = "http://www.w3.org/2000/svg";
const SITE = { w: 960, h: 620 };
const layerAreas = document.getElementById("layer-areas");
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
    sprite: true,
  },
  "hydraulic-excavator": {
    label: "Hydraulic excavator",
    short: "HEX",
    role: "load",
    color: "#ef6c00",
    rate: 380,
  },
  "articulated-dump": {
    label: "Articulated dump truck",
    short: "ADT",
    role: "haul",
    color: "#c62828",
    rate: 0,
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
  },
  "soil-compactor": {
    label: "Soil compactor / roller",
    short: "ROL",
    role: "support",
    color: "#546e7a",
    rate: 150,
  },
  "on-road-dump": {
    label: "On-road dump truck",
    short: "ODT",
    role: "haul",
    color: "#1565c0",
    rate: 0,
  },
  "compact-track-loader": {
    label: "Compact track loader",
    short: "CTL",
    role: "load",
    color: "#6d4c41",
    rate: 180,
  },
  "backhoe-loader": {
    label: "Backhoe loader",
    short: "BHL",
    role: "load",
    color: "#ff8f00",
    rate: 140,
  },
  trencher: {
    label: "Trencher",
    short: "TRN",
    role: "load",
    color: "#8d6e63",
    rate: 80,
  },
};

const state = {
  feetPerPx: 4,
  nextId: 5,
  selectedId: 1,
  focus: { kind: "equipment", id: 1 },
  equipment: [{ id: 1, type: "excavator", x: 180, y: 310, rate: 380, haulId: 3, areaId: 4 }],
  workAreas: [
    {
      id: 4,
      kind: "cut",
      name: "Cut 1",
      x: 100,
      y: 225,
      w: 220,
      h: 150,
      designElev: null,
      sideSlope: 2,
    },
  ],
  drawings: [],
  drawing: false,
  measuring: false,
  grading: false,
  hoverPt: null,
  view: "split",
  vexag: 6,
  showExisting: true,
  drawKind: "line",
  freehand: false,
  draft: [],
  hover: null,
  measures: [],
  dumps: [{ id: 2, x: 780, y: 220 }],
  haulRoads: [
    {
      id: 3,
      dumpId: 2,
      waypoints: [
        { x: 340, y: 420 },
        { x: 560, y: 430 },
        { x: 700, y: 300 },
      ],
    },
  ],
  drag: null,
  trucks: [],
};

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

function initialGround(x, y) {
  const hill = 42 * Math.exp(-((x - 210) ** 2 + (y - 300) ** 2) / (2 * 130 ** 2));
  const ridge =
    16 * Math.exp(-((x - 620) ** 2) / (2 * 90 ** 2)) * (0.6 + 0.4 * Math.sin(y / 90));
  const roll = 4 * Math.sin(x / 110 + 1.3) * Math.cos(y / 95);
  const tilt = -14 * (x / SITE.w) + 5 * (y / SITE.h);
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
  if (kind === "dump") {
    const dump = findDump(id);
    return dump ? `Dump ${dumpIndex(dump)}` : "Dump";
  }
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
  return "None";
}

function findMeasure(id) {
  return state.measures.find((m) => m.id === id) || null;
}

function measureIndex(measure) {
  return state.measures.findIndex((m) => m.id === measure.id) + 1;
}

function primaryLoadPoint() {
  const sel = selectedEquipment();
  if (sel && isLoader(sel)) return sel;
  return loaders()[0] || { x: 180, y: 310 };
}

function findDump(id) {
  return state.dumps.find((d) => d.id === id) || null;
}

function findHaul(id) {
  return state.haulRoads.find((h) => h.id === id) || null;
}

function dumpIndex(dump) {
  return state.dumps.findIndex((d) => d.id === dump.id) + 1;
}

function haulIndex(road) {
  return state.haulRoads.findIndex((h) => h.id === road.id) + 1;
}

function selectedHaul() {
  if (state.focus.kind === "haul") return findHaul(state.focus.id);
  if (state.focus.kind === "equipment") {
    const piece = selectedEquipment();
    if (piece?.haulId) return findHaul(piece.haulId);
  }
  const assigned = state.haulRoads.find((road) =>
    state.equipment.some((e) => e.haulId === road.id)
  );
  return assigned || state.haulRoads[0] || null;
}

function dumpForRoad(road) {
  if (!road?.dumpId) return null;
  return findDump(road.dumpId);
}

function equipmentOnHaul(roadId) {
  return state.equipment.filter((e) => e.haulId === roadId);
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
  if (!sel || specFor(sel).role === "haul") return;
  sel.rate = Math.max(10, readNumber("excavatorRate"));
}

function combinedLoadRate() {
  applySelectedRateFromInput();
  return loaders().reduce((sum, e) => sum + (e.rate || 0), 0);
}

function averageLoadRate() {
  const list = loaders();
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
  document.getElementById("drawLineBtn").setAttribute("aria-pressed", state.drawing ? "true" : "false");
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
  const rateEl = document.getElementById("excavatorRate");
  const removeBtn = document.getElementById("removeEquipBtn");
  const addBtn = document.getElementById("addEquipBtn");
  const equipFields = document.getElementById("equipFields");
  const rateFields = document.getElementById("rateFields");
  const haulFields = document.getElementById("haulFields");
  const { kind, id } = state.focus;

  nameEl.textContent = labelForSelection();
  addBtn.disabled = state.equipment.length >= MAX_EQUIPMENT;
  document.getElementById("addDumpBtn").disabled = state.dumps.length >= MAX_DUMPS;
  document.getElementById("addHaulBtn").disabled = state.haulRoads.length >= MAX_HAULS;
  document.getElementById("straightenBtn").disabled = !selectedHaul();
  equipFields.hidden = kind !== "equipment";
  haulFields.hidden = kind !== "haul";

  if (kind === "equipment") {
    const sel = selectedEquipment();
    const spec = sel ? specFor(sel) : null;
    const showRate = spec && spec.role !== "haul";
    rateFields.hidden = !showRate;
    if (sel && showRate && document.activeElement !== rateEl) {
      rateEl.value = String(sel.rate || spec.rate);
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
        ...state.haulRoads.map((road) => ({
          value: String(road.id),
          label: `Haul road ${haulIndex(road)}`,
        })),
      ],
      sel?.haulId ?? ""
    );
    const assignedArea = sel?.areaId ? findArea(sel.areaId) : null;
    const assignedRoad = sel?.haulId ? findHaul(sel.haulId) : null;
    const bits = [];
    if (assignedArea) bits.push(`Work area: ${assignedArea.name}`);
    if (assignedRoad) bits.push(`Haul road ${haulIndex(assignedRoad)}`);
    metaEl.textContent = bits.length
      ? bits.join(" · ")
      : spec
        ? spec.role === "haul"
          ? "Haul unit. Assign a work area and haul route."
          : spec.role === "support"
            ? "Support unit. Assign a work area if this machine works that zone."
            : "No work area assigned."
        : "";
    const lastLoader = isLoader(sel) && loaders().length <= 1;
    removeBtn.disabled = !sel || lastLoader;
  } else if (kind === "area") {
    const area = findArea(id);
    const assigned = area ? equipmentOnArea(area.id) : [];
    const names = assigned.map(equipmentLabel).join(", ");
    const shaped = area && area.kind !== "zone" && Number.isFinite(area.designElev);
    metaEl.textContent = [
      area ? `${pxToFt(area.w).toFixed(0)} × ${pxToFt(area.h).toFixed(0)} ft` : "",
      shaped ? `Pad ${area.designElev} ft at ${area.sideSlope}:1` : "",
      shaped ? `${area.kind === "cut" ? "Cut" : "Fill"} ${formatCy(terrain.areaVolumes.get(area.id) || 0)}` : "",
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
  } else if (kind === "dump") {
    metaEl.textContent = "Dump site";
    removeBtn.disabled = !findDump(id);
  } else if (kind === "haul") {
    const road = findHaul(id);
    const pts = routePoints(road);
    const assigned = road ? equipmentOnHaul(road.id) : [];
    fillSelect(
      document.getElementById("haulDumpSelect"),
      [
        { value: "", label: "None" },
        ...state.dumps.map((dump) => ({
          value: String(dump.id),
          label: `Dump ${dumpIndex(dump)}`,
        })),
      ],
      road?.dumpId ?? ""
    );
    const names = assigned.map(equipmentLabel).join(", ");
    metaEl.textContent = [
      pts.length > 1 ? `${pxToFt(polylineLength(pts)).toFixed(0)} ft` : "",
      names ? `Equipment: ${names}` : "No equipment assigned.",
    ]
      .filter(Boolean)
      .join(" · ");
    removeBtn.disabled = !road;
  } else {
    metaEl.textContent = "";
    removeBtn.disabled = true;
  }
  if (kind !== "area") hideAreaPopover();
  if (kind !== "drawing") hideDrawPopover();
}

function hideAreaPopover() {
  document.getElementById("areaPopover").hidden = true;
}

function hideDrawPopover() {
  document.getElementById("drawPopover").hidden = true;
}

function readElev(input) {
  const value = input.value.trim();
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(MIN_ELEV, Math.min(MAX_ELEV, n)) : null;
}

function syncDrawPopover() {
  const pop = document.getElementById("drawPopover");
  const drawing =
    state.focus.kind === "drawing" ? findDrawing(state.focus.id) : null;
  const showText = drawing && (drawing.kind === "text" || drawing.kind === "leader");
  const showElev = drawing && surfaceKind(drawing.kind);
  if ((!showText && !showElev) || state.view === "3d") {
    pop.hidden = true;
    return;
  }
  pop.hidden = false;
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
  positionDrawPopover(drawing);
}

function positionDrawPopover(drawing) {
  const pop = document.getElementById("drawPopover");
  const wrap = document.querySelector(".site-wrap");
  const svgRect = svg.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const pt = drawing.kind === "leader" ? drawing.points[drawing.points.length - 1] : drawing.points[0];
  const x = (pt.x / SITE.w) * svgRect.width + (svgRect.left - wrapRect.left);
  const y = (pt.y / SITE.h) * svgRect.height + (svgRect.top - wrapRect.top);
  pop.style.left = `${Math.min(x + 12, wrapRect.width - 220)}px`;
  pop.style.top = `${Math.max(0, Math.min(y + 20, wrapRect.height - pop.offsetHeight - 8))}px`;
}

function syncAreaPopover() {
  const pop = document.getElementById("areaPopover");
  const area = state.focus.kind === "area" ? findArea(state.focus.id) : null;
  if (!area || state.view === "3d") {
    pop.hidden = true;
    return;
  }
  pop.hidden = false;
  const nameInput = document.getElementById("areaNameInput");
  const kindSelect = document.getElementById("areaKindSelect");
  if (document.activeElement !== nameInput) nameInput.value = area.name;
  if (document.activeElement !== kindSelect) kindSelect.value = area.kind;
  const design = document.getElementById("areaDesignFields");
  design.hidden = area.kind === "zone";
  if (area.kind !== "zone") {
    const elevInput = document.getElementById("areaDesignElev");
    const slopeInput = document.getElementById("areaSideSlope");
    if (document.activeElement !== elevInput) elevInput.value = String(area.designElev ?? "");
    if (document.activeElement !== slopeInput) slopeInput.value = String(area.sideSlope ?? 2);
    const vol = terrain.areaVolumes.get(area.id) || 0;
    document.getElementById("areaVolume").textContent =
      `${area.kind === "cut" ? "Cut" : "Fill"} ${formatCy(vol)} · existing avg ${meanGround(area).toFixed(1)} ft`;
  }
  positionAreaPopover(area);
}

function positionAreaPopover(area) {
  const pop = document.getElementById("areaPopover");
  const wrap = document.querySelector(".site-wrap");
  const svgRect = svg.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const x = (area.x / SITE.w) * svgRect.width + (svgRect.left - wrapRect.left);
  const y = (area.y / SITE.h) * svgRect.height + (svgRect.top - wrapRect.top);
  pop.style.left = `${Math.min(x + 12, wrapRect.width - 190)}px`;
  pop.style.top = `${Math.max(0, Math.min(y + 36, wrapRect.height - pop.offsetHeight - 8))}px`;
}

function addEquipment() {
  if (state.equipment.length >= MAX_EQUIPMENT) return;
  const type = document.getElementById("equipTypeSelect").value;
  const spec = EQUIP_CATALOG[type];
  if (!spec) return;
  const n = state.equipment.length;
  const piece = {
    id: state.nextId++,
    type,
    x: Math.min(SITE.w - 40, 70 + (n % 7) * 72),
    y: Math.min(SITE.h - 40, 520 - Math.floor(n / 7) * 70),
    rate: spec.rate,
    haulId: null,
    areaId: null,
  };
  state.equipment.push(piece);
  state.selectedId = piece.id;
  state.focus = { kind: "equipment", id: piece.id };
  syncSelectionPanel();
}

function addDump() {
  if (state.dumps.length >= MAX_DUMPS) return;
  const n = state.dumps.length;
  const last = state.dumps[n - 1];
  const dump = {
    id: state.nextId++,
    x: Math.min(SITE.w - 40, (last?.x ?? 780) - 90),
    y: Math.min(SITE.h - 40, (last?.y ?? 220) + 80),
  };
  state.dumps.push(dump);
  state.focus = { kind: "dump", id: dump.id };
  syncSelectionPanel();
}

function addHaulRoad() {
  if (state.haulRoads.length >= MAX_HAULS) return;
  const n = state.haulRoads.length;
  const x0 = 260 + (n % 4) * 36;
  const y0 = 390 + n * 32;
  const road = {
    id: state.nextId++,
    dumpId: null,
    waypoints: [
      { x: x0, y: y0 },
      { x: x0 + 200, y: y0 + 24 },
      { x: Math.min(SITE.w - 40, x0 + 380), y: y0 - 30 },
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
    x: Math.min(SITE.w - 220, 80 + (n % 4) * 28),
    y: Math.min(SITE.h - 150, 70 + (n % 3) * 24),
    w: 220,
    h: 130,
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

function removeSelected() {
  const { kind, id } = state.focus;
  if (kind === "equipment") {
    const piece = state.equipment.find((e) => e.id === id);
    if (piece && isLoader(piece) && loaders().length <= 1) return;
    state.equipment = state.equipment.filter((e) => e.id !== id);
    const next = loaders()[0] || state.equipment[0];
    if (!next) return;
    state.selectedId = next.id;
    state.focus = { kind: "equipment", id: next.id };
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
  }
  syncSelectionPanel();
}

function compute() {
  const volInput = document.getElementById("volume");
  const fromSurface =
    document.getElementById("useSurfaceVolume").checked && terrain.cut > 0;
  volInput.readOnly = fromSurface;
  if (fromSurface && document.activeElement !== volInput) {
    const shown = String(Math.round(terrain.cut));
    if (volInput.value !== shown) volInput.value = shown;
  }
  const volume = fromSurface ? terrain.cut : readNumber("volume");
  const loaderRate = combinedLoadRate();
  const perMachine = averageLoadRate();
  const truckCap = readNumber("truckCap");
  const truckCount = Math.max(1, Math.round(readNumber("truckCount")));
  const loadedMph = readNumber("loadedMph");
  const emptyMph = readNumber("emptyMph");
  const spotMin = readNumber("spotMin");
  const activeRoad = selectedHaul();
  const dumpMin = dumpForRoad(activeRoad) ? readNumber("dumpMin") : 0;

  const haulFt = pxToFt(polylineLength(routePoints(activeRoad)));
  const haulMi = ftToMiles(haulFt);
  const loadMin = perMachine > 0 ? (truckCap / perMachine) * 60 : Infinity;
  const haulMin =
    activeRoad && loadedMph > 0 ? (haulMi / loadedMph) * 60 : 0;
  const returnMin =
    activeRoad && emptyMph > 0 ? (haulMi / emptyMph) * 60 : 0;
  const cycleMin = loadMin + haulMin + dumpMin + returnMin + spotMin;
  const cycleHr = cycleMin / 60;
  const truckProd = cycleHr > 0 ? truckCap / cycleHr : 0;
  const fleetProd = truckProd * truckCount;
  const matched = Math.min(loaderRate, fleetProd);
  const durationHr = matched > 0 ? volume / matched : Infinity;
  const trucksToMatch = truckProd > 0 ? loaderRate / truckProd : Infinity;
  const count = loaders().length;
  const limitedBy =
    fleetProd < loaderRate
      ? `Haul-limited. About ${Math.ceil(trucksToMatch)} trucks would match ${count} loader${count === 1 ? "" : "s"}.`
      : `Loading-limited. Extra trucks wait on ${count} loader${count === 1 ? "" : "s"}.`;

  return {
    haulFt,
    loadMin,
    haulMin,
    returnMin,
    cycleMin,
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
  document.getElementById("outDistance").textContent =
    `${result.haulFt.toFixed(0)} ft (${ftToMiles(result.haulFt).toFixed(2)} mi)`;
  document.getElementById("outLoad").textContent = formatMin(result.loadMin);
  document.getElementById("outCycle").textContent = formatMin(result.cycleMin);
  document.getElementById("outFleet").textContent =
    `${result.fleetProd.toFixed(0)} cy/hr`;
  document.getElementById("outMatch").textContent =
    `${result.matched.toFixed(0)} cy/hr`;
  document.getElementById("outDuration").textContent = formatHours(
    result.durationHr
  );
  document.getElementById("constraint").textContent =
    `${result.limitedBy} Combined loading ${result.loaderRate.toFixed(0)} cy/hr.`;
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
    liveActors.add(`dump-${dump.id}`);
    drawDump(dump);
  }
  state.trucks.forEach((truck, i) => {
    liveActors.add(`truck-${i}`);
    drawTruck(truck, i);
  });
  for (const piece of state.equipment) {
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

  const barFt = 100;
  const barPx = barFt / state.feetPerPx;
  const scale = keyed(layerUi, "scale", () => {
    const g = svgEl("g", {}, layerUi);
    svgEl("rect", { class: "scale-chip", x: 0, y: 0, height: 28, rx: 6 }, g);
    svgEl("text", { class: "scale-chip-text", x: 10, y: 18 }, g).textContent = `${barFt} ft`;
    svgEl("line", { y1: 18, y2: 18, stroke: "#fff8e7", "stroke-width": 2 }, g);
    return g;
  });
  scale.setAttribute("transform", `translate(12 ${SITE.h - 40})`);
  scale.querySelector("rect").setAttribute("width", String(70 + barPx));
  scale.querySelector("line").setAttribute("x1", "58");
  scale.querySelector("line").setAttribute("x2", String(58 + barPx));

  const brush = keyed(layerUi, "brush", () => svgEl("circle", { class: "grade-brush" }, layerUi));
  if (state.grading && state.hoverPt) {
    brush.setAttribute("cx", state.hoverPt.x);
    brush.setAttribute("cy", state.hoverPt.y);
    brush.setAttribute("r", gradeSettings().radius);
    brush.setAttribute("display", "block");
  } else {
    brush.setAttribute("display", "none");
  }

  if (state.focus.kind === "area") {
    const area = findArea(state.focus.id);
    if (area && !document.getElementById("areaPopover").hidden) {
      positionAreaPopover(area);
    }
  }
  if (state.focus.kind === "drawing") {
    const drawing = findDrawing(state.focus.id);
    if (drawing && !document.getElementById("drawPopover").hidden) {
      positionDrawPopover(drawing);
    }
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
      ? `${area.name} · pad ${area.designElev} ft`
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

function drawDump(p) {
  const selected = state.focus.kind === "dump" && state.focus.id === p.id;
  const g = keyed(layerActors, `dump-${p.id}`, () => {
    const group = svgEl("g", { class: "actor-dump", filter: "url(#soft-shadow)" }, layerActors);
    svgEl("circle", { class: "dump-select", r: 38 }, group);
    stampSprite("sprite-dump-pile", group);
    svgEl("text", { class: "work-area-label", x: 0, y: 32, "text-anchor": "middle", "font-size": "11" }, group);
    return group;
  });
  g.setAttribute("class", `actor-dump${selected ? " selected" : ""}`);
  g.setAttribute("transform", `translate(${p.x} ${p.y})`);
  g.querySelector(".dump-select").setAttribute("display", selected ? "block" : "none");
  g.querySelector("text").textContent = `DUMP ${dumpIndex(p)}`;
}

function drawTruck(t, i) {
  if (t.x == null) return;
  const deg = ((t.angle || 0) * 180) / Math.PI;
  const g = keyed(layerActors, `truck-${i}`, () => {
    const group = svgEl("g", {}, layerActors);
    stampSprite("sprite-truck", group);
    return group;
  });
  g.setAttribute("class", `actor-truck ${t.phase || "haul"}`);
  g.setAttribute("transform", `translate(${t.x} ${t.y}) rotate(${deg})`);
}

function hitTest(p) {
  for (let i = state.equipment.length - 1; i >= 0; i--) {
    const piece = state.equipment[i];
    if (dist(p, piece) < EQUIP_R) {
      return { kind: "equipment", id: piece.id };
    }
  }
  for (let i = state.dumps.length - 1; i >= 0; i--) {
    const dump = state.dumps[i];
    if (dist(p, dump) < EQUIP_R + 8) return { kind: "dump", id: dump.id };
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
  const scaleX = SITE.w / rect.width;
  const scaleY = SITE.h / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
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

svg.addEventListener("pointerdown", (event) => {
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
  if (!hit) return;

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
  endGrade();
  if (state.freehand) commitDrawing();
  state.drag = null;
  svg.classList.remove("dragging");
});

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
  } else if (hit?.kind === "drawing-vertex") {
    const drawing = findDrawing(hit.id);
    const spec = drawing ? drawSpec(drawing.kind) : null;
    const min = spec?.min || spec?.clicks || 2;
    if (drawing && drawing.points.length > min) drawing.points.splice(hit.index, 1);
  }
});

document.getElementById("addEquipBtn").addEventListener("click", addEquipment);
document.getElementById("addAreaBtn").addEventListener("click", addWorkArea);
document.getElementById("addDumpBtn").addEventListener("click", addDump);
document.getElementById("addHaulBtn").addEventListener("click", addHaulRoad);
document.getElementById("removeEquipBtn").addEventListener("click", removeSelected);
document.getElementById("areaPopover").addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});
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
document.getElementById("drawKindSelect").addEventListener("change", (event) => {
  if (state.drawing) commitDrawing();
  state.drawKind = event.target.value;
  updateHint();
});
document.getElementById("drawLineBtn").addEventListener("click", () => {
  setTool("draw");
});
document.getElementById("drawPopover").addEventListener("pointerdown", (event) => {
  event.stopPropagation();
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

document.getElementById("scaleSelect").addEventListener("change", (event) => {
  state.feetPerPx = Number(event.target.value);
});

document.getElementById("inputs").addEventListener("input", () => {
  applySelectedRateFromInput();
  syncTruckCount();
});

window.addEventListener("keydown", (event) => {
  const typing =
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement;
  if (typing) return;
  if (event.key === "Enter" && state.drawing) {
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
    if (
      state.focus.kind === "area" ||
      state.focus.kind === "drawing" ||
      state.focus.kind === "dump" ||
      state.focus.kind === "haul" ||
      state.focus.kind === "measure"
    ) {
      removeSelected();
      event.preventDefault();
    }
  }
});

function syncTruckCount() {
  const n = Math.max(1, Math.min(12, Math.round(readNumber("truckCount"))));
  while (state.trucks.length < n) {
    state.trucks.push({
      phase: "haul",
      t: state.trucks.length / n,
    });
  }
  while (state.trucks.length > n) state.trucks.pop();
}

function advanceTrucks(dt, result) {
  const road = selectedHaul();
  const assigned = road ? equipmentOnHaul(road.id) : [];
  const parkAt =
    assigned.filter(isLoader)[0] || assigned[0] || loaders()[0] || primaryLoadPoint();
  const out = routePoints(road);
  const back = [...out].reverse();
  const cycleSec = result.cycleMin * 60;
  const haulShare =
    result.cycleMin > 0
      ? (result.haulMin + result.loadMin * 0.15) / result.cycleMin
      : 0.4;
  const returnShare =
    result.cycleMin > 0
      ? (result.returnMin + result.dumpMin) / result.cycleMin
      : 0.4;

  for (let i = 0; i < state.trucks.length; i++) {
    const truck = state.trucks[i];
    const loader =
      assigned.filter(isLoader)[i % Math.max(1, assigned.filter(isLoader).length)] ||
      parkAt;
    if (out.length < 2) {
      truck.phase = "load";
      truck.x = loader.x + 58;
      truck.y = loader.y + 34 + (i % 3) * 16;
      truck.angle = 0;
      continue;
    }
    if (!Number.isFinite(cycleSec) || cycleSec <= 0) continue;
    const offset = i / state.trucks.length;
    const u = (performance.now() / 1000 / cycleSec + offset) % 1;
    if (u < haulShare) {
      const t = haulShare === 0 ? 0 : u / haulShare;
      const pos = pointOnPolyline(out, t);
      truck.phase = "haul";
      truck.x = pos.x;
      truck.y = pos.y;
      const look = pointOnPolyline(out, Math.min(1, t + 0.02));
      truck.angle = Math.atan2(look.y - pos.y, look.x - pos.x);
    } else if (u < haulShare + returnShare) {
      const t = returnShare === 0 ? 0 : (u - haulShare) / returnShare;
      const pos = pointOnPolyline(back, t);
      truck.phase = "return";
      truck.x = pos.x;
      truck.y = pos.y;
      const look = pointOnPolyline(back, Math.min(1, t + 0.02));
      truck.angle = Math.atan2(look.y - pos.y, look.x - pos.x);
    } else {
      truck.phase = "load";
      truck.x = loader.x + 58;
      truck.y = loader.y + 34 + (i % 3) * 16;
      truck.angle = 0;
    }
  }
}

resetGround();
updateSurface();
renderTerrainImage(true);
syncTruckCount();
syncSelectionPanel();
updateHint();

window.siteApi = {
  SITE,
  DATUM,
  state,
  terrain,
  specFor,
  equipmentLabel,
  routePoints,
  surfaceAt,
  groundAt,
  surfaceRGB,
  earthColor,
  focusItem,
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
    state.focus.kind === "measure"
  ) {
    syncSelectionPanel();
  }
  advanceTrucks(0, result);
  drawSite();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
