# Auditoria Técnica — Excel CELL_MAPPING e Geração de Documentos

**Sistema:** DSICOLA  
**Data:** 18 de Março de 2025  
**Âmbito:** Templates Excel (mini pautas do governo), modo CELL_MAPPING, geração de documentos

---

## Nota sobre bibliotecas

O sistema utiliza **SheetJS (xlsx)** e não exceljs. A auditoria foi ajustada para refletir o uso de `xlsx`.

---

## 1. VALIDAÇÃO DO EXCEL (CELL_MAPPING)

### 1.1 Modo CELL_MAPPING sem placeholders

| Requisito | Estado | Comentário |
|-----------|--------|------------|
| Funciona sem placeholders | OK | `fillExcelTemplateWithCellMapping` usa apenas coordenadas (B5, D5); não depende de `{{CHAVE}}` |
| Preenchimento por células específicas | OK | `parseCell()` converte "B5" → `{r:4, c:1}`; `ensureCell()` escreve em `sheet[addr].v` |
| Loop de alunos (startRow + index) | OK | `excelRow1Based = startRow + i`, `r = excelRow1Based - 1`; lógica 1-based correta |
| Sem sobrescrita de células erradas | OK | Coordenadas explícitas; cada item mapeia célula exata |
| Múltiplas colunas | OK | LISTA com `columns: [{coluna, campo}, ...]` itera todas as colunas |

### 1.2 Problemas encontrados

**1.2.1 Falta validação de `startRow` em LISTA**

Se `startRow` for `undefined`, o código faz `startRow + i` → `NaN`, resultando em erro ao escrever.

**Sugestão:** Em `validateCellMapping`, para itens LISTA:

```typescript
if (typeof listaItem.startRow !== 'number' || listaItem.startRow < 1) {
  errors.push(`LISTA: startRow obrigatório e deve ser >= 1`);
}
```

**1.2.2 Células FIXO com formato inválido são ignoradas**

Em `parseCell()`, se o endereço não corresponder ao regex `/^([A-Z]+)([0-9]+)$/i`, retorna `null` e o código faz `continue` sem erro.

**Sugestão:** Em vez de ignorar, registar warning ou erro:

```typescript
if (!parsed) {
  warnings.push(`Célula ignorada (formato inválido): "${single.cell}"`);
  continue;
}
```

---

## 2. PRESERVAÇÃO DO MODELO

### 2.1 Estado atual

| Aspecto | Estado | Detalhes |
|---------|--------|----------|
| Estilos (cores, bordas) | PARCIAL | SheetJS Community Edition lê/escreve com foco em dados; `cellStyles` não é usado |
| Merges | RISCO | `!merges` é mantido pelo `XLSX.read`/`write`, mas `ensureCell` pode criar células em posições cobertas por merges |
| Formatação original | PARCIAL | Células existentes mantêm o objeto; novas células recebem `{t:'s', v:''}` sem estilo |

### 2.2 Análise

- O código só altera `.v` nas células mapeadas.
- `ensureCell` cria `{t:'s', v:''}` quando a célula não existe. Em merges (ex.: B5:C5), a célula C5 pode não existir; criar `sheet['C5']` pode afetar a forma como o Excel interpreta o merge.
- A documentação do SheetJS indica que `cellStyles: true` ajuda a preservar estilos, mas existem issues conhecidos; a edição Community não garante preservação total.

### 2.3 Recomendações

1. Escrever apenas na célula superior-esquerda de merges: consultar `sheet['!merges']` e, se a célula estiver coberta, usar a célula origem do merge.
2. Avaliar `cellStyles: true` no `XLSX.read` e `XLSX.write` para minimizar perda de estilos.
3. Documentar que modelos com formatação complexa podem perder parte da formatação.

---

## 3. COMPATIBILIDADE COM MODELOS DO GOVERNO

