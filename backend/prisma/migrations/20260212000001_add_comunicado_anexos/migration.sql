-- Add anexos JSON column to comunicados (multi-tenant: each attachment stored with url, type, name, size)
-- Supports: images, PDF, audio (mp3, wav, m4a, ogg, webm), documents
ALTER TABLE "comunicados" ADD COLUMN IF NOT EXISTS "anexos" JSONB DEFAULT '[]'::jsonb;
