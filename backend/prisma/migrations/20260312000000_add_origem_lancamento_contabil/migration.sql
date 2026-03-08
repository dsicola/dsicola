-- CreateEnum
CREATE TYPE "OrigemLancamentoContabil" AS ENUM ('AUTOMATICO', 'MANUAL');

-- AlterTable
ALTER TABLE "lancamentos_contabeis" ADD COLUMN "origem" "OrigemLancamentoContabil" NOT NULL DEFAULT 'MANUAL';
