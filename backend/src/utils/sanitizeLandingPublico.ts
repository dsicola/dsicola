/**
 * Conteúdo público da landing institucional (site do tenant). Sem HTML livre — apenas texto e URLs validadas.
 */
export type LandingPublicoSanitized = {
  /** Linha pequena acima do título (ex.: tagline ou “Desde 1998”). Substitui o rótulo Ensino superior/secundário se preenchido. */
  heroBadge: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
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
};

const MAX_GALLERY = 16;
const MAX_URL_LEN = 2000;

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

export function sanitizeLandingPublico(raw: unknown): LandingPublicoSanitized {
  const empty: LandingPublicoSanitized = {
    heroBadge: null,
    heroTitle: null,
    heroSubtitle: null,
    heroImageUrl: null,
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
  };
}
