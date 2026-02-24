import { useState, useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Save, RefreshCw, ExternalLink, Loader2, Palette, Eye, Image, Upload, Trash2, ImagePlus, Type, Package, RotateCcw, ChevronDown, Layout, ShieldCheck, Zap, Layers, CreditCard, Video, Mail, FileText } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSearchParams } from 'react-router-dom';
import { configuracoesLandingApi, utilsApi, planosApi } from '@/services/api';
import { PLANOS_ESTRATEGICOS_DEFAULT, CHAVE_PLANOS_LANDING, PlanoLanding } from '@/constants/planosLanding';

interface ConfigItem {
  id: string;
  chave: string;
  valor: string | null;
  tipo: string;
  descricao: string | null;
}

/** Blocos de texto configuráveis da landing page - sempre exibidos na UI */
const CONTENT_SCHEMA: { chave: string; label: string; placeholder: string; section: string; multiline?: boolean }[] = [
  // Hero
  { chave: 'hero_badge', label: 'Badge do Hero', placeholder: 'Ex: Plataforma DSICOLA Multi-Tenant', section: 'hero' },
  { chave: 'hero_titulo', label: 'Título Principal', placeholder: 'Sistema de Gestão Acadêmica Completo', section: 'hero' },
  { chave: 'hero_subtitulo', label: 'Subtítulo', placeholder: 'Modernize a gestão da sua instituição...', section: 'hero', multiline: true },
  { chave: 'hero_cta_primario', label: 'Texto do Botão Principal', placeholder: 'Ver Planos e Preços', section: 'hero' },
  { chave: 'hero_cta_secundario', label: 'Texto do Botão Secundário', placeholder: 'Agendar Demonstração', section: 'hero' },
  // Selos de confiança
  { chave: 'trust_1', label: 'Selo 1', placeholder: 'Dados 100% seguros', section: 'trust' },
  { chave: 'trust_2', label: 'Selo 2', placeholder: '14 dias grátis', section: 'trust' },
  { chave: 'trust_3', label: 'Selo 3', placeholder: 'Sem cartão de crédito', section: 'trust' },
  // Barra de benefícios
  { chave: 'benefit_1', label: 'Benefício 1', placeholder: 'Acesso de qualquer lugar, 24/7', section: 'benefits' },
  { chave: 'benefit_2', label: 'Benefício 2', placeholder: 'Implementação rápida em 24h', section: 'benefits' },
  { chave: 'benefit_3', label: 'Benefício 3', placeholder: 'Suporte técnico dedicado', section: 'benefits' },
  { chave: 'benefit_4', label: 'Benefício 4', placeholder: 'Atualizações gratuitas', section: 'benefits' },
  // Recursos
  { chave: 'features_titulo', label: 'Título da Seção Recursos', placeholder: 'Tudo que sua instituição precisa', section: 'features' },
  { chave: 'features_subtitulo', label: 'Subtítulo dos Recursos', placeholder: 'Uma plataforma completa que digitaliza...', section: 'features', multiline: true },
  // Planos
  { chave: 'planos_titulo', label: 'Título dos Planos', placeholder: 'Planos e Preços', section: 'planos' },
  { chave: 'planos_subtitulo', label: 'Subtítulo dos Planos', placeholder: 'Escolha o plano ideal para sua instituição', section: 'planos' },
  { chave: 'planos_badge', label: 'Texto do Badge (dias grátis)', placeholder: '14 dias de teste grátis em todos os planos', section: 'planos' },
  { chave: 'planos_botao', label: 'Texto do Botão dos Planos', placeholder: 'Começar Agora', section: 'planos' },
  { chave: 'planos_popular', label: 'Label do Plano Mais Popular', placeholder: 'Mais Popular', section: 'planos' },
  { chave: 'planos_prova_social', label: 'Prova Social (acima dos planos)', placeholder: '+50 instituições já utilizam o DSICOLA', section: 'planos' },
  { chave: 'planos_prova_social_sub', label: 'Subtítulo Prova Social', placeholder: 'Confiança de escolas e universidades em crescimento', section: 'planos' },
  // Contato
  { chave: 'contato_badge', label: 'Badge do Formulário', placeholder: 'Formulário de Contato', section: 'contato' },
  { chave: 'contato_titulo', label: 'Título do Contato', placeholder: 'Solicite uma Demonstração', section: 'contato' },
  { chave: 'contato_subtitulo', label: 'Subtítulo do Contato', placeholder: 'Preencha o formulário e nossa equipe entrará em contato...', section: 'contato', multiline: true },
  { chave: 'contato_botao', label: 'Texto do Botão Enviar', placeholder: 'Enviar Mensagem', section: 'contato' },
  // Vídeo e Demonstração
  { chave: 'demo_video_texto', label: 'Texto do Vídeo Demo', placeholder: 'Assista ao vídeo e descubra como sua instituição pode ser totalmente organizada em poucos dias', section: 'demo', multiline: true },
  { chave: 'demo_video_url', label: 'URL do Vídeo de Demonstração', placeholder: 'YouTube: youtu.be/... | Vimeo: vimeo.com/... | Bunny: iframe.mediadelivery.net/embed/... ou b-cdn.net/...', section: 'demo' },
  { chave: 'demo_video_botao', label: 'Texto do Botão Assistir Demo', placeholder: 'Assistir Demonstração', section: 'demo' },
  { chave: 'demo_whatsapp_url', label: 'Link WhatsApp (número ou wa.me)', placeholder: '244900000000 ou https://wa.me/244900000000', section: 'demo' },
  { chave: 'demo_whatsapp_botao', label: 'Texto do Botão WhatsApp', placeholder: 'Fale conosco no WhatsApp', section: 'demo' },
  // Rodapé
  { chave: 'rodape_creditos', label: 'Créditos do Rodapé', placeholder: 'Sistema de Gestão Acadêmica. Todos os direitos reservados.', section: 'rodape', multiline: true },
];

