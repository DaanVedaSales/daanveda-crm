export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          channel: string | null
          created_at: string | null
          id: string
          lead_id: string
          metadata: Json | null
          new_value: string | null
          notes: string | null
          old_value: string | null
          org_id: string
          outcome: string | null
          user_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          channel?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          org_id: string
          outcome?: string | null
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          channel?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          org_id?: string
          outcome?: string | null
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "activities_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "activities_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "activities_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      commissions: {
        Row: {
          achievement_pct: number | null
          bonus_type: string | null
          commission_amt: number | null
          commission_rate: number | null
          created_at: string | null
          deal_id: string | null
          deal_value: number | null
          id: string
          month: number
          plan_tier: string | null
          user_id: string
          year: number
        }
        Insert: {
          achievement_pct?: number | null
          bonus_type?: string | null
          commission_amt?: number | null
          commission_rate?: number | null
          created_at?: string | null
          deal_id?: string | null
          deal_value?: number | null
          id?: string
          month: number
          plan_tier?: string | null
          user_id: string
          year: number
        }
        Update: {
          achievement_pct?: number | null
          bonus_type?: string | null
          commission_amt?: number | null
          commission_rate?: number | null
          created_at?: string | null
          deal_id?: string | null
          deal_value?: number | null
          id?: string
          month?: number
          plan_tier?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          { foreignKeyName: "commissions_deal_id_fkey"; columns: ["deal_id"]; isOneToOne: false; referencedRelation: "deals"; referencedColumns: ["id"] },
          { foreignKeyName: "commissions_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      contacts: {
        Row: {
          created_at: string | null
          designation: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          is_verified: boolean | null
          linkedin_url: string | null
          name: string
          org_id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          linkedin_url?: string | null
          name: string
          org_id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          linkedin_url?: string | null
          name?: string
          org_id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "contacts_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      dataset_ratings: {
        Row: {
          accuracy_score: number | null
          created_at: string | null
          dataset_id: string
          id: string
          notes: string | null
          quality_score: number | null
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string | null
          dataset_id: string
          id?: string
          notes?: string | null
          quality_score?: number | null
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string | null
          dataset_id?: string
          id?: string
          notes?: string | null
          quality_score?: number | null
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "dataset_ratings_dataset_id_fkey"; columns: ["dataset_id"]; isOneToOne: false; referencedRelation: "datasets"; referencedColumns: ["id"] },
          { foreignKeyName: "dataset_ratings_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      datasets: {
        Row: {
          created_at: string | null
          id: string
          name: string
          notes: string | null
          source: Database["public"]["Enums"]["dataset_source"]
          total_records: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          source: Database["public"]["Enums"]["dataset_source"]
          total_records?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          source?: Database["public"]["Enums"]["dataset_source"]
          total_records?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "datasets_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      deals: {
        Row: {
          billing_address: string | null
          billing_name: string | null
          closer_id: string
          created_at: string | null
          date_won_lost: string | null
          deal_value: number | null
          deleted_at: string | null
          demo_id: string | null
          first_demo_date: string | null
          follow_up_count: number | null
          gst_number: string | null
          id: string
          invoice_status: Database["public"]["Enums"]["invoice_status"] | null
          is_deleted: boolean
          lead_id: string
          loss_reason: string | null
          next_follow_up: string | null
          onboarding_issued: boolean | null
          org_id: string
          payment_confirmed: boolean | null
          plan_type: string | null
          poc_designation: string | null
          poc_email: string | null
          poc_name: string | null
          poc_phone: string | null
          proposal_sent_at: string | null
          removed_from_board: boolean | null
          sales_cycle_days: number | null
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_name?: string | null
          closer_id: string
          created_at?: string | null
          date_won_lost?: string | null
          deal_value?: number | null
          deleted_at?: string | null
          demo_id?: string | null
          first_demo_date?: string | null
          follow_up_count?: number | null
          gst_number?: string | null
          id?: string
          invoice_status?: Database["public"]["Enums"]["invoice_status"] | null
          is_deleted?: boolean
          lead_id: string
          loss_reason?: string | null
          next_follow_up?: string | null
          onboarding_issued?: boolean | null
          org_id: string
          payment_confirmed?: boolean | null
          plan_type?: string | null
          poc_designation?: string | null
          poc_email?: string | null
          poc_name?: string | null
          poc_phone?: string | null
          proposal_sent_at?: string | null
          removed_from_board?: boolean | null
          sales_cycle_days?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_name?: string | null
          closer_id?: string
          created_at?: string | null
          date_won_lost?: string | null
          deal_value?: number | null
          deleted_at?: string | null
          demo_id?: string | null
          first_demo_date?: string | null
          follow_up_count?: number | null
          gst_number?: string | null
          id?: string
          invoice_status?: Database["public"]["Enums"]["invoice_status"] | null
          is_deleted?: boolean
          lead_id?: string
          loss_reason?: string | null
          next_follow_up?: string | null
          onboarding_issued?: boolean | null
          org_id?: string
          payment_confirmed?: boolean | null
          plan_type?: string | null
          poc_designation?: string | null
          poc_email?: string | null
          poc_name?: string | null
          poc_phone?: string | null
          proposal_sent_at?: string | null
          removed_from_board?: boolean | null
          sales_cycle_days?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "deals_closer_id_fkey"; columns: ["closer_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "deals_demo_id_fkey"; columns: ["demo_id"]; isOneToOne: false; referencedRelation: "demos"; referencedColumns: ["id"] },
          { foreignKeyName: "deals_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "deals_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      demos: {
        Row: {
          calendar_invite_sent: boolean | null
          closer_id: string | null
          created_at: string | null
          deleted_at: string | null
          demo_date: string
          demo_expectation: string | null
          handoff_at: string | null
          id: string
          is_deleted: boolean
          lead_id: string
          org_id: string
          pain_point: string | null
          post_demo_notes: string | null
          reminder_sent: boolean | null
          sdr_id: string
          sdr_interest_signal: Database["public"]["Enums"]["interest_signal"] | null
          sdr_summary: string
          status: Database["public"]["Enums"]["demo_status"]
          updated_at: string | null
        }
        Insert: {
          calendar_invite_sent?: boolean | null
          closer_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          demo_date: string
          demo_expectation?: string | null
          handoff_at?: string | null
          id?: string
          is_deleted?: boolean
          lead_id: string
          org_id: string
          pain_point?: string | null
          post_demo_notes?: string | null
          reminder_sent?: boolean | null
          sdr_id: string
          sdr_interest_signal?: Database["public"]["Enums"]["interest_signal"] | null
          sdr_summary: string
          status?: Database["public"]["Enums"]["demo_status"]
          updated_at?: string | null
        }
        Update: {
          calendar_invite_sent?: boolean | null
          closer_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          demo_date?: string
          demo_expectation?: string | null
          handoff_at?: string | null
          id?: string
          is_deleted?: boolean
          lead_id?: string
          org_id?: string
          pain_point?: string | null
          post_demo_notes?: string | null
          reminder_sent?: boolean | null
          sdr_id?: string
          sdr_interest_signal?: Database["public"]["Enums"]["interest_signal"] | null
          sdr_summary?: string
          status?: Database["public"]["Enums"]["demo_status"]
          updated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "demos_closer_id_fkey"; columns: ["closer_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "demos_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "demos_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "demos_sdr_id_fkey"; columns: ["sdr_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      lead_assignments: {
        Row: {
          assigned_by: string
          created_at: string | null
          from_user_id: string | null
          id: string
          lead_id: string
          reason: string | null
          to_user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          to_user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          to_user_id?: string
        }
        Relationships: [
          { foreignKeyName: "lead_assignments_assigned_by_fkey"; columns: ["assigned_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "lead_assignments_from_user_id_fkey"; columns: ["from_user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "lead_assignments_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "lead_assignments_to_user_id_fkey"; columns: ["to_user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      leads: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          callback_date: string | null
          created_at: string | null
          dataset_id: string | null
          deleted_at: string | null
          follow_up_date: string | null
          id: string
          interest_signal: Database["public"]["Enums"]["interest_signal"] | null
          is_deleted: boolean
          lead_type: Database["public"]["Enums"]["lead_type"] | null
          org_id: string
          phase: Database["public"]["Enums"]["lead_phase"]
          recycle_date: string | null
          recycle_reason: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          callback_date?: string | null
          created_at?: string | null
          dataset_id?: string | null
          deleted_at?: string | null
          follow_up_date?: string | null
          id?: string
          interest_signal?: Database["public"]["Enums"]["interest_signal"] | null
          is_deleted?: boolean
          lead_type?: Database["public"]["Enums"]["lead_type"] | null
          org_id: string
          phase?: Database["public"]["Enums"]["lead_phase"]
          recycle_date?: string | null
          recycle_reason?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          callback_date?: string | null
          created_at?: string | null
          dataset_id?: string | null
          deleted_at?: string | null
          follow_up_date?: string | null
          id?: string
          interest_signal?: Database["public"]["Enums"]["interest_signal"] | null
          is_deleted?: boolean
          lead_type?: Database["public"]["Enums"]["lead_type"] | null
          org_id?: string
          phase?: Database["public"]["Enums"]["lead_phase"]
          recycle_date?: string | null
          recycle_reason?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "leads_assigned_by_fkey"; columns: ["assigned_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_dataset_id_fkey"; columns: ["dataset_id"]; isOneToOne: false; referencedRelation: "datasets"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      organizations: {
        Row: {
          age_years: number | null
          annual_revenue: number | null
          created_at: string | null
          dataset_id: string | null
          icp_verified: boolean | null
          id: string
          linkedin_url: string | null
          location: string | null
          name: string
          sql_score: number | null
          sql_score_label: string | null
          team_size: number | null
          thematic_areas: string[] | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          age_years?: number | null
          annual_revenue?: number | null
          created_at?: string | null
          dataset_id?: string | null
          icp_verified?: boolean | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name: string
          sql_score?: number | null
          sql_score_label?: string | null
          team_size?: number | null
          thematic_areas?: string[] | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          age_years?: number | null
          annual_revenue?: number | null
          created_at?: string | null
          dataset_id?: string | null
          icp_verified?: boolean | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name?: string
          sql_score?: number | null
          sql_score_label?: string | null
          team_size?: number | null
          thematic_areas?: string[] | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          { foreignKeyName: "organizations_dataset_id_fkey"; columns: ["dataset_id"]; isOneToOne: false; referencedRelation: "datasets"; referencedColumns: ["id"] },
        ]
      }
      salary_targets: {
        Row: {
          demo_target: number
          id: string
          locked_at: string | null
          locked_by: string | null
          month: number
          revenue_target: number
          salary: number
          user_id: string
          year: number
        }
        Insert: {
          demo_target?: number
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          month: number
          revenue_target?: number
          salary: number
          user_id: string
          year: number
        }
        Update: {
          demo_target?: number
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          month?: number
          revenue_target?: number
          salary?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          { foreignKeyName: "salary_targets_locked_by_fkey"; columns: ["locked_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "salary_targets_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          calendar_link: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          monthly_demo_target: number | null
          monthly_revenue_target: number | null
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          auth_id?: string | null
          calendar_link?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          monthly_demo_target?: number | null
          monthly_revenue_target?: number | null
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          auth_id?: string | null
          calendar_link?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          monthly_demo_target?: number | null
          monthly_revenue_target?: number | null
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org_id: { Args: never; Returns: string }
      get_user_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      activity_type: "call" | "email" | "linkedin" | "whatsapp" | "note" | "status_change" | "assignment" | "demo_booked" | "follow_up" | "dataset_rating"
      dataset_source: "NGOverse" | "LinkedIn" | "Manual" | "Referral" | "Other"
      deal_stage: "demo_scheduled" | "demo_done" | "unqualified" | "proposal_sent" | "follow_up" | "negotiation" | "won" | "lost" | "ghosted" | "invoice_sent" | "converted"
      demo_status: "scheduled" | "attended" | "no_show" | "rescheduled" | "cancelled"
      interest_signal: "hot" | "warm" | "cold" | "dead"
      invoice_status: "not_generated" | "sent" | "paid" | "overdue"
      lead_phase: "sdr" | "closer" | "recycled" | "converted" | "dead"
      lead_status: "new" | "assigned" | "contacted" | "call_again" | "hot" | "demo_booked" | "not_interested" | "not_reachable" | "recycled" | "demo_done" | "proposal_sent" | "follow_up" | "negotiation" | "won" | "lost" | "ghosted" | "converted" | "no_show"
      lead_type: "Inbound" | "Outbound" | "Referral"
      user_role: "admin" | "sdr" | "closer" | "sales_ops"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

// Convenience type aliases — used throughout the app
export type LeadStatus = Database["public"]["Enums"]["lead_status"]
export type LeadPhase = Database["public"]["Enums"]["lead_phase"]
export type InterestSignal = Database["public"]["Enums"]["interest_signal"]
export type ActivityType = Database["public"]["Enums"]["activity_type"]
export type DealStage = Database["public"]["Enums"]["deal_stage"]
export type DemoStatus = Database["public"]["Enums"]["demo_status"]
export type UserRole = Database["public"]["Enums"]["user_role"]

// Row types for common tables
export type Lead = Tables<'leads'>
export type Organization = Tables<'organizations'>
export type Dataset = Tables<'datasets'>

export const Constants = {
  public: {
    Enums: {
      activity_type: ["call", "email", "linkedin", "whatsapp", "note", "status_change", "assignment", "demo_booked", "follow_up", "dataset_rating"],
      dataset_source: ["NGOverse", "LinkedIn", "Manual", "Referral", "Other"],
      deal_stage: ["demo_scheduled", "demo_done", "unqualified", "proposal_sent", "follow_up", "negotiation", "won", "lost", "ghosted", "invoice_sent", "converted"],
      demo_status: ["scheduled", "attended", "no_show", "rescheduled", "cancelled"],
      interest_signal: ["hot", "warm", "cold", "dead"],
      invoice_status: ["not_generated", "sent", "paid", "overdue"],
      lead_phase: ["sdr", "closer", "recycled", "converted", "dead"],
      lead_status: ["new", "assigned", "contacted", "call_again", "hot", "demo_booked", "not_interested", "not_reachable", "recycled", "demo_done", "proposal_sent", "follow_up", "negotiation", "won", "lost", "ghosted", "converted", "no_show"],
      lead_type: ["Inbound", "Outbound", "Referral"],
      user_role: ["admin", "sdr", "closer", "sales_ops"],
    },
  },
} as const
