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

// ── Colliders & interactables ──────────────────────────────────────────────
const colliders    = []; // { x, z, r }
const interactables = []; // { mesh/group, x, z, r, type, hp, maxHp, onMine }

// ── Ground ─────────────────────────────────────────────────────────────────
const groundGeo = new THREE.PlaneGeometry(200, 200, 40, 40);
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: 0x3a9e3a }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const posAttr = groundGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i), y = posAttr.getY(i);
  if (Math.abs(x) > 2 || Math.abs(y) > 2) posAttr.setZ(i, (Math.random() - 0.5) * 0.4);
}
groundGeo.computeVertexNormals();

// ── Tree ───────────────────────────────────────────────────────────────────
function makeTree(x, z) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 2, 8),
    new THREE.MeshLambertMaterial({ color: 0x8B4513 })
  );
  trunk.position.y = 1;
  trunk.castShadow = true;
  group.add(trunk);

  [[1.5, 3, 3.5, 0x228B22], [1.2, 2.5, 4.8, 0x2E8B57]].forEach(([r, h, py, col]) => {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 8),
      new THREE.MeshLambertMaterial({ color: col })
    );
    f.position.y = py;
    f.castShadow = true;
    group.add(f);
  });

  group.position.set(x, 0, z);
  scene.add(group);

  const obj = { group, x, z, r: 0.5, type: 'tree', hp: 3, maxHp: 3,
    onMine: () => { addItem({ name: 'Дерево', icon: '🪵', count: 1 }); }
  };
  colliders.push(obj);
  interactables.push(obj);
  return obj;
}

// ── Rock ───────────────────────────────────────────────────────────────────
function makeRock(x, z) {
  const size = 0.4 + Math.random() * 0.4;
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(size, 0),
    new THREE.MeshLambertMaterial({ color: 0x888888 })
  );
  mesh.position.set(x, size * 0.5, z);
  mesh.rotation.set(Math.random(), Math.random(), Math.random());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const obj = { mesh, x, z, r: size + 0.15, type: 'rock', hp: 2, maxHp: 2,
    onMine: () => { addItem({ name: 'Камень', icon: '🪨', count: 1 }); }
  };
  colliders.push(obj);
  interactables.push(obj);
  return obj;
}

// ── Bush ───────────────────────────────────────────────────────────────────
function makeBush(x, z) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2d7a2d });
  [[0,0,0,0.7],[0.5,0.1,0,0.55],[-0.5,0.05,0,0.55],[0,0.1,0.5,0.5],[0,0.05,-0.5,0.5]].forEach(([ox,oy,oz,s]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 7), mat);
    b.position.set(ox, oy + 0.5, oz);
    group.add(b);
  });

  // Berries
  const berryMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 5), berryMat);
    berry.position.set(Math.cos(angle) * 0.6, 0.5 + Math.random() * 0.3, Math.sin(angle) * 0.6);
    group.add(berry);
  }

  group.position.set(x, 0, z);
  scene.add(group);

  const obj = { group, x, z, r: 0.8, type: 'bush', hp: 1, maxHp: 1,
    onMine: () => { heal(20); showHint('🍓 +20 здоровья'); }
  };
  colliders.push(obj);
  interactables.push(obj);
  return obj;
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
for (let i = 0; i < 25; i++) {
  let x, z;
  do { x = (Math.random() - 0.5) * 160; z = (Math.random() - 0.5) * 160; }
  while (Math.hypot(x, z) < 4);
  makeBush(x, z);
}

const clouds = [];
for (let i = 0; i < 15; i++)
  clouds.push(makeCloud((Math.random()-0.5)*150, 15+Math.random()*10, (Math.random()-0.5)*150));

// ── Health ─────────────────────────────────────────────────────────────────
let health = 100;
function heal(amount) {
  health = Math.min(100, health + amount);
  document.getElementById('health-fill').style.width = health + '%';
}
function damage(amount) {
  health = Math.max(0, health - amount);
  document.getElementById('health-fill').style.width = health + '%';
}

// ── Inventory data ─────────────────────────────────────────────────────────
// slots: index 0-26 = inventory, 27-35 = hotbar
const slots = new Array(36).fill(null);
slots[27] = { name: 'Камень', icon: '🪨', count: 1 }; // start with 1 stone in hotbar slot 1

function addItem(item) {
  // Try to stack in existing slot
  for (let i = 0; i < 36; i++) {
    if (slots[i] && slots[i].name === item.name) {
      slots[i].count += item.count;
      renderAll();
      showHint(`+${item.count} ${item.icon} ${item.name}`);
      return;
    }
  }
  // Find empty slot (inventory first, then hotbar)
  for (let i = 0; i < 36; i++) {
    if (!slots[i]) {
      slots[i] = { ...item };
      renderAll();
      showHint(`+${item.count} ${item.icon} ${item.name}`);
      return;
    }
  }
  showHint('Инвентарь полон!');
}

