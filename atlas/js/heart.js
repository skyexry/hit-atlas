// Track 01 · The heart of the chart. Linked views around one selected year.
import {
  FEELINGS, FEELING, NAMED_GENRES, GENRE_COLOR, genreBucket, COLORS,
  pct, yearLabel, el, showTip, hideTip, tipRow, anchorTip, textOn, statusText, reducedMotion,
} from "./core.js";
import { drawSongRecord, spiral, spiralPath } from "./record.js";
import { listenLink, fetchArtwork, embedFrame } from "./listen.js";

const SVGNS = "http://www.w3.org/2000/svg";
const FIVE = ["love", "joy", "sadness", "anger", "outside"];
const dur = () => (reducedMotion() ? 0 : 550);

export function initHeart(data, store, facts, dialog) {
  const views = [
    controls(data, store),
    lineChart(data, store, facts),
    crate(data, store, dialog),
    feelings(data, store),
    genrePie(data, store),
    multiples(data, store),
    annualTable(data, store),
  ];
  store.subscribe((state, changed) => views.forEach(v => v.update(state, changed)));
  let raf = null, lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w === lastWidth) return;
    lastWidth = w;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => views.forEach(v => v.resize && v.resize(store.get())));
  }).observe(document.getElementById("heart"));
}

const songShares = song => (song.shares
  ? FEELINGS.map((f, i) => ({ f, v: song.shares[i] })).filter(d => d.v >= 0.5).sort((a, b) => b.v - a.v)
  : []);

function entryTip(entry, est) {
  const song = entry.song;
  const nodes = [
    el("div", { class: "tt-head", text: `No. ${entry.rank} · ${entry.title}` }),
    el("div", { class: "tt-sub", text: `${entry.artist} · ${yearLabel(entry.year, est)} · ${entry.genres.join(", ")}` }),
  ];
  if (song.shares) {
    for (const d of songShares(song).slice(0, 4)) nodes.push(tipRow(d.f.color, pct(d.v, 0), d.f.label.toLowerCase()));
    if (song.sarcasm > 0) nodes.push(el("div", { class: "tt-note", text: `Sarcasm flagged in ${pct(song.sarcasm, 0)} of the lyric` }));
  } else {
    nodes.push(el("div", { class: "tt-note", text: statusText(song.status) }));
  }
  return nodes;
}

// ── Controls ────────────────────────────────────────────────────────────
function controls(data, store) {
  const years = data.years.map(y => y.year);
  const select = document.getElementById("year-select");
  for (const y of data.years) select.append(el("option", { value: y.year, text: y.est ? `${y.year} (estimate)` : String(y.year) }));
  select.addEventListener("change", () => store.set({ year: +select.value }));
  const prev = document.getElementById("year-prev"), next = document.getElementById("year-next");
  const shift = d => {
    const i = years.indexOf(store.get().year) + d;
    if (i >= 0 && i < years.length) store.set({ year: years[i] });
  };
  prev.addEventListener("click", () => shift(-1));
  next.addEventListener("click", () => shift(1));

  const chips = document.getElementById("emotion-chips");
  const all = el("button", { type: "button", class: "chip", "data-k": "" }, "All feelings");
  chips.append(all, ...FIVE.map(k => el("button", { type: "button", class: "chip", "data-k": k },
    el("i", { style: `background:${FEELING[k].color}` }), FEELING[k].label)));
  chips.addEventListener("click", evt => {
    const btn = evt.target.closest("button[data-k]");
    if (!btn) return;
    const k = btn.dataset.k || null;
    store.set({ emotion: store.get().emotion === k ? null : k });
  });
  const toggle = document.querySelector(".seg-toggle");
  toggle.addEventListener("click", evt => {
    const btn = evt.target.closest("button[data-order]");
    if (btn) store.set({ order: btn.dataset.order });
  });
  return {
    update(state) {
      select.value = state.year;
      prev.disabled = state.year === years[0];
      next.disabled = state.year === years.at(-1);
      for (const b of chips.querySelectorAll("button")) b.setAttribute("aria-pressed", String((b.dataset.k || null) === state.emotion));
      for (const b of toggle.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.order === state.order));
    },
  };
}

