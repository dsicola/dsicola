import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { defaultLandingPublico, emptyLandingEventItem, parseLandingPublico, type LandingPublico } from "@/types/landingPublico";
import { configuracoesInstituicaoApi, instituicoesApi, mensalidadesApi, parametrosSistemaApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanFeatures } from "@/contexts/PlanFeaturesContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Upload, X, Building2, Image, Palette, Mail, Phone, MapPin, GraduationCap, School, RotateCcw, DollarSign, Percent, FileText, Globe, Receipt, Save, Settings, BookOpen, Shield, Lock, AlertCircle, Info, Loader2, Clock, Printer, Eye, Bell, Send, Link2, ExternalLink, LayoutTemplate, CheckCircle2, XCircle, Plus, Trash2, CalendarDays } from "lucide-react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
// Theme is now applied globally via ThemeProvider
// No need to import applyThemeColors/resetThemeColors here
import { getDefaultColorsByTipoAcademico } from "@/utils/defaultColors";
import { injectCertificatePreviewStyles } from "@/utils/certificatePreviewUtils";
import {
  DEFAULT_PAUTA_LABELS_SUPERIOR,
  DEFAULT_PAUTA_LABELS_SECUNDARIO,
  mergePautaLabelsSuperior,
  mergePautaLabelsSecundario,
} from "@/utils/pautaLabelsConfig";
import { getPlatformBaseDomain } from "@/utils/platformDomain";
import { CommunityDirectoryOffersAdmin } from "@/components/admin/CommunityDirectoryOffersAdmin";

const MAX_FILE_SIZE = 1048576; // 1MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
/** Placeholders para modelos de documento - constantes evitam ReferenceError em JSX */
const PLACEHOLDER_IMAGEM_FUNDO = '\u007b\u007bIMAGEM_FUNDO_URL\u007d\u007d';
const EXEMPLO_IMAGEM_FUNDO_STYLE = 'style="background-image: url(\u007b\u007bIMAGEM_FUNDO_URL\u007d\u007d)"';