// ── UI: slot elements ──────────────────────────────────────────────────────
let activeSlot = 27; // hotbar slot 0 = index 27
let invOpen = false;

// drag state
let dragFrom = null; // slot index being dragged

const allSlotEls = []; // index matches slots[]

function buildSlotEl(index, showNum) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.dataset.index = index;
  if (showNum !== undefined) {
    el.innerHTML = `<span class="slot-num">${showNum}</span><span class="slot-icon"></span><span class="slot-count"></span>`;
  } else {
    el.innerHTML = `<span class="slot-icon"></span><span class="slot-count"></span>`;
  }

  // Hotbar click = select
  if (index >= 27) {
    el.addEventListener('click', () => { if (!invOpen) setActiveSlot(index); });
  }

  // Drag & drop
  el.addEventListener('mousedown', e => {
    if (!invOpen) return;
    if (e.button !== 0) return;
    if (!slots[index]) return;
    dragFrom = index;
    const ghost = document.getElementById('drag-ghost');
    ghost.textContent = slots[index].icon;
    ghost.style.display = 'block';
    e.preventDefault();
  });

  el.addEventListener('mouseenter', () => {
    if (dragFrom !== null) el.classList.add('drag-over');
  });
  el.addEventListener('mouseleave', () => el.classList.remove('drag-over'));

  el.addEventListener('mouseup', () => {
    if (dragFrom !== null && dragFrom !== index) {
      // Swap slots
      const tmp = slots[index];
      slots[index] = slots[dragFrom];
      slots[dragFrom] = tmp;
      renderAll();
    }
    el.classList.remove('drag-over');
    endDrag();
  });

  allSlotEls[index] = el;
  return el;
}

// Build hotbar (bottom HUD)
const hotbarEl = document.getElementById('hotbar');
for (let i = 27; i < 36; i++) {
  hotbarEl.appendChild(buildSlotEl(i, i - 26));
}

// Build inventory grid (27 slots)
const invGrid = document.getElementById('inv-grid');
for (let i = 0; i < 27; i++) invGrid.appendChild(buildSlotEl(i));

// Build hotbar row inside inventory panel
const invHotbarRow = document.getElementById('inv-hotbar-row');
const invHotbarMirror = [];
for (let i = 27; i < 36; i++) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.dataset.index = i;
  el.innerHTML = `<span class="slot-num">${i-26}</span><span class="slot-icon"></span><span class="slot-count"></span>`;
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!slots[i]) return;
    dragFrom = i;
    const ghost = document.getElementById('drag-ghost');
    ghost.textContent = slots[i].icon;
    ghost.style.display = 'block';
    e.preventDefault();
  });
  el.addEventListener('mouseenter', () => { if (dragFrom !== null) el.classList.add('drag-over'); });
  el.addEventListener('mouseleave', () => el.classList.remove('drag-over'));
  el.addEventListener('mouseup', () => {
    if (dragFrom !== null && dragFrom !== i) {
      const tmp = slots[i]; slots[i] = slots[dragFrom]; slots[dragFrom] = tmp;
      renderAll();
    }
    el.classList.remove('drag-over');
    endDrag();
  });
  invHotbarMirror[i] = el;
  invHotbarRow.appendChild(el);
}

document.addEventListener('mouseup', endDrag);
document.addEventListener('mousemove', e => {
  if (dragFrom !== null) {
    const ghost = document.getElementById('drag-ghost');
    ghost.style.left = e.clientX + 'px';
    ghost.style.top  = e.clientY + 'px';
  }
});

function endDrag() {
  dragFrom = null;
  document.getElementById('drag-ghost').style.display = 'none';
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function renderSlotEl(el, item) {
  el.querySelector('.slot-icon').textContent  = item ? item.icon  : '';
  el.querySelector('.slot-count').textContent = item && item.count > 1 ? item.count : '';
  el.title = item ? `${item.name} x${item.count}` : '';
}

function renderAll() {
  for (let i = 0; i < 36; i++) {
    if (allSlotEls[i]) renderSlotEl(allSlotEls[i], slots[i]);
  }
  // mirror hotbar in inventory panel
  for (let i = 27; i < 36; i++) {
    if (invHotbarMirror[i]) renderSlotEl(invHotbarMirror[i], slots[i]);
  }
  // active highlight
  allSlotEls.forEach((el, i) => {
    if (i >= 27) el.classList.toggle('active', i === activeSlot);
  });
}

function setActiveSlot(i) {
  activeSlot = i;
  renderAll();
}

function toggleInventory() {
  invOpen = !invOpen;
  document.getElementById('inventory').style.display = invOpen ? 'flex' : 'none';
  if (invOpen) document.exitPointerLock();
  else renderer.domElement.requestPointerLock();
}

renderAll();

// ── Hint popup ─────────────────────────────────────────────────────────────
let hintTimer = null;
function showHint(msg) {
  const el = document.getElementById('hint-popup');
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.style.opacity = '0', 2000);
}

