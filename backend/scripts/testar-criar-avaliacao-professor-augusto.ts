#!/usr/bin/env npx tsx
/**
 * Teste: Criar avaliação como Professor Augusto (tomas@gmail.com)
 *
 * Simula o fluxo completo:
 * 1. Resolve professor Augusto e seus planos de ensino
 * 2. Cria uma avaliação do tipo TESTE no 1º trimestre
 *
 * Executa via Prisma (mesma lógica do controller POST /avaliacoes).
 */
import prisma from '../src/lib/prisma.js';

const EMAIL_AUGUSTO = 'tomas@gmail.com';

async function main() {
  console.log('\n=== TESTE: CRIAR AVALIAÇÃO PROFESSOR AUGUSTO ===\n');

  // 1. Buscar professor Augusto com planos
  const professor = await prisma.professor.findFirst({
    where: { user: { email: EMAIL_AUGUSTO.toLowerCase() } },
    include: {
      user: { select: { nomeCompleto: true, email: true } },
      planosEnsino: {
        where: { estado: 'APROVADO', turmaId: { not: null } },
        include: {
          disciplina: { select: { nome: true } },
          turma: { select: { id: true, nome: true } },
        },
        take: 1,
      },
    },
  });

  if (!professor) {
    console.log('❌ Professor Augusto não encontrado:', EMAIL_AUGUSTO);
    console.log('   Verifique se o usuário existe e tem perfil em professores.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const plano = professor.planosEnsino[0];
  if (!plano || !plano.turmaId) {
    console.log('❌ Professor sem plano de ensino APROVADO com turma.');
    console.log('   Planos:', professor.planosEnsino.length);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('Professor:', professor.user?.nomeCompleto, `(${professor.user?.email})`);
  console.log('  - professores.id:', professor.id);
  console.log('  - planoEnsinoId:', plano.id);
  console.log('  - turmaId:', plano.turmaId);
  console.log('  - disciplina:', plano.disciplina?.nome);
  console.log('  - turma:', plano.turma?.nome);
  console.log('');

  // 2. Criar avaliação (como o controller POST /avaliacoes faria)
  const dataAvaliacao = new Date();
  const avaliacao = await prisma.avaliacao.create({
    data: {
      planoEnsinoId: plano.id,
      turmaId: plano.turmaId,
      professorId: professor.id,
      tipo: 'TESTE',
      trimestre: 1,
      peso: 1,
      data: dataAvaliacao,
      nome: 'Teste - Professor Augusto',
      descricao: 'Avaliação criada pelo script de teste (testar-criar-avaliacao-professor-augusto)',
      instituicaoId: professor.instituicaoId,
    },
  });

  console.log('✅ Avaliação criada com sucesso!');
  console.log('  - id:', avaliacao.id);
  console.log('  - nome:', avaliacao.nome);
  console.log('  - tipo:', avaliacao.tipo);
  console.log('  - trimestre:', avaliacao.trimestre);
  console.log('  - data:', avaliacao.data.toISOString());
  console.log('\n=== FIM DO TESTE ===\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
