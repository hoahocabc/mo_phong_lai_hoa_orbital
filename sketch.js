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

// User-controlled transparency
let transparencyFactor = 1.0;

// Config range for transparency slider
const ALPHA_FACTOR_MIN = 0.15; // Rightmost (100): Very transparent (Ghost)
const ALPHA_FACTOR_MAX = 6.0;  // Leftmost (0): Opaque (Solid)

// split/join state & animation
let splitState = false;
let splitAnimating = false;
let splitStart = 0;
let splitDuration = 3800; 

// rotation-only timeline for the 2-hybrid flip
let rotStart = 0;
let rotAnimating = false;
const ROTATION_DURATION_MS = 1000; // 0->180° in 1s

let camDist = 500;
// New camera state variables
let camTheta = 0.6; // Horizontal angle
let camPhi = -0.4;  // Vertical angle
let camUp;          // Camera up vector to support full rotation

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
let sliderAlphaEl = null;
let alphaValueEl = null;

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
const ELECTRON_SIZE = 1.1 * SIZE_SCALE;          
const ELECTRON_MIN_DIST = ELECTRON_SIZE * 1.9;    
const ELECTRON_SPEED = 0.38;
const ELECTRON_NOISE = 0.12;
const ELECTRON_DAMP = 0.93;
const ELECTRON_NEAR_MARGIN = 0.35; 
const ELECTRON_BRIGHTNESS = 0.78;   
const ELECTRON_ALPHA_BASE = 150;    
const ELECTRON_ALPHA_OPAQUE = 210;  
const CORE_MIN_DIST = 14 * SIZE_SCALE; 
const NODE_BAND_P = 4 * SIZE_SCALE;    
const NODE_BAND_H = 5 * SIZE_SCALE;    

// --- Added: outer-tip normal smoothing to avoid "pointy" look when rotated ---
const OUTER_TIP_NORMAL_SMOOTH = 0.22; // 0..0.5 (bigger = rounder highlight at tip)
const OUTER_TIP_SPECULAR_MUL = 0.45;
const OUTER_TIP_SHININESS_MUL = 0.45;

// --- NEW: transparency pipeline controls ---
const TRANSPARENT_TWO_PASS = true;

// Helper to set up GL state for transparency
function setTransparentState(enableDepthWrite) {
  const gl = drawingContext;
  if (!gl) return;

  if (disableTransparency) {
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
  } else {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(enableDepthWrite); // Control depth writing
    
    // Default to Back-face culling enabled for standard transparent objects
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }
}

// Wrapper to draw with back-face culling logic
function drawWithCulling(drawFn) {
  const gl = drawingContext;
  if (!gl || disableTransparency || !TRANSPARENT_TWO_PASS) {
    drawFn();
    return;
  }
  
  // Pass 1: Back faces
  gl.cullFace(gl.FRONT);
  drawFn();
  
  // Pass 2: Front faces
  gl.cullFace(gl.BACK);
  drawFn();
}

// Special wrapper for Small Lobes: Draw WITHOUT culling to make them look "thick"
function drawNoCulling(drawFn) {
    const gl = drawingContext;
    if (!gl) { drawFn(); return; }
    gl.disable(gl.CULL_FACE);
    drawFn();
    if (!disableTransparency) {
        gl.enable(gl.CULL_FACE); // restore
        gl.cullFace(gl.BACK);
    }
}


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
    labelAlpha: "Độ trong suốt orbital",
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
    labelAlpha: "Orbital transparency",
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
  setAttributes('alpha', true); 
  
  pixelDensity(min(window.devicePixelRatio, 2));

  const w = window.innerWidth - sidebarWidth;
  const h = window.innerHeight;
  canvas = createCanvas(w, h, WEBGL);
  canvas.parent('canvasContainer');

  perspective(FOV, w / h, CAMERA_NEAR, CAMERA_FAR);
  
  camPos = createVector(0, 0, camDist);
  let rX = -0.4;
  let rY = 0.6;
  let q1 = new Quaternion().setFromAxisAngle(createVector(1,0,0), rX);
  let q2 = new Quaternion().setFromAxisAngle(createVector(0,1,0), rY);
  camPos = q2.rotateVector(q1.rotateVector(camPos));
  camUp = createVector(0, 1, 0);
  camUp = q2.rotateVector(q1.rotateVector(camUp));

  setupUI();
}

