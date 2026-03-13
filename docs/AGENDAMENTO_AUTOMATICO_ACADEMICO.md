# Agendamento Automático Académico

> Funcionalidades de abertura automática baseadas em datas agendadas. Executam diariamente via scheduler (timezone: Africa/Luanda).

---

## 1. Abertura automática de Ano Letivo

**Horário:** 00:00 (meia-noite)

**Condições:**
- Ano letivo com `status = PLANEJADO`
- `dataInicio <= hoje`
- Não existe outro ano ATIVO na mesma instituição

**Ação:** Ativa o ano letivo (status → ATIVO). O administrador define a data de início ao criar o ano.

---

## 2. Abertura automática de Semestre (Ensino Superior)

**Horário:** 00:05

**Condições:**
- Semestre com `status = PLANEJADO`
- `dataInicio <= hoje`
- Ano letivo associado está ATIVO

**Ação:** Ativa o semestre e atualiza `AlunoDisciplina.status` de "Matriculado" para "Cursando".

---

## 3. Abertura automática de Trimestre (Ensino Secundário)

**Horário:** 00:10

**Condições:**
- Trimestre com `status = PLANEJADO`
- `dataInicio <= hoje`
- Ano letivo associado está ATIVO

**Ação:** Ativa o trimestre e atualiza `AlunoDisciplina.status` de "Matriculado" para "Cursando".

---

## 4. Abertura automática de Períodos de Lançamento de Notas

**Horário:** 00:15

**Condições:**
- Período com `status = FECHADO`
- `dataInicio <= hoje`
- `dataFim >= hoje` (janela ainda válida)

**Ação:** Abre o período (status → ABERTO). Professores podem lançar notas.

**Como usar:**
- Ao criar período em **Configuração de Ensinos → Períodos de Lançamento**, marque **"Agendar abertura"**
- O período será criado FECHADO e abrirá automaticamente na data início
- Alternativa: criar período ABERTO e depois fechá-lo; o scheduler reabrirá quando a janela chegar

---

## Auditoria

Todas as ações automáticas são registadas em auditoria com:
- `ANO_LETIVO_ATIVADO_AUTOMATICO`
- `TRIMESTRE_INICIADO_AUTOMATICO`
- `PERIODO_LANCAMENTO_NOTAS_ABERTO_AUTOMATICO`
- `SEMESTRE_INICIADO_AUTOMATICO` (existente)

---

## Ordem de execução (00:00–00:15)

1. **00:00** — Anos letivos (para que semestres/trimestres tenham ano ATIVO)
2. **00:05** — Semestres
3. **00:10** — Trimestres
4. **00:15** — Períodos de lançamento de notas
