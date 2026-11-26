// Listening links. A verified link exists only when Hit Atlas matched the recording
// (audio_features.csv carries its Spotify track ID). Everything else gets a search link
// that says it is a search.
import { el } from "./core.js";

const artCache = new Map();

export function spotifyTrackUrl(id) { return `https://open.spotify.com/track/${encodeURIComponent(id)}`; }
export function spotifySearchUrl(title, artist) {
  const lead = artist.split(/ featuring | feat\. | & | and | x | with /i)[0];
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${lead}`)}`;
}

// Cover art for a matched track via Spotify's public oEmbed endpoint (CORS-enabled).
export function fetchArtwork(id) {
  if (!artCache.has(id)) {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyTrackUrl(id))}`;
    artCache.set(id, fetch(url).then(r => (r.ok ? r.json() : null))
      .then(j => (j && j.thumbnail_url ? { src: j.thumbnail_url, title: j.title } : null))
      .catch(() => null));
  }
  return artCache.get(id);
}

export function listenLink(entry) {
  if (entry.spotify) {
    return el("a", { class: "listen", href: spotifyTrackUrl(entry.spotify), target: "_blank", rel: "noopener" },
      el("span", { class: "play", "aria-hidden": "true", text: "▶" }),
      `Play on Spotify`,
      el("span", { class: "sr-only", text: " (matched recording, opens in a new tab)" }));
  }
  return el("span", {},
    el("a", { class: "listen search", href: spotifySearchUrl(entry.title, entry.artist), target: "_blank", rel: "noopener" },
      el("span", { class: "play", "aria-hidden": "true", text: "⌕" }),
      "Search on Spotify",
      el("span", { class: "sr-only", text: " (opens in a new tab)" })),
    el("span", { class: "listen-note", text: "search, not a verified match" }));
}

export function embedFrame(id, title) {
  return el("iframe", {
    class: "sd-embed", title: `Spotify player: ${title}`, loading: "lazy", height: "80",
    allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
    src: `https://open.spotify.com/embed/track/${encodeURIComponent(id)}?utm_source=hit-atlas`,
  });
}
