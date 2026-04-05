// ===================================================
// INIT
// ===================================================
var gameStarted = false;
var scene    = new THREE.Scene();
var camera   = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 500);
var renderer = new THREE.WebGLRenderer({ antialias:true });

scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 50, 150);

renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', function() {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ===================================================
// LIGHTING
// ===================================================
var sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(60, 100, 40);
sun.castShadow = true;
sun.shadow.camera.left = sun.shadow.camera.bottom = -80;
sun.shadow.camera.right = sun.shadow.camera.top = 80;
sun.shadow.camera.far = 250;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xaaccff, 0.6));
scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3d8b2a, 0.4));

// ===================================================
// TEXTURES (canvas-based)
// ===================================================
function makeTex(size, drawFn, rx, ry) {
  var c = document.createElement('canvas');
  c.width = c.height = size;
  drawFn(c.getContext('2d'), size);
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx||1, ry||rx||1);
  return t;
}

var grassTex = makeTex(128, function(ctx, s) {
  ctx.fillStyle='#4a9e3a'; ctx.fillRect(0,0,s,s);
  for(var i=0;i<1000;i++){
    ctx.fillStyle='hsl('+(108+Math.random()*20)+','+(48+Math.random()*20)+'%,'+(24+Math.random()*14)+'%)';
    ctx.fillRect(Math.random()*s,Math.random()*s,2,2);
  }
}, 20, 20);

var rockTex = makeTex(64, function(ctx, s) {
  ctx.fillStyle='#6e6e6e'; ctx.fillRect(0,0,s,s);
  for(var i=0;i<400;i++){
    ctx.fillStyle='hsl(0,0%,'+(35+Math.random()*28)+'%)';
    ctx.fillRect(Math.random()*s,Math.random()*s,2,2);
  }
}, 2, 2);

var woodTex = makeTex(64, function(ctx, s) {
  ctx.fillStyle='#7a4010'; ctx.fillRect(0,0,s,s);
  for(var i=0;i<10;i++){
    ctx.strokeStyle='hsl(22,'+(38+Math.random()*16)+'%,'+(16+Math.random()*12)+'%)';
    ctx.lineWidth=2; ctx.beginPath();
    ctx.moveTo(0,i*(s/10)); ctx.lineTo(s,i*(s/10)+Math.random()*6-3); ctx.stroke();
  }
}, 2, 3);

var leafTex = makeTex(64, function(ctx, s) {
  ctx.fillStyle='#2a7a1a'; ctx.fillRect(0,0,s,s);
  for(var i=0;i<300;i++){
    ctx.fillStyle='hsl('+(108+Math.random()*22)+','+(44+Math.random()*20)+'%,'+(18+Math.random()*16)+'%)';
    ctx.beginPath(); ctx.arc(Math.random()*s,Math.random()*s,1+Math.random()*2,0,Math.PI*2); ctx.fill();
  }
}, 2, 2);

var waterTex = makeTex(128, function(ctx, s) {
  ctx.fillStyle='#1a6fa8'; ctx.fillRect(0,0,s,s);
  for(var i=0;i<200;i++){
    ctx.strokeStyle='rgba(255,255,255,'+(0.04+Math.random()*0.1)+')';
    ctx.lineWidth=1; ctx.beginPath();
    var y=Math.random()*s, x=Math.random()*s;
    ctx.moveTo(x,y); ctx.lineTo(x+15+Math.random()*20,y+Math.random()*3-1); ctx.stroke();
  }
}, 4, 4);

var sandTex = makeTex(64, function(ctx, s) {
  ctx.fillStyle='#c8a84b'; ctx.fillRect(0,0,s,s);
  for(var i=0;i<300;i++){
    ctx.fillStyle='hsl(42,'+(38+Math.random()*18)+'%,'+(50+Math.random()*14)+'%)';
    ctx.fillRect(Math.random()*s,Math.random()*s,2,2);
  }
}, 3, 3);

var bushTex = makeTex(32, function(ctx, s) {
  ctx.fillStyle='#1e6b1e'; ctx.fillRect(0,0,s,s);
  for(var i=0;i<120;i++){
    ctx.fillStyle='hsl('+(112+Math.random()*18)+','+(48+Math.random()*18)+'%,'+(16+Math.random()*12)+'%)';
    ctx.beginPath(); ctx.arc(Math.random()*s,Math.random()*s,1+Math.random()*2,0,Math.PI*2); ctx.fill();
  }
});

// ===================================================
// TERRAIN  (island — land always above SEA_Y)
// ===================================================
var ISLAND_R = 78;
var SEA_Y    = -1.5;

function terrainY(x, z) {
  var d = Math.sqrt(x*x + z*z);
  // smoothstep falloff: land starts dropping at r=55, hits sea at r=78
  var t = Math.max(0, Math.min(1, (d - 55) / 23));
  var falloff = 1 - t*t*(3 - 2*t);
  var h = 0;
  h += Math.sin(x*0.035)*Math.cos(z*0.035)*4.5;
  h += Math.sin(x*0.08+1.3)*Math.cos(z*0.07+0.9)*2.2;
  h += Math.sin(x*0.17+2.2)*Math.cos(z*0.14+1.6)*0.9;
  h += Math.sin(x*0.34)*Math.cos(z*0.31)*0.35;
  // clamp base noise so inland is always above SEA_Y+0.5
  h = Math.max(h, -0.5);
  // apply falloff: coast blends to SEA_Y-0.5 (just below water)
  h = h * falloff + (SEA_Y - 0.5) * (1 - falloff);
  // flatten spawn area
  var ds = Math.sqrt(x*x+z*z);
  if(ds < 12) h *= (ds/12)*(ds/12);
  return h;
}

var tGeo = new THREE.PlaneGeometry(300,300,100,100);
tGeo.rotateX(-Math.PI/2);
var tp = tGeo.attributes.position;
for(var i=0;i<tp.count;i++) tp.setY(i, terrainY(tp.getX(i), tp.getZ(i)));
tGeo.computeVertexNormals();
var ground = new THREE.Mesh(tGeo, new THREE.MeshLambertMaterial({map:grassTex}));
ground.receiveShadow = true;
scene.add(ground);

