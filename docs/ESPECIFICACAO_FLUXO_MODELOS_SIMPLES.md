# Especificação — Fluxo de Importação de Modelos (Simples e Funcional)

**Princípio:** O fluxo deve ser o mais simples possível: Admin importa → mapeia → valida → guarda. Modelos ficam organizados por tipo (Pauta, Boletim, Certificado, etc.) e podem ser visualizados e exportados.

---

## 1. Fluxo alvo (por tipo)

### Pauta (Excel)

| Passo | Ação | Onde |
|-------|------|------|
| 1 | Admin obtém o modelo Excel do governo (ex: pauta em .xlsx) | Ficheiro oficial |
| 2 | **Importar** — carrega o ficheiro no sistema | Menu Importar Modelos |
| 3 | **Mapear** — define coordenadas células → campos (ou usa placeholders) | Diálogo / Editor |
| 4 | **Validar** — clica Validar para confirmar mapeamento | Botão Validar |
| 5 | **Guardar** — importa e guarda no sistema | Botão Importar |
| 6 | Modelo aparece em **Modelos de Pauta** | Tab Mini Pautas |
| 7 | **Visualizar** — Ver modelo (preview) | Botão Olho |
| 8 | **Exportar** — Exportar Excel com dados reais | Botão Exportar Excel |

### Boletim (Excel)

| Passo | Ação | Onde |
|-------|------|------|
| 1–5 | Idêntico à Pauta (importar, mapear, validar, guardar) | Importar Modelos |
| 6 | Modelo aparece em **Modelos de Boletim** (junto com Pautas na tab) | Tab Mini Pautas |
| 7 | **Exportar** — Relatórios Oficiais → Boletim do Aluno → Descarregar Excel | Secretaria |

### Certificado / Declaração (HTML, Word, PDF)

| Passo | Ação | Onde |
|-------|------|------|
| 1 | Admin obtém modelo (HTML/Word/PDF) | Ficheiro |
| 2 | **Importar** — cola HTML ou faz upload Word/PDF | Importar modelo / Importar DOCX / Importar PDF |
| 3 | **Mapear** — associa placeholders aos campos (Word/DOCX) | Botão Mapear |
| 4 | **Guardar** — modelo fica em Modelos de Certificado/Declaração | Tab Certificados / Declarações |
| 5 | **Visualizar** — Ver (preview) | Botão Olho |
| 6 | **Exportar** — na emissão, documento é gerado automaticamente | Emissão de documentos |

---

## 2. Regras obrigatórias

1. **Simplicidade**
   - Um único fluxo linear: Importar → Mapear → Validar → Guardar
   - Mapeamento e validação no mesmo diálogo que importação (não exigir passos fora de contexto)

2. **Organização por tipo**
   - Modelos de Pauta → tab **Mini Pautas** (PAUTA_CONCLUSAO, MINI_PAUTA, BOLETIM)
   - Modelos de Certificado → tab **Certificados**
   - Modelos de Declaração → tab **Declarações**
   - Visão geral → tab **Importar / Modelos**

3. **Visualização**
   - Cada modelo pode ser visualizado no formato próprio (HTML em iframe, PDF, Excel para download)
   - Botão Ver / Olho em cada linha da tabela

4. **Exportação**
   - Pauta: Exportar Excel na secção Pauta de Conclusão (com turma ou preview)
   - Boletim: Relatórios Oficiais → Boletim do Aluno → Descarregar Excel
   - Certificado/Declaração: Emissão automática na geração de documentos

5. **Compatibilidade e funcionamento**
   - Formatos suportados: Excel (.xlsx), HTML, Word (.docx), PDF
   - Modos Excel: PLACEHOLDER (chaves nas células) ou CELL_MAPPING (coordenadas fixas)
   - 100% funcional em ambos os tipos de instituição (Superior e Secundário)

---

## 3. Estado atual vs. especificação

| Requisito | Estado | Observação |
|-----------|--------|------------|
| Fluxo Importar → Mapear → Validar → Guardar | ✅ | Diálogo único com ExcelMappingEditor inline (Sugerir, Validar, Preview) |
| Modelos por tipo (Pauta, Boletim, Certificado, Declaração) | ✅ | Tabs filtram por tipo |
| Visualização no formato próprio | ✅ | Preview HTML/PDF/Excel com botão Ver |
| Exportar Pauta Excel | ✅ | Tab Mini Pautas → Exportar Excel |
| Exportar Boletim Excel | ✅ | Relatórios Oficiais |
| Certificado/Declaração na emissão | ✅ | Modelo ativo usado automaticamente |
| Multi-tenant (Superior/Secundário) | ✅ | Isolamento por tipo académico |

---

## 4. Pontos de atenção (manutenção)

- **Copy da UI**: Manter textos claros — "Importar modelo", "Mapear células", "Validar", "Guardar"
- **Validação obrigatória**: No modo CELL_MAPPING, não permitir Importar sem mapeamento válido (já implementado)
- **Exportação de modelos**: Se for necessário "exportar a lista de modelos" ou "exportar o modelo em si" para backup, pode ser adicionado futuramente
- **Fluxo DOCX**: Após importar DOCX, abrir automaticamente o TemplateMappingDialog (já implementado quando há placeholders)

---

## 5. Resumo executivo

O fluxo atual **já cumpre** os requisitos de simplicidade, organização por tipo, visualização e exportação. A especificação serve como referência para:

1. Garantir que alterações futuras não quebrem o fluxo linear
2. Documentar o comportamento esperado para novos utilizadores
3. Validar em testes E2E que o caminho crítico funciona

**Crucial:** Qualquer mudança deve preservar: Importar → Mapear → Validar → Guardar → Visualizar → Exportar.
