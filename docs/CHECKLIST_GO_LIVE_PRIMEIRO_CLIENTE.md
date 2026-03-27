# Checklist — Produção / primeiro cliente (imprimível)

**Instituição:** ________________________ **Ambiente:** Produção ☐ / Staging ☐  

**Executado por:** ________________________ **Data:** ____ / ____ / ______  

Marque **Sim**, **Não** ou **N/A**. **Não** = bloqueador até corrigir ou aceitar risco documentado.

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

## Assinatura de aceite (opcional)

**Responsável técnico:** ________________________ **Data:** ____ / ____ / ______  

**Responsável instituição:** ________________________ **Data:** ____ / ____ / ______  

---

*Referência: plano detalhado passo a passo na conversa de suporte; este ficheiro serve para impressão e arquivo.*
