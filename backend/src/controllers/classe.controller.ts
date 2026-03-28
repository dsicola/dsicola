import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import {
  contarClassesActivasPorCurso,
  validarNaoExcedeDuracaoCicloCurso,
} from '../services/cursoCicloSecundarioValidation.service.js';
import {
  gerarClassesCicloCursoSecundario,
  obterClasseModeloInstituicao,
  previsualizarGeracaoCicloCursoSecundario,
  type SnapshotClasseModelo,
} from '../services/gerarClassesCicloCurso.service.js';

function assertGeracaoCicloSecundario(req: Request): string {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }
  if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
    throw new AppError('Não é permitido alterar a instituição.', 400);
  }
  const instituicaoId = req.user.instituicaoId;
  if (!instituicaoId) {
    throw new AppError('Usuário não possui instituição vinculada', 400);
  }
  if (req.user.tipoAcademico === 'SUPERIOR') {
    throw new AppError('Geração de classes só aplica-se ao Ensino Secundário', 400);
  }
  return instituicaoId;
}

async function resolverEntradaGerarCicloCurso(
  instituicaoId: string,
  req: Request,
  cursoId: string
): Promise<{
  valorMensalidadePadrao: number;
  anoInicialPercurso: number | null;
  modelo: SnapshotClasseModelo | null;
}> {
  const body = req.body || {};
  const { valorMensalidadePadrao, anoInicialPercurso, classeModeloId } = body;

  let modelo: SnapshotClasseModelo | null = null;
  if (classeModeloId != null && classeModeloId !== '') {
    if (typeof classeModeloId !== 'string') {
      throw new AppError('classeModeloId inválido', 400);
    }
    modelo = await obterClasseModeloInstituicao(instituicaoId, classeModeloId.trim());
  }

  let valor = Number(valorMensalidadePadrao);
  if (!Number.isFinite(valor) || valor <= 0) {
    if (modelo && Number(modelo.valorMensalidade) > 0) {
      valor = Number(modelo.valorMensalidade);
    } else {
      const ref = await prisma.classe.findFirst({
        where: {
          instituicaoId,
          cursoId: String(cursoId),
          ativo: true,
        },
        orderBy: { updatedAt: 'desc' },
        select: { valorMensalidade: true },
      });
      const refVal = ref ? Number(ref.valorMensalidade) : 0;
      if (refVal > 0) {
        valor = refVal;
      } else {
        throw new AppError(
          'Informe valorMensalidadePadrao (maior que zero), escolha uma classe modelo com mensalidade ou crie uma classe neste curso.',
          400
        );
      }
    }
  }

  let anoIni: number | null = null;
  if (anoInicialPercurso !== undefined && anoInicialPercurso !== null && anoInicialPercurso !== '') {
    const n = Number(anoInicialPercurso);
    if (!Number.isInteger(n)) {
      throw new AppError('anoInicialPercurso deve ser um número inteiro ou vazio', 400);
    }
    anoIni = n;
  }

  return { valorMensalidadePadrao: valor, anoInicialPercurso: anoIni, modelo };
}

/**
 * GET /classes
 * Lista todas as classes da instituição (apenas Ensino Secundário)
 */
export const getClasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      // Para Ensino Superior, retornar array vazio (não deve usar classes)
      return res.json([]);
    }

    const where: any = { ...filter };

    const classes = await prisma.classe.findMany({
      where,
      include: {
        instituicao: { select: { id: true, nome: true } },
        _count: { select: { turmas: true } }
      },
      orderBy: { nome: 'asc' }
    });

    res.json(classes);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /classes/:id
 * Obtém uma classe específica
 */
export const getClasseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Classes não são permitidas no Ensino Superior', 403);
    }

    const classe = await prisma.classe.findFirst({
      where: { id, ...filter },
      include: {
        instituicao: true,
        turmas: true
      }
    });

    if (!classe) {
      throw new AppError('Classe não encontrada', 404);
    }

    res.json(classe);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /classes
 * Cria uma nova classe (apenas Ensino Secundário)
 */
