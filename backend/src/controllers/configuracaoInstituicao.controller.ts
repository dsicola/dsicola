import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { sanitizeLandingPublico } from '../utils/sanitizeLandingPublico.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../middlewares/auth.js';
import { atualizarTipoAcademico } from '../services/instituicao.service.js';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';
import { getDefaultColorsByTipoAcademico } from '../utils/defaultColors.js';
import { getConfigFromCache, setConfigInCache, invalidateConfigCache } from '../services/configCache.service.js';
import { buildConfigInstituicaoAssetUrl, buildLandingPublicUploadedImageUrl } from '../utils/configInstituicaoAssetUrl.js';
import { randomUUID } from 'crypto';

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
          tipoInstituicao: true,
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
    
    // Cache: verificar cache antes de ir ao banco (ROADMAP-100)
    const cached = getConfigFromCache<{ configuracao: any }>(instituicaoId);
    let configuracao: any;
    if (cached) {
      configuracao = cached.configuracao;
    } else {
      configuracao = await prisma.configuracaoInstituicao.findFirst({
        where: { instituicaoId, ...filter },
      });
      setConfigInCache(instituicaoId, { configuracao });
    }
    
    // tipoAcademico: tentar inferir/persistir automaticamente (instituições antigas ou EM_CONFIGURACAO)
    // atualizarTipoAcademico: estrutura → identificação; tipoInstituicao UNIVERSIDADE/ENSINO_MEDIO → inferência
    let tipoAcademicoAtual = await atualizarTipoAcademico(instituicaoId) ?? instituicao?.tipoAcademico ?? null;
    if (!tipoAcademicoAtual && instituicao?.tipoInstituicao) {
      if (instituicao.tipoInstituicao === 'UNIVERSIDADE') tipoAcademicoAtual = 'SUPERIOR';
      else if (instituicao.tipoInstituicao === 'ENSINO_MEDIO') tipoAcademicoAtual = 'SECUNDARIO';
    }
    
    // Aplicar cores padrão dinamicamente baseadas no tipo acadêmico atual
    const temCoresPersonalizadas = configuracao?.corPrimaria && configuracao?.corSecundaria && configuracao?.corTerciaria;
    const defaultColors = getDefaultColorsByTipoAcademico(tipoAcademicoAtual);
    
    if (!configuracao) {
      configuracao = {
        id: '',
        instituicaoId,
        nomeInstituicao: instituicao?.nome || 'DSICOLA',
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
    } else if (!temCoresPersonalizadas) {
      configuracao.corPrimaria = defaultColors.corPrimaria;
      configuracao.corSecundaria = defaultColors.corSecundaria;
      configuracao.corTerciaria = defaultColors.corTerciaria;
    }
    
    // Garantir que nomeInstituicao sempre use o nome da instituição quando não estiver configurado
    // Carregar automaticamente respeitando o tipo de instituição
    const nomeInstituicaoFinal = configuracao?.nomeInstituicao 
      || instituicao?.nome 
      || 'DSICOLA';
    
    // Incluir tipoAcademico na resposta (read-only) - sempre da tabela instituicoes (fonte mais confiável)
    // Garantir que retorna tanto camelCase quanto snake_case para compatibilidade
    // Se assets estão no banco, usar URL do endpoint de servir
    const config = configuracao!;
    const assetV = (config as any).updatedAt ? new Date((config as any).updatedAt).getTime() : Date.now();
    const logoUrl = (config as any).logoData
      ? buildConfigInstituicaoAssetUrl(req, instituicaoId, 'logo', assetV)
      : config.logoUrl;
    const capaUrl = (config as any).imagemCapaLoginData
      ? buildConfigInstituicaoAssetUrl(req, instituicaoId, 'capa', assetV)
      : config.imagemCapaLoginUrl;
    const faviconUrlRes = (config as any).faviconData
      ? buildConfigInstituicaoAssetUrl(req, instituicaoId, 'favicon', assetV)
      : config.faviconUrl;
    const imagemFundoDocUrl = (config as any).imagemFundoDocumentoData
      ? buildConfigInstituicaoAssetUrl(req, instituicaoId, 'imagemFundoDocumento', assetV)
      : config.imagemFundoDocumentoUrl;
    const landingHeroPublicAssetUrl = (config as any).landingHeroPublicData
      ? buildConfigInstituicaoAssetUrl(req, instituicaoId, 'landingHeroPublic', assetV)
      : null;
    // tipoInstituicao para fallback no frontend (instituições com tipo_instituicao mas sem tipo_academico)
    const tipoInstituicaoRes = instituicao?.tipoInstituicao ?? (tipoAcademicoAtual === 'SUPERIOR' ? 'UNIVERSIDADE' : tipoAcademicoAtual === 'SECUNDARIO' ? 'ENSINO_MEDIO' : null);
    const {
      logoData: _ld,
      imagemCapaLoginData: _cd,
      faviconData: _fd,
      imagemFundoDocumentoData: _ifd,
      landingHeroPublicData: _lhd,
      logoContentType: _lct,
      imagemCapaLoginContentType: _cct,
      faviconContentType: _fcct,
      imagemFundoDocumentoContentType: _ifct,
      landingHeroPublicContentType: _lhct,
      ...configWithoutBlobs
    } = config as any;
    res.json({
      ...configWithoutBlobs,
      nomeInstituicao: nomeInstituicaoFinal,
      tipoAcademico: tipoAcademicoAtual,
      tipoInstituicao: tipoInstituicaoRes,
      tipo_instituicao: tipoInstituicaoRes,
      logoUrl,
      imagemCapaLoginUrl: capaUrl,
      faviconUrl: faviconUrlRes,
      // Garantir compatibilidade: incluir snake_case se necessário
      tipo_academico: tipoAcademicoAtual,
      favicon_url: faviconUrlRes,
      logo_url: logoUrl,
      imagem_capa_login_url: capaUrl,
      imagemFundoDocumentoUrl: imagemFundoDocUrl,
      imagem_fundo_documento_url: imagemFundoDocUrl,
      landingHeroPublicUrl: landingHeroPublicAssetUrl ?? (config as any).landingHeroPublicUrl ?? null,
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
 * Pré-visualização de documento (certificado ou declaração)
 * Usa dados de exemplo para estudante; apenas config institucional é configurável
 * POST /configuracoes-instituicao/preview-documento
 * Body: { tipo: 'CERTIFICADO'|'DECLARACAO_MATRICULA'|'DECLARACAO_FREQUENCIA', tipoAcademico: 'SUPERIOR'|'SECUNDARIO', configOverride?: {...} }
 */
export const previewDocumento = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId || !isValidUUID(instituicaoId.trim())) {
      throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
    }

    const { tipo, tipoAcademico, configOverride: rawOverride } = req.body || {};
    if (!tipo || !tipoAcademico) {
      throw new AppError('tipo e tipoAcademico são obrigatórios', 400);
    }
    if (!['CERTIFICADO', 'DECLARACAO_MATRICULA', 'DECLARACAO_FREQUENCIA', 'BOLETIM'].includes(tipo)) {
      throw new AppError('tipo inválido', 400);
    }
    if (!['SUPERIOR', 'SECUNDARIO'].includes(tipoAcademico)) {
      throw new AppError('tipoAcademico inválido', 400);
    }

    // BOLETIM: fluxo separado com dados fictícios (getBoletimPreviewData)
    if (tipo === 'BOLETIM') {
      const { getModeloDocumentoAtivo } = await import('../services/modeloDocumento.service.js');
      const { getBoletimPreviewData } = await import('../services/excelPreviewData.service.js');
      const { boletimToTemplateData, boletimToVarsBasicas, preencherTemplateHtmlGenerico } = await import('../services/documentoTemplateGeneric.service.js');
      const modelo = await getModeloDocumentoAtivo({
        instituicaoId: instituicaoId.trim(),
        tipo: 'BOLETIM',
        tipoAcademico: tipoAcademico as 'SUPERIOR' | 'SECUNDARIO',
        cursoId: null,
      });
      if (!modelo) {
        throw new AppError(
          'Nenhum modelo Boletim importado. Importe um modelo Word, PDF ou HTML em Configurações > Documentos > Boletins.',
          404
        );
      }
      const boletimMock = await getBoletimPreviewData(instituicaoId.trim());
      const data = boletimToTemplateData(boletimMock) as Record<string, unknown>;
      if (modelo.docxTemplateBase64?.trim()) {
        const { renderTemplate } = await import('../services/templateRender.service.js');
        const { docxBufferToPdf } = await import('../services/docxToPdf.service.js');
        const { buffer, format } = await renderTemplate({
          modeloDocumentoId: modelo.id,
          instituicaoId: instituicaoId.trim(),
          data,
          outputFormat: 'pdf',
        });
        let pdfBuffer: Buffer | null = format === 'pdf' ? buffer : null;
        if (!pdfBuffer) {
          const landscape = (modelo as { orientacaoPagina?: string }).orientacaoPagina === 'PAISAGEM';
          pdfBuffer = await docxBufferToPdf(buffer, { landscape });
        }
        if (pdfBuffer) return res.json({ pdfBase64: pdfBuffer.toString('base64') });
      }
      if (modelo.pdfTemplateBase64?.trim()) {
        const { fillPdfFormFields, fillPdfWithCoordinates } = await import('../services/pdfTemplate.service.js');
        const pdfMapping = (modelo as { pdfMappingJson?: string }).pdfMappingJson;
        const pdfMode = (modelo as { pdfTemplateMode?: string }).pdfTemplateMode;
        if (pdfMapping?.trim()) {
          let mappingObj: Record<string, string> | { items: Array<{ pageIndex: number; x: number; y: number; campo: string }> };
          try {
            mappingObj = JSON.parse(pdfMapping) as Record<string, string> | { items: Array<{ pageIndex: number; x: number; y: number; campo: string }> };
          } catch {
            throw new AppError('Mapeamento PDF inválido no modelo Boletim', 400);
          }
          const buf = pdfMode === 'COORDINATES'
            ? await fillPdfWithCoordinates(modelo.pdfTemplateBase64, data, mappingObj as { items: Array<{ pageIndex: number; x: number; y: number; campo: string }> })
            : await fillPdfFormFields(modelo.pdfTemplateBase64, data, mappingObj as Record<string, string>);
          return res.json({ pdfBase64: buf.toString('base64') });
        }
      }
      if (modelo.htmlTemplate?.trim()) {
        const vars = boletimToVarsBasicas(boletimMock);
        const html = preencherTemplateHtmlGenerico(modelo.htmlTemplate, vars);
        const { gerarPDFCertificadoSuperior } = await import('../services/certificadoSuperior.service.js');
        const landscape = (modelo as { orientacaoPagina?: string }).orientacaoPagina === 'PAISAGEM';
        const pdfBuffer = await gerarPDFCertificadoSuperior(html, { landscape });
        if (pdfBuffer) return res.json({ pdfBase64: pdfBuffer.toString('base64') });
      }
      throw new AppError(
        'Modelo Boletim sem template (Word, PDF ou HTML). Edite o modelo e importe um ficheiro.',
        400
      );
    }

    const snakeToCamel: Record<string, string> = {
      ministerio_superior: 'ministerioSuperior', decreto_criacao: 'decretoCriacao',
      nome_chefe_daa: 'nomeChefeDaa', nome_director_geral: 'nomeDirectorGeral',
      localidade_certificado: 'localidadeCertificado', cargo_assinatura1: 'cargoAssinatura1',
      cargo_assinatura2: 'cargoAssinatura2', texto_fecho_certificado: 'textoFechoCertificado',
      texto_rodape_certificado: 'textoRodapeCertificado', bi_complementar_certificado: 'biComplementarCertificado',
      label_media_final_certificado: 'labelMediaFinalCertificado', label_valores_certificado: 'labelValoresCertificado',
      republica_angola: 'republicaAngola', governo_provincia: 'governoProvincia',
      escola_nome_numero: 'escolaNomeNumero', ensino_geral: 'ensinoGeral',
      titulo_certificado_secundario: 'tituloCertificadoSecundario',
      texto_fecho_certificado_secundario: 'textoFechoCertificadoSecundario',
      cargo_assinatura_1_secundario: 'cargoAssinatura1Secundario', cargo_assinatura_2_secundario: 'cargoAssinatura2Secundario',
      nome_assinatura_1_secundario: 'nomeAssinatura1Secundario', nome_assinatura_2_secundario: 'nomeAssinatura2Secundario',
      label_resultado_final_secundario: 'labelResultadoFinalSecundario',
    };

    let configOverride: Record<string, string | null> | undefined;
    if (rawOverride && typeof rawOverride === 'object') {
      configOverride = {};
      for (const [k, v] of Object.entries(rawOverride)) {
        const camel = snakeToCamel[k] || k;
        configOverride[camel] = typeof v === 'string' ? (v.trim() || null) : (v as string | null);
      }
    }

    const { montarPayloadPrevisualizacao } = await import('../services/documento.service.js');
    const payload = await montarPayloadPrevisualizacao(
      tipo,
      instituicaoId.trim(),
      tipoAcademico,
      configOverride as any
    );

    // 1) Verificar se há modelo de documento customizado para esta instituição/tipo/tipoAcad (preview não é por curso).
    const { getModeloDocumentoAtivo } = await import('../services/modeloDocumento.service.js');
    const modeloCustom = await getModeloDocumentoAtivo({
      instituicaoId: instituicaoId.trim(),
      tipo: tipo as any,
      tipoAcademico: tipoAcademico as 'SUPERIOR' | 'SECUNDARIO',
      cursoId: null,
    });

    const docxBase64Model = (modeloCustom as { docxTemplateBase64?: string | null })?.docxTemplateBase64;
    const hasDocxModel = docxBase64Model && docxBase64Model.trim().length > 0;

    if (modeloCustom && hasDocxModel) {
      // Modelo DOCX importado: renderizar com docxtemplater e converter para PDF (LibreOffice = 100% fidelidade).
      const { payloadToTemplateData } = await import('../services/documentoTemplateGeneric.service.js');
      const { renderTemplate } = await import('../services/templateRender.service.js');
      const { docxBufferToPdf } = await import('../services/docxToPdf.service.js');
      const data = payloadToTemplateData(
        payload,
        tipo as 'CERTIFICADO' | 'DECLARACAO_MATRICULA' | 'DECLARACAO_FREQUENCIA',
        tipoAcademico as 'SUPERIOR' | 'SECUNDARIO'
      );
      const { buffer, format } = await renderTemplate({
        modeloDocumentoId: modeloCustom.id,
        instituicaoId: instituicaoId.trim(),
        data: data as Record<string, unknown>,
        outputFormat: 'pdf',
      });
      let pdfBuffer: Buffer | null = format === 'pdf' ? buffer : null;
      if (!pdfBuffer) {
        const landscape = (modeloCustom as { orientacaoPagina?: string | null }).orientacaoPagina === 'PAISAGEM';
        pdfBuffer = await docxBufferToPdf(buffer, { landscape });
      }
      if (pdfBuffer) {
        return res.json({ pdfBase64: pdfBuffer.toString('base64') });
      }
      throw new AppError(
        'Não foi possível converter o modelo DOCX para PDF. Instale LibreOffice para fidelidade total (ex: apt install libreoffice).',
        500
      );
    }

    let html: string;

    if (modeloCustom) {
      // Modelo HTML: template genérico com placeholders {{CHAVE}}.
      const { montarVarsBasicas, preencherTemplateHtmlGenerico } = await import('../services/documentoTemplateGeneric.service.js');
      const vars = montarVarsBasicas(
        payload,
        tipo as 'CERTIFICADO' | 'DECLARACAO_MATRICULA' | 'DECLARACAO_FREQUENCIA',
        tipoAcademico as 'SUPERIOR' | 'SECUNDARIO'
      );
      html = preencherTemplateHtmlGenerico(modeloCustom.htmlTemplate || '', vars);
    } else {
      // Sem modelo importado: não mostrar preview fictício (templates hardcoded)
      throw new AppError(
        'Nenhum modelo importado para este tipo de documento. Importe um em Configurações > Modelos de Documentos para visualizar.',
        404
      );
    }

    res.json({ html });
  } catch (error) {
    next(error);
  }
};

