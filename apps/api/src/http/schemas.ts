/** Shared zod schemas for OpenAPI route definitions. */
import { z } from "@hono/zod-openapi";

export const IdParam = (example: string) =>
  z.object({
    id: z
      .string()
      .min(1)
      .openapi({ param: { name: "id", in: "path" }, example }),
  });

export const LinkSchema = z
  .object({
    href: z.string(),
    templated: z.boolean().optional(),
    type: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    profile: z.string().optional(),
  })
  .openapi("Link");

export const LinksSchema = z
  .record(z.string(), z.union([LinkSchema, z.array(LinkSchema)]))
  .openapi("Links");

export const TemplateSchema = z
  .object({
    title: z.string(),
    method: z.string(),
    target: z.string().optional(),
    contentType: z.string().optional(),
    properties: z.array(
      z
        .object({
          name: z.string(),
          prompt: z.string().optional(),
          type: z.string().optional(),
          required: z.boolean().optional(),
          value: z.unknown().optional(),
          options: z.unknown().optional(),
        })
        .loose(),
    ),
  })
  .openapi("HalFormsTemplate");

export const HalResource = (name: string, description: string) =>
  z
    .object({
      _links: LinksSchema,
      _embedded: z.record(z.string(), z.unknown()).optional(),
      _templates: z.record(z.string(), TemplateSchema).optional(),
    })
    .loose()
    .openapi(name, { description });

export const ProblemSchema = z
  .object({
    type: z.string().openapi({ example: "https://cdop.rethinkcarbon.co.uk/problems/not-found" }),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
  })
  .loose()
  .openapi("Problem", { description: "RFC 9457 problem details" });

export const PageQuery = z.object({
  limit: z
    .string()
    .optional()
    .openapi({ description: "Page size (default 20, max 100)", example: "20" }),
  cursor: z
    .string()
    .optional()
    .openapi({ description: "Opaque cursor from a previous page's `next` link" }),
  sort: z
    .string()
    .optional()
    .openapi({ description: "Sort key, prefix with - for descending", example: "-modified_at" }),
});

export const problemResponses = {
  400: {
    description: "Bad request",
    content: { "application/problem+json": { schema: ProblemSchema } },
  },
  404: {
    description: "Not found",
    content: { "application/problem+json": { schema: ProblemSchema } },
  },
  422: {
    description: "Validation failed",
    content: { "application/problem+json": { schema: ProblemSchema } },
  },
} as const;

export const halResponse = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { "application/hal+json": { schema } },
});

export { z };
