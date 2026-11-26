// Track 03 · Who sang them. Origins of credited artists: strip → map → treemap → songs.
import { NAMED_GENRES, GENRE_COLOR, genreBucket, COLORS, pct, yearLabel, el, showTip, hideTip, tipRow, textOn, reducedMotion } from "./core.js";
import { drawSongRecord } from "./record.js";

const SVGNS = "http://www.w3.org/2000/svg";
const GENRE_ORDER = [...NAMED_GENRES, "Other"];
const regionName = new Intl.DisplayNames(["en"], { type: "region" });
const SHORT = { US: "U.S.", GB: "U.K.", KR: "South Korea", NL: "Netherlands", DO: "Dominican Rep.", TT: "Trinidad & Tobago", VC: "St. Vincent", BA: "Bosnia" };
const nameOf = code => regionName.of(code) || code;
const shortName = code => SHORT[code] || nameOf(code);
// Origins too small for the 110m basemap still get a record at their coordinates.
const OFF_MAP = { BB: [-59.54, 13.19], IM: [-4.55, 54.24], SG: [103.82, 1.35], VC: [-61.2, 13.25] };
const UK_INK = COLORS.ink, ELSEWHERE = "#a39a8d";
const ORIGIN_LABEL = { b: "Born in", f: "Formed in", o: "From" };

// ── Aggregation ─────────────────────────────────────────────────────────
// Each chart entry counts once for each credited artist ("appearances").
function periodStats(data, from, to) {
  const byArtist = new Map();
  for (let y = from; y <= to; y++) {
    for (const e of data.entries.get(y) || []) {
      for (const artist of e.song.artists) {
        let r = byArtist.get(artist);
        if (!r) byArtist.set(artist, (r = { artist, entries: [], weight: new Map() }));
        r.entries.push(e);
        for (const g of e.genres) {
          const k = genreBucket(g);
          r.weight.set(k, (r.weight.get(k) || 0) + 1 / e.genres.length);
        }
      }
    }
  }
  const byOrigin = new Map();
  let unknown = 0;
  for (const r of byArtist.values()) {
    r.main = [...r.weight].sort((a, b) => b[1] - a[1] || GENRE_ORDER.indexOf(a[0]) - GENRE_ORDER.indexOf(b[0]))[0]?.[0] || "Other";
    const code = r.artist.code;
    if (!code) { unknown += 1; continue; }
    let o = byOrigin.get(code);
    if (!o) byOrigin.set(code, (o = { code, artists: [], appearances: 0 }));
    o.artists.push(r);
    o.appearances += r.entries.length;
  }
  for (const o of byOrigin.values()) {
    o.artists.sort((a, b) => b.entries.length - a.entries.length || a.artist.name.localeCompare(b.artist.name));
  }
  const known = d3.sum([...byOrigin.values()], o => o.artists.length);
  const origins = [...byOrigin.values()].sort((a, b) => b.artists.length - a.artists.length || a.code.localeCompare(b.code));
  return { from, to, byArtist, byOrigin, origins, unknown, known, total: byArtist.size };
}

function periodText(from, to, data) {
  const est = y => data.yearMap.get(y).est;
  return from === to ? yearLabel(from, est(from)) : `${from}–${yearLabel(to, est(to))}`;
}

