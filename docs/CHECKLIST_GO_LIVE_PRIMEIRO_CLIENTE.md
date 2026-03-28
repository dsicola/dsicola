# Checklist — Produção / primeiro cliente (imprimível)

**Instituição:** ________________________ **Ambiente:** Produção ☐ / Staging ☐  

**Executado por:** ________________________ **Data:** ____ / ____ / ______  

Marque **Sim**, **Não** ou **N/A**. **Não** = bloqueador até corrigir ou aceitar risco documentado.

**Arquivo interno:** no fim deste ficheiro há um **apêndice** com referências a código e rotas da API (rastreio no repositório). As tabelas abaixo mantêm-se simples para impressão.

---

## 0 — Infraestrutura e variáveis

| # | Verificação | Sim | Não | N/A | Resp. | Data | Notas |
|---|-------------|:---:|:---:|:---:|-------|------|-------|
| 0.1 | API e frontend em HTTPS, sem erros críticos nos logs | ☐ | ☐ | ☐ | | | |
| 0.2 | Migrações Postgres aplicadas (incl. rastreio de emissões de pauta, se existir) | ☐ | ☐ | ☐ | | | |
| 0.3 | `FRONTEND_URL` no **backend** = URL real do frontend (sem `/` final; 1.º valor da lista se houver vírgulas) | ☐ | ☐ | ☐ | | | |
| 0.4 | Frontend `VITE_API_URL` (ou equivalente) → API de produção | ☐ | ☐ | ☐ | | | |
| 0.5 | JWT / secrets de produção não são os de desenvolvimento | ☐ | ☐ | ☐ | | | |
| 0.6 | CORS / domínios alinhados com o URL que o cliente usa | ☐ | ☐ | ☐ | | | |

---

## 1 — Multi-tenant e tipo de ensino

| # | Verificação | Sim | Não | N/A | Resp. | Data | Notas |
|---|-------------|:---:|:---:|:---:|-------|------|-------|
| 1.1 | Login no URL definitivo do cliente sem ecrã branco / erros F12 | ☐ | ☐ | ☐ | | | |
| 1.2 | Tipo de instituição correcto (Superior **ou** Secundário) em configuração | ☐ | ☐ | ☐ | | | |
| 1.3 | Interface sem misturar conceitos (superior: curso/semestre; secundário: classe/trimestre) | ☐ | ☐ | ☐ | | | |
| 1.4 | Dados visíveis só da instituição esperada | ☐ | ☐ | ☐ | | | |

---

## 2 — Dados mínimos académicos

| # | Verificação | Sim | Não | N/A | Resp. | Data | Notas |
|---|-------------|:---:|:---:|:---:|-------|------|-------|
| 2.1 | Ano letivo e período (semestre/trimestre) activos e coerentes | ☐ | ☐ | ☐ | | | |
| 2.2 | Curso/classe, turma, disciplina e plano de ensino de teste existem | ☐ | ☐ | ☐ | | | |
| 2.3 | ≥1 aluno matriculado; professor associado ao plano | ☐ | ☐ | ☐ | | | |
| 2.4 | Notas/avaliações permitem imprimir pauta provisória | ☐ | ☐ | ☐ | | | |
| 2.5 | Regras de fecho de pauta definitiva compreendidas e testadas se aplicável | ☐ | ☐ | ☐ | | | |

---

## 3 — Pauta PDF e verificação pública

| # | Verificação | Sim | Não | N/A | Resp. | Data | Notas |
|---|-------------|:---:|:---:|:---:|-------|------|-------|
| 3.1 | Emissão de PDF de pauta (provisória) com código de verificação | ☐ | ☐ | ☐ | | | |
| 3.2 | Link no PDF aponta para `…/verificar-pauta?codigo=…` (se `FRONTEND_URL` definido) | ☐ | ☐ | ☐ | | | |
| 3.3 | Página pública com código válido: metadados correctos; **sem** nomes/notas de alunos | ☐ | ☐ | ☐ | | | |
| 3.4 | Código inválido → mensagem de erro adequada | ☐ | ☐ | ☐ | | | |
| 3.5 | Nova impressão gera novo código / novo registo | ☐ | ☐ | ☐ | | | |
| 3.6 | Pauta definitiva (se usada): fecho + PDF + verificação repetida | ☐ | ☐ | ☐ | | | |

---

## 4 — Outros documentos e confiança

