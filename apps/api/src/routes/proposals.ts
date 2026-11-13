import { createHash } from "node:crypto";
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { schemaVersionLabel } from "@cdop/schemas";
import type { AppEnv } from "../app-env.js";
import type { AppDeps } from "../http/context.js";
import { getProjectAggregate } from "../services/projects.js";
import { hal } from "../http/hal.js";
import { halJson, json } from "../http/respond.js";
import { notModified } from "../http/etag.js";
import { HalResource, halResponse, problemResponses } from "../http/schemas.js";
import { mount } from "../http/mount.js";
import { notFound, ProblemError } from "../http/problems.js";
import {
  PROPOSAL_VERSION,
  PROPOSAL_LABEL,
  PROPOSAL_FEEDBACK,
  PROPOSAL_SCHEMA,
  buildProposal,
  validateProposal,
} from "../domain/projection/proposal.js";
import { PROPOSAL_EXAMPLES, proposalExamples } from "../domain/projection/proposal-examples.js";

const versionParams = z.object({ version: z.string() });
const documentResponse = {
  200: {
    description: "Experimental proposal JSON",
    content: { "application/json": { schema: z.record(z.string(), z.unknown()) } },
  },
  ...problemResponses,
};
const notModifiedResponse = { 304: { description: "Not modified" } };
function checkVersion(version: string): void {
  if (version !== PROPOSAL_VERSION) throw notFound("Proposal version", version);
}

export function registerProposalRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps): void {
  const { linker } = deps;
  const base = `/v2/proposals/${PROPOSAL_VERSION}`;
  const headers = { "x-cdop-schema-version": PROPOSAL_LABEL, "cache-control": "no-cache" };
  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/proposals",
      tags: ["Proposals"],
      summary: "Rethink proposals for TWG review",
      responses: {
        200: halResponse(HalResource("ProposalIndex", "Experimental profiles"), "Profiles"),
      },
    }),
    (c) =>
      halJson(
        c,
        hal(
          { status: "proposal", versions: [PROPOSAL_VERSION] },
          {
            self: linker.link("/v2/proposals"),
            up: linker.link("/v2"),
            item: linker.link(base, { title: `Rethink proposal ${PROPOSAL_VERSION}` }),
          },
        ),
        200,
        headers,
      ),
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/proposals/{version}",
      tags: ["Proposals"],
      summary: "Proposal scope and worked examples",
      request: { params: versionParams },
      responses: {
        200: halResponse(HalResource("ProposalProfile", "Review profile"), "Profile"),
        ...problemResponses,
      },
    }),
    (c, input) => {
      checkVersion(input.params.version);
      return halJson(
        c,
        hal(
          {
            version: PROPOSAL_VERSION,
            status: "proposal",
            feedback_ids: PROPOSAL_FEEDBACK,
            published_baseline: schemaVersionLabel(),
            scope:
              "Project identity, lifecycle and unit states, issuance preconditions and ordered state history. This is a focused review document, not a replacement Full List.",
            identity:
              "Demo issuer assigns a UUIDv5 from its immutable internal project ID. Preserve the assigned ID on transfer/import. Matching identities across independent issuers remains a governance decision.",
          },
          {
            self: linker.link(base),
            up: linker.link("/v2/proposals"),
            describedby: linker.link(`${base}/schema`, { type: "application/schema+json" }),
            item: PROPOSAL_EXAMPLES.map((name) =>
              linker.link(`${base}/examples/${name}`, { name, title: name }),
            ),
            project: linker.templated(`/v2/projects/{id}/proposals/${PROPOSAL_VERSION}`),
          },
        ),
        200,
        headers,
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/proposals/{version}/schema",
      tags: ["Proposals"],
      summary: "Proposal JSON Schema",
      request: { params: versionParams },
      responses: {
        200: {
          description: "JSON Schema 2020-12",
          content: { "application/schema+json": { schema: z.record(z.string(), z.unknown()) } },
        },
        ...problemResponses,
      },
    }),
    (c, input) => {
      checkVersion(input.params.version);
      return c.body(JSON.stringify(PROPOSAL_SCHEMA), 200, {
        ...headers,
        "content-type": "application/schema+json",
      });
    },
  );

  mount(
    app,
    createRoute({
      method: "post",
      path: "/v2/proposals/{version}/validate",
      tags: ["Proposals"],
      summary: "Validate proposal shape, references and state-history continuity",
      request: {
        params: versionParams,
        body: {
          required: true,
          content: { "application/json": { schema: z.record(z.string(), z.unknown()) } },
        },
      },
      responses: documentResponse,
    }),
    async (c, input) => {
      checkVersion(input.params.version);
      let payload: unknown;
      try {
        payload = await c.req.json();
      } catch {
        throw new ProblemError("validation-failed", "Body must be JSON");
      }
      return json(c, validateProposal(payload), 200, headers);
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/proposals/{version}/examples/{name}",
      tags: ["Proposals"],
      summary: "Worked synthetic example with validation results",
      request: { params: versionParams.extend({ name: z.enum(PROPOSAL_EXAMPLES) }) },
      responses: documentResponse,
    }),
    (c, input) => {
      checkVersion(input.params.version);
      return json(c, proposalExamples()[input.params.name], 200, headers);
    },
  );

  for (const raw of [false, true]) {
    mount(
      app,
      createRoute({
        method: "get",
        path: `/v2/projects/{id}/proposals/{version}${raw ? "/document" : ""}`,
        tags: ["Proposals"],
        summary: raw
          ? "Project in the proposal format"
          : "Explore a project's proposal and published format",
        request: { params: versionParams.extend({ id: z.string().min(1) }) },
        responses: raw
          ? { ...documentResponse, ...notModifiedResponse }
          : {
              200: halResponse(
                HalResource("ProjectProposal", "Proposed document and validation"),
                "Project proposal",
              ),
              ...notModifiedResponse,
              ...problemResponses,
            },
      }),
      async (c, input) => {
        checkVersion(input.params.version);
        const p = await getProjectAggregate(deps.db, input.params.id);
        const document = buildProposal(p);
        const validation = validateProposal(document);
        const target = `/v2/projects/${p.id}/proposals/${PROPOSAL_VERSION}`;
        const body = raw
          ? document
          : hal(
              { profile: PROPOSAL_LABEL, validation, document },
              {
                self: linker.link(target),
                up: linker.link(`/v2/projects/${p.id}`),
                profile: linker.link(base),
                describedby: linker.link(`${base}/schema`),
                alternate: linker.link(`/v2/projects/${p.id}/cdop/full-list`, {
                  title: "Published CDOP Full List",
                }),
                item: linker.link(`${target}/document`, {
                  title: "Proposal JSON",
                  type: "application/json",
                }),
              },
            );
        const etag = `"${createHash("sha256").update(JSON.stringify(body)).digest("hex")}"`;
        const responseHeaders = {
          ...headers,
          etag,
          "x-cdop-conformance": validation.valid
            ? "valid"
            : `invalid; errors=${validation.errors.length}`,
          link: `<${linker.url(`${base}/schema`)}>; rel="describedby"`,
        };
        return (
          notModified(c, etag, responseHeaders) ??
          (raw ? json : halJson)(c, body, 200, responseHeaders)
        );
      },
    );
  }
}
