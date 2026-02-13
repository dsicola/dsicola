# Progresso: Reorganização do Cadastro de Aluno

## ✅ CONCLUÍDO

### 1. Backend - Endpoints de Acesso
- ✅ Criado `user-access.controller.ts` com:
  - `getUserAccessInfo` - Ver informações de acesso
  - `createUserAccess` - Criar conta de acesso
  - `toggleUserAccess` - Ativar/desativar conta
  - `sendPasswordResetLink` - Enviar link de redefinição
- ✅ Rotas adicionadas em `user.routes.ts`:
  - `GET /users/:id/access` - Info de acesso
  - `POST /users/:id/access` - Criar conta
  - `PUT /users/:id/access` - Ativar/desativar
  - `POST /users/:id/access/reset-password` - Enviar reset
- ✅ Template de email `CRIACAO_CONTA_ACESSO` adicionado
- ✅ Backend ajustado para NÃO criar senha automaticamente para ALUNO

### 2. Frontend - Componente de Acesso
- ✅ Criado `AlunoAcessoAba.tsx` com:
  - Visualização de informações de acesso
  - Criar conta de acesso (com ou sem email)
  - Ativar/desativar conta
  - Enviar link de redefinição
  - Exibição de senha gerada (se não enviar email)

### 3. Frontend - CriarAluno
- ✅ Removidos campos de senha e confirmação
- ✅ Removida validação de senha
- ✅ Removido display de credenciais após criação
- ✅ Email agora é apenas para contato (não cria acesso)
- ✅ Backend não cria senha para ALUNO automaticamente

## 🔄 EM PROGRESSO

### 4. Frontend - EditarAluno
- ⏳ Adicionar aba "Acesso ao Sistema" (usando componente criado)
- ⏳ Reorganizar em abas institucionais:
  - Dados Pessoais
  - Endereço & Contactos
  - Responsáveis
  - Dados Acadêmicos
  - Matrículas / Histórico
  - Biblioteca (se aplicável)
  - Financeiro (somente leitura)
  - Documentos
  - 🔐 Acesso ao Sistema (só ADMIN/SECRETARIA)

### 5. RBAC
- ⏳ Garantir que aba "Acesso ao Sistema" só aparece para ADMIN/SECRETARIA
- ⏳ Backend já bloqueia (authorize('ADMIN', 'SECRETARIA'))
- ⏳ Frontend precisa verificar role antes de mostrar aba

### 6. Multi-tenant
- ✅ Backend usa `addInstitutionFilter(req)` - já implementado
- ✅ `instituicaoId` vem sempre do token JWT
- ✅ Frontend não envia `instituicaoId` manualmente

## 📋 PRÓXIMOS PASSOS

1. **Reorganizar EditarAluno em abas**
   - Usar componente Tabs do shadcn/ui
   - Separar dados em abas lógicas
   - Adicionar aba "Acesso ao Sistema" no final

2. **Garantir RBAC no frontend**
   - Verificar role antes de renderizar aba
   - Ocultar completamente para ALUNO

3. **Testes**
   - Criar aluno sem acesso
   - Criar conta via aba "Acesso ao Sistema"
   - Testar reset de senha
   - Verificar que ALUNO não vê aba

## 📝 NOTAS

- Email no cadastro é apenas para contato
- Conta de acesso é criada separadamente
- Senha nunca é exibida (exceto quando gerada e não enviada por email)
- Role ALUNO é fixa e não editável
- Multi-tenant já está garantido no backend