// ── Ocean ──────────────────────────────────────────
var oceanMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600, 1, 1),
  new THREE.MeshLambertMaterial({map:waterTex, transparent:true, opacity:0.88, color:0x1166aa})
);
oceanMesh.rotation.x = -Math.PI/2;
oceanMesh.position.y = SEA_Y;
scene.add(oceanMesh);

// Sandy beach ring around island edge
var beachMesh = new THREE.Mesh(
  new THREE.RingGeometry(ISLAND_R - 8, ISLAND_R + 4, 64),
  new THREE.MeshLambertMaterial({map:sandTex, side:THREE.DoubleSide})
);
beachMesh.rotation.x = -Math.PI/2;
beachMesh.position.y = SEA_Y + 0.05;
scene.add(beachMesh);

// ── No lakes — ocean is the water source ──────────
var lakes = [];
function getLake(x, z) {
  // standing near shore (outside island) counts as water
  var d = Math.sqrt(x*x + z*z);
  if (d > ISLAND_R - 6) return {wy: SEA_Y};
  return null;
}

// ===================================================
// WORLD OBJECTS
// ===================================================
var colliders     = [];
var interactables = [];

function removeObj(obj) {
  if(obj.group) scene.remove(obj.group);
  if(obj.mesh)  scene.remove(obj.mesh);
  var i=interactables.indexOf(obj); if(i>-1) interactables.splice(i,1);
  i=colliders.indexOf(obj);         if(i>-1) colliders.splice(i,1);
}

function spawnTree(x,z) {
  var gy=terrainY(x,z);
  var g=new THREE.Group();
  var trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.32,2.2,8),new THREE.MeshLambertMaterial({map:woodTex}));
  trunk.position.y=1.1; trunk.castShadow=true; g.add(trunk);
  var lm=new THREE.MeshLambertMaterial({map:leafTex});
  [[1.6,3.2,3.6],[1.25,2.6,5.0]].forEach(function(v){
    var f=new THREE.Mesh(new THREE.ConeGeometry(v[0],v[1],8),lm);
    f.position.y=v[2]; f.castShadow=true; g.add(f);
  });
  g.position.set(x,gy,z); scene.add(g);
  var obj={group:g,x:x,z:z,r:0.55,type:'tree',hp:5,onHit:function(){addItem({name:'Дерево',icon:'🪵',count:1});}};
  colliders.push(obj); interactables.push(obj);
}

function spawnRock(x,z) {
  var gy=terrainY(x,z);
  var sz=0.5+Math.random()*0.5;
  var mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(sz,1),new THREE.MeshLambertMaterial({map:rockTex}));
  mesh.position.set(x,gy+sz*0.5,z);
  mesh.rotation.set(Math.random()*2,Math.random()*6,Math.random()*2);
  mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  var obj={mesh:mesh,x:x,z:z,r:sz+0.2,type:'rock',hp:4,onHit:function(){addItem({name:'Камень',icon:'🪨',count:1});}};
  colliders.push(obj); interactables.push(obj);
}

function spawnBush(x,z) {
  var gy=terrainY(x,z);
  var g=new THREE.Group();
  var bm=new THREE.MeshLambertMaterial({map:bushTex});
  [[0,0,0,.7],[.5,.1,0,.55],[-.5,.05,0,.55],[0,.1,.5,.5],[0,.05,-.5,.5]].forEach(function(v){
    var b=new THREE.Mesh(new THREE.SphereGeometry(v[3],7,7),bm);
    b.position.set(v[0],v[1]+0.5,v[2]); g.add(b);
  });
  var bm2=new THREE.MeshLambertMaterial({color:0xdd1111});
  for(var i=0;i<8;i++){
    var a=(i/8)*Math.PI*2;
    var berry=new THREE.Mesh(new THREE.SphereGeometry(0.09,5,5),bm2);
    berry.position.set(Math.cos(a)*0.6,0.5+Math.random()*0.3,Math.sin(a)*0.6);
    g.add(berry);
  }
  g.position.set(x,gy,z); scene.add(g);
  var obj={group:g,x:x,z:z,r:0.85,type:'bush',hp:1,onHit:function(){addFood(28);addWater(12);showHint('🍓 +28 еды  +12 воды');}};
  colliders.push(obj); interactables.push(obj);
}

var pickups=[];
function spawnStone(x,z) {
  var gy=terrainY(x,z);
  var mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(0.18,0),new THREE.MeshLambertMaterial({map:rockTex,color:0xbbbbbb}));
  mesh.position.set(x,gy+0.22,z); mesh.castShadow=true; scene.add(mesh);
  var obj={mesh:mesh,x:x,z:z,r:0.6,type:'pickup'};
  interactables.push(obj); pickups.push(obj);
}

function spawnCloud(x,y,z) {
  var g=new THREE.Group();
  var m=new THREE.MeshLambertMaterial({color:0xffffff});
  [[1.6,0,0,0],[1.3,1.4,.3,0],[1.1,-1.4,.2,0],[1.4,.5,.5,.9]].forEach(function(v){
    var c=new THREE.Mesh(new THREE.SphereGeometry(v[0],7,7),m);
    c.position.set(v[1],v[2],v[3]); g.add(c);
  });
  g.position.set(x,y,z); scene.add(g); return g;
}

function onIsland(x,z,pad){ return Math.sqrt(x*x+z*z) < ISLAND_R - (pad||8); }

// populate
for(var i=0;i<65;i++){
  var x,z,t=0;
  do{x=(Math.random()-.5)*140;z=(Math.random()-.5)*140;t++;}
  while((!onIsland(x,z,10)||Math.sqrt(x*x+z*z)<7)&&t<40);
  spawnTree(x,z);
}
for(var i=0;i<35;i++){
  var x,z,t=0;
  do{x=(Math.random()-.5)*130;z=(Math.random()-.5)*130;t++;}
  while((!onIsland(x,z,10)||Math.sqrt(x*x+z*z)<5)&&t<40);
  spawnRock(x,z);
}
for(var i=0;i<28;i++){
  var x,z,t=0;
  do{x=(Math.random()-.5)*120;z=(Math.random()-.5)*120;t++;}
  while((!onIsland(x,z,10)||Math.sqrt(x*x+z*z)<4)&&t<40);
  spawnBush(x,z);
}
[[-3,4],[4,-3],[6,2],[-5,-4],[2,7],[-7,2],[5,5]].forEach(function(p){spawnStone(p[0],p[1]);});

