#!/usr/bin/env npx tsx
/**
 * SEED: Fluxo completo de notas - 2 professores por tipo de instituição
 *
 * Cria:
 * - Inst A (Secundário): Prof1 Matemática, Prof2 Informática, 1 estudante, turma, planos, avaliações
 * - Inst B (Superior): Prof1 Programação, Prof2 BD, 1 estudante, turma, planos, avaliações
 *
 * Senha: TestMultiTenant123!
 *
 * Uso: npx tsx scripts/seed-fluxo-notas-completo.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SENHA = 'TestMultiTenant123!';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SEED - FLUXO NOTAS COMPLETO (2 profs por tipo de instituição)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hashedPassword = await bcrypt.hash(SENHA, 10);
  const ano = new Date().getFullYear();

  const criarUser = async (
    email: string,
    nome: string,
    instituicaoId: string,
    roles: string[]
  ) => {
    let user = await prisma.user.findFirst({
      where: { email, instituicaoId },
      include: { roles: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nomeCompleto: nome,
          instituicaoId,
          mustChangePassword: false,
        },
        include: { roles: true },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, mustChangePassword: false },
      });
    }
    for (const role of roles) {
      const exists = await prisma.userRole_.findFirst({
        where: { userId: user!.id, role: role as any, instituicaoId },
      });
      if (!exists) {
        await prisma.userRole_.create({
          data: { userId: user!.id, role: role as any, instituicaoId },
        });
      }
    }
    return prisma.user.findUniqueOrThrow({ where: { id: user!.id } });
  };

  const criarProfessor = async (userId: string, instituicaoId: string) => {
    let prof = await prisma.professor.findFirst({
      where: { userId, instituicaoId },
    });
    if (!prof) {
      prof = await prisma.professor.create({
        data: { userId, instituicaoId },
      });
    }
    return prof;
  };

  // ─── INST A (SECUNDÁRIO) ───
  let instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
  });
  if (!instA) {
    instA = await prisma.instituicao.create({
      data: {
        nome: 'Instituição A - Secundário (Teste)',
        subdominio: 'inst-a-secundario-test',
        tipoInstituicao: 'ENSINO_MEDIO',
        tipoAcademico: 'SECUNDARIO',
        status: 'ativa',
      },
    });
  }
  console.log('  ✔ Inst A (Secundário):', instA.nome);

  const userProfA1 = await criarUser('prof.a1.mat@teste.dsicola.com', 'Prof A1 Matemática', instA.id, ['PROFESSOR']);
  const userProfA2 = await criarUser('prof.a2.inf@teste.dsicola.com', 'Prof A2 Informática', instA.id, ['PROFESSOR']);
  const profA1 = await criarProfessor(userProfA1.id, instA.id);
  const profA2 = await criarProfessor(userProfA2.id, instA.id);
  const userAlunoA = await criarUser('aluno.inst.a@teste.dsicola.com', 'Estudante Inst A', instA.id, ['ALUNO']);
  console.log('  ✔ 2 Profs + 1 Estudante Inst A');

  let anoLetivoA = await prisma.anoLetivo.findFirst({ where: { instituicaoId: instA.id, ano } });
  if (!anoLetivoA) {
    anoLetivoA = await prisma.anoLetivo.create({
      data: { instituicaoId: instA.id, ano, status: 'ATIVO', dataInicio: new Date(ano, 0, 1) },
    });
  }
  let cursoA = await prisma.curso.findFirst({ where: { instituicaoId: instA.id } });
  if (!cursoA) {
    cursoA = await prisma.curso.create({
      data: { instituicaoId: instA.id, nome: 'Curso Secundário', codigo: 'CS', valorMensalidade: 0 },
    });
  }
  let classeA = await prisma.classe.findFirst({ where: { instituicaoId: instA.id } });
  if (!classeA) {
    classeA = await prisma.classe.create({
      data: { instituicaoId: instA.id, codigo: '10', nome: '10ª Classe', ordem: 10, cargaHoraria: 0 },
    });
  }
  let discMatA = await prisma.disciplina.findFirst({ where: { instituicaoId: instA.id, nome: 'Matemática' } });
  if (!discMatA) {
    discMatA = await prisma.disciplina.create({
      data: { instituicaoId: instA.id, nome: 'Matemática', codigo: 'MAT', cargaHoraria: 60 },
    });
  }
  let discInfA = await prisma.disciplina.findFirst({ where: { instituicaoId: instA.id, nome: 'Informática' } });
  if (!discInfA) {
    discInfA = await prisma.disciplina.create({
      data: { instituicaoId: instA.id, nome: 'Informática', codigo: 'INF', cargaHoraria: 60 },
    });
  }
  let turnoA = await prisma.turno.findFirst({ where: { instituicaoId: instA.id } });
  if (!turnoA) {
    turnoA = await prisma.turno.create({ data: { instituicaoId: instA.id, nome: 'Manhã' } });
  }
  let turmaA = await prisma.turma.findFirst({
    where: { instituicaoId: instA.id, anoLetivoId: anoLetivoA.id },
  });
  if (!turmaA) {
    turmaA = await prisma.turma.create({
      data: {
        instituicaoId: instA.id,
        anoLetivoId: anoLetivoA.id,
        nome: '10ª Classe - Turma A',
        cursoId: cursoA.id,
        classeId: classeA.id,
        turnoId: turnoA.id,
        capacidade: 30,
      },
    });
  }

  let matAnualA = await prisma.matriculaAnual.findFirst({
    where: { alunoId: userAlunoA.id, instituicaoId: instA.id, anoLetivoId: anoLetivoA.id },
  });
  if (!matAnualA) {
    matAnualA = await prisma.matriculaAnual.create({
      data: {
        alunoId: userAlunoA.id,
        instituicaoId: instA.id,
        anoLetivoId: anoLetivoA.id,
        anoLetivo: ano,
        nivelEnsino: 'SECUNDARIO',
        classeOuAnoCurso: classeA.nome,
        classeId: classeA.id,
        status: 'ATIVA',
      },
    });
  }
  let matA = await prisma.matricula.findFirst({
    where: { alunoId: userAlunoA.id, turmaId: turmaA.id },
  });
  if (!matA) {
    matA = await prisma.matricula.create({
      data: {
        alunoId: userAlunoA.id,
        turmaId: turmaA.id,
        anoLetivoId: anoLetivoA.id,
        anoLetivo: ano,
        status: 'Ativa',
      },
    });
  }

  for (const disc of [discMatA, discInfA]) {
    let ad = await prisma.alunoDisciplina.findFirst({
      where: { alunoId: userAlunoA.id, disciplinaId: disc.id, ano, semestre: '1' },
    });
    if (!ad) {
      await prisma.alunoDisciplina.create({
        data: {
          alunoId: userAlunoA.id,
          disciplinaId: disc.id,
          turmaId: turmaA.id,
          ano,
          semestre: '1',
          matriculaAnualId: matAnualA.id,
          status: 'Cursando',
        },
      });
    }
  }

  let planoA1 = await prisma.planoEnsino.findFirst({
    where: { professorId: profA1.id, turmaId: turmaA.id, disciplinaId: discMatA.id },
  });
  if (!planoA1) {
    planoA1 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instA.id,
        professorId: profA1.id,
        disciplinaId: discMatA.id,
        turmaId: turmaA.id,
        anoLetivoId: anoLetivoA.id,
        anoLetivo: ano,
        classeId: classeA.id,
        classeOuAno: classeA.nome,
        status: 'APROVADO',
        estado: 'APROVADO',
        bloqueado: false,
      },
    });
  }
  let planoA2 = await prisma.planoEnsino.findFirst({
    where: { professorId: profA2.id, turmaId: turmaA.id, disciplinaId: discInfA.id },
  });
  if (!planoA2) {
    planoA2 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instA.id,
        professorId: profA2.id,
        disciplinaId: discInfA.id,
        turmaId: turmaA.id,
        anoLetivoId: anoLetivoA.id,
        anoLetivo: ano,
        classeId: classeA.id,
        classeOuAno: classeA.nome,
        status: 'APROVADO',
        estado: 'APROVADO',
        bloqueado: false,
      },
    });
  }

  let avalA1 = await prisma.avaliacao.findFirst({
    where: { planoEnsinoId: planoA1.id, trimestre: 1 },
  });
  if (!avalA1) {
    avalA1 = await prisma.avaliacao.create({
      data: {
        planoEnsinoId: planoA1.id,
        turmaId: turmaA.id,
        professorId: profA1.id,
        tipo: 'PROVA',
        trimestre: 1,
        data: new Date(),
        nome: '1º Trimestre Matemática',
        instituicaoId: instA.id,
      },
    });
  }
  let avalA2 = await prisma.avaliacao.findFirst({
    where: { planoEnsinoId: planoA2.id, trimestre: 1 },
  });
  if (!avalA2) {
    avalA2 = await prisma.avaliacao.create({
      data: {
        planoEnsinoId: planoA2.id,
        turmaId: turmaA.id,
        professorId: profA2.id,
        tipo: 'PROVA',
        trimestre: 1,
        data: new Date(),
        nome: '1º Trimestre Informática',
        instituicaoId: instA.id,
      },
    });
  }

  let periodoA = await prisma.periodoLancamentoNotas.findFirst({
    where: { instituicaoId: instA.id, anoLetivoId: anoLetivoA.id, tipoPeriodo: 'TRIMESTRE', numeroPeriodo: 1 },
  });
  if (!periodoA) {
    periodoA = await prisma.periodoLancamentoNotas.create({
      data: {
        instituicaoId: instA.id,
        anoLetivoId: anoLetivoA.id,
        tipoPeriodo: 'TRIMESTRE',
        numeroPeriodo: 1,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 11, 31),
        status: 'ABERTO',
      },
    });
  } else {
    await prisma.periodoLancamentoNotas.update({
      where: { id: periodoA.id },
      data: {
        status: 'ABERTO',
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 11, 31),
      },
    });
  }
  console.log('  ✔ Inst A: turma, planos, avaliações, período ABERTO');

  // ─── INST B (SUPERIOR) ───
  let instB = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
  });
  if (!instB) {
    instB = await prisma.instituicao.create({
      data: {
        nome: 'Instituição B - Superior (Teste)',
        subdominio: 'inst-b-superior-test',
        tipoInstituicao: 'UNIVERSIDADE',
        tipoAcademico: 'SUPERIOR',
        status: 'ativa',
      },
    });
  }
  console.log('  ✔ Inst B (Superior):', instB.nome);

  const userProfB1 = await criarUser('prof.b1.prog@teste.dsicola.com', 'Prof B1 Programação', instB.id, ['PROFESSOR']);
  const userProfB2 = await criarUser('prof.b2.bd@teste.dsicola.com', 'Prof B2 Banco de Dados', instB.id, ['PROFESSOR']);
  const profB1 = await criarProfessor(userProfB1.id, instB.id);
  const profB2 = await criarProfessor(userProfB2.id, instB.id);
  const userAlunoB = await criarUser('aluno.inst.b@teste.dsicola.com', 'Estudante Inst B', instB.id, ['ALUNO']);
  console.log('  ✔ 2 Profs + 1 Estudante Inst B');

  let anoLetivoB = await prisma.anoLetivo.findFirst({ where: { instituicaoId: instB.id, ano } });
  if (!anoLetivoB) {
    anoLetivoB = await prisma.anoLetivo.create({
      data: { instituicaoId: instB.id, ano, status: 'ATIVO', dataInicio: new Date(ano, 0, 1) },
    });
  }
  let cursoB = await prisma.curso.findFirst({ where: { instituicaoId: instB.id } });
  if (!cursoB) {
    cursoB = await prisma.curso.create({
      data: { instituicaoId: instB.id, nome: 'Licenciatura', codigo: 'LIC', valorMensalidade: 0 },
    });
  }
  let discProgB = await prisma.disciplina.findFirst({ where: { instituicaoId: instB.id, nome: 'Programação' } });
  if (!discProgB) {
    discProgB = await prisma.disciplina.create({
      data: { instituicaoId: instB.id, nome: 'Programação', codigo: 'PROG', cargaHoraria: 60 },
    });
  }
  let discBdB = await prisma.disciplina.findFirst({ where: { instituicaoId: instB.id, nome: 'Banco de Dados' } });
  if (!discBdB) {
    discBdB = await prisma.disciplina.create({
      data: { instituicaoId: instB.id, nome: 'Banco de Dados', codigo: 'BD', cargaHoraria: 60 },
    });
  }
  let turnoB = await prisma.turno.findFirst({ where: { instituicaoId: instB.id } });
  if (!turnoB) {
    turnoB = await prisma.turno.create({ data: { instituicaoId: instB.id, nome: 'Manhã' } });
  }
  let turmaB = await prisma.turma.findFirst({
    where: { instituicaoId: instB.id, anoLetivoId: anoLetivoB.id },
  });
  if (!turmaB) {
    turmaB = await prisma.turma.create({
      data: {
        instituicaoId: instB.id,
        anoLetivoId: anoLetivoB.id,
        nome: '1º Ano - Turma 1',
        cursoId: cursoB.id,
        turnoId: turnoB.id,
        capacidade: 30,
        semestre: 1,
      },
    });
  }

  let matAnualB = await prisma.matriculaAnual.findFirst({
    where: { alunoId: userAlunoB.id, instituicaoId: instB.id, anoLetivoId: anoLetivoB.id },
  });
  if (!matAnualB) {
    matAnualB = await prisma.matriculaAnual.create({
      data: {
        alunoId: userAlunoB.id,
        instituicaoId: instB.id,
        anoLetivoId: anoLetivoB.id,
        anoLetivo: ano,
        nivelEnsino: 'SUPERIOR',
        classeOuAnoCurso: '1º Ano',
        cursoId: cursoB.id,
        status: 'ATIVA',
      },
    });
  }
  let matB = await prisma.matricula.findFirst({
    where: { alunoId: userAlunoB.id, turmaId: turmaB.id },
  });
  if (!matB) {
    matB = await prisma.matricula.create({
      data: {
        alunoId: userAlunoB.id,
        turmaId: turmaB.id,
        anoLetivoId: anoLetivoB.id,
        anoLetivo: ano,
        status: 'Ativa',
      },
    });
  }

  let semestreB = await prisma.semestre.findFirst({
    where: { anoLetivoId: anoLetivoB.id, numero: 1 },
  });
  if (!semestreB) {
    semestreB = await prisma.semestre.create({
      data: {
        anoLetivoId: anoLetivoB.id,
        anoLetivo: ano,
        numero: 1,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 5, 30),
        instituicaoId: instB.id,
      },
    });
  }

  for (const disc of [discProgB, discBdB]) {
    let ad = await prisma.alunoDisciplina.findFirst({
      where: { alunoId: userAlunoB.id, disciplinaId: disc.id, ano, semestre: '1' },
    });
    if (!ad) {
      await prisma.alunoDisciplina.create({
        data: {
          alunoId: userAlunoB.id,
          disciplinaId: disc.id,
          turmaId: turmaB.id,
          ano,
          semestre: '1',
          semestreId: semestreB.id,
          matriculaAnualId: matAnualB.id,
          status: 'Cursando',
        },
      });
    }
  }

  let planoB1 = await prisma.planoEnsino.findFirst({
    where: { professorId: profB1.id, turmaId: turmaB.id, disciplinaId: discProgB.id },
  });
  if (!planoB1) {
    planoB1 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instB.id,
        professorId: profB1.id,
        disciplinaId: discProgB.id,
        turmaId: turmaB.id,
        anoLetivoId: anoLetivoB.id,
        anoLetivo: ano,
        cursoId: cursoB.id,
        classeOuAno: '1º Ano',
        semestreId: semestreB.id,
        status: 'APROVADO',
        estado: 'APROVADO',
        bloqueado: false,
      },
    });
  }
  let planoB2 = await prisma.planoEnsino.findFirst({
    where: { professorId: profB2.id, turmaId: turmaB.id, disciplinaId: discBdB.id },
  });
  if (!planoB2) {
    planoB2 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instB.id,
        professorId: profB2.id,
        disciplinaId: discBdB.id,
        turmaId: turmaB.id,
        anoLetivoId: anoLetivoB.id,
        anoLetivo: ano,
        cursoId: cursoB.id,
        classeOuAno: '1º Ano',
        semestreId: semestreB.id,
        status: 'APROVADO',
        estado: 'APROVADO',
        bloqueado: false,
      },
    });
  }

  let avalB1 = await prisma.avaliacao.findFirst({
    where: { planoEnsinoId: planoB1.id },
  });
  if (!avalB1) {
    avalB1 = await prisma.avaliacao.create({
      data: {
        planoEnsinoId: planoB1.id,
        turmaId: turmaB.id,
        professorId: profB1.id,
        tipo: 'PROVA',
        semestreId: semestreB.id,
        data: new Date(),
        nome: 'P1 Programação',
        instituicaoId: instB.id,
      },
    });
  }
  let avalB2 = await prisma.avaliacao.findFirst({
    where: { planoEnsinoId: planoB2.id },
  });
  if (!avalB2) {
    avalB2 = await prisma.avaliacao.create({
      data: {
        planoEnsinoId: planoB2.id,
        turmaId: turmaB.id,
        professorId: profB2.id,
        tipo: 'PROVA',
        semestreId: semestreB.id,
        data: new Date(),
        nome: 'P1 Banco de Dados',
        instituicaoId: instB.id,
      },
    });
  }

  let periodoB = await prisma.periodoLancamentoNotas.findFirst({
    where: { instituicaoId: instB.id, anoLetivoId: anoLetivoB.id, tipoPeriodo: 'SEMESTRE', numeroPeriodo: 1 },
  });
  if (!periodoB) {
    periodoB = await prisma.periodoLancamentoNotas.create({
      data: {
        instituicaoId: instB.id,
        anoLetivoId: anoLetivoB.id,
        tipoPeriodo: 'SEMESTRE',
        numeroPeriodo: 1,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 11, 31),
        status: 'ABERTO',
      },
    });
  } else {
    await prisma.periodoLancamentoNotas.update({
      where: { id: periodoB.id },
      data: {
        status: 'ABERTO',
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 11, 31),
      },
    });
  }
  console.log('  ✔ Inst B: turma, planos, avaliações, período ABERTO');

  // Assinaturas
  let planoAssin = await prisma.plano.findFirst({ where: { ativo: true } });
  if (!planoAssin) {
    planoAssin = await prisma.plano.create({
      data: {
        nome: 'Plano Teste',
        descricao: 'Para testes',
        valorMensal: 0,
        limiteAlunos: 1000,
        limiteProfessores: 100,
        limiteCursos: 50,
        ativo: true,
      },
    });
  }
  for (const inst of [instA, instB]) {
    let ass = await prisma.assinatura.findUnique({ where: { instituicaoId: inst.id } });
    const umAno = new Date();
    umAno.setFullYear(umAno.getFullYear() + 1);
    if (!ass) {
      await prisma.assinatura.create({
        data: {
          instituicaoId: inst.id,
          planoId: planoAssin!.id,
          status: 'ativa',
          tipo: 'PAGA',
          dataFim: umAno,
          dataProximoPagamento: umAno,
          valorAtual: 0,
        },
      });
    } else if (ass.status !== 'ativa') {
      await prisma.assinatura.update({
        where: { id: ass.id },
        data: { status: 'ativa' as any, dataFim: umAno },
      });
    }
  }
  console.log('  ✔ Assinaturas ativas');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CREDENCIAIS (senha: TestMultiTenant123!)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Inst A Secundário:');
  console.log('    Prof1 Matemática: prof.a1.mat@teste.dsicola.com');
  console.log('    Prof2 Informática: prof.a2.inf@teste.dsicola.com');
  console.log('    Estudante: aluno.inst.a@teste.dsicola.com');
  console.log('  Inst B Superior:');
  console.log('    Prof1 Programação: prof.b1.prog@teste.dsicola.com');
  console.log('    Prof2 BD: prof.b2.bd@teste.dsicola.com');
  console.log('    Estudante: aluno.inst.b@teste.dsicola.com');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
