# Diagnóstico: Mensalidades não aparecem na lista

## 🔍 Problema Identificado

As mensalidades estão no banco de dados, mas não aparecem na lista do frontend.

## 📊 Situação Atual

### Mensalidades no Banco
- **Total**: 4 mensalidades
- **Instituição**: `83fd37be-73f2-46bd-b5b6-e79d80ecaef1` (ISPC)
- **Alunos**: 
  - Jeremiass Tito (tito@gmail.com) - 2 mensalidades (11/2025 e 12/2025)
  - Aluno Teste (aluno@gmail.com) - 2 mensalidades (11/2025 e 12/2025)

### Usuários que PODEM ver as mensalidades
1. ✅ **Fernando Lutunda** (teste3@gmail.com) - `instituicaoId: 83fd37be-73f2-46bd-b5b6-e79d80ecaef1`
2. ✅ **Super Administrador** (superadmin@dsicola.com) - SUPER_ADMIN (vê todas)

### Usuários que NÃO PODEM ver as mensalidades
1. ❌ **Daniel António** (teste@gmail.com) - `instituicaoId: ed20cc2c-22fa-4a95-aae7-803232955840` (diferente)
2. ❌ **Marcolino Daniel** (teste2uni@gmail.com) - `instituicaoId: 9991a1bf-1ec9-4c83-b71f-f594f0af97c3` (diferente)

## 🔧 Correções Aplicadas

1. ✅ **Filtro do Frontend**: Agora usa `aluno` (do backend) como principal e `profiles` como fallback
2. ✅ **Tratamento de Erros**: Se a busca de profiles falhar, continua usando dados do aluno
3. ✅ **Logs Melhorados**: Adicionados logs detalhados no backend e frontend para diagnóstico

## 📝 Como Verificar o Problema

### 1. Verificar qual usuário está logado
- Abra o DevTools do navegador (F12)
- Vá para **Console**
- Procure por logs que começam com `[GestaoFinanceira]`
- Verifique o `instituicaoId from hook`

### 2. Verificar o token JWT
- Abra o DevTools
- Vá para **Application** > **Local Storage**
- Procure por `accessToken` ou `token`
- Copie o token
- Acesse https://jwt.io
- Cole o token e verifique o campo `instituicaoId`
- **Deve ser**: `83fd37be-73f2-46bd-b5b6-e79d80ecaef1` para ver as mensalidades

### 3. Verificar logs do Backend
- No terminal onde o backend está rodando
- Procure por logs que começam com `[getMensalidades]`
- Verifique:
  - `instituicaoId` do usuário
  - Quantas mensalidades foram encontradas
  - Se há algum erro

### 4. Verificar logs do Frontend
- No console do navegador
- Procure por logs que começam com `[GestaoFinanceira]`
- Verifique:
  - Quantas mensalidades foram recebidas
  - Se há algum erro

## 🎯 Soluções Possíveis

### Se o usuário logado não é o "Fernando Lutunda":
1. **Faça login com o usuário correto**: `teste3@gmail.com` (Fernando Lutunda)
2. **OU** faça login como Super Admin: `superadmin@dsicola.com`

### Se o token não tem o `instituicaoId` correto:
1. **Faça logout e login novamente** para gerar um novo token
2. Verifique se o usuário tem `instituicaoId` configurado no banco

### Se o `instituicaoId` do usuário está diferente:
1. **Atualize o `instituicaoId` do usuário** no banco de dados para `83fd37be-73f2-46bd-b5b6-e79d80ecaef1`
2. **OU** crie mensalidades para a instituição do usuário logado

## 📋 Checklist de Verificação

- [ ] Verificar qual usuário está logado
- [ ] Verificar `instituicaoId` no token JWT
- [ ] Verificar logs do backend
- [ ] Verificar logs do frontend
- [ ] Confirmar que o `instituicaoId` do usuário corresponde ao das mensalidades
- [ ] Testar com usuário "Fernando Lutunda" (teste3@gmail.com)
- [ ] Testar com Super Admin (superadmin@dsicola.com)

## 🚀 Próximos Passos

1. **Teste agora**: Recarregue a página de Gestão Financeira
2. **Verifique os logs**: No console do navegador e no terminal do backend
3. **Compartilhe os logs**: Se ainda não funcionar, compartilhe os logs para análise mais detalhada

