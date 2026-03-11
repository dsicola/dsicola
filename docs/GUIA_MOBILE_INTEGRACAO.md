# Guia de Integração Mobile — DSICOLA

> Como tornar o DSICOLA compatível com dispositivos móveis e integrar funcionalidade mobile.

---

## Índice

1. [Visão geral](#visão-geral)
2. [O que já está implementado](#o-que-já-está-implementado)
3. [Responsive Design (melhorias)](#responsive-design-melhorias)
4. [PWA — App instalável no telemóvel](#pwa--app-instalável-no-telemóvel)
5. [Capacitor — App nativo (opcional)](#capacitor--app-nativo-opcional)
6. [Checklist de compatibilidade mobile](#checklist-de-compatibilidade-mobile)

---

## Visão geral

O DSICOLA pode ser usado em mobile de três formas:

| Abordagem | Descrição | Esforço |
|-----------|-----------|---------|
| **Responsive** | Site adapta-se ao ecrã (já parcialmente feito) | Baixo |
| **PWA** | Instalável no telemóvel, funciona offline parcial | Médio |
| **App nativo** | App nas lojas (Capacitor/Ionic) | Alto |

**Recomendação:** Começar por completar o **responsive** e adicionar **PWA** para permitir "Adicionar ao ecrã inicial" no telemóvel.

---

## O que já está implementado

### 1. Meta viewport e base CSS

- `index.html`: viewport com `width=device-width`, `initial-scale=1`, `viewport-fit=cover`
- `index.css`: utilitários `.table-responsive`, `.form-grid`, `.touch-target`, `-webkit-overflow-scrolling: touch`

### 2. Hooks e utilitários

- `use-mobile.tsx`: `useIsMobile()` com breakpoint 768px
- `responsive.ts`: classes Tailwind reutilizáveis (`responsiveClasses`, `cnResponsive`)

### 3. Layout e sidebar

- `DashboardLayout`: deteta mobile (`window.innerWidth < 1024`) e usa sidebar em modo drawer
- `DynamicSidebar`: overlay escuro no mobile, sidebar deslizante

### 4. Componentes responsivos

- `ResponsiveTable`: tabelas com scroll horizontal em mobile
- `ResponsiveQuickActions`: ações rápidas adaptadas ao ecrã

### 5. Testes E2E

- `e2e/mobile-responsive.spec.ts`: testes de responsividade na landing
- `e2e/super-admin-mobile.spec.ts`: testes no super-admin em viewport mobile
- `scripts/test-mobile-responsive.ts`: verificação estática de padrões responsivos

---

## Responsive Design (melhorias)

### Breakpoints Tailwind (já configurados)

```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

### Boas práticas ao criar novas páginas

1. **Usar classes responsivas**

   ```tsx
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
   <div className="p-3 sm:p-4 md:p-6">
   <button className="w-full sm:w-auto min-h-[44px] touch-manipulation">
   ```

2. **Tabelas:** usar `ResponsiveTable` ou envolver em `table-responsive`

   ```tsx
   <div className="table-responsive">
     <table>...</table>
   </div>
   ```

3. **Formulários:** usar `form-grid` ou `grid-cols-1 md:grid-cols-2`

4. **Área de toque:** botões e links com `min-h-[44px] min-w-[44px]` (WCAG)

5. **Evitar overflow:** `max-w-full`, `overflow-x-hidden` no body

### Verificar responsividade

```bash
# Teste estático
npm run test:mobile

# Teste E2E em viewport mobile
npm run test:mobile:e2e
npm run test:super-admin-mobile
```

---

## PWA — App instalável no telemóvel

Com PWA, o utilizador pode **"Adicionar ao ecrã inicial"** no telemóvel e abrir o DSICOLA como app.

### O que o PWA adiciona

- **Web App Manifest:** `manifest.json` com nome, ícones, cores, modo de exibição
- **Service Worker:** cache de assets para offline parcial
- **Instalável:** prompt "Adicionar ao ecrã inicial" no telemóvel

### Configuração (vite-plugin-pwa)

O plugin `vite-plugin-pwa` gera o manifest e o service worker automaticamente no build.

1. **Instalar**

   ```bash
   cd frontend && npm i -D vite-plugin-pwa
   ```

2. **Configurar em `vite.config.ts`**

   ```ts
   import { VitePWA } from 'vite-plugin-pwa'

   export default defineConfig({
     plugins: [
       react(),
       VitePWA({
         registerType: 'autoUpdate',
         manifest: {
           name: 'DSICOLA',
           short_name: 'DSICOLA',
           description: 'Sistema de Gestão Escolar',
           theme_color: '#1e40af',
           background_color: '#ffffff',
           display: 'standalone',
           start_url: '/',
           icons: [
             { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
             { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
             { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
           ],
         },
       }),
     ],
   })
   ```

3. **Ícones PWA:** criar `pwa-192.png` e `pwa-512.png` em `public/` (ou usar favicon.svg se não tiver PNG)

4. **Build:** após `npm run build`, o `dist/` inclui `manifest.webmanifest` e `sw.js`

### Testar PWA

- Chrome DevTools → Application → Manifest
- Lighthouse → Progressive Web App

---

## Capacitor — App nativo (opcional)

Para publicar nas **App Store** e **Google Play**, use [Capacitor](https://capacitorjs.com/):

1. **Instalar**

   ```bash
   cd frontend
   npm i @capacitor/core @capacitor/cli
   npx cap init
   ```

2. **Configurar**

   - `capacitor.config.ts`: `webDir: 'dist'`, `server.url` para dev
   - Adicionar plataformas: `npx cap add ios`, `npx cap add android`

3. **Build e sync**

   ```bash
   npm run build
   npx cap sync
   npx cap open ios   # ou android
   ```

4. **Publicar:** seguir as guidelines da Apple e Google.

**Nota:** Para multi-tenant, a URL base pode ser configurável no app (ex.: `https://instituicao.dsicola.com`).

---

## Checklist de compatibilidade mobile

| Item | Estado |
|------|--------|
| Viewport meta no `index.html` | ✅ |
| `overflow-x: hidden` no body | ✅ |
| Sidebar em drawer no mobile | ✅ |
| Tabelas com scroll horizontal | ✅ |
| Formulários em grid responsivo | ✅ |
| Botões com área de toque ≥44px | ✅ |
| Utilitários `responsive.ts` | ✅ |
| Hook `useIsMobile` | ✅ |
| `viewport-fit=cover` (notch) | ✅ |
| PWA manifest | ⚠️ Ver secção PWA |
| Service worker | ⚠️ Ver secção PWA |
| Ícones PWA 192/512 | ⚠️ Criar se necessário |

---

## Resumo rápido

1. **Para uso imediato:** O site já é responsivo em mobile; a sidebar vira drawer e as tabelas têm scroll horizontal.
2. **Para instalar no telemóvel:** O PWA está configurado. Após `npm run build`, o `dist/` inclui manifest e service worker. Ver secção [Como colocar no telemóvel](#como-colocar-no-telemóvel-mobile-real).
3. **Para app nas lojas:** Usar Capacitor para empacotar o frontend como app iOS/Android.

---

## Como colocar no telemóvel (mobile real)

O PWA está configurado e o build gera `manifest.webmanifest` + `sw.js`. Para usar num telemóvel real:

### Requisito: HTTPS

O PWA e o service worker só funcionam em **HTTPS** (ou `localhost` em desenvolvimento). Em produção, o site deve estar em HTTPS.

### Opção A — Produção (Vercel, Netlify, servidor próprio)

1. **Fazer deploy** do `frontend/dist/` para o teu domínio (ex.: `https://app.dsicola.com`).
2. No telemóvel, abrir o Chrome/Safari e ir a `https://app.dsicola.com`.
3. **Instalar a app:**
   - **Android (Chrome):** Menu (⋮) → "Instalar app" ou "Adicionar ao ecrã inicial". Por vezes aparece um banner na parte inferior com "Instalar".
   - **iOS (Safari):** Botão Partilhar (□↑) → "Adicionar ao ecrã inicial". *Usar Safari, não Chrome.*
4. O ícone DSICOLA aparece no ecrã inicial; ao abrir, a app abre em modo standalone (sem barra do browser).

**Se "Instalar app" não aparecer (Android):** O Chrome exige ícones PNG 192×192 e 512×512. O projeto inclui `pwa-192.png` e `pwa-512.png`. Verificar no Chrome DevTools (Application → Manifest) se há erros. Após alterar o favicon, executar `npm run pwa:icons` e fazer novo deploy.

### Opção B — Testar localmente no telemóvel (ngrok)

1. **Servir o build localmente:**
   ```bash
   cd frontend && npm run build && npm run preview
   ```
   O preview corre em `http://localhost:4173`.

2. **Expor com ngrok** (instalar em https://ngrok.com):
   ```bash
   ngrok http 4173
   ```
   O ngrok gera um URL HTTPS (ex.: `https://abc123.ngrok.io`).

3. No telemóvel, abrir esse URL HTTPS no browser.
4. Usar "Adicionar ao ecrã inicial" como em produção.

### Opção C — Mesma rede Wi‑Fi (sem ngrok)

Se o backend e frontend estiverem na mesma rede:

1. Descobrir o IP do PC (ex.: `192.168.1.10`).
2. Iniciar o servidor com o host acessível:
   ```bash
   cd frontend && npm run build && npx vite preview --host 0.0.0.0
   ```
3. No telemóvel, abrir `http://192.168.1.10:4173`.

**Nota:** Sem HTTPS, o service worker não regista e o PWA não fica instalável. Para instalação, use Opção A ou B.

### Resumo rápido

| Cenário | URL no telemóvel | Instalável? |
|---------|------------------|-------------|
| Produção (Vercel, etc.) | `https://teu-dominio.com` | ✅ Sim |
| ngrok | `https://xxx.ngrok.io` | ✅ Sim |
| Rede local (HTTP) | `http://192.168.x.x:4173` | ❌ Não (mas funciona para testar layout) |
