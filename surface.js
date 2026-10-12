// A surface is a TIN: elevated linework is triangulated, and each line is a
// breakline, so it survives as an edge with a straight grade between its points.

const SURFACE_WELD = 0.5;

function surfaceOrient(a, b, c) {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(v) < 1e-8) return 0;
  return v > 0 ? 1 : -1;
}

function surfaceInCircle(a, b, c, d) {
  const adx = a.x - d.x;
  const ady = a.y - d.y;
  const bdx = b.x - d.x;
  const bdy = b.y - d.y;
  const cdx = c.x - d.x;
  const cdy = c.y - d.y;
  const ab = adx * bdy - bdx * ady;
  const bc = bdx * cdy - cdx * bdy;
  const ca = cdx * ady - adx * cdy;
  const det = (adx * adx + ady * ady) * bc + (bdx * bdx + bdy * bdy) * ca + (cdx * cdx + cdy * cdy) * ab;
  return det > 1e-6;
}

function surfaceCross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

function segmentHit(a, b, c, d) {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = surfaceCross(rx, ry, sx, sy);
  if (Math.abs(den) < 1e-12) return null;
  const qx = c.x - a.x;
  const qy = c.y - a.y;
  const t = surfaceCross(qx, qy, sx, sy) / den;
  const u = surfaceCross(qx, qy, rx, ry) / den;
  if (t <= 1e-4 || t >= 1 - 1e-4 || u <= 1e-4 || u >= 1 - 1e-4) return null;
  return { t, u, x: a.x + t * rx, y: a.y + t * ry };
}

function pointOnOpenSegment(a, b, p) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len = Math.hypot(abx, aby);
  if (len < 1e-8) return false;
  const dist = Math.abs(surfaceCross(abx, aby, p.x - a.x, p.y - a.y)) / len;
  if (dist > 1e-4) return false;
  const dot = (p.x - a.x) * abx + (p.y - a.y) * aby;
  return dot > len * 1e-4 && dot < len * len - len * 1e-4;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function hasEdge(tris, a, b) {
  for (const t of tris) {
    const v = t.v;
    if (
      (v[0] === a && v[1] === b) ||
      (v[1] === a && v[2] === b) ||
      (v[2] === a && v[0] === b) ||
      (v[0] === b && v[1] === a) ||
      (v[1] === b && v[2] === a) ||
      (v[2] === b && v[0] === a)
    ) {
      return true;
    }
  }
  return false;
}

function crossesEdge(pts, a, b, c, d) {
  if (a === c || a === d || b === c || b === d) return false;
  return (
    surfaceOrient(pts[a], pts[b], pts[c]) * surfaceOrient(pts[a], pts[b], pts[d]) < 0 &&
    surfaceOrient(pts[c], pts[d], pts[a]) * surfaceOrient(pts[c], pts[d], pts[b]) < 0
  );
}

function delaunay(pts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const s = span * 20;
  const n = pts.length;
  const all = pts.concat([
    { x: midX - 2 * s, y: midY - s, z: 0 },
    { x: midX + 2 * s, y: midY - s, z: 0 },
    { x: midX, y: midY + 2 * s, z: 0 },
  ]);
  const tris = [{ v: [n, n + 1, n + 2] }];

  for (let pi = 0; pi < n; pi++) {
    const p = all[pi];
    const bad = [];
    for (const t of tris) {
      const [a, b, c] = t.v;
      if (surfaceInCircle(all[a], all[b], all[c], p)) bad.push(t);
    }
    const count = new Map();
    const bump = (a, b) => {
      const k = edgeKey(a, b);
      count.set(k, (count.get(k) || 0) + 1);
    };
    for (const t of bad) {
      bump(t.v[0], t.v[1]);
      bump(t.v[1], t.v[2]);
      bump(t.v[2], t.v[0]);
    }
    for (let i = tris.length - 1; i >= 0; i--) {
      if (bad.includes(tris[i])) tris.splice(i, 1);
    }
    for (const t of bad) {
      const edges = [
        [t.v[0], t.v[1]],
        [t.v[1], t.v[2]],
        [t.v[2], t.v[0]],
      ];
      for (const [a, b] of edges) {
        if (count.get(edgeKey(a, b)) !== 1) continue;
        const o = surfaceOrient(all[a], all[b], p);
        if (o === 0) continue;
        tris.push({ v: o > 0 ? [a, b, pi] : [b, a, pi] });
      }
    }
  }

  return tris.filter((t) => t.v[0] < n && t.v[1] < n && t.v[2] < n);
}

