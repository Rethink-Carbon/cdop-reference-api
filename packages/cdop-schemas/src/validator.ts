import Ajv2020Module from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormatsModule from "ajv-formats";

// ajv ships CommonJS with both `module.exports` and `exports.default`; under NodeNext the default
// import is the module namespace, so unwrap once here.
type AjvCtor = typeof Ajv2020Module extends { default: infer D } ? D : typeof Ajv2020Module;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: unknown }).default ??
  Ajv2020Module) as AjvCtor;
type AddFormats = typeof addFormatsModule extends { default: infer D }
  ? D
  : typeof addFormatsModule;
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as AddFormats;
type AjvInstance = InstanceType<AjvCtor>;
import { loadSchema } from "./index.js";
import type { PodName } from "./types.js";

export interface ValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  message: string;
  params: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  pod: PodName;
  errors: ValidationError[];
}

export const CDOP_ANNOTATION_KEYWORDS = [
  "x-cdop-field-id",
  "x-cdop-field-path",
  "x-cdop-cardinality",
  "x-cdop-mutability",
  "x-cdop-public-private",
  "x-cdop-data-source",
  "x-cdop-pre-issuance-inclusion",
  "x-cdop-required-optional",
  "x-cdop-schema",
];

let ajv: AjvInstance | undefined;
const compiled = new Map<PodName, ValidateFunction>();

function instance(): AjvInstance {
  if (ajv) return ajv;
  ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addVocabulary(CDOP_ANNOTATION_KEYWORDS);
  return ajv;
}

export function getValidator(pod: PodName): ValidateFunction {
  const existing = compiled.get(pod);
  if (existing) return existing;
  const schema = { ...loadSchema(pod) };
  delete schema.$id; // avoid id collisions between pods that share `$id` fragments
  const fn = instance().compile(schema);
  compiled.set(pod, fn);
  return fn;
}

export function validatePayload(pod: PodName, payload: unknown): ValidationResult {
  const fn = getValidator(pod);
  const valid = fn(payload);
  const errors = (fn.errors ?? []).map((e: ErrorObject) => ({
    instancePath: e.instancePath,
    schemaPath: e.schemaPath,
    keyword: e.keyword,
    message: e.message ?? "",
    params: e.params as Record<string, unknown>,
  }));
  return { valid, pod, errors };
}
