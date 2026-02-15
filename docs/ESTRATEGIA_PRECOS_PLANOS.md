# Estratégia de Preços e Planos DSICOLA

## Princípios

- **Valor fixo mensal por instituição** – não cobrar por aluno (mercado ainda não está maduro)
- **Diferenciação por limite de alunos** – planos com limites crescentes
- **Ensino Secundário vs Superior** – universidades pagam mais (maior complexidade)

---

## Planos – Ensino Secundário

| Plano | Limite | Mensal | Anual | Semestral |
|-------|--------|--------|-------|-----------|
| **Básico Secundário** | 400 alunos | 35.000 AOA | 350.000 AOA (2 meses grátis) | 190.000 AOA |
| **Profissional Secundário** | 1.000 alunos | 60.000 AOA | 600.000 AOA | 330.000 AOA |
| **Enterprise Secundário** | Ilimitado | 90.000 AOA | 900.000 AOA | — |

**Inclui:** Gestão de Alunos, Professores, Notas, Frequência, Financeiro, Documentos. Planos superiores somam Comunicação, Analytics, API, Suporte prioritário.

---

## Planos – Ensino Superior (Universidades)

| Plano | Limite | Mensal | Anual |
|-------|--------|--------|-------|
| **Standard Superior** | 1.000 estudantes | 120.000 AOA | 1.200.000 AOA |
| **Profissional Superior** | 3.000 estudantes | 200.000 AOA | 2.000.000 AOA |
| **Enterprise Superior** | Ilimitado | 300.000–450.000 AOA | Negociado |

---

## Implementação técnica

### Schema (Prisma)

- `Plano.tipoAcademico` – `SECUNDARIO`, `SUPERIOR` ou `null` (legado)
- `Plano.limiteAlunos` – `null` = ilimitado
- `Plano.valorMensal`, `valorAnual`, `valorSemestral`
- `Plano.precoSecundario`, `precoUniversitario` – compatibilidade com planos legados

### Períodos de pagamento

- `MENSAL` – cobrança mensal
- `SEMESTRAL` – opção para Ensino Secundário
- `ANUAL` – cobrança anual

### Limite de alunos

- Usado em `license.middleware.ts` → `validatePlanLimits` ao criar alunos/professores
- `null` = ilimitado (planos Enterprise)

### Seed

```bash
cd backend
npx tsx scripts/seed-planos-comerciais.ts
```

O seed cria ou atualiza os 6 planos comerciais e desativa planos genéricos antigos (BASIC, PRO, ENTERPRISE).

---

## Fluxo comercial

1. **Landing (VendasLanding)** – listagem filtrada por tipo (Secundário/Universidade)
2. **Lead** – formulário de interesse
3. **Onboarding** – Super Admin cria instituição com `tipoAcademico` e associa plano
4. **Assinatura** – instituição fica vinculada a um plano com limites e preços
5. **Pagamento** – MENSAL, SEMESTRAL ou ANUAL, valor obtido do plano no banco
