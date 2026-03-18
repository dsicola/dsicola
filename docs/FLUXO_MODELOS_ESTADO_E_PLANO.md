# Fluxo de Modelos — Estado atual e plano de estabilização

**Objetivo:** O sistema deve permitir (1) importar modelos em DOCX, Excel e PDF, (2) mapear e guardar no sistema, (3) visualizar e exportar com aparência igual ao original, (4) sem erros ou incompatibilidades.

---

## 1. Mapeamento requisitos → implementação

### Requisito 1 — Importar modelos (DOCX, Excel, PDF)

| Formato | Suportado | Onde importar | O que pode falhar |
|---------|-----------|---------------|-------------------|
| **Excel (.xlsx)** | ✅ | Importar modelo → Select tipo (Mini Pauta, Pauta Conclusão, Boletim) → carregar ficheiro | Extensão .xls antiga pode falhar |
| **DOCX (.docx)** | ✅ | Importar DOCX (diálogo) ou colar HTML (Mammoth converte DOCX→HTML) | Conversão Word→HTML perde formatação complexa |
| **PDF** | ✅ | Importar PDF (botão) → guarda base64 e mapeamento | PDF fillable (AcroForm) ou coordenadas; PDFs escaneados não preenchíveis |

**Caminho:** Configurações → Modelos de Documentos → Importar modelo / Importar DOCX / Importar PDF

---

### Requisito 2 — Mapeamento e gravação no sistema

| Tipo de modelo | Mapeamento | Guarda em |
|----------------|------------|-----------|
| **Excel** | PLACEHOLDER (chaves nas células) ou CELL_MAPPING (coordenadas) | `excel_template_base64`, `excel_cell_mapping_json` |
| **DOCX** | TemplateMappingDialog: placeholder → campo do sistema | `docx_template_base64`, `template_mappings` |
| **PDF** | PdfMappingEditor: campo PDF → campo sistema | `pdf_template_base64`, `pdf_mapping_json` |

**Problemas conhecidos:**
- Excel CELL_MAPPING: ao guardar só mapeamento (sem novo ficheiro), o base64 podia ficar `null` (corrigido)
- DOCX: o botão "Mapear" só aparece quando existem placeholders; modelos sem placeholders não mostram opção de mapear
- PDF: modo COORDINATES exige configuração manual de coordenadas

---

### Requisito 3 — Visualizar e exportar com aparência original

| Formato | Visualização | Exportação | Fidelidade ao original |
|---------|--------------|------------|------------------------|
| **Excel** | Tabela inline no modal (primeira folha) + botão Descarregar | Excel exportado com dados reais | 100% se usar o ficheiro original |
| **HTML** | iframe com HTML renderizado | PDF gerado na emissão | Depende de CSS/imagens |
| **DOCX** | Docxtemplater preenche → conversão para PDF | PDF ou DOCX na emissão | **LibreOffice instalado** → 100%; fallback Mammoth/Puppeteer pode desalinhar |
| **PDF** | iframe com PDF | PDF preenchido na emissão | 100% se campos mapeados corretamente |

**Pontos críticos para aparência original:**
1. **LibreOffice** — Conversão DOCX→PDF e Excel→PDF depende de LibreOffice no servidor
   - Sem LibreOffice: usa fallback (Mammoth + Puppeteer ou HTML→PDF)
   - Instalar: `sudo apt install libreoffice` (Linux) ou `brew install --cask libreoffice` (macOS)
2. **Excel→PDF** — Preview da Mini Pauta: se modelo for Excel, tenta converter para PDF; sem LibreOffice devolve Excel e o frontend mostra tabela inline
3. **PDF fillable** — Modelos PDF com AcroForm preenchem campos; PDFs estáticos usam modo coordenadas

---

### Requisito 4 — Integração e estabilidade

**O que já está alinhado:**
- Multi-tenant por instituição
- Separação Superior/Secundário
- CRUD de modelos por tipo (Certificado, Declaração, Pauta, Boletim)
- Validação de mapeamento antes de guardar (Excel CELL_MAPPING)
- Testes de fluxo no backend (40 testes em `test:fluxo-documentos:full`)

**Pontos de falha frequentes:**
1. **Conversão de formato** — LibreOffice não instalado → preview/export podem desalinhar
2. **Excel base64 vazio** — ✅ Corrigido: backend preserva; frontend não envia vazio ao atualizar
3. **Preview Excel** — Corrigido: mostra tabela inline em vez de abrir no Excel
4. **API duplicada** — Não encontrada: `getModeloDocumento` existe uma vez em api.ts

---

## 2. Plano de estabilização (ações prioritárias)

### Prioridade 1 — Correções imediatas
- [x] Garantir que guardar mapeamento Excel sem novo ficheiro preserva o base64 (backend + frontend)
- [x] DOCX upload com tipoAcademico para isolamento multi-tenant
- [x] Mensagens de erro mais claras (resposta da API no toast)

### Prioridade 2 — Dependências de ambiente
- [ ] Documentar que LibreOffice é recomendado para DOCX/Excel→PDF fiel
- [ ] Verificar scripts de deploy (Railway, Docker) para instalar LibreOffice
- [ ] Mensagens claras quando conversão falha (ex: "Conversão PDF indisponível. Descarregue o Excel.")

### Prioridade 3 — Consolidação do fluxo
- [ ] Testar fluxo completo manualmente: Importar Excel → Mapear → Validar → Guardar → Preview → Exportar
- [ ] Testar fluxo DOCX: Importar → Mapear → Guardar → Emitir documento
- [ ] Testar fluxo PDF: Importar → Mapear campos → Guardar → Emitir

### Prioridade 4 — Documentação para o utilizador
- [ ] Guia "Como importar modelo do governo" (passo a passo por formato)
- [ ] Mensagens de erro orientativas (ex: "Instale LibreOffice para conversão fiel")

---

## 3. Resumo executivo

| Requisito | Estado | Ação |
|-----------|--------|------|
| 1. Importar DOCX, Excel, PDF | ✅ Implementado | Verificar edge cases (ficheiros corrompidos, formatos antigos) |
| 2. Mapear e guardar | ✅ Implementado | Corrigir bug base64 ao guardar só mapeamento; verificar DOCX sem placeholders |
| 3. Visualizar/Exportar com aparência original | ⚠️ Depende de LibreOffice | Instalar LibreOffice no servidor; fallbacks com mensagens claras |
| 4. Integração sem erros | ⚠️ Alguns bugs conhecidos | Corrigir api.ts; rodar testes; validar fluxos E2E |

**Próximo passo:** Corrigir o erro `getModeloDocumento` duplicado e validar que todos os fluxos funcionam de ponta a ponta.
