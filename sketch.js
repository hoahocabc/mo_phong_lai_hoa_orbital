let canvas;
let sidebarWidth = 220; 
let sCount = 0;
let pCount = 0;
let hybridList = []; 
let maxS = 1;
let maxP = 3;

// pOrbitals: { centerAxis, centerPos, splitAxis, splitPos, origAxis, origPos, targetAxis, targetPos, electrons }
let pOrbitals = []; 
let showAxes = false;

// When true, render everything opaque (disable transparency)
let disableTransparency = false;

// split/join state & animation
let splitState = false;
let splitAnimating = false;
let splitStart = 0;
let splitDuration = 3800; 

// rotation-only timeline for the 2-hybrid flip
let rotStart = 0;
let rotAnimating = false;
const ROTATION_DURATION_MS = 1000; // 0->180° in 1s

let rotX = -0.4, rotY = 0.6; 
let camDist = 500;

let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;

let kneading = false;
let kneadStart = 0;
let kneadDuration = 2200;

// Capture mode flags
let captureMode = false;

let camPos;

// UI refs
let btnSEl = null;
let btnPEl = null;
let btnHybridSPEl = null;
let btnHybridSP2El = null;
let btnHybridSP3El = null;
let btnCaptureEl = null;
let btnOverlayEl = null;
let btnPointsEl = null;

let hybridized = false;

// Track p counts
let pHybridizedCount = 0;   // number of p consumed into hybrids
let pAddedAfterHybrid = 0;  // bookkeeping only

let mixParticles = [];
let mixInitializedFor = 0;
let MIX_N_BASE = 240;
let MIX_SHAPES = ['sphere','ellipsoid','disk'];

// Knead config
let kneadTargetP = 0;
let kneadMixTotal = 0;

// Global scale for sizes
const SIZE_SCALE = 1.2;
const EXTRA_AXIS_MARGIN = 30 * SIZE_SCALE;

// Field of view and camera clipping
const FOV = Math.PI / 6.0;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 10000;

// Render mode: 'overlay' | 'points'
let renderMode = 'overlay';

// Electron cloud settings
let electronsDirty = true;
let sElectrons = [];
const ELECTRONS_S = 520;
const ELECTRONS_P = 600;
const ELECTRONS_HYBRID = 650;
const ELECTRON_SIZE = 1.1 * SIZE_SCALE;          // smaller electrons
const ELECTRON_MIN_DIST = ELECTRON_SIZE * 1.9;    // separation
const ELECTRON_SPEED = 0.38;
const ELECTRON_NOISE = 0.12;
const ELECTRON_DAMP = 0.93;
const ELECTRON_NEAR_MARGIN = 0.35; // 10% outside zone handled by scale factors
const ELECTRON_BRIGHTNESS = 0.78;   // dim electrons to avoid glare
const ELECTRON_ALPHA_BASE = 150;    // lower alpha for transparency
const ELECTRON_ALPHA_OPAQUE = 210;  // when transparency disabled
const CORE_MIN_DIST = 14 * SIZE_SCALE; // keep electrons away from center
const NODE_BAND_P = 4 * SIZE_SCALE;    // near nodal plane for p (small band)
const NODE_BAND_H = 5 * SIZE_SCALE;    // near nodal plane for hybrids (small band)

// Mix clustering tuning (point-mode knead)
const MIX_CLUSTER_MAX = 130 * SIZE_SCALE;  // initial gather radius
const MIX_CLUSTER_MIN = 70 * SIZE_SCALE;   // final cluster radius (not too small)
const MIX_PULL_BASE = 0.18;
const MIX_PULL_GAIN = 0.26;
const MIX_CHAOS_PHASE = 0.38;              // when chaos kicks in
const MIX_CHAOS_KICK = 0.48;               // strength of chaotic kicks

// Strings
const STRINGS = {
  vi: {
    title: "Lai hóa orbital",
    langLabel: "Ngôn ngữ",
    btnS: "Orbital s",
    btnP: "Orbital p",
    btnHybridSP: "Lai hóa sp",
    btnHybridSP2: "Lai hóa sp2",
    btnHybridSP3: "Lai hóa sp3",
    btnOverlay: "Dạng lớp phủ",
    btnPoints: "Dạng điểm",
    labelSplit: "Tách/Nhập orbital",
    labelAxes: "Hiện trục orbital",
    labelOpaque: "Tắt trong suốt",
    btnReset: "Reset",
    btnCapture: "Chụp ảnh",
    credits: "Mô phỏng bằng p5.js — hoahocabc",
  },
  en: {
    title: "Orbital hybridization",
    langLabel: "Language",
    btnS: "Orbital s",
    btnP: "Orbital p",
    btnHybridSP: "Hybridize sp",
    btnHybridSP2: "Hybridize sp2",
    btnHybridSP3: "Hybridize sp3",
    btnOverlay: "Overlay mode",
    btnPoints: "Point mode",
    labelSplit: "Split/Join orbitals",
    labelAxes: "Show orbital axes",
    labelOpaque: "Disable transparency",
    btnReset: "Reset",
    btnCapture: "Capture",
    credits: "Simulation with p5.js — hoahocabc",
  }
};

let lang = 'vi';

function setup() {
  adjustSidebarWidth();
  setAttributes('antialias', true);
  setAttributes('preserveDrawingBuffer', true);
  setAttributes('alpha', true); // allow transparent background when capturing

  const w = window.innerWidth - sidebarWidth;
  const h = window.innerHeight;
  canvas = createCanvas(w, h, WEBGL);
  canvas.parent('canvasContainer');

  perspective(FOV, w / h, CAMERA_NEAR, CAMERA_FAR);

  setupUI();
}

function setupUI(){
  const langSelect = select('#langSelect');
  btnSEl = select('#btnS');
  btnPEl = select('#btnP');
  btnHybridSPEl = select('#btnHybridSP');
  btnHybridSP2El = select('#btnHybridSP2');
  btnHybridSP3El = select('#btnHybridSP3');
  btnCaptureEl = select('#btnCapture');
  btnOverlayEl = select('#btnOverlay');
  btnPointsEl = select('#btnPoints');
  const toggleSplitEl = select('#toggleSplit');
  const toggleAxesEl = select('#toggleAxes');
  const toggleOpaqueEl = select('#toggleOpaque');
  const btnReset = select('#btnReset');

  langSelect.changed(()=> {
    lang = langSelect.value();
    updateLanguage();
    adjustSidebarWidth();
  });

  btnSEl.mousePressed(()=> addS());
  btnPEl.mousePressed(()=> addP());
  if (btnHybridSPEl)  btnHybridSPEl.mousePressed(()=> startHybridizationMode(1));
  if (btnHybridSP2El) btnHybridSP2El.mousePressed(()=> startHybridizationMode(2));
  if (btnHybridSP3El) btnHybridSP3El.mousePressed(()=> startHybridizationMode(3));

  if (btnOverlayEl) btnOverlayEl.mousePressed(()=> setRenderMode('overlay'));
  if (btnPointsEl) btnPointsEl.mousePressed(()=> setRenderMode('points'));

  if (btnCaptureEl) btnCaptureEl.mousePressed(()=> captureImage4KTransparent());
  if (btnReset) btnReset.mousePressed(()=> resetAll());

  toggleSplitEl.changed(()=> {
    splitState = toggleSplitEl.elt.checked;
    splitAnimating = true;
    splitStart = millis();
    splitDuration = splitState ? 1500 : 3800;
    preparePOrbitalsTargetsForSplit(splitState);
    rotAnimating = true;
    rotStart = millis();
  });

  toggleAxesEl.changed(()=> { showAxes = toggleAxesEl.elt.checked; });
  if (toggleOpaqueEl) toggleOpaqueEl.changed(()=> { disableTransparency = toggleOpaqueEl.elt.checked; });

  updateLanguage();
  updateCounts();
  updateButtonsState();
  updateModeButtonsState();
}

function setRenderMode(mode){
  if (renderMode === mode) return;
  renderMode = mode;
  electronsDirty = true;
  updateModeButtonsState();
}

function updateModeButtonsState(){
  if (!btnOverlayEl || !btnPointsEl) return;
  if (renderMode === 'overlay'){
    btnOverlayEl.addClass('active');
    btnPointsEl.removeClass('active');
  } else {
    btnPointsEl.addClass('active');
    btnOverlayEl.removeClass('active');
  }
}

