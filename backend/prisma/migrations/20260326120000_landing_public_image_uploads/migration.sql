-- Hero do site público (binário na configuração) + imagens extra (eventos/galeria via upload)

ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "landing_hero_public_url" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "landing_hero_public_data" BYTEA;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "landing_hero_public_content_type" TEXT;

CREATE TABLE IF NOT EXISTS "landing_public_uploaded_images" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_public_uploaded_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "landing_public_uploaded_images_instituicao_id_idx" ON "landing_public_uploaded_images"("instituicao_id");

DO $$ BEGIN
  ALTER TABLE "landing_public_uploaded_images" ADD CONSTRAINT "landing_public_uploaded_images_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
