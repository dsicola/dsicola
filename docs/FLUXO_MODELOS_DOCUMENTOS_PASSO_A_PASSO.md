# Fluxo de Modelos de Documentos — Passo a Passo

**Guia didático para Admin e Secretaria**  
Este documento ensina como importar, configurar e usar modelos oficiais (Certificados, Declarações, Pautas, Boletins) no DSICOLA.

---

## Índice

0. [Fluxo completo — do início ao fim](#0-fluxo-completo--do-início-ao-fim)
1. [Visão geral](#1-visão-geral)
2. [Onde aceder](#2-onde-aceder)
3. [Modos de preenchimento Excel](#3-modos-de-preenchimento-excel)
4. [Passo 1 — Modelo HTML (Certificado/Declaração)](#4-passo-1--modelo-html-certificadodeclaração)
5. [Passo 2 — Modelo Excel com placeholders (PLACEHOLDER)](#5-passo-2--modelo-excel-com-placeholders-placeholder)
6. [Passo 3 — Modelo Excel por coordenadas (CELL_MAPPING)](#6-passo-3--modelo-excel-por-coordenadas-cell_mapping)
7. [Passo 4 — Gerar/exportar documentos](#7-passo-4--gerarexportar-documentos)
8. [Resumo e resolução de problemas](#8-resumo-e-resolução-de-problemas)

---

## 0. Fluxo completo — do início ao fim

Segue um resumo do fluxo completo para cada tipo de documento. Use como guia rápido.

**Pré-requisito:** Para Pauta de Conclusão e Boletim com dados reais, é necessário que o fluxo académico esteja concluído (planos de ensino, notas lançadas, frequências). Consulte [FLUXO_ACADEMICO_COMPLETO_PASSO_A_PASSO.md](FLUXO_ACADEMICO_COMPLETO_PASSO_A_PASSO.md).

### Pauta de Conclusão (Excel)

| Nº | Ação | Onde |
|----|------|------|
| 1 | Obter o modelo Excel do governo | Ficheiro .xlsx oficial |
| 2 | Se PLACEHOLDER: editar o Excel e colocar `{{INSTITUICAO_NOME}}`, `{{TURMA}}`, `{{TABELA_ALUNOS}}`, etc. nas células | No seu computador |
| 2b | Se CELL_MAPPING: usar o ficheiro sem alterar | — |
| 3 | Menu **Importar Modelos** → **Importar modelo (Excel / HTML)** | Documentos Acadêmicos |
| 4 | Tipo: **Pauta de Conclusão**, Formato: **Excel**, Modo: Placeholders ou Mapeamento por coordenadas | Diálogo |
| 5 | Upload do ficheiro; se CELL_MAPPING, configurar mapeamento (Sugerir, Validar) | Diálogo |
| 6 | Clicar **Importar**, marcar modelo como **Ativo** | — |
| 7 | Sub-aba **Mini Pautas** → secção **Pauta de Conclusão do Curso** → selecionar Turma → **Exportar Excel** | Documentos Acadêmicos |

### Boletim (Excel)

| Nº | Ação | Onde |
|----|------|------|
| 1 | Obter o modelo Excel (do governo ou criar) | Ficheiro .xlsx |
| 2 | Se PLACEHOLDER: colocar `{{NOME_ALUNO}}`, `{{DISCIPLINA_1}}`, `{{NOTA_1}}`, etc. | No seu computador |
| 2b | Se CELL_MAPPING: manter ficheiro original | — |
| 3 | Menu **Importar Modelos** → **Importar modelo (Excel / HTML)** | Documentos Acadêmicos |
| 4 | Tipo: **Boletim**, Formato: **Excel**, Modo: Placeholders ou Mapeamento | Diálogo |
| 5 | Upload e, se CELL_MAPPING, configurar mapeamento | Diálogo |
| 6 | Clicar **Importar**, marcar **Ativo** | — |
| 7 | **Relatórios Oficiais** → **Boletim do Aluno** → selecionar Aluno e Ano → **Descarregar Excel** | Relatórios Oficiais |

### Certificado / Declaração (HTML ou Word)

| Nº | Ação | Onde |
|----|------|------|
| 1 | Menu **Importar Modelos** → **Importar modelo (Excel / HTML)** ou **Importar DOCX** | Documentos Acadêmicos |
| 2 | Tipo: Certificado (ou Declaração de Matrícula/Frequência), Formato: HTML ou Word | Diálogo |
| 3 | Colar HTML com `{{NOME_ALUNO}}`, `{{CURSO}}`, etc., ou fazer upload do DOCX | Diálogo |
| 4 | Clicar **Importar**, marcar **Ativo** | — |
| 5 | Na emissão de certificado/declaração, o sistema usa o modelo automaticamente | Emissão de documentos |

---

## 1. Visão geral

O sistema permite importar modelos oficiais do governo e preenchê-los automaticamente com dados do DSICOLA. Existem dois tipos principais:

| Tipo | Formatos suportados | Modos Excel |
|------|--------------------|-------------|
| Certificado, Declaração (Matrícula, Frequência) | HTML, Word (.docx), PDF | — |
| Mini Pauta | HTML, Excel (.xlsx) | PLACEHOLDER |
| Pauta de Conclusão | Excel (.xlsx) | PLACEHOLDER ou CELL_MAPPING |
| Boletim | Excel (.xlsx) | PLACEHOLDER ou CELL_MAPPING |

**Diferença entre modos Excel:**
- **PLACEHOLDER:** O ficheiro Excel tem células com `{{CHAVE}}` (ex: `{{INSTITUICAO_NOME}}`, `{{TABELA_ALUNOS}}`). O sistema substitui as chaves pelos dados.
- **CELL_MAPPING:** O ficheiro oficial **não pode ser alterado** (layout fixo, sem placeholders). O sistema preenche células por coordenadas (ex: B2 = instituição, A5 = nº do aluno).

---

## 2. Onde aceder

**Quem faz:** Admin ou Secretaria (ou permissão equivalente)

1. No menu lateral, clique em **Importar Modelos** (ou **Documentos Acadêmicos**).
2. Se escolheu Documentos Acadêmicos, clique na aba **Importar Modelos**.
3. O sub-tab **Importar / Modelos** aparece por defeito — é aqui que vê a lista de modelos e o botão **Importar modelo**.

**Caminhos diretos:**
- Importar modelos: `/admin-dashboard/certificados?tab=modelos&subtab=importados`
- Relatórios Oficiais (Boletim Excel): `/secretaria-dashboard/relatorios-oficiais`

---

## 3. Modos de preenchimento Excel

### Quando usar PLACEHOLDER

- Pode editar o ficheiro Excel (adicionar `{{CHAVE}}` nas células).
- Exemplo: modelo criado pela instituição com placeholders.

### Quando usar CELL_MAPPING

- O modelo é o ficheiro oficial do governo e **não pode ser alterado**.
- Não há placeholders; o layout é fixo.
- O sistema usa um mapeamento JSON: célula → campo (ex: `B2` → `instituicao.nome`).

---

## 4. Passo 1 — Modelo HTML (Certificado/Declaração)

### O que é?

Modelo em HTML com placeholders `{{CHAVE}}`. Usado para Certificados, Declarações de Matrícula e Declarações de Frequência.

### Passo a passo

1. Na secção **Importar e gerir modelos**, clique em **Importar modelo (Excel / HTML)** (ou **Importar DOCX** para Word).
2. No diálogo:
   - **Tipo de documento:** Certificado (ou Declaração de Matrícula / Declaração de Frequência).
   - **Nome:** Ex.: "Certificado Superior 2025".
   - **Descrição:** Opcional.
   - **Formato:** HTML.
3. Cole o HTML no campo **Template HTML**, usando placeholders:
   - Exemplos: `{{NOME_ALUNO}}`, `{{CURSO}}`, `{{ANO_LETIVO}}`, `{{INSTITUICAO_NOME}}`.
4. Clique em **Importar** ou **Guardar**.

**Resultado:** O modelo fica disponível para emissão. Na emissão de certificado/declaração, o sistema usa o modelo HTML se existir.

**Placeholders comuns:**

| Placeholder | Descrição |
|-------------|-----------|
| `{{NOME_ALUNO}}` | Nome completo do estudante |
| `{{CURSO}}` | Nome do curso |
| `{{ANO_LETIVO}}` | Ano letivo |
| `{{N_DOCUMENTO}}` | Número do documento |
| `{{LOGO_IMG}}` | Imagem do logótipo (base64) |
| `{{INSTITUICAO_NOME}}` | Nome da instituição |

---

## 5. Passo 2 — Modelo Excel com placeholders (PLACEHOLDER)

### O que é?

Modelo Excel (.xlsx) em que as células contêm `{{CHAVE}}`. O sistema substitui cada chave pelo valor correspondente. Usado para Pauta de Conclusão, Boletim e Mini Pauta.

### Passo a passo — Pauta de Conclusão

1. **Antes de abrir o sistema:** No Excel (no seu computador), edite o ficheiro e coloque nas células os placeholders:
   - `{{INSTITUICAO_NOME}}` — nome da instituição
   - `{{TURMA}}` — nome da turma
   - `{{ESPECIALIDADE}}` — especialidade
   - `{{ANO_LETIVO}}` — ano letivo (ex: 2024/2025)
   - `{{TABELA_ALUNOS}}` — tabela HTML com alunos e notas (gerada automaticamente)
   - `{{DISCIPLINAS}}` — lista de disciplinas
2. Guarde o ficheiro e feche-o.
3. Na secção **Importar e gerir modelos**, clique em **Importar modelo (Excel / HTML)**.
4. Preencha:
   - **Tipo de documento:** Pauta de Conclusão.
   - **Nome:** Ex.: "Pauta Final Enfermagem".
   - **Formato:** Excel (.xlsx).
   - **Modo de preenchimento:** Placeholders (padrão).
5. Faça upload do ficheiro Excel (.xlsx) que editou no passo 1.
6. Clique em **Importar**.

**Passo a passo — Boletim**

1. **Antes de importar:** No Excel (no seu computador), coloque placeholders nas células:
   - `{{NOME_ALUNO}}`, `{{NUMERO_ESTUDANTE}}`, `{{ANO_LETIVO}}`
   - Para disciplinas e notas: `{{DISCIPLINA_1}}`, `{{NOTA_1}}`, `{{DISCIPLINA_2}}`, `{{NOTA_2}}`, etc.
2. Guarde o ficheiro.
3. Importar modelo: Tipo **Boletim**, Formato **Excel**, modo Placeholders.
4. Faça upload do ficheiro e clique em **Importar**.

---

## 6. Passo 3 — Modelo Excel por coordenadas (CELL_MAPPING)

### O que é?

O ficheiro Excel é o modelo oficial do governo **sem placeholders**. O preenchimento é feito por coordenadas: cada célula é mapeada para um campo do sistema.

### Pré-requisitos

- Ter o ficheiro oficial (.xlsx) do governo.
- Saber onde estão os cabeçalhos e onde começa a lista de alunos (ou disciplinas, no Boletim).

### Passo a passo

#### 6.1 — Importar o modelo

1. Clique em **Importar modelo**.
2. **Tipo:** Pauta de Conclusão (ou Boletim).
3. **Formato:** Excel (.xlsx).
4. **Modo de preenchimento:** Mapeamento por coordenadas (CELL_MAPPING).
5. Faça upload do ficheiro Excel **sem alterar** (não adicione placeholders).
6. O editor de mapeamento aparece no mesmo diálogo. Pode configurar o mapeamento agora (passo 6.2) e clicar em **Importar**, ou importar primeiro e configurar depois em **Editar**.

#### 6.2 — Configurar o mapeamento (Editor visual)

1. Na secção **Mapeamento de células** (no diálogo de importação ou de edição), o editor mostra:
   - **Células individuais:** ex. B2 = instituição, B3 = turma.
   - **Lista (alunos ou disciplinas):** linha inicial e colunas (A = nº, B = nome, etc.).
2. Use os botões:
   - **Sugerir mapeamento** — o sistema analisa o Excel e propõe um mapeamento automático (quando disponível).
   - **Validar** — verifica se o mapeamento está correto.
   - **Visualizar preenchimento** (Pauta de Conclusão) — descarrega um Excel de exemplo com dados fictícios.
3. Para cada célula individual:
   - Célula: ex. `B2`
   - Campo: selecione (ex.: Nome da instituição, Turma, Especialidade).
4. Para a lista de alunos:
   - Linha inicial: ex. `5` (a lista começa na linha 5).
   - Colunas: A → Nº ordem, B → Nome completo, C → Nº estudante, D → MAC, E → NPP, etc.

#### 6.3 — Campos disponíveis (Pauta de Conclusão)

**Globais:** `instituicao.nome`, `turma`, `especialidade`, `anoLetivo`, `classe`

**Por aluno (student.):** `student.n`, `student.fullName`, `student.numeroEstudante`, `student.obs`, `student.estagio`, `student.cfPlano`, `student.pap`, `student.classFinal`

**Por disciplina (nota.):** `nota.MAC`, `nota.CA`, `nota.NPP`, `nota.NPG`, `nota.MT1`, `nota.MT2`, `nota.MT3`, `nota.HA`, `nota.EX`, `nota.MFD`, `nota.CFD`

**Nota:** Para várias disciplinas por aluno, use `nota.<nome_da_disciplina>.MAC`, etc., ou colunas com disciplina específica.

#### 6.4 — Exemplo de mapeamento JSON

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
      "listSource": "alunos",
      "columns": {
        "A": "student.n",
        "B": "student.fullName",
        "C": "student.numeroEstudante",
        "D": "nota.MAC",
        "E": "nota.NPP",
        "F": "nota.CFD",
        "G": "student.obs"
      }
    }
  ]
}
```

#### 6.5 — Ativar o modelo

1. Marque o modelo como **Ativo**.
2. Se existir mais do que um modelo ativo do mesmo tipo, o sistema usa o prioritário configurado.

---

## 7. Passo 4 — Gerar/exportar documentos

### Pauta de Conclusão em Excel

1. Aceda à página de **Documentos** (menu **Importar Modelos** ou **Documentos Acadêmicos**). Clique na sub-aba **Mini Pautas**.
2. Na secção **Pauta de Conclusão do Curso**, em "Exportar com dados reais", selecione a **Turma** ou **Preview (dados fictícios)**.
3. Clique em **Exportar Excel**.

**Resultado:** Ficheiro .xlsx preenchido com os dados da turma (notas CA, CFD por disciplina, etc.). O sistema usa o modelo ativo (PLACEHOLDER ou CELL_MAPPING).

### Boletim em Excel

1. Aceda a **Relatórios Oficiais** (menu lateral: Secretaria Dashboard ou Admin → Relatórios Oficiais).
2. Na aba **Boletim do Aluno**, selecione o **Ano Letivo** e o **Aluno**.
3. Clique em **Descarregar Excel**.

**Resultado:** Ficheiro .xlsx preenchido com o modelo ativo (PLACEHOLDER ou CELL_MAPPING), se tiver importado um modelo Boletim. Caso contrário, o sistema indica que deve importar um modelo primeiro.

### Certificado/Declaração

1. Na emissão de certificado ou declaração, o sistema usa automaticamente o modelo ativo (HTML ou DOCX) da instituição.
2. O documento é gerado em PDF com os dados preenchidos.

---

## 8. Resumo e resolução de problemas

### Resumo rápido

| Documento | Formato | Modo | Onde configurar |
|-----------|---------|------|-----------------|
| Certificado / Declaração | HTML, DOCX, PDF | Placeholders | Modelos → Importar |
| Pauta de Conclusão | Excel | PLACEHOLDER ou CELL_MAPPING | Modelos → Importar → Pauta de Conclusão |
| Boletim | Excel | PLACEHOLDER ou CELL_MAPPING | Modelos → Importar → Boletim |
| Mini Pauta | Excel | PLACEHOLDER | Modelos → Importar → Mini Pauta |

### Resolução de problemas

| Problema | Solução |
|----------|---------|
| "Modelo não preenche as células" | Verifique o modo (PLACEHOLDER vs CELL_MAPPING). No PLACEHOLDER, confirme que as chaves estão exatamente como `{{CHAVE}}`. |
| "Mapeamento inválido" | Use **Validar** no editor de mapeamento. Verifique se as células existem no Excel e se os campos estão corretos. |
| "Lista de alunos vazia" | Confirme a **linha inicial** da LISTA; deve coincidir com a primeira linha de dados no Excel. |
| "Coluna fora do range" | O Excel pode ter menos colunas do que o mapeamento. Ajuste as letras das colunas (A, B, C...) ou o `maxCols`. |
| "Não aparece opção Excel" | Certifique-se de que escolheu um tipo que suporta Excel (Pauta de Conclusão, Boletim, Mini Pauta). |
| "Dados não preenchem" | Para Pauta: verifique se a turma tem planos de ensino, notas lançadas e frequências. |
| Modelo não aparece na exportação | Marque o modelo como **Ativo** e escolha o tipo académico correto (Superior/Secundário). |

### Diagrama do fluxo

```
┌─────────────────────────────────────────────────────────────────────┐
│  IMPORTAR MODELO                                                    │
│  Menu Importar Modelos → Importar modelo (Excel/HTML) ou Importar DOCX │
│  Tipo + Formato + Ficheiro (ou HTML)                               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  CONFIGURAR (se Excel)                                             │
│  • PLACEHOLDER: colocar {{CHAVE}} no Excel antes de importar        │
│  • CELL_MAPPING: usar Editor de Mapeamento (Sugerir, Validar)       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  GERAR DOCUMENTO                                                    │
│  • Pauta: Certificados → Mini Pautas → Pauta Conclusão → Exportar Excel │
│  • Boletim: Relatórios Oficiais → Boletim do Aluno → Descarregar Excel │
│  • Certificado: Emissão → usa modelo ativo automaticamente          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Documentos relacionados

- [MODELOS_GOVERNMENTAIS_IMPLEMENTACAO.md](MODELOS_GOVERNMENTAIS_IMPLEMENTACAO.md) — Detalhes técnicos da implementação
- [FLUXO_ACADEMICO_COMPLETO_PASSO_A_PASSO.md](FLUXO_ACADEMICO_COMPLETO_PASSO_A_PASSO.md) — Fluxo de notas e frequências (pré-requisito para pautas e boletins)
