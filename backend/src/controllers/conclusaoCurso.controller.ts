import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { validarRequisitosConclusao } from '../services/conclusaoCurso.service.js';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { TipoAcademico } from '@prisma/client';

/**
 * ========================================
 * CONTROLLER: CONCLUSÃO DE CURSO / COLAÇÃO DE GRAU / CERTIFICAÇÃO
 * ========================================
 * 
 * REGRAS ABSOLUTAS (SIGA/SIGAE):
 * - Conclusão NUNCA é automática
 * - Conclusão SEMPRE exige validação final
 * - Conclusão gera REGISTRO OFICIAL IMUTÁVEL
 * - Histórico NÃO pode ser alterado após conclusão
 * - Tudo deve ser auditável
 * - instituicao_id SEMPRE do token (NUNCA do frontend)
 */

/**
 * Validar requisitos para conclusão de curso
 * GET /conclusoes-cursos/validar?alunoId=&cursoId=&classeId=
 */
export const validarRequisitos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId, cursoId, classeId } = req.query;

    if (!alunoId || typeof alunoId !== 'string') {
      throw new AppError('alunoId é obrigatório', 400);
    }

    if (!cursoId && !classeId) {
      throw new AppError('cursoId ou classeId é obrigatório', 400);
    }

    // CRÍTICO: Usar tipoAcademico do JWT (req.user.tipoAcademico) - NÃO buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;

    if (!tipoAcademico) {
      throw new AppError('Tipo acadêmico da instituição não identificado. Faça login novamente.', 400);
    }

    // ENSINO SUPERIOR: NUNCA permitir classeId
    if (tipoAcademico === 'SUPERIOR') {
      if (classeId) {
        throw new AppError('Campo "classeId" não é válido para Ensino Superior. Use "cursoId".', 400);
      }
      if (!cursoId) {
        throw new AppError('cursoId é obrigatório para Ensino Superior', 400);
      }
    }

    // ENSINO SECUNDÁRIO: cursoId é OPCIONAL, classeId é OBRIGATÓRIO
    if (tipoAcademico === 'SECUNDARIO') {
      // REGRA: Curso é OPCIONAL no Ensino Secundário (pode ser fornecido ou não)
      // REGRA: Classe é OBRIGATÓRIA no Ensino Secundário
      if (!classeId) {
        throw new AppError('classeId é obrigatório para Ensino Secundário', 400);
      }
      // cursoId é aceito quando fornecido (opcional) - não rejeitar
    }

    const validacao = await validarRequisitosConclusao(
      alunoId,
      cursoId as string | null,
      classeId as string | null,
      instituicaoId,
      tipoAcademico // Passar tipoAcademico do JWT
    );

    res.json(validacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar solicitação de conclusão de curso
 * POST /conclusoes-cursos
 */
export const criarSolicitacao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const { alunoId, cursoId, classeId, tipoConclusao, observacoes } = req.body;

    if (!alunoId) {
      throw new AppError('alunoId é obrigatório', 400);
    }

    if (!cursoId && !classeId) {
      throw new AppError('cursoId ou classeId é obrigatório', 400);
    }

    // CRÍTICO: Usar tipoAcademico do JWT (req.user.tipoAcademico) - NÃO buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;

    if (!tipoAcademico) {
      throw new AppError('Tipo acadêmico da instituição não identificado. Faça login novamente.', 400);
    }

    // ENSINO SUPERIOR: NUNCA permitir classeId
    if (tipoAcademico === 'SUPERIOR') {
      if (classeId) {
        throw new AppError('Campo "classeId" não é válido para Ensino Superior. Use "cursoId".', 400);
      }
      if (!cursoId) {
        throw new AppError('cursoId é obrigatório para Ensino Superior', 400);
      }
    }

    // ENSINO SECUNDÁRIO: cursoId é OPCIONAL, classeId é OBRIGATÓRIO
    if (tipoAcademico === 'SECUNDARIO') {
      // REGRA: Curso é OPCIONAL no Ensino Secundário (pode ser fornecido ou não)
      // REGRA: Classe é OBRIGATÓRIA no Ensino Secundário
      if (!classeId) {
        throw new AppError('classeId é obrigatório para Ensino Secundário', 400);
      }
      // cursoId é aceito quando fornecido (opcional) - não rejeitar
    }

    // Validar requisitos antes de criar
    const validacao = await validarRequisitosConclusao(
      alunoId,
      cursoId || null,
      classeId || null,
      instituicaoId,
      tipoAcademico // Passar tipoAcademico do JWT
    );

    if (!validacao.valido) {
      throw new AppError(
        `Requisitos não atendidos: ${validacao.erros.join('; ')}`,
        400
      );
    }

    // Verificar se já existe conclusão para este aluno/curso ou aluno/classe
    const existing = await prisma.conclusaoCurso.findFirst({
      where: {
        instituicaoId,
        alunoId,
        ...(cursoId ? { cursoId } : {}),
        ...(classeId ? { classeId } : {}),
      },
    });

    if (existing) {
      throw new AppError(
        'Já existe uma conclusão registrada para este aluno e curso/classe',
        400
      );
    }

    // Buscar histórico acadêmico para calcular dados consolidados
    const historicoAcademico = await prisma.historicoAcademico.findMany({
      where: {
        alunoId,
        instituicaoId,
        ...(cursoId ? { cursoId } : {}),
        ...(classeId ? { classeId } : {}),
      },
    });

    const disciplinasConcluidas = historicoAcademico.filter(
      (h) => h.situacaoAcademica === 'APROVADO'
    ).length;

    const cargaHorariaTotal = historicoAcademico.reduce(
      (sum, h) => sum + h.cargaHoraria,
      0
    );

    const frequencias = historicoAcademico.map((h) => Number(h.percentualFrequencia));
    const frequenciaMedia =
      frequencias.length > 0
        ? frequencias.reduce((sum, f) => sum + f, 0) / frequencias.length
        : null;

    const medias = historicoAcademico
      .map((h) => Number(h.mediaFinal))
      .filter((m) => !isNaN(m) && m > 0);
    const mediaGeral =
      medias.length > 0 ? medias.reduce((sum, m) => sum + m, 0) / medias.length : null;

    // Criar solicitação de conclusão
    const conclusao = await prisma.conclusaoCurso.create({
      data: {
        instituicaoId,
        alunoId,
        cursoId: cursoId || null,
        classeId: classeId || null,
        tipoConclusao: tipoConclusao || 'CONCLUIDO',
        status: 'VALIDADO', // Requisitos já foram validados
        dataConclusao: new Date(),
        disciplinasConcluidas,
        cargaHorariaTotal,
        frequenciaMedia: frequenciaMedia ? frequenciaMedia : null,
        mediaGeral: mediaGeral ? mediaGeral : null,
        registradoPor: userId,
        validadoPor: userId,
        validadoEm: new Date(),
        observacoes: observacoes || null,
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
      },
    });

    // Registrar auditoria
    await AuditService.registrar({
      modulo: ModuloAuditoria.ACADEMICO,
      entidade: EntidadeAuditoria.CONCLUSAO_CURSO,
      entidadeId: conclusao.id,
      acao: 'CRIAR_SOLICITACAO',
      usuarioId: userId,
      instituicaoId,
      detalhes: {
        alunoId,
        cursoId: cursoId || null,
        classeId: classeId || null,
        tipoConclusao: conclusao.tipoConclusao,
      },
    });

    res.status(201).json(conclusao);
  } catch (error) {
    next(error);
  }
};