// Simple Quaternion class for 3D rotation
class Quaternion {
  constructor(w=1, x=0, y=0, z=0) {
    this.w = w; this.x = x; this.y = y; this.z = z;
  }
  setFromAxisAngle(axis, angle) {
    let s = Math.sin(angle / 2);
    this.w = Math.cos(angle / 2);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    return this;
  }
  multiply(q) {
    let nw = this.w*q.w - this.x*q.x - this.y*q.y - this.z*q.z;
    let nx = this.w*q.x + this.x*q.w + this.y*q.z - this.z*q.y;
    let ny = this.w*q.y - this.x*q.z + this.y*q.w + this.z*q.x;
    let nz = this.w*q.z + this.x*q.y - this.y*q.x + this.z*q.w;
    return new Quaternion(nw, nx, ny, nz);
  }
  rotateVector(v) {
    let qv = new Quaternion(0, v.x, v.y, v.z);
    let inv = new Quaternion(this.w, -this.x, -this.y, -this.z);
    let res = this.multiply(qv).multiply(inv);
    return createVector(res.x, res.y, res.z);
  }
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
  sliderAlphaEl = select('#sliderAlpha');
  alphaValueEl = select('#alphaValue');
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

  if (sliderAlphaEl) {
    const applyAlphaSlider = ()=> {
      const val = sliderAlphaEl.value();
      transparencyFactor = computeTransparencyFactor(val);
      if (alphaValueEl) alphaValueEl.html(`${val}%`);
    };
    applyAlphaSlider();
    sliderAlphaEl.input(applyAlphaSlider);
  }

  toggleSplitEl.changed(()=> {
    splitState = toggleSplitEl.elt.checked;
    splitAnimating = true;
    splitStart = millis();
    splitDuration = splitState ? 1500 : 3800;
    preparePOrbitalsTargetsForSplit(splitState);
    rotAnimating = true;
    rotStart = millis();
  });

  if (toggleAxesEl) {
    toggleAxesEl.elt.checked = false; 
    showAxes = false; 
    toggleAxesEl.changed(()=> { 
      showAxes = toggleAxesEl.elt.checked; 
    });
  }

  if (toggleOpaqueEl) toggleOpaqueEl.changed(()=> { disableTransparency = toggleOpaqueEl.elt.checked; });

  updateLanguage();
  updateCounts();
  updateButtonsState();
  updateModeButtonsState();
}

function computeTransparencyFactor(sliderVal){
  const t = constrain(sliderVal, 0, 100) / 100.0;
  return map(t, 0, 1.0, ALPHA_FACTOR_MAX, ALPHA_FACTOR_MIN);
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
  select('#labelAlpha').html(s.labelAlpha);
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
  if (sliderAlphaEl) {
    sliderAlphaEl.value(50);
    transparencyFactor = computeTransparencyFactor(50);
  } else {
    transparencyFactor = 1.0;
  }
  if (alphaValueEl) alphaValueEl.html(`${sliderAlphaEl ? sliderAlphaEl.value() : 50}%`);
  
  camDist = 500;
  camPos = createVector(0, 0, camDist);
  let rX = -0.4;
  let rY = 0.6;
  let q1 = new Quaternion().setFromAxisAngle(createVector(1,0,0), rX);
  let q2 = new Quaternion().setFromAxisAngle(createVector(0,1,0), rY);
  camPos = q2.rotateVector(q1.rotateVector(camPos));
  camUp = createVector(0, 1, 0);
  camUp = q2.rotateVector(q1.rotateVector(camUp));

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

  let camDir = camPos.copy().normalize();
  let totalDist = cameraBaseZ() + camDist;
  let finalCamPos = camDir.copy().mult(totalDist);

  camera(finalCamPos.x, finalCamPos.y, finalCamPos.z, 0, 0, 0, camUp.x, camUp.y, camUp.z);
  camPos = finalCamPos;

  const hybridDisplay = computeHybridDisplayState();

  applyLighting();

  if (kneading) {
    const t = millis() - kneadStart;
    const prog = constrain(t / kneadDuration, 0, 1);

    push();
    rotateY(0.25 * Math.sin(prog * Math.PI * 2));
    scale(1 + 0.02 * Math.sin(prog * Math.PI * 3));
    
    // Kneading Blob
    setTransparentState(true); 
    drawWithCulling(() => {
        if (renderMode === 'points') drawKneadBlobPoints(prog);
        else drawKneadBlobOverlay(prog);
    });
    const gl = drawingContext;
    if(gl) gl.depthMask(true); 
    
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

    // DRAW AXES FIRST (Standard depth test)
    if (showAxes && !kneading) {
      drawAxesNormal(hybridDisplay);
    }

    if (renderMode === 'overlay') {
       drawSortedOrbitals(hybridDisplay);
    } else {
       setTransparentState(true);
       ensureElectronClouds();
       stepElectronMotion(hybridDisplay);
       drawElectronClouds(hybridDisplay);
       const gl = drawingContext; if(gl) gl.depthMask(true);
    }
  }
}