// ── Chapter ─────────────────────────────────────────────────────────────
export function initOrigins(data, world, store, dialog, initialYear) {
  const years = data.years.map(y => y.year);
  const first = years[0], last = years.at(-1);
  const yearly = years.map(y => {
    const s = periodStats(data, y, y);
    const us = s.byOrigin.get("US")?.artists.length || 0;
    const uk = s.byOrigin.get("GB")?.artists.length || 0;
    return { year: y, est: data.yearMap.get(y).est, known: s.known, total: s.total, unknown: s.unknown, us, uk, elsewhere: s.known - us - uk };
  });
  const all = periodStats(data, first, last);
  const facts = originFacts(yearly, all);
  writeDek(facts, all);

  const ERAS = [
    { id: "all", label: "All years", from: first, to: last },
    { id: "invasion", label: "British Invasion", from: 1964, to: 1966 },
    { id: "peak", label: `${facts.peak.year}: the peak`, from: facts.peak.year, to: facts.peak.year },
    { id: "usa", label: "Made in the USA", from: facts.low.from, to: facts.low.to },
    { id: "now", label: "Now", from: 2022, to: last },
  ];

  const state = { from: first, to: last, origin: "GB", artist: null, stats: all };
  const views = {
    controls: rangeControls(),
    strip: strip(),
    map: originMap(),
    tree: treemap(),
    artist: artistPanel(),
    table: originTable(),
  };

  function setPeriod(from, to, { keepOrigin = true, keepArtist = true } = {}) {
    if (from > to) [from, to] = [to, from];
    if (!keepArtist) state.artist = null;
    state.from = from; state.to = to;
    state.stats = periodStats(data, from, to);
    const has = code => state.stats.byOrigin.has(code);
    if (!keepOrigin || !has(state.origin)) {
      const foreign = state.stats.origins.find(o => o.code !== "US");
      state.origin = (foreign || state.stats.origins[0] || {}).code || null;
    }
    pickDefaultArtist();
    render();
  }
  function setOrigin(code) {
    if (!state.stats.byOrigin.has(code)) return;
    state.origin = code;
    pickDefaultArtist();
    render(["map", "tree", "artist", "table"]);
  }
  function setArtist(artist) {
    state.artist = artist;
    render(["tree", "artist"]);
  }
  function pickDefaultArtist() {
    const o = state.stats.byOrigin.get(state.origin);
    const still = o && state.artist && o.artists.find(r => r.artist === state.artist);
    state.artist = still ? state.artist : (o ? o.artists[0].artist : null);
  }
  function render(which = Object.keys(views)) {
    for (const k of which) views[k].update(state);
  }

  // ── Era chips and From/To selects ──
  function rangeControls() {
    const chips = document.getElementById("era-chips");
    const fromSel = document.getElementById("from-year"), toSel = document.getElementById("to-year");
    for (const sel of [fromSel, toSel]) {
      for (const y of data.years) sel.append(el("option", { value: y.year, text: yearLabel(y.year, y.est) }));
    }
    chips.append(...ERAS.map(e => el("button", { type: "button", class: "chip", "data-era": e.id }, e.label)));
    chips.addEventListener("click", evt => {
      const btn = evt.target.closest("button[data-era]");
      if (!btn) return;
      const era = ERAS.find(e => e.id === btn.dataset.era);
      setPeriod(era.from, era.to, { keepOrigin: era.id === "all", keepArtist: false });
    });
    fromSel.addEventListener("change", () => setPeriod(+fromSel.value, Math.max(+fromSel.value, state.to)));
    toSel.addEventListener("change", () => setPeriod(Math.min(state.from, +toSel.value), +toSel.value));
    return {
      update(s) {
        fromSel.value = s.from; toSel.value = s.to;
        for (const b of chips.querySelectorAll("button")) {
          const era = ERAS.find(e => e.id === b.dataset.era);
          b.setAttribute("aria-pressed", String(era.from === s.from && era.to === s.to));
        }
      },
    };
  }

  // ── Strip: non-US share by year, brushable ──
  function strip() {
    const svgNode = document.getElementById("origin-strip");
    const svg = d3.select(svgNode);
    const root = svg.append("g");
    const gGrid = root.append("g"), gBars = root.append("g"), gNotes = root.append("g"), gAxis = root.append("g").attr("class", "axis");
    const gBrush = root.append("g").attr("class", "brush");
    let x, y, innerW, innerH, brush, silent = false;
    document.getElementById("origin-strip-desc").textContent =
      `Bar chart of the share of each year's credited artists with a documented origin outside the United States, ${first} to ${last}. ` +
      `The share peaked at ${pct(facts.peak.share * 100, 0)} in ${facts.peak.year}; Britain accounts for most of it in nearly every year. Use the era buttons or the From and To menus to choose years.`;

    function layout() {
      const W = svgNode.parentNode.clientWidth;
      if (W < 120) return;
      const narrow = W < 640;
      const m = { top: 30, right: 8, bottom: 26, left: narrow ? 30 : 38 };
      const H = narrow ? 170 : 200;
      innerW = W - m.left - m.right; innerH = H - m.top - m.bottom;
      svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      root.attr("transform", `translate(${m.left},${m.top})`);
      x = d3.scaleBand(years, [0, innerW]).paddingInner(0.18);
      y = d3.scaleLinear([0, 0.55], [innerH, 0]);
      gGrid.selectAll("line").data([0, 0.25, 0.5]).join("line").attr("x1", -4).attr("x2", innerW)
        .attr("y1", d => y(d)).attr("y2", d => y(d)).attr("stroke", COLORS.paper3);
      gGrid.selectAll("text").data([0, 0.25, 0.5]).join("text").attr("x", -8).attr("y", d => y(d)).attr("dy", "0.32em")
        .attr("text-anchor", "end").style("font-size", "11px").style("fill", COLORS.ink2).text(d => (d ? `${d * 100}%` : "0"));
      const bars = gBars.selectAll("g").data(yearly, d => d.year).join(enter => {
        const g = enter.append("g");
        g.append("rect").attr("class", "uk");
        g.append("rect").attr("class", "else");
        return g;
      }).attr("transform", d => `translate(${x(d.year)},0)`).attr("opacity", d => (d.est ? 0.55 : 1));
      bars.select(".uk").attr("width", x.bandwidth()).attr("y", d => y(d.uk / d.known)).attr("height", d => innerH - y(d.uk / d.known)).attr("fill", UK_INK);
      bars.select(".else").attr("width", x.bandwidth())
        .attr("y", d => y((d.uk + d.elsewhere) / d.known)).attr("height", d => Math.max(0, y(d.uk / d.known) - y((d.uk + d.elsewhere) / d.known) - (d.elsewhere ? 1 : 0)))
        .attr("fill", ELSEWHERE);
      const ticks = years.filter(v => v % 10 === 0);
      gAxis.attr("transform", `translate(0,${innerH})`);
      gAxis.selectAll("text").data([...ticks, last]).join("text").attr("x", d => x(d) + x.bandwidth() / 2).attr("y", 16)
        .attr("text-anchor", "middle").text(d => (d === last ? (narrow ? "’26e" : `${last} est.`) : d));
      gAxis.selectAll("line").data([0]).join("line").attr("x2", innerW).attr("stroke", COLORS.ink2);

      // Notes: the peak, and the long low stretch.
      const p = yearly.find(d => d.year === facts.peak.year);
      const notes = [
        { x: x(p.year) + x.bandwidth() / 2, y: y((p.uk + p.elsewhere) / p.known) - 6, text: `${p.year}: ${pct(facts.peak.share * 100, 0)} from outside the U.S.`, anchor: "middle" },
        { x: x(facts.low.from), y: y(facts.low.max) - 8, text: narrow ? `Under ${underPct(facts.low.max)}% every year` : `${facts.low.from}–${facts.low.to}: under ${underPct(facts.low.max)}% every year`, anchor: "start" },
      ];
      gNotes.selectAll("text").data(notes).join("text").attr("class", "era-label").attr("x", d => d.x).attr("y", d => d.y)
        .attr("text-anchor", d => d.anchor).text(d => d.text);
      gNotes.selectAll("line").data([facts.low]).join("line").attr("class", "era-rule")
        .attr("x1", d => x(d.from)).attr("x2", d => x(d.to) + x.bandwidth()).attr("y1", d => y(d.max) - 4).attr("y2", d => y(d.max) - 4);

      brush = d3.brushX().extent([[0, -4], [innerW, innerH]])
        .on("brush", evt => { if (evt.sourceEvent) hideTip(); })
        .on("end", evt => {
          if (silent || !evt.sourceEvent) return;
          if (!evt.selection) { // a click without dragging picks that one year
            const yr = yearAt(d3.pointer(evt.sourceEvent, root.node())[0]);
            setPeriod(yr, yr);
            return;
          }
          const [x0, x1] = evt.selection;
          setPeriod(yearAt(x0 + 1), yearAt(x1 - 1));
        });
      gBrush.call(brush);
      gBrush.select(".selection").attr("fill", COLORS.ink).attr("fill-opacity", 0.05).attr("stroke", COLORS.ink).attr("stroke-width", 1);
      gBrush.on("pointermove", evt => {
        const yr = yearAt(d3.pointer(evt, root.node())[0]);
        const d = yearly.find(v => v.year === yr);
        showTip([
          el("div", { class: "tt-head", text: yearLabel(d.year, d.est) }),
          el("div", { class: "tt-sub", text: `${d.known} of ${d.total} credited artists with a documented origin` }),
          tipRow(UK_INK, pct(d.uk / d.known * 100), `U.K. (${d.uk})`),
          tipRow(ELSEWHERE, pct(d.elsewhere / d.known * 100), `elsewhere outside the U.S. (${d.elsewhere})`),
          tipRow("#d4c9b6", pct(d.us / d.known * 100), `U.S. (${d.us})`),
          el("div", { class: "tt-note", text: "Drag to choose years · click for one year" }),
        ], evt.clientX, evt.clientY);
      }).on("pointerleave", hideTip);
      update(state);
    }
    function yearAt(px) {
      const step = x.step();
      const i = Math.max(0, Math.min(years.length - 1, Math.floor((px - x.paddingOuter() * step) / step)));
      return years[i];
    }
    function update(s) {
      if (!x) return;
      silent = true;
      gBrush.call(brush.move, [Math.max(0, x(s.from) - 1), Math.min(innerW, x(s.to) + x.bandwidth() + 1)]);
      silent = false;
    }
    return { update, resize: layout, init: layout() };
  }

  // ── Map: one record per origin, sized by distinct artists ──
  function originMap() {
    const svgNode = document.getElementById("origin-map");
    const svg = d3.select(svgNode);
    const gLand = svg.append("g"), gRecs = svg.append("g");
    const legend = document.getElementById("map-legend");
    const title = document.getElementById("map-title");
    const land = world.features.filter(f => f.properties.code !== "AQ").map(rewind);
    const centroid = new Map(land.map(f => [f.properties.code, d3.geoCentroid(largestPolygon(f))]));
    for (const [code, lonlat] of Object.entries(OFF_MAP)) centroid.set(code, lonlat);
    let projection, path, W = 0, H = 0, rMax = 40;
    const positions = new Map();

    function layout() {
      W = svgNode.parentNode.clientWidth;
      if (W < 120) return;
      H = Math.round(Math.min(560, W * 0.5));
      rMax = Math.max(22, Math.min(58, W * 0.05));
      svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      projection = d3.geoEqualEarth().fitExtent([[6, 6], [W - 6, H - 6]], { type: "FeatureCollection", features: land });
      path = d3.geoPath(projection);
      gLand.selectAll("path").data(land, f => f.properties.code).join("path")
        .attr("d", path).attr("fill", "#e6decf").attr("stroke", COLORS.paper).attr("stroke-width", 0.6);
      positions.clear();
      update(state, false);
    }

    function update(s, animate = true) {
      if (!projection) return;
      const stats = s.stats;
      const maxN = d3.max(stats.origins, o => o.artists.length) || 1;
      const r = d3.scaleSqrt([0, maxN], [0, rMax]);
      const nodes = stats.origins.filter(o => centroid.has(o.code)).map(o => {
        const [x0, y0] = projection(centroid.get(o.code));
        const prev = positions.get(o.code);
        return { ...o, x0, y0, x: prev ? prev[0] : x0, y: prev ? prev[1] : y0, r: Math.max(2.8, r(o.artists.length)) };
      });
      const sim = d3.forceSimulation(nodes)
        .force("x", d3.forceX(d => d.x0).strength(0.4))
        .force("y", d3.forceY(d => d.y0).strength(0.4))
        .force("collide", d3.forceCollide(d => d.r + 1.4).iterations(3))
        .stop();
      for (let i = 0; i < 220; i++) sim.tick();
      for (const n of nodes) {
        n.x = Math.max(n.r + 2, Math.min(W - n.r - 2, n.x));
        n.y = Math.max(n.r + 2, Math.min(H - n.r - 2, n.y));
        positions.set(n.code, [n.x, n.y]);
      }

      gLand.selectAll("path").attr("fill", f => (f.properties.code === s.origin ? "#d6cab3" : "#e6decf"))
        .attr("stroke", f => (f.properties.code === s.origin ? COLORS.ink : COLORS.paper))
        .attr("stroke-width", f => (f.properties.code === s.origin ? 1.2 : 0.6));
      gLand.selectAll("path").filter(f => f.properties.code === s.origin).raise();

      const t = animate && !reducedMotion() ? 600 : 0;
      const recs = gRecs.selectAll("g.origin-rec").data(nodes, d => d.code).join(
        enter => {
          const g = enter.append("g").attr("class", "origin-rec").attr("transform", d => `translate(${d.x},${d.y})`)
            .attr("role", "button").attr("tabindex", 0);
          g.append("circle").attr("class", "hit").attr("fill", "transparent");
          g.append("circle").attr("class", "disc").attr("fill", COLORS.vinyl).attr("r", 0);
          g.append("circle").attr("class", "groove").attr("fill", "none").attr("stroke", COLORS.grooveEmpty).attr("stroke-width", 1);
          g.append("circle").attr("class", "lab").attr("fill", COLORS.label);
          g.append("text").attr("class", "o-count").attr("text-anchor", "middle").attr("dy", "0.34em");
          g.append("text").attr("class", "o-name").attr("text-anchor", "middle");
          g.append("circle").attr("class", "ring").attr("fill", "none").attr("stroke", COLORS.ink).attr("stroke-width", 2.2);
          return g;
        },
        update => update,
        exit => exit.transition().duration(t).attr("opacity", 0).remove(),
      );
      recs.attr("aria-label", d => `${nameOf(d.code)}: ${d.artists.length} artists, ${pct(d.artists.length / stats.known * 100)} of artists with a documented origin`);
      recs.transition().duration(t).attr("transform", d => `translate(${d.x},${d.y})`).attr("opacity", 1);
      recs.select(".hit").attr("r", d => Math.max(d.r + 3, 9));
      recs.select(".disc").transition().duration(t).attr("r", d => d.r);
      recs.select(".groove").attr("r", d => d.r * 0.7).attr("opacity", d => (d.r >= 7 ? 1 : 0));
      recs.select(".lab").transition().duration(t).attr("r", d => (d.r >= 7 ? d.r * 0.36 : 0));
      recs.select(".o-count").text(d => (d.r >= 19 ? d.artists.length : ""))
        .style("font-size", d => `${Math.min(13, Math.max(9, d.r * 0.28))}px`);
      recs.select(".o-name").attr("y", d => d.r + 12).text(d => (d.r >= 12 || d.code === s.origin ? shortName(d.code) : ""));
      recs.select(".ring").attr("r", d => d.r + 4).attr("opacity", d => (d.code === s.origin ? 1 : 0));
      recs.on("click", (evt, d) => setOrigin(d.code))
        .on("keydown", (evt, d) => { if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); setOrigin(d.code); } })
        .on("pointermove", (evt, d) => showTip(originTip(d, stats), evt.clientX, evt.clientY))
        .on("pointerleave", hideTip)
        .on("focus", function (evt, d) { const b = this.getBoundingClientRect(); showTip(originTip(d, stats), b.right, b.top); })
        .on("blur", hideTip);
      recs.filter(d => d.code === s.origin).raise();

      title.textContent = `Where the ${periodText(s.from, s.to, data)} artists came from`;
      const refs = [1, 10, 100, 1000].filter(v => v <= maxN).slice(-3);
      legend.replaceChildren(
        el("span", { class: "ml-label", text: "Distinct artists" }),
        ...refs.map(v => {
          const rr = Math.max(2.8, r(v));
          const s2 = document.createElementNS(SVGNS, "svg");
          s2.setAttribute("width", rr * 2 + 2); s2.setAttribute("height", rr * 2 + 2);
          s2.setAttribute("aria-hidden", "true");
          const c = document.createElementNS(SVGNS, "circle");
          c.setAttribute("cx", rr + 1); c.setAttribute("cy", rr + 1); c.setAttribute("r", rr); c.setAttribute("fill", COLORS.vinyl);
          s2.append(c);
          return el("span", { class: "ml-item" }, s2, String(v));
        }),
        el("span", { class: "ml-note", text: stats.unknown ? `${stats.unknown} artist${stats.unknown > 1 ? "s" : ""} with no documented origin ${stats.unknown > 1 ? "are" : "is"} not mapped.` : "Every artist in this period has a documented origin." }),
        el("span", { class: "ml-note", text: "Barbados, the Isle of Man, Singapore and St. Vincent are too small for the basemap; their records sit at their coordinates." }),
      );
    }
    return { update, resize: layout, init: layout() };
  }

  function originTip(d, stats) {
    const top = d.artists.slice(0, 3).map(r => `${r.artist.name} ${r.entries.length}`).join(" · ");
    return [
      el("div", { class: "tt-head", text: nameOf(d.code) }),
      el("div", { class: "tt-sub", text: periodText(stats.from, stats.to, data) }),
      tipRow(COLORS.vinyl, String(d.artists.length), `artists · ${pct(d.artists.length / stats.known * 100)} of those with a documented origin`),
      tipRow(COLORS.vinyl, String(d.appearances), "chart appearances"),
      el("div", { class: "tt-note", text: `Top: ${top}` }),
    ];
  }

  // ── Treemap: the selected origin's artists, colored by main chart genre ──
  function treemap() {
    const host = document.getElementById("origin-tree");
    const head = document.getElementById("tree-head");
    const select = document.getElementById("origin-select");
    const legend = document.getElementById("tree-legend");
    const svg = d3.select(host).append("svg").attr("role", "group");
    select.addEventListener("change", () => setOrigin(select.value));

    function update(s) {
      const stats = s.stats;
      select.replaceChildren(...stats.origins.map(o => el("option", { value: o.code, text: `${nameOf(o.code)} (${o.artists.length})` })));
      select.value = s.origin || "";
      const o = stats.byOrigin.get(s.origin);
      if (!o) { svg.selectAll("*").remove(); head.textContent = "No artists in this period"; return; }
      head.replaceChildren(el("b", { text: nameOf(o.code) }),
        ` · ${o.artists.length} artist${o.artists.length > 1 ? "s" : ""} · ${o.appearances} chart appearance${o.appearances > 1 ? "s" : ""} · ${periodText(s.from, s.to, data)}`);
      const W = host.clientWidth || 600, H = Math.round(Math.max(260, Math.min(440, W * 0.62)));
      svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
        .attr("aria-label", `Treemap of ${o.artists.length} artists from ${nameOf(o.code)}, sized by chart appearances`);
      const groups = d3.groups(o.artists, r => r.main).sort((a, b) => GENRE_ORDER.indexOf(a[0]) - GENRE_ORDER.indexOf(b[0]));
      const root = d3.hierarchy({ children: groups.map(([genre, children]) => ({ genre, children })) })
        .sum(d => (d.entries ? d.entries.length : 0))
        .sort((a, b) => b.value - a.value);
      d3.treemap().size([W, H]).tile(d3.treemapSquarify.ratio(1.3)).paddingInner(2)
        .paddingTop(n => (n.depth === 1 && n.value / root.value > 0.06 ? 17 : 0))(root);
      const leaves = root.leaves();
      const cells = svg.selectAll("g.tile").data(leaves, d => d.data.artist.index).join(enter => {
        const g = enter.append("g").attr("class", "tile");
        g.append("rect");
        g.append("text").attr("class", "t-name").attr("x", 5).attr("y", 14);
        g.append("text").attr("class", "t-count").attr("x", 5).attr("y", 27);
        return g;
      }).attr("transform", d => `translate(${d.x0},${d.y0})`);
      cells.select("rect").attr("width", d => Math.max(0, d.x1 - d.x0)).attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("rx", 2).attr("fill", d => GENRE_COLOR[d.data.main])
        .attr("stroke", d => (d.data.artist === s.artist ? COLORS.ink : "none")).attr("stroke-width", 3);
      const fits = (d, line) => d.x1 - d.x0 > 44 && d.y1 - d.y0 > (line === 1 ? 20 : 33);
      const clip = (text, w) => { const max = Math.floor((w - 10) / 6.3); return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`; };
      cells.select(".t-name").attr("fill", d => textOn(GENRE_COLOR[d.data.main]))
        .text(d => (fits(d, 1) ? clip(d.data.artist.name, d.x1 - d.x0) : ""));
      cells.select(".t-count").attr("fill", d => textOn(GENRE_COLOR[d.data.main]))
        .text(d => (fits(d, 2) ? d.data.entries.length : ""));
      cells.style("cursor", "pointer")
        .on("click", (evt, d) => setArtist(d.data.artist))
        .on("pointermove", (evt, d) => showTip([
          el("div", { class: "tt-head", text: d.data.artist.name }),
          el("div", { class: "tt-sub", text: `${d.data.artist.place || nameOf(o.code)} · main chart genre: ${d.data.main}` }),
          tipRow(GENRE_COLOR[d.data.main], String(d.data.entries.length), `chart appearance${d.data.entries.length > 1 ? "s" : ""} · ${pct(d.value / root.value * 100)} of this origin`),
          el("div", { class: "tt-note", text: "Click to see the songs" }),
        ], evt.clientX, evt.clientY))
        .on("pointerleave", hideTip);
      const groupNodes = root.children.filter(n => n.y0 + 17 <= n.y1 && n.value / root.value > 0.06);
      svg.selectAll("text.g-label").data(groupNodes, d => d.data.genre).join("text").attr("class", "g-label")
        .attr("x", d => d.x0 + 2).attr("y", d => d.y0 + 12).text(d => `${d.data.genre} · ${d.value}`);
      const present = groups.map(g => g[0]);
      legend.replaceChildren(...present.map(g => el("span", {}, el("i", { style: `background:${GENRE_COLOR[g]}` }), g)));
    }
    return { update, resize: () => update(state) };
  }

  // ── Artist panel: songs as records ──
  function artistPanel() {
    const box = document.getElementById("artist-detail");
    const select = document.getElementById("artist-select");
    select.addEventListener("change", () => {
      const o = state.stats.byOrigin.get(state.origin);
      const r = o && o.artists.find(a => String(a.artist.index) === select.value);
      if (r) setArtist(r.artist);
    });
    function update(s) {
      const o = s.stats.byOrigin.get(s.origin);
      select.replaceChildren(...(o ? o.artists : []).map(r => el("option", { value: r.artist.index, text: `${r.artist.name} (${r.entries.length})` })));
      if (!o || !s.artist) { box.replaceChildren(el("p", { class: "fine", text: "Select an artist tile to see their songs." })); return; }
      select.value = s.artist.index;
      const r = s.stats.byArtist.get(s.artist);
      const a = s.artist;
      const entries = r.entries.slice().sort((p, q) => p.year - q.year || p.rank - q.rank);
      const allTime = data.years.reduce((t, y) => t + data.entries.get(y.year).filter(e => e.song.artists.includes(a)).length, 0);
      const list = el("ol", { class: "artist-songs" }, ...entries.map(e => {
        const svg = document.createElementNS(SVGNS, "svg");
        svg.setAttribute("viewBox", "-50 -50 100 100");
        svg.setAttribute("aria-hidden", "true");
        const g = document.createElementNS(SVGNS, "g");
        svg.append(g);
        drawSongRecord(g, e.song, { rank: e.rank });
        const btn = el("button", { type: "button", "aria-label": `Open ${e.title}, No. ${e.rank} in ${yearLabel(e.year, data.yearMap.get(e.year).est)}` },
          svg, el("span", { class: "as-meta", text: `No. ${e.rank} · ${yearLabel(e.year, data.yearMap.get(e.year).est)}` }), el("span", { class: "as-title", text: e.title }));
        btn.addEventListener("click", () => dialog.open(e, entries, { source: "origins" }));
        return el("li", {}, btn);
      }));
      box.replaceChildren(
        el("h4", { class: "artist-name", text: a.name }),
        el("p", { class: "artist-origin" },
          a.place ? `${ORIGIN_LABEL[a.originType] || "From"} ${a.place}` : nameOf(a.code),
          a.wiki ? el("span", { class: "fine", text: ` · Wikipedia: ${a.wiki}` }) : null),
        el("p", { class: "artist-count" }, el("b", { text: String(entries.length) }),
          ` chart appearance${entries.length > 1 ? "s" : ""} in ${periodText(s.from, s.to, data)}`,
          allTime !== entries.length ? ` · ${allTime} across all years` : ""),
        list);
    }
    return { update };
  }

  // ── Table view ──
  function originTable() {
    const table = document.getElementById("origin-table");
    const caption = document.getElementById("origin-table-summary");
    function update(s) {
      caption.textContent = `Table view: ${s.stats.origins.length} origins, ${periodText(s.from, s.to, data)}`;
      table.replaceChildren(
        el("thead", {}, el("tr", {}, ...["Origin", "Artists", "Share of documented", "Appearances", "Top artist"].map(t => el("th", { scope: "col", text: t })))),
        el("tbody", {}, ...s.stats.origins.map(o => el("tr", {},
          el("th", { scope: "row", text: nameOf(o.code) }),
          el("td", { text: String(o.artists.length) }),
          el("td", { text: pct(o.artists.length / s.stats.known * 100) }),
          el("td", { text: String(o.appearances) }),
          el("td", { text: `${o.artists[0].artist.name} (${o.artists[0].entries.length})` }))),
          ...(s.stats.unknown ? [el("tr", {}, el("th", { scope: "row", text: "No documented origin" }), el("td", { text: String(s.stats.unknown) }), el("td", { text: "—" }), el("td", { text: "—" }), el("td", { text: "—" }))] : [])));
    }
    return { update };
  }

  // Summary line under the strip
  const summary = document.getElementById("origin-summary");
  const summaryView = {
    update(s) {
      const st = s.stats;
      const us = st.byOrigin.get("US")?.artists.length || 0, uk = st.byOrigin.get("GB")?.artists.length || 0;
      summary.replaceChildren(el("b", { text: periodText(s.from, s.to, data) }), " · ",
        el("b", { text: st.total.toLocaleString("en-US") }), ` credited artists from `, el("b", { text: String(st.origins.length) }), " origins. ",
        `U.S. ${pct(us / st.known * 100)}, U.K. ${pct(uk / st.known * 100)}, elsewhere ${pct((st.known - us - uk) / st.known * 100)} of the ${st.known.toLocaleString("en-US")} with a documented origin.`);
    },
  };
  views.summary = summaryView;

  // Resize
  let lastW = 0, raf = null;
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w === lastW) return;
    lastW = w;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { views.strip.resize(); views.map.resize(); views.tree.resize(); });
  }).observe(document.getElementById("origins"));

  setPeriod(initialYear ?? first, initialYear ?? last);
}

// ── Facts for the copy ──────────────────────────────────────────────────
// Smallest whole percent that the run's highest share stays below.
const underPct = max => Math.floor(max * 100) + 1;
function originFacts(yearly, all) {
  const pub = yearly.filter(d => !d.est);
  const share = d => (d.uk + d.elsewhere) / d.known;
  const peak = pub.reduce((m, d) => (share(d) > share(m) ? d : m));
  // Longest run of years under 21% non-US share after the first British Invasion.
  let best = null, cur = null;
  for (const d of pub.filter(v => v.year >= 1964)) {
    if (share(d) < 0.21) {
      cur = cur ? { ...cur, to: d.year, max: Math.max(cur.max, share(d)) } : { from: d.year, to: d.year, max: share(d) };
      if (!best || cur.to - cur.from > best.to - best.from) best = cur;
    } else cur = null;
  }
  const us = all.byOrigin.get("US").artists.length, uk = all.byOrigin.get("GB").artists.length;
  return {
    peak: { year: peak.year, share: share(peak), uk: peak.uk / peak.known, ukCount: peak.uk, known: peak.known },
    low: best,
    usShare: us / all.known, ukCount: uk, foreign: all.known - us, originCount: all.origins.length,
  };
}

function writeDek(f, all) {
  const dek = document.getElementById("origins-dek");
  const fraction = f.usShare >= 0.74 && f.usShare < 0.77 ? "Three of every four" : pct(f.usShare * 100, 0);
  dek.replaceChildren(
    `${fraction} credited artists since ${all.from} were born or formed in the U.S. (${pct(f.usShare * 100)}). `,
    `The rest came from ${f.originCount - 1} other origins, but Britain alone supplied ${f.ukCount} of those ${f.foreign}. `,
    `Outsiders peaked in ${f.peak.year}, at ${pct(f.peak.share * 100, 0)} of the chart’s artists (${pct(f.peak.uk * 100, 0)} British), then faded to under ${underPct(f.low.max)}% for ${f.low.to - f.low.from + 1} straight years (${f.low.from}–${f.low.to}).`);
}

// ── Geometry helpers ────────────────────────────────────────────────────
function largestPolygon(feature) {
  const g = feature.geometry;
  if (g.type !== "MultiPolygon") return g;
  let best = null, area = -1;
  for (const coordinates of g.coordinates) {
    const p = { type: "Polygon", coordinates };
    const a = d3.geoArea(p);
    if (a > area) { area = a; best = p; }
  }
  return best;
}
// d3-geo expects clockwise exterior rings; reverse any polygon that reads as the whole globe minus itself.
function rewind(feature) {
  const fix = coords => {
    const p = { type: "Polygon", coordinates: coords };
    return d3.geoArea(p) > 2 * Math.PI ? coords.map(ring => ring.slice().reverse()) : coords;
  };
  const g = feature.geometry;
  const geometry = g.type === "Polygon" ? { type: "Polygon", coordinates: fix(g.coordinates) }
    : g.type === "MultiPolygon" ? { type: "MultiPolygon", coordinates: g.coordinates.map(fix) } : g;
  return { ...feature, geometry };
}
