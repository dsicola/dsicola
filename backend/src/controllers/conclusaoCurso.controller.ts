import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { validarRequisitosConclusao, verificarRegistoAcademicoMinimo } from '../services/conclusaoCurso.service.js';
import {
  calcularPautaConclusaoCicloSecundario,
  obterClasseIdsCicloSecundario,
} from '../services/pautaConclusaoCicloSecundario.service.js';
import { gerarPdfPautaConclusaoCicloSecundario } from '../services/pautaConclusaoCicloPdf.service.js';
import { gerarCertificadoConclusaoPdfPorConclusaoId } from '../services/certificadoConclusaoPdf.service.js';
import { gerarCertificadoConclusaoSuperiorPdfPorConclusaoId } from '../services/certificadoConclusaoSuperiorPdf.service.js';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';

/**
 * ========================================
 * CONTROLLER: CONCLUSÃO DE CURSO / COLAÇÃO DE GRAU / CERTIFICAÇÃO
 * ========================================
 * 
 * REGRAS ABSOLUTAS (institucional):
 * - Conclusão NUNCA é automática
 * - Conclusão SEMPRE exige validação final
 * - Conclusão gera REGISTRO OFICIAL IMUTÁVEL
 * - Histórico NÃO pode ser alterado após conclusão
 * - Tudo deve ser auditável
 * - instituicao_id SEMPRE do token (NUNCA do frontend)
 */

/** JWT define o contexto quando presente; em instituição MISTA com JWT vazio, infere-se pelo cursoId/classeId. */
async function resolveTipoAcademicoParaConclusao(
  jwtTipo: string | null | undefined,
  instituicaoId: string,
  cursoId: unknown,
  classeId: unknown
): Promise<'SUPERIOR' | 'SECUNDARIO'> {
  const c = cursoId && typeof cursoId === 'string' ? cursoId : null;
  const cl = classeId && typeof classeId === 'string' ? classeId : null;

  if (jwtTipo === 'SUPERIOR' || jwtTipo === 'SECUNDARIO') {
    return jwtTipo;
  }

  const inst = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true, tipoInstituicao: true },
  });

  if (!inst) {
    throw new AppError('Instituição não encontrada', 404);
  }

  if (inst.tipoAcademico === 'SUPERIOR') return 'SUPERIOR';
  if (inst.tipoAcademico === 'SECUNDARIO') return 'SECUNDARIO';

  if (inst.tipoInstituicao === 'MISTA') {
    if (c && cl) {
      throw new AppError(
        'Em instituição mista indique apenas curso (Ensino Superior) ou apenas classe (Ensino Secundário).',
        400
      );
    }
    if (c && !cl) return 'SUPERIOR';
    if (cl && !c) return 'SECUNDARIO';
    throw new AppError(
      'Em instituição mista selecione curso ou classe para identificar o tipo de conclusão.',
      400
    );
  }

  throw new AppError(
    'Tipo acadêmico da instituição não identificado. Configure o tipo ou faça login novamente.',
    400
  );
}

/** Pauta de ciclo: fluxo secundário; instituições mistas ou ensino médio sem tipo no JWT podem aceder. */
async function podeAcederPautaCicloSecundario(
  jwtTipo: string | null | undefined,
  instituicaoId: string
): Promise<boolean> {
  if (jwtTipo === 'SECUNDARIO') return true;
  if (jwtTipo === 'SUPERIOR') return false;

  const inst = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true, tipoInstituicao: true },
  });
  if (!inst) return false;
  if (inst.tipoAcademico === 'SECUNDARIO') return true;
  if (inst.tipoAcademico === 'SUPERIOR') return false;
  return inst.tipoInstituicao === 'MISTA' || inst.tipoInstituicao === 'ENSINO_MEDIO';
}

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

    const tipoAcademico = await resolveTipoAcademicoParaConclusao(
      req.user?.tipoAcademico,
      instituicaoId,
      cursoId,
      classeId
    );

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
      tipoAcademico
    );

    res.json(validacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Pauta de conclusão do ciclo (Ensino Secundário apenas — média por disciplina no ciclo e média final do curso).
 * GET /conclusoes-cursos/pauta-conclusao-ciclo?alunoId=
 */
export const pautaConclusaoCiclo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId } = req.query;
    if (!alunoId || typeof alunoId !== 'string') {
      throw new AppError('alunoId é obrigatório', 400);
    }
    const podePauta = await podeAcederPautaCicloSecundario(req.user?.tipoAcademico, instituicaoId);
    if (!podePauta) {
      throw new AppError(
        'Pauta de conclusão do ciclo está disponível apenas para o fluxo de Ensino Secundário.',
        400,
      );
    }
    const pauta = await calcularPautaConclusaoCicloSecundario({
      alunoId,
      instituicaoId,
      tipoAcademico: 'SECUNDARIO',
    });
    res.json(pauta);
  } catch (error) {
    next(error);
  }
};

