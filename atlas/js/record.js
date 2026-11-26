// Record glyphs: a song's lyric as one spiral groove, and the 68-groove chart record.
import { FEELINGS, FEELING, COLORS } from "./core.js";

const TAU = Math.PI * 2;
const NS = "http://www.w3.org/2000/svg";
const cache = new Map();

// Archimedean spiral from the outer edge inward, starting at 12 o'clock, clockwise.
// Points carry cumulative arc length so lyric position maps to equal groove length.
export function spiral(rOut, rIn, turns, perTurn = 96) {
  const key = `${rOut}|${rIn}|${turns}|${perTurn}`;
  if (cache.has(key)) return cache.get(key);
  const n = Math.ceil(turns * perTurn);
  const pts = new Float64Array((n + 1) * 3);
  let len = 0, px = 0, py = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * TAU * turns, r = rOut - (rOut - rIn) * t;
    const x = r * Math.sin(a), y = -r * Math.cos(a);
    if (i) len += Math.hypot(x - px, y - py);
    pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = len;
    px = x; py = y;
  }
  const s = { pts, n, total: len };
  cache.set(key, s);
  return s;
}

function locate(s, d) {
  let lo = 0, hi = s.n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s.pts[mid * 3 + 2] < d) lo = mid; else hi = mid;
  }
  const l0 = s.pts[lo * 3 + 2], l1 = s.pts[hi * 3 + 2];
  const f = l1 > l0 ? Math.min(1, Math.max(0, (d - l0) / (l1 - l0))) : 0;
  const x = s.pts[lo * 3] + (s.pts[hi * 3] - s.pts[lo * 3]) * f;
  const y = s.pts[lo * 3 + 1] + (s.pts[hi * 3 + 1] - s.pts[lo * 3 + 1]) * f;
  return { x, y, lo, hi };
}

