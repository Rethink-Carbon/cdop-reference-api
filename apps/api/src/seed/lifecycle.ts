/**
 * Walks a standard's native state machine forward so every generated status row is a
 * legal transition the API could have made. Review states get right-skewed "more
 * information" loops; each step lands on a weekday at business hours. A walk stops early
 * if the next step would fall after `now`: the project simply has not got there yet.
 */
import { machineFor, nativeState } from "../domain/lifecycle/index.js";
import type { NativeTransition } from "../domain/lifecycle/types.js";
import type { Rng } from "./prng.js";
import { atBusinessHours, businessDaysAfter } from "./time.js";

export interface WalkStep {
  transition: NativeTransition;
  at: Date;
}

export interface WalkResult {
  steps: WalkStep[];
  /** Native state after the last step (the start state when nothing happened). */
  endState: string;
  endAt: Date;
  /** False when `now` cut the walk short of the requested state. */
  reached: boolean;
}

export interface WalkOptions {
  /** Pin the first step to this instant (business hours applied) instead of dwelling. */
  firstAt?: Date;
  /** Disable more-info loops (used when re-walking a segment inside a loop). */
  noLoops?: boolean;
}

/** Intents that move a project forward along its happy path. */
const FORWARD: ReadonlySet<string> = new Set([
  "submit",
  "approve",
  "verify",
  "issue",
  "release",
  "other",
]);

/** Mean more-info loops per review seat (plan §10: 0.35 admin, 0.55 VVB), capped at 3. */
const LOOP_MEAN: Record<string, number> = { code_admin: 0.35, vvb: 0.55, registry: 0.12 };

/** Dwell in calendar days [min, max] before a step, keyed on the seat acting and its intent. */
function dwellRange(t: NativeTransition, phase: string | undefined): [number, number] {
  const validation =
    phase === "validation_review" ||
    phase === "restoration_validation" ||
    phase === "verification_review";
  switch (t.actor) {
    case "developer":
      if (t.intent === "withdraw") return [40, 400];
      // Resubmissions after more-info are quick; first submissions take a while to prepare.
      return phase ? [5, 30] : [20, 120];
    case "code_admin":
      return validation ? [10, 45] : [3, 25];
    case "vvb":
      if (t.intent === "more_info") return [20, 90];
      return phase === "restoration_validation" ? [30, 90] : [45, 160];
    case "registry":
      if (t.intent === "release") return [5, 40];
      if (t.intent === "hold") return [1, 6];
      if (t.intent === "issue") return [30, 120];
      if (t.intent === "verify") return [5, 20];
      if (t.intent === "reject" && phase === "hold") return [60, 300];
      return validation ? [3, 20] : [1, 12];
    default:
      return [1, 10];
  }
}

/** Shortest forward path (submit/approve/…) between two native states, or undefined. */
export function forwardPath(
  standardId: string,
  from: string,
  to: string,
): NativeTransition[] | undefined {
  if (from === to) return [];
  const machine = machineFor(standardId);
  const prev = new Map<string, NativeTransition>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const state = queue.shift() as string;
    for (const t of machine.transitions) {
      if (t.from !== state || !FORWARD.has(t.intent) || seen.has(t.to)) continue;
      // Self-loops (VERIFIED → VERIFIED) never shorten a path.
      if (t.to === t.from) continue;
      prev.set(t.to, t);
      if (t.to === to) {
        const path: NativeTransition[] = [];
        let cursor = to;
        while (cursor !== from) {
          const step = prev.get(cursor) as NativeTransition;
          path.unshift(step);
          cursor = step.from;
        }
        return path;
      }
      seen.add(t.to);
      queue.push(t.to);
    }
  }
  return undefined;
}

/** Transitions that land on `to` (the ways into an exit state such as WITHDRAWN). */
export function entriesInto(standardId: string, to: string): NativeTransition[] {
  return machineFor(standardId).transitions.filter((t) => t.to === to && t.from !== to);
}