// ── Line chart with leader ribbon and coverage strip ───────────────────────
function lineChart(data, store, facts) {
  const years = data.years;
  const svgNode = document.getElementById("lines");
  const svg = d3.select(svgNode);
  const root = svg.append("g");
  const gGrid = root.append("g").attr("class", "grid");
  const gEras = root.append("g");
  const gRibbon = root.append("g");
  const gAxis = root.append("g").attr("class", "axis");
  const gCov = root.append("g");
  const gBand = root.append("g");
  const gLines = root.append("g").attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
  const gEnd = root.append("g");
  const gDots = root.append("g");
  const gCursor = root.append("g").attr("pointer-events", "none");
  const overlay = root.append("rect").attr("fill", "transparent").style("cursor", "pointer");
  let x, y, innerW, innerH, bw, narrow;
  const at = k => FEELING[k].index;
  const pub = years.filter(d => !d.est);
  const lastPub = pub.at(-1), est = years.find(d => d.est);

  svgNode.setAttribute("tabindex", "0");
  const desc = document.getElementById("lines-desc");
  desc.textContent = `Line chart of lyric feeling shares from ${years[0].year} to ${years.at(-1).year}. Love led every year from ${facts.run1.from} to ${facts.run1.to}; joy led from ${facts.run2.from} to ${facts.run2.to}, peaking at ${pct(facts.joyPeak.shares[at("joy")])} in ${facts.joyPeak.year}; since ${facts.era3[0].year} the lead has stayed within ${facts.era3MaxMargin.toFixed(1)} points. Use the left and right arrow keys to change the selected year. All values are in the table view below.`;

  function layout() {
    const W = svgNode.parentNode.clientWidth;
    if (W < 120) return; // not laid out yet (background tab); the resize observer retries
    narrow = W < 640;
    const m = { top: 62, right: narrow ? 70 : 104, bottom: 70, left: narrow ? 34 : 42 };
    const H = narrow ? 330 : 420;
    innerW = W - m.left - m.right; innerH = H - m.top - m.bottom;
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    root.attr("transform", `translate(${m.left},${m.top})`);
    x = d3.scaleLinear([years[0].year, years.at(-1).year], [0, innerW]);
    y = d3.scaleLinear([0, 50], [innerH, 0]);
    bw = innerW / (years.length - 1);
    drawStatic();
  }

  function drawStatic() {
    // Grid + y labels
    const ticks = [0, 10, 20, 30, 40, 50];
    gGrid.selectAll("line").data(ticks).join("line").attr("x1", -6).attr("x2", innerW).attr("y1", d => y(d)).attr("y2", d => y(d));
    gGrid.selectAll("text").data(ticks).join("text").attr("x", -10).attr("y", d => y(d)).attr("dy", "0.32em")
      .attr("text-anchor", "end").attr("class", "axis-tick").style("font-size", "11px").style("fill", COLORS.ink2)
      .text(d => (d === 50 ? "50%" : d));

    // Eras
    const eras = [
      { from: facts.run1.from, to: facts.run1.to, label: narrow ? `Love · ${facts.run1.years.length}` : `Love leads · ${facts.run1.years.length} charts in a row` },
      { from: facts.run2.from, to: facts.run2.to, label: narrow ? `Joy · ${facts.run2.years.length}` : `Joy leads · ${facts.run2.years.length} in a row` },
      { from: facts.era3[0].year, to: facts.era3.at(-1).year, label: narrow ? "No leader" : "No clear leader" },
    ];
    const eg = gEras.selectAll("g.era").data(eras).join(enter => {
      const g = enter.append("g").attr("class", "era");
      g.append("line").attr("class", "era-rule");
      g.append("line").attr("class", "era-rule tick-a");
      g.append("line").attr("class", "era-rule tick-b");
      g.append("text").attr("class", "era-label");
      return g;
    });
    eg.select("line.era-rule:not(.tick-a):not(.tick-b)").attr("x1", d => x(d.from) - bw / 2).attr("x2", d => x(d.to) + bw / 2).attr("y1", -32).attr("y2", -32);
    eg.select(".tick-a").attr("x1", d => x(d.from) - bw / 2).attr("x2", d => x(d.from) - bw / 2).attr("y1", -32).attr("y2", -27);
    eg.select(".tick-b").attr("x1", d => x(d.to) + bw / 2).attr("x2", d => x(d.to) + bw / 2).attr("y1", -32).attr("y2", -27);
    eg.select("text").attr("x", d => x(d.from) - bw / 2).attr("y", -38).text(d => d.label);

    // Leader ribbon
    gRibbon.selectAll("rect").data(years).join("rect")
      .attr("x", d => x(d.year) - bw / 2 + 0.5).attr("width", Math.max(1, bw - 1.2))
      .attr("y", -22).attr("height", 11).attr("rx", 1)
      .attr("fill", d => FEELING[d.leader.key].color)
      .attr("fill-opacity", d => (d.est ? 0.45 : 1))
      .attr("stroke", d => (d.est ? FEELING[d.leader.key].color : null))
      .attr("stroke-dasharray", d => (d.est ? "2 1.5" : null));

    // X axis
    const xt = years.map(d => d.year).filter(v => v % 10 === 0);
    gAxis.attr("transform", `translate(0,${innerH})`);
    gAxis.selectAll("line.tk").data(xt).join("line").attr("class", "tk").attr("x1", d => x(d)).attr("x2", d => x(d)).attr("y1", 0).attr("y2", 5).attr("stroke", COLORS.rule);
    gAxis.selectAll("text.tl").data([...xt, est.year]).join("text").attr("class", "tl")
      .attr("x", d => x(d)).attr("y", 18).attr("text-anchor", "middle")
      .text(d => (d === est.year ? (narrow ? "’26e" : "2026 est.") : d));
    gAxis.selectAll("line.base").data([0]).join("line").attr("class", "base").attr("x1", 0).attr("x2", innerW).attr("stroke", COLORS.ink2);

    // Coverage strip
    const cy0 = innerH + 32, ch = 12;
    gCov.selectAll("rect.bg").data(years).join("rect").attr("class", "bg")
      .attr("x", d => x(d.year) - bw / 2 + 0.5).attr("width", Math.max(1, bw - 1.2)).attr("y", cy0).attr("height", ch).attr("fill", COLORS.paper3);
    gCov.selectAll("rect.fg").data(years).join("rect").attr("class", "fg")
      .attr("x", d => x(d.year) - bw / 2 + 0.5).attr("width", Math.max(1, bw - 1.2))
      .attr("y", d => cy0 + ch * (1 - d.annotated / d.songs)).attr("height", d => ch * d.annotated / d.songs).attr("fill", "#9f968a");
    const lo = d3.min(years, d => d.annotated / d.songs);
    gCov.selectAll("text").data([0]).join("text").attr("class", "cov-label").attr("x", 0).attr("y", cy0 + ch + 13)
      .text(narrow ? `Gray bars: songs annotated (${Math.round(lo * 100)}–100%)` : `Gray bars: share of each year’s songs with annotated lyrics (${Math.round(lo * 100)}–100%)`);

    // Lines
    const line = d3.line().x(d => x(d.year)).y(d => y(d.v));
    const series = FIVE.map(k => ({
      k,
      solid: pub.map(d => ({ year: d.year, v: d.shares[at(k)] })),
      dash: [lastPub, est].map(d => ({ year: d.year, v: d.shares[at(k)] })),
    }));
    gLines.selectAll("path.solid").data(series, d => d.k).join("path").attr("class", "solid").attr("d", d => line(d.solid));
    gLines.selectAll("path.dash").data(series, d => d.k).join("path").attr("class", "dash").attr("stroke-dasharray", "4 4").attr("d", d => line(d.dash));

    // End labels with simple collision dodging
    const ends = FIVE.map(k => ({ k, y: y(est.shares[at(k)]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].y, (ends[i - 1].ly ?? ends[i - 1].y) + 14);
    ends[0].ly = ends[0].y;
    const eg2 = gEnd.selectAll("g").data(ends, d => d.k).join(enter => {
      const g = enter.append("g");
      g.append("line").attr("stroke", COLORS.rule);
      g.append("text").attr("class", "end-label");
      return g;
    });
    eg2.select("line").attr("x1", innerW + 3).attr("x2", innerW + 9).attr("y1", d => d.y).attr("y2", d => d.ly);
    eg2.select("text").attr("x", innerW + 12).attr("y", d => d.ly).attr("dy", "0.32em").text(d => FEELING[d.k].label);

    overlay.attr("x", -bw / 2).attr("y", -26).attr("width", innerW + bw).attr("height", innerH + 26);
    update(store.get(), new Set(["year", "emotion"]));
  }

  function nearestYear(evt) {
    const [px] = d3.pointer(evt, root.node());
    const v = Math.round(x.invert(px));
    return Math.max(years[0].year, Math.min(years.at(-1).year, v));
  }
  function showCursor(yr, evt) {
    const d = data.yearMap.get(yr);
    gCursor.selectAll("line").data([yr]).join("line").attr("class", "cursor-line").attr("x1", x(yr)).attr("x2", x(yr)).attr("y1", -22).attr("y2", innerH);
    const rows = FIVE.map(k => ({ k, v: d.shares[at(k)] })).sort((a, b) => b.v - a.v);
    showTip([
      el("div", { class: "tt-head", text: d.est ? `${yr} · estimate` : String(yr) }),
      el("div", { class: "tt-sub", text: `${FEELING[d.leader.key].label} leads by ${d.leader.margin.toFixed(1)} pts` }),
      ...rows.map(r => tipRow(FEELING[r.k].color, pct(r.v), FEELING[r.k].label.toLowerCase())),
      el("div", { class: "tt-note", text: `${d.annotated} of ${d.songs} songs annotated · click to open` }),
    ], evt.clientX, evt.clientY);
  }
  let dragging = false;
  overlay.on("pointermove", evt => {
    const yr = nearestYear(evt);
    if (dragging && yr !== store.get().year) store.set({ year: yr });
    showCursor(yr, evt);
  }).on("pointerleave", () => { gCursor.selectAll("*").remove(); hideTip(); })
    .on("pointerdown", evt => { dragging = true; overlay.node().setPointerCapture?.(evt.pointerId); store.set({ year: nearestYear(evt) }); })
    .on("pointerup pointercancel", () => { dragging = false; });
  svgNode.addEventListener("keydown", evt => {
    const ys = years.map(d => d.year), i = ys.indexOf(store.get().year);
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, Home: -i, End: ys.length - 1 - i };
    if (evt.key in moves) { evt.preventDefault(); const j = Math.max(0, Math.min(ys.length - 1, i + moves[evt.key])); store.set({ year: ys[j] }); }
  });

  function update(state, changed) {
    if (!x) return;
    const sel = data.yearMap.get(state.year);
    if (changed.has("year")) {
      gBand.selectAll("rect").data([state.year]).join("rect").attr("class", "select-band")
        .attr("x", x(state.year) - bw / 2).attr("width", bw).attr("y", -22).attr("height", innerH + 22);
      const pill = gBand.selectAll("g.pill").data([state.year]).join(enter => {
        const g = enter.append("g").attr("class", "pill");
        g.append("rect").attr("rx", 9).attr("height", 18).attr("y", 5).attr("fill", COLORS.ink);
        g.append("text").attr("y", 14).attr("dy", "0.32em").attr("text-anchor", "middle").attr("fill", COLORS.paper).style("font-size", "11.5px").style("font-weight", 800);
        return g;
      }).attr("transform", `translate(${x(state.year)},${innerH})`);
      const label = sel.est ? `${state.year} est.` : String(state.year);
      pill.select("text").text(label);
      const pw = label.length * 7 + 14;
      pill.select("rect").attr("x", -pw / 2).attr("width", pw);
      gAxis.selectAll("text.tl").attr("opacity", d => (Math.abs(x(d) - x(state.year)) < 34 ? 0 : 1));
      gDots.selectAll("circle").data(FIVE, k => k).join("circle").attr("r", 4.5).attr("stroke", COLORS.paper).attr("stroke-width", 2)
        .attr("cx", x(state.year)).attr("cy", k => y(sel.shares[at(k)]))
        .attr("fill", k => (sel.est ? COLORS.paper : FEELING[k].color))
        .attr("stroke", k => (sel.est ? FEELING[k].color : COLORS.paper));
      svgNode.setAttribute("aria-label", `Feelings over time. Selected ${label}: ` + FIVE.map(k => `${FEELING[k].label} ${pct(sel.shares[at(k)])}`).join(", "));
    }
    const f = state.emotion;
    const color = k => (!f || f === k ? FEELING[k].color : "#d9d0c1");
    const width = k => (f === k ? 3 : k === "outside" ? 1.5 : 2);
    gLines.selectAll("path").attr("stroke", d => color(d.k)).attr("stroke-width", d => width(d.k))
      .attr("opacity", d => (!f || f === d.k ? 1 : 0.9));
    gLines.selectAll("path").filter(d => d.k === f).raise();
    gRibbon.selectAll("rect").attr("opacity", d => (!f || d.leader.key === f ? 1 : 0.18));
    gDots.selectAll("circle").attr("opacity", k => (!f || f === k ? 1 : 0.25));
  }

  return { update, resize: layout, init: layout() };
}

// ── Crate of records ────────────────────────────────────────────────────
function crate(data, store, dialog) {
  const host = document.getElementById("crate");
  const sub = document.getElementById("crate-sub");
  const bigYear = document.getElementById("big-year");
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("role", "group");
  host.append(svg);
  const legend = document.getElementById("legend-record");
  legend.setAttribute("viewBox", "-60 -60 120 120");
  let cols = 10, items = [], ordered = [], focusPos = 0, year = null;
  const CELL = 100;

  // Legend record: a neutral groove with start and end marks.
  (() => {
    const g = document.createElementNS(SVGNS, "g");
    legend.append(g);
    drawSongRecord(g, { segments: null }, { rank: 1 });
    const sp = spiral(44.5, 21.5, 5);
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", spiralPath(sp, 0, 0.22)); p.setAttribute("stroke", FEELING.love.color);
    p.setAttribute("stroke-width", 3.5); p.setAttribute("fill", "none");
    g.insertBefore(p, g.querySelector(".label"));
    const a = document.createElementNS(SVGNS, "path");
    a.setAttribute("d", "M0,-58 L0,-47 M-4,-52 L0,-47 L4,-52");
    a.setAttribute("stroke", COLORS.ink); a.setAttribute("fill", "none"); a.setAttribute("stroke-width", 1.6);
    legend.append(a);
  })();

  const mainOrder = ["love", "joy", "sadness", "anger", "outside", "insufficient"];
  function sortEntries(entries, mode) {
    if (mode !== "feeling") return entries.slice();
    const g = e => (e.song.shares ? mainOrder.indexOf(e.song.main) : 99);
    return entries.slice().sort((a, b) => g(a) - g(b)
      || (b.song.shares && a.song.shares ? b.song.shares[FEELING[b.song.main].index] - a.song.shares[FEELING[a.song.main].index] : 0)
      || a.rank - b.rank);
  }
  const posOf = i => ({ x: (i % cols) * CELL + CELL / 2, y: Math.floor(i / cols) * CELL + CELL / 2 });
  function sizeSvg(n) {
    const rows = Math.ceil(n / cols);
    svg.setAttribute("viewBox", `0 0 ${cols * CELL} ${rows * CELL}`);
  }

  function build(state) {
    year = data.yearMap.get(state.year);
    const entries = data.entries.get(state.year);
    svg.replaceChildren();
    svg.setAttribute("aria-label", `${entries.length} records for ${yearLabel(state.year, year.est)}, use arrow keys to move between them`);
    items = entries.map(entry => {
      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", "rec");
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", "-1");
      const shares = songShares(entry.song).slice(0, 3).map(d => `${d.f.label} ${pct(d.v, 0)}`).join(", ");
      g.setAttribute("aria-label", `No. ${entry.rank}, ${entry.title} by ${entry.artist}. ${entry.song.shares ? shares : statusText(entry.song.status)}`);
      const hit = document.createElementNS(SVGNS, "circle");
      hit.setAttribute("class", "hit"); hit.setAttribute("r", 50);
      const inner = document.createElementNS(SVGNS, "g");
      drawSongRecord(inner, entry.song, { rank: entry.rank, focus: state.emotion });
      const ring = document.createElementNS(SVGNS, "circle");
      ring.setAttribute("class", "focus-ring"); ring.setAttribute("r", 49.6);
      g.append(hit, inner, ring);
      svg.append(g);
      const item = { entry, g };
      g.addEventListener("pointerenter", evt => { g.classList.add("is-hover"); showTip(entryTip(entry, year.est), evt.clientX, evt.clientY); });
      g.addEventListener("pointermove", evt => showTip(entryTip(entry, year.est), evt.clientX, evt.clientY));
      g.addEventListener("pointerleave", () => { g.classList.remove("is-hover"); hideTip(); });
      g.addEventListener("click", () => { hideTip(); dialog.open(entry, ordered.map(o => o.entry)); });
      g.addEventListener("focus", () => anchorTip(entryTip(entry, year.est), g));
      g.addEventListener("blur", hideTip);
      g.addEventListener("keydown", evt => onKey(evt, item));
      return item;
    });
    focusPos = 0;
    place(state, false);
    const counts = d3.rollup(entries.filter(e => e.song.shares), v => v.length, e => e.song.main);
    const annotated = entries.filter(e => e.song.shares).length;
    sub.replaceChildren(
      `${entries.length} entries${entries.length > 100 ? " (two tied at No. 100)" : ""} · ${annotated} with annotated lyrics · main feeling: `,
      ...mainOrder.filter(k => counts.get(k)).flatMap((k, i) => [i ? ", " : "", el("b", { text: String(counts.get(k)) }), ` ${FEELING[k].label.toLowerCase()}`]));
    bigYear.replaceChildren(String(state.year), year.est ? el("small", { text: "estimate · through Nov 28" }) : el("small", { text: "Year-End Hot 100" }));
  }

  const colsFor = w => (w < 520 ? 5 : 10);
  function place(state, animate) {
    cols = colsFor(host.clientWidth);
    ordered = sortEntries(items.map(i => i.entry), state.order).map(e => items.find(i => i.entry === e));
    sizeSvg(ordered.length);
    ordered.forEach((it, i) => {
      const p = posOf(i);
      it.pos = i;
      if (animate && dur()) {
        d3.select(it.g).transition().duration(dur()).delay(i * 4).attr("transform", `translate(${p.x},${p.y})`);
      } else {
        it.g.setAttribute("transform", `translate(${p.x},${p.y})`);
      }
    });
    ordered.forEach((it, i) => it.g.setAttribute("tabindex", i === focusPos ? "0" : "-1"));
  }

  function onKey(evt, item) {
    const n = ordered.length;
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -item.pos, End: n - 1 - item.pos };
    if (evt.key in moves) {
      evt.preventDefault();
      const j = Math.max(0, Math.min(n - 1, item.pos + moves[evt.key]));
      focusPos = j;
      ordered.forEach((it, i) => it.g.setAttribute("tabindex", i === j ? "0" : "-1"));
      ordered[j].g.focus();
    } else if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      hideTip();
      dialog.open(item.entry, ordered.map(o => o.entry));
    }
  }

  function applyFocus(state) {
    for (const it of items) {
      for (const p of it.g.querySelectorAll(".grooves path[data-cat]")) {
        p.setAttribute("opacity", !state.emotion || p.dataset.cat === state.emotion ? 1 : 0.16);
      }
    }
  }
  function applyGenre(state) {
    for (const it of items) {
      const match = state.genre && it.entry.genres.some(g => genreBucket(g) === state.genre);
      it.g.classList.toggle("is-genre", !!match);
      it.g.style.opacity = state.genre && !match ? 0.28 : "";
    }
  }

  return {
    update(state, changed) {
      if (changed.has("year")) build(state);
      else if (changed.has("order")) place(state, true);
      if (changed.has("emotion") && !changed.has("year")) applyFocus(state);
      if (changed.has("genre") || changed.has("year")) applyGenre(state);
    },
    resize(state) {
      if (colsFor(host.clientWidth) !== cols && items.length) place(state, false);
    },
  };
}