/**
 * Pré-visualização da mini pauta (dados fictícios).
 * Multi-tenant: instituicaoId do JWT. Respeita tipoAcademico (SUPERIOR/SECUNDARIO).
 * POST /configuracoes-instituicao/preview-pauta
 * Body: { tipoPauta: 'PROVISORIA'|'DEFINITIVA', tipoAcademico?: 'SUPERIOR'|'SECUNDARIO' }
 */
export const previewPauta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId || !isValidUUID(instituicaoId.trim())) {
      throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
    }

    const { tipoPauta, tipoAcademico } = req.body || {};
    const tipo = (tipoPauta || 'PROVISORIA') as 'PROVISORIA' | 'DEFINITIVA';
    if (!['PROVISORIA', 'DEFINITIVA'].includes(tipo)) {
      throw new AppError('tipoPauta inválido (use PROVISORIA ou DEFINITIVA)', 400);
    }
    const tipoAcad = tipoAcademico && ['SUPERIOR', 'SECUNDARIO'].includes(tipoAcademico) ? tipoAcademico : null;

    const { gerarPDFPautaPreview } = await import('../services/pautaPrint.service.js');
    const result = await gerarPDFPautaPreview(instituicaoId.trim(), tipo, tipoAcad);
    const base64 = Buffer.from(result.buffer).toString('base64');
    res.json({
      formato: result.formato,
      pdfBase64: result.formato === 'PDF' ? base64 : undefined,
      excelBase64: result.formato === 'EXCEL' ? base64 : undefined,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pré-visualização da Pauta de Conclusão do Curso (modelo Saúde - Ensino Secundário).
 * Se existir modelo Excel importado: usa-o (fillExcelTemplateByMode + LibreOffice) — 100% fidelidade.
 * Senão: usa gerador PDFKit padrão.
 * Multi-tenant: instituicaoId do JWT.
 * POST /configuracoes-instituicao/preview-pauta-conclusao-saude
 */
export const previewPautaConclusaoSaude = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId || !isValidUUID(instituicaoId.trim())) {
      throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
    }

    // 1) Verificar se existe modelo Excel importado — usar modelo do governo (fidelidade 100%)
    const tipoAcad = await getTipoAcademico(instituicaoId.trim());
    const { getModeloDocumentoAtivo } = await import('../services/modeloDocumento.service.js');
    const { getPautaConclusaoSaudeDados } = await import('../services/pautaConclusaoSaude.service.js');
    const { fillExcelTemplateByMode, pautaConclusaoToExcelData } = await import('../services/excelTemplate.service.js');
    const { excelBufferToPdf } = await import('../services/excelToPdf.service.js');

    const modelo = await getModeloDocumentoAtivo({
      instituicaoId: instituicaoId.trim(),
      tipo: 'PAUTA_CONCLUSAO',
      tipoAcademico: tipoAcad ?? undefined,
      cursoId: null,
    });

    if (modelo?.excelTemplateBase64) {
      try {
        const dados = await getPautaConclusaoSaudeDados(instituicaoId.trim(), null);
        const baseData = pautaConclusaoToExcelData(dados);
        const excelData = { ...baseData };
        const mappings = (modelo as { templateMappings?: { campoTemplate: string; campoSistema: string }[] }).templateMappings;
        const modo = (modelo as { excelTemplateMode?: string | null }).excelTemplateMode;
        const cellMappingJson = (modelo as { excelCellMappingJson?: string | null }).excelCellMappingJson;
        if (modo === 'CELL_MAPPING' && cellMappingJson?.trim()) {
          const cellMapping = JSON.parse(cellMappingJson) as import('../services/excelTemplate.service.js').ExcelCellMapping;
          const buffer = await fillExcelTemplateByMode(
            modelo.excelTemplateBase64,
            modo,
            cellMappingJson,
            excelData,
            dados
          );
          const pdfBuffer = await excelBufferToPdf(buffer, { landscape: true });
          if (pdfBuffer) {
            return res.json({ pdfBase64: pdfBuffer.toString('base64') });
          }
        } else if (mappings?.length) {
          const validPaths = new Set(Object.keys(baseData));
          const { validarMapeamentosCampos } = await import('../services/availableFields.service.js');
          const invalidos = validarMapeamentosCampos(
            mappings.map((m) => ({ campoTemplate: m.campoTemplate, campoSistema: m.campoSistema })),
            validPaths
          );
          if (invalidos.length === 0) {
            for (const m of mappings) {
              excelData[m.campoTemplate] = baseData[m.campoSistema] ?? '';
            }
          }
        }
        const buffer = await fillExcelTemplateByMode(
          modelo.excelTemplateBase64,
          modo ?? 'PLACEHOLDER',
          cellMappingJson ?? null,
          excelData,
          modo === 'CELL_MAPPING' ? dados : null
        );
        const pdfBuffer = await excelBufferToPdf(buffer, { landscape: true });
        if (pdfBuffer) {
          return res.json({ pdfBase64: pdfBuffer.toString('base64') });
        }
      } catch (err) {
        console.warn('[previewPautaConclusaoSaude] Modelo Excel falhou, usando preview padrão:', err);
      }
    }

    // 2) Sem modelo encontrado ou modelo sem ficheiro Excel
    const msg = modelo && !modelo.excelTemplateBase64?.trim()
      ? 'O modelo existe mas o ficheiro Excel foi perdido. Edite o modelo e carregue novamente o ficheiro Excel do governo.'
      : 'Nenhum modelo do tipo Pauta de Conclusão importado. Mini Pauta e Pauta de Conclusão são tipos diferentes — importe um modelo Excel com tipo "Pauta de Conclusão" (não "Mini Pauta") na tabela acima e marque-o como Ativo.';
    throw new AppError(msg, 404);
  } catch (error) {
    next(error);
  }
};

