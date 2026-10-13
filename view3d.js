import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

const api = window.siteApi;
const { SITE, terrain, state } = api;
const HX = SITE.w / 2;
const HZ = SITE.h / 2;
const { cols, rows } = terrain;
const COUNT = cols * rows;

const host = document.getElementById("view3d");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
host.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d4e8);
scene.fog = new THREE.Fog(0xb9d4e8, 1600, 3600);

const camera = new THREE.PerspectiveCamera(42, 1, 1, 8000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 60;
controls.maxDistance = 2600;

function resetCamera() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const fit = Math.max((SITE.w * 0.55) / Math.tan(hfov / 2), (SITE.h * 0.75) / Math.tan(vfov / 2));
  const dir = new THREE.Vector3(-0.12, 0.66, 0.74).normalize();
  controls.target.set(0, 0, 10);
  camera.position.copy(dir.multiplyScalar(fit)).add(controls.target);
  controls.update();
}
document.getElementById("resetCameraBtn").addEventListener("click", resetCamera);

scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x5a4a32, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(-380, 620, 420);
scene.add(sun);

const toY = (h) => (h - api.DATUM) * api.vscale();
const toScene = (p, h) => new THREE.Vector3(p.x - HX, toY(h), p.y - HZ);

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const lin = (v) => SRGB_TO_LINEAR[Math.max(0, Math.min(255, Math.round(v)))];

function gridIndex() {
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      idx[k++] = a;
      idx[k++] = d;
      idx[k++] = b;
      idx[k++] = b;
      idx[k++] = d;
      idx[k++] = e;
    }
  }
  return new THREE.BufferAttribute(idx, 1);
}

function gridGeometry(index, withColor) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      pos[i * 3] = (c * SITE.w) / (cols - 1) - HX;
      pos[i * 3 + 2] = (r * SITE.h) / (rows - 1) - HZ;
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  if (withColor) geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setIndex(index);
  return geo;
}

const sharedIndex = gridIndex();
const finalGeo = gridGeometry(sharedIndex, true);
const finalMesh = new THREE.Mesh(
  finalGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
);
scene.add(finalMesh);

const tinMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.9,
  metalness: 0,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
const tinWireMat = new THREE.LineBasicMaterial({ color: 0x2a2116 });
const tinMesh = new THREE.Mesh(new THREE.BufferGeometry(), tinMat);
const tinWire = new THREE.LineSegments(new THREE.BufferGeometry(), tinWireMat);
tinMesh.visible = false;
tinWire.visible = false;
scene.add(tinMesh);
scene.add(tinWire);

const existGeo = gridGeometry(sharedIndex, false);
const existMesh = new THREE.Mesh(
  existGeo,
  new THREE.MeshStandardMaterial({
    color: 0x9ccc65,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  })
);
existMesh.renderOrder = 2;
scene.add(existMesh);

const perimeter = [];
for (let c = 0; c < cols; c++) perimeter.push(c);
for (let r = 1; r < rows; r++) perimeter.push(r * cols + cols - 1);
for (let c = cols - 2; c >= 0; c--) perimeter.push((rows - 1) * cols + c);
for (let r = rows - 2; r >= 0; r--) perimeter.push(r * cols);

const skirtGeo = new THREE.BufferGeometry();
skirtGeo.setAttribute(
  "position",
  new THREE.BufferAttribute(new Float32Array((perimeter.length - 1) * 6 * 3), 3)
);
const skirt = new THREE.Mesh(
  skirtGeo,
  new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1, side: THREE.DoubleSide })
);
scene.add(skirt);

