-- AlterTable: Tolerância configurável acima do limite de alunos (ex: 10% = 30 permite até 33)
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "tolerancia_percentual_limite_alunos" INTEGER DEFAULT 10;
