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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emergency_alerts: {
        Row: {
          ended_at: string | null
          hidden_by_guardian: boolean
          hidden_by_owner: boolean
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
          hidden_by_guardian?: boolean
          hidden_by_owner?: boolean
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
          hidden_by_guardian?: boolean
          hidden_by_owner?: boolean
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
          false_alarm_count: number
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
          false_alarm_count?: number
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
          false_alarm_count?: number
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          safety_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
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
      sos_attempts: {
        Row: {
          alert_id: string | null
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          alert_id?: string | null
          created_at?: string
          id?: string
          status: string
          user_id: string
        }
        Update: {
          alert_id?: string | null
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          language: string
          last_sos_at: string | null
          notifications: boolean
          notify_battery: boolean
          notify_fall: boolean
          notify_sos: boolean
          notify_zone: boolean
          quiet_hours: boolean
          share_location: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          language?: string
          last_sos_at?: string | null
          notifications?: boolean
          notify_battery?: boolean
          notify_fall?: boolean
          notify_sos?: boolean
          notify_zone?: boolean
          quiet_hours?: boolean
          share_location?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          language?: string
          last_sos_at?: string | null
          notifications?: boolean
          notify_battery?: boolean
          notify_fall?: boolean
          notify_sos?: boolean
          notify_zone?: boolean
          quiet_hours?: boolean
          share_location?: boolean
          theme?: string
          updated_at?: string
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      guardian_add_alert_note: {
        Args: { _alert_id: string; _note: string }
        Returns: undefined
      }
      hide_alert_for_guardian: {
        Args: { _alert_id: string }
        Returns: undefined
      }
      hide_all_alerts_for_guardian: {
        Args: { _user_id: string }
        Returns: undefined
      }
      is_guardian_of: {
        Args: { _guardian: string; _user: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
