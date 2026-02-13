-- AlterTable: Remover campos semestre e classe_id da tabela disciplinas
-- DISCIPLINA é ESTRUTURAL - semestre e classe pertencem ao PlanoEnsino, não à Disciplina

-- DropIndex: Remover índice em classe_id (se existir)
DROP INDEX IF EXISTS "disciplinas_classe_id_idx";

-- DropForeignKey: Remover foreign key para classe_id (se existir)
ALTER TABLE "disciplinas" DROP CONSTRAINT IF EXISTS "disciplinas_classe_id_fkey";

-- AlterTable: Remover colunas semestre e classe_id
ALTER TABLE "disciplinas" DROP COLUMN IF EXISTS "semestre";
ALTER TABLE "disciplinas" DROP COLUMN IF EXISTS "classe_id";

