// ============================================================
// LIMA – TypeScript types mirroring backend Pydantic schemas
// ============================================================

// ---------- Auth ----------
export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ActivateAccountRequest {
  token: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ApiMessage {
  detail: string;
}

// ---------- Member ----------
export type PlayerStatus = "M" | "C" | "L" | "A";
export type AppRole = "admin" | "member";

export interface MemberSeasonRead {
  id: string;
  season_id: string;
  player_status: PlayerStatus;
  membership_fee: number | null;
  player_fee: number | null;
  helloasso_ref: string | null;
  asso_role: string | null;
  created_at: string;
}

export interface MemberRead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  app_role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_seasons: MemberSeasonRead[];
}

export interface MemberSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  app_role: AppRole;
  is_active: boolean;
}

export interface MemberCreate {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  app_role?: AppRole;
}

export interface MemberUpdate {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  postal_code?: string;
  city?: string;
}

export interface ImportMemberReport {
  created: number;
  updated: number;
  errors: string[];
  members: MemberSummary[];
}

// ---------- Season ----------
export interface SeasonRead {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeasonCreate {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

// ---------- Venue ----------
export interface VenueRead {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  contact_info: string | null;
  is_home: boolean;
  created_at: string;
}

// ---------- Event ----------
export type EventType =
  | "match"
  | "cabaret"
  | "training_show"
  | "training_leisure"
  | "welsh"
  | "formation"
  | "ag"
  | "other";

export type EventVisibility = "all" | "match" | "cabaret" | "loisir" | "admin";

export interface EventRead {
  id: string;
  season_id: string;
  venue_id: string | null;
  title: string;
  event_type: EventType;
  start_at: string;
  end_at: string | null;
  is_away: boolean;
  away_city: string | null;
  away_opponent: string | null;
  notes: string | null;
  visibility: EventVisibility;
  created_at: string;
  updated_at: string;
}

export interface EventCreate {
  season_id: string;
  venue_id?: string;
  title: string;
  event_type: EventType;
  start_at: string;
  end_at?: string;
  is_away?: boolean;
  away_city?: string;
  away_opponent?: string;
  notes?: string;
  visibility?: EventVisibility;
}

export interface EventUpdate {
  venue_id?: string;
  title?: string;
  event_type?: EventType;
  start_at?: string;
  end_at?: string;
  is_away?: boolean;
  away_city?: string;
  away_opponent?: string;
  notes?: string;
  visibility?: EventVisibility;
}

// ---------- ShowPlan ----------
export type ShowType = "match" | "cabaret" | "catch" | "other";

export interface ShowPlanRead {
  id: string;
  event_id: string | null;
  title: string;
  show_type: ShowType;
  theme: string | null;
  duration: string | null;
  venue_name: string | null;
  venue_contact: string | null;
  config: Record<string, unknown>;
  created_by: string;
  generated_plan: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShowPlanCreate {
  event_id?: string;
  title: string;
  show_type: ShowType;
  theme?: string;
  duration?: string;
  venue_name?: string;
  venue_contact?: string;
  config?: Record<string, unknown>;
}

export interface ShowPlanUpdate {
  event_id?: string;
  title?: string;
  show_type?: ShowType;
  theme?: string;
  duration?: string;
  venue_name?: string;
  venue_contact?: string;
  config?: Record<string, unknown>;
  generated_plan?: string;
}

// ---------- Settings ----------
export interface AppSettings {
  association_name: string;
  association_email: string;
  association_website: string;
  membership_fee_default: number;
  player_fee_match: number;
  player_fee_cabaret: number;
  player_fee_loisir: number;
  activation_token_validity_days: number;
  reset_token_validity_hours: number;
  [key: string]: unknown;
}

// ---------- Commission ----------
export interface CommissionRead {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

// ---------- Alignment ----------
export type AlignmentStatus = "draft" | "published";
export type AssignmentRole = "JR" | "DJ" | "MJ_MC" | "AR" | "COACH";

export interface AlignmentRead {
  id: string;
  season_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: AlignmentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentRead {
  id: string;
  alignment_id: string;
  event_id: string;
  member_id: string;
  role: AssignmentRole;
  created_at: string;
}

// ---------- Admin Analytics ----------
export interface EndpointStat {
  path: string;
  count: number;
}

export interface DailyActiveUserStat {
  day: string;
  unique_users: number;
  // aliases for frontend compatibility
  date?: string;
  count?: number;
}

export interface ActivityStats {
  total_requests: number;
  unique_users: number;
  top_endpoints: EndpointStat[];
  error_endpoints: EndpointStat[];
  daily_active_users: DailyActiveUserStat[];
  avg_response_time_ms: number;
}

export interface ActivityLog {
  id?: string;
  user_id?: string | null;
  email?: string | null;
  name?: string | null;
  path: string;
  method?: string | null;
  status_code?: number | null;
  response_time_ms?: number | null;
  created_at: string;
}

export interface LoginAttempt {
  id?: string;
  user_id?: string | null;
  email?: string | null;
  name?: string | null;
  success: boolean;
  created_at: string;
}

export interface LoginStats {
  attempts: LoginAttempt[];
  success_count: number;
  failure_count: number;
}
