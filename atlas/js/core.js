// Shared constants, data decoding, formatting and the tooltip.

// Order matches the `s`/`p` share arrays in atlas.json.
export const FEELINGS = [
  { key: "love", label: "Love", color: "#e15e8e" },
  { key: "joy", label: "Joy", color: "#c68206" },
  { key: "sadness", label: "Sadness", color: "#3967b3" },
  { key: "anger", label: "Anger", color: "#b5360e" },
  { key: "outside", label: "Other", color: "#8f877b", long: "Other feelings (fear, contempt, gratitude, surprise, disgust, neutral)" },
  { key: "insufficient", label: "Insufficient evidence", color: "#cbc2b2" },
];
export const FEELING = Object.fromEntries(FEELINGS.map((f, i) => [f.key, { ...f, index: i }]));
export const FOUR = ["love", "joy", "sadness", "anger"];

export const NAMED_GENRES = ["Pop", "Rock", "Hip Hop/Rap", "R&B", "Country", "Soul", "Jazz/Swing"];
export const GENRE_COLOR = {
  "Pop": "#9d92de", "Rock": "#168f70", "Hip Hop/Rap": "#37a8ec", "R&B": "#94468f",
  "Country": "#6d6e0a", "Soul": "#6cb35d", "Jazz/Swing": "#1d6835", "Other": "#a69e91",
};
export const genreBucket = g => (NAMED_GENRES.includes(g) ? g : "Other");

export const COLORS = {
  vinyl: "#161412", vinyl2: "#26221d", grooveEmpty: "#3a352f", label: "#efe5cf",
  paper: "#f4efe6", paper3: "#e0d6c4", ink: "#17140f", ink2: "#4f483e", rule: "#d4c9b6",
};

const STATUS_TEXT = {
  instrumental: "Instrumental: no lyrics to annotate",
  missing: "Lyrics missing from the sources",
  unverified: "Lyric match awaiting review",
  compound: "Combined single without one representative lyric",
};
export const statusText = s => STATUS_TEXT[s] || "No annotated lyrics";

export const pct = (v, digits = 1) => `${(+v).toFixed(digits)}%`;
export const yearLabel = (y, est) => (est ? `${y} est.` : String(y));
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// WCAG relative luminance, used to pick white or near-black text inside a fill.
function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function textOn(hex) {
  const L = lum(hex);
  const onWhite = 1.05 / (L + 0.05);
  const onInk = (L + 0.05) / (lum(COLORS.ink) + 0.05);
  return onInk >= onWhite ? COLORS.ink : "#ffffff";
}

export function mainFeeling(shares) {
  // Largest of the four feelings or "other"; insufficient evidence only if nothing else.
  let best = -1, key = "insufficient";
  shares.slice(0, 5).forEach((v, i) => { if (v > best + 1e-9) { best = v; key = FEELINGS[i].key; } });
  return best > 0 ? key : "insufficient";
}

export function leaderOf(shares) {
  let best = 0;
  for (let i = 1; i < 4; i++) if (shares[i] > shares[best]) best = i;
  const sorted = shares.slice(0, 4).slice().sort((a, b) => b - a);
  return { key: FOUR[best], margin: sorted[0] - sorted[1] };
}

const CAT = { l: "love", j: "joy", s: "sadness", a: "anger", f: "anger", i: "insufficient" };

export async function loadAtlas(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const raw = await response.json();
  const { meta } = raw;

  const artists = (raw.artists || []).map((a, index) => ({
    index, name: a.n, code: a.c || null, place: a.p || "", originType: a.o || "", wiki: a.w || null,
  }));
  const songs = raw.songs.map((s, index) => {
    const song = {
      index, id: s.id, title: s.t, artist: s.a, status: s.st || "annotated", appearances: [],
      artists: (s.c || []).map(i => artists[i]),
    };
    if (s.e) {
      const marks = new Map((s.m || []).map(([i, l]) => [i, meta.labels[l]]));
      const sarcasm = new Set(s.z || []);
      let prev = 0;
      song.segments = [...s.e].map((code, i) => {
        const end = s.x[i] / 1000;
        const seg = {
          i, code, astra: meta.astra[code], cat: CAT[code] || "outside",
          start: prev, end, label: marks.get(i) || null, sarcasm: sarcasm.has(i),
        };
        prev = end;
        return seg;
      });
      song.shares = s.p;
      song.main = mainFeeling(s.p);
      song.sarcasm = song.segments.filter(g => g.sarcasm).reduce((t, g) => t + (g.end - g.start) * 100, 0);
    }
    return song;
  });

  const years = raw.years.map(y => ({
    year: y.y, est: y.est, songs: y.songs, annotated: y.ann, entries: y.entries,
    annotatedEntries: y.annEntries, gaps: y.gaps, shares: y.s, sarcasm: y.sarcasm,
    sarcasmSongs: y.sarcasmSongs, loveWord: y.loveWord, lex: y.lex,
    audio: y.audio ? { matched: y.audio[0], unresolved: y.audio[1], notProcessed: y.audio[2] } : null,
    genres: new Map(Object.entries(y.g).map(([k, v]) => [meta.genres[+k], v])),
  }));
  for (const y of years) y.leader = leaderOf(y.shares);

  const entries = new Map();
  for (const [key, rows] of Object.entries(raw.entries)) {
    const year = +key;
    entries.set(year, rows.map(([rank, si, tags, extra = {}], order) => {
      const song = songs[si];
      song.appearances.push({ year, rank });
      return {
        year, rank, order, song,
        title: extra.t || song.title, artist: extra.a || song.artist,
        genres: tags.map(t => meta.genres[t]),
        spotify: extra.sp || null,
        audio: extra.au ? Object.fromEntries(meta.audioFields.map((f, i) => [f, extra.au[i]])) : null,
      };
    }));
  }
  return {
    meta, songs, years, entries, artists,
    yearMap: new Map(years.map(y => [y.year, y])),
    segmentCount: songs.reduce((t, s) => t + (s.segments ? s.segments.length : 0), 0),
  };
}

// One shared tooltip. Content is built with DOM nodes (textContent only).
const tip = () => document.getElementById("tooltip");
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}
export function showTip(nodes, x, y) {
  const t = tip();
  t.replaceChildren(...nodes);
  t.hidden = false;
  const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
  let left = x + pad, top = y + pad;
  if (left + w > window.innerWidth - 8) left = x - w - pad;
  if (top + h > window.innerHeight - 8) top = y - h - pad;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${Math.max(8, top)}px`;
}
export function hideTip() { tip().hidden = true; }
export function tipRow(color, value, label) {
  return el("div", { class: "tt-row" },
    el("i", { class: "tt-key", style: `background:${color}` }),
    el("b", { text: value }),
    el("span", { text: label }));
}
export function anchorTip(nodes, element) {
  const r = element.getBoundingClientRect();
  showTip(nodes, r.right - 6, r.top + r.height / 2);
}
