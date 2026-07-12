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
      assistant_actions: {
        Row: {
          action_type: string
          clarification_state: Json | null
          confirmed_at: string | null
          created_at: string
          executed_at: string | null
          executed_payload: Json | null
          expires_at: string | null
          id: string
          idempotency_key: string
          proposed_payload: Json
          rejected_at: string | null
          source_message_id: string | null
          status: string
          thread_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          clarification_state?: Json | null
          confirmed_at?: string | null
          created_at?: string
          executed_at?: string | null
          executed_payload?: Json | null
          expires_at?: string | null
          id?: string
          idempotency_key: string
          proposed_payload: Json
          rejected_at?: string | null
          source_message_id?: string | null
          status: string
          thread_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          clarification_state?: Json | null
          confirmed_at?: string | null
          created_at?: string
          executed_at?: string | null
          executed_payload?: Json | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          proposed_payload?: Json
          rejected_at?: string | null
          source_message_id?: string | null
          status?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_actions_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "assistant_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_actions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string
          role: string
          structured_payload: Json | null
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_type?: string
          role: string
          structured_payload?: Json | null
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          role?: string
          structured_payload?: Json | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      availability_rules: {
        Row: {
          available_end: string
          available_start: string
          created_at: string
          day_of_week: number
          id: string
          is_enabled: boolean
          maximum_focus_minutes: number | null
          preferred_block_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_end: string
          available_start: string
          created_at?: string
          day_of_week: number
          id?: string
          is_enabled?: boolean
          maximum_focus_minutes?: number | null
          preferred_block_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_end?: string
          available_start?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_enabled?: boolean
          maximum_focus_minutes?: number | null
          preferred_block_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendars: {
        Row: {
          connection_id: string | null
          created_at: string
          external_calendar_id: string | null
          id: string
          is_visible: boolean
          is_writable: boolean
          name: string
          source: string
          sync_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          external_calendar_id?: string | null
          id?: string
          is_visible?: boolean
          is_writable?: boolean
          name: string
          source: string
          sync_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          external_calendar_id?: string | null
          id?: string
          is_visible?: boolean
          is_writable?: boolean
          name?: string
          source?: string
          sync_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendars_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string
          credentials_version: number
          display_name: string | null
          encrypted_credentials: string | null
          external_home_account_id: string | null
          external_tenant_id: string | null
          id: string
          last_error: string | null
          last_successful_sync: string | null
          last_sync_attempt: string | null
          last_sync_trigger: string | null
          provider: string
          requires_reauthentication: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials_version?: number
          display_name?: string | null
          encrypted_credentials?: string | null
          external_home_account_id?: string | null
          external_tenant_id?: string | null
          id?: string
          last_error?: string | null
          last_successful_sync?: string | null
          last_sync_attempt?: string | null
          last_sync_trigger?: string | null
          provider: string
          requires_reauthentication?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials_version?: number
          display_name?: string | null
          encrypted_credentials?: string | null
          external_home_account_id?: string | null
          external_tenant_id?: string | null
          id?: string
          last_error?: string | null
          last_successful_sync?: string | null
          last_sync_attempt?: string | null
          last_sync_trigger?: string | null
          provider?: string
          requires_reauthentication?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          assistant_action_id: string | null
          blocks_time: boolean
          calendar_id: string
          content_hash: string | null
          created_at: string
          created_by_assistant: boolean
          description: string | null
          end_at: string
          event_type: string
          external_change_key: string | null
          external_event_id: string | null
          external_updated_at: string | null
          id: string
          is_read_only: boolean
          location: string | null
          online_meeting_url: string | null
          organizer_name: string | null
          related_task_id: string | null
          sensitivity: string | null
          show_as: string | null
          source: string
          start_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          assistant_action_id?: string | null
          blocks_time?: boolean
          calendar_id: string
          content_hash?: string | null
          created_at?: string
          created_by_assistant?: boolean
          description?: string | null
          end_at: string
          event_type?: string
          external_change_key?: string | null
          external_event_id?: string | null
          external_updated_at?: string | null
          id?: string
          is_read_only?: boolean
          location?: string | null
          online_meeting_url?: string | null
          organizer_name?: string | null
          related_task_id?: string | null
          sensitivity?: string | null
          show_as?: string | null
          source?: string
          start_at: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          assistant_action_id?: string | null
          blocks_time?: boolean
          calendar_id?: string
          content_hash?: string | null
          created_at?: string
          created_by_assistant?: boolean
          description?: string | null
          end_at?: string
          event_type?: string
          external_change_key?: string | null
          external_event_id?: string | null
          external_updated_at?: string | null
          id?: string
          is_read_only?: boolean
          location?: string | null
          online_meeting_url?: string | null
          organizer_name?: string | null
          related_task_id?: string | null
          sensitivity?: string | null
          show_as?: string | null
          source?: string
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_assistant_action_id_fkey"
            columns: ["assistant_action_id"]
            isOneToOne: false
            referencedRelation: "assistant_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          created_at: string
          deduplication_key: string
          failure_count: number
          id: string
          notification_type: string
          payload_summary: Json | null
          period_end: string | null
          period_start: string | null
          safe_error: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subscription_count: number
          success_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deduplication_key: string
          failure_count?: number
          id?: string
          notification_type: string
          payload_summary?: Json | null
          period_end?: string | null
          period_start?: string | null
          safe_error?: string | null
          scheduled_for: string
          sent_at?: string | null
          status: string
          subscription_count?: number
          success_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deduplication_key?: string
          failure_count?: number
          id?: string
          notification_type?: string
          payload_summary?: Json | null
          period_end?: string | null
          period_start?: string | null
          safe_error?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subscription_count?: number
          success_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planning_preferences: {
        Row: {
          auto_create_focus_blocks: boolean
          avoid_difficult_work_after: string | null
          created_at: string
          daily_notification_time: string | null
          daily_notifications_enabled: boolean
          deadline_notifications_enabled: boolean
          deadline_warning_hours: number
          maximum_focus_block_minutes: number
          minimum_break_minutes: number
          notification_privacy_mode: string
          notifications_enabled: boolean
          overload_notifications_enabled: boolean
          planning_buffer_percent: number
          preferred_focus_block_minutes: number
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          travel_buffer_minutes: number
          updated_at: string
          user_id: string
          weekly_notification_day: number
          weekly_notification_time: string | null
          weekly_notifications_enabled: boolean
        }
        Insert: {
          auto_create_focus_blocks?: boolean
          avoid_difficult_work_after?: string | null
          created_at?: string
          daily_notification_time?: string | null
          daily_notifications_enabled?: boolean
          deadline_notifications_enabled?: boolean
          deadline_warning_hours?: number
          maximum_focus_block_minutes?: number
          minimum_break_minutes?: number
          notification_privacy_mode?: string
          notifications_enabled?: boolean
          overload_notifications_enabled?: boolean
          planning_buffer_percent?: number
          preferred_focus_block_minutes?: number
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          travel_buffer_minutes?: number
          updated_at?: string
          user_id: string
          weekly_notification_day?: number
          weekly_notification_time?: string | null
          weekly_notifications_enabled?: boolean
        }
        Update: {
          auto_create_focus_blocks?: boolean
          avoid_difficult_work_after?: string | null
          created_at?: string
          daily_notification_time?: string | null
          daily_notifications_enabled?: boolean
          deadline_notifications_enabled?: boolean
          deadline_warning_hours?: number
          maximum_focus_block_minutes?: number
          minimum_break_minutes?: number
          notification_privacy_mode?: string
          notifications_enabled?: boolean
          overload_notifications_enabled?: boolean
          planning_buffer_percent?: number
          preferred_focus_block_minutes?: number
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          travel_buffer_minutes?: number
          updated_at?: string
          user_id?: string
          weekly_notification_day?: number
          weekly_notification_time?: string | null
          weekly_notifications_enabled?: boolean
        }
        Relationships: []
      }
      planning_proposals: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_event_id: string | null
          explanation: Json
          id: string
          planning_run_id: string
          proposal_hash: string
          proposed_end_at: string
          proposed_minutes: number
          proposed_start_at: string
          rejected_at: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_event_id?: string | null
          explanation: Json
          id?: string
          planning_run_id: string
          proposal_hash: string
          proposed_end_at: string
          proposed_minutes: number
          proposed_start_at: string
          rejected_at?: string | null
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_event_id?: string | null
          explanation?: Json
          id?: string
          planning_run_id?: string
          proposal_hash?: string
          proposed_end_at?: string
          proposed_minutes?: number
          proposed_start_at?: string
          rejected_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_proposals_created_event_id_fkey"
            columns: ["created_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_proposals_planning_run_id_fkey"
            columns: ["planning_run_id"]
            isOneToOne: false
            referencedRelation: "planning_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_proposals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_runs: {
        Row: {
          created_at: string
          id: string
          input_hash: string
          period_end: string
          period_start: string
          status: string
          summary: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_hash: string
          period_end: string
          period_start: string
          status?: string
          summary: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_hash?: string
          period_end?: string
          period_start?: string
          status?: string
          summary?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          content_encoding: string | null
          created_at: string
          device_name: string | null
          endpoint: string
          failure_count: number
          id: string
          is_active: boolean
          last_failed_push: string | null
          last_successful_push: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          content_encoding?: string | null
          created_at?: string
          device_name?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          is_active?: boolean
          last_failed_push?: string | null
          last_successful_push?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          content_encoding?: string | null
          created_at?: string
          device_name?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          is_active?: boolean
          last_failed_push?: string | null
          last_successful_push?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_states: {
        Row: {
          calendar_id: string | null
          connection_id: string
          created_at: string
          feed_hash: string | null
          id: string
          last_full_sync_at: string | null
          last_seen_event_count: number | null
          last_synced_at: string | null
          sync_cursor: string | null
          sync_window_end: string | null
          sync_window_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id?: string | null
          connection_id: string
          created_at?: string
          feed_hash?: string | null
          id?: string
          last_full_sync_at?: string | null
          last_seen_event_count?: number | null
          last_synced_at?: string | null
          sync_cursor?: string | null
          sync_window_end?: string | null
          sync_window_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string | null
          connection_id?: string
          created_at?: string
          feed_hash?: string | null
          id?: string
          last_full_sync_at?: string | null
          last_seen_event_count?: number | null
          last_synced_at?: string | null
          sync_cursor?: string | null
          sync_window_end?: string | null
          sync_window_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_states_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_states_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_minutes: number | null
          cancelled_by_sync: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          difficulty: number
          due_at: string | null
          earliest_start_at: string | null
          estimated_minutes: number | null
          external_task_id: string | null
          id: string
          minimum_block_minutes: number
          priority: number
          related_event_id: string | null
          remaining_minutes: number | null
          source: string
          source_content_hash: string | null
          splittable: boolean
          status: string
          sync_managed: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          cancelled_by_sync?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number
          due_at?: string | null
          earliest_start_at?: string | null
          estimated_minutes?: number | null
          external_task_id?: string | null
          id?: string
          minimum_block_minutes?: number
          priority?: number
          related_event_id?: string | null
          remaining_minutes?: number | null
          source?: string
          source_content_hash?: string | null
          splittable?: boolean
          status?: string
          sync_managed?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          cancelled_by_sync?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number
          due_at?: string | null
          earliest_start_at?: string | null
          estimated_minutes?: number | null
          external_task_id?: string | null
          id?: string
          minimum_block_minutes?: number
          priority?: number
          related_event_id?: string | null
          remaining_minutes?: number | null
          source?: string
          source_content_hash?: string | null
          splittable?: boolean
          status?: string
          sync_managed?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      workload_snapshots: {
        Row: {
          allocated_task_minutes: number
          available_focus_minutes: number
          calculated_at: string
          capacity_ratio: number | null
          created_at: string
          fixed_minutes: number
          id: string
          input_hash: string | null
          overdue_task_count: number
          period_end: string
          period_start: string
          period_type: string
          raw_open_minutes: number
          required_task_minutes: number
          reserved_buffer_minutes: number
          scheduled_focus_minutes: number
          status: string
          summary: Json
          unallocated_task_minutes: number
          unestimated_task_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allocated_task_minutes: number
          available_focus_minutes: number
          calculated_at?: string
          capacity_ratio?: number | null
          created_at?: string
          fixed_minutes: number
          id?: string
          input_hash?: string | null
          overdue_task_count: number
          period_end: string
          period_start: string
          period_type: string
          raw_open_minutes: number
          required_task_minutes: number
          reserved_buffer_minutes: number
          scheduled_focus_minutes: number
          status: string
          summary: Json
          unallocated_task_minutes: number
          unestimated_task_count: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allocated_task_minutes?: number
          available_focus_minutes?: number
          calculated_at?: string
          capacity_ratio?: number | null
          created_at?: string
          fixed_minutes?: number
          id?: string
          input_hash?: string | null
          overdue_task_count?: number
          period_end?: string
          period_start?: string
          period_type?: string
          raw_open_minutes?: number
          required_task_minutes?: number
          reserved_buffer_minutes?: number
          scheduled_focus_minutes?: number
          status?: string
          summary?: Json
          unallocated_task_minutes?: number
          unestimated_task_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_planning_proposal: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      claim_connection_for_sync: {
        Args: { p_connection_id: string; p_stale_minutes?: number }
        Returns: string
      }
      deactivate_push_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      deactivate_push_subscription_by_endpoint: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      list_push_device_summaries: {
        Args: never
        Returns: {
          created_at: string
          device_name: string
          id: string
          is_active: boolean
          last_failed_push: string
          last_successful_push: string
        }[]
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_content_encoding?: string
          p_device_name?: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: {
          created_at: string
          device_name: string
          id: string
          is_active: boolean
          last_failed_push: string
          last_successful_push: string
        }[]
      }
      is_push_endpoint_registered: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      reject_planning_proposal: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      create_assistant_action: {
        Args: {
          p_thread_id: string
          p_action_type: string
          p_status: string
          p_proposed_payload: Json
          p_source_message_id?: string
          p_clarification_state?: Json
          p_expires_at?: string
        }
        Returns: Json
      }
      reject_assistant_action: {
        Args: { p_action_id: string }
        Returns: Json
      }
      reject_pending_assistant_actions: {
        Args: { p_thread_id: string }
        Returns: number
      }
      expire_stale_assistant_actions: {
        Args: { p_thread_id: string }
        Returns: number
      }
      execute_assistant_action: {
        Args: {
          p_action_id: string
          p_executed_payload: Json
        }
        Returns: Json
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
