// ================================================================
// RENDERER
// ================================================================
var renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
var scene=new THREE.Scene();
scene.background=new THREE.Color(0x87CEEB);
scene.fog=new THREE.FogExp2(0x87CEEB,0.011);
var camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,0.1,300);
var gameStarted=false;
window.addEventListener('resize',function(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

// ================================================================
// LIGHTING
// ================================================================
var sun=new THREE.DirectionalLight(0xfff4d0,1.4);
sun.position.set(70,110,50); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=1; sun.shadow.camera.far=280;
sun.shadow.camera.left=-90; sun.shadow.camera.right=90;
sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xaaccff,0.5));
scene.add(new THREE.HemisphereLight(0x87CEEB,0x3d8b2a,0.4));

// ================================================================
// TEXTURES
// ================================================================
function mkTex(sz,fn,rx,ry){
  var c=document.createElement('canvas'); c.width=c.height=sz;
  fn(c.getContext('2d'),sz);
  var t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(rx||1,ry||rx||1);
  return t;
}
var TX={};
TX.grass=mkTex(128,function(ctx,s){
  ctx.fillStyle='#4a9e3a';ctx.fillRect(0,0,s,s);
  for(var i=0;i<1200;i++){ctx.fillStyle='hsl('+(108+Math.random()*22)+','+(48+~~(Math.random()*22))+'%,'+(24+~~(Math.random()*16))+'%)';ctx.fillRect(Math.random()*s,Math.random()*s,2,2);}
},22,22);
TX.rock=mkTex(64,function(ctx,s){
  ctx.fillStyle='#6e6e6e';ctx.fillRect(0,0,s,s);
  for(var i=0;i<500;i++){ctx.fillStyle='hsl(0,0%,'+(35+~~(Math.random()*28))+'%)';ctx.fillRect(Math.random()*s,Math.random()*s,2,2);}
},2,2);
TX.wood=mkTex(64,function(ctx,s){
  ctx.fillStyle='#7a4010';ctx.fillRect(0,0,s,s);
  for(var i=0;i<12;i++){ctx.strokeStyle='hsl(22,'+(38+~~(Math.random()*16))+'%,'+(16+~~(Math.random()*12))+'%)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,i*(s/12));ctx.lineTo(s,i*(s/12)+Math.random()*6-3);ctx.stroke();}
},2,3);
TX.leaf=mkTex(64,function(ctx,s){
  ctx.fillStyle='#2a7a1a';ctx.fillRect(0,0,s,s);
  for(var i=0;i<350;i++){ctx.fillStyle='hsl('+(108+~~(Math.random()*24))+','+(44+~~(Math.random()*22))+'%,'+(18+~~(Math.random()*18))+'%)';ctx.beginPath();ctx.arc(Math.random()*s,Math.random()*s,1+Math.random()*3,0,Math.PI*2);ctx.fill();}
},2,2);
TX.water=mkTex(128,function(ctx,s){
  ctx.fillStyle='#1a6fa8';ctx.fillRect(0,0,s,s);
  for(var i=0;i<300;i++){ctx.strokeStyle='rgba(255,255,255,'+(0.04+Math.random()*0.1)+')';ctx.lineWidth=1;ctx.beginPath();var y=Math.random()*s,x=Math.random()*s;ctx.moveTo(x,y);ctx.lineTo(x+12+Math.random()*18,y+Math.random()*3-1);ctx.stroke();}
},4,4);
TX.sand=mkTex(64,function(ctx,s){
  ctx.fillStyle='#c8a84b';ctx.fillRect(0,0,s,s);
  for(var i=0;i<400;i++){ctx.fillStyle='hsl(42,'+(38+~~(Math.random()*18))+'%,'+(50+~~(Math.random()*14))+'%)';ctx.fillRect(Math.random()*s,Math.random()*s,2,2);}
},3,3);
TX.bush=mkTex(32,function(ctx,s){
  ctx.fillStyle='#1e6b1e';ctx.fillRect(0,0,s,s);
  for(var i=0;i<150;i++){ctx.fillStyle='hsl('+(112+~~(Math.random()*18))+','+(48+~~(Math.random()*18))+'%,'+(16+~~(Math.random()*12))+'%)';ctx.beginPath();ctx.arc(Math.random()*s,Math.random()*s,1+Math.random()*2,0,Math.PI*2);ctx.fill();}
});

// ================================================================
// TERRAIN
// ================================================================
var ISLAND_R=78,SEA_Y=-1.5;
function terrainY(x,z){
  var d=Math.sqrt(x*x+z*z);
  var t=Math.max(0,Math.min(1,(d-55)/23));
  var fall=1-t*t*(3-2*t);
  var h=Math.sin(x*0.035)*Math.cos(z*0.035)*4.5+Math.sin(x*0.08+1.3)*Math.cos(z*0.07+0.9)*2.2+Math.sin(x*0.17+2.2)*Math.cos(z*0.14+1.6)*0.9+Math.sin(x*0.34)*Math.cos(z*0.31)*0.35;
  h=Math.max(h,-0.5);
  h=h*fall+(SEA_Y-0.5)*(1-fall);
  var ds=Math.sqrt(x*x+z*z);
  if(ds<12) h*=(ds/12)*(ds/12);
  return h;
}
var tGeo=new THREE.PlaneGeometry(200,200,80,80);
tGeo.rotateX(-Math.PI/2);
var tpa=tGeo.attributes.position;
for(var i=0;i<tpa.count;i++) tpa.setY(i,terrainY(tpa.getX(i),tpa.getZ(i)));
tGeo.computeVertexNormals();
var ground=new THREE.Mesh(tGeo,new THREE.MeshLambertMaterial({map:TX.grass}));
ground.receiveShadow=true; scene.add(ground);
var ocean=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshLambertMaterial({map:TX.water,transparent:true,opacity:0.88,color:0x1166aa}));
ocean.rotation.x=-Math.PI/2; ocean.position.y=SEA_Y; scene.add(ocean);
var beach=new THREE.Mesh(new THREE.RingGeometry(ISLAND_R-8,ISLAND_R+4,64),new THREE.MeshLambertMaterial({map:TX.sand,side:THREE.DoubleSide}));
beach.rotation.x=-Math.PI/2; beach.position.y=SEA_Y+0.05; scene.add(beach);
function onIsland(x,z,pad){return Math.sqrt(x*x+z*z)<ISLAND_R-(pad||8);}

