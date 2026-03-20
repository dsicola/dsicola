-- Ensino Superior: modelo AC + Exame final ponderado (multi-tenant por linha parametros_sistema)
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_modelo_calculo" TEXT;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_peso_ac" DECIMAL(5,4);
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_peso_exame" DECIMAL(5,4);
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_nota_minima_ac_conta_exame" DECIMAL(5,2) DEFAULT 10;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_bloquear_exame_se_ac_insuficiente" BOOLEAN DEFAULT false;
