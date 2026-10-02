/**
 * The in-memory truth produced by the generator and consumed by the writer, the projection
 * (CDOP documents) and the fixtures. Shapes mirror the `cdop` tables (see supabase/migrations)
 * with Dates instead of strings so arithmetic stays simple; the writer serialises.
 */
import type { CdopProjectStatus, LifecycleState } from "../domain/lifecycle/types.js";
import type { UnitState } from "../domain/lifecycle/units.js";

export type ActorKind =
  "developer" | "code_admin" | "vvb" | "registry" | "system" | "simulator" | "db" | "buyer";

export interface Organisation {
  id: string;
  legal_name: string;
  trading_name?: string;
  website?: string;
  email?: string;
  phone?: string;
  classification?: string;
  cdop_role?: string;
  country_code: string;
  country_name?: string;
  region_code?: string;
  region_name?: string;
  subdivision_code?: string;
  subdivision_name?: string;
  city?: string;
  postal_code?: string;
  address_line_1?: string;
  founded_on?: Date;
  employees?: number;
  project_employees?: number;
  mission?: string;
  team_experience?: string;
  project_experience_years?: number;
}

export type AccountType =
  | "project_developer"
  | "project_proponent"
  | "vvb"
  | "code_administrator"
  | "registry_operator"
  | "corporate_end_user"
  | "retail_aggregator"
  | "trader"
  | "buffer_pool"
  | "system";

export interface Account {
  id: string;
  registry_id: string;
  organisation_id?: string;
  native_account_id?: string;
  name: string;
  account_type: AccountType;
  status: "pending" | "active" | "suspended" | "closed";
  parent_account_id?: string;
  is_master: boolean;
  standard_id?: string;
  opened_on?: Date;
  country_code?: string;
  holdings_public: boolean;
  retirements_public: boolean;
}

export interface ProjectLocation {
  id: string;
  kind: "project" | "facility";
  is_primary: boolean;
  country_code: string;
  country_name: string;
  region_code: string;
  region_name: string;
  subdivision_code?: string;
  subdivision_name?: string;
  address_line_1?: string;
  address_line_2?: string;
  alternative_address?: string;
  city?: string;
  postal_code?: string;
  sort: number;
}

export interface ProjectMitigation {
  id: string;
  mitigation_type: string;
  project_sector: string;
  project_type: string;
  estimated_annual_mitigation: number;
  estimated_total_mitigation: number;
  sort: number;
}

export interface StatusRecord {
  id: string;
  sequence: number;
  lifecycle_state: LifecycleState;
  native_state_code: string;
  native_state_name?: string;
  cdop_project_status: CdopProjectStatus;
  action?: string;
  intent?: string;
  reason?: string;
  actor_kind: ActorKind;
  actor_account_id?: string;
  effective_at: Date;
  is_current: boolean;
}

export interface CreditingPeriod {
  id: string;
  number: number;
  start_on: Date;
  end_on: Date;
  duration_years: number;
  period_type: "Fixed" | "Renewable";
  validation_event_id?: string;
  is_current: boolean;
}

export interface GeolocationFile {
  id: string;
  file_name: string;
  file_format: "GeoJSON" | "KML" | "Shapefile";
  area_type: string;
  geometry_type: "Polygon" | "MultiPolygon";
  file_status:
    | "ACTIVE"
    | "ARCHIVED"
    | "ACQUIRED"
    | "CANCELLED"
    | "FAILED"
    | "PLANNED"
    | "POTENTIAL"
    | "REJECTED";
  validity_start_on: Date;
  validity_end_on?: Date;
  file_created_at: Date;
  file_edited_at?: Date;
  file_deleted_at?: Date;
  crs: "EPSG:4326";
  /** A GeoJSON Feature with a Polygon/MultiPolygon geometry. */
  geojson: {
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
  };
  area_ha?: number;
  bbox: [number, number, number, number];
}

