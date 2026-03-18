# Verificação UI - Modelos de Documentos e Mapeamento Excel

## Checklist de visibilidade

Use este documento para confirmar que todos os elementos da UI estão visíveis.

---

## 1. Página Modelos de Documentos
**Rota:** `/admin-dashboard/certificados?tab=modelos&subtab=importados`

| Elemento | data-testid | Visível |
|----------|-------------|---------|
| Botão Importar modelo (Excel / HTML) | `btn-importar-modelo-excel-html` | ☐ |
| Botão Importar DOCX (Word) | `btn-importar-docx` | ☐ |
| Tabela de modelos (ou "Nenhum modelo importado") | — | ☐ |
| Aba Importados / Certificados / Declarações / Pautas | — | ☐ |
| Secção "Como utilizar (passo a passo)" colapsável | — | ☐ |

---

## 2. Diálogo Importar modelo

| Elemento | data-testid | Visível |
|----------|-------------|---------|
| Título "Importar modelo" ou "Editar modelo" | — | ☐ |
| Select Tipo de documento | — | ☐ |
| Select Formato (Excel, HTML, Word, PDF) | — | ☐ |
| Input Modelo Excel (.xlsx) | `modelo-excel-file-input` | ☐ |
| Mensagem "Modelo Excel carregado" | — | ☐ |
| Select Modo de preenchimento (Placeholders / Mapeamento por coordenadas) | — | ☐ |
| Botão Guardar / Importar | — | ☐ |
| Botão Cancelar | — | ☐ |

---

## 3. ExcelMappingEditor (modo CELL_MAPPING)
*Aparece quando: tipo Excel + modo "Mapeamento por coordenadas"*

| Elemento | data-testid | Visível |
|----------|-------------|---------|
| Container do editor | `excel-mapping-editor` | ☐ |
| Toolbar | `excel-mapping-toolbar` | ☐ |
| Botão Sugerir mapeamento | `btn-sugerir-mapeamento` | ☐ |
| Botão Validar | `btn-validar` | ☐ |
| Botão Preview (só Pauta Conclusão) | `btn-preview-excel` | ☐ |
| Botão Limpar mapeamento | `btn-limpar-mapeamento` | ☐ |
| Controlos Zoom (+ / -) | — | ☐ |
| Grid Excel (tabela A, B, C... / 1, 2, 3...) | `excel-grid-container` | ☐ |
| Barra lateral (campos do sistema) | `excel-mapping-sidebar` | ☐ |
| Campo de busca na sidebar | — | ☐ |
| Botão Definir como início da lista | `btn-definir-inicio-lista` | ☐ |
| Lista de campos por categoria | — | ☐ |

---

## 4. Acções por modelo (na tabela)

| Tipo de modelo | Botão | data-testid | Visível |
|----------------|-------|-------------|---------|
| Certificado, Declaração | Ver (Eye) | — | ☐ |
| Certificado, Declaração (com placeholders) | Mapear | — | ☐ |
| Mini Pauta | Preview Provisória / Definitiva | — | ☐ |
| Pauta, Boletim, Mini Pauta | **Mapear células** | `btn-mapear-cellulas` | ☐ |
| Qualquer | Editar (lápis) | — | ☐ |
| Qualquer | Remover (lixo) | — | ☐ |

---

## 5. Diálogo Importar DOCX

| Elemento | Visível |
|----------|---------|
| Título "Importar modelo DOCX" | ☐ |
| Campo Nome do modelo | ☐ |
| Select Tipo de documento | ☐ |
| Input Ficheiro DOCX | ☐ |
| Botão Importar | ☐ |
| Botão Cancelar | ☐ |

---

## Como executar teste E2E

```bash
# Com servidor já a correr em localhost:8080:
cd frontend && E2E_SKIP_WEB_SERVER=1 npm run test:e2e:modelos-mapeamento

# Ou deixar o Playwright iniciar o servidor:
cd frontend && npm run test:e2e:modelos-mapeamento
```

**Pré-requisitos:**
- Backend a correr
- Seeds: `npx tsx backend/scripts/seed-multi-tenant-test.ts`
- Seeds perfis: `npx tsx backend/scripts/seed-perfis-completos.ts`
- Navegadores Playwright: `cd frontend && npx playwright install chromium`
- Fixture Excel: `frontend/e2e/fixtures/test-pauta-conclusao.xlsx` (gerar com `node e2e/fixtures/create-test-excel.cjs`)

---

## Prontidão para Produção (testes automatizados)

### Fluxo completo de testes backend (40 testes)

```bash
cd backend
npm run test:fluxo-documentos:full
```

Cobre:
- **modelos-documento-multitenant** (15): CRUD, multi-tenant, getModeloDocumentoAtivo, preview Certificado, preview Mini Pauta
- **template-mapping-multitenant** (14): extractPlaceholders, saveMapping, renderTemplate, validação
- **modelos-documento-excel-mapping** (11): extractPlaceholdersFromExcel, fillExcelTemplate, CELL_MAPPING, validateCellMapping

### Fluxo E2E (Playwright)

```bash
# Opção 1: Script completo (inicia backend + frontend se necessário)
./scripts/run-e2e-modelos-mapeamento.sh

# Opção 2: Com servidores já a correr
cd frontend
E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://localhost:8080 npx playwright test e2e/modelos-mapeamento-documentos.spec.ts --project=chromium
```

**Nota:** Antes da primeira execução E2E, instale os navegadores: `cd frontend && npx playwright install chromium`

---

## Resumo

Todos os elementos listados devem estar visíveis quando as condições de exibição são cumpridas (ex.: ExcelMappingEditor só aparece com Excel carregado e modo CELL_MAPPING).
