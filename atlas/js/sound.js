// Track 04 · Sad words, happy sound. How the recorded sound of 2021–2026 hits lines up with their lyrics.
import { FEELINGS, FEELING, NAMED_GENRES, GENRE_COLOR, genreBucket, COLORS, pct, yearLabel, el, showTip, hideTip, tipRow, reducedMotion } from "./core.js";
import { drawSongRecord } from "./record.js";
import { listenLink } from "./listen.js";

const SVGNS = "http://www.w3.org/2000/svg";
const FIRST_YEAR = 2021; // audio coverage is dense from here on (92% of entries matched)
const FEATURES = [
  { key: "valence", label: "Valence", low: "sounds sadder", high: "sounds happier", mid: 0.5, fmt: v => v.toFixed(2), unit: "", fixed: [0, 1] },
  { key: "energy", label: "Energy", low: "calmer", high: "more intense", mid: 0.5, fmt: v => v.toFixed(2), unit: "", fixed: [0, 1] },
  { key: "danceability", label: "Danceability", low: "harder to dance to", high: "easier to dance to", mid: 0.5, fmt: v => v.toFixed(2), unit: "", fixed: [0, 1] },
  { key: "acousticness", label: "Acousticness", low: "electronic, produced", high: "acoustic", mid: 0.5, fmt: v => v.toFixed(2), unit: "", fixed: [0, 1] },
  { key: "tempo", label: "Tempo", low: "slower", high: "faster", mid: null, fmt: v => String(Math.round(v)), unit: " BPM" },
  { key: "loudness", label: "Loudness", low: "quieter master", high: "louder master", mid: null, fmt: v => v.toFixed(1), unit: " dB" },
];
const FEATURE = Object.fromEntries(FEATURES.map(f => [f.key, f]));
const FEELING_ROWS = ["love", "joy", "sadness", "anger", "outside", "insufficient"];
const GENRE_ROWS = [...NAMED_GENRES, "Other"];
const I = k => FEELING[k].index;
const sadAngry = s => s.shares[I("sadness")] + s.shares[I("anger")];
const joyLove = s => s.shares[I("joy")] + s.shares[I("love")];

function pearson(a, b) {
  const ma = d3.mean(a), mb = d3.mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}

