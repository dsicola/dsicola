-- Documentos do assistente AGT: lote para substituição (fiscalmente iguais aos demais FT/PF/GR/NC)
ALTER TABLE "documentos_financeiros" ADD COLUMN "certificacao_agt_lote_id" TEXT;

CREATE INDEX "documentos_financeiros_instituicao_id_cert_agt_lote_idx" ON "documentos_financeiros"("instituicao_id", "certificacao_agt_lote_id");

ALTER TABLE "configuracoes_instituicao" ADD COLUMN "ultimo_certificacao_agt_lote_id" TEXT;

DROP INDEX IF EXISTS "documentos_financeiros_instituicao_id_teste_agt_idx";
ALTER TABLE "documentos_financeiros" DROP COLUMN IF EXISTS "teste_agt";
