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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          assinatura_digital_url: string | null
          cliente_id: string
          created_at: string
          data_agendamento: string
          data_confirmacao: string | null
          data_orcamento: string | null
          equipe_id: string | null
          hora: string | null
          id: string
          observacoes: string | null
          prioridade: string
          status: string
          tipo: string
          tipo_contrato: string | null
          updated_at: string
          valor_servico: number | null
          venda_confirmada: boolean | null
        }
        Insert: {
          assinatura_digital_url?: string | null
          cliente_id: string
          created_at?: string
          data_agendamento: string
          data_confirmacao?: string | null
          data_orcamento?: string | null
          equipe_id?: string | null
          hora?: string | null
          id?: string
          observacoes?: string | null
          prioridade?: string
          status?: string
          tipo?: string
          tipo_contrato?: string | null
          updated_at?: string
          valor_servico?: number | null
          venda_confirmada?: boolean | null
        }
        Update: {
          assinatura_digital_url?: string | null
          cliente_id?: string
          created_at?: string
          data_agendamento?: string
          data_confirmacao?: string | null
          data_orcamento?: string | null
          equipe_id?: string | null
          hora?: string | null
          id?: string
          observacoes?: string | null
          prioridade?: string
          status?: string
          tipo?: string
          tipo_contrato?: string | null
          updated_at?: string
          valor_servico?: number | null
          venda_confirmada?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_sem_credenciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_logs: {
        Row: {
          created_at: string
          entrada: string | null
          id: string
          metadata: Json | null
          resposta: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entrada?: string | null
          id?: string
          metadata?: Json | null
          resposta?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entrada?: string | null
          id?: string
          metadata?: Json | null
          resposta?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          created_at: string
          documento: string
          duracao_meses: number | null
          email: string | null
          id: string
          inicio_contrato: string | null
          inversor: string | null
          kwh_mensal: number | null
          login_internet: string | null
          login_inversor: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          potencia_kwp: number | null
          quantidade_placas: number | null
          rua: string | null
          senha_internet: string | null
          senha_inversor: string | null
          telefone: string | null
          termino_contrato: string | null
          uf: string | null
          updated_at: string
          valor_mensal: number | null
          valor_mensal_manual: number | null
          vendedor_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          documento: string
          duracao_meses?: number | null
          email?: string | null
          id?: string
          inicio_contrato?: string | null
          inversor?: string | null
          kwh_mensal?: number | null
          login_internet?: string | null
          login_inversor?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          potencia_kwp?: number | null
          quantidade_placas?: number | null
          rua?: string | null
          senha_internet?: string | null
          senha_inversor?: string | null
          telefone?: string | null
          termino_contrato?: string | null
          uf?: string | null
          updated_at?: string
          valor_mensal?: number | null
          valor_mensal_manual?: number | null
          vendedor_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string
          duracao_meses?: number | null
          email?: string | null
          id?: string
          inicio_contrato?: string | null
          inversor?: string | null
          kwh_mensal?: number | null
          login_internet?: string | null
          login_inversor?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          potencia_kwp?: number | null
          quantidade_placas?: number | null
          rua?: string | null
          senha_internet?: string | null
          senha_inversor?: string | null
          telefone?: string | null
          termino_contrato?: string | null
          uf?: string | null
          updated_at?: string
          valor_mensal?: number | null
          valor_mensal_manual?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      comissao_parcelas: {
        Row: {
          cliente_id: string
          created_at: string
          data_pagamento: string | null
          id: string
          pago: boolean
          parcela_num: number
          total_parcelas: number
          valor: number
          vendedor_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          pago?: boolean
          parcela_num?: number
          total_parcelas?: number
          valor?: number
          vendedor_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          pago?: boolean
          parcela_num?: number
          total_parcelas?: number
          valor?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissao_parcelas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_parcelas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_sem_credenciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_parcelas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          ano: number
          created_at: string
          data_pagamento: string | null
          id: string
          mes: number
          pago: boolean | null
          vendedor_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          data_pagamento?: string | null
          id?: string
          mes: number
          pago?: boolean | null
          vendedor_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          data_pagamento?: string | null
          id?: string
          mes?: number
          pago?: boolean | null
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          comissao_percentual: number | null
          cor_primaria: string | null
          created_at: string
          id: string
          logo_url: string | null
          nome_empresa: string | null
          updated_at: string
        }
        Insert: {
          comissao_percentual?: number | null
          cor_primaria?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          updated_at?: string
        }
        Update: {
          comissao_percentual?: number | null
          cor_primaria?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documentos_cliente: {
        Row: {
          agendamento_id: string | null
          assinatura_cliente_url: string | null
          assinatura_tecnico_url: string | null
          cliente_id: string
          created_at: string
          id: string
          nome: string
          tipo: string
          url: string
        }
        Insert: {
          agendamento_id?: string | null
          assinatura_cliente_url?: string | null
          assinatura_tecnico_url?: string | null
          cliente_id: string
          created_at?: string
          id?: string
          nome: string
          tipo?: string
          url: string
        }
        Update: {
          agendamento_id?: string | null
          assinatura_cliente_url?: string | null
          assinatura_tecnico_url?: string | null
          cliente_id?: string
          created_at?: string
          id?: string
          nome?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_sem_credenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          membros: string[] | null
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          membros?: string[] | null
          nome: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          membros?: string[] | null
          nome?: string
        }
        Relationships: []
      }
      faixas_preco: {
        Row: {
          created_at: string
          faixa_fim: number | null
          faixa_inicio: number
          id: string
          label: string | null
          ordem: number
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          faixa_fim?: number | null
          faixa_inicio?: number
          id?: string
          label?: string | null
          ordem?: number
          tipo: string
          valor?: number
        }
        Update: {
          created_at?: string
          faixa_fim?: number | null
          faixa_inicio?: number
          id?: string
          label?: string | null
          ordem?: number
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      inversores: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          inversor: string | null
          kwh_mensal: number | null
          login_inversor: string | null
          marca_modulos: string | null
          numero_serie: string | null
          observacoes: string | null
          potencia_kwp: number | null
          potencia_modulo_wp: number | null
          quantidade_placas: number | null
          senha_inversor: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          inversor?: string | null
          kwh_mensal?: number | null
          login_inversor?: string | null
          marca_modulos?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          potencia_kwp?: number | null
          potencia_modulo_wp?: number | null
          quantidade_placas?: number | null
          senha_inversor?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          inversor?: string | null
          kwh_mensal?: number | null
          login_inversor?: string | null
          marca_modulos?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          potencia_kwp?: number | null
          potencia_modulo_wp?: number | null
          quantidade_placas?: number | null
          senha_inversor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inversores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inversores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_sem_credenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          metadata: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          metadata?: Json | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          metadata?: Json | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      presets_modulos: {
        Row: {
          created_at: string
          geracao_estimada_kwh: number
          id: string
          potencia_wp: number
        }
        Insert: {
          created_at?: string
          geracao_estimada_kwh?: number
          id?: string
          potencia_wp: number
        }
        Update: {
          created_at?: string
          geracao_estimada_kwh?: number
          id?: string
          potencia_wp?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: []
      }
      servicos_extras: {
        Row: {
          cliente_id: string
          created_at: string
          data_conclusao: string | null
          data_solicitacao: string
          descricao: string
          id: string
          observacoes: string | null
          status: string
          tipo_servico: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_conclusao?: string | null
          data_solicitacao?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          status?: string
          tipo_servico?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_conclusao?: string | null
          data_solicitacao?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          status?: string
          tipo_servico?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "servicos_extras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_extras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_sem_credenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_contrato: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          nome: string
          nome_projeto: string | null
          tipo: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome: string
          nome_projeto?: string | null
          tipo?: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome?: string
          nome_projeto?: string | null
          tipo?: string
          url?: string
        }
        Relationships: []
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
      vendedores: {
        Row: {
          ativo: boolean | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      clientes_sem_credenciais: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          created_at: string | null
          documento: string | null
          duracao_meses: number | null
          email: string | null
          id: string | null
          inicio_contrato: string | null
          inversor: string | null
          kwh_mensal: number | null
          nome: string | null
          numero: string | null
          observacoes: string | null
          potencia_kwp: number | null
          quantidade_placas: number | null
          rua: string | null
          telefone: string | null
          termino_contrato: string | null
          uf: string | null
          updated_at: string | null
          valor_mensal: number | null
          vendedor_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string | null
          documento?: string | null
          duracao_meses?: number | null
          email?: string | null
          id?: string | null
          inicio_contrato?: string | null
          inversor?: string | null
          kwh_mensal?: number | null
          nome?: string | null
          numero?: string | null
          observacoes?: string | null
          potencia_kwp?: number | null
          quantidade_placas?: number | null
          rua?: string | null
          telefone?: string | null
          termino_contrato?: string | null
          uf?: string | null
          updated_at?: string | null
          valor_mensal?: number | null
          vendedor_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string | null
          documento?: string | null
          duracao_meses?: number | null
          email?: string | null
          id?: string | null
          inicio_contrato?: string | null
          inversor?: string | null
          kwh_mensal?: number | null
          nome?: string | null
          numero?: string | null
          observacoes?: string | null
          potencia_kwp?: number | null
          quantidade_placas?: number | null
          rua?: string | null
          telefone?: string | null
          termino_contrato?: string | null
          uf?: string | null
          updated_at?: string | null
          valor_mensal?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calcular_preco_limpeza: {
        Args: { p_quantidade_modulos: number }
        Returns: number
      }
      get_clientes_for_tecnico: {
        Args: never
        Returns: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          created_at: string | null
          documento: string | null
          duracao_meses: number | null
          email: string | null
          id: string | null
          inicio_contrato: string | null
          inversor: string | null
          kwh_mensal: number | null
          nome: string | null
          numero: string | null
          observacoes: string | null
          potencia_kwp: number | null
          quantidade_placas: number | null
          rua: string | null
          telefone: string | null
          termino_contrato: string | null
          uf: string | null
          updated_at: string | null
          valor_mensal: number | null
          vendedor_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "clientes_sem_credenciais"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "master" | "vendedor" | "viewer"
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
      app_role: ["admin", "tecnico", "master", "vendedor", "viewer"],
    },
  },
} as const
