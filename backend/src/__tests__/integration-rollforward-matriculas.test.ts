/**
 * Integração: `aplicarRollforwardMatriculasAposEncerramentoAno`
 *
 * Garante que no Ensino Superior o último ano é reconhecido via `Curso.duracao`
 * (sem depender só de `classe_proxima === classe_atual`) e que o secundário
 * avança classe ou fecha percurso; última classe do secundário → `CONCLUIDA` + conclusão.
 *
 * Requer PostgreSQL acessível em `DATABASE_URL` (migrado, com enum `FINALIZADA` / `CONCLUIDA` em matrículas anuais).
 *
 * npx vitest run src/__tests__/integration-rollforward-matriculas.test.ts
 */

import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { aplicarRollforwardMatriculasAposEncerramentoAno } from '../services/encerramentoAnoLetivoProgressao.service.js';

type Ctx = { instituicaoId: string; userIds: string[] };

async function tearDown(ctx: Ctx): Promise<void> {
  if (!ctx.instituicaoId) return;
  await prisma.matriculaAnual.deleteMany({ where: { instituicaoId: ctx.instituicaoId } });
  await prisma.conclusaoCurso.deleteMany({ where: { instituicaoId: ctx.instituicaoId } });
  await prisma.classe.deleteMany({ where: { instituicaoId: ctx.instituicaoId } });
  await prisma.curso.deleteMany({ where: { instituicaoId: ctx.instituicaoId } });
  await prisma.anoLetivo.deleteMany({ where: { instituicaoId: ctx.instituicaoId } });
  for (const userId of ctx.userIds) {
    await prisma.userRole_.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  }
  await prisma.instituicao.deleteMany({ where: { id: ctx.instituicaoId } }).catch(() => {});
}

function withCleanup<T>(fn: (ctx: Ctx) => Promise<T>): () => Promise<T> {
  return async () => {
    const ctx: Ctx = { instituicaoId: '', userIds: [] };
    try {
      return await fn(ctx);
    } finally {
      await tearDown(ctx);
    }
  };
}

async function criarAluno(instituicaoId: string, emailSuffix: string): Promise<string> {
  const hashed = await bcrypt.hash('TestRf123!', 10);
  const u = await prisma.user.create({
    data: {
      email: `rf.${emailSuffix}.${Date.now()}@test.dsicola.com`,
      password: hashed,
      nomeCompleto: 'Aluno Rollforward Test',
      instituicaoId,
      mustChangePassword: false,
    },
  });
  await prisma.userRole_.create({
    data: { userId: u.id, role: 'ALUNO', instituicaoId },
  });
  return u.id;
}

/** Ano civil (ex.: 2035) para `AnoLetivo.ano` — evita 24xxx que quebra Date/PostgreSQL. */
function pickAnoLetivoCivil(): number {
  return 2035 + Math.floor(Math.random() * 50);
}

