/**
 * Unit ledgers. UK codes issue Pending Issuance Units per vintage at validation (PIUs are
 * tradeable, so they are `active` blocks of class `pending`) with a buffer share held by
 * the code's buffer pool; each verification converts the matured vintages into WCUs/PCUs.
 * Ex-post standards issue verified units per verification, deposit the buffer share, then
 * sell a portion on to traders and aggregators who retire for corporate beneficiaries.
 */
import type {
  Account,
  ProjectAggregate,
  Retirement,
  UnitBlock,
  VerificationEvent,
} from "./aggregate.js";
import { Ledger, blockQuantity } from "./ledger-core.js";
import { accountOn, type Party } from "./parties.js";
import type { Rng } from "./prng.js";
import { type GenContext, type ProjectSpec } from "./standards/common.js";
import { atBusinessHours } from "./time.js";
import { clamp, lastOf, prune } from "./util.js";

/** The CDOP value for a first validation; ex-ante units are issued against it. */
export const INITIAL_VALIDATION = "Validation of Project Design Document";

const PURPOSES: Retirement["purpose"][] = [
  "voluntary_offset",
  "voluntary_offset",
  "claim_neutrality",
  "claim_neutrality",
  "other",
];

function scopeFor(ctx: GenContext, spec: ProjectSpec, rng: Rng, p: ProjectAggregate): Ledger {
  const registry = ctx.parties.registryOperator[p.registry_id];
  const bufferPool =
    ctx.parties.bufferPool[spec.standard.id as keyof typeof ctx.parties.bufferPool];
  if (!registry || !bufferPool)
    throw new Error(`ledger: missing registry/buffer accounts for ${p.registry_id}`);
  return new Ledger({ ctx, spec, rng, p, registry, bufferPool });
}

function developerAccount(ctx: GenContext, spec: ProjectSpec): Account {
  return accountOn(spec.developer, spec.standard.registry_id);
}

function marketParty(
  ctx: GenContext,
  rng: Rng,
  tag: string,
  pool: "buyers" | "traders" | "aggregators" | "buyers-or-aggregators" | "traders-or-aggregators",
): Party {
  const { parties } = ctx;
  const list =
    pool === "buyers"
      ? parties.buyers
      : pool === "traders"
        ? parties.traders
        : pool === "aggregators"
          ? parties.aggregators
          : pool === "buyers-or-aggregators"
            ? [...parties.buyers, ...parties.aggregators]
            : [...parties.traders, ...parties.aggregators];
  return rng.pick(tag, list);
}

/** Conversion / verification ratio: N(0.97, 0.08) clamped to [0.6, 1.15]. */
function verificationRatio(rng: Rng, tag: string): number {
  return clamp(rng.normal(tag, 0.97, 0.08), 0.6, 1.15);
}

/** An instant on the verification day (the VERIFY status move happened that day too). */
function verifiedInstant(rng: Rng, tag: string, v: VerificationEvent): Date {
  return atBusinessHours(rng, tag, v.verified_on ?? v.monitoring_period_end_on);
}

// ------------------------------------------------------------------------------------- UK

