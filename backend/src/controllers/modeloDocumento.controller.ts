/**
 * CRUD de Modelos de Documentos oficiais (certificados, declarações, pautas).
 * Permite importar modelos HTML do governo e vinculá-los por instituição/tipo/curso.
 * Multi-tenant: instituicaoId do JWT.
 */
import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../middlewares/auth.js';

const TIPOS_VALIDOS = ['CERTIFICADO', 'DECLARACAO_MATRICULA', 'DECLARACAO_FREQUENCIA', 'BOLETIM', 'MINI_PAUTA', 'PAUTA_CONCLUSAO', 'RELATORIO', 'DOCUMENTO_OFICIAL'] as const;
const TIPOS_ACADEMICOS_VALIDOS = ['SUPERIOR', 'SECUNDARIO'] as const;

/** GET /configuracoes-instituicao/modelos-documento - Listar modelos da instituição */
export const listar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) {
      throw new AppError('Token inválido: ID de instituição inválido.', 401);
    }

    const { tipo, tipoAcademico } = req.query;
    const where: any = { instituicaoId: instituicaoId.trim() };
    if (tipo && typeof tipo === 'string' && TIPOS_VALIDOS.includes(tipo as any)) {
      where.tipo = tipo;
    }
    if (tipoAcademico && typeof tipoAcademico === 'string' && TIPOS_ACADEMICOS_VALIDOS.includes(tipoAcademico as any)) {
      where.tipoAcademico = tipoAcademico;
    }

    const modelos = await prisma.modeloDocumento.findMany({
      where,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        templateMappings: { select: { id: true, campoTemplate: true, campoSistema: true } },
      },
      orderBy: [{ tipo: 'asc' }, { tipoAcademico: 'asc' }, { updatedAt: 'desc' }],
    });

    res.json(modelos);
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento - Criar modelo */
export const criar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) {
      throw new AppError('Token inválido: ID de instituição inválido.', 401);
    }

    const { tipo, tipoAcademico, cursoId, nome, descricao, htmlTemplate, formatoDocumento, excelTemplateBase64, docxTemplateBase64, templatePlaceholdersJson, ativo } = req.body || {};

    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      throw new AppError(`tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}`, 400);
    }
    if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
      throw new AppError('nome é obrigatório', 400);
    }
    const isBoletim = tipo === 'BOLETIM';
    const isDocx = docxTemplateBase64 && typeof docxTemplateBase64 === 'string' && docxTemplateBase64.trim().length > 0;
    if (isBoletim) {
      if (!excelTemplateBase64 || typeof excelTemplateBase64 !== 'string' || excelTemplateBase64.trim().length === 0) {
        throw new AppError('Para Boletim, envie o modelo Excel (excelTemplateBase64)', 400);
      }
    } else if (!isDocx) {
      if (!htmlTemplate || typeof htmlTemplate !== 'string' || htmlTemplate.trim().length === 0) {
        throw new AppError('htmlTemplate é obrigatório para certificados e declarações (ou envie docxTemplateBase64 para DOCX)', 400);
      }
    }

    const tipoAcad = tipoAcademico && TIPOS_ACADEMICOS_VALIDOS.includes(tipoAcademico) ? tipoAcademico : null;

    if (cursoId) {
      const curso = await prisma.curso.findFirst({
        where: { id: cursoId, instituicaoId: instituicaoId.trim() },
      });
      if (!curso) {
        throw new AppError('Curso não encontrado ou não pertence à instituição', 404);
      }
    }

    const createData: any = {
      instituicaoId: instituicaoId.trim(),
      tipo,
      tipoAcademico: tipoAcad,
      cursoId: cursoId && typeof cursoId === 'string' ? cursoId : null,
      nome: nome.trim(),
      descricao: descricao && typeof descricao === 'string' ? descricao.trim() : null,
      htmlTemplate: isBoletim || isDocx ? '' : (htmlTemplate?.trim() || ''),
      formatoDocumento: formatoDocumento && typeof formatoDocumento === 'string' ? formatoDocumento : (isBoletim ? 'EXCEL' : isDocx ? 'WORD' : null),
      excelTemplateBase64: isBoletim && excelTemplateBase64 ? excelTemplateBase64 : null,
      docxTemplateBase64: isDocx ? docxTemplateBase64 : null,
      templatePlaceholdersJson: templatePlaceholdersJson && typeof templatePlaceholdersJson === 'string' ? templatePlaceholdersJson : null,
      ativo: ativo !== false,
    };

    const modelo = await prisma.modeloDocumento.create({
      data: createData,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
      },
    });

    res.status(201).json(modelo);
  } catch (error) {
    next(error);
  }
};