// 4. IMPROVED SORTING & RENDERING PIPELINE (INSIDE-OUT FORCE)
function drawSortedOrbitals(hybridDisplay) {
  let smallLobeList = [];
  let bigLobeList = [];

  // Add P-Orbitals
  for (let i = 0; i < pOrbitals.length; i++) {
    const pos = getDisplayPPos(i);
    // Treat P orbitals as "Core" items (since they are inside S, and similar density to small lobes)
    smallLobeList.push({
      type: 'p',
      index: i,
      pos: pos,
    });
  }

  // Add Hybrid Orbitals
  if (hybridDisplay && hybridDisplay.items) {
    for (let item of hybridDisplay.items) {
      const h = item.hybrid;
      
      const posBig = p5.Vector.add(item.worldPos, p5.Vector.mult(item.displayDir, h.bigRadius * 1.5 * 0.5));
      const posSmall = p5.Vector.sub(item.worldPos, p5.Vector.mult(item.displayDir, h.smallRadius * 1.2 * 0.5));

      // Separate Small from Big
      smallLobeList.push({
        type: 'h_small',
        item: item, 
        pos: posSmall,
      });

      bigLobeList.push({
        type: 'h_big',
        item: item, 
        pos: posBig,
      });
    }
  }

  // Add S-Orbital (Always the biggest Shell)
  if (sCount > 0) {
    bigLobeList.push({
      type: 's',
      pos: createVector(0,0,0),
      // S-orbital is the outermost shell
      forceLast: true 
    });
  }

  const gl = drawingContext;

  // --- PHASE 1: DRAW ALL "CORE" OBJECTS (Small Lobes & P-Orbitals) FIRST ---
  setTransparentState(true);
  
  for (let obj of smallLobeList) {
      if (obj.type === 'p') {
        const i = obj.index;
        const displayAxis = getDisplayPAxis(i);
        const displayPos = getDisplayPPos(i);
        push();
        translate(displayPos.x, displayPos.y, displayPos.z);
        drawWithCulling(() => drawPorbital(displayAxis, false, 0, i, camPos, true));
        pop();
      } 
      else if (obj.type === 'h_small') {
        // Draw small lobes slightly thicker/opaque
        drawNoCulling(() => drawHybridLobe('small', obj.item));
      }
  }

  // --- PHASE 2: DRAW ALL "SHELL" OBJECTS (Big Lobes & S-Orbital) LAST ---
  bigLobeList.forEach(obj => {
      obj.dist = p5.Vector.sub(obj.pos, camPos).mag();
  });
  
  bigLobeList.sort((a, b) => {
    if (a.forceLast) return 1; 
    if (b.forceLast) return -1; 
    return b.dist - a.dist;
  });

  for (let obj of bigLobeList) {
      if (obj.type === 's') {
        setTransparentState(false); 
        drawWithCulling(() => drawSOrbital());
      } 
      else if (obj.type === 'h_big') {
        drawWithCulling(() => drawHybridLobe('big', obj.item));
      }
  }
  
  if (gl) gl.depthMask(true);
}

function drawSOrbital() {
  const matScale = captureMode ? 1.0 : 1.0;
  push();
  noStroke();
  const sRadius = 60 * SIZE_SCALE;
  
  // FIX #6: EVEN BRIGHTER S-ORBITAL
  // Increased base color components further for a "glowing" effect
  const [sr, sg, sb] = scaledRGB(160, 220, 255, matScale); 
  
  const shellAlpha = 40; 
  specularMaterial(sr * 0.3, sg * 0.3, sb * 0.3, A(160)); 
  
  // Stronger emission to make it radiant
  emissiveMaterial(50, 90, 130, A(shellAlpha * 0.8));

  fill(sr, sg, sb, A(shellAlpha));
  ambientMaterial(sr, sg, sb, A(shellAlpha));
  shininess(getShininess() + 4);
  
  sphere(sRadius, 128, 128);
  pop();
}

