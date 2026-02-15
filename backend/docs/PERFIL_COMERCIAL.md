# Perfil COMERCIAL

Perfil destinado à equipe de vendas e gestão comercial da empresa. Permite operações SaaS sem acesso a dados acadêmicos das instituições.

## O que pode fazer

| Ação | Detalhe |
|------|---------|
| Criar instituições | Via onboarding (`POST /onboarding/instituicao`) |
| Listar instituições | Ver todas as instituições |
| Atualizar instituição | Dados básicos (nome, contato, etc.) |
| Criar/editar assinaturas | Upgrade/downgrade de planos |
| Confirmar pagamentos | Pagamentos manuais de licença |
| Ver histórico de pagamentos | Todas as instituições |
| Ver planos e preços | Leitura (GET público) |

## O que NÃO pode fazer

| Restrição |
|-----------|
| Acessar dados acadêmicos (alunos, notas, turmas, disciplinas) |
| Acessar logs de auditoria sensíveis |
| Alterar configurações globais do sistema |
| Excluir instituições |
| Criar/editar/excluir planos (estrutura técnica) |
| Alterar 2FA de instituições |

## Criação de usuário COMERCIAL

### Via script (recomendado)

```bash
# Com variáveis padrão (comercial@dsicola.com / Comercial@123)
npx tsx scripts/seed-usuario-comercial.ts

# Com email e senha customizados
COMERCIAL_EMAIL=joao@empresa.com COMERCIAL_PASSWORD="SenhaForte@123" npx tsx scripts/seed-usuario-comercial.ts

# Com nome completo
COMERCIAL_EMAIL=maria@empresa.com COMERCIAL_NOME="Maria Vendas" npx tsx scripts/seed-usuario-comercial.ts
```

### Via SUPER_ADMIN (futuro)

O SUPER_ADMIN pode criar usuários COMERCIAL via painel, atribuindo a role `COMERCIAL`.

## Boas práticas

1. **Conta individual** – Cada vendedor deve ter sua própria conta (não compartilhar).
2. **Senha forte** – Exigida para o perfil COMERCIAL.
3. **Auditoria** – Todas as ações ficam registradas com o userId do COMERCIAL.

## Diferença: SUPER_ADMIN vs COMERCIAL

| | SUPER_ADMIN | COMERCIAL |
|---|-------------|-----------|
| Criar instituições | ✅ | ✅ |
| Gerenciar assinaturas | ✅ | ✅ |
| Confirmar pagamentos | ✅ | ✅ |
| Excluir instituições | ✅ | ❌ |
| Criar/editar planos | ✅ | ❌ |
| Logs globais | ✅ | ❌ |
| Configurações SaaS | ✅ | ❌ |
| Dados acadêmicos | ❌ (bloqueado) | ❌ (bloqueado) |
