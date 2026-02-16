/**
 * Script de verificação de responsividade mobile
 * Executa checks básicos no código e build
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const errors: string[] = [];
const warnings: string[] = [];

// 1. Verificar viewport meta no index.html
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
if (!indexHtml.includes('width=device-width')) {
  errors.push('index.html: viewport meta deve conter width=device-width');
}
if (!indexHtml.includes('initial-scale=1')) {
  errors.push('index.html: viewport meta deve conter initial-scale=1');
}
if (!indexHtml.includes('viewport-fit=cover')) {
  warnings.push('index.html: considerar viewport-fit=cover para dispositivos com notch');
}

// 2. Verificar overflow-x no CSS global
const indexCss = fs.readFileSync(path.join(root, 'src/index.css'), 'utf-8');
if (!indexCss.includes('overflow-x: hidden')) {
  errors.push('index.css: html/body devem ter overflow-x: hidden');
}
if (!indexCss.includes('safe-area-inset')) {
  warnings.push('index.css: considerar safe-area-inset para dispositivos com notch');
}

// 3. Verificar VendasLanding tem classes responsivas
const vendasLanding = fs.readFileSync(
  path.join(root, 'src/pages/VendasLanding.tsx'),
  'utf-8'
);
const requiredPatterns = [
  ['overflow-x-hidden', 'Container principal'],
  ['min-h-[44px]', 'Botões com área de toque adequada'],
  ['touch-manipulation', 'Touch-friendly'],
  ['grid-cols-1', 'Grid responsivo (1 coluna mobile)'],
  ['sm:grid-cols-2', 'Grid responsivo (2 cols tablet)'],
  ['md:grid-cols-3', 'Grid responsivo (3 cols desktop)'],
  ['max-w-full', 'Prevenção de overflow'],
  ['break-words', 'Texto que quebra corretamente'],
  ['px-3 sm:px-4', 'Padding responsivo'],
  ['text-xs sm:text-sm', 'Tipografia responsiva'],
];
for (const [pattern, desc] of requiredPatterns) {
  if (!vendasLanding.includes(pattern)) {
    warnings.push(`VendasLanding: falta "${desc}" (${pattern})`);
  }
}

// 4. Verificar Tailwind container padding responsivo
const tailwindConfig = fs.readFileSync(
  path.join(root, 'tailwind.config.ts'),
  'utf-8'
);
if (!tailwindConfig.includes('padding') || tailwindConfig.includes('padding: "2rem"')) {
  // Se só tem padding fixo 2rem, pode ser tight no mobile
  if (!tailwindConfig.includes('DEFAULT') && !tailwindConfig.includes('1rem')) {
    warnings.push('tailwind: container padding pode ser grande no mobile');
  }
}

// Resultado
console.log('\n=== Teste de Responsividade Mobile ===\n');

if (errors.length > 0) {
  console.error('❌ ERROS encontrados:');
  errors.forEach((e) => console.error('   ', e));
}

if (warnings.length > 0) {
  console.log('⚠️  Avisos:');
  warnings.forEach((w) => console.log('   ', w));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Todos os checks de responsividade passaram!\n');
  process.exit(0);
} else if (errors.length === 0) {
  console.log('\n✅ Nenhum erro crítico. Avisos acima são sugestões.\n');
  process.exit(0);
} else {
  console.error('\n❌ Corrija os erros acima.\n');
  process.exit(1);
}
