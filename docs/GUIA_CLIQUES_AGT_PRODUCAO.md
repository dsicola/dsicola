# Guia Passo a Passo — Onde Clicar (Sequencial e Orientado)

Este guia indica **passo a passo**, na ordem exata, o que fazer e onde clicar para gerar todas as exigências da AGT no DSICOLA.

---

# PARTE 1 — CONFIGURAÇÃO INICIAL

## Passos 1 a 20 — Dados Fiscais da Instituição

| Passo | O que fazer |
|-------|-------------|
| **1** | Abra o navegador. |
| **2** | Digite o endereço do DSICOLA (ex.: `https://sua-instituicao.dsicola.ao`). |
| **3** | Pressione Enter. |
| **4** | Faça login com o seu utilizador **ADMIN**. |
| **5** | No **menu lateral esquerdo**, localize o item **Sistema** (ícone de engrenagem). |
| **6** | Clique em **Sistema**. |
| **7** | A página de **Configurações** abre. |
| **8** | Deslize para baixo até ver a secção **Dados Fiscais**. |
| **9** | No campo **Nome fiscal**, escreva o nome da instituição. |
| **10** | No campo **Email fiscal**, escreva o email (ex.: `fiscal@instituicao.ao`). |
| **11** | No campo **Telefone fiscal**, escreva o telefone (ex.: `+244 923 456 789`). |
| **12** | No campo **Código postal**, escreva `0000` (ou o válido). |
| **13** | No campo **Endereço fiscal completo**, escreva o endereço. |
| **14** | No campo **Cidade**, escreva a cidade (ex.: `Luanda`). |
| **15** | No campo **Província / Estado**, escreva a província. |
| **16** | No campo **País fiscal**, selecione **Angola**. |
| **17** | No campo **NIF**, escreva o NIF real da instituição (9+ dígitos). Não use `000000000` nem `999999999`. |
| **18** | Deslize até ao fim da secção. |
| **19** | Clique no botão **Guardar** ou **Atualizar**. |
| **20** | Aguarde a mensagem de sucesso. |

> ⚠️ **Importante:** Guarde esta configuração. Sem NIF válido, a AGT rejeita o ficheiro SAF-T.

---

## Passos 21 a 35 — Garantir Alunos (com e sem NIF)

| Passo | O que fazer |
|-------|-------------|
| **21** | No **menu lateral esquerdo**, localize o item **Administrativo**. |
| **22** | Clique em **Administrativo**. |
| **23** | A página de gestão de **alunos/estudantes** abre. |
| **24** | Verifique se existem alunos. Se não existir nenhum, clique em **Admitir Estudante** ou **Novo Aluno** e preencha os dados. |
| **25** | Para cada aluno que usará nos pontos 1–8, 11–12: abra o registo e preencha o campo **Número de identificação** (BI/NIF). |
| **26** | Guarde o aluno com NIF. |
| **27** | Para os pontos 9 e 10, precisa de **2 alunos sem NIF**. |
| **28** | Crie um novo aluno OU edite um existente. |
| **29** | Nos dados desse aluno, **deixe em branco** o campo **Número de identificação**. |
| **30** | Guarde. |
| **31** | Crie ou edite outro aluno e também deixe o campo **Número de identificação** em branco. |
| **32** | Guarde. |
| **33** | Certifique-se de que existem **mensalidades** para pagar (em Gestão Académica/Financeira, conforme o fluxo da sua instituição). |
| **34** | Se não houver mensalidades, crie-as primeiro (turmas, matrículas, geração de propinas). |
| **35** | Volte ao **Dashboard** ou ao menu lateral. |

---

# PARTE 2 — PONTO 1 (FATURA COM CLIENTE NIF)

## Passos 36 a 50

| Passo | O que fazer |
|-------|-------------|
| **36** | No **menu lateral**, localize **Relatórios Financeiros** (não use «Finanças» nem «Pagamentos»). |
| **37** | Clique em **Relatórios Financeiros**. |
| **38** | A tabela de **mensalidades** aparece. |
| **39** | Procure uma linha com **Estado: Pendente** e cujo aluno tenha BI/NIF preenchido. |
| **40** | Nessa linha, clique no botão **Marcar Pago** (ou ícone de pagamento). |
| **41** | Um diálogo abre. |
| **42** | No campo **Data de pagamento**, selecione uma data (ex.: hoje ou 15/01/2026). |
| **43** | No campo **Forma de pagamento**, selecione **Transferência Bancária** (ou outra). |
| **44** | No campo **Valor**, confirme o valor. |
| **45** | Clique em **Confirmar Pagamento**. |
| **46** | Aguarde a confirmação. O sistema gera Recibo (RC) e Fatura (FT). |
| **47** | Na mesma linha (ou numa coluna de ações), procure o botão **Imprimir recibo** ou **Ver recibo**. |
| **48** | Clique em **Imprimir recibo** ou **Ver recibo**. |
| **49** | O PDF abre numa nova aba. Guarde-o com o nome `ponto1_recibo_ft.pdf`. |
| **50** | Feche o PDF e volte à tabela. |

