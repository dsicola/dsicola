/**
 * Tipografia da landing page (nível Horizon).
 * Usado no editor (LandingConfigTab) e na página de vendas (VendasLanding).
 */

export const LANDING_FONT_FAMILY_MAP: Record<string, string> = {
  system: 'system-ui, -apple-system, sans-serif',
  outfit: '"Outfit", system-ui, sans-serif',
  inter: '"Inter", system-ui, sans-serif',
  poppins: '"Poppins", system-ui, sans-serif',
  playfair: '"Playfair Display", system-ui, serif',
  'space-grotesk': '"Space Grotesk", system-ui, sans-serif',
  'dm-sans': '"DM Sans", system-ui, sans-serif',
};

/** Google Fonts URL: valor da config → nome para query string */
export const LANDING_GOOGLE_FONTS: Record<string, string> = {
  outfit: 'Outfit:wght@300;400;500;600;700;800',
  inter: 'Inter:wght@300;400;500;600;700;800',
  poppins: 'Poppins:wght@300;400;500;600;700;800',
  playfair: 'Playfair+Display:wght@400;500;600;700',
  'space-grotesk': 'Space+Grotesk:wght@300;400;500;600;700',
  'dm-sans': 'DM+Sans:wght@300;400;500;600;700',
};

/** Escala de tipografia → tamanho base em px (aplicado ao wrapper da landing) */
export const LANDING_ESCALA_BASE_PX: Record<string, number> = {
  pequeno: 14,
  medio: 16,
  grande: 18,
};

export const LANDING_TYPOGRAPHY_DEFAULTS = {
  fonte_titulos: 'outfit',
  fonte_corpo: 'outfit',
  escala_tipografia: 'medio',
} as const;
