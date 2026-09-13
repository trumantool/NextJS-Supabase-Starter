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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      admin_settings: {
        Row: {
          id: string
          option_name: string
          option_value: string
          option_field_type: string
          option_title: string
          option_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          option_name: string
          option_value?: string
          option_field_type?: string
          option_title: string
          option_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          option_name?: string
          option_value?: string
          option_field_type?: string
          option_title?: string
          option_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_skills: {
        Row: {
          id: string
          user_id: string | null
          skill_name: string
          skill_description: string | null
          skill_url: string
          source: string
          source_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          skill_name: string
          skill_description?: string | null
          skill_url: string
          source?: string
          source_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          skill_name?: string
          skill_description?: string | null
          skill_url?: string
          source?: string
          source_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_templates: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          status: string
          system_prompt: string
          skill_ids: string[]
          required_toolkits: string[]
          mcp_config: Json
          memory_config: Json
          defaults: Json
          created_by: string
          cloned_from_template_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          status?: string
          system_prompt?: string
          skill_ids?: string[]
          required_toolkits?: string[]
          mcp_config?: Json
          memory_config?: Json
          defaults?: Json
          created_by: string
          cloned_from_template_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          status?: string
          system_prompt?: string
          skill_ids?: string[]
          required_toolkits?: string[]
          mcp_config?: Json
          memory_config?: Json
          defaults?: Json
          created_by?: string
          cloned_from_template_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          id: string
          automation_id: string
          user_id: string
          trigger: string
          status: string
          error: string | null
          output: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          automation_id: string
          user_id: string
          trigger: string
          status: string
          error?: string | null
          output?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          automation_id?: string
          user_id?: string
          trigger?: string
          status?: string
          error?: string | null
          output?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      automations: {
        Row: {
          id: string
          user_id: string
          name: string
          prompt: string
          status: string
          frequency: string
          timezone: string
          local_time: string
          weekday: number | null
          monthday: number | null
          month: number | null
          once_on: string | null
          next_run_at: string | null
          allow_mutations: boolean
          model_id: string
          skill_ids: string[]
          agent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          prompt: string
          status?: string
          frequency: string
          timezone: string
          local_time: string
          weekday?: number | null
          monthday?: number | null
          month?: number | null
          once_on?: string | null
          next_run_at?: string | null
          allow_mutations?: boolean
          model_id?: string
          skill_ids?: string[]
          agent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          prompt?: string
          status?: string
          frequency?: string
          timezone?: string
          local_time?: string
          weekday?: number | null
          monthday?: number | null
          month?: number | null
          once_on?: string | null
          next_run_at?: string | null
          allow_mutations?: boolean
          model_id?: string
          skill_ids?: string[]
          agent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_tags: {
        Row: {
          chat_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          chat_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          chat_id?: string
          tag_id?: string
          created_at?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          id: string
          user_id: string
          title: string | null
          model_id: string
          agent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          model_id?: string
          agent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          model_id?: string
          agent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          user_id: string
          title: string
          template: string
          doc_json: Json
          model: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          template?: string
          doc_json?: Json
          model?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          template?: string
          doc_json?: Json
          model?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          role: string
          content: Json
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          role: string
          content?: Json
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          role?: string
          content?: Json
          created_at?: string
        }
        Relationships: []
      }
      session_tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          created_at?: string
        }
        Relationships: []
      }
      todo_list: {
        Row: {
          created_at: string
          description: string | null
          done: boolean
          done_at: string | null
          id: number
          owner: string
          title: string
          urgent: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: number
          owner: string
          title: string
          urgent?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: number
          owner?: string
          title?: string
          urgent?: boolean
        }
        Relationships: []
      }
      user_agents: {
        Row: {
          id: string
          user_id: string
          name: string
          source_template_id: string | null
          source_template_name: string
          system_prompt: string
          skill_ids: string[]
          required_toolkits: string[]
          mcp_config: Json
          memory_config: Json
          defaults: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          source_template_id?: string | null
          source_template_name?: string
          system_prompt?: string
          skill_ids?: string[]
          required_toolkits?: string[]
          mcp_config?: Json
          memory_config?: Json
          defaults?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          source_template_id?: string | null
          source_template_name?: string
          system_prompt?: string
          skill_ids?: string[]
          required_toolkits?: string[]
          mcp_config?: Json
          memory_config?: Json
          defaults?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_data: {
        Row: {
          user_id: string
          user_role: string
          first_name: string | null
          last_name: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          user_role?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          user_role?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_files: {
        Row: {
          id: string
          user_id: string
          file_id: string
          file_name: string
          file_description: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_id: string
          file_name: string
          file_description?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_id?: string
          file_name?: string
          file_description?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          slug: string
          display_name: string
          sort_order: number
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          slug: string
          display_name: string
          sort_order?: number
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          display_name?: string
          sort_order?: number
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          user_id: string
          first_name: string | null
          last_name: string | null
          email: string | null
          openrouter_api_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          openrouter_api_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          openrouter_api_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enqueue_automation_run: {
        Args: {
          p_automation_id: string
          p_trigger: string
          p_next_run_at: string | null
          p_new_status: string
        }
        Returns: string
      }
      claim_queued_automation_runs: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          automation_id: string
          user_id: string
          trigger: string
          status: string
          error: string | null
          output: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

/** Temporary alias while Phase 3 renames resume-builder → documents. */
export type ResumeRow = Database['public']['Tables']['documents']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type Automation = Database['public']['Tables']['automations']['Row']
export type AutomationRun = Database['public']['Tables']['automation_runs']['Row']
export type AgentSkill = Database['public']['Tables']['agent_skills']['Row']
export type AgentTemplate = Database['public']['Tables']['agent_templates']['Row']
export type UserAgent = Database['public']['Tables']['user_agents']['Row']