/**
 * Concluir curso oficialmente (após validação)
 * POST /conclusoes-cursos/:id/concluir
 */
export const concluirCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { id } = req.params;
    const { numeroAto, observacoes } = req.body;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const conclusao = await prisma.conclusaoCurso.findFirst({
      where: {
        id,
        instituicaoId,
      },
      include: {
        aluno: true,
        curso: true,
        classe: true,
      },
    });

    if (!conclusao) {
      throw new AppError('Conclusão não encontrada', 404);
    }

    if (conclusao.status === 'CONCLUIDO') {
      throw new AppError('Curso já foi concluído oficialmente', 400);
    }

    if (conclusao.status !== 'VALIDADO') {
      throw new AppError(
        'Conclusão deve estar validada antes de ser concluída oficialmente',
        400
      );
    }

    // Atualizar status para CONCLUIDO
    const conclusaoAtualizada = await prisma.conclusaoCurso.update({
      where: { id },
      data: {
        status: 'CONCLUIDO',
        concluidoPor: userId,
        concluidoEm: new Date(),
        numeroAto: numeroAto || null,
        observacoes: observacoes || conclusao.observacoes,
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
      },
    });

    // ============================================================================
    // AÇÕES AO CONCLUIR: Bloquear alterações acadêmicas após conclusão
    // REGRA SIGA/SIGAE: Histórico acadêmico torna-se IMUTÁVEL após conclusão
    // ============================================================================
    
    // 1. Atualizar status da matrícula para CONCLUIDA
    if (conclusao.cursoId) {
      // Ensino Superior: atualizar todas as matrículas anuais do aluno neste curso
      await prisma.matriculaAnual.updateMany({
        where: {
          alunoId: conclusao.alunoId,
          cursoId: conclusao.cursoId,
          instituicaoId,
        },
        data: {
          status: 'CONCLUIDA',
        },
      });
    } else if (conclusao.classeId) {
      // Ensino Secundário: atualizar todas as matrículas anuais do aluno nesta classe
      await prisma.matriculaAnual.updateMany({
        where: {
          alunoId: conclusao.alunoId,
          classeId: conclusao.classeId,
          instituicaoId,
        },
        data: {
          status: 'CONCLUIDA',
        },
      });
    }

    // 2. Marcar aluno como CONCLUÍDO (campo status ou flag específica)
    // NOTA: Se houver campo de status no modelo Aluno, atualizar aqui
    // Por enquanto, a conclusão é rastreada apenas pela tabela ConclusaoCurso
    
    // 3. Bloquear novas matrículas para este curso/classe
    // A validação será feita no controller de matrícula verificando se existe conclusão CONCLUIDA
    
    // 4. Bloquear lançamentos de notas após conclusão
    // A validação será feita no controller de nota verificando se existe conclusão CONCLUIDA
    // e se a matrícula está CONCLUIDA
    
    // NOTA IMPORTANTE: 
    // - O bloqueio de novas matrículas é verificado em matriculaAnual.controller.ts
    // - O bloqueio de lançamentos de notas é verificado em nota.controller.ts
    // - Ambos devem verificar se existe ConclusaoCurso com status='CONCLUIDO' para o aluno/curso ou aluno/classe

    // Registrar auditoria
    await AuditService.registrar({
      modulo: ModuloAuditoria.ACADEMICO,
      entidade: EntidadeAuditoria.CONCLUSAO_CURSO,
      entidadeId: id,
      acao: 'CONCLUIR_CURSO',
      usuarioId: userId,
      instituicaoId,
      detalhes: {
        numeroAto: numeroAto || null,
      },
    });

    res.json(conclusaoAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar colação de grau (Ensino Superior)
 * POST /conclusoes-cursos/:id/colacao
 */
export const criarColacaoGrau = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { id } = req.params;
    const { dataColacao, numeroAta, localColacao, observacoes } = req.body;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar tipo acadêmico da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    if (instituicao?.tipoAcademico !== 'SUPERIOR') {
      throw new AppError('Colação de grau é permitida apenas para Ensino Superior', 400);
    }

    const conclusao = await prisma.conclusaoCurso.findFirst({
      where: {
        id,
        instituicaoId,
        status: 'CONCLUIDO',
      },
    });

    if (!conclusao) {
      throw new AppError(
        'Conclusão não encontrada ou curso ainda não foi concluído oficialmente',
        404
      );
    }

    // Verificar se já existe colação
    const existing = await prisma.colacaoGrau.findFirst({
      where: {
        conclusaoCursoId: id,
      },
    });

    if (existing) {
      throw new AppError('Já existe uma colação de grau registrada para esta conclusão', 400);
    }

    const colacao = await prisma.colacaoGrau.create({
      data: {
        conclusaoCursoId: id,
        instituicaoId,
        dataColacao: dataColacao ? new Date(dataColacao) : new Date(),
        numeroAta: numeroAta || null,
        localColacao: localColacao || null,
        observacoes: observacoes || null,
        registradoPor: userId,
      },
      include: {
        conclusaoCurso: {
          include: {
            aluno: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
            curso: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
      },
    });

    // Registrar auditoria
    await AuditService.registrar({
      modulo: ModuloAuditoria.ACADEMICO,
      entidade: EntidadeAuditoria.COLACAO_GRAU,
      entidadeId: colacao.id,
      acao: 'CRIAR_COLACAO',
      usuarioId: userId,
      instituicaoId,
      detalhes: {
        conclusaoCursoId: id,
        dataColacao: colacao.dataColacao,
      },
    });

    res.status(201).json(colacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar certificado (Ensino Secundário)
 * POST /conclusoes-cursos/:id/certificado
 */
export const criarCertificado = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { id } = req.params;
    const { numeroCertificado, livro, folha, observacoes } = req.body;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar tipo acadêmico da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    if (instituicao?.tipoAcademico !== 'SECUNDARIO') {
      throw new AppError('Certificado é permitido apenas para Ensino Secundário', 400);
    }

    const conclusao = await prisma.conclusaoCurso.findFirst({
      where: {
        id,
        instituicaoId,
        status: 'CONCLUIDO',
      },
    });

    if (!conclusao) {
      throw new AppError(
        'Conclusão não encontrada ou curso ainda não foi concluído oficialmente',
        404
      );
    }

    // Verificar se já existe certificado
    const existing = await prisma.certificado.findFirst({
      where: {
        conclusaoCursoId: id,
      },
    });

    if (existing) {
      throw new AppError('Já existe um certificado registrado para esta conclusão', 400);
    }

    if (!numeroCertificado) {
      throw new AppError('numeroCertificado é obrigatório', 400);
    }

    // Verificar se número de certificado já existe
    const numeroExistente = await prisma.certificado.findFirst({
      where: {
        numeroCertificado,
        instituicaoId,
      },
    });

    if (numeroExistente) {
      throw new AppError('Número de certificado já existe', 400);
    }

    const certificado = await prisma.certificado.create({
      data: {
        conclusaoCursoId: id,
        instituicaoId,
        numeroCertificado,
        livro: livro || null,
        folha: folha || null,
        observacoes: observacoes || null,
        emitidoPor: userId,
      },
      include: {
        conclusaoCurso: {
          include: {
            aluno: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
            classe: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
      },
    });

    // Registrar auditoria
    await AuditService.registrar({
      modulo: ModuloAuditoria.ACADEMICO,
      entidade: EntidadeAuditoria.CERTIFICADO,
      entidadeId: certificado.id,
      acao: 'CRIAR_CERTIFICADO',
      usuarioId: userId,
      instituicaoId,
      detalhes: {
        conclusaoCursoId: id,
        numeroCertificado,
      },
    });

    res.status(201).json(certificado);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar conclusões de curso
 * GET /conclusoes-cursos
 */
export const listarConclusoes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId, cursoId, classeId, status } = req.query;

    const where: any = {
      instituicaoId,
    };

    if (alunoId) where.alunoId = alunoId;
    if (cursoId) where.cursoId = cursoId;
    if (classeId) where.classeId = classeId;
    if (status) where.status = status;

    const conclusoes = await prisma.conclusaoCurso.findMany({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        colacaoGrau: true,
        certificado: true,
      },
      orderBy: {
        dataConclusao: 'desc',
      },
    });

    res.json(conclusoes);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar conclusão por ID
 * GET /conclusoes-cursos/:id
 */
export const buscarConclusaoPorId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const conclusao = await prisma.conclusaoCurso.findFirst({
      where: {
        id,
        instituicaoId,
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacao: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        colacaoGrau: true,
        certificado: true,
      },
    });

    if (!conclusao) {
      throw new AppError('Conclusão não encontrada', 404);
    }

    res.json(conclusao);
  } catch (error) {
    next(error);
  }
};

/**
 * Bloquear UPDATE de conclusão - REGISTRO OFICIAL IMUTÁVEL
 * Conclusões nunca devem ser atualizadas após criação (padrão SIGA/SIGAE)
 * PUT /conclusoes-cursos/:id ou PATCH /conclusoes-cursos/:id
 */
export const updateConclusao = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  
  // Verificar se conclusão existe e está concluída
  const instituicaoId = requireTenantScope(req);
  const conclusao = await prisma.conclusaoCurso.findFirst({
    where: { id, instituicaoId },
    select: { id: true, status: true },
  });

  if (!conclusao) {
    throw new AppError('Conclusão não encontrada', 404);
  }

  // REGRA SIGA/SIGAE: Conclusões são IMUTÁVEIS após criação
  // Apenas o status pode ser alterado via endpoint específico /concluir
  throw new AppError(
    'Conclusões de curso não podem ser atualizadas diretamente. O registro oficial é imutável conforme padrão SIGA/SIGAE. Use o endpoint específico /conclusoes-cursos/:id/concluir para concluir oficialmente após validação.',
    403
  );
};

/**
 * Bloquear DELETE de conclusão - REGISTRO OFICIAL IMUTÁVEL
 * Conclusões nunca devem ser deletadas (padrão SIGA/SIGAE)
 * DELETE /conclusoes-cursos/:id
 */
export const deleteConclusao = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Conclusões de curso não podem ser deletadas. O registro oficial é imutável conforme padrão SIGA/SIGAE. O histórico acadêmico após conclusão é definitivo e não pode ser alterado.',
    403
  );
};

