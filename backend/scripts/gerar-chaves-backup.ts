#!/usr/bin/env tsx
/**
 * Script para gerar par de chaves RSA para assinatura digital de backups
 * 
 * USO:
 *   tsx scripts/gerar-chaves-backup.ts
 * 
 * IMPORTANTE:
 * - Chave privada NUNCA deve ser versionada no Git
 * - Chave privada deve ter permissões restritas (600)
 * - Chave pública pode ser versionada
 * - Em produção, usar variáveis de ambiente (BACKUP_PRIVATE_KEY, BACKUP_PUBLIC_KEY)
 */

import { DigitalSignatureService } from '../src/services/digitalSignature.service.js';

async function main() {
  console.log('🔐 Gerando par de chaves RSA para assinatura digital de backups...\n');

  try {
    const { privateKey, publicKey } = await DigitalSignatureService.generateKeyPair();

    console.log('✅ Par de chaves gerado com sucesso!\n');
    console.log('📝 Chaves salvas em:');
    console.log('   - Privada: backend/keys/backup_private_key.pem');
    console.log('   - Pública: backend/keys/backup_public_key.pem\n');
    console.log('⚠️  IMPORTANTE:');
    console.log('   - Chave privada NUNCA deve ser versionada no Git');
    console.log('   - Adicione "keys/backup_private_key.pem" ao .gitignore');
    console.log('   - Em produção, use variáveis de ambiente:');
    console.log('     BACKUP_PRIVATE_KEY=<chave_privada_pem>');
    console.log('     BACKUP_PUBLIC_KEY=<chave_publica_pem>');
    console.log('   - Railway/Vercel: Use \\n para newlines na chave PEM, ex.:');
    console.log('     BACKUP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----"');
    console.log('');
    console.log('📋 Chave pública (pode ser compartilhada):');
    console.log('─'.repeat(60));
    console.log(publicKey);
    console.log('─'.repeat(60));
  } catch (error) {
    console.error('❌ Erro ao gerar par de chaves:', error);
    process.exit(1);
  }
}

main();

