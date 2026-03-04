# Paridade institucional — Lista de Funcionalidades e Relatórios Oficiais

Lista para validação de **paridade com referencial institucional**.  
Marcar com **OK**, **Parcial** ou **Em falta** conforme o estado atual.  
Objetivo: fechar todas as lacunas até **100%**.

---

## Módulos / Funcionalidades

| Módulo | Estado | Notas |
|--------|--------|-------|
| Gestão de instituição (dados, configuração, multi-tenant) | OK | Configuração completa, multi-tenant com isolamento |
| Gestão de utilizadores e perfis (ADMIN, SECRETARIA, PROFESSOR, ALUNO, etc.) | OK | 12+ roles, RBAC |
| Cursos, classes, turmas, turnos | OK | CRUD completo, Secundário + Superior |
| Disciplinas e matriz curricular | OK | Vinculação a cursos/classes |
| Matrículas (anual, por turma, por disciplina) | OK | Matrículas anuais e por turma |
| Ano letivo, trimestres/semestres, períodos | OK | Configuração de Ensinos |
| Planos de ensino e distribuição de aulas | OK | Planos, distribuição, aprovação |
| Lançamento de aulas e presenças | OK | Aulas ministradas, presenças |
| Avaliações e notas (lançamento, fechamento, correção) | OK | Avaliações, notas, correção com histórico |
| Período de lançamento de notas (abertura/reabertura) | OK | Configuração por período |
| Cálculo de médias e aprovação/reprovação | OK | Médias, aprovação/reprovação |
| Frequência (presenças, justificativas, relatórios) | OK | Presenças, justificativas, relatórios |
| Mensalidades (geração, multas, juros, pagamentos) | OK | Geração, multas, juros, pagamentos |
| Bolsas e descontos | OK | Bolsas, descontos por aluno |
| Emissão de documentos (certificados, declarações, recibos) | OK | Certificados, declarações, recibos |
| Documentos oficiais e pautas | OK | Pautas, boletins, relatórios oficiais |
| Relatórios académicos e oficiais | OK | Pautas, boletins, estatísticas |
| Recursos Humanos (funcionários, folha, férias, contratos) | OK | Funcionários, folha, contratos |
| Biblioteca (acervo, empréstimos) | OK | Acervo, empréstimos, reservas |
| Comunicados e notificações | OK | Comunicados, notificações |

| Módulo | Estado | Notas |
|--------|--------|-------|
| Calendário académico e eventos | OK | Calendário, eventos |
| Integração governamental (eventos, envio de dados) | OK | Eventos governamentais |
| SAFT / exportação fiscal | OK | Exportação SAFT |
| Licenciamento e planos comerciais | OK | Assinaturas, planos |
| Backup e restauro | OK | Backup automático, restore |
| Auditoria e logs de segurança | OK | Logs de auditoria |

---

## Relatórios Oficiais (a validar com Ministério / instituições)

| Relatório | Estado | Notas |
|-----------|--------|-------|
| Pauta por turma / disciplina | OK | Implementado |
| Boletim do aluno | OK | Implementado |
| Estatísticas de aprovação/reprovação | OK | Dashboard e relatórios |
| Lista de admitidos | OK | Matrículas turmas |
| Mapas de presença | OK | Relatórios de frequência |
| Relatórios financeiros (mensalidades, receitas) | OK | Gestão financeira |
| Outros relatórios exigidos pelo referencial | Parcial | Validar com instituições |

---

## Exportações obrigatórias

| Exportação | Estado | Notas |
|------------|--------|-------|
| SAFT (exportação fiscal) | OK | Exportação SAFT |
| Excel (listagens, pautas, etc.) | OK | ExportButtons, Excel |
| PDF (documentos, recibos, relatórios) | OK | PDF em documentos e boletins |

---

## Como usar

1. Preencher **Estado** com **OK**, **Parcial** ou **Em falta** após revisão do sistema.
2. Em **Notas**, indicar lacunas ou requisitos específicos do referencial (ex.: "referencial exige campo X no relatório Y").
3. Priorizar itens **Em falta** ou **Parcial** no planeamento de sprints.
4. Quando todos os itens estiverem **OK** (ou com exceções documentadas), a paridade pode ser considerada fechada para o nível 100%.

---

*Documento criado no âmbito do [ROADMAP-100.md](./ROADMAP-100.md). Última atualização: março 2026.*