function preparePOrbitalsTargetsForSplit(splitOn){
  const lobeRadius = 40 * SIZE_SCALE;
  const gap = 20 * SIZE_SCALE; 
  const spacing = (lobeRadius * 2) + gap;
  const totalCount = (hybridList ? hybridList.length : 0) + pOrbitals.length;
  const commonUp = createVector(0, 1, 0);
  const lineDir = createVector(1, 0, 0);

  if (splitOn) {
    for (let i = 0; i < pOrbitals.length; i++){
      const po = pOrbitals[i];
      const globalIndex = (hybridList ? hybridList.length : 0) + i;
      const offset = globalIndex - (totalCount - 1) / 2.0;
      const splitPos = p5.Vector.mult(lineDir, offset * spacing);
      const splitAxis = commonUp.copy();
      if (!po.centerPos) po.centerPos = po.origPos ? po.origPos.copy() : createVector(0,0,0);
      if (!po.centerAxis) po.centerAxis = po.origAxis ? po.origAxis.copy() : createVector(1,0,0);
      po.splitPos = splitPos.copy();
      po.splitAxis = splitAxis.copy();
      po.origPos = po.centerPos.copy();
      po.targetPos = po.splitPos.copy();
      po.origAxis = po.centerAxis.copy();
      po.targetAxis = po.splitAxis.copy();
    }
  } else {
    for (let i = 0; i < pOrbitals.length; i++){
      const po = pOrbitals[i];
      if (!po.centerPos) po.centerPos = po.origPos ? po.origPos.copy() : createVector(0,0,0);
      if (!po.centerAxis) po.centerAxis = po.origAxis ? po.origAxis.copy() : createVector(1,0,0);
      if (!po.splitPos) {
        const globalIndex = (hybridList ? hybridList.length : 0) + i;
        const offset = globalIndex - (totalCount - 1) / 2.0;
        po.splitPos = p5.Vector.mult(lineDir, offset * spacing);
        po.splitAxis = commonUp.copy();
      }
      po.origPos = po.splitPos.copy();
      po.targetPos = po.centerPos.copy();
      po.origAxis = po.splitAxis.copy();
      po.targetAxis = po.centerAxis.copy();
    }
  }
}

function updateButtonsState(){
  if (!btnSEl || !btnPEl) return;

  if (hybridized) btnSEl.attribute('disabled', true); else btnSEl.removeAttribute('disabled');

  if (!hybridized) {
    const hasS = sCount === 1;
    const pNum = pCount;
    const enableSP  = hasS && pNum >= 1;
    const enableSP2 = hasS && pNum >= 2;
    const enableSP3 = hasS && pNum >= 3;
    setBtnEnabled(btnHybridSPEl,  enableSP);
    setBtnEnabled(btnHybridSP2El, enableSP2);
    setBtnEnabled(btnHybridSP3El, enableSP3);
  } else {
    setBtnEnabled(btnHybridSPEl, false);
    setBtnEnabled(btnHybridSP2El, false);
    setBtnEnabled(btnHybridSP3El, false);
  }

  if (btnCaptureEl) btnCaptureEl.removeAttribute('disabled');

  let disableP = false;
  if (!hybridized) {
    disableP = (pCount >= maxP);
  } else {
    const totalUsed = pHybridizedCount + pOrbitals.length;
    const remaining = maxP - totalUsed;
    disableP = remaining <= 0;
  }
  if (disableP) btnPEl.attribute('disabled', true); else btnPEl.removeAttribute('disabled');
}

function setBtnEnabled(btn, enabled){
  if (!btn) return;
  if (enabled) btn.removeAttribute('disabled');
  else btn.attribute('disabled', true);
}

function updateLanguage(){
  const s = STRINGS[lang];
  select('#title').html(s.title);
  select('#langLabel').html(s.langLabel);
  select('#btnS').html(s.btnS);
  select('#btnP').html(s.btnP);
  if (select('#btnHybridSP'))  select('#btnHybridSP').html(s.btnHybridSP);
  if (select('#btnHybridSP2')) select('#btnHybridSP2').html(s.btnHybridSP2);
  if (select('#btnHybridSP3')) select('#btnHybridSP3').html(s.btnHybridSP3);
  if (select('#btnOverlay')) select('#btnOverlay').html(s.btnOverlay);
  if (select('#btnPoints')) select('#btnPoints').html(s.btnPoints);
  select('#labelSplit').html(s.labelSplit);
  select('#labelAxes').html(s.labelAxes);
  select('#labelOpaque').html(s.labelOpaque);
  select('#btnReset').html(s.btnReset);
  if (select('#btnCapture')) select('#btnCapture').html(s.btnCapture);
  select('#credits').html(s.credits);
  adjustSidebarWidth();
}

function windowResized(){ adjustSidebarWidth(); }

function adjustSidebarWidth(){
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const contentWidth = sb.scrollWidth + 24;
  const minW = window.innerWidth <= 800 ? 180 : 220;
  const maxW = 320;
  const final = Math.min(Math.max(contentWidth, minW), maxW);
  document.documentElement.style.setProperty('--sidebar-width', final + 'px');
  sidebarWidth = final;
  if (canvas) {
    const w = window.innerWidth - sidebarWidth;
    const h = window.innerHeight;
    resizeCanvas(w, h);
    perspective(FOV, w / h, CAMERA_NEAR, CAMERA_FAR);
  }
}

function addS(){
  if (hybridized) return;
  if (sCount >= maxS) return;
  sCount = 1;
  electronsDirty = true;
  updateCounts();
}

function addP(){
  if (!hybridized) {
    if (pCount >= maxP) return;
    let axisOptions = [createVector(1,0,0), createVector(0,1,0), createVector(0,0,1)];
    const axis = axisOptions[pCount].copy().normalize();
    pOrbitals.push({
      centerAxis: axis.copy(),
      centerPos: createVector(0,0,0),
      splitAxis: axis.copy(),
      splitPos: createVector(0,0,0),
      origAxis: axis.copy(),
      targetAxis: axis.copy(),
      origPos: createVector(0,0,0),
      targetPos: createVector(0,0,0),
      electrons: []
    });
    pCount++;
    electronsDirty = true;
    updateCounts();
    return;
  }

  const totalUsed = pHybridizedCount + pOrbitals.length;
  const remainingSlots = maxP - totalUsed;
  if (remainingSlots <= 0) return;

  let masterAxis = (hybridList && hybridList.length > 0) ? hybridList[0].baseDir.copy().normalize() : createVector(1,0,0);
  let ref = abs(masterAxis.dot(createVector(0,1,0))) < 0.9 ? createVector(0,1,0) : createVector(1,0,0);
  let u = masterAxis.cross(ref).normalize();
  if (u.mag() < 1e-4) { ref = createVector(1,0,0); u = masterAxis.cross(ref).normalize(); if (u.mag() < 1e-4) u = createVector(0,0,1); }
  let v = masterAxis.cross(u).normalize();

  let axis;
  if (pHybridizedCount === 1) {
    if (pOrbitals.length === 0) {
      axis = u.copy().normalize();
    } else if (pOrbitals.length === 1) {
      axis = v.copy().normalize();
    } else {
      const angle = TWO_PI * (pOrbitals.length / Math.max(1, remainingSlots));
      axis = p5.Vector.add(p5.Vector.mult(u, Math.cos(angle)), p5.Vector.mult(v, Math.sin(angle))).normalize();
    }
  } else {
    if (remainingSlots === 2) {
      axis = (pOrbitals.length === 0) ? u.copy().normalize() : v.copy().normalize();
    } else {
      const angle = TWO_PI * (pOrbitals.length / Math.max(1, remainingSlots));
      axis = p5.Vector.add(p5.Vector.mult(u, Math.cos(angle)), p5.Vector.mult(v, Math.sin(angle))).normalize();
    }
  }

  pOrbitals.push({
    centerAxis: axis.copy(),
    centerPos: createVector(0,0,0),
    splitAxis: axis.copy(),
    splitPos: createVector(0,0,0),
    origAxis: axis.copy(),
    targetAxis: axis.copy(),
    origPos: createVector(0,0,0),
    targetPos: createVector(0,0,0),
    electrons: []
  });
  electronsDirty = true;
  updateCounts();
  if (splitState) preparePOrbitalsTargetsForSplit(true);
}

function startHybridizationMode(targetP){
  if (kneading) return;
  if (hybridized) return;
  if (sCount !== 1) return;
  if (pCount <= 0) return;
  const useP = Math.min(targetP, pCount);
  if (useP <= 0) return;

  kneadTargetP = useP;
  kneadMixTotal = 1 + useP;
  kneading = true;
  kneadStart = millis();

  if (renderMode === 'points') {
    ensureElectronClouds();
    initMixParticlesFromElectrons(kneadMixTotal);
  } else {
    initMixParticles(kneadMixTotal);
  }
}