// ================================================================
// WORLD OBJECTS
// ================================================================
var colliders=[],interactables=[],decoratives=[];
function removeObj(obj){
  if(obj.group) scene.remove(obj.group);
  if(obj.mesh)  scene.remove(obj.mesh);
  var i=interactables.indexOf(obj);if(i>-1)interactables.splice(i,1);
  i=colliders.indexOf(obj);if(i>-1)colliders.splice(i,1);
}
function spawnTree(x,z){
  var gy=terrainY(x,z),g=new THREE.Group();
  var trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.32,2.2,8),new THREE.MeshLambertMaterial({map:TX.wood}));
  trunk.position.y=1.1;trunk.castShadow=true;g.add(trunk);
  var lm=new THREE.MeshLambertMaterial({map:TX.leaf});
  [[1.6,3.2,3.6],[1.25,2.6,5.0]].forEach(function(v){var f=new THREE.Mesh(new THREE.ConeGeometry(v[0],v[1],8),lm);f.position.y=v[2];f.castShadow=true;g.add(f);});
  g.position.set(x,gy,z);scene.add(g);
  var obj={group:g,x:x,z:z,r:0.55,type:'tree',hp:5,onHit:function(){addItem({name:'Дерево',icon:'🪵',count:1});}};
  colliders.push(obj);interactables.push(obj);
}
function spawnRock(x,z){
  var gy=terrainY(x,z),sz=0.5+Math.random()*0.5;
  var mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(sz,1),new THREE.MeshLambertMaterial({map:TX.rock}));
  mesh.position.set(x,gy+sz*0.5,z);mesh.rotation.set(Math.random()*2,Math.random()*6,Math.random()*2);
  mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  var obj={mesh:mesh,x:x,z:z,r:sz+0.2,type:'rock',hp:4,onHit:function(){addItem({name:'Камень',icon:'🪨',count:1});}};
  colliders.push(obj);interactables.push(obj);
}
function spawnBush(x,z){
  var gy=terrainY(x,z),g=new THREE.Group();
  var bm=new THREE.MeshLambertMaterial({map:TX.bush});
  [[0,0,0,.7],[.5,.1,0,.55],[-.5,.05,0,.55],[0,.1,.5,.5],[0,.05,-.5,.5]].forEach(function(v){var b=new THREE.Mesh(new THREE.SphereGeometry(v[3],7,7),bm);b.position.set(v[0],v[1]+0.5,v[2]);g.add(b);});
  var bm2=new THREE.MeshLambertMaterial({color:0xdd1111});
  for(var i=0;i<8;i++){var a=(i/8)*Math.PI*2;var berry=new THREE.Mesh(new THREE.SphereGeometry(0.09,5,5),bm2);berry.position.set(Math.cos(a)*0.6,0.5+Math.random()*0.3,Math.sin(a)*0.6);g.add(berry);}
  g.position.set(x,gy,z);scene.add(g);
  var obj={group:g,x:x,z:z,r:0.85,type:'bush',hp:1,onHit:function(){addFood(28);addWater(12);showHint('🍓 +28 еды  +12 воды');}};
  colliders.push(obj);interactables.push(obj);
}
var pickups=[];
function spawnStone(x,z){
  var gy=terrainY(x,z);
  var mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(0.18,0),new THREE.MeshLambertMaterial({map:TX.rock,color:0xbbbbbb}));
  mesh.position.set(x,gy+0.22,z);mesh.castShadow=true;scene.add(mesh);
  var obj={mesh:mesh,x:x,z:z,r:0.6,type:'pickup'};
  interactables.push(obj);pickups.push(obj);
}
function spawnChest(cx,cz){
  var gy=terrainY(cx,cz),g=new THREE.Group();
  var body=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.5,0.5),new THREE.MeshLambertMaterial({map:TX.wood,color:0xc8a060}));
  body.position.y=0.25;body.castShadow=true;g.add(body);
  var lid=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.18,0.5),new THREE.MeshLambertMaterial({color:0x8b5a20}));
  lid.position.y=0.59;g.add(lid);
  var lock=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.06),new THREE.MeshLambertMaterial({color:0xddaa00}));
  lock.position.set(0,0.5,-0.28);g.add(lock);
  g.position.set(cx,gy,cz);scene.add(g);
  var obj={group:g,x:cx,z:cz,r:0.6,type:'chest',onHit:function(){
    addItem({name:'Бутылка воды',icon:'🍶',count:1});
    addItem({name:'Кусок мяса',icon:'🥩',count:1});
    addWater(50);addFood(50);showHint('📦 🍶 Вода + 🥩 Мясо');
  }};
  interactables.push(obj);
}
function spawnHouse(hx,hz,rot){
  var gy=terrainY(hx,hz),g=new THREE.Group();
  var W=8,D=7,H=3.5;
  var wm=new THREE.MeshLambertMaterial({map:TX.wood,color:0xd4a060});
  var rm=new THREE.MeshLambertMaterial({color:0x7a2e08});
  var fm=new THREE.MeshLambertMaterial({map:TX.wood,color:0xb07840});
  function bx(w,h,d,m,px,py,pz){var mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(px,py,pz);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);}
  bx(W,0.18,D,fm,0,0.09,0);
  bx(W,H,0.2,wm,0,H/2,D/2);
  bx(0.2,H,D,wm,-W/2,H/2,0);
  bx(0.2,H,D,wm,W/2,H/2,0);
  var dW=1.4,dH=2.6,sW=(W-dW)/2;
  bx(sW,H,0.2,wm,-(dW/2+sW/2),H/2,-D/2);
  bx(sW,H,0.2,wm,dW/2+sW/2,H/2,-D/2);
  bx(dW,H-dH,0.2,wm,0,dH+(H-dH)/2,-D/2);
  var rL=W+0.6;
  var r1=new THREE.Mesh(new THREE.BoxGeometry(rL,0.15,D/2+0.4),rm);r1.rotation.z=0.38;r1.position.set(-W/4-0.1,H+0.55,0);r1.castShadow=true;g.add(r1);
  var r2=new THREE.Mesh(new THREE.BoxGeometry(rL,0.15,D/2+0.4),rm);r2.rotation.z=-0.38;r2.position.set(W/4+0.1,H+0.55,0);r2.castShadow=true;g.add(r2);
  bx(rL,0.2,0.2,rm,0,H+1.1,0);
  g.position.set(hx,gy,hz);g.rotation.y=rot;scene.add(g);
  var cos=Math.cos(rot),sin=Math.sin(rot);
  function wc(lx,lz,r){colliders.push({x:hx+lx*cos-lz*sin,z:hz+lx*sin+lz*cos,r:r});}
  wc(0,D/2,0.8);wc(-W/2,0,0.8);wc(W/2,0,0.8);
  var sW2=(W-1.4)/2;
  wc(-(1.4/2+sW2/2),-D/2,0.6);wc(1.4/2+sW2/2,-D/2,0.6);
  spawnChest(hx+Math.cos(rot+0.3)*2,hz+Math.sin(rot+0.3)*2);
}
function spawnCloud(x,y,z){
  var g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:0xffffff});
  [[1.6,0,0,0],[1.3,1.4,.3,0],[1.1,-1.4,.2,0],[1.4,.5,.5,.9]].forEach(function(v){var c=new THREE.Mesh(new THREE.SphereGeometry(v[0],7,7),m);c.position.set(v[1],v[2],v[3]);g.add(c);});
  g.position.set(x,y,z);scene.add(g);return g;
}

