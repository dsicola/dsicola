/**
 * Teste do fluxo: Professor contratado, valor por aula, faltas, folha
 * Executar: npx tsx scripts/test-fluxo-professor-folha.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Teste Fluxo Professor Folha/Faltas ===\n');

  // 1. Buscar instituição e professor contratado
  const inst = await prisma.instituicao.findFirst({ where: { status: 'ativa' } });
  if (!inst) {
    console.log('Nenhuma instituição ativa. Criar instituição primeiro.');
    return;
  }
  console.log('1. Instituição:', inst.nome);

  let professor = await prisma.professor.findFirst({
    where: { instituicaoId: inst.id, tipoVinculo: 'CONTRATADO' },
    include: { user: { select: { nomeCompleto: true } } },
  });
  if (!professor) {
    professor = await prisma.professor.findFirst({
      where: { instituicaoId: inst.id },
      include: { user: { select: { nomeCompleto: true } } },
    });
  }
  if (!professor) {
    console.log('   Nenhum professor na instituição. Criar professor primeiro.');
    return;
  }
  if (professor.tipoVinculo !== 'CONTRATADO') {
    console.log('   Professor encontrado:', professor.user.nomeCompleto, '| tipoVinculo:', professor.tipoVinculo, '(não é CONTRATADO)');
    console.log('   Para testar folha: atualizar professor para CONTRATADO e definir valorPorAula.');
    return;
  }
  console.log('2. Professor contratado:', professor.user.nomeCompleto, '| valorPorAula:', professor.valorPorAula?.toString());

  // 2. Parametros sistema - config desconto
  const params = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId: inst.id },
    select: { descontoFaltaProfessorTipo: true, descontoFaltaProfessorValor: true },
  });
  console.log('3. Config desconto:', params?.descontoFaltaProfessorTipo ?? 'VALOR_AULA', params?.descontoFaltaProfessorValor?.toString() ?? '-');

  // 3. Contar aulas do mês (se houver)
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);

  const aulasCount = await prisma.aulaLancada.count({
    where: {
      planoEnsino: { professorId: professor.id },
      instituicaoId: inst.id,
      data: { gte: inicioMes, lte: fimMes },
    },
  });
  const aulasSum = await prisma.aulaLancada.aggregate({
    where: {
      planoEnsino: { professorId: professor.id },
      instituicaoId: inst.id,
      data: { gte: inicioMes, lte: fimMes },
    },
    _sum: { cargaHoraria: true },
  });
  console.log('4. Aulas no mês:', aulasCount, 'registos, cargaHoraria total:', aulasSum._sum.cargaHoraria ?? 0);

  // 4. Faltas do mês
  const faltas = await prisma.professorFalta.findMany({
    where: {
      professorId: professor.id,
      instituicaoId: inst.id,
      justificada: false,
      data: { gte: inicioMes, lte: fimMes },
    },
  });
  const totalFaltas = faltas.reduce((s, f) => s + parseFloat(f.fracaoFalta.toString()), 0);
  console.log('5. Faltas não justificadas:', faltas.length, 'registos, total fracionado:', totalFaltas);

  // 5. Folha (se existir)
  const folha = await prisma.folhaPagamentoProfessor.findUnique({
    where: { professorId_mes_ano: { professorId: professor.id, mes, ano } },
  });
  if (folha) {
    console.log('6. Folha existente:', {
      totalAulas: folha.totalAulas,
      faltas: folha.faltasNaoJustificadas?.toString(),
      salarioBruto: folha.salarioBruto.toString(),
      salarioLiquido: folha.salarioLiquido.toString(),
    });
  } else {
    console.log('6. Sem folha para', mes + '/' + ano, '- executar POST /folha-professor/calcular');
  }

  console.log('\n=== Fluxo OK ===\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
