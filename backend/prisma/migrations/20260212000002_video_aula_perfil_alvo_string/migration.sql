-- AlterTable: PerfilAlvo para suportar TODOS (admin+professor) e múltiplos perfis
-- Valores: ADMIN, PROFESSOR, SECRETARIA, TODOS (mostra para admin e professores)
ALTER TABLE "video_aulas" 
  ALTER COLUMN "perfil_alvo" TYPE VARCHAR(50) USING "perfil_alvo"::text,
  ALTER COLUMN "perfil_alvo" SET DEFAULT 'ADMIN';
