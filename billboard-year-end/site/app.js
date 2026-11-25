"use strict";

const dataPath = "billboard-year-end/data/";
const byId = id => document.getElementById(id);
const yearText = year => year === 2026 ? "2026 estimate" : String(year);
const percent = d3.format(".1%");
const colors = [
  "#315c98", "#a9502e", "#7866ad", "#326f5a", "#db9630", "#546288",
  "#2e788b", "#a34970", "#858d28", "#716352", "#954a51", "#4485bd",
  "#e18361", "#7055a3", "#89a7bd", "#8b5948", "#3c7467", "#79718d",
];
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function options(select, items, text, value = d => d) {
  d3.select(select).selectAll("option").data(items)
    .join("option").attr("value", value).text(text);
}

function actionable(selection, label, activate) {
  return selection.classed("mark", true)
    .attr("tabindex", 0).attr("role", "button").attr("aria-label", label)
    .on("click", (_, d) => activate(d))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(d);
      }
    });
}

function swatches(id, entries) {
  const labels = d3.select(id).selectAll("span.key").data(entries).join("span").attr("class", "key");
  labels.selectAll("i").data(d => [d]).join("i").attr("class", "swatch")
    .attr("aria-hidden", "true").style("background", d => d.color);
  labels.selectAll("span").data(d => [d]).join("span").text(d => d.label);
}

function genreView(entries, genresByEntry, years) {
  const totals = new Map(years.map(year => [year, new Map()]));
  const chartSizes = d3.rollup(entries, d => d.length, d => d.year);
  const vocabulary = new Map();
  for (const entry of entries) {
    const tags = genresByEntry.get(entry.entry_id);
    for (const tag of tags) {
      const weight = 1 / tags.length;
      const current = totals.get(entry.year);
      current.set(tag, (current.get(tag) || 0) + weight);
      vocabulary.set(tag, (vocabulary.get(tag) || 0) + weight);
    }
  }
  const genres = [...vocabulary.keys()].sort((a, b) =>
    d3.descending(vocabulary.get(a), vocabulary.get(b)) || d3.ascending(a, b));
  const color = d3.scaleOrdinal(genres, colors);
  const yearly = years.map(year => {
    const shares = [...totals.get(year)].map(([tag, value]) => [tag, value / chartSizes.get(year)]);
    return { year, ...Object.fromEntries(shares) };
  });
  const trend = d3.select("#genre-trend");
  const x = d3.scaleLinear(d3.extent(years), [53, 740]);
  const y = d3.scaleLinear([0, 1], [309, 16]);
  const series = d3.stack().keys(genres).value((d, key) => d[key] || 0)(yearly);
  const area = d3.area().x(d => x(d.data.year)).y0(d => y(d[0])).y1(d => y(d[1]));
  trend.selectAll("path.area").data(series).join("path").attr("class", "area")
    .attr("d", area).attr("fill", d => color(d.key)).append("title").text(d => d.key);
  trend.append("g").attr("class", "chart-axis").attr("transform", "translate(0,309)")
    .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format("d")));
  trend.append("g").attr("class", "chart-axis").attr("transform", "translate(53,0)")
    .call(d3.axisLeft(y).ticks(4, ".0%"));
  swatches("#genre-legend", genres.map(label => ({ label, color: color(label) })));

  const pie = d3.select("#genre-pie").append("g").attr("transform", "translate(130,115)");
  const arc = d3.arc().innerRadius(0).outerRadius(100);
  function render(year) {
    const row = yearly[years.indexOf(year)];
    const breakdown = genres.map(name => ({ name, share: row[name] || 0 }))
      .filter(d => d.share > 0);
    byId("pie-heading").textContent = yearText(year);
    const wedges = pie.selectAll("path").data(d3.pie().value(d => d.share).sort(null)(breakdown), d => d.data.name)
      .join("path").attr("fill", d => color(d.data.name)).attr("stroke", "#fff").attr("d", arc);
    wedges.selectAll("title").data(d => [d]).join("title")
      .text(d => d.data.name + " " + percent(d.data.share));
    d3.select("#genre-shares").selectAll("li").data(breakdown.sort((a, b) => b.share - a.share))
      .join("li").text(d => d.name + " " + percent(d.share));
  }
  const selector = byId("genre-year");
  options(selector, years, yearText);
  selector.value = years.includes(2025) ? 2025 : years.at(-1);
  selector.addEventListener("change", () => render(+selector.value));
  render(+selector.value);
}