function resetAll(){
  sCount = 0;
  pCount = 0;
  pHybridizedCount = 0;
  pAddedAfterHybrid = 0;
  pOrbitals = [];
  hybridList = [];
  kneading = false;
  splitState = false;
  splitAnimating = false;
  rotAnimating = false;
  const ts = select('#toggleSplit'); if (ts) ts.elt.checked = false;
  showAxes = false;
  const ta = select('#toggleAxes'); if (ta) ta.elt.checked = false;
  disableTransparency = false;
  const to = select('#toggleOpaque'); if (to) to.elt.checked = false;
  rotX = -0.4; rotY = 0.6; camDist = 500;
  hybridized = false;
  mixParticles = [];
  mixInitializedFor = 0;
  kneadTargetP = 0;
  kneadMixTotal = 0;
  electronsDirty = true;
  sElectrons = [];
  updateCounts();
  updateButtonsState();
}

function updateCounts(){
  const displayP = hybridized ? (pHybridizedCount + pOrbitals.length) : pCount;
  select('#countS').html(sCount);
  select('#countP').html(displayP);
  select('#countH').html(hybridList.length);
  updateButtonsState();
}

function cameraBaseZ() { return (height / 2.0) / Math.tan(FOV / 2.0); }

function clampCamDist(){
  const minCamDist = CAMERA_NEAR - cameraBaseZ() + 0.5;
  const maxCamDist = 5000;
  camDist = constrain(camDist, minCamDist, maxCamDist);
}

function draw(){
  clampCamDist();

  if (captureMode) clear(); else background(12);

  perspective(FOV, width / height, CAMERA_NEAR, CAMERA_FAR);

  const camRadius = cameraBaseZ() + camDist;
  const cx = camRadius * Math.cos(rotX) * Math.sin(rotY);
  const cy = camRadius * Math.sin(rotX);
  const cz = camRadius * Math.cos(rotX) * Math.cos(rotY);
  camPos = createVector(cx, cy, cz);
  const upY = (Math.cos(rotX) >= 0) ? 1 : -1;
  camera(cx, cy, cz, 0, 0, 0, 0, upY, 0);

  applyLighting();

  const hybridDisplay = computeHybridDisplayState();

  if (kneading) {
    const t = millis() - kneadStart;
    const prog = constrain(t / kneadDuration, 0, 1);

    push();
    rotateY(0.25 * Math.sin(prog * Math.PI * 2));
    scale(1 + 0.02 * Math.sin(prog * Math.PI * 3));
    beginTransparent();
    if (renderMode === 'points') drawKneadBlobPoints(prog);
    else drawKneadBlobOverlay(prog);
    endTransparent();
    pop();

    if (prog >= 1) {
      createHybridsFromCounts(kneadTargetP);
      kneading = false;
      sCount = 0;
      mixParticles = [];
      mixInitializedFor = 0;
      kneadTargetP = 0;
      kneadMixTotal = 0;
      electronsDirty = true;
      updateCounts();
    }
  } else {
    beginTransparent();
    if (renderMode === 'overlay') {
      if (hybridized) {
        drawAllSP(false, 0, true);
        drawHybrids(hybridDisplay);
        drawPOrbitals();
      } else {
        drawAllSP(false, 0, false);
        drawHybrids(hybridDisplay);
      }
    } else {
      ensureElectronClouds();
      stepElectronMotion(hybridDisplay);
      drawElectronClouds(hybridDisplay);
    }
    endTransparent();
  }

  if (showAxes && !kneading) drawAxesOverlay(hybridDisplay);
}

function beginTransparent(){
  const gl = drawingContext;
  if (!disableTransparency) {
    if (gl) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
    }
  } else {
    if (gl) {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
  }
}
function endTransparent(){
  const gl = drawingContext;
  if (gl) gl.depthMask(true);
}

function A(a){ return disableTransparency ? 255 : a; }
function getShininess(){ return disableTransparency ? 2 : 10; }

function applyLighting(){
  const s = 1.0; // keep lighting identical in capture vs live view

  const camDir = camPos ? camPos.copy().normalize().mult(-1) : createVector(0, 0, -1);
  const warmKeyDir = camDir.copy().mult(0.6);
  const coolRimDir = camDir.copy().mult(1.0);

  const keyMul = disableTransparency ? 0.26 : 0.8;
  const rimMul = disableTransparency ? 0.20 : 0.6;

  const captureToneMul = captureMode ? 1.0 : 1.0;
  const sTone = s * captureToneMul;

  if (disableTransparency) {
    ambientLight(95 * sTone, 95 * sTone, 95 * sTone);
    directionalLight(62 * sTone, 62 * sTone, 62 * sTone, -0.6, -0.4, -1);
    pointLight(54 * sTone, 58 * sTone, 62 * sTone, -300, -200, 300);
    pointLight(46 * sTone, 46 * sTone, 42 * sTone, 250, 200, -200);
    pointLight(30 * sTone, 36 * sTone, 44 * sTone, 0, 300, -500);
    const cornerOffset = 80;
    const cornerZ = 300;
    pointLight(60 * sTone, 68 * sTone, 72 * sTone, -width/2 + cornerOffset, -height/2 + cornerOffset, cornerZ);
  } else {
    ambientLight(90 * sTone, 90 * sTone, 95 * sTone);
    directionalLight(150 * sTone, 150 * sTone, 140 * sTone, -0.6, -0.4, -1);
    pointLight(120 * sTone, 130 * sTone, 160 * sTone, -300, -200, 300);
    pointLight(115 * sTone, 105 * sTone, 90 * sTone, 250, 200, -200);
    pointLight(70 * sTone, 86 * sTone, 108 * sTone, 0, 300, -500);
    const cornerOffset = 80;
    const cornerZ = 300;
    pointLight(150 * sTone, 168 * sTone, 186 * sTone, -width/2 + cornerOffset, -height/2 + cornerOffset, cornerZ);
  }

  directionalLight(180 * keyMul * sTone, 140 * keyMul * sTone, 120 * keyMul * sTone, warmKeyDir.x, warmKeyDir.y, warmKeyDir.z);
  directionalLight(90 * rimMul * sTone, 130 * rimMul * sTone, 200 * rimMul * sTone, coolRimDir.x, coolRimDir.y, coolRimDir.z);
}

function scaledRGB(r, g, b, s) {
  return [constrain(r * s, 0, 255), constrain(g * s, 0, 255), constrain(b * s, 0, 255)];
}

function drawAllSP(kneadMode = false, prog = 0, skipP = false){
  const matScale = captureMode ? 1.0 : 1.0;

  if (sCount > 0) {
    push();
    noStroke();
    const sRadius = 60 * SIZE_SCALE;
    const [sr, sg, sb] = scaledRGB(100, 180, 255, matScale);
    specularMaterial(sr * 0.9, sg * 0.9, sb * 0.9, A(220));
    fill(sr, sg, sb, A(120));
    ambientMaterial(sr, sg, sb, A(120));
    shininess(getShininess() + 6);
    sphere(sRadius, 64, 64);
    pop();
  }

  if (skipP) return;

  for (let i = 0; i < pOrbitals.length; i++){
    const displayAxis = getDisplayPAxis(i);
    const displayPos = getDisplayPPos(i);
    push();
    translate(displayPos.x, displayPos.y, displayPos.z);
    drawPorbital(displayAxis, false, 0, i, camPos);
    pop();
  }
}

function drawPOrbitals(){
  for (let i = 0; i < pOrbitals.length; i++){
    const displayAxis = getDisplayPAxis(i);
    const displayPos = getDisplayPPos(i);
    push();
    translate(displayPos.x, displayPos.y, displayPos.z);
    drawPorbital(displayAxis, false, 0, i, camPos);
    pop();
  }
}

function computeSplitLinearForIndex(i) {
  if (!splitAnimating) return splitState ? 1 : 0;
  const elapsed = millis() - splitStart;
  if (splitState) return constrain(elapsed / splitDuration, 0, 1);
  const STAGGER_MS = 140;
  const staggerMs = STAGGER_MS * i;
  const local = constrain((elapsed - staggerMs) / splitDuration, 0, 1);
  return 1 - local;
}

function getDisplayPAxis(i){
  const po = pOrbitals[i];
  if (!po) return createVector(1,0,0);
  const centerAxis = po.centerAxis ? po.centerAxis.copy().normalize() : (po.origAxis ? po.origAxis.copy().normalize() : createVector(1,0,0));
  const splitAxis = po.splitAxis ? po.splitAxis.copy().normalize() : (po.targetAxis ? po.targetAxis.copy().normalize() : centerAxis.copy());
  let rawLinear = computeSplitLinearForIndex(i);
  const t = easeInOutCubic(rawLinear);
  return vectorSlerp(centerAxis, splitAxis, t).normalize();
}

