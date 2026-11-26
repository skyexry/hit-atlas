// The opening: one record, 68 grooves, and a short skippable story in steps.
import { FEELINGS, FEELING, pct, yearLabel, el, reducedMotion } from "./core.js";
import { createHeroRecord, drawSongRecord } from "./record.js";
import { listenLink, fetchArtwork } from "./listen.js";

const mean = a => a.reduce((t, v) => t + v, 0) / a.length;

// Story numbers are computed here from the data, never typed into the page.
export function storyFacts(data) {
  const published = data.years.filter(y => !y.est);
  const runs = [];
  for (const y of published) {
    const last = runs.at(-1);
    if (last && last.key === y.leader.key) { last.to = y.year; last.years.push(y); }
    else runs.push({ key: y.leader.key, from: y.year, to: y.year, years: [y] });
  }
  const [run1, run2] = runs.slice().sort((a, b) => b.years.length - a.years.length).slice(0, 2).sort((a, b) => a.from - b.from);
  const era3 = published.filter(y => y.year > run2.to);
  const est = data.years.find(y => y.est);
  const idx = k => FEELING[k].index;
  const joyPeak = run2.years.reduce((m, y) => (y.shares[idx("joy")] > m.shares[idx("joy")] ? y : m));
  const sadAnger = ys => mean(ys.map(y => y.shares[idx("sadness")] + y.shares[idx("anger")]));
  const sadderBefore = published.slice().reverse().find(y => y.shares[idx("sadness")] >= est.shares[idx("sadness")]);
  const words = data.years.filter(y => y.loveWord);
  const wordMean = (a, b) => mean(words.filter(y => y.year >= a && y.year <= b && !y.est).map(y => y.loveWord.rate));
  const wordPeak = words.reduce((m, y) => (y.loveWord.rate > m.loveWord.rate ? y : m));
  return {
    runs, run1, run2, era3, est, joyPeak, sadderBefore,
    run1Love: mean(run1.years.map(y => y.shares[idx(run1.key)])),
    run1Margin: mean(run1.years.map(y => y.leader.margin)),
    run2Margin: mean(run2.years.map(y => y.leader.margin)),
    era3MaxMargin: Math.max(...era3.map(y => y.leader.margin)),
    era3Switches: era3.reduce((t, y, i) => t + (i && y.leader.key !== era3[i - 1].leader.key ? 1 : 0), 0),
    sadAnger2: sadAnger(run2.years), sadAnger3: sadAnger(era3),
    loveWordEarly: wordMean(1959, 1999), loveWordLate: wordMean(2020, 2025), wordPeak,
    annotatedEntries: data.years.reduce((t, y) => t + y.annotatedEntries, 0),
    entries: data.years.reduce((t, y) => t + y.entries, 0),
  };
}

const fmt1 = v => v.toFixed(1);
function setText(id, nodes) {
  const n = document.getElementById(id);
  if (n) n.replaceChildren(...[].concat(nodes));
}
const b = text => el("b", { text });

