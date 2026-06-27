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
      call_alerts: {
        Row: {
          acknowledged: boolean
          called_at: string
          department: Database["public"]["Enums"]["stage"]
          id: string
          patient_id: string
          queue_number: number
        }
        Insert: {
          acknowledged?: boolean
          called_at?: string
          department: Database["public"]["Enums"]["stage"]
          id?: string
          patient_id: string
          queue_number: number
        }
        Update: {
          acknowledged?: boolean
          called_at?: string
          department?: Database["public"]["Enums"]["stage"]
          id?: string
          patient_id?: string
          queue_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      override_logs: {
        Row: {
          authorized_by: string
          created_at: string
          id: string
          patient_id: string
          patient_name: string
          reason: string
          staff_id: string
        }
        Insert: {
          authorized_by: string
          created_at?: string
          id?: string
          patient_id: string
          patient_name: string
          reason: string
          staff_id: string
        }
        Update: {
          authorized_by?: string
          created_at?: string
          id?: string
          patient_id?: string
          patient_name?: string
          reason?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "override_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "override_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          assigned_station: string | null
          called_at: string | null
          checked_in_at: string
          created_at: string
          current_stage: Database["public"]["Enums"]["stage"]
          done_at: string | null
          full_name: string
          id: string
          initial_department: Database["public"]["Enums"]["stage"]
          phone: string | null
          position: number
          priority: Database["public"]["Enums"]["patient_priority"]
          queue_number: number
          status: Database["public"]["Enums"]["queue_status"]
          token_id: string
          user_id: string | null
        }
        Insert: {
          assigned_station?: string | null
          called_at?: string | null
          checked_in_at?: string
          created_at?: string
          current_stage: Database["public"]["Enums"]["stage"]
          done_at?: string | null
          full_name: string
          id?: string
          initial_department: Database["public"]["Enums"]["stage"]
          phone?: string | null
          position: number
          priority?: Database["public"]["Enums"]["patient_priority"]
          queue_number: number
          status?: Database["public"]["Enums"]["queue_status"]
          token_id: string
          user_id?: string | null
        }
        Update: {
          assigned_station?: string | null
          called_at?: string | null
          checked_in_at?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["stage"]
          done_at?: string | null
          full_name?: string
          id?: string
          initial_department?: Database["public"]["Enums"]["stage"]
          phone?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["patient_priority"]
          queue_number?: number
          status?: Database["public"]["Enums"]["queue_status"]
          token_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["stage"]
          id: string
          is_active: boolean
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          station: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          department: Database["public"]["Enums"]["stage"]
          id?: string
          is_active?: boolean
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          station?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["stage"]
          id?: string
          is_active?: boolean
          name?: string
          role?: Database["public"]["Enums"]["staff_role"]
          station?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
    }
    Enums: {
      patient_priority: "normal" | "priority" | "emergency"
      queue_status:
        | "waiting"
        | "in_consultation"
        | "in_lab"
        | "in_pharmacy"
        | "done"
        | "cancelled"
      staff_role: "doctor" | "nurse" | "pharmacist" | "lab_tech" | "admin"
      stage: "OPD" | "Lab" | "Pharmacy" | "Maternity"
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
      patient_priority: ["normal", "priority", "emergency"],
      queue_status: [
        "waiting",
        "in_consultation",
        "in_lab",
        "in_pharmacy",
        "done",
        "cancelled",
      ],
      staff_role: ["doctor", "nurse", "pharmacist", "lab_tech", "admin"],
      stage: ["OPD", "Lab", "Pharmacy", "Maternity"],
    },
  },
} as const
