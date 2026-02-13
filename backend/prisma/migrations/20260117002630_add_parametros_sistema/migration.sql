-- CreateTable
CREATE TABLE "parametros_sistema" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "quantidade_semestres_por_ano" INTEGER DEFAULT 2,
    "permitir_reprovacao_disciplina" BOOLEAN DEFAULT true,
    "permitir_dependencia" BOOLEAN DEFAULT true,
    "permitir_matricula_fora_periodo" BOOLEAN DEFAULT false,
    "bloquear_matricula_divida" BOOLEAN DEFAULT true,
    "permitir_transferencia_turma" BOOLEAN DEFAULT true,
    "permitir_matricula_sem_documentos" BOOLEAN DEFAULT false,
    "tipo_media" TEXT DEFAULT 'simples',
    "permitir_exame_recurso" BOOLEAN DEFAULT false,
    "percentual_minimo_aprovacao" DECIMAL(5,2) DEFAULT 10,
    "perfis_alterar_notas" TEXT[] DEFAULT ARRAY['ADMIN', 'PROFESSOR']::TEXT[],
    "perfis_cancelar_matricula" TEXT[] DEFAULT ARRAY['ADMIN']::TEXT[],
    "ativar_logs_academicos" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametros_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parametros_sistema_instituicao_id_key" ON "parametros_sistema"("instituicao_id");

-- AddForeignKey
ALTER TABLE "parametros_sistema" ADD CONSTRAINT "parametros_sistema_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

