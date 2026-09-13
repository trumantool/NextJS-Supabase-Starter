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
      intake_assessments: {
        Row: {
          id: string
          user_id: string
          section_index: number
          section_title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          section_index: number
          section_title: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          section_index?: number
          section_title?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      intake_responses: {
        Row: {
          id: string
          assessment_id: string
          question_number: number
          question_text: string
          section_title: string
          audio_file_path: string | null
          duration_seconds: number | null
          recorded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          question_number: number
          question_text: string
          section_title: string
          audio_file_path?: string | null
          duration_seconds?: number | null
          recorded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assessment_id?: string
          question_number?: number
          question_text?: string
          section_title?: string
          audio_file_path?: string | null
          duration_seconds?: number | null
          recorded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_intake_assessments: {
        Row: {
          id: string
          session_id: string
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_intake_responses: {
        Row: {
          id: string
          assessment_id: string
          question_number: number
          question_text: string
          section_title: string
          audio_file_path: string | null
          duration_seconds: number | null
          recorded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          question_number: number
          question_text: string
          section_title: string
          audio_file_path?: string | null
          duration_seconds?: number | null
          recorded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assessment_id?: string
          question_number?: number
          question_text?: string
          section_title?: string
          audio_file_path?: string | null
          duration_seconds?: number | null
          recorded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audio_text_assessments: {
        Row: {
          id: string
          user_id: string
          section_index: number
          section_title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          section_index: number
          section_title: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          section_index?: number
          section_title?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audio_text_responses: {
        Row: {
          id: string
          assessment_id: string
          question_number: number
          question_text: string
          section_title: string
          transcript_text: string | null
          audio_file_path: string | null
          duration_seconds: number | null
          recorded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          question_number: number
          question_text: string
          section_title: string
          transcript_text?: string | null
          audio_file_path?: string | null
          duration_seconds?: number | null
          recorded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assessment_id?: string
          question_number?: number
          question_text?: string
          section_title?: string
          transcript_text?: string | null
          audio_file_path?: string | null
          duration_seconds?: number | null
          recorded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      text_assessments: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      text_assessment_answers: {
        Row: {
          id: string
          assessment_id: string
          question_number: number
          question_text: string
          section_title: string
          section_index: number
          answer_text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          question_number: number
          question_text: string
          section_title: string
          section_index?: number
          answer_text?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assessment_id?: string
          question_number?: number
          question_text?: string
          section_title?: string
          section_index?: number
          answer_text?: string
          created_at?: string
          updated_at?: string
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
      resumes: {
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
      contact_submissions: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email_address: string
          phone_number: string | null
          message: string
          user_id: string | null
          status: string
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          email_address: string
          phone_number?: string | null
          message: string
          user_id?: string | null
          status?: string
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          email_address?: string
          phone_number?: string | null
          message?: string
          user_id?: string | null
          status?: string
          source?: string
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
      user_settings: {
        Row: {
          user_id: string
          first_name: string | null
          last_name: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
