import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter } from '../middlewares/auth.js';
import { EmailService } from '../services/email.service.js';
import { calcularMedia, DadosCalculoNota } from '../services/calculoNota.service.js';
import { validarBloqueioAcademicoInstitucionalOuErro } from '../services/bloqueioAcademico.service.js';

/**
 * Enviar boletim escolar por e-mail
 * POST /boletim/enviar-email
 */
export const enviarBoletimEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId, anoLetivoId, trimestre, semestreId } = req.body;
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    if (!alunoId) {
      throw new AppError('alunoId é obrigatório', 400);
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
    const tipoAcademico = req.user?.tipoAcademico || null;
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId || '',
      tipoAcademico
    );

    // Buscar dados do aluno
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId: instituicaoId || undefined,
      },
      include: {
        matriculas: {
          where: {
            instituicaoId: instituicaoId || undefined,
          },
          include: {
            turma: {
              include: {
                curso: true,
                classe: true,
                disciplina: true,
                anoLetivoRef: true,
              },
            },
            notas: {
              include: {
                avaliacao: {
                  include: {
                    turma: {
                      include: {
                        disciplina: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado', 404);
    }

    if (!aluno.email) {
      throw new AppError('Aluno não possui e-mail cadastrado', 400);
    }

    // Buscar matrícula ativa
    const matricula = aluno.matriculas.find(m => m.ativo) || aluno.matriculas[0];
    if (!matricula) {
      throw new AppError('Aluno não possui matrícula ativa', 400);
    }

    const turma = matricula.turma;
    if (!turma) {
      throw new AppError('Aluno não está vinculado a uma turma', 400);
    }

    // Calcular médias
    const dadosCalculo: DadosCalculoNota = {
      alunoId,
      instituicaoId: instituicaoId || '',
      anoLetivoId: anoLetivoId || turma.anoLetivoId || undefined,
      trimestreId: trimestre ? undefined : undefined, // TODO: buscar trimestreId se trimestre fornecido
      trimestre: trimestre ? Number(trimestre) : undefined,
      tipoAcademico: req.user?.tipoAcademico || null, // CRÍTICO: tipoAcademico vem do JWT
    };

    const resultadoCalculo = await calcularMedia(dadosCalculo);

    // Gerar conteúdo do boletim
    const periodoTexto = trimestre
      ? `${trimestre}º Trimestre - ${turma.anoLetivoRef?.ano || 'N/A'}`
      : turma.anoLetivoRef?.ano
      ? `Ano Letivo ${turma.anoLetivoRef.ano}`
      : 'Período não especificado';

    const conteudoBoletim = `
      <div style="margin: 20px 0;">
        <h3 style="color: #333; margin-bottom: 15px;">Boletim Escolar</h3>
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <p><strong>Aluno:</strong> ${aluno.nomeCompleto || aluno.nome}</p>
          <p><strong>Curso:</strong> ${turma.curso?.nome || 'N/A'}</p>
          <p><strong>Turma:</strong> ${turma.nome || 'N/A'}</p>
          <p><strong>Disciplina:</strong> ${turma.disciplina?.nome || 'N/A'}</p>
          <p><strong>Período:</strong> ${periodoTexto}</p>
        </div>
        <div style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p><strong>Média Final:</strong> <span style="font-size: 20px; font-weight: bold; color: ${resultadoCalculo.media_final >= 10 ? '#10b981' : '#ef4444'};">${resultadoCalculo.media_final.toFixed(2)}</span></p>
          <p><strong>Status:</strong> ${resultadoCalculo.status}</p>
          ${resultadoCalculo.media_parcial ? `<p><strong>Média Parcial:</strong> ${resultadoCalculo.media_parcial.toFixed(2)}</p>` : ''}
          ${resultadoCalculo.media_anual ? `<p><strong>Média Anual:</strong> ${resultadoCalculo.media_anual.toFixed(2)}</p>` : ''}
        </div>
      </div>
    `;

    // Enviar e-mail
    await EmailService.sendEmail(
      req,
      aluno.email,
      'BOLETIM_ESCOLAR',
      {
        nomeAluno: aluno.nomeCompleto || aluno.nome || 'Aluno',
        periodo: periodoTexto,
        anoLetivo: turma.anoLetivoRef?.ano?.toString() || 'N/A',
        conteudoBoletim,
      },
      {
        destinatarioNome: aluno.nomeCompleto || aluno.nome || undefined,
        instituicaoId: instituicaoId || undefined,
      }
    );

    res.json({
      success: true,
      message: 'Boletim enviado com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

