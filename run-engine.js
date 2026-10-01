// Crash Test Daggie — RUN mode engine. Level-specific data comes from window.LEVEL (see level-*.js).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const ASSETS = { model: 'daggie_model.bin?v=1', tex: 'daggie_tex.jpg?v=1' };

window.__daggieStarted = true;
// the level being played (set by run.html from a level file listed in levels.js)
const L = window.LEVEL;
const TH = L.theme || 'sky', VEH = L.vehicle || 'skate', MODE = L.mode || 'run'; // world look and what Daggie rides
const CART_S = 1.35; // the player's cart is scaled up so a life-size robot can sit in it
const V3 = THREE.Vector3, TAU = Math.PI * 2, Y = new V3(0, 1, 0);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const FONT = '"Chakra Petch", ui-sans-serif, system-ui, sans-serif';
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const $ = id => document.getElementById(id);
const setLoad = (p, txt) => { $('loadBar').style.width = Math.round(p * 100) + '%'; if (txt) $('loadTxt').textContent = txt; };

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const PR = Math.min(2, window.devicePixelRatio || 1);
renderer.setPixelRatio(PR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.74;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 5000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.15, 0.3, 1.0));
composer.addPass(new OutputPass());
// colour grade: punchier contrast and saturation so the feed thumbnail pops
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, sat: { value: 1.32 }, con: { value: 1.12 }, bri: { value: 0.01 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float sat, con, bri; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); vec3 col = mix(vec3(l), c.rgb, sat); float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b)); col = mix(vec3(dot(col, vec3(0.333))), col, 1.0 + 0.25 * (1.0 - (mx - mn))); col = (col - 0.5) * con + 0.5 + bri; gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }' });
composer.addPass(grade);
// "Rec mode" (for iPhone screen recording): punchier picture, no UI while riding, lighter shadows for smoothness
let REC_MODE = false; try { REC_MODE = localStorage.getItem('daggie-recmode') === '1'; } catch (e) {}
const GSAT = () => REC_MODE ? 1.6 : 1.32;
function applyRecMode() {
  grade.uniforms.sat.value = GSAT(); grade.uniforms.con.value = REC_MODE ? 1.18 : 1.12; grade.uniforms.bri.value = REC_MODE ? 0.03 : 0.01;
  renderer.toneMappingExposure = REC_MODE ? 0.9 : 0.74;
  const ms = REC_MODE ? 1024 : 2048;
  if (typeof sunLight !== 'undefined' && sunLight.shadow.mapSize.x !== ms) { sunLight.shadow.mapSize.set(ms, ms); if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; } }
  document.getElementById('stage').classList.toggle('recmode', REC_MODE);
  if (typeof resize === 'function' && typeof camera !== 'undefined') try { resize(); } catch (e) {}
}
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const glowColor = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
function neon(hex, k) { return new THREE.MeshBasicMaterial({ color: glowColor(hex, k) }); }

// ---------- sky, sun, clouds ----------
const SUN = new V3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(TH === 'city' ? 77 : 58), THREE.MathUtils.degToRad(TH === 'city' ? 22 : 35));
function makeSky() { const s = new Sky(); s.scale.setScalar(4000); const u = s.material.uniforms; u.turbidity.value = TH === 'city' ? 7 : 2.0; u.rayleigh.value = TH === 'city' ? 2.6 : 1.7; u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.8; u.sunPosition.value.copy(SUN); return s; }
scene.add(makeSky());
{ const envScene = new THREE.Scene(); envScene.add(makeSky()); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0).texture; }
scene.fog = TH === 'city' ? new THREE.Fog(0xe9b996, 170, 1300) : new THREE.Fog(0xcbe0f6, 520, 2600);
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x9aa3b5, 0.85); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(TH === 'city' ? 0xffc48a : 0xfff1dc, TH === 'city' ? 3.3 : 3.8);
sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 80 });
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.02;
scene.add(sunLight, sunLight.target);
function cloudTexture(seed) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return tex(512, 320, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = w * (0.18 + 0.64 * r()), y = h * (0.42 + 0.3 * r()) - (1 - Math.abs(x / w - 0.5) * 2) * h * 0.18, rad = 30 + 70 * r() * (1 - Math.abs(x / w - 0.5));
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(255,255,255,1)'); sh.addColorStop(0.55, 'rgba(236,242,250,1)'); sh.addColorStop(1, 'rgba(176,196,222,1)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
  });
}
const CLOUD_TEX = [1, 7, 23, 51, 97].map(cloudTexture);
const clouds = new THREE.Group(); scene.add(clouds);
function cloud(x, y, z, sc, op) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: pick(CLOUD_TEX), transparent: true, depthWrite: false, opacity: op ?? 1, fog: true })); m.position.set(x, y, z); m.scale.set(sc, sc * 0.62, 1); clouds.add(m); return m; }
if (TH === 'sky') {
for (let i = 0; i < 110; i++) { const z = rand(80, -900), x = rand(-320, 320); cloud(x, rand(-78, -60), z, rand(60, 110)); }
for (let i = 0; i < 26; i++) { const side = Math.random() < 0.5 ? -1 : 1; cloud(side * rand(140, 420), rand(-20, 60), rand(-150, -1100), rand(140, 280), 0.95).material.fog = false; }
for (let i = 0; i < 8; i++) cloud(rand(-200, 200), rand(150, 260), rand(-500, -1200), rand(160, 240), 0.8).material.fog = false;
{ const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0xf2f6fb, roughness: 1, map: tex(512, 512, (g, w, h) => { g.fillStyle = '#e9eff7'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { const x = Math.random() * w, y = Math.random() * h, rr = 8 + Math.random() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } }, [14, 14]) }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -80, -300); scene.add(sea); }
}
// evening city: skyline of lit windows around the rooftop track
function windowTex(lit) {
  const t = tex(256, 256, (g, w, h) => {
    g.fillStyle = lit ? '#000000' : '#6f5d57'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
      const on = ((x * 7 + y * 13) % 5 === 0) || ((x + y * 3) % 7 === 0);
      g.fillStyle = lit ? (on ? '#ffcf7a' : '#000000') : (on ? '#f3d9a4' : '#2c3342');
      g.fillRect(x * 64 + 12, y * 32 + 7, 40, 19);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const WIN_TEX = TH === 'city' ? windowTex(false) : null, WIN_LIT = TH === 'city' ? windowTex(true) : null;
function facadeMat(w, h) {
  const m = WIN_TEX.clone(), e = WIN_LIT.clone(); m.needsUpdate = e.needsUpdate = true; m.repeat.set(w / 8, h / 8); e.repeat.set(w / 8, h / 8);
  return new THREE.MeshStandardMaterial({ map: m, emissiveMap: e, emissive: 0xffb45a, emissiveIntensity: 0.9, roughness: 0.85 });
}
function buildCity() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x3a3740, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -46, -300); scene.add(ground);
  const geos = [];
  for (let i = 0; i < 260; i++) {
    const side = Math.random() < 0.5 ? -1 : 1, x = side * rand(14, 280), z = rand(80, -1150);
    const w = rand(10, 30), d = rand(10, 30), top = Math.random() < 0.25 ? rand(8, 70) : rand(-32, 6), h = top + 46;
    const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 8, uv.getY(k) * h / 8);
    g.translate(x, -46 + h / 2, z); geos.push(g);
  }
  const mat = new THREE.MeshStandardMaterial({ map: WIN_TEX, emissiveMap: WIN_LIT, emissive: 0xffb45a, emissiveIntensity: 1.1, roughness: 0.85 });
  const city = new THREE.Mesh(mergeGeometries(geos), mat); city.receiveShadow = true; scene.add(city);
  for (let i = 0; i < 40; i++) { // rooftop water towers + antennas for silhouette
    const x = (Math.random() < 0.5 ? -1 : 1) * rand(20, 200), z = rand(40, -900), y = rand(-20, 10);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 12), new THREE.MeshStandardMaterial({ color: 0x5b4032, roughness: 0.9 })); tank.position.set(x, y + 3.5, z); scene.add(tank);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 5), darkSteel0()); ant.position.set(x + 3, y + 4.5, z); scene.add(ant);
  }
}
function darkSteel0() { return new THREE.MeshStandardMaterial({ color: 0x3b3f47, metalness: 0.7, roughness: 0.5 }); }
function roofTex() {
  const t = tex(512, 1024, (g, w, h) => {
    g.fillStyle = '#8d8a86'; g.fillRect(0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 30; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
    g.strokeStyle = 'rgba(40,36,34,0.55)'; g.lineWidth = 3; for (let y = 0; y < h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let x = 0; x < w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = 'rgba(30,26,24,0.35)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(10, 40), rand(6, 20), rand(0, 3), 0, TAU); g.fill(); }
    g.fillStyle = '#ffc21a'; g.fillRect(w * 0.035, 0, w * 0.018, h); g.fillRect(w * 0.947, 0, w * 0.018, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
if (TH === 'city') buildCity();


// ---------- load model from artifact assets ----------
async function fetchWithProgress(url, onP) {
  const res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = +res.headers.get('content-length') || 0; const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) return new Uint8Array(await res.arrayBuffer());
  const chunks = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onP(total ? got / total : Math.min(0.95, got / 7.6e6)); }
  const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
}
// small IndexedDB cache so the model downloads only once per device
function idbOpen() { return new Promise((res, rej) => { const r = indexedDB.open('daggie-cache', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet(key) { try { const db = await idbOpen(); return await new Promise(res => { const q = db.transaction('files', 'readonly').objectStore('files').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function idbPut(key, val) { try { const db = await idbOpen(); await new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(val, key); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; }); } catch (e) {} }
let CACHE_NOTE = '';
async function storageCheck() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
  try { const db = await idbOpen(); db.close(); } catch (e) { CACHE_NOTE = 'This viewer does not allow saving data, so Daggie downloads every time.'; }
  try { const was = localStorage.getItem('daggie-saved'); if (was && !(await idbGet('model:' + ASSETS.model))) CACHE_NOTE = 'Saved copy was cleared by this app, downloading again.'; } catch (e) {}
}
async function loadModel() {
  await storageCheck();
  const t0 = performance.now();
  let bin = await idbGet('model:' + ASSETS.model);
  window.__cacheHit = !!bin;
  if (bin) setLoad(0.85, 'Loading Daggie from this device…');
  else {
    const gz = await fetchWithProgress(ASSETS.model, p => setLoad(p * 0.85, 'Downloading Daggie… ' + Math.round(p * 100) + '% (first time only)'));
    setLoad(0.88, 'Unpacking…');
    bin = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    idbPut('model:' + ASSETS.model, bin).then(async () => { const ok = !!(await idbGet('model:' + ASSETS.model)); try { if (ok) localStorage.setItem('daggie-saved', '1'); } catch (e) {} window.__savedOk = ok; });
  }
  const hl = new DataView(bin).getUint32(0, true);
  return { hdr: JSON.parse(new TextDecoder().decode(new Uint8Array(bin, 4, hl))), bin, base: 4 + hl };
}
async function loadTexBlob() {
  let blob = await idbGet('tex:' + ASSETS.tex);
  if (!blob) { const res = await fetch(ASSETS.tex); blob = await res.blob(); idbPut('tex:' + ASSETS.tex, blob); }
  return blob;
}
let MODEL, TEX_BLOB;
try { [MODEL, TEX_BLOB] = await Promise.all([loadModel(), loadTexBlob()]); } catch (e) { $('loadTxt').textContent = 'Could not load Daggie. Check the connection and reopen the page.'; throw e; }
setLoad(0.93, 'Building the test track…');
{ const hk = $('hook'); hk.textContent = ''; for (const t of L.title) { const sp = document.createElement('span'); sp.textContent = t; hk.appendChild(sp); } }
// ---------- LED face ----------
const faceCv = document.createElement('canvas'); faceCv.width = 320; faceCv.height = 220;
const fx = faceCv.getContext('2d');
const faceTex = new THREE.CanvasTexture(faceCv); faceTex.colorSpace = THREE.SRGBColorSpace;
const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x020104, roughness: 0.08, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 3.2, envMapIntensity: 0.8 });
let faceMode = 'wow', faceKey = '';
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function tri(g, x, y, s) { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.8); g.lineTo(x - s, y + s * 0.8); g.closePath(); }
function drawFace(now) {
  const blink = (now % 3600) < 150 && (faceMode === 'idle' || faceMode === 'worried');
  const pulse = faceMode === 'okq' ? Math.floor(now / 320) % 2 : 0;
  const key = faceMode + blink + pulse; if (key === faceKey) return; faceKey = key;
  const g = fx, W = 320, H = 220;
  const bg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6);
  bg.addColorStop(0, '#0e0319'); bg.addColorStop(1, '#030006');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save();
  g.shadowColor = '#b44cff'; g.shadowBlur = 22;
  const ink = '#f0b4ff', pupil = '#3a0a66';
  g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 11; g.lineCap = 'round'; g.lineJoin = 'round';
  const m = faceMode, L = 108, R = 212, EY = 100;
  const bigEyes = (py) => { for (const x of [L, R]) { g.fillStyle = ink; g.beginPath(); g.ellipse(x, EY, 34, 42, 0, 0, TAU); g.fill(); g.fillStyle = pupil; g.beginPath(); g.ellipse(x + 2, EY + (py || 6), 14, 20, 0, 0, TAU); g.fill(); } g.fillStyle = ink; };
  if (m === 'worried') {
    if (blink) { g.fillRect(L - 32, EY - 4, 64, 10); g.fillRect(R - 32, EY - 4, 64, 10); }
    else bigEyes(8);
    g.beginPath(); g.moveTo(L - 30, 40); g.quadraticCurveTo(L, 34, L + 26, 50); g.moveTo(R + 30, 40); g.quadraticCurveTo(R, 34, R - 26, 50); g.stroke();
    g.beginPath(); g.moveTo(112, 176); g.lineTo(132, 160); g.lineTo(152, 176); g.lineTo(172, 160); g.lineTo(192, 176); g.lineTo(212, 160); g.stroke();
    g.shadowColor = '#ff3b5c'; g.fillStyle = '#ff4d6d'; tri(g, 58, 160, 16); g.fill(); tri(g, 262, 160, 16); g.fill();
    g.fillStyle = '#2a0c16'; g.fillRect(56, 150, 4, 12); g.fillRect(260, 150, 4, 12);
  } else if (m === 'idle') {
    if (blink) { g.fillRect(L - 26, EY - 4, 52, 10); g.fillRect(R - 26, EY - 4, 52, 10); }
    else { rr(g, L - 24, EY - 34, 48, 64, 16); g.fill(); rr(g, R - 24, EY - 34, 48, 64, 16); g.fill(); }
    rr(g, 128, 168, 64, 12, 6); g.fill();
  } else if (m === 'happy') {
    for (const x of [L, R]) { g.beginPath(); g.arc(x, EY + 16, 30, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    g.beginPath(); g.arc(160, 132, 44, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
  } else if (m === 'wink') {
    g.beginPath(); g.arc(L, EY + 16, 30, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    rr(g, R - 24, EY - 34, 48, 64, 16); g.fill();
    g.beginPath(); g.arc(160, 132, 40, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
  } else if (m === 'scared') {
    for (const x of [L, R]) { g.beginPath(); g.ellipse(x, EY, 36, 46, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, EY + 4, 9, 0, TAU); g.fill(); }
    g.beginPath(); g.ellipse(160, 180, 16, 20, 0, 0, TAU); g.stroke();
  } else if (m === 'hit') {
    for (const x of [L, R]) { g.beginPath(); g.moveTo(x - 28, EY - 30); g.lineTo(x + 28, EY + 30); g.moveTo(x + 28, EY - 30); g.lineTo(x - 28, EY + 30); g.stroke(); }
    g.beginPath(); g.moveTo(104, 178); g.lineTo(124, 160); g.lineTo(144, 178); g.lineTo(164, 160); g.lineTo(184, 178); g.lineTo(204, 160); g.lineTo(220, 176); g.stroke();
  } else if (m === 'wow') {
    for (const x of [L, R]) { g.beginPath(); g.ellipse(x, EY, 34, 38, 0, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(L - 30, 44); g.quadraticCurveTo(L, 36, L + 24, 52); g.moveTo(R + 30, 44); g.quadraticCurveTo(R, 36, R - 24, 52); g.stroke();
    g.beginPath(); g.ellipse(160, 176, 14, 17, 0, 0, TAU); g.stroke();
  } else if (m === 'okq' || m === 'err') {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 ' + (m === 'okq' ? 104 : 92) + 'px ' + FONT;
    if (m === 'okq') g.globalAlpha = pulse ? 1 : 0.5;
    g.fillText(m === 'okq' ? 'OK?' : '404', 160, 116);
  }
  g.restore();
  g.fillStyle = 'rgba(2,0,5,0.7)';
  for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 2, H);
  for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  faceTex.needsUpdate = true;
}

// ---------- build Daggie ----------
const daggie = new THREE.Group(); scene.add(daggie);
const parts = [], byName = {};
const bodyTex = new THREE.Texture(); bodyTex.flipY = false; bodyTex.colorSpace = THREE.SRGBColorSpace; bodyTex.anisotropy = 8;
try { bodyTex.image = await createImageBitmap(TEX_BLOB); bodyTex.needsUpdate = true; }
catch (e) { const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(TEX_BLOB); }); const im = new Image(); im.onload = () => { bodyTex.image = im; bodyTex.needsUpdate = true; }; im.src = url; }
const bodyMat = new THREE.MeshPhysicalMaterial({ map: bodyTex, roughness: 0.32, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.7 });
const capMat = new THREE.MeshPhysicalMaterial({ color: 0x141218, roughness: 0.6 });
for (const e of MODEL.hdr.parts) {
  const { bin, base } = MODEL;
  const q = new Uint16Array(bin, base + e.pos, e.v * 3), pos = new Float32Array(e.v * 3);
  for (let i = 0; i < e.v; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = e.mn[k] + q[i * 3 + k] / 65535 * (e.mx[k] - e.mn[k]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(bin.slice(base + e.nor, base + e.nor + e.v * 3)), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(bin.slice(base + e.uv, base + e.uv + e.v * 4)), 2, true));
  g.setIndex(new THREE.BufferAttribute(e.it === 16 ? new Uint16Array(bin.slice(base + e.idx, base + e.idx + e.i * 2)) : new Uint32Array(bin.slice(base + e.idx, base + e.idx + e.i * 4)), 1));
  g.computeBoundingBox();
  const c = new V3(); g.boundingBox.getCenter(c);
  g.translate(-c.x, -c.y, -c.z); g.computeBoundingBox(); g.computeBoundingSphere();
  const grp = new THREE.Group(); grp.name = e.name; grp.position.copy(c);
  const mesh = new THREE.Mesh(g, bodyMat); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
  const bb = g.boundingBox, hx = (bb.max.x - bb.min.x) / 2, hy = (bb.max.y - bb.min.y) / 2, hz = (bb.max.z - bb.min.z) / 2;
  const samples = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) samples.push({ p: new V3(sx * hx * 0.8, sy * hy * 0.8, sz * hz * 0.8), r: 0.04 });
  samples.push({ p: new V3(0, -hy * 0.9, 0), r: Math.min(hx, hz) * 0.6 });
  grp.userData = { restPos: c.clone(), restQuat: new THREE.Quaternion(), v: new V3(), w: new V3(), samples, mesh, caps: [] };
  daggie.add(grp); parts.push(grp); byName[e.name] = grp;
}
const head = byName.head, torso = byName.torso, pelvis = byName.pelvis;
const capGeo = new THREE.CylinderGeometry(1, 1, 1, 40);
function loopOf(a, b) { return MODEL.hdr.loops.find(l => ((l.a === a && l.b === b) || (l.a === b && l.b === a)) && l.cnt >= 20); }
for (const L of MODEL.hdr.loops) {
  if (L.cnt < 20) continue;
  const c = new V3(...L.c), n = new V3(...L.n).normalize();
  for (const nm of [L.a, L.b]) {
    const p = byName[nm]; if (!p) continue;
    const m = new THREE.Mesh(capGeo, capMat); m.scale.set(L.r, 0.03, L.r); m.quaternion.setFromUnitVectors(Y, n);
    m.position.copy(c).sub(p.userData.restPos); m.castShadow = true; p.add(m); p.userData.caps.push(m.position.clone());
  }
}
// live LED face + helmet ID decals
const faceMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 3.2, roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const idTex = tex(512, 150, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffc21a'; g.font = '700 100px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('[D-011]', w / 2, h / 2 + 6); });
const idMat = new THREE.MeshPhysicalMaterial({ map: idTex, transparent: true, roughness: 0.3, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
daggie.updateMatrixWorld(true);
{
  const helper = new THREE.Object3D();
  for (const d of MODEL.hdr.decals) {
    const p = byName[d.part]; if (!p) continue;
    const pos = new V3(...d.p), n = new V3(...d.n);
    helper.position.copy(pos); helper.up.set(0, 1, 0); helper.lookAt(pos.clone().add(n));
    try {
      const geo = new DecalGeometry(p.userData.mesh, pos, helper.rotation.clone(), new V3(...d.s));
      geo.applyMatrix4(new THREE.Matrix4().copy(p.matrixWorld).invert());
      const m = new THREE.Mesh(geo, d.kind === 'face' ? faceMat : idMat); m.renderOrder = 2; p.add(m);
    } catch (err) { console.warn('decal failed', err); }
  }
}
for (const p of parts) { p.userData.restPos.copy(p.position); p.userData.restQuat.copy(p.quaternion); }

// ---------- skeleton (forward kinematics over the 15 parts) ----------
const piv = (a, b) => { const L = loopOf(a, b); return L ? new V3(...L.c) : byName[b].userData.restPos.clone().lerp(byName[a].userData.restPos, 0.5); };
const hipMid = piv('pelvis', 'thighL').clone().add(piv('pelvis', 'thighR')).multiplyScalar(0.5);
const RIG = [['pelvis', null, hipMid], ['torso', 'pelvis', piv('pelvis', 'torso')], ['head', 'torso', piv('torso', 'head')]];
for (const k of ['L', 'R']) RIG.push(['upper' + k, 'torso', piv('torso', 'upper' + k)], ['fore' + k, 'upper' + k, piv('upper' + k, 'fore' + k)], ['hand' + k, 'fore' + k, piv('fore' + k, 'hand' + k)],
  ['thigh' + k, 'pelvis', piv('pelvis', 'thigh' + k)], ['shin' + k, 'thigh' + k, piv('thigh' + k, 'shin' + k)], ['foot' + k, 'shin' + k, piv('shin' + k, 'foot' + k)]);
const SIDE = {}; for (const k of ['L', 'R']) SIDE[k] = Math.sign(byName['thigh' + k].userData.restPos.x) || (k === 'L' ? 1 : -1);
const NODE = {}; for (const [n, par, p] of RIG) NODE[n] = { n, par, p, M: new THREE.Matrix4() };
const ANKLE_REST = NODE.footL.p.clone().add(NODE.footR.p).multiplyScalar(0.5);
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _one = new V3(1, 1, 1);
const rootQ = new THREE.Quaternion(), rootPos = new V3();
function runFK(P) {
  for (const [n] of RIG) {
    const N = NODE[n], a = P[n] || [0, 0, 0];
    _q.setFromEuler(_e.set(a[0], a[1], a[2], 'XYZ'));
    if (!N.par) { _m1.makeTranslation(rootPos.x + N.p.x, rootPos.y + N.p.y, rootPos.z + N.p.z); _m2.makeRotationFromQuaternion(rootQ); _m1.multiply(_m2); _m2.makeRotationFromQuaternion(_q); _m1.multiply(_m2); _m3.makeTranslation(-N.p.x, -N.p.y, -N.p.z); N.M.copy(_m1.multiply(_m3)); }
    else { N.M.copy(NODE[N.par].M); _m1.makeTranslation(N.p.x, N.p.y, N.p.z); _m2.makeRotationFromQuaternion(_q); _m3.makeTranslation(-N.p.x, -N.p.y, -N.p.z); N.M.multiply(_m1).multiply(_m2).multiply(_m3); }
  }
}
function applyFK() {
  for (const [n] of RIG) { const p = byName[n]; if (p.userData.detached) continue; _m1.makeTranslation(p.userData.restPos.x, p.userData.restPos.y, p.userData.restPos.z); _m2.copy(NODE[n].M).multiply(_m1); _m2.decompose(p.position, p.quaternion, tv3); }
}
const tv3 = new V3();
function jointWorld(n, out) { return out.copy(NODE[n].p).applyMatrix4(NODE[n].M); }
// pose helpers: a pose is { part: [x,y,z] }
function blendPose(A, B, t) { const o = {}; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) { const a = A[k] || [0, 0, 0], b = B[k] || [0, 0, 0]; o[k] = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; } return o; }
const STANCE = 1.35;
function skatePose(k, bal, t, lean) {
  const P = { torso: [0.12 + 0.3 * k, 0, -lean * 0.15], head: [-0.1 - 0.25 * k, -1.2, 0] };
  for (const s of ['L', 'R']) {
    const sd = SIDE[s], front = sd > 0 ? 1 : -1;
    P['thigh' + s] = [0.6 * k + 0.12, 0, sd * (0.24 + 0.05 * k)];
    P['shin' + s] = [-1.14 * k - 0.12, 0, 0];
    P['foot' + s] = [0.54 * k + 0.02, sd * 0.15, -sd * 0.18];
    const b = bal * front;
    P['upper' + s] = [0.25 + Math.sin(t * 2.3 + sd) * 0.12 + b * 0.25, 0, sd * (0.75 + 0.25 * Math.sin(t * 1.7 + sd * 2) + b * 0.35)];
    P['fore' + s] = [0.55 + Math.sin(t * 2.9 + sd) * 0.15, 0, 0];
    P['hand' + s] = [0.1, 0, sd * 0.2];
  }
  return P;
}
function tuckPose(t) {
  const P = { torso: [0.55, 0, 0], head: [0.35, 0, 0] };
  for (const s of ['L', 'R']) { const sd = SIDE[s]; P['thigh' + s] = [1.75, 0, sd * 0.15]; P['shin' + s] = [-2.25, 0, 0]; P['foot' + s] = [0.6, 0, 0]; P['upper' + s] = [1.0 + Math.sin(t * 5 + sd) * 0.15, 0, sd * 0.35]; P['fore' + s] = [1.2, 0, 0]; P['hand' + s] = [0, 0, 0]; }
  return P;
}
function flailPose(t) {
  const P = { torso: [-0.15 + Math.sin(t * 3) * 0.1, 0, Math.sin(t * 4) * 0.12], head: [-0.25, Math.sin(t * 3) * 0.3, 0] };
  for (const s of ['L', 'R']) { const sd = SIDE[s], ph = sd > 0 ? 0 : Math.PI; P['thigh' + s] = [0.35 + Math.sin(t * 9 + ph) * 0.6, 0, sd * 0.3]; P['shin' + s] = [-0.4 - Math.max(0, Math.sin(t * 9 + ph + 1)) * 0.9, 0, 0]; P['foot' + s] = [0.2, 0, 0]; P['upper' + s] = [Math.sin(t * 11 + ph) * 1.6, 0, sd * (1.5 + Math.sin(t * 7 + ph) * 0.6)]; P['fore' + s] = [0.4 + Math.sin(t * 13 + ph) * 0.5, 0, 0]; }
  return P;
}
// keep feet planted on the deck: shift the root so the ankles sit at their rest height, centred on the board
const _ja = new V3(), _jb = new V3();
function solveStance(P, plant) {
  rootPos.set(0, 0, 0); runFK(P);
  if (plant) {
    jointWorld('footL', _ja); jointWorld('footR', _jb); const mid = _ja.add(_jb).multiplyScalar(0.5);
    rootPos.set(-mid.x * plant, (ANKLE_REST.y - mid.y) * plant, -mid.z * plant);
    runFK(P);
  }
  applyFK();
}
// ---------- sky test track ----------
const HALF = L.track.half, RAMP0 = L.track.ramp[0], RAMP1 = L.track.ramp[1], RAMP_H = L.track.rampH, LAND0 = L.track.land[0], LAND1 = L.track.land[1];
const FINALE = L.finale || 'saw'; // what waits after the last ramp: the giant saw, or a ring of fire
const SAW_S = L.bigSaw.s, BIG_R = L.bigSaw.r, BIG_Y = FINALE === 'ring' ? -200 : L.bigSaw.y;
const GAPS = L.track.gaps;
function trackH(s) {
  if (s < -14) return null;
  for (const g of GAPS) if (s > g[0] && s < g[1]) return null;
  if (s <= RAMP0) return 0;
  if (s <= RAMP1) { const t = (s - RAMP0) / (RAMP1 - RAMP0); return RAMP_H * t * t; }
  if (s < LAND0) return null;
  if (s <= LAND1) return 0;
  return null;
}
const STAND_H = 0.9, STAND_R = 1.35; let LABNOSTAND = false;
function floorAt(x, z) { if (MODE === 'lab') return !LABNOSTAND && x * x + z * z < STAND_R * STAND_R ? STAND_H : 0; const h = trackH(-z); if (h === null || Math.abs(x) > HALF) return -90; return h; }
const asphalt = tex(512, 1024, (g, w, h) => {
  g.fillStyle = '#3b3e46'; g.fillRect(0, 0, w, h);
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 34 + (Math.random() < 0.02 ? 40 : 0); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  g.fillStyle = '#f4f4ee';
  g.fillRect(w * 0.035, 0, w * 0.018, h); g.fillRect(w * 0.947, 0, w * 0.018, h);
  for (const u of [1 / 3, 2 / 3]) for (let y = 0; y < h; y += 256) g.fillRect(w * u - 5, y + 30, 10, 150);
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (const u of [0.2, 0.5, 0.8]) g.fillRect(w * u - 18, 0, 36, h);
});
asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
const roadMat = new THREE.MeshStandardMaterial({ map: TH === 'city' ? roofTex() : asphalt, roughness: 0.88, metalness: 0.02 });
const steel = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.85, roughness: 0.35 });
const darkSteel = new THREE.MeshStandardMaterial({ color: 0x3b3f47, metalness: 0.7, roughness: 0.5 });
const stripeTex = tex(256, 64, (g, w, h) => { g.fillStyle = '#ffc21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#16141c'; for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + h, h); g.lineTo(i * 32 + h, h); g.fill(); } });
stripeTex.wrapS = THREE.RepeatWrapping;
function stripeMat(len) { const t = stripeTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / 1.2, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }); }
function sign(text, bg, fg, w = 512, h = 128) { return new THREE.MeshStandardMaterial({ map: tex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = fg; g.font = '700 ' + Math.round(h * 0.52) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4); }), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.05 }); }
function roadStrip(s0, s1) {
  const pos = [], uv = [], idx = []; let n = 0;
  for (let s = s0; s <= s1 + 1e-6; s += 0.5) { const h = trackH(Math.min(s, s1 - 1e-3)) ?? 0; pos.push(-HALF, h, -s, HALF, h, -s); uv.push(0, s / 12, 1, s / 12); if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } n++; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, roadMat); m.receiveShadow = true; scene.add(m);
  const L = s1 - s0, mid = (s0 + s1) / 2, flat = !(s0 >= RAMP0 - 1 && s1 <= RAMP1 + 1);
  if (flat && TH === 'city') { // each road piece is the roof of a building; gaps are the alleys between them
    const bw = HALF * 2 + 1.4, bh = 46; const bld = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, L), facadeMat(bw, bh)); bld.position.set(0, -bh / 2 - 0.02, -mid); bld.receiveShadow = true; scene.add(bld);
    const conc = new THREE.MeshStandardMaterial({ color: 0xa39c94, roughness: 0.9 });
    for (const sd of [-1, 1]) { const par = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, L), conc); par.position.set(sd * (HALF + 0.3), 0.27, -mid); par.castShadow = true; par.receiveShadow = true; scene.add(par);
      for (let q = s0 + 6; q < s1 - 4; q += 17) { const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.3), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.4, roughness: 0.5 })); ac.position.set(sd * (HALF + 1.2), 0.4, -q); ac.castShadow = true; scene.add(ac); } }
  } else if (flat) {
    const under = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.6, 0.8, L), darkSteel); under.position.set(0, -0.42, -mid); under.receiveShadow = true; scene.add(under);
    for (const sd of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, L), stripeMat(L)); curb.position.set(sd * (HALF + 0.05), 0.1, -mid); curb.castShadow = true; curb.receiveShadow = true; scene.add(curb);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, L), steel); rail.position.set(sd * (HALF + 0.05), 0.75, -mid); scene.add(rail);
      for (let s = s0 + 1; s < s1; s += 4) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), steel); post.position.set(sd * (HALF + 0.05), 0.48, -s); scene.add(post); }
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, L), stripeMat(L)); skirt.position.set(sd * (HALF + 0.33), -0.45, -mid); scene.add(skirt);
    }
    for (let s = s0 + 20; s < s1; s += 60) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 80, 16), darkSteel); col.position.set(0, -40.8, -s); scene.add(col); }
  } else {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.3, L), darkSteel); ramp.position.set(0, 0.55, -mid); scene.add(ramp);
  }
}
const TRACK_OBJ0 = scene.children.length;
{ let a = -14; for (const [g0, g1] of GAPS) { roadStrip(a, g0); a = g1; } roadStrip(a, RAMP0); roadStrip(RAMP0, RAMP1); roadStrip(LAND0, LAND1); }
{ // ramp surface chevrons, start grid, gantries, finish pad
  const rc = tex(256, 256, (g) => { g.fillStyle = '#16141c'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#ffc21a'; g.lineWidth = 26; g.lineJoin = 'round'; for (const y of [60, 150, 240]) { g.beginPath(); g.moveTo(30, y + 30); g.lineTo(128, y - 40); g.lineTo(226, y + 30); g.stroke(); } });
  for (let s = RAMP0 + 1.2; s < RAMP1; s += 2.5) { const h = trackH(s), sl = (trackH(s + 0.2) - trackH(s - 0.2)) / 0.4; const m = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 - 0.4, 2.3), new THREE.MeshStandardMaterial({ map: rc, roughness: 0.6 })); m.rotation.x = -Math.PI / 2 + Math.atan(sl); m.position.set(0, h + 0.02, -s); m.receiveShadow = true; scene.add(m); }
  const checker = tex(256, 64, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#f4f4ee' : '#16141c'; g.fillRect(x * 16, y * 16, 16, 16); } });
  const start = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 - 0.3, 1.2), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 })); start.rotation.x = -Math.PI / 2; start.position.set(0, 0.012, -4); start.receiveShadow = true; scene.add(start);
  const pad = tex(512, 512, (g, w) => { g.clearRect(0, 0, w, w); g.strokeStyle = '#3dff9a'; g.lineWidth = 22; g.beginPath(); g.arc(256, 256, 220, 0, TAU); g.stroke(); g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 140, 0, TAU); g.stroke(); g.fillStyle = '#3dff9a'; g.font = '700 76px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SAFE', 256, 226); g.fillText('ZONE', 256, 300); });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), new THREE.MeshStandardMaterial({ map: pad, transparent: true, roughness: 0.7 })); pm.rotation.x = -Math.PI / 2; pm.position.set(0, 0.015, -(LAND0 + 12)); pm.receiveShadow = true; scene.add(pm);
  const signs = L.signs;
  for (const [s, txt] of signs) {
    const g = new THREE.Group(); g.position.set(0, trackH(s) ?? 0, -s);
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 7.2, 0.28), steel); p.position.set(sd * (HALF + 0.55), 3.6, 0); p.castShadow = true; g.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 1.4, 0.35, 0.35), steel); beam.position.y = 7.1; g.add(beam);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), sign(txt, '#ffc21a', '#16141c')); sg.position.set(0, 6.25, 0.2); sg.rotation.y = Math.PI; g.add(sg);
    const back = sg.clone(); back.rotation.y = 0; back.position.z = -0.2; g.add(back);
    for (let i = -3; i <= 3; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), neon(i % 2 ? 0xff5a3a : 0xffd24a, 3)); l.position.set(i * 1.1, 7.35, 0.2); g.add(l); }
    scene.add(g);
  }
}
// saws: steel blades with hazard hubs, sunk into striped slots
function sawBlade(R, depth) {
  const sh = new THREE.Shape(), n = Math.max(14, Math.round(R * 14)), ri = R * 0.86;
  for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = a0 + TAU / n * 0.65, a2 = (i + 1) / n * TAU; if (!i) sh.moveTo(Math.cos(a0) * ri, Math.sin(a0) * ri); sh.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); sh.lineTo(Math.cos(a2) * ri, Math.sin(a2) * ri); }
  sh.holes.push(holePath(R * 0.12));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 8 }); g.translate(0, 0, -depth / 2);
  const grp = new THREE.Group();
  const bladeTex = tex(256, 256, (c, w) => { const gr = c.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#9aa1ab'); gr.addColorStop(1, '#e4e8ee'); c.fillStyle = gr; c.fillRect(0, 0, w, w); c.strokeStyle = 'rgba(40,44,52,0.35)'; for (let r = 30; r < 128; r += 9) { c.lineWidth = 1 + (r % 3); c.beginPath(); c.arc(128, 128, r, 0, TAU); c.stroke(); } });
  const blade = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: bladeTex, metalness: 0.95, roughness: 0.22 })); blade.castShadow = true; grp.add(blade);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.26, R * 0.26, depth * 2.2, 28), new THREE.MeshStandardMaterial({ color: 0xe0322b, roughness: 0.4, metalness: 0.3 })); hub.rotation.x = Math.PI / 2; grp.add(hub);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.09, R * 0.09, depth * 2.8, 6), new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.6, roughness: 0.3 })); bolt.rotation.x = Math.PI / 2; grp.add(bolt);
  return grp;
}
const slotTex = tex(256, 64, (g, w, h) => { g.fillStyle = '#ffc21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#16141c'; for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + h, h); g.lineTo(i * 32 + h, h); g.fill(); } g.fillStyle = '#0d0c10'; g.fillRect(12, 22, w - 24, 20); });
const SAWS = L.saws.map(([s, x, R, A = 0, w = 0]) => {
  const g = sawBlade(R, 0.1); const y = R * 0.72; g.position.set(x, y, -s); scene.add(g);
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(A ? A * 2 + R * 2.2 : R * 1.9, 0.55), new THREE.MeshStandardMaterial({ map: slotTex, roughness: 0.6 })); sl.rotation.x = -Math.PI / 2; sl.position.set(A ? 0 : x, 0.013, -s); sl.receiveShadow = true; scene.add(sl);
  return { s, x0: x, x, y, R, A, w, ph: rand(0, TAU), g, near: false };
});
const BIG = sawBlade(BIG_R, 0.3); BIG.position.set(0, BIG_Y, -SAW_S); scene.add(BIG);
if (FINALE !== 'ring') for (const sd of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 80, 0.6), darkSteel); arm.position.set(sd * 1.2, BIG_Y - 40, -SAW_S + 0.4); scene.add(arm); }
BIG.visible = FINALE !== 'ring';
// ---- the ring of fire: a burning hoop hanging over the last gap; go through the middle or get burned ----
const RING = { s: L.ring ? L.ring.s : SAW_S, y: L.ring ? L.ring.y : 4.9, R: L.ring ? L.ring.r : 2.3, flames: [], done: false };
if (FINALE === 'ring') {
  const g = new THREE.Group(); g.position.set(0, RING.y, -RING.s); scene.add(g); RING.g = g;
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(RING.R, 0.16, 16, 72), new THREE.MeshStandardMaterial({ color: 0x3a2a22, metalness: 0.7, roughness: 0.4, emissive: 0xff5a1a, emissiveIntensity: 0.6 })); g.add(hoop);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(RING.R, 0.32, 12, 72), new THREE.MeshBasicMaterial({ color: glowColor(0xff7a2a, 2.2), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(glow);
  const fireT = tex(128, 256, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h * 0.75, 4, w / 2, h * 0.6, h * 0.55); gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,200,60,0.95)'); gr.addColorStop(0.55, 'rgba(255,90,20,0.7)'); gr.addColorStop(1, 'rgba(120,20,0,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(w / 2, 0); c.bezierCurveTo(w * 0.95, h * 0.45, w, h * 0.8, w / 2, h); c.bezierCurveTo(0, h * 0.8, w * 0.05, h * 0.45, w / 2, 0); c.fill(); });
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireT, color: glowColor(0xffffff, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.set(Math.cos(a) * RING.R, Math.sin(a) * RING.R + 0.25, 0); sp.scale.set(0.7, 1.2, 1); g.add(sp); RING.flames.push({ sp, a, ph: rand(0, TAU) }); }
  // hung from a steel gantry that rises out of the clouds
  const steelR = new THREE.MeshStandardMaterial({ color: 0x3b3f47, metalness: 0.7, roughness: 0.45 });
  for (const sd of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 60, 0.5), steelR); post.position.set(sd * 6.5, RING.y + 3.2 - 30, -RING.s); scene.add(post); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.5, 0.5), steelR); beam.position.set(0, RING.y + 3.2, -RING.s); scene.add(beam);
  for (const sd of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2 - RING.R + 0.2, 6), steelR); ch.position.set(sd * 0.9, RING.y + (RING.R + 3.2) / 2 + 0.1, -RING.s); scene.add(ch); }
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), sign('THROUGH THE FIRE', '#e0322b', '#ffffff', 768, 172)); sg.position.set(0, RING.y + 3.9, -RING.s + 0.3); scene.add(sg);
}
function ringAnimate(t) { if (FINALE !== 'ring') return; for (const f of RING.flames) { const k = 0.8 + Math.sin(t * 9 + f.ph) * 0.2 + Math.random() * 0.12; f.sp.scale.set(0.65 * k, 1.25 * k, 1); f.sp.position.set(Math.cos(f.a) * RING.R, Math.sin(f.a) * RING.R + 0.3 * k, 0); } }
const TRACK_OBJ1 = scene.children.length, TRACK_OBJS = scene.children.slice(TRACK_OBJ0, TRACK_OBJ1);
const chev = tex(128, 128, (g) => { g.clearRect(0, 0, 128, 128); g.strokeStyle = '#27e0ff'; g.lineWidth = 16; g.lineCap = 'round'; g.lineJoin = 'round'; for (const y of [42, 90]) { g.beginPath(); g.moveTo(22, y + 22); g.lineTo(64, y - 16); g.lineTo(106, y + 22); g.stroke(); } });
const BOOSTS = L.boosts.map(([s, x]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshBasicMaterial({ map: chev, transparent: true, color: glowColor(0xffffff, 1.8), depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, -s); scene.add(m); return { s, x, used: false }; });

// ---------- real skateboard: kicktail deck, grip, graphic, trucks, wheels ----------
const board = new THREE.Group(); scene.add(board);
const wheels = [];
if (VEH === 'cart') buildCart(); else if (VEH === 'skate') {
  const LEN = 1.12, WID = 0.3, T = 0.024;
  const outline = new THREE.Shape(); const r = WID / 2, hl = LEN / 2 - r;
  outline.moveTo(-r, -hl); outline.lineTo(-r, hl); outline.absarc(0, hl, r, Math.PI, 0, true); outline.lineTo(r, -hl); outline.absarc(0, -hl, r, 0, Math.PI, true);
  const bend = (g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), az = Math.abs(z); let y = p.getY(i); if (az > 0.36) y += Math.pow((az - 0.36) / 0.2, 2) * 0.1; y += 0.01 * Math.pow(x / r, 2); p.setY(i, y); } g.computeVertexNormals(); return g; };
  const deckG = new THREE.ExtrudeGeometry(outline, { depth: T, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 20, steps: 1 });
  deckG.rotateX(-Math.PI / 2); deckG.translate(0, 0, 0);
  // subdivide lengthwise for a smooth bend: rebuild via ShapeGeometry layers
  const topG = new THREE.ShapeGeometry(outline, 24); topG.rotateX(-Math.PI / 2);
  const refine = (g) => { const ng = g.toNonIndexed(); return ng; };
  const grip = tex(256, 512, (g, w, h) => { g.fillStyle = '#17161b'; g.fillRect(0, 0, w, h); const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = Math.random() * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0); g.fillStyle = 'rgba(255,194,26,0.9)'; g.font = '700 44px ' + FONT; g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('D-011', 0, 14); g.restore(); });
  const art = tex(256, 1024, (g, w, h) => { g.fillStyle = '#ffc21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#16141c'; for (let i = -8; i < 40; i++) { g.beginPath(); g.moveTo(0, i * 60); g.lineTo(w, i * 60 - 120); g.lineTo(w, i * 60 - 90); g.lineTo(0, i * 60 + 30); g.fill(); } g.fillStyle = '#ffc21a'; g.fillRect(28, h * 0.3, w - 56, h * 0.4); g.fillStyle = '#16141c'; const cx = w / 2, cy = h / 2, rr = 70; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.lineWidth = 10; g.strokeStyle = '#16141c'; g.stroke(); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, rr, 0, Math.PI / 2); g.fill(); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, rr, Math.PI, Math.PI * 1.5); g.fill(); g.save(); g.translate(cx, h * 0.36); g.font = '700 52px ' + FONT; g.textAlign = 'center'; g.fillText('DAGGIE', 0, 0); g.restore(); });
  // build deck body as lofted strip so the kicktails bend smoothly
  function deckLayer(y0, mat, flipUV) {
    const g = new THREE.PlaneGeometry(WID, LEN, 6, 40); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), z = p.getZ(i); const az = Math.abs(z); if (az > hl) { const k = Math.sqrt(Math.max(0, 1 - Math.pow((az - hl) / r, 2))); x *= k; } p.setX(i, x); p.setY(i, y0); }
    bend(g); if (flipUV) { for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); g.rotateZ(Math.PI); g.rotateY(Math.PI); }
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  const deck = new THREE.Group(); deck.position.y = 0.135;
  deck.add(deckLayer(T, new THREE.MeshStandardMaterial({ map: grip, roughness: 0.95 })));
  const bottom = deckLayer(0, new THREE.MeshPhysicalMaterial({ map: art, roughness: 0.35, clearcoat: 1, side: THREE.DoubleSide }), false); deck.add(bottom);
  // edge: thin wood ply band
  const edgeG = new THREE.PlaneGeometry(1, 1); // placeholder small edge ring via lathe-like strip
  const ring = []; const N = 80; for (let i = 0; i <= N; i++) { const a = i / N * TAU; let x = Math.cos(a) * r, z = Math.sin(a) * (LEN / 2); const az = Math.abs(z); if (az < hl) { x = Math.sign(Math.cos(a)) * r; } else { const k = Math.sqrt(Math.max(0, 1 - Math.pow((az - hl) / r, 2))); x = Math.sign(Math.cos(a)) * r * k || 0; } ring.push([x, z]); }
  const ep = [], ei = [];
  ring.forEach(([x, z], i) => { const lift = Math.abs(z) > 0.36 ? Math.pow((Math.abs(z) - 0.36) / 0.2, 2) * 0.1 : 0; ep.push(x, lift, z, x, lift + T, z); if (i) { const a = (i - 1) * 2; ei.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3)); eg.setIndex(ei); eg.computeVertexNormals();
  deck.add(new THREE.Mesh(eg, new THREE.MeshStandardMaterial({ color: 0xd9a86a, roughness: 0.6, side: THREE.DoubleSide })));
  board.add(deck);
  const truckMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.25 });
  const wheelMat = new THREE.MeshPhysicalMaterial({ color: 0xfff1c9, roughness: 0.35, clearcoat: 0.6 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xe0322b, metalness: 0.4, roughness: 0.4 });
  const wheelG = new THREE.LatheGeometry([[0.018, -0.024], [0.046, -0.024], [0.054, -0.016], [0.056, 0], [0.054, 0.016], [0.046, 0.024], [0.018, 0.024]].map(([a, b]) => new THREE.Vector2(a, b)), 28); wheelG.rotateZ(Math.PI / 2);
  for (const z of [-0.37, 0.37]) {
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.018, 0.13, 2, 0.006), truckMat); base.position.set(0, 0.126, z); board.add(base);
    const king = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10), truckMat); king.position.set(0, 0.1, z); board.add(king);
    const bush = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), coreMat); bush.position.set(0, 0.095, z); board.add(bush);
    const hanger = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.035, 0.035, 2, 0.01), truckMat); hanger.position.set(0, 0.07, z); board.add(hanger);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), truckMat); axle.rotation.z = Math.PI / 2; axle.position.set(0, 0.056, z); board.add(axle);
    for (const x of [-0.135, 0.135]) { const w = new THREE.Group(); w.position.set(x, 0.056, z); const wm = new THREE.Mesh(wheelG, wheelMat); wm.castShadow = true; w.add(wm); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.05, 12), coreMat); c.rotation.z = Math.PI / 2; w.add(c); board.add(w); wheels.push(w); }
  }
}
const BOARD_TOP = VEH === 'cart' ? 0.4 * CART_S + 0.012 : 0.135 + 0.026;
const WHEEL_R = VEH === 'cart' ? 0.06 * CART_S : 0.056;
// supermarket cart: chrome wire basket, red handle, four casters. Origin on the floor, front faces -z.
function makeCartMesh(S, wheelsOut) {
  const root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(S); root.add(g);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.2 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xe0322b, roughness: 0.35, clearcoat: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1a20, roughness: 0.7 });
  const W = 0.64, y0 = 0.4, y1 = 1.02, zf0 = -0.45, zb0 = 0.45, zf1 = -0.47, zb1 = 0.58, geos = [];
  const bar = (x0, yy0, z0, x1, yy1, z1, r = 0.011) => { const a = new V3(x0, yy0, z0), b = new V3(x1, yy1, z1), len = a.distanceTo(b); if (len < 1e-4) return; const gg = new THREE.CylinderGeometry(r, r, len, 6, Math.max(1, Math.round(len / 0.045))); gg.translate(0, len / 2, 0); gg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize())); gg.translate(a.x, a.y, a.z); geos.push(gg); };
  for (let i = 0; i <= 11; i++) { const t = i / 11; for (const sd of [-1, 1]) bar(sd * W / 2, y0, lerp(zf0, zb0, t), sd * (W / 2 + 0.03), y1, lerp(zf1, zb1, t)); }
  for (let i = 0; i <= 8; i++) { const x = lerp(-W / 2, W / 2, i / 8); bar(x, y0, zf0, x * 1.09, y1, zf1); bar(x, y0, zb0, x * 1.09, y1, zb1); }
  for (const t of [0, 0.34, 0.67, 1]) { const y = lerp(y0, y1, t), zf = lerp(zf0, zf1, t), zb = lerp(zb0, zb1, t), hw = lerp(W / 2, W / 2 + 0.03, t); bar(-hw, y, zf, hw, y, zf, 0.013); bar(-hw, y, zb, hw, y, zb, 0.013); bar(-hw, y, zf, -hw, y, zb, 0.013); bar(hw, y, zf, hw, y, zb, 0.013); }
  for (let i = 0; i <= 8; i++) { const x = lerp(-W / 2, W / 2, i / 8); bar(x, y0, zf0, x, y0, zb0, 0.009); }
  for (let i = 0; i <= 10; i++) { const z = lerp(zf0, zb0, i / 10); bar(-W / 2, y0, z, W / 2, y0, z, 0.009); }
  for (const sd of [-1, 1]) { bar(sd * 0.27, 0.15, -0.44, sd * 0.27, 0.15, 0.52, 0.018); bar(sd * 0.27, 0.15, 0.52, sd * 0.3, y0, zb0, 0.016); bar(sd * 0.27, 0.15, -0.44, sd * 0.28, y0, zf0 + 0.04, 0.016); bar(sd * (W / 2 + 0.03), y1, zb1, sd * (W / 2 + 0.02), y1 + 0.1, zb1 + 0.14, 0.014); }
  const cage = new THREE.Mesh(mergeGeometries(geos), chrome); cage.castShadow = true; cage.name = 'cage'; cage.geometry.userData.orig = cage.geometry.attributes.position.array.slice(); g.add(cage);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W + 0.12, 14), red); handle.rotation.z = Math.PI / 2; handle.position.set(0, y1 + 0.1, zb1 + 0.14); handle.castShadow = true; g.add(handle);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.02, 0.24), red); flap.position.set(0, y1 - 0.05, zb1 - 0.13); flap.rotation.x = -0.45; g.add(flap);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), sign('CRASH MART', '#e0322b', '#ffffff', 384, 128)); plate.position.set(0, y1 - 0.13, zf1 - 0.01); plate.rotation.y = Math.PI; plate.name = 'plate'; plate.userData.home = plate.position.clone(); g.add(plate);
  for (const [x, z] of [[-0.27, -0.44], [0.27, -0.44], [-0.27, 0.52], [0.27, 0.52]]) {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), chrome); fork.position.set(x, 0.11, z); g.add(fork);
    const w = new THREE.Group(); w.position.set(x, 0.06, z); const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 16), black); wm.rotation.z = Math.PI / 2; wm.castShadow = true; w.add(wm); g.add(w); if (wheelsOut) wheelsOut.push(w);
  }
  return root;
}
function buildCart() { board.add(makeCartMesh(CART_S, wheels)); }
// ---------- more obstacles ----------
const hazard = (len) => stripeMat(len);
const OBS = { balls: [], presses: [], barrels: [], hurdles: [], sweepers: [], walls: [], oils: [], tramps: [], spikes: [], fans: [], cones: [] };
function frame2(s, h = 9, w = HALF + 0.9) { const g = new THREE.Group(); g.position.set(0, 0, -s); for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.34), steel); p.position.set(sd * w, h / 2, 0); p.castShadow = true; g.add(p); } const b = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.4, 0.45, 0.45), hazard(w * 2)); b.position.y = h; g.add(b); scene.add(g); return g; }
// 1. wrecking ball swinging across the lanes
function addBall(s, ph = 0) { const L = 7.2; frame2(s, 9.2);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), darkSteel); scene.add(chain);
  const ball = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 22), new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.85, roughness: 0.35 })); core.castShadow = true; ball.add(core);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.08, 10, 40), new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.4 })); band.rotation.x = Math.PI / 2; ball.add(band);
  scene.add(ball); OBS.balls.push({ s, L, pivot: new V3(0, 9.0, -s), chain, ball, amp: 1.0, w: 2.1, r: 0.95, near: false, pos: new V3(), ph }); }
for (const [s, ph] of L.balls) addBall(s, ph);
// 2. piston crushers over two lanes, out of phase
function addPress(s, blocks) { frame2(s, 7.5, HALF + 0.6);
  for (const [x, ph] of blocks) { const block = new THREE.Mesh(new RoundedBoxGeometry(2.7, 1.1, 2.2, 3, 0.08), hazard(2.7)); block.castShadow = true; scene.add(block); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 14), steel); scene.add(rod); OBS.presses.push({ s, x, w: 2.7, d: 2.2, ph, block, rod, bottom: 5, near: false }); } }
for (const p of L.presses) addPress(p.s, p.blocks);
// 3. rolling barrels coming at you
{ const bt = tex(256, 128, (g, w, h) => { g.fillStyle = '#d8342b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f4ee'; g.fillRect(0, 18, w, 12); g.fillRect(0, h - 30, w, 12); g.fillStyle = '#16141c'; g.font = '700 38px ' + FONT; g.textAlign = 'center'; g.fillText('☢', w / 2, h / 2 + 14); });
  const bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.5, metalness: 0.3 });
  for (const [x, s0] of L.barrels) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.25, 24), bm); m.rotation.z = Math.PI / 2; m.castShadow = true; scene.add(m); OBS.barrels.push({ x, s0, s: s0, m, r: 0.55, v: 7, near: false }); } }
// 3b. oncoming shopping carts rolling down the roof (level option L.carts = [[x, s], ...])
for (const [x, s0] of (L.carts || [])) { const m = makeCartMesh(1.0, null); m.rotation.y = Math.PI; scene.add(m); OBS.barrels.push({ x, s0, s: s0, m, r: 0.62, v: 9, near: false, cart: true }); }
// 4. hurdle bar (jump it)
function addHurdle(s) { const g = new THREE.Group(); g.position.set(0, 0, -s);
  for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), steel); p.position.set(sd * (HALF - 0.1), 0.47, 0); g.add(p); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 - 0.2, 0.22, 0.14), hazard(HALF * 2)); bar.position.y = 0.85; bar.castShadow = true; g.add(bar); scene.add(g);
  OBS.hurdles.push({ s, h: 0.95, bar }); }
for (const s of L.hurdles) addHurdle(s);
// 5. road gap edges
for (const [a, b] of GAPS) for (const s of [a, b]) { const e = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.06, 0.4), hazard(HALF * 2)); e.position.set(0, 0.02, -s + (s === a ? 0.2 : -0.2)); scene.add(e); }
// 6. spinning sweeper arm at shin height
function addSweeper(s) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.3, 18), darkSteel); post.position.set(0, 0.65, -s); scene.add(post);
  const arm = new THREE.Group(); arm.position.set(0, 0.62, -s); const bar = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 - 0.3, 0.24, 0.24), hazard(HALF * 2)); bar.castShadow = true; arm.add(bar);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), neon(0xff3a2a, 3)); lamp.position.y = 0.75; post.add(lamp); scene.add(arm);
  OBS.sweepers.push({ s, arm, len: HALF - 0.15, h: 0.62, w: 1.7, near: false }); }
for (const s of L.sweepers) addSweeper(s);
// 7. sliding wall blocking a lane
function addWall(s, sp = 1.3) { const wt = tex(256, 256, (g, w) => { g.fillStyle = '#ffc21a'; g.fillRect(0, 0, w, w); g.fillStyle = '#16141c'; for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 48, 0); g.lineTo(i * 48 + 24, 0); g.lineTo(i * 48 + 24 + w, w); g.lineTo(i * 48 + w, w); g.fill(); } g.fillStyle = '#e0322b'; g.beginPath(); g.arc(128, 128, 70, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(78, 116, 100, 24); });
  const m = new THREE.Mesh(new RoundedBoxGeometry(2.6, 3.0, 0.35, 3, 0.06), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.5 })); m.castShadow = true; scene.add(m);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.1, 0.5), darkSteel); rail.position.set(0, 0.03, -s); scene.add(rail);
  OBS.walls.push({ s, m, w: 2.6, A: 2.9, sp, x: 0, near: false }); }
for (const [s, sp] of L.walls) addWall(s, sp);
// 8. oil slick: loses grip
{ const ot = tex(256, 256, (g, w) => { g.clearRect(0, 0, w, w); const gr = g.createRadialGradient(128, 128, 10, 128, 128, 124); gr.addColorStop(0, 'rgba(10,8,6,0.95)'); gr.addColorStop(0.8, 'rgba(10,8,6,0.9)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = gr; g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, r = 100 + Math.sin(a * 5) * 14 + Math.sin(a * 3 + 1) * 10; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.fill(); });
  for (const [s, x] of L.oils) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), new THREE.MeshPhysicalMaterial({ map: ot, transparent: true, roughness: 0.05, clearcoat: 1, iridescence: 0.9, iridescenceIOR: 1.3, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, -s); scene.add(m); OBS.oils.push({ s, x, w: 1.6, l: 2.1, hit: false }); } }
// 9. trampoline: launches him high over the spikes
function addTramp(s, x) { const g = new THREE.Group(); g.position.set(x, 0, -s);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 12, 40), new THREE.MeshStandardMaterial({ color: 0x27a8ff, roughness: 0.4 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.32; g.add(ring);
  const mat = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshStandardMaterial({ color: 0x16141c, roughness: 0.8 })); mat.rotation.x = -Math.PI / 2; mat.position.y = 0.3; g.add(mat);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 8), steel); leg.position.set(Math.cos(a) * 1.2, 0.16, Math.sin(a) * 1.2); g.add(leg); }
  scene.add(g); OBS.tramps.push({ s, x, r: 1.2, g, mat, sq: 0 }); }
for (const [s, x] of L.tramps) addTramp(s, x);
// 10. pop-up spikes field
function addSpikes(s0, s1) { const spikeG = new THREE.ConeGeometry(0.13, 0.62, 10); spikeG.translate(0, 0.31, 0);
  const inst = new THREE.InstancedMesh(spikeG, new THREE.MeshStandardMaterial({ color: 0xcfd4dc, metalness: 0.95, roughness: 0.2 }), 400); inst.castShadow = true;
  const pts = []; for (let s = s0 + 0.3; s < s1; s += 0.55) for (let x = -HALF + 0.3; x < HALF - 0.2; x += 0.55) pts.push([x, s]);
  inst.count = pts.length; scene.add(inst);
  const base = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, s1 - s0), new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.7 })); base.rotation.x = -Math.PI / 2; base.position.set(0, 0.012, -(s0 + s1) / 2); scene.add(base);
  OBS.spikes.push({ s0, s1, inst, pts, up: 1, per: 2.4 }); }
for (const [s0, s1] of L.spikes) addSpikes(s0, s1);
// 11. side wind fans push him toward the edge
if (L.wind) { const { s0, s1, fans, force } = L.wind; for (const s of fans) { const g = new THREE.Group(); g.position.set(-HALF - 2.2, 1.6, -s); g.rotation.y = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 12, 48), darkSteel); g.add(ring);
    const blades = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.35, 0.05), steel); b.position.y = 0.7; const h = new THREE.Group(); h.rotation.z = i / 5 * TAU; b.rotation.y = 0.4; h.add(b); blades.add(h); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0xe0322b })); hub.rotation.x = Math.PI / 2; blades.add(hub); g.add(blades);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.3), darkSteel); stand.position.y = -1.6; g.add(stand); scene.add(g); OBS.fans.push({ s, blades }); }
  OBS.wind = { s0, s1, force }; }
// 12. traffic cone field (knock them flying)
{ const coneG = new THREE.ConeGeometry(0.22, 0.62, 18); coneG.translate(0, 0.31, 0);
  const cm = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.55 }), wm = new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.5 });
  for (const [x, s] of L.cones) {
    const g = new THREE.Group(); const c = new THREE.Mesh(coneG, cm); c.castShadow = true; g.add(c); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.1, 18), wm); band.position.y = 0.36; g.add(band); const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.44), new THREE.MeshStandardMaterial({ color: 0x16141c })); base.position.y = 0.02; g.add(base);
    scene.add(g); OBS.cones.push({ x0: x, s0: s, g, v: new V3(), w: new V3(), hit: false });
  } }
function resetObstacles() {
  for (const b of OBS.barrels) { b.s = b.s0; b.near = false; }
  for (const c of OBS.cones) { c.hit = false; c.v.set(0, 0, 0); c.w.set(0, 0, 0); c.g.position.set(c.x0, 0, -c.s0); c.g.rotation.set(0, 0, 0); }
  for (const o of [...OBS.balls, ...OBS.presses, ...OBS.sweepers, ...OBS.walls]) o.near = false;
  for (const o of OBS.oils) o.hit = false;
}
const _mt = new THREE.Matrix4(), _mq = new THREE.Quaternion(), _ms = new V3(1, 1, 1), _mp = new V3();
function animateObstacles(t, dt, riderS) {
  for (const b of OBS.balls) {
    const a = Math.sin(t * b.w + (b.ph || 0)) * b.amp; b.pos.set(b.pivot.x + Math.sin(a) * b.L, b.pivot.y - Math.cos(a) * b.L, b.pivot.z);
    b.ball.position.copy(b.pos); b.ball.rotation.z = a;
    b.chain.position.copy(b.pivot).lerp(b.pos, 0.5); b.chain.scale.y = b.L; b.chain.rotation.z = a;
  }
  for (const p of OBS.presses) {
    if (p.dead) continue;
    const c = 2.2, q = (t + p.ph) % c; let off;
    if (q < 0.9) off = 4.6; else if (q < 1.08) { const k = (q - 0.9) / 0.18; off = 4.6 - 4.25 * k * k; } else if (q < 1.45) off = 0.35; else off = 0.35 + 4.25 * Math.min(1, (q - 1.45) / 0.75);
    if (p.bottom > 0.6 && off <= 0.36 && Math.abs(riderS - p.s) < 40) { tone(90, 40, 0.18, 'sine', 0.12); burst(new V3(p.x, 0.2, -p.s), 10, SPARK, 3); }
    p.bottom = off; p.block.position.set(p.x, off + 0.55, -p.s); p.rod.scale.y = Math.max(0.1, 7.5 - (off + 1.1)); p.rod.position.set(p.x, off + 1.1 + p.rod.scale.y / 2, -p.s);
  }
  for (const b of OBS.barrels) {
    if (state === 'ride' && riderS > b.s0 - 95) b.s -= b.v * dt;
    if (b.cart) b.m.position.set(b.x, 0, -b.s); else { b.m.position.set(b.x, b.r, -b.s); b.m.rotation.x -= b.v * dt / b.r; }
  }
  for (const sw of OBS.sweepers) { sw.arm.rotation.y = t * sw.w; }
  for (const w of OBS.walls) { w.x = Math.sin(t * w.sp) * w.A; w.m.position.set(w.x, 1.5, -w.s); }
  for (const tr of OBS.tramps) { tr.sq *= Math.pow(0.02, dt); tr.mat.position.y = 0.3 - tr.sq * 0.25; }
  for (const sp of OBS.spikes) {
    const q = (t % sp.per) / sp.per; const up = q < 0.5 ? 1 : 0; const target = up ? 1 : 0.02;
    sp.up += (target - sp.up) * Math.min(1, dt * 14);
    sp.pts.forEach(([x, s], i) => { _mp.set(x, 0.01 - (1 - sp.up) * 0.6, -s); _mt.compose(_mp, _mq, _ms); sp.inst.setMatrixAt(i, _mt); }); sp.inst.instanceMatrix.needsUpdate = true;
  }
  for (const f of OBS.fans) f.blades.rotation.z -= dt * 14;
  animateGates(t, dt);
  for (const c of OBS.cones) {
    if (!c.hit) continue;
    c.v.y -= 9.8 * dt; c.g.position.addScaledVector(c.v, dt); c.g.rotation.x += c.w.x * dt; c.g.rotation.z += c.w.z * dt;
    const fl = floorAt(c.g.position.x, c.g.position.z); if (c.g.position.y < fl && c.g.position.y > fl - 0.5) { c.g.position.y = fl; c.v.y *= -0.3; c.v.x *= 0.8; c.v.z *= 0.8; c.w.multiplyScalar(0.7); }
  }
}

// spare-part crates: heal and bolt a lost limb back on
const spareTex = tex(256, 256, (g, w) => { g.fillStyle = '#2bd66f'; g.fillRect(0, 0, w, w); g.strokeStyle = '#0d3b22'; g.lineWidth = 14; g.strokeRect(10, 10, w - 20, w - 20); g.fillStyle = '#fff'; g.fillRect(104, 50, 48, 156); g.fillRect(50, 104, 156, 48); });
const SPARES = L.spares.map(([s, x]) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.75, 0.75, 3, 0.08), new THREE.MeshStandardMaterial({ map: spareTex, roughness: 0.4, emissive: 0x2bd66f, emissiveIntensity: 0.35 })); m.castShadow = true; scene.add(m); return { s, x, m, taken: false }; });
// TNT crates: blow up on contact (or when he slams down next to them)
const tntTex = tex(256, 256, (g, w) => { g.fillStyle = '#c4231c'; g.fillRect(0, 0, w, w); g.fillStyle = '#8f1712'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 64 + 56, w, 6); g.fillStyle = '#f4f0e6'; g.fillRect(0, 88, w, 80); g.fillStyle = '#16141c'; g.font = '700 74px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TNT', w / 2, 130); g.strokeStyle = '#5a0c09'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, w - 12); });
const tntMat = new THREE.MeshStandardMaterial({ map: tntTex, roughness: 0.6 });
const TNTS = L.tnts.map(([s, x]) => {
  const g = new THREE.Group(); const box = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.9, 2, 0.05), tntMat); box.position.y = 0.45; box.castShadow = true; g.add(box);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x2a2320 })); fuse.position.set(0.15, 1.0, 0); fuse.rotation.z = 0.4; g.add(fuse);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), neon(0xffb23d, 4)); spark.position.set(0.22, 1.14, 0); g.add(spark);
  g.position.set(x, 0, -s); scene.add(g); return { s, x, g, spark, alive: true };
});
// explosion visuals
const boomMat = new THREE.MeshBasicMaterial({ color: glowColor(0xffa033, 3), transparent: true, depthWrite: false });
const smokeTex = tex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(90,86,92,0.9)'); gr.addColorStop(0.6, 'rgba(70,66,72,0.5)'); gr.addColorStop(1, 'rgba(70,66,72,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const BOOMS = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), boomMat.clone()); m.visible = false; scene.add(m); const smoke = Array.from({ length: 8 }, () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false })); sp.visible = false; scene.add(sp); return { sp, v: new V3() }; }); return { m, smoke, t: 9 }; });
let boomNext = 0;
function explodeVisual(p) {
  recEvt('x', [p.x, p.y, p.z]);
  const b = BOOMS[boomNext]; boomNext = (boomNext + 1) % BOOMS.length; b.t = 0; b.m.visible = true; b.m.position.copy(p);
  for (const s of b.smoke) { s.sp.visible = true; s.sp.position.copy(p); s.v.set(rand(-3, 3), rand(2, 5), rand(-3, 3)); s.sp.material.opacity = 0.9; }
  if (AC) { try { const len = AC.sampleRate * 0.6, buf = AC.createBuffer(1, len, AC.sampleRate), dd = buf.getChannelData(0); for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); const src = AC.createBufferSource(); src.buffer = buf; const gn = AC.createGain(); gn.gain.value = 0.5; src.connect(gn); gn.connect(OUT()); src.start(); } catch (e) {} }
}
function explodeAt(p) {
  explodeVisual(p);
  burst(p, 90, SPARK, 12); burst(p, 30, CONF, 8);
  const few = debris.filter(d => !d.on).slice(0, 8);
  for (const d of few) { d.on = true; d.ground = false; d.m.visible = true; d.m.scale.setScalar(1); d.m.position.copy(p); d.v.set(rand(-6, 6), rand(4, 9), rand(-6, 6)); d.w.set(rand(-20, 20), rand(-20, 20), rand(-20, 20)); }
  tone(80, 25, 0.8, 'sawtooth', 0.35); tone(160, 40, 0.6, 'square', 0.18); tone(600, 60, 0.35, 'triangle', 0.12);
  for (const c of OBS.cones) if (Math.hypot(c.g.position.x - p.x, c.g.position.z - p.z) < 5) { c.hit = true; c.v.set((c.g.position.x - p.x) * 3, rand(6, 10), (c.g.position.z - p.z) * 3); c.w.set(rand(-15, 15), 0, rand(-15, 15)); }
}
function animateBooms(dt, t) {
  for (const b of BOOMS) {
    if (b.t > 3) continue; b.t += dt;
    const k = b.t / 0.45; b.m.scale.setScalar(0.5 + 3.8 * Math.min(1, k)); b.m.material.opacity = Math.max(0, 1 - k); if (k >= 1) b.m.visible = false;
    for (const s of b.smoke) { s.sp.position.addScaledVector(s.v, dt); s.v.multiplyScalar(Math.pow(0.4, dt)); const sc = 1.5 + b.t * 3; s.sp.scale.set(sc, sc, 1); s.sp.material.opacity = Math.max(0, 0.9 - b.t * 0.35); if (b.t > 2.6) s.sp.visible = false; }
  }
  for (const n of TNTS) if (n.alive) n.spark.scale.setScalar(0.7 + Math.sin(t * 30 + n.s) * 0.35);
}

// delivery drone: carries Daggie in and drops him over the start
const drone = new THREE.Group(); scene.add(drone);
const rotors = [];
{ // X-frame heavy-lift quadcopter: carbon arms, motors, two-blade props with blur discs, skids, gimbal camera, nav lights, winch claw
  const carbon = new THREE.MeshPhysicalMaterial({ color: 0x1d1f25, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2 });
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, roughness: 0.3, clearcoat: 1 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.9, roughness: 0.3 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.26, 1.1, 4, 0.1), carbon); body.castShadow = true; drone.add(body);
  const top = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.14, 0.86, 4, 0.07), shell); top.position.y = 0.17; top.castShadow = true; drone.add(top);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.02, 0.16), stripeMat(0.64)); stripe.position.set(0, 0.245, -0.18); drone.add(stripe);
  const batt = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.1, 0.55, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x33363e, roughness: 0.6 })); batt.position.set(0, 0.29, 0.12); drone.add(batt);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ex = x * 0.95, ez = z * 0.95;
    const armM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 12), carbon); armM.position.set(ex * 0.5, 0.02, ez * 0.5); armM.lookAt(new V3(ex, 0.02, ez).add(drone.position)); armM.rotateX(Math.PI / 2); armM.castShadow = true; drone.add(armM);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 20), alu); motor.position.set(ex, 0.1, ez); motor.castShadow = true; drone.add(motor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.012, 8, 24), new THREE.MeshStandardMaterial({ color: 0xe0322b, roughness: 0.4 })); ring.rotation.x = Math.PI / 2; ring.position.set(ex, 0.13, ez); drone.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40), new THREE.MeshBasicMaterial({ color: 0x9aa3b0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; disc.position.set(ex, 0.23, ez); drone.add(disc);
    const prop = new THREE.Group(); prop.position.set(ex, 0.22, ez);
    for (const sd of [-1, 1]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.012, 0.075), carbon); bl.position.x = sd * 0.35; bl.rotation.x = sd * 0.18; prop.add(bl); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), alu); prop.add(hub); drone.add(prop); rotors.push(prop);
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), neon(z < 0 ? (x < 0 ? 0xff2a2a : 0x2aff5a) : 0xffffff, 4)); nav.position.set(ex, 0.02, ez + (z > 0 ? 0.13 : -0.13)); drone.add(nav);
  }
  for (const sd of [-1, 1]) { // landing skids
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), carbon); leg1.position.set(sd * 0.32, -0.3, -0.25); leg1.rotation.z = sd * 0.35; drone.add(leg1);
    const leg2 = leg1.clone(); leg2.position.z = 0.25; drone.add(leg2);
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 10), carbon); skid.rotation.x = Math.PI / 2; skid.position.set(sd * 0.39, -0.48, 0); drone.add(skid);
  }
  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), carbon); gimbal.position.set(0, -0.17, -0.45); drone.add(gimbal);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), new THREE.MeshPhysicalMaterial({ color: 0x0a1030, roughness: 0.05, clearcoat: 1, metalness: 0.5 })); lens.position.set(0, -0.17, -0.551); lens.rotation.y = Math.PI; drone.add(lens);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), neon(0xff3a2a, 4)); eye.position.set(0.13, -0.14, -0.53); drone.add(eye);
  const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 14), alu); winch.rotation.z = Math.PI / 2; winch.position.y = -0.2; drone.add(winch);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.9, 6), carbon); cable.position.y = -1.2; drone.add(cable);
  const claw = new THREE.Group(); claw.position.y = -2.15; drone.add(claw);
  const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.1, 12), alu); claw.add(cb);
  for (let i = 0; i < 3; i++) { const f = new THREE.Group(); f.rotation.y = i / 3 * TAU; const seg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.04), alu); seg.position.set(0.1, -0.1, 0); seg.rotation.z = 0.5; f.add(seg); claw.add(f); }
}
drone.visible = false;

// ---------- arm cannon + shield bubble ----------
const PICKS = L.picks.map(([s, x, kind]) => {
  const icon = tex(256, 256, (g, w) => { g.fillStyle = kind === 'cannon' ? '#ff7a1a' : '#27a8ff'; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 14; g.strokeRect(10, 10, w - 20, w - 20); g.fillStyle = '#fff';
    if (kind === 'cannon') { g.fillRect(56, 104, 120, 48); g.fillRect(170, 92, 34, 72); g.beginPath(); g.arc(70, 128, 34, 0, TAU); g.fill(); }
    else { g.beginPath(); g.moveTo(128, 44); g.lineTo(206, 76); g.lineTo(196, 150); g.lineTo(128, 212); g.lineTo(60, 150); g.lineTo(50, 76); g.closePath(); g.fill(); } });
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.8, 0.8, 3, 0.1), new THREE.MeshStandardMaterial({ map: icon, roughness: 0.35, emissive: kind === 'cannon' ? 0xff7a1a : 0x27a8ff, emissiveIntensity: 0.4 }));
  m.castShadow = true; scene.add(m); return { s, x, kind, m, taken: false };
});
const cannonG = new THREE.Group(); cannonG.visible = false;
{
  const orange = new THREE.MeshPhysicalMaterial({ color: 0xff7a1a, roughness: 0.3, clearcoat: 1 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.62, 20), darkSteel); barrel.position.y = 0.22; cannonG.add(barrel);
  for (const y of [0.04, 0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 10, 24), orange); r.rotation.x = Math.PI / 2; r.position.y = y; cannonG.add(r); }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.22), orange); fin.position.set(0.14, 0.1, 0); cannonG.add(fin);
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.03, 10, 24), neon(0x5ad8ff, 4)); muzzle.rotation.x = Math.PI / 2; muzzle.position.y = 0.53; cannonG.add(muzzle);
  cannonG.userData.tip = new THREE.Object3D(); cannonG.userData.tip.position.y = 0.62; cannonG.add(cannonG.userData.tip);
}
const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.55, 32, 22), new THREE.MeshBasicMaterial({ color: glowColor(0x5ad8ff, 1.2), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
bubble.visible = false; scene.add(bubble);
const bubbleRim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.03, 8, 64), neon(0x5ad8ff, 2.5)); bubble.add(bubbleRim);
const PROJ = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), neon(0x8ae9ff, 5)); m.visible = false; scene.add(m); return { m, v: new V3(), life: 0, on: false }; });
// everything the cannon can blow up
const DESTR = [];
for (const sw of SAWS) DESTR.push({ obj: sw, vis: sw.g, x: () => sw.x, z: () => -sw.s, hw: sw.R, yy: () => [0, sw.y + sw.R] });
for (const b of OBS.balls) DESTR.push({ obj: b, vis: b.ball, also: [b.chain], x: () => b.pos.x, z: () => b.pos.z, hw: b.r + 0.3, yy: () => [b.pos.y - b.r - 0.4, b.pos.y + b.r + 0.4] });
for (const p of OBS.presses) DESTR.push({ obj: p, vis: p.block, also: [p.rod], x: () => p.x, z: () => -p.s, hw: p.w / 2, yy: () => [p.bottom, p.bottom + 1.2] });
for (const b of OBS.barrels) DESTR.push({ obj: b, vis: b.m, x: () => b.x, z: () => -b.s, hw: 0.8, yy: () => [0, 1.2] });
for (const sw of OBS.sweepers) DESTR.push({ obj: sw, vis: sw.arm, x: () => 0, z: () => -sw.s, hw: HALF, yy: () => [0, 1.3] });
for (const w of OBS.walls) DESTR.push({ obj: w, vis: w.m, x: () => w.x, z: () => -w.s, hw: w.w / 2, yy: () => [0, 3] });
for (const h of OBS.hurdles) DESTR.push({ obj: h, vis: h.bar, x: () => 0, z: () => -h.s, hw: HALF, yy: () => [0, 1.1] });
function killDestr(d, at) { d.obj.dead = true; d.vis.visible = false; if (d.also) for (const a of d.also) a.visible = false; explodeAt(at); }
function reviveDestr() { for (const d of DESTR) { d.obj.dead = false; d.vis.visible = true; if (d.also) for (const a of d.also) a.visible = true; } }
// like / subscribe pickups: collecting one flashes a call-to-action on screen
const SOCIAL = L.social.map(([s, x, kind]) => {
  const w = kind === 'like' ? 0.95 : 1.9;
  const t = tex(kind === 'like' ? 256 : 512, 256, (g, W, H) => { g.fillStyle = '#ff2b2b'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (kind === 'like') { g.font = '150px sans-serif'; g.fillText('👍', W / 2, H / 2 + 8); } else { g.font = '700 84px ' + FONT; g.fillText('SUBSCRIBE', W / 2 - 34, H / 2 + 4); g.font = '90px sans-serif'; g.fillText('🔔', W - 62, H / 2 + 6); } });
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.95, 0.35, 3, 0.12), [new THREE.MeshStandardMaterial({ color: 0xd61f1f, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xd61f1f, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xd61f1f }), new THREE.MeshStandardMaterial({ color: 0xd61f1f }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, emissive: 0xff2b2b, emissiveIntensity: 0.25 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, emissive: 0xff2b2b, emissiveIntensity: 0.25 })]);
  m.castShadow = true; scene.add(m); return { s, x, kind, m, taken: false };
});

// ---------- boost gates: pick a side, get stronger or weaker ----------
const GATE_S = L.gates;
// both doors look equally good: purple A, orange B. What is behind each is random every run.
const GATE_INFO = { A: ['?', 'DOOR A', 0x9b4dff, '#7a2ee8'], B: ['?', 'DOOR B', 0xff8a1f, '#e86f0c'] };
const MYSTERY = {
  'TNT RAIN': ['Crates falling from the sky!', 0], 'MOON GRAVITY': ['Floaty jumps for 6 s', 1], 'ROCKET BOOST': ['Full throttle!', 1],
  'OIL SLICK': ['Slippery for 3 s', 0], 'SHIELD': ['One free hit', 1], 'ARM CANNON': ['3 shots', 1], 'REPAIR': ['All parts back', 1],
  'SUPER JUMP': ['Jumps x1.5 for 6 s', 1], 'ANVIL': ['Look up!', 0], 'MATRIX MODE': ['Slow motion', 1],
};
const MYSTERY_KEYS = Object.keys(MYSTERY);
const GATE_TEX = {};
function gateTex(key) {
  if (GATE_TEX[key]) return GATE_TEX[key];
  const [t1, t2, , bg] = GATE_INFO[key];
  return GATE_TEX[key] = tex(512, 220, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 ' + (t1.length > 9 ? 68 : t1.length > 6 ? 82 : 104) + 'px ' + FONT; g.fillText(t1, w / 2, h * 0.42);
    g.font = '700 38px ' + FONT; g.globalAlpha = 0.9; g.fillText(t2, w / 2, h * 0.8);
  });
}
const GATES = GATE_S.map((s, gi) => {
  const sides = [-1, 1].map(sd => {
    const grp = new THREE.Group(); grp.position.set(sd * HALF / 2, 0, -s); scene.add(grp);
    const postMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const px of [-HALF / 2 + 0.12, HALF / 2 - 0.12]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), postMat); p.position.set(px, 1.7, 0); grp.add(p); }
    const signMat = new THREE.MeshBasicMaterial({ map: gateTex('A') });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(HALF - 0.1, 1.2), signMat); sign.position.set(0, 3.9, 0); grp.add(sign);
    const back = new THREE.Mesh(sign.geometry, signMat); back.rotation.y = Math.PI; back.position.set(0, 3.9, -0.02); grp.add(back);
    const curMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(HALF - 0.36, 3.3), curMat); cur.position.set(0, 1.65, 0); grp.add(cur);
    return { grp, signMat, postMat, curMat, flash: 0 };
  });
  return { s, gi, sides, keys: ['A', 'B'], fx: ['SHIELD', 'ANVIL'], used: false };
});
let GATE_LAYOUT = [];
function layoutGates(lay) {
  GATE_LAYOUT = lay.map(a => a.slice());
  GATES.forEach((gt, i) => {
    const [fa, fb] = lay[i] || []; gt.fx = [MYSTERY[fa] ? fa : 'SHIELD', MYSTERY[fb] ? fb : 'ANVIL'];
    gt.keys = ['A', 'B'];
    gt.sides.forEach((sd, k) => {
      const col = GATE_INFO[gt.keys[k]][2];
      sd.signMat.map = gateTex(gt.keys[k]); sd.signMat.needsUpdate = true;
      sd.postMat.color.copy(glowColor(col, 2.2)); sd.curMat.color.set(col);
      sd.flash = 0;
    });
  });
}
function randomGates() { layoutGates(GATES.map(() => { const a = pick(MYSTERY_KEYS); let b = pick(MYSTERY_KEYS); while (b === a) b = pick(MYSTERY_KEYS); return [a, b]; })); for (const gt of GATES) gt.used = false; }
function animateGates(t, dt) {
  for (const gt of GATES) for (const sd of gt.sides) { sd.flash *= Math.pow(0.05, dt); sd.curMat.opacity = 0.16 + Math.sin(t * 4 + gt.s) * 0.05 + sd.flash * 0.7; }
}
function gateFlash(i, side) { const sd = GATES[i].sides[side]; sd.flash = 1; burst(new V3((side ? 1 : -1) * HALF / 2, 1.8, -GATES[i].s), 60, CONF, 7); }
// what happened behind the door: big card on screen and in the video
function revealFx(name, replay) {
  const info = MYSTERY[name]; if (!info) return; if (!replay) recEvt('v', [name]);
  const col = info[1] ? '#3dff9a' : '#ff6a7a';
  const el = document.createElement('div'); el.className = 'reveal'; el.style.setProperty('--c', col);
  const b = document.createElement('b'); b.textContent = name; const sm = document.createElement('small'); sm.textContent = info[0]; el.append(b, sm);
  stage.appendChild(el); setTimeout(() => el.remove(), 1900);
  OVL.items.push({ kind: 'reveal', t: performance.now(), text: name, sub: info[0], col });
}
// the surprises
const FX = { grav: 1, gravT: 0, jump: 1, jumpT: 0, boostT: 0, rain: [], anvil: null };
const TNT_MAT = sign('TNT', '#e0322b', '#ffffff', 256, 128);
const RAIN = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.7, 0.7, 2, 0.05), TNT_MAT); m.castShadow = true; m.visible = false; scene.add(m); return { m, on: false, x: 0, s: 0, y: 0, vy: 0 }; });
const ANVIL = new THREE.Group(); {
  const iron = new THREE.MeshStandardMaterial({ color: 0x2f3238, metalness: 0.85, roughness: 0.35 });
  const add = (w, h, d, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), iron); m.position.y = y; m.castShadow = true; ANVIL.add(m); };
  add(0.9, 0.22, 0.55, 0.11); add(0.45, 0.3, 0.38, 0.37); add(1.15, 0.26, 0.55, 0.65);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 14), iron); horn.rotation.z = Math.PI / 2; horn.position.set(0.82, 0.66, 0); horn.castShadow = true; ANVIL.add(horn);
  const txt = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), sign('1000 KG', '#2f3238', '#ffc21a', 256, 72)); txt.position.set(0, 0.37, 0.2); ANVIL.add(txt);
  ANVIL.visible = false; scene.add(ANVIL);
}
const ANVIL_RING = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: glowColor(0xff3a3a, 2), transparent: true, opacity: 0.8, depthWrite: false })); ANVIL_RING.rotation.x = -Math.PI / 2; ANVIL_RING.visible = false; scene.add(ANVIL_RING);
function resetFx() { Object.assign(FX, { grav: 1, gravT: 0, jump: 1, jumpT: 0, boostT: 0 }); for (const r of RAIN) { r.on = false; r.m.visible = false; } FX.anvil = null; ANVIL.visible = false; ANVIL_RING.visible = false; }
function applyFx(name) {
  const now = performance.now();
  if (name === 'TNT RAIN') { RAIN.forEach((r, i) => { Object.assign(r, { on: true, x: rand(-3.4, 3.4), vy: 0, lead: 4 + i * 3.5 + rand(0, 2.5) }); r.y = rand(12, 20) + i * 1.5; r.s = R.s + Math.max(R.speed, 12) * Math.sqrt(2 * r.y / 9.8) + r.lead; r.m.visible = true; }); }
  else if (name === 'MOON GRAVITY') { FX.grav = 0.35; FX.gravT = 6; }
  else if (name === 'ROCKET BOOST') { FX.boostT = 2.5; R.speed = Math.min(40, R.speed + 12); if (R.grounded) { R.grounded = false; R.vy = 4; } burst(new V3(R.x, R.y + 0.4, -R.s + 0.8), 60, SPARK, 8); tone(200, 1400, 0.6, 'sawtooth', 0.05); }
  else if (name === 'OIL SLICK') { R.slip = 3; }
  else if (name === 'SHIELD') { R.shield = true; tone(500, 1500, 0.3, 'sine', 0.06); }
  else if (name === 'ARM CANNON') { equipCannon(); }
  else if (name === 'REPAIR') { while (detached.length) reattach(); stumps.length = 0; setHP(100); burst(torso.getWorldPosition(new V3()), 50, CONF, 6); }
  else if (name === 'SUPER JUMP') { FX.jump = 1.45; FX.jumpT = 6; }
  else if (name === 'ANVIL') { const T = 1.6; FX.anvil = { x: R.x, s: R.s + Math.max(R.speed, 12) * T + 5, y: 20 * T * T / 2 + 0.2, vy: 0, landed: false }; ANVIL.visible = true; ANVIL_RING.visible = true; tone(1200, 1200, 0.1, 'square', 0.05); tone(1200, 1200, 0.1, 'square', 0.05, 0.2); }
  else if (name === 'MATRIX MODE') { slowUntil = now + 2200; slowK = 0.3; }
}
function stepFx(dt) {
  if (FX.gravT > 0 && (FX.gravT -= dt) <= 0) FX.grav = 1;
  if (FX.jumpT > 0 && (FX.jumpT -= dt) <= 0) FX.jump = 1;
  if (FX.boostT > 0) FX.boostT -= dt;
  for (const r of RAIN) {
    if (!r.on) continue;
    { const fl0 = trackH(r.s) ?? 0, tl = fallTime(r.y - fl0, r.vy, 9.8); if (tl > 0.35 && state === 'ride') r.s = R.s + Math.max(R.speed, 8) * tl + r.lead; } // keep aiming ahead of him
    r.vy -= 9.8 * dt; r.y += r.vy * dt; r.m.position.set(r.x, r.y + 0.35, -r.s); r.m.rotation.x += dt * 2; r.m.rotation.z += dt * 1.3;
    const fl = trackH(r.s) ?? -90;
    if (r.y <= fl) {
      r.on = false; r.m.visible = false;
      if (fl > -80) { explodeAt(new V3(r.x, fl + 0.5, -r.s)); if (state === 'ride' && Math.abs(R.x - r.x) < 2 && Math.abs(R.s - r.s) < 2.2 && R.y < 2.5) { R.grounded = false; R.vy = 8; setHP(HP - 10); graze({}, R.x >= r.x ? 1 : -1, Math.random() < 0.3); if (state !== 'ride') return; lastPop = 0; pop('KABOOM!', 'green'); } }
    }
  }
  const A = FX.anvil;
  if (A) {
    if (!A.landed && state === 'ride') { const tl = fallTime(A.y - (trackH(A.s) ?? 0), A.vy, 20); if (tl > 0.3) A.s = R.s + Math.max(R.speed, 8) * tl + 5; if (tl > 0.6) A.x = R.x; } // lands ~5 m in front; aim at his lane until the last 0.6 s
    if (!A.landed) { A.vy -= 20 * dt; A.y += A.vy * dt; const fl = trackH(A.s) ?? -90; if (A.y <= fl) { A.y = fl; A.landed = true; ANVIL_RING.visible = false; explodeVisualSmall(new V3(A.x, fl + 0.3, -A.s)); if (state === 'ride' && Math.abs(R.x - A.x) < 1.0 && Math.abs(R.s - A.s) < 1.2 && R.y < 2.2) { crash('anvil'); return; } } }
    ANVIL.position.set(A.x, A.y, -A.s); ANVIL_RING.position.set(A.x, (trackH(A.s) ?? 0) + 0.02, -A.s);
    if (A.landed && state === 'ride' && Math.abs(R.x - A.x) < 0.8 && Math.abs(R.s - A.s) < 0.45 && R.y < 0.9) { crash('anvil'); return; }
  }
}
// seconds until something at height h (falling at vy, gravity g) reaches the ground
function fallTime(h, vy, g) { const v = -vy; return h <= 0 ? 0 : (-v + Math.sqrt(v * v + 2 * g * h)) / g; }
function explodeVisualSmall(c) { burst(c, 50, SPARK, 6); if (!reduceMotion) shake = Math.min(0.6, shake + 0.4); tone(90, 30, 0.35, 'sine', 0.35); clank(10); }
function takeGate(i, side) {
  const name = GATES[i].fx[side]; recEvt('g', [i, side]); gateFlash(i, side);
  if (!reduceMotion) shake = Math.min(0.5, shake + 0.2); slowUntil = performance.now() + 450; slowK = 0.45;
  revealFx(name, false); applyFx(name);
  const good = MYSTERY[name][1]; setFace(good ? 'happy' : 'scared', 1200);
  if (good) { tone(300, 1200, 0.35, 'square', 0.05); tone(600, 1800, 0.3, 'square', 0.04, 0.15); } else tone(700, 150, 0.45, 'sawtooth', 0.05);
}

// ---------- the flock: up to 5 Daggies ride together, loosely like a flock of birds ----------
// (the old "versions" system is switched off; these stubs keep the hooks elsewhere harmless)
const PW = { size: 1 }, FORM = { kind: '' };
function powerHit() { return false; }
function formMax() { return FX.boostT > 0 ? 40 : 34; }
function stepForm() {}
function formRec() { return null; }
function formApply() { for (const p of parts) if (!/^hand/.test(p.name)) p.visible = true; board.visible = true; }
function resetPower() {}
const FLOCK_MAX = 5, FL_STEP = 1 + 7 + 15 * 7;
const SLOTS = [[-1.5, 2.4], [1.5, 2.6], [-3.0, 4.8], [3.0, 5.1]]; // [side offset, distance behind the leader]
const TI = parts.indexOf(torso);
function makeFollower(i) {
  const rig = new THREE.Group(), body = new THREE.Group(); rig.add(body); body.position.y = BOARD_TOP; scene.add(rig);
  const fp = parts.map(p => { const g = new THREE.Group(); g.name = p.name; for (const ch of p.children) g.add(ch.clone()); g.userData = { v: new V3(), w: new V3(), samples: p.userData.samples.map(sm => ({ p: sm.p.clone(), r: sm.r })) }; body.add(g); return g; });
  const bd = board.clone(); scene.add(bd);
  rig.visible = false; bd.visible = false;
  return { i, rig, body, parts: fp, board: bd, state: 'off', x: 0, s: 0, y: 0, slot: 0, spawn: 1, boardFree: false, bv: new V3(), bw: new V3(), ph: rand(0, TAU) };
}
const FLOCK = []; // flock mode is switched off; makeFollower() is kept for later experiments
const HIST = [];
function flockCount() { return (state === 'crashed' || state === 'result' && cause !== '' ? 0 : 1) + FLOCK.filter(f => f.state === 'ride').length; }
function updateFlockHUD() { const el = $('flockN'); if (el) el.textContent = String(flockCount()); }
function resetFlock() {
  HIST.length = 0;
  for (const f of FLOCK) { f.state = 'off'; f.rig.visible = false; f.board.visible = false; f.boardFree = false; for (const p of f.parts) { f.body.add(p); p.visible = true; p.position.set(0, 0, 0); p.quaternion.identity(); p.userData.v.set(0, 0, 0); p.userData.w.set(0, 0, 0); } }
  updateFlockHUD();
}
function spawnFollower() {
  let f = FLOCK.find(ff => ff.state === 'off');
  if (!f) { f = FLOCK.filter(ff => ff.state === 'dead').sort((a, b) => b.s - a.s).pop(); if (!f) return false; for (const p of f.parts) { f.body.add(p); p.visible = true; } f.boardFree = false; }
  Object.assign(f, { state: 'ride', s: R.s, x: R.x, y: R.y, spawn: 0 });
  f.rig.visible = true; f.board.visible = true;
  burst(new V3(R.x, R.y + 1.2, -R.s), 40, CONF, 6);
  return true;
}
function histAt(s) {
  if (!HIST.length) return null; let i = HIST.length - 1; while (i > 0 && HIST[i].s > s) i--;
  const a = HIST[i], b = HIST[Math.min(i + 1, HIST.length - 1)], t = b.s > a.s ? clamp((s - a.s) / (b.s - a.s), 0, 1) : 0;
  return { y: lerp(a.y, b.y, t), p: lerp(a.p, b.p, t) };
}
// what a follower at (x, s, y) runs into; followers have no HP: any real hit takes them out
function followerHits(x, s, y) {
  const y0 = y + 0.2, y1 = y + 2.3;
  for (const sw of SAWS) { if (sw.dead || Math.abs(s - sw.s) > 0.4) continue; const yy = clamp(sw.y, y0, y1); if (Math.hypot(Math.max(0, Math.abs(x - sw.x) - 0.34), yy - sw.y) < sw.R + 0.05) return ['saw', Math.sign(x - sw.x) || 1]; }
  if (Math.abs(s - SAW_S) < 0.5) { const yy = clamp(BIG_Y, y0, y1); if (Math.hypot(Math.max(0, Math.abs(x) - 0.34), yy - BIG_Y) < BIG_R) return ['big', 0]; }
  for (const hu of OBS.hurdles) if (!hu.dead && Math.abs(s - hu.s) < 0.3 && y < hu.h - 0.12) return ['hurdle', 0];
  for (const b of OBS.balls) { if (b.dead || Math.abs(s - b.s) > 1.6) continue; const yy = clamp(b.pos.y, y0, y1); if (Math.hypot(x - b.pos.x, yy - b.pos.y, -s - b.pos.z) < b.r + 0.1) return ['ball', Math.sign(x - b.pos.x) || 1]; }
  for (const p of OBS.presses) if (!p.dead && Math.abs(s - p.s) < p.d / 2 + 0.3 && Math.abs(x - p.x) < p.w / 2 + 0.3 && p.bottom < y + 2.2) return ['press', 0];
  for (const b of OBS.barrels) if (!b.dead && Math.abs(s - b.s) < b.r + 0.3 && Math.abs(x - b.x) < 0.95 && y < b.r * 2 - 0.15) return ['barrel', 0];
  for (const sw of OBS.sweepers) { if (sw.dead || Math.abs(s - sw.s) > HALF) continue; const th = sw.arm.rotation.y, c = Math.cos(th), sn = Math.sin(th), dz = sw.s - s; if (Math.abs(x * c - dz * sn) < sw.len && Math.abs(c * dz + sn * x) < 0.32 && y < sw.h + 0.15) return ['sweeper', 0]; }
  for (const w of OBS.walls) if (!w.dead && Math.abs(s - w.s) < 0.4 && Math.abs(x - w.x) < w.w / 2 + 0.05) return ['wall', Math.sign(x - w.x) || 1];
  for (const sp of OBS.spikes) if (s > sp.s0 && s < sp.s1 && sp.up > 0.6 && y < 0.5) return ['spikes', 0];
  for (const n of TNTS) if (n.alive && Math.abs(s - n.s) < 0.75 && Math.abs(x - n.x) < 0.8 && y < 0.95) { n.alive = false; n.g.visible = false; explodeAt(new V3(n.x, 0.6, -n.s)); return ['tnt', x >= n.x ? 1 : -1]; }
  for (const c of OBS.cones) if (!c.hit && Math.abs(s - c.s0) < 0.45 && Math.abs(x - c.x0) < 0.55 && y < 0.6) { c.hit = true; c.v.set((c.x0 - x) * 6, rand(4, 6), -R.speed * 0.8); c.w.set(rand(-12, 12), 0, rand(-12, 12)); clank(4); }
  return null;
}
function flingParts(f, kind, dir, vz, vx) {
  for (const p of f.parts) {
    const u = p.userData; u.v.set((vx || 0) + rand(-2.5, 2.5) + dir * rand(1.5, 5), rand(2, 5.5), vz * rand(0.45, 0.85));
    if (kind === 'big' || kind === 'wall' || kind === 'hurdle' || kind === 'barrel') u.v.z *= 0.2;
    if (kind === 'press') u.v.y = rand(-1, 0.5);
    if (kind === 'spikes' || kind === 'tnt' || kind === 'gate') u.v.y += rand(3, 6);
    u.w.set(rand(-10, 10), rand(-8, 8), rand(-10, 10));
  }
  f.state = 'dead'; f.rig.visible = false; f.boardFree = true; f.bv.set(rand(-2, 2), rand(2, 4), vz * 0.7); f.bw.set(rand(-12, 12), rand(-6, 6), rand(-12, 12));
  const c = f.parts[TI].getWorldPosition(new V3()); burst(c, 60, SPARK, 9); burst(c, 20, CONF, 5);
  for (let i = 0; i < 12; i++) spawnDrop(c.clone(), new V3(rand(-1.8, 1.8), rand(0.8, 3.2), vz * 0.5 + rand(-1, 1)), rand(0.012, 0.022));
}
function crashFollower(f, kind, dir) {
  f.rig.updateMatrixWorld(true);
  for (const p of f.parts) { scene.attach(p); p.visible = true; }
  flingParts(f, kind, dir, -(state === 'ride' || state === 'passed' ? R.speed : 6));
  lastPop = 0; pop(kind === 'gate' ? 'POOF!' : '-1 DAGGIE', 'lilac'); clank(8); tone(900, 200, 0.25, 'sawtooth', 0.05);
  updateFlockHUD();
}
// the leader takes a lethal hit while others are alive: a Daggie blows apart right there
// and the nearest follower takes over the lead, fully repaired
function flockSwap(kind) {
  const f = FLOCK.find(ff => ff.state === 'ride' && ff.spawn >= 1); if (!f) return false;
  daggie.updateMatrixWorld(true);
  parts.forEach((lp, i) => { const fp = f.parts[i]; scene.attach(fp); lp.getWorldPosition(fp.position); lp.getWorldQuaternion(fp.quaternion); fp.visible = lp.visible; });
  f.board.position.copy(board.position); f.board.quaternion.copy(board.quaternion); f.board.scale.set(1, 1, 1); f.board.visible = true;
  flingParts(f, kind, Math.random() < 0.5 ? -1 : 1, -R.speed, R.xv * 0.3);
  while (detached.length) reattach(); stumps.length = 0; setHP(100);
  const now = performance.now(); R.inv = now + 1000; slowUntil = now + 900; slowK = 0.3; if (!reduceMotion) shake = 0.5;
  lastPop = 0; pop({ saw: 'ZZZT!', big: 'SHREDDED!', hurdle: 'FACEPLANT!', ball: 'WRECKED!', press: 'SQUISH!', barrel: 'STRIKE!', cart: 'CART CRASH!', sweeper: 'SWEPT!', fart: 'BRRRAP!', sock: 'STOMPED!', fire: 'BURNED!', wall: 'BONK!', spikes: 'OUCH!', wear: 'FALLING APART!' }[kind] || 'CRASH!', 'green');
  setTimeout(() => { lastPop = 0; pop('-1 DAGGIE', 'lilac'); }, 350);
  setFace('hit', 900); tone(140, 40, 0.45, 'sine', 0.3); tone(1500, 300, 0.25, 'sawtooth', 0.06);
  updateFlockHUD();
  return true;
}
const _fm = new THREE.Matrix4(), _ft = new THREE.Matrix4(), _fsc = new V3(), FPOSE = parts.map(() => ({ p: new V3(), q: new THREE.Quaternion() }));
function ragStep(list, dt) {
  for (const p of list) {
    const u = p.userData; u.v.y -= 9.8 * 1.1 * dt; p.position.addScaledVector(u.v, dt);
    const wl = u.w.length(); if (wl > 1e-4) { tq.setFromAxisAngle(tv.copy(u.w).multiplyScalar(1 / wl), wl * dt); p.quaternion.premultiply(tq); }
    let touched = false;
    for (const sm of u.samples) { tv2.copy(sm.p).applyQuaternion(p.quaternion).add(p.position); const fl = floorAt(tv2.x, tv2.z), pen = fl - (tv2.y - sm.r); if (pen > 0 && pen < 0.8) { p.position.y += pen; touched = true; if (u.v.y < 0) { if (u.v.y < -2.5) clank(-u.v.y); u.v.y *= -0.3; } } }
    if (touched) { const k = Math.pow(0.3, dt); u.v.x *= k; u.v.z *= k; u.w.multiplyScalar(Math.pow(0.25, dt)); } else u.w.multiplyScalar(Math.pow(0.9, dt));
    if (p.position.y < -89) { p.position.y = -89; u.v.set(0, 0, 0); u.w.set(0, 0, 0); }
  }
}
function stepFlock(dt) {
  const riding = state === 'ride' || state === 'passed';
  if (riding) { const last = HIST[HIST.length - 1]; if (!last || R.s > last.s + 0.05) { HIST.push({ s: R.s, y: R.y, p: rider.rotation.x }); if (HIST.length > 4000) HIST.shift(); } }
  // everyone copies the leader's body pose
  for (let i = 0; i < parts.length; i++) { const N = NODE[parts[i].name], rp = parts[i].userData.restPos; _ft.makeTranslation(rp.x, rp.y, rp.z); _fm.copy(N.M).multiply(_ft); _fm.decompose(FPOSE[i].p, FPOSE[i].q, _fsc); }
  let slot = 0;
  for (const f of FLOCK) {
    if (f.state !== 'ride') continue;
    if (!riding) { if (state === 'crashed') crashFollower(f, 'fall', 0); continue; }
    f.slot = Math.min(slot++, SLOTS.length - 1);
    const [dx, dz] = SLOTS[f.slot], px = f.x, ps = f.s, py = f.y;
    const tx = clamp(R.x + dx + Math.sin(simT * 1.1 + f.ph) * 0.35, -HALF + 0.45, HALF - 0.45);
    const ts = Math.max(0, R.s - dz + Math.sin(simT * 0.8 + f.ph * 2) * 0.5);
    f.x += (tx - f.x) * Math.min(1, dt * 3.2); f.s += (ts - f.s) * Math.min(1, dt * 5);
    if (f.spawn < 1) f.spawn = Math.min(1, f.spawn + dt * 3);
    const h = histAt(f.s); f.y = h ? h.y : 0;
    f.rig.position.set(f.x, f.y, -f.s); f.rig.rotation.set(h ? h.p : 0, 0, clamp(-(tx - f.x) * 0.25, -0.35, 0.35));
    const sc = 0.3 + 0.7 * (1 - Math.pow(1 - f.spawn, 3)); f.rig.scale.setScalar(sc);
    f.board.position.copy(f.rig.position); f.board.quaternion.copy(f.rig.quaternion); f.board.scale.setScalar(sc);
    f.parts.forEach((p, i) => { p.position.copy(FPOSE[i].p); p.quaternion.copy(FPOSE[i].q); });
    if (state === 'ride' && f.spawn >= 1) {
      const n = Math.max(1, Math.ceil(Math.abs(f.s - ps) / 0.2));
      for (let k = 1; k <= n; k++) { const t = k / n, hit = followerHits(lerp(px, f.x, t), lerp(ps, f.s, t), lerp(py, f.y, t)); if (hit) { crashFollower(f, hit[0], hit[1]); break; } }
    }
  }
  const dead = FLOCK.filter(f => f.state === 'dead');
  if (dead.length) for (let k = 0; k < 4; k++) {
    const h = dt / 4;
    for (const f of dead) {
      ragStep(f.parts, h);
      if (f.boardFree) { const B2 = f.board; f.bv.y -= 9.8 * h; B2.position.addScaledVector(f.bv, h); const wl = f.bw.length(); if (wl > 1e-3) { tq.setFromAxisAngle(tv.copy(f.bw).multiplyScalar(1 / wl), wl * h); B2.quaternion.premultiply(tq); } const fl = floorAt(B2.position.x, B2.position.z); if (B2.position.y < fl + 0.06 && B2.position.y > fl - 0.8) { B2.position.y = fl + 0.06; if (f.bv.y < 0) f.bv.y *= -0.35; f.bv.x *= 0.9; f.bv.z *= 0.9; f.bw.multiplyScalar(0.8); } if (B2.position.y < -89) { B2.position.y = -89; f.bv.set(0, 0, 0); } }
    }
  }
}
function recFlock() {
  const out = [];
  for (const f of FLOCK) {
    if (f.state === 'off') continue;
    out.push(f.i, f.board.position.x, f.board.position.y, f.board.position.z, f.board.quaternion.x, f.board.quaternion.y, f.board.quaternion.z, f.board.quaternion.w);
    for (const p of f.parts) { p.getWorldPosition(_wp); p.getWorldQuaternion(_wq); out.push(_wp.x, _wp.y, _wp.z, _wq.x, _wq.y, _wq.z, _wq.w); }
  }
  return new Float32Array(out);
}
function setTr(obj, A, o, B, ob, a) { obj.position.set(A[o], A[o + 1], A[o + 2]); obj.quaternion.set(A[o + 3], A[o + 4], A[o + 5], A[o + 6]); if (ob != null) { obj.position.lerp(_pb.set(B[ob], B[ob + 1], B[ob + 2]), a); _qb.set(B[ob + 3], B[ob + 4], B[ob + 5], B[ob + 6]); obj.quaternion.slerp(_qb, a); } }
function applyFlockRec(f0, f1, a) {
  const seen = new Set(), A = f0.FL, B = f1.FL, m1 = B && B.length ? idxMap(B, FL_STEP) : null;
  if (A) for (let o = 0; o < A.length; o += FL_STEP) {
    const f = FLOCK[A[o]]; if (!f) continue; seen.add(f); const o1 = m1 ? m1.get(A[o]) : undefined, has = o1 != null;
    setTr(f.board, A, o + 1, B, has ? o1 + 1 : null, a); f.board.visible = true; f.board.scale.set(1, 1, 1);
    f.parts.forEach((p, k) => { setTr(p, A, o + 8 + k * 7, B, has ? o1 + 8 + k * 7 : null, a); p.visible = true; });
  }
  for (const f of FLOCK) if (!seen.has(f)) { f.board.visible = false; for (const p of f.parts) p.visible = false; }
}
function takeGateFlock(i, side) {
  const key = GATES[i].keys[side], good = GATE_INFO[key][2]; recEvt('g', [i, side]); gateFlash(i, side);
  if (!reduceMotion) shake = Math.min(0.5, shake + 0.2); slowUntil = performance.now() + 450; slowK = 0.45;
  const n = flockCount(), t = { 'x2': n * 2, '+1': n + 1, '+2': n + 2, '-1': n - 1, '-2': n - 2, '÷2': Math.floor(n / 2) }[key];
  lastPop = 0;
  if (good) {
    let add = Math.min(FLOCK_MAX, t) - n, made = 0; while (add-- > 0 && spawnFollower()) made++;
    if (made) { pop(key === 'x2' ? 'DOUBLE! x' + (n + made) : '+' + made + ' DAGGIE' + (made > 1 ? 'S' : ''), 'green'); setFace('happy', 1200); tone(300, 1200, 0.35, 'square', 0.05); tone(600, 1800, 0.3, 'square', 0.04, 0.15); }
    else { pop('MAX 5 DAGGIES!', 'green'); tone(600, 1200, 0.2, 'square', 0.04); }
  } else {
    let lose = n - Math.max(0, t);
    const riders = FLOCK.filter(f => f.state === 'ride').sort((a, b) => b.slot - a.slot);
    while (lose > 0 && riders.length) { crashFollower(riders.shift(), 'gate', Math.random() < 0.5 ? -1 : 1); lose--; }
    if (lose > 0) { graze({}, Math.random() < 0.5 ? -1 : 1, false); }
    setFace('worried', 1200); tone(700, 150, 0.45, 'sawtooth', 0.05);
  }
  updateFlockHUD();
}
// ---------- particles ----------
const SPN = 500, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spVel = Array.from({ length: SPN }, () => new V3()), spLife = new Float32Array(SPN);
for (let i = 0; i < SPN; i++) spPos[i * 3 + 1] = -99;
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
scene.add(new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
let spNext = 0;
const SPARK = [[4, 2.6, 0.6], [4, 1.8, 0.4], [3, 3, 2.2]], CONF = [[4, 2.8, 0.2], [2.8, 1, 4], [0.8, 3, 4], [0.8, 4, 1.8]];
function burst(p, n, pal, sp) {
  recEvt('b', [p.x, p.y, p.z, n, pal === CONF ? 1 : 0, sp || 0]);
  for (let k = 0; k < n; k++) {
    const i = spNext; spNext = (spNext + 1) % SPN;
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spVel[i].set(rand(-1, 1), rand(-0.1, 1.3), rand(-1, 1)).normalize().multiplyScalar(rand(0.3, 1) * sp);
    spLife[i] = rand(0.4, 1.1);
    const c = pick(pal); spCol[i * 3] = c[0]; spCol[i * 3 + 1] = c[1]; spCol[i * 3 + 2] = c[2];
  }
}
function updateSparks(dt) {
  for (let i = 0; i < SPN; i++) {
    if (spLife[i] <= 0) continue;
    spLife[i] -= dt;
    if (spLife[i] <= 0) { spPos[i * 3 + 1] = -99; continue; }
    spVel[i].y -= 9.8 * dt; spVel[i].multiplyScalar(Math.pow(0.5, dt));
    spPos[i * 3] += spVel[i].x * dt; spPos[i * 3 + 1] += spVel[i].y * dt; spPos[i * 3 + 2] += spVel[i].z * dt;
    const fl = floorAt(spPos[i * 3], spPos[i * 3 + 2]);
    if (spPos[i * 3 + 1] < fl) { spPos[i * 3 + 1] = fl; spVel[i].y *= -0.3; }
    if (spLife[i] < 0.3) { spCol[i * 3] *= 0.93; spCol[i * 3 + 1] *= 0.93; spCol[i * 3 + 2] *= 0.93; }
  }
  spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
}
// ---------- debris: nuts, bolts, gears, washers, springs + machine oil ----------
const steelMat = new THREE.MeshStandardMaterial({ color: 0xbab8ca, metalness: 0.95, roughness: 0.28 });
const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x57545f, metalness: 0.9, roughness: 0.42 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xd2a449, metalness: 0.95, roughness: 0.3 });
function hexShape(r) { const s = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6, x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath(); return s; }
function holePath(r) { const h = new THREE.Path(); h.absarc(0, 0, r, 0, TAU, true); return h; }
function gearShape(R, teeth, hole) {
  const s = new THREE.Shape(), ri = R * 0.8;
  for (let i = 0; i < teeth; i++) {
    const a0 = i / teeth * TAU, st = TAU / teeth;
    [[ri, a0], [R, a0 + st * 0.22], [R, a0 + st * 0.5], [ri, a0 + st * 0.72]].forEach(([r, a], k) => { const x = Math.cos(a) * r, y = Math.sin(a) * r; (i === 0 && k === 0) ? s.moveTo(x, y) : s.lineTo(x, y); });
  }
  s.closePath(); s.holes.push(holePath(hole)); return s;
}
function extr(shape, depth) { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.15, bevelSize: depth * 0.1, bevelSegments: 1, curveSegments: 14 }); g.center(); return g; }
class Helix extends THREE.Curve { getPoint(t, target = new V3()) { const a = t * TAU * 5; return target.set(Math.cos(a) * 0.022, t * 0.09 - 0.045, Math.sin(a) * 0.022); } }
const nutShape = hexShape(0.034); nutShape.holes.push(holePath(0.016));
const Z = new V3(0, 0, 1), X = new V3(1, 0, 0);
const KINDS = [
  { make: () => new THREE.Mesh(extr(nutShape, 0.026), steelMat), axis: Z, half: 0.016, weight: 4 },
  { make: () => { const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 10), steelMat); sh.position.y = -0.04; g.add(sh); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 6), steelMat); hd.position.y = 0.016; g.add(hd); return g; }, axis: X, half: 0.03, weight: 4 },
  { make: () => new THREE.Mesh(extr(gearShape(0.05, 10, 0.014), 0.02), brassMat), axis: Z, half: 0.012, weight: 3 },
  { make: () => new THREE.Mesh(extr(gearShape(0.085, 14, 0.024), 0.024), darkSteelMat), axis: Z, half: 0.014, weight: 2 },
  { make: () => new THREE.Mesh(extr(gearShape(0.13, 20, 0.04), 0.03), brassMat), axis: Z, half: 0.018, weight: 1 },
  { make: () => new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 22), steelMat), axis: Z, half: 0.008, weight: 3 },
  { make: () => new THREE.Mesh(new THREE.TubeGeometry(new Helix(), 90, 0.005, 6), darkSteelMat), axis: X, half: 0.027, weight: 2 },
];
const debris = [];
for (const k of KINDS) for (let i = 0; i < k.weight * 3; i++) {
  const m = k.make(); m.visible = false; m.traverse(o => { o.castShadow = true; }); scene.add(m);
  debris.push({ m, k, v: new V3(), w: new V3(), on: false, ground: false, tq: new THREE.Quaternion() });
}
// oil: glossy drops with an oily sheen, splats that spread on the floor
const oilMat = new THREE.MeshPhysicalMaterial({ color: 0x0c0806, roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.8, iridescenceIOR: 1.35, iridescenceThicknessRange: [150, 520], envMapIntensity: 1.3 });
const dropGeo = new THREE.SphereGeometry(1, 12, 10);
const drops = Array.from({ length: 90 }, () => { const m = new THREE.Mesh(dropGeo, oilMat); m.visible = false; scene.add(m); return { m, v: new V3(), s: 0.02, on: false }; });
const splatGeos = Array.from({ length: 4 }, () => {
  const g = new THREE.CircleGeometry(1, 28); const p = g.attributes.position;
  const ph = [rand(0, TAU), rand(0, TAU), rand(0, TAU)];
  for (let i = 1; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), a = Math.atan2(y, x); const r = 1 + 0.16 * Math.sin(a * 3 + ph[0]) + 0.1 * Math.sin(a * 5 + ph[1]) + 0.07 * Math.sin(a * 8 + ph[2]); p.setXY(i, x * r, y * r); }
  g.rotateX(-Math.PI / 2); return g;
});
const splatMat = oilMat.clone(); splatMat.polygonOffset = true; splatMat.polygonOffsetFactor = -2; splatMat.polygonOffsetUnits = -2;
const splats = Array.from({ length: 50 }, (_, i) => { const m = new THREE.Mesh(splatGeos[i % 4], splatMat); m.visible = false; m.receiveShadow = true; scene.add(m); return { m, target: 0, t: 0 }; });
let splatNext = 0, dropNext = 0, dripUntil = 0, nextDrip = 0, cleaning = false;
function spawnDrop(pos, vel, size) { const d = drops[dropNext]; dropNext = (dropNext + 1) % drops.length; d.on = true; d.m.visible = true; d.m.position.copy(pos); d.v.copy(vel); d.s = size; d.m.scale.setScalar(size); }
function spawnSplat(x, z, size) {
  const s = splats[splatNext]; splatNext = (splatNext + 1) % splats.length;
  s.m.visible = true; s.m.position.set(x, floorAt(x, z) + 0.002 + splatNext * 0.00004, z); s.m.rotation.y = rand(0, TAU);
  s.target = size; s.t = 0; s.m.scale.setScalar(0.001);
}
function spawnDebris(center, pts, baseVel) {
  pts = pts && pts.length ? pts : [center]; baseVel = baseVel || new V3();
  const pool = debris.slice().sort(() => Math.random() - 0.5).slice(0, 34);
  for (const d of pool) {
    const p = pick(pts);
    d.on = true; d.ground = false; d.m.visible = true; d.m.scale.setScalar(1);
    d.m.position.copy(p).add(new V3(rand(-0.06, 0.06), rand(-0.06, 0.06), rand(-0.06, 0.06)));
    const out = new V3().subVectors(p, center); out.y = 0; if (out.lengthSq() < 1e-4) out.set(rand(-1, 1), 0, rand(-1, 1)); out.normalize();
    d.v.copy(out).multiplyScalar(rand(1.5, 4.5)).add(new V3(rand(-1.2, 1.2), rand(2.5, 6.5), rand(-1.2, 1.2))).addScaledVector(baseVel, rand(0.5, 0.85));
    d.w.set(rand(-18, 18), rand(-18, 18), rand(-18, 18));
    d.m.quaternion.setFromEuler(new THREE.Euler(rand(0, TAU), rand(0, TAU), rand(0, TAU)));
  }
  for (const p of pts) for (let i = 0; i < 4; i++) spawnDrop(p.clone().add(new V3(rand(-0.03, 0.03), 0, rand(-0.03, 0.03))), new V3(rand(-1.6, 1.6), rand(0.8, 3.2), rand(-1.6, 1.6)).addScaledVector(baseVel, rand(0.4, 0.7)), rand(0.012, 0.024));
  dripUntil = performance.now() + 2600; nextDrip = 0; cleaning = false;
}
function stepDebris(dt, now) {
  for (const d of debris) {
    if (!d.on) continue;
    d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt);
    const wl = d.w.length(); if (wl > 1e-3) { tq.setFromAxisAngle(tv.copy(d.w).multiplyScalar(1 / wl), wl * dt); d.m.quaternion.premultiply(tq); }
    const fl = floorAt(d.m.position.x, d.m.position.z) + d.k.half;
    if (d.m.position.y < fl && d.m.position.y > fl - 0.5) {
      d.m.position.y = fl;
      if (d.v.y < -1.2) { clank(-d.v.y * 0.4); if (-d.v.y > 3) burst(d.m.position, 3, SPARK, 2); }
      d.v.y *= -0.32; d.v.x *= 0.72; d.v.z *= 0.72; d.w.multiplyScalar(0.55);
      if (!d.ground) { d.ground = true; const align = new THREE.Quaternion().setFromUnitVectors(d.k.axis, Y); d.tq.setFromAxisAngle(Y, rand(0, TAU)).multiply(align); }
    }
    if (d.ground && d.v.lengthSq() < 0.6) { d.m.quaternion.slerp(d.tq, Math.min(1, dt * 10)); d.w.multiplyScalar(Math.pow(0.02, dt)); }
    if (d.m.position.y < -95) d.on = false;
  }
  for (const d of drops) {
    if (!d.on) continue;
    d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt);
    const sp = d.v.length(); d.m.scale.set(d.s, d.s * (1 + Math.min(1.2, sp * 0.12)), d.s);
    if (sp > 0.1) d.m.quaternion.setFromUnitVectors(Y, tv.copy(d.v).normalize());
    const fl = floorAt(d.m.position.x, d.m.position.z);
    if (d.m.position.y < fl + d.s * 0.5) { d.on = false; d.m.visible = false; spawnSplat(d.m.position.x, d.m.position.z, d.s * rand(2.6, 4.2)); }
  }
  if (now < dripUntil && now > nextDrip) {
    nextDrip = now + rand(90, 170);
    const cand = parts.filter(p => p.userData.caps && p.userData.caps.length);
    if (cand.length) { const p = pick(cand), c = pick(p.userData.caps); spawnDrop(p.localToWorld(c.clone()), new V3(rand(-0.3, 0.3), rand(-0.2, 0.3), rand(-0.3, 0.3)), rand(0.009, 0.016)); }
  }
}
function stepMess(dt) {
  for (const s of splats) {
    if (!s.m.visible) continue;
    if (cleaning) { s.m.scale.multiplyScalar(Math.pow(0.004, dt)); if (s.m.scale.x < 0.003) s.m.visible = false; continue; }
    if (s.t < 1) { s.t = Math.min(1, s.t + dt * 4); const e = 1 - Math.pow(1 - s.t, 3); s.m.scale.setScalar(Math.max(0.001, s.target * e)); }
  }
  if (cleaning) for (const d of debris) { if (!d.m.visible) continue; d.on = false; d.m.scale.multiplyScalar(Math.pow(0.004, dt)); if (d.m.scale.x < 0.02) d.m.visible = false; }
}

// ---------- sound ----------
let AC = null;
let MASTER = null, AUDIO_DEST = null;
// master chain: soft compressor + a small room reverb, so sounds sit in a space instead of beeping
let NOISE = null, REVERB_IN = null;
function OUT() {
  if (!MASTER) {
    MASTER = AC.createGain(); const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    MASTER.connect(comp); comp.connect(AC.destination);
    try { AUDIO_DEST = AC.createMediaStreamDestination(); comp.connect(AUDIO_DEST); } catch (e) { AUDIO_DEST = null; }
    try { const len = Math.floor(AC.sampleRate * 1.3), ir = AC.createBuffer(2, len, AC.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      const conv = AC.createConvolver(); conv.buffer = ir; const wet = AC.createGain(); wet.gain.value = 0.22; REVERB_IN = AC.createGain(); REVERB_IN.connect(conv); conv.connect(wet); wet.connect(comp); } catch (e) { REVERB_IN = null; }
    NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const nd = NOISE.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  return MASTER;
}
function sendOut(node, rev) { node.connect(OUT()); if (REVERB_IN && rev) { const g = AC.createGain(); g.gain.value = rev; node.connect(g); g.connect(REVERB_IN); } }
// filtered noise burst: thuds, scrapes, whooshes
function noise(t, dur, vol, type, f0, f1, q) { const src = AC.createBufferSource(); src.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur); const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(f); f.connect(g); sendOut(g, 0.25); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05); }
function initAudio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } else if (AC.state === 'suspended') AC.resume(); }
function tone(f0, f1, dur, type, vol, delay) {
  recEvt('t', [f0, f1, dur, type, vol, delay || 0]);
  if (!AC) return; OUT();
  const t = AC.currentTime + (delay || 0);
  // low sweeps are impacts: a sine body plus a burst of low noise
  if (f0 < 220 && f1 < f0) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0 * 1.4, t); o.frequency.exponentialRampToValueAtTime(Math.max(25, f1 * 0.8), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 1.3, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); sendOut(g, 0.3); o.start(t); o.stop(t + dur + 0.05); noise(t, Math.min(0.5, dur * 0.8), vol * 0.9, 'lowpass', 900, 120, 0.7); return; }
  // everything else: soft rounded voice (triangle + sine an octave up), low-passed, with a gentle attack — no chiptune buzz
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(Math.max(f0, f1) * 2.2, 700, 5200); lp.Q.value = 0.5;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * (type === 'sine' ? 1 : 0.8), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [mul, v, w] of [[1, 1, type === 'sine' ? 'sine' : 'triangle'], [2, 0.25, 'sine'], [1.004, 0.5, 'sine']]) { const o = AC.createOscillator(), og = AC.createGain(); o.type = w; og.gain.value = v; o.frequency.setValueAtTime(f0 * mul, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * mul), t + dur); o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
  lp.connect(g); sendOut(g, 0.18);
  if (type === 'sawtooth' && f1 < f0) noise(t, dur * 0.7, vol * 0.5, 'bandpass', f0 * 2, f1 * 2, 2); // scrapes and rips get a grainy layer
}
let lastClank = 0;
let clankN = 0, clankWin = 0;
function clank(v) { // small knocks: a soft dull thud; only big hits ring like metal. Never more than ~4 a second.
  const now = performance.now(); if (now - lastClank < 150) return; if (now - clankWin > 1000) { clankWin = now; clankN = 0; } if (++clankN > 4) return; lastClank = now;
  recEvt('t', [300, 150, 0.1, 'sine', 0.02, 0]); if (!AC) return; OUT();
  const t = AC.currentTime;
  if (v < 7) { noise(t, 0.09, Math.min(0.05, 0.012 + v * 0.006), 'lowpass', 500, 160, 0.7); return; }
  const vol = Math.min(0.07, 0.02 + v * 0.004), f = rand(260, 420);
  for (const [r, a2, d] of [[1, 1, 0.22], [2.43, 0.45, 0.14], [3.87, 0.25, 0.09]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f * r; g.gain.setValueAtTime(vol * a2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); sendOut(g, 0.25); o.start(t); o.stop(t + d + 0.05); }
  noise(t, 0.08, vol * 0.8, 'lowpass', 900, 200, 0.7);
}

// ---------- replay: record every run, film it back with a virtual camera crew ----------
let REC = null, LAST_REC = null, PLAY = null;
// on-screen overlays, mirrored into recorded videos
const OVL = { items: [] };
function ovlAdd(text, cls, slot) { OVL.items.push({ text, cls, slot: slot || 0, t: performance.now(), kind: 'pop' }); if (OVL.items.length > 12) OVL.items.shift(); }
function socialFx(kind) {
  recEvt('u', [kind]);
  const el = document.createElement('div'); el.className = 'social'; el.innerHTML = kind === 'like' ? '<span>👍</span> LIKE' : 'SUBSCRIBE <span>🔔</span>';
  stage.appendChild(el); setTimeout(() => el.remove(), 1200);
  if (!reduceMotion) { const fl = document.createElement('div'); fl.className = 'flash'; stage.appendChild(fl); setTimeout(() => fl.remove(), 350); }
  OVL.items.push({ kind, t: performance.now() });
  tone(880, 880, 0.12, 'sine', 0.08); tone(1320, 1320, 0.18, 'sine', 0.07, 0.12);
}
const STATE_CODE = { intro: 0, ride: 1, passed: 2, crashed: 3, result: 4 };
function recEvt(kind, data) { if (REC && REC.on && !PLAY) REC.cur.push([kind, data]); }
function recStart() { REC = { on: true, frames: [], cur: [], acc: 0, test: 0, trick: '', dur: 0 }; }
function recStop() { if (REC && REC.on) { REC.on = false; REC.dur = REC.frames.reduce((a, f) => a + f.dt, 0); LAST_REC = REC; } }
const _wp = new V3(), _wq = new THREE.Quaternion();
function recordFrame(dt) {
  if (!REC || !REC.on) return;
  REC.acc += dt; if (REC.acc < 1 / 30) return;
  if (REC.frames.length > 1900) { recStop(); return; }
  const P = new Float32Array(parts.length * 7);
  parts.forEach((p, i) => { p.getWorldPosition(_wp); p.getWorldQuaternion(_wq); P.set([_wp.x, _wp.y, _wp.z, _wq.x, _wq.y, _wq.z, _wq.w], i * 7); });
  const FL = recFlock();
  const B = new Float32Array([board.position.x, board.position.y, board.position.z, board.quaternion.x, board.quaternion.y, board.quaternion.z, board.quaternion.w]);
  const bar = new Float32Array(OBS.barrels.map(b => b.s));
  const con = new Float32Array(OBS.cones.length * 6);
  OBS.cones.forEach((c, i) => con.set([c.g.position.x, c.g.position.y, c.g.position.z, c.g.rotation.x, c.g.rotation.y, c.g.rotation.z], i * 6));
  let tnt = 0; TNTS.forEach((n, i) => { if (n.alive) tnt |= 1 << i; });
  let spr = 0; SPARES.forEach((s, i) => { if (!s.taken) spr |= 1 << i; });
  const deb = []; debris.forEach((d, i) => { if (d.m.visible) deb.push(i, d.m.position.x, d.m.position.y, d.m.position.z, d.m.quaternion.x, d.m.quaternion.y, d.m.quaternion.z, d.m.quaternion.w, d.m.scale.x); });
  const drp = []; drops.forEach((d, i) => { if (d.m.visible) drp.push(i, d.m.position.x, d.m.position.y, d.m.position.z, d.m.quaternion.x, d.m.quaternion.y, d.m.quaternion.z, d.m.quaternion.w, d.m.scale.x, d.m.scale.y); });
  const spl = []; splats.forEach((s, i) => { if (s.m.visible) spl.push(i, s.m.position.x, s.m.position.y, s.m.position.z, s.m.rotation.y, s.m.scale.x); });
  const DR = new Float32Array([drone.visible ? 1 : 0, drone.position.x, drone.position.y, drone.position.z, drone.rotation.x, drone.rotation.z]);
  const GX = { can: CANNON.on || (cannonG.visible && !!cannonG.parent) ? (CANNON.k === 'L' ? 1 : CANNON.k === 'R' ? 2 : (cannonG.parent === byName.foreL ? 1 : 2)) : 0, cs: cannonG.scale.x, sh: bubble.visible ? 1 : 0, dead: DESTR.map(dd => dd.obj.dead ? 1 : 0), pk: PICKS.map(p => p.taken ? 0 : 1), so: SOCIAL.map(p => p.taken ? 0 : 1), pj: PROJ.flatMap(p => p.on ? [p.m.position.x, p.m.position.y, p.m.position.z] : []), fm: formRec() };
  let DL = null; if (DLV) { DL = [D.left, D.t, D.tip]; SLC.meshes.forEach((m, i) => { if (SLC.on[i] && m.visible) DL.push(i, m.position.x, m.position.y, m.position.z, m.quaternion.x, m.quaternion.y, m.quaternion.z, m.quaternion.w); }); }
  const FXR = new Float32Array([ANVIL.visible ? 1 : 0, ANVIL.position.x, ANVIL.position.y, ANVIL.position.z, ANVIL_RING.visible ? 1 : 0, ...RAIN.flatMap(r => r.on ? [r.m.position.x, r.m.position.y, r.m.position.z] : [])]);
  REC.frames.push({ DL, FXR, FL, GX, DR, dt: REC.acc, st: STATE_CODE[state] ?? 1, face: faceMode, simT, P, B, bar, con, tnt, spr, deb: new Float32Array(deb), drp: new Float32Array(drp), spl: new Float32Array(spl), ev: REC.cur, hp: HP });
  REC.acc = 0; REC.cur = [];
}
// virtual director: plan hard cuts every ~2-3 s, choosing shots around what happens next
const SHOTS = ['chase', 'helmet', 'roadside', 'orbit360', 'side', 'lowchase', 'drone', 'wide', 'helmet', 'roadside'];
const SHOT_LEN = { orbit360: 2.8, roadside: 2.4, helmet: 2.2, landing: 1.2, side: 1.8, drone: 1.8, wide: 1.8, chase: 1.8, lowchase: 1.8 };
function planShots(rec) {
  const fr = rec.frames, cum = []; let t = 0; for (const f of fr) { cum.push(t); t += f.dt; } const total = t;
  const torsoI = parts.indexOf(torso) * 7;
  const firstOf = code => { const i = fr.findIndex(f => f.st === code); return i < 0 ? null : cum[i]; };
  const introEnd = firstOf(1) ?? 0, crashT = firstOf(3), passT = firstOf(2);
  const evTimes = []; fr.forEach((f, i) => { for (const [k, d] of f.ev) if ((k === 'p' && /CLOSE|GONE|ARM|HEADLESS|BOING|KABOOM|SLAM|SLIPPERY|WHOA|BOOST|DESTROYED|SHIELD|CANNON|TNT RAIN|MOON|ROCKET|OIL|REPAIR|SUPER|ANVIL|MATRIX|FLATTENED/.test(d[0])) || k === 'x' || k === 'u') evTimes.push(cum[i]); });
  // highlight ranges: the drop, every big moment, and the crash or finish; calm riding is cut out
  let ranges = [[0, introEnd + 0.8]];
  for (const e of evTimes) ranges.push([Math.max(0, e - 1.0), e + 0.8]);
  if (crashT != null) ranges.push([Math.max(0, crashT - 1.7), total]);
  else if (passT != null) ranges.push([Math.max(0, passT - 1.4), total]);
  if (evTimes.length < 3) { const end = crashT ?? passT ?? total; for (let x = introEnd + 3; x < end - 3; x += 4) ranges.push([x, x + 1.4]); }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = []; for (const r of ranges) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1] + 0.5) last[1] = Math.max(last[1], r[1]); else merged.push([r[0], Math.min(total, r[1])]); }
  const airAt = tt => { const i = cum.findIndex(c => c >= tt); if (i < 0) return false; return fr[i].P[torsoI + 1] > 2.9; };
  const shots = []; let last = '', k = 0;
  for (const [a, b] of merged) {
    let tt = a;
    while (tt < b - 0.15) {
      let seg, type;
      if (tt < introEnd - 0.1) { type = 'intro'; seg = Math.min(b, introEnd - 0.05); }
      else if (crashT != null && tt >= crashT - 0.95 && tt < crashT) { type = 'face'; seg = crashT + 0.05; }
      else if (crashT != null && tt >= crashT) { type = 'orbit'; seg = b; }
      else {
        const air = airAt(tt + 0.6), hasEv = evTimes.some(e => e >= tt && e <= tt + 1.8);
        if (Math.abs(tt - introEnd) < 0.2) type = 'landing';
        else if (air) type = pick(['side', 'roadside', 'orbit360'].filter(x => x !== last));
        else if (hasEv) type = pick(['helmet', 'roadside', 'lowchase', 'chase', 'helmet'].filter(x => x !== last));
        else type = pick(SHOTS.filter(x => x !== last));
        seg = Math.min(b, tt + (SHOT_LEN[type] || 1.8));
        if (crashT != null && seg > crashT - 0.95) { seg = crashT - 0.95; if (seg - tt < 0.3) { tt = seg; continue; } }
      }
      shots.push({ t0: tt, type }); last = type; tt = seg;
    }
  }
  return { shots, cum, total, crashT, evTimes, ranges: merged, ri: 0 };
}
function startFilm(rec, fromResult, record) {
  if (!rec || !rec.frames.length) return;
  if (liveRecOn()) finishLiveRec(); liveWant = false;
  recStop();
  if (rec.gates) layoutGates(rec.gates);
  const dSave = DLV ? { left: D.left, t: D.t, tip: D.tip } : null;
  PLAY = { dSave, wantRec: !!record, rec, t: 0, i: 0, fired: -1, fromResult, ...planShots(rec), shotI: -1, fixed: new V3(), orbitA: 0, slowUntil: 0, slowAt: -1, replayed: false, zoom: 0 };
  state = 'replay';
  $('result').hidden = true; $('replays').hidden = true;
  stage.classList.add('clean', 'filming'); $('bShow').hidden = true;
  if (!stage.classList.contains('nohook')) { $('hook').classList.add('show'); setTimeout(() => $('hook').classList.remove('show'), 2400); }
  for (const p of parts) scene.attach(p);
  for (const f of FLOCK) { f.rig.visible = false; for (const p of f.parts) scene.attach(p); }
  for (const d of debris) { d.on = false; d.m.visible = false; }
  for (const d of drops) { d.on = false; d.m.visible = false; }
  for (const s of splats) { s.m.visible = false; s.t = 1; }
  for (const c of OBS.cones) c.hit = false;
  BB.free = false; dripUntil = 0;
  if (rollGain && AC) rollGain.gain.setTargetAtTime(0, AC.currentTime, 0.05);
  snapCam = true;
}
function endFilm() {
  if (!PLAY) return;
  const back = PLAY.fromResult, dSave = PLAY.dSave; PLAY = null;
  if (DLV && dSave) { Object.assign(D, dSave, { hudKey: null }); dlvHud(); SLC.meshes.forEach((m, i) => { m.visible = !!SLC.on[i]; }); } $('hook').classList.remove('show');
  head.visible = true; // the helmet camera hides the head during its shot; bring it back whatever shot the film ended on
  if (recorder) stopRecorder().then(showVideoCard); drone.visible = false; grade.uniforms.sat.value = GSAT(); $('rew').hidden = true; camera.fov = baseFov(); camera.updateProjectionMatrix();
  stage.classList.remove('filming', 'clean');
  if (back) { state = 'result'; $('result').hidden = false; } else resetRun();
}
const _pa = new V3(), _pb = new V3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function fireEvents(f) {
  for (const [k, d] of f.ev) {
    if (k === 'b') burst(new V3(d[0], d[1], d[2]), d[3], d[4] ? CONF : SPARK, d[5]);
    else if (k === 't') tone(d[0], d[1], d[2], d[3], d[4], d[5]);
    else if (k === 'p') { lastPop = 0; pop(d[0], d[1]); }
    else if (k === 'x') explodeVisual(new V3(d[0], d[1], d[2]));
    else if (k === 'u') socialFx(d[0]);
    else if (k === 'g') gateFlash(d[0], d[1]);
    else if (k === 'v') revealFx(d[0], true);
  }
}
function replayFrame(rdt) {
  const P = PLAY, fr = P.rec.frames;
  if (P.rew) return rewindFrame(rdt);
  const ev = P.evTimes.find(e => e > P.slowAt && e <= P.t + 0.15);
  if (ev != null) { P.slowAt = ev; P.slowUntil = P.t + 0.35; }
  const nearCrash = P.crashT != null && P.t > P.crashT - 0.9 && P.t < P.crashT + 0.9;
  const dt = rdt * (P.inReplay ? 0.75 : 1);
  P.t += dt;
  if (!P.inReplay && P.ranges && P.ri < P.ranges.length && P.t > P.ranges[P.ri][1]) {
    P.ri++;
    if (P.ri < P.ranges.length) { P.t = P.ranges[P.ri][0]; P.i = 0; while (P.i < fr.length - 1 && P.cum[P.i + 1] <= P.t) P.i++; P.fired = P.i; P.shotI = P.shots.findIndex(s => s.t0 > P.t) - 1; if (P.shotI < -1) P.shotI = P.shots.length - 1; P.cut = true; }
  }
  while (P.i < fr.length - 1 && P.cum[P.i + 1] <= P.t) P.i++;
  for (let j = P.fired + 1; j <= P.i; j++) fireEvents(fr[j]);
  P.fired = P.i;
  applyRecFrame(P, dt, rdt);
  // camera crew
  cameraCrew(P, dt);
}
const _im = [new Map(), new Map()]; let _imK = 0;
function idxMap(arr, step) { const m = _im[_imK = 1 - _imK]; m.clear(); for (let o = 0; o < arr.length; o += step) m.set(arr[o], o); return m; }
// delivery HUD + flying slices in a replay: exactly what was on screen in that frame (pieces, timer, tip)
function dlvApplyRec(f0, f1, a) {
  const A = f0.DL, B = f1.DL || A;
  D.left = A[0]; D.t = lerp(A[1], B[1], a); D.tip = lerp(A[2], B[2], a);
  const key = D.left + '|' + Math.ceil(DLV.time - D.t) + '|' + Math.round(D.tip);
  if (key !== D.hudKey) { D.hudKey = key; dlvHud(); }
  const seen = new Set();
  for (let o = 3; o < A.length; o += 8) {
    const i = A[o], m = SLC.meshes[i]; if (!m) continue; seen.add(i);
    let o1 = -1; for (let q = 3; q < B.length; q += 8) if (B[q] === i) { o1 = q; break; }
    m.visible = true; m.position.set(A[o + 1], A[o + 2], A[o + 3]); m.quaternion.set(A[o + 4], A[o + 5], A[o + 6], A[o + 7]);
    if (o1 >= 0) { _pb.set(B[o1 + 1], B[o1 + 2], B[o1 + 3]); m.position.lerp(_pb, a); _qb.set(B[o1 + 4], B[o1 + 5], B[o1 + 6], B[o1 + 7]); m.quaternion.slerp(_qb, a); }
  }
  SLC.meshes.forEach((m, i) => { if (!seen.has(i)) m.visible = false; });
}
function applyRecFrame(P, dt, rdt) {
  const fr = P.rec.frames;
  const f0 = fr[P.i], f1 = fr[Math.min(P.i + 1, fr.length - 1)];
  const a = f1 === f0 ? 0 : clamp((P.t - P.cum[P.i]) / Math.max(1e-4, f1.dt), 0, 1);
  parts.forEach((p, i) => { const o = i * 7; _pa.fromArray(f0.P, o); _pb.fromArray(f1.P, o); p.position.lerpVectors(_pa, _pb, a); _qa.fromArray(f0.P, o + 3); _qb.fromArray(f1.P, o + 3); p.quaternion.slerpQuaternions(_qa, _qb, a); });
  applyFlockRec(f0, f1, a);
  if (f0.FXR) { const X = f0.FXR; ANVIL.visible = !!X[0]; ANVIL.position.set(X[1], X[2], X[3]); ANVIL_RING.visible = !!X[4]; if (X[4]) ANVIL_RING.position.set(X[1], (trackH(-X[3]) ?? 0) + 0.02, X[3]); RAIN.forEach((r, k) => { const o = 5 + k * 3; r.m.visible = o + 2 < X.length; if (r.m.visible) r.m.position.set(X[o], X[o + 1], X[o + 2]); }); } else { ANVIL.visible = false; ANVIL_RING.visible = false; for (const r of RAIN) r.m.visible = false; }
  _pa.fromArray(f0.B, 0); _pb.fromArray(f1.B, 0); board.position.lerpVectors(_pa, _pb, a); _qa.fromArray(f0.B, 3); _qb.fromArray(f1.B, 3); board.quaternion.slerpQuaternions(_qa, _qb, a);
  simT = lerp(f0.simT, f1.simT, a);
  OBS.barrels.forEach((b, i) => { b.s = lerp(f0.bar[i], f1.bar[i], a); });
  OBS.cones.forEach((c, i) => { const o = i * 6; c.g.position.set(lerp(f0.con[o], f1.con[o], a), lerp(f0.con[o + 1], f1.con[o + 1], a), lerp(f0.con[o + 2], f1.con[o + 2], a)); c.g.rotation.set(lerp(f0.con[o + 3], f1.con[o + 3], a), lerp(f0.con[o + 4], f1.con[o + 4], a), lerp(f0.con[o + 5], f1.con[o + 5], a)); });
  TNTS.forEach((n, i) => { n.alive = !!(f0.tnt & (1 << i)); n.g.visible = n.alive; });
  SPARES.forEach((s, i) => { s.taken = !(f0.spr & (1 << i)); s.m.visible = !s.taken; });
  for (const d of debris) d.m.visible = false;
  const d1 = idxMap(f1.deb, 9);
  for (let o = 0; o < f0.deb.length; o += 9) { const m = debris[f0.deb[o]].m, o1 = d1.get(f0.deb[o]); m.visible = true; m.position.set(f0.deb[o + 1], f0.deb[o + 2], f0.deb[o + 3]); m.quaternion.set(f0.deb[o + 4], f0.deb[o + 5], f0.deb[o + 6], f0.deb[o + 7]); if (o1 != null) { _pb.set(f1.deb[o1 + 1], f1.deb[o1 + 2], f1.deb[o1 + 3]); m.position.lerp(_pb, a); _qb.set(f1.deb[o1 + 4], f1.deb[o1 + 5], f1.deb[o1 + 6], f1.deb[o1 + 7]); m.quaternion.slerp(_qb, a); } m.scale.setScalar(f0.deb[o + 8]); }
  for (const d of drops) d.m.visible = false;
  const r1 = idxMap(f1.drp, 10);
  for (let o = 0; o < f0.drp.length; o += 10) { const m = drops[f0.drp[o]].m, o1 = r1.get(f0.drp[o]); m.visible = true; m.position.set(f0.drp[o + 1], f0.drp[o + 2], f0.drp[o + 3]); if (o1 != null) { _pb.set(f1.drp[o1 + 1], f1.drp[o1 + 2], f1.drp[o1 + 3]); m.position.lerp(_pb, a); } m.quaternion.set(f0.drp[o + 4], f0.drp[o + 5], f0.drp[o + 6], f0.drp[o + 7]); m.scale.set(f0.drp[o + 8], f0.drp[o + 9], f0.drp[o + 8]); }
  for (const s of splats) s.m.visible = false;
  for (let o = 0; o < f0.spl.length; o += 6) { const s = splats[f0.spl[o]]; s.m.visible = true; s.t = 1; s.m.position.set(f0.spl[o + 1], f0.spl[o + 2], f0.spl[o + 3]); s.m.rotation.y = f0.spl[o + 4]; s.m.scale.setScalar(f0.spl[o + 5]); }
  faceMode = f0.face;
  if (DLV && f0.DL) dlvApplyRec(f0, f1, a);
  if (f0.GX) { const G = f0.GX;
    for (const k of ['L', 'R']) byName['hand' + k].visible = !(G.can === (k === 'L' ? 1 : 2) && G.cs > 0.3);
    if (G.can) { const fore = byName[G.can === 1 ? 'foreL' : 'foreR']; if (cannonG.parent !== fore) { const k = G.can === 1 ? 'L' : 'R', wrist = NODE['hand' + k].p, elbow = NODE['fore' + k].p, dir = wrist.clone().sub(elbow).normalize(); fore.add(cannonG); cannonG.position.copy(wrist).sub(fore.userData.restPos).addScaledVector(dir, -0.05); cannonG.quaternion.setFromUnitVectors(Y, dir); } cannonG.visible = true; cannonG.scale.setScalar(Math.max(0.01, G.cs)); } else cannonG.visible = false;
    DESTR.forEach((dd, i) => { const dead = !!G.dead[i]; dd.vis.visible = !dead; if (dd.also) for (const a of dd.also) a.visible = !dead; });
    if (G.so) SOCIAL.forEach((p, i) => { p.m.visible = !!G.so[i]; if (p.m.visible) { p.m.position.set(p.x, 1.4 + Math.sin(simT * 2.5 + p.s) * 0.2, -p.s); p.m.rotation.set(0, Math.sin(simT * 2) * 0.5 + Math.PI, 0); } });
    PICKS.forEach((p, i) => { p.m.visible = !!G.pk[i]; if (p.m.visible) { p.m.position.set(p.x, 1.25 + Math.sin(simT * 3 + p.s) * 0.2, -p.s); p.m.rotation.set(0.3, simT * 2, 0.2); } });
    PROJ.forEach(p => { p.m.visible = false; }); for (let o = 0, j = 0; o < G.pj.length; o += 3, j++) { PROJ[j].m.visible = true; PROJ[j].m.position.set(G.pj[o], G.pj[o + 1], G.pj[o + 2]); }
    formApply(G.fm);
    bubble.visible = !!G.sh; if (bubble.visible) { torso.getWorldPosition(bubble.position); bubble.material.opacity = 0.14; }
  }
  if (f0.DR) { drone.visible = !!f0.DR[0]; drone.position.set(f0.DR[1], f0.DR[2], f0.DR[3]); if (f1.DR) drone.position.lerp(_pb.set(f1.DR[1], f1.DR[2], f1.DR[3]), a); drone.rotation.set(f0.DR[4], 0, f0.DR[5]); for (const r of rotors) r.rotation.y += rdt * 40; }
  for (const sw of SAWS) { if (sw.A) { sw.x = sw.x0 + Math.sin(simT * sw.w + sw.ph) * sw.A; sw.g.position.x = sw.x; } sw.g.rotation.z = -14 * simT; }
  BIG.rotation.z = -6 * simT; ringAnimate(simT);
  animateObstacles(simT, dt, -1e9); animateBooms(dt, simT);
  for (const sp of SPARES) if (!sp.taken) { sp.m.position.set(sp.x, 1.2 + Math.sin(simT * 3 + sp.s) * 0.18, -sp.s); sp.m.rotation.set(0.4, simT * 1.8, 0.2); }
  drawFace(performance.now()); updateSparks(Math.abs(dt));
}
const FACE_D = MODEL.hdr.decals.find(d => d.kind === 'face');
const FACE_N = FACE_D ? new V3(...FACE_D.n).normalize() : new V3(0, 0, 1), FACE_OFF = FACE_D ? new V3(...FACE_D.p).sub(head.userData.restPos) : new V3();
function recTorsoAt(P, t, out) { const fr = P.rec.frames, ti = parts.indexOf(torso) * 7; let i = 0; while (i < fr.length - 1 && P.cum[i + 1] <= t) i++; return out.fromArray(fr[i].P, ti); }
function cameraCrew(P, dt) {
  const fr = P.rec.frames;
  while (P.shotI < P.shots.length - 1 && P.shots[P.shotI + 1].t0 <= P.t) { P.shotI++; P.cut = true; }
  const shot = P.shots[Math.max(0, P.shotI)], T = torso.position, type = shot ? shot.type : 'chase';
  const tgt = tv.copy(T), st = P.t - (shot ? shot.t0 : 0);
  if (P.cut) {
    P.cut = false; snapCam = true;
    if (type === 'orbit') P.orbitA = Math.atan2(camera.position.x - T.x, camera.position.z - T.z);
    if (type === 'orbit360') P.orbitA = rand(0, TAU);
    if (type === 'intro') P.fixed.set(2.6, 1.4, -7.5);
    if (type === 'roadside') { const fut = recTorsoAt(P, P.t + 1.1, new V3()), sd = Math.random() < 0.5 ? -1 : 1; P.fixed.set(sd * (HALF + rand(1.8, 3.2)), rand(0.7, 1.6), fut.z - rand(1, 3)); }
  }
  const pos = new V3(), look = new V3(); let fov = baseFov();
  switch (type) {
    case 'intro': pos.copy(P.fixed); look.copy(tgt).add(new V3(0, 0.3, 0)); break;
    case 'landing': pos.set(tgt.x - 2.8, Math.max(0.7, tgt.y + 0.4), tgt.z + 3.4); look.set(tgt.x, tgt.y + 0.5, tgt.z - 4); break;
    case 'helmet': { // GoPro on the helmet, looking down the track
      const hidden = !head.visible || head.position.distanceTo(T) > 1.4;
      pos.copy(hidden ? tv2.copy(T).add(new V3(0, 0.9, 0.3)) : head.position).add(new V3(rand(-0.008, 0.008), 0.3 + rand(-0.008, 0.008), 0.02));
      look.copy(pos).add(new V3(0, -0.6, -8)); fov = Math.max(baseFov(), 96); break; }
    case 'roadside': { // rally camera on the verge: waits ahead, pans and zooms as he blasts past
      pos.copy(P.fixed); look.set(tgt.x, tgt.y + 0.6, tgt.z); const d = pos.distanceTo(tgt); fov = clamp(12 + d * 2.2, 14, baseFov()); break; }
    case 'orbit360': P.orbitA += dt * TAU / 2.6; pos.set(T.x + Math.sin(P.orbitA) * 4.4, T.y + 1.4, T.z + Math.cos(P.orbitA) * 4.4); look.set(T.x, T.y + 0.4, T.z); break;
    case 'side': pos.set(tgt.x + 7, tgt.y + 1.1, tgt.z + 1.5); look.set(tgt.x, tgt.y + 0.4, tgt.z - 3); break;
    case 'lowchase': pos.set(tgt.x + 0.9, Math.max(0.3, tgt.y + 0.1), tgt.z + 2.7); look.set(tgt.x, tgt.y + 0.6, tgt.z - 7); fov = baseFov() + 8; break;
    case 'drone': pos.set(tgt.x * 0.3, tgt.y + 8.5, tgt.z + 7.5); look.set(tgt.x, tgt.y, tgt.z - 10); break;
    case 'wide': pos.set(tgt.x - 9, tgt.y + 3, tgt.z + 5); look.set(tgt.x, tgt.y, tgt.z - 7); break;
    case 'face': { // close-up of the LED screen just before the crash
      if (head.userData.detached || head.position.distanceTo(T) > 1.4) { pos.set(T.x + 1.2, T.y + 0.8, T.z - 2.2); look.copy(T); fov = baseFov() - 10; break; }
      const fw = tv2.copy(FACE_N).applyQuaternion(head.quaternion), fp = FACE_OFF.clone().applyQuaternion(head.quaternion).add(head.position);
      fw.y = Math.max(-0.2, Math.min(0.35, fw.y)); fw.normalize();
      pos.copy(fp).addScaledVector(fw, 1.9).add(new V3(0, 0.12, 0)); look.copy(fp); fov = baseFov() - 22 - Math.min(6, st * 8); break; }
    case 'orbit': P.orbitA += dt * 1.3; pos.set(T.x + Math.sin(P.orbitA) * 6.5, Math.max(T.y + 2.4, floorAt(T.x, T.z) + 1.6), T.z + Math.cos(P.orbitA) * 6.5); look.copy(T); break;
    default: pos.set(tgt.x * 0.7, tgt.y + 2.2, tgt.z + 6.6); look.set(tgt.x * 0.85, tgt.y + 0.4, tgt.z - 9);
  }
  if (type === 'helmet') { head.visible = false; bubble.visible = false; }
  wantPos.copy(pos); wantLook.copy(look);
  P.roll = 0; P.fov = fov; P.rigid = type !== 'roadside' && type !== 'face' && type !== 'orbit';
  if (P.crashT != null && !P.replayed && P.t > P.total + 0.2) {
    P.replayed = true; P.inReplay = true; P.t = Math.max(0, P.crashT - 0.5); P.i = 0; while (P.i < fr.length - 1 && P.cum[P.i + 1] <= P.t) P.i++; P.fired = P.i;
    P.shots = [{ t0: 0, type: pick(['helmet', 'side', 'orbit360']) }]; P.shotI = -1; P.total = Math.min(P.total, P.crashT + 1.3); lastPop = 0; pop('REPLAY', 'lilac');
  } else if (P.t > P.total + 0.4) { if (LOOP) startRewind(); else endFilm(); }
}

// the loop: after the film, rewind the whole run at speed and stop exactly on the opening frame,
// so when YouTube restarts the Short the first frame follows the last one seamlessly
let LOOP = true; try { LOOP = localStorage.getItem('daggie-loop') !== '0'; } catch (e) {}
function startRewind() {
  const P = PLAY, from = Math.min(P.t, P.cum[P.cum.length - 1]);
  P.rew = { u: 0, from, dur: clamp(0.9 + from * 0.05, 1.3, 2.3), hold: 0 };
  P.inReplay = false; P.fired = 1e9; lastPop = 0;
  for (const it of OVL.items) it.t = -1e9;
  $('pops').textContent = ''; $('rew').hidden = false; $('hook').classList.remove('show');
  grade.uniforms.sat.value = 0.75;
  tone(300, 2600, P.rew.dur * 0.85, 'sawtooth', 0.025); tone(150, 1300, P.rew.dur * 0.85, 'triangle', 0.03);
}
function rewindFrame(rdt) {
  const P = PLAY, W = P.rew, fr = P.rec.frames;
  if (W.u < 1) W.u = Math.min(1, W.u + rdt / W.dur); else W.hold += rdt;
  const u = W.u, e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const prevT = P.t; P.t = W.from * (1 - e);
  P.i = 0; while (P.i < fr.length - 1 && P.cum[P.i + 1] <= P.t) P.i++; P.fired = P.i;
  applyRecFrame(P, rdt, rdt);
  // camera: chase the body backwards, then glide into the exact opening shot
  const T = torso.position, w = clamp((u - 0.6) / 0.35, 0, 1), k = w * w * (3 - 2 * w);
  const cp = new V3(T.x * 0.6 + 1.2, T.y + 2.4, T.z + 6.5), cl = new V3(T.x, T.y + 0.4, T.z - 5);
  const ip = new V3(2.6, 1.4, -7.5), il = tv.copy(T).add(new V3(0, 0.3, 0));
  wantPos.copy(cp.lerp(ip, k)); wantLook.copy(cl.lerp(il, k)); snapCam = true;
  P.roll = 0; P.fov = baseFov();
  $('rew').hidden = u > 0.72;
  if (u > 0.8) { grade.uniforms.sat.value = GSAT(); if (!stage.classList.contains('nohook')) $('hook').classList.add('show'); }
  if (W.hold > 0.15) endFilm();
}
// saved replays (kept on this device)
async function idbDel(key) { try { const db = await idbOpen(); await new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(key); tx.oncomplete = res; tx.onerror = res; }); } catch (e) {} }
async function saveReplay() {
  const rec = LAST_REC; if (!rec) return;
  const id = Date.now(), meta = { id, level: L.id, test: rec.test, ok: rec.ok, cause: rec.cause, dist: rec.dist, trick: rec.trick, date: new Date().toLocaleString() };
  await idbPut('replay:' + id, { frames: rec.frames, test: rec.test, gates: rec.gates });
  const list = (await idbGet('replays:list')) || []; list.unshift(meta);
  while (list.length > 30) { const old = list.pop(); await idbDel('replay:' + old.id); }
  await idbPut('replays:list', list);
  $('rSave').textContent = '★ Saved'; $('rSave').disabled = true;
}
async function openReplays() {
  const list = ((await idbGet('replays:list')) || []).filter(m => (m.level || 'sky') === L.id);
  const ul = $('repList'); ul.textContent = '';
  if (!list.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No saved replays yet. Finish a run and tap ★ Save.'; ul.appendChild(li); }
  for (const m of list) {
    const li = document.createElement('li');
    const info = document.createElement('div'); info.className = 'info';
    const b = document.createElement('b'); b.textContent = 'Test #' + String(m.test).padStart(3, '0') + (m.ok ? ' · passed' : ' · ' + (m.cause || 'failed'));
    const sm = document.createElement('small'); sm.textContent = (m.dist || 0) + ' m · ' + (m.trick || '') + ' · ' + m.date;
    info.append(b, sm);
    const play = document.createElement('button'); play.type = 'button'; play.textContent = '🎬 Film';
    play.onclick = async () => { const r = await idbGet('replay:' + m.id); if (r) { initAudio(); startFilm({ frames: r.frames, gates: r.gates }, false); } };
    const del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = 'Delete'; del.setAttribute('aria-label', 'Delete replay');
    del.onclick = async () => { await idbDel('replay:' + m.id); const l2 = ((await idbGet('replays:list')) || []).filter(x => x.id !== m.id); await idbPut('replays:list', l2); openReplays(); };
    const vid = document.createElement('button'); vid.type = 'button'; vid.textContent = '🎥 Video';
    vid.onclick = async () => { const r = await idbGet('replay:' + m.id); if (r) { initAudio(); startFilm({ frames: r.frames, gates: r.gates }, false, true); } };
    li.append(info, play, vid, del); ul.appendChild(li);
  }
  $('replays').hidden = false;
}

// ---------- record the film straight to a video file (no iOS screen recording needed) ----------
let recorder = null, recChunks = [], lastVideo = null, recTrack = null, recNextT = 0;
// "Rec ride": records the run exactly as played (behind camera), from the drop to the result. The "Video" button records the Film replay instead.
let LIVE_REC = false, liveWant = false, liveStop = 0;
try { LIVE_REC = localStorage.getItem('daggie-liverec') === '1'; } catch (e) {}
function liveRecOn() { return !!recorder && !PLAY; }
function finishLiveRec() { liveStop = 0; stage.classList.remove('liverec'); if (liveRecOn()) { $('recDot').hidden = true; stopRecorder().then(showVideoCard); } }
function startRecorder() {
  try {
    if (!window.MediaRecorder || !canvas.captureStream) throw new Error('unsupported');
    comp.width = canvas.width; comp.height = canvas.height; composite();
    const stream = comp.captureStream(30); recTrack = null;
    initAudio(); if (AC) { OUT(); if (AUDIO_DEST) AUDIO_DEST.stream.getAudioTracks().forEach(t => stream.addTrack(t)); }
    const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10e6 } : { videoBitsPerSecond: 10e6 });
    recChunks = []; recorder.ondataavailable = ev => { if (ev.data && ev.data.size) recChunks.push(ev.data); };
    recorder.start(250); return true;
  } catch (err) { recorder = null; lastPop = 0; pop('VIDEO NOT SUPPORTED HERE', 'lilac'); return false; }
}
function stopRecorder() {
  return new Promise(res => {
    if (!recorder) return res(null);
    const r = recorder; recorder = null; recTrack = null;
    r.onstop = () => res(new Blob(recChunks, { type: r.mimeType || 'video/mp4' }));
    try { r.stop(); } catch (e) { res(null); }
  });
}
function showVideoCard(blob) {
  if (!blob || !blob.size) return;
  const ext = /webm/.test(blob.type) ? 'webm' : 'mp4';
  lastVideo = new File([blob], 'crash-test-daggie-' + Date.now() + '.' + ext, { type: blob.type || 'video/mp4' });
  const v = $('vidPrev'); try { v.src = URL.createObjectURL(blob); } catch (e) {}
  $('vidInfo').textContent = (blob.size / 1e6).toFixed(1) + ' MB · ' + ext.toUpperCase();
  $('vidCard').hidden = false;
}
$('vidSave').onclick = async () => {
  if (!lastVideo) return;
  try { if (navigator.canShare && navigator.canShare({ files: [lastVideo] })) { await navigator.share({ files: [lastVideo], title: 'Crash Test Daggie' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(lastVideo); a.download = lastVideo.name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { $('vidInfo').textContent = 'Saving is blocked in this viewer. Open the game from GitHub.'; }
};
$('vidClose').onclick = () => { $('vidCard').hidden = true; const v = $('vidPrev'); try { v.pause(); } catch (e) {} };

// the recorded video is drawn on this canvas: game frame + titles, pop texts and like/subscribe badges
const comp = document.createElement('canvas'), cctx = comp.getContext('2d');
function strokeText(txt, x, y, size, fill, rot) {
  cctx.save(); cctx.translate(x, y); if (rot) cctx.rotate(rot);
  cctx.font = '700 ' + Math.round(size) + 'px "Chakra Petch", ui-sans-serif, sans-serif'; cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
  cctx.lineJoin = 'round'; cctx.lineWidth = size * 0.16; cctx.strokeStyle = '#16112a'; cctx.strokeText(txt, 0, size * 0.06); cctx.strokeText(txt, 0, 0);
  cctx.fillStyle = fill; cctx.fillText(txt, 0, 0); cctx.restore();
}
function composite() {
  if (!recorder && comp.width === 0) return;
  const W = comp.width, H = comp.height, now = performance.now();
  cctx.drawImage(canvas, 0, 0, W, H);
  if (recTrack) { if (now >= recNextT) { recNextT = Math.max(recNextT + 1000 / 30, now - 20); queueMicrotask(() => { try { recTrack && recTrack.requestFrame(); } catch (e) {} }); } }
  if ($('hook').classList.contains('show') && !stage.classList.contains('nohook')) { strokeText(L.title[0], W / 2, H * 0.14, W * 0.1, '#ffc41f'); strokeText(L.title[1], W / 2, H * 0.14 + W * 0.1, W * 0.088, '#ffffff'); }
  if (PLAY && PLAY.rew && PLAY.rew.u <= 0.72) {
    cctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 4; i++) cctx.fillRect(0, Math.random() * H, W, H * rand(0.004, 0.03));
    if (Math.floor(now / 250) % 2) strokeText('◀◀ REWIND', W * 0.3, H * 0.13, W * 0.075, '#ffffff');
  }
  OVL.items = OVL.items.filter(it => now - it.t < (it.kind === 'pop' ? 1000 : it.kind === 'reveal' ? 1900 : 1200));
  for (const it of OVL.items) {
    const age = (now - it.t) / 1000;
    if (it.kind === 'pop') {
      const k = age < 0.15 ? 0.4 + age / 0.15 * 0.72 : age < 0.3 ? 1.12 - (age - 0.15) / 0.15 * 0.12 : 1;
      cctx.globalAlpha = age < 0.15 ? age / 0.15 : Math.max(0, 1 - (age - 0.3) / 0.7);
      const col = it.cls === 'green' ? '#3dff9a' : it.cls === 'lilac' ? '#e7b3ff' : '#ffc41f';
      strokeText(it.text, W / 2, H * (0.34 + it.slot * 0.09) - age * H * 0.05, W * 0.12 * k, col, -0.1);
      cctx.globalAlpha = 1;
    } else if (it.kind === 'reveal') {
      const k = Math.min(1, age / 0.2), sc = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3)), bw = W * 0.86, bh = W * 0.3;
      cctx.save(); cctx.globalAlpha = age > 1.5 ? Math.max(0, 1 - (age - 1.5) / 0.4) : Math.min(1, age / 0.12); cctx.translate(W / 2, H * 0.27); cctx.scale(sc, sc);
      cctx.fillStyle = 'rgba(20,12,48,0.85)'; cctx.strokeStyle = it.col; cctx.lineWidth = W * 0.008; cctx.beginPath(); if (cctx.roundRect) cctx.roundRect(-bw / 2, -bh / 2, bw, bh, W * 0.04); else cctx.rect(-bw / 2, -bh / 2, bw, bh); cctx.fill(); cctx.stroke();
      strokeText(it.text, 0, -bh * 0.1, W * 0.095, it.col); strokeText(it.sub, 0, bh * 0.27, W * 0.045, '#ffffff');
      cctx.restore(); cctx.globalAlpha = 1;
    } else {
      if (age < 0.3 && !reduceMotion) { cctx.fillStyle = 'rgba(255,255,255,' + (0.35 * (1 - age / 0.3)).toFixed(3) + ')'; cctx.fillRect(0, 0, W, H); }
      const pulse = 1 + Math.sin(age * 14) * 0.06, s = Math.min(1, age / 0.18) * pulse, bw = W * (it.kind === 'like' ? 0.26 : 0.4), bh = W * 0.09;
      cctx.save(); cctx.globalAlpha = age > 0.9 ? Math.max(0, 1 - (age - 0.9) / 0.3) : 1; cctx.translate(W / 2, H * 0.24); cctx.scale(s, s);
      cctx.fillStyle = '#ff2b2b'; cctx.beginPath(); cctx.roundRect ? cctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh * 0.3) : cctx.rect(-bw / 2, -bh / 2, bw, bh); cctx.fill();
      cctx.font = '700 ' + Math.round(bh * 0.46) + 'px "Chakra Petch", ui-sans-serif, sans-serif'; cctx.fillStyle = '#fff'; cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
      cctx.fillText(it.kind === 'like' ? '👍 LIKE' : 'SUBSCRIBE 🔔', 0, bh * 0.04); cctx.restore();
    }
  }
}
const DROP_H = 10, INTRO_V = 14; // drop height, speed of the drone + the rolling board/cart during the intro
// ---------- state & helpers ----------
const tv = new V3(), tv2 = new V3(), tq = new THREE.Quaternion();
let faceUntil = 0;
function setFace(m, hold) { faceMode = m; faceUntil = performance.now() + (hold || 0); }
let lastPop = 0;
function pop(text, cls) {
  const now = performance.now(); if (now - lastPop < 160) return; lastPop = now;
  recEvt('p', [text, cls || '']);
  const el = document.createElement('div'); el.className = 'pop' + (cls ? ' ' + cls : ''); el.textContent = text;
  const n = $('pops').children.length; el.style.top = (34 + n * 9) + '%'; ovlAdd(text, cls || '', n);
  $('pops').appendChild(el); setTimeout(() => el.remove(), 1100);
}
const rider = new THREE.Group(); scene.add(rider);
scene.remove(daggie); rider.add(daggie); daggie.position.y = BOARD_TOP;
const TRICKS = [
  { name: 'BACKFLIP!', flip: 1, spin: 0 }, { name: 'DOUBLE BACKFLIP!', flip: 2, spin: 0 }, { name: 'FRONTFLIP!', flip: -1, spin: 0 },
  { name: 'CORKSCREW!', flip: 1, spin: 1 }, { name: '720 SPIN!', flip: 0, spin: 2 }, { name: 'MISTY FLIP!', flip: -1, spin: 1 },
];
const R = {};
let state = 'intro', stateT = 0, testNo = 0, slowUntil = 0, slowK = 1, manualSlow = false, shake = 0, cause = '', trick = TRICKS[0];
let simT = 0, orbitA = 0, crouch = 0.45, crouchV = 0, bal = 0, lastXv = 0, stanceBlend = 0;
function resetRun() {
  if (liveRecOn()) finishLiveRec();
  liveWant = LIVE_REC;
  testNo++;
  resetPower(); randomGates(); resetFlock(); resetFx(); RING.done = false;
  Object.assign(R, { s: -13.5, x: 0, xT: 0, xv: 0, y: DROP_H, vy: 0, carry: true, carryT: 0, speed: 0, grounded: false, slope: 0, maxS: 0, top: 0, close: 0, passedFlag: false, air: 0, slip: 0, slam: false, cones: 0, lost: 0 });
  trick = TRICKS[(testNo - 1) % TRICKS.length];
  for (const b of BOOSTS) b.used = false;
  for (const sw of SAWS) sw.near = false;
  for (const p of parts) p.visible = true; // clean slate: nothing stays hidden from a previous film
  resetObstacles(); resetDamage(); resetGadgets(); for (const n of TNTS) { n.alive = true; n.g.visible = true; } for (const sw of SAWS) sw.grazed = false;
  for (const p of parts) { daggie.attach(p); p.position.copy(p.userData.restPos); p.quaternion.copy(p.userData.restQuat); p.scale.set(1, 1, 1); p.userData.v.set(0, 0, 0); p.userData.w.set(0, 0, 0); }
  for (const d of debris) { d.on = false; d.m.visible = false; }
  for (const d of drops) { d.on = false; d.m.visible = false; }
  for (const s of splats) s.m.visible = false;
  dripUntil = 0; cleaning = false;
  board.position.set(0, 0, 13.5); board.quaternion.identity(); BB.free = false;
  state = 'intro'; stateT = performance.now(); cause = '';
  crouch = 0.45; crouchV = 0; stanceBlend = 0;
  setFace('scared'); slowUntil = 0; shake = 0;
  $('result').hidden = true; $('hook').classList.add('show');
  $('testNo').textContent = '#' + String(testNo).padStart(3, '0');
  snapCam = true;
  dlvReset();
  if (VEH === 'cart' && MODE !== 'lab') { const cage = board.getObjectByName('cage'); if (cage && cage.geometry.userData.orig) { cage.geometry.attributes.position.array.set(cage.geometry.userData.orig); cage.geometry.attributes.position.needsUpdate = true; cage.geometry.computeVertexNormals(); } for (const w of wheels) w.visible = true; const plate = board.getObjectByName('plate'); if (plate && plate.userData.home) { plate.position.copy(plate.userData.home); plate.rotation.set(0, Math.PI, 0); plate.visible = true; } }
  recStart(); REC.test = testNo; REC.trick = trick.name; REC.gates = GATE_LAYOUT.map(a => a.slice());
  if (MODE === 'lab') labReset();
}
const BB = { v: new V3(), w: new V3(), free: false };
// pose the body every frame
// two-bone IK over the rig: places the end joint at `target` (model space), bending toward `pole`
const _iq = new THREE.Quaternion(), _iqp = new THREE.Quaternion(), _iM = new THREE.Matrix4(), _iE = new THREE.Euler();
function parentQ(n, out) { const par = NODE[n].par; return par ? out.setFromRotationMatrix(_iM.extractRotation(NODE[par].M)) : out.identity(); }
function limbIK(A, B, C, target, pole, P) {
  const r1 = NODE[B].p.clone().sub(NODE[A].p), r2 = NODE[C].p.clone().sub(NODE[B].p), l1 = r1.length(), l2 = r2.length();
  const S = jointWorld(A, new V3()), to = target.clone().sub(S), dist = clamp(to.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3), dir = to.normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pp = pole.clone().addScaledVector(dir, -pole.dot(dir)); if (pp.lengthSq() < 1e-6) pp.set(0, 1, 0).addScaledVector(dir, -dir.y); pp.normalize();
  const E = S.clone().addScaledVector(dir, a).addScaledVector(pp, h), Wp = S.clone().addScaledVector(dir, dist);
  parentQ(A, _iqp); let d = E.sub(S).normalize().applyQuaternion(_iqp.clone().invert());
  _iq.setFromUnitVectors(r1.clone().normalize(), d); _iE.setFromQuaternion(_iq, 'XYZ'); P[A] = [_iE.x, _iE.y, _iE.z]; runFK(P);
  const E2 = jointWorld(B, new V3()); parentQ(B, _iqp); d = Wp.sub(E2).normalize().applyQuaternion(_iqp.clone().invert());
  _iq.setFromUnitVectors(r2.clone().normalize(), d); _iE.setFromQuaternion(_iq, 'XYZ'); P[B] = [_iE.x, _iE.y, _iE.z]; runFK(P);
  return E2;
}
function levelPart(n, P, extra) { parentQ(n, _iqp); _iq.copy(_iqp).invert().multiply(rootQ); if (extra) _iq.multiply(extra); _iE.setFromQuaternion(_iq, 'XYZ'); P[n] = [_iE.x, _iE.y, _iE.z]; }
// seated in the basket, in model space where y = 0 is the basket floor
const CART_SEAT = new V3(0, 0.17, 0.32), CART_RIM_Y = (1.02 - 0.4) * CART_S, CART_RIM_X = (0.32 + 0.03) * CART_S;
function poseCart(t) {
  if (state === 'intro') {
    if (R.carry) { rootQ.identity(); solveStance(flailPose(t * 0.6), 0); return; }
    const T = Math.sqrt(2 * DROP_H / 9.8), u = clamp(Math.sqrt(2 * Math.max(0, DROP_H - R.y) / 9.8) / T, 0, 1);
    rootQ.identity();
    const P = blendPose(flailPose(t), tuckPose(t), u < 0.12 ? u / 0.12 : 1), e = clamp((u - 0.55) / 0.45, 0, 1), ee = e * e * (3 - 2 * e);
    rootPos.set(0, 0, 0); runFK(P); const hp = NODE.pelvis.p;
    rootPos.set((CART_SEAT.x - hp.x) * ee, (CART_SEAT.y - hp.y) * ee, (CART_SEAT.z - hp.z) * ee); runFK(P); applyFK();
    return;
  }
  rootQ.identity();
  const acc = R.xv - lastXv; lastXv = R.xv; bal += (clamp(-R.xv * 0.25 - acc * 0.4, -1, 1) - bal) * 0.15;
  crouchV += ((0.66 - crouch) * 90 - crouchV * 11) * (1 / 60); crouch = clamp(crouch + crouchV / 60, 0.1, 1.05);
  const comp = crouch - 0.66, air = !R.grounded, party = state === 'passed';
  const sk = R.grounded && state === 'ride' ? clamp(R.speed / 30, 0, 1) : 0, rat = (Math.sin(t * 53) + Math.sin(t * 37.7)) * 0.0035 * sk;
  const P = {
    pelvis: [-0.1, 0, bal * 0.05],
    torso: [0.1 + comp * 0.35 + (air ? 0.06 : 0) - (party ? 0.15 : 0), Math.sin(t * 1.3) * 0.02, -bal * 0.08 - R.xv * 0.01],
    head: [-0.08 - comp * 0.2 - (party ? 0.25 : 0) + Math.sin(t * 23) * 0.012 * sk, -bal * 0.15 + Math.sin(t * 1.9) * 0.04, bal * 0.06],
  };
  const sx = clamp(-R.xv * 0.008, -0.05, 0.05);
  rootPos.set(0, 0, 0); runFK(P); const hp = NODE.pelvis.p;
  rootPos.set(CART_SEAT.x + sx - hp.x, CART_SEAT.y - comp * 0.09 + rat + (air ? 0.03 : 0) - hp.y, CART_SEAT.z - hp.z); runFK(P);
  for (const s of ['L', 'R']) {
    const sd = SIDE[s];
    limbIK('thigh' + s, 'shin' + s, 'foot' + s, new V3(sd * 0.17, ANKLE_REST.y + rat * 0.5 + (air ? 0.02 : 0), -0.3), new V3(sd * 0.25, 1, -0.7), P);
    levelPart('foot' + s, P);
  }
  for (const s of ['L', 'R']) {
    const sd = SIDE[s];
    if (CANNON.on && CANNON.k === s) { P['upper' + s] = [1.5, 0, sd * 0.1]; P['fore' + s] = [0.1, 0, 0]; continue; }
    const rail = party ? new V3(sd * 0.55, CART_RIM_Y + 0.7 + Math.sin(t * 10 + sd) * 0.08, -0.1) : new V3(sd * CART_RIM_X, CART_RIM_Y + 0.005 + Math.sin(t * 40 + sd) * 0.002 * sk, -0.06 - sd * 0.01), pole = new V3(sd * 0.8, -0.4, 0.5);
    const E = limbIK('upper' + s, 'fore' + s, 'hand' + s, rail, pole, P), dirF = rail.clone().sub(E).normalize();
    limbIK('upper' + s, 'fore' + s, 'hand' + s, rail.clone().addScaledVector(dirF, -0.07), pole, P);
    P['hand' + s] = party ? [0, 0, 0] : [0.35, 0, 0];
  }
  runFK(P); applyFK();
}
function poseBody(t) {
  if (VEH === 'cart') { poseCart(t); return; }
  let P;
  if (state === 'intro') {
    if (R.carry) { rootQ.identity(); solveStance(flailPose(t * 0.6), 0); return; }
    const T = Math.sqrt(2 * DROP_H / 9.8), u = clamp(Math.sqrt(2 * Math.max(0, DROP_H - R.y) / 9.8) / T, 0, 1);
    const e = u < 0.08 ? 0 : clamp((u - 0.08) / 0.8, 0, 1), ee = e * e * (3 - 2 * e);
    rootQ.setFromEuler(new THREE.Euler(trick.flip * TAU * ee, STANCE * clamp((u - 0.75) / 0.25, 0, 1) + trick.spin * TAU * ee, 0, 'YXZ'));
    const tuckK = u < 0.12 ? u / 0.12 : u > 0.82 ? clamp(1 - (u - 0.82) / 0.14, 0, 1) : 1;
    P = u < 0.12 ? blendPose(flailPose(t), tuckPose(t), tuckK) : blendPose(skatePose(0.75, 0, t, 0), tuckPose(t), tuckK);
    solveStance(P, 0);
    return;
  }
  if (state === 'ride' || state === 'passed') {
    rootQ.setFromAxisAngle(Y, STANCE);
    const acc = (R.xv - lastXv); lastXv = R.xv;
    bal += (clamp(-R.xv * 0.25 - acc * 0.4, -1, 1) - bal) * 0.15;
    if (R.grounded) {
      const target = state === 'passed' ? 0.3 : R.speed > 24 ? 0.78 : 0.66;
      crouchV += ((target - crouch) * 90 - crouchV * 11) * (1 / 60); crouch = clamp(crouch + crouchV / 60, 0.1, 1.05);
      P = skatePose(crouch, bal, t, R.xv * 0.05);
      P = blendPose(P, { upperL: [0.2, 0, SIDE.L * 0.85], upperR: [0.2, 0, SIDE.R * 0.85], foreL: [0.55, 0, 0], foreR: [0.55, 0, 0] }, clamp(0.4 + Math.abs(bal) * 0.35, 0, 0.8)); // arms out for balance
      if (state === 'passed') { P = blendPose(P, { torso: [-0.1, 0, 0], head: [-0.2, -0.6, 0], upperL: [0, 0, SIDE.L * 2.6], upperR: [0, 0, SIDE.R * 2.6], foreL: [0.2, 0, 0], foreR: [0.2, 0, 0] }, 0.85); }
      if (CANNON.on) { P['upper' + CANNON.k] = [0.05, 0, 1.45]; P['fore' + CANNON.k] = [0, 0, 0.05]; }
      solveStance(P, 1);
    } else {
      const k = clamp(0.55 + R.air * 1.4, 0.55, 0.95);
      P = skatePose(k, bal, t, 0);
      P = blendPose(P, { upperL: [0.3, 0, SIDE.L * 1.9], upperR: [0.3, 0, SIDE.R * 1.9] }, 0.6);
      if (CANNON.on) { P['upper' + CANNON.k] = [0.05, 0, 1.45]; P['fore' + CANNON.k] = [0, 0, 0.05]; }
      solveStance(P, 1);
    }
  }
}
function placeRider(t) {
  rider.position.set(R.x, R.y, -R.s);
  let pitch = 0;
  if (state === 'intro') pitch = 0;
  else if (R.grounded) pitch = Math.atan(R.slope);
  else pitch = Math.atan2(R.vy, Math.max(6, R.speed)) * 0.5;
  rider.rotation.set(pitch, 0, clamp(-R.xv * 0.05, -0.38, 0.38));
  if (state !== 'intro') { board.position.copy(rider.position); board.quaternion.copy(rider.quaternion); }
  for (const w of wheels) w.rotation.x -= (state === 'ride' || state === 'passed') && R.grounded ? R.speed / WHEEL_R / 60 : 0;
}
function jointsNow() { daggie.updateMatrixWorld(true); const out = []; for (const [n, par] of RIG) if (par) out.push(jointWorld(n, new V3()).applyMatrix4(daggie.matrixWorld)); return out; }
function crash(kind, saw) {
  if (state !== 'ride') return;
  if (kind !== 'fall' && kind !== 'gap' && kind !== 'wear' && kind !== 'bones') { if (performance.now() < R.inv) return; if (R.shield) { shieldSave(); return; } if (powerHit(kind, saw)) return; }
  if (kind !== 'fall' && kind !== 'gap' && flockSwap(kind)) return;
  state = 'crashed'; stateT = performance.now(); cause = kind; setHP(0);
  if (DLV) dlvLose(D.left); // the backpack bursts open
  const now = stateT, vel = new V3(R.xv, R.vy, -R.speed);
  const jw = jointsNow(); const center = torso.getWorldPosition(new V3());
  const side = saw ? Math.sign(R.x - saw.x) || (Math.random() < 0.5 ? -1 : 1) : 0;
  for (const p of parts) {
    if (p.userData.detached) continue;
    scene.attach(p);
    const u = p.userData, out = tv.copy(p.position).sub(center); out.y *= 0.5; out.normalize();
    u.v.copy(vel).multiplyScalar(rand(0.55, 0.9)).addScaledVector(out, rand(1.5, 3.5)); u.v.y += rand(1, 3.5);
    if (kind === 'saw') { u.v.x += side * rand(3, 7); u.v.y += rand(2, 4); u.v.z *= 0.6; }
    if (kind === 'big') { u.v.z *= 0.15; u.v.x += (Math.random() < 0.5 ? -1 : 1) * rand(3, 8); u.v.y += rand(2, 6); }
    const leg = /thigh|shin|foot/.test(p.name);
    if (kind === 'hurdle' || kind === 'barrel' || kind === 'cart' || kind === 'wall') { if (leg) u.v.z *= 0.15; else { u.v.y += rand(1.5, 3); } if (kind === 'wall') u.v.z = Math.abs(u.v.z) * rand(0.1, 0.3); }
    if (kind === 'ball') { const dir = saw && saw.pos ? Math.sign(R.x - saw.pos.x) || 1 : 1; u.v.x += dir * rand(6, 11); u.v.y += rand(2, 4); u.v.z *= 0.5; }
    if (kind === 'press') { u.v.y = rand(-1, 0.5); u.v.x += rand(-5, 5); u.v.z += rand(-3, 3); }
    if (kind === 'spikes') { u.v.y += rand(4, 7); }
    if (kind === 'bones') { u.v.x += rand(-5, 5); u.v.y += rand(2, 5); u.v.z += rand(-4, 4); }
    if (kind === 'sweeper') { u.v.x += rand(-7, 7); u.v.y += rand(2, 4); if (leg) u.v.z *= 0.2; }
    if (p === head) u.v.y += 2.5;
    u.w.set(rand(-10, 10), rand(-8, 8), rand(-10, 10));
  }
  if (VEH === 'cart') labDent(Math.min(45, R.speed * 1.1)); // the front crumples in the crash
  BB.free = true; BB.v.copy(vel).multiplyScalar(0.8).add(new V3(rand(-2, 2), rand(2, 4), 0)); BB.w.set(rand(-12, 12), rand(-6, 6), rand(-12, 12));
  spawnDebris(center, jw, vel);
  if (kind === 'bones') { burst(center, 60, CONF, 8); for (let i = 0; i < 6; i++) tone(rand(600, 1100), rand(300, 500), 0.08, 'square', 0.05, i * 0.07); }
  burst(center, 70, SPARK, 10); burst(center, 30, CONF, 6);
  setFace('hit', 1500);
  slowUntil = now + (reduceMotion ? 500 : 1600); slowK = 0.22;
  if (!reduceMotion) shake = 0.5;
  pop({ saw: 'ZZZT!', big: 'SHREDDED!', fall: 'NOOO!', hurdle: 'FACEPLANT!', ball: 'WRECKED!', press: 'SQUISH!', barrel: 'STRIKE!', cart: 'CART CRASH!', sweeper: 'SWEPT!', fart: 'BRRRAP!', sock: 'STOMPED!', fire: 'BURNED!', wall: 'BONK!', spikes: 'OUCH!', wear: 'FALLING APART!', bones: 'BONES EVERYWHERE!', anvil: 'FLATTENED!', gap: 'SPLAT!' }[kind] || 'CRASH!', kind === 'fall' ? 'lilac' : 'green');
  tone(140, 40, 0.45, 'sine', 0.3); tone(1500, 300, 0.25, 'sawtooth', 0.06); tone(700, 200, 0.2, 'triangle', 0.08, 0.06);
  orbitA = Math.atan2(camera.position.x - center.x, camera.position.z - center.z);
}
function passed() {
  state = 'passed'; stateT = performance.now();
  setFace('happy', 99999); const nf = flockCount(); pop(DLV ? 'DELIVERY!' : nf > 1 ? nf + ' SURVIVED!' : 'HE SURVIVED!', 'green'); if (DLV) D.phase = 'approach';
  for (let i = 0; i < 4; i++) setTimeout(() => burst(rider.position.clone().add(new V3(rand(-2, 2), 3, rand(-3, 1))), 60, CONF, 7), i * 250);
  tone(660, 1320, 0.3, 'square', 0.05); tone(880, 1760, 0.3, 'square', 0.04, 0.15);
}
function showResult() {
  state = 'result';
  if (MODE === 'lab') { labDone(); return; }
  if (liveRecOn()) liveStop = performance.now() + 700;
  const ok = cause === '';
  if (REC) { REC.ok = ok; REC.cause = ok ? '' : cause; REC.dist = Math.round(R.maxS); }
  recStop(); $('rSave').textContent = '★ Save'; $('rSave').disabled = false;
  $('rTitle').textContent = 'Test #' + String(testNo).padStart(3, '0') + (ok ? ' passed' : ' failed');
  $('rTitle').className = ok ? 'ok' : 'fail';
  $('rDist').textContent = Math.round(R.maxS) + ' m';
  $('rTop').textContent = Math.round(R.top * 2.237) + ' mph';
  $('rClose').textContent = String(R.close);
  const surv = ok ? flockCount() : 0; if ($('rFlock')) $('rFlock').textContent = surv + ' / ' + FLOCK_MAX; if (REC) REC.flock = surv;
  $('rLost').textContent = detached.reduce((a, d) => a + d.names.length, 0) + ' / 15';
  $('rScore').textContent = String(Math.round((R.maxS * 10 + R.close * 150 + R.cones * 40 + (ok ? 2500 : 0) + (ok ? HP * 20 : 0) + (ok ? flockCount() * 1000 : 0))));
  $('rCause').textContent = ok ? 'Nothing. He made it!' : ({ saw: 'Saw blade', big: 'The giant saw', fall: 'The drop', hurdle: 'The hurdle', ball: 'Wrecking ball', press: 'The crusher', barrel: 'Rolling barrel', cart: 'An oncoming cart', fire: 'The ring of fire', fart: 'Fart power', sock: 'The stinky sock', sweeper: 'Sweeper arm', wall: 'Sliding wall', spikes: 'Spikes', wear: 'Too many hits', bones: 'Skeleton fell apart', anvil: 'A falling anvil', gap: 'Missed the jump' }[cause] || cause);
  if (DLV) $('rCause').textContent = (ok ? D.stars + '★ delivery' : 'Delivery failed') + ' · ' + D.left + '/' + DLV.slices + ' slices · tip $' + Math.max(0, Math.round(D.tip));
  $('result').hidden = false;
}
function landImpact(v) { crouchV += Math.min(4.5, v * 0.35); if (DLV && state === 'ride' && v > 7 && Math.random() < 0.6) dlvLose(1); }


// ---------- damage: tear off limbs but keep riding ----------
let HP = 100;
const detached = [], stumps = [];
let nextStumpDrip = 0;
function subtree(name) { const out = [name]; let grew = true; while (grew) { grew = false; for (const [n, par] of RIG) if (par && out.includes(par) && !out.includes(n)) { out.push(n); grew = true; } } return out; }
function setHP(v) { const prev = HP; HP = clamp(Math.round(v), 0, 100); const f = $('hpFill'); f.style.width = HP + '%'; f.style.background = HP > 60 ? '#3dff9a' : HP > 30 ? '#ffc21a' : '#ff4a5a'; $('hpNum').textContent = String(HP); if (HP < prev) { const box = $('hpBox'); box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit'); } }
function detachPart(name, dirX) {
  const names = subtree(name).filter(n => !byName[n].userData.detached);
  if (!names.length) return false;
  daggie.updateMatrixWorld(true);
  const jp = jointWorld(name, new V3()).applyMatrix4(daggie.matrixWorld);
  const grp = new THREE.Group(); byName[name].getWorldPosition(grp.position); scene.add(grp);
  for (const n of names) { const p = byName[n]; p.userData.detached = true; grp.attach(p); }
  const samples = []; for (const n of names) { const p = byName[n]; for (const s of p.userData.samples) samples.push({ p: s.p.clone().applyQuaternion(p.quaternion).add(p.position), r: s.r }); }
  detached.push({ grp, names, root: name, v: new V3(R.xv * 0.4 + dirX * rand(3, 6), rand(3, 6), -R.speed * rand(0.55, 0.8)), w: new V3(rand(-12, 12), rand(-10, 10), rand(-12, 12)), samples, drip: performance.now() + 3000 });
  stumps.push(name);
  if (CANNON.on && names.includes('fore' + CANNON.k)) { CANNON.on = false; fireBtn(false); byName['hand' + CANNON.k].visible = true; lastPop = 0; pop('CANNON LOST!', 'lilac'); }
  for (let i = 0; i < 12; i++) spawnDrop(jp.clone(), new V3(rand(-1.6, 1.6) + dirX * 1.5, rand(0.6, 2.6), -R.speed * 0.7 + rand(-1, 1)), rand(0.012, 0.022));
  burst(jp, 34, SPARK, 6);
  const few = debris.filter(d => !d.on).slice(0, 5);
  for (const d of few) { d.on = true; d.ground = false; d.m.visible = true; d.m.scale.setScalar(1); d.m.position.copy(jp); d.v.set(rand(-2, 2) + dirX * 2, rand(2, 5), -R.speed * rand(0.5, 0.8)); d.w.set(rand(-18, 18), rand(-18, 18), rand(-18, 18)); }
  return true;
}
function graze(o, dirX, high) {
  if (o.grazed) return; o.grazed = true;
  if (performance.now() < R.inv) return; if (R.shield) { shieldSave(); return; }
  if (powerHit('graze', o)) return;
  if (DLV && state === 'ride') dlvLose(Math.random() < 0.4 ? 2 : 1); // a hit shakes slices out of the backpack
  const order = high ? ['head', 'foreL', 'foreR', 'upperL', 'upperR'] : [...(Math.random() < 0.5 ? ['foreL', 'foreR'] : ['foreR', 'foreL']), ...(Math.random() < 0.5 ? ['upperL', 'upperR'] : ['upperR', 'upperL']), 'head'];
  const target = order.find(n => !byName[n].userData.detached);
  setHP(HP - 25);
  if (target) {
    detachPart(target, dirX || (Math.random() < 0.5 ? -1 : 1));
    pop(target === 'head' ? 'HEADLESS!' : /upper/.test(target) ? 'NO ARM!' : 'ARM GONE!', 'green');
  } else pop('OUCH!', 'green');
  setFace('hit', 900); slowUntil = performance.now() + 250; slowK = 0.55; if (!reduceMotion) shake = Math.min(0.5, shake + 0.25);
  tone(1300, 250, 0.2, 'sawtooth', 0.06); clank(6);
  if (HP <= 0) crash('wear');
}
function reattach() {
  const d = detached.pop(); if (!d) return false;
  for (const n of d.names) { const p = byName[n]; p.userData.detached = false; daggie.attach(p); }
  scene.remove(d.grp); const i = stumps.lastIndexOf(d.root); if (i >= 0) stumps.splice(i, 1);
  return true;
}
function stepDetached(dt, now) {
  for (const d of detached) {
    d.v.y -= 9.8 * 1.1 * dt; d.grp.position.addScaledVector(d.v, dt);
    const wl = d.w.length(); if (wl > 1e-4) { tq.setFromAxisAngle(tv.copy(d.w).multiplyScalar(1 / wl), wl * dt); d.grp.quaternion.premultiply(tq); }
    let touched = false;
    for (const s of d.samples) {
      tv2.copy(s.p).applyQuaternion(d.grp.quaternion).add(d.grp.position);
      const fl = floorAt(tv2.x, tv2.z), pen = fl - (tv2.y - s.r);
      if (pen > 0 && pen < 0.8) { d.grp.position.y += pen; touched = true; if (d.v.y < 0) { if (d.v.y < -2) clank(-d.v.y); d.v.y *= -0.3; const r = tv.copy(tv2).sub(d.grp.position); d.w.add(new V3().crossVectors(r, new V3(0, 2, 0))); } }
    }
    if (touched) { const f = Math.pow(0.3, dt); d.v.x *= f; d.v.z *= f; d.w.multiplyScalar(Math.pow(0.25, dt)); }
    if (d.grp.position.y < -89) { d.grp.position.y = -89; d.v.set(0, 0, 0); d.w.set(0, 0, 0); }
    if (now < d.drip && Math.random() < dt * 8) { const p = byName[d.root], c = p.userData.caps[0]; if (c) spawnDrop(p.localToWorld(c.clone()), new V3(rand(-0.3, 0.3), 0, rand(-0.3, 0.3)), rand(0.009, 0.015)); }
  }
  if ((state === 'ride' || state === 'passed') && stumps.length && now > nextStumpDrip) {
    nextStumpDrip = now + rand(70, 130);
    daggie.updateMatrixWorld(true);
    const jp = jointWorld(pick(stumps), new V3()).applyMatrix4(daggie.matrixWorld);
    spawnDrop(jp, new V3(rand(-0.4, 0.4), rand(-0.2, 0.4), rand(-0.4, 0.4)), rand(0.01, 0.017));
  }
}
function resetDamage() {
  while (detached.length) reattach();
  stumps.length = 0; setHP(100);
  for (const s of SPARES) { s.taken = false; s.m.visible = true; }
}


// ---------- gadgets: arm cannon + shield ----------
const CANNON = { on: false, k: null, ammo: 0, grow: 0, gen: 0 };
function fireBtn(show) { $('bFire').hidden = !show; $('ammo').textContent = String(CANNON.ammo); }
function unequipCannon() { if (CANNON.k) byName['hand' + CANNON.k].visible = true; if (cannonG.parent) cannonG.parent.remove(cannonG); cannonG.visible = false; CANNON.on = false; CANNON.k = null; fireBtn(false); }
function equipCannon() {
  const prefer = ['L', 'R'].sort((a, b) => SIDE[b] - SIDE[a]);
  const k = prefer.find(s => !byName['fore' + s].userData.detached);
  if (!k) { setHP(HP + 10); pop('NO ARM LEFT!', 'lilac'); return; }
  if (CANNON.on) unequipCannon();
  const fore = byName['fore' + k], wrist = NODE['hand' + k].p, elbow = NODE['fore' + k].p;
  const dir = wrist.clone().sub(elbow).normalize();
  fore.add(cannonG); cannonG.position.copy(wrist).sub(fore.userData.restPos).addScaledVector(dir, -0.05); cannonG.quaternion.setFromUnitVectors(Y, dir);
  cannonG.visible = true; cannonG.scale.setScalar(0.01); byName['hand' + k].visible = false;
  Object.assign(CANNON, { on: true, k, ammo: 3, grow: 0, gen: CANNON.gen + 1 });
  fireBtn(true); pop('ARM CANNON!', 'green'); setFace('wow', 1200);
  tone(200, 900, 0.35, 'sawtooth', 0.05); tone(900, 1800, 0.2, 'square', 0.04, 0.25);
  burst(cannonG.getWorldPosition(new V3()), 30, SPARK, 4);
}
function fireCannon() {
  if (state !== 'ride' || !CANNON.on || CANNON.ammo <= 0 || CANNON.grow < 0.9) return;
  const pr = PROJ.find(p => !p.on); if (!pr) return;
  CANNON.ammo--; fireBtn(true);
  const tip = cannonG.userData.tip.getWorldPosition(new V3());
  pr.on = true; pr.life = 1.6; pr.m.visible = true; pr.m.position.copy(tip); pr.v.set(0, 0, -(R.speed + 55));
  burst(tip, 18, SPARK, 5); tone(1500, 200, 0.22, 'square', 0.07); tone(300, 80, 0.2, 'sine', 0.12);
  if (!reduceMotion) shake = Math.min(0.4, shake + 0.12);
  if (CANNON.ammo <= 0) { const g = CANNON.gen; setTimeout(() => { if (CANNON.gen === g && CANNON.on) { unequipCannon(); pop('OUT OF AMMO', 'lilac'); } }, 900); }
}
function stepProjectiles(dt) {
  for (const pr of PROJ) {
    if (!pr.on) continue;
    pr.m.position.addScaledVector(pr.v, dt); pr.life -= dt;
    if (Math.random() < 0.6) burst(pr.m.position, 1, SPARK, 1);
    const p = pr.m.position; let hit = false;
    for (const d of DESTR) {
      if (d.obj.dead) continue;
      if (Math.abs(p.z - d.z()) < 1.0 && Math.abs(p.x - d.x()) < d.hw + 0.25) { const [y0, y1] = d.yy(); if (p.y > y0 - 0.3 && p.y < y1 + 0.3) { killDestr(d, p.clone()); R.kills = (R.kills || 0) + 1; lastPop = 0; pop('DESTROYED!', 'green'); hit = true; break; } }
    }
    if (!hit) for (const n of TNTS) if (n.alive && Math.abs(p.z + n.s) < 0.9 && Math.abs(p.x - n.x) < 0.8) { n.alive = false; n.g.visible = false; explodeAt(new V3(n.x, 0.6, -n.s)); lastPop = 0; pop('KABOOM!', 'green'); hit = true; break; }
    if (!hit && Math.abs(p.z + SAW_S) < 1 && Math.abs(p.x) < BIG_R) { burst(p, 40, SPARK, 8); tone(2200, 900, 0.3, 'triangle', 0.08); lastPop = 0; pop('CLANG! TOO BIG', 'lilac'); hit = true; }
    if (!hit) for (const c of OBS.cones) if (!c.hit && Math.abs(p.z + c.s0) < 0.6 && Math.abs(p.x - c.x0) < 0.6) { c.hit = true; c.v.set(rand(-3, 3), rand(6, 9), -20); c.w.set(rand(-15, 15), 0, rand(-15, 15)); }
    if (hit || pr.life <= 0) { pr.on = false; pr.m.visible = false; }
  }
}
function shieldSave() {
  R.shield = false; R.inv = performance.now() + 900;
  R.grounded = false; R.vy = Math.max(R.vy, 6.5); R.speed *= 0.85;
  burst(torso.getWorldPosition(new V3()), 60, CONF, 8); lastPop = 0; pop('SHIELD!', 'green'); setFace('wow', 900);
  tone(1200, 300, 0.3, 'sine', 0.1); tone(600, 1400, 0.25, 'triangle', 0.06, 0.05);
}
function resetGadgets() {
  unequipCannon(); CANNON.gen++; R.shield = false; R.inv = 0; R.kills = 0;
  for (const p of PICKS) { p.taken = false; p.m.visible = true; }
  for (const so of SOCIAL) { so.taken = false; so.m.visible = true; }
  for (const p of PROJ) { p.on = false; p.m.visible = false; }
  reviveDestr(); bubble.visible = false; for (const k of ['L', 'R']) byName['hand' + k].visible = true;
}

// ---------- physics ----------
function stepRide(dt, now) {
  const px = R.x, ps0 = R.s;
  stepFx(dt); if (state !== 'ride' && state !== 'passed') return;
  if (R.jumpPend > 0) { R.jumpPend -= dt; if (R.jumpPend <= 0 && R.grounded && state === 'ride') { R.grounded = false; R.vy = R.speed * R.slope + 5.75 * FX.jump; crouchV -= 12; tone(300, 700, 0.15, 'triangle', 0.05); noise && AC && noise(AC.currentTime, 0.12, 0.05, 'bandpass', 1800, 700, 1.5); setFace('wow', 700); } }
  if (R.slip > 0) { R.slip -= dt; R.xT += Math.sin(simT * 7.3) * 5.5 * dt; }
  if (OBS.wind && R.s > OBS.wind.s0 && R.s < OBS.wind.s1) { R.xT += OBS.wind.force * dt; R.x += OBS.wind.force * 0.35 * dt; }
  R.x += (R.xT - R.x) * Math.min(1, dt * (FORM.kind === 'frozen' ? 1.4 : R.slip > 0 ? 2.5 : 6));
  if (R.grounded && Math.abs(R.x) > HALF + 0.05) { R.grounded = false; R.vy = 0; pop('WHOA!', 'lilac'); setFace('scared', 1500); }
  R.xv = (R.x - px) / dt;
  if (R.grounded) {
    R.air = 0;
    R.speed = Math.min(formMax(), R.speed + (0.6 + (FORM.kind === 'chrome' ? 2 : 0) - 9.8 * R.slope * 0.8) * dt);
    R.s += R.speed * dt;
    const h = trackH(R.s);
    if (h === null) {
      R.grounded = false; R.vy = R.speed * R.slope;
      if (R.s > RAMP1 - 1) { slowUntil = now + 900; slowK = 0.4; pop('SEND IT!', 'lilac'); setFace('wow', 1400); tone(300, 900, 0.4, 'sine', 0.06); }
    } else { R.y = h; R.slope = ((trackH(R.s + 0.1) ?? h) - h) / 0.1; }
    if (R.s > LAND0 && cause === '') { R.speed *= Math.pow(0.35, dt); if (DLV) { if (R.s > DOOR_S - 3.2) R.s = DOOR_S - 3.2; const dist = DOOR_S - 3.2 - R.s; R.speed = dist > 0.3 ? Math.max(Math.min(R.speed / Math.pow(0.35, dt), dist * 1.6), Math.min(2.5, dist * 3)) : 0; } if (R.s > LAND0 + 4 && !R.passedFlag) { R.passedFlag = true; passed(); } }
  } else {
    R.air += dt;
    R.vy -= 9.8 * FX.grav * (R.vy < 0 ? 1.35 : 1) * dt; R.y += R.vy * dt; R.s += R.speed * dt;
    const h = trackH(R.s);
    if (h !== null && R.y < h - 0.5) { crash('gap'); return; } // fell into the gap and hit the far wall
    if (h !== null && R.y <= h && R.vy <= 0) {
      const hard = -R.vy; R.grounded = true; R.y = h; R.slope = 0; landImpact(hard); if (hard > 13 && !R.slam) setHP(HP - 10);
      if (R.slam) { R.slam = false; for (const n of TNTS) if (n.alive && Math.hypot(n.x - R.x, n.s - R.s) < 3.2) { n.alive = false; n.g.visible = false; explodeAt(new V3(n.x, 0.6, -n.s)); } burst(new V3(R.x, h + 0.1, -R.s), 50, SPARK, 8); pop('SLAM!', 'lilac'); if (!reduceMotion) shake = 0.5; tone(90, 35, 0.35, 'sine', 0.3); for (const c of OBS.cones) if (!c.hit && Math.hypot(c.x0 - R.x, c.s0 - R.s) < 4) { c.hit = true; c.v.set((c.x0 - R.x) * 3, rand(5, 8), (R.s - c.s0) * 2); c.w.set(rand(-12, 12), 0, rand(-12, 12)); } }
      burst(new V3(R.x, h + 0.1, -R.s), 18, SPARK, 5); tone(160, 50, 0.2, 'sine', Math.min(0.3, 0.05 + hard * 0.02));
      if (!reduceMotion) shake = Math.min(0.4, hard * 0.03);
    }
    if (R.y < -14) { crash('fall'); return; }
  }
  if (state !== 'ride') return;
  const bodyY0 = R.y + 0.2, bodyY1 = R.y + 0.2 + (VEH === 'cart' ? 1.5 : 2.1) * PW.size, bw = (VEH === 'cart' ? 0.45 : 0.34) * PW.size;
  for (const sw of SAWS) {
    if (sw.dead) continue;
    const dz = Math.abs(R.s - sw.s); if (dz > 0.6) continue;
    const yy = clamp(sw.y, bodyY0, bodyY1), d = Math.hypot(Math.max(0, Math.abs(R.x - sw.x) - bw), yy - sw.y);
    if (d < sw.R - 0.3 && dz < 0.4) { crash('saw', sw); return; }
    if (d < sw.R + 0.12 && dz < 0.4) { graze(sw, Math.sign(R.x - sw.x) || 1, false); if (state !== 'ride') return; }
    if (!sw.near && d < sw.R + 0.9) {
      sw.near = true; R.close++; pop('CLOSE!', 'lilac'); setFace('scared', 700);
      burst(new V3(sw.x + Math.sign(R.x - sw.x) * sw.R * 0.9, sw.y, -sw.s), 16, SPARK, 5); tone(900, 300, 0.25, 'sawtooth', 0.04);
    }
  }
  if (FINALE !== 'ring' && Math.abs(R.s - SAW_S) < 0.5) {
    const yy = clamp(BIG_Y, bodyY0, bodyY1), d = Math.hypot(Math.max(0, Math.abs(R.x) - 0.34), yy - BIG_Y);
    if (d < BIG_R) { crash('big'); return; }
  }
  if (FINALE === 'ring' && !RING.done && ps0 < RING.s && R.s >= RING.s) { // crossing the ring's plane
    RING.done = true; const cy = R.y + 1.0, d = Math.hypot(R.x, cy - RING.y);
    if (d < RING.R - 0.55) { lastPop = 0; pop(d < 0.7 ? 'BULLSEYE!' : 'THROUGH THE FIRE!', 'green'); slowUntil = now + 900; slowK = 0.3; setFace('happy', 1500); tone(300, 1200, 0.4, 'triangle', 0.06); burst(new V3(R.x, cy, -RING.s), 70, SPARK, 6); R.close = (R.close || 0) + 1; }
    else if (d < RING.R + 0.55) { burst(new V3(R.x, cy, -RING.s), 120, SPARK, 9); tone(120, 40, 0.5, 'sawtooth', 0.12); crash('fire'); return; }
    else { lastPop = 0; pop('MISSED THE RING!', 'lilac'); }
  }
  for (const hu of OBS.hurdles) if (!hu.dead && Math.abs(R.s - hu.s) < 0.3 && R.y < hu.h - 0.12) { crash('hurdle', hu); if (state !== 'ride' || !hu.dead) return; }
  for (const b of OBS.balls) {
    if (b.dead || Math.abs(R.s - b.s) > 1.6) continue;
    const yy = clamp(b.pos.y, bodyY0, bodyY1), d = Math.hypot(R.x - b.pos.x, yy - b.pos.y, -R.s - b.pos.z);
    if (d < b.r + 0.05) { crash('ball', b); return; }
    if (d < b.r + 0.45) { graze(b, Math.sign(R.x - b.pos.x) || 1, b.pos.y > R.y + 1.7); if (state !== 'ride') return; }
    if (!b.near && d < b.r + 1.4) { b.near = true; R.close++; pop('CLOSE!', 'lilac'); setFace('scared', 700); }
  }
  for (const p of OBS.presses) {
    if (p.dead) continue;
    if (Math.abs(R.s - p.s) < p.d / 2 + 0.3 && Math.abs(R.x - p.x) < p.w / 2 + 0.3) {
      if (p.bottom < R.y + (VEH === 'cart' ? 1.9 : 2.2)) { crash('press'); return; }
      if (!p.near && p.bottom < R.y + 3.2) { p.near = true; R.close++; pop('CLOSE!', 'lilac'); }
    }
  }
  for (const b of OBS.barrels) {
    if (b.dead) continue;
    if (Math.abs(R.s - b.s) < b.r + 0.3 && Math.abs(R.x - b.x) < 0.95 && R.y < b.r * 2 - 0.15) { crash(b.cart ? 'cart' : 'barrel', b); if (state !== 'ride') return; continue; }
    if (!b.near && Math.abs(R.s - b.s) < 1 && Math.abs(R.x - b.x) < 1.8) { b.near = true; R.close++; pop('CLOSE!', 'lilac'); }
  }
  for (const sw of OBS.sweepers) {
    if (sw.dead || Math.abs(R.s - sw.s) > HALF) continue;
    const th = sw.arm.rotation.y, c = Math.cos(th), sn = Math.sin(th), dx = R.x, dz = sw.s - R.s;
    const proj = dx * c - dz * sn, perp = Math.abs(c * dz + sn * dx);
    if (Math.abs(proj) < sw.len && perp < 0.32 && R.y < sw.h + 0.15) { crash('sweeper', sw); if (state !== 'ride') return; continue; }
  }
  for (const w of OBS.walls) {
    if (w.dead) continue;
    if (Math.abs(R.s - w.s) < 0.4 && Math.abs(R.x - w.x) < w.w / 2 + 0.05) { crash('wall', w); if (state !== 'ride') return; continue; }
    if (Math.abs(R.s - w.s) < 0.4 && Math.abs(R.x - w.x) < w.w / 2 + 0.45) { graze(w, Math.sign(R.x - w.x) || 1, false); if (state !== 'ride') return; }
    if (!w.near && Math.abs(R.s - w.s) < 0.6 && Math.abs(R.x - w.x) < w.w / 2 + 1.0) { w.near = true; R.close++; pop('CLOSE!', 'lilac'); }
  }
  for (const sp of OBS.spikes) if (R.s > sp.s0 && R.s < sp.s1 && sp.up > 0.6 && R.y < 0.5) { crash('spikes'); return; }
  for (const o of OBS.oils) if (!o.hit && R.grounded && Math.abs(R.x - o.x) < o.w && Math.abs(R.s - o.s) < o.l) { o.hit = true; R.slip = 1.3; pop('SLIPPERY!', 'lilac'); setFace('scared', 1300); tone(400, 200, 0.4, 'sine', 0.05); }
  for (const tr of OBS.tramps) if (R.grounded && Math.hypot(R.x - tr.x, R.s - tr.s) < tr.r) { R.grounded = false; R.vy = 8.5; tr.sq = 1; crouchV -= 4; pop('BOING!', 'green'); setFace('wow', 1600); tone(160, 700, 0.35, 'sine', 0.12); }
  for (const c of OBS.cones) if (!c.hit && Math.abs(R.s - c.s0) < 0.45 && Math.abs(R.x - c.x0) < 0.55 && R.y < 0.6) {
    c.hit = true; R.cones++; setHP(HP - 5); c.v.set((c.x0 - R.x) * 6 + rand(-1, 1), rand(4, 6), -R.speed * 0.9); c.w.set(rand(-12, 12), 0, rand(-12, 12)); R.speed *= 0.95; pop('BONK!'); clank(5); tone(300, 120, 0.12, 'triangle', 0.06);
  }
  for (const n of TNTS) if (n.alive && Math.abs(R.s - n.s) < 0.75 && Math.abs(R.x - n.x) < 0.8 && R.y < 0.95) {
    n.alive = false; n.g.visible = false; explodeAt(new V3(n.x, 0.6, -n.s)); R.tnt = (R.tnt || 0) + 1;
    R.grounded = false; R.vy = 9; R.xT += (R.x >= n.x ? 1 : -1) * 1.6; if (!reduceMotion) shake = 0.8;
    if (FORM.kind === 'fire') { lastPop = 0; pop('FIREPROOF!', 'green'); setFace('happy', 900); } else { setHP(HP - 10); graze({}, R.x >= n.x ? 1 : -1, Math.random() < 0.25); if (state !== 'ride') return; lastPop = 0; pop('KABOOM!', 'green'); }
  }
  for (const so of SOCIAL) if (!so.taken && Math.abs(R.s - so.s) < 1 && Math.abs(R.x - so.x) < 1.2 && R.y < 2.4) { so.taken = true; so.m.visible = false; socialFx(so.kind); burst(so.m.position, 12, CONF, 4); slowUntil = now + 700; slowK = 0.4; setFace('happy', 1000); }
  for (const pk of PICKS) if (!pk.taken && Math.abs(R.s - pk.s) < 1 && Math.abs(R.x - pk.x) < 1 && R.y < 2.4) {
    pk.taken = true; pk.m.visible = false; burst(pk.m.position, 30, CONF, 5);
    if (pk.kind === 'cannon') equipCannon(); else { R.shield = true; lastPop = 0; pop('SHIELD UP!', 'green'); tone(500, 1500, 0.3, 'sine', 0.06); }
  }
  for (const sp of SPARES) if (!sp.taken && Math.abs(R.s - sp.s) < 1 && Math.abs(R.x - sp.x) < 1 && R.y < 2.4) {
    sp.taken = true; sp.m.visible = false; setHP(HP + 30); burst(sp.m.position, 40, CONF, 5);
    pop(reattach() ? 'PATCHED UP!' : '+30 HP', 'green'); setFace('happy', 1200); tone(520, 1040, 0.25, 'square', 0.05); tone(780, 1560, 0.2, 'square', 0.04, 0.1);
  }
  for (const b of BOOSTS) {
    if (!b.used && R.grounded && Math.abs(R.s - b.s) < 1.8 && Math.abs(R.x - b.x) < 1.4) { b.used = true; R.speed = Math.min(34, R.speed + 6); pop('BOOST!', 'green'); tone(300, 1300, 0.3, 'sawtooth', 0.04); }
  }
  GATES.forEach((gt, i) => { if (!gt.used && ps0 < gt.s && R.s >= gt.s && R.y < 4.5 && Math.abs(R.x) < HALF + 0.3) { gt.used = true; takeGate(i, R.x < 0 ? 0 : 1); } });
  R.maxS = Math.max(R.maxS, R.s); R.top = Math.max(R.top, R.speed);
}
function stepParts(dt) {
  for (const p of parts) {
    const u = p.userData; if (u.detached) continue;
    u.v.y -= 9.8 * 1.1 * dt;
    p.position.addScaledVector(u.v, dt);
    const wl = u.w.length();
    if (wl > 1e-4) { tq.setFromAxisAngle(tv.copy(u.w).multiplyScalar(1 / wl), wl * dt); p.quaternion.premultiply(tq); }
    let touched = false;
    for (const s of u.samples) {
      tv2.copy(s.p).applyQuaternion(p.quaternion).add(p.position);
      const fl = floorAt(tv2.x, tv2.z), pen = fl - (tv2.y - s.r);
      if (pen > 0 && pen < 0.8) {
        p.position.y += pen; touched = true;
        const vy = u.v.y;
        if (vy < 0) {
          if (vy < -2) { clank(-vy); if (-vy > 3.5) burst(tv2, 6, SPARK, 3); }
          u.v.y = -vy * 0.3;
          const r = tv.copy(tv2).sub(p.position);
          u.w.add(new V3().crossVectors(r, new V3(0, -vy * 0.9, 0)));
        }
      }
    }
    if (touched) { const f = Math.pow(0.3, dt); u.v.x *= f; u.v.z *= f; u.w.multiplyScalar(Math.pow(0.25, dt)); if (u.v.lengthSq() > 4 && Math.random() < 0.15) burst(tv2, 2, SPARK, 2); }
    else u.w.multiplyScalar(Math.pow(0.9, dt));
    if (p.position.y < -89) { p.position.y = -89; u.v.set(0, 0, 0); u.w.set(0, 0, 0); }
    for (const sw of SAWS) { if (Math.abs(-p.position.z - sw.s) < 0.5 && Math.hypot(p.position.x - sw.x, p.position.y - sw.y) < sw.R + 0.2) { u.v.x += Math.sign(p.position.x - sw.x || 1) * 4; u.v.y += 3; burst(p.position, 12, SPARK, 5); } }
  }
  if (BB.free) {
    BB.v.y -= 9.8 * dt; board.position.addScaledVector(BB.v, dt);
    const wl = BB.w.length(); if (wl > 1e-3) { tq.setFromAxisAngle(tv.copy(BB.w).multiplyScalar(1 / wl), wl * dt); board.quaternion.premultiply(tq); }
    const fl = floorAt(board.position.x, board.position.z);
    if (board.position.y < fl + 0.06 && board.position.y > fl - 0.8) { board.position.y = fl + 0.06; if (VEH === 'cart' && BB.v.y < -3) { const lp = board.worldToLocal(new V3(board.position.x, fl, board.position.z)); labDentAt(clamp(lp.y / CART_S, 0, 1.02), clamp(lp.z / CART_S, -0.47, 0.58), -BB.v.y); } if (BB.v.y < 0) BB.v.y *= -0.35; BB.v.x *= 0.9; BB.v.z *= 0.9; BB.w.multiplyScalar(0.8); }
    if (board.position.y < -89) { board.position.y = -89; BB.v.set(0, 0, 0); }
  }
}

// ---------- input ----------
let drag = null;
canvas.addEventListener('pointerdown', e => { if (state === 'replay') { endFilm(); return; } initAudio(); startRoll(); drag = { x: e.clientX, x0: R.xT, t: performance.now(), moved: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; drag.moved = Math.max(drag.moved, Math.abs(dx)); R.xT = clamp(drag.x0 + dx / Math.max(260, canvas.clientWidth) * 9, -3.8, 3.8); });
canvas.addEventListener('pointerup', () => { if (drag && drag.moved < 12 && performance.now() - drag.t < 260) action(); drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
const keys = {};
window.addEventListener('keydown', e => { initAudio(); startRoll(); if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) action(); } keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });
function action() {
  if (state === 'result') { resetRun(); return; }
  if (state === 'intro') { if (R.carry) R.carryT = 99; else R.vy = Math.min(R.vy, -16); return; }
  if (state === 'ride' && R.grounded && !(R.jumpPend > 0)) { R.jumpPend = 0.12; crouchV += 14; } // a deep squat first; the push-off happens in stepRide
  else if (state === 'ride' && !R.grounded && !R.slam) { R.slam = true; R.vy = Math.min(R.vy, -17); crouchV += 2; tone(700, 150, 0.2, 'triangle', 0.06); setFace('scared', 600); }
}
$('bNew').onclick = () => { initAudio(); startRoll(); resetRun(); };
$('bFire').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); fireCannon(); });
$('rFilm').onclick = () => { initAudio(); startFilm(LAST_REC, true); };
$('rVideo').onclick = () => { initAudio(); startFilm(LAST_REC, true, true); };
$('rSave').onclick = () => saveReplay();
$('bRep').onclick = () => openReplays();
$('repClose').onclick = () => { $('replays').hidden = true; };
$('rMenu').onclick = () => { location.href = 'index.html'; };
$('rAgain').onclick = () => { initAudio(); startRoll(); resetRun(); };
$('bSlow').onclick = () => { manualSlow = !manualSlow; $('bSlow').setAttribute('aria-pressed', String(manualSlow)); };
$('bHook').onclick = () => { stage.classList.toggle('nohook'); $('bHook').setAttribute('aria-pressed', String(!stage.classList.contains('nohook'))); };
$('bLoop').setAttribute('aria-pressed', String(LOOP));
LIVE_REC = false;
$('bLive').setAttribute('aria-pressed', String(REC_MODE));
$('bLive').onclick = () => {
  REC_MODE = !REC_MODE; $('bLive').setAttribute('aria-pressed', String(REC_MODE)); try { localStorage.setItem('daggie-recmode', REC_MODE ? '1' : '0'); } catch (e) {}
  applyRecMode(); lastPop = 0; pop(REC_MODE ? 'REC MODE ON' : 'REC MODE OFF', 'lilac');
};
applyRecMode();
$('bLoop').onclick = () => { LOOP = !LOOP; $('bLoop').setAttribute('aria-pressed', String(LOOP)); try { localStorage.setItem('daggie-loop', LOOP ? '1' : '0'); } catch (e) {} };
$('bHide').onclick = () => { stage.classList.add('clean'); $('bShow').hidden = false; };
$('bShow').onclick = () => { stage.classList.remove('clean'); $('bShow').hidden = true; };
let rollGain = null;
function startRoll() {
  if (!AC || rollGain) return;
  try {
    const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    rollGain = AC.createGain(); rollGain.gain.value = 0; src.connect(lp); lp.connect(rollGain); rollGain.connect(OUT()); src.start();
  } catch (e) { rollGain = null; }
}

// ---------- camera & loop ----------
const camPos = new V3(), camLook = new V3(), wantPos = new V3(), wantLook = new V3();
let snapCam = true;
function camTargets(now, dt) {
  if (MODE === 'lab' && (state === 'lab' || state === 'ride')) return labCam(now, dt);
  const b = rider.position;
  if (state === 'intro') { wantPos.set(3.8, Math.max(2.5, b.y * 0.55 + 2.6), b.z + 7.5); wantLook.set(0, b.y * 0.85 + 0.8, b.z - 8); return 5; }
  if (state === 'ride') {
    if (!R.grounded && R.s > RAMP1 - 1) { wantPos.set(b.x + 12, b.y + 2.2, b.z + 3.5); wantLook.set(b.x, b.y + 1, b.z - 3); return 3; }
    const fb = FLOCK.filter(f => f.state === 'ride').length, back = fb > 2 ? 4.2 : fb > 0 ? 2 : 0;
    wantPos.set(b.x * 0.7, b.y + 3.2 + back * 0.4, b.z + 6.6 + back); wantLook.set(b.x * 0.85, b.y + 1.3, b.z - 9); return 7;
  }
  if (DLV && (state === 'passed' || (state === 'result' && cause === ''))) {
    const fy = trackH(DOOR_S) ?? 0;
    if (D.phase === 'go' || D.phase === 'approach') { wantPos.set(b.x + 1.6, b.y + 2.1, b.z + 5.2); wantLook.set(b.x, b.y + 1.1, b.z - 7); return 9; } // stay right behind him on the way to her door
    // at the door: a three-quarter view from the side that holds Daggie, Penny and the door in one frame
    if (!D.camSet) { D.camSet = true; snapCam = true; }
    wantPos.set(5.2, fy + 1.85, -DOOR_S + 5.8); wantLook.set(0.35, fy + 1.15, -DOOR_S + 2.0); return 6;
  }
  if (state === 'passed' || (state === 'result' && cause === '')) { wantPos.set(b.x + 2.8, b.y + 2.2, b.z - 6.5); wantLook.set(b.x, b.y + 1.4, b.z); return 2.5; }
  const c = pelvis.position;
  orbitA += dt * (now < slowUntil ? 0.25 : 0.45);
  wantPos.set(c.x + Math.sin(orbitA) * 7.5, Math.max(c.y + 3, floorAt(c.x, c.z) + 2), c.z + Math.cos(orbitA) * 7.5); wantLook.copy(c);
  return 3;
}
function baseFov() { return stage.clientWidth / stage.clientHeight < 0.8 ? 72 : 58; }
function resize() {
  const W = stage.clientWidth, H = stage.clientHeight;
  let w = W, h = H;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.style.left = Math.round((W - w) / 2) + 'px'; canvas.style.top = Math.round((H - h) / 2) + 'px';
  renderer.setSize(w, h, false); composer.setPixelRatio(PR); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = baseFov(); camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
const clock = new THREE.Clock();
let acc = 0, landedTrick = false;
let lastTs = 0;
function frame(vts) {
  const now = performance.now(), fts = vts || now;
  { const on = state === 'intro' || state === 'ride' || state === 'passed' || state === 'crashed'; if (on !== stage.classList.contains('playing')) stage.classList.toggle('playing', on); }
  const dt = lastTs ? Math.min(0.05, Math.max(0.001, (fts - lastTs) / 1000)) : 1 / 60; lastTs = fts;
  if (state === 'replay') {
    replayFrame(dt);
    if (PLAY) PLAY.shotSnap = snapCam;
    if (snapCam) { camPos.copy(wantPos); camLook.copy(wantLook); snapCam = false; }
    const fc = 1 - Math.exp(-dt * 9); if (PLAY && PLAY.rigid) { camPos.copy(wantPos); camLook.lerp(wantLook, Math.min(1, fc * 2.5)); } else { camPos.lerp(wantPos, fc); camLook.lerp(wantLook, Math.min(1, fc * 1.4)); }
    camera.position.copy(camPos); camera.lookAt(camLook); if (PLAY && PLAY.roll) camera.rotateZ(PLAY.roll);
    const wf = PLAY ? PLAY.fov : baseFov(); if (Math.abs(camera.fov - wf) > 0.05) { camera.fov += (wf - camera.fov) * (PLAY && PLAY.shotSnap ? 1 : 0.25); camera.updateProjectionMatrix(); }
    sunLight.position.copy(camLook).addScaledVector(SUN, 40); sunLight.target.position.copy(camLook);
    composer.render(); if (PLAY && PLAY.wantRec) { PLAY.wantRec = false; startRecorder(); } if (recorder) composite(); requestAnimationFrame(frame); return;
  }
  let ts = now < slowUntil ? slowK : 1; if (manualSlow) ts = Math.min(ts, 0.35);
  const sdt = dt * ts; simT += sdt;
  for (const sw of SAWS) { if (sw.A) { sw.x = sw.x0 + Math.sin(simT * sw.w + sw.ph) * sw.A; sw.g.position.x = sw.x; } sw.g.rotation.z -= 14 * sdt; }
  BIG.rotation.z -= 6 * sdt; ringAnimate(simT);
  animateObstacles(simT, sdt, R.s || 0);
  for (const sp of SPARES) if (!sp.taken) { sp.m.position.set(sp.x, 1.2 + Math.sin(simT * 3 + sp.s) * 0.18, -sp.s); sp.m.rotation.set(0.4, simT * 1.8, 0.2); }
  stepDetached(sdt, now); animateBooms(sdt, simT);
  for (const so of SOCIAL) if (!so.taken) { so.m.position.set(so.x, 1.4 + Math.sin(simT * 2.5 + so.s) * 0.2, -so.s); so.m.rotation.set(0, Math.sin(simT * 2) * 0.5 + Math.PI, 0); }
  for (const pk of PICKS) if (!pk.taken) { pk.m.position.set(pk.x, 1.25 + Math.sin(simT * 3 + pk.s) * 0.2, -pk.s); pk.m.rotation.set(0.3, simT * 2, 0.2); }
  if (CANNON.on && CANNON.grow < 1) { CANNON.grow = Math.min(1, CANNON.grow + sdt * 3); const g = CANNON.grow, e = 1 + 2.2 * Math.pow(g - 1, 3) + 1.2 * Math.pow(g - 1, 2); cannonG.scale.setScalar(Math.max(0.01, e)); cannonG.rotateY(sdt * 12 * (1 - g)); }
  if (state === 'ride' || state === 'passed' || state === 'intro') stepForm(sdt);
  if (state === 'ride') stepProjectiles(sdt);
  bubble.visible = !!R.shield && (state === 'ride' || state === 'passed'); if (bubble.visible) { torso.getWorldPosition(bubble.position); bubble.material.opacity = 0.12 + Math.sin(simT * 6) * 0.05; bubble.rotation.y += sdt; }
  $('progFill').style.width = clamp((R.s || 0) / LAND0 * 100, 0, 100) + '%';
  clouds.position.x = Math.sin(simT * 0.02) * 6;
  if (keys.ArrowLeft || keys.KeyA) R.xT = clamp(R.xT - 8 * dt, -3.8, 3.8);
  if (keys.ArrowRight || keys.KeyD) R.xT = clamp(R.xT + 8 * dt, -3.8, 3.8);
  const t = (now - stateT) / 1000;
  if (MODE === 'lab') labStep(sdt, now);
  if (state === 'intro') {
    drone.visible = true; rotors.forEach((r, i) => { r.rotation.y += sdt * (i % 2 ? -70 : 70); });
    R.s += INTRO_V * sdt; // the board/cart is already rolling; drone and Daggie keep pace above it
    board.position.set(0, trackH(R.s) ?? 0, -R.s); board.rotation.set(0, 0, 0); for (const w of wheels) w.rotation.x -= INTRO_V / WHEEL_R * sdt;
    if (R.carry) {
      R.carryT += sdt; R.y = DROP_H;
      drone.position.set(R.x, DROP_H + 2.55, -R.s); drone.rotation.set(-0.16, 0, Math.sin(simT * 3) * 0.04);
      if (R.carryT >= 0.55) { R.carry = false; R.vy = 0; tone(700, 300, 0.12, 'square', 0.05); pop('DROP!', 'lilac'); setFace('scared', 900); }
    } else {
      R.vy -= 9.8 * sdt; R.y += R.vy * sdt;
      drone.position.y += sdt * 7; drone.position.z -= sdt * (INTRO_V + 5); drone.rotation.x = -0.35;
    }
    if (!R.carry && R.y <= 0) {
      R.y = 0; R.vy = 0; R.grounded = true; R.speed = INTRO_V; state = 'ride'; stateT = now; drone.visible = false;
      crouch = 0.9; crouchV = 0; landImpact(6);
      burst(new V3(0, 0.2, -R.s), 40, SPARK, 7); tone(150, 45, 0.3, 'sine', 0.3); pop(trick.name, 'lilac'); setFace('wow', 1100);
      if (!reduceMotion) shake = 0.45; // no slow-mo here: the ride starts at full speed right on touchdown
    }
  }
  if ((state === 'ride' || state === 'passed') && MODE !== 'lab') {
    const n = Math.min(8, Math.max(1, Math.ceil(sdt * 120 - 1e-6))), h = sdt / n;
    for (let k = 0; k < n; k++) { stepRide(h, now); if (state !== 'ride' && state !== 'passed') break; }
    stepDebris(sdt, now);
    if (state === 'ride' && now > faceUntil) setFace(!R.grounded ? 'wow' : R.speed > 25 ? 'scared' : 'idle');
    if (state === 'ride' && t > 1.4) $('hook').classList.remove('show');
    if (state === 'passed' && (DLV ? (D.rated && D.revealT > 4.2) || t > 30 : t > 3.2)) showResult();
  }
  if (MODE === 'lab') { if (state === 'lab' || state === 'ride') labPose(simT); }
  else if (state === 'intro' || state === 'ride' || state === 'passed') { placeRider(simT); poseBody(simT); }
  if (state === 'crashed' || (state === 'result' && cause !== '')) {
    const n = Math.min(8, Math.max(1, Math.ceil(sdt * 120 - 1e-6))), h = sdt / n;
    for (let k = 0; k < n; k++) { stepParts(h); stepDebris(h, now); }
    if (state === 'crashed' && now > faceUntil) setFace((now - stateT) > 2500 ? ((Math.floor(now / 2000) % 2) ? 'okq' : 'worried') : 'scared');
    if (state === 'crashed' && now - stateT > 2800) showResult();
  }
  stepFlock(sdt);
  dlvStep(sdt, now); if (DLV && state === 'passed' && D.phase === 'approach' && (R.s > DOOR_S - 3.6)) D.phase = 'door';
  if (DLV && (D.phase === 'door' || D.phase === 'hand' || D.phase === 'box')) R.speed = 0;
  stepMess(sdt);
  drawFace(now);
  updateSparks(sdt);
  const k = camTargets(now, dt);
  if (snapCam) { camPos.copy(wantPos); camLook.copy(wantLook); snapCam = false; }
  const f = 1 - Math.exp(-dt * k);
  camPos.lerp(wantPos, f); camLook.lerp(wantLook, Math.min(1, f * 1.5));
  camera.position.copy(camPos);
  if (shake > 0.003) { camera.position.x += rand(-1, 1) * shake * 0.3; camera.position.y += rand(-1, 1) * shake * 0.3; shake *= Math.pow(0.02, dt); }
  camera.lookAt(camLook);
  const tgtFov = baseFov() + (state === 'ride' ? Math.max(0, R.speed - 14) * 0.5 : 0);
  if (Math.abs(camera.fov - tgtFov) > 0.05) { camera.fov += (tgtFov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  sunLight.position.copy(camLook).addScaledVector(SUN, 40); sunLight.target.position.copy(camLook);
  $('spd').textContent = String(Math.round((state === 'ride' ? R.speed : 0) * 2.237));
  $('dist').textContent = String(Math.round(R.maxS));
  if (rollGain && AC) rollGain.gain.setTargetAtTime(state === 'ride' && R.grounded ? Math.min(0.09, R.speed * 0.003) : 0, AC.currentTime, 0.05);
  recordFrame(dt);
  composer.render();
  if (liveWant && !PLAY) { liveWant = false; if (startRecorder()) { $('recDot').hidden = false; stage.classList.add('liverec'); } } // bottom bar hides while a ride is being recorded // start on a freshly drawn frame
  if (liveRecOn()) { composite(); if (liveStop && now >= liveStop) finishLiveRec(); }
  requestAnimationFrame(frame);
}

// =====================================================================
// REAL BODY PHYSICS: Daggie's joints as points, bones as links, hinges that only bend the right way,
// hands that grip the cart until the pull is too strong, arms / legs / head that tear off on hard hits.
// The same numbers were tuned offline: <=20 mph he stays in, 25-30 almost flies out,
// 35-40 flies out but hangs on by his hands, 45+ he is thrown out, 100+ limbs tear off.
// =====================================================================
// RAGDOLL-CORE-START (pure math, no three.js: position-based dynamics on joint points)
class RagCore {
  constructor(n) {
    const cap = n + 24; this.n = n; this.x = new Float64Array(cap * 3); this.o = new Float64Array(cap * 3); this.r = new Float64Array(cap).fill(0.07); this.inv = new Float64Array(cap).fill(1); this.segs = [];
    this.cn = new Float64Array(cap * 3); this.cf = new Uint8Array(cap);
    this.links = []; this.hinges = []; this.pins = []; this.groups = {}; this.broken = []; this.onFloor = new Uint8Array(n); this.cyls = []; this.box = null; this.floor = () => 0; this.g = -9.8; this.frame = null;
  }
  set(i, x, y, z) { const k = i * 3; this.x[k] = this.o[k] = x; this.x[k + 1] = this.o[k + 1] = y; this.x[k + 2] = this.o[k + 2] = z; }
  vel(i, vx, vy, vz, dt) { const k = i * 3; this.o[k] = this.x[k] - vx * dt; this.o[k + 1] = this.x[k + 1] - vy * dt; this.o[k + 2] = this.x[k + 2] - vz * dt; }
  dist(a, b) { const A = a * 3, B = b * 3; return Math.hypot(this.x[B] - this.x[A], this.x[B + 1] - this.x[A + 1], this.x[B + 2] - this.x[A + 2]); }
  // type 0 = keep length, 1 = at least, 2 = at most. group: breakable joint name
  link(a, b, stiff = 1, type = 0, len = null, group = null, breakAt = 0) { const L = { a, b, len: len ?? this.dist(a, b), stiff, type, group, breakAt, on: true }; this.links.push(L); if (group) (this.groups[group] = this.groups[group] || []).push(L); return L; }
  // a cut separates a set of points (an arm, a leg, the head) from the rest when its trigger link is stretched too far
  cut(name, set, a, b, ratio) { this.cuts = this.cuts || []; this.cuts.push({ name, set: new Set(set), a, b, len: this.dist(a, b), ratio, done: false }); }
  breakGroup(name) { const c = (this.cuts || []).find(q => q.name === name); if (!c || c.done) return; c.done = true; for (const L of this.links) if (L.on && (c.set.has(L.a) !== c.set.has(L.b))) L.on = false; this.hinges = this.hinges.filter(h => !(c.set.has(h.a) !== c.set.has(h.b) || c.set.has(h.b) !== c.set.has(h.c))); this.broken.push(name); if (this.onBreak) this.onBreak(name); }
  solveLink(L) {
    const A = L.a * 3, B = L.b * 3, x = this.x, dx = x[B] - x[A], dy = x[B + 1] - x[A + 1], dz = x[B + 2] - x[A + 2], d = Math.hypot(dx, dy, dz) || 1e-9;
    if (L.type === 1 && d >= L.len) return; if (L.type === 2 && d <= L.len) return;
    const wa = this.inv[L.a], wb = this.inv[L.b], w = wa + wb; if (!w) return;
    const k = (d - L.len) / d * L.stiff / w;
    x[A] += dx * k * wa; x[A + 1] += dy * k * wa; x[A + 2] += dz * k * wa; x[B] -= dx * k * wb; x[B + 1] -= dy * k * wb; x[B + 2] -= dz * k * wb;
  }
  // hinge: middle point b must stick out along `dir` (knees forward, elbows back) — no bending the wrong way
  solveHinge(h, dirs) {
    const x = this.x, A = h.a * 3, B = h.b * 3, C = h.c * 3, d = dirs[h.dir];
    const mx = (x[A] + x[C]) / 2, my = (x[A + 1] + x[C + 1]) / 2, mz = (x[A + 2] + x[C + 2]) / 2;
    const s = (x[B] - mx) * d[0] + (x[B + 1] - my) * d[1] + (x[B + 2] - mz) * d[2];
    if (s >= h.min) return; const c = (h.min - s);
    x[B] += d[0] * c * 0.6; x[B + 1] += d[1] * c * 0.6; x[B + 2] += d[2] * c * 0.6;
    x[A] -= d[0] * c * 0.2; x[A + 1] -= d[1] * c * 0.2; x[A + 2] -= d[2] * c * 0.2; x[C] -= d[0] * c * 0.2; x[C + 1] -= d[1] * c * 0.2; x[C + 2] -= d[2] * c * 0.2;
  }
  // the middle of a bone also collides: a thigh or a forearm can no longer slip between the wires while its two ends stay outside
  seg(a, b, r) { const i = this.n + this.segs.length; this.segs.push({ a, b, i }); this.r[i] = r; this.segMid(this.segs[this.segs.length - 1]); return i; }
  segMid(s) { const A = s.a * 3, B = s.b * 3, I = s.i * 3; for (let q = 0; q < 3; q++) { this.x[I + q] = (this.x[A + q] + this.x[B + q]) / 2; this.o[I + q] = (this.o[A + q] + this.o[B + q]) / 2; } }
  initCart() { const B = this.box; const m = this.n + this.segs.length; this.inCart = new Uint8Array(m); for (const s of this.segs) this.segMid(s); for (let i = 0; i < m; i++) { const k = i * 3, q = B.toLocal(this.x[k], this.x[k + 1], this.x[k + 2]); this.inCart[i] = Math.abs(q[0]) < B.hw && q[2] > B.zf && q[2] < B.zb && q[1] > B.y0 - 0.05 && q[1] < B.y1 ? 1 : 0; } }
  // push a point out of the cart walls, the post and the floor; remember the contact normal for the velocity fix
  contact(i, nx, ny, nz) { const k = i * 3; this.cn[k] = nx; this.cn[k + 1] = ny; this.cn[k + 2] = nz; this.cf[i] = 1; }
  collide(i) {
    const x = this.x, k = i * 3, r = this.r[i];
    for (const c of this.cyls) { if (x[k + 1] > c.h + r) continue; const dx = x[k] - c.x, dz = x[k + 2] - c.z, d = Math.hypot(dx, dz); if (d < c.r + r) { const f = (c.r + r) / (d || 1e-6); x[k] = c.x + dx * f; x[k + 2] = c.z + dz * f; this.contact(i, dx / (d || 1), 0, dz / (d || 1)); } }
    const B = this.box;
    if (B && B.on && !(this.skipBox && this.skipBox[i])) {
      const L = B.toLocal(x[k], x[k + 1], x[k + 2]);
      if (B.frontOpen && L[2] < B.zf) this.inCart[i] = 0; // the front wall burst: anything past it is out
      else {
        // walls have thickness from the point's radius: the inside for this point is the basket shrunk by r
        const m0 = B.inset || 0, hx = B.hw - r - m0, zfi = B.frontOpen ? -1e9 : B.zf + r + m0, zbi = B.zb - r - m0, y0i = B.y0 + r; // inset: keep the (bigger) visible parts off the wires
        const inN = Math.abs(L[0]) < hx && L[2] > zfi && L[2] < zbi && L[1] > y0i && L[1] < B.y1, was = this.inCart[i];
        if (L[1] < B.y1 && L[1] > B.y0 - 0.3) {
          let n = null;
          if (was && !inN) {
            if (L[0] > hx) { L[0] = hx; n = [-1, 0, 0]; } else if (L[0] < -hx) { L[0] = -hx; n = [1, 0, 0]; }
            if (L[2] < zfi) { L[2] = zfi; n = [0, 0, 1]; } else if (L[2] > zbi) { L[2] = zbi; n = [0, 0, -1]; }
            if (L[1] < y0i) { L[1] = y0i; n = [0, 1, 0]; }
          } else if (!was) {
            const hxo = B.hw + r, zfo = B.zf - r, zbo = B.zb + r, y0o = B.y0 - r;
            if (Math.abs(L[0]) < hxo && L[2] > zfo && L[2] < zbo && L[1] > y0o) {
              // push out through the face it came from, judged in the cart's previous pose (the walls move too)
              const P = B.toLocalPrev ? B.toLocalPrev(this.o[k], this.o[k + 1], this.o[k + 2]) : null;
              let d = [hxo - Math.abs(L[0]), L[2] - zfo, zbo - L[2], L[1] - y0o, B.y1 - L[1]];
              if (P) { const came = [Math.abs(P[0]) >= hxo - 0.01, P[2] <= zfo + 0.01, P[2] >= zbo - 0.01, P[1] <= y0o + 0.01, P[1] >= B.y1 - 0.01]; d = d.map((v, q) => came[q] ? v - 10 : v); }
              const m = Math.min(...d), j = d.indexOf(m);
              if (j === 0) { L[0] = Math.sign(L[0] || 1) * hxo; n = [Math.sign(L[0]), 0, 0]; }
              else if (j === 1) { L[2] = zfo; n = [0, 0, -1]; } else if (j === 2) { L[2] = zbo; n = [0, 0, 1]; }
              else if (j === 3) { L[1] = y0o; n = [0, -1, 0]; } else n = null;
            }
          }
          if (n) { const w = B.toWorld(L[0], L[1], L[2]); x[k] = w[0]; x[k + 1] = w[1]; x[k + 2] = w[2]; const nw = B.dirWorld(n[0], n[1], n[2]); this.contact(i, nw[0], nw[1], nw[2]); }
        }
        const L2 = B.toLocal(x[k], x[k + 1], x[k + 2]);
        this.inCart[i] = Math.abs(L2[0]) <= hx + 1e-3 && L2[2] >= zfi - 1e-3 && L2[2] <= zbi + 1e-3 && L2[1] >= y0i - 1e-3 && L2[1] < B.y1 ? 1 : 0;
      }
    }
    const fy = this.floor(x[k], x[k + 2]) + r;
    if (x[k + 1] < fy && x[k + 1] > fy - 1.2) { x[k + 1] = fy; this.contact(i, 0, 1, 0); this.onFloor[i] = 1; } else this.onFloor[i] = 0;
  }
  // settle the starting pose onto the skeleton's own lengths without creating speed
  settle(n = 60) { const x = this.x; for (let it = 0; it < n; it++) { const dirs = this.frame ? this.frame(this) : null; for (const L of this.links) if (L.on) this.solveLink(L); if (dirs) for (const h of this.hinges) this.solveHinge(h, dirs); for (const p of this.pins) if (p.on) { const t = p.target(), k = p.i * 3; x[k] += (t[0] - x[k]) * p.stiff; x[k + 1] += (t[1] - x[k + 1]) * p.stiff; x[k + 2] += (t[2] - x[k + 2]) * p.stiff; } for (let i = 0; i < this.n; i++) this.collide(i); } this.o.set(this.x); }
  step(dt, iters = 8) {
    this.dt = dt; this.time = (this.time || 0) + dt;
    const x = this.x, o = this.o, n = this.n, g = this.g * dt * dt;
    // breakable joints tear when a hit stretches them too far
    for (const c of (this.cuts || [])) if (!c.done && this.dist(c.a, c.b) > c.len * c.ratio) this.breakGroup(c.name);
    for (let i = 0; i < n; i++) {
      const k = i * 3; if (!this.inv[i]) continue;
      const fr = 0.999;
      const vx = (x[k] - o[k]) * fr, vy = (x[k + 1] - o[k + 1]) * 0.999, vz = (x[k + 2] - o[k + 2]) * fr;
      o[k] = x[k]; o[k + 1] = x[k + 1]; o[k + 2] = x[k + 2];
      x[k] += vx; x[k + 1] += vy + g; x[k + 2] += vz;
    }
    // grip check after moving: how hard is the body pulling the hand away from the cart?
    for (const p of this.pins) if (p.on) {
      const t = p.target(), k = p.i * 3, e = Math.hypot(x[k] - t[0], x[k + 1] - t[1], x[k + 2] - t[2]); p.err = e;
      // the grip gives way when the body is yanked away from the cart faster than a hand can hold (p.maxV, m/s)
      let rel = 0; if (p.body != null) { const b = p.body * 3, dd = Math.hypot(x[b] - t[0], x[b + 1] - t[1], x[b + 2] - t[2]); if (p.prevD != null) { const inst = (dd - p.prevD) / dt; p.relS = (p.relS || 0) + (inst - (p.relS || 0)) * Math.min(1, dt / 0.04); rel = Math.max(0, p.relS); } p.prevD = dd; } // smoothed over ~40 ms // how fast the body is pulling away from the hand
      p.strain = (p.strain || 0) * 0.85 + (p.tens || 0); p.tens = 0; // how hard the arm pulled on the hand last step, kept for a moment
      if ((p.forceAt && this.time > p.forceAt) || (this.time > (p.grace || 0) && (p.strain > p.maxErr || (p.maxV && rel > p.maxV)))) { p.on = false; if (this.skipBox) { this.skipBox[p.i] = 0; if (p.w != null) this.skipBox[p.w] = 0; } if (this.onRelease) this.onRelease(p); } }
    const dirs = this.frame ? this.frame(this) : null;
    this.cf.fill(0);
    for (let it = 0; it < iters; it++) {
      for (const L of this.links) if (L.on && !(this.relax && L.type === 1)) this.solveLink(L);
      if (dirs && !this.relax) for (const h of this.hinges) if (h.on !== false) this.solveHinge(h, dirs); // relax: in the first moments of a crash the joint limits only add energy (they pole-vault the body)
      for (const p of this.pins) if (p.on) { const t = p.target(), k = p.i * 3, dx = (t[0] - x[k]) * p.stiff, dy = (t[1] - x[k + 1]) * p.stiff, dz = (t[2] - x[k + 2]) * p.stiff; x[k] += dx; x[k + 1] += dy; x[k + 2] += dz; p.tens = (p.tens || 0) + Math.hypot(dx, dy, dz); }
      for (let i = 0; i < n; i++) this.collide(i);
      for (const s of this.segs) { this.segMid(s); const I = s.i * 3, mx = x[I], my = x[I + 1], mz = x[I + 2]; this.cf[s.i] = 0; this.collide(s.i); const dx = x[I] - mx, dy = x[I + 1] - my, dz = x[I + 2] - mz; if (dx || dy || dz) { for (const e of [s.a, s.b]) { const E = e * 3; x[E] += dx; x[E + 1] += dy; x[E + 2] += dz; if (this.cf[s.i] && !this.cf[e]) { this.cn[E] = this.cn[I]; this.cn[E + 1] = this.cn[I + 1]; this.cn[E + 2] = this.cn[I + 2]; this.cf[e] = 2; } } } /* bone contacts: stop the motion into the wall, no friction */ }
    }
    // contacts are inelastic: remove the speed going into the surface, add some friction along it
    for (let i = 0; i < n; i++) if (this.cf[i]) {
      const k = i * 3, nx = this.cn[k], ny = this.cn[k + 1], nz = this.cn[k + 2];
      let vx = x[k] - o[k], vy = x[k + 1] - o[k + 1], vz = x[k + 2] - o[k + 2]; const vn = vx * nx + vy * ny + vz * nz;
      if (vn < 0) { vx -= nx * vn; vy -= ny * vn; vz -= nz * vn; if (this.limbOf && this.tearSpeed && -vn / this.dt > this.tearSpeed) { const g = this.limbOf[i]; if (g && Math.random() < 0.6) this.breakGroup(g); } }
      if (this.cf[i] === 1) { const f = this.friction ?? 0.75; vx *= f; vz *= f; if (Math.abs(ny) < 0.7) vy *= f; }
      o[k] = x[k] - vx; o[k + 1] = x[k + 1] - vy; o[k + 2] = x[k + 2] - vz;
    }
    if (this.capUp) for (let i = 0; i < n; i++) { const k = i * 3, vy = x[k + 1] - o[k + 1], cap = this.capUp * dt; if (vy > cap) o[k + 1] = x[k + 1] - cap; } // nothing gets kicked upward faster than capUp (m/s)
    // resting contacts fall asleep: tiny leftover motion between touching parts is damped away, so a body at rest lies still instead of trembling
    const sv = (this.sleepV ?? 0.35) * dt;
    for (let i = 0; i < n; i++) { const k = i * 3, vx = x[k] - o[k], vy = x[k + 1] - o[k + 1], vz = x[k + 2] - o[k + 2], sp = Math.hypot(vx, vy, vz);
      if (sp < sv) { const f = 0.55; o[k] = x[k] - vx * f; o[k + 1] = x[k + 1] - vy * f; o[k + 2] = x[k + 2] - vz * f; } }
  }
}
// the shopping cart as a simple rigid body in the side plane: rolls, tips over a bollard, or (at high speed)
// knocks the bollard down, bursts its front and tumbles forward. Its basket is the collision box for the body.
class CartSim {
  constructor(S, lane, bz, br) {
    Object.assign(this, { S, lane, bz, br, zfOut: -0.47 * S - 0.012, zbOut: 0.72 * S, H: 1.12 * S, mode: 'roll', a: 0, w: 0, vy: 0, vz: 0, pl: [0, -0.47 * S - 0.012], pw: [0, 0], knocked: false, burst: false });
    const me = this;
    this.box = { on: true, toLocalPrev: (x, y, z) => me.toLocalPrev(x, y, z), hw: 0.32 * S, y0: 0.4 * S, y1: 1.02 * S, zf: -0.45 * S, zb: 0.45 * S, frontOpen: false, toWorld: (x, y, z) => me.toWorld(x, y, z), toLocal: (x, y, z) => me.toLocal(x, y, z), dirWorld: (x, y, z) => me.dirWorld(x, y, z) };
    this.cyls = [{ x: lane, z: bz, r: br, h: 1.1 }];
  }
  place(zFront) { this.mode = 'roll'; this.a = 0; this.w = 0; this.vy = 0; this.pl = [0, this.zfOut]; this.pw = [0, zFront]; this.knocked = false; this.burst = false; this.box.frontOpen = false; this.cyls.length = 0; this.cyls.push({ x: this.lane, z: this.bz, r: this.br, h: 1.1 }); }
  toWorld(x, y, z) { const c = Math.cos(-this.a), s = Math.sin(-this.a), yy = y - this.pl[0], zz = z - this.pl[1]; return [x + this.lane, this.pw[0] + yy * c - zz * s, this.pw[1] + yy * s + zz * c]; }
  toLocal(X, Y, Z) { const c = Math.cos(this.a), s = Math.sin(this.a), yy = Y - this.pw[0], zz = Z - this.pw[1]; return [X - this.lane, yy * c - zz * s + this.pl[0], yy * s + zz * c + this.pl[1]]; }
  dirWorld(x, y, z) { const c = Math.cos(-this.a), s = Math.sin(-this.a); return [x, y * c - z * s, y * s + z * c]; }
  impact(v) { // v: speed at the moment the front touches the bollard
    if (v < 30) { this.mode = 'pivot'; this.pw = [0, this.bz + this.br]; this.vz = v * 0.1; this.w = Math.min(5, v * 0.2); return; } // the post holds at 15 and 50 mph: the cart stops dead and noses up; from 80 mph it snaps
    this.knocked = true; this.cyls.length = 0; this.burst = v > 22; this.box.frontOpen = this.burst;
    const c = [0.55 * this.S, 0], w = this.toWorld(0, c[0], c[1]); this.pl = c; this.pw = [w[1], w[2]];
    this.mode = 'free'; this.vz = -0.55 * v; this.vy = 0.3; this.w = 0; // the snapped post barely slows the cart: it rolls on flat, so he is thrown straight ahead by his own inertia, not tossed up by a tumbling cart
  }
  savePrev() { this.prev = { a: this.a, pw: this.pw.slice(), pl: this.pl.slice() }; }
  toLocalPrev(X, Y, Z) { const p = this.prev || this, c = Math.cos(p.a), s = Math.sin(p.a), yy = Y - p.pw[0], zz = Z - p.pw[1]; return [X - this.lane, yy * c - zz * s + p.pl[0], yy * s + zz * c + p.pl[1]]; }
  step(dt) {
    this.savePrev();
    if (this.mode === 'roll') { this.pw[1] += this.vz * dt; return this.pw[1] <= this.bz + this.br; } // true = touching the bollard
    if (this.mode === 'pivot') {
      this.pw[1] += this.vz * dt; this.vz *= Math.pow(0.05, dt); this.w -= 20 * Math.cos(this.a) * dt; this.a += this.w * dt;
      if (this.a < 0) { this.a = 0; this.w = -this.w * 0.25; } if (this.a > 1.35) { this.a = 1.35; this.w = Math.min(0, this.w); }
      return false;
    }
    this.vy -= 9.8 * dt; this.pw[0] += this.vy * dt; this.pw[1] += this.vz * dt; this.a += this.w * dt;
    let minY = 1e9, low = null; for (const y of [0, this.H]) for (const z of [this.zfOut, this.zbOut]) { const wy = this.toWorld(0, y, z)[1]; if (wy < minY) { minY = wy; low = [y, z]; } }
    if (minY < 0 && this.vy < -2.5 && this.onHit) this.onHit(low, -this.vy); // a corner slams into the floor
    if (minY < 0) { this.pw[0] -= minY; if (this.vy < 0) this.vy = -this.vy * 0.25; this.vz *= Math.pow(0.02, dt * 4); this.w *= Math.pow(0.02, dt * 3); this.w -= Math.sin(2 * this.a) * 8 * dt; }
    return false;
  }
}
// RAGDOLL-CORE-END
// RAGDOLL-BODY-START (pure: builds Daggie's joint skeleton on a RagCore)
const RAG_NAMES = ['pel', 'waist', 'chest', 'neck', 'top', 'shL', 'elL', 'wrL', 'haL', 'shR', 'elR', 'wrR', 'haR', 'hipL', 'knL', 'anL', 'toL', 'hipR', 'knR', 'anR', 'toR'];
const RAG_R = { pel: 0.14, waist: 0.13, chest: 0.15, neck: 0.08, top: 0.12, sh: 0.08, el: 0.06, wr: 0.05, ha: 0.05, hip: 0.09, kn: 0.07, an: 0.06, to: 0.05 };
function ragBody(core, rest, now, fwdRest, T) {
  // rest / now: name -> [x,y,z]. rest gives bone lengths, now gives the starting pose. T: tuning (break ratios, grip)
  const I = {}; RAG_NAMES.forEach((n, i) => { I[n] = i; core.set(i, ...now[n]); core.r[i] = RAG_R[n.replace(/[LR]$/, '')]; });
  for (const n of ['pel', 'waist', 'chest']) core.inv[I[n]] = 0.5; core.inv[I.top] = 0.8;
  const d = (a, b) => Math.hypot(rest[a][0] - rest[b][0], rest[a][1] - rest[b][1], rest[a][2] - rest[b][2]);
  const L = (a, b, s = 1, type = 0, len = null, group = null, br = 0) => core.link(I[a], I[b], s, type, len ?? d(a, b), group, br);
  // bones
  for (const [a, b] of [['pel', 'waist'], ['waist', 'chest'], ['chest', 'neck'], ['neck', 'top']]) L(a, b);
  for (const s of ['L', 'R']) { L('sh' + s, 'el' + s); L('el' + s, 'wr' + s); L('wr' + s, 'ha' + s); L('hip' + s, 'kn' + s); L('kn' + s, 'an' + s); L('an' + s, 'to' + s); }
  // torso and pelvis blocks (slightly soft so the spine can bend)
  for (const [a, b] of [['chest', 'shL'], ['chest', 'shR'], ['shL', 'shR'], ['neck', 'shL'], ['neck', 'shR'], ['waist', 'shL'], ['waist', 'shR']]) L(a, b, 0.9);
  for (const [a, b] of [['pel', 'hipL'], ['pel', 'hipR'], ['hipL', 'hipR'], ['waist', 'hipL'], ['waist', 'hipR']]) L(a, b, 0.95);
  L('chest', 'pel', 0.25); L('shL', 'hipL', 0.35); L('shR', 'hipR', 0.35); L('shL', 'hipR', 0.2); L('shR', 'hipL', 0.2);
  L('top', 'shL', 0.4); L('top', 'shR', 0.4);
  // a stiffer spine: the chest doesn't wring around the hips like a rag
  L('shL', 'hipR', 0.5); L('shR', 'hipL', 0.5);
  // human range of motion: arms can't pass through the chest, legs can't fold through the belly or cross through each other
  for (const s of ['L', 'R']) { const o = s === 'L' ? 'R' : 'L';
    L('el' + s, 'hip' + s, 1, 1, d('el' + s, 'hip' + s) * 0.45); L('el' + s, 'sh' + o, 1, 1, d('el' + s, 'sh' + o) * 0.7);
    L('kn' + s, 'chest', 1, 1, d('kn' + s, 'chest') * 0.25); L('an' + s, 'pel', 1, 1, d('an' + s, 'pel') * 0.3); L('ha' + s, 'top', 1, 1, 0.12); }
  L('knL', 'knR', 1, 1, 0.14); L('anL', 'anR', 1, 1, 0.1);
  L('top', 'chest', 1, 2, d('top', 'chest') * 1.04); // the neck doesn't stretch
  // muscle tone: very soft springs that keep the pose he had, so he tumbles like a tensed body, not a sack
  if (T.tone) { const tone = (a, b2) => core.link(I[a], I[b2], T.tone, 0, Math.hypot(now[a][0] - now[b2][0], now[a][1] - now[b2][1], now[a][2] - now[b2][2]));
    for (const s of ['L', 'R']) { tone('sh' + s, 'wr' + s); tone('hip' + s, 'an' + s); tone('chest', 'el' + s); tone('pel', 'kn' + s); tone('hip' + s, 'to' + s); } tone('top', 'pel'); }
  // joint limits: nothing folds flat into itself
  L('chest', 'pel', 1, 1, d('chest', 'pel') * 0.82); L('top', 'chest', 1, 1, d('top', 'chest') * 0.85);
  for (const s of ['L', 'R']) { L('sh' + s, 'wr' + s, 1, 1, (d('sh' + s, 'el' + s) + d('el' + s, 'wr' + s)) * 0.3); L('hip' + s, 'an' + s, 1, 1, (d('hip' + s, 'kn' + s) + d('kn' + s, 'an' + s)) * 0.28); }
  // tearing: arms at the shoulder, legs at the hip, the head at the neck
  for (const s of ['L', 'R']) {
    core.cut('arm' + s, ['sh' + s, 'el' + s, 'wr' + s, 'ha' + s].map(n => I[n]), I.chest, I['sh' + s], T.armBreak);
    core.cut('leg' + s, ['hip' + s, 'kn' + s, 'an' + s, 'to' + s].map(n => I[n]), I.pel, I['hip' + s], T.legBreak);
  }
  core.cut('head', [I.neck, I.top], I.chest, I.neck, T.headBreak);
  // hitting something very hard can rip the limb that took the hit
  core.limbOf = RAG_NAMES.map(n => /^(sh|el|wr|ha)L/.test(n) ? 'armL' : /^(sh|el|wr|ha)R/.test(n) ? 'armR' : /^(hip|kn|an|to)L/.test(n) ? 'legL' : /^(hip|kn|an|to)R/.test(n) ? 'legR' : n === 'top' ? 'head' : null);
  core.tearSpeed = T.tearSpeed || 0;
  // bone middles that collide with the cart walls: upper and lower arms and legs, belly, chest, neck
  for (const s of ['L', 'R']) { core.seg(I['sh' + s], I['el' + s], 0.07); core.seg(I['el' + s], I['wr' + s], 0.06); core.seg(I['hip' + s], I['kn' + s], 0.09); core.seg(I['kn' + s], I['an' + s], 0.07); }
  core.seg(I.pel, I.waist, 0.14); core.seg(I.waist, I.chest, 0.15); core.seg(I.chest, I.neck, 0.1); core.seg(I.neck, I.top, 0.12);
  // hinges: knees bend forward only, elbows backward only
  for (const s of ['L', 'R']) { core.hinges.push({ a: I['hip' + s], b: I['kn' + s], c: I['an' + s], dir: 'fwd', min: 0.0 }); core.hinges.push({ a: I['sh' + s], b: I['el' + s], c: I['wr' + s], dir: 'back', min: 0.0 }); }
  // body frame for the hinges: forward is stored relative to the torso axes
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const basis = (up, side) => { const u = nrm(up), s0 = nrm(side), w = nrm(cr(s0, u)), s = cr(u, w); return [s, u, w]; };
  const B0 = basis(sub(rest.chest, rest.pel), sub(rest.shR, rest.shL)), fl = [dot(fwdRest, B0[0]), dot(fwdRest, B0[1]), dot(fwdRest, B0[2])];
  const P = n => { const k = I[n] * 3; return [core.x[k], core.x[k + 1], core.x[k + 2]]; };
  core.frame = () => { const B = basis(sub(P('chest'), P('pel')), sub(P('shR'), P('shL'))), f = nrm([B[0][0] * fl[0] + B[1][0] * fl[1] + B[2][0] * fl[2], B[0][1] * fl[0] + B[1][1] * fl[1] + B[2][1] * fl[2], B[0][2] * fl[0] + B[1][2] * fl[1] + B[2][2] * fl[2]]); return { fwd: f, back: [-f[0], -f[1], -f[2]] }; };
  core.I = I;
  return I;
}
// RAGDOLL-BODY-END


const RAG_TUNE = { armBreak: 1.6, legBreak: 2.0, headBreak: 1.6, grip: 0.3, tearSpeed: 30, tone: 0.02 }; // tuned offline with the same core
// which two points drive each body part, and which two points give its sideways axis
const RAG_PARTS = { pelvis: ['pel', 'waist', 'hipL', 'hipR'], torso: ['waist', 'chest', 'shL', 'shR'], head: ['neck', 'top', 'shL', 'shR'] };
for (const s of ['L', 'R']) Object.assign(RAG_PARTS, { ['upper' + s]: ['sh' + s, 'el' + s, 'shL', 'shR'], ['fore' + s]: ['el' + s, 'wr' + s, 'shL', 'shR'], ['hand' + s]: ['wr' + s, 'ha' + s, 'shL', 'shR'], ['thigh' + s]: ['hip' + s, 'kn' + s, 'hipL', 'hipR'], ['shin' + s]: ['kn' + s, 'an' + s, 'hipL', 'hipR'], ['foot' + s]: ['an' + s, 'to' + s, 'hipL', 'hipR'] });
function ragPoints(world) { // the 21 points, from the rig at rest (model space) or from the posed parts (world)
  const P = {}, piv = (n, o) => world ? byName[n].localToWorld(o.copy(NODE[n].p).sub(byName[n].userData.restPos)) : o.copy(NODE[n].p);
  const cen = (n, o) => world ? byName[n].getWorldPosition(o) : o.copy(byName[n].userData.restPos);
  const a = new V3(), b = new V3(), put = (k, v) => { P[k] = [v.x, v.y, v.z]; };
  put('pel', cen('pelvis', a)); put('waist', piv('torso', a)); put('neck', piv('head', a)); put('top', cen('head', b).multiplyScalar(2).sub(piv('head', a)));
  const sl = piv('upperL', new V3()), sr = piv('upperR', new V3()), w = piv('torso', new V3()), ch = sl.clone().add(sr).multiplyScalar(0.5); ch.lerp(w, 0.2); put('chest', ch);
  for (const s of ['L', 'R']) {
    put('sh' + s, piv('upper' + s, a)); put('el' + s, piv('fore' + s, a)); put('wr' + s, piv('hand' + s, a)); put('ha' + s, cen('hand' + s, b).multiplyScalar(2).sub(piv('hand' + s, a)));
    put('hip' + s, piv('thigh' + s, a)); put('kn' + s, piv('shin' + s, a)); put('an' + s, piv('foot' + s, a)); put('to' + s, cen('foot' + s, b).multiplyScalar(2).sub(piv('foot' + s, a)));
  }
  return P;
}
const _rm0 = new THREE.Matrix4(), _rm1 = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rv = new V3(), _ra = new V3(), _rb = new V3(), _rc = new V3();
function ragBasis(A, B, C, D, out) { // x along the bone, z = bone x side, y completes
  const x = _ra.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]).normalize(), side = _rb.set(D[0] - C[0], D[1] - C[1], D[2] - C[2]).normalize();
  let z = _rc.crossVectors(x, side); if (z.lengthSq() < 1e-6) z.set(0, 0, 1).cross(x); z.normalize(); const y = new V3().crossVectors(z, x);
  return out.makeBasis(x.clone(), y, z.clone());
}
let RAGSIM = null;
function ragStart(vel, impactV) { // turn the posed body into a physics body moving at `vel`
  daggie.updateMatrixWorld(true);
  const now = ragPoints(true), rest = ragPoints(false), core = new RagCore(RAG_NAMES.length);
  const fw = FACE_N ? [FACE_N.x, FACE_N.y, FACE_N.z] : [0, 0, 1];
  core.floor = floorAt; core.box = LABCART.box; core.cyls = LABCART.cyls;
  const I = ragBody(core, rest, now, fw, RAG_TUNE);
  { const half = n => { const bb = byName[n].userData.mesh.geometry.boundingBox, e = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort((a, b) => a - b); return e[1] * 0.5; };
    const src = { pel: 'pelvis', waist: 'torso', chest: 'torso', neck: 'head', top: 'head', shL: 'upperL', elL: 'upperL', wrL: 'foreL', haL: 'handL', shR: 'upperR', elR: 'upperR', wrR: 'foreR', haR: 'handR', hipL: 'thighL', knL: 'thighL', anL: 'shinL', toL: 'footL', hipR: 'thighR', knR: 'thighR', anR: 'shinR', toR: 'footR' };
    for (const n in src) if (byName[src[n]]) core.r[I[n]] = clamp(half(src[n]) * (n === 'chest' || n === 'waist' ? 0.8 : 0.95), 0.05, 0.22); }
  core.initCart();
  core.skipBox = new Uint8Array(core.n);
  // no grip: Daggie doesn't hold on to the cart, he's carried only by the basket walls and his own inertia
  core.settle(); for (let i = 0; i < core.n; i++) core.vel(i, vel.x, vel.y, vel.z, 1 / 240);
  const pk0 = I.pel * 3, seatY = CART.toLocal(core.x[pk0], core.x[pk0 + 1], core.x[pk0 + 2])[1];
  const restB = {}, corr = {}; for (const n in RAG_PARTS) { const q = RAG_PARTS[n]; restB[n] = ragBasis(rest[q[0]], rest[q[1]], rest[q[2]], rest[q[3]], new THREE.Matrix4()); }
  // keep each part's own twist: remember how its real rotation differs from the one rebuilt from the points
  for (const p of parts) { const q = RAG_PARTS[p.name]; if (!q) continue; ragBasis(now[q[0]], now[q[1]], now[q[2]], now[q[3]], _rm1); _rm0.copy(restB[p.name]).transpose(); _rm1.multiply(_rm0); const rec = new THREE.Quaternion().setFromRotationMatrix(_rm1); corr[p.name] = rec.invert().multiply(p.getWorldQuaternion(new THREE.Quaternion())); }
  for (const p of parts) scene.attach(p);
  core.onBreak = g => { const k = I[{ armL: 'shL', armR: 'shR', legL: 'hipL', legR: 'hipR', head: 'neck' }[g]] * 3, pos = new V3(core.x[k], core.x[k + 1], core.x[k + 2]);
    for (let i = 0; i < 16; i++) spawnDrop(pos.clone(), new V3(rand(-2, 2), rand(0.5, 3), rand(-2, 2)), rand(0.012, 0.024)); burst(pos, 50, SPARK, 8); clank(10); tone(1500, 300, 0.25, 'sawtooth', 0.06);
    lastPop = 0; pop({ armL: 'ARM OFF!', armR: 'ARM OFF!', legL: 'LEG OFF!', legR: 'LEG OFF!', head: 'HEADLESS!' }[g], 'lilac'); setFace('hit', 1500); };
  core.onRelease = () => { lastPop = 0; pop('LET GO!', 'lilac'); setFace('scared', 1500); };
  RAGSIM = { core, I, rest, restB, corr, t: 0, seatY };
}
function ragSimStep(dt) {
  const S = RAGSIM; if (!S) return; S.t += dt;
  // fixed 1/240 s physics steps (the grip and tearing limits were tuned at this rate), also in slow motion
  S.acc = (S.acc || 0) + dt; let n = 0;
  S.core.relax = true; S.core.capUp = CART.knocked ? (S.t < 0.3 ? 3 : 7) : 3; // soft joint limits and a cap on upward kicks (m/s): he lunges forward and is thrown ahead, he is not catapulted up; tested offline
  while (S.acc >= 1 / 240 && n < 12) { labCartStep(1 / 240); S.core.step(1 / 240, 10); S.acc -= 1 / 240; n++; }
  if (LAB.bollardTip && BOLLARD) { LAB.bollardTip = Math.min(1, LAB.bollardTip + dt * 5); bollardFall(1 - Math.pow(1 - LAB.bollardTip, 3)); }
  if (n === 12) S.acc = 0;
  ragApply();
}
function ragApply() { // move every mesh part to where its points are
  const S = RAGSIM, c = S.core, P = n => { const k = S.I[n] * 3; return [c.x[k], c.x[k + 1], c.x[k + 2]]; };
  for (const p of parts) {
    const q = RAG_PARTS[p.name]; if (!q) continue;
    ragBasis(P(q[0]), P(q[1]), P(q[2]), P(q[3]), _rm1);
    _rm0.copy(S.restB[p.name]).transpose(); _rm1.multiply(_rm0); _rq.setFromRotationMatrix(_rm1); if (S.corr[p.name]) _rq.multiply(S.corr[p.name]);
    p.quaternion.copy(_rq);
    const a = P(q[0]); _rv.copy(p.userData.restPos).sub(new V3(...S.rest[q[0]])).applyQuaternion(_rq); p.position.set(a[0] + _rv.x, a[1] + _rv.y, a[2] + _rv.z);
  }
}
// ---- the test cart: the tested rigid-body cart from the physics core, drawn with the player's cart mesh ----
const LAB_LANE = 0, BOLLARD_Z = -8, BOLLARD_R = 0.16, BOLLARD_H = 1.1;
let BOLLARD = null;
// the post snaps just above its concrete base and falls forward, the way the cart was going (-z), turned a little by an off-centre hit
function bollardFall(e) { if (!BOLLARD) return; BOLLARD.rotation.set(-1.35 * e, (LAB.tipYaw || 0) * e, 0); }
const CART = new CartSim(CART_S, LAB_LANE, BOLLARD_Z, BOLLARD_R);
CART.onHit = (corner, v) => { labDentAt(corner[0] / CART_S, corner[1] / CART_S, v); clank(Math.min(12, v)); };
function labDentAt(y, z, v) { // crush the wires around a corner that slammed into the floor, toward the middle of the basket
  const cage = board.getObjectByName('cage'); if (!cage) return;
  const pos = cage.geometry.attributes.position, a = pos.array, depth = clamp(v / 40, 0.02, 0.12), R = 0.22;
  for (let i = 0; i < a.length; i += 3) {
    const dy = a[i + 1] - y, dz = a[i + 2] - z, d = Math.hypot(dy, dz); if (d > R) continue;
    const k = (1 - d / R) ** 2; a[i + 1] += Math.sign(0.71 - a[i + 1]) * depth * k * 0.5; a[i + 2] += Math.sign(0.05 - a[i + 2]) * depth * k * 0.5; a[i] *= 1 + depth * 0.25 * k;
  }
  pos.needsUpdate = true; cage.geometry.computeVertexNormals();
}
const LABCART = { get box() { return CART.box; }, get cyls() { return CART.cyls; }, v: 0, hit: false };
function labCartPlace() { const w = CART.toWorld(0, 0, 0); board.position.set(w[0], w[1], w[2]); board.rotation.set(-CART.a, 0, 0); }
function labCartStep(dt) { if (LABCART.hit) CART.step(dt); labCartPlace(); }
function labDent(v) { // crumple the front of the basket: deeper, wider and higher the faster it hit
  const cage = board.getObjectByName('cage'); if (!cage) return;
  const pos = cage.geometry.attributes.position, a = pos.array, depth = clamp(v / 40, 0.05, 0.3), R = 0.16 + Math.min(0.3, v / 60);
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i], y = a[i + 1], z = a[i + 2]; if (z > -0.1) continue;
    const fx = Math.max(0, 1 - Math.abs(x) / R), fz = clamp((-z - 0.1) / 0.37, 0, 1), k = fx * fx * (3 - 2 * fx) * fz;
    if (k <= 0) continue; const fy = clamp((y - 0.05) / 1.0, 0, 1);
    a[i + 2] = z + depth * k * (0.6 + 0.4 * fy); a[i + 1] = y - depth * 0.3 * k * fy; a[i] = x * (1 + depth * 0.45 * k);
  }
  pos.needsUpdate = true; cage.geometry.computeVertexNormals(); cage.geometry.computeBoundingSphere();
  const plate = board.getObjectByName('plate'); if (plate) { plate.position.z += depth * 0.85; plate.position.y -= depth * 0.2; plate.rotation.set(-depth * 0.8, Math.PI, depth * rand(-0.6, 0.6)); if (v > 30) plate.visible = false; }
  if (v > 20) for (const w of wheels.slice(0, 2)) { w.visible = false; burst(w.getWorldPosition(new V3()), 20, SPARK, 6); }
  return depth;
}
function labCartReset() {
  const cage = board.getObjectByName('cage'); if (cage && cage.geometry.userData.orig) { cage.geometry.attributes.position.array.set(cage.geometry.userData.orig); cage.geometry.attributes.position.needsUpdate = true; cage.geometry.computeVertexNormals(); }
  for (const w of wheels) w.visible = true; { const plate = board.getObjectByName('plate'); if (plate && plate.userData.home) { plate.position.copy(plate.userData.home); plate.rotation.set(0, Math.PI, 0); plate.visible = true; } }
  CART.box.zf = -0.45 * CART_S; LABCART.hit = false; CART.place(BOLLARD_Z + BOLLARD_R + 14); CART.vz = 0; labCartPlace();
  bollardFall(0); LAB.bollardTip = 0;
}
function labImpact() {
  const v = LABCART.v; LABCART.hit = true; CART.impact(v);
  const dd = labDent(v); CART.box.zf = -0.45 * CART_S + dd * CART_S * 0.75; // the crumpled front wires are a wall further back now
  ragStart(new V3(0, 0, -v), v);
  if (CART.knocked) { LAB.bollardTip = 0.001; LAB.tipYaw = rand(-0.25, 0.25); lastPop = 0; pop('POST SNAPPED!', 'lilac'); }
  const bp = new V3(LAB_LANE, 0.8, BOLLARD_Z); burst(bp, 60 + v * 2, SPARK, 6 + v * 0.1); clank(12); tone(90, 30, 0.4, 'sine', 0.4); tone(1600, 400, 0.3, 'sawtooth', 0.05);
  if (!reduceMotion) shake = Math.min(0.9, 0.2 + v * 0.012);
  slowUntil = performance.now() + 1200; slowK = 0.3; setFace('hit', 99999); if (!CART.knocked) { lastPop = 0; pop(Math.round(v / 0.447) + ' MPH!', 'lilac'); }
}
function labBollardOutcome() {
  const S = RAGSIM, c = S.core, torn = c.broken.length, inCart = c.inCart[S.I.pel], held = c.pins.some(p => p.on);
  const txt = inCart ? (S.maxY - S.seatY > 0.3 ? 'almost flew out' : 'stayed in the cart') : held ? 'flew out but held on' : 'was thrown out';
  LAB.lost = torn; return txt + (torn ? ', ' + torn + ' limb' + (torn > 1 ? 's' : '') + ' torn off' : '');
}

// =====================================================================
// DELIVERY: Daggie is a courier. A pizza rides in his "DAGGIE EATS" backpack; every hard hit throws slices out.
// At the finish Penny (a pink Daggie) opens her door, opens the box and rates the delivery.
// =====================================================================
const DLV = L.delivery ? Object.assign({ item: 'pizza', slices: 8, time: 45, tip: 20 }, L.delivery) : null;
const DOOR_S = Math.min(LAND1 - 25, LAND0 + 55); // close after the finale, but past the longest normal jump
const D = { left: 8, t: 0, tip: 20, phase: 'go', lost: 0, lidT: 0, doorT: 0, revealT: 0, stars: 0, hud: null };
// ---- pizza slice: a real wedge (tip at the origin, crust toward +z) ----
const pizzaTop = tex(256, 256, (g, w, h) => {
  g.fillStyle = '#f2c14e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { g.fillStyle = pick(['rgba(255,236,160,.7)', 'rgba(222,160,50,.5)', 'rgba(255,250,210,.6)']); g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(4, 14), rand(3, 9), rand(0, 3), 0, TAU); g.fill(); }
  for (let i = 0; i < 9; i++) { const x = rand(20, w - 20), y = rand(20, h - 20); g.fillStyle = '#b3261e'; g.beginPath(); g.arc(x, y, rand(12, 17), 0, TAU); g.fill(); g.fillStyle = 'rgba(80,10,10,.35)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + rand(-6, 6), y + rand(-6, 6), 2, 0, TAU); g.fill(); } }
  for (let i = 0; i < 25; i++) { g.fillStyle = '#3f6e2a'; g.fillRect(rand(0, w), rand(0, h), 5, 3); }
});
const SLICE_R = 0.2, SLICE_GEO = new THREE.CylinderGeometry(SLICE_R, SLICE_R, 0.028, 10, 1, false, -Math.PI / 8, Math.PI / 4);
const SLICE_MATS = [new THREE.MeshStandardMaterial({ color: 0xd08a3c, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: pizzaTop, roughness: 0.75 }), new THREE.MeshStandardMaterial({ color: 0xe8b26a, roughness: 0.9 })];
function sliceMesh() { const m = new THREE.Mesh(SLICE_GEO, SLICE_MATS); m.castShadow = true; return m; }
// flying slices: 3 points each (tip, crust left, crust right) on the tested physics core
const SLC = { core: null, meshes: [], restB: null, on: [] };
if (DLV) {
  const n = DLV.slices; SLC.core = new RagCore(n * 3); SLC.core.floor = floorAt; SLC.core.friction = 0.5;
  const tipR = [0, 0, 0], cl = [Math.sin(-Math.PI / 8) * SLICE_R, 0, Math.cos(-Math.PI / 8) * SLICE_R], cr = [Math.sin(Math.PI / 8) * SLICE_R, 0, Math.cos(Math.PI / 8) * SLICE_R];
  const mid = [(cl[0] + cr[0]) / 2, 0, (cl[2] + cr[2]) / 2];
  SLC.restB = ragBasis(tipR, mid, cl, cr, new THREE.Matrix4());
  for (let i = 0; i < n; i++) {
    const a = i * 3; SLC.core.set(a, 0, -50, 0); SLC.core.set(a + 1, cl[0], -50, cl[2]); SLC.core.set(a + 2, cr[0], -50, cr[2]);
    for (let k = 0; k < 3; k++) { SLC.core.r[a + k] = 0.018; SLC.core.inv[a + k] = 0; }
    SLC.core.link(a, a + 1); SLC.core.link(a, a + 2); SLC.core.link(a + 1, a + 2);
    const m = sliceMesh(); m.visible = false; scene.add(m); SLC.meshes.push(m); SLC.on.push(false);
  }
}
// ---- the DAGGIE EATS backpack, strapped to his back (moves with his torso, also when he crashes) ----
let BAG = null, BAG_LID = null;
if (DLV) {
  const fn = FACE_N ? FACE_N.clone().normalize() : new V3(0, 0, 1), back = fn.clone().negate();
  const bb = torso.userData.mesh.geometry.boundingBox, e = new V3().subVectors(bb.max, bb.min), hd = Math.abs(fn.x) * e.x / 2 + Math.abs(fn.y) * e.y / 2 + Math.abs(fn.z) * e.z / 2;
  BAG = new THREE.Group(); torso.add(BAG);
  BAG.position.copy(back).multiplyScalar(hd + 0.17).add(new V3(0, 0.06, 0)); BAG.quaternion.setFromUnitVectors(new V3(0, 0, 1), back);
  const red = new THREE.MeshPhysicalMaterial({ color: 0xd9281f, roughness: 0.55, clearcoat: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x1c1a20, roughness: 0.8 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.5, 0.3, 3, 0.05), red); box.castShadow = true; BAG.add(box);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshStandardMaterial({ map: tex(512, 350, (g, w, h) => { g.fillStyle = '#d9281f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffc21a'; g.beginPath(); g.moveTo(w / 2, 40); g.lineTo(w / 2 - 70, 170); g.lineTo(w / 2 + 70, 170); g.closePath(); g.fill(); g.fillStyle = '#b3261e'; for (const [x, y] of [[0, 100], [-20, 140], [22, 135]]) { g.beginPath(); g.arc(w / 2 + x, y, 11, 0, TAU); g.fill(); } g.fillStyle = '#fff'; g.font = '700 64px ' + FONT; g.textAlign = 'center'; g.fillText('DAGGIE', w / 2, 240); g.font = '700 54px ' + FONT; g.fillText('EATS', w / 2, 300); }), roughness: 0.6 }));
  logo.position.z = 0.152; BAG.add(logo);
  for (const sd of [-1, 1]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.04), dark); strap.position.set(sd * 0.16, 0, -0.17); BAG.add(strap); }
  BAG_LID = new THREE.Group(); BAG_LID.position.set(0, 0.25, -0.15); BAG.add(BAG_LID);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.05, 0.32, 2, 0.02), red); lid.position.set(0, 0.02, 0.15); lid.castShadow = true; BAG_LID.add(lid);
  BAG.visible = true;
}
// ---- Penny: Daggie's model, repainted pink, with a bow, pigtails, a tutu and her own LED face ----
let PEN = null;
function pinkTexture() {
  const img = bodyTex.image; if (!img) return null;
  const w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0); const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    let hue = 0; if (mx !== mn) { if (mx === r) hue = ((gg - b) / (mx - mn)) % 6; else if (mx === gg) hue = (b - r) / (mx - mn) + 2; else hue = (r - gg) / (mx - mn) + 4; hue *= 60; if (hue < 0) hue += 360; }
    if (s > 0.3 && hue > 25 && hue < 80) { // yellow paint -> pink paint
      const k = l; d[i] = Math.min(255, 255 * (0.98 * k + 0.35)); d[i + 1] = Math.min(255, 255 * (0.42 * k + 0.12)); d[i + 2] = Math.min(255, 255 * (0.66 * k + 0.2));
    } else if (l < 0.22) { d[i] = d[i] * 0.6 + 46; d[i + 1] = d[i + 1] * 0.5 + 14; d[i + 2] = d[i + 2] * 0.6 + 40; } // black -> deep plum
  }
  g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(cv); t.flipY = bodyTex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const penCv = document.createElement('canvas'); penCv.width = 320; penCv.height = 220;
const penTex = new THREE.CanvasTexture(penCv); penTex.colorSpace = THREE.SRGBColorSpace; let penMood = 'idle', penKey = '';
function heart(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.35); g.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); g.closePath(); }
function drawPenny(now) {
  const blink = penMood === 'idle' && (now % 3000) < 140, key = penMood + blink + (penMood === 'cry' ? Math.floor(now / 200) % 4 : 0); if (key === penKey) return; penKey = key;
  const g = penCv.getContext('2d'), W = 320, H = 220, Lx = 108, Rx = 212, EY = 98;
  const bg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6); bg.addColorStop(0, '#1a0512'); bg.addColorStop(1, '#070105'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.shadowColor = '#ff5fb0'; g.shadowBlur = 22; const ink = '#ff9ad5'; g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 10; g.lineCap = 'round';
  const lashes = (x) => { g.beginPath(); for (const a of [-0.6, 0, 0.6]) { g.moveTo(x + Math.sin(a) * 34, EY - 36); g.lineTo(x + Math.sin(a) * 46, EY - 52); } g.stroke(); };
  if (penMood === 'idle' || penMood === 'love') { for (const x of [Lx, Rx]) { if (blink) g.fillRect(x - 28, EY - 4, 56, 9); else { heart(g, x, EY, 34); g.fill(); lashes(x); } } g.beginPath(); g.arc(160, 146, 26, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
  else if (penMood === 'happy') { for (const x of [Lx, Rx]) { g.beginPath(); g.arc(x, EY + 14, 28, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); lashes(x); } g.beginPath(); g.arc(160, 130, 42, 0.15 * Math.PI, 0.85 * Math.PI); g.fill(); g.fillStyle = '#ff5f9e'; for (const [x, y] of [[40, 50], [282, 60], [60, 180]]) { heart(g, x, y, 14); g.fill(); } }
  else if (penMood === 'meh') { for (const x of [Lx, Rx]) { g.fillRect(x - 30, EY - 2, 60, 10); lashes(x); } g.beginPath(); g.moveTo(130, 160); g.lineTo(190, 156); g.stroke(); }
  else if (penMood === 'angry') { g.shadowColor = '#ff2a4a'; g.fillStyle = g.strokeStyle = '#ff5a6a'; for (const [x, sd] of [[Lx, 1], [Rx, -1]]) { g.beginPath(); g.ellipse(x, EY + 8, 26, 22, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - 36 * sd, EY - 44); g.lineTo(x + 30 * sd, EY - 22); g.stroke(); } g.beginPath(); g.arc(160, 182, 30, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
  else if (penMood === 'cry') { const f = Math.floor(now / 200) % 4; for (const x of [Lx, Rx]) { g.beginPath(); g.arc(x, EY - 6, 26, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); g.fillStyle = '#7fd4ff'; g.shadowColor = '#7fd4ff'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + 20, EY + 26 + ((k * 30 + f * 10) % 90), 6, 10, 0, 0, TAU); g.fill(); } g.fillStyle = ink; g.shadowColor = '#ff5fb0'; } g.beginPath(); g.arc(160, 186, 28, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
  g.fillStyle = 'rgba(255,90,160,0.35)'; g.beginPath(); g.ellipse(58, 150, 26, 14, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(262, 150, 26, 14, 0, 0, TAU); g.fill();
  g.restore(); g.fillStyle = 'rgba(4,0,3,0.7)'; for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 2, H); for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  penTex.needsUpdate = true;
}
function buildPenny() {
  const pinkTex = pinkTexture(), pinkMat = bodyMat.clone(); if (pinkTex) pinkMat.map = pinkTex; else pinkMat.color.set(0xff8cc6);
  const faceM = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: penTex, emissiveIntensity: 3, roughness: 0.1, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const nameM = new THREE.MeshPhysicalMaterial({ map: tex(512, 150, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ff5fb0'; g.font = '700 100px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PENNY', w / 2, h / 2 + 6); }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const root = new THREE.Group(), piv = {};
  for (const [n, par] of RIG) {
    const pg = new THREE.Group(), P0 = NODE[n].p; pg.position.copy(par ? P0.clone().sub(NODE[par].p) : P0); (par ? piv[par] : root).add(pg); piv[n] = pg;
    const g = new THREE.Group(); g.position.copy(byName[n].userData.restPos).sub(P0); pg.add(g);
    for (const ch of byName[n].children) { const c = ch.clone(); c.traverse(o => { if (o.isMesh) { o.material = o.material === bodyMat ? pinkMat : o.material === faceMat ? faceM : o.material === idMat ? nameM : o.material; o.castShadow = true; } }); g.add(c); }
  }
  // accessories, placed from the real head / pelvis sizes
  const hot = new THREE.MeshPhysicalMaterial({ color: 0xff3d8b, roughness: 0.35, clearcoat: 1 }), soft = new THREE.MeshPhysicalMaterial({ color: 0xffc2e0, roughness: 0.6, side: THREE.DoubleSide });
  const hb = byName.head.userData.mesh.geometry.boundingBox, hc = byName.head.userData.restPos.clone().sub(NODE.head.p), he = new V3().subVectors(hb.max, hb.min);
  const fn = FACE_N ? FACE_N.clone().normalize() : new V3(0, 0, 1), side = new V3(1, 0, 0);
  const bow = new THREE.Group(); bow.position.copy(hc).add(new V3(0, he.y * 0.5, 0)).addScaledVector(side, he.x * 0.18).addScaledVector(fn, -he.z * 0.05);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 16), hot); w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.09; w.scale.set(1, 1, 0.55); bow.add(w); }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), hot); bow.add(knot); bow.rotation.z = -0.3; piv.head.add(bow);
  for (const s of [-1, 1]) { const tail = new THREE.Group(); tail.position.copy(hc).addScaledVector(side, s * (he.x * 0.5 + 0.02)).add(new V3(0, he.y * 0.05, 0)).addScaledVector(fn, -he.z * 0.15);
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), hot); tail.add(tie); const hair = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.06, 0.16, 6, 12) : new THREE.SphereGeometry(0.08, 12, 10), new THREE.MeshPhysicalMaterial({ color: 0xff78b8, roughness: 0.4, clearcoat: 0.6 })); hair.position.set(s * 0.05, -0.1, 0); hair.rotation.z = s * 0.4; tail.add(hair); piv.head.add(tail); }
  const pb = byName.pelvis.userData.mesh.geometry.boundingBox, pe = new V3().subVectors(pb.max, pb.min), pc = byName.pelvis.userData.restPos.clone().sub(NODE.pelvis.p);
  const rTop = Math.max(pe.x, pe.z) * 0.58, tutu = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop * 1.75, 0.2, 28, 1, true), soft); tutu.position.copy(pc).add(new V3(0, -pe.y * 0.05, 0)); tutu.castShadow = true; piv.pelvis.add(tutu);
  const ruff = new THREE.Mesh(new THREE.TorusGeometry(rTop * 1.75, 0.018, 6, 40), hot); ruff.rotation.x = Math.PI / 2; ruff.position.copy(tutu.position).add(new V3(0, -0.1, 0)); piv.pelvis.add(ruff);
  root.scale.setScalar(0.88); scene.add(root);
  PEN = { root, piv, t: 0, mood: 'idle' };
}
// ---- her front door at the end of the track ----
let DOOR = null, BOXSHOW = null;
function buildDoor() {
  const g = new THREE.Group(); g.position.set(0, trackH(DOOR_S) ?? 0, -DOOR_S); scene.add(g);
  const brickT = tex(512, 512, (gg, w, h) => { gg.fillStyle = '#8a6f74'; gg.fillRect(0, 0, w, h); const bh = 32, bw = 96;
    for (let y = 0; y < h; y += bh) for (let x = -((y / bh) % 2) * bw / 2; x < w; x += bw) { const c = 150 + Math.random() * 40; gg.fillStyle = `rgb(${c + 30},${c * 0.62},${c * 0.72})`; gg.fillRect(x + 3, y + 3, bw - 6, bh - 6); gg.fillStyle = 'rgba(0,0,0,0.08)'; gg.fillRect(x + 3, y + bh - 9, bw - 6, 6); } });
  brickT.wrapS = brickT.wrapT = THREE.RepeatWrapping; brickT.repeat.set(3, 2.2);
  const brick = new THREE.MeshStandardMaterial({ map: brickT, roughness: 0.92, color: 0xd8d0d4 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd9d2cc, roughness: 0.7 });
  const woodT = tex(256, 512, (gg, w, h) => { gg.fillStyle = '#c24f86'; gg.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { gg.strokeStyle = `rgba(90,20,50,${0.06 + Math.random() * 0.08})`; gg.lineWidth = 2; gg.beginPath(); const x = Math.random() * w; gg.moveTo(x, 0); gg.bezierCurveTo(x + 8, h / 3, x - 8, h * 2 / 3, x + 4, h); gg.stroke(); } gg.strokeStyle = 'rgba(60,10,35,0.35)'; gg.lineWidth = 6; gg.strokeRect(30, 40, w - 60, h * 0.38); gg.strokeRect(30, h * 0.52, w - 60, h * 0.4); });
  const pinkD = new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.6 });
  for (const [x, w] of [[-2.25, 2.5], [2.25, 2.5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, 0.35), brick); m.position.set(x, 2.1, -0.17); m.receiveShadow = m.castShadow = true; g.add(m); }
  const lin = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 0.35), brick); lin.position.set(0, 3.3, -0.17); lin.castShadow = true; g.add(lin);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 4), brick); sideL.position.set(-3.33, 2.1, -2.15); g.add(sideL); const sideR = sideL.clone(); sideR.position.x = 3.33; g.add(sideR);
  const roofT = tex(256, 256, (gg, w, h) => { gg.fillStyle = '#4a3a44'; gg.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = -((y / 32) % 2) * 24; x < w; x += 48) { gg.fillStyle = `hsl(335,22%,${24 + Math.random() * 10}%)`; gg.beginPath(); gg.moveTo(x, y); gg.lineTo(x + 46, y); gg.lineTo(x + 46, y + 22); gg.quadraticCurveTo(x + 23, y + 34, x, y + 22); gg.fill(); } });
  roofT.wrapS = roofT.wrapT = THREE.RepeatWrapping; roofT.repeat.set(4, 2);
  const roofM = new THREE.MeshStandardMaterial({ map: roofT, roughness: 0.85 });
  for (const sd of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.14, 2.9), roofM); r.position.set(0, 4.95, -2.15 + sd * 1.25); r.rotation.x = sd * 0.62; r.castShadow = true; g.add(r); }
  const gable = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.3, 7, 3, 1), brick); gable.rotation.set(0, 0, Math.PI / 2); gable.position.set(0, 4.55, -2.15); gable.scale.set(1, 1, 0.55); g.add(gable);
  for (const x of [-1.02, 1.02]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.55, 0.42), trim); f.position.set(x, 1.27, -0.1); f.castShadow = true; g.add(f); } const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.42), trim); top.position.set(0, 2.5, -0.1); g.add(top);
  const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.9), trim); step.position.set(0, 0.08, 0.35); step.receiveShadow = true; g.add(step);
  const hinge = new THREE.Group(); hinge.position.set(-0.95, 0.16, -0.05); g.add(hinge);
  const door = new THREE.Mesh(new RoundedBoxGeometry(1.9, 2.3, 0.08, 2, 0.02), pinkD); door.position.set(0.95, 1.15, 0); door.castShadow = true; hinge.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 1, roughness: 0.25 })); knob.position.set(1.72, 1.1, 0.07); hinge.add(knob);
  const hrt = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.31), new THREE.MeshStandardMaterial({ map: tex(128, 116, (gg, w, h) => { gg.clearRect(0, 0, w, h); gg.fillStyle = '#f7e6ee'; heart(gg, w / 2, h / 2 + 4, 34); gg.fill(); }), transparent: true, roughness: 0.6 })); hrt.position.set(0.95, 1.85, 0.045); hinge.add(hrt);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.3), new THREE.MeshStandardMaterial({ color: 0x2a1b24, roughness: 1 })); inside.position.set(0, 1.3, -0.33); g.add(inside);
  for (const x of [-2.25, 2.25]) { // windows with frames, glass and a flower box
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.1, 0.12), trim); fr.position.set(x, 2.3, 0.03); g.add(fr);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.9), new THREE.MeshPhysicalMaterial({ color: 0x33485a, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.2 })); gl.position.set(x, 2.3, 0.1); g.add(gl);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.03), trim); bar.position.set(x, 2.3, 0.12); g.add(bar); const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.03), trim); bar2.position.set(x, 2.3, 0.12); g.add(bar2);
    const bx = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.25), new THREE.MeshStandardMaterial({ color: 0x7a4b35, roughness: 0.8 })); bx.position.set(x, 1.68, 0.18); g.add(bx);
    for (let i = 0; i < 6; i++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: pick([0xff5fa2, 0xffd1e6, 0xff8a3d]), roughness: 0.6 })); fl.position.set(x - 0.45 + i * 0.18, 1.83, 0.18); g.add(fl); }
  }
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshStandardMaterial({ map: tex(512, 290, (gg, w, h) => { gg.fillStyle = '#b8577f'; gg.fillRect(0, 0, w, h); gg.strokeStyle = '#f2dbe5'; gg.lineWidth = 12; gg.strokeRect(14, 14, w - 28, h - 28); gg.fillStyle = '#f2dbe5'; gg.font = '700 110px ' + FONT; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('HOME', w / 2, h / 2 + 6); }), roughness: 0.95 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.012, 1.25); g.add(mat);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshStandardMaterial({ map: tex(256, 154, (gg, w, h) => { gg.fillStyle = '#2b2a30'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#e9d6a0'; gg.font = '700 110px ' + FONT; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('47', w / 2, h / 2 + 6); }), roughness: 0.5 })); num.position.set(1.4, 2.75, 0.02); g.add(num);
  const lampB = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x2b2a30, metalness: 0.6, roughness: 0.4 })); lampB.position.set(-1.45, 2.6, 0.1); g.add(lampB);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: glowColor(0xffd9a0, 1.6) })); lamp.position.set(-1.45, 2.52, 0.12); g.add(lamp);
  // the pizza box she opens: a real open box with the slices that are left inside
  const bx = new THREE.Group(); bx.visible = false; g.add(bx);
  const card = new THREE.MeshStandardMaterial({ color: 0xe9d3a8, roughness: 0.9 }), prt = new THREE.MeshStandardMaterial({ map: tex(256, 256, (gg, w, h) => { gg.fillStyle = '#e9d3a8'; gg.fillRect(0, 0, w, h); gg.strokeStyle = '#d9281f'; gg.lineWidth = 10; gg.beginPath(); gg.arc(w / 2, h / 2, 90, 0, TAU); gg.stroke(); gg.fillStyle = '#d9281f'; gg.font = '700 40px ' + FONT; gg.textAlign = 'center'; gg.fillText('DAGGIE', w / 2, h / 2 - 6); gg.fillText('EATS', w / 2, h / 2 + 38); }), roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.48), card); base.position.y = 0.03; bx.add(base);
  const lidH = new THREE.Group(); lidH.position.set(0, 0.06, -0.24); bx.add(lidH); const lidM = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.012, 0.48), [card, card, prt, card, card, card]); lidM.position.set(0, 0, 0.24); lidH.add(lidM);
  const inBox = []; for (let i = 0; i < (DLV ? DLV.slices : 8); i++) { const m = sliceMesh(); m.scale.setScalar(1.05); m.rotation.y = i / (DLV ? DLV.slices : 8) * TAU; m.position.y = 0.07; bx.add(m); inBox.push(m); }
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); stand.position.y = -0.45; bx.add(stand);
  bx.position.set(0.95, 0.9 + 0.16, 1.35);
  DOOR = { g, hinge }; BOXSHOW = { g: bx, lid: lidH, inBox };
}
// ---- on-screen counter ----
function buildDlvHud() {
  const css = document.createElement('style');
  css.textContent = `.dlvon .meters{display:none!important}
.dlvon .hook{top:30%!important}
.dlvhud{position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 36px);width:max-content;white-space:nowrap;background:rgba(11,7,32,.62);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:5px 12px 6px;z-index:6;display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;font-family:"Chakra Petch",ui-sans-serif,sans-serif}
.recmode.playing .dlvhud,.recmode.filming .dlvhud{top:calc(env(safe-area-inset-top,0px) + 12px)}
.dlvhud .sl{font-size:22px;letter-spacing:0;white-space:nowrap;filter:drop-shadow(0 2px 0 #16112a)}
.dlvhud .sl i{font-style:normal;transition:opacity .25s,filter .25s}
.dlvhud .sl i.gone{opacity:.25;filter:grayscale(1)}
.dlvhud .row{display:flex;gap:8px}
.dlvhud .row b{color:#fff;font-size:17px;padding:0 4px}
.dlvhud .row b.warn{color:#ff5a6a}
.dlvcard{position:absolute;left:50%;top:26%;transform:translateX(-50%);z-index:8;width:min(86%,400px);background:rgba(20,12,48,.9);border:3px solid #ff78b8;border-radius:18px;padding:12px 16px;text-align:center;color:#fff;font-family:"Chakra Petch",ui-sans-serif,sans-serif;pointer-events:none;animation:rev 5s ease-out forwards}
.dlvcard .st{font-size:36px;letter-spacing:2px}
.dlvcard b{display:block;font-size:22px;color:#ffc2e0}
.dlvcard small{display:block;font-size:16px;margin-top:4px;color:#fff}`;
  document.head.appendChild(css);
  stage.classList.add('dlvon');
  const h = document.createElement('div'); h.className = 'dlvhud'; h.innerHTML = '<div class="sl" id="dlvSl"></div><div class="row"><b id="dlvT">0:45</b><b id="dlvTip">$20</b></div>'; stage.appendChild(h);
  const sl = $('dlvSl'); for (let i = 0; i < DLV.slices; i++) { const e = document.createElement('i'); e.textContent = '🍕'; sl.appendChild(e); }
  D.hud = h;
}
function dlvHud() {
  if (!DLV || !D.hud) return;
  const sl = $('dlvSl').children; for (let i = 0; i < sl.length; i++) sl[i].classList.toggle('gone', i >= D.left);
  const rem = DLV.time - D.t, s = Math.max(0, Math.ceil(rem)), txt = (rem < 0 ? '+' : '') + Math.floor(Math.abs(Math.ceil(rem)) / 60) + ':' + String(Math.abs(Math.ceil(rem)) % 60).padStart(2, '0');
  $('dlvT').textContent = '⏱ ' + (rem < 0 ? txt : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')); $('dlvT').classList.toggle('warn', rem < 10);
  $('dlvTip').textContent = '💰 $' + Math.max(0, Math.round(D.tip));
}
// ---- losing slices ----
function dlvLose(k, why) {
  if (!DLV || D.left <= 0) return;
  const top = BAG.localToWorld(new V3(0, 0.3, 0)), vz = (state === 'ride' || state === 'passed') ? -R.speed : 0;
  for (let n = 0; n < k && D.left > 0; n++) {
    D.left--; D.lost++; D.tip -= 2; const i = D.left, c = SLC.core, a = i * 3;
    const vx = rand(-2.5, 2.5), vy = rand(2.5, 5), vzz = vz * rand(0.55, 0.85) + rand(1, 3), spin = rand(-0.03, 0.03);
    const base = [top.x + rand(-0.1, 0.1), top.y + 0.05, top.z + rand(-0.05, 0.05)];
    c.set(a, base[0], base[1], base[2]); c.set(a + 1, base[0] - 0.08, base[1] + 0.02, base[2] + 0.18); c.set(a + 2, base[0] + 0.08, base[1] - 0.02, base[2] + 0.18);
    for (let q = 0; q < 3; q++) { c.inv[a + q] = 1; c.vel(a + q, vx + (q === 1 ? spin * 60 : 0), vy + (q === 2 ? spin * 40 : 0), vzz, 1 / 240); }
    SLC.on[i] = true; SLC.meshes[i].visible = true;
  }
  D.lidT = 0.5; lastPop = 0; pop(k > 1 ? '-' + k + ' SLICES!' : '-1 SLICE!', 'lilac'); tone(700, 300, 0.15, 'square', 0.04);
  dlvHud();
}
function dlvStep(dt, now) {
  if (!DLV) return;
  if (state === 'ride') { D.t += dt; if (D.t > DLV.time) D.tip -= dt; }
  // slice physics (fixed small steps), mesh follows its three points
  const c = SLC.core; let any = false; for (const o of SLC.on) if (o) { any = true; break; }
  if (any) { const n = Math.min(8, Math.max(1, Math.ceil(dt * 240))); for (let k = 0; k < n; k++) c.step(dt / n, 4);
    SLC.on.forEach((o, i) => { if (!o) return; const a = i * 3, P = q => [c.x[(a + q) * 3], c.x[(a + q) * 3 + 1], c.x[(a + q) * 3 + 2]], A = P(0), B = P(1), C = P(2), M = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2, (B[2] + C[2]) / 2];
      ragBasis(A, M, B, C, _rm1); _rm0.copy(SLC.restB).transpose(); _rm1.multiply(_rm0); SLC.meshes[i].quaternion.setFromRotationMatrix(_rm1); SLC.meshes[i].position.set(A[0], A[1], A[2]); }); }
  if (BAG_LID) { D.lidT = Math.max(0, D.lidT - dt); BAG_LID.rotation.x = -Math.min(1, D.lidT * 4) * 1.4; }
  // the finish: roll up to her door, she opens, looks in the box, rates it
  if (D.phase === 'door') {
    D.doorT += dt; const k = clamp(D.doorT / 0.8, 0, 1); DOOR.hinge.rotation.y = -1.7 * (1 - Math.pow(1 - k, 3));
    if (PEN) { const s = clamp((D.doorT - 0.5) / 1.5, 0, 1); PEN.walk = s > 0 && s < 1; PEN.z = -DOOR_S + 0.1 + 1.0 * s; PEN.root.visible = s > 0; }
    if (D.doorT > 2.2) { D.phase = 'hand'; D.handT = 0; BOXSHOW.g.visible = true; BOXSHOW.inBox.forEach((m, i) => { m.visible = i < D.left; }); BOXSHOW.lid.rotation.x = 0; penMood = 'love'; D.lidT = 0.8; tone(500, 900, 0.18, 'triangle', 0.05); }
  } else if (D.phase === 'hand') {
    // the pizza box leaves his backpack and lands on the stand in front of her
    D.handT += dt; const u = clamp(D.handT / 0.75, 0, 1), from = BAG.localToWorld(new V3(0, 0.3, 0)), to = BOXSHOW.g.parent.localToWorld(new V3(0.95, 1.06, 1.35));
    const pos = from.lerp(to, u); pos.y += Math.sin(u * Math.PI) * 1.1; BOXSHOW.g.position.copy(BOXSHOW.g.parent.worldToLocal(pos)); BOXSHOW.g.rotation.set(0, (1 - u) * 2.5, (1 - u) * 0.6);
    BOXSHOW.g.children[BOXSHOW.g.children.length - 1].visible = u >= 1; // the stand appears when it lands
    if (u >= 1) { D.phase = 'box'; D.revealT = 0; BOXSHOW.g.position.set(0.95, 1.06, 1.35); BOXSHOW.g.rotation.set(0, 0, 0); clank(3); tone(180, 90, 0.15, 'sine', 0.12); }
  } else if (D.phase === 'box') {
    D.revealT += dt; BOXSHOW.lid.rotation.x = -1.9 * clamp((D.revealT - 0.6) / 0.6, 0, 1);
    if (D.revealT > 1.4 && !D.rated) dlvRate();
  }
  if (PEN && PEN.root.visible) { drawPenny(now); penAnimate(dt, now); }
}
function dlvRate() {
  D.rated = true; const late = D.t > DLV.time, left = D.left, n = DLV.slices;
  D.stars = left === 0 ? 0 : Math.max(1, Math.min(5, Math.round(left / n * 5) - (late ? 1 : 0)));
  penMood = D.stars >= 4 ? 'happy' : D.stars >= 2 ? 'meh' : D.stars === 1 ? 'angry' : 'cry';
  const card = document.createElement('div'); card.className = 'dlvcard';
  const st = document.createElement('div'); st.className = 'st'; st.textContent = '★'.repeat(D.stars) + '☆'.repeat(5 - D.stars);
  const b = document.createElement('b'); b.textContent = left + '/' + n + ' slices · Tip $' + Math.max(0, Math.round(D.tip));
  const sm = document.createElement('small'); sm.textContent = { 5: 'PERFECT DELIVERY!', 4: 'GREAT DELIVERY', 3: 'NOT BAD…', 2: 'WHERE IS MY PIZZA?', 1: 'WORST DELIVERY EVER', 0: 'THE BOX IS EMPTY!' }[D.stars];
  card.append(st, b, sm); stage.appendChild(card); setTimeout(() => card.remove(), 5200);
  if (D.stars >= 4) { tone(660, 1320, 0.3, 'square', 0.05); tone(880, 1760, 0.3, 'square', 0.04, 0.15); for (let i = 0; i < 3; i++) setTimeout(() => burst(PEN.root.position.clone().add(new V3(0, 2.2, 0.5)), 50, CONF, 6), i * 220); }
  else if (D.stars <= 1) { tone(300, 90, 0.5, 'sawtooth', 0.06); if (D.stars === 0) setTimeout(() => { D.slam = true; }, 1600); }
  else tone(500, 420, 0.3, 'triangle', 0.05);
}
function penAnimate(dt, now) {
  const P = PEN.piv, t = now / 1000, m = penMood, S = SIDE, e = (n, x, y, z) => P[n].rotation.set(x, y, z, 'XYZ');
  for (const n in P) P[n].rotation.set(0, 0, 0);
  let bounce = 0;
  if (m === 'idle' || m === 'love') { e('head', Math.sin(t * 1.3) * 0.05 + (m === 'love' ? 0.25 : 0), Math.sin(t * 0.9) * 0.15, 0.12); e('upperL', 0.1, 0, S.L * 0.25); e('upperR', 0.1, 0, S.R * 0.25); }
  else if (m === 'happy') { bounce = Math.abs(Math.sin(t * 7)) * 0.18; e('upperL', 0, 0, S.L * 2.5); e('upperR', 0, 0, S.R * 2.5); e('foreL', 0.3, 0, 0); e('foreR', 0.3, 0, 0); e('head', -0.15, 0, Math.sin(t * 7) * 0.12); }
  else if (m === 'meh') { e('head', 0.1, 0, 0.3 + Math.sin(t * 2) * 0.05); e('upperL', 0.1, 0, S.L * 0.7); e('upperR', 0.1, 0, S.R * 0.7); e('foreL', 1.2, 0, 0); e('foreR', 1.2, 0, 0); }
  else if (m === 'angry') { bounce = Math.max(0, Math.sin(t * 9)) * 0.06; e('upperL', 0.3, 0, S.L * 0.9); e('upperR', 0.3, 0, S.R * 0.9); e('foreL', 1.7 + Math.sin(t * 14) * 0.15, 0, 0); e('foreR', 1.7 + Math.sin(t * 14 + 1) * 0.15, 0, 0); e('head', 0, Math.sin(t * 10) * 0.25, 0); }
  else if (m === 'cry') { e('head', 0.45, 0, Math.sin(t * 12) * 0.05); e('torso', 0.2, 0, 0); e('upperL', 0.9, 0, S.L * 0.3); e('upperR', 0.9, 0, S.R * 0.3); e('foreL', 1.9, 0, 0); e('foreR', 1.9, 0, 0); }
  if (PEN.walk) { const w = Math.sin(t * 7.5); e('thighL', w * 0.45, 0, 0); e('thighR', -w * 0.45, 0, 0); e('shinL', Math.max(0, -w) * 0.7, 0, 0); e('shinR', Math.max(0, w) * 0.7, 0, 0); e('upperL', -w * 0.35, 0, S.L * 0.2); e('upperR', w * 0.35, 0, S.R * 0.2); bounce = Math.abs(Math.sin(t * 7.5)) * 0.035; }
  PEN.root.position.set(0.1, (trackH(DOOR_S) ?? 0) + 0.16 + bounce, PEN.z ?? -DOOR_S + 1.1);
  PEN.root.rotation.y = LABYAW_FACE();
  if (D.slam && DOOR) { DOOR.hinge.rotation.y *= Math.pow(0.001, dt); if (Math.abs(DOOR.hinge.rotation.y) < 0.05 && !D.slammed) { D.slammed = true; clank(12); tone(90, 40, 0.3, 'sine', 0.4); if (!reduceMotion) shake = 0.5; PEN.root.visible = false; } }
}
function LABYAW_FACE() { return FACE_N ? Math.atan2(-FACE_N.x, FACE_N.z) : 0; } // turn a model so its face looks along +z (toward the arriving courier)
function dlvReset() {
  if (!DLV) return;
  Object.assign(D, { camSet: false, left: DLV.slices, t: 0, tip: DLV.tip, phase: 'go', lost: 0, lidT: 0, doorT: 0, revealT: 0, stars: 0, rated: false, slam: false, slammed: false });
  SLC.on.fill(false); SLC.meshes.forEach(m => { m.visible = false; }); for (let i = 0; i < SLC.core.n; i++) SLC.core.inv[i] = 0;
  if (DOOR) DOOR.hinge.rotation.y = 0; if (BOXSHOW) { BOXSHOW.g.visible = false; BOXSHOW.lid.rotation.x = 0; BOXSHOW.g.position.set(0.95, 1.06, 1.35); }
  if (PEN) { PEN.root.visible = false; penMood = 'idle'; PEN.walk = false; PEN.z = -DOOR_S + 0.1; }
  if (BAG_LID) BAG_LID.rotation.x = 0;
  dlvHud();
}
if (DLV) { buildDoor(); buildPenny(); buildDlvHud(); }

// =====================================================================
// MODE: LAB — crash tests, level 1 to 100. Daggie on a test stand vs a machine with a power slider.
// Machines: FART POWER (launch height), SOCK SIZE (giant stinky foot), ANVIL HEIGHT (drop height).
// =====================================================================
const LAB_SPEEDS = [15, 50, 80, 130, 200]; // mph for levels 1..5. The post holds on 1-2 and snaps on 3-5; Daggie doesn't grip the cart
const LAB_MAX = () => (LAB.machine === 'bollard' ? LAB_SPEEDS.length : 100);
const LAB_INFO = {
  bollard: { title: 'CART vs BOLLARD', ask: 'How fast before he flies out?' },
  fart: { title: 'FART POWER', ask: 'How high does he fly?' },
  sock: { title: 'SOCK SIZE', ask: 'How big a foot can he take?' },
  anvil: { title: 'ANVIL HEIGHT', ask: 'From how high does it break him?' },
};
const LAB = { machine: (L.machines || ['fart'])[0], level: 1, phase: 'idle', t: 0, h: 0, v: 0, spin: 0, lost: 0, text: '', pending: 0, exploded: false };
try { const sv = JSON.parse(localStorage.getItem('daggie-lab') || '{}'); if (LAB_INFO[sv.m]) LAB.machine = sv.m; if (sv.l >= 1 && sv.l <= 100) LAB.level = sv.l; if (LAB.machine === 'bollard') LAB.level = Math.min(LAB.level, LAB_SPEEDS.length); } catch (e) {}
const REST_Y = STAND_H - BOARD_TOP, HEAD_TOP = STAND_H + 2.15;
let LAB_YAW = 0, labBuilt = false, LEG = null;
const GAS = [];
function gasTex() { return tex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(190,255,120,0.95)'); gr.addColorStop(0.5, 'rgba(120,220,60,0.55)'); gr.addColorStop(1, 'rgba(80,160,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }); }
function spawnGas(pos, n, size, speed) {
  for (let i = 0; i < n; i++) {
    let gs = GAS.find(q => !q.on); if (!gs) { gs = GAS.reduce((a, b) => (a.age > b.age ? a : b)); }
    gs.on = true; gs.age = 0; gs.life = rand(0.9, 1.8); gs.size = size * rand(0.6, 1.3); gs.m.visible = true;
    gs.m.position.copy(pos).add(new V3(rand(-0.3, 0.3), rand(-0.1, 0.2), rand(-0.3, 0.3)));
    gs.v.set(rand(-1, 1), rand(-0.2, 0.6), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
  }
}
function stepGas(dt) {
  for (const gs of GAS) {
    if (!gs.on) continue; gs.age += dt; const k = gs.age / gs.life;
    if (k >= 1) { gs.on = false; gs.m.visible = false; continue; }
    gs.m.position.addScaledVector(gs.v, dt); gs.v.multiplyScalar(Math.pow(0.35, dt)); gs.v.y += 0.4 * dt;
    gs.m.scale.setScalar(gs.size * (0.5 + k * 1.6)); gs.m.material.opacity = 0.75 * (1 - k);
  }
}
function brrt(power) { // the fart sound: a wobbling low buzz, longer and deeper with power
  const n = 3 + Math.round(power * 9);
  for (let i = 0; i < n; i++) tone(rand(60, 115) - power * 20, rand(40, 60), 0.09, i % 2 ? 'square' : 'sawtooth', 0.06 + power * 0.05, i * 0.055);
}
function buildLab() {
  labBuilt = true; LABNOSTAND = (L.machines || []).every(m => m === 'bollard');
  for (const o of TRACK_OBJS) o.visible = false; // the lab has no track
  BIG.visible = false; board.visible = LAB.machine === 'bollard';
  { const bm = new THREE.Group(), post = new THREE.Group(); post.rotation.order = 'YXZ'; post.position.y = 0.12; bm.add(post); const st = new THREE.Mesh(new THREE.CylinderGeometry(BOLLARD_R, BOLLARD_R, BOLLARD_H, 24), stripeMat(1.4)); st.position.y = BOLLARD_H / 2 - 0.12; st.castShadow = true; post.add(st); const cap = new THREE.Mesh(new THREE.SphereGeometry(BOLLARD_R, 20, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.4 })); cap.position.y = BOLLARD_H - 0.12; post.add(cap); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 0.9 })); base.position.y = 0.06; bm.add(base); bm.position.set(LAB_LANE, 0, BOLLARD_Z); scene.add(bm); BOLLARD = post; LABCART.cyls.push({ x: LAB_LANE, z: BOLLARD_Z, r: BOLLARD_R, h: BOLLARD_H }); }
  scene.fog = new THREE.Fog(0x2a2733, 60, 260);
  const conc = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#6f6c70'; g.fillRect(0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
    g.strokeStyle = 'rgba(30,28,34,0.5)'; g.lineWidth = 4; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); }
  });
  conc.wrapS = conc.wrapT = THREE.RepeatWrapping; conc.repeat.set(10, 10);
  conc.repeat.set(10, 58); const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 460), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 30; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(STAND_R + 0.4, STAND_R + 1.0, 48), stripeMat(8)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; ring.visible = !(L.machines || []).every(m => m === 'bollard'); scene.add(ring);
  const wallT = tex(512, 512, (g, w, h) => { g.fillStyle = '#3d3a45'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a2830'; g.lineWidth = 8; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.fillStyle = '#8b8894'; for (let x = 20; x < w; x += 128) for (let y = 20; y < h; y += 118) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 88, y, 5, 0, TAU); g.fill(); } });
  wallT.wrapS = wallT.wrapT = THREE.RepeatWrapping; wallT.repeat.set(8, 3);
  const wm = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });
  const HZ = LABNOSTAND ? -200 : -20, HL = LABNOSTAND ? 460 : 40, HC = LABNOSTAND ? 30 : 0; wallT.repeat.set(LABNOSTAND ? 90 : 8, 3);
  for (const [x, z, ry, w] of [[0, HZ, 0, 40], [-20, HC, Math.PI / 2, HL], [20, HC, -Math.PI / 2, HL]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 14), wm); m.position.set(x, 7, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); }
  for (const [x, z, ry, w] of [[0, HZ + 0.1, 0, 40], [-19.9, HC, Math.PI / 2, HL], [19.9, HC, -Math.PI / 2, HL]]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.5), stripeMat(w)); st.position.set(x, 1.2, z); st.rotation.y = ry; scene.add(st); }
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), sign('CRASH LAB', '#ffc21a', '#16141c', 1024, 256)); logo.position.set(0, 9.5, HZ + 0.15); scene.add(logo);
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), sign('DO NOT TRY THIS', '#e0322b', '#ffffff', 768, 192)); warn.position.set(-10, 5, HZ + 0.15); scene.add(warn);
  const warn2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), sign('LEVEL 1 - 100', '#16141c', '#3dff9a', 768, 192)); warn2.position.set(10, 5, HZ + 0.15); scene.add(warn2);
  for (let i = 0; i < 5; i++) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 0.6), new THREE.MeshBasicMaterial({ color: glowColor(0xfff3dc, 2.2) })); lamp.position.set(-12 + i * 6, 13.6, -8); scene.add(lamp); }
  LABNOSTAND = (L.machines || []).every(m => m === 'bollard');
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(STAND_R, STAND_R + 0.2, STAND_H, 40), new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 0.8, roughness: 0.35 })); stand.position.y = STAND_H / 2; stand.castShadow = stand.receiveShadow = true; stand.visible = !LABNOSTAND; scene.add(stand);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(STAND_R + 0.01, STAND_R + 0.01, 0.16, 40, 1, true), stripeMat(8)); band.position.y = STAND_H - 0.1; band.visible = !LABNOSTAND; scene.add(band);
  const gt = gasTex();
  for (let i = 0; i < 40; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, transparent: true, depthWrite: false, opacity: 0 })); m.visible = false; scene.add(m); GAS.push({ m, on: false, age: 0, life: 1, size: 1, v: new V3() }); }
  // the giant stinky sock (origin at the sole)
  LEG = new THREE.Group(); LEG.visible = false; scene.add(LEG);
  const skin = new THREE.MeshStandardMaterial({ color: 0xe6ad86, roughness: 0.7 }), sockM = new THREE.MeshStandardMaterial({ color: 0xe8e3d4, roughness: 0.95 }), dirt = new THREE.MeshStandardMaterial({ color: 0x6f6247, roughness: 1 });
  const foot = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.7, 2.3, 4, 0.3), sockM); foot.position.set(0, 0.35, 0.45); foot.castShadow = true; LEG.add(foot);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), sockM); heel.scale.set(1, 0.9, 1); heel.position.set(0, 0.55, -0.45); LEG.add(heel);
  const sockUp = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 1.8, 24), sockM); sockUp.position.set(0, 1.5, -0.4); sockUp.castShadow = true; LEG.add(sockUp);
  for (const y of [2.1, 2.3]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.05, 8, 28), new THREE.MeshStandardMaterial({ color: 0xd8342a })); st.rotation.x = Math.PI / 2; st.position.set(0, y, -0.4); LEG.add(st); }
  const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.52, 5, 24), skin); calf.position.set(0, 4.8, -0.4); calf.castShadow = true; LEG.add(calf);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), skin); toe.position.set(-0.3, 0.42, 1.58); LEG.add(toe); // big toe through the hole
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), dirt); hole.position.set(-0.3, 0.42, 1.56); LEG.add(hole);
  for (const [x, z] of [[0.3, 0.2], [-0.2, -0.3], [0.1, 0.9]]) { const sp = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), dirt); sp.rotation.x = -Math.PI / 2; sp.position.set(x, 0.005, z); sp.rotation.x = Math.PI / 2; LEG.add(sp); }
  if (LABNOSTAND) { labDress(); labProps(); labHall(); labPosters(); }
  buildLabUI();
}
let SPEEDO = null;
function labDress() {
  const lane = new THREE.MeshBasicMaterial({ color: 0xffc21a });
  for (const x of [-1.6, 1.6]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 200), lane); l.rotation.x = -Math.PI / 2; l.position.set(LAB_LANE + x, 0.011, BOLLARD_Z + 20 - 100); scene.add(l); }
  // distance ruler painted on the floor, readable from the chase camera: short ticks every 5 m, a line and a label on both sides every 10 m
  {
    const flat = (w, h, mat, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.renderOrder = 2; scene.add(m); return m; };
    const paint = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false });
    const wTick = paint(0xffffff, 0.8), wLine = paint(0xffffff, 0.35), cLine = paint(0x5ce1ff, 0.7), gLine = paint(0xffc21a, 0.85);
    const label = (txt, col) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: tex(320, 128, (g, cw, ch) => {
      g.clearRect(0, 0, cw, ch); g.fillStyle = 'rgba(12,9,28,.62)'; g.beginPath(); if (g.roundRect) g.roundRect(6, 12, cw - 12, ch - 24, 30); else g.rect(6, 12, cw - 12, ch - 24); g.fill();
      g.lineWidth = 5; g.strokeStyle = col; g.stroke(); g.fillStyle = '#fff'; g.font = '700 72px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cw / 2, ch / 2 + 4); }) });
    flat(6.8, 0.2, gLine, LAB_LANE, BOLLARD_Z - 0.4); // the start line at the post
    for (let d = 5; d <= 120; d += 5) {
      const z = BOLLARD_Z - d, big = d % 10 === 0, gold = d % 100 === 0, cyan = d % 50 === 0;
      if (!big) { for (const sd of [-1, 1]) flat(0.9, 0.07, wTick, LAB_LANE + sd * 3.0, z); continue; }
      flat(6.4, cyan ? 0.13 : 0.07, gold ? gLine : cyan ? cLine : wLine, LAB_LANE, z);
      const lm = label(d + ' m', gold ? '#ffc21a' : cyan ? '#5ce1ff' : 'rgba(255,255,255,.7)');
      for (const sd of [-1, 1]) flat(2.2, 0.88, lm, LAB_LANE + sd * 4.5, z);
    }
  }
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), stripeMat(4)); zone.rotation.x = -Math.PI / 2; zone.position.set(LAB_LANE, 0.009, BOLLARD_Z); zone.material = zone.material.clone(); zone.material.transparent = true; zone.material.opacity = 0.35; scene.add(zone);
  // speed gantry with a live readout
  const steelG = new THREE.MeshStandardMaterial({ color: 0x5b6070, metalness: 0.8, roughness: 0.35 });
  const gz = BOLLARD_Z + 7;
  for (const x of [-3.2, 3.2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, 0.25), steelG); post.position.set(LAB_LANE + x, 2.5, gz); post.castShadow = true; scene.add(post); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.35, 0.35), steelG); beam.position.set(LAB_LANE, 5, gz); scene.add(beam);
  const spCv = document.createElement('canvas'); spCv.width = 512; spCv.height = 200; const spTex = new THREE.CanvasTexture(spCv); spTex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshBasicMaterial({ map: spTex, color: glowColor(0xffffff, 1.3) })); disp.position.set(LAB_LANE, 4.3, gz + 0.19); scene.add(disp);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x15131c, roughness: 0.6 })); back.position.set(LAB_LANE, 4.3, gz + 0.08); scene.add(back);
  SPEEDO = { cv: spCv, tex: spTex, last: -1 };
  // tyre stacks, crash barrels and camera tripods along the walls
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1d1c21, roughness: 0.9 }), barrel = new THREE.MeshStandardMaterial({ color: 0x2d6fd6, roughness: 0.5 });
  for (let i = 0; i < 16; i++) { const z = BOLLARD_Z + 24 - i * 9, x = (i % 2 ? 1 : -1) * rand(14, 18);
    const n = 2 + (i % 3); for (let k = 0; k < n; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.17, 10, 20), tyre); t.rotation.x = Math.PI / 2; t.position.set(x, 0.17 + k * 0.34, z); t.castShadow = true; scene.add(t); }
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.95, 16), barrel); b.position.set(x + (x > 0 ? -1.3 : 1.3), 0.48, z + 1.2); b.castShadow = true; scene.add(b); }
  for (const [x, z] of [[5.5, BOLLARD_Z + 3], [-5.5, BOLLARD_Z - 4], [6, BOLLARD_Z - 16]]) { const cam = new THREE.Group(); cam.position.set(LAB_LANE + x, 0, z);
    for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), steelG); const a = k / 3 * TAU; leg.position.set(Math.cos(a) * 0.25, 0.72, Math.sin(a) * 0.25); leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); cam.add(leg); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.5 })); body.position.y = 1.5; cam.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0x0d0d12, metalness: 0.4, roughness: 0.2 })); lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.5, -0.28); cam.add(lens);
    const rec = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), neon(0xff2a2a, 4)); rec.position.set(0.1, 1.64, -0.1); cam.add(rec);
    cam.lookAt(new V3(LAB_LANE, 0, BOLLARD_Z)); cam.rotation.x = 0; cam.rotation.z = 0; scene.add(cam); }
}
// poster photos: pose the real Daggie, photograph him with a separate camera into a texture
function posterShot(bg, pose, extra) {
  const rt = new THREE.WebGLRenderTarget(512, 640, { samples: 4 });
  const cam = new THREE.PerspectiveCamera(30, 512 / 640, 0.1, 60);
  const vis = scene.children.map(o => o.visible), bgOld = scene.background, fogOld = scene.fog;
  scene.children.forEach(o => { if (o !== rider && !o.isLight) o.visible = false; });
  scene.background = new THREE.Color(bg); scene.fog = null;
  const rp = rider.position.clone(), rr = rider.rotation.clone();
  rider.position.set(0, 60, 0); rider.rotation.set(0, LAB_YAW + (extra && extra.yaw || 0), 0);
  rootQ.identity(); rootPos.set(0, 0, 0); const P = pose(); runFK(P); applyFK();
  if (extra && extra.before) extra.before();
  drawFace(performance.now() + 99999); rider.updateMatrixWorld(true);
  const T = torso.getWorldPosition(new V3()); cam.position.set(T.x + 0.9, T.y + 0.25, T.z + 4.4); cam.lookAt(T.x, T.y - 0.15, T.z);
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
  if (extra && extra.after) extra.after();
  scene.children.forEach((o, i) => { o.visible = vis[i]; }); scene.background = bgOld; scene.fog = fogOld; rider.position.copy(rp); rider.rotation.copy(rr);
  return rt.texture;
}
function posterBoard(img, title, sub, x, z, ry, colors, scl) {
  const g = new THREE.Group(); g.position.set(x, 3.8, z); g.rotation.y = ry; scene.add(g); g.scale.setScalar(scl || 1);
  const W = 3.4, H = 4.6;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, H + 0.24, 0.08), new THREE.MeshStandardMaterial({ color: 0x1a1820, roughness: 0.5 })); frame.position.z = -0.03; g.add(frame);
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, H - 0.12), new THREE.MeshBasicMaterial({ map: img || null, color: img ? 0xffffff : 0x000000 })); ph.position.set(0, 0, 0.02); ph.visible = !!img; g.add(ph); g.userData.photo = ph;
  const txt = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ transparent: true, map: tex(512, 692, (c, w, h) => {
    c.clearRect(0, 0, w, h); if (!img) { c.fillStyle = colors[0]; c.fillRect(0, 0, w, h); }
    c.fillStyle = colors[0]; c.fillRect(0, 0, w, 118); c.fillRect(0, h - 104, w, 104);
    c.fillStyle = colors[1]; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 ' + (title.length > 12 ? 58 : 76) + 'px ' + FONT; c.fillText(title, w / 2, 62);
    c.font = '700 ' + (sub.length > 18 ? 34 : 42) + 'px ' + FONT; c.fillText(sub, w / 2, h - 52);
    if (!img && colors[2]) { c.font = '700 330px ' + FONT; c.fillStyle = colors[2]; c.fillText(colors[3], w / 2, h / 2 + 10); }
  }) })); txt.position.z = 0.03; g.add(txt); g.userData.text = txt;
  return g;
}
function labPosters() {
  const P0 = () => ({ upperL: [0.1, 0, SIDE.L * 0.25], upperR: [0.1, 0, SIDE.R * 0.25], foreL: [0.3, 0, 0], foreR: [0.3, 0, 0] });
  const cheer = () => ({ upperL: [0, 0, SIDE.L * 2.6], upperR: [0, 0, SIDE.R * 2.6], foreL: [0.2, 0, 0], foreR: [0.2, 0, 0], head: [-0.15, 0, 0.1] });
  const dark = new THREE.MeshStandardMaterial({ color: 0x7a0f18, roughness: 0.35, metalness: 0.4 });
  const shots = [
    ['#ffc21a', cheer, 'happy', null, 'EMPLOYEE', 'OF THE MONTH x47', ['#16141c', '#ffc21a']],
    ['#e8d8b8', P0, 'worried', { before: () => { byName.head.visible = false; }, after: () => { byName.head.visible = true; } }, 'WANTED', 'MY HEAD · REWARD $5', ['#5a3a1a', '#f3e6c8']],
    ['#2f6fd0', () => flailPose(1.3), 'scared', { yaw: 0.5 }, 'TEST #001', 'HE SURVIVED* *NOT', ['#0f1c3a', '#ffffff']],
    ['#161222', () => tuckPose(0.7), 'wow', { yaw: -0.4 }, 'COMING SOON', 'THE SLINGSHOT TEST', ['#0b0720', '#3dff9a']],
    ['#1a0709', P0, 'hit', { before: () => { for (const p of parts) p.userData.mesh.material = dark; }, after: () => { for (const p of parts) p.userData.mesh.material = bodyMat; } }, 'RIVAL D666', 'IS WATCHING YOU', ['#16080a', '#ff3a4e']],
  ];
  const oldFace = faceMode;
  const imgs = shots.map(([bg, pose, face, extra]) => { setFace(face, 99999); return posterShot(bg, pose, extra); });
  setFace(oldFace, 0);
  // both walls, full length: big posters every 10 m. poster-1.jpg … poster-26.jpg in the repo replace the photos automatically
  const boards = [];
  for (const side of [-1, 1]) for (let k = 0; k < 13; k++) {
    const z = BOLLARD_Z + 36 - k * 10.5, i = ((side < 0 ? 0 : 13) + k) % 26, sh = shots[i % shots.length]; // 26 places, 26 different posters
    const bd = posterBoard(imgs[i % shots.length], sh[4], sh[5], side * 19.75, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, sh[6], 2);
    bd.position.set(side * 19.75, 7.2, z); boards.push({ bd, i });
  }
  const loader = new THREE.TextureLoader();
  const putPoster = (i, t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    for (const b of boards) if (b.i === i) { b.bd.userData.photo.material.map = t; b.bd.userData.photo.material.needsUpdate = true; b.bd.userData.photo.scale.set(1, 1.02, 1); b.bd.userData.text.visible = false; } };
  const loadPoster = (i, tries) => loader.load('poster-' + (i + 1) + '.jpg' + (tries === 0 ? '?v=' + (typeof BUILD !== 'undefined' ? BUILD : '') : tries === 1 ? '' : '?r=' + Date.now()), t => putPoster(i, t), undefined, () => { if (tries < 2) setTimeout(() => loadPoster(i, tries + 1), 400 * (tries + 1)); else console.warn('poster-' + (i + 1) + '.jpg not found'); });
  for (let i = 0; i < 26; i++) loadPoster(i, 0); // versioned file, then the plain path (offline cache), then a fresh network try
  const acc = posterBoard(null, 'DAYS WITHOUT', 'AN ACCIDENT', -19.75, BOLLARD_Z - 0.75, Math.PI / 2, ['#f4f1ea', '#16141c', '#e0322b', '0'], 0.85); acc.position.set(-19.7, 2.4, BOLLARD_Z - 0.75); // fits in the gap between two big posters
}
function labProps() {
  const steelG = new THREE.MeshStandardMaterial({ color: 0x5b6070, metalness: 0.8, roughness: 0.35 });
  // SPARE PARTS shelf with real Daggie heads, arms and legs on it
  const shelf = new THREE.Group(); shelf.position.set(-9.5, 0, BOLLARD_Z - 1.5); shelf.rotation.y = Math.PI / 2 - 0.35; shelf.scale.setScalar(1.9); scene.add(shelf);
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff1d8, transparent: true, opacity: 0.12, depthWrite: false })); spot.rotation.x = -Math.PI / 2; spot.position.set(-9.5, 0.013, BOLLARD_Z - 1.5); scene.add(spot);
  for (const y of [0.1, 1.0, 1.9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.8), steelG); b.position.y = y; b.castShadow = b.receiveShadow = true; shelf.add(b); }
  for (const x of [-1.65, 1.65]) for (const z of [-0.35, 0.35]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.5, 0.05), steelG); post.position.set(x, 1.25, z); shelf.add(post); }
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.58), sign('SPARE PARTS', '#ffc21a', '#16141c', 512, 114)); lbl.position.set(0, 2.35, 0.42); shelf.add(lbl);
  const put = (n, x, y, ry) => { const g = new THREE.Group(); for (const ch of byName[n].children) g.add(ch.clone()); g.position.set(x, y, 0); g.rotation.set(Math.PI / 2 * (n === 'head' ? 0 : 1), ry, 0); shelf.add(g); };
  put('head', -1.1, 1.25, 0.4); put('head', 0.1, 1.25, -0.3); put('head', 1.1, 1.25, 0.9); put('upperL', -0.9, 0.2, 0); put('foreR', 0.1, 0.2, 0.3); put('thighL', 0.9, 0.22, -0.2); put('handR', -0.9, 2.02, 0); put('footL', 0.6, 2.02, 0.4);
  // crash barriers at the start, skid marks and old oil at the post, a control desk with screens
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.8, 0.5, 2, 0.08), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xff6a1a, roughness: 0.6 })); b.position.set(LAB_LANE + (i < 3 ? -3.4 : 3.4), 0.4, BOLLARD_Z + 12 + (i % 3) * 1.3); b.rotation.y = Math.PI / 2; b.castShadow = true; scene.add(b); }
  const skidM = new THREE.MeshBasicMaterial({ color: 0x14131a, transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 5; i++) { const sk = new THREE.Mesh(new THREE.PlaneGeometry(0.22, rand(3, 8)), skidM); sk.rotation.x = -Math.PI / 2; sk.rotation.z = rand(-0.15, 0.15); sk.position.set(LAB_LANE + rand(-0.8, 0.8), 0.014, BOLLARD_Z + rand(1.5, 5)); scene.add(sk); }
  for (let i = 0; i < 6; i++) spawnSplat(LAB_LANE + rand(-3, 3), BOLLARD_Z - rand(1, 12), rand(0.3, 0.7));
  const desk = new THREE.Group(); desk.position.set(12, 0, BOLLARD_Z + 6); desk.rotation.y = -Math.PI / 2 - 0.4; scene.add(desk);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1), new THREE.MeshStandardMaterial({ color: 0xd9d9dd, roughness: 0.5 })); top.position.y = 0.95; desk.add(top);
  for (const x of [-1.1, 1.1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.9), steelG); leg.position.set(x, 0.47, 0); desk.add(leg); }
  const graph = (title, draw) => new THREE.MeshBasicMaterial({ map: tex(320, 200, (c, w, h) => { c.fillStyle = '#081018'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(61,255,154,0.25)'; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.fillStyle = '#3dff9a'; c.font = '700 22px ' + FONT; c.fillText(title, 12, 26); draw(c, w, h); }), color: glowColor(0xffffff, 1.2) });
  const scr1 = graph('IMPACT  47 G', (c, w, h) => { c.strokeStyle = '#ffc21a'; c.lineWidth = 3; c.beginPath(); for (let x = 0; x < w; x++) { const y = h - 30 - Math.exp(-((x - 190) ** 2) / 300) * 120 - Math.random() * 6; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); });
  const scr2 = graph('PARTS LOST  15/15', (c, w, h) => { c.fillStyle = '#ff4a5a'; for (let i = 0; i < 15; i++) c.fillRect(14 + i * 19, h - 40 - (i % 5) * 18, 14, 30 + (i % 5) * 18); });
  for (const [x, m] of [[-0.55, scr1], [0.55, scr2]]) { const mon = new THREE.Mesh(new THREE.BoxGeometry(1, 0.62, 0.05), new THREE.MeshStandardMaterial({ color: 0x15141a })); mon.position.set(x, 1.4, -0.2); desk.add(mon); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.56), m); sc.position.set(x, 1.4, -0.17); desk.add(sc); }
  // tall light towers
  for (const [x, z] of [[-9, BOLLARD_Z + 8], [9, BOLLARD_Z - 6]]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), steelG); pole.position.set(x, 3, z); scene.add(pole); const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.12), steelG); panel.position.set(x, 6, z); panel.lookAt(LAB_LANE, 0, BOLLARD_Z); scene.add(panel); const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.65), new THREE.MeshBasicMaterial({ color: glowColor(0xfff1d8, 2.4) })); glow.position.copy(panel.position); glow.quaternion.copy(panel.quaternion); glow.translateZ(0.07); scene.add(glow); }
}
function labHall() {
  const steelG = new THREE.MeshStandardMaterial({ color: 0x4e5361, metalness: 0.8, roughness: 0.4 }), pipeM = new THREE.MeshStandardMaterial({ color: 0x8a3a2a, metalness: 0.5, roughness: 0.5 }), ductM = new THREE.MeshStandardMaterial({ color: 0xa7adb8, metalness: 0.7, roughness: 0.35 });
  const z0 = BOLLARD_Z + 40, z1 = BOLLARD_Z - 110, len = z0 - z1, zc = (z0 + z1) / 2;
  for (const sd of [-1, 1]) {
    const x = sd * 19.3;
    const duct = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, len), ductM); duct.position.set(x, 13.1, zc); scene.add(duct);
    for (const [y, r] of [[12.2, 0.14], [11.8, 0.09]]) { const pp = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), pipeM); pp.rotation.x = Math.PI / 2; pp.position.set(x + sd * 0.25, y, zc); scene.add(pp); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), steelG); rail.position.set(x - sd * 1.6, 12.4, zc); scene.add(rail);
    for (let z = z0; z > z1; z -= 7) { // hanging industrial lamps
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), steelG); arm.position.set(x - sd * 1.1, 11.4, z); scene.add(arm);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 4), steelG); cord.position.set(x - sd * 2.2, 10.8, z); scene.add(cord);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f7a5a, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide })); shade.position.set(x - sd * 2.2, 10.1, z); scene.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: glowColor(0xffe6b8, 2.6) })); bulb.position.set(x - sd * 2.2, 9.9, z); scene.add(bulb);
    }
    for (let z = z0 - 4; z > z1; z -= 23) { // fire extinguishers and EXIT signs at eye level
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xd11f1f, roughness: 0.4 })); ex.position.set(x - sd * 0.2, 1.2, z); scene.add(ex);
      const exit = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), sign('EXIT', '#0e8a3e', '#ffffff', 256, 96)); exit.position.set(x - sd * 0.12, 3.2, z - 3); exit.rotation.y = sd < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(exit);
    }
    for (let z = z0 - 10; z > z1; z -= 17) { // pallets with boxes, gas bottles
      const pal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: 0xa47c4c, roughness: 0.9 })); pal.position.set(x - sd * 2.2, 0.08, z); scene.add(pal);
      for (let k = 0; k < 4; k++) { const bx = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.55), new THREE.MeshStandardMaterial({ color: 0xc19a64, roughness: 0.95 })); bx.position.set(x - sd * 2.2 + (k % 2 - 0.5) * 0.62, 0.4 + Math.floor(k / 2) * 0.5, z + rand(-0.1, 0.1)); bx.rotation.y = rand(-0.1, 0.1); bx.castShadow = true; scene.add(bx); }
      for (let k = 0; k < 3; k++) { const gb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 12), new THREE.MeshStandardMaterial({ color: pick([0x2e6fd8, 0x9aa0aa, 0x2b8a4a]), metalness: 0.5, roughness: 0.4 })); gb.position.set(x - sd * 0.5, 0.7, z + 3 + k * 0.36); scene.add(gb); }
    }
  }
  // landing zones where he ends up: crash mats and box stacks beside the lane (no painted targets)
  for (const [d, lbl] of [[12, 'ZONE A'], [30, 'ZONE B'], [60, 'ZONE C'], [95, 'ZONE D']]) {
    const z = BOLLARD_Z - d;
    for (const sd of [-1, 1]) { const mat = new THREE.Mesh(new RoundedBoxGeometry(2, 0.45, 3, 2, 0.12), new THREE.MeshStandardMaterial({ color: 0x2455b8, roughness: 0.8 })); mat.position.set(LAB_LANE + sd * 5.2, 0.22, z); mat.castShadow = mat.receiveShadow = true; scene.add(mat);
      for (let k = 0; k < 6; k++) { const bx = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0xc8a06a, roughness: 0.95 })); const row = k < 3 ? 0 : k < 5 ? 1 : 2, col = k < 3 ? k : k < 5 ? k - 3 : 0; bx.position.set(LAB_LANE + sd * 7.3, 0.3 + row * 0.6, z - 0.75 + col * 0.75 + row * 0.37); bx.rotation.y = rand(-0.15, 0.15); bx.castShadow = true; scene.add(bx); } }
  }
}
// ---- instant replay: the last seconds recorded and played back slowly with film cameras and black bars ----
const LREC = { frames: [], t: 0, impT: null };
function labRec(dt) {
  LREC.t += dt; if (LABCART.hit && LREC.impT === null) LREC.impT = LREC.t;
  const f = new Float32Array(8 + parts.length * 7), q = new THREE.Quaternion(), v = new V3();
  f[0] = LREC.t; board.getWorldPosition(v); board.getWorldQuaternion(q); f.set([v.x, v.y, v.z, q.x, q.y, q.z, q.w], 1);
  parts.forEach((p, i) => { p.getWorldPosition(v); p.getWorldQuaternion(q); f.set([v.x, v.y, v.z, q.x, q.y, q.z, q.w], 8 + i * 7); });
  LREC.frames.push(f); if (LREC.frames.length > 700) LREC.frames.shift();
}
function labBars(on) {
  let b = document.getElementById('labBars');
  if (!b) { b = document.createElement('div'); b.id = 'labBars'; b.innerHTML = '<i></i><i></i><span>● REPLAY</span>'; stage.appendChild(b);
    const css = document.createElement('style'); css.textContent = `#labBars{position:absolute;inset:0;z-index:9;pointer-events:none}#labBars i{position:absolute;left:0;right:0;height:0;background:#000;transition:height .35s ease}#labBars i:first-child{top:0}#labBars i:nth-child(2){bottom:0}#labBars.on i{height:12%}#labBars span{position:absolute;left:16px;top:calc(12% + 10px);font:700 18px "Chakra Petch",sans-serif;color:#ff3b4e;opacity:0;transition:opacity .3s;animation:blink 1s steps(2) infinite}#labBars.on span{opacity:1}.labmode.replaying .labgauge{opacity:0}`; document.head.appendChild(css); }
  b.classList.toggle('on', on); stage.classList.toggle('replaying', on);
}
function labReplayStart() {
  const imp = LREC.impT ?? LREC.t;
  const from = Math.max(LREC.frames[0] ? LREC.frames[0][0] : 0, imp - 0.7), to = Math.min(LREC.t, imp + 2.6);
  const cage = board.getObjectByName('cage');
  LAB.replay = { from, to, imp, t: from, shot: -1, dent: cage ? cage.geometry.attributes.position.array.slice() : null, cage, boomed: false, skip: false };
  LAB.phase = 'replay'; labBars(true); for (const p of parts) if (p.parent !== scene) scene.attach(p);
}
function labReplayFrame(t) {
  const F = LREC.frames; let i = 0; while (i < F.length - 2 && F[i + 1][0] <= t) i++;
  const a = F[i], b = F[i + 1] || a, k = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0, qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const put = (obj, o) => { obj.position.set(lerp(a[o], b[o], k), lerp(a[o + 1], b[o + 1], k), lerp(a[o + 2], b[o + 2], k)); qa.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]); qb.set(b[o + 3], b[o + 4], b[o + 5], b[o + 6]); obj.quaternion.copy(qa).slerp(qb, k); };
  put(board, 1); parts.forEach((p, j) => put(p, 8 + j * 7));
}
function labReplayStep(dt, now) {
  const R2 = LAB.replay; if (!R2) return;
  // slowest right at the impact, a little faster before and after
  const near = Math.abs(R2.t - R2.imp), speed = near < 0.35 ? 0.22 : near < 1 ? 0.4 : 0.65;
  R2.t += dt * speed;
  const before = R2.t < R2.imp;
  if (R2.cage && R2.dent) { const want = before ? 'o' : 'd'; if (R2.shown !== want) { R2.cage.geometry.attributes.position.array.set(before ? R2.cage.geometry.userData.orig : R2.dent); R2.cage.geometry.attributes.position.needsUpdate = true; R2.shown = want; } }
  bollardFall(before || !CART.knocked ? 0 : clamp((R2.t - R2.imp) * 5, 0, 1));
  if (!before && !R2.boomed) { R2.boomed = true; burst(new V3(LAB_LANE, 0.8, BOLLARD_Z), 60, SPARK, 6); tone(90, 30, 0.5, 'sine', 0.4); if (!reduceMotion) shake = 0.5; }
  labReplayFrame(R2.t);
  if (R2.t >= R2.to || R2.skip) { labReplayFrame(R2.to); if (R2.cage && R2.dent) { R2.cage.geometry.attributes.position.array.set(R2.dent); R2.cage.geometry.attributes.position.needsUpdate = true; } if (CART.knocked) bollardFall(1); LAB.replay = null; labBars(false); LAB.phase = 'done'; labFinish(LAB.outTxt || 'done'); }
}
function labReplayCam() {
  const R2 = LAB.replay, u = (R2.t - R2.from) / Math.max(0.01, R2.to - R2.from), shot = u < 0.34 ? 0 : u < 0.62 ? 1 : 2;
  if (shot !== R2.shot) { R2.shot = shot; snapCam = true; }
  const T = torso.getWorldPosition(new V3()), B = new V3(LAB_LANE, 0.8, BOLLARD_Z);
  if (shot === 0) { const s = u / 0.34; wantPos.set(LAB_LANE + 2.4, 0.45, BOLLARD_Z + 4.5 - s * 5); wantLook.set(LAB_LANE, 0.8, BOLLARD_Z - 0.5); }            // low dolly past the post
  else if (shot === 1) { wantPos.set(LAB_LANE - 1.4, 1.3, Math.min(T.z - 5, BOLLARD_Z - 5)); wantLook.copy(T); }                                            // from ahead: he flies at the lens
  else { const s = (u - 0.62) / 0.38, ang = 0.4 + s * 2.2; wantPos.set(T.x + Math.sin(ang) * 4.5, T.y + 1.6, T.z + Math.cos(ang) * 4.5); wantLook.copy(T); } // slow orbit around where he ends up
  return 30;
}
function labSpeedo(mph) { if (!SPEEDO) return; const v = Math.round(mph); if (v === SPEEDO.last) return; SPEEDO.last = v; const g = SPEEDO.cv.getContext('2d'); g.fillStyle = '#07060b'; g.fillRect(0, 0, 512, 200); g.fillStyle = v > 60 ? '#ff4a5a' : v > 30 ? '#ffc21a' : '#3dff9a'; g.font = '700 150px ' + FONT; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(String(v), 340, 108); g.font = '700 50px ' + FONT; g.textAlign = 'left'; g.fillText('MPH', 356, 130); SPEEDO.tex.needsUpdate = true; }
function buildLabUI() {
  const css = document.createElement('style');
  css.textContent = `.labmode .hud,.labmode .meters,.labmode .bar,.labmode .hint{display:none!important}
.labgauge{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);width:min(92%,440px);z-index:6;text-align:center;pointer-events:none}
.labgauge b{display:block;font:700 26px "Chakra Petch",ui-sans-serif,sans-serif;color:#fff;-webkit-text-stroke:1.5px #16112a;text-shadow:0 3px 0 #16112a;letter-spacing:1px}
.labgauge .row{display:flex;align-items:center;gap:8px;margin-top:4px}
.labgauge .pm{flex:none;width:30px;height:30px;border-radius:50%;background:#1c1838;border:3px solid #fff;color:#fff;font:700 20px/22px "Chakra Petch",sans-serif}
.labgauge .track{position:relative;flex:1;height:18px;border-radius:10px;border:3px solid #fff;background:linear-gradient(90deg,#3dff9a,#ffe23d 50%,#ff8a1f 75%,#ff2a3a)}
.labgauge .knob{position:absolute;top:50%;width:22px;height:30px;margin:-15px 0 0 -11px;background:#fff;border:3px solid #16112a;border-radius:8px 8px 12px 12px;transition:left .25s}
.labgauge .lvl{display:block;margin-top:4px;font:700 20px "Chakra Petch",sans-serif;color:#ffc41f;-webkit-text-stroke:1px #16112a}
.labpanel{position:absolute;left:0;right:0;bottom:0;z-index:7;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));background:rgba(11,7,32,.92);border-top:1px solid rgba(170,120,255,.35);font-family:"Chakra Petch",ui-sans-serif,sans-serif;color:#efeaff}
.labpanel .chips{display:flex;gap:6px;margin-bottom:8px}
.labpanel .chips button{flex:1;appearance:none;border:1px solid rgba(170,120,255,.4);background:rgba(255,255,255,.06);color:#efeaff;border-radius:10px;padding:8px 4px;font:700 13px "Chakra Petch",sans-serif}
.labpanel .chips button[aria-pressed="true"]{background:#ffc41f;color:#16112a;border-color:#ffc41f}
.labpanel .lrow{display:flex;align-items:center;gap:6px}
.labpanel input[type=range]{flex:1;accent-color:#ffc41f;height:30px}
.labpanel .sm{appearance:none;border:1px solid rgba(170,120,255,.4);background:rgba(255,255,255,.08);color:#efeaff;border-radius:9px;padding:7px 8px;font:700 13px "Chakra Petch",sans-serif;min-width:38px}
.labpanel .go{display:block;width:100%;margin-top:8px;appearance:none;border:0;border-radius:12px;background:#ff3a4e;color:#fff;font:700 20px "Chakra Petch",sans-serif;padding:12px;box-shadow:0 6px 18px rgba(255,58,78,.4)}
.labpanel .res{min-height:20px;margin:0 0 6px;font-size:14px;text-align:center;color:#a79cd6}
.labpanel .res b{color:#fff}
.labpanel .foot{display:flex;gap:6px;margin-top:8px}
.labpanel .foot button{flex:1;appearance:none;border:1px solid rgba(170,120,255,.4);background:transparent;color:#a79cd6;border-radius:9px;padding:7px;font:700 12px "Chakra Petch",sans-serif}
.labpanel .foot button[aria-pressed="true"]{color:#ffc41f;border-color:#ffc41f}`;
  document.head.appendChild(css);
  stage.classList.add('labmode');
  const g = document.createElement('div'); g.className = 'labgauge'; g.id = 'labGauge';
  g.innerHTML = '<b id="labTitle"></b><div class="row"><span class="pm">−</span><div class="track"><i class="knob" id="labKnob"></i></div><span class="pm">+</span></div><span class="lvl" id="labLvl"></span>';
  stage.appendChild(g);
  const p = document.createElement('div'); p.className = 'labpanel'; p.id = 'labPanel';
  p.innerHTML = '<p class="res" id="labRes"></p><div class="chips" id="labChips"></div><div class="lrow"><button class="sm" data-d="-10" type="button">−10</button><button class="sm" data-d="-1" type="button">−1</button><input type="range" min="1" max="100" step="1" id="labRange" aria-label="Level"><button class="sm" data-d="1" type="button">+1</button><button class="sm" data-d="10" type="button">+10</button></div><button class="go" id="labGo" type="button">TEST ▶</button><div class="foot"><button id="labMenu" type="button">◀ Menu</button><button id="labRec" type="button">Rec mode</button><button id="labNext" type="button">Next level ▶</button></div>';
  stage.appendChild(p);
  const chips = $('labChips');
  for (const m of (L.machines || Object.keys(LAB_INFO))) { const b = document.createElement('button'); b.type = 'button'; b.dataset.m = m; b.textContent = LAB_INFO[m].title; b.onclick = () => { LAB.machine = m; labSave(); labUI(); }; chips.appendChild(b); }
  for (const b of p.querySelectorAll('.sm')) { if (Math.abs(Number(b.dataset.d)) === 10) b.style.display = 'none'; b.onclick = () => { LAB.level = clamp(LAB.level + Number(b.dataset.d), 1, LAB_MAX()); labSave(); labUI(); }; }
  $('labRange').oninput = e => { LAB.level = clamp(Number(e.target.value) || 1, 1, LAB_MAX()); labSave(); labUI(); };
  $('labGo').onclick = () => { initAudio(); labStart(); };
  $('labNext').onclick = () => { initAudio(); LAB.level = Math.min(LAB_MAX(), LAB.level + 1); labSave(); labStart(); };
  $('labMenu').onclick = () => { location.href = 'index.html'; };
  $('labRec').onclick = () => { $('bLive').onclick(); labUI(); };
  stage.addEventListener('pointerdown', () => { if (LAB.replay) LAB.replay.skip = true; }); // tap to skip the replay
  labUI();
}
function labSave() { try { localStorage.setItem('daggie-lab', JSON.stringify({ m: LAB.machine, l: LAB.level })); } catch (e) {} }
function labUI() {
  if (!labBuilt) return;
  $('labTitle').textContent = LAB_INFO[LAB.machine].title;
  $('labKnob').style.left = ((LAB.level - 1) / (LAB_MAX() - 1) * 100) + '%'; $('labRange').max = String(LAB_MAX());
  $('labLvl').textContent = LAB.machine === 'bollard' ? 'LEVEL ' + LAB.level + ' · ' + LAB_SPEEDS[LAB.level - 1] + ' MPH' : 'LEVEL ' + LAB.level;
  $('labRange').value = String(LAB.level);
  for (const b of $('labChips').children) b.setAttribute('aria-pressed', String(b.dataset.m === LAB.machine));
  $('labRec').setAttribute('aria-pressed', String(REC_MODE));
  if (!LAB.text) { $('labRes').textContent = LAB_INFO[LAB.machine].ask; }
}
function labReset() {
  if (FACE_N) LAB_YAW = Math.atan2(-FACE_N.x, FACE_N.z); // before the build: the posters are photographed facing the camera
  if (!labBuilt) buildLab();
  Object.assign(R, { s: 0, x: 0, xT: 0, xv: 0, y: REST_Y, vy: 0, carry: false, speed: 0, grounded: false });
  drone.visible = false; BB.free = false; RAGSIM = null;
  if (LAB.machine === 'bollard') { board.visible = true; labCartReset(); } else { board.visible = false; board.position.set(0, -50, 0); }
  state = 'lab'; stateT = performance.now(); LAB.phase = 'idle'; LAB.t = 0; LAB.exploded = false; LAB.spin = 0;
  if (LEG) { LEG.visible = false; }
  setFace('idle', 0); snapCam = true;
}
function labStart() {
  resetRun(); // fresh Daggie on the stand
  LAB.text = ''; LAB.lost = 0; LAB.t = 0; LAB.pending = 0; LAB.vx = 0; LAB.v = 0; LREC.frames.length = 0; LREC.t = 0; LREC.impT = null; LAB.replay = null; labBars(false);
  $('labPanel').hidden = true; $('hook').classList.remove('show');
  state = 'ride'; stateT = performance.now(); setHP(100);
  const lv = LAB.level;
  if (LAB.machine === 'bollard') { LAB.phase = 'roll'; LABCART.v = LAB_SPEEDS[Math.min(lv, LAB_SPEEDS.length) - 1] * 0.447; CART.place(BOLLARD_Z + BOLLARD_R + Math.max(10, LABCART.v * 1.4)); CART.vz = -LABCART.v; labCartPlace(); R.speed = LABCART.v; R.grounded = true; setFace('happy', 1000); }
  else if (LAB.machine === 'fart') { LAB.phase = 'charge'; setFace('worried', 900); }
  else if (LAB.machine === 'sock') { LAB.phase = 'drop'; LEG.visible = true; LEG.scale.setScalar(0.55 + lv * 0.035); LEG.position.set(0, HEAD_TOP + 26, 0.1); LEG.rotation.set(0, LAB_YAW + Math.PI * 0.08, 0); LAB.v = 5 + lv * 0.3; setFace('scared', 5000); }
  else { LAB.phase = 'fall'; LAB.h = Math.max(1, lv); LAB.v = 0; ANVIL.visible = true; ANVIL.rotation.set(0, LAB_YAW, 0); ANVIL.position.set(0, HEAD_TOP + LAB.h, 0); ANVIL_RING.visible = true; ANVIL_RING.position.set(0, STAND_H + 0.02, 0); setFace('scared', 5000); tone(1200, 1200, 0.1, 'square', 0.05); tone(1200, 1200, 0.1, 'square', 0.05, 0.2); }
  lastPop = 0; pop('LEVEL ' + lv, 'lilac'); snapCam = true;
}
function labLose(n, dir) { // knock off n limbs, head last
  const order = ['foreL', 'foreR', 'upperL', 'upperR', 'shinL', 'shinR', 'head'].sort(() => Math.random() - 0.5);
  let k = 0; for (const nm of order) { if (k >= n) break; if (!byName[nm].userData.detached && detachPart(nm, dir || (Math.random() < 0.5 ? -1 : 1))) k++; }
  LAB.lost += k; return k;
}
function labScatter(power, up) {
  const c = torso.getWorldPosition(new V3());
  for (const p of parts) { const u = p.userData, out = p.position.clone().sub(c); out.y = Math.abs(out.y) * 0.4 + 0.3; out.normalize(); u.v.copy(out).multiplyScalar(rand(3, 7) * power); u.v.y += rand(1, 4) * (up || 1); u.w.set(rand(-12, 12), rand(-10, 10), rand(-12, 12)); }
}
function labPancake() {
  for (const p of parts) { const u = p.userData; p.scale.set(1.25, 0.28, 1.25); p.position.set(rand(-0.9, 0.9), STAND_H + 0.08, rand(-0.9, 0.9)); p.quaternion.setFromEuler(new THREE.Euler(0, rand(0, TAU), 0)); u.v.set(rand(-2, 2), 0.5, rand(-2, 2)); u.w.set(0, rand(-3, 3), 0); }
  for (let i = 0; i < 14; i++) { const a = rand(0, TAU), r = rand(STAND_R + 0.2, STAND_R + 3); spawnSplat(Math.cos(a) * r, Math.sin(a) * r, rand(0.2, 0.5)); }
  if (!reduceMotion) shake = 0.8;
}
function labFinish(text) { LAB.text = text; LAB.phase = 'done'; if (state === 'ride') { state = 'lab'; stateT = performance.now(); LAB.pending = performance.now() + 1400; } }
function labCrash(kind) { R.vy = Math.min(R.vy, 0); LAB.phase = 'wreck'; crash(kind); LAB.lost = 15; }
function labStep(dt, now) {
  stepGas(dt);
  if (state === 'lab') { if (now - stateT > 2500) $('hook').classList.remove('show'); if (LAB.pending && now > LAB.pending) { LAB.pending = 0; labDone(); } }
  const lv = LAB.level, P = LAB.phase; LAB.t += dt;
  const butt = () => byName.pelvis.getWorldPosition(new V3()).add(new V3(0, -0.3, 0));
  if (LAB.machine === 'bollard') {
    labSpeedo(P === 'roll' && state === 'ride' ? LABCART.v / 0.447 : P === 'idle' ? 0 : LABCART.v / 0.447 * (LABCART.hit ? 1 : 0));
    if (state === 'ride' && (P === 'roll' || P === 'crash')) labRec(dt);
    if (P === 'replay') { labReplayStep(dt, now); return; }
    if (P === 'roll' && state === 'ride') { if (CART.pw[1] - BOLLARD_Z < 7 && faceMode !== 'scared') setFace('scared', 5000); if (CART.step(dt)) labImpact(); labCartPlace(); for (const w of wheels) w.rotation.x -= LABCART.v / WHEEL_R * dt; if (LABCART.hit) { LAB.phase = 'crash'; LAB.t = 0; } }
    else if (P === 'crash' && RAGSIM) { ragSimStep(dt); const k = RAGSIM.I.pel * 3, L2 = LABCART.box.toLocal(RAGSIM.core.x[k], RAGSIM.core.x[k + 1], RAGSIM.core.x[k + 2]); RAGSIM.maxY = Math.max(RAGSIM.maxY || 0, L2[1]); if (RAGSIM.t > 3.4) { const txt = labBollardOutcome(); lastPop = 0; pop(txt.startsWith('stayed') ? 'HE STAYED IN!' : txt.startsWith('flew out but') ? 'HANGING ON!' : txt.startsWith('almost') ? 'SO CLOSE!' : 'YEETED!', 'green'); LAB.outTxt = txt; labReplayStart(); } }
    else if (P === 'done' && RAGSIM) ragSimStep(dt);
    return;
  }
  if (LAB.machine === 'fart') {
    if (P === 'charge') {
      R.x = rand(-1, 1) * 0.015 * (1 + lv / 25) * (LAB.t / 0.7);
      if (Math.random() < dt * 14) spawnGas(butt(), 1, 0.5 + lv * 0.01, 1.2);
      if (LAB.t > 0.7) {
        R.x = 0; LAB.h = 0.35 * Math.pow(lv, 1.4); R.vy = Math.sqrt(2 * 9.8 * LAB.h); LAB.phase = 'air'; LAB.t = 0;
        spawnGas(butt(), 8 + Math.round(lv / 4), 1.2 + lv * 0.03, 2 + lv * 0.05); brrt(lv / 100);
        setFace('wow', 4000); if (!reduceMotion) shake = Math.min(0.8, 0.15 + lv * 0.006); lastPop = 0; pop(lv > 80 ? 'MEGA BRRRAP!' : lv > 40 ? 'BRRRAP!' : 'pfft', 'green');
      }
    } else if (P === 'air') {
      R.vy -= 9.8 * dt; R.y += R.vy * dt; LAB.spin += dt * (0.6 + lv * 0.05);
      if (Math.random() < dt * 20) spawnGas(butt(), 1, 0.4 + lv * 0.01, 0.6);
      if (LAB.h > 150 && R.vy <= 0 && !LAB.exploded) { LAB.exploded = true; labCrash('fart'); labScatter(3.5, 0.3); explodeAt(torso.getWorldPosition(new V3())); lastPop = 0; pop('TO THE MOON!', 'green'); LAB.text = 'exploded in the sky'; return; }
      if (R.y <= REST_Y && R.vy < 0) {
        R.y = REST_Y; const h = LAB.h;
        if (h < 2.5) { crouch = 0.9; landImpact(5); lastPop = 0; pop('SAFE LANDING', 'green'); setFace('happy', 1500); labFinish('survived'); }
        else if (h < 12) { landImpact(8); const n = labLose(Math.min(3, 1 + Math.floor((h - 2.5) / 3.5))); lastPop = 0; pop('LOST ' + n + (n > 1 ? ' PARTS' : ' PART'), 'lilac'); setFace('hit', 1500); labFinish('lost ' + n + ' part' + (n > 1 ? 's' : '')); }
        else { labCrash('fart'); if (h > 60) labPancake(); else labScatter(1 + h / 40, 1); LAB.text = h > 60 ? 'pancaked on landing' : 'smashed on landing'; }
      }
    }
  } else if (LAB.machine === 'sock' && LEG) {
    const k = LEG.scale.x;
    if (P === 'drop') {
      LEG.position.y -= LAB.v * dt; if (Math.random() < dt * 10) spawnGas(LEG.position.clone().add(new V3(rand(-1, 1) * k, 0.8 * k, 0)), 1, 0.6 * k, 0.5);
      if (LEG.position.y <= HEAD_TOP) {
        tone(90, 40, 0.3, 'sine', 0.35); clank(10); if (!reduceMotion) shake = Math.min(0.9, 0.2 + lv * 0.007);
        spawnGas(new V3(0, HEAD_TOP, 0), 10, 1 + k * 0.5, 2);
        if (lv < 8) { LAB.phase = 'lift'; lastPop = 0; pop('BONK!', 'green'); setFace('hit', 1500); crouch = 1; landImpact(6); labFinish('survived'); }
        else if (lv < 25) { LAB.phase = 'lift'; labLose(1 + (lv > 16 ? 1 : 0)); if (!head.userData.detached) labLose(1); lastPop = 0; pop('HEAD OFF!', 'lilac'); labFinish('lost ' + LAB.lost + (LAB.lost === 1 ? ' part' : ' parts')); }
        else { labCrash('sock'); LAB.phase = 'press'; if (lv > 55) { labPancake(); LAB.text = 'flattened into a pancake'; } else { labScatter(1.2 + lv / 60, 0.6); LAB.text = 'stomped to pieces'; } }
      }
    } else if (P === 'press') { LEG.position.y = Math.max(STAND_H, LEG.position.y - LAB.v * 1.5 * dt); if (LEG.position.y <= STAND_H + 0.01) { LAB.phase = 'hold'; LAB.t = 0; } }
    else if (P === 'hold') { if (LAB.t > 1.0) LAB.phase = 'lift'; }
    else if (P === 'lift' || P === 'done') { if (LEG.visible) { LEG.position.y += 12 * dt; if (LEG.position.y > HEAD_TOP + 30) LEG.visible = false; } }
  } else if (LAB.machine === 'anvil') {
    if (P === 'fall') {
      LAB.v -= 9.8 * dt; ANVIL.position.y += LAB.v * dt;
      if (ANVIL.position.y <= HEAD_TOP - 0.2) {
        const h = LAB.h; ANVIL_RING.visible = false; tone(80, 30, 0.4, 'sine', 0.4); clank(12); if (!reduceMotion) shake = Math.min(0.9, 0.25 + h * 0.008);
        burst(new V3(0, HEAD_TOP, 0), 50, SPARK, 6);
        if (h < 3) { LAB.phase = 'bounce'; LAB.v = 3; LAB.vx = 2.5; lastPop = 0; pop('BONK!', 'green'); setFace('hit', 1500); crouch = 1; landImpact(6); labFinish('survived'); }
        else if (h < 12) { LAB.phase = 'drop2'; labLose(1); if (!head.userData.detached) labLose(1); lastPop = 0; pop('HEAD OFF!', 'lilac'); labFinish('lost ' + LAB.lost + (LAB.lost === 1 ? ' part' : ' parts')); }
        else { labCrash('anvil'); LAB.phase = 'drop2'; if (h > 35) { labPancake(); LAB.text = 'flattened into a pancake'; } else { labScatter(0.8 + h / 50, 0.5); LAB.text = 'smashed to pieces'; } }
      }
    } else if (P === 'drop2' || (P === 'done' && ANVIL.position.y > STAND_H + 0.01 && !LAB.vx)) { LAB.v -= 9.8 * dt; ANVIL.position.y = Math.max(STAND_H, ANVIL.position.y + LAB.v * dt); if (ANVIL.position.y <= STAND_H) LAB.v = 0; }
    else if (P === 'bounce' || (P === 'done' && LAB.vx)) { LAB.v -= 9.8 * dt; ANVIL.position.y += LAB.v * dt; ANVIL.position.x += LAB.vx * dt; const fl = floorAt(ANVIL.position.x, ANVIL.position.z); if (ANVIL.position.y <= fl) { ANVIL.position.y = fl; LAB.v = 0; LAB.vx *= 0.8; if (Math.abs(LAB.vx) < 0.2) LAB.vx = 0; } }
  }
}
function labPose(t) {
  if (LAB.machine === 'bollard') { if (!RAGSIM) { rider.position.copy(board.position); rider.rotation.set(0, 0, 0); poseBody(t); } return; }
  rider.position.set(R.x, R.y, 0); rider.rotation.set(0, LAB_YAW, 0);
  let P;
  if (LAB.phase === 'air') { rootQ.setFromEuler(new THREE.Euler(LAB.spin * 0.7, LAB.spin * 0.4, LAB.spin * 0.2)); P = flailPose(t * 1.4); }
  else {
    rootQ.identity();
    const sc = LAB.phase === 'charge' || LAB.phase === 'drop' || LAB.phase === 'fall' ? 1 : 0, happy = LAB.text === 'survived' ? 1 : 0, br = Math.sin(t * 2) * 0.025;
    crouchV += ((0.3 - crouch) * 90 - crouchV * 11) * (1 / 60); crouch = clamp(crouch + crouchV / 60, 0.1, 1.05);
    const c = Math.max(0, crouch - 0.3);
    P = { pelvis: [0, 0, 0], torso: [0.05 + br + c * 0.5, 0, 0], head: [-0.05 - sc * 0.35, Math.sin(t * 0.7) * 0.25 * (1 - sc), 0],
      upperL: [0.1 + sc * 0.4, 0, SIDE.L * (0.25 + sc * 0.8 + happy * 2.3)], upperR: [0.1 + sc * 0.4, 0, SIDE.R * (0.25 + sc * 0.8 + happy * 2.3)],
      foreL: [0.3 + sc * 1.1, 0, 0], foreR: [0.3 + sc * 1.1, 0, 0], thighL: [-c * 0.9, 0, 0], thighR: [-c * 0.9, 0, 0], shinL: [c * 1.6, 0, 0], shinR: [c * 1.6, 0, 0] };
  }
  rootPos.set(0, -Math.max(0, crouch - 0.3) * 0.25, 0); runFK(P); applyFK();
}
function labCam(now, dt) {
  if (LAB.replay) return labReplayCam();
  const T = torso.getWorldPosition(new V3()), m = LAB.machine;
  if (m === 'bollard') {
    if (!RAGSIM) { const z = board.position.z; wantPos.set(LAB_LANE + 3.2, 1.25, z + 2.4); wantLook.set(LAB_LANE, 0.9, z - 2.2); return 30; } // a tracking shot beside the cart
    // follow the body; while it is near the post keep the cart in the shot too
    const c = RAGSIM.core, k = RAGSIM.I.pel * 3, px = c.x[k], py = c.x[k + 1], pz = c.x[k + 2], far = clamp((BOLLARD_Z - pz) / 15, 0, 1);
    const fz = lerp((pz + BOLLARD_Z) / 2, pz, far), d = 3.6 + Math.min(5, Math.abs(pz - BOLLARD_Z) * 0.18) * (1 - far) + far * 1.2;
    wantPos.set(LAB_LANE + d, 1.1 + Math.max(0, py - 1) * 0.6 + d * 0.08, fz + 2.2); wantLook.set(lerp(LAB_LANE, px, 0.6), Math.max(0.7, py * 0.8), fz); return 5;
  }
  const face = new V3(Math.sin(LAB_YAW + Math.atan2(FACE_N ? FACE_N.x : 0, FACE_N ? FACE_N.z : 1)), 0, Math.cos(LAB_YAW + Math.atan2(FACE_N ? FACE_N.x : 0, FACE_N ? FACE_N.z : 1)));
  const side = new V3(face.z, 0, -face.x);
  if (m === 'fart' && LAB.phase === 'air') { const y = T.y; wantPos.copy(face).multiplyScalar(6 + Math.min(40, y * 0.25)).addScaledVector(side, 2).setY(Math.max(1.6, Math.min(y * 0.55, y - 2))); wantLook.set(T.x, y, T.z); return 6; }
  if (m === 'sock' && LEG && LEG.visible) { const k = LEG.scale.x, dist = 5.5 + k * 1.6; wantPos.copy(face).multiplyScalar(dist).addScaledVector(side, 1.6).setY(STAND_H + 1.8 + k * 0.6); wantLook.set(0, Math.min(LEG.position.y, HEAD_TOP + 4 * k) * 0.45 + STAND_H * 0.55 + 0.6, 0); return 4; }
  if (m === 'anvil' && ANVIL.visible && LAB.phase === 'fall') { const ay = ANVIL.position.y, d = 5.5 + Math.min(12, LAB.h * 0.1); wantPos.copy(face).multiplyScalar(d).addScaledVector(side, 1.8).setY(STAND_H + 1.2); wantLook.set(0, Math.min(ay, HEAD_TOP + 14) * 0.6 + (STAND_H + 1.2) * 0.4, 0); return 5; }
  const sway = Math.sin(now / 2600) * 0.6;
  wantPos.copy(face).multiplyScalar(5.2).addScaledVector(side, 1.6 + sway).setY(STAND_H + 1.7); wantLook.set(0, STAND_H + 1.15, 0); return 3;
}
function labDone() {
  if (!labBuilt) return;
  const survived = LAB.text === 'survived' || LAB.text === 'stayed in the cart', lost = LAB.machine === 'bollard' ? 0 : cause ? 15 : LAB.lost;
  $('labRes').innerHTML = '';
  const b = document.createElement('b'); b.textContent = 'LEVEL ' + LAB.level + ' · ' + LAB_INFO[LAB.machine].title + ': ';
  $('labRes').append(b, document.createTextNode(survived ? 'SURVIVED' : (LAB.text || 'destroyed') + (lost ? ' (' + lost + '/15 parts off)' : '')));
  $('labPanel').hidden = false; labUI();
  lastPop = 0; pop(survived ? 'SURVIVED!' : lost >= 15 ? 'DESTROYED!' : 'DAMAGED!', survived ? 'green' : 'lilac');
}

setLoad(1, 'Ready');
{ const note = CACHE_NOTE || (window.__cacheHit ? 'Loaded from this device' : 'Downloaded (saved for next time)');
  const el = document.createElement('div'); el.className = 'cachenote'; el.textContent = note; stage.appendChild(el); setTimeout(() => el.remove(), 1800);
  setTimeout(() => { if (!window.__cacheHit && window.__savedOk === false) { const e2 = document.createElement('div'); e2.className = 'cachenote'; e2.textContent = 'Could not save Daggie on this device (the app blocks storage).'; stage.appendChild(e2); setTimeout(() => e2.remove(), 5000); } }, 4500); }
resetRun();
try { renderer.compile(scene, camera); } catch (e) {}
setTimeout(() => $('loader').classList.add('gone'), 250);
requestAnimationFrame(frame);
