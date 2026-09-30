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
const TH = L.theme || 'sky', VEH = L.vehicle || 'skate'; // world look and what Daggie rides
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
const SAW_S = L.bigSaw.s, BIG_R = L.bigSaw.r, BIG_Y = L.bigSaw.y;
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
function floorAt(x, z) { const h = trackH(-z); if (h === null || Math.abs(x) > HALF) return -90; return h; }
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
for (const sd of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 80, 0.6), darkSteel); arm.position.set(sd * 1.2, BIG_Y - 40, -SAW_S + 0.4); scene.add(arm); }
const chev = tex(128, 128, (g) => { g.clearRect(0, 0, 128, 128); g.strokeStyle = '#27e0ff'; g.lineWidth = 16; g.lineCap = 'round'; g.lineJoin = 'round'; for (const y of [42, 90]) { g.beginPath(); g.moveTo(22, y + 22); g.lineTo(64, y - 16); g.lineTo(106, y + 22); g.stroke(); } });
const BOOSTS = L.boosts.map(([s, x]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshBasicMaterial({ map: chev, transparent: true, color: glowColor(0xffffff, 1.8), depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, -s); scene.add(m); return { s, x, used: false }; });

// ---------- real skateboard: kicktail deck, grip, graphic, trucks, wheels ----------
const board = new THREE.Group(); scene.add(board);
const wheels = [];
if (VEH === 'cart') buildCart(); else {
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
  const bar = (x0, yy0, z0, x1, yy1, z1, r = 0.011) => { const a = new V3(x0, yy0, z0), b = new V3(x1, yy1, z1), len = a.distanceTo(b); if (len < 1e-4) return; const gg = new THREE.CylinderGeometry(r, r, len, 6, 1); gg.translate(0, len / 2, 0); gg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize())); gg.translate(a.x, a.y, a.z); geos.push(gg); };
  for (let i = 0; i <= 11; i++) { const t = i / 11; for (const sd of [-1, 1]) bar(sd * W / 2, y0, lerp(zf0, zb0, t), sd * (W / 2 + 0.03), y1, lerp(zf1, zb1, t)); }
  for (let i = 0; i <= 8; i++) { const x = lerp(-W / 2, W / 2, i / 8); bar(x, y0, zf0, x * 1.09, y1, zf1); bar(x, y0, zb0, x * 1.09, y1, zb1); }
  for (const t of [0, 0.34, 0.67, 1]) { const y = lerp(y0, y1, t), zf = lerp(zf0, zf1, t), zb = lerp(zb0, zb1, t), hw = lerp(W / 2, W / 2 + 0.03, t); bar(-hw, y, zf, hw, y, zf, 0.013); bar(-hw, y, zb, hw, y, zb, 0.013); bar(-hw, y, zf, -hw, y, zb, 0.013); bar(hw, y, zf, hw, y, zb, 0.013); }
  for (let i = 0; i <= 8; i++) { const x = lerp(-W / 2, W / 2, i / 8); bar(x, y0, zf0, x, y0, zb0, 0.009); }
  for (let i = 0; i <= 10; i++) { const z = lerp(zf0, zb0, i / 10); bar(-W / 2, y0, z, W / 2, y0, z, 0.009); }
  for (const sd of [-1, 1]) { bar(sd * 0.27, 0.15, -0.44, sd * 0.27, 0.15, 0.52, 0.018); bar(sd * 0.27, 0.15, 0.52, sd * 0.3, y0, zb0, 0.016); bar(sd * 0.27, 0.15, -0.44, sd * 0.28, y0, zf0 + 0.04, 0.016); bar(sd * (W / 2 + 0.03), y1, zb1, sd * (W / 2 + 0.02), y1 + 0.1, zb1 + 0.14, 0.014); }
  const cage = new THREE.Mesh(mergeGeometries(geos), chrome); cage.castShadow = true; g.add(cage);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W + 0.12, 14), red); handle.rotation.z = Math.PI / 2; handle.position.set(0, y1 + 0.1, zb1 + 0.14); handle.castShadow = true; g.add(handle);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.02, 0.24), red); flap.position.set(0, y1 - 0.05, zb1 - 0.13); flap.rotation.x = -0.45; g.add(flap);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), sign('CRASH MART', '#e0322b', '#ffffff', 384, 128)); plate.position.set(0, y1 - 0.13, zf1 - 0.01); plate.rotation.y = Math.PI; g.add(plate);
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
  lastPop = 0; pop({ saw: 'ZZZT!', big: 'SHREDDED!', hurdle: 'FACEPLANT!', ball: 'WRECKED!', press: 'SQUISH!', barrel: 'STRIKE!', cart: 'CART CRASH!', sweeper: 'SWEPT!', wall: 'BONK!', spikes: 'OUCH!', wear: 'FALLING APART!' }[kind] || 'CRASH!', 'green');
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
function OUT() { if (!MASTER) { MASTER = AC.createGain(); MASTER.connect(AC.destination); try { AUDIO_DEST = AC.createMediaStreamDestination(); MASTER.connect(AUDIO_DEST); } catch (e) { AUDIO_DEST = null; } } return MASTER; }
function initAudio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } else if (AC.state === 'suspended') AC.resume(); }
function tone(f0, f1, dur, type, vol, delay) {
  recEvt('t', [f0, f1, dur, type, vol, delay || 0]);
  if (!AC) return;
  const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(OUT()); o.start(t); o.stop(t + dur + 0.03);
}
let lastClank = 0;
function clank(v) { const now = performance.now(); if (now - lastClank < 60) return; lastClank = now; tone(rand(500, 900), rand(200, 300), 0.12, 'triangle', Math.min(0.12, 0.02 + v * 0.02)); }

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
  const FXR = new Float32Array([ANVIL.visible ? 1 : 0, ANVIL.position.x, ANVIL.position.y, ANVIL.position.z, ANVIL_RING.visible ? 1 : 0, ...RAIN.flatMap(r => r.on ? [r.m.position.x, r.m.position.y, r.m.position.z] : [])]);
  REC.frames.push({ FXR, FL, GX, DR, dt: REC.acc, st: STATE_CODE[state] ?? 1, face: faceMode, simT, P, B, bar, con, tnt, spr, deb: new Float32Array(deb), drp: new Float32Array(drp), spl: new Float32Array(spl), ev: REC.cur, hp: HP });
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
  PLAY = { wantRec: !!record, rec, t: 0, i: 0, fired: -1, fromResult, ...planShots(rec), shotI: -1, fixed: new V3(), orbitA: 0, slowUntil: 0, slowAt: -1, replayed: false, zoom: 0 };
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
  const back = PLAY.fromResult; PLAY = null; $('hook').classList.remove('show');
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
  BIG.rotation.z = -6 * simT;
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
  resetPower(); randomGates(); resetFlock(); resetFx();
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
  recStart(); REC.test = testNo; REC.trick = trick.name; REC.gates = GATE_LAYOUT.map(a => a.slice());
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
  BB.free = true; BB.v.copy(vel).multiplyScalar(0.8).add(new V3(rand(-2, 2), rand(2, 4), 0)); BB.w.set(rand(-12, 12), rand(-6, 6), rand(-12, 12));
  spawnDebris(center, jw, vel);
  if (kind === 'bones') { burst(center, 60, CONF, 8); for (let i = 0; i < 6; i++) tone(rand(600, 1100), rand(300, 500), 0.08, 'square', 0.05, i * 0.07); }
  burst(center, 70, SPARK, 10); burst(center, 30, CONF, 6);
  setFace('hit', 1500);
  slowUntil = now + (reduceMotion ? 500 : 1600); slowK = 0.22;
  if (!reduceMotion) shake = 0.5;
  pop({ saw: 'ZZZT!', big: 'SHREDDED!', fall: 'NOOO!', hurdle: 'FACEPLANT!', ball: 'WRECKED!', press: 'SQUISH!', barrel: 'STRIKE!', cart: 'CART CRASH!', sweeper: 'SWEPT!', wall: 'BONK!', spikes: 'OUCH!', wear: 'FALLING APART!', bones: 'BONES EVERYWHERE!', anvil: 'FLATTENED!', gap: 'SPLAT!' }[kind] || 'CRASH!', kind === 'fall' ? 'lilac' : 'green');
  tone(140, 40, 0.45, 'sine', 0.3); tone(1500, 300, 0.25, 'sawtooth', 0.06); tone(700, 200, 0.2, 'triangle', 0.08, 0.06);
  orbitA = Math.atan2(camera.position.x - center.x, camera.position.z - center.z);
}
function passed() {
  state = 'passed'; stateT = performance.now();
  setFace('happy', 99999); const nf = flockCount(); pop(nf > 1 ? nf + ' SURVIVED!' : 'HE SURVIVED!', 'green');
  for (let i = 0; i < 4; i++) setTimeout(() => burst(rider.position.clone().add(new V3(rand(-2, 2), 3, rand(-3, 1))), 60, CONF, 7), i * 250);
  tone(660, 1320, 0.3, 'square', 0.05); tone(880, 1760, 0.3, 'square', 0.04, 0.15);
}
function showResult() {
  state = 'result';
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
  $('rCause').textContent = ok ? 'Nothing. He made it!' : ({ saw: 'Saw blade', big: 'The giant saw', fall: 'The drop', hurdle: 'The hurdle', ball: 'Wrecking ball', press: 'The crusher', barrel: 'Rolling barrel', cart: 'An oncoming cart', sweeper: 'Sweeper arm', wall: 'Sliding wall', spikes: 'Spikes', wear: 'Too many hits', bones: 'Skeleton fell apart', anvil: 'A falling anvil', gap: 'Missed the jump' }[cause] || cause);
  $('result').hidden = false;
}
function landImpact(v) { crouchV += Math.min(4.5, v * 0.35); }


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
    if (R.s > LAND0 && cause === '') { R.speed *= Math.pow(0.35, dt); if (R.s > LAND0 + 4 && !R.passedFlag) { R.passedFlag = true; passed(); } }
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
  if (Math.abs(R.s - SAW_S) < 0.5) {
    const yy = clamp(BIG_Y, bodyY0, bodyY1), d = Math.hypot(Math.max(0, Math.abs(R.x) - 0.34), yy - BIG_Y);
    if (d < BIG_R) { crash('big'); return; }
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
    if (board.position.y < fl + 0.06 && board.position.y > fl - 0.8) { board.position.y = fl + 0.06; if (BB.v.y < 0) BB.v.y *= -0.35; BB.v.x *= 0.9; BB.v.z *= 0.9; BB.w.multiplyScalar(0.8); }
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
  if (state === 'ride' && R.grounded) { R.grounded = false; R.vy = R.speed * R.slope + 7.2 * FX.jump; crouchV -= 3; if (FORM.kind === 'skeleton') tone(900, 500, 0.1, 'square', 0.05); tone(300, 700, 0.15, 'triangle', 0.05); setFace('wow', 700); }
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
  const b = rider.position;
  if (state === 'intro') { wantPos.set(3.8, Math.max(2.5, b.y * 0.55 + 2.6), b.z + 7.5); wantLook.set(0, b.y * 0.85 + 0.8, b.z - 8); return 5; }
  if (state === 'ride') {
    if (!R.grounded && R.s > RAMP1 - 1) { wantPos.set(b.x + 12, b.y + 2.2, b.z + 3.5); wantLook.set(b.x, b.y + 1, b.z - 3); return 3; }
    const fb = FLOCK.filter(f => f.state === 'ride').length, back = fb > 2 ? 4.2 : fb > 0 ? 2 : 0;
    wantPos.set(b.x * 0.7, b.y + 3.2 + back * 0.4, b.z + 6.6 + back); wantLook.set(b.x * 0.85, b.y + 1.3, b.z - 9); return 7;
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
  BIG.rotation.z -= 6 * sdt;
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
  if (state === 'ride' || state === 'passed') {
    const n = Math.min(8, Math.max(1, Math.ceil(sdt * 120 - 1e-6))), h = sdt / n;
    for (let k = 0; k < n; k++) { stepRide(h, now); if (state !== 'ride' && state !== 'passed') break; }
    stepDebris(sdt, now);
    if (state === 'ride' && now > faceUntil) setFace(!R.grounded ? 'wow' : R.speed > 25 ? 'scared' : 'idle');
    if (state === 'ride' && t > 1.4) $('hook').classList.remove('show');
    if (state === 'passed' && t > 3.2) showResult();
  }
  if (state === 'intro' || state === 'ride' || state === 'passed') { placeRider(simT); poseBody(simT); }
  if (state === 'crashed' || (state === 'result' && cause !== '')) {
    const n = Math.min(8, Math.max(1, Math.ceil(sdt * 120 - 1e-6))), h = sdt / n;
    for (let k = 0; k < n; k++) { stepParts(h); stepDebris(h, now); }
    if (state === 'crashed' && now > faceUntil) setFace((now - stateT) > 2500 ? ((Math.floor(now / 2000) % 2) ? 'okq' : 'worried') : 'scared');
    if (state === 'crashed' && now - stateT > 2800) showResult();
  }
  stepFlock(sdt);
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
setLoad(1, 'Ready');
{ const note = CACHE_NOTE || (window.__cacheHit ? 'Loaded from this device' : 'Downloaded (saved for next time)');
  const el = document.createElement('div'); el.className = 'cachenote'; el.textContent = note; stage.appendChild(el); setTimeout(() => el.remove(), 1800);
  setTimeout(() => { if (!window.__cacheHit && window.__savedOk === false) { const e2 = document.createElement('div'); e2.className = 'cachenote'; e2.textContent = 'Could not save Daggie on this device (the app blocks storage).'; stage.appendChild(e2); setTimeout(() => e2.remove(), 5000); } }, 4500); }
resetRun();
try { renderer.compile(scene, camera); } catch (e) {}
setTimeout(() => $('loader').classList.add('gone'), 250);
requestAnimationFrame(frame);
