-- AlterEnum: Perfil COMERCIAL para equipe de vendas/onboarding
-- Permite: criar instituições, gerir assinaturas, confirmar pagamentos
-- Não permite: dados acadêmicos, logs sensíveis, configurações globais
ALTER TYPE "UserRole" ADD VALUE 'COMERCIAL';
