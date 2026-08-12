/* Lavender Puff Studio — a manually controlled procedural mascot. */
(() => {
'use strict';

const COLORS = { body: '#C9B6F2', feature: '#3F2A70', cheek: '#F3A6C8' };
const VIEW = 600, CX = 300, CY = 304;
const BASE_R = 125, N_BODY = 16, N_EYE = 12;
const EYE_W = 16, EYE_H = 19;
const FACE_LIMIT_X = 40, FACE_LIMIT_Y = 34;   // elliptical face-placement bounds
const GAZE_X = 8, GAZE_Y = 6.5;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ss = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

/* ---------------------------------------------------------------- body
   16 perimeter points around a soft, nearly-round blob: a whisper of
   organic variation plus tiny hand offsets keep it alive without ever
   reading as lobes. Squash-and-stretch comes from the point springs. */
const ROUND_OFFSETS = [
  .004, -.003, .006, .002, -.005, .003, -.004, .002,
  .005, -.002, .007, .003, -.006, .002, .004, -.003,
];
const BODY_DIR_X = new Float64Array(N_BODY);
const BODY_DIR_Y = new Float64Array(N_BODY);
const BODY_BASE_R = new Float64Array(N_BODY);
for (let i = 0; i < N_BODY; i++) {
  const a = i / N_BODY * TAU;
  BODY_DIR_X[i] = Math.cos(a);
  BODY_DIR_Y[i] = Math.sin(a);
  BODY_BASE_R[i] = BASE_R * (1
    + 0.016 * Math.cos(3 * a - 0.5)
    + 0.010 * Math.sin(2 * a + 0.9)
    + ROUND_OFFSETS[i]);
}

/* ---------------------------------------------------------------- eyes
   Every eye preset is 12 points generated on the same clockwise unit
   circle (index 0 at the top), so any preset morphs into any other by
   plain point-to-point interpolation — no twisting, no crossfades. */
function eyePts({ lidTop = 0, lidBottom = 0, arch = 0, bow = 0 } = {}) {
  const p = new Float64Array(N_EYE * 2);
  for (let i = 0; i < N_EYE; i++) {
    const a = -Math.PI / 2 + i / N_EYE * TAU;
    const x = Math.cos(a);
    let y = Math.sin(a);
    y *= y < 0 ? (1 - lidTop) : (1 - lidBottom);
    if (arch) y -= (y > 0 ? arch * 1.5 : arch * 0.12) * (1 - x * x);
    if (bow) y += bow * 0.5 * (1 - x * x);
    p[i * 2] = x;
    p[i * 2 + 1] = y;
  }
  return p;
}
const SH = {
  round:   eyePts({ lidTop: .05 }),
  open:    eyePts({}),
  soft:    eyePts({ lidTop: .12 }),
  arch:    eyePts({ arch: .55 }),
  bigArch: eyePts({ arch: .85 }),
  halfLid: eyePts({ lidTop: .34 }),
  lowLid:  eyePts({ lidTop: .62, lidBottom: .12, bow: .1 }),
  droopy:  eyePts({ lidTop: .3, bow: .1 }),
};

/* ---------------------------------------------------------------- expressions */
const EXPR = {};
const EXPR_ORDER = [];
function defExpr(id, label, category, o) {
  EXPR[id] = {
    id, label, category,
    eyeL: Object.assign({ pts: SH.round, x: -26, y: -5, sx: 1, sy: 1, rot: 0 }, o.eyeL),
    eyeR: Object.assign({ pts: SH.round, x: 26, y: -5, sx: 1, sy: 1, rot: 0 }, o.eyeR),
    mouth: Object.assign({ x: 0.5, y: 22, w: 11, curve: 2.5, open: 0, rot: 0.015, op: 1 }, o.mouth),
    cheeks: Object.assign({ op: 0, scale: 1 }, o.cheeks),
    body: Object.assign({ sx: 1, sy: 1, rot: 0, x: 0, y: 0 }, o.body),
    gaze: Object.assign({ x: 0, y: 0 }, o.gaze),
    entrance: o.entrance || ['gentle', 0.5],
  };
  EXPR_ORDER.push(id);
}

defExpr('neutral', 'Neutral', 'calm', {
  eyeR: { sy: 0.985, rot: 0.015 },
  entrance: ['gentle', 0.5],
});
defExpr('soft-happy', 'Soft Happy', 'positive', {
  eyeL: { pts: SH.arch, sy: 0.92 },
  eyeR: { pts: SH.arch, sy: 0.9, rot: 0.02 },
  mouth: { w: 13, curve: 4 },
  cheeks: { op: 0.35 },
  body: { sy: 0.995 },
  entrance: ['squish', 0.6],
});
defExpr('laughing', 'Laughing', 'positive', {
  eyeL: { pts: SH.bigArch, sy: 0.95 },
  eyeR: { pts: SH.bigArch, sy: 0.93, rot: 0.02 },
  mouth: { w: 15, curve: 5, open: 0.5 },
  cheeks: { op: 0.45 },
  body: { sx: 1.02, sy: 0.97 },
  entrance: ['laugh', 0.9],
});
defExpr('excited', 'Excited', 'positive', {
  eyeL: { pts: SH.open, sx: 1.05, sy: 1.15 },
  eyeR: { pts: SH.open, sx: 1.05, sy: 1.12, rot: 0.02 },
  mouth: { w: 13, curve: 5, open: 0.35 },
  cheeks: { op: 0.3 },
  body: { sy: 1.02 },
  entrance: ['jump', 0.9],
});
defExpr('surprised', 'Surprised', 'playful', {
  eyeL: { pts: SH.open, sx: 0.95, sy: 1.3 },
  eyeR: { pts: SH.open, sx: 0.95, sy: 1.27 },
  mouth: { x: 0, w: 6, curve: 0, open: 0.45, rot: 0 },
  body: { sy: 1.03 },
  entrance: ['pop', 0.8],
});
defExpr('curious', 'Curious', 'playful', {
  eyeL: { pts: SH.round, sx: 1.1, sy: 1.12 },
  eyeR: { pts: SH.soft, sx: 0.95, sy: 0.95, rot: 0.04 },
  mouth: { x: 2.5, w: 8, curve: 2 },
  body: { rot: -0.035 },
  gaze: { x: 2 },
  entrance: ['curious', 0.7],
});
defExpr('sleepy', 'Sleepy', 'calm', {
  eyeL: { pts: SH.lowLid, sy: 0.8 },
  eyeR: { pts: SH.lowLid, sy: 0.76, rot: 0.03 },
  mouth: { w: 8, curve: 1.5, open: 0.18 },
  cheeks: { op: 0.15 },
  body: { sx: 1.05, sy: 0.96, y: 5 },
  gaze: { y: 2 },
  entrance: ['drowse', 0.7],
});
defExpr('shy', 'Shy', 'positive', {
  eyeL: { pts: SH.droopy, x: -25, y: -3, sx: 0.92, sy: 0.76, rot: -0.06 },
  eyeR: { pts: SH.droopy, x: 25, y: -2, sx: 0.9, sy: 0.72, rot: 0.05 },
  mouth: { x: 1, w: 9, curve: 2.5 },
  cheeks: { op: 0.85 },
  body: { sx: 0.97, sy: 0.99, y: 3, rot: 0.02 },
  gaze: { x: 1.5, y: 4 },
  entrance: ['shy', 0.8],
});
defExpr('sad', 'Sad', 'concerned', {
  eyeL: { pts: SH.droopy, sy: 0.85, rot: -0.14 },
  eyeR: { pts: SH.droopy, sy: 0.83, rot: 0.14 },
  mouth: { w: 10, curve: -3.5 },
  body: { sy: 0.965, y: 4, rot: 0.015 },
  gaze: { y: 3 },
  entrance: ['droop', 0.7],
});
defExpr('angry', 'Angry', 'concerned', {
  eyeL: { pts: SH.halfLid, sy: 0.8, rot: 0.17 },
  eyeR: { pts: SH.halfLid, sy: 0.8, rot: -0.17 },
  mouth: { w: 10, curve: -3 },
  body: { sx: 1.03, sy: 0.95 },
  entrance: ['tense', 0.9],
});
const CATEGORIES = [
  ['all', 'All'], ['positive', 'Positive'], ['calm', 'Calm'],
  ['concerned', 'Concerned'], ['playful', 'Playful'],
];

/* ---------------------------------------------------------------- springs
   Every animated value is {current, target, velocity}. Integrated with
   fixed 120Hz substeps derived from real delta time, so motion is
   identical at 30/60/90/120Hz displays. */
const SPRINGS = [];
const GROUPS = {
  bodyPoint: { k: 115, d: 15 },
  bodyT:     { k: 150, d: 19 },
  eye:       { k: 210, d: 23 },
  gaze:      { k: 260, d: 28 },
  mouth:     { k: 180, d: 22 },
  face:      { k: 200, d: 24 },
};
const TUNED = {};
for (const g in GROUPS) TUNED[g] = { k: GROUPS[g].k, d: GROUPS[g].d, decay: 1 };

function spring(value, group, eps) {
  const s = { c: value, t: value, v: 0, g: group, eps };
  SPRINGS.push(s);
  return s;
}

function stepSprings(dt) {
  if (dt <= 0) return;
  const n = Math.min(Math.max(1, Math.ceil(dt / (1 / 120))), 8);
  const h = dt / n;
  for (const g in TUNED) TUNED[g].decay = Math.exp(-TUNED[g].d * h);
  for (let sub = 0; sub < n; sub++) {
    for (let j = 0; j < SPRINGS.length; j++) {
      const s = SPRINGS[j], P = TUNED[s.g];
      s.v = (s.v + (s.t - s.c) * P.k * h) * P.decay;
      s.c += s.v * h;
    }
  }
}

function springsSettled() {
  for (let j = 0; j < SPRINGS.length; j++) {
    const s = SPRINGS[j];
    if (Math.abs(s.t - s.c) > s.eps || Math.abs(s.v) > s.eps * 12) return false;
  }
  return true;
}

function snapSprings() {
  for (let j = 0; j < SPRINGS.length; j++) { SPRINGS[j].c = SPRINGS[j].t; SPRINGS[j].v = 0; }
}

function mkEyeSprings() {
  const pts = [];
  for (let j = 0; j < N_EYE * 2; j++) pts.push(spring(0, 'eye', 0.04));
  return {
    pts,
    x: spring(0, 'eye', 0.04), y: spring(-5, 'eye', 0.04),
    sx: spring(1, 'eye', 0.0018), sy: spring(1, 'eye', 0.0018),
    rot: spring(0, 'eye', 0.0015),
  };
}

const S = {
  body: Array.from({ length: N_BODY }, (_, i) => spring(BODY_BASE_R[i], 'bodyPoint', 0.06)),
  bsx: spring(1, 'bodyT', 0.0015), bsy: spring(1, 'bodyT', 0.0015),
  brot: spring(0, 'bodyT', 0.001), bx: spring(0, 'bodyT', 0.05), by: spring(0, 'bodyT', 0.05),
  fx: spring(0, 'face', 0.05), fy: spring(0, 'face', 0.05),
  frot: spring(0, 'face', 0.001), fs: spring(1, 'face', 0.0015),
  fspace: spring(1, 'face', 0.0015), fturn: spring(0, 'face', 0.0015), fpersp: spring(0.5, 'face', 0.002),
  gx: spring(0, 'gaze', 0.03), gy: spring(0, 'gaze', 0.03),
  eyeL: mkEyeSprings(), eyeR: mkEyeSprings(),
  m: {
    x: spring(0.5, 'mouth', 0.04), y: spring(22, 'mouth', 0.04),
    w: spring(11, 'mouth', 0.04), curve: spring(2.5, 'mouth', 0.02),
    open: spring(0, 'mouth', 0.003), rot: spring(0, 'mouth', 0.0015), op: spring(1, 'mouth', 0.004),
  },
  cheekL: spring(0, 'mouth', 0.004), cheekR: spring(0, 'mouth', 0.004),
  cheekS: spring(1, 'mouth', 0.002),
};

/* ---------------------------------------------------------------- state */
const state = {
  expression: 'neutral',
  faceExprId: 'neutral',       // face features may adopt later than the body (eye reaction delay)
  manual: { gazeX: 0, gazeY: 0, faceX: 0, faceY: 0, spacing: 0, size: 0, rot: 0, turn: 0, persp: 50 },
  motion: { speed: 0.9, softness: 60, bounce: 22, follow: 35, eyeDelay: 60 },
  toggles: { blink: false, pointer: false, breathe: false },
  personality: 'gentle',
  gateL: 1, gateR: 1,
  reduced: false,
};
const OVERLAY_ZERO = {
  bodySX: 0, bodySY: 0, bodyRot: 0, bodyX: 0, bodyY: 0,
  faceX: 0, faceY: 0, faceRot: 0,
  eyeL: 0, eyeR: 0, eyeLY: 1, eyeRY: 1, eyeRotL: 0, eyeRotR: 0,
  mouthOpen: 0, mouthCurve: 0, gazeX: 0, gazeY: 0,
};
let ov = { ...OVERLAY_ZERO };
const pointerGaze = { active: false, x: 0, y: 0 };

const spaceMul = v => 1 + v * 0.0018;   // slider -100..100 -> 0.82..1.18
const sizeMul = v => 1 + v * 0.0025;    // slider -100..100 -> 0.75..1.25

function tuneGroups() {
  const m = motionOverride || state.motion;
  const kMul = m.speed * m.speed * (1.18 - 0.5 * m.softness / 100);
  const zMul = 1.22 - 0.62 * m.bounce / 100;
  const followMul = 1.12 - 0.5 * m.follow / 100;
  for (const g in GROUPS) {
    let k = GROUPS[g].k * kMul;
    if (g === 'bodyT' || g === 'bodyPoint') k *= followMul;
    let d = GROUPS[g].d * Math.sqrt(k / GROUPS[g].k) * zMul;
    if (state.reduced) { k *= 1.35; d = Math.max(d, 2.1 * Math.sqrt(k)); }
    TUNED[g].k = k;
    TUNED[g].d = d;
  }
}

function setEyeTargets(E, def, addScale, mulY, addRot) {
  for (let j = 0; j < N_EYE; j++) {
    E.pts[j * 2].t = def.pts[j * 2] * EYE_W;
    E.pts[j * 2 + 1].t = def.pts[j * 2 + 1] * EYE_H;
  }
  E.x.t = def.x; E.y.t = def.y;
  E.sx.t = def.sx + addScale;
  E.sy.t = def.sy * mulY;
  E.rot.t = def.rot + addRot;
}

function applyTargets() {
  const ex = EXPR[state.expression];
  const ef = EXPR[state.faceExprId];
  const man = state.manual;
  for (let i = 0; i < N_BODY; i++) S.body[i].t = BODY_BASE_R[i];
  S.bsx.t = ex.body.sx + ov.bodySX;
  S.bsy.t = ex.body.sy + ov.bodySY;
  S.brot.t = ex.body.rot + ov.bodyRot;
  S.bx.t = ex.body.x + ov.bodyX;
  S.by.t = ex.body.y + ov.bodyY;
  S.fx.t = man.faceX * FACE_LIMIT_X + ov.faceX + perfOv.faceX;
  S.fy.t = man.faceY * FACE_LIMIT_Y + ov.faceY + perfOv.faceY;
  S.frot.t = man.rot * Math.PI / 180 + ov.faceRot;
  S.fs.t = sizeMul(man.size);
  S.fspace.t = spaceMul(man.spacing);
  S.fturn.t = man.turn / 100;
  S.fpersp.t = man.persp / 100;
  if (pointerGaze.active) {
    S.gx.t = pointerGaze.x + ov.gazeX + perfOv.gazeX;
    S.gy.t = pointerGaze.y + ov.gazeY + perfOv.gazeY;
  } else {
    S.gx.t = man.gazeX * GAZE_X + ef.gaze.x + ov.gazeX + perfOv.gazeX;
    S.gy.t = man.gazeY * GAZE_Y + ef.gaze.y + ov.gazeY + perfOv.gazeY;
  }
  setEyeTargets(S.eyeL, ef.eyeL, ov.eyeL, ov.eyeLY, ov.eyeRotL);
  setEyeTargets(S.eyeR, ef.eyeR, ov.eyeR, ov.eyeRY, ov.eyeRotR);
  S.m.x.t = ef.mouth.x; S.m.y.t = ef.mouth.y; S.m.w.t = ef.mouth.w;
  S.m.curve.t = ef.mouth.curve + ov.mouthCurve;
  S.m.open.t = clamp(ef.mouth.open + ov.mouthOpen, 0, 1);
  S.m.rot.t = ef.mouth.rot; S.m.op.t = ef.mouth.op;
  S.cheekL.t = ef.cheeks.op * state.gateL;
  S.cheekR.t = ef.cheeks.op * state.gateR;
  S.cheekS.t = ef.cheeks.scale;
}

/* ------------------------------------------------- entrance performances
   One-shot, time-based phase lists. Choosing a new expression replaces
   the whole timeline, so stale phases can never fire; springs keep their
   current positions and velocities, so interruptions never jump. */
let timeline = null;
function startTimeline(events) {
  events.sort((a, b) => a.t - b.t);
  timeline = { events, i: 0, elapsed: 0 };
}
function tickTimeline(dtMs) {
  if (!timeline) return;
  timeline.elapsed += dtMs;
  while (timeline.i < timeline.events.length && timeline.events[timeline.i].t <= timeline.elapsed) {
    timeline.events[timeline.i++].fn();
  }
  if (timeline.i >= timeline.events.length) timeline = null;
}
const mk = (t, patch) => ({ t, fn() { Object.assign(ov, patch); applyTargets(); } });
const adopt = t => ({ t, fn() { state.faceExprId = state.expression; applyTargets(); } });
const gate = (t, side) => ({ t, fn() { if (side < 0) state.gateL = 1; else state.gateR = 1; applyTargets(); } });
const fin = t => ({ t, fn() {
  ov = { ...OVERLAY_ZERO };
  state.gateL = state.gateR = 1;
  state.faceExprId = state.expression;
  applyTargets();
} });

const ENTRANCES = {
  gentle: (i, D) => [mk(0, { bodySY: -0.018 * i }), adopt(60 + D), mk(150, { bodySY: 0.006 * i }), fin(340)],
  squish: (i, D) => [mk(0, { bodySY: -0.075 * i, bodySX: 0.05 * i, bodyY: 3 * i }), adopt(70 + D),
    mk(170, { bodySY: 0.038 * i, bodyY: -2.5 * i }), fin(380)],
  laugh: (i, D) => [mk(0, { bodySY: -0.08 * i, bodySX: 0.055 * i, mouthOpen: 0.12 }), adopt(50 + D),
    mk(170, { bodySY: 0.05 * i, bodyY: -4 * i, mouthOpen: 0.5 }),
    mk(330, { bodySY: -0.035 * i, bodyY: 0, mouthOpen: 0.14 }),
    mk(480, { bodySY: 0.032 * i, bodyY: -2.5 * i, mouthOpen: 0.42 }),
    fin(680)],
  jump: (i, D) => [mk(0, { bodySY: -0.1 * i, bodySX: 0.07 * i, bodyY: 5 * i }),
    mk(150, { bodyY: -12 * i, bodySY: 0.085 * i, bodySX: -0.05 * i }), adopt(160 + D),
    mk(330, { bodyY: 2 * i, bodySY: -0.03 * i }), fin(520)],
  pop: (i, D) => [mk(0, { bodySY: -0.05 * i, bodySX: 0.035 * i, eyeLY: 0.35, eyeRY: 0.35 }),
    { t: 100, fn() {  // left eye opens first; the right follows ~50ms later
      state.faceExprId = state.expression;
      Object.assign(ov, { eyeLY: 1, bodySY: 0.09 * i, bodySX: -0.05 * i, bodyY: -4 * i });
      applyTargets();
    } },
    mk(150, { eyeRY: 1 }),
    mk(320, { bodySY: -0.025 * i, bodyY: 0 }),
    fin(500)],
  curious: (i, D) => [adopt(0), mk(0, { gazeX: 5 * i }),
    mk(110, { faceX: 9 * i, bodyRot: -0.055 * i, eyeL: 0.07 * i }),
    mk(320, { eyeL: 0.03 * i }), fin(560)],
  drowse: (i, D) => [mk(0, { faceY: 2 * i }), adopt(140 + D),
    mk(240, { faceY: 5 * i, bodySX: 0.045 * i, bodySY: -0.03 * i, bodyY: 3 * i }), fin(740)],
  shy: (i, D) => [{ t: 0, fn() {
      state.gateL = 0; state.gateR = 0;
      Object.assign(ov, { bodySX: -0.045 * i, bodySY: -0.02 * i, faceY: 3.5 * i });
      applyTargets();
    } },
    adopt(D), gate(150, -1), gate(215, 1), mk(280, { bodySX: -0.02 * i }), fin(540)],
  droop: (i, D) => [mk(0, { bodySY: -0.02 * i }), adopt(110 + D),
    mk(230, { faceY: 4 * i, bodyY: 3 * i, bodySY: -0.038 * i }), fin(620)],
  tense: (i, D) => [mk(0, { bodySY: -0.075 * i, bodySX: 0.05 * i }), adopt(55 + D),
    mk(180, { bodyX: 3 * i }), mk(240, { bodyX: -2.4 * i }),
    mk(300, { bodyX: 1.5 * i }), mk(360, { bodyX: -0.7 * i }), fin(500)],
};

function buildEntrance(ex) {
  const [type, intensity] = ex.entrance;
  return (ENTRANCES[type] || ENTRANCES.gentle)(intensity, activeMotion().eyeDelay);
}

function setExpression(id, opts = {}) {
  if (!EXPR[id]) return false;
  if (!opts.fromShow) cancelShow();
  state.expression = id;
  ov = { ...OVERLAY_ZERO };
  state.gateL = state.gateR = 1;
  if (state.reduced || opts.instant) {
    timeline = null;
    state.faceExprId = id;
    applyTargets();
    if (opts.instant) snapSprings();
  } else {
    startTimeline(buildEntrance(EXPR[id]));
    applyTargets();
  }
  updateExpressionUI();
  wake();
  return true;
}

/* ------------------------------------------------- performances
   One-shot handcrafted shows: a scripted sequence of expressions and
   gaze moves, each with its own temporary motion feel. Fully
   interruptible — picking any expression cancels the show — and every
   show ends by settling and holding its final expression. */
const perfOv = { gazeX: 0, gazeY: 0, faceX: 0, faceY: 0 };
let perfShow = null;
let motionOverride = null;
const activeMotion = () => motionOverride || state.motion;

function clearPerfOv() { perfOv.gazeX = perfOv.gazeY = perfOv.faceX = perfOv.faceY = 0; }
function cancelShow() {
  if (!perfShow && !motionOverride) return;
  perfShow = null;
  motionOverride = null;
  clearPerfOv();
  tuneGroups();
  applyTargets();
}
const sExpr = (t, id) => ({ t, fn() { setExpression(id, { fromShow: true }); } });
const sLook = (t, x, y) => ({ t, fn() { perfOv.gazeX = x; perfOv.gazeY = y; applyTargets(); } });
const sEnd = t => ({ t, fn() { clearPerfOv(); applyTargets(); } });

const PERFORMANCES = [
  { id: 'hello', label: 'Say hello', feel: 'bouncy', build: () => [
    sExpr(0, 'excited'), sLook(650, 4, -2), sExpr(1100, 'soft-happy'),
    sLook(1500, 0, 0), sExpr(2000, 'shy'), sEnd(2600),
  ] },
  { id: 'look-around', label: 'Look around', feel: 'gentle', build: () => [
    sExpr(0, 'curious'), sLook(450, -7, -1), sLook(1250, 7, -2), sLook(1950, 3, -5),
    sExpr(2600, 'surprised'), sLook(2650, 0, -2), sExpr(3700, 'neutral'), sEnd(3900),
  ] },
  { id: 'mood-swing', label: 'Mood swing', feel: 'snappy', build: () => [
    sExpr(0, 'soft-happy'), sExpr(850, 'surprised'), sExpr(1700, 'sad'),
    sExpr(2600, 'angry'), sExpr(3450, 'laughing'), sEnd(4300),
  ] },
  { id: 'party', label: 'Party bounce', feel: 'bouncy', build: () => [
    sExpr(0, 'laughing'), sExpr(750, 'excited'), sExpr(1500, 'surprised'),
    sExpr(2250, 'laughing'), sExpr(3000, 'excited'), sEnd(3800),
  ] },
  { id: 'nap', label: 'Drift to sleep', feel: 'gentle', build: () => [
    sExpr(0, 'neutral'), sLook(500, -3, 2), sExpr(1300, 'sleepy'), sEnd(3400),
  ] },
];

function startShow(p) {
  cancelShow();
  if (PRESETS[p.feel]) {
    motionOverride = PRESETS[p.feel];
    tuneGroups();
  }
  perfShow = { events: p.build().sort((a, b) => a.t - b.t), i: 0, elapsed: 0 };
  wake();
}
function tickShow(dtMs) {
  if (!perfShow) return;
  perfShow.elapsed += dtMs;
  while (perfShow.i < perfShow.events.length && perfShow.events[perfShow.i].t <= perfShow.elapsed) {
    perfShow.events[perfShow.i++].fn();
  }
  if (perfShow && perfShow.i >= perfShow.events.length) {
    perfShow = null;
    motionOverride = null;
    tuneGroups();
  }
}

/* ---------------------------------------------------------------- blink */
const BLINK_DUR = 270;
let blinkT = -1;
function blinkFactor() {
  if (blinkT < 0) return 0;
  if (blinkT < 90) return ss(blinkT / 90);
  if (blinkT < 135) return 1;
  return 1 - ss((blinkT - 135) / (BLINK_DUR - 135));
}
function triggerBlink() { blinkT = 0; wake(); }

/* ---------------------------------------------------------------- ambient */
let nextBlinkAt = 0;
let blinkTimer = 0;
let breatheAmp = 0;
let breathePhase = 0;
function scheduleNaturalBlink(now) { nextBlinkAt = now + 2400 + Math.random() * 4200; }
function armBlinkTimer() {
  clearTimeout(blinkTimer);
  if (!state.toggles.blink) return;
  const delay = Math.max(60, nextBlinkAt - performance.now());
  blinkTimer = setTimeout(() => {
    if (state.toggles.blink && !running) {
      blinkT = 0;
      scheduleNaturalBlink(performance.now());
      wake();
    }
  }, delay);
}

/* ---------------------------------------------------- render lifecycle
   Frames are requested only while something is actually moving; when all
   springs settle and no ambient behaviour is on, the loop stops. */
let running = false;
let rafId = 0;
let lastTs = null;

function isActive() {
  if (timeline || perfShow || blinkT >= 0) return true;
  if (state.toggles.breathe && !state.reduced) return true;
  if (breatheAmp > 1e-4) return true;
  return !springsSettled();
}

function wake() {
  clearTimeout(blinkTimer);
  if (document.hidden) return;
  if (!running) {
    running = true;
    lastTs = null;
    rafId = requestAnimationFrame(tick);
    setStatus(true);
  }
}

function settle() {
  running = false;
  snapSprings();
  render();
  setStatus(false);
  armBlinkTimer();
}

function tick(ts) {
  if (!running) return;
  if (lastTs === null) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  const dtMs = dt * 1000;

  const speed = activeMotion().speed;
  tickShow(dtMs * speed);
  tickTimeline(dtMs * speed);
  if (blinkT >= 0) {
    blinkT += dtMs;
    if (blinkT > BLINK_DUR) blinkT = -1;
  }
  if (state.toggles.blink && ts >= nextBlinkAt) {
    if (blinkT < 0) blinkT = 0;
    scheduleNaturalBlink(ts);
  }
  const breatheTarget = (state.toggles.breathe && !state.reduced) ? 0.009 : 0;
  breatheAmp += (breatheTarget - breatheAmp) * Math.min(1, dt * 5);
  if (breatheAmp > 1e-5) breathePhase += dt * 1.6;

  stepSprings(dt);
  render();

  if (isActive()) rafId = requestAnimationFrame(tick);
  else settle();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    running = false;
    lastTs = null;
    clearTimeout(blinkTimer);
  } else {
    if (state.toggles.blink) scheduleNaturalBlink(performance.now());
    if (isActive()) wake();
    else { render(); armBlinkTimer(); }
  }
});

