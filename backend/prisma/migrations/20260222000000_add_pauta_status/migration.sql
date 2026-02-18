-- CreateEnum
CREATE TYPE "PautaStatus" AS ENUM ('RASCUNHO', 'PROVISORIA', 'DEFINITIVA');

-- AlterTable
ALTER TABLE "plano_ensino" ADD COLUMN "pauta_status" "PautaStatus" DEFAULT 'RASCUNHO';
