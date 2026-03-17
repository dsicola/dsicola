# Modelos Governamentais – Implementação Completa

## Resultado esperado

Após implementação, o sistema permite:

1. **Importar modelo oficial do governo** (PDF, DOCX, HTML, Excel)
2. **Mapear campos via interface** (drag & drop para DOCX)
3. **Gerar documento final 100% igual ao modelo original**
4. **Preenchimento automático** com dados do sistema

---

## Estrutura das tabelas

### `modelos_documento`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `instituicao_id` | UUID (FK) | Multi-tenant |
| `tipo` | String | CERTIFICADO, DECLARACAO_MATRICULA, DECLARACAO_FREQUENCIA, MINI_PAUTA, PAUTA_CONCLUSAO, BOLETIM |
| `tipo_academico` | String? | SUPERIOR \| SECUNDARIO |
| `curso_id` | UUID? | Vinculação opcional a curso |
| `nome` | String | Identificação do modelo |
| `descricao` | String? | Opcional |
| `html_template` | Text | HTML com placeholders {{CHAVE}} |
| `formato_documento` | String? | HTML, WORD, PDF, EXCEL |
| `excel_template_base64` | Text? | Modelo Excel (.xlsx) em base64 |
| `docx_template_base64` | Text? | Modelo Word (.docx) em base64 |
| `template_placeholders_json` | Text? | Placeholders extraídos (DOCX) |
| `ativo` | Boolean | Modelo em uso |

### `template_mappings`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `modelo_documento_id` | UUID (FK) | Referência ao modelo |
| `campo_template` | String | Placeholder no template (ex: `nome`) |
| `campo_sistema` | String | Caminho dos dados (ex: `student.fullName`) |

---

## Serviços criados/alterados

### 1. `excelTemplate.service.ts` (NOVO)

```typescript
// Preenche modelo Excel substituindo {{PLACEHOLDER}} nas células
fillExcelTemplate(excelTemplateBase64: string, data: Record<string, string | number | null | undefined>): Buffer

// Converte dados do boletim para mapa de placeholders
boletimToExcelData(boletim: BoletimAluno): Record<string, string>

// Converte dados da pauta conclusão para mapa de placeholders
pautaConclusaoToExcelData(dados: PautaConclusaoSaudeDados): Record<string, string>
```

### 2. `documentoTemplateGeneric.service.ts` (alterado)

```typescript
// Converte PayloadDocumento para formato docxtemplater (student.fullName, etc.)
payloadToTemplateData(payload, tipo, tipoAcademico): Record<string, unknown>
```

### 3. `documento.service.ts` (alterado)

- Em `gerarPDFDocumentoComModelo`: prioriza `docxTemplateBase64` para Cert/Decl
- Fluxo DOCX: `payloadToTemplateData` → `renderTemplate` → PDF (ou DOCX→HTML→PDF)

### 4. `modeloDocumento.service.ts` (alterado)

- Inclusão de `BOLETIM` em `TipoModeloDocumento`

### 5. `templateRender.service.ts` (existente)

- Renderiza DOCX com docxtemplater + mappings
- Suporta PDF via conversão DOCX→HTML→PDF

---

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/relatorios-oficiais/boletim/:alunoId?format=excel` | Boletim em Excel (modelo governo) |
| GET | `/configuracoes-instituicao/pauta-conclusao-saude-export-excel?turmaId=` | Pauta Conclusão em Excel (modelo governo) |
| POST | `/configuracoes-instituicao/modelos-documento` | Criar modelo (HTML, Excel, DOCX) |
| POST | `/configuracoes-instituicao/modelos-documento/:id/mapping` | Salvar mapeamentos |
| POST | `/configuracoes-instituicao/modelos-documento/:id/render` | Gerar DOCX/PDF com dados |
| POST | `/configuracoes-instituicao/templates/upload` | Upload DOCX com extração de placeholders |

---

## Exemplos de uso

### 1. Certificado/Declaração em DOCX

1. Admin → Configurações → Modelos de Documentos
2. Importar DOCX (botão "Importar DOCX")
3. Mapear placeholders no diálogo drag & drop
4. Na emissão de certificado/declaração, o sistema usa o modelo DOCX se existir

**Placeholders no DOCX:** `{nome}`, `{student.fullName}`, `{instituicao.nome}`, etc.

### 2. Boletim em Excel

1. Importar modelo: tipo **Boletim**, formato **Excel**, carregar .xlsx
2. No modelo: células com `{{NOME_ALUNO}}`, `{{ANO_LETIVO}}`, `{{DISCIPLINA_1}}`, `{{NOTA_1}}`, etc.
3. API: `GET /relatorios-oficiais/boletim/:alunoId?format=excel` retorna ficheiro preenchido

**Exemplo de células no Excel:**

| Célula | Conteúdo |
|--------|----------|
| B3 | `{{NOME_ALUNO}}` |
| B4 | `{{NUMERO_ESTUDANTE}}` |
| B5 | `{{ANO_LETIVO}}` |
| C10 | `{{DISCIPLINA_1}}` |
| D10 | `{{NOTA_1}}` |

### 3. Pauta de Conclusão em Excel

1. Importar modelo: tipo **Pauta de Conclusão**, formato **Excel**
2. Placeholders: `{{INSTITUICAO_NOME}}`, `{{TURMA}}`, `{{ESPECIALIDADE}}`, `{{ANO_LETIVO}}`, `{{TABELA_ALUNOS}}`, `{{DISCIPLINAS}}`
3. API: `GET /configuracoes-instituicao/pauta-conclusao-saude-export-excel?turmaId=xxx`

### 4. Mini Pauta em Excel

1. Importar modelo: tipo **Mini Pauta**, formato **Excel**
2. Placeholders nas células: `{{TABELA_ALUNOS}}`, `{{DISCIPLINA}}`, `{{TURMA}}`, `{{ANO_LETIVO}}`, `{{INSTITUICAO_NOME}}`
3. Modelo guardado para uso na emissão

---

## Fluxo de dados (resumo)

```
[Modelo Gov.] → Import → modelo_documento (+ template_mappings para DOCX)
                          ↓
[Emissão]    → getModeloDocumentoAtivo(tipo, instituicaoId)
                          ↓
              → DOCX?  → payloadToTemplateData → renderTemplate → PDF
              → HTML?  → montarVarsBasicas → preencherTemplateHtmlGenerico → PDF
              → Excel? → fillExcelTemplate(boletimToExcelData | pautaConclusaoToExcelData) → .xlsx
```

---

## Formatos suportados

| Documento | Formatos importáveis | Mapeamento | Output |
|-----------|----------------------|------------|--------|
| Certificado | HTML, PDF, Word, DOCX | Placeholders / Drag & Drop | PDF |
| Declaração | HTML, PDF, Word, DOCX | Placeholders / Drag & Drop | PDF |
| Mini Pauta | Excel | {{TABELA_ALUNOS}}, {{DISCIPLINA}}, etc. | Excel |
| Boletim | Excel | {{NOME_ALUNO}}, {{NOTA_1}}, etc. | Excel |
| Pauta Conclusão | Excel | {{INSTITUICAO_NOME}}, etc. | Excel |
