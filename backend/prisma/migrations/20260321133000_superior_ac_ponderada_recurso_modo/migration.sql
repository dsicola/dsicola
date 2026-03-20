-- Ensino superior: AC ponderada (1ª/2ª/Trabalho) e modo de recurso (média vs aprovação direta)
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_ac_tipo_calculo" TEXT;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_peso_av1" DECIMAL(5,4);
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_peso_av2" DECIMAL(5,4);
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_peso_trab" DECIMAL(5,4);
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "superior_recurso_modo" TEXT;