| # | Verificação | Sim | Não | N/A | Resp. | Data | Notas |
|---|-------------|:---:|:---:|:---:|-------|------|-------|
| 4.1 | Documento oficial + `/verificar-documento` (se o cliente usar) | ☐ | ☐ | ☐ | | | |
| 4.2 | Certificado de conclusão + `/verificar-certificado-conclusao` (secundário, se aplicável) | ☐ | ☐ | ☐ | | | |
| 4.3 | `POST …/relatorios-oficiais/certificado` (JSON): secundário só devolve código/link **após** registo do certificado em Conclusão de curso; superior orienta para documento oficial / PDF de colação (não há URL fictícia) | ☐ | ☐ | ☐ | | | |
| 4.4 | Modelos de documento (Word/HTML): placeholders `{{CURSO_GRAU}}` e `{{CURSO_DURACAO_NOMINAL}}` disponíveis para **Ensino Superior** (valores do cadastro do curso); vazios no secundário | ☐ | ☐ | ☐ | | | |

---

## 5 — Perfis e permissões

| # | Verificação | Sim | Não | N/A | Resp. | Data | Notas |
|---|-------------|:---:|:---:|:---:|-------|------|-------|
| 5.1 | Professor: só o permitido (ex. sem definitiva se proibido) | ☐ | ☐ | ☐ | | | |
| 5.2 | Secretaria/Admin: operações críticas (fecho, relatórios…) | ☐ | ☐ | ☐ | | | |
| 5.3 | Aluno: só os próprios dados | ☐ | ☐ | ☐ | | | |
| 5.4 | Responsável: só o associado (se aplicável) | ☐ | ☐ | ☐ | | | |

---

## 6 — Mobile, backup e go-live

| # | Verificação | Sim | Não | N/A | Resp. | Data | Notas |
|---|-------------|:---:|:---:|:---:|-------|------|-------|
| 6.1 | Fluxo crítico testado em ecrã estreito / telemóvel | ☐ | ☐ | ☐ | | | |
| 6.2 | Política de backup/restauro da BD documentada ou validada | ☐ | ☐ | ☐ | | | |
| 6.3 | Utilizador admin de backup + contacto de suporte definidos | ☐ | ☐ | ☐ | | | |

---

## Apêndice — Evidência no repositório (arquivo interno)

Mapeamento do número da verificação → onde o comportamento está implementado ou documentado. **Não substitui** marcar Sim/Não no ambiente real.

### 0 — Infraestrutura e variáveis

| # | Evidência (repo) |
|---|------------------|
| **0.1** | Operacional: HTTPS e logs dependem do deploy (ex.: `backend/nginx/nginx.production.conf`, `docs/DEPLOY_PRODUCAO.md`, `docs/VALIDACAO_PRODUCAO.md`). |
| **0.2** | Migrações: `backend/prisma/migrations/` (ex.: emissões de pauta e verificação em `20260327190000_pauta_documento_emissao_verificacao/migration.sql`). |
| **0.3** | `getPrimaryFrontendBaseUrl()` — primeiro URL da lista, sem `/` final: `backend/src/controllers/pauta.controller.ts`. |
| **0.4** | `VITE_API_URL`: `frontend/src/services/api.ts`; exemplo móvel: `frontend/mobile.env.example`. |
| **0.5** | Produção exige secrets ≥ 32 chars: `backend/src/lib/jwtSecrets.ts`. |
| **0.6** | CORS: `backend/src/app.ts`; domínio próprio institucional: `backend/src/utils/corsCustomInstituicaoDomain.ts`. |

### 1 — Multi-tenant e tipo de ensino

| # | Evidência (repo) |
|---|------------------|
| **1.1** | UAT no URL definitivo; build frontend + API (não verificável só pelo código). |
| **1.2** | Configuração por instituição (Prisma `Instituicao`, fluxos admin); tipo académico usado no JWT/contexto. |
| **1.3** | `frontend/src/contexts/InstituicaoContext.tsx` (`isSecundario`, `tipoAcademico`); regra de produto: `.cursor/rules/multi-tenant-isolamento-instituicao.mdc`. |
| **1.4** | `backend/src/middlewares/auth.ts` — `addInstitutionFilter`, `requireTenantScope`; visão: `backend/ARQUITETURA_MULTI_TENANT.md`. |

### 2 — Dados mínimos académicos

| # | Evidência (repo) |
|---|------------------|
| **2.1–2.3** | Dados de negócio + configuração no cliente; validação manual ou scripts de seed (fora do âmbito de uma única rota). |
| **Progressão sem saltos** | Matrícula anual não permite avançar mais do que **um** nível de cada vez (ordem de classe no secundário; ano 1º–6º no superior no mesmo curso), face ao histórico APROVADO / última classe. Override: corpo `overrideProgressaoSequencial: true` apenas **ADMIN / SUPER_ADMIN / DIRECAO**. `backend/src/services/progressaoAcademica.service.ts` (`validarProgressaoSequencialSemSaltos`); chamado em `matriculaAnual.controller.ts` (create/update) e importação Excel quando a validação de progressão não é ignorada. |
| **2.4** | `imprimirPauta`: `backend/src/controllers/pauta.controller.ts` (PDF + registo `pautaDocumentoEmissao`). |
| **2.5** | `fecharPauta` (apenas papéis autorizados): `backend/src/controllers/pauta.controller.ts`; estados: migrações `*pauta_status*`. |

