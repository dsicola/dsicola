# Guia de Teste Manual - Emissão de Documentos Oficiais (SIGAE)

## Pré-requisitos
- Backend rodando
- Banco de dados com migração aplicada: `npx prisma migrate dev`
- Usuário com role ADMIN ou SECRETARIA
- Aluno com matrícula ativa (para declarações)
- Aluno com conclusão validada (para certificado)

---

## 6 Passos de Teste

### 1. Emitir Declaração de Matrícula
1. Login como ADMIN ou SECRETARIA
2. Ir para **Gestão de Alunos** → escolher aluno → aba **Documentos**
3. Selecionar tipo **Declaração de Matrícula**
4. Aguardar pré-validação (deve mostrar "Prévia OK")
5. Clicar **Emitir PDF**
6. Verificar: documento aparece na lista com nº e status ATIVO

**Mensagens esperadas se bloqueado:**
- "Estudante sem matrícula ativa no ano letivo"
- "Bloqueado por pendência financeira" (se configurado)

---

### 2. Emitir Histórico Escolar
1. Na mesma tela, selecionar tipo **Histórico Escolar**
2. Pré-validar (exige matrícula e notas/disciplinas)
3. Clicar **Emitir PDF**
4. Verificar documento na lista e baixar PDF
5. O PDF deve conter tabela de disciplinas com: nome, ano, CH, nota e situação (APROVADO/REPROVADO/Equiv.)

**Mensagens esperadas se bloqueado:**
- "Estudante sem matrícula ou notas/disciplinas registradas"
- "Bloqueado por pendência financeira"

---

### 3. Emitir Certificado de Conclusão
1. Selecionar tipo **Certificado de Conclusão**
2. Pré-validar (exige conclusão validada: todas disciplinas, média, status CONCLUIDO)
3. Clicar **Emitir PDF**
4. O PDF deve conter: "Certificamos que [nome] concluiu com êxito o curso/formação..." e tabela de disciplinas

**Mensagens esperadas se bloqueado:**
- "Curso ainda não concluído (certificado)"
- "Carga horária insuficiente"
- "Bloqueado por pendência financeira"

---

### 4. Bloquear por Finanças
1. Em **Configurações** → Bloqueio Acadêmico, ativar **bloquearDocumentosPorFinanceiro**
2. Garantir que o aluno tenha mensalidades pendentes
3. Tentar emitir declaração ou histórico
4. Deve aparecer: **"Bloqueado por pendência financeira"**
5. Para certificado: ativar **bloquearCertificadosPorFinanceiro**

---

### 5. Anular Documento
1. Na lista de documentos emitidos, localizar um com status ATIVO
2. Clicar no botão **Anular** ao lado do documento
3. Na janela de confirmação, informar o motivo (opcional) e clicar **Confirmar Anulação**
4. Verificar: status muda para ANULADO, botão PDF e Anular desaparecem
5. Alternativa via API: `POST /documentos/:id/anular` com body `{ "motivo": "Erro de digitação" }`

---

### 6. Verificar Código
1. Copiar o **código de verificação** de um documento emitido (ex: `A1B2C3D4`)
2. `GET /documentos/verificar?codigo=A1B2C3D4` (público, sem auth)
3. Resposta esperada:
```json
{
  "valido": true,
  "instituicao": "Nome da Instituição",
  "nomeParcial": "João Silva ***",
  "dataEmissao": "2026-02-11T...",
  "tipoDocumento": "DECLARACAO_MATRICULA"
}
```
4. Para documento anulado ou código inválido: `{ "valido": false, "mensagem": "..." }`

---

## Endpoints da API

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | /documentos/emitir | ADMIN/SECRETARIA | Emite e retorna PDF |
| POST | /documentos/emitir-json | ADMIN/SECRETARIA | Emite e retorna JSON |
| GET | /documentos/pre-validar | ADMIN/SECRETARIA | Pré-valida emissão |
| GET | /documentos | Auth | Lista documentos (tenant) |
| GET | /documentos/verificar | **Público** | Verifica código |
| GET | /documentos/:id | Auth | Detalhe do documento |
| GET | /documentos/:id/pdf | Auth | Download PDF |
| POST | /documentos/:id/anular | ADMIN/SECRETARIA | Anula documento |

---

## Arquivos Alterados

### Backend
- `prisma/schema.prisma` - Modelo DocumentoEmitido (SIGAE)
- `prisma/migrations/20260211000003_add_sigae_documentos_emitidos/migration.sql`
- `src/services/documento.service.ts` - Serviço de emissão; integração com buscarHistoricoAluno para disciplinas; templates PDF por tipo (Declaração/Certificado/Histórico)
- `src/controllers/documentoOficial.controller.ts` - Controller SIGAE
- `src/controllers/documentoEmitido.controller.ts` - Ajustado (multi-tenant)
- `src/routes/documentoOficial.routes.ts` - Rotas /documentos
- `src/routes/index.ts` - Monta /documentos
- `src/services/audit.service.ts` - DOCUMENTO_EMITIDO, ANULAR (IP, user-agent)

### Frontend
- `src/services/api.ts` - documentosOficialApi (emitir-json, preValidar, anular, downloadPdf)
- `src/components/admin/EmitirDocumentoTab.tsx` - UI com botão Anular e confirmação
- `src/pages/admin/EditarAluno.tsx` - Aba Documentos (EmitirDocumentoTab)
