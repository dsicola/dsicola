#!/usr/bin/env npx tsx
/**
 * Testa o fluxo do painel do professor com um professor que tem disciplina atribuída
 * Simula a chamada ao backend sem necessidade de JWT
 */
import prisma from '../src/lib/prisma.js';
import { buscarTurmasEDisciplinasProfessorComPlanoAtivo } from '../src/services/validacaoAcademica.service.js';
import { resolveProfessor } from '../src/utils/professorResolver.js';

async function main() {
  const emailArg = process.argv[2] || 'avelino1@gmail.com';
  console.log('\n=== TESTE PAINEL PROFESSOR ===');
  console.log('Usuário:', emailArg, '\n');

  // 1. Buscar professor pelo email
  const professorComPlanos = await prisma.professor.findFirst({
    where: {
      user: { email: emailArg.toLowerCase() },
    },
    include: {
      user: { select: { email: true, nomeCompleto: true } },
      planosEnsino: {
        include: {
          disciplina: { select: { nome: true } },
          turma: { select: { nome: true } },
        },
      },
    },
  });

  if (!professorComPlanos) {
    console.log('❌ Professor não encontrado:', emailArg);
    console.log('   Verifique se o email existe e se o usuário tem perfil PROFESSOR.');
    await prisma.$disconnect();
    return;
  }

  console.log('Professor com planos:', professorComPlanos.user?.nomeCompleto, `(${professorComPlanos.user?.email})`);
  console.log('  - professores.id:', professorComPlanos.id);
  console.log('  - instituicaoId:', professorComPlanos.instituicaoId);
  console.log('  - Planos:', professorComPlanos.planosEnsino.length);
  professorComPlanos.planosEnsino.forEach((p) => {
    console.log(`    • ${p.disciplina?.nome} | Turma: ${p.turma?.nome || '(sem turma)'}`);
  });
  console.log('');

  // 2. Simular resolução do professor (como o middleware faz)
  const userId = professorComPlanos.userId;
  const instituicaoId = professorComPlanos.instituicaoId;

  let professorResolvido;
  try {
    professorResolvido = await resolveProfessor(userId, instituicaoId);
    console.log('✅ resolveProfessor OK:', professorResolvido.id);
  } catch (e) {
    console.log('❌ resolveProfessor FALHOU:', (e as Error).message);
    await prisma.$disconnect();
    return;
  }

  // 3. Chamar buscarTurmasEDisciplinasProfessorComPlanoAtivo (como o controller faz)
  let resultado;
  try {
    resultado = await buscarTurmasEDisciplinasProfessorComPlanoAtivo(
      instituicaoId,
      professorResolvido.id,
      undefined, // anoLetivoId - não filtrar
      userId // fallback para professorId=users.id
    );
    console.log('✅ buscarTurmasEDisciplinasProfessorComPlanoAtivo OK');
    console.log('   Retornou', resultado.length, 'itens');
  } catch (e) {
    console.log('❌ buscarTurmasEDisciplinasProfessorComPlanoAtivo FALHOU:', (e as Error).message);
    await prisma.$disconnect();
    return;
  }

  // 4. Simular processamento do controller (separar turmas vs disciplinas sem turma)
  const turmas = resultado.filter((r) => r.turma && r.turma.id);
  const disciplinasSemTurma = resultado.filter((r) => !r.turma || !r.turma.id);

  console.log('');
  console.log('--- RESULTADO (como o frontend receberia) ---');
  console.log('Turmas:', turmas.length);
  turmas.forEach((t) => {
    console.log(`  • ${t.disciplinaNome} - Turma: ${t.turma?.nome || 'N/A'}`);
  });
  console.log('Disciplinas sem turma:', disciplinasSemTurma.length);
  disciplinasSemTurma.forEach((d) => {
    console.log(`  • ${d.disciplinaNome || d.nome} (aguardando turma)`);
  });

  const total = turmas.length + disciplinasSemTurma.length;
  const esperado = professorComPlanos.planosEnsino.length;

  console.log('');
  if (total === esperado && total > 0) {
    console.log('✅ TESTE OK: Painel retornaria', total, 'atribuição(ões) corretamente');
  } else if (total === 0) {
    console.log('❌ TESTE FALHOU: Nenhuma atribuição retornada (esperava', esperado, ')');
  } else {
    console.log('⚠️ AVISO: Retornou', total, ', esperava', esperado);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