const SECTION_LABELS: Record<string, string> = {
  hero: 'Seção Principal (Hero)',
  trust: 'Selos de Confiança',
  benefits: 'Barra de Benefícios',
  features: 'Recursos do Sistema',
  demo: 'Vídeo e Demonstração',
  planos: 'Planos e Preços',
  contato: 'Formulário de Contato',
  rodape: 'Rodapé',
};

/** Ordem de exibição dos blocos (estilo editor por blocos) */
const SECTION_ORDER = ['hero', 'trust', 'benefits', 'features', 'planos', 'demo', 'contato', 'rodape'] as const;

const SECTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  hero: Layout,
  trust: ShieldCheck,
  benefits: Zap,
  features: Layers,
  planos: CreditCard,
  demo: Video,
  contato: Mail,
  rodape: FileText,
};

const presetThemes = [
  {
    name: 'Violeta Moderno',
    primary: '#8B5CF6',
    primaryHover: '#7C3AED',
    secondary: '#1E293B',
    accent: '#06B6D4',
    heroText: '#1E293B',
    heroBg: '#F8FAFC'
  },
  {
    name: 'Azul Profissional',
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    secondary: '#0F172A',
    accent: '#10B981',
    heroText: '#0F172A',
    heroBg: '#F0F9FF'
  },
  {
    name: 'Verde Natureza',
    primary: '#059669',
    primaryHover: '#047857',
    secondary: '#1C1917',
    accent: '#F59E0B',
    heroText: '#1C1917',
    heroBg: '#F0FDF4'
  },
  {
    name: 'Laranja Energia',
    primary: '#EA580C',
    primaryHover: '#C2410C',
    secondary: '#1C1917',
    accent: '#0EA5E9',
    heroText: '#1C1917',
    heroBg: '#FFF7ED'
  },
  {
    name: 'Rosa Elegante',
    primary: '#DB2777',
    primaryHover: '#BE185D',
    secondary: '#18181B',
    accent: '#8B5CF6',
    heroText: '#18181B',
    heroBg: '#FDF2F8'
  },
  {
    name: 'Escuro Premium',
    primary: '#F59E0B',
    primaryHover: '#D97706',
    secondary: '#09090B',
    accent: '#22D3EE',
    heroText: '#FAFAFA',
    heroBg: '#18181B'
  }
];

