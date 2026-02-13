-- Fix: Remover constraint único global em ano que impedia criar ano letivo em múltiplas instituições.
-- A unicidade correta é por instituição: @@unique([instituicaoId, ano])
-- Permite que cada instituição tenha seu próprio ano letivo (ex: 2025 para Inst A e 2025 para Inst B).

DROP INDEX IF EXISTS "anos_letivos_ano_key";
