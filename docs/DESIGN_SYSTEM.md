# Design System — DSICOLA

Componentes, espaçamentos e tipografia em todo o produto (ROADMAP-100).

---

## 1. Base

- **Framework:** shadcn/ui + Tailwind CSS
- **Fonte:** Outfit (sans-serif)
- **Tema:** Variáveis CSS em `src/index.css` (light/dark)

---

## 2. Cores (Tokens)

| Token | Uso |
|-------|-----|
| `primary` | Botões principais, links, destaques |
| `secondary` | Botões secundários, fundos alternativos |
| `destructive` | Ações destrutivas (excluir, cancelar) |
| `muted` | Texto secundário, fundos suaves |
| `accent` | Hover, seleção |
| `success` | Feedback positivo (toasts, badges) |
| `warning` | Avisos |
| `info` | Informação |

Cores definidas em HSL via `--primary`, `--secondary`, etc. Instituições podem personalizar via Configurações (cor primária, secundária, terciária).

---

## 3. Espaçamentos

| Escala | Valor | Uso |
|--------|-------|-----|
| `1` | 0.25rem (4px) | Gaps mínimos |
| `2` | 0.5rem (8px) | Padding interno |
| `4` | 1rem (16px) | Padding padrão, gaps |
| `6` | 1.5rem (24px) | Seções |
| `8` | 2rem (32px) | Margens entre blocos |

**Container:** `padding: 1rem` (mobile), `1.5rem` (sm), `2rem` (md+).

---

## 4. Tipografia

| Classe | Uso |
|--------|-----|
| `text-xs` | Labels, metadados |
| `text-sm` | Corpo secundário |
| `text-base` | Corpo principal |
| `text-lg` | Subtítulos |
| `text-xl` / `text-2xl` | Títulos |

**Pesos:** `font-medium` (500), `font-semibold` (600), `font-bold` (700).

---

## 5. Componentes Principais

| Componente | Localização | Uso |
|------------|-------------|-----|
| Button | `@/components/ui/button` | Ações primárias, secundárias, outline |
| Card | `@/components/ui/card` | Blocos de conteúdo |
| Input | `@/components/ui/input` | Campos de texto |
| Table | `@/components/ui/table` | Listagens |
| Dialog | `@/components/ui/dialog` | Modais |
| Toast | Sonner | Feedback (sucesso, erro, alerta) |
| EmptyState | `@/components/ui/empty-state` | Listas vazias |
| ResponsiveTable | `@/components/common/ResponsiveTable` | Tabelas com empty state e loading |

---

## 6. Breakpoints

| Nome | Valor | Uso |
|------|-------|-----|
| xs | 475px | Mobile pequeno |
| sm | 640px | Mobile grande |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Desktop grande |
| 2xl | 1536px | Wide |

---

## 7. Consistência

- Usar componentes do design system em vez de criar novos
- Respeitar tokens de cor e espaçamento
- Manter padrão de loading (skeleton/spinner) e feedback (toasts)

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
