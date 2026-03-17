-- DOCX template support + dynamic mappings for gov templates
-- docx_template_base64: DOCX file (base64), template_placeholders_json: extracted placeholders
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "docx_template_base64" TEXT;
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "template_placeholders_json" TEXT;

-- template_mappings: campo_template (placeholder no DOCX) -> campo_sistema (caminho dinâmico)
CREATE TABLE IF NOT EXISTS "template_mappings" (
    "id" TEXT NOT NULL,
    "modelo_documento_id" TEXT NOT NULL,
    "campo_template" TEXT NOT NULL,
    "campo_sistema" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "template_mappings_modelo_documento_id_campo_template_key" ON "template_mappings"("modelo_documento_id", "campo_template");
CREATE INDEX IF NOT EXISTS "template_mappings_modelo_documento_id_idx" ON "template_mappings"("modelo_documento_id");

ALTER TABLE "template_mappings" ADD CONSTRAINT "template_mappings_modelo_documento_id_fkey"
    FOREIGN KEY ("modelo_documento_id") REFERENCES "modelos_documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