export function initOpening(data, { onPickYear }) {
  const f = storyFacts(data);
  const years = data.years;
  const svg = document.getElementById("hero-record");
  const hero = createHeroRecord(svg, years);
  const readout = document.getElementById("hero-readout");
  const L = FEELING;

  // Copy, from the data.
  setText("hero-dek", [
    `For ${f.run1.years.length} straight years, love filled more of the biggest hits’ lyrics than any other feeling. Then joy took over for ${f.run2.years.length}. Since ${f.era3[0].year}, no feeling has held a clear lead.`,
  ]);
  setText("hero-meta", [
    b(f.annotatedEntries.toLocaleString("en-US")), ` of ${f.entries.toLocaleString("en-US")} chart entries with annotated lyrics · `,
    b(data.segmentCount.toLocaleString("en-US")), " lyric segments · ",
    b(`${years[0].year}–${years.filter(y => !y.est).at(-1).year}`), ` and a ${f.est.year} estimate`,
  ]);
  const key = document.getElementById("hero-key");
  key.replaceChildren(...FEELINGS.map(x => el("li", {}, el("i", { style: `background:${x.color}` }), x.long || x.label)));

  setText("era1-range", `${f.run1.from}–${f.run1.to}`);
  setText("era1-text", [
    "Love led every one of the ", b(`${f.run1.years.length} charts`), ` from ${f.run1.from} through ${f.run1.to}. It filled `,
    b(pct(f.run1Love)), " of lyric text on average and stayed about ", b(`${fmt1(f.run1Margin)} points`), " ahead of the next feeling.",
  ]);
  setText("era2-range", `${f.run2.from}–${f.run2.to}`);
  const partyRock = (data.entries.get(f.joyPeak.year) || []).find(e => e.title === "Party Rock Anthem");
  setText("era2-text", [
    "From ", b(String(f.run2.from)), ", joy led ", b(`${f.run2.years.length} charts in a row`), ", the era of club, party and swagger hits. It peaked at ",
    b(pct(f.joyPeak.shares[L.joy.index])), ` in ${f.joyPeak.year}`,
    partyRock ? `, the year “Party Rock Anthem” finished No. ${partyRock.rank}.` : ".",
  ]);
  setText("era3-range", `${f.era3[0].year}–${f.era3.at(-1).year}`);
  setText("era3-text", [
    "Since ", b(String(f.era3[0].year)), ", the top feeling has never led by more than ", b(`${fmt1(f.era3MaxMargin)} points`),
    `, and the lead changed hands ${f.era3Switches} times. Sadness and anger together rose to `, b(pct(f.sadAnger3)),
    ` of lyric text, up from ${pct(f.sadAnger2)} in the joy era. The word “love” itself thinned out: `,
    b(`${fmt1(f.loveWordEarly)} uses per 1,000 words`), ` on average in 1959–1999, `, b(fmt1(f.loveWordLate)), " in 2020–2025.",
  ]);
  // Country's place in the estimate and how sad its songs are compared with the rest.
  const estEntries = (data.entries.get(f.est.year) || []).filter(e => e.song.shares);
  const isCountry = e => e.genres.includes("Country");
  const sadMean = list => mean(list.map(e => e.song.shares[L.sadness.index]));
  const countryRank = [...f.est.genres].sort((a, c) => c[1] - a[1]).findIndex(([g]) => g === "Country");
  const ordinal = ["largest", "second-largest", "third-largest", "fourth-largest"][countryRank] || null;
  const countrySongs = estEntries.filter(isCountry), restSongs = estEntries.filter(e => !isCountry(e));
  setText("era4-text", [
    `In the ${f.est.year} estimate, love leads again with `, b(pct(f.est.shares[L.love.index])),
    ", but sadness rises to ", b(pct(f.est.shares[L.sadness.index])),
    f.sadderBefore ? `, its highest share since ${f.sadderBefore.year}.` : ".",
    ...(ordinal && countrySongs.length && restSongs.length ? [
      ` Country, now the ${ordinal} genre at ${pct(f.est.genres.get("Country") * 100)} of the chart, carries much of it: its ${countrySongs.length} annotated songs average `,
      b(pct(sadMean(countrySongs))), ` sadness, against ${pct(sadMean(restSongs))} for the rest.`,
    ] : []),
  ]);

  // Featured songs
  for (const card of document.querySelectorAll(".feature[data-feature]")) {
    const [y, r] = card.dataset.feature.split("-").map(Number);
    const entry = (data.entries.get(y) || []).find(e => e.rank === r);
    if (entry) renderFeature(card, entry, data.yearMap.get(y));
  }

  // Readout + hover
  let stepYear = 0;
  function readYear(i) {
    const y = years[i];
    const items = FEELINGS.slice(0, 5).map((x, k) => el("span", { class: "ro-item" },
      el("i", { style: `background:${x.color}` }), `${x.label} `, b(pct(y.shares[k]))));
    readout.replaceChildren(el("span", { class: "ro-year", text: yearLabel(y.year, y.est) }), ...items,
      el("br"), el("span", { text: `${y.annotated} of ${y.songs} songs annotated` }));
  }
  function pointerYear(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return hero.yearAt(p.x, p.y);
  }
  svg.setAttribute("tabindex", "0");
  svg.addEventListener("pointermove", evt => {
    const i = pointerYear(evt);
    if (i < 0) return;
    hero.hoverRing(i); hero.moveNeedle(i, false); readYear(i);
  });
  svg.addEventListener("pointerleave", () => { hero.hoverRing(-1); hero.moveNeedle(stepYear); readYear(stepYear); });
  svg.addEventListener("click", evt => { const i = pointerYear(evt); if (i >= 0) onPickYear(years[i].year); });
  let kbYear = 0;
  svg.addEventListener("keydown", evt => {
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
    if (evt.key in map) {
      evt.preventDefault();
      kbYear = Math.max(0, Math.min(years.length - 1, kbYear + map[evt.key]));
      hero.hoverRing(kbYear); hero.moveNeedle(kbYear, false); readYear(kbYear);
    } else if (evt.key === "Enter") onPickYear(years[kbYear].year);
  });
  svg.addEventListener("focus", () => { kbYear = stepYear; hero.hoverRing(kbYear); readYear(kbYear); });
  svg.addEventListener("blur", () => hero.hoverRing(-1));

  // Steps
  const at = yr => years.findIndex(y => y.year === yr);
  const STEPS = [
    { year: years[0].year },
    { year: years[0].year },
    { keys: ["love"], from: f.run1.from, to: f.run1.to, year: 1975 },
    { keys: ["joy"], from: f.run2.from, to: f.run2.to, year: f.joyPeak.year },
    { keys: ["sadness", "anger"], from: f.era3[0].year, to: f.era3.at(-1).year, year: 2024 },
    { from: f.est.year, to: f.est.year, year: f.est.year },
    { year: f.est.year },
  ];
  const steps = [...document.querySelectorAll(".step")];
  function activate(n) {
    steps.forEach((s, i) => s.classList.toggle("is-active", i === n));
    const s = STEPS[n] || STEPS[0];
    hero.emphasize(s);
    stepYear = Math.max(0, at(s.year));
    hero.moveNeedle(stepYear, !reducedMotion());
    readYear(stepYear);
  }
  const observer = new IntersectionObserver(items => {
    const visible = items.filter(x => x.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) activate(+visible.target.dataset.step);
  }, { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.01] });
  steps.forEach(s => observer.observe(s));
  activate(0);

  // Light moves across the vinyl as the reader scrolls (no autoplay motion).
  const sheen = document.querySelector(".hero-sheen");
  const section = document.getElementById("opening");
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking || reducedMotion()) return;
    ticking = true;
    requestAnimationFrame(() => {
      const r = section.getBoundingClientRect();
      if (r.bottom > 0) sheen.style.setProperty("--spin", `${(-r.top * 0.22) % 360}deg`);
      ticking = false;
    });
  }, { passive: true });
}

