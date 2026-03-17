-- Add formato_documento and excel_template_base64 for multi-format model import
-- formato_documento: HTML | WORD | PDF (Cert/Decl) | EXCEL (Boletim)
ALTER TABLE "modelos_documento" ADD COLUMN "formato_documento" TEXT;
ALTER TABLE "modelos_documento" ADD COLUMN "excel_template_base64" TEXT;
