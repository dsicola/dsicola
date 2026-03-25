-- Campos opcionais por publicação: WhatsApp, local/contacto, vídeo (YouTube ou Bunny) — só visíveis quando o flag correspondente está activo.
ALTER TABLE "social_posts" ADD COLUMN "contact_whatsapp_show" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "social_posts" ADD COLUMN "contact_whatsapp" TEXT;
ALTER TABLE "social_posts" ADD COLUMN "contact_location_show" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "social_posts" ADD COLUMN "contact_location" TEXT;
ALTER TABLE "social_posts" ADD COLUMN "contact_video_show" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "social_posts" ADD COLUMN "contact_video_url" TEXT;
