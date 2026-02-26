#!/usr/bin/env npx tsx
/**
 * TESTE: Isolamento de notas entre professores (SIGAE)
 *
 * Garante que o Professor X não vê nem consegue alterar notas do Professor Y.
 *
 * Cenários:
 * 1) Na mesma instituição e turma, dois professores (X e Y) com disciplinas diferentes.
 * 2) Uma nota lançada pelo Professor Y (disciplina Y) para o aluno A.
 * 3) Professor X (disciplina X) ao listar notas da turma NÃO vê a nota de Y.
 * 4) Professor X ao tentar corrigir a nota de Y recebe 403.
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts (Inst A com Prof A, turma, aluno)
 * Backend a correr: API_URL (ex: http://localhost:3001)
 *
 * Uso: npx tsx scripts/test-isolamento-notas-professor.ts
 * Ou: npm run test:isolamento-notas-professor
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

const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';

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
  console.log('  TESTE: Professor X não vê nem altera notas do Professor Y (SIGAE)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let instA: { id: string; nome: string } | null = null;
  let professorX: { id: string; userId: string } | null = null;
  let professorY: { id: string; userId: string } | null = null;
  let userX: { email: string } | null = null;
  let userY: { email: string } | null = null;
  let turmaA: { id: string } | null = null;
  let alunoA: { id: string } | null = null;
  let planoX: { id: string } | null = null;
  let planoY: { id: string } | null = null;
  let avaliacaoY: { id: string } | null = null;
  let notaY: { id: string; valor: unknown } | null = null;
  let tokenX: string | null = null;

  try {
    // 1. Instituição A
    instA = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
      select: { id: true, nome: true },
    });
    if (!instA) {
      instA = await prisma.instituicao.findFirst({
        where: {},
        select: { id: true, nome: true },
        take: 1,
      });
    }
    if (!instA) {
      assert('Instituição disponível', false, 'Rode: npx tsx scripts/seed-multi-tenant-test.ts');
      process.exit(1);
    }
    assert('Instituição A disponível', true, instA.nome);

    // 2. Professor X = Professor A (Matemática) já existente no seed
    const profAX = await prisma.professor.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true, userId: true },
    });
    if (profAX) {
      professorX = profAX;
      userX = await prisma.user.findUnique({
        where: { id: profAX.userId },
        select: { email: true },
      });
    }
    if (!professorX || !userX) {
      assert('Professor X (Prof A) existe', false, 'Seed deve criar Professor A em Inst A');
      process.exit(1);
    }
    assert('Professor X (Prof A) existe', true, userX.email);

    // 3. Turma e aluno da Inst A
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

    alunoA = await prisma.user.findFirst({
      where: {
        instituicaoId: instA.id,
        roles: { some: { role: 'ALUNO' } },
      },
      select: { id: true },
    });
    if (!alunoA) {
      assert('Aluno Inst A', false, 'Execute seed-multi-tenant-test');
      process.exit(1);
    }
    assert('Turma e Aluno A disponíveis', true);

    // 4. Plano X (Professor A - Matemática) - já existe no seed
    const disciplinaMat = await prisma.disciplina.findFirst({
      where: { instituicaoId: instA.id, nome: { contains: 'Matemática' } },
      select: { id: true },
    });
    if (disciplinaMat) {
      planoX = await prisma.planoEnsino.findFirst({
        where: {
          instituicaoId: instA.id,
          professorId: professorX.id,
          turmaId: turmaA.id,
          disciplinaId: disciplinaMat.id,
        },
        select: { id: true },
      });
    }
    if (!planoX) {
      assert('Plano de Ensino X (Matemática)', false, 'Execute seed-multi-tenant-test');
      process.exit(1);
    }
    assert('Plano X (Matemática) existe', true);

    // 5. Professor Y e disciplina Português (criar se não existir)
    let disciplinaPort = await prisma.disciplina.findFirst({
      where: { instituicaoId: instA.id, nome: { contains: 'Português' } },
      select: { id: true },
    });
    const cursoA = await prisma.curso.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true },
    });
    if (!disciplinaPort && cursoA) {
      disciplinaPort = await prisma.disciplina.create({
        data: {
          instituicaoId: instA.id,
          nome: 'Português',
          codigo: 'PORT',
          cargaHoraria: 60,
          cursoId: cursoA.id,
        },
        select: { id: true },
      });
    }
    if (!disciplinaPort) {
      assert('Disciplina Português', false, 'Não foi possível criar');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(SENHA, 10);
    const emailProfY = 'prof.y.notas@teste.dsicola.com';
    let userYRecord = await prisma.user.findFirst({
      where: { instituicaoId: instA.id, email: emailProfY },
      select: { id: true, email: true },
    });
    if (!userYRecord) {
      userYRecord = await prisma.user.create({
        data: {
          email: emailProfY,
          password: hashedPassword,
          nomeCompleto: 'Professor Y (Português)',
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

    professorY = await prisma.professor.findFirst({
      where: { userId: userYRecord.id, instituicaoId: instA.id },
      select: { id: true, userId: true },
    });
    if (!professorY) {
      professorY = await prisma.professor.create({
        data: {
          userId: userYRecord.id,
          instituicaoId: instA.id,
        },
        select: { id: true, userId: true },
      });
    }
    assert('Professor Y (Português) existe', true, userY.email);

    const classeA = await prisma.classe.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true, nome: true },
    });
    if (!classeA) {
      assert('Classe Inst A', false, 'Execute seed');
      process.exit(1);
    }

    // 6. Plano Y (Professor Y - Português - mesma turma)
    planoY = await prisma.planoEnsino.findFirst({
      where: {
        instituicaoId: instA.id,
        professorId: professorY.id,
        turmaId: turmaA.id,
        disciplinaId: disciplinaPort.id,
      },
      select: { id: true },
    });
    if (!planoY) {
      planoY = await prisma.planoEnsino.create({
        data: {
          instituicaoId: instA.id,
          professorId: professorY.id,
          disciplinaId: disciplinaPort.id,
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
    assert('Plano Y (Português) na mesma turma', true);

    // 7. Avaliação 1º Trimestre do Plano Y
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
          professorId: professorY.id,
          tipo: 'PROVA',
          trimestre: 1,
          data: new Date(),
          nome: '1º Trimestre (Português)',
          instituicaoId: instA.id,
        },
        select: { id: true },
      });
    }
    assert('Avaliação Y (1º Trimestre Português) criada', true);

    // 8. Nota do Professor Y para o Aluno A (valor 10)
    notaY = await prisma.nota.findFirst({
      where: {
        alunoId: alunoA.id,
        avaliacaoId: avaliacaoY.id,
        planoEnsinoId: planoY.id,
      },
      select: { id: true, valor: true },
    });
    if (!notaY) {
      const created = await prisma.nota.create({
        data: {
          alunoId: alunoA.id,
          planoEnsinoId: planoY.id,
          avaliacaoId: avaliacaoY.id,
          anoLetivoId: anoLetivoA.id,
          valor: 10,
          instituicaoId: instA.id,
        },
        select: { id: true, valor: true },
      });
      notaY = created;
    }
    assert('Nota do Professor Y (valor 10) para Aluno A', true, `notaId=${notaY.id}`);

    // 9. Login como Professor X
    const loginRes = await axios.post(
      `${API_URL}/auth/login`,
      { email: userX.email, password: SENHA },
      { validateStatus: () => true }
    );
    if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
      assert('Login Professor X', false, `Status ${loginRes.status} - Verifique senha (${SENHA}) ou API`);
      process.exit(1);
    }
    tokenX = loginRes.data.accessToken;
    assert('Login Professor X', true);

    const headersX = { Authorization: `Bearer ${tokenX}` };

    // 10. GET /notas?turmaId=... como Professor X → não deve conter a nota de Y
    const getNotasRes = await axios.get(`${API_URL}/notas`, {
      params: { turmaId: turmaA.id },
      headers: headersX,
      validateStatus: () => true,
    });
    if (getNotasRes.status !== 200) {
      assert('GET /notas (Professor X) retorna 200', false, `Status ${getNotasRes.status}`);
    } else {
      const notas: any[] = Array.isArray(getNotasRes.data) ? getNotasRes.data : [];
      const contemNotaDeY = notas.some((n: any) => n.id === notaY!.id || n.planoEnsinoId === planoY!.id);
      assert(
        'Professor X NÃO vê a nota do Professor Y em GET /notas',
        !contemNotaDeY,
        contemNotaDeY ? 'Nota de Y apareceu na lista de X (reinicie o backend para aplicar resolveProfessorOptional em GET /notas)' : 'OK'
      );
      const todasNotasSaoDeX = notas.length === 0 || notas.every((n: any) => n.planoEnsinoId === planoX!.id);
      assert('Todas as notas listadas pertencem ao plano do Professor X', todasNotasSaoDeX);
    }

    // 11. GET /notas/turma/alunos?turmaId=... como Professor X → aluno não deve ter a nota 10 (de Y)
    const getAlunosRes = await axios.get(`${API_URL}/notas/turma/alunos`, {
      params: { turmaId: turmaA.id },
      headers: headersX,
      validateStatus: () => true,
    });
    if (getAlunosRes.status !== 200) {
      assert('GET /notas/turma/alunos (Professor X) retorna 200', false, `Status ${getAlunosRes.status}`);
    } else {
      const alunos: any[] = Array.isArray(getAlunosRes.data) ? getAlunosRes.data : [];
      const alunoComNotas = alunos.find((a: any) => a.aluno_id === alunoA.id || a.alunoId === alunoA.id);
      const notasDoAluno = alunoComNotas?.notas || {};
      // A nota de Y (10) não deve aparecer; se aparecer algum "1º Trimestre" deve ser só do plano X (não 10)
      const valor10EmAlgumTipo = Object.values(notasDoAluno).some(
        (v: any) => v && typeof v === 'object' && Number(v.valor) === 10
      );
      const notaYIdAparece = Object.values(notasDoAluno).some(
        (v: any) => v && typeof v === 'object' && v.id === notaY!.id
      );
      assert(
        'Professor X no painel NÃO vê a nota 10 (de Y) do aluno',
        !valor10EmAlgumTipo && !notaYIdAparece,
        valor10EmAlgumTipo || notaYIdAparece ? 'Nota de Y visível para X' : 'OK'
      );
    }

    // 12. PUT /notas/:id/corrigir como Professor X para a nota de Y → deve retornar 403
    const corrigirRes = await axios.put(
      `${API_URL}/notas/${notaY!.id}/corrigir`,
      { valor: 12, motivo: 'Tentativa de alterar nota de outro professor (teste)' },
      { headers: headersX, validateStatus: () => true }
    );
    assert(
      'Professor X NÃO consegue corrigir nota do Professor Y (403)',
      corrigirRes.status === 403,
      corrigirRes.status === 403 ? 'OK' : `Status ${corrigirRes.status} - esperado 403`
    );

    // Verificar que a nota de Y continua 10 no banco
    const notaAposTentativa = await prisma.nota.findUnique({
      where: { id: notaY!.id },
      select: { valor: true },
    });
    assert(
      'Nota do Professor Y permanece inalterada após tentativa de X',
      notaAposTentativa != null && Number(notaAposTentativa.valor) === 10
    );
  } catch (e) {
    console.error('Erro:', e);
    assert('Execução sem exceção', false, (e as Error).message);
  } finally {
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n───────────────────────────────────────────────────────────────────────────────');
  if (failed.length === 0) {
    console.log('  RESULTADO: Todos os testes passaram. Professor X não vê nem altera notas do Professor Y.');
  } else {
    console.log(`  RESULTADO: ${failed.length} teste(s) falharam.`);
    failed.forEach((r) => console.log(`    - ${r.name}${r.details ? ` (${r.details})` : ''}`));
    process.exit(1);
  }
}

main();