// ── Feelings this year: tall segmented bar ───────────────────────────────
function feelings(data, store) {
  const host = document.getElementById("feel-bar");
  const legend = document.getElementById("feel-legend");
  const coverage = document.getElementById("feel-coverage");
  const svg = d3.select(host).append("svg").attr("role", "img");
  function render(state) {
    const yr = data.yearMap.get(state.year);
    const W = host.clientWidth || 360, H = 30, gap = 2;
    svg.attr("viewBox", `0 0 ${W} ${H + 4}`);
    const total = yr.shares.reduce((a, b) => a + b, 0);
    let acc = 0;
    const parts = FEELINGS.map((f, i) => {
      const w = (yr.shares[i] / total) * W;
      const d = { f, v: yr.shares[i], x: acc, w };
      acc += w;
      return d;
    });
    const label = d => pct(d.v, 0);
    const fits = d => d.w - gap >= label(d).length * 7.4 + 10;
    const g = svg.selectAll("g.part").data(parts, d => d.f.key).join(enter => {
      const g2 = enter.append("g").attr("class", "part");
      g2.append("rect").attr("rx", 4).attr("y", 2).attr("height", H);
      g2.append("text").attr("class", "seg-text").attr("y", 2 + H / 2).attr("dy", "0.34em");
      return g2;
    });
    g.select("rect").attr("x", d => d.x + (d.x ? gap / 2 : 0)).attr("width", d => Math.max(0, d.w - gap))
      .attr("fill", d => d.f.color)
      .attr("opacity", d => (!state.emotion || state.emotion === d.f.key ? 1 : 0.25));
    g.select("text").attr("x", d => d.x + 8).attr("fill", d => textOn(d.f.color)).text(d => (fits(d) ? label(d) : ""))
      .attr("opacity", d => (!state.emotion || state.emotion === d.f.key ? 1 : 0.4));
    g.on("pointermove", (evt, d) => showTip([tipRow(d.f.color, pct(d.v), d.f.long || d.f.label)], evt.clientX, evt.clientY)).on("pointerleave", hideTip);
    svg.attr("aria-label", `Feelings in ${yearLabel(state.year, yr.est)}: ` + parts.map(d => `${d.f.label} ${pct(d.v)}`).join(", "));
    legend.replaceChildren(...parts.map(d => el("li", {},
      el("i", { style: `background:${d.f.color}` }), d.f.label, fits(d) ? null : el("b", { text: pct(d.v) }))));
    const gaps = yr.gaps, bits = [];
    if (gaps.instrumental) bits.push(`${gaps.instrumental} instrumental`);
    if (gaps.missing) bits.push(`${gaps.missing} missing transcript${gaps.missing > 1 ? "s" : ""}`);
    if (gaps.unverified) bits.push(`${gaps.unverified} awaiting match review`);
    if (gaps.compound) bits.push(`${gaps.compound} compound single${gaps.compound > 1 ? "s" : ""}`);
    coverage.replaceChildren(
      `Averages the ${yr.annotated} of ${yr.songs} songs with annotated lyrics, each weighted equally.`,
      bits.length ? ` Not annotated (chart entries): ${bits.join(", ")}.` : " Every song is annotated.",
      ` Sarcasm is flagged in ${pct(yr.sarcasm)} of lyric text (${yr.sarcasmSongs} songs).`,
      yr.est ? ` ${data.meta.estimateNote}` : "");
  }
  return { update: (s, c) => { if (c.has("year") || c.has("emotion")) render(s); }, resize: render };
}

