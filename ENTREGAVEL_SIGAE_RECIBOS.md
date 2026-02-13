# ENTREGÁVEL – Informações SIGAE em Comprovativos e Recibos

## 1. Arquivos Ajustados

### Backend
- `backend/src/controllers/recibo.controller.ts` – Inclusão de NIF, operador (nome) e descrição no pdfData; helper `getMesNome`

### Frontend
- `frontend/src/utils/pdfGenerator.ts` – Interfaces `ReciboData` e `MatriculaReciboData` com NIF; PDFs exibindo NIF, morada, contacto, operador e descrição
- `frontend/src/pages/secretaria/SecretariaDashboard.tsx` – Passagem de NIF ao montar ReciboData
- `frontend/src/pages/pos/POSDashboard.tsx` – Passagem de NIF ao montar ReciboData
- `frontend/src/pages/aluno/MinhasMensalidades.tsx` – Passagem de NIF ao montar ReciboData
- `frontend/src/components/admin/MatriculasAlunoTab.tsx` – Passagem de NIF ao montar MatriculaReciboData
- `frontend/src/components/admin/MatriculasTurmasTab.tsx` – Passagem de NIF ao montar MatriculaReciboData

---

## 2. Informações Exibidas (SIGAE)

### Instituição
- Nome
- NIF
- Morada (endereço)
- Contacto (telefone, email)

### Estudante
- Nome completo
- Nº estudante (numeroIdentificacaoPublica)
- Curso/Classe
- Turma
- Ano Letivo

### Financeiro (Recibo)
- Descrição do pagamento (ex.: "Mensalidade de Janeiro/2026")
- Valor base
- Desconto (se houver)
- Multa / Juros (se houver)
- Total pago
- Forma de pagamento
- Operador (nome do utilizador que registou o pagamento)
- Data

---

## 3. Fluxo de Dados

### Recibo (emitido ao confirmar pagamento)
1. Secretaria/POS confirma pagamento → backend cria Recibo e devolve `reciboId`
2. Frontend chama `GET /recibos/:id` → backend retorna `pdfData` com todos os dados SIGAE
3. Alternativa: montagem local com `config` (inclui NIF quando disponível)

### Comprovante de Matrícula
1. Matrícula gera débito (não recibo)
2. Comprovante é gerado no frontend com dados locais (instituição, aluno, matrícula)
3. NIF é obtido em `config?.nif` (ConfiguracaoInstituicao)

---

## 4. Multi-tenant (Regra)

- `GET /recibos/:id` usa `requireTenantScope(req)` → `instituicaoId` do JWT
- `where: { id, instituicaoId }` garante que só a instituição do utilizador acede ao recibo
- O frontend nunca envia `instituicaoId`; o backend utiliza sempre o valor do token

---

## 5. Compatibilidade POS

- POS continua a usar `recibosApi.getById(reciboId)` quando há `reciboId`
- Fallback para montagem local se a API falhar
- Novos campos (NIF, operador) são opcionais; fluxos antigos continuam a funcionar

---

## 6. Testes P0 (Validação Manual)

- [ ] Criar matrícula → gera débito (não recibo)
- [ ] Confirmar pagamento → gera recibo
- [ ] Outra instituição não consegue aceder ao recibo
- [ ] Estorno não apaga registo (status ESTORNADO)
- [ ] Numeração correta por instituição (RCB-YYYY-NNNN)
