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
      alocacoes_alojamento: {
        Row: {
          alojamento_id: string
          aluno_id: string
          created_at: string
          data_entrada: string
          data_saida: string | null
          id: string
          status: Database["public"]["Enums"]["status_alocacao"]
          updated_at: string
        }
        Insert: {
          alojamento_id: string
          aluno_id: string
          created_at?: string
          data_entrada?: string
          data_saida?: string | null
          id?: string
          status?: Database["public"]["Enums"]["status_alocacao"]
          updated_at?: string
        }
        Update: {
          alojamento_id?: string
          aluno_id?: string
          created_at?: string
          data_entrada?: string
          data_saida?: string | null
          id?: string
          status?: Database["public"]["Enums"]["status_alocacao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alocacoes_alojamento_alojamento_id_fkey"
            columns: ["alojamento_id"]
            isOneToOne: false
            referencedRelation: "alojamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_alojamento_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alojamentos: {
        Row: {
          capacidade: number
          created_at: string
          genero: Database["public"]["Enums"]["genero_quarto"]
          id: string
          instituicao_id: string | null
          nome_bloco: string
          numero_quarto: string
          status: Database["public"]["Enums"]["status_quarto"]
          tipo_quarto: Database["public"]["Enums"]["tipo_quarto"]
          updated_at: string
        }
        Insert: {
          capacidade?: number
          created_at?: string
          genero?: Database["public"]["Enums"]["genero_quarto"]
          id?: string
          instituicao_id?: string | null
          nome_bloco: string
          numero_quarto: string
          status?: Database["public"]["Enums"]["status_quarto"]
          tipo_quarto?: Database["public"]["Enums"]["tipo_quarto"]
          updated_at?: string
        }
        Update: {
          capacidade?: number
          created_at?: string
          genero?: Database["public"]["Enums"]["genero_quarto"]
          id?: string
          instituicao_id?: string | null
          nome_bloco?: string
          numero_quarto?: string
          status?: Database["public"]["Enums"]["status_quarto"]
          tipo_quarto?: Database["public"]["Enums"]["tipo_quarto"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alojamentos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_bolsas: {
        Row: {
          aluno_id: string
          ativo: boolean
          bolsa_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          bolsa_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          bolsa_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_bolsas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_bolsas_bolsa_id_fkey"
            columns: ["bolsa_id"]
            isOneToOne: false
            referencedRelation: "bolsas_descontos"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_disciplinas: {
        Row: {
          aluno_id: string
          ano: number
          created_at: string
          disciplina_id: string
          id: string
          semestre: string
          status: string
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          ano: number
          created_at?: string
          disciplina_id: string
          id?: string
          semestre: string
          status?: string
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          ano?: number
          created_at?: string
          disciplina_id?: string
          id?: string
          semestre?: string
          status?: string
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_disciplinas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_disciplinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_fim_teste: string | null
          data_inicio: string
          data_proximo_pagamento: string | null
          dias_antes_lembrete: number | null
          dias_carencia_analise: number | null
          dias_teste: number | null
          em_teste: boolean | null
          iban: string | null
          id: string
          instituicao_id: string
          instrucoes_pagamento: string | null
          multicaixa_numero: string | null
          observacoes: string | null
          plano_id: string
          status: string
          tipo_periodo: string
          ultimo_lembrete_enviado: string | null
          updated_at: string
          valor_atual: number
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_fim_teste?: string | null
          data_inicio?: string
          data_proximo_pagamento?: string | null
          dias_antes_lembrete?: number | null
          dias_carencia_analise?: number | null
          dias_teste?: number | null
          em_teste?: boolean | null
          iban?: string | null
          id?: string
          instituicao_id: string
          instrucoes_pagamento?: string | null
          multicaixa_numero?: string | null
          observacoes?: string | null
          plano_id: string
          status?: string
          tipo_periodo?: string
          ultimo_lembrete_enviado?: string | null
          updated_at?: string
          valor_atual?: number
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_fim_teste?: string | null
          data_inicio?: string
          data_proximo_pagamento?: string | null
          dias_antes_lembrete?: number | null
          dias_carencia_analise?: number | null
          dias_teste?: number | null
          em_teste?: boolean | null
          iban?: string | null
          id?: string
          instituicao_id?: string
          instrucoes_pagamento?: string | null
          multicaixa_numero?: string | null
          observacoes?: string | null
          plano_id?: string
          status?: string
          tipo_periodo?: string
          ultimo_lembrete_enviado?: string | null
          updated_at?: string
          valor_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: true
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas: {
        Row: {
          conteudo: string | null
          created_at: string
          data: string
          id: string
          observacoes: string | null
          turma_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          data: string
          id?: string
          observacoes?: string | null
          turma_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_funcionario: {
        Row: {
          ano: number
          avaliado_por: string | null
          created_at: string
          data_avaliacao: string
          funcionario_id: string
          id: string
          media_final: number | null
          metas: string | null
          nota_competencia: number | null
          nota_desempenho: number | null
          nota_pontualidade: number | null
          nota_relacionamento: number | null
          observacoes: string | null
          periodo: string
          pontos_fortes: string | null
          pontos_melhoria: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ano: number
          avaliado_por?: string | null
          created_at?: string
          data_avaliacao?: string
          funcionario_id: string
          id?: string
          media_final?: number | null
          metas?: string | null
          nota_competencia?: number | null
          nota_desempenho?: number | null
          nota_pontualidade?: number | null
          nota_relacionamento?: number | null
          observacoes?: string | null
          periodo: string
          pontos_fortes?: string | null
          pontos_melhoria?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          avaliado_por?: string | null
          created_at?: string
          data_avaliacao?: string
          funcionario_id?: string
          id?: string
          media_final?: number | null
          metas?: string | null
          nota_competencia?: number | null
          nota_desempenho?: number | null
          nota_pontualidade?: number | null
          nota_relacionamento?: number | null
          observacoes?: string | null
          periodo?: string
          pontos_fortes?: string | null
          pontos_melhoria?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_funcionario_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_history: {
        Row: {
          arquivo_url: string | null
          created_at: string
          erro: string | null
          id: string
          instituicao_id: string | null
          status: string
          tamanho_bytes: number | null
          tipo: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          instituicao_id?: string | null
          status?: string
          tamanho_bytes?: number | null
          tipo?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          instituicao_id?: string | null
          status?: string
          tamanho_bytes?: number | null
          tipo?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_history_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_schedules: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          dia_mes: number | null
          dia_semana: number | null
          frequencia: string
          hora_execucao: string
          id: string
          instituicao_id: string | null
          proximo_backup: string | null
          tipo_backup: string
          ultimo_backup: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          frequencia?: string
          hora_execucao?: string
          id?: string
          instituicao_id?: string | null
          proximo_backup?: string | null
          tipo_backup?: string
          ultimo_backup?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          frequencia?: string
          hora_execucao?: string
          id?: string
          instituicao_id?: string | null
          proximo_backup?: string | null
          tipo_backup?: string
          ultimo_backup?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_schedules_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios_funcionario: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string
          funcionario_id: string
          id: string
          observacoes: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          funcionario_id: string
          id?: string
          observacoes?: string | null
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "beneficios_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bolsas_descontos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      candidaturas: {
        Row: {
          analisado_por: string | null
          cidade: string | null
          created_at: string
          curso_pretendido: string | null
          data_analise: string | null
          data_candidatura: string
          data_nascimento: string | null
          documentos_url: string[] | null
          email: string
          genero: string | null
          id: string
          instituicao_id: string | null
          morada: string | null
          nome_completo: string
          numero_identificacao: string
          observacoes: string | null
          pais: string | null
          status: string
          telefone: string | null
          turno_preferido: string | null
          updated_at: string
        }
        Insert: {
          analisado_por?: string | null
          cidade?: string | null
          created_at?: string
          curso_pretendido?: string | null
          data_analise?: string | null
          data_candidatura?: string
          data_nascimento?: string | null
          documentos_url?: string[] | null
          email: string
          genero?: string | null
          id?: string
          instituicao_id?: string | null
          morada?: string | null
          nome_completo: string
          numero_identificacao: string
          observacoes?: string | null
          pais?: string | null
          status?: string
          telefone?: string | null
          turno_preferido?: string | null
          updated_at?: string
        }
        Update: {
          analisado_por?: string | null
          cidade?: string | null
          created_at?: string
          curso_pretendido?: string | null
          data_analise?: string | null
          data_candidatura?: string
          data_nascimento?: string | null
          documentos_url?: string[] | null
          email?: string
          genero?: string | null
          id?: string
          instituicao_id?: string | null
          morada?: string | null
          nome_completo?: string
          numero_identificacao?: string
          observacoes?: string | null
          pais?: string | null
          status?: string
          telefone?: string | null
          turno_preferido?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidaturas_curso_pretendido_fkey"
            columns: ["curso_pretendido"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          instituicao_id: string | null
          nome: string
          salario_base: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          instituicao_id?: string | null
          nome: string
          salario_base?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          instituicao_id?: string | null
          nome?: string
          salario_base?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados: {
        Row: {
          ativo: boolean
          autor_id: string | null
          conteudo: string
          created_at: string
          data_expiracao: string | null
          data_publicacao: string
          destinatarios: string
          id: string
          instituicao_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          autor_id?: string | null
          conteudo: string
          created_at?: string
          data_expiracao?: string | null
          data_publicacao?: string
          destinatarios?: string
          id?: string
          instituicao_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          autor_id?: string | null
          conteudo?: string
          created_at?: string
          data_expiracao?: string | null
          data_publicacao?: string
          destinatarios?: string
          id?: string
          instituicao_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_instituicao: {
        Row: {
          cor_primaria: string | null
          cor_secundaria: string | null
          cor_terciaria: string | null
          created_at: string
          descricao: string | null
          email: string | null
          endereco: string | null
          id: string
          imagem_capa_login_url: string | null
          instituicao_id: string | null
          logo_url: string | null
          nome_instituicao: string
          telefone: string | null
          tipo_instituicao: string
          updated_at: string
        }
        Insert: {
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_terciaria?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          imagem_capa_login_url?: string | null
          instituicao_id?: string | null
          logo_url?: string | null
          nome_instituicao?: string
          telefone?: string | null
          tipo_instituicao?: string
          updated_at?: string
        }
        Update: {
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_terciaria?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          imagem_capa_login_url?: string | null
          instituicao_id?: string | null
          logo_url?: string | null
          nome_instituicao?: string
          telefone?: string | null
          tipo_instituicao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_instituicao_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_landing: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          tipo: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: []
      }
      contratos_funcionario: {
        Row: {
          arquivo_url: string | null
          carga_horaria: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          funcionario_id: string
          id: string
          nome_arquivo: string | null
          observacoes: string | null
          renovado_de: string | null
          salario: number
          status: string
          tipo_contrato: string
          updated_at: string
        }
        Insert: {
          arquivo_url?: string | null
          carga_horaria?: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          funcionario_id: string
          id?: string
          nome_arquivo?: string | null
          observacoes?: string | null
          renovado_de?: string | null
          salario?: number
          status?: string
          tipo_contrato?: string
          updated_at?: string
        }
        Update: {
          arquivo_url?: string | null
          carga_horaria?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          funcionario_id?: string
          id?: string
          nome_arquivo?: string | null
          observacoes?: string | null
          renovado_de?: string | null
          salario?: number
          status?: string
          tipo_contrato?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_funcionario_renovado_de_fkey"
            columns: ["renovado_de"]
            isOneToOne: false
            referencedRelation: "contratos_funcionario"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          ativo: boolean
          carga_horaria: number
          codigo: string
          created_at: string
          descricao: string | null
          duracao: string | null
          grau: string | null
          id: string
          instituicao_id: string | null
          nome: string
          tipo: string | null
          valor_mensalidade: number
        }
        Insert: {
          ativo?: boolean
          carga_horaria?: number
          codigo: string
          created_at?: string
          descricao?: string | null
          duracao?: string | null
          grau?: string | null
          id?: string
          instituicao_id?: string | null
          nome: string
          tipo?: string | null
          valor_mensalidade?: number
        }
        Update: {
          ativo?: boolean
          carga_horaria?: number
          codigo?: string
          created_at?: string
          descricao?: string | null
          duracao?: string | null
          grau?: string | null
          id?: string
          instituicao_id?: string | null
          nome?: string
          tipo?: string | null
          valor_mensalidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "cursos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          instituicao_id: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          instituicao_id?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          instituicao_id?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          carga_horaria: number
          created_at: string
          curso_id: string
          id: string
          instituicao_id: string | null
          nome: string
          obrigatoria: boolean | null
          semestre: number
          tipo_disciplina: string | null
          trimestres_oferecidos: number[] | null
          updated_at: string
        }
        Insert: {
          carga_horaria?: number
          created_at?: string
          curso_id: string
          id?: string
          instituicao_id?: string | null
          nome: string
          obrigatoria?: boolean | null
          semestre: number
          tipo_disciplina?: string | null
          trimestres_oferecidos?: number[] | null
          updated_at?: string
        }
        Update: {
          carga_horaria?: number
          created_at?: string
          curso_id?: string
          id?: string
          instituicao_id?: string | null
          nome?: string
          obrigatoria?: boolean | null
          semestre?: number
          tipo_disciplina?: string | null
          trimestres_oferecidos?: number[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_aluno: {
        Row: {
          aluno_id: string
          arquivo_url: string
          created_at: string
          descricao: string | null
          id: string
          nome_arquivo: string
          tamanho_bytes: number | null
          tipo_documento: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          aluno_id: string
          arquivo_url: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome_arquivo: string
          tamanho_bytes?: number | null
          tipo_documento: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          aluno_id?: string
          arquivo_url?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome_arquivo?: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_aluno_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_aluno_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_emitidos: {
        Row: {
          aluno_id: string
          created_at: string
          dados_adicionais: Json | null
          data_emissao: string
          data_validade: string | null
          emitido_por: string | null
          id: string
          numero_documento: string
          observacoes: string | null
          status: string
          tipo_documento_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          dados_adicionais?: Json | null
          data_emissao?: string
          data_validade?: string | null
          emitido_por?: string | null
          id?: string
          numero_documento: string
          observacoes?: string | null
          status?: string
          tipo_documento_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          dados_adicionais?: Json | null
          data_emissao?: string
          data_validade?: string | null
          emitido_por?: string | null
          id?: string
          numero_documento?: string
          observacoes?: string | null
          status?: string
          tipo_documento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_emitidos_tipo_documento_id_fkey"
            columns: ["tipo_documento_id"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_funcionario: {
        Row: {
          arquivo_url: string
          created_at: string
          data_vencimento: string | null
          descricao: string | null
          funcionario_id: string
          id: string
          nome_arquivo: string
          tamanho_bytes: number | null
          tipo_documento: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          funcionario_id: string
          id?: string
          nome_arquivo: string
          tamanho_bytes?: number | null
          tipo_documento: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          funcionario_id?: string
          id?: string
          nome_arquivo?: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_funcionario_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          assunto: string
          ativo: boolean
          corpo_html: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          variaveis: string[] | null
        }
        Insert: {
          assunto: string
          ativo?: boolean
          corpo_html: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Update: {
          assunto?: string
          ativo?: boolean
          corpo_html?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Relationships: []
      }
      emails_enviados: {
        Row: {
          assunto: string
          created_at: string
          destinatario_email: string
          destinatario_nome: string | null
          erro: string | null
          id: string
          instituicao_id: string | null
          status: string
          tipo: string
        }
        Insert: {
          assunto: string
          created_at?: string
          destinatario_email: string
          destinatario_nome?: string | null
          erro?: string | null
          id?: string
          instituicao_id?: string | null
          status?: string
          tipo: string
        }
        Update: {
          assunto?: string
          created_at?: string
          destinatario_email?: string
          destinatario_nome?: string | null
          erro?: string | null
          id?: string
          instituicao_id?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_enviados_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_calendario: {
        Row: {
          cor: string | null
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          instituicao_id: string | null
          recorrente: boolean | null
          tipo: string
          titulo: string
          updated_at: string
          visivel_para: string[] | null
        }
        Insert: {
          cor?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          instituicao_id?: string | null
          recorrente?: boolean | null
          tipo?: string
          titulo: string
          updated_at?: string
          visivel_para?: string[] | null
        }
        Update: {
          cor?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          instituicao_id?: string | null
          recorrente?: boolean | null
          tipo?: string
          titulo?: string
          updated_at?: string
          visivel_para?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_calendario_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_calendario_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      exames: {
        Row: {
          created_at: string
          data_exame: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          nome: string
          observacoes: string | null
          peso: number
          sala: string | null
          status: string
          tipo: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_exame: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          peso?: number
          sala?: string | null
          status?: string
          tipo?: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_exame?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          peso?: number
          sala?: string | null
          status?: string
          tipo?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exames_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_pagamento: {
        Row: {
          ano: number
          aprovado_por: string | null
          beneficio_alimentacao: number
          beneficio_transporte: number
          bonus: number
          created_at: string
          data_pagamento: string | null
          descontos_faltas: number
          forma_pagamento: string | null
          funcionario_id: string
          gerado_por: string | null
          horas_extras: number
          id: string
          inss: number
          irt: number
          mes: number
          observacoes: string | null
          outros_beneficios: number
          outros_descontos: number
          salario_base: number
          salario_liquido: number
          status: string
          updated_at: string
          valor_horas_extras: number
        }
        Insert: {
          ano: number
          aprovado_por?: string | null
          beneficio_alimentacao?: number
          beneficio_transporte?: number
          bonus?: number
          created_at?: string
          data_pagamento?: string | null
          descontos_faltas?: number
          forma_pagamento?: string | null
          funcionario_id: string
          gerado_por?: string | null
          horas_extras?: number
          id?: string
          inss?: number
          irt?: number
          mes: number
          observacoes?: string | null
          outros_beneficios?: number
          outros_descontos?: number
          salario_base?: number
          salario_liquido?: number
          status?: string
          updated_at?: string
          valor_horas_extras?: number
        }
        Update: {
          ano?: number
          aprovado_por?: string | null
          beneficio_alimentacao?: number
          beneficio_transporte?: number
          bonus?: number
          created_at?: string
          data_pagamento?: string | null
          descontos_faltas?: number
          forma_pagamento?: string | null
          funcionario_id?: string
          gerado_por?: string | null
          horas_extras?: number
          id?: string
          inss?: number
          irt?: number
          mes?: number
          observacoes?: string | null
          outros_beneficios?: number
          outros_descontos?: number
          salario_base?: number
          salario_liquido?: number
          status?: string
          updated_at?: string
          valor_horas_extras?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencias: {
        Row: {
          aluno_id: string
          aula_id: string
          id: string
          justificativa: string | null
          presente: boolean
        }
        Insert: {
          aluno_id: string
          aula_id: string
          id?: string
          justificativa?: string | null
          presente?: boolean
        }
        Update: {
          aluno_id?: string
          aula_id?: string
          id?: string
          justificativa?: string | null
          presente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "frequencias_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_frequencias: {
        Row: {
          aprovado_por: string | null
          created_at: string
          data: string
          funcionario_id: string
          hora_entrada: string | null
          hora_saida: string | null
          id: string
          justificativa: string | null
          observacoes: string | null
          status: string
          turno: string
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string
          data: string
          funcionario_id: string
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string
          justificativa?: string | null
          observacoes?: string | null
          status?: string
          turno?: string
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string
          data?: string
          funcionario_id?: string
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string
          justificativa?: string | null
          observacoes?: string | null
          status?: string
          turno?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_frequencias_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_frequencias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          carga_horaria: string | null
          cargo_id: string | null
          created_at: string
          data_admissao: string
          data_demissao: string | null
          data_fim_contrato: string | null
          departamento_id: string | null
          id: string
          instituicao_id: string | null
          observacoes: string | null
          salario: number | null
          status: string
          tipo_contrato: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carga_horaria?: string | null
          cargo_id?: string | null
          created_at?: string
          data_admissao?: string
          data_demissao?: string | null
          data_fim_contrato?: string | null
          departamento_id?: string | null
          id?: string
          instituicao_id?: string | null
          observacoes?: string | null
          salario?: number | null
          status?: string
          tipo_contrato?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carga_horaria?: string | null
          cargo_id?: string | null
          created_at?: string
          data_admissao?: string
          data_demissao?: string | null
          data_fim_contrato?: string | null
          departamento_id?: string | null
          id?: string
          instituicao_id?: string | null
          observacoes?: string | null
          salario?: number | null
          status?: string
          tipo_contrato?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_rh: {
        Row: {
          alterado_por: string | null
          campo_alterado: string | null
          created_at: string
          funcionario_id: string
          id: string
          observacao: string | null
          tipo_alteracao: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_por?: string | null
          campo_alterado?: string | null
          created_at?: string
          funcionario_id: string
          id?: string
          observacao?: string | null
          tipo_alteracao: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_por?: string | null
          campo_alterado?: string | null
          created_at?: string
          funcionario_id?: string
          id?: string
          observacao?: string | null
          tipo_alteracao?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_rh_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_rh_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios: {
        Row: {
          created_at: string
          dia_semana: string
          disciplina_id: string | null
          hora_fim: string
          hora_inicio: string
          id: string
          sala: string | null
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_semana: string
          disciplina_id?: string | null
          hora_fim: string
          hora_inicio: string
          id?: string
          sala?: string | null
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_semana?: string
          disciplina_id?: string | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          sala?: string | null
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      instituicoes: {
        Row: {
          created_at: string
          email_contato: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          status: string
          subdominio: string
          telefone: string | null
          tipo_instituicao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_contato?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          status?: string
          subdominio: string
          telefone?: string | null
          tipo_instituicao?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_contato?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          status?: string
          subdominio?: string
          telefone?: string | null
          tipo_instituicao?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads_comerciais: {
        Row: {
          atendido_por: string | null
          cidade: string | null
          created_at: string
          data_contato: string | null
          email: string
          id: string
          mensagem: string | null
          nome_instituicao: string
          nome_responsavel: string
          notas: string | null
          plano_interesse: string | null
          status: string
          telefone: string
          updated_at: string
        }
        Insert: {
          atendido_por?: string | null
          cidade?: string | null
          created_at?: string
          data_contato?: string | null
          email: string
          id?: string
          mensagem?: string | null
          nome_instituicao: string
          nome_responsavel: string
          notas?: string | null
          plano_interesse?: string | null
          status?: string
          telefone: string
          updated_at?: string
        }
        Update: {
          atendido_por?: string | null
          cidade?: string | null
          created_at?: string
          data_contato?: string | null
          email?: string
          id?: string
          mensagem?: string | null
          nome_instituicao?: string
          nome_responsavel?: string
          notas?: string | null
          plano_interesse?: string | null
          status?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_comerciais_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempt_count: number
          created_at: string
          email: string
          id: string
          last_attempt_at: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          email: string
          id?: string
          last_attempt_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          email?: string
          id?: string
          last_attempt_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      logs_auditoria: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          instituicao_id: string | null
          ip_address: string | null
          registro_id: string | null
          tabela: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          instituicao_id?: string | null
          ip_address?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          instituicao_id?: string | null
          ip_address?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_auditoria_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_redefinicao_senha: {
        Row: {
          created_at: string
          enviado_por_email: boolean | null
          id: string
          ip_address: string | null
          redefinido_por_email: string
          redefinido_por_id: string
          redefinido_por_nome: string
          usuario_afetado_email: string
          usuario_afetado_id: string
          usuario_afetado_nome: string
        }
        Insert: {
          created_at?: string
          enviado_por_email?: boolean | null
          id?: string
          ip_address?: string | null
          redefinido_por_email: string
          redefinido_por_id: string
          redefinido_por_nome: string
          usuario_afetado_email: string
          usuario_afetado_id: string
          usuario_afetado_nome: string
        }
        Update: {
          created_at?: string
          enviado_por_email?: boolean | null
          id?: string
          ip_address?: string | null
          redefinido_por_email?: string
          redefinido_por_id?: string
          redefinido_por_nome?: string
          usuario_afetado_email?: string
          usuario_afetado_id?: string
          usuario_afetado_nome?: string
        }
        Relationships: []
      }
      matriculas: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          status: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          status?: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          status?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_responsavel: {
        Row: {
          aluno_id: string
          assunto: string
          created_at: string
          data_resposta: string | null
          id: string
          lida: boolean
          mensagem: string
          professor_id: string
          respondida: boolean
          responsavel_id: string
          resposta: string | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          assunto: string
          created_at?: string
          data_resposta?: string | null
          id?: string
          lida?: boolean
          mensagem: string
          professor_id: string
          respondida?: boolean
          responsavel_id: string
          resposta?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          assunto?: string
          created_at?: string
          data_resposta?: string | null
          id?: string
          lida?: boolean
          mensagem?: string
          professor_id?: string
          respondida?: boolean
          responsavel_id?: string
          resposta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_responsavel_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mensalidades: {
        Row: {
          aluno_id: string
          ano_referencia: number
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento: string | null
          id: string
          instituicao_id: string | null
          mes_referencia: number
          multa: boolean
          observacoes: string | null
          percentual_multa: number | null
          recibo_numero: string | null
          status: string
          updated_at: string
          valor: number
          valor_multa: number | null
        }
        Insert: {
          aluno_id: string
          ano_referencia: number
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento?: string | null
          id?: string
          instituicao_id?: string | null
          mes_referencia: number
          multa?: boolean
          observacoes?: string | null
          percentual_multa?: number | null
          recibo_numero?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_multa?: number | null
        }
        Update: {
          aluno_id?: string
          ano_referencia?: number
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento?: string | null
          id?: string
          instituicao_id?: string | null
          mes_referencia?: number
          multa?: boolean
          observacoes?: string | null
          percentual_multa?: number | null
          recibo_numero?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_multa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mensalidades_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_financeiras: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          updated_at: string
          valor_meta: number
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          updated_at?: string
          valor_meta?: number
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          updated_at?: string
          valor_meta?: number
        }
        Relationships: []
      }
      notas: {
        Row: {
          created_at: string
          data: string
          id: string
          matricula_id: string
          observacao: string | null
          peso: number
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          matricula_id: string
          observacao?: string | null
          peso?: number
          tipo: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          peso?: number
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_historico: {
        Row: {
          alterado_por: string
          alterado_por_email: string
          alterado_por_nome: string
          created_at: string
          id: string
          matricula_id: string
          motivo: string | null
          nota_anterior: number
          nota_id: string
          nota_nova: number
          tipo_nota: string
        }
        Insert: {
          alterado_por: string
          alterado_por_email: string
          alterado_por_nome: string
          created_at?: string
          id?: string
          matricula_id: string
          motivo?: string | null
          nota_anterior: number
          nota_id: string
          nota_nova: number
          tipo_nota: string
        }
        Update: {
          alterado_por?: string
          alterado_por_email?: string
          alterado_por_nome?: string
          created_at?: string
          id?: string
          matricula_id?: string
          motivo?: string | null
          nota_anterior?: number
          nota_id?: string
          nota_nova?: number
          tipo_nota?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_historico_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      pagamentos_instituicao: {
        Row: {
          analisado_por: string | null
          assinatura_id: string | null
          comprovativo_texto: string | null
          comprovativo_url: string | null
          confirmado_por: string | null
          created_at: string
          data_analise: string | null
          data_confirmacao: string | null
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento: string
          id: string
          instituicao_id: string
          nova_data_vencimento: string | null
          observacoes: string | null
          status: string
          telefone_contato: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          analisado_por?: string | null
          assinatura_id?: string | null
          comprovativo_texto?: string | null
          comprovativo_url?: string | null
          confirmado_por?: string | null
          created_at?: string
          data_analise?: string | null
          data_confirmacao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento?: string
          id?: string
          instituicao_id: string
          nova_data_vencimento?: string | null
          observacoes?: string | null
          status?: string
          telefone_contato?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          analisado_por?: string | null
          assinatura_id?: string | null
          comprovativo_texto?: string | null
          comprovativo_url?: string | null
          confirmado_por?: string | null
          created_at?: string
          data_analise?: string | null
          data_confirmacao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento?: string
          id?: string
          instituicao_id?: string
          nova_data_vencimento?: string | null
          observacoes?: string | null
          status?: string
          telefone_contato?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_instituicao_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_instituicao_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_instituicao_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos_letivos: {
        Row: {
          ano_letivo: number
          ativo: boolean | null
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          instituicao_id: string | null
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ano_letivo: number
          ativo?: boolean | null
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          instituicao_id?: string | null
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ano_letivo?: number
          ativo?: boolean | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          instituicao_id?: string | null
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodos_letivos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          funcionalidades: Json | null
          id: string
          limite_alunos: number | null
          limite_cursos: number | null
          limite_professores: number | null
          nome: string
          preco_mensal: number
          preco_secundario: number | null
          preco_universitario: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          funcionalidades?: Json | null
          id?: string
          limite_alunos?: number | null
          limite_cursos?: number | null
          limite_professores?: number | null
          nome: string
          preco_mensal?: number
          preco_secundario?: number | null
          preco_universitario?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          funcionalidades?: Json | null
          id?: string
          limite_alunos?: number | null
          limite_cursos?: number | null
          limite_professores?: number | null
          nome?: string
          preco_mensal?: number
          preco_secundario?: number | null
          preco_universitario?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      preferencias_notificacao: {
        Row: {
          created_at: string
          email_academico: boolean
          email_comunicados: boolean
          email_financeiro: boolean
          id: string
          notificacao_push: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_academico?: boolean
          email_comunicados?: boolean
          email_financeiro?: boolean
          id?: string
          notificacao_push?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_academico?: boolean
          email_comunicados?: boolean
          email_financeiro?: boolean
          id?: string
          notificacao_push?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professor_disciplinas: {
        Row: {
          ano: number
          created_at: string
          disciplina_id: string
          id: string
          professor_id: string
          semestre: string
          trimestres: number[] | null
        }
        Insert: {
          ano: number
          created_at?: string
          disciplina_id: string
          id?: string
          professor_id: string
          semestre: string
          trimestres?: number[] | null
        }
        Update: {
          ano?: number
          created_at?: string
          disciplina_id?: string
          id?: string
          professor_id?: string
          semestre?: string
          trimestres?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "professor_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_disciplinas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo_atual: string | null
          cidade: string | null
          codigo_funcionario: string | null
          codigo_postal: string | null
          created_at: string
          data_admissao: string | null
          data_nascimento: string | null
          data_saida: string | null
          email: string
          genero: string | null
          horas_trabalho: string | null
          id: string
          instituicao_id: string | null
          morada: string | null
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          numero_identificacao: string | null
          numero_identificacao_publica: string | null
          pais: string | null
          profissao: string | null
          qualificacao: string | null
          status_aluno: string | null
          telefone: string | null
          tipo_sanguineo: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cargo_atual?: string | null
          cidade?: string | null
          codigo_funcionario?: string | null
          codigo_postal?: string | null
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          data_saida?: string | null
          email: string
          genero?: string | null
          horas_trabalho?: string | null
          id: string
          instituicao_id?: string | null
          morada?: string | null
          nome_completo: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero_identificacao?: string | null
          numero_identificacao_publica?: string | null
          pais?: string | null
          profissao?: string | null
          qualificacao?: string | null
          status_aluno?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cargo_atual?: string | null
          cidade?: string | null
          codigo_funcionario?: string | null
          codigo_postal?: string | null
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          data_saida?: string | null
          email?: string
          genero?: string | null
          horas_trabalho?: string | null
          id?: string
          instituicao_id?: string | null
          morada?: string | null
          nome_completo?: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero_identificacao?: string | null
          numero_identificacao_publica?: string | null
          pais?: string | null
          profissao?: string | null
          qualificacao?: string | null
          status_aluno?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      responsavel_alunos: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          parentesco: string
          responsavel_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          parentesco?: string
          responsavel_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          parentesco?: string
          responsavel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsavel_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saft_exports: {
        Row: {
          arquivo_nome: string
          created_at: string
          id: string
          instituicao_id: string
          periodo_fim: string
          periodo_inicio: string
          status: string
          total_clientes: number
          total_faturas: number
          total_produtos: number
          usuario_email: string
          usuario_id: string
          usuario_nome: string
          valor_total: number
        }
        Insert: {
          arquivo_nome: string
          created_at?: string
          id?: string
          instituicao_id: string
          periodo_fim: string
          periodo_inicio: string
          status?: string
          total_clientes?: number
          total_faturas?: number
          total_produtos?: number
          usuario_email: string
          usuario_id: string
          usuario_nome: string
          valor_total?: number
        }
        Update: {
          arquivo_nome?: string
          created_at?: string
          id?: string
          instituicao_id?: string
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          total_clientes?: number
          total_faturas?: number
          total_produtos?: number
          usuario_email?: string
          usuario_id?: string
          usuario_nome?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "saft_exports_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saft_exports_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sequencias_identificacao: {
        Row: {
          created_at: string
          id: string
          prefixo: string
          tipo: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          prefixo: string
          tipo: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          prefixo?: string
          tipo?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: []
      }
      tipos_documento: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          requer_assinatura: boolean
          taxa: number | null
          template_html: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          requer_assinatura?: boolean
          taxa?: number | null
          template_html: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          requer_assinatura?: boolean
          taxa?: number | null
          template_html?: string
          updated_at?: string
        }
        Relationships: []
      }
      trimestres_fechados: {
        Row: {
          ano_letivo: number
          created_at: string
          data_fechamento: string | null
          fechado: boolean
          fechado_por: string | null
          id: string
          instituicao_id: string
          observacoes: string | null
          trimestre: number
          updated_at: string
        }
        Insert: {
          ano_letivo: number
          created_at?: string
          data_fechamento?: string | null
          fechado?: boolean
          fechado_por?: string | null
          id?: string
          instituicao_id: string
          observacoes?: string | null
          trimestre: number
          updated_at?: string
        }
        Update: {
          ano_letivo?: number
          created_at?: string
          data_fechamento?: string | null
          fechado?: boolean
          fechado_por?: string | null
          id?: string
          instituicao_id?: string
          observacoes?: string | null
          trimestre?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trimestres_fechados_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trimestres_fechados_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          ano: number
          created_at: string
          curso_estudo_id: string | null
          curso_id: string
          horario: string | null
          id: string
          instituicao_id: string | null
          nome: string
          professor_id: string
          sala: string | null
          semestre: string
          turno: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          curso_estudo_id?: string | null
          curso_id: string
          horario?: string | null
          id?: string
          instituicao_id?: string | null
          nome: string
          professor_id: string
          sala?: string | null
          semestre: string
          turno?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          curso_estudo_id?: string | null
          curso_id?: string
          horario?: string | null
          id?: string
          instituicao_id?: string | null
          nome?: string
          professor_id?: string
          sala?: string | null
          semestre?: string
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turmas_curso_estudo_id_fkey"
            columns: ["curso_estudo_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          ativo: boolean
          created_at: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          instituicao_id: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          instituicao_id?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          instituicao_id?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          instituicao_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instituicao_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instituicao_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aluno_tem_inadimplencia: { Args: { _aluno_id: string }; Returns: boolean }
      aplicar_multas_mensalidades: { Args: never; Returns: undefined }
      can_view_turma: {
        Args: { _turma_id: string; _user_id: string }
        Returns: boolean
      }
      count_active_allocations: { Args: { room_id: string }; Returns: number }
      gerar_numero_documento: { Args: never; Returns: string }
      gerar_numero_identificacao_publica: {
        Args: { _tipo: string }
        Returns: string
      }
      get_lockout_remaining: { Args: { p_email: string }; Returns: number }
      get_user_instituicao: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_uso_instituicao: {
        Args: { _instituicao_id: string }
        Returns: {
          alunos_atual: number
          alunos_limite: number
          assinatura_status: string
          cursos_atual: number
          cursos_limite: number
          plano_nome: string
          professores_atual: number
          professores_limite: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      instituicao_assinatura_expirada: {
        Args: { _instituicao_id: string }
        Returns: boolean
      }
      is_account_locked: { Args: { p_email: string }; Returns: boolean }
      professor_can_view_student: {
        Args: { _professor_id: string; _student_id: string }
        Returns: boolean
      }
      professor_owns_turma: {
        Args: { _professor_id: string; _turma_id: string }
        Returns: boolean
      }
      professor_pode_editar_nota: {
        Args: { _professor_id: string; _turma_id: string }
        Returns: boolean
      }
      record_failed_login: { Args: { p_email: string }; Returns: Json }
      registrar_log_auditoria: {
        Args: {
          _acao: string
          _dados_anteriores?: Json
          _dados_novos?: Json
          _registro_id?: string
          _tabela?: string
        }
        Returns: undefined
      }
      reset_login_attempts: { Args: { p_email: string }; Returns: undefined }
      trimestre_fechado: {
        Args: {
          _ano_letivo: number
          _instituicao_id: string
          _trimestre: number
        }
        Returns: boolean
      }
      user_belongs_to_instituicao: {
        Args: { _instituicao_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_instituicao_bloqueada: {
        Args: { _user_id: string }
        Returns: boolean
      }
      verificar_limite_alunos: {
        Args: { _instituicao_id: string }
        Returns: boolean
      }
      verificar_limite_cursos: {
        Args: { _instituicao_id: string }
        Returns: boolean
      }
      verificar_limite_professores: {
        Args: { _instituicao_id: string }
        Returns: boolean
      }
    }
    Enums: {
      genero_quarto: "Masculino" | "Feminino" | "Misto"
      status_alocacao: "Ativo" | "Inativo"
      status_quarto: "Livre" | "Ocupado" | "Em manutenção"
      tipo_quarto: "Solteiro" | "Duplo" | "Triplo"
      user_role:
        | "ADMIN"
        | "PROFESSOR"
        | "ALUNO"
        | "SECRETARIA"
        | "POS"
        | "RESPONSAVEL"
        | "SUPER_ADMIN"
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
      genero_quarto: ["Masculino", "Feminino", "Misto"],
      status_alocacao: ["Ativo", "Inativo"],
      status_quarto: ["Livre", "Ocupado", "Em manutenção"],
      tipo_quarto: ["Solteiro", "Duplo", "Triplo"],
      user_role: [
        "ADMIN",
        "PROFESSOR",
        "ALUNO",
        "SECRETARIA",
        "POS",
        "RESPONSAVEL",
        "SUPER_ADMIN",
      ],
    },
  },
} as const
