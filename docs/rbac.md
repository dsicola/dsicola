# Matriz RBAC DSICOLA — Padrão SIGA/SIGAE

**Última atualização**: 2025-02-11

## Regras absolutas

1. **Nunca aceitar instituicaoId do frontend.** Sempre usar `req.user.instituicaoId` do JWT.
2. **Toda query** deve filtrar por `req.user.instituicaoId` (via `getInstituicaoIdFromAuth`, `addInstitutionFilter` ou `requireTenantScope`).
3. **RBAC no backend** — frontend só esconde conteúdo; a segurança é garantida no backend.
4. **Nega por padrão** — nenhuma permissão genérica insegura.
5. **Professor** só acessa dados derivados do seu Plano de Ensino (via `resolveProfessor`), nunca por IDs livres.

---

## Roles disponíveis (UserRole)

| Role | Descrição |
|------|-----------|
| SUPER_ADMIN | Gestão SaaS; não acessa módulos acadêmicos da instituição |
| ADMIN | Administração institucional completa |
| DIRECAO | Direção acadêmica; aprovações finais |
| COORDENADOR | Coordenação acadêmica |
| SECRETARIA | Estudantes, matrículas, documentos, planos (aprovar/encerrar), pendências |
| PROFESSOR | Turmas/disciplinas do Plano; aulas, presenças, avaliações, notas |
| ALUNO | Consulta própria (notas, presenças, documentos) |
| RH | Folha de pagamento, frequência funcionários, biometria |
| FINANCEIRO | Mensalidades, pagamentos, recibos, fornecedores |
| POS | Processar pagamentos; leitura limitada acadêmica |
| AUDITOR | Leitura em módulos |
| RESPONSAVEL | Consulta de dependentes |

---

## Middleware padrão

| Middleware | Uso |
|------------|-----|
| `authenticate` | JWT → injeta `req.user` { userId, instituicaoId, roles, tipoAcademico } |
| `authorize(...roles)` | Por rota; usuário precisa ter pelo menos uma das roles |
| `resolveProfessor` | Rotas do PROFESSOR (dashboard, aulas, presenças, notas) — obrigatório |
| `resolveProfessorOptional` | Rotas onde professor é opcional (ex: listar planos) |
| `requireTenantScope` | Garante instituicaoId válido; lança se ausente |
| `getInstituicaoIdFromAuth` | Retorna instituicaoId do JWT (SUPER_ADMIN pode usar query) |

---

## Matriz de rotas por módulo

