/** HAL-FORMS templates derived from the lifecycle tables (M2 wires the POST handlers). */
import type { Template } from "./hal.js";
import type { Linker } from "./hal.js";
import { transitionsFrom } from "../domain/lifecycle/index.js";
import { unitTransitionsFrom, type UnitState } from "../domain/lifecycle/units.js";
import type { Role } from "./context.js";

const ACTOR_ROLES: Record<string, Role[]> = {
  developer: ["developer", "admin", "sandbox"],
  code_admin: ["code_admin", "admin", "sandbox"],
  vvb: ["vvb", "admin", "sandbox"],
  registry: ["registry", "admin", "sandbox"],
  system: ["admin"],
  holder: ["developer", "registry", "admin", "sandbox"],
};

export function projectTemplates(
  linker: Linker,
  projectId: string,
  standardId: string,
  nativeCode: string,
  role: Role,
  showAll: boolean,
): Record<string, Template> {
  const out: Record<string, Template> = {};
  for (const t of transitionsFrom(standardId, nativeCode)) {
    const allowed = ACTOR_ROLES[t.actor] ?? [];
    if (!(showAll || allowed.includes(role))) continue;
    const key = t.action.toLowerCase();
    out[key] = {
      title: t.label,
      method: "POST",
      target: linker.url(`/v2/projects/${projectId}/actions/${key}`),
      contentType: "application/json",
      properties: [
        { name: "reason", prompt: "Reason", type: "textarea", required: t.requiresReason ?? false },
        { name: "effective_date", prompt: "Effective date", type: "date", required: false },
      ],
    };
  }
  return out;
}

export function unitTemplates(
  linker: Linker,
  unitId: string,
  state: UnitState,
  quantity: number,
  role: Role,
  showAll: boolean,
): Record<string, Template> {
  const out: Record<string, Template> = {};
  for (const t of unitTransitionsFrom(state)) {
    const allowed = ACTOR_ROLES[t.actor] ?? [];
    if (!(showAll || allowed.includes(role))) continue;
    const properties: Template["properties"] = [];
    if (t.action === "transfer") {
      properties.push({
        name: "to_account_id",
        prompt: "Recipient account",
        type: "text",
        required: true,
        options: {
          link: { href: linker.url("/v2/accounts", { limit: 100 }) },
          valueField: "id",
          promptField: "name",
        },
      });
      properties.push({
        name: "quantity",
        prompt: "Quantity",
        type: "number",
        required: true,
        min: 1,
        max: quantity,
        value: quantity,
      });
    } else if (t.action === "retire") {
      properties.push({
        name: "quantity",
        prompt: "Quantity",
        type: "number",
        required: true,
        min: 1,
        max: quantity,
        value: quantity,
      });
      properties.push({
        name: "retirement_beneficiary",
        prompt: "Beneficiary",
        type: "text",
        required: true,
      });
      properties.push({
        name: "retirement_detail",
        prompt: "Retirement detail",
        type: "textarea",
        required: false,
      });
    } else if (t.action === "hold" || t.action === "cancel" || t.action === "cancel_buffer") {
      properties.push({ name: "reason", prompt: "Reason", type: "textarea", required: true });
    } else {
      properties.push({ name: "reason", prompt: "Reason", type: "textarea", required: false });
    }
    properties.push({
      name: "effective_date",
      prompt: "Effective date",
      type: "date",
      required: false,
    });
    out[t.action] = {
      title: t.label,
      method: "POST",
      target: linker.url(`/v2/units/${unitId}/actions/${t.action}`),
      contentType: "application/json",
      properties,
    };
  }
  return out;
}