export function initSound(data, store, dialog) {
  const years = data.years.map(y => y.year).filter(y => y >= FIRST_YEAR);
  const last = years.at(-1);
  const state = { range: "all", feature: "valence", group: "feeling" };
  const yearOf = y => data.yearMap.get(y);

  // Songs with matched audio and annotated lyrics. Across several years a song appears once,
  // at its best rank; within one year each entry is one song.
  function songsFor(range) {
    const pick = new Map();
    for (const y of range === "all" ? years : [range]) {
      for (const e of data.entries.get(y)) {
        if (!e.audio || !e.song.shares) continue;
        const prev = pick.get(e.song.id);
        if (!prev || e.rank < prev.rank || (e.rank === prev.rank && e.year < prev.year)) pick.set(e.song.id, e);
      }
    }
    return [...pick.values()];
  }
  function coverage(range) {
    const ys = range === "all" ? years : [range];
    const matched = d3.sum(ys, y => yearOf(y).audio.matched), entries = d3.sum(ys, y => yearOf(y).entries);
    const withLyrics = d3.sum(ys, y => data.entries.get(y).filter(e => e.audio && e.song.shares).length);
    return { matched, entries, withLyrics };
  }
  const rangeLabel = r => (r === "all" ? `${years[0]}–${yearLabel(last, yearOf(last).est)}` : yearLabel(r, yearOf(r).est));

  // ── Stat tiles and copy ──
  function facts(list) {
    const sad = list.filter(e => sadAngry(e.song) >= 50), happy = list.filter(e => joyLove(e.song) >= 50);
    const bright = l => l.filter(e => e.audio.valence > 0.5).length;
    let best = null;
    for (const f of ["valence", "energy", "danceability", "acousticness"]) {
      for (const k of ["joy", "love", "sadness", "anger"]) {
        const r = pearson(list.map(e => e.song.shares[I(k)]), list.map(e => e.audio[f]));
        if (!best || Math.abs(r) > Math.abs(best.r)) best = { r, k, f };
      }
    }
    return { sad, happy, sadBright: bright(sad), happyBright: bright(happy), best, n: list.length };
  }
  const allFacts = facts(songsFor("all"));
  document.getElementById("sound-dek").replaceChildren(
    `Of the ${allFacts.sad.length} sampled hits from ${years[0]} through the ${last} estimate with at least half their lyric text labeled sad or angry by Astra, `,
    el("b", { text: pct(allFacts.sadBright / allFacts.sad.length * 100, 0) }),
    ` score above 0.5 on ReccoBeats valence, a model estimate of how positive the music sounds. `,
    `The strongest of the correlations we tested is ${FEELING[allFacts.best.k].label.toLowerCase()} and ${FEATURE[allFacts.best.f].label.toLowerCase()}, and even that is weak (r = ${allFacts.best.r.toFixed(2)}).`);
  const tiles = document.getElementById("sound-tiles");
  function drawTiles(f, range) {
    tiles.replaceChildren(
      el("div", { class: "tile-stat" }, el("p", { class: "ts-value", text: pct(f.sad.length ? f.sadBright / f.sad.length * 100 : 0, 0) }),
        el("p", { class: "ts-label", text: `of the ${f.sad.length} hits with at least half their lyric text labeled sad or angry score above 0.5 on valence` })),
      el("div", { class: "tile-stat" }, el("p", { class: "ts-value", text: pct(f.happy.length ? f.happyBright / f.happy.length * 100 : 0, 0) }),
        el("p", { class: "ts-label", text: `of the ${f.happy.length} hits with at least half their lyric text labeled joyful or loving score above 0.5 on valence` })),
      el("div", { class: "tile-stat" }, el("p", { class: "ts-value", text: `r = ${f.best.r >= 0 ? "+" : "−"}${Math.abs(f.best.r).toFixed(2)}` }),
        el("p", { class: "ts-label", text: `${FEELING[f.best.k].label} in the lyrics vs ${FEATURE[f.best.f].label.toLowerCase()}: the strongest correlation tested, ${rangeLabel(range)}` })));
  }

  // ── Controls ──
  const chipsHost = document.getElementById("sound-years");
  const rangeIds = ["all", ...years];
  chipsHost.append(...rangeIds.map(r => el("button", { type: "button", class: "chip", "data-range": r }, r === "all" ? rangeLabel("all") : yearLabel(r, yearOf(r).est))));
  chipsHost.addEventListener("click", evt => {
    const b = evt.target.closest("button[data-range]");
    if (!b) return;
    state.range = b.dataset.range === "all" ? "all" : +b.dataset.range;
    render(true);
  });
  const featSel = document.getElementById("sound-feature");
  featSel.append(...FEATURES.map(f => el("option", { value: f.key, text: f.label })));
  featSel.addEventListener("change", () => { state.feature = featSel.value; render(true); });
  const groupToggle = document.getElementById("sound-group");
  groupToggle.addEventListener("click", evt => {
    const b = evt.target.closest("button[data-group]");
    if (b) { state.group = b.dataset.group; render(true); }
  });

  // ── Beeswarm: one row per group; x is the feature value, exact; collisions move dots vertically ──
  const svgNode = document.getElementById("sound-swarm");
  const svg = d3.select(svgNode);
  const gAxis = svg.append("g").attr("class", "axis");
  const gRef = svg.append("g");
  const gRows = svg.append("g");
  const gDots = svg.append("g");
  const gHover = svg.append("g").attr("pointer-events", "none");
  const overlay = svg.append("rect").attr("fill", "transparent");
  let placed = [], delaunay = null;

  function rowsFor(list) {
    if (state.group === "feeling") {
      return FEELING_ROWS.map(k => ({ id: k, label: FEELING[k].label, color: FEELING[k].color, items: list.filter(e => e.song.main === k) }))
        .filter(r => r.items.length);
    }
    return GENRE_ROWS.map(g => ({
      id: g, label: g, color: GENRE_COLOR[g],
      items: list.filter(e => [...new Set(e.genres.map(genreBucket))].includes(g)),
    })).filter(r => r.items.length);
  }

  function render(animate) {
    const list = songsFor(state.range);
    const f = FEATURE[state.feature];
    for (const b of chipsHost.querySelectorAll("button")) b.setAttribute("aria-pressed", String(String(state.range) === b.dataset.range));
    for (const b of groupToggle.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.group === state.group));
    featSel.value = state.feature;
    document.getElementById("swarm-title").textContent = state.group === "feeling"
      ? `Every song’s ${f.label.toLowerCase()}, by the main feeling of its lyrics`
      : `Every song’s ${f.label.toLowerCase()}, by genre`;
    drawTiles(facts(list), state.range);
    drawSwarm(list, f, animate);
    drawExceptions(list);
    drawTable(list, f);
    const c = coverage(state.range);
    document.getElementById("sound-coverage").textContent =
      `${rangeLabel(state.range)}: audio features matched for ${c.matched} of ${c.entries} chart entries; ${c.withLyrics} of those also have annotated lyrics, ` +
      `shown here as ${list.length} songs${state.range === "all" ? " (a song that charted in several years appears once, at its best rank)" : ""}. ` +
      (state.range === "all" || yearOf(state.range).est ? "The 2026 estimate matched 65 of 100 entries, more often for higher-ranked songs. " : "") +
      (state.group === "genre" ? "A song with several genre tags appears in each of its rows." : "");
  }

  function drawSwarm(list, f, animate) {
    const W = svgNode.parentNode.clientWidth;
    if (W < 120) return;
    const narrow = W < 680;
    const m = { l: narrow ? 8 : 132, r: narrow ? 8 : 150, t: 34, b: 34 };
    const rad = narrow ? 3 : 4.2;
    const values = list.map(e => e.audio[f.key]);
    const domain = f.fixed || d3.extent(values);
    const x = d3.scaleLinear(domain, [m.l, W - m.r]);
    if (!f.fixed) x.nice();
    const rows = rowsFor(list);
    // Lay out each row's swarm on its own, then stack the rows.
    let y0 = m.t + 6;
    placed = [];
    const rowGeo = rows.map(row => {
      const nodes = row.items.map(e => ({ e, row, fx: x(e.audio[f.key]), y: ((e.song.index * 37) % 13) - 6 }));
      const sim = d3.forceSimulation(nodes).force("y", d3.forceY(0).strength(0.07))
        .force("c", d3.forceCollide(rad + 0.8).iterations(3)).stop();
      for (let i = 0; i < 180; i++) sim.tick();
      const ext = Math.max(rad * 2, d3.max(nodes, n => Math.abs(n.y)) + rad);
      const labelSpace = narrow ? 22 : 0;
      const top = y0 + labelSpace, mid = top + ext, h = labelSpace + ext * 2 + 18;
      for (const n of nodes) { n.x = n.fx; n.py = mid + n.y; placed.push(n); }
      const vals = row.items.map(e => e.audio[f.key]);
      const geo = { row, top: y0, mid, h, median: d3.median(vals), above: f.mid != null ? vals.filter(v => v > f.mid).length : null, n: vals.length };
      y0 += h;
      return geo;
    });
    const H = y0 + m.b;
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
      .attr("aria-label", `${f.label} of ${list.length} songs, ${rangeLabel(state.range)}, grouped by ${state.group === "feeling" ? "main lyric feeling" : "genre"}. Values are listed in the table view.`);

    // Axis (top and bottom labels for the feature's meaning)
    gAxis.attr("transform", `translate(0,${H - m.b + 4})`).call(d3.axisBottom(x).ticks(narrow ? 5 : 8).tickSizeOuter(0)
      .tickFormat(v => (f.fixed ? d3.format(".1f")(v) : `${f.fmt(v)}`)));
    gAxis.selectAll("text.ax-note").data([0]).join("text").attr("class", "ax-note").attr("x", W - m.r).attr("y", 28).attr("text-anchor", "end")
      .text(`${f.label}${f.unit ? ` (${f.unit.trim()})` : ""}`);
    gRef.selectAll("*").remove();
    gRef.append("text").attr("class", "sw-dir").attr("x", m.l).attr("y", 14).text(`← ${f.low}`);
    gRef.append("text").attr("class", "sw-dir").attr("x", W - m.r).attr("y", 14).attr("text-anchor", "end").text(`${f.high} →`);
    if (f.mid != null) {
      gRef.append("line").attr("x1", x(f.mid)).attr("x2", x(f.mid)).attr("y1", 20).attr("y2", H - m.b).attr("stroke", COLORS.ink2).attr("stroke-dasharray", "3 3");
      gRef.append("text").attr("class", "sw-mid").attr("x", x(f.mid) + 4).attr("y", 28).text(f.mid.toFixed(1));
    }

    // Rows: label, median tick, share above the midpoint
    const rowG = gRows.selectAll("g.sw-row").data(rowGeo, d => d.row.id).join(enter => {
      const g = enter.append("g").attr("class", "sw-row");
      g.append("line").attr("class", "sw-rule");
      g.append("text").attr("class", "sw-label");
      g.append("text").attr("class", "sw-n");
      g.append("line").attr("class", "sw-median");
      g.append("text").attr("class", "sw-stat");
      return g;
    });
    rowG.select(".sw-rule").attr("x1", narrow ? m.l : 0).attr("x2", W).attr("y1", d => d.top + d.h - 4).attr("y2", d => d.top + d.h - 4).attr("stroke", COLORS.paper3);
    rowG.select(".sw-label").attr("x", narrow ? m.l : 0).attr("y", d => (narrow ? d.top + 14 : d.mid - 2)).text(d => d.row.label);
    rowG.select(".sw-n").attr("x", narrow ? m.l + d3.max(rowGeo, g => g.row.label.length) * 7.2 + 8 : 0).attr("y", d => (narrow ? d.top + 14 : d.mid + 13))
      .text(d => `${d.n} song${d.n > 1 ? "s" : ""}`);
    rowG.select(".sw-median").attr("x1", d => x(d.median)).attr("x2", d => x(d.median)).attr("y1", d => d.mid - (d.h - 18) / 2 - 2 + (narrow ? 11 : 0)).attr("y2", d => d.mid + (d.h - 18) / 2 + 2)
      .attr("stroke", COLORS.ink).attr("stroke-width", 2);
    rowG.select(".sw-stat").attr("x", narrow ? W - m.r : W - m.r + 12).attr("y", d => (narrow ? d.top + 14 : d.mid + 4)).attr("text-anchor", narrow ? "end" : "start")
      .text(d => `median ${f.fmt(d.median)}${f.mid != null ? ` · ${pct(d.above / d.n * 100, 0)} above ${f.mid}` : ""}`);

    // Dots
    const t = animate && !reducedMotion() ? 600 : 0;
    gDots.selectAll("circle").data(placed, n => `${n.row.id}|${n.e.song.id}`).join(
      enter => enter.append("circle").attr("r", 0).attr("cx", n => n.x).attr("cy", n => n.py),
      update => update,
      exit => exit.transition().duration(t / 2).attr("r", 0).remove(),
    ).attr("fill", n => n.row.color).attr("stroke", COLORS.paper).attr("stroke-width", 0.8)
      .transition().duration(t).attr("cx", n => n.x).attr("cy", n => n.py).attr("r", rad);

    // Nearest-dot hover and click (dots are small; the hit area is the whole plot)
    delaunay = d3.Delaunay.from(placed, n => n.x, n => n.py);
    overlay.attr("x", 0).attr("y", 0).attr("width", W).attr("height", H - m.b).style("cursor", "pointer");
    const nearest = evt => {
      const [px, py] = d3.pointer(evt, svgNode);
      const i = delaunay.find(px, py);
      const n = placed[i];
      return n && Math.hypot(n.x - px, n.py - py) < 14 ? n : null;
    };
    overlay.on("pointermove", evt => {
      const n = nearest(evt);
      gHover.selectAll("*").remove();
      if (!n) { hideTip(); return; }
      for (const o of placed.filter(p => p.e.song.id === n.e.song.id)) {
        gHover.append("circle").attr("cx", o.x).attr("cy", o.py).attr("r", rad + 3.5).attr("fill", "none").attr("stroke", COLORS.ink).attr("stroke-width", 2);
      }
      showTip(dotTip(n.e, f), evt.clientX, evt.clientY);
    }).on("pointerleave", () => { gHover.selectAll("*").remove(); hideTip(); })
      .on("click", evt => {
        const n = nearest(evt);
        if (!n) return;
        hideTip();
        const rowList = n.row.items.slice().sort((a, b) => a.audio[f.key] - b.audio[f.key]);
        dialog.open(n.e, rowList, { source: "sound" });
      });
  }

  function dotTip(e, f) {
    const s = e.song;
    const top = FEELINGS.map((k, i) => ({ k, v: s.shares[i] })).filter(d => d.v >= 1).sort((a, b) => b.v - a.v).slice(0, 3);
    return [
      el("div", { class: "tt-head", text: e.title }),
      el("div", { class: "tt-sub", text: `${e.artist} · No. ${e.rank}, ${yearLabel(e.year, yearOf(e.year).est)}` }),
      tipRow(COLORS.ink, f.fmt(e.audio[f.key]) + f.unit, f.label.toLowerCase()),
      ...top.map(d => tipRow(d.k.color, pct(d.v, 0), `${d.k.label.toLowerCase()} in the lyrics`)),
      el("div", { class: "tt-note", text: "Click to open the record" }),
    ];
  }

  // ── Exceptions: songs whose words and sound disagree most ──
  function drawExceptions(list) {
    const sad = list.filter(e => sadAngry(e.song) >= 60 && e.audio.valence > 0.5).sort((a, b) => b.audio.valence - a.audio.valence).slice(0, 6);
    const glad = list.filter(e => joyLove(e.song) >= 60 && e.audio.valence <= 0.5).sort((a, b) => a.audio.valence - b.audio.valence).slice(0, 6);
    fill("exc-sad", sad, e => `${pct(sadAngry(e.song), 0)} sad or angry lyrics · valence ${e.audio.valence.toFixed(2)}`);
    fill("exc-glad", glad, e => `${pct(joyLove(e.song), 0)} joyful or loving lyrics · valence ${e.audio.valence.toFixed(2)}`);
    function fill(id, items, line) {
      const host = document.getElementById(id);
      if (!items.length) { host.replaceChildren(el("li", { class: "fine", text: "No songs in this selection." })); return; }
      host.replaceChildren(...items.map(e => {
        const svg = document.createElementNS(SVGNS, "svg");
        svg.setAttribute("viewBox", "-50 -50 100 100");
        svg.setAttribute("aria-hidden", "true");
        const g = document.createElementNS(SVGNS, "g");
        svg.append(g);
        drawSongRecord(g, e.song, { rank: e.rank });
        const open = el("button", { type: "button", class: "exc-open", "aria-label": `Open ${e.title} by ${e.artist}` },
          svg,
          el("span", { class: "exc-title", text: e.title }),
          el("span", { class: "exc-artist", text: `${e.artist} · No. ${e.rank}, ${yearLabel(e.year, yearOf(e.year).est)}` }),
          el("span", { class: "exc-line", text: line(e) }));
        open.addEventListener("click", () => dialog.open(e, items, { source: "sound" }));
        return el("li", {}, open, el("div", { class: "exc-listen" }, listenLink(e)));
      }));
    }
  }

  // ── Table view ──
  function drawTable(list, f) {
    const table = document.getElementById("sound-table");
    document.getElementById("sound-table-summary").textContent = `Table view: ${list.length} songs, ${rangeLabel(state.range)}, sorted by ${f.label.toLowerCase()}`;
    const sorted = list.slice().sort((a, b) => b.audio[f.key] - a.audio[f.key]);
    table.replaceChildren(
      el("thead", {}, el("tr", {}, ...["Song", "Year · rank", "Main lyric feeling", ...FEATURES.map(x => x.label)].map(t => el("th", { scope: "col", text: t })))),
      el("tbody", {}, ...sorted.map(e => {
        const btn = el("button", { type: "button", class: "link-btn", text: `${e.title} — ${e.artist}` });
        btn.addEventListener("click", () => dialog.open(e, sorted, { source: "sound" }));
        return el("tr", {},
          el("th", { scope: "row" }, btn),
          el("td", { text: `${yearLabel(e.year, yearOf(e.year).est)} · ${e.rank}` }),
          el("td", { text: FEELING[e.song.main].label }),
          ...FEATURES.map(x => el("td", { text: x.fmt(e.audio[x.key]) + x.unit })));
      })));
  }

  // Resize
  let lastW = 0;
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w === lastW) return;
    lastW = w;
    render(false);
  }).observe(document.getElementById("sound"));
  render(false);
  return { songsFor, facts };
}