---

# PARTE 3 — PONTO 2 (FATURA ANULADA)

## Passos 51 a 60

| Passo | O que fazer |
|-------|-------------|
| **51** | Na mesma tabela de **Relatórios Financeiros**, procure uma linha com **Estado: Pago** (outra mensalidade, não a do Ponto 1). |
| **52** | Nessa linha, clique no botão **Estornar**. |
| **53** | Uma mensagem de confirmação aparece. Leia o aviso. |
| **54** | Clique em **Confirmar** ou **Sim, estornar**. |
| **55** | O estado da mensalidade passa a **Estornado** e o documento fica **ANULADO**. |
| **56** | Na mesma linha, clique em **Imprimir recibo** ou **Ver recibo**. |
| **57** | O PDF abre. Deve mostrar o selo vermelho **ANULADO** em destaque. |
| **58** | Guarde o PDF como `ponto2_fatura_anulada.pdf`. |
| **59** | Feche o PDF. |
| **60** | Volte ao menu lateral. |

---

# PARTE 4 — PONTO 3 (PRÓ-FORMA)

## Passos 61 a 75

| Passo | O que fazer |
|-------|-------------|
| **61** | No **menu lateral**, clique em **Documentos Fiscais**. |
| **62** | A página de Documentos Fiscais abre. No topo, há 5 tabs: **Pró-forma**, **Guia Remessa**, **Fatura de PF**, **Nota Crédito**, **Lista**. |
| **63** | Clique na tab **Pró-forma**. |
| **64** | No dropdown **Cliente (Estudante)**, clique para abrir a lista. |
| **65** | Selecione um estudante **com NIF/BI** (o nome aparece com o número entre parênteses). |
| **66** | No dropdown **Moeda**, deixe **AOA** selecionado. |
| **67** | Na secção **Linhas do documento**, no primeiro campo **Descrição**, escreva: `Serviço educacional`. |
| **68** | No campo **Qtd**, escreva: `1`. |
| **69** | No campo **Preço unit.**, escreva: `100000`. |
| **70** | No campo **IVA %**, selecione **0**. |
| **71** | No campo **Cód. Isenção**, selecione **M01** (ou outro código de isenção). |
| **72** | Clique no botão **Emitir Pró-forma**. |
| **73** | Aguarde a mensagem de sucesso. |
| **74** | **Anote o número do documento** (ex.: `PF-2026-0001`). Vai precisar no Ponto 4. |
| **75** | Clique na tab **Lista**. Localize o documento recém-criado e clique em **Ver PDF**. Guarde como `ponto3_proforma.pdf`. |

---

# PARTE 5 — PONTO 4 (FATURA BASEADA NA PRÓ-FORMA)

## Passos 76 a 85

| Passo | O que fazer |
|-------|-------------|
| **76** | Na página **Documentos Fiscais**, clique na tab **Fatura de PF**. |
| **77** | No dropdown **Pró-forma**, clique para abrir a lista. |
| **78** | Selecione a pró-forma que criou no Ponto 3 (ex.: `PF-2026-0001`). |
| **79** | Clique no botão **Gerar Fatura**. |
| **80** | Aguarde a confirmação. |
| **81** | **Anote o número da fatura** (ex.: `FT-2026-0006`). Vai precisar no Ponto 5. |
| **82** | Clique na tab **Lista**. |
| **83** | Encontre a fatura recém-criada. |
| **84** | Clique em **Ver PDF**. |
| **85** | Guarde o PDF como `ponto4_ft_pf.pdf`. |

---

# PARTE 6 — PONTO 5 (NOTA DE CRÉDITO)

## Passos 86 a 98