export function walkPath(
  rng: Rng,
  tag: string,
  standardId: string,
  path: readonly NativeTransition[],
  startAt: Date,
  now: Date,
  opts: WalkOptions = {},
): WalkResult {
  const steps: WalkStep[] = [];
  let at = startAt;
  let state = path[0]?.from ?? "";
  const push = (t: NativeTransition, when: Date): boolean => {
    if (when.getTime() >= now.getTime()) return false;
    steps.push({ transition: t, at: when });
    at = when;
    state = t.to;
    return true;
  };

  for (let i = 0; i < path.length; i++) {
    const t = path[i] as NativeTransition;
    const fromState = nativeState(standardId, t.from);
    const owner = fromState?.owner ?? "none";
    const key = `${tag}:${i}:${t.action}`;

    // More-info loops at review seats: bounce back, then re-walk forward to this state.
    if (!opts.noLoops && !(i === 0 && opts.firstAt) && LOOP_MEAN[owner] !== undefined) {
      const back = machineFor(standardId).transitions.find(
        (x) => x.from === t.from && x.intent === "more_info",
      );
      const loops = back ? rng.skewedCount(`${key}:loops`, LOOP_MEAN[owner]) : 0;
      for (let l = 0; l < loops && back; l++) {
        const [minD, maxD] = dwellRange(back, fromState?.phase);
        const when = businessDaysAfter(
          rng,
          `${key}:loop${l}:back`,
          at,
          rng.int(`${key}:loop${l}:backdays`, minD, maxD),
        );
        if (!push(back, when)) return { steps, endState: state, endAt: at, reached: false };
        const returnPath = forwardPath(standardId, back.to, t.from);
        if (!returnPath || returnPath.length === 0) break;
        const inner = walkPath(rng, `${key}:loop${l}:return`, standardId, returnPath, at, now, {
          noLoops: true,
        });
        steps.push(...inner.steps);
        at = inner.endAt;
        state = inner.endState;
        if (!inner.reached) return { steps, endState: state, endAt: at, reached: false };
      }
    }

    const [minD, maxD] = dwellRange(t, fromState?.phase);
    const when =
      i === 0 && opts.firstAt
        ? atBusinessHours(rng, `${key}:first`, opts.firstAt)
        : businessDaysAfter(rng, key, at, rng.int(`${key}:days`, minD, maxD));
    if (!push(t, when)) return { steps, endState: state, endAt: at, reached: false };
  }
  return { steps, endState: state, endAt: at, reached: true };
}

/** Walk from `from` to `to` along the shortest forward path. */
export function walkTo(
  rng: Rng,
  tag: string,
  standardId: string,
  from: string,
  to: string,
  startAt: Date,
  now: Date,
  opts: WalkOptions = {},
): WalkResult {
  const path = forwardPath(standardId, from, to);
  if (!path) throw new Error(`${standardId}: no forward path ${from} → ${to}`);
  return walkPath(rng, tag, standardId, path, startAt, now, opts);
}

/** Apply one named transition out of `from` at (or after) `startAt`. */
export function walkEdge(
  rng: Rng,
  tag: string,
  standardId: string,
  from: string,
  action: string,
  startAt: Date,
  now: Date,
  opts: WalkOptions = {},
): WalkResult {
  const t = machineFor(standardId).transitions.find((x) => x.from === from && x.action === action);
  if (!t) throw new Error(`${standardId}: no transition ${action} from ${from}`);
  return walkPath(rng, tag, standardId, [t], startAt, now, opts);
}

/** Initial state of a standard's machine (the state nothing transitions into). */
export function initialState(standardId: string): string {
  const machine = machineFor(standardId);
  const targets = new Set(machine.transitions.map((t) => t.to));
  const first = machine.states.find((s) => !targets.has(s.code));
  if (!first) throw new Error(`${standardId}: no initial state`);
  return first.code;
}