/* ---------------------------------------------------------------- drawing */
const BX_ = new Float64Array(N_BODY), BY_ = new Float64Array(N_BODY);
const EXX = new Float64Array(N_EYE), EYY = new Float64Array(N_EYE);

// Catmull-Rom through the points, emitted as cubic Béziers: smooth, closed,
// join-free curve for both the body silhouette and the eye shapes.
function smoothClosedPath(ctx, xs, ys, n) {
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 0; i < n; i++) {
    const p0 = (i - 1 + n) % n, p1 = i, p2 = (i + 1) % n, p3 = (i + 2) % n;
    ctx.bezierCurveTo(
      xs[p1] + (xs[p2] - xs[p0]) / 6, ys[p1] + (ys[p2] - ys[p0]) / 6,
      xs[p2] - (xs[p3] - xs[p1]) / 6, ys[p2] - (ys[p3] - ys[p1]) / 6,
      xs[p2], ys[p2]);
  }
  ctx.closePath();
}

function drawEye(ctx, v, e, side) {
  const near = Math.max(0.2, 1 - side * v.turn * 0.11 * v.persp);
  ctx.save();
  ctx.translate(e.x * v.spaceEff + v.gx, e.y + v.gy);
  ctx.rotate(e.rot);
  ctx.scale(Math.max(0.05, e.sx * near), Math.max(0.05, e.sy * near));
  const f = v.blink;
  for (let i = 0; i < N_EYE; i++) {
    EXX[i] = e.pts[i * 2];
    let y = e.pts[i * 2 + 1];
    if (f > 0) y = y * (1 - 0.9 * f) + EYE_H * 0.16 * f;
    EYY[i] = y;
  }
  ctx.beginPath();
  smoothClosedPath(ctx, EXX, EYY, N_EYE);
  ctx.fillStyle = COLORS.feature;
  ctx.fill();
  ctx.restore();
}