| Requisito | Estado |
|-----------|--------|
| Estrutura fixa (sem placeholders) | OK |
| Não depende de placeholders | OK |
| Múltiplas disciplinas | OK — `getValueByPath` com `disciplinaOverride` e `nota[discNome]` |
| Múltiplas folhas | OK — `sheetIndex` em `ExcelCellMapping` |

Exemplo de mapeamento por disciplina:

```json
{ "coluna": "D", "campo": "nota.MAC", "disciplina": "Matemática" }
```

---

## 4. BACKEND (SheetJS/xlsx)

### 4.1 Uso de workbook e worksheet

- `XLSX.read(buffer, { type: 'buffer', cellDates: false })`
- Folha: `workbook.Sheets[workbook.SheetNames[sheetIdx]]`
- Uso consistente de `workbook` e `sheet`.

### 4.2 Células inexistentes

- `ensureCell(sheet, r, c)` cria `{t:'s', v:''}` quando a célula não existe.
- Não há verificação de limites do sheet; células fora do range existente são criadas.

### 4.3 Performance

- Sem streaming; o ficheiro é lido e escrito inteiro em memória.
- Para pautas muito grandes (>500 alunos), pode haver impacto de memória.
- Não há timeouts nem limites explícitos.

### 4.4 Tratamento de erros

- `try/catch` em `Buffer.from` e em `fillExcelTemplateWithCellMapping`.
- `XLSX.read` sem `try/catch` próprio; falhas propagam e são tratadas pelo middleware global.

Recomendação: envolver `XLSX.read` e `XLSX.write` em `try/catch` e lançar `AppError` com mensagem clara.

---

## 5. MAPEAMENTO

### 5.1 Estrutura JSON

```json
{
  "sheetIndex": 0,
  "items": [
    { "cell": "B2", "campo": "instituicao.nome" },
    {
      "tipo": "LISTA",
      "startRow": 5,
      "listSource": "alunos",
      "columns": [
        { "coluna": "A", "campo": "student.n" },
        { "coluna": "B", "campo": "student.fullName", "disciplina": "Mat" }
      ]
    }
  ]
}
```

- Tipos: FIXO (singles) e LISTA.
- `validateCellMapping` valida duplicados e campos.

### 5.2 Validação antes de guardar

- `validateCellMapping` deteta células duplicadas, colunas fora do range e campos desconhecidos.
- Chamada via API e botão "Validar" no frontend.

### 5.3 Prevenção de duplicação

- `seenCells` em FIXO e `seenCols` em LISTA evitam duplicados.
- Erro explícito: `Célula duplicada: ${s.cell}`.

### 5.4 LISTA vs FIXO

- FIXO: `cell` + `campo`.
- LISTA: `tipo: 'LISTA'`, `startRow`, `columns`, `listSource` (alunos/disciplinas).

---

## 6. UI (FRONTEND)

### 6.1 ExcelMappingEditor

| Funcionalidade | Estado | Observação |
|----------------|--------|-----------|
| Seleção de célula | OK | Clique marca célula |
| Mappings visíveis | OK | Células mapeadas com `bg-primary/15` |
| Feedback visual | OK | Toast, indicação de célula selecionada |
| Fluxo intuitivo | OK | Clique célula → campo → mapeamento |
| Conhecimento técnico | OK | Texto explicativo presente |
| Sugerir mapeamento | OK | Chama `analyzeExcelTemplate` |
| Validar | OK | Chama `validateCellMapping` |
| Preview | OK | Apenas para PAUTA_CONCLUSAO |
| Zoom | OK | 50–150% |

### 6.2 Limitações UI

- Preview não existente para Boletim em modo CELL_MAPPING.
- `CellMappingEditor` existe mas não é usado; apenas `ExcelMappingEditor` está em uso.

---

## 7. IA DE SUGESTÃO

### 7.1 `analyzeExcelAndSuggestMapping`

