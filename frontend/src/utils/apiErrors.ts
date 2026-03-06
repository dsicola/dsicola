/**
 * Extrai mensagem amigável de erros da API.
 * Prioriza mensagem do backend (específica e formal) em vez de mensagens técnicas.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  if (error == null) return fallback;

  const err = error as {
    response?: {
      status?: number;
      data?: {
        message?: string;
        error?: string;
        code?: string;
        details?: Array<{ message?: string; field?: string }>;
      };
    };
    message?: string;
  };

  // 1. Mensagem explícita do backend
  const msg = err.response?.data?.message || err.response?.data?.error;
  if (msg && typeof msg === 'string' && msg.trim()) return msg.trim();

  // 2. Primeiro erro de validação (Zod/details)
  const details = err.response?.data?.details;
  if (Array.isArray(details) && details.length > 0 && details[0]?.message) {
    return String(details[0].message).trim();
  }

  // 3. Fallbacks por código HTTP quando não há mensagem específica
  const status = err.response?.status;
  if (status === 401) return 'Sessão expirada ou inválida. Faça login novamente.';
  if (status === 403) return 'Não tem permissão para esta ação. Contacte o administrador se necessário.';
  if (status === 404) return 'O item solicitado não foi encontrado.';
  if (status === 409) return 'Já existe um registo com estes dados. Verifique e tente novamente.';
  if (status === 422) return 'Os dados introduzidos são inválidos. Verifique os campos e tente novamente.';

  // 4. Mensagem do erro (evitar técnicas)
  if (err.message && typeof err.message === 'string' && err.message.trim()) {
    if (/^Request failed with status code \d+$/i.test(err.message)) return fallback;
    if (/^Network Error$/i.test(err.message)) return 'Não foi possível conectar ao servidor. Verifique a sua ligação à internet.';
    if (/^timeout of \d+ms exceeded$/i.test(err.message)) return 'A operação demorou demasiado. Tente novamente.';
    return err.message.trim();
  }

  return fallback;
}
