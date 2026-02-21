import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { configuracoesInstituicaoApi, storageApi, instituicoesApi, parametrosSistemaApi, API_URL } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X, Building2, Image, Palette, Mail, Phone, MapPin, GraduationCap, School, RotateCcw, DollarSign, Percent, FileText, Globe, Receipt, Save, Settings, BookOpen, Shield, Lock, AlertCircle, Info, Loader2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
// Theme is now applied globally via ThemeProvider
// No need to import applyThemeColors/resetThemeColors here
import { getDefaultColorsByTipoAcademico } from "@/utils/defaultColors";

const MAX_FILE_SIZE = 1048576; // 1MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

export default function ConfiguracoesInstituicao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config, loading, refetch, instituicaoId } = useInstituicao();
  const { user } = useAuth();
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const capaInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

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
  });
  
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [capaPreview, setCapaPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

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

  // Tipo acadêmico (prioridade - fonte mais confiável)
  // Buscar em diferentes formatos possíveis (camelCase e snake_case)
  const tipoAcademico = instituicaoData?.tipoAcademico 
    || instituicaoData?.tipo_academico 
    || config?.tipoAcademico 
    || config?.tipo_academico 
    || null;
  
  // Tipo identificado automaticamente (read-only)
  // PRIORIDADE: tipoAcademico sempre tem precedência sobre tipoInstituicao
  // Isso garante consistência entre "Tipo de Instituição" e "Tipo Acadêmico"
  let tipoIdentificado: string;
  if (tipoAcademico === 'SUPERIOR') {
    tipoIdentificado = 'UNIVERSIDADE';
  } else if (tipoAcademico === 'SECUNDARIO') {
    tipoIdentificado = 'ENSINO_MEDIO';
  } else {
    // Fallback apenas se tipoAcademico não estiver disponível
    tipoIdentificado = instituicaoData?.tipoInstituicao 
      || instituicaoData?.tipo_instituicao 
      || config?.tipo_instituicao 
      || 'EM_CONFIGURACAO';
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
      }));
      setLogoPreview(config.logo_url || config.logoUrl || null);
      setCapaPreview(config.imagem_capa_login_url || config.imagemCapaLoginUrl || null);
      setFaviconPreview(config.favicon_url || config.faviconUrl || null);
    }
  }, [config, instituicaoData, tipoAcademico]);

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
        title: "Erro ao salvar cores",
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
      // Validação: Email fiscal é obrigatório
      if (!formData.email_fiscal || !formData.email_fiscal.trim()) {
        throw new Error('Email fiscal é obrigatório. Preencha o campo "Email Fiscal / Contato" na seção Dados Fiscais.');
      }

      // Validação básica de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email_fiscal)) {
        throw new Error('Email fiscal inválido. Verifique o formato do email.');
      }

      let logoUrl = config?.logo_url || config?.logoUrl;
      let capaUrl = config?.imagem_capa_login_url || config?.imagemCapaLoginUrl;
      let faviconUrl = config?.favicon_url || config?.faviconUrl;

      if (logoFile) {
        const uploadResult = await storageApi.upload('instituicao', 'logo', logoFile);
        // O backend retorna { url, path, fileName, bucket }
        // Se url começa com /, precisa ser absoluta usando API_URL
        const url = uploadResult?.url || uploadResult?.path || uploadResult;
        logoUrl = typeof url === 'string' && url.startsWith('/') 
          ? `${API_URL}${url}` 
          : url;
      }

      if (capaFile) {
        const uploadResult = await storageApi.upload('instituicao', 'capa-login', capaFile);
        const url = uploadResult?.url || uploadResult?.path || uploadResult;
        capaUrl = typeof url === 'string' && url.startsWith('/') 
          ? `${API_URL}${url}` 
          : url;
      }

      if (faviconFile) {
        const uploadResult = await storageApi.upload('instituicao', 'favicon', faviconFile);
        const url = uploadResult?.url || uploadResult?.path || uploadResult;
        faviconUrl = typeof url === 'string' && url.startsWith('/') 
          ? `${API_URL}${url}` 
          : url;
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
      
      const percentualImposto = (() => {
        const value = formData.percentual_imposto_padrao?.trim();
        if (!value || value === '') return undefined;
        const num = parseFloat(value);
        return isNaN(num) || num < 0 ? undefined : num;
      })();
      if (percentualImposto !== undefined) {
        payload.percentualImpostoPadrao = percentualImposto;
      }
      
      // IMPORTANTE: Multi-tenant - instituicaoId vem do JWT, não precisa enviar
      await configuracoesInstituicaoApi.update(payload);

      // Atualizar campos de multa e juros na tabela instituicoes
      if (instituicaoId) {
        await instituicoesApi.update(instituicaoId, {
          multaPercentual: parseFloat(formData.multa_percentual) || undefined,
          jurosDia: parseFloat(formData.juros_dia) || undefined,
        });
      }
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['instituicao'] });
      queryClient.invalidateQueries({ queryKey: ['configuracao'] });
      setLogoFile(null);
      setCapaFile(null);
      setFaviconFile(null);
      toast({
        title: "Configurações salvas",
        description: "As configurações da instituição foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
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

  // Estado para aba ativa
  const [activeTab, setActiveTab] = useState("geral");

  // Estado para parâmetros do sistema
  const [parametrosData, setParametrosData] = useState({
    quantidadeSemestresPorAno: 2,
    permitirReprovacaoDisciplina: true,
    permitirDependencia: true,
    permitirMatriculaForaPeriodo: false,
    bloquearMatriculaDivida: true,
    permitirTransferenciaTurma: true,
    permitirMatriculaSemDocumentos: false,
    tipoMedia: 'simples' as 'simples' | 'ponderada',
    permitirExameRecurso: false,
    percentualMinimoAprovacao: 10,
    perfisAlterarNotas: ['ADMIN', 'PROFESSOR'] as string[],
    perfisCancelarMatricula: ['ADMIN'] as string[],
    ativarLogsAcademicos: true,
  });

  // Buscar parâmetros do sistema
  const { data: parametros } = useQuery({
    queryKey: ['parametros-sistema', instituicaoId],
    queryFn: async () => {
      if (!instituicaoId) return null;
      // IMPORTANTE: Multi-tenant - instituicaoId vem do JWT, não precisa enviar
      return await parametrosSistemaApi.get();
    },
    enabled: !!instituicaoId && activeTab === 'avancadas',
  });

  useEffect(() => {
    if (parametros) {
      setParametrosData({
        // SECUNDARIO não usa semestres (usa trimestres) - sempre null. SUPERIOR usa 2 por padrão.
        quantidadeSemestresPorAno: tipoAcademico === 'SECUNDARIO' ? null : (parametros.quantidadeSemestresPorAno ?? 2),
        permitirReprovacaoDisciplina: parametros.permitirReprovacaoDisciplina ?? true,
        permitirDependencia: parametros.permitirDependencia ?? true,
        permitirMatriculaForaPeriodo: parametros.permitirMatriculaForaPeriodo ?? false,
        bloquearMatriculaDivida: parametros.bloquearMatriculaDivida ?? true,
        permitirTransferenciaTurma: parametros.permitirTransferenciaTurma ?? true,
        permitirMatriculaSemDocumentos: parametros.permitirMatriculaSemDocumentos ?? false,
        tipoMedia: parametros.tipoMedia ?? 'simples',
        permitirExameRecurso: parametros.permitirExameRecurso ?? false,
        percentualMinimoAprovacao: parametros.percentualMinimoAprovacao ?? 10,
        perfisAlterarNotas: parametros.perfisAlterarNotas ?? ['ADMIN', 'PROFESSOR'],
        perfisCancelarMatricula: parametros.perfisCancelarMatricula ?? ['ADMIN'],
        ativarLogsAcademicos: parametros.ativarLogsAcademicos ?? true,
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
    'quantidadeSemestresPorAno', 'permitirReprovacaoDisciplina', 'permitirDependencia',
    'permitirMatriculaForaPeriodo', 'bloquearMatriculaDivida', 'permitirTransferenciaTurma',
    'permitirMatriculaSemDocumentos', 'tipoMedia', 'permitirExameRecurso',
    'percentualMinimoAprovacao', 'perfisAlterarNotas', 'perfisCancelarMatricula',
    'ativarLogsAcademicos',
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
      queryClient.invalidateQueries({ queryKey: ['parametros-sistema', instituicaoId] });
      toast({
        title: "Parâmetros salvos",
        description: "As configurações avançadas foram atualizadas com sucesso.",
      });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message || 'Erro ao salvar parâmetros';
      toast({
        title: "Erro ao salvar",
        description: msg,
        variant: "destructive",
      });
    },
  });

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
                <Link to="/admin-dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Configurações</BreadcrumbPage>
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
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configurações da Instituição</h1>
                {tipoAcademico && (
                  <Badge variant="secondary" className="font-normal">
                    {tipoAcademico === 'SUPERIOR' ? (
                      <><GraduationCap className="h-3.5 w-3.5 mr-1" /> Ensino Superior</>
                    ) : (
                      <><School className="h-3.5 w-3.5 mr-1" /> Ensino Secundário</>
                    )}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                Personalize a identidade visual, informações e parâmetros da sua instituição
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="geral" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="avancadas" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Configurações Avançadas
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
              {tipoAcademico && (
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
              )}
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
                <div className="space-y-2">
                  <Label htmlFor="nif">NIF (Número de Identificação Fiscal)</Label>
                  <Input
                    id="nif"
                    value={formData.nif}
                    onChange={(e) => setFormData(prev => ({ ...prev, nif: e.target.value }))}
                    placeholder={formData.pais_fiscal === 'Portugal' ? '123456789' : '123456789LA045'}
                  />
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
                <Label htmlFor="serie_documentos">Série de Documentos</Label>
                <Input
                  id="serie_documentos"
                  value={formData.serie_documentos}
                  onChange={(e) => setFormData(prev => ({ ...prev, serie_documentos: e.target.value }))}
                  placeholder="Ex: A, B, C..."
                />
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
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="numeracao_automatica">Numeração automática de documentos</Label>
                <p className="text-xs text-muted-foreground">
                  Gera números sequenciais automaticamente para faturas e recibos
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
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Salvar Configurações</>
                )}
              </Button>
            </div>
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
    </DashboardLayout>
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
      <Accordion type="multiple" defaultValue={["parametros-academicos", "estrutura-pedagogica", "regras-matricula", "avaliacao-academica", "seguranca-auditoria", "sistema"]} className="space-y-4">
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

        {/* Estrutura Pedagógica */}
        <AccordionItem value="estrutura-pedagogica" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <div className="text-left">
                <h3 className="font-semibold">Estrutura Pedagógica</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Configure a estrutura pedagógica e regras acadêmicas
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
          {tipoAcademico === 'SUPERIOR' && (
            <div className="space-y-2">
              <Label htmlFor="quantidadeSemestresPorAno">Quantidade de Semestres por Ano</Label>
              <Input
                id="quantidadeSemestresPorAno"
                type="number"
                min="1"
                max="12"
                value={parametrosData.quantidadeSemestresPorAno ?? ''}
                onChange={(e) => setParametrosData({
                  ...parametrosData,
                  quantidadeSemestresPorAno: e.target.value ? parseInt(e.target.value, 10) : null,
                })}
                placeholder="2"
              />
              <p className="text-xs text-muted-foreground">
                Número de semestres por ano letivo (padrão: 2)
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="permitirReprovacaoDisciplina">Permitir Reprovação por Disciplina</Label>
              <p className="text-xs text-muted-foreground">
                Permite que alunos sejam reprovados em disciplinas específicas
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
                Permite que alunos façam disciplinas de séries/anos anteriores
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
                Impede matrícula de alunos com pendências financeiras
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
                Permite transferência de alunos entre turmas
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
                Permite que alunos façam exame de recurso após reprovação
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