### 3 — Pauta PDF e verificação pública

| # | Evidência (repo) |
|---|------------------|
| **3.1** | `gerarPDFPauta` + criação de registo: `pauta.controller.ts` + `backend/src/services/pautaPrint.service.ts`. |
| **3.2** | URL `${baseUrl}/verificar-pauta?codigo=…`: `backend/src/controllers/pauta.controller.ts`. |
| **3.3** | API pública sem dados de alunos: `backend/src/services/pautaDocumentoEmissao.service.ts` (`verificarPautaDocumentoPublico`); UI: `frontend/src/pages/VerificarPauta.tsx`. |
| **3.4** | Respostas `valido: false` com mensagem: `pautaDocumentoEmissao.service.ts`. |
| **3.5** | Novo `codigoVerificacao` + `pautaDocumentoEmissao.create` por impressão (retry em colisão): `pauta.controller.ts`. |
| **3.6** | Definitiva: `tipo === 'DEFINITIVA'`, `fecharPauta`; rota GET em `backend/src/routes/pauta.routes.ts`; pública `GET .../verificar-publico`. |

### 4 — Outros documentos e confiança

| # | Evidência (repo) |
|---|------------------|
| **4.1** | SPA: `frontend/src/pages/VerificarDocumentoOficial.tsx` (rota em `frontend/src/App.tsx`); links no PDF/API: ex. `backend/src/services/declaracao.service.ts`, `certificadoSuperior.service.ts`. |
| **4.2** | SPA: `frontend/src/pages/VerificarCertificadoConclusao.tsx`; API: `backend/src/routes/conclusaoCurso.routes.ts` (`verificar-certificado`); PDF: `backend/src/services/certificadoConclusaoPdf.service.ts`. |
| **4.3** | `gerarCertificado` — código/URL só com registo `certificado` na BD; instruções para secundário/superior: `backend/src/services/relatoriosOficiais.service.ts`; registo: `backend/src/controllers/conclusaoCurso.controller.ts` (`criarCertificado`). |
| **4.4** | **Placeholders HTML (genérico):** `{{CURSO_GRAU}}`, `{{CURSO_DURACAO_NOMINAL}}` — `backend/src/services/documentoTemplateGeneric.service.ts` (`montarVarsBasicas`). **Word / docxtemplater:** `student.cursoGrau`, `student.cursoDuracaoNominal` — mesmo ficheiro (`payloadToTemplateData`). **Certificado superior (HTML institucional):** texto composto `{{textoGrauDuracaoCurso}}` — `backend/src/templates/certificado-superior.html`, `backend/src/services/certificadoSuperior.service.ts`. Payload: `montarPayloadDocumento` em `backend/src/services/documento.service.ts` (`contextoAcademico.cursoGrau`, `contextoAcademico.cursoDuracaoNominal`). |

### 5 — Perfis e permissões

| # | Evidência (repo) |
|---|------------------|
| **5.1** | Professor sem definitiva / só seu plano: `pauta.controller.ts` (`imprimirPauta`). |
| **5.2** | `fecharPauta`; relatórios: `backend/src/controllers/relatoriosOficiais.controller.ts` (autenticado + tenant). |
| **5.3** | Ex.: `getNotas` — escopo aluno + bloqueio financeiro: `backend/src/controllers/pauta.controller.ts`. |
| **5.4** | `backend/src/controllers/responsavelAluno.controller.ts`; `backend/src/utils/responsavelAlunoGuard.ts`. |

### 6 — Mobile, backup e go-live

| # | Evidência (repo) |
|---|------------------|
| **6.1** | UI responsiva por página; app móvel: `docs/MOBILE_APP_CAPACITOR.md`, `frontend/capacitor.config.ts`. |
| **6.2** | **Fora do código:** política do fornecedor de BD / operações (documentar à parte). |
| **6.3** | **Fora do código:** contactos e ownership operacional. |

---

## Assinatura de aceite (opcional)

**Responsável técnico:** ________________________ **Data:** ____ / ____ / ______  

**Responsável instituição:** ________________________ **Data:** ____ / ____ / ______  

---

### Apêndice — Conclusão do ciclo secundário (10.ª–12.ª / 13.ª)

