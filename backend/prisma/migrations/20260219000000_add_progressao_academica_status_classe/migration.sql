-- AlterTable: ParametrosSistema - disciplinas negativas e override reprovado
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "disciplinas_negativas_permitidas" INTEGER DEFAULT 0;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "permitir_override_matricula_reprovado" BOOLEAN DEFAULT false;

-- AlterTable: Classe - ordem para progressão
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "ordem" INTEGER DEFAULT 0;

-- AlterTable: MatriculaAnual - status final e classe próxima
ALTER TABLE "matriculas_anuais" ADD COLUMN IF NOT EXISTS "status_final" TEXT;
ALTER TABLE "matriculas_anuais" ADD COLUMN IF NOT EXISTS "classe_proxima_sugerida" TEXT;
ALTER TABLE "matriculas_anuais" ADD COLUMN IF NOT EXISTS "classe_proxima_sugerida_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "matriculas_anuais_classe_proxima_sugerida_id_idx" ON "matriculas_anuais"("classe_proxima_sugerida_id");
CREATE INDEX IF NOT EXISTS "matriculas_anuais_status_final_idx" ON "matriculas_anuais"("status_final");

-- AddForeignKey: classe_proxima_sugerida_id references classes (optional - may fail if column doesn't exist yet)
-- Prisma will add this when running migrate deploy
ALTER TABLE "matriculas_anuais" DROP CONSTRAINT IF EXISTS "matriculas_anuais_classe_proxima_sugerida_id_fkey";
ALTER TABLE "matriculas_anuais" ADD CONSTRAINT "matriculas_anuais_classe_proxima_sugerida_id_fkey" FOREIGN KEY ("classe_proxima_sugerida_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
