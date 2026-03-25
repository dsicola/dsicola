import { describe, it, expect } from 'vitest';
import { sanitizeLandingPublico } from '../utils/sanitizeLandingPublico.js';

describe('sanitizeLandingPublico', () => {
  it('aceita payload mínimo e devolve defaults seguros', () => {
    const out = sanitizeLandingPublico({});
    expect(out.heroBadge).toBeNull();
    expect(out.galleryUrls).toEqual([]);
    expect(out.showAcademicOffer).toBe(true);
    expect(out.whatsappDigits).toBeNull();
  });

  it('preserva heroBadge e textos com limite', () => {
    const out = sanitizeLandingPublico({
      heroBadge: '  Excelência desde 1998  ',
      heroTitle: 'Título',
      heroSubtitle: 'Sub',
      aboutText: 'a'.repeat(9000),
    });
    expect(out.heroBadge).toBe('Excelência desde 1998');
    expect(out.aboutText?.length).toBe(8000);
  });

  it('filtra galeria: só URLs http(s) válidas, ignora javascript:', () => {
    const out = sanitizeLandingPublico({
      galleryUrls: ['https://cdn.example.com/1.jpg', 'javascript:alert(1)', 'ftp://x', 'http://legacy.ok/png'],
    });
    expect(out.galleryUrls).toEqual(['https://cdn.example.com/1.jpg', 'http://legacy.ok/png']);
  });

  it('redes: só https; http é rejeitado', () => {
    const out = sanitizeLandingPublico({
      instagramUrl: 'http://instagram.com/x',
      facebookUrl: 'https://facebook.com/x',
    });
    expect(out.instagramUrl).toBeNull();
    expect(out.facebookUrl).toBe('https://facebook.com/x');
  });

  it('WhatsApp: só dígitos 8–15', () => {
    expect(sanitizeLandingPublico({ whatsappDigits: '244923456789' }).whatsappDigits).toBe('244923456789');
    expect(sanitizeLandingPublico({ whatsappDigits: '12345' }).whatsappDigits).toBeNull();
    expect(sanitizeLandingPublico({ whatsappDigits: '1'.repeat(20) }).whatsappDigits).toBeNull();
  });

  it('mapEmbedUrl: só domínios de embed permitidos', () => {
    expect(
      sanitizeLandingPublico({
        mapEmbedUrl: 'https://www.google.com/maps/embed?pb=1',
      }).mapEmbedUrl
    ).toBe('https://www.google.com/maps/embed?pb=1');
    expect(
      sanitizeLandingPublico({
        mapEmbedUrl: 'https://evil.com/maps/embed?stolen=1',
      }).mapEmbedUrl
    ).toBeNull();
  });

  it('secondaryCtaUrl: aceita rota interna ou https', () => {
    expect(sanitizeLandingPublico({ secondaryCtaUrl: '/regulamento' }).secondaryCtaUrl).toBe('/regulamento');
    expect(sanitizeLandingPublico({ secondaryCtaUrl: '//evil.com' }).secondaryCtaUrl).toBeNull();
    expect(sanitizeLandingPublico({ secondaryCtaUrl: 'https://site.edu/regul.pdf' }).secondaryCtaUrl).toBe(
      'https://site.edu/regul.pdf'
    );
  });

  it('showAcademicOffer false quando enviado', () => {
    expect(sanitizeLandingPublico({ showAcademicOffer: false }).showAcademicOffer).toBe(false);
    expect(sanitizeLandingPublico({ showAcademicOffer: 'false' as any }).showAcademicOffer).toBe(false);
  });

  it('entrada inválida devolve objeto vazio sanitizado', () => {
    expect(sanitizeLandingPublico(null).galleryUrls).toEqual([]);
    expect(sanitizeLandingPublico('x' as any).heroTitle).toBeNull();
    expect(sanitizeLandingPublico([] as any).showAcademicOffer).toBe(true);
  });
});
