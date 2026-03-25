import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { instituicoesApi } from '@/services/api';
import { parseLandingPublico } from '@/types/landingPublico';
import { TenantAuthDialog } from '@/components/institucional/TenantAuthDialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  GraduationCap,
  School,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Linkedin,
  Youtube,
  MessageCircle,
  ExternalLink,
  Images,
  BookOpen,
  ChevronRight,
  Menu,
  Globe,
  Share2,
} from 'lucide-react';
import { getPlatformBaseDomain } from '@/utils/platformDomain';
import { cn } from '@/lib/utils';

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 7.378a4.606 4.606 0 1 0 0 9.212 4.606 4.606 0 0 0 0-9.212zm0 7.595a2.989 2.989 0 1 1 0-5.978 2.989 2.989 0 0 1 0 5.978zm6.406-7.844a1.077 1.077 0 1 1-2.154 0 1.077 1.077 0 0 1 2.154 0z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M14.23 2H17.5l5.88 8.27L24 2h-3.23l-3.8 5.39L13.17 2h-3.05zm1.75 12.92L7.95 2H2.23l9.56 13.67l-5.89 7.08h3.1l4.85-5.83l4.88 5.83h5.79L16.02 14.92z" />
    </svg>
  );
}

function SectionEyebrow({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="h-px w-8 sm:w-12 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
  );
}

