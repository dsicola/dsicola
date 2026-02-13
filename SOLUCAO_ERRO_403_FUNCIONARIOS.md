# Solução: Erro 403 ao Acessar /funcionarios

## Problema
O erro `403 Forbidden` ao acessar `/funcionarios` ocorre porque o middleware `validateLicense` está bloqueando o acesso quando a instituição não possui uma assinatura ativa.

## Soluções para Desenvolvimento

### Opção 1: Bypass de Validação (Recomendado para Dev)

Adicione no arquivo `.env` do backend:

```bash
# Backend .env
NODE_ENV=development
BYPASS_LICENSE_VALIDATION=true
```

Isso desabilita completamente a validação de licença em desenvolvimento.

### Opção 2: Criação Automática de Assinatura

Adicione no arquivo `.env` do backend:

```bash
# Backend .env
NODE_ENV=development
AUTO_CREATE_LICENSE=true
```

Isso cria automaticamente uma assinatura ativa quando a instituição não tiver uma.

**Requisitos:**
- Deve existir pelo menos um plano ativo no banco de dados
- O plano será vinculado automaticamente à instituição

### Opção 3: Criar Assinatura Manualmente (Super Admin)

1. Acesse a área de Super Admin
2. Vá para "Assinaturas"
3. Crie uma nova assinatura para a instituição
4. Configure status como "ativa"
5. Defina uma data de fim válida (ex: 1 ano a partir de hoje)

### Opção 4: Usar Role SUPER_ADMIN

Usuários com role `SUPER_ADMIN` ignoram completamente a validação de licença.

## Verificação

Para verificar se a solução funcionou:

1. Reinicie o servidor backend
2. Tente acessar `/funcionarios` novamente
3. Verifique os logs do backend para mensagens de validação

## Mensagens de Erro Melhoradas

O middleware agora retorna mensagens mais claras em desenvolvimento, incluindo instruções sobre como resolver o problema.

## Produção

⚠️ **IMPORTANTE**: NUNCA use `BYPASS_LICENSE_VALIDATION=true` ou `AUTO_CREATE_LICENSE=true` em produção!

Em produção, todas as instituições devem ter assinaturas válidas e ativas.

## Estrutura do .env (Exemplo)

```bash
# Backend .env
DATABASE_URL=postgresql://user:password@localhost:5432/dsicola
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Desenvolvimento - Escolha UMA das opções abaixo:
BYPASS_LICENSE_VALIDATION=true
# OU
AUTO_CREATE_LICENSE=true
```

