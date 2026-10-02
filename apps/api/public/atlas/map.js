// The Mapbox map. Without a token (or if Mapbox GL JS did not load) the page keeps working and this
// module returns a no-op map.

const EMPTY = { type: "FeatureCollection", features: [] };

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Great-circle points from a to b ([lon, lat]), longitudes unwrapped so the line never jumps. */
export function arc(a, b, n = 48) {
  const rad = Math.PI / 180;
  const [l1, p1] = [a[0] * rad, a[1] * rad];
  const [l2, p2] = [b[0] * rad, b[1] * rad];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2,
      ),
    );
  if (d < 1e-6) return [a, b];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    pts.push([Math.atan2(y, x) / rad, Math.atan2(z, Math.sqrt(x * x + y * y)) / rad]);
  }
  for (let i = 1; i < pts.length; i++) {
    while (pts[i][0] - pts[i - 1][0] > 180) pts[i][0] -= 360;
    while (pts[i][0] - pts[i - 1][0] < -180) pts[i][0] += 360;
  }
  return pts;
}

function noMap(el, reason) {
  el.replaceChildren();
  const box = document.createElement("div");
  box.className = "map-off";
  const strong = document.createElement("strong");
  strong.textContent = "Map not shown";
  const p = document.createElement("span");
  p.textContent = reason;
  box.append(strong, p);
  el.append(box);
  const noop = () => {};
  return {
    enabled: false,
    setProjects: noop,
    setAccounts: noop,
    setMode: noop,
    select: noop,
    highlight: noop,
    showSites: noop,
    showFlows: noop,
    fitPoints: noop,
    fitBbox: noop,
    refreshColours: noop,
  };
}

