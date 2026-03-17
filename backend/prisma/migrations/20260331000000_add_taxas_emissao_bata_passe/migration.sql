-- Valores padrão para emissão de documentos e itens obrigatórios (ConfiguracaoInstituicao)
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "valor_emissao_declaracao" DECIMAL(12,2);
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "valor_emissao_certificado" DECIMAL(12,2);
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "valor_passe" DECIMAL(12,2);

-- Itens obrigatórios e taxas específicas por curso (bata, passe, emissão declaração/certificado)
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "valor_bata" DECIMAL(12,2);
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "exige_bata" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "valor_passe" DECIMAL(12,2);
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "exige_passe" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "valor_emissao_declaracao" DECIMAL(12,2);
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "valor_emissao_certificado" DECIMAL(12,2);

-- Itens obrigatórios e taxas específicas por classe (Ensino Secundário)
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "valor_bata" DECIMAL(12,2);
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "exige_bata" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "valor_passe" DECIMAL(12,2);
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "exige_passe" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "valor_emissao_declaracao" DECIMAL(12,2);
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "valor_emissao_certificado" DECIMAL(12,2);
