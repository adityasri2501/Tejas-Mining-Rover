
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };

  graphql_public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };

  public: {
    Tables: {
      worker_ppe_registry: {
        Row: {
          id: string;
          user_id: string;
          employee_id: string;
          name: string;
          age: number;
          gender: string;
          photo_path: string;
          helmet: string;
          safety_vest: string;
          gloves: string;
          safety_boots: string;
          safety_goggles: string;
          created_at: string;
        };

        Insert: {
          id?: string;
          user_id: string;
          employee_id: string;
          name: string;
          age: number;
          gender: string;
          photo_path: string;
          helmet: string;
          safety_vest: string;
          gloves: string;
          safety_boots: string;
          safety_goggles: string;
          created_at?: string;
        };

        Update: {
          id?: string;
          user_id?: string;
          employee_id?: string;
          name?: string;
          age?: number;
          gender?: string;
          photo_path?: string;
          helmet?: string;
          safety_vest?: string;
          gloves?: string;
          safety_boots?: string;
          safety_goggles?: string;
          created_at?: string;
        };

        Relationships: [];
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type DatabaseWithoutInternals = Omit<
  Database,
  "__InternalSupabase"
>;

type DefaultSchema = DatabaseWithoutInternals[
  Extract<keyof Database, "public">
];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends
    DefaultSchemaTableNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals;
    }
      ? keyof (
          DatabaseWithoutInternals[
            DefaultSchemaTableNameOrOptions["schema"]
          ]["Tables"] &
          DatabaseWithoutInternals[
            DefaultSchemaTableNameOrOptions["schema"]
          ]["Views"]
        )
      : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (
      DatabaseWithoutInternals[
        DefaultSchemaTableNameOrOptions["schema"]
      ]["Tables"] &
      DatabaseWithoutInternals[
        DefaultSchemaTableNameOrOptions["schema"]
      ]["Views"]
    )[TableName] extends { Row: infer R }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends
        keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (
        DefaultSchema["Tables"] &
        DefaultSchema["Views"]
      )[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends
    DefaultSchemaTableNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals;
    }
      ? keyof DatabaseWithoutInternals[
          DefaultSchemaTableNameOrOptions["schema"]
        ]["Tables"]
      : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[
      DefaultSchemaTableNameOrOptions["schema"]
    ]["Tables"][TableName] extends { Insert: infer I }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][
        DefaultSchemaTableNameOrOptions
      ] extends { Insert: infer I }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends
    DefaultSchemaTableNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals;
    }
      ? keyof DatabaseWithoutInternals[
          DefaultSchemaTableNameOrOptions["schema"]
        ]["Tables"]
      : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[
      DefaultSchemaTableNameOrOptions["schema"]
    ]["Tables"][TableName] extends { Update: infer U }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][
        DefaultSchemaTableNameOrOptions
      ] extends { Update: infer U }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends
    DefaultSchemaEnumNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals;
    }
      ? keyof DatabaseWithoutInternals[
          DefaultSchemaEnumNameOrOptions["schema"]
        ]["Enums"]
      : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[
      DefaultSchemaEnumNameOrOptions["schema"]
    ]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  DefaultSchemaCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends
    DefaultSchemaCompositeTypeNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals;
    }
      ? keyof DatabaseWithoutInternals[
          DefaultSchemaCompositeTypeNameOrOptions["schema"]
        ]["CompositeTypes"]
      : never = never,
> = DefaultSchemaCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[
      DefaultSchemaCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"][CompositeTypeName]
  : DefaultSchemaCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][
        DefaultSchemaCompositeTypeNameOrOptions
      ]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
