/**
 * Serviço de envio de mensagens via Telegram Bot API (Pro/Enterprise)
 */

export interface TelegramResult {
  success: boolean;
  error?: string;
}

/**
 * Envia mensagem via Telegram Bot API
 * @param chatId - ID do chat do usuário (obtido ao iniciar o bot)
 * @param text - Texto da mensagem (máx ~4096 caracteres)
 */
export async function enviarTelegram(chatId: string, text: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN não configurado' };
  }

  const sanitized = String(chatId).trim();
  if (!sanitized || !/^-?\d+$/.test(sanitized)) {
    return { success: false, error: 'Chat ID inválido' };
  }

  const mensagem = text.slice(0, 4096);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: sanitized,
        text: mensagem,
        disable_web_page_preview: true,
      }),
    });

    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data?.ok) {
      return { success: false, error: data?.description || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e: any) {
    console.error('[TelegramService] Erro ao enviar:', e?.message);
    return { success: false, error: e?.message || 'Erro ao enviar' };
  }
}
