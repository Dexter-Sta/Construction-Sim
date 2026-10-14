import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

const api = window.siteApi;
const $ = (id) => document.getElementById(id);
const modal = $("itemEditor");
const viewport = $("itemViewport");
const GRID_FT = 40;
const VERTEX_SNAP_FT = 0.35;
const CLICK_SLOP_PX = 5;
const PIECE_PICK_PX = 10;
const PIECE_SNAP_PX = 14;
const SELECTED_COLOR = new THREE.Color(0xffe082);
const MOVING_COLOR = new THREE.Color(0x8fd8ff);

const PLANES = {
  plan: { normal: new THREE.Vector3(0, 1, 0), axis: 1, label: "Height" },
  front: { normal: new THREE.Vector3(0, 0, 1), axis: 2, label: "Depth (Z)" },
  side: { normal: new THREE.Vector3(1, 0, 0), axis: 0, label: "Offset (X)" },
};

const MODES = {
  supply: { title: "New supply item", placeholder: "e.g. Pipe rack", save: "Save item" },
  structure: { title: "New structure", placeholder: "e.g. Retaining wall", save: "Save structure" },
};

const ed = {
  mode: "supply",
  lines: [],
  current: [],
  pieces: [],
  selected: -1,
  tool: "draw",
  move: null,
  history: [],
  plane: "plan",
  hover: null,
  down: null,
};

let clipboard = null;
let renderer = null;
let scene;
let camera;
let controls;
let planeGroup;
let committedMesh;
let currentMesh;
let rubberMesh;
let vertexMesh;
let hoverMarker;
let snapMarker;
let frameId = 0;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  viewport.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d15);
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  const ground = new THREE.GridHelper(GRID_FT, GRID_FT, 0x5c6650, 0x343a2c);
  scene.add(ground, new THREE.AxesHelper(3));

  planeGroup = new THREE.Group();
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID_FT, GRID_FT),
    new THREE.MeshBasicMaterial({
      color: 0xf6c445,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  sheet.rotation.x = -Math.PI / 2;
  const sheetGrid = new THREE.GridHelper(GRID_FT, GRID_FT * 2, 0xf6c445, 0xf6c445);
  sheetGrid.material.transparent = true;
  sheetGrid.material.opacity = 0.18;
  sheetGrid.material.depthWrite = false;
  planeGroup.add(sheet, sheetGrid);
  scene.add(planeGroup);

  committedMesh = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ vertexColors: true })
  );
  currentMesh = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff }));
  rubberMesh = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({ color: 0xffe082, dashSize: 0.3, gapSize: 0.2 })
  );
  vertexMesh = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xffffff, size: 6, sizeAttenuation: false })
  );
  hoverMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe082 })
  );
  snapMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x7cff8a })
  );
  scene.add(committedMesh, currentMesh, rubberMesh, vertexMesh, hoverMarker, snapMarker);

  new ResizeObserver(resize).observe(viewport);
  const el = renderer.domElement;
  viewport.addEventListener("pointerdown", onPointerDownCapture, true);
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointerleave", () => {
    ed.hover = null;
    refresh();
  });
  el.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (ed.tool === "draw" && !ed.move) finishLine();
  });
}

function resize() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function resetCamera() {
  camera.position.set(16, 13, 20);
  controls.target.set(0, 1.5, 0);
  controls.update();
}

function offset() {
  return Number($("itemOffset").value) || 0;
}

function snapStep() {
  return Math.max(0, Number($("itemSnap").value) || 0);
}

function round3(c) {
  return Math.round(c * 1000) / 1000;
}

function syncPlane() {
  const spec = PLANES[ed.plane];
  const d = offset();
  planeGroup.rotation.set(0, 0, 0);
  planeGroup.position.set(0, 0, 0);
  if (ed.plane === "plan") planeGroup.position.y = d;
  if (ed.plane === "front") {
    planeGroup.rotation.x = Math.PI / 2;
    planeGroup.position.set(0, GRID_FT / 2, d);
  }
  if (ed.plane === "side") {
    planeGroup.rotation.z = Math.PI / 2;
    planeGroup.position.set(d, GRID_FT / 2, 0);
  }
  $("itemOffsetLabel").textContent = spec.label;
  for (const btn of $("itemPlaneSeg").querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.plane === ed.plane));
  }
}