function renderFeature(card, entry, year) {
  const song = entry.song;
  const art = el("div", { class: "f-art" });
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "-50 -50 100 100");
  svg.setAttribute("aria-hidden", "true");
  const g = document.createElementNS(svgNS, "g");
  svg.append(g);
  drawSongRecord(g, song, { rank: entry.rank });
  art.append(svg);
  const shares = song.shares
    ? FEELINGS.map((x, i) => ({ x, v: song.shares[i] })).filter(d => d.v >= 1).sort((a, b) => b.v - a.v).slice(0, 3)
    : [];
  card.replaceChildren(art, el("div", {},
    el("p", { class: "f-meta", text: `No. ${entry.rank} · ${yearLabel(entry.year, year.est)}` }),
    el("p", { class: "f-title", text: entry.title }),
    el("p", { class: "f-artist", text: entry.artist }),
    el("p", { class: "f-share" }, ...shares.flatMap((d, i) => [i ? " · " : "", el("b", { text: pct(d.v, 0) }), ` ${d.x.label.toLowerCase()}`])),
    listenLink(entry)));
  if (entry.spotify) {
    fetchArtwork(entry.spotify).then(a => {
      if (!a) return;
      art.classList.add("has-art");
      art.prepend(el("img", { src: a.src, alt: `Cover art for ${entry.title} (Spotify)`, loading: "lazy", width: 76, height: 76 }));
    });
  }
}