// Populate
for(var i=0;i<65;i++){var px,pz,pt=0;do{px=(Math.random()-.5)*140;pz=(Math.random()-.5)*140;pt++;}while((!onIsland(px,pz,10)||Math.sqrt(px*px+pz*pz)<7)&&pt<40);spawnTree(px,pz);}
for(var i=0;i<38;i++){var px,pz,pt=0;do{px=(Math.random()-.5)*130;pz=(Math.random()-.5)*130;pt++;}while((!onIsland(px,pz,10)||Math.sqrt(px*px+pz*pz)<5)&&pt<40);spawnRock(px,pz);}
for(var i=0;i<28;i++){var px,pz,pt=0;do{px=(Math.random()-.5)*120;pz=(Math.random()-.5)*120;pt++;}while((!onIsland(px,pz,10)||Math.sqrt(px*px+pz*pz)<4)&&pt<40);spawnBush(px,pz);}
[[-3,4],[4,-3],[6,2],[-5,-4],[2,7],[-7,2],[5,5]].forEach(function(p){spawnStone(p[0],p[1]);});

// Flowers
var fcols=[0xff4466,0xffdd00,0xff8800,0xcc44ff,0xffffff];
for(var fi=0;fi<80;fi++){
  var fx,fz,ft=0;
  do{fx=(Math.random()-.5)*120;fz=(Math.random()-.5)*120;ft++;}while((!onIsland(fx,fz,12)||Math.sqrt(fx*fx+fz*fz)<5)&&ft<30);
  var fgy=terrainY(fx,fz),col=fcols[Math.floor(Math.random()*fcols.length)];
  var stem=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.22,4),new THREE.MeshLambertMaterial({color:0x228822}));
  stem.position.set(fx,fgy+0.11,fz);scene.add(stem);
  var petal=new THREE.Mesh(new THREE.SphereGeometry(0.1,5,4),new THREE.MeshLambertMaterial({color:col}));
  petal.position.set(fx,fgy+0.26,fz);scene.add(petal);
  decoratives.push({mesh:stem,x:fx,z:fz});decoratives.push({mesh:petal,x:fx,z:fz});
}

