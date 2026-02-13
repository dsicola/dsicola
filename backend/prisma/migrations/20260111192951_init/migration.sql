-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DIRECAO', 'COORDENADOR', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'AUDITOR', 'POS', 'RESPONSAVEL');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('ativa', 'suspensa', 'cancelada', 'teste', 'expirada');

-- CreateEnum
CREATE TYPE "StatusPagamentoLicenca" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MetodoPagamentoLicenca" AS ENUM ('TRANSFERENCIA', 'DEPOSITO', 'MULTICAIXA', 'AIRTM', 'RODETPAY', 'CASH', 'MOBILE_MONEY', 'ONLINE');

-- CreateEnum
CREATE TYPE "PeriodoPagamentoLicenca" AS ENUM ('MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "StatusMatricula" AS ENUM ('Ativa', 'Trancada', 'Concluida', 'Cancelada');

-- CreateEnum
CREATE TYPE "StatusMensalidade" AS ENUM ('Pendente', 'Pago', 'Parcial', 'Atrasado', 'Cancelado');

-- CreateEnum
CREATE TYPE "StatusQuarto" AS ENUM ('Livre', 'Ocupado', 'Manutencao');

-- CreateEnum
CREATE TYPE "GeneroQuarto" AS ENUM ('Masculino', 'Feminino', 'Misto');

-- CreateEnum
CREATE TYPE "TipoQuarto" AS ENUM ('Individual', 'Duplo', 'Triplo', 'Coletivo');

-- CreateEnum
CREATE TYPE "StatusAlocacao" AS ENUM ('Ativo', 'Inativo', 'Transferido');

-- CreateEnum
CREATE TYPE "TipoInstituicao" AS ENUM ('ENSINO_MEDIO', 'UNIVERSIDADE', 'MISTA', 'EM_CONFIGURACAO');

-- CreateEnum
CREATE TYPE "TipoAcademico" AS ENUM ('SECUNDARIO', 'SUPERIOR');

-- CreateEnum
CREATE TYPE "TipoVideo" AS ENUM ('YOUTUBE', 'VIMEO', 'UPLOAD');

-- CreateEnum
CREATE TYPE "ModuloVideoAula" AS ENUM ('ACADEMICO', 'FINANCEIRO', 'CONFIGURACOES', 'GERAL');

-- CreateEnum
CREATE TYPE "StatusMatriculaAnual" AS ENUM ('ATIVA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusFrequenciaFuncionario" AS ENUM ('PRESENTE', 'ATRASO', 'FALTA', 'FALTA_JUSTIFICADA', 'FALTA_NAO_JUSTIFICADA', 'INCOMPLETO');

-- CreateEnum
CREATE TYPE "StatusFolhaPagamento" AS ENUM ('DRAFT', 'CALCULATED', 'CLOSED', 'PAID');

-- CreateEnum
CREATE TYPE "OrigemPresenca" AS ENUM ('BIOMETRIA', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoDispositivoBiometrico" AS ENUM ('ZKTECO', 'HIKVISION', 'SUPREMA');

-- CreateEnum
CREATE TYPE "TipoEventoBiometrico" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "StatusJustificativa" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "TipoDocumentoFiscal" AS ENUM ('RECIBO', 'FATURA');

-- CreateEnum
CREATE TYPE "TipoCargo" AS ENUM ('ACADEMICO', 'ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "StatusFuncionario" AS ENUM ('ATIVO', 'SUSPENSO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoVinculo" AS ENUM ('EFETIVO', 'CONTRATADO', 'TEMPORARIO');

-- CreateEnum
CREATE TYPE "RegimeTrabalho" AS ENUM ('INTEGRAL', 'PARCIAL');

-- CreateEnum
CREATE TYPE "CategoriaDocente" AS ENUM ('ASSISTENTE', 'AUXILIAR', 'ADJUNTO', 'ASSOCIADO', 'TITULAR', 'VISITANTE');

-- CreateEnum
CREATE TYPE "TipoPermissao" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'SUBMIT', 'APPROVE', 'REJECT', 'CLOSE', 'REOPEN', 'BLOCK', 'EXPORT');

-- CreateEnum
CREATE TYPE "ModuloPermissao" AS ENUM ('CALENDARIO_ACADEMICO', 'PLANO_ENSINO', 'DISTRIBUICAO_AULAS', 'LANCAMENTO_AULAS', 'PRESENCAS', 'AVALIACOES_NOTAS', 'USUARIOS', 'TURMAS', 'DISCIPLINAS', 'CURSOS', 'MATRICULAS', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "StatusEncerramento" AS ENUM ('ABERTO', 'EM_ENCERRAMENTO', 'ENCERRADO', 'REABERTO');

-- CreateEnum
CREATE TYPE "TipoPeriodo" AS ENUM ('TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'SEMESTRE_1', 'SEMESTRE_2', 'ANO');

-- CreateEnum
CREATE TYPE "StatusAulaPlanejada" AS ENUM ('PLANEJADA', 'MINISTRADA');

-- CreateEnum
CREATE TYPE "TipoAula" AS ENUM ('TEORICA', 'PRATICA');

-- CreateEnum
CREATE TYPE "StatusWorkflow" AS ENUM ('RASCUNHO', 'SUBMETIDO', 'APROVADO', 'REJEITADO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstadoRegistro" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'APROVADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "StatusPresenca" AS ENUM ('PRESENTE', 'AUSENTE', 'JUSTIFICADO');

-- CreateEnum
CREATE TYPE "StatusSemestre" AS ENUM ('PLANEJADO', 'ATIVO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusAnoLetivo" AS ENUM ('PLANEJADO', 'ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoAvaliacao" AS ENUM ('PROVA', 'TESTE', 'TRABALHO', 'PROVA_FINAL', 'RECUPERACAO');

-- CreateEnum
CREATE TYPE "TipoRelatorio" AS ENUM ('PLANO_ENSINO_OFICIAL', 'MAPA_AULAS_MINISTRADAS', 'MAPA_PRESENCAS', 'ATA_AVALIACOES', 'BOLETIM_ALUNO', 'PAUTA_FINAL', 'HISTORICO_ACADEMICO', 'DECLARACAO_MATRICULA', 'DECLARACAO_FREQUENCIA', 'MAPA_PRESENCAS_OFICIAL', 'RELATORIO_FECHAMENTO_ACADEMICO', 'RELATORIO_FINAL_ANO_LETIVO', 'RELATORIO_PONTO_DIARIO', 'RELATORIO_PONTO_MENSAL', 'RELATORIO_PONTO_INDIVIDUAL');

-- CreateEnum
CREATE TYPE "StatusRelatorio" AS ENUM ('GERANDO', 'CONCLUIDO', 'ERRO');

-- CreateEnum
CREATE TYPE "TipoItemBiblioteca" AS ENUM ('FISICO', 'DIGITAL');

-- CreateEnum
CREATE TYPE "StatusEmprestimoBiblioteca" AS ENUM ('ATIVO', 'DEVOLVIDO', 'ATRASADO');

-- CreateTable
CREATE TABLE "instituicoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "subdominio" TEXT NOT NULL,
    "logo_url" TEXT,
    "email_contato" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "tipo_instituicao" "TipoInstituicao" NOT NULL DEFAULT 'EM_CONFIGURACAO',
    "tipo_academico" "TipoAcademico",
    "multa_percentual" DECIMAL(5,2),
    "juros_dia" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instituicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "telefone" TEXT,
    "data_nascimento" TIMESTAMP(3),
    "genero" TEXT,
    "numero_identificacao" TEXT,
    "numero_identificacao_publica" TEXT,
    "morada" TEXT,
    "cidade" TEXT,
    "pais" TEXT,
    "provincia" TEXT,
    "avatar_url" TEXT,
    "status_aluno" TEXT DEFAULT 'Ativo',
    "instituicao_id" TEXT,
    "cargo_id" TEXT,
    "departamento_id" TEXT,
    "onboarding_concluido" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_concluido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "valor_mensal" DECIMAL(10,2) NOT NULL,
    "valor_anual" DECIMAL(10,2),
    "preco_secundario" DECIMAL(10,2),
    "preco_universitario" DECIMAL(10,2),
    "limite_alunos" INTEGER,
    "limite_professores" INTEGER,
    "limite_cursos" INTEGER,
    "funcionalidades" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_precos" (
    "id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "tipo_instituicao" "TipoAcademico" NOT NULL,
    "valor_mensal" DECIMAL(10,2) NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'AOA',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_precos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'ativa',
    "tipo" TEXT NOT NULL DEFAULT 'PAGA',
    "data_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMP(3),
    "data_proximo_pagamento" TIMESTAMP(3),
    "valor_atual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipo_periodo" TEXT NOT NULL DEFAULT 'mensal',
    "em_teste" BOOLEAN NOT NULL DEFAULT false,
    "dias_teste" INTEGER,
    "data_fim_teste" TIMESTAMP(3),
    "dias_antes_lembrete" INTEGER DEFAULT 7,
    "dias_carencia_analise" INTEGER DEFAULT 3,
    "ultimo_lembrete_enviado" TIMESTAMP(3),
    "iban" TEXT,
    "multicaixa_numero" TEXT,
    "instrucoes_pagamento" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_licenca" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "assinatura_id" TEXT,
    "plano_id" TEXT,
    "plano" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "periodo" "PeriodoPagamentoLicenca" NOT NULL,
    "status" "StatusPagamentoLicenca" NOT NULL DEFAULT 'PENDING',
    "metodo" "MetodoPagamentoLicenca" NOT NULL DEFAULT 'TRANSFERENCIA',
    "referencia" TEXT,
    "comprovativo_url" TEXT,
    "observacoes" TEXT,
    "gateway" TEXT,
    "gateway_id" TEXT,
    "gateway_data" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pago_em" TIMESTAMP(3),
    "confirmado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_licenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_fiscais" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDocumentoFiscal" NOT NULL DEFAULT 'RECIBO',
    "numero_documento" TEXT NOT NULL,
    "pagamento_licenca_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "plano_nome" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'AOA',
    "data_emissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_url" TEXT,
    "pdf_blob" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "carga_horaria" INTEGER NOT NULL DEFAULT 0,
    "valor_mensalidade" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "multa_percentual" DECIMAL(5,2),
    "juros_dia" DECIMAL(5,2),
    "duracao" TEXT,
    "grau" TEXT,
    "tipo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "carga_horaria" INTEGER NOT NULL DEFAULT 0,
    "valor_mensalidade" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "multa_percentual" DECIMAL(5,2),
    "juros_dia" DECIMAL(5,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "carga_horaria" INTEGER NOT NULL DEFAULT 0,
    "semestre" INTEGER NOT NULL,
    "obrigatoria" BOOLEAN DEFAULT true,
    "tipo_disciplina" TEXT,
    "trimestres_oferecidos" INTEGER[],
    "curso_id" TEXT,
    "classe_id" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "hora_inicio" TEXT,
    "hora_fim" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "semestre" TEXT,
    "sala" TEXT,
    "capacidade" INTEGER NOT NULL DEFAULT 30,
    "curso_id" TEXT,
    "classe_id" TEXT,
    "disciplina_id" TEXT,
    "professor_id" TEXT,
    "turno_id" TEXT,
    "instituicao_id" TEXT,
    "ano_letivo_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "turma_id" TEXT NOT NULL,
    "data_matricula" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusMatricula" NOT NULL DEFAULT 'Ativa',
    "ano_letivo" INTEGER,
    "ano_letivo_id" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas_anuais" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "nivel_ensino" "TipoAcademico" NOT NULL,
    "classe_ou_ano_curso" TEXT NOT NULL,
    "curso_id" TEXT,
    "classe_id" TEXT,
    "status" "StatusMatriculaAnual" NOT NULL DEFAULT 'ATIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "disciplinaId" TEXT,

    CONSTRAINT "matriculas_anuais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aluno_disciplinas" (
    "id" TEXT NOT NULL,
    "matricula_anual_id" TEXT,
    "aluno_id" TEXT NOT NULL,
    "disciplina_id" TEXT NOT NULL,
    "turma_id" TEXT,
    "ano" INTEGER NOT NULL,
    "semestre" TEXT NOT NULL,
    "semestre_id" TEXT,
    "trimestre_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Cursando',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aluno_disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas" (
    "id" TEXT NOT NULL,
    "turma_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "conteudo" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequencias" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "aula_id" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "justificativa" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frequencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exames" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "turma_id" TEXT NOT NULL,
    "data_exame" TIMESTAMP(3) NOT NULL,
    "hora_inicio" TEXT,
    "hora_fim" TEXT,
    "sala" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'prova',
    "peso" DECIMAL(3,2) NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'agendado',
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "exame_id" TEXT,
    "avaliacao_id" TEXT,
    "valor" DECIMAL(5,2) NOT NULL,
    "observacoes" TEXT,
    "lancado_por" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios" (
    "id" TEXT NOT NULL,
    "turma_id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fim" TEXT NOT NULL,
    "sala" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensalidades" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "curso_id" TEXT,
    "classe_id" TEXT,
    "mes_referencia" TEXT NOT NULL,
    "ano_referencia" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "valor_desconto" DECIMAL(10,2) DEFAULT 0,
    "valor_multa" DECIMAL(10,2) DEFAULT 0,
    "valor_juros" DECIMAL(10,2) DEFAULT 0,
    "percentual_multa" DECIMAL(5,2) DEFAULT 2,
    "juros_dia" DECIMAL(5,2),
    "multa" BOOLEAN NOT NULL DEFAULT false,
    "data_vencimento" TIMESTAMP(3) NOT NULL,
    "data_pagamento" TIMESTAMP(3),
    "status" "StatusMensalidade" NOT NULL DEFAULT 'Pendente',
    "metodo_pagamento" TEXT,
    "comprovativo" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mensalidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_multa" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "multa_percentual" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "juros_dia_percentual" DECIMAL(5,2) NOT NULL DEFAULT 0.033,
    "dias_tolerancia" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_multa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "mensalidade_id" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "metodo_pagamento" TEXT NOT NULL,
    "data_pagamento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrado_por" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolsas_descontos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'percentual',
    "valor" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bolsas_descontos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aluno_bolsas" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "bolsa_id" TEXT NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aluno_bolsas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicados" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'informativo',
    "tipo_envio" TEXT NOT NULL DEFAULT 'GERAL',
    "destinatarios" TEXT NOT NULL DEFAULT 'todos',
    "data_publicacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_expiracao" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "autor_id" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comunicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicado_destinatarios" (
    "id" TEXT NOT NULL,
    "comunicado_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referencia_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunicado_destinatarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicado_leituras" (
    "id" TEXT NOT NULL,
    "comunicado_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "data_leitura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunicado_leituras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_calendario" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'evento',
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "hora_inicio" TEXT,
    "hora_fim" TEXT,
    "cor" TEXT,
    "recorrente" BOOLEAN DEFAULT false,
    "visivel_para" TEXT[],
    "criado_por" TEXT,
    "status" "StatusWorkflow" NOT NULL DEFAULT 'RASCUNHO',
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_calendario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anos_letivos" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "status" "StatusAnoLetivo" NOT NULL DEFAULT 'PLANEJADO',
    "instituicao_id" TEXT,
    "ativado_por" TEXT,
    "ativado_em" TIMESTAMP(3),
    "encerrado_por" TEXT,
    "encerrado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anos_letivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semestres" (
    "id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "data_inicio_notas" TIMESTAMP(3),
    "data_fim_notas" TIMESTAMP(3),
    "status" "StatusSemestre" NOT NULL DEFAULT 'PLANEJADO',
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'RASCUNHO',
    "instituicao_id" TEXT,
    "ativado_por" TEXT,
    "ativado_em" TIMESTAMP(3),
    "encerrado_por" TEXT,
    "encerrado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "encerramento_ativado_id" TEXT,
    "encerramento_encerrado_id" TEXT,

    CONSTRAINT "semestres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trimestres" (
    "id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "data_inicio_notas" TIMESTAMP(3),
    "data_fim_notas" TIMESTAMP(3),
    "status" "StatusSemestre" NOT NULL DEFAULT 'PLANEJADO',
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'RASCUNHO',
    "instituicao_id" TEXT,
    "ativado_por" TEXT,
    "ativado_em" TIMESTAMP(3),
    "encerrado_por" TEXT,
    "encerrado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trimestres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_documento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "template" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_emitidos" (
    "id" TEXT NOT NULL,
    "tipo_documento_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "numero_documento" TEXT NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_validade" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'emitido',
    "dados_adicionais" JSONB,
    "emitido_por" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_emitidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_aluno" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "arquivo_url" TEXT NOT NULL,
    "tamanho_bytes" INTEGER,
    "descricao" TEXT,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidaturas" (
    "id" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "data_nascimento" TIMESTAMP(3),
    "genero" TEXT,
    "numero_identificacao" TEXT NOT NULL,
    "morada" TEXT,
    "cidade" TEXT,
    "pais" TEXT,
    "curso_pretendido" TEXT,
    "turno_preferido" TEXT,
    "documentos_url" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "data_candidatura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_analise" TIMESTAMP(3),
    "analisado_por" TEXT,
    "observacoes" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alojamentos" (
    "id" TEXT NOT NULL,
    "nome_bloco" TEXT NOT NULL,
    "numero_quarto" TEXT NOT NULL,
    "tipo_quarto" "TipoQuarto" NOT NULL DEFAULT 'Individual',
    "genero" "GeneroQuarto" NOT NULL DEFAULT 'Misto',
    "capacidade" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusQuarto" NOT NULL DEFAULT 'Livre',
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alojamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alocacoes_alojamento" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "alojamento_id" TEXT NOT NULL,
    "data_entrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_saida" TIMESTAMP(3),
    "status" "StatusAlocacao" NOT NULL DEFAULT 'Ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alocacoes_alojamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcionarios" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "nome_completo" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "data_nascimento" TIMESTAMP(3),
    "genero" TEXT,
    "numero_identificacao" TEXT,
    "morada" TEXT,
    "cidade" TEXT,
    "pais" TEXT,
    "provincia" TEXT,
    "municipio" TEXT,
    "nome_pai" TEXT,
    "nome_mae" TEXT,
    "foto_url" TEXT,
    "grau_academico" TEXT,
    "grau_academico_outro" TEXT,
    "data_admissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_demissao" TIMESTAMP(3),
    "cargo_id" TEXT,
    "departamento_id" TEXT,
    "salario_base" DECIMAL(10,2),
    "status" "StatusFuncionario" NOT NULL DEFAULT 'ATIVO',
    "tipo_vinculo" "TipoVinculo",
    "regime_trabalho" "RegimeTrabalho",
    "carga_horaria_semanal" INTEGER,
    "categoria_docente" "CategoriaDocente",
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departamentos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoCargo" NOT NULL DEFAULT 'ADMINISTRATIVO',
    "salario_base" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_funcionario" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "cargo_id" TEXT,
    "tipo_contrato" "TipoVinculo" NOT NULL DEFAULT 'CONTRATADO',
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "salario" DECIMAL(10,2),
    "carga_horaria" TEXT NOT NULL DEFAULT '40h',
    "status" "StatusFuncionario" NOT NULL DEFAULT 'ATIVO',
    "arquivo_url" TEXT,
    "nome_arquivo" TEXT,
    "renovado_de" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folha_pagamento" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "dias_uteis" INTEGER NOT NULL DEFAULT 0,
    "salario_base" DECIMAL(10,2) NOT NULL,
    "valor_dia" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_faltas_nao_justificadas" INTEGER NOT NULL DEFAULT 0,
    "horas_extras" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valor_hora" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_horas_extras" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "beneficio_transporte" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "beneficio_alimentacao" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outros_beneficios" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "inss" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "irt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "descontos_faltas" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outros_descontos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salario_liquido" DECIMAL(10,2) NOT NULL,
    "status" "StatusFolhaPagamento" NOT NULL DEFAULT 'DRAFT',
    "fechado_em" TIMESTAMP(3),
    "fechado_por" TEXT,
    "reaberto_em" TIMESTAMP(3),
    "reaberto_por" TEXT,
    "justificativa_reabertura" TEXT,
    "pago_em" TIMESTAMP(3),
    "pago_por" TEXT,
    "metodo_pagamento" TEXT,
    "referencia" TEXT,
    "observacao_pagamento" TEXT,
    "data_pagamento" TIMESTAMP(3),
    "forma_pagamento" TEXT,
    "gerado_por" TEXT,
    "aprovado_por" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folha_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequencia_funcionarios" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "hora_entrada" TEXT,
    "hora_saida" TEXT,
    "horas_trabalhadas" DECIMAL(5,2),
    "horas_extras" DECIMAL(5,2) DEFAULT 0,
    "status" "StatusFrequenciaFuncionario" NOT NULL DEFAULT 'PRESENTE',
    "origem" "OrigemPresenca" NOT NULL DEFAULT 'MANUAL',
    "observacoes" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frequencia_funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometrias_funcionarios" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "template_hash" TEXT NOT NULL,
    "dedo" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biometrias_funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "justificativas_falta" (
    "id" TEXT NOT NULL,
    "frequencia_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "documento_url" TEXT,
    "status" "StatusJustificativa" NOT NULL DEFAULT 'PENDENTE',
    "aprovado_por" TEXT,
    "aprovado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "justificativas_falta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_biometricos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoDispositivoBiometrico" NOT NULL,
    "ip" TEXT NOT NULL,
    "porta" INTEGER NOT NULL DEFAULT 4370,
    "token" TEXT NOT NULL,
    "ips_permitidos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_status" TEXT,
    "ultima_sincronizacao" TIMESTAMP(3),
    "instituicao_id" TEXT NOT NULL,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivos_biometricos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_biometricos_usuarios" (
    "id" TEXT NOT NULL,
    "dispositivo_id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "device_user_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivos_biometricos_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_biometricos" (
    "id" TEXT NOT NULL,
    "dispositivo_id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "tipo_evento" "TipoEventoBiometrico" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_origem" TEXT,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_biometricos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_funcionario" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "arquivo_url" TEXT NOT NULL,
    "tamanho_bytes" INTEGER,
    "data_vencimento" TIMESTAMP(3),
    "descricao" TEXT,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficios_funcionario" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficios_funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_funcionario" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "data_avaliacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota_desempenho" DECIMAL(3,2),
    "nota_pontualidade" DECIMAL(3,2),
    "nota_competencia" DECIMAL(3,2),
    "nota_relacionamento" DECIMAL(3,2),
    "media_final" DECIMAL(3,2),
    "pontos_fortes" TEXT,
    "pontos_melhoria" TEXT,
    "metas" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "avaliado_por" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacoes_funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_instituicao" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "nome_instituicao" TEXT NOT NULL DEFAULT 'DSICOLA',
    "tipo_instituicao" TEXT NOT NULL DEFAULT 'ENSINO_MEDIO',
    "tipo_academico" "TipoAcademico",
    "logo_url" TEXT,
    "imagem_capa_login_url" TEXT,
    "favicon_url" TEXT,
    "cor_primaria" TEXT,
    "cor_secundaria" TEXT,
    "cor_terciaria" TEXT,
    "descricao" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "pais" TEXT,
    "moeda_padrao" TEXT DEFAULT 'AOA',
    "idioma" TEXT DEFAULT 'pt',
    "nome_fiscal" TEXT,
    "email_fiscal" TEXT,
    "telefone_fiscal" TEXT,
    "endereco_fiscal" TEXT,
    "cidade_fiscal" TEXT,
    "provincia_fiscal" TEXT,
    "pais_fiscal" TEXT,
    "codigo_postal_fiscal" TEXT,
    "nif" TEXT,
    "cnpj" TEXT,
    "inscricao_estadual" TEXT,
    "codigo_servico_financas" TEXT,
    "identificacao_fiscal_generica" TEXT,
    "regime_fiscal" TEXT DEFAULT 'normal',
    "serie_documentos" TEXT,
    "numeracao_automatica" BOOLEAN NOT NULL DEFAULT true,
    "moeda_faturacao" TEXT,
    "percentual_imposto_padrao" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_instituicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "corpo_html" TEXT NOT NULL,
    "variaveis" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_aulas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "url_video" TEXT NOT NULL,
    "tipo_video" "TipoVideo" NOT NULL DEFAULT 'YOUTUBE',
    "modulo" "ModuloVideoAula" NOT NULL DEFAULT 'GERAL',
    "perfil_alvo" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "tipo_instituicao" "TipoAcademico",
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_aula_progresso" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_aula_id" TEXT NOT NULL,
    "assistido" BOOLEAN NOT NULL DEFAULT false,
    "percentual_assistido" INTEGER NOT NULL DEFAULT 0,
    "ultima_visualizacao" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_aula_progresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamento_trilhas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "perfil" "UserRole" NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinamento_trilhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamento_trilha_aulas" (
    "id" TEXT NOT NULL,
    "trilha_id" TEXT NOT NULL,
    "video_aula_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinamento_trilha_aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails_enviados" (
    "id" TEXT NOT NULL,
    "destinatario_email" TEXT NOT NULL,
    "destinatario_nome" TEXT,
    "assunto" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "erro" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "modulo" TEXT,
    "entidade" TEXT,
    "entidade_id" TEXT,
    "acao" TEXT NOT NULL,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "user_id" TEXT,
    "perfil_usuario" TEXT,
    "rota" TEXT,
    "ip_origem" TEXT,
    "user_agent" TEXT,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_email" TEXT,
    "user_nome" TEXT,
    "tabela" TEXT,
    "registro_id" TEXT,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "modulo" "ModuloPermissao" NOT NULL,
    "acao" "TipoPermissao" NOT NULL,
    "recurso" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission_id" TEXT NOT NULL,
    "contextos" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_contexts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "curso_id" TEXT,
    "disciplina_id" TEXT,
    "turma_id" TEXT,
    "ano_letivo" INTEGER,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "planoEnsinoId" TEXT,

    CONSTRAINT "user_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_landing" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'text',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_landing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads_comerciais" (
    "id" TEXT NOT NULL,
    "nome_instituicao" TEXT NOT NULL,
    "nome_contato" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "cidade" TEXT,
    "tipo_instituicao" TEXT,
    "quantidade_alunos" TEXT,
    "mensagem" TEXT,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "data_contato" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_comerciais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_history" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "user_id" TEXT,
    "user_email" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'em_progresso',
    "arquivo_url" TEXT,
    "tamanho_bytes" INTEGER,
    "erro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_schedules" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "frequencia" TEXT NOT NULL DEFAULT 'diario',
    "hora_execucao" TEXT NOT NULL DEFAULT '03:00',
    "dia_semana" INTEGER,
    "dia_mes" INTEGER,
    "tipo_backup" TEXT NOT NULL DEFAULT 'completo',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_backup" TIMESTAMP(3),
    "proximo_backup" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequencias_identificacao" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequencias_identificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trimestres_fechados" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "fechado" BOOLEAN NOT NULL DEFAULT false,
    "fechado_por" TEXT,
    "data_fechamento" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trimestres_fechados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encerramentos_academicos" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "periodo" "TipoPeriodo" NOT NULL,
    "status" "StatusEncerramento" NOT NULL DEFAULT 'ABERTO',
    "encerrado_por" TEXT,
    "encerrado_em" TIMESTAMP(3),
    "justificativa" TEXT,
    "reaberto_por" TEXT,
    "reaberto_em" TIMESTAMP(3),
    "justificativa_reabertura" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encerramentos_academicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metas_financeiras" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "valor_meta" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'info',
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_redefinicao_senha" (
    "id" TEXT NOT NULL,
    "redefinido_por_id" TEXT NOT NULL,
    "redefinido_por_email" TEXT NOT NULL,
    "redefinido_por_nome" TEXT NOT NULL,
    "usuario_afetado_id" TEXT NOT NULL,
    "usuario_afetado_email" TEXT NOT NULL,
    "usuario_afetado_nome" TEXT NOT NULL,
    "enviado_por_email" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_redefinicao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_instituicao" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "assinatura_id" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "data_vencimento" TIMESTAMP(3),
    "data_pagamento" TIMESTAMP(3),
    "forma_pagamento" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "comprovativo_texto" TEXT,
    "comprovativo_url" TEXT,
    "telefone_contato" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_instituicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saft_exports" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "usuario_nome" TEXT,
    "usuario_email" TEXT,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fim" TIMESTAMP(3) NOT NULL,
    "arquivo_nome" TEXT,
    "arquivo_url" TEXT,
    "total_clientes" INTEGER,
    "total_produtos" INTEGER,
    "total_faturas" INTEGER,
    "total_documentos" INTEGER,
    "valor_total" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'gerado',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saft_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_rh" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "tipo_alteracao" TEXT NOT NULL,
    "campo_alterado" TEXT,
    "valor_anterior" TEXT,
    "valor_novo" TEXT,
    "alterado_por" TEXT,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_rh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_responsavel" (
    "id" TEXT NOT NULL,
    "responsavel_id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "resposta" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "data_resposta" TIMESTAMP(3),
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mensagens_responsavel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsavel_alunos" (
    "id" TEXT NOT NULL,
    "responsavel_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "parentesco" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsavel_alunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriados" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'NACIONAL',
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_ensino" (
    "id" TEXT NOT NULL,
    "curso_id" TEXT,
    "classe_id" TEXT,
    "disciplina_id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "turma_id" TEXT,
    "carga_horaria_total" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusWorkflow" NOT NULL DEFAULT 'RASCUNHO',
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'RASCUNHO',
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "data_bloqueio" TIMESTAMP(3),
    "bloqueado_por" TEXT,
    "instituicao_id" TEXT,
    "ementa" TEXT,
    "objetivos" TEXT,
    "metodologia" TEXT,
    "criterios_avaliacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plano_ensino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_aulas" (
    "id" TEXT NOT NULL,
    "plano_ensino_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoAula" NOT NULL DEFAULT 'TEORICA',
    "trimestre" INTEGER NOT NULL,
    "quantidade_aulas" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusAulaPlanejada" NOT NULL DEFAULT 'PLANEJADA',
    "data_ministrada" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plano_aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bibliografia_plano" (
    "id" TEXT NOT NULL,
    "plano_ensino_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "autor" TEXT,
    "editora" TEXT,
    "ano" INTEGER,
    "isbn" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'BIBLIOGRAFIA_BASICA',
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bibliografia_plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas_lancadas" (
    "id" TEXT NOT NULL,
    "plano_aula_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "semestre_id" TEXT,
    "trimestre_id" TEXT,
    "observacoes" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aulas_lancadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencas" (
    "id" TEXT NOT NULL,
    "aula_lancada_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "status" "StatusPresenca" NOT NULL DEFAULT 'PRESENTE',
    "observacoes" TEXT,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presencas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" TEXT NOT NULL,
    "plano_ensino_id" TEXT NOT NULL,
    "tipo" "TipoAvaliacao" NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "semestre_id" TEXT,
    "trimestre_id" TEXT,
    "peso" DECIMAL(3,2) NOT NULL DEFAULT 1,
    "data" TIMESTAMP(3) NOT NULL,
    "nome" TEXT,
    "descricao" TEXT,
    "status" "StatusWorkflow" NOT NULL DEFAULT 'RASCUNHO',
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'RASCUNHO',
    "fechada" BOOLEAN NOT NULL DEFAULT false,
    "fechada_por" TEXT,
    "fechada_em" TIMESTAMP(3),
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_logs" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "status_anterior" "StatusWorkflow",
    "status_novo" "StatusWorkflow" NOT NULL,
    "acao" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "observacao" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios_gerados" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "tipo_relatorio" "TipoRelatorio" NOT NULL,
    "referencia_id" TEXT,
    "gerado_por" TEXT,
    "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash_documento" TEXT,
    "status" "StatusRelatorio" NOT NULL DEFAULT 'GERANDO',
    "nome_arquivo" TEXT,
    "caminho_arquivo" TEXT,
    "tamanho_bytes" INTEGER,
    "observacoes" TEXT,
    "erro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relatorios_gerados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biblioteca_itens" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "autor" TEXT,
    "isbn" TEXT,
    "tipo" "TipoItemBiblioteca" NOT NULL DEFAULT 'FISICO',
    "categoria" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "localizacao" TEXT,
    "arquivo_url" TEXT,
    "thumbnail_url" TEXT,
    "descricao" TEXT,
    "editora" TEXT,
    "ano_publicacao" INTEGER,
    "edicao" TEXT,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biblioteca_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emprestimos_biblioteca" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "data_emprestimo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_prevista" TIMESTAMP(3) NOT NULL,
    "data_devolucao" TIMESTAMP(3),
    "status" "StatusEmprestimoBiblioteca" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emprestimos_biblioteca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instituicoes_subdominio_key" ON "instituicoes"("subdominio");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "login_attempts_email_key" ON "login_attempts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "planos_precos_plano_id_tipo_instituicao_key" ON "planos_precos"("plano_id", "tipo_instituicao");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_instituicao_id_key" ON "assinaturas"("instituicao_id");

-- CreateIndex
CREATE INDEX "pagamentos_licenca_instituicao_id_idx" ON "pagamentos_licenca"("instituicao_id");

-- CreateIndex
CREATE INDEX "pagamentos_licenca_status_idx" ON "pagamentos_licenca"("status");

-- CreateIndex
CREATE INDEX "pagamentos_licenca_criado_em_idx" ON "pagamentos_licenca"("criado_em");

-- CreateIndex
CREATE INDEX "pagamentos_licenca_gateway_id_idx" ON "pagamentos_licenca"("gateway_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscais_pagamento_licenca_id_key" ON "documentos_fiscais"("pagamento_licenca_id");

-- CreateIndex
CREATE INDEX "documentos_fiscais_instituicao_id_idx" ON "documentos_fiscais"("instituicao_id");

-- CreateIndex
CREATE INDEX "documentos_fiscais_pagamento_licenca_id_idx" ON "documentos_fiscais"("pagamento_licenca_id");

-- CreateIndex
CREATE INDEX "documentos_fiscais_data_emissao_idx" ON "documentos_fiscais"("data_emissao");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscais_instituicao_id_numero_documento_key" ON "documentos_fiscais"("instituicao_id", "numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_codigo_instituicao_id_key" ON "cursos"("codigo", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "classes_codigo_instituicao_id_key" ON "classes"("codigo", "instituicao_id");

-- CreateIndex
CREATE INDEX "disciplinas_curso_id_idx" ON "disciplinas"("curso_id");

-- CreateIndex
CREATE INDEX "disciplinas_classe_id_idx" ON "disciplinas"("classe_id");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_nome_instituicao_id_key" ON "turnos"("nome", "instituicao_id");

-- CreateIndex
CREATE INDEX "turmas_curso_id_idx" ON "turmas"("curso_id");

-- CreateIndex
CREATE INDEX "turmas_classe_id_idx" ON "turmas"("classe_id");

-- CreateIndex
CREATE INDEX "turmas_ano_letivo_id_idx" ON "turmas"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "matriculas_ano_letivo_id_idx" ON "matriculas"("ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_aluno_id_turma_id_key" ON "matriculas"("aluno_id", "turma_id");

-- CreateIndex
CREATE INDEX "matriculas_anuais_curso_id_idx" ON "matriculas_anuais"("curso_id");

-- CreateIndex
CREATE INDEX "matriculas_anuais_classe_id_idx" ON "matriculas_anuais"("classe_id");

-- CreateIndex
CREATE INDEX "matriculas_anuais_ano_letivo_id_idx" ON "matriculas_anuais"("ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_anuais_aluno_id_ano_letivo_instituicao_id_key" ON "matriculas_anuais"("aluno_id", "ano_letivo", "instituicao_id");

-- CreateIndex
CREATE INDEX "aluno_disciplinas_semestre_id_idx" ON "aluno_disciplinas"("semestre_id");

-- CreateIndex
CREATE INDEX "aluno_disciplinas_trimestre_id_idx" ON "aluno_disciplinas"("trimestre_id");

-- CreateIndex
CREATE UNIQUE INDEX "aluno_disciplinas_aluno_id_disciplina_id_ano_semestre_key" ON "aluno_disciplinas"("aluno_id", "disciplina_id", "ano", "semestre");

-- CreateIndex
CREATE UNIQUE INDEX "frequencias_aluno_id_aula_id_key" ON "frequencias"("aluno_id", "aula_id");

-- CreateIndex
CREATE INDEX "notas_avaliacao_id_idx" ON "notas"("avaliacao_id");

-- CreateIndex
CREATE INDEX "notas_instituicao_id_idx" ON "notas"("instituicao_id");

-- CreateIndex
CREATE INDEX "notas_aluno_id_idx" ON "notas"("aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "notas_aluno_id_exame_id_key" ON "notas"("aluno_id", "exame_id");

-- CreateIndex
CREATE UNIQUE INDEX "notas_aluno_id_avaliacao_id_key" ON "notas"("aluno_id", "avaliacao_id");

-- CreateIndex
CREATE INDEX "mensalidades_curso_id_idx" ON "mensalidades"("curso_id");

-- CreateIndex
CREATE INDEX "mensalidades_classe_id_idx" ON "mensalidades"("classe_id");

-- CreateIndex
CREATE UNIQUE INDEX "mensalidades_aluno_id_mes_referencia_ano_referencia_key" ON "mensalidades"("aluno_id", "mes_referencia", "ano_referencia");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_multa_instituicao_id_key" ON "configuracoes_multa"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "comunicado_leituras_comunicado_id_user_id_key" ON "comunicado_leituras"("comunicado_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "anos_letivos_ano_key" ON "anos_letivos"("ano");

-- CreateIndex
CREATE INDEX "anos_letivos_instituicao_id_idx" ON "anos_letivos"("instituicao_id");

-- CreateIndex
CREATE INDEX "anos_letivos_ano_idx" ON "anos_letivos"("ano");

-- CreateIndex
CREATE INDEX "anos_letivos_status_idx" ON "anos_letivos"("status");

-- CreateIndex
CREATE UNIQUE INDEX "anos_letivos_instituicao_id_ano_key" ON "anos_letivos"("instituicao_id", "ano");

-- CreateIndex
CREATE INDEX "semestres_instituicao_id_idx" ON "semestres"("instituicao_id");

-- CreateIndex
CREATE INDEX "semestres_ano_letivo_idx" ON "semestres"("ano_letivo");

-- CreateIndex
CREATE INDEX "semestres_ano_letivo_id_idx" ON "semestres"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "semestres_status_idx" ON "semestres"("status");

-- CreateIndex
CREATE INDEX "semestres_estado_idx" ON "semestres"("estado");

-- CreateIndex
CREATE INDEX "semestres_data_inicio_idx" ON "semestres"("data_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "semestres_instituicao_id_ano_letivo_numero_key" ON "semestres"("instituicao_id", "ano_letivo", "numero");

-- CreateIndex
CREATE INDEX "trimestres_instituicao_id_idx" ON "trimestres"("instituicao_id");

-- CreateIndex
CREATE INDEX "trimestres_ano_letivo_idx" ON "trimestres"("ano_letivo");

-- CreateIndex
CREATE INDEX "trimestres_ano_letivo_id_idx" ON "trimestres"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "trimestres_status_idx" ON "trimestres"("status");

-- CreateIndex
CREATE INDEX "trimestres_estado_idx" ON "trimestres"("estado");

-- CreateIndex
CREATE INDEX "trimestres_data_inicio_idx" ON "trimestres"("data_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "trimestres_instituicao_id_ano_letivo_numero_key" ON "trimestres"("instituicao_id", "ano_letivo", "numero");

-- CreateIndex
CREATE INDEX "funcionarios_instituicao_id_idx" ON "funcionarios"("instituicao_id");

-- CreateIndex
CREATE INDEX "funcionarios_status_idx" ON "funcionarios"("status");

-- CreateIndex
CREATE INDEX "funcionarios_tipo_vinculo_idx" ON "funcionarios"("tipo_vinculo");

-- CreateIndex
CREATE INDEX "funcionarios_cargo_id_idx" ON "funcionarios"("cargo_id");

-- CreateIndex
CREATE INDEX "departamentos_instituicao_id_ativo_idx" ON "departamentos"("instituicao_id", "ativo");

-- CreateIndex
CREATE INDEX "cargos_tipo_idx" ON "cargos"("tipo");

-- CreateIndex
CREATE INDEX "cargos_instituicao_id_ativo_idx" ON "cargos"("instituicao_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "folha_pagamento_funcionario_id_mes_ano_key" ON "folha_pagamento"("funcionario_id", "mes", "ano");

-- CreateIndex
CREATE INDEX "frequencia_funcionarios_funcionario_id_idx" ON "frequencia_funcionarios"("funcionario_id");

-- CreateIndex
CREATE INDEX "frequencia_funcionarios_data_idx" ON "frequencia_funcionarios"("data");

-- CreateIndex
CREATE INDEX "frequencia_funcionarios_status_idx" ON "frequencia_funcionarios"("status");

-- CreateIndex
CREATE INDEX "frequencia_funcionarios_origem_idx" ON "frequencia_funcionarios"("origem");

-- CreateIndex
CREATE UNIQUE INDEX "frequencia_funcionarios_funcionario_id_data_key" ON "frequencia_funcionarios"("funcionario_id", "data");

-- CreateIndex
CREATE INDEX "biometrias_funcionarios_funcionario_id_idx" ON "biometrias_funcionarios"("funcionario_id");

-- CreateIndex
CREATE INDEX "biometrias_funcionarios_instituicao_id_idx" ON "biometrias_funcionarios"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "biometrias_funcionarios_funcionario_id_dedo_key" ON "biometrias_funcionarios"("funcionario_id", "dedo");

-- CreateIndex
CREATE INDEX "justificativas_falta_status_idx" ON "justificativas_falta"("status");

-- CreateIndex
CREATE INDEX "justificativas_falta_instituicao_id_idx" ON "justificativas_falta"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "justificativas_falta_frequencia_id_key" ON "justificativas_falta"("frequencia_id");

-- CreateIndex
CREATE INDEX "dispositivos_biometricos_instituicao_id_idx" ON "dispositivos_biometricos"("instituicao_id");

-- CreateIndex
CREATE INDEX "dispositivos_biometricos_ativo_idx" ON "dispositivos_biometricos"("ativo");

-- CreateIndex
CREATE INDEX "dispositivos_biometricos_tipo_idx" ON "dispositivos_biometricos"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_biometricos_ip_porta_instituicao_id_key" ON "dispositivos_biometricos"("ip", "porta", "instituicao_id");

-- CreateIndex
CREATE INDEX "dispositivos_biometricos_usuarios_dispositivo_id_idx" ON "dispositivos_biometricos_usuarios"("dispositivo_id");

-- CreateIndex
CREATE INDEX "dispositivos_biometricos_usuarios_funcionario_id_idx" ON "dispositivos_biometricos_usuarios"("funcionario_id");

-- CreateIndex
CREATE INDEX "dispositivos_biometricos_usuarios_instituicao_id_idx" ON "dispositivos_biometricos_usuarios"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_biometricos_usuarios_dispositivo_id_funcionari_key" ON "dispositivos_biometricos_usuarios"("dispositivo_id", "funcionario_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_biometricos_usuarios_dispositivo_id_device_use_key" ON "dispositivos_biometricos_usuarios"("dispositivo_id", "device_user_id");

-- CreateIndex
CREATE INDEX "eventos_biometricos_dispositivo_id_idx" ON "eventos_biometricos"("dispositivo_id");

-- CreateIndex
CREATE INDEX "eventos_biometricos_funcionario_id_idx" ON "eventos_biometricos"("funcionario_id");

-- CreateIndex
CREATE INDEX "eventos_biometricos_tipo_evento_idx" ON "eventos_biometricos"("tipo_evento");

-- CreateIndex
CREATE INDEX "eventos_biometricos_timestamp_idx" ON "eventos_biometricos"("timestamp");

-- CreateIndex
CREATE INDEX "eventos_biometricos_processado_idx" ON "eventos_biometricos"("processado");

-- CreateIndex
CREATE INDEX "eventos_biometricos_instituicao_id_idx" ON "eventos_biometricos"("instituicao_id");

-- CreateIndex
CREATE INDEX "eventos_biometricos_instituicao_id_timestamp_idx" ON "eventos_biometricos"("instituicao_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_instituicao_instituicao_id_key" ON "configuracoes_instituicao"("instituicao_id");

-- CreateIndex
CREATE INDEX "video_aulas_modulo_idx" ON "video_aulas"("modulo");

-- CreateIndex
CREATE INDEX "video_aulas_perfil_alvo_idx" ON "video_aulas"("perfil_alvo");

-- CreateIndex
CREATE INDEX "video_aulas_tipo_instituicao_idx" ON "video_aulas"("tipo_instituicao");

-- CreateIndex
CREATE INDEX "video_aulas_ativo_idx" ON "video_aulas"("ativo");

-- CreateIndex
CREATE INDEX "video_aula_progresso_user_id_idx" ON "video_aula_progresso"("user_id");

-- CreateIndex
CREATE INDEX "video_aula_progresso_video_aula_id_idx" ON "video_aula_progresso"("video_aula_id");

-- CreateIndex
CREATE INDEX "video_aula_progresso_assistido_idx" ON "video_aula_progresso"("assistido");

-- CreateIndex
CREATE UNIQUE INDEX "video_aula_progresso_user_id_video_aula_id_key" ON "video_aula_progresso"("user_id", "video_aula_id");

-- CreateIndex
CREATE INDEX "treinamento_trilhas_perfil_idx" ON "treinamento_trilhas"("perfil");

-- CreateIndex
CREATE INDEX "treinamento_trilhas_ativo_idx" ON "treinamento_trilhas"("ativo");

-- CreateIndex
CREATE INDEX "treinamento_trilha_aulas_trilha_id_idx" ON "treinamento_trilha_aulas"("trilha_id");

-- CreateIndex
CREATE INDEX "treinamento_trilha_aulas_video_aula_id_idx" ON "treinamento_trilha_aulas"("video_aula_id");

-- CreateIndex
CREATE UNIQUE INDEX "treinamento_trilha_aulas_trilha_id_video_aula_id_key" ON "treinamento_trilha_aulas"("trilha_id", "video_aula_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_instituicao_id_idx" ON "logs_auditoria"("instituicao_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_modulo_idx" ON "logs_auditoria"("modulo");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_idx" ON "logs_auditoria"("entidade");

-- CreateIndex
CREATE INDEX "logs_auditoria_acao_idx" ON "logs_auditoria"("acao");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_id_idx" ON "logs_auditoria"("entidade_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_registro_id_idx" ON "logs_auditoria"("registro_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_created_at_idx" ON "logs_auditoria"("created_at");

-- CreateIndex
CREATE INDEX "logs_auditoria_user_id_idx" ON "logs_auditoria"("user_id");

-- CreateIndex
CREATE INDEX "permissions_modulo_idx" ON "permissions"("modulo");

-- CreateIndex
CREATE INDEX "permissions_acao_idx" ON "permissions"("acao");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_modulo_acao_recurso_key" ON "permissions"("modulo", "acao", "recurso");

-- CreateIndex
CREATE INDEX "role_permissions_role_idx" ON "role_permissions"("role");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_id_key" ON "role_permissions"("role", "permission_id");

-- CreateIndex
CREATE INDEX "user_contexts_user_id_idx" ON "user_contexts"("user_id");

-- CreateIndex
CREATE INDEX "user_contexts_instituicao_id_idx" ON "user_contexts"("instituicao_id");

-- CreateIndex
CREATE INDEX "user_contexts_curso_id_idx" ON "user_contexts"("curso_id");

-- CreateIndex
CREATE INDEX "user_contexts_disciplina_id_idx" ON "user_contexts"("disciplina_id");

-- CreateIndex
CREATE INDEX "user_contexts_turma_id_idx" ON "user_contexts"("turma_id");

-- CreateIndex
CREATE INDEX "user_contexts_tipo_idx" ON "user_contexts"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_landing_chave_key" ON "configuracoes_landing"("chave");

-- CreateIndex
CREATE INDEX "sequencias_identificacao_instituicao_id_idx" ON "sequencias_identificacao"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "sequencias_identificacao_tipo_instituicao_id_key" ON "sequencias_identificacao"("tipo", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "trimestres_fechados_instituicao_id_ano_letivo_trimestre_key" ON "trimestres_fechados"("instituicao_id", "ano_letivo", "trimestre");

-- CreateIndex
CREATE INDEX "encerramentos_academicos_instituicao_id_idx" ON "encerramentos_academicos"("instituicao_id");

-- CreateIndex
CREATE INDEX "encerramentos_academicos_ano_letivo_idx" ON "encerramentos_academicos"("ano_letivo");

-- CreateIndex
CREATE INDEX "encerramentos_academicos_status_idx" ON "encerramentos_academicos"("status");

-- CreateIndex
CREATE UNIQUE INDEX "encerramentos_academicos_instituicao_id_ano_letivo_periodo_key" ON "encerramentos_academicos"("instituicao_id", "ano_letivo", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "metas_financeiras_instituicao_id_mes_ano_key" ON "metas_financeiras"("instituicao_id", "mes", "ano");

-- CreateIndex
CREATE INDEX "notificacoes_instituicao_id_idx" ON "notificacoes"("instituicao_id");

-- CreateIndex
CREATE INDEX "notificacoes_user_id_idx" ON "notificacoes"("user_id");

-- CreateIndex
CREATE INDEX "mensagens_responsavel_instituicao_id_idx" ON "mensagens_responsavel"("instituicao_id");

-- CreateIndex
CREATE INDEX "mensagens_responsavel_responsavel_id_idx" ON "mensagens_responsavel"("responsavel_id");

-- CreateIndex
CREATE INDEX "mensagens_responsavel_professor_id_idx" ON "mensagens_responsavel"("professor_id");

-- CreateIndex
CREATE INDEX "mensagens_responsavel_aluno_id_idx" ON "mensagens_responsavel"("aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "responsavel_alunos_responsavel_id_aluno_id_key" ON "responsavel_alunos"("responsavel_id", "aluno_id");

-- CreateIndex
CREATE INDEX "plano_ensino_ano_letivo_id_idx" ON "plano_ensino"("ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "plano_ensino_curso_id_classe_id_disciplina_id_professor_id__key" ON "plano_ensino"("curso_id", "classe_id", "disciplina_id", "professor_id", "ano_letivo", "turma_id", "instituicao_id");

-- CreateIndex
CREATE INDEX "aulas_lancadas_plano_aula_id_idx" ON "aulas_lancadas"("plano_aula_id");

-- CreateIndex
CREATE INDEX "aulas_lancadas_instituicao_id_idx" ON "aulas_lancadas"("instituicao_id");

-- CreateIndex
CREATE INDEX "aulas_lancadas_semestre_id_idx" ON "aulas_lancadas"("semestre_id");

-- CreateIndex
CREATE INDEX "aulas_lancadas_trimestre_id_idx" ON "aulas_lancadas"("trimestre_id");

-- CreateIndex
CREATE INDEX "aulas_lancadas_data_idx" ON "aulas_lancadas"("data");

-- CreateIndex
CREATE INDEX "presencas_aula_lancada_id_idx" ON "presencas"("aula_lancada_id");

-- CreateIndex
CREATE INDEX "presencas_aluno_id_idx" ON "presencas"("aluno_id");

-- CreateIndex
CREATE INDEX "presencas_instituicao_id_idx" ON "presencas"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "presencas_aula_lancada_id_aluno_id_key" ON "presencas"("aula_lancada_id", "aluno_id");

-- CreateIndex
CREATE INDEX "avaliacoes_plano_ensino_id_idx" ON "avaliacoes"("plano_ensino_id");

-- CreateIndex
CREATE INDEX "avaliacoes_instituicao_id_idx" ON "avaliacoes"("instituicao_id");

-- CreateIndex
CREATE INDEX "avaliacoes_semestre_id_idx" ON "avaliacoes"("semestre_id");

-- CreateIndex
CREATE INDEX "avaliacoes_trimestre_id_idx" ON "avaliacoes"("trimestre_id");

-- CreateIndex
CREATE INDEX "avaliacoes_trimestre_idx" ON "avaliacoes"("trimestre");

-- CreateIndex
CREATE INDEX "avaliacoes_data_idx" ON "avaliacoes"("data");

-- CreateIndex
CREATE INDEX "avaliacoes_status_idx" ON "avaliacoes"("status");

-- CreateIndex
CREATE INDEX "avaliacoes_estado_idx" ON "avaliacoes"("estado");

-- CreateIndex
CREATE INDEX "workflow_logs_entidade_entidade_id_idx" ON "workflow_logs"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "workflow_logs_instituicao_id_idx" ON "workflow_logs"("instituicao_id");

-- CreateIndex
CREATE INDEX "workflow_logs_usuario_id_idx" ON "workflow_logs"("usuario_id");

-- CreateIndex
CREATE INDEX "workflow_logs_data_idx" ON "workflow_logs"("data");

-- CreateIndex
CREATE INDEX "relatorios_gerados_instituicao_id_idx" ON "relatorios_gerados"("instituicao_id");

-- CreateIndex
CREATE INDEX "relatorios_gerados_tipo_relatorio_idx" ON "relatorios_gerados"("tipo_relatorio");

-- CreateIndex
CREATE INDEX "relatorios_gerados_referencia_id_idx" ON "relatorios_gerados"("referencia_id");

-- CreateIndex
CREATE INDEX "relatorios_gerados_gerado_por_idx" ON "relatorios_gerados"("gerado_por");

-- CreateIndex
CREATE INDEX "relatorios_gerados_gerado_em_idx" ON "relatorios_gerados"("gerado_em");

-- CreateIndex
CREATE INDEX "relatorios_gerados_status_idx" ON "relatorios_gerados"("status");

-- CreateIndex
CREATE INDEX "biblioteca_itens_instituicao_id_idx" ON "biblioteca_itens"("instituicao_id");

-- CreateIndex
CREATE INDEX "biblioteca_itens_tipo_idx" ON "biblioteca_itens"("tipo");

-- CreateIndex
CREATE INDEX "biblioteca_itens_categoria_idx" ON "biblioteca_itens"("categoria");

-- CreateIndex
CREATE INDEX "emprestimos_biblioteca_instituicao_id_idx" ON "emprestimos_biblioteca"("instituicao_id");

-- CreateIndex
CREATE INDEX "emprestimos_biblioteca_item_id_idx" ON "emprestimos_biblioteca"("item_id");

-- CreateIndex
CREATE INDEX "emprestimos_biblioteca_usuario_id_idx" ON "emprestimos_biblioteca"("usuario_id");

-- CreateIndex
CREATE INDEX "emprestimos_biblioteca_status_idx" ON "emprestimos_biblioteca"("status");

-- CreateIndex
CREATE INDEX "emprestimos_biblioteca_data_emprestimo_idx" ON "emprestimos_biblioteca"("data_emprestimo");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_precos" ADD CONSTRAINT "planos_precos_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_licenca" ADD CONSTRAINT "pagamentos_licenca_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_licenca" ADD CONSTRAINT "pagamentos_licenca_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinaturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_licenca" ADD CONSTRAINT "pagamentos_licenca_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscais" ADD CONSTRAINT "documentos_fiscais_pagamento_licenca_id_fkey" FOREIGN KEY ("pagamento_licenca_id") REFERENCES "pagamentos_licenca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscais" ADD CONSTRAINT "documentos_fiscais_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinas" ADD CONSTRAINT "disciplinas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinas" ADD CONSTRAINT "disciplinas_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinas" ADD CONSTRAINT "disciplinas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_anuais" ADD CONSTRAINT "matriculas_anuais_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_anuais" ADD CONSTRAINT "matriculas_anuais_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_anuais" ADD CONSTRAINT "matriculas_anuais_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_anuais" ADD CONSTRAINT "matriculas_anuais_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_anuais" ADD CONSTRAINT "matriculas_anuais_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_anuais" ADD CONSTRAINT "matriculas_anuais_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_disciplinas" ADD CONSTRAINT "aluno_disciplinas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_disciplinas" ADD CONSTRAINT "aluno_disciplinas_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_disciplinas" ADD CONSTRAINT "aluno_disciplinas_matricula_anual_id_fkey" FOREIGN KEY ("matricula_anual_id") REFERENCES "matriculas_anuais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_disciplinas" ADD CONSTRAINT "aluno_disciplinas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_disciplinas" ADD CONSTRAINT "aluno_disciplinas_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_disciplinas" ADD CONSTRAINT "aluno_disciplinas_trimestre_id_fkey" FOREIGN KEY ("trimestre_id") REFERENCES "trimestres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencias" ADD CONSTRAINT "frequencias_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencias" ADD CONSTRAINT "frequencias_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exames" ADD CONSTRAINT "exames_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_exame_id_fkey" FOREIGN KEY ("exame_id") REFERENCES "exames"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "avaliacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_multa" ADD CONSTRAINT "configuracoes_multa_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_mensalidade_id_fkey" FOREIGN KEY ("mensalidade_id") REFERENCES "mensalidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolsas_descontos" ADD CONSTRAINT "bolsas_descontos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_bolsas" ADD CONSTRAINT "aluno_bolsas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_bolsas" ADD CONSTRAINT "aluno_bolsas_bolsa_id_fkey" FOREIGN KEY ("bolsa_id") REFERENCES "bolsas_descontos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado_destinatarios" ADD CONSTRAINT "comunicado_destinatarios_comunicado_id_fkey" FOREIGN KEY ("comunicado_id") REFERENCES "comunicados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado_leituras" ADD CONSTRAINT "comunicado_leituras_comunicado_id_fkey" FOREIGN KEY ("comunicado_id") REFERENCES "comunicados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado_leituras" ADD CONSTRAINT "comunicado_leituras_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_calendario" ADD CONSTRAINT "eventos_calendario_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anos_letivos" ADD CONSTRAINT "anos_letivos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anos_letivos" ADD CONSTRAINT "anos_letivos_ativado_por_fkey" FOREIGN KEY ("ativado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anos_letivos" ADD CONSTRAINT "anos_letivos_encerrado_por_fkey" FOREIGN KEY ("encerrado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_ativado_por_fkey" FOREIGN KEY ("ativado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_encerrado_por_fkey" FOREIGN KEY ("encerrado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_encerramento_ativado_id_fkey" FOREIGN KEY ("encerramento_ativado_id") REFERENCES "encerramentos_academicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_encerramento_encerrado_id_fkey" FOREIGN KEY ("encerramento_encerrado_id") REFERENCES "encerramentos_academicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_ativado_por_fkey" FOREIGN KEY ("ativado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_encerrado_por_fkey" FOREIGN KEY ("encerrado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_aluno" ADD CONSTRAINT "documentos_aluno_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alojamentos" ADD CONSTRAINT "alojamentos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacoes_alojamento" ADD CONSTRAINT "alocacoes_alojamento_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacoes_alojamento" ADD CONSTRAINT "alocacoes_alojamento_alojamento_id_fkey" FOREIGN KEY ("alojamento_id") REFERENCES "alojamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departamentos" ADD CONSTRAINT "departamentos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_funcionario" ADD CONSTRAINT "contratos_funcionario_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_funcionario" ADD CONSTRAINT "contratos_funcionario_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folha_pagamento" ADD CONSTRAINT "folha_pagamento_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencia_funcionarios" ADD CONSTRAINT "frequencia_funcionarios_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencia_funcionarios" ADD CONSTRAINT "frequencia_funcionarios_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometrias_funcionarios" ADD CONSTRAINT "biometrias_funcionarios_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometrias_funcionarios" ADD CONSTRAINT "biometrias_funcionarios_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_falta" ADD CONSTRAINT "justificativas_falta_frequencia_id_fkey" FOREIGN KEY ("frequencia_id") REFERENCES "frequencia_funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_falta" ADD CONSTRAINT "justificativas_falta_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_biometricos" ADD CONSTRAINT "dispositivos_biometricos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_biometricos_usuarios" ADD CONSTRAINT "dispositivos_biometricos_usuarios_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos_biometricos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_biometricos_usuarios" ADD CONSTRAINT "dispositivos_biometricos_usuarios_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_biometricos_usuarios" ADD CONSTRAINT "dispositivos_biometricos_usuarios_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_biometricos" ADD CONSTRAINT "eventos_biometricos_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos_biometricos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_biometricos" ADD CONSTRAINT "eventos_biometricos_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_biometricos" ADD CONSTRAINT "eventos_biometricos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_funcionario" ADD CONSTRAINT "documentos_funcionario_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios_funcionario" ADD CONSTRAINT "beneficios_funcionario_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_funcionario" ADD CONSTRAINT "avaliacoes_funcionario_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_instituicao" ADD CONSTRAINT "configuracoes_instituicao_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_aula_progresso" ADD CONSTRAINT "video_aula_progresso_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_aula_progresso" ADD CONSTRAINT "video_aula_progresso_video_aula_id_fkey" FOREIGN KEY ("video_aula_id") REFERENCES "video_aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_trilha_aulas" ADD CONSTRAINT "treinamento_trilha_aulas_trilha_id_fkey" FOREIGN KEY ("trilha_id") REFERENCES "treinamento_trilhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_trilha_aulas" ADD CONSTRAINT "treinamento_trilha_aulas_video_aula_id_fkey" FOREIGN KEY ("video_aula_id") REFERENCES "video_aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails_enviados" ADD CONSTRAINT "emails_enviados_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_planoEnsinoId_fkey" FOREIGN KEY ("planoEnsinoId") REFERENCES "plano_ensino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_history" ADD CONSTRAINT "backup_history_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_schedules" ADD CONSTRAINT "backup_schedules_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequencias_identificacao" ADD CONSTRAINT "sequencias_identificacao_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encerramentos_academicos" ADD CONSTRAINT "encerramentos_academicos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encerramentos_academicos" ADD CONSTRAINT "encerramentos_academicos_encerrado_por_fkey" FOREIGN KEY ("encerrado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encerramentos_academicos" ADD CONSTRAINT "encerramentos_academicos_reaberto_por_fkey" FOREIGN KEY ("reaberto_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_responsavel" ADD CONSTRAINT "mensagens_responsavel_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feriados" ADD CONSTRAINT "feriados_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_aulas" ADD CONSTRAINT "plano_aulas_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bibliografia_plano" ADD CONSTRAINT "bibliografia_plano_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_lancadas" ADD CONSTRAINT "aulas_lancadas_plano_aula_id_fkey" FOREIGN KEY ("plano_aula_id") REFERENCES "plano_aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_lancadas" ADD CONSTRAINT "aulas_lancadas_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_lancadas" ADD CONSTRAINT "aulas_lancadas_trimestre_id_fkey" FOREIGN KEY ("trimestre_id") REFERENCES "trimestres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_lancadas" ADD CONSTRAINT "aulas_lancadas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_aula_lancada_id_fkey" FOREIGN KEY ("aula_lancada_id") REFERENCES "aulas_lancadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_trimestre_id_fkey" FOREIGN KEY ("trimestre_id") REFERENCES "trimestres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_logs" ADD CONSTRAINT "workflow_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_logs" ADD CONSTRAINT "workflow_logs_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_gerados" ADD CONSTRAINT "relatorios_gerados_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_gerados" ADD CONSTRAINT "relatorios_gerados_gerado_por_fkey" FOREIGN KEY ("gerado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biblioteca_itens" ADD CONSTRAINT "biblioteca_itens_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimos_biblioteca" ADD CONSTRAINT "emprestimos_biblioteca_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "biblioteca_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimos_biblioteca" ADD CONSTRAINT "emprestimos_biblioteca_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimos_biblioteca" ADD CONSTRAINT "emprestimos_biblioteca_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
