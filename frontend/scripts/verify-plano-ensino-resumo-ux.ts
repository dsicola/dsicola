/**
 * Smoke test (sem browser): garante que o resumo institucional do plano
 * está integrado nas páginas e expõe cópias UX esperadas.
 * Executar: npx tsx scripts/verify-plano-ensino-resumo-ux.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const checks: { name: string; ok: boolean }[] = [];

function mustContain(file: string, needle: string, label: string) {
  const s = read(file);
  const ok = s.includes(needle);
  checks.push({ name: `${label} (${file})`, ok });
  if (!ok) throw new Error(`Falta em ${file}: esperado fragmento:\n  ${needle.slice(0, 120)}…`);
}

try {
  mustContain('src/pages/admin/PlanoEnsino.tsx', 'PlanoEnsinoContextoResumoCard', 'Uso do cartão no PlanoEnsino');
  mustContain('src/pages/admin/PlanoEnsino.tsx', 'variant={isProfessor ? "professor" : "staff"}', 'Variante professor/staff');
  mustContain('src/components/configuracaoEnsino/PlanoEnsinoTab.tsx', 'PlanoEnsinoContextoResumoCard', 'Uso no PlanoEnsinoTab');

  mustContain(
    'src/components/planoEnsino/PlanoEnsinoContextoResumoCard.tsx',
    'Resumo institucional deste plano',
    'Título UX do cartão'
  );
  mustContain(
    'src/components/planoEnsino/PlanoEnsinoContextoResumoCard.tsx',
    'Horário oficial (aprovado)',
    'Secção horário aprovado'
  );
  mustContain(
    'src/components/planoEnsino/PlanoEnsinoContextoResumoCard.tsx',
    'Datas sugeridas (distribuição)',
    'Secção distribuição'
  );
  mustContain(
    'src/components/planoEnsino/PlanoEnsinoContextoResumoCard.tsx',
    'painel-professor/horarios',
    'Link professor → horários'
  );
  mustContain(
    'src/components/planoEnsino/PlanoEnsinoContextoResumoCard.tsx',
    'painel-professor/frequencia',
    'Link professor → frequência'
  );
  mustContain(
    'src/components/admin/HorariosTab.tsx',
    'plano-ensino-resumo-horarios',
    'Invalidação do resumo ao mudar horários'
  );

  console.log(`OK — ${checks.length} verificações de integração UX/código passaram.`);
} catch (e) {
  console.error(e);
  process.exit(1);
}