export const createClasse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    // Multi-tenant: SEMPRE usar instituicaoId do usuário autenticado, nunca do body
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    const {
      nome,
      codigo,
      cargaHoraria,
      valorMensalidade,
      taxaMatricula,
      descricao,
      valorBata,
      exigeBata,
      valorPasse,
      exigePasse,
      valorEmissaoDeclaracao,
      valorEmissaoCertificado,
      ordem,
      cursoId,
    } = req.body;

    // Validar campos obrigatórios
    if (!nome || !codigo) {
      throw new AppError('Nome e código são obrigatórios', 400);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Classes não são permitidas no Ensino Superior. Use Cursos.', 400);
    }
    
    // VALIDAÇÃO: Ensino Secundário - valorMensalidade é OBRIGATÓRIO e deve ser > 0
    if (!valorMensalidade || Number(valorMensalidade) <= 0) {
      throw new AppError('Valor da mensalidade é obrigatório e deve ser maior que zero', 400);
    }

    // Verificar se já existe classe com mesmo código na instituição
    const existing = await prisma.classe.findFirst({
      where: {
        codigo,
        instituicaoId: req.user.instituicaoId
      }
    });

    if (existing) {
      throw new AppError('Já existe uma classe com este código', 409);
    }

    if (cursoId !== undefined && cursoId !== null && cursoId !== '') {
      const cursoOk = await prisma.curso.findFirst({
        where: { id: String(cursoId), instituicaoId: req.user.instituicaoId },
      });
      if (!cursoOk) {
        throw new AppError('Curso inválido para esta instituição', 400);
      }
    }

    const classeData: any = {
      nome,
      codigo,
      instituicaoId: req.user.instituicaoId,
      ativo: true,
      cargaHoraria: cargaHoraria ? Number(cargaHoraria) : 0,
      valorMensalidade: valorMensalidade ? Number(valorMensalidade) : 0,
    };

    if (taxaMatricula !== undefined && taxaMatricula !== null && taxaMatricula !== '') {
      const val = Number(taxaMatricula);
      classeData.taxaMatricula = val >= 0 ? val : 0;
    }

    // Itens obrigatórios e taxas específicas por classe
    if (valorBata !== undefined && valorBata !== null && valorBata !== '') {
      const val = Number(valorBata);
      classeData.valorBata = val >= 0 ? val : null;
    }
    if (exigeBata !== undefined) classeData.exigeBata = Boolean(exigeBata);
    if (valorPasse !== undefined && valorPasse !== null && valorPasse !== '') {
      const val = Number(valorPasse);
      classeData.valorPasse = val >= 0 ? val : null;
    }
    if (exigePasse !== undefined) classeData.exigePasse = Boolean(exigePasse);
    if (valorEmissaoDeclaracao !== undefined && valorEmissaoDeclaracao !== null && valorEmissaoDeclaracao !== '') {
      const val = Number(valorEmissaoDeclaracao);
      classeData.valorEmissaoDeclaracao = val >= 0 ? val : null;
    }
    if (valorEmissaoCertificado !== undefined && valorEmissaoCertificado !== null && valorEmissaoCertificado !== '') {
      const val = Number(valorEmissaoCertificado);
      classeData.valorEmissaoCertificado = val >= 0 ? val : null;
    }

    // Adicionar campos opcionais apenas se definidos
    if (descricao !== undefined && descricao !== null && descricao !== '') {
      classeData.descricao = descricao;
    }

    if (cursoId !== undefined && cursoId !== null && cursoId !== '') {
      classeData.cursoId = String(cursoId);
    }

    if (ordem !== undefined && ordem !== null && ordem !== '') {
      const o = Number(ordem);
      if (!Number.isFinite(o) || o < 0 || o > 20) {
        throw new AppError('Ordem da classe deve ser um número entre 0 e 20 (sequência do percurso; 0 = não definido)', 400);
      }
      classeData.ordem = o;
    }

    if (classeData.cursoId && classeData.ativo !== false) {
      const n = await contarClassesActivasPorCurso(req.user.instituicaoId, classeData.cursoId);
      await validarNaoExcedeDuracaoCicloCurso(req.user.instituicaoId, classeData.cursoId, n + 1);
    }

    const classe = await prisma.classe.create({
      data: classeData
    });

    res.status(201).json(classe);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /classes/gerar-ciclo/preview
 * Pré-visualização (sem gravar): nomes, códigos e taxas que serão aplicadas.
 */
export const gerarClassesCicloCursoPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = assertGeracaoCicloSecundario(req);
    const { cursoId } = req.body;
    if (!cursoId || typeof cursoId !== 'string') {
      throw new AppError('cursoId é obrigatório', 400);
    }
    const ent = await resolverEntradaGerarCicloCurso(instituicaoId, req, String(cursoId));
    const out = await previsualizarGeracaoCicloCursoSecundario({
      instituicaoId,
      cursoId: String(cursoId),
      valorMensalidadePadrao: ent.valorMensalidadePadrao,
      anoInicialPercurso: ent.anoInicialPercurso,
      modelo: ent.modelo,
    });
    res.json(out);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /classes/gerar-ciclo
 * Ensino Secundário: gera classes em falta (ordem 1..duracaoCicloAnos) para o curso.
 */
export const gerarClassesCicloCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = assertGeracaoCicloSecundario(req);
    const { cursoId } = req.body;
    if (!cursoId || typeof cursoId !== 'string') {
      throw new AppError('cursoId é obrigatório', 400);
    }
    const ent = await resolverEntradaGerarCicloCurso(instituicaoId, req, String(cursoId));
    const out = await gerarClassesCicloCursoSecundario({
      instituicaoId,
      cursoId: String(cursoId),
      valorMensalidadePadrao: ent.valorMensalidadePadrao,
      anoInicialPercurso: ent.anoInicialPercurso,
      modelo: ent.modelo,
    });

    res.status(201).json(out);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /classes/:id
 * Atualiza uma classe existente
 */
