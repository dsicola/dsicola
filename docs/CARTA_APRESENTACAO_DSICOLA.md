# Carta de Apresentação — DSICOLA

**Sistema de Gestão Escolar e Académica para Angola**

---

## Carta Formal

**Data:** [Data atual]

**Destinatário:**  
Administração Geral Tributária (AGT)  
Direcção de Cobrança, Reembolso e Restituição  
Ministério das Finanças — República de Angola

**Assunto:** Apresentação do software DSICOLA para validação e certificação fiscal — Ref. Notificação 0000481/01180000/AGT/2026

---

Exmos. Senhores,

Com a presente, vimos apresentar o **DSICOLA** — Sistema Integrado de Gestão Escolar e Académica — desenvolvido para instituições de ensino em Angola, e solicitar a sua validação e certificação junto da Administração Geral Tributária, em conformidade com a notificação recebida em 12 de Março de 2026.

---

## 1. O que é o DSICOLA

O DSICOLA é uma plataforma **multi-tenant** (SaaS) que centraliza a gestão académica e financeira de colégios, liceus e instituições de ensino superior. Foi concebido especificamente para o contexto angolano, com suporte a:

- **Ensino Secundário** (10ª, 11ª, 12ª classes)  
- **Ensino Superior** (licenciaturas, cursos técnicos)  
- **Propinas e mensalidades** em Kwanzas (AOA)  
- **Recibos e faturas** conformes com a legislação fiscal angolana  

O sistema permite que cada instituição configure os seus dados fiscais, cursos, turmas e regras de faturação de forma **totalmente dinâmica**, garantindo conformidade e rastreabilidade em cada documento emitido.

---

## 2. Conformidade fiscal implementada

O DSICOLA foi desenvolvido em estreita observância dos seguintes diplomas legais:

| Diploma | Aplicação no DSICOLA |
|---------|----------------------|
| **Decreto Presidencial nº 312/18** | Submissão eletrónica via ficheiro SAF-T AO |
| **Decreto Executivo nº 317/20** | Estrutura XML conforme schema oficial SAF-T AO 1.01_01 |
| **Decreto Executivo nº 683/25** | Hash SHA-256, HashControl, texto fiscal nos PDFs, QR Code de verificação |

### Funcionalidades fiscais implementadas

- **Recibos (RC) e Faturas (FT)** com número sequencial, data, valor e identificação do estudante  
- **Texto fiscal obrigatório** no rodapé de cada PDF: `[HashControl]-Processado por programa válido n31.1/AGT20`  
- **Código QR** em cada recibo para verificação de autenticidade  
- **Hash e HashControl** calculados e persistidos por documento  
- **Exportação SAF-T AO** em XML, com validação estrutural e opcional contra XSD  
- **ProductCode** sanitizado (ex.: CL10, CL11) para evitar erros de validação  
- **ATCUD** no formato série-ano/número (ex.: DSICOLA-2026/0001)  
- **Cidade e endereço** dinâmicos por instituição e por estudante  

---

## 3. Modelo de negócio e fluxo fiscal

O DSICOLA segue um fluxo claro e auditável:

```
Aluno paga propina → Sistema regista pagamento → Gera recibo (RC)
                                              → Cria DocumentoFinanceiro
                                              → Calcula hash e HashControl
                                              → PDF com texto fiscal e QR
                                              → Exportação SAF-T para AGT
```

Os totais são consistentes entre documentos, linhas e pagamentos, permitindo auditoria completa e sem discrepâncias.

---

## 4. Pedido de validação

Solicitamos à AGT que:

1. **Valide** a amostra de documentos (PDFs e ficheiro SAF-T XML) enviada em anexo  
2. **Conceda** a certificação do software DSICOLA para faturação de propinas e mensalidades  
3. **Atribua** o número de certificado (SoftwareCertificateNumber) para integração no sistema  

Comprometemo-nos a:

- Manter todas as alterações regulamentares necessárias  
- Colaborar com a AGT em qualquer esclarecimento técnico  
- Garantir que os utilizadores (instituições de ensino) cumpram as obrigações fiscais através do sistema  

---

## 5. Contactos

Para qualquer esclarecimento ou documentação adicional:

- **Email:** [inserir contacto]  
- **Website:** [inserir URL]  
- **Documentação técnica:** Disponível mediante solicitação  

---

Aguardamos a vossa análise e resposta, com o devido respeito à vossa autoridade e ao cumprimento dos prazos estabelecidos.

Com os melhores cumprimentos,

---

**[Nome do Responsável]**  
**[Cargo]**  
**[Empresa / Instituição]**  
**[Data]**

---

## Anexos sugeridos

- [ ] PDFs de exemplo (recibos em dois meses diferentes)  
- [ ] Ficheiro XML SAF-T AO com todos os documentos  
- [ ] Mapeamento documento a documento (Ponto 1: Recibo RCB-2026-XXXX, etc.)  
- [ ] Manual do utilizador (resumo)  
- [ ] Declaração de conformidade técnica  

---

# Carta de Apresentação — Para Instituições de Ensino

**Versão comercial para colégios, liceus e universidades**

---

## Carta Formal (Clientes)

**Data:** [Data atual]

**Destinatário:**  
Exmo. Director(a) / Administrador(a)  
[Nome da Instituição]

**Assunto:** Apresentação do DSICOLA — Sistema de Gestão Escolar e Académica

---

Exmo.(a) Senhor(a) Director(a),

Temos o prazer de apresentar o **DSICOLA** — um sistema moderno e completo de gestão escolar e académica, desenhado especificamente para instituições de ensino em Angola.

---

## Por que escolher o DSICOLA

### 1. Feito para Angola

O DSICOLA foi desenvolvido com a realidade angolana em mente:

- **Propinas em Kwanzas (AOA)**  
- **Recibos e faturas** conformes com a AGT  
- **Exportação SAF-T** para cumprimento fiscal  
- **Suporte a Ensino Secundário** (10ª, 11ª, 12ª classes) e **Ensino Superior**  

### 2. Tudo num só lugar

- **Matrículas** e inscrições  
- **Mensalidades** e pagamentos  
- **Recibos** com QR Code para verificação  
- **Pautas** e avaliações  
- **Certificados** e declarações  
- **Relatórios** financeiros e académicos  

### 3. Segurança e conformidade

- Dados fiscais configuráveis por instituição  
- Hash e controlo em cada documento  
- Multi-tenant: cada escola com os seus dados isolados  
- Preparado para certificação AGT  

### 4. Simplicidade de uso

- Interface intuitiva em português  
- Suporte a impressão A4 e térmica (80mm)  
- Acesso via browser, sem instalação complexa  

---

## Próximos passos

Gostaríamos de agendar uma **demonstração gratuita** para mostrar como o DSICOLA pode simplificar a gestão da vossa instituição e garantir a conformidade fiscal.

Ficamos à disposição para qualquer esclarecimento.

Com os melhores cumprimentos,

---

**[Nome do Responsável Comercial]**  
**[Cargo]**  
**[Contacto]**  
**[Email]**  
**[Telefone]**