describe('Integration: rollforward matrículas após encerramento', () => {
  it(
    'SUPERIOR: último ano por duração do curso — conclui mesmo com sugestão 5º ano',
    withCleanup(async (ctx) => {
    const suffix = `${Date.now()}`;
    const anoBase = pickAnoLetivoCivil();

    const inst = await prisma.instituicao.create({
      data: {
        nome: `RF Superior ${suffix}`,
        subdominio: `rf-sup-${suffix}`,
        tipoInstituicao: 'UNIVERSIDADE',
        tipoAcademico: 'SUPERIOR',
        status: 'ativa',
      },
    });
    ctx.instituicaoId = inst.id;

    const curso = await prisma.curso.create({
      data: {
        codigo: `RF-SUP-${suffix}`,
        nome: 'Curso RF',
        instituicaoId: inst.id,
        duracao: '4 anos',
      },
    });

    const d0 = new Date(Date.UTC(anoBase, 0, 15));
    const d1 = new Date(Date.UTC(anoBase + 1, 0, 15));
    const anoOrig = await prisma.anoLetivo.create({
      data: {
        ano: anoBase,
        dataInicio: d0,
        status: 'ATIVO',
        instituicaoId: inst.id,
      },
    });
    const anoDest = await prisma.anoLetivo.create({
      data: {
        ano: anoBase + 1,
        dataInicio: d1,
        status: 'PLANEJADO',
        instituicaoId: inst.id,
      },
    });

    const alunoId = await criarAluno(inst.id, `sup-fim-${suffix}`);
    ctx.userIds.push(alunoId);

    const ma = await prisma.matriculaAnual.create({
      data: {
        alunoId,
        instituicaoId: inst.id,
        anoLetivo: anoBase,
        anoLetivoId: anoOrig.id,
        nivelEnsino: 'SUPERIOR',
        classeOuAnoCurso: '4º Ano',
        cursoId: curso.id,
        status: 'ATIVA',
        statusFinal: 'APROVADO',
        classeProximaSugerida: '5º Ano',
      },
    });

    const res = await aplicarRollforwardMatriculasAposEncerramentoAno({
      instituicaoId: inst.id,
      anoLetivoOrigem: { id: anoOrig.id, ano: anoBase },
      anoLetivoDestino: { id: anoDest.id, ano: anoBase + 1 },
      tipoAcademico: 'SUPERIOR',
      userId: alunoId,
    });

    expect(res.erros).toEqual([]);
    expect(res.matriculasCriadas).toBe(0);

    const atualizada = await prisma.matriculaAnual.findUnique({ where: { id: ma.id } });
    expect(atualizada?.status).toBe('CONCLUIDA');

    const novas = await prisma.matriculaAnual.findMany({
      where: {
        alunoId,
        instituicaoId: inst.id,
        anoLetivo: anoBase + 1,
        status: 'ATIVA',
      },
    });
    expect(novas.length).toBe(0);

    const conc = await prisma.conclusaoCurso.findFirst({
      where: { instituicaoId: inst.id, alunoId, cursoId: curso.id, status: 'CONCLUIDO' },
    });
    expect(conc).not.toBeNull();
    })
  );

  it(
    'SUPERIOR: ano intermédio cria MA ATIVA no ano seguinte',
    withCleanup(async (ctx) => {
    const suffix = `${Date.now()}-mid`;
    const anoBase = pickAnoLetivoCivil();

    const inst = await prisma.instituicao.create({
      data: {
        nome: `RF Superior Mid ${suffix}`,
        subdominio: `rf-sup-mid-${suffix}`,
        tipoInstituicao: 'UNIVERSIDADE',
        tipoAcademico: 'SUPERIOR',
        status: 'ativa',
      },
    });
    ctx.instituicaoId = inst.id;

    const curso = await prisma.curso.create({
      data: {
        codigo: `RF-SUP-M-${suffix}`,
        nome: 'Curso RF Mid',
        instituicaoId: inst.id,
        duracao: '4 anos',
      },
    });

    const d0 = new Date(Date.UTC(anoBase, 1, 1));
    const d1 = new Date(Date.UTC(anoBase + 1, 1, 1));
    const anoOrig = await prisma.anoLetivo.create({
      data: { ano: anoBase, dataInicio: d0, status: 'ATIVO', instituicaoId: inst.id },
    });
    const anoDest = await prisma.anoLetivo.create({
      data: { ano: anoBase + 1, dataInicio: d1, status: 'PLANEJADO', instituicaoId: inst.id },
    });

    const alunoId = await criarAluno(inst.id, `sup-mid-${suffix}`);
    ctx.userIds.push(alunoId);

    await prisma.matriculaAnual.create({
      data: {
        alunoId,
        instituicaoId: inst.id,
        anoLetivo: anoBase,
        anoLetivoId: anoOrig.id,
        nivelEnsino: 'SUPERIOR',
        classeOuAnoCurso: '2º Ano',
        cursoId: curso.id,
        status: 'ATIVA',
        statusFinal: 'APROVADO',
        classeProximaSugerida: '3º Ano',
      },
    });

    const res = await aplicarRollforwardMatriculasAposEncerramentoAno({
      instituicaoId: inst.id,
      anoLetivoOrigem: { id: anoOrig.id, ano: anoBase },
      anoLetivoDestino: { id: anoDest.id, ano: anoBase + 1 },
      tipoAcademico: 'SUPERIOR',
      userId: alunoId,
    });

    expect(res.erros).toEqual([]);
    expect(res.matriculasCriadas).toBe(1);

    const nova = await prisma.matriculaAnual.findFirst({
      where: {
        alunoId,
        instituicaoId: inst.id,
        anoLetivo: anoBase + 1,
        status: 'ATIVA',
      },
    });
    expect(nova?.classeOuAnoCurso).toBe('3º Ano');
    expect(nova?.cursoId).toBe(curso.id);
    })
  );

  it(
    'SECUNDÁRIO: aprovado avança para próxima classe no ano seguinte',
    withCleanup(async (ctx) => {
    const suffix = `${Date.now()}-sec`;
    const anoBase = pickAnoLetivoCivil();

    const inst = await prisma.instituicao.create({
      data: {
        nome: `RF Sec ${suffix}`,
        subdominio: `rf-sec-${suffix}`,
        tipoInstituicao: 'ENSINO_MEDIO',
        tipoAcademico: 'SECUNDARIO',
        status: 'ativa',
      },
    });
    ctx.instituicaoId = inst.id;

    const curso = await prisma.curso.create({
      data: {
        codigo: `RF-SEC-${suffix}`,
        nome: 'Curso Técnico RF',
        instituicaoId: inst.id,
      },
    });

    const c10 = await prisma.classe.create({
      data: {
        codigo: `C10-${suffix}`,
        nome: '10ª Classe',
        ordem: 10,
        cursoId: curso.id,
        instituicaoId: inst.id,
      },
    });
    const c11 = await prisma.classe.create({
      data: {
        codigo: `C11-${suffix}`,
        nome: '11ª Classe',
        ordem: 11,
        cursoId: curso.id,
        instituicaoId: inst.id,
      },
    });

    const d0 = new Date(Date.UTC(anoBase, 2, 1));
    const d1 = new Date(Date.UTC(anoBase + 1, 2, 1));
    const anoOrig = await prisma.anoLetivo.create({
      data: { ano: anoBase, dataInicio: d0, status: 'ATIVO', instituicaoId: inst.id },
    });
    const anoDest = await prisma.anoLetivo.create({
      data: { ano: anoBase + 1, dataInicio: d1, status: 'PLANEJADO', instituicaoId: inst.id },
    });

    const alunoId = await criarAluno(inst.id, `sec-${suffix}`);
    ctx.userIds.push(alunoId);

    await prisma.matriculaAnual.create({
      data: {
        alunoId,
        instituicaoId: inst.id,
        anoLetivo: anoBase,
        anoLetivoId: anoOrig.id,
        nivelEnsino: 'SECUNDARIO',
        classeOuAnoCurso: c10.nome,
        cursoId: curso.id,
        classeId: c10.id,
        status: 'ATIVA',
        statusFinal: 'APROVADO',
        classeProximaSugerida: c11.nome,
        classeProximaSugeridaId: c11.id,
      },
    });

    const res = await aplicarRollforwardMatriculasAposEncerramentoAno({
      instituicaoId: inst.id,
      anoLetivoOrigem: { id: anoOrig.id, ano: anoBase },
      anoLetivoDestino: { id: anoDest.id, ano: anoBase + 1 },
      tipoAcademico: 'SECUNDARIO',
      userId: alunoId,
    });

    expect(res.erros).toEqual([]);
    expect(res.matriculasCriadas).toBe(1);

    const nova = await prisma.matriculaAnual.findFirst({
      where: {
        alunoId,
        instituicaoId: inst.id,
        anoLetivo: anoBase + 1,
        status: 'ATIVA',
      },
    });
    expect(nova?.classeId).toBe(c11.id);
    expect(nova?.classeOuAnoCurso).toBe('11ª Classe');
    })
  );

  it(
    'SECUNDÁRIO: última classe da escada aprovado — CONCLUIDA e conclusão (sem MA no ano seguinte)',
    withCleanup(async (ctx) => {
      const suffix = `${Date.now()}-sec-fim`;
      const anoBase = pickAnoLetivoCivil();

      const inst = await prisma.instituicao.create({
        data: {
          nome: `RF Sec Fim ${suffix}`,
          subdominio: `rf-sec-fim-${suffix}`,
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          status: 'ativa',
        },
      });
      ctx.instituicaoId = inst.id;

      const curso = await prisma.curso.create({
        data: {
          codigo: `RF-SEC-FIM-${suffix}`,
          nome: 'Curso Ciclo RF',
          instituicaoId: inst.id,
        },
      });

      const ultima = await prisma.classe.create({
        data: {
          codigo: `ULT-${suffix}`,
          nome: '13ª Classe',
          ordem: 13,
          cursoId: curso.id,
          instituicaoId: inst.id,
        },
      });

      const d0 = new Date(Date.UTC(anoBase, 3, 1));
      const d1 = new Date(Date.UTC(anoBase + 1, 3, 1));
      const anoOrig = await prisma.anoLetivo.create({
        data: { ano: anoBase, dataInicio: d0, status: 'ATIVO', instituicaoId: inst.id },
      });
      const anoDest = await prisma.anoLetivo.create({
        data: { ano: anoBase + 1, dataInicio: d1, status: 'PLANEJADO', instituicaoId: inst.id },
      });

      const alunoId = await criarAluno(inst.id, `sec-fim-${suffix}`);
      ctx.userIds.push(alunoId);

      const ma = await prisma.matriculaAnual.create({
        data: {
          alunoId,
          instituicaoId: inst.id,
          anoLetivo: anoBase,
          anoLetivoId: anoOrig.id,
          nivelEnsino: 'SECUNDARIO',
          classeOuAnoCurso: ultima.nome,
          cursoId: curso.id,
          classeId: ultima.id,
          status: 'ATIVA',
          statusFinal: 'APROVADO',
          classeProximaSugerida: null,
          classeProximaSugeridaId: null,
        },
      });

      const res = await aplicarRollforwardMatriculasAposEncerramentoAno({
        instituicaoId: inst.id,
        anoLetivoOrigem: { id: anoOrig.id, ano: anoBase },
        anoLetivoDestino: { id: anoDest.id, ano: anoBase + 1 },
        tipoAcademico: 'SECUNDARIO',
        userId: alunoId,
      });

      expect(res.erros).toEqual([]);
      expect(res.matriculasCriadas).toBe(0);

      const atualizada = await prisma.matriculaAnual.findUnique({ where: { id: ma.id } });
      expect(atualizada?.status).toBe('CONCLUIDA');

      const novas = await prisma.matriculaAnual.findMany({
        where: {
          alunoId,
          instituicaoId: inst.id,
          anoLetivo: anoBase + 1,
          status: 'ATIVA',
        },
      });
      expect(novas.length).toBe(0);

      const conc = await prisma.conclusaoCurso.findFirst({
        where: {
          instituicaoId: inst.id,
          alunoId,
          cursoId: curso.id,
          status: 'CONCLUIDO',
        },
      });
      expect(conc).not.toBeNull();
    })
  );
});
