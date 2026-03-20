/**
 * POST /api/importar/estudantes/simples — preview Excel
 * POST /api/importar/estudantes/confirmar — grava alunos válidos
 */

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { validatePlanLimits } from '../middlewares/license.middleware.js';
import {
  parseEstudantesExcelBuffer,
  normalizeConfirmRow,
  loadTurmasAnoAtivo,
  resolveTurmaFromList,
  type ColumnHints,
} from '../services/importacaoEstudantesExcel.service.js';
import { criarMatriculaAnualEMatriculaNaImportacao } from '../services/importacaoEstudantesMatricula.service.js';
import { validarNomeCompleto, gerarNumeroIdentificacaoPublica } from '../services/user.service.js';
import { gerarMensalidadeAutomatica } from './mensalidade.controller.js';
import { resolveModoImportacao } from '../utils/importacaoEstudantesModo.js';
import { AuditService, AcaoAuditoria, EntidadeAuditoria, ModuloAuditoria } from '../services/audit.service.js';
import {
  normalizarDocumentoIdentificacao,
  normalizarTelefoneParaDedupe,
} from '../utils/importacaoEstudantesNormalizacao.js';

const MAX_CONFIRM_ROWS = 2000;

function parseColumnHints(raw: unknown): ColumnHints | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw) as unknown;
      if (j && typeof j === 'object') return j as ColumnHints;
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (typeof raw === 'object') return raw as ColumnHints;
  return undefined;
}

export const previewImportacaoEstudantes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const file = req.file;
    if (!file?.buffer) {
      throw new AppError('Envie o ficheiro Excel no campo "file".', 400);
    }

    const inst = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });
    const tipoAcademico = req.user?.tipoAcademico ?? inst?.tipoAcademico ?? null;

    const hints = parseColumnHints(req.body?.columnHints);

    const result = await parseEstudantesExcelBuffer(
      file.buffer,
      instituicaoId,
      tipoAcademico,
      hints,
      {
        modoImportacao: typeof req.body?.modoImportacao === 'string' ? req.body.modoImportacao : undefined,
        importarMesmoSeMatriculaFalharLegacy:
          typeof req.body?.importarMesmoSeMatriculaFalhar === 'boolean'
            ? req.body.importarMesmoSeMatriculaFalhar
            : undefined,
      }
    );

    res.json(result);
  } catch (error) {
    if (error instanceof Error && !(error instanceof AppError)) {
      return next(new AppError(error.message, 400));
    }
    next(error);
  }
};

