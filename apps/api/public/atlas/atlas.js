// CDOP Atlas: projects and registry accounts from the reference API, on a map, with drill-throughs
// and charts. Every view is built by following HAL links from /v2, and lists the calls it made.

import {
  collect,
  embedded,
  explorerHref,
  get,
  getHeaders,
  linkHref,
  linkList,
  local,
  startTrace,
  withQuery,
} from "./hal.js";
import {
  chartCard,
  dataTable,
  fmtCompact,
  fmtInt,
  hideTip,
  key,
  legendRow,
  meter,
  stackedBars,
  stackedColumns,
} from "./charts.js";
import { createMap } from "./map.js";
import { countryCentroid, countryName } from "./countries.js";

// Vocabulary ------------------------------------------------------------------------------------

const STAGE_GROUPS = [
  {
    key: "pipeline",
    label: "In development",
    color: "var(--pipeline)",
    stages: ["draft", "listed", "registered"],
  },
  {
    key: "crediting",
    label: "Validated or verified",
    color: "var(--crediting)",
    stages: ["validated", "verified"],
  },
  {
    key: "closed",
    label: "Closed",
    color: "var(--closed)",
    stages: ["retired", "withdrawn", "rejected"],
  },
];
const STAGES = [
  "draft",
  "listed",
  "registered",
  "validated",
  "verified",
  "retired",
  "withdrawn",
  "rejected",
];
const stageLabel = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "Unknown");
const groupOf = (stage) => STAGE_GROUPS.find((g) => g.stages.includes(stage)) ?? STAGE_GROUPS[2];

// Stacking order keeps Active and Buffer apart: their colours are only safe as non-neighbours.
const UNIT_GROUPS = [
  {
    key: "active",
    label: "Active",
    color: "var(--u-active)",
    states: ["active", "pending", "on_hold"],
  },
  { key: "retired", label: "Retired", color: "var(--u-retired)", states: ["retired"] },
  { key: "buffer", label: "Buffer", color: "var(--u-buffer)", states: ["buffer"] },
  {
    key: "cancelled",
    label: "Cancelled",
    color: "var(--u-cancelled)",
    states: ["cancelled", "expired"],
  },
];
const unitGroupOf = (state) => UNIT_GROUPS.find((g) => g.states.includes(state)) ?? UNIT_GROUPS[0];

const STANDARDS = {
  wcc: "Woodland Carbon Code",
  pc: "Peatland Code",
  vcs: "VCS",
  gs4gg: "Gold Standard",
  acr: "ACR",
  "plan-vivo": "Plan Vivo",
  puro: "Puro",
};
const REGISTRIES = {
  ukl: "UK Land Carbon Registry",
  verra: "Verra",
  "gold-standard": "Gold Standard",
  acr: "ACR",
  "plan-vivo": "Plan Vivo",
  puro: "Puro",
};
const ACCOUNT_TYPES = {
  project_developer: "Project developer",
  project_proponent: "Project proponent",
  corporate_end_user: "Corporate buyer",
  retail_aggregator: "Retail aggregator",
  trader: "Trader",
  vvb: "Validation and verification body",
  code_administrator: "Code administrator",
  registry_operator: "Registry operator",
  buffer_pool: "Buffer pool",
  system: "System",
};
const standardName = (id) => STANDARDS[id] ?? id;
const registryName = (id) => REGISTRIES[id] ?? id;
const accountTypeName = (t) => ACCOUNT_TYPES[t] ?? t;
// The seed uses ISO 3166 long names ("United Kingdom of Great Britain and Northern Ireland (the)");
// the browser's short name reads better.
const projectCountry = (p) => countryName(p.country_code, p.country_name);

// Formatting --------------------------------------------------------------------------------------

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : "");
const fmtStamp = (iso) =>
  iso ? `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))} UTC` : "";
const fmtTonnes = (n) => (n == null ? "" : `${fmtCompact(n)} tCO2e`);
const fmtBytes = (n) =>
  n == null ? "" : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
const sentence = (s) =>
  s
    ? s
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
    : "";

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat(Infinity))
    if (c !== undefined && c !== null && c !== false) el.append(c);
  return el;
}
const dot = (color) => key(color, "dot");
const external = (href, text) => h("a", { href, target: "_blank", rel: "noopener" }, text);

// State ------------------------------------------------------------------------------------------

const state = {
  root: undefined,
  projects: [],
  projectById: new Map(),
  accounts: [],
  accountById: new Map(),
  registryOfStandard: new Map(),
  maxMitigation: 1,
  units: undefined, // Promise<unit index rows>, loaded after first paint
  boot: undefined, // the requests every view shares
  filters: { standard: "", stage: "", country: "", q: "" },
  accountType: "",
  unitGroup: "",
  sort: "name",
  path: "",
};
const FILTERS = ["standard", "stage", "country", "q"];

let map;
const form = document.getElementById("filters");
const panel = document.getElementById("panel");
const legendEl = document.getElementById("map-legend");

