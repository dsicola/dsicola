/**
 * Converte valor guardado na config (dígitos ou URL WhatsApp) num href seguro para abrir o contacto.
 */
export function getInstituicaoWhatsAppHref(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const val = input.trim();
  const lower = val.toLowerCase();
  if (lower.startsWith('https://wa.me/') || lower.startsWith('http://wa.me/')) {
    return val.replace(/^http:\/\//i, 'https://');
  }
  if (lower.startsWith('https://api.whatsapp.com/') || lower.startsWith('http://api.whatsapp.com/')) {
    return val.replace(/^http:\/\//i, 'https://');
  }
  if (lower.startsWith('wa.me/')) {
    return `https://${val}`;
  }
  const digits = val.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 15) {
    return `https://wa.me/${digits}`;
  }
  return null;
}
