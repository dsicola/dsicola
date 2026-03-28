import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { AcademicProgressionService } from './academicProgressionEngine.service.js';
import {
  extrairAnoSuperior,
  parseDuracaoAnosEnsinoSuperior,
} from './progressaoAcademica.service.js';

export type ResultadoRollforwardMatriculas = {
  matriculasCriadas: number;
  matriculasFinalizadas: number;
  conclusoesRegistradas: number;
  erros: { matriculaAnualId: string; alunoId: string; mensagem: string }[];
};

async function registrarConclusaoCicloAutomatico(params: {
  instituicaoId: string;
  alunoId: string;
  cursoId: string | null;
  classeId: string | null;
  userId: string;
}): Promise<boolean> {
  const { instituicaoId, alunoId, cursoId, classeId, userId } = params;
  if (!classeId && !cursoId) return false;

  const existing = cursoId
    ? await prisma.conclusaoCurso.findFirst({
        where: { instituicaoId, alunoId, cursoId, status: 'CONCLUIDO' },
      })
    : classeId
      ? await prisma.conclusaoCurso.findFirst({
          where: { instituicaoId, alunoId, classeId, status: 'CONCLUIDO' },
        })
      : null;
  if (existing) return false;

  const historico = await prisma.historicoAcademico.findMany({
    where: { alunoId, instituicaoId },
    select: {
      situacaoAcademica: true,
      mediaFinal: true,
      cargaHoraria: true,
      percentualFrequencia: true,
    },
  });

  const disciplinasConcluidas = historico.filter((h) => h.situacaoAcademica === 'APROVADO').length;
  const cargaHorariaTotal = historico.reduce((s, h) => s + (Number(h.cargaHoraria) || 0), 0);
  const medias = historico.map((h) => Number(h.mediaFinal)).filter((m) => !Number.isNaN(m) && m > 0);
  const mediaGeral =
    medias.length > 0 ? medias.reduce((a, b) => a + b, 0) / medias.length : null;
  const freqs = historico.map((h) => Number(h.percentualFrequencia)).filter((f) => !Number.isNaN(f));
  const frequenciaMedia = freqs.length > 0 ? freqs.reduce((a, b) => a + b, 0) / freqs.length : null;

  try {
    await prisma.conclusaoCurso.create({
      data: {
        instituicaoId,
        alunoId,
        cursoId: cursoId || null,
        classeId: classeId || null,
        tipoConclusao: 'CONCLUIDO',
        status: 'CONCLUIDO',
        dataConclusao: new Date(),
        disciplinasConcluidas,
        cargaHorariaTotal,
        frequenciaMedia:
          frequenciaMedia != null ? new Prisma.Decimal(frequenciaMedia.toFixed(2)) : null,
        mediaGeral: mediaGeral != null ? new Prisma.Decimal(mediaGeral.toFixed(2)) : null,
        registradoPor: userId,
        validadoPor: userId,
        validadoEm: new Date(),
        concluidoPor: userId,
        concluidoEm: new Date(),
        observacoes: 'Registo de conclusão gerado automaticamente no encerramento do ano letivo.',
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Após `status_final` e `classe_proxima` gravados no encerramento: finaliza matrículas do ano
 * que encerra e cria matrículas ATIVA do ano seguinte (repetência = mesma classe).
 * Secundário: fim do percurso aprovado → `CONCLUIDA` + `ConclusaoCurso` (se ainda não existir).
 */
export async function aplicarRollforwardMatriculasAposEncerramentoAno(opts: {
  instituicaoId: string;
  anoLetivoOrigem: { id: string; ano: number };
  anoLetivoDestino: { id: string; ano: number };
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null;
  userId: string;
}): Promise<ResultadoRollforwardMatriculas> {
  const resultado: ResultadoRollforwardMatriculas = {
    matriculasCriadas: 0,
    matriculasFinalizadas: 0,
    conclusoesRegistradas: 0,
    erros: [],
  };

  if (opts.anoLetivoDestino.ano !== opts.anoLetivoOrigem.ano + 1) {
    throw new Error(
      `Ano letivo de destino deve ser imediatamente posterior (${opts.anoLetivoOrigem.ano + 1}).`
    );
  }

  const mas = await prisma.matriculaAnual.findMany({
    where: {
      instituicaoId: opts.instituicaoId,
      status: 'ATIVA',
      OR: [{ anoLetivoId: opts.anoLetivoOrigem.id }, { anoLetivo: opts.anoLetivoOrigem.ano }],
    },
  });

  for (const ma of mas) {
    try {
      const refreshed = await prisma.matriculaAnual.findUnique({
        where: { id: ma.id },
      });
      if (!refreshed || refreshed.status !== 'ATIVA') continue;

      const sf = refreshed.statusFinal as 'APROVADO' | 'REPROVADO' | null;
      if (!sf) {
        resultado.erros.push({
          matriculaAnualId: ma.id,
          alunoId: ma.alunoId,
          mensagem: 'Parecer do ano (status_final) não calculado — impossível criar matrícula seguinte.',
        });
        continue;
      }

      const tipo = opts.tipoAcademico;

      if (tipo === 'SECUNDARIO' && refreshed.classeId && sf === 'APROVADO') {
        const { fimPercurso } = await AcademicProgressionService.obterProximaClasse(
          refreshed.classeId,
          opts.instituicaoId
        );
        if (fimPercurso) {
          await prisma.matriculaAnual.update({
            where: { id: refreshed.id },
            data: { status: 'CONCLUIDA' },
          });
          resultado.matriculasFinalizadas += 1;
          const created = await registrarConclusaoCicloAutomatico({
            instituicaoId: opts.instituicaoId,
            alunoId: refreshed.alunoId,
            cursoId: refreshed.cursoId,
            classeId: refreshed.classeId,
            userId: opts.userId,
          });
          if (created) resultado.conclusoesRegistradas += 1;
          continue;
        }
      }

      if (tipo === 'SUPERIOR' && sf === 'APROVADO' && refreshed.cursoId) {
        const cursoSup = await prisma.curso.findFirst({
          where: { id: refreshed.cursoId, instituicaoId: opts.instituicaoId },
          select: { duracao: true },
        });
        const durAnos = parseDuracaoAnosEnsinoSuperior(cursoSup?.duracao);
        const anoOrd = extrairAnoSuperior(refreshed.classeOuAnoCurso);
        const fimPorDuracao = durAnos != null && anoOrd != null && anoOrd >= durAnos;
        const proxNome = refreshed.classeProximaSugerida || refreshed.classeOuAnoCurso;
        const fimPorSugestao = proxNome === refreshed.classeOuAnoCurso;
        if (fimPorDuracao || fimPorSugestao) {
          await prisma.matriculaAnual.update({
            where: { id: refreshed.id },
            data: { status: 'CONCLUIDA' },
          });
          resultado.matriculasFinalizadas += 1;
          const created = await registrarConclusaoCicloAutomatico({
            instituicaoId: opts.instituicaoId,
            alunoId: refreshed.alunoId,
            cursoId: refreshed.cursoId,
            classeId: null,
            userId: opts.userId,
          });
          if (created) resultado.conclusoesRegistradas += 1;
          continue;
        }
      }

      const existsDest = await prisma.matriculaAnual.findFirst({
        where: {
          alunoId: refreshed.alunoId,
          instituicaoId: opts.instituicaoId,
          anoLetivo: opts.anoLetivoDestino.ano,
          status: 'ATIVA',
        },
      });

      if (existsDest) {
        await prisma.matriculaAnual.update({
          where: { id: refreshed.id },
          data: { status: 'FINALIZADA' },
        });
        resultado.matriculasFinalizadas += 1;
        continue;
      }

      let classeOuAnoCurso: string;
      let classeIdNew: string | null;

      if (tipo === 'SECUNDARIO') {
        if (sf === 'REPROVADO') {
          classeOuAnoCurso = refreshed.classeOuAnoCurso;
          classeIdNew = refreshed.classeId;
        } else {
          classeOuAnoCurso = refreshed.classeProximaSugerida || refreshed.classeOuAnoCurso;
          classeIdNew = refreshed.classeProximaSugeridaId || refreshed.classeId;
        }
        if (!classeIdNew) {
          resultado.erros.push({
            matriculaAnualId: refreshed.id,
            alunoId: refreshed.alunoId,
            mensagem: 'Classe de destino indefinida (secundário).',
          });
          continue;
        }
        const classeOk = await prisma.classe.findFirst({
          where: { id: classeIdNew, instituicaoId: opts.instituicaoId, ativo: true },
        });
        if (!classeOk) {
          resultado.erros.push({
            matriculaAnualId: refreshed.id,
            alunoId: refreshed.alunoId,
            mensagem: 'Classe de destino inválida ou inativa.',
          });
          continue;
        }
        classeOuAnoCurso = classeOk.nome;
      } else {
        classeIdNew = null;
        if (sf === 'REPROVADO') {
          classeOuAnoCurso = refreshed.classeOuAnoCurso;
        } else {
          classeOuAnoCurso = refreshed.classeProximaSugerida || refreshed.classeOuAnoCurso;
        }
      }

      await prisma.matriculaAnual.update({
        where: { id: refreshed.id },
        data: { status: 'FINALIZADA' },
      });
      resultado.matriculasFinalizadas += 1;

      await prisma.matriculaAnual.create({
        data: {
          alunoId: refreshed.alunoId,
          instituicaoId: opts.instituicaoId,
          nivelEnsino: refreshed.nivelEnsino,
          classeOuAnoCurso,
          cursoId:
            tipo === 'SUPERIOR'
              ? refreshed.cursoId
              : refreshed.cursoId != null
                ? refreshed.cursoId
                : null,
          classeId: classeIdNew,
          status: 'ATIVA',
          anoLetivo: opts.anoLetivoDestino.ano,
          anoLetivoId: opts.anoLetivoDestino.id,
        },
      });
      resultado.matriculasCriadas += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      resultado.erros.push({
        matriculaAnualId: ma.id,
        alunoId: ma.alunoId,
        mensagem: msg,
      });
    }
  }

  return resultado;
}
