// ===================================================
// BUILDING SYSTEM + DESIRE PATHS
// Depends on: scene, terrainY, tGeo, colliders,
//             interactables, pPos, yaw, pitch,
//             slots, activeSlot, consumeItem,
//             showHint, renderAll, SEA_Y
// ===================================================

// ── Constants ───────────────────────────────────────
var GRID       = 1;          // snap grid size
var FOUND_SIZE = 3;          // foundation tile size (3×3)
var MAX_SLOPE  = 0.5;        // max height variance for placement
var PATH_WIDTH = 1.4;        // desire path ribbon width
var PATH_INC   = 0.006;      // weight added per second of walking
var PATH_DECAY = 0.00008;    // weight lost per second (degradation)
var PATH_VIS   = 0.25;       // min weight to show ribbon
var PATH_REBUILD_INTERVAL = 4; // seconds between ribbon rebuilds

// ── Decoratives tracking (flowers, path tiles) ──────
var decoratives = []; // {mesh, x, z}

// ── Foundation preview mesh ──────────────────────────
var foundPreviewMat = new THREE.MeshLambertMaterial({
  color: 0x44cc44, transparent: true, opacity: 0.45, depthWrite: false
});
var foundPreview = new THREE.Mesh(
  new THREE.BoxGeometry(FOUND_SIZE, 0.12, FOUND_SIZE),
  foundPreviewMat
);
foundPreview.visible = false;
scene.add(foundPreview);

// ── Placed foundations ───────────────────────────────
var foundations = []; // {x, z, size, mesh}

// ── Snap to grid ─────────────────────────────────────
function snapGrid(v, size) {
  return Math.round(v / size) * size;
}

// ── Get foundation placement position ────────────────
function getFoundPos() {
  var fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  var dist = FOUND_SIZE;
  var wx = pPos.x + fwd.x * dist;
  var wz = pPos.z + fwd.z * dist;
  var sx = snapGrid(wx, FOUND_SIZE);
  var sz = snapGrid(wz, FOUND_SIZE);
  return { x: sx, z: sz };
}

// ── Sample heights in foundation area ────────────────
function sampleFoundHeights(cx, cz, size) {
  var half = size / 2;
  var pts = [
    terrainY(cx - half, cz - half),
    terrainY(cx + half, cz - half),
    terrainY(cx - half, cz + half),
    terrainY(cx + half, cz + half),
    terrainY(cx, cz)
  ];
  var mn = pts[0], mx = pts[0], sum = 0;
  for (var i = 0; i < pts.length; i++) {
    if (pts[i] < mn) mn = pts[i];
    if (pts[i] > mx) mx = pts[i];
    sum += pts[i];
  }
  return { min: mn, max: mx, avg: sum / pts.length, variance: mx - mn };
}

// ── Flatten terrain vertices in rect ─────────────────
function flattenTerrain(cx, cz, size, targetY) {
  var half = size / 2 + 0.5;
  var pos = tGeo.attributes.position;
  for (var i = 0; i < pos.count; i++) {
    var vx = pos.getX(i), vz = pos.getZ(i);
    if (vx >= cx - half && vx <= cx + half && vz >= cz - half && vz <= cz + half) {
      pos.setY(i, targetY);
    }
  }
  pos.needsUpdate = true;
  tGeo.computeVertexNormals();
}

// ── Remove vegetation in rect ─────────────────────────
function clearVegetation(cx, cz, size) {
  var half = size / 2 + 0.3;
  // interactables (bushes, trees, rocks)
  for (var i = interactables.length - 1; i >= 0; i--) {
    var o = interactables[i];
    if (Math.abs(o.x - cx) < half && Math.abs(o.z - cz) < half) {
      if (o.group) scene.remove(o.group);
      if (o.mesh)  scene.remove(o.mesh);
      interactables.splice(i, 1);
      var ci = colliders.indexOf(o);
      if (ci > -1) colliders.splice(ci, 1);
    }
  }
  // decoratives (flowers, path tiles)
  for (var i = decoratives.length - 1; i >= 0; i--) {
    var d = decoratives[i];
    if (Math.abs(d.x - cx) < half && Math.abs(d.z - cz) < half) {
      scene.remove(d.mesh);
      decoratives.splice(i, 1);
    }
  }
}

