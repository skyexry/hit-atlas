// Hit Atlas · boot, shared state and URL hash.
import { loadAtlas, el } from "./core.js";
import { initOpening, storyFacts } from "./opening.js";
import { initHeart, createSongDialog } from "./heart.js";
import { initOrigins } from "./origins.js";
import { initWords } from "./words.js";
import { initSound } from "./sound.js";

function createStore(initial) {
  const state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const changed = new Set();
      for (const [k, v] of Object.entries(patch)) if (state[k] !== v) { state[k] = v; changed.add(k); }
      if (changed.size) subs.forEach(fn => fn(state, changed));
    },
    subscribe(fn) { subs.add(fn); fn(state, new Set(Object.keys(state))); },
  };
}

function hashYear(years) {
  const m = location.hash.match(/^#heart(?:\/|-)(\d{4})$/);
  return m && years.includes(+m[1]) ? +m[1] : null;
}

// README cards open a specific chart and, where applicable, its featured year.
const showcaseTargets = ["#chart-crate", "#word-explorer", "#artist-map", "#sound-tiles"];

async function boot() {
  const [data, world] = await Promise.all([
    loadAtlas("data/atlas.json"),
    d3.json("../billboard-year-end/site/world.geojson"),
  ]);
  const years = data.years.map(y => y.year);
  const lastPublished = data.years.filter(y => !y.est).at(-1).year;
  const target = location.hash;
  const requestedYear = Number(new URLSearchParams(location.search).get("year"));
  const showcaseYear = years.includes(requestedYear) ? requestedYear : null;
  const chartYear = target === "#chart-crate" || target === "#word-explorer" ? showcaseYear : null;
  const store = createStore({ year: hashYear(years) ?? chartYear ?? lastPublished, emotion: null, genre: null, order: "rank", word: "love" });
  const facts = storyFacts(data);
  initOpening(data, {
    onPickYear(year) {
      store.set({ year });
      document.getElementById("heart").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    },
  });
  const dialog = createSongDialog(data, store);
  initHeart(data, store, facts, dialog);
  const words = initWords(data, store, dialog);
  initOrigins(data, world, store, dialog, target === "#artist-map" ? showcaseYear : null);
  const sound = initSound(data, store, dialog);

  // Keep the selected year in the URL without adding history entries.
  store.subscribe((state, changed) => {
    if (!changed.has("year") || !location.hash.startsWith("#heart")) return;
    history.replaceState(null, "", `#heart/${state.year}`);
  });
  window.addEventListener("hashchange", () => {
    const y = hashYear(years);
    if (y) store.set({ year: y });
  });
  if (hashYear(years)) document.getElementById("heart").scrollIntoView();
  if (showcaseTargets.includes(target)) {
    // Chart rendering and font loading can move the anchor below its initial position.
    document.fonts.ready.then(() => {
      if (location.hash === target) document.querySelector(target).scrollIntoView({ behavior: "instant" });
    });
  }
  window.hitAtlas = { data, store, facts, words, sound }; // handy for checking values in the console
}

function start() {
  if (!window.d3) {
    document.body.prepend(el("p", { class: "load-error", text: "Could not load D3. Check that billboard-year-end/site/d3.min.js is present." }));
    return;
  }
  boot().catch(err => {
    console.error(err);
    document.body.prepend(el("p", { class: "load-error", text: "Could not load the Hit Atlas data. Serve the repository over HTTP (for example, python3 -m http.server) and reload." }));
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
