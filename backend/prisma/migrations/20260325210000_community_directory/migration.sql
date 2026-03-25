-- Diretório público Comunidade: cursos divulgados e seguidores por instituição

CREATE TABLE "community_courses" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_institution_follows" (
    "user_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_institution_follows_pkey" PRIMARY KEY ("user_id","instituicao_id")
);

CREATE INDEX "community_courses_instituicao_id_idx" ON "community_courses"("instituicao_id");
CREATE INDEX "community_institution_follows_instituicao_id_idx" ON "community_institution_follows"("instituicao_id");

ALTER TABLE "community_courses" ADD CONSTRAINT "community_courses_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_institution_follows" ADD CONSTRAINT "community_institution_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_institution_follows" ADD CONSTRAINT "community_institution_follows_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
