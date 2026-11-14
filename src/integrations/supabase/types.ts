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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appt_date: string
          appt_time: string
          created_at: string
          doctor_id: string | null
          duration_min: number
          id: string
          notes: string
          patient_id: string
          reminder_sent_at: string | null
          service_id: string | null
          status: string
        }
        Insert: {
          appt_date: string
          appt_time: string
          created_at?: string
          doctor_id?: string | null
          duration_min?: number
          id?: string
          notes?: string
          patient_id: string
          reminder_sent_at?: string | null
          service_id?: string | null
          status?: string
        }
        Update: {
          appt_date?: string
          appt_time?: string
          created_at?: string
          doctor_id?: string | null
          duration_min?: number
          id?: string
          notes?: string
          patient_id?: string
          reminder_sent_at?: string | null
          service_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          created_at: string
          doctor_id: string | null
          full_name: string
          id: string
          notes: string
          phone: string
          req_date: string
          req_time: string
          service_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          full_name: string
          id?: string
          notes?: string
          phone: string
          req_date: string
          req_time: string
          service_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          full_name?: string
          id?: string
          notes?: string
          phone?: string
          req_date?: string
          req_time?: string
          service_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          about: string
          address: string
          close_time: string
          currency: string
          email: string
          id: number
          invoice_footer: string
          map_url: string
          name: string
          name_en: string
          open_time: string
          phone: string
          reminder_template: string
          slot_minutes: number
          tagline: string
          updated_at: string
          vat_number: string
          vat_rate: number
          whatsapp: string
          working_days: number[]
        }
        Insert: {
          about?: string
          address?: string
          close_time?: string
          currency?: string
          email?: string
          id?: number
          invoice_footer?: string
          map_url?: string
          name?: string
          name_en?: string
          open_time?: string
          phone?: string
          reminder_template?: string
          slot_minutes?: number
          tagline?: string
          updated_at?: string
          vat_number?: string
          vat_rate?: number
          whatsapp?: string
          working_days?: number[]
        }
        Update: {
          about?: string
          address?: string
          close_time?: string
          currency?: string
          email?: string
          id?: number
          invoice_footer?: string
          map_url?: string
          name?: string
          name_en?: string
          open_time?: string
          phone?: string
          reminder_template?: string
          slot_minutes?: number
          tagline?: string
          updated_at?: string
          vat_number?: string
          vat_rate?: number
          whatsapp?: string
          working_days?: number[]
        }
        Relationships: []
      }
      doctors: {
        Row: {
          active: boolean
          bio: string
          created_at: string
          id: string
          name: string
          sort: number
          specialty: string
        }
        Insert: {
          active?: boolean
          bio?: string
          created_at?: string
          id?: string
          name: string
          sort?: number
          specialty?: string
        }
        Update: {
          active?: boolean
          bio?: string
          created_at?: string
          id?: string
          name?: string
          sort?: number
          specialty?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          method: string
          note: string
          spent_on: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          id?: string
          method?: string
          note?: string
          spent_on?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          method?: string
          note?: string
          spent_on?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          cost: number
          created_at: string
          id: string
          min_quantity: number
          name: string
          quantity: number
          unit: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          min_quantity?: number
          name: string
          quantity?: number
          unit?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          min_quantity?: number
          name?: string
          quantity?: number
          unit?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          qty?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          discount: number
          id: string
          issue_date: string
          notes: string
          number: number
          patient_id: string
          subtotal: number
          total: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          issue_date?: string
          notes?: string
          number?: never
          patient_id: string
          subtotal?: number
          total?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          issue_date?: string
          notes?: string
          number?: never
          patient_id?: string
          subtotal?: number
          total?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_no: number
          id: string
          source_id: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_no?: never
          id?: string
          source_id?: string | null
          source_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_no?: never
          id?: string
          source_id?: string | null
          source_type?: string
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          entry_id: string
          id: string
          memo: string
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          memo?: string
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          memo?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          allergies: string
          birth_date: string | null
          created_at: string
          full_name: string
          gender: string
          id: string
          medical_notes: string
          national_id: string
          notes: string
          phone: string
        }
        Insert: {
          allergies?: string
          birth_date?: string | null
          created_at?: string
          full_name: string
          gender?: string
          id?: string
          medical_notes?: string
          national_id?: string
          notes?: string
          phone?: string
        }
        Update: {
          allergies?: string
          birth_date?: string | null
          created_at?: string
          full_name?: string
          gender?: string
          id?: string
          medical_notes?: string
          national_id?: string
          notes?: string
          phone?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          paid_on: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          paid_on?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          paid_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          description: string
          duration_min: number
          id: string
          image_url: string
          name: string
          price: number
          sort: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          image_url?: string
          name: string
          price?: number
          sort?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          image_url?: string
          name?: string
          price?: number
          sort?: number
        }
        Relationships: []
      }
      tooth_records: {
        Row: {
          id: string
          note: string
          patient_id: string
          status: string
          tooth: number
          updated_at: string
        }
        Insert: {
          id?: string
          note?: string
          patient_id: string
          status?: string
          tooth: number
          updated_at?: string
        }
        Update: {
          id?: string
          note?: string
          patient_id?: string
          status?: string
          tooth?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tooth_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_items: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          price: number
          status: string
          title: string
          tooth: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          price?: number
          status?: string
          title: string
          tooth?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          price?: number
          status?: string
          title?: string
          tooth?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_balances: {
        Args: { _from: string; _to: string }
        Returns: {
          account_id: string
          code: string
          credit: number
          debit: number
          name: string
          type: string
        }[]
      }
      acct: { Args: { _code: string }; Returns: string }
      cash_account: { Args: { _method: string }; Returns: string }
      delete_manual_entry: { Args: { _id: string }; Returns: undefined }
      get_booked_slots: {
        Args: { _date: string; _doctor?: string }
        Returns: {
          slot: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      post_manual_entry: {
        Args: { _date: string; _description: string; _lines: Json }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "staff"],
    },
  },
} as const