function originView(entries, artists, credits, world, years) {
  const artistById = new Map(artists.map(artist => [artist.artist_id, artist]));
  const artistIdsBySong = d3.group(credits, row => row.song_id);
  const countries = byId("origin-country");
  const selector = byId("origin-artist");
  const from = byId("year-from");
  const to = byId("year-to");
  const projection = d3.geoEqualEarth().fitExtent([[10, 10], [750, 395]], world);
  const path = d3.geoPath(projection);
  const map = d3.select("#origin-map");
  const tree = d3.select("#artist-treemap");
  const artistGenres = [...new Set(artists.map(artist => artist.artist_genres.split("|")[0]).filter(Boolean))]
    .sort(d3.ascending);
  const genreColor = d3.scaleOrdinal(artistGenres, colors);
  const thresholds = [1, 5, 20, 100, 500];
  const shades = ["#e7edf2", "#cfe0ee", "#a2c6e4", "#6c9ec9", "#3974ad", "#204975"];
  const shade = d3.scaleThreshold(thresholds, shades);
  swatches("#map-legend", ["0", "1–4", "5–19", "20–99", "100–499", "500+"]
    .map((label, i) => ({ label, color: shades[i] })));
  const fragments = new Set(["the", "cast", ":"]);

  options(from, years, yearText);
  options(to, years, yearText);
  from.value = years[0];
  to.value = 2025;
  let selectedCountry = "US";
  let selectedArtist = "";
  let displayedArtists = [];

  function drawSongs() {
    const panel = byId("artist-songs");
    const selected = displayedArtists.find(d => d.artist.artist_id === selectedArtist);
    panel.replaceChildren();
    if (!selected) {
      panel.textContent = displayedArtists.length ? "Select an artist to see their chart history." : "No charting artists in this selection.";
      return;
    }
    const songs = d3.groups(selected.entries, row => row.song_id)
      .map(([, list]) => ({ title: list[0].title, list: list.sort((a, b) => a.year - b.year) }))
      .sort((a, b) => d3.min(a.list, d => d.rank) - d3.min(b.list, d => d.rank) || d3.ascending(a.title, b.title));
    d3.select(panel).append("p").text(selected.artist.name + " · " + selected.entries.length + " chart appearances");
    d3.select(panel).append("ol").selectAll("li").data(songs).join("li")
      .text(d => d.title + " — " + d.list.map(e => yearText(e.year) + " #" + e.rank).join(", "));
  }

  function render() {
    const start = +from.value;
    const end = +to.value;
    const byArtist = new Map();
    for (const entry of entries) {
      if (entry.year < start || entry.year > end) continue;
      for (const credit of artistIdsBySong.get(entry.song_id) || []) {
        const artist = artistById.get(credit.artist_id);
        if (fragments.has(artist.name.toLowerCase())) continue;
        if (!byArtist.has(artist.artist_id)) {
          const tag = artist.artist_genres.split("|")[0];
          byArtist.set(artist.artist_id, { artist, entries: [], genre: tag || "Unknown" });
        }
        byArtist.get(artist.artist_id).entries.push(entry);
      }
    }
    const located = [...byArtist.values()].filter(d => d.artist.country_code);
    const byCountry = d3.group(located, d => d.artist.country_code);
    const codes = [...byCountry.keys()].sort((a, b) => d3.ascending(countryNames.of(a), countryNames.of(b)));
    if (!byCountry.has(selectedCountry)) selectedCountry = codes[0] || "";
    const count = code => byCountry.get(code)?.length || 0;
    options(countries, codes, code => countryNames.of(code) + " (" + count(code) + ")");
    countries.value = selectedCountry;
    byId("origin-summary").textContent =
      located.length + " of " + byArtist.size + " artists have a documented origin across " + codes.length + " countries or territories.";

    const shapes = map.selectAll("path.country").data(world.features).join("path")
      .attr("d", path).attr("fill", d => shade(count(d.properties.code)))
      .attr("stroke", d => d.properties.code === selectedCountry ? "#18283a" : "#fff")
      .attr("stroke-width", d => d.properties.code === selectedCountry ? 2.2 : .6);
    const countryLabel = d => d.properties.name + ": " + count(d.properties.code) + " artists";
    shapes.attr("class", "country").attr("tabindex", null).attr("role", null).attr("aria-label", null).on("click", null).on("keydown", null);
    actionable(shapes.filter(d => count(d.properties.code) > 0), countryLabel, d => {
      chooseCountry(d.properties.code);
      countries.focus();
    }).classed("country", true);
    shapes.selectAll("title").data(d => [d]).join("title").text(countryLabel);

    displayedArtists = (byCountry.get(selectedCountry) || []).slice()
      .sort((a, b) => b.entries.length - a.entries.length || d3.ascending(a.artist.name, b.artist.name));
    if (!displayedArtists.some(d => d.artist.artist_id === selectedArtist)) selectedArtist = "";
    byId("tree-title").textContent = selectedCountry
      ? countryNames.of(selectedCountry) + " · " + displayedArtists.length + " artists" : "Artists in the selected origin";
    const groups = d3.groups(displayedArtists, d => d.genre);
    const root = d3.hierarchy({ children: groups.map(([genre, children]) => ({ genre, children })) })
      .sum(d => d.entries?.length || 0).sort((a, b) => b.value - a.value);
    d3.treemap().size([560, 355]).paddingInner(1).paddingOuter(2)(root);
    const cells = tree.selectAll("g.tile").data(root.leaves().filter(d => d.data.artist), d => d.data.artist.artist_id)
      .join("g").attr("class", "tile").attr("transform", d => "translate(" + d.x0 + "," + d.y0 + ")");
    const tileLabel = d => d.data.artist.name + ", " + d.data.genre + ", " + d.data.entries.length
      + " chart appearances (" + percent(d.value / root.value) + ")";
    const rects = cells.selectAll("rect").data(d => [d]).join("rect")
      .attr("width", d => Math.max(0, d.x1 - d.x0)).attr("height", d => Math.max(0, d.y1 - d.y0))
      .attr("fill", d => d.data.genre === "Unknown" ? "#a9b4bd" : genreColor(d.data.genre))
      .attr("stroke", d => d.data.artist.artist_id === selectedArtist ? "#151d26" : "none")
      .attr("stroke-width", 3);
    actionable(rects, tileLabel, d => {
      chooseArtist(d.data.artist.artist_id);
      selector.focus();
    });
    rects.selectAll("title").data(d => [d]).join("title").text(tileLabel);
    cells.selectAll("text").data(d => d.x1 - d.x0 > 82 && d.y1 - d.y0 > 23 ? [d] : [])
      .join("text").attr("x", 5).attr("y", 15).attr("fill", "white").attr("font-size", 11)
      .attr("pointer-events", "none")
      .text(d => {
        const max = Math.floor((d.x1 - d.x0 - 10) / 6);
        const name = d.data.artist.name;
        return name.length <= max ? name : name.slice(0, max - 1) + "…";
      });
    options(selector, [{ artist: { artist_id: "", name: "Select an artist" } }, ...displayedArtists],
      d => d.artist.name, d => d.artist.artist_id);
    selector.value = selectedArtist;
    drawSongs();
  }
  function chooseCountry(code) {
    selectedCountry = code;
    selectedArtist = "";
    render();
  }
  function chooseArtist(id) {
    selectedArtist = id;
    selector.value = id;
    tree.selectAll("rect").attr("stroke", d => d.data.artist.artist_id === id ? "#151d26" : "none");
    drawSongs();
  }
  from.addEventListener("change", () => {
    if (+from.value > +to.value) to.value = from.value;
    render();
  });
  to.addEventListener("change", () => {
    if (+to.value < +from.value) from.value = to.value;
    render();
  });
  countries.addEventListener("change", () => chooseCountry(countries.value));
  selector.addEventListener("change", () => chooseArtist(selector.value));
  render();
}

async function start() {
  const [entries, genres, artists, credits, world] = await Promise.all([
    d3.csv(dataPath + "chart_entries.csv", d => ({ ...d, year: +d.year, rank: +d.rank })),
    d3.csv(dataPath + "genres.csv"),
    d3.csv(dataPath + "artists.csv"),
    d3.csv(dataPath + "song_artists.csv"),
    d3.json("billboard-year-end/site/world.geojson"),
  ]);
  const years = Array.from(new Set(entries.map(d => d.year))).sort(d3.ascending);
  const genresByEntry = new Map(genres.map(d => [d.entry_id, d.genres ? d.genres.split("|") : ["Unknown"]]));
  genreView(entries, genresByEntry, years);
  originView(entries, artists, credits, world, years);
  byId("loading").textContent = years[0] + "–2025 Billboard year-end charts plus the 2026 year-to-date estimate.";
}

start().catch(error => {
  byId("loading").textContent = "Could not load chart data. Reload the page to try again.";
  console.error(error);
});
