/** Espelha o JSON sanitizado no backend (`landing_publico`). */
export type LandingPublicoEventItem = {
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  dateLabel: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type LandingPublico = {
  heroBadge: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  /** 0–100: véu escuro sobre a capa (maior = texto mais legível, foto mais escura). */
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
  showHeroSection: boolean;
  showAboutSection: boolean;
  showGallerySection: boolean;
  showMapSection: boolean;
  showEventsSection: boolean;
  eventsSectionTitle: string | null;
  eventsItems: LandingPublicoEventItem[];
};

export const emptyLandingEventItem = (): LandingPublicoEventItem => ({
  title: '',
  subtitle: null,
  imageUrl: null,
  dateLabel: null,
  ctaLabel: null,
  ctaUrl: null,
});

export const defaultLandingPublico = (): LandingPublico => ({
  heroBadge: null,
  heroTitle: null,
  heroSubtitle: null,
  heroImageUrl: null,
  heroOverlayOpacity: 55,
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
});

function clampOverlay(n: unknown, fallback: number): number {
  if (typeof n === 'number' && Number.isFinite(n)) {
    return Math.min(100, Math.max(0, Math.round(n)));
  }
  if (typeof n === 'string' && /^\s*\d+\s*$/.test(n)) {
    return clampOverlay(parseInt(n.trim(), 10), fallback);
  }
  return fallback;
}

function parseEventItem(raw: unknown): LandingPublicoEventItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, 200) : '';
  if (!title) return null;
  const subtitle = typeof r.subtitle === 'string' ? r.subtitle.trim().slice(0, 400) || null : null;
  const imageUrl = typeof r.imageUrl === 'string' ? r.imageUrl.trim() || null : null;
  const dateLabel = typeof r.dateLabel === 'string' ? r.dateLabel.trim().slice(0, 80) || null : null;
  const ctaLabel = typeof r.ctaLabel === 'string' ? r.ctaLabel.trim().slice(0, 80) || null : null;
  const ctaUrl = typeof r.ctaUrl === 'string' ? r.ctaUrl.trim().slice(0, 2000) || null : null;
  return { title, subtitle, imageUrl, dateLabel, ctaLabel, ctaUrl };
}

export function parseLandingPublico(raw: unknown): LandingPublico {
  const d = defaultLandingPublico();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
  const o = raw as Record<string, unknown>;
  const g = Array.isArray(o.galleryUrls) ? o.galleryUrls.filter((x): x is string => typeof x === 'string') : [];
  const eventsIn = Array.isArray(o.eventsItems) ? o.eventsItems : [];
  const eventsItems: LandingPublicoEventItem[] = [];
  for (const it of eventsIn) {
    const p = parseEventItem(it);
    if (p) eventsItems.push(p);
    if (eventsItems.length >= 8) break;
  }
  const sec = (k: string, def: boolean): boolean => {
    const v = o[k];
    if (v === false || v === 'false') return false;
    if (v === true || v === 'true') return true;
    return def;
  };
  return {
    ...d,
    heroBadge: typeof o.heroBadge === 'string' ? o.heroBadge : d.heroBadge,
    heroTitle: typeof o.heroTitle === 'string' ? o.heroTitle : d.heroTitle,
    heroSubtitle: typeof o.heroSubtitle === 'string' ? o.heroSubtitle : d.heroSubtitle,
    heroImageUrl: typeof o.heroImageUrl === 'string' ? o.heroImageUrl : d.heroImageUrl,
    heroOverlayOpacity: clampOverlay(o.heroOverlayOpacity, d.heroOverlayOpacity),
    aboutTitle: typeof o.aboutTitle === 'string' ? o.aboutTitle : d.aboutTitle,
    aboutText: typeof o.aboutText === 'string' ? o.aboutText : d.aboutText,
    galleryUrls: g,
    whatsappDigits: typeof o.whatsappDigits === 'string' ? o.whatsappDigits : d.whatsappDigits,
    instagramUrl: typeof o.instagramUrl === 'string' ? o.instagramUrl : d.instagramUrl,
    facebookUrl: typeof o.facebookUrl === 'string' ? o.facebookUrl : d.facebookUrl,
    youtubeUrl: typeof o.youtubeUrl === 'string' ? o.youtubeUrl : d.youtubeUrl,
    linkedinUrl: typeof o.linkedinUrl === 'string' ? o.linkedinUrl : d.linkedinUrl,
    twitterUrl: typeof o.twitterUrl === 'string' ? o.twitterUrl : d.twitterUrl,
    tiktokUrl: typeof o.tiktokUrl === 'string' ? o.tiktokUrl : d.tiktokUrl,
    mapEmbedUrl: typeof o.mapEmbedUrl === 'string' ? o.mapEmbedUrl : d.mapEmbedUrl,
    showAcademicOffer: o.showAcademicOffer === false ? false : true,
    secondaryCtaLabel: typeof o.secondaryCtaLabel === 'string' ? o.secondaryCtaLabel : d.secondaryCtaLabel,
    secondaryCtaUrl: typeof o.secondaryCtaUrl === 'string' ? o.secondaryCtaUrl : d.secondaryCtaUrl,
    showHeroSection: sec('showHeroSection', true),
    showAboutSection: sec('showAboutSection', true),
    showGallerySection: sec('showGallerySection', true),
    showMapSection: sec('showMapSection', true),
    showEventsSection: sec('showEventsSection', false),
    eventsSectionTitle: typeof o.eventsSectionTitle === 'string' ? o.eventsSectionTitle : d.eventsSectionTitle,
    eventsItems,
  };
}