/** PUT /configuracoes-instituicao/modelos-documento/:id - Atualizar modelo */
export const atualizar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    if (!instituicaoId?.trim() || !id) {
      throw new AppError('Token ou ID inválido', 401);
    }

    const existing = await prisma.modeloDocumento.findFirst({
      where: { id, instituicaoId: instituicaoId.trim() },
    });
    if (!existing) {
      throw new AppError('Modelo não encontrado', 404);
    }

    const { tipo, tipoAcademico, cursoId, nome, descricao, htmlTemplate, formatoDocumento, excelTemplateBase64, docxTemplateBase64, templatePlaceholdersJson, ativo } = req.body || {};

    const updateData: any = {};
    if (tipo !== undefined) {
      if (!TIPOS_VALIDOS.includes(tipo)) {
        throw new AppError(`tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}`, 400);
      }
      updateData.tipo = tipo;
    }
    if (tipoAcademico !== undefined) {
      updateData.tipoAcademico = tipoAcademico && TIPOS_ACADEMICOS_VALIDOS.includes(tipoAcademico) ? tipoAcademico : null;
    }
    if (cursoId !== undefined) {
      if (cursoId) {
        const curso = await prisma.curso.findFirst({
          where: { id: cursoId, instituicaoId: instituicaoId.trim() },
        });
        if (!curso) {
          throw new AppError('Curso não encontrado ou não pertence à instituição', 404);
        }
        updateData.cursoId = cursoId;
      } else {
        updateData.cursoId = null;
      }
    }
    if (nome !== undefined) {
      if (typeof nome !== 'string' || nome.trim().length === 0) {
        throw new AppError('nome não pode ser vazio', 400);
      }
      updateData.nome = nome.trim();
    }
    if (descricao !== undefined) {
      updateData.descricao = descricao && typeof descricao === 'string' ? descricao.trim() : null;
    }
    if (htmlTemplate !== undefined) {
      const tipoAtual = updateData.tipo ?? existing.tipo;
      const isBoletim = tipoAtual === 'BOLETIM';
      const isDocx = docxTemplateBase64 || existing.docxTemplateBase64;
      if (!isBoletim && !isDocx && (typeof htmlTemplate !== 'string' || htmlTemplate.trim().length === 0)) {
        throw new AppError('htmlTemplate não pode ser vazio', 400);
      }
      updateData.htmlTemplate = isBoletim || isDocx ? '' : (htmlTemplate?.trim() ?? '');
    }
    if (docxTemplateBase64 !== undefined) {
      updateData.docxTemplateBase64 = docxTemplateBase64 && typeof docxTemplateBase64 === 'string' ? docxTemplateBase64 : null;
    }
    if (templatePlaceholdersJson !== undefined) {
      updateData.templatePlaceholdersJson = templatePlaceholdersJson && typeof templatePlaceholdersJson === 'string' ? templatePlaceholdersJson : null;
    }
    if (formatoDocumento !== undefined) {
      updateData.formatoDocumento = typeof formatoDocumento === 'string' ? formatoDocumento : null;
    }
    if (excelTemplateBase64 !== undefined) {
      const tipoAtual = updateData.tipo ?? existing.tipo;
      updateData.excelTemplateBase64 = tipoAtual === 'BOLETIM' && excelTemplateBase64 ? excelTemplateBase64 : null;
    }
    if (docxTemplateBase64 !== undefined) {
      updateData.docxTemplateBase64 = docxTemplateBase64 && typeof docxTemplateBase64 === 'string' ? docxTemplateBase64 : null;
    }
    if (templatePlaceholdersJson !== undefined) {
      updateData.templatePlaceholdersJson = templatePlaceholdersJson && typeof templatePlaceholdersJson === 'string' ? templatePlaceholdersJson : null;
    }
    if (ativo !== undefined) {
      updateData.ativo = Boolean(ativo);
    }

    const modelo = await prisma.modeloDocumento.update({
      where: { id },
      data: updateData,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
      },
    });

    res.json(modelo);
  } catch (error) {
    next(error);
  }
};

/** DELETE /configuracoes-instituicao/modelos-documento/:id - Remover modelo */
export const remover = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    if (!instituicaoId?.trim() || !id) {
      throw new AppError('Token ou ID inválido', 401);
    }

    const existing = await prisma.modeloDocumento.findFirst({
      where: { id, instituicaoId: instituicaoId.trim() },
    });
    if (!existing) {
      throw new AppError('Modelo não encontrado', 404);
    }

    await prisma.modeloDocumento.delete({ where: { id } });
    res.json({ message: 'Modelo removido com sucesso' });
  } catch (error) {
    next(error);
  }
};

