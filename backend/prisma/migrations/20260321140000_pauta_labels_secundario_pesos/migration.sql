-- Rótulos editáveis da pauta (UI) e pesos MAC/NPP/NPT para MT no secundário
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "pauta_labels_superior" JSONB;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "pauta_labels_secundario" JSONB;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "secundario_peso_mac" DECIMAL(5,4);
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "secundario_peso_npp" DECIMAL(5,4);
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "secundario_peso_npt" DECIMAL(5,4);
