/** Espelha o JSON sanitizado no backend (`landing_publico`). */
export type LandingPublico = {
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

export const defaultLandingPublico = (): LandingPublico => ({
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
});

export function parseLandingPublico(raw: unknown): LandingPublico {
  const d = defaultLandingPublico();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
  const o = raw as Record<string, unknown>;
  const g = Array.isArray(o.galleryUrls) ? o.galleryUrls.filter((x): x is string => typeof x === 'string') : [];
  return {
    ...d,
    heroBadge: typeof o.heroBadge === 'string' ? o.heroBadge : d.heroBadge,
    heroTitle: typeof o.heroTitle === 'string' ? o.heroTitle : d.heroTitle,
    heroSubtitle: typeof o.heroSubtitle === 'string' ? o.heroSubtitle : d.heroSubtitle,
    heroImageUrl: typeof o.heroImageUrl === 'string' ? o.heroImageUrl : d.heroImageUrl,
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
  };
}
