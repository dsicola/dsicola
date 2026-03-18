-- Suporte a modelos PDF para certificados/declarações
-- Modo FORM_FIELDS: preenche AcroForm do PDF
-- Modo COORDINATES: desenha texto em posições (x,y) - análogo ao Excel CELL_MAPPING
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "pdf_template_base64" TEXT;
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "pdf_template_mode" TEXT DEFAULT 'FORM_FIELDS';
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "pdf_mapping_json" TEXT;
