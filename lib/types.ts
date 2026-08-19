export type EntityType = '법인' | '개인사업자' | '예비창업자';
export type Subscription = 'free' | 'pro';
export type SavedStatus = '관심' | '신청중' | '완료';

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
  apply_url: string | null;
  detail_url: string | null;

  deadline_start: string | null;
  deadline_end: string | null;

  region: string[];
  entity_types: string[];
  is_nationwide: boolean;

  hashtags_raw: string | null;

  business_types: string[] | null;
  min_employees: number | null;
  max_employees: number | null;
  min_revenue: number | null;
  max_revenue: number | null;
  min_age_months: number | null;
  max_age_months: number | null;
  amount_text: string | null;
  amount_max: number | null;

  ai_summary: string | null;
  ai_tags: string[];

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  business_name: string | null;
  business_type: string;
  region: string;
  entity_type: EntityType;
  employee_count: number | null;
  annual_revenue: number | null;
  founded_at: string | null;
  is_tech_company: boolean;
  extra_tags: string[];
  subscription: Subscription;
  notify_email: boolean;
  toss_billing_key: string | null;
  toss_customer_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedProgram {
  id: string;
  user_id: string;
  program_id: string;
  status: SavedStatus;
  notes: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  program_id: string;
  sent_at: string;
}

// A generated Supabase `Database` type (via `supabase gen types typescript`) is
// deliberately not hand-rolled here — the Postgrest generic constraints require
// a `Relationships` array per table that only codegen gets right. Until that's
// run, Supabase client calls are untyped at the query layer; the domain types
// above (`Program`, `Profile`, ...) are used to cast results at the boundary.