// ── Genres this year: pie (kept) + percentage list ───────────────────────
function genrePie(data, store) {
  const svg = d3.select("#genre-pie");
  const g = svg.append("g").attr("transform", "translate(120,120)");
  const gSlices = g.append("g"), gText = g.append("g");
  const list = document.getElementById("genre-list");
  const R = 112;
  const arc = d3.arc().innerRadius(0).outerRadius(R);
  const labelArc = d3.arc().innerRadius(R * 0.66).outerRadius(R * 0.66);
  const pie = d3.pie().sort(null).value(d => d.share);
  const order = [...NAMED_GENRES, "Other"];
  let current = [];

  function folded(yr) {
    const m = new Map(order.map(k => [k, 0]));
    const parts = [];
    for (const [name, v] of yr.genres) {
      const k = genreBucket(name);
      m.set(k, m.get(k) + v);
      if (k === "Other") parts.push([name, v]);
    }
    return { slices: order.map(name => ({ name, share: m.get(name) })), parts: parts.sort((a, b) => b[1] - a[1]) };
  }
  const toggle = name => store.set({ genre: store.get().genre === name ? null : name });

  function render(state, changed) {
    const yr = data.yearMap.get(state.year);
    const { slices, parts } = folded(yr);
    const arcs = pie(slices);
    const prev = new Map(current.map(a => [a.data.name, a]));
    current = arcs;
    const paths = gSlices.selectAll("path").data(arcs, d => d.data.name).join("path")
      .attr("class", "slice").attr("fill", d => GENRE_COLOR[d.data.name])
      .attr("stroke", COLORS.paper).attr("stroke-width", 2).attr("stroke-linejoin", "round")
      .attr("role", "button")
      .attr("aria-label", d => `${d.data.name} ${pct(d.data.share * 100)}`);
    if (changed.has("year") && dur() && prev.size) {
      paths.transition().duration(dur()).attrTween("d", function (d) {
        const p = prev.get(d.data.name) || { startAngle: d.startAngle, endAngle: d.startAngle };
        const i = d3.interpolate({ startAngle: p.startAngle, endAngle: p.endAngle }, { startAngle: d.startAngle, endAngle: d.endAngle });
        return t => arc(i(t));
      });
    } else paths.attr("d", arc);
    paths.attr("opacity", d => (!state.genre || state.genre === d.data.name ? 1 : 0.28))
      .on("click", (evt, d) => toggle(d.data.name))
      .on("pointermove", (evt, d) => showTip([tipRow(GENRE_COLOR[d.data.name], pct(d.data.share * 100), d.data.name)], evt.clientX, evt.clientY))
      .on("pointerleave", hideTip);
    gText.selectAll("text").data(arcs.filter(d => d.endAngle - d.startAngle > 0.42), d => d.data.name).join("text")
      .attr("class", "pie-pct").attr("text-anchor", "middle").attr("dy", "0.34em")
      .attr("transform", d => `translate(${labelArc.centroid(d)})`)
      .attr("fill", d => textOn(GENRE_COLOR[d.data.name]))
      .attr("opacity", d => (!state.genre || state.genre === d.data.name ? 1 : 0.3))
      .text(d => `${Math.round(d.data.share * 100)}%`);

    list.replaceChildren(...slices.map(s => {
      const btn = el("button", { type: "button", "aria-pressed": String(state.genre === s.name) },
        el("i", { style: `background:${GENRE_COLOR[s.name]}` }),
        el("span", { text: s.name }),
        el("span", { class: "pct", text: pct(s.share * 100) }));
      btn.addEventListener("click", () => toggle(s.name));
      const li = el("li", { class: s.share === 0 ? "zero" : null }, btn);
      if (s.name === "Other" && parts.length) {
        li.append(el("span", { class: "sub", text: parts.filter(p => p[1] >= 0.0005).map(([n, v]) => `${n} ${pct(v * 100)}`).join(" · ") }));
      }
      return li;
    }));
  }
  return { update: (s, c) => { if (c.has("year") || c.has("genre")) render(s, c); } };
}

