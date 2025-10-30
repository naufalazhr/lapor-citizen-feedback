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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_field_configs: {
        Row: {
          created_at: string
          default_value: Json | null
          description: string | null
          field_name: string
          field_type: string
          id: string
          is_required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_value?: Json | null
          description?: string | null
          field_name: string
          field_type: string
          id?: string
          is_required?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_value?: Json | null
          description?: string | null
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_name: string
          key_prefix: string
          last_used_at: string | null
          notes: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_name: string
          key_prefix: string
          last_used_at?: string | null
          notes?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_name?: string
          key_prefix?: string
          last_used_at?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      attachments: {
        Row: {
          base64_data: string | null
          created_at: string
          download_status: string
          error_message: string | null
          extension: string
          file_size: number | null
          filename: string
          id: string
          message_id: string
          mime_type: string
          original_url: string
          processed_at: string | null
          storage_path: string | null
          storage_url: string | null
          updated_at: string
          upload_status: string
        }
        Insert: {
          base64_data?: string | null
          created_at?: string
          download_status?: string
          error_message?: string | null
          extension: string
          file_size?: number | null
          filename: string
          id?: string
          message_id: string
          mime_type: string
          original_url: string
          processed_at?: string | null
          storage_path?: string | null
          storage_url?: string | null
          updated_at?: string
          upload_status?: string
        }
        Update: {
          base64_data?: string | null
          created_at?: string
          download_status?: string
          error_message?: string | null
          extension?: string
          file_size?: number | null
          filename?: string
          id?: string
          message_id?: string
          mime_type?: string
          original_url?: string
          processed_at?: string | null
          storage_path?: string | null
          storage_url?: string | null
          updated_at?: string
          upload_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          completed_at: string | null
          created_at: string
          device_number: string | null
          id: string
          last_message_at: string
          phone_number: string
          report_id: string | null
          sender_name: string | null
          session_id: string
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"]
          completed_at?: string | null
          created_at?: string
          device_number?: string | null
          id?: string
          last_message_at?: string
          phone_number: string
          report_id?: string | null
          sender_name?: string | null
          session_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          completed_at?: string | null
          created_at?: string
          device_number?: string | null
          id?: string
          last_message_at?: string
          phone_number?: string
          report_id?: string | null
          sender_name?: string | null
          session_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      flowise_config: {
        Row: {
          api_key: string
          api_url: string
          chatflow_id: string
          config_name: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          session_variables: Json | null
          streaming: boolean
          timeout_seconds: number
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          chatflow_id: string
          config_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          session_variables?: Json | null
          streaming?: boolean
          timeout_seconds?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          chatflow_id?: string
          config_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          session_variables?: Json | null
          streaming?: boolean
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      fonnte_config: {
        Row: {
          api_token: string | null
          auto_reply_enabled: boolean
          config_name: string
          created_at: string
          created_by: string | null
          device_numbers: string[]
          id: string
          is_active: boolean
          session_timeout_minutes: number
          updated_at: string
        }
        Insert: {
          api_token?: string | null
          auto_reply_enabled?: boolean
          config_name?: string
          created_at?: string
          created_by?: string | null
          device_numbers?: string[]
          id?: string
          is_active?: boolean
          session_timeout_minutes?: number
          updated_at?: string
        }
        Update: {
          api_token?: string | null
          auto_reply_enabled?: boolean
          config_name?: string
          created_at?: string
          created_by?: string | null
          device_numbers?: string[]
          id?: string
          is_active?: boolean
          session_timeout_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_filename: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          has_attachment: boolean
          id: string
          message_index: number
          role: Database["public"]["Enums"]["message_role"]
          token_count: number | null
        }
        Insert: {
          attachment_filename?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          has_attachment?: boolean
          id?: string
          message_index: number
          role: Database["public"]["Enums"]["message_role"]
          token_count?: number | null
        }
        Update: {
          attachment_filename?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          has_attachment?: boolean
          id?: string
          message_index?: number
          role?: Database["public"]["Enums"]["message_role"]
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "active_conversations_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          organization: string | null
          position: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          organization?: string | null
          position?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          organization?: string | null
          position?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_internal: boolean
          report_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_internal?: boolean
          report_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          report_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          address: string
          created_at: string
          description: string
          geo_location: Json | null
          id: string
          phone: string
          photo_url: string | null
          reporter_name: string
          status: Database["public"]["Enums"]["report_status"]
          ticket_id: string | null
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          description: string
          geo_location?: Json | null
          id?: string
          phone: string
          photo_url?: string | null
          reporter_name: string
          status?: Database["public"]["Enums"]["report_status"]
          ticket_id?: string | null
          type: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          description?: string
          geo_location?: Json | null
          id?: string
          phone?: string
          photo_url?: string | null
          reporter_name?: string
          status?: Database["public"]["Enums"]["report_status"]
          ticket_id?: string | null
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Relationships: []
      }
      user_approvals: {
        Row: {
          created_at: string
          department: string | null
          id: string
          organization: string | null
          position: string | null
          rejection_reason: string | null
          requested_at: string
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          organization?: string | null
          position?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          organization?: string | null
          position?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_errors: {
        Row: {
          conversation_id: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          payload: Json | null
          source: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          payload?: Json | null
          source: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          payload?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_errors_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "active_conversations_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_errors_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_conversations_summary: {
        Row: {
          id: string | null
          last_message_at: string | null
          message_count: number | null
          phone_number: string | null
          report_status: Database["public"]["Enums"]["report_status"] | null
          report_type: Database["public"]["Enums"]["report_type"] | null
          sender_name: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: Json
      }
      generate_ticket_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agent_status: "draft" | "published" | "archived"
      app_role: "owner" | "admin" | "member" | "viewer"
      channel_type: "web" | "api" | "whatsapp" | "telegram"
      field_type:
        | "string"
        | "number"
        | "boolean"
        | "enum"
        | "email"
        | "phone"
        | "image"
        | "geo"
        | "date"
        | "multiline"
        | "url"
      message_role: "user" | "assistant" | "system"
      report_status: "pending" | "in_progress" | "resolved" | "rejected"
      report_type: "lapor" | "aspirasi"
      session_status: "active" | "completed" | "abandoned"
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
      agent_status: ["draft", "published", "archived"],
      app_role: ["owner", "admin", "member", "viewer"],
      channel_type: ["web", "api", "whatsapp", "telegram"],
      field_type: [
        "string",
        "number",
        "boolean",
        "enum",
        "email",
        "phone",
        "image",
        "geo",
        "date",
        "multiline",
        "url",
      ],
      message_role: ["user", "assistant", "system"],
      report_status: ["pending", "in_progress", "resolved", "rejected"],
      report_type: ["lapor", "aspirasi"],
      session_status: ["active", "completed", "abandoned"],
    },
  },
} as const
