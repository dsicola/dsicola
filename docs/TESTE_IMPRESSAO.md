# Guia de Teste de Impressão — DSICOLA

Este documento descreve como validar todas as funcionalidades de impressão e geração de PDFs.

## Execução rápida

```bash
# Verificar estrutura de exports e organização
npm run script:test-impressao
```

## Organização dos PDFs

| Módulo | Onde | Ação |
|--------|------|------|
| **Recibo / Fatura** | PrintReceiptDialog (Secretaria, POS, Aluno) | Recibo A4, Térmico, Fatura A4 |
| **Extrato Financeiro** | Minhas Mensalidades (Aluno) | Imprimir Extrato |
| **Mapa de Atrasos** | Gestão Financeira | Mapa de Atrasos (PDF) |
| **Relatório Receitas** | Gestão Financeira | Rel. Receitas Mês / Rel. Receitas Ano |
| **Ficha Cadastral** | Editar Aluno › Documentos | Gerar Ficha Cadastral |
| **Declaração Personalizada** | Editar Aluno › Documentos | Texto livre → Gerar PDF |
| **Lista de Alunos** | Professor › Relatórios | Lista de Alunos › Imprimir |
| **Boletim / Histórico / Pauta** | Relatórios Oficiais, Painel | window.print() |

## Teste funcional no browser

1. Iniciar frontend e backend: `npm run dev` (na pasta frontend).

2. **Como ALUNO:**
   - Ir a Minhas Mensalidades
   - Clicar "Imprimir Extrato" → deve baixar PDF
   - Em mensalidade paga, "Baixar Recibo" → dialog com Recibo A4, Térmico, Fatura A4

3. **Como ADMIN ou FINANCEIRO:**
   - Ir a Gestão Financeira (`/admin-dashboard/gestao-financeira`)
   - Clicar "Rel. Receitas Mês" → PDF
   - Clicar "Rel. Receitas Ano" → PDF
   - Clicar "Mapa de Atrasos (PDF)" (se houver atrasados) → PDF

4. **Como ADMIN ou SECRETARIA:**
   - Ir a um aluno (Editar Aluno)
   - Aba "Documentos"
   - "Gerar Ficha Cadastral (PDF)" → PDF
   - Declaração Personalizada: escrever texto → "Gerar Declaração (PDF)" → PDF

5. **Como PROFESSOR:**
   - Ir a Relatórios
   - Selecionar turma → aba "Lista de Alunos"
   - Clicar "Imprimir" → janela de impressão

6. **Como SECRETARIA:**
   - Sidebar: **Finanças** → Pagamentos (recibo/fatura via PrintReceiptDialog)
   - Sidebar: **Relatórios Financeiros** → Rel. Receitas Mês/Ano, Mapa Atrasos
   - Sidebar: **Relatórios Oficiais** → Pauta, Boletim, Histórico (window.print)
   - Sidebar: **Administrativo** → Editar Aluno → Documentos → Ficha Cadastral, Declaração

7. **Como ADMIN:**
   - Sidebar: **Relatórios Financeiros** → Gestão Financeira
   - Sidebar: **Relatórios Oficiais** → Pauta, Boletim, Histórico
   - Sidebar: **Administrativo** → Editar Aluno → Documentos

8. **Como PROFESSOR (Pauta):**
   - Sidebar: **Dashboard** → Relatórios → aba Pauta → botão Imprimir

## Navegação (sidebar)

| Módulo | Quem vê | Destino |
|--------|---------|---------|
| Finanças | ADMIN, SECRETARIA, FINANCEIRO, POS | Pagamentos (recibo/fatura) |
| Relatórios Financeiros | ADMIN, SECRETARIA, FINANCEIRO | Gestão Financeira (Receitas, Mapa) |
| Relatórios Oficiais | ADMIN, SECRETARIA, DIRECAO, COORDENADOR | Pauta, Boletim, Histórico |
| Administrativo | ADMIN, SECRETARIA, DIRECAO, COORDENADOR | Gestão Alunos (Ficha, Declaração) |

## Exports verificados (pdfGenerator.ts)

- `gerarReciboA4PDF` (RECIBO e FATURA)
- `downloadReciboA4`, `downloadFaturaA4`, `downloadReciboTermico`
- `downloadExtratoFinanceiro`, `downloadMapaAtrasos`, `downloadRelatorioReceitas`
- `downloadFichaCadastralAluno`, `downloadDeclaracaoPersonalizada`
- `downloadMatriculaReciboA4`, `downloadMatriculaReciboTermico`
- `gerarMatriculaReciboA4PDF`, `gerarMatriculaReciboTermicoPDF`