function getDisplayPPos(i){
  const po = pOrbitals[i];
  if (!po) return createVector(0,0,0);
  const centerPos = po.centerPos ? po.centerPos.copy() : createVector(0,0,0);
  const splitPos = po.splitPos ? po.splitPos.copy() : createVector(0,0,0);
  let rawLinear = computeSplitLinearForIndex(i);
  const t = easeInOutCubic(rawLinear);
  return p5.Vector.lerp(centerPos, splitPos, t);
}

function initMixParticles(totalOverride = null, preset = null){
  const countFactor = totalOverride ? totalOverride : max(1, sCount + pCount);
  let N = int(MIX_N_BASE * (0.8 + 0.6 * countFactor));
  mixParticles = [];
  const seed = random(1000);

  if (preset && preset.length > 0) {
    N = preset.length;
    for (let i = 0; i < preset.length; i++){
      const src = preset[i];
      let p = src.pos.copy();
      if (p.mag() > 1e-4) {
        p.setMag(random(MIX_CLUSTER_MIN, MIX_CLUSTER_MAX * 0.9));
      } else {
        p = randomPointInSphere((MIX_CLUSTER_MIN + MIX_CLUSTER_MAX) * 0.5);
      }
      const v = p.copy().mult(-0.14).add(randVel().mult(2.2));
      mixParticles.push({
        pos: p,
        vel: v,
        seed: seed + i * 0.37,
        shape: 'sphere',
        size: ELECTRON_SIZE * random(0.9, 1.2),
        affiliation: src.affiliation || 'mix',
        rotation: random(TWO_PI),
        rotSpeed: random(-0.8,0.8)
      });
    }
    mixInitializedFor = totalOverride ? totalOverride : preset.length;
    return;
  }

  for (let i = 0; i < N; i++){
    const theta = random(0, TWO_PI);
    const phi = random(0, PI);
    const r = (0.15 + 0.85 * pow(random(), 0.6)) * 60 * SIZE_SCALE;
    const x = cos(theta) * sin(phi) * r;
    const y = sin(theta) * sin(phi) * r;
    const z = cos(phi) * r * (0.7 + 0.6 * random());
    const total = totalOverride ? totalOverride : (sCount + pCount);
    const pProb = total > 0 ? Math.min(1, (totalOverride ? kneadTargetP : pCount) / total) : 0.5;
    const affiliation = random() < pProb ? 'p' : 's';
    const shape = random(MIX_SHAPES);
    const baseSize = random(3, 12) * SIZE_SCALE;
    mixParticles.push({
      pos: createVector(x,y,z),
      vel: createVector(0,0,0),
      seed: seed + i * 0.37,
      shape: shape,
      size: baseSize,
      affiliation: affiliation,
      rotation: random(TWO_PI),
      rotSpeed: random(-0.8,0.8)
    });
  }
  mixInitializedFor = totalOverride ? totalOverride : (sCount + pCount);
}

function initMixParticlesFromElectrons(totalOverride){
  const collected = collectElectronWorldPositions();
  initMixParticles(totalOverride, collected);
}

function collectElectronWorldPositions(){
  let list = [];
  if (!hybridized && sCount > 0){
    for (let e of sElectrons){
      list.push({pos: e.pos.copy(), vel: randVel(), affiliation:'s'});
    }
  }
  for (let i = 0; i < pOrbitals.length; i++){
    const po = pOrbitals[i];
    const axis = getDisplayPAxis(i);
    const pos = getDisplayPPos(i);
    if (!po.electrons) continue;
    for (let e of po.electrons){
      const world = orientPointToAxis(e.pos, axis).add(pos);
      list.push({pos: world, vel: randVel(), affiliation:'p'});
    }
  }
  return list;
}

function drawKneadBlobOverlay(prog){
  if ((mixInitializedFor !== kneadMixTotal && kneadMixTotal > 0) || mixParticles.length === 0) {
    initMixParticles(kneadMixTotal > 0 ? kneadMixTotal : null);
  }

  const tm = millis() * 0.0013;
  const mixPhase = 0.78;
  const mixT = constrain(prog / mixPhase, 0, 1);
  const morphT = constrain((prog - mixPhase) / (1 - mixPhase), 0, 1);
  const mixE = easeInOutCubic(mixT);
  const morphE = easeInOutCubic(morphT);

  const sColor = color(100, 180, 255);
  const pColor = color(255, 120, 80);

  const totalDirs = max(1, kneadMixTotal > 0 ? kneadMixTotal : (sCount + pCount));
  const dirs = symmetricDirections(totalDirs).map(v => v.copy().normalize());

  const matScale = captureMode ? 1.0 : 1.0;

  for (let i = 0; i < mixParticles.length; i++){
    let p = mixParticles[i];

    const ns = 0.9 + 0.6 * (1 - morphE);
    const nx = noise(p.seed + tm * 0.8, p.pos.y * 0.008, p.pos.z * 0.006) - 0.5;
    const ny = noise(p.seed * 1.3 + tm * 0.6, p.pos.z * 0.007, p.pos.x * 0.005) - 0.5;
    const nz = noise(p.seed * 1.7 + tm * 0.9, p.pos.x * 0.006, p.pos.y * 0.004) - 0.5;
    let flow = createVector(nx, ny, nz).mult(26.0 * ns * (1 - 0.2 * morphE));

    const press = sin(tm * 3.2 + i * 0.07) * 0.6;
    flow.add(createVector(cos(tm * 1.7 + i * 0.1) * press, sin(tm * 1.9 + i * 0.11) * press * 0.6, cos(tm * 1.2 + i * 0.09) * press * 0.5).mult(5.0 * (1 - morphE)));

    const dirTarget = dirs[i % dirs.length];
    const targetDist = 38 * SIZE_SCALE * (0.95 + 0.6 * morphE);
    const targetPos = p5.Vector.mult(dirTarget, targetDist);
    const biasStrength = morphE * (0.4 + 0.5 * noise(p.seed + i * 0.13));
    flow.add(p5.Vector.sub(targetPos, p.pos).mult(0.06 * biasStrength));

    p.vel.add(flow.mult(0.012));
    p.vel.mult(0.92 - 0.12 * morphE);
    p.pos.add(p.vel);

    const maxR = 105 * SIZE_SCALE * (1 + 0.6 * morphE);
    const dist = p.pos.mag();
    if (dist > maxR) { p.pos.mult(maxR / dist); p.vel.mult(0.6); }
    else {
      const cohesion = lerp(0.06, 0.005, morphE);
      p.pos.mult(1 - cohesion);
    }

    p.rotation += p.rotSpeed * (0.6 + 0.6 * (1 - morphE)) * 0.03;
  }

  mixParticles.sort((a,b) => {
    const da = p5.Vector.sub(a.pos, camPos).mag();
    const db = p5.Vector.sub(b.pos, camPos).mag();
    return db - da;
  });

  for (let i = 0; i < mixParticles.length; i++){
    const p = mixParticles[i];
    push();
    translate(p.pos.x, p.pos.y, p.pos.z);
    rotateY(p.rotation);
    noStroke();

    let baseCol;
    if (p.affiliation === 's') baseCol = lerpColor(sColor, pColor, 0.12 * morphE + 0.08 * noise(p.seed));
    else baseCol = lerpColor(pColor, sColor, 0.12 * morphE + 0.08 * noise(p.seed));

    const br = red(baseCol) * matScale;
    const bg = green(baseCol) * matScale;
    const bb = blue(baseCol) * matScale;

    const alpha = lerp(255, 200, morphE) * (0.9 - 0.4 * (i / mixParticles.length));
    specularMaterial(br * 0.9, bg * 0.9, bb * 0.9, A(alpha));
    ambientMaterial(br, bg, bb, A(alpha));
    fill(br, bg, bb, A(alpha));
    shininess(getShininess() + 4);

    if (p.shape === 'sphere') {
      sphere(p.size, 12, 12);
    } else if (p.shape === 'ellipsoid') {
      push();
      const sx = 1.0;
      const sy = 0.9 + 0.8 * noise(p.seed + 2.1);
      const sz = 1.8 + 1.2 * morphE * noise(p.seed + 3.7);
      scale(sx, sy, sz);
      noStroke();
      sphere(p.size * (0.9 + 0.6 * morphE), 12, 12);
      pop();
    } else {
      push();
      scale(1.0, 1.0, 0.28 + 0.18 * morphE);
      noStroke();
      sphere(p.size * (1.1 + 0.4 * noise(p.seed + 1.9)), 10, 10);
      pop();
    }
    pop();
  }
}

