# Teste Full do Sistema DSICOLA – E2E e Garantia de Funcionamento

Guia completo para validar todo o sistema antes de comercializar para instituições. Tudo executado localmente, sem aplicativos externos.

---

## Pré-requisitos

1. **PostgreSQL** a correr (DATABASE_URL no `.env` do backend)
2. **Node.js 18+** instalado
3. **Dependências** instaladas:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

4. **Credenciais Super Admin nos E2E:** o `frontend/playwright.config.ts` lê `backend/.env` e repete `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` em `TEST_SUPER_ADMIN_*` quando estes não estão definidos. Assim, login Super Admin nos Playwright fica alinhado ao que está na base (evita falhas só porque o default `SuperAdmin@123` difere do teu `.env`).

---

## Opção A: Teste Automático (Recomendado)

Um único comando executa seeds, inicia backend + frontend e corre todos os testes E2E.

```bash
# Na raiz do projeto - IMPORTANTE: executar no terminal do sistema (fora do Cursor/IDE)
./scripts/run-e2e-full-system-standalone.sh
```

### Opção A+ — Suite E2E institucional ampla (máxima cobertura)

Corre **dezenas** de specs Playwright (autenticação, multi-tenant, notas, pautas, documentos, contabilidade, roadmaps, super-admin, importação, modelos, páginas públicas de verificação, etc.), definidos nos manifestos em `frontend/e2e/institutional-suite-*.manifest.txt`.

```bash
# Suite completa (pode demorar 45–90 min, workers=1)
npm run test:e2e:institutional
# ou
./scripts/run-e2e-institutional-full.sh

# Versão mais curta (~15–25 min): apenas ficheiros do manifest «core»
npm run test:e2e:institutional:core
# ou
INSTITUTIONAL_SUITE=core ./scripts/run-e2e-institutional-full.sh
```

Timeout por teste (opcional): `E2E_PLAYWRIGHT_TIMEOUT_MS=120000 npm run test:e2e:institutional`

**Alternativa com mais validações (backend + E2E):**
```bash
npm run test:full-sistema
# ou
./scripts/run-teste-full-sistema.sh
```

**O que faz:**
1. Limpa portas 3001 e 8080
2. Executa seeds multi-tenant + perfis completos
3. Inicia backend (porta 3001)
4. Inicia frontend (porta 8080)
5. Aguarda servidores prontos
6. Executa testes E2E Playwright (full-system-multitenant)

**Duração:** ~3–5 minutos

---

## Opção B: Teste em Etapas (Mais Controlo)

### Etapa 1: Testes Unitários e de Integração (Backend)

```bash
cd backend

# 1. Seeds (obrigatório antes dos testes)
npx tsx scripts/seed-multi-tenant-test.ts
npx tsx scripts/seed-perfis-completos.ts

# 2. Testes Vitest (unitários)
npm run test

# 3. Testes críticos de segurança e multi-tenant
npm run test:storage-documentos-seguranca:unit
npm run test:isolamento-professores
npm run test:contabilidade-multitenant:full
npm run test:campus-config-multitenant:full
```

### Etapa 2: Backend a Correr

```bash
cd backend
npm run dev
# Deixar a correr em segundo plano ou noutro terminal
```

### Etapa 3: Frontend a Correr

```bash
cd frontend
E2E_HOST=127.0.0.1 npm run dev
# Deixar a correr (porta 8080)
```

### Etapa 4: Testes E2E Playwright

```bash
cd frontend

# Teste full do sistema (multi-tenant, todos os perfis)
E2E_SKIP_WEB_SERVER=1 npm run test:e2e:full-system:no-server

# Testes adicionais por módulo (opcional)
E2E_SKIP_WEB_SERVER=1 npm run test:e2e:roadmap-academico:no-server
E2E_SKIP_WEB_SERVER=1 npm run test:e2e:roadmap-financeiro:no-server
E2E_SKIP_WEB_SERVER=1 npm run test:e2e:contabilidade:no-server
E2E_SKIP_WEB_SERVER=1 npm run test:e2e:auth
E2E_SKIP_WEB_SERVER=1 npm run test:e2e:admin
```

---

## Opção C: Checklist Manual (Validação Humana)

Use este checklist para validar fluxos críticos manualmente. Faça login com cada perfil e verifique.