export function createMap(el, { onProject, onCountry, legend }) {
  const token = document.querySelector('meta[name="cdop-mapbox-token"]')?.getAttribute("content");
  if (!token)
    return noMap(
      el,
      "This deployment has no Mapbox token. Set MAPBOX_API_KEY to a public (pk.) token to see projects and accounts on a map; everything else on this page works without it.",
    );
  const mapboxgl = window.mapboxgl;
  if (!mapboxgl)
    return noMap(el, "Mapbox GL JS did not load. Check the browser console for a blocked request.");

  mapboxgl.accessToken = token;
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const styleUrl = () => `mapbox://styles/mapbox/${dark.matches ? "dark-v11" : "light-v11"}`;
  const map = new mapboxgl.Map({
    container: el,
    style: styleUrl(),
    // Mercator: fitBounds is exact. Under Natural Earth it framed points off the canvas.
    projection: "mercator",
    center: [12, 18],
    zoom: 1.1,
    minZoom: 0.6,
    // Map-load events still go to events.mapbox.com (Mapbox bills by them); performance metrics do not.
    performanceMetricsCollection: false,
    attributionControl: true,
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100 }), "bottom-right");

  const data = { projects: EMPTY, accounts: EMPTY, sites: EMPTY, flows: EMPTY };
  let mode = "projects";
  let selected;
  let hovered;
  let ready = false;
  const pending = [];
  const whenReady = (fn) => (ready ? fn() : pending.push(fn));

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 10,
    maxWidth: "260px",
  });
  const popupContent = (title, lines) => {
    const div = document.createElement("div");
    const t = document.createElement("strong");
    t.textContent = title;
    div.append(t);
    for (const line of lines) {
      const p = document.createElement("div");
      p.className = "muted";
      p.textContent = line;
      div.append(p);
    }
    return div;
  };

  function paint() {
    const colour = {
      pipeline: css("--pipeline"),
      crediting: css("--crediting"),
      closed: css("--closed"),
    };
    const faded = mode === "accounts" ? 0.35 : 1;
    map.setPaintProperty("projects", "circle-color", [
      "match",
      ["get", "group"],
      "pipeline",
      colour.pipeline,
      "crediting",
      colour.crediting,
      colour.closed,
    ]);
    map.setPaintProperty("projects", "circle-opacity", faded);
    map.setPaintProperty("projects", "circle-stroke-opacity", faded);
    map.setPaintProperty("projects", "circle-stroke-color", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      css("--ink"),
      ["boolean", ["feature-state", "hover"], false],
      css("--ink"),
      css("--surface"),
    ]);
    map.setPaintProperty("sites-fill", "fill-color", [
      "match",
      ["get", "group"],
      "pipeline",
      colour.pipeline,
      "crediting",
      colour.crediting,
      colour.closed,
    ]);
    map.setPaintProperty("sites-line", "line-color", [
      "match",
      ["get", "group"],
      "pipeline",
      colour.pipeline,
      "crediting",
      colour.crediting,
      colour.closed,
    ]);
    map.setPaintProperty("flows", "line-color", css("--flow"));
    map.setPaintProperty("flow-ends", "circle-color", css("--account"));
    map.setPaintProperty("flow-ends", "circle-stroke-color", css("--account-ring"));
    map.setPaintProperty("accounts", "circle-color", css("--account"));
    map.setPaintProperty("accounts", "circle-stroke-color", css("--account-ring"));
    map.setPaintProperty("account-counts", "text-color", css("--surface"));
    map.setLayoutProperty("accounts", "visibility", mode === "accounts" ? "visible" : "none");
    map.setLayoutProperty("account-counts", "visibility", mode === "accounts" ? "visible" : "none");
  }

  function install() {
    for (const [name, value] of Object.entries(data))
      map.addSource(name, {
        type: "geojson",
        data: value,
        ...(name === "projects" ? { promoteId: "id" } : {}),
      });
    map.addLayer({
      id: "sites-fill",
      type: "fill",
      source: "sites",
      paint: { "fill-opacity": 0.18 },
    });
    map.addLayer({ id: "sites-line", type: "line", source: "sites", paint: { "line-width": 2 } });
    map.addLayer({
      id: "flows",
      type: "line",
      source: "flows",
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-width": ["get", "w"] },
    });
    map.addLayer({
      id: "flow-ends",
      type: "circle",
      source: "flows",
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 4, "circle-stroke-width": 2 },
    });
    map.addLayer({
      id: "accounts",
      type: "circle",
      source: "accounts",
      paint: {
        "circle-radius": ["get", "r"],
        "circle-stroke-width": 2,
        "circle-opacity": 0.9,
      },
    });
    map.addLayer({
      id: "account-counts",
      type: "symbol",
      source: "accounts",
      layout: {
        "text-field": ["to-string", ["get", "count"]],
        "text-size": 11,
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-allow-overlap": true,
      },
    });
    map.addLayer({
      id: "projects",
      type: "circle",
      source: "projects",
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          ["+", ["get", "r"], 3],
          ["get", "r"],
        ],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 2],
      },
    });
    map.addLayer({
      id: "project-names",
      type: "symbol",
      source: "projects",
      minzoom: 6,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-offset": [0, 1.3],
        "text-anchor": "top",
        "text-max-width": 12,
      },
      paint: {
        "text-color": css("--ink"),
        "text-halo-color": css("--surface"),
        "text-halo-width": 1.2,
      },
    });
    paint();
    if (selected) map.setFeatureState({ source: "projects", id: selected }, { selected: true });
  }

  map.on("style.load", () => {
    install();
    ready = true;
    for (const fn of pending.splice(0)) fn();
  });
  dark.addEventListener("change", () => {
    ready = false;
    map.setStyle(styleUrl());
  });

  map.on("mousemove", "projects", (e) => {
    const f = e.features?.[0];
    if (!f) return;
    map.getCanvas().style.cursor = "pointer";
    if (hovered && hovered !== f.id)
      map.setFeatureState({ source: "projects", id: hovered }, { hover: false });
    hovered = f.id;
    map.setFeatureState({ source: "projects", id: hovered }, { hover: true });
    popup
      .setLngLat(f.geometry.coordinates)
      .setDOMContent(popupContent(f.properties.name, [f.properties.line1, f.properties.line2]))
      .addTo(map);
  });
  map.on("mouseleave", "projects", () => {
    map.getCanvas().style.cursor = "";
    if (hovered) map.setFeatureState({ source: "projects", id: hovered }, { hover: false });
    hovered = undefined;
    popup.remove();
  });
  map.on("click", "projects", (e) => {
    const id = e.features?.[0]?.properties?.id;
    if (id) onProject(id);
  });
  map.on("mousemove", "accounts", (e) => {
    const f = e.features?.[0];
    if (!f) return;
    map.getCanvas().style.cursor = "pointer";
    popup
      .setLngLat(f.geometry.coordinates)
      .setDOMContent(popupContent(f.properties.country, [f.properties.line1, "Click to list them"]))
      .addTo(map);
  });
  map.on("mouseleave", "accounts", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });
  map.on("click", "accounts", (e) => {
    const code = e.features?.[0]?.properties?.code;
    if (code) onCountry(code);
  });

  const setData = (name, value) => {
    data[name] = value;
    whenReady(() => map.getSource(name)?.setData(value));
  };

  // The legend sits in the bottom-left corner; keep fitted points clear of it.
  const camera = () => ({
    padding: { top: 48, right: 56, left: 48, bottom: 40 + (legend?.offsetHeight ?? 0) },
    duration: 900,
  });

  return {
    enabled: true,
    setProjects(features) {
      setData("projects", { type: "FeatureCollection", features });
    },
    setAccounts(features) {
      setData("accounts", { type: "FeatureCollection", features });
    },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      whenReady(paint);
    },
    select(id) {
      whenReady(() => {
        if (selected && selected !== id)
          map.setFeatureState({ source: "projects", id: selected }, { selected: false });
        selected = id;
        if (id) map.setFeatureState({ source: "projects", id }, { selected: true });
      });
    },
    highlight(id) {
      whenReady(() => {
        if (hovered && hovered !== id)
          map.setFeatureState({ source: "projects", id: hovered }, { hover: false });
        hovered = id;
        if (id) map.setFeatureState({ source: "projects", id }, { hover: true });
      });
    },
    showSites(features = []) {
      setData("sites", { type: "FeatureCollection", features });
    },
    // Lines from `from` to `to`, wider for larger quantities, with a marker at each `to` (an account
    // end, or a project end that already has its own circle underneath).
    showFlows(lines = []) {
      const max = Math.max(1, ...lines.map((l) => l.quantity ?? 1));
      const ends = new Map(lines.map((l) => [l.to.join(","), l.to]));
      setData("flows", {
        type: "FeatureCollection",
        features: [
          ...lines.map((l) => ({
            type: "Feature",
            properties: { w: 1 + 3 * Math.sqrt((l.quantity ?? 1) / max) },
            geometry: { type: "LineString", coordinates: arc(l.from, l.to) },
          })),
          ...[...ends.values()].map((to) => ({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: to },
          })),
        ],
      });
    },
    fitPoints(points, { maxZoom = 9 } = {}) {
      if (!points.length) return;
      const lons = points.map((p) => p[0]);
      const lats = points.map((p) => p[1]);
      whenReady(() =>
        map.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          { ...camera(), maxZoom },
        ),
      );
    },
    fitBbox(bbox) {
      if (!bbox) return;
      whenReady(() =>
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { ...camera(), maxZoom: 13 },
        ),
      );
    },
    refreshColours() {
      whenReady(paint);
    },
  };
}