function allVertices() {
  return ed.lines.flat().concat(ed.current, ed.pieces.flat(2));
}

function setRay(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
}

function pick(event) {
  setRay(event);
  const spec = PLANES[ed.plane];
  const plane = new THREE.Plane(spec.normal, -offset());
  const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  if (!hit) return null;
  let best = null;
  let bestD = VERTEX_SNAP_FT;
  for (const v of allVertices()) {
    const p = new THREE.Vector3(...v);
    const d = raycaster.ray.distanceToPoint(p) / Math.max(1, camera.position.distanceTo(p) / 20);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (best) return [...best];
  const step = snapStep();
  const pt = [hit.x, hit.y, hit.z].map((c) => (step > 0 ? Math.round(c / step) * step : c));
  pt[spec.axis] = offset();
  return pt.map(round3);
}

function toScreen(p) {
  const v = new THREE.Vector3(...p).project(camera);
  if (v.z > 1) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  return [((v.x + 1) / 2) * rect.width, ((1 - v.y) / 2) * rect.height];
}

function screenPoint(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
}

function segDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function pieceAt(event) {
  const cursor = screenPoint(event);
  let best = -1;
  let bestD = PIECE_PICK_PX;
  ed.pieces.forEach((piece, index) => {
    for (const line of piece) {
      for (let i = 1; i < line.length; i++) {
        const a = toScreen(line[i - 1]);
        const b = toScreen(line[i]);
        if (!a || !b) continue;
        const d = segDistance(cursor, a, b);
        if (d < bestD) {
          bestD = d;
          best = index;
        }
      }
    }
  });
  return best;
}

function bounds(lines) {
  const pts = lines.flat();
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  return { lo, hi, center: [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2] };
}

function translate(lines, d) {
  return lines.map((line) => line.map((p) => p.map((c, k) => round3(c + d[k]))));
}

function rotateY(lines, about) {
  return lines.map((line) =>
    line.map(([x, y, z]) => [round3(about[0] - (z - about[2])), y, round3(about[2] + (x - about[0]))])
  );
}

function same(a, b) {
  return a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function snapshot() {
  ed.history.push(JSON.stringify({ lines: ed.lines, pieces: ed.pieces }));
  if (ed.history.length > 100) ed.history.shift();
}

function addPoint(pt) {
  const first = ed.current[0];
  const last = ed.current[ed.current.length - 1];
  if (same(pt, last)) return;
  if (ed.current.length >= 3 && same(pt, first)) {
    ed.current.push(pt);
    finishLine();
    return;
  }
  ed.current.push(pt);
  refresh();
}

function finishLine() {
  if (ed.current.length >= 2) {
    snapshot();
    ed.lines.push(ed.current);
  }
  ed.current = [];
  refresh();
}

function undo() {
  if (ed.move) {
    cancelMove();
  } else if (ed.current.length) {
    ed.current.pop();
  } else if (ed.history.length) {
    const prev = JSON.parse(ed.history.pop());
    ed.lines = prev.lines;
    ed.pieces = prev.pieces;
    if (ed.selected >= ed.pieces.length) ed.selected = -1;
  }
  refresh();
}

function extrude() {
  if (ed.current.length >= 2) finishLine();
  const base = ed.lines[ed.lines.length - 1];
  const h = Number($("itemExtrude").value) || 0;
  if (!base || h <= 0) return;
  snapshot();
  const up = (p) => [p[0], round3(p[1] + h), p[2]];
  ed.lines.push(base.map(up));
  const seen = new Set();
  for (const p of base) {
    const key = p.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    ed.lines.push([p, up(p)]);
  }
  refresh();
}

function clearAll() {
  if (!ed.lines.length && !ed.current.length && !ed.pieces.length) return;
  snapshot();
  ed.lines = [];
  ed.current = [];
  ed.pieces = [];
  ed.selected = -1;
  ed.move = null;
  refresh();
}

function makePiece() {
  if (ed.current.length >= 2) finishLine();
  if (!ed.lines.length) return;
  snapshot();
  ed.pieces.push(ed.lines);
  ed.lines = [];
  ed.current = [];
  ed.selected = ed.pieces.length - 1;
  refresh();
}

function setTool(tool) {
  ed.tool = tool;
  ed.current = [];
  ed.hover = null;
  for (const btn of $("itemToolSeg").querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.tool === tool));
  }
  refresh();
}