export default function InstituicaoInstitutionalLanding() {
  const { instituicao, configuracao } = useTenant();
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const platformBase = getPlatformBaseDomain();

  const landing = useMemo(
    () => parseLandingPublico(configuracao?.landingPublico ?? (configuracao as { landing_publico?: unknown })?.landing_publico),
    [configuracao]
  );

  const displayName =
    configuracao?.nome_instituicao ||
    (configuracao as { nomeInstituicao?: string })?.nomeInstituicao ||
    instituicao?.nome ||
    'Instituição';

  const logoUrl =
    configuracao?.logo_url ||
    configuracao?.logoUrl ||
    instituicao?.logo_url ||
    instituicao?.logoUrl;

  const corPrimaria =
    configuracao?.cor_primaria || (configuracao as { corPrimaria?: string })?.corPrimaria || '#1d4ed8';
  const corSecundaria =
    configuracao?.cor_secundaria || (configuracao as { corSecundaria?: string })?.corSecundaria || '#0f172a';
  const corTerciaria =
    configuracao?.cor_terciaria || (configuracao as { corTerciaria?: string })?.corTerciaria || null;

  const tipoAcademico = instituicao?.tipoAcademico;
  const isSuperior = tipoAcademico === 'SUPERIOR';
  const ofertaLabel = isSuperior ? 'Cursos' : 'Classes';
  const ofertaSectionTitle = isSuperior ? 'Oferta formativa' : 'Anos / classes';
  const ofertaLead = isSuperior
    ? 'Conheça os cursos disponíveis na nossa instituição.'
    : 'Conheça as classes e percursos do ensino secundário.';

  const { data: opcoesData, isPending: opcoesPending } = useQuery({
    queryKey: ['landing-opcoes-inscricao', instituicao?.subdominio],
    queryFn: async () => {
      if (!instituicao?.subdominio) return null;
      return instituicoesApi.getOpcoesInscricao(instituicao.subdominio);
    },
    enabled: !!instituicao?.subdominio && landing.showAcademicOffer !== false,
  });

  const email =
    instituicao?.emailContato || instituicao?.email_contato || configuracao?.email || null;
  const telefone = instituicao?.telefone || configuracao?.telefone || null;
  const endereco = instituicao?.endereco || configuracao?.endereco || null;

  const heroTitle = landing.heroTitle?.trim() || displayName;
  const heroSubtitle =
    landing.heroSubtitle?.trim() ||
    (isSuperior
      ? 'Formação de excelência com acompanhamento académico próximo.'
      : 'Educar com rigor, proximidade e valores para o futuro dos nossos estudantes.');

  const heroBadgeLine =
    landing.heroBadge?.trim() || (isSuperior ? 'Ensino superior' : 'Ensino secundário');

  const aboutTitle = landing.aboutTitle?.trim() || 'Quem somos';
  const aboutBody =
    landing.aboutText?.trim() ||
    configuracao?.descricao?.trim() ||
    'Somos uma instituição de ensino comprometida com a qualidade pedagógica e com o sucesso dos nossos estudantes.';

  const portalUrl = instituicao?.dominioCustomizado
    ? `https://${instituicao.dominioCustomizado}`
    : `https://${instituicao?.subdominio}.${platformBase}`;

  const pageWashStyle: CSSProperties = corTerciaria
    ? {
        background: `linear-gradient(180deg, color-mix(in srgb, ${corTerciaria} 42%, white) 0%, rgb(248 250 252) 38%, rgb(241 245 249) 100%)`,
      }
    : { background: 'linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 55%, rgb(248 250 252) 100%)' };

  const NavTextClass = cn(
    'text-sm font-medium text-slate-600 transition-colors',
    'hover:text-slate-900 underline-offset-4 decoration-2 hover:underline'
  );

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileNavOpen(false);
  };

  const showOfertaNav = landing.showAcademicOffer !== false;
  const showGaleriaNav = landing.galleryUrls.length > 0;

  return (
    <div
      className="min-h-screen text-slate-900 antialiased selection:bg-slate-900/10"
      style={
        {
          ...pageWashStyle,
          '--inst-primary': corPrimaria,
          '--inst-secondary': corSecundaria,
        } as CSSProperties
      }
      data-dsicola
    >
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/65 shadow-[0_1px_0_rgba(15,23,42,0.05)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <a href="#inicio" className="flex items-center gap-3 min-w-0 group" onClick={() => scrollTo('inicio')}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={displayName}
                className="h-9 sm:h-10 w-auto max-w-[140px] sm:max-w-[180px] object-contain object-left shrink-0"
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white shrink-0 shadow-sm"
                style={{ backgroundColor: corPrimaria }}
              >
                {isSuperior ? <GraduationCap className="h-5 w-5" /> : <School className="h-5 w-5" />}
              </div>
            )}
            <span className="truncate font-semibold text-slate-900 tracking-tight">{displayName}</span>
          </a>

          <nav className="hidden md:flex items-center gap-7" aria-label="Secções">
            <button type="button" onClick={() => scrollTo('sobre')} className={NavTextClass} style={{ textDecorationColor: corPrimaria }}>
              Sobre
            </button>
            {showOfertaNav ? (
              <button type="button" onClick={() => scrollTo('oferta')} className={NavTextClass} style={{ textDecorationColor: corPrimaria }}>
                {ofertaLabel}
              </button>
            ) : null}
            {showGaleriaNav ? (
              <button type="button" onClick={() => scrollTo('galeria')} className={NavTextClass} style={{ textDecorationColor: corPrimaria }}>
                Galeria
              </button>
            ) : null}
            <button type="button" onClick={() => scrollTo('contacto')} className={NavTextClass} style={{ textDecorationColor: corPrimaria }}>
              Contacto
            </button>
            <Link
              to="/comunidade"
              target="_blank"
              rel="noopener noreferrer"
              title="Descoberta: instituições e cursos (público)"
              className={cn(NavTextClass, 'inline-flex items-center gap-1.5')}
              style={{ textDecorationColor: corPrimaria }}
            >
              <Globe className="h-3.5 w-3.5 opacity-80" aria-hidden />
              Comunidade
            </Link>
            <Link
              to="/social"
              target="_blank"
              rel="noopener noreferrer"
              title="Área Social do painel (requer sessão)"
              className={cn(NavTextClass, 'inline-flex items-center gap-1.5')}
              style={{ textDecorationColor: corPrimaria }}
            >
              <Share2 className="h-3.5 w-3.5 opacity-80" aria-hidden />
              Social
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-slate-700 hover:bg-slate-100 hidden sm:inline-flex"
            >
              <Link to="/inscricao">Candidaturas</Link>
            </Button>
            <Button
              size="sm"
              className="rounded-full px-5 font-semibold shadow-md text-white border-0 hidden sm:inline-flex"
              style={{ backgroundColor: corPrimaria }}
              onClick={() => setAuthOpen(true)}
            >
              Entrar
            </Button>

            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden border-slate-200" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100vw,320px)]" data-dsicola>
                <SheetHeader>
                  <SheetTitle className="text-left">{displayName}</SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-1" aria-label="Menu">
                  <Button variant="ghost" className="justify-start h-11" onClick={() => scrollTo('sobre')}>
                    Sobre
                  </Button>
                  {showOfertaNav ? (
                    <Button variant="ghost" className="justify-start h-11" onClick={() => scrollTo('oferta')}>
                      {ofertaLabel}
                    </Button>
                  ) : null}
                  {showGaleriaNav ? (
                    <Button variant="ghost" className="justify-start h-11" onClick={() => scrollTo('galeria')}>
                      Galeria
                    </Button>
                  ) : null}
                  <Button variant="ghost" className="justify-start h-11" onClick={() => scrollTo('contacto')}>
                    Contacto
                  </Button>
                  <Button variant="ghost" className="justify-start h-11 gap-2" asChild>
                    <Link to="/comunidade" target="_blank" rel="noopener noreferrer" onClick={() => setMobileNavOpen(false)}>
                      <Globe className="h-4 w-4" aria-hidden />
                      Comunidade (descoberta)
                    </Link>
                  </Button>
                  <Button variant="ghost" className="justify-start h-11 gap-2" asChild>
                    <Link to="/social" target="_blank" rel="noopener noreferrer" onClick={() => setMobileNavOpen(false)}>
                      <Share2 className="h-4 w-4" aria-hidden />
                      Social (painel)
                    </Link>
                  </Button>
                  <hr className="my-3 border-slate-200" />
                  <Button variant="outline" className="justify-start h-11" asChild>
                    <Link to="/inscricao" onClick={() => setMobileNavOpen(false)}>
                      Candidaturas
                    </Link>
                  </Button>
                  <Button
                    className="justify-start h-11 text-white border-0"
                    style={{ backgroundColor: corPrimaria }}
                    onClick={() => {
                      setMobileNavOpen(false);
                      setAuthOpen(true);
                    }}
                  >
                    Entrar na plataforma
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            <Button
              size="sm"
              className="rounded-full px-4 font-semibold shadow-md text-white border-0 sm:hidden"
              style={{ backgroundColor: corPrimaria }}
              onClick={() => setAuthOpen(true)}
            >
              Entrar
            </Button>
          </div>
        </div>
      </header>

      <main id="conteudo-institucional" data-testid="institutional-landing">
      <section id="inicio" className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 motion-safe:transition-transform duration-[20s] hover:scale-100"
          style={
            landing.heroImageUrl
              ? { backgroundImage: `url(${landing.heroImageUrl})` }
              : {
                  background: `linear-gradient(135deg, ${corSecundaria} 0%, color-mix(in srgb, ${corPrimaria} 72%, ${corSecundaria}) 55%, ${corSecundaria} 100%)`,
                }
          }
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/75 via-slate-950/55 to-slate-950/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12)_0%,_transparent_50%)] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-36">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-white/85 mb-5 max-w-3xl">
            {heroBadgeLine}
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-white tracking-tight max-w-3xl leading-[1.08] [text-wrap:balance]">
            {heroTitle}
          </h1>
          <p className="mt-7 text-lg sm:text-xl text-white/88 max-w-2xl leading-relaxed">
            {heroSubtitle}
          </p>
          <div className="mt-11 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="rounded-full px-8 font-semibold text-white border-0 shadow-lg shadow-black/25 h-12"
              style={{ backgroundColor: corPrimaria }}
              onClick={() => setAuthOpen(true)}
            >
              Aceder à plataforma
              <ChevronRight className="ml-2 h-4 w-4 opacity-90" />
            </Button>
            <Button size="lg" className="rounded-full px-8 font-semibold h-12 bg-white text-slate-900 hover:bg-white/95 shadow-lg border-0" asChild>
              <Link to="/inscricao">Candidatar-se</Link>
            </Button>
            {landing.secondaryCtaLabel && landing.secondaryCtaUrl ? (
              landing.secondaryCtaUrl.startsWith('/') ? (
                <Button size="lg" variant="outline" className="rounded-full h-12 border-white/50 text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm" asChild>
                  <Link to={landing.secondaryCtaUrl}>{landing.secondaryCtaLabel}</Link>
                </Button>
              ) : (
                <Button size="lg" variant="outline" className="rounded-full h-12 border-white/50 text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm" asChild>
                  <a href={landing.secondaryCtaUrl} target="_blank" rel="noopener noreferrer">
                    {landing.secondaryCtaLabel}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )
            ) : null}
          </div>
        </div>

        <div
          className="relative h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent"
          aria-hidden
        />
        <div
          className="relative h-16 bg-gradient-to-b from-transparent to-[rgb(248_250_252)] -mb-px"
          aria-hidden
        />
      </section>

      <section id="sobre" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-start">
          <div>
            <SectionEyebrow label="Instituição" accent={corPrimaria} />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              {aboutTitle}
            </h2>
            <div className="mt-5 h-1 w-14 rounded-full" style={{ backgroundColor: corPrimaria }} />
            <div className="mt-8 text-base sm:text-lg text-slate-600 leading-relaxed whitespace-pre-line space-y-4">
              {aboutBody}
            </div>
          </div>
          <div
            className="rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-9 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 pl-7 sm:pl-8 relative overflow-hidden"
            style={{ borderLeftWidth: 4, borderLeftColor: corPrimaria }}
          >
            <h3 className="text-lg font-semibold text-slate-900">Contactos</h3>
            <p className="text-sm text-slate-500 mt-1">Fale connosco pelos canais oficiais.</p>
            <ul className="mt-7 space-y-4 text-sm text-slate-600">
              {email ? (
                <li className="flex gap-3 items-start">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-0.5">Email</p>
                    <a href={`mailto:${email}`} className="font-medium hover:underline" style={{ color: corPrimaria }}>
                      {email}
                    </a>
                  </div>
                </li>
              ) : null}
              {telefone ? (
                <li className="flex gap-3 items-start">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Phone className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-0.5">Telefone</p>
                    <span className="font-medium text-slate-800">{telefone}</span>
                  </div>
                </li>
              ) : null}
              {landing.whatsappDigits ? (
                <li className="flex gap-3 items-start">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-0.5">WhatsApp</p>
                    <a
                      href={`https://wa.me/${landing.whatsappDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                      style={{ color: corPrimaria }}
                    >
                      Conversar no WhatsApp
                    </a>
                  </div>
                </li>
              ) : null}
              {endereco ? (
                <li className="flex gap-3 items-start">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-0.5">Morada</p>
                    <span className="text-slate-700">{endereco}</span>
                  </div>
                </li>
              ) : null}
            </ul>
            {(landing.instagramUrl ||
              landing.facebookUrl ||
              landing.youtubeUrl ||
              landing.linkedinUrl ||
              landing.twitterUrl ||
              landing.tiktokUrl) && (
              <div className="mt-8 pt-7 border-t border-slate-100">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-4">Redes sociais</p>
                <div className="flex flex-wrap gap-2.5">
                  {landing.facebookUrl ? (
                    <a
                      href={landing.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 transition-all hover:scale-105 hover:shadow-md hover:ring-2 hover:ring-offset-1"
                      aria-label="Facebook"
                    >
                      <Facebook className="h-5 w-5" />
                    </a>
                  ) : null}
                  {landing.instagramUrl ? (
                    <a
                      href={landing.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 transition-all hover:scale-105 hover:shadow-md"
                      aria-label="Instagram"
                    >
                      <InstagramGlyph className="h-5 w-5" />
                    </a>
                  ) : null}
                  {landing.youtubeUrl ? (
                    <a
                      href={landing.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 transition-all hover:scale-105 hover:shadow-md"
                      aria-label="YouTube"
                    >
                      <Youtube className="h-5 w-5" />
                    </a>
                  ) : null}
                  {landing.linkedinUrl ? (
                    <a
                      href={landing.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 transition-all hover:scale-105 hover:shadow-md"
                      aria-label="LinkedIn"
                    >
                      <Linkedin className="h-5 w-5" />
                    </a>
                  ) : null}
                  {landing.twitterUrl ? (
                    <a
                      href={landing.twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 transition-all hover:scale-105 hover:shadow-md"
                      aria-label="X"
                    >
                      <XIcon className="h-4 w-4" />
                    </a>
                  ) : null}
                  {landing.tiktokUrl ? (
                    <a
                      href={landing.tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80 transition-all hover:scale-[1.02]"
                    >
                      TikTok
                    </a>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {landing.showAcademicOffer !== false ? (
        <section id="oferta" className="border-y border-slate-200/90 bg-white/90 backdrop-blur-sm scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionEyebrow label={isSuperior ? 'Ensino superior' : 'Ensino secundário'} accent={corPrimaria} />
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-11">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  {ofertaSectionTitle}
                </h2>
                <p className="mt-3 text-slate-600 max-w-xl text-base leading-relaxed">{ofertaLead}</p>
              </div>
              <Button variant="outline" className="rounded-full shrink-0 border-slate-200 h-11" asChild>
                <Link to="/inscricao">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Ver candidaturas
                </Link>
              </Button>
            </div>
            {opcoesPending ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3" aria-busy="true">
                <div
                  className="h-10 w-10 rounded-full border-2 border-slate-200 animate-spin"
                  style={{ borderTopColor: corPrimaria }}
                />
                <p className="text-sm font-medium">A carregar {ofertaLabel.toLowerCase()}…</p>
              </div>
            ) : opcoesData?.opcoes?.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {opcoesData.opcoes.slice(0, 12).map((op) => (
                  <div
                    key={op.id}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 px-4 py-4 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:shadow-md"
                  >
                    <div className="min-w-0 flex items-start gap-3">
                      <span
                        className="mt-1 flex h-2 w-2 shrink-0 rounded-full opacity-80 group-hover:opacity-100"
                        style={{ backgroundColor: corPrimaria }}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{op.nome}</p>
                        {op.codigo ? <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{op.codigo}</p> : null}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                <p className="text-slate-600 font-medium">
                  A lista de {ofertaLabel.toLowerCase()} será divulgada em breve. Consulte as candidaturas.
                </p>
                <Button className="mt-6 rounded-full text-white border-0" style={{ backgroundColor: corPrimaria }} asChild>
                  <Link to="/inscricao">Ir para candidaturas</Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {landing.galleryUrls.length > 0 ? (
        <section id="galeria" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionEyebrow label="Ambiente" accent={corPrimaria} />
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
                <Images className="h-6 w-6 text-slate-500" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Galeria</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
            {landing.galleryUrls.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200/80 shadow-sm group"
              >
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {landing.mapEmbedUrl ? (
        <section className="bg-white/70 border-t border-slate-200/90">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <SectionEyebrow label="Localização" accent={corPrimaria} />
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6">Como chegar</h2>
            <div className="aspect-[21/9] min-h-[240px] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] ring-1 ring-slate-100">
              <iframe
                title="Mapa"
                src={landing.mapEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      ) : null}

      </main>

      <footer id="contacto" className="border-t border-slate-200 bg-white scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 flex flex-col sm:flex-row gap-8 sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            <p className="font-bold text-slate-900 text-base">{displayName}</p>
            <p className="mt-2 text-slate-500">
              Portal oficial:{' '}
              <span className="font-mono text-xs text-slate-600 break-all">{portalUrl.replace(/^https:\/\//, '')}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full h-10 border-slate-200" onClick={() => setAuthOpen(true)}>
              Entrar na plataforma
            </Button>
            <Button size="sm" className="rounded-full h-10 text-white border-0 shadow-sm" style={{ backgroundColor: corPrimaria }} asChild>
              <Link to="/inscricao">Candidaturas</Link>
            </Button>
          </div>
        </div>
        <div
          className="border-t border-slate-100 py-5 text-center text-xs text-slate-500"
          style={{ backgroundColor: `color-mix(in srgb, ${corSecundaria} 4%, white)` }}
        >
          Plataforma académica{' '}
          <a href={`https://${platformBase}`} className="font-semibold hover:underline" style={{ color: corPrimaria }}>
            DSICOLA
          </a>
        </div>
      </footer>

      <TenantAuthDialog open={authOpen} onOpenChange={setAuthOpen} displayName={displayName} logoUrl={logoUrl} />
    </div>
  );
}
