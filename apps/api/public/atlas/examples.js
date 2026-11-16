const root = document.getElementById("example");
let generation = 0;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  for (const child of children.flat(Infinity)) {
    if (child !== undefined && child !== null)
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
const link = (href, text) => el("a", { href }, text);
const paragraph = (text, className = "") => el("p", { class: className }, text);
const titleCase = (value) => value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
async function get(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`The example service returned HTTP ${response.status}.`);
  return { data: await response.json(), version: response.headers.get("x-cdop-schema-version") };
}
function facts(rows) {
  return el(
    "dl",
    {},
    rows.map(([label, value]) => [el("dt", {}, label), el("dd", {}, value)]),
  );
}

async function transfer() {
  const { data } = await get("/v2/proposals/0.1.0/examples/registry-transfer");
  const before = data.before.project;
  const after = data.after.project;
  const sameId = before.project_id === after.project_id;
  const card = (label, project) =>
    el(
      "section",
      { class: "card" },
      paragraph(label, "step"),
      el(
        "h2",
        {},
        project.registry.registry_id === "verra"
          ? "Verra registry"
          : "Example destination registry",
      ),
      facts([
        ["Registry project reference", project.registry.registry_project_id],
        ["Project name", project.project_name],
        ["Lifecycle stage", titleCase(project.lifecycle_stage)],
        ["On hold", project.is_on_hold ? "Yes" : "No"],
      ]),
    );
  return [
    el("span", { class: "badge" }, "Rethink proposal 0.1.0 · hypothetical example"),
    el("h1", {}, "A new registry. The same project."),
    paragraph(
      "Follow one project as its registry and local reference change. The proposed global project ID stays with it, so other records can still identify the same project.",
      "intro",
    ),
    el(
      "div",
      { class: "notice" },
      paragraph(
        "This is an illustration of identity handling, not a claim that these registries or standards permit this transfer. The destination registry is fictional.",
      ),
    ),
    el(
      "section",
      { class: "shared" },
      el(
        "h2",
        {},
        sameId ? "The global project ID stays the same" : "The project IDs do not match",
      ),
      paragraph(before.project_id, "identifier"),
      sameId
        ? paragraph("This exact ID is present before and after the transfer.")
        : paragraph(after.project_id, "identifier"),
    ),
    el(
      "div",
      { class: "grid" },
      card("1 · Before transfer", before),
      card("2 · After transfer", after),
    ),
    el(
      "section",
      { class: "card" },
      el("h2", {}, "What changes, and what stays?"),
      paragraph(
        "The registry and its local project reference change. In this example the project name, lifecycle, hold status and existing history are preserved. Importers carry the assigned global ID forward rather than create a new one from the destination registry details.",
      ),
      el(
        "div",
        { class: "checks" },
        el(
          "span",
          {},
          data.validation.before.valid
            ? "Before: proposal checks pass"
            : "Before: proposal checks fail",
        ),
        el(
          "span",
          {},
          data.validation.after.valid
            ? "After: proposal checks pass"
            : "After: proposal checks fail",
        ),
      ),
    ),
    el(
      "section",
      { class: "question" },
      el("h2", {}, "For the group to agree"),
      paragraph(
        "Who assigns the global ID, how imports preserve it, and how we recognise duplicate identities issued by different systems.",
      ),
    ),
    el(
      "div",
      { class: "links" },
      link("#additionality", "Next: Additionality example"),
      link("/docs/guides/twg-proposal", "Proposal explanation"),
    ),
  ];
}

