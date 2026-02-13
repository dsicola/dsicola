# 📅 Fluxo Completo de Gerenciamento de Semestres

## Visão Geral

O sistema suporta **início automático** e **início manual** de semestres. Este documento explica o fluxo completo desde a criação até o início do semestre.

---

## 🔄 Fluxo Completo

### 1️⃣ **CRIAÇÃO DO SEMESTRE**

#### Onde criar:
- **Interface**: Aba "Controle de Presenças" → Quando semestre não encontrado → Botão "Criar Semestre"
- **API**: `POST /semestres`

#### Campos obrigatórios:
- **Ano Letivo**: O ano acadêmico (ex: 2026)
- **Número**: 1 ou 2 (1º ou 2º Semestre)
- **Data de Início**: Data em que o semestre deve iniciar

#### Campos opcionais:
- **Data de Fim**: Data prevista de término do semestre
- **Observações**: Notas adicionais sobre o semestre

#### Status inicial:
- **Status**: `PLANEJADO` (aguardando início)
- **Estado**: `RASCUNHO`

#### Validações:
- ✅ Não pode existir dois semestres com mesmo ano + número para a mesma instituição
- ✅ Data de início deve ser válida
- ✅ Apenas ADMIN, DIRECAO, SUPER_ADMIN podem criar

---

### 2️⃣ **INÍCIO DO SEMESTRE**

Existem **duas formas** de iniciar um semestre:

#### A) **Início Automático** (Recomendado)

**Como funciona:**
1. O sistema executa um **scheduler diário** às 00:00
2. Busca semestres com:
   - `status = 'PLANEJADO'`
   - `dataInicio <= hoje`
3. Inicia automaticamente e atualiza:
   - Status do semestre: `PLANEJADO` → `INICIADO`
   - Alunos: `Matriculado` → `Cursando`
4. Registra auditoria automática

**Vantagens:**
- ✅ Automático, sem intervenção manual
- ✅ Executa no horário programado
- ✅ Processa todos os semestres elegíveis

**Quando usar:**
- Quando você quer que o semestre inicie automaticamente na data configurada
- Para planejamento de longo prazo

---

#### B) **Início Manual**

**Como funciona:**
1. Acesse: **Configuração de Ensinos** → **Controle de Presenças**
2. Selecione o contexto (Disciplina, Professor, Ano Letivo)
3. Se o semestre estiver `PLANEJADO`, aparecerá:
   - Informações do semestre
   - Botão "Iniciar Semestre Manualmente"
4. Clique no botão
5. O sistema:
   - Atualiza status: `PLANEJADO` → `INICIADO`
   - Atualiza alunos: `Matriculado` → `Cursando`
   - Registra quem iniciou e quando

**Vantagens:**
- ✅ Controle imediato
- ✅ Útil para testes ou ajustes
- ✅ Pode iniciar antes da data programada

**Quando usar:**
- Quando precisa iniciar antes da data configurada
- Para testes ou ajustes de última hora
- Quando o scheduler não executou ainda

---

### 3️⃣ **ESTADOS DO SEMESTRE**

| Status | Descrição | Ações Disponíveis |
|--------|-----------|-------------------|
| `PLANEJADO` | Semestre criado, aguardando início | ✅ Iniciar manualmente<br>✅ Editar (datas, observações)<br>⏰ Será iniciado automaticamente na data |
| `INICIADO` | Semestre em andamento | ✅ Visualizar informações<br>❌ Não pode editar<br>✅ Alunos podem ter presenças registradas |
| `ENCERRADO` | Semestre finalizado | ✅ Apenas visualização<br>❌ Não pode editar ou iniciar |
| `CANCELADO` | Semestre cancelado | ✅ Apenas visualização<br>❌ Não pode editar ou iniciar |

---

## 📋 Passo a Passo Completo

### Cenário 1: Criar e Iniciar Semestre (Fluxo Completo)

1. **Acesse**: Configuração de Ensinos → Controle de Presenças
2. **Selecione o contexto**:
   - Curso/Classe
   - Disciplina
   - Professor
   - Ano Letivo (ex: 2026)
   - Turma (opcional)
3. **Se semestre não existir**:
   - Aparecerá mensagem: "Semestre não encontrado"
   - Clique em **"Criar Semestre"**
4. **Preencha o formulário**:
   - Número: 1 ou 2
   - Data de Início: Ex: 01/02/2026
   - Data de Fim: (Opcional) Ex: 30/06/2026
   - Observações: (Opcional)
5. **Clique em "Criar Semestre"**
6. **Escolha como iniciar**:
   - **Opção A**: Aguarde a data de início (início automático)
   - **Opção B**: Clique em "Iniciar Semestre Manualmente" (início imediato)

---

### Cenário 2: Semestre Já Criado, Iniciar Manualmente