function drawMouth(ctx, v) {
  const m = v.m;
  if (m.op <= 0.02) return;
  const h = 2.6 + clamp(m.open, 0, 1) * 13;
  ctx.save();
  ctx.translate(m.x + v.gx * 0.55, m.y + v.gy * 0.6);
  ctx.rotate(m.rot);
  ctx.globalAlpha = clamp(m.op, 0, 1);
  ctx.fillStyle = COLORS.feature;
  ctx.beginPath();
  ctx.moveTo(-m.w / 2, 0);
  ctx.quadraticCurveTo(0, m.curve * 2, m.w / 2, 0);
  ctx.quadraticCurveTo(0, m.curve * 2 + h * 2, -m.w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCheek(ctx, v, side) {
  const op = side < 0 ? v.cheekL : v.cheekR;
  if (op <= 0.01) return;
  const near = Math.max(0.2, 1 - side * v.turn * 0.11 * v.persp);
  ctx.save();
  ctx.globalAlpha = clamp(op, 0, 1);
  ctx.fillStyle = COLORS.cheek;
  ctx.beginPath();
  ctx.ellipse(side * 38 * v.spaceEff + v.gx * 0.4, 15 + v.gy * 0.5,
    7.4 * v.cheekS * near, 6.2 * v.cheekS * near, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPuff(ctx, v) {
  ctx.save();
  ctx.translate(v.cx + v.bx, v.cy + v.by);
  ctx.rotate(v.brot);
  ctx.scale(v.bsx * (1 + v.breathe * 0.45), v.bsy * (1 + v.breathe));
  for (let i = 0; i < N_BODY; i++) {
    BX_[i] = BODY_DIR_X[i] * v.radii[i];
    BY_[i] = BODY_DIR_Y[i] * v.radii[i];
  }
  ctx.beginPath();
  smoothClosedPath(ctx, BX_, BY_, N_BODY);
  ctx.fillStyle = COLORS.body;
  ctx.fill();

  // face group, clamped to an elliptical region so features never leave the body
  let tx = v.fx + v.turn * 14, ty = v.fy;
  const q = (tx / FACE_LIMIT_X) ** 2 + (ty / FACE_LIMIT_Y) ** 2;
  if (q > 1) { const f = 1 / Math.sqrt(q); tx *= f; ty *= f; }
  ctx.translate(tx, ty);
  ctx.rotate(v.frot);
  ctx.scale(v.fs, v.fs);
  v.spaceEff = v.space * (1 - Math.abs(v.turn) * 0.10 * v.persp);
  drawCheek(ctx, v, -1);
  drawCheek(ctx, v, 1);
  drawMouth(ctx, v);
  drawEye(ctx, v, v.eyeL, -1);
  drawEye(ctx, v, v.eyeR, 1);
  ctx.restore();
}

/* live view: reused buffers, no per-frame allocation */
const LIVE = {
  cx: CX, cy: CY, radii: new Float64Array(N_BODY),
  bx: 0, by: 0, brot: 0, bsx: 1, bsy: 1, breathe: 0,
  fx: 0, fy: 0, frot: 0, fs: 1, space: 1, spaceEff: 1, turn: 0, persp: 0.5,
  gx: 0, gy: 0, blink: 0,
  eyeL: { pts: new Float64Array(N_EYE * 2), x: -26, y: -5, sx: 1, sy: 1, rot: 0 },
  eyeR: { pts: new Float64Array(N_EYE * 2), x: 26, y: -5, sx: 1, sy: 1, rot: 0 },
  m: { x: 0, y: 22, w: 11, curve: 2.5, open: 0, rot: 0, op: 1 },
  cheekL: 0, cheekR: 0, cheekS: 1,
};

function buildLiveView() {
  for (let i = 0; i < N_BODY; i++) LIVE.radii[i] = S.body[i].c;
  LIVE.bx = S.bx.c; LIVE.by = S.by.c; LIVE.brot = S.brot.c;
  LIVE.bsx = S.bsx.c; LIVE.bsy = S.bsy.c;
  LIVE.breathe = breatheAmp > 1e-5 ? breatheAmp * Math.sin(breathePhase) : 0;
  LIVE.fx = S.fx.c; LIVE.fy = S.fy.c; LIVE.frot = S.frot.c; LIVE.fs = S.fs.c;
  LIVE.space = S.fspace.c; LIVE.turn = S.fturn.c; LIVE.persp = S.fpersp.c;
  LIVE.gx = S.gx.c; LIVE.gy = S.gy.c;
  LIVE.blink = blinkFactor();
  for (const [E, T] of [[S.eyeL, LIVE.eyeL], [S.eyeR, LIVE.eyeR]]) {
    for (let j = 0; j < N_EYE * 2; j++) T.pts[j] = E.pts[j].c;
    T.x = E.x.c; T.y = E.y.c; T.sx = E.sx.c; T.sy = E.sy.c; T.rot = E.rot.c;
  }
  LIVE.m.x = S.m.x.c; LIVE.m.y = S.m.y.c; LIVE.m.w = S.m.w.c;
  LIVE.m.curve = S.m.curve.c; LIVE.m.open = S.m.open.c;
  LIVE.m.rot = S.m.rot.c; LIVE.m.op = S.m.op.c;
  LIVE.cheekL = S.cheekL.c; LIVE.cheekR = S.cheekR.c; LIVE.cheekS = S.cheekS.c;
}

function eyeViewOf(d) {
  const pts = new Float64Array(N_EYE * 2);
  for (let j = 0; j < N_EYE; j++) {
    pts[j * 2] = d.pts[j * 2] * EYE_W;
    pts[j * 2 + 1] = d.pts[j * 2 + 1] * EYE_H;
  }
  return { pts, x: d.x, y: d.y, sx: d.sx, sy: d.sy, rot: d.rot };
}

function exprView(ex) {
  return {
    cx: 0, cy: 0, radii: BODY_BASE_R,
    bx: ex.body.x, by: ex.body.y, brot: ex.body.rot, bsx: ex.body.sx, bsy: ex.body.sy, breathe: 0,
    fx: 0, fy: 0, frot: 0, fs: 1, space: 1, spaceEff: 1, turn: 0, persp: 0.5,
    gx: ex.gaze.x, gy: ex.gaze.y, blink: 0,
    eyeL: eyeViewOf(ex.eyeL), eyeR: eyeViewOf(ex.eyeR),
    m: { ...ex.mouth },
    cheekL: ex.cheeks.op, cheekR: ex.cheeks.op, cheekS: ex.cheeks.scale,
  };
}

/* ---------------------------------------------------------------- canvas */
const canvas = document.getElementById('puffCanvas');
const ctx = canvas.getContext('2d');
const stageEl = document.getElementById('stage');
let drawScale = 1;
let cssSize = 1;

function render() {
  ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
  ctx.clearRect(0, 0, VIEW, VIEW);
  buildLiveView();
  drawPuff(ctx, LIVE);
}

function sizeCanvas() {
  const r = stageEl.getBoundingClientRect();
  const size = Math.max(120, Math.min(r.width, r.height));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  const px = Math.max(1, Math.round(size * dpr));
  if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
  drawScale = px / VIEW;
  cssSize = size;
  render();
}
new ResizeObserver(sizeCanvas).observe(stageEl);

/* ---------------------------------------------------------------- UI */
const $ = id => document.getElementById(id);
const pillEl = $('expressionPill');
const statusDot = $('statusDot');
const statusText = $('statusText');

function setStatus(animating) {
  statusText.textContent = animating ? 'Animating' : 'Ready';
  statusDot.classList.toggle('is-animating', animating);
}

const cardEls = {};
function updateExpressionUI() {
  pillEl.textContent = EXPR[state.expression].label;
  for (const id in cardEls) {
    const sel = id === state.expression;
    cardEls[id].classList.toggle('is-selected', sel);
    cardEls[id].setAttribute('aria-pressed', String(sel));
  }
}

/* expression cards, thumbnails pre-rendered once with the real renderer */
function buildExpressionGrid() {
  const grid = $('exprGrid');
  const dpr = window.devicePixelRatio || 1;
  for (const id of EXPR_ORDER) {
    const ex = EXPR[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'expr-card';
    btn.dataset.category = ex.category;
    btn.setAttribute('aria-pressed', 'false');
    const thumb = document.createElement('canvas');
    thumb.className = 'expr-thumb';
    thumb.width = Math.round(96 * dpr);
    thumb.height = Math.round(64 * dpr);
    thumb.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'expr-name';
    name.textContent = ex.label;
    btn.append(thumb, name);
    const tctx = thumb.getContext('2d');
    const sc = 0.215 * dpr;
    tctx.setTransform(sc, 0, 0, sc, 48 * dpr, 35 * dpr);
    drawPuff(tctx, exprView(ex));
    btn.addEventListener('click', () => setExpression(id));
    grid.appendChild(btn);
    cardEls[id] = btn;
  }
}

function buildPerformances() {
  const row = $('performRow');
  for (const p of PERFORMANCES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'perform-btn';
    btn.textContent = p.label;
    btn.addEventListener('click', () => startShow(p));
    row.appendChild(btn);
  }
}

function buildFilterChips() {
  const wrap = $('filterChips');
  const grid = $('exprGrid');
  for (const [key, label] of CATEGORIES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.setAttribute('aria-pressed', String(key === 'all'));
    chip.addEventListener('click', () => {
      for (const c of wrap.children) c.setAttribute('aria-pressed', 'false');
      chip.setAttribute('aria-pressed', 'true');
      for (const card of grid.children) {
        card.hidden = key !== 'all' && card.dataset.category !== key;
      }
    });
    wrap.appendChild(chip);
  }
}

/* tabs */
function setupTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function select(tab) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    }
    tab.focus();
  }
  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      let to = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (idx + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = tabs.length - 1;
      if (to >= 0) { e.preventDefault(); select(tabs[to]); }
    });
  });
}

