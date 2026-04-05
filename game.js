// ── Scene ──────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 30, 100);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ── Lighting ───────────────────────────────────────────────────────────────
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(50, 80, 30);
sun.castShadow = true;
Object.assign(sun.shadow.mapSize, { width: 2048, height: 2048 });
Object.assign(sun.shadow.camera, { near: 0.5, far: 200, left: -60, right: 60, top: 60, bottom: -60 });
scene.add(sun);
scene.add(new THREE.AmbientLight(0x88ccff, 0.6));

// ── Collision system ───────────────────────────────────────────────────────
// Each collidable stored as { x, z, r } circle in XZ plane
const colliders = [];

// ── Ground ─────────────────────────────────────────────────────────────────
const groundGeo = new THREE.PlaneGeometry(200, 200, 40, 40);
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: 0x3a9e3a }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const posAttr = groundGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i), y = posAttr.getY(i);
  if (Math.abs(x) > 2 || Math.abs(y) > 2)
    posAttr.setZ(i, (Math.random() - 0.5) * 0.4);
}
groundGeo.computeVertexNormals();

// ── Trees ──────────────────────────────────────────────────────────────────
function makeTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 2, 8),
    new THREE.MeshLambertMaterial({ color: 0x8B4513 })
  );
  trunk.position.set(x, 1, z);
  trunk.castShadow = true;
  scene.add(trunk);

  [[1.5, 3, 3.5], [1.2, 2.5, 4.8]].forEach(([r, h, py], i) => {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 8),
      new THREE.MeshLambertMaterial({ color: i === 0 ? 0x228B22 : 0x2E8B57 })
    );
    f.position.set(x, py, z);
    f.castShadow = true;
    scene.add(f);
  });

  colliders.push({ x, z, r: 0.5 });
}

// ── Rocks ──────────────────────────────────────────────────────────────────
function makeRock(x, z) {
  const size = 0.4 + Math.random() * 0.4;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(size, 0),
    new THREE.MeshLambertMaterial({ color: 0x888888 })
  );
  rock.position.set(x, size * 0.5, z);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  colliders.push({ x, z, r: size + 0.15 });
}

// ── Clouds ─────────────────────────────────────────────────────────────────
function makeCloud(x, y, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const g = new THREE.Group();
  [[1.5,0,0,0],[1.2,1.2,0.3,0],[1.0,-1.2,0.2,0],[1.3,0.5,0.5,0.8]].forEach(([s,ox,oy,oz]) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 7), mat);
    c.position.set(ox, oy, oz);
    g.add(c);
  });
  g.position.set(x, y, z);
  scene.add(g);
  return g;
}

// ── Populate world ─────────────────────────────────────────────────────────
for (let i = 0; i < 60; i++) {
  let x, z;
  do { x = (Math.random() - 0.5) * 160; z = (Math.random() - 0.5) * 160; }
  while (Math.hypot(x, z) < 5);
  makeTree(x, z);
}
for (let i = 0; i < 30; i++)
  makeRock((Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160);

const clouds = [];
for (let i = 0; i < 15; i++)
  clouds.push(makeCloud((Math.random()-0.5)*150, 15+Math.random()*10, (Math.random()-0.5)*150));

// ── Inventory & Hotbar ─────────────────────────────────────────────────────
const ITEMS = [
  { name: 'Камень', icon: '🪨' },
  { name: 'Дерево', icon: '🪵' },
  { name: 'Цветок', icon: '🌸' },
  { name: 'Гриб',   icon: '🍄' },
  { name: 'Яблоко', icon: '🍎' },
];

// 27 inventory slots + 9 hotbar slots
const inventoryItems = new Array(27).fill(null);
const hotbarItems    = new Array(9).fill(null);

// Seed some items for demo
hotbarItems[0] = { ...ITEMS[0], count: 3 };
hotbarItems[1] = { ...ITEMS[1], count: 5 };
inventoryItems[0] = { ...ITEMS[2], count: 2 };
inventoryItems[1] = { ...ITEMS[3], count: 1 };
inventoryItems[2] = { ...ITEMS[4], count: 4 };

let activeSlot = 0;
let invOpen = false;

// Build hotbar DOM
const hotbarEl = document.getElementById('hotbar');
const hotbarSlotEls = [];
for (let i = 0; i < 9; i++) {
  const s = document.createElement('div');
  s.className = 'slot' + (i === 0 ? ' active' : '');
  s.innerHTML = `<span class="slot-num">${i+1}</span><span class="slot-icon"></span>`;
  s.addEventListener('click', () => setActiveSlot(i));
  hotbarEl.appendChild(s);
  hotbarSlotEls.push(s);
}

// Build inventory grid DOM
const invGrid = document.getElementById('inv-grid');
const invSlotEls = [];
for (let i = 0; i < 27; i++) {
  const s = document.createElement('div');
  s.className = 'slot';
  s.innerHTML = `<span class="slot-icon"></span>`;
  invGrid.appendChild(s);
  invSlotEls.push(s);
}

function renderSlot(el, item) {
  const icon = el.querySelector('.slot-icon');
  icon.textContent = item ? item.icon : '';
  el.title = item ? `${item.name} x${item.count}` : '';
}

function renderAll() {
  hotbarSlotEls.forEach((el, i) => renderSlot(el, hotbarItems[i]));
  invSlotEls.forEach((el, i) => renderSlot(el, inventoryItems[i]));
}

function setActiveSlot(i) {
  hotbarSlotEls[activeSlot].classList.remove('active');
  activeSlot = i;
  hotbarSlotEls[activeSlot].classList.add('active');
}

function toggleInventory() {
  invOpen = !invOpen;
  document.getElementById('inventory').style.display = invOpen ? 'flex' : 'none';
  if (invOpen) {
    document.exitPointerLock();
  } else {
    renderer.domElement.requestPointerLock();
  }
}

renderAll();

// ── Controls ───────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;

  // Hotbar 1-9
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.key) - 1;
    if (n >= 0 && n <= 8) setActiveSlot(n);
  }
  // Inventory toggle
  if (e.code === 'KeyE') toggleInventory();
});
document.addEventListener('keyup', e => keys[e.code] = false);

// Mouse look
let yaw = 0, pitch = 0;
renderer.domElement.addEventListener('click', () => {
  if (!invOpen) renderer.domElement.requestPointerLock();
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement) {
    yaw   -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
  }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Player ─────────────────────────────────────────────────────────────────
const PLAYER_R = 0.4;
const SPEED    = 5;
const playerPos = new THREE.Vector3(0, 1.7, 0);

function resolveCollisions(pos) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const dist = Math.hypot(dx, dz);
    const minDist = PLAYER_R + c.r;
    if (dist < minDist && dist > 0.001) {
      const push = (minDist - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
  // World boundary
  pos.x = Math.max(-98, Math.min(98, pos.x));
  pos.z = Math.max(-98, Math.min(98, pos.z));
}

// ── Game loop ──────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!invOpen) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));
    const move    = new THREE.Vector3();

    if (keys['KeyW'] || keys['ArrowUp'])    move.add(forward);
    if (keys['KeyS'] || keys['ArrowDown'])  move.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft'])  move.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) move.add(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(SPEED * dt);
      playerPos.add(move);
      resolveCollisions(playerPos);
    }
  }

  clouds.forEach((c, i) => {
    c.position.x += dt * (0.5 + i * 0.05);
    if (c.position.x > 80) c.position.x = -80;
  });

  camera.position.copy(playerPos);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  renderer.render(scene, camera);
}

animate();