// ── Flowers ────────────────────────────────────────
var flowerColors=[0xff4466,0xffdd00,0xff8800,0xcc44ff,0xffffff];
for(var fi=0;fi<80;fi++){
  var fx,fz,ft=0;
  do{fx=(Math.random()-.5)*120;fz=(Math.random()-.5)*120;ft++;}
  while((!onIsland(fx,fz,12)||Math.sqrt(fx*fx+fz*fz)<5)&&ft<30);
  var fgy=terrainY(fx,fz);
  var col=flowerColors[Math.floor(Math.random()*flowerColors.length)];
  // stem
  var stem=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.22,4),new THREE.MeshLambertMaterial({color:0x228822}));
  stem.position.set(fx,fgy+0.11,fz);
  scene.add(stem);
  // petals
  var petal=new THREE.Mesh(new THREE.SphereGeometry(0.1,5,4),new THREE.MeshLambertMaterial({color:col}));
  petal.position.set(fx,fgy+0.26,fz);
  scene.add(petal);
}

// ── Blueprint item given at start — see slots[28] init in INVENTORY section

// ── Paths — organic dirt tiles hugging terrain ─────
var pathTileMat = new THREE.MeshLambertMaterial({color:0x9a6830, depthWrite:true});
var pathRoutes = [
  [[0,0],[35,30]],
  [[0,0],[-38,28]],
  [[0,0],[28,-40]],
];
pathRoutes.forEach(function(route){
  var x1=route[0][0],z1=route[0][1],x2=route[1][0],z2=route[1][1];
  var dx=x2-x1, dz=z2-z1;
  var len=Math.sqrt(dx*dx+dz*dz);
  var ang=Math.atan2(dx,dz);
  var steps=Math.ceil(len/0.9);
  for(var s=0;s<=steps;s++){
    var f=s/steps;
    var px=x1+dx*f + (Math.random()-0.5)*0.3;
    var pz=z1+dz*f + (Math.random()-0.5)*0.3;
    var gy=terrainY(px,pz);
    // vary tile size slightly for organic look
    var tw=1.3+Math.random()*0.4, td=1.1+Math.random()*0.3;
    var seg=new THREE.Mesh(new THREE.PlaneGeometry(tw,td),pathTileMat);
    seg.rotation.x=-Math.PI/2;
    seg.rotation.z=ang+(Math.random()-0.5)*0.15;
    seg.position.set(px, gy+0.025, pz);
    seg.receiveShadow=true;
    scene.add(seg);
  }
});

// ── Houses — 3 houses, spread far apart ────────────
var houseDefs=[
  {x:35,  z:30,  rot:0.0},
  {x:-38, z:28,  rot:Math.PI*0.5},
  {x:28,  z:-40, rot:Math.PI},
];
houseDefs.forEach(function(h){ spawnHouse(h.x,h.z,h.rot); });

function spawnHouse(hx,hz,rot){
  var gy=terrainY(hx,hz);
  var g=new THREE.Group();
  var W=8, D=7, H=3.5; // width, depth, wall height

  var wallMat=new THREE.MeshLambertMaterial({map:woodTex,color:0xd4a060});
  var roofMat=new THREE.MeshLambertMaterial({color:0x7a2e08});
  var floorMat=new THREE.MeshLambertMaterial({map:woodTex,color:0xb07840});

  // floor
  var fl=new THREE.Mesh(new THREE.BoxGeometry(W,0.18,D),floorMat);
  fl.position.y=0.09; fl.receiveShadow=true; g.add(fl);

  // back wall (solid)
  var wb=new THREE.Mesh(new THREE.BoxGeometry(W,H,0.2),wallMat);
  wb.position.set(0,H/2,D/2); wb.castShadow=true; g.add(wb);

  // left wall (solid)
  var wl=new THREE.Mesh(new THREE.BoxGeometry(0.2,H,D),wallMat);
  wl.position.set(-W/2,H/2,0); wl.castShadow=true; g.add(wl);

  // right wall (solid)
  var wr=new THREE.Mesh(new THREE.BoxGeometry(0.2,H,D),wallMat);
  wr.position.set(W/2,H/2,0); wr.castShadow=true; g.add(wr);

  // front wall — door gap 1.4 wide x 2.6 tall in center
  var doorW=1.4, doorH=2.6;
  var sideW=(W-doorW)/2;
  var wf1=new THREE.Mesh(new THREE.BoxGeometry(sideW,H,0.2),wallMat);
  wf1.position.set(-(doorW/2+sideW/2),H/2,-D/2); wf1.castShadow=true; g.add(wf1);
  var wf2=new THREE.Mesh(new THREE.BoxGeometry(sideW,H,0.2),wallMat);
  wf2.position.set(doorW/2+sideW/2,H/2,-D/2); wf2.castShadow=true; g.add(wf2);
  var wf3=new THREE.Mesh(new THREE.BoxGeometry(doorW,H-doorH,0.2),wallMat); // above door
  wf3.position.set(0,doorH+(H-doorH)/2,-D/2); wf3.castShadow=true; g.add(wf3);

  // roof — two slanted halves
  var roofLen=W+0.6;
  var r1=new THREE.Mesh(new THREE.BoxGeometry(roofLen,0.15,D/2+0.4),roofMat);
  r1.rotation.z=0.38; r1.position.set(-W/4-0.1,H+0.55,0); r1.castShadow=true; g.add(r1);
  var r2=new THREE.Mesh(new THREE.BoxGeometry(roofLen,0.15,D/2+0.4),roofMat);
  r2.rotation.z=-0.38; r2.position.set(W/4+0.1,H+0.55,0); r2.castShadow=true; g.add(r2);
  // ridge
  var ridge=new THREE.Mesh(new THREE.BoxGeometry(roofLen,0.2,0.2),roofMat);
  ridge.position.set(0,H+1.1,0); g.add(ridge);

  g.position.set(hx,gy,hz);
  g.rotation.y=rot;
  scene.add(g);

  // 4 wall colliders (skip door side — player can walk through)
  var cos=Math.cos(rot), sin=Math.sin(rot);
  function wc(lx,lz,r){ colliders.push({x:hx+lx*cos-lz*sin, z:hz+lx*sin+lz*cos, r:r}); }
  wc(0,  D/2,  0.8); // back
  wc(-W/2, 0,  0.8); // left
  wc( W/2, 0,  0.8); // right
  // front sides (not center door)
  wc(-(doorW/2+sideW/2), -D/2, 0.6);
  wc( (doorW/2+sideW/2), -D/2, 0.6);

  // chest inside
  spawnChest(hx+Math.cos(rot+0.3)*2, hz+Math.sin(rot+0.3)*2);
}

