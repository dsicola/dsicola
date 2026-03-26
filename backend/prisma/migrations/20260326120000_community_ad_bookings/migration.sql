-- Publicidade na Comunidade / vitrine Social: pedidos, aprovação SUPER_ADMIN, vigência.

CREATE TYPE "CommunityAdScope" AS ENUM ('VITRINE_SOCIAL', 'DESTAQUE_DIRETORIO', 'BOTH');

CREATE TYPE "CommunityAdBookingStatus" AS ENUM ('AGUARDANDO_ANALISE', 'APROVADA', 'REJEITADA', 'CANCELADA');

CREATE TABLE "community_ad_bookings" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "social_post_id" TEXT,
    "scope" "CommunityAdScope" NOT NULL,
    "duracao_dias_solicitada" INTEGER NOT NULL,
    "valor_pago_declarado" DECIMAL(12,2),
    "comprovativo_url" TEXT,
    "referencia_pagamento" TEXT,
    "notas_instituicao" TEXT,
    "status" "CommunityAdBookingStatus" NOT NULL DEFAULT 'AGUARDANDO_ANALISE',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "motivo_rejeicao" TEXT,
    "notas_internas_admin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_ad_bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_ad_bookings_instituicao_id_status_idx" ON "community_ad_bookings"("instituicao_id", "status");

CREATE INDEX "community_ad_bookings_status_created_at_idx" ON "community_ad_bookings"("status", "created_at");

CREATE INDEX "community_ad_bookings_social_post_id_idx" ON "community_ad_bookings"("social_post_id");

ALTER TABLE "community_ad_bookings" ADD CONSTRAINT "community_ad_bookings_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_ad_bookings" ADD CONSTRAINT "community_ad_bookings_social_post_id_fkey" FOREIGN KEY ("social_post_id") REFERENCES "social_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_ad_bookings" ADD CONSTRAINT "community_ad_bookings_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