export interface ProjectFinance {
  expected_initial_costs?: number;
  expected_annual_costs?: number;
  expected_annual_revenue?: number;
  total_funding_required?: number;
  total_funding_secured?: number;
  financing_options: string[];
  community_benefit_mechanisms: string[];
  expected_community_proceeds?: number;
  declaring_entity_organisation_id?: string;
  expected_credit_price?: number;
  realized_transaction_price?: number;
  currency?: string;
}

export interface Stakeholder {
  id: string;
  organisation_id: string;
  stakeholder_type: string;
  is_primary_developer: boolean;
  role_started_on?: Date;
  role_ended_on?: Date;
}

export interface ProjectLabel {
  id: string;
  label_id: string;
  kind: "accreditation" | "compliance_eligibility" | "compliance_potential";
  start_on?: Date;
  expiry_on?: Date;
  approved_on?: Date;
  url?: string;
  accreditation_id?: string;
}

export interface ValidationEvent {
  id: string;
  sequence: number;
  validation_type: string;
  status:
    | "planned"
    | "submitted"
    | "in_review"
    | "changes_requested"
    | "completed"
    | "rejected"
    | "expired"
    | "withdrawn";
  vvb_organisation_id?: string;
  vvb_account_id?: string;
  submitted_on?: Date;
  site_visit_start_on?: Date;
  site_visit_end_on?: Date;
  decided_on?: Date;
  opinion?: "positive" | "qualified" | "negative";
  crediting_period_id?: string;
  report_document_id?: string;
  statement_document_id?: string;
  report_url?: string;
  expires_on?: Date;
  notes?: string;
}

export interface VerificationEvent {
  id: string;
  sequence: number;
  monitoring_period_start_on: Date;
  monitoring_period_end_on: Date;
  status:
    | "planned"
    | "submitted"
    | "in_review"
    | "changes_requested"
    | "completed"
    | "rejected"
    | "withdrawn";
  vvb_organisation_id?: string;
  site_visit_start_on?: Date;
  site_visit_end_on?: Date;
  submitted_on?: Date;
  verified_on?: Date;
  opinion?: "positive" | "qualified" | "negative";
  claim_type: string;
  uom: string;
  predicted_quantity?: number;
  claimed_quantity?: number;
  gross_verified_quantity?: number;
  leakage_deduction: number;
  buffer_deduction: number;
  uncertainty_deduction: number;
  uncertainty_basis?: "percentage" | "absolute";
  uncertainty_margin?: number;
  cumulative_verified_quantity?: number;
  issuance_id?: string;
  report_document_id?: string;
  statement_document_id?: string;
  report_url?: string;
}

export interface EstimationVintage {
  id: string;
  vintage_start_on: Date;
  vintage_end_on: Date;
  vintage_year: number;
  estimated_mitigation: number;
  estimated_claimable?: number;
  estimated_buffer?: number;
  monitoring_start_on?: Date;
  monitoring_end_on?: Date;
  estimated_issuance_on?: Date;
}

export interface Estimation {
  id: string;
  sequence: number;
  event_on: Date;
  status: "Unvalidated" | "Validated" | "Superseded";
  status_reason?: string;
  validated_by_validation_event_id?: string;
  superseded_by_estimation_id?: string;
  total_mitigation?: number;
  annual_mitigation?: number;
  total_years?: number;
  is_current: boolean;
  vintages: EstimationVintage[];
}

export interface Milestone {
  id: string;
  kind:
    | "validation_due"
    | "validation_expiry"
    | "verification_due"
    | "monitoring_report_due"
    | "crediting_period_end"
    | "restoration_validation_due"
    | "self_assessment_due"
    | "other";
  name: string;
  sequence: number;
  due_on: Date;
  completed_at?: Date;
  completed_by_validation_event_id?: string;
  completed_by_verification_event_id?: string;
}

