# Validação de Relatórios e Exportações — DSICOLA

Checklist para validar relatórios oficiais e exportações obrigatórias (ROADMAP-100).

---

## 1. Relatórios Oficiais

| Relatório | Endpoint/Fluxo | Validação |
|-----------|----------------|-----------|
| Histórico académico | Relatórios oficiais | Validar com instituição |
| Pauta | Relatórios oficiais | Validar formato com Ministério |
| Boletim | Relatórios oficiais | Validar campos obrigatórios |
| Certificado | Conclusão de curso | Validar com instituição |

**Próximo passo:** Agendar sessão de validação com utilizadores reais (secretaria, direção).

---

## 2. Exportações Obrigatórias

| Exportação | Implementação | Status |
|------------|---------------|--------|
| **SAFT** | Módulo fiscal | Ver [SAFT_ANGOLA_ANALISE.md](./SAFT_ANGOLA_ANALISE.md) |
| **Excel** | ExportButtons, relatórios | Em uso |
| **PDF** | jsPDF, relatórios | Em uso |

**Próximo passo:** Testar exportações em ambiente de staging; validar SAFT com contador/instituição.

---

## 3. Procedimento de Validação

1. **Staging:** Executar cada relatório/exportação com dados de teste
2. **Checklist:** Verificar campos obrigatórios, formato, assinaturas
3. **Utilizadores:** Enviar amostras para validação por secretaria/direção
4. **Registo:** Documentar feedback e ajustes realizados

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