/**
 * Converte PDF em HTML (extração de texto) para importação de modelos.
 * POST /configuracoes-instituicao/convert-pdf-to-html (multipart, field: pdf)
 */
export const convertPdfToHtml = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    requireTenantScope(req);
    const file = (req as any).file;
    if (!file || !file.buffer) {
      throw new AppError('Envie um ficheiro PDF (campo: pdf)', 400);
    }
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(file.buffer);
    const text = data?.text ?? '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
    res.json({ html });
  } catch (error) {
    next(error);
  }
};

/**
 * Dados da Pauta de Conclusão Saúde para exportação Excel.
 * GET /configuracoes-instituicao/pauta-conclusao-saude-dados?turmaId=xxx
 * Se turmaId: dados reais. Senão: preview com dados fictícios.
 */
export const getPautaConclusaoSaudeDados = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId || !isValidUUID(instituicaoId.trim())) {
      throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
    }

    const turmaId = (req.query.turmaId as string) || null;
    const svc = await import('../services/pautaConclusaoSaude.service.js');
    const dados = await svc.getPautaConclusaoSaudeDados(instituicaoId.trim(), turmaId);
    res.json(dados);
  } catch (error) {
    next(error);
  }
};

/**
 * Exportar Pauta de Conclusão em Excel usando modelo do governo (quando existir).
 * GET /configuracoes-instituicao/pauta-conclusao-saude-export-excel?turmaId=xxx
 * Retorna ficheiro Excel preenchido. Se não houver modelo, retorna 404.
 */
