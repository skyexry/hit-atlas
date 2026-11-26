// Track 02 · The words. Annual word bubbles, a word's trace over time, and the songs behind it.
import { COLORS, pct, yearLabel, el, showTip, hideTip, tipRow, reducedMotion } from "./core.js";
import { drawSongRecord } from "./record.js";

const SVGNS = "http://www.w3.org/2000/svg";
const INDEX_URL = "../billboard-year-end/data/lyric_term_index.json";
const LOVE = "love";

// One racial slur appears in the annual top words. It is masked on screen and counted in the data.
const shown = term => (/^nigg/i.test(term) ? `${term[0]}${"*".repeat(term.length - 1)}` : term);
const quote = term => `“${shown(term)}”`;
const normalize = q => q.normalize("NFKC").toLowerCase().replace(/[’‘`]/g, "'").trim();
// Small deterministic jitter so the swarm settles the same way on every load.
const jitter = term => { let h = 0; for (const ch of term) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((h >>> 0) % 21) - 10; };

export function initWords(data, store, dialog) {
  const years = data.years.map(y => y.year);
  const yearOf = y => data.yearMap.get(y);
  const lex = y => yearOf(y).lex;
  const rows = y => lex(y).words.map(([term, songs, occ, rate, rank]) => ({ term, songs, occ, rate: rate / 1000, rank }));
  const songById = new Map(data.songs.map(s => [s.id, s]));
  const maxRate = d3.max(years, y => d3.max(lex(y).words, w => w[3] / 1000));
  const maxUse = d3.max(years, y => d3.max(lex(y).words, w => w[1]));
  const section = document.getElementById("words");

  // ── The cleaned term index (5 MB), loaded when the chapter comes near ──
  let index = null, loading = null;
  const status = document.getElementById("w-status");
  function loadIndex() {
    if (!loading) {
      status.textContent = "Loading the word index…";
      loading = d3.json(INDEX_URL).then(raw => {
        const songPos = new Map(raw.songs.map(([id], i) => [id, i]));
        const tokens = raw.songs.map(s => s[1]);
        const eligible = new Map(years.map(y => [y, [...new Set(data.entries.get(y).map(e => e.song.id))].filter(id => songPos.has(id))]));
        index = { terms: raw.terms, songPos, tokens, eligible, count: raw.songs.length };
        status.textContent = `${raw.songs.length.toLocaleString("en-US")} English lyrics indexed.`;
        return index;
      }).catch(err => {
        console.error(err);
        status.textContent = "The word index could not load; search is unavailable.";
        loading = null;
        throw err;
      });
    }
    return loading;
  }
  new IntersectionObserver(items => { if (items.some(i => i.isIntersecting)) loadIndex(); }, { rootMargin: "900px 0px" }).observe(section);

  // A word's annual series: mean uses per 1,000 words across eligible songs (zeros included),
  // the share of songs that use it, and its total occurrences.
  const seriesCache = new Map();
  function seriesFor(term) {
    if (seriesCache.has(term)) return seriesCache.get(term);
    let out = null;
    if (index) {
      const post = index.terms[term] || [];
      const counts = new Map();
      for (let i = 0; i < post.length; i += 2) counts.set(post[i], post[i + 1]);
      out = years.map(y => {
        const ids = index.eligible.get(y);
        let sum = 0, using = 0, occ = 0;
        for (const id of ids) {
          const p = index.songPos.get(id), c = counts.get(p) || 0;
          if (c) { using += 1; occ += c; }
          sum += (1000 * c) / index.tokens[p];
        }
        return { year: y, est: yearOf(y).est, eligible: ids.length, rate: ids.length ? sum / ids.length : 0, using, occ, share: ids.length ? using / ids.length : 0 };
      });
      out.counts = counts;
      seriesCache.set(term, out);
    } else {
      // Before the index arrives, a word present in every year's export can still be drawn.
      const pts = years.map(y => {
        const r = rows(y).find(w => w.term === term);
        return r ? { year: y, est: yearOf(y).est, eligible: lex(y).n, rate: r.rate, using: r.songs, occ: r.occ, share: r.songs / lex(y).n } : null;
      });
      out = pts.every(Boolean) ? pts : null;
    }
    return out;
  }

  // ── Copy ──
  const love = years.map(y => ({ y, est: yearOf(y).est, row: rows(y).find(w => w.term === LOVE), n: lex(y).n }));
  const pub = love.filter(d => !d.est);
  const firstLove = pub[0], lastPub = pub.at(-1);
  const rank1 = pub.filter(d => d.row && d.row.rank === 1).length;
  const meanRate = (a, b) => d3.mean(pub.filter(d => d.y >= a && d.y <= b), d => d.row.rate);
  const longest = pub.reduce((m, d) => (lex(d.y).len > lex(m.y).len ? d : m));
  document.getElementById("words-dek").replaceChildren(
    `${quote(LOVE)} was the most-used word on ${rank1} of the ${pub.length} published year-end charts, setting aside common function words. `,
    `It went from ${meanRate(1959, 1999).toFixed(1)} uses per 1,000 words in 1959–1999 to ${meanRate(2020, 2025).toFixed(1)} in 2020–2025, `,
    `and from ${pct(firstLove.row.songs / firstLove.n * 100, 0)} of songs in ${firstLove.y} to ${pct(lastPub.row.songs / lastPub.n * 100, 0)} in ${lastPub.y}. `,
    `Hits also got longer: the typical lyric ran ${Math.round(lex(firstLove.y).len)} words in ${firstLove.y} and ${Math.round(lex(longest.y).len)} in ${longest.y}.`);

  // ── Controls ──
  const sel = document.getElementById("w-year");
  for (const y of data.years) sel.append(el("option", { value: y.year, text: y.est ? `${y.year} (estimate)` : String(y.year) }));
  sel.addEventListener("change", () => { stop(); store.set({ year: +sel.value }); });
  const prev = document.getElementById("w-prev"), next = document.getElementById("w-next"), play = document.getElementById("w-play");
  const shift = d => { const i = years.indexOf(store.get().year) + d; if (i >= 0 && i < years.length) store.set({ year: years[i] }); };
  prev.addEventListener("click", () => { stop(); shift(-1); });
  next.addEventListener("click", () => { stop(); shift(1); });
  let timer = null;
  function stop() { clearInterval(timer); timer = null; play.textContent = "▶"; play.setAttribute("aria-label", "Play through the years"); play.setAttribute("aria-pressed", "false"); }
  play.addEventListener("click", () => {
    if (timer) { stop(); return; }
    if (store.get().year === years.at(-1)) store.set({ year: years[0] });
    play.textContent = "❚❚"; play.setAttribute("aria-label", "Pause"); play.setAttribute("aria-pressed", "true");
    timer = setInterval(() => {
      const i = years.indexOf(store.get().year);
      if (i >= years.length - 1) { stop(); return; }
      store.set({ year: years[i + 1] });
    }, reducedMotion() ? 1200 : 900);
  });
  const suggest = document.getElementById("w-suggest");
  const vocab = [...new Set(years.flatMap(y => lex(y).words.map(w => w[0])))].filter(t => shown(t) === t).sort();
  suggest.replaceChildren(...vocab.map(t => el("option", { value: t })));
  const form = document.getElementById("w-search"), input = document.getElementById("w-query");
  input.addEventListener("focus", () => loadIndex(), { once: true });
  form.addEventListener("submit", async evt => {
    evt.preventDefault();
    const q = normalize(input.value);
    if (!q) return;
    if (/\s/.test(q)) { status.textContent = "Search one word at a time."; return; }
    try { await loadIndex(); } catch { return; }
    if (!index.terms[q]) { status.textContent = `${quote(q)} does not appear in the ${index.count.toLocaleString("en-US")} indexed lyrics.`; return; }
    status.textContent = "";
    store.set({ word: q });
  });

  // ── Bubbles: x = songs using the word (exact), area = uses per 1,000 words ──
  const bubbleSvg = d3.select("#bubbles");
  const gAxis = bubbleSvg.append("g").attr("class", "axis");
  const gBub = bubbleSvg.append("g");
  const layoutCache = new Map();
  let W = 0, H = 0, x, r, cy;
  function sizeBubbles() {
    W = bubbleSvg.node().parentNode.clientWidth;
    if (W < 120) return false;
    const narrow = W < 640;
    H = narrow ? 430 : 480;
    cy = (H - 48) / 2;
    // Doubling scale: every listed word is in at least two songs; positions stay exact.
    x = d3.scaleLog([2, Math.max(64, maxUse)], [narrow ? 22 : 34, W - (narrow ? 22 : 34)]);
    r = d3.scaleSqrt([0, maxRate], [0, narrow ? 34 : 50]);
    bubbleSvg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    gAxis.attr("transform", `translate(0,${H - 40})`).call(d3.axisBottom(x).tickValues([2, 4, 8, 16, 32, 64]).tickFormat(d3.format("d")).tickSizeOuter(0));
    gAxis.selectAll("text.ax-label").data([0]).join("text").attr("class", "ax-label").attr("x", W / 2).attr("y", 34)
      .attr("text-anchor", "middle").attr("fill", COLORS.ink2).style("font-size", "11px").text("Songs that use the word that year (doubling scale)");
    layoutCache.clear();
    return true;
  }
  function layout(year) {
    if (layoutCache.has(year)) return layoutCache.get(year);
    const prev = layoutCache.get(year - 1) || layoutCache.get(year + 1);
    const prevPos = new Map(prev ? prev.map(n => [n.term, n.y]) : []);
    const nodes = rows(year).map(w => ({ ...w, fx: x(w.songs), y: prevPos.get(w.term) ?? cy + jitter(w.term), rr: Math.max(3, r(w.rate)) }));
    const sim = d3.forceSimulation(nodes).force("y", d3.forceY(cy).strength(0.06))
      .force("collide", d3.forceCollide(n => n.rr + 1.2).iterations(4)).stop();
    for (let i = 0; i < 260; i++) sim.tick();
    layoutCache.set(year, nodes);
    return nodes;
  }
  function drawBubbles(state, animate) {
    if (!x && !sizeBubbles()) return;
    const yr = state.year, nodes = layout(yr);
    // Keep the swarm inside the frame by scaling its vertical spread if a dense year overflows.
    const top = d3.min(nodes, n => n.y - n.rr), bottom = d3.max(nodes, n => n.y + n.rr);
    const room = H - 54, spread = bottom - top;
    const k = spread > room ? room / spread : 1;
    const yOf = n => cy + (n.y - (top + bottom) / 2) * k;
    const t = animate && !reducedMotion() ? 650 : 0;
    const g = gBub.selectAll("g.word").data(nodes, n => n.term).join(
      enter => {
        const e = enter.append("g").attr("class", "word").attr("transform", n => `translate(${n.fx},${yOf(n)})`).attr("opacity", 0);
        e.append("circle").attr("class", "w-disc");
        e.append("circle").attr("class", "w-groove").attr("fill", "none");
        e.append("text").attr("class", "w-text").attr("text-anchor", "middle").attr("dy", "0.34em");
        return e;
      },
      update => update,
      exit => exit.transition().duration(t / 2).attr("opacity", 0).remove(),
    );
    g.transition().duration(t).attr("transform", n => `translate(${n.fx},${yOf(n)})`).attr("opacity", 1);
    const isSel = n => n.term === state.word;
    g.select(".w-disc").transition().duration(t).attr("r", n => n.rr)
      .attr("fill", n => (isSel(n) ? COLORS.paper : COLORS.vinyl))
      .attr("stroke", n => (isSel(n) ? COLORS.ink : "none")).attr("stroke-width", 2.5);
    g.select(".w-groove").attr("r", n => n.rr * 0.78).attr("stroke", n => (isSel(n) ? "none" : COLORS.grooveEmpty)).attr("opacity", n => (n.rr > 10 ? 1 : 0));
    g.select(".w-text").text(n => {
      const label = shown(n.term), size = Math.max(9, Math.min(15, n.rr * 0.5));
      return label.length * size * 0.56 <= n.rr * 2 - 4 ? label : "";
    }).style("font-size", n => `${Math.max(9, Math.min(15, n.rr * 0.5))}px`)
      .attr("fill", n => (isSel(n) ? COLORS.ink : COLORS.paper));
    g.attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", n => `${shown(n.term)}: ${n.songs} of ${lex(yr).n} songs, ${n.rate.toFixed(2)} uses per 1,000 words, rank ${n.rank}`)
      .on("click", (evt, n) => { stop(); store.set({ word: n.term }); })
      .on("keydown", (evt, n) => { if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); store.set({ word: n.term }); } })
      .on("pointermove", (evt, n) => showTip(bubbleTip(n, yr), evt.clientX, evt.clientY))
      .on("pointerleave", hideTip)
      .on("focus", function (evt, n) { const b = this.getBoundingClientRect(); showTip(bubbleTip(n, yr), b.right, b.top); })
      .on("blur", hideTip);
    g.filter(isSel).raise();
    document.getElementById("bubble-title").textContent = `The year in words · ${yearLabel(yr, yearOf(yr).est)}`;
    const inTop = nodes.some(isSel);
    document.getElementById("bubble-note").textContent =
      `${lex(yr).n} English lyrics that year. ` +
      (inTop ? "" : `${quote(state.word)} is not among this year’s 60 words; its trace is on the right. `) +
      (k < 1 ? "The swarm is compressed vertically to fit; horizontal positions are exact. " : "") +
      "One racial slur is masked in the display; it is counted in the data.";
  }
  function bubbleTip(n, yr) {
    return [
      el("div", { class: "tt-head", text: `${quote(n.term)} · ${yearLabel(yr, yearOf(yr).est)}` }),
      tipRow(COLORS.vinyl, `${n.songs} of ${lex(yr).n}`, "songs use it"),
      tipRow(COLORS.vinyl, n.rate.toFixed(2), "uses per 1,000 words, averaged over songs"),
      tipRow(COLORS.vinyl, String(n.occ), `times in all · rank ${n.rank}`),
      el("div", { class: "tt-note", text: "Click to trace it" }),
    ];
  }

  // ── Trace: three aligned panels on one time axis ──
  const traceSvg = d3.select("#trace");
  const traceRoot = traceSvg.append("g");
  let tx, tw = 0, panels = [];
  const PANELS = [
    { key: "rate", label: "Uses per 1,000 words", fmt: v => v.toFixed(1) },
    { key: "share", label: "Share of songs using it", fmt: v => pct(v * 100, 0) },
    { key: "len", label: "Words per song (median, all words)", fmt: v => String(Math.round(v)) },
  ];
  function drawTrace(state) {
    const host = traceSvg.node().parentNode;
    tw = host.clientWidth;
    if (tw < 120) return;
    const m = { l: 38, r: 46, t: 18 }, ph = 88, gap = 34;
    const H2 = m.t + PANELS.length * ph + (PANELS.length - 1) * gap + 28;
    traceSvg.attr("viewBox", `0 0 ${tw} ${H2}`).attr("width", tw).attr("height", H2);
    tx = d3.scaleLinear([years[0], years.at(-1)], [m.l, tw - m.r]);
    const word = state.word, series = seriesFor(word);
    const loveSeries = word !== LOVE ? seriesFor(LOVE) : null;
    const lenSeries = years.map(y => ({ year: y, est: yearOf(y).est, len: lex(y).len }));
    const title = document.getElementById("trace-title");
    title.textContent = `${quote(word)}, ${years[0]}–${years.at(-1)}`;
    traceRoot.selectAll("*").remove();
    if (!series) {
      traceRoot.append("text").attr("x", tw / 2).attr("y", 60).attr("text-anchor", "middle").attr("fill", COLORS.ink2)
        .style("font-size", "13px").text("Loading the word index…");
      loadIndex().then(() => drawTrace(store.get()), () => {});
      return;
    }
    panels = PANELS.map((p, i) => {
      const top = m.t + i * (ph + gap);
      const src = p.key === "len" ? lenSeries : series;
      const vals = src.map(d => d[p.key]).concat(p.key === "rate" && loveSeries ? loveSeries.map(d => d.rate) : []);
      const y = d3.scaleLinear([0, d3.max(vals) || 1], [top + ph, top + 4]).nice(3);
      const g = traceRoot.append("g");
      g.append("text").attr("class", "tr-label").attr("x", m.l - 34).attr("y", top - 6).text(p.label);
      const ticks = y.ticks(3);
      g.selectAll("line.gl").data(ticks).join("line").attr("class", "gl").attr("x1", m.l).attr("x2", tw - m.r).attr("y1", d => y(d)).attr("y2", d => y(d)).attr("stroke", COLORS.paper3);
      g.selectAll("text.tk").data(ticks).join("text").attr("class", "tk").attr("x", m.l - 6).attr("y", d => y(d)).attr("dy", "0.32em").attr("text-anchor", "end")
        .text(d => (p.key === "share" ? `${Math.round(d * 100)}%` : d));
      const line = d3.line().x(d => tx(d.year)).y(d => y(d[p.key]));
      if (p.key === "rate" && loveSeries) {
        g.append("path").attr("d", line(loveSeries.filter(d => !d.est))).attr("fill", "none").attr("stroke", "#c9bfae").attr("stroke-width", 1.5);
        const lastL = loveSeries.filter(d => !d.est).at(-1);
        g.append("text").attr("class", "tr-ref").attr("x", tx(lastL.year) + 4).attr("y", y(lastL.rate)).attr("dy", "0.32em").text(shown(LOVE));
      }
      const color = p.key === "len" ? "#8f877b" : COLORS.ink;
      g.append("path").attr("d", line(src.filter(d => !d.est))).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2).attr("stroke-linejoin", "round");
      g.append("path").attr("d", line(src.slice(-2))).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2).attr("stroke-dasharray", "3 3");
      return { ...p, y, src, g };
    });
    const axisY = m.t + PANELS.length * ph + (PANELS.length - 1) * gap + 4;
    traceRoot.append("g").attr("class", "axis").attr("transform", `translate(0,${axisY})`)
      .call(d3.axisBottom(tx).tickValues(years.filter(v => v % 10 === 0)).tickFormat(d3.format("d")).tickSizeOuter(0));
    const mark = traceRoot.append("g").attr("class", "tr-mark").attr("pointer-events", "none");
    const hover = traceRoot.append("g").attr("pointer-events", "none");
    const overlay = traceRoot.append("rect").attr("x", m.l).attr("y", 0).attr("width", tw - m.l - m.r).attr("height", axisY).attr("fill", "transparent").style("cursor", "pointer");
    const yearAt = evt => Math.max(years[0], Math.min(years.at(-1), Math.round(tx.invert(d3.pointer(evt, traceRoot.node())[0]))));
    function marker(g, yr, dashed) {
      g.selectAll("*").remove();
      g.append("line").attr("x1", tx(yr)).attr("x2", tx(yr)).attr("y1", m.t).attr("y2", axisY).attr("stroke", COLORS.ink).attr("stroke-dasharray", dashed ? "2 3" : null);
      for (const p of panels) {
        const d = p.src.find(v => v.year === yr);
        g.append("circle").attr("cx", tx(yr)).attr("cy", p.y(d[p.key])).attr("r", 3.6)
          .attr("fill", d.est ? COLORS.paper : COLORS.ink).attr("stroke", d.est ? COLORS.ink : COLORS.paper).attr("stroke-width", 1.5);
        const right = tx(yr) > tw - m.r - 50;
        g.append("text").attr("class", "tr-val").attr("x", tx(yr) + (right ? -6 : 6)).attr("y", p.y(d[p.key]) - 7)
          .attr("text-anchor", right ? "end" : "start").text(p.fmt(d[p.key]));
      }
    }
    marker(mark, state.year, false);
    overlay.on("pointermove", evt => marker(hover, yearAt(evt), true))
      .on("pointerleave", () => hover.selectAll("*").remove())
      .on("click", evt => { stop(); store.set({ year: yearAt(evt) }); });
    const pubS = series.filter(d => !d.est);
    const peak = pubS.reduce((a, b) => (b.rate > a.rate ? b : a));
    document.getElementById("trace-note").textContent =
      `Peak: ${peak.rate.toFixed(1)} uses per 1,000 words in ${peak.year}. ` +
      (loveSeries ? `Gray line: ${quote(LOVE)} for comparison. ` : "") +
      "Each song counts equally, including songs that never use the word. Dashed: 2026 estimate.";
    traceSvg.attr("aria-label", `${shown(word)} by year: uses per 1,000 words, share of songs using it, and median words per song. Selected ${state.year}.`);
  }

  // ── Songs behind the word in the selected year ──
  const list = document.getElementById("ws-list");
  function drawSongs(state) {
    const word = state.word, yr = state.year, series = seriesFor(word);
    document.getElementById("ws-title").textContent = `Songs that say ${quote(word)} in ${yearLabel(yr, yearOf(yr).est)}`;
    const sub = document.getElementById("ws-sub");
    if (!series || !index) {
      sub.textContent = "The song list appears once the word index has loaded.";
      list.replaceChildren();
      if (!index) loadIndex().then(() => drawSongs(store.get()), () => {});
      return;
    }
    const counts = series.counts;
    const seen = new Set();
    const hits = data.entries.get(yr).filter(e => {
      if (seen.has(e.song.id) || !index.songPos.has(e.song.id)) return false;
      seen.add(e.song.id);
      return (counts.get(index.songPos.get(e.song.id)) || 0) > 0;
    }).map(e => {
      const p = index.songPos.get(e.song.id), c = counts.get(p);
      return { e, c, rate: (1000 * c) / index.tokens[p] };
    }).sort((a, b) => b.c - a.c || a.e.rank - b.e.rank);
    const s = series.find(d => d.year === yr);
    sub.textContent = `${hits.length} of ${s.eligible} English lyrics use it, ${s.occ} times in all. Sorted by how often each song says it; select one to open it.`;
    const entries = hits.map(h => h.e);
    list.replaceChildren(...hits.map(h => {
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", "-50 -50 100 100");
      svg.setAttribute("aria-hidden", "true");
      const g = document.createElementNS(SVGNS, "g");
      svg.append(g);
      drawSongRecord(g, h.e.song, { rank: h.e.rank });
      const btn = el("button", { type: "button", "aria-label": `${h.e.title} by ${h.e.artist}, No. ${h.e.rank}: says ${shown(word)} ${h.c} times` },
        svg,
        el("span", { class: "ws-count" }, el("b", { text: `${h.c}×` }), ` · ${h.rate.toFixed(1)} per 1,000`),
        el("span", { class: "ws-title", text: h.e.title }),
        el("span", { class: "ws-artist", text: `No. ${h.e.rank} · ${h.e.artist}` }));
      btn.addEventListener("click", () => dialog.open(h.e, entries, { source: "words" }));
      return el("li", {}, btn);
    }));
  }

  // ── Table view ──
  const table = document.getElementById("words-table");
  const tableSummary = document.getElementById("words-table-summary");
  function drawTable(state) {
    const yr = state.year;
    tableSummary.textContent = `Table view: the 60 words of ${yearLabel(yr, yearOf(yr).est)}`;
    table.replaceChildren(
      el("thead", {}, el("tr", {}, ...["Rank", "Word", "Songs using it", "Occurrences", "Uses per 1,000 words"].map(t => el("th", { scope: "col", text: t })))),
      el("tbody", {}, ...rows(yr).map(w => el("tr", {},
        el("td", { text: String(w.rank) }), el("th", { scope: "row", text: shown(w.term) }),
        el("td", { text: `${w.songs} / ${lex(yr).n}` }), el("td", { text: String(w.occ) }), el("td", { text: w.rate.toFixed(2) })))));
  }

  // ── Wiring ──
  let lastYear = null;
  store.subscribe((state, changed) => {
    if (!changed.has("year") && !changed.has("word")) return;
    sel.value = state.year;
    prev.disabled = state.year === years[0];
    next.disabled = state.year === years.at(-1);
    drawBubbles(state, lastYear !== null && changed.has("year"));
    drawTrace(state);
    drawSongs(state);
    if (changed.has("year")) drawTable(state);
    if (changed.has("word") && document.activeElement !== input) input.value = state.word === LOVE ? "" : shown(state.word);
    lastYear = state.year;
  });
  let lastW = 0;
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w === lastW) return;
    lastW = w;
    x = null;
    const s = store.get();
    drawBubbles(s, false);
    drawTrace(s);
  }).observe(section);
  return { seriesFor, loadIndex };
}
