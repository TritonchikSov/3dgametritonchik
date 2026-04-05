// ═══════════════════════════════════════════════════════
//  SCENE & RENDERER
// ═══════════════════════════════════════════════════════
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 40, 120);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ═══════════════════════════════════════════════════════
//  LIGHTING
// ═══════════════════════════════════════════════════════
const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
sun.position.set(60, 100, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { near:1, far:250, left:-80, right:80, top:80, bottom:-80 });
scene.add(sun);
scene.add(new THREE.AmbientLight(0x99bbff, 0.55));
const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a7a1a, 0.4);
scene.add(hemi);

// ═══════════════════════════════════════════════════════
//  PROCEDURAL TEXTURES
// ═══════════════════════════════════════════════════════
function makeCanvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const grassTex = makeCanvasTex(128, (ctx, s) => {
  ctx.fillStyle = '#4a9e3a'; ctx.fillRect(0,0,s,s);
  for (let i=0;i<800;i++) {
    const x=Math.random()*s, y=Math.random()*s;
    ctx.fillStyle = `hsl(${110+Math.random()*20},${50+Math.random()*20}%,${28+Math.random()*14}%)`;
    ctx.fillRect(x,y,2+Math.random()*3,2+Math.random()*3);
  }
});
grassTex.repeat.set(20,20);

const dirtTex = makeCanvasTex(64, (ctx, s) => {
  ctx.fillStyle = '#7a5230'; ctx.fillRect(0,0,s,s);
  for (let i=0;i<400;i++) {
    ctx.fillStyle = `hsl(25,${35+Math.random()*20}%,${22+Math.random()*18}%)`;
    ctx.fillRect(Math.random()*s, Math.random()*s, 2+Math.random()*4, 2+Math.random()*4);
  }
});

const rockTex = makeCanvasTex(64, (ctx, s) => {
  ctx.fillStyle = '#7a7a7a'; ctx.fillRect(0,0,s,s);
  for (let i=0;i<500;i++) {
    ctx.fillStyle = `hsl(0,0%,${38+Math.random()*28}%)`;
    ctx.fillRect(Math.random()*s, Math.random()*s, 1+Math.random()*4, 1+Math.random()*4);
  }
});

const woodTex = makeCanvasTex(64, (ctx, s) => {
  ctx.fillStyle = '#7a4010'; ctx.fillRect(0,0,s,s);
  for (let i=0;i<12;i++) {
    ctx.strokeStyle = `hsl(25,${40+Math.random()*20}%,${18+Math.random()*14}%)`;
    ctx.lineWidth = 1+Math.random()*2;
    ctx.beginPath(); ctx.moveTo(0, i*(s/12)); ctx.lineTo(s, i*(s/12)+Math.random()*6-3);
    ctx.stroke();
  }
});

const leafTex = makeCanvasTex(64, (ctx, s) => {
  ctx.fillStyle = '#2a7a1a'; ctx.fillRect(0,0,s,s);
  for (let i=0;i<300;i++) {
    ctx.fillStyle = `hsl(${105+Math.random()*25},${45+Math.random()*25}%,${20+Math.random()*18}%)`;
    ctx.beginPath();
    ctx.arc(Math.random()*s, Math.random()*s, 1+Math.random()*3, 0, Math.PI*2);
    ctx.fill();
  }
});

const waterTex = makeCanvasTex(128, (ctx, s) => {
  ctx.fillStyle = '#1a6fa8'; ctx.fillRect(0,0,s,s);
  for (let i=0;i<200;i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.05+Math.random()*0.12})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const y = Math.random()*s;
    ctx.moveTo(Math.random()*s, y);
    ctx.lineTo(Math.random()*s, y+Math.random()*4);
    ctx.stroke();
  }
});
waterTex.repeat.set(4,4);

const sandTex = makeCanvasTex(64, (ctx, s) => {
  ctx.fillStyle = '#c8a84b'; ctx.fillRect(0,0,s,s);
  for (let i=0;i<400;i++) {
    ctx.fillStyle = `hsl(42,${40+Math.random()*20}%,${52+Math.random()*16}%)`;
    ctx.fillRect(Math.random()*s, Math.random()*s, 1+Math.random()*3, 1+Math.random()*3);
  }
});
sandTex.repeat.set(3,3);

const bushTex = makeCanvasTex(32, (ctx, s) => {
  ctx.fillStyle = '#1e6b1e'; ctx.fillRect(0,0,s,s);
  for (let i=0;i<120;i++) {
    ctx.fillStyle = `hsl(${115+Math.random()*20},${50+Math.random()*20}%,${18+Math.random()*14}%)`;
    ctx.beginPath(); ctx.arc(Math.random()*s,Math.random()*s,1+Math.random()*2,0,Math.PI*2); ctx.fill();
  }
});