/**
 * PDF da pauta de conclusão do ciclo (Ensino Secundário).
 * GET /conclusoes-cursos/pauta-conclusao-ciclo/pdf?alunoId=
 */
export const pautaConclusaoCicloPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId } = req.query;
    if (!alunoId || typeof alunoId !== 'string') {
      throw new AppError('alunoId é obrigatório', 400);
    }
    const podePauta = await podeAcederPautaCicloSecundario(req.user?.tipoAcademico, instituicaoId);
    if (!podePauta) {
      throw new AppError(
        'Pauta de conclusão do ciclo está disponível apenas para o fluxo de Ensino Secundário.',
        400,
      );
    }

    const regPdf = await verificarRegistoAcademicoMinimo(alunoId, instituicaoId);
    if (!regPdf.alunoExiste) throw new AppError(regPdf.mensagem ?? 'Estudante não encontrado.', 404);
    if (!regPdf.ok) throw new AppError(regPdf.mensagem ?? 'Sem notas ou histórico.', 400);

    const [aluno, instituicao, pauta] = await Promise.all([
      prisma.user.findFirst({
        where: { id: alunoId, instituicaoId },
        select: { id: true, nomeCompleto: true },
      }),
      prisma.instituicao.findFirst({
        where: { id: instituicaoId },
        select: { nome: true },
      }),
      calcularPautaConclusaoCicloSecundario({
        alunoId,
        instituicaoId,
        tipoAcademico: 'SECUNDARIO',
      }),
    ]);

    if (!aluno) {
      throw new AppError('Estudante não encontrado nesta instituição', 404);
    }

    const pdf = await gerarPdfPautaConclusaoCicloSecundario({
      pauta,
      alunoNome: aluno.nomeCompleto || '—',
      instituicaoNome: instituicao?.nome || 'Instituição',
    });

    const safeName = (aluno.nomeCompleto || 'aluno').replace(/[^\w\s-]/g, '').slice(0, 80);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pauta-conclusao-ciclo-${safeName}.pdf"`,
    );
    res.send(pdf);
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

    const tipoAcademico = await resolveTipoAcademicoParaConclusao(
      req.user?.tipoAcademico,
      instituicaoId,
      cursoId,
      classeId
    );

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

    const cicloIdsSec =
      tipoAcademico === 'SECUNDARIO' && classeId
        ? await obterClasseIdsCicloSecundario(instituicaoId)
        : [];

    // Buscar histórico acadêmico para calcular dados consolidados (secundário: ciclo completo)
    const historicoAcademico = await prisma.historicoAcademico.findMany({
      where: {
        alunoId,
        instituicaoId,
        ...(cursoId ? { cursoId } : {}),
        ...(tipoAcademico === 'SECUNDARIO'
          ? cicloIdsSec.length > 0
            ? { classeId: { in: cicloIdsSec } }
            : classeId
              ? { classeId }
              : {}
          : classeId
            ? { classeId }
            : {}),
      },
    });

    let disciplinasConcluidas = historicoAcademico.filter(
      (h) => h.situacaoAcademica === 'APROVADO'
    ).length;

    let cargaHorariaTotal = historicoAcademico.reduce((sum, h) => sum + h.cargaHoraria, 0);

    const frequencias = historicoAcademico.map((h) => Number(h.percentualFrequencia));
    const frequenciaMedia =
      frequencias.length > 0
        ? frequencias.reduce((sum, f) => sum + f, 0) / frequencias.length
        : null;

    const medias = historicoAcademico
      .map((h) => Number(h.mediaFinal))
      .filter((m) => !isNaN(m) && m > 0);
    let mediaGeral =
      medias.length > 0 ? medias.reduce((sum, m) => sum + m, 0) / medias.length : null;

    if (tipoAcademico === 'SECUNDARIO') {
      try {
        const pauta = await calcularPautaConclusaoCicloSecundario({
          alunoId,
          instituicaoId,
          tipoAcademico: 'SECUNDARIO',
        });
        if (pauta.mediaFinalCurso != null) {
          mediaGeral = pauta.mediaFinalCurso;
        }
        disciplinasConcluidas = pauta.disciplinas.filter((d) => d.aprovadoDisciplina).length;
        const chMap = new Map<string, number>();
        for (const h of historicoAcademico) {
          if (h.situacaoAcademica !== 'APROVADO') continue;
          chMap.set(h.disciplinaId, Math.max(chMap.get(h.disciplinaId) ?? 0, Number(h.cargaHoraria) || 0));
        }
        cargaHorariaTotal = [...chMap.values()].reduce((sum, ch) => sum + ch, 0);
      } catch {
        /* mantém valores do histórico em bruto */
      }
    }

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
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ACADEMICO,
      acao: 'CREATE',
      entidade: EntidadeAuditoria.CONCLUSAO_CURSO,
      entidadeId: conclusao.id,
      dadosNovos: {
        alunoId,
        cursoId: cursoId || null,
        classeId: classeId || null,
        tipoConclusao: conclusao.tipoConclusao,
      },
      instituicaoId,
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
    const { numeroAto, observacoes, notaTfc, notaDefesa, dataTfc, dataDefesa } = req.body;

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

    const regConcl = await verificarRegistoAcademicoMinimo(conclusao.alunoId, instituicaoId);
    if (!regConcl.ok) {
      throw new AppError(regConcl.mensagem ?? 'Sem registo académico mínimo para concluir.', 400);
    }

    const dataUpdate: any = {
      status: 'CONCLUIDO',
      concluidoPor: userId,
      concluidoEm: new Date(),
      numeroAto: numeroAto || null,
      observacoes: observacoes || conclusao.observacoes,
    };
    if (notaTfc != null && !isNaN(Number(notaTfc))) dataUpdate.notaTfc = Number(notaTfc);
    if (notaDefesa != null && !isNaN(Number(notaDefesa))) dataUpdate.notaDefesa = Number(notaDefesa);
    if (dataTfc) dataUpdate.dataTfc = new Date(dataTfc);
    if (dataDefesa) dataUpdate.dataDefesa = new Date(dataDefesa);

    const conclusaoAtualizada = await prisma.conclusaoCurso.update({
      where: { id },
      data: dataUpdate,
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
    // REGRA institucional: Histórico acadêmico torna-se IMUTÁVEL após conclusão
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
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ACADEMICO,
      acao: 'UPDATE',
      entidade: EntidadeAuditoria.CONCLUSAO_CURSO,
      entidadeId: id,
      dadosNovos: {
        numeroAto: numeroAto || null,
      },
      instituicaoId,
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

    // Multi-tenant + isolamento: colação é fluxo de Ensino Superior (nunca instituição só Secundário)
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    if (instituicao?.tipoAcademico === 'SECUNDARIO') {
      throw new AppError(
        'Colação de grau não se aplica a instituições de Ensino Secundário.',
        400
      );
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

    if (!conclusao.cursoId) {
      throw new AppError(
        'Colação de grau exige conclusão vinculada a um curso (Ensino Superior). Não utilize este registo para conclusão só por classe.',
        400
      );
    }

    const regCol = await verificarRegistoAcademicoMinimo(conclusao.alunoId, instituicaoId);
    if (!regCol.ok) {
      throw new AppError(regCol.mensagem ?? 'Sem registo académico mínimo para registar colação.', 400);
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
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ACADEMICO,
      acao: 'CREATE',
      entidade: EntidadeAuditoria.COLACAO_GRAU,
      entidadeId: colacao.id,
      dadosNovos: {
        conclusaoCursoId: id,
        dataColacao: colacao.dataColacao,
      },
      instituicaoId,
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

    // Multi-tenant + isolamento: certificado modelo secundário — não em instituição só Superior
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    if (instituicao?.tipoAcademico === 'SUPERIOR') {
      throw new AppError(
        'Certificado de habilitações (secundário) não se aplica a instituições de Ensino Superior.',
        400
      );
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

    if (!conclusao.classeId) {
      throw new AppError(
        'Certificado de conclusão (secundário) exige conclusão vinculada a uma classe.',
        400
      );
    }

    // Verificar se já existe certificado
    const existing = await prisma.certificado.findFirst({
      where: {
        conclusaoCursoId: id,
      },
    });

    if (existing) {
      throw new AppError('Já existe um certificado registrado para esta conclusão. Não é possível emitir outro.', 400);
    }

    if (!numeroCertificado) {
      throw new AppError('numeroCertificado é obrigatório', 400);
    }

    const regCert = await verificarRegistoAcademicoMinimo(conclusao.alunoId, instituicaoId);
    if (!regCert.ok) {
      throw new AppError(regCert.mensagem ?? 'Sem registo académico mínimo para emitir certificado.', 400);
    }

    // Verificar se número de certificado já existe
    const numeroExistente = await prisma.certificado.findFirst({
      where: {
        numeroCertificado,
        instituicaoId,
      },
    });

    if (numeroExistente) {
      throw new AppError('Este número de certificado já está em uso. Utilize um número diferente.', 400);
    }

    const { gerarCodigoVerificacaoCertificadoUnico } = await import(
      '../services/certificadoConclusaoVerificacao.service.js'
    );
    const codigoVerificacao = await gerarCodigoVerificacaoCertificadoUnico();

    const certificado = await prisma.certificado.create({
      data: {
        conclusaoCursoId: id,
        instituicaoId,
        numeroCertificado,
        codigoVerificacao,
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
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ACADEMICO,
      acao: 'CREATE',
      entidade: EntidadeAuditoria.CERTIFICADO,
      entidadeId: certificado.id,
      dadosNovos: {
        conclusaoCursoId: id,
        numeroCertificado,
      },
      instituicaoId,
    });

    res.status(201).json(certificado);
  } catch (error) {
    next(error);
  }
};

/**
 * PDF do certificado de conclusão (Ensino Secundário), após registo do certificado.
 * GET /conclusoes-cursos/:id/certificado/pdf
 */
export const downloadCertificadoConclusaoPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const { buffer, numeroCertificado } = await gerarCertificadoConclusaoPdfPorConclusaoId(id, instituicaoId);
    const safeName = numeroCertificado.replace(/[^\w.-]+/g, '_').slice(0, 80);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificado-${safeName || 'conclusao'}.pdf"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * PDF certificado de conclusão — Ensino Superior (após colação de grau). GET .../:id/certificado-superior/pdf
 */
export const downloadCertificadoConclusaoSuperiorPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const { buffer, refDocumento } = await gerarCertificadoConclusaoSuperiorPdfPorConclusaoId(id, instituicaoId);
    const safeName = refDocumento.replace(/[^\w.-]+/g, '_').slice(0, 80);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="certificado-superior-${safeName || 'conclusao'}.pdf"`
    );
    res.send(buffer);
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
 * Conclusões nunca devem ser atualizadas após criação (padrão institucional)
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

  // REGRA institucional: Conclusões são IMUTÁVEIS após criação
  // Apenas o status pode ser alterado via endpoint específico /concluir
  throw new AppError(
    'Conclusões de curso não podem ser atualizadas diretamente. O registro oficial é imutável conforme padrão institucional. Use o endpoint específico /conclusoes-cursos/:id/concluir para concluir oficialmente após validação.',
    403
  );
};

/**
 * Bloquear DELETE de conclusão - REGISTRO OFICIAL IMUTÁVEL
 * Conclusões nunca devem ser deletadas (padrão institucional)
 * DELETE /conclusoes-cursos/:id
 */
export const deleteConclusao = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Conclusões de curso não podem ser deletadas. O registro oficial é imutável conforme padrão institucional. O histórico acadêmico após conclusão é definitivo e não pode ser alterado.',
    403
  );
};

/**
 * GET /conclusoes-cursos/verificar-certificado?codigo=
 * Público — valida código do certificado de conclusão (Ensino Secundário) sem expor dados completos.
 */
export const verificarCertificadoConclusaoPublico = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { codigo } = req.query;
    const raw = typeof codigo === 'string' ? codigo : '';
    const { verificarCertificadoConclusaoPorCodigo } = await import(
      '../services/certificadoConclusaoVerificacao.service.js'
    );
    const resultado = await verificarCertificadoConclusaoPorCodigo(raw);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