/* sliders */
const sliderDefs = [
  { id: 'sliderFaceX', get: () => state.manual.faceX * 100, set: v => { state.manual.faceX = v / 100; },
    fmt: v => v === 0 ? 'Centered' : (v > 0 ? `Right ${v}%` : `Left ${-v}%`) },
  { id: 'sliderFaceY', get: () => state.manual.faceY * 100, set: v => { state.manual.faceY = v / 100; },
    fmt: v => v === 0 ? 'Centered' : (v > 0 ? `Down ${v}%` : `Up ${-v}%`) },
  { id: 'sliderSpacing', get: () => state.manual.spacing, set: v => { state.manual.spacing = v; },
    fmt: v => v === 0 ? 'Normal' : (v > 0 ? `+${v}` : `${v}`) },
  { id: 'sliderSize', get: () => state.manual.size, set: v => { state.manual.size = v; },
    fmt: v => v === 0 ? 'Normal' : (v > 0 ? `+${v}` : `${v}`) },
  { id: 'sliderRotate', get: () => state.manual.rot, set: v => { state.manual.rot = v; },
    fmt: v => `${v > 0 ? '+' : ''}${v}°` },
  { id: 'sliderTurn', get: () => state.manual.turn, set: v => { state.manual.turn = v; },
    fmt: v => v === 0 ? 'Facing you' : (v > 0 ? `Right ${v}%` : `Left ${-v}%`) },
  { id: 'sliderPersp', get: () => state.manual.persp, set: v => { state.manual.persp = v; },
    fmt: v => `${v}%` },
  { id: 'sliderSpeed', get: () => Math.round(state.motion.speed * 100), set: v => { state.motion.speed = v / 100; }, motion: true,
    fmt: v => `${(v / 100).toFixed(2)}×` },
  { id: 'sliderSoftness', get: () => state.motion.softness, set: v => { state.motion.softness = v; }, motion: true,
    fmt: v => `${v}` },
  { id: 'sliderBounce', get: () => state.motion.bounce, set: v => { state.motion.bounce = v; }, motion: true,
    fmt: v => `${v}` },
  { id: 'sliderFollow', get: () => state.motion.follow, set: v => { state.motion.follow = v; }, motion: true,
    fmt: v => `${v}` },
  { id: 'sliderDelay', get: () => state.motion.eyeDelay, set: v => { state.motion.eyeDelay = v; }, motion: true,
    fmt: v => `${v} ms` },
];