export function buildUkLedger(
  ctx: GenContext,
  spec: ProjectSpec,
  rng: Rng,
  p: ProjectAggregate,
): void {
  const validation = p.validations.find(
    (v) => v.status === "completed" && v.validation_type === INITIAL_VALIDATION,
  );
  const estimation = p.estimations.find((e) => e.is_current && e.status === "Validated");
  if (!validation || !estimation || !p.validated_on) return;
  const ledger = scopeFor(ctx, spec, rng, p);
  const developer = developerAccount(ctx, spec);
  const pool = ledger.scope.bufferPool;
  const piu = spec.standard.unit_type_pending ?? "PIU";
  const verified = spec.standard.unit_type_verified;
  const issuedAt =
    ledger.later("piu:issue", validation.decided_on ?? p.validated_on, 1, 5) ??
    atBusinessHours(rng, "piu:issue:sameday", p.validated_on);

  // Ex-ante issuance per vintage: claimable PIUs to the developer, buffer PIUs to the pool.
  const creditBlocks = new Map<string, UnitBlock[]>();
  const bufferBlocks = new Map<string, UnitBlock>();
  for (const v of estimation.vintages) {
    const claimable = v.estimated_claimable ?? 0;
    const buffer = v.estimated_buffer ?? 0;
    if (claimable <= 0) continue;
    const vintage: [Date, Date] = [v.vintage_start_on, v.vintage_end_on];
    const iss = ledger.issuance(
      "ex_ante",
      piu,
      "pending",
      vintage,
      claimable,
      issuedAt,
      developer,
      { validationEventId: validation.id },
    );
    creditBlocks.set(v.id, [ledger.issueBlock(iss, claimable, developer, "active", issuedAt)]);
    if (buffer > 0) {
      const bufIss = ledger.issuance("buffer", piu, "buffer", vintage, buffer, issuedAt, pool, {
        validationEventId: validation.id,
      });
      const block = ledger.issueBlock(bufIss, buffer, pool, "buffer", issuedAt, "buffer_pool");
      bufferBlocks.set(v.id, block);
      ledger.bufferEntry(
        "deposit",
        buffer,
        issuedAt,
        block.id,
        undefined,
        "Ex-ante buffer contribution at validation.",
      );
    }
  }

  const completed = p.verifications
    .filter((x) => x.status === "completed")
    .sort((a, b) => a.sequence - b.sequence);

  // Some PIUs are assigned to buyers or aggregators ahead of conversion.
  if (rng.bool("piu:assign", 0.5)) {
    const vintages = [...creditBlocks.keys()];
    for (const vid of rng.sample(
      "piu:assign:pick",
      vintages,
      rng.int("piu:assign:n", 1, Math.min(3, vintages.length)),
    )) {
      const block = creditBlocks.get(vid)?.[0];
      if (!block) continue;
      const at = ledger.later(`piu:assign:${vid}`, issuedAt, 60, 700);
      if (!at) continue;
      // Once a verification has converted the vintage there are no PIUs left to assign.
      const converts = completed.find(
        (x) => block.vintage_end_on.getTime() <= x.monitoring_period_end_on.getTime(),
      );
      if (converts?.verified_on && at.getTime() >= converts.verified_on.getTime()) continue;
      const buyer = marketParty(ctx, rng, `piu:assign:${vid}:buyer`, "buyers-or-aggregators");
      const share = rng.float(`piu:assign:${vid}:share`, 0.4, 1);
      const qty = Math.max(1, Math.round(blockQuantity(block) * share));
      const moved = ledger.transfer(
        block,
        qty,
        at,
        developer,
        accountOn(buyer, p.registry_id),
        "assignment",
        Math.round(rng.float(`piu:assign:${vid}:price`, 18, 32) * 100) / 100,
        "GBP",
      );
      if (moved !== block) creditBlocks.get(vid)?.push(moved);
    }
  }

  // Each completed verification converts the vintages matured within its monitoring period.
  let cumulative = 0;
  const converted = new Set<string>();
  for (const v of completed) {
    const ratio = verificationRatio(rng, `verify:${v.sequence}:ratio`);
    const at = verifiedInstant(rng, `verify:${v.sequence}:at`, v);
    const matured = estimation.vintages.filter(
      (x) =>
        x.vintage_end_on.getTime() <= v.monitoring_period_end_on.getTime() && !converted.has(x.id),
    );
    let gross = 0;
    let bufferQty = 0;
    let firstIssuanceId: string | undefined;
    for (const vin of matured) {
      converted.add(vin.id);
      const vintage: [Date, Date] = [vin.vintage_start_on, vin.vintage_end_on];
      const sources = creditBlocks.get(vin.id) ?? [];
      const volumes = sources.map((b) => Math.max(1, Math.round(blockQuantity(b) * ratio)));
      const total = volumes.reduce((s, q) => s + q, 0);
      if (total > 0) {
        const iss = ledger.issuance(
          "conversion",
          verified,
          "credit",
          vintage,
          total,
          at,
          developer,
          { verificationEventId: v.id },
        );
        firstIssuanceId ??= iss.id;
        sources.forEach((src, i) => {
          const holder =
            ctx.parties.accounts.find((a) => a.id === src.owner_account_id) ?? developer;
          const block = ledger.issueBlock(
            iss,
            volumes[i] as number,
            holder,
            "active",
            at,
            undefined,
            src.id,
          );
          ledger.cancel(
            src,
            at,
            "cancel",
            "conversion",
            `Converted to ${verified} on verification ${v.sequence}.`,
            block.id,
          );
          gross += volumes[i] as number;
          creditBlocks.set(vin.id, [
            ...(creditBlocks.get(vin.id) ?? []).filter((b) => b !== src),
            block,
          ]);
        });
      }
      const buf = bufferBlocks.get(vin.id);
      if (buf) {
        const qty = Math.max(1, Math.round(blockQuantity(buf) * ratio));
        const bufIss = ledger.issuance("buffer", verified, "buffer", vintage, qty, at, pool, {
          verificationEventId: v.id,
        });
        const block = ledger.issueBlock(bufIss, qty, pool, "buffer", at, "buffer_pool", buf.id);
        ledger.cancel(
          buf,
          at,
          "cancel_buffer",
          "conversion",
          `Buffer ${piu} converted to ${verified} on verification ${v.sequence}.`,
          block.id,
        );
        ledger.bufferEntry(
          "release",
          blockQuantity(buf),
          at,
          buf.id,
          v.id,
          "Ex-ante buffer units released for conversion.",
        );
        ledger.bufferEntry("deposit", qty, at, block.id, v.id, "Verified buffer units deposited.");
        bufferQty += qty;
        gross += qty;
      }
    }
    v.claimed_quantity = gross;
    v.gross_verified_quantity = gross;
    v.buffer_deduction = bufferQty;
    cumulative += gross - bufferQty;
    v.cumulative_verified_quantity = cumulative;
    if (firstIssuanceId) v.issuance_id = firstIssuanceId;

    // Holders retire some of their freshly converted units.
    for (const vin of matured) {
      for (const block of [...(creditBlocks.get(vin.id) ?? [])]) {
        if (block.state !== "active") continue;
        const holder = ctx.parties.accounts.find((a) => a.id === block.owner_account_id);
        if (!holder) continue;
        const isDeveloper = holder.account_type === "project_developer";
        if (!rng.bool(`retire:${block.id}`, isDeveloper ? 0.15 : 0.7)) continue;
        const retireAt = ledger.later(`retire:${block.id}:at`, at, 30, 400);
        if (!retireAt) continue;
        const beneficiary = isDeveloper
          ? marketParty(ctx, rng, `retire:${block.id}:ben`, "buyers")
          : undefined;
        const name = beneficiary?.organisation.legal_name ?? holder.name;
        const share = rng.float(`retire:${block.id}:share`, 0.5, 1);
        const qty = Math.max(1, Math.round(blockQuantity(block) * share));
        ledger.retire(
          block,
          qty,
          retireAt,
          holder,
          prune({ name, organisationId: beneficiary?.organisation.id ?? holder.organisation_id }),
          rng.pick(`retire:${block.id}:purpose`, PURPOSES),
          `Retired against ${name}'s ${retireAt.getUTCFullYear()} emissions.`,
        );
      }
    }
  }
  ledger.finalize();
}