| Passo | O que fazer |
|-------|-------------|
| **86** | Na página **Documentos Fiscais**, clique na tab **Nota Crédito**. |
| **87** | No dropdown **Fatura de referência**, clique para abrir a lista. |
| **88** | Selecione a fatura do Ponto 4 (ex.: `FT-2026-0006`). |
| **89** | No campo **Valor do crédito**, escreva: `10000`. |
| **90** | No dropdown **Moeda**, deixe **AOA**. |
| **91** | No campo **Motivo**, escreva: `Ajuste de valor`. |
| **92** | Clique no botão **Emitir Nota de Crédito**. |
| **93** | Aguarde a confirmação. |
| **94** | Clique na tab **Lista**. |
| **95** | Localize a Nota de Crédito recém-criada. |
| **96** | Clique em **Ver PDF**. |
| **97** | Guarde o PDF como `ponto5_nc.pdf`. |
| **98** | Volte à tab **Pró-forma** para os próximos pontos. |

---

# PARTE 7 — PONTO 6 (FATURA COM 2 LINHAS: IVA + ISENTO)

## Passos 99 a 117

| Passo | O que fazer |
|-------|-------------|
| **99** | Clique na tab **Pró-forma**. |
| **100** | Limpe ou ajuste o formulário. No dropdown **Cliente**, selecione um estudante **com NIF**. |
| **101** | Moeda: **AOA**. |
| **102** | **Linha 1:** No campo **Descrição**, escreva: `Material com IVA 14%`. |
| **103** | **Linha 1:** Qtd = `1`, Preço unit. = `10000`. |
| **104** | **Linha 1:** Em **IVA %**, selecione **14**. |
| **105** | **Linha 1:** Em **Cód. Isenção**, deixe vazio ou selecione «— Nenhum». |
| **106** | Clique no botão **Adicionar linha** (+). |
| **107** | **Linha 2:** Descrição = `Propina isenta`, Qtd = `1`, Preço unit. = `50000`. |
| **108** | **Linha 2:** **IVA %** = **0**. |
| **109** | **Linha 2:** **Cód. Isenção** = **M02** (ou M04, M11, etc.). |
| **110** | Clique em **Emitir Pró-forma**. |
| **111** | Aguarde a confirmação. Anote o número da pró-forma. |
| **112** | Clique na tab **Fatura de PF**. |
| **113** | Selecione esta pró-forma (a que acabou de criar). |
| **114** | Clique em **Gerar Fatura**. |
| **115** | Clique na tab **Lista**. |
| **116** | Localize a fatura recém-criada (2 linhas: IVA + isento). |
| **117** | Clique em **Ver PDF** e guarde como `ponto6_iva_isento.pdf`. |

---

# PARTE 8 — PONTO 8 (DOCUMENTO EM MOEDA ESTRANGEIRA)

## Passos 118 a 125

| Passo | O que fazer |
|-------|-------------|
| **118** | Clique na tab **Pró-forma**. |
| **119** | **Cliente:** estudante com NIF. **Moeda:** selecione **USD** (ou **EUR**). |
| **120** | **Linha:** Descrição = `Taxa em USD`, Qtd = `1`, Preço unit. = `100`. |
| **121** | IVA % = 0, Cód. Isenção = M01. |
| **122** | Clique em **Emitir Pró-forma**. |
| **123** | Clique na tab **Lista**. |
| **124** | Localize o documento. Clique em **Ver PDF**. |
| **125** | Guarde como `ponto8_moeda_estrangeira.pdf`. |

---

# PARTE 9 — PONTOS 9 E 10 (CLIENTE SEM NIF, < 50 AOA)

## Passos 126 a 140

| Passo | O que fazer |
|-------|-------------|
| **126** | Clique na tab **Pró-forma**. |
| **127** | No dropdown **Cliente**, selecione um aluno **sem NIF/BI** (sem número entre parênteses). |
| **128** | Moeda: **AOA**. |
| **129** | **Linha:** Descrição = `Taxa mínima`, Qtd = `1`, Preço unit. = `35` (total 35 AOA < 50). |
| **130** | Clique em **Emitir Pró-forma**. |
| **131** | Guarde o PDF como `ponto9_sem_nif_1.pdf`. |
| **132** | Repita para **outro** aluno sem NIF. |
| **133** | Cliente: outro aluno sem NIF. |
| **134** | Descrição = `Serviço consumidor final`, Qtd = `1`, Preço = `40`. |
| **135** | Clique em **Emitir Pró-forma**. |
| **136** | Guarde como `ponto10_sem_nif_2.pdf`. |
| **137** | — |
| **138** | — |
| **139** | — |
| **140** | — |