// ── Chests ─────────────────────────────────────────
function spawnChest(cx,cz){
  var gy=terrainY(cx,cz);
  var g=new THREE.Group();
  var body=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.5,0.5),new THREE.MeshLambertMaterial({map:woodTex,color:0xc8a060}));
  body.position.y=0.25; body.castShadow=true; g.add(body);
  var lid=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.18,0.5),new THREE.MeshLambertMaterial({color:0x8b5a20}));
  lid.position.y=0.59; lid.castShadow=true; g.add(lid);
  var lock=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.06),new THREE.MeshLambertMaterial({color:0xddaa00}));
  lock.position.set(0,0.5,-0.28); g.add(lock);
  g.position.set(cx,gy,cz);
  scene.add(g);
  var obj={group:g,x:cx,z:cz,r:0.6,type:'chest',
    onHit:function(){
      // always gives both water and food
      addItem({name:'Бутылка воды',icon:'🍶',count:1});
      addItem({name:'Кусок мяса',icon:'🥩',count:1});
      addWater(50); addFood(50);
      showHint('📦 🍶 Вода + 🥩 Мясо');
    }
  };
  interactables.push(obj);
}

var clouds=[];
for(var i=0;i<18;i++) clouds.push(spawnCloud((Math.random()-.5)*160,16+Math.random()*10,(Math.random()-.5)*160));

// ===================================================
// PLAYER MESH
// ===================================================
var pg = new THREE.Group();
scene.add(pg);

function mb(w,h,d,col){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color:col})); }

var pBody  = mb(0.5,0.62,0.28,0x3355cc); pBody.position.y=0.91;
var pHead  = mb(0.38,0.38,0.38,0xffcc99); pHead.position.y=1.40;
var pHair  = mb(0.41,0.11,0.41,0x553311); pHair.position.y=1.63;
var pLArm  = mb(0.18,0.56,0.18,0x3355cc); pLArm.position.set(-0.34,0.89,0);
var pRArm  = mb(0.18,0.56,0.18,0x3355cc); pRArm.position.set(0.34,0.89,0);
var pLLeg  = mb(0.22,0.56,0.22,0x334488); pLLeg.position.set(-0.13,0.28,0);
var pRLeg  = mb(0.22,0.56,0.22,0x334488); pRLeg.position.set(0.13,0.28,0);
var pLShoe = mb(0.24,0.1,0.27,0x221100);  pLShoe.position.set(-0.13,0.02,0.02);
var pRShoe = mb(0.24,0.1,0.27,0x221100);  pRShoe.position.set(0.13,0.02,0.02);

// Put player on layer 1 so main camera doesn't see it
[pBody,pHead,pHair,pLArm,pRArm,pLLeg,pRLeg,pLShoe,pRShoe].forEach(function(m){
  m.castShadow=true; m.layers.set(1); pg.add(m);
});
[-0.09,0.09].forEach(function(ox){
  var eye=mb(0.06,0.06,0.02,0x111111); eye.position.set(ox,1.42,0.2);
  eye.layers.set(1); pg.add(eye);
});
// Shadow camera sees layer 1
sun.shadow.camera.layers.enable(1);

// ── Viewmodel (first-person hand + tool) ──────────────
// Attached to camera, always rendered on layer 0
var viewmodel = new THREE.Group();
camera.add(viewmodel);
scene.add(camera); // camera must be in scene for children to render

// Hand — pale yellow-green, pointing forward (rotation.x = 0)
var vmHand = mb(0.12, 0.35, 0.12, 0xc8d87a);
vmHand.position.set(0.28, -0.30, -0.42);
vmHand.rotation.x = 0;
viewmodel.add(vmHand);

// Tool meshes for viewmodel
function makeToolGeo(name) {
  if (name === 'Кремень' || name === 'Камень') {
    // flat stone shape
    var g = new THREE.Group();
    var stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.07, 0),
      new THREE.MeshLambertMaterial({map: rockTex, color: 0xbbbbbb})
    );
    stone.position.set(0, 0.12, 0);
    g.add(stone);
    return g;
  }
  if (name === 'Кирка') {
    var g = new THREE.Group();
    // handle — вертикально
    var handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.34, 0.04),
      new THREE.MeshLambertMaterial({map: woodTex})
    );
    handle.position.y = 0.05;
    g.add(handle);
    // head — горизонтально вдоль Z (смотрит вперёд)
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.24),
      new THREE.MeshLambertMaterial({map: rockTex})
    );
    head.position.y = 0.22;
    g.add(head);
    // острый кончик вперёд
    var tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.1, 6),
      new THREE.MeshLambertMaterial({map: rockTex})
    );
    tip.rotation.x = Math.PI/2;
    tip.position.set(0, 0.22, 0.17);
    g.add(tip);
    return g;
  }
  if (name === 'Топор') {
    var g = new THREE.Group();
    // handle — вертикально вдоль Y
    var handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.34, 0.04),
      new THREE.MeshLambertMaterial({map: woodTex})
    );
    handle.position.y = 0.05;
    g.add(handle);
    // лезвие — широкое, смотрит вперёд (вдоль -Z)
    var blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.22, 0.18),
      new THREE.MeshLambertMaterial({map: rockTex, color: 0xaaaaaa})
    );
    blade.position.set(0, 0.27, -0.07);
    g.add(blade);
    // режущая кромка — тонкая, спереди
    var edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.24, 0.03),
      new THREE.MeshLambertMaterial({color: 0xdddddd})
    );
    edge.position.set(0, 0.27, -0.17);
    g.add(edge);
    return g;
  }
  return null;
}

