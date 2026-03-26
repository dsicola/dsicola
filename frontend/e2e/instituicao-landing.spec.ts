import { test, expect, type Page } from '@playwright/test';

/**
 * Landing institucional no subdomínio simulado (?subdomain=) — alinhado a useSubdomain (localhost).
 *
 * - Primeiro teste: backend real com instituição `inst-a-secundario-test` (ex.: seed-multi-tenant-test).
 * - Testes "personalização": mockam GET `/instituicoes/subdominio/...` (frontend + servidor Vite em 8080).
 *
 * Cobertura backend (API + sanitização): `npm run test:landing-institucional` no diretório `backend`.
 * E2E: requer `npx playwright install` se o browser ainda não estiver instalado.
 */
test.describe('Landing institucional (tenant)', () => {
  test('raiz com subdomain de teste mostra página institucional com hero e CTAs', async ({ page }) => {
    const res = await page.goto('/?subdomain=inst-a-secundario-test', { waitUntil: 'domcontentloaded' });
    expect(res?.ok() ?? false).toBeTruthy();

    await expect(page.getByTestId('institutional-landing')).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Candidaturas|Candidatar/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /^Entrar$/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('dialog').getByText(/Entrar ou criar conta/i)).toBeVisible();
  });
});

/**
 * Fluxo de personalização (landingPublico): UI respeita toggles e publicações/eventos.
 * Mocka GET da API para não depender de dados reais na BD.
 */
test.describe('Landing institucional — personalização (site público)', () => {
  const mockOpcoesRoute = async (page: Page) => {
    await page.route(/\/instituicoes\/subdominio\/inst-a-secundario-test\/opcoes-inscricao/i, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ opcoes: [] }),
      });
    });
  };

  test('publicações/eventos e hero compacto: secções conforme landingPublico', async ({ page }) => {
    await mockOpcoesRoute(page);

    await page.route(/\/instituicoes\/subdominio\/inst-a-secundario-test(\/?)(\?.*)?$/i, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-mock-landing',
          nome: 'Escola Mock UX',
          subdominio: 'inst-a-secundario-test',
          dominioCustomizado: null,
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          logoUrl: null,
          emailContato: null,
          telefone: null,
          endereco: null,
          status: 'ativa',
          configuracao: {
            nomeInstituicao: 'Escola Mock UX',
            corPrimaria: '#1d4ed8',
            corSecundaria: '#0f172a',
            descricao: 'Descrição para fallback.',
            landingPublico: {
              showHeroSection: false,
              showAboutSection: false,
              showAcademicOffer: false,
              showEventsSection: true,
              eventsSectionTitle: 'Últimas publicações',
              eventsItems: [
                {
                  title: 'Cerimónia de graduação',
                  subtitle: 'Todos os convidados bem-vindos.',
                  ctaLabel: 'Saiba mais',
                  ctaUrl: '/inscricao',
                },
              ],
            },
          },
        }),
      });
    });

    const res = await page.goto('/?subdomain=inst-a-secundario-test', { waitUntil: 'domcontentloaded' });
    expect(res?.ok() ?? false).toBeTruthy();

    await expect(page.getByTestId('institutional-landing')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('landing-hero-compact')).toBeVisible();
    await expect(page.getByTestId('landing-eventos')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Últimas publicações' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cerimónia de graduação' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Saiba mais/i }).first()).toBeVisible();
    await expect(page.getByTestId('landing-sobre')).toHaveCount(0);
  });

  test('hero completo quando showHeroSection true e sem secção de eventos', async ({ page }) => {
    await mockOpcoesRoute(page);

    await page.route(/\/instituicoes\/subdominio\/inst-a-secundario-test(\/?)(\?.*)?$/i, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-mock-hero-full',
          nome: 'Escola Full Hero',
          subdominio: 'inst-a-secundario-test',
          dominioCustomizado: null,
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          logoUrl: null,
          emailContato: null,
          telefone: null,
          endereco: null,
          status: 'ativa',
          configuracao: {
            nomeInstituicao: 'Escola Full Hero',
            corPrimaria: '#1d4ed8',
            corSecundaria: '#0f172a',
            landingPublico: {
              showHeroSection: true,
              heroTitle: 'Bem-vindos Mock',
              showEventsSection: false,
              eventsItems: [],
            },
          },
        }),
      });
    });

    await page.goto('/?subdomain=inst-a-secundario-test', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('landing-hero-full')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Bem-vindos Mock' })).toBeVisible();
    await expect(page.getByTestId('landing-eventos')).toHaveCount(0);
  });
});
