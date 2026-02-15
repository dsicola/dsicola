#!/usr/bin/env npx tsx
/**
 * SEED: Dados para TESTE DE PERFORMANCE
 *
 * Requisitos mínimos:
 * - 200 alunos cadastrados (100 Secundário + 100 Superior)
 * - 20 professores (10 Secundário + 10 Superior)
 * - 10 turmas (5 Secundário + 5 Superior)
 * - 500 registros financeiros (250+ por instituição via mensalidades)
 *
 * Duas instituições: inst-a-secundario-test (SECUNDARIO) e inst-b-superior-test (SUPERIOR)
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts (ou inst A e B já existirem)
 * Uso: npx tsx scripts/seed-performance-test.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SENHA = 'TestMultiTenant123!';
const ANO = new Date().getFullYear();
const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

const TARGETS = {
  ALUNOS_SEC: 100,
  ALUNOS_SUP: 100,
  PROFESSORES_SEC: 10,
  PROFESSORES_SUP: 10,
  TURMAS_SEC: 5,
  TURMAS_SUP: 5,
  MENSALIDADES_PER_ALUNO: 5, // 5 meses × 100 alunos × 2 = 1000 ou usar 5×100 = 500 por inst
};

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SEED - TESTE DE PERFORMANCE');
  console.log(`  Meta: 200 alunos | 20 professores | 10 turmas | 500 mensalidades`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hashedPassword = await bcrypt.hash(SENHA, 10);

  let instA = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-a-secundario-test' } });
  let instB = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-b-superior-test' } });

  if (!instA) {
    instA = await prisma.instituicao.create({
      data: {
        nome: 'Instituição A - Secundário (Teste Performance)',
        subdominio: 'inst-a-secundario-test',
        tipoInstituicao: 'ENSINO_MEDIO',
        tipoAcademico: 'SECUNDARIO',
        status: 'ativa',
      },
    });
    console.log('  ✔ Instituição A criada');
  }
  if (!instB) {
    instB = await prisma.instituicao.create({
      data: {
        nome: 'Instituição B - Superior (Teste Performance)',
        subdominio: 'inst-b-superior-test',
        tipoInstituicao: 'UNIVERSIDADE',
        tipoAcademico: 'SUPERIOR',
        status: 'ativa',
      },
    });
    console.log('  ✔ Instituição B criada');
  }

  let plano = await prisma.plano.findFirst({ where: { ativo: true } });
  if (!plano) {
    plano = await prisma.plano.create({
      data: { nome: 'Plano Teste', descricao: 'Plano para testes', valorMensal: 0, ativo: true },
    });
  }

  for (const inst of [instA!, instB!]) {
    let assinatura = await prisma.assinatura.findFirst({ where: { instituicaoId: inst.id } });
    if (!assinatura) {
      const umAno = new Date();
      umAno.setFullYear(umAno.getFullYear() + 1);
      await prisma.assinatura.create({
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
    }
  }

  const criarOuAtualizarUser = async (
    email: string,
    nome: string,
    instituicaoId: string,
    roles: string[]
  ) => {
    let user = await prisma.user.findUnique({ where: { email }, include: { roles: true } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, password: hashedPassword, nomeCompleto: nome, instituicaoId },
        include: { roles: true },
      });
    }
    for (const role of roles) {
      const exists = await prisma.userRole_.findFirst({ where: { userId: user!.id, role: role as any } });
      if (!exists) {
        await prisma.userRole_.create({ data: { userId: user!.id, role: role as any, instituicaoId } });
      }
    }
    return (await prisma.user.findUniqueOrThrow({ where: { id: user!.id } }))!;
  };

  const adminA = await criarOuAtualizarUser('admin.inst.a@teste.dsicola.com', 'Admin A', instA!.id, ['ADMIN']);
  const adminB = await criarOuAtualizarUser('admin.inst.b@teste.dsicola.com', 'Admin B', instB!.id, ['ADMIN']);

  const TS = Date.now();

  // ─── INSTITUIÇÃO A (SECUNDÁRIO) ─────────────────────────────────────────
  console.log('\n📘 Instituição A (Secundário)...');

  let cursoA = await prisma.curso.findFirst({ where: { instituicaoId: instA!.id } });
  if (!cursoA) {
    cursoA = await prisma.curso.create({
      data: {
        instituicaoId: instA!.id,
        nome: 'Curso Secundário',
        codigo: `CS-PERF-${TS}`,
        cargaHoraria: 120,
        valorMensalidade: 0,
      },
    });
  }

  let classeA = await prisma.classe.findFirst({ where: { instituicaoId: instA!.id } });
  if (!classeA) {
    classeA = await prisma.classe.create({
      data: {
        instituicaoId: instA!.id,
        nome: '10ª Classe',
        codigo: `10C-PERF-${TS}`,
        cargaHoraria: 120,
        valorMensalidade: 75000,
      },
    });
  }

  let anoLetivoA = await prisma.anoLetivo.findFirst({ where: { instituicaoId: instA!.id } });
  if (!anoLetivoA) {
    anoLetivoA = await prisma.anoLetivo.create({
      data: {
        instituicaoId: instA!.id,
        ano: ANO,
        dataInicio: new Date(ANO, 0, 1),
        dataFim: new Date(ANO, 11, 31),
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: adminA.id,
      },
    });
  }

  const profEntsA: { id: string }[] = [];
  for (let i = 1; i <= TARGETS.PROFESSORES_SEC; i++) {
    const email = `prof.perf.sec.${i}.${TS}@teste.dsicola.com`;
    const prof = await criarOuAtualizarUser(email, `Professor Secundário ${i}`, instA!.id, ['PROFESSOR']);
    let ent = await prisma.professor.findFirst({ where: { userId: prof.id, instituicaoId: instA!.id } });
    if (!ent) {
      ent = await prisma.professor.create({ data: { userId: prof.id, instituicaoId: instA!.id } });
    }
    profEntsA.push({ id: ent.id });
  }
  console.log(`  ✔ ${TARGETS.PROFESSORES_SEC} professores`);

  const turmasA: { id: string }[] = [];
  for (let i = 1; i <= TARGETS.TURMAS_SEC; i++) {
    const nome = `Turma 10${String.fromCharCode(64 + i)} PERF ${TS}`;
    let t = await prisma.turma.findFirst({
      where: { instituicaoId: instA!.id, anoLetivoId: anoLetivoA.id, nome },
    });
    if (!t) {
      t = await prisma.turma.create({
        data: {
          instituicaoId: instA!.id,
          anoLetivoId: anoLetivoA.id,
          nome,
          cursoId: cursoA.id,
          classeId: classeA.id,
          ano: ANO,
          capacidade: 30,
        },
      });
    }
    turmasA.push({ id: t.id });
  }
  console.log(`  ✔ ${TARGETS.TURMAS_SEC} turmas`);

  const alunosA: string[] = [];
  for (let i = 1; i <= TARGETS.ALUNOS_SEC; i++) {
    const email = `aluno.perf.sec.${i}.${TS}@teste.dsicola.com`;
    let u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nomeCompleto: `Aluno Secundário ${i}`,
          instituicaoId: instA!.id,
        },
      });
      await prisma.userRole_.create({ data: { userId: u.id, role: 'ALUNO', instituicaoId: instA!.id } });
    }
    alunosA.push(u.id);
  }
  console.log(`  ✔ ${TARGETS.ALUNOS_SEC} alunos`);

  let matriculaCountA = 0;
  for (let i = 0; i < alunosA.length; i++) {
    const turmaId = turmasA[i % turmasA.length].id;
    const exists = await prisma.matricula.findUnique({
      where: { alunoId_turmaId: { alunoId: alunosA[i], turmaId } },
    });
    if (!exists) {
      await prisma.matricula.create({
        data: {
          alunoId: alunosA[i],
          turmaId,
          status: 'Ativa',
          anoLetivoId: anoLetivoA.id,
          anoLetivo: ANO,
        },
      });
      matriculaCountA++;
    }
  }

  let mensCountA = 0;
  const mesesParaMens = MESES.slice(0, TARGETS.MENSALIDADES_PER_ALUNO);
  for (const alunoId of alunosA) {
    for (const mes of mesesParaMens) {
      const exists = await prisma.mensalidade.findFirst({
        where: { alunoId, mesReferencia: mes, anoReferencia: ANO },
      });
      if (!exists) {
        const mat = await prisma.matricula.findFirst({ where: { alunoId } });
        await prisma.mensalidade.create({
          data: {
            alunoId,
            matriculaId: mat?.id,
            classeId: classeA.id,
            mesReferencia: mes,
            anoReferencia: ANO,
            valor: 75000,
            dataVencimento: new Date(ANO, parseInt(mes) - 1, 10),
            status: parseInt(mes) <= 3 ? 'Pago' : 'Pendente',
          },
        });
        mensCountA++;
      }
    }
  }
  console.log(`  ✔ ${mensCountA} mensalidades (meta ≥250)`);

  // ─── INSTITUIÇÃO B (SUPERIOR) ────────────────────────────────────────────
  console.log('\n📗 Instituição B (Superior)...');

  let cursoB = await prisma.curso.findFirst({ where: { instituicaoId: instB!.id } });
  if (!cursoB) {
    cursoB = await prisma.curso.create({
      data: {
        instituicaoId: instB!.id,
        nome: 'Curso Superior',
        codigo: `CSUP-PERF-${TS}`,
        cargaHoraria: 240,
        valorMensalidade: 120000,
      },
    });
  }

  let anoLetivoB = await prisma.anoLetivo.findFirst({ where: { instituicaoId: instB!.id } });
  if (!anoLetivoB) {
    anoLetivoB = await prisma.anoLetivo.create({
      data: {
        instituicaoId: instB!.id,
        ano: ANO,
        dataInicio: new Date(ANO, 0, 1),
        dataFim: new Date(ANO, 11, 31),
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: adminB.id,
      },
    });
  }

  let semestreB = await prisma.semestre.findFirst({ where: { anoLetivoId: anoLetivoB.id, instituicaoId: instB!.id } });
  if (!semestreB) {
    semestreB = await prisma.semestre.create({
      data: {
        anoLetivoId: anoLetivoB.id,
        anoLetivo: ANO,
        numero: 1,
        dataInicio: new Date(ANO, 0, 1),
        dataFim: new Date(ANO, 5, 30),
        instituicaoId: instB!.id,
      },
    });
  }

  for (let i = 1; i <= TARGETS.PROFESSORES_SUP; i++) {
    const email = `prof.perf.sup.${i}.${TS}@teste.dsicola.com`;
    const prof = await criarOuAtualizarUser(email, `Professor Superior ${i}`, instB!.id, ['PROFESSOR']);
    let ent = await prisma.professor.findFirst({ where: { userId: prof.id, instituicaoId: instB!.id } });
    if (!ent) {
      await prisma.professor.create({ data: { userId: prof.id, instituicaoId: instB!.id } });
    }
  }
  console.log(`  ✔ ${TARGETS.PROFESSORES_SUP} professores`);

  const turmasB: { id: string }[] = [];
  for (let i = 1; i <= TARGETS.TURMAS_SUP; i++) {
    const nome = `Turma S1-${i} PERF ${TS}`;
    let t = await prisma.turma.findFirst({
      where: { instituicaoId: instB!.id, anoLetivoId: anoLetivoB.id, nome },
    });
    if (!t) {
      t = await prisma.turma.create({
        data: {
          instituicaoId: instB!.id,
          anoLetivoId: anoLetivoB.id,
          nome,
          cursoId: cursoB.id,
          semestre: 1,
          ano: ANO,
          capacidade: 40,
        },
      });
    }
    turmasB.push({ id: t.id });
  }
  console.log(`  ✔ ${TARGETS.TURMAS_SUP} turmas`);

  const alunosB: string[] = [];
  for (let i = 1; i <= TARGETS.ALUNOS_SUP; i++) {
    const email = `aluno.perf.sup.${i}.${TS}@teste.dsicola.com`;
    let u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nomeCompleto: `Aluno Superior ${i}`,
          instituicaoId: instB!.id,
        },
      });
      await prisma.userRole_.create({ data: { userId: u.id, role: 'ALUNO', instituicaoId: instB!.id } });
    }
    alunosB.push(u.id);
  }
  console.log(`  ✔ ${TARGETS.ALUNOS_SUP} alunos`);

  let matriculaCountB = 0;
  for (let i = 0; i < alunosB.length; i++) {
    const turmaId = turmasB[i % turmasB.length].id;
    const exists = await prisma.matricula.findUnique({
      where: { alunoId_turmaId: { alunoId: alunosB[i], turmaId } },
    });
    if (!exists) {
      await prisma.matricula.create({
        data: {
          alunoId: alunosB[i],
          turmaId,
          status: 'Ativa',
          anoLetivoId: anoLetivoB.id,
          anoLetivo: ANO,
        },
      });
      matriculaCountB++;
    }
  }

  let mensCountB = 0;
  for (const alunoId of alunosB) {
    for (const mes of mesesParaMens) {
      const exists = await prisma.mensalidade.findFirst({
        where: { alunoId, mesReferencia: mes, anoReferencia: ANO },
      });
      if (!exists) {
        const mat = await prisma.matricula.findFirst({ where: { alunoId } });
        await prisma.mensalidade.create({
          data: {
            alunoId,
            matriculaId: mat?.id,
            cursoId: cursoB.id,
            mesReferencia: mes,
            anoReferencia: ANO,
            valor: 120000,
            dataVencimento: new Date(ANO, parseInt(mes) - 1, 10),
            status: parseInt(mes) <= 2 ? 'Pago' : 'Pendente',
          },
        });
        mensCountB++;
      }
    }
  }
  console.log(`  ✔ ${mensCountB} mensalidades (meta ≥250)`);

  // ─── RESUMO ─────────────────────────────────────────────────────────────
  const totalAlunos = await prisma.userRole_.count({
    where: { role: 'ALUNO', instituicaoId: { in: [instA!.id, instB!.id] } },
  });
  const totalProfessores = await prisma.userRole_.count({
    where: { role: 'PROFESSOR', instituicaoId: { in: [instA!.id, instB!.id] } },
  });
  const totalTurmas = await prisma.turma.count({
    where: { instituicaoId: { in: [instA!.id, instB!.id] } },
  });
  const totalMensalidades = await prisma.mensalidade.count({
    where: { aluno: { instituicaoId: { in: [instA!.id, instB!.id] } } },
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO - SEED PERFORMANCE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Alunos: ${totalAlunos} (meta: 200)`);
  console.log(`  Professores: ${totalProfessores} (meta: 20)`);
  console.log(`  Turmas: ${totalTurmas} (meta: 10)`);
  console.log(`  Mensalidades: ${totalMensalidades} (meta: 500)`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