| Verificação | Onde no código |
|-------------|----------------|
| Após encerrar o ano, o histórico grava `mediaFinal` com `calcularMedia` (mesma regra de notas anuais). | `backend/src/services/historicoAcademico.service.ts` (`gerarSnapshotHistorico`). |
| Média por disciplina no ciclo = média das médias finais anuais; média do curso = simples ou ponderada por carga. | `backend/src/services/pautaConclusaoCicloSecundario.service.ts` (`calcularPautaConclusaoCicloSecundario`). |
| Aprovação à disciplina no ciclo exige **APROVADO em cada ano** do ciclo com nota, não só média ≥ mínimo. | Mesmo ficheiro (`todasLinhasComAprovacaoAnual`). |
| Ordens do ciclo (incl. 13.ª) e tipo de média global. | Parâmetros: `secundarioCicloOrdensConclusao`, `secundarioMediaFinalCursoTipo`; UI: `frontend/src/pages/admin/ConfiguracoesInstituicao.tsx` (acordeão Rótulos da pauta). |
| API e PDF da pauta. | `GET /conclusoes-cursos/pauta-conclusao-ciclo`, `.../pdf`; UI: `frontend/src/components/admin/ConclusaoCursoTab.tsx`. |
| Testes unitários (média final do curso a partir de linhas de histórico). | `npm run test` em `backend/src/__tests__/pautaConclusaoCicloSecundario.test.ts`. |

### Apêndice — Plano de ensino (alinhamento institucional)

| Verificação | Onde no código |
|-------------|----------------|
| Superior: `cursoId` + `semestre` obrigatórios; proibido `classeId` / `classeOuAno` / `semestre` no secundário incompatível. | `backend/src/controllers/planoEnsino.controller.ts` (`createOrGet`). |
| Secundário: `classeId` + `classeOuAno` obrigatórios; semestre rejeitado; `cursoId` opcional (validação CursoDisciplina só se enviado). | Mesmo ficheiro. |
| Tenant: `instituicaoId` do JWT; corpo não pode alterar instituição; carga horária do plano derivada da disciplina e soma de aulas. | `planoEnsino.controller.ts` (`recalcularCargaHorariaPlanejada`, `getCargaHorariaExigida`). |
| UI admin secundário: classe no contexto; `classeOuAno` preenchido pelo nome da classe (páginas alinhadas). | `frontend/src/pages/admin/PlanoEnsino.tsx`; `frontend/src/components/configuracaoEnsino/PlanoEnsinoTab.tsx`. |
| Criação de plano não envia `cursoId` no secundário (evita misturar fluxos). | `frontend/src/pages/admin/planoEnsino/PlanejarTab.tsx`; `frontend/src/components/admin/AtribuicaoDisciplinasTab.tsx`. |
| Rótulos em listas (notas/pautas): disciplina · classe/ano (sec.) · professor · semestre (sup.). | `frontend/src/utils/planoEnsinoLabel.ts`. |
| Resumo do plano: trimestres vs semestre; badge classe (sec.); curso só como «Área / curso de estudo» quando existir. | `frontend/src/components/planoEnsino/PlanoEnsinoContextoResumoCard.tsx`. |

### Apêndice — Perfis, edição e estado (matriz resumida)

Fonte de verdade da **matriz por perfil (UI):** `frontend/src/hooks/useRolePermissions.ts`.  
Validação **HTTP (API):** `backend/src/middlewares/role-permissions.middleware.ts`.  
Registos com **estado** (ex.: plano imutável): `backend/src/middlewares/estado.middleware.ts` e `frontend/src/hooks/useEstadoRegistro.ts` (APROVADO e ENCERRADO bloqueiam edição na UI, alinhados ao backend).

| Área | ADMIN / DIRECAO | SECRETARIA | PROFESSOR |
|------|-----------------|------------|-----------|
| Plano de ensino | Criar, editar (só RASCUNHO / EM_REVISAO), aprovar / encerrar | Criar, editar (só antes de APROVADO) | Só ver; só plano APROVADO / ENCERRADO |
| Calendário (eventos) | Criar / editar | Só leitura | Só leitura |
| Lançamento de aulas | Sim | Só leitura | Só nas suas turmas / plano ATIVO |
| Presenças | Sim | Só leitura | Só nas suas aulas / plano ATIVO |
| Avaliações | Sim | Criar / editar (exceto fechar: só admin) | Só no seu plano / plano ATIVO |
| Notas e exames | Sim (vê também `perfisAlterarNotas` nos parâmetros, **SECRETARIA excluída**) | Só leitura | Só nas suas avaliações / turma via plano |
| Financeiro (UI hook) | Tudo | Sem criar/editar pagamentos; **estorno:** sim com admin | Conforme rota/POS |

*Nota:* `parametrosSistema.perfisAlterarNotas` restringe quem pode alterar notas no servidor, mas o perfil **SECRETARIA** é **sempre** tratado como só consulta nas mutações de nota, em linha com a UI.

*Referência: plano detalhado passo a passo na conversa de suporte; este ficheiro serve para impressão e arquivo. O apêndice de evidências actualiza o rastreio no repositório.*