function drawKneadBlobPoints(prog){
  if ((mixInitializedFor !== kneadMixTotal && kneadMixTotal > 0) || mixParticles.length === 0) {
    initMixParticles(kneadMixTotal > 0 ? kneadMixTotal : null);
  }

  const tm = millis() * 0.0013;
  const mixPhase = 0.78;
  const mixT = constrain(prog / mixPhase, 0, 1);
  const morphT = constrain((prog - mixPhase) / (1 - mixPhase), 0, 1);
  const mixE = easeInOutCubic(mixT);
  const morphE = easeInOutCubic(morphT);

  const sColor = color(100, 180, 255);
  const pColor = color(255, 120, 80);

  const totalDirs = max(1, kneadMixTotal > 0 ? kneadMixTotal : (sCount + pCount));
  const dirs = symmetricDirections(totalDirs).map(v => v.copy().normalize());

  const matScale = captureMode ? 1.0 : 1.0;

  const shrinkR = lerp(MIX_CLUSTER_MAX, MIX_CLUSTER_MIN, mixE);
  const pullK = (MIX_PULL_BASE + MIX_PULL_GAIN * mixE);

  for (let i = 0; i < mixParticles.length; i++){
    let p = mixParticles[i];

    const pull = p.pos.copy().mult(-pullK);
    p.vel.add(pull);

    const ns = 0.7 + 0.5 * (1 - morphE);
    const nx = noise(p.seed + tm * 0.8, p.pos.y * 0.008, p.pos.z * 0.006) - 0.5;
    const ny = noise(p.seed * 1.3 + tm * 0.6, p.pos.z * 0.007, p.pos.x * 0.005) - 0.5;
    const nz = noise(p.seed * 1.7 + tm * 0.9, p.pos.x * 0.006, p.pos.y * 0.004) - 0.5;
    let flow = createVector(nx, ny, nz).mult(20.0 * ns * (1 - 0.2 * morphE));

    const press = sin(tm * 3.2 + i * 0.07) * 0.6;
    flow.add(createVector(cos(tm * 1.7 + i * 0.1) * press, sin(tm * 1.9 + i * 0.11) * press * 0.6, cos(tm * 1.2 + i * 0.09) * press * 0.5).mult(4.0 * (1 - morphE)));

    const dirTarget = dirs[i % dirs.length];
    const targetDist = 32 * SIZE_SCALE * (0.9 + 0.5 * morphE);
    const targetPos = p5.Vector.mult(dirTarget, targetDist);
    const biasStrength = morphE * (0.45 + 0.35 * noise(p.seed + i * 0.13));
    flow.add(p5.Vector.sub(targetPos, p.pos).mult(0.08 * biasStrength));

    if (mixE > MIX_CHAOS_PHASE) {
      const chaosFactor = (mixE - MIX_CHAOS_PHASE) / (1 - MIX_CHAOS_PHASE);
      flow.add(createVector(
        randomGaussian() * MIX_CHAOS_KICK * chaosFactor,
        randomGaussian() * MIX_CHAOS_KICK * chaosFactor,
        randomGaussian() * MIX_CHAOS_KICK * chaosFactor
      ));
    }

    p.vel.add(flow.mult(0.012));
    const maxV = 3.0;
    if (p.vel.mag() > maxV) p.vel.setMag(maxV);
    p.vel.mult(0.90 - 0.12 * morphE);
    p.pos.add(p.vel);

    const dist = p.pos.mag();
    if (dist > shrinkR) {
      p.pos.setMag(shrinkR * (0.85 + 0.15 * random()));
      p.vel.mult(0.35);
    }

    p.rotation += p.rotSpeed * (0.6 + 0.6 * (1 - morphE)) * 0.03;
  }

  mixParticles.sort((a,b) => {
    const da = p5.Vector.sub(a.pos, camPos).mag();
    const db = p5.Vector.sub(b.pos, camPos).mag();
    return db - da;
  });

  for (let i = 0; i < mixParticles.length; i++){
    const p = mixParticles[i];
    push();
    translate(p.pos.x, p.pos.y, p.pos.z);
    rotateY(p.rotation);
    noStroke();

    let baseCol;
    if (p.affiliation === 's') baseCol = lerpColor(sColor, pColor, 0.12 * morphE + 0.08 * noise(p.seed));
    else baseCol = lerpColor(pColor, sColor, 0.12 * morphE + 0.08 * noise(p.seed));

    const br = red(baseCol) * matScale;
    const bg = green(baseCol) * matScale;
    const bb = blue(baseCol) * matScale;

    const alpha = lerp(255, 200, morphE) * (0.9 - 0.4 * (i / mixParticles.length));
    specularMaterial(br * 0.9, bg * 0.9, bb * 0.9, A(alpha));
    ambientMaterial(br, bg, bb, A(alpha));
    fill(br, bg, bb, A(alpha));
    shininess(getShininess() + 4);

    sphere(ELECTRON_SIZE, 12, 12);
    pop();
  }
}

function drawKneadElectrons(prog){
  drawKneadBlobPoints(prog);
}

function drawPorbital(axisVec, kneadMode=false, prog=0, idx=0, camPosLocal=null){
  push();
  alignVectorToAxis(axisVec);

  const lobeRadiusBase = 40 * SIZE_SCALE;  
  const scaleZ = 1.4;
  const zOffset = lobeRadiusBase * scaleZ;

  let camVec = camPosLocal ? camPosLocal.copy().normalize() : createVector(0,0,1);
  let axisNorm = axisVec.copy().normalize();
  let dot = axisNorm.dot(camVec);
  const drawOrder = (dot > 0) ? ['neg','pos'] : ['pos','neg'];

  for (let k = 0; k < drawOrder.length; k++){
    if (drawOrder[k] === 'pos') {
      push();
      translate(0, 0, zOffset);
      scale(0.8, 0.8, scaleZ);
      noStroke();
      specularMaterial(255 * 0.85, 100 * 0.85, 80 * 0.85, A(200));
      fill(255, 100, 80, A(120));
      ambientMaterial(255, 100, 80, A(120));
      shininess(getShininess() + 6);
      sphere(lobeRadiusBase, 64, 64);
      pop();
    } else {
      push();
      translate(0, 0, -zOffset);
      scale(0.8, 0.8, scaleZ);
      noStroke();
      specularMaterial(255 * 0.85, 100 * 0.85, 80 * 0.85, A(200));
      fill(255, 100, 80, A(120));
      ambientMaterial(255, 100, 80, A(120));
      shininess(getShininess() + 6);
      sphere(lobeRadiusBase, 64, 64);
      pop();
    }
  }

  pop();
}

function alignVectorToAxis(vec){
  let v = vec.copy().normalize();
  let z = createVector(0,0,1);
  if (v.dist(z) < 0.001) return;
  if (v.dist(p5.Vector.mult(z, -1)) < 0.001) { rotateX(Math.PI); return; }
  let axis = z.cross(v);
  let angle = Math.acos(constrain(z.dot(v), -1, 1));
  rotate(angle, axis);
}

function createHybridsFromCounts(selectedP){
  const useP = Math.min(selectedP, pCount);
  const total = 1 + useP;
  if (total <= 1) return;

  pOrbitals.splice(0, useP);
  pCount = pOrbitals.length;

  pHybridizedCount = useP;

  let dirs = symmetricDirections(total);
  hybridList = [];
  for (let i = 0; i < dirs.length; i++){
    const d = dirs[i].copy().normalize();
    hybridList.push({
      id: i,
      baseDir: d,
      dir: d.copy().normalize(),
      bigRadius: 40 * SIZE_SCALE,
      bigLength: 120 * SIZE_SCALE,
      smallRadius: 15 * SIZE_SCALE, 
      smallLength: 40 * SIZE_SCALE,
      electrons: []
    });
  }

  hybridized = true;
  electronsDirty = true;
  updateButtonsState();
  updateCounts();
}