export function spiralPath(s, p0, p1) {
  const a = locate(s, p0 * s.total), b = locate(s, p1 * s.total);
  let d = `M${a.x.toFixed(2)},${a.y.toFixed(2)}`;
  for (let i = a.hi; i <= b.lo; i++) d += `L${s.pts[i * 3].toFixed(2)},${s.pts[i * 3 + 1].toFixed(2)}`;
  return `${d}L${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

export function spiralPoint(s, p) {
  const a = locate(s, p * s.total);
  const ahead = locate(s, Math.min(s.total, p * s.total + 0.5));
  return { x: a.x, y: a.y, angle: Math.atan2(ahead.y - a.y, ahead.x - a.x) };
}

function node(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}

const SIZES = {
  // r: disc radius, out/in: groove band, turns, w: groove width, label: label radius
  small: { r: 48, out: 44.5, in: 21.5, turns: 5, w: 3.5, label: 18 },
  legend: { r: 48, out: 44.5, in: 21.5, turns: 5, w: 3.5, label: 18 },
  large: { r: 196, out: 186, in: 80, turns: 8, w: 10.5, label: 70 },
};

// Draws one song record centred at (0,0) into `g` (an SVG <g>).
export function drawSongRecord(g, song, { size = "small", rank = null, focus = null, year = null, est = false } = {}) {
  const S = SIZES[size];
  g.replaceChildren();
  node("circle", { r: S.r, fill: COLORS.vinyl, class: "disc" }, g);
  if (size === "large") node("circle", { r: S.r - 3, fill: "none", stroke: COLORS.vinyl2, "stroke-width": 2 }, g);
  const sp = spiral(S.out, S.in, S.turns);
  const grooves = node("g", { class: "grooves", fill: "none", "stroke-width": S.w, "stroke-linecap": "butt" }, g);
  if (song.segments) {
    for (const seg of song.segments) {
      const color = FEELING[seg.cat].color;
      const path = node("path", { d: spiralPath(sp, seg.start, seg.end), stroke: color, "data-cat": seg.cat, "data-i": seg.i }, grooves);
      if (focus && seg.cat !== focus) path.setAttribute("opacity", 0.16);
    }
    if (size === "large") {
      const marks = node("g", { class: "marks" }, g);
      for (const seg of song.segments) {
        if (seg.sarcasm) node("path", { d: spiralPath(sp, seg.start, seg.end), fill: "none", stroke: COLORS.paper, "stroke-width": 2.6, "stroke-dasharray": "1.2 5", "stroke-linecap": "round" }, marks);
        if (seg.label || seg.i === 0) {
          const p = spiralPoint(sp, seg.start);
          const nx = -Math.sin(p.angle), ny = Math.cos(p.angle);
          const h = S.w * 0.9;
          node("line", { x1: p.x - nx * h, y1: p.y - ny * h, x2: p.x + nx * h, y2: p.y + ny * h, stroke: COLORS.paper, "stroke-width": 2.2 }, marks);
        }
      }
    }
  } else {
    node("path", { d: spiralPath(sp, 0, 1), stroke: COLORS.grooveEmpty }, grooves);
  }
  node("circle", { r: S.label, fill: COLORS.label, class: "label" }, g);
  if (size === "large") {
    node("circle", { r: 4, fill: COLORS.vinyl }, g);
    // Text sits above and below the spindle hole at the centre.
    const t1 = node("text", { y: -46, "text-anchor": "middle", class: "lbl-small" }, g);
    t1.textContent = "HIT ATLAS";
    if (rank != null) {
      const half = String(rank).length * 9.5;
      const no = node("text", { x: -half - 5, y: -14, "text-anchor": "end", class: "lbl-small" }, g);
      no.textContent = "NO.";
      const t2 = node("text", { x: 0, y: -12, "text-anchor": "middle", class: "lbl-rank" }, g);
      t2.textContent = String(rank);
    }
    const t3 = node("text", { y: 30, "text-anchor": "middle", class: "lbl-small" }, g);
    t3.textContent = year == null ? "" : (est ? `${year} · ESTIMATE` : `YEAR-END ${year}`);
  } else if (rank != null) {
    const t = node("text", { class: "rec-num", "font-size": rank >= 100 ? 15 : 18.5 }, g);
    t.textContent = rank;
  }
  return g;
}

// ── The chart record: 68 grooves, outer edge 1959 → label 2026 (estimate) ─────
// Arc order clockwise from 12 o'clock: love, sadness, other, insufficient, anger, joy.
// Love is anchored clockwise from the top and joy counter-clockwise, so both read
// against the same 12 o'clock baseline in every groove.
const ARC_ORDER = [0, 2, 4, 5, 3, 1];

export function createHeroRecord(svg, years) {
  const cx = 320, cy = 320, R = 300, rData = 291, rLabel = 104;
  const w = (rData - rLabel - 6) / years.length;
  svg.replaceChildren();
  const root = node("g", { transform: `translate(${cx},${cy})` }, svg);
  node("circle", { r: R, fill: COLORS.vinyl, class: "rim" }, root);
  node("circle", { r: R - 4, fill: "none", stroke: COLORS.vinyl2, "stroke-width": 3 }, root);

  const arc = d3.arc();
  const rings = node("g", { class: "rings" }, root);
  const arcs = [];
  years.forEach((y, i) => {
    const outer = rData - i * w, inner = outer - w + 0.75;
    let a = 0;
    for (const k of ARC_ORDER) {
      const share = y.shares[k] / 100;
      if (share <= 0) continue;
      const a1 = a + share * TAU;
      const path = node("path", {
        d: arc({ innerRadius: inner, outerRadius: outer, startAngle: a, endAngle: a1 }),
        fill: FEELINGS[k].color,
      }, rings);
      arcs.push({ path, i, key: FEELINGS[k].key, est: y.est });
      a = a1;
    }
    if (y.est) node("circle", { r: (outer + inner) / 2, fill: "none", stroke: COLORS.paper, "stroke-width": 0.8, "stroke-dasharray": "2 3", opacity: 0.8 }, rings);
  });
  const hover = node("circle", { fill: "none", stroke: COLORS.paper, "stroke-width": 1.4, opacity: 0, class: "hover-ring" }, root);

  // Label
  node("circle", { r: rLabel - 8, fill: COLORS.label }, root);
  node("circle", { r: rLabel - 14, fill: "none", stroke: "#d8cbb0", "stroke-width": 1 }, root);
  node("circle", { r: 5, fill: COLORS.vinyl }, root);
  const lt = (y, text, cls) => { const t = node("text", { y, "text-anchor": "middle", class: cls }, root); t.textContent = text; };
  lt(-44, "HIT ATLAS", "hl-brand");
  lt(-26, "BILLBOARD YEAR-END HOT 100", "hl-small");
  lt(30, `${years[0].year} · outer edge`, "hl-small");
  lt(46, `${years.at(-1).year} est. · centre`, "hl-small");
  lt(68, "33⅓", "hl-brand-small");

  // Tonearm
  const P = { x: 286, y: -286 }, L = 340, d = Math.hypot(P.x, P.y);
  const arm = node("g", { class: "tonearm" }, root);
  node("circle", { cx: P.x, cy: P.y, r: 22, fill: "#2b2722" }, arm);
  node("circle", { cx: P.x, cy: P.y, r: 13, fill: "#d9d0c0", stroke: COLORS.ink, "stroke-width": 1.5 }, arm);
  const shaftBack = node("line", { stroke: COLORS.ink, "stroke-width": 6, "stroke-linecap": "round" }, arm);
  const shaft = node("line", { stroke: "#d9d0c0", "stroke-width": 3, "stroke-linecap": "round" }, arm);
  const head = node("rect", { width: 26, height: 12, x: -20, y: -6, rx: 2, fill: "#d9d0c0", stroke: COLORS.ink, "stroke-width": 1.5 }, arm);
  const tipDot = node("circle", { r: 2.4, fill: COLORS.paper }, arm);

  function tipFor(r) {
    const cos = Math.min(1, Math.max(-1, (d * d + L * L - r * r) / (2 * d * L)));
    const th = Math.acos(cos);
    const ux = -P.x / d, uy = -P.y / d;
    const cands = [th, -th].map(t => ({ x: P.x + L * (ux * Math.cos(t) - uy * Math.sin(t)), y: P.y + L * (ux * Math.sin(t) + uy * Math.cos(t)) }));
    return cands[0].x > cands[1].x ? cands[0] : cands[1];
  }
  let needleR = rData - w / 2, raf = null;
  function placeArm(r) {
    const t = tipFor(r);
    shaftBack.setAttribute("x1", P.x); shaftBack.setAttribute("y1", P.y); shaftBack.setAttribute("x2", t.x); shaftBack.setAttribute("y2", t.y);
    shaft.setAttribute("x1", P.x); shaft.setAttribute("y1", P.y); shaft.setAttribute("x2", t.x); shaft.setAttribute("y2", t.y);
    const ang = Math.atan2(t.y - P.y, t.x - P.x) * 180 / Math.PI;
    head.setAttribute("transform", `translate(${t.x},${t.y}) rotate(${ang})`);
    tipDot.setAttribute("cx", t.x); tipDot.setAttribute("cy", t.y);
  }
  placeArm(needleR);

  const ringRadius = i => rData - i * w - w / 2;
  return {
    yearAt(px, py) {
      const r = Math.hypot(px - cx, py - cy);
      if (r > rData || r < rData - w * years.length) return -1;
      return Math.min(years.length - 1, Math.max(0, Math.floor((rData - r) / w)));
    },
    moveNeedle(i, animate = true) {
      const target = ringRadius(i);
      cancelAnimationFrame(raf);
      if (!animate) { needleR = target; placeArm(target); return; }
      const from = needleR, t0 = performance.now(), dur = 650;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        needleR = from + (target - from) * e;
        placeArm(needleR);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    },
    hoverRing(i) {
      if (i < 0) { hover.setAttribute("opacity", 0); return; }
      hover.setAttribute("r", ringRadius(i));
      hover.setAttribute("stroke-width", Math.max(1.2, w));
      hover.setAttribute("opacity", 0.55);
    },
    emphasize({ keys = null, from = null, to = null } = {}) {
      for (const a of arcs) {
        const y = years[a.i].year;
        const inRange = from == null || (y >= from && y <= to);
        const inKey = !keys || keys.includes(a.key);
        a.path.setAttribute("opacity", inKey && inRange ? 1 : inKey ? 0.42 : inRange ? 0.2 : 0.12);
      }
    },
  };
}