function syncSlider(def) {
  const input = $(def.id);
  const val = Math.round(def.get());
  input.value = val;
  $(def.id + 'Val').textContent = def.fmt(val);
}

function syncAllSliders() { sliderDefs.forEach(syncSlider); }

function setupSliders() {
  for (const def of sliderDefs) {
    const input = $(def.id);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      def.set(v);
      $(def.id + 'Val').textContent = def.fmt(v);
      if (def.motion) {
        state.personality = null;
        syncPersonalityUI();
        tuneGroups();
      }
      applyTargets();
      wake();
    });
    syncSlider(def);
  }
}

/* gaze pad */
const pad = $('gazePad');
const padDot = pad.querySelector('.gaze-dot');
function syncPad() {
  padDot.style.left = `${50 + state.manual.gazeX * 38}%`;
  padDot.style.top = `${50 + state.manual.gazeY * 38}%`;
  const gx = Math.round(state.manual.gazeX * 100);
  const gy = Math.round(state.manual.gazeY * 100);
  pad.setAttribute('aria-valuetext',
    gx === 0 && gy === 0 ? 'Centered'
      : `${gx === 0 ? '' : gx > 0 ? `right ${gx}%` : `left ${-gx}%`} ${gy === 0 ? '' : gy > 0 ? `down ${gy}%` : `up ${-gy}%`}`.trim());
}
function setGazeFrom(x, y) {
  state.manual.gazeX = clamp(x, -1, 1);
  state.manual.gazeY = clamp(y, -1, 1);
  syncPad();
  applyTargets();
  wake();
}
function setupGazePad() {
  let dragging = false;
  const fromEvent = e => {
    const r = pad.getBoundingClientRect();
    setGazeFrom(((e.clientX - r.left) / r.width - 0.5) / 0.38 * 0.5 * 2,
      ((e.clientY - r.top) / r.height - 0.5) / 0.38 * 0.5 * 2);
  };
  pad.addEventListener('pointerdown', e => {
    dragging = true;
    pad.setPointerCapture(e.pointerId);
    fromEvent(e);
  });
  pad.addEventListener('pointermove', e => { if (dragging) fromEvent(e); });
  pad.addEventListener('pointerup', () => { dragging = false; });
  pad.addEventListener('pointercancel', () => { dragging = false; });
  pad.addEventListener('dblclick', () => setGazeFrom(0, 0));
  pad.addEventListener('keydown', e => {
    const step = 0.1;
    const m = state.manual;
    if (e.key === 'ArrowLeft') setGazeFrom(m.gazeX - step, m.gazeY);
    else if (e.key === 'ArrowRight') setGazeFrom(m.gazeX + step, m.gazeY);
    else if (e.key === 'ArrowUp') setGazeFrom(m.gazeX, m.gazeY - step);
    else if (e.key === 'ArrowDown') setGazeFrom(m.gazeX, m.gazeY + step);
    else if (e.key === 'Home') setGazeFrom(0, 0);
    else return;
    e.preventDefault();
  });
  $('gazeCenterBtn').addEventListener('click', () => setGazeFrom(0, 0));
}

