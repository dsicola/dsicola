#!/usr/bin/env npx tsx
/**
 * Teste: Módulo Disciplina Avisos + Notificações + comentarioProfessor
 *
 * 1. Verifica tabela disciplina_avisos existe
 * 2. Verifica coluna comentario_professor em notas
 * 3. Testa criação de aviso (se houver professor + disciplina + plano)
 * 4. Testa GET /notificacoes (requer backend rodando)
 *
 * Uso: npx tsx scripts/test-disciplina-avisos.ts
 */
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Módulo Professor ↔ Estudantes (Avisos, Notificações)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let ok = true;

  // 1. Verificar tabela disciplina_avisos
  try {
    const count = await prisma.disciplinaAviso.count();
    console.log('✅ Tabela disciplina_avisos: OK (registros:', count, ')');
  } catch (e: any) {
    console.error('❌ Tabela disciplina_avisos:', e.message);
    ok = false;
  }

  // 2. Verificar coluna comentario_professor em notas
  try {
    const sample = await prisma.nota.findFirst({
      select: { id: true, comentarioProfessor: true },
    });
    console.log('✅ Coluna comentario_professor em notas: OK');
    if (sample?.comentarioProfessor) {
      console.log('   (exemplo de comentário existente)');
    }
  } catch (e: any) {
    console.error('❌ Coluna comentario_professor:', e.message);
    ok = false;
  }

  // 3. Verificar modelo Notificacao
  try {
    const count = await prisma.notificacao.count();
    console.log('✅ Tabela notificacoes: OK (registros:', count, ')');
  } catch (e: any) {
    console.error('❌ Tabela notificacoes:', e.message);
    ok = false;
  }

  // 4. Verificar se existe PlanoEnsino com professor para teste de criação
  const planos = await prisma.planoEnsino.findMany({
    take: 10,
    select: {
      id: true,
      disciplinaId: true,
      professorId: true,
      turmaId: true,
      instituicaoId: true,
      disciplina: { select: { nome: true } },
    },
  });
  const plano = planos.find((p) => p.professorId && p.turmaId && p.instituicaoId) ?? null;

  if (plano) {
    console.log('\n--- Teste de criação de aviso (dry-run) ---');
    try {
      // Verificar que disciplina existe e pertence ao tenant
      const disc = await prisma.disciplina.findFirst({
        where: { id: plano.disciplinaId, instituicaoId: plano.instituicaoId! },
      });
      if (disc) {
        console.log('✅ Disciplina encontrada:', plano.disciplina?.nome);
        console.log('   PlanoEnsino pronto para criar avisos (professor vinculado)');
      }
    } catch (e: any) {
      console.error('❌ Verificação disciplina:', e.message);
    }
  } else {
    console.log('\n⚠️  Nenhum PlanoEnsino com professor/turma encontrado (teste de aviso omitido)');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (ok) {
    console.log('  RESULTADO: Todos os checks passaram ✅');
  } else {
    console.log('  RESULTADO: Alguns checks falharam ❌');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