### Credenciais de Teste (após seeds)

| Perfil | Email | Senha |
|--------|-------|-------|
| Super Admin | superadmin@dsicola.com | SuperAdmin@123 |
| Admin Inst A (Secundário) | admin.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Professor Inst A | prof.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Aluno Inst A | aluno.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Secretaria Inst A | secretaria.inst.a@teste.dsicola.com | TestMultiTenant123! |
| POS Inst A | pos.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Responsável Inst A | responsavel.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Admin Inst B (Superior) | admin.inst.b@teste.dsicola.com | TestMultiTenant123! |

### 1. Autenticação
- [ ] Login com Admin
- [ ] Login com Professor
- [ ] Login com Aluno
- [ ] Logout e novo login
- [ ] Redirecionamento correto por perfil

### 2. Gestão Académica (Admin)
- [ ] Cursos: listar, criar, editar
- [ ] Turmas: listar, criar
- [ ] Disciplinas: listar, criar
- [ ] Planos de Ensino: aceder e navegar
- [ ] Avaliações e notas (disciplina): aceder (`/admin-dashboard/avaliacoes-notas`)
- [ ] Presenças: aceder

### 3. Gestão de Pessoas (Admin/Secretaria)
- [ ] Alunos: listar, criar, editar, ver detalhes
- [ ] Professores: listar, criar, editar
- [ ] Documentos do aluno: upload, visualizar, excluir
- [ ] Matrículas: criar, listar

### 4. Professor
- [ ] Painel do professor carrega
- [ ] Turmas: listar
- [ ] Notas: lançar/editar
- [ ] Frequência: registar presenças

### 5. Aluno
- [ ] Painel do aluno carrega
- [ ] Boletim: visualizar
- [ ] Horários: visualizar
- [ ] Mensalidades: visualizar

### 6. Secretaria
- [ ] Painel carrega
- [ ] Gestão de alunos
- [ ] Ponto de venda (POS)
- [ ] Emissão de recibos

### 7. Financeiro
- [ ] Mensalidades: listar, pagar
- [ ] Pagamentos: histórico
- [ ] Relatórios financeiros

### 8. Documentos e Comprovativos
- [ ] Upload de comprovativo (Faturas e Pagamentos)
- [ ] Visualizar comprovativo em nova aba (sem TOKEN_MISSING)
- [ ] Excluir comprovativo com termo de responsabilidade
- [ ] Documentos do aluno: upload e visualização
- [ ] Documentos do funcionário: upload e visualização

### 9. Biblioteca
- [ ] Listar itens
- [ ] Preview de PDF (digital)
- [ ] Thumbnails carregam

### 10. Configurações
- [ ] Configurações da instituição
- [ ] Parâmetros de ensino (trimestres, semestres)
- [ ] Ano letivo

### 11. Super Admin
- [ ] Dashboard
- [ ] Instituições: listar, criar
- [ ] Assinaturas e pagamentos de licença
- [ ] Backups e auditoria

### 12. Multi-tenant
- [ ] Admin Inst A não vê dados da Inst B
- [ ] Login em Inst B mostra contexto correto
- [ ] Isolamento de dados entre instituições

---

## Resolução de Problemas

### Backend não inicia
- Verificar `DATABASE_URL` no `.env`
- Executar `npx prisma migrate dev` ou `npx prisma db push`
- Verificar se a porta 3001 está livre

### Frontend não inicia
- Verificar `VITE_API_URL` (ex: `http://localhost:3001`)
- Verificar se a porta 8080 está livre

### Testes E2E falham
- Garantir que backend e frontend estão a correr
- Executar seeds: `npx tsx backend/scripts/seed-multi-tenant-test.ts` e `npx tsx backend/scripts/seed-perfis-completos.ts`
- Instalar browsers: `npx playwright install chromium`

### TOKEN_MISSING ao abrir documentos
- Verificar que os fluxos usam URLs assinadas ou blob (ver `docs/TROUBLESHOOTING_UPLOADS_DOCUMENTOS.md`)

---

## Comando Rápido (Tudo de Uma Vez)

```bash
./scripts/run-e2e-full-system-standalone.sh
```

Se terminar com `✅ TESTE E2E FULL-SYSTEM CONCLUÍDO COM SUCESSO`, o sistema está validado para uso comercial.
