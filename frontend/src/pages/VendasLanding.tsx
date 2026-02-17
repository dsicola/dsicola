import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { configuracoesLandingApi, leadsApi } from "@/services/api";
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
  Play,
  Building2,
} from "lucide-react";
import { PLANOS_ESTRATEGICOS_DEFAULT, PlanoLanding, CHAVE_PLANOS_LANDING } from "@/constants/planosLanding";

export default function VendasLanding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [periodoPreco, setPeriodoPreco] = useState<'mensal' | 'anual'>('anual');
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

  /** Planos exibidos: da config (editáveis no painel) ou padrão */
  const planosExibidos: PlanoLanding[] = useMemo(() => {
    const raw = config[CHAVE_PLANOS_LANDING];
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
  }, [config]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configData = await configuracoesLandingApi.getAll();
        if (Array.isArray(configData)) {
          const configMap: Record<string, string> = {};
          configData.forEach((c: any) => {
            configMap[c.chave] = c.valor || '';
          });
          setConfig(configMap);
        }
      } catch (error) {
        console.error("Error fetching config:", error);
      }
    };
    fetchConfig();
  }, []);

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
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}>
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 w-full max-w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              {config.logo_principal || config.logo_icone ? (
                <img 
                  src={config.logo_principal || config.logo_icone} 
                  alt="DSICOLA"
                  className="h-8 sm:h-10 w-auto max-w-[120px] sm:max-w-[180px] object-contain"
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
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-4 min-h-[40px] touch-manipulation" onClick={() => navigate('/auth')}>
                Login
              </Button>
              <Button 
                size="sm" 
                className="text-xs sm:text-sm px-2 sm:px-4 min-h-[40px] touch-manipulation" 
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
              className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm break-words text-center max-w-full" 
              variant="secondary"
              style={{ 
                backgroundColor: `${themeColors.secondary}15`,
                color: themeColors.secondary
              }}
            >
              <span className="break-words">{config.hero_badge || '🎓 Plataforma DSICOLA Multi-Tenant'}</span>
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
                className="text-sm sm:text-base lg:text-lg px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 shadow-lg hover:shadow-xl transition-all w-full sm:w-auto min-h-[44px] touch-manipulation" 
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
                className="text-sm sm:text-base lg:text-lg px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 w-full sm:w-auto min-h-[44px] touch-manipulation" 
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
            <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-2 sm:gap-6 text-xs sm:text-sm px-2" style={{ color: `${themeColors.heroText}99` }}>
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: themeColors.accent }} />
                <span className="break-words">{config.trust_1 || 'Dados 100% seguros'}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: themeColors.accent }} />
                <span className="break-words">{config.trust_2 || `${config.dias_teste || '14'} dias grátis`}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: themeColors.primary }} />
                <span className="break-words">{config.trust_3 || 'Sem cartão de crédito'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Bar */}
      <section 
        className="py-4 sm:py-6 overflow-hidden"
        style={{ backgroundColor: themeColors.primary, color: '#FFFFFF' }}
      >
        <div className="container mx-auto px-3 sm:px-4 max-w-full">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2 sm:gap-8">
            {benefitsConfig.map((benefit, index) => (
              <div key={index} className="flex items-center gap-1.5 sm:gap-2 justify-center min-w-0">
                <benefit.icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 flex-shrink-0" />
                <span className="text-[11px] xs:text-xs sm:text-sm font-medium break-words">{config[benefit.key] || benefit.default}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 px-3 sm:px-4 overflow-hidden">
        <div className="container mx-auto max-w-full">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 px-2">
              {config.features_titulo || 'Tudo que sua instituição precisa'}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-2 leading-relaxed">
              {config.features_subtitulo || 'Uma plataforma completa que digitaliza e automatiza todos os processos acadêmicos e administrativos da sua instituição.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-all hover:-translate-y-1 min-w-0 overflow-hidden">
                <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
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
      <section id="demo-video" className="py-12 sm:py-16 md:py-20 px-3 sm:px-4 bg-muted/20 overflow-hidden">
        <div className="container mx-auto max-w-full">
          <div className="max-w-4xl mx-auto text-center w-full">
            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-muted-foreground leading-relaxed px-2">
              {config.demo_video_texto || 'Assista ao vídeo e descubra como sua instituição pode ser totalmente organizada em poucos dias'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 w-full max-w-full">
              {config.demo_video_url && (
                  <Button
                    size="lg"
                    className="gap-2 w-full sm:w-auto min-h-[44px] touch-manipulation"
                    style={{ backgroundColor: themeColors.primary, color: '#FFFFFF' }}
                    onClick={() => document.getElementById('embed-demo-video')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Play className="h-5 w-5 shrink-0" />
                    <span className="truncate">{config.demo_video_botao || 'Assistir Demonstração'}</span>
                  </Button>
              )}
              {(config.demo_whatsapp_url || config.contato_whatsapp) ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 w-full sm:w-auto min-h-[44px] touch-manipulation"
                    style={{ borderColor: themeColors.primary, color: themeColors.primary }}
                    onClick={() => {
                      const url = getWhatsAppUrl(config.demo_whatsapp_url || config.contato_whatsapp);
                      if (url) window.open(url, '_blank');
                    }}
                  >
                    <MessageCircle className="h-5 w-5 shrink-0" />
                    <span className="truncate">{config.demo_whatsapp_botao || 'Fale conosco no WhatsApp'}</span>
                  </Button>
              ) : null}
            </div>
              {config.demo_video_url && (
                <div id="embed-demo-video" className="relative w-full max-w-full aspect-video rounded-xl overflow-hidden shadow-lg border-2 border-border bg-muted">
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

      {/* Pricing Section - SaaS profissional estratégico */}
      <section 
        id="planos" 
        className="py-16 sm:py-20 md:py-28 px-3 sm:px-4 overflow-hidden"
        style={{ backgroundColor: themeColors.primary || '#0f766e' }}
      >
        <div className="container mx-auto max-w-6xl">
          {/* Header - Hierarquia visual forte */}
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              {config.planos_titulo || 'Planos e Preços'}
            </h2>
            <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto mb-8 px-2 leading-relaxed">
              {config.planos_subtitulo || 'A gestão académica completa que sua instituição merece. Preços acessíveis, valor premium.'}
            </p>

            {/* Toggle Anual / Mensal com economia real */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <div className="inline-flex bg-white/10 rounded-full px-1 py-1 border border-white/20 items-center">
                <button
                  type="button"
                  onClick={() => setPeriodoPreco('anual')}
                  className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-full text-sm font-semibold transition-all min-h-[48px] touch-manipulation ${
                    periodoPreco === 'anual' 
                      ? 'bg-white shadow-lg' 
                      : 'text-white hover:bg-white/10'
                  }`}
                  style={periodoPreco === 'anual' ? { color: themeColors.primary || '#0f766e' } : {}}
                >
                  Anual
                </button>
                <span className="bg-emerald-700 text-white text-xs font-bold px-2.5 py-1 rounded-full mx-1">
                  -20%
                </span>
                <button
                  type="button"
                  onClick={() => setPeriodoPreco('mensal')}
                  className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-full text-sm font-semibold transition-all min-h-[48px] touch-manipulation ${
                    periodoPreco === 'mensal' 
                      ? 'bg-white shadow-lg' 
                      : 'text-white hover:bg-white/10'
                  }`}
                  style={periodoPreco === 'mensal' ? { color: themeColors.primary || '#0f766e' } : {}}
                >
                  Mensal
                </button>
              </div>
              {periodoPreco === 'anual' && (() => {
                const planoPopular = planosExibidos.find(p => p.popular) ?? planosExibidos[1];
                const economiaAnual = planoPopular ? planoPopular.precoMensal * 12 - planoPopular.precoAnual : 1560000;
                if (economiaAnual <= 0) return null;
                return (
                  <p className="text-white/90 text-sm font-medium">
                    Economize até <strong>{formatCurrency(economiaAnual)}/ano</strong> no plano {planoPopular.nome}
                  </p>
                );
              })()}
            </div>

            <p className="text-white/80 text-sm mt-6">
              🎁 {config.planos_badge || `${config.dias_teste || '14'} dias de teste grátis em todos os planos`}
            </p>
          </div>

          {/* Cards - PRO centralizado e destacado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-stretch">
            {planosExibidos.map((plano) => {
              const valorExibir = periodoPreco === 'anual' ? plano.precoAnual : plano.precoMensal;
              const economiaMensal = periodoPreco === 'anual' 
                ? Math.round((plano.precoMensal * 12 - plano.precoAnual) / 12) 
                : 0;
              const isPro = plano.popular;
              
              return (
                <div 
                  key={plano.id}
                  className={`flex flex-col ${isPro ? 'md:-mt-4 md:mb-4 order-first md:order-none' : ''}`}
                >
                  <Card 
                    className={`relative min-w-0 flex flex-col h-full overflow-hidden transition-all ${
                      isPro 
                        ? 'bg-white rounded-2xl shadow-2xl ring-4 ring-white/60 scale-[1.02] border-0' 
                        : 'bg-white/95 backdrop-blur rounded-xl shadow-lg'
                    }`}
                  >
                    {isPro && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <span 
                          className="inline-block px-4 py-1.5 text-sm font-bold text-white rounded-full shadow-lg"
                          style={{ backgroundColor: themeColors.primary || '#0f766e' }}
                        >
                          {config.planos_popular || 'Mais Popular'}
                        </span>
                      </div>
                    )}
                    <CardHeader className="text-left pb-2 pt-8 sm:pt-10">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {plano.tagline}
                      </p>
                      <CardTitle className={`font-bold text-foreground ${isPro ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
                        {plano.nome}
                      </CardTitle>
                      <div className="pt-5 space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {periodoPreco === 'anual' ? 'Anual' : 'Mensal'}
                        </p>
                        <p className={`font-bold text-foreground ${isPro ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
                          {formatCurrency(valorExibir)}
                        </p>
                        {periodoPreco === 'anual' && economiaMensal > 0 && (
                          <p className="text-sm text-emerald-600 font-medium">
                            Economia de {formatCurrency(economiaMensal)}/mês
                          </p>
                        )}
                        {periodoPreco === 'anual' && plano.id === 'start' && (
                          <p className="text-xs text-muted-foreground">Equivale a 10 meses (2 grátis)</p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 pt-4 pb-6 sm:pb-8 space-y-5">
                      <ul className="space-y-3 text-sm flex-1">
                        {plano.limites.map((item, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">{item}</span>
                            </li>
                        ))}
                        <li className="flex items-start gap-3">
                          {plano.multiCampus ? (
                            <>
                              <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>Multi-campus</span>
                            </>
                          ) : (
                            <>
                              <span className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground/50">—</span>
                              <span className="text-muted-foreground">Single campus</span>
                            </>
                          )}
                        </li>
                      </ul>
                      
                      <div className="space-y-2 pt-2">
                        <Button 
                          className={`w-full min-h-[52px] touch-manipulation font-semibold text-base rounded-xl ${
                            plano.id === 'enterprise' ? 'bg-slate-800 hover:bg-slate-900' : ''
                          }`}
                          variant={isPro ? "default" : plano.id === 'enterprise' ? "default" : "outline"}
                          onClick={() => {
                            if (plano.id === 'enterprise') {
                              const wa = config.demo_whatsapp_url || config.whatsapp;
                              if (wa) {
                                const url = wa.startsWith('http') ? wa : `https://wa.me/${wa.replace(/\D/g, '')}`;
                                window.open(url, '_blank');
                              } else {
                                document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
                              }
                            } else {
                              document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          style={isPro ? { backgroundColor: themeColors.primary || '#0f766e' } : plano.id === 'enterprise' ? {} : { borderWidth: 2 }}
                        >
                          {plano.cta}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          {plano.microtexto}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Prova social */}
          <div className="mt-12 sm:mt-16 text-center">
            <p className="text-white/90 text-base sm:text-lg font-medium">
              {config.planos_prova_social || '+50 instituições já utilizam o DSICOLA'}
            </p>
            <p className="text-white/70 text-sm mt-1">
              {config.planos_prova_social_sub || 'Confiança de escolas e universidades em crescimento'}
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contato" className="py-12 sm:py-16 md:py-20 px-3 sm:px-4 overflow-hidden">
        <div className="container mx-auto max-w-full">
          <div className="max-w-2xl mx-auto w-full">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="nome_instituicao">Nome da Instituição *</Label>
                      <Input
                        id="nome_instituicao"
                        value={formData.nome_instituicao}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome_instituicao: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="nome_responsavel">Nome do Responsável *</Label>
                      <Input
                        id="nome_responsavel"
                        value={formData.nome_responsavel}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome_responsavel: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
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
                    <div className="min-w-0">
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
                    className="w-full min-h-[44px] touch-manipulation" 
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
      <footer className="border-t bg-muted/30 py-10 px-3 sm:px-4 mt-4 overflow-hidden" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
        <div className="container mx-auto max-w-full">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {config.logo_principal || config.logo_icone ? (
                <img 
                  src={config.logo_principal || config.logo_icone} 
                  alt="DSICOLA"
                  className="h-6 w-auto max-w-[100px] object-contain opacity-80"
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
