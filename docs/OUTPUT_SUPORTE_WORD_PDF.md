# DSICOLA — Suporte Word (DOCX) e PDF — OUTPUT

Resumo da implementação completa: funções principais, estruturas de dados, endpoints e componentes UI.

---

## 1. FUNÇÕES PRINCIPAIS (Backend)

### 1.1 Word (DOCX) — `docxDocument.service.ts`

| Função | Descrição |
|--------|-----------|
| `generateDocxFromTemplate(templateBuffer, data, options?)` | Carrega DOCX com PizZip, inicializa Docxtemplater, setData, render, gera buffer. Suporta `{{placeholder}}` e loops `{#array}...{/array}`. |
| `convertDocxToPdf(docxBuffer, landscape?)` | Converte DOCX→HTML (mammoth) → PDF (Puppeteer). Fallback retorna `null`. |

### 1.2 Word — `templateRender.service.ts`

| Função | Descrição |
|--------|-----------|
| `renderTemplate(params)` | Renderiza template DOCX do modelo (modeloDocumentoId) com dados. Usa templateMappings (campoTemplate→campoSistema). Retorna `{ buffer, format }`. |
| `extractPlaceholdersFromDocx(buffer)` | Extrai placeholders simples do document.xml. |
| `extractPlaceholdersAndLoopsFromDocx(buffer)` | Extrai placeholders e loops (`{#nome}→nome`) do DOCX. |

### 1.3 PDF — `pdfTemplate.service.ts`

| Função | Descrição |
|--------|-----------|
| `extractFormFieldsFromPdf(pdfBase64)` | Retorna `[{ fieldName, type }]` dos campos AcroForm do PDF. |
| `fillPdfFormFields(pdfBase64, data, mapping)` | Preenche campos AcroForm. `mapping`: `{ campoPDF: campoSistema }`. Faz `form.flatten()`. |
| `fillPdfWithCoordinates(pdfBase64, data, mapping)` | Desenha texto em (x, y) por página. `mapping.items`: `{ pageIndex, x, y, campo, fontSize? }`. Origen (0,0) no canto inferior-esquerdo. |

---

## 2. ESTRUTURA DE DADOS

### 2.1 Placeholders Word

```
{{student.fullName}}
{{student.birthDate}}
{{turma.nome}}
{{nota.MFD}}
```

### 2.2 Loops Word (docxtemplater)

```
{#alunos}
Nome: {{fullName}}
Data: {{birthDate}}
{/alunos}
```

`data` deve conter: `{ alunos: [{ fullName: '...', birthDate: '...' }, ...] }`

### 2.3 Mapeamento PDF — Formulário (FORM_FIELDS)

```json
{
  "Nome do Aluno": "student.fullName",
  "Data Nascimento": "student.birthDate",
  "Número Documento": "document.number"
}
```

### 2.4 Mapeamento PDF — Coordenadas (COORDINATES)

```json
{
  "items": [
    {
      "pageIndex": 0,
      "x": 120,
      "y": 450,
      "campo": "student.fullName",
      "fontSize": 11
    }
  ]
}
```

Sistema de coordenadas: origem (0,0) no canto **inferior-esquerdo**. A4 ≈ 595×842 pts.

### 2.5 ModeloDocumento (Prisma)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `formatoDocumento` | string? | HTML \| WORD \| PDF \| EXCEL |
| `docxTemplateBase64` | string? | Modelo DOCX base64 |
| `templatePlaceholdersJson` | string? | Array JSON de placeholders extraídos |
| `pdfTemplateBase64` | string? | Modelo PDF base64 |
| `pdfTemplateMode` | string? | FORM_FIELDS \| COORDINATES |
| `pdfMappingJson` | string? | Mapeamento JSON (form ou coordenadas) |

---