var vmTool = null; // current tool group on viewmodel

function updateViewmodel() {
  // remove old
  if (vmTool) { viewmodel.remove(vmTool); vmTool = null; }
  var h = slots[activeSlot];
  if (!h || !h.tool) { vmHand.visible = false; return; }
  vmHand.visible = true;
  var g = makeToolGeo(h.name);
  if (g) {
    g.position.set(0.28, -0.30, -0.42);
    g.rotation.set(0, 0, 0);
    viewmodel.add(g);
    vmTool = g;
  }
}

// swing animation state for viewmodel
var vmSwing = 0;

// ===================================================
// STATS
// ===================================================
var S={hp:100,food:100,water:100,stamina:100};
var DRAIN=100/(20*60);

function setBar(id,v){ document.getElementById(id).style.width=Math.max(0,Math.min(100,v))+'%'; }
function syncBars(){ setBar('hp-bar',S.hp); setBar('food-bar',S.food); setBar('water-bar',S.water); setBar('stam-bar',S.stamina); }
function addFood(v){  S.food  =Math.min(100,S.food +v); syncBars(); }
function addWater(v){ S.water =Math.min(100,S.water+v); syncBars(); }

// ===================================================
// INVENTORY
// ===================================================
var slots=new Array(36).fill(null);
slots[27]={name:'Кремень',icon:'🪨',count:1,tool:true};
slots[28]={name:'План постройки',icon:'📋',count:1,blueprint:true};

function addItem(item){
  if(!item.tool){
    for(var i=0;i<36;i++){
      if(slots[i]&&slots[i].name===item.name){slots[i].count+=item.count;renderAll();showHint('+'+item.count+' '+item.icon+' '+item.name);return;}
    }
  }
  for(var i=0;i<36;i++){
    if(!slots[i]){slots[i]={name:item.name,icon:item.icon,count:item.count,tool:!!item.tool};renderAll();showHint('+'+item.count+' '+item.icon+' '+item.name);return;}
  }
  showHint('Инвентарь полон!');
}

function countItem(name){ var n=0; for(var i=0;i<36;i++) if(slots[i]&&slots[i].name===name) n+=slots[i].count; return n; }
function consumeItem(name,n){
  var left=n;
  for(var i=0;i<36&&left>0;i++){
    if(slots[i]&&slots[i].name===name){var t=Math.min(slots[i].count,left);slots[i].count-=t;left-=t;if(slots[i].count<=0)slots[i]=null;}
  }
}

var RECIPES=[
  {name:'Кирка',icon:'⛏️',tool:true,count:1,color:0x999999,needs:[{name:'Камень',count:2},{name:'Дерево',count:2}]},
  {name:'Топор',icon:'🪓',tool:true,count:1,color:0x8B4513,needs:[{name:'Камень',count:1},{name:'Дерево',count:3}]},
  {name:'Пол',icon:'🟫',count:4,build:true,needs:[{name:'Дерево',count:2}]},
];

// ── Build system ────────────────────────────────────
var buildPreview = new THREE.Mesh(
  new THREE.BoxGeometry(1,0.15,1),
  new THREE.MeshLambertMaterial({color:0x8B4513, transparent:true, opacity:0.45})
);
buildPreview.visible = false;
scene.add(buildPreview);

var buildBlocks = [];

function getBuildPos(){
  var fwd = new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  var bx = Math.round(pPos.x + fwd.x*2.2);
  var bz = Math.round(pPos.z + fwd.z*2.2);
  var by = terrainY(bx,bz);
  return {x:bx, y:by, z:bz};
}

function placeBuildBlock(){
  if(countItem('Пол') < 1){ showHint('Нет плиток Пол!'); return; }
  var bp = getBuildPos();
  var mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1,0.15,1),
    new THREE.MeshLambertMaterial({color:0x8B4513})
  );
  mesh.position.set(bp.x, bp.y+0.075, bp.z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  buildBlocks.push(mesh);
  // add collider so player can walk on it
  colliders.push({x:bp.x, z:bp.z, r:0.55});
  consumeItem('Пол',1);
  renderAll();
  showHint('🟫 Пол размещён');
}

function tryCraft(r){
  for(var i=0;i<r.needs.length;i++){if(countItem(r.needs[i].name)<r.needs[i].count){showHint('Нужно: '+r.needs[i].count+'× '+r.needs[i].name);return;}}
  r.needs.forEach(function(n){consumeItem(n.name,n.count);});
  addItem({name:r.name,icon:r.icon,count:r.count,tool:!!r.tool,build:!!r.build});
  renderAll(); renderCraft();
}

function toolDmg(type){
  var h=slots[activeSlot]; if(!h) return 0;
  if(type==='tree'){ if(h.name==='Топор') return 2; if(h.name==='Кремень'||h.name==='Камень') return 1; }
  if(type==='rock'){ if(h.name==='Кирка') return 2; if(h.name==='Кремень'||h.name==='Камень') return 1; }
  if(type==='bush'||type==='pickup') return 1;
  return 0;
}

// ===================================================
// UI
// ===================================================
var activeSlot=27, invOpen=false, dragFrom=null;
var allEls=[], mirrorEls=[];

