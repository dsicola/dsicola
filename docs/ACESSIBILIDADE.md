# Acessibilidade (WCAG 2.1 AA) — DSICOLA

Checklist e boas práticas (ROADMAP-100).

---

## 1. Contraste

Texto normal: 4.5:1 mínimo. Texto grande: 3:1. Variáveis CSS --foreground, --muted-foreground.

---

## 2. Foco

Ordem de tabulação lógica. focus-visible:ring em botões/inputs (shadcn). Skip link opcional.

---

## 3. Labels

Inputs com label ou aria-label. Botões com texto ou aria-label. Tabelas com th scope.

---

## 4. Teclado

Tab, Enter, Space, Escape. Radix UI (shadcn) suporta navegação por teclado em dialogs e dropdowns.

---

## 5. Áreas de Toque

Mínimo 44x44px em mobile. Classe .touch-target em index.css.

---

## 6. Validação

axe DevTools, Lighthouse, NVDA/VoiceOver.

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