// ── Controls ───────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.key);
    if (n >= 1 && n <= 9) setActiveSlot(26 + n);
  }
  if (e.code === 'KeyE') toggleInventory();
});
document.addEventListener('keyup', e => keys[e.code] = false);

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

// ── Mining (left click) ────────────────────────────────────────────────────
const REACH = 4;
let mineTarget = null;
let mineCooldown = 0;

function getHeldItem() { return slots[activeSlot]; }

function hasTool(type) {
  const item = getHeldItem();
  if (!item) return false;
  if (type === 'tree') return item.name === 'Камень' || item.name === 'Топор';
  if (type === 'rock') return item.name === 'Камень' || item.name === 'Кирка';
  if (type === 'bush') return true; // bare hands ok
  return false;
}

document.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (invOpen) return;
  if (document.pointerLockElement !== renderer.domElement) return;
  tryMine();
});

function tryMine() {
  if (mineCooldown > 0) return;

  // Find nearest interactable in front of player within REACH
  const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  let best = null, bestDist = REACH;

  for (const obj of interactables) {
    const dx = obj.x - playerPos.x;
    const dz = obj.z - playerPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > REACH) continue;
    // dot product: is it roughly in front?
    const dot = (dx / dist) * dir.x + (dz / dist) * dir.z;
    if (dot < 0.3) continue;
    if (dist < bestDist) { bestDist = dist; best = obj; }
  }

  if (!best) return;

  if (best.type === 'bush') {
    // Eat berries — no tool needed
    best.onMine();
    // Respawn bush after 10s
    const bx = best.x, bz = best.z;
    removeInteractable(best);
    setTimeout(() => makeBush(bx, bz), 10000);
    mineCooldown = 0.5;
    return;
  }

  if (!hasTool(best.type)) {
    showHint('Нужен инструмент! (держи 🪨 Камень)');
    return;
  }

  best.hp--;
  mineCooldown = 0.4;

  // Flash effect
  const meshes = best.group ? best.group.children : [best.mesh];
  meshes.forEach(m => { if (m.material) m.material.emissive = new THREE.Color(0.4, 0.2, 0); });
  setTimeout(() => meshes.forEach(m => { if (m.material) m.material.emissive = new THREE.Color(0,0,0); }), 150);

  if (best.hp <= 0) {
    best.onMine();
    const bx = best.x, bz = best.z, btype = best.type;
    removeInteractable(best);
    // Respawn after delay
    const delay = btype === 'tree' ? 20000 : 15000;
    setTimeout(() => {
      if (btype === 'tree') makeTree(bx, bz);
      else makeRock(bx, bz);
    }, delay);
  }
}

function removeInteractable(obj) {
  if (obj.group) scene.remove(obj.group);
  if (obj.mesh)  scene.remove(obj.mesh);
  const ii = interactables.indexOf(obj);
  if (ii !== -1) interactables.splice(ii, 1);
  const ci = colliders.indexOf(obj);
  if (ci !== -1) colliders.splice(ci, 1);
}

// ── Nearby hint ────────────────────────────────────────────────────────────
function updateNearbyHint() {
  const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (const obj of interactables) {
    const dx = obj.x - playerPos.x;
    const dz = obj.z - playerPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > REACH) continue;
    const dot = dist > 0.01 ? (dx/dist)*dir.x + (dz/dist)*dir.z : 0;
    if (dot < 0.3) continue;
    if (obj.type === 'bush') { showHint('🍓 ЛКМ — съесть ягоды'); return; }
    if (obj.type === 'tree') { showHint('🪵 ЛКМ — рубить дерево (нужен 🪨)'); return; }
    if (obj.type === 'rock') { showHint('🪨 ЛКМ — добыть камень (нужен 🪨)'); return; }
  }
}

// ── Player movement & collision ────────────────────────────────────────────
const PLAYER_R = 0.4;
const SPEED    = 5;
const playerPos = new THREE.Vector3(0, 1.7, 0);

function resolveCollisions(pos) {
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const dist = Math.hypot(dx, dz);
    const min  = PLAYER_R + c.r;
    if (dist < min && dist > 0.001) {
      const push = (min - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
  pos.x = Math.max(-98, Math.min(98, pos.x));
  pos.z = Math.max(-98, Math.min(98, pos.z));
}

// ── Game loop ──────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let hintTick = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (mineCooldown > 0) mineCooldown -= dt;

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

    hintTick -= dt;
    if (hintTick <= 0) { updateNearbyHint(); hintTick = 0.3; }
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
