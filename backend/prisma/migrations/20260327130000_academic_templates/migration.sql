-- Templates académicos versionados (mini-pauta / motor). Instituição aponta template ativo opcional.

CREATE TABLE "academic_templates" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "academic_templates_instituicao_id_idx" ON "academic_templates"("instituicao_id");
CREATE INDEX "academic_templates_instituicao_id_ativo_idx" ON "academic_templates"("instituicao_id", "ativo");

ALTER TABLE "academic_templates" ADD CONSTRAINT "academic_templates_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "instituicoes" ADD COLUMN "active_academic_template_id" TEXT;

ALTER TABLE "instituicoes" ADD CONSTRAINT "instituicoes_active_academic_template_id_fkey" FOREIGN KEY ("active_academic_template_id") REFERENCES "academic_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
