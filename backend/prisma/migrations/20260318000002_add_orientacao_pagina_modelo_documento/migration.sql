-- Add orientacao_pagina to modelos_documento for horizontal/vertical (landscape/portrait) PDF generation
-- RETRATO = portrait, PAISAGEM = landscape. null = default (portrait)
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "orientacao_pagina" TEXT;
