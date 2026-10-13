import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

const api = window.siteApi;
const $ = (id) => document.getElementById(id);
const modal = $("itemEditor");
const viewport = $("itemViewport");
const GRID_FT = 40;
const VERTEX_SNAP_FT = 0.35;
const CLICK_SLOP_PX = 5;

const PLANES = {
  plan: { normal: new THREE.Vector3(0, 1, 0), axis: 1, label: "Height" },
  front: { normal: new THREE.Vector3(0, 0, 1), axis: 2, label: "Depth (Z)" },
  side: { normal: new THREE.Vector3(1, 0, 0), axis: 0, label: "Offset (X)" },
};

const ed = {
  lines: [],
  current: [],
  history: [],
  plane: "plan",
  hover: null,
  down: null,
};

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

  committedMesh = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
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
  scene.add(committedMesh, currentMesh, rubberMesh, vertexMesh, hoverMarker);

  new ResizeObserver(resize).observe(viewport);
  const el = renderer.domElement;
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointerleave", () => {
    ed.hover = null;
    refresh();
  });
  el.addEventListener("dblclick", (event) => {
    event.preventDefault();
    finishLine();
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
  return ed.lines.flat().concat(ed.current);
}

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
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
  return pt.map((c) => Math.round(c * 1000) / 1000);
}

function same(a, b) {
  return a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function snapshot() {
  ed.history.push(JSON.stringify(ed.lines));
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
  if (ed.current.length) {
    ed.current.pop();
  } else if (ed.history.length) {
    ed.lines = JSON.parse(ed.history.pop());
  }
  refresh();
}

function extrude() {
  if (ed.current.length >= 2) finishLine();
  const base = ed.lines[ed.lines.length - 1];
  const h = Number($("itemExtrude").value) || 0;
  if (!base || h <= 0) return;
  snapshot();
  const up = (p) => [p[0], Math.round((p[1] + h) * 1000) / 1000, p[2]];
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
  if (!ed.lines.length && !ed.current.length) return;
  snapshot();
  ed.lines = [];
  ed.current = [];
  refresh();
}

function setPoints(mesh, pts) {
  const old = mesh.geometry;
  mesh.geometry = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)));
  old.dispose();
}

function refresh() {
  if (!renderer) return;
  const color = $("itemColor").value;
  committedMesh.material.color.set(color);
  const segs = [];
  for (const line of ed.lines) {
    for (let i = 1; i < line.length; i++) segs.push(line[i - 1], line[i]);
  }
  setPoints(committedMesh, segs);
  setPoints(currentMesh, ed.current);
  const last = ed.current[ed.current.length - 1];
  setPoints(rubberMesh, last && ed.hover ? [last, ed.hover] : []);
  rubberMesh.computeLineDistances();
  setPoints(vertexMesh, allVertices());
  hoverMarker.visible = !!ed.hover;
  if (ed.hover) hoverMarker.position.set(...ed.hover);

  const pts = allVertices();
  if (pts.length) {
    const span = (k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]));
    $("itemStats").textContent =
      `${ed.lines.length} line${ed.lines.length === 1 ? "" : "s"} · ` +
      `${span(0).toFixed(1)} W × ${span(2).toFixed(1)} D × ${span(1).toFixed(1)} H ft` +
      (ed.current.length ? ` · drawing (${ed.current.length} pts)` : "");
  } else {
    $("itemStats").textContent = "No linework yet.";
  }
  const at = ed.hover ? ` · cursor ${ed.hover.map((c) => c.toFixed(1)).join(", ")} ft` : "";
  $("itemHint").textContent =
    "Click to place points on the yellow plane. Double-click or Enter finishes a line; click the first point to close it. " +
    "Drag to orbit, right-drag to pan, scroll to zoom." +
    at;
  $("itemSaveBtn").disabled = !ed.lines.length && ed.current.length < 2;
}

function onPointerDown(event) {
  ed.down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
}

function onPointerMove(event) {
  ed.hover = pick(event);
  refresh();
}

function onPointerUp(event) {
  const down = ed.down;
  ed.down = null;
  if (!down || event.button !== 0) return;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP_PX) return;
  const pt = pick(event);
  if (pt) addPoint(pt);
}

function loop() {
  controls.update();
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(loop);
}

function open() {
  if (!renderer) setup();
  ed.lines = [];
  ed.current = [];
  ed.history = [];
  ed.plane = "plan";
  ed.hover = null;
  $("itemName").value = "";
  $("itemCode").value = "";
  $("itemOffset").value = "0";
  modal.hidden = false;
  resize();
  resetCamera();
  syncPlane();
  refresh();
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
  const label = $("itemName").value.trim();
  if (!label) {
    $("itemName").focus();
    $("itemStats").textContent = "Give the item a name before saving.";
    return;
  }
  if (!ed.lines.length) return;
  api.addCustomSupply({
    label,
    short: $("itemCode").value.trim().toUpperCase(),
    color: $("itemColor").value,
    lines: ed.lines,
  });
  close();
  $("addSupplyBtn").click();
}

$("newSupplyBtn").addEventListener("click", open);
$("itemCancelBtn").addEventListener("click", close);
$("itemFinishBtn").addEventListener("click", finishLine);
$("itemUndoBtn").addEventListener("click", undo);
$("itemExtrudeBtn").addEventListener("click", extrude);
$("itemClearBtn").addEventListener("click", clearAll);
$("itemSaveBtn").addEventListener("click", save);
$("itemColor").addEventListener("input", refresh);
$("itemOffset").addEventListener("input", syncPlane);
$("itemPlaneSeg").addEventListener("click", (event) => {
  const plane = event.target.closest("button")?.dataset.plane;
  if (!plane) return;
  ed.plane = plane;
  syncPlane();
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
    if (event.key === "Escape") {
      if (ed.current.length) {
        ed.current = [];
        refresh();
      } else {
        close();
      }
      event.preventDefault();
    } else if (typing) {
      return;
    } else if (event.key === "Enter") {
      finishLine();
      event.preventDefault();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      undo();
      event.preventDefault();
    } else if (event.key === "Backspace" || event.key === "Delete") {
      undo();
      event.preventDefault();
    }
  },
  true
);