// Houses & paths
[[35,30,0],[-38,28,Math.PI*.5],[28,-40,Math.PI]].forEach(function(h){spawnHouse(h[0],h[1],h[2]);});
var ptm=new THREE.MeshLambertMaterial({color:0x9a6830,depthWrite:true});
[[0,0,35,30],[0,0,-38,28],[0,0,28,-40]].forEach(function(r){
  var dx=r[2]-r[0],dz=r[3]-r[1],len=Math.sqrt(dx*dx+dz*dz),ang=Math.atan2(dx,dz),steps=Math.ceil(len/0.9);
  for(var s=0;s<=steps;s++){var f=s/steps,ppx=r[0]+dx*f+(Math.random()-.5)*0.3,ppz=r[1]+dz*f+(Math.random()-.5)*0.3,gy=terrainY(ppx,ppz);var seg=new THREE.Mesh(new THREE.PlaneGeometry(1.3+Math.random()*.4,1.1+Math.random()*.3),ptm);seg.rotation.x=-Math.PI/2;seg.rotation.z=ang+(Math.random()-.5)*0.15;seg.position.set(ppx,gy+0.025,ppz);seg.receiveShadow=true;scene.add(seg);}
});
var clouds=[];
for(var i=0;i<18;i++) clouds.push(spawnCloud((Math.random()-.5)*160,16+Math.random()*10,(Math.random()-.5)*160));
