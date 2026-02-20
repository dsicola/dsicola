-- AlterTable
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "taxa_matricula" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "taxa_matricula" DECIMAL(12,2);