export const getPautaConclusaoSaudeExcelExport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId || !isValidUUID(instituicaoId.trim())) {
      throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
    }

    const turmaId = (req.query.turmaId as string) || null;
    const tipoAcad = await getTipoAcademico(instituicaoId.trim());
    const { getModeloDocumentoAtivo } = await import('../services/modeloDocumento.service.js');
    const { getPautaConclusaoSaudeDados } = await import('../services/pautaConclusaoSaude.service.js');
    const { fillExcelTemplateByMode, pautaConclusaoToExcelData } = await import('../services/excelTemplate.service.js');

    const modelo = await getModeloDocumentoAtivo({
      instituicaoId: instituicaoId.trim(),
      tipo: 'PAUTA_CONCLUSAO',
      tipoAcademico: tipoAcad ?? undefined,
      cursoId: null,
    });

    if (!modelo?.excelTemplateBase64) {
      throw new AppError('Não existe modelo Excel do governo para Pauta de Conclusão. Importe um em Configurações > Modelos de Documentos.', 404);
    }

    const dados = await getPautaConclusaoSaudeDados(instituicaoId.trim(), turmaId);
    const baseData = pautaConclusaoToExcelData(dados);
    const excelData = { ...baseData };
    const mappings = (modelo as { templateMappings?: { campoTemplate: string; campoSistema: string }[] }).templateMappings;
    const modo = (modelo as { excelTemplateMode?: string | null }).excelTemplateMode;
    const cellMappingJson = (modelo as { excelCellMappingJson?: string | null }).excelCellMappingJson;
    if (modo === 'CELL_MAPPING' && !cellMappingJson?.trim()) {
      throw new AppError(
        'Modelo em modo Mapeamento por coordenadas requer configuração de mapeamento. Edite o modelo e use "Sugerir mapeamento" ou configure manualmente.',
        400
      );
    }
    if (modo !== 'CELL_MAPPING') {
      if (mappings?.length) {
        const { validarMapeamentosCampos } = await import('../services/availableFields.service.js');
        const validPaths = new Set(Object.keys(baseData));
        const invalidos = validarMapeamentosCampos(mappings, validPaths);
        if (invalidos.length > 0) {
          throw new AppError(
            `Campos inexistentes nos mapeamentos do modelo Pauta de Conclusão. Corrija ou remova antes de gerar: ${invalidos.join('; ')}`,
            400
          );
        }
        for (const m of mappings) {
          excelData[m.campoTemplate] = baseData[m.campoSistema] ?? '';
        }
      }
    }
    const buffer = await fillExcelTemplateByMode(
      modelo.excelTemplateBase64,
      modo,
      cellMappingJson,
      excelData,
      modo === 'CELL_MAPPING' ? dados : null
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="pauta-conclusao-${dados.turma?.replace(/\s+/g, '-') || 'curso'}-${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/** Servir asset do banco (logo, capa, favicon) - rota pública para login/subdomínio */
export const serveAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo } = req.params;
    const instituicaoId = req.query.instituicaoId as string;
    if (
      !instituicaoId ||
      !['logo', 'capa', 'favicon', 'imagemFundoDocumento', 'landingHeroPublic'].includes(tipo)
    ) {
      return res.status(400).json({
        message: 'instituicaoId e tipo (logo|capa|favicon|imagemFundoDocumento|landingHeroPublic) obrigatórios',
      });
    }
    const config = await prisma.configuracaoInstituicao.findFirst({
      where: { instituicaoId },
      select:
        tipo === 'logo'
          ? { logoData: true, logoContentType: true }
          : tipo === 'capa'
            ? { imagemCapaLoginData: true, imagemCapaLoginContentType: true }
            : tipo === 'imagemFundoDocumento'
              ? { imagemFundoDocumentoData: true, imagemFundoDocumentoContentType: true }
              : tipo === 'landingHeroPublic'
                ? { landingHeroPublicData: true, landingHeroPublicContentType: true }
                : { faviconData: true, faviconContentType: true },
    });
    const data = (config as any)?.[
      tipo === 'logo'
        ? 'logoData'
        : tipo === 'capa'
          ? 'imagemCapaLoginData'
          : tipo === 'imagemFundoDocumento'
            ? 'imagemFundoDocumentoData'
            : tipo === 'landingHeroPublic'
              ? 'landingHeroPublicData'
              : 'faviconData'
    ];
    const contentType = (config as any)?.[
      tipo === 'logo'
        ? 'logoContentType'
        : tipo === 'capa'
          ? 'imagemCapaLoginContentType'
          : tipo === 'imagemFundoDocumento'
            ? 'imagemFundoDocumentoContentType'
            : tipo === 'landingHeroPublic'
              ? 'landingHeroPublicContentType'
              : 'faviconContentType'
    ];
    if (!data || !(data instanceof Buffer)) {
      return res.status(404).json({ message: 'Asset não encontrado' });
    }
    res.setHeader('Content-Type', contentType || (tipo === 'favicon' ? 'image/x-icon' : 'image/png'));
    // URLs incluem ?v=updatedAt para bust de cache; manter revalidação curta para URLs antigas sem v
    res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');
    res.send(data);
  } catch (error) {
    next(error);
  }
};

