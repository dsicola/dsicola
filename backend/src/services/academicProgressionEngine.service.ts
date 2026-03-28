/**
 * Motor de progressão académica (configurável, multi-tenant).
 * - `regras_aprovacao`: média mínima, máximo de reprovações, uso de disciplinas chave
 * - `disciplinas_chave`: aprovação obrigatória quando a regra exige
 * Plano curricular canónico: tabela `curso_disciplina` (ver documentação API)
 */

import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { ResultadoStatusFinal } from './progressaoAcademica.service.js';

export type AvaliacaoEstudanteResultado = ResultadoStatusFinal;

export class AcademicProgressionService {
  /**
   * Avaliação completa para uma matrícula anual (usa histórico do ano letivo da MA).
   */
  static async avaliarEstudante(matriculaAnualId: string): Promise<AvaliacaoEstudanteResultado> {
    const ma = await prisma.matriculaAnual.findFirst({
      where: { id: matriculaAnualId },
      select: {
        id: true,
        alunoId: true,
        instituicaoId: true,
        anoLetivoId: true,
        cursoId: true,
        classeId: true,
        nivelEnsino: true,
      },
    });
    if (!ma) {
      throw new AppError('Matrícula anual não encontrada', 404);
    }
    if (!ma.anoLetivoId) {
      throw new AppError('Matrícula anual sem ano letivo vinculado — necessário para avaliação', 400);
    }

    const { calcularStatusFinalAno } = await import('./progressaoAcademica.service.js');
    return calcularStatusFinalAno(ma.alunoId, ma.anoLetivoId, ma.instituicaoId, {
      cursoId: ma.cursoId,
      classeId: ma.classeId,
    }) as Promise<AvaliacaoEstudanteResultado>;
  }