export default function ConfiguracoesInstituicao() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config, loading, refetch, instituicaoId } = useInstituicao();
  const { user } = useAuth();
  const { hasMultiCampus, planoNome, isLoading: planLoading, hasFeature } = usePlanFeatures();

  const canDominoProprio = hasFeature("dominio_customizado");
  const platformBase = getPlatformBaseDomain();
  const cnameTargetHint =
    (import.meta.env.VITE_CUSTOM_DOMAIN_CNAME_TARGET as string | undefined)?.trim() || null;
  const [dominioCustomDraft, setDominioCustomDraft] = useState("");
  const [dominioCustomSaving, setDominioCustomSaving] = useState(false);
  const [dnsVerifyLoading, setDnsVerifyLoading] = useState(false);
  const [dnsVerifyResult, setDnsVerifyResult] = useState<{
    configuredOnServer: boolean;
    ok: boolean;
    message: string;
    records: string[];
  } | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const capaInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const imagemFundoDocInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    nome_instituicao: '',
    cor_primaria: '#8B5CF6',
    cor_secundaria: '#1F2937',
    cor_terciaria: '#F8FAFC',
    email: '',
    telefone: '',
    endereco: '',
    descricao: '',
    multa_percentual: '2',
    juros_dia: '0.033',
    // Dados Gerais
    pais: '',
    moeda_padrao: 'AOA',
    idioma: 'pt',
    // Dados Fiscais
    nome_fiscal: '',
    email_fiscal: '',
    telefone_fiscal: '',
    endereco_fiscal: '',
    cidade_fiscal: '',
    provincia_fiscal: '',
    pais_fiscal: '',
    codigo_postal_fiscal: '',
    // Identificação Fiscal (dinâmico por país)
    nif: '',
    software_certificate_number: '',
    cnpj: '',
    inscricao_estadual: '',
    codigo_servico_financas: '',
    identificacao_fiscal_generica: '',
    // Configurações de Faturação
    regime_fiscal: 'normal',
    serie_documentos: '',
    numeracao_automatica: true,
    moeda_faturacao: '',
    percentual_imposto_padrao: '',
    // Valores padrão para recibos de matrícula
    taxa_matricula_padrao: '',
    mensalidade_padrao: '',
    // Valores padrão para emissão de documentos e itens obrigatórios
    valor_emissao_declaracao: '',
    valor_emissao_certificado: '',
    valor_passe: '',
    multi_campus: false,
    impressao_direta: false,
    formato_padrao_impressao: 'A4',
    numero_copias_recibo: 1,
    nome_impressora_preferida: '',
    // Certificado Ensino Superior (Angola)
    ministerio_superior: '',
    decreto_criacao: '',
    nome_chefe_daa: '',
    nome_director_geral: '',
    localidade_certificado: '',
    cargo_assinatura1: '',
    cargo_assinatura2: '',
    texto_fecho_certificado: '',
    texto_rodape_certificado: '',
    bi_complementar_certificado: '',
    label_media_final_certificado: '',
    label_valores_certificado: '',
    // Certificado Ensino Secundário (Angola - II Ciclo)
    republica_angola: '',
    governo_provincia: '',
    escola_nome_numero: '',
    ensino_geral: '',
    titulo_certificado_secundario: '',
    texto_fecho_certificado_secundario: '',
    cargo_assinatura_1_secundario: '',
    cargo_assinatura_2_secundario: '',
    nome_assinatura_1_secundario: '',
    nome_assinatura_2_secundario: '',
    label_resultado_final_secundario: '',
  });

  const [landingDraft, setLandingDraft] = useState<LandingPublico>(() => defaultLandingPublico());
  
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [capaPreview, setCapaPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [imagemFundoDocFile, setImagemFundoDocFile] = useState<File | null>(null);
  const [imagemFundoDocPreview, setImagemFundoDocPreview] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ open: boolean; html: string | null; pdfBase64?: string | null; loading: boolean }>({ open: false, html: null, pdfBase64: null, loading: false });

  // Buscar dados da instituição para multa, juros e tipo identificado
  // Incluir tipoAcademico na queryKey para recarregar quando o tipo mudar
  // IMPORTANTE: Multi-tenant - usar getMe() que extrai instituicaoId do JWT
  // Não enviar instituicaoId do frontend
  const { data: instituicaoData } = useQuery({
    queryKey: ['instituicao', instituicaoId, config?.tipo_academico],
    queryFn: async () => {
      if (!instituicaoId) return null;
      return await instituicoesApi.getMe();
    },
    enabled: !!instituicaoId,
  });

  useEffect(() => {
    const v = (instituicaoData as { dominioCustomizado?: string | null; dominio_customizado?: string | null } | null)?.dominioCustomizado
      ?? (instituicaoData as { dominio_customizado?: string | null } | null)?.dominio_customizado;
    if (v === undefined) return;
    setDominioCustomDraft(v ?? "");
  }, [instituicaoData]);

  const dominioCustomGuardado = (
    (instituicaoData as { dominioCustomizado?: string | null } | null)?.dominioCustomizado ??
    (instituicaoData as { dominio_customizado?: string | null } | null)?.dominio_customizado ??
    ""
  ).trim();

  // Tipo acadêmico (prioridade - fonte mais confiável)
  // Buscar em diferentes formatos possíveis (camelCase e snake_case)
  // FALLBACK: instituições antigas ou do onboarding podem ter tipoInstituicao mas não tipoAcademico
  const tipoInstituicaoRaw = instituicaoData?.tipoInstituicao 
    || instituicaoData?.tipo_instituicao 
    || config?.tipo_instituicao 
    || config?.tipoInstituicao;
  
  let tipoAcademico = instituicaoData?.tipoAcademico 
    || instituicaoData?.tipo_academico 
    || config?.tipoAcademico 
    || config?.tipo_academico 
    || null;
  
  // Fallback para produção: inferir tipoAcademico a partir de tipoInstituicao (onboarding já define)
  if (!tipoAcademico && tipoInstituicaoRaw) {
    if (tipoInstituicaoRaw === 'UNIVERSIDADE') {
      tipoAcademico = 'SUPERIOR';
    } else if (tipoInstituicaoRaw === 'ENSINO_MEDIO') {
      tipoAcademico = 'SECUNDARIO';
    }
    // MISTA: mantém null - certificados usam showSuperior/showSecundario com fallback
  }
  
  // Para exibição de certificados: usar tipoInstituicao como fallback (instituições do onboarding)
  const showCertificadoSuperior = tipoAcademico === 'SUPERIOR' || tipoInstituicaoRaw === 'UNIVERSIDADE' || tipoInstituicaoRaw === 'MISTA';
  const showCertificadoSecundario = tipoAcademico === 'SECUNDARIO' || tipoInstituicaoRaw === 'ENSINO_MEDIO' || tipoInstituicaoRaw === 'MISTA';
  
  // Tipo identificado automaticamente (read-only)
  let tipoIdentificado: string;
  if (tipoAcademico === 'SUPERIOR') {
    tipoIdentificado = 'UNIVERSIDADE';
  } else if (tipoAcademico === 'SECUNDARIO') {
    tipoIdentificado = 'ENSINO_MEDIO';
  } else {
    tipoIdentificado = tipoInstituicaoRaw || 'EM_CONFIGURACAO';
  }
  
  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'UNIVERSIDADE':
        return 'Ensino Superior';
      case 'ENSINO_MEDIO':
        return 'Ensino Secundário';
      case 'MISTA':
        return 'Instituição Mista';
      case 'EM_CONFIGURACAO':
        return 'Em Configuração';
      default:
        return tipo;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'UNIVERSIDADE':
        return <GraduationCap className="h-4 w-4" />;
      case 'ENSINO_MEDIO':
        return <School className="h-4 w-4" />;
      case 'MISTA':
        return <Building2 className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    if (config) {
      // Obter cores padrão baseadas no tipo acadêmico ATUAL
      const defaultColors = getDefaultColorsByTipoAcademico(tipoAcademico);
      
      // Verificar se há cores personalizadas cadastradas
      const temCoresPersonalizadas = config.cor_primaria && config.cor_secundaria && config.cor_terciaria;
      
      // Se não há cores definidas OU se o tipo acadêmico mudou e não há cores personalizadas,
      // usar cores padrão do tipo acadêmico atual
      // Caso contrário, manter as cores personalizadas existentes
      const cor_primaria = temCoresPersonalizadas ? config.cor_primaria : defaultColors.cor_primaria;
      const cor_secundaria = temCoresPersonalizadas ? config.cor_secundaria : defaultColors.cor_secundaria;
      const cor_terciaria = temCoresPersonalizadas ? config.cor_terciaria : defaultColors.cor_terciaria;
      
      setFormData(prev => ({
        ...prev,
        // Carregar nome da instituição automaticamente da tabela instituicoes
        // Respeitando tipo de instituição e outras informações
        nome_instituicao: config.nome_instituicao 
          || instituicaoData?.nome 
          || instituicaoData?.nomeInstituicao 
          || '',
        cor_primaria,
        cor_secundaria,
        cor_terciaria,
        // Carregar outras informações automaticamente da tabela instituicoes
        email: config.email 
          || instituicaoData?.emailContato 
          || instituicaoData?.email_contato 
          || '',
        telefone: config.telefone 
          || instituicaoData?.telefone 
          || '',
        endereco: config.endereco 
          || instituicaoData?.endereco 
          || '',
        descricao: config.descricao || '',
        multa_percentual: instituicaoData?.multaPercentual?.toString() || instituicaoData?.multa_percentual?.toString() || '2',
        juros_dia: instituicaoData?.jurosDia?.toString() || instituicaoData?.juros_dia?.toString() || '0.033',
        // Dados Gerais
        pais: config.pais || config.paisFiscal || '',
        moeda_padrao: config.moedaPadrao || config.moeda_padrao || 'AOA',
        idioma: config.idioma || 'pt',
        // Dados Fiscais
        // Carregar nome fiscal automaticamente do nome da instituição quando não estiver definido
        nome_fiscal: config.nomeFiscal 
          || config.nome_fiscal 
          || instituicaoData?.nome 
          || instituicaoData?.nomeInstituicao 
          || '',
        email_fiscal: config.emailFiscal || config.email_fiscal || config.email || '',
        telefone_fiscal: config.telefoneFiscal || config.telefone_fiscal || config.telefone || '',
        endereco_fiscal: config.enderecoFiscal || config.endereco_fiscal || config.endereco || '',
        cidade_fiscal: config.cidadeFiscal || config.cidade_fiscal || '',
        provincia_fiscal: config.provinciaFiscal || config.provincia_fiscal || '',
        pais_fiscal: config.paisFiscal || config.pais_fiscal || config.pais || '',
        codigo_postal_fiscal: config.codigoPostalFiscal || config.codigo_postal_fiscal || '',
        // Identificação Fiscal
        nif: config.nif || '',
        software_certificate_number: config.softwareCertificateNumber || config.software_certificate_number || '',
        cnpj: config.cnpj || '',
        inscricao_estadual: config.inscricaoEstadual || config.inscricao_estadual || '',
        codigo_servico_financas: config.codigoServicoFinancas || config.codigo_servico_financas || '',
        identificacao_fiscal_generica: config.identificacaoFiscalGenerica || config.identificacao_fiscal_generica || '',
        // Configurações de Faturação
        regime_fiscal: config.regimeFiscal || config.regime_fiscal || 'normal',
        serie_documentos: config.serieDocumentos || config.serie_documentos || '',
        numeracao_automatica: config.numeracaoAutomatica !== undefined ? config.numeracaoAutomatica : (config.numeracao_automatica !== undefined ? config.numeracao_automatica : true),
        moeda_faturacao: config.moedaFaturacao || config.moeda_faturacao || config.moedaPadrao || config.moeda_padrao || 'AOA',
        percentual_imposto_padrao: config.percentualImpostoPadrao?.toString() || config.percentual_imposto_padrao?.toString() || '',
        taxa_matricula_padrao: config.taxaMatriculaPadrao?.toString() || config.taxa_matricula_padrao?.toString() || '',
        mensalidade_padrao: config.mensalidadePadrao?.toString() || config.mensalidade_padrao?.toString() || '',
        valor_emissao_declaracao: config.valorEmissaoDeclaracao?.toString() || config.valor_emissao_declaracao?.toString() || '',
        valor_emissao_certificado: config.valorEmissaoCertificado?.toString() || config.valor_emissao_certificado?.toString() || '',
        valor_passe: config.valorPasse?.toString() || config.valor_passe?.toString() || '',
        multi_campus: config.multiCampus ?? config.multi_campus ?? false,
        impressao_direta: config.impressaoDireta ?? config.impressao_direta ?? false,
        formato_padrao_impressao: config.formatoPadraoImpressao ?? config.formato_padrao_impressao ?? 'A4',
        numero_copias_recibo: config.numeroCopiasRecibo ?? config.numero_copias_recibo ?? 1,
        nome_impressora_preferida: config.nomeImpressoraPreferida ?? config.nome_impressora_preferida ?? '',
        ministerio_superior: config.ministerioSuperior ?? config.ministerio_superior ?? '',
        decreto_criacao: config.decretoCriacao ?? config.decreto_criacao ?? '',
        nome_chefe_daa: config.nomeChefeDaa ?? config.nome_chefe_daa ?? '',
        nome_director_geral: config.nomeDirectorGeral ?? config.nome_director_geral ?? '',
        localidade_certificado: config.localidadeCertificado ?? config.localidade_certificado ?? '',
        cargo_assinatura1: config.cargoAssinatura1 ?? config.cargo_assinatura1 ?? '',
        cargo_assinatura2: config.cargoAssinatura2 ?? config.cargo_assinatura2 ?? '',
        texto_fecho_certificado: config.textoFechoCertificado ?? config.texto_fecho_certificado ?? '',
        texto_rodape_certificado: config.textoRodapeCertificado ?? config.texto_rodape_certificado ?? '',
        bi_complementar_certificado: config.biComplementarCertificado ?? config.bi_complementar_certificado ?? '',
        label_media_final_certificado: config.labelMediaFinalCertificado ?? config.label_media_final_certificado ?? '',
        label_valores_certificado: config.labelValoresCertificado ?? config.label_valores_certificado ?? '',
        republica_angola: config.republicaAngola ?? config.republica_angola ?? '',
        governo_provincia: config.governoProvincia ?? config.governo_provincia ?? '',
        escola_nome_numero: config.escolaNomeNumero ?? config.escola_nome_numero ?? '',
        ensino_geral: config.ensinoGeral ?? config.ensino_geral ?? '',
        titulo_certificado_secundario: config.tituloCertificadoSecundario ?? config.titulo_certificado_secundario ?? '',
        texto_fecho_certificado_secundario: config.textoFechoCertificadoSecundario ?? config.texto_fecho_certificado_secundario ?? '',
        cargo_assinatura_1_secundario: config.cargoAssinatura1Secundario ?? config.cargo_assinatura_1_secundario ?? '',
        cargo_assinatura_2_secundario: config.cargoAssinatura2Secundario ?? config.cargo_assinatura_2_secundario ?? '',
        nome_assinatura_1_secundario: config.nomeAssinatura1Secundario ?? config.nome_assinatura_1_secundario ?? '',
        nome_assinatura_2_secundario: config.nomeAssinatura2Secundario ?? config.nome_assinatura_2_secundario ?? '',
        label_resultado_final_secundario: config.labelResultadoFinalSecundario ?? config.label_resultado_final_secundario ?? '',
      }));
      setLogoPreview(config.logo_url || config.logoUrl || null);
      setCapaPreview(config.imagem_capa_login_url || config.imagemCapaLoginUrl || null);
      setFaviconPreview(config.favicon_url || config.faviconUrl || null);
      setImagemFundoDocPreview(config.imagem_fundo_documento_url || config.imagemFundoDocumentoUrl || null);
      const rawLanding =
        (config as { landingPublico?: unknown }).landingPublico ??
        (config as { landing_publico?: unknown }).landing_publico;
      setLandingDraft(parseLandingPublico(rawLanding));
    }
  }, [config, instituicaoData, tipoAcademico]);

  const saveLandingMutation = useMutation({
    mutationFn: async () => {
      await configuracoesInstituicaoApi.update({
        landingPublico: { ...landingDraft },
      });
    },
    onSuccess: () => {
      void refetch();
      queryClient.invalidateQueries({ queryKey: ['instituicao'] });
      queryClient.invalidateQueries({ queryKey: ['configuracao'] });
      toast({
        title: 'Site público guardado',
        description: 'A página institucional foi atualizada.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Não foi possível guardar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleResetColors = () => {
    // Restaurar cores padrão baseadas no tipo acadêmico da instituição
    const defaultColors = getDefaultColorsByTipoAcademico(tipoAcademico);
    setFormData(prev => ({ ...prev, ...defaultColors }));
    
    const tipoLabel = tipoAcademico === 'SUPERIOR' 
      ? 'Ensino Superior' 
      : tipoAcademico === 'SECUNDARIO' 
        ? 'Ensino Secundário' 
        : 'padrão';
    
    toast({
      title: "Cores resetadas",
      description: `As cores foram restauradas para os valores padrão do ${tipoLabel}. Salve para aplicar permanentemente.`,
    });
  };

  const handlePreviewDocumento = async (tipo: 'CERTIFICADO' | 'DECLARACAO_MATRICULA' | 'DECLARACAO_FREQUENCIA', tipoCertificado?: 'SUPERIOR' | 'SECUNDARIO') => {
    const tipoEff = tipo === 'CERTIFICADO' 
      ? (tipoCertificado || tipoAcademico) 
      : (tipoAcademico || (tipoInstituicaoRaw === 'UNIVERSIDADE' || tipoInstituicaoRaw === 'MISTA' ? 'SUPERIOR' : tipoInstituicaoRaw === 'ENSINO_MEDIO' ? 'SECUNDARIO' : null));
    if (!tipoEff || (tipoEff !== 'SUPERIOR' && tipoEff !== 'SECUNDARIO')) return;
    setPreviewDoc({ open: true, html: null, loading: true });
    try {
      const configOverride: Record<string, string | null> = {};
      if (tipo === 'CERTIFICADO' && tipoEff === 'SUPERIOR') {
        Object.assign(configOverride, {
          ministerio_superior: formData.ministerio_superior || null,
          decreto_criacao: formData.decreto_criacao || null,
          nome_chefe_daa: formData.nome_chefe_daa || null,
          nome_director_geral: formData.nome_director_geral || null,
          localidade_certificado: formData.localidade_certificado || null,
          cargo_assinatura1: formData.cargo_assinatura1 || null,
          cargo_assinatura2: formData.cargo_assinatura2 || null,
          texto_fecho_certificado: formData.texto_fecho_certificado || null,
          texto_rodape_certificado: formData.texto_rodape_certificado || null,
          bi_complementar_certificado: formData.bi_complementar_certificado || null,
          label_media_final_certificado: formData.label_media_final_certificado || null,
          label_valores_certificado: formData.label_valores_certificado || null,
        });
      } else if (tipo === 'CERTIFICADO' && tipoEff === 'SECUNDARIO') {
        Object.assign(configOverride, {
          republica_angola: formData.republica_angola || null,
          governo_provincia: formData.governo_provincia || null,
          escola_nome_numero: formData.escola_nome_numero || null,
          ensino_geral: formData.ensino_geral || null,
          titulo_certificado_secundario: formData.titulo_certificado_secundario || null,
          texto_fecho_certificado_secundario: formData.texto_fecho_certificado_secundario || null,
          cargo_assinatura_1_secundario: formData.cargo_assinatura_1_secundario || null,
          cargo_assinatura_2_secundario: formData.cargo_assinatura_2_secundario || null,
          nome_assinatura_1_secundario: formData.nome_assinatura_1_secundario || null,
          nome_assinatura_2_secundario: formData.nome_assinatura_2_secundario || null,
          label_resultado_final_secundario: formData.label_resultado_final_secundario || null,
          localidade_certificado: formData.localidade_certificado || null,
          bi_complementar_certificado: formData.bi_complementar_certificado || null,
          label_valores_certificado: formData.label_valores_certificado || null,
        });
      } else {
        // Declarações: localidade, assinaturas (compartilhados com certificado)
        Object.assign(configOverride, {
          localidade_certificado: formData.localidade_certificado || null,
          nome_director_geral: formData.nome_director_geral || null,
          nome_chefe_daa: formData.nome_chefe_daa || null,
          cargo_assinatura1: formData.cargo_assinatura1 || null,
          cargo_assinatura2: formData.cargo_assinatura2 || null,
          cargo_assinatura_1_secundario: formData.cargo_assinatura_1_secundario || null,
          cargo_assinatura_2_secundario: formData.cargo_assinatura_2_secundario || null,
          nome_assinatura_1_secundario: formData.nome_assinatura_1_secundario || null,
          nome_assinatura_2_secundario: formData.nome_assinatura_2_secundario || null,
        });
      }
      const res = await configuracoesInstituicaoApi.previewDocumento({
        tipo,
        tipoAcademico: tipoEff,
        configOverride: Object.keys(configOverride).length ? configOverride : undefined,
      });
      setPreviewDoc({ open: true, html: res.html ?? null, pdfBase64: res.pdfBase64 ?? null, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar pré-visualização';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
      setPreviewDoc(prev => ({ ...prev, loading: false }));
    }
  };

  // Mutação específica para salvar apenas as cores
  const saveColorsMutation = useMutation({
    mutationFn: async () => {
      if (!instituicaoId) {
        throw new Error('Nenhuma instituição vinculada ao usuário');
      }

      // IMPORTANTE: Multi-tenant - instituicaoId vem do JWT, não precisa enviar
      await configuracoesInstituicaoApi.update({
        corPrimaria: formData.cor_primaria,
        corSecundaria: formData.cor_secundaria,
        corTerciaria: formData.cor_terciaria,
      });
    },
    onSuccess: () => {
      // Refetch para atualizar o contexto da instituição
      // O ThemeProvider aplicará as cores automaticamente quando o contexto for atualizado
      refetch();
      
      // Invalidar queries relacionadas para garantir atualização em toda a aplicação
      queryClient.invalidateQueries({ queryKey: ['instituicao', instituicaoId] });
      queryClient.invalidateQueries({ queryKey: ['configuracao', instituicaoId] });
      
      toast({
        title: "Cores salvas",
        description: "As cores foram salvas e aplicadas em todo o layout da instituição.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar cores",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas arquivos JPG e PNG são permitidos.",
        variant: "destructive",
      });
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 1MB.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCapaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setCapaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setCapaPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleImagemFundoDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas JPG e PNG são permitidos para imagem de fundo.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 1MB.",
        variant: "destructive",
      });
      return;
    }
    setImagemFundoDocFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagemFundoDocPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar formato (PNG, ICO, SVG)
      const allowedTypes = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Formato inválido",
          description: "Apenas arquivos PNG, ICO e SVG são permitidos para favicon.",
          variant: "destructive",
        });
        return;
      }
      // Validar tamanho (até 1MB)
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 1MB.",
          variant: "destructive",
        });
        return;
      }
      setFaviconFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFaviconPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validação básica de email fiscal (apenas se preenchido)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.email_fiscal && formData.email_fiscal.trim() && !emailRegex.test(formData.email_fiscal.trim())) {
        throw new Error('Email fiscal inválido. Verifique o formato do email ou deixe o campo em branco.');
      }

      let logoUrl = config?.logo_url || config?.logoUrl;
      let capaUrl = config?.imagem_capa_login_url || config?.imagemCapaLoginUrl;
      let faviconUrl = config?.favicon_url || config?.faviconUrl;
      let imagemFundoDocUrl = config?.imagem_fundo_documento_url || config?.imagemFundoDocumentoUrl;

      // Usar upload para o banco (sem volume/S3) - persiste em Railway/Vercel
      if (logoFile || capaFile || faviconFile || imagemFundoDocFile) {
        const uploadResult = await configuracoesInstituicaoApi.uploadAssets({
          logo: logoFile || undefined,
          capa: capaFile || undefined,
          favicon: faviconFile || undefined,
          imagemFundoDocumento: imagemFundoDocFile || undefined,
        });
        if (uploadResult.logoUrl) logoUrl = uploadResult.logoUrl;
        if (uploadResult.imagemCapaLoginUrl) capaUrl = uploadResult.imagemCapaLoginUrl;
        if (uploadResult.faviconUrl) faviconUrl = uploadResult.faviconUrl;
        if (uploadResult.imagemFundoDocumentoUrl) imagemFundoDocUrl = uploadResult.imagemFundoDocumentoUrl;
      }

      if (!instituicaoId) {
        throw new Error('Nenhuma instituição vinculada ao usuário');
      }

      // Preparar payload removendo campos vazios/null/undefined inválidos
      const payload: any = {};
      
      // Campos obrigatórios ou sempre enviados
      if (formData.nome_instituicao?.trim()) {
        payload.nomeInstituicao = formData.nome_instituicao.trim();
      }
      if (logoUrl) payload.logoUrl = logoUrl;
      if (capaUrl) payload.imagemCapaLoginUrl = capaUrl;
      if (faviconUrl) payload.faviconUrl = faviconUrl;
      if (imagemFundoDocUrl) payload.imagemFundoDocumentoUrl = imagemFundoDocUrl;
      if (formData.cor_primaria) payload.corPrimaria = formData.cor_primaria;
      if (formData.cor_secundaria) payload.corSecundaria = formData.cor_secundaria;
      if (formData.cor_terciaria) payload.corTerciaria = formData.cor_terciaria;
      // Garantir que numeracaoAutomatica seja sempre um boolean válido
      payload.numeracaoAutomatica = Boolean(formData.numeracao_automatica);
      
      // Campos opcionais - apenas enviar se tiver valor
      if (formData.email?.trim()) payload.email = formData.email.trim();
      if (formData.telefone?.trim()) payload.telefone = formData.telefone.trim();
      if (formData.endereco?.trim()) payload.endereco = formData.endereco.trim();
      if (formData.descricao?.trim()) payload.descricao = formData.descricao.trim();
      
      // Dados Gerais
      if (formData.pais?.trim()) payload.pais = formData.pais.trim();
      if (formData.moeda_padrao?.trim()) payload.moedaPadrao = formData.moeda_padrao.trim();
      if (formData.idioma?.trim()) payload.idioma = formData.idioma.trim();
      
      // Dados Fiscais
      if (formData.nome_fiscal?.trim()) payload.nomeFiscal = formData.nome_fiscal.trim();
      if (formData.email_fiscal?.trim()) payload.emailFiscal = formData.email_fiscal.trim();
      if (formData.telefone_fiscal?.trim()) payload.telefoneFiscal = formData.telefone_fiscal.trim();
      if (formData.endereco_fiscal?.trim()) payload.enderecoFiscal = formData.endereco_fiscal.trim();
      if (formData.cidade_fiscal?.trim()) payload.cidadeFiscal = formData.cidade_fiscal.trim();
      if (formData.provincia_fiscal?.trim()) payload.provinciaFiscal = formData.provincia_fiscal.trim();
      if (formData.pais_fiscal?.trim()) payload.paisFiscal = formData.pais_fiscal.trim();
      if (formData.codigo_postal_fiscal?.trim()) payload.codigoPostalFiscal = formData.codigo_postal_fiscal.trim();
      
      // Identificação Fiscal
      if (formData.nif?.trim()) payload.nif = formData.nif.trim();
      if (formData.software_certificate_number?.trim()) payload.softwareCertificateNumber = formData.software_certificate_number.trim();
      if (formData.cnpj?.trim()) payload.cnpj = formData.cnpj.trim();
      if (formData.inscricao_estadual?.trim()) payload.inscricaoEstadual = formData.inscricao_estadual.trim();
      if (formData.codigo_servico_financas?.trim()) payload.codigoServicoFinancas = formData.codigo_servico_financas.trim();
      if (formData.identificacao_fiscal_generica?.trim()) payload.identificacaoFiscalGenerica = formData.identificacao_fiscal_generica.trim();
      
      // Configurações de Faturação
      if (formData.regime_fiscal?.trim()) payload.regimeFiscal = formData.regime_fiscal.trim();
      if (formData.serie_documentos?.trim()) payload.serieDocumentos = formData.serie_documentos.trim();
      if (formData.moeda_faturacao?.trim()) payload.moedaFaturacao = formData.moeda_faturacao.trim();
      
      const taxaMatricula = (() => {
        const v = formData.taxa_matricula_padrao?.trim();
        if (!v || v === '') return undefined;
        const num = parseFloat(v);
        return isNaN(num) || num < 0 ? undefined : num;
      })();
      if (taxaMatricula !== undefined) payload.taxaMatriculaPadrao = taxaMatricula;
      const mensalidade = (() => {
        const v = formData.mensalidade_padrao?.trim();
        if (!v || v === '') return undefined;
        const num = parseFloat(v);
        return isNaN(num) || num < 0 ? undefined : num;
      })();
      if (mensalidade !== undefined) payload.mensalidadePadrao = mensalidade;
      const valorEmissaoDecl = (() => {
        const v = formData.valor_emissao_declaracao?.trim();
        if (!v || v === '') return undefined;
        const num = parseFloat(v);
        return isNaN(num) || num < 0 ? undefined : num;
      })();
      if (valorEmissaoDecl !== undefined) payload.valorEmissaoDeclaracao = valorEmissaoDecl;
      const valorEmissaoCert = (() => {
        const v = formData.valor_emissao_certificado?.trim();
        if (!v || v === '') return undefined;
        const num = parseFloat(v);
        return isNaN(num) || num < 0 ? undefined : num;
      })();
      if (valorEmissaoCert !== undefined) payload.valorEmissaoCertificado = valorEmissaoCert;
      const valorPasse = (() => {
        const v = formData.valor_passe?.trim();
        if (!v || v === '') return undefined;
        const num = parseFloat(v);
        return isNaN(num) || num < 0 ? undefined : num;
      })();
      if (valorPasse !== undefined) payload.valorPasse = valorPasse;
      
      const percentualImposto = (() => {
        const value = formData.percentual_imposto_padrao?.trim();
        if (!value || value === '') return undefined;
        const num = parseFloat(value);
        return isNaN(num) || num < 0 ? undefined : num;
      })();
      if (percentualImposto !== undefined) {
        payload.percentualImpostoPadrao = percentualImposto;
      }
      if (hasMultiCampus) {
        payload.multiCampus = Boolean(formData.multi_campus);
      }
      payload.impressaoDireta = Boolean(formData.impressao_direta);
      if (formData.formato_padrao_impressao) payload.formatoPadraoImpressao = formData.formato_padrao_impressao;
      const numCopias = Number(formData.numero_copias_recibo);
      if (!isNaN(numCopias) && numCopias >= 1 && numCopias <= 3) payload.numeroCopiasRecibo = numCopias;
      payload.nomeImpressoraPreferida = formData.nome_impressora_preferida?.trim() || null;

      payload.ministerioSuperior = formData.ministerio_superior?.trim() || null;
      payload.decretoCriacao = formData.decreto_criacao?.trim() || null;
      payload.nomeChefeDaa = formData.nome_chefe_daa?.trim() || null;
      payload.nomeDirectorGeral = formData.nome_director_geral?.trim() || null;
      payload.localidadeCertificado = formData.localidade_certificado?.trim() || null;
      payload.cargoAssinatura1 = formData.cargo_assinatura1?.trim() || null;
      payload.cargoAssinatura2 = formData.cargo_assinatura2?.trim() || null;
      payload.textoFechoCertificado = formData.texto_fecho_certificado?.trim() || null;
      payload.textoRodapeCertificado = formData.texto_rodape_certificado?.trim() || null;
      payload.biComplementarCertificado = formData.bi_complementar_certificado?.trim() || null;
      payload.labelMediaFinalCertificado = formData.label_media_final_certificado?.trim() || null;
      payload.labelValoresCertificado = formData.label_valores_certificado?.trim() || null;

      payload.republicaAngola = formData.republica_angola?.trim() || null;
      payload.governoProvincia = formData.governo_provincia?.trim() || null;
      payload.escolaNomeNumero = formData.escola_nome_numero?.trim() || null;
      payload.ensinoGeral = formData.ensino_geral?.trim() || null;
      payload.tituloCertificadoSecundario = formData.titulo_certificado_secundario?.trim() || null;
      payload.textoFechoCertificadoSecundario = formData.texto_fecho_certificado_secundario?.trim() || null;
      payload.cargoAssinatura1Secundario = formData.cargo_assinatura_1_secundario?.trim() || null;
      payload.cargoAssinatura2Secundario = formData.cargo_assinatura_2_secundario?.trim() || null;
      payload.nomeAssinatura1Secundario = formData.nome_assinatura_1_secundario?.trim() || null;
      payload.nomeAssinatura2Secundario = formData.nome_assinatura_2_secundario?.trim() || null;
      payload.labelResultadoFinalSecundario = formData.label_resultado_final_secundario?.trim() || null;

      // IMPORTANTE: Multi-tenant - instituicaoId vem do JWT, não precisa enviar
      // Salvar configurações principais e, em paralelo, atualizar multa/juros da instituição
      const updatePromises: Promise<unknown>[] = [];
      updatePromises.push(configuracoesInstituicaoApi.update(payload));

      if (instituicaoId) {
        updatePromises.push(
          instituicoesApi.update(instituicaoId, {
            multaPercentual: parseFloat(formData.multa_percentual) || undefined,
            jurosDia: parseFloat(formData.juros_dia) || undefined,
          })
        );
      }

      await Promise.all(updatePromises);
    },
    onSuccess: () => {
      void refetch(); // em background, não bloqueia feedback ao utilizador
      queryClient.invalidateQueries({ queryKey: ['instituicao'] });
      queryClient.invalidateQueries({ queryKey: ['configuracao'] });
      setLogoFile(null);
      setCapaFile(null);
      setFaviconFile(null);
      setImagemFundoDocFile(null);
      toast({
        title: t('pages.configSaved'),
        description: t('pages.configSavedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() =>
    tabFromUrl === 'avancadas'
      ? 'avancadas'
      : tabFromUrl === 'horarios'
        ? 'horarios'
        : tabFromUrl === 'documentos'
          ? 'documentos'
          : tabFromUrl === 'notificacoes'
            ? 'notificacoes'
            : tabFromUrl === 'site-publico'
              ? 'site-publico'
              : tabFromUrl === 'dominio'
                ? 'dominio'
                : 'geral'
  );

  // Sincronizar aba quando URL mudar (ex: link direto)
  useEffect(() => {
    if (tabFromUrl === 'avancadas') setActiveTab('avancadas');
    else if (tabFromUrl === 'horarios') setActiveTab('horarios');
    else if (tabFromUrl === 'documentos') setActiveTab('documentos');
    else if (tabFromUrl === 'notificacoes') setActiveTab('notificacoes');
    else if (tabFromUrl === 'site-publico') setActiveTab('site-publico');
    else if (tabFromUrl === 'dominio') setActiveTab('dominio');
    else if (tabFromUrl === 'geral') setActiveTab('geral');
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams(value !== 'geral' ? { tab: value } : {}, { replace: true });
  };

  // Estado para parâmetros do sistema
  const [parametrosData, setParametrosData] = useState({
    quantidadeSemestresPorAno: 2,
    duracaoHoraAulaMinutos: null as number | null,
    intervaloEntreDisciplinasMinutos: 15 as number | null,
    intervaloLongoMinutos: 0 as number,
    intervaloLongoAposBloco: 2 as number,
    limiteAulasSeguidasProfessor: 4 as number | null,
    permitirReprovacaoDisciplina: true,
    permitirDependencia: true,
    permitirMatriculaForaPeriodo: false,
    bloquearMatriculaDivida: true,
    permitirTransferenciaTurma: true,
    permitirMatriculaSemDocumentos: false,
    tipoMedia: 'simples' as 'simples' | 'ponderada',
    permitirExameRecurso: false,
    percentualMinimoAprovacao: 10,
    notaMinimaZonaExameRecurso: 7,
    perfisAlterarNotas: ['ADMIN', 'PROFESSOR'] as string[],
    perfisCancelarMatricula: ['ADMIN'] as string[],
    ativarLogsAcademicos: true,
    descontoFaltaProfessorTipo: 'VALOR_AULA' as 'VALOR_AULA' | 'PERCENTAGEM' | 'NUMERICO',
    descontoFaltaProfessorValor: null as number | null,
    superiorModeloCalculo: 'PAUTA_3_PROVAS' as 'PAUTA_3_PROVAS' | 'AC_EXAME_PONDERADO',
    superiorPesoAc: null as number | null,
    superiorPesoExame: null as number | null,
    superiorNotaMinimaAcContaExame: 10 as number | null,
    superiorBloquearExameSeAcInsuficiente: false,
    superiorAcTipoCalculo: 'MEDIA_ARITMETICA' as 'MEDIA_ARITMETICA' | 'PONDERADA_P1_P2_TRAB',
    superiorPesoAv1: null as number | null,
    superiorPesoAv2: null as number | null,
    superiorPesoTrab: null as number | null,
    superiorRecursoModo: 'MEDIA_COM_MF' as 'MEDIA_COM_MF' | 'APROVACAO_DIRETA',
    pautaLabelsSuperior: { ...DEFAULT_PAUTA_LABELS_SUPERIOR } as Record<string, string>,
    pautaLabelsSecundario: { ...DEFAULT_PAUTA_LABELS_SECUNDARIO } as Record<string, string>,
    secundarioPesoMac: null as number | null,
    secundarioPesoNpp: null as number | null,
    secundarioPesoNpt: null as number | null,
  });

  // Buscar parâmetros do sistema
  const { data: parametros } = useQuery({
    queryKey: ['parametros-sistema', instituicaoId],
    queryFn: async () => {
      if (!instituicaoId) return null;
      // IMPORTANTE: Multi-tenant - instituicaoId vem do JWT, não precisa enviar
      return await parametrosSistemaApi.get();
    },
    enabled: !!instituicaoId && (activeTab === 'avancadas' || activeTab === 'horarios'),
  });

  useEffect(() => {
    if (parametros) {
      setParametrosData({
        // SECUNDARIO não usa semestres (usa trimestres) - sempre null. SUPERIOR usa 2 por padrão.
        quantidadeSemestresPorAno: tipoAcademico === 'SECUNDARIO' ? null : (parametros.quantidadeSemestresPorAno ?? 2),
        duracaoHoraAulaMinutos: parametros.duracaoHoraAulaMinutos ?? (tipoAcademico === 'SECUNDARIO' ? 45 : tipoAcademico === 'SUPERIOR' ? 60 : null),
        intervaloEntreDisciplinasMinutos: parametros.intervaloEntreDisciplinasMinutos ?? 15,
        intervaloLongoMinutos: parametros.intervaloLongoMinutos ?? 0,
        intervaloLongoAposBloco: parametros.intervaloLongoAposBloco ?? 2,
        limiteAulasSeguidasProfessor: parametros.limiteAulasSeguidasProfessor ?? 4,
        permitirReprovacaoDisciplina: parametros.permitirReprovacaoDisciplina ?? true,
        permitirDependencia: parametros.permitirDependencia ?? true,
        permitirMatriculaForaPeriodo: parametros.permitirMatriculaForaPeriodo ?? false,
        bloquearMatriculaDivida: parametros.bloquearMatriculaDivida ?? true,
        permitirTransferenciaTurma: parametros.permitirTransferenciaTurma ?? true,
        permitirMatriculaSemDocumentos: parametros.permitirMatriculaSemDocumentos ?? false,
        tipoMedia: parametros.tipoMedia ?? 'simples',
        permitirExameRecurso: parametros.permitirExameRecurso ?? false,
        percentualMinimoAprovacao: parametros.percentualMinimoAprovacao ?? 10,
        notaMinimaZonaExameRecurso: Number(parametros.notaMinimaZonaExameRecurso ?? 7),
        perfisAlterarNotas: parametros.perfisAlterarNotas ?? ['ADMIN', 'PROFESSOR'],
        perfisCancelarMatricula: parametros.perfisCancelarMatricula ?? ['ADMIN'],
        ativarLogsAcademicos: parametros.ativarLogsAcademicos ?? true,
        descontoFaltaProfessorTipo: parametros.descontoFaltaProfessorTipo ?? 'VALOR_AULA',
        descontoFaltaProfessorValor: parametros.descontoFaltaProfessorValor != null ? parseFloat(parametros.descontoFaltaProfessorValor) : null,
        superiorModeloCalculo:
          parametros.superiorModeloCalculo === 'AC_EXAME_PONDERADO' ? 'AC_EXAME_PONDERADO' : 'PAUTA_3_PROVAS',
        superiorPesoAc:
          parametros.superiorPesoAc != null && parametros.superiorPesoAc !== ''
            ? Number(parametros.superiorPesoAc)
            : null,
        superiorPesoExame:
          parametros.superiorPesoExame != null && parametros.superiorPesoExame !== ''
            ? Number(parametros.superiorPesoExame)
            : null,
        superiorNotaMinimaAcContaExame:
          parametros.superiorNotaMinimaAcContaExame != null && parametros.superiorNotaMinimaAcContaExame !== ''
            ? Number(parametros.superiorNotaMinimaAcContaExame)
            : 10,
        superiorBloquearExameSeAcInsuficiente: Boolean(parametros.superiorBloquearExameSeAcInsuficiente),
        superiorAcTipoCalculo:
          parametros.superiorAcTipoCalculo === 'PONDERADA_P1_P2_TRAB'
            ? 'PONDERADA_P1_P2_TRAB'
            : 'MEDIA_ARITMETICA',
        superiorPesoAv1:
          parametros.superiorPesoAv1 != null && parametros.superiorPesoAv1 !== ''
            ? Number(parametros.superiorPesoAv1)
            : null,
        superiorPesoAv2:
          parametros.superiorPesoAv2 != null && parametros.superiorPesoAv2 !== ''
            ? Number(parametros.superiorPesoAv2)
            : null,
        superiorPesoTrab:
          parametros.superiorPesoTrab != null && parametros.superiorPesoTrab !== ''
            ? Number(parametros.superiorPesoTrab)
            : null,
        superiorRecursoModo:
          parametros.superiorRecursoModo === 'APROVACAO_DIRETA' ? 'APROVACAO_DIRETA' : 'MEDIA_COM_MF',
        pautaLabelsSuperior: mergePautaLabelsSuperior(parametros.pautaLabelsSuperior),
        pautaLabelsSecundario: mergePautaLabelsSecundario(parametros.pautaLabelsSecundario),
        secundarioPesoMac:
          parametros.secundarioPesoMac != null && parametros.secundarioPesoMac !== ''
            ? Number(parametros.secundarioPesoMac)
            : null,
        secundarioPesoNpp:
          parametros.secundarioPesoNpp != null && parametros.secundarioPesoNpp !== ''
            ? Number(parametros.secundarioPesoNpp)
            : null,
        secundarioPesoNpt:
          parametros.secundarioPesoNpt != null && parametros.secundarioPesoNpt !== ''
            ? Number(parametros.secundarioPesoNpt)
            : null,
        // Campos de sistema (readonly)
        tenantId: parametros.tenantId || instituicaoId || null,
        versaoSistema: parametros.versaoSistema || 'DSICOLA v1.0',
        ambiente: parametros.ambiente || (import.meta.env.MODE === 'production' ? 'Produção' : 'Homologação'),
        ultimaAtualizacao: parametros.ultimaAtualizacao || parametros.updatedAt || null,
        statusBackupAutomatico: parametros.statusBackupAutomatico || 'Inativo',
        proximoBackup: parametros.proximoBackup || null,
        ultimoBackup: parametros.ultimoBackup || null,
      });
    }
  }, [parametros, instituicaoId, tipoAcademico]);

  // Campos editáveis dos parâmetros (não enviar tenantId, versaoSistema, etc.)
  const CAMPOS_PARAMETROS_EDITAVEIS = [
    'quantidadeSemestresPorAno', 'duracaoHoraAulaMinutos', 'intervaloEntreDisciplinasMinutos', 'intervaloLongoMinutos', 'intervaloLongoAposBloco', 'limiteAulasSeguidasProfessor',
    'permitirReprovacaoDisciplina', 'permitirDependencia',
    'permitirMatriculaForaPeriodo', 'bloquearMatriculaDivida', 'permitirTransferenciaTurma',
    'permitirMatriculaSemDocumentos', 'tipoMedia', 'permitirExameRecurso',
    'percentualMinimoAprovacao', 'notaMinimaZonaExameRecurso', 'perfisAlterarNotas', 'perfisCancelarMatricula',
    'ativarLogsAcademicos', 'descontoFaltaProfessorTipo', 'descontoFaltaProfessorValor',
    'superiorModeloCalculo', 'superiorPesoAc', 'superiorPesoExame', 'superiorNotaMinimaAcContaExame',
    'superiorBloquearExameSeAcInsuficiente',
    'superiorAcTipoCalculo',
    'superiorPesoAv1',
    'superiorPesoAv2',
    'superiorPesoTrab',
    'superiorRecursoModo',
    'pautaLabelsSuperior',
    'pautaLabelsSecundario',
    'secundarioPesoMac',
    'secundarioPesoNpp',
    'secundarioPesoNpt',
  ] as const;

  // Mutação para salvar parâmetros
  const saveParametrosMutation = useMutation({
    mutationFn: async () => {
      if (!instituicaoId) {
        throw new Error('Nenhuma instituição vinculada ao usuário');
      }
      const payload: Record<string, unknown> = {};
      for (const k of CAMPOS_PARAMETROS_EDITAVEIS) {
        if (parametrosData[k] === undefined) continue;
        if (tipoAcademico === 'SECUNDARIO' && (k.startsWith('superior') || k === 'pautaLabelsSuperior')) continue;
        if (
          tipoAcademico === 'SUPERIOR' &&
          (k === 'pautaLabelsSecundario' || k.startsWith('secundarioPeso'))
        ) {
          continue;
        }
        // Ensino Secundário não usa quantidadeSemestresPorAno (usa trimestres) - não enviar ou enviar null
        if (k === 'quantidadeSemestresPorAno' && tipoAcademico === 'SECUNDARIO') {
          payload[k] = null;
        } else {
          payload[k] = parametrosData[k];
        }
      }
      await parametrosSistemaApi.update(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametros-sistema'] });
      toast({
        title: "Parâmetros salvos",
        description: "As configurações avançadas foram atualizadas com sucesso.",
      });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message || 'Erro ao salvar parâmetros';
      toast({
        title: "Não foi possível salvar",
        description: msg,
        variant: "destructive",
      });
    },
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const nomePlaceholder = tipoAcademico === 'SUPERIOR' 
    ? 'Ex: Universidade de Luanda' 
    : tipoAcademico === 'SECUNDARIO' 
      ? 'Ex: Instituto Secundário do Kuito' 
      : 'Ex: Nome da instituição';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/admin-dashboard">{t('pages.dashboard')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('pages.configuracoes')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin-dashboard")}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('pages.configuracoesInstituicao')}</h1>
                {tipoAcademico && (
                  <Badge variant="secondary" className="font-normal">
                    {tipoAcademico === 'SUPERIOR' ? (
                      <><GraduationCap className="h-3.5 w-3.5 mr-1" /> {t('pages.ensinoSuperior')}</>
                    ) : (
                      <><School className="h-3.5 w-3.5 mr-1" /> {t('pages.ensinoSecundario')}</>
                    )}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('pages.configuracoesInstituicaoDesc')}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin-dashboard/configuracao-ensino")}
            className="shrink-0"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Configuração de Ensinos
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7 gap-1 h-auto py-1">
            <TabsTrigger value="geral" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="dominio" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Domínio
            </TabsTrigger>
            <TabsTrigger value="site-publico" className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Site público
            </TabsTrigger>
            <TabsTrigger value="horarios" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horários
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="avancadas" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Avançadas
            </TabsTrigger>
          </TabsList>

          {/* Aba Geral */}
          <TabsContent value="geral" className="space-y-6">

        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
            <CardDescription>
              Configure o nome e informações de contato da instituição
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Instituição</Label>
                <Input
                  id="nome"
                  value={formData.nome_instituicao}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome_instituicao: e.target.value }))}
                  placeholder={nomePlaceholder}
                />
              </div>
              {tipoAcademico ? (
                <div className="space-y-2">
                  <Label htmlFor="tipoAcademico">Tipo Acadêmico</Label>
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                    {tipoAcademico === 'SUPERIOR' ? (
                      <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <School className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="font-medium">
                      {tipoAcademico === 'SUPERIOR' ? 'Ensino Superior' : 'Ensino Secundário'}
                    </span>
                    <Badge variant="outline" className="ml-auto text-xs font-normal">Detectado automaticamente</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tipoAcademico === 'SUPERIOR' 
                      ? 'A instituição foi identificada como Ensino Superior com base na estrutura acadêmica (cursos com semestres/créditos).'
                      : 'A instituição foi identificada como Ensino Secundário com base na estrutura acadêmica (classes/anos escolares).'}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Instituição</Label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                {getTipoIcon(tipoIdentificado)}
                <span className="font-medium">{getTipoLabel(tipoIdentificado)}</span>
                <Badge variant="outline" className="ml-auto text-xs font-normal">Identificado automaticamente</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {tipoAcademico 
                  ? `O tipo de instituição é determinado automaticamente com base no tipo acadêmico detectado (${tipoAcademico === 'SUPERIOR' ? 'Ensino Superior' : 'Ensino Secundário'}). O sistema "DSICOLA" será sempre o identificador, mas o nome da instituição será exibido de forma destacada.`
                  : 'O tipo é identificado automaticamente com base na estrutura acadêmica (cursos, disciplinas, semestres, trimestres, classes). Configure cursos e disciplinas para identificar o tipo.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contato@instituicao.ao"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="+244 923 456 789"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço
              </Label>
              <Textarea
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                placeholder="Rua..., Luanda, Angola"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição Institucional</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Uma breve descrição sobre a instituição que será exibida na página inicial..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Esta descrição será exibida na página institucional para visitantes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dados Gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Dados Gerais
            </CardTitle>
            <CardDescription>
              Configure país, moeda e idioma padrão da instituição
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pais">País</Label>
                <Select 
                  value={formData.pais || formData.pais_fiscal} 
                  onValueChange={(value) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      pais: value,
                      pais_fiscal: prev.pais_fiscal || value 
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o país" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Angola">Angola</SelectItem>
                    <SelectItem value="Portugal">Portugal</SelectItem>
                    <SelectItem value="Brasil">Brasil</SelectItem>
                    <SelectItem value="Moçambique">Moçambique</SelectItem>
                    <SelectItem value="Cabo Verde">Cabo Verde</SelectItem>
                    <SelectItem value="Guiné-Bissau">Guiné-Bissau</SelectItem>
                    <SelectItem value="São Tomé e Príncipe">São Tomé e Príncipe</SelectItem>
                    <SelectItem value="Timor-Leste">Timor-Leste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="moeda_padrao">Moeda Padrão</Label>
                <Select 
                  value={formData.moeda_padrao} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, moeda_padrao: value, moeda_faturacao: prev.moeda_faturacao || value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a moeda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AOA">AOA - Kwanza (Angola)</SelectItem>
                    <SelectItem value="EUR">EUR - Euro (Portugal)</SelectItem>
                    <SelectItem value="BRL">BRL - Real (Brasil)</SelectItem>
                    <SelectItem value="MZN">MZN - Metical (Moçambique)</SelectItem>
                    <SelectItem value="CVE">CVE - Escudo (Cabo Verde)</SelectItem>
                    <SelectItem value="XOF">XOF - Franco CFA (Guiné-Bissau)</SelectItem>
                    <SelectItem value="STN">STN - Dobra (São Tomé e Príncipe)</SelectItem>
                    <SelectItem value="USD">USD - Dólar (Timor-Leste)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="idioma">Idioma</Label>
                <Select 
                  value={formData.idioma} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, idioma: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="pt-AO">Português (Angola)</SelectItem>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="pt-PT">Português (Portugal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados Fiscais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dados Fiscais
            </CardTitle>
            <CardDescription>
              Informações fiscais obrigatórias para faturação, recibos, relatórios e SAFT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Campos Fiscais Comuns */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Informações Fiscais Básicas</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_fiscal">
                    Nome Fiscal da Instituição <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nome_fiscal"
                    value={formData.nome_fiscal}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome_fiscal: e.target.value }))}
                    placeholder="Nome completo para documentos fiscais"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_fiscal">
                    Email Fiscal / Contato <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email_fiscal"
                    type="email"
                    value={formData.email_fiscal}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_fiscal: e.target.value }))}
                    placeholder="fiscal@instituicao.ao"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Obrigatório para SAFT, recibos e relatórios fiscais
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone_fiscal">Telefone Fiscal</Label>
                  <Input
                    id="telefone_fiscal"
                    value={formData.telefone_fiscal}
                    onChange={(e) => setFormData(prev => ({ ...prev, telefone_fiscal: e.target.value }))}
                    placeholder="+244 923 456 789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_postal_fiscal">Código Postal</Label>
                  <Input
                    id="codigo_postal_fiscal"
                    value={formData.codigo_postal_fiscal}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo_postal_fiscal: e.target.value }))}
                    placeholder="0000-000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco_fiscal">Endereço Fiscal Completo</Label>
                <Textarea
                  id="endereco_fiscal"
                  value={formData.endereco_fiscal}
                  onChange={(e) => setFormData(prev => ({ ...prev, endereco_fiscal: e.target.value }))}
                  placeholder="Rua, número, bairro..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cidade_fiscal">Cidade</Label>
                  <Input
                    id="cidade_fiscal"
                    value={formData.cidade_fiscal}
                    onChange={(e) => setFormData(prev => ({ ...prev, cidade_fiscal: e.target.value }))}
                    placeholder="Luanda"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia_fiscal">Província / Estado</Label>
                  <Input
                    id="provincia_fiscal"
                    value={formData.provincia_fiscal}
                    onChange={(e) => setFormData(prev => ({ ...prev, provincia_fiscal: e.target.value }))}
                    placeholder="Luanda"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pais_fiscal">País Fiscal</Label>
                  <Select 
                    value={formData.pais_fiscal || formData.pais} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, pais_fiscal: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o país" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Angola">Angola</SelectItem>
                      <SelectItem value="Portugal">Portugal</SelectItem>
                      <SelectItem value="Brasil">Brasil</SelectItem>
                      <SelectItem value="Moçambique">Moçambique</SelectItem>
                      <SelectItem value="Cabo Verde">Cabo Verde</SelectItem>
                      <SelectItem value="Guiné-Bissau">Guiné-Bissau</SelectItem>
                      <SelectItem value="São Tomé e Príncipe">São Tomé e Príncipe</SelectItem>
                      <SelectItem value="Timor-Leste">Timor-Leste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Identificação Fiscal por País */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-semibold">Identificação Fiscal</h4>
              <p className="text-xs text-muted-foreground">
                Campos exibidos conforme o país selecionado
              </p>
              
              {/* Angola e Portugal - NIF */}
              {(formData.pais_fiscal === 'Angola' || formData.pais_fiscal === 'Portugal' || !formData.pais_fiscal) && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nif">NIF (Número de Identificação Fiscal)</Label>
                    <Input
                      id="nif"
                      value={formData.nif}
                      onChange={(e) => setFormData(prev => ({ ...prev, nif: e.target.value }))}
                      placeholder={formData.pais_fiscal === 'Portugal' ? '123456789' : '123456789LA045'}
                    />
                  </div>
                  {/* Angola - Certificado AGT (SAFT) */}
                  {(formData.pais_fiscal === 'Angola' || !formData.pais_fiscal) && (
                    <div className="space-y-2">
                      <Label htmlFor="software_certificate_number">Nº Certificado Software AGT (SAFT)</Label>
                      <Input
                        id="software_certificate_number"
                        value={formData.software_certificate_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, software_certificate_number: e.target.value }))}
                        placeholder="Ex: AGT-2025-12345 — obter após certificação"
                      />
                      <p className="text-xs text-muted-foreground">
                        Obrigatório para exportação SAFT em conformidade. Obtenha na AGT após aprovação do software.
                      </p>
                    </div>
                  )}
                  {formData.pais_fiscal === 'Portugal' && (
                    <div className="space-y-2 mt-2">
                      <Label htmlFor="codigo_servico_financas">Código do Serviço de Finanças (Opcional)</Label>
                      <Input
                        id="codigo_servico_financas"
                        value={formData.codigo_servico_financas}
                        onChange={(e) => setFormData(prev => ({ ...prev, codigo_servico_financas: e.target.value }))}
                        placeholder="Ex: 1234"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Brasil - CNPJ */}
              {formData.pais_fiscal === 'Brasil' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inscricao_estadual">Inscrição Estadual (Opcional)</Label>
                    <Input
                      id="inscricao_estadual"
                      value={formData.inscricao_estadual}
                      onChange={(e) => setFormData(prev => ({ ...prev, inscricao_estadual: e.target.value }))}
                      placeholder="123.456.789.012"
                    />
                  </div>
                </div>
              )}

              {/* Outros países CPLP */}
              {formData.pais_fiscal && 
               !['Angola', 'Portugal', 'Brasil'].includes(formData.pais_fiscal) && (
                <div className="space-y-2">
                  <Label htmlFor="identificacao_fiscal_generica">Identificação Fiscal</Label>
                  <Input
                    id="identificacao_fiscal_generica"
                    value={formData.identificacao_fiscal_generica}
                    onChange={(e) => setFormData(prev => ({ ...prev, identificacao_fiscal_generica: e.target.value }))}
                    placeholder="Número de identificação fiscal"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configurações de Faturação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Configurações de Faturação
            </CardTitle>
            <CardDescription>
              Configure o regime fiscal, séries de documentos e impostos padrão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="regime_fiscal">Regime Fiscal</Label>
                <Select 
                  value={formData.regime_fiscal} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, regime_fiscal: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o regime" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simplificado">Simplificado</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="isento">Isento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="moeda_faturacao">Moeda de Faturação</Label>
                <Select 
                  value={formData.moeda_faturacao || formData.moeda_padrao} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, moeda_faturacao: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a moeda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AOA">AOA - Kwanza</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="BRL">BRL - Real</SelectItem>
                    <SelectItem value="MZN">MZN - Metical</SelectItem>
                    <SelectItem value="CVE">CVE - Escudo</SelectItem>
                    <SelectItem value="XOF">XOF - Franco CFA</SelectItem>
                    <SelectItem value="STN">STN - Dobra</SelectItem>
                    <SelectItem value="USD">USD - Dólar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentual_imposto_padrao">Percentual de Imposto Padrão (%)</Label>
                <Input
                  id="percentual_imposto_padrao"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.percentual_imposto_padrao}
                  onChange={(e) => setFormData(prev => ({ ...prev, percentual_imposto_padrao: e.target.value }))}
                  placeholder="14.00"
                />
                <p className="text-xs text-muted-foreground">
                  Percentual de imposto aplicado por padrão nas faturas (se aplicável)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="taxa_matricula_padrao">Taxa de Matrícula Padrão (AOA)</Label>
                <Input
                  id="taxa_matricula_padrao"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.taxa_matricula_padrao}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxa_matricula_padrao: e.target.value }))}
                  placeholder="Ex: 45000"
                />
                <p className="text-xs text-muted-foreground">
                  Taxa de inscrição carregada automaticamente ao emitir matrícula (quando o curso/classe não tem taxa específica).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mensalidade_padrao">Mensalidade Padrão (AOA)</Label>
                <Input
                  id="mensalidade_padrao"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.mensalidade_padrao}
                  onChange={(e) => setFormData(prev => ({ ...prev, mensalidade_padrao: e.target.value }))}
                  placeholder="Ex: 5000"
                />
                <p className="text-xs text-muted-foreground">
                  Mensalidade carregada automaticamente ao emitir matrícula (quando o curso/classe não tem valor específico).
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="valor_emissao_declaracao">Valor Emissão Declaração (AOA)</Label>
                <Input
                  id="valor_emissao_declaracao"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.valor_emissao_declaracao}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor_emissao_declaracao: e.target.value }))}
                  placeholder="Ex: 500"
                />
                <p className="text-xs text-muted-foreground">
                  Taxa por emissão de declaração (matrícula, frequência). Cursos podem sobrescrever.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_emissao_certificado">Valor Emissão Certificado (AOA)</Label>
                <Input
                  id="valor_emissao_certificado"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.valor_emissao_certificado}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor_emissao_certificado: e.target.value }))}
                  placeholder="Ex: 2500"
                />
                <p className="text-xs text-muted-foreground">
                  Taxa por emissão de certificado. Cursos podem sobrescrever.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_passe">Valor Passe Padrão (AOA)</Label>
                <Input
                  id="valor_passe"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.valor_passe}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor_passe: e.target.value }))}
                  placeholder="Ex: 1500"
                />
                <p className="text-xs text-muted-foreground">
                  Valor padrão passe estudantil (quando institucional). Cursos/classes podem sobrescrever.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="multi_campus">Multi-campus</Label>
                <p className="text-xs text-muted-foreground">
                  {hasMultiCampus
                    ? 'Permite múltiplos campus na instituição (requer plano com multi-campus)'
                    : `O plano "${planoNome}" não inclui multi-campus. Atualize para Enterprise ou PRO para ativar.`}
                </p>
              </div>
              <Switch
                id="multi_campus"
                checked={formData.multi_campus}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, multi_campus: checked }))}
                disabled={!hasMultiCampus || planLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Favicon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Favicon
            </CardTitle>
            <CardDescription>
              Faça upload do favicon que será exibido na aba do navegador (máx. 1MB, PNG, ICO ou SVG)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {faviconPreview ? (
                  <div className="relative group">
                    <img
                      src={faviconPreview}
                      alt="Favicon preview"
                      className="w-16 h-16 object-contain rounded border bg-muted/50"
                    />
                    <button
                      onClick={() => {
                        setFaviconPreview(null);
                        setFaviconFile(null);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                    <Image className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept=".png,.ico,.svg,image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                  onChange={handleFaviconChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => faviconInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Escolher Favicon
                </Button>
                <p className="text-sm text-muted-foreground">
                  Tamanho recomendado: 32x32 ou 64x64 pixels. O favicon será aplicado automaticamente na aba do navegador.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Logo da Instituição
            </CardTitle>
            <CardDescription>
              Faça upload da logo que será exibida no cabeçalho e tela de login (máx. 1MB, JPG ou PNG)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {logoPreview ? (
                  <div className="relative group">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-32 h-32 object-contain rounded-lg border bg-muted/50"
                    />
                    <button
                      onClick={() => {
                        setLogoPreview(null);
                        setLogoFile(null);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                    <Building2 className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Escolher Logo
                </Button>
                <p className="text-sm text-muted-foreground">
                  Recomendamos uma imagem quadrada com fundo transparente para melhor visualização.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Imagem de Capa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Imagem de Capa do Login
            </CardTitle>
            <CardDescription>
              Faça upload da imagem de capa que será exibida na tela de login (máx. 1MB, JPG ou PNG)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {capaPreview ? (
                <div className="relative group">
                  <img
                    src={capaPreview}
                    alt="Capa preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => {
                      setCapaPreview(null);
                      setCapaFile(null);
                    }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                  <div className="text-center">
                    <Image className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma imagem selecionada</p>
                  </div>
                </div>
              )}
              <input
                ref={capaInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleCapaChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => capaInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Escolher Imagem de Capa
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Imagem de fundo dos documentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Imagem de fundo dos documentos
            </CardTitle>
            <CardDescription>
              {`Imagem de fundo para certificados e declarações. Use o placeholder ${PLACEHOLDER_IMAGEM_FUNDO} nos modelos importados com ${EXEMPLO_IMAGEM_FUNDO_STYLE} (máx. 1MB, JPG ou PNG)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {imagemFundoDocPreview ? (
                <div className="relative group">
                  <img
                    src={imagemFundoDocPreview}
                    alt="Imagem de fundo preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => {
                      setImagemFundoDocPreview(null);
                      setImagemFundoDocFile(null);
                    }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                  <div className="text-center">
                    <Image className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma imagem selecionada</p>
                  </div>
                </div>
              )}
              <input
                ref={imagemFundoDocInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleImagemFundoDocChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => imagemFundoDocInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Escolher imagem de fundo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cores */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Personalização de Cores
                </CardTitle>
                <CardDescription>
                  {tipoAcademico 
                    ? `Cores padrão aplicadas automaticamente para ${tipoAcademico === 'SUPERIOR' ? 'Ensino Superior' : 'Ensino Secundário'}. Você pode personalizar manualmente.`
                    : 'Defina as cores da sua instituição'
                  }
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleResetColors}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restaurar cores padrão do tipo de instituição
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => saveColorsMutation.mutate()} 
                  disabled={saveColorsMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveColorsMutation.isPending ? "Salvando..." : "Salvar Cores"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label>Cor Primária</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.cor_primaria}
                    onChange={(e) => setFormData(prev => ({ ...prev, cor_primaria: e.target.value }))}
                    className="w-12 h-12 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={formData.cor_primaria}
                    onChange={(e) => setFormData(prev => ({ ...prev, cor_primaria: e.target.value }))}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usada em botões, links e destaques
                </p>
              </div>

              <div className="space-y-3">
                <Label>Cor Secundária</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.cor_secundaria}
                    onChange={(e) => setFormData(prev => ({ ...prev, cor_secundaria: e.target.value }))}
                    className="w-12 h-12 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={formData.cor_secundaria}
                    onChange={(e) => setFormData(prev => ({ ...prev, cor_secundaria: e.target.value }))}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usada em textos e elementos secundários
                </p>
              </div>

              <div className="space-y-3">
                <Label>Cor Terciária</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.cor_terciaria}
                    onChange={(e) => setFormData(prev => ({ ...prev, cor_terciaria: e.target.value }))}
                    className="w-12 h-12 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={formData.cor_terciaria}
                    onChange={(e) => setFormData(prev => ({ ...prev, cor_terciaria: e.target.value }))}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usada em fundos e áreas de destaque
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium mb-3">Pré-visualização:</p>
              <div className="flex gap-4 items-center">
                <div
                  className="w-24 h-10 rounded flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: formData.cor_primaria }}
                >
                  Botão
                </div>
                <div
                  className="w-24 h-10 rounded flex items-center justify-center text-sm font-medium border"
                  style={{ backgroundColor: formData.cor_terciaria, color: formData.cor_secundaria }}
                >
                  Card
                </div>
                <span style={{ color: formData.cor_primaria }} className="font-medium">
                  Link de exemplo
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurações Financeiras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Configurações Financeiras
            </CardTitle>
            <CardDescription>
              Configure multas e juros para mensalidades vencidas (aplicados automaticamente)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="multa_percentual" className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Multa Percentual (%)
                </Label>
                <Input
                  id="multa_percentual"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.multa_percentual}
                  onChange={(e) => setFormData(prev => ({ ...prev, multa_percentual: e.target.value }))}
                  placeholder="2.00"
                />
                <p className="text-xs text-muted-foreground">
                  Percentual aplicado sobre o valor base da mensalidade quando vencida
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="juros_dia" className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Juros por Dia (%)
                </Label>
                <Input
                  id="juros_dia"
                  type="number"
                  step="0.001"
                  min="0"
                  max="10"
                  value={formData.juros_dia}
                  onChange={(e) => setFormData(prev => ({ ...prev, juros_dia: e.target.value }))}
                  placeholder="0.033"
                />
                <p className="text-xs text-muted-foreground">
                  Percentual de juros aplicado por dia de atraso sobre o valor base
                </p>
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
              <p className="text-sm font-medium mb-2">Como funciona:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Multa: aplicada uma vez quando a mensalidade vence</li>
                <li>Juros: calculados diariamente a partir da data de vencimento</li>
                <li>Valores padrão: Multa 2%, Juros 0.033% ao dia (≈1% ao mês)</li>
                <li>Configurações de curso têm prioridade sobre estas configurações</li>
              </ul>
            </div>
          </CardContent>
        </Card>

            {/* Save Button */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => navigate("/admin-dashboard")} disabled={saveMutation.isPending}>
                Cancelar
              </Button>
              <Button
                loading={saveMutation.isPending}
                loadingLabel="Salvando..."
                onClick={() => saveMutation.mutate()}
              >
                <Save className="h-4 w-4 mr-2" /> Salvar Configurações
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="dominio" className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                O endereço em{" "}
                <span className="font-medium text-foreground">
                  https://{instituicaoData?.subdominio ?? "…"}.{platformBase}
                </span>{" "}
                continua disponível. Um domínio próprio (Enterprise) permite que professores, encarregados e alunos
                acedam pelo hostname da instituição, em paralelo com o subdomínio da plataforma.
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full rounded-lg border px-4">
              <AccordionItem value="dns" className="border-b-0">
                <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline">
                  Instruções DNS (CNAME / alojamento)
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm text-muted-foreground space-y-3">
                  <p>
                    No painel DNS do seu domínio (ex.: Hostinger, Registro.br), crie um registo{" "}
                    <span className="font-medium text-foreground">CNAME</span> do nome que pretende usar (raiz ou{" "}
                    <code className="text-xs bg-muted px-1 rounded">www</code>) para o alvo indicado pelo alojamento da
                    app (muitas vezes um hostname do tipo Vercel).
                  </p>
                  {cnameTargetHint ? (
                    <p>
                      Alvo sugerido para este projeto:{" "}
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                        {cnameTargetHint}
                      </code>
                      . Confirme com o suporte DSICOLA se este valor está atualizado para o seu ambiente.
                    </p>
                  ) : (
                    <p>
                      Defina a variável <code className="text-xs bg-muted px-1 rounded">VITE_CUSTOM_DOMAIN_CNAME_TARGET</code> no
                      build do frontend para mostrar aqui o alvo CNAME exato; até lá, siga o valor enviado pela equipa
                      técnica ou pelo painel do fornecedor de hospedagem.
                    </p>
                  )}
                  <p>
                    Domínio raiz (<code className="text-xs bg-muted px-1 rounded">@</code>) por vezes não aceita CNAME:
                    use <code className="text-xs bg-muted px-1 rounded">www</code> como CNAME ou configure os registos A/AAAA
                    que o fornecedor indicar. O certificado TLS (HTTPS) costuma ser tratado no painel de hospedagem.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  <Link2 className="h-5 w-5 text-primary shrink-0" />
                  Domínio de acesso
                  <Badge variant="secondary" className="ml-auto text-xs font-normal">
                    Enterprise
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Guarde o hostname exatamente como pedido ao DNS (sem{" "}
                  <code className="text-xs">https://</code> nem caminho).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!planLoading && !canDominoProprio ? (
                  <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-50">
                    Domínio próprio está incluído no plano Enterprise
                    {planoNome ? ` — plano atual: ${planoNome}.` : "."} Contacte o comercial para atualizar a assinatura.
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="dominio-custom-tab">Domínio próprio (hostname)</Label>
                  <Input
                    id="dominio-custom-tab"
                    disabled={!canDominoProprio || planLoading || !instituicaoId}
                    value={dominioCustomDraft}
                    onChange={(e) => setDominioCustomDraft(e.target.value)}
                    placeholder="ex.: minhaescola.edu.ao"
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    O subdomínio da plataforma mantém-se para suporte e contingência. Após alterar o DNS, pode usar
                    &quot;Verificar DNS&quot; (quando o servidor estiver configurado com os alvos esperados).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={!canDominoProprio || planLoading || !instituicaoId || dominioCustomSaving}
                    onClick={async () => {
                      if (!instituicaoId) return;
                      setDominioCustomSaving(true);
                      try {
                        const trimmed = dominioCustomDraft.trim();
                        await instituicoesApi.update(instituicaoId, {
                          dominioCustomizado: trimmed === "" ? null : trimmed,
                        });
                        await queryClient.invalidateQueries({ queryKey: ["instituicao", instituicaoId] });
                        toast({
                          title: "Domínio guardado",
                          description: "A configuração foi atualizada com sucesso.",
                        });
                      } catch (e: unknown) {
                        const msg =
                          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                          (e as Error)?.message ||
                          "Tente novamente.";
                        toast({
                          title: "Não foi possível guardar",
                          description: msg,
                          variant: "destructive",
                        });
                      } finally {
                        setDominioCustomSaving(false);
                      }
                    }}
                  >
                    {dominioCustomSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="h-4 w-4" aria-hidden />
                    )}
                    Guardar domínio
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !canDominoProprio ||
                      planLoading ||
                      !instituicaoId ||
                      dnsVerifyLoading ||
                      !dominioCustomGuardado
                    }
                    onClick={async () => {
                      if (!instituicaoId) return;
                      setDnsVerifyLoading(true);
                      setDnsVerifyResult(null);
                      try {
                        const r = await instituicoesApi.verificarDominioDns(instituicaoId);
                        setDnsVerifyResult(r);
                      } catch (e: unknown) {
                        const msg =
                          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                          (e as Error)?.message ||
                          "Não foi possível verificar.";
                        toast({
                          title: "Verificação DNS",
                          description: msg,
                          variant: "destructive",
                        });
                      } finally {
                        setDnsVerifyLoading(false);
                      }
                    }}
                  >
                    {dnsVerifyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                    ) : (
                      <Globe className="h-4 w-4 mr-2" aria-hidden />
                    )}
                    Verificar DNS
                  </Button>
                </div>
                {!dominioCustomGuardado ? (
                  <p className="text-xs text-muted-foreground">
                    Guarde primeiro o domínio próprio para poder verificar o DNS público.
                  </p>
                ) : null}
                {dnsVerifyResult ? (
                  <Alert variant={dnsVerifyResult.ok ? "default" : "destructive"}>
                    {!dnsVerifyResult.ok ? (
                      <XCircle className="h-4 w-4" aria-hidden />
                    ) : dnsVerifyResult.configuredOnServer ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    ) : (
                      <Info className="h-4 w-4" aria-hidden />
                    )}
                    <AlertTitle className="flex flex-wrap items-center gap-2">
                      {dnsVerifyResult.configuredOnServer === false ? "Verificação no servidor" : "Resultado DNS"}
                      {!dnsVerifyResult.ok ? (
                        <Badge variant="destructive" className="font-normal">
                          Atenção
                        </Badge>
                      ) : dnsVerifyResult.configuredOnServer ? (
                        <Badge variant="secondary" className="font-normal">
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-normal">
                          Info
                        </Badge>
                      )}
                    </AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{dnsVerifyResult.message}</p>
                      {dnsVerifyResult.records?.length ? (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1">Registos vistos na verificação:</p>
                          <ul className="text-xs font-mono list-disc list-inside space-y-0.5">
                            {dnsVerifyResult.records.map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Documentos (Certificados, Declarações) */}
          <TabsContent value="documentos" className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4 mb-4">
              <p className="text-sm text-muted-foreground">
                Configure os modelos de certificados e declarações oficiais. Os dados do estudante (nome, notas, ano, filiação) são preenchidos automaticamente pelo sistema.
              </p>
              {!showCertificadoSuperior && !showCertificadoSecundario && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  Tipo acadêmico não identificado. No onboarding o tipo é definido ao criar a instituição. Se a instituição foi criada antes, configure cursos/disciplinas ou o tipo em Configurações &gt; Geral. Os formulários aparecem conforme o tipo (multi-tenant: cada tipo vê apenas a sua configuração).
                </p>
              )}
            </div>

            {/* Acesso rápido: Modelos e Mapeamento de Documentos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Modelos e Mapeamento de Documentos
                </CardTitle>
                <CardDescription>
                  Importe modelos oficiais (Word, Excel, HTML), mapeie placeholders aos campos do sistema e configure certificados, declarações, boletins e pautas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="default">
                  <Link to="/admin-dashboard/certificados?tab=modelos&subtab=importados">
                    Abrir Modelos de Documentos
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Configurações de Impressão (recibos, certificados, declarações) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Impressão de Documentos
                </CardTitle>
                <CardDescription>
                  Defina o comportamento da impressão de recibos, certificados e declarações. A impressora é selecionada na janela de impressão do navegador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="impressao_direta">Impressão direta</Label>
                    <p className="text-xs text-muted-foreground">
                      Ao gerar recibo ou documento, abrir diretamente a janela de impressão (evita abrir em nova aba e clicar em imprimir)
                    </p>
                  </div>
                  <Switch
                    id="impressao_direta"
                    checked={formData.impressao_direta}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, impressao_direta: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="formato_padrao_impressao">Formato padrão (quando impressão direta está ativa)</Label>
                  <Select
                    value={formData.formato_padrao_impressao || 'A4'}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, formato_padrao_impressao: v }))}
                  >
                    <SelectTrigger id="formato_padrao_impressao">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 — Impressora tradicional</SelectItem>
                      <SelectItem value="TERMICO">80mm — Impressora térmica de balcão</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Formato do recibo/documento quando a impressão direta está ativa
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numero_copias_recibo">Número de cópias por recibo</Label>
                  <Select
                    value={String(formData.numero_copias_recibo ?? 1)}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, numero_copias_recibo: parseInt(v, 10) }))}
                  >
                    <SelectTrigger id="numero_copias_recibo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 cópia (original)</SelectItem>
                      <SelectItem value="2">2 cópias (original + via)</SelectItem>
                      <SelectItem value="3">3 cópias</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Para múltiplas cópias físicas, defina também na janela de impressão do navegador
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome_impressora_preferida">Impressora preferida (lembrete)</Label>
                  <Input
                    id="nome_impressora_preferida"
                    value={formData.nome_impressora_preferida || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome_impressora_preferida: e.target.value }))}
                    placeholder="Ex: Epson TM-T20, HP LaserJet..."
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome da impressora para referência. A seleção da impressora é feita na janela de impressão do navegador.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Série e Numeração de Documentos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Série e Numeração
                </CardTitle>
                <CardDescription>
                  Configure a série e numeração automática para faturas, recibos e documentos oficiais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="serie_documentos">Série de Documentos</Label>
                  <Input
                    id="serie_documentos"
                    value={formData.serie_documentos}
                    onChange={(e) => setFormData(prev => ({ ...prev, serie_documentos: e.target.value }))}
                    placeholder="Ex: A, B, C..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Série usada em faturas e recibos (ex: fatura série A)
                  </p>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="numeracao_automatica">Numeração automática</Label>
                    <p className="text-xs text-muted-foreground">
                      Gera números sequenciais automaticamente para faturas, recibos e documentos
                    </p>
                  </div>
                  <Switch
                    id="numeracao_automatica"
                    checked={formData.numeracao_automatica}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, numeracao_automatica: checked }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Certificado Ensino Superior - APENAS para instituições SUPERIOR (multi-tenant: não misturar) */}
            {showCertificadoSuperior && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        Certificado (Ensino Superior)
                      </CardTitle>
                      <CardDescription>
                        Informações institucionais para o certificado de conclusão de licenciatura
                      </CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => handlePreviewDocumento('CERTIFICADO', 'SUPERIOR')} className="shrink-0">
                    <Eye className="h-4 w-4 mr-2" />
                    Pré-visualizar
                  </Button>
                </div>
              </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ministerio_superior">Ministério</Label>
                    <Input id="ministerio_superior" value={formData.ministerio_superior || ''} onChange={(e) => setFormData(prev => ({ ...prev, ministerio_superior: e.target.value }))} placeholder="Ministério do Ensino Superior, Ciência, Tecnologia e Inovação" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="decreto_criacao">Decreto de criação</Label>
                    <Input id="decreto_criacao" value={formData.decreto_criacao || ''} onChange={(e) => setFormData(prev => ({ ...prev, decreto_criacao: e.target.value }))} placeholder="Decreto n.º 7/09, de 12 de Maio" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome_chefe_daa">Nome do Chefe do DAA</Label>
                      <Input id="nome_chefe_daa" value={formData.nome_chefe_daa || ''} onChange={(e) => setFormData(prev => ({ ...prev, nome_chefe_daa: e.target.value }))} placeholder="Ex: Msc. Aristides Jaime Yandelela Cânduta" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_director_geral">Nome do Director Geral</Label>
                      <Input id="nome_director_geral" value={formData.nome_director_geral || ''} onChange={(e) => setFormData(prev => ({ ...prev, nome_director_geral: e.target.value }))} placeholder="Ex: Prof. Alfredo Rodrigues Paulo" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="localidade_certificado">Localidade</Label>
                    <Input id="localidade_certificado" value={formData.localidade_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, localidade_certificado: e.target.value }))} placeholder="Ex: Kuito" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cargo_assinatura1">Cargo assinatura 1</Label>
                      <Input id="cargo_assinatura1" value={formData.cargo_assinatura1 || ''} onChange={(e) => setFormData(prev => ({ ...prev, cargo_assinatura1: e.target.value }))} placeholder="Ex: O CHEFE DO DAA" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cargo_assinatura2">Cargo assinatura 2</Label>
                      <Input id="cargo_assinatura2" value={formData.cargo_assinatura2 || ''} onChange={(e) => setFormData(prev => ({ ...prev, cargo_assinatura2: e.target.value }))} placeholder="Ex: O DIRECTOR GERAL" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="texto_fecho_certificado">Texto de fecho</Label>
                    <Textarea id="texto_fecho_certificado" value={formData.texto_fecho_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, texto_fecho_certificado: e.target.value }))} placeholder="E por ser verdade, e me ter sido solicitado mandei passar o presente Certificado..." rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="texto_rodape_certificado">Texto de rodapé (local e data)</Label>
                    <Textarea id="texto_rodape_certificado" value={formData.texto_rodape_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, texto_rodape_certificado: e.target.value }))} placeholder="Departamento para os Assuntos Académicos de [instituição], [localidade], aos [data]." rows={2} />
                    <p className="text-xs text-muted-foreground">Deixe vazio para usar o texto padrão com dados dinâmicos.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bi_complementar_certificado">Complemento do B.I.</Label>
                    <Input id="bi_complementar_certificado" value={formData.bi_complementar_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, bi_complementar_certificado: e.target.value }))} placeholder="passado pelo Arquivo de Identificação competente" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="label_media_final_certificado">Label média final</Label>
                      <Input id="label_media_final_certificado" value={formData.label_media_final_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, label_media_final_certificado: e.target.value }))} placeholder="Média Final da Licenciatura" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="label_valores_certificado">Label valores (notas)</Label>
                      <Input id="label_valores_certificado" value={formData.label_valores_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, label_valores_certificado: e.target.value }))} placeholder="Valores" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Certificado Ensino Secundário - APENAS para instituições SECUNDARIO (multi-tenant: não misturar) */}
            {showCertificadoSecundario && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <School className="h-5 w-5" />
                        Certificado (Ensino Secundário / II Ciclo)
                      </CardTitle>
                      <CardDescription>
                        Informações institucionais para o certificado de habilitações
                      </CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => handlePreviewDocumento('CERTIFICADO', 'SECUNDARIO')} className="shrink-0">
                      <Eye className="h-4 w-4 mr-2" />
                      Pré-visualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="republica_angola">República</Label>
                      <Input id="republica_angola" value={formData.republica_angola || ''} onChange={(e) => setFormData(prev => ({ ...prev, republica_angola: e.target.value }))} placeholder="REPÚBLICA DE ANGOLA" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="governo_provincia">Governo da Província</Label>
                      <Input id="governo_provincia" value={formData.governo_provincia || ''} onChange={(e) => setFormData(prev => ({ ...prev, governo_provincia: e.target.value }))} placeholder="GOVERNO DA PROVINCIA DE LUANDA" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="escola_nome_numero">Escola (nome e número)</Label>
                    <Input id="escola_nome_numero" value={formData.escola_nome_numero || ''} onChange={(e) => setFormData(prev => ({ ...prev, escola_nome_numero: e.target.value }))} placeholder="ESCOLA DO IIº CICLO DO ENSINO SECUNDÁRIO N° 5106 - NEVES & SOUSA" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ensino_geral">Ensino Geral</Label>
                    <Input id="ensino_geral" value={formData.ensino_geral || ''} onChange={(e) => setFormData(prev => ({ ...prev, ensino_geral: e.target.value }))} placeholder="ENSINO GERAL" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="localidade_certificado_sec">Localidade</Label>
                    <Input id="localidade_certificado_sec" value={formData.localidade_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, localidade_certificado: e.target.value }))} placeholder="Ex: Viana" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="titulo_certificado_secundario">Título do certificado</Label>
                    <Input id="titulo_certificado_secundario" value={formData.titulo_certificado_secundario || ''} onChange={(e) => setFormData(prev => ({ ...prev, titulo_certificado_secundario: e.target.value }))} placeholder="CERTIFICADO DE HABILITAÇÕES" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="texto_fecho_certificado_secundario">Texto de fecho</Label>
                    <Textarea id="texto_fecho_certificado_secundario" value={formData.texto_fecho_certificado_secundario || ''} onChange={(e) => setFormData(prev => ({ ...prev, texto_fecho_certificado_secundario: e.target.value }))} placeholder="Por ser verdade e me ter sido pedido, passo o presente certificado..." rows={2} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cargo_assinatura_1_secundario">Cargo assinatura 1</Label>
                      <Input id="cargo_assinatura_1_secundario" value={formData.cargo_assinatura_1_secundario || ''} onChange={(e) => setFormData(prev => ({ ...prev, cargo_assinatura_1_secundario: e.target.value }))} placeholder="O Subdirector Pedagógico" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cargo_assinatura_2_secundario">Cargo assinatura 2</Label>
                      <Input id="cargo_assinatura_2_secundario" value={formData.cargo_assinatura_2_secundario || ''} onChange={(e) => setFormData(prev => ({ ...prev, cargo_assinatura_2_secundario: e.target.value }))} placeholder="A Directora" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome_assinatura_1_secundario">Nome assinatura 1</Label>
                      <Input id="nome_assinatura_1_secundario" value={formData.nome_assinatura_1_secundario || ''} onChange={(e) => setFormData(prev => ({ ...prev, nome_assinatura_1_secundario: e.target.value }))} placeholder="Ex: Dibanzilua Tando Jones" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_assinatura_2_secundario">Nome assinatura 2</Label>
                      <Input id="nome_assinatura_2_secundario" value={formData.nome_assinatura_2_secundario || ''} onChange={(e) => setFormData(prev => ({ ...prev, nome_assinatura_2_secundario: e.target.value }))} placeholder="Ex: Madalena Galula César" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="label_resultado_final_secundario">Label resultado final</Label>
                    <Input id="label_resultado_final_secundario" value={formData.label_resultado_final_secundario || ''} onChange={(e) => setFormData(prev => ({ ...prev, label_resultado_final_secundario: e.target.value }))} placeholder="Resultado final" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bi_complementar_certificado_sec">Complemento do B.I.</Label>
                      <Input id="bi_complementar_certificado_sec" value={formData.bi_complementar_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, bi_complementar_certificado: e.target.value }))} placeholder="passado pelo Arquivo de Identificação competente" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="label_valores_certificado_sec">Label valores (notas)</Label>
                      <Input id="label_valores_certificado_sec" value={formData.label_valores_certificado || ''} onChange={(e) => setFormData(prev => ({ ...prev, label_valores_certificado: e.target.value }))} placeholder="Valores" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Declarações - sempre visível */}
            {(
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Declarações
                      </CardTitle>
                      <CardDescription>
                        Pré-visualize declarações de matrícula e frequência. Usa a mesma configuração institucional.
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button type="button" variant="outline" size="sm" onClick={() => handlePreviewDocumento('DECLARACAO_MATRICULA')}>
                        <Eye className="h-4 w-4 mr-2" />
                        Matrícula
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handlePreviewDocumento('DECLARACAO_FREQUENCIA')}>
                        <Eye className="h-4 w-4 mr-2" />
                        Frequência
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => handleTabChange('geral')}>
                Voltar
              </Button>
              <Button loading={saveMutation.isPending} loadingLabel="Salvando..." onClick={() => saveMutation.mutate()}>
                <Save className="h-4 w-4 mr-2" /> Salvar Configurações
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="site-publico" className="space-y-6">
            <CommunityDirectoryOffersAdmin />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5" />
                  Site público da instituição
                </CardTitle>
                <CardDescription>
                  Personalize a página inicial vista no subdomínio ou domínio próprio (visitantes e comunidade escolar).
                  A secção de oferta respeita automaticamente o tipo académico:{' '}
                  {tipoAcademico === 'SUPERIOR' ? 'cursos' : tipoAcademico === 'SECUNDARIO' ? 'classes' : 'cursos ou classes após deteção'}.
                  Use URLs <span className="font-mono text-xs">https://</span> nas redes. WhatsApp: apenas dígitos (ex. 244923000000).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                  <p className="text-sm font-semibold">Secções visíveis no site</p>
                  <p className="text-xs text-muted-foreground">
                    Active ou desactive blocos da página pública. A oferta formativa (cursos/classes) continua a respeitar o tipo de ensino da instituição.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
                      <Label htmlFor="lp-sec-hero" className="text-sm font-normal cursor-pointer">
                        Capa (hero) em destaque
                      </Label>
                      <Switch
                        id="lp-sec-hero"
                        checked={landingDraft.showHeroSection}
                        onCheckedChange={(v) => setLandingDraft((p) => ({ ...p, showHeroSection: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
                      <Label htmlFor="lp-sec-sobre" className="text-sm font-normal cursor-pointer">
                        Sobre e contactos na mesma secção
                      </Label>
                      <Switch
                        id="lp-sec-sobre"
                        checked={landingDraft.showAboutSection}
                        onCheckedChange={(v) => setLandingDraft((p) => ({ ...p, showAboutSection: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
                      <Label htmlFor="lp-sec-gal" className="text-sm font-normal cursor-pointer">
                        Galeria de imagens
                      </Label>
                      <Switch
                        id="lp-sec-gal"
                        checked={landingDraft.showGallerySection}
                        onCheckedChange={(v) => setLandingDraft((p) => ({ ...p, showGallerySection: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
                      <Label htmlFor="lp-sec-map" className="text-sm font-normal cursor-pointer">
                        Mapa (embed)
                      </Label>
                      <Switch
                        id="lp-sec-map"
                        checked={landingDraft.showMapSection}
                        onCheckedChange={(v) => setLandingDraft((p) => ({ ...p, showMapSection: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2 sm:col-span-2">
                      <Label htmlFor="lp-sec-ev" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                        Secção “Eventos em destaque”
                      </Label>
                      <Switch
                        id="lp-sec-ev"
                        checked={landingDraft.showEventsSection}
                        onCheckedChange={(v) => setLandingDraft((p) => ({ ...p, showEventsSection: v }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp-hero-badge">Selo acima do título (opcional)</Label>
                  <Input
                    id="lp-hero-badge"
                    value={landingDraft.heroBadge || ''}
                    onChange={(e) => setLandingDraft((p) => ({ ...p, heroBadge: e.target.value || null }))}
                    placeholder={`Ex.: Excelência académica · ${tipoAcademico === 'SUPERIOR' ? 'Ensino superior' : 'Ensino secundário'} — deixe vazio para o rótulo automático`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Substitui a linha pequena “Ensino superior / secundário” no topo do hero.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lp-hero-title">Título principal (hero)</Label>
                    <Input
                      id="lp-hero-title"
                      value={landingDraft.heroTitle || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, heroTitle: e.target.value || null }))}
                      placeholder="Deixe vazio para usar o nome da instituição"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp-hero-img">Imagem de fundo do hero (URL)</Label>
                    <Input
                      id="lp-hero-img"
                      value={landingDraft.heroImageUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, heroImageUrl: e.target.value || null }))}
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border bg-muted/15 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="lp-hero-overlay">Véu escuro sobre a capa (legibilidade do texto)</Label>
                    <span className="text-sm tabular-nums font-medium text-muted-foreground">
                      {landingDraft.heroOverlayOpacity}%
                    </span>
                  </div>
                  <Slider
                    id="lp-hero-overlay"
                    min={0}
                    max={100}
                    step={1}
                    value={[landingDraft.heroOverlayOpacity]}
                    onValueChange={(v) =>
                      setLandingDraft((p) => ({ ...p, heroOverlayOpacity: typeof v[0] === 'number' ? v[0] : p.heroOverlayOpacity }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Valores mais baixos deixam a fotografia mais visível; valores altos escurecem o fundo para o título destacar
                    (estilo institucional com texto sobre a imagem).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp-hero-sub">Subtítulo / mensagem de destaque</Label>
                  <Textarea
                    id="lp-hero-sub"
                    value={landingDraft.heroSubtitle || ''}
                    onChange={(e) => setLandingDraft((p) => ({ ...p, heroSubtitle: e.target.value || null }))}
                    rows={2}
                    placeholder="Uma frase sobre a sua instituição"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lp-about-title">Título da secção “Quem somos”</Label>
                    <Input
                      id="lp-about-title"
                      value={landingDraft.aboutTitle || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, aboutTitle: e.target.value || null }))}
                      placeholder="Quem somos"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp-about-text">Texto institucional</Label>
                  <Textarea
                    id="lp-about-text"
                    value={landingDraft.aboutText || ''}
                    onChange={(e) => setLandingDraft((p) => ({ ...p, aboutText: e.target.value || null }))}
                    rows={6}
                    placeholder="Missão, visão, histórico… (texto simples, sem HTML)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se vazio, será usada a “Descrição institucional” da aba Geral.
                  </p>
                </div>
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="lp-events-title">Título da secção de eventos</Label>
                    <Input
                      id="lp-events-title"
                      value={landingDraft.eventsSectionTitle || ''}
                      onChange={(e) =>
                        setLandingDraft((p) => ({ ...p, eventsSectionTitle: e.target.value.trim() || null }))
                      }
                      placeholder="Ex.: Eventos em destaque"
                      disabled={!landingDraft.showEventsSection}
                    />
                  </div>
                  {landingDraft.showEventsSection ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Até 8 entradas com título obrigatório. Imagem e botão “Saiba mais” são opcionais (URL{' '}
                        <code className="text-[10px]">https://</code> ou caminho interno como{' '}
                        <code className="text-[10px]">/inscricao</code>).
                      </p>
                      {landingDraft.eventsItems.map((ev, idx) => (
                        <div key={idx} className="rounded-md border bg-background/80 p-3 space-y-2 relative">
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label="Remover evento"
                              onClick={() =>
                                setLandingDraft((p) => ({
                                  ...p,
                                  eventsItems: p.eventsItems.filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Título</Label>
                              <Input
                                value={ev.title}
                                onChange={(e) => {
                                  const title = e.target.value;
                                  setLandingDraft((p) => ({
                                    ...p,
                                    eventsItems: p.eventsItems.map((it, i) => (i === idx ? { ...it, title } : it)),
                                  }));
                                }}
                                placeholder="Título do evento ou notícia"
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Subtítulo / texto curto</Label>
                              <Textarea
                                value={ev.subtitle || ''}
                                onChange={(e) => {
                                  const subtitle = e.target.value || null;
                                  setLandingDraft((p) => ({
                                    ...p,
                                    eventsItems: p.eventsItems.map((it, i) => (i === idx ? { ...it, subtitle } : it)),
                                  }));
                                }}
                                rows={2}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Data ou rótulo (ex.: 15 Mar 2026)</Label>
                              <Input
                                value={ev.dateLabel || ''}
                                onChange={(e) => {
                                  const dateLabel = e.target.value || null;
                                  setLandingDraft((p) => ({
                                    ...p,
                                    eventsItems: p.eventsItems.map((it, i) => (i === idx ? { ...it, dateLabel } : it)),
                                  }));
                                }}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Imagem (URL)</Label>
                              <Input
                                value={ev.imageUrl || ''}
                                onChange={(e) => {
                                  const imageUrl = e.target.value || null;
                                  setLandingDraft((p) => ({
                                    ...p,
                                    eventsItems: p.eventsItems.map((it, i) => (i === idx ? { ...it, imageUrl } : it)),
                                  }));
                                }}
                                placeholder="https://…"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Botão — texto</Label>
                              <Input
                                value={ev.ctaLabel || ''}
                                onChange={(e) => {
                                  const ctaLabel = e.target.value || null;
                                  setLandingDraft((p) => ({
                                    ...p,
                                    eventsItems: p.eventsItems.map((it, i) => (i === idx ? { ...it, ctaLabel } : it)),
                                  }));
                                }}
                                placeholder="Saiba mais"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Botão — link</Label>
                              <Input
                                value={ev.ctaUrl || ''}
                                onChange={(e) => {
                                  const ctaUrl = e.target.value || null;
                                  setLandingDraft((p) => ({
                                    ...p,
                                    eventsItems: p.eventsItems.map((it, i) => (i === idx ? { ...it, ctaUrl } : it)),
                                  }));
                                }}
                                placeholder="https://… / /inscricao"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      {landingDraft.eventsItems.length < 8 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() =>
                            setLandingDraft((p) => ({
                              ...p,
                              eventsItems: [...p.eventsItems, emptyLandingEventItem()],
                            }))
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar evento
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp-gallery">Galeria — URLs de imagens (uma por linha)</Label>
                  <Textarea
                    id="lp-gallery"
                    value={landingDraft.galleryUrls.join('\n')}
                    onChange={(e) =>
                      setLandingDraft((p) => ({
                        ...p,
                        galleryUrls: e.target.value
                          .split(/\r?\n/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    rows={4}
                    placeholder="https://…"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lp-wa">WhatsApp (apenas números)</Label>
                    <Input
                      id="lp-wa"
                      value={landingDraft.whatsappDigits || ''}
                      onChange={(e) =>
                        setLandingDraft((p) => ({
                          ...p,
                          whatsappDigits: e.target.value.replace(/\D/g, '').slice(0, 15) || null,
                        }))
                      }
                      placeholder="244923000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp-map">Mapa (URL de embed)</Label>
                    <Input
                      id="lp-map"
                      value={landingDraft.mapEmbedUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, mapEmbedUrl: e.target.value || null }))}
                      placeholder="https://www.google.com/maps/embed?…"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lp-ig">Instagram</Label>
                    <Input
                      id="lp-ig"
                      value={landingDraft.instagramUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, instagramUrl: e.target.value || null }))}
                      placeholder="https://instagram.com/…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp-fb">Facebook</Label>
                    <Input
                      id="lp-fb"
                      value={landingDraft.facebookUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, facebookUrl: e.target.value || null }))}
                      placeholder="https://facebook.com/…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp-yt">YouTube</Label>
                    <Input
                      id="lp-yt"
                      value={landingDraft.youtubeUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, youtubeUrl: e.target.value || null }))}
                      placeholder="https://youtube.com/…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp-li">LinkedIn</Label>
                    <Input
                      id="lp-li"
                      value={landingDraft.linkedinUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, linkedinUrl: e.target.value || null }))}
                      placeholder="https://linkedin.com/…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp-x">X (Twitter)</Label>
                    <Input
                      id="lp-x"
                      value={landingDraft.twitterUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, twitterUrl: e.target.value || null }))}
                      placeholder="https://x.com/…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp-tt">TikTok</Label>
                    <Input
                      id="lp-tt"
                      value={landingDraft.tiktokUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, tiktokUrl: e.target.value || null }))}
                      placeholder="https://tiktok.com/…"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                  <div className="space-y-1">
                    <Label htmlFor="lp-show-oferta">Mostrar oferta formativa</Label>
                    <p className="text-xs text-muted-foreground">
                      Lista {tipoAcademico === 'SECUNDARIO' ? 'classes' : 'cursos'} ativos (dados do sistema).
                    </p>
                  </div>
                  <Switch
                    id="lp-show-oferta"
                    checked={landingDraft.showAcademicOffer}
                    onCheckedChange={(v) => setLandingDraft((p) => ({ ...p, showAcademicOffer: v }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lp-cta-label">Botão extra — texto</Label>
                    <Input
                      id="lp-cta-label"
                      value={landingDraft.secondaryCtaLabel || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, secondaryCtaLabel: e.target.value || null }))}
                      placeholder="Ex.: Regulamento interno"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp-cta-url">Botão extra — URL</Label>
                    <Input
                      id="lp-cta-url"
                      value={landingDraft.secondaryCtaUrl || ''}
                      onChange={(e) => setLandingDraft((p) => ({ ...p, secondaryCtaUrl: e.target.value || null }))}
                      placeholder="https://… ou /caminho-interno"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setLandingDraft(defaultLandingPublico())}>
                    Repor campos desta página
                  </Button>
                  <Button
                    type="button"
                    disabled={saveLandingMutation.isPending}
                    onClick={() => saveLandingMutation.mutate()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Guardar site público
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Horários e Grade */}
          <TabsContent value="horarios" className="space-y-6">
            <HorariosGradeTab
              tipoAcademico={tipoAcademico}
              parametrosData={parametrosData}
              setParametrosData={setParametrosData}
              onSave={() => saveParametrosMutation.mutate()}
              isLoading={saveParametrosMutation.isPending}
            />
          </TabsContent>

          {/* Aba Notificações (Email, Telegram, SMS) - Admin configura triggers e canais */}
          <TabsContent value="notificacoes" className="space-y-6">
            <NotificacoesTab config={config} onRefetch={refetch} queryClient={queryClient} instituicaoId={instituicaoId} />
          </TabsContent>

          {/* Aba Configurações Avançadas */}
          <TabsContent value="avancadas" className="space-y-6">
            <ConfiguracoesAvancadas 
              tipoAcademico={tipoAcademico}
              parametrosData={parametrosData}
              setParametrosData={setParametrosData}
              onSave={() => saveParametrosMutation.mutate()}
              isLoading={saveParametrosMutation.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de pré-visualização de documento */}
      <Dialog open={previewDoc.open} onOpenChange={(open) => setPreviewDoc(prev => ({ ...prev, open }))}>
        <DialogContent className="w-[min(95vw,1200px)] max-w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Pré-visualização do documento</DialogTitle>
            <DialogDescription>
              Dados de exemplo. Os dados reais (nome, notas, ano, filiação) vêm do sistema ao emitir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
            {previewDoc.loading ? (
              <div className="flex items-center justify-center h-96 border rounded-lg bg-muted/30">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewDoc.pdfBase64 ? (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `data:application/pdf;base64,${previewDoc.pdfBase64}#view=FitH`;
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir em nova aba
                  </Button>
                </div>
                <iframe
                  src={`data:application/pdf;base64,${previewDoc.pdfBase64}#view=FitH`}
                  title="Pré-visualização"
                  className="w-full min-h-[calc(90vh-10rem)] border rounded-lg border-0"
                />
              </div>
            ) : previewDoc.html ? (
              <iframe
                srcDoc={injectCertificatePreviewStyles(previewDoc.html)}
                title="Pré-visualização"
                className="w-full min-h-[calc(90vh-8rem)] border rounded-lg bg-white"
                sandbox="allow-same-origin"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

const TRIGGERS_PADRAO: Record<string, { enabled: boolean; canais: string[] }> = {
  conta_criada: { enabled: true, canais: ['email'] },
  funcionario_criado: { enabled: true, canais: ['email'] },
  matricula_realizada: { enabled: true, canais: ['email'] },
  pagamento_confirmado: { enabled: true, canais: ['email'] },
  mensalidade_estornada: { enabled: true, canais: ['email'] },
  mensalidade_pendente: { enabled: false, canais: ['email'] },
};

const TRIGGER_LABELS: Record<string, string> = {
  conta_criada: 'Conta criada (aluno)',
  funcionario_criado: 'Funcionário/Professor cadastrado',
  matricula_realizada: 'Matrícula realizada',
  pagamento_confirmado: 'Pagamento confirmado',
  mensalidade_estornada: 'Mensalidade estornada',
  mensalidade_pendente: 'Mensalidade pendente (broadcast)',
};

const CANAIS = ['email', 'telegram', 'sms'] as const;

// Aba dedicada: Notificações (Email, Telegram, SMS) - Admin configura triggers e canais
function NotificacoesTab({
  config,
  onRefetch,
  queryClient,
  instituicaoId,
}: {
  config: { notificacaoConfig?: { triggers?: Record<string, { enabled: boolean; canais: string[] }> } } | null;
  onRefetch: () => Promise<void>;
  queryClient: import('@tanstack/react-query').QueryClient;
  instituicaoId: string | null;
}) {
  const raw = config?.notificacaoConfig?.triggers;
  const [triggers, setTriggers] = useState<Record<string, { enabled: boolean; canais: string[] }>>(() => {
    const merged: Record<string, { enabled: boolean; canais: string[] }> = {};
    for (const key of Object.keys(TRIGGERS_PADRAO)) {
      const t = raw?.[key];
      merged[key] = t
        ? { enabled: !!t.enabled, canais: Array.isArray(t.canais) ? t.canais.filter(c => CANAIS.includes(c as any)) : ['email'] }
        : TRIGGERS_PADRAO[key];
    }
    return merged;
  });

  useEffect(() => {
    if (!raw) return;
    setTriggers((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(TRIGGERS_PADRAO)) {
        const t = raw[key];
        if (t) next[key] = { enabled: !!t.enabled, canais: Array.isArray(t.canais) ? t.canais.filter(c => CANAIS.includes(c as any)) : ['email'] };
      }
      return next;
    });
  }, [config?.notificacaoConfig?.triggers]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await configuracoesInstituicaoApi.update({ notificacaoConfig: { triggers } });
    },
    onSuccess: async () => {
      await onRefetch();
      queryClient.invalidateQueries({ queryKey: ['instituicao', instituicaoId] });
      queryClient.invalidateQueries({ queryKey: ['configuracao', instituicaoId] });
      toast({ title: 'Configurações de notificações salvas', description: 'As alterações foram aplicadas.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: () => mensalidadesApi.broadcastPendentes(),
    onSuccess: (data) => {
      toast({
        title: 'Broadcast enviado',
        description: data?.mensagem ?? `Enviado para ${data?.enviados ?? 0} de ${data?.totalDestinatarios ?? 0} alunos.`,
      });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro no broadcast', description: e.message, variant: 'destructive' });
    },
  });

  const toggleCanal = (triggerKey: string, canal: string) => {
    setTriggers((prev) => {
      const t = prev[triggerKey];
      const canais = t.canais.includes(canal) ? t.canais.filter((c) => c !== canal) : [...t.canais, canal];
      return { ...prev, [triggerKey]: { ...t, canais: canais.length ? canais : ['email'] } };
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações por canal
        </CardTitle>
        <CardDescription>
          Defina em quais eventos enviar mensagens e por quais canais (Email, Telegram, SMS). O admin controla tudo aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.keys(TRIGGERS_PADRAO).map((key) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg">
            <div className="flex-1 min-w-0">
              <Label className="font-medium">{TRIGGER_LABELS[key]}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {key === 'mensalidade_pendente' ? 'Envia broadcast a todos os alunos com mensalidade pendente ou atrasada' : key === 'mensalidade_estornada' ? 'Notificação enviada ao aluno quando um pagamento é estornado' : 'Notificação enviada automaticamente quando o evento ocorre'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={triggers[key]?.enabled ?? false}
                  onCheckedChange={(checked) =>
                    setTriggers((prev) => ({ ...prev, [key]: { ...prev[key], enabled: checked } }))
                  }
                />
                <span className="text-sm">Ativo</span>
              </div>
              {triggers[key]?.enabled && (
                <div className="flex items-center gap-4">
                  {CANAIS.map((c) => (
                    <div key={c} className="flex items-center gap-2">
                      <Checkbox
                        id={`${key}-${c}`}
                        checked={triggers[key]?.canais.includes(c) ?? false}
                        onCheckedChange={() => toggleCanal(key, c)}
                      />
                      <Label htmlFor={`${key}-${c}`} className="text-sm capitalize">{c}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-4">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar configurações
          </Button>
          <Button variant="outline" onClick={() => broadcastMutation.mutate()} disabled={broadcastMutation.isPending}>
            {broadcastMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar aviso mensalidades pendentes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Aba dedicada: Horários e Grade (duração da aula, intervalos)
function HorariosGradeTab({
  tipoAcademico,
  parametrosData,
  setParametrosData,
  onSave,
  isLoading,
}: {
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null;
  parametrosData: any;
  setParametrosData: (data: any) => void;
  onSave: () => void;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horários e Grade
        </CardTitle>
        <CardDescription>
          Duração da aula, intervalo entre disciplinas e pausa (recreio/almoço). Usado na sugestão automática e na geração de horários.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {tipoAcademico === 'SUPERIOR' && (
          <div className="space-y-2">
            <Label htmlFor="quantidadeSemestresPorAno">Quantidade de Semestres por Ano</Label>
            <Input
              id="quantidadeSemestresPorAno"
              type="number"
              min={1}
              max={12}
              value={parametrosData.quantidadeSemestresPorAno ?? ''}
              onChange={(e) => setParametrosData({
                ...parametrosData,
                quantidadeSemestresPorAno: e.target.value ? parseInt(e.target.value, 10) : null,
              })}
              placeholder="2"
            />
            <p className="text-xs text-muted-foreground">Número de semestres por ano letivo (padrão: 2)</p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="duracaoHoraAulaMinutos">Duração da Hora-Aula (minutos)</Label>
          <Select
            value={String(parametrosData.duracaoHoraAulaMinutos ?? (tipoAcademico === 'SECUNDARIO' ? 45 : tipoAcademico === 'SUPERIOR' ? 60 : ''))}
            onValueChange={(v) => setParametrosData({
              ...parametrosData,
              duracaoHoraAulaMinutos: v ? parseInt(v, 10) : null,
            })}
          >
            <SelectTrigger id="duracaoHoraAulaMinutos">
              <SelectValue placeholder="Padrão por tipo de ensino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="45">45 min — Secundário (hora-aula)</SelectItem>
              <SelectItem value="50">50 min — Alternativo (ex. Brasil)</SelectItem>
              <SelectItem value="60">60 min — Superior (hora-relógio)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Secundário: 45 min por aula. Superior: 60 min (hora-relógio). Pode ajustar conforme a legislação local.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="intervaloEntreDisciplinasMinutos">Intervalo entre disciplinas (minutos)</Label>
          <Input
            id="intervaloEntreDisciplinasMinutos"
            type="number"
            min={0}
            max={60}
            value={parametrosData.intervaloEntreDisciplinasMinutos ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const num = v === '' ? null : parseInt(v, 10);
              setParametrosData({
                ...parametrosData,
                intervaloEntreDisciplinasMinutos: (num !== null && !isNaN(num)) ? num : null,
              });
            }}
            placeholder="15"
          />
          <p className="text-xs text-muted-foreground">
            Minutos entre uma disciplina e outra na grade. Ex: 15 = aula 08:00-08:45, próxima 09:00-09:45. Padrão: 15 min.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="intervaloLongoMinutos">Intervalo longo / Pausa (recreio ou almoço) — minutos</Label>
          <Input
            id="intervaloLongoMinutos"
            type="number"
            min={0}
            max={120}
            value={parametrosData.intervaloLongoMinutos ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const num = v === '' ? 0 : parseInt(v, 10);
              setParametrosData({
                ...parametrosData,
                intervaloLongoMinutos: !isNaN(num) ? num : 0,
              });
            }}
            placeholder="0 (desativado) ou 15-120"
          />
          {parametrosData.intervaloLongoMinutos ? (
            <div className="space-y-2">
              <Label htmlFor="intervaloLongoAposBloco" className="text-xs">Após quantas aulas ocorre a pausa?</Label>
              <Input
                id="intervaloLongoAposBloco"
                type="number"
                min={1}
                max={6}
                value={parametrosData.intervaloLongoAposBloco ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const num = v === '' ? 2 : parseInt(v, 10);
                  setParametrosData({
                    ...parametrosData,
                    intervaloLongoAposBloco: !isNaN(num) ? num : 2,
                  });
                }}
                placeholder="2"
              />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Minutos sem aulas no meio do horário (recreio ou almoço). 0 = desativado. Ex: 45 min após 2ª aula = 2 aulas, pausa, depois mais aulas.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="limiteAulasSeguidasProfessor">Limite de aulas seguidas por professor (por dia)</Label>
          <Input
            id="limiteAulasSeguidasProfessor"
            type="number"
            min={1}
            max={8}
            value={parametrosData.limiteAulasSeguidasProfessor ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const num = v === '' ? null : parseInt(v, 10);
              setParametrosData({
                ...parametrosData,
                limiteAulasSeguidasProfessor: num != null && !isNaN(num) ? num : null,
              });
            }}
            placeholder="4 (padrão) ou vazio = sem limite"
          />
          <p className="text-xs text-muted-foreground">
            Máx. aulas consecutivas por professor no mesmo dia. Ex: 3 = professor não terá mais de 3 aulas seguidas. Vazio = sem limite.
          </p>
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onSave} disabled={isLoading}>
            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Salvar</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de Configurações Avançadas
function ConfiguracoesAvancadas({
  tipoAcademico,
  parametrosData,
  setParametrosData,
  onSave,
  isLoading,
}: {
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null;
  parametrosData: any;
  setParametrosData: (data: any) => void;
  onSave: () => void;
  isLoading: boolean;
}) {
  return (
    <>
      <Accordion type="multiple" defaultValue={["parametros-academicos", "estrutura-pedagogica", "regras-matricula", "avaliacao-academica", "professores-folha", "seguranca-auditoria", "sistema"]} className="space-y-4">
        {/* Parâmetros Acadêmicos (somente leitura) */}
        <AccordionItem value="parametros-academicos" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Parâmetros Acadêmicos</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Informações sobre a estrutura acadêmica da instituição (somente leitura)
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Instituição</Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <span className="font-medium">
                  {tipoAcademico === 'SUPERIOR' ? 'Ensino Superior' : tipoAcademico === 'SECUNDARIO' ? 'Ensino Secundário' : 'Não identificado'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Usa Turma Obrigatória?</Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <span className="font-medium">
                  {tipoAcademico === 'SECUNDARIO' ? 'Sim' : 'Não'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Disciplinas derivadas do Plano de Ensino</Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <span className="font-medium">Sim</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Organização Acadêmica</Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <span className="font-medium">
                  {tipoAcademico === 'SUPERIOR' ? 'Ano do Curso + Semestre' : tipoAcademico === 'SECUNDARIO' ? 'Classe' : 'A definir'}
                </span>
              </div>
            </div>
          </div>
          </AccordionContent>
        </AccordionItem>

        {/* Regras Pedagógicas (duração e intervalos estão em Horários e Grade) */}
        <AccordionItem value="estrutura-pedagogica" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Regras Pedagógicas</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Reprovação, dependência e outras regras acadêmicas. Duração da aula e intervalos em Horários e Grade.
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              Para configurar duração da hora-aula, intervalo entre disciplinas e pausa (recreio/almoço), acesse a aba{' '}
              <Link to="/admin-dashboard/configuracoes?tab=horarios" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
                Horários e Grade
              </Link>
              .
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="permitirReprovacaoDisciplina">Permitir Reprovação por Disciplina</Label>
              <p className="text-xs text-muted-foreground">
                Permite que estudantes sejam reprovados em disciplinas específicas
              </p>
            </div>
            <Switch
              id="permitirReprovacaoDisciplina"
              checked={parametrosData.permitirReprovacaoDisciplina}
              onCheckedChange={(checked) => setParametrosData({
                ...parametrosData,
                permitirReprovacaoDisciplina: checked,
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="permitirDependencia">Permitir Dependência</Label>
              <p className="text-xs text-muted-foreground">
                Permite que estudantes façam disciplinas de séries/anos anteriores
              </p>
            </div>
            <Switch
              id="permitirDependencia"
              checked={parametrosData.permitirDependencia}
              onCheckedChange={(checked) => setParametrosData({
                ...parametrosData,
                permitirDependencia: checked,
              })}
            />
          </div>
          </AccordionContent>
        </AccordionItem>

        {/* Regras de Matrícula */}
        <AccordionItem value="regras-matricula" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Regras de Matrícula</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Configure as regras e permissões para matrículas
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="permitirMatriculaForaPeriodo">Permitir Matrícula Fora do Período Letivo</Label>
              <p className="text-xs text-muted-foreground">
                Permite matrículas fora do período oficial
              </p>
            </div>
            <Switch
              id="permitirMatriculaForaPeriodo"
              checked={parametrosData.permitirMatriculaForaPeriodo}
              onCheckedChange={(checked) => setParametrosData({
                ...parametrosData,
                permitirMatriculaForaPeriodo: checked,
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="bloquearMatriculaDivida">Bloquear Matrícula com Dívida Financeira</Label>
              <p className="text-xs text-muted-foreground">
                Impede matrícula de estudantes com pendências financeiras
              </p>
            </div>
            <Switch
              id="bloquearMatriculaDivida"
              checked={parametrosData.bloquearMatriculaDivida}
              onCheckedChange={(checked) => setParametrosData({
                ...parametrosData,
                bloquearMatriculaDivida: checked,
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="permitirTransferenciaTurma">Permitir Transferência de Turma</Label>
              <p className="text-xs text-muted-foreground">
                Permite transferência de estudantes entre turmas
              </p>
            </div>
            <Switch
              id="permitirTransferenciaTurma"
              checked={parametrosData.permitirTransferenciaTurma}
              onCheckedChange={(checked) => setParametrosData({
                ...parametrosData,
                permitirTransferenciaTurma: checked,
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="permitirMatriculaSemDocumentos">Permitir Matrícula sem Documentos Completos</Label>
              <p className="text-xs text-muted-foreground">
                Permite matrícula mesmo sem todos os documentos obrigatórios
              </p>
            </div>
            <Switch
              id="permitirMatriculaSemDocumentos"
              checked={parametrosData.permitirMatriculaSemDocumentos}
              onCheckedChange={(checked) => setParametrosData({
                ...parametrosData,
                permitirMatriculaSemDocumentos: checked,
              })}
            />
          </div>
          </AccordionContent>
        </AccordionItem>

        {/* Avaliação Acadêmica */}
        <AccordionItem value="avaliacao-academica" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Avaliação Acadêmica</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Configure os parâmetros de avaliação e aprovação
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="tipoMedia">Tipo de Média</Label>
            <Select
              value={parametrosData.tipoMedia}
              onValueChange={(value: 'simples' | 'ponderada') => setParametrosData({
                ...parametrosData,
                tipoMedia: value,
              })}
            >
              <SelectTrigger id="tipoMedia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples</SelectItem>
                <SelectItem value="ponderada">Ponderada</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Simples: média aritmética | Ponderada: média ponderada por carga horária
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="permitirExameRecurso">Permitir Exame de Recurso</Label>
              <p className="text-xs text-muted-foreground">
                Permite que estudantes façam exame de recurso após reprovação
              </p>
            </div>
            <Switch
              id="permitirExameRecurso"
              checked={parametrosData.permitirExameRecurso}
              onCheckedChange={(checked) => setParametrosData({
                ...parametrosData,
                permitirExameRecurso: checked,
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="percentualMinimoAprovacao">Percentual Mínimo de Aprovação</Label>
            <Input
              id="percentualMinimoAprovacao"
              type="number"
              min="0"
              max="20"
              step="0.1"
              value={parametrosData.percentualMinimoAprovacao ?? ''}
              onChange={(e) => setParametrosData({
                ...parametrosData,
                percentualMinimoAprovacao: e.target.value ? parseFloat(e.target.value) : 10,
              })}
              placeholder="10"
            />
            <p className="text-xs text-muted-foreground">
              Nota mínima para aprovação (ex: 10, 12, 14)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notaMinimaZonaExameRecurso">Nota mínima — zona de recurso / recuperação</Label>
            <Input
              id="notaMinimaZonaExameRecurso"
              type="number"
              min="0"
              max="20"
              step="0.1"
              value={parametrosData.notaMinimaZonaExameRecurso ?? ''}
              onChange={(e) =>
                setParametrosData({
                  ...parametrosData,
                  notaMinimaZonaExameRecurso: e.target.value ? parseFloat(e.target.value) : 7,
                })
              }
              placeholder="7"
            />
            <p className="text-xs text-muted-foreground">
              Escala 0–20: nota mínima para o aluno poder a exame de recurso ou recuperação (deve ser inferior à nota de aprovação). Padrão 7 (ex.: Angola).
            </p>
          </div>
          </AccordionContent>
        </AccordionItem>

        {tipoAcademico === 'SUPERIOR' && (
        <AccordionItem value="superior-ac-exame" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Ensino superior — AC e exame final</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Média da avaliação contínua, exame e nota final (pesos e regras configuráveis)
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="superiorModeloCalculo">Modelo de cálculo (pauta)</Label>
              <Select
                value={parametrosData.superiorModeloCalculo}
                onValueChange={(v: 'PAUTA_3_PROVAS' | 'AC_EXAME_PONDERADO') =>
                  setParametrosData({ ...parametrosData, superiorModeloCalculo: v })
                }
              >
                <SelectTrigger id="superiorModeloCalculo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAUTA_3_PROVAS">Pauta clássica (3 provas + regras atuais)</SelectItem>
                  <SelectItem value="AC_EXAME_PONDERADO">AC + exame final (média contínua e NF ponderada)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                No modelo AC+exame, a média contínua (MC) combina 1ª prova, 2ª prova, trabalho e outros componentes
                (conforme o tipo abaixo). A nota final usa MC e o exame (3ª prova) com pesos configuráveis — ex.:
                MC×0,7 + Exame×0,3.
              </p>
            </div>
            {parametrosData.superiorModeloCalculo === 'AC_EXAME_PONDERADO' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="superiorAcTipoCalculo">Cálculo da média contínua (MC)</Label>
                  <Select
                    value={parametrosData.superiorAcTipoCalculo}
                    onValueChange={(v: 'MEDIA_ARITMETICA' | 'PONDERADA_P1_P2_TRAB') =>
                      setParametrosData({ ...parametrosData, superiorAcTipoCalculo: v })
                    }
                  >
                    <SelectTrigger id="superiorAcTipoCalculo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEDIA_ARITMETICA">
                        Média aritmética (1ª, 2ª, trabalho, testes, participação, …)
                      </SelectItem>
                      <SelectItem value="PONDERADA_P1_P2_TRAB">
                        Ponderada: 1ª prova + 2ª prova + trabalho (estilo folha de cálculo)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ponderada típica: MC = 0,3×1ª + 0,3×2ª + 0,1×Trabalho (valores em falta contam como 0).
                  </p>
                </div>
                {parametrosData.superiorAcTipoCalculo === 'PONDERADA_P1_P2_TRAB' && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="superiorPesoAv1">Peso 1ª prova (0–1)</Label>
                      <Input
                        id="superiorPesoAv1"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={parametrosData.superiorPesoAv1 ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParametrosData({
                            ...parametrosData,
                            superiorPesoAv1: v === '' ? null : parseFloat(v),
                          });
                        }}
                        placeholder="0,3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="superiorPesoAv2">Peso 2ª prova (0–1)</Label>
                      <Input
                        id="superiorPesoAv2"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={parametrosData.superiorPesoAv2 ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParametrosData({
                            ...parametrosData,
                            superiorPesoAv2: v === '' ? null : parseFloat(v),
                          });
                        }}
                        placeholder="0,3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="superiorPesoTrab">Peso trabalho (0–1)</Label>
                      <Input
                        id="superiorPesoTrab"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={parametrosData.superiorPesoTrab ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParametrosData({
                            ...parametrosData,
                            superiorPesoTrab: v === '' ? null : parseFloat(v),
                          });
                        }}
                        placeholder="0,1"
                      />
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="superiorPesoAc">Peso da AC (0–1)</Label>
                    <Input
                      id="superiorPesoAc"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={parametrosData.superiorPesoAc ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setParametrosData({
                          ...parametrosData,
                          superiorPesoAc: v === '' ? null : parseFloat(v),
                        });
                      }}
                      placeholder="0,7 (ex. MC×0,7 + Exame×0,3)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="superiorPesoExame">Peso do exame (0–1)</Label>
                    <Input
                      id="superiorPesoExame"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={parametrosData.superiorPesoExame ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setParametrosData({
                          ...parametrosData,
                          superiorPesoExame: v === '' ? null : parseFloat(v),
                        });
                      }}
                      placeholder="0,3"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  NF = MC × peso_MC + Exame × peso_Exame. Se os dois pesos não somarem 1, o sistema normaliza.
                  Se vazios, usa 40% / 60%; para o exemplo acima use 0,7 e 0,3.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="superiorRecursoModo">Recurso (nota final já calculada)</Label>
                  <Select
                    value={parametrosData.superiorRecursoModo}
                    onValueChange={(v: 'MEDIA_COM_MF' | 'APROVACAO_DIRETA') =>
                      setParametrosData({ ...parametrosData, superiorRecursoModo: v })
                    }
                  >
                    <SelectTrigger id="superiorRecursoModo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEDIA_COM_MF">
                        Média da NF com recurso: (NF + Recurso) / 2 (na zona de recurso)
                      </SelectItem>
                      <SelectItem value="APROVACAO_DIRETA">
                        Aprovação direta: SE(Recurso ≥ mínimo; Aprovado; senão reprovado) — NF numérica inalterada
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Alinhar com Excel: status final por nota de recurso sem alterar o valor da média final calculada antes.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="superiorNotaMinimaAcContaExame">Nota mínima da AC para o exame contar na NF</Label>
                  <Input
                    id="superiorNotaMinimaAcContaExame"
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    value={parametrosData.superiorNotaMinimaAcContaExame ?? ''}
                    onChange={(e) =>
                      setParametrosData({
                        ...parametrosData,
                        superiorNotaMinimaAcContaExame: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se a média da AC for inferior a este valor, a nota final usa só a AC e regista observação.
                    Ex.: exige ≥10 na AC para o exame integrar a média final.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="superiorBloquearExameSeAcInsuficiente">Bloquear lançamento do exame</Label>
                    <p className="text-xs text-muted-foreground">
                      Impede gravar nota de exame final enquanto a AC estiver abaixo do mínimo (opcional)
                    </p>
                  </div>
                  <Switch
                    id="superiorBloquearExameSeAcInsuficiente"
                    checked={parametrosData.superiorBloquearExameSeAcInsuficiente}
                    onCheckedChange={(checked) =>
                      setParametrosData({ ...parametrosData, superiorBloquearExameSeAcInsuficiente: checked })
                    }
                  />
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>
        )}

        <AccordionItem value="pauta-rotulos" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Rótulos da pauta (lançamento)</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Textos na gestão de notas e pautas (superior ou secundário). Os tipos guardados na BD mantêm-se.
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pt-4">
            {tipoAcademico === 'SUPERIOR' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Ex.: alterar &quot;1ª Prova&quot; para o rótulo oficial da instituição. Valores de exame/nota continuam a usar os tipos canónicos.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(DEFAULT_PAUTA_LABELS_SUPERIOR) as (keyof typeof DEFAULT_PAUTA_LABELS_SUPERIOR)[]).map(
                    (key) => (
                      <div key={key} className="space-y-1">
                        <Label htmlFor={`pauta-sup-${String(key)}`}>{String(key)}</Label>
                        <Input
                          id={`pauta-sup-${String(key)}`}
                          value={parametrosData.pautaLabelsSuperior[String(key)] ?? ''}
                          onChange={(e) =>
                            setParametrosData({
                              ...parametrosData,
                              pautaLabelsSuperior: {
                                ...parametrosData.pautaLabelsSuperior,
                                [key]: e.target.value,
                              },
                            })
                          }
                          maxLength={80}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
            {tipoAcademico === 'SECUNDARIO' && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Mini-pauta: rótulos de MAC, NPP, NPT, MT e períodos. Ex.: trocar NPT por TMP só altera o que vê no ecrã.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(DEFAULT_PAUTA_LABELS_SECUNDARIO) as (keyof typeof DEFAULT_PAUTA_LABELS_SECUNDARIO)[]).map(
                    (key) => (
                      <div key={key} className="space-y-1">
                        <Label htmlFor={`pauta-sec-${String(key)}`}>{String(key)}</Label>
                        <Input
                          id={`pauta-sec-${String(key)}`}
                          value={parametrosData.pautaLabelsSecundario[String(key)] ?? ''}
                          onChange={(e) =>
                            setParametrosData({
                              ...parametrosData,
                              pautaLabelsSecundario: {
                                ...parametrosData.pautaLabelsSecundario,
                                [key]: e.target.value,
                              },
                            })
                          }
                          maxLength={80}
                        />
                      </div>
                    ),
                  )}
                </div>
                <div className="space-y-2 border-t pt-4">
                  <Label>Pesos do trimestre (MAC / NPP / NPT → MT)</Label>
                  <p className="text-xs text-muted-foreground">
                    Valores 0–1; vazio em todos = terços iguais. O sistema normaliza para somar 1.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="secundarioPesoMac">Peso {parametrosData.pautaLabelsSecundario.mac}</Label>
                      <Input
                        id="secundarioPesoMac"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={parametrosData.secundarioPesoMac ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParametrosData({
                            ...parametrosData,
                            secundarioPesoMac: v === '' ? null : parseFloat(v),
                          });
                        }}
                        placeholder="ex. 0,33"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="secundarioPesoNpp">Peso {parametrosData.pautaLabelsSecundario.npp}</Label>
                      <Input
                        id="secundarioPesoNpp"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={parametrosData.secundarioPesoNpp ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParametrosData({
                            ...parametrosData,
                            secundarioPesoNpp: v === '' ? null : parseFloat(v),
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="secundarioPesoNpt">Peso {parametrosData.pautaLabelsSecundario.npt}</Label>
                      <Input
                        id="secundarioPesoNpt"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={parametrosData.secundarioPesoNpt ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParametrosData({
                            ...parametrosData,
                            secundarioPesoNpt: v === '' ? null : parseFloat(v),
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Professores - Desconto por falta (contratados) */}
        <AccordionItem value="professores-folha" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Professores - Desconto por falta</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Configuração para professores contratados (valor por aula)
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Tipo de desconto por falta</Label>
            <Select
              value={parametrosData.descontoFaltaProfessorTipo ?? 'VALOR_AULA'}
              onValueChange={(v) => setParametrosData({ ...parametrosData, descontoFaltaProfessorTipo: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VALOR_AULA">Valor da aula (1 falta = 1× valor por aula)</SelectItem>
                <SelectItem value="PERCENTAGEM">Percentagem do valor da aula</SelectItem>
                <SelectItem value="NUMERICO">Valor fixo numérico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(parametrosData.descontoFaltaProfessorTipo === 'PERCENTAGEM' || parametrosData.descontoFaltaProfessorTipo === 'NUMERICO') && (
            <div className="space-y-2">
              <Label>
                {parametrosData.descontoFaltaProfessorTipo === 'PERCENTAGEM'
                  ? 'Percentagem (0-100) — ex: 100 = 1 falta desconta 100% do valor da aula'
                  : 'Valor fixo por falta (em moeda)'}
              </Label>
              <Input
                type="number"
                min={0}
                step={parametrosData.descontoFaltaProfessorTipo === 'PERCENTAGEM' ? 1 : 0.01}
                value={parametrosData.descontoFaltaProfessorValor ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setParametrosData({
                    ...parametrosData,
                    descontoFaltaProfessorValor: v === '' ? null : parseFloat(v),
                  });
                }}
                placeholder={parametrosData.descontoFaltaProfessorTipo === 'PERCENTAGEM' ? '100' : '0,00'}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Suporta faltas fracionadas (ex: 0.5 = falta parcial — professor chegou no segundo tempo).
          </p>
          </AccordionContent>
        </AccordionItem>

        {/* Segurança e Auditoria */}
        <AccordionItem value="seguranca-auditoria" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Segurança e Auditoria</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Configure permissões e auditoria do sistema
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Perfis que Podem Alterar Notas</Label>
            <div className="space-y-2">
              {['ADMIN', 'PROFESSOR', 'SECRETARIA'].map((perfil) => (
                <div key={perfil} className="flex items-center space-x-2">
                  <Checkbox
                    id={`perfil-alterar-notas-${perfil}`}
                    checked={parametrosData.perfisAlterarNotas?.includes(perfil)}
                    onCheckedChange={(checked) => {
                      const perfis = parametrosData.perfisAlterarNotas || [];
                      if (checked) {
                        setParametrosData({
                          ...parametrosData,
                          perfisAlterarNotas: [...perfis, perfil],
                        });
                      } else {
                        setParametrosData({
                          ...parametrosData,
                          perfisAlterarNotas: perfis.filter(p => p !== perfil),
                        });
                      }
                    }}
                  />
                  <Label htmlFor={`perfil-alterar-notas-${perfil}`} className="font-normal cursor-pointer">
                    {perfil}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Perfis que Podem Cancelar Matrícula</Label>
            <div className="space-y-2">
              {['ADMIN', 'SECRETARIA'].map((perfil) => (
                <div key={perfil} className="flex items-center space-x-2">
                  <Checkbox
                    id={`perfil-cancelar-matricula-${perfil}`}
                    checked={parametrosData.perfisCancelarMatricula?.includes(perfil)}
                    onCheckedChange={(checked) => {
                      const perfis = parametrosData.perfisCancelarMatricula || [];
                      if (checked) {
                        setParametrosData({
                          ...parametrosData,
                          perfisCancelarMatricula: [...perfis, perfil],
                        });
                      } else {
                        setParametrosData({
                          ...parametrosData,
                          perfisCancelarMatricula: perfis.filter(p => p !== perfil),
                        });
                      }
                    }}
                  />
                  <Label htmlFor={`perfil-cancelar-matricula-${perfil}`} className="font-normal cursor-pointer">
                    {perfil}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ativarLogsAcademicos">Ativar Logs Acadêmicos</Label>
              <p className="text-xs text-muted-foreground">
                Registra todas as alterações acadêmicas em log de auditoria
              </p>
            </div>
            <Switch
              id="ativarLogsAcademicos"
              checked={parametrosData.ativarLogsAcademicos}
              onCheckedChange={(checked) => setParametrosData({
                ...parametrosData,
                ativarLogsAcademicos: checked,
              })}
            />
          </div>
          </AccordionContent>
        </AccordionItem>

        {/* Sistema (somente leitura) */}
        <AccordionItem value="sistema" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Sistema</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Informações do sistema (somente leitura)
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Tenant ID
                <Info className="h-3 w-3 text-muted-foreground" title="Identificador único da instituição no sistema multi-tenant" />
              </Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <span className="font-mono text-xs font-medium break-all">
                  {parametrosData.tenantId || 'N/A'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Versão do Sistema</Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <span className="font-medium">{parametrosData.versaoSistema || 'DSICOLA v1.0'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <span className="font-medium">
                  {parametrosData.ambiente || (import.meta.env.MODE === 'production' ? 'Produção' : 'Homologação')}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Última Atualização
                <Info className="h-3 w-3 text-muted-foreground" title="Data e hora da última alteração nas configurações avançadas" />
              </Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <span className="font-medium text-sm">
                  {parametrosData.ultimaAtualizacao 
                    ? new Date(parametrosData.ultimaAtualizacao).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Nunca atualizado'}
                </span>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                Status de Backup Automático
                <Info className="h-3 w-3 text-muted-foreground" title="Indica se os backups automáticos estão ativados para esta instituição" />
              </Label>
              <div className="p-3 border rounded-md bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {parametrosData.statusBackupAutomatico || 'Inativo'}
                  </span>
                  {parametrosData.statusBackupAutomatico === 'Ativo' && parametrosData.proximoBackup && (
                    <span className="text-xs text-muted-foreground">
                      Próximo backup: {new Date(parametrosData.proximoBackup).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
            <p className="text-sm font-medium mb-2">Aviso Importante</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Alterações nestas configurações afetam o comportamento do sistema</li>
              <li>Todas as alterações são registradas em log de auditoria</li>
              <li>Configurações não aplicam retroativamente aos dados históricos</li>
            </ul>
          </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar Configurações Avançadas"}
        </Button>
      </div>
    </>
  );
}