---

# PARTE 10 — PONTO 11 (DUAS GUIAS DE REMESSA)

## Passos 141 a 155

| Passo | O que fazer |
|-------|-------------|
| **141** | Na página **Documentos Fiscais**, clique na tab **Guia Remessa**. |
| **142** | **Cliente:** estudante com NIF. **Moeda:** AOA. |
| **143** | **Linha:** Descrição = `Material escolar - Lote 1`, Qtd = `1`, Preço = `5000`. |
| **144** | Clique em **Emitir Guia de Remessa**. |
| **145** | Guarde o PDF como `ponto11_gr1.pdf`. |
| **146** | Na mesma tab **Guia Remessa**, preencha de novo. |
| **147** | **Linha:** Descrição = `Material escolar - Lote 2`, Qtd = `1`, Preço = `3000`. |
| **148** | Clique em **Emitir Guia de Remessa**. |
| **149** | Guarde como `ponto11_gr2.pdf`. |
| **150** | — |
| **151** | — |
| **152** | — |
| **153** | — |
| **154** | — |
| **155** | — |

---

# PARTE 11 — PONTO 12 (ORÇAMENTO)

## Passos 156 a 165

| Passo | O que fazer |
|-------|-------------|
| **156** | Clique na tab **Pró-forma**. |
| **157** | **Cliente:** estudante com NIF. **Moeda:** AOA. |
| **158** | **Linha:** Descrição = `Orçamento ano letivo`, Qtd = `12`, Preço unit. = `15000` (total 180 000). |
| **159** | Clique em **Emitir Pró-forma**. |
| **160** | Clique na tab **Lista**. |
| **161** | Localize o documento. Clique em **Ver PDF**. |
| **162** | Guarde como `ponto12_orcamento.pdf`. |
| **163** | — |
| **164** | — |
| **165** | — |

---

# PARTE 12 — PONTO 7 + TODOS OS DOCUMENTOS AGT (SCRIPT)

O script gera **todos** os documentos exigidos pela AGT (incluindo o Ponto 7, que a interface não suporta).  
A AGT exige documentos em **dois meses diferentes**. Execute o script **duas vezes**, com duas datas.

### Opção A — Via API (recomendada em produção)

**Não precisa de Railway CLI nem de copiar DATABASE_URL.** Faça login na aplicação em produção e chame o endpoint:

```bash
# Substitua TOKEN pelo seu JWT (obtenha depois do login no navegador) e API_URL pelo URL do backend
curl -X POST "https://SEU-BACKEND.railway.app/agt/gerar-testes-completo" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"instituicaoId": "669440c3-639e-4876-94e9-cc391240de46"}'
```

- **ADMIN:** use o token da sua sessão; não precisa de `instituicaoId` no body (usa a sua instituição).
- **SUPER_ADMIN:** inclua `instituicaoId` no body.

Obter o token: Faça login na aplicação → DevTools (F12) → Application → Local Storage → copie o valor de `accessToken` (ou similar).

### Opção B — Script via terminal

Se usar uma **instituição em produção**, verifique antes os pré-requisitos:

```bash
# Com Railway (aponta à base de produção):
railway run npx tsx scripts/verificar-prerequisitos-agt.ts 669440c3-639e-4876-94e9-cc391240de46
```

O script confirma: instituição existe, NIF válido, alunos com/sem NIF. Corrija o que faltar antes de gerar documentos.

## Passos 166 a 185

| Passo | O que fazer |
|-------|-------------|
| **166** | Abra um terminal. Navegue até à pasta do projeto e entre no backend: `cd backend`. |
| **166b** | *(Produção)* Verifique pré-requisitos: `railway run npx tsx scripts/verificar-prerequisitos-agt.ts <instituicaoId>` |
| **167** | **1.ª execução (Mês 1):** Execute: `npx tsx scripts/seed-documentos-teste-agt.ts 2026-02-15` |
| **168** | (Se tiver várias instituições, use: `npx tsx scripts/seed-documentos-teste-agt.ts <instituicaoId> 2026-02-15`) |
| **169** | Aguarde terminar. Serão criados 11 documentos com data de Fevereiro. |
| **170** | **2.ª execução (Mês 2):** Execute: `npx tsx scripts/seed-documentos-teste-agt.ts 2026-03-15` |
| **171** | (Ou com instituicaoId: `npx tsx scripts/seed-documentos-teste-agt.ts <instituicaoId> 2026-03-15`) |
| **172** | Aguarde. Serão criados mais 11 documentos com data de Março. |
| **173** | No navegador, vá a **Documentos Fiscais** → tab **Lista**. |
| **174** | Para cada documento, clique em **Ver PDF** e guarde com o nome indicado na tabela abaixo. |
| **175** | Exemplo Ponto 7: localize a fatura com valor 55,16 (100×0,55 + desconto) e guarde como `ponto7_desconto.pdf`. |
| **176** | — |
| **177** | — |
| **178** | — |
| **179** | — |
| **180** | — |
| **181** | — |
| **182** | — |
| **183** | — |
| **184** | — |
| **185** | — |