function symmetricDirections(n){
  let arr = [];
  if (n <= 1) { arr.push(createVector(1,0,0)); return arr; }
  if (n === 2) { arr.push(createVector(1,0,0)); arr.push(createVector(-1,0,0)); return arr; }
  if (n === 3) { for (let i=0;i<3;i++){ let a = TWO_PI * i / 3; arr.push(createVector(cos(a), sin(a), 0)); } return arr; }
  if (n === 4) { arr.push(createVector(1,1,1)); arr.push(createVector(1,-1,-1)); arr.push(createVector(-1,1,-1)); arr.push(createVector(-1,-1,1)); return arr.map(v=>v.normalize()); }
  if (n === 5) { arr.push(createVector(0,0,1)); arr.push(createVector(0,0,-1)); for (let i=0;i<3;i++){ let a = TWO_PI * i / 3; arr.push(createVector(cos(a), sin(a), 0)); } return arr; }
  if (n === 6) { arr.push(createVector(1,0,0)); arr.push(createVector(-1,0,0)); arr.push(createVector(0,1,0)); arr.push(createVector(0,-1,0)); arr.push(createVector(0,0,1)); arr.push(createVector(0,0,-1)); return arr; }
  return arr;
}

function easeInOutCubic(t){ return -(Math.cos(Math.PI * t) - 1) / 2; }

function vectorSlerp(v0, v1, t){
  let a = v0.copy().normalize();
  let b = v1.copy().normalize();
  let dot = constrain(a.dot(b), -1, 1);
  if (abs(dot) > 0.9995) return p5.Vector.lerp(a, b, t).normalize();
  let theta = Math.acos(dot);
  let sinTheta = Math.sin(theta);
  if (Math.abs(sinTheta) < 1e-6) return p5.Vector.lerp(a, b, t).normalize();
  let w1 = Math.sin((1 - t) * theta) / sinTheta;
  let w2 = Math.sin(t * theta) / sinTheta;
  return p5.Vector.add(p5.Vector.mult(a, w1), p5.Vector.mult(b, w2));
}

function computeHybridDisplayState(){
  let result = { items: [], prog: 0, rotT: 0 };
  const n = hybridList.length;
  if (n === 0) return result;

  let rawProg = splitState ? 1 : 0;
  if (splitAnimating) {
    rawProg = constrain((millis() - splitStart) / splitDuration, 0, 1);
    if (!splitState) rawProg = 1 - rawProg;
    if (rawProg >= 1 || rawProg <= 0) splitAnimating = false;
  }
  result.prog = easeInOutCubic(rawProg);

  if (n === 2 && !splitState && rotAnimating) { 
     const elapsed = millis() - rotStart;
     let rotRaw = constrain(elapsed / ROTATION_DURATION_MS, 0, 1);
     result.rotT = easeInOutCubic(1 - rotRaw);
     if (rotRaw >= 1) rotAnimating = false;
  }

  const lobeRadius = 40 * SIZE_SCALE;
  const gap = 20 * SIZE_SCALE; 
  const spacing = (lobeRadius * 2) + gap;
  const totalCount = hybridList.length + pOrbitals.length;

  const splitDir = createVector(0, 1, 0);
  const lineDir = createVector(1, 0, 0);

  for (let i = 0; i < n; i++){
    const h = hybridList[i];
    let originPos = createVector(0,0,0);
    let baseDir = h.baseDir.copy().normalize();
    let originDir = baseDir;

    if (n === 2 && result.rotT > 0) {
        let masterAxis = hybridList[0].baseDir.copy().normalize();
        let dot = constrain(baseDir.dot(masterAxis), -1, 1);
        let angleBetween = Math.acos(dot);
        let axis = baseDir.cross(masterAxis);
        if (axis.mag() < 1e-4) {
             let alt = abs(baseDir.x) < 0.9 ? createVector(1,0,0) : createVector(0,1,0);
             axis = baseDir.cross(alt).normalize();
        }
        originDir = rotateVectorAroundAxis(baseDir, axis, angleBetween * result.rotT).normalize();
    }

    const offset = i - (totalCount - 1) / 2.0;
    const targetPos = p5.Vector.mult(lineDir, offset * spacing);
    const targetDir = splitDir.copy();

    const displayPos = p5.Vector.lerp(originPos, targetPos, result.prog);
    const displayDir = vectorSlerp(originDir, targetDir, result.prog).normalize();

    const dist = camPos ? p5.Vector.sub(displayPos, camPos).mag() : 0;

    result.items.push({ worldPos: displayPos, displayDir: displayDir, dist: dist, hybrid: h });
  }

  return result;
}

function drawHybrids(hybridDisplay){
  if (!hybridDisplay || hybridDisplay.items.length === 0) return;

  let drawItems = hybridDisplay.items.slice().sort((a,b)=> b.dist - a.dist);

  const matMul = disableTransparency ? 0.65 : 1.0;
  const alphaMul = disableTransparency ? 0.72 : 1.0;

  for (let item of drawItems){
    const h = item.hybrid;
    push();
    translate(item.worldPos.x, item.worldPos.y, item.worldPos.z);
    alignVectorToAxis(item.displayDir);

    let camVec = camPos ? camPos.copy().normalize() : createVector(0,0,1);
    let axisNorm = item.displayDir.copy().normalize();
    let dot = axisNorm.dot(camVec);
    const drawOrder = (dot > 0) ? ['neg','pos'] : ['pos','neg'];

    const bigScaleZ = 1.5;
    const innerBigTranslate = h.bigRadius * bigScaleZ;
    const smallScaleZ = 1.2;
    const innerSmallTranslate = h.smallRadius * smallScaleZ;

    for (let k = 0; k < drawOrder.length; k++){
      if (drawOrder[k] === 'pos') {
        push();
        translate(0, 0, innerBigTranslate); 
        noStroke();
        specularMaterial(100 * 0.9 * matMul, 255 * 0.9 * matMul, 150 * 0.9 * matMul, A(210 * alphaMul));
        fill(100 * matMul, 255 * matMul, 150 * matMul, A(130 * alphaMul)); 
        ambientMaterial(100 * matMul, 255 * matMul, 150 * matMul, A(130 * alphaMul));
        shininess(getShininess() + 6);
        scale(1, 1, bigScaleZ); 
        sphere(h.bigRadius, 64, 64);
        pop();
      } else {
        push();
        translate(0, 0, -innerSmallTranslate);
        noStroke();
        specularMaterial(100 * 0.9 * matMul, 255 * 0.9 * matMul, 150 * 0.9 * matMul, A(200 * alphaMul));
        fill(100 * matMul, 255 * matMul, 150 * matMul, A(120 * alphaMul));
        ambientMaterial(100 * matMul, 255 * matMul, 150 * matMul, A(120 * alphaMul));
        shininess(getShininess() + 6);
        scale(0.8, 0.8, smallScaleZ);
        sphere(h.smallRadius, 48, 48);
        pop();
      }
    }
    pop();
  }
}

function rotateVectorAroundAxis(v, k, theta) {
  let kk = k.copy().normalize();
  let vcos = p5.Vector.mult(v, Math.cos(theta));
  let kCrossV = kk.cross(v).mult(Math.sin(theta));
  let kDotV = kk.dot(v);
  let kPart = kk.mult(kDotV * (1 - Math.cos(theta)));
  return p5.Vector.add(p5.Vector.add(vcos, kCrossV), kPart);
}

function drawAxesOverlay(hybridDisplay){
  const gl = drawingContext;
  if (gl) { gl.enable(gl.DEPTH_TEST); gl.depthMask(true); }

  push();
  stroke(230, 230, 230, A(150));
  strokeWeight(1.5);

  const P_ORBITAL_EXTRA_PX = 20;
  const P_CAP_EXTRA_WORLD = 60;

  for (let i = 0; i < pOrbitals.length; i++){
    push();
    const axisDir = getDisplayPAxis(i).copy().normalize();
    const posCenter = getDisplayPPos(i);

    translate(posCenter.x, posCenter.y, posCenter.z);

    const lobeRadiusBase = 40 * SIZE_SCALE;
    const scaleZ = 1.4;
    const zOffset = lobeRadiusBase * scaleZ;
    const surfaceOffset = zOffset + lobeRadiusBase * scaleZ;

    const posEndpoint = p5.Vector.add(posCenter, axisDir.copy().mult(surfaceOffset));
    const distPos = p5.Vector.sub(camPos, posEndpoint).mag();
    const worldPerPixelPos = (2 * distPos * Math.tan(FOV / 2.0)) / height;
    const extraLen = min(P_ORBITAL_EXTRA_PX * worldPerPixelPos, P_CAP_EXTRA_WORLD);

    alignVectorToAxis(axisDir);
    line(0, 0, -(surfaceOffset + extraLen), 0, 0, (surfaceOffset + extraLen));
    pop();
  }

  const HYBRID_EXTRA_PX = 16;
  const HYBRID_CAP_EXTRA = 40;

  if (hybridList.length > 0 && hybridDisplay) {
    for (let i = 0; i < hybridDisplay.items.length; i++){
      const item = hybridDisplay.items[i];
      const h = item.hybrid;
      const displayPos = item.worldPos;
      const displayDir = item.displayDir;

      const bigScaleZ = 1.5;
      const smallScaleZ = 1.2;
      const innerBigTranslate = h.bigRadius * bigScaleZ;
      const innerSmallTranslate = h.smallRadius * smallScaleZ;
      const bigSurface = innerBigTranslate + h.bigRadius * bigScaleZ;
      const smallSurface = innerSmallTranslate + h.smallRadius * smallScaleZ;

      const posEndWorld = p5.Vector.add(displayPos, p5.Vector.mult(displayDir, bigSurface));
      const distCam = p5.Vector.sub(camPos, posEndWorld).mag();
      const worldPerPx = (2 * distCam * Math.tan(FOV / 2.0)) / height;
      const extraLen = min(HYBRID_EXTRA_PX * worldPerPx, HYBRID_CAP_EXTRA);

      push();
      translate(displayPos.x, displayPos.y, displayPos.z);
      alignVectorToAxis(displayDir);

      const negLimit = smallSurface + extraLen;
      const posLimit = bigSurface + extraLen;
      line(0, 0, -negLimit, 0, 0, posLimit);
      pop();
    }
  }

  pop();
  if (gl) gl.enable(gl.DEPTH_TEST);
}

