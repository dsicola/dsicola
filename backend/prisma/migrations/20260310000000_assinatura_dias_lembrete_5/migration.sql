-- AlterTable: Alter default of dias_antes_lembrete from 7 to 5 (lembrete 5 dias antes de expirar)
ALTER TABLE "assinaturas" ALTER COLUMN "dias_antes_lembrete" SET DEFAULT 5;