function updateSkirt() {
  const pos = skirtGeo.attributes.position.array;
  const fp = finalGeo.attributes.position.array;
  const bottom = toY(terrain.minH - 25);
  let k = 0;
  const put = (x, y, z) => {
    pos[k++] = x;
    pos[k++] = y;
    pos[k++] = z;
  };
  for (let s = 0; s < perimeter.length - 1; s++) {
    const a = perimeter[s] * 3;
    const b = perimeter[s + 1] * 3;
    put(fp[a], fp[a + 1], fp[a + 2]);
    put(fp[a], bottom, fp[a + 2]);
    put(fp[b], fp[b + 1], fp[b + 2]);
    put(fp[b], fp[b + 1], fp[b + 2]);
    put(fp[a], bottom, fp[a + 2]);
    put(fp[b], bottom, fp[b + 2]);
  }
  skirtGeo.attributes.position.needsUpdate = true;
  skirtGeo.computeVertexNormals();
  skirtGeo.computeBoundingSphere();
}

let terrainKey = "";

function syncTerrain() {
  const key = `${terrain.surfaceVersion}|${api.vscale()}`;
  if (key !== terrainKey) {
    terrainKey = key;
    const fp = finalGeo.attributes.position.array;
    const gp = existGeo.attributes.position.array;
    const col = finalGeo.attributes.color.array;
    const rgb = [0, 0, 0];
    for (let i = 0; i < COUNT; i++) {
      fp[i * 3 + 1] = toY(terrain.final[i]);
      gp[i * 3 + 1] = toY(terrain.ground[i]);
      api.surfaceRGB(i, rgb);
      col[i * 3] = lin(rgb[0]);
      col[i * 3 + 1] = lin(rgb[1]);
      col[i * 3 + 2] = lin(rgb[2]);
    }
    for (const geo of [finalGeo, existGeo]) {
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
    }
    finalGeo.attributes.color.needsUpdate = true;
    updateSkirt();
  }
  existMesh.visible = state.showExisting && terrain.cut + terrain.fill > 1;
}

let tinMeshKey = "";

function syncTin() {
  const tin = terrain.tin || { vertices: [], triangles: [] };
  const key = `${terrain.tinVersion}|${api.vscale()}|${terrain.surfaceVersion}`;
  if (key === tinMeshKey) return;
  tinMeshKey = key;
  const verts = tin.vertices;
  const tris = tin.triangles;
  const show = tris.length >= 3;
  tinMesh.visible = show;
  tinWire.visible = show;
  if (!show) return;

  const pos = new Float32Array(verts.length * 3);
  const col = new Float32Array(verts.length * 3);
  const rgb = [0, 0, 0];
  verts.forEach((v, i) => {
    const s = toScene(v, v.z);
    pos[i * 3] = s.x;
    pos[i * 3 + 1] = s.y;
    pos[i * 3 + 2] = s.z;
    api.earthColor(v.z, api.groundAt(v) - v.z, rgb);
    col[i * 3] = lin(rgb[0]);
    col[i * 3 + 1] = lin(rgb[1]);
    col[i * 3 + 2] = lin(rgb[2]);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(tris.slice());
  geo.computeVertexNormals();
  tinMesh.geometry.dispose();
  tinMesh.geometry = geo;

  const seen = new Set();
  const edgePos = [];
  for (let i = 0; i < tris.length; i += 3) {
    const ids = [tris[i], tris[i + 1], tris[i + 2]];
    for (let e = 0; e < 3; e++) {
      const a = ids[e];
      const b = ids[(e + 1) % 3];
      const k = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      edgePos.push(pos[a * 3], pos[a * 3 + 1] + 0.7, pos[a * 3 + 2]);
      edgePos.push(pos[b * 3], pos[b * 3 + 1] + 0.7, pos[b * 3 + 2]);
    }
  }
  const egeo = new THREE.BufferGeometry();
  egeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePos, 3));
  tinWire.geometry.dispose();
  tinWire.geometry = egeo;
}

function disposeGroup(group) {
  for (const child of [...group.children]) {
    child.geometry?.dispose();
    group.remove(child);
  }
}

function drapedLine(points, lift, material) {
  const pts = points.map((p) => toScene(p, api.surfaceAt(p)).add(new THREE.Vector3(0, lift, 0)));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material);
}

function densify(points, step) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let s = 0; s < n; s++) {
      out.push({ x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n });
    }
  }
  if (points.length) out.push(points[points.length - 1]);
  return out;
}