### Autenticação (público)
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /auth/* | * | Público | Login, refresh, etc. |
| /documentos/verificar | GET | Público | Verificação de código de documento |

### Estudantes
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /estudantes | GET | ADMIN, SECRETARIA, DIRECAO, COORDENADOR | Listagem |

### Matrículas
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /matriculas | GET | ADMIN, SECRETARIA, PROFESSOR, SUPER_ADMIN | |
| /matriculas/aluno | GET | ALUNO | Próprias matrículas |
| /matriculas/professor/turma/:turmaId/alunos | GET | PROFESSOR | resolveProfessor |
| /matriculas/:id | GET | ADMIN, SECRETARIA, PROFESSOR, ALUNO, SUPER_ADMIN | |
| /matriculas | POST/PUT/DELETE | ADMIN, SECRETARIA, SUPER_ADMIN | |

### Turmas
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /turmas/professor | GET | PROFESSOR | resolveProfessor |
| /turmas | GET | ADMIN, COORDENADOR, SECRETARIA, DIRECAO, SUPER_ADMIN | |
| /turmas/:id | GET | ADMIN, COORDENADOR, SECRETARIA, DIRECAO, SUPER_ADMIN | |
| /turmas | POST/PUT/DELETE | ADMIN | |

### Plano de Ensino
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /plano-ensino | GET | ADMIN, PROFESSOR, SECRETARIA, ALUNO, SUPER_ADMIN | resolveProfessorOptional |
| /plano-ensino | POST | ADMIN, COORDENADOR, SUPER_ADMIN | |
| /plano-ensino/:id/aulas | POST | ADMIN, SUPER_ADMIN | |
| /plano-ensino/:id/* | PUT/DELETE | ADMIN, SUPER_ADMIN | |

### Aulas lançadas
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /aulas-planejadas | GET | ADMIN, PROFESSOR, SECRETARIA, SUPER_ADMIN | resolveProfessor |
| /aulas-lancadas | POST | ADMIN, PROFESSOR, SUPER_ADMIN | resolveProfessor |
| /aulas-lancadas | GET | ADMIN, PROFESSOR, SECRETARIA, ALUNO, SUPER_ADMIN | resolveProfessorOptional |
| /aulas-lancadas/:id | DELETE | ADMIN, PROFESSOR, SUPER_ADMIN | resolveProfessor |

### Presenças
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /presencas/presencas | POST | ADMIN, PROFESSOR, SUPER_ADMIN | resolveProfessor |

### Avaliações
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /avaliacoes | POST | ADMIN, PROFESSOR, SUPER_ADMIN | resolveProfessor |
| /avaliacoes | GET | ADMIN, SECRETARIA, PROFESSOR, SUPER_ADMIN | resolveProfessorOptional |
| /avaliacoes/:id | PUT | ADMIN, PROFESSOR, SUPER_ADMIN | resolveProfessor |

### Notas
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /notas | GET | ADMIN, SECRETARIA, PROFESSOR, SUPER_ADMIN | |
| /notas/aluno | GET | ALUNO | Próprias notas |
| /notas | POST/PUT | ADMIN, PROFESSOR, SUPER_ADMIN | resolveProfessor |
| /notas/:id | DELETE | ADMIN, SUPER_ADMIN | |

### Documentos oficiais
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /documentos/emitir | POST | ADMIN, SECRETARIA, SUPER_ADMIN | Professor NÃO emite |
| /documentos | GET | ADMIN, SECRETARIA, SUPER_ADMIN | |
| /documentos/:id | GET | ADMIN, SECRETARIA, SUPER_ADMIN | |
| /documentos/:id/pdf | GET | ADMIN, SECRETARIA, SUPER_ADMIN | |
| /documentos/:id/anular | POST | ADMIN, SECRETARIA, SUPER_ADMIN | |

### Recibos (SIGAE)
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /recibos | GET | ADMIN, SECRETARIA, POS, FINANCEIRO, SUPER_ADMIN | |
| /recibos/:id | GET | ADMIN, SECRETARIA, POS, FINANCEIRO, SUPER_ADMIN | |
| /recibos | DELETE | 403 | Recibos imutáveis |

### Mensalidades
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /mensalidades | GET | ADMIN, SECRETARIA, POS, SUPER_ADMIN | |
| /mensalidades/aluno | GET | ALUNO | Próprias |
| /mensalidades/:id | GET | ADMIN, SECRETARIA, POS, ALUNO, SUPER_ADMIN | |
| /mensalidades | POST/PUT | ADMIN, SECRETARIA, SUPER_ADMIN | |

### Relatórios oficiais
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /relatorios-oficiais/historico/:alunoId | GET | ADMIN, PROFESSOR, COORDENADOR, DIRECAO, ALUNO | |
| /relatorios-oficiais/boletim/:alunoId | GET | ADMIN, PROFESSOR, COORDENADOR, DIRECAO, ALUNO | |
| /relatorios-oficiais/pauta/:planoEnsinoId | GET | ADMIN, PROFESSOR, COORDENADOR, DIRECAO | resolveProfessor |
| /relatorios-oficiais/certificado | POST | ADMIN, COORDENADOR, DIRECAO | |

### Bloqueio acadêmico
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /bloqueio-academico/configuracao | GET | ADMIN, COORDENADOR, DIRECAO | |
| /bloqueio-academico/configuracao | PUT | ADMIN, DIRECAO | |
| /bloqueio-academico/verificar | POST | ADMIN, PROFESSOR, COORDENADOR, DIRECAO, ALUNO | |

### Professores (professorVinculo)
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /professores | GET | ADMIN, COORDENADOR, SECRETARIA, DIRECAO, PROFESSOR, SUPER_ADMIN | resolveProfessorOptional |
| /professores/:id/cursos | GET | ADMIN, COORDENADOR, SECRETARIA, DIRECAO, SUPER_ADMIN | |
| /professores/:id/disciplinas | GET | ADMIN, COORDENADOR, SECRETARIA, DIRECAO, SUPER_ADMIN | |
| /professores/:id/cursos | POST/DELETE | ADMIN | |
| /professores/:id/disciplinas | POST/DELETE | ADMIN | |

### Folha de pagamento (RH)
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /folha-pagamento | GET | ADMIN, RH, SECRETARIA, SUPER_ADMIN | |
| /folha-pagamento/:id | GET | ADMIN, RH, SECRETARIA, SUPER_ADMIN | |
| /folha-pagamento/:id/pagar | POST | ADMIN, SECRETARIA, RH, SUPER_ADMIN | |

### Biometria (RH)
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /biometria/registrar | POST | ADMIN, RH, SUPER_ADMIN | |
| /biometria/presencas/* | * | ADMIN, RH, SECRETARIA, SUPER_ADMIN | |

### Usuários e Perfis
| Rota | Método | Roles | Observação |
|------|--------|-------|------------|
| /users | GET/POST/PUT/DELETE | ADMIN, SECRETARIA, SUPER_ADMIN | |
| /user-roles | GET | ADMIN, SECRETARIA, PROFESSOR, SUPER_ADMIN | |
| /user-roles/user/:userId | GET | ADMIN, SECRETARIA, SUPER_ADMIN | |
| /profiles/:id | GET/PUT | ADMIN, SECRETARIA, PROFESSOR, POS, ALUNO, COORDENADOR, DIRECAO, SUPER_ADMIN | |

---

## Rotas ajustadas neste ciclo

| Arquivo | Ajuste |
|---------|--------|
| bloqueioAcademico.routes | DIRETOR → DIRECAO |
| relatoriosOficiais.routes | DIRETOR → DIRECAO |
| documentoOficial.routes | authorize em listar, getById, downloadPdf |
| comunicado.routes | authorize em getById, markComunicadoAsRead |
| mensalidade.routes | authorize em getById |
| matricula.routes | authorize em getById |
| user-roles.routes | authorize em GET /user/:userId; instituicaoId do body só para SUPER_ADMIN |
| profile.routes | authorize em get/:id, put/:id |
| folhaPagamento.routes | authorize em getAll, getSalarioBase, calcularDescontos, getById |
| professorVinculo.routes | authorize em get /:professorId/cursos e /disciplinas |
| turma.routes | authorize em get / e /:id |
| recibo.routes | FINANCEIRO adicionado às roles |
| biometria.routes | FUNCIONARIO removido (não existe em UserRole) |
| schema.prisma | UserRole: RH, FINANCEIRO adicionados |
| bloqueioAcademico.controller | r.role.name → r.role; DIRETOR → DIRECAO |

---

## Migração necessária

Executar após aplicar as alterações:

```bash
cd backend && npx prisma migrate deploy
```

Migration: `20260211000004_add_rh_financeiro_user_roles`

---

## Testes P0 recomendados

1. **401 sem token** — Toda rota protegida retorna 401 sem Authorization.
2. **403 por role** — SECRETARIA em POST /notas → 403; PROFESSOR em POST /recibos → 403.
3. **Multi-tenant** — Usuário da instituição A não acessa dados da instituição B.
4. **Professor** — Professor só vê turmas/planos do seu Plano de Ensino (via resolveProfessor).
