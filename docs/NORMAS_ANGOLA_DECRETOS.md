# Normas Angola — Extraídas dos Decretos Oficiais

Normas extraídas da legislação angolana para implementação no DSICOLA. Fontes: AngoLEX, Lex.ao.

---

## 1. Decreto Executivo n.º 424/25 — Avaliação das Aprendizagens

### 1.1 Escalas de classificação

| Nível | Escala | Qualitativo | Transição/Aprovação |
|-------|--------|------------|---------------------|
| **Ensino Primário** (1º e 2º ciclos) | 0–10 | Excelente (9–10), Bom (7–8), Suficiente (5–6), Insuficiente (1–4) | Transita se ≥5 em **todas** as disciplinas |
| **Ensino Primário** (3º ciclo) | 0–10 | Pode combinar qualitativo e quantitativo | Idem |
| **Ensino Secundário** | 0–20 | Excelente (17–20), Bom (14–16), Suficiente (10–13), Insuficiente (6–9), Mau (0–5) | Aprovação com média ≥10 |

### 1.2 Condições de retenção

**Ensino Primário:**
- Classificação final <5 em **qualquer** disciplina → retido
- Frequência inferior a 2/3 das aulas → retido

**Ensino Secundário:**
- Média <10 → reprovado
- Faltas não justificadas por trimestre:
  - 1 tempo lectivo/semana: 3 faltas → retido
  - 2 tempos lectivos/semana: 4 faltas → retido
  - Mais de 2 tempos/semana: 5 faltas → retido

### 1.3 Instrumentos de registo

- **Pauta** — base para declarações e certificados
- **Mini-Pauta** — por turma/disciplina
- **Relatório de Desempenho Escolar do Aluno** (RDEA) — Primário
- **Relatório de Avaliação do Aluno** — Secundário
- **Plataforma Informática de Gestão de Dados de Alunos**

### 1.4 Cor da tinta (Art. 35.º e 36.º)

| Cor | Para |
|-----|------|
| **Azul** | Aprovado, notas positivas, transita, progride, admitido, apto, faltas justificadas, comportamentos positivos |
| **Vermelho** | Reprovado, retido, não transita, faltas injustificadas, comportamento não satisfatório, excluído, não apto |

**Pautas electrónicas:** faltas injustificadas, comportamento não satisfatório, retido, reprovado, não transita e excluído devem ser **destacados em vermelho e negritados**.

### 1.5 Exames

- **6.ª classe** — Língua Portuguesa, Matemática, Ciências da Natureza, Geografia, História
- **9.ª classe** — Língua Portuguesa, Matemática, Física, Geografia, História, Biologia, Química, Inglês, Francês
- **12.ª classe** — Língua Portuguesa, Matemática, Física, Geografia, História, Biologia, Química, Geologia, Filosofia, Inglês, Francês, Introdução ao Direito, Introdução à Economia

---

## 2. Decreto Presidencial n.º 227/25 — Títulos Escolares

### 2.1 Campos obrigatórios nos documentos (Art. 8.º)

Os atestados, certificados, diplomas e declarações devem conter:

| Campo | Descrição |
|-------|-----------|
| a) | Insígnia da República de Angola |
| b) | Designação «República de Angola» |
| c) | Designação «Ministério da Educação» |
| d) | Identificação do Decreto Executivo ou licença que cria a instituição |
| e) | Identificação do Decreto Executivo que aprova o plano de estudos do curso |
| f) | Nome da instituição de educação e ensino emissora |
| g) | Nome do aluno |
| h) | Número do Bilhete de Identidade ou Número de Identificação Civil |
| i) | Número do documento |
| j) | Identificador único do aluno |
| k) | Data e local de nascimento |
| l) | Nacionalidade |
| m) | Filiação |
| n) | Discriminação das disciplinas ou componentes curriculares e notas obtidas |
| o) | Média final do aluno |
| p) | Nível ou grau de qualificação do Quadro Nacional de Qualificações |
| q) | Assinatura do(s) Director(es) e carimbo ou selo branco |

### 2.2 Títulos por nível

| Nível | Título |
|-------|--------|
| Educação Pré-Escolar | Atestado |
| Ensino Primário | Certificado (disciplinas e notas) |
| I Ciclo Secundário (9.ª) | Certificado (disciplinas e notas) |
| II Ciclo Secundário (12.ª) | Certificado + Diploma |
| Declaração | Frequência, transferência, comprovação provisória |

### 2.3 Registo

- Até **30 dias** após o final do ano lectivo: inserir na **Plataforma Nacional de Certificação** o histórico avaliativo e informações dos detentores de atestados, certificados e diplomas.

---

## 3. Decreto Executivo n.º 377/25 — Exames Nacionais 2024/2025

- Regulamento dos Exames Nacionais para 6.ª, 9.ª e 12.ª classes
- Classificação: Primário 0–100 pontos (convertido para 0–10); Secundário 0–200 pontos (convertido para 0–20)
- Plataforma de Gestão de Dados dos Exames Nacionais

---

## 4. O que o DSICOLA pode implementar

| Norma | Implementável | Notas |
|-------|---------------|-------|
| Escala 0–10 (Primário) | ✅ | Adicionar `notaMaxima` em ParametrosSistema |
| Escala 0–20 (Secundário) | ✅ | Já usado por defeito |
| Transição ≥5 (Primário) | ✅ | Configurável |
| Aprovação ≥10 (Secundário) | ✅ | Já configurável |
| Pauta: reprovado em vermelho | ✅ | PDF e UI |
| Retenção por faltas (3/4/5) | ⚠️ | Requer mapeamento disciplinas ↔ tempos lectivos |
| Campos obrigatórios certificados | ⚠️ | Parcial — falta insígnia, "República de Angola", "Ministério da Educação" |
| Modelos oficiais | ❌ | Aprovados e publicados pelo Ministério — não disponíveis online |
| Plataforma Nacional de Certificação | ❌ | Integração futura — especificação não pública |

---

*Documento gerado a partir da legislação em AngoLEX e Lex.ao (março 2026).*