const areaGroup = new THREE.Group();
scene.add(areaGroup);
const areaMats = {
  cut: new THREE.LineBasicMaterial({ color: 0xffd166 }),
  fill: new THREE.LineBasicMaterial({ color: 0x8ecae6 }),
  zone: new THREE.LineBasicMaterial({ color: 0xfff8e7 }),
  selected: new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false }),
};
let areaKey = "";

function syncAreas() {
  const key = `${terrainKey}|${state.focus.kind}:${state.focus.id}|${state.workAreas
    .map((a) => [a.id, a.kind, a.x, a.y, a.w, a.h].join(","))
    .join(";")}`;
  if (key === areaKey) return;
  areaKey = key;
  disposeGroup(areaGroup);
  for (const area of state.workAreas) {
    const corners = [
      { x: area.x, y: area.y },
      { x: area.x + area.w, y: area.y },
      { x: area.x + area.w, y: area.y + area.h },
      { x: area.x, y: area.y + area.h },
      { x: area.x, y: area.y },
    ];
    const selected = state.focus.kind === "area" && state.focus.id === area.id;
    const line = drapedLine(densify(corners, 6), 1.2, selected ? areaMats.selected : areaMats[area.kind]);
    if (selected) line.renderOrder = 5;
    areaGroup.add(line);
  }
}

const roadGroup = new THREE.Group();
scene.add(roadGroup);
const roadMat = new THREE.MeshStandardMaterial({
  color: 0xb08968,
  roughness: 1,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
const roadSelectedMat = roadMat.clone();
roadSelectedMat.color.set(0xd9b48a);
const dashMat = new THREE.LineBasicMaterial({ color: 0xffe082 });
let roadKey = "";

function ribbon(points, width) {
  const samples = densify(points, 6);
  const pos = [];
  const idx = [];
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const p = samples[i];
    for (const side of [1, -1]) {
      const q = { x: p.x - ty * (width / 2) * side, y: p.y + tx * (width / 2) * side };
      const v = toScene(q, api.surfaceAt(q));
      pos.push(v.x, v.y + 0.8, v.z);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function syncRoads() {
  const routes = state.haulRoads.map((road) => api.routePoints(road));
  const key = `${terrainKey}|${state.focus.kind}:${state.focus.id}|${JSON.stringify(routes)}`;
  if (key === roadKey) return;
  roadKey = key;
  disposeGroup(roadGroup);
  state.haulRoads.forEach((road, i) => {
    const pts = routes[i];
    if (pts.length < 2) return;
    const selected = state.focus.kind === "haul" && state.focus.id === road.id;
    roadGroup.add(new THREE.Mesh(ribbon(pts, 22), selected ? roadSelectedMat : roadMat));
    roadGroup.add(drapedLine(densify(pts, 6), 1.4, dashMat));
  });
}

const mats = {
  dark: new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x8fd8ff, roughness: 0.2, metalness: 0.1 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf6c445, roughness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.5, metalness: 0.3 }),
  load: new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
  pile: new THREE.MeshStandardMaterial({ color: 0xc9a36a, roughness: 1 }),
  ring: new THREE.MeshBasicMaterial({ color: 0xffe082, depthTest: false, transparent: true }),
};

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function linework(lines, color, scale = 1) {
  const pts = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      pts.push(new THREE.Vector3(...line[i - 1]).multiplyScalar(scale));
      pts.push(new THREE.Vector3(...line[i]).multiplyScalar(scale));
    }
  }
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color })
  );
}

function selectionRing(radius) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 4, 40), mats.ring);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.5;
  ring.renderOrder = 6;
  ring.visible = false;
  return ring;
}

function makeTruck(color) {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  for (const x of [-12, 12]) {
    for (const z of [-9, 9]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 14), mats.dark);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 5, z);
      group.add(wheel);
    }
  }
  group.add(box(36, 4, 16, mats.dark, 0, 9, 0));
  group.add(box(24, 10, 20, body, -6, 16, 0));
  const load = box(20, 5, 16, mats.load, -6, 23, 0);
  group.add(load);
  group.add(box(10, 12, 18, mats.yellow, 14, 17, 0));
  group.add(box(1.5, 5, 14, mats.glass, 19.4, 19, 0));
  return { group, body, load };
}