// ═══════════════════════════════════════════════════════
//  TERRAIN (heightmap-based)
// ═══════════════════════════════════════════════════════
const TERRAIN_SIZE = 200;
const TERRAIN_SEGS = 80;
const groundGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
groundGeo.rotateX(-Math.PI / 2);

// Simple noise via layered sin/cos
function terrainHeight(x, z) {
  let h = 0;
  h += Math.sin(x * 0.04) * Math.cos(z * 0.04) * 3.5;
  h += Math.sin(x * 0.09 + 1.2) * Math.cos(z * 0.07 + 0.8) * 1.8;
  h += Math.sin(x * 0.18 + 2.1) * Math.cos(z * 0.15 + 1.5) * 0.8;
  h += Math.sin(x * 0.35) * Math.cos(z * 0.32) * 0.35;
  // flatten spawn area
  const d = Math.hypot(x, z);
  if (d < 12) h *= (d / 12) * (d / 12);
  return h;
}

const tPos = groundGeo.attributes.position;
for (let i = 0; i < tPos.count; i++) {
  const x = tPos.getX(i), z = tPos.getZ(i);
  tPos.setY(i, terrainHeight(x, z));
}
groundGeo.computeVertexNormals();

const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.receiveShadow = true;
scene.add(ground);

function getGroundY(x, z) {
  // sample terrain height analytically
  return terrainHeight(x, z);
}

// ═══════════════════════════════════════════════════════
//  LAKES
// ═══════════════════════════════════════════════════════
const lakes = []; // { x, z, r, waterY }
const LAKE_CONFIGS = [
  { x: 25,  z: 30,  r: 12 },
  { x: -40, z: -20, r: 9  },
  { x: 50,  z: -45, r: 11 },
  { x: -30, z: 50,  r: 8  },
];

LAKE_CONFIGS.forEach(cfg => {
  const waterY = getGroundY(cfg.x, cfg.z) - 0.5;

  // Sand shore ring
  const shoreGeo = new THREE.CylinderGeometry(cfg.r + 2.5, cfg.r + 2.5, 0.15, 32);
  const shore = new THREE.Mesh(shoreGeo, new THREE.MeshLambertMaterial({ map: sandTex }));
  shore.position.set(cfg.x, waterY + 0.05, cfg.z);
  shore.receiveShadow = true;
  scene.add(shore);

  // Water disc
  const waterGeo = new THREE.CylinderGeometry(cfg.r, cfg.r, 0.18, 32);
  const waterMat = new THREE.MeshLambertMaterial({
    map: waterTex, transparent: true, opacity: 0.82, color: 0x2288cc
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(cfg.x, waterY + 0.12, cfg.z);
  scene.add(water);

  // Depress terrain inside lake (visual only — we handle swim by distance)
  lakes.push({ x: cfg.x, z: cfg.z, r: cfg.r, waterY: waterY + 0.12 });
});

function inLake(x, z) {
  for (const l of lakes) if (Math.hypot(x - l.x, z - l.z) < l.r) return l;
  return null;
}

// ═══════════════════════════════════════════════════════
//  COLLIDERS & INTERACTABLES
// ═══════════════════════════════════════════════════════
const colliders     = []; // { x, z, r }
const interactables = []; // { ..., type, hp, onMine }

// ═══════════════════════════════════════════════════════
//  TREES
// ═══════════════════════════════════════════════════════
function makeTree(x, z) {
  const gy = getGroundY(x, z);
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 2.2, 8),
    new THREE.MeshLambertMaterial({ map: woodTex })
  );
  trunk.position.y = 1.1; trunk.castShadow = true; group.add(trunk);

  const lMat = new THREE.MeshLambertMaterial({ map: leafTex });
  [[1.6, 3.2, 3.6], [1.25, 2.6, 5.0]].forEach(([r, h, py]) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), lMat);
    f.position.y = py; f.castShadow = true; group.add(f);
  });

  group.position.set(x, gy, z);
  scene.add(group);

  const obj = { group, x, z, r: 0.55, type: 'tree', hp: 5, maxHp: 5,
    onMine: () => addItem({ name: 'Дерево', icon: '🪵', count: 1 })
  };
  colliders.push(obj); interactables.push(obj);
}

