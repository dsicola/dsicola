# BLOQUEIO ACADÊMICO INSTITUCIONAL - DSICOLA

## 📋 Visão Geral

Implementação completa do **Bloqueio Acadêmico Institucional** seguindo rigorosamente o padrão **institucional** para garantir que nenhuma ação acadêmica seja realizada sem os pré-requisitos institucionais corretos.

## 🎯 Objetivo

Garantir que:
- **Ensino Superior**: SEM CURSO → SEM AÇÃO ACADÊMICA
- **Ensino Secundário**: SEM CLASSE → SEM AÇÃO ACADÊMICA
- Nenhuma nota, frequência, pauta ou histórico seja gerado fora das regras institucionais

## 🔒 Regras Absolutas

1. **NÃO confiar apenas no frontend** - Todas as validações ocorrem no backend
2. **Usar exclusivamente `req.user.tipoAcademico`** (vem do JWT) para decidir regras
3. **Retornar erros claros** (400 ou 403) com mensagens específicas
4. **NÃO alterar comportamento válido existente**

## 🏗️ Arquitetura

### Serviço Principal

**Arquivo**: `backend/src/services/bloqueioAcademico.service.ts`

#### Função Principal

```typescript
validarBloqueioAcademicoInstitucionalOuErro(
  alunoId: string,
  instituicaoId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null,
  disciplinaId?: string,
  anoLetivoId?: string
): Promise<void>
```

#### Validações Realizadas

1. **Multi-tenant**: Verifica se aluno pertence à instituição
2. **Matrícula Anual ATIVA**: Aluno deve ter matrícula anual com status `ATIVA`
3. **Tipo Acadêmico - Ensino Superior**:
   - ✅ DEVE ter `cursoId` na MatriculaAnual
   - ❌ BLOQUEIA se `cursoId` for nulo
4. **Tipo Acadêmico - Ensino Secundário**:
   - ✅ DEVE ter `classeId` na MatriculaAnual
   - ❌ BLOQUEIA se `classeId` for nulo
5. **Matrícula na Disciplina** (opcional, se `disciplinaId` fornecido):
   - Verifica se aluno está matriculado na disciplina via `AlunoDisciplina`
   - Status válidos: `'Cursando'` ou `'Matriculado'`

### Mensagens de Erro

#### Ensino Superior
```
"Aluno não possui curso definido. Operação acadêmica bloqueada."
```

#### Ensino Secundário
```
"Aluno não possui classe definida. Operação acadêmica bloqueada."
```

#### Matrícula Anual Inexistente/Inativa
```
"Aluno não possui matrícula anual ativa. Operação acadêmica bloqueada."
```

#### Aluno não matriculado na disciplina
```
"Aluno não está matriculado nesta disciplina. Operação acadêmica bloqueada."
```

## 🛡️ Endpoints Protegidos

### 1. Lançamento de Notas

#### ✅ `POST /notas` (createNota)
- **Arquivo**: `backend/src/controllers/nota.controller.ts` (linha 257)
- **Validação**: Curso/Classe + Matrícula na Disciplina
- **Contexto**: entidade Avaliação vinculada ao Plano de Ensino (fluxo por disciplina)

#### ✅ `PUT /notas/:id` (updateNota)
- **Arquivo**: `backend/src/controllers/nota.controller.ts` (linha 654)
- **Validação**: Curso/Classe + Matrícula na Disciplina
- **Nota**: Apenas atualiza observações (não permite mudança de valor)

#### ✅ `POST /notas/:id/corrigir` (corrigirNota)
- **Arquivo**: `backend/src/controllers/nota.controller.ts` (linha 825)
- **Validação**: Curso/Classe + Matrícula na Disciplina
- **Regra Especial**: Exige motivo obrigatório para correção

#### ✅ `POST /notas/lote` (createNotasEmLote)
- **Arquivo**: `backend/src/controllers/nota.controller.ts` (linha 1182)
- **Validação**: Valida cada aluno antes de processar em lote
- **Contexto**: Notas de exames

#### ✅ `POST /notas/avaliacao/lote` (createNotasAvaliacaoEmLote)
- **Arquivo**: `backend/src/controllers/nota.controller.ts` (linha 1454)
- **Validação**: Valida cada aluno antes de processar em lote
- **Contexto**: Notas de avaliações vinculadas ao Plano de Ensino

### 2. Lançamento de Presenças

#### ✅ `POST /presencas` (createOrUpdatePresencas)
- **Arquivo**: `backend/src/controllers/presenca.controller.ts` (linha 459)
- **Validação**: Valida cada aluno antes de processar presenças
- **Contexto**: Aula Lançada vinculada ao Plano de Ensino

### 3. Geração de Pautas

#### ✅ `POST /relatorios-oficiais/pauta` (gerarPauta)
- **Arquivo**: `backend/src/services/relatoriosOficiais.service.ts` (linha 509)
- **Validação**: Valida cada aluno antes de incluir na pauta
- **Contexto**: Plano de Ensino APROVADO/FECHADO

