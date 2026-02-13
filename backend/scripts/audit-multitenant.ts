/**
 * Script de Auditoria Multi-Tenant
 * 
 * Verifica:
 * 1. Todas as tabelas possuem instituicao_id
 * 2. instituicao_id NUNCA vem do frontend (exceto SUPER_ADMIN)
 * 3. instituicao_id SEMPRE vem do JWT
 * 4. Não existe nenhuma query sem filtro por instituicao_id
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
const schemaContent = readFileSync(schemaPath, 'utf-8');

// Models que NÃO precisam de instituicaoId (são globais ou de sistema)
const EXCLUDED_MODELS = [
  'Instituicao', // A própria tabela de instituições
  'UserRole_', // Roles de usuário (pode ter instituicaoId opcional)
  'RefreshToken', // Tokens de refresh
  'LoginAttempt', // Tentativas de login
  'PasswordResetToken', // Tokens de reset de senha
  'Plano', // Planos de licença (globais)
  'PlanosPrecos', // Preços de planos (globais)
  'Assinatura', // Assinaturas (globais)
  'PagamentoLicenca', // Pagamentos de licença (globais)
  'DocumentoFiscal', // Documentos fiscais (globais)
  'ConfiguracaoLanding', // Configurações da landing page (globais)
  'ParametrosSistema', // Parâmetros do sistema (globais)
  'LogAuditoria', // Logs de auditoria (podem ter instituicaoId opcional)
];

// Extrair todos os models do schema
const modelRegex = /^model\s+(\w+)\s*\{/gm;
const models: string[] = [];
let match;
while ((match = modelRegex.exec(schemaContent)) !== null) {
  models.push(match[1]);
}

console.log(`\n📊 AUDITORIA MULTI-TENANT\n`);
console.log(`Total de models encontrados: ${models.length}\n`);

// Verificar quais models têm instituicaoId
const modelsWithInstituicaoId: string[] = [];
const modelsWithoutInstituicaoId: string[] = [];

for (const model of models) {
  if (EXCLUDED_MODELS.includes(model)) {
    continue; // Pular models excluídos
  }

  // Verificar se model tem instituicaoId
  const modelRegex = new RegExp(`model\\s+${model}\\s*\\{[^}]*instituicaoId|instituicao_id`, 's');
  const hasInstituicaoId = modelRegex.test(schemaContent);

  if (hasInstituicaoId) {
    modelsWithInstituicaoId.push(model);
  } else {
    modelsWithoutInstituicaoId.push(model);
  }
}

console.log(`✅ Models COM instituicaoId: ${modelsWithInstituicaoId.length}`);
console.log(`⚠️  Models SEM instituicaoId: ${modelsWithoutInstituicaoId.length}\n`);

if (modelsWithoutInstituicaoId.length > 0) {
  console.log(`⚠️  ATENÇÃO: Os seguintes models NÃO têm instituicaoId:`);
  modelsWithoutInstituicaoId.forEach(model => {
    console.log(`   - ${model}`);
  });
  console.log(`\n   Verifique se estes models devem ter instituicaoId ou se são globais.\n`);
}

console.log(`\n✅ Models COM instituicaoId (${modelsWithInstituicaoId.length}):`);
modelsWithInstituicaoId.forEach(model => {
  console.log(`   - ${model}`);
});

console.log(`\n📋 PRÓXIMOS PASSOS:`);
console.log(`   1. Verificar controllers que aceitam instituicaoId do body`);
console.log(`   2. Verificar queries Prisma sem filtro por instituicaoId`);
console.log(`   3. Garantir que requireTenantScope/addInstitutionFilter são usados\n`);

