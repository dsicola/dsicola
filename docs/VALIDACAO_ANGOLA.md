# Validação DSICOLA — Angola

Guia prático para validar o DSICOLA junto ao Ministério da Educação de Angola e entidades relacionadas.

---

## 1. Contexto

### Sistemas de referência em Angola

| Sistema | Descrição | Âmbito |
|---------|-----------|--------|
| **SIUGEP** | Sistema Integrado e Unificado de Gestão de Escolas Públicas | Escolas públicas (certificados, declarações, pautas, código de barras) |
| **SIGEA** | Sistema Integrado de Gestão Escolar Angolano (Aptecnosoft) | Escolas privadas e públicas (150+ escolas, 85.000+ alunos) |
| **SIGE** | Sistema de Informação para Gestão da Educação | Recolha de dados para INE (estatísticas nacionais) |

### O que o DSICOLA já tem (Angola)

- ✅ Moeda AOA, locale pt-AO
- ✅ SAFT-AO (Decreto Presidencial nº 312/18, Decreto Executivo nº 317/20)
- ✅ NIF, BI angolano
- ✅ Estrutura Secundário + Superior
- ✅ Províncias e municípios de Angola
- ✅ INSS 3% (folha de pagamento)
- ✅ Documentos: certificados, declarações, pautas, boletins

---

## 2. Validação dos relatórios oficiais

### 2.1 Documentos a obter

