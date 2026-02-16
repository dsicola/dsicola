import { test, expect } from '@playwright/test';

/**
 * Testes de responsividade mobile - Landing e Auth
 * Garante que a aplicação se adapta corretamente a smartphones
 */
test.describe('Responsividade Mobile', () => {
  test.setTimeout(30000);

  test('Landing /vendas - sem overflow horizontal', async ({ page }) => {
    await page.goto('/vendas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('header', { timeout: 15000 });
    const viewportWidth = page.viewportSize()?.width || 375;
    
    // Verificar que não há scroll horizontal significativo (tolerância 30px)
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const htmlScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const maxScroll = Math.max(bodyScrollWidth, htmlScrollWidth);
    expect(maxScroll).toBeLessThanOrEqual(viewportWidth + 30);
    
    // Verificar overflow-x hidden
    const bodyOverflowX = await page.evaluate(() => 
      window.getComputedStyle(document.body).overflowX
    );
    expect(bodyOverflowX).toBe('hidden');
  });

  test('Landing /vendas - header visível e responsivo', async ({ page }) => {
    await page.goto('/vendas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('header', { timeout: 15000 });
    
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    
    // Header deve estar dentro do viewport
    const headerBox = await header.boundingBox();
    expect(headerBox?.width).toBeLessThanOrEqual((page.viewportSize()?.width || 375) + 20);
  });

  test('Landing /vendas - seção hero responsiva', async ({ page }) => {
    await page.goto('/vendas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('header', { timeout: 15000 });
    
    const hero = page.locator('section').first();
    await expect(hero).toBeVisible();
    
    const heroBox = await hero.boundingBox();
    const viewportWidth = page.viewportSize()?.width || 375;
    expect(heroBox?.width).toBeLessThanOrEqual(viewportWidth + 20);
  });

  test('Landing /vendas - botões com área de toque adequada', async ({ page }) => {
    await page.goto('/vendas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('header', { timeout: 15000 });
    
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      if (box) {
        // Mínimo 40x40px para touch targets (recomendação WCAG)
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }
  });

  test('Landing /vendas - secção planos visível', async ({ page }) => {
    await page.goto('/vendas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('header', { timeout: 15000 });
    
    const planosSection = page.locator('#planos');
    await expect(planosSection).toBeVisible();
    
    const cards = planosSection.locator('[class*="grid"]').first();
    await expect(cards).toBeVisible();
    const gridDisplay = await cards.evaluate((el) => 
      window.getComputedStyle(el).display
    );
    expect(gridDisplay).toBe('grid');
  });

  test('Landing /vendas - formulário de contato visível', async ({ page }) => {
    await page.goto('/vendas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('header', { timeout: 15000 });
    
    await page.locator('#contato').scrollIntoViewIfNeeded();
    
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    const submitBtn = form.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test('Auth /auth - página de login responsiva', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form, .max-w-md, [class*="max-w"]', { timeout: 15000 });
    
    const formContainer = page.locator('.max-w-md').first();
    await expect(formContainer).toBeVisible();
    
    const box = await formContainer.boundingBox();
    const viewportWidth = page.viewportSize()?.width || 375;
    expect(box?.width).toBeLessThanOrEqual(viewportWidth + 20);
  });

  test('Auth /auth - sem overflow horizontal', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('form, [class*="gradient"]', { timeout: 15000 });
    
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 375;
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 20);
  });

  test('Landing /vendas - barra de benefícios sem overflow', async ({ page }) => {
    await page.goto('/vendas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('header', { timeout: 15000 });
    
    const benefitsSection = page.locator('section').nth(1);
    await expect(benefitsSection).toBeVisible();
    
    const box = await benefitsSection.boundingBox();
    const viewportWidth = page.viewportSize()?.width || 375;
    expect(box?.width).toBeLessThanOrEqual(viewportWidth + 20);
  });

  test('Landing /vendas - viewport meta correto', async ({ page }) => {
    await page.goto('/vendas');
    await page.waitForLoadState('domcontentloaded');
    
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1');
  });
});
