-- Documentos gerados pelo pacote AGT (substituição limpa entre execuções)
ALTER TABLE "documentos_financeiros" ADD COLUMN "teste_agt" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "documentos_financeiros_instituicao_id_teste_agt_idx" ON "documentos_financeiros"("instituicao_id", "teste_agt");
