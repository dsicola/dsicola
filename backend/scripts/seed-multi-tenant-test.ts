#!/usr/bin/env npx tsx
/**
 * SEED: Dados para teste de validação Multi-Tenant
 *
 * Cria:
 * - Instituição A (Secundário) - tipoAcademico SECUNDARIO
 * - Instituição B (Superior) - tipoAcademico SUPERIOR
 * - Admin A (instituicaoId = A)
 * - Admin B (instituicaoId = B)
 * - Professor A (instituicaoId = A)
 * - Aluno A (instituicaoId = A)
 * - Aluno B (instituicaoId = B)
 *
 * Senha padrão para todos: TestMultiTenant123!
 *
 * Uso: npx tsx scripts/seed-multi-tenant-test.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SENHA = 'TestMultiTenant123!';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SEED - DADOS PARA TESTE MULTI-TENANT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hashedPassword = await bcrypt.hash(SENHA, 10);

  // 1. Instituição A (Secundário)
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
    console.log('  ✔ Instituição A (Secundário) criada:', instA.id);
  } else {
    console.log('  ✔ Instituição A já existe:', instA.id);
  }

  // 2. Instituição B (Superior)
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
    console.log('  ✔ Instituição B (Superior) criada:', instB.id);
  } else {
    console.log('  ✔ Instituição B já existe:', instB.id);
  }

  const criarOuAtualizarUser = async (
    email: string,
    nome: string,
    instituicaoId: string,
    roles: string[]
  ) => {
    let user = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId, email } },
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
        data: { instituicaoId, password: hashedPassword, mustChangePassword: false },
      });
    }
    for (const role of roles) {
      const exists = await prisma.userRole_.findFirst({
        where: { userId: user!.id, role: role as any },
      });
      if (!exists) {
        await prisma.userRole_.create({
          data: {
            userId: user!.id,
            role: role as any,
            instituicaoId,
          },
        });
      } else {
        await prisma.userRole_.updateMany({
          where: { userId: user!.id, role: role as any },
          data: { instituicaoId },
        });
      }
    }
    return { user: await prisma.user.findUniqueOrThrow({ where: { id: user!.id } }) };
  };

  // 3. Admin A
  const { user: adminA } = await criarOuAtualizarUser(
    'admin.inst.a@teste.dsicola.com',
    'Admin Instituição A',
    instA.id,
    ['ADMIN']
  );
  console.log('  ✔ Admin A:', adminA.email);

  // 4. Admin B
  const { user: adminB } = await criarOuAtualizarUser(
    'admin.inst.b@teste.dsicola.com',
    'Admin Instituição B',
    instB.id,
    ['ADMIN']
  );
  console.log('  ✔ Admin B:', adminB.email);

  // 5. Professor A
  const { user: profA } = await criarOuAtualizarUser(
    'prof.inst.a@teste.dsicola.com',
    'Professor Instituição A',
    instA.id,
    ['PROFESSOR']
  );
  let professorA = await prisma.professor.findFirst({
    where: { userId: profA.id, instituicaoId: instA.id },
  });
  if (!professorA) {
    professorA = await prisma.professor.create({
      data: {
        userId: profA.id,
        instituicaoId: instA.id,
      },
    });
    console.log('  ✔ Professor A (entidade) criado');
  }
  console.log('  ✔ Professor A:', profA.email);

  // 6. Aluno A
  const { user: alunoA } = await criarOuAtualizarUser(
    'aluno.inst.a@teste.dsicola.com',
    'Aluno Instituição A',
    instA.id,
    ['ALUNO']
  );
  console.log('  ✔ Aluno A:', alunoA.email);

  // 6b. Professor B (para fluxo Superior)
  const { user: profB } = await criarOuAtualizarUser(
    'prof.inst.b@teste.dsicola.com',
    'Professor Instituição B',
    instB.id,
    ['PROFESSOR']
  );
  let professorB = await prisma.professor.findFirst({
    where: { userId: profB.id, instituicaoId: instB.id },
  });
  if (!professorB) {
    professorB = await prisma.professor.create({
      data: {
        userId: profB.id,
        instituicaoId: instB.id,
      },
    });
    console.log('  ✔ Professor B (entidade) criado');
  }
  console.log('  ✔ Professor B:', profB.email);

  // 7. Aluno B
  const { user: alunoB } = await criarOuAtualizarUser(
    'aluno.inst.b@teste.dsicola.com',
    'Aluno Instituição B',
    instB.id,
    ['ALUNO']
  );
  console.log('  ✔ Aluno B:', alunoB.email);

  // 8. Estrutura acadêmica para Inst A (ano letivo, curso, classe, turma, disciplina - para testes de matrícula)
  const ano = new Date().getFullYear();
  let anoLetivoA = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instA.id, ano },
  });
  if (!anoLetivoA) {
    anoLetivoA = await prisma.anoLetivo.create({
      data: {
        instituicaoId: instA.id,
        ano,
        status: 'ATIVO',
        dataInicio: new Date(ano, 0, 1),
      },
    });
    console.log('  ✔ Ano letivo Inst A criado');
  }
  let cursoA = await prisma.curso.findFirst({ where: { instituicaoId: instA.id } });
  if (!cursoA) {
    cursoA = await prisma.curso.create({
      data: {
        instituicaoId: instA.id,
        nome: 'Curso Teste Secundário',
        codigo: 'CTS',
        valorMensalidade: 0,
      },
    });
    console.log('  ✔ Curso Inst A criado');
  }
  let classeA = await prisma.classe.findFirst({
    where: { instituicaoId: instA.id, nome: { contains: '10' } },
  });
  if (!classeA) {
    classeA = await prisma.classe.create({
      data: {
        instituicaoId: instA.id,
        codigo: '10',
        nome: '10ª Classe',
        ordem: 10,
        cargaHoraria: 0,
      },
    });
    console.log('  ✔ Classe Inst A criada');
  }
  let disciplinaA = await prisma.disciplina.findFirst({
    where: { instituicaoId: instA.id },
  });
  if (!disciplinaA) {
    disciplinaA = await prisma.disciplina.create({
      data: {
        instituicaoId: instA.id,
        nome: 'Matemática',
        codigo: 'MAT',
        cargaHoraria: 60,
        cursoId: cursoA.id,
      },
    });
    await prisma.cursoDisciplina.upsert({
      where: {
        cursoId_disciplinaId: { cursoId: cursoA.id, disciplinaId: disciplinaA.id },
      },
      create: { cursoId: cursoA.id, disciplinaId: disciplinaA.id },
      update: {},
    });
    console.log('  ✔ Disciplina Inst A criada');
  }
  let turnoA = await prisma.turno.findFirst({ where: { instituicaoId: instA.id } });
  if (!turnoA) {
    turnoA = await prisma.turno.create({
      data: { instituicaoId: instA.id, nome: 'Manhã' },
    });
  }
  const nomeTurmaA = '10ª Classe - Turma A';
  let turmaA = await prisma.turma.findFirst({
    where: { instituicaoId: instA.id, anoLetivoId: anoLetivoA.id, nome: nomeTurmaA },
  });
  if (!turmaA) {
    turmaA = await prisma.turma.create({
      data: {
        instituicaoId: instA.id,
        anoLetivoId: anoLetivoA.id,
        nome: nomeTurmaA,
        cursoId: cursoA.id,
        classeId: classeA.id,
        turnoId: turnoA.id,
        capacidade: 30,
      },
    });
    console.log('  ✔ Turma Inst A criada');
  }

  // 8a. Matrícula anual do Aluno A (para E2E "matricular em turma" poder usar aluno existente)
  const matriculaAnualAlunoA = await prisma.matriculaAnual.findFirst({
    where: { alunoId: alunoA.id, instituicaoId: instA.id, anoLetivoId: anoLetivoA.id },
  });
  if (!matriculaAnualAlunoA) {
    await prisma.matriculaAnual.create({
      data: {
        alunoId: alunoA.id,
        instituicaoId: instA.id,
        anoLetivoId: anoLetivoA.id,
        anoLetivo: anoLetivoA.ano,
        nivelEnsino: 'SECUNDARIO',
        classeOuAnoCurso: classeA.nome,
        classeId: classeA.id,
        status: 'ATIVA',
      },
    });
    console.log('  ✔ Matrícula anual Aluno A (Inst A) criada');
  } else {
    console.log('  ✔ Matrícula anual Aluno A já existe');
  }

  // 8a2. Matrícula (aluno em turma) Inst A — para professor ver alunos em GestaoNotas
  let matriculaAlunoATurmaA = await prisma.matricula.findFirst({
    where: { alunoId: alunoA.id, turmaId: turmaA.id },
  });
  if (!matriculaAlunoATurmaA) {
    matriculaAlunoATurmaA = await prisma.matricula.create({
      data: {
        alunoId: alunoA.id,
        turmaId: turmaA.id,
        anoLetivoId: anoLetivoA.id,
        anoLetivo: anoLetivoA.ano,
        status: 'Ativa',
      },
    });
    console.log('  ✔ Matrícula Aluno A em Turma A criada');
  } else if (matriculaAlunoATurmaA.status !== 'Ativa') {
    await prisma.matricula.update({
      where: { id: matriculaAlunoATurmaA.id },
      data: { status: 'Ativa' },
    });
    console.log('  ✔ Matrícula Aluno A em Turma A atualizada para Ativa');
  }

  // 8a3. Plano de Ensino Inst A (Professor A — Disciplina Matemática — Turma A) — para E2E lançar notas
  let planoEnsinoA = await prisma.planoEnsino.findFirst({
    where: {
      instituicaoId: instA.id,
      professorId: professorA.id,
      turmaId: turmaA.id,
      disciplinaId: disciplinaA.id,
    },
  });
  if (!planoEnsinoA) {
    planoEnsinoA = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instA.id,
        professorId: professorA.id,
        disciplinaId: disciplinaA.id,
        turmaId: turmaA.id,
        anoLetivoId: anoLetivoA.id,
        anoLetivo: anoLetivoA.ano,
        classeId: classeA.id,
        classeOuAno: classeA.nome,
        status: 'APROVADO',
        estado: 'APROVADO',
        bloqueado: false,
      },
    });
    console.log('  ✔ Plano de Ensino Inst A (Prof A — Matemática — Turma A) criado');
  } else if (planoEnsinoA.estado !== 'APROVADO' || planoEnsinoA.bloqueado) {
    await prisma.planoEnsino.update({
      where: { id: planoEnsinoA.id },
      data: { estado: 'APROVADO', status: 'APROVADO', bloqueado: false },
    });
    console.log('  ✔ Plano de Ensino Inst A atualizado para APROVADO (para E2E lançar notas)');
  }

  // 8a4. Exame "1º Trimestre" Turma A — para professor lançar notas (Secundário)
  let exameTurmaA = await prisma.exame.findFirst({
    where: { turmaId: turmaA.id, nome: '1º Trimestre' },
  });
  if (!exameTurmaA) {
    exameTurmaA = await prisma.exame.create({
      data: {
        turmaId: turmaA.id,
        nome: '1º Trimestre',
        tipo: '1º Trimestre',
        dataExame: new Date(),
        peso: 1,
        status: 'agendado',
      },
    });
    console.log('  ✔ Exame 1º Trimestre Turma A criado');
  }

  // 8a5. Período de lançamento de notas Inst A (Secundário — Trimestre 1) — para professor poder lançar notas
  const inicioAnoA = new Date(ano, 0, 1);
  const fimAnoA = new Date(ano, 11, 31);
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
        dataInicio: inicioAnoA,
        dataFim: fimAnoA,
        status: 'ABERTO',
      },
    });
    console.log('  ✔ Período lançamento notas Inst A (Trimestre 1) criado');
  } else {
    await prisma.periodoLancamentoNotas.update({
      where: { id: periodoA.id },
      data: { dataInicio: inicioAnoA, dataFim: fimAnoA, status: 'ABERTO' },
    });
    console.log('  ✔ Período lançamento notas Inst A (Trimestre 1) atualizado para ABERTO');
  }

  // 8a6. Uma mensalidade Pendente para Aluno A (Inst A) — para E2E Financeiro: listar e registrar pagamento
  const mesRef = new Date().getMonth() + 1;
  const anoRef = new Date().getFullYear();
  const existenteMensalidadeA = await prisma.mensalidade.findFirst({
    where: { alunoId: alunoA.id, mesReferencia: String(mesRef), anoReferencia: anoRef },
  });
  if (!existenteMensalidadeA) {
    const vencimento = new Date(anoRef, mesRef - 1, 28);
    if (vencimento < new Date()) vencimento.setMonth(vencimento.getMonth() + 1);
    await prisma.mensalidade.create({
      data: {
        alunoId: alunoA.id,
        cursoId: cursoA.id,
        classeId: classeA.id,
        matriculaId: matriculaAlunoATurmaA?.id ?? null,
        mesReferencia: String(mesRef),
        anoReferencia: anoRef,
        valor: 50000,
        valorDesconto: 0,
        dataVencimento: vencimento,
        status: 'Pendente',
      },
    });
    console.log('  ✔ Mensalidade Pendente (Aluno A) criada para E2E financeiro');
  }

  // 8b. Ano letivo para Inst B (para testes de período de lançamento multi-tenant)
  let anoLetivoB = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instB.id, ano },
  });
  if (!anoLetivoB) {
    anoLetivoB = await prisma.anoLetivo.create({
      data: {
        instituicaoId: instB.id,
        ano,
        status: 'ATIVO',
        dataInicio: new Date(ano, 0, 1),
      },
    });
    console.log('  ✔ Ano letivo Inst B criado');
  }

  // 8b2. Estrutura académica Inst B (Superior): curso, disciplina, turma, matrícula, plano, exame
  let cursoB = await prisma.curso.findFirst({ where: { instituicaoId: instB.id } });
  if (!cursoB) {
    cursoB = await prisma.curso.create({
      data: {
        instituicaoId: instB.id,
        nome: 'Licenciatura Teste',
        codigo: 'LT',
        valorMensalidade: 0,
      },
    });
    console.log('  ✔ Curso Inst B criado');
  }
  let disciplinaB = await prisma.disciplina.findFirst({ where: { instituicaoId: instB.id } });
  if (!disciplinaB) {
    disciplinaB = await prisma.disciplina.create({
      data: {
        instituicaoId: instB.id,
        nome: 'Introdução à Programação',
        codigo: 'IP',
        cargaHoraria: 60,
        cursoId: cursoB.id,
      },
    });
    console.log('  ✔ Disciplina Inst B criada');
  }
  let turnoB = await prisma.turno.findFirst({ where: { instituicaoId: instB.id } });
  if (!turnoB) {
    turnoB = await prisma.turno.create({
      data: { instituicaoId: instB.id, nome: 'Manhã' },
    });
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
        ano: ano,
        semestre: 1,
      },
    });
    console.log('  ✔ Turma Inst B criada');
  }
  let matriculaAnualB = await prisma.matriculaAnual.findFirst({
    where: { alunoId: alunoB.id, instituicaoId: instB.id, anoLetivoId: anoLetivoB.id },
  });
  if (!matriculaAnualB) {
    await prisma.matriculaAnual.create({
      data: {
        alunoId: alunoB.id,
        instituicaoId: instB.id,
        anoLetivoId: anoLetivoB.id,
        anoLetivo: anoLetivoB.ano,
        nivelEnsino: 'SUPERIOR',
        classeOuAnoCurso: '1º Ano',
        cursoId: cursoB.id,
        status: 'ATIVA',
      },
    });
    console.log('  ✔ Matrícula anual Aluno B (Inst B) criada');
  }
  let matriculaAlunoBTurmaB = await prisma.matricula.findFirst({
    where: { alunoId: alunoB.id, turmaId: turmaB.id },
  });
  if (!matriculaAlunoBTurmaB) {
    await prisma.matricula.create({
      data: {
        alunoId: alunoB.id,
        turmaId: turmaB.id,
        anoLetivoId: anoLetivoB.id,
        anoLetivo: anoLetivoB.ano,
        status: 'Ativa',
      },
    });
    console.log('  ✔ Matrícula Aluno B em Turma B criada');
  }
  let planoEnsinoB = await prisma.planoEnsino.findFirst({
    where: {
      instituicaoId: instB.id,
      professorId: professorB.id,
      turmaId: turmaB.id,
      disciplinaId: disciplinaB.id,
    },
  });
  if (!planoEnsinoB) {
    planoEnsinoB = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instB.id,
        professorId: professorB.id,
        disciplinaId: disciplinaB.id,
        turmaId: turmaB.id,
        anoLetivoId: anoLetivoB.id,
        anoLetivo: anoLetivoB.ano,
        cursoId: cursoB.id,
        classeOuAno: '1º Ano',
        status: 'APROVADO',
        estado: 'APROVADO',
        bloqueado: false,
      },
    });
    console.log('  ✔ Plano de Ensino Inst B (Prof B — Turma 1) criado');
  } else {
    await prisma.planoEnsino.update({
      where: { id: planoEnsinoB.id },
      data: { estado: 'APROVADO', status: 'APROVADO', bloqueado: false },
    });
    console.log('  ✔ Plano de Ensino Inst B atualizado para APROVADO (para E2E lançar notas)');
  }
  let exameTurmaB = await prisma.exame.findFirst({
    where: { turmaId: turmaB.id, nome: '1ª Prova' },
  });
  if (!exameTurmaB) {
    await prisma.exame.create({
      data: {
        turmaId: turmaB.id,
        nome: '1ª Prova',
        tipo: '1ª Prova',
        dataExame: new Date(),
        peso: 1,
        status: 'agendado',
      },
    });
    console.log('  ✔ Exame 1ª Prova Turma B criado');
  }

  const inicioAnoB = new Date(ano, 0, 1);
  const fimAnoB = new Date(ano, 11, 31);
  const periodoB = await prisma.periodoLancamentoNotas.findFirst({
    where: { instituicaoId: instB.id, anoLetivoId: anoLetivoB.id, tipoPeriodo: 'SEMESTRE', numeroPeriodo: 1 },
  });
  if (!periodoB) {
    await prisma.periodoLancamentoNotas.create({
      data: {
        instituicaoId: instB.id,
        anoLetivoId: anoLetivoB.id,
        tipoPeriodo: 'SEMESTRE',
        numeroPeriodo: 1,
        dataInicio: inicioAnoB,
        dataFim: fimAnoB,
        status: 'ABERTO',
      },
    });
    console.log('  ✔ Período lançamento notas Inst B (Semestre 1) criado');
  }

  // 8c. Resetar bloqueio de login (rate limit)
  await prisma.loginAttempt.deleteMany({
    where: {
      email: {
        in: [
          'admin.inst.a@teste.dsicola.com',
          'admin.inst.b@teste.dsicola.com',
          'prof.inst.a@teste.dsicola.com',
        ].map((e) => e.toLowerCase()),
      },
    },
  });

  // 9. Assinaturas ativas (obrigatório para licenciamento - validateLicense)
  let plano = await prisma.plano.findFirst({ where: { ativo: true } });
  if (!plano) {
    plano = await prisma.plano.create({
      data: {
        nome: 'Plano Teste',
        descricao: 'Para testes automatizados',
        valorMensal: 0,
        limiteAlunos: 1000,
        limiteProfessores: 100,
        limiteCursos: 50,
        ativo: true,
      },
    });
    console.log('  ✔ Plano teste criado');
  }
  const umAno = new Date();
  umAno.setFullYear(umAno.getFullYear() + 1);

  for (const [inst, label] of [[instA, 'Inst A'], [instB, 'Inst B']] as const) {
    let assinatura = await prisma.assinatura.findUnique({ where: { instituicaoId: inst.id } });
    if (!assinatura) {
      assinatura = await prisma.assinatura.create({
        data: {
          instituicaoId: inst.id,
          planoId: plano!.id,
          status: 'ativa',
          tipo: 'PAGA',
          dataFim: umAno,
          dataProximoPagamento: umAno,
          valorAtual: 0,
        },
      });
      console.log(`  ✔ Assinatura ativa criada para ${label}`);
    } else if (assinatura.status !== 'ativa') {
      await prisma.assinatura.update({
        where: { id: assinatura.id },
        data: { status: 'ativa' as any, dataFim: umAno },
      });
      console.log(`  ✔ Assinatura reativada para ${label}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CONFIGURE O .env PARA OS TESTES:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`
TEST_USER_INST_A_EMAIL="admin.inst.a@teste.dsicola.com"
TEST_USER_INST_A_PASSWORD="TestMultiTenant123!"

TEST_USER_INST_B_EMAIL="admin.inst.b@teste.dsicola.com"
TEST_USER_INST_B_PASSWORD="TestMultiTenant123!"

# Para teste Professor A não vê alunos B:
TEST_PROF_INST_A_EMAIL="prof.inst.a@teste.dsicola.com"
TEST_PROF_INST_A_PASSWORD="TestMultiTenant123!"
`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
