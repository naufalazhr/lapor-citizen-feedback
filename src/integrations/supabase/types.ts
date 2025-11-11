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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          performed_by: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_report"
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flowise_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fonnte_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      login_config: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          login_title: string
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          login_title?: string
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          login_title?: string
          logo_url?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opds: {
        Row: {
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          description: string | null
          head_name: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          head_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          head_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          conversation_id: string | null
          created_at: string
          duration_ms: number
          id: string
          metadata: Json | null
          metric_type: string
          tenant_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          duration_ms: number
          id?: string
          metadata?: Json | null
          metric_type: string
          tenant_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number
          id?: string
          metadata?: Json | null
          metric_type?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_metrics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "active_conversations_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_metrics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_internal: boolean
          report_id: string
          tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_internal?: boolean
          report_id: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          report_id?: string
          tenant_id?: string | null
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
          {
            foreignKeyName: "report_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_dispositions: {
        Row: {
          action_type: string
          assigned_at: string
          assigned_by: string
          id: string
          notes: string | null
          opd_id: string
          previous_opd_id: string | null
          report_id: string
          status_after: string | null
          status_before: string | null
          tenant_id: string
        }
        Insert: {
          action_type?: string
          assigned_at?: string
          assigned_by: string
          id?: string
          notes?: string | null
          opd_id: string
          previous_opd_id?: string | null
          report_id: string
          status_after?: string | null
          status_before?: string | null
          tenant_id: string
        }
        Update: {
          action_type?: string
          assigned_at?: string
          assigned_by?: string
          id?: string
          notes?: string | null
          opd_id?: string
          previous_opd_id?: string | null
          report_id?: string
          status_after?: string | null
          status_before?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_dispositions_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: false
            referencedRelation: "opds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_dispositions_previous_opd_id_fkey"
            columns: ["previous_opd_id"]
            isOneToOne: false
            referencedRelation: "opds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_dispositions_report_id_fkey"
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
          assigned_opd_id: string | null
          created_at: string
          description: string
          disposition_notes: string | null
          geo_location: Json | null
          id: string
          phone: string
          photo_url: string | null
          reporter_name: string
          session_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          tenant_id: string | null
          ticket_id: string | null
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
        }
        Insert: {
          address: string
          assigned_opd_id?: string | null
          created_at?: string
          description: string
          disposition_notes?: string | null
          geo_location?: Json | null
          id?: string
          phone: string
          photo_url?: string | null
          reporter_name: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          tenant_id?: string | null
          ticket_id?: string | null
          type: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Update: {
          address?: string
          assigned_opd_id?: string | null
          created_at?: string
          description?: string
          disposition_notes?: string | null
          geo_location?: Json | null
          id?: string
          phone?: string
          photo_url?: string | null
          reporter_name?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          tenant_id?: string | null
          ticket_id?: string | null
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_opd_id_fkey"
            columns: ["assigned_opd_id"]
            isOneToOne: false
            referencedRelation: "opds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activated_at: string | null
          cancelled_at: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          domain: string | null
          id: string
          logo_url: string | null
          metadata: Json | null
          name: string
          slug: string
          status: string
          subscription_tier: string | null
          suspended_at: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          cancelled_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          name: string
          slug: string
          status?: string
          subscription_tier?: string | null
          suspended_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          cancelled_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          slug?: string
          status?: string
          subscription_tier?: string | null
          suspended_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_opd_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          is_active: boolean
          opd_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_active?: boolean
          opd_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_active?: boolean
          opd_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_opd_assignments_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: false
            referencedRelation: "opds"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "webhook_errors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      cleanup_conversation_status: {
        Args: never
        Returns: {
          total_updated: number
          updated_abandoned: number
          updated_completed: number
        }[]
      }
      cleanup_old_performance_metrics: { Args: never; Returns: number }
      generate_ticket_id: { Args: never; Returns: string }
      get_performance_stats: {
        Args: {
          p_metric_type?: string
          p_tenant_id?: string
          p_time_range?: unknown
        }
        Returns: {
          avg_duration: number
          error_count: number
          max_duration: number
          min_duration: number
          p50: number
          p90: number
          p95: number
          p99: number
          total_requests: number
        }[]
      }
      get_performance_trends: {
        Args: {
          p_bucket_interval?: string
          p_metric_type?: string
          p_tenant_id?: string
          p_time_range?: unknown
        }
        Returns: {
          avg_duration: number
          p50: number
          p95: number
          request_count: number
          time_bucket: string
        }[]
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
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
      app_role:
        | "owner"
        | "admin"
        | "member"
        | "viewer"
        | "superadmin"
        | "opd_member"
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
      app_role: [
        "owner",
        "admin",
        "member",
        "viewer",
        "superadmin",
        "opd_member",
      ],
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
