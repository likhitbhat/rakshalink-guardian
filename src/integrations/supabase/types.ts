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
      devices: {
        Row: {
          battery: number
          created_at: string
          firmware: string | null
          id: string
          last_seen: string | null
          mac: string | null
          name: string
          paired: boolean
          signal: number
          user_id: string
        }
        Insert: {
          battery?: number
          created_at?: string
          firmware?: string | null
          id?: string
          last_seen?: string | null
          mac?: string | null
          name?: string
          paired?: boolean
          signal?: number
          user_id: string
        }
        Update: {
          battery?: number
          created_at?: string
          firmware?: string | null
          id?: string
          last_seen?: string | null
          mac?: string | null
          name?: string
          paired?: boolean
          signal?: number
          user_id?: string
        }
        Relationships: []
      }
      emergency_alerts: {
        Row: {
          ended_at: string | null
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          started_at: string
          status: Database["public"]["Enums"]["alert_status"]
          type: Database["public"]["Enums"]["alert_type"]
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["alert_status"]
          type?: Database["public"]["Enums"]["alert_type"]
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["alert_status"]
          type?: Database["public"]["Enums"]["alert_type"]
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string
          relation: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone: string
          relation?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          relation?: string | null
          user_id?: string
        }
        Relationships: []
      }
      guardian_links: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          label: string | null
          status: Database["public"]["Enums"]["link_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          label?: string | null
          status?: Database["public"]["Enums"]["link_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          label?: string | null
          status?: Database["public"]["Enums"]["link_status"]
          user_id?: string
        }
        Relationships: []
      }
      live_locations: {
        Row: {
          battery: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          battery?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          battery?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          safety_score: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          safety_score?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          safety_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      safe_zones: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          notify_enter: boolean
          notify_exit: boolean
          radius_m: number
          type: Database["public"]["Enums"]["zone_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          notify_enter?: boolean
          notify_exit?: boolean
          radius_m?: number
          type?: Database["public"]["Enums"]["zone_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          notify_enter?: boolean
          notify_exit?: boolean
          radius_m?: number
          type?: Database["public"]["Enums"]["zone_type"]
          user_id?: string
        }
        Relationships: []
      }
      zone_events: {
        Row: {
          created_at: string
          event: Database["public"]["Enums"]["zone_event_type"]
          id: string
          lat: number | null
          lng: number | null
          user_id: string
          zone_id: string | null
          zone_name: string
        }
        Insert: {
          created_at?: string
          event: Database["public"]["Enums"]["zone_event_type"]
          id?: string
          lat?: number | null
          lng?: number | null
          user_id: string
          zone_id?: string | null
          zone_name: string
        }
        Update: {
          created_at?: string
          event?: Database["public"]["Enums"]["zone_event_type"]
          id?: string
          lat?: number | null
          lng?: number | null
          user_id?: string
          zone_id?: string | null
          zone_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_guardian_of: {
        Args: { _guardian: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      alert_status: "active" | "resolved" | "cancelled"
      alert_type: "sos" | "fall" | "voice" | "deadman" | "manual"
      app_role: "user" | "guardian"
      link_status: "pending" | "active" | "revoked"
      zone_event_type: "enter" | "exit"
      zone_type: "home" | "school" | "work" | "custom"
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
    Enums: {
      alert_status: ["active", "resolved", "cancelled"],
      alert_type: ["sos", "fall", "voice", "deadman", "manual"],
      app_role: ["user", "guardian"],
      link_status: ["pending", "active", "revoked"],
      zone_event_type: ["enter", "exit"],
      zone_type: ["home", "school", "work", "custom"],
    },
  },
} as const
