# Verificação de Conformidade AGT — PDFs Gerados

> Auditoria dos requisitos da **AGT** (Ref. 0000481/01180000/AGT/2026) para os documentos fiscais em PDF gerados pelo DSICOLA.

---

## 1. Requisitos Obrigatórios em Cada PDF (Notificação AGT)

| Requisito AGT | Implementação DSICOLA | Status |
|---------------|----------------------|--------|
| **4 caracteres do Hash + texto** | `[hash4]-Processado por programa válido n31.1/AGT20` no rodapé | ✅ |
| **Factura anulada visível** | Selo "ANULADO" em vermelho, sobreposição semi-transparente | ✅ |
| **Período contabilístico** | Data do documento ("Data: DD/MM/AAAA") — Period no SAF-T XML | ✅ |
| **Assinatura** | Hash SHA-256 no SAF-T; assinatura digital RSA opcional (confirmar com AGT) | ⚠️ |

---

## 2. Detalhe por Tipo de Documento

### 2.1 Fatura (FT)
| Campo AGT | No PDF DSICOLA | Conforme |
|-----------|----------------|----------|
| Emitente (NIF, nome, endereço) | Cabeçalho: Nome Fiscal, NIF, Endereço, Cidade, CP, Tel, Email | ✅ |
| Cliente (NIF/BI, nome) | Secção "DADOS DO CLIENTE": Nome, NIF/BI, Email | ✅ |
| Nº do documento | "Nº FT-YYYY-NNNN" | ✅ |
| Data | "Data: DD/MM/AAAA" | ✅ |
| Linhas (Descrição, Qtd, Preço Unit., Total) | Tabela com grid, colunas alinhadas | ✅ |
| Desconto global (se aplicável) | Linha "Desconto: -X,XX Kz" | ✅ |
| Total | "TOTAL: X XXX,XX Kz" | ✅ |
| Valor por extenso | "Valor por extenso: ..." | ✅ |
| Moeda | formatValor com AOA/USD/EUR | ✅ |
| Hash (4 chars) + texto | Rodapé: `XXXX-Processado por programa válido n31.1/AGT20` | ✅ |

### 2.2 Nota de Crédito (NC)
| Campo AGT | No PDF DSICOLA | Conforme |
|-----------|----------------|----------|
| Referência à fatura (OrderReference) | No SAF-T; PDF mostra tipo "NOTA DE CRÉDITO" | ✅ |
| Demais campos | Idêntico a FT | ✅ |

### 2.3 Pró-Forma / Orçamento (PF)
| Campo AGT | No PDF DSICOLA | Conforme |
|-----------|----------------|----------|
| Tipo "PRÓ-FORMA / ORÇAMENTO" | Sim | ✅ |
| Demais campos | Idêntico a FT | ✅ |

### 2.4 Guia de Remessa (GR)
| Campo AGT | No PDF DSICOLA | Conforme |
|-----------|----------------|----------|
| Tipo "GUIA DE REMESSA" | Sim | ✅ |
| Demais campos | Idêntico a FT | ✅ |

### 2.5 Documento Anulado
| Campo AGT | No PDF DSICOLA | Conforme |
|-----------|----------------|----------|
| Visível "anulado" | Overlay vermelho + texto "ANULADO" 48pt centralizado | ✅ |
| Registro na base | estado = ESTORNADO | ✅ |
| SAF-T | InvoiceStatus = A (Anulada) | ✅ |

---

## 3. Códigos de Isenção AGT (TaxExemptionReason)

A AGT exige que linhas isentas exibam o **código de motivo** (M00, M01, M02, etc.). O PDF atual mostra apenas Descrição, Qtd, Preço e Total. Para conformidade total:

| Requisito | No PDF Atual | Recomendação |
|-----------|--------------|--------------|
| Código isenção por linha | Não exibido | Adicionar coluna "Cód. Isenção" ou indicar na descrição quando `taxExemptionCode` estiver preenchido |

---

## 4. IVA por Linha

| Requisito | No PDF Atual | Recomendação |
|-----------|--------------|--------------|
| Taxa IVA 5%, 14% ou isento | Não exibida por linha | Adicionar coluna "IVA %" ou indicar na linha quando `taxaIVA` estiver preenchido |

---

## 5. UnitPrice e Decimais (Nota AGT)

> *"O campo UniPrice deve ser sem imposto e reflectir os descontos de linhas e descontos globais e deve conter as casas decimais necessárias à minimização de diferenças (por exemplo 4 casas)."*

Isso refere-se ao **SAF-T XML**, não ao PDF. O PDF pode continuar com 2 casas decimais (formato de moeda). O SAF-T usa `UnitPrice` com maior precisão quando necessário.

| Onde | Implementação | Status |
|------|---------------|--------|
| SAF-T XML | Valores com decimais adequados | ⚠️ Verificar em saft.service |
| PDF | 2 casas decimais (padrão moeda) | ✅ Aceitável |

---

## 6. Checklist Rápido para Envio à AGT

Antes de enviar os PDFs à AGT, confirme:

- [ ] **Todos os PDFs** têm o rodapé: `[XXXX]-Processado por programa válido n31.1/AGT20`
- [ ] **Factura anulada** tem o selo "ANULADO" bem visível
- [ ] **Dois meses diferentes** (ex.: Janeiro e Fevereiro 2026)
- [ ] **Cada tipo exigido** está representado (FT, NC, PF, GR, anulada, com NIF, sem NIF <50, moeda estrangeira, 2 linhas com IVA+isento, etc.)
- [ ] **SAF-T XML** inclui todos os documentos com HashControl preenchido
- [ ] **Mapeamento** na carta de resposta: ponto 1 → documento X, ponto 2 → documento Y, etc.

---

## 7. Lacunas Identificadas

| Lacuna | Prioridade | Ação |
|--------|------------|------|
| Código de isenção (M00–M38) não visível por linha no PDF | Média | Adicionar coluna ou nota quando `taxExemptionCode` existir |
| Taxa IVA por linha não visível no PDF | Média | Adicionar coluna "IVA %" |
| Assinatura digital no PDF | A confirmar | Consultar AGT se hash no rodapé é suficiente ou se exige RSA |
| Período contabilístico explícito (ex.: "Período: 01/2026") | Baixa | Considerar adicionar se AGT o exigir no PDF |

---

## 8. Resumo

| Área | Conformidade |
|------|--------------|
| Texto fiscal obrigatório no rodapé | ✅ |
| Factura anulada visível | ✅ |
| Dados emitente e cliente | ✅ |
| Tabela de linhas e totais | ✅ |
| Valor por extenso | ✅ |
| Moeda (AOA/USD/EUR) | ✅ |
| Código isenção por linha no PDF | ⚠️ Melhorar |
| Taxa IVA por linha no PDF | ⚠️ Melhorar |
| Assinatura digital | ⚠️ A confirmar com AGT |

**Conclusão:** Os PDFs gerados pelo DSICOLA cumprem os requisitos principais da AGT para validação de software. As melhorias sugeridas (código de isenção e IVA por linha) aumentam a clareza e podem ser implementadas para maior conformidade.