function buildSlot(idx,num){
  var el=document.createElement('div');
  el.className='slot';
  el.innerHTML=(num!==undefined?'<span class="slot-num">'+num+'</span>':'')+
    '<span class="slot-icon"></span><span class="slot-cnt"></span>';
  if(idx>=27) el.addEventListener('click',function(){if(!invOpen)setActive(idx);});
  el.addEventListener('mousedown',function(e){
    if(!invOpen||e.button!==0||!slots[idx]) return;
    dragFrom=idx;
    var g=document.getElementById('drag-ghost');
    g.textContent=slots[idx].icon; g.style.display='block';
    e.preventDefault();
  });
  el.addEventListener('mouseenter',function(){if(dragFrom!==null)el.classList.add('hover');});
  el.addEventListener('mouseleave',function(){el.classList.remove('hover');});
  el.addEventListener('mouseup',function(){
    if(dragFrom!==null&&dragFrom!==idx){var tmp=slots[idx];slots[idx]=slots[dragFrom];slots[dragFrom]=tmp;renderAll();}
    el.classList.remove('hover'); endDrag();
  });
  return el;
}

var hotbarEl=document.getElementById('hotbar');
for(var i=27;i<36;i++){var el=buildSlot(i,i-26);allEls[i]=el;hotbarEl.appendChild(el);}

var invGrid=document.getElementById('inv-grid');
for(var i=0;i<27;i++){var el=buildSlot(i);allEls[i]=el;invGrid.appendChild(el);}

var invHbar=document.getElementById('inv-hotbar');
for(var i=27;i<36;i++){var el=buildSlot(i,i-26);mirrorEls[i]=el;invHbar.appendChild(el);}

document.addEventListener('mouseup',endDrag);
document.addEventListener('mousemove',function(e){
  if(dragFrom!==null){var g=document.getElementById('drag-ghost');g.style.left=e.clientX+'px';g.style.top=e.clientY+'px';}
});

function endDrag(){
  dragFrom=null;
  document.getElementById('drag-ghost').style.display='none';
  document.querySelectorAll('.hover').forEach(function(el){el.classList.remove('hover');});
}

function renderSlot(el,item){
  if(!el) return;
  el.querySelector('.slot-icon').textContent=item?item.icon:'';
  el.querySelector('.slot-cnt').textContent=(item&&item.count>1)?item.count:'';
  el.title=item?item.name+' ×'+item.count:'';
}

function renderAll(){
  for(var i=0;i<36;i++){renderSlot(allEls[i],slots[i]);if(i>=27)renderSlot(mirrorEls[i],slots[i]);}
  for(var i=27;i<36;i++){if(allEls[i])allEls[i].classList.toggle('active',i===activeSlot);}
  updateViewmodel();
  renderCraft();
}

function setActive(i){activeSlot=i;renderAll();}

function renderCraft(){
  var cl=document.getElementById('craft-list'); if(!cl) return;
  cl.innerHTML='';
  RECIPES.forEach(function(r){
    var ok=r.needs.every(function(n){return countItem(n.name)>=n.count;});
    var d=document.createElement('div'); d.className='recipe'+(ok?' can':'');
    d.innerHTML='<span style="font-size:22px">'+r.icon+'</span>'+
      '<span class="recipe-name">'+r.name+'<br><span class="recipe-req">'+
      r.needs.map(function(n){return n.count+'× '+n.name;}).join(', ')+'</span></span>'+
      '<button class="craft-btn"'+(ok?'':' disabled')+'>Крафт</button>';
    d.querySelector('.craft-btn').addEventListener('click',function(){tryCraft(r);});
    cl.appendChild(d);
  });
}

function toggleInv(){
  invOpen=!invOpen;
  document.getElementById('inv-bg').style.display=invOpen?'flex':'none';
  if(invOpen){renderCraft();document.exitPointerLock();}
  else renderer.domElement.requestPointerLock();
}

renderAll();

// ===================================================
// HINT
// ===================================================
var hintTimer=null;
function showHint(msg){
  var el=document.getElementById('hint');
  el.textContent=msg; el.style.opacity='1';
  clearTimeout(hintTimer);
  hintTimer=setTimeout(function(){el.style.opacity='0';},2400);
}

// ===================================================
// INPUT
// ===================================================
var keys={};
document.addEventListener('keydown',function(e){
  keys[e.code]=true;
  if(e.code.startsWith('Digit')){var n=parseInt(e.key);if(n>=1&&n<=9)setActive(26+n);}
  if(e.code==='KeyE') toggleInv();
  if(e.code==='KeyF'&&!invOpen) tryDrink();
  if(e.code==='Space'&&!invOpen){e.preventDefault();tryJump();}
});
document.addEventListener('keyup',function(e){keys[e.code]=false;});

var yaw=0,pitch=0;
renderer.domElement.addEventListener('click',function(){if(!invOpen&&gameStarted&&CTRL==='pc')renderer.domElement.requestPointerLock();});
document.addEventListener('mousemove',function(e){
  if(document.pointerLockElement!==renderer.domElement) return;
  yaw-=e.movementX*0.002; pitch-=e.movementY*0.002;
  pitch=Math.max(-1.1,Math.min(1.1,pitch));
});
document.addEventListener('mousedown',function(e){
  if(invOpen) return;
  if(document.pointerLockElement!==renderer.domElement) return;
  if(e.button===2){ // right click — place build block
    var h=slots[activeSlot];
    if(h&&h.build) placeBuildBlock();
    return;
  }
  if(e.button!==0) return;
  tryAction();
});

// ===================================================
// PHYSICS
// ===================================================
var PLAYER_R=0.42, EYE_H=1.72, WALK=4.5, RUN=8.5, JUMP=6.8, GRAV=20;
var pPos=new THREE.Vector3(0,EYE_H,0);
var velY=0, onGround=false, swimming=false, swimLake=null;

function tryJump(){
  if(onGround&&!swimming){velY=JUMP;onGround=false;}
  else if(swimming){velY=3.5;}
}
function tryDrink(){
  var l=getLake(pPos.x,pPos.z);
  if(l){addWater(40);showHint('💧 +40 воды');}
  else showHint('Подойди к озеру и нажми F');
}
function resolveCol(pos){
  for(var i=0;i<colliders.length;i++){
    var c=colliders[i];
    var dx=pos.x-c.x,dz=pos.z-c.z;
    var d=Math.sqrt(dx*dx+dz*dz),min=PLAYER_R+c.r;
    if(d<min&&d>0.001){var p=(min-d)/d;pos.x+=dx*p;pos.z+=dz*p;}
  }
  pos.x=Math.max(-97,Math.min(97,pos.x));
  pos.z=Math.max(-97,Math.min(97,pos.z));
}