/** GET /configuracoes-instituicao/modelos-documento/placeholders - Listar placeholders suportados */
export const listarPlaceholders = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const placeholders = [
      { chave: 'NOME_ALUNO', descricao: 'Nome completo do estudante' },
      { chave: 'BI', descricao: 'Bilhete de identidade' },
      { chave: 'NUMERO_ESTUDANTE', descricao: 'Número de estudante' },
      { chave: 'CURSO', descricao: 'Nome do curso' },
      { chave: 'CLASSE', descricao: 'Classe (Ensino Secundário)' },
      { chave: 'TURMA', descricao: 'Turma' },
      { chave: 'ANO_LETIVO', descricao: 'Ano letivo' },
      { chave: 'N_DOCUMENTO', descricao: 'Número do documento' },
      { chave: 'CODIGO_VERIFICACAO', descricao: 'Código de verificação' },
      { chave: 'NOME_INSTITUICAO', descricao: 'Nome da instituição' },
      { chave: 'LOCALIDADE', descricao: 'Localidade' },
      { chave: 'DATA_EMISSAO', descricao: 'Data de emissão' },
      { chave: 'LOGO_IMG', descricao: 'Tag HTML do logo (img)' },
      { chave: 'IMAGEM_FUNDO_URL', descricao: 'URL da imagem de fundo (use em style="background-image: url({{IMAGEM_FUNDO_URL}})")' },
      { chave: 'MINISTERIO_SUPERIOR', descricao: 'Ministério (Ensino Superior)' },
      { chave: 'DECRETO_CRIACAO', descricao: 'Decreto de criação' },
      { chave: 'NOME_CHEFE_DAA', descricao: 'Nome do Chefe do DAA' },
      { chave: 'NOME_DIRECTOR_GERAL', descricao: 'Nome do Director Geral' },
      { chave: 'LOCALIDADE_CERTIFICADO', descricao: 'Localidade do certificado' },
      { chave: 'CARGO_ASSINATURA_1', descricao: 'Cargo da assinatura 1' },
      { chave: 'CARGO_ASSINATURA_2', descricao: 'Cargo da assinatura 2' },
      { chave: 'TEXTO_FECHO_CERTIFICADO', descricao: 'Texto de fecho' },
      { chave: 'TEXTO_RODAPE_CERTIFICADO', descricao: 'Texto de rodapé' },
      { chave: 'REPUBLICA_ANGOLA', descricao: 'República de Angola (Secundário)' },
      { chave: 'GOVERNO_PROVINCIA', descricao: 'Governo da Província (Secundário)' },
      { chave: 'ESCOLA_NOME_NUMERO', descricao: 'Nome e número da escola (Secundário)' },
      { chave: 'ENSINO_GERAL', descricao: 'Ensino Geral (Secundário)' },
      { chave: 'TITULO_CERTIFICADO_SECUNDARIO', descricao: 'Título do certificado (Secundário)' },
      { chave: 'TEXTO_FECHO_CERTIFICADO_SECUNDARIO', descricao: 'Texto de fecho (Secundário)' },
      { chave: 'CARGO_ASSINATURA_1_SECUNDARIO', descricao: 'Cargo assinatura 1 (Secundário)' },
      { chave: 'CARGO_ASSINATURA_2_SECUNDARIO', descricao: 'Cargo assinatura 2 (Secundário)' },
      { chave: 'NOME_ASSINATURA_1_SECUNDARIO', descricao: 'Nome assinatura 1 (Secundário)' },
      { chave: 'NOME_ASSINATURA_2_SECUNDARIO', descricao: 'Nome assinatura 2 (Secundário)' },
      { chave: 'LABEL_RESULTADO_FINAL_SECUNDARIO', descricao: 'Label resultado final (Secundário)' },
      // Mini Pauta
      { chave: 'TABELA_ALUNOS', descricao: 'Linhas HTML da tabela de alunos (Mini Pauta)' },
      { chave: 'LABEL_CURSO_CLASSE', descricao: 'Label Curso ou Classe (Mini Pauta)' },
      { chave: 'VALOR_CURSO_CLASSE', descricao: 'Nome do curso ou classe (Mini Pauta)' },
      { chave: 'DISCIPLINA', descricao: 'Nome da disciplina (Mini Pauta)' },
      { chave: 'PROFESSOR', descricao: 'Nome do professor (Mini Pauta)' },
      { chave: 'TIPO_PAUTA', descricao: 'PROVISÓRIA ou DEFINITIVA (Mini Pauta)' },
      { chave: 'TOTAL_ESTUDANTES', descricao: 'Total de estudantes (Mini Pauta)' },
    ];
    res.json(placeholders);
  } catch (error) {
    next(error);
  }
};