function makeADT(color) {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  for (const x of [-22, -8, 16]) {
    for (const z of [-10, 10]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 5, 14), mats.dark);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 6, z);
      group.add(wheel);
    }
  }
  group.add(box(30, 4, 14, mats.dark, -15, 10, 0));
  group.add(box(32, 12, 22, body, -15, 18, 0));
  const load = box(26, 6, 18, mats.load, -15, 26, 0);
  group.add(load);
  group.add(box(6, 6, 6, mats.steel, 3, 12, 0));
  group.add(box(16, 8, 18, body, 14, 14, 0));
  group.add(box(10, 10, 14, mats.glass, 15, 23, 0));
  return { group, body, load };
}

function makeMachine(piece) {
  const spec = api.specFor(piece);
  if (spec.role === "haul") {
    const truck = piece.type === "articulated-dump" ? makeADT(spec.color) : makeTruck(spec.color);
    truck.group.add(selectionRing(28));
    return { group: truck.group, body: truck.body, load: truck.load, color: spec.color };
  }
  const group = new THREE.Group();
  const color = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.6 });
  group.add(box(44, 8, 10, mats.dark, 0, 4, -11));
  group.add(box(44, 8, 10, mats.dark, 0, 4, 11));
  group.add(box(30, 14, 26, color, -3, 15, 0));
  group.add(box(11, 11, 11, mats.glass, 4, 27, -6));
  let boom = null;
  if (spec.role === "load") {
    boom = new THREE.Group();
    boom.position.set(10, 18, 4);
    boom.add(box(32, 5, 6, mats.yellow, 16, 0, 0));
    boom.add(box(9, 10, 12, mats.steel, 33, -4, 0));
    group.add(boom);
  } else {
    group.add(box(4, 12, 34, mats.steel, 26, 8, 0));
  }
  group.add(selectionRing(30));
  return { group, boom };
}

const actorGroup = new THREE.Group();
scene.add(actorGroup);
const machines = new Map();
const dumps = new Map();
const supplies = new Map();
const utilities = new Map();
const UTILITY_PTS = 256;
function syncUtilities() {
  const seen = new Set();
  for (const utility of state.utilities) {
    let line = utilities.get(utility.id);
    if (!line) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(UTILITY_PTS * 3), 3));
      line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ depthTest: false, transparent: true, opacity: 0.9 })
      );
      line.renderOrder = 8;
      utilities.set(utility.id, line);
      scene.add(line);
    }
    seen.add(utility.id);
    line.material.color.set(api.utilitySpec(utility).color);
    const pos = line.geometry.attributes.position.array;
    let n = 0;
    const push = (p) => {
      if (n >= UTILITY_PTS) return;
      const v = toScene(p, api.utilityTopAt(utility, p));
      pos[n * 3] = v.x;
      pos[n * 3 + 1] = v.y;
      pos[n * 3 + 2] = v.z;
      n++;
    };
    const pts = utility.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    if (pts.length) push(pts[pts.length - 1]);
    line.geometry.setDrawRange(0, n);
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }
  for (const [id, line] of utilities) {
    if (!seen.has(id)) {
      scene.remove(line);
      line.geometry.dispose();
      utilities.delete(id);
    }
  }
}

function setRing(group, on) {
  const ring = group.children.find((c) => c.geometry?.type === "RingGeometry");
  if (ring) ring.visible = on;
}