export function LandingConfigTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await configuracoesLandingApi.getAll();
      const configList = data || [];
      setConfigs(configList);
      const initialChanges: Record<string, string> = {};
      configList.forEach((c: ConfigItem) => {
        initialChanges[c.chave] = c.valor || '';
      });
      // Garantir que todos os blocos do CONTENT_SCHEMA existam (para novos configs)
      CONTENT_SCHEMA.forEach((item) => {
        if (!(item.chave in initialChanges)) initialChanges[item.chave] = '';
      });
      setChanges(initialChanges);
    } catch (error) {
      toast({ title: 'Erro ao carregar configurações', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleChange = (chave: string, valor: string) => {
    setChanges(prev => ({ ...prev, [chave]: valor }));
  };

  const getPlanosFromChanges = (): PlanoLanding[] => {
    const raw = changes[CHAVE_PLANOS_LANDING];
    if (!raw?.trim()) return PLANOS_ESTRATEGICOS_DEFAULT;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.map((p: any) => ({
          id: p.id ?? 'unknown',
          nome: String(p.nome ?? ''),
          tagline: String(p.tagline ?? ''),
          precoMensal: Number(p.precoMensal) || 0,
          precoAnual: Number(p.precoAnual) || 0,
          precoMensalSuperior: p.precoMensalSuperior != null ? Number(p.precoMensalSuperior) : undefined,
          precoAnualSuperior: p.precoAnualSuperior != null ? Number(p.precoAnualSuperior) : undefined,
          precoMensalSecundario: p.precoMensalSecundario != null ? Number(p.precoMensalSecundario) : undefined,
          precoAnualSecundario: p.precoAnualSecundario != null ? Number(p.precoAnualSecundario) : undefined,
          limiteAlunos: p.limiteAlunos != null ? (typeof p.limiteAlunos === 'number' ? p.limiteAlunos : parseInt(String(p.limiteAlunos))) || null : null,
          limites: Array.isArray(p.limites) ? p.limites.filter(Boolean) : [],
          multiCampus: Boolean(p.multiCampus),
          cta: String(p.cta ?? 'Começar agora'),
          microtexto: String(p.microtexto ?? ''),
          popular: Boolean(p.popular),
        }));
      }
    } catch (_) {}
    return PLANOS_ESTRATEGICOS_DEFAULT;
  };

  const handlePlanosChange = (index: number, field: keyof PlanoLanding, value: string | number | string[] | boolean) => {
    const planos = getPlanosFromChanges();
    const updated = [...planos];
    if (!updated[index]) return;
    (updated[index] as any)[field] = value;
    handleChange(CHAVE_PLANOS_LANDING, JSON.stringify(updated));
  };

  const handleRestaurarPlanosPadrao = () => {
    handleChange(CHAVE_PLANOS_LANDING, JSON.stringify(PLANOS_ESTRATEGICOS_DEFAULT));
    toast({ title: 'Planos restaurados ao padrão', description: 'Clique em Salvar para confirmar.' });
  };

  const handleImageUpload = async (chave: string, file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Apenas imagens são permitidas', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande. Máximo 5MB.', variant: 'destructive' });
      return;
    }

    setUploading(chave);

    try {
      // Convert file to base64 for API upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          // For now, use the base64 data directly as URL (can be updated to use actual file upload endpoint)
          handleChange(chave, base64Data);
          toast({ title: 'Imagem carregada com sucesso!' });
        } catch (error: any) {
          console.error('Upload error:', error);
          toast({ title: 'Erro ao carregar imagem', description: error.message, variant: 'destructive' });
        } finally {
          setUploading(null);
        }
      };
      reader.onerror = () => {
        toast({ title: 'Erro ao ler arquivo', variant: 'destructive' });
        setUploading(null);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Erro ao carregar imagem', description: error.message, variant: 'destructive' });
      setUploading(null);
    }
  };

  const handleRemoveImage = async (chave: string) => {
    handleChange(chave, '');
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Salvar configs existentes
      for (const config of configs) {
        const newVal = changes[config.chave] ?? '';
        if (newVal !== (config.valor || '')) {
          await configuracoesLandingApi.update(config.chave, { valor: newVal });
        }
      }
      // Salvar blocos de conteúdo que podem não existir ainda
      for (const item of CONTENT_SCHEMA) {
        if (!configs.find((c) => c.chave === item.chave)) {
          const val = changes[item.chave];
          if (val !== undefined && val !== '') {
            await configuracoesLandingApi.update(item.chave, { valor: val });
          }
        }
      }
      // Salvar planos da landing (editáveis no painel) e sincronizar com tabela Plano para onboarding
      if (changes[CHAVE_PLANOS_LANDING] !== undefined) {
        const existing = configs.find((c) => c.chave === CHAVE_PLANOS_LANDING)?.valor ?? '';
        if (changes[CHAVE_PLANOS_LANDING] !== existing) {
          await configuracoesLandingApi.update(CHAVE_PLANOS_LANDING, { valor: changes[CHAVE_PLANOS_LANDING] });
          const planosParaSync = getPlanosFromChanges();
          if (planosParaSync.length >= 3) {
            await planosApi.syncFromLanding(planosParaSync.map((p) => ({
              id: p.id,
              nome: p.nome,
              tagline: p.tagline,
              precoMensal: p.precoMensal,
              precoAnual: p.precoAnual,
              limiteAlunos: p.limiteAlunos,
              cta: p.cta,
              microtexto: p.microtexto,
              popular: p.popular,
            })));
          }
        }
      }

      toast({ title: 'Configurações salvas com sucesso! Os planos foram sincronizados com o cadastro de instituições.' });
      fetchConfigs();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: typeof presetThemes[0]) => {
    setChanges(prev => ({
      ...prev,
      cor_primaria: preset.primary,
      cor_primaria_hover: preset.primaryHover,
      cor_secundaria: preset.secondary,
      cor_accent: preset.accent,
      cor_texto_hero: preset.heroText,
      cor_fundo_hero: preset.heroBg
    }));
    toast({ title: `Tema "${preset.name}" aplicado!`, description: 'Clique em Salvar para confirmar.' });
  };

  const hasChanges = 
    configs.some((c) => (changes[c.chave] ?? '') !== (c.valor || '')) ||
    CONTENT_SCHEMA.some((item) => {
      const current = configs.find((c) => c.chave === item.chave)?.valor || '';
      return (changes[item.chave] ?? '') !== current;
    }) ||
    (changes[CHAVE_PLANOS_LANDING] !== undefined && changes[CHAVE_PLANOS_LANDING] !== (configs.find((c) => c.chave === CHAVE_PLANOS_LANDING)?.valor ?? ''));

  const getLabel = (chave: string) => {
    const labels: Record<string, string> = {
      hero_badge: 'Badge do Hero',
      hero_titulo: 'Título Principal',
      hero_subtitulo: 'Subtítulo',
      dias_teste: 'Dias de Teste Grátis',
      contato_email: 'Email de Contato',
      contato_telefone: 'Telefone',
      contato_whatsapp: 'WhatsApp',
      rodape_texto: 'Texto do Rodapé',
      mostrar_precos: 'Mostrar Preços',
      cor_primaria: 'Cor Primária',
      cor_primaria_hover: 'Cor Primária (Hover)',
      cor_secundaria: 'Cor Secundária',
      cor_accent: 'Cor de Destaque',
      cor_texto_hero: 'Cor do Texto Hero',
      cor_fundo_hero: 'Cor de Fundo Hero',
      gradiente_ativo: 'Usar Gradiente',
      logo_principal: 'Logo Principal',
      logo_icone: 'Ícone da Marca',
      hero_imagem_fundo: 'Imagem de Fundo Hero',
      imagem_demo: 'Imagem de Demonstração',
    };
    return labels[chave] || chave;
  };

  const colorConfigs = configs.filter(c => c.tipo === 'color');
  const imageConfigs = configs.filter(c => c.tipo === 'image');
  const contentChaves = new Set(CONTENT_SCHEMA.map((x) => x.chave));
  const otherConfigs = configs.filter(
    (c) =>
      c.tipo !== 'color' &&
      c.tipo !== 'image' &&
      !contentChaves.has(c.chave) &&
      c.chave !== 'gradiente_ativo'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Configurações da Landing Page</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize o conteúdo, cores e imagens da página de vendas (página inicial)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/vendas', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver Landing
          </Button>
          <Button variant="outline" size="sm" onClick={fetchConfigs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Bloco: Imagens e Logos */}
      <Collapsible defaultOpen className="group">
        <Card className="border overflow-hidden transition-shadow hover:shadow-md">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Image className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Imagens e Logos</p>
                <p className="text-sm text-muted-foreground mt-0.5">Upload ou URLs das imagens da landing</p>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 pb-4 border-t bg-muted/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {imageConfigs.map(config => (
              <div key={config.chave} className="space-y-3">
                <Label className="text-sm font-medium">{getLabel(config.chave)}</Label>
                <p className="text-xs text-muted-foreground">{config.descricao}</p>
                
                <div className="relative">
                  {changes[config.chave] ? (
                    <div className="relative group">
                      <div className="aspect-video rounded-lg border-2 border-border overflow-hidden bg-muted">
                        <img 
                          src={changes[config.chave]} 
                          alt={getLabel(config.chave)}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => fileInputRefs.current[config.chave]?.click()}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveImage(config.chave)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRefs.current[config.chave]?.click()}
                      disabled={uploading === config.chave}
                      className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
                    >
                      {uploading === config.chave ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="h-8 w-8" />
                          <span className="text-xs">Clique para carregar</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  <input
                    ref={el => fileInputRefs.current[config.chave] = el}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(config.chave, file);
                      e.target.value = '';
                    }}
                  />
                </div>

                <Input
                  value={changes[config.chave] || ''}
                  onChange={e => handleChange(config.chave, e.target.value)}
                  placeholder="Ou cole uma URL de imagem..."
                  className="text-xs"
                />
              </div>
            ))}
          </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Bloco: Tema de Cores */}
      <Collapsible defaultOpen className="group">
        <Card className="border overflow-hidden transition-shadow hover:shadow-md">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Palette className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Tema de Cores</p>
                <p className="text-sm text-muted-foreground mt-0.5">Cores e temas predefinidos da landing</p>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 pb-4 border-t bg-muted/20 space-y-6">
          <div>
            <Label className="text-sm font-medium mb-3 block">Temas Predefinidos</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {presetThemes.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="group p-3 rounded-lg border-2 border-border hover:border-primary transition-all text-left"
                >
                  <div className="flex gap-1 mb-2">
                    <div 
                      className="w-6 h-6 rounded-full shadow-sm" 
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full shadow-sm" 
                      style={{ backgroundColor: preset.secondary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full shadow-sm" 
                      style={{ backgroundColor: preset.accent }}
                    />
                  </div>
                  <span className="text-xs font-medium group-hover:text-primary transition-colors">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">Cores Personalizadas</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {colorConfigs.map(config => (
                <div key={config.chave} className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{getLabel(config.chave)}</Label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-10 h-10 rounded-lg border-2 border-border shadow-inner cursor-pointer overflow-hidden"
                      style={{ backgroundColor: changes[config.chave] || '#8B5CF6' }}
                    >
                      <input
                        type="color"
                        value={changes[config.chave] || '#8B5CF6'}
                        onChange={e => handleChange(config.chave, e.target.value)}
                        className="w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <Input
                      value={changes[config.chave] || ''}
                      onChange={e => handleChange(config.chave, e.target.value)}
                      className="font-mono text-xs h-10"
                      placeholder="#RRGGBB"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {configs.find(c => c.chave === 'gradiente_ativo') && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <Label className="text-sm font-medium">Usar Gradiente no Hero</Label>
                <p className="text-xs text-muted-foreground">Aplica um gradiente suave na seção principal</p>
              </div>
              <Switch
                checked={changes['gradiente_ativo'] === 'true'}
                onCheckedChange={checked => handleChange('gradiente_ativo', checked ? 'true' : 'false')}
              />
            </div>
          )}

          <div className="p-4 rounded-lg border-2 border-dashed border-border bg-background">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pré-visualização</span>
            </div>
            <div 
              className="rounded-lg p-6 transition-all"
              style={{ 
                backgroundColor: changes['cor_fundo_hero'] || '#F8FAFC',
                background: changes['gradiente_ativo'] === 'true' 
                  ? `linear-gradient(135deg, ${changes['cor_primaria'] || '#8B5CF6'}15, ${changes['cor_fundo_hero'] || '#F8FAFC'})`
                  : changes['cor_fundo_hero'] || '#F8FAFC'
              }}
            >
              <div className="max-w-md mx-auto text-center">
                {changes['logo_principal'] && (
                  <img 
                    src={changes['logo_principal']} 
                    alt="Logo Preview" 
                    className="h-12 mx-auto mb-4 object-contain"
                  />
                )}
                <h3 
                  className="text-2xl font-bold mb-2"
                  style={{ color: changes['cor_texto_hero'] || '#1E293B' }}
                >
                  {changes['hero_titulo'] || 'Título do Hero'}
                </h3>
                <p 
                  className="text-sm mb-4 opacity-80"
                  style={{ color: changes['cor_texto_hero'] || '#1E293B' }}
                >
                  {changes['hero_subtitulo'] || 'Subtítulo descritivo da página'}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                    style={{ 
                      backgroundColor: changes['cor_primaria'] || '#8B5CF6',
                    }}
                  >
                    Botão Primário
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors"
                    style={{ 
                      borderColor: changes['cor_primaria'] || '#8B5CF6',
                      color: changes['cor_primaria'] || '#8B5CF6',
                    }}
                  >
                    Botão Secundário
                  </button>
                </div>
              </div>
            </div>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Editor por blocos / seções (estilo Horizon) */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Type className="h-5 w-5 text-muted-foreground" />
            Conteúdo por blocos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Edite cada seção da landing page. Clique no bloco para expandir ou recolher.
          </p>
        </div>
        <div className="space-y-2">
          {SECTION_ORDER.map((sectionKey) => {
            const items = CONTENT_SCHEMA.filter((item) => item.section === sectionKey);
            if (items.length === 0) return null;
            const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey;
            const IconComponent = SECTION_ICONS[sectionKey];
            const previewText = (() => {
              const first = items[0];
              if (!first) return '';
              const v = (changes[first.chave] || '').trim();
              return v ? (v.length > 55 ? v.slice(0, 55) + '…' : v) : '';
            })();
            return (
              <Collapsible key={sectionKey} defaultOpen={sectionKey === 'hero'} className="group">
                <Card className="border overflow-hidden transition-shadow hover:shadow-md">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {IconComponent ? <IconComponent className="h-5 w-5" /> : <Type className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{sectionLabel}</p>
                        {previewText && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">{previewText}</p>
                        )}
                      </div>
                      <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 border-t bg-muted/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        {items.map((item) => (
                          <div key={item.chave} className="space-y-2">
                            <Label className="text-sm font-medium">{item.label}</Label>
                            {item.multiline ? (
                              <Textarea
                                value={changes[item.chave] || ''}
                                onChange={(e) => handleChange(item.chave, e.target.value)}
                                placeholder={item.placeholder}
                                rows={2}
                                className="resize-none"
                              />
                            ) : (
                              <Input
                                value={changes[item.chave] || ''}
                                onChange={(e) => handleChange(item.chave, e.target.value)}
                                placeholder={item.placeholder}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Planos Exibidos na Landing</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={handleRestaurarPlanosPadrao}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar padrão
            </Button>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>Edite os 3 planos exibidos em /vendas e no cadastro de instituições. Ao salvar, são sincronizados.</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => setSearchParams({ tab: 'planos' })}>
              Ver todos os planos
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {getPlanosFromChanges().map((plano, index) => (
            <Collapsible key={plano.id} defaultOpen={index === 0}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-auto py-3">
                  <span className="font-semibold">{plano.nome}</span>
                  <span className="text-muted-foreground text-sm">{plano.popular ? '— Mais Popular' : ''}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg bg-muted/30">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Nome do Plano</Label>
                    <Input
                      value={plano.nome}
                      onChange={(e) => handlePlanosChange(index, 'nome', e.target.value)}
                      placeholder="DSICOLA START"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Tagline</Label>
                    <Input
                      value={plano.tagline}
                      onChange={(e) => handlePlanosChange(index, 'tagline', e.target.value)}
                      placeholder="Automatize toda a gestão académica"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço Mensal (AOA)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plano.precoMensal || ''}
                      onChange={(e) => handlePlanosChange(index, 'precoMensal', parseInt(e.target.value) || 0)}
                      placeholder="350000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço Anual (AOA) — 10 meses</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plano.precoAnual || ''}
                      onChange={(e) => handlePlanosChange(index, 'precoAnual', parseInt(e.target.value) || 0)}
                      placeholder="3360000"
                    />
                  </div>
                  <div className="md:col-span-2 text-xs text-muted-foreground border-t pt-4 mt-2">
                    Preços específicos (opcional — vazio = usa preço geral acima)
                  </div>
                  <div className="space-y-2">
                    <Label>Mensal Superior (AOA)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plano.precoMensalSuperior ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        handlePlanosChange(index, 'precoMensalSuperior', v === '' ? undefined : parseInt(v) || 0);
                      }}
                      placeholder="Vazio = preço geral"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Anual Superior (AOA)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plano.precoAnualSuperior ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        handlePlanosChange(index, 'precoAnualSuperior', v === '' ? undefined : parseInt(v) || 0);
                      }}
                      placeholder="Vazio = preço geral"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mensal Secundário (AOA)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plano.precoMensalSecundario ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        handlePlanosChange(index, 'precoMensalSecundario', v === '' ? undefined : parseInt(v) || 0);
                      }}
                      placeholder="Vazio = preço geral"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Anual Secundário (AOA)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plano.precoAnualSecundario ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        handlePlanosChange(index, 'precoAnualSecundario', v === '' ? undefined : parseInt(v) || 0);
                      }}
                      placeholder="Vazio = preço geral"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Limite de Alunos</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plano.limiteAlunos ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        handlePlanosChange(index, 'limiteAlunos', v === '' ? null : parseInt(v) || 0);
                      }}
                      placeholder="Vazio = ilimitado"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Funcionalidades (uma por linha)</Label>
                    <Textarea
                      value={plano.limites.join('\n')}
                      onChange={(e) => handlePlanosChange(index, 'limites', e.target.value.split('\n').filter(Boolean))}
                      placeholder="Uma funcionalidade por linha (ex: Até 500 alunos)"
                      rows={5}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto do Botão (CTA)</Label>
                    <Input
                      value={plano.cta}
                      onChange={(e) => handlePlanosChange(index, 'cta', e.target.value)}
                      placeholder="Começar agora"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Microtexto (abaixo do botão)</Label>
                    <Input
                      value={plano.microtexto}
                      onChange={(e) => handlePlanosChange(index, 'microtexto', e.target.value)}
                      placeholder="Sem fidelização"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={plano.multiCampus}
                      onCheckedChange={(checked) => handlePlanosChange(index, 'multiCampus', checked)}
                    />
                    <Label>Multi-campus</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={plano.popular}
                      onCheckedChange={(checked) => handlePlanosChange(index, 'popular', checked)}
                    />
                    <Label>Plano Mais Popular (destaque)</Label>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Informações de Contato</CardTitle>
          <CardDescription>Dados de contato exibidos na landing page</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {configs.filter(c => c.chave.startsWith('contato')).map(config => (
            <div key={config.chave} className="space-y-2">
              <Label>{getLabel(config.chave)}</Label>
              <Input
                value={changes[config.chave] || ''}
                onChange={e => handleChange(config.chave, e.target.value)}
                placeholder={config.descricao || ''}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {otherConfigs.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Outras Configurações</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherConfigs.map(config => (
              <div key={config.chave} className="space-y-2">
                <Label>{getLabel(config.chave)}</Label>
                {config.tipo === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={changes[config.chave] === 'true'}
                      onCheckedChange={checked => handleChange(config.chave, checked ? 'true' : 'false')}
                    />
                    <span className="text-sm text-muted-foreground">{config.descricao}</span>
                  </div>
                ) : (
                  <Input
                    value={changes[config.chave] || ''}
                    onChange={e => handleChange(config.chave, e.target.value)}
                    placeholder={config.descricao || ''}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
