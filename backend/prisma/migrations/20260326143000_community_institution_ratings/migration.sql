-- Avaliações por estrelas no diretório Comunidade
CREATE TABLE "community_institution_ratings" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" VARCHAR(600),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_institution_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_institution_ratings_user_id_instituicao_id_key" ON "community_institution_ratings"("user_id", "instituicao_id");
CREATE INDEX "community_institution_ratings_instituicao_id_idx" ON "community_institution_ratings"("instituicao_id");

ALTER TABLE "community_institution_ratings" ADD CONSTRAINT "community_institution_ratings_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_institution_ratings" ADD CONSTRAINT "community_institution_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