function syncActors(now) {
  const seen = new Set();
  for (const piece of state.equipment) {
    const sig = piece.type;
    let entry = machines.get(piece.id);
    if (entry && entry.sig !== sig) {
      actorGroup.remove(entry.group);
      entry = null;
    }
    if (!entry) {
      entry = { ...makeMachine(piece), sig };
      entry.group.userData = { kind: "equipment", id: piece.id };
      machines.set(piece.id, entry);
      actorGroup.add(entry.group);
    }
    seen.add(piece.id);
    const live = piece.live;
    entry.group.visible = !live || live.x != null;
    const at = live && live.x != null ? live : piece;
    entry.group.position.copy(toScene(at, api.surfaceAt(at)));
    if (entry.body) {
      entry.group.rotation.y = live ? -(live.angle || 0) : 0;
      entry.body.color.set(live?.phase === "return" ? 0x1e88e5 : entry.color);
      entry.load.visible = !live || live.phase === "haul";
    }
    if (entry.boom) entry.boom.rotation.z = -0.35 + 0.35 * Math.sin(now / 420 + piece.id);
    setRing(entry.group, state.focus.kind === "equipment" && state.focus.id === piece.id);
  }
  for (const [id, entry] of machines) {
    if (!seen.has(id)) {
      actorGroup.remove(entry.group);
      machines.delete(id);
    }
  }

  const seenDumps = new Set();
  for (const dump of state.dumps) {
    let entry = dumps.get(dump.id);
    if (entry && entry.sig !== dump.kind) {
      actorGroup.remove(entry.group);
      entry = null;
    }
    if (!entry) {
      const group = new THREE.Group();
      const pile = new THREE.Group();
      if (dump.kind === "offsite") {
        pile.add(
          box(5, 30, 5, mats.dark, -24, 15, 0),
          box(5, 30, 5, mats.dark, 24, 15, 0),
          box(54, 6, 4, mats.yellow, 0, 27, 0),
          box(26, 3, 10, mats.load, 0, 1.5, 0)
        );
      } else {
        const big = new THREE.Mesh(new THREE.ConeGeometry(30, 22, 20), mats.pile);
        big.position.set(-6, 11, 0);
        const small = new THREE.Mesh(new THREE.ConeGeometry(18, 15, 16), mats.pile);
        small.position.set(16, 7.5, 6);
        pile.add(big, small);
      }
      group.add(pile, selectionRing(36));
      group.userData = { kind: "dump", id: dump.id };
      entry = { group, pile, sig: dump.kind };
      dumps.set(dump.id, entry);
      actorGroup.add(group);
    }
    seenDumps.add(dump.id);
    entry.group.position.copy(toScene(dump, api.surfaceAt(dump)));
    if (dump.kind === "stockpile") entry.pile.scale.setScalar(api.pileScale(dump));
    setRing(entry.group, state.focus.kind === "dump" && state.focus.id === dump.id);
  }
  for (const [id, entry] of dumps) {
    if (!seenDumps.has(id)) {
      actorGroup.remove(entry.group);
      dumps.delete(id);
    }
  }

  const seenSupplies = new Set();
  for (const supply of state.supplies) {
    const spec = api.supplySpec(supply);
    const sig = spec.lines ? `${supply.type}|${state.feetPerPx}` : supply.type;
    let entry = supplies.get(supply.id);
    if (entry && entry.sig !== sig) {
      actorGroup.remove(entry.group);
      entry = null;
    }
    if (!entry) {
      const group = new THREE.Group();
      if (spec.lines) {
        group.add(linework(spec.lines, spec.color, 1 / state.feetPerPx));
        const reach = api.supplyReach(supply);
        const hit = new THREE.Mesh(
          new THREE.CylinderGeometry(reach, reach, 6, 16),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.position.y = 3;
        group.add(hit, selectionRing(reach + 6));
      } else {
        const s = spec.size * 2;
        const mat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.7 });
        group.add(box(s, s * 0.6, s, mat, 0, s * 0.3, 0), selectionRing(spec.size + 6));
      }
      group.userData = { kind: "supply", id: supply.id };
      entry = { group, sig };
      supplies.set(supply.id, entry);
      actorGroup.add(group);
    }
    seenSupplies.add(supply.id);
    entry.group.position.copy(toScene(supply, api.surfaceAt(supply)));
    setRing(entry.group, state.focus.kind === "supply" && state.focus.id === supply.id);
  }
  for (const [id, entry] of supplies) {
    if (!seenSupplies.has(id)) {
      actorGroup.remove(entry.group);
      supplies.delete(id);
    }
  }

}