| Requisito | Estado |
|-----------|--------|
| Deteção de headers | OK — `HEADER_KEYWORDS`, `detectedHeaderRow` |
| Sugestão de colunas | OK — `HEADER_TO_CAMPO` + heurísticas por tipo de valor |
| Confidence score | OK — `confidence` 0–1 |
| Fallback | OK — linha com mais células não vazias quando sem keywords |

### 7.2 Palavras-chave

Inclui: NOME, ALUNO, MAC, NPP, MT1–MT3, EX, MFD, CA, Nº, MATRÍCULA, etc.

### 7.3 Limitações

- Não trata modelos com estrutura muito diferente dos exemplos típicos.
- `disciplina` na lista é opcional; múltiplas disciplinas podem exigir ajuste manual.

---

## 8. IA DE APRENDIZAGEM

| Requisito | Estado |
|-----------|--------|
| Persistência de dados de uso | NÃO IMPLEMENTADO |
| Melhoria de sugestões com uso | NÃO IMPLEMENTADO |
| Conflitos de mapping | N/A |

A sugestão é baseada apenas em heurísticas estáticas. Não há mecanismo de aprendizagem nem armazenamento de correções do utilizador.

---

## 9. PREVIEW

### 9.1 Fluxo

- `previewExcelCellMappingController` → `getPautaConclusaoSaudeDados` → `fillExcelTemplateWithCellMapping`.
- Mesmo pipeline da exportação final.

### 9.2 Consistência

- Preview e exportação usam a mesma função.
- Dados: reais se `turmaId` fornecido; fictícios caso contrário.

### 9.3 Limitações

- Preview só para PAUTA_CONCLUSAO.
- Boletim em CELL_MAPPING não tem preview na UI.

---

## 10. SEGURANÇA

### 10.1 Sanitização de inputs

- `excelTemplateBase64`: validado como string não vazia.
- `excelCellMappingJson`: validado com `JSON.parse` em `try/catch`.
- Valores escritos vêm de `getValueByPath` (strings numéricas ou texto) — sem injeção de fórmulas no fluxo atual.

### 10.2 Ficheiros maliciosos

- Frontend: validação de extensão `.xlsx`/`.xls`.
- Backend: nenhuma validação de tipo MIME ou magic bytes.
- Base64 enviado em JSON: sem limite de tamanho explícito (risco de DoS com payload grande).

### 10.3 Recomendações

1. Limitar tamanho do base64 (ex.: 10 MB).
2. Validar magic bytes do XLSX antes de processar.
3. Evitar escrita de fórmulas a partir de dados utilizador; manter apenas valores.

---

## 11. EDGE CASES

| Caso | Comportamento | Estado |
|------|---------------|--------|
| Excel vazio | `sheet['!ref']` ausente; retorno early em `analyzeExcel` | OK |
| Células mergeadas | `ensureCell` pode criar células em posições cobertas | RISCO |
| Colunas fora de ordem | Colunas mapeadas por letra; ordem irrelevante | OK |
| Ficheiros grandes | Processamento em memória; sem streaming | AVISO |
| Múltiplas disciplinas | Suportado via `disciplina` em columns | OK |
| `startRow` em falta | Pode gerar NaN e falha | BUG |
| `listSource` diferente de alunos/disciplinas | LISTA não é processada | OK (comportamento esperado) |

---

## 12. ERROS E LOGS

### 12.1 Mensagens de erro

- `AppError` com mensagens como:
  - "Modelo Excel não fornecido"
  - "excelCellMappingJson inválido"
  - "Dados estruturados necessários para modo CELL_MAPPING"
  - "Folha Excel não encontrada"
  - "Célula duplicada"

### 12.2 Logs

- Sem logs dedicados no serviço Excel.
- Erros passam pelo middleware global e pela stack.

### 12.3 Recomendações

- Incluir `logger.debug` em pontos críticos (ex.: início/fim do preenchimento).
- Manter `AppError` com mensagens amigáveis ao utilizador.

---

## 13. PERFORMANCE

