export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string | null
          actor_id: string | null
          amount: number | null
          created_at: string
          expense_id: string | null
          group_id: string
          id: string
          is_settled: boolean | null
          message: string
          participant_id: string | null
          target_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          actor_id?: string | null
          amount?: number | null
          created_at?: string
          expense_id?: string | null
          group_id: string
          id?: string
          is_settled?: boolean | null
          message: string
          participant_id?: string | null
          target_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          actor_id?: string | null
          amount?: number | null
          created_at?: string
          expense_id?: string | null
          group_id?: string
          id?: string
          is_settled?: boolean | null
          message?: string
          participant_id?: string | null
          target_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "named_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_rates: {
        Row: {
          base_code: string
          id: string
          last_updated_at: string
          next_update_at_utc: string
          previous_rates: Json | null
          rates: Json
        }
        Insert: {
          base_code: string
          id?: string
          last_updated_at?: string
          next_update_at_utc: string
          previous_rates?: Json | null
          rates: Json
        }
        Update: {
          base_code?: string
          id?: string
          last_updated_at?: string
          next_update_at_utc?: string
          previous_rates?: Json | null
          rates?: Json
        }
        Relationships: []
      }
      expenses: {
        Row: {
          created_at: string | null
          description: string
          group_id: string | null
          id: string
          metadata: Json
          payer_id: string | null
          payer_participant_id: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string | null
          description: string
          group_id?: string | null
          id?: string
          metadata?: Json
          payer_id?: string | null
          payer_participant_id?: string | null
          total_amount: number
        }
        Update: {
          created_at?: string | null
          description?: string
          group_id?: string | null
          id?: string
          metadata?: Json
          payer_id?: string | null
          payer_participant_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payer_participant_id_fkey"
            columns: ["payer_participant_id"]
            isOneToOne: false
            referencedRelation: "named_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          email: string | null
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          user_id: string
        }
        Insert: {
          group_id: string
          user_id: string
        }
        Update: {
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          default_tax_rate: number | null
          id: string
          join_code: string
          name: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string | null
          default_tax_rate?: number | null
          id?: string
          join_code?: string
          name: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string | null
          default_tax_rate?: number | null
          id?: string
          join_code?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      named_participants: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "named_participants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cashapp_handle: string | null
          created_at: string | null
          default_currency: string
          default_tax_rate: number
          full_name: string | null
          id: string
          is_pro: boolean
          language_preference: string | null
          price_id: string | null
          show_activity: boolean
          show_email: boolean
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: number
          venmo_handle: string | null
          zelle_handle: string | null
        }
        Insert: {
          avatar_url?: string | null
          cashapp_handle?: string | null
          created_at?: string | null
          default_currency?: string
          default_tax_rate?: number
          full_name?: string | null
          id: string
          is_pro?: boolean
          language_preference?: string | null
          price_id?: string | null
          show_activity?: boolean
          show_email?: boolean
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: number
          venmo_handle?: string | null
          zelle_handle?: string | null
        }
        Update: {
          avatar_url?: string | null
          cashapp_handle?: string | null
          created_at?: string | null
          default_currency?: string
          default_tax_rate?: number
          full_name?: string | null
          id?: string
          is_pro?: boolean
          language_preference?: string | null
          price_id?: string | null
          show_activity?: boolean
          show_email?: boolean
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: number
          venmo_handle?: string | null
          zelle_handle?: string | null
        }
        Relationships: []
      }
      splits: {
        Row: {
          amount_owed: number
          expense_id: string | null
          id: string
          is_paid: boolean | null
          paid_amount: number
          participant_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_owed: number
          expense_id?: string | null
          id?: string
          is_paid?: boolean | null
          paid_amount?: number
          participant_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_owed?: number
          expense_id?: string | null
          id?: string
          is_paid?: boolean | null
          paid_amount?: number
          participant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splits_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "named_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_expense_with_splits:
        | {
            Args: {
              p_description: string
              p_group_id: string
              p_payer_id: string
              p_splits: Json
              p_total_amount: number
            }
            Returns: string
          }
        | {
            Args: {
              p_description: string
              p_group_id: string
              p_metadata?: Json
              p_payer_participant_id: string
              p_splits: Json
              p_total_amount: number
            }
            Returns: string
          }
      calculate_balances: {
        Args: { p_group_id: string }
        Returns: {
          amount: number
          creditor: string
          debtor: string
        }[]
      }
      create_group: {
        Args: { p_name: string }
        Returns: {
          id: string
          join_code: string
          name: string
        }[]
      }
      delete_group_permanently: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      delete_own_account: { Args: never; Returns: undefined }
      generate_join_code: { Args: never; Returns: string }
      get_member_role: { Args: { p_group_id: string }; Returns: string }
      get_vault_secret: { Args: { secret_name: string }; Returns: string }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      join_group_by_code: { Args: { code: string }; Returns: string }
      leave_group: { Args: { p_group_id: string }; Returns: undefined }
      log_activity:
        | {
            Args: { p_group_id: string; p_message: string }
            Returns: undefined
          }
        | {
            Args: {
              p_action_type?: string
              p_amount?: number
              p_expense_id?: string
              p_group_id: string
              p_message: string
              p_target_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_action_type?: string
              p_amount?: number
              p_expense_id?: string
              p_group_id: string
              p_message: string
              p_participant_id?: string
              p_target_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_action_type?: string
              p_amount?: number
              p_expense_id?: string
              p_group_id: string
              p_is_settled?: boolean
              p_message: string
              p_participant_id?: string
              p_target_id?: string
            }
            Returns: undefined
          }
      update_member_role: {
        Args: {
          p_group_id: string
          p_new_role: string
          p_target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
