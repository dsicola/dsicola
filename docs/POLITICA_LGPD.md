# Política de Dados Pessoais (LGPD) — DSICOLA

Alinhamento a boas práticas de proteção de dados pessoais (ROADMAP-100).

---

## 1. Princípios Aplicados

| Princípio | Aplicação no DSICOLA |
|-----------|----------------------|
| **Minimização** | Coletamos apenas dados necessários para matrícula, notas, financeiro e gestão escolar |
| **Finalidade** | Dados usados exclusivamente para fins educacionais e administrativos da instituição |
| **Transparência** | Política de privacidade e termos disponíveis; utilizadores informados |
| **Segurança** | Senhas hasheadas (bcrypt), JWT, HTTPS, rate limiting |
| **Retenção** | Dados mantidos conforme necessidade institucional; backups com política de retenção |

---

## 2. Dados Coletados

- **Identificação:** nome, BI, data de nascimento, género
- **Contacto:** email, telefone, endereço
- **Académicos:** matrículas, notas, frequência
- **Financeiros:** mensalidades, pagamentos (para gestão institucional)

---

## 3. Retenção

- Dados ativos: enquanto o vínculo com a instituição existir
- Histórico académico: conforme exigência legal (ex.: 5 anos após conclusão)
- Backups: política definida por instituição (ver AUDITORIA_BACKUPS.md)

---

## 4. Direito ao Esquecimento

- **Solicitação:** O titular pode solicitar exclusão ou anonimização dos dados
- **Processo:** Contactar a instituição (admin) para formalizar pedido
- **Exceções:** Dados que a lei exija manter (ex.: histórico fiscal) não podem ser apagados totalmente; podem ser anonimizados quando aplicável

---

## 5. Compartilhamento

- Dados não são vendidos nem compartilhados com terceiros para fins comerciais
- Compartilhamento apenas quando exigido por lei ou com consentimento explícito

---

## 6. Responsável

A instituição de ensino é a responsável pelo tratamento dos dados. O DSICOLA atua como ferramenta de gestão; a política de privacidade da instituição deve ser aplicada.

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
