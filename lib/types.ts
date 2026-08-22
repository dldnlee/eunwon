export type EntityType = '법인' | '개인사업자' | '예비창업자';
export type Subscription = 'free' | 'pro';
export type SavedStatus = 'saved' | 'applied' | 'selected' | 'rejected';
export type NotificationType = 'new_match' | 'deadline_7d' | 'deadline_3d' | 'deadline_1d';
export type DocumentType = 'bizreg' | 'financial' | 'resume' | 'past_application';

export interface Program {
  id: string;
  external_id: string;
  source: string;

  title: string;
  agency: string;
  exec_agency: string | null;
  category: string | null;
  target_raw: string | null;

  description: string | null;
  apply_method: string | null;
  apply_steps: string[];
  apply_url: string | null;
  detail_url: string | null;

  deadline_start: string | null;
  deadline_end: string | null;

  region: string[];
  entity_types: string[];
  is_nationwide: boolean;

  hashtags_raw: string | null;

  max_age_months: number | null;
  min_age_months: number | null;

  min_employees: number | null;
  max_employees: number | null;
  min_annual_revenue_krw: number | null;
  max_annual_revenue_krw: number | null;

  funding_amount_krw: number | null;
  funding_type: string | null;

  required_business_traits: string[];
  required_tech_domains: string[];
  required_certifications: string[];
  required_extra_tags: string[];
  required_rnd_capability: string[];
  required_investment_stage: string | null;

  ai_summary: string | null;
  ai_tags: string[];

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  company_name: string | null;
  representative_name: string | null;
  business_number: string | null;

  entity_type: EntityType;
  industry_code: string | null;
  industry_name: string | null;
  tech_domains: string[];

  founded_at: string | null;
  age_months: number | null;          // app-computed on every write — see lib/utils.ts:getAgeMonths
  region: string;
  employee_count: number | null;
  annual_revenue_krw: number | null;

  certifications: string[];
  extra_tags: string[];
  current_challenges: string | null;
  interest_categories: string[];

  business_description: string | null;
  business_traits: string[];
  rnd_capability: string[];
  investment_stage: string | null;

  business_verified: boolean;
  business_status: 'active' | 'suspended' | 'closed' | null;
  business_verified_at: string | null;
  business_tax_type: string | null;
  business_closed_at: string | null;

  subscription: Subscription;
  notify_email: boolean;
  onboarding_complete: boolean;
  toss_billing_key: string | null;
  toss_customer_key: string | null;
  trial_ending_notified_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  external_id: string;
  source: string;

  title: string;
  event_type: string | null;
  category: string | null;
  host_org: string | null;

  description: string | null;

  region: string[];
  is_nationwide: boolean;

  event_start: string | null;
  event_end: string | null;
  apply_start: string | null;
  apply_end: string | null;

  detail_url: string | null;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedProgram {
  id: string;
  user_id: string;
  program_id: string;
  status: SavedStatus;
  outcome: string | null;
  received_at: string | null;
  amount_krw: number | null;
  notes: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  program_id: string;
  type: NotificationType;
  sent_at: string;
}

export interface Review {
  id: string;
  author_name: string;
  business_type: string;
  rating: number;
  content: string;
  is_published: boolean;
  created_at: string;
}

export interface UserDocument {
  id: string;
  user_id: string;
  type: DocumentType;
  filename: string;
  storage_path: string;
  year: number | null;
  created_at: string;
}

// A generated Supabase `Database` type (via `supabase gen types typescript`) is
// deliberately not hand-rolled here — the Postgrest generic constraints require
// a `Relationships` array per table that only codegen gets right. Until that's
// run, Supabase client calls are untyped at the query layer; the domain types
// above (`Program`, `Profile`, ...) are used to cast results at the boundary.