/* motion personality */
const PRESETS = {
  gentle: { speed: 0.9, softness: 60, bounce: 22, follow: 35, eyeDelay: 60 },
  bouncy: { speed: 1.0, softness: 45, bounce: 80, follow: 65, eyeDelay: 80 },
  snappy: { speed: 1.35, softness: 18, bounce: 30, follow: 18, eyeDelay: 15 },
};
function syncPersonalityUI() {
  for (const btn of document.querySelectorAll('.seg-btn')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.personality === state.personality));
  }
}
function applyPersonality(name) {
  state.personality = name;
  Object.assign(state.motion, PRESETS[name]);
  tuneGroups();
  syncAllSliders();
  syncPersonalityUI();
  applyTargets();
  wake();
}
function setupPersonality() {
  for (const btn of document.querySelectorAll('.seg-btn')) {
    btn.addEventListener('click', () => applyPersonality(btn.dataset.personality));
  }
}

/* optional life toggles */
function setupToggles() {
  $('togBlink').addEventListener('change', e => {
    state.toggles.blink = e.target.checked;
    if (state.toggles.blink) {
      scheduleNaturalBlink(performance.now());
      if (running) return;
      armBlinkTimer();
    } else {
      clearTimeout(blinkTimer);
    }
  });
  $('togPointer').addEventListener('change', e => {
    state.toggles.pointer = e.target.checked;
    if (!state.toggles.pointer && pointerGaze.active) {
      pointerGaze.active = false;
      applyTargets();
      wake();
    }
  });
  $('togBreathe').addEventListener('change', e => {
    state.toggles.breathe = e.target.checked;
    wake();
  });
}

