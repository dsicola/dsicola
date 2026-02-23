/**
 * Extrai mensagem amigável de erros da API.
 * Prioriza mensagem do backend (específica e formal) em vez de mensagens técnicas.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  if (error == null) return fallback;

  const err = error as { response?: { data?: { message?: string; error?: string } }; message?: string };
  const msg = err.response?.data?.message || err.response?.data?.error;
  if (msg && typeof msg === 'string' && msg.trim()) return msg.trim();

  if (err.message && typeof err.message === 'string' && err.message.trim()) {
    // Evitar mostrar mensagens técnicas do Axios
    if (/^Request failed with status code \d+$/i.test(err.message)) return fallback;
    if (/^Network Error$/i.test(err.message)) return 'Não foi possível conectar ao servidor. Verifique a sua ligação.';
    return err.message.trim();
  }

  return fallback;
}