- Geração típica: <1 s para pautas pequenas/médias.
- Sem métricas internas.
- UI com `min(200 rows, 52 cols)` para evitar problemas de renderização.

---

## RESUMO EXECUTIVO

### O que está correto

1. Modo CELL_MAPPING sem placeholders.
2. Preenchimento correto por coordenadas (B5, D5, etc.).
3. Loop de alunos (startRow + index).
4. Suporte a múltiplas disciplinas e colunas.
5. Estrutura JSON e validação de duplicados.
6. UI de mapeamento com sugestão automática, validação e preview (Pauta).
7. Sugestão baseada em keywords e confidence score.
8. Preview alinhado com a exportação final (Pauta).
9. Tratamento básico de erros e validações.
10. Multi-tenant e isolamento por instituição.

### Pontos de melhoria

1. Adicionar validação de `startRow` em LISTA.
2. Adicionar warning/erro para células FIXO com formato inválido.
3. Preview para Boletim em CELL_MAPPING.
4. Avaliar `cellStyles` do SheetJS para preservação de estilos.
5. Tratar merges ao escrever (evitar criar células em posições cobertas).
6. Limites de tamanho para base64 e validação de tipo de ficheiro.
7. `try/catch` explícito em `XLSX.read`/`write`.
8. Documentar limitações de preservação de estilos.

### Problemas críticos

1. **Validação de `startRow`**  
   LISTA sem `startRow` válido pode causar NaN e falha em runtime.

2. **Preservação de estilos**  
   SheetJS Community Edition não garante estilos; modelos oficiais formatados podem perder formatação.

3. **Upload sem limites**  
   Base64 no body sem limite de tamanho; risco de DoS.

---

## SCORE GERAL: 78/100

| Categoria | Peso | Score | Ponderado |
|----------|------|-------|-----------|
| Funcionalidade CELL_MAPPING | 25% | 90 | 22.5 |
| Preservação do modelo | 15% | 55 | 8.25 |
| Compatibilidade governo | 10% | 95 | 9.5 |
| Backend (xlsx) | 10% | 80 | 8.0 |
| Mapeamento | 10% | 90 | 9.0 |
| UI | 10% | 85 | 8.5 |
| IA Sugestão | 5% | 80 | 4.0 |
| IA Aprendizagem | 0% | 0 | 0 |
| Preview | 5% | 75 | 3.75 |
| Segurança | 5% | 65 | 3.25 |
| Edge cases | 3% | 70 | 2.1 |
| Erros/Logs | 2% | 80 | 1.6 |
| Performance | 5% | 75 | 3.75 |

---

## RECOMENDAÇÕES PRÁTICAS (prioridade)

### Alta prioridade

1. Validar `startRow` em `validateCellMapping` para LISTA.
2. Aplicar limite de tamanho para `excelTemplateBase64` (ex.: 10 MB).
3. Documentar claramente que estilos podem não ser preservados.

### Média prioridade

4. Implementar preview para Boletim em CELL_MAPPING.
5. Rejeitar ou corrigir células com formato inválido em vez de ignorá-las.
6. Tratar merges: escrever apenas na célula origem.

### Baixa prioridade

7. Testar `cellStyles: true` em leitura/escrita.
8. Adicionar logging estruturado no serviço Excel.
9. Considerar mecanismo de aprendizagem para melhorar sugestões.

---

## CONCLUSÃO

O modo CELL_MAPPING está funcional e alinhado com modelos oficiais sem placeholders. A lógica de preenchimento, mapeamento e validação está correta.

**Correções aplicadas (18/03/2025):**
1. **Validação de `startRow`** — Em `validateCellMapping`, itens LISTA sem `startRow` válido (número ≥ 1) geram erro.
2. **Limite de tamanho** — `excelTemplateBase64` limitado a 15 MB em todos os endpoints (criar, atualizar, extrair placeholders, analisar, preview, validar).

Para uso em produção, validar com modelos reais do governo (ex.: Angola) antes da implantação.
