-- Contacto WhatsApp institucional (número ou link wa.me / api.whatsapp.com), configurável pelo admin
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "whatsapp_contato" VARCHAR(512);
