# Checklist de Conformidade Fiscal — AGT Angola

> Verificação do que a **Administração Geral Tributária (AGT)** exige para validar o sistema DSICOLA fiscalmente em Angola.

---

## 1. Base legal

| Documento | Assunto | Status DSICOLA |
|-----------|---------|----------------|
| **Decreto Presidencial nº 312/18** | Submissão eletrónica dos elementos contabilísticos (SAF-T) | ✅ Implementado |
| **Decreto Executivo nº 317/20** | Estrutura do ficheiro SAF-T AO | ✅ Implementado |
| **Decreto Executivo nº 683/25** (22 Ago 2025) | Facturação electrónica obrigatória | ⚠️ Ver secção 4 |
| **Decreto Presidencial nº 71/25** | Facturação electrónica (marco legal) | ⚠️ Verificar aplicabilidade |

---

## 2. SAFT-AO (SAF-T Angola) — Conformidade atual

| Requisito | Status | Notas |
|-----------|--------|-------|
| **Namespace** `urn:OECD:StandardAuditFile-Tax:AO_1.01_01` | ✅ | Conforme schema |
| **Moeda AOA** | ✅ | |
| **País AO** | ✅ | |
| **Header** (NIF, nome, endereço, email, telefone) | ✅ | Dados fiscais obrigatórios |
| **Clientes (Customer)** | ✅ | Alunos com BI/NIF |
| **Produtos (Product)** | ✅ | Cursos + PROPINA |
| **Tabela de Impostos** (IVA ISE) | ✅ | |
| **Faturas (SalesInvoices)** | ✅ | DocumentoFinanceiro FT/RC |
| **Mecanismos de pagamento** (TB, MB, CH, NU) | ✅ | |
| **Validação pré-geração** (NIF, email, nome fiscal) | ✅ | Bloqueia se faltar |
| **SoftwareCertificateNumber** | ✅ | Configurável em Dados Fiscais — preencher após certificação AGT |
| **Validação estrutural** antes do download | ✅ | Valida namespace, Header, MasterFiles, SourceDocuments, NIF, moeda AOA |
| **WorkingDocuments** | ❌ | Não implementado (pode não ser exigido para propinas) |
| **Secção Payments separada** | ❌ | Pagamentos dentro de cada Invoice |

---

## 3. Dados fiscais obrigatórios (Configurações da Instituição)

Configure em **Configurações da Instituição > Dados Fiscais**:

| Campo | Obrigatório | DSICOLA |
|-------|-------------|---------|
| NIF | ✅ | ✅ Validado |
| Nome Fiscal | ✅ | ✅ Validado |
| Email Fiscal | ✅ | ✅ Validado |
| Endereço Fiscal | ✅ | ✅ |
| Telefone Fiscal | ✅ | ✅ |
| Código Postal | Opcional | ✅ |

---

## 4. Facturação electrónica (Decreto 683/25) — Novos requisitos

A partir de **1 Jan 2026** (grandes contribuintes) e **1 Jan 2027** (todos), a AGT exige:

| Requisito | Status DSICOLA | Ação |
|-----------|----------------|------|
| **Assinatura digital** em cada factura | ⚠️ | Hash SHA-256 implementado; assinatura RSA opcional — confirmar com AGT |
| **Código QR** na factura (validação) | ✅ | QR nos recibos PDF com URL de verificação |
| **Formato JSON** para troca de dados | ❌ | AGT pode exigir além do SAFT XML |
| **Transmissão em tempo real** à AGT | ❌ | Portal ou API REST — verificar com AGT |
| **Software certificado** pela AGT | ❌ | **Registar e obter certificação** |

---

## 5. Registo e certificação de software

A AGT exige que os **produtores de software** estejam registados e que o software seja **certificado**:

| Requisito | Status | Ação |
|-----------|--------|------|
| **Produtor registado em Angola** | ⚠️ | Donos ou representantes devem residir em Angola |
| **Software na lista de certificados** | ❌ | Submeter à AGT para validação |
| **SoftwareCertificateNumber** válido | ❌ | Obter número após certificação |
| **Conformidade técnica** | ⚠️ | Enviar amostra SAFT + documentação para análise |