// ═══════════════════════════════════════════════════════
//  ROCKS (world objects)
// ═══════════════════════════════════════════════════════
function makeRock(x, z) {
  const gy = getGroundY(x, z);
  const size = 0.5 + Math.random() * 0.5;
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(size, 1),
    new THREE.MeshLambertMaterial({ map: rockTex })
  );
  mesh.position.set(x, gy + size * 0.5, z);
  mesh.rotation.set(Math.random()*2, Math.random()*6, Math.random()*2);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);

  const obj = { mesh, x, z, r: size + 0.2, type: 'rock', hp: 4, maxHp: 4,
    onMine: () => addItem({ name: 'Камень', icon: '🪨', count: 1 })
  };
  colliders.push(obj); interactables.push(obj);
}

// ═══════════════════════════════════════════════════════
//  BUSHES
// ═══════════════════════════════════════════════════════
function makeBush(x, z) {
  const gy = getGroundY(x, z);
  const group = new THREE.Group();
  const bMat = new THREE.MeshLambertMaterial({ map: bushTex });
  [[0,0,0,0.72],[0.55,0.1,0,0.55],[-0.55,0.05,0,0.55],[0,0.1,0.55,0.5],[0,0.05,-0.5,0.5]].forEach(([ox,oy,oz,s]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 7), bMat);
    b.position.set(ox, oy + 0.5, oz); group.add(b);
  });
  const berryMat = new THREE.MeshLambertMaterial({ color: 0xdd1111 });
  for (let i = 0; i < 7; i++) {
    const a = (i/7)*Math.PI*2;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 5), berryMat);
    berry.position.set(Math.cos(a)*0.62, 0.5+Math.random()*0.35, Math.sin(a)*0.62);
    group.add(berry);
  }
  group.position.set(x, gy, z);
  scene.add(group);

  const obj = { group, x, z, r: 0.85, type: 'bush', hp: 1, maxHp: 1,
    onMine: () => { addFood(25); addWater(10); showHint('🍓 +25 еды, +10 воды'); }
  };
  colliders.push(obj); interactables.push(obj);
}

// ═══════════════════════════════════════════════════════
//  STONE ITEM IN WORLD (pickable)
// ═══════════════════════════════════════════════════════
const worldStones = [];
function spawnWorldStone(x, z) {
  const gy = getGroundY(x, z);
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.22, 0),
    new THREE.MeshLambertMaterial({ map: rockTex, color: 0xaaaaaa })
  );
  mesh.position.set(x, gy + 0.25, z);
  mesh.castShadow = true;
  scene.add(mesh);
  const obj = { mesh, x, z, r: 0.6, type: 'stone_item' };
  interactables.push(obj);
  worldStones.push(obj);
  return obj;
}

// ═══════════════════════════════════════════════════════
//  CLOUDS
// ═══════════════════════════════════════════════════════
function makeCloud(x, y, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  [[1.6,0,0,0],[1.3,1.3,0.3,0],[1.1,-1.3,0.2,0],[1.4,0.5,0.5,0.9]].forEach(([s,ox,oy,oz]) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(s,7,7), mat);
    c.position.set(ox,oy,oz); g.add(c);
  });
  g.position.set(x,y,z); scene.add(g); return g;
}

// ═══════════════════════════════════════════════════════
//  POPULATE WORLD
// ═══════════════════════════════════════════════════════
function awayFromLakes(x, z, minD) {
  for (const l of lakes) if (Math.hypot(x-l.x, z-l.z) < l.r + minD) return false;
  return true;
}

for (let i = 0; i < 65; i++) {
  let x, z, tries = 0;
  do { x=(Math.random()-0.5)*160; z=(Math.random()-0.5)*160; tries++; }
  while ((Math.hypot(x,z)<6 || !awayFromLakes(x,z,3)) && tries<30);
  makeTree(x, z);
}
for (let i = 0; i < 35; i++) {
  let x, z, tries=0;
  do { x=(Math.random()-0.5)*160; z=(Math.random()-0.5)*160; tries++; }
  while ((Math.hypot(x,z)<4 || !awayFromLakes(x,z,2)) && tries<30);
  makeRock(x, z);
}
for (let i = 0; i < 28; i++) {
  let x, z, tries=0;
  do { x=(Math.random()-0.5)*150; z=(Math.random()-0.5)*150; tries++; }
  while ((Math.hypot(x,z)<4 || !awayFromLakes(x,z,2)) && tries<30);
  makeBush(x, z);
}

// Spawn a few world stones near start
[[-3,4],[4,-3],[6,2],[-5,-4],[2,7]].forEach(([x,z]) => spawnWorldStone(x,z));

const clouds = [];
for (let i=0;i<16;i++)
  clouds.push(makeCloud((Math.random()-0.5)*150, 16+Math.random()*10, (Math.random()-0.5)*150));
