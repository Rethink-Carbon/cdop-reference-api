// Hand-built SVG charts. Marks: bars at most 24px thick, a 2px surface gap between stacked
// segments, a 4px rounded data end and a square baseline, hairline solid grid. Every chart has a
// legend when it has more than one series, a hover and focus tooltip, and a table view.

const NS = "http://www.w3.org/2000/svg";
const intFmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmtInt = (n) => intFmt.format(n);
export const fmtCompact = (n) => compactFmt.format(n);

function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, String(v));
  if (parent) parent.appendChild(el);
  return el;
}

function html(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat(Infinity))
    if (c !== undefined && c !== null && c !== false) el.append(c);
  return el;
}

/** A swatch, dot or line key in a series colour (identity rides the mark, never the text). */
export function key(color, shape = "swatch") {
  return html("span", { class: shape, style: { background: color }, "aria-hidden": "true" });
}

// One tooltip for the page. Values lead, labels follow; built with textContent only.
const tip = () => document.getElementById("tooltip");
export function showTip(anchor, title, rows) {
  const el = tip();
  if (!el) return;
  el.replaceChildren(
    html("div", { class: "tt-title" }, title),
    ...rows.map((r) =>
      html(
        "div",
        { class: "tt-row" },
        r.color ? html("span", { class: "key", style: { background: r.color } }) : undefined,
        html("strong", {}, r.value),
        html("span", {}, r.label),
      ),
    ),
  );
  el.hidden = false;
  const { x, y } =
    "clientX" in anchor
      ? { x: anchor.clientX, y: anchor.clientY }
      : (() => {
          const r = anchor.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top };
        })();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x + 12))}px`;
  el.style.top = `${Math.max(8, y - h - 12 < 8 ? y + 16 : y - h - 12)}px`;
}
export function hideTip() {
  const el = tip();
  if (el) el.hidden = true;
}

function niceStep(max, count = 4) {
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

// Bar with a square baseline and a rounded data end.
function hBar(x, y, w, h, rounded) {
  const r = rounded ? Math.min(4, w, h / 2) : 0;
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
}
function vBar(x, y, w, h, rounded) {
  const r = rounded ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
}

let measureCtx;
function textWidth(s) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  measureCtx.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
  return measureCtx.measureText(s).width;
}

function interactive(g, { label, onEnter, onLeave, onClick }) {
  g.setAttribute("tabindex", "0");
  g.setAttribute("role", onClick ? "button" : "img");
  g.setAttribute("aria-label", label);
  g.addEventListener("pointermove", (e) => {
    g.classList.add("hot");
    onEnter(e);
  });
  g.addEventListener("pointerleave", () => {
    g.classList.remove("hot");
    onLeave?.();
    hideTip();
  });
  g.addEventListener("focus", () => onEnter(g));
  g.addEventListener("blur", hideTip);
  if (onClick) {
    g.style.cursor = "pointer";
    g.addEventListener("click", onClick);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    });
  }
}

/**
 * A chart card: title, one-line subtitle, a Chart/Table toggle, the chart, its legend and a note.
 * `draw(el, width)` renders the chart; it runs again when the card is resized.
 */
export function chartCard({ title, sub, legend, note, draw, table }) {
  const body = html("div", { class: "chart" });
  const tableWrap = html("div", { class: "table-wrap", hidden: true });
  const toggle = html(
    "button",
    { type: "button", class: "ghost", "aria-pressed": "false" },
    "Table",
  );
  toggle.addEventListener("click", () => {
    const showTable = tableWrap.hidden;
    tableWrap.hidden = !showTable;
    body.hidden = showTable;
    toggle.textContent = showTable ? "Chart" : "Table";
    toggle.setAttribute("aria-pressed", String(showTable));
    if (showTable && !tableWrap.firstChild) tableWrap.append(table());
  });
  const card = html(
    "div",
    { class: "chart-card" },
    html("div", { class: "chart-head" }, html("h2", {}, title), table ? toggle : undefined),
    sub ? html("p", { class: "sub chart-note" }, sub) : undefined,
    legend,
    body,
    tableWrap,
    note ? html("p", { class: "chart-note" }, note) : undefined,
  );
  let lastWidth = 0;
  const ro = new ResizeObserver(() => {
    const w = Math.floor(body.clientWidth);
    if (w && w !== lastWidth) {
      lastWidth = w;
      body.replaceChildren();
      draw(body, w);
    }
  });
  ro.observe(body);
  return card;
}

export function legendRow(segments, values, format = fmtInt) {
  return html(
    "div",
    { class: "legend" },
    segments.map((s) =>
      html(
        "span",
        {},
        key(s.color),
        s.label,
        values ? html("span", { class: "value" }, format(values[s.key] ?? 0)) : undefined,
      ),
    ),
  );
}

export function dataTable(headers, rows) {
  return html(
    "table",
    {},
    html(
      "thead",
      {},
      html(
        "tr",
        {},
        headers.map((h) => html("th", { class: h.num ? "num" : undefined }, h.label)),
      ),
    ),
    html(
      "tbody",
      {},
      rows.map((r) =>
        html(
          "tr",
          {},
          r.map((cell, i) =>
            html(
              "td",
              {
                class:
                  [headers[i]?.num && "num", headers[i]?.nowrap && "nowrap"]
                    .filter(Boolean)
                    .join(" ") || undefined,
              },
              cell,
            ),
          ),
        ),
      ),
    ),
  );
}

/**
 * Horizontal stacked bars, one row per category. rows: [{key, label, values: {segment: n}}];
 * segments: [{key, label, color}] in stacking order.
 */
export function stackedBars(el, width, { rows, segments, format = fmtInt, onSelect, describe }) {
  const barH = 18;
  const gap = 12;
  const labelW = Math.min(140, Math.ceil(Math.max(0, ...rows.map((r) => textWidth(r.label)))) + 10);
  const totals = rows.map((r) => segments.reduce((s, seg) => s + (r.values[seg.key] ?? 0), 0));
  const totalW = Math.ceil(Math.max(0, ...totals.map((t) => textWidth(format(t))))) + 10;
  const plotW = Math.max(40, width - labelW - totalW);
  const max = Math.max(1, ...totals);
  const height = rows.length * (barH + gap) - gap + 2;
  const root = svg(
    "svg",
    { viewBox: `0 0 ${width} ${height}`, height, role: "group", "aria-label": describe },
    el,
  );
  rows.forEach((row, i) => {
    const y = i * (barH + gap) + 1;
    svg(
      "text",
      { x: labelW - 8, y: y + barH / 2, "text-anchor": "end", "dominant-baseline": "central" },
      root,
    ).textContent = row.label;
    const present = segments.filter((s) => (row.values[s.key] ?? 0) > 0);
    let x = labelW;
    present.forEach((seg, j) => {
      const v = row.values[seg.key];
      const w = (v / max) * plotW;
      const last = j === present.length - 1;
      const drawW = Math.max(1, last ? w : w - 2);
      const g = svg("g", {}, root);
      const mark = svg("path", { class: "mark", d: hBar(x, y, drawW, barH, last) }, g);
      mark.style.fill = seg.color;
      svg(
        "rect",
        { class: "hit", x, y: y - gap / 2, width: Math.max(w, 6), height: barH + gap },
        g,
      );
      svg(
        "rect",
        { class: "focus-ring", x: x - 1, y: y - 1, width: drawW + 2, height: barH + 2, rx: 3 },
        g,
      );
      const tipRows = present.map((s) => ({
        color: s.color,
        value: format(row.values[s.key]),
        label: s.key === seg.key ? `${s.label} (this segment)` : s.label,
      }));
      interactive(g, {
        label: `${row.label}, ${seg.label}: ${format(v)}`,
        onEnter: (anchor) => showTip(anchor, row.label, tipRows),
        onClick: onSelect ? () => onSelect(row.key, seg.key) : undefined,
      });
      x += w;
    });
    svg("text", { x: x + 6, y: y + barH / 2, "dominant-baseline": "central" }, root).textContent =
      format(totals[i]);
  });
  svg("line", { class: "baseline", x1: labelW, x2: labelW, y1: 0, y2: height }, root);
}

/**
 * Vertical stacked columns over an ordered x (years). columns: [{key, label, values}].
 * One tooltip per column lists every segment.
 */
export function stackedColumns(
  el,
  width,
  { columns, segments, format = fmtInt, height = 190, describe, single },
) {
  const left = 44;
  const bottom = 20;
  const top = 6;
  const plotW = Math.max(40, width - left - 4);
  const plotH = height - top - bottom;
  const totals = columns.map((c) => segments.reduce((s, seg) => s + (c.values[seg.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const step = niceStep(max);
  const yMax = Math.ceil(max / step) * step;
  const yOf = (v) => top + plotH - (v / yMax) * plotH;
  const root = svg(
    "svg",
    { viewBox: `0 0 ${width} ${height}`, height, role: "group", "aria-label": describe },
    el,
  );
  for (let v = 0; v <= yMax + step / 2; v += step) {
    const y = yOf(v);
    svg("line", { class: v === 0 ? "baseline" : "grid", x1: left, x2: width, y1: y, y2: y }, root);
    svg(
      "text",
      { class: "tick", x: left - 6, y, "text-anchor": "end", "dominant-baseline": "central" },
      root,
    ).textContent = fmtCompact(v);
  }
  const band = plotW / Math.max(1, columns.length);
  const barW = Math.max(2, Math.min(24, band * 0.72));
  const every = Math.max(1, Math.ceil(columns.length / Math.max(1, Math.floor(plotW / 40))));
  columns.forEach((col, i) => {
    const cx = left + i * band + band / 2;
    const x = cx - barW / 2;
    const g = svg("g", {}, root);
    const present = segments.filter((s) => (col.values[s.key] ?? 0) > 0);
    let acc = 0;
    present.forEach((seg, j) => {
      const v = col.values[seg.key];
      const y0 = yOf(acc);
      const y1 = yOf(acc + v);
      const last = j === present.length - 1;
      const h = Math.max(1, last ? y0 - y1 : y0 - y1 - 2);
      const mark = svg("path", { class: "mark", d: vBar(x, y0 - h, barW, h, last) }, g);
      mark.style.fill = seg.color;
      acc += v;
    });
    svg("rect", { class: "hit", x: left + i * band, y: top, width: band, height: plotH }, g);
    svg(
      "rect",
      {
        class: "focus-ring",
        x: x - 2,
        y: yOf(totals[i]) - 2,
        width: barW + 4,
        height: yOf(0) - yOf(totals[i]) + 4,
        rx: 3,
      },
      g,
    );
    const rows = single
      ? [{ value: format(totals[i]), label: single }]
      : [
          ...present
            .map((s) => ({ color: s.color, value: format(col.values[s.key]), label: s.label }))
            .reverse(),
          ...(present.length > 1 ? [{ value: format(totals[i]), label: "total" }] : []),
        ];
    interactive(g, {
      label: `${col.label}: ${single ? format(totals[i]) : present.map((s) => `${s.label} ${format(col.values[s.key])}`).join(", ") || "none"}`,
      onEnter: (anchor) => showTip(anchor, col.label, rows),
    });
    if (i % every === 0 || i === columns.length - 1) {
      if (i === columns.length - 1 && i % every !== 0 && (i % every) * band < 30) return;
      svg(
        "text",
        { class: "tick", x: cx, y: height - 4, "text-anchor": "middle" },
        root,
      ).textContent = col.label;
    }
  });
}

/** A single 100% stacked bar (part to whole), with a legend that carries the values. */
export function meter({ segments, values, format = fmtInt, describe }) {
  const total = segments.reduce((s, seg) => s + (values[seg.key] ?? 0), 0);
  const body = html("div", { class: "chart" });
  const wrap = html(
    "div",
    { class: "chart-card" },
    body,
    html(
      "div",
      { class: "legend" },
      segments
        .filter((s) => values[s.key])
        .map((s) =>
          html(
            "span",
            {},
            key(s.color),
            s.label,
            html("span", { class: "value" }, format(values[s.key] ?? 0)),
            total
              ? html("span", {}, `(${Math.round(((values[s.key] ?? 0) / total) * 100)}%)`)
              : undefined,
          ),
        ),
    ),
  );
  let lastWidth = 0;
  new ResizeObserver(() => {
    const width = Math.floor(body.clientWidth);
    if (!width || width === lastWidth) return;
    lastWidth = width;
    body.replaceChildren();
    const h = 14;
    const root = svg(
      "svg",
      { viewBox: `0 0 ${width} ${h}`, height: h, role: "img", "aria-label": describe },
      body,
    );
    if (!total) {
      svg("rect", { x: 0, y: 0, width, height: h, rx: 4, class: "grid" }, root).style.fill =
        "var(--grid)";
      return;
    }
    const present = segments.filter((s) => (values[s.key] ?? 0) > 0);
    let x = 0;
    present.forEach((seg, j) => {
      const w = ((values[seg.key] ?? 0) / total) * width;
      const last = j === present.length - 1;
      const g = svg("g", {}, root);
      const mark = svg(
        "path",
        { class: "mark", d: hBar(x, 0, Math.max(1, last ? w : w - 2), h, last) },
        g,
      );
      mark.style.fill = seg.color;
      svg("rect", { class: "hit", x, y: 0, width: Math.max(w, 6), height: h }, g);
      interactive(g, {
        label: `${seg.label}: ${format(values[seg.key])}`,
        onEnter: (anchor) =>
          showTip(anchor, seg.label, [
            {
              color: seg.color,
              value: format(values[seg.key]),
              label: `${Math.round((values[seg.key] / total) * 100)}% of ${format(total)}`,
            },
          ]),
      });
      x += w;
    });
  }).observe(body);
  return wrap;
}
