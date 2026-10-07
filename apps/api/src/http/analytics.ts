import type { Env } from "../env.js";

/** Optional, operator-owned Rybbit destination. No external JavaScript is loaded. */
export function analyticsTags(env: Env): string {
  if (!env.RYBBIT_ORIGIN || !env.RYBBIT_SITE_ID) return "";
  return `<script defer src="/analytics.js" data-endpoint="${env.RYBBIT_ORIGIN}/api/track" data-site-id="${env.RYBBIT_SITE_ID}" data-hostname="${new URL(env.PUBLIC_BASE_URL).hostname}"></script>`;
}

export function analyticsCsp(csp: string, env: Env): string {
  return env.RYBBIT_ORIGIN && env.RYBBIT_SITE_ID
    ? csp.replace(/connect-src ([^;]+)/, `connect-src $1 ${env.RYBBIT_ORIGIN}`)
    : csp;
}

export function withAnalytics(html: string, env: Env): string {
  return html.replace("</head>", `${analyticsTags(env)}</head>`);
}