#### ✅ `POST /relatorios/pauta-final` (gerarPautaFinal)
- **Arquivo**: `backend/src/services/pautaFinal.service.ts` (linha 190)
- **Validação**: Valida cada aluno antes de incluir na pauta final
- **Contexto**: Semestre/Trimestre ENCERRADO

### 4. Emissão de Histórico Acadêmico

#### ✅ `POST /relatorios-oficiais/historico` (gerarHistoricoAcademico)
- **Arquivo**: `backend/src/services/relatoriosOficiais.service.ts` (linha 180)
- **Validação**: Curso/Classe do aluno
- **Contexto**: Histórico completo do aluno

### 5. Emissão de Certificados

#### ✅ `POST /relatorios-oficiais/certificado` (gerarCertificado)
- **Arquivo**: `backend/src/services/relatoriosOficiais.service.ts` (linha 682)
- **Validação**: Curso/Classe do aluno + Conclusão do curso
- **Contexto**: Certificado de conclusão

### 6. Envio de Boletim

#### ✅ `POST /boletim/enviar-email` (enviarBoletimEmail)
- **Arquivo**: `backend/src/controllers/boletim.controller.ts` (linha 25)
- **Validação**: Curso/Classe do aluno
- **Contexto**: Boletim escolar por e-mail

## 🔍 Fluxo de Validação

```
┌─────────────────────────────────────┐
│  Requisição (POST/PUT)              │
│  - alunoId                          │
│  - instituicaoId (do token)         │
│  - tipoAcademico (do JWT)           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  validarBloqueioAcademicoInstitucional │
│                                       │
│  1. Buscar aluno (multi-tenant)      │
│  2. Buscar MatriculaAnual ATIVA      │
│  3. Validar tipo acadêmico:         │
│     - SUPERIOR → cursoId obrigatório │
│     - SECUNDARIO → classeId obrigatório │
│  4. (Opcional) Validar matrícula     │
│     na disciplina                    │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   BLOQUEADO      PERMITIDO
   (403 Error)    (Continua)
```

## 📝 Exemplo de Uso

### No Controller

```typescript
import { validarBloqueioAcademicoInstitucionalOuErro } from '../services/bloqueioAcademico.service.js';

export const createNota = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId, avaliacaoId, valor } = req.body;
    const instituicaoId = requireTenantScope(req);
    const tipoAcademico = req.user?.tipoAcademico || null;

    // BLOQUEIO ACADÊMICO INSTITUCIONAL
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId,
      tipoAcademico,
      disciplinaId,      // Opcional: validar matrícula na disciplina
      anoLetivoId       // Opcional: validar matrícula no ano
    );

    // Se chegou aqui, aluno está válido - continuar com a operação
    const nota = await prisma.nota.create({ ... });
    
    res.status(201).json(nota);
  } catch (error) {
    next(error);
  }
};
```

## ✅ Checklist de Implementação

- [x] Função de validação implementada
- [x] Mensagens de erro corretas
- [x] Lançamento de notas protegido
- [x] Correção de notas protegida
- [x] Lançamento em lote protegido
- [x] Lançamento de presenças protegido
- [x] Geração de pautas protegida
- [x] Emissão de histórico protegida
- [x] Emissão de certificados protegida
- [x] Envio de boletim protegido
- [x] Validação multi-tenant
- [x] Validação de matrícula anual ativa
- [x] Validação de matrícula na disciplina (quando aplicável)

## 🚨 Casos de Bloqueio

### Ensino Superior
- ❌ Aluno sem `cursoId` na MatriculaAnual
- ❌ MatriculaAnual inexistente ou inativa
- ❌ Aluno não matriculado na disciplina (se disciplinaId fornecido)

### Ensino Secundário
- ❌ Aluno sem `classeId` na MatriculaAnual
- ❌ MatriculaAnual inexistente ou inativa
- ❌ Aluno não matriculado na disciplina da classe (se disciplinaId fornecido)

## 🔐 Segurança

1. **Multi-tenant**: Todas as validações filtram por `instituicaoId` do token
2. **Backend-only**: Nenhuma validação confia no frontend
3. **JWT-based**: `tipoAcademico` vem exclusivamente do JWT (`req.user.tipoAcademico`)
4. **Auditável**: Todas as tentativas bloqueadas podem ser registradas (se necessário)

## 📚 Referências

- **Padrão**: institucional (Sistema de Gestão Acadêmica)
- **Arquitetura**: Multi-tenant com isolamento por instituição
- **Tipo Acadêmico**: Determinado no cadastro da instituição e injetado no JWT

---

**Status**: ✅ **IMPLEMENTAÇÃO COMPLETA**

Todas as ações acadêmicas críticas estão protegidas pelo bloqueio acadêmico institucional, garantindo que nenhuma nota, frequência, pauta ou histórico seja gerado fora das regras institucionais definidas.

