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
| `excel_template_mode` | String? | PLACEHOLDER (default) \| CELL_MAPPING |
| `excel_cell_mapping_json` | Text? | Mapeamento célula→campo (modo CELL_MAPPING) |
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

1. Importar modelo: tipo **Mini Pauta**, formato **Excel**, carregar .xlsx
2. Placeholders nas células: `{{TABELA_ALUNOS}}`, `{{DISCIPLINA}}`, `{{TURMA}}`, `{{ANO_LETIVO}}`, `{{INSTITUICAO_NOME}}`
3. Modelo guardado para uso na emissão
4. **Preview**: quando o modelo é Excel, a pré-visualização converte a folha em HTML (preservando células mescladas) e gera PDF

### 5. Pauta de Conclusão em modo CELL_MAPPING (ficheiro oficial sem placeholders)

Quando o modelo Excel do governo **não pode ser alterado** (layout fixo, sem placeholders), use o modo `CELL_MAPPING`:

1. Importar modelo: tipo **Pauta de Conclusão**, formato **Excel**, carregar .xlsx do governo (sem alterar)
2. Modo: **Mapeamento por coordenadas**
3. Configurar JSON de mapeamento:

```json
{
  "sheetIndex": 0,
  "items": [
    { "cell": "B2", "campo": "instituicao.nome" },
    { "cell": "B3", "campo": "turma" },
    { "cell": "B4", "campo": "especialidade" },
    {
      "tipo": "LISTA",
      "startRow": 5,
      "columns": {
        "A": "student.n",
        "B": "student.fullName",
        "C": "student.numeroEstudante",
        "D": "nota.MAC",
        "E": "nota.NPP",
        "F": "nota.NPG",
        "G": "nota.MT1",
        "H": "nota.MT2",
        "I": "nota.MT3",
        "J": "nota.HA",
        "K": "nota.EX",
        "L": "nota.MFD",
        "M": "student.obs"
      }
    }
  ]
}
```

4. **Campos disponíveis**: `instituicao.nome`, `turma`, `especialidade`, `anoLetivo`, `classe` (global); por aluno: `student.fullName`, `student.numeroEstudante`, `student.n`, `student.obs`, `nota.MAC`, `nota.MT1`–`MT3`, `nota.EX`, `nota.MFD`, etc. Para múltiplas disciplinas: `nota.0.MAC`, `nota.1.MAC`, etc.
5. O sistema preenche as células diretamente **sem alterar estilos, bordas ou merges**.

---

## Fluxo de modelos e mapeamento

### Mini Pauta (por disciplina)

| Etapa | Modelo HTML | Modelo Excel |
|-------|-------------|--------------|
| Import | `htmlTemplate` com placeholders | `excelTemplateBase64` (.xlsx) |
| Variáveis | `montarVarsPauta()` → `TABELA_ALUNOS` (HTML `<tr>`), `DISCIPLINA`, `TURMA`, etc. | Mesmas variáveis |
| Preview | `preencherTemplateHtmlGenerico` → PDF | `excelToHtmlWithPlaceholders` → HTML com merges → PDF |
| Impressão | idem | `fillExcelTemplate` (se suportado) |

**Placeholders Mini Pauta:** `{{TABELA_ALUNOS}}` (linhas HTML), `{{DISCIPLINA}}`, `{{TURMA}}`, `{{ANO_LETIVO}}`, `{{LABEL_CURSO_CLASSE}}`, `{{VALOR_CURSO_CLASSE}}`, `{{PROFESSOR}}`, `{{TIPO_PAUTA}}`, `{{TOTAL_ESTUDANTES}}`.

### Pauta de Conclusão (modelo Saúde)

| Etapa | Descrição |
|-------|-----------|
| Dados | `getPautaConclusaoSaudeDados()` → alunos com `notas[disciplina]: { ca, cfd }` |
| Mapeamento | `pautaConclusaoToExcelData()` → `INSTITUICAO_NOME`, `TURMA`, `ESPECIALIDADE`, `ANO_LETIVO`, `TABELA_ALUNOS`, `DISCIPLINAS` |
| Excel | `fillExcelTemplate(modelo, dados)` substitui `{{CHAVE}}` em cada célula |
| Fallback | Se não houver modelo: `exportarPautaConclusaoSaudeExcel()` gera Excel do zero (colunas CA/CFD por disciplina) |

**Nota:** O modelo do governo Angola (Pauta Final) pode usar colunas como MAC, NPP1, NPP2, MT1–MT3, M.F., EX, M.F.D por disciplina. O mapeamento actual usa `CA` (avaliação contínua) e `CFD` (classificação final). Para alinhar ao modelo oficial, use `template_mappings`: `campoTemplate` = nome no Excel, `campoSistema` = campo do sistema (ex: `TABELA_ALUNOS`).

### Excel → HTML (preview)

- `excelSheetToHtml`, `excelToHtmlWithPlaceholders`, `excelSheetToHtmlWithPlaceholders`
- Usam `sheet['!merges']` para preservar `rowspan` e `colspan` (células mescladas)
- Células cobertas por merge não são renderizadas (valor na célula superior-esquerda)

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
