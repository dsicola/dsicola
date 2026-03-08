-- Configuração de certificado (Ensino Superior Angola)
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "ministerio_superior" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "decreto_criacao" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "nome_chefe_daa" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "nome_director_geral" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "localidade_certificado" TEXT;

-- Filiação do estudante (para certificados)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nome_pai" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nome_mae" TEXT;

-- Notas TFC e Defesa (Licenciatura Angola)
ALTER TABLE "conclusoes_cursos" ADD COLUMN IF NOT EXISTS "nota_tfc" DECIMAL(5,2);
ALTER TABLE "conclusoes_cursos" ADD COLUMN IF NOT EXISTS "nota_defesa" DECIMAL(5,2);
ALTER TABLE "conclusoes_cursos" ADD COLUMN IF NOT EXISTS "data_tfc" TIMESTAMP(3);
ALTER TABLE "conclusoes_cursos" ADD COLUMN IF NOT EXISTS "data_defesa" TIMESTAMP(3);