// ── Genre small multiples (same scale, linked hover) ─────────────────────
function multiples(data, store) {
  const host = document.getElementById("multiples");
  const REST = ["Reggae", "Alternative", "Afrobeats", "Gospel", "Blues"];
  const panels = [...NAMED_GENRES, "Folk", "Funk", "Indie", "Disco", "Latin", "Dance/Electronic", "Reggae & rest"]
    .map(name => {
      const members = name === "Reggae & rest" ? REST : [name];
      return {
        name, members, bucket: NAMED_GENRES.includes(name) ? name : "Other",
        color: GENRE_COLOR[NAMED_GENRES.includes(name) ? name : "Other"],
        values: data.years.map(y => ({ year: y.year, est: y.est, v: members.reduce((t, m) => t + (y.genres.get(m) || 0), 0) })),
      };
    });
  const maxV = d3.max(panels, p => d3.max(p.values, d => d.v));
  const W = 160, H = 64;
  const x = d3.scaleLinear([data.years[0].year, data.years.at(-1).year], [2, W - 2]);
  const y = d3.scaleLinear([0, Math.ceil(maxV * 20) / 20], [H - 2, 4]);
  const area = d3.area().x(d => x(d.year)).y0(H - 2).y1(d => y(d.v));
  const line = d3.line().x(d => x(d.year)).y(d => y(d.v));
  let hoverYear = null;

  const nodes = panels.map(p => {
    const box = el("div", { class: "mult" });
    const title = el("div", { class: "mult-title" }, el("span", { text: p.name }), el("span", { class: "v" }));
    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H + 12}`).attr("role", "img")
      .attr("aria-label", `${p.name} share of chart entries by year, peak ${pct(d3.max(p.values, d => d.v) * 100)}`);
    svg.append("line").attr("x1", 0).attr("x2", W).attr("y1", H - 2).attr("y2", H - 2).attr("stroke", COLORS.rule);
    svg.append("path").attr("d", area(p.values)).attr("fill", p.color).attr("fill-opacity", 0.16);
    svg.append("path").attr("d", line(p.values.filter(d => !d.est))).attr("fill", "none").attr("stroke", p.color).attr("stroke-width", 1.8);
    svg.append("path").attr("d", line(p.values.slice(-2))).attr("fill", "none").attr("stroke", p.color).attr("stroke-width", 1.8).attr("stroke-dasharray", "2 2");
    const mark = svg.append("g");
    mark.append("line").attr("class", "m-line").attr("y1", 2).attr("y2", H - 2).attr("stroke", COLORS.ink).attr("stroke-width", 1);
    mark.append("circle").attr("r", 3).attr("stroke", COLORS.paper).attr("stroke-width", 1.5).attr("fill", COLORS.ink);
    svg.append("text").attr("class", "mult-hover-year").attr("y", H + 10);
    box.append(title, svg.node());
    host.append(box);
    const yearAt = evt => {
      const [px] = d3.pointer(evt, svg.node()); // viewBox units
      return Math.max(data.years[0].year, Math.min(data.years.at(-1).year, Math.round(x.invert(px))));
    };
    svg.on("pointermove", evt => { hoverYear = yearAt(evt); paint(store.get()); })
      .on("pointerleave", () => { hoverYear = null; paint(store.get()); })
      .on("click", evt => store.set({ year: yearAt(evt) }));
    svg.style("cursor", "pointer");
    return { p, box, title, svg, mark };
  });

  function paint(state) {
    const yr = hoverYear ?? state.year;
    const i = data.years.findIndex(d => d.year === yr);
    for (const n of nodes) {
      const d = n.p.values[i];
      n.title.querySelector(".v").textContent = pct(d.v * 100);
      n.mark.select("line").attr("x1", x(yr)).attr("x2", x(yr)).attr("stroke-dasharray", hoverYear != null ? "2 2" : null);
      n.mark.select("circle").attr("cx", x(yr)).attr("cy", y(d.v)).attr("fill", d.est ? COLORS.paper : COLORS.ink).attr("stroke", d.est ? COLORS.ink : COLORS.paper);
      n.svg.select(".mult-hover-year").attr("x", Math.min(W - 34, Math.max(0, x(yr) - 14))).text(yearLabel(yr, d.est));
      n.box.classList.toggle("is-dim", !!state.genre && state.genre !== n.p.bucket);
    }
  }
  return { update: (s, c) => { if (c.has("year") || c.has("genre")) paint(s); } };
}

// ── Table view ──────────────────────────────────────────────────────────
function annualTable(data, store) {
  const table = document.getElementById("annual-table");
  const head = el("tr", {}, ...["Year", ...FEELINGS.map(f => f.label), "Leader", "Songs annotated", "Largest genre"].map(t => el("th", { scope: "col", text: t })));
  const rows = data.years.map(y => {
    const top = [...y.genres].sort((a, b) => b[1] - a[1])[0];
    return el("tr", { "data-year": y.year },
      el("th", { scope: "row", text: yearLabel(y.year, y.est) }),
      ...y.shares.map(v => el("td", { text: pct(v) })),
      el("td", { text: FEELING[y.leader.key].label }),
      el("td", { text: `${y.annotated} / ${y.songs}` }),
      el("td", { text: `${top[0]} ${pct(top[1] * 100)}` }));
  });
  table.append(el("thead", {}, head), el("tbody", {}, ...rows));
  return {
    update(state, changed) {
      if (!changed.has("year")) return;
      for (const r of rows) r.style.background = +r.dataset.year === state.year ? COLORS.paper3 : "";
    },
  };
}

// ── Song dialog: pull a record from the crate ────────────────────────────
export function createSongDialog(data, store) {
  const dlg = document.getElementById("song-dialog");
  const rec = document.getElementById("sd-record");
  const strip = document.getElementById("sd-strip");
  const $ = id => document.getElementById(id);
  let list = [], idx = 0, source = "crate";

  function render(entry) {
    const song = entry.song;
    const est = data.yearMap.get(entry.year).est;
    $("sd-rank").replaceChildren(`No. ${entry.rank}`, el("small", { text: yearLabel(entry.year, est) }));
    $("sd-title").textContent = entry.title;
    $("sd-artist").textContent = entry.artist;
    $("sd-genres").replaceChildren(...entry.genres.map(gn => el("span", { class: "g-chip" },
      el("i", { style: `background:${GENRE_COLOR[genreBucket(gn)]}` }), gn)));

    rec.replaceChildren();
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("transform", "translate(200,200)");
    rec.append(g);
    drawSongRecord(g, song, { size: "large", rank: entry.rank, year: entry.year, est });
    $("sd-record-desc").textContent = song.segments
      ? `Record for ${entry.title}: ${song.segments.length} lyric segments from the outer edge to the label. ` + songShares(song).map(d => `${d.f.label} ${pct(d.v, 0)}`).join(", ")
      : `${entry.title}: ${statusText(song.status)}.`;
    drawStrip(song);

    const feel = $("sd-feel");
    if (song.shares) {
      const outside = d3.rollups(song.segments.filter(s => s.cat === "outside"), v => d3.sum(v, s => (s.end - s.start) * 100), s => s.astra)
        .sort((a, b) => b[1] - a[1]);
      feel.replaceChildren(...[
        thinBar(song.shares),
        el("ul", { class: "sd-feel-list" }, ...FEELINGS.map((f, i) => ({ f, v: song.shares[i] })).filter(d => d.v > 0).sort((a, b) => b.v - a.v).map(d =>
          el("li", {}, el("i", { style: `background:${d.f.color}` }),
            el("span", {}, d.f.label, d.f.key === "outside" && outside.length ? el("span", { class: "orig", text: ` · ${outside.map(([k, v]) => `${k} ${pct(v, 0)}`).join(", ")}` }) : null),
            el("span", { class: "pct", text: pct(d.v) })))),
        song.sarcasm > 0 ? el("p", { class: "fine", text: `Sarcasm is flagged in ${pct(song.sarcasm, 0)} of the lyric (dotted on the record, zigzag under the strip).` }) : null,
      ].filter(Boolean));
    } else {
      feel.replaceChildren(el("p", { class: "fine", text: `${statusText(song.status)}. This record is shown with plain grooves and is left out of the year’s averages.` }));
    }

    const listen = $("sd-listen");
    listen.replaceChildren(el("div", { class: "l-col" }, listenLink(entry)));
    if (entry.spotify) {
      const col = listen.firstChild;
      const btn = el("button", { type: "button", class: "btn btn-line", style: "padding:6px 12px;font-size:.8rem" }, "Play a preview here");
      btn.addEventListener("click", () => { btn.replaceWith(embedFrame(entry.spotify, entry.title)); });
      col.append(btn);
      const want = entry;
      fetchArtwork(entry.spotify).then(a => {
        if (!a || list[idx] !== want) return;
        listen.prepend(el("figure", { class: "sd-art" },
          el("img", { src: a.src, alt: `Cover art for ${entry.title} (Spotify)`, width: 92, height: 92 }),
          el("figcaption", { text: "Matched recording" })));
      });
    }
    const audio = $("sd-audio");
    if (entry.audio) {
      const A = entry.audio;
      const rows = [["Valence", A.valence.toFixed(2)], ["Energy", A.energy.toFixed(2)], ["Danceability", A.danceability.toFixed(2)],
        ["Acousticness", A.acousticness.toFixed(2)], ["Tempo", `${Math.round(A.tempo)} BPM`], ["Loudness", `${A.loudness.toFixed(1)} dB`]];
      audio.replaceChildren(el("p", { class: "micro", style: "margin-top:14px", text: "Sound of the matched recording (ReccoBeats)" }),
        el("div", { class: "audio-grid" }, ...rows.map(([k, v]) => el("div", {}, el("span", { text: k }), el("b", { text: v })))));
    } else {
      audio.replaceChildren(el("p", { class: "fine", text: "No matched audio features for this entry (audio coverage is dense only for 2021–2026)." }));
    }
    const others = song.appearances.filter(a => a.year !== entry.year);
    $("sd-history").textContent = others.length ? `Also on the chart: ${others.map(a => `${yearLabel(a.year, data.yearMap.get(a.year).est)} (No. ${a.rank})`).join(", ")}` : "";
    $("sd-prev").disabled = idx === 0;
    $("sd-next").disabled = idx === list.length - 1;
    const toCrate = $("sd-crate");
    toCrate.hidden = source === "crate";
    toCrate.textContent = `Open the ${yearLabel(entry.year, est)} crate`;
  }

  function thinBar(shares) {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 300 10");
    svg.setAttribute("aria-hidden", "true");
    svg.style.width = "100%"; svg.style.height = "10px"; svg.style.display = "block";
    let acc = 0;
    shares.forEach((v, i) => {
      if (v <= 0) return;
      const w = (v / 100) * 300;
      const r = document.createElementNS(SVGNS, "rect");
      r.setAttribute("x", acc + 1); r.setAttribute("width", Math.max(0, w - 2)); r.setAttribute("height", 8); r.setAttribute("y", 1);
      r.setAttribute("rx", 4); r.setAttribute("fill", FEELINGS[i].color);
      svg.append(r);
      acc += w;
    });
    return svg;
  }

  function drawStrip(song) {
    strip.replaceChildren();
    const W = 400, y0 = 22, h = 16;
    const add = (tag, attrs, parent = strip) => {
      const n = document.createElementNS(SVGNS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      parent.append(n);
      return n;
    };
    if (!song.segments) {
      add("rect", { x: 0, y: y0, width: W, height: h, fill: COLORS.grooveEmpty, rx: 3 });
      return;
    }
    let lastLabelX = -99;
    for (const s of song.segments) {
      const x0 = s.start * W, w = (s.end - s.start) * W;
      const r = add("rect", { x: x0 + 0.5, y: y0, width: Math.max(0.6, w - 1), height: h, fill: FEELING[s.cat].color });
      r.addEventListener("pointermove", evt => showTip([
        el("div", { class: "tt-head", text: `${s.label || "Segment"} · ${Math.round(s.start * 100)}–${Math.round(s.end * 100)}% of the lyric` }),
        tipRow(FEELING[s.cat].color, FEELING[s.cat].label, s.astra !== FEELING[s.cat].label.toLowerCase() ? `labeled “${s.astra}”` : ""),
        s.sarcasm ? el("div", { class: "tt-note", text: "Flagged as sarcastic" }) : null,
      ].filter(Boolean), evt.clientX, evt.clientY));
      r.addEventListener("pointerleave", hideTip);
      if (s.label) {
        // Every section start gets a tick; its name prints only where there is room.
        add("line", { x1: x0 + 0.5, x2: x0 + 0.5, y1: y0 - 6, y2: y0 + h, stroke: COLORS.ink, "stroke-width": 1 });
        if (x0 - lastLabelX > 30) {
          const t = add("text", { x: x0 + 2, y: y0 - 9, class: "strip-label" });
          t.textContent = s.label.replace("Pre-Chorus", "Pre").replace("Post-Chorus", "Post");
          lastLabelX = x0;
        }
      }
      if (s.sarcasm) add("path", { d: `M${x0},${y0 + h + 7} ${d3.range(Math.max(1, Math.floor(w / 6))).map(k => `l3,-3 l3,3`).join(" ")}`, fill: "none", stroke: COLORS.ink2, "stroke-width": 1.2 });
    }
  }

  $("sd-crate").addEventListener("click", () => {
    const entry = list[idx];
    dlg.close();
    store.set({ year: entry.year, emotion: null, genre: null });
    // Land the crate just below the masthead and Track 01's sticky controls.
    const panel = document.querySelector(".panel-crate");
    const controls = document.querySelector("#heart .controls");
    const offset = document.querySelector(".masthead").offsetHeight + (controls ? controls.offsetHeight : 0) + 10;
    window.scrollTo({ top: panel.getBoundingClientRect().top + window.scrollY - offset, behavior: reducedMotion() ? "auto" : "smooth" });
  });
  $("sd-prev").addEventListener("click", () => { if (idx > 0) { idx -= 1; render(list[idx]); } });
  $("sd-next").addEventListener("click", () => { if (idx < list.length - 1) { idx += 1; render(list[idx]); } });
  dlg.addEventListener("close", hideTip);
  dlg.addEventListener("click", evt => {
    const r = dlg.getBoundingClientRect();
    const outside = evt.clientX < r.left || evt.clientX > r.right || evt.clientY < r.top || evt.clientY > r.bottom;
    if (evt.target === dlg && outside) dlg.close();
  });

  return {
    open(entry, entries, opts = {}) {
      list = entries; idx = Math.max(0, entries.indexOf(entry)); source = opts.source || "crate";
      render(entry);
      if (!dlg.open) dlg.showModal();
    },
  };
}