---

# PARTE 13 — EXPORTAR SAF-T (XML)

## Passos 176 a 188

| Passo | O que fazer |
|-------|-------------|
| **176** | No **menu lateral**, localize **Exportar SAFT**. |
| **177** | Clique em **Exportar SAFT**. |
| **178** | (Se for SUPER_ADMIN) No dropdown **Instituição**, selecione a instituição. |
| **179** | No campo **Ano**, selecione o ano (ex.: `2026`). |
| **180** | No campo **Mês**, selecione um mês que inclua os documentos ou **Ano inteiro**. |
| **181** | Clique no botão **Gerar** ou **Exportar** ou **Exportar SAFT-AO**. |
| **182** | Aguarde a geração do XML. |
| **183** | O ficheiro XML será descarregado (ou um link aparecerá). |
| **184** | Guarde o ficheiro com um nome como `SAFT-DSICOLA-2026.xml`. |
| **185** | Verifique que o ficheiro foi guardado corretamente. |
| **186** | — |
| **187** | — |
| **188** | — |

---

# PARTE 14 — MONTAR E ENVIAR À AGT

## Passos 189 a 200

| Passo | O que fazer |
|-------|-------------|
| **189** | Crie uma pasta no seu computador (ex.: `Pacote_AGT_DSICOLA`). |
| **190** | Copie para essa pasta: todos os PDFs (`ponto1_...` até `ponto12_...` e `ponto7_...`), o ficheiro XML SAF-T e a carta de apresentação. |
| **191** | Preencha a **tabela de mapeamento** (qual PDF corresponde a qual ponto 1–15). |
| **192** | Abra o seu cliente de email. |
| **193** | Destinatário: `produtos.dfe.dcrr.agt@minfin.gov.ao`. |
| **194** | Assunto: `Validação software DSICOLA — Ref. 0000481/01180000/AGT/2026`. |
| **195** | Corpo: Carta de apresentação + tabela de mapeamento. |
| **196** | Anexe todos os PDFs e o ficheiro XML. |
| **197** | Revise os anexos. |
| **198** | Envie o email. |
| **199** | Guarde uma cópia do email enviado e dos anexos. |
| **200** | Concluído. Prazo: 15 dias úteis após notificação. |

---

## Resumo dos Ficheiros a Guardar

| Ficheiro | Ponto |
|----------|-------|
| `ponto1_recibo_ft.pdf` | 1 |
| `ponto2_fatura_anulada.pdf` | 2 |
| `ponto3_proforma.pdf` | 3 |
| `ponto4_ft_pf.pdf` | 4 |
| `ponto5_nc.pdf` | 5 |
| `ponto6_iva_isento.pdf` | 6 |
| `ponto7_desconto.pdf` | 7 |
| `ponto8_moeda_estrangeira.pdf` | 8 |
| `ponto9_sem_nif_1.pdf` | 9 |
| `ponto10_sem_nif_2.pdf` | 10 |
| `ponto11_gr1.pdf` e `ponto11_gr2.pdf` | 11 |
| `ponto12_orcamento.pdf` | 12 |
| `SAFT-DSICOLA-2026.xml` | SAF-T |

---

## URLs Rápidas

| Página | URL |
|--------|-----|
| Configurações (Dados Fiscais) | `/admin-dashboard/configuracoes` |
| Relatórios Financeiros (Pagar/Estornar) | `/admin-dashboard/gestao-financeira` |
| Documentos Fiscais | `/admin-dashboard/documentos-fiscais` |
| Exportar SAFT | `/admin-dashboard/exportar-saft` |
| Alunos (Administrativo) | `/admin-dashboard/gestao-alunos` |