// Interaction
function mousePressed(){
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height){
    isDragging = true;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
}
function mouseReleased(){ isDragging = false; }
function mouseDragged(){
  if (!isDragging) return;
  let dx = (mouseX - lastMouseX);
  let dy = (mouseY - lastMouseY);
  // Invert to match intuitive drag direction
  rotY -= dx * 0.005;
  rotX -= dy * 0.005;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}
function mouseWheel(event){
  if (event && typeof event.clientX !== 'undefined' && event.clientX < sidebarWidth) return true;
  const speed = (event && event.ctrlKey) ? 1.8 : 0.6;
  camDist += event.delta * speed;
  clampCamDist();
  return false;
}

// Capture with 4K, transparent background, and preserved zoom/framing
function captureImage4KTransparent(){
  if (captureMode) return;
  captureMode = true; // makes draw() use clear() for transparent background

  const targetW = 3840;
  const targetH = 2160;

  const prevW = width;
  const prevH = height;
  const prevPD = pixelDensity();
  const prevBaseZ = cameraBaseZ();
  const prevRadius = prevBaseZ + camDist;

  noLoop();
  pixelDensity(1);
  resizeCanvas(targetW, targetH);
  perspective(FOV, targetW / targetH, CAMERA_NEAR, CAMERA_FAR);

  // adjust camDist to preserve the same radius/framing after resize
  const newBaseZ = cameraBaseZ();
  camDist = prevRadius - newBaseZ;
  clampCamDist();

  redraw(); // render one frame at 4K with transparency

  const now = new Date();
  const pad = n => (n < 10 ? '0' + n : n);
  const fname = `orbital_capture_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  setTimeout(()=> {
    saveCanvas(fname, 'png');

    // Restore previous viewport, pixel density, and framing
    pixelDensity(prevPD);
    resizeCanvas(prevW, prevH);
    perspective(FOV, prevW / prevH, CAMERA_NEAR, CAMERA_FAR);
    const restoreBaseZ = cameraBaseZ();
    camDist = prevRadius - restoreBaseZ;
    clampCamDist();

    captureMode = false;
    loop();
  }, 40); // slight delay to ensure the 4K frame is ready
}

// -------- Point-mode helpers & motion --------
function ensureElectronClouds(){
  if (renderMode !== 'points') return;
  if (!electronsDirty) return;
  regenElectronClouds();
  electronsDirty = false;
}

function regenElectronClouds(){
  sElectrons = (sCount > 0 && !hybridized) ? generateSElectrons(ELECTRONS_S) : [];
  for (let i = 0; i < pOrbitals.length; i++){
    pOrbitals[i].electrons = generatePElectrons(ELECTRONS_P);
  }
  for (let i = 0; i < hybridList.length; i++){
    hybridList[i].electrons = generateHybridElectrons(ELECTRONS_HYBRID, hybridList[i]);
  }
}

function randVel(){
  return createVector(random(-1,1), random(-1,1), random(-1,1)).normalize().mult(ELECTRON_SPEED * random(0.25, 1));
}

function randomPointInSphere(radius){
  let u = random();
  let cost = random(-1,1);
  let sint = Math.sqrt(1 - cost*cost);
  let phi = random(0, TWO_PI);
  let r = radius * Math.cbrt(u);
  return createVector(
    r * sint * Math.cos(phi),
    r * sint * Math.sin(phi),
    r * cost
  );
}

function orientPointToAxis(local, axis){
  let v = axis.copy().normalize();
  let z = createVector(0,0,1);
  if (v.dist(z) < 1e-5) return local.copy();
  if (v.dist(p5.Vector.mult(z, -1)) < 1e-5) return createVector(local.x, -local.y, -local.z);
  let rotAxis = z.cross(v);
  let angle = Math.acos(constrain(z.dot(v), -1, 1));
  return rotateVectorAroundAxis(local, rotAxis, angle);
}

function generateSElectrons(count){
  const r = 60 * SIZE_SCALE;
  const minCore = CORE_MIN_DIST;
  let arr = [];
  let tries = 0;
  while (arr.length < count && tries < count * 40){
    tries++;
    const inside = Math.random() < 0.9;
    const base = randomPointInSphere(r * (inside ? 1.0 : (1 + ELECTRON_NEAR_MARGIN)));
    if (base.mag() < minCore) continue;
    if (enforceSeparation(base, arr)) {
      arr.push({pos: base, vel: randVel()});
    }
  }
  return arr;
}

function generatePElectrons(count){
  const lobeRadius = 40 * SIZE_SCALE;
  const scaleZ = 1.4;
  const zOffset = lobeRadius * scaleZ;
  let arr = [];
  let tries = 0;
  while (arr.length < count && tries < count * 50){
    tries++;
    const inside = Math.random() < 0.9;
    const sign = random() < 0.5 ? 1 : -1;
    let p = randomPointInSphere(lobeRadius);
    p.z *= scaleZ;
    p.z += sign * zOffset;
    if (!inside) p.mult(1.0 + ELECTRON_NEAR_MARGIN);
    if (p.mag() < CORE_MIN_DIST) continue;
    if (Math.abs(p.z) < NODE_BAND_P) continue; // avoid near nodal plane (narrow)
    if (enforceSeparation(p, arr)) {
      arr.push({pos: p, vel: randVel()});
    }
  }
  return arr;
}

function generateHybridElectrons(count, h){
  const bigScaleZ = 1.5;
  const smallScaleZ = 1.2;
  const bigOffset = h.bigRadius * bigScaleZ;
  const smallOffset = h.smallRadius * smallScaleZ;
  let arr = [];
  let tries = 0;
  while (arr.length < count && tries < count * 60){
    tries++;
    const useBig = random() < 0.75;
    const inside = Math.random() < 0.9;
    let p;
    if (useBig){
      p = randomPointInSphere(h.bigRadius);
      p.z *= bigScaleZ;
      p.z += bigOffset;
    } else {
      p = randomPointInSphere(h.smallRadius);
      p.z *= smallScaleZ;
      p.z -= smallOffset;
    }
    if (!inside) p.mult(1.0 + ELECTRON_NEAR_MARGIN);
    if (p.mag() < CORE_MIN_DIST) continue;
    if (Math.abs(p.z) < NODE_BAND_H) continue; // avoid near nodal plane (narrow)
    if (enforceSeparation(p, arr)) {
      arr.push({pos: p, vel: randVel()});
    }
  }
  return arr;
}

function enforceSeparation(p, list){
  for (let i = 0; i < list.length; i++){
    if (p.dist(list[i].pos) < ELECTRON_MIN_DIST) return false;
  }
  return true;
}

function enforceCoreExclusion(p){
  const d = p.mag();
  if (d < CORE_MIN_DIST) {
    if (d < 1e-4) {
      p.set(CORE_MIN_DIST, 0, 0);
    } else {
      p.setMag(CORE_MIN_DIST);
    }
  }
}

function stepElectronMotion(hybridDisplay){
  const dt = deltaTime ? deltaTime / 1000.0 : 0.016;

  if (!hybridized && sCount > 0){
    stepElectronSetS(sElectrons, dt);
  }
  for (let i = 0; i < pOrbitals.length; i++){
    stepElectronSetP(pOrbitals[i], dt);
  }
  if (hybridDisplay && hybridDisplay.items.length > 0){
    for (let item of hybridDisplay.items){
      stepElectronSetHybrid(item.hybrid, item.displayDir, dt);
    }
  }
}

function addNoiseVelocity(e){
  e.vel.add(createVector(
    random(-ELECTRON_NOISE, ELECTRON_NOISE),
    random(-ELECTRON_NOISE, ELECTRON_NOISE),
    random(-ELECTRON_NOISE, ELECTRON_NOISE)
  ));
  const maxV = ELECTRON_SPEED;
  if (e.vel.mag() > maxV) e.vel.setMag(maxV);
}

function reflectIfOutside(p, vel, limitFunc){
  const res = limitFunc(p);
  if (!res.inside){
    if (res.normal) {
      const n = res.normal.copy().normalize();
      const dot = vel.dot(n);
      vel.sub(p5.Vector.mult(n, 1.8 * dot));
    } else {
      vel.mult(-0.8);
    }
    p.add(vel);
  }
}

function applySeparation(list){
  for (let i = 0; i < list.length; i++){
    const a = list[i];
    const partner = list[int(random(list.length))];
    if (!partner || partner === a) continue;
    const d = p5.Vector.sub(a.pos, partner.pos);
    const dist = d.mag();
    if (dist > 1e-5 && dist < ELECTRON_MIN_DIST){
      const push = (ELECTRON_MIN_DIST - dist) * 0.4;
      d.normalize().mult(push);
      a.pos.add(d);
    }
  }
}

function stepElectronSetS(list, dt){
  const r = 60 * SIZE_SCALE;
  const rOuter = r * (1 + ELECTRON_NEAR_MARGIN);
  for (let e of list){
    addNoiseVelocity(e);
    e.vel.mult(pow(ELECTRON_DAMP, dt / 0.016));
    e.pos.add(p5.Vector.mult(e.vel, dt * 60));
    reflectIfOutside(e.pos, e.vel, (p)=> {
      const d = p.mag();
      if (d <= rOuter) return {inside:true};
      return {inside:false, normal:p.copy().normalize()};
    });
    enforceCoreExclusion(e.pos);
  }
  applySeparation(list);
}

function stepElectronSetP(po, dt){
  if (!po.electrons) return;
  const lobeRadius = 40 * SIZE_SCALE;
  const scaleZ = 1.4;
  const zOffset = lobeRadius * scaleZ;
  const outerScale = 1 + ELECTRON_NEAR_MARGIN;

  for (let e of po.electrons){
    addNoiseVelocity(e);
    e.vel.mult(pow(ELECTRON_DAMP, dt / 0.016));
    e.pos.add(p5.Vector.mult(e.vel, dt * 60));

    reflectIfOutside(e.pos, e.vel, (p)=> {
      let local = p.copy();
      const sign = local.z >= 0 ? 1 : -1;
      local.z -= sign * zOffset;
      local.z /= scaleZ;
      const d = local.mag();
      if (d <= lobeRadius * outerScale) return {inside:true};
      const n = local.copy().normalize();
      n.z *= scaleZ;
      return {inside:false, normal:n};
    });
    enforceCoreExclusion(e.pos);

    if (Math.abs(e.pos.z) < NODE_BAND_P) {
      const s = e.pos.z >= 0 ? 1 : -1;
      e.pos.z = s * NODE_BAND_P;
      e.vel.z = abs(e.vel.z) * s;
    }
  }
  applySeparation(po.electrons);
}

function stepElectronSetHybrid(h, axis, dt){
  if (!h.electrons) return;
  const bigScaleZ = 1.5;
  const smallScaleZ = 1.2;
  const bigOffset = h.bigRadius * bigScaleZ;
  const smallOffset = h.smallRadius * smallScaleZ;
  const outerScale = 1 + ELECTRON_NEAR_MARGIN;

  for (let e of h.electrons){
    addNoiseVelocity(e);
    e.vel.mult(pow(ELECTRON_DAMP, dt / 0.016));
    e.pos.add(p5.Vector.mult(e.vel, dt * 60));

    reflectIfOutside(e.pos, e.vel, (p)=> {
      const dzBig = Math.abs((p.z - bigOffset) / bigScaleZ);
      const dzSmall = Math.abs((p.z + smallOffset) / smallScaleZ);
      const useBig = dzBig < dzSmall;
      let local = p.copy();
      if (useBig) {
        local.z -= bigOffset;
        local.z /= bigScaleZ;
        const d = local.mag();
        if (d <= h.bigRadius * outerScale) return {inside:true};
        let n = local.copy().normalize();
        n.z *= bigScaleZ;
        return {inside:false, normal:n};
      } else {
        local.z += smallOffset;
        local.z /= smallScaleZ;
        const d = local.mag();
        if (d <= h.smallRadius * outerScale) return {inside:true};
        let n = local.copy().normalize();
        n.z *= smallScaleZ;
        return {inside:false, normal:n};
      }
    });
    enforceCoreExclusion(e.pos);

    if (Math.abs(e.pos.z) < NODE_BAND_H) {
      const s = e.pos.z >= 0 ? 1 : -1;
      e.pos.z = s * NODE_BAND_H;
      e.vel.z = abs(e.vel.z) * s;
    }
  }
  applySeparation(h.electrons);
}

function electronColor(type, idx){
  if (type === 's') return [200, 235, 255];
  if (type === 'p') {
    const palette = [
      [255, 210, 160],
      [255, 170, 140],
      [240, 200, 255]
    ];
    return palette[idx % palette.length];
  }
  if (type === 'h') {
    const paletteOpposed = [
      [120, 230, 255],
      [255, 140, 140],
      [140, 255, 170],
      [255, 220, 110],
      [160, 190, 255],
      [255, 150, 230]
    ];
    return paletteOpposed[idx % paletteOpposed.length];
  }
  return [220,220,220];
}

function drawElectronClouds(hybridDisplay){
  if (!hybridized && sCount > 0){
    const col = electronColor('s',0);
    drawElectronSet(sElectrons, col);
  }

  for (let i = 0; i < pOrbitals.length; i++){
    const po = pOrbitals[i];
    const axis = getDisplayPAxis(i);
    const pos = getDisplayPPos(i);
    if (!po.electrons) continue;
    const col = electronColor('p', i);
    drawElectronSetTransformed(po.electrons, axis, pos, col);
  }

  if (hybridDisplay && hybridDisplay.items.length > 0){
    for (let item of hybridDisplay.items){
      const h = item.hybrid;
      if (!h.electrons) continue;
      const col = electronColor('h', h.id);
      drawElectronSetTransformed(h.electrons, item.displayDir, item.worldPos, col);
    }
  }
}

function drawElectronSet(list, col){
  const baseAlpha = disableTransparency ? ELECTRON_ALPHA_OPAQUE : ELECTRON_ALPHA_BASE;
  const alpha = renderMode === 'points' ? baseAlpha : A(baseAlpha);
  const size = ELECTRON_SIZE;
  const cr = col[0] * ELECTRON_BRIGHTNESS;
  const cg = col[1] * ELECTRON_BRIGHTNESS;
  const cb = col[2] * ELECTRON_BRIGHTNESS;
  noStroke();
  shininess(getShininess() + 4);
  specularMaterial(cr, cg, cb, alpha);
  fill(cr, cg, cb, alpha);
  ambientMaterial(cr, cg, cb, alpha);
  for (let i = 0; i < list.length; i++){
    const p = list[i].pos;
    push();
    translate(p.x, p.y, p.z);
    sphere(size, 16, 16);
    pop();
  }
}

function drawElectronSetTransformed(list, axis, offset, col){
  const baseAlpha = disableTransparency ? ELECTRON_ALPHA_OPAQUE : ELECTRON_ALPHA_BASE;
  const alpha = renderMode === 'points' ? baseAlpha : A(baseAlpha);
  const size = ELECTRON_SIZE;
  const cr = col[0] * ELECTRON_BRIGHTNESS;
  const cg = col[1] * ELECTRON_BRIGHTNESS;
  const cb = col[2] * ELECTRON_BRIGHTNESS;
  noStroke();
  shininess(getShininess() + 4);
  specularMaterial(cr, cg, cb, alpha);
  fill(cr, cg, cb, alpha);
  ambientMaterial(cr, cg, cb, alpha);

  for (let i = 0; i < list.length; i++){
    const lp = list[i].pos;
    const world = orientPointToAxis(lp, axis).add(offset);
    push();
    translate(world.x, world.y, world.z);
    sphere(size, 16, 16);
    pop();
  }
}