export const updateClasse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.classe.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Classe não encontrada', 404);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Classes não são permitidas no Ensino Superior', 400);
    }

    const {
      nome,
      codigo,
      cargaHoraria,
      valorMensalidade,
      taxaMatricula,
      descricao,
      ativo,
      valorBata,
      exigeBata,
      valorPasse,
      exigePasse,
      valorEmissaoDeclaracao,
      valorEmissaoCertificado,
      ordem,
      cursoId,
    } = req.body;

    let resolvedNextCursoId: string | null | undefined;
    if (cursoId !== undefined) {
      if (cursoId === null || cursoId === '') {
        resolvedNextCursoId = null;
      } else {
        const cursoOk = await prisma.curso.findFirst({
          where: { id: String(cursoId), instituicaoId: req.user?.instituicaoId },
        });
        if (!cursoOk) {
          throw new AppError('Curso inválido para esta instituição', 400);
        }
        resolvedNextCursoId = String(cursoId);
      }
    }

    const nextCursoId =
      resolvedNextCursoId !== undefined ? resolvedNextCursoId : existing.cursoId;
    const nextAtivo = ativo !== undefined ? Boolean(ativo) : existing.ativo;

    if (nextAtivo && nextCursoId && req.user?.instituicaoId) {
      const n = await contarClassesActivasPorCurso(req.user.instituicaoId, nextCursoId);
      const jaContadaNesteCurso = existing.cursoId === nextCursoId && existing.ativo;
      const contagemPrevista = jaContadaNesteCurso ? n : n + 1;
      await validarNaoExcedeDuracaoCicloCurso(req.user.instituicaoId, nextCursoId, contagemPrevista);
    }

    // VALIDAÇÃO: Ensino Secundário - valorMensalidade é OBRIGATÓRIO e deve ser > 0
    if (valorMensalidade !== undefined && (!valorMensalidade || Number(valorMensalidade) <= 0)) {
      throw new AppError('Valor da mensalidade é obrigatório e deve ser maior que zero', 400);
    }

    // Verificar se código já existe em outra classe
    if (codigo && codigo !== existing.codigo) {
      const codigoExists = await prisma.classe.findFirst({
        where: {
          codigo,
          instituicaoId: req.user?.instituicaoId,
          id: { not: id }
        }
      });

      if (codigoExists) {
        throw new AppError('Já existe uma classe com este código', 409);
      }
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const updateData: any = {};

    if (cursoId !== undefined) {
      if (cursoId === null || cursoId === '') {
        updateData.cursoId = null;
      } else {
        updateData.cursoId = String(cursoId);
      }
    }

    if (nome !== undefined) updateData.nome = nome;
    if (codigo !== undefined) updateData.codigo = codigo;
    if (cargaHoraria !== undefined) updateData.cargaHoraria = Number(cargaHoraria);
    if (valorMensalidade !== undefined) updateData.valorMensalidade = Number(valorMensalidade);
    if (taxaMatricula !== undefined) updateData.taxaMatricula = taxaMatricula === null || taxaMatricula === '' ? null : Math.max(0, Number(taxaMatricula));
    if (valorBata !== undefined) updateData.valorBata = valorBata === null || valorBata === '' ? null : Math.max(0, Number(valorBata));
    if (exigeBata !== undefined) updateData.exigeBata = Boolean(exigeBata);
    if (valorPasse !== undefined) updateData.valorPasse = valorPasse === null || valorPasse === '' ? null : Math.max(0, Number(valorPasse));
    if (exigePasse !== undefined) updateData.exigePasse = Boolean(exigePasse);
    if (valorEmissaoDeclaracao !== undefined) updateData.valorEmissaoDeclaracao = valorEmissaoDeclaracao === null || valorEmissaoDeclaracao === '' ? null : Math.max(0, Number(valorEmissaoDeclaracao));
    if (valorEmissaoCertificado !== undefined) updateData.valorEmissaoCertificado = valorEmissaoCertificado === null || valorEmissaoCertificado === '' ? null : Math.max(0, Number(valorEmissaoCertificado));
    if (descricao !== undefined) updateData.descricao = descricao || null;
    if (ativo !== undefined) updateData.ativo = ativo;
    if (ordem !== undefined) {
      if (ordem === null || ordem === '') {
        updateData.ordem = 0;
      } else {
        const o = Number(ordem);
        if (!Number.isFinite(o) || o < 0 || o > 20) {
          throw new AppError('Ordem da classe deve ser um número entre 0 e 20 (sequência do percurso)', 400);
        }
        updateData.ordem = o;
      }
    }

    const classe = await prisma.classe.update({
      where: { id },
      data: updateData
    });

    res.json(classe);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /classes/:id
 * Remove uma classe (soft delete - marca como inativa)
 */
export const deleteClasse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.classe.findFirst({
      where: { id, ...filter },
      include: {
        _count: {
          select: {
            turmas: true,
            mensalidades: true
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Classe não encontrada', 404);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Classes não são permitidas no Ensino Superior', 400);
    }

    // Verificar se há relacionamentos
    if (existing._count.turmas > 0 || existing._count.mensalidades > 0) {
      // Soft delete - marcar como inativa
      await prisma.classe.update({
        where: { id },
        data: { ativo: false }
      });
    } else {
      // Hard delete se não há relacionamentos
      await prisma.classe.delete({
        where: { id }
      });
    }

    res.json({ message: 'Classe removida com sucesso' });
  } catch (error) {
    next(error);
  }
};