function copyPiece() {
  if (ed.selected < 0) return;
  clipboard = JSON.parse(JSON.stringify(ed.pieces[ed.selected]));
  refresh();
}

function pastePiece() {
  if (!clipboard || ed.mode !== "structure") return;
  if (ed.move) cancelMove();
  const lines = JSON.parse(JSON.stringify(clipboard));
  ed.move = { lines, index: -1, grab: bounds(lines).center, delta: [0, 0, 0], snap: null, drag: false };
  ed.selected = -1;
  if (ed.tool !== "select") setTool("select");
  refresh();
}

function rotatePiece() {
  if (ed.move) {
    ed.move.lines = rotateY(ed.move.lines, ed.move.grab);
    if (ed.move.last) updateMove(ed.move.last);
    refresh();
    return;
  }
  if (ed.selected < 0) return;
  snapshot();
  const piece = ed.pieces[ed.selected];
  ed.pieces[ed.selected] = rotateY(piece, bounds(piece).center);
  refresh();
}

function deletePiece() {
  if (ed.selected < 0) return;
  snapshot();
  ed.pieces.splice(ed.selected, 1);
  ed.selected = -1;
  refresh();
}

function beginDrag(index, event) {
  const lines = ed.pieces[index];
  const baseY = bounds(lines).lo[1];
  setRay(event);
  const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -baseY), new THREE.Vector3());
  if (!hit) return false;
  ed.move = { lines, index, grab: [hit.x, baseY, hit.z], delta: [0, 0, 0], snap: null, drag: true };
  return true;
}

function snapTargets() {
  const pts = ed.lines.flat();
  ed.pieces.forEach((piece, index) => {
    if (index !== ed.move.index) pts.push(...piece.flat());
  });
  const seen = new Set();
  const targets = [];
  for (const p of pts) {
    const key = p.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const s = toScreen(p);
    if (s) targets.push({ p, s });
  }
  return targets;
}

function updateMove(event) {
  const move = ed.move;
  move.last = { clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey };
  setRay(event);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -move.grab[1]);
  const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  if (!hit) return;
  const step = snapStep();
  const grid = (c) => (step > 0 ? Math.round(c / step) * step : c);
  move.delta = [grid(hit.x - move.grab[0]), 0, grid(hit.z - move.grab[2])];
  move.snap = null;
  if (!$("itemSnapPieces").checked || event.shiftKey) return;

  const targets = snapTargets();
  if (!targets.length) return;
  const seen = new Set();
  let bestD = PIECE_SNAP_PX;
  for (const v of move.lines.flat()) {
    const key = v.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const s = toScreen(v.map((c, k) => c + move.delta[k]));
    if (!s) continue;
    for (const t of targets) {
      const d = Math.hypot(s[0] - t.s[0], s[1] - t.s[1]);
      if (d < bestD) {
        bestD = d;
        move.snap = { from: v, to: t.p };
      }
    }
  }
  if (move.snap) move.delta = move.snap.to.map((c, k) => c - move.snap.from[k]);
}

function commitMove() {
  const move = ed.move;
  ed.move = null;
  if (!move) return;
  const moved = move.delta.some((c) => Math.abs(c) > 1e-6);
  if (move.index >= 0 && !moved) {
    ed.selected = move.index;
    refresh();
    return;
  }
  snapshot();
  const lines = translate(move.lines, move.delta);
  if (move.index >= 0) {
    ed.pieces[move.index] = lines;
    ed.selected = move.index;
  } else {
    ed.pieces.push(lines);
    ed.selected = ed.pieces.length - 1;
  }
  refresh();
}

function cancelMove() {
  if (!ed.move) return;
  if (ed.move.index >= 0) ed.selected = ed.move.index;
  ed.move = null;
  controls.enabled = true;
  refresh();
}

function setPoints(mesh, pts) {
  const old = mesh.geometry;
  mesh.geometry = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)));
  old.dispose();
}