1. **Acesse**: Configuração de Ensinos → Controle de Presenças
2. **Selecione o contexto** (com ano letivo correto)
3. **Se o semestre estiver `PLANEJADO`**:
   - Verá informações do semestre
   - Data de início programada
   - Botão "Iniciar Semestre Manualmente"
4. **Clique em "Iniciar Semestre Manualmente"**
5. **Confirmação**: Mensagem de sucesso com número de alunos atualizados

---

## ⚙️ Funcionalidades Técnicas

### Scheduler Automático

- **Frequência**: Diário às 00:00
- **Processo**: 
  - Busca semestres `PLANEJADO` com `dataInicio <= hoje`
  - Inicia cada semestre encontrado
  - Atualiza alunos de `Matriculado` para `Cursando`
  - Registra auditoria

### Idempotência

- ✅ Iniciar manualmente um semestre já iniciado **não causa erro**
- ✅ Apenas atualiza alunos que ainda estão `Matriculado`
- ✅ Scheduler ignora semestres já iniciados

### Multi-tenant

- ✅ Cada instituição gerencia seus próprios semestres
- ✅ Filtros automáticos por `instituicaoId`
- ✅ Isolamento completo de dados

### Auditoria

- ✅ Todas as ações são registradas:
  - Criação de semestre
  - Início manual
  - Início automático
  - Edições
- ✅ Registra: quem, quando, o que foi alterado

---

## 🔍 Verificações e Validações

### Ao Criar Semestre:
- ✅ Ano letivo obrigatório
- ✅ Número obrigatório (1 ou 2)
- ✅ Data de início obrigatória
- ✅ Não pode duplicar (mesmo ano + número)
- ✅ Apenas ADMIN, DIRECAO, SUPER_ADMIN

### Ao Iniciar Semestre:
- ✅ Semestre deve existir
- ✅ Status deve ser `PLANEJADO` ou `INICIADO`
- ✅ Não pode iniciar se `ENCERRADO` ou `CANCELADO`
- ✅ Apenas ADMIN, DIRECAO, SUPER_ADMIN

### Ao Editar Semestre:
- ✅ Só pode editar se status = `PLANEJADO`
- ✅ Não pode editar se já iniciado/encerrado
- ✅ Apenas ADMIN, DIRECAO, SUPER_ADMIN

---

## 📊 Impacto do Início do Semestre

Quando um semestre é iniciado (automático ou manual):

1. **Status do Semestre**: `PLANEJADO` → `INICIADO`
2. **Alunos Matriculados**: 
   - Status: `Matriculado` → `Cursando`
   - Apenas alunos do mesmo ano letivo e semestre
   - Filtrado por instituição
3. **Presenças**:
   - Alunos com status `Cursando` podem ter presenças registradas
   - Alunos `Matriculado` não podem ter presenças (aparece mensagem)
4. **Auditoria**:
   - Registra ação (automática ou manual)
   - Registra quem iniciou (se manual)
   - Registra quantos alunos foram atualizados

---

## 🎯 Resumo do Fluxo

```
1. CRIAR SEMESTRE
   ↓
   [Status: PLANEJADO]
   ↓
2. AGUARDAR DATA OU INICIAR MANUALMENTE
   ↓
   [Início Automático] OU [Início Manual]
   ↓
   [Status: INICIADO]
   ↓
3. ALUNOS ATUALIZADOS
   [Matriculado → Cursando]
   ↓
4. PRESENÇAS PODEM SER REGISTRADAS
   ✅ Sistema funcional
```

---

## ❓ Perguntas Frequentes

**P: Posso iniciar um semestre antes da data configurada?**
R: Sim! Use o início manual. O semestre será iniciado imediatamente.

**P: O que acontece se eu iniciar manualmente e depois chegar a data?**
R: Nada! O scheduler verifica o status e ignora semestres já iniciados.

**P: Posso criar dois semestres para o mesmo ano?**
R: Sim! Crie o Semestre 1 e depois o Semestre 2, ambos para o mesmo ano letivo.

**P: Como sei se o semestre foi iniciado automaticamente?**
R: No histórico de auditoria, a ação será `SEMESTRE_INICIADO_AUTOMATICO` e `iniciadoPor` será `null`.

**P: E se eu iniciar manualmente?**
R: A ação será `SEMESTRE_INICIADO_MANUAL` e `iniciadoPor` terá o ID do usuário que iniciou.

---

## ✅ Checklist de Configuração

- [ ] Semestre criado com ano letivo correto
- [ ] Data de início configurada
- [ ] Número do semestre correto (1 ou 2)
- [ ] Semestre iniciado (automático ou manual)
- [ ] Alunos atualizados para "Cursando"
- [ ] Presenças podem ser registradas

---

**Última atualização**: 2025-01-27

