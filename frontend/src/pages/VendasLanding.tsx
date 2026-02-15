import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { planosApi, configuracoesLandingApi, leadsApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  GraduationCap, 
  ArrowRight,
  BookOpen,
  Users,
  CreditCard,
  BarChart3,
  Shield,
  Clock,
  Check,
  Building2,
  Phone,
  Mail,
  Infinity,
  Sparkles,
  Zap,
  Globe,
  HeadphonesIcon,
  MessageCircle,
  Send,
  Video,
  Play
} from "lucide-react";

interface Plano {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_academico: 'SECUNDARIO' | 'SUPERIOR' | null;
  preco_mensal: number;
  valor_anual: number | null;
  valor_semestral: number | null;
  preco_secundario: number;
  preco_universitario: number;
  limite_alunos: number | null;
  limite_professores: number | null;
  limite_cursos: number | null;
  funcionalidades: unknown;
}

const funcionalidadesLabels: Record<string, string> = {
  gestao_alunos: 'Gestão de Alunos',
  gestao_professores: 'Gestão de Professores',
  notas: 'Notas e Avaliações',
  frequencia: 'Controle de Frequência',
  financeiro: 'Gestão Financeira',
  documentos: 'Emissão de Documentos',
  comunicados: 'Comunicados',
  alojamentos: 'Gestão de Alojamentos',
  analytics: 'Analytics Avançado',
  api_access: 'Acesso à API',
};

