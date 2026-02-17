import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from '../services/audit.service.js';

/**
 * GET /parametros-sistema/:instituicaoId
 * Buscar parâmetros do sistema da instituição
 */
export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ============================================
    // VALIDAÇÃO MULTI-TENANT (CRÍTICA)
    // ============================================
    // SEMPRE usar instituicaoId do token, nunca do params
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);
    
    // VALIDAÇÃO: Verificar se instituição existe (Instituicao não tem instituicaoId - usa id)
    const instituicao = await prisma.instituicao.findFirst({
      where: { id: instituicaoId },
      select: { 
        id: true, 
        tipoAcademico: true,
        nome: true,
      }
    });
    
    if (!instituicao) {
      throw new AppError('Instituição não encontrada ou não pertence à sua instituição', 404);
    }
    
    // Buscar parâmetros com filtro multi-tenant
    let parametros = await prisma.parametrosSistema.findFirst({
      where: { 
        instituicaoId,
        ...filter
      },
    });
    
    // Se não existe, retornar valores padrão (mas não criar ainda)
    if (!parametros) {
      // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
      // Fallback para instituicao?.tipoAcademico apenas se não estiver no JWT (compatibilidade)
      const tipoAcademico = req.user?.tipoAcademico || instituicao?.tipoAcademico || null;
      
      // Valores padrão baseados no tipo acadêmico
      const quantidadeSemestresPorAno = tipoAcademico === 'SUPERIOR' ? 2 : null;
      
      parametros = {
        id: '',
        instituicaoId,
        quantidadeSemestresPorAno,
        permitirReprovacaoDisciplina: true,
        permitirDependencia: true,
        permitirMatriculaForaPeriodo: false,
        bloquearMatriculaDivida: true,
        permitirTransferenciaTurma: true,
        permitirMatriculaSemDocumentos: false,
        tipoMedia: 'simples',
        permitirExameRecurso: false,
        percentualMinimoAprovacao: 10,
        perfisAlterarNotas: ['ADMIN', 'PROFESSOR'],
        perfisCancelarMatricula: ['ADMIN'],
        ativarLogsAcademicos: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    }
    
    // Buscar status de backup automático da instituição
    const backupSchedule = await prisma.backupSchedule.findFirst({
      where: { 
        instituicaoId,
        ativo: true,
        ...filter
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ativo: true,
        ultimoBackup: true,
        proximoBackup: true,
      }
    });
    
    const statusBackupAutomatico = backupSchedule?.ativo ? 'Ativo' : 'Inativo';
    
    // Montar resposta (parametros garantido após bloco acima)
    const params = parametros!;
    const response = {
      ...params,
      tenantId: instituicaoId,
      versaoSistema: 'DSICOLA v1.0',
      ambiente: process.env.NODE_ENV === 'production' ? 'Produção' : 'Homologação',
      ultimaAtualizacao: params.updatedAt,
      statusBackupAutomatico,
      proximoBackup: backupSchedule?.proximoBackup || null,
      ultimoBackup: backupSchedule?.ultimoBackup || null,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Limpa e valida dados de parâmetros para update parcial
 * @param data - Dados a serem sanitizados
 * @param tipoAcademico - Tipo acadêmico da instituição (SUPERIOR | SECUNDARIO | null)
 */
function sanitizeParametrosData(data: any, tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null): any {
  const cleaned: any = {};
  
  // Lista de campos válidos do schema ParametrosSistema
  const validFields = [
    'quantidadeSemestresPorAno',
    'permitirReprovacaoDisciplina',
    'permitirDependencia',
    'permitirMatriculaForaPeriodo',
    'bloquearMatriculaDivida',
    'permitirTransferenciaTurma',
    'permitirMatriculaSemDocumentos',
    'disciplinasNegativasPermitidas',
    'permitirOverrideMatriculaReprovado',
    'tipoMedia',
    'permitirExameRecurso',
    'percentualMinimoAprovacao',
    'perfisAlterarNotas',
    'perfisCancelarMatricula',
    'ativarLogsAcademicos',
    'toleranciaPercentualLimiteAlunos',
  ];
  
  // Verificar se há campos inválidos sendo enviados
  const invalidFields = Object.keys(data).filter(key => !validFields.includes(key));
  if (invalidFields.length > 0) {
    console.warn('[sanitizeParametrosData] Campos inválidos detectados (serão ignorados):', invalidFields);
  }
  
  // Valores válidos para enums
  const validTiposMedia = ['simples', 'ponderada'];
  const validPerfis = ['ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'];
  
  for (const field of validFields) {
    const value = data[field];
    
    // Ignorar undefined (campos não enviados)
    if (value === undefined) {
      continue;
    }
    
    // Validações específicas por campo
    if (value !== null && value !== undefined) {
      // Validação de número inteiro com validação condicional por tipoAcademico
      if (field === 'quantidadeSemestresPorAno' && value !== null) {
        // CRÍTICO: quantidadeSemestresPorAno é APENAS para Ensino Superior
        if (tipoAcademico === 'SECUNDARIO') {
          throw new AppError('Quantidade de semestres por ano não é válida para Ensino Secundário. Use trimestres.', 400);
        }
        
        const num = typeof value === 'string' ? parseInt(value, 10) : value;
        if (isNaN(num) || num < 1 || num > 12) {
          throw new AppError('Quantidade de semestres por ano deve ser um número entre 1 e 12', 400);
        }
        cleaned[field] = num;
        continue;
      }
      
      // Validação de boolean
      if (field.startsWith('permitir') || field.startsWith('bloquear') || field === 'ativarLogsAcademicos') {
        cleaned[field] = Boolean(value);
        continue;
      }
      
      // Validação de enum tipoMedia
      if (field === 'tipoMedia' && typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (!validTiposMedia.includes(trimmed)) {
          throw new AppError(`Tipo de média inválido. Valores permitidos: ${validTiposMedia.join(', ')}`, 400);
        }
        cleaned[field] = trimmed;
        continue;
      }
      
      // Validação de número decimal
      if (field === 'percentualMinimoAprovacao') {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num) || num < 0 || num > 20) {
          throw new AppError('Percentual mínimo de aprovação deve ser um número entre 0 e 20', 400);
        }
        cleaned[field] = num;
        continue;
      }

      // Disciplinas negativas permitidas para transitar (0 = aprovação direta)
      if (field === 'disciplinasNegativasPermitidas') {
        const num = typeof value === 'string' ? parseInt(value, 10) : value;
        if (value !== null && (isNaN(num) || num < 0 || num > 20)) {
          throw new AppError('Disciplinas negativas permitidas deve ser entre 0 e 20 (0 = aprovação direta)', 400);
        }
        cleaned[field] = value === null ? null : num;
        continue;
      }

      // Tolerância % acima do limite de alunos (0-100, 0=desativado)
      if (field === 'toleranciaPercentualLimiteAlunos') {
        const num = typeof value === 'string' ? parseInt(value, 10) : value;
        if (value !== null && (isNaN(num) || num < 0 || num > 100)) {
          throw new AppError('Tolerância percentual limite alunos deve ser entre 0 e 100 (0 desativa)', 400);
        }
        cleaned[field] = value === null ? null : num;
        continue;
      }
      
      // Validação de array de strings (perfis)
      if (field === 'perfisAlterarNotas' || field === 'perfisCancelarMatricula') {
        if (!Array.isArray(value)) {
          throw new AppError(`${field} deve ser um array de strings`, 400);
        }
        // Validar que todos os perfis são válidos
        const perfisInvalidos = value.filter(p => !validPerfis.includes(p));
        if (perfisInvalidos.length > 0) {
          throw new AppError(`Perfis inválidos: ${perfisInvalidos.join(', ')}. Valores permitidos: ${validPerfis.join(', ')}`, 400);
        }
        cleaned[field] = value;
        continue;
      }
    }
    
    // Para outros campos, passar o valor
    if (value !== undefined) {
      cleaned[field] = value;
    }
  }
  
  return cleaned;
}