function drawHybridLobe(type, item) {
  const h = item.hybrid;
  const matMul = disableTransparency ? 0.65 : 1.0;
  const alphaMul = disableTransparency ? 0.72 : 1.0;

  push();
  translate(item.worldPos.x, item.worldPos.y, item.worldPos.z);
  alignVectorToAxis(item.displayDir);

  const commonShininess = getShininess() + 5;

  if (type === 'small') {
    // Small lobe
    const smallScaleZ = 1.2;
    const innerSmallTranslate = h.smallRadius * smallScaleZ;
    push();
    translate(0, 0, -innerSmallTranslate);
    rotateX(Math.PI); 
    noStroke();
    
    // Transparent enough to see axis inside
    const smallSpecA = A(80 * alphaMul); 
    const smallFillA = A(55 * alphaMul); 

    specularMaterial(120 * 0.9 * matMul, 255 * 0.9 * matMul, 180 * 0.9 * matMul, smallSpecA);
    fill(120 * matMul, 255 * matMul, 180 * matMul, smallFillA); 
    ambientMaterial(120 * matMul, 255 * matMul, 180 * matMul, smallFillA);
    
    shininess(2); 
    
    scale(0.8, 0.8, smallScaleZ);
    drawTaperedLobe(h.smallRadius);
    pop();
  } else {
    // Large lobe
    const bigScaleZ = 1.5;
    const innerBigTranslate = h.bigRadius * bigScaleZ;
    push();
    translate(0, 0, innerBigTranslate); 
    noStroke();
    
    // Keep big lobe very transparent
    const bigFillA = A(45 * alphaMul);
    const bigSpecA = A(120 * alphaMul);
    
    specularMaterial(120 * 0.9 * matMul, 255 * 0.9 * matMul, 180 * 0.9 * matMul, bigSpecA);
    fill(120 * matMul, 255 * matMul, 180 * matMul, bigFillA); 
    ambientMaterial(120 * matMul, 255 * matMul, 180 * matMul, bigFillA);
    shininess(commonShininess);

    scale(1, 1, bigScaleZ);

    drawTaperedLobeOuterTipSmooth(h.bigRadius);
    pop();
  }
    
  pop();
}

function A(a){ 
  if (disableTransparency) return 255;
  return constrain(a * transparencyFactor, 0, 255); 
}

function getShininess(){ 
  if (disableTransparency) return 2;
  // Dynamic shininess
  if (transparencyFactor > 1.5) return 2; 
  return 10;
}

function applyLighting(){
  const s = 1.0;

  const camDir = camPos ? camPos.copy().normalize().mult(-1) : createVector(0, 0, -1);
  const warmKeyDir = camDir.copy().mult(0.6);
  const coolRimDir = camDir.copy().mult(1.0);

  let intensityMul = 1.0;
  // FIX: Stronger dampening of directional light when opaque to prevent glare
  if (transparencyFactor > 2.0) {
      intensityMul = 0.4; 
  }

  const keyMul = (disableTransparency ? 0.26 : 0.8) * intensityMul;
  const rimMul = (disableTransparency ? 0.20 : 0.6) * intensityMul;

  const captureToneMul = captureMode ? 1.0 : 1.0;
  const sTone = s * captureToneMul;

  if (disableTransparency) {
    ambientLight(120 * sTone, 120 * sTone, 120 * sTone);
    directionalLight(58 * sTone, 58 * sTone, 58 * sTone, -0.6, -0.4, -1);
    pointLight(50 * sTone, 52 * sTone, 56 * sTone, -300, -200, 300);
    pointLight(40 * sTone, 40 * sTone, 38 * sTone, 250, 200, -200);
    pointLight(26 * sTone, 32 * sTone, 40 * sTone, 0, 300, -500);
  } else {
    // Reduced ambient to prevent washout
    ambientLight(90 * sTone, 90 * sTone, 95 * sTone);
    
    directionalLight(120 * sTone * intensityMul, 120 * sTone * intensityMul, 110 * sTone * intensityMul, -0.6, -0.4, -1);
    
    pointLight(70 * sTone * intensityMul, 80 * sTone * intensityMul, 100 * sTone * intensityMul, -300, -200, 300);
    pointLight(60 * sTone * intensityMul, 50 * sTone * intensityMul, 40 * sTone * intensityMul, 250, 200, -200);
    pointLight(30 * sTone * intensityMul, 40 * sTone * intensityMul, 50 * sTone * intensityMul, 0, 300, -500);
  }

  directionalLight(160 * keyMul * sTone, 128 * keyMul * sTone, 110 * keyMul * sTone, warmKeyDir.x, warmKeyDir.y, warmKeyDir.z);
  directionalLight(82 * rimMul * sTone, 118 * rimMul * sTone, 180 * rimMul * sTone, coolRimDir.x, coolRimDir.y, coolRimDir.z);
}