export default function VendasLanding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tipoInstituicao, setTipoInstituicao] = useState<'secundario' | 'universitario'>('universitario');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nome_instituicao: '',
    nome_responsavel: '',
    email: '',
    telefone: '',
    cidade: '',
    mensagem: '',
    tipo_instituicao: 'universitario',
  });

  // Dynamic theme colors
  const themeColors = {
    primary: config.cor_primaria || '#8B5CF6',
    primaryHover: config.cor_primaria_hover || '#7C3AED',
    secondary: config.cor_secundaria || '#1E293B',
    accent: config.cor_accent || '#06B6D4',
    heroText: config.cor_texto_hero || '#1E293B',
    heroBg: config.cor_fundo_hero || '#F8FAFC',
    useGradient: config.gradiente_ativo === 'true'
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch planos filtrados por tipo (Secundário ou Superior)
        const tipoParam = tipoInstituicao === 'secundario' ? 'SECUNDARIO' : 'SUPERIOR';
        const planosData = await planosApi.getAll({ ativo: true, tipoAcademico: tipoParam });
        setPlanos(Array.isArray(planosData) ? planosData : []);
        
        // Fetch landing config
        const configData = await configuracoesLandingApi.getAll();
        
        if (Array.isArray(configData)) {
          const configMap: Record<string, string> = {};
          configData.forEach((c: any) => {
            configMap[c.chave] = c.valor || '';
          });
          setConfig(configMap);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tipoInstituicao]);

  // Apply dynamic CSS variables for theme colors
  useEffect(() => {
    if (config.cor_primaria) {
      document.documentElement.style.setProperty('--landing-primary', themeColors.primary);
      document.documentElement.style.setProperty('--landing-primary-hover', themeColors.primaryHover);
      document.documentElement.style.setProperty('--landing-secondary', themeColors.secondary);
      document.documentElement.style.setProperty('--landing-accent', themeColors.accent);
    }
    return () => {
      document.documentElement.style.removeProperty('--landing-primary');
      document.documentElement.style.removeProperty('--landing-primary-hover');
      document.documentElement.style.removeProperty('--landing-secondary');
      document.documentElement.style.removeProperty('--landing-accent');
    };
  }, [config, themeColors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await leadsApi.create({
        nomeInstituicao: formData.nome_instituicao,
        nomeResponsavel: formData.nome_responsavel,
        email: formData.email,
        telefone: formData.telefone,
        cidade: formData.cidade || null,
        mensagem: formData.mensagem || null,
        tipoInstituicao: formData.tipo_instituicao === 'secundario' ? 'Ensino Secundário' : 'Universidade',
      });

      toast({
        title: "Interesse registrado com sucesso! ✅",
        description: "Nossa equipe entrará em contato em até 24h. Obrigado pelo interesse!",
      });

      setFormData({
        nome_instituicao: '',
        nome_responsavel: '',
        email: '',
        telefone: '',
        cidade: '',
        mensagem: '',
        tipo_instituicao: 'universitario',
      });
    } catch (error: any) {
      console.error("Error submitting lead:", error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente ou entre em contato pelo telefone.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
  };

  const features = [
    { icon: Users, title: 'Gestão de Alunos', description: 'Cadastro completo, matrículas, histórico acadêmico e documentação.' },
    { icon: GraduationCap, title: 'Gestão de Professores', description: 'Atribuição de turmas, lançamento de notas e frequência.' },
    { icon: CreditCard, title: 'Financeiro Completo', description: 'Mensalidades, recibos, multas automáticas e relatórios.' },
    { icon: BookOpen, title: 'Acadêmico Integrado', description: 'Cursos, disciplinas, turmas, horários e exames.' },
    { icon: BarChart3, title: 'Relatórios e Analytics', description: 'Dashboards com indicadores em tempo real.' },
    { icon: Shield, title: 'Segurança e Privacidade', description: 'Dados isolados por instituição, backups automáticos.' },
  ];

  const benefitsConfig = [
    { icon: Globe, key: 'benefit_1', default: 'Acesso de qualquer lugar, 24/7' },
    { icon: Zap, key: 'benefit_2', default: 'Implementação rápida em 24h' },
    { icon: HeadphonesIcon, key: 'benefit_3', default: 'Suporte técnico dedicado' },
    { icon: Sparkles, key: 'benefit_4', default: 'Atualizações gratuitas' },
  ];

  const getDemoEmbedUrl = (url: string) => {
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (youtubeMatch?.[1]) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    return url;
  };

  /** Normaliza URL Bunny.net: embed ou play em iframe.mediadelivery.net */
  const getBunnyEmbedUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  };

  /** Normaliza link WhatsApp: aceita wa.me, api.whatsapp.com ou número puro */
  const getWhatsAppUrl = (input: string | undefined): string => {
    if (!input?.trim()) return '';
    const val = input.trim();
    if (val.startsWith('https://wa.me/') || val.startsWith('https://api.whatsapp.com/')) return val;
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 9) return `https://wa.me/${digits}`;
    return val.startsWith('http') ? val : `https://wa.me/${digits || val}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              {config.logo_principal || config.logo_icone ? (
                <img 
                  src={config.logo_principal || config.logo_icone} 
                  alt="DSICOLA"
                  className="h-8 sm:h-10 object-contain"
                />
              ) : (
                <>
                  <div 
                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: themeColors.primary }}
                  >
                    <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-bold">DSICOLA</h1>
                    <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">Sistema de Gestão Acadêmica</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-4" onClick={() => navigate('/auth')}>
                Login
              </Button>
              <Button 
                size="sm" 
                className="text-xs sm:text-sm px-2 sm:px-4" 
                onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ backgroundColor: themeColors.primary }}
              >
                <span className="hidden sm:inline">Solicitar Demo</span>
                <span className="sm:hidden">Demo</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="py-12 sm:py-16 md:py-24 px-3 sm:px-4 relative overflow-hidden"
        style={{
          background: themeColors.useGradient
            ? `linear-gradient(135deg, ${themeColors.primary}15, ${themeColors.heroBg})`
            : themeColors.heroBg
        }}
      >
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute -top-20 sm:-top-40 -right-20 sm:-right-40 w-40 sm:w-80 h-40 sm:h-80 rounded-full blur-3xl" 
            style={{ backgroundColor: `${themeColors.primary}20` }}
          />
          <div 
            className="absolute -bottom-20 sm:-bottom-40 -left-20 sm:-left-40 w-40 sm:w-80 h-40 sm:h-80 rounded-full blur-3xl" 
            style={{ backgroundColor: `${themeColors.primary}10` }}
          />
        </div>
        
        <div className="container mx-auto relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge 
              className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm" 
              variant="secondary"
              style={{ 
                backgroundColor: `${themeColors.secondary}15`,
                color: themeColors.secondary
              }}
            >
              {config.hero_badge || '🎓 Plataforma DSICOLA Multi-Tenant'}
            </Badge>
            <h1 
              className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight px-2"
              style={{
                background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.primary}CC, ${themeColors.primary}99)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              {config.hero_titulo || 'Sistema de Gestão Acadêmica Completo'}
            </h1>
            <p 
              className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-2"
              style={{ color: `${themeColors.heroText}CC` }}
            >
              {config.hero_subtitulo || 'Modernize a gestão da sua instituição de ensino com uma plataforma completa, segura e fácil de usar.'}{' '}
              <span className="font-medium" style={{ color: themeColors.heroText }}>Tudo em um só lugar.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Button 
                size="lg" 
                className="text-sm sm:text-base lg:text-lg px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 shadow-lg hover:shadow-xl transition-all w-full sm:w-auto" 
                onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ 
                  backgroundColor: themeColors.primary,
                  color: '#FFFFFF'
                }}
              >
                {config.hero_cta_primario || 'Ver Planos e Preços'}
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-sm sm:text-base lg:text-lg px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 w-full sm:w-auto" 
                onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ 
                  borderColor: themeColors.primary,
                  color: themeColors.primary
                }}
              >
                {config.hero_cta_secundario || 'Agendar Demonstração'}
              </Button>
            </div>
            
            {/* Trust indicators */}
            <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-3 sm:gap-6 text-xs sm:text-sm px-2" style={{ color: `${themeColors.heroText}99` }}>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: themeColors.accent }} />
                <span>{config.trust_1 || 'Dados 100% seguros'}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: themeColors.accent }} />
                <span>{config.trust_2 || `${config.dias_teste || '14'} dias grátis`}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: themeColors.primary }} />
                <span>{config.trust_3 || 'Sem cartão de crédito'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Bar */}
      <section 
        className="py-4 sm:py-6"
        style={{ backgroundColor: themeColors.primary, color: '#FFFFFF' }}
      >
        <div className="container mx-auto px-3 sm:px-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-8">
            {benefitsConfig.map((benefit, index) => (
              <div key={index} className="flex items-center gap-1.5 sm:gap-2 justify-center">
                <benefit.icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{config[benefit.key] || benefit.default}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 px-3 sm:px-4">
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 px-2">
              {config.features_titulo || 'Tudo que sua instituição precisa'}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-2 leading-relaxed">
              {config.features_subtitulo || 'Uma plataforma completa que digitaliza e automatiza todos os processos acadêmicos e administrativos da sua instituição.'}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">{feature.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="demo-video" className="py-12 sm:py-16 md:py-20 px-3 sm:px-4 bg-muted/20">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-muted-foreground leading-relaxed px-2">
              {config.demo_video_texto || 'Assista ao vídeo e descubra como sua instituição pode ser totalmente organizada em poucos dias'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8">
              {config.demo_video_url && (
                  <Button
                    size="lg"
                    className="gap-2"
                    style={{ backgroundColor: themeColors.primary, color: '#FFFFFF' }}
                    onClick={() => document.getElementById('embed-demo-video')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Play className="h-5 w-5" />
                    {config.demo_video_botao || 'Assistir Demonstração'}
                  </Button>
              )}
              {(config.demo_whatsapp_url || config.contato_whatsapp) ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2"
                    style={{ borderColor: themeColors.primary, color: themeColors.primary }}
                    onClick={() => {
                      const url = getWhatsAppUrl(config.demo_whatsapp_url || config.contato_whatsapp);
                      if (url) window.open(url, '_blank');
                    }}
                  >
                    <MessageCircle className="h-5 w-5" />
                    {config.demo_whatsapp_botao || 'Fale conosco no WhatsApp'}
                  </Button>
              ) : null}
            </div>
              {config.demo_video_url && (
                <div id="embed-demo-video" className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg border-2 border-border bg-muted">
                  {config.demo_video_url.includes('youtube.com') || config.demo_video_url.includes('youtu.be') ? (
                    <iframe
                      src={getDemoEmbedUrl(config.demo_video_url)}
                      title="Vídeo de Demonstração"
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : config.demo_video_url.includes('mediadelivery.net') ? (
                    <iframe
                      src={getBunnyEmbedUrl(config.demo_video_url)}
                      title="Vídeo de Demonstração"
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <a
                      href={config.demo_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <div className="text-center">
                        <Video className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
                        <span className="text-sm font-medium">{config.demo_video_botao || 'Assistir Demonstração'}</span>
                      </div>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

      {/* Pricing Section */}
      <section id="planos" className="py-12 sm:py-16 md:py-20 px-3 sm:px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">
              {config.planos_titulo || 'Planos e Preços'}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto mb-4 sm:mb-6 px-2">
              {config.planos_subtitulo || 'Escolha o plano ideal para o tamanho da sua instituição'}
            </p>
            <Badge variant="secondary" className="mb-4 text-xs sm:text-sm">
              🎁 {config.planos_badge || `${config.dias_teste || '14'} dias de teste grátis em todos os planos`}
            </Badge>
            
            {/* Toggle tipo de instituição */}
            <div className="flex flex-col xs:flex-row justify-center gap-2 mt-4 sm:mt-6 px-4">
              <Button
                variant={tipoInstituicao === 'secundario' ? 'default' : 'outline'}
                onClick={() => setTipoInstituicao('secundario')}
                className="gap-2 text-xs sm:text-sm"
                size="sm"
              >
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Ensino Secundário
              </Button>
              <Button
                variant={tipoInstituicao === 'universitario' ? 'default' : 'outline'}
                onClick={() => setTipoInstituicao('universitario')}
                className="gap-2 text-xs sm:text-sm"
                size="sm"
              >
                <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Universidade
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {planos.map((plano, index) => {
                const isPopular = index === 1;
                const precoMensal = tipoInstituicao === 'secundario' ? plano.preco_secundario : plano.preco_universitario;
                const funcionalidades = (Array.isArray(plano.funcionalidades) ? Object.fromEntries((plano.funcionalidades as string[]).map(k => [k, true])) : (plano.funcionalidades as Record<string, boolean>)) || {};
                
                return (
                  <Card 
                    key={plano.id} 
                    className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge style={{ backgroundColor: themeColors.primary }}>
                          {config.planos_popular || 'Mais Popular'}
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg sm:text-xl">{plano.nome}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">{plano.descricao}</CardDescription>
                      <div className="pt-4 space-y-1">
                        <div>
                          <span className="text-2xl sm:text-3xl font-bold">{formatCurrency(precoMensal)}</span>
                          <span className="text-muted-foreground text-sm">/mês</span>
                        </div>
                        {plano.valor_anual && (
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(plano.valor_anual)}/ano
                            {tipoInstituicao === 'secundario' && plano.valor_anual === 350000 && ' (2 meses grátis)'}
                          </p>
                        )}
                        {tipoInstituicao === 'secundario' && plano.valor_semestral && (
                          <p className="text-xs text-muted-foreground">{formatCurrency(plano.valor_semestral)}/semestre</p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span>{plano.limite_alunos ? `Até ${plano.limite_alunos} alunos` : 'Alunos ilimitados'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary" />
                          <span>{plano.limite_professores ? `Até ${plano.limite_professores} professores` : 'Professores ilimitados'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span>{plano.limite_cursos ? `Até ${plano.limite_cursos} cursos` : 'Cursos ilimitados'}</span>
                        </div>
                      </div>
                      
                      <div className="border-t pt-4">
                        <p className="text-xs font-medium mb-2">Funcionalidades incluídas:</p>
                        <div className="space-y-1">
                          {Object.entries(funcionalidades).filter(([_, v]) => v).slice(0, 5).map(([key]) => (
                            <div key={key} className="flex items-center gap-2 text-xs">
                              <Check className="h-3 w-3 text-green-500" />
                              <span>{funcionalidadesLabels[key] || key}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        variant={isPopular ? "default" : "outline"}
                        onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                        style={isPopular ? { backgroundColor: themeColors.primary } : {}}
                      >
                        {config.planos_botao || 'Começar Agora'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contato" className="py-12 sm:py-16 md:py-20 px-3 sm:px-4">
        <div className="container mx-auto">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <Badge variant="secondary" className="mb-3 text-xs">
                <MessageCircle className="h-3 w-3 mr-1" />
                {config.contato_badge || 'Formulário de Contato'}
              </Badge>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3">
                {config.contato_titulo || 'Solicite uma Demonstração'}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
                {config.contato_subtitulo || 'Preencha o formulário abaixo e nossa equipe entrará em contato em até 24 horas úteis.'}
              </p>
            </div>

            <Card className="border-0 shadow-lg">
              <CardContent className="pt-6 sm:pt-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome_instituicao">Nome da Instituição *</Label>
                      <Input
                        id="nome_instituicao"
                        value={formData.nome_instituicao}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome_instituicao: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="nome_responsavel">Nome do Responsável *</Label>
                      <Input
                        id="nome_responsavel"
                        value={formData.nome_responsavel}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome_responsavel: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          className="pl-10"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="telefone"
                          className="pl-10"
                          value={formData.telefone}
                          onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="mensagem">Mensagem</Label>
                    <Textarea
                      id="mensagem"
                      value={formData.mensagem}
                      onChange={(e) => setFormData(prev => ({ ...prev, mensagem: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={submitting}
                    style={{ backgroundColor: themeColors.primary }}
                  >
                    {submitting ? (
                      "Enviando..."
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        {config.contato_botao || 'Enviar Mensagem'}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-10 px-3 sm:px-4 mt-4">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {config.logo_principal || config.logo_icone ? (
                <img 
                  src={config.logo_principal || config.logo_icone} 
                  alt="DSICOLA"
                  className="h-6 object-contain opacity-80"
                />
              ) : (
                <GraduationCap className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="font-medium text-sm">DSICOLA</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <button 
                onClick={() => navigate('/auth')} 
                className="hover:text-foreground transition-colors"
              >
                Acesso ao Sistema
              </button>
              <a 
                href={`mailto:${config.contato_email || 'contato@dsicola.com'}`}
                className="hover:text-foreground transition-colors"
              >
                Contato
              </a>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6 pt-6 border-t">
            © {new Date().getFullYear()} DSICOLA. {config.rodape_creditos || 'Sistema de Gestão Acadêmica. Todos os direitos reservados.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