const BRUSH_SEGS = 64;
const brushGeo = new THREE.BufferGeometry();
brushGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BRUSH_SEGS * 3), 3));
const brush = new THREE.LineLoop(
  brushGeo,
  new THREE.LineBasicMaterial({ color: 0xffe082, depthTest: false, transparent: true })
);
brush.renderOrder = 10;
scene.add(brush);

function syncBrush() {
  const p = state.hoverPt;
  brush.visible = api.isGrading() && !!p;
  if (!brush.visible) return;
  const radius = api.gradeSettings().radius;
  const pos = brushGeo.attributes.position.array;
  for (let i = 0; i < BRUSH_SEGS; i++) {
    const t = (i / BRUSH_SEGS) * Math.PI * 2;
    const q = {
      x: Math.max(0, Math.min(SITE.w, p.x + Math.cos(t) * radius)),
      y: Math.max(0, Math.min(SITE.h, p.y + Math.sin(t) * radius)),
    };
    const v = toScene(q, api.surfaceAt(q));
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y + 1.5;
    pos[i * 3 + 2] = v.z;
  }
  brushGeo.attributes.position.needsUpdate = true;
  brushGeo.computeBoundingSphere();
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function aim(event) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
}

function pickGround(event) {
  aim(event);
  const targets = tinMesh.visible ? [tinMesh, finalMesh] : [finalMesh];
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (!hit) return null;
  return {
    x: Math.max(8, Math.min(SITE.w - 8, hit.point.x + HX)),
    y: Math.max(8, Math.min(SITE.h - 8, hit.point.z + HZ)),
  };
}

function pickActor(event) {
  aim(event);
  const hit = raycaster.intersectObjects(
    [...machines.values()]
      .map((m) => m.group)
      .concat([...dumps.values()].map((d) => d.group), [...supplies.values()].map((s) => s.group)),
    true
  )[0];
  let node = hit?.object;
  while (node && !node.userData?.kind) node = node.parent;
  return node?.userData || null;
}

let gradingHere = false;
let downAt = null;

canvas.addEventListener(
  "pointerdown",
  (event) => {
    downAt = { x: event.clientX, y: event.clientY };
    if (event.button !== 0 || !api.isGrading()) return;
    const p = pickGround(event);
    if (!p) return;
    api.beginGrade(p);
    gradingHere = true;
    canvas.setPointerCapture(event.pointerId);
    event.stopImmediatePropagation();
    event.preventDefault();
  },
  { capture: true }
);

canvas.addEventListener(
  "pointermove",
  (event) => {
    if (gradingHere) {
      const p = pickGround(event);
      if (p) api.moveGrade(p);
      event.stopImmediatePropagation();
      return;
    }
    if (event.buttons === 0) api.setHover(pickGround(event));
  },
  { capture: true }
);

canvas.addEventListener("pointerup", (event) => {
  if (gradingHere) {
    gradingHere = false;
    api.endGrade();
    return;
  }
  if (
    event.button === 0 &&
    downAt &&
    Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) < 4
  ) {
    const hit = pickActor(event);
    if (hit) api.focusItem(hit.kind, hit.id);
  }
  downAt = null;
});

canvas.addEventListener("pointerleave", () => {
  if (!gradingHere) api.setHover(null);
});

function resize() {
  const w = host.clientWidth;
  const h = host.clientHeight;
  if (!w || !h) return;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x === w && size.y === h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!cameraPlaced) {
    resetCamera();
    cameraPlaced = true;
  }
}

let cameraPlaced = false;

function tick(now) {
  requestAnimationFrame(tick);
  if (host.offsetParent === null) return;
  resize();
  syncTerrain();
  syncTin();
  syncAreas();
  syncRoads();
  syncActors(now);
  syncUtilities();
  syncBrush();
  controls.update();
  renderer.render(scene, camera);
}

requestAnimationFrame(tick);
