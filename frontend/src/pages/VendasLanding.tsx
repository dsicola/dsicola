import { useState, useEffect, useMemo, useRef } from "react";
import Hls from "hls.js";
import { useNavigate } from "react-router-dom";
import { configuracoesLandingApi, leadsApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { LANDING_FONT_FAMILY_MAP, LANDING_GOOGLE_FONTS, LANDING_ESCALA_BASE_PX, LANDING_TYPOGRAPHY_DEFAULTS } from "@/constants/landingTypography";

/** Player do vídeo de demonstração - suporta YouTube, Vimeo e Bunny (embed + b-cdn HLS) */
function DemoVideoPlayer({ url, buttonText }: { url: string; buttonText?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [hlsError, setHlsError] = useState(false);

  const { type, embedUrl } = useMemo(() => {
    const u = url.trim().toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) {
      const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      return { type: 'youtube' as const, embedUrl: m?.[1] ? `https://www.youtube.com/embed/${m[1]}` : url };
    }
    if (u.includes('vimeo.com')) {
      const m = url.match(/vimeo\.com\/(\d+)/);
      return { type: 'vimeo' as const, embedUrl: m?.[1] ? `https://player.vimeo.com/video/${m[1]}` : url };
    }
    if (u.includes('mediadelivery.net')) {
      let embed = url.startsWith('http') ? url : `https://${url.trim()}`;
      try {
        const parsed = new URL(embed);
        if (parsed.pathname.startsWith('/play/')) parsed.pathname = parsed.pathname.replace(/^\/play\//, '/embed/');
        parsed.searchParams.set('preload', 'true');
        parsed.searchParams.set('responsive', 'true');
        embed = parsed.toString();
      } catch { /* keep */ }
      return { type: 'bunny-iframe' as const, embedUrl: embed };
    }
    if (u.includes('b-cdn.net')) {
      const base = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
      const hlsUrl = /\.m3u8(\?|$)/i.test(base) ? base : `${base.replace(/\/?$/, '')}/playlist.m3u8`;
      return { type: 'bunny-hls' as const, embedUrl: hlsUrl };
    }
    return { type: 'link' as const, embedUrl: url };
  }, [url]);

  useEffect(() => {
    if (type !== 'bunny-hls' || !videoRef.current || !embedUrl) return;
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(embedUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal && data.type === Hls.ErrorTypes.NETWORK) setHlsError(true);
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    }
    if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = embedUrl;
    }
  }, [type, embedUrl]);

  if (type === 'youtube' || type === 'vimeo' || type === 'bunny-iframe') {
    return (
      <iframe
        src={embedUrl}
        title="Vídeo de Demonstração"
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="eager"
      />
    );
  }
  if (type === 'bunny-hls' && !hlsError) {
    return (
      <video ref={videoRef} controls className="absolute inset-0 w-full h-full" playsInline />
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors">
      <div className="text-center">
        <Video className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
        <span className="text-sm font-medium">{buttonText || 'Assistir Demonstração'}</span>
      </div>
    </a>
  );
}

export default function VendasLanding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [periodoPreco, setPeriodoPreco] = useState<'mensal' | 'anual'>('anual');
  const [tipoPrecoLanding, setTipoPrecoLanding] = useState<'superior' | 'secundario'>('superior');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nome_instituicao: '',
    nome_responsavel: '',
    email: '',
    telefone: '',
    cidade: '',
    mensagem: '',
    tipo_instituicao: 'superior',
  });

  // Dynamic theme colors - paleta profissional moderna (teal/slate)
  const themeColors = {
    primary: config.cor_primaria || '#0d9488',
    primaryHover: config.cor_primaria_hover || '#0f766e',
    secondary: config.cor_secundaria || '#0f172a',
    accent: config.cor_accent || '#0891b2',
    heroText: config.cor_texto_hero || '#0f172a',
    heroBg: config.cor_fundo_hero || '#f8fafc',
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
    } catch (err) {
      console.error('[VendasLanding] Erro ao processar planos da landing:', err);
    }
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

  // Tipografia (nível Horizon): fontes e escala
  const fonteTitulos = config.fonte_titulos || LANDING_TYPOGRAPHY_DEFAULTS.fonte_titulos;
  const fonteCorpo = config.fonte_corpo || LANDING_TYPOGRAPHY_DEFAULTS.fonte_corpo;
  const escalaTipografia = config.escala_tipografia || LANDING_TYPOGRAPHY_DEFAULTS.escala_tipografia;
  const landingFontHeadings = LANDING_FONT_FAMILY_MAP[fonteTitulos] || LANDING_FONT_FAMILY_MAP.outfit;
  const landingFontBody = LANDING_FONT_FAMILY_MAP[fonteCorpo] || LANDING_FONT_FAMILY_MAP.outfit;
  const landingBasePx = LANDING_ESCALA_BASE_PX[escalaTipografia] ?? 16;
  const estiloBotaoRaio = config.estilo_botao_raio || 'medio';
  const landingButtonRadius = estiloBotaoRaio === 'pequeno' ? '4px' : estiloBotaoRaio === 'grande' ? '9999px' : '8px';
  const animacoesAtivas = config.animacoes_ativas !== 'false';

  const heroLayout = (config as any).hero_layout === 'left' ? 'left' : 'center';
  const heroBackgroundImage = (config as any).hero_background_image || '';

  // Carregar Google Fonts quando necessário (para fontes não-system)
  useEffect(() => {
    const families: string[] = [];
    if (fonteTitulos !== 'system' && LANDING_GOOGLE_FONTS[fonteTitulos]) families.push(LANDING_GOOGLE_FONTS[fonteTitulos]);
    if (fonteCorpo !== 'system' && LANDING_GOOGLE_FONTS[fonteCorpo] && fonteCorpo !== fonteTitulos) families.push(LANDING_GOOGLE_FONTS[fonteCorpo]);
    if (families.length === 0) return;
    const existing = document.getElementById('landing-google-fonts');
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.id = 'landing-google-fonts';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${families.join('&family=')}&display=swap`;
    document.head.appendChild(link);
    return () => {
      document.getElementById('landing-google-fonts')?.remove();
    };
  }, [fonteTitulos, fonteCorpo]);

  useEffect(() => {
    document.documentElement.style.setProperty('--landing-font-headings', landingFontHeadings);
    document.documentElement.style.setProperty('--landing-font-body', landingFontBody);
    document.documentElement.style.setProperty('--landing-base-px', `${landingBasePx}px`);
    document.documentElement.style.setProperty('--landing-button-radius', landingButtonRadius);
    return () => {
      document.documentElement.style.removeProperty('--landing-font-headings');
      document.documentElement.style.removeProperty('--landing-font-body');
      document.documentElement.style.removeProperty('--landing-base-px');
      document.documentElement.style.removeProperty('--landing-button-radius');
    };
  }, [landingFontHeadings, landingFontBody, landingBasePx, landingButtonRadius]);

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
        tipoInstituicao: formData.tipo_instituicao === 'secundario' ? 'Ensino Secundário' : 'Ensino Superior',
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
        tipo_instituicao: 'superior',
      });
    } catch (error: any) {
      console.error("Error submitting lead:", error);
      toast({
        title: "Não foi possível enviar",
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

  /** Retorna preço mensal e anual do plano conforme tipo selecionado (Superior ou Secundário) */
  const getPrecosPorTipo = (plano: PlanoLanding) => {
    const isSuperior = tipoPrecoLanding === 'superior';
    const mensal = isSuperior
      ? (plano.precoMensalSuperior ?? plano.precoMensal)
      : (plano.precoMensalSecundario ?? plano.precoMensal);
    const anual = isSuperior
      ? (plano.precoAnualSuperior ?? plano.precoAnual)
      : (plano.precoAnualSecundario ?? plano.precoAnual);
    return { mensal, anual };
  };

  const features = [
    { icon: Users, title: config.feature_1_titulo || 'Gestão de Estudantes', description: config.feature_1_desc || 'Cadastro completo, matrículas, histórico acadêmico e documentação.' },
    { icon: GraduationCap, title: config.feature_2_titulo || 'Gestão de Professores', description: config.feature_2_desc || 'Atribuição de turmas, lançamento de notas e frequência.' },
    { icon: CreditCard, title: config.feature_3_titulo || 'Financeiro Completo', description: config.feature_3_desc || 'Mensalidades, recibos, multas automáticas e relatórios.' },
    { icon: BookOpen, title: config.feature_4_titulo || 'Acadêmico Integrado', description: config.feature_4_desc || 'Cursos, disciplinas, turmas, horários e exames.' },
    { icon: BarChart3, title: config.feature_5_titulo || 'Relatórios e Analytics', description: config.feature_5_desc || 'Dashboards com indicadores em tempo real.' },
    { icon: Shield, title: config.feature_6_titulo || 'Segurança e Privacidade', description: config.feature_6_desc || 'Dados isolados por instituição, backups automáticos.' },
  ];

  const benefitsConfig = [
    { icon: Globe, key: 'benefit_1', default: 'Acesso de qualquer lugar, 24/7' },
    { icon: Zap, key: 'benefit_2', default: 'Implementação rápida em 24h' },
    { icon: HeadphonesIcon, key: 'benefit_3', default: 'Suporte técnico dedicado' },
    { icon: Sparkles, key: 'benefit_4', default: 'Atualizações gratuitas' },
  ];

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
    <div
      className="min-h-screen bg-slate-50 w-full overflow-x-hidden"
      data-landing-root
      {...(animacoesAtivas ? { 'data-landing-animations': 'true' } : {})}
      style={{
        fontFamily: 'var(--landing-font-body)',
        fontSize: 'var(--landing-base-px)',
      }}
    >
      {/* Header - barra flutuante com glassmorphism */}
      <header 
        className="fixed left-4 right-4 sm:left-6 sm:right-6 lg:left-8 lg:right-8 z-50 rounded-2xl shadow-lg border border-slate-200/60"
        style={{ 
          top: 'max(1rem, env(safe-area-inset-top))',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config.logo_principal || config.logo_icone ? (
                <img 
                  src={config.logo_principal || config.logo_icone} 
                  alt="DSICOLA"
                  className="h-9 sm:h-10 w-auto max-w-[140px] sm:max-w-[180px] object-contain"
                />
              ) : (
                <>
                  <div 
                    className="h-10 w-10 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: themeColors.primary }}
                  >
                    <GraduationCap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">DSICOLA</h1>
                    <p className="text-xs text-slate-500 hidden sm:block">Sistema de Gestão Acadêmica</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium px-4 min-h-[40px]" 
                onClick={() => navigate('/auth')}
              >
                Login
              </Button>
              <Button 
                size="sm" 
                className="text-sm font-semibold px-5 min-h-[40px] shadow-md hover:shadow-lg transition-shadow text-white" 
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

      {/* Hero Section - visual profissional */}
      <section 
        className="pt-24 sm:pt-28 pb-16 sm:pb-20 md:pb-28 lg:pb-32 px-4 sm:px-6 relative overflow-hidden"
        style={{
          background: themeColors.useGradient
            ? `linear-gradient(160deg, ${themeColors.primary}08 0%, ${themeColors.heroBg} 40%, ${themeColors.heroBg} 100%)`
            : themeColors.heroBg
        }}
      >
        {/* Grid sutil de fundo */}
        <div className="absolute inset-0 opacity-[0.4] pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }} />
        </div>

        {heroBackgroundImage && (
          <div className="absolute inset-0 -z-10">
            <img
              src={heroBackgroundImage}
              alt=""
              className="w-full h-full object-cover opacity-40"
              loading="lazy"
            />
          </div>
        )}

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-20" 
            style={{ backgroundColor: themeColors.primary }}
          />
          <div 
            className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-20" 
            style={{ backgroundColor: themeColors.accent }}
          />
        </div>
        
        <div className="container mx-auto relative max-w-6xl">
          <div
            className={`max-w-4xl mx-auto ${
              heroLayout === 'left' ? 'text-left items-start' : 'text-center items-center'
            } flex flex-col`}
          >
            <Badge 
              className="mb-4 sm:mb-6 px-4 py-1.5 text-xs font-medium rounded-full border-0" 
              style={{ 
                backgroundColor: `${themeColors.primary}20`,
                color: themeColors.primary
              }}
            >
              {config.hero_badge || 'Plataforma DSICOLA Multi-Tenant'}
            </Badge>
            <h1 
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-5 sm:mb-6 leading-[1.1] tracking-tight text-slate-900"
            >
              {config.hero_titulo || 'Sistema de Gestão Acadêmica Completo'}
            </h1>
            <p 
              className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed text-slate-600"
            >
              {config.hero_subtitulo || 'Modernize a gestão da sua instituição de ensino com uma plataforma completa, segura e fácil de usar.'}{' '}
              <span className="font-semibold text-slate-800">Tudo em um só lugar.</span>
            </p>
            <div
              className={`flex flex-col sm:flex-row gap-3 sm:gap-4 ${
                heroLayout === 'left' ? 'justify-start' : 'justify-center'
              }`}
            >
              <Button 
                size="lg" 
                className="text-sm sm:text-base px-6 sm:px-8 py-6 shadow-lg transition-all w-full sm:w-auto min-h-[48px] font-semibold rounded-xl landing-cta-glow" 
                onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ backgroundColor: themeColors.primary, color: '#fff' }}
              >
                {config.hero_cta_primario || 'Ver Planos e Preços'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-sm sm:text-base px-6 sm:px-8 py-6 w-full sm:w-auto min-h-[48px] font-semibold rounded-xl border-2 bg-white/80 hover:bg-white" 
                onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ borderColor: themeColors.primary, color: themeColors.primary }}
              >
                {config.hero_cta_secundario || 'Agendar Demonstração'}
              </Button>
            </div>
            
            <div className="mt-10 sm:mt-14 flex flex-wrap justify-center gap-6 sm:gap-8 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: themeColors.primary }} />
                <span>{config.trust_1 || 'Dados 100% seguros'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" style={{ color: themeColors.primary }} />
                <span>{config.trust_2 || config.periodo_teste_texto || '2 meses de teste grátis'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" style={{ color: themeColors.primary }} />
                <span>{config.trust_3 || 'Sem cartão de crédito'}</span>
              </div>
            </div>
            {config.urgencia_visivel !== 'false' && (config.urgencia_texto || '').trim() && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30 animate-pulse-subtle">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">{config.urgencia_texto || 'Oferta válida este mês. Vagas limitadas.'}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Banner Período de Teste - em destaque, editável */}
      {config.trial_visivel !== 'false' && (
        <section 
          className="py-8 sm:py-10 px-4 sm:px-6 overflow-hidden relative"
          style={{ backgroundColor: themeColors.primary }}
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, white 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }} />
          </div>
          <div className="container mx-auto max-w-4xl text-center relative">
            <p 
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-3 drop-shadow-sm"
            >
              {config.periodo_teste_texto || '2 meses de teste grátis'}
            </p>
            <p className="text-white/90 text-base sm:text-lg md:text-xl max-w-2xl mx-auto">
              {config.trial_subtitulo || 'Experimente sem compromisso. Cancele quando quiser.'}
            </p>
          </div>
        </section>
      )}

      {/* Benefits Bar - profissional */}
      <section 
        className="py-5 sm:py-6 overflow-hidden border-y border-slate-200/60"
        style={{ backgroundColor: themeColors.primary, color: '#fff' }}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-4 sm:gap-10">
            {benefitsConfig.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2">
                <benefit.icon className="h-5 w-5 shrink-0 opacity-90" />
                <span className="text-xs sm:text-sm font-medium">{config[benefit.key] || benefit.default}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 overflow-hidden bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              {config.features_titulo || 'Tudo que sua instituição precisa'}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {config.features_subtitulo || 'Uma plataforma completa que digitaliza e automatiza todos os processos acadêmicos e administrativos da sua instituição.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80 hover:-translate-y-1 transition-all duration-200 rounded-xl overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div 
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${themeColors.primary}15` }}
                    >
                      <feature.icon className="h-6 w-6" style={{ color: themeColors.primary }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold mb-2 text-slate-900">{feature.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="demo-video" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 overflow-hidden bg-slate-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center w-full">
            <p className="text-base sm:text-lg md:text-xl mb-8 text-slate-600 leading-relaxed">
              {config.demo_video_texto || 'Assista ao vídeo e descubra como sua instituição pode ser totalmente organizada em poucos dias'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 w-full">
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
                <div id="embed-demo-video" className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-slate-100">
                  <DemoVideoPlayer url={config.demo_video_url} buttonText={config.demo_video_botao} />
                </div>
              )}
            </div>
          </div>
        </section>

      {/* Pricing Section */}
      <section 
        id="planos" 
        className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 overflow-hidden"
        style={{ backgroundColor: themeColors.primary }}
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
                  style={periodoPreco === 'anual' ? { color: themeColors.primary } : {}}
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
                  style={periodoPreco === 'mensal' ? { color: themeColors.primary } : {}}
                >
                  Mensal
                </button>
              </div>
              {periodoPreco === 'anual' && (() => {
                const planoPopular = planosExibidos.find(p => p.popular) ?? planosExibidos[1];
                const { mensal, anual } = planoPopular ? getPrecosPorTipo(planoPopular) : { mensal: 0, anual: 0 };
                const economiaAnual = mensal * 12 - anual;
                if (economiaAnual <= 0) return null;
                return (
                  <p className="text-white/90 text-sm font-medium">
                    Economize até <strong>{formatCurrency(economiaAnual)}/ano</strong> no plano {planoPopular.nome}
                  </p>
                );
              })()}
            </div>

            <p className="text-white/80 text-sm mt-4">
              🎁 {config.planos_badge || (config.periodo_teste_texto ? `${config.periodo_teste_texto} em todos os planos` : '2 meses de teste grátis em todos os planos')}
            </p>

            {/* Seletor de tipo de instituição para preços */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-white/70 text-sm">Preços para:</span>
              <div className="flex rounded-full bg-white/10 p-0.5">
                <button
                  type="button"
                  onClick={() => setTipoPrecoLanding('superior')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    tipoPrecoLanding === 'superior' ? 'bg-white shadow' : 'text-white/80 hover:text-white'
                  }`}
                  style={tipoPrecoLanding === 'superior' ? { color: themeColors.primary } : {}}
                >
                  Ensino Superior
                </button>
                <button
                  type="button"
                  onClick={() => setTipoPrecoLanding('secundario')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    tipoPrecoLanding === 'secundario' ? 'bg-white shadow' : 'text-white/80 hover:text-white'
                  }`}
                  style={tipoPrecoLanding === 'secundario' ? { color: themeColors.primary } : {}}
                >
                  Ensino Secundário
                </button>
              </div>
            </div>
          </div>

          {/* Cards - PRO centralizado e destacado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-stretch">
            {planosExibidos.map((plano) => {
              const { mensal, anual } = getPrecosPorTipo(plano);
              const valorExibir = periodoPreco === 'anual' ? anual : mensal;
              const economiaMensal = periodoPreco === 'anual' 
                ? Math.round((mensal * 12 - anual) / 12) 
                : 0;
              const isPro = plano.popular;
              
              return (
                <div 
                  key={plano.id}
                  className={`flex flex-col ${isPro ? 'order-first md:order-none' : ''}`}
                >
                  <Card 
                    className={`relative min-w-0 flex flex-col h-full overflow-hidden transition-all ${
                      isPro 
                        ? 'bg-white rounded-2xl shadow-xl border-2' 
                        : 'bg-white/95 backdrop-blur rounded-xl shadow-lg border border-border/50'
                    }`}
                    style={isPro ? { borderColor: themeColors.primary, boxShadow: `0 20px 40px -12px rgba(0,0,0,0.12), 0 0 0 1px ${themeColors.primary}20` } : undefined}
                  >
                    {isPro && (
                      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: themeColors.primary }} />
                    )}
                    <CardHeader className="text-left pb-2 pt-6 sm:pt-8">
                      {isPro && (
                        <span 
                          className="inline-flex items-center w-fit px-3 py-1 text-xs font-semibold text-white rounded-lg mb-3"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          {config.planos_popular || 'Mais Popular'}
                        </span>
                      )}
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
                        {plano.limites.filter((item) => item != null && String(item).trim() !== '').map((item, i) => (
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
                          style={isPro ? { backgroundColor: themeColors.primary } : plano.id === 'enterprise' ? {} : { borderWidth: 2 }}
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

          {/* Prova social - editável: habilitar/desabilitar */}
          {config.prova_social_visivel !== 'false' && (
            <div className="mt-12 sm:mt-16 text-center">
              {(config.planos_prova_logos || '')
                .split(/[\n,]/)
                .map((url) => url.trim())
                .filter(Boolean)
                .length > 0 && (
                <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 mb-8 opacity-90">
                  {(config.planos_prova_logos || '')
                    .split(/[\n,]/)
                    .map((url) => url.trim())
                    .filter(Boolean)
                    .map((logoUrl, i) => (
                      <img
                        key={i}
                        src={logoUrl}
                        alt={`Cliente ${i + 1}`}
                        className="h-8 sm:h-10 w-auto object-contain grayscale brightness-0 invert opacity-90 hover:opacity-100 transition-opacity"
                      />
                    ))}
                </div>
              )}
              <p className="text-white/90 text-base sm:text-lg font-medium">
                {config.planos_prova_social || '+50 instituições já utilizam o DSICOLA'}
              </p>
              <p className="text-white/70 text-sm mt-1">
                {config.planos_prova_social_sub || 'Confiança de escolas e universidades em crescimento'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Depoimentos */}
      {config.depoimentos_visivel !== 'false' && (
        <section className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 overflow-hidden bg-slate-50">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 text-center mb-12 tracking-tight">
              {config.depoimentos_titulo || 'O que dizem os nossos clientes'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {[
                { texto: config.depoimento_1_texto, nome: config.depoimento_1_nome, cargo: config.depoimento_1_cargo },
                { texto: config.depoimento_2_texto, nome: config.depoimento_2_nome, cargo: config.depoimento_2_cargo },
                { texto: config.depoimento_3_texto, nome: config.depoimento_3_nome, cargo: config.depoimento_3_cargo },
              ].filter((d) => (d.texto || '').trim()).map((dep, i) => (
                <Card key={i} className="border border-slate-200/80 shadow-sm landing-card-hover rounded-xl overflow-hidden bg-white p-6">
                  <p className="text-slate-600 leading-relaxed mb-4 italic">&ldquo;{dep.texto}&rdquo;</p>
                  <div>
                    <p className="font-semibold text-slate-900">{dep.nome || 'Cliente'}</p>
                    <p className="text-sm text-slate-500">{dep.cargo || ''}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ / Objeções */}
      {config.faq_visivel !== 'false' && (
        <section className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 overflow-hidden bg-white">
          <div className="container mx-auto max-w-3xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 text-center mb-12 tracking-tight">
              {config.faq_titulo || 'Perguntas Frequentes'}
            </h2>
            <div className="space-y-4">
              {[
                {
                  p: config.faq_1_pergunta || 'Preciso de cartão de crédito para começar?',
                  r: config.faq_1_resposta || 'Não. Pode experimentar a plataforma completa durante o período de teste sem fornecer dados de pagamento. Só pedimos informações de cartão quando decidir continuar após o teste.',
                },
                {
                  p: config.faq_2_pergunta || 'Posso cancelar quando quiser?',
                  r: config.faq_2_resposta || 'Sim. Não há fidelidade nem multas. Cancele a qualquer momento pelo painel ou entre em contato connosco. Os seus dados ficam disponíveis para exportação.',
                },
                {
                  p: config.faq_3_pergunta || 'Os meus dados estão seguros?',
                  r: config.faq_3_resposta || 'Sim. Cada instituição tem os dados isolados (multi-tenant). Fazemos backups automáticos diários, servidores em ambiente seguro e cumprimos as melhores práticas de privacidade e proteção de dados.',
                },
                {
                  p: config.faq_4_pergunta || 'Quanto tempo leva a implementação?',
                  r: config.faq_4_resposta || 'Em média 24 a 48 horas. A nossa equipe acompanha todo o processo: configuração inicial, importação de dados e formação da sua equipa. A maioria das instituições está operacional no primeiro dia.',
                },
                {
                  p: config.faq_5_pergunta || 'O suporte está incluído?',
                  r: config.faq_5_resposta || 'Sim. Todos os planos incluem suporte técnico por email e WhatsApp. Respondemos em até 24 horas úteis. Planos superiores podem ter prioridade e acompanhamento dedicado.',
                },
              ].filter((f) => (f.p || '').trim()).map((faq, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 landing-card-hover">
                  <p className="font-semibold text-slate-900 mb-2">{faq.p}</p>
                  <p className="text-slate-600 text-sm leading-relaxed">{faq.r}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Section */}
      <section id="contato" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 overflow-hidden bg-white">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-10">
            <Badge 
              className="mb-4 px-4 py-1.5 text-xs font-medium rounded-full" 
              style={{ backgroundColor: `${themeColors.primary}15`, color: themeColors.primary }}
            >
              <MessageCircle className="h-3 w-3 mr-1.5 inline" />
              {config.contato_badge || 'Formulário de Contato'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              {config.contato_titulo || 'Solicite uma Demonstração'}
            </h2>
            <p className="text-slate-600 max-w-lg mx-auto">
              {config.contato_subtitulo || 'Preencha o formulário abaixo e nossa equipe entrará em contato em até 24 horas úteis.'}
            </p>
          </div>

          <Card className="border border-slate-200 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="nome_instituicao">Nome da Instituição *</Label>
                      <Input
                        id="nome_instituicao"
                        value={formData.nome_instituicao}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome_instituicao: e.target.value }))}
                        placeholder="Nome"
                        required
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="nome_responsavel">Nome do Responsável *</Label>
                      <Input
                        id="nome_responsavel"
                        value={formData.nome_responsavel}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome_responsavel: e.target.value }))}
                        placeholder="Nome"
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
                          placeholder="Email"
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
                          placeholder="Telefone"
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
                      placeholder="Cidade"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="tipo_instituicao">Tipo de Instituição *</Label>
                    <Select
                      value={formData.tipo_instituicao}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, tipo_instituicao: v }))}
                    >
                      <SelectTrigger id="tipo_instituicao">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="superior">Ensino Superior</SelectItem>
                        <SelectItem value="secundario">Ensino Secundário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="mensagem">Mensagem</Label>
                    <Textarea
                      id="mensagem"
                      value={formData.mensagem}
                      onChange={(e) => setFormData(prev => ({ ...prev, mensagem: e.target.value }))}
                      placeholder="Mensagem"
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
      </section>

      {/* Footer */}
      <footer 
        className="border-t border-slate-200 py-10 px-4 sm:px-6 overflow-hidden bg-slate-50" 
        style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {config.logo_principal || config.logo_icone ? (
                <img 
                  src={config.logo_principal || config.logo_icone} 
                  alt="DSICOLA"
                  className="h-7 w-auto max-w-[120px] object-contain opacity-90"
                />
              ) : (
                <GraduationCap className="h-6 w-6 text-slate-500" />
              )}
              <span className="font-semibold text-slate-700">DSICOLA</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <button 
                onClick={() => navigate('/auth')} 
                className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
              >
                Acesso ao Sistema
              </button>
              <a 
                href={`mailto:${config.contato_email || 'contato@dsicola.com'}`}
                className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
              >
                Contato
              </a>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 mt-6 pt-6 border-t border-slate-200">
            © {new Date().getFullYear()} DSICOLA. {config.rodape_creditos || 'Sistema de Gestão Acadêmica. Todos os direitos reservados.'}
          </p>
        </div>
      </footer>

      {/* Botão WhatsApp flutuante */}
      {config.whatsapp_flutuante_visivel !== 'false' && getWhatsAppUrl(config.demo_whatsapp_url || config.contato_whatsapp) && (
        <a
          href={getWhatsAppUrl(config.demo_whatsapp_url || config.contato_whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 hover:shadow-xl landing-float-whatsapp"
          style={{ 
            backgroundColor: '#25D366',
            bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
            right: 'max(1.5rem, env(safe-area-inset-right))',
          }}
          aria-label="Fale conosco no WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  );
}