function strictlyInside(p, a, b, c) {
  const o1 = surfaceOrient(a, b, p);
  const o2 = surfaceOrient(b, c, p);
  const o3 = surfaceOrient(c, a, p);
  if (o1 === 0 || o2 === 0 || o3 === 0) return false;
  return (o1 > 0 && o2 > 0 && o3 > 0) || (o1 < 0 && o2 < 0 && o3 < 0);
}

function earClip(idx, pts) {
  const ring = idx.slice();
  const made = [];
  if (ring.length < 3) return made;
  let wind = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = pts[ring[i]];
    const q = pts[ring[(i + 1) % ring.length]];
    wind += p.x * q.y - q.x * p.y;
  }
  let guard = 0;
  while (ring.length > 3 && guard++ < ring.length * ring.length + 8) {
    let clipped = false;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length];
      const b = ring[i];
      const c = ring[(i + 1) % ring.length];
      const o = surfaceOrient(pts[a], pts[b], pts[c]);
      if (wind > 0 ? o <= 0 : o >= 0) continue;
      let blocked = false;
      for (const id of ring) {
        if (id === a || id === b || id === c) continue;
        if (strictlyInside(pts[id], pts[a], pts[b], pts[c])) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      made.push(o > 0 ? [a, b, c] : [a, c, b]);
      ring.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) return made;
  }
  if (ring.length === 3) {
    const o = surfaceOrient(pts[ring[0]], pts[ring[1]], pts[ring[2]]);
    if (o !== 0) made.push(o > 0 ? ring.slice() : [ring[0], ring[2], ring[1]]);
  }
  return made;
}

// Force segment ia-ib to be an edge by cutting the triangles it crosses
// and retriangulating the polygon on each side.
function insertBreakline(tris, pts, ia, ib) {
  if (ia === ib || hasEdge(tris, ia, ib)) return;
  const cavity = [];
  for (let i = 0; i < tris.length; i++) {
    const v = tris[i].v;
    for (let e = 0; e < 3; e++) {
      if (crossesEdge(pts, ia, ib, v[e], v[(e + 1) % 3])) {
        cavity.push(i);
        break;
      }
    }
  }
  if (!cavity.length) return;

  const nexts = new Map();
  const dead = new Set(cavity);
  for (const ti of cavity) {
    const v = tris[ti].v;
    for (let e = 0; e < 3; e++) {
      const c = v[e];
      const d = v[(e + 1) % 3];
      if (crossesEdge(pts, ia, ib, c, d)) continue;
      let interior = false;
      for (const other of cavity) {
        if (other === ti) continue;
        const ov = tris[other].v;
        if (
          (ov[0] === c && ov[1] === d) ||
          (ov[1] === c && ov[2] === d) ||
          (ov[2] === c && ov[0] === d) ||
          (ov[0] === d && ov[1] === c) ||
          (ov[1] === d && ov[2] === c) ||
          (ov[2] === d && ov[0] === c)
        ) {
          interior = true;
          break;
        }
      }
      if (interior) continue;
      if (!nexts.has(c)) nexts.set(c, d);
    }
  }

  const loop = [ia];
  let cursor = nexts.get(ia);
  let guard = 0;
  while (cursor !== undefined && cursor !== ia && guard++ < pts.length + 4) {
    loop.push(cursor);
    cursor = nexts.get(cursor);
  }
  const at = loop.indexOf(ib);
  if (at <= 0) return;

  const sideA = loop.slice(0, at + 1);
  const sideB = [ia, ...loop.slice(at + 1).reverse(), ib];
  const kept = tris.filter((_, i) => !dead.has(i));
  for (const side of [sideA, sideB]) {
    for (const v of earClip(side, pts)) kept.push({ v });
  }
  tris.length = 0;
  for (const t of kept) tris.push(t);
}