function scaledRGB(r, g, b, s) {
  return [constrain(r * s, 0, 255), constrain(g * s, 0, 255), constrain(b * s, 0, 255)];
}

function drawTaperedLobeOuterTipSmooth(r){
  let detail = 72;
  noStroke();

  for (let i = 0; i < detail; i++) {
    let lat1 = map(i, 0, detail, -HALF_PI, HALF_PI);
    let lat2 = map(i+1, 0, detail, -HALF_PI, HALF_PI);
    
    let z1 = sin(lat1);
    let z2 = sin(lat2);
    
    let taper1 = map(z1, -1, 1, 0.45, 1.0);
    let taper2 = map(z2, -1, 1, 0.45, 1.0);
    
    let r1 = cos(lat1) * r * taper1;
    let r2 = cos(lat2) * r * taper2;
    let h1 = z1 * r;
    let h2 = z2 * r;

    const b1 = computeOuterTipNormalBlend(z1);
    const b2 = computeOuterTipNormalBlend(z2);

    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= detail; j++) {
      let lon = map(j, 0, detail, 0, TWO_PI);
      let x = cos(lon);
      let y = sin(lon);

      // Blend normals toward pole (0,0,1) only near outer tip (+Z)
      let n1x = lerp(x, 0, b1);
      let n1y = lerp(y, 0, b1);
      let n1z = lerp(z1, 1, b1);

      let n2x = lerp(x, 0, b2);
      let n2y = lerp(y, 0, b2);
      let n2z = lerp(z2, 1, b2);

      const l1 = Math.sqrt(n1x*n1x + n1y*n1y + n1z*n1z) || 1;
      const l2 = Math.sqrt(n2x*n2x + n2y*n2y + n2z*n2z) || 1;

      normal(n1x/l1, n1y/l1, n1z/l1);
      vertex(x * r1, y * r1, h1);
      
      normal(n2x/l2, n2y/l2, n2z/l2);
      vertex(x * r2, y * r2, h2);
    }
    endShape();
  }
}

// Original tapered lobe geometry/normals (kept for inner tips / other shapes)
function drawTaperedLobe(r) {
  let detail = 72;
  noStroke();

  for (let i = 0; i < detail; i++) {
    let lat1 = map(i, 0, detail, -HALF_PI, HALF_PI);
    let lat2 = map(i+1, 0, detail, -HALF_PI, HALF_PI);
    
    let z1 = sin(lat1);
    let z2 = sin(lat2);
    
    let taper1 = map(z1, -1, 1, 0.45, 1.0);
    let taper2 = map(z2, -1, 1, 0.45, 1.0);
    
    let r1 = cos(lat1) * r * taper1;
    let r2 = cos(lat2) * r * taper2;
    let h1 = z1 * r;
    let h2 = z2 * r;

    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= detail; j++) {
      let lon = map(j, 0, detail, 0, TWO_PI);
      let x = cos(lon);
      let y = sin(lon);
      
      normal(x, y, z1); 
      vertex(x * r1, y * r1, h1);
      
      normal(x, y, z2);
      vertex(x * r2, y * r2, h2);
    }
    endShape();
  }
}

// Helper to blend outer tip normal
function computeOuterTipNormalBlend(z){
  const band = constrain(OUTER_TIP_NORMAL_SMOOTH, 0.0, 0.5);
  if (band <= 0) return 0;
  return constrain(map(z, 1 - band, 1, 0, 1), 0, 1);
}

