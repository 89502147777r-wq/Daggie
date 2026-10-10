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
const BODY = L.body || VEH; // 'car': the cart's mesh is swapped for a little race car (it rides like the cart: Daggie sits in it)
const VMAX = L.vmax || 34, ACCEL = L.accel || 0; // top speed (m/s) and extra push per second: CAR levels keep getting faster
const SLOPE_K = L.slopeK || 0.8; // how hard a downhill pulls (the skyscraper ramp pulls harder: about 200 mph at the bottom)
const RUSH = !!L.rush; // speed show: speed lines, a big speedometer, rumble and mph milestones
// HD look (level option hd: true): a real car model, HDRI light and reflections, scanned PBR surfaces, a body that crumples where it is hit.
// Car: "Car Concept" by Eric Chadwick, Darmstadt Graphics Group GmbH, CC BY 4.0 (KhronosGroup glTF-Sample-Assets), roof and logos removed for the game.
// Light: "Venice Sunset" HDRI from Poly Haven (CC0). Files: car-concept.bin (gzipped glb), venice_sunset_1k.hdr, tex/*.jpg
const HD_ASSETS = { car: 'car-concept.bin?v=1', hdr: 'venice_sunset_1k.hdr?v=1' };
const HD_LOAD = L.hd ? (async () => {
  const [{ GLTFLoader }, { RGBELoader }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/RGBELoader.js')]);
  const car = (async () => { const res = await fetch(HD_ASSETS.car); if (!res.ok) throw new Error('car HTTP ' + res.status); const buf = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); return new GLTFLoader().parseAsync(buf, ''); })();
  const [gl, env, maps] = await Promise.all([car, new RGBELoader().loadAsync(HD_ASSETS.hdr), hdMaps()]);
  return { car: gl.scene, env, maps };
})() : null;
if (HD_LOAD) HD_LOAD.catch(() => {}); // a failed download falls back to the old look (handled where it is awaited)
var CREC = { on: false, t: 0, frames: [], ev: [], play: null }; // instant replay of the wall cannon: Daggie per frame, plus a time-stamped log of everything else
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const PR_MAX = Math.min(3, window.devicePixelRatio || 1), AUTO_MAX = Math.min(2.0, PR_MAX); let PR = AUTO_MAX;
renderer.setPixelRatio(PR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.74;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 5000);
const msaaOK = (() => { // can this device render the post-processing chain with 4x multisampling in half float? asked of the graphics driver itself before it is used
  try { const gl = renderer.getContext(); if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) return false; if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return false;
    while (gl.getError() !== gl.NO_ERROR) { /* clear old errors */ } const rb = gl.createRenderbuffer(), fb = gl.createFramebuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RGBA16F, 32, 32); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE && gl.getError() === gl.NO_ERROR; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb); return ok; } catch (e) { return false; } })();
const composer = new EffectComposer(renderer, msaaOK ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }) : undefined);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), MODE === 'lab' ? 0.09 : 0.15, 0.3, MODE === 'lab' ? 1.3 : 1.0); { const bs = bloomPass.setSize.bind(bloomPass); bloomPass.setSize = (w, h) => bs(Math.max(64, Math.floor(w * 0.5)), Math.max(64, Math.floor(h * 0.5))); }
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
// colour grade: punchier contrast and saturation so the feed thumbnail pops
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, sat: { value: 1.32 }, con: { value: 1.12 }, bri: { value: 0.01 }, curve: { value: 0 }, vig: { value: 0 }, soft: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float sat, con, bri, curve, vig, soft; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); vec3 col; if (soft > 0.5) { col = max(mix(vec3(l), c.rgb, sat), 0.0); float m1 = max(col.r, max(col.g, col.b)); if (m1 > 1.0) col /= m1; vec3 sc = col * col * (3.0 - 2.0 * col); col = mix(col, sc, clamp((con - 1.0) * 2.0, 0.0, 1.0)); col = col + bri * (1.0 - col); } else { col = mix(vec3(l), c.rgb, sat); float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b)); col = mix(vec3(dot(col, vec3(0.333))), col, 1.0 + 0.25 * (1.0 - (mx - mn))); col = (col - 0.5) * con + 0.5 + bri; vec3 cc = clamp(col, 0.0, 1.0); col = mix(col, cc * cc * (3.0 - 2.0 * cc), curve); } col *= 1.0 - vig * smoothstep(0.38, 0.9, distance(vUv, vec2(0.5))); gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }' });
composer.addPass(grade);

// the last pass: a gentle sharpen of the brightness only (hue untouched, never past the neighbours' own range: no halos, no coloured fringes); with MSAA there is no extra anti-aliasing at all, without it a light edge-only blend
const FXAA_FRAG = ['uniform sampler2D tDiffuse; uniform vec2 px; uniform float aa; varying vec2 vUv;',
  'void main(){ vec3 luma = vec3(0.2126, 0.7152, 0.0722);',
  ' vec3 m = texture2D(tDiffuse, vUv).xyz; vec3 cN = texture2D(tDiffuse, vUv - vec2(0.0, px.y)).xyz; vec3 cS = texture2D(tDiffuse, vUv + vec2(0.0, px.y)).xyz; vec3 cW = texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).xyz; vec3 cE = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).xyz;',
  ' float lM = dot(m, luma), lN = dot(cN, luma), lS = dot(cS, luma), lW = dot(cW, luma), lE = dot(cE, luma);',
  ' vec3 col = m;',
  ' if (aa > 0.5) { float lMin = min(lM, min(min(lN, lS), min(lW, lE))), lMax = max(lM, max(max(lN, lS), max(lW, lE)));',
  '  if (lMax - lMin > max(0.06, lMax * 0.18)) { float wH = abs(lW - lE), wV = abs(lN - lS); vec3 a = wH > wV ? 0.5 * (cN + cS) : 0.5 * (cW + cE); col = mix(m, 0.5 * (m + a), 0.55); } }',
  ' float lAvg = 0.25 * (lN + lS + lW + lE), lMn = min(min(lN, lS), min(lW, lE)), lMx = max(max(lN, lS), max(lW, lE));',
  ' float l0 = dot(col, luma); float l1 = l0 + (l0 - lAvg) * 0.36; l1 = clamp(l1, min(lMn, l0), max(lMx, l0));',
  ' col = col * (l1 / max(l0, 0.0001));',
  ' gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0); }'].join('\n');
const fxaa = new ShaderPass({ uniforms: { tDiffuse: { value: null }, px: { value: new THREE.Vector2(1 / 800, 1 / 1600) }, aa: { value: msaaOK ? 0 : 1 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: FXAA_FRAG });
composer.addPass(fxaa);
const LAB0 = MODE === 'lab'; if (LAB0) { grade.uniforms.sat.value = 1.42; grade.uniforms.con.value = 1.04; grade.uniforms.bri.value = -0.01; grade.uniforms.curve.value = 0.65; grade.uniforms.vig.value = 0.4; renderer.toneMappingExposure = 0.58; }
// "Rec mode" (for iPhone screen recording): punchier picture, no UI while riding, lighter shadows for smoothness
let REC_MODE = false; try { REC_MODE = localStorage.getItem('daggie-recmode') === '1'; } catch (e) {} if (MODE === 'lab') REC_MODE = false; /* the lab has no recording look any more */
const LAB_LOOK = MODE === 'lab'; // the crash lab: darker, contrastier, richer colour, no blown highlights
// three colour looks (saturated colour is what compression smears first, so the default is a notch calmer than before; VIVID is the old picture)
const LOOKS = { lab: [{ n: 'NATURAL', sat: 1.12, con: 1.05, bri: 0, curve: 0.35, vig: 0.22, exp: 0.62, rsat: 1.2, rexp: 0.65 }, { n: 'BALANCED', sat: 1.26, con: 1.06, bri: 0, curve: 0.55, vig: 0.32, exp: 0.6, rsat: 1.34, rexp: 0.64 }, { n: 'VIVID', sat: 1.42, con: 1.04, bri: -0.01, curve: 0.65, vig: 0.4, exp: 0.58, rsat: 1.5, rexp: 0.62 }, { n: 'CLEAN', sat: 1.12, con: 1.06, bri: 0, curve: 0, vig: 0.16, exp: 0.62, rsat: 1.18, rexp: 0.64, soft: 1, noBloom: 1 }],
  run: [{ n: 'NATURAL', sat: 1.1, con: 1.06, bri: 0, curve: 0, vig: 0, exp: 0.74, rsat: 1.2, rcon: 1.1, rbri: 0.02, rexp: 0.84 }, { n: 'BALANCED', sat: 1.22, con: 1.09, bri: 0.01, curve: 0, vig: 0, exp: 0.75, rsat: 1.36, rcon: 1.13, rbri: 0.025, rexp: 0.86 }, { n: 'VIVID', sat: 1.32, con: 1.12, bri: 0.01, curve: 0, vig: 0, exp: 0.74, rsat: 1.6, rcon: 1.18, rbri: 0.03, rexp: 0.9 }, { n: 'CLEAN', sat: 1.1, con: 1.06, bri: 0.01, curve: 0, vig: 0, exp: 0.75, rsat: 1.18, rcon: 1.1, rbri: 0.02, rexp: 0.84, soft: 1, noBloom: 1 }] };
const LOOK_I = 1; /* BALANCED, fixed */
const LK = () => LOOKS[LAB_LOOK ? 'lab' : 'run'][LOOK_I];
const GSAT = () => { const k = LK(); return REC_MODE ? (k.rsat || k.sat) : k.sat; };
function applyRecMode() {
  { const k = LK(); grade.uniforms.sat.value = GSAT(); grade.uniforms.con.value = LAB_LOOK ? k.con : REC_MODE ? k.rcon : k.con; grade.uniforms.bri.value = LAB_LOOK ? k.bri : REC_MODE ? k.rbri : k.bri; grade.uniforms.curve.value = k.curve; grade.uniforms.vig.value = k.vig; grade.uniforms.soft.value = k.soft ? 1 : 0; bloomPass.enabled = !k.noBloom; renderer.toneMappingExposure = (REC_MODE ? k.rexp : k.exp) * ((typeof LOC !== 'undefined' && LOC && LOC.exp) || 1); }
  const ms = 2048;
  if (typeof sunLight !== 'undefined' && sunLight.shadow.mapSize.x !== ms) { sunLight.shadow.mapSize.set(ms, ms); if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; } }
  document.getElementById('stage').classList.toggle('recmode', REC_MODE);
  if (typeof resize === 'function' && typeof camera !== 'undefined') try { resize(); } catch (e) {}
}
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const glowColor = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
function neon(hex, k) { return new THREE.MeshBasicMaterial({ color: glowColor(hex, k) }); }

// ---------- sky, sun, clouds ----------
const SUN = new V3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(TH === 'city' ? 77 : 58), THREE.MathUtils.degToRad(TH === 'city' ? 22 : 35));
function makeSky() { const s = new Sky(); s.scale.setScalar(4000); const u = s.material.uniforms; u.turbidity.value = TH === 'city' ? 7 : 2.0; u.rayleigh.value = TH === 'city' ? 2.6 : 1.7; u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.8; u.sunPosition.value.copy(SUN); return s; }
const SKY = makeSky(); scene.add(SKY);
{ const envScene = new THREE.Scene(); envScene.add(makeSky()); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0).texture; }
scene.fog = TH === 'city' ? new THREE.Fog(0xe9b996, 170, 1300) : new THREE.Fog(0xcbe0f6, 520, 2600);
const hemi = new THREE.HemisphereLight(0xcfe6ff, MODE === 'lab' ? 0x5a6070 : 0x9aa3b5, MODE === 'lab' ? 0.45 : 0.85); scene.add(hemi); // the lab: less fill light, so shadows stay deep
const sunLight = new THREE.DirectionalLight(TH === 'city' ? 0xffc48a : 0xfff1dc, TH === 'city' ? 3.3 : MODE === 'lab' ? 2.7 : 3.8);
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
    const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 11; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
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
let HDA = null; // the HD assets, once loaded (null: the normal look)
if (HD_LOAD) { setLoad(0.9, 'Loading the car…'); try { HDA = await HD_LOAD; } catch (e) { console.warn('HD assets failed, using the normal look', e); } }
if (HDA) { hdEnvironment(); // credits on the loading screen (it goes away with it, so it never ends up in a recorded video)
  const l = $('loader'), c = document.createElement('div'); c.textContent = 'Car: “Car Concept” by Eric Chadwick, Darmstadt Graphics Group, CC BY 4.0 (Khronos glTF Sample Assets, modified) · HDRI: Poly Haven, CC0';
  c.style.cssText = 'position:absolute;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 42px);text-align:center;font:500 11px/1.35 ui-sans-serif,system-ui,sans-serif;color:rgba(25,35,70,.62);pointer-events:none;z-index:5'; if (l) l.appendChild(c); }
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
const bodyTex = new THREE.Texture(); bodyTex.flipY = false; bodyTex.colorSpace = THREE.SRGBColorSpace; bodyTex.anisotropy = 16;
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
const HAS_BIG = FINALE === 'saw'; // 'ring' and 'lava' finales have no giant saw
const SAW_S = L.bigSaw.s, BIG_R = L.bigSaw.r, BIG_Y = HAS_BIG ? L.bigSaw.y : -200;
const LAVA = (L.lava || []).map(a => a.slice()); if (FINALE === 'lava') LAVA.push([RAMP1, LAND0]); // lava pits; the 'lava' finale floods the last gap
const GAPS = [...L.track.gaps, ...(L.lava || [])].sort((a, b) => a[0] - b[0]);
const inLava = s => LAVA.some(([a, b]) => s > a && s < b);
// mega ramp drop-in (level option track.drop = { h, s0, s1 }): a high start deck that curves down to the runway
const DROP = L.track.drop || null;
function dropH(s) { if (!DROP || s >= DROP.s1) return 0; if (s <= DROP.s0) return DROP.h; const t = (s - DROP.s0) / (DROP.s1 - DROP.s0); return DROP.h * (1 + Math.cos(Math.PI * t)) / 2; }
const START_H = dropH(-13.5); // the drone drops Daggie from this high (0 on normal levels)
function trackH(s) {
  if (s < -14) return null;
  for (const g of GAPS) if (s > g[0] && s < g[1]) return null;
  if (s <= RAMP0) return dropH(s);
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
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 12 + (Math.random() < 0.01 ? 22 : 0); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  g.fillStyle = '#f4f4ee';
  g.fillRect(w * 0.035, 0, w * 0.018, h); g.fillRect(w * 0.947, 0, w * 0.018, h);
  for (const u of [1 / 3, 2 / 3]) for (let y = 0; y < h; y += 256) g.fillRect(w * u - 5, y + 30, 10, 150);
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (const u of [0.2, 0.5, 0.8]) g.fillRect(w * u - 18, 0, 36, h);
});
asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
const roadMat = new THREE.MeshStandardMaterial({ map: TH === 'city' ? roofTex() : asphalt, roughness: 0.88, metalness: 0.02 });
// HD: asphalt tiled every 3 m (road UVs in metres), painted lines as their own strips so they stay crisp
const HD_ROAD = HDA ? hdMat('asphalt', [1 / 3, 1 / 3]) : null;
const HD_PAINT = HD_ROAD ? [0xf1f0ea, 0xffc21a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })) : null;
function hdLines(s0, s1) {
  const geo = [[], []], quad = (k, x, w, a, b) => { const P = geo[k]; for (let s = a; s < b - 1e-6; s += 0.5) { const e = Math.min(b, s + 0.5), h0 = (trackH(Math.min(s, s1 - 1e-3)) ?? 0) + 0.006, h1 = (trackH(Math.min(e, s1 - 1e-3)) ?? 0) + 0.006; P.push(x - w, h0, -s, x + w, h0, -s, x - w, h1, -e, x + w, h0, -s, x + w, h1, -e, x - w, h1, -e); } };
  for (const sd of [-1, 1]) quad(1, sd * (HALF - 0.37), 0.075, s0, s1);
  for (const x of [-HALF / 3, HALF / 3]) for (let a = Math.ceil(s0 / 3) * 3 + 0.4; a < s1; a += 3) quad(0, x, 0.06, a, Math.min(s1, a + 1.8));
  geo.forEach((P, k) => { if (!P.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, HD_PAINT[k]); m.receiveShadow = true; scene.add(m); });
}
const steel = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.85, roughness: 0.35 });
const darkSteel = new THREE.MeshStandardMaterial({ color: 0x3b3f47, metalness: 0.7, roughness: 0.5 });
const stripeTex = tex(256, 64, (g, w, h) => { g.fillStyle = '#ffc21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#16141c'; for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + h, h); g.lineTo(i * 32 + h, h); g.fill(); } });
stripeTex.wrapS = THREE.RepeatWrapping;
function stripeMat(len) { const t = stripeTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / 1.2, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }); }
function sign(text, bg, fg, w = 512, h = 128) { return new THREE.MeshStandardMaterial({ map: tex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = fg; g.font = '700 ' + Math.round(h * 0.52) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4); }), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.05 }); }
function roadStrip(s0, s1, bare) {
  const pos = [], uv = [], idx = []; let n = 0;
  for (let s = s0; s <= s1 + 1e-6; s += 0.5) { const h = trackH(Math.min(s, s1 - 1e-3)) ?? 0; pos.push(-HALF, h, -s, HALF, h, -s); if (HD_ROAD) uv.push(-HALF, s, HALF, s); else uv.push(0, s / 12, 1, s / 12); if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } n++; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, HD_ROAD || roadMat); m.receiveShadow = true; scene.add(m); if (HD_ROAD) hdLines(s0, s1);
  if (bare) return;
  const L = s1 - s0, mid = (s0 + s1) / 2, flat = !(s0 >= RAMP0 - 1 && s1 <= RAMP1 + 1);
  if (flat && TH === 'city') { // each road piece is the roof of a building; gaps are the alleys between them
    const bw = HALF * 2 + 1.4, bh = 46; const bld = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, L), facadeMat(bw, bh)); bld.position.set(0, -bh / 2 - 0.02, -mid); bld.receiveShadow = true; scene.add(bld);
    const conc = hdMat('concrete', [L / 4, 0.25]) || new THREE.MeshStandardMaterial({ color: 0xa39c94, roughness: 0.9 });
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
// the mega ramp: the drop-in deck and its curve, with side walls that follow the slope and a steel tower under it
function ribbon(s0, s1, yLo, yHi, x, mat) { // a vertical band along the track at x, from trackH + yLo to trackH + yHi
  const pos = [], uv = [], idx = []; let n = 0;
  for (let s = s0; s <= s1 + 1e-6; s += 1) { const h = trackH(Math.min(s, s1 - 1e-3)) ?? 0; pos.push(x, h + yLo, -s, x, h + yHi, -s); uv.push(s / 1.2, 0, s / 1.2, 1); if (n) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } n++; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
}
function megaRamp(s0, s1) {
  roadStrip(s0, s1, true);
  const wallT = stripeTex.clone(); wallT.needsUpdate = true; wallT.wrapS = THREE.RepeatWrapping;
  const wallM = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.55, side: THREE.DoubleSide });
  const under = new THREE.MeshStandardMaterial({ color: 0x3b3f47, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide });
  for (const sd of [-1, 1]) { ribbon(s0, s1, -0.9, 0.55, sd * (HALF + 0.05), wallM); ribbon(s0, s1, -0.9, -0.02, sd * HALF, under);
    const lights = neon(sd < 0 ? 0xff5a3a : 0x27e0ff, 3); for (let s = s0 + 2; s < s1; s += 6) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lights); l.position.set(sd * (HALF + 0.05), (trackH(s) ?? 0) + 0.62, -s); scene.add(l); } }
  { const pos = [], idx = []; let n = 0; // the deck's underside
    for (let s = s0; s <= s1 + 1e-6; s += 1) { const h = (trackH(Math.min(s, s1 - 1e-3)) ?? 0) - 0.9; pos.push(-HALF, h, -s, HALF, h, -s); if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } n++; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); scene.add(new THREE.Mesh(g, under)); }
  // the tower: steel legs from the clouds (or from the street, in the city) up to the deck, with cross bracing
  const legM = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.85, roughness: 0.35 }), GROUND = TH === 'city' ? 46 : 80;
  if (TH === 'city') { // the start deck sits on the roof of a skyscraper
    const bw = 30, bd = 44, top = DROP.h - 0.9, bh = top + 46, sk = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), facadeMat(bw, bh)); sk.position.set(0, top - bh / 2, -(s0 - bd / 2 + 4)); sk.receiveShadow = true; scene.add(sk);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, 0.6, bd + 0.6), hdMat('concrete', [(bw + 0.6) / 4, (bd + 0.6) / 4]) || new THREE.MeshStandardMaterial({ color: 0x8c8780, roughness: 0.9 })); roof.position.set(0, top - 0.3, sk.position.z); scene.add(roof);
    for (const sd of [-1, 1]) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 22, 8), steel); ant.position.set(sd * 11, top + 11, sk.position.z + 10); scene.add(ant); const bl = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), neon(0xff2a2a, 4)); bl.position.set(sd * 11, top + 22.2, sk.position.z + 10); scene.add(bl); }
  }
  const tg = []; // all legs and braces merged into one mesh: a tall tower has hundreds of them
  for (let s = s0 + 2; s < s1 - 2; s += 8) { const h = trackH(s) ?? 0; if (h < 1.5) continue;
    for (const sd of [-1, 1]) { const len = h + GROUND; const g = new THREE.BoxGeometry(0.4, len, 0.4); g.translate(sd * (HALF - 0.4), h - 0.9 - len / 2, -s); tg.push(g); }
    for (let y = h - 4; y > 2 - GROUND; y -= 7) { const g = new THREE.BoxGeometry(HALF * 2 - 0.8, 0.18, 0.18); g.rotateZ((Math.floor(y) % 2 ? 1 : -1) * 0.5); g.translate(0, y, -s); tg.push(g); } }
  if (tg.length) scene.add(new THREE.Mesh(mergeGeometries(tg), legM));
  // MEGA RAMP letters on a banner at the lip, where the curve starts
  const bn = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 1, 1.4), sign('MEGA RAMP', '#e0322b', '#ffffff', 768, 172)); bn.position.set(0, DROP.h + 12.1, -DROP.s0); bn.rotation.y = 0; scene.add(bn);
  const bb = bn.clone(); bb.rotation.y = Math.PI; bb.position.z += 0.05; scene.add(bb);
  for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 13, 0.3), steel); p.position.set(sd * (HALF + 0.9), DROP.h + 6.3, -DROP.s0); scene.add(p); }
}
const TRACK_OBJ0 = scene.children.length;
{ let a = -14; if (DROP) { megaRamp(a, DROP.s1); a = DROP.s1; } for (const [g0, g1] of GAPS) { roadStrip(a, g0); a = g1; } roadStrip(a, RAMP0); roadStrip(RAMP0, RAMP1); roadStrip(LAND0, LAND1); }
{ // ramp surface chevrons, start grid, gantries, finish pad
  const rc = tex(256, 256, (g) => { g.fillStyle = '#16141c'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#ffc21a'; g.lineWidth = 26; g.lineJoin = 'round'; for (const y of [60, 150, 240]) { g.beginPath(); g.moveTo(30, y + 30); g.lineTo(128, y - 40); g.lineTo(226, y + 30); g.stroke(); } });
  for (let s = RAMP0 + 1.2; s < RAMP1; s += 2.5) { const h = trackH(s), sl = (trackH(s + 0.2) - trackH(s - 0.2)) / 0.4; const m = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 - 0.4, 2.3), new THREE.MeshStandardMaterial({ map: rc, roughness: 0.6 })); m.rotation.x = -Math.PI / 2 + Math.atan(sl); m.position.set(0, h + 0.02, -s); m.receiveShadow = true; scene.add(m); }
  const checker = tex(256, 64, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#f4f4ee' : '#16141c'; g.fillRect(x * 16, y * 16, 16, 16); } });
  const start = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 - 0.3, 1.2), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 })); start.rotation.x = -Math.PI / 2; start.position.set(0, (trackH(4) ?? 0) + 0.012, -4); start.receiveShadow = true; scene.add(start);
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
if (HAS_BIG) for (const sd of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 80, 0.6), darkSteel); arm.position.set(sd * 1.2, BIG_Y - 40, -SAW_S + 0.4); scene.add(arm); }
BIG.visible = HAS_BIG;
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
// ---- lava: glowing pools in the pits (level option L.lava = [[from, to], ...]) and under the last jump of a 'lava' finale ----
const LAVA_FX = { tex: null, embers: [] };
if (LAVA.length) {
  const lt = tex(256, 256, (g, w) => { g.fillStyle = '#d8340c'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * w, r = 8 + Math.random() * 34, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < 0.5 ? 'rgba(255,236,120,0.95)' : 'rgba(255,150,30,0.9)'); gr.addColorStop(1, 'rgba(255,90,10,0)'); g.fillStyle = gr; for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, TAU); g.fill(); } }
    g.strokeStyle = 'rgba(70,12,4,0.55)'; g.lineWidth = 5; for (let i = 0; i < 14; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * w; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } });
  lt.wrapS = lt.wrapT = THREE.RepeatWrapping; LAVA_FX.tex = lt;
  const rockM = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.95, emissive: 0xff4a10, emissiveIntensity: 0.12 });
  const emberT = tex(64, 64, (c, w) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(0.4, 'rgba(255,140,30,0.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, w); });
  for (const [a, b] of LAVA) {
    const lake = a >= RAMP1 - 0.5, W = lake ? HALF * 2 + 14 : HALF * 2 + 0.6, len = b - a, mid = (a + b) / 2, y = lake ? -3 : -1.6;
    const t = lt.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W / 6, len / 6);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(W, len), new THREE.MeshBasicMaterial({ map: t, color: glowColor(0xffffff, 1.5) })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, y, -mid); scene.add(pool); LAVA_FX.embers.push({ pool, t, flow: lake ? 0.05 : 0.12 });
    const depth = -y + 0.9; // rock walls round the pool, from the lava up to just under the road
    for (const sd of [-1, 1]) { const wl = new THREE.Mesh(new THREE.BoxGeometry(0.6, depth, len + 0.6), rockM); wl.position.set(sd * (W / 2 + 0.3), y + depth / 2 - 1.0, -mid); scene.add(wl); }
    for (const e of [a, b]) { const wl = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, depth, 0.6), rockM); wl.position.set(0, y + depth / 2 - 1.0, -e + (e === a ? 0.3 : -0.3)); scene.add(wl); }
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(W, len), new THREE.MeshBasicMaterial({ color: glowColor(0xff6a1a, 1.2), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })); glow.rotation.x = -Math.PI / 2; glow.position.set(0, y + 0.6, -mid); scene.add(glow);
    const n = Math.min(40, Math.round(len * W / 25) + 6);
    for (let i = 0; i < n; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emberT, color: glowColor(0xffffff, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(rand(0.15, 0.4)); scene.add(sp);
      LAVA_FX.embers.push({ sp, x: rand(-W / 2, W / 2), s: rand(a, b), y0: y, h: rand(0, 6), v: rand(1, 3) }); }
    if (lake) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), sign('LAVA LAKE', '#e0322b', '#ffffff')); sg.position.set(0, 5.2, -(a + 2)); sg.rotation.y = Math.PI; scene.add(sg); const sb = sg.clone(); sb.rotation.y = 0; sb.position.z -= 0.02; scene.add(sb); for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 9, 0.28), steel); p.position.set(sd * 2.4, 1.2, -(a + 2)); scene.add(p); } }
  }
}
function lavaAnimate(t, dt) {
  for (const e of LAVA_FX.embers) {
    if (e.pool) { e.t.offset.set(Math.sin(t * 0.3) * 0.05, -t * e.flow); continue; }
    e.h += e.v * dt; if (e.h > 7) { e.h = 0; e.x *= -0.7; }
    e.sp.position.set(e.x + Math.sin(t * 2 + e.s) * 0.3, e.y0 + e.h, -e.s); e.sp.material.opacity = 1 - e.h / 7;
  }
}
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
  const grip = tex(256, 512, (g, w, h) => { g.fillStyle = '#17161b'; g.fillRect(0, 0, w, h); const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = Math.random() * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0); g.fillStyle = 'rgba(255,194,26,0.9)'; g.font = '700 44px ' + FONT; g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('D-011', 0, 14); g.restore(); });
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
const WHEEL_R = BODY === 'car' ? (HDA ? 0.384 : 0.33) : VEH === 'cart' ? 0.06 * CART_S : 0.056;
// supermarket cart: chrome wire basket, red handle, four casters. Origin on the floor, front faces -z.
function makeCartMesh(S, wheelsOut) {
  const root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(S); root.add(g);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.2 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xe0322b, roughness: 0.35, clearcoat: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1a20, roughness: 0.7 });
  const W = 0.64, y0 = 0.4, y1 = 1.02, zf0 = -0.45, zb0 = 0.45, zf1 = -0.47, zb1 = 0.58, geos = [], extras = [];
  const G = { sideL: [], sideR: [], front: [], back: [], bottom: [], frameL: [], frameR: [] }; let cur = null; // wire groups, so the basket can break into pieces
  const bar = (x0, yy0, z0, x1, yy1, z1, r = 0.011) => { const a = new V3(x0, yy0, z0), b = new V3(x1, yy1, z1), len = a.distanceTo(b); if (len < 1e-4) return; const gg = new THREE.CylinderGeometry(r, r, len, 6, Math.max(1, Math.round(len / 0.045))); gg.translate(0, len / 2, 0); gg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize())); gg.translate(a.x, a.y, a.z); geos.push(gg); if (cur) cur.push(gg); };
  for (let i = 0; i <= 11; i++) { const t = i / 11; for (const sd of [-1, 1]) { cur = sd < 0 ? G.sideL : G.sideR; bar(sd * W / 2, y0, lerp(zf0, zb0, t), sd * (W / 2 + 0.03), y1, lerp(zf1, zb1, t)); } }
  for (let i = 0; i <= 8; i++) { const x = lerp(-W / 2, W / 2, i / 8); cur = G.front; bar(x, y0, zf0, x * 1.09, y1, zf1); cur = G.back; bar(x, y0, zb0, x * 1.09, y1, zb1); }
  for (const t of [0, 0.34, 0.67, 1]) { const y = lerp(y0, y1, t), zf = lerp(zf0, zf1, t), zb = lerp(zb0, zb1, t), hw = lerp(W / 2, W / 2 + 0.03, t); cur = G.front; bar(-hw, y, zf, hw, y, zf, 0.013); cur = G.back; bar(-hw, y, zb, hw, y, zb, 0.013); cur = G.sideL; bar(-hw, y, zf, -hw, y, zb, 0.013); cur = G.sideR; bar(hw, y, zf, hw, y, zb, 0.013); }
  cur = G.bottom; for (let i = 0; i <= 8; i++) { const x = lerp(-W / 2, W / 2, i / 8); bar(x, y0, zf0, x, y0, zb0, 0.009); }
  for (let i = 0; i <= 10; i++) { const z = lerp(zf0, zb0, i / 10); bar(-W / 2, y0, z, W / 2, y0, z, 0.009); }
  for (const sd of [-1, 1]) { cur = sd < 0 ? G.frameL : G.frameR; bar(sd * 0.27, 0.15, -0.44, sd * 0.27, 0.15, 0.52, 0.018); bar(sd * 0.27, 0.15, 0.52, sd * 0.3, y0, zb0, 0.016); bar(sd * 0.27, 0.15, -0.44, sd * 0.28, y0, zf0 + 0.04, 0.016); bar(sd * (W / 2 + 0.03), y1, zb1, sd * (W / 2 + 0.02), y1 + 0.1, zb1 + 0.14, 0.014); }
  cur = null; root.userData.pieces = Object.entries(G).filter(([, a]) => a.length).map(([name, a]) => ({ name, geo: mergeGeometries(a.map(x => x.clone())) }));
  const cage = new THREE.Mesh(mergeGeometries(geos), chrome); cage.castShadow = true; cage.name = 'cage'; cage.geometry.userData.orig = cage.geometry.attributes.position.array.slice(); g.add(cage);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W + 0.12, 14), red); handle.rotation.z = Math.PI / 2; handle.position.set(0, y1 + 0.1, zb1 + 0.14); handle.castShadow = true; g.add(handle); extras.push(handle);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.02, 0.24), red); flap.position.set(0, y1 - 0.05, zb1 - 0.13); flap.rotation.x = -0.45; g.add(flap); extras.push(flap);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), sign('CRASH MART', '#e0322b', '#ffffff', 384, 128)); plate.position.set(0, y1 - 0.13, zf1 - 0.01); plate.rotation.y = Math.PI; plate.name = 'plate'; plate.userData.home = plate.position.clone(); g.add(plate); extras.push(plate);
  for (const [x, z] of [[-0.27, -0.44], [0.27, -0.44], [-0.27, 0.52], [0.27, 0.52]]) {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), chrome); fork.position.set(x, 0.11, z); g.add(fork); extras.push(fork);
    const w = new THREE.Group(); w.position.set(x, 0.06, z); const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 16), black); wm.rotation.z = Math.PI / 2; wm.castShadow = true; w.add(wm); g.add(w); extras.push(w); if (wheelsOut) wheelsOut.push(w);
  }
  root.userData.extras = extras; root.userData.g = g;
  return root;
}
const TUB_PLAN = { A: 0.9, B: 0.4, n: 2.35, N: 96, sectors: 8, wallEnd: 14 }; // a double-ended oval, 1.8 m long, 0.8 m wide (A along the vehicle, B across), a superellipse
const TUB_PROFILE = [[0, 0.215], [0.5, 0.215], [0.58, 0.235], [0.7, 0.285], [0.82, 0.37], [0.92, 0.5], [0.975, 0.63], [0.995, 0.74], [1, 0.795], [0.992, 0.828], [0.965, 0.848], [0.925, 0.85], [0.895, 0.838], [0.884, 0.8], [0.86, 0.7], [0.805, 0.58], [0.715, 0.45], [0.6, 0.345], [0.47, 0.3], [0, 0.298]]; // [how far out (1 = the rim's outer edge), height]: under side, flared outer wall, the rolled rim, the inside, the floor
const TUB_FEET = [[0.25, 0.275, -0.47], [-0.25, 0.275, -0.47], [0.25, 0.275, 0.47], [-0.25, 0.275, 0.47]];
function tubShell() { // the whole shell, and the same shell cut into curved pieces (8 round it x wall/floor) for when it breaks
  const S = CART_S, { A, B, n, N, sectors, wallEnd } = TUB_PLAN, e = 2 / n, K = TUB_PROFILE.length, pos = new Float32Array(K * N * 3), col = new Float32Array(K * N * 3);
  for (let i = 0; i < K; i++) { const [sc, y] = TUB_PROFILE[i], inner = i >= 10; for (let j = 0; j < N; j++) { const th = j / N * 6.2831853, c = Math.cos(th), sn = Math.sin(th), k = (i * N + j) * 3; pos[k] = sc * B * Math.sign(sn) * Math.pow(Math.abs(sn), e) / S; pos[k + 1] = y / S; pos[k + 2] = sc * A * Math.sign(c) * Math.pow(Math.abs(c), e) / S; col[k] = inner ? 0.86 : 0.97; col[k + 1] = inner ? 0.91 : 0.98; col[k + 2] = inner ? 0.96 : 1; } }
  const idx = []; for (let i = 0; i < K - 1; i++) for (let j = 0; j < N; j++) { const a = i * N + j, b2 = i * N + (j + 1) % N, c2 = (i + 1) * N + (j + 1) % N, d = (i + 1) * N + j; idx.push(a, b2, c2, a, c2, d); }
  const full = new THREE.BufferGeometry(); full.setAttribute('position', new THREE.BufferAttribute(pos, 3)); full.setAttribute('color', new THREE.BufferAttribute(col, 3)); full.setIndex(idx); full.computeVertexNormals();
  const nor = full.attributes.normal.array, pieces = [];
  for (let sct = 0; sct < sectors; sct++) for (const part of ['wall', 'floor']) {
    const P = [], Nn = [], C = [], j0 = sct * N / sectors, j1 = (sct + 1) * N / sectors, i0 = part === 'wall' ? 0 : wallEnd, i1 = part === 'wall' ? wallEnd : K - 1;
    for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) for (const t of [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]]) { const v = ((i + t[0]) * N + (j + t[1]) % N) * 3; P.push(pos[v], pos[v + 1], pos[v + 2]); Nn.push(nor[v], nor[v + 1], nor[v + 2]); C.push(col[v], col[v + 1], col[v + 2]); }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g2.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); pieces.push({ name: part + sct, geo: g2 });
  }
  return { full, pieces };
}
function makeTubMesh(wheelsOut) { // origin on the floor, front faces -z, built in metres and divided by the cart scale so the same scaled group works
  const S = CART_S, root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(S); root.add(g);
  const MAT = { enamel: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }), chrome: new THREE.MeshStandardMaterial({ color: 0xeef1f5, metalness: 1, roughness: 0.1 }), hose: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.8, roughness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.45 }), yellow: new THREE.MeshPhysicalMaterial({ color: 0xffd21f, roughness: 0.3, clearcoat: 0.8 }), orange: new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.5 }) };
  try { const env = labEnv(); for (const k of ['enamel', 'chrome', 'yellow', 'hose']) { MAT[k].envMap = env; MAT[k].envMapIntensity = k === 'chrome' ? 1.2 : 0.8; } } catch (e) { /* no reflections, still fine */ }
  const extras = [], V = (x, y, z) => new V3(x, y, z);
  const extra = (geo, mat, name) => { geo.scale(1 / S, 1 / S, 1 / S); geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(new V3()); geo.translate(-c.x, -c.y, -c.z); const m = new THREE.Mesh(geo, mat); m.position.copy(c); m.castShadow = true; m.name = name; g.add(m); extras.push(m); return m; };
  const tube = (pts, r, seg) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(p[0], p[1], p[2]))), seg || 24, r, 10, false);
  const shell = tubShell(), body = new THREE.Mesh(shell.full, MAT.enamel); body.castShadow = true; body.receiveShadow = true; body.name = 'tub_shell'; g.add(body);
  const pieces = shell.pieces;
  // chrome feet with casters
  for (const [fx, fy, fz] of TUB_FEET) {
    const sx = fx > 0 ? 1 : -1, leg = tube([[fx, fy - 0.015, fz], [fx + sx * 0.01, fy - 0.065, fz], [fx + sx * 0.035, fy - 0.115, fz], [fx + sx * 0.055, fy - 0.16, fz]], 0.024, 12);
    const ball = new THREE.SphereGeometry(0.04, 14, 10); ball.translate(fx + sx * 0.055, fy - 0.17, fz); const brk = new THREE.BoxGeometry(0.1, 0.014, 0.07); brk.translate(fx + sx * 0.055, fy - 0.19, fz);
    extra(mergeGeometries([leg, ball, brk].map(x => (x.index ? x.toNonIndexed() : x))), MAT.chrome, 'x:foot');
    const w = new THREE.Group(); w.position.set((fx + sx * 0.055) / S, 0.042 / S, fz / S); const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.042 / S, 0.042 / S, 0.04 / S, 18), MAT.black); wm.rotation.z = Math.PI / 2; wm.castShadow = true; w.add(wm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.018 / S, 0.018 / S, 0.044 / S, 12), MAT.chrome); hub.rotation.z = Math.PI / 2; w.add(hub); g.add(w); extras.push(w); if (wheelsOut) wheelsOut.push(w);
  }
  // taps on the rim at the back: two pillars with cross-head handles, a bridge, a swan-neck spout, a shower handset on a hose
  const zt = 0.8, yr = 0.85;
  for (const sx of [-1, 1]) {
    const pil = new THREE.CylinderGeometry(0.013, 0.013, 0.15, 14); pil.translate(sx * 0.075, yr + 0.075, zt); const hub2 = new THREE.SphereGeometry(0.02, 12, 8); hub2.translate(sx * 0.075, yr + 0.165, zt);
    const bar1 = new THREE.BoxGeometry(0.075, 0.009, 0.009); bar1.translate(sx * 0.075, yr + 0.19, zt); const bar2 = new THREE.BoxGeometry(0.009, 0.009, 0.075); bar2.translate(sx * 0.075, yr + 0.19, zt);
    extra(mergeGeometries([pil, hub2, bar1, bar2].map(x => (x.index ? x.toNonIndexed() : x))), MAT.chrome, 'x:tap');
  }
  extra(tube([[-0.075, yr + 0.1, zt], [-0.03, yr + 0.11, zt], [0.03, yr + 0.11, zt], [0.075, yr + 0.1, zt]], 0.011, 16), MAT.chrome, 'x:bridge');
  extra(tube([[0, yr + 0.11, zt], [0, yr + 0.22, zt - 0.03], [0, yr + 0.24, zt - 0.12], [0, yr + 0.15, zt - 0.19]], 0.014, 20), MAT.chrome, 'x:spout');
  { const hs = new THREE.CylinderGeometry(0.016, 0.016, 0.17, 12); hs.translate(-0.2, yr + 0.24, zt + 0.02); const hd = new THREE.SphereGeometry(0.042, 14, 8); hd.scale(1, 0.3, 1); hd.translate(-0.2, yr + 0.335, zt + 0.02); extra(mergeGeometries([hs, hd].map(x => (x.index ? x.toNonIndexed() : x))), MAT.chrome, 'x:handset'); }
  extra(tube([[0.075, yr + 0.06, zt], [0.02, yr - 0.07, zt + 0.1], [-0.12, yr - 0.1, zt + 0.12], [-0.2, yr + 0.14, zt + 0.04]], 0.007, 24), MAT.hose, 'x:hose');
  { const dr = new THREE.SphereGeometry(0.035, 14, 8); dr.scale(1, 0.15, 1); dr.translate(0, 0.31, 0.45); extra(dr, MAT.chrome, 'x:drain'); }
  // the rubber duck on the front rim
  { const db = new THREE.SphereGeometry(0.06, 14, 10); db.scale(1.1, 0.9, 1); db.translate(0.09, 0.9, -0.74); const dh = new THREE.SphereGeometry(0.036, 12, 8); dh.translate(0.09, 0.97, -0.7); extra(mergeGeometries([db, dh].map(x => (x.index ? x.toNonIndexed() : x))), MAT.yellow, 'x:duck', 'rubber'); const bk = new THREE.ConeGeometry(0.016, 0.04, 10); bk.rotateX(Math.PI / 2); bk.translate(0.09, 0.965, -0.66); extra(bk, MAT.orange, 'x:beak', 'rubber'); }
  root.userData.pieces = pieces; root.userData.extras = extras; root.userData.g = g; root.userData.pieceMat = MAT.enamel; root.userData.bigPieces = true;
  return root;
}
// little race car (level option body: 'car'): open cockpit, Daggie sits where the cart's basket floor would be. Origin on the floor, front faces -z.
function makeCarMesh(wheelsOut) {
  const root = new THREE.Group(), g = new THREE.Group(), flames = []; root.add(g);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xe0322b, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf4f4ee, roughness: 0.35, clearcoat: 1 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x1b1a20, roughness: 0.6, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.18 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.85 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new RoundedBoxGeometry(1.12, 0.1, 2.75, 2, 0.03), carbon, 0, 0.49, 0.05); // floor pan, just under the seat
  const brk = []; // the parts that tear off in a crash
  for (const sd of [-1, 1]) { // side pods with the race number
    const pod = add(new RoundedBoxGeometry(0.26, 0.38, 1.5, 3, 0.08), paint, sd * 0.62, 0.68, 0.18); brk.push(pod);
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), sign('D-1', '#f4f4ee', '#16141c', 256, 128)); num.position.set(sd * 0.135, 0.02, 0.02); num.rotation.y = sd * Math.PI / 2; pod.add(num);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 1.5), white); st.position.set(sd * 0.135, 0.18, 0); pod.add(st); }
  { // nose: a side profile pushed out across the car
    const sh = new THREE.Shape(); sh.moveTo(-0.42, 0.45); sh.lineTo(-0.42, 0.95); sh.lineTo(-0.85, 0.86); sh.quadraticCurveTo(-1.55, 0.72, -1.8, 0.52); sh.lineTo(-1.8, 0.45); sh.lineTo(-0.42, 0.45);
    const ng = new THREE.ExtrudeGeometry(sh, { depth: 0.96, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 }); ng.rotateY(-Math.PI / 2); ng.translate(0.48, 0, 0);
    brk.push(add(ng, paint, 0, 0, 0));
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 1.42), white); stripe.rotation.x = -Math.PI / 2 - 0.2; stripe.position.set(0, 0.84, -1.18); g.add(stripe);
    const fw = add(new RoundedBoxGeometry(1.7, 0.05, 0.36, 2, 0.02), carbon, 0, 0.5, -1.86); brk.push(fw); // front wing
    for (const sd of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.42), paint); ep.position.set(sd * 0.86, 0.06, 0); fw.add(ep); }
    for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), neon(0xfff2c0, 3)); l.position.set(sd * 0.32, 0.6, -1.8); g.add(l); }
  }
  // cowl and dash in front of the driver, the steering wheel on its column
  add(new RoundedBoxGeometry(1.0, 0.14, 0.3, 2, 0.05), carbon, 0, 0.96, -0.5);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 10, 28), carbon); sw.position.set(0, 1.04, -0.26); sw.rotation.x = -0.35; g.add(sw);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8), chrome); col.position.set(0, 1.0, -0.4); col.rotation.x = Math.PI / 2 - 0.35; g.add(col);
  // seat back, engine cover, roll hoop, rear wing, exhausts
  const seat = add(new RoundedBoxGeometry(0.7, 0.62, 0.1, 2, 0.04), carbon, 0, 0.86, 0.72); seat.rotation.x = 0.18;
  brk.push(add(new RoundedBoxGeometry(1.0, 0.36, 0.72, 3, 0.1), paint, 0, 0.72, 1.12)); // engine cover
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.8, 0.03, 0.06), carbon, 0, 0.91, 0.86 + i * 0.16);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 10, 24, Math.PI), chrome); hoop.position.set(0, 1.3, 0.86); g.add(hoop); brk.push(hoop);
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), chrome, sd * 0.36, 1.05, 0.86);
  const rw = add(new RoundedBoxGeometry(1.6, 0.06, 0.42, 2, 0.02), carbon, 0, 1.28, 1.42); brk.push(rw); // rear wing on its struts
  for (const sd of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.3), paint); ep.position.set(sd * 0.8, -0.16, 0); rw.add(ep); const su = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.06), carbon); su.position.set(sd * 0.3, -0.23, -0.06); rw.add(su); }
  const flameT = tex(64, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h * 0.2, 2, w / 2, h * 0.4, h * 0.6); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(120,200,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,120,30,0.7)'); gr.addColorStop(1, 'rgba(255,40,0,0)'); c.fillStyle = gr; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU); c.fill(); });
  for (const sd of [-1, 1]) {
    const ex = add(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 12), chrome, sd * 0.24, 0.68, 1.55); ex.rotation.x = Math.PI / 2 - 0.15;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.9), new THREE.MeshBasicMaterial({ map: flameT, color: glowColor(0xffffff, 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(sd * 0.24, 0.71, 2.1); fl.visible = false; g.add(fl); flames.push(fl);
  }
  // wheels: wide slicks with chrome rims; the rear pair is bigger
  for (const [x, z, r, w] of [[-0.74, -1.08, 0.3, 0.26], [0.74, -1.08, 0.3, 0.26], [-0.78, 0.98, 0.36, 0.36], [0.78, 0.98, 0.36, 0.36]]) {
    const wg = new THREE.Group(); wg.position.set(x, r, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28), tyre); t.rotation.z = Math.PI / 2; t.castShadow = true; wg.add(t);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 6), chrome); rim.rotation.z = Math.PI / 2; wg.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.05, 12), paint); hub.rotation.z = Math.PI / 2; wg.add(hub);
    g.add(wg); if (wheelsOut) wheelsOut.push(wg); brk.push(wg);
    add(new THREE.BoxGeometry(Math.abs(x) - 0.5, 0.05, 0.08), carbon, Math.sign(x) * (0.25 + Math.abs(x) / 2), r, z);
  }
  root.userData.pieces = []; root.userData.extras = []; root.userData.g = g; root.userData.flames = flames; root.userData.brk = brk;
  const HP = { pod: 1.0, nose: 1.2, fwing: 0.7, hoop: 1.1, cover: 1.1, rwing: 0.8, wheel: 1.1 }; // how much damage each part takes before it comes off
  const names = ['pod', 'pod', 'nose', 'fwing', 'cover', 'hoop', 'rwing', 'wheel', 'wheel', 'wheel', 'wheel'];
  const zone = o => { if (!o.isMesh) return o.position.clone(); o.geometry.computeBoundingBox(); return o.geometry.boundingBox.getCenter(new V3()).add(o.position); }; // where on the car it sits
  root.userData.parts = brk.map((o, i) => ({ o, name: names[i] || 'part', hp: HP[names[i]] || 1, det: true, c: zone(o), home: o.position.clone(), rot: o.rotation.clone(), dmg: 0 }));
  g.children.forEach(o => { if (o.isMesh && !brk.includes(o) && o.geometry && o.geometry.attributes.position.count > 20) root.userData.parts.push({ o, name: 'body', hp: 99, det: false, c: zone(o), home: o.position.clone(), rot: o.rotation.clone(), dmg: 0 }); }); // the rest only dents
  return root;
}
// ---------- HD look: HDRI light, scanned surfaces, the real car and a body that crumples ----------
// PBR surface sets (diffuse, OpenGL normal, roughness) in tex/: a set that fails to load is simply left out
async function hdMaps() {
  const HD_SETS = { asphalt: 'asphalt', concrete: 'concrete', metal: 'metal' }; // (inside: this runs before the module gets this far)
  const ld = new THREE.TextureLoader(), one = (u, srgb) => ld.loadAsync(u).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }, () => null);
  const out = {};
  await Promise.all(Object.entries(HD_SETS).map(async ([k, n]) => { const [map, normalMap, roughnessMap] = await Promise.all([one('tex/' + n + '_diff.jpg?v=1', true), one('tex/' + n + '_nor.jpg?v=1'), one('tex/' + n + '_rough.jpg?v=1')]); if (map) out[k] = { map, normalMap, roughnessMap }; }));
  return out;
}
// a PBR material from a set, tiled every `size` metres on geometry whose UVs are in metres (or `rep` repeats)
function hdMat(set, rep, extra) {
  const S = HDA && HDA.maps[set]; if (!S) return null;
  const o = Object.assign({ roughness: 1, metalness: 0 }, extra || {}); delete o.ns; const m = new THREE.MeshStandardMaterial(o);
  for (const k of ['map', 'normalMap', 'roughnessMap']) if (S[k]) { const t = S[k].clone(); t.needsUpdate = true; t.repeat.set(rep[0], rep[1]); m[k] = t; }
  if (m.normalMap && extra && extra.ns) m.normalScale.setScalar(extra.ns); // the sets use OpenGL normal maps, which is what three expects
  return m;
}
function hdEnvironment() { // sunset HDRI: the light and every reflection on the car come from a real place
  const pm = new THREE.PMREMGenerator(renderer); HDA.env.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pm.fromEquirectangular(HDA.env).texture; pm.dispose(); HDA.env.dispose();
  hemi.intensity = 0.35; sunLight.intensity *= 0.85;
}
// glass, paint that scrapes to bare metal where it is hit (attribute aDmg, 0..1 per vertex)
function hdPaint(m) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float aDmg;\nvarying float vDmg;\nvarying vec3 vDp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDmg = aDmg; vDp = position;');
    sh.fragmentShader = 'varying float vDmg;\nvarying vec3 vDp;\nfloat hdN(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat hdS = smoothstep(0.12, 0.9, vDmg); float hdA = hdN(vDp * 70.0), hdB = hdN(vDp * vec3(9.0, 160.0, 9.0) + hdA);\nfloat hdBare = hdS * step(0.8 - 0.3 * hdS, hdB * 0.65 + hdA * 0.35);\ndiffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - 0.4 * hdS), mix(vec3(0.4, 0.41, 0.43), vec3(0.1), hdA * 0.7), hdBare);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.5, hdS);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.9, hdBare);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - hdS;\n#endif');
  };
  m.customProgramCacheKey = () => 'hdpaint'; m.needsUpdate = true;
}
// the car: the glb faces +z with its roof cut off (a targa: the viewer sees Daggie at the wheel); it is turned to face -z like the game's other cars
function makeHDCar(wheelsOut) {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const car = HDA.car; car.rotation.y = Math.PI; g.add(car);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b0f14, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.3, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false });
  const lights = [], paints = new Set();
  car.traverse(o => { if (!o.isMesh) return; o.castShadow = !/^Interior|Wipers|Handle|Gasket/.test(o.name); o.receiveShadow = true; const m = o.material; // the cabin's little parts cast no shadow: fewer draw calls on phones
    if (m.name === 'Glass') { o.material = glass; o.castShadow = false; }
    else if (/^Paint|^Panel Sides/.test(m.name)) { paints.add(m); m.envMapIntensity = 1.25; }
    if (/light/i.test(m.name) && m.emissiveIntensity !== undefined && !lights.includes(m)) lights.push(m); });
  for (const m of paints) hdPaint(m);
  root.updateMatrixWorld(true);
  const brk = [], parts = [], at = (o, n) => { const p = new THREE.Group(); p.name = n; p.position.copy(g.worldToLocal(o.getWorldPosition(new V3()))); g.add(p); p.updateMatrixWorld(true); p.attach(o); return p; };
  const box = o => new THREE.Box3().setFromObject(o).applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
  const part = (o, name, hp) => { const c = box(o).getCenter(new V3()); parts.push({ o, name, hp, det: true, c, home: o.position.clone(), rot: o.rotation.clone(), dmg: 0 }); brk.push(o); return o; };
  // wheels on axle pivots along the car's x axis: the engine spins them, a hard hit tears them off
  const steer = [];
  for (const n of ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']) { const w = car.getObjectByName(n); if (!w) continue; const piv = at(w, n + 'Axle'); piv.rotation.order = 'YXZ'; if (/Front/.test(n)) steer.push(piv); wheelsOut.push(piv); part(piv, 'wheel', 1.25); }
  // mirrors come off first, then doors, the hood and the engine cover
  for (const sd of ['L', 'R']) { const door = car.getObjectByName('BodyDoor' + sd + 'Color1'); if (!door) continue;
    const ms = ['Mirror', 'MirrorColor1', 'MirrorColor2'].map(k => car.getObjectByName('BodyDoor' + sd + k)).filter(Boolean);
    if (ms.length) { const mg = new THREE.Group(); mg.position.copy(door.worldToLocal(ms[0].getWorldPosition(new V3()))); door.add(mg); mg.updateMatrixWorld(true); for (const m of ms) mg.attach(m); part(mg, 'mirror', 0.22); }
    part(door, 'door', 0.95); }
  const hood = car.getObjectByName('BodyHood'); if (hood) part(hood, 'hood', 0.8);
  const hatch = car.getObjectByName('BodyRearPanelsColor1'); if (hatch) part(hatch, 'hatch', 1.0);
  // every body mesh can dent: keep its rest shape, normals and a scrape amount per vertex
  const dent = [];
  car.traverse(o => { if (!o.isMesh || o.material === glass || /Wheel|Tire|Rim/.test(o.name + (o.parent && o.parent.name))) return; let a = o; while (a && !/Axle$/.test(a.name)) a = a.parent; if (a) return;
    const ge = o.geometry = o.geometry.clone(), n = ge.attributes.position.count; if (!ge.attributes.normal) ge.computeVertexNormals(); // own copy: identical parts may share one geometry in the file
    ge.userData.p0 = ge.attributes.position.array.slice(); ge.userData.n0 = ge.attributes.normal.array.slice(); ge.userData.disp = new Float32Array(n);
    ge.setAttribute('aDmg', new THREE.BufferAttribute(new Float32Array(n), 1)); ge.computeBoundingSphere(); dent.push(o); });
  const ws = car.getObjectByName('BodyWindshield');
  const hdl = lights.map(m => ({ m, e: m.emissiveIntensity, front: /Head/i.test(m.name) }));
  root.userData = { hd: true, steer, g, flames: [], pieces: [], extras: [], brk, parts, dent, ws, lights: hdl, wsC: ws ? box(ws).getCenter(new V3()) : new V3(0, 1, -0.9) };
  return root;
}
// a dent: everything within R of point P (car space) is pushed along D by up to `depth`, with a crumpled, uneven edge; power scrapes the paint
const _hm = new THREE.Matrix4(), _hmi = new THREE.Matrix4(), _hp = new V3(), _hd = new V3(), _hv = new V3();
function hdDent(P, D, R, depth, power) {
  const U = CART_ROOT.userData; CART_ROOT.updateMatrixWorld(true); const rootInv = new THREE.Matrix4().copy(CART_ROOT.matrixWorld).invert(), seed = Math.random() * 100;
  for (const o of U.dent) {
    if (!CART_ROOT.getObjectById(o.id)) continue; // on a part that has come off
    _hm.multiplyMatrices(rootInv, o.matrixWorld); _hmi.copy(_hm).invert();
    _hp.copy(P).applyMatrix4(_hmi); _hd.copy(D).transformDirection(_hmi);
    const ge = o.geometry, bs = ge.boundingSphere; if (bs.center.distanceTo(_hp) > bs.radius + R) continue;
    const a = ge.attributes.position.array, dm = ge.attributes.aDmg.array, disp = ge.userData.disp; let hit = false;
    for (let i = 0, j = 0; i < a.length; i += 3, j++) {
      const dx = a[i] - _hp.x, dy = a[i + 1] - _hp.y, dz = a[i + 2] - _hp.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 > R * R) continue;
      const t = 1 - Math.sqrt(d2) / R, f = t * t * (3 - 2 * t), wr = 1 + 0.45 * Math.sin(a[i] * 21 + seed) * Math.sin(a[i + 1] * 17 - seed) * Math.sin(a[i + 2] * 25 + seed * 0.5);
      const k = depth * f * wr; a[i] += _hd.x * k; a[i + 1] += _hd.y * k; a[i + 2] += _hd.z * k;
      // the panel bunches up around the dent instead of just sinking: a little sideways squeeze toward the centre
      const sq = 0.22 * depth * f / R; a[i] -= dx * sq; a[i + 1] -= dy * sq * 0.5; a[i + 2] -= dz * sq;
      disp[j] += Math.abs(k); dm[j] = Math.min(1, dm[j] + f * f * power * 0.8); hit = true; }
    if (!hit) continue;
    ge.attributes.position.needsUpdate = true; ge.attributes.aDmg.needsUpdate = true; ge.computeVertexNormals();
    const nn = ge.attributes.normal.array, n0 = ge.userData.n0; // untouched panels keep their smooth factory normals, bent ones get the creased new ones
    for (let i = 0, j = 0; i < nn.length; i += 3, j++) { const w = Math.min(1, disp[j] / 0.02); if (w >= 1) continue; _hv.set(n0[i] + (nn[i] - n0[i]) * w, n0[i + 1] + (nn[i + 1] - n0[i + 1]) * w, n0[i + 2] + (nn[i + 2] - n0[i + 2]) * w).normalize(); nn[i] = _hv.x; nn[i + 1] = _hv.y; nn[i + 2] = _hv.z; }
    ge.attributes.normal.needsUpdate = true; ge.computeBoundingSphere();
  }
}
// an impact at P (car space) pushing along D: dents, scrapes, parts torn off, glass, lights
function hdImpact(P, D, power) {
  const U = CART_ROOT.userData; if (power < 0.02) return; power = Math.min(power, 1.4);
  const R = 0.4 + power * 0.6, depth = Math.min(0.42, 0.03 + power * 0.32);
  hdDent(P, D.clone().normalize(), R, depth, power);
  if (power > 0.5) hdDent(P.clone().addScaledVector(D, 0.3), D, R * 1.5, depth * 0.25, power * 0.3); // the whole side gives a little, not just the spot
  for (const p of U.parts) { if (p.off) continue; const w = clamp(1 - p.c.distanceTo(P) / (R + 1.1), 0, 1); if (!w) continue; p.dmg += power * w * rand(0.9, 1.5) * 1.6; if (p.dmg > p.hp) carPartOff(p); }
  if (U.ws && U.ws.visible && (power > 0.75 || (power > 0.22 && U.wsC.distanceTo(P) < R + 0.7))) hdShatter();
  for (const l of U.lights) if (l.m.emissiveIntensity > 0 && power > 0.12 && (l.front ? P.z < -1.4 : P.z > 1.4)) { l.m.emissiveIntensity = 0; burst(CART_ROOT.localToWorld(P.clone()), 12, SPARK, 4); }
  const wp = CART_ROOT.localToWorld(P.clone()); burst(wp, Math.round(14 + power * 50), SPARK, 4 + power * 6);
}
function hdHitAt(worldP, power) { // something hit the car near a world point (the hammer head): find the spot on the body and the push direction
  CART_ROOT.updateMatrixWorld(true); const q = CART_ROOT.worldToLocal(worldP.clone()), c = new V3(clamp(q.x, -1.02, 1.02), clamp(q.y, 0.2, 1.05), clamp(q.z, -2.15, 2.2));
  const D = c.clone().sub(q); if (D.lengthSq() < 1e-4) D.set(-Math.sign(q.x) || 1, 0, 0); hdImpact(c, D.normalize(), power);
}
function hdGroundHit(power) { // tumbling: the corner nearest the road takes it (roof, pillars, a fender), pushed up into the car
  CART_ROOT.updateMatrixWorld(true); let best = null, by = 1e9; const v = new V3();
  for (const x of [-1, 1]) for (const y of [0.25, 1.05]) for (const z of [-2, -0.6, 0.6, 2]) { v.set(x, y, z); CART_ROOT.localToWorld(v); if (v.y < by) { by = v.y; best = new V3(x, y, z); } }
  const up = CART_ROOT.worldToLocal(CART_ROOT.getWorldPosition(new V3()).add(Y)).sub(CART_ROOT.worldToLocal(CART_ROOT.getWorldPosition(new V3()))).normalize();
  best.x *= 1.02; hdImpact(best, up, power);
}
// the windshield bursts into shards that tumble off the car
const HDG = { list: [], mesh: null };
function hdShatter() {
  const U = CART_ROOT.userData, ws = U.ws; ws.visible = false; glassSound(1);
  if (!HDG.mesh) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.09, 0.02, 0, 0.03, 0.08, 0], 3)); gg.computeVertexNormals();
    HDG.mesh = new THREE.InstancedMesh(gg, new THREE.MeshPhysicalMaterial({ color: 0x9fb8c4, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, envMapIntensity: 2.5 }), 90); HDG.mesh.frustumCulled = false; scene.add(HDG.mesh); }
  ws.updateMatrixWorld(true); const pa = ws.geometry.attributes.position, wv = BB.free ? BB.v : new V3(R.xv, R.vy, -R.speed);
  HDG.list.length = 0;
  for (let i = 0; i < 90; i++) { const p = new V3().fromBufferAttribute(pa, (Math.random() * pa.count) | 0).applyMatrix4(ws.matrixWorld);
    HDG.list.push({ p, v: wv.clone().multiplyScalar(rand(0.4, 0.95)).add(new V3(rand(-3, 3), rand(1, 5), rand(-3, 3))), q: new THREE.Quaternion().random(), w: new V3(rand(-20, 20), rand(-20, 20), rand(-20, 20)), s: rand(0.35, 1.1), rest: false }); }
  HDG.mesh.count = HDG.list.length; hdShardStep(0);
}
const _hq = new THREE.Quaternion(), _hM = new THREE.Matrix4(), _hS = new V3();
function hdShardStep(dt) {
  if (!HDG.mesh || !HDG.mesh.count) return;
  HDG.list.forEach((d, i) => { if (!d.rest && dt) { d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt); _hq.setFromAxisAngle(_hS.copy(d.w).normalize(), d.w.length() * dt); d.q.premultiply(_hq);
      const fl = floorAt(d.p.x, d.p.z); if (d.p.y < fl + 0.01 && d.p.y > fl - 0.6) { d.p.y = fl + 0.01; d.v.y *= -0.25; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.5); if (d.v.lengthSq() < 0.2) d.rest = true; } if (d.p.y < -89) d.rest = true; }
    HDG.mesh.setMatrixAt(i, _hM.compose(d.p, d.q, _hS.setScalar(d.s))); });
  HDG.mesh.instanceMatrix.needsUpdate = true;
}
function hdReset() { // the car is whole again: rest shapes, clean paint, glass, lights
  const U = CART_ROOT && CART_ROOT.userData; if (!U || !U.hd) return;
  for (const o of U.dent) { const ge = o.geometry; ge.attributes.position.array.set(ge.userData.p0); ge.attributes.normal.array.set(ge.userData.n0); ge.attributes.aDmg.array.fill(0); ge.userData.disp.fill(0);
    ge.attributes.position.needsUpdate = ge.attributes.normal.needsUpdate = ge.attributes.aDmg.needsUpdate = true; ge.computeBoundingSphere(); }
  if (U.ws) U.ws.visible = true; for (const l of U.lights) l.m.emissiveIntensity = l.e;
  for (const p of U.parts) p.o.visible = true;
  HDG.list.length = 0; if (HDG.mesh) HDG.mesh.count = 0;
}
var CART_ROOT; // var, not let: buildCart() is called earlier in the file (line ~508) and a let would still be unreachable there
// the race car takes damage: every hit dents the panels near it (bumps hit the front, rails the side, tumbling everything);
// a part that has taken too much comes off and bounces down the road on its own
const CBRK = { list: [], on: false };
function carDent(m, d, sx, fz) { // push the vertices near an impact point in toward the middle of the part
  const ga = m.geometry.attributes.position; if (!m.geometry.userData.orig) m.geometry.userData.orig = ga.array.slice();
  m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox, c = bb.getCenter(new V3()), sz = bb.getSize(new V3());
  const ip = new V3(sx ? (sx > 0 ? bb.max.x : bb.min.x) : rand(bb.min.x, bb.max.x), rand(bb.min.y, bb.max.y), fz > 0 ? bb.min.z : fz < 0 ? bb.max.z : rand(bb.min.z, bb.max.z));
  const r = Math.max(0.12, Math.min(sz.x, sz.y, sz.z) * 0.5 + Math.max(sz.x, sz.z) * 0.2) * (0.8 + d), depth = Math.min(0.14, 0.03 + d * 0.1), a = ga.array, v = new V3();
  for (let i = 0; i < a.length; i += 3) { v.set(a[i], a[i + 1], a[i + 2]); const dist = v.distanceTo(ip); if (dist > r) continue; const k = (1 - dist / r) ** 2 * depth; v.lerp(c, Math.min(0.6, k / Math.max(0.05, v.distanceTo(c)))); a[i] = v.x + rand(-0.008, 0.008) * k * 10; a[i + 1] = v.y; a[i + 2] = v.z; }
  ga.needsUpdate = true; m.geometry.computeVertexNormals();
}
function carPartOff(p) {
  if (p.off) return; p.off = true; board.updateMatrixWorld(true); const o = p.o;
  const rec = { o, par: o.parent, p0: p.home.clone(), q0: new THREE.Quaternion().setFromEuler(p.rot), v: new V3(), w: new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(rand(6, 16)), rest: false };
  scene.attach(o); const out = o.position.clone().sub(board.position); out.y = Math.max(0.3, out.y); out.normalize();
  if (BB.free) rec.v.copy(BB.v).multiplyScalar(rand(0.5, 0.9)); else rec.v.set(R.xv, Math.max(0, R.vy), -R.speed * rand(0.75, 0.95));
  rec.v.addScaledVector(out, rand(2, 6)); rec.v.y += rand(1.5, 4); CBRK.list.push(rec); CBRK.on = true;
  burst(o.getWorldPosition(new V3()), 30, SPARK, 6); clank(4);
  if (state === 'ride' && p.name === 'wheel') { R.lean = (R.lean || 0) + (p.c.x > 0 ? 0.09 : -0.09); R.wild += 0.4; } // down on that corner: it scrapes and pulls
  if (state === 'ride') { lastPop = 0; pop({ wheel: 'WHEEL OFF!', fwing: 'WING GONE!', rwing: 'SPOILER GONE!', nose: 'NOSE OFF!', pod: 'PANEL OFF!', cover: 'HOOD OFF!', hoop: 'ROLL BAR OFF!', door: 'DOOR OFF!', hood: 'HOOD OFF!', hatch: 'TRUNK OFF!', mirror: 'MIRROR OFF!' }[p.name] || 'CRUNCH!', 'green'); }
}
function carHit(power, sx = 0, fz = 0) { // power about 0.1 for a bump at speed, 1 for a crash at 200 mph
  if (BODY !== 'car' || !CART_ROOT || !CART_ROOT.userData.parts || power < 0.02) return;
  if (CART_ROOT.userData.hd) { // the real car: the same hit lands on a spot of its body (front, a side, or the top)
    const P = fz > 0 ? new V3(rand(-0.7, 0.7), rand(0.3, 0.7), -2.1) : fz < 0 ? new V3(rand(-0.7, 0.7), rand(0.35, 0.75), 2.15) : sx ? new V3(sx * 1.02, rand(0.3, 0.8), rand(-1.6, 1.6)) : new V3(rand(-0.8, 0.8), 0.95, rand(-1.4, 1.4));
    hdImpact(P, fz > 0 ? new V3(0, 0.15, 1) : fz < 0 ? new V3(0, 0.15, -1) : sx ? new V3(-sx, 0.1, 0) : new V3(0, -1, 0), power * 1.4); return; }
  for (const p of CART_ROOT.userData.parts) { if (p.off) continue;
    const w = 0.3 + (sx && Math.sign(p.c.x) === sx && Math.abs(p.c.x) > 0.3 ? 0.9 : 0) + (fz > 0 && p.c.z < -0.6 ? 0.9 : 0) + (fz < 0 && p.c.z > 0.6 ? 0.9 : 0);
    const d = power * w * rand(0.4, 1.2); p.dmg += d;
    if (p.o.isMesh) carDent(p.o, d, sx, fz); else { p.o.rotation.z = p.rot.z + rand(-1, 1) * Math.min(0.5, p.dmg * 0.3); } // a bent wheel wobbles
    if (p.det && p.dmg > p.hp) carPartOff(p);
  }
}
function carBreakStep(dt) {
  for (const d of CBRK.list) { if (d.rest) continue; const o = d.o;
    d.v.y -= 9.8 * dt; o.position.addScaledVector(d.v, dt);
    const wl = d.w.length(); if (wl > 1e-3) { tq.setFromAxisAngle(tv.copy(d.w).multiplyScalar(1 / wl), wl * dt); o.quaternion.premultiply(tq); }
    const fl = floorAt(o.position.x, o.position.z);
    if (o.position.y < fl + 0.15 && o.position.y > fl - 0.8) { o.position.y = fl + 0.15; if (d.v.y < -3) clank(2); if (d.v.y < 0) d.v.y *= -0.4; d.v.x *= 0.82; d.v.z *= 0.82; d.w.multiplyScalar(0.75); if (d.v.length() < 0.4) d.rest = true; }
    if (o.position.y < -89) d.rest = true; }
}
function carBreakReset() {
  hdReset();
  for (const d of CBRK.list) d.par.add(d.o); CBRK.list.length = 0; CBRK.on = false;
  if (CART_ROOT && CART_ROOT.userData.parts) for (const p of CART_ROOT.userData.parts) { p.off = false; p.dmg = 0; p.o.position.copy(p.home); p.o.rotation.copy(p.rot);
    const g = p.o.isMesh && p.o.geometry; if (g && g.userData.orig) { g.attributes.position.array.set(g.userData.orig); g.attributes.position.needsUpdate = true; g.computeVertexNormals(); } }
}
function buildCart() { CART_ROOT = BODY === 'car' ? (HDA ? makeHDCar(wheels) : makeCarMesh(wheels)) : makeCartMesh(CART_S, wheels); board.add(CART_ROOT); }
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
// 1b. giant hammer: a steel head on a long shaft, swinging across the road like a pendulum (level option L.hammers = [[s, phase], ...])
function addHammer(s, ph = 0, k = 1) { const L = 9.6 * k, piv = L + (k > 1 ? 2.3 : 1.6); // the giant one hangs low enough to hit the car frame2(s, piv + 0.3, 9.2 * k);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * k, 0.17 * k, 1, 12), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 })); shaft.castShadow = true; scene.add(shaft);
  const head = new THREE.Group(); const hm = hdMat('metal', [3, 1], { color: 0x6b7078, metalness: 0.9 }) || new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.85, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.6, 28), hm); body.rotation.z = Math.PI / 2; body.castShadow = true; head.add(body);
  for (const sd of [-1, 1]) { const face = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.22, 28), new THREE.MeshStandardMaterial({ color: 0xe0322b, metalness: 0.4, roughness: 0.4 })); face.rotation.z = Math.PI / 2; face.position.x = sd * 1.25; head.add(face);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.3, 28), hazard(2.6)); band.rotation.z = Math.PI / 2; band.position.x = sd * 0.55; head.add(band); }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), steel); cap.position.y = 0.75; head.add(cap);
  head.scale.setScalar(k); scene.add(head); OBS.balls.push({ s, L, pivot: new V3(0, piv, -s), chain: shaft, ball: head, amp: k > 1 ? 0.46 : 1.05, w: k > 1 ? 1.25 : 1.55, r: 1.15 * k, hl: 1.3 * k, hr: 0.8 * k, k, near: false, pos: new V3(), ph, hammer: true, big: k > 1 }); }
for (const [s, ph] of (L.hammers || [])) addHammer(s, ph);
if (L.bigHammer) addHammer(L.bigHammer.s, 0, L.bigHammer.k || 2); // one giant hammer at the bottom of the skyscraper ramp
// 2. piston crushers over two lanes, out of phase
function addPress(s, blocks) { frame2(s, 7.5, HALF + 0.6);
  for (const [x, ph] of blocks) { const block = new THREE.Mesh(new RoundedBoxGeometry(2.7, 1.1, 2.2, 3, 0.08), hazard(2.7)); block.castShadow = true; scene.add(block); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 14), steel); scene.add(rod); OBS.presses.push({ s, x, w: 2.7, d: 2.2, ph, block, rod, bottom: 5, near: false }); } }
for (const p of L.presses) addPress(p.s, p.blocks);
// 2b. giant press over the whole road (level option L.bigPress = { s, k }): pure timing, under it while it is up or flattened
function addBigPress(s, k = 2) { const fh = 7.5 * k; frame2(s, fh + 0.4, HALF + 1.4);
  const w = HALF * 2 + 0.6, h = 1.4 * k, d = 2.4 * k;
  const block = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.12), hazard(w)); block.castShadow = true; scene.add(block);
  for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), neon(0xff3a2a, 3)); l.position.set(sd * (w / 2 - 0.4), -h / 2 + 0.1, d / 2 + 0.02); block.add(l); }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 18), steel); scene.add(rod);
  OBS.presses.push({ s, x: 0, w, d, ph: 0, block, rod, bottom: 5, near: false, h, fh, top: 4.6 * k, seq: [1.3, 0.22, 1.0, 1.0], big: true }); } // stays down a full second
if (L.bigPress) addBigPress(L.bigPress.s, L.bigPress.k);
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
// 4b. speed bumps across the road (level option L.bumps = [s, ...]): driving over one bounces the car and costs HP, more the faster; jump them to stay clean
OBS.bumps = [];
if (L.bumps && L.bumps.length) {
  const bt = tex(64, 512, (g, w, h) => { g.fillStyle = '#16141c'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffc21a'; for (let i = 0; i < 8; i += 2) g.fillRect(0, i * 64, w, 64); }); // yellow and black bands across the road
  const bg = new THREE.CylinderGeometry(1, 1, HALF * 2, 24, 1, false, 0, Math.PI); bg.rotateZ(Math.PI / 2); bg.scale(1, 0.18, 0.5); // a half-round hump: 0.18 m high, 1 m long
  const bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 });
  const eyeM = neon(0xffffff, 2.2);
  for (const s of L.bumps) {
    const m = new THREE.Mesh(bg, bm); m.position.set(0, 0, -s); m.receiveShadow = true; m.castShadow = true; scene.add(m);
    for (let x = -HALF + 0.6; x < HALF; x += 1.2) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), eyeM); e.position.set(x, 0.17, -s); scene.add(e); } // reflective studs
    OBS.bumps.push({ s, m, hit: false });
  }
}
const BUMP_N = OBS.bumps.length;
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
  for (const b of OBS.bumps) { b.hit = false; b.m.scale.y = 1; }
  if (L.randomPhase) { for (const b of OBS.balls) b.ph = rand(0, TAU); for (const p of OBS.presses) p.ph = rand(0, 10); } // every attempt meets the trap at a different moment: will he make it this time?
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
    const [tu, ts, td, tr] = p.seq || [0.9, 0.18, 0.37, 0.75], top = p.top || 4.6, bh = p.h || 1.1, fh = p.fh || 7.5, c = tu + ts + td + tr, q = (t + p.ph) % c; let off; // seconds up, slamming, down, rising
    if (q < tu) off = top; else if (q < tu + ts) { const k = (q - tu) / ts; off = top - (top - 0.35) * k * k; } else if (q < tu + ts + td) off = 0.35; else off = 0.35 + (top - 0.35) * Math.min(1, (q - tu - ts - td) / tr);
    if (p.bottom > 0.6 && off <= 0.36 && Math.abs(riderS - p.s) < (p.big ? 140 : 40)) { tone(90, 40, p.big ? 0.4 : 0.18, 'sine', p.big ? 0.25 : 0.12); burst(new V3(p.x, 0.2, -p.s), p.big ? 40 : 10, SPARK, p.big ? 6 : 3); if (p.big && !reduceMotion && Math.abs(riderS - p.s) < 60) shake = Math.max(shake, 0.25); }
    p.bottom = off; p.block.position.set(p.x, off + bh / 2, -p.s); p.rod.scale.y = Math.max(0.1, fh - (off + bh)); p.rod.position.set(p.x, off + bh + p.rod.scale.y / 2, -p.s);
  }
  for (const b of OBS.barrels) {
    if (state === 'ride' && riderS > b.s0 - 95) b.s -= b.v * dt;
    if (b.cart) b.m.position.set(b.x, 0, -b.s); else { b.m.position.set(b.x, b.r, -b.s); b.m.rotation.x -= b.v * dt / b.r; }
  }
  for (const sw of OBS.sweepers) { sw.arm.rotation.y = t * sw.w; }
  for (const w of OBS.walls) { w.x = Math.sin(t * w.sp) * w.A; w.m.position.set(w.x, 1.5, -w.s); }
  for (const b of OBS.bumps) if (b.m.scale.y < 1) b.m.scale.y = Math.min(1, b.m.scale.y + dt * 2.5);
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
  'OIL SLICK': ['Slippery for 3 s', 0], 'FIRST AID': ['+50 health', 1], 'ARM CANNON': ['3 shots', 1], 'REPAIR': ['All parts back', 1],
  'SUPER JUMP': ['Jumps x1.5 for 6 s', 1], 'BOWLING BALL': ['Strike! Dodge it', 0], 'LIGHTNING STORM': ['Watch the sky!', 0],
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
  return { s, gi, sides, keys: ['A', 'B'], fx: ['FIRST AID', 'BOWLING BALL'], used: false };
});
let GATE_LAYOUT = [];
function layoutGates(lay) {
  GATE_LAYOUT = lay.map(a => a.slice());
  GATES.forEach((gt, i) => {
    const [fa, fb] = lay[i] || []; gt.fx = [MYSTERY[fa] ? fa : 'FIRST AID', MYSTERY[fb] ? fb : 'BOWLING BALL'];
    gt.keys = ['A', 'B'];
    gt.sides.forEach((sd, k) => {
      const col = GATE_INFO[gt.keys[k]][2];
      sd.signMat.map = gateTex(gt.keys[k]); sd.signMat.needsUpdate = true;
      sd.postMat.color.copy(glowColor(col, 2.2)); sd.curMat.color.set(col);
      sd.flash = 0;
    });
  });
}
function randomGates() { layoutGates(GATES.map(() => { const a = pick(MYSTERY_KEYS); let b = pick(MYSTERY_KEYS); while (b === a || (!MYSTERY[a][1] && !MYSTERY[b][1])) b = pick(MYSTERY_KEYS); return Math.random() < 0.5 ? [a, b] : [b, a]; })); for (const gt of GATES) gt.used = false; } // every door has at least one good side
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

// ---------- hydraulic press (lab): the plate comes down slowly, the pressure counter climbs, parts give way one by one ----------
const PRESS_TONS = [50, 100, 200, 500, 1000]; // the five press levels
const PRESS = new THREE.Group(); PRESS.visible = false; scene.add(PRESS);
Object.assign(PRESS, { mode: 'idle', bottom: 0, t: 0, step: 0, snd: 0 });
{
  const steel = new THREE.MeshStandardMaterial({ color: 0x4b515c, metalness: 0.75, roughness: 0.4 }), yellow = new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.5, roughness: 0.45 }), chrome = new THREE.MeshStandardMaterial({ color: 0xd5dae2, metalness: 0.95, roughness: 0.15 }), orange = new THREE.MeshStandardMaterial({ color: 0xe0501b, metalness: 0.4, roughness: 0.5 });
  const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; PRESS.add(o); return o; };
  for (const sx of [-2.6, 2.6]) box(0.4, 6.5, 0.5, sx, 3.25, 0, steel); // two columns
  box(6.0, 0.8, 1.0, 0, 6.45, 0, steel); // top beam
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 24), orange); cyl.position.y = 5.5; cyl.castShadow = true; PRESS.add(cyl);
  PRESS.rod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 18), chrome); PRESS.rod.castShadow = true; PRESS.add(PRESS.rod);
  PRESS.plate = new THREE.Group(); PRESS.add(PRESS.plate);
  const pl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.36, 2.6), yellow); pl.castShadow = true; PRESS.plate.add(pl);
  for (const sz of [-1.31, 1.31]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x16141c })); b.position.set(0, 0, sz); PRESS.plate.add(b); }
  PRESS.gauge = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), sign('PRESS 10 TONS', '#16141c', '#ffc21a', 768, 192)); PRESS.gauge.position.set(0, 0, 1.32); PRESS.plate.add(PRESS.gauge);
}
function pressPlace(bottom) { PRESS.bottom = bottom; PRESS.plate.position.y = bottom + 0.18; const top = bottom + 0.36, L = Math.max(0.05, 5.0 - top); PRESS.rod.scale.set(1, L, 1); PRESS.rod.position.y = top + L / 2; }
function pressYaw() { return LAB_YAW + Math.atan2(FACE_N ? FACE_N.x : 0, FACE_N ? FACE_N.z : 1); }
function pressStep(dt, lv) {
  const T = PRESS_TONS[clamp(lv, 1, 5) - 1], contact = HEAD_TOP - 0.2, M = PRESS.mode; PRESS.snd -= dt;
  if (M === 'desc') {
    pressPlace(PRESS.bottom - 0.55 * dt);
    if (PRESS.snd <= 0) { PRESS.snd = 0.28; if (AC) { OUT(); noise(AC.currentTime, 0.3, 0.035, 'bandpass', 1300, 500, 1.2); } } // hydraulic hiss
    if (PRESS.bottom <= contact) { pressPlace(contact); PRESS.mode = 'load'; PRESS.t = 0; PRESS.step = 0; tone(180, 90, 0.2, 'sine', 0.2); }
  } else if (M === 'load') {
    PRESS.t += dt; const e = clamp(PRESS.t / 2.6, 0, 1), p = T * e * e * (3 - 2 * e);
    labDmg(true, p, 'PRESSURE', ' TONS');
    crouch = Math.min(1, 0.3 + e * (0.25 + T / 150)); pressPlace(contact - 0.1 * e * Math.min(1, T / 100));
    if (!reduceMotion) shake = Math.max(shake, 0.015 + 0.05 * e);
    if (PRESS.snd <= 0) { PRESS.snd = 0.16; tone(200 + p * 2, 170 + p * 2, 0.12, 'sawtooth', 0.02 + e * 0.02); } // creaking metal
    const hp = new V3(0, HEAD_TOP, 0);
    if (PRESS.step < 1 && p >= 60) { PRESS.step = 1; labLose(1); burst(hp, 50, SPARK, 6); ripSound(); lastPop = 0; pop('CRACK!', 'lilac'); setFace('hit', 99999); }
    if (PRESS.step < 2 && p >= 120) { PRESS.step = 2; labLose(1); burst(hp, 70, SPARK, 8); ripSound(); lastPop = 0; pop('SNAP!', 'lilac'); }
    if (PRESS.step < 3 && p >= 200) {
      PRESS.step = 3; labCrash('press'); crashSound(clamp(T / 1000 + 0.35, 0.4, 1)); hitStopUntil = performance.now() + 70; burst(hp, 120, SPARK, 10);
      if (T >= 500) { labPancake(); LAB.text = 'flattened into a pancake'; } else { labScatter(1 + T / 500, 0.5); LAB.text = 'crushed to pieces'; }
      if (!reduceMotion) shake = Math.min(0.9, 0.4 + T / 1500); PRESS.mode = 'crush'; return;
    }
    if (e >= 1) { if (PRESS.step === 0) { lastPop = 0; pop('HE HOLDS!', 'green'); labFinish('survived'); } else labFinish('lost ' + LAB.lost + (LAB.lost === 1 ? ' part' : ' parts')); PRESS.mode = 'hold'; PRESS.t = 0; }
  } else if (M === 'crush') {
    pressPlace(Math.max(STAND_H + 0.02, PRESS.bottom - 1.6 * dt)); if (PRESS.bottom <= STAND_H + 0.021) { PRESS.mode = 'hold'; PRESS.t = 0; if (!reduceMotion) shake = Math.max(shake, 0.5); }
  } else if (M === 'hold') { PRESS.t += dt; if (PRESS.t > 1.4) PRESS.mode = 'lift'; }
  else if (M === 'lift') { pressPlace(PRESS.bottom + 1.6 * dt); if (PRESS.bottom >= HEAD_TOP + 1.6) PRESS.mode = 'idle'; }
}

// ---------- bowling ball gate: a big glossy ball drops in ahead, bounces and rolls at him, smashing low things on its way ----------
const BOWL = (() => {
  const r = 0.7;
  const skin = tex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0a1a66'); gr.addColorStop(0.5, '#1f4fd6'); gr.addColorStop(1, '#091347'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 52; i++) { g.strokeStyle = 'rgba(' + (i % 3 ? '150,205,255' : '255,255,255') + ',' + (0.05 + Math.random() * 0.15).toFixed(2) + ')'; g.lineWidth = 2 + Math.random() * 16; g.beginPath(); const y0 = Math.random() * h; g.moveTo(0, y0); g.bezierCurveTo(w * 0.3, y0 + (Math.random() - 0.5) * 240, w * 0.65, y0 + (Math.random() - 0.5) * 240, w, y0 + (Math.random() - 0.5) * 120); g.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshPhysicalMaterial({ map: skin, roughness: 0.14, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x0a1a55, emissiveIntensity: 0.3 }));
  m.castShadow = true; m.visible = false; scene.add(m);
  const holeM = new THREE.MeshBasicMaterial({ color: 0x03030a }), up = new V3(0, 0, 1);
  for (const [th, ph, rr] of [[0.24, 0, 0.085], [0.24, 0.8, 0.085], [0.58, 3.9, 0.1]]) { // two finger holes and a thumb hole
    const n = new V3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)), d = new THREE.Mesh(new THREE.CircleGeometry(rr, 20), holeM);
    d.position.copy(n).multiplyScalar(r * 1.003); d.quaternion.setFromUnitVectors(up, n); m.add(d);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.15, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.visible = false; scene.add(shadow);
  const mark = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 40), new THREE.MeshBasicMaterial({ color: glowColor(0xff3a3a, 2), transparent: true, opacity: 0.85, depthWrite: false })); mark.rotation.x = -Math.PI / 2; mark.visible = false; scene.add(mark);
  const smash = DESTR.filter(d => OBS.hurdles.includes(d.obj) || OBS.barrels.includes(d.obj));
  return { r, m, shadow, mark, smash };
})();
function bowlShow(on, x, y, s, rot, markOn, mx, ms, t) {
  const B = BOWL; B.m.visible = on;
  if (on) { B.m.position.set(x, y, -s); B.m.rotation.set(rot, 0, 0); const gr = trackH(s); B.shadow.visible = gr != null; if (gr != null) { B.shadow.position.set(x, gr + 0.03, -s); B.shadow.scale.setScalar(clamp(1.3 - (y - gr - B.r) * 0.1, 0.5, 1.2)); } } else B.shadow.visible = false;
  B.mark.visible = markOn; if (markOn) { B.mark.position.set(mx, (trackH(ms) ?? 0) + 0.04, -ms); B.mark.scale.setScalar(1 + Math.sin((t || 0) * 18) * 0.1); }
}
function spawnBowl() {
  const T = 2.0, v0 = Math.max(R.speed, 8); let vs = 13, D = (v0 + vs) * T;
  D = Math.min(D, 95); if (DLV) D = Math.min(D, DOOR_S - 4 - R.s);
  while (D > 24 && trackH(R.s + D) == null) D -= 4;
  if (D < 24 || trackH(R.s + D) == null) return;
  vs = clamp(D / T - v0, 6, 16); // it reaches him about 2 s after it appears
  const s0 = R.s + D, fl = trackH(s0), y0 = fl + BOWL.r + 3.2, tl = Math.sqrt(2 * 3.2 / 9.8);
  FX.bowl = { on: true, s: s0, x: clamp(R.x, -HALF + 0.9, HALF - 0.9), y: y0, vy: 0, vs, t: 0, rot: 0, landed: false, ms: s0 - vs * tl, near: false, struck: false, rumble: 0 };
  tone(90, 60, 0.4, 'sawtooth', 0.05); setFace('scared', 900);
}
function stepBowl(dt) {
  const b = FX.bowl; if (!b || !b.on) return;
  b.t += dt; b.s -= b.vs * dt; b.vy -= 9.8 * dt; b.y += b.vy * dt;
  const fl = trackH(b.s), floor = fl == null ? -90 : fl;
  if (floor > -80) {
    if (b.y - BOWL.r <= floor) { b.y = floor + BOWL.r; if (b.vy < -1.2) { b.vy = -b.vy * 0.38; burst(new V3(b.x, floor + 0.15, -b.s), 14, SPARK, 3); clank(9); tone(80, 35, 0.25, 'sine', 0.1); if (!reduceMotion && Math.abs(R.s - b.s) < 40) shake = Math.min(0.5, shake + 0.1); b.landed = true; } else b.vy = 0; }
  } else if (b.y < -6) { b.on = false; bowlShow(false); return; } // dropped into a gap
  b.rot += b.vs / BOWL.r * dt;
  if (b.landed && b.vy === 0 && (b.rumble -= dt) <= 0 && Math.abs(R.s - b.s) < 45) { b.rumble = 0.14; tone(55, 48, 0.2, 'sawtooth', 0.035); }
  for (const d of BOWL.smash) { // low fences and barrels are flattened
    if (d.obj.dead) continue;
    if (Math.abs(b.s + d.z()) < BOWL.r + 0.45 && Math.abs(b.x - d.x()) < d.hw + BOWL.r * 0.6 && b.y - BOWL.r < d.yy()[1]) { d.obj.dead = true; d.vis.visible = false; burst(new V3(b.x, 0.8, -b.s), 18, CONF, 5); clank(8); if (!b.struck) { b.struck = true; lastPop = 0; pop('STRIKE!', 'green'); } }
  }
  for (const c of OBS.cones) if (!c.hit && Math.abs(b.s - c.s0) < BOWL.r + 0.4 && Math.abs(b.x - c.x0) < BOWL.r + 0.5) { c.hit = true; c.v.set((c.x0 - b.x) * 6 + rand(-2, 2), rand(4, 7), b.vs * 0.8); c.w.set(rand(-12, 12), 0, rand(-12, 12)); clank(4); }
  if (b.s < R.s - 16) { b.on = false; bowlShow(false); return; } // rolled past him
  bowlShow(true, b.x, b.y, b.s, b.rot, !b.landed, b.x, b.ms, b.t);
}

// ---------- lightning storm gate: red circles appear ahead, a moment later a bolt hits each one ----------
const BOLT_BOX = new THREE.BoxGeometry(1, 1, 1);
const STR = Array.from({ length: 8 }, () => {
  const mk = (op) => new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
  const ringM = mk(0.8), discM = mk(0.15), coreM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: false }), glowM = new THREE.MeshBasicMaterial({ color: 0x8fc8ff, transparent: true, depthWrite: false, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.25, 40), ringM), disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), discM);
  ring.rotation.x = disc.rotation.x = -Math.PI / 2; ring.visible = disc.visible = false; scene.add(ring, disc);
  const seg = (m) => { const o = new THREE.Mesh(BOLT_BOX, m); o.visible = false; o.frustumCulled = false; scene.add(o); return o; };
  const core = [], glow = []; for (let i = 0; i < 7; i++) { core.push(seg(coreM)); glow.push(seg(glowM)); }
  return { ring, disc, ringM, discM, coreM, glowM, core, glow };
});
function srand(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
const _bp = Array.from({ length: 8 }, () => new V3()), _bu = new V3(0, 1, 0), _bd = new V3();
function strikeShow(i, phase, x, s, age) {
  const S = STR[i], warn = phase === 1, bolt = phase === 2, g = (warn || bolt) ? (trackH(s) ?? 0) : 0;
  S.ring.visible = S.disc.visible = warn || bolt;
  if (warn || bolt) {
    S.ring.position.set(x, g + 0.04, -s); S.disc.position.set(x, g + 0.035, -s);
    S.ring.scale.setScalar((1 + Math.sin(age * 22) * 0.08) * (bolt ? 1.2 : 1));
    S.ringM.opacity = bolt ? 1 - age / 0.25 : 0.55 + Math.sin(age * 22) * 0.3; S.discM.opacity = warn ? 0.12 + age * 0.35 : 0.5 * (1 - age / 0.25);
  }
  for (let j = 0; j < 7; j++) S.core[j].visible = S.glow[j].visible = bolt;
  if (!bolt) return;
  const seed = s * 13.7 + x * 3.1, fl = (Math.floor(age * 60) % 2 ? 1 : 0.65) * Math.max(0, 1 - age / 0.25);
  S.coreM.opacity = fl; S.glowM.opacity = fl * 0.45;
  for (let j = 0; j < 8; j++) { const t = j / 7, k = 1 - t; _bp[j].set(x + (srand(seed + j * 3.1) * 2 - 1) * 2.4 * k * (j ? 1 : 1.5), 26 + (g - 26) * t, -s + (srand(seed + j * 5.3 + 9) * 2 - 1) * 0.9 * k); }
  _bp[7].set(x, g, -s);
  for (let j = 0; j < 7; j++) {
    _bd.subVectors(_bp[j + 1], _bp[j]); const len = _bd.length(); _bd.normalize();
    for (const [o, w] of [[S.core[j], 0.16], [S.glow[j], 0.6]]) { o.position.addVectors(_bp[j], _bp[j + 1]).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(_bu, _bd); o.scale.set(w, len, w); }
  }
}
function stepStorm(dt) {
  const S = FX.storm; if (!S) return;
  S.t += dt; let alive = false;
  S.list.forEach((st, i) => {
    if (st.done) return; alive = true;
    if (st.phase === 0) {
      if (S.t < st.t0) return;
      st.s = R.s + Math.max(R.speed, 8) * 0.6 + (st.aim ? rand(5, 9) : rand(8, 34)); st.x = st.aim ? clamp(R.x, -HALF + 0.8, HALF - 0.8) : rand(-HALF + 0.8, HALF - 0.8);
      if (trackH(st.s) == null) { st.done = true; return; } // no ground there
      st.phase = 1; st.age = 0; tone(900, 900, 0.05, 'square', 0.025);
    } else if (st.phase === 1) {
      st.age += dt;
      if (st.age >= 0.6) {
        st.phase = 2; st.age = 0; burst(new V3(st.x, (trackH(st.s) ?? 0) + 0.4, -st.s), 30, SPARK, 6); tone(2400, 300, 0.1, 'square', 0.05); tone(70, 28, 0.6, 'sawtooth', 0.1);
        if (!reduceMotion && Math.abs(R.s - st.s) < 25) shake = Math.min(0.5, shake + 0.12);
        if (state === 'ride' && Math.abs(R.x - st.x) < 1.3 && Math.abs(R.s - st.s) < 1.5 && R.y < 2.5) { R.grounded = false; R.vy = 9; setHP(HP - 15); graze({}, R.x >= st.x ? 1 : -1, Math.random() < 0.3); if (state !== 'ride') return; lastPop = 0; pop('ZAP!'); }
      }
    } else { st.age += dt; if (st.age >= 0.25) { st.phase = 0; st.done = true; } }
    strikeShow(i, st.phase, st.x, st.s, st.age);
  });
  if (!alive) { FX.storm = null; for (let i = 0; i < 8; i++) strikeShow(i, 0, 0, 0, 0); }
}
// what the replay needs: ball + strikes of this frame
function bxRec() {
  const B = FX.bowl, a = [B && B.on ? 1 : 0, B ? B.x : 0, B ? B.y : 0, B ? B.s : 0, B ? B.rot : 0, B && B.on && !B.landed ? 1 : 0, B ? B.ms : 0, B ? B.t : 0];
  if (FX.storm) for (const st of FX.storm.list) a.push(st.phase, st.x, st.s, st.age); else for (let i = 0; i < 8; i++) a.push(0, 0, 0, 0);
  return a;
}
function bxApply(a) {
  if (!a) { bowlShow(false); for (let i = 0; i < 8; i++) strikeShow(i, 0, 0, 0, 0); return; }
  bowlShow(!!a[0], a[1], a[2], a[3], a[4], !!a[5], a[1], a[6], a[7]);
  for (let i = 0; i < 8; i++) strikeShow(i, a[8 + i * 4], a[9 + i * 4], a[10 + i * 4], a[11 + i * 4]);
}
function resetFx() { Object.assign(FX, { grav: 1, gravT: 0, jump: 1, jumpT: 0, boostT: 0 }); for (const r of RAIN) { r.on = false; r.m.visible = false; } FX.anvil = null; ANVIL.visible = false; ANVIL_RING.visible = false; FX.bowl = null; FX.storm = null; bxApply(null); }
function applyFx(name) {
  const now = performance.now();
  if (name === 'TNT RAIN') { RAIN.forEach((r, i) => { Object.assign(r, { on: true, x: rand(-3.4, 3.4), vy: 0, lead: 4 + i * 3.5 + rand(0, 2.5) }); r.y = rand(12, 20) + i * 1.5; r.s = R.s + Math.max(R.speed, 12) * Math.sqrt(2 * r.y / 9.8) + r.lead; r.m.visible = true; }); }
  else if (name === 'MOON GRAVITY') { FX.grav = 0.35; FX.gravT = 6; }
  else if (name === 'ROCKET BOOST') { FX.boostT = 2.5; R.speed = Math.min(40, R.speed + 12); if (R.grounded) { R.grounded = false; R.vy = 4; } burst(new V3(R.x, R.y + 0.4, -R.s + 0.8), 60, SPARK, 8); tone(200, 1400, 0.6, 'sawtooth', 0.05); }
  else if (name === 'OIL SLICK') { R.slip = 3; }
  else if (name === 'FIRST AID') { setHP(Math.min(100, HP + 50)); burst(torso.getWorldPosition(new V3()), 40, CONF, 5); tone(500, 1500, 0.3, 'sine', 0.06); }
  else if (name === 'ARM CANNON') { equipCannon(); }
  else if (name === 'REPAIR') { while (detached.length) reattach(); stumps.length = 0; setHP(100); burst(torso.getWorldPosition(new V3()), 50, CONF, 6); }
  else if (name === 'SUPER JUMP') { FX.jump = 1.45; FX.jumpT = 6; }
  else if (name === 'ANVIL') { const T = 1.6; FX.anvil = { x: R.x, s: R.s + Math.max(R.speed, 12) * T + 5, y: 20 * T * T / 2 + 0.2, vy: 0, landed: false }; ANVIL.visible = true; ANVIL_RING.visible = true; tone(1200, 1200, 0.1, 'square', 0.05); tone(1200, 1200, 0.1, 'square', 0.05, 0.2); }
  else if (name === 'BOWLING BALL') spawnBowl();
  else if (name === 'LIGHTNING STORM') { FX.storm = { t: 0, list: Array.from({ length: 8 }, (_, i) => ({ t0: 0.15 + i * 0.45 + rand(0, 0.2), aim: i % 4 === 1, phase: 0, age: 0, done: false, x: 0, s: 0 })) }; tone(100, 40, 0.5, 'sawtooth', 0.06); }
}
function stepFx(dt) {
  stepBowl(dt); stepStorm(dt);
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
  if (!reduceMotion) shake = Math.min(0.5, shake + 0.2); slowUntil = performance.now() + 100; slowK = 0.6;
  revealFx(name, false); applyFx(name);
  const good = MYSTERY[name][1]; setFace(good ? 'happy' : 'scared', 1200);
  if (good) { tone(300, 1200, 0.35, 'square', 0.05); tone(600, 1800, 0.3, 'square', 0.04, 0.15); } else tone(700, 150, 0.45, 'sawtooth', 0.05);
}

// ---------- the flock: up to 5 Daggies ride together, loosely like a flock of birds ----------
// (the old "versions" system is switched off; these stubs keep the hooks elsewhere harmless)
const PW = { size: 1 }, FORM = { kind: '' };
function powerHit() { return false; }
function formMax() { return FX.boostT > 0 ? VMAX + 6 : VMAX; }
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
  { const B = FX.bowl; if (B && B.on && Math.abs(s - B.s) < 1.6 && Math.hypot(x - B.x, clamp(B.y, y0, y1) - B.y, s - B.s) < BOWL.r + 0.1) return ['ball', Math.sign(x - B.x) || 1]; }
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
  if (!reduceMotion) shake = Math.min(0.5, shake + 0.2); slowUntil = performance.now() + 100; slowK = 0.6;
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
const SPN = 900, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spVel = Array.from({ length: SPN }, () => new V3()), spLife = new Float32Array(SPN);
for (let i = 0; i < SPN; i++) spPos[i * 3 + 1] = -99;
// sparks are drawn as short glowing streaks stretched along their velocity (camera-facing quads), like real sparks, not round dots
const spGeo = new THREE.BufferGeometry(), spQuadPos = new Float32Array(SPN * 12), spQuadCol = new Float32Array(SPN * 12), spQuadUv = new Float32Array(SPN * 8), spQuadIdx = new Uint16Array(SPN * 6);
for (let i = 0; i < SPN; i++) { const v = i * 4; spQuadIdx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6); spQuadUv.set([0, 1, 1, 1, 0, 0, 1, 0], i * 8); for (let k = 0; k < 4; k++) spQuadPos[i * 12 + k * 3 + 1] = -99; }
spGeo.setAttribute('position', new THREE.BufferAttribute(spQuadPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spQuadCol, 3)); spGeo.setAttribute('uv', new THREE.BufferAttribute(spQuadUv, 2)); spGeo.setIndex(new THREE.BufferAttribute(spQuadIdx, 1));
const SPARK_TEX = tex(32, 128, (g, w, h) => { // bright hot head at the bottom (v=1 is the head), thin fading tail; soft sides
  g.clearRect(0, 0, w, h); const side = g.createLinearGradient(0, 0, w, 0); side.addColorStop(0, 'rgba(255,255,255,0)'); side.addColorStop(0.5, 'rgba(255,255,255,1)'); side.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = side; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in'; const along = g.createLinearGradient(0, 0, 0, h); along.addColorStop(0, 'rgba(255,255,255,0)'); along.addColorStop(0.7, 'rgba(255,255,255,0.55)'); along.addColorStop(0.93, 'rgba(255,255,255,1)'); along.addColorStop(1, 'rgba(255,255,255,0.8)'); g.fillStyle = along; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
});
const SPARK_POINTS = new THREE.Mesh(spGeo, new THREE.MeshBasicMaterial({ map: SPARK_TEX, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
SPARK_POINTS.frustumCulled = false; // its bounding box was computed once from the parked sparks (all under the floor), so it was always culled and no spark was ever drawn
scene.add(SPARK_POINTS);
const _sv = new V3(), _sw = new V3(), _sd = new V3();
function sparkQuads() {
  const cp = camera.position;
  for (let i = 0; i < SPN; i++) {
    const o = i * 12;
    if (spLife[i] <= 0) { for (let k = 0; k < 4; k++) { spQuadPos[o + k * 3] = 0; spQuadPos[o + k * 3 + 1] = -99; spQuadPos[o + k * 3 + 2] = 0; } continue; }
    const px = spPos[i * 3], py = spPos[i * 3 + 1], pz = spPos[i * 3 + 2], v = spVel[i], sp = v.length();
    _sv.copy(v); if (sp > 1e-3) _sv.multiplyScalar(1 / sp); else _sv.set(0, 1, 0);
    _sd.set(px - cp.x, py - cp.y, pz - cp.z); _sw.crossVectors(_sv, _sd); const wl = _sw.length(); if (wl < 1e-5) _sw.set(1, 0, 0); else _sw.multiplyScalar(1 / wl);
    const len = clamp(sp * 0.05, 0.07, 0.65), hw = 0.022 + Math.min(0.02, sp * 0.002), tx = px - _sv.x * len, ty = py - _sv.y * len, tz = pz - _sv.z * len, tw = hw * 0.55;
    // vertices: tail-left, tail-right, head-left, head-right (uv v: 0 tail, 1 head matches the texture)
    spQuadPos[o] = tx - _sw.x * tw; spQuadPos[o + 1] = ty - _sw.y * tw; spQuadPos[o + 2] = tz - _sw.z * tw;
    spQuadPos[o + 3] = tx + _sw.x * tw; spQuadPos[o + 4] = ty + _sw.y * tw; spQuadPos[o + 5] = tz + _sw.z * tw;
    spQuadPos[o + 6] = px - _sw.x * hw; spQuadPos[o + 7] = py - _sw.y * hw; spQuadPos[o + 8] = pz - _sw.z * hw;
    spQuadPos[o + 9] = px + _sw.x * hw; spQuadPos[o + 10] = py + _sw.y * hw; spQuadPos[o + 11] = pz + _sw.z * hw;
    const f = Math.min(1, spLife[i] * 3), r = spCol[i * 3] * f, g = spCol[i * 3 + 1] * f, b = spCol[i * 3 + 2] * f;
    for (let k = 0; k < 4; k++) { spQuadCol[o + k * 3] = r; spQuadCol[o + k * 3 + 1] = g; spQuadCol[o + k * 3 + 2] = b; }
  }
}
let spNext = 0;
const SPARK = [[4, 2.6, 0.6], [4, 1.8, 0.4], [3, 3, 2.2]], CONF = [[4, 2.8, 0.2], [2.8, 1, 4], [0.8, 3, 4], [0.8, 4, 1.8]];
function burst(p, n, pal, sp) {
  recEvt('b', [p.x, p.y, p.z, n, pal === CONF ? 1 : 0, sp || 0]); if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'b', a: [p.x, p.y, p.z, n, pal, sp] });
  for (let k = 0; k < n; k++) {
    const i = spNext; spNext = (spNext + 1) % SPN;
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spVel[i].set(rand(-1, 1), rand(-0.1, 1.3), rand(-1, 1)).normalize().multiplyScalar(rand(0.3, 1) * sp);
    spLife[i] = rand(0.4, 1.1) * (sp > 6 ? 1.35 : 1);
    const c = pick(pal); spCol[i * 3] = c[0]; spCol[i * 3 + 1] = c[1]; spCol[i * 3 + 2] = c[2];
  }
}
let spWas = false;
function updateSparks(dt) {
  let any = false;
  for (let i = 0; i < SPN; i++) {
    if (spLife[i] <= 0) continue; any = true;
    spLife[i] -= dt;
    if (spLife[i] <= 0) { spPos[i * 3 + 1] = -99; continue; }
    spVel[i].y -= 9.8 * dt; spVel[i].multiplyScalar(Math.pow(0.5, dt));
    spPos[i * 3] += spVel[i].x * dt; spPos[i * 3 + 1] += spVel[i].y * dt; spPos[i * 3 + 2] += spVel[i].z * dt;
    const fl = floorAt(spPos[i * 3], spPos[i * 3 + 2]);
    if (spPos[i * 3 + 1] < fl) { spPos[i * 3 + 1] = fl; spVel[i].y *= -0.3; }
    if (spLife[i] < 0.3) { spCol[i * 3] *= 0.93; spCol[i * 3 + 1] *= 0.93; spCol[i * 3 + 2] *= 0.93; }
  }
  if (!any && !spWas) return; spWas = any; // nothing alive: skip the buffer work
  sparkQuads(); spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
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
    MASTER = AC.createGain(); TAILBUS = AC.createGain(); TAILBUS.connect(MASTER);
    const ls = AC.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 120; ls.gain.value = 5; // weight
    const pk = AC.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 280; pk.Q.value = 0.8; pk.gain.value = -2; // less mud
    const hs = AC.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 6500; hs.gain.value = 3; // air
    const sat = AC.createWaveShaper(), cv = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i * 2 / 2048 - 1; cv[i] = Math.tanh(x * 1.7) / Math.tanh(1.7); } sat.curve = cv; sat.oversample = '2x'; // density
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.003; comp.release.value = 0.22;
    SLOWLP = AC.createBiquadFilter(); SLOWLP.type = 'lowpass'; SLOWLP.frequency.value = 20000; SLOWLP.Q.value = 0.5;
    MASTER.connect(ls); ls.connect(pk); pk.connect(hs); hs.connect(SLOWLP); SLOWLP.connect(sat); sat.connect(comp); comp.connect(AC.destination);
    try { AUDIO_DEST = AC.createMediaStreamDestination(); comp.connect(AUDIO_DEST); } catch (e) { AUDIO_DEST = null; }
    try { const sr = AC.sampleRate, len = Math.floor(sr * 1.4), ir = AC.createBuffer(2, len, sr); // a hall: no sound for 20 ms, then early reflections, then a tail that gets darker
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += ((Math.random() * 2 - 1) - lp) * (1 - (0.15 + 0.8 * t) * 0.9); d[i] = i < sr * 0.02 ? 0 : lp * Math.pow(1 - t, 2.6); }
        for (const [ms, a2] of [[23, 0.7], [37, 0.55], [51, 0.5], [68, 0.4], [84, 0.35]]) { const j = Math.floor(sr * (ms + (c ? 5 : -3)) / 1000); d[j] += (Math.random() < 0.5 ? -1 : 1) * a2; } }
      const conv = AC.createConvolver(); conv.buffer = ir; const wet = AC.createGain(); wet.gain.value = 0.22; REVERB_IN = AC.createGain(); REVERB_IN.connect(conv); conv.connect(wet); wet.connect(comp); } catch (e) { REVERB_IN = null; }
    NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const nd = NOISE.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  return MASTER;
}
let SND_GAIN = 1, SND_WIDE = 0, SLOWLP = null, SND_BUS = null, TAILBUS = null;
function sendOut(node, rev, pan) { if (SND_GAIN !== 1) { const m = AC.createGain(); m.gain.value = SND_GAIN; node.connect(m); node = m; } if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = clamp(pan !== undefined ? pan : SND_WIDE ? (Math.random() * 2 - 1) * SND_WIDE : 0, -1, 1); node.connect(p); node = p; } node.connect(SND_BUS || OUT()); if (REVERB_IN && rev) { const g = AC.createGain(); g.gain.value = rev; node.connect(g); g.connect(REVERB_IN); } }
// filtered noise burst: thuds, scrapes, whooshes
function noise(t, dur, vol, type, f0, f1, q) { const src = AC.createBufferSource(); src.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur); const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(f); f.connect(g); sendOut(g, 0.25, type === 'lowpass' ? 0 : undefined); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05); }
function initAudio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } else if (AC.state === 'suspended') AC.resume(); if (AC) sfxPreload(); }
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

// ---------- layered crash sounds (synthesised; the master compressor glues the layers) ----------
let DIST = null;
function distCurve() { if (!DIST) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = Math.tanh(x * 6) * 0.9; } DIST = AC.createWaveShaper(); DIST.curve = c; DIST.oversample = '2x'; } return DIST; }
function noiseDist(t, dur, vol, f0, f1, q) { // overdriven band of noise: the crunch
  const src = AC.createBufferSource(); src.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
  const sh = AC.createWaveShaper(); sh.curve = distCurve().curve; const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(sh); sh.connect(g); sendOut(g, 0.3); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function sweep(t, f0, f1, dur, vol, type) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); sendOut(g, 0.3, f0 < 400 ? 0 : undefined); o.start(t); o.stop(t + dur + 0.05); } // low sweeps stay in the middle
function crashSound(p) { SND_WIDE = 0.6; try { crashSound0(p); } finally { SND_WIDE = 0; } }
function crashSound0(p) { // p 0..1: 15 mph is about 0.1, 200 mph is 1
  recEvt('c', [p]); if (!AC) return; OUT(); const t = AC.currentTime;
  sweep(t, 150 + 80 * p, 30, 0.3 + 0.45 * p, 0.5 + 0.5 * p); if (p > 0.15) sweep(t + 0.005, 62, 22, 0.5 + 0.7 * p, 0.3 + 0.4 * p, 'sine'); // body of the hit, and a sub under it
  noiseDist(t, 0.14 + 0.22 * p, 0.28 + 0.3 * p, 2600, 240, 1.1); // crunch
  noise(t, 0.05, 0.22, 'highpass', 3400, 1600, 0.7); // crack
  const f = rand(520, 760); // ringing metal: inharmonic partials
  for (const [r, a2, d] of [[1, 1, 0.55], [2.76, 0.6, 0.35], [5.4, 0.35, 0.22], [8.9, 0.2, 0.14]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f * r; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((0.03 + 0.05 * p) * a2, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d * (0.6 + p)); o.connect(g); sendOut(g, 0.35); o.start(t); o.stop(t + d * 2 + 0.05); }
  for (let i = 0, n = 5 + Math.round(11 * p); i < n; i++) noise(t + 0.06 + Math.random() * (0.35 + 0.4 * p), rand(0.025, 0.07), rand(0.05, 0.14), 'bandpass', rand(1800, 5200), rand(900, 2400), 3); // debris rattle
  if (p > 0.3) { sweep(t, 70, 22, 0.9 + p * 0.6, 0.55 * p, 'sine'); noise(t, 0.8 + p * 0.5, 0.35 * p, 'lowpass', 500, 60, 0.7); } // deep boom
  if (p > 0.6) { noise(t + 0.05, 0.5, 0.18, 'highpass', 6000, 2500, 0.7); } // glass-like air shatter
}

// ---------- sound: real recordings if the files are there, the synthesised layers otherwise ----------
// Drop files into the repo folder sfx/ named <name>1.mp3, <name>2.mp3, <name>3.mp3 (all optional). The game picks one at random with a small pitch change.
// names: cannon glass window wood hay brick stone ice metal vault rip thud truck car tires sand body creak
const SFX = { buf: {}, want: ['cannon', 'glass', 'window', 'wood', 'hay', 'brick', 'stone', 'ice', 'metal', 'vault', 'rip', 'thud', 'truck', 'car', 'tires', 'sand', 'body', 'creak'], started: false };
function sfxLoad(n, i) { fetch('sfx/' + n + i + '.mp3').then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(b => new Promise((res, rej) => AC.decodeAudioData(b, res, rej))).then(buf => { (SFX.buf[n] = SFX.buf[n] || []).push(buf); if (i < 3) sfxLoad(n, i + 1); }).catch(() => { SFX.buf[n] = SFX.buf[n] || []; }); }
function sfxPreload() { if (!AC || SFX.started) return; SFX.started = true; for (const n of SFX.want) sfxLoad(n, 1); } // one request per sound; the 2nd and 3rd are only asked for when the 1st exists
function sfxPlay(names, vol, rate, wet) { // true if a recording was played
  if (!AC) return false; for (const n of [].concat(names)) { const L = SFX.buf[n]; if (!L || !L.length) continue; OUT(); const src = AC.createBufferSource(), g = AC.createGain(); src.buffer = pick(L); src.playbackRate.value = (rate || 1) * rand(0.96, 1.04); g.gain.value = vol === undefined ? 1 : vol; src.connect(g); sendOut(g, wet === undefined ? 0.2 : wet); src.start(); return true; } return false;
}
function ping(t, f, dur, vol) { const o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.76; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); const g2 = AC.createGain(); g2.gain.value = 0.35; o.connect(g); o2.connect(g2); g2.connect(g); sendOut(g, 0.35); o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02); }

// ---------- sound that follows the physics: every piece that lands makes its own small sound, and the flight has wind ----------
const DSND = { tokens: 25, last: 0 };
function debrisHit(kind, v, size) { // v: speed at which the piece hit the floor (m/s), size: its largest dimension; at most ~45 of these a second so a phone can follow
  if (!AC) return; const now = AC.currentTime; DSND.tokens = Math.min(10, DSND.tokens + Math.max(0, now - DSND.last) * 22); DSND.last = now; if (DSND.tokens < 1) return; DSND.tokens--; OUT();
  const t = now, vv = clamp(v / 8, 0.2, 1), sz = clamp(size, 0.05, 1.5); SND_WIDE = 0.7;
  try {
    if (kind === 'glass') { ping(t, clamp(4200 * Math.exp(rand(-0.5, 0.5)) / Math.pow(sz * 4, 0.35), 1500, 11000), rand(0.03, 0.12), (0.03 + 0.05 * vv) * 1.6); if (v > 4) noise(t, 0.012, 0.05 * vv, 'highpass', 6000, 3000, 0.7); }
    else if (kind === 'wood') { noise(t, rand(0.025, 0.06), 0.16 * vv, 'bandpass', rand(900, 2200), 600, 3); sweep(t, rand(180, 300), 90, 0.05, 0.1 * vv, 'sine'); }
    else if (kind === 'stone') { noise(t, 0.07, 0.2 * vv, 'lowpass', rand(500, 1200), 150, 0.8); noise(t, 0.02, 0.1 * vv, 'bandpass', rand(2000, 4000), 1500, 3); }
    else if (kind === 'metal') { ping(t, rand(500, 1600), rand(0.15, 0.4), 0.05 * vv * 1.6); noise(t, 0.01, 0.06 * vv, 'highpass', 5000, 3000, 0.7); }
    else if (kind === 'box') noise(t, 0.07, 0.16 * vv, 'lowpass', rand(400, 1000), 120, 0.7);
    else if (kind === 'melon') { noise(t, 0.09, 0.2 * vv, 'bandpass', rand(300, 900), 200, 1.2); sweep(t, 140, 70, 0.08, 0.14 * vv, 'sine'); }
    else if (kind === 'barrel') { ping(t, rand(180, 320), 0.3, 0.07 * vv * 1.6); noise(t, 0.04, 0.1 * vv, 'bandpass', 1200, 800, 2); }
    else if (kind === 'pin') { noise(t, 0.03, 0.18 * vv, 'bandpass', rand(1500, 3000), 1000, 3); ping(t, rand(900, 1400), 0.08, 0.05 * vv * 1.6); }
    else if (kind === 'soft') noise(t, 0.08, 0.1 * vv, 'lowpass', 700, 200, 0.7);
  } finally { SND_WIDE = 0; }
}
const WIND = { src: null, bp: null, g: null };
function windSet(v) { // the rush of air around a fast flight; v in mph, 0 fades it out
  if (!AC) return; OUT(); if (!WIND.src) { const src = AC.createBufferSource(); src.buffer = NOISE; src.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6; const g = AC.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); if (AC.createStereoPanner) { const pn = AC.createStereoPanner(); g.connect(pn); pn.connect(OUT()); } else g.connect(OUT()); src.start(); WIND.src = src; WIND.bp = bp; WIND.g = g; }
  const t = AC.currentTime, target = v > 5 ? clamp(0.01 + v * 0.0001, 0, 0.1) : 0; WIND.bp.frequency.setTargetAtTime(250 + v * 2.2, t, 0.08); WIND.g.gain.setTargetAtTime(target, t, target ? 0.15 : 0.3);
}
function duckTail() { if (!AC || !TAILBUS) return; const t = AC.currentTime; TAILBUS.gain.cancelScheduledValues(t); TAILBUS.gain.setValueAtTime(0.18, t); TAILBUS.gain.setTargetAtTime(1, t + 0.1, 0.3); } // every new impact pushes the cannon's long tail down for a moment, so it does not drown the sounds
function windDuck() { if (!AC || !WIND.g) return; const t = AC.currentTime; WIND.g.gain.cancelScheduledValues(t); WIND.g.gain.setValueAtTime(0, t); } // the next frame brings it back: a dip around every impact
function sndSlow(on) { if (AC && SLOWLP) SLOWLP.frequency.setTargetAtTime(on ? 3600 : 20000, AC.currentTime, 0.1); } // slow motion: duller, heavier
function cannonBoom(lv) { SND_GAIN = 0.5; SND_WIDE = 0.85; try { cannonBoom0(lv); } finally { SND_GAIN = 1; SND_WIDE = 0; } }
function cannonBoom0(lv) { // a cannon firing: the crack of the pressure wave, the blast, two thumps and a sub, the air it moves; then a SHORT tail (ring, two echoes, a rumble) on its own bus
  lv = clamp(lv, 1, 5); if (sfxPlay('cannon', 0.95, [1.15, 1.05, 0.95, 0.85, 0.75][lv - 1], 0.3)) return; if (!AC) return; OUT(); const t = AC.currentTime, p = lv / 5;
  noise(t, 0.03, 0.55, 'highpass', 5000, 2000, 0.7); noise(t, 0.07, 0.5, 'bandpass', 2400, 1100, 1);
  noiseDist(t, 0.3 + 0.35 * p, 0.6 + 0.3 * p, 3400, 120, 0.9); noiseDist(t + 0.01, 0.18 + 0.2 * p, 0.35, 1200, 90, 0.8);
  sweep(t, 125 - 25 * p, 26, 0.35 + 0.4 * p, 0.85 + 0.3 * p, 'sine'); sweep(t, 90, 24, 0.4 + 0.4 * p, 0.6, 'sine'); if (lv >= 2) sweep(t + 0.012, 58, 18, 0.5 + 0.6 * p, 0.3 + 0.55 * p, 'sine');
  noise(t, 0.3 + 0.25 * p, 0.5, 'lowpass', 300, 40, 0.6); noise(t + 0.03, 0.4, 0.12, 'bandpass', 600, 3200, 0.8);
  SND_BUS = TAILBUS; try {
    const f = 230 - 30 * lv; for (const [r, a2, d] of [[1, 1, 0.7], [2.32, 0.5, 0.45], [4.1, 0.3, 0.3], [6.7, 0.18, 0.2]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f * r; g.gain.setValueAtTime(0.0001, t + 0.02); g.gain.exponentialRampToValueAtTime(0.03 * a2 * (0.6 + p), t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); sendOut(g, 0.1); o.start(t); o.stop(t + d + 0.05); }
    for (const [d, v] of [[0.14, 0.3], [0.3, 0.18]]) noiseDist(t + d, 0.18 + 0.12 * p, v * (0.6 + p * 0.4), 1800, 100, 0.8);
    noise(t + 0.1, 0.6 + 0.5 * p, 0.22 + 0.1 * p, 'lowpass', 420, 60, 0.6);
  } finally { SND_BUS = null; }
}
function glassSound(f) { SND_GAIN = 2.3; SND_WIDE = 0.8; try { glassSound0(f); } finally { SND_GAIN = 1; SND_WIDE = 0; } }
function glassSound0(f) { // f: pitch, 1 for thin glass, lower for thick: the first crack, the burst, secondary cracks, a body, a cascade of tinkles that thins out, a shimmer, the frame's thud
  if (!AC) return; OUT(); const t = AC.currentTime;
  noise(t, 0.012, 0.5, 'highpass', 6000 * f, 3000, 0.7); noise(t, 0.35, 0.28, 'highpass', 4500 * f, 1800 * f, 0.6); noise(t + 0.01, 0.12, 0.3, 'bandpass', 2800 * f, 1500 * f, 2); noise(t + 0.005, 0.18, 0.22, 'bandpass', 1900 * f, 900 * f, 1.5);
  for (const d of [0.06, 0.11, 0.19]) noise(t + d, 0.02, 0.28, 'highpass', 5200 * f, 2500, 0.8);
  for (let i = 0, n = 70 + Math.round(50 / f); i < n; i++) ping(t + 0.02 + Math.pow(Math.random(), 1.8) * 1.2, rand(1800, 11000) * f, rand(0.02, 0.09), rand(0.02, 0.06));
  noise(t + 0.1, 0.7, 0.07, 'highpass', 7000, 4000, 0.6); sweep(t, 170, 62, 0.2, 0.28, 'sine'); sweep(t, 90, 40, 0.3, 0.2, 'sine');
}
function matSound(kind, p, f) { SND_GAIN = { wood: 3.0, brick: 2.0, stone: 2.0, metal: 2.2, ice: 1.9 }[kind] || 1; SND_WIDE = 0.6; try { matSound0(kind, p, f); } finally { SND_GAIN = 1; SND_WIDE = 0; } }
function matSound0(kind, p, f) { // wood, brick, stone, metal, ice: each its own layers (f: pitch factor)
  if (!AC) return; OUT(); const t = AC.currentTime;
  if (kind === 'wood') { for (const d of [0, 0.03, 0.07, 0.11]) noise(t + d, 0.05, 0.4, 'bandpass', 1800 * f, 700 * f, 3); sweep(t, 190 * f, 62, 0.28, 0.4, 'sine'); sweep(t, 100, 38, 0.4, 0.25, 'sine'); noise(t, 0.4, 0.2, 'lowpass', 600, 120, 0.7); for (let i = 0; i < 14; i++) noise(t + 0.05 + Math.random() * 0.45, 0.02, 0.1, 'highpass', rand(2500, 5000), 2000, 1); }
  else if (kind === 'brick' || kind === 'stone') { sweep(t, (kind === 'brick' ? 140 : 110) * f, 34, 0.45, 0.6, 'sine'); sweep(t + 0.005, 60, 22, 0.8, 0.45, 'sine'); noiseDist(t, 0.14, 0.32, 1800, 300, 1); noise(t, 0.9, 0.22, 'lowpass', 500, 90, 0.7); noise(t + 0.05, 0.5, 0.08, 'highpass', 5000, 2500, 0.6); for (let i = 0; i < 22; i++) noise(t + 0.04 + Math.pow(Math.random(), 1.5) * 0.8, rand(0.02, 0.06), rand(0.05, 0.12), 'bandpass', rand(800, 2500), rand(400, 1200), 2.5); }
  else if (kind === 'metal') { noise(t, 0.012, 0.4, 'highpass', 4000, 2500, 0.7); const base = rand(300, 460) * f; for (const [r, a, d] of [[1, 1, 1.6], [2.43, 0.6, 1.1], [3.87, 0.4, 0.8], [5.5, 0.25, 0.55], [7.7, 0.15, 0.4], [9.4, 0.1, 0.3], [12.6, 0.07, 0.22]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = base * r; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045 * a * p, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d * (0.6 + f * 0.4)); o.connect(g); sendOut(g, 0.4); o.start(t); o.stop(t + d + 0.05); } sweep(t, 90 * f, 33, 0.35, 0.34 * p, 'sine'); sweep(t, 60 * f, 25, 0.6, 0.2 * p, 'sine'); }
  else if (kind === 'ice') { noise(t, 0.015, 0.45, 'highpass', 5000, 3000, 0.7); noise(t, 0.3, 0.2, 'highpass', 3800, 1600, 0.6); for (let i = 0; i < 36; i++) ping(t + 0.02 + Math.pow(Math.random(), 1.8) * 1.0, rand(1800, 7000) * f, rand(0.02, 0.08), rand(0.015, 0.04)); sweep(t, 140, 58, 0.2, 0.2, 'sine'); sweep(t, 80, 34, 0.35, 0.15, 'sine'); }
}
function ripSound() { // a limb tearing off: metal screech, snap, sizzle
  recEvt('r', []); if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'rs', a: [] }); if (!AC) return; if (sfxPlay('rip', 0.9, 1, 0.25)) return; OUT(); const t = AC.currentTime;
  noiseDist(t, 0.22, 0.3, 3200, 500, 3); noise(t, 0.04, 0.3, 'highpass', 4500, 2000, 0.7); sweep(t, 900, 260, 0.2, 0.06, 'sawtooth'); noise(t + 0.05, 0.3, 0.1, 'highpass', 7000, 3500, 0.6);
}
function scrapeSound(v) { if (!AC) return; OUT(); const t = AC.currentTime; noise(t, 0.12, Math.min(0.12, 0.02 + v * 0.004), 'bandpass', 2600 + v * 30, 1400, 2.5); }
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
(function () { // like / subscribe badge: big and bright, sits right under the pizza board
  if (document.getElementById('socialCss')) return;
  const st = document.createElement('style'); st.id = 'socialCss';
  st.textContent = `.social{position:absolute!important;left:50%!important;right:auto!important;bottom:auto!important;top:calc(env(safe-area-inset-top,0px) + 82px)!important;display:flex!important;align-items:center;gap:10px;white-space:nowrap;padding:8px 26px 10px!important;border-radius:24px!important;background:linear-gradient(#ff4a4a,#d40f1f)!important;border:3px solid #fff!important;color:#fff!important;font:800 min(36px,9vw) "Chakra Petch",ui-sans-serif,system-ui,sans-serif!important;letter-spacing:1px;text-shadow:0 3px 0 rgba(90,0,10,.55);box-shadow:0 6px 0 #7a0a14,0 0 30px rgba(255,70,70,.95),0 0 0 3px rgba(0,0,0,.35)!important;z-index:9!important;pointer-events:none;animation:socialPop2 1.5s ease-out both!important;transform-origin:50% 50%}.social span{font-size:1.25em;line-height:1}@keyframes socialPop2{0%{transform:translateX(-50%) scale(.4);opacity:0}14%{transform:translateX(-50%) scale(1.18);opacity:1}28%{transform:translateX(-50%) scale(1)}78%{transform:translateX(-50%) scale(1.05);opacity:1}100%{transform:translateX(-50%) scale(1);opacity:0}}`;
  document.head.appendChild(st);
})();
function socialFx(kind) {
  recEvt('u', [kind]);
  const el = document.createElement('div'); el.className = 'social'; el.innerHTML = kind === 'like' ? '<span>👍</span> LIKE' : 'SUBSCRIBE <span>🔔</span>';
  stage.appendChild(el); setTimeout(() => el.remove(), 1500);
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
  const BX = bxRec();
  const FXR = new Float32Array([ANVIL.visible ? 1 : 0, ANVIL.position.x, ANVIL.position.y, ANVIL.position.z, ANVIL_RING.visible ? 1 : 0, ...RAIN.flatMap(r => r.on ? [r.m.position.x, r.m.position.y, r.m.position.z] : [])]);
  REC.frames.push({ BX, DL, FXR, FL, GX, DR, dt: REC.acc, st: STATE_CODE[state] ?? 1, face: faceMode, simT, P, B, bar, con, tnt, spr, deb: new Float32Array(deb), drp: new Float32Array(drp), spl: new Float32Array(spl), ev: REC.cur, hp: HP });
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
  const evTimes = []; fr.forEach((f, i) => { for (const [k, d] of f.ev) if ((k === 'p' && /CLOSE|GONE|ARM|HEADLESS|BOING|KABOOM|SLAM|SLIPPERY|WHOA|BOOST|DESTROYED|SHIELD|CANNON|TNT RAIN|MOON|ROCKET|OIL|REPAIR|SUPER|ANVIL|FLATTENED/.test(d[0])) || k === 'x' || k === 'u') evTimes.push(cum[i]); });
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
  if (!rec || !rec.frames.length) return; carBreakReset(); // the film shows the car whole (its flight is recorded, the loose parts are not)
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
    else if (k === 'c') crashSound(d[0]);
    else if (k === 'r') ripSound();
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
  bxApply(f0.BX);
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
    const stream = comp.captureStream(60); recTrack = null;
    initAudio(); if (AC) { OUT(); if (AUDIO_DEST) AUDIO_DEST.stream.getAudioTracks().forEach(t => stream.addTrack(t)); }
    const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 40e6 } : { videoBitsPerSecond: 40e6 });
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
  if (recTrack) { if (now >= recNextT) { recNextT = Math.max(recNextT + 1000 / 60, now - 12); queueMicrotask(() => { try { recTrack && recTrack.requestFrame(); } catch (e) {} }); } }
  if ($('hook').classList.contains('show') && !stage.classList.contains('nohook')) { strokeText(L.title[0], W / 2, H * 0.14, W * 0.1, '#ffc41f'); strokeText(L.title[1], W / 2, H * 0.14 + W * 0.1, W * 0.088, '#ffffff'); }
  if (RUSH && RUSHFX.show && !(PLAY && PLAY.rew && PLAY.rew.u <= 0.72)) { const h = clamp((RUSHFX.mph - 50) / 110, 0, 1), k = 1 + h * 0.25 + (RUSHFX.mph >= 100 ? Math.sin(now / 60) * 0.03 : 0); strokeText(RUSHFX.mph + ' MPH', W / 2, H * 0.82, W * 0.12 * k, 'rgb(255,' + Math.round(210 - 160 * h) + ',' + Math.round(40 - 30 * h) + ')'); }
  if (PLAY && PLAY.rew && PLAY.rew.u <= 0.72) {
    cctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 4; i++) cctx.fillRect(0, Math.random() * H, W, H * rand(0.004, 0.03));
    if (Math.floor(now / 250) % 2) strokeText('◀◀ REWIND', W * 0.3, H * 0.13, W * 0.075, '#ffffff');
  }
  OVL.items = OVL.items.filter(it => now - it.t < (it.kind === 'pop' ? 1000 : it.kind === 'reveal' ? 1900 : 1500));
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
      const pulse = 1 + Math.sin(age * 14) * 0.06, s = Math.min(1, age / 0.18) * pulse, bw = W * (it.kind === 'like' ? 0.4 : 0.64), bh = W * 0.14;
      cctx.save(); cctx.globalAlpha = age > 1.2 ? Math.max(0, 1 - (age - 1.2) / 0.3) : 1; cctx.translate(W / 2, H * 0.2); cctx.scale(s, s);
      cctx.fillStyle = '#ff2b2b'; cctx.beginPath(); cctx.roundRect ? cctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh * 0.3) : cctx.rect(-bw / 2, -bh / 2, bw, bh); cctx.fill(); cctx.strokeStyle = '#fff'; cctx.lineWidth = bh * 0.06; cctx.stroke();
      cctx.font = '800 ' + Math.round(bh * 0.5) + 'px "Chakra Petch", ui-sans-serif, sans-serif'; cctx.fillStyle = '#fff'; cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
      cctx.fillText(it.kind === 'like' ? '👍 LIKE' : 'SUBSCRIBE 🔔', 0, bh * 0.04); cctx.restore();
    }
  }
}
const DROP_H = 10, INTRO_V = 14; // drop height, speed of the drone + the rolling board/cart during the intro
// ---------- state & helpers ----------
const tv = new V3(), tv2 = new V3(), tq = new THREE.Quaternion();
let faceUntil = 0;
function setFace(m, hold) { faceMode = m; faceUntil = performance.now() + (hold || 0); if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'face', a: [m, hold || 0] }); }
let lastPop = 0;
function pop(text, cls) {
  const now = performance.now(); if (now - lastPop < 160) return; lastPop = now;
  recEvt('p', [text, cls || '']); if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'pop', a: [text, cls || ''] });
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
let hitStopUntil = 0;
let state = 'intro', stateT = 0, testNo = 0, slowUntil = 0, slowK = 1, manualSlow = false, shake = 0, cause = '', trick = TRICKS[0];
let simT = 0, orbitA = 0, crouch = 0.45, crouchV = 0, bal = 0, lastXv = 0, stanceBlend = 0;
// ---------- opening captions: a fresh hook for every attempt (first frame of the video) ----------
// '|' splits the two lines. {mph} {lv} {m} are filled in. Each pool is shuffled and used up before any caption repeats, even between sessions.
const TITLES = {
  delivery: ['CAN HE DELIVER|THE PIZZA?', '45 SECONDS|8 SLICES', '8 SLICES|HOW MANY SURVIVE?', 'WILL ANY SLICE|SURVIVE?', 'HOW MANY SLICES|WILL HE KEEP?', 'ALL 8 SLICES|OR NOTHING', 'ONLY 1% GET|ALL 8 SLICES', 'DELIVER ALL 8|OR NO TIP', '45 SECONDS|OR NO TIP', '$20 TIP|IF HE MAKES IT', 'HE HAS 45 SECONDS|TO SAVE DINNER', 'HE PROMISED|HOT PIZZA', 'PIZZA DELIVERY|GONE WRONG?', 'PIZZA VS|THE TRACK', 'EVERY SLICE|COUNTS', 'PIZZA DELIVERY|IMPOSSIBLE MODE', 'WILL THE PIZZA|SURVIVE?', "DON'T DROP|THE PIZZA", 'HOT PIZZA|COLD CRASH', 'ONE JOB:|DELIVER THE PIZZA', 'NO PIZZA|NO TIP', 'HE QUIT HIS JOB|FOR THIS?'],
  skate: ['0.1% CAN|BEAT THIS TRACK', "ONE MISTAKE|AND IT'S OVER", 'CAN HE SURVIVE|THIS TRACK?', 'SAWS, BALLS,|AND CRUSHERS', 'TWO DOORS|ONE MISTAKE', 'PICK A DOOR|AND PRAY', 'EVERY DOOR IS|A GAMBLE', 'HE SKATES INTO|A GIANT SAW', 'WILL HE JUMP|OVER THE SAW?', 'A WRECKING BALL|IS COMING', "HE DOESN'T SEE|WHAT'S COMING", 'WATCH HIS FACE|THE WHOLE TIME', "HE'S SKATING|WITH NO BRAKES", 'TRAP AFTER TRAP|CAN HE LAST?', 'HOW MANY TRAPS|CAN HE SURVIVE?', 'THE LAST TRAP|IS THE WORST', 'WAIT FOR|THE LAST OBSTACLE', "DON'T BLINK|OR YOU'LL MISS IT", 'HE HAS 100 HP|WILL IT LAST?', 'THIS ONE|ENDS BADLY', "HE THINKS IT'S|EASY...", 'STARTS EASY|ENDS IN CHAOS', 'IT GETS WORSE|EVERY SECOND', 'HOW LONG CAN|HE LAST?'],
  cart: ['CART VS|DEADLY TRACK', 'SHOPPING CART|AT FULL SPEED', 'CAN A CART|SURVIVE THIS?', 'NO BRAKES.|NO PLAN.', 'GROCERY RUN|GONE WRONG', "THE CART ISN'T|BUILT FOR THIS", 'WILL IT|TIP OVER?', 'ONE CART|ONE CHANCE', "THE CART WON'T|SURVIVE THIS", 'CART VS SAWS|WHO WINS?', 'HE FORGOT|TO BRAKE'],
  city: ["DON'T LOOK|DOWN", 'ONE JUMP|TOO FAR', 'ONE SLIP|AND HE FALLS', 'CITY ROOFS|NO SAFETY NET', 'ROOFTOP CHASE|GONE WRONG', 'GAPS, SAWS|AND CRATES', 'HE JUMPS|OVER THE CITY', "ONE MISSED JUMP|AND IT'S OVER", 'SURVIVE THE|CITY ROOFS', 'HIGH ABOVE|THE CITY'],
  bollard_any: ['CAN HE STAY|IN THE CART?', 'NO SEATBELT|NO PROBLEM?', 'CART VS POST|WHO WINS?', 'HOW FAR WILL|HE FLY?', 'CRASH TEST|LEVEL {lv}', 'CRASH TEST|SHOPPING CART'],
  tub: ['BATHTUB VS|A STEEL POST', 'WILL HE STAY|IN THE BATH?', 'BATH TIME|GONE WRONG', 'NO SOAP.|JUST SPEED.', "A RUBBER DUCK|WON'T SAVE HIM", 'BATHTUB RACE|{mph} MPH', 'SQUEAKY CLEAN?|NOT FOR LONG', 'HE FORGOT|THE BRAKES', 'A BATH AT|{mph} MPH', 'BATHTUB VS|THE WALL OF DEATH'],
  bollard_low: ['ONLY {mph} MPH?|NO PROBLEM...', 'JUST A TAP|{mph} MPH', 'HOW BAD CAN|{mph} MPH BE?', 'LEVEL 1:|IT GETS WORSE'],
  bollard_mid: ['{mph} MPH|DOES IT HOLD?', 'CART AT {mph} MPH|HITS A POST', 'CAN HE SURVIVE|{mph} MPH?', '{mph} MPH|NO SEATBELT', '{mph} MPH|THE POST OR HIM?'],
  bollard_high: ['CART AT {mph} MPH|HITS A POST', 'THE POST|WILL SNAP', '{mph} MPH|NO MERCY', 'WORLD RECORD|FLIGHT?', 'CAN YOU SEE|HIM LAND?', '{mph} MPH|INTO A POST', 'CAN HE SURVIVE|{mph} MPH?'],
  bollard_far: ['WILL HE FLY|100 METERS?', '{mph} MPH|HOW FAR HE FLIES?', 'HOW FAR CAN|{mph} MPH THROW HIM?'],
  bollard_top: ['LEVEL 5:|THE BIG ONE', '{mph} MPH:|THE FINAL LEVEL', 'THE FASTEST|CRASH YET'],
  fart: ['HOW HIGH CAN|HE FLY?', 'FART POWER {lv}|HOW HIGH?', 'POWERED BY|PURE GAS', 'ROCKET FART|TEST', 'TOO MUCH|BEANS?', 'NO FUEL|JUST FARTS', 'WILL HE REACH|THE SKY?', 'ONE FART|TO THE MOON?', 'HOW MUCH GAS|DOES HE NEED?'],
  sock: ['HOW BIG A|STINKY SOCK?', 'SOCK SIZE {lv}|TOO STINKY?', 'THE STINKIEST|SOCK EVER', 'SMELLY SOCK|VS DAGGIE', 'WHO WINS?|HIM OR SOCK', 'CAN HE TAKE|THIS SMELL?', 'THE SOCK|IS GETTING BIGGER'],
  press: ['HYDRAULIC PRESS|VS DAGGIE', 'HOW MANY TONS|CAN HE TAKE?', '{t} TONS|ON ONE ROBOT', 'WILL HE SURVIVE|{t} TONS?', 'SLOWLY CRUSHED|{t} TONS', "THE PRESS|DOESN'T STOP", "DON'T BLINK|THE PRESS IS COMING", 'WHAT HAPPENS AT|{t} TONS?'],
  mix: ['{veh} VS|{obs}', '{veh} AT {mph} MPH|HITS {obs}', 'WHO WINS?|{veh} OR {obs}', 'CAN {obs}|STOP A {veh}?', '{mph} MPH.|{obs}.', 'HE TRIED THE|{veh}'],
  stairs: ['{n} STEPS|CAN HE SURVIVE?', 'DOWN {n} STEPS|HOW MANY PARTS LEFT?', 'PUSHED OFF|THE TOP', 'ONE ROBOT.|{n} STEPS.', 'STEP BY STEP|HE FALLS APART', 'WILL HE REACH|THE BOTTOM?', 'THE LONGEST|FALL YET', 'NO RAILING.|NO MERCY.'],
  cannon: ['HOW MANY WALLS|CAN HE BREAK?', '{mph} MPH|15 WALLS', 'CANNON VS|15 WALLS', 'GLASS, BRICK, STEEL...|HOW FAR?', 'WILL HE BREAK|THE VAULT DOOR?', 'FROM PAPER-THIN|TO VAULT STEEL', 'ONE SHOT|15 WALLS', 'STUCK OR|THROUGH ALL 15?'],
  anvil: ['ANVIL FROM|{lv} METERS', 'HOW HIGH TO|BREAK HIM?', '1000 KG|FROM THE SKY', 'LOOK UP|DAGGIE!', 'CAN HE|TAKE THIS?', "THE ANVIL|DOESN'T MISS"],
  tower: ['110 METERS DOWN|ONE HAMMER', 'SKYSCRAPER RAMP|NO BRAKES', 'WILL HE MAKE IT|THROUGH?', 'FROM THE ROOF|STRAIGHT DOWN', 'ONE SHOT|ONE TRAP', 'TIMING IS|EVERYTHING', 'GRAVITY DOES|THE REST', '100 MPH|INTO THAT?', "HE CAN'T STOP|NOW", 'WATCH THE TRAP|NOT THE CAR'],
  bumps: ['50 SPEED BUMPS|AT FULL SPEED', '80 MPH|VS A SPEED BUMP', 'WHAT HAPPENS AT|80 MPH?', 'ONE BUMP|TOO FAST', "HE DIDN'T|SLOW DOWN", 'WILL THE CAR|STAY ON 4 WHEELS?', 'SPEED BUMP|NO BRAKES', 'HOW MANY BUMPS|BEFORE IT FLIPS?', 'FULL SPEED|INTO SPEED BUMPS', 'THIS IS WHY|THEY SAY SLOW DOWN'],
  any: ['CRASH TEST|DAGGIE', 'WILL HE|SURVIVE?'],
};
function rollTitle() {
  try {
    let pools = ['any'], v = {};
    if (MODE === 'lab') { const m = LAB.machine, lv = LAB.level; v.lv = lv; v.m = m; v.t = PRESS_TONS[clamp(lv, 1, 5) - 1]; v.mph = CANNON_MPH[clamp(lv, 1, 5) - 1]; v.n = STAIRS_STEPS[clamp(lv, 1, STAIRS_STEPS.length) - 1];
      if (m === 'bollard' || m === 'tub' || m === 'mix') { const mph = LAB_SPEEDS[lv - 1] || 15; v.mph = mph; if (m === 'mix') { v.veh = VEH_DEFS[MIX.veh].name; v.obs = OBST[MIX.obs].name; } pools = [m === 'tub' ? 'tub' : m === 'mix' ? 'mix' : 'bollard_any', mph <= 15 ? 'bollard_low' : mph <= 50 ? 'bollard_mid' : 'bollard_high']; if (mph >= 130) pools.push('bollard_far'); if (mph >= 200) pools.push('bollard_top'); } else pools = [TITLES[m] ? m : 'any']; }
    else if (L.titles && TITLES[L.titles]) pools = [L.titles];
    else if (DLV) pools = ['delivery'];
    else if (VEH === 'cart') pools = ['cart'];
    else if (TH === 'city') pools = ['city', 'skate'];
    else pools = ['skate'];
    const key = pools.join('+') + (MODE === 'lab' ? ':' + (v.mph || '') : ''), all = pools.flatMap(p => TITLES[p]);
    let bag = {}; try { bag = JSON.parse(localStorage.getItem('daggie-titles2') || '{}'); } catch (e) { bag = {}; }
    const b = bag[key] || { left: [], last: -1 };
    if (!b.left.length || b.left.some(i => i >= all.length)) { b.left = all.map((_, i) => i).filter(i => i !== b.last); }
    const k = Math.floor(Math.random() * b.left.length), idx = b.left.splice(k, 1)[0]; b.last = idx; bag[key] = b;
    try { localStorage.setItem('daggie-titles2', JSON.stringify(bag)); } catch (e) { /* storage full or blocked: titles just repeat sooner */ }
    const txt = all[idx].replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
    L.title = txt.split('|');
    const hk = $('hook'); hk.textContent = ''; for (const t of L.title) { const sp = document.createElement('span'); sp.textContent = t; hk.appendChild(sp); }
  } catch (e) { /* keep the old caption */ }
}
function resetRun() {
  if (liveRecOn()) finishLiveRec();
  liveWant = LIVE_REC;
  testNo++;
  resetPower(); randomGates(); resetFlock(); resetFx(); RING.done = false;
  Object.assign(R, { s: -13.5, x: 0, xT: 0, xv: 0, y: START_H + DROP_H, vy: 0, carry: true, carryT: 0, speed: 0, grounded: false, slope: 0, maxS: 0, top: 0, close: 0, passedFlag: false, air: 0, slip: 0, slam: false, cones: 0, lost: 0, bumps: 0, clean: 0, mile: 0, hop: false, wild: 0, yaw: 0, roll: 0, yawV: 0, rollV: 0, climaxed: false, lean: 0 });
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
  $('result').hidden = true; rollTitle(); $('hook').classList.add('show');
  $('testNo').textContent = '#' + String(testNo).padStart(3, '0');
  snapCam = true;
  dlvReset(); carBreakReset();
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
const CART_SEAT = new V3(0, 0.17, 0.32); let CART_RIM_Y = BODY === 'car' ? 0.48 : (1.02 - 0.4) * CART_S, CART_RIM_X = BODY === 'car' ? 0.15 : (0.32 + 0.03) * CART_S, CART_RIM_Z = BODY === 'car' ? -0.28 : -0.06; // in the car the hands hold the steering wheel // both change when the bathtub is in use (labVehicle)
const HD_SEAT = !!(CART_ROOT && CART_ROOT.userData.hd); // the real car: Daggie in its centre driving seat, hands on its wheel, feet down at the pedals
if (HD_SEAT) { CART_SEAT.set(0, 0.47 - BOARD_TOP, -0.28); CART_RIM_Y = 0.68 - BOARD_TOP; CART_RIM_X = 0.15; CART_RIM_Z = -0.96; }
const hdZ = dz => !HD_SEAT ? dz : dz > 0 ? Math.max(0, dz - 2.35) : Math.min(0, dz + 1.9); // the long car: the gap from its nose or tail, not its middle
function poseCart(t) {
  if (PEDAL && PEDAL.use) pedalStep(t);
  if (state === 'intro') {
    if (R.carry) { rootQ.identity(); solveStance(flailPose(t * 0.6), 0); return; }
    const T = Math.sqrt(2 * DROP_H / 9.8), u = clamp(Math.sqrt(2 * Math.max(0, START_H + DROP_H - R.y) / 9.8) / T, 0, 1);
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
    let ft = HD_SEAT ? new V3(sd * 0.16, ANKLE_REST.y - 0.33 + rat * 0.5, -1.18) : new V3(sd * 0.17, ANKLE_REST.y + rat * 0.5 + (air ? 0.02 : 0), -0.3); if (PEDAL && PEDAL.use && PEDAL.crank) { const ph = PEDAL.phase + (sd > 0 ? 0 : Math.PI); ft = new V3(sd * PEDAL.px, PEDAL.cy - PEDAL.r * Math.cos(ph) + 0.015 + ANKLE_REST.y - 0.012, PEDAL.cz + PEDAL.r * Math.sin(ph)); } // on a trike each foot rides its pedal
    limbIK('thigh' + s, 'shin' + s, 'foot' + s, ft, new V3(sd * 0.25, 1, -0.7), P);
    levelPart('foot' + s, P);
  }
  for (const s of ['L', 'R']) {
    const sd = SIDE[s];
    if (CANNON.on && CANNON.k === s) { P['upper' + s] = [1.5, 0, sd * 0.1]; P['fore' + s] = [0.1, 0, 0]; continue; }
    const rail = party ? new V3(sd * 0.55, CART_RIM_Y + 0.7 + Math.sin(t * 10 + sd) * 0.08, -0.1) : new V3(sd * CART_RIM_X, CART_RIM_Y + 0.005 + Math.sin(t * 40 + sd) * 0.002 * sk, CART_RIM_Z - sd * 0.01), pole = new V3(sd * 0.8, -0.4, 0.5);
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
    const T = Math.sqrt(2 * DROP_H / 9.8), u = clamp(Math.sqrt(2 * Math.max(0, START_H + DROP_H - R.y) / 9.8) / T, 0, 1);
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
  rider.rotation.set(pitch, R.yaw || 0, clamp(-R.xv * 0.05, -0.38, 0.38) + (R.roll || 0) + (R.lean || 0));
  if (state !== 'intro') { board.position.copy(rider.position); board.quaternion.copy(rider.quaternion); }
  for (const w of wheels) w.rotation.x -= (state === 'ride' || state === 'passed') && R.grounded ? R.speed / WHEEL_R / 60 : 0;
  if (CART_ROOT && CART_ROOT.userData.steer) { const st = state === 'ride' ? clamp(-R.xv * 0.06, -0.38, 0.38) : 0; for (const w of CART_ROOT.userData.steer) if (w.parent === CART_ROOT.userData.g) w.rotation.y += (st - w.rotation.y) * 0.25; } // the real car's front wheels turn as it dodges
}
function jointsNow() { daggie.updateMatrixWorld(true); const out = []; for (const [n, par] of RIG) if (par) out.push(jointWorld(n, new V3()).applyMatrix4(daggie.matrixWorld)); return out; }
function crash(kind, saw) {
  if (state !== 'ride') return;
  if (kind !== 'fall' && kind !== 'gap' && kind !== 'lava' && kind !== 'rollover' && kind !== 'wear' && kind !== 'bones') { if (performance.now() < R.inv) return; if (R.shield) { shieldSave(); return; } if (powerHit(kind, saw)) return; }
  if (kind !== 'fall' && kind !== 'gap' && kind !== 'lava' && kind !== 'rollover' && flockSwap(kind)) return;
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
    if (kind === 'rollover') { const sd = Math.sign(R.roll || R.yaw) || 1; u.v.x += sd * rand(3, 8) + Math.sin(R.yaw || 0) * R.speed * 0.3; u.v.y += rand(3, 7); u.v.z *= rand(0.5, 0.9); }
    if (kind === 'lava') { u.v.y += rand(5, 9); u.v.z *= 0.35; u.v.x += rand(-3, 3); }
    if (kind === 'ball' || kind === 'hammer') { const dir = saw && saw.pos ? Math.sign(R.x - saw.pos.x) || 1 : 1; u.v.x += dir * rand(6, 11); u.v.y += rand(2, 4); u.v.z *= 0.5; }
    if (kind === 'bowl') { const dir = saw && saw.pos ? Math.sign(R.x - saw.pos.x) || (Math.random() < 0.5 ? -1 : 1) : 1; u.v.x += dir * rand(2, 8); u.v.y += rand(4, 9); u.v.z = rand(1, 7); } // thrown up and back by the ball
    if (kind === 'press') { u.v.y = rand(-1, 0.5); u.v.x += rand(-5, 5); u.v.z += rand(-3, 3); }
    if (kind === 'spikes') { u.v.y += rand(4, 7); }
    if (kind === 'bones') { u.v.x += rand(-5, 5); u.v.y += rand(2, 5); u.v.z += rand(-4, 4); }
    if (kind === 'sweeper') { u.v.x += rand(-7, 7); u.v.y += rand(2, 4); if (leg) u.v.z *= 0.2; }
    if (p === head) u.v.y += 2.5;
    u.w.set(rand(-10, 10), rand(-8, 8), rand(-10, 10));
  }
  if (VEH === 'cart') labDent(Math.min(45, R.speed * 1.1)); // the front crumples in the crash
  BB.free = true; BB.v.copy(vel).multiplyScalar(0.8).add(new V3(rand(-2, 2), rand(2, 4), 0)); BB.w.set(rand(-12, 12), rand(-6, 6), rand(-12, 12));
  if (kind === 'rollover') { const sd = Math.sign(R.roll || R.yaw) || 1; BB.v.x += Math.sin(R.yaw || 0) * R.speed * 0.45 + sd * rand(2, 4); BB.v.y += rand(3, 5); BB.w.set(rand(-4, 4), (R.yawV || 0) * 1.5 + rand(-3, 3), sd * rand(9, 14)); } // barrel-rolls off sideways
  if (BODY === 'car' && CART_ROOT.userData.hd && saw && saw.pos) hdHitAt(saw.pos, clamp(R.speed / 90, 0.35, 1) * 1.25); // the real car caves in right where the hammer lands
  else if (BODY === 'car') carHit(clamp(R.speed / 90, 0.15, 1) * 0.5, Math.sign(R.roll || 0), kind === 'press' ? 0 : 1); // the impact crumples it; the worst-hit parts come off, more go as it tumbles
  spawnDebris(center, jw, vel);
  if (kind === 'lava') { burst(center, 120, SPARK, 11); for (let i = 0; i < 5; i++) setTimeout(() => burst(center.clone().add(new V3(rand(-1.5, 1.5), 0, rand(-1.5, 1.5))), 40, SPARK, 7), i * 160); tone(220, 60, 0.9, 'sawtooth', 0.08); }
  if (kind === 'bones') { burst(center, 60, CONF, 8); for (let i = 0; i < 6; i++) tone(rand(600, 1100), rand(300, 500), 0.08, 'square', 0.05, i * 0.07); }
  burst(center, 70, SPARK, 10); burst(center, 30, CONF, 6);
  setFace('hit', 1500);
  slowUntil = now + (reduceMotion ? 500 : 1600); slowK = 0.22;
  if (!reduceMotion) shake = 0.5;
  pop({ saw: 'ZZZT!', big: 'SHREDDED!', fall: 'NOOO!', hurdle: 'FACEPLANT!', ball: 'WRECKED!', press: 'SQUISH!', barrel: 'STRIKE!', cart: 'CART CRASH!', sweeper: 'SWEPT!', fart: 'BRRRAP!', sock: 'STOMPED!', fire: 'BURNED!', wall: 'BONK!', spikes: 'OUCH!', wear: 'FALLING APART!', bones: 'BONES EVERYWHERE!', anvil: 'FLATTENED!', gap: 'SPLAT!', lava: 'MELTED!', hammer: 'HAMMERED!', bumps: 'TOO MANY BUMPS!', rollover: 'ROLLED OVER!' }[kind] || 'CRASH!', kind === 'fall' ? 'lilac' : 'green');
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
  $('rCause').textContent = ok ? 'Nothing. He made it!' : ({ saw: 'Saw blade', big: 'The giant saw', fall: 'The drop', hurdle: 'The hurdle', ball: 'Wrecking ball', press: 'The crusher', barrel: 'Rolling barrel', cart: 'An oncoming cart', fire: 'The ring of fire', fart: 'Fart power', sock: 'The stinky sock', sweeper: 'Sweeper arm', wall: 'Sliding wall', spikes: 'Spikes', wear: 'Too many hits', bones: 'Skeleton fell apart', anvil: 'A falling anvil', bowl: 'A bowling ball', press: 'A hydraulic press', gap: 'Missed the jump', lava: 'The lava', hammer: 'Giant hammer', bumps: 'Speed bumps', rollover: 'Lost control and rolled over' }[cause] || cause);
  if (BUMP_N) $('rCause').textContent += ' · bumps hit ' + R.bumps + ', jumped ' + (R.clean || 0) + ' of ' + BUMP_N;
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
  if (R.jumpPend > 0) { R.jumpPend -= dt; if (R.jumpPend <= 0 && R.grounded && state === 'ride') { R.grounded = false; R.hop = false; R.vy = R.speed * R.slope + 5.75 * FX.jump; crouchV -= 12; tone(300, 700, 0.15, 'triangle', 0.05); noise && AC && noise(AC.currentTime, 0.12, 0.05, 'bandpass', 1800, 700, 1.5); setFace('wow', 700); } }
  if (R.slip > 0) { R.slip -= dt; R.xT += Math.sin(simT * 7.3) * 5.5 * dt; }
  if (OBS.wind && R.s > OBS.wind.s0 && R.s < OBS.wind.s1) { R.xT += OBS.wind.force * dt; R.x += OBS.wind.force * 0.35 * dt; }
  R.x += (R.xT - R.x) * Math.min(1, dt * (FORM.kind === 'frozen' ? 1.4 : R.slip > 0 ? 2.5 : 6));
  if (L.rails && Math.abs(R.x) > HALF - 0.8) { // guard rails: the car slams into them and bounces back across the road
    const sd = Math.sign(R.x), hit = Math.abs(R.xv) + Math.abs(Math.sin(R.yaw || 0)) * R.speed; R.x = sd * (HALF - 0.8); R.xT = sd * (HALF - 2.2);
    if (hit > 3) { R.yawV = -sd * (0.6 + hit * 0.05) + rand(-0.3, 0.3); R.yaw *= -0.4; R.rollV += -sd * clamp(hit * 0.08, 0.3, 1.6); R.wild += clamp(hit * 0.04, 0.1, 0.6); R.speed *= 0.96; setHP(HP - Math.round(2 + hit * 0.3)); carHit(clamp(hit * 0.02, 0.05, 0.6), sd, 0);
      burst(new V3(R.x + sd * 0.8, 0.6, -R.s), 30, SPARK, 6); clank(5); tone(220, 70, 0.2, 'sawtooth', 0.08); lastPop = 0; pop('WALL!', 'green'); if (!reduceMotion) shake = Math.min(0.7, shake + 0.3); if (HP <= 0) { crash('rollover'); return; } }
  }
  if (R.grounded && Math.abs(R.x) > HALF + 0.05) { R.grounded = false; R.vy = 0; pop('WHOA!', 'lilac'); setFace('scared', 1500); }
  R.xv = (R.x - px) / dt;
  if (R.wild > 0 || R.yaw || R.roll) { // lost control after a speed bump: the car points where it wants, rocks onto two wheels, fishtails
    R.yaw += R.yawV * dt; R.roll += R.rollV * dt;
    if (R.grounded) {
      R.rollV += -R.roll * 14 * dt; R.rollV *= Math.exp(-4 * dt);
      R.yawV += -R.yaw * (R.wild < 0.5 ? 3 : 0.8) * dt + (R.wild > 0.4 ? rand(-1, 1) * R.wild * 7 * dt : 0); R.yawV *= Math.exp(-1.6 * dt);
      R.xT += Math.sin(R.yaw) * R.speed * 0.3 * dt; R.x += Math.sin(R.yaw) * R.speed * 0.12 * dt; // it slides the way it points
      R.wild = Math.max(0, R.wild - 0.3 * dt);
      if ((Math.abs(R.yaw) > 1.0 && R.speed > 16) || Math.abs(R.roll) > 0.8) { crash('rollover'); return; } // sideways at speed: the tyres dig in and it flips
      if (R.wild === 0 && Math.abs(R.yaw) < 0.01 && Math.abs(R.roll) < 0.01) { R.yaw = R.roll = R.yawV = R.rollV = 0; }
    }
  }
  if (R.grounded) {
    R.air = 0;
    R.speed = Math.min(formMax(), R.speed + (0.6 + (R.s < LAND0 ? ACCEL : 0) + (FORM.kind === 'chrome' ? 2 : 0) - 9.8 * R.slope * SLOPE_K) * dt);
    R.s += R.speed * dt;
    const h = trackH(R.s);
    if (h === null) {
      R.grounded = false; R.vy = R.speed * R.slope;
      if (R.s > RAMP1 - 1 && R.s < RAMP1 + 3) { R.slope = Math.max(R.slope, 2 * RAMP_H / (RAMP1 - RAMP0)); R.vy = R.speed * R.slope; } // leaving the kicker: take its lip angle (the last step may have sampled past the end and read a flat 0)
      if (R.s > RAMP1 - 1) { slowUntil = now + 900; slowK = 0.4; pop('SEND IT!', 'lilac'); setFace('wow', 1400); tone(300, 900, 0.4, 'sine', 0.06); }
    } else { R.y = h; R.slope = ((trackH(R.s + 0.1) ?? h) - h) / 0.1; }
    if (R.s > LAND0 && cause === '') { R.speed *= Math.pow(0.35, dt); if (DLV) { if (R.s > DOOR_S - 3.2) R.s = DOOR_S - 3.2; const dist = DOOR_S - 3.2 - R.s; R.speed = dist > 0.3 ? Math.max(Math.min(R.speed / Math.pow(0.35, dt), dist * 1.6), Math.min(2.5, dist * 3)) : 0; } if (R.s > LAND0 + 4 && !R.passedFlag) { R.passedFlag = true; passed(); } }
  } else {
    R.air += dt;
    R.vy -= 9.8 * FX.grav * (R.vy < 0 ? 1.35 : 1) * dt; R.y += R.vy * dt; R.s += R.speed * dt;
    const h = trackH(R.s);
    if (h === null && R.y < -1.0 && inLava(R.s)) { crash('lava'); return; } // dropped into the lava
    if (h !== null && R.y < h - 0.5) { crash('gap'); return; } // fell into the gap and hit the far wall
    if (h !== null && R.y <= h && R.vy <= 0) {
      const hard = -R.vy; R.grounded = true; R.hop = false; R.y = h; R.slope = 0;
      if (Math.abs(R.roll) > 0.7 || (Math.abs(R.yaw) > 0.9 && R.speed > 16)) { crash('rollover'); return; } // came down on its side
      if (hard > 5) carHit((hard - 5) * 0.05, Math.sign(R.roll) || 0, 0); // a hard landing bends things landImpact(hard); if (hard > 13 && !R.slam) setHP(HP - 10);
      if (R.slam) { R.slam = false; for (const n of TNTS) if (n.alive && Math.hypot(n.x - R.x, n.s - R.s) < 3.2) { n.alive = false; n.g.visible = false; explodeAt(new V3(n.x, 0.6, -n.s)); } burst(new V3(R.x, h + 0.1, -R.s), 50, SPARK, 8); pop('SLAM!', 'lilac'); if (!reduceMotion) shake = 0.5; tone(90, 35, 0.35, 'sine', 0.3); for (const c of OBS.cones) if (!c.hit && Math.hypot(c.x0 - R.x, c.s0 - R.s) < 4) { c.hit = true; c.v.set((c.x0 - R.x) * 3, rand(5, 8), (R.s - c.s0) * 2); c.w.set(rand(-12, 12), 0, rand(-12, 12)); } }
      burst(new V3(R.x, h + 0.1, -R.s), 18, SPARK, 5); tone(160, 50, 0.2, 'sine', Math.min(0.3, 0.05 + hard * 0.02));
      if (!reduceMotion) shake = Math.min(0.4, hard * 0.03);
    }
    if (R.y < -14) { crash('fall'); return; }
  }
  if (state !== 'ride') return;
  if (L.climax && !R.climaxed && R.s > L.climax - Math.max(14, R.speed * 1.1)) { R.climaxed = true; slowUntil = now + 1500; slowK = 0.28; lastPop = 0; pop('WILL HE MAKE IT?', 'lilac'); setFace('scared', 1800); tone(200, 90, 0.8, 'sawtooth', 0.05); } // the moment before the trap, in slow motion
  const bodyY0 = R.y + 0.2, bodyY1 = R.y + 0.2 + (VEH === 'cart' ? 1.5 : 2.1) * PW.size, bw = (BODY === 'car' ? (HD_SEAT ? 1.0 : 0.62) : VEH === 'cart' ? 0.45 : 0.34) * PW.size;
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
  if (HAS_BIG && Math.abs(R.s - SAW_S) < 0.5) {
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
    if (b.dead || Math.abs(R.s - b.s) > (HD_SEAT ? 4.4 : 1.6)) continue;
    const yy = clamp(b.pos.y, bodyY0, bodyY1); let d = Math.hypot(R.x - b.pos.x, yy - b.pos.y, hdZ(-R.s - b.pos.z));
    if (b.big) { // the giant hammer's head is a long drum across the road: test it as a capsule, tilted with the swing
      const a = b.ball.rotation.z, dx = R.x - b.pos.x, ca = Math.cos(a), sa = Math.sin(a);
      const lx = Math.abs(dx * ca + (clamp(b.pos.y + dx * sa, bodyY0, bodyY1) - b.pos.y) * sa), ly = -dx * sa + (clamp(b.pos.y + dx * sa, bodyY0, bodyY1) - b.pos.y) * ca;
      d = Math.hypot(Math.max(0, lx - b.hl - bw), ly, hdZ(-R.s - b.pos.z)) + b.r - b.hr; } // so the checks below can stay in terms of b.r
    if (d < b.r + 0.05) { crash(b.hammer ? 'hammer' : 'ball', b); return; }
    if (d < b.r + 0.45) { graze(b, Math.sign(R.x - b.pos.x) || 1, b.pos.y > R.y + 1.7); if (state !== 'ride') return; }
    if (!b.near && d < b.r + 1.4) { b.near = true; R.close++; pop('CLOSE!', 'lilac'); setFace('scared', 700); }
  }
  { const B = FX.bowl; if (B && B.on && Math.abs(R.s - B.s) < 1.6) { // the gate's bowling ball
    const yy = clamp(B.y, bodyY0, bodyY1), d = Math.hypot(R.x - B.x, yy - B.y, R.s - B.s);
    if (d < BOWL.r + 0.05) { crash('bowl', { pos: new V3(B.x, B.y, -B.s) }); return; }
    if (!B.near && d < BOWL.r + 1.0) { B.near = true; R.close++; pop('CLOSE!', 'lilac'); setFace('scared', 700); }
  } }
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
  for (const bp of OBS.bumps) if (!bp.hit && ps0 < bp.s && R.s >= bp.s && Math.abs(R.x) < HALF + 0.1) { // speed bump: at speed the car loses control
    bp.hit = true;
    if (!R.grounded && !R.hop) { R.close++; R.clean = (R.clean || 0) + 1; if (R.y > 0.3) { lastPop = 0; pop('CLEAN ' + (R.bumps + R.clean) + '/' + BUMP_N, 'green'); } continue; }
    R.bumps++; bp.m.scale.y = 0.6;
    if (!R.grounded) continue; // still in the air from the last bump: flew over this one (counts as hit, no new kick)
    const sev = clamp((R.speed - 12) / 20, 0, 1.8); // 0 at 27 mph and under, 1 at 72 mph
    R.grounded = false; R.hop = true; R.vy = 1.0 + Math.min(R.speed, 40) * 0.05 * (1 + sev * 0.3); // a hop, not a launch, even at 200 mph crouchV += 5 + R.speed * 0.15;
    const side = Math.random() < 0.5 ? -1 : 1; R.wild += sev; R.yawV += side * sev * rand(0.15, 0.45) + rand(-0.15, 0.15) * R.wild; R.rollV += rand(-1, 1) * sev * 0.9 + side * sev * 0.3; // kicked sideways and up on one wheel
    setHP(HP - Math.round(1 + sev * 5)); carHit(sev * 0.16, 0, 1); // the bump smacks the nose and front wing
    lastPop = 0; pop(R.wild > 1.3 ? 'NO CONTROL!' : sev > 0.5 ? 'WHOA! ' + (R.bumps + (R.clean || 0)) + '/' + BUMP_N : 'BUMP ' + (R.bumps + (R.clean || 0)) + '/' + BUMP_N, sev > 0.5 ? 'green' : '');
    if (sev > 0.5) setFace('scared', 1200);
    if (!reduceMotion) shake = Math.min(0.7, shake + 0.12 + sev * 0.3); clank(3 + Math.round(sev * 3)); tone(140, 55, 0.18, 'sine', Math.min(0.3, 0.08 + R.speed * 0.006));
    burst(new V3(R.x, 0.15, -R.s), 10 + Math.round(R.speed * 0.6), SPARK, 4);
    if (HP <= 0) { crash('rollover'); return; }
  }
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
    if (!b.used && R.grounded && Math.abs(R.s - b.s) < 1.8 && Math.abs(R.x - b.x) < 1.4) { b.used = true; R.speed = Math.min(VMAX, R.speed + 6); pop('BOOST!', 'green'); tone(300, 1300, 0.3, 'sawtooth', 0.04); }
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
    if (board.position.y < fl + 0.06 && board.position.y > fl - 0.8) { board.position.y = fl + 0.06; if (VEH === 'cart' && BB.v.y < -3) { const lp = board.worldToLocal(new V3(board.position.x, fl, board.position.z)); labDentAt(clamp(lp.y / CART_S, 0, 1.02), clamp(lp.z / CART_S, -0.47, 0.58), -BB.v.y); } if (BODY === 'car' && BB.v.y < -2) { if (CART_ROOT.userData.hd) hdGroundHit(((-BB.v.y - 2) * 0.09 + BB.w.length() * 0.01) * 1.3); else carHit((-BB.v.y - 2) * 0.09 + BB.w.length() * 0.01, Math.random() < 0.5 ? -1 : 1, rand(-1, 1) | 0); } if (BB.v.y < 0) BB.v.y *= -0.35; BB.v.x *= 0.9; BB.v.z *= 0.9; BB.w.multiplyScalar(0.8); } // every tumble hits the road: more dents, more parts off
    if (L.rails && Math.abs(board.position.x) > HALF - 0.6 && board.position.y < fl + 1.6 && board.position.y > fl - 0.5 && Math.sign(BB.v.x) === Math.sign(board.position.x)) { const sd = Math.sign(board.position.x); board.position.x = sd * (HALF - 0.6); BB.v.x *= -0.45; BB.w.y += rand(-4, 4); carHit(Math.min(0.6, Math.abs(BB.v.x) * 0.05 + 0.1), sd, 0); burst(board.position.clone(), 25, SPARK, 6); clank(4); } // the tumbling car bangs off the guard rails instead of leaving the road
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
  if (state === 'intro') { const by = b.y - START_H; wantPos.set(3.8, START_H + Math.max(2.5, by * 0.55 + 2.6), b.z + 7.5); wantLook.set(0, START_H + by * 0.85 + 0.8, b.z - 8); return 5; }
  if (state === 'ride') {
    if (!R.grounded && R.s > RAMP1 - 1) { wantPos.set(b.x + 12, b.y + 2.2, b.z + 3.5); wantLook.set(b.x, b.y + 1, b.z - 3); return 3; }
    const fb = FLOCK.filter(f => f.state === 'ride').length, back = fb > 2 ? 4.2 : fb > 0 ? 2 : 0;
    wantPos.set(b.x * 0.7, b.y + 3.2 + back * 0.4, b.z + 6.6 + back); wantLook.set(b.x * 0.85, b.y + 1.3, b.z - 9);
    if (DROP && R.s < DROP.s1 + 12) { wantPos.y = Math.max(wantPos.y, (trackH(R.s - 6.6 - back) ?? 0) + 2.4); wantLook.y += ((trackH(R.s + 9) ?? R.y) - R.y) * 0.8; } // on the drop-in: stay above the deck behind him and look down the slope
    return 7;
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
const QUAL = { opts: ['auto', '3', '2.5', '2', '1.5'], i: 0 }; 
const qFixed = () => QUAL.i === 0 ? 0 : +QUAL.opts[QUAL.i];
let AA_ON = msaaOK;
function setPR(p) { p = Math.max(1.25, Math.min(PR_MAX, p)); if (Math.abs(p - PR) < 0.01) return; PR = p;
  try { const ms = msaaOK && p <= 2.001 ? 4 : 0; AA_ON = ms > 0; if (composer.renderTarget1.samples !== ms) for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.samples = ms; rt.dispose(); } fxaa.uniforms.aa.value = ms === 0 && p < 2.5 ? 1 : 0; } catch (e) { /* keep what we have */ }
  try { resize(); } catch (e) {} }
const ADAPT = { ema: 16.7, low: 0, hi: 0, cool: 0, noRaise: 0, lastUp: 0, t0: performance.now(), crash: false, saved: 0, idle: false, runPR: 0 };
function idleSharp(on) { // in the menu: native resolution; when the run starts: back to the governor's
  const A = ADAPT; if (qFixed()) return; if (on && !A.idle) { A.idle = true; let r = PR; if (A.worst) { if (A.worst > 21 && r > 1.5) r = Math.max(1.5, r - (A.worst > 28 ? 0.5 : 0.25)); else if (A.worst < 17.8 && r < AUTO_MAX) r = Math.min(AUTO_MAX, r + 0.125); A.worst = 0; } A.runPR = r; setPR(PR_MAX); } else if (!on && A.idle) { A.idle = false; setPR(A.runPR || AUTO_MAX); A.ema = 16.7; A.cool = 1.5; A.low = 0; } }
function crashBudget(on) { // the moment of the crash is the heaviest of all: just before it the resolution steps down a notch (a hitch now, not in the middle of the impact) and it comes back when the scene is reset
  const A = ADAPT; if (qFixed()) return; if (on && !A.crash) { A.crash = true; A.saved = PR; setPR(Math.min(PR, 1.75)); } else if (!on && A.crash) { A.crash = false; setPR(A.saved); A.ema = 16.7; A.cool = 2; } }
function adaptRes(dt, now) { locStep(dt); // keeps the frame rate at 60: steps down quickly when it sags (and for the crash), creeps back up when there is room, and does not go back up where it failed before
  const A = ADAPT, fx = qFixed(); if (fx) { setPR(fx); return; }
  if (A.idle) return; if (PR > AUTO_MAX) { setPR(AUTO_MAX); return; } if (A.crash || now - A.t0 < 5000) return; if (A.cool > 0) { A.cool -= dt; return; }
  A.ema += (dt * 1000 - A.ema) * 0.12;
  if (MODE === 'lab') { if (LAB.phase === 'roll' || LAB.phase === 'crash') A.worst = Math.max(A.worst || 0, A.ema); return; } // in the lab only measured here; the resolution is adjusted between runs, in the menu
  if (A.ema > 19.5) { A.low += dt; A.hi = 0; if (A.low > 0.45) { setPR(PR - (A.ema > 28 ? 0.5 : 0.25)); A.low = 0; A.ema = 16.7; A.cool = 1.2; if (now - A.lastUp < 9000) A.noRaise = now + 45000; } }
  else { A.low = 0; if (A.ema < 17.4 && PR < AUTO_MAX && now > A.noRaise) { A.hi += dt; if (A.hi > 7) { setPR(PR + 0.125); A.hi = 0; A.lastUp = now; A.cool = 1.2; } } else A.hi = 0; } }
function resize() {
  const W = stage.clientWidth, H = stage.clientHeight;
  let w = W, h = H;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.style.left = Math.round((W - w) / 2) + 'px'; canvas.style.top = Math.round((H - h) / 2) + 'px';
  renderer.setSize(w, h, false); composer.setPixelRatio(PR); composer.setSize(w, h); fxaa.uniforms.px.value.set(1 / (w * PR), 1 / (h * PR));
  camera.aspect = w / h; camera.fov = baseFov(); camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
const clock = new THREE.Clock();
let acc = 0, landedTrick = false;
let lastTs = 0;
// ---------- speed show (level option rush: true): speed lines, a big speedometer, rumble, mph milestones ----------
const CAR_FLAMES = (BODY === 'car' && CART_ROOT && CART_ROOT.userData.flames) || []; // exhaust flames, longer the faster he goes
const RUSHFX = { mesh: null, seg: [], mph: 0, v: 0, lastP: new V3(), el: null, show: false };
if (RUSH) {
  const N = 90, m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.022, 1), new THREE.MeshBasicMaterial({ color: glowColor(0xffffff, 1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), N);
  m.frustumCulled = false; m.renderOrder = 5; scene.add(m); RUSHFX.mesh = m;
  for (let i = 0; i < N; i++) { const a = rand(0, TAU), r = rand(1.4, 5.5); RUSHFX.seg.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.75, z: rand(-60, 0) }); }
  const el = document.createElement('div'); el.className = 'rushspd'; el.innerHTML = '<b>0</b><span>MPH</span>'; stage.appendChild(el); RUSHFX.el = el;
}
if (BUMP_N) { const c = document.createElement('div'); c.className = 'chip'; c.innerHTML = 'Bumps <b id="bumpN">0/' + BUMP_N + '</b>'; const hud = document.querySelector('.hud'); if (hud) hud.insertBefore(c, hud.children[1] || null); }
const _rm = new THREE.Matrix4(), _rqI = new THREE.Quaternion(), _rs = new V3(), _rp = new V3();
function rushStep(dt, live) {
  if (CAR_FLAMES.length) { const sp = live ? (state === 'ride' ? R.speed : 0) : RUSHFX.v, on = sp > 28 || (live && FX.boostT > 0 && state === 'ride'); for (const f of CAR_FLAMES) { f.visible = on; if (on) f.scale.set(rand(0.8, 1.15), (0.5 + Math.min(1.1, (sp - 22) / 30)) * rand(0.75, 1.2), 1); } }
  if (BUMP_N && $('bumpN')) $('bumpN').textContent = ((R.bumps || 0) + (R.clean || 0)) + '/' + BUMP_N;
  if (!RUSH) return;
  // speed: Daggie's own while riding, measured from the car's movement in replays
  const d = board.position.distanceTo(RUSHFX.lastP); RUSHFX.lastP.copy(board.position); const meas = dt > 0 && d < 20 ? d / dt : RUSHFX.v;
  RUSHFX.v += ((live ? (state === 'ride' ? R.speed : state === 'intro' ? 0 : RUSHFX.v * 0.9) : meas) - RUSHFX.v) * Math.min(1, dt * (live ? 12 : 4));
  const v = RUSHFX.v, mph = Math.round(v * 2.237); RUSHFX.mph = mph;
  RUSHFX.show = live ? (state === 'ride' || state === 'passed') : (state === 'replay' && v > 2);
  const el = RUSHFX.el; el.classList.toggle('on', RUSHFX.show); el.firstChild.textContent = String(mph);
  const heat = clamp((mph - 50) / 110, 0, 1); el.style.setProperty('--heat', heat.toFixed(3)); el.classList.toggle('hot', mph >= 100);
  // speed lines streaming past the camera
  const m = RUSHFX.mesh, op = clamp((v - 24) / 34, 0, 0.6); m.material.opacity = op; m.visible = op > 0.01;
  if (m.visible) {
    m.position.copy(camera.position); m.quaternion.copy(camera.quaternion); const len = clamp((v - 20) * 0.14, 0.6, 7);
    RUSHFX.seg.forEach((sg, i) => { sg.z += v * 1.3 * dt; if (sg.z > 2) { sg.z = rand(-70, -40); const a = rand(0, TAU), r = rand(1.4, 5.5); sg.x = Math.cos(a) * r; sg.y = Math.sin(a) * r * 0.75; }
      _rp.set(sg.x, sg.y, sg.z); _rs.set(1, 1, len); _rm.compose(_rp, _rqI, _rs); m.setMatrixAt(i, _rm); });
    m.instanceMatrix.needsUpdate = true;
  }
  if (live && state === 'ride' && R.lean && R.grounded && Math.random() < 0.6) burst(new V3(R.x + (R.lean > 0 ? 0.8 : -0.8), 0.05, -R.s + rand(-0.8, 1.2)), 3, SPARK, 3); // a corner with no wheel grinds on the road
  if (!live || state !== 'ride') return;
  // milestones every 20 mph from 60, and a rumble that grows with speed
  const next = Math.max(60, (R.mile || 0) + 20);
  if (mph >= next) { R.mile = next; lastPop = 0; pop(next >= 100 ? next + ' MPH!!' : next + ' MPH!', next >= 120 ? 'green' : 'lilac'); tone(400 + next * 4, 900 + next * 6, 0.3, 'sawtooth', 0.04); if (next >= 100) setFace('scared', 900); }
  if (R.grounded && !reduceMotion) shake = Math.max(shake, clamp((v - 30) / 45, 0, 1) * 0.09);
}
function frame(vts) {
  const now = performance.now(), fts = vts || now;
  { const on = state === 'intro' || state === 'ride' || state === 'passed' || state === 'crashed'; if (on !== stage.classList.contains('playing')) stage.classList.toggle('playing', on); }
  const dt = lastTs ? Math.min(0.05, Math.max(0.001, (fts - lastTs) / 1000)) : 1 / 60; lastTs = fts; adaptRes(dt, now);
  if (state === 'replay') {
    replayFrame(dt);
    if (PLAY) PLAY.shotSnap = snapCam;
    if (snapCam) { camPos.copy(wantPos); camLook.copy(wantLook); snapCam = false; }
    const fc = 1 - Math.exp(-dt * 9); if (PLAY && PLAY.rigid) { camPos.copy(wantPos); camLook.lerp(wantLook, Math.min(1, fc * 2.5)); } else { camPos.lerp(wantPos, fc); camLook.lerp(wantLook, Math.min(1, fc * 1.4)); }
    camera.position.copy(camPos); camera.lookAt(camLook); if (PLAY && PLAY.roll) camera.rotateZ(PLAY.roll);
    const wf = PLAY ? PLAY.fov : baseFov(); if (Math.abs(camera.fov - wf) > 0.05) { camera.fov += (wf - camera.fov) * (PLAY && PLAY.shotSnap ? 1 : 0.25); camera.updateProjectionMatrix(); }
    sunLight.position.copy(camLook).addScaledVector(SUN, 40); sunLight.target.position.copy(camLook);
    rushStep(dt, false); composer.render(); if (PLAY && PLAY.wantRec) { PLAY.wantRec = false; startRecorder(); } if (recorder) composite(); requestAnimationFrame(frame); return;
  }
  let ts = now < hitStopUntil ? 0.02 : now < slowUntil ? slowK : 1; if (manualSlow) ts = Math.min(ts, 0.35); // hit-stop: the picture almost freezes for a moment on a hard hit
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
      R.carryT += sdt; R.y = START_H + DROP_H;
      drone.position.set(R.x, START_H + DROP_H + 2.55, -R.s); drone.rotation.set(-0.16, 0, Math.sin(simT * 3) * 0.04);
      if (R.carryT >= 0.55) { R.carry = false; R.vy = 0; tone(700, 300, 0.12, 'square', 0.05); pop('DROP!', 'lilac'); setFace('scared', 900); }
    } else {
      R.vy -= 9.8 * sdt; R.y += R.vy * sdt;
      drone.position.y += sdt * 7; drone.position.z -= sdt * (INTRO_V + 5); drone.rotation.x = -0.35;
    }
    if (!R.carry && R.y <= START_H) {
      R.y = START_H; R.vy = 0; R.grounded = true; R.speed = INTRO_V; state = 'ride'; stateT = now; drone.visible = false;
      crouch = 0.9; crouchV = 0; landImpact(6);
      burst(new V3(0, START_H + 0.2, -R.s), 40, SPARK, 7); tone(150, 45, 0.3, 'sine', 0.3); pop(trick.name, 'lilac'); setFace('wow', 1100);
      if (!reduceMotion) shake = 0.45; // no slow-mo here: the ride starts at full speed right on touchdown
    }
  }
  if ((state === 'ride' || state === 'passed') && MODE !== 'lab') {
    const n = Math.min(16, Math.max(1, Math.ceil(sdt * 120 * (R.speed > 40 ? R.speed / 30 : 1) - 1e-6))), h = sdt / n; // more steps at very high speed, so thin obstacles are not skipped
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
  stepMess(sdt); carBreakStep(sdt); hdShardStep(sdt);
  drawFace(now);
  updateSparks(sdt);
  const k = camTargets(now, dt);
  if (snapCam) { camPos.copy(wantPos); camLook.copy(wantLook); snapCam = false; }
  const f = 1 - Math.exp(-dt * k);
  camPos.lerp(wantPos, f); camLook.lerp(wantLook, Math.min(1, f * 1.5));
  camera.position.copy(camPos);
  if (shake > 0.003) { camera.position.x += rand(-1, 1) * shake * 0.3; camera.position.y += rand(-1, 1) * shake * 0.3; shake *= Math.pow(0.02, dt); }
  camera.lookAt(camLook);
  const tgtFov = baseFov() + (state === 'ride' ? Math.min(18, Math.max(0, R.speed - 14) * 0.5) : 0);
  if (Math.abs(camera.fov - tgtFov) > 0.05) { camera.fov += (tgtFov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  sunLight.position.copy(camLook).addScaledVector(SUN, 40); sunLight.target.position.copy(camLook);
  rushStep(dt, true); lavaAnimate(simT, sdt);
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
    for (const c of this.cyls) { if (x[k + 1] > c.h + r) continue; const dx = x[k] - c.x, dz = x[k + 2] - c.z, d = Math.hypot(dx, dz);
      if (c.rim && x[k + 1] > c.h - c.rim) { // a rounded top edge: the body that meets the upper part is pushed up and forward over it, and can land on top
        const cy = c.h - c.rim, ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0, u = Math.max(0, d - (c.r - c.rim)), v = x[k + 1] - cy, dd = Math.hypot(u, v);
        if (dd < c.rim + r) { const f = (c.rim + r) / (dd || 1e-6), nu = u / (dd || 1e-6), nv = v / (dd || 1e-6), nd = u > 0 ? (c.r - c.rim) + u * f : d; x[k] = c.x + ux * nd; x[k + 2] = c.z + uz * nd; x[k + 1] = cy + v * f; this.contact(i, ux * nu, nv, uz * nu); if (this.cylFirst === undefined) this.cylFirst = this.time; }
        continue; }
      if (d < c.r + r) { const f = (c.r + r) / (d || 1e-6); x[k] = c.x + dx * f; x[k + 2] = c.z + dz * f; this.contact(i, dx / (d || 1), 0, dz / (d || 1)); if (this.cylFirst === undefined) this.cylFirst = this.time; } }
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
      const fr = this.damp ?? 0.999; // per-step velocity loss (0.1%): fine for the cart, far too much for a 60 m/s flight, so the cannon sets it to 1
      const fy = this.airXZ ? 1 : fr; // airXZ: the air only slows him sideways (a fall is not a parachute drop)
      let vx = (x[k] - o[k]) * fr, vy = (x[k + 1] - o[k + 1]) * fy, vz = (x[k + 2] - o[k + 2]) * fr;
      if (this.drag) { const q = 1 / (1 + this.drag * (this.airXZ ? Math.hypot(vx, vz) : Math.hypot(vx, vy, vz)) / dt * dt); vx *= q; vz *= q; if (!this.airXZ) vy *= q; } // air drag: the faster, the more it slows
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
      if (vn < 0) { if (this.onImpact && -vn / this.dt > 2.5) this.onImpact(i, -vn / this.dt, ny); vx -= nx * vn; vy -= ny * vn; vz -= nz * vn; if (this.limbOf && this.tearSpeed && -vn / this.dt > this.tearSpeed) { const g = this.limbOf[i]; if (g && Math.random() < 0.6) this.breakGroup(g); } }
      if (this.cf[i] === 1) { const f = this.friction ?? 0.75; vx *= f; vz *= f; if (Math.abs(ny) < 0.7) vy *= f; }
      o[k] = x[k] - vx; o[k + 1] = x[k + 1] - vy; o[k + 2] = x[k + 2] - vz;
    }
    if (this.crashK && this.cylFirst !== undefined && this.time - this.cylFirst < 0.12) { const m = 1 - this.crashK; for (let i = 0; i < n; i++) { if (!this.inv[i]) continue; const k = i * 3; o[k] = x[k] - (x[k] - o[k]) * m; o[k + 1] = x[k + 1] - (x[k + 1] - o[k + 1]) * m; o[k + 2] = x[k + 2] - (x[k + 2] - o[k + 2]) * m; } } // the first 0.12 s after the first hit on a heavy obstacle: the whole body gives up most of its speed (a crash, not a ricochet)
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
    Object.assign(this, { S, lane, bz, br, zfOut: -0.47 * S - 0.012, zbOut: 0.72 * S, H: 1.12 * S, mode: 'roll', a: 0, w: 0, vy: 0, vz: 0, pl: [0, -0.47 * S - 0.012], pw: [0, 0], knocked: false, burst: false, tipW: 1, rebound: 1, knockV: 30, bendV: 10, tumbleV: 10, solid: false, solidMax: Infinity, plow: false, obsH: 1.1, obsCyls: null, openFront: false });
    const me = this;
    this.box = { on: true, toLocalPrev: (x, y, z) => me.toLocalPrev(x, y, z), hw: 0.32 * S, y0: 0.4 * S, y1: 1.02 * S, zf: -0.45 * S, zb: 0.45 * S, frontOpen: false, toWorld: (x, y, z) => me.toWorld(x, y, z), toLocal: (x, y, z) => me.toLocal(x, y, z), dirWorld: (x, y, z) => me.dirWorld(x, y, z) };
    this.cyls = [{ x: lane, z: bz, r: br, h: 1.1 }];
  }
  setSpec(sp) { Object.assign(this.box, { hw: sp.hw, y0: sp.y0, y1: sp.y1, zf: sp.zf, zb: sp.zb }); this.zf0 = sp.zf; this.zfOut = sp.zfOut; this.zbOut = sp.zbOut; this.H = sp.H; this.pl = [0, this.zfOut]; }
  place(zFront) { this.bent = false; this.tumble = false; this.mode = 'roll'; this.a = 0; this.w = 0; this.vy = 0; this.pl = [0, this.zfOut]; this.pw = [0, zFront]; this.knocked = false; this.burst = false; this.plow = false; this.box.frontOpen = this.openFront; this.cyls.length = 0; for (const c of (this.obsCyls || [{ dx: 0, r: this.br }])) this.cyls.push({ x: this.lane + c.dx, z: this.bz + (c.dz || 0), r: c.r, h: c.h || this.obsH, rim: c.rim || 0 }); }
  toWorld(x, y, z) { const c = Math.cos(-this.a), s = Math.sin(-this.a), yy = y - this.pl[0], zz = z - this.pl[1]; return [x + this.lane, this.pw[0] + yy * c - zz * s, this.pw[1] + yy * s + zz * c]; }
  toLocal(X, Y, Z) { const c = Math.cos(this.a), s = Math.sin(this.a), yy = Y - this.pw[0], zz = Z - this.pw[1]; return [X - this.lane, yy * c - zz * s + this.pl[0], yy * s + zz * c + this.pl[1]]; }
  dirWorld(x, y, z) { const c = Math.cos(-this.a), s = Math.sin(-this.a); return [x, y * c - z * s, y * s + z * c]; }
  impact(v) { // v: speed at the moment the front touches the bollard
    // the cart is stopped at its front edge and its back end swings up over the nose. 15 mph: it noses up and drops back. 50 mph and more: it tips over the front and tumbles ahead.
    if (v >= this.knockV && v < this.tumbleV) { this.knocked = true; this.plow = true; this.tumble = false; this.cyls.length = 0; this.mode = 'roll'; this.vz = -v * 0.85; return; } // a soft obstacle: the vehicle ploughs through it, slowed, without tipping over
    this.mode = 'pivot'; this.pw = [0, this.knockedAt(v) ? this.pw[1] : this.bz + this.br]; this.pl = [0, this.zfOut];
    this.tumble = v >= this.tumbleV; this.pdamp = 0.05; this.burst = this.tumble; this.box.frontOpen = this.tumble || this.openFront; // 50 mph and up: the rider's weight bends the front wires open and he goes out over them
    if (!this.knockedAt(v)) { this.vz = v * 0.1 * this.rebound; this.w = (v < this.tumbleV ? v * 0.2 : Math.min(9, v * 0.34)) * this.tipW; if (this.tumble) { if (!(this.solid && v < this.solidMax)) this.cyls.length = 0; this.bent = true; } return; } // (a solid obstacle stops him until it is hit too hard: then it is shoved aside) // the bent post no longer stops the rider (it leans over, see labImpact)
    this.knocked = true; this.cyls.length = 0;
    this.vz = -0.5 * v; this.w = Math.min(12, v * 0.3) * this.tipW; this.pdamp = 0.6; // the snapped post barely slows it: it rolls on and goes over
  }
  knockedAt(v) { return v >= this.knockV || (this.solid && v >= this.solidMax); }
  savePrev() { this.prev = { a: this.a, pw: this.pw.slice(), pl: this.pl.slice() }; }
  toLocalPrev(X, Y, Z) { const p = this.prev || this, c = Math.cos(p.a), s = Math.sin(p.a), yy = Y - p.pw[0], zz = Z - p.pw[1]; return [X - this.lane, yy * c - zz * s + p.pl[0], yy * s + zz * c + p.pl[1]]; }
  step(dt) {
    this.savePrev();
    if (this.mode === 'roll') { if (this.plow) this.vz *= Math.pow(0.3, dt); this.pw[1] += this.vz * dt; return this.pw[1] <= this.bz + this.br; } // true = touching the bollard
    if (this.mode === 'pivot') {
      this.pw[1] += this.vz * dt; this.vz *= Math.pow(this.pdamp ?? 0.05, dt); this.w -= 20 * Math.cos(this.a) * dt; this.a += this.w * dt;
      if (this.a < 0) { this.a = 0; this.w = -this.w * 0.25; }
      if (!this.tumble) { if (this.a > 1.35) { this.a = 1.35; this.w = Math.min(0, this.w); } return false; }
      // tumbling: once the weight is ahead of the front edge the cart goes over it and flies on as a free body
      const cw = this.toWorld(0, 0.55 * this.S, 0), ry = cw[1] - this.pw[0], rz = cw[2] - this.pw[1];
      if (rz < 0 && this.w > 0) { this.pl = [0.55 * this.S, 0]; this.vy = this.w * rz; const vz = this.vz - this.w * ry; this.pw = [cw[1], cw[2]]; this.vz = vz; this.mode = 'free'; }
      return false;
    }
    this.vy -= 9.8 * dt; this.pw[0] += this.vy * dt; this.pw[1] += this.vz * dt; this.a += this.w * dt;
    let minY = 1e9, low = null; for (const y of [0, this.H]) for (const z of [this.zfOut, this.zbOut]) { const wy = this.toWorld(0, y, z)[1]; if (wy < minY) { minY = wy; low = [y, z]; } }
    if (minY < 0 && this.vy < -2.5 && this.onHit) this.onHit(low, -this.vy); // a corner slams into the floor
    if (minY < 0) { this.pw[0] -= minY; if (this.vy < 0) this.vy = -this.vy * 0.35; this.vz *= Math.pow(0.12, dt); this.w *= Math.pow(0.2, dt); if (Math.abs(this.w) < 2.5) this.w -= Math.sin(2 * this.a) * 8 * dt; }
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
  core.floor = floorAt; core.box = LABCART.box; core.cyls = LABCART.cyls; { const OR2 = LAB.machine === 'mix' && OBX.cur !== 'post' && OBST[OBX.cur] && OBST[OBX.cur].rider; core.crashK = (OR2 && OR2.crash) || 0; if (OR2 && OR2.cap) core.capUp = OR2.cap; if (labBol()) core.onImpact = (i, sp, ny) => { bodyHit(sp, ny > 0.7); if (ny <= 0.7 && OBX.cur !== 'post') obsGlassHit(core.x[i * 3], core.x[i * 3 + 1], core.x[i * 3 + 2], sp); }; }
  const I = ragBody(core, rest, now, fw, RAG_TUNE);
  { const half = n => { const bb = byName[n].userData.mesh.geometry.boundingBox, e = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort((a, b) => a - b); return e[1] * 0.5; };
    const src = { pel: 'pelvis', waist: 'torso', chest: 'torso', neck: 'head', top: 'head', shL: 'upperL', elL: 'upperL', wrL: 'foreL', haL: 'handL', shR: 'upperR', elR: 'upperR', wrR: 'foreR', haR: 'handR', hipL: 'thighL', knL: 'thighL', anL: 'shinL', toL: 'footL', hipR: 'thighR', knR: 'thighR', anR: 'shinR', toR: 'footR' };
    for (const n in src) if (byName[src[n]]) core.r[I[n]] = clamp(half(src[n]) * (n === 'chest' || n === 'waist' ? 0.8 : 0.95), 0.05, 0.22); }
  core.initCart();
  core.skipBox = new Uint8Array(core.n);
  // no grip: Daggie doesn't hold on to the cart, he's carried only by the basket walls and his own inertia
  core.settle(); for (let i = 0; i < core.n; i++) core.vel(i, vel.x, vel.y, vel.z, 1 / 240);
  const fast = impactV >= 10; // 50 mph and up: the tipping cart throws him out ahead in an arc, head first, spinning forward (tested offline)
  if (fast) { const Ld = (VEH_DEFS[LAB_VEH] && VEH_DEFS[LAB_VEH].launch) || { up: 0.22, min: 4.5, max: 7, om: -3, yaw: 0 }, pk = I.pel * 3, xc = core.x[pk], yc = core.x[pk + 1] + 0.3, zc = core.x[pk + 2], OR = LAB.machine === 'mix' && OBX.cur !== 'post' && OBST[OBX.cur] && OBST[OBX.cur].rider, up = clamp(Ld.up * impactV, Ld.min, Ld.max) * (OR ? OR.up : 1), om = Ld.om * (OR ? OR.om : 1), yaw = Ld.yaw * (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.2); // how he leaves: arc height, forward somersault, swivel
    for (let i = 0; i < core.n; i++) { const k = i * 3, rx = core.x[k] - xc, ry = core.x[k + 1] - yc, rz = core.x[k + 2] - zc; core.vel(i, vel.x + yaw * rz, vel.y + up - om * rz, vel.z * (Ld.keep ?? 1) + om * ry - yaw * rx, 1 / 240); }
    core.friction = 0.995; core.drag = 0.01; }
  const pk0 = I.pel * 3, seatY = CART.toLocal(core.x[pk0], core.x[pk0 + 1], core.x[pk0 + 2])[1];
  const restB = {}, corr = {}; for (const n in RAG_PARTS) { const q = RAG_PARTS[n]; restB[n] = ragBasis(rest[q[0]], rest[q[1]], rest[q[2]], rest[q[3]], new THREE.Matrix4()); }
  // keep each part's own twist: remember how its real rotation differs from the one rebuilt from the points
  for (const p of parts) { const q = RAG_PARTS[p.name]; if (!q) continue; ragBasis(now[q[0]], now[q[1]], now[q[2]], now[q[3]], _rm1); _rm0.copy(restB[p.name]).transpose(); _rm1.multiply(_rm0); const rec = new THREE.Quaternion().setFromRotationMatrix(_rm1); corr[p.name] = rec.invert().multiply(p.getWorldQuaternion(new THREE.Quaternion())); }
  for (const p of parts) scene.attach(p);
  core.onBreak = g => { const k = I[{ armL: 'shL', armR: 'shR', legL: 'hipL', legR: 'hipR', head: 'neck' }[g]] * 3, pos = new V3(core.x[k], core.x[k + 1], core.x[k + 2]);
    for (let i = 0; i < 16; i++) spawnDrop(pos.clone(), new V3(rand(-2, 2), rand(0.5, 3), rand(-2, 2)), rand(0.012, 0.024)); burst(pos, 50, SPARK, 10); ripSound();
    setFace('hit', 1500); };
  core.onRelease = () => { setFace('scared', 1500); };
  RAGSIM = { core, I, rest, restB, corr, t: 0, seatY, fast };
}
// sparks off his metal body: scraping along the floor, hard knocks and torn limbs. Called every frame after the physics.
const SPK_PTS = ['pel', 'chest', 'top', 'knL', 'knR', 'anL', 'anR', 'haL', 'haR', 'toL', 'toR'];
function ragSparks(S, dt) {
  const c = S.core, I = S.I; S.spk = S.spk || { t: {}, v: {}, snd: 0 };
  S.spk.snd -= dt;
  for (const nm of SPK_PTS) {
    const k = I[nm] * 3, vx = (c.x[k] - c.o[k]) * 240, vy = (c.x[k + 1] - c.o[k + 1]) * 240, vz = (c.x[k + 2] - c.o[k + 2]) * 240, v = Math.hypot(vx, vy, vz), hv = Math.hypot(vx, vz), prev = S.spk.v[nm] ?? v;
    S.spk.v[nm] = v; S.spk.t[nm] = (S.spk.t[nm] || 0) - dt;
    const p = _pa.set(c.x[k], c.x[k + 1], c.x[k + 2]);
    if (prev - v > 4 && S.spk.t[nm] <= 0) { burst(p, 6 + Math.round((prev - v) * 1.2), SPARK, 3 + (prev - v) * 0.15); S.spk.t[nm] = 0.08; } // a hard knock: v dropped fast
    else if (c.x[k + 1] < 0.2 && hv > 6 && S.spk.t[nm] <= 0) { burst(p, 2 + Math.round(hv * 0.18), SPARK, 2 + hv * 0.12); S.spk.t[nm] = 0.035; if (S.spk.snd <= 0 && hv > 9) { scrapeSound(hv); S.spk.snd = 0.12; } } // dragging along the floor
  }
}
function labDmg(show, val, label, unit, dec, sub) {
  let el = document.getElementById('labDmg');
  if (!el) { if (!show) return; const st = document.createElement('style'); st.textContent = '#labDmg{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 112px);transform:translateX(-50%);z-index:8;pointer-events:none;white-space:nowrap;font:800 min(40px,10vw) "Chakra Petch",ui-sans-serif,system-ui,sans-serif;color:#ffd23a;-webkit-text-stroke:2px #1a1020;paint-order:stroke fill;text-shadow:0 4px 0 #1a1020,0 0 22px rgba(255,170,30,.8);font-variant-numeric:tabular-nums;text-align:center;line-height:1.05}#labDmg .s{font-size:.42em;letter-spacing:2px;color:#fff;-webkit-text-stroke:1px #1a1020;text-shadow:0 2px 0 #1a1020;margin-top:2px}.cannonrun #labDmg{top:calc(env(safe-area-inset-top,0px) + 14px);font-size:min(34px,9vw)}.cannonrun .labgauge{opacity:0!important;pointer-events:none!important;transition:opacity .15s}.cannonrun #hook{opacity:0!important;transition:none!important}'; document.head.appendChild(st); el = document.createElement('div'); el.id = 'labDmg'; stage.appendChild(el); }
  el.style.display = show ? 'block' : 'none'; if (show) { const d = dec || 0, tx = (label || 'DAMAGE') + ' ' + val.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + (unit || ''); const key = tx + '|' + (sub || ''); if (el.dataset.k !== key) { el.dataset.k = key; el.textContent = ''; const l1 = document.createElement('div'); l1.textContent = tx; el.appendChild(l1); if (sub) { const l2 = document.createElement('div'); l2.className = 's'; l2.textContent = sub; el.appendChild(l2); } } }
}
function labDist() { const S = RAGSIM; if (!S) return 0; const k = S.I.pel * 3; S.maxFlight = Math.max(S.maxFlight || 0, BOLLARD_Z - S.core.x[k + 2]); return S.maxFlight * 3.28084; } // how far he flew from the post, in feet
function ragSimStep(dt) {
  const S = RAGSIM; if (!S) return; S.t += dt;
  // fixed 1/240 s physics steps (the grip and tearing limits were tuned at this rate), also in slow motion
  S.acc = (S.acc || 0) + dt; let n = 0;
  if (S.fast) { S.core.relax = S.t < 0.25; S.core.capUp = 0; } else { S.core.relax = true; S.core.capUp = 3; } // 15 mph: soft joint limits and no upward kicks, so he lurches forward and settles instead of bouncing around; tested offline
  while (S.acc >= 1 / 240 && n < 12) { labCartStep(1 / 240); S.core.step(1 / 240, 10); if (S.hook) S.hook(S.core); S.acc -= 1 / 240; n++; }
  if (LAB.bollardTip && BOLLARD) { LAB.bollardTip = Math.min(1, LAB.bollardTip + dt * 5); bollardFall(1 - Math.pow(1 - LAB.bollardTip, 3)); }
  if (n === 12) S.acc = 0;
  if (n > 0) ragSparks(S, dt);
  if (labBol() && OBX.cur !== 'post') obsTear(dt);
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
function bollardFall(e) { if (!BOLLARD) return; BOLLARD.rotation.set(-(CART.knocked ? 1.35 : 0.5) * e, (LAB.tipYaw || 0) * e, 0); } // snapped: falls flat; bent (50 mph): leans over and stays
const CART = new CartSim(CART_S, LAB_LANE, BOLLARD_Z, BOLLARD_R);
CART.zf0 = CART.box.zf;
CART.onHit = (corner, v) => { labDentAt(corner[0] / CART_S, corner[1] / CART_S, v); clank(Math.min(12, v)); };
function labDentAt(y, z, v) {
  if (LAB_VEH !== 'cart') return; // crush the wires around a corner that slammed into the floor, toward the middle of the basket
  const cage = board.getObjectByName('cage'); if (!cage) return;
  const pos = cage.geometry.attributes.position, a = pos.array, depth = clamp(v / 40, 0.02, 0.12), R = 0.22;
  for (let i = 0; i < a.length; i += 3) {
    const dy = a[i + 1] - y, dz = a[i + 2] - z, d = Math.hypot(dy, dz); if (d > R) continue;
    const k = (1 - d / R) ** 2; a[i + 1] += Math.sign(0.71 - a[i + 1]) * depth * k * 0.5; a[i + 2] += Math.sign(0.05 - a[i + 2]) * depth * k * 0.5; a[i] *= 1 + depth * 0.25 * k;
  }
  pos.needsUpdate = true; cage.geometry.computeVertexNormals();
}
const LABCART = { get box() { return CART.box; }, get cyls() { return CART.cyls; }, v: 0, hit: false };
function labWeave(dt) { // a gentle swerve on the way in (the heading follows it); it fades out over the last metres, so the hit is always dead on the target
  if (LABCART.hit) return; const W = LAB.weave || (LAB.weave = { A: rand(0.12, 0.42), f: rand(0.45, 0.9), ph: rand(0, 6.283), t: 0 }); W.t += dt;
  const dz = CART.pw[1] - BOLLARD_Z, k = clamp((dz - 3.2) / 8, 0, 1), e = k * k * (3 - 2 * k), a = W.f * 6.283, arg = a * W.t + W.ph, x = W.A * e * Math.sin(arg), vx = W.A * e * a * Math.cos(arg);
  board.position.x += x; board.rotation.y = -Math.atan2(vx, Math.max(2, LABCART.v)) * 0.8; }
function labCartPlace() { const w = CART.toWorld(0, 0, 0); board.position.set(w[0], w[1], w[2]); board.rotation.set(-CART.a, 0, 0); }
function labCartStep(dt) { if (LABCART.hit) CART.step(dt); labCartPlace(); }
function labDent(v) { // crumple the front of the basket: deeper, wider and higher the faster it hit
  if (LAB_VEH !== 'cart') return 0; // the rigid vehicles do not bend: they hold, or they shatter (cartBreak)
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

// ---------- the cart falls apart on a hard hit (100 mph and up): basket panels, handle, forks and wheels fly off as separate pieces ----------
const CDEB = { list: [], on: false, timer: 0, built: false, cool: 0 };
function cartDebrisBuild() {
  if (CDEB.built || !CART_ROOT) return; CDEB.built = true;
  const g = CART_ROOT.userData.g, chromeM = CART_ROOT.userData.pieceMat || new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.2 });
  for (const p of CART_ROOT.userData.pieces) {
    const geo = p.geo.clone(); geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(new V3()); geo.translate(-c.x, -c.y, -c.z);
    const m = new THREE.Mesh(geo, chromeM); m.castShadow = true; m.visible = false; scene.add(m);
    const sz = new V3(); geo.boundingBox.getSize(sz); CDEB.list.push({ m, c, q: new THREE.Quaternion(), r: CART_ROOT.userData.bigPieces ? clamp(Math.min(sz.x, sz.y, sz.z) * 0.5 * CART_S, 0.05, 0.25) : 0.12, v: new V3(), w: new V3(), rest: true, cd: 0, mk: 'ceramic' });
  }
  for (const o of CART_ROOT.userData.extras) {
    const m = o.clone(); m.visible = false; m.position.set(0, 0, 0); scene.add(m);
    CDEB.list.push({ m, c: o.position.clone(), q: o.quaternion.clone(), r: o.isGroup ? 0.08 : 0.06, v: new V3(), w: new V3(), rest: true, cd: 0, orig: o, mk: o.userData.mk || 'metal' });
  }
}
function cartBreak() {
  cartDebrisBuild(); if (!CDEB.list.length) return; CDEB.on = true; CART_ROOT.visible = false; CART.box.on = false;
  const v = LABCART.v, ip = new V3(LAB_LANE, 0.8, BOLLARD_Z), bq = new THREE.Quaternion(); board.getWorldQuaternion(bq); board.updateMatrixWorld(true);
  const base = new V3(0, 0, CART.vz), p = new V3(), dir = new V3(), qq = new THREE.Quaternion();
  for (const d of CDEB.list) {
    const lp = d.c.clone().multiplyScalar(CART_S); p.copy(lp); board.localToWorld(p); d.m.position.copy(p);
    qq.copy(bq).multiply(d.q); d.m.quaternion.copy(qq); d.m.scale.setScalar(CART_S); d.m.visible = true;
    dir.subVectors(p, ip); if (dir.lengthSq() < 1e-4) dir.set(rand(-1, 1), 0.5, rand(-1, 1)); dir.normalize();
    const pr = DEB_PROPS[d.mk] || DEB_PROPS.metal; d.v.copy(base).multiplyScalar(0.3 * rand(0.8, 1.2)).addScaledVector(dir, (3 + 0.06 * v) * (OBX.cur !== 'post' && OBST[OBX.cur].solid ? 1.7 : 1) * rand(0.6, 1.4) * pr.fly); d.v.y += rand(1.5, 5) * pr.lift;
    d.w.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(6, 18)); d.rest = false; d.cd = 0;
  }
  burst(new V3(LAB_LANE, 0.9, BOLLARD_Z), 90, SPARK, 9); ripSound();
}
const _dq = new THREE.Quaternion(), _da = new V3();
const DEB_PROPS = { metal: { b: 0.45, drag: 0.02, snd: 'metal', fly: 1.1, lift: 1 }, chrome: { b: 0.45, drag: 0.02, snd: 'metal', fly: 1.1, lift: 1 }, ceramic: { b: 0.26, drag: 0.02, snd: 'stone', fly: 0.8, lift: 0.9 }, fabric: { b: 0.1, drag: 0.14, snd: 'soft', fly: 0.9, lift: 1.9 }, fabric2: { b: 0.1, drag: 0.14, snd: 'soft', fly: 0.9, lift: 1.9 }, plastic: { b: 0.4, drag: 0.03, snd: 'wood', fly: 1.2, lift: 1 }, accent: { b: 0.4, drag: 0.03, snd: 'wood', fly: 1.2, lift: 1 }, black: { b: 0.4, drag: 0.03, snd: 'wood', fly: 1.2, lift: 1 }, wheel: { b: 0.58, drag: 0.015, snd: 'metal', fly: 1.7, lift: 1.2 }, rubber: { b: 0.7, drag: 0.02, snd: 'soft', fly: 1.3, lift: 2.2 }, wood: { b: 0.3, drag: 0.03, snd: 'wood', fly: 1.2, lift: 1 }, steel: { b: 0.45, drag: 0.02, snd: 'metal', fly: 1.1, lift: 1 } };
function cartDebrisStep(dt) {
  obsStep(dt);
  if (((CART.knocked && !CART.plow && LABCART.v >= 30) || (OBX.cur !== 'post' && OBST[OBX.cur].solid && LABCART.hit && LABCART.v >= 20)) && !CDEB.on) { CDEB.timer += dt; if (CDEB.timer >= 0.08) cartBreak(); }
  if (!CDEB.on) return; CDEB.cool -= dt;
  for (const d of CDEB.list) {
    if (d.rest) continue; d.cd -= dt;
    const pr = DEB_PROPS[d.mk] || DEB_PROPS.metal; d.v.y -= 9.8 * dt; d.v.multiplyScalar(1 / (1 + pr.drag * d.v.length() * dt)); d.m.position.addScaledVector(d.v, dt); // air drag: the faster the more it slows
    const wl = d.w.length(); if (wl > 1e-4) { _da.copy(d.w).multiplyScalar(1 / wl); _dq.setFromAxisAngle(_da, wl * dt); d.m.quaternion.premultiply(_dq); }
    if (d.m.position.y < d.r) {
      d.m.position.y = d.r;
      if (d.v.y < -2.5 && d.cd <= 0) { debrisHit(pr.snd, -d.v.y, d.r * 2); d.cd = 0.12; }
      if (d.v.y < -6 && d.mk !== 'fabric' && d.mk !== 'fabric2' && d.mk !== 'rubber' && CDEB.cool <= 0) { burst(d.m.position, 5, SPARK, 3); CDEB.cool = 0.05; }
      if (d.v.y < 0) d.v.y = -d.v.y * pr.b; d.v.x *= Math.exp(-5 * dt); d.v.z *= Math.exp(-5 * dt); d.w.multiplyScalar(Math.exp(-6 * dt));
      if (d.v.length() < 0.6 && d.w.length() < 1.2) { d.rest = true; d.v.set(0, 0, 0); d.w.set(0, 0, 0); }
    }
  }
}
function labDebrisSettled() { // everything that flies has landed: the obstacle's pieces, glass, the cart's parts, and Daggie himself
  const o = OBX.built[OBX.cur], sets = []; if (o && OBX.cur !== 'post') for (const t in o.sets) sets.push(o.sets[t]); if (OBX.shards) sets.push(OBX.shards); if (OBX.frag) sets.push(OBX.frag);
  for (const st of sets) { if (!st.mesh.visible) continue; for (let i = 0; i < st.N; i++) if (st.life[i] > 0 && !st.rest[i]) return false; }
  if (CDEB.on) for (const d of CDEB.list) if (!d.rest && d.m.visible) return false;
  const c = RAGSIM && RAGSIM.core; if (c) { let m = 0; for (let i = 0; i < c.n; i++) { const k = i * 3; m = Math.max(m, Math.hypot(c.x[k] - c.o[k], c.x[k + 1] - c.o[k + 1], c.x[k + 2] - c.o[k + 2])); } if (m * 240 > 1.2) return false; }
  return true;
}
function cartDebrisReset() { for (const d of CDEB.list) { d.m.visible = false; d.rest = true; } CDEB.on = false; CDEB.timer = 0; if (CART_ROOT) CART_ROOT.visible = true; CART.box.on = true; }

// ---------- the vehicle in the crash hall: the shopping cart or a bathtub on a trolley ----------
const VEH_SPECS = {"chair":{"prims":[{"t":"box","s":[0.3,0.04,0.05],"p":[0.04635254915624211,0.085,0.162658477444273],"m":"plastic","r":0.015,"rot":[0,-1.2566370614359172,0],"g":"base","n":null},{"t":"box","s":[0.014,0.07,0.05],"p":[0.09270509831248422,0.082,0.30531695488854604],"m":"plastic","r":0.005,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.04,"ax":"y","p":[0.09270509831248422,0.075,0.30531695488854604],"m":"chrome","g":"casters","n":null,"rot":[0,0,0]},{"t":"box","s":[0.3,0.04,0.05],"p":[0.15,0.085,0.02],"m":"plastic","r":0.015,"rot":[0,-0.0,0],"g":"base","n":null},{"t":"box","s":[0.014,0.07,0.05],"p":[0.3,0.082,0.02],"m":"plastic","r":0.005,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.04,"ax":"y","p":[0.3,0.075,0.02],"m":"chrome","g":"casters","n":null,"rot":[0,0,0]},{"t":"box","s":[0.3,0.04,0.05],"p":[0.04635254915624212,0.085,-0.12265847744427301],"m":"plastic","r":0.015,"rot":[0,1.2566370614359172,0],"g":"base","n":null},{"t":"box","s":[0.014,0.07,0.05],"p":[0.09270509831248425,0.082,-0.265316954888546],"m":"plastic","r":0.005,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.04,"ax":"y","p":[0.09270509831248425,0.075,-0.265316954888546],"m":"chrome","g":"casters","n":null,"rot":[0,0,0]},{"t":"box","s":[0.3,0.04,0.05],"p":[-0.12135254915624209,0.085,-0.06816778784387098],"m":"plastic","r":0.015,"rot":[0,2.5132741228718345,0],"g":"base","n":null},{"t":"box","s":[0.014,0.07,0.05],"p":[-0.24270509831248419,0.082,-0.15633557568774198],"m":"plastic","r":0.005,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.04,"ax":"y","p":[-0.24270509831248419,0.075,-0.15633557568774198],"m":"chrome","g":"casters","n":null,"rot":[0,0,0]},{"t":"box","s":[0.3,0.04,0.05],"p":[-0.12135254915624213,0.085,0.10816778784387093],"m":"plastic","r":0.015,"rot":[0,-2.513274122871835,0],"g":"base","n":null},{"t":"box","s":[0.014,0.07,0.05],"p":[-0.24270509831248427,0.082,0.19633557568774185],"m":"plastic","r":0.005,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.04,"ax":"y","p":[-0.24270509831248427,0.075,0.19633557568774185],"m":"chrome","g":"casters","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.055,"rb":0.055,"h":0.06,"ax":"y","p":[0,0.1,0.02],"m":"plastic","g":"base","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.05,"rb":0.06,"h":0.16,"ax":"y","p":[0,0.17,0.02],"m":"plastic","g":"base","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.028,"rb":0.028,"h":0.24,"ax":"y","p":[0,0.235,0.02],"m":"chrome","g":"lift","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.01,"rb":0.01,"h":0.1,"ax":"x","p":[0.2,0.33,0.02],"m":"chrome","g":"lift","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.16,"ax":"y","p":[0,1.17,0.34],"m":"chrome","g":"lift","n":null,"rot":[0,0,0]},{"t":"box","s":[0.36,0.07,0.34],"p":[0,0.345,0.04],"m":"plastic","r":0.03,"rot":[0,0,0],"g":"mech","n":null},{"t":"box","s":[0.5,0.04,0.48],"p":[0,0.405,0.02],"m":"plastic","r":0.02,"rot":[0,0,0],"g":"mech","n":null},{"t":"box","s":[0.045,0.36,0.045],"p":[-0.1,0.57,0.27],"m":"plastic","r":0.015,"rot":[0.13,0,0],"g":"mech","n":null},{"t":"box","s":[0.045,0.36,0.045],"p":[0.1,0.57,0.27],"m":"plastic","r":0.015,"rot":[0.13,0,0],"g":"mech","n":null},{"t":"box","s":[0.5,0.09,0.5],"p":[0,0.455,0.02],"m":"fabric","r":0.045,"rot":[0,0,0],"g":null,"n":"seat"},{"t":"box","s":[0.06,0.07,0.44],"p":[-0.22,0.5,0.02],"m":"fabric2","r":0.025,"rot":[0,0,0],"g":"seatpad","n":null},{"t":"box","s":[0.06,0.07,0.44],"p":[0.22,0.5,0.02],"m":"fabric2","r":0.025,"rot":[0,0,0],"g":"seatpad","n":null},{"t":"box","s":[0.44,0.05,0.06],"p":[0,0.47,-0.24],"m":"fabric2","r":0.025,"rot":[0,0,0],"g":"seatpad","n":null},{"t":"box","s":[0.46,0.52,0.07],"p":[0,0.88,0.285],"m":"fabric","r":0.05,"rot":[0.13,0,0],"g":null,"n":"back"},{"t":"box","s":[0.36,0.38,0.016],"p":[0,0.9,0.33],"m":"black","r":0.005,"rot":[0.13,0,0],"g":"backmesh","n":null},{"t":"box","s":[0.4,0.1,0.02],"p":[0,0.76,0.335],"m":"accent","r":0.01,"rot":[0.13,0,0],"g":"backstripe","n":null},{"t":"box","s":[0.3,0.1,0.05],"p":[0,0.68,0.3],"m":"fabric2","r":0.025,"rot":[0.13,0,0],"g":"backpad","n":null},{"t":"box","s":[0.26,0.13,0.06],"p":[0,1.27,0.345],"m":"fabric","r":0.04,"rot":[0.16,0,0],"g":null,"n":"headrest"},{"t":"box","s":[0.04,0.22,0.045],"p":[-0.27,0.57,0.06],"m":"plastic","r":0.012,"rot":[0,0,0],"g":"armL","n":null},{"t":"box","s":[0.08,0.04,0.3],"p":[-0.27,0.69,0.04],"m":"plastic","r":0.02,"rot":[0,0,0],"g":"armL","n":null},{"t":"box","s":[0.03,0.04,0.2],"p":[-0.265,0.5,0.14],"m":"plastic","r":0.01,"rot":[0,0,0],"g":"armL","n":null},{"t":"box","s":[0.04,0.22,0.045],"p":[0.27,0.57,0.06],"m":"plastic","r":0.012,"rot":[0,0,0],"g":"armR","n":null},{"t":"box","s":[0.08,0.04,0.3],"p":[0.27,0.69,0.04],"m":"plastic","r":0.02,"rot":[0,0,0],"g":"armR","n":null},{"t":"box","s":[0.03,0.04,0.2],"p":[0.265,0.5,0.14],"m":"plastic","r":0.01,"rot":[0,0,0],"g":"armR","n":null}],"wheels":[[0.09270509831248422,0.04,0.30531695488854604,0.04,0.03],[0.3,0.04,0.02,0.04,0.03],[0.09270509831248425,0.04,-0.265316954888546,0.04,0.03],[-0.24270509831248419,0.04,-0.15633557568774198,0.04,0.03],[-0.24270509831248427,0.04,0.19633557568774185,0.04,0.03]],"fabric":2303531,"accent":2977759},"sofa":{"prims":[{"t":"box","s":[1.5,0.16,0.84],"p":[0,0.24,0],"m":"fabric2","r":0.03,"rot":[0,0,0],"g":"frame","n":null},{"t":"box","s":[1.5,0.62,0.14],"p":[0,0.64,0.35],"m":"fabric2","r":0.05,"rot":[0,0,0],"g":"frame","n":null},{"t":"box","s":[1.46,0.035,0.8],"p":[0,0.152,0],"m":"wood","r":0.01,"rot":[0,0,0],"g":"trim","n":null},{"t":"box","s":[1.4,0.04,0.04],"p":[0,0.275,-0.4],"m":"accent","r":0.015,"rot":[0,0,0],"g":"piping","n":null},{"t":"box","s":[0.14,0.36,0.84],"p":[-0.73,0.45,0],"m":"fabric","r":0.04,"rot":[0,0,0],"g":"armL","n":null},{"t":"cyl","rt":0.085,"rb":0.085,"h":0.84,"ax":"z","p":[-0.735,0.65,0],"m":"fabric","g":"armL","n":null,"rot":[0,0,0]},{"t":"box","s":[0.12,0.06,0.04],"p":[-0.735,0.3,-0.43],"m":"accent","r":0.01,"rot":[0,0,0],"g":"armL","n":null},{"t":"box","s":[0.14,0.36,0.84],"p":[0.73,0.45,0],"m":"fabric","r":0.04,"rot":[0,0,0],"g":"armR","n":null},{"t":"cyl","rt":0.085,"rb":0.085,"h":0.84,"ax":"z","p":[0.735,0.65,0],"m":"fabric","g":"armR","n":null,"rot":[0,0,0]},{"t":"box","s":[0.12,0.06,0.04],"p":[0.735,0.3,-0.43],"m":"accent","r":0.01,"rot":[0,0,0],"g":"armR","n":null},{"t":"box","s":[0.7,0.14,0.68],"p":[-0.365,0.42,-0.04],"m":"fabric","r":0.06,"rot":[0,0,0],"g":null,"n":"seatL"},{"t":"box","s":[0.68,0.44,0.16],"p":[-0.365,0.74,0.25],"m":"fabric","r":0.07,"rot":[0.14,0,0],"g":null,"n":"backL"},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[-0.565,0.86,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[-0.365,0.86,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[-0.16499999999999998,0.86,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[-0.46499999999999997,0.68,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[-0.265,0.68,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"box","s":[0.7,0.14,0.68],"p":[0.365,0.42,-0.04],"m":"fabric","r":0.06,"rot":[0,0,0],"g":null,"n":"seatR"},{"t":"box","s":[0.68,0.44,0.16],"p":[0.365,0.74,0.25],"m":"fabric","r":0.07,"rot":[0.14,0,0],"g":null,"n":"backR"},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[0.16499999999999998,0.86,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[0.365,0.86,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[0.565,0.86,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[0.265,0.68,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"sph","r":0.02,"sc":[1,1,0.6],"p":[0.46499999999999997,0.68,0.162],"m":"fabric2","g":"buttons","n":null,"rot":[0,0,0]},{"t":"box","s":[0.32,0.32,0.1],"p":[-0.5,0.64,0.08],"m":"accent","r":0.05,"rot":[0.35,0.2,0.35],"g":null,"n":"pillowL"},{"t":"box","s":[0.3,0.3,0.1],"p":[0.52,0.62,0.1],"m":"accent","r":0.05,"rot":[0.3,-0.25,-0.3],"g":null,"n":"pillowR"},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.09,"ax":"y","p":[-0.65,0.09,-0.34],"m":"chrome","g":"stem","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.09,"ax":"y","p":[-0.65,0.09,0.34],"m":"chrome","g":"stem","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.09,"ax":"y","p":[0.65,0.09,-0.34],"m":"chrome","g":"stem","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.09,"ax":"y","p":[0.65,0.09,0.34],"m":"chrome","g":"stem","n":null,"rot":[0,0,0]}],"wheels":[[-0.65,0.045,-0.34,0.045,0.03],[-0.65,0.045,0.34,0.045,0.03],[0.65,0.045,-0.34,0.045,0.03],[0.65,0.045,0.34,0.045,0.03]],"fabric":2781043,"accent":16777215},"toilet":{"prims":[{"t":"box","s":[0.6,0.04,0.84],"p":[0,0.075,0.02],"m":"wood","r":0.015,"rot":[0,0,0],"g":"plat","n":null},{"t":"box","s":[0.62,0.025,0.86],"p":[0,0.055,0.02],"m":"steel","r":0.008,"rot":[0,0,0],"g":"plat","n":null},{"t":"cyl","rt":0.13,"rb":0.17,"h":0.2,"ax":"y","p":[0,0.19,-0.05],"m":"ceramic","g":null,"n":"pedestal","rot":[0,0,0]},{"t":"sph","r":1,"sc":[0.2,0.17,0.3],"p":[0,0.28,-0.07],"m":"ceramic","g":null,"n":"bowl","rot":[0,0,0]},{"t":"tor","R":0.19,"tube":0.042,"sc":[0.95,1,1.45],"p":[0,0.45,-0.07],"m":"ceramic","g":"rim","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.14,"rb":0.14,"h":0.012,"ax":"y","p":[0,0.452,-0.07],"m":"black","g":"water","n":null,"rot":[0,0,0]},{"t":"tor","R":0.19,"tube":0.03,"sc":[1.0,1,1.5],"p":[0,0.49,-0.07],"m":"wood","g":null,"n":"seat","rot":[0,0,0]},{"t":"box","s":[0.44,0.36,0.2],"p":[0,0.67,0.34],"m":"ceramic","r":0.04,"rot":[0,0,0],"g":null,"n":"tank"},{"t":"box","s":[0.47,0.035,0.23],"p":[0,0.865,0.34],"m":"ceramic","r":0.02,"rot":[0,0,0],"g":null,"n":"tanklid"},{"t":"cyl","rt":0.03,"rb":0.03,"h":0.2,"ax":"y","p":[0,0.5,0.3],"m":"ceramic","g":"rim","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.07,"ax":"x","p":[0.17,0.8,0.23],"m":"chrome","g":"handle","n":null,"rot":[0,0,0]},{"t":"sph","r":0.022,"sc":[1,1,1],"p":[0.215,0.8,0.23],"m":"chrome","g":"handle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.055,"rb":0.055,"h":0.11,"ax":"x","p":[0.285,0.62,0.22],"m":"ceramic","g":null,"n":"roll","rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.14,"ax":"x","p":[0.285,0.62,0.22],"m":"chrome","g":"handle","n":null,"rot":[0,0,0]},{"t":"box","s":[0.08,0.03,0.03],"p":[0.2,0.62,0.22],"m":"chrome","r":0.008,"rot":[0,0,0],"g":"handle","n":null},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.06,"ax":"y","p":[-0.26,0.075,-0.3],"m":"chrome","g":"stem","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.06,"ax":"y","p":[0.26,0.075,-0.3],"m":"chrome","g":"stem","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.06,"ax":"y","p":[-0.26,0.075,0.34],"m":"chrome","g":"stem","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.06,"ax":"y","p":[0.26,0.075,0.34],"m":"chrome","g":"stem","n":null,"rot":[0,0,0]}],"wheels":[[-0.26,0.045,-0.3,0.045,0.035],[0.26,0.045,-0.3,0.045,0.035],[-0.26,0.045,0.34,0.045,0.035],[0.26,0.045,0.34,0.045,0.035]],"fabric":14540253,"accent":2795775},"barrow":{"prims":[{"t":"box","s":[0.4,0.03,0.74],"p":[0,0.425,-0.02],"m":"accent","r":0.012,"rot":[0.1,0,0],"g":"tray","n":null},{"t":"box","s":[0.5,0.3,0.03],"p":[0,0.56,-0.46],"m":"accent","r":0.012,"rot":[-0.5,0,0],"g":"tray","n":null},{"t":"box","s":[0.6,0.2,0.03],"p":[0,0.53,0.4],"m":"accent","r":0.012,"rot":[0.25,0,0],"g":"tray","n":null},{"t":"box","s":[0.02,0.012,0.62],"p":[-0.07,0.445,-0.02],"m":"accent","r":0.006,"rot":[0.1,0,0],"g":"tray","n":null},{"t":"box","s":[0.02,0.012,0.62],"p":[0.07,0.445,-0.02],"m":"accent","r":0.006,"rot":[0.1,0,0],"g":"tray","n":null},{"t":"box","s":[0.03,0.28,0.88],"p":[-0.26,0.55,-0.02],"m":"accent","r":0.012,"rot":[0,-0.08,0.42],"g":"tray","n":null},{"t":"box","s":[0.012,0.016,0.7],"p":[-0.26467,0.5,-0.02],"m":"accent","r":0.006,"rot":[0,-0.08,0.42],"g":"tray","n":null},{"t":"box","s":[0.012,0.016,0.7],"p":[-0.30933,0.6,-0.02],"m":"accent","r":0.006,"rot":[0,-0.08,0.42],"g":"tray","n":null},{"t":"cyl","rt":0.013,"rb":0.013,"h":0.92,"ax":"z","p":[-0.328,0.686,-0.02],"m":"steel","g":"rim","n":null,"rot":[0,-0.08,0]},{"t":"sph","r":0.018,"sc":[1,1,1],"p":[-0.328,0.69,-0.5],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"sph","r":0.018,"sc":[1,1,1],"p":[-0.318,0.635,0.44],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"box","s":[0.03,0.28,0.88],"p":[0.26,0.55,-0.02],"m":"accent","r":0.012,"rot":[0,0.08,-0.42],"g":"tray","n":null},{"t":"box","s":[0.012,0.016,0.7],"p":[0.26467,0.5,-0.02],"m":"accent","r":0.006,"rot":[0,0.08,-0.42],"g":"tray","n":null},{"t":"box","s":[0.012,0.016,0.7],"p":[0.30933,0.6,-0.02],"m":"accent","r":0.006,"rot":[0,0.08,-0.42],"g":"tray","n":null},{"t":"cyl","rt":0.013,"rb":0.013,"h":0.92,"ax":"z","p":[0.328,0.686,-0.02],"m":"steel","g":"rim","n":null,"rot":[0,0.08,0]},{"t":"sph","r":0.018,"sc":[1,1,1],"p":[0.328,0.69,-0.5],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"sph","r":0.018,"sc":[1,1,1],"p":[0.318,0.635,0.44],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.013,"rb":0.013,"h":0.66,"ax":"x","p":[0,0.69,-0.535],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.013,"rb":0.013,"h":0.66,"ax":"x","p":[0,0.632,0.435],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.015,"rb":0.015,"h":1.62,"ax":"z","p":[-0.2,0.405,0.18],"m":"steel","g":"frame","n":null,"rot":[-0.07,0,0]},{"t":"box","s":[0.06,0.02,0.14],"p":[-0.2,0.415,0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"frame","n":null},{"t":"box","s":[0.06,0.02,0.14],"p":[-0.2,0.415,-0.25],"m":"steel","r":0.006,"rot":[0,0,0],"g":"frame","n":null},{"t":"cyl","rt":0.016,"rb":0.016,"h":0.42,"ax":"y","p":[-0.22,0.2,0.52],"m":"steel","g":"frame","n":null,"rot":[0.12,0,-0.06]},{"t":"box","s":[0.1,0.022,0.2],"p":[-0.225,0.012,0.56],"m":"steel","r":0.008,"rot":[0,0,0],"g":"frame","n":null},{"t":"box","s":[0.1,0.012,0.2],"p":[-0.225,0.003,0.56],"m":"rubber","r":0.005,"rot":[0,0,0],"g":"frame","n":null},{"t":"cyl","rt":0.026,"rb":0.02,"h":0.62,"ax":"z","p":[-0.2,0.445,0.82],"m":"wood","g":"handleL","n":null,"rot":[-0.07,0,0]},{"t":"cyl","rt":0.03,"rb":0.03,"h":0.18,"ax":"z","p":[-0.2,0.458,1.07],"m":"rubber","g":"handleL","n":null,"rot":[-0.07,0,0]},{"t":"sph","r":0.03,"sc":[1,1,0.5],"p":[-0.2,0.463,1.165],"m":"rubber","g":"handleL","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.029,"rb":0.029,"h":0.022,"ax":"z","p":[-0.2,0.452,0.975],"m":"steel","g":"handleL","n":null,"rot":[-0.07,0,0]},{"t":"cyl","rt":0.013,"rb":0.013,"h":0.38,"ax":"y","p":[-0.085,0.345,-0.58],"m":"steel","g":"fork","n":null,"rot":[0.18,0,0]},{"t":"cyl","rt":0.018,"rb":0.018,"h":0.022,"ax":"x","p":[-0.115,0.19,-0.58],"m":"chrome","g":"axle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.015,"rb":0.015,"h":1.62,"ax":"z","p":[0.2,0.405,0.18],"m":"steel","g":"frame","n":null,"rot":[-0.07,0,0]},{"t":"box","s":[0.06,0.02,0.14],"p":[0.2,0.415,0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"frame","n":null},{"t":"box","s":[0.06,0.02,0.14],"p":[0.2,0.415,-0.25],"m":"steel","r":0.006,"rot":[0,0,0],"g":"frame","n":null},{"t":"cyl","rt":0.016,"rb":0.016,"h":0.42,"ax":"y","p":[0.22,0.2,0.52],"m":"steel","g":"frame","n":null,"rot":[0.12,0,0.06]},{"t":"box","s":[0.1,0.022,0.2],"p":[0.225,0.012,0.56],"m":"steel","r":0.008,"rot":[0,0,0],"g":"frame","n":null},{"t":"box","s":[0.1,0.012,0.2],"p":[0.225,0.003,0.56],"m":"rubber","r":0.005,"rot":[0,0,0],"g":"frame","n":null},{"t":"cyl","rt":0.026,"rb":0.02,"h":0.62,"ax":"z","p":[0.2,0.445,0.82],"m":"wood","g":"handleR","n":null,"rot":[-0.07,0,0]},{"t":"cyl","rt":0.03,"rb":0.03,"h":0.18,"ax":"z","p":[0.2,0.458,1.07],"m":"rubber","g":"handleR","n":null,"rot":[-0.07,0,0]},{"t":"sph","r":0.03,"sc":[1,1,0.5],"p":[0.2,0.463,1.165],"m":"rubber","g":"handleR","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.029,"rb":0.029,"h":0.022,"ax":"z","p":[0.2,0.452,0.975],"m":"steel","g":"handleR","n":null,"rot":[-0.07,0,0]},{"t":"cyl","rt":0.013,"rb":0.013,"h":0.38,"ax":"y","p":[0.085,0.345,-0.58],"m":"steel","g":"fork","n":null,"rot":[0.18,0,0]},{"t":"cyl","rt":0.018,"rb":0.018,"h":0.022,"ax":"x","p":[0.115,0.19,-0.58],"m":"chrome","g":"axle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.46,"ax":"x","p":[0,0.4,0.3],"m":"steel","g":"frame","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.46,"ax":"x","p":[0,0.4,-0.25],"m":"steel","g":"frame","n":null,"rot":[0,0,0]},{"t":"box","s":[0.22,0.03,0.06],"p":[0,0.5,-0.52],"m":"steel","r":0.01,"rot":[0,0,0],"g":"fork","n":null},{"t":"cyl","rt":0.01,"rb":0.01,"h":0.23,"ax":"x","p":[0,0.19,-0.58],"m":"chrome","g":"axle","n":null,"rot":[0,0,0]}],"wheels":[[0,0.19,-0.58,0.19,0.08]],"fabric":8947848,"accent":3116878,"tyre":true},"trike":{"prims":[{"t":"cyl","rt":0.03,"rb":0.03,"h":0.92,"ax":"z","p":[0,0.55,-0.17],"m":"accent","g":"frame","n":null,"rot":[0.38,0,0]},{"t":"cyl","rt":0.036,"rb":0.036,"h":0.24,"ax":"y","p":[0,0.72,-0.6],"m":"steel","g":"steer","n":null,"rot":[0.25,0,0]},{"t":"cyl","rt":0.026,"rb":0.026,"h":0.4,"ax":"y","p":[0,0.47,-0.43],"m":"accent","g":"frame","n":null,"rot":[0.0,0,0]},{"t":"cyl","rt":0.034,"rb":0.034,"h":0.14,"ax":"x","p":[0,0.3,-0.42],"m":"steel","g":"frame","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.02,"rb":0.02,"h":0.3,"ax":"y","p":[0,0.5,0.1],"m":"accent","g":"frame","n":null,"rot":[0.0,0,0]},{"t":"box","s":[0.7,0.03,0.22],"p":[0,0.32,0.34],"m":"accent","r":0.01,"rot":[0,0,0],"g":"frame","n":null},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.8,"ax":"x","p":[0,0.2,0.36],"m":"steel","g":"axle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.14,"ax":"y","p":[-0.3,0.27,0.35],"m":"steel","g":"axle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.14,"ax":"y","p":[0.3,0.27,0.35],"m":"steel","g":"axle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.2,"ax":"x","p":[0,0.27,-0.64],"m":"chrome","g":"axle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.02,"rb":0.02,"h":0.4,"ax":"y","p":[0.0,0.88,-0.55],"m":"steel","g":"steer","n":null,"rot":[0.25,0,0]},{"t":"cyl","rt":0.015,"rb":0.015,"h":0.62,"ax":"x","p":[0,1.04,-0.5],"m":"steel","g":"steer","n":null,"rot":[0,0,0]},{"t":"sph","r":0.03,"sc":[1,1,1],"p":[0.12,1.07,-0.5],"m":"chrome","g":"steer","n":null,"rot":[0,0,0]},{"t":"box","s":[0.22,0.06,0.3],"p":[0,0.66,0.12],"m":"fabric","r":0.03,"rot":[-0.1,0,0],"g":null,"n":"saddle"},{"t":"cyl","rt":0.016,"rb":0.016,"h":0.16,"ax":"y","p":[0,0.58,0.13],"m":"steel","g":"frame","n":null,"rot":[0,0,0]},{"t":"box","s":[0.1,0.02,0.34],"p":[-0.16,0.35,0.5],"m":"steel","r":0.006,"rot":[0,0,0],"g":"step","n":null},{"t":"box","s":[0.1,0.02,0.34],"p":[0.16,0.35,0.5],"m":"steel","r":0.006,"rot":[0,0,0],"g":"step","n":null},{"t":"cyl","rt":0.018,"rb":0.018,"h":0.5,"ax":"y","p":[-0.08,0.45,-0.63],"m":"steel","g":"forkL","n":null,"rot":[0.15,0,0]},{"t":"cyl","rt":0.026,"rb":0.026,"h":0.13,"ax":"x","p":[-0.31,1.04,-0.5],"m":"rubber","g":"gripL","n":null,"rot":[0,0,0]},{"t":"box","s":[0.012,0.34,0.004],"p":[-0.34,0.86,-0.5],"m":"ceramic","r":0.002,"rot":[0.0,0,-0.1],"g":"streamL","n":null},{"t":"cyl","rt":0.018,"rb":0.018,"h":0.5,"ax":"y","p":[0.08,0.45,-0.63],"m":"steel","g":"forkR","n":null,"rot":[0.15,0,0]},{"t":"cyl","rt":0.026,"rb":0.026,"h":0.13,"ax":"x","p":[0.31,1.04,-0.5],"m":"rubber","g":"gripR","n":null,"rot":[0,0,0]},{"t":"box","s":[0.012,0.34,0.004],"p":[0.34,0.86,-0.5],"m":"ceramic","r":0.002,"rot":[0.0,0,0.1],"g":"streamR","n":null}],"wheels":[[0,0.27,-0.64,0.27,0.06],[-0.36,0.2,0.36,0.2,0.055],[0.36,0.2,0.36,0.2,0.055]],"fabric":1710621,"accent":14036783,"tyre":true},"bin":{"prims":[{"t":"box","s":[1.12,0.04,0.72],"p":[0,0.26,0],"m":"accent","r":0.01,"rot":[0,0,0],"g":null,"n":"floor"},{"t":"box","s":[1.18,0.05,0.76],"p":[0,0.21,0],"m":"steel","r":0.01,"rot":[0,0,0],"g":"frame","n":null},{"t":"box","s":[0.04,0.62,0.8],"p":[-0.59,0.58,0],"m":"accent","r":0.01,"rot":[0,0,0.05],"g":"wallL","n":null},{"t":"box","s":[0.025,0.03,0.74],"p":[-0.6085,0.45,0],"m":"accent","r":0.008,"rot":[0,0,0.05],"g":"wallL","n":null},{"t":"box","s":[0.025,0.03,0.74],"p":[-0.617,0.62,0],"m":"accent","r":0.008,"rot":[0,0,0.05],"g":"wallL","n":null},{"t":"box","s":[0.025,0.03,0.74],"p":[-0.625,0.78,0],"m":"accent","r":0.008,"rot":[0,0,0.05],"g":"wallL","n":null},{"t":"box","s":[0.1,0.1,0.34],"p":[-0.62,0.62,0],"m":"steel","r":0.01,"rot":[0,0,0],"g":"pocketL","n":null},{"t":"box","s":[0.04,0.62,0.8],"p":[0.59,0.58,0],"m":"accent","r":0.01,"rot":[0,0,-0.05],"g":"wallR","n":null},{"t":"box","s":[0.025,0.03,0.74],"p":[0.6085,0.45,0],"m":"accent","r":0.008,"rot":[0,0,-0.05],"g":"wallR","n":null},{"t":"box","s":[0.025,0.03,0.74],"p":[0.617,0.62,0],"m":"accent","r":0.008,"rot":[0,0,-0.05],"g":"wallR","n":null},{"t":"box","s":[0.025,0.03,0.74],"p":[0.625,0.78,0],"m":"accent","r":0.008,"rot":[0,0,-0.05],"g":"wallR","n":null},{"t":"box","s":[0.1,0.1,0.34],"p":[0.62,0.62,0],"m":"steel","r":0.01,"rot":[0,0,0],"g":"pocketR","n":null},{"t":"box","s":[1.2,0.62,0.04],"p":[0,0.58,-0.4],"m":"accent","r":0.01,"rot":[-0.05,0,0],"g":"wallF","n":null},{"t":"box","s":[1.14,0.03,0.025],"p":[0,0.45,-0.4185],"m":"accent","r":0.008,"rot":[-0.05,0,0],"g":"wallF","n":null},{"t":"box","s":[1.14,0.03,0.025],"p":[0,0.62,-0.427],"m":"accent","r":0.008,"rot":[-0.05,0,0],"g":"wallF","n":null},{"t":"box","s":[1.14,0.03,0.025],"p":[0,0.78,-0.435],"m":"accent","r":0.008,"rot":[-0.05,0,0],"g":"wallF","n":null},{"t":"box","s":[0.5,0.11,0.012],"p":[0,0.535,-0.431],"m":"ceramic","r":0.004,"rot":[-0.05,0,0],"g":"wallF","n":null},{"t":"box","s":[1.2,0.62,0.04],"p":[0,0.58,0.4],"m":"accent","r":0.01,"rot":[0.05,0,0],"g":"wallB","n":null},{"t":"box","s":[1.14,0.03,0.025],"p":[0,0.45,0.4185],"m":"accent","r":0.008,"rot":[0.05,0,0],"g":"wallB","n":null},{"t":"box","s":[1.14,0.03,0.025],"p":[0,0.62,0.427],"m":"accent","r":0.008,"rot":[0.05,0,0],"g":"wallB","n":null},{"t":"box","s":[1.14,0.03,0.025],"p":[0,0.78,0.435],"m":"accent","r":0.008,"rot":[0.05,0,0],"g":"wallB","n":null},{"t":"box","s":[0.5,0.11,0.012],"p":[0,0.535,0.431],"m":"ceramic","r":0.004,"rot":[0.05,0,0],"g":"wallB","n":null},{"t":"cyl","rt":0.022,"rb":0.022,"h":1.3,"ax":"x","p":[0,0.9,-0.43],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.022,"rb":0.022,"h":1.3,"ax":"x","p":[0,0.9,0.43],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.022,"rb":0.022,"h":0.9,"ax":"z","p":[-0.625,0.9,0],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.022,"rb":0.022,"h":0.9,"ax":"z","p":[0.625,0.9,0],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"sph","r":0.03,"sc":[1,1,1],"p":[-0.625,0.9,-0.43],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"sph","r":0.03,"sc":[1,1,1],"p":[-0.625,0.9,0.43],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"sph","r":0.03,"sc":[1,1,1],"p":[0.625,0.9,-0.43],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"sph","r":0.03,"sc":[1,1,1],"p":[0.625,0.9,0.43],"m":"steel","g":"rim","n":null,"rot":[0,0,0]},{"t":"box","s":[1.2,0.04,0.76],"p":[0,1.27,0.5],"m":"steel","r":0.02,"rot":[1.83,0,0],"g":null,"n":"lid"},{"t":"box","s":[1.2,0.05,0.05],"p":[0,0.91,0.43],"m":"steel","r":0.01,"rot":[0,0,0],"g":"hinge","n":null},{"t":"cyl","rt":0.016,"rb":0.016,"h":0.9,"ax":"x","p":[0,0.8,-0.47],"m":"steel","g":"handle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.12,"ax":"z","p":[-0.4,0.8,-0.45],"m":"steel","g":"handle","n":null,"rot":[0,0,0]},{"t":"cyl","rt":0.012,"rb":0.012,"h":0.12,"ax":"z","p":[0.4,0.8,-0.45],"m":"steel","g":"handle","n":null,"rot":[0,0,0]},{"t":"box","s":[0.02,0.11,0.06],"p":[-0.5,0.13,-0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.04,"ax":"y","p":[-0.5,0.185,-0.3],"m":"steel","g":"casters","n":null,"rot":[0,0,0]},{"t":"box","s":[0.07,0.02,0.07],"p":[-0.5,0.19,-0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"casters","n":null},{"t":"box","s":[0.02,0.11,0.06],"p":[0.5,0.13,-0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.04,"ax":"y","p":[0.5,0.185,-0.3],"m":"steel","g":"casters","n":null,"rot":[0,0,0]},{"t":"box","s":[0.07,0.02,0.07],"p":[0.5,0.19,-0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"casters","n":null},{"t":"box","s":[0.02,0.11,0.06],"p":[-0.5,0.13,0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.04,"ax":"y","p":[-0.5,0.185,0.3],"m":"steel","g":"casters","n":null,"rot":[0,0,0]},{"t":"box","s":[0.07,0.02,0.07],"p":[-0.5,0.19,0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"casters","n":null},{"t":"box","s":[0.02,0.11,0.06],"p":[0.5,0.13,0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"casters","n":null},{"t":"cyl","rt":0.014,"rb":0.014,"h":0.04,"ax":"y","p":[0.5,0.185,0.3],"m":"steel","g":"casters","n":null,"rot":[0,0,0]},{"t":"box","s":[0.07,0.02,0.07],"p":[0.5,0.19,0.3],"m":"steel","r":0.006,"rot":[0,0,0],"g":"casters","n":null}],"wheels":[[-0.5,0.075,-0.3,0.075,0.05],[0.5,0.075,-0.3,0.075,0.05],[-0.5,0.075,0.3,0.075,0.05],[0.5,0.075,0.3,0.075,0.05]],"fabric":8947848,"accent":3042106}};
let FABRIC_TEX = null;
function fabricTex() { if (!FABRIC_TEX) { FABRIC_TEX = tex(128, 128, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.12 + Math.random() * 0.2) + ')'; g.fillRect(x, y, 2, 2); } }); FABRIC_TEX.wrapS = FABRIC_TEX.wrapT = THREE.RepeatWrapping; FABRIC_TEX.repeat.set(3, 3); } return FABRIC_TEX; }
function makeSpecMesh(spec, wheelsOut) { // origin on the floor, front faces -z; every part flies off separately when the vehicle breaks
  const S = CART_S, root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(S); root.add(g);
  const fab = new THREE.Color(spec.fabric), MAT = { fabric: new THREE.MeshStandardMaterial({ color: fab, roughness: 0.95, bumpMap: fabricTex(), bumpScale: 0.8 }), fabric2: new THREE.MeshStandardMaterial({ color: fab.clone().multiplyScalar(0.7), roughness: 0.95, bumpMap: fabricTex(), bumpScale: 0.8 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.45, metalness: 0.1 }), chrome: new THREE.MeshStandardMaterial({ color: 0xeef1f5, metalness: 1, roughness: 0.12 }), accent: new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.6 }), black: new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.4 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.12, metalness: 0.02 }), wood: new THREE.MeshStandardMaterial({ color: 0x7a4f2a, roughness: 0.75 }), steel: new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.4, metalness: 0.85 }), rubber: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.92 }) };
  try { const env = labEnv(); MAT.chrome.envMap = env; MAT.chrome.envMapIntensity = 1.2; MAT.ceramic.envMap = env; MAT.ceramic.envMapIntensity = 0.6; MAT.steel.envMap = env; MAT.steel.envMapIntensity = 0.8; } catch (e) { /* no reflections, still fine */ }
  const flat = ge => (ge.index ? ge.toNonIndexed() : ge), extras = [], groups = {};
  const extra = (geo, mat, name, mk) => { geo.scale(1 / S, 1 / S, 1 / S); geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(new V3()); geo.translate(-c.x, -c.y, -c.z); const m = new THREE.Mesh(geo, mat); m.position.copy(c); m.castShadow = true; m.receiveShadow = true; m.name = name; m.userData.mk = mk; g.add(m); extras.push(m); };
  for (const p of spec.prims) {
    let ge; if (p.t === 'box') ge = new RoundedBoxGeometry(p.s[0], p.s[1], p.s[2], 3, p.r); else if (p.t === 'cyl') { ge = new THREE.CylinderGeometry(p.rt, p.rb, p.h, 18); if (p.ax === 'x') ge.rotateZ(Math.PI / 2); else if (p.ax === 'z') ge.rotateX(Math.PI / 2); } else if (p.t === 'tor') { ge = new THREE.TorusGeometry(p.R, p.tube, 10, 28); ge.rotateX(Math.PI / 2); ge.scale(p.sc[0], p.sc[1], p.sc[2]); } else { ge = new THREE.SphereGeometry(p.r, 16, 12); ge.scale(p.sc[0], p.sc[1], p.sc[2]); }
    if (p.rot && (p.rot[0] || p.rot[1] || p.rot[2])) ge.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.rot[0], p.rot[1], p.rot[2], 'XYZ'))); ge.translate(p.p[0], p.p[1], p.p[2]);
    if (p.g) (groups[p.g + '|' + p.m] = groups[p.g + '|' + p.m] || []).push(ge); else extra(ge, MAT[p.m], p.n || 'part', p.m);
  }
  for (const key in groups) extra(mergeGeometries(groups[key].map(flat)), MAT[key.split('|')[1]], 'x:' + key.split('|')[0], key.split('|')[1]);
  for (const [x, y, z, r, wd] of spec.wheels) { const w = new THREE.Group(); w.position.set(x / S, y / S, z / S);
    if (spec.tyre) { // a pneumatic tyre with tread blocks, a steel rim, eight spokes and a hub; the axle runs along x
      const add = (geo, mat) => { geo.scale(1 / S, 1 / S, 1 / S); const me = new THREE.Mesh(geo, mat); me.castShadow = true; w.add(me); }, tr = new THREE.TorusGeometry(r - wd * 0.42, wd * 0.46, 12, 32); tr.rotateY(Math.PI / 2); add(tr, MAT.rubber);
      const lug = [], spk = []; for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, bx = new THREE.BoxGeometry(wd * 0.7, 0.014, 0.05); bx.rotateX(a); bx.translate(0, (r + 0.005) * Math.cos(a), (r + 0.005) * Math.sin(a)); lug.push(flat(bx)); } add(mergeGeometries(lug), MAT.black);
      const rim = new THREE.CylinderGeometry(r * 0.6, r * 0.6, wd * 0.8, 24); rim.rotateZ(Math.PI / 2); add(rim, MAT.steel);
      for (let i = 0; i < 8; i++) { const sp = new THREE.BoxGeometry(wd * 0.14, r * 0.5, 0.008); sp.translate(0, r * 0.3, 0); sp.rotateX(i * Math.PI / 4); spk.push(flat(sp)); } add(mergeGeometries(spk), MAT.chrome);
      const hb = new THREE.CylinderGeometry(r * 0.22, r * 0.22, wd * 1.1, 16); hb.rotateZ(Math.PI / 2); add(hb, MAT.chrome);
    } else { const wm = new THREE.Mesh(new THREE.CylinderGeometry(r / S, r / S, wd / S, 18), MAT.black); wm.rotation.z = Math.PI / 2; wm.castShadow = true; w.add(wm); const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45 / S, r * 0.45 / S, (wd + 0.006) / S, 12), MAT.chrome); hub.rotation.z = Math.PI / 2; w.add(hub); }
    w.userData.mk = 'wheel'; g.add(w); extras.push(w); if (wheelsOut) wheelsOut.push(w); }
  root.userData.pieces = []; root.userData.extras = extras; root.userData.g = g; root.userData.bigPieces = true;
  return root;
}
// kind -> name, the word for 'stayed in the ...', the box of its seat (the physics), where he sits and where his hands rest, the height of its floor above the ground
const VEH_ORDER = ['cart', 'tub', 'chair', 'sofa', 'toilet', 'barrow', 'trike', 'bin'];
var PEDAL = { use: false, phase: 0, t: 0, cx: 0, cy: 0.3, cz: -0.42, r: 0.1, px: 0.17, crank: null, ped: [] };
function makeTrikeMesh(wheelsOut) { // the spec parts, plus a crank with two pedals that really turn (the right arm points down at phase 0, the left one up; the pedals stay level)
  const root = makeSpecMesh(VEH_SPECS.trike, wheelsOut), S = CART_S, g = root.userData.g, C = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0x9aa1a9, metalness: 0.85, roughness: 0.35 }), rub = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }), chr = new THREE.MeshStandardMaterial({ color: 0xeef1f5, metalness: 1, roughness: 0.12 });
  C.position.set(PEDAL.cx / S, PEDAL.cy / S, PEDAL.cz / S); C.userData.mk = 'metal';
  const add = (geo, mat, x, y, z, parent) => { geo.scale(1 / S, 1 / S, 1 / S); const m = new THREE.Mesh(geo, mat); m.position.set(x / S, y / S, z / S); m.castShadow = true; (parent || C).add(m); return m; };
  const ax = new THREE.CylinderGeometry(0.016, 0.016, 0.3, 12); ax.rotateZ(Math.PI / 2); add(ax, steel, 0, 0, 0); PEDAL.ped = [];
  for (const sd of [1, -1]) { add(new THREE.BoxGeometry(0.026, PEDAL.r + 0.03, 0.03), steel, sd * 0.13, -sd * PEDAL.r / 2, 0);
    const pg = new THREE.Group(); pg.position.set(sd * PEDAL.px / S, -sd * PEDAL.r / S, 0); C.add(pg); PEDAL.ped.push(pg);
    add(new THREE.BoxGeometry(0.1, 0.024, 0.08), rub, 0, 0, 0, pg); add(new THREE.BoxGeometry(0.1, 0.012, 0.012), chr, 0, 0.013, 0.038, pg); add(new THREE.BoxGeometry(0.1, 0.012, 0.012), chr, 0, 0.013, -0.038, pg);
    const pin = new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8); pin.rotateZ(Math.PI / 2); add(pin, chr, -sd * 0.07, 0, 0, pg); }
  g.add(C); root.userData.extras.push(C); PEDAL.crank = C; return root; }
function pedalStep(t) { // the crank turns with the speed (so many turns a second, never faster than the eye can follow)
  const dt = clamp(t - PEDAL.t, 0, 0.05); PEDAL.t = t; const on = state === 'ride' && LAB.phase === 'roll' && LABCART.v > 0.3; if (on) PEDAL.phase += clamp(LABCART.v * 1.2, 0, 22) * dt;
  const C = PEDAL.crank; if (C) { C.rotation.x = -PEDAL.phase; for (const p of PEDAL.ped) p.rotation.x = PEDAL.phase; } }

const VEH_DEFS = {
  cart: { name: 'SHOPPING CART', launch: { up: 0.22, min: 4.5, max: 7, om: -3, yaw: 0, keep: 1 }, fx: 'sparks', tipW: 1, rebound: 1, noun: 'cart' },
  tub: { name: 'BATHTUB', launch: { up: 0.3, min: 5.5, max: 9.5, om: -2.0, yaw: 0.3, keep: 0.85 }, fx: 'water', tipW: 0.55, rebound: 0.6, noun: 'tub', box: { hw: 0.34, y0: 0.3, y1: 0.84, zf: -0.7, zb: 0.7, zfOut: -0.9, zbOut: 0.9, H: 0.85 }, seat: [0.14, 0.22], rimY: 0.54, rimX: 0.36, floorY: 0.3, build: makeTubMesh },
  chair: { name: 'OFFICE CHAIR', launch: { up: 0.12, min: 2, max: 4.2, om: -4.6, yaw: 1.6, keep: 1.05 }, fx: 'sparks', tipW: 1.6, rebound: 1.4, noun: 'chair', box: { hw: 0.26, y0: 0.5, y1: 1.2, zf: -0.27, zb: 0.3, zfOut: -0.3, zbOut: 0.34, H: 1.2 }, seat: [0.6, 0.1], rimY: 0.675, rimX: 0.3, floorY: 0, open: true, build: w => makeSpecMesh(VEH_SPECS.chair, w) },
  toilet: { name: 'ROLLING TOILET', launch: { up: 0.1, min: 2.2, max: 4.2, om: -3.4, yaw: 0.9, keep: 0.95 }, fx: 'water', tipW: 1.3, rebound: 1.0, noun: 'toilet', box: { hw: 0.25, y0: 0.5, y1: 1.2, zf: -0.34, zb: 0.24, zfOut: -0.37, zbOut: 0.3, H: 1.2 }, seat: [0.52, 0.06], rimY: 0.62, rimX: 0.3, floorY: 0.09, open: true, build: w => makeSpecMesh(VEH_SPECS.toilet, w) },
  barrow: { name: 'WHEELBARROW', launch: { up: 0.14, min: 2.6, max: 5, om: -3.2, yaw: 0.6, keep: 0.9 }, fx: 'sparks', tipW: 1.1, rebound: 0.8, noun: 'barrow', box: { hw: 0.27, y0: 0.44, y1: 0.85, zf: -0.46, zb: 0.4, zfOut: -0.5, zbOut: 0.48, H: 0.95 }, seat: [0.16, 0.08], rimY: 0.68, rimX: 0.3, floorY: 0.44, open: true, build: w => makeSpecMesh(VEH_SPECS.barrow, w) },
  trike: { name: 'KIDDIE TRIKE', launch: { up: 0.14, min: 2.4, max: 4.6, om: -3.6, yaw: 1.0, keep: 1.0 }, fx: 'sparks', tipW: 1.7, rebound: 1.2, noun: 'trike', box: { hw: 0.24, y0: 0.5, y1: 1.2, zf: -0.62, zb: 0.32, zfOut: -0.92, zbOut: 0.55, H: 1.2 }, seat: [0.68, 0.1], rimY: 1.0, rimX: 0.3, rimZ: -0.5, floorY: 0, open: true, build: w => makeTrikeMesh(w) },
  bin: { name: 'WASTE CONTAINER', launch: { up: 0.1, min: 2, max: 3.6, om: -1.8, yaw: 0.4, keep: 0.8 }, fx: 'sparks', tipW: 0.6, rebound: 0.55, noun: 'container', box: { hw: 0.52, y0: 0.3, y1: 0.9, zf: -0.34, zb: 0.34, zfOut: -0.44, zbOut: 0.44, H: 0.95 }, seat: [0.18, 0.02], rimY: 0.84, rimX: 0.52, floorY: 0.28, open: false, build: w => makeSpecMesh(VEH_SPECS.bin, w) },
  sofa: { name: 'SOFA ON WHEELS', launch: { up: 0.08, min: 1.5, max: 3, om: -2.0, yaw: 0.6, keep: 0.72 }, fx: 'feathers', tipW: 0.45, rebound: 0.5, noun: 'sofa', box: { hw: 0.69, y0: 0.43, y1: 1.0, zf: -0.42, zb: 0.4, zfOut: -0.45, zbOut: 0.5, H: 1.05 }, seat: [0.53, 0.1], rimY: 0.72, rimX: 0.73, floorY: 0, open: true, build: w => makeSpecMesh(VEH_SPECS.sofa, w) },
};

let LAB_VEH = 'cart', CART_SPEC0 = null; const VEHS = {};
function labVehicle(kind) {
  if (VEH !== 'cart') return; // the lab hall is a cart level: every vehicle lives on the same board
  if (!VEHS.cart) { VEHS.cart = { root: CART_ROOT, wheels: wheels.slice() }; CART_SPEC0 = { hw: CART.box.hw, y0: CART.box.y0, y1: CART.box.y1, zf: CART.box.zf, zb: CART.box.zb, zfOut: CART.zfOut, zbOut: CART.zbOut, H: CART.H }; }
  if (!VEH_DEFS[kind]) kind = 'cart'; if (kind === LAB_VEH) return;
  const d = VEH_DEFS[kind]; if (!VEHS[kind]) { const w = [], root = d.build(w); board.add(root); VEHS[kind] = { root, wheels: w }; }
  LAB_VEH = kind; PEDAL.use = kind === 'trike'; for (const k in VEHS) VEHS[k].root.visible = k === kind; CART_ROOT = VEHS[kind].root;
  wheels.length = 0; wheels.push(...VEHS[kind].wheels); CART.tipW = d.tipW || 1; CART.rebound = d.rebound || 1; CART.setSpec(d.box || CART_SPEC0); CART.openFront = !!d.open; CART.box.frontOpen = !!d.open;
  const cart = kind === 'cart'; CART_SEAT.set(0, cart ? 0.17 : d.seat[0], cart ? 0.32 : d.seat[1]); CART_RIM_Y = cart ? (1.02 - 0.4) * CART_S : d.rimY; CART_RIM_X = cart ? (0.32 + 0.03) * CART_S : d.rimX; CART_RIM_Z = cart || d.rimZ === undefined ? -0.06 : d.rimZ;
  daggie.position.y = (cart ? 0.4 * CART_S : d.floorY) + 0.012; // he sits on the floor of whichever vehicle it is
  for (const dd of CDEB.list) scene.remove(dd.m); CDEB.list.length = 0; CDEB.built = false; CDEB.on = false; // pieces are rebuilt from the new vehicle
}

// ---------- obstacles for the crash hall: the steel post, or anything that can be hit (blocks that fly apart) ----------
const labBol = () => LAB.machine === 'bollard' || LAB.machine === 'tub' || LAB.machine === 'mix'; // all the crash-hall machines
const labVehKind = () => (LAB.machine === 'tub' ? 'tub' : LAB.machine === 'mix' ? MIX.veh : 'cart');
const MIX = { veh: 'cart', obs: 'post', loc: 'hall', txt: '67', el: null };
try { const sv = JSON.parse(localStorage.getItem('daggie-mix') || '{}'); if (VEH_DEFS[sv.veh]) MIX.veh = sv.veh; if (sv.obs) MIX.obs = sv.obs; if (typeof sv.loc === 'string') MIX.loc = sv.loc; if (typeof sv.txt === 'string') MIX.txt = sv.txt; } catch (e) { /* the first time */ }
// ---------- WORD WALL: any word or number as a wall of big coloured blocks (a new trend = a new text, in a few seconds) ----------
const WW_FONT = { A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'], C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'], E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'], G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'], J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'], K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'], M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'], O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'], Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'], S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'], W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'], Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'], 2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'], 4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'], 6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'], 8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'], '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'], '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'], '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'] };
const WW = { cs: 0.5 }, WW_PAL = [0xff3b30, 0x2f6bff, 0xffd60a, 0x34c759, 0xff7a00, 0xbf5af2];
function wordwallClean(txt) { return String(txt || '').toUpperCase().replace(/[^A-Z0-9!?+\-. ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 10) || '67'; }
function wordwallGrid(txt) { const t = wordwallClean(txt), cols = []; let gi = 0; for (const ch of t) { if (ch === ' ') { cols.push({ g: -1, bits: [0, 0, 0, 0, 0, 0, 0] }, { g: -1, bits: [0, 0, 0, 0, 0, 0, 0] }); continue; } const gl = WW_FONT[ch] || WW_FONT['?']; for (let c = 0; c < 5; c++) cols.push({ g: gi, bits: gl.map(r => r[c] === '#' ? 1 : 0) }); cols.push({ g: -1, bits: [0, 0, 0, 0, 0, 0, 0] }); gi++; } while (cols.length && cols[cols.length - 1].g === -1) cols.pop(); return cols; }
function wordwallLayout(txt) { const cols = wordwallGrid(txt), C = cols.length, cs = clamp(6.2 / C, 0.28, 0.55), b = []; WW.cs = cs;
  cols.forEach((col, ci) => col.bits.forEach((on, r) => { if (!on) return; const base = WW_PAL[col.g % WW_PAL.length], j = 0.94 + rand(0, 0.12), ch = sh => Math.min(255, ((base >> sh) & 255) * j) | 0, cc = (ch(16) << 16) | (ch(8) << 8) | ch(0);
    for (let layer = 0; layer < 2; layer++) b.push({ t: 'cube', x: (ci - (C - 1) / 2) * cs, y: cs * (0.5 + (6 - r)), z: -layer * cs, sx: cs * 0.97, sy: cs * 0.97, sz: cs * 0.97, ry: 0, col: cc }); }));
  return b; }
function wordwallSpec(txt) { /* the collision profile is as deep as the two layers of blocks and has no gaps between its cylinders (a thin wall of small blocks used to let a rider slip through); neighbours overlap a little, not a lot (a deep overlap makes the rider's joints fight each other) */ const cols = wordwallGrid(txt), C = cols.length, cs = clamp(6.2 / C, 0.28, 0.55), r = Math.max(cs * 0.9, 0.3), hw = Math.min(C * cs / 2, 1.8), n = Math.max(3, Math.ceil(hw * 2 / (r * 1.7)) + 1), sp = OBST.wordwall; sp.cyls = Array.from({ length: n }, (_, i) => ({ dx: -hw + i * (2 * hw / (n - 1)), r })); sp.h = 7 * cs; sp.r = r; WW.cs = cs; }
function wordwallRebuild() { wordwallSpec(MIX.txt); const o = OBX.built.wordwall; if (o) { for (const t in o.sets) { scene.remove(o.sets[t].mesh); try { o.sets[t].mesh.dispose(); } catch (e) { /* gone anyway */ } } delete OBX.built.wordwall; } }

const OBS_ORDER = ['post', 'truck', 'car', 'hatch', 'tires', 'barrels', 'bricks', 'barrier', 'wordwall'];
if (!OBS_ORDER.includes(MIX.obs)) MIX.obs = 'truck'; /* a saved choice that no longer exists */
// strengths in m/s: bend (it starts to give), knock (it is destroyed), tumble (the vehicle tips over); 15 mph = 6.7, 50 = 22, 100 = 45, 150 = 67, 200 = 89
const OBST = {
  post: { name: 'STEEL POST', r: BOLLARD_R, h: BOLLARD_H, bend: 10, knock: 30, tumble: 10, solid: false },
  truck: { absorb: 0, hard: 3.2, fx: 'sand', name: 'DUMP TRUCK (SAND)', r: 0.3, cyls: [-1.0, -0.5, 0, 0.5, 1.0].map(dx => ({ dx, r: 0.3 })).concat([{ dx: 0, dz: -1.0, r: 1.2, h: 3.05 }, { dx: 0, dz: -3.2, r: 1.25, h: 3.05 }, { dx: 0, dz: -5.4, r: 1.25, h: 3.05 }, { dx: 0, dz: -6.3, r: 1.0, h: 3.05 }]), h: 3.0, bend: 120, knock: 9999, tumble: 10, solid: true, kick: 0.05, lift: 0.1, sound: 'truck', pop: 'TRUCK HOLDS!', rider: { up: 0.15, om: 0.3, crash: 0.06 }, rock: { parts: ['truck', 'truckg'], slide: 0.008, tilt: 0.0009, tiltMax: 0.06, tau: 0.7, w: 7, py: 0, pz: -3.4 },
    glass: { key: 'truckg', yoff: 0, cart: [[0, 2.3, 0.25]] },
    dent: { parts: ['truck', 'truckg'], k: 0.016, min: 0.06, max: 1.5, cx: 0, cy: 0.95, sx: 0.6, sy: 0.85, z0: -2.0, z1: 0.3, shiftN: 9, mask: (x, y, z) => z > -2.4 && Math.abs(x) < 1.15 && !(Math.abs(x) > 0.88 && y < 1.2 && z < -0.05) },
    layout() { return [{ t: 'truck', x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, ry: 0, col: 0xffffff }, { t: 'truckg', x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, ry: 0, col: 0xffffff }]; } },
  car: { absorb: 2200, hard: 5, fx: 'dust', name: 'CAR (SIDEWAYS)', r: 0.9, cyls: [[-1.3, 0.95], [-0.65, 1.1], [0, 1.42], [0.65, 1.42], [1.3, 1.28]].map(([dx, h]) => ({ dx, r: 0.9, rim: 0.9, h })), h: 1.45, bend: 9999, knock: 9999, tumble: 12, solid: true, kick: 0.35, lift: 0.45, sound: 'car', pop: 'CAR HIT!', rider: { up: 1.15, om: 0.7, crash: 0, cap: 11 }, rock: { parts: ['car', 'carg'], slide: 0.035, tilt: 0.004, tiltMax: 0.22, tau: 0.6, w: 9, py: 0, pz: 0 },
    glass: { key: 'carg', yoff: 0.75, cart: [[-0.1, 1.05, 0.8]] },
    dent: { parts: ['car', 'carg'], k: 0.02, min: 0.05, max: 0.95, cx: -0.1, cy: -0.2, sx: 0.95, sy: 0.45, z0: 0.0, z1: 0.9, shiftN: 5, mask: (x, y, z) => z > 0.05 && Math.abs(x) < 2.3 && !(Math.abs(x) > 1.0 && z > 0.55 && y < -0.05) },
    layout() { return [{ t: 'car', x: 0, y: 0.75, z: 0, sx: 1, sy: 1, sz: 1, ry: 0, col: 0xffffff }, { t: 'carg', x: 0, y: 0.75, z: 0, sx: 1, sy: 1, sz: 1, ry: 0, col: 0xffffff }]; } },
  hatch: { absorb: 2400, hard: 5, fx: 'dust', name: 'HATCHBACK (SIDEWAYS)', r: 0.95, cyls: [[-1.7, 1.03], [-1.0, 1.3], [-0.2, 1.5], [0.6, 1.5], [1.4, 1.4]].map(([dx, h]) => ({ dx, r: 0.95, rim: 0.95, h })), h: 1.52, bend: 9999, knock: 9999, tumble: 12, solid: true, kick: 0.35, lift: 0.45, sound: 'car', pop: 'CAR HIT!', rider: { up: 1.15, om: 0.7, crash: 0, cap: 11 }, rock: { parts: ['hatch', 'hatchg'], slide: 0.035, tilt: 0.004, tiltMax: 0.22, tau: 0.6, w: 9, py: 0, pz: 0 },
    glass: { key: 'hatchg', yoff: 0, cart: [[-0.1, 1.25, 0.95]] },
    dent: { parts: ['hatch', 'hatchg'], k: 0.02, min: 0.05, max: 0.95, cx: -0.1, cy: 0.62, sx: 0.95, sy: 0.5, z0: 0.0, z1: 1.0, shiftN: 5, mask: (x, y, z) => z > 0.05 && Math.abs(x) < 2.3 },
    wheels(v) { hatchWheelsOff(v); },
    layout() { const b = [{ t: 'hatch', x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, ry: 0, col: 0xffffff }, { t: 'hatchg', x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, ry: 0, col: 0xffffff }];
      if (HATCH.state === 2) for (const w of HATCH.meta.wheels) b.push({ t: w.side > 0 ? 'hwP' : 'hwN', x: w.x, y: w.y, z: w.z, sx: 1, sy: 1, sz: 1, ry: 0, col: 0xffffff }); return b; } },
  tires: { absorb: 600, hard: 6, fx: 'splash', name: 'TIRE STACK', r: 0.35, cyls: [-0.7, 0, 0.7].map(dx => ({ dx, r: 0.35 })), h: 1.9, bend: 3, knock: 11, tumble: 40, solid: false, kick: 0.55, lift: 0.9, sound: 'tires', pop: 'TIRES EVERYWHERE!',
    layout() { const b = []; for (let p = 0; p < 3; p++) for (let i = 0; i < 8; i++) b.push({ t: 'tire', x: (p - 1) * 0.7 + rand(-0.015, 0.015), y: 0.12 + i * 0.235, z: rand(-0.015, 0.015), sx: 1, sy: 1, sz: 1, ry: rand(0, 6), col: 0xffffff - Math.floor(rand(0, 6)) * 0x080808 }); return b; } },
  boxes: { absorb: 40, hard: 99, fx: 'paper', name: 'CARDBOARD BOXES', r: 0.3, cyls: [-0.9, -0.3, 0.3, 0.9].map(dx => ({ dx, r: 0.3 })), h: 1.8, bend: 2, knock: 4, tumble: 60, solid: false, kick: 0.85, lift: 1, sound: 'box', pop: 'BOXES EVERYWHERE!',
    layout() { const b = []; for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) b.push({ t: 'box', x: (i - 1.5) * 0.6 + rand(-0.02, 0.02), y: 0.29 + row * 0.59, z: rand(-0.02, 0.02), sx: 0.58, sy: 0.57, sz: 0.58, ry: rand(-0.08, 0.08), col: 0xc99a62 + Math.floor(rand(0, 5)) * 0x040302 }); b.push({ t: 'box', x: -0.3, y: 2.06, z: 0, sx: 0.5, sy: 0.4, sz: 0.5, ry: 0.2, col: 0xd2a56c }, { t: 'box', x: 0.35, y: 2.0, z: 0, sx: 0.4, sy: 0.3, sz: 0.4, ry: -0.3, col: 0xb98c58 }); return b; } },
  melons: { absorb: 70, hard: 14, fx: 'juice', name: 'WATERMELONS', r: 0.25, cyls: [-0.4, 0, 0.4].map(dx => ({ dx, r: 0.25 })), h: 1.0, bend: 2, knock: 5, tumble: 50, solid: false, kick: 0.8, lift: 1.2, sound: 'melon', pop: 'WATERMELON SPLAT!', splash: [[3, 0.2, 0.3], [2.4, 0.5, 0.35], [0.4, 1.4, 0.4]],
    layout() { const b = [], c = () => [0x2f7d32, 0x3e9142, 0x276a2b][Math.floor(rand(0, 3))]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) b.push({ t: 'melon', x: (i - 1) * 0.42, y: 0.21, z: (j - 1) * 0.1 - 0.0, sx: 0.46, sy: 0.4, sz: 0.4, ry: rand(0, 6), col: c() }); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) b.push({ t: 'melon', x: (i - 0.5) * 0.42, y: 0.55, z: (j - 0.5) * 0.2, sx: 0.46, sy: 0.4, sz: 0.4, ry: rand(0, 6), col: c() }); b.push({ t: 'melon', x: 0, y: 0.88, z: 0, sx: 0.46, sy: 0.4, sz: 0.4, ry: rand(0, 6), col: c() }); return b; } },
  barrels: { absorb: 420, hard: 7, fx: 'splash', name: 'BARREL WALL', r: 0.3, cyls: [-0.93, -0.31, 0.31, 0.93].map(dx => ({ dx, r: 0.3 })), h: 3.6, bend: 8, knock: 22, tumble: 18, solid: false, kick: 0.7, lift: 0.8, sound: 'barrel', pop: 'BARRELS DOWN!',
    layout() { const b = []; for (let row = 0; row < 4; row++) { const n = row % 2 ? 3 : 4; for (let i = 0; i < n; i++) b.push({ t: 'barrel' + Math.floor(rand(0, 4)), x: (i - (n - 1) / 2) * 0.62, y: 0.45 + row * 0.9, z: 0, sx: 0.58, sy: 0.9, sz: 0.58, ry: rand(-0.35, 0.35), col: 0xffffff }); } return b; } },
  bricks: { absorb: 800, hard: 4.2, fx: 'dust', name: 'BRICK WALL', r: 0.14, cyls: [-1, -0.5, 0, 0.5, 1].map(dx => ({ dx, r: 0.14 })), h: 1.6, bend: 12, knock: 50, tumble: 12, solid: true, kick: 0.5, lift: 0.8, sound: 'brick', pop: 'THE WALL FALLS!',
    layout() { const b = []; for (let row = 0; row < 8; row++) { const odd = row % 2; const xs = odd ? [-1.125, -0.75, -0.25, 0.25, 0.75, 1.125] : [-1, -0.5, 0, 0.5, 1]; for (const x of xs) { const half = odd && Math.abs(x) > 1; b.push({ t: 'brick' + Math.floor(rand(0, 4)), x: half ? Math.sign(x) * 1.125 : x, y: 0.1 + row * 0.2, z: 0, sx: half ? 0.25 : 0.5, sy: 0.2, sz: 0.25, ry: 0, col: 0xffffff - Math.floor(rand(0, 8)) * 0x0a0a0a }); } } return b; } },
  barrier: { absorb: 0, hard: 3.8, fx: 'dust', name: 'CONCRETE BARRIER', r: 0.25, cyls: [-0.7, 0, 0.7].map(dx => ({ dx, r: 0.25 })), h: 0.8, bend: 80, knock: 9999, tumble: 10, solid: true, solidMax: 55, kick: 0.12, lift: 0.3, sound: 'concrete', pop: 'BARRIER HOLDS!',
    layout() { return [{ t: 'barrier', x: 0, y: 0, z: 0, sx: 2.2, sy: 1, sz: 1, ry: 0, col: 0xb9b9b3 }]; } },
  wordwall: { absorb: 650, hard: 5, fx: 'dust', name: 'WORD WALL', r: 0.25, cyls: [-1, 0, 1].map(dx => ({ dx, r: 0.28 })), h: 3.85, bend: 9, knock: 20, tumble: 16, solid: false, kick: 0.8, lift: 1.0, sound: 'barrel', pop: 'WALL DESTROYED!',
    layout() { return wordwallLayout(MIX.txt); } },
  pins: { absorb: 12, hard: 99, fx: 'none', name: 'BOWLING PINS', r: 0.15, cyls: [{ dx: 0, r: 0.15 }], h: 0.6, bend: 1, knock: 2.5, tumble: 80, solid: false, kick: 1.0, lift: 1.4, sound: 'pins', pop: 'STRIKE!',
    layout() { const b = []; for (let k = 0; k < 4; k++) for (let j = 0; j <= k; j++) b.push({ t: 'pin', x: (j - k / 2) * 0.3, y: 0, z: -k * 0.27, sx: 0.55, sy: 0.55, sz: 0.55, ry: 0, col: 0xffffff }); return b; } },
};
MIX.txt = wordwallClean(MIX.txt); wordwallSpec(MIX.txt); // after OBST exists (this call used to sit above it and stopped the game at start-up)
const OBX = { cur: 'post', built: {} };
function OBX_PART(g, col, x, y, z, rx, ry, rz, gr) { /* one coloured part of a merged model: vertex colours (with grime: patchy dirt, darker towards the ground), so a whole truck is one draw call */ g = g.index ? g.toNonIndexed() : g; if (rx || ry || rz) { g.rotateX(rx || 0); g.rotateY(ry || 0); g.rotateZ(rz || 0); } g.translate(x, y, z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), k = new THREE.Color(col), G = gr === undefined ? 0.1 : gr, pa = g.attributes.position.array;
  for (let i = 0; i < n; i++) { const px = pa[i * 3], py = pa[i * 3 + 1], pz = pa[i * 3 + 2], t = Math.sin(px * 12.9 + py * 31.1 + pz * 7.4) * 43758.5453, h = t - Math.floor(t), low = Math.min(1, Math.max(0, 1 - py / 1.1)), f = Math.max(0.35, 1 - G * h - G * 1.8 * low - G * 0.8 * (0.5 + 0.5 * Math.sin(px * 2.3 + pz * 1.7))); c[i * 3] = k.r * f; c[i * 3 + 1] = k.g * f; c[i * 3 + 2] = k.b * f; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv' && a !== 'color') g.deleteAttribute(a); return g; }
let OBX_GRIME = null;
function obxGrime() { /* a tiling map of dirt, streaks and scratches: it multiplies the paint, so nothing looks like moulded plastic */
  if (OBX_GRIME) return OBX_GRIME; OBX_GRIME = tex(256, 256, (g, w, h) => { g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const r = 2 + Math.random() * 12; g.fillStyle = 'rgba(' + (Math.random() < 0.7 ? '50,42,34' : '255,255,255') + ',' + (0.03 + Math.random() * 0.08) + ')'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, 6.283); g.fill(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(40,34,28,' + (0.05 + Math.random() * 0.1) + ')'; g.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, h * (0.3 + Math.random() * 0.7)); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(255,255,255,' + (0.15 + Math.random() * 0.2) + ')'; g.lineWidth = 1; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 30 - 15, y + Math.random() * 12 - 6); g.stroke(); } });
  OBX_GRIME.wrapS = OBX_GRIME.wrapT = THREE.RepeatWrapping; return OBX_GRIME; }
function obxMat(rough, metal) { const m = obxGrime(); return new THREE.MeshStandardMaterial({ vertexColors: true, map: m, bumpMap: m, bumpScale: 0.6, roughness: rough, metalness: metal, envMap: (() => { try { return labEnv(); } catch (e) { return null; } })(), envMapIntensity: 0.5 }); }
const OBX_TIRE = [[0.2, -0.11], [0.26, -0.11], [0.32, -0.1], [0.35, -0.07], [0.355, 0], [0.35, 0.07], [0.32, 0.1], [0.26, 0.11], [0.2, 0.11], [0.19, 0], [0.2, -0.11]];
function obxWheel(P, x, y, z, rad, w, axis) { /* a real tyre (rounded profile), a hub and a ring of wheel nuts; axis 'x' (truck) or 'z' (car) */
  const sc = rad / 0.355, sd = axis === 'x' ? Math.sign(x) || 1 : Math.sign(z) || 1, out = [], rx = axis === 'x' ? 0 : Math.PI / 2, rz = axis === 'x' ? Math.PI / 2 : 0, at = (a, b) => axis === 'x' ? [x + sd * a, y + Math.cos(b) * 0.55 * rad, z + Math.sin(b) * 0.55 * rad] : [x + Math.cos(b) * 0.55 * rad, y + Math.sin(b) * 0.55 * rad, z + sd * a];
  out.push(P(new THREE.LatheGeometry(OBX_TIRE.map(([r, yy]) => new THREE.Vector2(r * sc, yy * (w / 0.22))), 24), 0x181818, x, y, z, rx, 0, rz, 0.06));
  out.push(P(new THREE.CylinderGeometry(rad * 0.58, rad * 0.58, w * 0.72, 20), 0x8d9096, x + (axis === 'x' ? sd * w * 0.02 : 0), y, z + (axis === 'x' ? 0 : sd * w * 0.02), rx, 0, rz, 0.05));
  for (let i = 0; i < 8; i++) { const p = at(w * 0.38, i * 0.7854); out.push(P(new THREE.CylinderGeometry(rad * 0.06, rad * 0.06, rad * 0.12, 6), 0x55585d, p[0], p[1], p[2], rx, 0, rz, 0)); }
  return out; }
function obxBox(w, h, d, r, sx, sy, sz) { /* a box with rounded edges and a flat grid of vertices on every face (sx, sy, sz: spacing in metres), so a dent has something to move */
  const H = [w / 2, h / 2, d / 2], sp = [sx || 9, sy || 9, sz || 9]; r = Math.max(0, Math.min(r, H[0], H[1], H[2])); const rr = r >= 0.03; if (!rr) r = 0;
  const ax = i => { const hh = H[i], a = [-hh]; if (rr) a.push(-hh + r * 0.45, -hh + r); const n = Math.max(1, Math.round(2 * (hh - r) / sp[i])); for (let k = 1; k < n; k++) a.push(-hh + r + 2 * (hh - r) * k / n); if (rr) a.push(hh - r, hh - r * 0.45); a.push(hh); return a.filter((v, k) => k === 0 || v - a[k - 1] > 1e-6); };
  const A = [ax(0), ax(1), ax(2)], P = [], N = [];
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    const i = (k + 1) % 3, j = (k + 2) % 3, vert = (a, b) => { const p = [0, 0, 0]; p[k] = s * H[k]; p[i] = A[i][a]; p[j] = A[j][b]; const fn = [0, 0, 0]; fn[k] = s;
      if (!rr) return [p, fn]; const q = [0, 0, 0], dv = [0, 0, 0]; for (let m = 0; m < 3; m++) { const lim = H[m] - r; q[m] = Math.max(-lim, Math.min(lim, p[m])); dv[m] = p[m] - q[m]; } const l = Math.hypot(dv[0], dv[1], dv[2]); if (l < 1e-9) return [p, fn]; return [[q[0] + dv[0] / l * r, q[1] + dv[1] / l * r, q[2] + dv[2] / l * r], [dv[0] / l, dv[1] / l, dv[2] / l]]; };
    let flip = null; for (let a = 0; a < A[i].length - 1; a++) for (let b = 0; b < A[j].length - 1; b++) {
      const v00 = vert(a, b), v10 = vert(a + 1, b), v01 = vert(a, b + 1), v11 = vert(a + 1, b + 1);
      if (flip === null) { const u = [v10[0][0] - v00[0][0], v10[0][1] - v00[0][1], v10[0][2] - v00[0][2]], v = [v01[0][0] - v00[0][0], v01[0][1] - v00[0][1], v01[0][2] - v00[0][2]], cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; flip = cr[k] * s < 0; }
      const tris = flip ? [[v00, v01, v10], [v10, v01, v11]] : [[v00, v10, v01], [v10, v11, v01]]; for (const t of tris) for (const v of t) { P.push(v[0][0], v[0][1], v[0][2]); N.push(v[1][0], v[1][1], v[1][2]); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(N), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); return g;
}
function obxPoly(pts, k) { /* a polyline cut into k pieces per segment */ const o = []; for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < k; j++) { const t = j / k; o.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]); } o.push(pts[pts.length - 1]); return o; }
function obxRange(a, b, dx) { const n = Math.max(1, Math.ceil((b - a) / dx)), o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; }
function obxLin(X, A, x) { if (x <= X[0]) return A[0]; for (let i = 1; i < X.length; i++) if (x <= X[i]) { const t = (x - X[i - 1]) / (X[i] - X[i - 1]); return A[i - 1] + (A[i] - A[i - 1]) * t; } return A[A.length - 1]; }
function obxLoft(xs, pathOf, k, ctr) { /* a smooth skin: at every station x the path (a polyline of [z, y]) is a cross-section, neighbouring stations are joined; ctr [x, y, z] is a point inside the body, so the skin is turned the right way out */
  const rows = xs.map(x => obxPoly(pathOf(x), k)), m = rows[0].length, P = [], I = [];
  rows.forEach((row, i) => row.forEach(([z, y]) => P.push(xs[i], y, z)));
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < m - 1; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; I.push(a, c, b, b, c, d); }
  let sum = 0; for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, cx = (P[a] + P[b] + P[c]) / 3 - ctr[0], cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - ctr[1], cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - ctr[2]; sum += nx * cx + ny * cy + nz * cz; }
  if (sum < 0) for (let t = 0; t < I.length; t += 3) { const q = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = q; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); g.setIndex(I); g.computeVertexNormals(); return g;
}
function obxCap(ring, x, ctr) { /* the flat end of a skin: the ring [z, y] at station x, filled as a fan */ let cz = 0, cy = 0; for (const [z, y] of ring) { cz += z; cy += y; } cz /= ring.length; cy /= ring.length; const P = []; for (let i = 0; i < ring.length - 1; i++) P.push(x, cy, cz, x, ring[i][1], ring[i][0], x, ring[i + 1][1], ring[i + 1][0]);
  let sum = 0; for (let t = 0; t < P.length; t += 9) { const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2], vx = P[t + 6] - P[t], vy = P[t + 7] - P[t + 1], vz = P[t + 8] - P[t + 2]; sum += (uy * vz - uz * vy) * (x - ctr[0]); } if (sum < 0) for (let t = 0; t < P.length; t += 9) for (let q = 0; q < 3; q++) { const a = P[t + 3 + q]; P[t + 3 + q] = P[t + 6 + q]; P[t + 6 + q] = a; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); g.computeVertexNormals(); return g; }
function obxTyre(P, x, y, z, rad, w, axis) { /* a real tyre: rounded profile, axis 'x' (truck) or 'z' (car) */ const sc = rad / 0.355, rx = axis === 'x' ? 0 : Math.PI / 2, rz = axis === 'x' ? Math.PI / 2 : 0;
  return P(new THREE.LatheGeometry(OBX_TIRE.map(([r, yy]) => new THREE.Vector2(r * sc, yy * (w / 0.22))), 20), 0x181818, x, y, z, rx, 0, rz, 0.06); }
function obxAlloyZ(P, x, y, z, rad, w) { /* the car's wheel: tyre, dark recess, silver rim, ten spokes, hub cap and nuts (axis along z) */
  const sd = Math.sign(z) || 1, out = [obxTyre(P, x, y, z, rad, w, 'z')], zf = z + sd * w * 0.36, C = (r, l, c, zz) => P(new THREE.CylinderGeometry(r, r, l, 24), c, x, y, zz, Math.PI / 2, 0, 0, 0.03);
  out.push(C(rad * 0.74, w * 0.5, 0x9ea2a8, z + sd * w * 0.1), C(rad * 0.64, w * 0.5, 0x15161a, z + sd * w * 0.13));
  for (let i = 0; i < 10; i++) { const a = i * 0.6283; out.push(P(obxBox(rad * 0.5, rad * 0.075, w * 0.07, 0.004), 0xb9bdc3, x + Math.cos(a) * rad * 0.38, y + Math.sin(a) * rad * 0.38, zf, 0, 0, a, 0.03)); }
  out.push(C(rad * 0.13, w * 0.12, 0xc9ccd1, z + sd * w * 0.4)); for (let i = 0; i < 5; i++) { const a = i * 1.2566; out.push(P(new THREE.CylinderGeometry(rad * 0.025, rad * 0.025, w * 0.08, 6), 0x777a80, x + Math.cos(a) * rad * 0.2, y + Math.sin(a) * rad * 0.2, z + sd * w * 0.42, Math.PI / 2, 0, 0, 0)); }
  return out; }
function obxSteelX(P, x, y, z, rad, w) { /* the truck's wheel: tyre, white steel disc with a deep dish, ten nuts, hub (axis along x) */
  const sd = Math.sign(x) || 1, out = [obxTyre(P, x, y, z, rad, w, 'x')], C = (r, l, c, xx) => P(new THREE.CylinderGeometry(r, r, l, 22), c, xx, y, z, 0, 0, Math.PI / 2, 0.05);
  out.push(C(rad * 0.6, w * 0.7, 0xc8cbce, x + sd * w * 0.03), C(rad * 0.4, w * 0.74, 0x8a8d92, x + sd * w * 0.05), C(rad * 0.16, w * 0.8, 0x55585d, x + sd * w * 0.06));
  for (let i = 0; i < 10; i++) { const a = i * 0.6283; out.push(P(new THREE.CylinderGeometry(rad * 0.035, rad * 0.035, rad * 0.1, 6), 0x60646a, x + sd * w * 0.4, y + Math.cos(a) * rad * 0.28, z + Math.sin(a) * rad * 0.28, 0, 0, Math.PI / 2, 0)); }
  return out; }
function obxUVfill(g, pane) { /* planar texture coordinates for a glass part: its place inside the atlas of the model's glass */ const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2), r = pane.rect; for (let i = 0; i < n; i++) { const t = pane.uv(p.getX(i), p.getY(i), p.getZ(i)); uv[i * 2] = r[0] + Math.min(1, Math.max(0, t[0])) * (r[2] - r[0]); uv[i * 2 + 1] = r[1] + Math.min(1, Math.max(0, t[1])) * (r[3] - r[1]); } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; }
function obxCrack(g, x, y, size, power) { /* a star of cracks with rings round the point of impact; a hard hit also knocks a ragged hole out of the glass */
  const n = 7 + Math.round(power * 9), R = size * (0.25 + 0.55 * power), rays = []; g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) { const a = (i + (Math.random() - 0.5) * 0.5) / n * 6.283, L = R * (0.5 + Math.random() * 0.8); rays.push([a, L]); g.strokeStyle = 'rgba(238,247,255,0.95)'; g.lineWidth = 1.2 + Math.random() * 1.8; g.beginPath(); g.moveTo(x, y); for (let k = 1; k <= 5; k++) { const aa = a + (Math.random() - 0.5) * 0.2; g.lineTo(x + Math.cos(aa) * L * k / 5, y + Math.sin(aa) * L * k / 5); } g.stroke(); }
  for (const f of [0.28, 0.55, 0.85]) { g.strokeStyle = 'rgba(238,247,255,0.7)'; g.lineWidth = 1; g.beginPath(); rays.forEach(([a, L], i) => { const px = x + Math.cos(a) * L * f * (0.9 + Math.random() * 0.2), py = y + Math.sin(a) * L * f * (0.9 + Math.random() * 0.2); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); g.stroke(); }
  if (power > 0.55) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); const m = 11, r0 = size * (0.05 + 0.12 * power); for (let i = 0; i < m; i++) { const a = i / m * 6.283, r = r0 * (0.6 + Math.random() * 0.8); if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); }
  g.restore(); }
function obxGlassBase(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(32,48,62,0.42)'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(w * (0.1 + i * 0.16), 0); g.lineTo(w * (0.16 + i * 0.16), 0); g.lineTo(w * (0.02 + i * 0.16), h); g.lineTo(w * (-0.04 + i * 0.16), h); g.closePath(); g.fill(); } } // faint reflection streaks
function obxGlassKit(m, fb, yoff) { /* the transparent half of a model: a tinted, glossy, see-through material whose map carries the cracks */
  const geo = OBX_MERGE(m.glass, fb); if (yoff) geo.translate(0, -yoff, 0); const T = () => tex(1024, 1024, obxGlassBase);
  m.gl = { clean: T(), crack: T() }; m.gl.mat = new THREE.MeshStandardMaterial({ map: m.gl.clean, transparent: true, roughness: 0.04, metalness: 0.0, depthWrite: false, side: THREE.DoubleSide, envMap: (() => { try { return labEnv(); } catch (e) { return null; } })(), envMapIntensity: 1.3 }); m.hits = 0;
  return { geo, mat: m.gl.mat, fl: 0.5 }; }
function obsGlassReset(id) { /* a new run: clean glass, no holes, no shards */ const M = OBX_MODELS[id || OBX.cur]; if (OBX.shards) OBX.shards.clear(); if (!M || !M.gl) return; M.hits = 0; M.gl.mat.map = M.gl.clean; const g = M.gl.crack.image.getContext('2d'); obxGlassBase(g, 1024, 1024); M.gl.crack.needsUpdate = true; }
function obsShardSet() { if (!OBX.shards) { const sg = new THREE.BoxGeometry(1, 1, 1), sm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, depthWrite: false }); OBX.shards = new CanDebris(sg, sm, 80); OBX.shards.snd = 'glass'; OBX.shards.bnc = 0.2; OBX.shards.dragK = 0.4; OBX.shards.mesh.castShadow = false; } return OBX.shards; }
function obsGlassAt(x, y, z, power) { /* power 0..1 at the point (x, y, z) of the obstacle's own frame: cracks the pane there; a hard one punches a hole and throws shards */
  const id = OBX.cur, spec = OBST[id], o = OBX.built[id], M = OBX_MODELS[id]; if (!spec || !spec.glass || !o || !M || !M.gl || power < 0.12) return;
  let pn = null, best = 0.3; for (const p of M.panes) { const d = Math.hypot(Math.max(p.bb[0] - x, 0, x - p.bb[1]), Math.max(p.bb[2] - y, 0, y - p.bb[3]), Math.max(p.bb[4] - z, 0, z - p.bb[5])); if (d < best) { best = d; pn = p; } } if (!pn || M.hits > 6) return; M.hits++;
  const t = pn.uv(x, y, z), r = pn.rect, S = 1024, px = (r[0] + clamp(t[0], 0, 1) * (r[2] - r[0])) * S, py = (1 - (r[1] + clamp(t[1], 0, 1) * (r[3] - r[1]))) * S, g = M.gl.crack.image.getContext('2d');
  obxCrack(g, px, py, (r[2] - r[0]) * S * 0.5, power); M.gl.crack.needsUpdate = true; M.gl.mat.map = M.gl.crack;
  if (power > 0.55) { const gm = o.kits[spec.glass.key].geo, a = gm.attributes.position.array, yl = y - spec.glass.yoff, R = 0.16 + 0.4 * power; let cut = 0; // the pane breaks out round the point
    for (let i = 0; i + 8 < a.length; i += 9) { const cx = (a[i] + a[i + 3] + a[i + 6]) / 3, cy = (a[i + 1] + a[i + 4] + a[i + 7]) / 3, cz = (a[i + 2] + a[i + 5] + a[i + 8]) / 3; if (Math.hypot(cx - x, cy - yl, cz - z) < R) { for (let k = 0; k < 3; k++) { a[i + k * 3] = cx; a[i + k * 3 + 1] = cy; a[i + k * 3 + 2] = cz; } (gm.userData.holes || (gm.userData.holes = [])).push(i, cx, cy, cz); cut++; } }
    gm.attributes.position.needsUpdate = true;
    if (cut) { obsShardSet();
      const nr = pn.nrm || [0, 0, 1], N = Math.round(5 + 16 * power), wx = LAB_LANE + x, wz = BOLLARD_Z + z; for (let i = 0; i < N; i++) { const sp = rand(0.5, 4 + 6 * power); OBX.shards.spawn(wx + rand(-R, R) * 0.6, y + rand(-R, R) * 0.6, wz + rand(-R, R) * 0.4, nr[0] * sp + rand(-2, 2), rand(0.5, 3 + 4 * power) + nr[1] * sp, nr[2] * sp + rand(-2, 2), rand(0.04, 0.12), 0.004, rand(0.03, 0.09), 99999, 0xc4dde8, false); }
      glassSound(1.15 - 0.3 * power); } }
}
function obsGlassHit(wx, wy, wz, sp) { /* Daggie's body meets the obstacle at a world point */ const spec = OBST[OBX.cur]; if (!spec || !spec.glass || sp < 6) return; obsGlassAt(wx - LAB_LANE, wy, wz - BOLLARD_Z, clamp((sp - 4) / 26, 0.15, 1)); }
function obsGlassCart(v) { /* the cart's hit flexes the body: the glass above it cracks, the harder the more */ const spec = OBST[OBX.cur]; if (!spec || !spec.glass || !spec.glass.cart) return; const p = clamp((v - 10) / 55, 0, 1); for (const c of spec.glass.cart) obsGlassAt(c[0], c[1], c[2], p); }
const OBX_MODELS = {};
function obxModel(id) { return OBX_MODELS[id] || (OBX_MODELS[id] = OBX_MAKE[id]()); }
const OBX_MAKE = {
  truck: () => { const P = OBX_PART, white = 0xe9ebec, red = 0xa8121a, black = 0x151618, dark = 0x26282b, steel = 0x62676d, silver = 0xb9bdc2, orange = 0xe08a1a, seat = 0x4f5359,
      BX = (w, h, d, c, x, y, z, r, sx, sy, sz, gr) => P(obxBox(w, h, d, r === undefined ? 0 : r, sx, sy, sz), c, x, y, z, 0, 0, 0, gr),
      CZ = (r, l, c, x, y, z) => P(new THREE.CylinderGeometry(r, r, l, 14), c, x, y, z, Math.PI / 2, 0, 0, 0.08), CX = (r, l, c, x, y, z) => P(new THREE.CylinderGeometry(r, r, l, 12), c, x, y, z, 0, 0, Math.PI / 2, 0.06), CV = (r, l, c, x, y, z) => P(new THREE.CylinderGeometry(r, r, l, 12), c, x, y, z, 0, 0, 0, 0.06),
      hh = (a, b, c) => { const t = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return t - Math.floor(t); },
      sand = (det, sx, sy, sz, c, x, y, z) => { const g = new THREE.IcosahedronGeometry(1, det), pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const a = pp.getX(i), b = pp.getY(i), d = pp.getZ(i), n = 1 + 0.12 * (hh(a * 3, b * 3, d * 3) - 0.5) + 0.07 * Math.sin(d * 5 + a * 3); pp.setXYZ(i, a * sx * n, Math.max(b, 0) * sy * n, d * sz * n); } g.computeVertexNormals(); return P(g, c, x, y, z, 0, 0, 0, 0.16); },
      panes = [{ bb: [-1.06, 1.06, 2.04, 2.96, 0.05, 0.4], rect: [0, 0, 1, 0.5], nrm: [0, 0.2, 1], uv: (x, y) => [(x + 1.06) / 2.12, (y - 2.04) / 0.92] }, { bb: [-1.35, -1.05, 2.15, 2.95, -1.05, -0.1], rect: [0, 0.5, 0.5, 1], nrm: [-1, 0.1, 0], uv: (x, y, z) => [(-0.12 - z) / 0.88, (y - 2.15) / 0.8] }, { bb: [1.05, 1.35, 2.15, 2.95, -1.05, -0.1], rect: [0.5, 0.5, 1, 1], nrm: [1, 0.1, 0], uv: (x, y, z) => [(-0.12 - z) / 0.88, (y - 2.15) / 0.8] }],
      GL = (w, h, d, x, y, z, pane) => { const g = obxBox(w, h, d, 0, 0.25, 0.25, 0.25); g.translate(x, y, z); obxUVfill(g, panes[pane]); return P(g, 0xffffff, 0, 0, 0, 0, 0, 0, 0); },
      FX = [0.18, 0.18, 0.6], parts = [], glass = [];
    // chassis: ladder frame, cross members, axles, springs, drive shaft
    for (const sd of [-1, 1]) parts.push(BX(0.2, 0.32, 7.2, black, sd * 0.62, 0.9, -3.45), BX(0.14, 0.1, 1.3, dark, sd * 0.85, 0.78, -5.55));
    for (const z of [-1.2, -2.6, -3.8, -5.2, -6.6]) parts.push(BX(1.3, 0.16, 0.14, dark, 0, 0.9, z));
    parts.push(CX(0.08, 2.2, dark, 0, 0.55, -0.55), CX(0.09, 2.0, dark, 0, 0.55, -4.9), CX(0.09, 2.0, dark, 0, 0.55, -6.2), CZ(0.06, 3.2, dark, 0, 0.8, -2.9));
    // the cab is hollow: lower body, sill, roof, pillars, door sills and a rear wall frame the glass; a dash, seats and a wheel show through it. The front is finely gridded so it can crumple
    parts.push(BX(2.4, 0.9, 1.88, white, 0, 1.4, -0.76, 0.06, ...FX, 0.08), BX(2.4, 0.19, 0.3, white, 0, 1.945, 0.03, 0.03, ...FX, 0.08), BX(2.4, 0.12, 1.88, white, 0, 3.0, -0.76, 0.05, ...FX, 0.08), BX(2.4, 1.1, 0.1, white, 0, 2.4, -1.65, 0.02),
      BX(1.25, 0.5, 0.05, black, 0, 1.62, 0.2, 0, ...FX, 0.04), BX(1.0, 0.22, 0.05, black, 0, 1.1, 0.2, 0, 0.2, 0.2, 0.6, 0.04), BX(2.5, 0.42, 0.3, black, 0, 0.62, 0.17, 0.06, ...FX, 0.05), BX(0.9, 0.05, 0.22, silver, 0, 0.86, 0.15), BX(0.5, 0.14, 0.02, 0xf2f2ea, 0, 0.62, 0.325),
      BX(0.22, 0.06, 0.02, silver, 0, 1.94, 0.2), BX(1.25, 0.02, 0.03, silver, 0, 1.62, 0.23), BX(2.5, 0.12, 1.4, red, 0, 3.47, -1.25, 0.04), BX(2.5, 0.9, 0.14, red, 0, 3.0, -1.93, 0.05),
      BX(2.14, 0.03, 0.05, black, 0, 2.045, 0.2), BX(2.14, 0.03, 0.05, black, 0, 2.955, 0.2), BX(2.0, 0.4, 0.5, 0x232426, 0, 2.05, -0.15), BX(2.2, 0.03, 1.7, 0x40444a, 0, 2.93, -0.8), P(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18), 0x151515, 0.55, 2.28, -0.5, 0, 0, 1.0, 0));
    for (const sd of [-1, 1]) parts.push(BX(0.16, 1.1, 0.3, white, sd * 1.12, 2.4, 0.03, 0.03, ...FX, 0.08), BX(0.1, 0.3, 1.88, white, sd * 1.15, 2.0, -0.76, 0.02), BX(0.1, 0.8, 0.7, white, sd * 1.15, 2.55, -1.35, 0.02), BX(0.03, 0.9, 0.05, black, sd * 1.06, 2.5, 0.2), BX(0.7, 0.15, 0.6, seat, sd * 0.5, 2.05, -1.15), BX(0.7, 0.85, 0.12, seat, sd * 0.5, 2.5, -1.5), BX(0.025, 0.86, 1.03, black, sd * 1.19, 2.55, -0.55));
    for (let i = -2; i <= 2; i++) parts.push(BX(0.02, 0.46, 0.03, silver, i * 0.25, 1.62, 0.23), BX(0.14, 0.08, 0.08, orange, i * 0.35, 3.1, 0.15), BX(0.9, 0.02, 0.03, silver, 0, 1.04 + (i + 2) * 0.06, 0.23));
    for (const sd of [-1, 1]) { parts.push(BX(0.5, 0.3, 0.08, black, sd * 0.82, 1.12, 0.2, 0.03), BX(0.42, 0.22, 0.03, 0xf3f5f7, sd * 0.82, 1.12, 0.245), BX(0.2, 0.1, 0.04, orange, sd * 0.82, 0.93, 0.23), BX(0.16, 0.12, 0.04, 0xf0eac0, sd * 0.7, 0.62, 0.325), BX(0.46, 0.14, 1.3, black, sd * 1.15, 1.15, -0.55, 0.05),
        BX(0.02, 1.7, 0.02, dark, sd * 1.205, 1.95, -0.05), BX(0.02, 1.7, 0.02, dark, sd * 1.205, 1.95, -1.15), BX(0.05, 0.04, 0.2, silver, sd * 1.22, 2.05, -0.95),
        BX(0.4, 0.04, 0.04, black, sd * 1.4, 2.7, 0.1), BX(0.14, 0.5, 0.26, black, sd * 1.6, 2.65, 0.1, 0.04), BX(0.02, 0.42, 0.2, 0x1a2a38, sd * 1.53, 2.65, 0.1), BX(0.1, 0.2, 0.12, black, sd * 1.6, 2.28, 0.12, 0.03), BX(0.22, 0.05, 0.5, silver, sd * 1.28, 0.95, -0.45), BX(0.22, 0.05, 0.5, silver, sd * 1.28, 1.4, -0.45), BX(0.04, 0.8, 0.04, silver, sd * 1.24, 1.7, -1.05),
        BX(0.5, 0.1, 2.0, dark, sd * 1.2, 1.12, -5.55, 0.03), BX(0.55, 0.5, 0.03, black, sd * 1.15, 0.55, -6.95), BX(0.25, 0.2, 0.05, 0xc01818, sd * 1.0, 1.3, -7.07), BX(0.04, 0.68, 0.12, black, 1.15, 0.9, sd * 0.4 - 2.7), P(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 12), steel, sd * 0.5, 1.55, -2.5, 0.7, 0, 0, 0.05), BX(0.4, 0.04, 0.3, silver, sd * 1.05, 1.0, -2.9));
      for (let z = -2.5; z > -6.9; z -= 0.82) parts.push(BX(0.05, 1.25, 0.14, silver, sd * 1.275, 1.85, z)); }
    parts.push(BX(2.5, 1.5, 5.15, red, 0, 1.85, -4.43, 0.06, 0.6, 0.6, 1.0, 0.1), BX(2.5, 0.2, 5.2, black, 0, 1.05, -4.43), BX(2.6, 0.12, 5.25, steel, 0, 2.62, -4.43, 0.03), BX(2.52, 0.12, 5.1, orange, 0, 1.25, -4.43, 0), BX(2.4, 0.12, 0.12, steel, 0, 2.55, -7.03), BX(2.2, 0.15, 0.1, black, 0, 0.72, -7.1),
      CZ(0.32, 1.4, silver, 1.15, 0.9, -2.7), BX(0.5, 0.4, 0.9, dark, -1.1, 0.85, -2.2), BX(0.52, 0.04, 0.92, steel, -1.1, 1.07, -2.2), CV(0.07, 2.2, silver, 1.3, 2.6, -1.85), BX(0.1, 0.04, 0.2, dark, 1.3, 1.9, -1.75), BX(0.16, 0.04, 0.16, dark, 1.3, 3.72, -1.85));
    parts.push(sand(3, 1.15, 0.55, 2.45, 0xcaa86c, 0, 2.58, -4.43), sand(2, 0.5, 0.25, 0.7, 0xb7955a, -0.45, 3.02, -3.5), sand(2, 0.55, 0.28, 0.8, 0xd3b377, 0.4, 3.02, -5.3));
    for (const [x, z] of [[-1.12, -0.55], [1.12, -0.55], [-0.95, -4.9], [0.95, -4.9], [-1.4, -4.9], [1.4, -4.9], [-0.95, -6.2], [0.95, -6.2], [-1.4, -6.2], [1.4, -6.2]]) parts.push(...obxSteelX(P, x, 0.55, z, 0.55, 0.3));
    glass.push(GL(2.1, 0.9, 0.04, 0, 2.5, 0.2, 0), GL(0.04, 0.82, 0.88, -1.205, 2.55, -0.56, 1), GL(0.04, 0.82, 0.88, 1.205, 2.55, -0.56, 2));
    return { body: parts, glass, panes }; },
  car: () => { const P = OBX_PART, paint = 0xf1f2f3, crease = 0xc9ccd0, plastic = 0x0b0b0c, chrome = 0xa3a7ad, red = 0xb0121a, ctr = [0, 0.7, 0], cloth = 0x6e7378,
      BX = (w, h, d, c, x, y, z, r, sx, sy, sz, gr) => P(obxBox(w, h, d, r === undefined ? 0 : r, sx, sy, sz), c, x, y, z, 0, 0, 0, gr),
      X = [-2.35, -2.32, -2.2, -1.8, -1.2, -0.85, -0.45, -0.05, 0.5, 1.0, 1.5, 2.0, 2.25, 2.35], T = [0.5, 0.7, 0.78, 0.85, 0.92, 0.96, 1.18, 1.4, 1.43, 1.4, 1.19, 0.99, 0.95, 0.6], YB = [0.3, 0.26, 0.24, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.24, 0.26, 0.3], WS = [0.7, 0.78, 0.85, 0.885, 0.885, 0.885, 0.88, 0.875, 0.87, 0.87, 0.87, 0.87, 0.85, 0.78],
      sec = x => { const t = obxLin(X, T, x), yb = obxLin(X, YB, x), ws = obxLin(X, WS, x), ys = Math.min(0.9, t - 0.04), g = Math.min(1, Math.max(0, (t - 0.96) / 0.46)); return { t, yb, ws, ys, wr: ws - 0.05 - 0.19 * g, cr: 0.015 + 0.01 * g, wb: ws - 0.1, yl: yb + 0.18 }; },
      WX = [-1.4, 1.27], AR = 0.42, AY = 0.33, arch = x => { for (const wx of WX) { const d = Math.abs(x - wx); if (d < AR) return AY + Math.sqrt(AR * AR - d * d) * 0.95; } return 0; },
      sideUV = (x, y) => [(x + 0.85) / 2.85, (y - 0.9) / 0.55],
      panes = [{ bb: [-0.85, 2.0, 0.9, 1.45, 0.6, 0.95], rect: [0, 0, 0.5, 0.5], nrm: [0, 0.1, 1], uv: sideUV }, { bb: [-0.85, 2.0, 0.9, 1.45, -0.95, -0.6], rect: [0.5, 0, 1, 0.5], nrm: [0, 0.1, -1], uv: sideUV }, { bb: [-0.85, -0.05, 0.9, 1.45, -0.8, 0.8], rect: [0, 0.5, 0.5, 1], nrm: [-1, 0.3, 0], uv: (x, y, z) => [(x + 0.85) / 0.8, (z + 0.8) / 1.6] }, { bb: [1.0, 2.0, 0.9, 1.45, -0.8, 0.8], rect: [0.5, 0.5, 1, 1], nrm: [1, 0.3, 0], uv: (x, y, z) => [(x - 1.0) / 1.0, (z + 0.8) / 1.6] }],
      strip = (x0, x1, fn, col, gr, dx, c2) => P(obxLoft(obxRange(x0, x1, dx || 0.1), fn, 2, c2 || ctr), col, 0, 0, 0, 0, 0, 0, gr === undefined ? 0.04 : gr),
      gstrip = (x0, x1, fn, pane) => P(obxUVfill(obxLoft(obxRange(x0, x1, 0.1), fn, 2, ctr), panes[pane]), 0xffffff, 0, 0, 0, 0, 0, 0, 0),
      parts = [], glass = [];
    // the lower side is cut by the wheel arches (the skin follows the arc), and each arch has a dark inner well
    const sideLo = sd => x => { const s = sec(x), ya = arch(x), a = ya > 0; return [[sd * (a ? s.ws : s.wb), a ? ya : s.yb], [sd * s.ws * 1.004, a ? (ya + s.ys) / 2 : s.yl], [sd * s.ws, s.ys]]; },
      well = sd => x => { const s = sec(x), ya = arch(x) || s.yb; return [[sd * s.ws * 0.998, ya], [sd * (s.ws - 0.24), ya + 0.02]]; },
      deck = x => { const s = sec(x); return [[-s.ws, s.ys], [-s.wr, s.t], [0, s.t + s.cr], [s.wr, s.t], [s.ws, s.ys]]; }, top = x => { const s = sec(x); return [[-s.wr, s.t], [0, s.t + s.cr], [s.wr, s.t]]; },
      sideGl = (sd, o) => x => { const s = sec(x), e = o || 0; return [[sd * (s.ws + e), s.ys], [sd * (s.wr + e), s.t]]; }, rail = sd => x => { const s = sec(x); return [[sd * (s.wr + 0.012), s.t - 0.1], [sd * (s.wr + 0.004), s.t + 0.004]]; };
    for (const sd of [-1, 1]) { parts.push(strip(-2.35, 2.35, sideLo(sd), paint, 0.04, 0.1), strip(-0.85, 2.0, rail(sd), plastic, 0, 0.1), strip(0.2, 0.32, sideGl(sd, 0.007), plastic, 0, 0.06), strip(-0.85, -0.6, sideGl(sd, 0.007), plastic, 0, 0.06), strip(1.55, 1.95, sideGl(sd, 0.007), paint, 0.04, 0.1));
      for (const wx of WX) parts.push(strip(wx - AR, wx + AR, well(sd), 0x0a0a0b, 0, 0.05, [0, 0.9, 0])); glass.push(gstrip(-0.85, 2.0, sideGl(sd), sd > 0 ? 0 : 1)); }
    parts.push(strip(-2.35, -0.85, deck, paint, 0.04, 0.1), strip(2.0, 2.35, deck, paint, 0.04, 0.08), strip(-0.05, 1.0, top, paint, 0.04, 0.1)); glass.push(gstrip(-0.85, -0.05, top, 2), gstrip(1.0, 2.0, top, 3));
    const ring = x => { const s = sec(x); return [[-s.wb, s.yb], [-s.ws, s.yl], [-s.ws, s.ys], [-s.wr, s.t], [0, s.t + s.cr], [s.wr, s.t], [s.ws, s.ys], [s.ws, s.yl], [s.wb, s.yb], [-s.wb, s.yb]]; };
    parts.push(P(obxCap(ring(-2.35), -2.35, ctr), plastic, 0, 0, 0, 0, 0, 0, 0), P(obxCap(ring(2.35), 2.35, ctr), plastic, 0, 0, 0, 0, 0, 0, 0));
    // the inside, seen through the glass
    parts.push(BX(3.0, 0.03, 1.55, 0x1b1c1e, 0.1, 0.4, 0), BX(1.05, 0.03, 1.15, 0x3a3d41, 0.45, 1.36, 0), BX(0.35, 0.2, 1.5, 0x1d1e20, -0.85, 0.85, 0, 0.02), P(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 18), 0x151515, -0.62, 0.97, 0.4, 0, 0, 1.2, 0), BX(0.7, 0.18, 0.2, 0x2b2d30, 0.1, 0.55, 0), BX(0.5, 0.12, 1.4, cloth, 0.85, 0.52, 0), BX(0.12, 0.5, 1.4, cloth, 1.15, 0.82, 0));
    for (const sd of [-1, 1]) parts.push(BX(2.9, 0.5, 0.04, 0x2b2d30, 0.2, 0.65, sd * 0.8), BX(0.5, 0.12, 0.46, cloth, -0.35, 0.52, sd * 0.4), BX(0.12, 0.55, 0.46, cloth, -0.08, 0.85, sd * 0.4), BX(0.1, 0.18, 0.28, cloth, -0.04, 1.18, sd * 0.4));
    // bumpers, grille, lamps, plates, wipers, aerial, exhaust
    parts.push(BX(0.3, 0.34, 1.72, plastic, -2.2, 0.45, 0, 0.08, 9, 9, 9, 0.04), BX(0.3, 0.34, 1.72, plastic, 2.2, 0.47, 0, 0.08, 9, 9, 9, 0.04), BX(0.22, 0.07, 1.5, plastic, -2.28, 0.26, 0, 0.03, 9, 9, 9, 0.04),
      BX(0.06, 0.15, 0.56, plastic, -2.33, 0.7, 0, 0.03, 9, 9, 9, 0.04), BX(0.012, 0.012, 0.5, chrome, -2.365, 0.73, 0), BX(0.012, 0.012, 0.5, chrome, -2.365, 0.69, 0), BX(0.012, 0.012, 0.5, chrome, -2.365, 0.65, 0), BX(0.012, 0.05, 0.08, chrome, -2.37, 0.69, 0),
      BX(0.02, 0.14, 0.34, 0xe9eef2, -2.34, 0.45, 0), BX(0.02, 0.14, 0.34, 0xe9eef2, 2.34, 0.47, 0), BX(0.02, 0.12, 0.5, 0xf1f1ec, -2.37, 0.38, 0), BX(0.02, 0.12, 0.5, 0xf1f1ec, 2.37, 0.5, 0), BX(0.03, 0.012, 0.5, plastic, -0.72, 1.04, 0.24), BX(0.03, 0.012, 0.5, plastic, -0.72, 1.04, -0.24),
      BX(0.012, 0.012, 0.012, plastic, 1.7, 1.2, 0.4), P(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 6), plastic, 1.62, 1.55, 0.52, 0, 0, 0.5, 0), P(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 10), chrome, 2.34, 0.3, 0.5, 0, 0, Math.PI / 2, 0), BX(0.02, 0.04, 0.5, red, 1.99, 0.99, 0));
    for (const sd of [-1, 1]) { parts.push(BX(0.13, 0.17, 0.4, plastic, -2.27, 0.72, sd * 0.58, 0.04), BX(0.03, 0.14, 0.36, 0xe4ebef, -2.325, 0.72, sd * 0.58), BX(0.03, 0.05, 0.14, 0xe08a1a, -2.33, 0.62, sd * 0.78), BX(0.03, 0.07, 0.14, 0xf5f0d0, -2.36, 0.36, sd * 0.55), BX(0.1, 0.17, 0.4, red, 2.3, 0.8, sd * 0.6, 0.04), BX(0.03, 0.05, 0.12, 0xf3f3f3, 2.35, 0.74, sd * 0.78), BX(0.14, 0.03, 0.12, 0xb5b9be, 2.3, 0.62, sd * 0.65));
      parts.push(BX(2.0, 0.06, 0.03, plastic, -0.05, 0.34, sd * 0.89, 0, 9, 9, 9, 0.04), BX(0.28, 0.07, 0.02, plastic, -2.0, 0.55, sd * 0.89, 0, 9, 9, 9, 0.04), BX(1.75, 0.07, 0.02, plastic, -0.05, 0.55, sd * 0.89, 0, 9, 9, 9, 0.04), BX(0.4, 0.07, 0.02, plastic, 1.95, 0.55, sd * 0.89, 0, 9, 9, 9, 0.04), BX(2.8, 0.012, 0.012, chrome, 0.5, 0.905, sd * 0.875), BX(3.4, 0.015, 0.02, crease, -0.1, 0.78, sd * 0.888));
      for (const dx of [-0.85, -0.45, 0.3, 1.05, 1.9]) parts.push(BX(0.012, dx === 0.3 ? 0.62 : 0.56, 0.012, 0x6c6e72, dx, 0.6, sd * 0.887));
      for (const dx of [-0.1, 0.9]) parts.push(BX(0.15, 0.025, 0.035, chrome, dx, 0.78, sd * 0.89));
      parts.push(BX(0.17, 0.05, 0.05, paint, -0.75, 0.98, sd * 0.97), BX(0.09, 0.14, 0.2, paint, -0.8, 1.04, sd * 1.06, 0.04), BX(0.05, 0.12, 0.16, 0x1a2430, -0.8, 1.04, sd * 1.075), BX(0.1, 0.1, 0.012, 0xb3b6bb, 1.78, 0.86, sd * 0.865));
      for (const wx of WX) parts.push(...obxAlloyZ(P, wx, 0.33, sd * 0.785, 0.31, 0.21)); }
    return { body: parts, glass, panes }; }
};
function obxBrickTex() { /* one brick face with its own mortar rim: bricks laid side by side make a real wall, whatever way they fall */
  const t = tex(256, 128, (g, w, h) => { g.fillStyle = '#c9c2b4'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '120,112,98' : '235,228,214') + ',0.35)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    const m = 7, x0 = m, y0 = m, bw = w - 2 * m, bh = h - 2 * m, gr = g.createLinearGradient(0, y0, 0, y0 + bh); gr.addColorStop(0, '#c65c41'); gr.addColorStop(1, '#a74430'); g.fillStyle = gr; g.fillRect(x0, y0, bw, bh);
    for (let i = 0; i < 1100; i++) { const r = Math.random(); g.fillStyle = r < 0.34 ? 'rgba(58,20,12,0.24)' : r < 0.68 ? 'rgba(238,156,112,0.17)' : 'rgba(30,10,6,0.15)'; g.fillRect(x0 + Math.random() * bw, y0 + Math.random() * bh, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(40,12,6,0.4)'; g.beginPath(); g.ellipse(x0 + 10 + Math.random() * (bw - 20), y0 + 8 + Math.random() * (bh - 16), 1.5 + Math.random() * 3, 1 + Math.random() * 2, 0, 0, 6.283); g.fill(); }
    for (const [a, b, c, d, s] of [[x0, y0, x0 + bw, y0, 1], [x0, y0 + bh, x0 + bw, y0 + bh, -1]]) { const e = g.createLinearGradient(0, a === x0 && b === y0 ? y0 : y0 + bh, 0, s > 0 ? y0 + 9 : y0 + bh - 9); e.addColorStop(0, 'rgba(30,8,4,0.5)'); e.addColorStop(1, 'rgba(30,8,4,0)'); g.fillStyle = e; g.fillRect(x0, s > 0 ? y0 : y0 + bh - 9, bw, 9); }
    const ev = g.createLinearGradient(x0, 0, x0 + 9, 0); ev.addColorStop(0, 'rgba(30,8,4,0.45)'); ev.addColorStop(1, 'rgba(30,8,4,0)'); g.fillStyle = ev; g.fillRect(x0, y0, 9, bh); const ew = g.createLinearGradient(x0 + bw, 0, x0 + bw - 9, 0); ew.addColorStop(0, 'rgba(30,8,4,0.45)'); ew.addColorStop(1, 'rgba(30,8,4,0)'); g.fillStyle = ew; g.fillRect(x0 + bw - 9, y0, 9, bh);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#c9c2b4'; const cx = Math.random() < 0.5 ? x0 : x0 + bw, cy = Math.random() < 0.5 ? y0 : y0 + bh; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (cx === x0 ? 1 : -1) * (6 + Math.random() * 8), cy); g.lineTo(cx, cy + (cy === y0 ? 1 : -1) * (5 + Math.random() * 6)); g.fill(); } });
  return t; }
const OBX_BAR = [['GAS', '#bf3a2b', '#fff6e6', 'FLAMMABLE', 'UN 1203 \u00b7 NO FLAME'], ['OIL', '#2a6cb8', '#ffffff', 'MOTOR OIL', 'SAE 5W-30'], ['FUEL', '#d8a21c', '#17141c', 'DIESEL FUEL', 'NO SMOKING'], ['DIESEL', '#2f7d4f', '#ffffff', 'HIGH SULPHUR', 'DANGER']];
const OBX_BARREL_PROF = [[0, -0.5], [0.42, -0.5], [0.46, -0.49], [0.475, -0.465], [0.455, -0.445], [0.48, -0.42], [0.48, -0.35], [0.5, -0.33], [0.5, -0.29], [0.48, -0.27], [0.48, 0.27], [0.5, 0.29], [0.5, 0.33], [0.48, 0.35], [0.48, 0.42], [0.455, 0.445], [0.475, 0.465], [0.46, 0.49], [0.42, 0.5], [0.4, 0.485], [0, 0.485]];
function obxDrawBarrel(g, w, h, V) { /* a steel drum: painted body, scuffs and rust, rolled hoops, bare metal rims, and the stencilled name facing the front */
  const [word, body, ink, sub, small] = V; g.fillStyle = body; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,' + (0.04 + Math.random() * 0.08) + ')' : 'rgba(255,255,255,' + (0.03 + Math.random() * 0.07) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 1 + Math.random() * 4); }
  for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(96,52,24,' + (0.12 + Math.random() * 0.2) + ')'; g.fillRect(Math.random() * w, h * (0.12 + Math.random() * 0.76), 1 + Math.random() * 3, 14 + Math.random() * 70); }
  for (const [a, b] of [[0.17, 0.21], [0.79, 0.83]]) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, (1 - b) * h, w, (b - a) * h); }
  g.fillStyle = '#80848a'; g.fillRect(0, 0, w, h * 0.075); g.fillRect(0, h * 0.925, w, h * 0.075); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h * 0.075, w, 4); g.fillRect(0, h * 0.925 - 4, w, 4);
  const cx = w / 2; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink; g.beginPath();
  if (word === 'OIL') { g.moveTo(cx, h * 0.2); g.bezierCurveTo(cx + 34, h * 0.28, cx + 30, h * 0.35, cx, h * 0.35); g.bezierCurveTo(cx - 30, h * 0.35, cx - 34, h * 0.28, cx, h * 0.2); } else { g.moveTo(cx + 6, h * 0.185); g.bezierCurveTo(cx + 8, h * 0.25, cx + 42, h * 0.27, cx + 34, h * 0.325); g.bezierCurveTo(cx + 30, h * 0.37, cx + 10, h * 0.375, cx, h * 0.37); g.bezierCurveTo(cx - 34, h * 0.37, cx - 40, h * 0.3, cx - 22, h * 0.245); g.bezierCurveTo(cx - 20, h * 0.285, cx - 12, h * 0.29, cx - 8, h * 0.265); g.bezierCurveTo(cx - 4, h * 0.235, cx + 2, h * 0.215, cx + 6, h * 0.185); } g.fill();
  g.font = '900 150px Impact, "Arial Black", "Chakra Petch", sans-serif'; g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.strokeText(word, cx, h * 0.52, 240); g.fillText(word, cx, h * 0.52, 240);
  g.font = '700 36px "Chakra Petch", "Arial Narrow", sans-serif'; g.fillText(sub, cx, h * 0.665, 250); g.font = '700 25px "Chakra Petch", "Arial Narrow", sans-serif'; g.fillText(small, cx, h * 0.725, 250);
  g.fillStyle = '#2b2b2b'; g.fillRect(w - 6, h - 6, 6, 6); }
function obxBarrelKit(k) { const V = OBX_BAR[k], body = new THREE.LatheGeometry(OBX_BARREL_PROF.map(([r, y]) => new THREE.Vector2(r, y)), 28), pa = body.attributes.position, uv = body.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setY(i, pa.getY(i) + 0.5);
  const plug = (x, z) => { const g = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12); g.translate(x, 0.495, z); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, 0.495, 0.004); return g; };
  let geo = null; try { geo = mergeGeometries([body.toNonIndexed(), plug(0.2, 0.12).toNonIndexed(), plug(-0.14, -0.2).toNonIndexed()]); } catch (e) { geo = null; } if (!geo) geo = body;
  const map = tex(512, 512, (g, w, h) => obxDrawBarrel(g, w, h, V)); map.wrapS = THREE.RepeatWrapping; map.offset.set(0.5, 0); /* the name sits at the front (+z) */
  return { geo, mat: new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.45, envMap: (() => { try { return labEnv(); } catch (e) { return null; } })(), envMapIntensity: 0.6 }), fl: 0.29 }; }
function obxTireProfile() { /* a real tyre section: bead, flared sidewall, shoulder, a tread with two grooves; returns the points and the fractions (along the surface) where each region starts */
  const lo = [[0.19, -0.115], [0.205, -0.12], [0.235, -0.12], [0.262, -0.113], [0.292, -0.104], [0.32, -0.094], [0.338, -0.082], [0.35, -0.066], [0.355, -0.05], [0.357, -0.044]], mid = [[0.357, -0.038], [0.347, -0.034], [0.347, -0.023], [0.357, -0.019], [0.357, 0.019], [0.347, 0.023], [0.347, 0.034], [0.357, 0.038]],
    up = lo.map(([r, y]) => [r, -y]).reverse(), pts = lo.concat(mid, up, [[0.19, 0.04], [0.19, -0.04], [0.19, -0.115]]), L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const v = L.map(l => l / L[L.length - 1]); return { pts, v, lowSide: [v[3], v[8]], tread: [v[9], v[10 + mid.length]], upSide: [v[10 + mid.length + 1], v[10 + mid.length + 6]] }; }
function obxDrawTire(g, w, h, T, bump) { /* the tyre skin: dusty rubber, embossed lettering round both sidewalls, tread slits; bump = the height map (letters raised, grooves low) */
  const bg = bump ? '#808080' : '#1d1d1f'; g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < (bump ? 1800 : 1400); i++) { const r = Math.random(); g.fillStyle = bump ? 'rgba(' + (r < 0.5 ? '40,40,40' : '210,210,210') + ',0.18)' : 'rgba(' + (r < 0.45 ? '75,75,78' : r < 0.8 ? '0,0,0' : '120,112,100') + ',0.2)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 2); }
  const Y = v => (1 - v) * h; const band = (a, b) => [Y(b), Y(a)];
  // tread: slanted slits across the ribs, worn lighter on top
  { const [y0, y1] = band(T.tread[0], T.tread[1]); for (let x = 0; x < w; x += 13) { g.strokeStyle = bump ? 'rgba(20,20,20,0.9)' : 'rgba(0,0,0,0.85)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y0 + 2); g.lineTo(x + 7, y1 - 2); g.stroke(); } if (!bump) { g.fillStyle = 'rgba(150,140,125,0.12)'; g.fillRect(0, y0, w, y1 - y0); } }
  // sidewall lettering (embossed): once on the upper wall, once on the lower one; concentric ribs near the shoulder
  for (const [a, b, flip] of [[T.upSide[0], T.upSide[1], 0], [T.lowSide[0], T.lowSide[1], 1]]) { const [y0, y1] = band(Math.min(a, b), Math.max(a, b)), cy = (y0 + y1) / 2;
    g.fillStyle = bump ? '#c8c8c8' : '#4a4a4e'; g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y0 + 6); g.lineTo(w, y0 + 6); g.moveTo(0, y1 - 6); g.lineTo(w, y1 - 6); g.stroke();
    g.textBaseline = 'middle'; g.font = '800 36px "Arial Black", Impact, sans-serif'; g.fillText('GOODRIDE', w * 0.08 + flip * w * 0.5, cy - 8); g.font = '700 22px Arial, sans-serif'; g.fillText('205/55 R16  91H', w * 0.08 + flip * w * 0.5, cy + 17);
    g.font = '700 20px Arial, sans-serif'; g.fillText('TUBELESS  RADIAL', w * 0.46 + flip * w * 0.5 - (flip ? w : 0), cy - 4); if (!bump && !flip) { g.fillStyle = '#d8c64a'; g.beginPath(); g.arc(w * 0.7, cy, 9, 0, 6.283); g.fill(); } }
  // the bead and the inner liner are plain black rubber
  if (!bump) { const [y0, y1] = band(0, T.lowSide[0]); g.fillStyle = 'rgba(8,8,8,0.55)'; g.fillRect(0, y0, w, y1 - y0); const [z0, z1] = band(T.upSide[1], 1); g.fillRect(0, z0, w, z1 - z0); } }
function obxTireKit() { const T = obxTireProfile(), geo = new THREE.LatheGeometry(T.pts.map(([r, y]) => new THREE.Vector2(r, y)), 32), uv = geo.attributes.uv, n = T.pts.length;
  for (let i = 0; i < uv.count; i++) uv.setY(i, T.v[Math.min(n - 1, Math.round(uv.getY(i) * (n - 1)))]);
  const map = tex(1024, 512, (g, w, h) => obxDrawTire(g, w, h, T, false)), bumpMap = tex(1024, 512, (g, w, h) => obxDrawTire(g, w, h, T, true));
  return { geo, mat: new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 3, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }), fl: 0.12 }; }
const OBX_BRICKS = [['#c65c41', '#a74430'], ['#b3503a', '#8f3a2a'], ['#d27a55', '#b85f3e'], ['#9a4030', '#7d3224']];
function obxBrickDraw(g, w, h, C, bump) { /* a brick face with a recessed mortar joint all round: the bump map sinks the joint, the colour map stains it */
  const m = 7, x0 = m, y0 = m, bw = w - 2 * m, bh = h - 2 * m;
  if (bump) { g.fillStyle = '#303030'; g.fillRect(0, 0, w, h); g.fillStyle = '#9a9a9a'; g.fillRect(x0, y0, bw, bh); for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '40,40,40' : '230,230,230') + ',0.3)'; g.fillRect(x0 + Math.random() * bw, y0 + Math.random() * bh, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(20,20,20,0.7)'; g.beginPath(); g.ellipse(x0 + 10 + Math.random() * (bw - 20), y0 + 8 + Math.random() * (bh - 16), 2 + Math.random() * 3, 1.5 + Math.random() * 2, 0, 0, 6.283); g.fill(); } return; }
  g.fillStyle = '#c9c2b4'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '120,112,98' : '235,228,214') + ',0.35)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  const gr = g.createLinearGradient(0, y0, 0, y0 + bh); gr.addColorStop(0, C[0]); gr.addColorStop(1, C[1]); g.fillStyle = gr; g.fillRect(x0, y0, bw, bh);
  for (let i = 0; i < 1300; i++) { const r = Math.random(); g.fillStyle = r < 0.34 ? 'rgba(58,20,12,0.24)' : r < 0.68 ? 'rgba(238,156,112,0.17)' : 'rgba(30,10,6,0.15)'; g.fillRect(x0 + Math.random() * bw, y0 + Math.random() * bh, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  for (let i = 0; i < 4; i++) { const cx = x0 + Math.random() * bw, cy = y0 + Math.random() * bh, rg = g.createRadialGradient(cx, cy, 1, cx, cy, 14 + Math.random() * 18); rg.addColorStop(0, 'rgba(70,20,10,0.28)'); rg.addColorStop(1, 'rgba(70,20,10,0)'); g.fillStyle = rg; g.fillRect(x0, y0, bw, bh); }
  for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(235,232,222,0.14)'; g.fillRect(x0 + Math.random() * bw * 0.7, y0, 4 + Math.random() * 14, bh * (0.2 + Math.random() * 0.5)); }
  for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(40,12,6,0.45)'; g.beginPath(); g.ellipse(x0 + 10 + Math.random() * (bw - 20), y0 + 8 + Math.random() * (bh - 16), 1.5 + Math.random() * 3, 1 + Math.random() * 2, 0, 0, 6.283); g.fill(); }
  const eg = (xa, ya, xb, yb, rx, ry, rw, rh) => { const e = g.createLinearGradient(xa, ya, xb, yb); e.addColorStop(0, 'rgba(30,8,4,0.5)'); e.addColorStop(1, 'rgba(30,8,4,0)'); g.fillStyle = e; g.fillRect(rx, ry, rw, rh); };
  eg(0, y0, 0, y0 + 9, x0, y0, bw, 9); eg(0, y0 + bh, 0, y0 + bh - 9, x0, y0 + bh - 9, bw, 9); eg(x0, 0, x0 + 9, 0, x0, y0, 9, bh); eg(x0 + bw, 0, x0 + bw - 9, 0, x0 + bw - 9, y0, 9, bh);
  for (let i = 0; i < 3; i++) { g.fillStyle = '#c9c2b4'; const cx = Math.random() < 0.5 ? x0 : x0 + bw, cy = Math.random() < 0.5 ? y0 : y0 + bh; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (cx === x0 ? 1 : -1) * (6 + Math.random() * 8), cy); g.lineTo(cx, cy + (cy === y0 ? 1 : -1) * (5 + Math.random() * 6)); g.fill(); } }
function obxBrickKit(k) { const C = OBX_BRICKS[k], map = tex(256, 128, (g, w, h) => obxBrickDraw(g, w, h, C, false)), bumpMap = tex(256, 128, (g, w, h) => obxBrickDraw(g, w, h, C, true));
  return { geo: new RoundedBoxGeometry(1, 1, 1, 2, 0.035), mat: new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2.2, roughness: 0.93, color: 0xffffff }), fl: 0.1 }; }
function OBX_MERGE(parts, fb) { /* if the parts cannot be merged the obstacle is still there, as a plain block, and the game does not stop */ let g = null; try { g = mergeGeometries(parts); } catch (e) { g = null; } return g || fb; }
// ---------- the hatchback: a real model (hatch.bin + hatch.jpg), simplified from a 500 000-triangle original to about 45 000 ----------
const HATCH = { state: 0, meta: null, geo: {}, tex: null, mat: null, matW: null };
function hatchParse(buf) { const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x48435448) throw new Error('hatch.bin is not a hatchback file'); const jl = dv.getUint32(8, true), meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, jl))), base = 12 + jl, G = {};
  for (const k of ['body', 'glass', 'wheelP', 'wheelN']) { const m = meta[k], g = new THREE.BufferGeometry(), q = new Int8Array(buf, base + m.nrm.off, m.nrm.n), nf = new Float32Array(m.nrm.n); for (let i = 0; i < nf.length; i++) nf[i] = q[i] / 127;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, base + m.pos.off, m.pos.n), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nf, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buf, base + m.uv.off, m.uv.n), 2));
    g.setIndex(new THREE.BufferAttribute(m.idx32 ? new Uint32Array(buf, base + m.idx.off, m.idx.n) : new Uint16Array(buf, base + m.idx.off, m.idx.n), 1)); G[k] = g; }
  return { meta, G }; }
function obsDrop(id) { /* forget a built obstacle completely (its meshes leave the scene), so that it is built again from scratch */ const o = OBX.built[id]; if (o) { for (const t in o.sets) { scene.remove(o.sets[t].mesh); try { o.sets[t].mesh.dispose(); } catch (e) { /* gone anyway */ } } delete OBX.built[id]; } }
function hatchLoad() {
  if (HATCH.state !== 0) return; HATCH.state = 1;
  const tl = new Promise((res, rej) => new THREE.TextureLoader().load('hatch.jpg?v=45', res, undefined, rej));
  Promise.all([fetch('hatch.bin?v=45').then(r => { if (!r.ok) throw new Error('hatch.bin ' + r.status); return r.arrayBuffer(); }), tl]).then(([buf, tx]) => {
    const { meta, G } = hatchParse(buf); tx.flipY = false; tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 16; tx.needsUpdate = true;
    HATCH.meta = meta; HATCH.tex = tx; HATCH.geo.body = G.body.toNonIndexed(); HATCH.geo.glass = G.glass.toNonIndexed(); HATCH.geo.wheelP = G.wheelP; HATCH.geo.wheelN = G.wheelN; // a dent works on triangles that stand on their own
    HATCH.mat = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5, metalness: 0.08, envMapIntensity: 0.5 }); HATCH.matW = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.46, metalness: 0.22, envMapIntensity: 0.55 });
    const pn = p => { const w = Math.max(1e-6, p.bb[p.type === 'x' ? 1 : 5] - p.bb[p.type === 'x' ? 0 : 4]), h = Math.max(1e-6, p.bb[3] - p.bb[2]); return p.type === 'x' ? (x, y) => [(x - p.bb[0]) / w, (y - p.bb[2]) / h] : (x, y, z) => [(z - p.bb[4]) / w, (y - p.bb[2]) / h]; };
    OBX_MODELS.hatch = { body: [], glass: [HATCH.geo.glass], panes: meta.panes.map(p => ({ bb: p.bb, rect: p.rect, nrm: p.nrm, uv: pn(p) })) };
    HATCH.state = 2; hatchReady(); }).catch(e => { HATCH.state = -1; console.warn('the hatchback model was not loaded', e); }); }
function hatchReady() { obsDrop('hatch'); if (OBX.cur === 'hatch' && LAB.machine === 'mix') { try { mixApply(); } catch (e) { /* the next change of the menu will do it */ } } }
const HATCH_NOTHING = () => ({ geo: new THREE.BoxGeometry(0.05, 0.05, 0.05), mat: new THREE.MeshBasicMaterial({ visible: false }), fl: 0.05 });
function hatchWheelsOff(v) { /* a hard hit tears wheels off: the near ones first, the far ones only at very high speed */
  const o = OBX.built.hatch; if (!o) return; let n = 0; for (const b of o.blocks) { if (b.t !== 'hwP' && b.t !== 'hwN') continue; const p = clamp((v - 10) / 26, 0, 1) * (b.t === 'hwP' ? 1 : 0.3); if (Math.random() < p) { b.set.launch(b.i, (b.x < 0 ? -1 : 1) * rand(0.5, 3.5), rand(2.5, 6) + v * 0.05, -v * rand(0.22, 0.45), rand(-7, 7), rand(-7, 7), rand(-7, 7)); n++; } }
  if (n) burst(new V3(LAB_LANE, 0.4, BOLLARD_Z), 14 + n * 6, [[1.4, 1.2, 1.0], [2, 1.7, 1.2]], 4 + v * 0.08); }
const OBS_KIT = {
  hatch: () => HATCH.state === 2 ? { geo: HATCH.geo.body, mat: HATCH.mat, fl: 0.5 } : { geo: new THREE.BoxGeometry(4.5, 1.5, 2).translate(0, 0.75, 0), mat: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.6 }), fl: 0.5 },
  hatchg: () => HATCH.state === 2 ? obxGlassKit(OBX_MODELS.hatch, new THREE.BoxGeometry(0.05, 0.05, 0.05), 0) : HATCH_NOTHING(),
  hwP: () => HATCH.state === 2 ? { geo: HATCH.geo.wheelP, mat: HATCH.matW, fl: 0.36 } : HATCH_NOTHING(),
  hwN: () => HATCH.state === 2 ? { geo: HATCH.geo.wheelN, mat: HATCH.matW, fl: 0.36 } : HATCH_NOTHING(),
  truck: () => ({ geo: OBX_MERGE(obxModel('truck').body, new THREE.BoxGeometry(2.5, 3, 7).translate(0, 1.5, -3.4)), mat: obxMat(0.6, 0.28), fl: 0.5 }),
  truckg: () => obxGlassKit(obxModel('truck'), new THREE.BoxGeometry(0.1, 0.1, 0.1), 0),
  car: () => { const geo = OBX_MERGE(obxModel('car').body, new THREE.BoxGeometry(4.5, 1.5, 1.8).translate(0, 0.75, 0)); geo.translate(0, -0.75, 0); return { geo, mat: obxMat(0.22, 0.55), fl: 0.45 }; },
  carg: () => obxGlassKit(obxModel('car'), new THREE.BoxGeometry(0.1, 0.1, 0.1), 0.75),
  tire: () => obxTireKit(),
  cube: () => ({ geo: new RoundedBoxGeometry(1, 1, 1, 3, 0.07), mat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.02, map: tex(64, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ececec'; g.fillRect(7, 7, w - 14, h - 14); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(7, 7, w - 14, 3); g.fillRect(7, 7, 3, h - 14); }) }), fl: WW.cs * 0.485 }),
  box: () => { const map = tex(256, 256, (g, w, h) => { g.fillStyle = '#c99a62'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '120,80,40' : '255,230,180') + ',0.08)'; g.fillRect(Math.random() * w, Math.random() * h, 22, 1); } g.fillStyle = 'rgba(214,190,130,0.85)'; g.fillRect(0, h * 0.46, w, h * 0.08); g.fillStyle = 'rgba(60,40,20,0.7)'; g.font = '700 22px Arial'; g.fillText('FRAGILE', 18, 44); g.fillRect(w - 80, h - 70, 56, 40); g.strokeStyle = 'rgba(80,50,20,0.6)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); }); return { geo: new RoundedBoxGeometry(1, 1, 1, 2, 0.03), mat: new THREE.MeshStandardMaterial({ map, roughness: 0.9 }), fl: 0.22 }; },
  melon: () => { const map = tex(128, 128, (g, w, h) => { g.fillStyle = '#4a9a47'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 12) { g.fillStyle = 'rgba(20,70,25,0.55)'; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 8, h * 0.3, x - 6, h * 0.6, x + 4, h); g.lineTo(x + 9, h); g.bezierCurveTo(x, h * 0.6, x + 14, h * 0.3, x + 6, 0); g.fill(); } }); return { geo: new THREE.SphereGeometry(0.5, 16, 12), mat: new THREE.MeshStandardMaterial({ map, roughness: 0.4, metalness: 0.05 }), fl: 0.19 }; },
  barrel: () => { const pts = []; const prof = [[0, -0.5], [0.46, -0.5], [0.5, -0.46], [0.5, -0.38], [0.46, -0.34], [0.5, -0.3], [0.5, -0.02], [0.46, 0.02], [0.5, 0.06], [0.5, 0.3], [0.46, 0.34], [0.5, 0.38], [0.5, 0.46], [0.46, 0.5], [0, 0.5]]; for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y)); const geo = new THREE.LatheGeometry(pts, 24); return { geo, mat: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.55, color: 0xffffff, envMap: (() => { try { return labEnv(); } catch (e) { return null; } })(), envMapIntensity: 0.7 }), fl: 0.29 }; },
  barrel0: () => obxBarrelKit(0), barrel1: () => obxBarrelKit(1), barrel2: () => obxBarrelKit(2), barrel3: () => obxBarrelKit(3),
  brick0: () => obxBrickKit(0), brick1: () => obxBrickKit(1), brick2: () => obxBrickKit(2), brick3: () => obxBrickKit(3),
  barrier: () => { const sh = new THREE.Shape(); sh.moveTo(-0.25, 0); sh.lineTo(0.25, 0); sh.lineTo(0.25, 0.1); sh.lineTo(0.12, 0.45); sh.lineTo(0.08, 0.8); sh.lineTo(-0.08, 0.8); sh.lineTo(-0.12, 0.45); sh.lineTo(-0.25, 0.1); sh.closePath(); const ge = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); ge.translate(0, 0, -0.5); ge.rotateY(Math.PI / 2); const map = tex(256, 160, (c, w, h) => CAN_DRAW.concrete(c, w, h)); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1.5, 1); return { geo: ge, mat: new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.2, roughness: 0.9 }), fl: 0.25 }; },
  pin: () => { const pts = [[0, 0], [0.17, 0], [0.2, 0.03], [0.31, 0.2], [0.35, 0.34], [0.3, 0.52], [0.2, 0.64], [0.15, 0.74], [0.17, 0.82], [0.2, 0.9], [0.17, 0.97], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)); const geo = new THREE.LatheGeometry(pts, 18); const map = tex(16, 128, (g, w, h) => { g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#c1272d'; g.fillRect(0, h * 0.53, w, h * 0.06); g.fillRect(0, h * 0.66, w, h * 0.06); }); return { geo, mat: new THREE.MeshStandardMaterial({ map, roughness: 0.15, metalness: 0.0 }), fl: 0.1 }; },
};
function obsBuild(id) {
  if (OBX.built[id]) return OBX.built[id]; const sp = OBST[id], blocks = sp.layout(), by = {}, out = { blocks: [], sets: {}, kits: {} };
  for (const b of blocks) (by[b.t] = by[b.t] || []).push(b);
  for (const t in by) { const tk = /^(barrel|brick)\d$/.test(t) ? t.slice(0, -1) : t, kit = OBS_KIT[t](), set = new CanDebris(kit.geo, kit.mat, by[t].length); set.mesh.castShadow = true; set.mesh.receiveShadow = true; set.snd = { cube: 'box', box: 'box', melon: 'melon', barrel: 'barrel', brick: 'stone', barrier: 'stone', pin: 'pin', truck: 'metal', car: 'metal', tire: 'box', truckg: 'glass', carg: 'glass', hatch: 'metal', hatchg: 'glass', hwP: 'box', hwN: 'box' }[tk]; set.dragK = { cube: 0.1, box: 0.3, melon: 0.04, barrel: 0.04, brick: 0.02, barrier: 0.01, pin: 0.08, truck: 0.01, car: 0.02, tire: 0.1, truckg: 0.01, carg: 0.02, hatch: 0.02, hatchg: 0.02, hwP: 0.02, hwN: 0.02 }[tk]; set.bnc = { cube: 0.3, box: 0.12, melon: 0.1, barrel: 0.45, brick: 0.2, barrier: 0.1, pin: 0.5, truck: 0.05, car: 0.15, tire: 0.55, truckg: 0.05, carg: 0.15, hatch: 0.15, hatchg: 0.15, hwP: 0.4, hwN: 0.4 }[tk]; if (t === 'truckg' || t === 'carg' || t === 'hatchg') set.mesh.castShadow = false; out.sets[t] = set; out.kits[t] = kit; for (const b of by[t]) out.blocks.push(Object.assign({ set, kit }, b)); }
  return (OBX.built[id] = out);
}
function obsPlace(id) { // every block back in its place, still
  if (OBX.dust) OBX.dust.clear(); OBX.cool = {}; OBX.psp = {};
  const o = obsBuild(id), sp = OBST[id], q = new THREE.Quaternion(), up = new V3(0, 1, 0), jit = sp.layout; 
  for (const t in o.kits) { const gm = o.kits[t].geo; if (gm.userData.orig) { gm.attributes.position.array.set(gm.userData.orig); gm.attributes.normal.array.set(gm.userData.origN); gm.attributes.position.needsUpdate = true; gm.attributes.normal.needsUpdate = true; gm.userData.shown = false; gm.userData.holes = []; gm.userData.dentD = 0; } } if (OBST[id].dent) for (const part of OBST[id].dent.parts) if (o.kits[part]) obsDentPrep(o.kits[part].geo, OBST[id].dent); // a new run: the dent is hammered out, the next one is prepared
  obsGlassReset(id); if (OBX.frag) OBX.frag.clear(); if (OBST[id].glass) obsShardSet(); if (id === 'bricks') obsFragSet(); OBX_ROCK.on = false; OBX_ROCK.id = ''; for (const t in o.sets) { o.sets[t].mesh.position.set(0, 0, 0); o.sets[t].mesh.quaternion.set(0, 0, 0, 1); } // a new run: the vehicle is back in place
  for (const t in o.sets) o.sets[t].clear();
  for (const b of o.blocks) { const i = b.set.next; q.setFromAxisAngle(up, b.ry || 0); b.set.raw(LAB_LANE + b.x, b.y, BOLLARD_Z + b.z, 0, 0, 0, b.sx, b.sy, b.sz, 99999, b.col, true, q.x, q.y, q.z, q.w, 0, 0, 0); b.i = i; b.set.fl[i] = b.kit.fl; }
  for (const t in o.sets) { o.sets[t].mesh.visible = true; o.sets[t].mesh.instanceMatrix.needsUpdate = true; }
}
function obsDentPrep(geo, A) { // done once, in the menu: which vertices a dent can ever touch and how far each moves (that depends only on where the vertex is), so the crash itself loops over those few only
  const U = geo.userData; if (U.dentIdx) return; const pos = geo.attributes.position, nor = geo.attributes.normal, a = pos.array, n = pos.count;
  if (!U.orig) { U.orig = a.slice(); U.origN = nor.array.slice(); }
  const idx = [], bw = [], hit = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const k = i * 3, x = a[k], y = a[k + 1], z = a[k + 2]; if (!A.mask(x, y, z)) continue; const dx = (x - A.cx) / A.sx, dy = (y - A.cy) / A.sy, w = Math.exp(-(dx * dx + dy * dy) * 0.5); if (w < 0.02) continue;
    const f = Math.pow(clamp((z - A.z0) / (A.z1 - A.z0), 0, 1), 1.3), t = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453, nz = 0.8 + 0.3 * (t - Math.floor(t)) + 0.15 * Math.sin(x * 9 + z * 4) * Math.sin(y * 7 + x * 3); idx.push(i); bw.push(w * f * nz); hit[i] = 1; }
  const tri = []; for (let i = 0; i + 2 < n; i += 3) if (hit[i] || hit[i + 1] || hit[i + 2]) tri.push(i);
  U.dentIdx = Int32Array.from(idx); U.dentBW = Float32Array.from(bw); U.dentTri = Int32Array.from(tri); U.dentD = 0; U.holes = [];
}
function obsDentApply(geo, on) { // crumple the prepared vertices to the stored depth (on) or put everything back (off); the glass holes go with it
  const U = geo.userData, pos = geo.attributes.position, nor = geo.attributes.normal, a = pos.array, na = nor.array, o = U.orig; if (!U.dentIdx) return; const ix = U.dentIdx, bw = U.dentBW, tr = U.dentTri, D = U.dentD, h = U.holes;
  if (on) { for (let j = 0; j < ix.length; j++) { const k = ix[j] * 3; a[k] = o[k]; a[k + 1] = o[k + 1]; a[k + 2] = o[k + 2] - D * bw[j]; }
    for (let q = 0; q < tr.length; q++) { const p = tr[q] * 3, ux = a[p + 3] - a[p], uy = a[p + 4] - a[p + 1], uz = a[p + 5] - a[p + 2], vx = a[p + 6] - a[p], vy = a[p + 7] - a[p + 1], vz = a[p + 8] - a[p + 2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; for (let r = 0; r < 3; r++) { na[p + r * 3] = nx; na[p + r * 3 + 1] = ny; na[p + r * 3 + 2] = nz; } } // crumpled metal is faceted: a flat normal on every triangle that moved
    for (let q = 0; q < h.length; q += 4) { const i = h[q]; for (let r = 0; r < 3; r++) { a[i + r * 3] = h[q + 1]; a[i + r * 3 + 1] = h[q + 2]; a[i + r * 3 + 2] = h[q + 3]; } } }
  else { for (let j = 0; j < ix.length; j++) { const k = ix[j] * 3; a[k] = o[k]; a[k + 1] = o[k + 1]; a[k + 2] = o[k + 2]; }
    for (let q = 0; q < tr.length; q++) { const p = tr[q] * 3; for (let r = 0; r < 9; r++) na[p + r] = U.origN[p + r]; }
    for (let q = 0; q < h.length; q += 4) { const i = h[q]; for (let r = 0; r < 9; r++) a[i + r] = o[i + r]; } }
  pos.needsUpdate = true; nor.needsUpdate = true; U.shown = on;
}
function obsDeform(v) { // a heavy obstacle is not a rock: the front of the truck / the side of the car (and its glass) crumples, deeper the faster the hit; the vehicle and the cylinders sink into the dent by the same depth
  const sp = OBST[OBX.cur], o = OBX.built[OBX.cur], A = sp && sp.dent; if (!A || !o) return 0; const D = clamp(A.min + v * A.k, 0, A.max);
  for (const part of A.parts) { const kit = o.kits[part]; if (!kit) continue; const geo = kit.geo; obsDentPrep(geo, A); geo.userData.dentD = D; obsDentApply(geo, true); }
  for (let j = 0; j < (A.shiftN || 0); j++) if (CART.cyls[j]) CART.cyls[j].z -= D;
  CART.pw[1] -= D * 0.9; labCartPlace(); board.updateMatrixWorld(true);
  obsGlassCart(v); if (v >= 8) obsFx(sp, v, 1);
  return D;
}
const OBX_ROCK = { on: false, t: 0, id: '', S: 0, A: 0, T: 0.7, cz: [], q: null, ax: null, c: null };
function obsRockStart(v) { // the struck vehicle is shoved and rocks on its suspension: the lighter it is, the more (the truck a little, the car clearly); a hit hard enough to throw it is handled by the debris physics instead
  const sp = OBST[OBX.cur], k = sp && sp.rock, o = OBX.built[OBX.cur]; OBX_ROCK.on = false; OBX_ROCK.id = ''; if (!k || !o || !k.parts.every(p => o.sets[p]) || v >= sp.bend) return;
  Object.assign(OBX_ROCK, { on: true, t: 0, id: OBX.cur, S: k.slide * v, A: Math.min(k.tiltMax || 9, k.tilt * v), cz: CART.cyls.map(c => c.z) });
  if (AC && v >= 6 && !sfxPlay('creak', 0.5, k.part === 'truck' ? 0.7 : 1, 0.2)) { OUT(); const t = AC.currentTime, big = k.part === 'truck', g = clamp(v / 45, 0.2, 1); // metal groan on the springs, then two soft settling thumps
    noise(t + 0.1, 0.5, 0.05 * g, 'bandpass', big ? 300 : 460, big ? 190 : 300, 12); noise(t + 0.3, 0.12, 0.1 * g, 'lowpass', 300, 100, 0.8); noise(t + 0.62, 0.1, 0.06 * g, 'lowpass', 260, 90, 0.8); }
}
function obsRockAt(t) { // the vehicle's pose t seconds after the hit (t < 0: untouched): shoved back, tilting away and rocking back on its springs, with a little bounce
  const R = OBX_ROCK; if (!R.id) return; const sp = OBST[R.id], k = sp.rock, o = OBX.built[R.id], ms = o && k.parts.map(p => o.sets[p] && o.sets[p].mesh).filter(Boolean); if (!ms || !ms.length) return;
  if (!R.q) { R.q = new THREE.Quaternion(); R.ax = new V3(1, 0, 0); R.c = new V3(); }
  const tt = Math.max(0, t), u = Math.min(1, tt / R.T), slide = R.S * (1 - (1 - u) * (1 - u)), ang = -R.A * Math.exp(-tt / k.tau) * Math.sin(k.w * tt), heave = 0.6 * R.A * Math.exp(-tt / k.tau) * Math.abs(Math.sin(k.w * tt));
  R.q.setFromAxisAngle(R.ax, ang); R.c.set(LAB_LANE, k.py, BOLLARD_Z + k.pz); const rx = R.c.clone().applyQuaternion(R.q); for (const m of ms) { m.quaternion.copy(R.q); m.position.set(R.c.x - rx.x, R.c.y - rx.y + heave, R.c.z - rx.z - slide); }
  return slide;
}
function obsRockStep(dt) {
  const R = OBX_ROCK; if (!R.on) return; R.t += dt; const sp = OBST[R.id], slide = obsRockAt(R.t); if (slide === undefined) { R.on = false; return; }
  const n = Math.min(CART.cyls.length, sp.dent ? sp.dent.shiftN : 0); for (let j = 0; j < n; j++) if (R.cz[j] !== undefined) CART.cyls[j].z = R.cz[j] - slide; // what the body collides with moves with the vehicle
  if (R.t > R.T + 3) R.on = false;
}
function obsDentShow(dented) { // the replay: the vehicle is whole before the hit, crumpled (glass cracked) after it
  const sp = OBST[OBX.cur], o = OBX.built[OBX.cur], A = sp && sp.dent; if (!A || !o) return;
  for (const part of A.parts) { const gm = o.kits[part] && o.kits[part].geo; if (!gm || !gm.userData.dentIdx || !gm.userData.dentD || gm.userData.shown === dented) continue; obsDentApply(gm, dented); }
  const M = OBX_MODELS[OBX.cur]; if (M && M.gl) M.gl.mat.map = dented && M.hits ? M.gl.crack : M.gl.clean;
}
function obsApply() { // choose the obstacle for this machine, give the vehicle's physics its strengths, show it and hide the rest
  const id = LAB.machine === 'mix' && OBST[MIX.obs] ? MIX.obs : 'post', sp = OBST[id]; OBX.cur = id;
  CART.br = sp.r; CART.knockV = sp.knock; CART.bendV = sp.bend; CART.tumbleV = sp.tumble; CART.solid = !!sp.solid; CART.solidMax = sp.solidMax || Infinity; CART.obsH = sp.h; CART.obsCyls = sp.cyls || null;
  if (BOLLARD) BOLLARD.visible = labBol() && id === 'post';
  for (const k in OBX.built) for (const t in OBX.built[k].sets) OBX.built[k].sets[t].mesh.visible = false;
  if (labBol() && id !== 'post') obsPlace(id);
}
function obsStep(dt) { obsRockStep(dt); if (OBX.frag) OBX.frag.step(dt); if (OBX.shards) OBX.shards.step(dt); if (OBX.dust) OBX.dust.step(dt); const o = OBX.built[OBX.cur]; if (o && OBX.cur !== 'post') for (const t in o.sets) o.sets[t].step(dt); }
function obsHit(v) { // the vehicle has reached the obstacle at v m/s: it holds, gives, or is destroyed
  const sp = OBST[OBX.cur], o = OBX.built[OBX.cur], st = v >= sp.knock ? 2 : v >= sp.bend ? 1 : 0, p = clamp((v - sp.bend) / Math.max(1, sp.knock - sp.bend) * 0.8 + 0.2, 0.2, 0.95); if (!o) return;
  obsFx(sp, v, st);
  const go = o.blocks.map(() => st !== 0 && !(st === 1 && Math.random() > p && o.blocks.length > 1)), drop = [], stack = b => /^(brick|barrel)\d$|^cube$/.test(b.t);
  if (st === 1) { const order = o.blocks.map((b, i) => i).sort((a, b) => o.blocks[a].y - o.blocks[b].y); // bottom up: a brick or a barrel whose support was thrown away drops instead of hanging in the air
    for (const i of order) { const b = o.blocks[i]; if (go[i] || !stack(b) || b.y - b.sy / 2 < 0.06) continue; let ok = false; for (let j = 0; j < o.blocks.length && !ok; j++) { const r = o.blocks[j]; if (go[j] || j === i || !stack(r)) continue; const dy = b.y - r.y; if (dy > 0.02 && dy < Math.max(b.sy, r.sy) * 1.35 && Math.abs(b.x - r.x) < (b.sx + r.sx) * 0.45) ok = true; } if (!ok) { go[i] = true; drop[i] = true; } } }
  const brickWall = o.blocks.length > 0 && /^brick\d$/.test(o.blocks[0].t), grp = [], G = [];
  if (brickWall) { // a wall breaks in chunks: neighbours that were laid together fly together
    const ord = o.blocks.map((b, i) => i).filter(i => go[i] && !drop[i]).sort((a, b) => (o.blocks[a].y - o.blocks[b].y) || (o.blocks[a].x - o.blocks[b].x));
    for (const i of ord) { if (grp[i] !== undefined) continue; const sz = [1, 1, 2, 3, 4, 6][Math.floor(Math.random() * 6)], id = G.length, base = o.blocks[i]; grp[i] = id; let n = 1;
      for (const j of ord) { if (n >= sz) break; if (grp[j] !== undefined) continue; const c = o.blocks[j]; if (Math.abs(c.x - base.x) < 0.8 && Math.abs(c.y - base.y) < 0.45) { grp[j] = id; n++; } }
      const kk = sp.kick * (st === 1 ? 0.55 : 1) * rand(0.6, 1.1), calm = n > 1 ? 0.12 : 1, sw = 5 + v * 0.3;
      G.push({ n, v: [base.x * rand(0.8, 3) * (0.4 + v * 0.03) + rand(-1, 1), rand(1.2, 3.5) + v * 0.12 * sp.lift, -v * kk], w: [rand(-1, 1) * sw * calm, rand(-1, 1) * sw * calm, rand(-1, 1) * sw * calm] }); } }
  let flown = 0; for (let bi = 0; bi < o.blocks.length; bi++) { const b = o.blocks[bi];
    if (!go[bi]) continue; flown++; if (drop[bi]) { b.set.launch(b.i, rand(-0.3, 0.3), 0, -v * 0.02, rand(-2, 2), rand(-2, 2), rand(-2, 2)); continue; }
    if (brickWall) { const g = G[grp[bi]], pb = clamp(0.2 + v / 100, 0.2, 0.75) * (g.n === 1 ? 1 : 0.25); if (Math.random() < pb) { brickBreak(b, g); continue; } b.set.launch(b.i, g.v[0] + rand(-0.15, 0.15), g.v[1] + rand(-0.15, 0.15), g.v[2] + rand(-0.15, 0.15), g.w[0], g.w[1], g.w[2]); continue; }
    const k = sp.kick * (st === 1 ? 0.55 : 1) * rand(0.6, 1.1), dx = b.x, near = 1 - clamp((b.z + 0.5) / 1.5, 0, 1) * 0.2;
    b.set.launch(b.i, dx * rand(0.8, 3) * (0.4 + v * 0.03) + rand(-1, 1), (rand(1.2, 3.5) + v * 0.12 * sp.lift) * near, -v * k, rand(-1, 1) * (5 + v * 0.3), rand(-1, 1) * (5 + v * 0.3), rand(-1, 1) * (5 + v * 0.3));
  }
  const at = new V3(LAB_LANE, 0.6, BOLLARD_Z); if (flown) { burst(at, 30 + flown * 2, sp.splash || [[1.4, 1.2, 1.0], [2, 1.7, 1.2]], 4 + v * 0.1); }
  obsSound(sp.sound, st, v); if (sp.wheels) sp.wheels(v);
}

function obsFragSet() { if (!OBX.frag) { const cg = new THREE.IcosahedronGeometry(0.5, 0), pp = cg.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), t = Math.sin(x * 91.7 + y * 31.3 + z * 57.1) * 43758.5453, n = 0.62 + 0.5 * (t - Math.floor(t)); pp.setXYZ(i, x * n, y * n, z * n); } cg.computeVertexNormals();
    OBX.frag = new CanDebris(cg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), 200); OBX.frag.snd = 'stone'; OBX.frag.bnc = 0.25; OBX.frag.dragK = 0.03; OBX.frag.mesh.castShadow = true; } return OBX.frag; }
function brickBreak(b, g) { // a brick that does not survive: a couple of jagged chunks and some rubble, thrown the way its group was
  b.set.mesh.setMatrixAt(b.i, _cdZ); b.set.mesh.instanceMatrix.needsUpdate = true; b.set.life[b.i] = 0; b.set.mesh.visible = true;
  const F = obsFragSet(), wx = LAB_LANE + b.x, wz = BOLLARD_Z + b.z, n = 3 + Math.floor(Math.random() * 3), cols = [0xb3523a, 0xa84630, 0xc2654b, 0x9b3f2b, 0xc9bfae];
  for (let i = 0; i < n; i++) { const big = i < 2, sz = big ? rand(0.12, 0.24) : rand(0.04, 0.1), c = cols[Math.floor(Math.random() * (big ? 4 : 5))];
    F.spawn(wx + rand(-0.15, 0.15), b.y + rand(-0.06, 0.06), wz + rand(-0.06, 0.06), g.v[0] + rand(-2.5, 2.5), g.v[1] + rand(-1, 2), g.v[2] + rand(-2, 2), sz * rand(0.8, 1.4), sz * rand(0.55, 1), sz * rand(0.8, 1.3), 99999, c, false);
    F.fl[(F.next + F.N - 1) % F.N] = sz * 0.4; } }
function vehFx(v) { // the vehicle's own contribution to the crash
  const fx = VEH_DEFS[LAB_VEH].fx, at = [LAB_LANE, 0.5, BOLLARD_Z + 0.6]; if (!OBX.dust) OBX.dust = new CanTrail(260, false); const D = OBX.dust, n = Math.round(14 + v * 0.5);
  if (fx === 'water') { for (let i = 0; i < n * 1.4; i++) D.emit(at[0] + rand(-0.4, 0.4), at[1] + rand(0, 0.5), at[2] + rand(-0.6, 0.2), rand(-3, 3), rand(3, 7 + v * 0.1), -rand(0, 3 + v * 0.1), 0.25, 1.0 * rand(0.8, 1.4), rand(0.9, 1.5), 0.62, 0.8, 0.95, 0.5, 0.6); burst(new V3(at[0], at[1] + 0.3, at[2]), 70, [[0.7, 1.5, 3], [1.2, 2.2, 3.4], [2.5, 3, 3.4]], 5 + v * 0.1); }
  else if (fx === 'feathers') { for (let i = 0; i < n; i++) D.emit(at[0] + rand(-0.6, 0.6), at[1] + rand(0, 0.6), at[2] + rand(-0.5, 0.3), rand(-2.5, 2.5), rand(1.5, 5), -rand(0, 2 + v * 0.06), 0.25, 0.9 * rand(0.8, 1.3), rand(1.4, 2.4), 0.95, 0.93, 0.88, 0.55, 0.35); }
  else burst(new V3(at[0], at[1] + 0.2, at[2]), 30 + v, SPARK, 5 + v * 0.1);
}
function obsFx(sp, v, st) { // dust, pulp, splash: what comes out of the obstacle depends on what it is made of
  if (!st) return; const at = [LAB_LANE, 0.5, BOLLARD_Z]; if (!OBX.dust) OBX.dust = new CanTrail(260, false); const D = OBX.dust, n = Math.round(10 + v * 0.45);
  const puff = (rgb, a, s0, s1, life, k) => { for (let i = 0; i < n * k; i++) D.emit(at[0] + rand(-1, 1), at[1] + rand(0, 0.8), at[2] + rand(-0.4, 0.4), rand(-2.5, 2.5), rand(0.5, 3), -rand(1, 4 + v * 0.1), s0, s1 * rand(0.8, 1.3), life * rand(0.7, 1.2), rgb[0], rgb[1], rgb[2], a, 1.1); };
  if (sp.fx === 'dust') puff([0.62, 0.56, 0.5], 0.55, 0.5, 2.4, 1.6, 1); else if (sp.fx === 'paper') puff([0.85, 0.78, 0.65], 0.4, 0.3, 1.2, 1.0, 0.7); else if (sp.fx === 'juice') puff([0.75, 0.12, 0.18], 0.55, 0.3, 1.3, 0.9, 0.9); else if (sp.fx === 'splash') puff([0.12, 0.09, 0.07], 0.5, 0.3, 1.1, 0.8, 0.6); else if (sp.fx === 'sand') puff([0.78, 0.66, 0.42], 0.5, 0.3, 1.8, 1.4, 1);
}
function obsTear(dt) { // a hard obstacle tears limbs off on hard knocks, a soft one does not (the threshold is the obstacle's own)
  const S = RAGSIM, sp = OBST[OBX.cur]; if (!S || OBX.cur === 'post' || sp.hard > 90 || S.t > 4) return; const c = S.core, I = S.I; OBX.cool = OBX.cool || {}; OBX.psp = OBX.psp || {};
  for (const nm in STR_LIMB) { const g = STR_LIMB[nm]; OBX.cool[g] = (OBX.cool[g] || 0) - dt; const k = I[nm] * 3, sv = Math.hypot(c.x[k] - c.o[k], c.x[k + 1] - c.o[k + 1], c.x[k + 2] - c.o[k + 2]) * 240, drop = (OBX.psp[nm] ?? sv) - sv; OBX.psp[nm] = sv;
    if (drop > sp.hard && OBX.cool[g] <= 0 && !c.broken.includes(g)) { OBX.cool[g] = 0.3; if (Math.random() < Math.min(0.75, (drop - sp.hard) / 14)) c.breakGroup(g); } }
}
function bodyHit(speed, floor) { // Daggie's body meeting the floor or the obstacle: a dull thud, with a metal clank on a truck or a car (at most ~14 a second)
  if (!AC || speed < 2.5) return; const t = AC.currentTime; if (t - (bodyHit.t || 0) < 0.07) return; bodyHit.t = t;
  const p = clamp(speed / 40, 0.1, 1), mt = OBX.cur !== 'post' && OBST[OBX.cur] ? OBST[OBX.cur].sound : '', metal = !floor && (mt === 'truck' || mt === 'car' || mt === 'barrel' || mt === 'concrete'); OUT(); SND_WIDE = 0.5;
  try { if (sfxPlay(floor ? 'thud' : 'body', 0.35 + 0.65 * p, floor ? 0.85 : 1, 0.2)) return; sweep(t, 140 + 60 * p, 45, 0.1 + 0.12 * p, 0.12 + 0.3 * p, 'sine'); noise(t, 0.06 + 0.06 * p, 0.1 + 0.25 * p, 'lowpass', 600 + 900 * p, 150, 0.8);
    if (metal) { ping(t, rand(320, 760), 0.25, 0.02 + 0.05 * p); noise(t, 0.015, 0.08 * p, 'highpass', 4000, 2500, 0.7); } } finally { SND_WIDE = 0; }
}
function obsSound(kind, st, v) {
  const p = clamp(v / 45, 0.15, 1); if (!AC) return; OUT(); const t = AC.currentTime;
  if (kind === 'box') { if (sfxPlay('thud', 0.8, 1.1, 0.2)) return; noise(t, 0.2, 0.3, 'lowpass', 900, 150, 0.7); for (let i = 0; i < 10; i++) noise(t + Math.random() * 0.5, 0.05, 0.1, 'bandpass', rand(500, 1400), 400, 2); sweep(t, 110, 50, 0.2, 0.3, 'sine'); }
  else if (kind === 'melon') { noise(t, 0.25, 0.35, 'bandpass', 700, 250, 1.2); noise(t, 0.12, 0.25, 'lowpass', 1500, 300, 0.8); sweep(t, 160, 60, 0.18, 0.3, 'sine'); for (let i = 0; i < 6; i++) noise(t + 0.05 + Math.random() * 0.3, 0.07, 0.12, 'bandpass', rand(300, 900), 200, 1.5); }
  else if (kind === 'truck') { if (!sfxPlay(['truck', 'metal'], 0.9, 0.65, 0.25)) { matSound('metal', 1, 0.6); sweep(t, 55, 24, 0.7, 0.45, 'sine'); noise(t, 0.3, 0.4, 'lowpass', 400, 100, 0.8); noiseDist(t, 0.25, 0.3, 1800, 200, 1.1); }
    if (v > 12 && !sfxPlay('sand', 0.7, 1, 0.1)) { noise(t + 0.12, 1.2 + p, 0.16 * p + 0.04, 'bandpass', 3800, 1400, 0.9); for (let i = 0; i < 14; i++) noise(t + 0.3 + Math.random() * 1.2, 0.04, 0.05, 'highpass', 5000, 3000, 0.7); } } // the sand shifting and pouring over the edge
  else if (kind === 'car') { if (!sfxPlay(['car', 'metal'], 0.9, 0.8, 0.25)) { matSound('metal', 1, 0.8); noiseDist(t, 0.2, 0.3, 2200, 260, 1.1); sweep(t, 90, 40, 0.25, 0.3, 'sine'); } if (v > 12) glassSound(1.3); for (let i = 0; i < 6; i++) noise(t + 0.1 + Math.random() * 0.6, 0.05, 0.1, 'bandpass', rand(1500, 4000), 800, 3); }
  else if (kind === 'tires') { if (!sfxPlay('tires', 0.9, 1, 0.2)) { noise(t, 0.25, 0.4, 'lowpass', 500, 120, 0.9); sweep(t, 95, 40, 0.28, 0.35, 'sine'); for (let i = 0; i < 5; i++) noise(t + Math.random() * 0.5, 0.07, 0.12, 'bandpass', rand(200, 600), 200, 1.5); } if (v > 8) noise(t, 0.35, 0.08, 'bandpass', 1900, 900, 4); } // and the squeak of rubber on rubber
  else if (kind === 'barrel') matSound('metal', 1, 0.55); else if (kind === 'brick') matSound('brick', p, 1); else if (kind === 'concrete') { matSound('stone', 1, 0.8); sweep(t, 70, 28, 0.5, 0.4, 'sine'); }
  else if (kind === 'pins') for (let i = 0; i < 12; i++) { const tt = t + Math.pow(Math.random(), 1.4) * 0.7, f = rand(700, 1400); noise(tt, 0.04, 0.2, 'bandpass', f, f * 0.6, 3); ping(tt, f * 1.3, 0.05, 0.04); }
}

function mixPickVis(on) { const el = MIX.el; if (!el) { if (!on || LAB.machine !== 'mix') return; mixPickUI(); } MIX.el.style.display = on && LAB.machine === 'mix' ? 'flex' : 'none'; }
function mixPickUI() { // three small cards in one row: VEHICLE, OBSTACLE, PLACE; tap the arrows or the name to change
  const el = document.createElement('div'); el.id = 'mixPick'; el.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 118px);z-index:8;display:none;gap:6px;width:min(95vw,440px);font:700 12px "Chakra Petch",ui-sans-serif,sans-serif;color:#fff;pointer-events:auto';
  const save = () => { try { localStorage.setItem('daggie-mix', JSON.stringify({ veh: MIX.veh, obs: MIX.obs, loc: MIX.loc, txt: MIX.txt })); } catch (x2) { /* private mode */ } };
  const mk = (key, cap, list, names) => { const card = document.createElement('div'); card.style.cssText = 'flex:1;min-width:0;display:flex;align-items:stretch;background:rgba(14,16,30,.74);border:1.5px solid rgba(255,255,255,.5);border-radius:12px;overflow:hidden'; const mid = document.createElement('div'); mid.style.cssText = 'flex:1;min-width:0;text-align:center;padding:5px 2px;line-height:1.12;display:flex;flex-direction:column;justify-content:center;gap:1px;cursor:pointer;user-select:none;-webkit-user-select:none';
    const go = d => { const i = (list.indexOf(MIX[key]) + d + list.length) % list.length; MIX[key] = list[i]; save(); mixApply(); };
    const arrow = d => { const x = document.createElement('div'); x.textContent = d < 0 ? '\u2039' : '\u203a'; x.style.cssText = 'width:24px;display:flex;align-items:center;justify-content:center;font-size:22px;background:rgba(255,255,255,.13);user-select:none;-webkit-user-select:none;cursor:pointer'; x.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); go(d); }); return x; };
    mid.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); go(1); }); card.append(arrow(-1), mid, arrow(1)); el.appendChild(card);
    return () => { mid.innerHTML = '<span style="font-size:9px;opacity:.72;letter-spacing:1.4px">' + cap + '</span><span style="font-size:11.5px;letter-spacing:.2px">' + names(MIX[key]) + '</span>'; }; };
  MIX.upd = [mk('veh', 'VEHICLE', VEH_ORDER, k => VEH_DEFS[k].name), mk('obs', 'OBSTACLE', OBS_ORDER, k => OBST[k].name), mk('loc', 'PLACE', LOC.order, k => LOCS[k].name)];
  stage.appendChild(el); MIX.el = el; MIX.upd.forEach(f => f());
}
function mixApply() { MIX.upd && MIX.upd.forEach(f => f()); if (LAB.machine !== 'mix') return; if (MIX.obs === 'hatch') hatchLoad(); locApply(MIX.loc); labVehicle(MIX.veh); obsApply(); board.visible = true; labCartReset(); }
function warmDebris() { // every part that can fly is shown for one compile, so the shaders exist before the crash
  try { const hid = [], on = m => { if (m && !m.visible) { hid.push(m); m.visible = true; } }; for (const d of CDEB.list) on(d.m); if (OBX.shards) on(OBX.shards.mesh); if (OBX.frag) on(OBX.frag.mesh); const o = OBX.built[OBX.cur]; if (o) for (const t in o.sets) on(o.sets[t].mesh); renderer.compile(scene, camera); for (const m of hid) m.visible = false; } catch (e) { /* a missing warm-up is only a hitch */ } }
function labCartReset() {
  cartDebrisBuild(); cartDebrisReset();
  const cage = board.getObjectByName('cage'); if (cage && cage.geometry.userData.orig) { cage.geometry.attributes.position.array.set(cage.geometry.userData.orig); cage.geometry.attributes.position.needsUpdate = true; cage.geometry.computeVertexNormals(); }
  for (const w of wheels) w.visible = true; { const plate = board.getObjectByName('plate'); if (plate && plate.userData.home) { plate.position.copy(plate.userData.home); plate.rotation.set(0, Math.PI, 0); plate.visible = true; } }
  CART.box.zf = CART.zf0; LABCART.hit = false; CART.place(BOLLARD_Z + CART.br + 7.5); CART.vz = 0; labCartPlace(); if (OBX.cur !== 'post' && labBol()) obsPlace(OBX.cur);
  bollardFall(0); LAB.bollardTip = 0; warmDebris();
}
function labImpact() {
  const v = LABCART.v; LAB.impV = v;  LABCART.hit = true; CART.impact(v);
  const dd = OBX.cur === 'post' || OBST[OBX.cur].solid ? labDent(v) : 0; CART.box.zf = CART.zf0 + dd * CART_S * 0.75; /* a soft obstacle does not crumple the cart */ // the crumpled front wires are a wall further back now
  if (OBX.cur !== 'post') { obsDeform(v); obsRockStart(v); }
  const vR = OBX.cur !== 'post' && CART.knocked ? v * Math.sqrt(Math.max(0.05, 1 - (OBST[OBX.cur].absorb || 0) / (v * v))) : v; // an obstacle that is destroyed takes some of his speed
  ragStart(new V3(0, 0, -vR), CART.plow ? Math.min(vR, 9) : vR); // ploughing through something soft is not a crash: he keeps sitting and lurches
  const post = OBX.cur === 'post'; if (v >= 8) vehFx(v);
  if (!post) obsHit(v);
  else if (CART.knocked) { LAB.bollardTip = 0.001; LAB.tipYaw = rand(-0.25, 0.25); }
  else if (CART.bent) { LAB.bollardTip = 0.001; LAB.tipYaw = rand(-0.1, 0.1); }
  const bp = new V3(LAB_LANE, 0.8, BOLLARD_Z); if (post || OBST[OBX.cur].sound === 'barrel' || OBST[OBX.cur].sound === 'concrete') burst(bp, 60 + v * 2, SPARK, 6 + v * 0.1); crashSound(clamp(v / 89 * (post ? 1 : 0.6), 0.1, 1)); if (v >= 22) hitStopUntil = performance.now() + 70;
  if (!reduceMotion) shake = Math.min(0.9, 0.2 + v * 0.012);
  if (!reduceMotion && v >= 22) { const fl = document.createElement('div'); fl.className = 'flash'; stage.appendChild(fl); setTimeout(() => fl.remove(), 350); } // white flash on a hard hit
  slowUntil = performance.now() + 1200; slowK = 0.3; sndSlow(true); setTimeout(() => sndSlow(false), 1300); setFace('hit', 99999);
}
function labBollardOutcome() {
  const S = RAGSIM, c = S.core, torn = c.broken.length, inCart = c.inCart[S.I.pel], held = c.pins.some(p => p.on);
  const txt = inCart ? (S.maxY - S.seatY > 0.3 ? 'almost flew out' : 'stayed in the ' + VEH_DEFS[LAB_VEH].noun) : held ? 'flew out but held on' : 'was thrown out';
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
  g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(cv); t.flipY = bodyTex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t;
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
.dlvhud{position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 6px);width:max-content;white-space:nowrap;background:rgba(11,7,32,.62);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:5px 12px 6px;z-index:6;display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;font-family:"Chakra Petch",ui-sans-serif,sans-serif}
.recmode.playing .dlvhud,.recmode.filming .dlvhud{top:calc(env(safe-area-inset-top,0px) + 6px)}
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
const LAB_SPEEDS = [15, 50, 100, 150, 200]; // mph for levels 1..5. The post holds on 1-2 and snaps on 3-5; Daggie doesn't grip the cart
const LAB_MAX = () => (labBol() ? LAB_SPEEDS.length : LAB.machine === 'stairs' ? STAIRS_STEPS.length : LAB.machine === 'press' || LAB.machine === 'cannon' ? 5 : 100);
const LAB_INFO = {
  bollard: { title: 'CART vs BOLLARD', ask: 'How fast before he flies out?' },
  tub: { title: 'BATHTUB vs BOLLARD', ask: 'How fast before he flies out of the bath?' },
  fart: { title: 'FART POWER', ask: 'How high does he fly?' },
  sock: { title: 'SOCK SIZE', ask: 'How big a foot can he take?' },
  anvil: { title: 'ANVIL HEIGHT', ask: 'From how high does it break him?' },
  press: { title: 'HYDRAULIC PRESS', ask: 'How many tons can he take?' },
  cannon: { title: 'WALL CANNON', ask: 'How many walls can he break?' },
  stairs: { title: 'STAIRS', ask: 'How many steps can he survive?' },
  mix: { title: 'CRASH MIX', ask: 'Pick a vehicle and an obstacle' },
};
if (Array.isArray(L.machines) && !L.machines.includes('press') && !L.machines.every(m => m === 'bollard')) L.machines.push('press'); // the press joins the stand lab
if (Array.isArray(L.machines) && L.machines.length && L.machines.every(m => m === 'bollard') && !L.machines.includes('cannon')) { L.machines.push('cannon'); L.machines.push('stairs'); } // the wall cannon and the stairs join the cart hall
if (Array.isArray(L.machines) && L.machines.includes('bollard') && !L.machines.includes('tub') && VEH === 'cart') L.machines.splice(L.machines.indexOf('bollard') + 1, 0, 'tub', 'mix'); // and so do the bathtub and the pick-anything mode
const LAB = { machine: (L.machines || ['fart']).find(m => m !== 'bollard' && m !== 'tub' && m !== 'stairs') || 'mix', level: 1, phase: 'idle', t: 0, h: 0, v: 0, spin: 0, lost: 0, text: '', pending: 0, exploded: false };
try { const sv = JSON.parse(localStorage.getItem('daggie-lab') || '{}'); if (LAB_INFO[sv.m] && sv.m !== 'bollard' && sv.m !== 'tub' && sv.m !== 'stairs') LAB.machine = sv.m; if (sv.l >= 1 && sv.l <= 100) LAB.level = sv.l; if (LAB.machine === 'bollard') LAB.level = Math.min(LAB.level, LAB_SPEEDS.length); if (LAB.machine === 'press' || LAB.machine === 'cannon') LAB.level = Math.min(LAB.level, 5); if (LAB.machine === 'stairs') LAB.level = Math.min(LAB.level, 3); } catch (e) {} // (3 = the number of stair levels; the table is defined further down)
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
// ---------- locations: the same crash lab lane in a desert, in snow, in a night city or in a quarry ----------
var LOC = { cur: 'hall', exp: 1, order: ['hall', 'desert', 'snow', 'night', 'quarry'], built: {}, mats: {}, envs: {}, hall: null, vis: null, keep: null, floor: null, floorMat: null, hallSet: null };
var LOCS = {
  hall: { name: 'CRASH LAB' },
  desert: { name: 'DESERT', el: 62, az: 35, turb: 6, ray: 1.0, mie: 0.004, fog: [0xe6cf9f, 140, 900], sun: [0xffe3b0, 3.4], hemi: [0xffefcf, 0xa88a58, 0.62], exp: 1.0 },
  snow: { name: 'SNOW', el: 26, az: 20, turb: 1.6, ray: 2.4, mie: 0.002, fog: [0xdfe9f4, 70, 560], sun: [0xeaf1ff, 2.5], hemi: [0xdce9ff, 0xaab6c8, 0.8], exp: 0.95 },
  night: { name: 'NIGHT CITY', el: -9, az: 30, turb: 2, ray: 0.3, mie: 0.002, fog: [0x0b0f1d, 50, 460], sun: [0x93acff, 1.1], hemi: [0x34467a, 0x181b27, 0.75], exp: 1.25 },
  quarry: { name: 'QUARRY', el: 40, az: 70, turb: 9, ray: 1.4, mie: 0.006, fog: [0xd5bfa0, 90, 650], sun: [0xffd9a0, 3.0], hemi: [0xf0dcc0, 0x7a6a55, 0.6], exp: 1.0 } };
var LOC_GLSL = [
  'varying vec3 vLocPos; uniform vec4 uLoc;',
  'float lhash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
  'float lnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(lhash(i), lhash(i + vec3(1.,0.,0.)), f.x), mix(lhash(i + vec3(0.,1.,0.)), lhash(i + vec3(1.,1.,0.)), f.x), f.y), mix(mix(lhash(i + vec3(0.,0.,1.)), lhash(i + vec3(1.,0.,1.)), f.x), mix(lhash(i + vec3(0.,1.,1.)), lhash(i + vec3(1.,1.,1.)), f.x), f.y), f.z); }',
  'float lfbm3(vec3 p){ return 0.5 * lnoise(p) + 0.25 * lnoise(p * 2.03) + 0.125 * lnoise(p * 4.1); }',
  'float lfbm2(vec3 p){ return 0.6 * lnoise(p) + 0.3 * lnoise(p * 2.7); }'].join('\n');
var LOC_COLOR = 'float lfade = 1.0 - smoothstep(30.0, 90.0, length(vViewPosition)); { float lm = lfbm3(vLocPos * uLoc.x); float lf = lfbm3(vLocPos * uLoc.z); diffuseColor.rgb *= 1.0 + (lm - 0.5) * 2.0 * uLoc.y + (lf - 0.5) * 0.7 * lfade; }';
var LOC_NORMAL = 'if (lfade > 0.02) { vec3 lp = vLocPos * uLoc.z; float l0 = lfbm2(lp); vec3 lg = vec3(lfbm2(lp + vec3(0.12, 0., 0.)) - l0, lfbm2(lp + vec3(0., 0.12, 0.)) - l0, lfbm2(lp + vec3(0., 0., 0.12)) - l0); vec3 lgv = (viewMatrix * vec4(lg, 0.0)).xyz; normal = normalize(normal - uLoc.w * lfade * (lgv - dot(lgv, normal) * normal)); }';
function locDetail(mat, macroScale, macroStrength, fineScale, bump) { /* surface detail that does not depend on texture coordinates: broad colour variation (no visible tiling) and a fine relief, both from the position in the world, fading out with distance */
  mat.onBeforeCompile = sh => { sh.uniforms.uLoc = { value: new THREE.Vector4(macroScale, macroStrength, fineScale, bump) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LOC_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\n' + LOC_COLOR).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + LOC_NORMAL); };
  mat.customProgramCacheKey = () => 'locdetail1'; return mat; }

function locRng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// ---------- ground that is not flat: smooth hills, dunes, benches of a quarry (a real surface under every place) ----------
const lsstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function lh2(ix, iz) { const h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453; return h - Math.floor(h); }
function ln2(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz), a = lh2(ix, iz), b = lh2(ix + 1, iz), c = lh2(ix, iz + 1), d = lh2(ix + 1, iz + 1); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
function lfb2(x, z, o) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * ln2(x * f, z * f); n += a; f *= 2.03; a *= 0.5; } return s / n; }
function lterr(h, step, k) { const t = h / step, f = Math.floor(t), r = t - f; return (f + lsstep(1 - k, 1, r)) * step; } // flat benches with steep risers
const LOC_H = {
  desert: (x, z) => { const ax = Math.abs(x), e = lsstep(10, 36, ax); let h = (lfb2(x * 0.011 + 3.1, z * 0.011 + 7.7, 4) - 0.4) * 26 * e; h += (lfb2(x * 0.06, z * 0.06, 3) - 0.5) * 1.8 * e; h += Math.sin(x * 0.7 + lfb2(x * 0.05, z * 0.05, 2) * 6) * 0.1 * e * lsstep(10, 22, ax);
    const mm = lsstep(130, 210, ax); if (mm > 0) h += lterr(lfb2(x * 0.007 + 9, z * 0.007 + 2, 4) * 90, 16, 0.3) * mm; return h; },
  snow: (x, z) => { const ax = Math.abs(x), e = lsstep(9, 34, ax); let h = (lfb2(x * 0.009 + 1.3, z * 0.009 + 4.4, 4) - 0.42) * 20 * e + (lfb2(x * 0.05, z * 0.05, 3) - 0.5) * 2.4 * e; const mm = lsstep(170, 310, ax); if (mm > 0) { const r = 1 - Math.abs(lfb2(x * 0.006 + 5, z * 0.006 + 8, 4) * 2 - 1); h += Math.pow(r, 1.25) * 125 * mm; } return h; },
  quarry: (x, z) => { const ax = Math.abs(x), w = lsstep(22, 58, ax); const base = w * 48 + (lfb2(x * 0.03, z * 0.03, 3) - 0.45) * 16 * w; let h = lterr(Math.max(0, base), 7.5, 0.26); h += (lfb2(x * 0.13, z * 0.13, 3) - 0.5) * 1.2 * lsstep(9, 30, ax); return h; } };
const LOC_ZONES = { desert: [[-22, -38, 6], [25, -150, 6], [30, -90, 4], [-28, -100, 4]], snow: [[-26, -45, 6], [30, -170, 6]], quarry: [] };
function locHeight(id) { const base = LOC_H[id], zs = (LOC_ZONES[id] || []).map(([x, z, r]) => [x, z, r, base(x, z)]); return (x, z) => { let h = base(x, z); for (const [zx, zz, r, hc] of zs) { const d = Math.hypot(x - zx, z - zz); if (d < r * 1.7) { const m = 1 - lsstep(r * 0.8, r * 1.7, d); h = h * (1 - m) + hc * m; } } return h; }; }
function locTerrainColor(id, c, x, z, h, sl) { /* what the ground is made of at this point: sand and strata, snow and forest, quarry benches */
  const c2 = locTerrainColor.c2 || (locTerrainColor.c2 = new THREE.Color()), c3 = locTerrainColor.c3 || (locTerrainColor.c3 = new THREE.Color()), n = lfb2(x * 0.04 + 5, z * 0.04, 3), n2 = lfb2(x * 0.17, z * 0.17 + 3, 2), ax = Math.abs(x);
  if (id === 'desert') { c.setHex(0xdcc08d).lerp(c2.setHex(0xc5a56b), n); c.lerp(c2.setHex(0xefd9a8), lsstep(0.55, 0.8, n2) * 0.35); const t = lsstep(0.5, 1.0, sl), strata = 0.5 + 0.5 * Math.sin(h * 2.2 + n * 5); c3.setHex(0xb06a3c).lerp(c2.setHex(0x86502f), strata); c.lerp(c3, t); if (ax > 130) c.lerp(c2.setHex(0xc98a55), lsstep(20, 60, h) * 0.4 * (1 - t)); }
  else if (id === 'snow') { c.setHex(0xf4f7fb).lerp(c2.setHex(0xc7d6eb), (1 - lsstep(-3, 5, h)) * 0.55 + n2 * 0.12); const forest = lsstep(36, 90, ax) * (1 - lsstep(70, 150, h)) * lsstep(0.42, 0.58, n); c.lerp(c2.setHex(0x1f4a35), forest * 0.85); c.lerp(c2.setHex(0x2d5a43), forest * n2 * 0.35); const t = lsstep(1.0, 1.7, sl) * 0.7 * (1 - lsstep(90, 170, h) * 0.6); c.lerp(c2.setHex(0x6d7587), t); }
  else { const floor = 1 - lsstep(2, 7, h); c.setHex(0x8f7f68).lerp(c2.setHex(0x6e604e), n); c.lerp(c2.setHex(0xa89880), n2 * 0.4); const band = Math.floor(h / 7.5 + 0.5), pal = [0xb09a78, 0x9a8466, 0xa88f6a, 0x8a7a62, 0xbaa482]; c3.setHex(pal[((band % 5) + 5) % 5]).lerp(c2.setHex(0x756650), n * 0.5); const wall = lsstep(0.45, 0.95, sl); c.lerp(c3, (1 - floor) * (0.45 + 0.55 * wall)); c.lerp(c2.setHex(0xcdb78e), (1 - wall) * (1 - floor) * 0.3); c.multiplyScalar(1 - 0.28 * wall); } }
function locTerrainTex(id) { return tex(512, 512, (g, w, h) => { g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, w, h);
  const blob = (r, a, light) => { const x = Math.random() * w, y = Math.random() * h; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { const rg = g.createRadialGradient(x + dx, y + dy, 1, x + dx, y + dy, r); rg.addColorStop(0, light ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a + ')'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); } };
  for (let i = 0; i < 60; i++) blob(20 + Math.random() * 60, 0.07, Math.random() < 0.5);
  if (id === 'desert') { g.strokeStyle = 'rgba(70,50,30,0.14)'; g.lineWidth = 2; for (let y = 6; y < h; y += 17) { g.beginPath(); for (let x = 0; x <= w; x += 12) g.lineTo(x, y + Math.sin(x * 0.045 + y) * 3.5); g.stroke(); } for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(60,40,20,0.25)' : 'rgba(255,255,255,0.35)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(80,60,40,0.5)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * 3, 0, 6.283); g.fill(); } }
  else if (id === 'snow') { for (let i = 0; i < 1100; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(120,150,190,0.3)' : 'rgba(255,255,255,0.9)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } g.strokeStyle = 'rgba(110,140,185,0.13)'; g.lineWidth = 3; for (let y = 10; y < h; y += 26) { g.beginPath(); for (let x = 0; x <= w; x += 14) g.lineTo(x, y + Math.sin(x * 0.03 + y * 0.2) * 5); g.stroke(); } }
  else { for (let i = 0; i < 6500; i++) { const x = Math.random() * w, y = Math.random() * h, rx = 0.6 + Math.random() * 1.7, ry = 0.5 + Math.random() * 1.2, a = Math.random() * 3; g.fillStyle = Math.random() < 0.5 ? 'rgba(50,38,26,0.2)' : 'rgba(255,245,225,0.24)'; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 6.283); g.fill(); } } }); }
function locTerrain(id, H) { /* one smooth mesh from the lane out to the horizon: dense near the lane, wide further away, coloured by what the ground is made of */
  const NX = 140, NZ = 120, X = [], Z = []; for (let i = 0; i < NX; i++) { const u = (i / (NX - 1)) * 2 - 1, t = Math.abs(u); X.push(Math.sign(u) * (t <= 0.5 ? t / 0.5 * 80 : 80 + Math.pow((t - 0.5) / 0.5, 1.6) * 320)); } /* fine close to the lane, wide further out */ for (let j = 0; j < NZ; j++) Z.push(90 - 1150 * Math.pow(j / (NZ - 1), 1.6));
  const pos = new Float32Array(NX * NZ * 3), col = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2), c = new THREE.Color(), hg = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) hg[j * NX + i] = H(X[i], Z[j]);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i, x = X[i], z = Z[j], h = hg[k], i0 = Math.max(0, i - 1), i1 = Math.min(NX - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(NZ - 1, j + 1);
    const gx = (hg[j * NX + i1] - hg[j * NX + i0]) / (X[i1] - X[i0]), gz = (hg[j1 * NX + i] - hg[j0 * NX + i]) / (Z[j1] - Z[j0]), sl = Math.min(2, Math.hypot(gx, gz)); locTerrainColor(id, c, x, z, h, sl);
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; uv[k * 2] = x / 6; uv[k * 2 + 1] = z / 6; }
  const idx = []; for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, d = a + NX, e = d + 1; idx.push(a, b, d, b, e, d); /* counter-clockwise seen from above (z runs towards the horizon), so the ground faces up */ }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const t = locTerrainTex(id); t.wrapS = t.wrapT = THREE.RepeatWrapping; const m = new THREE.Mesh(g, locDetail(new THREE.MeshStandardMaterial({ vertexColors: true, map: t, roughness: id === 'snow' ? 0.82 : 0.97 }), 0.03, id === 'quarry' ? 0.16 : 0.12, 2.2, id === 'quarry' ? 0.55 : 0.4)); m.receiveShadow = true; m.frustumCulled = false; return m; }
function locRock2(R, det) { /* a boulder: ridged and uneven, flat underneath, lumpy on top */
  const g = new THREE.IcosahedronGeometry(1, det === undefined ? 2 : det), pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const a = pp.getX(i), b = pp.getY(i), c = pp.getZ(i), n = lfb2(a * 2.1 + 9, c * 2.1 + b * 1.7, 3), q = 1 - Math.abs(lfb2(a * 3.3 + 4, b * 3.3 + c * 2, 2) * 2 - 1), r = 0.7 + 0.6 * n + 0.12 * q; pp.setXYZ(i, a * r, Math.max(b * r * (0.85 + 0.2 * q), -0.3), c * r); } g.computeVertexNormals(); return g; }
// ---------- better shapes: ribbed cacti, an excavator with a real boom, textured containers and sheds, concrete barriers, rounded cars ----------
function locBoxUV(g, w, h, d, tile) { /* make the texture of a box tile at a fixed size in metres (so planks and windows keep their size on any wall) */
  const nn = g.attributes.normal, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nn.getX(i)), ny = Math.abs(nn.getY(i)); const fw = nx > 0.5 ? d : w, fh = ny > 0.5 ? d : h; uv.setXY(i, uv.getX(i) * fw / tile, uv.getY(i) * fh / tile); } return g; }
function locCylBetween(y0, z0, y1, z1, r, len0) { /* a cylinder lying in the symmetry plane from (y0,z0) to (y1,z1) */ const dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dy, dz), g = new THREE.CylinderGeometry(r, r, L, 10); g.rotateX(Math.atan2(dz, dy)); g.translate(0, (y0 + y1) / 2, (z0 + z1) / 2); return g; }
function locExtrudeSide(pts, depth, bev) { /* a plate cut to the side profile [forward, up], thick across the machine; forward is -z */ const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: !!bev, bevelSize: bev || 0, bevelThickness: bev || 0, bevelSegments: 1, curveSegments: 4 }); g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2); return g; }
function locCactus(P, x, z, s, h, col) { /* a saguaro: a ribbed trunk with a rounded top and arms that leave sideways and curve up */
  const out = [], pts = [], N = 12; for (let i = 0; i <= N; i++) { const t = i / N, r = (t < 0.05 ? 0.2 + 0.1 * t / 0.05 : t > 0.88 ? 0.3 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.88) / 0.12, 2))) : 0.3) * s; pts.push(new THREE.Vector2(Math.max(0.002, r), t * h * s)); }
  const g = new THREE.LatheGeometry(pts, 16), pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const px = pp.getX(i), pz = pp.getZ(i), a = Math.atan2(pz, px), rib = 1 + 0.1 * Math.cos(a * 8); pp.setXYZ(i, px * rib, pp.getY(i), pz * rib); } g.computeVertexNormals(); out.push(P(g, col, x, 0, z));
  for (const sd of [-1, 1]) if (lh2(Math.round(x * 7) + sd * 3, Math.round(z * 5)) < 0.72) { const a0 = (0.34 + lh2(Math.round(z * 3), sd + 5) * 0.3) * h * s, len = (0.7 + lh2(Math.round(x * 5), Math.round(z) + sd) * 0.9) * s, curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sd * 0.2 * s, a0, 0), new THREE.Vector3(sd * 0.6 * s, a0 + 0.02 * s, 0), new THREE.Vector3(sd * 0.86 * s, a0 + 0.3 * s, 0), new THREE.Vector3(sd * 0.88 * s, a0 + 0.3 * s + len, 0)]), tg = new THREE.TubeGeometry(curve, 10, 0.14 * s, 8, false), cap = new THREE.IcosahedronGeometry(0.14 * s, 0); cap.translate(sd * 0.88 * s, a0 + 0.3 * s + len, 0); out.push(P(tg, col, x, 0, z), P(cap, col, x, 0, z)); }
  return out; }
function locExcavator(P, x, z, ry) { /* tracks with shoes and rollers, a house with a cab, a boom bent in two, a stick, a bucket with teeth and hydraulic rams */
  const Y = 0xe2a31a, D = 0x2a2a2e, ST = 0x6c7078, CH = 0xb8bcc2, RB = 0x1c1c1e, GL = 0x15202a, out = [], add = (g, col, gr) => out.push(P(g, col, x, 0, z, 0, ry, 0, undefined, undefined, undefined)), rb = (w, hh, d, r) => obxBox(w, hh, d, r, 9, 9, 9), at = (g, ax, ay, az) => g.translate(ax, ay, az);
  for (const sx of [-1, 1]) { const tx = sx * 1.45; add(at(rb(0.85, 0.92, 4.7, 0.3), tx, 0.5, 0), RB); for (let k = -11; k <= 11; k++) add(at(new THREE.BoxGeometry(0.9, 0.07, 0.17), tx, 0.98 - Math.abs(k) * 0.0, k * 0.2), 0x2c2c30); add(at(new THREE.BoxGeometry(0.18, 0.7, 4.3), tx + sx * 0.5, 0.5, 0), D); for (const rz of [-1.7, -0.85, 0, 0.85, 1.7]) { const w = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 14); w.rotateZ(Math.PI / 2); add(at(w, tx + sx * 0.47, 0.3, rz), ST); } for (const rz of [-2.1, 2.1]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 16); w.rotateZ(Math.PI / 2); add(at(w, tx + sx * 0.47, 0.5, rz), D); } }
  add(at(rb(2.4, 0.5, 3.4, 0.12), 0, 0.85, 0), 0x3c3c42); const ring = new THREE.CylinderGeometry(1.3, 1.3, 0.22, 24); add(at(ring, 0, 1.2, 0), ST);
  add(at(rb(3.1, 1.35, 3.6, 0.2), 0, 1.98, 0.35), Y); add(at(rb(3.1, 1.25, 1.0, 0.18), 0, 1.93, 2.35), 0x2e2e32); // house and counterweight
  add(at(rb(1.55, 1.75, 1.55, 0.14), -0.72, 3.05, -0.85), Y); add(at(new THREE.BoxGeometry(1.4, 1.2, 0.06), -0.72, 3.15, -1.65), GL); add(at(new THREE.BoxGeometry(0.06, 1.15, 1.2), -1.52, 3.15, -0.85), GL); add(at(new THREE.BoxGeometry(0.06, 1.15, 1.2), 0.08, 3.15, -0.85), GL); add(at(rb(1.8, 0.1, 1.9, 0.04), -0.72, 4.0, -0.85), D); // cab, windows, roof
  add(at(rb(1.1, 0.9, 1.6, 0.15), 0.95, 2.95, 0.6), 0x2e2e32); for (let k = 0; k < 5; k++) add(at(new THREE.BoxGeometry(1.0, 0.04, 0.08), 0.95, 2.6 + k * 0.1, -0.22), 0x1a1a1c); const ex = new THREE.CylinderGeometry(0.1, 0.1, 1.1, 10); add(at(ex, 1.1, 3.6, 1.2), 0x1a1a1c);
  const boom = locExtrudeSide([[0.9, 2.0], [1.9, 3.3], [3.0, 4.2], [4.6, 4.5], [5.2, 3.9], [4.5, 3.75], [3.1, 3.55], [2.3, 2.9], [1.5, 2.1]], 0.55, 0.05); add(boom, Y);
  const stick = locExtrudeSide([[4.6, 4.2], [5.4, 4.0], [6.2, 2.6], [6.6, 1.5], [6.3, 1.4], [5.8, 2.5], [5.1, 3.65]], 0.42, 0.04); add(stick, Y);
  const bucket = locExtrudeSide([[6.35, 1.5], [5.6, 0.95], [5.3, 0.35], [5.75, 0.0], [6.7, 0.05], [7.2, 0.5], [7.0, 1.05]], 1.15, 0.05); add(bucket, 0x4a4a50); for (let k = -2; k <= 2; k++) { const t = new THREE.ConeGeometry(0.08, 0.3, 6); t.rotateX(Math.PI * 0.5 + 0.3); add(at(t, k * 0.24, 0.0, -7.25), 0xc9ccd0); }
  for (const [a, b, r] of [[[2.2, -1.4], [3.55, -2.7], 0.13], [[3.6, -3.4], [4.1, -5.2], 0.11], [[3.7, -5.5], [1.25, -6.3], 0.1]]) { const c = locCylBetween(a[0], a[1], b[0], b[1], r); add(c, CH); const c2 = locCylBetween(a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5, b[0], b[1], r * 0.55); add(c2, 0x9a9da3); } // hydraulic rams
  add(at(new THREE.BoxGeometry(0.12, 0.5, 0.05), -0.72, 3.6, -1.7), 0xf2f2ea); // a stripe on the cab
  return out; }
function locJersey(P, x, z, len, col, ry) { /* a concrete road barrier: the real tapered profile, extruded */ const sh = new THREE.Shape(); sh.moveTo(-0.3, 0); sh.lineTo(0.3, 0); sh.lineTo(0.3, 0.2); sh.lineTo(0.17, 0.55); sh.lineTo(0.11, 0.85); sh.lineTo(-0.11, 0.85); sh.lineTo(-0.17, 0.55); sh.lineTo(-0.3, 0.2); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); return P(g, col, x, 0, z, 0, ry || 0, 0); }
function locCorrTex() { return tex(256, 128, (g, w, h) => { g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.4)'); g.fillStyle = gr; g.fillRect(x, 0, 8, h); } for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(70,40,20,' + (0.05 + Math.random() * 0.1) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 3 + Math.random() * 14); } }); }
function locContainerTex() { return tex(512, 256, (g, w, h) => { g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, w, h); for (let x = 6; x < w - 6; x += 9) { const gr = g.createLinearGradient(x, 0, x + 9, 0); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.42)'); g.fillStyle = gr; g.fillRect(x, 14, 9, h - 28); } g.fillStyle = 'rgba(40,40,40,0.7)'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, 12, h); g.fillRect(w - 12, 0, 12, h); g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = '700 38px Arial'; g.fillText('MAERSK-X  4501 337 0', 36, 82); g.font = '700 16px Arial'; g.fillText('22G1  MAX GROSS 30480 KG', 36, 112); for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '110,60,30' : '20,20,20') + ',' + (0.05 + Math.random() * 0.12) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 2 + Math.random() * 18); } }); }
function locPlankTex() { return tex(256, 256, (g, w, h) => { g.fillStyle = '#b9a58a'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = 'hsl(30,' + (22 + Math.random() * 14) + '%,' + (40 + Math.random() * 16) + '%)'; g.fillRect(x + 1, 0, 30, h); g.strokeStyle = 'rgba(40,25,10,0.4)'; g.lineWidth = 1; for (let k = 0; k < 9; k++) { const gx = x + 4 + Math.random() * 24; g.beginPath(); g.moveTo(gx, 0); for (let y = 0; y < h; y += 16) g.lineTo(gx + Math.sin(y * 0.1 + k) * 1.2, y); g.stroke(); } g.fillStyle = 'rgba(25,15,8,0.7)'; g.fillRect(x + 2, 3 + Math.floor(Math.random() * 6) * 40, 2, 2); g.fillRect(x + 28, 3 + Math.floor(Math.random() * 6) * 40, 2, 2); } g.fillStyle = 'rgba(0,0,0,0.5)'; for (let x = 0; x <= w; x += 32) g.fillRect(x, 0, 1.5, h); }); }
function locFacade(style) { /* a tile of a front: 4 windows across and 4 floors up (12 m x 14.4 m); the albedo and, separately, only the lit windows */
  const cw = 512, ch = 512, C = 4, Rw = 4, cwd = cw / C, cht = ch / Rw, rnd = locRng({ brick: 3, concrete: 5, glass: 7, stucco: 9 }[style]), lit = []; for (let i = 0; i < C * Rw; i++) lit.push(rnd() < 0.55 ? 1 + Math.floor(rnd() * 3) : 0);
  const glow = k => ['', '#ffbf5e', '#cfe6ff', '#8fb2ff'][k], glow2 = k => ['', '#e8903a', '#86b4ea', '#5576d0'][k], dim = k => ['', '#7a4d20', '#44627f', '#2a3a70'][k], dim2 = k => ['', '#5a3416', '#2f4560', '#1f2c58'][k];
  const draw = (g, w, h, em) => {
    if (em) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } else if (style === 'brick') { g.fillStyle = '#4a2c22'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = -(y / 8 % 2) * 11; x < w; x += 22) { g.fillStyle = 'hsl(' + (8 + rnd() * 10) + ',' + (38 + rnd() * 14) + '%,' + (24 + rnd() * 12) + '%)'; g.fillRect(x + 1, y + 1, 20, 6); } }
    else if (style === 'concrete') { g.fillStyle = '#6f737b'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 3); } g.fillStyle = 'rgba(30,32,38,0.55)'; for (let y = 0; y < h; y += cht) g.fillRect(0, y, w, 3); for (let x = 0; x < w; x += cwd) g.fillRect(x, 0, 2, h); }
    else if (style === 'glass') { g.fillStyle = '#0a1424'; g.fillRect(0, 0, w, h); const sk = g.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, 'rgba(70,110,170,0.35)'); sk.addColorStop(1, 'rgba(20,30,60,0)'); g.fillStyle = sk; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(2,4,8,0.85)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); for (let y = 0; y < h; y += cht / 2) g.fillRect(0, y, w, 3); }
    else { g.fillStyle = '#b3a283'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(60,40,20,0.08)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 3); } g.fillStyle = 'rgba(120,100,70,0.5)'; for (let y = 0; y < h; y += cht) g.fillRect(0, y, w, 6); }
    for (let r = 0; r < Rw; r++) for (let c = 0; c < C; c++) { const k = lit[r * C + c], x0 = c * cwd, y0 = r * cht;
      if (style === 'glass') { for (let q = 0; q < 2; q++) { const on = lit[r * C + c] && (rnd() < 0.8); const gx = x0 + q * (cwd / 2), gy = y0 + cht * 0.18; if (on) { const gr = g.createLinearGradient(0, gy, 0, gy + cht * 0.64); gr.addColorStop(0, em ? glow(k) : dim(k)); gr.addColorStop(1, em ? glow2(k) : dim2(k)); g.fillStyle = gr; g.fillRect(gx + 4, gy, cwd / 2 - 8, cht * 0.64); } else if (!em) { g.fillStyle = 'rgba(120,160,220,0.1)'; g.fillRect(gx + 4, gy, cwd / 2 - 8, cht * 0.64); } } continue; }
      const win = style === 'concrete' ? [x0 + 12, y0 + 34, 104, 54] : style === 'brick' ? [x0 + 30, y0 + 24, 68, 74] : [x0 + 38, y0 + 26, 52, 70], [wx, wy, ww, wh] = win;
      if (!em) { g.fillStyle = style === 'concrete' ? '#26292f' : style === 'brick' ? '#e6e1d4' : '#efe9dc'; g.fillRect(wx - 5, wy - 5, ww + 10, wh + 10); if (style === 'brick') { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(wx - 7, wy + wh + 5, ww + 14, 5); g.fillStyle = '#a89a86'; g.fillRect(wx - 7, wy - 11, ww + 14, 6); } }
      if (k) { const gr = g.createLinearGradient(wx, wy, wx, wy + wh); gr.addColorStop(0, em ? glow(k) : dim(k)); gr.addColorStop(1, em ? glow2(k) : dim2(k)); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh); g.fillStyle = em ? 'rgba(0,0,0,0.0)' : 'rgba(20,10,0,0.25)'; if (style !== 'concrete') { g.fillRect(wx, wy, 7, wh); g.fillRect(wx + ww - 7, wy, 7, wh); } else for (let yy = wy + 6; yy < wy + wh; yy += 7) g.fillRect(wx, yy, ww, 2); if (!em && rnd() < 0.3) { g.fillStyle = 'rgba(15,10,10,0.8)'; g.fillRect(wx + ww * 0.55, wy + wh * 0.35, 9, wh * 0.65); g.beginPath(); g.arc(wx + ww * 0.55 + 4.5, wy + wh * 0.33, 6, 0, 6.283); g.fill(); } }
      else if (!em) { const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh); gr.addColorStop(0, '#16253d'); gr.addColorStop(0.5, '#0b1220'); gr.addColorStop(1, '#101c30'); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh); g.fillStyle = 'rgba(150,190,255,0.12)'; g.beginPath(); g.moveTo(wx + ww * 0.1, wy + wh); g.lineTo(wx + ww * 0.55, wy); g.lineTo(wx + ww * 0.7, wy); g.lineTo(wx + ww * 0.25, wy + wh); g.fill(); }
      if (!em) { g.fillStyle = style === 'concrete' ? '#26292f' : '#cfc9b9'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); if (style !== 'concrete') g.fillRect(wx, wy + wh / 2 - 1, ww, 2);
        if (style === 'stucco') { g.fillStyle = '#4a6a52'; g.fillRect(wx - 24, wy - 2, 20, wh + 4); g.fillRect(wx + ww + 4, wy - 2, 20, wh + 4); g.fillStyle = '#2a2a2e'; g.fillRect(wx - 12, wy + wh + 14, ww + 24, 3); for (let bx = wx - 12; bx < wx + ww + 12; bx += 6) g.fillRect(bx, wy + wh + 14, 1.5, 16); }
        if (style === 'brick' && rnd() < 0.22) { g.fillStyle = '#8d9096'; g.fillRect(wx + ww - 22, wy + wh + 14, 24, 17); g.fillStyle = '#2a2d31'; for (let q = 0; q < 4; q++) g.fillRect(wx + ww - 20 + q * 6, wy + wh + 17, 3, 11); } } }
    if (!em) { for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(0,0,0,' + (0.03 + rnd() * 0.08) + ')'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 8 + rnd() * 40); } } };
  return { map: tex(cw, ch, (g, w, h) => draw(g, w, h, false)), emis: tex(cw, ch, (g, w, h) => draw(g, w, h, true)) }; }

function locPart(geo, col, x, y, z, rx, ry, rz, sx, sy, sz) { if (sx !== undefined) geo.scale(sx, sy, sz); return OBX_PART(geo, col, x, y + (LOC.H ? LOC.H(x, z) : 0), z, rx, ry, rz, 0.05); }
function locRock(R, detail) { const g = new THREE.IcosahedronGeometry(1, detail === undefined ? 1 : detail), pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const a = pp.getX(i), b = pp.getY(i), c = pp.getZ(i), t = Math.sin(a * 91.7 + b * 31.3 + c * 57.1) * 43758.5453, n = 0.78 + 0.4 * (t - Math.floor(t)); pp.setXYZ(i, a * n, b * n, c * n); } g.computeVertexNormals(); return g; }
function locPropMat(id) { const p = { desert: [0.12, 0.3, 3.0, 0.55], snow: [0.1, 0.12, 2.6, 0.35], night: [0.1, 0.2, 2.4, 0.3], quarry: [0.09, 0.36, 2.2, 0.75] }[id] || [0.1, 0.2, 2.5, 0.4]; return locDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), p[0], p[1], p[2], p[3]); }
function locWoodMat() { if (!LOC.woodM) { const t = locPlankTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping; LOC.woodM = locDetail(new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.9 }), 0.15, 0.1, 3, 0.3); } return LOC.woodM; }
function locCorrMat() { if (!LOC.corrM) { const t = locCorrTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping; LOC.corrM = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.55, metalness: 0.45 }); } return LOC.corrM; }
function locContMat() { if (!LOC.contM) { const t = locContainerTex(); LOC.contM = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.55, metalness: 0.4 }); } return LOC.contM; }
function locMesh(parts, mat) { const geo = OBX_MERGE(parts, new THREE.BoxGeometry(1, 1, 1)); const m = new THREE.Mesh(geo, mat || locPropMat(LOC.building)); return m; }
function locAOTex() { return tex(128, 128, (g, w, h) => { const rg = g.createRadialGradient(64, 64, 2, 64, 64, 62); rg.addColorStop(0, 'rgba(0,0,0,0.62)'); rg.addColorStop(0.55, 'rgba(0,0,0,0.3)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); }); }
function locAO(list) { /* a soft dark patch under everything that stands on the ground, so nothing seems to hover */ if (!list.length) return null; const pg = []; for (const [x, z, r, a] of list) { const q = new THREE.PlaneGeometry(r * 2.4, r * 2.4); q.rotateX(-Math.PI / 2); q.translate(x, 0.02, z); pg.push(q.toNonIndexed()); } const mg = OBX_MERGE(pg, new THREE.PlaneGeometry(1, 1)); const m = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ map: locAOTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.renderOrder = 1; return m; }
function locGroundTex(kind) { /* 512 px = one 4 m tile */ return tex(512, 512, (g, w, h) => {
  const base = { desert: '#d5b886', snow: '#e9eff7', night: '#171a21', quarry: '#8a7a64' }[kind]; g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { const cx = Math.random() * w, cy = Math.random() * h, r = 30 + Math.random() * 90, rg = g.createRadialGradient(cx, cy, 1, cx, cy, r); rg.addColorStop(0, Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
  if (kind === 'desert') { g.strokeStyle = 'rgba(120,90,50,0.16)'; g.lineWidth = 2; for (let y = 8; y < h; y += 22) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 4); g.stroke(); } for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(90,60,30,0.25)' : 'rgba(255,240,200,0.3)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
  else if (kind === 'snow') { for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(160,185,220,0.35)' : 'rgba(255,255,255,0.8)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
  else if (kind === 'night') { for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(80,90,120,0.3)' : 'rgba(0,0,0,0.5)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2); } g.strokeStyle = 'rgba(70,80,110,0.5)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }
  else { for (let i = 0; i < 1500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(60,45,30,0.4)' : 'rgba(215,195,160,0.45)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 1 + Math.random() * 3.5, 1 + Math.random() * 2.5, Math.random() * 3, 0, 6.283); g.fill(); } } }); }
function locRoadTex(kind) { /* one 10 m x 4 m piece of road, drawn so that it repeats along the road without a seam */ return tex(512, 256, (g, w, h) => {
  const base = { desert: '#33343b', snow: '#eef3fa', night: '#1c1e25', quarry: '#6d5d48' }[kind]; g.fillStyle = base; g.fillRect(0, 0, w, h);
  const blob = (x, y, r, col) => { for (const dy of [-h, 0, h]) { const rg = g.createRadialGradient(x, y + dy, 1, x, y + dy, r); rg.addColorStop(0, col); rg.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = rg; g.fillRect(x - r, y + dy - r, 2 * r, 2 * r); } };
  const speck = (n, cols, s) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * s, 1 + Math.random() * s); } };
  const band = (a, b, c) => { const gr = g.createLinearGradient(w * a, 0, w * b, 0); gr.addColorStop(0, c.replace(/[\d.]+\)$/, '0)')); gr.addColorStop(0.28, c); gr.addColorStop(0.72, c); gr.addColorStop(1, c.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.fillRect(w * a, 0, w * (b - a), h); };
  const edge = (wd, c0) => { for (const sd of [0, 1]) { const x0 = sd ? w : 0, x1 = sd ? w - w * wd : w * wd, gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, c0); gr.addColorStop(1, c0.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.fillRect(Math.min(x0, x1), 0, w * wd, h); } };
  if (kind === 'snow') { // packed snow with two dark, wet wheel tracks, slush and a pale ridge between them; deep snow at the edges
    band(0.19, 0.35, 'rgba(92,100,118,0.95)'); band(0.61, 0.77, 'rgba(92,100,118,0.95)');
    for (let i = 0; i < 70; i++) blob(w * (0.17 + Math.random() * 0.64), Math.random() * h, 7 + Math.random() * 16, 'rgba(146,132,112,0.4)');
    for (let i = 0; i < 55; i++) blob(w * (0.36 + Math.random() * 0.24), Math.random() * h, 10 + Math.random() * 22, 'rgba(255,255,255,0.6)');
    edge(0.09, 'rgba(255,255,255,1)'); speck(700, ['rgba(255,255,255,0.9)', 'rgba(160,176,205,0.5)', 'rgba(110,100,90,0.35)'], 2); }
  else if (kind === 'desert') { // old asphalt: cracks, patches and drifts of sand blown over both edges
    for (let i = 0; i < 30; i++) blob(Math.random() * w, Math.random() * h, 18 + Math.random() * 40, Math.random() < 0.5 ? 'rgba(20,20,26,0.35)' : 'rgba(110,108,112,0.22)');
    g.strokeStyle = 'rgba(8,8,12,0.75)'; g.lineWidth = 1.6; for (let k = 0; k < 7; k++) { let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let n = 0; n < 9; n++) { x += (Math.random() - 0.5) * 40; y += 10 + Math.random() * 14; g.lineTo(x, ((y % h) + h) % h); } g.stroke(); }
    for (const sd of [0, 1]) for (let y = 0; y < h; y += 3) { const wv = w * (0.1 + 0.05 * Math.sin(y * 0.09 + sd * 2) + 0.03 * Math.sin(y * 0.21)); g.fillStyle = 'rgba(214,186,134,0.95)'; g.fillRect(sd ? w - wv : 0, y, wv, 3); }
    for (let i = 0; i < 40; i++) blob(w * (Math.random() < 0.5 ? Math.random() * 0.2 : 0.8 + Math.random() * 0.2), Math.random() * h, 12 + Math.random() * 25, 'rgba(214,186,134,0.55)'); speck(260, ['rgba(214,186,134,0.3)', 'rgba(70,70,76,0.4)'], 2); }
  else if (kind === 'night') { // wet asphalt in the city: lighter worn lanes, dark shiny patches
    band(0.17, 0.35, 'rgba(60,64,78,0.45)'); band(0.63, 0.81, 'rgba(60,64,78,0.45)');
    for (let i = 0; i < 26; i++) blob(Math.random() * w, Math.random() * h, 14 + Math.random() * 34, 'rgba(6,7,10,0.6)');
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.2; for (let k = 0; k < 5; k++) { let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let n = 0; n < 7; n++) { x += (Math.random() - 0.5) * 30; y += 12 + Math.random() * 12; g.lineTo(x, ((y % h) + h) % h); } g.stroke(); } speck(700, ['rgba(90,96,120,0.4)', 'rgba(0,0,0,0.5)'], 2); }
  else { // quarry track: packed earth with two deep muddy ruts, loose gravel on the sides
    band(0.18, 0.36, 'rgba(46,36,25,0.9)'); band(0.62, 0.8, 'rgba(46,36,25,0.9)');
    for (let i = 0; i < 40; i++) blob(w * (0.15 + Math.random() * 0.7), Math.random() * h, 8 + Math.random() * 20, 'rgba(34,26,18,0.4)');
    edge(0.12, 'rgba(160,142,112,0.95)'); for (let i = 0; i < 1800; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(210,190,150,0.2)' : 'rgba(50,38,26,0.18)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 0.7 + Math.random() * 1.8, 0.6 + Math.random() * 1.2, Math.random() * 3, 0, 6.283); g.fill(); } } }); }
function locOverlayTex(kind) { /* what lies over the painted lane markings: patches of snow, drifted sand, mud; they show the paint through, as on a real road */ return tex(512, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); const col = { snow: [255, 255, 255, 0.86], desert: [214, 186, 134, 0.5], quarry: [90, 70, 48, 0.5] }[kind], n = { snow: 52, desert: 70, quarry: 38 }[kind];
  for (let i = 0; i < n; i++) { const x = Math.random() * w, y = Math.random() * h, r = kind === 'desert' ? 4 + Math.random() * 11 : 12 + Math.random() * 34; for (const dy of [-h, 0, h]) { const rg = g.createRadialGradient(x, y + dy, 1, x, y + dy, r); rg.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + col[3] + ')'); rg.addColorStop(0.55, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + col[3] * 0.55 + ')'); rg.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)'); g.fillStyle = rg; g.fillRect(x - r, y + dy - r, 2 * r, 2 * r); } } }); }
function locPaveTex() { return tex(256, 256, (g, w, h) => { g.fillStyle = '#5b5f6b'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2); } g.strokeStyle = 'rgba(20,22,30,0.7)'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); }); }
function locPuddleTex() { return tex(256, 256, (g, w, h) => { g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = 14 + Math.random() * 40; for (const dy of [-h, 0, h]) { const rg = g.createRadialGradient(x, y + dy, 1, x, y + dy, r); rg.addColorStop(0, 'rgba(20,20,20,1)'); rg.addColorStop(1, 'rgba(20,20,20,0)'); g.fillStyle = rg; g.fillRect(x - r, y + dy - r, 2 * r, 2 * r); } } }); }
function locFloorMat(id) { if (!LOC.mats[id]) { const t = locGroundTex(id); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 115); LOC.mats[id] = locDetail(new THREE.MeshStandardMaterial({ map: t, roughness: id === 'night' ? 0.55 : id === 'snow' ? 0.8 : 0.96 }), 0.03, id === 'night' ? 0.15 : 0.28, id === 'snow' ? 1.8 : 2.2, id === 'snow' ? 0.3 : 0.5); } return LOC.mats[id]; }
function locWindowTex() { return tex(256, 256, (g, w, h) => { g.fillStyle = '#10131c'; g.fillRect(0, 0, w, h); const cols = ['#ffd98a', '#fff1c8', '#9ad0ff', '#ffb36b', '#c6ffd9']; for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) { const on = Math.random() < 0.5; g.fillStyle = on ? cols[Math.floor(Math.random() * cols.length)] : '#1b2132'; g.fillRect(8 + x * 40, 8 + y * 31, 26, 20); } }); }
function locBuild(id) { /* returns a group of merged props: a handful of draw calls per place */
  LOC.building = id; LOC.H = (id === 'desert' || id === 'snow' || id === 'quarry') ? locHeight(id) : null; const R = locRng(id === 'desert' ? 11 : id === 'snow' ? 23 : id === 'night' ? 37 : 53), G = new THREE.Group(), P = locPart, side = () => R() < 0.5 ? -1 : 1, parts = [], wparts = [], cparts = [], kparts = [], AOL = [], PM = locPropMat(id), off = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  const rt = locRoadTex(id); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(1, 175);
  const rm = new THREE.MeshStandardMaterial({ map: rt, roughness: id === 'night' ? 1 : id === 'snow' ? 0.8 : 0.92, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  if (id === 'night') { const pt = locPuddleTex(); pt.colorSpace = THREE.NoColorSpace; pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(2.5, 115); rm.roughnessMap = pt; rm.roughness = 0.45; rm.envMapIntensity = 1.3; }
  locDetail(rm, 0.07, 0.16, 2.4, id === 'night' ? 0.12 : 0.3); const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 700), rm); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.002, -60); road.receiveShadow = true; G.add(road); if (LOC.H) G.add(locTerrain(id, LOC.H));
  if (id === 'snow' || id === 'desert' || id === 'quarry') { const ot = locOverlayTex(id); ot.wrapS = ot.wrapT = THREE.RepeatWrapping; ot.repeat.set(1, 175); const ov = new THREE.Mesh(new THREE.PlaneGeometry(10, 700), new THREE.MeshStandardMaterial({ map: ot, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 })); ov.rotation.x = -Math.PI / 2; ov.position.set(0, 0.016, -60); ov.receiveShadow = true; ov.renderOrder = 4; G.add(ov); }
  if (id === 'night') { const pv = locPaveTex(); pv.wrapS = pv.wrapT = THREE.RepeatWrapping; pv.repeat.set(1, 115); for (const sd of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 460), locDetail(new THREE.MeshStandardMaterial({ map: pv, roughness: 0.8 }), 0.08, 0.14, 3, 0.3)); sw.position.set(sd * 7.4, 0.1, 30); sw.receiveShadow = true; G.add(sw); const cb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 460), new THREE.MeshStandardMaterial({ color: 0x8a8d98, roughness: 0.7 })); cb.position.set(sd * 5.15, 0.1, 30); G.add(cb); } }
  const scatter = (n, geo, cols, xmin, xmax, zmax, sMin, sMax, flat) => { for (let i = 0; i < n; i++) { const s = sMin + R() * (sMax - sMin); parts.push(P(geo(), cols[i % cols.length], side() * (xmin + R() * (xmax - xmin)), s * 0.3, 60 - R() * zmax, 0, R() * 6, 0, s * (1 + R() * 0.8), s * (flat || 0.7), s * (0.9 + R() * 0.7))); } };
  const grassTuft = (x, z, h, col) => { for (let k = 0; k < 4; k++) parts.push(P(new THREE.ConeGeometry(0.035, h, 4), col, x + (R() - 0.5) * 0.25, h / 2, z + (R() - 0.5) * 0.25, (R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5)); };
  if (id === 'desert') {
    for (let i = 0; i < 95; i++) { const s = 0.45 + Math.pow(R(), 2.2) * 3.4, x = side() * (7 + Math.pow(R(), 1.4) * 80), z = 70 - R() * 520; parts.push(P(locRock2(R, s > 2 ? 3 : 2), [0x8a6a4a, 0x9b7b58, 0x6f5a45, 0xa88a66][i % 4], x, s * 0.2, z, 0, R() * 6, 0, s * (0.9 + R() * 0.7), s * (0.55 + R() * 0.6), s * (0.9 + R() * 0.7))); AOL.push([x, z, s * 1.5]); }
    for (let i = 0; i < 46; i++) { const s = 0.7 + R() * 0.9, h = 3.2 + R() * 2.8, x = side() * (9.5 + R() * 45), z = 70 - R() * 480, col = [0x4f7a3b, 0x58823f, 0x46703a][i % 3]; AOL.push([x, z, s * 1.1]); for (const part of locCactus((g, c, px, py, pz) => P(g, c, px, py, pz, 0, i * 1.7, 0), x, z, s, h, col)) parts.push(part); }
    for (let i = 0; i < 70; i++) { const s = 0.4 + R() * 0.7, x = side() * (9 + R() * 50), z = 70 - R() * 440; parts.push(P(new THREE.IcosahedronGeometry(1, 1), [0x8a8a4a, 0x7a7e45, 0xa09a58][i % 3], x, s * 0.5, z, 0, R() * 6, 0, s * 1.4, s * 0.8, s * 1.2)); AOL.push([x, z, s * 1.1]); }
    for (let i = 0; i < 320; i++) grassTuft(side() * (5.6 + R() * 34), 62 - R() * 420, 0.25 + R() * 0.45, [0xb59a56, 0xa38a4a, 0xc2a965][i % 3]);
    scatter(420, () => new THREE.IcosahedronGeometry(1, 0), [0x9c8566, 0x7d6a52, 0xb09a7a], 5.6, 36, 420, 0.05, 0.2, 0.6);
    for (let i = 0; i < 16; i++) { const s = 0.5 + R() * 0.5, x = side() * (7 + R() * 24), z = 55 - R() * 400; parts.push(P(locRock2(R, 2), 0x8a7048, x, s * 0.5, z, 0, R() * 6, 0, s * 1.2, s * 1.2, s * 1.2)); AOL.push([x, z, s * 1.2]); }
    for (let z = 60; z > -400; z -= 45) { parts.push(P(new THREE.CylinderGeometry(0.14, 0.18, 9, 7), 0x5a4430, -11, 4.5, z), P(new THREE.BoxGeometry(2.4, 0.16, 0.16), 0x4e3a28, -11, 8.5, z), P(new THREE.BoxGeometry(0.12, 0.18, 0.12), 0x7a8a96, -11.9, 8.7, z), P(new THREE.BoxGeometry(0.12, 0.18, 0.12), 0x7a8a96, -10.1, 8.7, z)); AOL.push([-11, z, 0.9]);
      for (const wy of [-0.9, 0, 0.9]) parts.push(P(new THREE.BoxGeometry(0.03, 0.03, 45), 0x1b1b1f, -11 + wy, 8.5, z - 22.5)); }
    for (const [x, z, ry] of [[-22, -38, 0.3], [25, -150, -0.4]]) { // a roadside shack: plank walls, a corrugated roof with an overhang, a door, a window with a frame, barrels and crates
      const wall = (w, h, d, ox, oy, oz) => { const g = new THREE.BoxGeometry(w, h, d); locBoxUV(g, w, h, d, 2.4); wparts.push(P(g, 0xffffff, x + ox * Math.cos(ry) + oz * Math.sin(ry), oy, z - ox * Math.sin(ry) + oz * Math.cos(ry), 0, ry, 0)); }, roofP = (w, h, d, tilt, oy) => { const g = new THREE.BoxGeometry(w, h, d); locBoxUV(g, w, h, d, 3); cparts.push(P(g, 0xd8d8d8, x, oy, z, tilt, ry, 0)); };
      wall(6, 3, 4.5, 0, 1.5, 0); roofP(7.2, 0.12, 3.4, 0.28, 3.55); roofP(7.2, 0.12, 3.4, -0.28, 3.55);
      let o = off(x, z, ry, -1.2, 2.27); parts.push(P(new THREE.BoxGeometry(1.1, 2.1, 0.12), 0x4a3a2c, o[0], 1.05, o[1], 0, ry, 0)); o = off(x, z, ry, 1.6, 2.27); parts.push(P(new THREE.BoxGeometry(1.4, 1.2, 0.1), 0xd9d3c4, o[0], 1.75, o[1], 0, ry, 0), P(new THREE.BoxGeometry(1.2, 1.0, 0.12), 0x1d242c, o[0], 1.75, o[1], 0, ry, 0)); const o5 = off(x, z, ry, 1.6, 2.33); parts.push(P(new THREE.BoxGeometry(1.2, 0.05, 0.16), 0xd9d3c4, o5[0], 1.75, o5[1], 0, ry, 0));
      for (let k = 0; k < 4; k++) { const o2 = off(x, z, ry, 3.9 + (k % 2) * 0.7, 1.0 + k * 0.5); parts.push(P(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), [0x8a3a2a, 0x3a5a7a, 0x6a6a30][k % 3], o2[0], 0.45, o2[1]), P(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 16), 0x2a2a2a, o2[0], 0.3, o2[1]), P(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 16), 0x2a2a2a, o2[0], 0.62, o2[1])); AOL.push([o2[0], o2[1], 0.5]); }
      const o3 = off(x, z, ry, -3.9, 0.5); wall(1, 0.9, 1, -3.9, 0.45, 0.5); AOL.push([x, z, 4.4]); }
    { const x = 30, z = -90; for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { parts.push(P(new THREE.CylinderGeometry(0.1, 0.13, 8, 8), 0x5a4a3a, x + dx, 4, z + dz)); } for (const [a, b, c, d] of [[-1.4, -1.4, 1.4, -1.4], [1.4, -1.4, 1.4, 1.4], [1.4, 1.4, -1.4, 1.4], [-1.4, 1.4, -1.4, -1.4]]) for (const y of [2.5, 5.2]) { const len = Math.hypot(c - a, d - b), g = new THREE.CylinderGeometry(0.035, 0.035, len, 6); g.rotateZ(Math.PI / 2); parts.push(P(g, 0x3a3028, (a + c) / 2 + x, y, (b + d) / 2 + z, 0, Math.atan2(d - b, c - a) * -1, 0)); }
      parts.push(P(new THREE.CylinderGeometry(2.1, 2.1, 3.2, 20), 0x7a6a58, x, 9.6, z), P(new THREE.CylinderGeometry(2.0, 2.2, 0.2, 20), 0x4a4038, x, 8.0, z), P(new THREE.ConeGeometry(2.4, 1.3, 20), 0x5a5048, x, 11.9, z)); for (const y of [8.7, 9.6, 10.5]) parts.push(P(new THREE.CylinderGeometry(2.14, 2.14, 0.1, 20), 0x2e2a26, x, y, z)); parts.push(P(new THREE.CylinderGeometry(0.04, 0.04, 6, 6), 0x5a4a3a, x + 2.1, 5, z), P(new THREE.CylinderGeometry(0.15, 0.15, 3, 10), 0x4a4038, x + 1.6, 6.8, z)); AOL.push([x, z, 3.4]); }
    { const x = -28, z = -100, ry = 0.5, B = (w, h2, d, r, c2, lx, ly, lz) => { const g = obxBox(w, h2, d, r, 9, 9, 9); g.translate(lx, ly, lz); parts.push(P(g, c2, x, 0, z, 0, ry, 0)); }; B(1.7, 0.7, 1.8, 0.14, 0x7a4224, -1.2, 1.15, 0); B(1.5, 0.7, 1.9, 0.18, 0x8a4a2a, 0.15, 0.85, 0); B(1.9, 0.5, 1.9, 0.08, 0x8a4a2a, 1.75, 0.95, 0); B(1.2, 0.5, 1.6, 0.1, 0x15202a, -1.2, 1.4, 0); B(0.14, 0.2, 1.9, 0.06, 0x2a2a2a, 2.65, 0.55, 0);
      for (const [dx, dz] of [[-1.3, -0.92], [1.5, -0.92], [-1.3, 0.92], [1.5, 0.92]]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18); w.rotateX(Math.PI / 2); w.translate(dx, 0.42, dz); parts.push(P(w, 0x1a1a1c, x, 0, z, 0, ry, 0)); const hub = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 12); hub.rotateX(Math.PI / 2); hub.translate(dx, 0.42, dz); parts.push(P(hub, 0x8a8d92, x, 0, z, 0, ry, 0)); } AOL.push([x, z, 2.8]); }
    for (let i = 0; i < 2; i++) { const x = (i ? 1 : -1) * 13, z = 20 - i * 70; parts.push(P(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), 0x5a4a3a, x, 1.3, z), P(new THREE.BoxGeometry(2.0, 0.9, 0.08), 0xe6c23a, x, 2.4, z, 0, i ? 0.4 : -0.4, 0)); AOL.push([x, z, 0.5]); }
    G.add(locMesh(parts, PM)); if (wparts.length) G.add(locMesh(wparts, locWoodMat())); if (cparts.length) G.add(locMesh(cparts, locCorrMat()));
  } else if (id === 'snow') {
    const pine = (x, z, s, k0) => { // a spruce: layered branches that droop, each tier a little lopsided, with snow lying on them
      AOL.push([x, z, s * 2.2]); parts.push(P(new THREE.CylinderGeometry(0.2 * s, 0.34 * s, 2.4 * s, 8), 0x4a3524, x, 1.2 * s, z));
      for (let k = 0; k < 6; k++) { const rr = (2.9 - k * 0.42) * s, hh = 2.0 * s, y = (1.9 + k * 1.05) * s, g = new THREE.ConeGeometry(rr, hh, 11, 1), pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const px = pp.getX(i), py = pp.getY(i), pz = pp.getZ(i), rad = Math.hypot(px, pz); if (rad > 0.01) { const j = 0.82 + 0.34 * lh2(Math.round(px * 40) + k * 7 + Math.floor(x), Math.round(pz * 40) + Math.floor(z)); pp.setXYZ(i, px * j, py - 0.22 * hh * lh2(Math.round(px * 9) + k, Math.round(pz * 9) + 3) * (rad / rr), pz * j); } } g.computeVertexNormals();
        parts.push(P(g, [0x1f4a35, 0x255a40, 0x1b4331][(k0 + k) % 3], x, y + hh / 2, z), P(new THREE.ConeGeometry(rr * 0.8, hh * 0.4, 11), 0xf1f6fb, x, y + hh * 0.7, z)); } };
    for (let i = 0; i < 170; i++) pine(side() * (9.5 + Math.pow(R(), 1.3) * 80), 70 - R() * 480, 0.8 + R() * 1.0, i);
    for (let i = 0; i < 34; i++) { const s = 0.8 + R() * 0.5, h = 5 + R() * 2.5, x = side() * (9 + R() * 44), z = 60 - R() * 420; parts.push(P(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, h, 7), 0xe6e3dc, x, h / 2, z)); AOL.push([x, z, 0.9]); for (let k = 0; k < 6; k++) parts.push(P(new THREE.BoxGeometry(0.2 * s, 0.07, 0.2 * s), 0x2a2724, x, 0.8 + k * 0.8, z, 0, k, 0)); for (let k = 0; k < 4; k++) { const a = R() * 6.283, hh = 1.4 + R(); parts.push(P(new THREE.CylinderGeometry(0.025, 0.04, hh, 4), 0x6a5a4a, x + Math.cos(a) * 0.3, h - 0.7 + k * 0.2, z + Math.sin(a) * 0.3, Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9)); } }
    for (let i = 0; i < 46; i++) { const s = 0.7 + R() * 2.2, x = side() * (9 + R() * 46), z = 70 - R() * 440; AOL.push([x, z, s * 1.4]); parts.push(P(locRock2(R, 2), [0x7a8090, 0x6c7384][i % 2], x, s * 0.25, z, 0, R() * 6, 0, s, s * 0.7, s), P(new THREE.IcosahedronGeometry(1, 2), 0xf3f7fb, x, s * 0.58, z, 0, 0, 0, s * 0.8, s * 0.3, s * 0.8)); }
    for (let z = 50; z > -300; z -= 7) for (const sd of [-1, 1]) parts.push(P(new THREE.BoxGeometry(0.15, 1.15, 0.15), 0x6f5f4f, sd * 7.2, 0.575, z), P(new THREE.BoxGeometry(0.05, 0.08, 7), 0x7a6a58, sd * 7.2, 0.92, z - 3.5), P(new THREE.BoxGeometry(0.05, 0.08, 7), 0x7a6a58, sd * 7.2, 0.55, z - 3.5), P(new THREE.BoxGeometry(0.2, 0.06, 0.2), 0xf1f6fb, sd * 7.2, 1.18, z));
    for (let z = 60; z > -300; z -= 10) for (const sd of [-1, 1]) parts.push(P(new THREE.IcosahedronGeometry(1, 2), 0xf4f8fc, sd * 5.9, 0.15, z - 5, 0, 0, 0, 1.1, 0.7, 6));
    for (let z = 60; z > -300; z -= 20) for (const sd of [-1, 1]) { parts.push(P(new THREE.CylinderGeometry(0.035, 0.04, 1.5, 6), 0x1c1c20, sd * 5.45, 0.75, z), P(new THREE.CylinderGeometry(0.037, 0.042, 0.4, 6), 0xf0f0f0, sd * 5.45, 1.1, z), P(new THREE.BoxGeometry(0.1, 0.18, 0.05), 0xd22a2a, sd * 5.45, 1.55, z)); }
    for (const [x, z, ry] of [[-26, -45, 0.2], [30, -170, -0.5]]) { // a log cabin under snow with a door and a chimney
      parts.push(P(new THREE.BoxGeometry(6.4, 3.1, 5), 0x5a3f2a, x, 1.55, z, 0, ry)); for (let k = 0; k < 7; k++) parts.push(P(new THREE.CylinderGeometry(0.2, 0.2, 6.5, 9), k % 2 ? 0x6a4a30 : 0x5a3f2a, x, 0.2 + k * 0.45, z, 0, ry, Math.PI / 2));
      parts.push(P(new THREE.BoxGeometry(7.2, 0.25, 3.6), 0x3a2a1e, x, 4.3, z, 0.55, ry, 0)); let o1 = off(x, z, ry, 0, 1.3); parts.push(P(new THREE.BoxGeometry(7.2, 0.3, 3.5), 0xf2f6fb, o1[0], 4.55, o1[1], 0.55, ry, 0)); let o2 = off(x, z, ry, 0, -1.3); parts.push(P(new THREE.BoxGeometry(7.2, 0.3, 3.5), 0xf2f6fb, o2[0], 4.55, o2[1], -0.55, ry, 0));
      const o3 = off(x, z, ry, 2.2, 0.5); parts.push(P(new THREE.BoxGeometry(0.8, 2.2, 0.8), 0x6a5a50, o3[0], 4.3, o3[1], 0, ry), P(new THREE.BoxGeometry(0.9, 0.2, 0.9), 0xf2f6fb, o3[0], 5.5, o3[1])); const o4 = off(x, z, ry, 0, 2.55); parts.push(P(new THREE.BoxGeometry(1.0, 2.0, 0.12), 0x3a2418, o4[0], 1.0, o4[1], 0, ry, 0)); AOL.push([x, z, 5.2]); }
    for (let i = 0; i < 3; i++) { const x = side() * (9 + R() * 8), z = 30 - i * 85; parts.push(P(new THREE.IcosahedronGeometry(1, 2), 0xf6f9fc, x, 0.9, z, 0, 0, 0, 0.9, 0.9, 0.9), P(new THREE.IcosahedronGeometry(1, 2), 0xf6f9fc, x, 1.95, z, 0, 0, 0, 0.7, 0.7, 0.7), P(new THREE.IcosahedronGeometry(1, 2), 0xf6f9fc, x, 2.75, z, 0, 0, 0, 0.5, 0.5, 0.5), P(new THREE.ConeGeometry(0.07, 0.4, 6), 0xe8751a, x, 2.75, z + 0.5, Math.PI / 2, 0, 0), P(new THREE.CylinderGeometry(0.34, 0.5, 0.35, 10), 0x2a2a30, x, 3.3, z)); AOL.push([x, z, 1.4]); }
    for (let i = 0; i < 150; i++) grassTuft(side() * (5.7 + R() * 28), 62 - R() * 420, 0.25 + R() * 0.4, [0x9c8a5a, 0x8a7a50][i % 2]);
    scatter(260, () => new THREE.IcosahedronGeometry(1, 0), [0xe6eef8, 0xcfdcec, 0xf4f8fc], 5.6, 36, 420, 0.08, 0.3, 0.7);
    G.add(locMesh(parts, PM));
    { const n = 900, pos = new Float32Array(n * 3), sp = []; for (let i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * 60; pos[i * 3 + 1] = R() * 18; pos[i * 3 + 2] = (R() - 0.5) * 70; sp.push(0.7 + R() * 0.9, R() * 6.28); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const fl = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false })); fl.frustumCulled = false; G.add(fl); LOC.snow = { pts: fl, pos, sp, n, t: 0 }; }
  } else if (id === 'night') {
    const F = ['brick', 'concrete', 'glass', 'stucco'].map(locFacade), FM = F.map(f => locDetail(new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emis, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.88, metalness: 0.05, vertexColors: true }), 0.06, 0.1, 2.4, 0.15)), bw = [[], [], [], []], tint = [0xffffff, 0xe8e2da, 0xcfd6e6, 0xf2e6d8], shop = [], awn = [], roof = [], neon = [], blink = [];
    const slab = (arr, w, h, d, x, y, z, st) => { const g = new THREE.BoxGeometry(w, h, d); locBoxUV(g, w, h, d, 3.0); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 0.25, u.getY(i) * 0.2083); arr[st].push(P(g, tint[Math.floor(R() * 4)], x, y, z)); }; // 12 m x 14.4 m per tile
    for (const sd of [-1, 1]) { let z = 80; while (z > -330) { const w = 11 + R() * 12, d = 13 + R() * 14, h = 16 + R() * 56 + (R() < 0.18 ? 40 : 0), x = sd * (25 + w / 2 + R() * 8), st = Math.floor(R() * 4); slab(bw, w, h, d, x, h / 2, z - d / 2, st);
        if (h > 30 && R() < 0.5) { const w2 = w * 0.7, h2 = 5 + R() * 9; slab(bw, w2, h2, d * 0.7, x, h + h2 / 2, z - d / 2, st); roof.push(P(new THREE.BoxGeometry(w2 + 0.3, 0.4, d * 0.7 + 0.3), 0x2a2d36, x, h + h2 + 0.2, z - d / 2)); } // a stepped crown
        roof.push(P(new THREE.BoxGeometry(w + 0.5, 0.6, d + 0.5), 0x2a2d36, x, h + 0.3, z - d / 2)); const fx = x - sd * (w / 2 + 0.06);
        for (const cz of [-d / 2 + 0.2, d / 2 - 0.2]) roof.push(P(new THREE.BoxGeometry(0.5, h, 0.5), 0x4a4d56, x - sd * (w / 2 + 0.05), h / 2, z - d / 2 + cz)); // corner pilasters
        for (let k = 0; k < 3; k++) { const zc = z - d / 2 + (k - 1) * (d / 3.2); if (R() < 0.8) { shop.push(P(new THREE.BoxGeometry(0.1, 2.5, d / 3.2 - 1.0), [0xffd98a, 0xfff1c8, 0x9ad0ff, 0xffb36b][Math.floor(R() * 4)], fx, 1.75, zc)); awn.push(P(new THREE.BoxGeometry(1.4, 0.16, d / 3.2 - 0.6), [0xc0392b, 0x2e6fd8, 0x2b8a4a, 0xe08a1a][Math.floor(R() * 4)], fx - sd * 0.7, 3.2, zc)); } }
        if (R() < 0.45) neon.push(P(new THREE.BoxGeometry(0.12, 0.35, Math.min(6, d * 0.4)), [0xff3d8b, 0x3df0ff, 0xffe03d, 0x7dff3d][Math.floor(R() * 4)], fx - sd * 0.1, 4.1 + R() * 2, z - d / 2));
        if (R() < 0.8) roof.push(P(new THREE.BoxGeometry(2.4, 1.2, 2), 0x4a4e5a, x + (R() - 0.5) * w * 0.5, h + 0.9, z - d / 2 + (R() - 0.5) * d * 0.5));
        if (R() < 0.35) { const ax = x + (R() - 0.5) * w * 0.4, az = z - d / 2; roof.push(P(new THREE.CylinderGeometry(0.06, 0.08, 7, 6), 0x303440, ax, h + 3.5, az)); blink.push(P(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0xff2a2a, ax, h + 7.1, az)); }
        z -= d + 2 + R() * 5; } }
    for (let st = 0; st < 4; st++) if (bw[st].length) G.add(locMesh(bw[st], FM[st]));
    G.add(locMesh(roof, PM)); G.add(locMesh(awn, PM)); G.add(locMesh(shop, new THREE.MeshBasicMaterial({ vertexColors: true, color: glowColor(0xffffff, 3.0) }))); G.add(locMesh(neon, new THREE.MeshBasicMaterial({ vertexColors: true, color: glowColor(0xffffff, 4.0) }))); G.add(locMesh(blink, new THREE.MeshBasicMaterial({ vertexColors: true, color: glowColor(0xffffff, 4.0) })));
    const lamp = [], glow = [], halos = [], lampZ = []; for (let z = 66; z > -300; z -= 20) for (const sd of [-1, 1]) { lamp.push(P(new THREE.CylinderGeometry(0.08, 0.13, 7, 8), 0x2a2d36, sd * 7.4, 3.5, z), P(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 8), 0x2a2d36, sd * 7.4, 0.15, z)); const arm = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sd * 7.4, 6.7, z), new THREE.Vector3(sd * 7.2, 7.25, z), new THREE.Vector3(sd * 6.6, 7.35, z), new THREE.Vector3(sd * 6.0, 7.15, z)]), 8, 0.06, 6, false); lamp.push(P(arm, 0x2a2d36, 0, 0, 0)); glow.push(P(new THREE.BoxGeometry(0.95, 0.12, 0.45), 0xfff0c0, sd * 5.7, 7.05, z)); halos.push(sd * 5.7, 6.95 + (LOC.H ? 0 : 0), z); AOL.push([sd * 7.4, z, 0.7]); if (sd > 0) lampZ.push(z); }
    const carCols = [0x9a1f1f, 0x1f3f8a, 0xcfcfd6, 0x2b2d35, 0x1f6a4a, 0xd1a21a]; for (let i = 0; i < 14; i++) { const sd = side(), z = 55 - i * 24 - R() * 8, x = sd * 4.15, c = carCols[Math.floor(R() * carCols.length)], ry = Math.PI / 2 + (R() - 0.5) * 0.06, B = (w, h2, d, r, c2, lx, ly, lz) => { const g = obxBox(w, h2, d, r, 9, 9, 9); g.translate(lx, ly, lz); lamp.push(P(g, c2, x, 0, z, 0, ry, 0)); };
      B(4.4, 0.62, 1.82, 0.3, c, 0, 0.62, 0); B(2.3, 0.58, 1.62, 0.24, 0x1a2430, -0.15, 1.1, 0); B(2.2, 0.08, 1.55, 0.04, c, -0.15, 1.42, 0); B(0.1, 0.22, 1.72, 0.05, 0x101012, 2.2, 0.38, 0); B(0.1, 0.22, 1.72, 0.05, 0x101012, -2.2, 0.38, 0); for (const [dx, dz] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]]) { const w = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18); w.rotateX(Math.PI / 2); w.translate(dx, 0.34, dz); lamp.push(P(w, 0x111113, x, 0, z, 0, ry, 0)); const hb = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12); hb.rotateX(Math.PI / 2); hb.translate(dx, 0.34, dz); lamp.push(P(hb, 0x9a9ea6, x, 0, z, 0, ry, 0)); } AOL.push([x, z, 2.6]); glow.push(P(new THREE.BoxGeometry(0.06, 0.15, 1.3), i % 3 ? 0xff3a3a : 0xffe8a0, ...(() => { const tl = off(x, z, ry, 2.25, 0); return [tl[0], 0.72, tl[1]]; })(), 0, ry, 0)); }
    for (let z = 58; z > -300; z -= 24) { const sd = side(); lamp.push(P(new THREE.CylinderGeometry(0.2, 0.22, 0.9, 10), 0x3a4a3a, sd * 5.9, 0.45, z - 8), P(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 10), 0xc0392b, sd * 5.7, 0.35, z - 14)); AOL.push([sd * 5.9, z - 8, 0.5]); }
    for (let z = 40; z > -280; z -= 90) for (const sd of [-1, 1]) { lamp.push(P(new THREE.BoxGeometry(0.1, 2.5, 3.2), 0x3a4a5a, sd * 8.9, 1.25, z), P(new THREE.BoxGeometry(2.6, 0.15, 3.4), 0x3a4a5a, sd * 8.0, 2.6, z)); glow.push(P(new THREE.BoxGeometry(2.3, 0.08, 3.0), 0xcfe8ff, sd * 8.0, 2.5, z)); }
    for (let k = 0; k < 14; k++) lamp.push(P(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 20), 0x2a2c34, side() * 3.6, 0.025, 60 - k * 22));
    G.add(locMesh(lamp, PM)); G.add(locMesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true, color: glowColor(0xffffff, 8.0) })));
    const hp = tex(128, 128, (g, w, h) => { const rg = g.createRadialGradient(64, 64, 1, 64, 64, 62); rg.addColorStop(0, 'rgba(255,240,200,1)'); rg.addColorStop(0.15, 'rgba(255,214,140,0.7)'); rg.addColorStop(0.5, 'rgba(255,190,100,0.18)'); rg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); });
    { const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(halos), 3)); const hm = new THREE.Points(hg, new THREE.PointsMaterial({ map: hp, size: 9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0 })); hm.frustumCulled = false; G.add(hm); }
    const pt = tex(128, 128, (g, w, h) => { const rg = g.createRadialGradient(64, 64, 2, 64, 64, 62); rg.addColorStop(0, 'rgba(255,224,160,0.95)'); rg.addColorStop(0.4, 'rgba(255,200,120,0.4)'); rg.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); });
    for (const [size, order] of [[22, 3], [8, 4]]) { const pg = [], pm = new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6 - order, polygonOffsetUnits: -6 - order }); for (let z = 66; z > -300; z -= 20) for (const sd of [-1, 1]) { const q = new THREE.PlaneGeometry(size, size); q.rotateX(-Math.PI / 2); q.translate(sd * 4.2, 0.03, z); pg.push(q.toNonIndexed()); } const mg = OBX_MERGE(pg, new THREE.PlaneGeometry(1, 1)), pmesh = new THREE.Mesh(mg, pm); pmesh.renderOrder = order; G.add(pmesh); }
    LOC.lampLights = [0, 1].map(() => { const l = new THREE.PointLight(0xffc27a, 150, 38, 2); l.position.set(0, 6.8, 0); G.add(l); return l; }); LOC.lampZ = lampZ;
    const sp = new Float32Array(900 * 3); for (let i = 0; i < 900; i++) { const a = R() * 6.283, e = 0.12 + R() * 1.3, r = 1400; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false })); stars.frustumCulled = false; G.add(stars);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(45, 20, 14), new THREE.MeshBasicMaterial({ color: 0xe6eeff, fog: false })); moon.position.set(-420, 620, -900); G.add(moon);
  } else if (id === 'quarry') {
    for (let i = 0; i < 46; i++) { const s = 1.6 + R() * 4.2, x = side() * (10 + R() * 28), z = 60 - R() * 400; parts.push(P(locRock2(R, 2), [0x9a8a72, 0x8b7a62, 0xa89878][i % 3], x, s * 0.18, z, 0, R() * 6, 0, s * 1.2, s * 0.5, s * 1.2)); AOL.push([x, z, s * 1.2]); } // heaps of gravel and spoil
    for (let i = 0; i < 40; i++) { const s = 0.5 + Math.pow(R(), 2) * 2.6, x = side() * (8 + R() * 40), z = 60 - R() * 420; parts.push(P(locRock2(R, s > 1.6 ? 3 : 2), [0x9a8a72, 0x7f705b, 0xb0a088][i % 3], x, s * 0.2, z, 0, R() * 6, 0, s, s * 0.7, s)); AOL.push([x, z, s * 1.3]); }
    for (let z = 20; z > -130; z -= 2.1) for (const sd of [-1, 1]) parts.push(locJersey(P, sd * 5.7, z, 2.0, (z * 10 | 0) % 5 === 0 ? 0xe06a1a : 0xcfcfc8, 0));
    for (let i = 0; i < 16; i++) { const cx = side() * (5.2 + R() * 0.3), cz = 40 - i * 9; parts.push(P(new THREE.ConeGeometry(0.2, 0.6, 10), 0xff6a1a, cx, 0.3, cz), P(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 10), 0xf4f4ee, cx, 0.32, cz)); AOL.push([cx, cz, 0.35]); }
    for (let i = 0; i < 12; i++) { const x = side() * (14 + R() * 10), z = 50 - R() * 330, ry = (R() - 0.5) * 0.2; for (let k = 0; k < 1 + Math.floor(R() * 2); k++) { const g = new THREE.BoxGeometry(6, 2.6, 2.4); kparts.push(P(g, [0x2e6fd8, 0xc0392b, 0x2b8a4a, 0xe08a1a, 0x8a8f96][Math.floor(R() * 5)], x, 1.3 + k * 2.6, z, 0, ry, 0)); } AOL.push([x, z, 4.2]); }
    for (let i = 0; i < 2; i++) { const x = (i ? 1 : -1) * 19, z = -30 - i * 120; for (const part of locExcavator(P, x, z, i ? -0.6 : 0.6)) parts.push(part); AOL.push([x, z, 5]); }
    for (let i = 0; i < 3; i++) { const x = side() * (13 + R() * 6), z = 30 - i * 100; for (let k = 0; k < 6; k++) parts.push(P(new THREE.CylinderGeometry(0.45, 0.45, 5, 14), 0x6a6e76, x + (k % 3) * 0.9, 0.45 + Math.floor(k / 3) * 0.8, z, 0, 0.1, Math.PI / 2)); AOL.push([x + 0.9, z, 3.2]); }
    for (let i = 0; i < 9; i++) { const x = side() * (7 + R() * 14), z = 45 - R() * 300; parts.push(P(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), [0xc0392b, 0x2e6fd8, 0x5a5e66][i % 3], x, 0.45, z)); AOL.push([x, z, 0.5]); }
    for (let i = 0; i < 8; i++) { const x = side() * (6.8 + R() * 3), z = 35 - i * 40; parts.push(P(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), 0x555a63, x, 1.1, z), P(new THREE.BoxGeometry(1.1, 1.1, 0.06), 0xf0c020, x, 2.2, z, 0, 0, Math.PI / 4)); }
    for (let i = 0; i < 130; i++) grassTuft(side() * (5.8 + R() * 22), 62 - R() * 380, 0.2 + R() * 0.4, [0x8a8a4a, 0x7a7a40, 0x9a8a50][i % 3]);
    scatter(560, () => new THREE.IcosahedronGeometry(1, 0), [0x9a8a72, 0x7a6a56, 0xb0a088, 0x6a5a48], 5.8, 34, 400, 0.06, 0.28, 0.6);
    const pl = []; for (let z = 40; z > -300; z -= 70) for (const sd of [-1, 1]) { parts.push(P(new THREE.CylinderGeometry(0.2, 0.25, 14, 7), 0x555a63, sd * 14, 7, z), P(new THREE.BoxGeometry(3, 1.2, 0.2), 0x3a3d44, sd * 13, 14.2, z)); pl.push(P(new THREE.BoxGeometry(2.7, 0.9, 0.1), 0xfff1d0, sd * 13, 14.2, z + 0.12)); AOL.push([sd * 14, z, 0.8]); }
    G.add(locMesh(parts, PM)); if (kparts.length) G.add(locMesh(kparts, locContMat())); G.add(locMesh(pl, new THREE.MeshBasicMaterial({ vertexColors: true, color: glowColor(0xffffff, 2.6) })));
    for (let i = 0; i < 12; i++) { const x = side() * (8.5 + R() * 6), z = 40 - i * 28, s = 0.5 + R() * 0.9; const q = new THREE.Mesh(new THREE.CircleGeometry(s, 24), new THREE.MeshStandardMaterial({ color: 0x4d5a66, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })); q.rotation.x = -Math.PI / 2; q.position.set(x, 0.018, z); q.scale.set(1.5, 1, 1); G.add(q); }
  }
  const ao = locAO(AOL); if (ao) G.add(ao);
  G.traverse(o => { if (o.isMesh) { o.castShadow = false; } }); return G; }
function locStep(dt) { if (LOC.cur === 'night' && LOC.lampLights) { const z0 = 66 - 20 * Math.max(0, Math.min(17, Math.round((66 - camera.position.z) / 20))); LOC.lampLights[0].position.set(-5.7, 6.8, z0); LOC.lampLights[1].position.set(5.7, 6.8, z0 - 20); } /* falling snow: flakes drift down and sideways around the camera */ const S = LOC.snow; if (LOC.cur !== 'snow' || !S) return; S.t += dt; const p = S.pos, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  for (let i = 0; i < S.n; i++) { const k = i * 3, v = S.sp[i * 2], ph = S.sp[i * 2 + 1]; p[k + 1] -= v * dt * 1.1; p[k] += Math.sin(S.t * 0.8 + ph) * 0.25 * dt; p[k + 2] += Math.cos(S.t * 0.6 + ph) * 0.15 * dt; let dx = p[k] - cx, dy = p[k + 1] - cy, dz = p[k + 2] - cz; if (dy < -2) dy += 20; if (dx > 30) dx -= 60; else if (dx < -30) dx += 60; if (dz > 35) dz -= 70; else if (dz < -35) dz += 70; p[k] = cx + dx; p[k + 1] = cy + dy; p[k + 2] = cz + dz; } S.pts.geometry.attributes.position.needsUpdate = true; }
function locEnv(id) { /* the reflections and soft light of each place come from its own sky */ if (LOC.envs[id]) return LOC.envs[id]; const L = LOCS[id], es = new THREE.Scene(), sk = new Sky(); sk.scale.setScalar(4000); const u = sk.material.uniforms; u.turbidity.value = L.turb; u.rayleigh.value = L.ray; u.mieCoefficient.value = L.mie; u.mieDirectionalG.value = 0.8; u.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - L.el), THREE.MathUtils.degToRad(L.az)); es.add(sk); const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(es, 0).texture; pm.dispose(); LOC.envs[id] = t; return t; }
function locCapture(before) { /* called once, when the lab has been built: remember what the hall is made of */
  LOC.hall = scene.children.filter(o => !before.has(o)); LOC.vis = new Map(); LOC.keep = new Set(); LOC.floor = null;
  for (const o of LOC.hall) { LOC.vis.set(o, o.visible); const gp = o.geometry && o.geometry.parameters; if (gp && gp.width === 80 && gp.height === 460) { LOC.floor = o; LOC.floorMat = o.material; LOC.keep.add(o); continue; }
    let keep = !o.visible; if (!keep && o.children && BOLLARD && o.children.includes(BOLLARD)) keep = true;
    if (!keep && o.isMesh && o.geometry && (o.geometry.type === 'PlaneGeometry' || o.geometry.type === 'RingGeometry') && Math.abs(Math.abs(o.rotation.x) - Math.PI / 2) < 0.02 && o.position.y < 0.05) keep = true;
    if (!keep) { const bx = new THREE.Box3().setFromObject(o), c = bx.getCenter(new V3()); if (Math.abs(c.x - LAB_LANE) < 3.8 && c.y > 2 && bx.max.y < 5.6) keep = true; }
    if (keep) LOC.keep.add(o); }
  LOC.hallSet = { hemi: [hemi.color.getHex(), hemi.groundColor.getHex(), hemi.intensity], sun: [sunLight.color.getHex(), sunLight.intensity], fog: scene.fog ? [scene.fog.color.getHex(), scene.fog.near, scene.fog.far] : null, sunDir: SUN.clone(), sky: [SKY.material.uniforms.turbidity.value, SKY.material.uniforms.rayleigh.value, SKY.material.uniforms.mieCoefficient.value], env: scene.environment }; }
function locApply(id) { /* the lane keeps its markings, the stand, the speed gate; everything else of the hall is replaced by the chosen place (and the light, sky and fog go with it) */
  if (!LOCS[id]) id = 'hall'; if (!LOC.hall || LOC.cur === id) return; LOC.cur = id; const L = LOCS[id], H = LOC.hallSet, hall = id === 'hall';
  for (const o of LOC.hall) o.visible = hall || LOC.keep.has(o) ? LOC.vis.get(o) : false;
  if (LOC.floor) { LOC.floor.material = hall ? LOC.floorMat : locFloorMat(id); LOC.floor.visible = hall ? LOC.vis.get(LOC.floor) : !(id === 'desert' || id === 'snow' || id === 'quarry'); }
  if (!hall && !LOC.built[id]) { LOC.built[id] = locBuild(id); scene.add(LOC.built[id]); } for (const k in LOC.built) LOC.built[k].visible = k === id;
  const u = SKY.material.uniforms;
  if (hall) { hemi.color.setHex(H.hemi[0]); hemi.groundColor.setHex(H.hemi[1]); hemi.intensity = H.hemi[2]; sunLight.color.setHex(H.sun[0]); sunLight.intensity = H.sun[1]; if (scene.fog && H.fog) { scene.fog.color.setHex(H.fog[0]); scene.fog.near = H.fog[1]; scene.fog.far = H.fog[2]; } SUN.copy(H.sunDir); u.turbidity.value = H.sky[0]; u.rayleigh.value = H.sky[1]; u.mieCoefficient.value = H.sky[2]; scene.environment = H.env; LOC.exp = 1; }
  else { hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2]; sunLight.color.setHex(L.sun[0]); sunLight.intensity = L.sun[1]; if (scene.fog) { scene.fog.color.setHex(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2]; } SUN.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - L.el), THREE.MathUtils.degToRad(L.az)); u.turbidity.value = L.turb; u.rayleigh.value = L.ray; u.mieCoefficient.value = L.mie; scene.environment = locEnv(id); LOC.exp = L.exp || 1; }
  u.sunPosition.value.copy(SUN); try { applyRecMode(); } catch (e) { /* the picture follows at the next change */ } }

function buildLab() {
  const __locBefore = new Set(scene.children);
  labBuilt = true; LABNOSTAND = (L.machines || []).every(m => m === 'bollard' || m === 'cannon' || m === 'tub' || m === 'stairs' || m === 'mix');
  for (const o of TRACK_OBJS) o.visible = false; // the lab has no track
  BIG.visible = false; board.visible = labBol();
  { const bm = new THREE.Group(), post = new THREE.Group(); post.rotation.order = 'YXZ'; post.position.y = 0.12; bm.add(post); const st = new THREE.Mesh(new THREE.CylinderGeometry(BOLLARD_R, BOLLARD_R, BOLLARD_H, 24), stripeMat(1.4)); st.position.y = BOLLARD_H / 2 - 0.12; st.castShadow = true; post.add(st); const cap = new THREE.Mesh(new THREE.SphereGeometry(BOLLARD_R, 20, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.4 })); cap.position.y = BOLLARD_H - 0.12; post.add(cap); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 0.9 })); base.position.y = 0.06; bm.add(base); bm.position.set(LAB_LANE, 0, BOLLARD_Z); scene.add(bm); BOLLARD = post; LABCART.cyls.push({ x: LAB_LANE, z: BOLLARD_Z, r: BOLLARD_R, h: BOLLARD_H }); }
  scene.fog = new THREE.Fog(0x2a2733, 60, 260);
  const conc = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#6f6c70'; g.fillRect(0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 6; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
    for (let i = 0; i < 70; i++) { const cx = Math.random() * w, cy = Math.random() * h, r = 60 + Math.random() * 140, rg = g.createRadialGradient(cx, cy, 1, cx, cy, r); rg.addColorStop(0, Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
    g.strokeStyle = 'rgba(30,28,34,0.34)'; g.lineWidth = 5; for (let x = 0; x <= w; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); }
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
  LABNOSTAND = (L.machines || []).every(m => m === 'bollard' || m === 'cannon' || m === 'tub' || m === 'stairs' || m === 'mix');
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
  locCapture(__locBefore);
  buildLabUI();
}
let SPEEDO = null;
let LAB_STREAKS = null;
function labStreaks() { // thin white streaks along the approach lane: at high speed the cart rips past them, which sells the speed in the first seconds
  LAB_STREAKS = new THREE.Group(); LAB_STREAKS.visible = false;
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: false }), g = new THREE.BoxGeometry(0.035, 0.035, 5);
  for (let i = 0; i < 70; i++) { const o = new THREE.Mesh(g, m); const sd = Math.random() < 0.5 ? -1 : 1; o.position.set(LAB_LANE + sd * rand(1.4, 7), rand(0.35, 3.6), BOLLARD_Z + rand(3, 135)); o.scale.z = rand(0.6, 2.2); LAB_STREAKS.add(o); }
  scene.add(LAB_STREAKS);
}
function labDress() {
  labStreaks();
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
  const putPoster = (i, t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
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
  const f = new Float32Array(9 + parts.length * 7 + CDEB.list.length * 7), q = new THREE.Quaternion(), v = new V3();
  f[0] = LREC.t; board.getWorldPosition(v); board.getWorldQuaternion(q); f.set([v.x, v.y, v.z, q.x, q.y, q.z, q.w], 1);
  parts.forEach((p, i) => { p.getWorldPosition(v); p.getWorldQuaternion(q); f.set([v.x, v.y, v.z, q.x, q.y, q.z, q.w], 8 + i * 7); });
  { const base = 8 + parts.length * 7; f[base] = CDEB.on ? 1 : 0; CDEB.list.forEach((d, i) => { d.m.getWorldPosition(v); d.m.getWorldQuaternion(q); f.set([v.x, v.y, v.z, q.x, q.y, q.z, q.w], base + 1 + i * 7); }); }
  LREC.frames.push(f); if (LREC.frames.length > 700) LREC.frames.shift();
}
function labBars(on) { // the replay used to draw black bars over 24% of the screen and a blinking REPLAY label: gone, so a replay cut into a video looks like the rest of it
  if (!document.getElementById('labBarsCss')) { const css = document.createElement('style'); css.id = 'labBarsCss'; css.textContent = '.labmode.replaying .labgauge,.labmode.replaying .lablvl{opacity:0}#labBars{display:none!important}'; document.head.appendChild(css); }
  stage.classList.toggle('replaying', on);
}
function labReplayStart() {
  crashBudget(false); // the replay gets the full picture again
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
  { const base = 8 + parts.length * 7, act = a[base] > 0.5; if (CART_ROOT) CART_ROOT.visible = !act; CDEB.list.forEach((d, i) => { d.m.visible = act; if (act) { put(d.m, base + 1 + i * 7); d.m.scale.setScalar(CART_S); } }); }
}
function labReplayStep(dt, now) {
  const R2 = LAB.replay; if (!R2) return;
  // slowest right at the impact, a little faster before and after
  const near = Math.abs(R2.t - R2.imp), speed = near < 0.35 ? 0.22 : near < 1 ? 0.4 : 0.65;
  R2.t += dt * speed;
  const before = R2.t < R2.imp;
  if (R2.cage && R2.dent) { const want = before ? 'o' : 'd'; if (R2.shown !== want) { R2.cage.geometry.attributes.position.array.set(before ? R2.cage.geometry.userData.orig : R2.dent); R2.cage.geometry.attributes.position.needsUpdate = true; R2.shown = want; } }
  bollardFall(before || !(CART.knocked || CART.bent) ? 0 : clamp((R2.t - R2.imp) * 5, 0, 1));
  if (!before && !R2.boomed) { R2.boomed = true; burst(new V3(LAB_LANE, 0.8, BOLLARD_Z), 60, SPARK, 6); tone(90, 30, 0.5, 'sine', 0.4); if (!reduceMotion) shake = 0.5; }
  if (labBol() && OBX.cur !== 'post') { obsDentShow(!before); obsRockAt(R2.t - R2.imp); }
  labReplayFrame(R2.t);
  if (R2.t >= R2.to || R2.skip) { labReplayFrame(R2.to); if (R2.cage && R2.dent) { R2.cage.geometry.attributes.position.array.set(R2.dent); R2.cage.geometry.attributes.position.needsUpdate = true; } if (CART.knocked || CART.bent) bollardFall(1); LAB.replay = null; labBars(false); LAB.phase = 'done'; labFinish(LAB.outTxt || 'done'); }
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
.labgauge b{display:block;font:700 22px "Chakra Petch",ui-sans-serif,sans-serif;color:#fff;-webkit-text-stroke:1.5px #16112a;text-shadow:0 3px 0 #16112a;letter-spacing:1px}
.labgauge .row{display:flex;align-items:center;gap:8px;margin-top:4px}
.labgauge .pm{flex:none;width:30px;height:30px;border-radius:50%;background:#1c1838;border:3px solid #fff;color:#fff;font:700 20px/22px "Chakra Petch",sans-serif}
.labgauge .track{position:relative;flex:1;height:18px;border-radius:10px;border:3px solid #fff;background:linear-gradient(90deg,#3dff9a,#ffe23d 50%,#ff8a1f 75%,#ff2a3a)}
.labgauge .knob{position:absolute;top:50%;width:22px;height:30px;margin:-15px 0 0 -11px;background:#fff;border:3px solid #16112a;border-radius:8px 8px 12px 12px;transition:left .25s}
.lablvl{position:absolute;left:12px;top:calc(env(safe-area-inset-top,0px) + 14px);z-index:6;pointer-events:none;white-space:pre-line;text-align:left;font:700 20px/1.15 "Chakra Petch",sans-serif;color:#ffc41f;-webkit-text-stroke:1px #16112a;text-shadow:0 2px 0 #16112a}
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
  g.innerHTML = '<b id="labTitle"></b>';
  stage.appendChild(g);
  const lv = document.createElement('div'); lv.className = 'lablvl'; lv.id = 'labLvl'; stage.appendChild(lv);
  const p = document.createElement('div'); p.className = 'labpanel'; p.id = 'labPanel';
  p.innerHTML = '<p class="res" id="labRes"></p><div class="chips" id="labChips"></div><div class="lrow"><button class="sm" data-d="-10" type="button">−10</button><button class="sm" data-d="-1" type="button">−1</button><input type="range" min="1" max="100" step="1" id="labRange" aria-label="Level"><button class="sm" data-d="1" type="button">+1</button><button class="sm" data-d="10" type="button">+10</button></div><button class="go" id="labGo" type="button">TEST ▶</button><div class="foot"><button id="labMenu" type="button">◀ Menu</button><button id="labTxt" type="button">Text</button><button id="labNext" type="button">Next level ▶</button></div>';
  stage.appendChild(p);
  const chips = $('labChips');
  for (const m of (L.machines || Object.keys(LAB_INFO))) { if (m === 'bollard' || m === 'tub' || m === 'stairs') continue; const b = document.createElement('button'); b.type = 'button'; b.dataset.m = m; b.textContent = LAB_INFO[m].title; b.onclick = () => { LAB.machine = m; LAB.level = Math.min(LAB.level, LAB_MAX()); labSave(); labUI(); }; chips.appendChild(b); }
  for (const b of p.querySelectorAll('.sm')) { if (Math.abs(Number(b.dataset.d)) === 10) b.style.display = 'none'; b.onclick = () => { LAB.level = clamp(LAB.level + Number(b.dataset.d), 1, LAB_MAX()); labSave(); labUI(); }; }
  $('labRange').oninput = e => { LAB.level = clamp(Number(e.target.value) || 1, 1, LAB_MAX()); labSave(); labUI(); };
  $('labGo').onclick = () => { initAudio(); labStart(); };
  $('labNext').onclick = () => { initAudio(); LAB.level = Math.min(LAB_MAX(), LAB.level + 1); labSave(); labStart(); };
  $('labMenu').onclick = () => { location.href = 'index.html'; };
  $('labTxt').onclick = () => { const t = prompt('WORD WALL text (letters, numbers, ! ? - + .)', MIX.txt); if (t === null) return; const c = wordwallClean(t); MIX.txt = c; try { localStorage.setItem('daggie-mix', JSON.stringify({ veh: MIX.veh, obs: MIX.obs, loc: MIX.loc, txt: MIX.txt })); } catch (e) { /* not saved */ } wordwallRebuild(); mixApply(); labUI(); };
  stage.addEventListener('pointerdown', () => { if (LAB.replay) LAB.replay.skip = true; }); // tap to skip the replay
  labUI();
}
function labSave() { try { localStorage.setItem('daggie-lab', JSON.stringify({ m: LAB.machine, l: LAB.level })); } catch (e) {} }
function labUI() {
  if (!labBuilt) return;
  if (!labBol() && daggie.position.y !== BOARD_TOP) daggie.position.y = BOARD_TOP;
  PRESS.visible = LAB.machine === 'press'; if (PRESS.visible && PRESS.mode === 'idle') { PRESS.rotation.y = pressYaw(); pressPlace(HEAD_TOP + 1.6); }
  cannonShow(LAB.machine === 'cannon'); stairsShow(LAB.machine === 'stairs');
  if (labBol()) { const was = LAB_VEH; labVehicle(labVehKind()); obsApply(); if (was !== LAB_VEH) { board.visible = true; labCartReset(); } mixPickVis(true); } else mixPickVis(false);
  $('labTitle').textContent = LAB_INFO[LAB.machine].title;
  $('labRange').max = String(LAB_MAX());
  $('labLvl').textContent = (labBol() ? 'LEVEL ' + LAB.level + ' · ' + LAB_SPEEDS[LAB.level - 1] + ' MPH' : LAB.machine === 'press' ? 'LEVEL ' + LAB.level + ' · ' + PRESS_TONS[LAB.level - 1] + ' TONS' : LAB.machine === 'cannon' ? 'LEVEL ' + LAB.level + ' · ' + CANNON_MPH[LAB.level - 1] + ' MPH' : LAB.machine === 'stairs' ? 'LEVEL ' + LAB.level + ' · ' + STAIRS_STEPS[LAB.level - 1] + ' STEPS' : 'LEVEL ' + LAB.level).replace(' · ', '\n');
  $('labRange').value = String(LAB.level);
  for (const b of $('labChips').children) b.setAttribute('aria-pressed', String(b.dataset.m === LAB.machine));
  $('labTxt').hidden = !(labBol() && MIX.obs === 'wordwall'); $('labTxt').textContent = 'Text: ' + MIX.txt; 
  if (!LAB.text) { $('labRes').textContent = LAB_INFO[LAB.machine].ask; }
}
function labReset() {
  crashBudget(false); idleSharp(true);
  if (FACE_N) LAB_YAW = Math.atan2(-FACE_N.x, FACE_N.z); // before the build: the posters are photographed facing the camera
  if (!labBuilt) buildLab();
  locApply(labBol() ? MIX.loc : 'hall'); if (labBol() && HATCH.state === 0) setTimeout(hatchLoad, 4000);
  Object.assign(R, { s: 0, x: 0, xT: 0, xv: 0, y: REST_Y, vy: 0, carry: false, speed: 0, grounded: false });
  drone.visible = false; BB.free = false; RAGSIM = null;
  if (labBol()) { labVehicle(labVehKind()); obsApply(); board.visible = true; labCartReset(); mixPickVis(true); } else { mixPickVis(false); board.visible = false; board.position.set(0, -50, 0); daggie.position.y = BOARD_TOP; }
  state = 'lab'; stateT = performance.now(); LAB.phase = 'idle'; LAB.t = 0; LAB.exploded = false; LAB.spin = 0; LAB.dist = 0; labDmg(false);
  if (LEG) { LEG.visible = false; }
  PRESS.mode = 'idle'; PRESS.visible = LAB.machine === 'press'; if (PRESS.visible) { PRESS.rotation.y = pressYaw(); pressPlace(HEAD_TOP + 1.6); }
  cannonShow(LAB.machine === 'cannon'); stairsShow(LAB.machine === 'stairs');
  setFace('idle', 0); snapCam = true;
}
function labStart() { // the buffers are rebuilt on the still picture, not while the vehicle starts to move
  if (LAB.starting) return; if (ADAPT.idle && !qFixed()) { LAB.starting = true; idleSharp(false); requestAnimationFrame(() => requestAnimationFrame(() => { LAB.starting = false; labStartNow(); })); return; } labStartNow();
}
function labStartNow() {
  idleSharp(false);
  resetRun(); // fresh Daggie on the stand
  LAB.text = ''; LAB.lost = 0; LAB.dist = 0; labDmg(false); LAB.t = 0; LAB.pending = 0; LAB.vx = 0; LAB.v = 0; LREC.frames.length = 0; LREC.t = 0; LREC.impT = null; LAB.replay = null; LAB.weave = null; LAB.aura = 0; LAB.six7 = false; labBars(false);
  $('labPanel').hidden = true; $('hook').classList.remove('show');
  state = 'ride'; stateT = performance.now(); setHP(100);
  const lv = LAB.level;
  if (labBol()) { LAB.phase = 'roll'; LABCART.v = LAB_SPEEDS[Math.min(lv, LAB_SPEEDS.length) - 1] * 0.447; CART.place(BOLLARD_Z + CART.br + Math.max(10, LABCART.v * 1.4)); mixPickVis(false); if (OBX.cur !== 'post' && (LABCART.v >= CART.solidMax || LABCART.v >= CART.knockV)) CART.cyls.length = 0; /* it will be shoved aside or destroyed anyway: his legs must not bounce off it before the vehicle even touches it */ CART.vz = -LABCART.v; labCartPlace(); R.speed = LABCART.v; R.grounded = true; setFace('happy', 1000); }
  else if (LAB.machine === 'fart') { LAB.phase = 'charge'; setFace('worried', 900); }
  else if (LAB.machine === 'sock') { LAB.phase = 'drop'; LEG.visible = true; LEG.scale.setScalar(0.55 + lv * 0.035); LEG.position.set(0, HEAD_TOP + 26, 0.1); LEG.rotation.set(0, LAB_YAW + Math.PI * 0.08, 0); LAB.v = 5 + lv * 0.3; setFace('scared', 5000); }
  else if (LAB.machine === 'stairs') stairsStart(lv);
  else if (LAB.machine === 'cannon') cannonStart(lv);
  else if (LAB.machine === 'press') { LAB.phase = 'fall'; PRESS.visible = true; PRESS.rotation.y = pressYaw(); PRESS.gauge.material = sign('PRESS ' + PRESS_TONS[clamp(lv, 1, 5) - 1] + ' TONS', '#16141c', '#ffc21a', 768, 192); pressPlace(HEAD_TOP + 1.6); PRESS.mode = 'desc'; PRESS.t = 0; PRESS.step = 0; setFace('scared', 5000); tone(300, 300, 0.1, 'square', 0.04); }
  else { LAB.phase = 'fall'; LAB.h = Math.max(1, lv); LAB.v = 0; ANVIL.visible = true; ANVIL.rotation.set(0, LAB_YAW, 0); ANVIL.position.set(0, HEAD_TOP + LAB.h, 0); ANVIL_RING.visible = true; ANVIL_RING.position.set(0, STAND_H + 0.02, 0); setFace('scared', 5000); tone(1200, 1200, 0.1, 'square', 0.05); tone(1200, 1200, 0.1, 'square', 0.05, 0.2); }
  if (LAB.machine !== 'cannon') { lastPop = 0; pop('LEVEL ' + lv, 'lilac'); } snapCam = true; // (the cannon shows the level under the counter instead)
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
// ---------- AURA: Blackie farms it from the crash, Daggie pays for it; exactly six-seven feet is the jackpot ----------
function labAura() {
  const ft = Math.round(LAB.dist || 0), torn = LAB.lost || 0, mph = Math.round((LAB.impV || 0) * 2.237), surv = LAB.text === 'survived' || String(LAB.text).indexOf('stayed in the ') === 0, six7 = ft >= 66 && ft <= 68, broke = !!CART.knocked;
  let a = ft * 10 + torn * 2500 + (broke ? 5000 : 0) + mph * 40; if (surv) a = Math.round(a * 0.4); if (six7) a += 67000; a = Math.max(100, Math.round(a / 10) * 10); LAB.aura = a; LAB.six7 = six7; }
function labFinish(text) { if (labBol()) { LAB.text = text; labAura(); } LAB.text = text; LAB.phase = 'done'; if (state === 'ride') { state = 'lab'; stateT = performance.now(); LAB.pending = performance.now() + 1400; } }
function labCrash(kind) { R.vy = Math.min(R.vy, 0); LAB.phase = 'wreck'; crash(kind); LAB.lost = 15; }

// ---------- wall cannon: 15 walls from thin glass to a vault door; the cannon's power decides how many he breaks ----------
const CANNON_MPH = [100, 200, 350, 600, 1000];
const CANNON_WALLS = [ // c: how much of his energy (mph squared) the wall takes. Checked offline: 100/200/350/600/1000 mph break 3/6/9/12/15 walls. T: thickness, R: size of the hole he punches (m)
  { n: 'THIN GLASS', c: 1500, col: 0x9fe8ff, kind: 'glass', T: 0.1, R: 1.5, draw: 'glass', crk: [0, 0, 0, 0], jag: [0.0, 7, 0.0, 0.05], edge: 0xffffff }, { n: 'HAY BALES', c: 2500, col: 0xd8b04a, kind: 'wood', T: 0.5, R: 1.3, draw: 'hay', crk: [0, 0, 0, 0], jag: [0.26, 13, 0.25, 0.07], edge: 0xe6c36a },
  { n: 'WINDOW', c: 4000, col: 0xeaf2f4, kind: 'window', T: 0.14, R: 1.35, draw: 'window', crk: [0, 0, 0, 0], jag: [0.2, 11, 0.05, 0.05], edge: 0xf3f0e8 }, { n: 'ICE', c: 4000, col: 0xbfe8ff, kind: 'ice', T: 0.3, R: 1.4, draw: 'ice', crk: [1, 1, 1, 0.9], jag: [0.24, 7, 0.0, 0.05], edge: 0xffffff },
  { n: 'PLYWOOD', c: 10000, col: 0xc99a5b, kind: 'wood', T: 0.12, R: 1.3, draw: 'ply', crk: [0.12, 0.07, 0.03, 0.9], jag: [0.3, 19, 0.15, 0.06], edge: 0xecd9b0 }, { n: 'OAK', c: 13000, col: 0x7a4a22, kind: 'wood', T: 0.22, R: 1.25, draw: 'oak', crk: [0.08, 0.05, 0.02, 0.9], jag: [0.26, 15, 0.18, 0.06], edge: 0xd8b27a },
  { n: 'BRICK', c: 14000, col: 0xb5452f, kind: 'brick', T: 0.35, R: 1.3, draw: 'brick', crk: [0.05, 0.04, 0.04, 0.95], jag: [0.14, 6, 0.4, 0.06], edge: 0xc9826a }, { n: 'THICK GLASS', c: 25000, col: 0x7fd0e8, kind: 'glass', T: 0.2, R: 1.4, draw: 'glass2', crk: [0, 0, 0, 0], jag: [0.0, 7, 0.0, 0.05], edge: 0xffffff },
  { n: 'STONE', c: 26000, col: 0x7d7f86, kind: 'stone', T: 0.5, R: 1.2, draw: 'stone', crk: [0.04, 0.04, 0.05, 0.95], jag: [0.12, 5, 0.4, 0.06], edge: 0xbdbdb6 }, { n: 'CONCRETE', c: 30000, col: 0x9a9a9a, kind: 'stone', T: 0.5, R: 1.2, draw: 'concrete', crk: [0.1, 0.1, 0.1, 0.9], jag: [0.16, 7, 0.4, 0.06], edge: 0xcfcfc8 },
  { n: 'ARMORED GLASS', c: 70000, col: 0x4fa0b8, kind: 'glass', T: 0.3, R: 1.2, draw: 'armor', crk: [0.9, 1.0, 1.0, 0.85], jag: [0.3, 9, 0.2, 0.05], edge: 0xbfe8f0 }, { n: 'STEEL', c: 100000, col: 0x8e99a8, kind: 'metal', T: 0.15, R: 0.95, draw: 'steel', crk: [0, 0, 0, 0], jag: [0.1, 7, 0.5, 0.05], edge: 0xdde4ee },
  { n: 'GOLD', c: 120000, col: 0xffc928, kind: 'metal', T: 0.2, R: 1.0, draw: 'gold', crk: [0, 0, 0, 0], jag: [0.1, 6, 0.3, 0.05], edge: 0xfff0a0 }, { n: 'DIAMOND', c: 180000, col: 0xc8f4ff, kind: 'ice', T: 0.3, R: 1.1, draw: 'diamond', crk: [1, 1, 1, 0.8], jag: [0.25, 8, 0.0, 0.05], edge: 0xffffff },
  { n: 'VAULT DOOR', c: 330000, col: 0x3a3f4a, kind: 'metal', T: 0.6, R: 1.0, draw: 'vault', crk: [0, 0, 0, 0], jag: [0.08, 6, 0.5, 0.05], edge: 0xaab3c0 },
];
const CAN_PAL = { window: [[1.5, 3, 4], [3.2, 2, 0.8], [2.5, 3.5, 4.5]], glass: [[1.5, 3, 4], [2.5, 3.5, 4.5], [1, 2, 3]], jelly: [[0.6, 4, 1.4], [0.4, 3, 1]], cake: [[4, 1.4, 3], [1.4, 3.6, 4], [4, 4, 1.4]], ice: [[2.4, 3.4, 4], [3.2, 4, 4.5]], wood: [[3.2, 2, 0.8], [2.4, 1.4, 0.5]], brick: [[3.6, 1.2, 0.6], [3, 2, 1.6]], stone: [[2.6, 2.6, 2.7], [3.2, 3.2, 3.2]], metal: null };
const CAN_LEAD = ['top', 'chest', 'pel', 'haL', 'haR', 'toL', 'toR', 'knL', 'knR'];
const MUZZLE_Z = BOLLARD_Z + 1, WALL_Z0 = BOLLARD_Z - 8, WALL_DZ = 7, CAN_NX = 16, CAN_NY = 10, CAN_W = 6, CAN_H = 3.8;
const CAN = { built: false, group: null, walls: [], wallMats: [], lamps: [], byId: {}, cam: { yaw: 0, pitch: 0, zoom: 1 }, fx: LAB_LANE, fy: 1.8, fz: -8, mats: [], cracks: [], posters: [], paper: [], sets: [], glass: null, models: [], geo: null, touch: [], phase: 'idle', t: 0, next: 0, stuck: -1, broken: 0, mph: 0, vmph: 0, recoil: 0, rest: 0, count: 0, barrel: null, lv: 1 };
const cannonWallZ = i => WALL_Z0 - i * WALL_DZ;
const cannonVis = mph => 16 + 44 * Math.sqrt(Math.max(0, mph) / 1000); // how fast he moves on screen (m/s); the mph shown is the model's
const CAN_SPEC = [
  { L: 3.2, r0: 0.55, r1: 0.48, col: 0x4d7a3a, band: 0x2b2b30, glow: 0, wheel: 'wood', wr: 0.8 }, { L: 4.2, r0: 0.65, r1: 0.55, col: 0x23252b, band: 0xb08a3a, glow: 0, wheel: 'iron', wr: 0.95 },
  { L: 5.2, r0: 0.8, r1: 0.68, col: 0x7a1f22, band: 0x30343c, glow: 0, wheel: 'steel', wr: 1.1 }, { L: 6.2, r0: 0.9, r1: 0.78, col: 0x15171c, band: 0x00e5ff, glow: 1, wheel: 'track', wr: 0.9 },
  { L: 7.6, r0: 1.05, r1: 0.9, col: 0x24201a, band: 0xffa21a, glow: 1, wheel: 'track', wr: 1.1 },
];
const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
const CAN_DRAW = { // procedural textures, 512 x 320, drawn once
  speck(g, w, h, n, cols, s, a) { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.globalAlpha = a * rand(0.4, 1); g.fillRect(rand(0, w), rand(0, h), s * rand(0.5, 1.6), s * rand(0.5, 1.6)); } g.globalAlpha = 1; },
  streaks(g, w, h, n, col, a, len) { g.strokeStyle = col; for (let i = 0; i < n; i++) { g.globalAlpha = a * rand(0.3, 1); g.lineWidth = rand(0.5, 1.8); const y = rand(0, h), x = rand(-20, w); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(len * 0.4, len), y + rand(-1, 1)); g.stroke(); } g.globalAlpha = 1; },
  glassBase(g, w, h, tint, a1, a2, edge) {
    g.clearRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, rgba(tint, a1)); gr.addColorStop(0.5, rgba(tint, a2)); gr.addColorStop(1, rgba(tint, a1)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (const [x0, wd, a] of [[0.1, 0.08, 0.32], [0.28, 0.025, 0.5], [0.6, 0.12, 0.2], [0.8, 0.03, 0.4]]) { const sk = g.createLinearGradient(w * x0, 0, w * (x0 + wd), 0); sk.addColorStop(0, 'rgba(255,255,255,0)'); sk.addColorStop(0.5, 'rgba(255,255,255,' + a + ')'); sk.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); g.transform(1, 0, -0.5, 1, h * 0.5, 0); g.fillStyle = sk; g.fillRect(w * x0 - h * 0.25, 0, w * wd + 4, h); g.restore(); }
    g.strokeStyle = edge; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.strokeRect(14, 14, w - 28, h - 28);
  },
  armor(g, w, h) { this.glassBase(g, w, h, [40, 110, 130], 0.7, 0.5, 'rgba(25,30,36,1)'); g.strokeStyle = 'rgba(10,20,25,0.7)'; g.lineWidth = 3; for (let x = 0; x <= w; x += w / 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += h / 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(150,160,170,1)'; for (let x = 0; x <= w; x += w / 4) for (let y = 0; y <= h; y += h / 3) { g.beginPath(); g.arc(Math.min(w - 14, Math.max(14, x)), Math.min(h - 14, Math.max(14, y)), 7, 0, 7); g.fill(); }
    for (let k = 0; k < 5; k++) { const cx = rand(60, w - 60), cy = rand(50, h - 50); g.strokeStyle = 'rgba(220,240,250,0.55)'; g.lineWidth = 1.2; for (let a = 0; a < 9; a++) { const an = a * 0.7 + rand(0, 0.3); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * rand(8, 22), cy + Math.sin(an) * rand(8, 22)); g.stroke(); } } },
  jelly(g, w, h) { const gr = g.createRadialGradient(w * 0.4, h * 0.35, 10, w / 2, h / 2, w * 0.7); gr.addColorStop(0, 'rgba(170,255,190,0.92)'); gr.addColorStop(1, 'rgba(40,200,110,0.85)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) { const x = rand(0, w), y = rand(0, h), r = rand(3, 14); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; for (let k = 0; k < 5; k++) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, 40 + k * 60 + Math.sin(x * 0.03 + k) * 10); g.stroke(); } g.strokeStyle = 'rgba(20,120,60,0.8)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); },
  hay(g, w, h) { g.fillStyle = '#c9a247'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,230,150,0.25)'); gr.addColorStop(1, 'rgba(90,55,10,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2800; i++) { g.strokeStyle = pick(['#e8c566', '#b88a2e', '#d9b45a', '#a97b25', '#f0d98a', '#8f6a1f']); g.lineWidth = rand(0.8, 2); const x = rand(-20, w), y = rand(0, h), an = rand(-0.5, 0.5), l = rand(18, 70); g.globalAlpha = rand(0.5, 1); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke(); } g.globalAlpha = 1;
    for (const y of [h * 0.28, h * 0.72]) { g.strokeStyle = '#3a2a14'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.strokeStyle = 'rgba(255,220,150,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y - 2); g.lineTo(w, y - 2); g.stroke(); }
    g.fillStyle = 'rgba(60,35,5,0.35)'; for (const x of [w / 4, w / 2, 3 * w / 4]) g.fillRect(x - 2, 0, 4, h); },
  tires(g, w, h) { g.fillStyle = '#0a0a0d'; g.fillRect(0, 0, w, h); const d = 64; for (let r = 0, y = d / 2; y < h + d; r++, y += d * 0.9) for (let x = (r % 2) * d / 2; x < w + d; x += d) {
      g.fillStyle = '#18181d'; g.beginPath(); g.arc(x, y, d / 2 - 1, 0, 7); g.fill(); g.strokeStyle = '#2a2a31'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, d / 2 - 4, 0, 7); g.stroke();
      for (let k = 0; k < 18; k++) { const an = k / 18 * 6.283; g.strokeStyle = k % 2 ? '#0a0a0d' : '#25252c'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + Math.cos(an) * (d / 2 - 2), y + Math.sin(an) * (d / 2 - 2)); g.lineTo(x + Math.cos(an) * (d / 2 - 8), y + Math.sin(an) * (d / 2 - 8)); g.stroke(); }
      g.fillStyle = '#2e2e35'; g.beginPath(); g.arc(x, y, d * 0.27, 0, 7); g.fill(); g.fillStyle = '#050507'; g.beginPath(); g.arc(x, y, d * 0.17, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, d / 2 - 6, 3.4, 4.5); g.stroke(); }
    this.speck(g, w, h, 900, ['#3a3a40', '#5a5a60', '#222'], 2, 0.4); },
  cake(g, w, h) { const layers = [['#c68a4b', 70], ['#fff2e0', 30], ['#d3344d', 26], ['#c68a4b', 70], ['#fff2e0', 30], ['#e8b6c8', 94]]; let y = h; for (const [c, t] of layers) { y -= t; g.fillStyle = c; g.fillRect(0, y, w, t); }
    this.speck(g, w, h, 900, ['#8a5a2a', '#e0a860', '#6b3f1d'], 3, 0.6); for (let i = 0; i < 160; i++) { g.fillStyle = pick(['#ff4d6d', '#4dd2ff', '#ffe14d', '#7dff6a', '#b06bff']); g.save(); g.translate(rand(0, w), rand(0, 90)); g.rotate(rand(0, 3)); g.fillRect(0, 0, 9, 3.5); g.restore(); }
    g.fillStyle = '#fff6ee'; g.beginPath(); g.moveTo(0, 96); for (let x = 0; x <= w; x += 24) g.quadraticCurveTo(x + 6, 96 + rand(18, 34), x + 12, 96); g.lineTo(w, 0); g.lineTo(0, 0); g.fill(); g.fillStyle = '#d01f3c'; for (const x of [70, 190, 310, 430]) { g.beginPath(); g.arc(x, 30, 17, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x - 5, 24, 4, 0, 7); g.fill(); g.fillStyle = '#d01f3c'; } },
  brick(g, w, h) { g.fillStyle = '#c9c2b0'; g.fillRect(0, 0, w, h); const bw = 42, bh = 17, gap = 3; for (let r = 0, y = 0; y < h; r++, y += bh + gap) for (let x = (r % 2) * -bw / 2; x < w; x += bw + gap) { g.fillStyle = pick(['#a63f2b', '#b5452f', '#9a3626', '#bf5236', '#8f3223']); g.fillRect(x, y, bw, bh); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + bh - 3, bw, 3); g.fillStyle = 'rgba(255,200,170,0.15)'; g.fillRect(x, y, bw, 2); }
    this.speck(g, w, h, 1400, ['#5a2a1f', '#d9a08a', '#7a3a2c', '#e8d9c0'], 2.2, 0.5); },
  stone(g, w, h) { g.fillStyle = '#4a4c52'; g.fillRect(0, 0, w, h); let y = 0; while (y < h) { const bh = rand(46, 78); let x = -rand(0, 60); while (x < w) { const bw = rand(70, 150); const v = rand(100, 150) | 0; g.fillStyle = 'rgb(' + v + ',' + (v + 2) + ',' + (v + 8) + ')'; g.fillRect(x + 2, y + 2, bw - 4, bh - 4); const gr = g.createLinearGradient(x, y, x, y + bh); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(x + 2, y + 2, bw - 4, bh - 4); x += bw; } y += bh; }
    this.speck(g, w, h, 1800, ['#222', '#cfcfcf', '#777'], 2, 0.45); g.strokeStyle = 'rgba(20,20,20,0.6)'; for (let k = 0; k < 7; k++) { g.lineWidth = 1.2; g.beginPath(); let x = rand(0, w), yy = rand(0, h); g.moveTo(x, yy); for (let q = 0; q < 4; q++) { x += rand(-25, 25); yy += rand(5, 25); g.lineTo(x, yy); } g.stroke(); } },
  concrete(g, w, h) { g.fillStyle = '#a2a29c'; g.fillRect(0, 0, w, h); this.speck(g, w, h, 3200, ['#888', '#bbb', '#777', '#c8c8c0'], 2.4, 0.4); for (let k = 0; k < 8; k++) { const x = rand(0, w), gr = g.createLinearGradient(x, 0, x + 20, h); gr.addColorStop(0, 'rgba(60,55,45,0)'); gr.addColorStop(0.5, 'rgba(60,55,45,0.22)'); gr.addColorStop(1, 'rgba(60,55,45,0)'); g.fillStyle = gr; g.fillRect(x, 0, 30, h); }
    g.strokeStyle = 'rgba(40,40,40,0.55)'; g.lineWidth = 2; for (const x of [w / 3, 2 * w / 3]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); g.fillStyle = 'rgba(40,40,40,0.8)'; for (const x of [w / 6, w / 2, 5 * w / 6]) for (const y of [h / 4, 3 * h / 4]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } g.fillStyle = 'rgba(150,70,30,0.5)'; for (let k = 0; k < 5; k++) g.fillRect(rand(0, w), rand(0, h * 0.5), 3, rand(20, 60)); },
  steel(g, w, h) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#aab3c0'); gr.addColorStop(0.5, '#8a94a3'); gr.addColorStop(1, '#6f7886'); g.fillStyle = gr; g.fillRect(0, 0, w, h); this.streaks(g, w, h, 420, 'rgba(255,255,255,0.5)', 0.35, 300); this.streaks(g, w, h, 200, 'rgba(30,35,45,0.5)', 0.3, 260);
    g.strokeStyle = 'rgba(25,28,34,0.9)'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); for (const x of [w / 2]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (let x = 18; x < w; x += 34) for (const y of [14, h - 14, h / 2 - 12, h / 2 + 12]) { g.fillStyle = '#5d6572'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - 1.2, y - 1.2, 1.6, 0, 7); g.fill(); } },
  gold(g, w, h) { const bw = 120, bh = 56; g.fillStyle = '#6b4a00'; g.fillRect(0, 0, w, h); for (let r = 0, y = 4; y < h; r++, y += bh + 6) for (let x = (r % 2) * -bw / 2 + 4; x < w; x += bw + 6) { const gr = g.createLinearGradient(x, y, x + bw, y + bh); gr.addColorStop(0, '#fff0a8'); gr.addColorStop(0.35, '#ffc928'); gr.addColorStop(0.7, '#e0a010'); gr.addColorStop(1, '#fff0a0'); g.fillStyle = gr; g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x + bw - 8, y); g.lineTo(x + bw, y + bh); g.lineTo(x, y + bh); g.closePath(); g.fill(); g.fillStyle = 'rgba(120,70,0,0.7)'; g.font = '700 14px ' + FONT; g.textAlign = 'center'; g.fillText('999.9', x + bw / 2, y + bh / 2 + 5); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 12, y + 3, bw - 30, 3); } },
  diamond(g, w, h) { g.fillStyle = '#bfefff'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const cx = rand(0, w), cy = rand(0, h), n = 3 + (Math.random() * 3 | 0); g.beginPath(); for (let k = 0; k < n; k++) { const an = k / n * 6.283 + rand(0, 0.5), r = rand(24, 70); g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); } g.closePath(); g.fillStyle = 'rgba(' + pick(['255,255,255', '170,225,255', '210,240,255', '150,210,250', '230,250,255']) + ',' + rand(0.25, 0.7).toFixed(2) + ')'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.stroke(); }
    for (let i = 0; i < 26; i++) { const x = rand(10, w - 10), y = rand(10, h - 10), r = rand(6, 16); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); } g.strokeStyle = 'rgba(90,170,220,0.9)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); },
  cracks(g, w, h) { g.clearRect(0, 0, w, h); const cx = w / 2, cy = h / 2; g.lineCap = 'round'; for (let pass = 0; pass < 2; pass++) { g.strokeStyle = pass ? 'rgba(255,255,255,0.95)' : 'rgba(10,10,15,0.55)'; for (let a = 0; a < 18; a++) { let an = a / 18 * 6.283 + rand(-0.15, 0.15), x = cx, y = cy, r = 0; g.lineWidth = pass ? 1.6 : 3.2; g.beginPath(); g.moveTo(x, y); while (r < w * rand(0.28, 0.5)) { r += rand(10, 24); an += rand(-0.25, 0.25); x = cx + Math.cos(an) * r + (pass ? 0 : 1.5); y = cy + Math.sin(an) * r + (pass ? 0 : 1.5); g.lineTo(x, y); if (Math.random() < 0.18) { g.stroke(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an + 0.9) * rand(10, 30), y + Math.sin(an + 0.9) * rand(10, 30)); g.stroke(); g.beginPath(); g.moveTo(x, y); } } g.stroke(); }
    for (const rr of [26, 54, 86, 120]) { g.lineWidth = pass ? 1.2 : 2.4; g.beginPath(); for (let a = 0; a <= 12; a++) { const an = a / 12 * 6.283, r = rr * rand(0.85, 1.12); g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); } g.stroke(); } } },
};
// ---- realistic redraws: window, vault door, thin glass, thick glass, ice ----
const canRect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const canScrew = (g, x, y, r) => { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r); gr.addColorStop(0, '#f2f4f6'); gr.addColorStop(1, '#6c727c'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(30,32,38,0.9)'; g.lineWidth = 0.8; g.stroke(); g.strokeStyle = 'rgba(30,32,38,0.85)'; g.lineWidth = Math.max(0.8, r * 0.28); g.beginPath(); const a = rand(0, 3.14); g.moveTo(x - Math.cos(a) * r * 0.7, y - Math.sin(a) * r * 0.7); g.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); g.stroke(); };
const canPaintedWood = (g, x, y, w, h, vertical) => { // off-white gloss paint over wood: soft shading, grain showing through, a thin light edge and a dark edge
  const gr = vertical ? g.createLinearGradient(x, y, x + w, y) : g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#f7f5ef'); gr.addColorStop(0.45, '#efece3'); gr.addColorStop(1, '#ddd9ce'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = 'rgba(160,145,115,0.22)'; for (let i = 0; i < Math.max(6, (vertical ? w : h) * 0.9); i++) { g.lineWidth = rand(0.4, 1.1); g.beginPath(); if (vertical) { const xx = x + rand(0, w); g.moveTo(xx, y); g.bezierCurveTo(xx + rand(-1.5, 1.5), y + h * 0.3, xx + rand(-1.5, 1.5), y + h * 0.7, xx + rand(-1, 1), y + h); } else { const yy = y + rand(0, h); g.moveTo(x, yy); g.bezierCurveTo(x + w * 0.3, yy + rand(-1.5, 1.5), x + w * 0.7, yy + rand(-1.5, 1.5), x + w, yy + rand(-1, 1)); } g.stroke(); } g.restore();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x, y, w, 1.2); g.fillRect(x, y, 1.2, h); g.fillStyle = 'rgba(70,60,45,0.4)'; g.fillRect(x, y + h - 1.4, w, 1.4); g.fillRect(x + w - 1.4, y, 1.4, h);
};
Object.assign(CAN_DRAW, {
  winFrame(g, w, h, broken) { // a white painted wooden casement window with two sashes, putty, hinges and a lever handle (as in the references: stiles, rails, a wider bottom rail, muntins, sill)
    g.clearRect(0, 0, w, h); const FR = 22, SILL = 38, cx = w / 2, ST = 19, TR = 17, BR = 30, MU = 7, y0 = FR, y1 = h - SILL - 6;
    canPaintedWood(g, 0, 0, w, FR, false); canPaintedWood(g, 0, 0, FR, h - SILL, true); canPaintedWood(g, w - FR, 0, FR, h - SILL, true); // outer frame: head, left and right jambs, each with its own grain
    const glassX = [], lites = [];
    for (let s = 0; s < 2; s++) {
      const x0 = s ? cx + 1 : FR, x1 = s ? w - FR : cx - 1;
      canPaintedWood(g, x0, y0, ST, y1 - y0, true); canPaintedWood(g, x1 - ST, y0, ST, y1 - y0, true); canPaintedWood(g, x0 + ST, y0, x1 - x0 - 2 * ST, TR, false); canPaintedWood(g, x0 + ST, y1 - BR, x1 - x0 - 2 * ST, BR, false);
      const gx0 = x0 + ST, gx1 = x1 - ST, gy0 = y0 + TR, gy1 = y1 - BR, cols = 2, rows = 3, lw = (gx1 - gx0 - MU * (cols - 1)) / cols, lh = (gy1 - gy0 - MU * (rows - 1)) / rows;
      g.strokeStyle = 'rgba(25,22,18,0.8)'; g.lineWidth = 2; g.strokeRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); // the thin gap between the sash and the frame (the glass behind stays clear)
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) lites.push([gx0 + c * (lw + MU), gy0 + r * (lh + MU), lw, lh]);
      for (let c = 1; c < cols; c++) canPaintedWood(g, gx0 + c * lw + (c - 1) * MU, gy0, MU, gy1 - gy0, true);
      for (let r = 1; r < rows; r++) canPaintedWood(g, gx0, gy0 + r * lh + (r - 1) * MU, gx1 - gx0, MU, false);
    }
    for (const [x, y, lw, lh] of lites) { // each pane of glass: reflections that run across the whole window
      g.save(); g.beginPath(); g.rect(x, y, lw, lh); g.clip();
      if (!broken) { // clear glass: almost no tint, only a faint sky reflection, two soft glints and a few water drops, so you see straight through it
        const sky = g.createLinearGradient(0, y, 0, y + lh); sky.addColorStop(0, 'rgba(225,240,250,0.10)'); sky.addColorStop(1, 'rgba(190,215,225,0.05)'); g.fillStyle = sky; g.fillRect(x, y, lw, lh);
        const sx = (w * 0.18), sk = g.createLinearGradient(sx, 0, sx + 150, 120); sk.addColorStop(0.0, 'rgba(255,255,255,0)'); sk.addColorStop(0.35, 'rgba(255,255,255,0.34)'); sk.addColorStop(0.5, 'rgba(255,255,255,0.06)'); sk.addColorStop(0.62, 'rgba(255,255,255,0.26)'); sk.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sk; g.fillRect(x, y, lw, lh);
        const sk2 = g.createLinearGradient(w * 0.62, 0, w * 0.62 + 90, 80); sk2.addColorStop(0, 'rgba(255,255,255,0)'); sk2.addColorStop(0.5, 'rgba(255,255,255,0.16)'); sk2.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sk2; g.fillRect(x, y, lw, lh);
        for (let k = 0; k < 5; k++) { const dx = x + rand(4, lw - 4), dy = y + rand(4, lh - 4), r = rand(0.8, 2.2); g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.arc(dx, dy, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(40,60,80,0.18)'; g.lineWidth = 0.7; g.beginPath(); g.arc(dx, dy, r, 0.4, 3.4); g.stroke(); } // water drops
      } else { g.clearRect(x, y, lw, lh); g.fillStyle = 'rgba(205,238,250,0.85)'; for (let k = 0; k < 9; k++) { const e = k % 4, t = rand(0.08, 0.92), sz = rand(6, 20); g.beginPath(); if (e === 0) { g.moveTo(x + lw * t, y); g.lineTo(x + lw * t + sz * 0.5, y + sz); g.lineTo(x + lw * t - sz * 0.4, y + sz * 0.5); } else if (e === 1) { g.moveTo(x + lw * t, y + lh); g.lineTo(x + lw * t + sz * 0.5, y + lh - sz); g.lineTo(x + lw * t - sz * 0.4, y + lh - sz * 0.5); } else if (e === 2) { g.moveTo(x, y + lh * t); g.lineTo(x + sz, y + lh * t + sz * 0.4); g.lineTo(x + sz * 0.5, y + lh * t - sz * 0.5); } else { g.moveTo(x + lw, y + lh * t); g.lineTo(x + lw - sz, y + lh * t + sz * 0.4); g.lineTo(x + lw - sz * 0.5, y + lh * t - sz * 0.5); } g.closePath(); g.fill(); } }
      g.restore();
      g.strokeStyle = 'rgba(60,55,45,0.7)'; g.lineWidth = 1.4; g.strokeRect(x, y, lw, lh); // putty bevel around the glass: dark where it meets the glass, light on the slope
      g.fillStyle = 'rgba(70,62,48,0.3)'; g.fillRect(x, y, lw, 3); g.fillRect(x, y, 3, lh); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x, y + lh - 2, lw, 2); g.fillRect(x + lw - 2, y, 2, lh);
    }
    // the sill: it sticks out, lighter on top, a drip groove and a shadow on the front edge
    const sg = g.createLinearGradient(0, h - SILL, 0, h); sg.addColorStop(0, '#fbfaf6'); sg.addColorStop(0.38, '#e9e6dc'); sg.addColorStop(0.4, '#cbc7ba'); sg.addColorStop(0.72, '#d6d2c6'); sg.addColorStop(1, '#a9a597'); g.fillStyle = sg; g.fillRect(0, h - SILL, w, SILL);
    g.fillStyle = 'rgba(40,35,25,0.55)'; g.fillRect(0, h - SILL + 13, w, 1.5); g.fillStyle = 'rgba(30,26,20,0.5)'; g.fillRect(0, h - 11, w, 2); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(0, h - SILL, w, 1.5);
    g.fillStyle = 'rgba(30,26,20,0.55)'; g.fillRect(FR - 1, y1, w - 2 * FR + 2, 3); // caulk line under the bottom rail
    // hinges on the outer stiles (butt hinges, screws), steel
    for (const yy of [y0 + 26, (y0 + y1) / 2, y1 - 30]) for (const [xx, dir] of [[FR + 1, 1], [w - FR - 1, -1]]) {
      g.fillStyle = 'rgba(20,18,14,0.5)'; g.fillRect(xx - (dir > 0 ? 1 : 12), yy - 21, 13, 44);
      const hg = g.createLinearGradient(xx, 0, xx + dir * 11, 0); hg.addColorStop(0, '#d9dde3'); hg.addColorStop(0.5, '#8d949f'); hg.addColorStop(1, '#5d636d'); g.fillStyle = hg; g.fillRect(dir > 0 ? xx : xx - 11, yy - 20, 11, 40);
      g.strokeStyle = 'rgba(25,28,34,0.8)'; g.lineWidth = 1; g.strokeRect(dir > 0 ? xx : xx - 11, yy - 20, 11, 40);
      for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#aab1bb' : '#c9ced6'; g.fillRect(xx + (dir > 0 ? 8 : -13), yy - 20 + k * 13.5, 5, 13); g.strokeStyle = 'rgba(25,28,34,0.7)'; g.strokeRect(xx + (dir > 0 ? 8 : -13), yy - 20 + k * 13.5, 5, 13); }
      canScrew(g, xx + dir * 5.5, yy - 13, 2.3); canScrew(g, xx + dir * 5.5, yy + 13, 2.3);
    }
    // the lever handle on the meeting stile, with its back plate and the keep on the other sash
    const hx = cx - 9, hy = (y0 + y1) / 2 + 30;
    g.fillStyle = 'rgba(15,12,8,0.38)'; g.beginPath(); if (g.roundRect) g.roundRect(hx - 8, hy - 44, 20, 96, 6); else g.rect(hx - 8, hy - 44, 20, 96); g.fill(); // shadow
    const pg = g.createLinearGradient(hx - 9, 0, hx + 9, 0); pg.addColorStop(0, '#f4f6f8'); pg.addColorStop(0.5, '#b4bbc6'); pg.addColorStop(1, '#6b727d'); g.fillStyle = pg; g.beginPath(); if (g.roundRect) g.roundRect(hx - 10, hy - 46, 20, 92, 6); else g.rect(hx - 10, hy - 46, 20, 92); g.fill(); g.strokeStyle = 'rgba(30,34,40,0.85)'; g.lineWidth = 1.2; g.stroke();
    canScrew(g, hx, hy - 38, 2.6); canScrew(g, hx, hy + 38, 2.6);
    const rg = g.createRadialGradient(hx - 3, hy - 14, 1, hx, hy - 10, 13); rg.addColorStop(0, '#fbfcfd'); rg.addColorStop(0.55, '#a9b0bb'); rg.addColorStop(1, '#5f6670'); g.fillStyle = rg; g.beginPath(); g.arc(hx, hy - 10, 11, 0, 7); g.fill(); g.strokeStyle = 'rgba(30,34,40,0.9)'; g.stroke();
    g.fillStyle = 'rgba(15,12,8,0.35)'; g.beginPath(); if (g.roundRect) g.roundRect(hx - 3, hy - 14, 14, 62, 6); else g.rect(hx - 3, hy - 14, 14, 62); g.fill();
    const lg = g.createLinearGradient(hx - 6, 0, hx + 6, 0); lg.addColorStop(0, '#fdfdfe'); lg.addColorStop(0.5, '#aeb5c0'); lg.addColorStop(1, '#555c66'); g.fillStyle = lg; g.beginPath(); if (g.roundRect) g.roundRect(hx - 5, hy - 12, 11, 58, 5.5); else g.rect(hx - 5, hy - 12, 11, 58); g.fill(); g.strokeStyle = 'rgba(30,34,40,0.9)'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(hx - 3, hy - 4, 2, 44);
    canRect(g, cx + 6, hy - 9, 7, 18, '#9aa1ac'); g.strokeStyle = 'rgba(30,34,40,0.8)'; g.strokeRect(cx + 6, hy - 9, 7, 18); canScrew(g, cx + 9.5, hy - 4, 1.6); canScrew(g, cx + 9.5, hy + 4, 1.6);
    // wear: dirt along the bottom, chipped paint on the corners, a scuff round the handle
    const dg = g.createLinearGradient(0, h - SILL - 40, 0, h - SILL); dg.addColorStop(0, 'rgba(90,80,60,0)'); dg.addColorStop(1, 'rgba(90,80,60,0.28)'); g.fillStyle = dg; g.fillRect(0, h - SILL - 40, w, 40);
    g.fillStyle = 'rgba(176,138,92,0.85)'; for (let k = 0; k < 10; k++) { const e = k % 4, px = e < 2 ? rand(FR, w - FR) : (e === 2 ? FR + rand(0, 6) : w - FR - rand(0, 6)), py = e === 0 ? y0 + rand(0, 6) : e === 1 ? y1 - rand(0, 6) : rand(y0, y1); g.beginPath(); g.ellipse(px, py, rand(1, 3), rand(0.8, 2), rand(0, 3), 0, 7); g.fill(); }
  },
  window(g, w, h) { this.winFrame(g, w, h, false); },
  windowBroken(g, w, h) { this.winFrame(g, w, h, true); },
});

Object.assign(CAN_DRAW, {
  vault(g, w, h) { // a round bank vault door in a steel frame: ring of locking bolts, hinge block, five-spoke ship wheel with a combination dial in the hub, name plate (as in the references)
    const cx = w / 2 + 6, cy = h / 2, R = 136;
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#454c57'); bg.addColorStop(0.5, '#363c46'); bg.addColorStop(1, '#2a2f37'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) { g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'; g.lineWidth = rand(0.5, 1.3); const yy = rand(0, h), xx = rand(-30, w); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + rand(40, 260), yy); g.stroke(); } // brushed steel
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.strokeRect(7, 7, w - 14, h - 14);
    for (const [x, y] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) canScrew(g, x, y, 7);
    // soft shadow of the door on the frame
    const sh = g.createRadialGradient(cx + 5, cy + 8, R - 4, cx + 5, cy + 8, R + 26); sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
    // jamb ring with the bolt cavities
    const jg = g.createRadialGradient(cx, cy, R, cx, cy, R + 16); jg.addColorStop(0, '#1b1e24'); jg.addColorStop(1, '#4b525d'); g.fillStyle = jg; g.beginPath(); g.arc(cx, cy, R + 14, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R + 14, 0, 7); g.stroke();
    // door rim: a thick bevelled ring of steel with the 24 polished locking bolts
    const rg = g.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, R); rg.addColorStop(0, '#9aa2ae'); rg.addColorStop(0.55, '#6c7480'); rg.addColorStop(1, '#3e444e'); g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    for (let k = 0; k < 24; k++) { const an = k / 24 * 6.2832 + 0.13, bx = cx + Math.cos(an) * (R - 9), by = cy + Math.sin(an) * (R - 9);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(bx + 1.5, by + 2, 6.5, 0, 7); g.fill();
      const bgd = g.createRadialGradient(bx - 2, by - 2, 0.5, bx, by, 6.5); bgd.addColorStop(0, '#ffffff'); bgd.addColorStop(0.45, '#c3c9d2'); bgd.addColorStop(1, '#5a616c'); g.fillStyle = bgd; g.beginPath(); g.arc(bx, by, 6, 0, 7); g.fill(); g.strokeStyle = 'rgba(20,22,28,0.8)'; g.lineWidth = 0.8; g.stroke(); }
    // door face: turned steel (fine concentric lines), a raised inner panel and a light crescent
    const fg = g.createRadialGradient(cx - 35, cy - 45, 10, cx, cy, R - 22); fg.addColorStop(0, '#8d95a1'); fg.addColorStop(0.6, '#5f6772'); fg.addColorStop(1, '#3a4049'); g.fillStyle = fg; g.beginPath(); g.arc(cx, cy, R - 22, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; for (let r = 4; r < R - 22; r += 2.6) { g.lineWidth = rand(0.4, 0.9); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R - 23, 3.45, 4.75); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R - 23, 0.3, 1.6); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 98, 0, 7); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 100.5, 0, 7); g.stroke();
    for (let k = 0; k < 12; k++) { const an = k / 12 * 6.2832; canScrew(g, cx + Math.cos(an) * 91, cy + Math.sin(an) * 91, 4); }
    // five-spoke ship wheel (brass): a rim, spokes tapering to the hub, ball ends
    const brass = (x, y, r) => { const b = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r); b.addColorStop(0, '#fff3b0'); b.addColorStop(0.4, '#e0b23a'); b.addColorStop(1, '#7d5510'); return b; };
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(cx + 7, cy + 10, 74, 74, 0, 0, 7); g.fill();
    for (let k = 0; k < 5; k++) { const an = -1.5708 + k / 5 * 6.2832; g.save(); g.translate(cx, cy); g.rotate(an); g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.moveTo(0, -5 + 6); g.lineTo(74, -3 + 6); g.lineTo(74, 4 + 6); g.lineTo(0, 7 + 6); g.fill();
      const sg = g.createLinearGradient(0, -6, 0, 6); sg.addColorStop(0, '#fff0a8'); sg.addColorStop(0.5, '#d9a52e'); sg.addColorStop(1, '#6b4709'); g.fillStyle = sg; g.beginPath(); g.moveTo(0, -7); g.lineTo(74, -3.5); g.lineTo(74, 3.5); g.lineTo(0, 7); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,40,5,0.8)'; g.lineWidth = 0.9; g.stroke(); g.restore(); }
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 9; g.beginPath(); g.arc(cx + 3, cy + 5, 70, 0, 7); g.stroke();
    const rimG = g.createLinearGradient(cx - 70, cy - 70, cx + 70, cy + 70); rimG.addColorStop(0, '#fff0a8'); rimG.addColorStop(0.5, '#d9a52e'); rimG.addColorStop(1, '#6b4709'); g.strokeStyle = rimG; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 72.5, 3.6, 5.2); g.stroke();
    for (let k = 0; k < 5; k++) { const an = -1.5708 + k / 5 * 6.2832, bx = cx + Math.cos(an) * 86, by = cy + Math.sin(an) * 86; g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(bx + 3, by + 4, 12, 0, 7); g.fill(); g.fillStyle = brass(bx, by, 12); g.beginPath(); g.arc(bx, by, 12, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,40,5,0.8)'; g.lineWidth = 1; g.stroke(); }
    // hub with the combination dial
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(cx + 3, cy + 5, 31, 0, 7); g.fill(); g.fillStyle = brass(cx, cy, 31); g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,40,5,0.85)'; g.lineWidth = 1.2; g.stroke();
    const dg = g.createRadialGradient(cx - 6, cy - 6, 1, cx, cy, 23); dg.addColorStop(0, '#2c313a'); dg.addColorStop(1, '#0b0d11'); g.fillStyle = dg; g.beginPath(); g.arc(cx, cy, 22.5, 0, 7); g.fill(); g.strokeStyle = '#c9ced6'; g.lineWidth = 2; g.stroke();
    for (let k = 0; k < 50; k++) { const an = k / 50 * 6.2832 - 1.5708, big = k % 5 === 0; g.strokeStyle = big ? '#ffffff' : 'rgba(230,235,245,0.7)'; g.lineWidth = big ? 1.4 : 0.8; g.beginPath(); g.moveTo(cx + Math.cos(an) * (big ? 14.5 : 17), cy + Math.sin(an) * (big ? 14.5 : 17)); g.lineTo(cx + Math.cos(an) * 21, cy + Math.sin(an) * 21); g.stroke(); }
    g.fillStyle = '#ffffff'; g.font = '700 5.5px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let k = 0; k < 10; k++) { const an = k / 10 * 6.2832 - 1.5708; g.fillText(String(k * 10), cx + Math.cos(an) * 10.5, cy + Math.sin(an) * 10.5); }
    g.fillStyle = '#e8322b'; g.beginPath(); g.moveTo(cx, cy - 24); g.lineTo(cx - 3.5, cy - 31); g.lineTo(cx + 3.5, cy - 31); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx - 6, cy - 9, 9, 4, -0.5, 0, 7); g.fill();
    // name plate and small lock covers
    const pg = g.createLinearGradient(0, cy + 96, 0, cy + 118); pg.addColorStop(0, '#f6dc86'); pg.addColorStop(0.5, '#cf9d2c'); pg.addColorStop(1, '#8a6212'); g.fillStyle = pg; g.fillRect(cx - 50, cy + 100, 100, 18); g.strokeStyle = 'rgba(60,40,5,0.85)'; g.lineWidth = 1.2; g.strokeRect(cx - 50, cy + 100, 100, 18); g.fillStyle = '#3d2a05'; g.font = '700 11px ' + FONT; g.fillText('SAFE DEPOSIT', cx, cy + 109.5); canScrew(g, cx - 45, cy + 109, 2); canScrew(g, cx + 45, cy + 109, 2);
    // the hinge block on the left: three massive knuckles on a pin, bolted to the frame
    const hx = cx - R - 56;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(hx - 6, cy - 120, 34, 240);
    const pn = g.createLinearGradient(hx - 4, 0, hx + 22, 0); pn.addColorStop(0, '#d3d8df'); pn.addColorStop(0.4, '#7e8692'); pn.addColorStop(1, '#3e444e'); g.fillStyle = pn; g.fillRect(hx, cy - 125, 20, 250);
    for (const yy of [cy - 90, cy, cy + 90]) { const kg = g.createLinearGradient(hx - 8, 0, hx + 30, 0); kg.addColorStop(0, '#eef1f4'); kg.addColorStop(0.35, '#98a0ab'); kg.addColorStop(1, '#3b414a'); g.fillStyle = kg; g.beginPath(); if (g.roundRect) g.roundRect(hx - 8, yy - 30, 40, 60, 6); else g.rect(hx - 8, yy - 30, 40, 60); g.fill(); g.strokeStyle = 'rgba(15,17,22,0.9)'; g.lineWidth = 1.4; g.stroke(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(hx - 8, yy - 3, 40, 6); canScrew(g, hx + 2, yy - 20, 3.5); canScrew(g, hx + 2, yy + 20, 3.5); canScrew(g, hx + 22, yy - 20, 3.5); canScrew(g, hx + 22, yy + 20, 3.5);
      g.fillStyle = '#6c737e'; g.fillRect(hx + 30, yy - 12, cx - R - 14 - (hx + 30), 24); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(hx + 30, yy - 12, cx - R - 14 - (hx + 30), 3); } // the arms from the door to the hinge
    // relocker cover on the right
    const rx = cx + R + 40; g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(rx - 2, cy - 36, 38, 74); const cg = g.createLinearGradient(rx, 0, rx + 34, 0); cg.addColorStop(0, '#8b929d'); cg.addColorStop(1, '#4a515b'); g.fillStyle = cg; g.fillRect(rx, cy - 38, 34, 74); g.strokeStyle = 'rgba(15,17,22,0.9)'; g.strokeRect(rx, cy - 38, 34, 74); for (const [x, y] of [[rx + 6, cy - 31], [rx + 28, cy - 31], [rx + 6, cy + 29], [rx + 28, cy + 29]]) canScrew(g, x, y, 3);
    g.fillStyle = '#2b2f36'; g.fillRect(rx + 8, cy - 12, 18, 24); g.fillStyle = '#d9a52e'; g.font = '700 7px ' + FONT; g.fillText('RELOCK', rx + 17, cy);
    // scratches, fingerprints and dirt
    g.strokeStyle = 'rgba(255,255,255,0.22)'; for (let k = 0; k < 26; k++) { const an = rand(0, 6.28), r = rand(30, R - 25), x = cx + Math.cos(an) * r, y = cy + Math.sin(an) * r; g.lineWidth = rand(0.4, 1); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-14, 14), y + rand(-6, 6)); g.stroke(); }
    const dirt = g.createLinearGradient(0, h - 60, 0, h); dirt.addColorStop(0, 'rgba(10,8,5,0)'); dirt.addColorStop(1, 'rgba(10,8,5,0.35)'); g.fillStyle = dirt; g.fillRect(0, h - 60, w, 60);
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  },
});

Object.assign(CAN_DRAW, {
  glassPane(g, w, h, tint, edgeCol, thick, a1) { // a pane of glass in a slim metal clip frame: sky reflection, bright streaks, a polished green edge, corner fittings
    g.clearRect(0, 0, w, h); const E = thick ? 20 : 9;
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, rgba(tint, a1 * 1.25)); sky.addColorStop(0.55, rgba(tint, a1 * 0.6)); sky.addColorStop(1, rgba([90, 120, 110], a1 * 0.9)); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,50,75,0.10)'; for (let k = 0; k < 14; k++) { const bx = k * 38 + rand(0, 14), bh = rand(20, 90); g.fillRect(bx, h - E - bh, rand(20, 40), bh); } // a faint city mirrored in the glass
    for (const [x0, wd, a] of [[0.06, 0.07, 0.38], [0.2, 0.02, 0.6], [0.52, 0.12, 0.2], [0.74, 0.03, 0.45], [0.86, 0.06, 0.18]]) { const sk = g.createLinearGradient(w * x0, 0, w * (x0 + wd), 0); sk.addColorStop(0, 'rgba(255,255,255,0)'); sk.addColorStop(0.5, 'rgba(255,255,255,' + a + ')'); sk.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); g.transform(1, 0, -0.55, 1, h * 0.55, 0); g.fillStyle = sk; g.fillRect(w * x0 - h * 0.3, 0, w * wd + 4, h); g.restore(); }
    for (let k = 0; k < 5; k++) { const x = rand(20, w - 20); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = rand(1, 2.5); g.beginPath(); g.moveTo(x, E); g.lineTo(x + rand(-4, 4), h * rand(0.4, 0.95)); g.stroke(); } // water streaks
    const dg = g.createLinearGradient(0, h - 50, 0, h); dg.addColorStop(0, 'rgba(70,80,60,0)'); dg.addColorStop(1, 'rgba(70,80,60,0.22)'); g.fillStyle = dg; g.fillRect(0, h - 50, w, 50);
    // polished edge: you see the glass from the side, green and thick
    const eg = g.createLinearGradient(0, 0, 0, E); eg.addColorStop(0, rgba(edgeCol, 0.95)); eg.addColorStop(1, rgba(edgeCol, 0.55)); g.fillStyle = eg; g.fillRect(0, 0, w, E); const eg2 = g.createLinearGradient(0, h - E, 0, h); eg2.addColorStop(0, rgba(edgeCol, 0.55)); eg2.addColorStop(1, rgba(edgeCol, 0.95)); g.fillStyle = eg2; g.fillRect(0, h - E, w, E);
    const eg3 = g.createLinearGradient(0, 0, E, 0); eg3.addColorStop(0, rgba(edgeCol, 0.95)); eg3.addColorStop(1, rgba(edgeCol, 0.5)); g.fillStyle = eg3; g.fillRect(0, 0, E, h); const eg4 = g.createLinearGradient(w - E, 0, w, 0); eg4.addColorStop(0, rgba(edgeCol, 0.5)); eg4.addColorStop(1, rgba(edgeCol, 0.95)); g.fillStyle = eg4; g.fillRect(w - E, 0, E, h);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.6; g.strokeRect(E, E, w - 2 * E, h - 2 * E); g.strokeStyle = 'rgba(10,40,35,0.55)'; g.lineWidth = 1.2; g.strokeRect(1, 1, w - 2, h - 2);
    for (const [x, y] of [[E + 18, E + 18], [w - E - 18, E + 18], [E + 18, h - E - 18], [w - E - 18, h - E - 18]]) { const sg = g.createRadialGradient(x - 3, y - 3, 1, x, y, 13); sg.addColorStop(0, '#f6f8fa'); sg.addColorStop(1, '#5d646e'); g.fillStyle = sg; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.strokeStyle = 'rgba(20,24,30,0.9)'; g.lineWidth = 1.2; g.stroke(); canScrew(g, x, y, 4.2); } // corner fittings
  },
  glass(g, w, h) { this.glassPane(g, w, h, [205, 232, 248], [150, 215, 190], false, 0.22); },
  glass2(g, w, h) { this.glassPane(g, w, h, [160, 215, 205], [60, 150, 125], true, 0.34); },
  ice(g, w, h) { // a block of ice: clear blue-white, trapped bubbles, deep blurred cracks and frost at the edges
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(160,215,245,0.92)'); gr.addColorStop(0.45, 'rgba(225,244,255,0.88)'); gr.addColorStop(1, 'rgba(120,190,235,0.94)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 7; k++) { const x = rand(0, w), gg = g.createRadialGradient(x, rand(0, h), 4, x, rand(0, h), rand(60, 140)); gg.addColorStop(0, 'rgba(255,255,255,0.35)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gg; g.fillRect(0, 0, w, h); }
    g.save(); g.shadowColor = 'rgba(60,140,210,0.9)'; g.shadowBlur = 7; for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = rand(1, 2.6); g.beginPath(); let x = rand(0, w), y = rand(0, h); g.moveTo(x, y); for (let q = 0; q < 7; q++) { x += rand(-45, 45); y += rand(-30, 38); g.lineTo(x, y); } g.stroke(); } g.restore();
    for (let k = 0; k < 90; k++) { const x = rand(0, w), y = rand(0, h), r = rand(1.5, 7); g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.9; g.beginPath(); g.arc(x, y, r, 3.6, 5.3); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.22, 0, 7); g.fill(); }
    const fr = g.createLinearGradient(0, 0, 0, 38); fr.addColorStop(0, 'rgba(255,255,255,0.9)'); fr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fr; g.fillRect(0, 0, w, 38); const fr2 = g.createLinearGradient(0, h, 0, h - 38); fr2.addColorStop(0, 'rgba(255,255,255,0.9)'); fr2.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fr2; g.fillRect(0, h - 38, w, 38);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.strokeStyle = 'rgba(70,140,205,0.8)'; g.lineWidth = 2; g.strokeRect(7, 7, w - 14, h - 14);
  },
});

Object.assign(CAN_DRAW, {
  grainLines(g, x, y, w, h, n, col, a, vertical) { // wavy, cathedral-style wood grain
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = col;
    for (let k = 0; k < n; k++) { const off = (k / n) * (vertical ? w : h), amp = rand(1, 6), fr = rand(0.012, 0.035), ph = rand(0, 6.3); g.lineWidth = rand(0.5, 1.6); g.globalAlpha = a * rand(0.4, 1); g.beginPath();
      for (let t = 0; t <= (vertical ? h : w); t += 4) { const o = off + amp * Math.sin(t * fr + ph) + 3 * Math.sin(t * fr * 0.37 + ph * 2); if (vertical) g.lineTo(x + o, y + t); else g.lineTo(x + t, y + o); } g.stroke(); }
    g.restore(); g.globalAlpha = 1;
  },
  knot(g, x, y, r) { const gr = g.createRadialGradient(x, y, 1, x, y, r * 1.9); gr.addColorStop(0, 'rgba(60,32,12,0.95)'); gr.addColorStop(0.5, 'rgba(95,55,22,0.8)'); gr.addColorStop(1, 'rgba(95,55,22,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 1.9, r * 1.1, 0.1, 0, 7); g.fill(); g.strokeStyle = 'rgba(70,40,15,0.55)'; for (let k = 1; k < 4; k++) { g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r * (1 + k * 0.5), r * (0.55 + k * 0.28), 0.1, 0, 7); g.stroke(); } },
  ply(g, w, h) { // plywood sheets: veneer with cathedral grain, a glue seam, screws, a few knots
    const hh = h / 2; for (let i = 0; i < 2; i++) { const y = i * hh, gr = g.createLinearGradient(0, y, w, y + hh); const tone = i ? ['#d5a96b', '#c99a5a'] : ['#dcb277', '#d0a363']; gr.addColorStop(0, tone[0]); gr.addColorStop(1, tone[1]); g.fillStyle = gr; g.fillRect(0, y, w, hh);
      this.grainLines(g, 0, y, w, hh, 46, '#9a6a35', 0.5, false); this.grainLines(g, 0, y, w, hh, 30, '#f0cd98', 0.35, false); for (let k = 0; k < 2; k++) this.knot(g, rand(40, w - 40), y + rand(25, hh - 25), rand(5, 10)); }
    g.fillStyle = 'rgba(70,40,15,0.85)'; g.fillRect(0, hh - 1.5, w, 3); g.fillStyle = 'rgba(255,235,200,0.45)'; g.fillRect(0, hh + 1.5, w, 1.2);
    g.strokeStyle = 'rgba(80,50,20,0.9)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    for (let x = 22; x < w; x += 58) for (const y of [14, hh - 14, hh + 14, h - 14]) { const sg = g.createRadialGradient(x - 1, y - 1, 0.5, x, y, 4); sg.addColorStop(0, '#e8eaee'); sg.addColorStop(1, '#6b717b'); g.fillStyle = sg; g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fill(); g.strokeStyle = 'rgba(30,30,35,0.8)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(60,35,12,0.4)'; g.beginPath(); g.ellipse(x + 1.5, y + 2.5, 5, 3, 0, 0, 7); g.fill(); }
  },
  oak(g, w, h) { // dark oak boards: gaps, long grain, a few knots, square-head screws
    const n = 6, pw = w / n; for (let i = 0; i < n; i++) { const gr = g.createLinearGradient(i * pw, 0, (i + 1) * pw, 0); const c = pick([['#6e411d', '#5a3416'], ['#7a4b22', '#63391a'], ['#684018', '#553115'], ['#80502a', '#6a4020']]); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fillRect(i * pw, 0, pw, h);
      this.grainLines(g, i * pw, 0, pw, h, 26, 'rgba(25,12,4,1)', 0.55, true); this.grainLines(g, i * pw, 0, pw, h, 12, 'rgba(210,150,90,1)', 0.18, true); if (Math.random() < 0.7) this.knot(g, i * pw + rand(10, pw - 10), rand(40, h - 40), rand(4, 8));
      g.fillStyle = 'rgba(12,6,2,0.95)'; g.fillRect(i * pw - 1.5, 0, 3, h); g.fillStyle = 'rgba(255,215,160,0.18)'; g.fillRect(i * pw + 1.5, 0, 1.2, h);
      for (const y of [16, h - 16]) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(i * pw + pw / 2 + 1.5, y + 2, 5, 3, 0, 0, 7); g.fill(); const sg = g.createLinearGradient(0, y - 4, 0, y + 4); sg.addColorStop(0, '#9aa0a8'); sg.addColorStop(1, '#4a4f58'); g.fillStyle = sg; g.fillRect(i * pw + pw / 2 - 4, y - 4, 8, 8); g.strokeStyle = 'rgba(15,15,20,0.9)'; g.lineWidth = 0.9; g.strokeRect(i * pw + pw / 2 - 4, y - 4, 8, 8); } }
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.15, 'rgba(0,0,0,0)'); sh.addColorStop(0.85, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
  },
});

function canHoleR(h, th) { // radius of the hole in direction th: uneven all the way round, with spikes. The fragment shader uses the same formula.
  const n = 0.5 + 0.22 * Math.sin(2 * th + h.ph[0]) + 0.17 * Math.sin(4 * th + h.ph[1]) + 0.12 * Math.sin(7 * th + h.ph[2]) + 0.09 * Math.sin(11 * th + h.ph[3]);
  const x = (th + h.ph[0]) * h.F / 6.2831853, saw = (x - Math.floor(x)) * 2 - 1;
  return h.R * (0.5 + 0.35 * n) * (1 + h.A * saw);
}
function canWallMat(map, W) { // the wall's own material: a smooth, pixel-exact hole is cut by the fragment shader
  const clear = W.kind === 'glass' || W.kind === 'ice' || W.kind === 'window', U = { uCrk: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uCrC: { value: new THREE.Vector4(W.crk[0], W.crk[1], W.crk[2], W.crk[3]) }, uHole: { value: new THREE.Vector4(0, 0, 1, 0) }, uPh: { value: new THREE.Vector4() }, uJag: { value: new THREE.Vector4(W.jag[0], W.jag[1], W.jag[2], W.jag[3]) }, uEdge: { value: new THREE.Color(W.edge) } };
  const mat = new THREE.MeshStandardMaterial({ map, roughness: W.kind === 'glass' || W.kind === 'ice' ? 0.08 : W.kind === 'metal' ? 0.35 : 0.75, metalness: W.kind === 'metal' ? 0.85 : 0.05, transparent: clear, side: THREE.DoubleSide, depthWrite: !clear });
  mat.userData.U = U; const BUMP = { brick: -1.6, stone: 2, concrete: 1.5, oak: 1.2, ply: 1, hay: 1.5, steel: 1.5, gold: 1.6, vault: 2, diamond: 1, window: 0.8 }[W.draw]; if (BUMP) { mat.bumpMap = map; mat.bumpScale = BUMP; } // relief from the picture itself: mortar, grain, rivets, bolts
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLP; uniform vec4 uHole, uPh, uJag, uCrk[8], uCrC; uniform vec3 uEdge;
float holeR(float th) { float n = 0.5 + 0.22 * sin(2.0 * th + uPh.x) + 0.17 * sin(4.0 * th + uPh.y) + 0.12 * sin(7.0 * th + uPh.z) + 0.09 * sin(11.0 * th + uPh.w); float x = (th + uPh.x) * uJag.y / 6.2831853; float saw = fract(x) * 2.0 - 1.0; return uHole.z * (0.5 + 0.35 * n) * (1.0 + uJag.x * saw); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
if (uHole.w > 0.5) {
  vec2 d = vLP.xy - uHole.xy; float dist = length(d), ang = atan(d.y, d.x), r = uHole.w > 1.5 ? uHole.z : holeR(ang);
  if (uHole.w < 1.5) { if (dist < r) discard; float rim = 1.0 - smoothstep(0.0, uJag.w, dist - r); diffuseColor.rgb = mix(diffuseColor.rgb, uEdge, rim * 0.9); float dk = 1.0 - smoothstep(0.0, 0.4, dist - r); diffuseColor.rgb *= 1.0 - uJag.z * dk; }
  else { float cr = 1.0 - smoothstep(0.0, 0.3, dist); diffuseColor.rgb *= 1.0 - uJag.z * cr * 1.3; }
  if (uCrC.w > 0.0) {
    float crack = 0.0, along = dist - r;
    for (int i = 0; i < 8; i++) { vec4 c = uCrk[i]; if (c.y > 0.0 && along > 0.0) {
      float a = c.x + 0.06 * (abs(fract(dist * 3.2 + c.z) - 0.5) * 4.0 - 1.0) + 0.018 * (abs(fract(dist * 9.0 + c.z * 2.0) - 0.5) * 4.0 - 1.0);
      float perp = abs(mod(ang - a + 3.14159265, 6.2831853) - 3.14159265) * dist;
      float w = 0.008 + 0.012 * (1.0 - smoothstep(0.0, c.y, along));
      float ln1 = (1.0 - smoothstep(w * 0.3, w, perp)) * (1.0 - smoothstep(c.y * 0.6, c.y, along));
      float sg = sin(c.z * 7.0) > 0.0 ? 1.0 : -1.0, a2 = a + sg * 0.5, al2 = along - c.y * 0.35;
      float perp2 = abs(mod(ang - a2 + 3.14159265, 6.2831853) - 3.14159265) * dist;
      float ln2 = al2 > 0.0 ? (1.0 - smoothstep(0.006, 0.014, perp2)) * (1.0 - smoothstep(c.y * 0.15, c.y * 0.45, al2)) : 0.0;
      crack = max(crack, max(ln1, ln2)); } }
    diffuseColor.rgb = mix(diffuseColor.rgb, uCrC.rgb, crack * uCrC.w);
  }
}`);
  };
  return mat;
}
function canTube(i, h) { // the inside of the hole: a ring of wall between the front and the back face, following the same uneven edge
  const tb = CAN.walls[i].userData.tube, W = CANNON_WALLS[i], N = 72, p = tb.geometry.attributes.position.array, uv = tb.geometry.attributes.uv.array, z = W.T / 2;
  for (let j = 0; j <= N; j++) { const th = j / N * 6.2831853, r = h.rad(th), x = clamp(h.px + Math.cos(th) * r, -3, 3), y = clamp(h.py + Math.sin(th) * r, 0, 3.8), a = j * 6;
    p[a] = x; p[a + 1] = y; p[a + 2] = z; p[a + 3] = x; p[a + 4] = y; p[a + 5] = -z; uv[j * 4] = (x + 3) / 6; uv[j * 4 + 1] = y / 3.8; uv[j * 4 + 2] = (x + 3) / 6; uv[j * 4 + 3] = y / 3.8; }
  tb.geometry.attributes.position.needsUpdate = true; tb.geometry.attributes.uv.needsUpdate = true; tb.geometry.computeVertexNormals(); tb.geometry.computeBoundingSphere(); tb.visible = true;
}
function canShardGeo() {
  if (CAN.geo) return CAN.geo; const G = CAN.geo = { glass: [], chunk: [], blob: [], splint: [], plate: [], paper: [] };
  for (let i = 0; i < 6; i++) { const a = rand(0.2, 0.55), sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(a * rand(0.7, 1.3), a * rand(-0.15, 0.15)); sh.lineTo(a * rand(0.1, 0.7), a * rand(0.5, 1.3)); if (i % 2) sh.lineTo(-a * rand(0.1, 0.4), a * rand(0.2, 0.6)); G.glass.push(new THREE.ShapeGeometry(sh)); }
  for (let i = 0; i < 7; i++) { const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position, jit = new Map(); for (let k = 0; k < p.count; k++) { const key = p.getX(k).toFixed(3) + ',' + p.getY(k).toFixed(3) + ',' + p.getZ(k).toFixed(3); if (!jit.has(key)) jit.set(key, rand(0.7, 1.25)); const f = jit.get(key); p.setXYZ(k, p.getX(k) * f, p.getY(k) * f, p.getZ(k) * f); } g.scale(rand(0.7, 1.3), rand(0.5, 1), rand(0.6, 1.2)); g.computeVertexNormals(); G.chunk.push(g); }
  for (let i = 0; i < 3; i++) { const g = new THREE.SphereGeometry(1, 9, 7); g.scale(rand(0.8, 1.3), rand(0.6, 1), rand(0.8, 1.2)); G.blob.push(g); }
  for (let i = 0; i < 6; i++) { const g = new THREE.BoxGeometry(rand(0.04, 0.09), rand(0.03, 0.06), rand(0.4, 1.3)), p = g.attributes.position; for (let k = 0; k < p.count; k++) if (p.getZ(k) > 0) p.setXYZ(k, p.getX(k) * 0.15, p.getY(k) * 0.3, p.getZ(k)); g.computeVertexNormals(); G.splint.push(g); }
  for (let i = 0; i < 4; i++) { const g = new THREE.PlaneGeometry(rand(0.35, 0.65), rand(0.25, 0.5), 4, 4), p = g.attributes.position, ph = rand(0, 6); for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) + rand(-0.04, 0.04), p.getY(k) + rand(-0.04, 0.04), Math.sin(p.getX(k) * 7 + ph) * 0.07 + p.getY(k) * 0.18); g.computeVertexNormals(); G.plate.push(g); }
  G.paper.push(new THREE.PlaneGeometry(0.22, 0.3), new THREE.PlaneGeometry(0.3, 0.2), new THREE.PlaneGeometry(0.16, 0.16));
  return G;
}
function canWheel(r, wd, spokes, rimM, spokeM) {
  const g = new THREE.Group(), ring = new THREE.Group(); const rim = new THREE.Mesh(new THREE.TorusGeometry(r, wd * 0.5, 8, 28), rimM); ring.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, wd * 1.6, 14), rimM); hub.rotation.x = Math.PI / 2; ring.add(hub);
  for (let k = 0; k < spokes; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 0.09, r * 1.9, wd * 0.5), spokeM); sp.rotation.z = k * Math.PI / spokes; ring.add(sp); }
  ring.rotation.y = Math.PI / 2; g.add(ring); return g;
}
function canModel(lv) { // five cannons, each bigger and meaner; the muzzle is at z = MUZZLE_Z
  const S = CAN_SPEC[lv - 1], g = new THREE.Group(), M = (c, m = 0.75, r = 0.4, e = 0) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, emissive: e ? c : 0x000000, emissiveIntensity: e });
  const wood = M(0x7a4d28, 0.05, 0.8), iron = M(0x2b2d33, 0.8, 0.45), steel = M(0x6b7280, 0.85, 0.35), barrelM = M(S.col, 0.7, 0.35), bandM = M(S.band, S.glow ? 0.3 : 0.8, 0.3, S.glow ? 1.6 : 0), dark = M(0x101114, 0.5, 0.6);
  try { const env = labEnv(); for (const m of [iron, steel, barrelM, bandM]) { m.envMap = env; m.envMapIntensity = 0.9; } } catch (e) {}
  const yb = S.wr + 0.35, zc = MUZZLE_Z + S.L * 0.55, barrel = new THREE.Group(); barrel.position.set(LAB_LANE, yb, MUZZLE_Z + S.L); g.add(barrel); g.userData.barrel = barrel;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(S.r1, S.r0, S.L, 36), barrelM); tube.rotation.x = -Math.PI / 2; tube.position.z = -S.L / 2; tube.castShadow = true; barrel.add(tube);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(S.r0, 24, 16), barrelM); cap.position.z = 0; barrel.add(cap);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(S.r0 * 0.3, 12, 10), bandM); knob.position.z = S.r0 * 0.95; barrel.add(knob);
  const nb = 3 + lv; for (let k = 0; k < nb; k++) { const t = (k + 0.7) / (nb + 0.5), r = S.r0 + (S.r1 - S.r0) * t, b = new THREE.Mesh(new THREE.TorusGeometry(r + 0.025, 0.045 + lv * 0.01, 8, 36), bandM); b.position.z = -S.L * t; barrel.add(b); }
  const flare = new THREE.Mesh(new THREE.TorusGeometry(S.r1 + 0.03, 0.09 + lv * 0.012, 10, 36), bandM); flare.position.z = -S.L; barrel.add(flare);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(S.r1 * 0.9, 28), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })); hole.position.z = -S.L + 0.04; barrel.add(hole);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), dark); fuse.position.set(0, S.r0 + 0.1, S.r0 * 0.4); fuse.rotation.x = 0.4; barrel.add(fuse);
  if (S.wheel === 'wood' || S.wheel === 'iron' || S.wheel === 'steel') {
    const rimM = S.wheel === 'wood' ? wood : S.wheel === 'iron' ? iron : steel, spM = S.wheel === 'wood' ? wood : steel, sp = S.wheel === 'steel' ? 10 : 8;
    for (const sx of [-1, 1]) { const w = canWheel(S.wr, S.wr * 0.16, sp, rimM, spM); w.position.set(LAB_LANE + sx * (S.r0 + 0.55), S.wr, zc); g.add(w); if (S.wheel !== 'wood') { const tyre = new THREE.Mesh(new THREE.TorusGeometry(S.wr, S.wr * 0.12, 8, 28), iron); tyre.rotation.y = Math.PI / 2; tyre.position.copy(w.position); g.add(tyre); } }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, (S.r0 + 0.55) * 2, 10), iron); axle.rotation.z = Math.PI / 2; axle.position.set(LAB_LANE, S.wr, zc); g.add(axle);
    for (const sx of [-1, 1]) { const ck = new THREE.Mesh(new THREE.BoxGeometry(0.22, S.wr * 0.9, S.L * 0.8), S.wheel === 'wood' ? wood : steel); ck.position.set(LAB_LANE + sx * (S.r0 + 0.3), yb - S.wr * 0.25, zc + 0.2); ck.castShadow = true; g.add(ck); }
    const trail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, S.L * 0.55), S.wheel === 'wood' ? wood : steel); trail.position.set(LAB_LANE, 0.22, MUZZLE_Z + S.L + S.L * 0.3); trail.rotation.x = -0.12; g.add(trail);
    if (lv === 3) for (let k = 0; k < 6; k++) { const bag = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), M(0x9a8a62, 0, 0.95)); bag.scale.set(1.3, 0.6, 1); bag.position.set(LAB_LANE + (k % 2 ? 1 : -1) * (S.r0 + 1.8) + rand(-0.2, 0.2), 0.2 + ((k / 2) | 0) * 0.28, zc - 1.0 + ((k / 2) | 0) * 0.5); g.add(bag); }
  } else { // tracked bases with glowing cores
    for (const sx of [-1, 1]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7 + lv * 0.1, S.L * 0.85), dark); tr.position.set(LAB_LANE + sx * (S.r0 + 0.65), 0.45 + lv * 0.05, zc); tr.castShadow = true; g.add(tr);
      for (let k = 0; k < 11; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.06, 0.2), steel); st.position.set(tr.position.x, tr.position.y + (0.35 + lv * 0.05), zc - S.L * 0.4 + k * (S.L * 0.8 / 10)); g.add(st); } }
    const deck = new THREE.Mesh(new THREE.BoxGeometry((S.r0 + 0.65) * 2, 0.4, S.L * 0.7), steel); deck.position.set(LAB_LANE, yb - S.r0 * 0.9, zc); deck.castShadow = true; g.add(deck);
    for (let k = 0; k < 6; k++) { const fin = new THREE.Mesh(new THREE.TorusGeometry(S.r0 + 0.12, 0.03, 6, 30), steel); fin.position.set(0, 0, -S.L * (0.15 + k * 0.06)); barrel.add(fin); }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), bandM); core.position.set(LAB_LANE, yb - S.r0 * 0.4, zc + S.L * 0.3); g.add(core);
    if (lv === 5) { for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), bandM); const an = k / 8 * 6.283; sp.position.set(Math.cos(an) * (S.r0 + 0.2), Math.sin(an) * (S.r0 + 0.2), -S.L * 0.6); sp.rotation.z = an - Math.PI / 2; barrel.add(sp); }
      const halo = new THREE.Mesh(new THREE.TorusGeometry(S.r1 + 0.7, 0.06, 8, 40), bandM); halo.position.z = -S.L - 0.5; barrel.add(halo); for (const sx of [-1, 1]) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.3, 10), steel); pipe.position.set(LAB_LANE + sx * (S.r0 + 0.65), 1.7, zc + S.L * 0.25); g.add(pipe); } }
  }
  g.visible = false; return g;
}
let LAB_ENV = null;
function labEnv() { // a small studio: warm top light, soft boxes, dark floor: what polished things reflect
  if (LAB_ENV) return LAB_ENV;
  const t = tex(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fb6d6'); gr.addColorStop(0.45, '#d8d2c6'); gr.addColorStop(0.5, '#3a3a42'); gr.addColorStop(1, '#101014'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,248,235,0.95)'; for (const [x, y, ww, hh] of [[60, 30, 90, 40], [250, 20, 120, 34], [400, 40, 80, 46], [150, 110, 50, 26], [330, 105, 60, 22]]) g.fillRect(x, y, ww, hh); });
  t.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); LAB_ENV = pm.fromEquirectangular(t).texture; pm.dispose(); return LAB_ENV;
}
function cannonBuild() {
  if (CAN.built || !labBuilt) return; CAN.built = true;
  const g = CAN.group = new THREE.Group(); g.visible = false; scene.add(g);
  for (let lv = 1; lv <= 5; lv++) { const m = canModel(lv); CAN.models[lv] = m; g.add(m); }
  const crackTex = tex(256, 256, (c, w, h) => CAN_DRAW.cracks(c, w, h)), frameM = new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.6, roughness: 0.5 });
  CANNON_WALLS.forEach((W, i) => {
    const grp = new THREE.Group(); grp.position.set(LAB_LANE, 0, cannonWallZ(i)); grp.visible = false; scene.add(grp);
    const map = tex(512, 320, (c, w, h) => CAN_DRAW[W.draw](c, w, h)), clear = W.kind === 'glass' || W.kind === 'jelly' || W.kind === 'ice' || W.kind === 'window';
    if (W.draw === 'window') CAN.winBroken = tex(512, 320, (c, w, h) => CAN_DRAW.windowBroken(c, w, h));
    const mat = canWallMat(map, W), smat = new THREE.MeshStandardMaterial({ map, roughness: mat.roughness, metalness: mat.metalness, transparent: clear, side: THREE.DoubleSide, depthWrite: !clear });
    try { for (const m of [mat, smat]) { m.envMap = labEnv(); m.envMapIntensity = W.kind === 'metal' ? 1.0 : W.kind === 'glass' || W.kind === 'ice' ? 0.9 : 0.12; } } catch (e) { /* no reflections, still fine */ }
    if (W.draw === 'diamond') for (const m of [mat, smat]) { m.emissive = new THREE.Color(0x9fd8ff); m.emissiveMap = map; m.emissiveIntensity = 0.35; }
    const geo = new THREE.BoxGeometry(CAN_W, CAN_H, W.T); geo.translate(0, CAN_H / 2, 0); const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); grp.userData.panel = mesh;
    { const N = 72, tg = new THREE.BufferGeometry(), idx = []; tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 6), 3)); tg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((N + 1) * 4), 2));
      for (let j = 0; j < N; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } tg.setIndex(idx); const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map, color: 0x9a9a9a, roughness: 0.9, side: THREE.DoubleSide })); tm.visible = false; tm.frustumCulled = false; grp.add(tm); grp.userData.tube = tm; }
    for (const sx of [-3.1, 3.1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.0, W.T + 0.2), frameM); p.position.set(sx, 2.0, 0); grp.add(p); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.45, 0.25, W.T + 0.2), frameM); top.position.y = 4.0; grp.add(top);
    { // five bulbs on the top bar, one shared material per wall so they all change together
      const bulbM = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.15, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 0 }), haloM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), sockM = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.5, metalness: 0.6 });
      for (let k = -2; k <= 2; k++) { const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 14), sockM); sock.position.set(k * 1.05, 4.18, 0); grp.add(sock);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), bulbM); bulb.position.set(k * 1.05, 4.32, 0); grp.add(bulb);
        const halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), haloM); halo.position.copy(bulb.position); grp.add(halo); }
      CAN.lamps.push({ bulbM, haloM, state: 0, flash: 0 });
    }
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), sign((i + 1) + '  ' + W.n, '#16141c', '#' + W.col.toString(16).padStart(6, '0'), 640, 160)); tag.position.set(0, 4.65, W.T / 2 + 0.1); grp.add(tag);
    const cr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, opacity: 0.95 })); cr.position.z = W.T / 2 + 0.013; cr.visible = false; grp.add(cr);
    CAN.walls.push(grp); CAN.mats.push(smat); CAN.wallMats.push(mat); CAN.cracks.push(cr);
  });
  // posters on a few of the walls: poster-N.jpg from the repo, a printed fallback until (or if) they load
  const FALL = [['WANTED', 'MY HEAD · REWARD $5', '#5a3a1a', '#f3e6c8'], ['TEST #001', 'HE SURVIVED* *NOT', '#0f1c3a', '#ffffff'], ['CRASH MART', 'SALE -50%', '#e0322b', '#ffffff'], ['EMPLOYEE OF', 'THE MONTH x47', '#16141c', '#ffc21a'], ["DON'T", 'BLINK', '#161222', '#3dff9a']];
  const loader = new THREE.TextureLoader(); let pn = 0;
  for (const [wi, px, py, rot] of [[4, -1.7, 2.0, 0.05], [5, 1.5, 1.9, -0.06], [6, -1.6, 2.1, -0.04], [6, 1.9, 1.7, 0.07], [8, 1.2, 2.0, 0.03], [9, -1.8, 1.9, -0.05], [9, 1.7, 2.2, 0.06]]) {
    const f = FALL[pn % 5], idx = ((pn * 4 + 1) % 26) + 1; pn++;
    const pm = new THREE.MeshStandardMaterial({ map: sign(f[0], f[2], f[3], 256, 340).map, roughness: 0.6, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), pm); mesh.position.set(px, py, CANNON_WALLS[wi].T / 2 + 0.03); mesh.rotation.z = rot; CAN.walls[wi].add(mesh); CAN.posters.push({ wi, x: px, y: py, mesh, alive: true });
    loader.load('poster-' + (idx) + '.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; pm.map = t; pm.needsUpdate = true; }, undefined, () => {});
  }
  const G = canShardGeo(), gm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0.1, 0, 0.35, 1, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0.1, 0.35, 1], 2)); tri.computeVertexNormals();
  CAN.smoke = new CanTrail(600, false); CAN.fire = new CanTrail(700, true);
  CAN.glass = new CanDebris(tri, gm, 900); CAN.glass.id = 'g'; CAN.glass.snd = 'glass'; CAN.byId.g = CAN.glass; CAN.glass.mesh.setColorAt(0, new THREE.Color(0xffffff));
  CANNON_WALLS.forEach((W, k) => { const m = CAN.mats[k], K = W.kind; const main = new CanDebris(K === 'wood' || K === 'window' ? G.splint[0] : K === 'metal' ? G.plate[0] : K === 'jelly' || K === 'cake' ? G.blob[0] : G.chunk[1], m, K === 'glass' ? 1 : 110), aux = (K === 'wood' || K === 'metal') ? new CanDebris(G.chunk[2], m, 50) : null; if (W.kind === 'window') main.mesh.material = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.55, side: THREE.DoubleSide }); main.id = 'm' + k; main.snd = { wood: 'wood', window: 'wood', metal: 'metal', stone: 'stone', ice: 'glass' }[K] || (W.draw === 'hay' ? 'soft' : null); CAN.byId['m' + k] = main; if (aux) { aux.id = 'a' + k; aux.snd = main.snd; CAN.byId['a' + k] = aux; } CAN.sets.push({ main, aux }); });
  for (let p = 0; p < 24; p++) { const mesh = new THREE.Mesh(G.paper[0], new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); mesh.visible = false; scene.add(mesh); CAN.paper.push({ m: mesh, v: new V3(), w: new V3(), life: 0 }); }
}
function canWallSnap(i) { const m = CAN.wallMats[i], U = m.userData.U, w = CAN.walls[i], tb = w.userData.tube, pm = w.userData.panel;
  return { i, hole: U.uHole.value.toArray(), ph: U.uPh.value.toArray(), jag: U.uJag.value.toArray(), crk: U.uCrk.value.map(v => v.toArray()), panel: pm.visible, shadow: pm.castShadow, tube: tb.visible, tpos: tb.visible ? tb.geometry.attributes.position.array.slice() : null, tuv: tb.visible ? tb.geometry.attributes.uv.array.slice() : null, win: !!CAN.winBroken && m.map === CAN.winBroken }; }
function canWallApply(sn) { const i = sn.i, m = CAN.wallMats[i], U = m.userData.U, w = CAN.walls[i], tb = w.userData.tube, pm = w.userData.panel;
  U.uHole.value.fromArray(sn.hole); U.uPh.value.fromArray(sn.ph); U.uJag.value.fromArray(sn.jag); sn.crk.forEach((a, k) => U.uCrk.value[k].fromArray(a)); pm.visible = sn.panel; pm.castShadow = sn.shadow;
  tb.visible = sn.tube; if (sn.tube) { tb.geometry.attributes.position.array.set(sn.tpos); tb.geometry.attributes.uv.array.set(sn.tuv); tb.geometry.attributes.position.needsUpdate = true; tb.geometry.attributes.uv.needsUpdate = true; tb.geometry.computeVertexNormals(); tb.geometry.computeBoundingSphere(); }
  const want = sn.win ? CAN.winBroken : CAN.mats[i].map; if (m.map !== want) { m.map = want; m.needsUpdate = true; } }
function canLamp(i, state) { // 0 off, 1 green (broken through), 2 red (hit, did not break)
  const L = CAN.lamps[i]; if (!L) return; L.state = state; L.flash = state ? 1 : 0; if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'lamp', a: [i, state] });
  const col = state === 1 ? 0x2bff63 : state === 2 ? 0xff2a2a : 0x000000;
  L.bulbM.color.setHex(state ? col : 0x2c2f36); L.bulbM.emissive.setHex(col); L.bulbM.emissiveIntensity = state ? 4 : 0; L.haloM.color.setHex(col); L.haloM.opacity = state ? 0.55 : 0;
}
function cannonShow(on) {
  if (BOLLARD) BOLLARD.visible = !on; if (!on) stage.classList.remove('cannonrun');
  if (!on) { daggie.visible = true; rider.visible = true; }
  if (on) cannonBuild(); if (!CAN.built) return;
  CAN.group.visible = on; CAN.walls.forEach(w => { w.visible = on; }); if (!on) return;
  if (!CAN_IN) { canInput(); CAN.hint(); } if (CAN.phase !== 'replay' && !CREC.play && LAB.phase !== 'cannon') stage.classList.remove('cannonrun');
  CAN.phase = 'idle'; CAN.next = 0; CAN.stuck = -1; CAN.broken = 0;
  const lv = clamp(LAB.level, 1, 5); CAN.lv = lv; CAN.models.forEach((m, k) => { if (m) m.visible = k === lv; }); CAN.barrel = CAN.models[lv].userData.barrel; CAN.barrel.position.z = MUZZLE_Z + CAN_SPEC[lv - 1].L;
  const hp = CAN.posters; for (const p of hp) { p.alive = true; p.mesh.visible = true; }
  CAN.lamps.forEach((l, i) => canLamp(i, 0));
  CAN.walls.forEach((w, i) => { const pm = w.userData.panel; pm.visible = true; pm.castShadow = true; CAN.wallMats[i].userData.U.uHole.value.w = 0; for (const c of CAN.wallMats[i].userData.U.uCrk.value) c.set(0, 0, 0, 0); if (CANNON_WALLS[i].draw === 'window') { CAN.wallMats[i].map = CAN.mats[i].map; CAN.wallMats[i].needsUpdate = true; } w.userData.tube.visible = false; CAN.cracks[i].visible = false; });
  CAN.smoke.clear(); CAN.fire.clear(); CAN.tl = null;
  CAN.glass.clear(); for (const st of CAN.sets) { st.main.clear(); if (st.aux) st.aux.clear(); } for (const p of CAN.paper) { p.m.visible = false; p.life = 0; } CAN.touch = new Array(15).fill(false);
  board.position.set(LAB_LANE, CAN_SPEC[lv - 1].wr + 0.35 - 0.75, MUZZLE_Z - 0.7);
}
function cannonStart(lv) {
  cannonBuild(); cannonShow(true); lv = clamp(lv, 1, 5);
  CREC.on = false; CREC.play = null; labBars(false); windSet(0);
  Object.assign(CAN, { phase: 'load', t: 0, next: 0, stuck: -1, broken: 0, mph: CANNON_MPH[lv - 1], recoil: 0, rest: 0, count: 0, touch: new Array(15).fill(false), spun: 0, sd: 0, lastZ: undefined, landing: false }); CAN.vmph = CAN.mph;
  LAB.phase = 'cannon'; board.visible = false; daggie.visible = false; rider.visible = false; // he is inside the barrel until the shot
  CAN.sub = 'LEVEL ' + lv + ' · ' + CAN.mph + ' MPH'; stage.classList.add('cannonrun'); labSpeedo(0); labDmg(false);
}
function cannonFire() {
  CAN.phase = 'fly'; CAN.t = 0; CART.box.on = false; CART.cyls.length = 0; LABCART.hit = false; daggie.visible = true; rider.visible = true;
  const vis = cannonVis(CAN.mph); ragStart(new V3(0, 2.2, -vis), 0);
  const S = RAGSIM, c = S.core, I = S.I; S.fast = true; c.friction = 0.995; c.drag = 0; c.damp = 1; c.airXZ = false; c.g = -2.2; S.hook = cannonHold; S.t = 0; // no drag and no per-step damping: at 60 m/s they took off about half of his speed in a second, so he stopped around wall 6-7
  canDive(S); for (let i = 0; i < c.n; i++) c.vel(i, 0, 2.2, -vis, 1 / 240); // head first, no spin yet: the first wall starts it
  CREC.on = true; CREC.t = 0; CREC.frames = []; CREC.ev = []; CREC.play = null; CAN.tl = null; cannonMuzzleCloud();
  const mz = new V3(LAB_LANE, CAN_SPEC[CAN.lv - 1].wr + 0.35, MUZZLE_Z); burst(mz, 160, SPARK, 11); burst(new V3(mz.x, mz.y, mz.z - 0.6), 70, CONF, 6); cannonBoom(CAN.lv); CREC.ev.push({ t: 0, k: 'cb', a: [CAN.lv] }); CAN.recoil = 1;
  if (!reduceMotion) { shake = 0.8; const fl = document.createElement('div'); fl.className = 'flash'; stage.appendChild(fl); setTimeout(() => fl.remove(), 350); }
  lastPop = 0; pop('BOOM!', 'lilac'); setFace('wow', 4000); slowUntil = performance.now() + 9000; slowK = 0.4;
}
function cannonHold(core) { // the wall that stopped him: nothing gets through it any more
  if (CAN.stuck < 0) return; const zp = cannonWallZ(CAN.stuck) + 0.2;
  for (let i = 0; i < core.n; i++) { const k = i * 3; if (core.x[k + 2] < zp) { core.x[k + 2] = zp; core.o[k + 2] = zp; core.o[k] = core.x[k] - (core.x[k] - core.o[k]) * 0.6; } }
}
class CanDebris { // one InstancedMesh = one draw call for hundreds of flying pieces
  constructor(geo, mat, N) { this.N = N; this.mesh = new THREE.InstancedMesh(geo, mat, N); this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.w = new Float32Array(N * 3); this.s = new Float32Array(N * 3); this.q = Array.from({ length: N }, () => new THREE.Quaternion()); this.life = new Float32Array(N); this.rest = new Uint8Array(N); this.fl = new Float32Array(N).fill(0.04); this.snd = null; this.dragK = 0.05; this.bnc = 0.3; this.next = 0; this.d = new THREE.Object3D(); this.col = new THREE.Color(); this.hasCol = false; this.clear(); }
  clear() { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < this.N; i++) { this.mesh.setMatrixAt(i, z); this.life[i] = 0; } this.mesh.instanceMatrix.needsUpdate = true; this.mesh.visible = false; }
  spawn(px, py, pz, vx, vy, vz, sx, sy, sz, life, color, still, euler) {
    const q = new THREE.Quaternion().setFromEuler(euler ? new THREE.Euler(euler[0], euler[1], euler[2]) : new THREE.Euler(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3))), w0 = rand(-14, 14), w1 = rand(-14, 14), w2 = rand(-14, 14);
    this.raw(px, py, pz, vx, vy, vz, sx, sy, sz, life, color, still, q.x, q.y, q.z, q.w, w0, w1, w2);
    if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'sp', a: [this.id, px, py, pz, vx, vy, vz, sx, sy, sz, life, color, still ? 1 : 0, q.x, q.y, q.z, q.w, w0, w1, w2] });
  }
  launch(i, vx, vy, vz, wx, wy, wz) { const k = i * 3; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz; this.w[k] = wx; this.w[k + 1] = wy; this.w[k + 2] = wz; this.rest[i] = 0; this.life[i] = 99999; this.mesh.visible = true; }
  raw(px, py, pz, vx, vy, vz, sx, sy, sz, life, color, still, qx, qy, qz, qw, w0, w1, w2) {
    const i = this.next, k = i * 3; this.next = (i + 1) % this.N; this.p[k] = px; this.p[k + 1] = py; this.p[k + 2] = pz; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz; this.s[k] = sx; this.s[k + 1] = sy; this.s[k + 2] = sz;
    this.w[k] = w0; this.w[k + 1] = w1; this.w[k + 2] = w2; this.q[i].set(qx, qy, qz, qw); this.life[i] = life; this.rest[i] = still ? 1 : 0;
    if (color !== undefined) { this.mesh.setColorAt(i, this.col.setHex(color)); this.mesh.instanceColor.needsUpdate = true; this.hasCol = true; }
    this.mesh.visible = true; this.put(i);
  }
  put(i) { const k = i * 3, d = this.d; d.position.set(this.p[k], this.p[k + 1], this.p[k + 2]); d.quaternion.copy(this.q[i]); d.scale.set(this.s[k], this.s[k + 1], this.s[k + 2]); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); }
  step(dt) {
    if (!this.mesh.visible) return; let any = false; const ax = _cdA, dq = _cdQ;
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue; any = true; this.life[i] -= dt; const k = i * 3;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, _cdZ); continue; } if (this.rest[i]) continue;
      this.v[k + 1] -= 9.8 * dt; const dr = 1 / (1 + this.dragK * dt * Math.hypot(this.v[k], this.v[k + 1], this.v[k + 2])); this.v[k] *= dr; this.v[k + 1] *= dr; this.v[k + 2] *= dr;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      const wl = Math.hypot(this.w[k], this.w[k + 1], this.w[k + 2]); if (wl > 1e-3) { ax.set(this.w[k] / wl, this.w[k + 1] / wl, this.w[k + 2] / wl); dq.setFromAxisAngle(ax, wl * dt); this.q[i].premultiply(dq); }
      if (this.p[k + 1] < this.fl[i]) { if (this.snd && this.v[k + 1] < -1.4) debrisHit(this.snd, -this.v[k + 1], Math.max(this.s[k], this.s[k + 1], this.s[k + 2])); this.p[k + 1] = this.fl[i]; this.v[k + 1] *= -this.bnc; const f = Math.exp(-4 * dt); this.v[k] *= f; this.v[k + 2] *= Math.exp(-3 * dt); this.w[k] *= f; this.w[k + 1] *= f; this.w[k + 2] *= f; if (Math.hypot(this.v[k], this.v[k + 1], this.v[k + 2]) < 0.5) { this.rest[i] = 1; this.w[k] = this.w[k + 1] = this.w[k + 2] = 0; } }
      this.put(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true; if (!any) this.mesh.visible = false;
  }
}
const _cdA = new V3(), _cdQ = new THREE.Quaternion(), _cdZ = new THREE.Matrix4().makeScale(0, 0, 0);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.7;
function canHole(i, px, py, small) { // a hole with an uneven edge, cut in the shader (no pixel steps) and lined with a tube so the wall has thickness
  const W = CANNON_WALLS[i], full = (W.draw === 'glass' || W.draw === 'glass2') && !small;
  px = clamp(px, -2.3, 2.3); py = clamp(py, 0.7, 3.1);
  const h = { px, py, R: W.R * (small ? 0.45 : 1), ph: [rand(0, 6.3), rand(0, 6.3), rand(0, 6.3), rand(0, 6.3)], A: W.jag[0], F: W.jag[1] + (Math.random() < 0.5 ? 0 : 1), full }; h.rad = th => canHoleR(h, th);
  const gone = [], cnt = full ? 160 : clamp(Math.round(Math.PI * h.R * h.R * 6), 8, 70);
  for (let q = 0; q < cnt; q++) { const th = rand(-3.1416, 3.1416), r = Math.sqrt(Math.random()) * (full ? 3 : h.rad(th)); gone.push(full ? [rand(-3, 3), rand(0.1, 3.8)] : [px + Math.cos(th) * r, py + Math.sin(th) * r]); }
  const w = CAN.walls[i], U = CAN.wallMats[i] && CAN.wallMats[i].userData.U;
  if (w && U) {
    if (full) { w.userData.panel.visible = false; } // the whole pane bursts
    else if (!small) { U.uHole.value.set(px, py, h.R, 1); U.uPh.value.set(h.ph[0], h.ph[1], h.ph[2], h.ph[3]); U.uJag.value.x = h.A; U.uJag.value.y = h.F; canTube(i, h); w.userData.panel.castShadow = false; if (W.draw === 'window') { CAN.wallMats[i].map = CAN.winBroken; CAN.wallMats[i].needsUpdate = true; } else canCracks(i, px, py, 7, 0.9 + W.R * 0.55, false); }
  }
  return { gone, px, py, rad: h.rad };
}
function canCracks(i, cx, cy, n, len, stuck) { // cracks run out from the hole edge (or from a dent when he got stuck): thin, jagged, branching, and never across the hole
  const W = CANNON_WALLS[i], m = CAN.wallMats[i], U = m && m.userData.U; if (!U || !W.crk || W.crk[3] <= 0) return;
  const arr = U.uCrk.value; for (let k = 0; k < 8; k++) { if (k < n) arr[k].set(k / n * 6.2831853 + rand(-0.35, 0.35), len * rand(0.55, 1.25), rand(0, 6.3), 1); else arr[k].set(0, 0, 0, 0); }
  if (stuck) U.uHole.value.set(clamp(cx, -2.6, 2.6), clamp(cy, 0.4, 3.4), 0.12, 2);
}
function canDebris(W, i, h, stuck) { // what a broken wall turns into
  const z = cannonWallZ(i), vis = cannonVis(CAN.vmph), set = CAN.sets[i], gl = CAN.glass, ix = h.px, iy = h.py, n = h.gone.length;
  const out = (cx, cy) => { const dx = cx - ix, dy = cy - iy, d = Math.hypot(dx, dy) || 0.01; return [dx / d, dy / d, d]; };
  if (W.kind === 'window') { // every pane bursts into slivers, the white frame splinters around the hole
    if (!stuck) for (let q = 0; q < 300; q++) { const px = rand(-2.8, 2.8), py = rand(0.3, 3.4), [ux, uy, d] = out(px, py), sp = (4 / (0.6 + d)) * rand(0.4, 1.2); gl.spawn(LAB_LANE + px, py, z + rand(-0.05, 0.05), ux * sp, uy * sp + rand(0, 2.5), -vis * rand(0.12, 0.5) + rand(-1, 2), rand(0.04, 0.22), rand(0.04, 0.22), 1, rand(8, 11), 0xd8f4ff); }
    for (const [cx, cy] of h.gone) { if (Math.random() < 0.55) { const [ux, uy] = out(cx, cy), sp = rand(1.5, 5); set.main.spawn(LAB_LANE + cx, cy, z, ux * sp, uy * sp + rand(0, 3), -vis * rand(0.15, 0.5) + rand(-1, 2), rand(0.7, 1.6), rand(0.7, 1.6), rand(0.6, 1.4), rand(7, 11)); } }
    if (!stuck) for (let q = 0; q < 12; q++) { const th = rand(0, 6.283), r = h.rad(th) * rand(0.92, 1.04); set.main.spawn(LAB_LANE + h.px + Math.cos(th) * r, clamp(h.py + Math.sin(th) * r, 0.1, 3.8), z - W.T / 2 - rand(0.05, 0.2), 0, 0, 0, rand(0.5, 1.1), rand(0.5, 1.1), rand(0.35, 0.8), 999, undefined, true); }
    return;
  }
  if ((W.draw === 'glass' || W.draw === 'glass2') && !stuck) { // the whole pane bursts into hundreds of slivers
    const total = W.draw === 'glass' ? 420 : 340;
    for (let q = 0; q < total; q++) { const near = Math.random() < 0.6, px = near ? clamp(ix + gauss() * 0.8, -3, 3) : rand(-3, 3), py = near ? clamp(iy + gauss() * 0.8, 0.1, 3.85) : rand(0.1, 3.85), [ux, uy, d] = out(px, py), sp = (4.5 / (0.6 + d)) * rand(0.4, 1.2);
      gl.spawn(LAB_LANE + px, py, z + rand(-0.05, 0.05), ux * sp, uy * sp + rand(0, 2.5), -vis * rand(0.12, 0.55) + rand(-1, 2), rand(0.04, 0.26), rand(0.04, 0.26), 1, rand(8, 11), W.draw === 'glass' ? 0xd8f4ff : 0xa8e8dc); }
    for (let q = 0; q < 44; q++) { const side = q % 4, x = side < 2 ? rand(-2.95, 2.95) : (side === 2 ? -2.95 : 2.95), y = side === 0 ? 0.12 : side === 1 ? 3.7 : rand(0.2, 3.7), a = Math.atan2(1.9 - y, -x) + rand(-0.5, 0.5), g = CAN.glass, sz = rand(0.1, 0.38); g.spawn(LAB_LANE + x, y, z, 0, 0, 0, sz * rand(0.5, 1), sz, 1, 999, 0xd8f4ff, true, [0, 0, a - 1.2]); } // jagged teeth left in the frame
    return;
  }
  if (W.kind === 'glass') { for (const [cx, cy] of h.gone) for (let q = 0; q < (stuck ? 2 : 4); q++) { const [ux, uy] = out(cx, cy), sp = rand(1.5, 6); gl.spawn(LAB_LANE + cx + rand(-0.15, 0.15), cy + rand(-0.15, 0.15), z + rand(-0.05, 0.05), ux * sp, uy * sp + rand(0, 2), -vis * rand(0.12, 0.5), rand(0.04, 0.2), rand(0.04, 0.2), 1, rand(8, 11), 0x5fb0c2); } return; }
  const dirz = stuck ? 0.25 : 1;
  for (const [cx, cy] of h.gone) {
    const [ux, uy] = out(cx, cy), sp = rand(1.5, 5.5), px = LAB_LANE + cx + rand(-0.1, 0.1), py = cy + rand(-0.1, 0.1), vz = -vis * rand(0.15, 0.5) * dirz + rand(-1.5, 2.5), life = rand(7, 11), main = set.main, aux = set.aux;
    if (W.kind === 'wood') { main.spawn(px, py, z + rand(-0.1, 0.1), ux * sp, uy * sp + rand(0, 3), vz, rand(0.6, 1.5), rand(0.6, 1.5), rand(0.5, 1.4), life); if (Math.random() < 0.4) aux.spawn(px, py, z, ux * sp, uy * sp + rand(0, 2), vz, rand(0.07, 0.16), rand(0.05, 0.12), rand(0.07, 0.16), life); }
    else if (W.kind === 'metal') { if (Math.random() < 0.35) main.spawn(px, py, z, ux * sp * 0.6, uy * sp * 0.6 + rand(0, 2), vz * 0.7, rand(0.5, 0.9), rand(0.5, 0.9), 1, life); if (Math.random() < 0.7) aux.spawn(px, py, z, ux * sp, uy * sp + rand(0, 3), vz, rand(0.05, 0.12), rand(0.05, 0.12), rand(0.05, 0.12), life); }
    else { const sz = rand(0.07, 0.2); main.spawn(px, py, z + rand(-0.1, 0.1), ux * sp, uy * sp + rand(0, 3), vz, sz * rand(0.7, 1.4), sz * rand(0.6, 1.2), sz * rand(0.7, 1.3), life); if (W.kind === 'ice' && Math.random() < 0.5) gl.spawn(px, py, z, ux * sp, uy * sp + rand(0, 2), vz, rand(0.05, 0.18), rand(0.05, 0.18), 1, life, 0xeaf8ff); }
  }
  if (stuck) return;
  const T = W.T, ring = (k, fn) => { for (let q = 0; q < k; q++) { const th = rand(0, 6.283), r = h.rad(th) * rand(0.92, 1.04); fn(ix + Math.cos(th) * r, iy + Math.sin(th) * r, th); } };
  if (W.kind === 'wood') ring(14, (x, y) => set.main.spawn(LAB_LANE + x, clamp(y, 0.1, 3.8), z - T / 2 - rand(0.05, 0.25), 0, 0, 0, rand(0.5, 1.2), rand(0.5, 1.2), rand(0.35, 0.9), 999, undefined, true)); // splintered teeth around the hole, pointing out the back
  else if (W.kind === 'metal') ring(9, (x, y, th) => { set.main.spawn(LAB_LANE + x, clamp(y, 0.1, 3.8), z - T / 2 - 0.05, 0, 0, 0, 0.9, 0.9, 1, 999, undefined, true, [Math.sin(th) * 0.9, -Math.cos(th) * 0.9, th]); }); // torn petals bent outwards
  else if (W.kind === 'brick' || W.kind === 'stone') ring(8, (x, y) => set.main.spawn(LAB_LANE + x, clamp(y, 0.1, 3.8), z + rand(-0.1, 0.1), 0, 0, 0, rand(0.08, 0.16), rand(0.08, 0.16), rand(0.08, 0.16), 999, undefined, true));
}
function canDive(S) { // head first, arms stretched forward, legs trailing: the standing rest pose turned to point along the flight
  const c = S.core, I = S.I, rest = S.rest, pk = I.pel * 3, o = [c.x[pk], c.x[pk + 1], c.x[pk + 2]], p0 = rest.pel, sgn = (rest.toL[2] - rest.anL[2]) >= 0 ? 1 : -1;
  const map = v => { const x = v[0] - p0[0], y = v[1] - p0[1], z = v[2] - p0[2]; return sgn > 0 ? [-x, -z, -y] : [x, z, -y]; }, P = {};
  for (const n of RAG_NAMES) { const m = map(rest[n]); P[n] = [o[0] + m[0], o[1] + m[1], o[2] + m[2]]; }
  for (const sd of ['L', 'R']) { let prev = P['sh' + sd]; const side = Math.sign(prev[0] - P.chest[0]) || (sd === 'L' ? 1 : -1);
    for (const [a, b] of [['sh', 'el'], ['el', 'wr'], ['wr', 'ha']]) { const len = Math.hypot(rest[a + sd][0] - rest[b + sd][0], rest[a + sd][1] - rest[b + sd][1], rest[a + sd][2] - rest[b + sd][2]), dx = side * 0.14, dy = -0.03, dz = -1, dl = Math.hypot(dx, dy, dz); prev = P[b + sd] = [prev[0] + dx / dl * len, prev[1] + dy / dl * len, prev[2] + dz / dl * len]; } }
  for (const n of RAG_NAMES) { const k = I[n] * 3; c.x[k] = c.o[k] = P[n][0]; c.x[k + 1] = c.o[k + 1] = P[n][1]; c.x[k + 2] = c.o[k + 2] = P[n][2]; }
}
function cannonSpin(c, I, wz, wx) { // wind him up: roll about the flight line (wz) and a bit of somersault (wx), rad/s
  const pk = I.pel * 3, cx = c.x[pk], cy = c.x[pk + 1], cz = c.x[pk + 2];
  for (let q = 0; q < c.n; q++) { const k = q * 3, rx = c.x[k] - cx, ry = c.x[k + 1] - cy, rz = c.x[k + 2] - cz; c.o[k] -= (-wz * ry) / 240; c.o[k + 1] -= (wz * rx - wx * rz) / 240; c.o[k + 2] -= (wx * ry) / 240; }
}
function cannonKick(c, amt) { for (let q = 0; q < c.n; q++) { const k = q * 3; c.o[k] -= rand(-0.7, 0.7) * amt / 240; c.o[k + 1] -= rand(-0.7, 0.7) * amt / 240; } }
function cannonShardStep(dt) {
  if (CAN.smoke) { CAN.smoke.step(dt); CAN.fire.step(dt); }
  for (const L of CAN.lamps) if (L.flash > 0) { L.flash = Math.max(0, L.flash - dt * 1.6); L.bulbM.emissiveIntensity = 2.6 + 3.2 * L.flash; L.haloM.opacity = 0.35 + 0.35 * L.flash; }
  CAN.glass.step(dt); for (const st of CAN.sets) { st.main.step(dt); if (st.aux) st.aux.step(dt); }
  for (const sh of CAN.paper) { if (sh.life <= 0) continue; sh.life -= dt; if (sh.life <= 0) { sh.m.visible = false; continue; } sh.v.y -= 2.5 * dt; sh.v.multiplyScalar(1 / (1 + 1.5 * dt)); sh.m.position.addScaledVector(sh.v, dt); sh.m.rotation.x += sh.w.x * dt; sh.m.rotation.y += sh.w.y * dt; if (sh.m.position.y < 0.03) { sh.m.position.y = 0.03; sh.v.set(0, 0, 0); sh.w.set(0, 0, 0); } }
}
function wallSound(W, i) {
  windDuck(); duckTail(); tone(480 + i * 55, 480 + i * 55, 0.14, 'sine', 0.05); // a rising ding for every wall: the satisfying count
  const d = W.draw, S = { glass: [['glass'], 1, 1], window: [['window', 'glass'], 1, 1.05], glass2: [['glass'], 1, 0.85], armor: [['glass'], 1, 0.7], hay: [['hay', 'wood'], 0.7, 0.8], ply: [['wood'], 1, 1.1], oak: [['wood'], 1, 0.85], brick: [['brick'], 1, 1], stone: [['stone'], 1, 1], concrete: [['stone'], 1, 0.8], ice: [['ice'], 1, 1], diamond: [['ice'], 1, 1.25], steel: [['metal'], 1, 1], gold: [['metal'], 1, 0.85], vault: [['vault', 'metal'], 1, 0.6] }[d];
  if (S && sfxPlay(S[0], S[1], S[2], 0.25)) return; if (!AC) return; OUT(); const t = AC.currentTime;
  if (d === 'glass' || d === 'window') { glassSound(d === 'window' ? 1.05 : 1); if (d === 'window') matSound('wood', 0.5, 1.4); }
  else if (d === 'glass2') glassSound(0.8); else if (d === 'armor') { glassSound(0.65); matSound('metal', 0.5, 0.8); }
  else if (d === 'hay') { noise(t, 0.35, 0.22, 'bandpass', 1400, 500, 0.8); noise(t, 0.2, 0.15, 'highpass', 4500, 2500, 0.7); sweep(t, 140, 55, 0.22, 0.25, 'sine'); }
  else if (d === 'ply') matSound('wood', 1, 1.1); else if (d === 'oak') matSound('wood', 1, 0.85);
  else if (d === 'brick') matSound('brick', 1, 1); else if (d === 'stone') matSound('stone', 1, 1); else if (d === 'concrete') matSound('stone', 1, 0.8);
  else if (d === 'ice') matSound('ice', 1, 1); else if (d === 'diamond') matSound('ice', 1, 1.3);
  else if (d === 'steel') matSound('metal', 1, 1); else if (d === 'gold') matSound('metal', 1, 0.85); else if (d === 'vault') { matSound('metal', 1.4, 0.6); crashSound(0.7); }
  else crashSound(clamp(0.12 + W.c / 220000 * 0.7, 0.12, 0.85));
}
const CAN_GRP = { top: 'head', haL: 'armL', haR: 'armR', toL: 'legL', knL: 'legL', toR: 'legR', knR: 'legR' };
function canBodySpeed(c, I) { let t = 0; for (const nm of ['pel', 'waist', 'chest']) { const k = I[nm] * 3; t += Math.hypot(c.x[k] - c.o[k], c.x[k + 1] - c.o[k + 1], c.x[k + 2] - c.o[k + 2]); } return t / 3 * 240; } // m/s of his torso, as it really is now
const canMph = v => (v <= 16 ? 0 : 1000 * Math.pow((v - 16) / 44, 2)); // the model speed that matches a real speed on screen
function canRoll(c, I) { // how fast he is rolling about the flight line now (rad/s, signed)
  const pk = I.pel * 3, px = c.x[pk], py = c.x[pk + 1], vx0 = (c.x[pk] - c.o[pk]) * 240, vy0 = (c.x[pk + 1] - c.o[pk + 1]) * 240; let num = 0, den = 1e-6;
  for (let q = 0; q < c.n; q++) { const k = q * 3, rx = c.x[k] - px, ry = c.x[k + 1] - py, vx = (c.x[k] - c.o[k]) * 240 - vx0, vy = (c.x[k + 1] - c.o[k + 1]) * 240 - vy0; num += rx * vy - ry * vx; den += rx * rx + ry * ry; }
  return num / den;
}
function cannonFlail(c, I, amp) { // hands, feet and head whip about: more and more with every wall
  for (const nm of ['haL', 'haR', 'toL', 'toR', 'top', 'knL', 'knR']) { const k = I[nm] * 3; c.o[k] -= rand(-3, 3) * amp / 240; c.o[k + 1] -= rand(-3, 3) * amp / 240; c.o[k + 2] -= rand(-1.2, 1.2) * amp / 240; }
}
const CAN_KD = 0.012; // air resistance: his speed falls by about 1.2 % for every metre he flies (so he really slows down between walls)
function cannonDrive(c, I, dt) { // keeps his body at the model speed: the speed falls with the distance flown, and every wall takes its share; a soft pull keeps him at wall height
  const C = CAN; if (C.stuck >= 0 || C.next >= 15) return;
  const z = (c.x[I.pel * 3 + 2] + c.x[I.chest * 3 + 2] + c.x[I.waist * 3 + 2]) / 3; if (C.lastZ === undefined) C.lastZ = z; const dz = Math.max(0, C.lastZ - z); C.lastZ = z;
  C.vmph *= Math.exp(-CAN_KD * dz);
  let cur = 0; for (const nm of ['pel', 'waist', 'chest']) { const k = I[nm] * 3; cur += -(c.x[k + 2] - c.o[k + 2]) * 240; } cur /= 3;
  const d = cannonVis(C.vmph) - cur; for (let q = 0; q < c.n; q++) c.o[q * 3 + 2] += d / 240;
  let y = 0, vy = 0; for (const nm of ['pel', 'waist', 'chest']) { const k = I[nm] * 3; y += c.x[k + 1]; vy += (c.x[k + 1] - c.o[k + 1]) * 240; } y /= 3; vy /= 3; // height keeping: the kicks and the spin used to lift him up over the top of the walls
  let dv = (20 * (2.1 - y) - 9 * vy) * dt; if (vy > 4) dv -= (vy - 4); else if (vy < -4) dv += (-4 - vy); // never faster than 4 m/s up or down: a torn limb used to throw his body 20 m up
  for (let q = 0; q < c.n; q++) c.o[q * 3 + 1] -= dv / 240;
  let x = 0, vx = 0; for (const nm of ['pel', 'waist', 'chest']) { const k = I[nm] * 3; x += c.x[k]; vx += (c.x[k] - c.o[k]) * 240; } x /= 3; vx /= 3; // and a soft pull to the lane: the kicks and the spin pushed him up to 10 m sideways
  let dx = (9 * (LAB_LANE - x) - 6 * vx) * dt; if (vx > 4) dx -= (vx - 4); else if (vx < -4) dx += (-4 - vx); for (let q = 0; q < c.n; q++) c.o[q * 3] -= dx / 240;
}
const CAN_LIMB = { haL: 'armL', wrL: 'armL', haR: 'armR', wrR: 'armR', toL: 'legL', anL: 'legL', knL: 'legL', toR: 'legR', anR: 'legR', knR: 'legR' };
function cannonWalls() {
  const C = CAN, S = RAGSIM, c = S.core, I = S.I; if (C.stuck >= 0) return;
  const att = nm => !(CAN_GRP[nm] && c.broken.includes(CAN_GRP[nm])); // a torn-off hand, foot or head is just debris: it never breaks a wall
  const zmin = names => { let m = 1e9, who = null; for (const nm of names) { if (!att(nm)) continue; const z = c.x[I[nm] * 3 + 2]; if (z < m) { m = z; who = nm; } } return [m, who]; };
  while (C.next < 15 && C.stuck < 0) {
    const i = C.next, W = CANNON_WALLS[i], wz = cannonWallZ(i) + 0.25, hard = W.c >= 30000, [leadAll, who] = zmin(CAN_LEAD), [leadTorso] = zmin(['top', 'chest', 'pel']);
    if (hard && !C.touch[i] && leadAll <= wz && Math.abs(c.x[I[who] * 3]) < 3.3) { // a hand or a foot gets there first and takes the first blow: it can be torn off, the wall only cracks
      C.touch[i] = true; const k = I[who] * 3, g = CAN_LIMB[who]; burst(new V3(c.x[k], c.x[k + 1], cannonWallZ(i)), 25, CAN_PAL[W.kind] || SPARK, 5); clank(10);
      canCracks(i, c.x[k], c.x[k + 1], 5, 0.7, true); if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'wall', a: canWallSnap(i) });
      if (g && !c.broken.includes(g) && Math.random() < 0.75) c.breakGroup(g); cannonKick(c, 0.6);
    }
    if ((hard ? leadTorso : leadAll) > wz) break;
    let sx = 0, sy = 0, cn = 0; for (const nm of ['top', 'chest', 'pel']) { if (!att(nm)) continue; sx += c.x[I[nm] * 3]; sy += c.x[I[nm] * 3 + 1]; cn++; } sx /= cn; sy /= cn; // the hole is centred on his body, not on a fingertip
    if (Math.abs(sx) > 3.5 || sy < -0.3 || sy > 4.6) { C.next++; lastPop = 0; pop('MISSED ' + W.n, 'lilac'); continue; } // he flew past (beside it or over it): the wall stays whole, takes nothing from him and is not counted
    const vEff = C.vmph, v2 = vEff * vEff - W.c * Math.exp(-2 * CAN_KD * (MUZZLE_Z - cannonWallZ(i))); // the wall's cost is scaled by the air resistance already spent, so the levels keep their 3/6/9/12/15 walls
    if (v2 > 0) { // through: he slows down by what the wall took, a hole opens, pieces fly
      const r = cannonVis(Math.sqrt(v2)) / cannonVis(vEff); C.vmph = Math.sqrt(v2);
      for (let q = 0; q < c.n; q++) { const k = q * 3; c.o[k + 2] = c.x[k + 2] - (c.x[k + 2] - c.o[k + 2]) * r; }
      C.broken++; C.next++; canLamp(i, 1); const h = canHole(i, sx, sy); canDebris(W, i, h, false);
      for (const p of CAN.posters) if (p.wi === i && p.alive && Math.hypot(p.x - h.px, p.y - h.py) < W.R + 0.7) { p.alive = false; p.mesh.visible = false; if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'poster', a: [CAN.posters.indexOf(p)] }); canPaper(i, p, 9); burst(new V3(LAB_LANE + p.x, p.y, cannonWallZ(i)), 10, [[4, 4, 4]], 3); }
      const pal = CAN_PAL[W.kind] || SPARK; burst(new V3(sx + LAB_LANE, h.py, cannonWallZ(i)), 30 + Math.round(W.c / 6000), pal, 5 + W.c / 40000); wallSound(W, i); if (CREC.on) { CREC.ev.push({ t: CREC.t, k: 'ws', a: [i] }); CREC.ev.push({ t: CREC.t, k: 'wall', a: canWallSnap(i) }); }
      if (W.c >= 10000 && Math.random() < clamp(W.c / 140000, 0.12, 0.85)) { const g = pick(['armL', 'armR', 'legL', 'legR'].filter(x => !c.broken.includes(x))); if (g) c.breakGroup(g); } // the wall tears something off him
      if (W.c >= 100000 && Math.random() < 0.35 && !c.broken.includes('head')) c.breakGroup('head');
      cannonKick(c, Math.min(2.4, 0.3 + W.c / 70000));
      { const n = C.broken, target = Math.min(22, 6 + 1.9 * n); if (!C.sd) C.sd = Math.random() < 0.5 ? -1 : 1; const add = Math.max(2.5, target - Math.abs(canRoll(c, I))); C.spun = target; cannonSpin(c, I, C.sd * add, rand(-1, 1) * (0.8 + 0.2 * n)); cannonFlail(c, I, 1 + 0.5 * n); } // every wall winds him up more: faster roll and wilder flailing
      if (W.c >= 25000) hitStopUntil = performance.now() + 45; if (!reduceMotion) shake = Math.max(shake, 0.12 + W.c / 400000);
      lastPop = 0; pop(W.n + '!');
    } else { // stopped inside this wall
      C.stuck = i; C.vmph = 0; c.g = -9.8; C.stuckT = S.t; canLamp(i, 2); for (let q = 0; q < c.n; q++) { const k = q * 3; c.o[k + 2] = c.x[k + 2] - (c.x[k + 2] - c.o[k + 2]) * 0.1; }
      canCracks(i, sx, sy, 8, 1.1 + W.R * 0.5, true);
      const h = canHole(i, sx, sy, true); canDebris(W, i, h, true); // a dent: only the front pieces chip off
      if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'wall', a: canWallSnap(i) }); burst(new V3(sx + LAB_LANE, sy, cannonWallZ(i)), 60, CAN_PAL[W.kind] || SPARK, 6); crashSound(0.5); if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'cs', a: [0.5] }); if (!reduceMotion) shake = 0.5; hitStopUntil = performance.now() + 60;
      if (Math.random() < 0.5 && !c.broken.includes('head')) c.breakGroup('head');
      lastPop = 0; pop('STUCK IN ' + W.n + '!', 'lilac'); setFace('hit', 99999);
    }
  }
  if (C.next >= 15 && C.stuck < 0 && !C.landing) { C.landing = true; cannonLanding(c); }
}
function canPaperRaw(gi, pi, px, py, pz, rx, ry, rz, vx, vy, vz, wx, wy, wz, life) { const sh = CAN.paper.find(q => q.life <= 0); if (!sh) return; const m = sh.m, pm = CAN.posters[pi].mesh.material;
  m.geometry = canShardGeo().paper[gi]; m.material.map = pm.map; m.material.needsUpdate = true; m.scale.setScalar(1); m.visible = true; m.position.set(px, py, pz); m.rotation.set(rx, ry, rz); sh.v.set(vx, vy, vz); sh.w.set(wx, wy, wz); sh.life = life; }
function canPaper(i, p, n) { const z = cannonWallZ(i), pi = CAN.posters.indexOf(p);
  for (let q = 0; q < n; q++) { const a = [Math.floor(rand(0, 3)), pi, LAB_LANE + p.x + rand(-0.4, 0.4), p.y + rand(-0.5, 0.5), z + 0.1, rand(0, 6), rand(0, 6), rand(0, 6), rand(-2, 2), rand(0, 3), -rand(2, 9), rand(-6, 6), rand(-6, 6), rand(-6, 6), rand(4, 7)]; canPaperRaw(...a); if (CREC.on) CREC.ev.push({ t: CREC.t, k: 'paper', a }); } }
function canFrameAt(F, t) { let i = 0; while (i < F.length - 2 && F[i + 1][0] <= t) i++; const a = F[i], b = F[i + 1] || a, k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0; return { a, b, k }; }
function cannonRecFrame(dt) { // Daggie's parts, the model speed and the wall count for this frame
  if (!CREC.on) return; CREC.t += dt; const S = RAGSIM, k = S.I.pel * 3, f = new Float32Array(6 + parts.length * 7), q = new THREE.Quaternion(), v = new V3();
  f[0] = CREC.t; f[1] = CAN.vmph; f[2] = CAN.broken; f[3] = S.core.x[k]; f[4] = S.core.x[k + 1]; f[5] = S.core.x[k + 2];
  parts.forEach((p, i) => { p.getWorldPosition(v); p.getWorldQuaternion(q); f.set([v.x, v.y, v.z, q.x, q.y, q.z, q.w], 6 + i * 7); }); CREC.frames.push(f);
}
function cannonReplayStart() {
  const F = CREC.frames; if (F.length < 20) { CREC.on = false; return false; }
  CREC.on = false; for (const p of parts) if (p.parent !== scene) scene.attach(p);
  cannonShow(true); CAN.phase = 'replay'; board.visible = false; // the walls, lamps, pieces and posters go back to the start; Daggie and the pieces then replay from the log
  CREC.play = { rt: 0, ei: 0, skip: false, T: F[F.length - 1][0] + 0.8, slowT: 0 }; slowUntil = 0; slowK = 1; labBars(true); labDmg(true, 0, 'WALLS', ' / 15', 0, CAN.sub); labSpeedo(CAN.mph);
  return true;
}
function cannonReplayEvent(e) {
  const a = e.a;
  if (e.k === 'b') burst(new V3(a[0], a[1], a[2]), a[3], a[4], a[5]);
  else if (e.k === 'sp') { const set = CAN.byId[a[0]]; if (set) set.raw(...a.slice(1)); }
  else if (e.k === 'wall') { canWallApply(a); CREC.play.slowT = CREC.play.rt + 0.7; }
  else if (e.k === 'lamp') canLamp(a[0], a[1]);
  else if (e.k === 'pop') { lastPop = 0; pop(a[0], a[1] || undefined); }
  else if (e.k === 'ws') { wallSound(CANNON_WALLS[a[0]], a[0]); if (!reduceMotion) shake = Math.max(shake, 0.18); }
  else if (e.k === 'cs') crashSound(a[0]);
  else if (e.k === 'cb') cannonBoom(a[0]);
  else if (e.k === 'rs') ripSound();
  else if (e.k === 'face') setFace(a[0], a[1]);
  else if (e.k === 'paper') canPaperRaw(...a);
  else if (e.k === 'poster') { const p = CAN.posters[a[0]]; if (p) { p.alive = false; p.mesh.visible = false; } }
}
function cannonReplayStep(dt) {
  const P = CREC.play; if (!P) return; const F = CREC.frames, speed = P.rt < P.slowT ? 0.14 : 0.38, h = dt * speed; P.rt += h; // the shot itself ran at 0.4: the replay is slower still around every wall that breaks
  while (P.ei < CREC.ev.length && CREC.ev[P.ei].t <= P.rt) cannonReplayEvent(CREC.ev[P.ei++]);
  const { a, b, k } = canFrameAt(F, Math.min(P.rt, F[F.length - 1][0])), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  parts.forEach((p, j) => { const o = 6 + j * 7; p.position.set(lerp(a[o], b[o], k), lerp(a[o + 1], b[o + 1], k), lerp(a[o + 2], b[o + 2], k)); qa.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]); qb.set(b[o + 3], b[o + 4], b[o + 5], b[o + 6]); p.quaternion.copy(qa).slerp(qb, k); });
  CAN.fx = lerp(a[3], b[3], k); CAN.fy = lerp(a[4], b[4], k); CAN.fz = lerp(a[5], b[5], k); if (lerp(a[1], b[1], k) > 15 && P.rt < F[F.length - 1][0] - 0.3) cannonTrail(CAN.fx, CAN.fy, CAN.fz + 0.9);
  labSpeedo(lerp(a[1], b[1], k)); labDmg(true, Math.round(lerp(a[2], b[2], k)), 'WALLS', ' / 15', 0, CAN.sub); { const vv = lerp(a[1], b[1], k); windSet(vv > 15 && P.rt < F[F.length - 1][0] - 0.3 ? vv : 0); }
  cannonShardStep(h);
  if (P.rt >= P.T || P.skip) cannonReplayEnd();
}
function cannonReplayEnd() {
  const F = CREC.frames, last = F[F.length - 1]; CREC.play = null; labBars(false); windSet(0);
  parts.forEach((p, j) => { const o = 6 + j * 7; p.position.set(last[o], last[o + 1], last[o + 2]); p.quaternion.set(last[o + 3], last[o + 4], last[o + 5], last[o + 6]); });
  CAN.phase = 'end'; labFinish(LAB.text);
}
// the orbit camera: drag to turn, pinch (or wheel) to move closer or further, double tap to put it back. It always looks at him.
function canOrbit(tx, ty, tz, dx0, dz0, cam, camH) { // pure: where the camera goes for a default offset (dx0, dz0, height above the target) and the player's turn / tilt / zoom
  const dy0 = (camH === undefined ? 2.6 : camH) - ty, hd = Math.hypot(dx0, dz0), yaw = Math.atan2(dx0, dz0) + cam.yaw, el = Math.min(1.35, Math.max(0.02, Math.atan2(dy0, hd) + cam.pitch)), dist = Math.hypot(hd, dy0) * cam.zoom;
  return [tx + dist * Math.cos(el) * Math.sin(yaw), Math.max(0.5, ty + dist * Math.sin(el)), tz + dist * Math.cos(el) * Math.cos(yaw)];
}

// ---------- the trail behind the shot: soft smoke puffs and fire, bigger and hotter with every cannon ----------
let CAN_PUFF_TEX = null;
function canPuff() { if (!CAN_PUFF_TEX) CAN_PUFF_TEX = tex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let k = 0; k < 9; k++) { const x = w * (0.28 + Math.random() * 0.44), y = h * (0.28 + Math.random() * 0.44), r = w * (0.1 + Math.random() * 0.14), b = g.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, 'rgba(255,255,255,0.35)'); b.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = b; g.fillRect(0, 0, w, h); } }); return CAN_PUFF_TEX; }
class CanTrail { // camera-facing quads with their own colour and fade; one draw call per layer
  constructor(N, additive) {
    this.N = N; this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.age = new Float32Array(N); this.life = new Float32Array(N); this.s0 = new Float32Array(N); this.s1 = new Float32Array(N); this.col = new Float32Array(N * 4); this.rot = new Float32Array(N); this.spin = new Float32Array(N); this.drag = new Float32Array(N); this.next = 0; this.any = false;
    this.pos = new Float32Array(N * 12); this.uv = new Float32Array(N * 8); this.ac = new Float32Array(N * 16); const idx = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6); this.uv.set([0, 1, 1, 1, 0, 0, 1, 0], i * 8); for (let k = 0; k < 4; k++) this.pos[i * 12 + k * 3 + 1] = -99; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2)); g.setAttribute('aCol', new THREE.BufferAttribute(this.ac, 4)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: canPuff() } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute vec4 aCol; varying vec4 vC; varying vec2 vUv; void main() { vC = aCol; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform sampler2D map; varying vec4 vC; varying vec2 vUv; void main() { float a = texture2D(map, vUv).a * vC.a; gl_FragColor = vec4(vC.rgb, a); }' });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; scene.add(this.mesh);
  }
  clear() { this.life.fill(0); for (let i = 0; i < this.N; i++) for (let k = 0; k < 4; k++) { this.pos[i * 12 + k * 3] = 0; this.pos[i * 12 + k * 3 + 1] = -99; this.pos[i * 12 + k * 3 + 2] = 0; } this.mesh.geometry.attributes.position.needsUpdate = true; this.any = false; }
  emit(x, y, z, vx, vy, vz, s0, s1, life, r, g, b, a, drag) { const i = this.next, k = i * 3; this.next = (i + 1) % this.N; this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz; this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a; this.rot[i] = Math.random() * 6.28; this.spin[i] = (Math.random() - 0.5) * 1.2; this.drag[i] = drag; this.any = true; }
  step(dt) {
    if (!this.any) return; const e = camera.matrixWorld.elements, rx = e[0], ry = e[1], rz = e[2], ux = e[4], uy = e[5], uz = e[6]; let alive = false;
    for (let i = 0; i < this.N; i++) {
      const o = i * 12, ca = i * 16; if (this.life[i] <= 0) continue; this.age[i] += dt; const t = this.age[i] / this.life[i];
      if (t >= 1) { this.life[i] = 0; for (let k = 0; k < 4; k++) { this.pos[o + k * 3 + 1] = -99; this.ac[ca + k * 4 + 3] = 0; } continue; } alive = true;
      const k3 = i * 3, dr = Math.exp(-this.drag[i] * dt); this.v[k3] *= dr; this.v[k3 + 1] *= dr; this.v[k3 + 2] *= dr; this.p[k3] += this.v[k3] * dt; this.p[k3 + 1] += this.v[k3 + 1] * dt; this.p[k3 + 2] += this.v[k3 + 2] * dt;
      const size = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t), ang = this.rot[i] + this.spin[i] * this.age[i], c = Math.cos(ang) * size, s = Math.sin(ang) * size;
      const ax = rx * c + ux * s, ay = ry * c + uy * s, az = rz * c + uz * s, bx = -rx * s + ux * c, by = -ry * s + uy * c, bz = -rz * s + uz * c, px = this.p[k3], py = this.p[k3 + 1], pz = this.p[k3 + 2];
      this.pos[o] = px - ax + bx; this.pos[o + 1] = py - ay + by; this.pos[o + 2] = pz - az + bz; this.pos[o + 3] = px + ax + bx; this.pos[o + 4] = py + ay + by; this.pos[o + 5] = pz + az + bz;
      this.pos[o + 6] = px - ax - bx; this.pos[o + 7] = py - ay - by; this.pos[o + 8] = pz - az - bz; this.pos[o + 9] = px + ax - bx; this.pos[o + 10] = py + ay - by; this.pos[o + 11] = pz + az - bz;
      const fade = (t < 0.1 ? t / 0.1 : 1) * Math.pow(1 - t, 1.4), al = this.col[i * 4 + 3] * fade;
      for (let k = 0; k < 4; k++) { this.ac[ca + k * 4] = this.col[i * 4]; this.ac[ca + k * 4 + 1] = this.col[i * 4 + 1]; this.ac[ca + k * 4 + 2] = this.col[i * 4 + 2]; this.ac[ca + k * 4 + 3] = al; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.aCol.needsUpdate = true; if (!alive) this.any = false;
  }
}
// per cannon: how far apart the puffs are, and [r, g, b, alpha, start size, end size, life, drag] of the smoke, the fire and the hot core
const CAN_TRAIL = [
  { gap: 0.9, smoke: [0.88, 0.9, 0.94, 0.5, 0.35, 1.3, 1.3, 1.2] },
  { gap: 0.75, smoke: [0.62, 0.64, 0.7, 0.6, 0.45, 1.7, 1.5, 1.1] },
  // from level 3 on the trail stays thin and pale, like the wake of something very fast, with a few small embers close behind him (no rocket flame)
  { gap: 0.8, smoke: [0.6, 0.6, 0.62, 0.26, 0.3, 1.0, 1.0, 1.6], fire: [2.4, 1.0, 0.25, 0.5, 0.14, 0.3, 0.2, 3], fgap: 0.8 },
  { gap: 0.7, smoke: [0.62, 0.62, 0.65, 0.28, 0.32, 1.2, 1.1, 1.6], fire: [2.4, 1.0, 0.25, 0.55, 0.15, 0.33, 0.22, 3], fgap: 0.55 },
  { gap: 0.6, smoke: [0.66, 0.66, 0.7, 0.3, 0.35, 1.4, 1.2, 1.6], fire: [2.6, 1.1, 0.3, 0.6, 0.16, 0.38, 0.24, 3], fgap: 0.4 },
];
const CAN_MUZZLE_FIRE = [2.6, 1.1, 0.25]; // the flash at the muzzle keeps its own, stronger colour
function cannonTrail(x, y, z) { // called every frame with the point behind him; puffs are laid by distance, so a fast shot leaves a continuous trail
  const T = CAN_TRAIL[clamp(CAN.lv, 1, 5) - 1], L = CAN.tl; if (!L) { CAN.tl = [x, y, z, x, y, z]; return; }
  const lay = (idx, gap, fn) => { const d = Math.hypot(x - L[idx], y - L[idx + 1], z - L[idx + 2]); if (d > 6) { L[idx] = x; L[idx + 1] = y; L[idx + 2] = z; return; } const n = Math.floor(d / gap); if (!n) return;
    for (let k = 1; k <= n; k++) { const u = k * gap / d; fn(L[idx] + (x - L[idx]) * u, L[idx + 1] + (y - L[idx + 1]) * u, L[idx + 2] + (z - L[idx + 2]) * u); } const u = n * gap / d; L[idx] += (x - L[idx]) * u; L[idx + 1] += (y - L[idx + 1]) * u; L[idx + 2] += (z - L[idx + 2]) * u; };
  const em = (sys, a, ex, ey, ez, rise) => sys.emit(ex + rand(-0.12, 0.12), ey + rand(-0.12, 0.12), ez, rand(-0.5, 0.5), rise * rand(0.2, 1.1), rand(-0.3, 0.6), a[4], a[5] * rand(0.8, 1.2), a[6] * rand(0.8, 1.2), a[0], a[1], a[2], a[3], a[7]);
  lay(0, T.gap, (ex, ey, ez) => em(CAN.smoke, T.smoke, ex, ey, ez, 1.1));
  if (T.fire) lay(3, T.fgap, (ex, ey, ez) => em(CAN.fire, T.fire, ex, ey, ez, 0.2));
}
function cannonMuzzleCloud() { // the big puff of smoke at the muzzle, bigger with the cannon
  const T = CAN_TRAIL[clamp(CAN.lv, 1, 5) - 1], lv = CAN.lv, sp = CAN_SPEC[lv - 1], mz = [LAB_LANE, sp.wr + 0.35, MUZZLE_Z - 0.5], n = 10 + lv * 6, a = T.smoke;
  for (let k = 0; k < n; k++) CAN.smoke.emit(mz[0] + rand(-0.4, 0.4), mz[1] + rand(-0.3, 0.3), mz[2] - rand(0, 1.2), rand(-3, 3) * (0.6 + lv * 0.15), rand(0.2, 2.4), -rand(1, 7 + lv * 1.8), a[4] * 2.5, a[5] * 2.2 * rand(0.7, 1.3), 2.6, Math.min(1, a[0] * 1.3), Math.min(1, a[1] * 1.3), Math.min(1, a[2] * 1.3), Math.min(1, a[3] + 0.15), 1.1);
  if (T.fire) for (let k = 0; k < 4 + lv * 2; k++) CAN.fire.emit(mz[0] + rand(-0.2, 0.2), mz[1] + rand(-0.2, 0.2), mz[2] - rand(0, 1.5), rand(-2, 2), rand(-1, 2), -rand(4, 14), 0.5 + lv * 0.25, 1.4 + lv * 0.5, 0.35 + lv * 0.06, CAN_MUZZLE_FIRE[0], CAN_MUZZLE_FIRE[1], CAN_MUZZLE_FIRE[2], 1, 3);
}
let CAN_IN = false;
function canInput() {
  if (CAN_IN) return; CAN_IN = true; const pts = new Map(); let moved = 0, downT = 0, lastTap = 0; const cam = CAN.cam;
  const on = e => MODE === 'lab' && (LAB.machine === 'cannon' || LAB.machine === 'stairs' || (labBol() && !LAB.replay)) && e.target === canvas;
  stage.addEventListener('pointerdown', e => { if (!on(e)) return; e.stopImmediatePropagation(); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { moved = 0; downT = performance.now(); } }, true);
  stage.addEventListener('pointermove', e => { if (!pts.has(e.pointerId) || !on(e)) return; e.stopImmediatePropagation(); const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 1) { cam.yaw -= dx * 0.008; cam.pitch = Math.min(1.2, Math.max(-0.3, cam.pitch + dy * 0.006)); }
    else if (pts.size === 2) { const [u, w] = [...pts.values()], d0 = Math.hypot(u.x - w.x, u.y - w.y); p.x = e.clientX; p.y = e.clientY; const d1 = Math.hypot(u.x - w.x, u.y - w.y); if (d0 > 8 && d1 > 8) cam.zoom = Math.min(3.5, Math.max(0.3, cam.zoom * d0 / d1)); }
    p.x = e.clientX; p.y = e.clientY; }, true);
  const up = e => { if (!pts.has(e.pointerId)) return; if (on(e)) e.stopImmediatePropagation(); const alone = pts.size === 1; pts.delete(e.pointerId);
    if (alone && moved < 12 && performance.now() - downT < 320) { const now = performance.now(); if (CREC.play) CREC.play.skip = true; else if (now - lastTap < 320) { cam.yaw = 0; cam.pitch = 0; cam.zoom = 1; } lastTap = now; } };
  stage.addEventListener('pointerup', up, true); stage.addEventListener('pointercancel', up, true);
  stage.addEventListener('wheel', e => { if (!on(e)) return; e.preventDefault(); cam.zoom = Math.min(3.5, Math.max(0.3, cam.zoom * (1 + e.deltaY * 0.001))); }, { passive: false });
  canvas.style.touchAction = 'none';
  const hint = document.createElement('div'); hint.textContent = 'Drag: turn the camera · Pinch: zoom · Double tap: reset'; hint.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 150px);z-index:7;pointer-events:none;font:600 13px ui-monospace,Menlo,monospace;color:#fff;background:rgba(10,12,24,.55);padding:6px 12px;border-radius:14px;opacity:0;transition:opacity .5s'; stage.appendChild(hint);
  CAN.hint = () => { hint.style.opacity = '1'; setTimeout(() => { hint.style.opacity = '0'; }, 5000); };
}
function cannonLanding(c) { c.g = -9.8; c.damp = 0.985; c.drag = 0.04; c.airXZ = true; slowUntil = performance.now() + 3500; slowK = 0.85; } // what is left of the shot is spent: the air stops him sideways within a few metres, and he drops like a body (this used to slow his fall too, so he floated down)
function cannonStep(dt, now) {
  const C = CAN; C.t += dt; if (C.phase !== 'replay') cannonShardStep(dt); // (the replay steps the pieces itself, at the replay's speed)
  if (C.recoil > 0) { C.recoil = Math.max(0, C.recoil - dt * 2.2); C.barrel.position.z = MUZZLE_Z + CAN_SPEC[clamp(C.lv, 1, 5) - 1].L + C.recoil * 0.9; }
  if (C.phase === 'load') {
    labSpeedo(0); const n = Math.floor(C.t / 0.45); if (n !== C.count && n < 4) { C.count = n; if (n >= 1 && n <= 3) { lastPop = 0; pop(String(4 - n), 'lilac'); tone(700, 700, 0.1, 'square', 0.05); } }
    if (C.t >= 1.8) cannonFire();
  } else if (C.phase === 'fly' && RAGSIM) {
    const S = RAGSIM; ragSimStep(dt); cannonDrive(S.core, S.I, dt); cannonWalls(); cannonRecFrame(dt); if (C.vmph > 15 && !C.landing) cannonTrail(S.core.x[S.I.pel * 3], S.core.x[S.I.pel * 3 + 1], S.core.x[S.I.pel * 3 + 2] + 0.9);
    labSpeedo(CAN.vmph); labDmg(true, CAN.broken, 'WALLS', ' / 15', 0, CAN.sub); windSet(C.vmph > 15 && !C.landing && C.stuck < 0 ? C.vmph : 0);
    const k = S.I.pel * 3, sp = Math.hypot(S.core.x[k] - S.core.o[k], S.core.x[k + 1] - S.core.o[k + 1], S.core.x[k + 2] - S.core.o[k + 2]) * 240;
    C.rest = sp < 0.6 ? C.rest + dt : 0; LAB.dist = Math.max(0, (BOLLARD_Z - S.core.x[k + 2])) * 3.28084;
    const over = C.stuck >= 0 ? S.t - C.stuckT > 2.2 : (C.next >= 15 && C.rest > 0.8) || S.t > 14;
    if (over || C.rest > 1.6) {
      C.phase = 'end'; const nm = C.stuck >= 0 ? CANNON_WALLS[C.stuck].n : '';
      LAB.text = C.broken >= 15 ? 'broke all 15 walls!' : 'broke ' + C.broken + ' wall' + (C.broken === 1 ? '' : 's') + (nm ? ' · stopped by ' + nm : '');
      windSet(0); lastPop = 0; pop(C.broken >= 15 ? 'ALL 15!' : C.broken + ' / 15', 'green'); if (!cannonReplayStart()) labFinish(LAB.text);
    }
  } else if (C.phase === 'replay') cannonReplayStep(dt);
  else if (C.phase === 'end' && RAGSIM) ragSimStep(dt);
}
function cannonCam() {
  let p;
  if (!RAGSIM && !CREC.play) { p = canOrbit(LAB_LANE, 1.5, MUZZLE_Z - 3, 11, 12, CAN.cam); wantPos.set(p[0], p[1], p[2]); wantLook.set(LAB_LANE, 1.5, MUZZLE_Z - 3); snapCam = true; return 6; }
  if (RAGSIM && !CREC.play) { const c = RAGSIM.core, I = RAGSIM.I; let z = 0, y = 0; for (const nm of ['pel', 'waist', 'chest']) { z += c.x[I[nm] * 3 + 2]; y += c.x[I[nm] * 3 + 1]; } CAN.fz = z / 3; CAN.fy = y / 3; }
  // locked on to him: the view is narrow in portrait (about 24 degrees wide), so the target is only 1.4 m ahead of him; the player can turn, tilt and zoom (CAN.cam)
  const ty = Math.max(1.3, CAN.fy * 0.85), tz = CAN.fz - 1.4; p = canOrbit(LAB_LANE, ty, tz, 10.5, 5.6, CAN.cam); wantPos.set(p[0], p[1], p[2]); wantLook.set(LAB_LANE, ty, tz); snapCam = true; // snap: no smoothing lag at 40-60 m/s
  return 14;
}

// ---------- the staircase: Daggie is pushed off the top landing of a long concrete stair and tumbles down it ----------
const STAIRS_STEPS = [10, 50, 100]; // (300 and 1000 come next)
const STR_RUN = 0.32, STR_RISE = 0.19, STR_W = 6, STR_LIMB = { haL: 'armL', wrL: 'armL', haR: 'armR', wrR: 'armR', toL: 'legL', knL: 'legL', toR: 'legR', knR: 'legR', top: 'head' };
const STAIR = { built: {}, n: 10, H: 1.9, z0: BOLLARD_Z - 4, phase: 'idle', t: 0, steps: 0, rest: 0, cool: {}, psp: {}, lampDone: {}, lostMark: 0, count: 0, fx: 0, fy: 1, fz: -12, lamps: [], lampsOf: {} };
function stairFloor(x, z) { if (z >= STAIR.z0) return STAIR.H; const k = Math.floor((STAIR.z0 - z) / STR_RUN); return k >= STAIR.n ? 0 : STAIR.H - (k + 1) * STR_RISE; }
function stairsGeo(n) { // the stair block: platform, treads, risers and both sides, as one mesh
  const W2 = STR_W / 2, H = n * STR_RISE, z0 = STAIR.z0, P = [], N = [], U = [];
  const quad = (a, b, c, d, nx, ny, nz, us) => { for (const v of [a, b, c, a, c, d]) { P.push(v[0], v[1], v[2]); N.push(nx, ny, nz); U.push(us === 'xz' ? v[0] / 3 : us === 'zy' ? v[2] / 3 : v[0] / 3, us === 'xz' ? v[2] / 3 : v[1] / 3); } };
  quad([-W2, H, z0 + 7], [W2, H, z0 + 7], [W2, H, z0], [-W2, H, z0], 0, 1, 0, 'xz'); // the top landing
  quad([-W2, 0, z0 + 7], [W2, 0, z0 + 7], [W2, H, z0 + 7], [-W2, H, z0 + 7], 0, 0, 1, 'xy');
  for (const sx of [-1, 1]) quad([sx * W2, 0, z0], [sx * W2, 0, z0 + 7], [sx * W2, H, z0 + 7], [sx * W2, H, z0], sx, 0, 0, 'zy');
  for (let k = 0; k < n; k++) {
    const zf = z0 - k * STR_RUN, zb = zf - STR_RUN, yk = Math.max(0.004, H - (k + 1) * STR_RISE), yp = H - k * STR_RISE;
    quad([-W2, yk, zf], [W2, yk, zf], [W2, yk, zb], [-W2, yk, zb], 0, 1, 0, 'xz'); // tread
    quad([-W2, yk, zf], [W2, yk, zf], [W2, yp, zf], [-W2, yp, zf], 0, 0, -1, 'xy'); // riser (faces down the stairs)
    for (const sx of [-1, 1]) quad([sx * W2, 0, zf], [sx * W2, 0, zb], [sx * W2, yk, zb], [sx * W2, yk, zf], sx, 0, 0, 'zy');
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); return g;
}
function stairsBuild(n) {
  if (STAIR.built[n]) return STAIR.built[n]; const grp = new THREE.Group(), W2 = STR_W / 2, H = n * STR_RISE, z0 = STAIR.z0, L = n * STR_RUN;
  const map = tex(512, 320, (c, w, h) => CAN_DRAW.concrete(c, w, h)); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const conc = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.4, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide }), rail = new THREE.MeshStandardMaterial({ color: 0x2b2f38, metalness: 0.6, roughness: 0.45 });
  const body = new THREE.Mesh(stairsGeo(n), conc); body.castShadow = true; body.receiveShadow = true; grp.add(body);
  const ang = -Math.atan2(H, L), slope = Math.hypot(H, L);
  for (const sx of [-1, 1]) { // low walls along both sides (he is kept on the stairs)
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, slope), rail); r.position.set(sx * (W2 + 0.1), H / 2 + 0.5, z0 - L / 2); r.rotation.x = ang; r.castShadow = true; grp.add(r);
    const lp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 7), rail); lp.position.set(sx * (W2 + 0.1), H + 0.5, z0 + 3.5); grp.add(lp);
  }
  const lamps = [];
  for (let m = 1; m <= Math.floor(n / 10); m++) { // a lamp and a number every 10 steps
    const k = m * 10, z = z0 - k * STR_RUN, y = H - k * STR_RISE, bulbM = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.15, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 0 }), haloM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (const sx of [-1, 1]) { const x = sx * (W2 + 0.1), post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 10), rail); post.position.set(x, y + 1.25, z); grp.add(post);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), bulbM); bulb.position.set(x, y + 1.6, z); grp.add(bulb); const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), haloM); halo.position.copy(bulb.position); grp.add(halo);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.38), sign(String(k), '#16141c', '#ffd23a', 256, 108)); sg.position.set(sx * (W2 + 0.003 - 0.0) * 1, y + 0.55, z - 0.0); sg.rotation.y = sx * Math.PI / 2 * -1; grp.add(sg); }
    lamps.push({ bulbM, haloM, state: 0, flash: 0 });
  }
  grp.visible = false; scene.add(grp); return (STAIR.built[n] = { grp, lamps });
}
function stairsLamp(i, state) { const L = STAIR.lamps[i]; if (!L) return; L.state = state; L.flash = state ? 1 : 0; const col = state === 1 ? 0x2bff63 : state === 2 ? 0xff2a2a : 0x000000; L.bulbM.color.setHex(state ? col : 0x2c2f36); L.bulbM.emissive.setHex(col); L.bulbM.emissiveIntensity = state ? 4 : 0; L.haloM.color.setHex(col); L.haloM.opacity = state ? 0.55 : 0; }
function stairsShow(on) {
  for (const k in STAIR.built) STAIR.built[k].grp.visible = false; if (!on) { stage.classList.remove('cannonrun'); return; }
  const n = STAIRS_STEPS[clamp(LAB.level, 1, STAIRS_STEPS.length) - 1]; STAIR.n = n; STAIR.H = n * STR_RISE; const b = stairsBuild(n); b.grp.visible = true; STAIR.lamps = b.lamps; STAIR.lamps.forEach((l, i) => stairsLamp(i, 0));
  if (!CAN_IN) { canInput(); CAN.hint(); } if (!(RAGSIM && LAB.phase === 'stairs')) stage.classList.remove('cannonrun'); BOLLARD && (BOLLARD.visible = false);
}
function stairsStart(lv) {
  stairsShow(true); lv = clamp(lv, 1, STAIRS_STEPS.length); Object.assign(STAIR, { phase: 'load', t: 0, steps: 0, rest: 0, cool: {}, psp: {}, lampDone: {}, lostMark: 0, count: 0, maxSteps: 0, bottom: false });
  LAB.phase = 'stairs'; board.visible = false; stage.classList.add('cannonrun'); labDmg(false); CAN.sub = 'PARTS 5 / 5';
}
function stairsPush() {
  STAIR.phase = 'fall'; STAIR.t = 0; CART.box.on = false; CART.cyls.length = 0; LABCART.hit = false;
  ragStart(new V3(rand(-0.7, 0.7), 1.5, -rand(3, 5)), 0);
  const S = RAGSIM, c = S.core, I = S.I; S.fast = true; c.floor = stairFloor; c.friction = 0.995; c.damp = 0.9995; c.drag = 0; c.airXZ = false; c.g = -9.8; S.hook = stairsHold; S.t = 0;
  cannonSpin(c, I, 0, -rand(3, 5.5)); // pushed head first: a forward somersault
  lastPop = 0; pop('PUSH!', 'lilac'); setFace('scared', 6000);
}
function stairsHold(core) { for (let i = 0; i < core.n; i++) { const k = i * 3, lim = STR_W / 2 - 0.1; if (core.x[k] > LAB_LANE + lim) { core.x[k] = LAB_LANE + lim; core.o[k] = core.x[k]; } else if (core.x[k] < LAB_LANE - lim) { core.x[k] = LAB_LANE - lim; core.o[k] = core.x[k]; } } }
function stairsTear(c, I, dt) { // a hard knock on a hand, a foot or the head can tear that part off: the harder the knock, the likelier
  const torn = [];
  for (const nm in STR_LIMB) { const g = STR_LIMB[nm]; STAIR.cool[g] = (STAIR.cool[g] || 0) - dt; const k = I[nm] * 3, sp = Math.hypot(c.x[k] - c.o[k], c.x[k + 1] - c.o[k + 1], c.x[k + 2] - c.o[k + 2]) * 240, drop = (STAIR.psp[nm] ?? sp) - sp; STAIR.psp[nm] = sp;
    if (drop > 4.5 && STAIR.cool[g] <= 0 && !c.broken.includes(g)) { STAIR.cool[g] = 0.3; if (Math.random() < Math.min(0.7, (drop - 4.5) / 16)) { c.breakGroup(g); torn.push(g); } } }
  return torn;
}
function stairsStep(dt, now) {
  STAIR.t += dt; for (const L of STAIR.lamps) if (L.flash > 0) { L.flash = Math.max(0, L.flash - dt * 1.6); L.bulbM.emissiveIntensity = 2.6 + 3.2 * L.flash; L.haloM.opacity = 0.35 + 0.35 * L.flash; }
  if (STAIR.phase === 'load') { const n = Math.floor(STAIR.t / 0.45); if (n !== STAIR.count && n < 4) { STAIR.count = n; if (n >= 1 && n <= 3) { lastPop = 0; pop(String(4 - n), 'lilac'); tone(700, 700, 0.1, 'square', 0.05); } } if (STAIR.t >= 1.8) stairsPush(); return; }
  if (!RAGSIM) return;
  const S = RAGSIM, c = S.core, I = S.I; ragSimStep(dt); if (STAIR.phase === 'end') return;
  const k = I.pel * 3, z = c.x[k + 2], sp = Math.hypot(c.x[k] - c.o[k], c.x[k + 1] - c.o[k + 1], c.x[k + 2] - c.o[k + 2]) * 240; STAIR.fx = c.x[k]; STAIR.fy = c.x[k + 1]; STAIR.fz = z;
  const steps = clamp(Math.floor((STAIR.z0 - z) / STR_RUN), 0, STAIR.n); STAIR.steps = Math.max(STAIR.steps, steps); stairsTear(c, I, dt);
  const left = 5 - c.broken.length; CAN.sub = 'PARTS ' + left + ' / 5'; labDmg(true, STAIR.steps, 'STEPS', ' / ' + STAIR.n, 0, CAN.sub);
  for (let m = 1; m <= STAIR.lamps.length; m++) if (STAIR.steps >= m * 10 && !STAIR.lampDone[m]) { STAIR.lampDone[m] = true; stairsLamp(m - 1, c.broken.length > STAIR.lostMark ? 2 : 1); STAIR.lostMark = c.broken.length; tone(520 + m * 40, 520 + m * 40, 0.12, 'sine', 0.05); }
  if (z < STAIR.z0 - STAIR.n * STR_RUN - 1) STAIR.bottom = true;
  STAIR.rest = sp < 0.6 && STAIR.t > 1.5 ? STAIR.rest + dt : 0;
  if (STAIR.rest > 1.3 || STAIR.t > 90) {
    STAIR.phase = 'end'; const parts = 5 - c.broken.length;
    LAB.text = STAIR.steps >= STAIR.n - 1 ? (parts === 5 ? 'survived' : 'rolled down all ' + STAIR.n + ' steps, ' + (parts ? parts + ' of 5 parts left' : 'no parts left')) : 'stopped on step ' + STAIR.steps + ' of ' + STAIR.n + ', ' + parts + ' of 5 parts left';
    lastPop = 0; pop(STAIR.steps >= STAIR.n - 1 ? 'BOTTOM!' : 'STEP ' + STAIR.steps, 'green'); labFinish(LAB.text);
  }
}
function stairsCam() {
  let p, ty, tz; const n = STAIR.n, H = STAIR.H, L = n * STR_RUN;
  if (!RAGSIM) { ty = H * 0.5 + 0.8; tz = STAIR.z0 - L * 0.5 + 1.5; const d = Math.max(10, L * 2.3 + 6); p = canOrbit(LAB_LANE, ty, tz, d, d * 0.25, CAN.cam, ty + 1); wantPos.set(p[0], p[1], p[2]); wantLook.set(LAB_LANE, ty, tz); snapCam = true; return 6; }
  ty = STAIR.fy + 0.4; tz = STAIR.fz - 1.0; p = canOrbit(LAB_LANE, ty, tz, 11, 3.5, CAN.cam, ty + 2); wantPos.set(p[0], p[1], p[2]); wantLook.set(LAB_LANE, ty, tz); snapCam = true; return 14;
}
function bollardVis() { // the yellow post (and its base plate) exist only in the cart and bathtub machines, and in the mix when the post is the chosen obstacle
  if (!BOLLARD) return; const on = LAB.machine === 'bollard' || LAB.machine === 'tub' || (LAB.machine === 'mix' && MIX.obs === 'post'); BOLLARD.visible = on; if (BOLLARD.parent) BOLLARD.parent.visible = on;
}
function labStep(dt, now) {
  bollardVis(); stepGas(dt);
  if (LAB.machine === 'cannon') { if (state === 'lab' && LAB.pending && now > LAB.pending) { LAB.pending = 0; labDone(); } cannonStep(dt, now); return; }
  if (LAB.machine === 'stairs') { if (state === 'lab' && LAB.pending && now > LAB.pending) { LAB.pending = 0; labDone(); } stairsStep(dt, now); return; } // (the result menu was never reached from here before)
  if (state === 'lab') { if (now - stateT > 2500) $('hook').classList.remove('show'); if (LAB.pending && now > LAB.pending) { LAB.pending = 0; labDone(); } }
  const lv = LAB.level, P = LAB.phase; LAB.t += dt;
  const butt = () => byName.pelvis.getWorldPosition(new V3()).add(new V3(0, -0.3, 0));
  if (labBol()) {
    labSpeedo(P === 'roll' && state === 'ride' ? LABCART.v / 0.447 : P === 'idle' ? 0 : LABCART.v / 0.447 * (LABCART.hit ? 1 : 0));
    if (state === 'ride' && (P === 'roll' || P === 'crash')) labRec(dt);
    if (LAB_STREAKS) LAB_STREAKS.visible = P === 'roll' && state === 'ride' && LABCART.v >= 22.3; // 50 mph and up
    if (P === 'replay') { labDmg(true, LAB.dist || 0, 'DISTANCE', ' FT', 0); labReplayStep(dt, now); return; }
    if (P === 'roll' && state === 'ride') { if (CART.pw[1] - BOLLARD_Z < 7 && faceMode !== 'scared') setFace('scared', 5000); if (CART.step(dt)) labImpact(); labCartPlace(); labWeave(dt); for (const w of wheels) w.rotation.x -= LABCART.v / WHEEL_R * dt; if (LABCART.hit) { LAB.phase = 'crash'; LAB.t = 0; } }
    else if (P === 'crash' && RAGSIM) { ragSimStep(dt); cartDebrisStep(dt); labDmg(true, LAB.dist = labDist(), 'DISTANCE', ' FT', 0); const k = RAGSIM.I.pel * 3, L2 = LABCART.box.toLocal(RAGSIM.core.x[k], RAGSIM.core.x[k + 1], RAGSIM.core.x[k + 2]); RAGSIM.maxY = Math.max(RAGSIM.maxY || 0, L2[1]); if (RAGSIM.t > 3.4 && (RAGSIM.t > 8 || labDebrisSettled())) { const txt = labBollardOutcome(); lastPop = 0; pop(txt.startsWith('stayed') ? 'HE STAYED IN!' : txt.startsWith('flew out but') ? 'HANGING ON!' : txt.startsWith('almost') ? 'SO CLOSE!' : 'YEETED!', 'green'); LAB.outTxt = txt; labReplayStart(); } }
    else if (P === 'done' && RAGSIM) { ragSimStep(dt); cartDebrisStep(dt); }
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
  } else if (LAB.machine === 'press') {
    pressStep(dt, lv);
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
  if (LAB.machine === 'stairs' && RAGSIM) return; // the physics body has taken over
  if (labBol() || LAB.machine === 'cannon') { if (!RAGSIM) { rider.position.copy(board.position); rider.rotation.set(0, 0, 0); poseBody(t); } return; }
  rider.position.set(R.x, R.y, 0); rider.rotation.set(0, LAB_YAW, 0);
  if (LAB.machine === 'stairs') { rider.position.set(LAB_LANE, STAIR.H - BOARD_TOP, STAIR.z0 + 0.7); rider.rotation.set(0, Math.PI, 0); } // on the top landing, facing down the stairs
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
function labCam(now, dt) { /* crash-hall machines: the automatic camera, then the player's turn / tilt / zoom on top of it */
  const r = labCamBase(now, dt);
  if (labBol() && !LAB.replay) { if (!CAN_IN) { canInput(); CAN.hint(); } const c = CAN.cam; if (c.yaw || c.pitch || c.zoom !== 1) { const dx = wantPos.x - wantLook.x, dy = wantPos.y - wantLook.y, dz = wantPos.z - wantLook.z, hd = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz) + c.yaw, el = clamp(Math.atan2(dy, hd) + c.pitch, 0.02, 1.35), dist = Math.hypot(hd, dy) * c.zoom; wantPos.set(wantLook.x + dist * Math.cos(el) * Math.sin(yaw), Math.max(0.5, wantLook.y + dist * Math.sin(el)), wantLook.z + dist * Math.cos(el) * Math.cos(yaw)); } }
  return r;
}
function labCamBase(now, dt) {
  if (LAB.replay) return labReplayCam();
  const T = torso.getWorldPosition(new V3()), m = LAB.machine;
  if (m === 'cannon') return cannonCam();
  if (m === 'stairs') return stairsCam();
  if (labBol()) {
    if (!RAGSIM && LAB.phase === 'idle') { const z = board.position.z; wantPos.set(LAB_LANE + 1.5, 1.8, z + 4.9); wantLook.set(LAB_LANE - 0.5, 0.9, z - 2.6); return 40; } // the menu: the vehicle with Daggie in it close, the obstacle ahead, both in the picture
    if (!RAGSIM) { const z = board.position.z; wantPos.set(LAB_LANE + 3.2, 1.25, z + 2.4); wantLook.set(LAB_LANE, 0.9, z - 2.2); return 150; } // a tracking shot beside the cart
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
  if (m === 'press') { const e = PRESS.mode === 'load' ? clamp(PRESS.t / 2.6, 0, 1) : PRESS.mode === 'desc' ? 0 : 0.6, d = 8.2 - 2.6 * e; wantPos.copy(face).multiplyScalar(d).addScaledVector(side, 1.1 * Math.sin(now / 3000)).setY(STAND_H + 2.0 - 0.5 * e); wantLook.set(0, STAND_H + 2.0 - 0.7 * e, 0); return 3; }
  const sway = Math.sin(now / 2600) * 0.6;
  wantPos.copy(face).multiplyScalar(5.2).addScaledVector(side, 1.6 + sway).setY(STAND_H + 1.7); wantLook.set(0, STAND_H + 1.15, 0); return 3;
}
function labDone() {
  if (!labBuilt) return; stage.classList.remove('cannonrun'); mixPickVis(true);
  const survived = LAB.text === 'survived' || String(LAB.text).indexOf('stayed in the ') === 0, lost = labBol() ? 0 : cause ? 15 : LAB.lost;
  $('labRes').innerHTML = '';
  const b = document.createElement('b'); b.textContent = 'LEVEL ' + LAB.level + ' · ' + LAB_INFO[LAB.machine].title + ': ';
  $('labRes').append(b, document.createTextNode((survived ? 'SURVIVED' : (LAB.text || 'destroyed') + (lost ? ' (' + lost + '/15 parts off)' : '')) + (labBol() && LAB.dist ? ' · FLEW ' + Math.round(LAB.dist).toLocaleString('en-US') + ' FT' : '') + (labBol() && LAB.aura ? ' · BLACKIE +' + LAB.aura.toLocaleString('en-US') + ' AURA' : '')));
  if (labBol()) labReset(); // the wreck is cleared: vehicle and obstacle stand at the start, the camera is back
  $('labPanel').hidden = false; labUI();
  lastPop = 0; if (labBol() && LAB.aura) pop(LAB.six7 ? 'SIX SEVEN!' : 'DAGGIE \u2212' + LAB.aura.toLocaleString('en-US') + ' AURA', 'lilac'); else pop(survived ? 'SURVIVED!' : lost >= 15 ? 'DESTROYED!' : 'DAMAGED!', survived ? 'green' : 'lilac');
}

setLoad(1, 'Ready');
{ const note = CACHE_NOTE || (window.__cacheHit ? 'Loaded from this device' : 'Downloaded (saved for next time)');
  const el = document.createElement('div'); el.className = 'cachenote'; el.textContent = note; stage.appendChild(el); setTimeout(() => el.remove(), 1800);
  setTimeout(() => { if (!window.__cacheHit && window.__savedOk === false) { const e2 = document.createElement('div'); e2.className = 'cachenote'; e2.textContent = 'Could not save Daggie on this device (the app blocks storage).'; stage.appendChild(e2); setTimeout(() => e2.remove(), 5000); } }, 4500); }
resetRun();
try { renderer.compile(scene, camera); } catch (e) {}
setTimeout(() => $('loader').classList.add('gone'), 250);
requestAnimationFrame(frame);