| Documento | Onde obter | Contacto sugerido |
|-----------|------------|-------------------|
| Lista de relatórios obrigatórios | Ministério da Educação — Direção Nacional do Ensino Geral | Luanda |
| Modelos de pautas e boletins | Ministério da Educação / Direção Provincial | Direção Provincial da Educação da província |
| Normas de certificação | Ministério da Educação | Gabinete de Informática ou equivalente |
| Decreto Executivo n.º 424/25 | Avaliação das aprendizagens (pré-escolar, primária, secundária) | [Angolex](https://angolex.com) / [Lex.ao](https://lex.ao) |

### 2.2 Relatórios a validar

| Relatório | DSICOLA | Ação |
|-----------|---------|------|
| Pauta por turma/disciplina | ✅ Implementado | Validar formato e campos com Ministério |
| Boletim do aluno | ✅ Implementado | Validar layout e assinaturas |
| Certificado de conclusão | ✅ Implementado | Validar conformidade com modelo oficial |
| Declaração de matrícula | ✅ Implementado | Validar formato |
| Declaração de frequência | ✅ Implementado | Validar formato |
| Histórico escolar | ✅ Implementado | Validar estrutura |
| Mapa de presenças | ✅ Implementado | Validar formato |
| Estatísticas de aprovação/reprovação | ✅ Dashboard | Validar indicadores exigidos |
| Lista de admitidos | ✅ Matrículas | Validar formato e campos |

### 2.3 Passos práticos

1. **Solicitar reunião** — Direção Nacional do Ensino Geral ou Gabinete de Informática do Ministério
2. **Levar amostras** — PDFs dos relatórios atuais do DSICOLA
3. **Obter parecer** — Por escrito, indicando conformidade ou ajustes necessários
4. **Implementar ajustes** — Se houver divergências de formato

---

## 3. Integração governamental

### 3.1 SIGE (Sistema de Informação para Gestão da Educação)

O INE recolhe dados via **SIGE** a partir de:
- Direções Provinciais da Educação
- Direções Municipais e Distritais
- Escolas individuais

**Perguntas a esclarecer com o Ministério:**

- [ ] O envio de dados é obrigatório para escolas privadas?
- [ ] Existe API, portal ou ficheiro de envio?
- [ ] Formato: Excel, XML, CSV?
- [ ] Frequência: anual, trimestral, mensal?
- [ ] Quais dados: matrículas, notas, presenças, estatísticas?

### 3.2 INE (Instituto Nacional de Estatística)

- **Publicação:** Anuário Estatístico da Educação
- **Dados:** efetivo escolar, quadro de professores, infraestruturas
- **Site:** [www.ine.gov.ao](https://www.ine.gov.ao)

**Ação:** Verificar se o INE disponibiliza formulário ou especificação técnica para envio de dados por parte das escolas.

### 3.3 SIUGEP (escolas públicas)

O SIUGEP é para **escolas públicas**. Se o DSICOLA for usado apenas por escolas privadas, a integração com SIUGEP pode não ser necessária.

**Confirmar:** O DSICOLA é para escolas privadas, públicas ou ambas?

---

## 4. Normas e decretos

### 4.1 Legislação aplicável

| Documento | Assunto | Fonte |
|-----------|---------|-------|
| Lei de Bases da Educação | Estrutura do sistema educativo | Angolex / Lex.ao |
| Regime Jurídico do Subsistema de Ensino Geral | Ensino geral | [Angolex](https://angolex.com) |
| Decreto Executivo n.º 424/25 | Avaliação das aprendizagens (pré-escolar, primária, secundária) | [Angolex](https://angolex.com) |
| Decreto Executivo n.º 377/25 | (Verificar assunto) | [Lex.ao](https://lex.ao) |
| Estatuto Orgânico do Ministério da Educação | Competências do Ministério | [Angolex](https://angolex.com) |

### 4.2 Pontos a verificar

- [ ] Estrutura curricular (disciplinas, cargas horárias) por tipo de ensino
- [ ] Regras de avaliação e transição (médias, aprovação/reprovação)
- [ ] Modelos oficiais de certificados e declarações
- [ ] Prazos de envio de dados ao Ministério
- [ ] Regras de privacidade e proteção de dados (Lei de Proteção de Dados)

---

## 5. Checklist de ação Angola

### Fase 1 — Documentação (1–2 semanas)

```
□ Obter Decreto Executivo n.º 424/25 (avaliação)
□ Obter lista de relatórios obrigatórios do Ministério
□ Obter modelos oficiais de pautas e boletins (se existirem)
□ Verificar Regime Jurídico do Ensino Geral
```

### Fase 2 — Contacto (2–4 semanas)

```
□ Agendar reunião com Direção Nacional do Ensino Geral
□ Agendar reunião com Direção Provincial (se aplicável)
□ Contactar INE para requisitos de SIGE
□ Contactar SIGEA (Aptecnosoft) para benchmarking — opcional
```

### Fase 3 — Validação (4–8 semanas)

```
□ Apresentar relatórios do DSICOLA
□ Obter parecer por escrito
□ Implementar ajustes identificados
□ Validar novamente
```

### Fase 4 — Integração (se aplicável)

```
□ Obter especificação técnica do SIGE
□ Desenvolver módulo de envio
□ Testar em ambiente de homologação
□ Obter confirmação de conformidade
```

---

## 6. Contactos úteis

| Entidade | Função | Observação |
|----------|--------|------------|
| Ministério da Educação | Validação de relatórios | Luanda |
| Direção Nacional do Ensino Geral | Normas académicas | Supervisão SIUGEP |
| INE | Estatísticas, SIGE | [ine.gov.ao](https://www.ine.gov.ao) |
| AGT (Administração Geral Tributária) | SAFT-AO | [agt.minfin.gov.ao](https://www.agt.minfin.gov.ao) |
| Aptecnosoft (SIGEA) | Benchmarking | geral@aptecnosoft.ao |

---

## 7. Normas extraídas dos decretos

As normas técnicas (escalas, regras de transição, campos obrigatórios) foram extraídas da legislação e documentadas em **[NORMAS_ANGOLA_DECRETOS.md](NORMAS_ANGOLA_DECRETOS.md)**.

**Implementado no DSICOLA:**
- Pauta PDF: Reprovado e Rep. Falta em **vermelho e negrito** (Decreto 424/25, Art. 35.º e 36.º)

**Já em conformidade:**
- Escala 0–20 para Secundário (padrão Angola)
- Mínimo aprovação 10 (configurável)
- pt-AO, AOA, SAFT-AO, províncias, INSS 3%

---

## 8. Referências

- [SIUGEP — PT Jornal](https://ptjornal.com/escolas-publicas-angolanas-com-sistema-integrado-para-certificacao-de-documentos-379104/amp)
- [SIGEA — Sistema Gestão Escolar Angola](https://sigea.aptecnosoft.ao/)
- [Angolex — Legislação Angola](https://angolex.com)
- [Lex.ao — Direito Angolano](https://lex.ao)
- [SAFT-AO — Análise DSICOLA](SAFT_ANGOLA_ANALISE.md)

---

*Documento criado em março 2026. Atualizar conforme novas normas e contactos.*
