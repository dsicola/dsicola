# Auditoria: Sistema de E-mail - Multi-Tenant e Segurança

## ✅ Verificações Realizadas

### 1. Multi-Tenant - Instituição ID

#### ✅ EmailService.registrarEmail()
- **Validação 1**: Se `req` está disponível e não há `instituicaoId` nas options, tenta obter via `requireTenantScope(req)`
- **Validação 2**: Se `req` está disponível e há `instituicaoId` nas options, valida que corresponde ao do contexto
- **Exceção**: SUPER_ADMIN pode enviar para qualquer instituição
- **Resultado**: ✅ SEGURO

#### ✅ EmailService.sendEmail()
- **Validação 1**: Valida multi-tenant antes de enviar
- **Validação 2**: Se `instituicaoId` nas options não corresponde ao do contexto, usa o do contexto
- **Exceção**: SUPER_ADMIN pode enviar para qualquer instituição
- **Resultado**: ✅ SEGURO

### 2. Pontos de Integração

#### ✅ Criação de Instituição (onboarding.controller.ts)
- **instituicaoId**: `result.instituicao.id` (vem do banco após criação)
- **req**: Disponível (SUPER_ADMIN)
- **Validação**: ✅ Correto - instituição recém-criada

#### ✅ Criação de Instituição (instituicao.controller.ts)
- **instituicaoId**: `instituicao.id` (vem do banco após criação)
- **req**: Disponível (SUPER_ADMIN)
- **Validação**: ✅ Correto - instituição recém-criada

#### ✅ Candidatura Aprovada (candidatura.controller.ts)
- **instituicaoId**: `candidatura.instituicaoId` (vem do banco, já filtrado por `addInstitutionFilter`)
- **req**: Disponível (ADMIN/SECRETARIA)
- **Validação**: ✅ Correto - candidatura já validada por filtro multi-tenant

#### ✅ Recuperação de Senha (auth.service.ts)
- **instituicaoId**: `user.instituicaoId` (vem do banco)
- **req**: Opcional (pode ser null em rotas públicas)
- **Validação**: ✅ Correto - email do usuário já validado

#### ✅ Assinatura Ativada - Webhook (pagamentoLicenca.controller.ts)
- **instituicaoId**: `assinaturaCompleta.instituicaoId` (vem do banco)
- **req**: Disponível mas `req.user` pode ser null (webhook não autenticado)
- **Validação**: ✅ Correto - assinatura já validada pelo pagamento

#### ✅ Assinatura Ativada - Manual (assinatura.controller.ts)
- **instituicaoId**: `assinatura.instituicaoId` (vem do banco)
- **req**: Disponível (ADMIN/SUPER_ADMIN)
- **Validação**: ✅ Correto - assinatura já validada por filtro multi-tenant

#### ✅ Assinatura Expirada (license.middleware.ts)
- **instituicaoId**: `assinatura.instituicaoId` (vem do banco)
- **req**: Disponível (usuário autenticado)
- **Validação**: ✅ Correto - assinatura já validada pelo middleware

### 3. Segurança Multi-Tenant

#### ✅ Proteções Implementadas

1. **Validação no EmailService.sendEmail()**:
   - Se `req.user` existe e `instituicaoId` nas options não corresponde ao do contexto
   - Bloqueia e usa `instituicaoId` do contexto
   - Exceção: SUPER_ADMIN pode enviar para qualquer instituição

2. **Validação no EmailService.registrarEmail()**:
   - Mesma validação aplicada antes de salvar no banco
   - Garante que logs sempre têm `instituicaoId` correto

3. **Filtros nos Controllers**:
   - Todos os controllers usam `addInstitutionFilter(req)` ou `requireTenantScope(req)`
   - Dados sempre vêm do banco após validação multi-tenant

### 4. Casos Especiais

#### ✅ Webhook (sem autenticação)
- **Situação**: `req.user` é null
- **Solução**: `instituicaoId` passado explicitamente nas options (vem do banco)
- **Validação**: ✅ Seguro - `instituicaoId` vem do pagamento/assinatura validado

#### ✅ Recuperação de Senha (rota pública)
- **Situação**: `req` pode ser null
- **Solução**: `instituicaoId` passado explicitamente nas options (vem do `user.instituicaoId`)
- **Validação**: ✅ Seguro - email do usuário já validado

#### ✅ SUPER_ADMIN
- **Situação**: Pode criar instituições e enviar e-mails
- **Solução**: Validação permite `instituicaoId` diferente quando é SUPER_ADMIN
- **Validação**: ✅ Correto - SUPER_ADMIN tem permissão total

### 5. Fluxo de Dados

```
Controller → Busca dados com filtro multi-tenant → EmailService.sendEmail()
                                                          ↓
                                    Valida instituicaoId (se req disponível)
                                                          ↓
                                    Envia e-mail
                                                          ↓
                                    EmailService.registrarEmail()
                                                          ↓
                                    Valida instituicaoId novamente
                                                          ↓
                                    Salva em EmailEnviado com instituicaoId correto
```

## ✅ Conclusão

**TODOS OS PONTOS DE INTEGRAÇÃO ESTÃO SEGUROS E CONFORMES COM MULTI-TENANT**

- ✅ `instituicaoId` sempre vem do banco de dados (nunca do frontend)
- ✅ Validação dupla no EmailService (sendEmail + registrarEmail)
- ✅ Controllers usam filtros multi-tenant antes de buscar dados
- ✅ Casos especiais (webhook, recuperação de senha) tratados corretamente
- ✅ SUPER_ADMIN tem permissão apropriada
- ✅ Logs sempre têm `instituicaoId` correto

## 🔒 Garantias de Segurança

1. **Nenhum usuário pode enviar e-mail para outra instituição**
   - Validação bloqueia tentativas
   - Usa `instituicaoId` do contexto quando detecta discrepância

2. **Logs sempre têm `instituicaoId` correto**
   - Validação garante que mesmo se `instituicaoId` errado for passado, será corrigido

3. **Dados sempre validados antes de enviar**
   - Controllers filtram por instituição antes de buscar dados
   - EmailService valida novamente antes de enviar

## 📝 Notas

- Webhooks não têm autenticação JWT, mas `instituicaoId` vem do banco (seguro)
- Recuperação de senha é rota pública, mas `instituicaoId` vem do usuário encontrado (seguro)
- SUPER_ADMIN pode enviar para qualquer instituição (comportamento esperado)

