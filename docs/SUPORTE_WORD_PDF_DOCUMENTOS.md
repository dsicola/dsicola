# Suporte a Documentos Word (DOCX) e PDF

**Data:** 18 de Março de 2025  
**Sistema:** DSICOLA

---

## Resumo

O DSICOLA passa a suportar:

- **Word (DOCX):** placeholders `{campo}` e `{{campo}}`, substituição com dados reais, export para PDF
- **PDF:** modo formulário (AcroForm) e modo coordenadas (x,y)

Multi-tenant e tipos de instituição (Superior/Secundário) preservados.

---

## 1. Word (DOCX)

### Funcionalidade existente (reforçada)

- **Biblioteca:** docxtemplater + PizZip
- **Placeholders:** `{nome}`, `{student.fullName}`, `{instituicao.nome}`, etc.
- **Novo:** suporte a `{{campo}}` (deteção automática no documento)
- **Mapeamento:** TemplateMapping (campoTemplate → campoSistema)
- **Export PDF:** via mammoth (DOCX→HTML) + Puppeteer (HTML→PDF)

### Fluxo

1. Admin → Modelos → **Importar DOCX**
2. Ficheiro .docx com placeholders (ex: `{nome}`, `{{student.fullName}}`)
3. Sistema extrai placeholders automaticamente
4. Clicar em **Mapear** para associar placeholder → campo do sistema
5. Na emissão: documento preenchido em DOCX ou PDF

### Campos disponíveis (payloadToTemplateData)

- `student.fullName`, `student.birthDate`, `student.bi`, `student.numeroEstudante`, `student.curso`, `student.classe`, `student.turma`, `student.anoLetivo`
- `instituicao.nome`, `instituicao.nif`, `instituicao.endereco`
- `document.number`, `document.codigoVerificacao`, `document.dataEmissao`

---

## 2. PDF

### Modo 1: FORM_FIELDS (formulário fillable)

- PDF com campos AcroForm (texto, checkbox, dropdown, radio)
- Deteção de campos via `extractFormFieldsFromPdf`
- Mapeamento: `{ "nomeCampoPdf": "student.fullName" }`
- Preenchimento: `fillPdfFormFields` (pdf-lib)

### Modo 2: COORDINATES

- Desenho de texto em posições (x, y) por página
- Mapeamento: `{ "items": [{ "pageIndex": 0, "x": 100, "y": 700, "campo": "student.fullName", "fontSize": 11 }] }`
- Preenchimento: `fillPdfWithCoordinates`

### Fluxo UI

1. Admin → Modelos → **Importar PDF**
2. Selecionar ficheiro PDF fillable
3. Clicar em **Extrair campos do PDF**
4. Mapear cada campo PDF ao campo do sistema (dropdown)
5. Indicar tipo (Certificado, Declaração Matrícula/Frequência) e nível (Superior/Secundário)
6. Importar

### API

- `POST /configuracoes-instituicao/modelos-documento/extract-pdf-fields`  
  Body: `{ pdfTemplateBase64 }`  
  Retorna: `{ fields: [{ fieldName, type }] }`

### Integração em documento.service

Em `gerarPDFDocumentoComModelo`, quando o modelo tem `pdfTemplateBase64` e `pdfMappingJson`:

1. Usa `payloadToTemplateData` para obter os dados
2. Se `pdfTemplateMode === 'COORDINATES'` → `fillPdfWithCoordinates`
3. Caso contrário → `fillPdfFormFields`
4. Retorna o PDF preenchido

---

## 3. Schema (modelos_documento)

Campos novos:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `pdf_template_base64` | TEXT | PDF fillable em base64 |
| `pdf_template_mode` | TEXT | FORM_FIELDS (default) ou COORDINATES |
| `pdf_mapping_json` | TEXT | Mapeamento em JSON |

---

## 4. Multi-tenant e tipos de instituição

- `instituicaoId` do JWT em todas as operações
- `tipoAcademico` (SUPERIOR/SECUNDARIO) no modelo e no payload
- `getModeloDocumentoAtivo` filtra por instituição e tipo académico
- Isolamento entre instituições preservado

---

## 5. Limites de tamanho

- Excel: 15 MB (base64)
- PDF: usa `validateExcelTemplateSize` (15 MB)
- DOCX: 5 MB (multer no upload)

---

## 6. Exemplos de mapeamento PDF

### Modo FORM_FIELDS

```json
{
  "NomeCompleto": "student.fullName",
  "NumeroEstudante": "student.numeroEstudante",
  "NomeInstituicao": "instituicao.nome",
  "NumeroDocumento": "document.number"
}
```

### Modo COORDINATES

```json
{
  "items": [
    { "pageIndex": 0, "x": 120, "y": 650, "campo": "student.fullName", "fontSize": 12 },
    { "pageIndex": 0, "x": 120, "y": 620, "campo": "instituicao.nome", "fontSize": 10 }
  ]
}
```

Coordenadas: origem no canto inferior-esquerdo da página; `y` é convertido internamente para `height - y`.
