-- Intervalo longo (recreio/almoço): período sem aulas no meio do horário
-- Ex: 2 aulas, intervalo 45 min, depois mais aulas
-- intervaloLongoMinutos: 0=desativado, 45 ou 90
-- intervaloLongoAposBloco: após qual aula (1ª, 2ª, 3ª...) ocorre o intervalo

ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "intervalo_longo_minutos" INTEGER DEFAULT 0;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "intervalo_longo_apos_bloco" INTEGER DEFAULT 2;

COMMENT ON COLUMN "parametros_sistema"."intervalo_longo_minutos" IS 'Intervalo longo sem aulas (recreio/almoço): 0=desativado, 45 ou 90 min';
COMMENT ON COLUMN "parametros_sistema"."intervalo_longo_apos_bloco" IS 'Após qual bloco (1ª, 2ª aula) ocorre o intervalo longo. Ex: 2 = 2 aulas, intervalo, depois mais aulas';
