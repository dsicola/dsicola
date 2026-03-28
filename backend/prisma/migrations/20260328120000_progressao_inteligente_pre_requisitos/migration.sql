-- Progressão configurável + pré-requisitos CursoDisciplina (multi-tenant por linha em parametros_sistema / curso)

ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "progressao_reprov_bloqueia_subir_ano_classe" BOOLEAN DEFAULT true;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "progressao_max_disc_atraso_subir" INTEGER DEFAULT 2;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "progressao_usa_pre_requisitos" BOOLEAN DEFAULT true;

ALTER TABLE "curso_disciplina" ADD COLUMN IF NOT EXISTS "pre_requisito_disciplina_id" TEXT;

CREATE INDEX IF NOT EXISTS "curso_disciplina_pre_requisito_disciplina_id_idx" ON "curso_disciplina"("pre_requisito_disciplina_id");

ALTER TABLE "curso_disciplina" DROP CONSTRAINT IF EXISTS "curso_disciplina_pre_requisito_disciplina_id_fkey";
ALTER TABLE "curso_disciplina" ADD CONSTRAINT "curso_disciplina_pre_requisito_disciplina_id_fkey"
  FOREIGN KEY ("pre_requisito_disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