function setSegments(mesh, groups) {
  const positions = [];
  const colors = [];
  for (const { lines, color } of groups) {
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        positions.push(...line[i - 1], ...line[i]);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  mesh.geometry.dispose();
  mesh.geometry = geom;
}

function refresh() {
  if (!renderer) return;
  const color = new THREE.Color($("itemColor").value);
  const move = ed.move;
  const groups = [{ lines: ed.lines, color }];
  ed.pieces.forEach((piece, index) => {
    if (move && move.index === index) return;
    groups.push({ lines: piece, color: index === ed.selected ? SELECTED_COLOR : color });
  });
  const ghost = move ? translate(move.lines, move.delta) : [];
  groups.push({ lines: ghost, color: MOVING_COLOR });
  setSegments(committedMesh, groups);
  setPoints(currentMesh, ed.current);
  const last = ed.current[ed.current.length - 1];
  setPoints(rubberMesh, last && ed.hover ? [last, ed.hover] : []);
  rubberMesh.computeLineDistances();
  const fixed = ed.lines.flat().concat(
    ed.current,
    ed.pieces.filter((_, index) => !move || move.index !== index).flat(2)
  );
  setPoints(vertexMesh, fixed.concat(ghost.flat()));
  hoverMarker.visible = !!ed.hover && !move;
  if (ed.hover) hoverMarker.position.set(...ed.hover);
  snapMarker.visible = !!move?.snap;
  if (move?.snap) snapMarker.position.set(...move.snap.to);

  const structure = ed.mode === "structure";
  const pts = allVertices();
  if (pts.length) {
    const span = (k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]));
    const lineCount = ed.lines.length + ed.pieces.reduce((n, piece) => n + piece.length, 0);
    $("itemStats").textContent =
      (structure ? `${ed.pieces.length} piece${ed.pieces.length === 1 ? "" : "s"} · ` : "") +
      `${lineCount} line${lineCount === 1 ? "" : "s"} · ` +
      `${span(0).toFixed(1)} W × ${span(2).toFixed(1)} D × ${span(1).toFixed(1)} H ft` +
      (ed.current.length ? ` · drawing (${ed.current.length} pts)` : "");
  } else {
    $("itemStats").textContent = "No linework yet.";
  }

  let hint;
  if (move) {
    hint =
      "Move the cursor to position the piece; it snaps when a corner lands on another piece's corner (green dot). " +
      (move.drag ? "Release to drop." : "Click to place.") +
      " R rotates 90°, Shift ignores snapping, Esc cancels.";
  } else if (structure && ed.tool === "select") {
    hint =
      "Click a piece to select it, drag it to move it. Ctrl+C / Ctrl+V copies and pastes, Ctrl+D duplicates, " +
      "R rotates, Delete removes. Drag empty space to orbit.";
  } else {
    const at = ed.hover ? ` · cursor ${ed.hover.map((c) => c.toFixed(1)).join(", ")} ft` : "";
    hint =
      "Click to place points on the yellow plane. Double-click or Enter finishes a line; click the first point to close it. " +
      (structure ? "Then make it a piece to copy and snap it. " : "") +
      "Drag to orbit, right-drag to pan, scroll to zoom." +
      at;
  }
  $("itemHint").textContent = hint;

  const hasLinework = ed.lines.length || ed.current.length >= 2;
  $("itemSaveBtn").disabled = !hasLinework && !ed.pieces.length;
  $("itemMakePieceBtn").disabled = !hasLinework;
  $("itemCopyBtn").disabled = ed.selected < 0;
  $("itemPasteBtn").disabled = !clipboard;
  $("itemRotateBtn").disabled = ed.selected < 0 && !move;
  $("itemDeletePieceBtn").disabled = ed.selected < 0;
}

function onPointerDownCapture(event) {
  if (event.button !== 0 || event.target !== renderer.domElement) return;
  if (ed.mode !== "structure" || ed.tool !== "select" || ed.move) return;
  const index = pieceAt(event);
  if (index < 0) return;
  ed.selected = index;
  if (beginDrag(index, event)) {
    controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
  }
  refresh();
}

function onPointerDown(event) {
  ed.down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
}

function onPointerMove(event) {
  if (ed.move) {
    updateMove(event);
  } else {
    ed.hover = ed.tool === "draw" ? pick(event) : null;
  }
  refresh();
}

function onPointerUp(event) {
  const down = ed.down;
  ed.down = null;
  if (ed.move?.drag) {
    controls.enabled = true;
    commitMove();
    return;
  }
  if (!down || event.button !== 0) return;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP_PX) return;
  if (ed.move) {
    updateMove(event);
    commitMove();
  } else if (ed.tool === "select") {
    ed.selected = -1;
    refresh();
  } else {
    const pt = pick(event);
    if (pt) addPoint(pt);
  }
}

function loop() {
  controls.update();
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(loop);
}

