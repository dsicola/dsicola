/**
 * Conteúdo público da landing institucional (site do tenant). Sem HTML livre — apenas texto e URLs validadas.
 */
export type LandingPublicoEventItemSanitized = {
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  dateLabel: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type LandingPublicoSanitized = {
  /** Linha pequena acima do título (ex.: tagline ou “Desde 1998”). Substitui o rótulo Ensino superior/secundário se preenchido. */
  heroBadge: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  /**
   * Véu escuro sobre a imagem de capa (0–100). 0 = foto mais visível; 100 = quase preto (melhor contraste do texto).
   */
  heroOverlayOpacity: number;
  aboutTitle: string | null;
  aboutText: string | null;
  galleryUrls: string[];
  whatsappDigits: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  mapEmbedUrl: string | null;
  showAcademicOffer: boolean;
  secondaryCtaLabel: string | null;
  secondaryCtaUrl: string | null;
  /** Secção hero grande (capa + texto). Se false, mostra-se apenas uma faixa compacta. */
  showHeroSection: boolean;
  showAboutSection: boolean;
  showGallerySection: boolean;
  showMapSection: boolean;
  showEventsSection: boolean;
  eventsSectionTitle: string | null;
  eventsItems: LandingPublicoEventItemSanitized[];
};

const MAX_GALLERY = 16;
const MAX_EVENTS = 8;
const MAX_URL_LEN = 2000;
const DEFAULT_HERO_OVERLAY = 55;

function trimStr(s: unknown, max: number): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function safeHttpsUrl(s: unknown): string | null {
  const t = trimStr(s, MAX_URL_LEN);
  if (!t) return null;
  if (!/^https:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:') return null;
    return t;
  } catch {
    return null;
  }
}

/** Imagem hero/galeria: https ou http (alguns CDNs legados). */
function safeImageUrl(s: unknown): string | null {
  const t = trimStr(s, MAX_URL_LEN);
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    new URL(t);
    return t;
  } catch {
    return null;
  }
}

function safeMapEmbed(s: unknown): string | null {
  const t = trimStr(s, 6000);
  if (!t) return null;
  if (!/^https:\/\//i.test(t)) return null;
  const lower = t.toLowerCase();
  if (
    lower.includes('google.com/maps/embed') ||
    lower.includes('maps.google.com') ||
    lower.includes('openstreetmap.org/export/embed')
  ) {
    return t;
  }
  return null;
}

function safeWhatsapp(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Rotas internas (/foo) ou https externos. */
function safeSecondaryCtaUrl(s: unknown): string | null {
  const t = trimStr(s, MAX_URL_LEN);
  if (!t) return null;
  if (t.startsWith('/') && !t.startsWith('//') && t.length <= 500) {
    return t;
  }
  return safeHttpsUrl(t);
}

function clampOverlayOpacity(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) {
    return Math.min(100, Math.max(0, Math.round(n)));
  }
  if (typeof n === 'string' && /^\s*\d+\s*$/.test(n)) {
    return clampOverlayOpacity(parseInt(n, 10));
  }
  return DEFAULT_HERO_OVERLAY;
}

function boolSection(raw: Record<string, unknown>, key: string, defaultValue: boolean): boolean {
  const v = raw[key];
  if (v === false || v === 'false') return false;
  if (v === true || v === 'true') return true;
  return defaultValue;
}

function sanitizeEventsItems(raw: unknown): LandingPublicoEventItemSanitized[] {
  if (!Array.isArray(raw)) return [];
  const out: LandingPublicoEventItemSanitized[] = [];
  for (const item of raw) {
    if (out.length >= MAX_EVENTS) break;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    const title = trimStr(r.title, 200);
    if (!title) continue;
    out.push({
      title,
      subtitle: trimStr(r.subtitle, 400),
      imageUrl: safeImageUrl(r.imageUrl),
      dateLabel: trimStr(r.dateLabel, 80),
      ctaLabel: trimStr(r.ctaLabel, 80),
      ctaUrl: safeSecondaryCtaUrl(r.ctaUrl),
    });
  }
  return out;
}

export function sanitizeLandingPublico(raw: unknown): LandingPublicoSanitized {
  const empty: LandingPublicoSanitized = {
    heroBadge: null,
    heroTitle: null,
    heroSubtitle: null,
    heroImageUrl: null,
    heroOverlayOpacity: DEFAULT_HERO_OVERLAY,
    aboutTitle: null,
    aboutText: null,
    galleryUrls: [],
    whatsappDigits: null,
    instagramUrl: null,
    facebookUrl: null,
    youtubeUrl: null,
    linkedinUrl: null,
    twitterUrl: null,
    tiktokUrl: null,
    mapEmbedUrl: null,
    showAcademicOffer: true,
    secondaryCtaLabel: null,
    secondaryCtaUrl: null,
    showHeroSection: true,
    showAboutSection: true,
    showGallerySection: true,
    showMapSection: true,
    showEventsSection: false,
    eventsSectionTitle: null,
    eventsItems: [],
  };

  if (raw === null || raw === undefined) {
    return empty;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return empty;
  }

  const o = raw as Record<string, unknown>;

  const galleryIn = Array.isArray(o.galleryUrls) ? o.galleryUrls : [];
  const galleryUrls: string[] = [];
  for (const item of galleryIn) {
    const u = safeImageUrl(item);
    if (u) galleryUrls.push(u);
    if (galleryUrls.length >= MAX_GALLERY) break;
  }

  const showAcademicOffer =
    o.showAcademicOffer === false || o.showAcademicOffer === 'false' ? false : true;

  return {
    heroBadge: trimStr(o.heroBadge, 120),
    heroTitle: trimStr(o.heroTitle, 200),
    heroSubtitle: trimStr(o.heroSubtitle, 500),
    heroImageUrl: safeImageUrl(o.heroImageUrl),
    heroOverlayOpacity: clampOverlayOpacity(o.heroOverlayOpacity),
    aboutTitle: trimStr(o.aboutTitle, 120),
    aboutText: trimStr(o.aboutText, 8000),
    galleryUrls,
    whatsappDigits: safeWhatsapp(o.whatsappDigits ?? o.whatsapp),
    instagramUrl: safeHttpsUrl(o.instagramUrl),
    facebookUrl: safeHttpsUrl(o.facebookUrl),
    youtubeUrl: safeHttpsUrl(o.youtubeUrl),
    linkedinUrl: safeHttpsUrl(o.linkedinUrl),
    twitterUrl: safeHttpsUrl(o.twitterUrl),
    tiktokUrl: safeHttpsUrl(o.tiktokUrl),
    mapEmbedUrl: safeMapEmbed(o.mapEmbedUrl),
    showAcademicOffer,
    secondaryCtaLabel: trimStr(o.secondaryCtaLabel, 80),
    secondaryCtaUrl: safeSecondaryCtaUrl(o.secondaryCtaUrl),
    showHeroSection: boolSection(o, 'showHeroSection', true),
    showAboutSection: boolSection(o, 'showAboutSection', true),
    showGallerySection: boolSection(o, 'showGallerySection', true),
    showMapSection: boolSection(o, 'showMapSection', true),
    showEventsSection: boolSection(o, 'showEventsSection', false),
    eventsSectionTitle: trimStr(o.eventsSectionTitle, 120),
    eventsItems: sanitizeEventsItems(o.eventsItems),
  };
}