/**
 * PUT /parametros-sistema/:instituicaoId
 * Atualizar parâmetros do sistema da instituição
 * Apenas ADMIN pode alterar
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ============================================
    // VALIDAÇÃO MULTI-TENANT (CRÍTICA)
    // ============================================
    // SEMPRE usar instituicaoId do token, nunca do params
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);
    
    // VALIDAÇÃO: Verificar se instituição existe (Instituicao não tem instituicaoId - usar apenas id)
    const instituicaoExists = await prisma.instituicao.findFirst({
      where: { id: instituicaoId },
      select: { id: true, tipoAcademico: true }
    });
    
    if (!instituicaoExists) {
      throw new AppError('Instituição não encontrada ou não pertence à sua instituição', 404);
    }
    
    // Buscar parâmetros atuais para auditoria
    const parametrosAnteriores = await prisma.parametrosSistema.findFirst({
      where: { 
        instituicaoId,
        ...filter
      },
    });
    
    // ============================================
    // LIMPEZA E VALIDAÇÃO DE DADOS
    // ============================================
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    // Fallback para instituicaoExists.tipoAcademico apenas se não estiver no JWT (compatibilidade)
    const tipoAcademico = req.user?.tipoAcademico || instituicaoExists.tipoAcademico || null;
    
    let dataToSave: any;
    
    try {
      // Passar tipoAcademico para validação condicional
      dataToSave = sanitizeParametrosData(req.body, tipoAcademico);
    } catch (sanitizeError: any) {
      if (sanitizeError instanceof AppError) {
        throw sanitizeError;
      }
      throw new AppError(`Dados inválidos: ${sanitizeError.message}`, 400);
    }
    
    // Se não há campos para atualizar, retornar parâmetros atuais
    if (Object.keys(dataToSave).length === 0) {
      const parametrosAtuais = parametrosAnteriores || await getParametrosPadrao(instituicaoId, instituicaoExists.tipoAcademico);
      return res.json(parametrosAtuais);
    }
    
    // Remover campos undefined (Prisma não aceita undefined)
    const prismaData: any = {};
    for (const [key, value] of Object.entries(dataToSave)) {
      if (value !== undefined) {
        prismaData[key] = value;
      }
    }
    
    // Garantir que quantidadeSemestresPorAno seja null para Ensino Secundário
    if (tipoAcademico === 'SECUNDARIO' && prismaData.quantidadeSemestresPorAno !== undefined) {
      prismaData.quantidadeSemestresPorAno = null;
    }
    
    const quantidadeSemestresPorAnoPadrao = tipoAcademico === 'SUPERIOR' ? 2 : null;
    
    // Garantir que campos obrigatórios tenham valores no create
    const createData = {
      instituicaoId,
      quantidadeSemestresPorAno: prismaData.quantidadeSemestresPorAno !== undefined ? prismaData.quantidadeSemestresPorAno : quantidadeSemestresPorAnoPadrao,
      permitirReprovacaoDisciplina: prismaData.permitirReprovacaoDisciplina !== undefined ? prismaData.permitirReprovacaoDisciplina : true,
      permitirDependencia: prismaData.permitirDependencia !== undefined ? prismaData.permitirDependencia : true,
      permitirMatriculaForaPeriodo: prismaData.permitirMatriculaForaPeriodo !== undefined ? prismaData.permitirMatriculaForaPeriodo : false,
      bloquearMatriculaDivida: prismaData.bloquearMatriculaDivida !== undefined ? prismaData.bloquearMatriculaDivida : true,
      permitirTransferenciaTurma: prismaData.permitirTransferenciaTurma !== undefined ? prismaData.permitirTransferenciaTurma : true,
      permitirMatriculaSemDocumentos: prismaData.permitirMatriculaSemDocumentos !== undefined ? prismaData.permitirMatriculaSemDocumentos : false,
      tipoMedia: prismaData.tipoMedia || 'simples',
      permitirExameRecurso: prismaData.permitirExameRecurso !== undefined ? prismaData.permitirExameRecurso : false,
      percentualMinimoAprovacao: prismaData.percentualMinimoAprovacao !== undefined ? prismaData.percentualMinimoAprovacao : 10,
      perfisAlterarNotas: prismaData.perfisAlterarNotas || ['ADMIN', 'PROFESSOR'],
      perfisCancelarMatricula: prismaData.perfisCancelarMatricula || ['ADMIN'],
      ativarLogsAcademicos: prismaData.ativarLogsAcademicos !== undefined ? prismaData.ativarLogsAcademicos : true,
      ...prismaData,
    };
    
    // ============================================
    // UPDATE NO PRISMA (UPSERT)
    // ============================================
    let parametros;
    try {
      parametros = await prisma.parametrosSistema.upsert({
        where: { instituicaoId },
        update: prismaData,
        create: createData,
      });
    } catch (prismaError: any) {
      console.error('[update] Erro do Prisma:', prismaError);
      if (prismaError instanceof Prisma.PrismaClientValidationError) {
        throw new AppError(`Os dados fornecidos não são válidos. Verifique os campos enviados e seus tipos.`, 400);
      }
      throw prismaError;
    }
    
    // ============================================
    // AUDITORIA
    // ============================================
    // Registrar alteração em log de auditoria
    if (parametrosAnteriores) {
      const camposAlterados = Object.keys(dataToSave);
      if (camposAlterados.length > 0) {
        await AuditService.log(req, {
          modulo: 'ADMINISTRATIVO',
          acao: 'UPDATE',
          entidade: 'PARAMETROS_SISTEMA',
          entidadeId: parametros.id,
          dadosAnteriores: parametrosAnteriores,
          dadosNovos: parametros,
          observacao: `Alteração de parâmetros do sistema: ${camposAlterados.join(', ')}`,
          instituicaoId,
        });
      }
    } else {
      // Criando pela primeira vez
      await AuditService.log(req, {
        modulo: 'ADMINISTRATIVO',
        acao: 'CREATE',
        entidade: 'PARAMETROS_SISTEMA',
        entidadeId: parametros.id,
        dadosNovos: parametros,
        observacao: 'Configuração inicial de parâmetros do sistema',
        instituicaoId,
      });
    }
    
    // Buscar status de backup automático da instituição
    const backupSchedule = await prisma.backupSchedule.findFirst({
      where: { 
        instituicaoId,
        ativo: true,
        ...filter
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ativo: true,
        ultimoBackup: true,
        proximoBackup: true,
      }
    });
    
    const statusBackupAutomatico = backupSchedule?.ativo ? 'Ativo' : 'Inativo';
    
    // Montar resposta (parametros garantido após bloco acima)
    const params = parametros!;
    const response = {
      ...params,
      tenantId: instituicaoId,
      versaoSistema: 'DSICOLA v1.0',
      ambiente: process.env.NODE_ENV === 'production' ? 'Produção' : 'Homologação',
      ultimaAtualizacao: params.updatedAt,
      statusBackupAutomatico,
      proximoBackup: backupSchedule?.proximoBackup || null,
      ultimoBackup: backupSchedule?.ultimoBackup || null,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper para obter parâmetros padrão
 */
async function getParametrosPadrao(instituicaoId: string, tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null): Promise<any> {
  const quantidadeSemestresPorAno = tipoAcademico === 'SUPERIOR' ? 2 : null;
  
  return {
    id: '',
    instituicaoId,
    quantidadeSemestresPorAno,
    permitirReprovacaoDisciplina: true,
    permitirDependencia: true,
    permitirMatriculaForaPeriodo: false,
    bloquearMatriculaDivida: true,
    permitirTransferenciaTurma: true,
    permitirMatriculaSemDocumentos: false,
    tipoMedia: 'simples',
    permitirExameRecurso: false,
    percentualMinimoAprovacao: 10,
    perfisAlterarNotas: ['ADMIN', 'PROFESSOR'],
    perfisCancelarMatricula: ['ADMIN'],
    ativarLogsAcademicos: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