function setupPointerGaze() {
  const move = e => {
    if (!state.toggles.pointer) return;
    const lx = e.offsetX / cssSize * VIEW;
    const ly = e.offsetY / cssSize * VIEW;
    pointerGaze.active = true;
    pointerGaze.x = clamp((lx - CX) / 150, -1, 1) * GAZE_X;
    pointerGaze.y = clamp((ly - CY) / 150, -1, 1) * GAZE_Y;
    applyTargets();
    wake();
  };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerenter', move);
  canvas.addEventListener('pointerleave', () => {
    if (pointerGaze.active) {
      pointerGaze.active = false;
      applyTargets();
      wake();
    }
  });
}

/* resets */
function resetFaceControls() {
  Object.assign(state.manual, { gazeX: 0, gazeY: 0, faceX: 0, faceY: 0, spacing: 0, size: 0, rot: 0, turn: 0, persp: 50 });
  syncAllSliders();
  syncPad();
  applyTargets();
  wake();
}
function recenter() {
  Object.assign(state.manual, { gazeX: 0, gazeY: 0, faceX: 0, faceY: 0, rot: 0, turn: 0 });
  syncAllSliders();
  syncPad();
  applyTargets();
  wake();
}
function resetPose() {
  resetFaceControls();
  setExpression('neutral');
}
function resetMotion() {
  cancelShow();
  applyPersonality('gentle');
  for (const [id, key] of [['togBlink', 'blink'], ['togPointer', 'pointer'], ['togBreathe', 'breathe']]) {
    $(id).checked = false;
    state.toggles[key] = false;
  }
  clearTimeout(blinkTimer);
  if (pointerGaze.active) { pointerGaze.active = false; applyTargets(); }
  wake();
}
function resetAll() {
  resetMotion();
  resetPose();
}