export interface Issuance {
  id: string;
  batch_identifier: string;
  sequence: number;
  kind: "ex_ante" | "ex_post" | "conversion" | "buffer";
  verification_event_id?: string;
  validation_event_id?: string;
  status: "Verified" | "Pending Issuance" | "Issuing" | "Pre-issuance" | "Failed" | "Complete";
  issued_on?: Date;
  requested_on?: Date;
  unit_type: string;
  unit_class: "credit" | "pending" | "buffer";
  metric: string;
  vintage_start_on: Date;
  vintage_end_on: Date;
  vintage_label: string;
  volume: number;
  cumulative_volume: number;
  recipient_account_id?: string;
  url?: string;
}

export interface UnitStatusRecord {
  id: string;
  sequence: number;
  from_state?: UnitState;
  to_state: UnitState;
  cdop_status: string;
  action: string;
  reason?: string;
  actor_kind: ActorKind;
  actor_account_id?: string;
  from_owner_account_id?: string;
  to_owner_account_id?: string;
  quantity?: number;
  effective_at: Date;
  is_current: boolean;
}

export interface UnitBlock {
  id: string;
  issuance_id: string;
  serial_number: string;
  source_block_id?: string;
  block_start: number;
  block_end: number;
  unit_type: string;
  unit_class: "credit" | "pending" | "buffer";
  metric: string;
  vintage_start_on: Date;
  vintage_end_on: Date;
  vintage_label: string;
  owner_account_id: string;
  state: UnitState;
  state_reason?: string;
  native_status_code?: string;
  native_status_name?: string;
  cdop_status: string;
  retirement_id?: string;
  cancellation_id?: string;
  labels: string[];
  history: UnitStatusRecord[];
}

export interface Transfer {
  id: string;
  block_id: string;
  kind: "assignment" | "transfer" | "sale";
  from_account_id: string;
  to_account_id: string;
  quantity: number;
  price?: number;
  currency?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  requested_at: Date;
  settled_at?: Date;
  remarks?: string;
}

export interface Retirement {
  id: string;
  block_id: string;
  account_id: string;
  quantity: number;
  retired_at: Date;
  beneficiary_name?: string;
  beneficiary_organisation_id?: string;
  purpose?:
    "voluntary_offset" | "compliance" | "corsia" | "article_6" | "claim_neutrality" | "other";
  detail?: string;
  vintage_label: string;
  certificate_document_id?: string;
}

export interface Cancellation {
  id: string;
  block_id: string;
  account_id?: string;
  quantity: number;
  cancelled_at: Date;
  reason:
    "reversal" | "error" | "conversion" | "transfer_out" | "voluntary" | "expiry" | "regulatory";
  detail?: string;
  replacement_block_id?: string;
}

export interface BufferPoolEntry {
  id: string;
  standard_id: string;
  kind: "deposit" | "release" | "reversal_coverage" | "reversal_non_coverage" | "cancellation";
  quantity: number;
  occurred_on: Date;
  block_id?: string;
  verification_event_id?: string;
  notes?: string;
}

export interface Document {
  id: string;
  document_type_id: string;
  validation_event_id?: string;
  verification_event_id?: string;
  issuance_id?: string;
  title: string;
  file_name: string;
  content_type: string;
  size_bytes?: number;
  is_public: boolean;
  uploaded_at: Date;
  uploaded_by_account_id?: string;
  document_date?: Date;
  version_label?: string;
  extracted: Record<string, unknown>;
}

export interface Agreement {
  id: string;
  agreement_type: string;
  notes?: string;
  currency?: string;
  commitment_amount?: number;
  effective_on?: Date;
  expiry_on?: Date;
  governing_law?: string;
  financing_stage?: string;
  marketplace_or_venue: string[];
  collateral_type: string[];
  offtakes: Array<{
    id: string;
    contracted_volume?: number;
    contracted_price?: number;
    vintage_start_year?: number;
    vintage_end_year?: number;
    requirements?: string;
  }>;
  insurance: Array<{
    id: string;
    policy_exists: boolean;
    insurer_name?: string;
    policy_reference?: string;
    coverage_type?: string;
  }>;
  funding: Array<{
    id: string;
    sequence: number;
    source_category: string;
    expected_disbursement_on?: Date;
    disbursement_schedule?: string;
    conditions_precedent?: string;
    is_fully_committed?: boolean;
    commitment_status?: string;
    status_reason?: string;
    is_current: boolean;
  }>;
  counterparties: Array<{ organisation_id: string; role: string; sector?: string }>;
}