/** Upload de assets (logo, capa, favicon) para o banco - sem volume/S3 */
export const uploadAssets = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    invalidateConfigCache(instituicaoId);
    const files = (req as any).files as { logo?: Express.Multer.File[]; capa?: Express.Multer.File[]; favicon?: Express.Multer.File[]; imagemFundoDocumento?: Express.Multer.File[] } | undefined;
    const cacheBust = Date.now();
    const updateData: any = {};
    if (files?.logo?.[0]) {
      const f = files.logo[0];
      updateData.logoData = f.buffer;
      updateData.logoContentType = f.mimetype || 'image/png';
      updateData.logoUrl = buildConfigInstituicaoAssetUrl(req, instituicaoId, 'logo', cacheBust);
    }
    if (files?.capa?.[0]) {
      const f = files.capa[0];
      updateData.imagemCapaLoginData = f.buffer;
      updateData.imagemCapaLoginContentType = f.mimetype || 'image/png';
      updateData.imagemCapaLoginUrl = buildConfigInstituicaoAssetUrl(req, instituicaoId, 'capa', cacheBust);
    }
    if (files?.favicon?.[0]) {
      const f = files.favicon[0];
      updateData.faviconData = f.buffer;
      updateData.faviconContentType = f.mimetype || 'image/x-icon';
      updateData.faviconUrl = buildConfigInstituicaoAssetUrl(req, instituicaoId, 'favicon', cacheBust);
    }
    if (files?.imagemFundoDocumento?.[0]) {
      const f = files.imagemFundoDocumento[0];
      updateData.imagemFundoDocumentoData = f.buffer;
      updateData.imagemFundoDocumentoContentType = f.mimetype || 'image/png';
      updateData.imagemFundoDocumentoUrl = buildConfigInstituicaoAssetUrl(req, instituicaoId, 'imagemFundoDocumento', cacheBust);
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Envie ao menos um arquivo: logo, capa, favicon ou imagemFundoDocumento' });
    }
    const config = await prisma.configuracaoInstituicao.upsert({
      where: { instituicaoId },
      update: updateData,
      create: { instituicaoId, nomeInstituicao: 'DSICOLA', tipoInstituicao: 'ENSINO_MEDIO', numeracaoAutomatica: true, ...updateData },
    });
    res.json({
      logoUrl: config.logoUrl,
      imagemCapaLoginUrl: config.imagemCapaLoginUrl,
      faviconUrl: config.faviconUrl,
      imagemFundoDocumentoUrl: config.imagemFundoDocumentoUrl,
    });
  } catch (error) {
    next(error);
  }
};