// ── Place foundation ──────────────────────────────────
function placeFoundation() {
  if (countItem('Фундамент') < 1) { showHint('Нет фундамента! (крафт: 4 камня + 2 дерева)'); return; }
  var fp = getFoundPos();
  var cx = fp.x, cz = fp.z;
  var s = sampleFoundHeights(cx, cz, FOUND_SIZE);

  if (s.variance > MAX_SLOPE) {
    showHint('⛔ Слишком неровно! (перепад ' + s.variance.toFixed(2) + ' > ' + MAX_SLOPE + ')');
    foundPreviewMat.color.set(0xcc2222);
    return;
  }

  // check collider overlap
  var half = FOUND_SIZE / 2;
  for (var i = 0; i < colliders.length; i++) {
    var c = colliders[i];
    if (Math.abs(c.x - cx) < half + c.r && Math.abs(c.z - cz) < half + c.r) {
      showHint('⛔ Место занято!'); return;
    }
  }

  // flatten
  flattenTerrain(cx, cz, FOUND_SIZE, s.avg);
  clearVegetation(cx, cz, FOUND_SIZE);

  // mesh
  var mesh = new THREE.Mesh(
    new THREE.BoxGeometry(FOUND_SIZE, 0.18, FOUND_SIZE),
    new THREE.MeshLambertMaterial({ color: 0x8B6040, map: woodTex })
  );
  mesh.position.set(cx, s.avg + 0.09, cz);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // edge lines for visual grid
  var edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(FOUND_SIZE, 0.18, FOUND_SIZE)),
    new THREE.LineBasicMaterial({ color: 0x5a3a10 })
  );
  edges.position.copy(mesh.position);
  scene.add(edges);

  foundations.push({ x: cx, z: cz, size: FOUND_SIZE, mesh: mesh, y: s.avg });
  colliders.push({ x: cx, z: cz, r: FOUND_SIZE * 0.45 });

  consumeItem('Фундамент', 1);
  renderAll();
  showHint('✅ Фундамент установлен');
}

// ── Update preview each frame ─────────────────────────
function updateFoundPreview() {
  var h = slots[activeSlot];
  if (!h || h.name !== 'Фундамент') { foundPreview.visible = false; return; }
  var fp = getFoundPos();
  var s = sampleFoundHeights(fp.x, fp.z, FOUND_SIZE);
  var valid = s.variance <= MAX_SLOPE;
  foundPreviewMat.color.set(valid ? 0x44cc44 : 0xcc2222);
  foundPreview.position.set(fp.x, s.avg + 0.09, fp.z);
  foundPreview.visible = true;
}

// ===================================================
// DESIRE PATHS
// ===================================================
var pathWeights = {};   // key "x,z" → weight 0..1
var pathRibbon  = null; // THREE.Mesh ribbon
var pathRebuildTimer = 0;

function pathKey(x, z) {
  return (Math.round(x * 2) / 2) + ',' + (Math.round(z * 2) / 2);
}

// called every frame while player is walking on land
function recordFootstep(x, z, dt) {
  var k = pathKey(x, z);
  var w = pathWeights[k] || 0;
  w = Math.min(1, w + PATH_INC * dt);
  pathWeights[k] = w;
}

// decay all weights
function decayPaths(dt) {
  var keys = Object.keys(pathWeights);
  for (var i = 0; i < keys.length; i++) {
    pathWeights[keys[i]] -= PATH_DECAY * dt;
    if (pathWeights[keys[i]] <= 0) delete pathWeights[keys[i]];
  }
}

// ── A* between two world points ───────────────────────
function astarPath(x1, z1, x2, z2) {
  var STEP = 1;
  var MAX_NODES = 2000;
  var sx = Math.round(x1 / STEP) * STEP;
  var sz = Math.round(z1 / STEP) * STEP;
  var ex = Math.round(x2 / STEP) * STEP;
  var ez = Math.round(z2 / STEP) * STEP;

  function heur(ax, az) { return Math.abs(ax - ex) + Math.abs(az - ez); }
  function nodeKey(ax, az) { return ax + ',' + az; }

  function slopePenalty(ax, az) {
    var dy1 = Math.abs(terrainY(ax + STEP, az) - terrainY(ax - STEP, az)) / (2 * STEP);
    var dy2 = Math.abs(terrainY(ax, az + STEP) - terrainY(ax, az - STEP)) / (2 * STEP);
    var slope = Math.max(dy1, dy2);
    var angleDeg = Math.atan(slope) * 180 / Math.PI;
    return angleDeg > 30 ? 10 : 0;
  }

  function obstaclePenalty(ax, az) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (c.r > 0.3 && Math.sqrt((ax - c.x) * (ax - c.x) + (az - c.z) * (az - c.z)) < 1.0) return 20;
    }
    return 0;
  }

  function trafficBonus(ax, az) {
    var w = pathWeights[pathKey(ax, az)] || 0;
    return w > 0.3 ? -0.5 : 0;
  }

  var open = [{ x: sx, z: sz, g: 0, f: heur(sx, sz), parent: null }];
  var closed = {};
  var gScore = {}; gScore[nodeKey(sx, sz)] = 0;
  var count = 0;

  while (open.length > 0 && count < MAX_NODES) {
    count++;
    // find lowest f
    var bi = 0;
    for (var i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    var cur = open.splice(bi, 1)[0];
    var ck = nodeKey(cur.x, cur.z);
    if (closed[ck]) continue;
    closed[ck] = cur;

    if (cur.x === ex && cur.z === ez) {
      // reconstruct
      var path = [];
      var n = cur;
      while (n) { path.unshift({ x: n.x, z: n.z }); n = n.parent; }
      return path;
    }

    var dirs = [[STEP,0],[-STEP,0],[0,STEP],[0,-STEP],[STEP,STEP],[-STEP,STEP],[STEP,-STEP],[-STEP,-STEP]];
    for (var d = 0; d < dirs.length; d++) {
      var nx = cur.x + dirs[d][0], nz = cur.z + dirs[d][1];
      var nk = nodeKey(nx, nz);
      if (closed[nk]) continue;
      var diag = (dirs[d][0] !== 0 && dirs[d][1] !== 0) ? 1.414 : 1;
      var ng = cur.g + diag + slopePenalty(nx, nz) + obstaclePenalty(nx, nz) + trafficBonus(nx, nz);
      if (gScore[nk] === undefined || ng < gScore[nk]) {
        gScore[nk] = ng;
        open.push({ x: nx, z: nz, g: ng, f: ng + heur(nx, nz), parent: cur });
      }
    }
  }

  // fallback: straight line
  var path = [];
  var steps = Math.ceil(Math.sqrt((x2-x1)*(x2-x1)+(z2-z1)*(z2-z1)));
  for (var i = 0; i <= steps; i++) {
    path.push({ x: x1 + (x2-x1)*i/steps, z: z1 + (z2-z1)*i/steps });
  }
  return path;
}

