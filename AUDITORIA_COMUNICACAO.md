# AUDITORIA DE COMUNICAÇÃO INSTITUCIONAL - DSICOLA

## FASE 1 - INVENTÁRIO COMPLETO

### Sistemas de Comunicação Identificados

#### 1. COMUNICADOS ✅
- **Tabela**: `Comunicado`
- **InstituicaoId**: ✅ SIM (`instituicao_id`)
- **Controller**: `comunicado.controller.ts` - ✅ Usa `addInstitutionFilter`
- **Status**: **SEGURO** - Multi-tenant implementado corretamente

#### 2. MENSAGENS RESPONSÁVEL ↔ PROFESSOR ❌
- **Tabela**: `MensagemResponsavel`
- **InstituicaoId**: ❌ **NÃO TEM** - CRÍTICO
- **Controller**: `mensagemResponsavel.controller.ts` - ❌ **NÃO usa** `addInstitutionFilter`
- **Status**: **VULNERÁVEL** - Mensagens podem cruzar tenants

#### 3. NOTIFICAÇÕES ❌
- **Tabela**: `Notificacao`
- **InstituicaoId**: ❌ **NÃO TEM** - CRÍTICO
- **Controller**: `notificacao.controller.ts` - ❌ **NÃO usa** `addInstitutionFilter`
- **Status**: **VULNERÁVEL** - Notificações podem cruzar tenants

#### 4. EMAILS ENVIADOS ✅
- **Tabela**: `EmailEnviado`
- **InstituicaoId**: ✅ SIM (`instituicao_id`)
- **Controller**: `emailEnviado.controller.ts` - ✅ Usa `addInstitutionFilter`
- **Status**: **SEGURO** - Mas precisa validar envio

#### 5. EMAIL TEMPLATES ⚠️
- **Tabela**: `EmailTemplate`
- **InstituicaoId**: ❌ NÃO TEM (pode ser compartilhado entre instituições - OK)
- **Status**: **ACEITÁVEL** - Templates podem ser globais

## FASE 2 - PROBLEMAS IDENTIFICADOS

### CRÍTICOS ❌

1. **MensagemResponsavel** - Falta `instituicao_id`
   - Um responsável de uma instituição pode ver mensagens de outra
   - Professor pode enviar mensagem para aluno de outra instituição

2. **Notificacao** - Falta `instituicao_id`
   - Usuário de uma instituição pode ver notificações de outra
   - Notificações podem ser enviadas para usuários de tenants diferentes

3. **Validações de Permissão Ausentes**
   - Não verifica se responsável pertence ao aluno
   - Não verifica se professor leciona para o aluno
   - Não valida tenant antes de criar notificação

### MÉDIOS ⚠️

1. **Falta Auditoria de Comunicação**
   - Não registra logs de MESSAGE_SENT, EMAIL_SENT, etc.
   - Não detecta tentativas de comunicação inválida

2. **Envio de Email sem Validação de Tenant**
   - Funções Supabase enviam emails sem validar `instituicao_id`
   - Risco de email enviado para tenant errado

## FASE 3 - CORREÇÕES NECESSÁRIAS

### Prioridade 1 - CRÍTICO

1. ✅ Migration: Adicionar `instituicao_id` em `MensagemResponsavel`
2. ✅ Migration: Adicionar `instituicao_id` em `Notificacao`
3. ✅ Corrigir `mensagemResponsavel.controller.ts`:
   - Adicionar `addInstitutionFilter`
   - Validar que responsável/aluno/professor pertencem ao mesmo tenant
   - Validar relação responsável-aluno
   - Validar relação professor-aluno
4. ✅ Corrigir `notificacao.controller.ts`:
   - Adicionar `addInstitutionFilter`
   - Validar tenant ao criar notificação
   - Validar que usuário destino pertence ao tenant do criador

### Prioridade 2 - ALTO

5. ✅ Criar serviço centralizado de comunicação
6. ✅ Adicionar auditoria para comunicação:
   - MESSAGE_SENT
   - MESSAGE_READ
   - EMAIL_SENT
   - EMAIL_FAILED
   - BLOCK_COMMUNICATION
7. ✅ Padronizar envio de emails com validação de tenant

### Prioridade 3 - MÉDIO

8. ⚠️ Validar envio de emails nas Supabase Functions
9. ⚠️ Adicionar testes de isolamento de tenant

## FASE 4 - REGRAS DE COMUNICAÇÃO

### QUEM PODE COMUNICAR COM QUEM

#### Aluno ↔ Professor
- ✅ Permitido se:
  - Mesma instituição
  - Professor leciona disciplina do aluno
  - Aluno matriculado na turma do professor

#### Aluno ↔ Instituição
- ✅ Permitido via Comunicado
- ✅ Filtrado por instituição

#### Professor ↔ Instituição
- ✅ Permitido via Comunicado
- ✅ Filtrado por instituição

#### Responsável ↔ Professor
- ✅ Permitido se:
  - Mesma instituição
  - Responsável é responsável pelo aluno
  - Professor leciona para o aluno

#### Super-Admin ↔ Instituições
- ✅ Super-Admin pode comunicar com qualquer instituição
- ⚠️ Mas logs devem registrar tenant de destino

## FASE 5 - FLUXO TÉCNICO

### Para Mensagens Internas
```
1. Validar tenant (instituicao_id do JWT)
2. Validar permissão (relação entre remetente e destinatário)
3. Criar mensagem com instituicao_id
4. Registrar MESSAGE_SENT na auditoria
5. Criar notificação para destinatário (com mesmo tenant)
```

### Para Email
```
1. Validar tenant (instituicao_id do JWT)
2. Validar que destinatário pertence ao tenant
3. Enviar email
4. Registrar EMAIL_SENT ou EMAIL_FAILED na auditoria
5. Salvar em EmailEnviado com instituicao_id
```

### Bloqueio de Comunicação
```
1. Tentativa de comunicação inválida detectada
2. Registrar BLOCK_COMMUNICATION na auditoria
3. Retornar erro 403 Forbidden
4. Não criar mensagem/email
```