const LANDING_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** POST multipart field `file` — capa hero do site público (até 3MB), actualiza landing_publico.heroImageUrl */
export const uploadLandingHeroPublic = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file?.buffer || !LANDING_IMAGE_MIMES.has(file.mimetype || '')) {
      return res.status(400).json({ message: 'Envie uma imagem JPG, PNG ou WebP (máx. 3MB).' });
    }
    invalidateConfigCache(instituicaoId);
    const cacheBust = Date.now();
    const heroUrl = buildConfigInstituicaoAssetUrl(req, instituicaoId, 'landingHeroPublic', cacheBust);
    const existing = await prisma.configuracaoInstituicao.findFirst({ where: { instituicaoId } });
    const prevLp = existing?.landingPublico;
    const mergedLp = sanitizeLandingPublico({
      ...(typeof prevLp === 'object' && prevLp !== null && !Array.isArray(prevLp) ? prevLp : {}),
      heroImageUrl: heroUrl,
    });
    await prisma.configuracaoInstituicao.upsert({
      where: { instituicaoId },
      create: {
        instituicaoId,
        nomeInstituicao: 'DSICOLA',
        tipoInstituicao: 'ENSINO_MEDIO',
        numeracaoAutomatica: true,
        landingHeroPublicData: file.buffer,
        landingHeroPublicContentType: file.mimetype,
        landingHeroPublicUrl: heroUrl,
        landingPublico: mergedLp as object,
      },
      update: {
        landingHeroPublicData: file.buffer,
        landingHeroPublicContentType: file.mimetype,
        landingHeroPublicUrl: heroUrl,
        landingPublico: mergedLp as object,
      },
    });
    res.json({ heroImageUrl: heroUrl, landingPublico: mergedLp });
  } catch (error) {
    next(error);
  }
};

