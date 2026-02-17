# Fluxo Completo de Faltas de Funcionários - DSICOLA

## Visão Geral

O sistema controla faltas, justificativas e descontos na folha de pagamento dos trabalhadores cadastrados.

---

## 1. Como as Faltas são Registradas

### 1.1 Presença normal (biometria ou manual)
- Funcionário marca entrada/saída via dispositivo biométrico OU via registro manual (RH)
- Cria `FrequenciaFuncionario` com `status: PRESENTE` ou `ATRASO`, `origem: BIOMETRIA` ou `MANUAL`

### 1.2 Ausência detectada automaticamente
- **Endpoint:** `POST /biometria/presencas/processar`
- **Quem chama:** ADMIN ou RH (ação manual no sistema)
- **Lógica:** Para cada funcionário ativo, se não existe presença no dia e já passou 1h do horário padrão de entrada → cria registro com `status: FALTA_NAO_JUSTIFICADA`
- **Importante:** Este processamento deve ser executado diariamente (ou antes de fechar a folha) para que ausências sejam registradas

### 1.3 Ausência registrada manualmente
- RH registra presença com `status: FALTA` ou `FALTA_NAO_JUSTIFICADA` em **Controle de Frequência**
- Local: Recursos Humanos → Frequência → Registrar Frequência

---

## 2. Status de Frequência

| Status | Significado | Desconta na folha? |
|--------|-------------|--------------------|
| PRESENTE | Compareceu | Não |
| ATRASO | Compareceu com atraso | Não |
| INCOMPLETO | Entrada sem saída (ou vice-versa) | Não |
| FALTA | Ausência genérica (legado) | **Sim** |
| FALTA_NAO_JUSTIFICADA | Ausência sem justificativa ou rejeitada | **Sim** |
| FALTA_JUSTIFICADA | Ausência com justificativa aprovada | **Não** |

---

## 3. Fluxo de Justificativas

### 3.1 Funcionário solicita justificativa
- **Endpoint:** `POST /biometria/justificativas`  
  Body: `{ frequenciaId, motivo, documentoUrl? }`
- Funcionário envia motivo (e opcionalmente documento anexo)
- Cria `JustificativaFalta` com `status: PENDENTE`

### 3.2 ADMIN/RH aprova
- **Endpoint:** `POST /biometria/justificativas/:id/aprovar`
- Atualiza `FrequenciaFuncionario.status` → `FALTA_JUSTIFICADA`
- **Resultado:** Ausência não é descontada na folha

### 3.3 ADMIN/RH rejeita
- **Endpoint:** `POST /biometria/justificativas/:id/rejeitar`  
  Body: `{ observacoes }` (obrigatório)
- Atualiza `FrequenciaFuncionario.status` → `FALTA_NAO_JUSTIFICADA`
- **Resultado:** Ausência continua sendo descontada

---

## 4. Cálculo do Desconto na Folha

**Fórmula:**
```
valorDia = salarioBase / diasUteisDoMes
descontoFaltas = valorDia × totalFaltasNaoJustificadas
```

- **diasUteisDoMes:** Exclui sábados, domingos e feriados (nacionais + institucionais)
- **totalFaltasNaoJustificadas:** Conta registros com `status: FALTA` ou `FALTA_NAO_JUSTIFICADA`
- **salarioBase:** Vem do Funcionário ou Cargo

**Onde é aplicado:**
- Criação da folha de pagamento (`folhaPagamento.controller.create`)
- Endpoint de prévia: `GET /folha-pagamento/calcular-descontos?funcionarioId=&mes=&ano=`

---

## 5. Checklist Operacional

| Ação | Responsável | Quando |
|------|-------------|--------|
| Processar presenças do dia | ADMIN/RH | Diariamente, após horário de entrada |
| Revisar justificativas pendentes | ADMIN/RH | Antes de fechar folha |
| Gerar folha do mês | ADMIN/RH | Início do mês seguinte |
| Fechar folha | ADMIN/RH | Após conferência |

---

## 6. Melhorias Sugeridas (sem alterar o atual)

1. **Frontend "Processar presenças":** Botão em Frequência para chamar `POST /biometria/presencas/processar` com data e horário padrão
2. **Frontend Justificativas:** Tela para funcionário solicitar e ADMIN/RH aprovar/rejeitar
3. **Agendamento:** Cron job para executar `processarPresencasDia` automaticamente (ex.: às 10h)
4. **Notificações:** Avisar funcionário quando tiver falta e puder justificar
5. **Dias sem registro:** Considerar "sem registro em dia útil" como falta (hoje só conta se `processarPresencasDia` tiver criado o registro)
