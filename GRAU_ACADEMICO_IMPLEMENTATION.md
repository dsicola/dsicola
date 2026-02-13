# Implementação do Campo "Grau Académico" - DSICOLA

## Resumo
Implementação do campo "Grau Académico" para Funcionários e Professores com integração completa Frontend + Backend.

## Arquivos Alterados

### Backend

1. **`backend/prisma/schema.prisma`**
   - Adicionados campos ao model `Funcionario`:
     - `grauAcademico String? @map("grau_academico")` - Grau académico principal
     - `grauAcademicoOutro String? @map("grau_academico_outro")` - Campo condicional para "Outro"

2. **`backend/src/controllers/funcionario.controller.ts`**
   - **getAll**: Incluídos `grau_academico` e `grau_academico_outro` nas respostas
   - **getById**: Incluídos `grau_academico` e `grau_academico_outro` nas respostas
   - **create**: Aceita `grauAcademico` e `grauAcademicoOutro` (camelCase e snake_case)
   - **update**: Aceita `grauAcademico` e `grauAcademicoOutro`, convertendo strings vazias para null

### Frontend

3. **`frontend/src/components/rh/FuncionarioFormDialog.tsx`**
   - Adicionados campos `grau_academico` e `grau_academico_outro` ao state do formulário
   - Adicionado campo Select "Grau Académico" na seção "Informações Pessoais Adicionais"
   - Implementado campo condicional "Especifique o Grau Académico" quando "Outro" é selecionado
   - Campos incluídos na inicialização do formulário (resetForm e useEffect para edição)
   - Campos incluídos no payload enviado ao backend (create/update)

## Opções de Grau Académico

- Ensino Médio
- Técnico
- Bacharelato
- Licenciatura
- Pós-graduação
- Mestrado
- Doutoramento
- Outro (com campo condicional para especificação)

## Comandos para Aplicar as Mudanças

```bash
# 1. Navegar para a pasta do backend
cd backend

# 2. Criar a migration do Prisma
npx prisma migrate dev --name add_grau_academico_to_funcionario

# 3. Gerar o Prisma Client atualizado
npx prisma generate

# 4. Iniciar o servidor backend (se não estiver rodando)
npm run dev
```

**Nota**: A migration criará os campos como opcionais (nullable), garantindo que dados existentes não sejam afetados.

## Validações e Comportamento

### Backend
- Campos são opcionais (podem ser null)
- Aceita tanto camelCase (`grauAcademico`) quanto snake_case (`grau_academico`)
- No update, strings vazias são convertidas para `null`
- Multi-tenant: `instituicaoId` sempre vem do token (nunca aceita do frontend)

### Frontend
- Campo Select com placeholder "Selecione o grau académico"
- Campo condicional "Especifique" aparece apenas quando "Outro" é selecionado
- Campos são inicializados como strings vazias (evita warnings de uncontrolled/controlled)
- Ao selecionar uma opção diferente de "Outro", o campo "Especifique" é limpo automaticamente
- Campos são incluídos no payload mesmo se vazios (convertidos para null no backend)

## Testes Recomendados

1. ✅ Criar novo funcionário com grau académico selecionado
2. ✅ Criar novo funcionário sem selecionar grau académico (deve salvar como null)
3. ✅ Editar funcionário existente e adicionar/alterar grau académico
4. ✅ Selecionar "Outro" e preencher campo de especificação
5. ✅ Criar novo professor usando FuncionarioFormDialog com mode='PROFESSOR'
6. ✅ Editar professor e verificar que grau académico carrega corretamente
7. ✅ Verificar que listagem de funcionários não quebra se algum registro não tiver grau_academico

## Compatibilidade

- ✅ Multi-tenant mantido (instituicaoId do token)
- ✅ Sem duplicação de formulários (professores usam FuncionarioFormDialog)
- ✅ Campos existentes preservados
- ✅ Dados antigos compatíveis (campos são opcionais)
- ✅ Sem dependências Lovable/Supabase adicionadas

## Observações Importantes

- Professores utilizam o mesmo formulário `FuncionarioFormDialog` com `mode='PROFESSOR'`
- O campo "Grau Académico" aparece tanto para funcionários quanto para professores
- A especificação "Outro" é armazenada em campo separado (`grau_academico_outro`) para permitir buscas/filtros futuros
- Todos os campos são opcionais, garantindo retrocompatibilidade

