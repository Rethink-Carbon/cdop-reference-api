/** HAL (application/hal+json) + HAL-FORMS (_templates) building blocks. */

export interface Link {
  href: string;
  templated?: boolean;
  type?: string;
  title?: string;
  name?: string;
  profile?: string;
  deprecation?: string;
}

export type Links = Record<string, Link | Link[]>;

export interface TemplateOption {
  prompt: string;
  value: string;
}

export interface TemplateProperty {
  name: string;
  prompt?: string;
  type?: "text" | "number" | "date" | "datetime" | "hidden" | "textarea" | "url" | "checkbox";
  required?: boolean;
  readOnly?: boolean;
  regex?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  value?: string | number | boolean;
  options?: {
    inline?: TemplateOption[] | string[];
    link?: { href: string; type?: string; templated?: boolean };
    valueField?: string;
    promptField?: string;
    minItems?: number;
    maxItems?: number;
  };
}

export interface Template {
  title: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  target?: string;
  contentType?: string;
  properties: TemplateProperty[];
}

export interface HalDocument {
  _links: Links;
  _embedded?: Record<string, unknown>;
  _templates?: Record<string, Template>;
  [key: string]: unknown;
}

export const HAL_JSON = "application/hal+json";
export const HAL_FORMS_JSON = "application/prs.hal-forms+json";
export const PROBLEM_JSON = "application/problem+json";

export const CURIE_NAME = "cdop";

export class Linker {
  constructor(readonly baseUrl: string) {}

  url(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const u = new URL(
      path.startsWith("http") ? path : `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`,
    );
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === "") continue;
        u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  link(
    path: string,
    extra?: Omit<Link, "href">,
    query?: Record<string, string | number | boolean | undefined>,
  ): Link {
    return { href: this.url(path, query), ...extra };
  }

  templated(pathWithTemplate: string, extra?: Omit<Link, "href" | "templated">): Link {
    return { href: `${this.baseUrl}${pathWithTemplate}`, templated: true, ...extra };
  }

  curies(): Link[] {
    return [{ name: CURIE_NAME, href: `${this.baseUrl}/rels/{rel}`, templated: true }];
  }

  rel(name: string): string {
    return `${CURIE_NAME}:${name}`;
  }
}

/** Assemble a HAL document: properties first, then _links/_embedded/_templates. */
export function hal<T extends Record<string, unknown>>(
  properties: T,
  links: Links,
  opts: {
    embedded?: Record<string, unknown> | undefined;
    templates?: Record<string, Template> | undefined;
  } = {},
): T & HalDocument {
  const doc: Record<string, unknown> = { ...properties, _links: links };
  if (opts.embedded && Object.keys(opts.embedded).length > 0) doc._embedded = opts.embedded;
  if (opts.templates && Object.keys(opts.templates).length > 0) doc._templates = opts.templates;
  return doc as T & HalDocument;
}

export interface PageLinksInput {
  selfUrl: string;
  nextCursor?: string | undefined;
  prevCursor?: string | undefined;
  firstUrl?: string;
  upUrl?: string;
  searchTemplate?: string;
  describedBy?: string;
}

export function pageLinks(linker: Linker, input: PageLinksInput): Links {
  const self = new URL(input.selfUrl);
  const withCursor = (cursor: string | undefined): string | undefined => {
    if (!cursor) return undefined;
    const u = new URL(self.toString());
    u.searchParams.set("cursor", cursor);
    return u.toString();
  };
  const links: Links = {
    self: { href: self.toString() },
    curies: linker.curies(),
  };
  const next = withCursor(input.nextCursor);
  if (next) links.next = { href: next };
  const prev = withCursor(input.prevCursor);
  if (prev) links.prev = { href: prev };
  if (input.firstUrl) links.first = { href: input.firstUrl };
  else {
    const u = new URL(self.toString());
    u.searchParams.delete("cursor");
    links.first = { href: u.toString() };
  }
  if (input.upUrl) links.up = { href: input.upUrl };
  if (input.searchTemplate) links.search = { href: input.searchTemplate, templated: true };
  if (input.describedBy)
    links.describedby = { href: input.describedBy, type: "application/schema+json" };
  return links;
}