function open(mode) {
  if (!renderer) setup();
  ed.mode = mode;
  ed.lines = [];
  ed.current = [];
  ed.pieces = [];
  ed.selected = -1;
  ed.move = null;
  ed.history = [];
  ed.plane = "plan";
  ed.hover = null;
  controls.enabled = true;
  const copy = MODES[mode];
  $("itemEditorTitle").textContent = copy.title;
  $("itemName").placeholder = copy.placeholder;
  $("itemSaveBtn").textContent = copy.save;
  $("itemPieceFields").hidden = mode !== "structure";
  $("itemName").value = "";
  $("itemCode").value = "";
  $("itemOffset").value = "0";
  modal.hidden = false;
  resize();
  resetCamera();
  syncPlane();
  setTool("draw");
  cancelAnimationFrame(frameId);
  loop();
  $("itemName").focus();
}

function close() {
  modal.hidden = true;
  cancelAnimationFrame(frameId);
}

function save() {
  if (ed.current.length >= 2) finishLine();
  if (ed.move) cancelMove();
  const label = $("itemName").value.trim();
  if (!label) {
    $("itemName").focus();
    $("itemStats").textContent = "Give the item a name before saving.";
    return;
  }
  const lines = ed.pieces.flat().concat(ed.lines);
  if (!lines.length) return;
  const item = {
    label,
    short: $("itemCode").value.trim().toUpperCase(),
    color: $("itemColor").value,
    lines,
  };
  close();
  const key = ed.mode === "structure" ? api.addCustomStructure(item) : api.addCustomSupply(item);
  api.beginPlacing("supply", key);
}

window.itemEditor = { open };
$("itemCancelBtn").addEventListener("click", close);
$("itemFinishBtn").addEventListener("click", finishLine);
$("itemUndoBtn").addEventListener("click", undo);
$("itemExtrudeBtn").addEventListener("click", extrude);
$("itemClearBtn").addEventListener("click", clearAll);
$("itemSaveBtn").addEventListener("click", save);
$("itemMakePieceBtn").addEventListener("click", makePiece);
$("itemCopyBtn").addEventListener("click", copyPiece);
$("itemPasteBtn").addEventListener("click", pastePiece);
$("itemRotateBtn").addEventListener("click", rotatePiece);
$("itemDeletePieceBtn").addEventListener("click", deletePiece);
$("itemColor").addEventListener("input", refresh);
$("itemOffset").addEventListener("input", syncPlane);
$("itemPlaneSeg").addEventListener("click", (event) => {
  const plane = event.target.closest("button")?.dataset.plane;
  if (!plane) return;
  ed.plane = plane;
  syncPlane();
});
$("itemToolSeg").addEventListener("click", (event) => {
  const tool = event.target.closest("button")?.dataset.tool;
  if (!tool) return;
  if (ed.move) cancelMove();
  setTool(tool);
});
modal.addEventListener("pointerdown", (event) => {
  if (event.target === modal) close();
});

window.addEventListener(
  "keydown",
  (event) => {
    if (modal.hidden) return;
    event.stopImmediatePropagation();
    const typing = event.target instanceof HTMLInputElement;
    const key = event.key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;
    const structure = ed.mode === "structure";
    if (event.key === "Escape") {
      if (ed.move) {
        cancelMove();
      } else if (ed.current.length) {
        ed.current = [];
        refresh();
      } else if (ed.selected >= 0) {
        ed.selected = -1;
        refresh();
      } else {
        close();
      }
      event.preventDefault();
    } else if (typing) {
      return;
    } else if (event.key === "Enter") {
      if (ed.move) commitMove();
      else finishLine();
      event.preventDefault();
    } else if (mod && key === "z") {
      undo();
      event.preventDefault();
    } else if (structure && mod && key === "c") {
      copyPiece();
      event.preventDefault();
    } else if (structure && mod && key === "v") {
      pastePiece();
      event.preventDefault();
    } else if (structure && mod && key === "d") {
      copyPiece();
      pastePiece();
      event.preventDefault();
    } else if (structure && !mod && key === "r") {
      rotatePiece();
      event.preventDefault();
    } else if (event.key === "Backspace" || event.key === "Delete") {
      if (structure && ed.selected >= 0 && !ed.current.length && !ed.move) deletePiece();
      else undo();
      event.preventDefault();
    }
  },
  true
);