function projectMatches(p, f = state.filters) {
  if (f.standard && p.standard !== f.standard) return false;
  if (f.stage) {
    const [kind, value] = f.stage.split(":");
    if (kind === "group" ? groupOf(p.lifecycle_stage).key !== value : p.lifecycle_stage !== value)
      return false;
  }
  if (f.country && p.country_code !== f.country) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = [
      p.project_name,
      p.project_identifier,
      p.current_registry_project_id,
      p.country_subdivision_name,
      projectCountry(p),
      standardName(p.standard),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
function accountMatches(a, f = state.filters) {
  if (f.standard && a.registry !== state.registryOfStandard.get(f.standard)) return false;
  if (f.country && a.country_code !== f.country) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (
      !`${a.name} ${a.native_account_id ?? ""} ${a.organisation_name ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
  }
  return true;
}
const filteredProjects = () => state.projects.filter((p) => projectMatches(p));
const filteredAccounts = () => state.accounts.filter((a) => accountMatches(a));
const anyFilter = () => FILTERS.some((k) => state.filters[k]);

const resource = (rel, id) => `${linkHref(state.root, rel)}/${encodeURIComponent(id)}`;

// Routing --------------------------------------------------------------------------------------
// The path is in the fragment; the filters ride along as a query so a view can be shared. Each link
// includes the current filters explicitly, so unfiltered URLs and browser Back are predictable.

function parseHash() {
  const raw = location.hash.slice(1) || "/";
  const [path, qs] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(qs ?? "") };
}
function filterQuery() {
  const p = new URLSearchParams();
  for (const k of FILTERS) if (state.filters[k]) p.set(k, state.filters[k]);
  if (state.accountType) p.set("type", state.accountType);
  const s = p.toString();
  return s ? `?${s}` : "";
}
function syncHash() {
  const next = `#${parseHash().path}${filterQuery()}`;
  if (location.hash !== next) history.replaceState(null, "", next);
}
function go(path) {
  location.hash = `#${path}${filterQuery()}`;
}
const linkTo = (path) => `#${path}${filterQuery()}`;
const listScroll = new Map();
let previousView = "";

function route() {
  clearTimeout(searchTimer);
  const { path, params } = parseHash();
  for (const k of FILTERS) state.filters[k] = params.get(k) ?? "";
  state.accountType = params.get("type") ?? "";
  writeForm();
  updateMapData();
  syncHash();
  if (previousView) listScroll.set(previousView, panel.scrollTop);
  const changed = path !== state.path;
  state.path = path;
  previousView = `${path}${filterQuery()}`;
  clearTimeout(fitTimer);
  void render(path, { scroll: changed });
  if (changed && ["/", "/projects", "/accounts"].includes(path)) fitResults();
}

// Filters ----------------------------------------------------------------------------------------

function option(value, label) {
  return h("option", { value }, label);
}
function fillFilterOptions() {
  const std = form.elements.standard;
  for (const id of Object.keys(STANDARDS).filter((s) =>
    state.projects.some((p) => p.standard === s),
  ))
    std.append(option(id, standardName(id)));
  const stage = form.elements.stage;
  stage.append(
    h(
      "optgroup",
      { label: "Groups" },
      STAGE_GROUPS.map((g) => option(`group:${g.key}`, g.label)),
    ),
    h(
      "optgroup",
      { label: "Stages" },
      STAGES.filter((s) => state.projects.some((p) => p.lifecycle_stage === s)).map((s) =>
        option(`stage:${s}`, stageLabel(s)),
      ),
    ),
  );
  const names = new Map();
  for (const p of state.projects) names.set(p.country_code, projectCountry(p));
  for (const a of state.accounts)
    if (a.country_code && !names.has(a.country_code))
      names.set(a.country_code, countryName(a.country_code));
  const country = form.elements.country;
  for (const [code, name] of [...names].sort((a, b) => a[1].localeCompare(b[1])))
    country.append(option(code, name));
}
function writeForm() {
  for (const k of FILTERS) form.elements[k].value = state.filters[k];
}
function readForm() {
  for (const k of FILTERS) state.filters[k] = form.elements[k].value.trim();
}
let fitTimer;
let searchTimer;
function onFiltersChanged({ fit = true } = {}) {
  clearTimeout(searchTimer);
  syncHash();
  window.cdopAnalytics?.event("atlas_filters", {
    standard: Boolean(state.filters.standard),
    stage: Boolean(state.filters.stage),
    country: Boolean(state.filters.country),
    search: Boolean(state.filters.q),
  });
  updateMapData();
  const { path } = parseHash();
  if (!["/", "/projects", "/accounts"].includes(path)) {
    go(path.startsWith("/accounts") ? "/accounts" : "/projects");
    return;
  }
  previousView = `${path}${filterQuery()}`;
  panel.scrollTop = 0;
  void render(path, { scroll: false });
  clearTimeout(fitTimer);
  if (fit && ["/", "/projects"].includes(path)) fitTimer = setTimeout(fitToProjects, 350);
  if (fit && path === "/accounts") fitTimer = setTimeout(fitToAccounts, 350);
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  readForm();
  onFiltersChanged();
});
form.addEventListener("change", (e) => {
  if (e.target.name === "q") return;
  readForm();
  onFiltersChanged();
});
form.addEventListener("input", (e) => {
  if (e.target.name !== "q") return;
  clearTimeout(searchTimer);
  readForm();
  searchTimer = setTimeout(onFiltersChanged, 180);
});
form.addEventListener("reset", (e) => {
  e.preventDefault();
  clearFilters();
});
function clearFilters() {
  for (const k of FILTERS) state.filters[k] = "";
  state.accountType = "";
  writeForm();
  onFiltersChanged();
}
function emptyResults(kind) {
  return h(
    "div",
    { class: "empty-state" },
    h("h2", {}, `No ${kind} match your filters`),
    h("p", {}, "Try a different search or remove a filter to see more results."),
    h("button", { type: "button", onclick: clearFilters }, "Clear all filters"),
  );
}

const mobile = window.matchMedia("(max-width: 860px)");
let expanded = false;
let mobileMap = false;
const toggleMap = document.getElementById("toggle-map");
const fitMap = document.getElementById("fit-map");
function updateLayout() {
  document.body.classList.toggle("details-only", expanded || !map.enabled);
  document.body.classList.toggle("mobile-map", mobileMap && map.enabled);
  toggleMap.textContent = mobile.matches
    ? mobileMap
      ? "Show results"
      : "Show map"
    : expanded
      ? "Show map"
      : "Expand details";
  toggleMap.setAttribute("aria-pressed", String(mobile.matches ? mobileMap : expanded));
  fitMap.hidden = !map.enabled || (mobile.matches ? !mobileMap : expanded);
  requestAnimationFrame(() => map.resize());
}
toggleMap.addEventListener("click", () => {
  window.cdopAnalytics?.event("atlas_layout_toggle");
  if (mobile.matches) mobileMap = !mobileMap;
  else expanded = !expanded;
  updateLayout();
  if (mobile.matches ? mobileMap : !expanded) requestAnimationFrame(() => map.refit());
});
document.querySelector(".skip-link").addEventListener("click", (e) => {
  e.preventDefault();
  mobileMap = false;
  updateLayout();
  panel.focus();
});
function showOnMap(fit) {
  expanded = false;
  mobileMap = true;
  updateLayout();
  requestAnimationFrame(fit);
}
mobile.addEventListener("change", updateLayout);
fitMap.addEventListener("click", fitResults);
function fitResults() {
  if (state.path.startsWith("/accounts")) fitToAccounts();
  else fitToProjects();
}
function updateChrome() {
  const accounts = state.path.startsWith("/accounts");
  const projects = filteredProjects();
  const matches = accounts
    ? filteredAccounts().filter((a) => !state.accountType || a.account_type === state.accountType)
    : projects;
  const total = accounts ? state.accounts.length : state.projects.length;
  const kind = accounts ? "accounts" : "projects";
  document.getElementById("result-count").textContent =
    `${fmtInt(matches.length)} of ${fmtInt(total)} ${kind}`;
  form.elements.stage.disabled = accounts;
  form.elements.stage.title = accounts ? "Project stage applies to projects only" : "";
  form.elements.q.placeholder = accounts
    ? "Account, organisation or registry ID"
    : "Project, country or registry ID";
  form.querySelector('[type="reset"]').disabled = !anyFilter() && !state.accountType;
  const chips = FILTERS.filter((k) => state.filters[k]).map((k) => {
    const label =
      k === "q"
        ? `Search: ${state.filters[k]}`
        : `${k === "stage" ? "Project stage" : k[0].toUpperCase() + k.slice(1)}: ${form.elements[k].selectedOptions[0]?.textContent ?? state.filters[k]}${accounts && k === "stage" ? " (projects only)" : ""}`;
    return h(
      "button",
      {
        type: "button",
        class: "filter-chip",
        "aria-label": `Remove ${label}`,
        onclick: () => {
          state.filters[k] = "";
          writeForm();
          onFiltersChanged();
          form.elements[k === "stage" && accounts ? "q" : k].focus();
        },
      },
      label,
      h("span", { "aria-hidden": "true" }, " ×"),
    );
  });
  if (state.accountType)
    chips.push(
      h(
        "button",
        {
          type: "button",
          class: "filter-chip",
          "aria-label": "Remove account type filter",
          onclick: () => {
            state.accountType = "";
            onFiltersChanged();
          },
        },
        `Account type: ${accountTypeName(state.accountType)} ×`,
      ),
    );
  document.getElementById("active-filters").replaceChildren(...chips);
  document
    .getElementById("view-nav")
    .replaceChildren(tabs(accounts ? "accounts" : state.path === "/" ? "overview" : "projects"));
}

// Map --------------------------------------------------------------------------------------------

function projectFeature(p) {
  const est = p.estimated_total_emissions_mitigation ?? 0;
  return {
    type: "Feature",
    id: p.id,
    properties: {
      id: p.id,
      name: p.project_name,
      group: groupOf(p.lifecycle_stage).key,
      r: 4 + 10 * Math.sqrt(est / state.maxMitigation),
      line1: `${standardName(p.standard)} · ${stageLabel(p.lifecycle_stage)}`,
      line2: `${p.country_subdivision_name ? `${p.country_subdivision_name}, ` : ""}${projectCountry(p)}${est ? ` · est. ${fmtTonnes(est)}` : ""}`,
    },
    geometry: { type: "Point", coordinates: [p.centroid.lon, p.centroid.lat] },
  };
}
function accountFeatures(accounts) {
  const byCountry = new Map();
  for (const a of accounts) {
    if (!countryCentroid(a.country_code)) continue;
    const list = byCountry.get(a.country_code) ?? [];
    list.push(a);
    byCountry.set(a.country_code, list);
  }
  const max = Math.max(1, ...[...byCountry.values()].map((l) => l.length));
  return [...byCountry].map(([code, list]) => {
    const types = new Map();
    for (const a of list) types.set(a.account_type, (types.get(a.account_type) ?? 0) + 1);
    const top = [...types].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      type: "Feature",
      properties: {
        code,
        country: countryName(code),
        count: list.length,
        r: 8 + 10 * Math.sqrt(list.length / max),
        line1: `${list.length} account${list.length === 1 ? "" : "s"}: ${top.map(([t, n]) => `${n} ${accountTypeName(t).toLowerCase()}`).join(", ")}`,
      },
      geometry: { type: "Point", coordinates: countryCentroid(code) },
    };
  });
}
function updateMapData() {
  map.setProjects(
    filteredProjects()
      .filter((p) => p.centroid)
      .map(projectFeature),
  );
  map.setAccounts(
    accountFeatures(
      filteredAccounts().filter((a) => !state.accountType || a.account_type === state.accountType),
    ),
  );
}
function fitToProjects() {
  const pts = filteredProjects()
    .filter((p) => p.centroid)
    .map((p) => [p.centroid.lon, p.centroid.lat]);
  map.fitPoints(pts, { maxZoom: 7 });
}
function fitToAccounts() {
  const pts = filteredAccounts()
    .filter((a) => !state.accountType || a.account_type === state.accountType)
    .map((a) => countryCentroid(a.country_code))
    .filter(Boolean);
  map.fitPoints(pts, { maxZoom: 4 });
}
function setLegend(kind, extra) {
  if (!map.enabled) return legendEl.replaceChildren();
  const rows = [];
  if (kind === "accounts") {
    rows.push(h("div", { class: "title" }, "Registry accounts"));
    rows.push(
      h(
        "div",
        { class: "legend" },
        h("span", {}, dot("var(--account)"), "Accounts per country (number inside)"),
      ),
    );
    rows.push(
      h(
        "div",
        { class: "chart-note" },
        "Placed at the country's centre: accounts carry a country, not a location.",
      ),
    );
  } else {
    rows.push(h("div", { class: "title" }, "Projects by stage"));
    rows.push(
      h(
        "div",
        { class: "legend" },
        STAGE_GROUPS.map((g) => h("span", {}, dot(g.color), g.label)),
      ),
    );
    rows.push(h("div", { class: "chart-note" }, "Circle area: estimated total mitigation."));
  }
  if (extra)
    rows.push(
      h(
        "div",
        { class: "legend" },
        h(
          "span",
          {},
          h("span", {
            class: "swatch",
            style: { height: "2px", width: "14px", background: "var(--flow)" },
          }),
          extra,
        ),
      ),
    );
  legendEl.replaceChildren(...rows);
}
function resetMapFocus() {
  map.select(undefined);
  map.showSites([]);
  map.showFlows([]);
}

// Shared pieces ------------------------------------------------------------------------------------

function tabs(current) {
  const item = (id, label, count) =>
    h(
      "a",
      {
        href: linkTo(id === "overview" ? "/" : `/${id}`),
        "aria-current": current === id ? "page" : undefined,
      },
      label,
      count !== undefined ? h("span", { class: "count" }, ` ${fmtInt(count)}`) : undefined,
    );
  return h(
    "nav",
    { class: "tabs", "aria-label": "Views" },
    item("overview", "Overview"),
    item("projects", "Projects", filteredProjects().length),
    item("accounts", "Accounts", filteredAccounts().length),
  );
}
function subtabs(base, current, items) {
  return h(
    "nav",
    { class: "subtabs", "aria-label": "Sections" },
    items.map(([id, label, count]) =>
      h(
        "a",
        {
          href: linkTo(id ? `${base}/${id}` : base),
          "aria-current": current === (id || "overview") ? "page" : undefined,
        },
        label,
        count ? ` ${fmtInt(count)}` : "",
      ),
    ),
  );
}
function kpi(label, value, note) {
  return h(
    "div",
    { class: "kpi" },
    h("div", { class: "label" }, label),
    h("div", { class: "value" }, value),
    note ? h("div", { class: "note" }, note) : undefined,
  );
}
function facts(pairs) {
  return h(
    "dl",
    { class: "facts" },
    pairs
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]),
  );
}
function section(title, sub, ...body) {
  return h(
    "section",
    { class: "section" },
    h("h2", {}, title),
    sub ? h("p", { class: "sub" }, sub) : undefined,
    ...body,
  );
}
function stageChip(stage) {
  return h("span", { class: "chip" }, dot(groupOf(stage).color), stageLabel(stage));
}
function unitStatusChip(u) {
  const g = unitGroupOf(u.lifecycle_state ?? u.state);
  return h("span", { class: "chip" }, dot(g.color), u.status ?? g.label);
}
function accountLink(id) {
  if (!id) return "";
  const a = state.accountById.get(id);
  return h("a", { href: linkTo(`/accounts/${id}`) }, a?.name ?? id);
}
function projectLink(id) {
  const p = state.projectById.get(id);
  return h("a", { href: linkTo(`/projects/${id}`) }, p?.project_name ?? id);
}
function timeline(records, describe) {
  return h(
    "ol",
    { class: "timeline" },
    records.map((r) => {
      const d = describe(r);
      return h(
        "li",
        { class: r.is_current ? "current" : undefined },
        h("div", { class: "when" }, fmtStamp(r.effective_at), r.is_current ? " · current" : ""),
        h("div", { class: "what" }, d.what),
        d.how ? h("div", { class: "how" }, d.how) : undefined,
      );
    }),
  );
}
function sumUnits(units) {
  const values = Object.fromEntries(UNIT_GROUPS.map((g) => [g.key, 0]));
  for (const u of units) values[unitGroupOf(u.lifecycle_state).key] += u.quantity ?? 0;
  return values;
}