function setupActions() {
  $('actBlink').addEventListener('click', triggerBlink);
  $('actRecenter').addEventListener('click', recenter);
  $('actResetPose').addEventListener('click', resetPose);
  $('resetFaceBtn').addEventListener('click', resetFaceControls);
  $('resetMotionBtn').addEventListener('click', resetMotion);
  $('resetAllBtn').addEventListener('click', resetAll);
}

/* reduced motion */
function setupReducedMotion() {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => {
    state.reduced = mq.matches;
    if (state.reduced && state.toggles.breathe) {
      $('togBreathe').checked = false;
      state.toggles.breathe = false;
    }
    $('togBreathe').disabled = state.reduced;
    tuneGroups();
  };
  mq.addEventListener('change', apply);
  apply();
}

/* header mark */
function drawBrandMark() {
  const c = $('brandMark');
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(36 * dpr);
  c.height = Math.round(36 * dpr);
  const bctx = c.getContext('2d');
  const sc = 0.122 * dpr;
  bctx.setTransform(sc, 0, 0, sc, 18 * dpr, 19 * dpr);
  drawPuff(bctx, exprView(EXPR['soft-happy']));
}

/* ---------------------------------------------------------------- public API */
function normalizeId(name) {
  if (EXPR[name]) return name;
  const n = String(name).toLowerCase().replace(/[^a-z]/g, '');
  for (const id of EXPR_ORDER) {
    if (id.replace(/[^a-z]/g, '') === n || EXPR[id].label.toLowerCase().replace(/[^a-z]/g, '') === n) return id;
  }
  return null;
}
window.lavenderPuff = {
  setExpression(name) {
    const id = normalizeId(name);
    return id ? setExpression(id) : false;
  },
  setGaze(x, y) { setGazeFrom(x, y); },
  setFacePosition(x, y) {
    state.manual.faceX = clamp(x, -1, 1);
    state.manual.faceY = clamp(y, -1, 1);
    syncAllSliders(); applyTargets(); wake();
  },
  setFaceRotation(deg) {
    state.manual.rot = clamp(deg, -20, 20);
    syncAllSliders(); applyTargets(); wake();
  },
  setHeadTurn(v) {
    state.manual.turn = clamp(v, -1, 1) * 100;
    syncAllSliders(); applyTargets(); wake();
  },
  blink: triggerBlink,
  reset: resetAll,
  play(name) {
    const p = PERFORMANCES.find(x => x.id === name || x.label.toLowerCase() === String(name).toLowerCase());
    if (!p) return false;
    startShow(p);
    return true;
  },
  listPerformances: () => PERFORMANCES.map(p => ({ id: p.id, label: p.label })),
  listExpressions: () => EXPR_ORDER.map(id => ({ id, label: EXPR[id].label, category: EXPR[id].category })),
  getConfig: () => ({
    expression: state.expression,
    manual: { ...state.manual },
    motion: { ...state.motion },
    toggles: { ...state.toggles },
    personality: state.personality,
  }),
};

/* ---------------------------------------------------------------- init */
buildExpressionGrid();
buildPerformances();
buildFilterChips();
setupTabs();
setupSliders();
setupGazePad();
setupPersonality();
setupToggles();
setupPointerGaze();
setupActions();
setupReducedMotion();
drawBrandMark();
tuneGroups();
applyTargets();
snapSprings();
updateExpressionUI();
syncPad();
sizeCanvas();
setStatus(false);
})();
