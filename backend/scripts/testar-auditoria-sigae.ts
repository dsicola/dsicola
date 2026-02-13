#!/usr/bin/env npx tsx
/**
 * Teste da auditoria SIGAE - Atribuição exclusiva via PlanoEnsino
 * Verifica: 1) fluxo professor/PlanoEnsino  2) endpoints descontinuados retornam 410
 */
import prisma from '../src/lib/prisma.js';
import { buscarTurmasEDisciplinasProfessorComPlanoAtivo } from '../src/services/validacaoAcademica.service.js';
import { vincularProfessorDisciplina } from '../src/controllers/professorVinculo.controller.js';
import { AppError } from '../src/middlewares/errorHandler.js';

async function main() {
  console.log('\n=== TESTE AUDITORIA SIGAE ===\n');

  let ok = 0;
  let fail = 0;

  // 1. Professor com plano aparece no dashboard
  console.log('1. Fluxo PlanoEnsino (professor vê turmas)...');
  const prof = await prisma.professor.findFirst({
    where: { user: { email: { contains: '@' } } },
    include: { user: { select: { email: true } }, planosEnsino: { take: 1 } },
  });
  if (!prof || prof.planosEnsino.length === 0) {
    console.log('   ⚠️  Nenhum professor com plano encontrado -跳过');
  } else {
    try {
      const r = await buscarTurmasEDisciplinasProfessorComPlanoAtivo(
        prof.instituicaoId,
        prof.id,
        undefined,
        prof.userId
      );
      console.log('   ✅ buscarTurmasEDisciplinasProfessorComPlanoAtivo OK:', r.length, 'itens');
      ok++;
    } catch (e) {
      console.log('   ❌ FALHOU:', (e as Error).message);
      fail++;
    }
  }

  // 2. vincularProfessorDisciplina retorna 410 (controller throws AppError)
  console.log('\n2. vincularProfessorDisciplina retorna 410...');
  const req = { params: { professorId: 'x' }, body: { disciplinaId: 'y' } } as any;
  const res = { status: () => ({ json: () => {} }), json: () => {} } as any;
  try {
    await vincularProfessorDisciplina(req, res, () => {});
    console.log('   ❌ Deveria ter lançado 410');
    fail++;
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 410) {
      console.log('   ✅ Retorna 410 Gone');
      ok++;
    } else {
      console.log('   ❌', (e as Error).message);
      fail++;
    }
  }

  console.log('\n--- RESUMO ---');
  console.log('OK:', ok, '| FAIL:', fail);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