function drawPorbital(axisVec, kneadMode=false, prog=0, idx=0, camPosLocal=null, isInner=false){
  push();
  alignVectorToAxis(axisVec);

  const lobeRadiusBase = 40 * SIZE_SCALE;  
  const scaleZ = 1.4;
  const zOffset = lobeRadiusBase * scaleZ;

  let camVec = camPosLocal ? camPosLocal.copy().normalize() : createVector(0,0,1);
  let axisNorm = axisVec.copy().normalize();
  let dot = axisNorm.dot(camVec);
  const drawOrder = (dot > 0) ? ['neg','pos'] : ['pos','neg'];

  // Apply outer-tip shading fix: reduce specular/shininess + smooth normals near OUTER tip
  const shin = (getShininess() + 4) * OUTER_TIP_SHININESS_MUL;
  const specMul = OUTER_TIP_SPECULAR_MUL;
  
  // FIX: Make inner P orbital punchier (more saturated) to fight blue tint
  const rCol = isInner ? 255 : 255;
  const gCol = isInner ? 80 : 100; // dark orange
  const bCol = isInner ? 50 : 80;

  for (let k = 0; k < drawOrder.length; k++){
    if (drawOrder[k] === 'pos') {
      push();
      translate(0, 0, zOffset);
      scale(0.8, 0.8, scaleZ);
      noStroke();
      
      specularMaterial(rCol * 0.3 * specMul, gCol * 0.3 * specMul, bCol * 0.3 * specMul, A(180));
      fill(rCol, gCol, bCol, A(70)); 
      ambientMaterial(rCol, gCol, bCol, A(70));
      shininess(shin);

      drawTaperedLobeOuterTipSmooth(lobeRadiusBase);
      pop();
    } else {
      push();
      translate(0, 0, -zOffset);
      rotateX(Math.PI); 
      scale(0.8, 0.8, scaleZ);
      noStroke();
      
      specularMaterial(rCol * 0.3 * specMul, gCol * 0.3 * specMul, bCol * 0.3 * specMul, A(180));
      fill(rCol, gCol, bCol, A(180));
      ambientMaterial(rCol, gCol, bCol, A(70));
      shininess(shin);

      drawTaperedLobeOuterTipSmooth(lobeRadiusBase);
      pop();
    }
  }

  pop();
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

    sphere(ELECTRON_SIZE, 16, 16);
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

    sphere(ELECTRON_SIZE, 16, 16);
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

  // Apply outer-tip shading fix: reduce specular/shininess + smooth normals near OUTER tip
  const shin = (getShininess() + 4) * OUTER_TIP_SHININESS_MUL;
  const specMul = OUTER_TIP_SPECULAR_MUL;

  for (let k = 0; k < drawOrder.length; k++){
    if (drawOrder[k] === 'pos') {
      push();
      translate(0, 0, zOffset);
      scale(0.8, 0.8, scaleZ);
      noStroke();
      
      specularMaterial(255 * 0.9 * specMul, 100 * 0.9 * specMul, 80 * 0.9 * specMul, A(180));
      fill(255, 100, 80, A(70)); 
      ambientMaterial(255, 100, 80, A(70));
      shininess(shin);

      // Outer tip is +Z => smooth only that end
      drawTaperedLobeOuterTipSmooth(lobeRadiusBase);
      pop();
    } else {
      push();
      translate(0, 0, -zOffset);
      // Flip the negative lobe so the narrow end points to center
      rotateX(Math.PI); 
      scale(0.8, 0.8, scaleZ);
      noStroke();
      
      specularMaterial(255 * 0.9 * specMul, 100 * 0.9 * specMul, 80 * 0.9 * specMul, A(180));
      fill(255, 100, 80, A(70));
      ambientMaterial(255, 100, 80, A(70));
      shininess(shin);

      // After rotateX(PI), outer tip still corresponds to +Z in local lobe coords
      drawTaperedLobeOuterTipSmooth(lobeRadiusBase);
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

  for (let item of drawItems) {
    const h = item.hybrid;
    push();
    translate(item.worldPos.x, item.worldPos.y, item.worldPos.z);
    alignVectorToAxis(item.displayDir);

    const smallScaleZ = 1.2;
    const innerSmallTranslate = h.smallRadius * smallScaleZ;

    push();
    translate(0, 0, -innerSmallTranslate);
    rotateX(Math.PI); // Flip small lobe so narrow end is near center
    noStroke();

    const smallSpecA = A(180 * alphaMul * 0.62);
    const smallFillA = A(100 * alphaMul * 0.62);

    specularMaterial(50 * matMul, 130 * matMul, 80 * matMul, smallSpecA);
    fill(50 * matMul, 160 * matMul, 100 * matMul, smallFillA);
    ambientMaterial(50 * matMul, 160 * matMul, 100 * matMul, smallFillA);

    shininess(2); 
    scale(0.8, 0.8, smallScaleZ);
    drawTaperedLobe(h.smallRadius);
    pop();
    
    pop();
  }

  for (let item of drawItems) {
    const h = item.hybrid;
    push();
    translate(item.worldPos.x, item.worldPos.y, item.worldPos.z);
    alignVectorToAxis(item.displayDir);

    const bigScaleZ = 1.5;
    const innerBigTranslate = h.bigRadius * bigScaleZ;

    push();
    translate(0, 0, innerBigTranslate); 
    noStroke();
    specularMaterial(120 * 0.9 * matMul, 255 * 0.9 * matMul, 180 * 0.9 * matMul, A(100 * alphaMul));
    fill(120 * matMul, 255 * matMul, 180 * matMul, A(60 * alphaMul)); 
    ambientMaterial(120 * matMul, 255 * matMul, 180 * matMul, A(60 * alphaMul));
    shininess(getShininess() + 5);
    scale(1, 1, bigScaleZ);

    drawTaperedLobeOuterTipSmooth(h.bigRadius);
    pop();
    
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

function drawAxesNormal(hybridDisplay){
  push();
  noStroke();
  
  fill(220, 0, 0); 
  emissiveMaterial(80, 0, 0); 
  ambientMaterial(220, 0, 0);
  
  for (let i = 0; i < pOrbitals.length; i++){
    push();
    const axisDir = getDisplayPAxis(i).copy().normalize();
    const posCenter = getDisplayPPos(i);

    translate(posCenter.x, posCenter.y, posCenter.z);

    const lobeRadiusBase = 40 * SIZE_SCALE;
    const scaleZ = 1.4;
    const zOffset = lobeRadiusBase * scaleZ;
    const surfaceOffset = zOffset + lobeRadiusBase * scaleZ;

    const axisLen = (surfaceOffset + 10) * 2;

    alignVectorToAxis(axisDir);
    rotateX(HALF_PI);
    cylinder(1.5, axisLen, 32, 1);
    pop();
  }

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
      
      const negLimit = smallSurface + 10;
      const posLimit = bigSurface + 10;
      const totalLen = negLimit + posLimit;

      push();
      translate(displayPos.x, displayPos.y, displayPos.z);
      alignVectorToAxis(displayDir);
      
      let centerShift = (posLimit - negLimit) / 2;
      translate(0, 0, centerShift);

      rotateX(HALF_PI);
      cylinder(1.5, totalLen, 32, 1);
      pop();
    }
  }

  pop();
}

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
  
  const sens = 0.005;
  
  let camDir = camPos.copy().normalize();
  let right = camDir.cross(camUp).normalize();
  if (right.mag() < 0.001) right = createVector(1,0,0); 

  let qY = new Quaternion().setFromAxisAngle(camUp, -dx * sens);
  camPos = qY.rotateVector(camPos);
  
  let qX = new Quaternion().setFromAxisAngle(right, -dy * sens);
  camPos = qX.rotateVector(camPos);
  camUp = qX.rotateVector(camUp);

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

function captureImage4KTransparent(){
  if (captureMode) return;
  captureMode = true;

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

  const newBaseZ = cameraBaseZ();
  camDist = prevRadius - newBaseZ;
  clampCamDist();

  redraw();

  const now = new Date();
  const pad = n => (n < 10 ? '0' + n : n);
  const fname = `orbital_capture_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  setTimeout(()=> {
    saveCanvas(fname, 'png');

    pixelDensity(prevPD);
    resizeCanvas(prevW, prevH);
    perspective(FOV, prevW / prevH, CAMERA_NEAR, CAMERA_FAR);
    const restoreBaseZ = cameraBaseZ();
    camDist = prevRadius - restoreBaseZ;
    clampCamDist();

    captureMode = false;
    loop();
  }, 40);
}

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
    if (Math.abs(p.z) < NODE_BAND_P) continue;
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
    if (Math.abs(p.z) < NODE_BAND_H) continue;
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