/**
 * Build a triangulated surface from elevated linework.
 *
 * @param {Array<{ points: {x:number,y:number,z:number}[], closed?: boolean }>} lines
 *   Consecutive points become breaklines. A line with one point is a spot elevation.
 *   Set closed to connect the last point back to the first.
 * @returns {{ vertices: {x:number,y:number,z:number}[], triangles: number[] }}
 *   triangles is a flat list of vertex indices, three per face.
 */
function createSurfaceFromLinework(lines) {
  const empty = { vertices: [], triangles: [] };
  if (!lines || !lines.length) return empty;

  const verts = [];
  const raw = [];

  function weld(p, blend) {
    for (let i = 0; i < verts.length; i++) {
      if (Math.hypot(verts[i].x - p.x, verts[i].y - p.y) <= SURFACE_WELD) {
        if (blend && Number.isFinite(p.z)) verts[i].z = (verts[i].z + p.z) / 2;
        return i;
      }
    }
    verts.push({ x: p.x, y: p.y, z: p.z });
    return verts.length - 1;
  }

  for (const line of lines) {
    const pts = (line.points || []).filter(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
    );
    if (!pts.length) continue;
    if (pts.length === 1) {
      weld(pts[0], false);
      continue;
    }
    const seq = pts.slice();
    if (line.closed) {
      const a = seq[0];
      const b = seq[seq.length - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) <= SURFACE_WELD) seq.pop();
    }
    for (let i = 1; i < seq.length; i++) raw.push([seq[i - 1], seq[i]]);
    if (line.closed && seq.length > 2) raw.push([seq[seq.length - 1], seq[0]]);
  }

  const pieces = raw.map(([a, b]) => ({ a: { ...a }, b: { ...b }, at: [] }));
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const hit = segmentHit(pieces[i].a, pieces[i].b, pieces[j].a, pieces[j].b);
      if (!hit) continue;
      const zi = pieces[i].a.z + hit.t * (pieces[i].b.z - pieces[i].a.z);
      const zj = pieces[j].a.z + hit.u * (pieces[j].b.z - pieces[j].a.z);
      const p = { x: hit.x, y: hit.y, z: (zi + zj) / 2 };
      pieces[i].at.push({ t: hit.t, p });
      pieces[j].at.push({ t: hit.u, p });
    }
  }

  const constraints = [];
  function link(a, b) {
    if (Math.hypot(a.x - b.x, a.y - b.y) <= SURFACE_WELD) return;
    const ia = weld(a, false);
    const ib = weld(b, true);
    if (ia !== ib) constraints.push([ia, ib]);
  }
  for (const piece of pieces) {
    piece.at.sort((p, q) => p.t - q.t);
    let prev = piece.a;
    let lastT = 0;
    for (const split of piece.at) {
      if (split.t - lastT < 1e-4) continue;
      link(prev, split.p);
      prev = split.p;
      lastT = split.t;
    }
    link(prev, piece.b);
  }

  if (verts.length < 3) return { vertices: verts.map((v) => ({ ...v })), triangles: [] };

  const tris = delaunay(verts);
  for (const [ia, ib] of constraints) {
    const on = [];
    for (let i = 0; i < verts.length; i++) {
      if (i !== ia && i !== ib && pointOnOpenSegment(verts[ia], verts[ib], verts[i])) on.push(i);
    }
    on.sort(
      (i, j) =>
        Math.hypot(verts[i].x - verts[ia].x, verts[i].y - verts[ia].y) -
        Math.hypot(verts[j].x - verts[ia].x, verts[j].y - verts[ia].y)
    );
    const chain = [ia, ...on, ib];
    for (let i = 1; i < chain.length; i++) insertBreakline(tris, verts, chain[i - 1], chain[i]);
  }

  const triangles = [];
  for (const t of tris) {
    if (surfaceOrient(verts[t.v[0]], verts[t.v[1]], verts[t.v[2]]) === 0) continue;
    triangles.push(t.v[0], t.v[1], t.v[2]);
  }
  return { vertices: verts.map((v) => ({ ...v })), triangles };
}

globalThis.createSurfaceFromLinework = createSurfaceFromLinework;