// ===================================================
// INTERACTION
// ===================================================
var REACH=4.5, cooldown=0, swingT=0;

function getAimed(){
  var dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  var best=null,bestDot=0.42;
  for(var i=0;i<interactables.length;i++){
    var obj=interactables[i];
    var dx=obj.x-pPos.x,dz=obj.z-pPos.z;
    var dist=Math.sqrt(dx*dx+dz*dz);
    if(dist>REACH||dist<0.01) continue;
    var dot=(dx/dist)*dir.x+(dz/dist)*dir.z;
    if(dot>bestDot){bestDot=dot;best=obj;}
  }
  return best;
}

function tryAction(){
  if(cooldown>0) return;
  var obj=getAimed(); if(!obj) return;

  if(obj.type==='chest'){
    obj.onHit();
    var bx=obj.x,bz=obj.z; removeObj(obj);
    cooldown=0.4; swingT=1; return;
  }
  if(obj.type==='pickup'){
    addItem({name:'Камень',icon:'🪨',count:1});
    scene.remove(obj.mesh);
    var i=interactables.indexOf(obj);if(i>-1)interactables.splice(i,1);
    i=pickups.indexOf(obj);if(i>-1)pickups.splice(i,1);
    cooldown=0.25; return;
  }
  if(obj.type==='bush'){
    obj.onHit();
    var bx=obj.x,bz=obj.z; removeObj(obj);
    setTimeout(function(){spawnBush(bx,bz);},12000);
    cooldown=0.5; swingT=1; return;
  }
  var dmg=toolDmg(obj.type);
  if(dmg===0){
    showHint(obj.type==='tree'?'🪓 Нужен Кремень или Топор':'⛏️ Нужен Кремень или Кирка');
    return;
  }
  obj.hp-=dmg; cooldown=0.38; swingT=1;
  var meshes=obj.group?obj.group.children:[obj.mesh];
  meshes.forEach(function(m){if(m.material&&m.material.emissive)m.material.emissive.setRGB(0.5,0.25,0);});
  setTimeout(function(){meshes.forEach(function(m){if(m.material&&m.material.emissive)m.material.emissive.setRGB(0,0,0);});},130);
  if(obj.hp<=0){
    obj.onHit();
    var bx=obj.x,bz=obj.z,bt=obj.type; removeObj(obj);
    setTimeout(function(){if(bt==='tree')spawnTree(bx,bz);else spawnRock(bx,bz);},bt==='tree'?22000:16000);
  }
}

var hintTick=0;
function updateHint(){
  var hh=slots[activeSlot];
  if(hh&&hh.build){ showHint('🟫 ПКМ — разместить '+hh.name); return; }
  var obj=getAimed(); if(!obj) return;
  var map={tree:'🪵 ЛКМ — рубить (Кремень/Топор)',rock:'🪨 ЛКМ — добыть (Кремень/Кирка)',bush:'🍓 ЛКМ — съесть ягоды',pickup:'🪨 ЛКМ — подобрать камень',chest:'📦 ЛКМ — открыть ящик'};
  if(map[obj.type]) showHint(map[obj.type]);
}

// ===================================================
// GAME LOOP
// ===================================================
var clock=new THREE.Clock(), walkT=0;

function animate(){
  requestAnimationFrame(animate);
  var dt=Math.min(clock.getDelta(),0.05);
  if(!gameStarted){ renderer.render(scene,camera); return; }
  if(cooldown>0) cooldown-=dt;

  if(!invOpen){
    var sprint=(keys['ShiftLeft']||keys['ShiftRight'])&&S.stamina>0;
    var spd=sprint?RUN:WALK;
    if(sprint) S.stamina=Math.max(0,S.stamina-dt*20);
    else       S.stamina=Math.min(100,S.stamina+dt*12);

    var fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    var rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    var mv=new THREE.Vector3();
    if(keys['KeyW']||keys['ArrowUp'])    mv.add(fwd);
    if(keys['KeyS']||keys['ArrowDown'])  mv.sub(fwd);
    if(keys['KeyA']||keys['ArrowLeft'])  mv.sub(rgt);
    if(keys['KeyD']||keys['ArrowRight']) mv.add(rgt);
    var moving=mv.lengthSq()>0;
    if(moving){mv.normalize().multiplyScalar(spd*dt);pPos.x+=mv.x;pPos.z+=mv.z;resolveCol(pPos);walkT+=dt*(sprint?2.4:1.5);}

    swimLake=getLake(pPos.x,pPos.z); swimming=!!swimLake;
    if(swimming){
      var ty=swimLake.wy+0.9; pPos.y+=(ty-pPos.y)*9*dt; velY=0; onGround=false;
    } else {
      velY-=GRAV*dt; pPos.y+=velY*dt;
      var floor=terrainY(pPos.x,pPos.z)+EYE_H;
      if(pPos.y<=floor){pPos.y=floor;velY=0;onGround=true;}else onGround=false;
    }

    S.food =Math.max(0,S.food -DRAIN*dt);
    S.water=Math.max(0,S.water-DRAIN*dt*1.25);
    if(S.food<=0||S.water<=0) S.hp=Math.max(0,S.hp-dt*0.7);
    syncBars();

    hintTick-=dt; if(hintTick<=0){updateHint();hintTick=0.22;}

    pg.position.set(pPos.x,pPos.y-EYE_H,pPos.z);
    pg.rotation.y=yaw+Math.PI;

    if(moving&&onGround){
      pLLeg.rotation.x= Math.sin(walkT*3.6)*0.6;
      pRLeg.rotation.x=-Math.sin(walkT*3.6)*0.6;
      pLArm.rotation.x=-Math.sin(walkT*3.6)*0.5;
      pRArm.rotation.x= Math.sin(walkT*3.6)*0.5;
    } else {
      pLLeg.rotation.x=THREE.MathUtils.lerp(pLLeg.rotation.x,0,0.18);
      pRLeg.rotation.x=THREE.MathUtils.lerp(pRLeg.rotation.x,0,0.18);
      pLArm.rotation.x=THREE.MathUtils.lerp(pLArm.rotation.x,0,0.18);
      pRArm.rotation.x=THREE.MathUtils.lerp(pRArm.rotation.x,0,0.18);
    }
    if(swingT>0){
      swingT=Math.max(0,swingT-dt*5);
      pRArm.rotation.x=-Math.sin(swingT*Math.PI)*1.5;
      // viewmodel swing — качаем вниз-вперёд
      var sw=Math.sin(swingT*Math.PI);
      vmHand.position.y = -0.30 - sw*0.12;
      vmHand.position.z = -0.42 - sw*0.06;
      if(vmTool){ vmTool.position.y = -0.30 - sw*0.12; vmTool.position.z = -0.42 - sw*0.06; }
    } else {
      vmHand.position.y = THREE.MathUtils.lerp(vmHand.position.y, -0.30, 0.18);
      vmHand.position.z = THREE.MathUtils.lerp(vmHand.position.z, -0.42, 0.18);
      if(vmTool){ vmTool.position.y = THREE.MathUtils.lerp(vmTool.position.y, -0.30, 0.18); vmTool.position.z = THREE.MathUtils.lerp(vmTool.position.z, -0.42, 0.18); }
    }
    pBody.rotation.x=THREE.MathUtils.lerp(pBody.rotation.x,swimming?-0.55:0,0.12);
    document.getElementById('swim-fx').style.display=swimming?'block':'none';
  }

  for(var i=0;i<clouds.length;i++){clouds[i].position.x+=dt*(0.4+i*0.035);if(clouds[i].position.x>85)clouds[i].position.x=-85;}
  waterTex.offset.x+=dt*0.008; waterTex.offset.y+=dt*0.004;
  // build preview
  var heldItem = slots[activeSlot];
  if(!invOpen && heldItem && heldItem.build){
    var bp = getBuildPos();
    buildPreview.position.set(bp.x, bp.y+0.075, bp.z);
    buildPreview.visible = true;
  } else {
    buildPreview.visible = false;
  }

  oceanMesh.position.y = SEA_Y + Math.sin(Date.now()*0.001)*0.04;

  camera.position.copy(pPos);
  camera.rotation.order='YXZ';
  camera.rotation.y=yaw;
  camera.rotation.x=pitch;
  renderer.render(scene,camera);
}