## 3. ENDPOINTS API

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/documents/generate-docx` | Gerar DOCX ou PDF a partir de template + dados | ADMIN, SECRETARIA, COORDENADOR, DIRECAO |
| POST | `/documents/generate-pdf-form` | Preencher PDF com campos de formulário | Idem |
| POST | `/documents/generate-pdf-coordinates` | Preencher PDF por coordenadas | Idem |
| POST | `/documents/extract-docx-placeholders` | Extrair placeholders (body: docxTemplateBase64) | ADMIN |
| POST | `/documents/extract-docx-placeholders-upload` | Extrair placeholders (multipart: file) | ADMIN |
| POST | `/documents/extract-pdf-fields` | Extrair campos AcroForm do PDF (body: pdfTemplateBase64) | ADMIN |
| POST | `/documents/extract-pdf-fields-upload` | Extrair campos PDF (multipart: file) | ADMIN |
| POST | `/documents/preview-docx` | Preview DOCX com dados mock | ADMIN, SECRETARIA, COORDENADOR, DIRECAO |

### Inputs

**generate-docx:**
```json
{
  "templateId": "uuid",
  "data": { "student": { "fullName": "..." }, ... },
  "outputFormat": "docx" | "pdf"
}
```

**generate-pdf-form:**
```json
{
  "templateId": "uuid",
  "data": { ... },
  "mapping": { "campoPDF": "campoSistema" }
}
```

**generate-pdf-coordinates:**
```json
{
  "templateId": "uuid",
  "data": { ... },
  "mapping": { "items": [{ "pageIndex": 0, "x": 120, "y": 450, "campo": "student.fullName" }] }
}
```

---

## 4. COMPONENTES UI

### 4.1 WordTemplateEditor.tsx

- **Upload DOCX**: ficheiro .docx, análise automática
- **Placeholders detectados**: lista badges com `{{placeholder}}`
- **Loops detectados**: badges com nomes dos arrays
- **Exemplos**: secção expansível com placeholders e exemplo de loop
- **Preview**: botão para gerar DOCX com dados mock e descarregar
- **Integração**: `documentsApi.extractDocxPlaceholdersUpload`, `documentsApi.previewDocx`

### 4.2 PdfMappingEditor.tsx

- **Modo FORM_FIELDS**: lista campos extraídos do PDF, mapeia cada um via Select (dropdown) aos campos do sistema
- **Modo COORDINATES**: tabela com (pageIndex, x, y, campo), botões Adicionar/Remover posição
- **Upload PDF**: carrega ficheiro, extrai campos (modo FORM) via `configuracoesInstituicaoApi.extractPdfFields`
- **Campos sistema**: `student.fullName`, `student.birthDate`, `instituicao.nome`, `document.number`, etc.

### 4.3 TemplateMappingDialog.tsx

- Mapeamento de placeholders DOCX para campos do sistema
- Lista placeholders e permite associar cada um a um campoSistema (Select)

### 4.4 ModelosDocumentosTab.tsx

- **Importar DOCX**: diálogo com nome, tipo, ficheiro. Usa `uploadTemplateDocx`. Abre TemplateMappingDialog se houver placeholders.
- **Importar PDF**: diálogo com nome, tipo, **modo (FORM_FIELDS | COORDINATES)**, ficheiro. Para FORM: extrai campos e mapeia. Para COORDINATES: usa PdfMappingEditor inline.
- **Tabela modelos**: ações Ver preview, Mapear (placeholders DOCX), Mapear células (Excel CELL_MAPPING)

---

## 5. DETECÇÃO AUTOMÁTICA

| Tipo | Método |
|------|--------|
| **Word** | Extração de `{{placeholder}}` e `{#array}...{/array}` do `word/document.xml` (regex) |
| **PDF** | `pdfDoc.getForm().getFields()` — nomes e tipos (text, checkbox, dropdown, radio) |

---

## 6. VALIDAÇÃO

- **Campos inexistentes**: `validarMapeamentosCampos` em `availableFields.service.ts` — compara mapeamentos com `getCamposValidosDocx()`
- **Dados vazios**: fallback `nullGetter: () => ''` no docxtemplater
- **Tamanho**: templates máx. 15 MB (base64 ou ficheiro)
- **Extensão**: .docx e .pdf validados no upload

---

## 7. SEGURANÇA

- JWT obrigatório; roles ADMIN, SECRETARIA, COORDENADOR, DIRECAO
- Multi-tenant: `instituicaoId` do JWT; modelos filtrados por instituição
- Validação de ficheiros (extensão, tamanho)
- Dados sanitizados em templates (escape em HTML)

---

## 8. FLUXO DE USO

1. **Word (Certificado/Declaração)**: Admin faz upload de DOCX com placeholders → Sistema detecta → Admin mapeia (TemplateMappingDialog) → Na emissão, `documento.service` usa `renderTemplate` → PDF
2. **PDF com Campos**: Admin faz upload de PDF fillable → Extrai campos → Mapeia no diálogo → Na emissão, `fillPdfFormFields`
3. **PDF Estático**: Admin faz upload de PDF → Modo COORDINATES → Define (pageIndex, x, y, campo) → Na emissão, `fillPdfWithCoordinates`
