#!/usr/bin/env npx tsx
/**
 * SEED: 100+ registros para teste de RELATÓRIOS
 *
 * Cria dados em DUAS instituições (Secundário e Superior):
 * - 55+ alunos por instituição (110+ total)
 * - 5 turmas por instituição (10 total)
 * - Matrículas distribuidas (110+)
 * - Mensalidades (12 meses × 55 alunos × 2 = 1320)
 * - PlanoEnsino, Disciplina para boletim/histórico
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts (ou inst A e B já existirem)
 * Uso: npx tsx scripts/seed-relatorios-100plus.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
const SENHA = 'TestMultiTenant123!';
const ANO = new Date().getFullYear();
const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SEED - 100+ REGISTROS PARA TESTE DE RELATÓRIOS');
  console.log('  Secundário + Superior | Alunos, Turmas, Matrículas, Mensalidades');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hashedPassword = await bcrypt.hash(SENHA, 10);

  // Garantir instituições
  let instA = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-a-secundario-test' } });
  let instB = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-b-superior-test' } });

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
    console.log('  ✔ Instituição A criada');
  }
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
    console.log('  ✔ Instituição B criada');
  }

  // Plano para assinaturas
  let plano = await prisma.plano.findFirst({ where: { ativo: true } });
  if (!plano) {
    plano = await prisma.plano.create({
      data: {
        nome: 'Plano Teste',
        descricao: 'Plano para testes',
        valorMensal: 0,
        ativo: true,
      },
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
    let user = await prisma.user.findFirst({ where: { email }, include: { roles: true } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nomeCompleto: nome,
          instituicaoId,
        },
        include: { roles: true },
      });
    }
    for (const role of roles) {
      const exists = await prisma.userRole_.findFirst({
        where: { userId: user!.id, role: role as any },
      });
      if (!exists) {
        await prisma.userRole_.create({
          data: { userId: user!.id, role: role as any, instituicaoId },
        });
      }
    }
    return (await prisma.user.findUniqueOrThrow({ where: { id: user!.id } }))!;
  };

  // Admin e Professor por instituição
  const adminA = await criarOuAtualizarUser('admin.inst.a@teste.dsicola.com', 'Admin A', instA!.id, ['ADMIN']);
  const adminB = await criarOuAtualizarUser('admin.inst.b@teste.dsicola.com', 'Admin B', instB!.id, ['ADMIN']);
  const profA = await criarOuAtualizarUser('prof.inst.a@teste.dsicola.com', 'Prof A', instA!.id, ['PROFESSOR']);
  const profB = await criarOuAtualizarUser('prof.inst.b@teste.dsicola.com', 'Prof B', instB!.id, ['PROFESSOR']);

  let profEntA = await prisma.professor.findFirst({ where: { userId: profA.id, instituicaoId: instA!.id } });
  if (!profEntA) {
    profEntA = await prisma.professor.create({
      data: { userId: profA.id, instituicaoId: instA!.id },
    });
  }
  let profEntB = await prisma.professor.findFirst({ where: { userId: profB.id, instituicaoId: instB!.id } });
  if (!profEntB) {
    profEntB = await prisma.professor.create({
      data: { userId: profB.id, instituicaoId: instB!.id },
    });
  }

  const TS = Date.now();

  // ─── INSTITUIÇÃO A (SECUNDÁRIO) ─────────────────────────────────────────
  console.log('\n📘 Instituição A (Secundário)...');

  let cursoA = await prisma.curso.findFirst({ where: { instituicaoId: instA!.id } });
  if (!cursoA) {
    cursoA = await prisma.curso.create({
      data: {
        instituicaoId: instA!.id,
        nome: 'Curso Secundário',
        codigo: `CS${TS}`,
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
        codigo: `10C-${TS}`,
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

  // 5 turmas A
  const turmasA: { id: string; nome: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    let t = await prisma.turma.findFirst({
      where: { instituicaoId: instA!.id, anoLetivoId: anoLetivoA.id, nome: `Turma 10${String.fromCharCode(64 + i)} ${TS}` },
    });
    if (!t) {
      t = await prisma.turma.create({
        data: {
          instituicaoId: instA!.id,
          anoLetivoId: anoLetivoA.id,
          nome: `Turma 10${String.fromCharCode(64 + i)} ${TS}`,
          cursoId: cursoA.id,
          classeId: classeA.id,
          ano: ANO,
          capacidade: 30,
        },
      });
    }
    turmasA.push({ id: t.id, nome: t.nome });
  }

  // 55 alunos A
  const alunosA: string[] = [];
  for (let i = 1; i <= 55; i++) {
    const email = `aluno.rel.sec.${i}.${TS}@teste.dsicola.com`;
    let u = await prisma.user.findFirst({ where: { email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nomeCompleto: `Aluno Secundário ${i}`,
          instituicaoId: instA!.id,
        },
      });
      await prisma.userRole_.create({
        data: { userId: u.id, role: 'ALUNO', instituicaoId: instA!.id },
      });
    }
    alunosA.push(u.id);
  }

  // Matrículas A: distribuir 55 alunos nas 5 turmas
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
  console.log(`  ✔ ${alunosA.length} alunos, ${turmasA.length} turmas, ${matriculaCountA} matrículas novas`);

  // Mensalidades A: 55 alunos × 12 meses
  let mensCountA = 0;
  for (const alunoId of alunosA) {
    for (const mes of MESES) {
      const exists = await prisma.mensalidade.findFirst({
        where: {
          alunoId,
          mesReferencia: mes,
          anoReferencia: ANO,
        },
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
            status: parseInt(mes) <= 6 ? 'Pago' : 'Pendente',
          },
        });
        mensCountA++;
      }
    }
  }
  console.log(`  ✔ ${mensCountA} mensalidades novas`);

  // Disciplina e PlanoEnsino A (para boletim/histórico)
  let discA = await prisma.disciplina.findFirst({ where: { instituicaoId: instA!.id } });
  if (!discA) {
    discA = await prisma.disciplina.create({
      data: {
        instituicaoId: instA!.id,
        nome: 'Matemática',
        codigo: 'MAT',
        cargaHoraria: 120,
      },
    });
  }
  const planoA = await prisma.planoEnsino.findFirst({
    where: { instituicaoId: instA!.id, disciplinaId: discA.id, anoLetivoId: anoLetivoA.id },
  });
  if (!planoA) {
    await prisma.planoEnsino.create({
      data: {
        instituicaoId: instA!.id,
        turmaId: turmasA[0].id,
        disciplinaId: discA.id,
        professorId: profEntA.id,
        anoLetivoId: anoLetivoA.id,
        anoLetivo: ANO,
        classeOuAno: '10ª Classe',
        cargaHorariaTotal: 120,
        status: 'APROVADO',
        estado: 'APROVADO',
      },
    });
  }

  // Matrículas anuais A (para historico)
  for (const alunoId of alunosA.slice(0, 10)) {
    const ex = await prisma.matriculaAnual.findFirst({
      where: { alunoId, anoLetivoId: anoLetivoA.id },
    });
    if (!ex) {
      await prisma.matriculaAnual.create({
        data: {
          alunoId,
          instituicaoId: instA!.id,
          anoLetivoId: anoLetivoA.id,
          anoLetivo: ANO,
          nivelEnsino: 'SECUNDARIO',
          classeOuAnoCurso: '10ª Classe',
          cursoId: cursoA.id,
          classeId: classeA.id,
          status: 'ATIVA',
        },
      });
    }
  }

  // Trimestres fechados A (para boletim)
  for (let tr = 1; tr <= 3; tr++) {
    const ex = await prisma.trimestreFechado.findFirst({
      where: { instituicaoId: instA!.id, anoLetivo: ANO, trimestre: tr },
    });
    if (!ex) {
      await prisma.trimestreFechado.create({
        data: {
          instituicaoId: instA!.id,
          anoLetivo: ANO,
          trimestre: tr,
          fechado: true,
          dataFechamento: new Date(),
        },
      });
    }
  }

  // ─── INSTITUIÇÃO B (SUPERIOR) ────────────────────────────────────────────
  console.log('\n📗 Instituição B (Superior)...');

  let cursoB = await prisma.curso.findFirst({ where: { instituicaoId: instB!.id } });
  if (!cursoB) {
    cursoB = await prisma.curso.create({
      data: {
        instituicaoId: instB!.id,
        nome: 'Curso Superior',
        codigo: `CSUP${TS}`,
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

  let semestreB = await prisma.semestre.findFirst({
    where: { anoLetivoId: anoLetivoB.id, instituicaoId: instB!.id },
  });
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

  const turmasB: { id: string; nome: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    let t = await prisma.turma.findFirst({
      where: { instituicaoId: instB!.id, anoLetivoId: anoLetivoB.id, nome: `Turma S1-${i} ${TS}` },
    });
    if (!t) {
      t = await prisma.turma.create({
        data: {
          instituicaoId: instB!.id,
          anoLetivoId: anoLetivoB.id,
          nome: `Turma S1-${i} ${TS}`,
          cursoId: cursoB.id,
          semestre: 1,
          ano: ANO,
          capacidade: 40,
        },
      });
    }
    turmasB.push({ id: t.id, nome: t.nome });
  }

  const alunosB: string[] = [];
  for (let i = 1; i <= 55; i++) {
    const email = `aluno.rel.sup.${i}.${TS}@teste.dsicola.com`;
    let u = await prisma.user.findFirst({ where: { email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nomeCompleto: `Aluno Superior ${i}`,
          instituicaoId: instB!.id,
        },
      });
      await prisma.userRole_.create({
        data: { userId: u.id, role: 'ALUNO', instituicaoId: instB!.id },
      });
    }
    alunosB.push(u.id);
  }

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
  console.log(`  ✔ ${alunosB.length} alunos, ${turmasB.length} turmas, ${matriculaCountB} matrículas novas`);

  let mensCountB = 0;
  for (const alunoId of alunosB) {
    for (const mes of MESES) {
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
            status: parseInt(mes) <= 4 ? 'Pago' : 'Pendente',
          },
        });
        mensCountB++;
      }
    }
  }
  console.log(`  ✔ ${mensCountB} mensalidades novas`);

  let discB = await prisma.disciplina.findFirst({ where: { instituicaoId: instB!.id } });
  if (!discB) {
    discB = await prisma.disciplina.create({
      data: {
        instituicaoId: instB!.id,
        nome: 'Cálculo I',
        codigo: 'CALC1',
        cargaHoraria: 60,
      },
    });
  }
  const planoB = await prisma.planoEnsino.findFirst({
    where: { instituicaoId: instB!.id, disciplinaId: discB.id, anoLetivoId: anoLetivoB.id },
  });
  if (!planoB) {
    await prisma.planoEnsino.create({
      data: {
        instituicaoId: instB!.id,
        turmaId: turmasB[0].id,
        disciplinaId: discB.id,
        professorId: profEntB.id,
        anoLetivoId: anoLetivoB.id,
        anoLetivo: ANO,
        semestre: 1,
        semestreId: semestreB.id,
        cargaHorariaTotal: 60,
        status: 'APROVADO',
        estado: 'APROVADO',
      },
    });
  }

  for (const alunoId of alunosB.slice(0, 10)) {
    const ex = await prisma.matriculaAnual.findFirst({
      where: { alunoId, anoLetivoId: anoLetivoB.id },
    });
    if (!ex) {
      await prisma.matriculaAnual.create({
        data: {
          alunoId,
          instituicaoId: instB!.id,
          anoLetivoId: anoLetivoB.id,
          anoLetivo: ANO,
          nivelEnsino: 'SUPERIOR',
          classeOuAnoCurso: cursoB.nome,
          cursoId: cursoB.id,
          status: 'ATIVA',
        },
      });
    }
  }

  for (let tr = 1; tr <= 3; tr++) {
    const ex = await prisma.trimestreFechado.findFirst({
      where: { instituicaoId: instB!.id, anoLetivo: ANO, trimestre: tr },
    });
    if (!ex) {
      await prisma.trimestreFechado.create({
        data: {
          instituicaoId: instB!.id,
          anoLetivo: ANO,
          trimestre: tr,
          fechado: true,
          dataFechamento: new Date(),
        },
      });
    }
  }

  // ─── RESUMO ─────────────────────────────────────────────────────────────
  const totalAlunos = await prisma.user.count({
    where: {
      roles: { some: { role: 'ALUNO' } },
      instituicaoId: { in: [instA!.id, instB!.id] },
    },
  });
  const totalMatriculas = await prisma.matricula.count({
    where: {
      aluno: { instituicaoId: { in: [instA!.id, instB!.id] } },
    },
  });
  const totalMensalidades = await prisma.mensalidade.count({
    where: {
      aluno: { instituicaoId: { in: [instA!.id, instB!.id] } },
    },
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO - REGISTROS PARA TESTE DE RELATÓRIOS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Alunos: ${totalAlunos}`);
  console.log(`  Matrículas: ${totalMatriculas}`);
  console.log(`  Mensalidades: ${totalMensalidades}`);
  console.log(`  Total: ${totalAlunos + totalMatriculas + totalMensalidades}+`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
