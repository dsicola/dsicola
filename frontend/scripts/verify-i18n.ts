#!/usr/bin/env npx tsx
/**
 * Verifica que i18n está configurado corretamente com pt-BR, pt-AO e en
 */
import ptBR from '../src/i18n/locales/pt-BR';
import ptAO from '../src/i18n/locales/pt-AO';
import en from '../src/i18n/locales/en';

const requiredKeys = [
  'common.save',
  'common.cancel',
  'auth.login',
  'auth.email',
  'auth.password',
  'auth.welcomeBack',
  'auth.forgotPassword',
  'menu.dashboard',
];

function getNested(obj: Record<string, any>, path: string): string | undefined {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function checkLocale(name: string, locale: Record<string, any>): string[] {
  const missing: string[] = [];
  for (const key of requiredKeys) {
    const val = getNested(locale, key);
    if (!val || typeof val !== 'string') {
      missing.push(key);
    }
  }
  return missing;
}

const errors: string[] = [];
const ptBRMissing = checkLocale('pt-BR', ptBR);
const ptAOMissing = checkLocale('pt-AO', ptAO);
const enMissing = checkLocale('en', en);

if (ptBRMissing.length) errors.push(`pt-BR: chaves em falta: ${ptBRMissing.join(', ')}`);
if (ptAOMissing.length) errors.push(`pt-AO: chaves em falta: ${ptAOMissing.join(', ')}`);
if (enMissing.length) errors.push(`en: chaves em falta: ${enMissing.join(', ')}`);

if (errors.length) {
  console.error('❌ i18n verificação falhou:\n', errors.join('\n'));
  process.exit(1);
}

console.log('✔ pt-BR:', Object.keys(ptBR).length, 'namespaces');
console.log('✔ pt-AO:', Object.keys(ptAO).length, 'namespaces');
console.log('✔ en:', Object.keys(en).length, 'namespaces');
console.log('✔ Todas as chaves obrigatórias presentes nos 3 idiomas');
process.exit(0);