// ---------------------------------------------------------------------------------- ex-post

export interface ExPostLedgerParams {
  leakageRate: number;
  /** Label ids applied to every credit block (CORSIA/CCP decided per project). */
  unitLabels: string[];
}

export function buildExPostLedger(
  ctx: GenContext,
  spec: ProjectSpec,
  rng: Rng,
  p: ProjectAggregate,
  params: ExPostLedgerParams,
): void {
  const completed = p.verifications
    .filter((v) => v.status === "completed")
    .sort((a, b) => a.sequence - b.sequence);
  if (completed.length === 0) return;
  const ledger = scopeFor(ctx, spec, rng, p);
  const developer = developerAccount(ctx, spec);
  const pool = ledger.scope.bufferPool;
  const unitType = spec.standard.unit_type_verified;
  const bufferRate = p.buffer_rate ?? 0;
  let cumulative = 0;

  for (const v of completed) {
    const ratio = verificationRatio(rng, `verify:${v.sequence}:ratio`);
    const gross = Math.max(1, Math.round((v.predicted_quantity ?? 0) * ratio));
    const leakage = Math.round(gross * params.leakageRate);
    const buffer = Math.round((gross - leakage) * bufferRate);
    const verifiedQty = gross - leakage - buffer;
    v.claimed_quantity = gross;
    v.gross_verified_quantity = gross;
    v.leakage_deduction = leakage;
    v.buffer_deduction = buffer;
    v.uncertainty_deduction = 0;
    cumulative += verifiedQty;
    v.cumulative_verified_quantity = cumulative;
    if (verifiedQty <= 0) continue;

    const verifiedAt = verifiedInstant(rng, `verify:${v.sequence}:at`, v);
    const issuedAt = ledger.later(`issue:${v.sequence}`, verifiedAt, 10, 60) ?? verifiedAt;
    const vintage: [Date, Date] = [v.monitoring_period_start_on, v.monitoring_period_end_on];
    const iss = ledger.issuance(
      "ex_post",
      unitType,
      "credit",
      vintage,
      verifiedQty,
      issuedAt,
      developer,
      { verificationEventId: v.id },
    );
    v.issuance_id = iss.id;
    const credit = ledger.issueBlock(iss, verifiedQty, developer, "active", issuedAt);
    credit.labels = [...params.unitLabels];
    if (buffer > 0) {
      const bufIss = ledger.issuance(
        "buffer",
        unitType,
        "buffer",
        vintage,
        buffer,
        issuedAt,
        pool,
        { verificationEventId: v.id },
      );
      const block = ledger.issueBlock(bufIss, buffer, pool, "buffer", issuedAt, "buffer_pool");
      ledger.bufferEntry(
        "deposit",
        buffer,
        issuedAt,
        block.id,
        v.id,
        "Non-permanence buffer contribution.",
      );
    }

    // 40% of the issued volume sells on to traders/aggregators 6–18 months later, in tranches.
    const toSell = Math.round(verifiedQty * 0.4);
    const tranches = rng.int(`sell:${v.sequence}:n`, 1, 3);
    let remaining = toSell;
    const sold: UnitBlock[] = [];
    for (let t = 0; t < tranches && remaining > 0; t++) {
      // The first tranche sells 6–18 months after issuance; each later one follows the last.
      const at =
        t === 0
          ? ledger.later(`sell:${v.sequence}:${t}`, issuedAt, 180, 540)
          : ledger.later(`sell:${v.sequence}:${t}`, lastOf(credit.history).effective_at, 20, 200);
      if (!at) break;
      const qty =
        t === tranches - 1
          ? remaining
          : Math.max(
              1,
              Math.round(remaining * rng.float(`sell:${v.sequence}:${t}:share`, 0.3, 0.7)),
            );
      if (qty >= blockQuantity(credit)) break;
      const buyer = marketParty(
        ctx,
        rng,
        `sell:${v.sequence}:${t}:buyer`,
        "traders-or-aggregators",
      );
      sold.push(
        ledger.transfer(
          credit,
          qty,
          at,
          developer,
          accountOn(buyer, p.registry_id),
          "sale",
          Math.round(rng.float(`sell:${v.sequence}:${t}:price`, 4, 25) * 100) / 100,
          "USD",
        ),
      );
      remaining -= qty;
    }

    // 55% of what was sold is retired for corporate beneficiaries; 20% of the developer's remainder too.
    for (const block of sold) {
      if (!rng.bool(`retire:${block.id}`, 0.55)) continue;
      const at = ledger.later(`retire:${block.id}:at`, lastOf(block.history).effective_at, 30, 500);
      if (!at) continue;
      const holder = ctx.parties.accounts.find((a) => a.id === block.owner_account_id);
      if (!holder) continue;
      const beneficiary = marketParty(ctx, rng, `retire:${block.id}:ben`, "buyers");
      const qty = Math.max(
        1,
        Math.round(blockQuantity(block) * rng.float(`retire:${block.id}:share`, 0.4, 1)),
      );
      ledger.retire(
        block,
        qty,
        at,
        holder,
        { name: beneficiary.organisation.legal_name, organisationId: beneficiary.organisation.id },
        rng.pick(`retire:${block.id}:purpose`, PURPOSES),
        `Retired on behalf of ${beneficiary.organisation.legal_name} for its ${at.getUTCFullYear()} inventory.`,
      );
    }
    if (credit.state === "active" && rng.bool(`retire:dev:${v.sequence}`, 0.2)) {
      const at = ledger.later(
        `retire:dev:${v.sequence}:at`,
        lastOf(credit.history).effective_at,
        30,
        400,
      );
      if (at) {
        const beneficiary = marketParty(ctx, rng, `retire:dev:${v.sequence}:ben`, "buyers");
        const qty = Math.max(
          1,
          Math.round(blockQuantity(credit) * rng.float(`retire:dev:${v.sequence}:share`, 0.1, 0.5)),
        );
        ledger.retire(
          credit,
          qty,
          at,
          developer,
          {
            name: beneficiary.organisation.legal_name,
            organisationId: beneficiary.organisation.id,
          },
          "voluntary_offset",
          `Retired by the developer on behalf of ${beneficiary.organisation.legal_name}.`,
        );
      }
    }
  }
  ledger.finalize();
}
