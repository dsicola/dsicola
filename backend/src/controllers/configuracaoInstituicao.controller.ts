import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { atualizarTipoAcademico } from '../services/instituicao.service.js';
import { getDefaultColorsByTipoAcademico } from '../utils/defaultColors.js';

// Regex para validar UUID v4
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida se o instituicaoId é um UUID válido (v4)
 * Retorna true se for válido, false caso contrário
 */
function isValidUUID(instituicaoId: string): boolean {
  if (!instituicaoId || typeof instituicaoId !== 'string') {
    return false;
  }
  return UUID_V4_REGEX.test(instituicaoId.trim());
}

/**
 * Helper function to get institution's tipoAcademico
 */
async function getTipoAcademico(instituicaoId: string | null): Promise<'SECUNDARIO' | 'SUPERIOR' | null> {
  if (!instituicaoId) return null;
  
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true }
  });
  
  return instituicao?.tipoAcademico || null;
}

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ============================================
    // VALIDAÇÃO MULTI-TENANT (CRÍTICA)
    // ============================================
    // SEMPRE usar instituicaoId do token, nunca do params/query/body
    // requireTenantScope já valida que o usuário tem instituicaoId do JWT
    let instituicaoId = requireTenantScope(req);
    
    // Validação extra: garantir que instituicaoId é um UUID válido antes de usar no Prisma
    // Isso previne erros do Prisma com UUIDs inválidos que possam ter passado
    // Se o token foi gerado antes das validações ou tem dados corrompidos, rejeitar com 401
    if (!instituicaoId || typeof instituicaoId !== 'string') {
      const errorDetails = {
        instituicaoId,
        tipo: typeof instituicaoId,
        userId: req.user?.userId,
        email: req.user?.email,
        route: `${req.method} ${req.path}`,
      };
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('[CONFIG_INSTITUICAO] ❌ InstituicaoId inválido no token:', errorDetails);
      }
      
      // Token inválido - retornar 401 para forçar re-login e obter token válido
      throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
    }

    // Garantir que o UUID está normalizado (trimmed)
    instituicaoId = instituicaoId.trim();
    
    // Validação UUID deve ser feita APÓS o trim, antes de qualquer chamada ao Prisma
    if (!isValidUUID(instituicaoId)) {
      const errorDetails = {
        instituicaoId,
        tipo: typeof instituicaoId,
        userId: req.user?.userId,
        email: req.user?.email,
        route: `${req.method} ${req.path}`,
      };
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('[CONFIG_INSTITUICAO] ❌ InstituicaoId não é um UUID válido:', errorDetails);
      }
      
      // Token inválido - retornar 401 para forçar re-login e obter token válido
      throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
    }
    
    const filter = addInstitutionFilter(req);
    
    // VALIDAÇÃO: Verificar se instituição existe e pertence ao usuário (multi-tenant)
    // IMPORTANTE: A tabela instituicoes não tem campo instituicaoId, apenas id
    // Por isso não usamos o filter aqui, apenas validamos que o id corresponde
    let instituicao;
    try {
      instituicao = await prisma.instituicao.findFirst({
        where: { 
          id: instituicaoId
        },
        select: { 
          id: true, 
          tipoAcademico: true,
          nome: true,
          logoUrl: true,
          emailContato: true,
          telefone: true,
          endereco: true,
        }
      });
    } catch (dbError: any) {
      // Capturar erros do Prisma relacionados a UUID inválido ou argumentos desconhecidos
      // Isso é um fallback caso a validação acima falhe por algum motivo
      if (dbError?.name === 'PrismaClientValidationError' || 
          dbError?.message?.includes('Invalid value for argument') ||
          dbError?.message?.includes('Invalid uuid') ||
          dbError?.message?.includes('Unknown argument')) {
        // Se o UUID do JWT for inválido ou houver argumento desconhecido, retornar 401 (não 500) para forçar re-login
        if (process.env.NODE_ENV !== 'production') {
          console.error('[CONFIG_INSTITUICAO] ❌ Erro do Prisma detectado:', {
            instituicaoId,
            userId: req.user?.userId,
            email: req.user?.email,
            error: dbError.message,
            errorName: dbError?.name,
          });
        }
        throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
      }
      throw dbError;
    }
    
    if (!instituicao) {
      throw new AppError('Instituição não encontrada ou não pertence à sua instituição', 404);
    }
    
    // Buscar configuração com filtro multi-tenant
    let configuracao = await prisma.configuracaoInstituicao.findFirst({
      where: { 
        instituicaoId,
        ...filter
      },
    });
    
    // tipoAcademico já foi buscado na validação multi-tenant acima
    const tipoAcademicoAtual = instituicao?.tipoAcademico || null;
    
    // Aplicar cores padrão dinamicamente baseadas no tipo acadêmico atual
    // Se não há configuração OU se há configuração mas sem cores personalizadas
    const temCoresPersonalizadas = configuracao?.corPrimaria && configuracao?.corSecundaria && configuracao?.corTerciaria;
    const defaultColors = getDefaultColorsByTipoAcademico(tipoAcademicoAtual);
    
    if (!configuracao) {
      // Return defaults if not found
      // instituicaoData já foi buscado na validação multi-tenant acima
      // Aplicar cores padrão baseadas no tipo acadêmico
      configuracao = {
        id: '',
        instituicaoId,
        nomeInstituicao: instituicao?.nome || 'DSICOLA',
        // tipoInstituicao e tipoAcademico não são salvos aqui - serão identificados automaticamente
        logoUrl: instituicao?.logoUrl || null,
        imagemCapaLoginUrl: null,
        faviconUrl: null,
        corPrimaria: defaultColors.corPrimaria,
        corSecundaria: defaultColors.corSecundaria,
        corTerciaria: defaultColors.corTerciaria,
        descricao: null,
        email: instituicao?.emailContato || null,
        telefone: instituicao?.telefone || null,
        endereco: instituicao?.endereco || null,
        tipoAcademico: tipoAcademicoAtual,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    } else {
      // Se há configuração mas não tem cores personalizadas, aplicar cores padrão dinamicamente
      if (!temCoresPersonalizadas) {
        configuracao.corPrimaria = defaultColors.corPrimaria;
        configuracao.corSecundaria = defaultColors.corSecundaria;
        configuracao.corTerciaria = defaultColors.corTerciaria;
      }
    }
    
    // Garantir que nomeInstituicao sempre use o nome da instituição quando não estiver configurado
    // Carregar automaticamente respeitando o tipo de instituição
    const nomeInstituicaoFinal = configuracao?.nomeInstituicao 
      || instituicao?.nome 
      || 'DSICOLA';
    
    // Incluir tipoAcademico na resposta (read-only) - sempre da tabela instituicoes (fonte mais confiável)
    // Garantir que retorna tanto camelCase quanto snake_case para compatibilidade
    const config = configuracao!;
    res.json({
      ...config,
      nomeInstituicao: nomeInstituicaoFinal,
      tipoAcademico: tipoAcademicoAtual,
      // Garantir compatibilidade: incluir snake_case se necessário
      tipo_academico: tipoAcademicoAtual,
      favicon_url: config.faviconUrl,
      logo_url: config.logoUrl,
      imagem_capa_login_url: config.imagemCapaLoginUrl,
      nome_instituicao: nomeInstituicaoFinal,
      cor_primaria: config.corPrimaria,
      cor_secundaria: config.corSecundaria,
      cor_terciaria: config.corTerciaria,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Limpa e valida dados de configuração para update parcial
 * - Remove campos undefined
 * - Converte strings vazias em null
 * - Valida formatos quando presentes
 * - Garante que apenas campos válidos sejam passados
 */
function sanitizeConfiguracaoData(data: any): any {
  const cleaned: any = {};
  
  // Lista de campos válidos do schema ConfiguracaoInstituicao (campos que podem ser atualizados)
  const validFields = [
    'nomeInstituicao',
    'logoUrl',
    'imagemCapaLoginUrl',
    'faviconUrl',
    'corPrimaria',
    'corSecundaria',
    'corTerciaria',
    'descricao',
    'email',
    'telefone',
    'endereco',
    'pais',
    'moedaPadrao',
    'idioma',
    'nomeFiscal',
    'emailFiscal',
    'telefoneFiscal',
    'enderecoFiscal',
    'cidadeFiscal',
    'provinciaFiscal',
    'paisFiscal',
    'codigoPostalFiscal',
    'nif',
    'cnpj',
    'inscricaoEstadual',
    'codigoServicoFinancas',
    'identificacaoFiscalGenerica',
    'regimeFiscal',
    'serieDocumentos',
    'numeracaoAutomatica',
    'moedaFaturacao',
    'percentualImpostoPadrao',
    'taxaMatriculaPadrao',
    'mensalidadePadrao',
  ];
  
  // Verificar se há campos inválidos sendo enviados
  const invalidFields = Object.keys(data).filter(key => !validFields.includes(key));
  if (invalidFields.length > 0) {
    console.warn('[sanitizeConfiguracaoData] Campos inválidos detectados (serão ignorados):', invalidFields);
  }
  
  // Regex para validação
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const urlRegex = /^https?:\/\/.+/;
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  
  // Valores válidos para enums
  const validIdiomas = ['pt', 'pt-AO', 'pt-BR', 'pt-PT', 'en', 'es', 'fr'];
  const validMoedas = ['AOA', 'USD', 'EUR', 'BRL', 'MZN', 'CVE', 'XOF', 'STN'];
  const validRegimesFiscais = ['simplificado', 'normal', 'isento'];
  
  for (const field of validFields) {
    const value = data[field];
    
    // Ignorar undefined (campos não enviados)
    if (value === undefined) {
      continue;
    }
    
    // Converter strings vazias em null
    if (typeof value === 'string' && value.trim() === '') {
      cleaned[field] = null;
      continue;
    }
    
    // Validações específicas por campo
    if (value !== null) {
      // Validação de emails
      if ((field === 'email' || field === 'emailFiscal') && typeof value === 'string') {
        if (!emailRegex.test(value.trim())) {
          throw new AppError(`${field === 'email' ? 'Email' : 'Email fiscal'} inválido`, 400);
        }
        cleaned[field] = value.trim();
        continue;
      }
      
      // Validação de URLs (logo, capa, favicon)
      if ((field === 'logoUrl' || field === 'imagemCapaLoginUrl' || field === 'faviconUrl') && typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !urlRegex.test(trimmed)) {
          throw new AppError(`${field} deve ser uma URL válida (começar com http:// ou https://)`, 400);
        }
        cleaned[field] = trimmed || null;
        continue;
      }
      
      // Validação de cores hexadecimais
      if ((field === 'corPrimaria' || field === 'corSecundaria' || field === 'corTerciaria') && typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !hexColorRegex.test(trimmed)) {
          throw new AppError(`${field} deve ser uma cor hexadecimal válida (ex: #FF5733)`, 400);
        }
        cleaned[field] = trimmed || null;
        continue;
      }
      
      // Validação de enum idioma
      if (field === 'idioma' && typeof value === 'string') {
        const trimmed = value.trim();
        const isValid = validIdiomas.some(v => v.toLowerCase() === trimmed.toLowerCase());
        if (!isValid) {
          throw new AppError(`Idioma inválido. Valores permitidos: ${validIdiomas.join(', ')}`, 400);
        }
        cleaned[field] = trimmed;
        continue;
      }
      
      // Validação de enum moeda
      if ((field === 'moedaPadrao' || field === 'moedaFaturacao') && typeof value === 'string') {
        const trimmed = value.trim().toUpperCase();
        // Se string vazia, já foi convertida para null antes
        if (trimmed && !validMoedas.includes(trimmed)) {
          throw new AppError(`${field === 'moedaPadrao' ? 'Moeda padrão' : 'Moeda de faturação'} inválida. Valores permitidos: ${validMoedas.join(', ')}`, 400);
        }
        cleaned[field] = trimmed || null;
        continue;
      }
      
      // Validação de enum regime fiscal
      if (field === 'regimeFiscal' && typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (!validRegimesFiscais.includes(trimmed)) {
          throw new AppError(`Regime fiscal inválido. Valores permitidos: ${validRegimesFiscais.join(', ')}`, 400);
        }
        cleaned[field] = trimmed;
        continue;
      }
      
      // Validação de boolean
      if (field === 'numeracaoAutomatica') {
        // Garantir que seja sempre um boolean válido
        if (value === null || value === undefined) {
          // Se for null/undefined, usar valor padrão (true)
          cleaned[field] = true;
        } else {
          cleaned[field] = Boolean(value);
        }
        continue;
      }
      
      // Validação de número decimal
      if (field === 'percentualImpostoPadrao') {
        // Se value for string vazia, já foi tratado antes (converte para null)
        // Se value for number, validar diretamente
        if (typeof value === 'number') {
          if (isNaN(value) || value < 0 || value > 100) {
            throw new AppError('Percentual de imposto padrão deve ser um número entre 0 e 100', 400);
          }
          // Prisma aceita números JavaScript para Decimal, mas vamos garantir que seja um número válido
          cleaned[field] = value;
        } else if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed === '') {
            cleaned[field] = null;
          } else {
            const num = parseFloat(trimmed);
            if (isNaN(num) || num < 0 || num > 100) {
              throw new AppError('Percentual de imposto padrão deve ser um número entre 0 e 100', 400);
            }
            cleaned[field] = num;
          }
        } else if (value === null) {
          cleaned[field] = null;
        } else {
          throw new AppError('Percentual de imposto padrão deve ser um número válido', 400);
        }
        continue;
      }

      // Validação de valores monetários (taxa matrícula e mensalidade)
      if ((field === 'taxaMatriculaPadrao' || field === 'mensalidadePadrao')) {
        if (value === null || value === undefined) {
          cleaned[field] = null;
        } else {
          const num = typeof value === 'number' ? value : parseFloat(String(value));
          if (isNaN(num) || num < 0) {
            throw new AppError(`${field === 'taxaMatriculaPadrao' ? 'Taxa de matrícula' : 'Mensalidade'} padrão deve ser um número não negativo`, 400);
          }
          cleaned[field] = num;
        }
        continue;
      }
      }
    }
    
    // Para outros campos, apenas passar o valor (string, null, etc.)
    cleaned[field] = typeof value === 'string' ? value.trim() : value;
  }
  
  return cleaned;
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ============================================
    // VALIDAÇÃO MULTI-TENANT (CRÍTICA)
    // ============================================
    // SEMPRE usar instituicaoId do token, nunca do params
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);
    
    // ============================================
    // LOG DO REQ.BODY BRUTO (ANTES DE QUALQUER VALIDAÇÃO)
    // ============================================
    console.log('[update] ===== REQUEST BRUTO =====');
    console.log('[update] InstituicaoId do token:', instituicaoId);
    console.log('[update] Body RAW:', JSON.stringify(req.body, null, 2));
    console.log('[update] User:', {
      userId: req.user?.userId,
      email: req.user?.email,
      instituicaoId: req.user?.instituicaoId,
      roles: req.user?.roles
    });
    
    // VALIDAÇÃO: Verificar se instituição existe (Instituicao não tem instituicaoId - usar apenas id)
    const instituicaoExists = await prisma.instituicao.findFirst({
      where: { id: instituicaoId },
      select: { id: true, tipoAcademico: true }
    });
    
    if (!instituicaoExists) {
      throw new AppError('Instituição não encontrada ou não pertence à sua instituição', 404);
    }
    
    // Remover tipoInstituicao e tipoAcademico do data - não podem ser salvos manualmente
    const { tipoInstituicao, tipoAcademico, ...dataToSanitize } = req.body;
    
    // ============================================
    // LIMPEZA E VALIDAÇÃO DE DADOS
    // ============================================
    let dataToSave: any;
    
    try {
      dataToSave = sanitizeConfiguracaoData(dataToSanitize);
      console.log('[update] Dados limpos para update:', JSON.stringify(dataToSave, null, 2));
    } catch (sanitizeError: any) {
      console.error('[update] Erro ao sanitizar dados:', sanitizeError);
      console.error('[update] Stack trace:', sanitizeError.stack);
      // Se é AppError, repassar com mensagem melhorada
      if (sanitizeError instanceof AppError) {
        throw sanitizeError;
      }
      // Erro genérico de validação com mais detalhes
      const errorMessage = sanitizeError.message || 'Erro de validação desconhecido';
      throw new AppError(`Dados inválidos: ${errorMessage}`, 400);
    }
    
    // Se não há campos para atualizar, retornar configuração atual
    if (Object.keys(dataToSave).length === 0) {
      console.log('[update] Nenhum campo para atualizar, retornando configuração atual');
      const configuracaoAtual = await prisma.configuracaoInstituicao.findFirst({
        where: { instituicaoId, ...filter },
      });
      
      if (!configuracaoAtual) {
        throw new AppError('Configuração não encontrada ou não pertence à sua instituição', 404);
      }
      
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: instituicaoId },
        select: { tipoAcademico: true }
      });
      
      // Garantir que retorna tanto camelCase quanto snake_case para compatibilidade
      return res.json({
        ...configuracaoAtual,
        tipoAcademico: instituicao?.tipoAcademico || null,
        tipo_academico: instituicao?.tipoAcademico || null,
        favicon_url: configuracaoAtual.faviconUrl,
        logo_url: configuracaoAtual.logoUrl,
        imagem_capa_login_url: configuracaoAtual.imagemCapaLoginUrl,
        nome_instituicao: configuracaoAtual.nomeInstituicao,
        cor_primaria: configuracaoAtual.corPrimaria,
        cor_secundaria: configuracaoAtual.corSecundaria,
        cor_terciaria: configuracaoAtual.corTerciaria,
      });
    }
    
    // ============================================
    // FILTRAR UNDEFINED ANTES DO PRISMA.UPDATE
    // ============================================
    // Remover qualquer campo undefined (Prisma não aceita undefined)
    const prismaData: any = {};
    for (const [key, value] of Object.entries(dataToSave)) {
      if (value !== undefined) {
        prismaData[key] = value;
      }
    }
    
    console.log('[update] Dados para Prisma (sem undefined):', JSON.stringify(prismaData, null, 2));
    
    // ============================================
    // UPDATE NO PRISMA (APENAS CAMPOS PRESENTES)
    // ============================================
    let configuracao;
    try {
      // Garantir que campos obrigatórios tenham valores no create
      // (Prisma não aplica defaults automaticamente quando você passa um objeto)
      const createData = {
        instituicaoId,
        nomeInstituicao: prismaData.nomeInstituicao || 'DSICOLA', // Campo obrigatório
        tipoInstituicao: prismaData.tipoInstituicao || 'ENSINO_MEDIO', // Campo obrigatório
        numeracaoAutomatica: prismaData.numeracaoAutomatica !== undefined ? prismaData.numeracaoAutomatica : true, // Campo obrigatório
        ...prismaData,
      };
      
      configuracao = await prisma.configuracaoInstituicao.upsert({
        where: { instituicaoId },
        update: prismaData,
        create: createData,
      });
    } catch (prismaError: any) {
      console.error('[update] Erro do Prisma:', prismaError);
      console.error('[update] Dados que causaram o erro:', JSON.stringify(prismaData, null, 2));
      // Se for erro de validação do Prisma, fornecer mensagem mais clara
      if (prismaError instanceof Prisma.PrismaClientValidationError) {
        const errorMessage = prismaError.message || 'Erro de validação do Prisma';
        console.error('[update] Mensagem completa do Prisma:', errorMessage);
        throw new AppError(`Os dados fornecidos não são válidos. Verifique os campos enviados e seus tipos. Detalhes: ${errorMessage}`, 400);
      }
      // Repassar outros erros do Prisma
      throw prismaError;
    }
    
    // Atualizar tipoAcademico automaticamente nas configurações de nota fiscal (forceUpdate = true)
    const tipoAcademicoAnterior = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true }
    }).then(i => i?.tipoAcademico || null);
    
    await atualizarTipoAcademico(instituicaoId, true);
    
    // Buscar tipoAcademico atualizado da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true }
    });
    
    const tipoAcademicoAtual = instituicao?.tipoAcademico || null;
    
    // Se o tipo acadêmico mudou e não há cores personalizadas, aplicar cores padrão
    if (tipoAcademicoAnterior !== tipoAcademicoAtual) {
      const coresPersonalizadas = configuracao.corPrimaria && configuracao.corSecundaria && configuracao.corTerciaria;
      
      // Se não há cores personalizadas, aplicar cores padrão do novo tipo
      if (!coresPersonalizadas) {
        const defaultColors = getDefaultColorsByTipoAcademico(tipoAcademicoAtual);
        
        await prisma.configuracaoInstituicao.update({
          where: { instituicaoId },
          data: {
            corPrimaria: defaultColors.corPrimaria,
            corSecundaria: defaultColors.corSecundaria,
            corTerciaria: defaultColors.corTerciaria,
          }
        });
        
        // Buscar configuracao atualizada para retornar as novas cores com filtro multi-tenant
        const configuracaoAtualizada = await prisma.configuracaoInstituicao.findFirst({
          where: { 
            instituicaoId,
            ...filter
          },
        });
        
        if (configuracaoAtualizada) {
          configuracao = configuracaoAtualizada;
        }
      }
    }
    
    // Garantir que retorna tanto camelCase quanto snake_case para compatibilidade
    res.json({
      ...configuracao,
      tipoAcademico: tipoAcademicoAtual,
      // Garantir compatibilidade: incluir snake_case se necessário
      tipo_academico: tipoAcademicoAtual,
      favicon_url: configuracao.faviconUrl,
      logo_url: configuracao.logoUrl,
      imagem_capa_login_url: configuracao.imagemCapaLoginUrl,
      nome_instituicao: configuracao.nomeInstituicao,
      cor_primaria: configuracao.corPrimaria,
      cor_secundaria: configuracao.corSecundaria,
      cor_terciaria: configuracao.corTerciaria,
    });
  } catch (error) {
    next(error);
  }
};