/** POST multipart `file` — imagem para evento / destaque (até 2,5MB); devolve URL pública */
export const uploadLandingPublicExtraImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file?.buffer || !LANDING_IMAGE_MIMES.has(file.mimetype || '')) {
      return res.status(400).json({ message: 'Envie uma imagem JPG, PNG ou WebP (máx. 2,5MB).' });
    }
    invalidateConfigCache(instituicaoId);
    const id = randomUUID();
    const cacheBust = Date.now();
    await prisma.landingPublicUploadedImage.create({
      data: {
        id,
        instituicaoId,
        data: file.buffer,
        contentType: file.mimetype,
      },
    });
    const imageUrl = buildLandingPublicUploadedImageUrl(req, instituicaoId, id, cacheBust);
    res.json({ imageUrl });
  } catch (error) {
    next(error);
  }
};

/** GET público — imagem extra (eventos) */
export const serveLandingPublicImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageId } = req.params;
    const instituicaoId = typeof req.query.instituicaoId === 'string' ? req.query.instituicaoId : '';
    if (!imageId || !instituicaoId) {
      return res.status(400).json({ message: 'imageId e instituicaoId obrigatórios' });
    }
    const row = await prisma.landingPublicUploadedImage.findFirst({
      where: { id: imageId, instituicaoId },
      select: { data: true, contentType: true },
    });
    if (!row?.data || !(row.data instanceof Buffer)) {
      return res.status(404).json({ message: 'Imagem não encontrada' });
    }
    res.setHeader('Content-Type', row.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.send(row.data);
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
    'imagemFundoDocumentoUrl',
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
    'softwareCertificateNumber',
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
    'valorEmissaoDeclaracao',
    'valorEmissaoCertificado',
    'valorPasse',
    'multiCampus',
    'impressaoDireta',
    'formatoPadraoImpressao',
    'numeroCopiasRecibo',
    'nomeImpressoraPreferida',
    'ministerioSuperior',
    'decretoCriacao',
    'nomeChefeDaa',
    'nomeDirectorGeral',
    'localidadeCertificado',
    'cargoAssinatura1',
    'cargoAssinatura2',
    'textoFechoCertificado',
    'textoRodapeCertificado',
    'biComplementarCertificado',
    'labelMediaFinalCertificado',
    'labelValoresCertificado',
    'republicaAngola',
    'governoProvincia',
    'escolaNomeNumero',
    'ensinoGeral',
    'tituloCertificadoSecundario',
    'textoFechoCertificadoSecundario',
    'cargoAssinatura1Secundario',
    'cargoAssinatura2Secundario',
    'nomeAssinatura1Secundario',
    'nomeAssinatura2Secundario',
    'labelResultadoFinalSecundario',
    'notificacaoConfig',
    'landingPublico',
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
      if ((field === 'logoUrl' || field === 'imagemCapaLoginUrl' || field === 'faviconUrl' || field === 'imagemFundoDocumentoUrl') && typeof value === 'string') {
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
      if (field === 'multiCampus' || field === 'impressaoDireta') {
        cleaned[field] = Boolean(value);
        continue;
      }

      // Formato padrão de impressão (A4 ou TERMICO)
      if (field === 'formatoPadraoImpressao' && typeof value === 'string') {
        const v = value.trim().toUpperCase();
        if (v === 'A4' || v === 'TERMICO' || v === '80MM') {
          cleaned[field] = v === '80MM' ? 'TERMICO' : v;
        } else {
          cleaned[field] = 'A4';
        }
        continue;
      }

      // Número de cópias (1-3)
      if (field === 'numeroCopiasRecibo') {
        const n = typeof value === 'number' ? value : parseInt(String(value), 10);
        cleaned[field] = Math.min(3, Math.max(1, isNaN(n) ? 1 : n));
        continue;
      }

      // Nome impressora preferida (texto livre, max 100 chars)
      if (field === 'nomeImpressoraPreferida' && typeof value === 'string') {
        cleaned[field] = value.trim().slice(0, 100) || null;
        continue;
      }
      
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

      // Validação de valores monetários (taxa matrícula, mensalidade, emissão documentos, passe)
      const camposMonetarios = ['taxaMatriculaPadrao', 'mensalidadePadrao', 'valorEmissaoDeclaracao', 'valorEmissaoCertificado', 'valorPasse'];
      if (camposMonetarios.includes(field)) {
        if (value === null || value === undefined) {
          cleaned[field] = null;
        } else {
          const num = typeof value === 'number' ? value : parseFloat(String(value));
          if (isNaN(num) || num < 0) {
            const labels: Record<string, string> = {
              taxaMatriculaPadrao: 'Taxa de matrícula',
              mensalidadePadrao: 'Mensalidade',
              valorEmissaoDeclaracao: 'Valor emissão declaração',
              valorEmissaoCertificado: 'Valor emissão certificado',
              valorPasse: 'Valor passe',
            };
            throw new AppError(`${labels[field] || field} deve ser um número não negativo`, 400);
          }
          cleaned[field] = num;
        }
        continue;
      }

      // notificacaoConfig: JSON com triggers { [key]: { enabled, canais } }
      if (field === 'notificacaoConfig' && value && typeof value === 'object') {
        const raw = value as { triggers?: Record<string, { enabled?: boolean; canais?: string[] }> };
        if (raw.triggers && typeof raw.triggers === 'object') {
          const triggers: Record<string, { enabled: boolean; canais: string[] }> = {};
          const validCanais = ['email', 'telegram', 'sms'];
          const validTriggers = ['conta_criada', 'funcionario_criado', 'matricula_realizada', 'pagamento_confirmado', 'mensalidade_estornada', 'mensalidade_pendente'];
          for (const k of validTriggers) {
            const t = raw.triggers[k];
            if (t && typeof t === 'object') {
              const canais = Array.isArray(t.canais) ? t.canais.filter((c: string) => validCanais.includes(c)) : ['email'];
              triggers[k] = { enabled: !!t.enabled, canais: canais.length ? canais : ['email'] };
            }
          }
          cleaned[field] = { triggers };
        }
        continue;
      }

      if (field === 'landingPublico') {
        if (value === null) {
          cleaned[field] = null;
          continue;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          cleaned[field] = sanitizeLandingPublico(value);
          continue;
        }
        continue;
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
    
    // Log apenas em desenvolvimento (evita lentidão e ruído em produção)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[update] InstituicaoId:', instituicaoId);
    }

    // VALIDAÇÃO: Verificar se instituição existe (Instituicao não tem instituicaoId - usar apenas id)
    const instituicaoExists = await prisma.instituicao.findFirst({
      where: { id: instituicaoId },
      select: { id: true, tipoAcademico: true }
    });
    
    if (!instituicaoExists) {
      throw new AppError('Instituição não encontrada ou não pertence à sua instituição', 404);
    }
    
    // Invalidar cache ao atualizar (próximo GET trará dados frescos)
    invalidateConfigCache(instituicaoId);
    
    // Remover tipoInstituicao e tipoAcademico do data - não podem ser salvos manualmente
    const { tipoInstituicao, tipoAcademico, ...dataToSanitize } = req.body;
    
    // ============================================
    // LIMPEZA E VALIDAÇÃO DE DADOS
    // ============================================
    let dataToSave: any;
    
    try {
      dataToSave = sanitizeConfiguracaoData(dataToSanitize);
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
    
    // ============================================
    // VALIDAÇÃO: multiCampus exige plano com multiCampus
    // ============================================
    if (dataToSave.multiCampus === true) {
      const { canEnableConfigMultiCampus } = await import('../services/planFeatures.service.js');
      const canEnable = await canEnableConfigMultiCampus(instituicaoId, req.user?.roles);
      if (!canEnable) {
        throw new AppError(
          'O recurso multi-campus não está incluído no plano da sua instituição. Atualize seu plano para ativar.',
          403
        );
      }
    }

    // Se não há campos para atualizar, retornar configuração atual
    if (Object.keys(dataToSave).length === 0) {
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

    // ============================================
    // UPDATE NO PRISMA (APENAS CAMPOS PRESENTES)
    // ============================================
    const configAntes = await prisma.configuracaoInstituicao.findFirst({
      where: { instituicaoId },
    });
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

    await AuditService.log(req as any, {
      modulo: ModuloAuditoria.CONFIGURACAO,
      acao: AcaoAuditoria.UPDATE,
      entidade: EntidadeAuditoria.CONFIGURACAO_INSTITUICAO,
      entidadeId: configuracao.instituicaoId ?? instituicaoId,
      dadosAnteriores: configAntes ? { nomeInstituicao: configAntes.nomeInstituicao } : {},
      dadosNovos: prismaData,
      instituicaoId: instituicaoId ?? undefined,
    }).catch((err) => console.error('[configuracaoInstituicao.update] Erro audit:', err?.message));
    
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
