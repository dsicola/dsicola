# Plano de Teste: Sistema Completo Superior + Secundário (Produção)

> **Objetivo:** Garantir zero bugs e zero inconsistências entre os dois tipos de instituição, com cobertura profissional e pronta para produção.

---

## 1. Estratégia em 3 Camadas

| Camada | Ferramenta | O que valida | Quando executar |
|--------|------------|--------------|-----------------|
| **Unit** | Vitest | Lógica isolada (cálculo notas, validações) | A cada commit |
| **Integração** | Scripts tsx (API) | Backend completo, multi-tenant, Sec vs Sup | PR, nightly |
| **E2E** | Playwright | UI completa, fluxos reais, Sec vs Sup | PR, release |

---

## 2. Matriz de Cobertura Secundário vs Superior

### 2.1 Campos e Fluxos por Tipo

| Área | Secundário | Superior | Teste que valida |
|------|------------|----------|------------------|
| **JWT** | `tipoAcademico: SECUNDARIO` | `tipoAcademico: SUPERIOR` | `test:diferenciacao-sec-sup` |
| **Semestres** | Array vazio / 403 | Disponível (2/ano) | `test:diferenciacao-sec-sup` |
| **Trimestres** | Disponível (3/ano) | Array vazio / 403 | `test:diferenciacao-sec-sup` |
| **Classes** | CRUD disponível | Bloqueado ou vazio | `test:diferenciacao-sec-sup` |
| **Cursos** | Ambos | Ambos | `test:fluxo-planos-secundario-superior` |
| **Plano de Ensino** | `classeId` + `classeOuAno` | `cursoId` + `semestreId` | `test:plano-ensino-completo:full` |
| **Turmas** | `classeId` obrigatório | `cursoId` + semestre | `test:matricula-turma-disciplina` |
| **Matrícula anual** | `classeId`, `classeOuAnoCurso` | `cursoId`, ano (1º–6º) | `test:matricula-turma-disciplina` |
| **Cálculo notas** | Trimestral (3 notas) | MP + Recurso | `test:fluxo-notas-completo` |
| **Presenças** | Classes | Cursos + Semestre | `test:professor-fluxo-completo` |
| **Conclusão curso** | Certificado (classe) | Colação de grau (curso) | `test:emitir-documento` |
| **Recibos** | Campos Secundário | Campos Superior (IVA, série) | `test:recibo-completo` |
| **Horários** | Blocos 45 min fixos | Blocos livres | `test:horarios:sugestoes:secundario-superior:full` |

### 2.2 Inconsistências a Evitar (Regressão)

- [ ] Secundário ver Semestre em qualquer formulário
- [ ] Superior ver Classe ou Trimestre em formulários acadêmicos
- [ ] Cálculo de notas Secundário usar MP/Recurso
- [ ] Cálculo de notas Superior usar trimestres
- [ ] JWT sem `tipoAcademico` ou valor inválido
- [ ] API retornar dados da instituição errada (multi-tenant)
- [ ] Documentos (Declaração/Certificado) com campos trocados

---

## 3. Suite de Testes Backend (Integração)

### 3.1 Comando Principal (Produção)

```bash
cd backend
npm run test:suite-producao
```

Inclui: multi-tenant, diferenciação Sec/Sup, perfis, académico, financeiro, segurança.

### 3.2 Testes Específicos Secundário + Superior

```bash
# 1. Diferenciação (JWT, semestres, trimestres, classes)
npm run test:diferenciacao-sec-sup

# 2. Planos e limites (ambos tipos)
npm run test:fluxo-planos-secundario-superior

# 3. Plano de Ensino completo (Sec + Sup)
npm run test:plano-ensino-completo:full

# 4. Matrícula e turma (Sec + Sup)
npm run test:matricula-turma-disciplina

# 5. Recibos (Sec + Sup)
npm run test:recibo-completo

# 6. Horários e sugestões (Sec + Sup)
npm run test:horarios:sugestoes:secundario-superior:full

# 7. Plano Ensino fluxo Secundário
npm run test:plano-ensino-fluxo-secundario

# 8. Plano Ensino fluxo Superior
npm run test:plano-ensino-fluxo-superior
```

### 3.3 Pré-requisito Obrigatório

```bash
npx tsx scripts/seed-multi-tenant-test.ts
npx tsx scripts/seed-perfis-completos.ts
```

Inst A = Secundário, Inst B = Superior. Credenciais em `frontend/e2e/fixtures/auth.ts`.

---

## 4. Suite E2E (Playwright)

### 4.1 Comando Principal

```bash
cd frontend
npm run test:e2e:full-system
```

Cobre: Inst A (Secundário) e Inst B (Superior) para Admin, Professor, Aluno, Secretaria, POS, Responsável.

### 4.2 Testes de Documentos (Sec + Sup)

```bash
npm run test:e2e -- e2e/documentos-folha-e2e.spec.ts
```

Valida emissão de Declaração/Certificado em ambos os tipos.

### 4.3 E2E Sec vs Sup (novo)

```bash
npm run test:e2e -- e2e/secundario-superior-ui.spec.ts
```

Valida: Tab Classes (Sec), Tab Candidaturas (Sup), Plano de Ensino Classe vs Semestre.

### 4.4 Gaps E2E a Implementar

