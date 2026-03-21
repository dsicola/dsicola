/**
 * Rótulos e classificação de ações de auditoria (backend usa códigos em inglês).
 */

export const AUDIT_ACAO_LABELS: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
  SUBMIT: "Submissão",
  APPROVE: "Aprovação",
  REJECT: "Rejeição",
  CLOSE: "Encerramento",
  REOPEN: "Reabertura",
  BLOCK: "Bloqueio",
  ESTORNAR: "Estorno (pagamento/recibo)",
  PAY: "Pagamento registado",
  REVERSE_PAY: "Reversão de pagamento",
  ANULAR: "Anulação",
  CALCULATE: "Cálculo",
  GENERATE: "Geração",
  GENERATE_REPORT: "Relatório gerado",
  LOGIN_SUCCESS: "Login bem-sucedido",
  LOGIN_FAILED: "Tentativa de login falhada",
  LOGIN_BLOCKED: "Conta bloqueada",
  LOGIN_UNLOCKED: "Conta desbloqueada",
  SECURITY_ALERT: "Alerta de segurança",
  PASSWORD_RESET_COMPLETED: "Palavra-passe redefinida",
  CONFIRM_PAYMENT: "Pagamento confirmado",
  CANCEL_PAYMENT: "Pagamento cancelado",
};

export function labelAcaoAuditoria(acao: string): string {
  return AUDIT_ACAO_LABELS[acao] || acao;
}

export function isCriacaoAcao(acao: string): boolean {
  const a = (acao || "").toUpperCase();
  return (
    a === "CREATE" ||
    a === "GENERATE" ||
    a === "GENERATE_REPORT" ||
    a === "SUBMIT" ||
    a === "PAY" ||
    a === "CONFIRM_PAYMENT" ||
    a === "CREATE_PAYMENT" ||
    a.startsWith("CREATE_")
  );
}

export function isAlteracaoAcao(acao: string): boolean {
  const a = (acao || "").toUpperCase();
  return a === "UPDATE" || a === "CALCULATE" || a.startsWith("UPDATE_");
}

export function isExclusaoOuReversaoAcao(acao: string): boolean {
  const a = (acao || "").toUpperCase();
  return (
    a === "DELETE" ||
    a === "ESTORNAR" ||
    a === "REVERSE_PAY" ||
    a === "ANULAR" ||
    a === "CANCEL_PAYMENT" ||
    a.startsWith("DELETE_")
  );
}

export function isSegurancaAcao(acao: string): boolean {
  const a = (acao || "").toUpperCase();
  return (
    a.startsWith("LOGIN_") ||
    a.includes("PASSWORD") ||
    a.includes("TWO_FACTOR") ||
    a === "SECURITY_ALERT" ||
    a.includes("2FA")
  );
}

export type AcaoFilterValue = "all" | "create" | "update" | "delete" | "security";

export function matchesAcaoFilter(acao: string, filter: AcaoFilterValue): boolean {
  if (filter === "all") return true;
  if (filter === "create") return isCriacaoAcao(acao);
  if (filter === "update") return isAlteracaoAcao(acao);
  if (filter === "delete") return isExclusaoOuReversaoAcao(acao);
  if (filter === "security") return isSegurancaAcao(acao);
  return true;
}

/** Variante visual do Badge conforme tipo de ação */
export function getAcaoBadgeVariant(
  acao: string
): "default" | "secondary" | "destructive" | "outline" {
  const a = (acao || "").toUpperCase();
  if (isCriacaoAcao(acao)) return "default";
  if (isAlteracaoAcao(acao)) return "secondary";
  if (isExclusaoOuReversaoAcao(acao)) return "destructive";
  if (isSegurancaAcao(acao)) return "outline";
  if (a.includes("APPROVE")) return "default";
  if (a.includes("REJECT") || a.includes("BLOCK")) return "destructive";
  return "outline";
}

/**
 * Resumo legível do User-Agent (sem serviço de geolocalização por IP).
 */
export function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua || ua === "unknown") return "—";
  if (ua === "DSICOLA-Scheduler" || ua.startsWith("DSICOLA-")) return "Processo interno / agendado";

  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/dsicola|okhttp|dart/i.test(ua)) return "App / cliente móvel";

  let os = "";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(" · ") : ua.slice(0, 96) + (ua.length > 96 ? "…" : "");
}
