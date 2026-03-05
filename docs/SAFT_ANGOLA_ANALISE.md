# SAFT-AO Angola — Análise e Conformidade

## Resumo

O módulo de exportação SAFT do DSICOLA gera ficheiros XML no formato **SAF-T AO** (Standard Audit File for Tax — Angola), conforme Decreto Presidencial nº 312/18 e Decreto Executivo nº 317/20.

---

## Base Legal (Angola)

- **Decreto Presidencial nº 312/18** (21 Dez 2018): Regime de submissão eletrónica dos elementos contabilísticos
- **Decreto Executivo nº 317/20** (14 Dez 2020): Alterações à estrutura do ficheiro
- **Schema XSD oficial:** [ASSOFT/SAF-T-AO](https://github.com/assoft-portugal/SAF-T-AO) (projeto colaborativo AGT)

---

## O que está implementado

| Componente | Status | Notas |
|------------|--------|-------|
| **Namespace** | ✅ | `urn:OECD:StandardAuditFile-Tax:AO_1.01_01` |
| **Moeda** | ✅ | AOA |
| **País** | ✅ | AO |
| **Header** | ✅ | CompanyID, TaxRegistrationNumber (NIF), CompanyName, CompanyAddress, etc. |
| **Clientes (Customer)** | ✅ | Alunos como clientes, BI como CustomerTaxID |
| **Produtos (Product)** | ✅ | Cursos + produto padrão PROPINA |
| **Tabela de Impostos** | ✅ | IVA ISE (isento) |
| **Faturas (SalesInvoices)** | ✅ | Mensalidades pagas como faturas |
| **Mecanismos de pagamento** | ✅ | TB (transferência), MB (Multicaixa), CH (cheque), NU (numerário) |
| **Multi-tenant** | ✅ | Isolamento por instituição, SUPER_ADMIN com query param |
| **Validação pré-geração** | ✅ | NIF, email fiscal, nome fiscal obrigatórios |

---

## Dados fiscais obrigatórios

Configure em **Configurações da Instituição > Dados Fiscais**:

- **NIF** (Número de Identificação Fiscal) — obrigatório
- **Nome Fiscal**
- **Email Fiscal**
- **Endereço Fiscal**
- **Telefone Fiscal**
- **Código Postal** (opcional)

---

## Estrutura do XML gerado

```
AuditFile (AO_1.01_01)
├── Header (dados da empresa, período, moeda AOA)
├── MasterFiles
│   ├── GeneralLedgerAccounts (conta 11 - Caixa)
│   ├── Customer (clientes = alunos)
│   ├── Product (cursos + PROPINA)
│   └── TaxTable (IVA isento)
└── SourceDocuments
    └── SalesInvoices (mensalidades pagas)
```

---

## Rotas e permissões

| Rota | Método | Permissões |
|------|--------|------------|
| `/saft-exports` | GET | ADMIN, SUPER_ADMIN |
| `/saft-exports` | POST | ADMIN, SUPER_ADMIN |
| `/saft-exports/:id` | GET | ADMIN, SUPER_ADMIN |
| `/saft-exports/:id/download` | GET | ADMIN, SUPER_ADMIN |

**SUPER_ADMIN:** usar `?instituicaoId=xxx` na query para definir o escopo.

---

## Validações obrigatórias (conformidade AGT)

Antes de gerar o ficheiro, o sistema valida:

| Campo | Validação |
|-------|-----------|
| **NIF empresa** | Obrigatório em Configurações > Dados Fiscais |
| **Nome/Email fiscal** | Obrigatório |
| **Cliente (BI/NIF)** | Cada fatura exige cliente com BI/NIF válido |
| **Número documento** | Nº recibo obrigatório em cada fatura |
| **Data transação** | Data de pagamento obrigatória |
| **Valores** | Valor e impostos (IVA isento) validados |

## Logs de auditoria

Cada geração de SAFT é registada em `logs_auditoria` com:
- `modulo`: SAFT
- `entidade`: SAFT_EXPORT
- `dadosNovos`: período, instituição, totais, utilizador

## Limitações conhecidas

1. **WorkingDocuments** — Secção não implementada (documentos de conferência). Para instituições de ensino com apenas propinas, pode não ser exigida.
2. **Payments** — Pagamentos estão dentro de cada Invoice; secção Payments separada não implementada.
3. **Download histórico** — O backend não armazena o XML; o download só funciona imediatamente após a geração (o frontend guarda o XML em estado).
4. **Validação XSD** — O XML não é validado contra o schema oficial antes do download.

---

## Recomendações

1. **Validar com contabilista** — Enviar amostra do XML gerado para validação antes de submissão à AGT.
2. **Submissão** — Portal do Contribuinte da AGT: [Serviços | Portal do Contribuinte](https://www.agt.minfin.gov.ao)
3. **Periodicidade** — Contribuintes com volume relevante devem submeter mensalmente (até dia 20 do mês seguinte).

---

## Teste

```bash
cd backend && npm run test:saft
```

Ou com seed multi-tenant:
```bash
npm run test:saft:full
```