| Teste | Descrição | Prioridade |
|-------|-----------|------------|
| ~~**Secundário: Classes visíveis**~~ | ✅ `secundario-superior-ui.spec.ts` | — |
| ~~**Superior: Classes ocultas**~~ | ✅ `secundario-superior-ui.spec.ts` | — |
| ~~**Secundário: Plano com Classe**~~ | ✅ `secundario-superior-ui.spec.ts` | — |
| ~~**Superior: Plano com Semestre**~~ | ✅ `secundario-superior-ui.spec.ts` | — |
| **Secundário: Trimestre em notas** | Avaliações e notas (disciplina) → Filtro Trimestre | Alta |
| **Superior: Semestre em notas** | Avaliações e notas (disciplina) → Filtro Semestre | Alta |
| **Presenças Sec: filtro Classe** | Controle Presenças → Dropdown Classes | Média |
| **Presenças Sup: filtro Curso** | Controle Presenças → Dropdown Cursos | Média |
| **Aluno Sec: boletim trimestral** | Painel Aluno → Boletim com colunas Tri | Média |
| **Aluno Sup: boletim semestral** | Painel Aluno → Boletim com colunas Sem | Média |

---

## 5. Testes Unitários (Vitest)

### 5.1 Serviços Críticos a Testar

| Serviço | Casos | Comando |
|---------|-------|---------|
| `calculoNota.service` | `calcularSecundario` vs `calcularSuperior` | `npm run test` |
| `duracaoHoraAula` | 45 min (Sec) vs 60 min (Sup) | `npm run test` |
| `validacaoAcademica` | Rejeitar semestre em Sec, trimestre em Sup | `npm run test` |
| `bloqueioAcademico` | Regras curso/classe por tipo | `npm run test` |

### 5.2 Exemplo de Teste Unitário

```typescript
// backend/src/__tests__/calculoNota-secundario-superior.test.ts
describe('calculoNota', () => {
  it('Secundário: média trimestral', () => {
    const resultado = calcularSecundario([8, 7, 9]);
    expect(resultado.media).toBe(8);
  });
  it('Superior: MP + Recurso', () => {
    const resultado = calcularSuperior({ p1: 10, p2: 8, p3: 9, trabalho: 7 });
    expect(resultado.mediaParcial).toBeDefined();
  });
});
```

---

## 6. Checklist de Release (Produção)

### 6.1 Antes de Cada Release

```bash
# 1. Seed
cd backend && npx tsx scripts/seed-multi-tenant-test.ts
npx tsx scripts/seed-perfis-completos.ts

# 2. Suite backend
npm run test:suite-producao

# 3. Unitários
npm run test

# 4. E2E (frontend + backend rodando)
cd ../frontend && npm run test:e2e:full-system
npm run test:e2e -- e2e/documentos-folha-e2e.spec.ts
```

### 6.2 Checklist Manual (1x por release)

- [ ] Login Admin Inst A → ver "Classes" em Gestão Acadêmica
- [ ] Login Admin Inst B → NÃO ver "Classes"
- [ ] Inst A: criar Plano de Ensino com Classe
- [ ] Inst B: criar Plano de Ensino com Semestre
- [ ] Inst A: Controle Presenças → filtro por Classe
- [ ] Inst B: Controle Presenças → filtro por Curso
- [ ] Aluno Inst A: boletim com Trimestres
- [ ] Aluno Inst B: boletim com Semestre
- [ ] Emitir Declaração Inst A e Inst B → PDF correto
- [ ] Recibo Inst A (Sec) e Inst B (Sup) → campos corretos

---

## 7. CI/CD (Recomendação)

### 7.1 Pipeline Sugerido

```yaml
# Exemplo GitHub Actions
jobs:
  backend-tests:
    - run: npm run test          # Unit
    - run: npm run seed:multi-tenant
    - run: npm run test:suite-producao
  e2e:
    needs: [backend-tests]
    - run: npm run dev &          # Backend
    - run: cd frontend && npm run test:e2e:full-system
```

### 7.2 Smoke Test Rápido (< 2 min)

```bash
npm run test:diferenciacao-sec-sup
npm run test:e2e:auth
```

---

## 8. Resumo de Comandos

| Objetivo | Comando |
|----------|---------|
| **Suite completa produção** | `cd backend && npm run test:suite-producao` |
| **Só Sec vs Sup** | `npm run test:diferenciacao-sec-sup` |
| **E2E full system** | `cd frontend && npm run test:e2e:full-system` |
| **E2E Sec vs Sup UI** | `cd frontend && npm run test:e2e -- e2e/secundario-superior-ui.spec.ts` |
| **Suite Sec+Sup (backend)** | `cd backend && npm run test:producao-sec-sup` |
| **Documentos Sec+Sup** | `cd frontend && npm run test:e2e -- e2e/documentos-folha-e2e.spec.ts` |
| **Plano Ensino completo** | `npm run test:plano-ensino-completo:full` |
| **Recibos Sec+Sup** | `npm run test:recibo-completo` |

---

## 9. Gaps Conhecidos (a resolver)

1. **E2E**: Falta validação explícita de UI Sec vs Sup (Classes, Trimestre, Semestre)
2. **Unit**: Cobertura de `calculoNota` e `duracaoHoraAula` por tipo
3. **Inscrição pública**: Fluxo diferenciado Sec vs Sup (ver CHECKLIST_DIFERENCIACAO_SECUNDARIO_SUPERIOR.md)
4. **Teste de regressão visual**: Screenshots Sec vs Sup em páginas críticas

---

## 10. Referências

- `CHECKLIST_DIFERENCIACAO_SECUNDARIO_SUPERIOR.md` — Checklist manual
- `docs/PLANO_TESTE_DSICOLA.md` — Plano geral
- `frontend/e2e/fixtures/auth.ts` — Credenciais E2E
- `backend/scripts/seed-multi-tenant-test.ts` — Dados de teste
