import { AppError } from '../middlewares/errorHandler.js';

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
]);

function youtubeVideoIdFromPath(hostname: string, pathname: string, searchParams: URLSearchParams): string | null {
  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    const id = pathname.replace(/^\//, '').split('/')[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (pathname.startsWith('/watch')) {
    const v = searchParams.get('v');
    return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
  }
  if (pathname.startsWith('/embed/')) {
    const id = pathname.split('/')[2];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (pathname.startsWith('/shorts/')) {
    const id = pathname.split('/')[2];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
  return null;
}

function isBunnyVideoUrl(hostname: string, pathname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'iframe.mediadelivery.net' || h.endsWith('.mediadelivery.net')) {
    return pathname.includes('/embed/');
  }
  if (h.endsWith('.b-cdn.net') || h.endsWith('.bunnycdn.com')) return true;
  if (h === 'bunnycdn.com' || h === 'video.bunnycdn.com' || h === 'bunny.net') return true;
  return false;
}

/** Aceita URL https de vídeo YouTube (vários formatos) ou Bunny (CDN / Bunny Stream embed). */
export function parseSocialContactVideoUrl(raw: string): { provider: 'youtube' | 'bunny'; embedSrc: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) throw new AppError('URL do vídeo em falta.', 400);
  if (trimmed.length > 2048) throw new AppError('URL do vídeo demasiado longa.', 400);

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new AppError('URL do vídeo inválida.', 400);
  }
  if (u.protocol !== 'https:') throw new AppError('O vídeo deve usar HTTPS.', 400);

  const host = u.hostname.replace(/^www\./, '');
  const pathname = u.pathname || '';

  if (YT_HOSTS.has(u.hostname) || YT_HOSTS.has(host)) {
    const id = youtubeVideoIdFromPath(u.hostname.replace(/^www\./, ''), pathname, u.searchParams);
    if (!id) throw new AppError('Link de YouTube não reconhecido. Use o link do vídeo ou youtu.be/…', 400);
    return {
      provider: 'youtube',
      embedSrc: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  if (isBunnyVideoUrl(u.hostname, pathname)) {
    return { provider: 'bunny', embedSrc: trimmed.split('#')[0] };
  }

  throw new AppError(
    'URL de vídeo não suportada. Use um link YouTube (youtube.com, youtu.be) ou Bunny (iframe.mediadelivery.net, b-cdn.net).',
    400,
  );
}

const WHATSAPP_MAX = 320;
const LOCATION_MAX = 500;

export function normalizeContactWhatsapp(raw: string): string {
  const s = (raw || '').trim();
  if (!s) throw new AppError('Número ou link WhatsApp em falta.', 400);
  if (s.length > WHATSAPP_MAX) throw new AppError(`WhatsApp: máximo ${WHATSAPP_MAX} caracteres.`, 400);
  return s;
}

export function normalizeContactLocation(raw: string): string {
  const s = (raw || '').trim();
  if (!s) throw new AppError('Contacto ou localidade em falta.', 400);
  if (s.length > LOCATION_MAX) throw new AppError('Contacto/localidade: máximo 500 caracteres.', 400);
  return s;
}

export type SocialPostContactInput = {
  contactWhatsappShow?: boolean;
  contactWhatsapp?: string | null;
  contactLocationShow?: boolean;
  contactLocation?: string | null;
  contactVideoShow?: boolean;
  contactVideoUrl?: string | null;
};

export type SocialPostContactWrite = {
  contactWhatsappShow: boolean;
  contactWhatsapp: string | null;
  contactLocationShow: boolean;
  contactLocation: string | null;
  contactVideoShow: boolean;
  contactVideoUrl: string | null;
};

/** Valores por omissão ao criar publicação. */
export function socialPostContactForCreate(input: SocialPostContactInput): SocialPostContactWrite {
  const whatsappShow = Boolean(input.contactWhatsappShow);
  const locationShow = Boolean(input.contactLocationShow);
  const videoShow = Boolean(input.contactVideoShow);
  return {
    contactWhatsappShow: whatsappShow,
    contactWhatsapp: whatsappShow ? normalizeContactWhatsapp(String(input.contactWhatsapp ?? '')) : null,
    contactLocationShow: locationShow,
    contactLocation: locationShow ? normalizeContactLocation(String(input.contactLocation ?? '')) : null,
    contactVideoShow: videoShow,
    contactVideoUrl: videoShow
      ? (() => {
          const raw = String(input.contactVideoUrl ?? '').trim();
          parseSocialContactVideoUrl(raw);
          return raw;
        })()
      : null,
  };
}

/** Campos a fundir no update (só chaves presentes em `input`). */
export function socialPostContactForPatch(
  input: SocialPostContactInput,
): Partial<SocialPostContactWrite> {
  const patch: Partial<SocialPostContactWrite> = {};
  if (input.contactWhatsappShow !== undefined) {
    patch.contactWhatsappShow = Boolean(input.contactWhatsappShow);
    patch.contactWhatsapp = patch.contactWhatsappShow
      ? normalizeContactWhatsapp(String(input.contactWhatsapp ?? ''))
      : null;
  }
  if (input.contactLocationShow !== undefined) {
    patch.contactLocationShow = Boolean(input.contactLocationShow);
    patch.contactLocation = patch.contactLocationShow
      ? normalizeContactLocation(String(input.contactLocation ?? ''))
      : null;
  }
  if (input.contactVideoShow !== undefined) {
    patch.contactVideoShow = Boolean(input.contactVideoShow);
    if (patch.contactVideoShow) {
      const raw = String(input.contactVideoUrl ?? '').trim();
      parseSocialContactVideoUrl(raw);
      patch.contactVideoUrl = raw;
    } else {
      patch.contactVideoUrl = null;
    }
  }
  return patch;
}
