// Auto-generated Supabase types for BillSplitter
// Re-generate after schema changes:
//   npx supabase gen types typescript --project-id jyyuafqdyhixtzazevew > src/types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:                  string;
          full_name:           string | null;
          avatar_url:          string | null;
          venmo_handle:        string | null;
          cashapp_handle:      string | null;
          zelle_handle:        string | null;
          default_currency:    string;
          show_email:          boolean;
          show_activity:       boolean;
          created_at:          string;
          stripe_customer_id:  string | null;
          subscription_status: string | null;
          is_pro:              boolean;
          price_id:            string | null;
        };
        Insert: {
          id:                   string;
          full_name?:           string | null;
          avatar_url?:          string | null;
          venmo_handle?:        string | null;
          cashapp_handle?:      string | null;
          zelle_handle?:        string | null;
          default_currency?:    string;
          show_email?:          boolean;
          show_activity?:       boolean;
          created_at?:          string;
          stripe_customer_id?:  string | null;
          subscription_status?: string | null;
          is_pro?:              boolean;
          price_id?:            string | null;
        };
        Update: {
          full_name?:           string | null;
          avatar_url?:          string | null;
          venmo_handle?:        string | null;
          cashapp_handle?:      string | null;
          zelle_handle?:        string | null;
          default_currency?:    string;
          show_email?:          boolean;
          show_activity?:       boolean;
          stripe_customer_id?:  string | null;
          subscription_status?: string | null;
          is_pro?:              boolean;
          price_id?:            string | null;
        };
        Relationships: [];
      };

      groups: {
        Row: {
          id:         string;
          name:       string;
          owner_id:   string | null;
          join_code:  string;
          created_at: string;
        };
        Insert: {
          id?:        string;
          name:       string;
          owner_id?:  string | null;
          join_code?: string;
          created_at?: string;
        };
        Update: {
          name?:      string;
          owner_id?:  string | null;
          join_code?: string;
        };
        Relationships: [];
      };

      members: {
        Row: {
          id:         string;
          group_id:   string;
          user_id:    string;
          role:       'admin' | 'editor' | 'viewer';
          created_at: string;
        };
        Insert: {
          id?:        string;
          group_id:   string;
          user_id:    string;
          role?:      'admin' | 'editor' | 'viewer';
          created_at?: string;
        };
        Update: {
          role?: 'admin' | 'editor' | 'viewer';
        };
        Relationships: [
          {
            foreignKeyName: "members_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      group_members: {
        Row:    { group_id: string; user_id: string };
        Insert: { group_id: string; user_id: string };
        Update: { group_id?: string; user_id?: string };
        Relationships: [];
      };

      named_participants: {
        Row: {
          id:         string;
          group_id:   string;
          name:       string;
          created_at: string;
        };
        Insert: {
          id?:        string;
          group_id:   string;
          name:       string;
          created_at?: string;
        };
        Update: { name?: string };
        Relationships: [];
      };

      expenses: {
        Row: {
          id:                   string;
          group_id:             string | null;
          description:          string;
          total_amount:         number;
          payer_id:             string | null;
          payer_participant_id: string | null;
          metadata:             Json;
          created_at:           string;
        };
        Insert: {
          id?:                   string;
          group_id?:             string | null;
          description:           string;
          total_amount:          number;
          payer_id?:             string | null;
          payer_participant_id?: string | null;
          metadata?:             Json;
          created_at?:           string;
        };
        Update: {
          description?:          string;
          total_amount?:         number;
          payer_participant_id?: string | null;
          metadata?:             Json;
        };
        Relationships: [];
      };

      splits: {
        Row: {
          id:             string;
          expense_id:     string | null;
          user_id:        string | null;
          participant_id: string | null;
          amount_owed:    number;
          paid_amount:    number;
          is_paid:        boolean | null;
        };
        Insert: {
          id?:             string;
          expense_id?:     string | null;
          user_id?:        string | null;
          participant_id?: string | null;
          amount_owed:     number;
          paid_amount?:    number;
          is_paid?:        boolean | null;
        };
        Update: {
          participant_id?: string | null;
          amount_owed?:    number;
          paid_amount?:    number;
          is_paid?:        boolean | null;
        };
        Relationships: [];
      };

      activity_logs: {
        Row: {
          id:             string;
          group_id:       string;
          user_id:        string | null;
          actor_id:       string | null;
          target_id:      string | null;
          expense_id:     string | null;
          participant_id: string | null;
          amount:         number | null;
          action_type:    string | null;
          is_settled:     boolean | null;
          message:        string;
          created_at:     string;
        };
        Insert: {
          id?:             string;
          group_id:        string;
          user_id?:        string | null;
          actor_id?:       string | null;
          target_id?:      string | null;
          expense_id?:     string | null;
          participant_id?: string | null;
          amount?:         number | null;
          action_type?:    string | null;
          is_settled?:     boolean | null;
          message:         string;
          created_at?:     string;
        };
        Update: {
          message?:        string;
          action_type?:    string | null;
          amount?:         number | null;
          is_settled?:     boolean | null;
        };
        Relationships: [];
      };
    };

    Views: { [_ in never]: never };

    Functions: {
      create_group: {
        Args:    { p_name: string };
        Returns: { id: string; name: string; join_code: string }[];
      };
      join_group_by_code: {
        Args:    { code: string };
        Returns: string; // uuid of the group
      };
      add_expense_with_splits: {
        Args: {
          p_group_id:             string;
          p_description:          string;
          p_total_amount:         number;
          p_payer_participant_id: string;
          p_splits:               Json;
          p_metadata?:            Json;
        };
        Returns: string;
      };
      calculate_balances: {
        Args:    { p_group_id: string };
        Returns: { debtor: string; creditor: string; amount: number }[];
      };
      log_activity: {
        Args: {
          p_group_id:        string;
          p_message:         string;
          p_action_type?:    string | null;
          p_expense_id?:     string | null;
          p_target_id?:      string | null;
          p_amount?:         number | null;
          p_participant_id?: string | null;
          p_is_settled?:     boolean | null;
        };
        Returns: void;
      };
      is_group_member: {
        Args:    { p_group_id: string };
        Returns: boolean;
      };
      get_member_role: {
        Args:    { p_group_id: string };
        Returns: 'admin' | 'editor' | 'viewer' | null;
      };
      update_member_role: {
        Args:    { p_group_id: string; p_target_user_id: string; p_new_role: 'admin' | 'editor' | 'viewer' };
        Returns: void;
      };
      leave_group: {
        Args:    { p_group_id: string };
        Returns: void;
      };
      delete_group_permanently: {
        Args:    { p_group_id: string };
        Returns: void;
      };
      delete_own_account: {
        Args:    Record<string, never>;
        Returns: void;
      };
    };

    Enums:          { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

// ─── Convenience row types ────────────────────────────────────────────────────

export type Profile          = Database["public"]["Tables"]["profiles"]["Row"];
export type Group            = Database["public"]["Tables"]["groups"]["Row"];
export type Member           = Database["public"]["Tables"]["members"]["Row"];
export type NamedParticipant = Database["public"]["Tables"]["named_participants"]["Row"];
export type DbExpense        = Database["public"]["Tables"]["expenses"]["Row"];
export type DbSplit          = Database["public"]["Tables"]["splits"]["Row"];

export type GroupInsert            = Database["public"]["Tables"]["groups"]["Insert"];
export type MemberInsert           = Database["public"]["Tables"]["members"]["Insert"];
export type NamedParticipantInsert = Database["public"]["Tables"]["named_participants"]["Insert"];
export type ExpenseInsert          = Database["public"]["Tables"]["expenses"]["Insert"];
export type SplitInsert            = Database["public"]["Tables"]["splits"]["Insert"];