animate();

// ===================================================
// MOBILE CONTROLS
// ===================================================
var mobileJoy = {x:0, y:0};
var lookActive = false, lookLastX=0, lookLastY=0;

function initMobile() {
  var zone   = document.getElementById('joystick-zone');
  var knob   = document.getElementById('joystick-knob');
  var look   = document.getElementById('look-zone');
  var btnJ   = document.getElementById('btn-jump');
  var btnA   = document.getElementById('btn-action');
  var btnI   = document.getElementById('btn-inv');

  var jActive=false, jId=-1, jOx=0, jOy=0;

  zone.addEventListener('touchstart',function(e){
    e.preventDefault();
    var t=e.changedTouches[0];
    jActive=true; jId=t.identifier;
    var r=zone.getBoundingClientRect();
    jOx=r.left+r.width/2; jOy=r.top+r.height/2;
  },{passive:false});

  zone.addEventListener('touchmove',function(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.identifier!==jId) continue;
      var dx=t.clientX-jOx, dy=t.clientY-jOy;
      var len=Math.sqrt(dx*dx+dy*dy), max=48;
      if(len>max){dx=dx/len*max;dy=dy/len*max;}
      mobileJoy.x=dx/max; mobileJoy.y=dy/max;
      knob.style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))';
    }
  },{passive:false});

  function jEnd(e){
    e.preventDefault();
    mobileJoy.x=0; mobileJoy.y=0;
    knob.style.transform='translate(-50%,-50%)';
    jActive=false;
  }
  zone.addEventListener('touchend',jEnd,{passive:false});
  zone.addEventListener('touchcancel',jEnd,{passive:false});

  // Look zone
  var lId=-1;
  look.addEventListener('touchstart',function(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      var r=zone.getBoundingClientRect();
      // ignore if touch is over joystick area
      if(t.clientX>r.left&&t.clientX<r.right&&t.clientY>r.top&&t.clientY<r.bottom) continue;
      if(lId===-1){lId=t.identifier;lookLastX=t.clientX;lookLastY=t.clientY;}
    }
  },{passive:false});
  look.addEventListener('touchmove',function(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.identifier!==lId) continue;
      var dx=t.clientX-lookLastX, dy=t.clientY-lookLastY;
      yaw-=dx*0.004; pitch-=dy*0.004;
      pitch=Math.max(-1.1,Math.min(1.1,pitch));
      lookLastX=t.clientX; lookLastY=t.clientY;
    }
  },{passive:false});
  look.addEventListener('touchend',function(e){
    for(var i=0;i<e.changedTouches.length;i++) if(e.changedTouches[i].identifier===lId) lId=-1;
  },{passive:false});

  btnJ.addEventListener('touchstart',function(e){e.preventDefault();tryJump();},{passive:false});
  btnA.addEventListener('touchstart',function(e){e.preventDefault();tryAction();},{passive:false});
  btnI.addEventListener('touchstart',function(e){e.preventDefault();toggleInv();},{passive:false});

  // Override movement to use joystick
  window._mobileMode = true;
}

// Patch animate to use joystick when mobile
var _origAnimate = animate;
// inject mobile joy into keys-like movement inside animate
// We do it by overriding the mv calculation via mobileJoy
// The animate loop already reads keys[], so we fake keys via joystick:
var _mobileInterval = setInterval(function(){
  if(!window._mobileMode) return;
  keys['KeyW'] = mobileJoy.y < -0.2;
  keys['KeyS'] = mobileJoy.y >  0.2;
  keys['KeyA'] = mobileJoy.x < -0.2;
  keys['KeyD'] = mobileJoy.x >  0.2;
}, 16);
