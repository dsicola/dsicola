# Onboarding guiado — DSICOLA

Guia para verificação de “primeiro uso” e dados mínimos antes de aceder aos módulos principais.  
Alinhado ao ROADMAP-100 — operação.

---

## Objetivo

Garantir que a instituição tenha dados mínimos configurados antes de usar módulos pesados (matrículas, notas, financeiro), reduzindo erros e melhorando a experiência.

---

## Dados mínimos recomendados

| Ordem | Item | Onde configurar | Obrigatório? |
|-------|------|-----------------|--------------|
| 1 | Nome e dados da instituição | Configurações → Instituição | Sim |
| 2 | Ano letivo ativo | Ano Letivo | Sim |
| 3 | Semestres/Trimestres | Semestres / Trimestres | Sim |
| 4 | Turmas | Turmas | Para matrículas |
| 5 | Disciplinas | Disciplinas | Para planos de ensino |
| 6 | Professores | Professores | Para planos e notas |
| 7 | Parâmetros de sistema (média mínima, etc.) | Parâmetros | Recomendado |

---

## Fluxo sugerido (primeiro uso)

1. **Login como Admin** → Dashboard
2. **Configurações** → Preencher nome, telefone, endereço da instituição
3. **Ano Letivo** → Criar e ativar ano letivo
4. **Semestres** (Superior) ou **Trimestres** (Secundário) → Criar períodos
5. **Turmas** → Criar pelo menos uma turma
6. **Disciplinas** → Cadastrar disciplinas
7. **Professores** → Cadastrar e vincular a disciplinas
8. **Parâmetros** → Definir média mínima, tipo de média, etc.

---

## Verificação programática (opcional)

Para implementar um “wizard” ou bloqueio de módulos até dados mínimos:

- Consultar `GET /api/ano-letivos` — deve existir ano ativo
- Consultar `GET /api/configuracoes-instituicao` — deve ter nome preenchido
- Consultar `GET /api/turmas` — para matrículas, deve haver turmas
- Consultar `GET /api/parametros-sistema` — para notas, deve haver parâmetros

---

## Referências

- [DOCUMENTACAO_UTILIZADOR.md](./DOCUMENTACAO_UTILIZADOR.md) — guia por perfil
- [ROADMAP-100.md](./ROADMAP-100.md) — itens de operação

---

*Documento criado no âmbito do ROADMAP-100.md.*