const GROUPS = [
  [
    "general_",
    "Approach and prior consideration",
    "Which tests are used, and when carbon finance was considered.",
  ],
  [
    "financial_additionality_",
    "Financial case",
    "Costs, income, alternative investments and dependence on carbon revenue.",
  ],
  [
    "barriers_",
    "Barriers to going ahead",
    "What prevents the project happening and how those barriers could be overcome.",
  ],
  [
    "common_practice_",
    "Common practice",
    "Whether similar activities already happen without carbon finance.",
  ],
  [
    "counterfactual_scenario_",
    "What happens without the project?",
    "Alternative scenarios and the baseline used for comparison.",
  ],
  [
    "regulatory_additionality_",
    "Legal requirements",
    "Whether the activity goes beyond what the law already requires.",
  ],
  [
    "performance_additionality_",
    "Performance benchmarks",
    "The performance measures and thresholds considered in the example.",
  ],
  [
    "lockin_risk_",
    "Long-term lock-in risk",
    "Scale, technology and compatibility with long-term climate plans.",
  ],
];
const LABELS = {
  financial_additionality_financial_indicator: "Financial indicator",
  financial_additionality_financial_benchmark_calculations: "Benchmark calculations",
  financial_additionality_financial_benchmark_results: "Benchmark results",
  financial_additionality_financial_benchmark_approach: "Benchmark approach used?",
  financial_additionality_low_capex_relative_to_opex:
    "Upfront costs low compared with operating costs?",
  common_practice_common_practice_documentation: "Supporting documents",
  common_practice_common_practice_test_details: "How the test was applied",
  common_practice_passes_common_practice_test: "Claims to pass the common-practice test?",
  counterfactual_scenario_counterfactual_scenario_results: "Baseline results",
  counterfactual_scenario_counterfactual_scenario_documentation: "Baseline evidence",
  counterfactual_scenario_counterfactual_scenarios: "Scenarios considered",
  regulatory_additionality_legal_regulatory_additionality_documentation: "Legal evidence",
  regulatory_additionality_regulatory_additionality_determination_method:
    "How legal additionality was assessed",
  regulatory_additionality_regulatory_surplus_justification:
    "Why the project goes beyond legal requirements",
  lockin_risk_country_ltleds_compatibility: "Fit with the country's long-term climate strategy",
  performance_additionality_performance_based_additionality_results: "Performance test results",
  performance_additionality_performance_based_additionality_evidence: "Performance evidence",
};
async function additionality() {
  const [example, schema] = await Promise.all([
    get("/v2/drafts/additionality/example"),
    get("/v2/schemas/Additionality.schema.json"),
  ]);
  const values = example.data.additionality;
  const properties = schema.data.properties.additionality.properties;
  const privateCount = Object.keys(values).filter(
    (key) => properties[key]?.["x-cdop-public-private"] === "Private",
  ).length;
  const sections = GROUPS.map(([prefix, title, explanation], index) => {
    const rows = Object.entries(values).filter(([key]) => key.startsWith(prefix));
    const section = el(
      "details",
      { id: `group-${index}`, ...(index === 0 ? { open: "" } : {}) },
      el("summary", {}, title, el("small", {}, `${rows.length} fields`)),
      paragraph(explanation, "description"),
      rows.map(([key, value]) =>
        el(
          "article",
          { class: "field", "data-field": key },
          el(
            "h3",
            {},
            LABELS[key] ?? titleCase(key.slice(prefix.length)),
            properties[key]?.["x-cdop-public-private"] === "Private"
              ? el("span", { class: "badge" }, "Private field · synthetic value")
              : undefined,
          ),
          paragraph(
            typeof value === "boolean"
              ? `${value ? "Yes" : "No"} (as stated in the example)`
              : String(value),
          ),
          paragraph(properties[key]?.description ?? "", "description"),
        ),
      ),
    );
    return section;
  });
  const jump = el("nav", { class: "jump", "aria-label": "Additionality sections" });
  sections.forEach((section, index) => {
    const anchor = link(`#group-${index}`, GROUPS[index][1]);
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      section.open = true;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.querySelector("summary").focus({ preventScroll: true });
    });
    jump.append(anchor);
  });
  const toggle = el("button", { type: "button", "aria-expanded": "false" }, "Expand all sections");
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    sections.forEach((section) => {
      section.open = open;
    });
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Collapse all sections" : "Expand all sections";
  });
  return [
    el("span", { class: "badge" }, "CDOP Additionality draft · hypothetical example"),
    el("h1", {}, "Would this happen without carbon finance?"),
    paragraph(
      "Explore the information supplied in the upstream worked example, organised by the question each test is trying to answer. The values below are taken directly from that example.",
      "intro",
    ),
    el(
      "div",
      { class: "notice" },
      el("h2", {}, "Example claims, not an assessment"),
      paragraph(
        "This is synthetic data, including the financial figures and evidence references. Matching the schema does not establish that a project is additional or that its claims are supported.",
      ),
    ),
    el(
      "div",
      { class: "grid" },
      el(
        "section",
        { class: "card" },
        el("h2", {}, "The example"),
        facts([
          ["Project reference", values.additionality_project_id],
          ["Fields supplied", Object.keys(values).length],
          ["Fields marked private", `${privateCount} (hypothetical values shown here)`],
        ]),
      ),
      el(
        "section",
        { class: "card" },
        el("h2", {}, "How it fits the draft"),
        paragraph(
          "The example uses the unchanged CDOP draft. Only the project reference is mandatory; the other tests are optional. Our demo project exports include known facts only and omit private financial fields.",
        ),
        paragraph(`Draft version: ${example.version}`, "description"),
      ),
    ),
    el(
      "section",
      { class: "question" },
      el("h2", {}, "Still to resolve"),
      paragraph(
        "Field IDs overlap with other CDOP schemas. A document can also pass validation without evidence for its claims. The group still needs to agree evidence requirements and how assessments are recorded.",
      ),
    ),
    jump,
    toggle,
    ...sections,
    el(
      "div",
      { class: "links" },
      link("/docs/guides/additionality-review", "Read the full review"),
      link("#registry-transfer", "Registry-transfer example"),
    ),
  ];
}

async function render() {
  const id = ++generation;
  const name = location.hash === "#additionality" ? "additionality" : "registry-transfer";
  document.title = `${name === "additionality" ? "Additionality" : "Registry transfer"} example | CDOP`;
  for (const anchor of document.querySelectorAll("header nav a")) {
    if (anchor.getAttribute("href") === `#${name}`) anchor.setAttribute("aria-current", "page");
    else anchor.removeAttribute("aria-current");
  }
  root.replaceChildren(paragraph("Loading example…"));
  try {
    const content = await (name === "additionality" ? additionality() : transfer());
    if (id !== generation) return;
    root.replaceChildren(...content);
    window.scrollTo(0, 0);
  } catch (error) {
    if (id !== generation) return;
    const retry = el("button", { type: "button" }, "Try again");
    retry.addEventListener("click", () => {
      void render();
    });
    root.replaceChildren(
      el("h1", {}, "Could not load this example"),
      paragraph(error.message),
      retry,
      paragraph("The example needs a connection to the API. Please try again."),
    );
  }
}
window.addEventListener("hashchange", () => {
  void render();
});
void render();
