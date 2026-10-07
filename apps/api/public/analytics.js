// Rybbit's public /api/track protocol (v1.6.1). Kept local so URLs can be sanitised before sending:
// its bundled tracker treats everything after #/ as a pathname, including Atlas search queries.
(() => {
  const script = document.currentScript;
  if (!script || location.hostname !== script.dataset.hostname) return;
  function optedOut() {
    if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl || window.__RYBBIT_OPTOUT__)
      return true;
    try {
      return localStorage.getItem("disable-rybbit") !== null;
    } catch {
      return true;
    }
  }
  function pathname() {
    if (location.pathname !== "/atlas/") return location.pathname;
    const path = location.hash.slice(1).split("?")[0] || "/";
    // Record the type of detail page, never arbitrary IDs, fragments or user-entered strings.
    const match = path.match(/^\/(projects|accounts|units)(?:\/[^/]+)?(?:\/([a-z-]+))?$/);
    if (path === "/") return "/atlas/";
    if (!match) return "/atlas/other";
    const [, kind, tab] = match;
    const detail = path.split("/").length > 2;
    const safeTab = ["overview", "history", "issuances", "units", "documents", "cdop"].includes(tab)
      ? `/${tab}`
      : "";
    return `/atlas/${kind}${detail ? "/detail" : ""}${safeTab}`;
  }
  function originOnly(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.origin : "";
    } catch {
      return "";
    }
  }
  function send(type, event_name = "", properties) {
    if (optedOut()) return;
    const payload = {
      site_id: script.dataset.siteId,
      hostname: location.hostname,
      pathname: pathname(),
      querystring: "",
      screenWidth: screen.width,
      screenHeight: screen.height,
      language: navigator.language,
      page_title: location.pathname === "/atlas/" ? "CDOP Atlas" : "CDOP reference API",
      referrer: originOnly(document.referrer),
      type,
      event_name,
      ...(properties ? { properties: JSON.stringify(properties) } : {}),
    };
    // No cookies, persistent user ID, replay, retries or dependence on analytics availability.
    void fetch(script.dataset.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
    }).catch(() => {});
  }
  // Only deliberately instrumented interactions; never read form contents or API responses.
  window.cdopAnalytics = {
    event: (name, properties = {}) => send("custom_event", name, properties),
  };
  let lastRoute;
  function pageview() {
    // Deduplicate filter edits, but still count navigating between two detail pages of one type.
    const route =
      location.pathname + (location.pathname === "/atlas/" ? location.hash.split("?")[0] : "");
    if (route === lastRoute) return;
    lastRoute = route;
    send("pageview");
  }
  pageview();
  window.addEventListener("hashchange", pageview);
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (!["http:", "https:"].includes(url.protocol)) return;
    if (url.origin !== location.origin) {
      send("custom_event", "outbound_link", { destination: url.hostname });
    } else if (/^\/(docs|explorer|v2)(\/|$)/.test(url.pathname)) {
      send("custom_event", "resource_link", { destination: url.pathname.split("/")[1] });
    }
  });
})();
