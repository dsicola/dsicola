#!/usr/bin/env npx tsx
/**
 * TESTE: Dois professores (X e Y) devem conseguir lançar notas
 *
 * Cenário:
 * - Uma instituição (Secundário), uma turma, dois professores (X = Português, Y = Informática),
 *   dois estudantes, dois planos de ensino, duas avaliações (uma por disciplina).
 * - Professor X lança nota via POST /notas/avaliacao/lote -> 201.
 * - Professor Y lança nota via POST /notas/avaliacao/lote -> 201.
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts
 * Backend a correr: API_URL (ex: http://localhost:3001)
 *
 * Uso: npx tsx scripts/test-dois-professores-lancam-notas.ts
 * Ou: npm run test:dois-professores-lancam
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

const SENHA = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

interface AssertResult {
  name: string;
  ok: boolean;
  details?: string;
}

const results: AssertResult[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE: Professor X e Professor Y devem conseguir lançar notas (Secundário)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let instA: { id: string; nome: string } | null = null;
  let profX: { id: string; userId: string } | null = null;
  let profY: { id: string; userId: string } | null = null;
  let userX: { email: string } | null = null;
  let userY: { email: string } | null = null;
  let turmaA: { id: string } | null = null;
  let aluno1: { id: string } | null = null;
  let aluno2: { id: string } | null = null;
  let avaliacaoX: { id: string } | null = null;
  let avaliacaoY: { id: string } | null = null;
  let tokenX: string | null = null;
  let tokenY: string | null = null;

  try {
    // 1. Instituição A (Secundário)
    instA = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
      select: { id: true, nome: true },
    });
    if (!instA) {
      instA = await prisma.instituicao.findFirst({
        where: { tipoAcademico: 'SECUNDARIO' },
        select: { id: true, nome: true },
        take: 1,
      });
    }
    if (!instA) {
      assert('Instituição Secundário disponível', false, 'Rode: npx tsx scripts/seed-multi-tenant-test.ts');
      process.exit(1);
    }
    assert('Instituição A disponível', true, instA.nome);

    const ano = new Date().getFullYear();
    const anoLetivoA = await prisma.anoLetivo.findFirst({
      where: { instituicaoId: instA.id, ano },
      select: { id: true },
    });
    if (!anoLetivoA) {
      assert('Ano letivo Inst A', false, 'Execute seed-multi-tenant-test');
      process.exit(1);
    }

    turmaA = await prisma.turma.findFirst({
      where: { instituicaoId: instA.id, anoLetivoId: anoLetivoA.id },
      select: { id: true },
    });
    if (!turmaA) {
      assert('Turma Inst A', false, 'Execute seed-multi-tenant-test');
      process.exit(1);
    }

    // 2. Professor X (Prof A do seed - Matemática ou primeiro professor)
    const profAX = await prisma.professor.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true, userId: true },
    });
    if (profAX) {
      profX = profAX;
      userX = await prisma.user.findUnique({
        where: { id: profAX.userId },
        select: { email: true },
      });
    }
    if (!profX || !userX) {
      assert('Professor X existe', false, 'Seed deve criar pelo menos um professor em Inst A');
      process.exit(1);
    }
    assert('Professor X existe', true, userX.email);

    // 3. Disciplina para Professor Y (Informática)
    const cursoA = await prisma.curso.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true },
    });
    if (!cursoA) {
      assert('Curso Inst A', false, 'Execute seed');
      process.exit(1);
    }

    let discInformatica = await prisma.disciplina.findFirst({
      where: { instituicaoId: instA.id, nome: { contains: 'Informática' } },
      select: { id: true },
    });
    if (!discInformatica && cursoA) {
      discInformatica = await prisma.disciplina.create({
        data: {
          instituicaoId: instA.id,
          nome: 'Informática',
          codigo: 'INF',
          cargaHoraria: 60,
          cursoId: cursoA.id,
        },
        select: { id: true },
      });
    }
    if (!discInformatica) {
      assert('Disciplina Informática', false, 'Não foi possível criar');
      process.exit(1);
    }

    const classeA = await prisma.classe.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true, nome: true },
    });
    if (!classeA) {
      assert('Classe Inst A', false, 'Execute seed');
      process.exit(1);
    }

    // 4. Professor Y (Informática)
    const hashedPassword = await bcrypt.hash(SENHA, 10);
    const emailProfY = 'prof.y.informatica@teste.dsicola.com';
    let userYRecord = await prisma.user.findFirst({
      where: { instituicaoId: instA.id, email: emailProfY },
      select: { id: true, email: true },
    });
    if (!userYRecord) {
      userYRecord = await prisma.user.create({
        data: {
          email: emailProfY,
          password: hashedPassword,
          nomeCompleto: 'Professor Y (Informática)',
          instituicaoId: instA.id,
          mustChangePassword: false,
        },
        select: { id: true, email: true },
      });
      await prisma.userRole_.create({
        data: {
          userId: userYRecord.id,
          role: 'PROFESSOR',
          instituicaoId: instA.id,
        },
      });
    }
    userY = { email: userYRecord.email };

    profY = await prisma.professor.findFirst({
      where: { userId: userYRecord.id, instituicaoId: instA.id },
      select: { id: true, userId: true },
    });
    if (!profY) {
      profY = await prisma.professor.create({
        data: {
          userId: userYRecord.id,
          instituicaoId: instA.id,
        },
        select: { id: true, userId: true },
      });
    }
    assert('Professor Y (Informática) existe', true, userY.email);

    // 5. Plano X (já existe no seed - Professor A / Matemática)
    const disciplinaX = await prisma.disciplina.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true },
    });
    const planoX = await prisma.planoEnsino.findFirst({
      where: {
        instituicaoId: instA.id,
        professorId: profX.id,
        turmaId: turmaA.id,
      },
      select: { id: true },
    });
    if (!planoX || !disciplinaX) {
      assert('Plano Professor X', false, 'Execute seed-multi-tenant-test (plano Prof A)');
      process.exit(1);
    }
    assert('Plano Professor X existe', true);

    // 6. Plano Y (Informática)
    let planoY = await prisma.planoEnsino.findFirst({
      where: {
        instituicaoId: instA.id,
        professorId: profY.id,
        turmaId: turmaA.id,
        disciplinaId: discInformatica.id,
      },
      select: { id: true },
    });
    if (!planoY) {
      planoY = await prisma.planoEnsino.create({
        data: {
          instituicaoId: instA.id,
          professorId: profY.id,
          disciplinaId: discInformatica.id,
          turmaId: turmaA.id,
          anoLetivoId: anoLetivoA.id,
          anoLetivo: ano,
          classeId: classeA.id,
          classeOuAno: classeA.nome,
          status: 'APROVADO',
          estado: 'APROVADO',
          bloqueado: false,
        },
        select: { id: true },
      });
    }
    assert('Plano Professor Y (Informática) existe', true);

    // 7. Dois alunos
    const alunos = await prisma.user.findMany({
      where: {
        instituicaoId: instA.id,
        roles: { some: { role: 'ALUNO' } },
      },
      select: { id: true },
      take: 2,
    });
    if (alunos.length < 1) {
      assert('Pelo menos 1 aluno Inst A', false, 'Execute seed');
      process.exit(1);
    }
    aluno1 = alunos[0];
    aluno2 = alunos[1] || alunos[0];
    assert('Alunos disponíveis', true, `${alunos.length} aluno(s)`);

    // Matrículas na turma (se não existirem)
    for (const al of alunos) {
      const mat = await prisma.matricula.findFirst({
        where: { alunoId: al.id, turmaId: turmaA.id },
      });
      if (!mat) {
        await prisma.matricula.create({
          data: {
            alunoId: al.id,
            turmaId: turmaA.id,
            anoLetivoId: anoLetivoA.id,
            anoLetivo: ano,
            status: 'Ativa',
          },
        });
      }
    }

    // Matrícula anual ativa (obrigatória para lançamento de notas - bloqueio acadêmico)
    for (const al of alunos) {
      const ma = await prisma.matriculaAnual.findFirst({
        where: {
          alunoId: al.id,
          instituicaoId: instA.id,
          anoLetivoId: anoLetivoA.id,
        },
      });
      if (!ma) {
        await prisma.matriculaAnual.create({
          data: {
            alunoId: al.id,
            instituicaoId: instA.id,
            anoLetivoId: anoLetivoA.id,
            anoLetivo: ano,
            nivelEnsino: 'SECUNDARIO',
            classeOuAnoCurso: classeA.nome,
            classeId: classeA.id,
            status: 'ATIVA',
          },
        });
      } else if (ma.status !== 'ATIVA') {
        await prisma.matriculaAnual.update({
          where: { id: ma.id },
          data: { status: 'ATIVA' },
        });
      }
    }

    // Matrícula em disciplina (obrigatória para bloqueio ao lançar notas)
    for (const al of alunos) {
      const ma = await prisma.matriculaAnual.findFirst({
        where: { alunoId: al.id, instituicaoId: instA.id, anoLetivoId: anoLetivoA.id },
        select: { id: true },
      });
      if (!ma) continue;
      for (const disc of [disciplinaX, discInformatica]) {
        const ad = await prisma.alunoDisciplina.findFirst({
          where: {
            alunoId: al.id,
            disciplinaId: disc.id,
            ano,
            semestre: '1',
          },
        });
        if (!ad) {
          await prisma.alunoDisciplina.create({
            data: {
              alunoId: al.id,
              disciplinaId: disc.id,
              turmaId: turmaA.id,
              ano,
              semestre: '1',
              matriculaAnualId: ma.id,
              status: 'Cursando',
            },
          });
        } else if (ad.matriculaAnualId !== ma.id) {
          await prisma.alunoDisciplina.update({
            where: { id: ad.id },
            data: { matriculaAnualId: ma.id, status: 'Cursando' },
          });
        }
      }
    }

    // 8. Avaliação do Professor X (1º Trimestre)
    avaliacaoX = await prisma.avaliacao.findFirst({
      where: {
        planoEnsinoId: planoX.id,
        turmaId: turmaA.id,
        trimestre: 1,
      },
      select: { id: true },
    });
    if (!avaliacaoX) {
      avaliacaoX = await prisma.avaliacao.create({
        data: {
          planoEnsinoId: planoX.id,
          turmaId: turmaA.id,
          professorId: profX.id,
          tipo: 'PROVA',
          trimestre: 1,
          data: new Date(),
          nome: '1º Trimestre',
          instituicaoId: instA.id,
        },
        select: { id: true },
      });
    }
    assert('Avaliação Professor X criada', true);

    // 9. Avaliação do Professor Y (1º Trimestre Informática)
    avaliacaoY = await prisma.avaliacao.findFirst({
      where: {
        planoEnsinoId: planoY.id,
        turmaId: turmaA.id,
        trimestre: 1,
      },
      select: { id: true },
    });
    if (!avaliacaoY) {
      avaliacaoY = await prisma.avaliacao.create({
        data: {
          planoEnsinoId: planoY.id,
          turmaId: turmaA.id,
          professorId: profY.id,
          tipo: 'PROVA',
          trimestre: 1,
          data: new Date(),
          nome: '1º Trimestre (Informática)',
          instituicaoId: instA.id,
        },
        select: { id: true },
      });
    }
    assert('Avaliação Professor Y criada', true);

    // Período de lançamento aberto
    const periodo = await prisma.periodoLancamentoNotas.findFirst({
      where: { instituicaoId: instA.id, anoLetivoId: anoLetivoA.id },
    });
    if (periodo && periodo.status !== 'ABERTO') {
      await prisma.periodoLancamentoNotas.update({
        where: { id: periodo.id },
        data: { status: 'ABERTO' },
      });
    } else if (!periodo) {
      await prisma.periodoLancamentoNotas.create({
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
    }
    assert('Período de lançamento aberto', true);

    // 10. Login Professor X
    const loginX = await axios.post(
      `${API_URL}/auth/login`,
      { email: userX.email, password: SENHA },
      { validateStatus: () => true }
    );
    if (loginX.status !== 200 || !loginX.data?.accessToken) {
      assert('Login Professor X', false, `Status ${loginX.status}`);
      process.exit(1);
    }
    tokenX = loginX.data.accessToken;
    assert('Login Professor X', true);

    // 11. Professor X lança nota (avaliação dele)
    const resX = await axios.post(
      `${API_URL}/notas/avaliacao/lote`,
      {
        avaliacaoId: avaliacaoX.id,
        notas: [{ alunoId: aluno1.id, valor: 12 }],
      },
      {
        headers: { Authorization: `Bearer ${tokenX}` },
        validateStatus: () => true,
      }
    );
    assert(
      'Professor X lança nota (201)',
      resX.status === 201,
      resX.status === 201 ? 'OK' : `Status ${resX.status} - ${(resX.data as any)?.message || ''}`
    );

    // 12. Login Professor Y
    const loginY = await axios.post(
      `${API_URL}/auth/login`,
      { email: userY.email, password: SENHA },
      { validateStatus: () => true }
    );
    if (loginY.status !== 200 || !loginY.data?.accessToken) {
      assert('Login Professor Y', false, `Status ${loginY.status}`);
      process.exit(1);
    }
    tokenY = loginY.data.accessToken;
    assert('Login Professor Y', true);

    // 13. Professor Y lança nota (avaliação dele)
    const resY = await axios.post(
      `${API_URL}/notas/avaliacao/lote`,
      {
        avaliacaoId: avaliacaoY.id,
        notas: [{ alunoId: aluno1.id, valor: 14 }],
      },
      {
        headers: { Authorization: `Bearer ${tokenY}` },
        validateStatus: () => true,
      }
    );
    assert(
      'Professor Y lança nota (201)',
      resY.status === 201,
      resY.status === 201 ? 'OK' : `Status ${resY.status} - ${(resY.data as any)?.message || ''}`
    );

    // 14. Verificar que as duas notas existem no banco
    const notaX = await prisma.nota.findFirst({
      where: { avaliacaoId: avaliacaoX.id, alunoId: aluno1.id },
      select: { id: true, valor: true, planoEnsinoId: true },
    });
    const notaY = await prisma.nota.findFirst({
      where: { avaliacaoId: avaliacaoY.id, alunoId: aluno1.id },
      select: { id: true, valor: true, planoEnsinoId: true },
    });
    assert('Nota do Professor X persistida', notaX != null && Number(notaX.valor) === 12);
    assert('Nota do Professor Y persistida', notaY != null && Number(notaY.valor) === 14);
    assert('Notas em planos diferentes', notaX != null && notaY != null && notaX.planoEnsinoId !== notaY.planoEnsinoId);
  } catch (e: any) {
    const isConnection = e?.code === 'ECONNREFUSED' || e?.message?.includes('ECONNREFUSED');
    if (isConnection) {
      console.error('\n  ⚠ Backend não está a correr. Inicie com: npm run dev');
      assert('API acessível (backend a correr)', false, 'Execute o backend em outro terminal (npm run dev)');
    } else {
      console.error('Erro:', e);
      assert('Execução sem exceção', false, (e as Error).message);
    }
  } finally {
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n───────────────────────────────────────────────────────────────────────────────');
  if (failed.length === 0) {
    console.log('  RESULTADO: Está certinho. Os dois professores (X e Y) conseguem lançar notas.');
  } else {
    console.log(`  RESULTADO: ${failed.length} teste(s) falharam.`);
    failed.forEach((r) => console.log(`    - ${r.name}${r.details ? ` (${r.details})` : ''}`));
    process.exit(1);
  }
}

main();
