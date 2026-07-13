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
      academic_exceptions: {
        Row: {
          academic_term_id: string
          altered_schedule: Json | null
          blocks_availability: boolean
          course_id: string | null
          created_at: string
          end_date: string
          exception_type: string
          id: string
          informational_only: boolean
          is_user_modified: boolean
          notes: string | null
          preset_key: string | null
          start_date: string
          suppresses_classes: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_term_id: string
          altered_schedule?: Json | null
          blocks_availability?: boolean
          course_id?: string | null
          created_at?: string
          end_date: string
          exception_type: string
          id?: string
          informational_only?: boolean
          is_user_modified?: boolean
          notes?: string | null
          preset_key?: string | null
          start_date: string
          suppresses_classes?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_term_id?: string
          altered_schedule?: Json | null
          blocks_availability?: boolean
          course_id?: string | null
          created_at?: string
          end_date?: string
          exception_type?: string
          id?: string
          informational_only?: boolean
          is_user_modified?: boolean
          notes?: string | null
          preset_key?: string | null
          start_date?: string
          suppresses_classes?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_exceptions_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_exceptions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_terms: {
        Row: {
          classes_end: string
          classes_start: string
          created_at: string
          end_date: string
          finals_end: string | null
          finals_start: string | null
          id: string
          institution: string
          name: string
          source_metadata: Json | null
          source_preset_imported_at: string | null
          source_preset_key: string | null
          source_preset_revision: string | null
          start_date: string
          status: string
          term_type: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          classes_end: string
          classes_start: string
          created_at?: string
          end_date: string
          finals_end?: string | null
          finals_start?: string | null
          id?: string
          institution?: string
          name: string
          source_metadata?: Json | null
          source_preset_imported_at?: string | null
          source_preset_key?: string | null
          source_preset_revision?: string | null
          start_date: string
          status?: string
          term_type?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          classes_end?: string
          classes_start?: string
          created_at?: string
          end_date?: string
          finals_end?: string | null
          finals_start?: string | null
          id?: string
          institution?: string
          name?: string
          source_metadata?: Json | null
          source_preset_imported_at?: string | null
          source_preset_key?: string | null
          source_preset_revision?: string | null
          start_date?: string
          status?: string
          term_type?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_intent_router_daily_usage: {
        Row: {
          created_at: string
          id: string
          request_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          usage_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_intent_router_telemetry: {
        Row: {
          confidence_bucket: string | null
          created_at: string
          error_category: string | null
          id: string
          latency_bucket_ms: string | null
          model: string
          provider: string
          retention_expires_at: string
          schema_version: number
          selected_intent: string | null
          status: string
          usage_units: number | null
          user_id: string
        }
        Insert: {
          confidence_bucket?: string | null
          created_at?: string
          error_category?: string | null
          id?: string
          latency_bucket_ms?: string | null
          model: string
          provider: string
          retention_expires_at?: string
          schema_version?: number
          selected_intent?: string | null
          status: string
          usage_units?: number | null
          user_id: string
        }
        Update: {
          confidence_bucket?: string | null
          created_at?: string
          error_category?: string | null
          id?: string
          latency_bucket_ms?: string | null
          model?: string
          provider?: string
          retention_expires_at?: string
          schema_version?: number
          selected_intent?: string | null
          status?: string
          usage_units?: number | null
          user_id?: string
        }
        Relationships: []
      }
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
      assistant_parser_outcomes: {
        Row: {
          clarification_reason: string | null
          created_at: string
          date_range_kind: string | null
          id: string
          normalized_intent: string | null
          retention_expires_at: string
          success: boolean
          user_id: string
          week_offset: number | null
        }
        Insert: {
          clarification_reason?: string | null
          created_at?: string
          date_range_kind?: string | null
          id?: string
          normalized_intent?: string | null
          retention_expires_at?: string
          success: boolean
          user_id: string
          week_offset?: number | null
        }
        Update: {
          clarification_reason?: string | null
          created_at?: string
          date_range_kind?: string | null
          id?: string
          normalized_intent?: string | null
          retention_expires_at?: string
          success?: boolean
          user_id?: string
          week_offset?: number | null
        }
        Relationships: []
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
      canvas_class_link_decisions: {
        Row: {
          academic_term_id: string
          candidate_fingerprint: string
          canvas_course_id: string | null
          class_meeting_id: string | null
          created_at: string
          id: string
          resolution_mode: string
          reversed_at: string | null
          user_id: string
        }
        Insert: {
          academic_term_id: string
          candidate_fingerprint: string
          canvas_course_id?: string | null
          class_meeting_id?: string | null
          created_at?: string
          id?: string
          resolution_mode: string
          reversed_at?: string | null
          user_id: string
        }
        Update: {
          academic_term_id?: string
          candidate_fingerprint?: string
          canvas_course_id?: string | null
          class_meeting_id?: string | null
          created_at?: string
          id?: string
          resolution_mode?: string
          reversed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_class_link_decisions_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_class_link_decisions_class_meeting_id_fkey"
            columns: ["class_meeting_id"]
            isOneToOne: false
            referencedRelation: "class_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_class_link_uids: {
        Row: {
          canvas_external_event_id: string
          created_at: string
          decision_id: string
          id: string
        }
        Insert: {
          canvas_external_event_id: string
          created_at?: string
          decision_id: string
          id?: string
        }
        Update: {
          canvas_external_event_id?: string
          created_at?: string
          decision_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_class_link_uids_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "canvas_class_link_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_suppressed_occurrences: {
        Row: {
          canvas_external_event_id: string
          class_meeting_id: string
          decision_id: string
          id: string
          reversed_at: string | null
          suppressed_at: string
          user_id: string
        }
        Insert: {
          canvas_external_event_id: string
          class_meeting_id: string
          decision_id: string
          id?: string
          reversed_at?: string | null
          suppressed_at?: string
          user_id: string
        }
        Update: {
          canvas_external_event_id?: string
          class_meeting_id?: string
          decision_id?: string
          id?: string
          reversed_at?: string | null
          suppressed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_suppressed_occurrences_class_meeting_id_fkey"
            columns: ["class_meeting_id"]
            isOneToOne: false
            referencedRelation: "class_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_suppressed_occurrences_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "canvas_class_link_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_meetings: {
        Row: {
          content_hash: string | null
          course_id: string
          created_at: string
          days_of_week: number[]
          effective_end_date: string
          effective_start_date: string
          end_time: string
          id: string
          is_online: boolean
          location: string | null
          source_canvas_uid: string | null
          start_time: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_hash?: string | null
          course_id: string
          created_at?: string
          days_of_week: number[]
          effective_end_date: string
          effective_start_date: string
          end_time: string
          id?: string
          is_online?: boolean
          location?: string | null
          source_canvas_uid?: string | null
          start_time: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_hash?: string | null
          course_id?: string
          created_at?: string
          days_of_week?: number[]
          effective_end_date?: string
          effective_start_date?: string
          end_time?: string
          id?: string
          is_online?: boolean
          location?: string | null
          source_canvas_uid?: string | null
          start_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_meetings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
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
      courses: {
        Row: {
          academic_term_id: string
          canvas_course_id: string | null
          code: string
          color: string | null
          created_at: string
          id: string
          name: string
          section: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_term_id: string
          canvas_course_id?: string | null
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
          section?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_term_id?: string
          canvas_course_id?: string | null
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          section?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          assistant_action_id: string | null
          blocks_time: boolean
          calendar_id: string
          class_meeting_id: string | null
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
          shift_note: string | null
          shift_source_label: string | null
          show_as: string | null
          source: string
          start_at: string
          status: string
          title: string
          unpaid_break_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          assistant_action_id?: string | null
          blocks_time?: boolean
          calendar_id: string
          class_meeting_id?: string | null
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
          shift_note?: string | null
          shift_source_label?: string | null
          show_as?: string | null
          source?: string
          start_at: string
          status?: string
          title: string
          unpaid_break_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          assistant_action_id?: string | null
          blocks_time?: boolean
          calendar_id?: string
          class_meeting_id?: string | null
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
          shift_note?: string | null
          shift_source_label?: string | null
          show_as?: string | null
          source?: string
          start_at?: string
          status?: string
          title?: string
          unpaid_break_minutes?: number
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
            foreignKeyName: "events_class_meeting_id_fkey"
            columns: ["class_meeting_id"]
            isOneToOne: false
            referencedRelation: "class_meetings"
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
      planning_block_feedback: {
        Row: {
          created_at: string
          event_id: string
          feedback: string
          id: string
          note: string | null
          partial_minutes: number | null
          proposal_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          feedback: string
          id?: string
          note?: string | null
          partial_minutes?: number | null
          proposal_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          feedback?: string
          id?: string
          note?: string | null
          partial_minutes?: number | null
          proposal_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_block_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_block_feedback_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "planning_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_preferences: {
        Row: {
          adaptive_planning_enabled: boolean
          auto_create_focus_blocks: boolean
          avoid_difficult_work_after: string | null
          calendar_desktop_view: string
          calendar_filter_prefs: Json
          calendar_mobile_view: string
          calendar_visible_end_hour: number
          calendar_visible_start_hour: number
          calibration_reset_at: string | null
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
          stale_timer_notified_at: string | null
          stale_timer_threshold_hours: number
          travel_buffer_minutes: number
          updated_at: string
          user_id: string
          weekly_notification_day: number
          weekly_notification_time: string | null
          weekly_notifications_enabled: boolean
        }
        Insert: {
          adaptive_planning_enabled?: boolean
          auto_create_focus_blocks?: boolean
          avoid_difficult_work_after?: string | null
          calendar_desktop_view?: string
          calendar_filter_prefs?: Json
          calendar_mobile_view?: string
          calendar_visible_end_hour?: number
          calendar_visible_start_hour?: number
          calibration_reset_at?: string | null
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
          stale_timer_notified_at?: string | null
          stale_timer_threshold_hours?: number
          travel_buffer_minutes?: number
          updated_at?: string
          user_id: string
          weekly_notification_day?: number
          weekly_notification_time?: string | null
          weekly_notifications_enabled?: boolean
        }
        Update: {
          adaptive_planning_enabled?: boolean
          auto_create_focus_blocks?: boolean
          avoid_difficult_work_after?: string | null
          calendar_desktop_view?: string
          calendar_filter_prefs?: Json
          calendar_mobile_view?: string
          calendar_visible_end_hour?: number
          calendar_visible_start_hour?: number
          calibration_reset_at?: string | null
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
          stale_timer_notified_at?: string | null
          stale_timer_threshold_hours?: number
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
      shortcut_command_dedup: {
        Row: {
          client_request_id: string
          created_at: string
          device_id: string
          id: string
          response_json: Json
        }
        Insert: {
          client_request_id: string
          created_at?: string
          device_id: string
          id?: string
          response_json: Json
        }
        Update: {
          client_request_id?: string
          created_at?: string
          device_id?: string
          id?: string
          response_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shortcut_command_dedup_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "shortcut_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      shortcut_devices: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_error_code: string | null
          last_success_at: string | null
          last_used_at: string | null
          name: string
          revoked_at: string | null
          spoken_detail_level: string
          token_hash: string
          token_prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_error_code?: string | null
          last_success_at?: string | null
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          spoken_detail_level?: string
          token_hash: string
          token_prefix: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_error_code?: string | null
          last_success_at?: string | null
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          spoken_detail_level?: string
          token_hash?: string
          token_prefix?: string
          updated_at?: string
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
            isOneToOne: true
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
      task_completion_snapshots: {
        Row: {
          adjustment_seconds: number
          completed_at: string
          completion_sequence: number
          correction_of_snapshot_id: string | null
          created_at: string
          current_estimate_minutes: number | null
          estimate_revision_count: number
          final_actual_seconds: number
          id: string
          is_current: boolean
          original_estimate_minutes: number | null
          superseded_at: string | null
          task_id: string
          tracked_seconds: number
          user_id: string
        }
        Insert: {
          adjustment_seconds?: number
          completed_at: string
          completion_sequence?: number
          correction_of_snapshot_id?: string | null
          created_at?: string
          current_estimate_minutes?: number | null
          estimate_revision_count?: number
          final_actual_seconds?: number
          id?: string
          is_current?: boolean
          original_estimate_minutes?: number | null
          superseded_at?: string | null
          task_id: string
          tracked_seconds?: number
          user_id: string
        }
        Update: {
          adjustment_seconds?: number
          completed_at?: string
          completion_sequence?: number
          correction_of_snapshot_id?: string | null
          created_at?: string
          current_estimate_minutes?: number | null
          estimate_revision_count?: number
          final_actual_seconds?: number
          id?: string
          is_current?: boolean
          original_estimate_minutes?: number | null
          superseded_at?: string | null
          task_id?: string
          tracked_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completion_snapshots_correction_of_snapshot_id_fkey"
            columns: ["correction_of_snapshot_id"]
            isOneToOne: false
            referencedRelation: "task_completion_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completion_snapshots_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_estimate_revisions: {
        Row: {
          created_at: string
          id: string
          new_minutes: number | null
          previous_minutes: number | null
          reason: string | null
          revision_source: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_minutes?: number | null
          previous_minutes?: number | null
          reason?: string | null
          revision_source: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_minutes?: number | null
          previous_minutes?: number | null
          reason?: string | null
          revision_source?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_estimate_revisions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          entry_source: string
          id: string
          note: string | null
          parent_entry_id: string | null
          review_reason: string | null
          review_state: string
          reviewed_at: string | null
          started_at: string
          task_id: string | null
          task_title_snapshot: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          entry_source?: string
          id?: string
          note?: string | null
          parent_entry_id?: string | null
          review_reason?: string | null
          review_state?: string
          reviewed_at?: string | null
          started_at: string
          task_id?: string | null
          task_title_snapshot?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          entry_source?: string
          id?: string
          note?: string | null
          parent_entry_id?: string | null
          review_reason?: string | null
          review_state?: string
          reviewed_at?: string | null
          started_at?: string
          task_id?: string | null
          task_title_snapshot?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_entries_parent_entry_id_fkey"
            columns: ["parent_entry_id"]
            isOneToOne: false
            referencedRelation: "task_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_minutes: number | null
          cancelled_by_sync: boolean
          completed_at: string | null
          course_id: string | null
          created_at: string
          description: string | null
          difficulty: number
          due_at: string | null
          earliest_start_at: string | null
          estimated_minutes: number | null
          external_task_id: string | null
          id: string
          minimum_block_minutes: number
          planning_estimate_override: string | null
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
          course_id?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number
          due_at?: string | null
          earliest_start_at?: string | null
          estimated_minutes?: number | null
          external_task_id?: string | null
          id?: string
          minimum_block_minutes?: number
          planning_estimate_override?: string | null
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
          course_id?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number
          due_at?: string | null
          earliest_start_at?: string | null
          estimated_minutes?: number | null
          external_task_id?: string | null
          id?: string
          minimum_block_minutes?: number
          planning_estimate_override?: string | null
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
            foreignKeyName: "tasks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      timer_pause_segments: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          paused_at: string
          resumed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          paused_at: string
          resumed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          paused_at?: string
          resumed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timer_pause_segments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "task_time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      work_shift_templates: {
        Row: {
          created_at: string
          end_time: string
          id: string
          label: string | null
          location: string | null
          name: string
          start_time: string
          unpaid_break_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          label?: string | null
          location?: string | null
          name: string
          start_time: string
          unpaid_break_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          label?: string | null
          location?: string | null
          name?: string
          start_time?: string
          unpaid_break_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      create_assistant_action: {
        Args: {
          p_action_type: string
          p_clarification_state?: Json
          p_expires_at?: string
          p_proposed_payload: Json
          p_source_message_id?: string
          p_status: string
          p_thread_id: string
        }
        Returns: Json
      }
      deactivate_push_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      deactivate_push_subscription_by_endpoint: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      execute_assistant_action: {
        Args: { p_action_id: string; p_executed_payload: Json }
        Returns: Json
      }
      expire_stale_assistant_actions: {
        Args: { p_thread_id: string }
        Returns: number
      }
      is_push_endpoint_registered: {
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
      list_shortcut_devices: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          last_error_code: string
          last_success_at: string
          last_used_at: string
          name: string
          revoked_at: string
          spoken_detail_level: string
          token_prefix: string
        }[]
      }
      purge_expired_ai_intent_router_telemetry: { Args: never; Returns: number }
      purge_expired_parser_outcomes: { Args: never; Returns: number }
      record_shortcut_device_usage: {
        Args: { p_device_id: string; p_error_code?: string; p_success: boolean }
        Returns: undefined
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
      register_shortcut_device: {
        Args: {
          p_name: string
          p_spoken_detail_level?: string
          p_token_hash: string
          p_token_prefix: string
        }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          spoken_detail_level: string
          token_prefix: string
        }[]
      }
      reject_assistant_action: { Args: { p_action_id: string }; Returns: Json }
      reject_pending_assistant_actions: {
        Args: { p_thread_id: string }
        Returns: number
      }
      reject_planning_proposal: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      revoke_shortcut_device: {
        Args: { p_device_id: string }
        Returns: boolean
      }
      rotate_shortcut_device_token: {
        Args: {
          p_device_id: string
          p_token_hash: string
          p_token_prefix: string
        }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          spoken_detail_level: string
          token_prefix: string
        }[]
      }
      store_shortcut_command_dedup: {
        Args: {
          p_client_request_id: string
          p_device_id: string
          p_response_json: Json
        }
        Returns: Json
      }
      update_shortcut_device: {
        Args: {
          p_device_id: string
          p_name: string
          p_spoken_detail_level: string
        }
        Returns: boolean
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