export interface CobenefitTarget {
  id: string;
  cobenefit_type: string;
  indicator_id: string;
  impact_overview?: string;
  approach?: string;
  unit_description?: string;
  unit_type?: string;
  unit_symbol?: string;
  monitoring_frequency?: string;
  baseline_value?: string;
  target_value?: string;
  supporting_evidence_url?: string;
  impacts: Array<{
    id: string;
    verification_event_id?: string;
    achieved_impact?: string;
    achieved_value?: string;
    change_type?: string;
    supporting_evidence_url?: string;
    reported_on?: Date;
  }>;
}

export interface ProjectAggregate {
  id: string;
  project_identifier: string;
  registry_id: string;
  standard_id: string;
  standard_version_id?: string;
  crediting_program_id: string;
  methodology_version_id?: string;
  native_project_id: string;
  native_project_url?: string;
  name: string;
  description?: string;
  program_type?: "Standalone project" | "Nested project" | "Scaled up program";
  activity_type?: string;
  master_project_id?: string;
  developer_account_id?: string;
  developer_organisation_id?: string;
  vvb_organisation_id?: string;
  lifecycle_state: LifecycleState;
  native_state_code: string;
  native_state_name?: string;
  cdop_project_status: CdopProjectStatus;
  is_on_hold: boolean;
  listed_on?: Date;
  registered_on?: Date;
  validated_on?: Date;
  first_verified_on?: Date;
  closed_on?: Date;
  validation_deadline_on?: Date;
  country_code: string;
  country_name: string;
  region_code: string;
  region_name: string;
  subdivision_code?: string;
  subdivision_name?: string;
  city?: string;
  centroid: [number, number];
  bbox: [number, number, number, number];
  grid_reference?: string;
  area_ha?: number;
  start_on?: Date;
  end_on?: Date;
  duration_years?: number;
  crediting_period_type?: "Fixed" | "Renewable";
  max_cumulative_crediting_years?: number;
  max_crediting_periods?: number;
  estimated_annual_mitigation?: number;
  estimated_total_mitigation?: number;
  estimated_total_years?: number;
  buffer_rate?: number;
  unit_metric: "tCO2e" | "tCO2";
  attestations: Record<string, unknown>;
  governance_structure?: string;
  community_frameworks?: string;
  public_comment?: boolean;
  public_comment_summary?: string;
  previous_program?: boolean;
  project_risk?: Record<string, unknown>;
  native_attributes: Record<string, unknown>;
  created_at: Date;
  modified_at: Date;

  locations: ProjectLocation[];
  mitigations: ProjectMitigation[];
  statusHistory: StatusRecord[];
  creditingPeriods: CreditingPeriod[];
  geolocationFiles: GeolocationFile[];
  finance?: ProjectFinance;
  sdgs: number[];
  cobenefitMethods: string[];
  landowners: string[];
  stakeholders: Stakeholder[];
  labels: ProjectLabel[];
  validations: ValidationEvent[];
  verifications: VerificationEvent[];
  estimations: Estimation[];
  milestones: Milestone[];
  issuances: Issuance[];
  blocks: UnitBlock[];
  transfers: Transfer[];
  retirements: Retirement[];
  cancellations: Cancellation[];
  bufferEntries: BufferPoolEntry[];
  documents: Document[];
  agreements: Agreement[];
  cobenefits: CobenefitTarget[];
}

export interface Dataset {
  seed: string;
  generatedAt: Date;
  organisations: Organisation[];
  accounts: Account[];
  projects: ProjectAggregate[];
}
