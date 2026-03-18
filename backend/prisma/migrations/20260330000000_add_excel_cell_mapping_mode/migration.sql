-- Add excel template mode (PLACEHOLDER | CELL_MAPPING) and cell mapping JSON for government Excel without placeholders
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "excel_template_mode" TEXT DEFAULT 'PLACEHOLDER';
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "excel_cell_mapping_json" TEXT;