function footer(trace) {
  const el = h("footer", { class: "sources" });
  const disclosure = h("details");
  el.append(disclosure);
  const pathOf = (u) => {
    const url = new URL(u);
    return decodeURIComponent(url.pathname + url.search);
  };
  const list = (set) =>
    h(
      "ul",
      {},
      [...set].map((u) =>
        h(
          "li",
          {},
          h("a", { href: explorerHref(u), target: "_blank", rel: "noopener" }, `GET ${pathOf(u)}`),
        ),
      ),
    );
  const update = () => {
    disclosure.replaceChildren(
      h("summary", {}, "API calls behind this view"),
      h("p", {}, "Each request opens in HAL Explorer."),
      list(trace),
      h(
        "details",
        {},
        h("summary", {}, `Plus the index every view shares (${state.boot.size} calls)`),
        list(state.boot),
      ),
    );
  };
  update();
  return { el, update };
}

// Views ------------------------------------------------------------------------------------------

let renderSeq = 0;
async function render(path, { scroll }) {
  const seq = ++renderSeq;
  hideTip();
  updateChrome();
  panel.setAttribute("aria-busy", "true");
  const trace = startTrace();
  const foot = footer(trace);
  const current = () => seq === renderSeq;
  const parts = path.split("/").filter(Boolean);
  const ctx = { current, done: () => current() && foot.update() };
  let view;
  try {
    if (!parts.length) view = overview(ctx);
    else if (parts[0] === "projects" && !parts[1]) view = projectList();
    else if (parts[0] === "projects") {
      if (scroll) panel.replaceChildren(h("p", { class: "loading" }, "Loading project…"));
      view = await projectDetail(decodeURIComponent(parts[1]), parts[2] ?? "overview", ctx);
    } else if (parts[0] === "units") {
      if (scroll) panel.replaceChildren(h("p", { class: "loading" }, "Loading unit block…"));
      view = await unitDetail(decodeURIComponent(parts[1]), ctx);
    } else if (parts[0] === "accounts" && !parts[1]) view = accountList();
    else if (parts[0] === "accounts") {
      if (scroll) panel.replaceChildren(h("p", { class: "loading" }, "Loading account…"));
      view = await accountDetail(decodeURIComponent(parts[1]), ctx);
    } else view = h("div", {}, h("p", { class: "error" }, `Nothing at ${path}.`));
  } catch (err) {
    view = h(
      "div",
      {},

      h("p", { class: "error" }, err.message ?? String(err)),
      err.href
        ? h("p", {}, external(explorerHref(err.href), "Open the failing request in HAL Explorer"))
        : undefined,
    );
  }
  if (!current()) return;
  const top = panel.scrollTop;
  panel.replaceChildren(view, foot.el);
  foot.update();
  panel.setAttribute("aria-busy", "false");
  panel.scrollTop = scroll ? (listScroll.get(`${path}${filterQuery()}`) ?? 0) : top;
  if (scroll && !["/", "/projects", "/accounts"].includes(path)) {
    mobileMap = false;
    updateLayout();
    const heading = panel.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
}

function overview(ctx) {
  resetMapFocus();
  map.setMode("projects");
  setLegend("projects");
  const projects = filteredProjects();
  const ids = new Set(projects.map((p) => p.id));
  const countries = new Set(projects.map((p) => p.country_code));
  const standards = new Set(projects.map((p) => p.standard));
  const mitigation = projects.reduce(
    (s, p) => s + (p.estimated_total_emissions_mitigation ?? 0),
    0,
  );

  const unitKpis = { active: h("span", {}, "…"), retired: h("span", {}, "…") };
  const kpis = h(
    "div",
    { class: "kpis" },
    kpi(
      "Projects",
      fmtInt(projects.length),
      anyFilter()
        ? `of ${fmtInt(state.projects.length)}`
        : `${standards.size} standards, ${countries.size} countries`,
    ),
    kpi("Estimated mitigation", fmtCompact(mitigation), "tCO2e, the projects' own estimates"),
    kpi("Active units", unitKpis.active, "tonnes, including ex-ante PIUs"),
    kpi("Retired units", unitKpis.retired, "tonnes"),
  );

  // Chart 1: projects per standard, split by stage group.
  const rows = Object.keys(STANDARDS)
    .filter((s) => standards.has(s))
    .map((s) => {
      const values = Object.fromEntries(STAGE_GROUPS.map((g) => [g.key, 0]));
      for (const p of projects) if (p.standard === s) values[groupOf(p.lifecycle_stage).key]++;
      return { key: s, label: standardName(s), values };
    });
  const stageChart = projects.length
    ? chartCard({
        title: "Projects by standard and stage",
        sub: "Select a segment to list those projects.",
        legend: legendRow(STAGE_GROUPS),
        draw: (el, width) =>
          stackedBars(el, width, {
            rows,
            segments: STAGE_GROUPS,
            describe:
              "Projects per standard, split into in development, validated or verified, and closed",
            onSelect: (standard, group) => {
              window.cdopAnalytics?.event("atlas_chart_filter");
              state.filters.standard = standard;
              state.filters.stage = `group:${group}`;
              writeForm();
              go("/projects");
              onFiltersChanged();
            },
          }),
        table: () =>
          dataTable(
            [
              { label: "Standard" },
              ...STAGE_GROUPS.map((g) => ({ label: g.label, num: true })),
              { label: "Total", num: true },
            ],
            rows.map((r) => [
              r.label,
              ...STAGE_GROUPS.map((g) => fmtInt(r.values[g.key])),
              fmtInt(Object.values(r.values).reduce((a, b) => a + b, 0)),
            ]),
          ),
      })
    : emptyResults("projects");

  // Chart 2: unit blocks by vintage year and current status (loaded after first paint).
  const unitsSlot = h("div", {}, h("p", { class: "loading" }, "Loading unit blocks…"));
  state.units.then(
    (units) => {
      if (!ctx.current()) return;
      const mine = units.filter((u) => ids.has(u.project_id));
      const totals = sumUnits(mine);
      unitKpis.active.textContent = fmtCompact(totals.active);
      unitKpis.retired.textContent = fmtCompact(totals.retired);
      const thisYear = new Date().getUTCFullYear();
      const byYear = new Map();
      let later = 0;
      let laterBlocks = 0;
      for (const u of mine) {
        const year = Number(String(u.vintage ?? "").slice(0, 4));
        if (!year) continue;
        if (year > thisYear) {
          later += u.quantity ?? 0;
          laterBlocks++;
          continue;
        }
        const values = byYear.get(year) ?? Object.fromEntries(UNIT_GROUPS.map((g) => [g.key, 0]));
        values[unitGroupOf(u.lifecycle_state).key] += u.quantity ?? 0;
        byYear.set(year, values);
      }
      const years = [...byYear.keys()].sort((a, b) => a - b);
      const columns = [];
      for (let y = years[0]; y <= years[years.length - 1]; y++)
        columns.push({ key: y, label: String(y), values: byYear.get(y) ?? {} });
      unitsSlot.replaceChildren(
        columns.length
          ? chartCard({
              title: "Units by vintage and current status",
              sub: "Every unit block of these projects, by the first year of its vintage.",
              legend: legendRow(UNIT_GROUPS),
              note: later
                ? `Not shown: ${fmtInt(later)} units in ${laterBlocks} blocks with vintages after ${thisYear}, issued ex-ante (Woodland and Peatland Code PIUs and their buffer).`
                : undefined,
              draw: (el, width) =>
                stackedColumns(el, width, {
                  columns,
                  segments: UNIT_GROUPS,
                  describe:
                    "Units per vintage year, stacked by active, retired, buffer and cancelled",
                }),
              table: () =>
                dataTable(
                  [
                    { label: "Vintage" },
                    ...UNIT_GROUPS.map((g) => ({ label: g.label, num: true })),
                    { label: "Total", num: true },
                  ],
                  columns.map((c) => [
                    c.label,
                    ...UNIT_GROUPS.map((g) => fmtInt(c.values[g.key] ?? 0)),
                    fmtInt(UNIT_GROUPS.reduce((s, g) => s + (c.values[g.key] ?? 0), 0)),
                  ]),
                ),
            })
          : h("p", { class: "empty" }, "These projects have no unit blocks yet."),
      );
      ctx.done();
    },
    (err) => {
      if (!ctx.current()) return;
      unitKpis.active.textContent = "Unavailable";
      unitKpis.retired.textContent = "Unavailable";
      unitsSlot.replaceChildren(h("p", { class: "error" }, `Units did not load: ${err.message}`));
    },
  );

  return h(
    "div",
    {},

    h(
      "p",
      { class: "sub" },
      "Explore carbon projects by standard, stage and location. Select a map marker or browse the project list to see its history, units and documents.",
    ),
    h(
      "div",
      { class: "overview-actions" },
      h("a", { class: "primary-link", href: linkTo("/projects") }, "Browse projects →"),
      h("a", { href: linkTo("/accounts") }, "Explore accounts →"),
    ),
    kpis,
    stageChart,
    unitsSlot,
  );
}

function projectList() {
  resetMapFocus();
  map.setMode("projects");
  setLegend("projects");
  const sorters = {
    name: [(a, b) => a.project_name.localeCompare(b.project_name), "Name"],
    mitigation: [
      (a, b) =>
        (b.estimated_total_emissions_mitigation ?? 0) -
        (a.estimated_total_emissions_mitigation ?? 0),
      "Estimated mitigation",
    ],
    registered: [
      (a, b) =>
        String(b.project_registration_date ?? "").localeCompare(
          String(a.project_registration_date ?? ""),
        ),
      "Most recently registered",
    ],
    modified: [
      (a, b) => String(b.modified_at).localeCompare(String(a.modified_at)),
      "Most recently changed",
    ],
  };
  const rows = filteredProjects().sort(sorters[state.sort][0]);
  const sort = h(
    "select",
    {
      "aria-label": "Sort projects",
      onchange: (e) => {
        state.sort = e.target.value;
        void render(state.path, { scroll: false });
      },
    },
    Object.entries(sorters).map(([k, [, label]]) =>
      h("option", { value: k, selected: k === state.sort }, label),
    ),
  );
  return h(
    "div",
    {},

    h(
      "div",
      { class: "list-tools" },
      h("span", {}, `${fmtInt(rows.length)} of ${fmtInt(state.projects.length)} projects`),
      sort,
    ),
    rows.length
      ? h(
          "ul",
          { class: "list" },
          rows.map((p) =>
            h(
              "li",
              {},
              h(
                "a",
                {
                  class: "row",
                  href: linkTo(`/projects/${p.id}`),
                  onmouseenter: () => map.highlight(p.id),
                  onmouseleave: () => map.highlight(undefined),
                  onfocus: () => map.highlight(p.id),
                  onblur: () => map.highlight(undefined),
                },
                h("span", { class: "name" }, p.project_name),
                h(
                  "span",
                  { class: "num" },
                  p.estimated_total_emissions_mitigation
                    ? fmtTonnes(p.estimated_total_emissions_mitigation)
                    : "",
                ),
                h(
                  "span",
                  { class: "meta" },
                  dot(groupOf(p.lifecycle_stage).color),
                  `${stageLabel(p.lifecycle_stage)} · ${standardName(p.standard)} · ${projectCountry(p)}`,
                ),
              ),
            ),
          ),
        )
      : emptyResults("projects"),
  );
}

async function projectDetail(id, tab, ctx) {
  const p = await get(
    state.projectById.get(id)?._links?.self?.href ?? resource("cdop:projects", id),
  );
  if (!ctx.current()) return;
  resetMapFocus();
  const group = groupOf(p.lifecycle_stage);
  const base = `/projects/${p.id}`;

  // Map: the site boundaries, and lines to the countries of the accounts that hold its units.
  map.setMode("projects");
  map.select(p.id);
  map.fitBbox(p.bbox);
  setLegend("projects", "Lines: countries of the accounts holding its units");
  const unitsHref = linkHref(p, "cdop:units");
  const unitsPage = get(unitsHref);
  void (async () => {
    const files = embedded(await get(linkHref(p, "cdop:geolocation-files")), "geolocation-files");
    const features = await Promise.all(files.map((f) => get(linkHref(f, "enclosure"))));
    if (!ctx.current()) return;
    map.showSites(
      features.map((f) => ({ ...f, properties: { ...f.properties, group: group.key } })),
    );
    const units = embedded(await unitsPage, "units");
    if (!ctx.current()) return;
    const byOwner = new Map();
    for (const u of units)
      byOwner.set(u.owner_account_id, (byOwner.get(u.owner_account_id) ?? 0) + (u.quantity ?? 0));
    const from = [p.centroid.lon, p.centroid.lat];
    const lines = [];
    for (const [owner, quantity] of byOwner) {
      const to = countryCentroid(state.accountById.get(owner)?.country_code);
      if (to) lines.push({ from, to, quantity });
    }
    map.showFlows(lines);
    ctx.done();
  })().catch(() => {});

  const counts = p.counts ?? {};
  const head = h(
    "header",
    { class: "detail-head" },
    h("a", { class: "back", href: linkTo("/projects") }, "← Back to projects"),
    h("h1", {}, p.project_name),
    h(
      "div",
      { class: "ids" },
      h("span", { class: "mono" }, p.project_identifier),
      h("span", {}, `Registry id ${p.current_registry_project_id}`),
    ),
    h(
      "div",
      { class: "chips" },
      stageChip(p.lifecycle_stage),
      h(
        "span",
        { class: "chip", title: "Native registry status" },
        p.registry_status?.name ?? p.registry_status?.code,
      ),
      h("span", { class: "chip" }, standardName(p.standard?.id)),
      h(
        "span",
        { class: "chip" },
        [
          p.location?.country_subdivision_name,
          countryName(p.location?.country_code, p.location?.country_name),
        ]
          .filter(Boolean)
          .join(", "),
      ),
    ),
    h(
      "div",
      { class: "links-row" },
      external(explorerHref(p._links.self.href), "Open in HAL Explorer"),
      external(local(linkHref(p, "cdop:document", "full-list")), "CDOP Full List (JSON)"),
    ),
  );
  const nav = subtabs(base, tab, [
    ["", "Overview"],
    ["history", "Status history", counts.status_records],
    ["issuances", "Issuances", counts.issuances],
    ["units", "Units", counts.unit_blocks],
    ["documents", "Documents", counts.documents],
    ["cdop", "CDOP documents"],
  ]);

  let body;
  if (tab === "history") {
    const page = await get(linkHref(p, "cdop:status-history"));
    body = section(
      "Status history",
      "Newest first. Each record carries an effective time, an actor and a sequence, which the published CDOP status record lacks (CDOP-FB-015).",
      timeline(embedded(page, "status-records"), (r) => ({
        what: `${r.project_status} · ${r.registry_status?.name ?? r.registry_status?.code}`,
        how: [
          `${stageLabel(r.lifecycle_stage)}`,
          r.action ? `${sentence(r.action)} by ${r.actor}` : undefined,
          r.project_status_reason,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    );
  } else if (tab === "issuances") {
    const issuances = embedded(await get(linkHref(p, "cdop:issuances")), "issuances").sort((a, b) =>
      String(a.date_of_issuance).localeCompare(String(b.date_of_issuance)),
    );
    const byYear = new Map();
    for (const i of issuances) {
      const y = Number(String(i.date_of_issuance ?? "").slice(0, 4));
      if (y) byYear.set(y, (byYear.get(y) ?? 0) + (i.batch_issued_volume ?? 0));
    }
    const years = [...byYear.keys()].sort((a, b) => a - b);
    const columns = [];
    if (years.length)
      for (let y = years[0]; y <= years[years.length - 1]; y++)
        columns.push({ key: y, label: String(y), values: { issued: byYear.get(y) ?? 0 } });
    const table = () =>
      dataTable(
        [
          { label: "Issued", nowrap: true },
          { label: "Batch" },
          { label: "Vintage" },
          { label: "Type" },
          { label: "Volume", num: true },
          { label: "Status" },
        ],
        issuances.map((i) => [
          fmtDate(i.date_of_issuance),
          h("span", { class: "mono" }, i.batch_identifier),
          i.vintage?.label ?? "",
          i.unit_type,
          fmtInt(i.batch_issued_volume),
          i.issuance_status,
        ]),
      );
    body = issuances.length
      ? h(
          "div",
          {},
          columns.length > 1
            ? chartCard({
                title: "Units issued per year",
                draw: (el, width) =>
                  stackedColumns(el, width, {
                    columns,
                    segments: [{ key: "issued", label: "Units issued", color: "var(--series-1)" }],
                    single: "units issued",
                    height: 150,
                    describe: "Units issued per year of issuance",
                  }),
                table,
              })
            : undefined,
          section(
            "Issuance batches",
            `${fmtInt(issuances.length)} batches, oldest first.`,
            h("div", { class: "table-wrap" }, table()),
          ),
        )
      : h("p", { class: "empty" }, "No issuances yet.");
  } else if (tab === "units") {
    const units = embedded(await unitsPage, "units");
    const groupCounts = new Map(UNIT_GROUPS.map((g) => [g.key, 0]));
    for (const u of units)
      groupCounts.set(
        unitGroupOf(u.lifecycle_state).key,
        groupCounts.get(unitGroupOf(u.lifecycle_state).key) + 1,
      );
    const shown = units.filter(
      (u) => !state.unitGroup || unitGroupOf(u.lifecycle_state).key === state.unitGroup,
    );
    const chips = h(
      "div",
      { class: "subtabs", role: "group", "aria-label": "Filter unit blocks by status" },
      [{ key: "", label: "All", color: undefined }, ...UNIT_GROUPS]
        .filter((g) => !g.key || groupCounts.get(g.key))
        .map((g) =>
          h(
            "a",
            {
              href: "#",
              "aria-current": state.unitGroup === g.key ? "page" : undefined,
              onclick: (e) => {
                e.preventDefault();
                state.unitGroup = g.key;
                void render(state.path, { scroll: false });
              },
            },
            g.color ? dot(g.color) : undefined,
            ` ${g.label} ${fmtInt(g.key ? groupCounts.get(g.key) : units.length)}`,
          ),
        ),
    );
    body = h(
      "div",
      {},
      meter({
        segments: UNIT_GROUPS,
        values: sumUnits(units),
        describe: "Units of this project by current status",
      }),
      chips,
      h(
        "div",
        { class: "table-wrap" },
        dataTable(
          [
            { label: "Block" },
            { label: "Vintage" },
            { label: "Units", num: true },
            { label: "Status" },
            { label: "Owner" },
          ],
          shown.map((u) => [
            h(
              "a",
              { href: linkTo(`/units/${u.id}`), title: u.serial_number },
              `${u.type} ${u.class === "credit" ? "" : `(${u.class})`}`,
            ),
            u.vintage_label,
            fmtInt(u.quantity),
            unitStatusChip(u),
            accountLink(u.owner_account_id),
          ]),
        ),
      ),
    );
  } else if (tab === "documents") {
    const docs = embedded(await get(linkHref(p, "cdop:documents")), "documents").sort((a, b) =>
      String(b.uploaded_at).localeCompare(String(a.uploaded_at)),
    );
    body = section(
      "Documents",
      "Newest first. The files are synthetic placeholder PDFs.",
      h(
        "div",
        { class: "table-wrap" },
        dataTable(
          [{ label: "Document" }, { label: "Dated", nowrap: true }, { label: "Size", num: true }],
          docs.map((d) => [
            h(
              "div",
              {},
              external(local(linkHref(d, "enclosure")), d.document_type ?? d.title),
              h(
                "div",
                { class: "chart-note" },
                d.version_label ? `${d.version_label} · ${d.file_name}` : d.file_name,
              ),
            ),
            fmtDate(d.document_date ?? d.uploaded_at),
            fmtBytes(d.size_bytes),
          ]),
        ),
      ),
    );
  } else if (tab === "cdop") {
    const pods = linkList(p, "cdop:document");
    const results = await Promise.all(
      pods.map(async (pod) => {
        try {
          const { status, headers } = await getHeaders(pod.href);
          return { pod, status, conformance: headers.get("x-cdop-conformance") ?? "" };
        } catch (err) {
          return { pod, status: 0, conformance: err.message };
        }
      }),
    );
    const parse = (c) =>
      Object.fromEntries(
        c
          .split(";")
          .slice(1)
          .map((kv) => kv.trim().split("="))
          .filter((kv) => kv.length === 2),
      );
    body = section(
      "CDOP documents",
      "Each pod is a schema-pure CDOP document for this project. The API validates it against the vendored CDOP v2.0 schema and reports the result in X-CDOP-Conformance, citing the schema feedback register entry behind each error.",
      h(
        "div",
        { class: "table-wrap" },
        dataTable(
          [{ label: "Pod" }, { label: "Result" }, { label: "Register entries" }],
          results.map(({ pod, status, conformance }) => {
            const valid = conformance.startsWith("valid");
            const detail = parse(conformance);
            return [
              external(local(pod.href), pod.name),
              status !== 200
                ? h("span", { class: "bad" }, `HTTP ${status}`)
                : valid
                  ? h("span", { class: "ok" }, "✓ valid")
                  : h(
                      "span",
                      { class: "bad" },
                      `✗ ${detail.errors ?? "?"} error${detail.errors === "1" ? "" : "s"}`,
                    ),
              detail.ref
                ? detail.ref
                    .split(",")
                    .map((r, i) => [
                      i ? ", " : "",
                      h("a", { href: "/rels/feedback", target: "_blank", rel: "noopener" }, r),
                    ])
                : detail.missing
                  ? `missing ${detail.missing}`
                  : "",
            ];
          }),
        ),
      ),
    );
  } else {
    const units = embedded(await unitsPage, "units");
    const summary = p._embedded?.summary ?? {};
    const holders = new Map();
    for (const u of units) {
      const code = state.accountById.get(u.owner_account_id)?.country_code ?? "";
      const row = holders.get(code) ?? { accounts: new Set(), units: 0 };
      row.accounts.add(u.owner_account_id);
      row.units += u.quantity ?? 0;
      holders.set(code, row);
    }
    const holderRows = [...holders].sort((a, b) => b[1].units - a[1].units);
    const site = [p.centroid.lon, p.centroid.lat];
    const holderPoints = holderRows.map(([code]) => countryCentroid(code)).filter(Boolean);
    body = h(
      "div",
      {},
      h(
        "div",
        { class: "kpis" },
        kpi("Area", p.area_ha != null ? `${fmtInt(p.area_ha)} ha` : "n/a"),
        kpi(
          "Estimated mitigation",
          fmtCompact(p.estimated_total_emissions_mitigation ?? 0),
          `tCO2e over ${p.estimated_total_years ?? "?"} years`,
        ),
        kpi(
          "Units issued",
          fmtCompact(summary.units_issued ?? 0),
          `${fmtInt(summary.issuance_count ?? 0)} issuances`,
        ),
        kpi("Units retired", fmtCompact(summary.units_retired ?? 0)),
      ),
      units.length
        ? section(
            "Units by current status",
            `${fmtInt(units.length)} unit blocks.`,
            meter({
              segments: UNIT_GROUPS,
              values: sumUnits(units),
              describe: "Units of this project by current status",
            }),
          )
        : undefined,
      holderRows.length
        ? section(
            "Where its units are held",
            "By the country of the holding account. Registry and buffer pool accounts have no country.",
            h(
              "div",
              { class: "links-row" },
              map.enabled
                ? h(
                    "button",
                    {
                      type: "button",
                      onclick: () =>
                        showOnMap(() => map.fitPoints([site, ...holderPoints], { maxZoom: 5 })),
                    },
                    "Show the holders on the map",
                  )
                : undefined,
              map.enabled
                ? h(
                    "button",
                    {
                      type: "button",
                      class: "ghost",
                      onclick: () => showOnMap(() => map.fitBbox(p.bbox)),
                    },
                    "Back to the site",
                  )
                : undefined,
            ),
            h(
              "div",
              { class: "table-wrap" },
              dataTable(
                [
                  { label: "Country" },
                  { label: "Accounts", num: true },
                  { label: "Units", num: true },
                ],
                holderRows.map(([code, row]) => [
                  code ? countryName(code) : "No country",
                  fmtInt(row.accounts.size),
                  fmtInt(row.units),
                ]),
              ),
            ),
          )
        : undefined,
      section(
        "Project",
        undefined,
        facts([
          [
            "Developer",
            p._links["cdop:owner-account"]
              ? h(
                  "a",
                  {
                    href: linkTo(
                      `/accounts/${p._links["cdop:owner-account"].href.split("/").pop()}`,
                    ),
                  },
                  p.project_developer_name ?? "Account",
                )
              : p.project_developer_name,
          ],
          ["Validation body", p.validation_body_name],
          ["Registry", p.registry?.name],
          ["Standard", [p.standard?.name, p.standard?.version].filter(Boolean).join(" ")],
          [
            "Methodology",
            p.methodology ? `${p.methodology.name} v${p.methodology.version}` : undefined,
          ],
          [
            "Type",
            p.mitigation?.[0]
              ? `${p.mitigation[0].project_type} (${p.mitigation[0].mitigation_type})`
              : undefined,
          ],
          ["Activity", p.activity_type],
          ["Program", p.program_type],
          [
            "Runs",
            p.project_start_date
              ? `${fmtDate(p.project_start_date)} to ${fmtDate(p.project_end_date)}`
              : undefined,
          ],
          ["Crediting period", p.crediting_period_type],
          [
            "Buffer rate",
            p.buffer_rate != null ? `${Math.round(p.buffer_rate * 100)}%` : undefined,
          ],
          ["Listed", fmtDate(p.project_list_date)],
          ["Registered", fmtDate(p.project_registration_date)],
          ["Validated", fmtDate(p.validated_on)],
          ["First verified", fmtDate(p.first_verified_on)],
          ["Next milestone", summary.next_milestone],
        ]),
      ),
      p.project_description
        ? section("Description", undefined, h("p", {}, p.project_description))
        : undefined,
    );
  }
  return h("div", {}, head, nav, body);
}

async function unitDetail(id, ctx) {
  const u = await get(resource("cdop:units", id));
  const project = state.projectById.get(u.project_id);
  const history = embedded(await get(linkHref(u, "cdop:status-history")), "status-records");
  if (!ctx.current()) return;

  map.setMode("projects");
  map.select(u.project_id);
  map.showSites([]);
  setLegend("projects", "Line: from the project to the owner's country");
  const from = project?.centroid ? [project.centroid.lon, project.centroid.lat] : undefined;
  const to = countryCentroid(state.accountById.get(u.owner_account_id)?.country_code);
  map.showFlows(from && to ? [{ from, to, quantity: 1 }] : []);
  map.fitPoints([from, to].filter(Boolean), { maxZoom: 6 });

  const g = unitGroupOf(u.lifecycle_state);
  const qty = u.credit_block?.quantity ?? 0;
  ctx.done();
  return h(
    "div",
    {},

    h(
      "header",
      { class: "detail-head" },
      h(
        "a",
        { class: "back", href: linkTo(`/projects/${u.project_id}/units`) },
        `← ${project?.project_name ?? "Project"}`,
      ),
      h(
        "h1",
        {},
        `${fmtInt(qty)} ${u.descriptor?.type ?? ""} units, vintage ${u.vintage_period?.label ?? u.vintage}`,
      ),
      h("div", { class: "ids" }, h("span", { class: "mono" }, u.reference?.serial_number)),
      h(
        "div",
        { class: "chips" },
        h("span", { class: "chip" }, dot(g.color), u.status?.status ?? g.label),
        u.descriptor?.class
          ? h("span", { class: "chip" }, `Class ${u.descriptor.class}`)
          : undefined,
        u.registry_status?.name
          ? h("span", { class: "chip", title: "Native registry status" }, u.registry_status.name)
          : undefined,
        u.cadt_status
          ? h(
              "span",
              { class: "chip", title: "Climate Action Data Trust status" },
              `CADT ${u.cadt_status}`,
            )
          : undefined,
      ),
      h(
        "div",
        { class: "links-row" },
        external(explorerHref(u._links.self.href), "Open in HAL Explorer"),
        external(
          local(linkHref(u, "cdop:document", "unit-description") ?? linkHref(u, "cdop:document")),
          "CDOP Unit Description (JSON)",
        ),
      ),
    ),
    section(
      "Block",
      undefined,
      facts([
        ["Project", projectLink(u.project_id)],
        [
          "Issuance batch",
          u.batch_identifier ? h("span", { class: "mono" }, u.batch_identifier) : undefined,
        ],
        [
          "Vintage",
          u.vintage_period
            ? `${fmtDate(u.vintage_period.start)} to ${fmtDate(u.vintage_period.end)}`
            : u.vintage,
        ],
        [
          "Serials",
          u.credit_block
            ? `${fmtInt(u.credit_block.block_start)} to ${fmtInt(u.credit_block.block_end)}`
            : undefined,
        ],
        ["Owner", accountLink(u.owner_account_id)],
        [
          "Split from",
          u.reference?.source_serial_number
            ? h("span", { class: "mono" }, u.reference.source_serial_number)
            : undefined,
        ],
        ["Labels", (u.labels ?? []).map((l) => l.name ?? l).join(", ")],
        ["Last change", fmtStamp(u.modified_at)],
      ]),
    ),
    section(
      "Status history",
      "Newest first. Transfers move a block between accounts; splits create a new block from part of another.",
      timeline(history, (r) => ({
        what: `${sentence(r.action)} · ${r.status}`,
        how: [
          r.from_owner_account_id &&
          r.to_owner_account_id &&
          r.from_owner_account_id !== r.to_owner_account_id
            ? `${state.accountById.get(r.from_owner_account_id)?.name ?? r.from_owner_account_id} to ${state.accountById.get(r.to_owner_account_id)?.name ?? r.to_owner_account_id}`
            : undefined,
          r.quantity ? `${fmtInt(r.quantity)} units` : undefined,
          r.actor ? `by ${r.actor}` : undefined,
          r.status_reason,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    ),
  );
}

function accountList() {
  resetMapFocus();
  map.setMode("accounts");
  setLegend("accounts");
  const accounts = filteredAccounts();
  const typeCounts = new Map();
  for (const a of accounts)
    typeCounts.set(a.account_type, (typeCounts.get(a.account_type) ?? 0) + 1);
  const shown = accounts
    .filter((a) => !state.accountType || a.account_type === state.accountType)
    .sort((a, b) => a.name.localeCompare(b.name));
  const chips = h(
    "div",
    { class: "subtabs", role: "group", "aria-label": "Filter accounts by type" },
    [
      ["", "All", accounts.length],
      ...Object.keys(ACCOUNT_TYPES)
        .filter((t) => typeCounts.get(t))
        .map((t) => [t, accountTypeName(t), typeCounts.get(t)]),
    ].map(([t, label, n]) =>
      h(
        "a",
        {
          href: "#",
          "aria-current": state.accountType === t ? "page" : undefined,
          onclick: (e) => {
            e.preventDefault();
            state.accountType = t;
            onFiltersChanged();
          },
        },
        `${label} ${fmtInt(n)}`,
      ),
    ),
  );
  map.setAccounts(
    accountFeatures(
      accounts.filter((a) => !state.accountType || a.account_type === state.accountType),
    ),
  );
  return h(
    "div",
    {},

    h(
      "p",
      { class: "sub" },
      "Registry accounts hold, transfer and retire units. Account holders are invented, like everything else in the dataset.",
    ),
    chips,
    h("div", { class: "list-tools" }, h("span", {}, `${fmtInt(shown.length)} accounts`)),
    shown.length
      ? h(
          "ul",
          { class: "list" },
          shown.map((a) =>
            h(
              "li",
              {},
              h(
                "a",
                { class: "row", href: linkTo(`/accounts/${a.id}`) },
                h("span", { class: "name" }, a.name),
                h("span", { class: "num" }, a.country_code ? countryName(a.country_code) : ""),
                h(
                  "span",
                  { class: "meta" },
                  `${accountTypeName(a.account_type)} · ${registryName(a.registry)}`,
                ),
              ),
            ),
          ),
        )
      : emptyResults("accounts"),
  );
}

async function accountDetail(id, ctx) {
  const a = await get(
    state.accountById.get(id)?._links?.self?.href ?? resource("cdop:accounts", id),
  );
  const [held, developed] = await Promise.all([
    collect(withQuery(linkHref(a, "cdop:units"), { limit: 250 }), "units"),
    a.account_type === "project_developer" || a.account_type === "project_proponent"
      ? get(withQuery(linkHref(a, "cdop:projects"), { limit: 100 }))
      : Promise.resolve(undefined),
  ]);
  if (!ctx.current()) return;
  const developedProjects = embedded(developed, "projects");

  // Holdings by project.
  const byProject = new Map();
  for (const u of held.items) {
    const row =
      byProject.get(u.project_id) ?? Object.fromEntries(UNIT_GROUPS.map((g) => [g.key, 0]));
    row[unitGroupOf(u.lifecycle_state).key] += u.quantity ?? 0;
    byProject.set(u.project_id, row);
  }
  const holdingsRows = [...byProject].sort((x, y) => sumOf(y[1]) - sumOf(x[1]));

  // Map: this account's country, and lines to the projects it holds units of or develops.
  const home = countryCentroid(a.country_code);
  map.setMode("accounts");
  map.select(undefined);
  map.showSites([]);
  map.setAccounts(home ? accountFeatures([a]) : []);
  setLegend("accounts", "Lines: projects whose units it holds or that it develops");
  const ends = [];
  const lines = [];
  for (const [pid, values] of byProject) {
    const p = state.projectById.get(pid);
    if (!p?.centroid) continue;
    const to = [p.centroid.lon, p.centroid.lat];
    ends.push(to);
    if (home) lines.push({ from: home, to, quantity: sumOf(values) });
  }
  for (const p of developedProjects) {
    if (!p.centroid || byProject.has(p.id)) continue;
    const to = [p.centroid.lon, p.centroid.lat];
    ends.push(to);
    if (home) lines.push({ from: home, to, quantity: 1 });
  }
  map.showFlows(lines);
  map.fitPoints([home, ...ends].filter(Boolean), { maxZoom: 6 });

  const totals = Object.fromEntries(UNIT_GROUPS.map((g) => [g.key, 0]));
  for (const hld of a.holdings ?? []) totals[unitGroupOf(hld.state).key] += hld.quantity ?? 0;
  ctx.done();
  return h(
    "div",
    {},

    h(
      "header",
      { class: "detail-head" },
      h("a", { class: "back", href: linkTo("/accounts") }, "← Back to accounts"),
      h("h1", {}, a.name),
      h(
        "div",
        { class: "ids" },
        h("span", { class: "mono" }, a.id),
        a.native_account_id ? h("span", {}, `Registry account ${a.native_account_id}`) : undefined,
      ),
      h(
        "div",
        { class: "chips" },
        h("span", { class: "chip" }, accountTypeName(a.account_type)),
        h("span", { class: "chip" }, registryName(a.registry)),
        a.country_code ? h("span", { class: "chip" }, countryName(a.country_code)) : undefined,
        h("span", { class: "chip" }, sentence(a.status)),
      ),
      h(
        "div",
        { class: "links-row" },
        external(explorerHref(a._links.self.href), "Open in HAL Explorer"),
      ),
    ),
    facts([
      ["Organisation", a.organisation_name],
      ["Opened", fmtDate(a.opened_on)],
      ["Holdings public", a.holdings_public ? "Yes" : "No"],
      ["Retirements public", a.retirements_public ? "Yes" : "No"],
      ["Parent account", a.parent_account_id ? accountLink(a.parent_account_id) : undefined],
    ]),
    sumOf(totals)
      ? section(
          "Units held",
          "Current balance by status, across every project.",
          meter({
            segments: UNIT_GROUPS,
            values: totals,
            describe: "Units held by this account, by status",
          }),
        )
      : undefined,
    holdingsRows.length
      ? section(
          "By project",
          `${fmtInt(held.items.length)} unit blocks from ${fmtInt(holdingsRows.length)} project${holdingsRows.length === 1 ? "" : "s"}.`,
          h(
            "div",
            { class: "table-wrap" },
            dataTable(
              [{ label: "Project" }, ...UNIT_GROUPS.map((g) => ({ label: g.label, num: true }))],
              holdingsRows.map(([pid, values]) => [
                projectLink(pid),
                ...UNIT_GROUPS.map((g) => (values[g.key] ? fmtInt(values[g.key]) : "")),
              ]),
            ),
          ),
        )
      : h("p", { class: "empty" }, "This account holds no units."),
    developedProjects.length
      ? section(
          "Projects developed",
          undefined,
          h(
            "ul",
            { class: "list" },
            developedProjects.map((p) =>
              h(
                "li",
                {},
                h(
                  "a",
                  { class: "row", href: linkTo(`/projects/${p.id}`) },
                  h("span", { class: "name" }, p.project_name),
                  h("span", { class: "num" }, fmtTonnes(p.estimated_total_emissions_mitigation)),
                  h(
                    "span",
                    { class: "meta" },
                    dot(groupOf(p.lifecycle_stage).color),
                    `${stageLabel(p.lifecycle_stage)} · ${standardName(p.standard)}`,
                  ),
                ),
              ),
            ),
          ),
        )
      : undefined,
  );
}
function sumOf(values) {
  return Object.values(values).reduce((s, v) => s + v, 0);
}

// Boot -------------------------------------------------------------------------------------------

async function boot() {
  map = createMap(document.getElementById("map"), {
    legend: legendEl,
    onProject: (id) => {
      window.cdopAnalytics?.event("atlas_map_project");
      mobileMap = false;
      updateLayout();
      go(`/projects/${id}`);
    },
    onCountry: (code) => {
      window.cdopAnalytics?.event("atlas_map_country");
      mobileMap = false;
      updateLayout();
      state.filters.country = code;
      writeForm();
      go("/accounts");
      onFiltersChanged({ fit: false });
    },
  });
  toggleMap.hidden = !map.enabled;
  updateLayout();
  for (const control of form.elements) control.disabled = true;
  state.boot = startTrace();
  try {
    state.root = await get("/v2");
    const [projects, accounts] = await Promise.all([
      collect(
        withQuery(linkHref(state.root, "cdop:projects"), { limit: 100, sort: "name" }),
        "projects",
        state.boot,
      ),
      collect(
        withQuery(linkHref(state.root, "cdop:accounts"), { limit: 100 }),
        "accounts",
        state.boot,
      ),
    ]);
    state.projects = projects.items;
    state.accounts = accounts.items;
  } catch (err) {
    document.getElementById("result-count").textContent = "Data could not be loaded";
    panel.setAttribute("aria-busy", "false");
    panel.replaceChildren(
      h("p", { class: "error" }, `The API did not answer: ${err.message}`),
      h("button", { type: "button", onclick: () => location.reload() }, "Try again"),
    );
    return;
  }
  for (const p of state.projects) {
    state.projectById.set(p.id, p);
    if (!state.registryOfStandard.has(p.standard))
      state.registryOfStandard.set(p.standard, p.registry);
  }
  for (const a of state.accounts) state.accountById.set(a.id, a);
  state.maxMitigation = Math.max(
    1,
    ...state.projects.map((p) => p.estimated_total_emissions_mitigation ?? 0),
  );
  state.units = collect(
    withQuery(linkHref(state.root, "cdop:units"), { limit: 250 }),
    "units",
    state.boot,
  ).then((r) => r.items);
  // Views attach their own error display; avoid an unhandled rejection on list routes.
  state.units.catch(() => {});

  for (const control of form.elements) control.disabled = false;
  fillFilterOptions();
  const { params } = parseHash();
  for (const k of FILTERS) state.filters[k] = params.get(k) ?? "";
  writeForm();
  updateMapData();
  window.addEventListener("hashchange", route);
  route();
}

void boot();
