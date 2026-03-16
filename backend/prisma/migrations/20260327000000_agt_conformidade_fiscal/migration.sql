-- AGT Conformidade: Novos campos e tipos de documento fiscal (Decreto 312/18)
-- Proforma (PF), Guia de Remessa (GR), referências, descontos, moeda, cliente sem NIF

-- AlterEnum: adicionar PF e GR ao TipoDocumentoFinanceiro
ALTER TYPE "TipoDocumentoFinanceiro" ADD VALUE IF NOT EXISTS 'PF';
ALTER TYPE "TipoDocumentoFinanceiro" ADD VALUE IF NOT EXISTS 'GR';

-- DocumentoFinanceiro: valorDesconto (SettlementAmount), documentoBaseId (OrderReferences/References), moeda
ALTER TABLE "documentos_financeiros" ADD COLUMN IF NOT EXISTS "valor_desconto" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "documentos_financeiros" ADD COLUMN IF NOT EXISTS "documento_base_id" TEXT;
ALTER TABLE "documentos_financeiros" ADD COLUMN IF NOT EXISTS "moeda" TEXT DEFAULT 'AOA';

-- DocumentoLinha: valorDesconto (linha), taxExemptionCode (M00, M01, etc.)
ALTER TABLE "documento_linhas" ADD COLUMN IF NOT EXISTS "valor_desconto" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "documento_linhas" ADD COLUMN IF NOT EXISTS "tax_exemption_code" TEXT;

-- ConfiguracaoInstituicao: permitir cliente sem NIF quando valor < X AOA (AGT doc 9)
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "permitir_cliente_sem_nif_ate_valor" DECIMAL(12,2);

CREATE INDEX IF NOT EXISTS "documentos_financeiros_documento_base_id_idx" ON "documentos_financeiros"("documento_base_id");
