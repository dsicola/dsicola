# Arquitetura — Suporte a Documentos Word (DOCX) e PDF

Sistema DSICOLA — geração automática de certificados, declarações e documentos oficiais.

---

## 1. Visão Geral

O sistema suporta **3 tipos de templates**:

| Tipo   | Modo           | Biblioteca   | Interface                    |
|--------|----------------|--------------|------------------------------|
| EXCEL  | CELL_MAPPING   | xlsx         | ExcelMappingEditor.tsx       |
| WORD   | PLACEHOLDERS   | docxtemplater + pizzip | WordTemplateEditor.tsx |
| PDF    | FORM_FIELDS / COORDINATES | pdf-lib | PdfMappingEditor.tsx        |

---

## 2. Funções Principais (Backend)

### 2.1 Word (DOCX)

```typescript
// docxDocument.service.ts
function generateDocxFromTemplate(
  templateBuffer: Buffer,
  data: Record<string, unknown>,
  options?: { delimiters?: { start: string; end: string }; outputFormat?: 'docx' | 'pdf' }
): Buffer

async function convertDocxToPdf(docxBuffer: Buffer, landscape?: boolean): Promise<Buffer | null>
```

**templateRender.service.ts** (existente, integrado):
- `renderTemplate(params)` — por `modeloDocumentoId`
- `extractPlaceholdersFromDocx(buffer)` — placeholders simples
- `extractPlaceholdersAndLoopsFromDocx(buffer)` — placeholders + loops `{#array}`

### 2.2 PDF — Modo Formulário

```typescript
// pdfTemplate.service.ts
async function extractFormFieldsFromPdf(pdfBase64: string): Promise<{ fieldName: string; type: string }[]>

async function fillPdfFormFields(
  pdfBase64: string,
  data: Record<string, unknown>,
  mapping: PdfFormMapping
): Promise<Buffer>
```

### 2.3 PDF — Modo Coordenadas

```typescript
// pdfTemplate.service.ts
async function fillPdfWithCoordinates(
  pdfBase64: string,
  data: Record<string, unknown>,
  mapping: PdfCoordinateMapping
): Promise<Buffer>
```

---

## 3. Estruturas de Dados

### 3.1 Placeholders Word

```
{{student.fullName}}
{{student.birthDate}}
{{turma.nome}}
{{nota.MFD}}
```

### 3.2 Loops Word (docxtemplater)

```
{#alunos}
Nome: {{fullName}}
Data: {{birthDate}}
{/alunos}
```

`data` deve conter: `{ alunos: [{ fullName: '...', birthDate: '...' }, ...] }`

### 3.3 Mapeamento PDF — Formulário

```json
{
  "Nome do Aluno": "student.fullName",
  "Data Nascimento": "student.birthDate",
  "Número Documento": "document.number"
}
```

### 3.4 Mapeamento PDF — Coordenadas

```json
{
  "tipo": "COORDINATES",
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

---

## 4. Endpoints API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/documents/generate-docx` | Gerar DOCX (ou PDF) a partir de template + dados |
| POST | `/documents/generate-pdf-form` | Preencher PDF com campos de formulário |
| POST | `/documents/generate-pdf-coordinates` | Preencher PDF por coordenadas |
| POST | `/documents/extract-docx-placeholders` | Extrair placeholders (body: `docxTemplateBase64`) |
| POST | `/documents/extract-docx-placeholders-upload` | Extrair placeholders (multipart: `file`) |
| POST | `/documents/preview-docx` | Preview DOCX com dados mock |

### Inputs Comuns

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

## 5. Componentes UI

### 5.1 WordTemplateEditor.tsx

- Upload DOCX
- Listar placeholders e loops detectados
- Secção de ajuda com exemplos
- Botão de preview com dados mock
- Integração com `documentsApi.extractDocxPlaceholdersUpload` e `previewDocx`

### 5.2 PdfMappingEditor.tsx

- **Modo FORM_FIELDS:** listar campos extraídos, mapear via dropdown aos campos do sistema
- **Modo COORDINATES:** tabela para definir (pageIndex, x, y, campo); adicionar/remover posições

### 5.3 TemplateMappingDialog.tsx (existente)

- Mapeamento de placeholders DOCX para campos do sistema
- Drag & drop: campo sistema → placeholder

---

## 6. Segurança

- **Validação de ficheiros:** extensão .docx / .pdf; tamanho máximo 15 MB
- **Autenticação:** JWT obrigatório; roles ADMIN, SECRETARIA, COORDENADOR, DIRECAO
- **Multi-tenant:** `instituicaoId` do token; modelos filtrados por instituição

---

## 7. Fluxo de Uso

1. **Word (Certificado/Declaração)**
   - Admin faz upload de DOCX com placeholders
   - Sistema detecta `{{student.fullName}}`, etc.
   - Admin mapeia placeholders (TemplateMappingDialog) ou usa dados diretos
   - Na emissão, `documento.service` usa `renderTemplate` → PDF

2. **PDF com Campos**
   - Admin faz upload de PDF (formulário AcroForm)
   - Sistema extrai campos (`extractFormFieldsFromPdf`)
   - Admin mapeia cada campo no PdfMappingEditor (modo FORM)
   - Na emissão, `fillPdfFormFields` preenche e devolve PDF

3. **PDF Estático**
   - Admin faz upload de PDF sem campos
   - Admin define posições (x, y) para cada dado no PdfMappingEditor (modo COORDINATES)
   - Na emissão, `fillPdfWithCoordinates` desenha texto e devolve PDF