export const confirmarImportacaoEstudantes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { linhas, modoImportacao: modoBody, importarMesmoSeMatriculaFalhar: legacyPermissivo } = req.body as {
      linhas?: unknown[];
      /** seguro = regras completas + transação única; flexivel = afrouxa só na importação + aluno mantém-se se matrícula falhar */
      modoImportacao?: string;
      /** @deprecated usar modoImportacao: true ≈ flexivel */
      importarMesmoSeMatriculaFalhar?: boolean;
    };

    if (!Array.isArray(linhas) || linhas.length === 0) {
      throw new AppError('Envie "linhas" (array) com os registos a importar.', 400);
    }
    if (linhas.length > MAX_CONFIRM_ROWS) {
      throw new AppError(`Máximo de ${MAX_CONFIRM_ROWS} linhas por pedido.`, 400);
    }

    const inst = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });
    const tipoAcademicoInst = req.user?.tipoAcademico ?? inst?.tipoAcademico ?? null;
    const turmasCache = await loadTurmasAnoAtivo(instituicaoId);
    const userRoles = (req.user?.roles || []).map((r) => (typeof r === 'string' ? r : String(r)));

    const modoImportacao = resolveModoImportacao(
      typeof modoBody === 'string' ? modoBody : undefined,
      typeof legacyPermissivo === 'boolean' ? legacyPermissivo : undefined
    );

    const flexivel = modoImportacao === 'flexivel';
    const permissivo = flexivel;
    const relaxarRegrasImportacao = flexivel
      ? {
          ignorarPeriodoLetivo: true,
          ignorarBloqueioDivida: true,
          ignorarCapacidadeTurma: true,
          ignorarValidacaoProgressao: true,
        }
      : undefined;

    const normalizadas = linhas.map(normalizeConfirmRow).filter(Boolean) as NonNullable<
      ReturnType<typeof normalizeConfirmRow>
    >[];

    const pendentes: {
      nomeCompleto: string;
      classe: string;
      turma?: string;
      bi?: string;
      telefone?: string;
      email?: string;
      linha: number;
    }[] = [];

    for (const row of normalizadas) {
      try {
        if (!row.nomeCompleto?.trim() || !row.classe?.trim()) continue;
        validarNomeCompleto(row.nomeCompleto);
        pendentes.push({
          linha: row.linha,
          nomeCompleto: validarNomeCompleto(row.nomeCompleto),
          classe: row.classe.trim(),
          turma: row.turma?.trim() || undefined,
          bi: row.bi?.trim() || undefined,
          telefone: row.telefone?.trim() || undefined,
          email: row.email?.trim() || undefined,
        });
      } catch {
        /* linha inválida — ignorada */
      }
    }

    if (pendentes.length === 0) {
      return res.json({
        importados: 0,
        matriculasEmTurma: 0,
        matriculasFalharam: 0,
        modoImportacao,
        importarMesmoSeMatriculaFalhar: permissivo,
        ignorados: linhas.length,
        totalRecebidas: linhas.length,
        detalhes: [],
        detalhesMatricula: [],
        orientacaoPrimeiroAcesso:
          'Senha inicial aleatória (desconhecida). Com e-mail real: recuperação de senha no login. Sem e-mail ou e-mail técnico (@importacao.dsicola): redefinir senha em Gestão de alunos.',
      });
    }

    const baseAlunos = await prisma.userRole_.count({
      where: { instituicaoId, role: 'ALUNO' },
    });
    await validatePlanLimits(req, 'alunos', baseAlunos + pendentes.length, instituicaoId);

    let importados = 0;
    let matriculasEmTurma = 0;
    let matriculasFalharam = 0;
    let ignorados = 0;
    const detalhes: { linha: number; motivo: string }[] = [];
    const detalhesMatricula: { linha: number; motivo: string }[] = [];
    const emailsUsados = new Set<string>();
    const bisUsadosNoFicheiro = new Set<string>();
    const telefonesUsadosNoFicheiro = new Set<string>();

    const normBisPendentes = [
      ...new Set(
        pendentes
          .map((p) => (p.bi?.trim() ? normalizarDocumentoIdentificacao(p.bi) : ''))
          .filter(Boolean)
      ),
    ];
    const alunosComBiExistente =
      normBisPendentes.length > 0
        ? await prisma.user.findMany({
            where: {
              instituicaoId,
              numeroIdentificacao: { in: normBisPendentes },
            },
            select: { numeroIdentificacao: true },
          })
        : [];
    const biJaCadastradoInstituicao = new Set(
      alunosComBiExistente
        .map((u) => u.numeroIdentificacao)
        .filter((x): x is string => !!x)
        .map((x) => normalizarDocumentoIdentificacao(x))
    );

    for (const row of pendentes) {
      let email = row.email?.toLowerCase().trim();
      if (email) {
        if (emailsUsados.has(email)) {
          ignorados++;
          detalhes.push({ linha: row.linha, motivo: 'E-mail duplicado no ficheiro' });
          continue;
        }
        const exists = await prisma.user.findFirst({
          where: { instituicaoId, email },
          select: { id: true },
        });
        if (exists) {
          ignorados++;
          detalhes.push({ linha: row.linha, motivo: 'E-mail já existe na instituição' });
          continue;
        }
      } else {
        email = `import.${randomUUID()}.aluno@importacao.dsicola`;
        const exists = await prisma.user.findFirst({
          where: { instituicaoId, email },
          select: { id: true },
        });
        if (exists) {
          email = `import.${randomUUID()}.aluno@importacao.dsicola`;
        }
      }
      emailsUsados.add(email);

      const biNorm = row.bi?.trim() ? normalizarDocumentoIdentificacao(row.bi) : '';
      if (biNorm) {
        if (bisUsadosNoFicheiro.has(biNorm)) {
          ignorados++;
          detalhes.push({ linha: row.linha, motivo: 'BI/NIF duplicado no ficheiro' });
          continue;
        }
        if (biJaCadastradoInstituicao.has(biNorm)) {
          ignorados++;
          detalhes.push({ linha: row.linha, motivo: 'BI/NIF já cadastrado na instituição' });
          continue;
        }
        bisUsadosNoFicheiro.add(biNorm);
      }

      const telDedupe = row.telefone?.trim() ? normalizarTelefoneParaDedupe(row.telefone) : '';
      if (telDedupe.length >= 9) {
        if (telefonesUsadosNoFicheiro.has(telDedupe)) {
          ignorados++;
          detalhes.push({ linha: row.linha, motivo: 'Telefone duplicado no ficheiro' });
          continue;
        }
        telefonesUsadosNoFicheiro.add(telDedupe);
      }

      const { turmaId: turmaResolvidaId } = resolveTurmaFromList(
        turmasCache,
        tipoAcademicoInst,
        row.classe,
        row.turma
      );

      try {
        const passwordHash = await bcrypt.hash(`TEMP_IMPORT_${randomUUID()}`, 12);
        const numeroPub = await gerarNumeroIdentificacaoPublica('ALUNO', instituicaoId);

        if (permissivo) {
          const { userId } = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                email,
                password: passwordHash,
                nomeCompleto: row.nomeCompleto,
                instituicaoId,
                telefone: row.telefone || null,
                numeroIdentificacao: biNorm || null,
                numeroIdentificacaoPublica: numeroPub,
                statusAluno: 'Ativo',
                mustChangePassword: false,
                passwordUpdatedAt: null,
              },
            });
            await tx.userRole_.create({
              data: {
                userId: user.id,
                role: 'ALUNO',
                instituicaoId,
              },
            });
            return { userId: user.id };
          });

          importados++;

          if (turmaResolvidaId) {
            try {
              const { matriculaId } = await prisma.$transaction(async (tx) =>
                criarMatriculaAnualEMatriculaNaImportacao(tx, {
                  alunoId: userId,
                  instituicaoId,
                  turmaId: turmaResolvidaId,
                  tipoAcademicoInstituicao: tipoAcademicoInst,
                  classeRawExcel: row.classe,
                  userRoles,
                  relaxarRegrasImportacao,
                })
              );
              matriculasEmTurma++;
              gerarMensalidadeAutomatica(userId, turmaResolvidaId, instituicaoId, matriculaId).catch((err) => {
                console.error('[importacaoEstudantes] Mensalidade automática:', err?.message || err);
              });
            } catch (me: unknown) {
              matriculasFalharam++;
              const msg = me instanceof Error ? me.message : 'Matrícula na turma falhou';
              detalhesMatricula.push({
                linha: row.linha,
                motivo: msg.slice(0, 220),
              });
            }
          }
        } else {
          const resultado = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                email,
                password: passwordHash,
                nomeCompleto: row.nomeCompleto,
                instituicaoId,
                telefone: row.telefone || null,
                numeroIdentificacao: biNorm || null,
                numeroIdentificacaoPublica: numeroPub,
                statusAluno: 'Ativo',
                mustChangePassword: false,
                passwordUpdatedAt: null,
              },
            });
            await tx.userRole_.create({
              data: {
                userId: user.id,
                role: 'ALUNO',
                instituicaoId,
              },
            });

            if (turmaResolvidaId) {
              const { matriculaId } = await criarMatriculaAnualEMatriculaNaImportacao(tx, {
                alunoId: user.id,
                instituicaoId,
                turmaId: turmaResolvidaId,
                tipoAcademicoInstituicao: tipoAcademicoInst,
                classeRawExcel: row.classe,
                userRoles,
                relaxarRegrasImportacao,
              });
              return { userId: user.id, matriculaId, turmaId: turmaResolvidaId };
            }

            return { userId: user.id, matriculaId: null as string | null, turmaId: null as string | null };
          });

          if (resultado.matriculaId && resultado.turmaId) {
            matriculasEmTurma++;
            gerarMensalidadeAutomatica(
              resultado.userId,
              resultado.turmaId,
              instituicaoId,
              resultado.matriculaId
            ).catch((err) => {
              console.error('[importacaoEstudantes] Mensalidade automática:', err?.message || err);
            });
          }

          importados++;
        }
      } catch (e: unknown) {
        ignorados++;
        const msg = e instanceof Error ? e.message : 'Erro ao gravar';
        detalhes.push({ linha: row.linha, motivo: msg.slice(0, 200) });
      }
    }

    const payload = {
      importados,
      matriculasEmTurma,
      matriculasFalharam,
      modoImportacao,
      importarMesmoSeMatriculaFalhar: permissivo,
      ignorados,
      totalRecebidas: linhas.length,
      detalhes,
      detalhesMatricula,
      orientacaoPrimeiroAcesso:
        'Senha inicial aleatória (desconhecida). Com e-mail real: recuperação de senha no login. Sem e-mail ou e-mail técnico (@importacao.dsicola): redefinir senha em Gestão de alunos. Após o admin definir uma senha temporária, o aluno pode ser obrigado a alterá-la na próxima entrada, conforme política do reset.',
    };

    void AuditService.log(req, {
      modulo: ModuloAuditoria.ALUNOS,
      acao: AcaoAuditoria.CREATE,
      entidade: EntidadeAuditoria.USER,
      dadosNovos: {
        tipo: 'IMPORTACAO_EXCEL_ESTUDANTES',
        modoImportacao,
        importados,
        matriculasEmTurma,
        matriculasFalharam,
        ignorados,
        totalRecebidas: linhas.length,
        senhaInicialAleatoria: true,
      },
      observacao: `Importação Excel de estudantes (${modoImportacao}): ${importados} importados, ${matriculasEmTurma} matrículas em turma.`,
    }).catch((err) => console.error('[importacaoEstudantes] Auditoria:', err?.message || err));

    res.json(payload);
  } catch (error) {
    next(error);
  }
};