// ── Build ribbon mesh from weighted nodes ─────────────
function rebuildPathRibbon() {
  if (pathRibbon) { scene.remove(pathRibbon); pathRibbon = null; }

  var keys = Object.keys(pathWeights);
  var visible = [];
  for (var i = 0; i < keys.length; i++) {
    if (pathWeights[keys[i]] >= PATH_VIS) {
      var parts = keys[i].split(',');
      visible.push({ x: parseFloat(parts[0]), z: parseFloat(parts[1]), w: pathWeights[keys[i]] });
    }
  }
  if (visible.length < 2) return;

  // cluster into chains by proximity
  var used = new Array(visible.length).fill(false);
  var chains = [];

  for (var start = 0; start < visible.length; start++) {
    if (used[start]) continue;
    var chain = [visible[start]];
    used[start] = true;
    var changed = true;
    while (changed) {
      changed = false;
      var last = chain[chain.length - 1];
      var bestDist = 2.5, bestIdx = -1;
      for (var j = 0; j < visible.length; j++) {
        if (used[j]) continue;
        var dd = Math.sqrt((visible[j].x-last.x)*(visible[j].x-last.x)+(visible[j].z-last.z)*(visible[j].z-last.z));
        if (dd < bestDist) { bestDist = dd; bestIdx = j; }
      }
      if (bestIdx > -1) { chain.push(visible[bestIdx]); used[bestIdx] = true; changed = true; }
    }
    if (chain.length >= 2) chains.push(chain);
  }

  var positions = [], indices = [], colors = [];
  var vi = 0;

  for (var ci = 0; ci < chains.length; ci++) {
    var chain = chains[ci];
    for (var pi = 0; pi < chain.length - 1; pi++) {
      var p0 = chain[pi], p1 = chain[pi + 1];
      var dx = p1.x - p0.x, dz = p1.z - p0.z;
      var len = Math.sqrt(dx*dx + dz*dz) || 1;
      var rx = -dz / len * PATH_WIDTH * 0.5;
      var rz =  dx / len * PATH_WIDTH * 0.5;
      var y0 = terrainY(p0.x, p0.z) + 0.03;
      var y1 = terrainY(p1.x, p1.z) + 0.03;
      var w = (p0.w + p1.w) * 0.5;

      positions.push(
        p0.x - rx, y0, p0.z - rz,
        p0.x + rx, y0, p0.z + rz,
        p1.x - rx, y1, p1.z - rz,
        p1.x + rx, y1, p1.z + rz
      );
      var alpha = Math.min(0.75, Math.max(0.25, w));
      for (var k = 0; k < 4; k++) colors.push(0.42, 0.30, 0.12, alpha);
      indices.push(vi, vi+1, vi+2, vi+1, vi+3, vi+2);
      vi += 4;
    }
  }

  if (positions.length === 0) return;

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  var mat = new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  pathRibbon = new THREE.Mesh(geo, mat);
  scene.add(pathRibbon);
}

// ── Per-frame update (call from animate loop) ─────────
function updateBuilding(dt, isMoving, isOnGround, isSwimming) {
  updateFoundPreview();

  if (isMoving && isOnGround && !isSwimming) {
    recordFootstep(pPos.x, pPos.z, dt);
  }
  decayPaths(dt);

  pathRebuildTimer -= dt;
  if (pathRebuildTimer <= 0) {
    rebuildPathRibbon();
    pathRebuildTimer = PATH_REBUILD_INTERVAL;
  }
}

// ── RMB handler for foundation ────────────────────────
function tryPlaceFoundation() {
  var h = slots[activeSlot];
  if (h && h.name === 'Фундамент') { placeFoundation(); return true; }
  return false;
}