  /**
   * Próxima classe na escada (ordem + 1), respeitando `curso_id` opcional na classe.
   */
  static async obterProximaClasse(
    classeAtualId: string,
    instituicaoId: string
  ): Promise<{ classe: { id: string; nome: string; ordem: number; cursoId: string | null } | null; fimPercurso: boolean }> {
    const atual = await prisma.classe.findFirst({
      where: { id: classeAtualId, instituicaoId },
    });
    if (!atual) {
      throw new AppError('Classe atual não encontrada', 404);
    }

    if (atual.cursoId) {
      const escada = await prisma.classe.findMany({
        where: { instituicaoId, cursoId: atual.cursoId, ativo: true },
        orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
        select: { id: true, nome: true, ordem: true, cursoId: true },
      });
      const idx = escada.findIndex((c) => c.id === atual.id);
      if (idx === -1) {
        throw new AppError('Classe atual não pertence à escada ativa do curso', 400);
      }
      const seguinte = escada[idx + 1];
      if (!seguinte) {
        return { classe: null, fimPercurso: true };
      }
      return { classe: seguinte, fimPercurso: false };
    }

    const ordemAtual = atual.ordem ?? 0;
    const candidatas = await prisma.classe.findMany({
      where: {
        instituicaoId,
        ordem: ordemAtual + 1,
        ativo: true,
        cursoId: null,
      },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, ordem: true, cursoId: true },
    });
    const preferida = candidatas[0] ?? null;
    if (!preferida) {
      return { classe: null, fimPercurso: true };
    }
    return { classe: preferida, fimPercurso: false };
  }

  /**
   * Simula / valida progressão após avaliação: não cria matrícula nova (evita efeitos colaterais).
   */
  static async progredirEstudante(
    matriculaAnualId: string,
    opts?: {
      anoLetivoDestinoId?: string;
      userRoles?: string[];
      overrideSequencial?: boolean;
    }
  ): Promise<{
    avaliacao: AvaliacaoEstudanteResultado;
    proximaClasse: { id: string; nome: string } | null;
    podeProgredir: boolean;
    mensagem?: string;
    criarMatriculaSugerida?: boolean;
  }> {
    const ma = await prisma.matriculaAnual.findFirst({
      where: { id: matriculaAnualId },
      include: { instituicao: { select: { tipoAcademico: true } } },
    });
    if (!ma || !ma.instituicao?.tipoAcademico) {
      throw new AppError('Matrícula anual ou tipo académico inválido', 400);
    }

    const avaliacao = await AcademicProgressionService.avaliarEstudante(matriculaAnualId);
    const tipo = ma.instituicao.tipoAcademico;

    if (avaliacao.statusFinal !== 'APROVADO') {
      return {
        avaliacao,
        proximaClasse: null,
        podeProgredir: false,
        mensagem: 'Aluno não aprovado — permanece na mesma classe/ano para o novo período.',
      };
    }

    if (tipo === 'SECUNDARIO' && ma.classeId) {
      const { classe, fimPercurso } = await AcademicProgressionService.obterProximaClasse(
        ma.classeId,
        ma.instituicaoId
      );
      if (fimPercurso || !classe) {
        return {
          avaliacao,
          proximaClasse: null,
          podeProgredir: true,
          mensagem: 'Última classe da escada — marcar conclusão de percurso / graduação.',
          criarMatriculaSugerida: !!opts?.anoLetivoDestinoId,
        };
      }

      const { validarProgressaoSequencialSemSaltos } = await import('./progressaoAcademica.service.js');
      const seq = await validarProgressaoSequencialSemSaltos(
        ma.alunoId,
        ma.instituicaoId,
        tipo,
        classe.nome,
        classe.id,
        ma.cursoId,
        opts?.userRoles ?? [],
        opts?.overrideSequencial
      );
      if (!seq.permitido) {
        return {
          avaliacao,
          proximaClasse: classe,
          podeProgredir: false,
          mensagem: seq.motivoBloqueio,
        };
      }

      return {
        avaliacao,
        proximaClasse: { id: classe.id, nome: classe.nome },
        podeProgredir: true,
        criarMatriculaSugerida: !!opts?.anoLetivoDestinoId,
      };
    }

    if (tipo === 'SUPERIOR') {
      const { obterClasseProximaSugerida } = await import('./progressaoAcademica.service.js');
      const sug = await obterClasseProximaSugerida(
        {
          classeOuAnoCurso: ma.classeOuAnoCurso,
          classeId: ma.classeId,
          cursoId: ma.cursoId,
        },
        'APROVADO',
        ma.instituicaoId,
        tipo
      );
      return {
        avaliacao,
        proximaClasse: sug.classeProximaSugeridaId
          ? { id: sug.classeProximaSugeridaId, nome: sug.classeProximaSugerida }
          : null,
        podeProgredir: true,
        mensagem: sug.classeProximaSugerida,
      };
    }

    return { avaliacao, proximaClasse: null, podeProgredir: false };
  }

  /**
   * Alunos com matrícula anual ATIVA no ano anterior e sem MA no ano novo → DESISTENTE na MA anterior.
   */
  static async marcarDesistentesSemMatriculaNovoAno(
    instituicaoId: string,
    anoLetivoAnteriorId: string,
    anoLetivoNovoId: string
  ): Promise<{ atualizados: number }> {
    const anteriores = await prisma.matriculaAnual.findMany({
      where: {
        instituicaoId,
        anoLetivoId: anoLetivoAnteriorId,
        /** Inclui FINALIZADA: matrículas do ano encerrado após rollforward automático */
        status: { in: ['ATIVA', 'FINALIZADA'] },
      },
      select: { id: true, alunoId: true },
    });

    let atualizados = 0;
    for (const ma of anteriores) {
      const proxima = await prisma.matriculaAnual.findFirst({
        where: {
          instituicaoId,
          alunoId: ma.alunoId,
          anoLetivoId: anoLetivoNovoId,
        },
      });
      if (!proxima) {
        await prisma.matriculaAnual.update({
          where: { id: ma.id },
          data: { status: 'DESISTENTE' },
        });
        atualizados += 1;
      }
    }
    return { atualizados };
  }

  /**
   * Taxa de aprovação = MA com status_final APROVADO / total com status_final preenchido, por curso.
   */
  static async taxaAprovacaoPorCurso(
    instituicaoId: string,
    anoLetivoId: string
  ): Promise<{ cursoId: string; cursoNome: string; taxa: number; total: number; aprovados: number }[]> {
    const mis = await prisma.matriculaAnual.findMany({
      where: {
        instituicaoId,
        anoLetivoId,
        cursoId: { not: null },
        statusFinal: { not: null },
      },
      select: {
        cursoId: true,
        statusFinal: true,
        curso: { select: { nome: true } },
      },
    });

    const map = new Map<string, { nome: string; ap: number; tot: number }>();
    for (const m of mis) {
      if (!m.cursoId) continue;
      const nome = m.curso?.nome ?? m.cursoId;
      const cur = map.get(m.cursoId) ?? { nome, ap: 0, tot: 0 };
      cur.tot += 1;
      if (m.statusFinal === 'APROVADO') cur.ap += 1;
      map.set(m.cursoId, cur);
    }

    return [...map.entries()].map(([cursoId, v]) => ({
      cursoId,
      cursoNome: v.nome,
      total: v.tot,
      aprovados: v.ap,
      taxa: v.tot > 0 ? Math.round((v.ap / v.tot) * 10000) / 100 : 0,
    }));
  }
}