**Contacto AGT:** [Portal do Contribuinte](https://www.agt.minfin.gov.ao) | Serviços de certificação de software

---

## 6. O que falta implementar para conformidade total

### Prioridade alta

1. **Certificação AGT**
   - Registar o produtor (se aplicável)
   - Submeter o DSICOLA para validação
   - Obter `SoftwareCertificateNumber` e atualizar no código

2. **Validação XSD** ✅ Implementado
   - Valida o XML gerado contra o schema oficial [SAF-T-AO](https://github.com/assoft-portugal/SAF-T-AO) antes do download
   - Schema em `backend/assets/saft-ao/SAFTAO1.01_01.xsd`
   - Requer `npm install libxmljs2-xsd` (opcional: se não instalado, validação XSD é ignorada)
   - Para desativar: `SKIP_SAFT_XSD_VALIDATION=1`

### Prioridade média (se exigido por tipo de instituição)

3. **Assinatura digital em facturas**
   - Cada factura/recibo com assinatura eletrónica (RSA 2048 ou similar)
   - O DSICOLA já tem `digitalSignature.service` para backups

4. **Código QR nas facturas**
   - QR com URL de verificação ou dados fiscais (conforme especificação AGT)
   - O DSICOLA já usa QR em certificados e declarações

### Prioridade baixa (confirmar com AGT)

5. **WorkingDocuments** — Secção do SAFT para documentos de conferência
6. **Secção Payments** separada no SAFT
7. **Integração API REST** com portal AGT (se obrigatório)

---

## 7. Passos práticos para validação

### Fase 1 — Documentação (1–2 semanas)

```
□ Obter Decreto Executivo 683/25 (texto completo)
□ Obter especificação técnica da facturação electrónica (formato JSON, QR, assinatura)
□ Obter requisitos de certificação de software (formulário AGT)
□ Verificar se instituições de ensino estão no âmbito de "grandes contribuintes" (Jan 2026)
```

### Fase 2 — Contacto AGT (2–4 semanas)

```
□ Contactar AGT — Serviço de Certificação de Software
□ Solicitar lista de requisitos técnicos atualizada
□ Enviar amostra do XML SAFT gerado pelo DSICOLA
□ Obter parecer sobre conformidade e ajustes necessários
□ Iniciar processo de registo/certificação (se produtor em Angola)
```

### Fase 3 — Ajustes técnicos (4–8 semanas)

```
□ Implementar validação XSD antes do download SAFT
□ Substituir SoftwareCertificateNumber=0 pelo número real (após certificação)
□ Implementar assinatura digital em facturas (se exigido)
□ Implementar QR em facturas (se exigido)
□ Validar novamente com contabilista e AGT
```

### Fase 4 — Certificação final

```
□ Submeter versão final para certificação AGT
□ Obter inclusão na lista de softwares certificados
□ Documentar processo para clientes
```

---

## 8. Resumo executivo

| Área | Conformidade | Observação |
|------|--------------|------------|
| **SAFT-AO (312/18, 317/20)** | ✅ ~95% | Estrutura, validação, hash, certificado configurável |
| **Facturação electrónica (683/25)** | ✅ Parcial | QR nos recibos; hash fiscal; assinatura RSA opcional |
| **Certificação AGT** | ❌ Pendente | Registar e obter certificado |
| **Dados fiscais** | ✅ | Configuração obrigatória implementada |

**Conclusão:** O DSICOLA está em conformidade com os decretos 312/18 e 317/20 (SAF-T AO) para exportação de dados contabilísticos. Para validação fiscal completa pela AGT, é necessário: (1) obter certificação do software, (2) implementar validação XSD e (3) avaliar requisitos do Decreto 683/25 (facturação electrónica) conforme o perfil do contribuinte.

---

## 9. Validação fiscal automática (antes de exportar)

O sistema valida automaticamente antes de gerar o ficheiro SAFT:

| Verificação | Implementado |
|-------------|--------------|
| Sequência de documentos (sem gaps) | ✅ |
| Totais = soma das linhas | ✅ |
| Clientes no MasterFiles (BI/NIF) | ✅ |
| Produtos registados (PROPINA + cursos) | ✅ |
| Datas no período fiscal | ✅ |
| NIF válido (não 000000000) | ✅ |
| Valores não negativos (exceto NC) | ✅ |
| Pagamento ≤ valor da fatura | ✅ |
| Campos obrigatórios | ✅ |
| Documentos nunca apagados | ✅ (imutável) |

**Fluxo final:**
```
Gerar SAFT (gerarXmlSaftAo)
    ↓
validarExportacaoSaft (NIF, documentos, dados fiscais)
    ↓
validarDadosFiscaisCompletos (sequência, totais, clientes, datas, pagamentos)
    ↓
Gerar XML
    ↓
validarEstruturaXmlSaft (namespace, Header, MasterFiles, etc.)
    ↓
validarXmlContraXsd (schema oficial SAF-T-AO)
    ↓
Se erro → AppError com relatório
    ↓
Se OK → res.send(xml) → Download
```

---

## 10. Teste de conformidade

Execute o fluxo completo com dados de exemplo:

```bash
cd backend

# Modo sem API (não precisa do backend rodando)
MOCK_API=1 npm run test:saft:conformidade

# Modo com API (backend em http://localhost:3001)
npm run test:saft:conformidade
```

O teste valida: configuração fiscal, aluno com BI, pagamento → recibo → DocumentoFinanceiro (hash), exportação SAFT e conformidade do XML.

---

## 11. Referências

- [SAFT_ANGOLA_ANALISE.md](./SAFT_ANGOLA_ANALISE.md) — Análise técnica do módulo SAFT
- [VALIDACAO_ANGOLA.md](./VALIDACAO_ANGOLA.md) — Validação Ministério da Educação e AGT
- [AGT — Portal do Contribuinte](https://www.agt.minfin.gov.ao)
- [SAF-T-AO Schema (ASSOFT)](https://github.com/assoft-portugal/SAF-T-AO)
- [PTI — AGT softwares certificados](https://pti.ao/agt-apresenta-lista-de-softwares-certificados-para-emissao-de-factura-electronica/)
