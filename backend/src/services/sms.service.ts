/**
 * Serviço de envio de SMS via Twilio (Enterprise)
 */

export interface SmsResult {
  success: boolean;
  error?: string;
}

/**
 * Normaliza telefone para formato E.164 (ex: +244923456789)
 */
function normalizarTelefone(telefone: string): string {
  let t = telefone.replace(/\D/g, '');
  if (!t.startsWith('244') && t.length >= 9) {
    t = '244' + t;
  }
  if (!t.startsWith('+')) {
    t = '+' + t;
  }
  return t.startsWith('+') ? t : '+' + t;
}

/**
 * Envia SMS via Twilio (Enterprise)
 * Não falha o fluxo - apenas retorna { success: false } se config ausente
 */
export async function enviarSms(to: string, body: string): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Twilio não configurado (TWILIO_* ausente)' };
  }

  const toE164 = normalizarTelefone(to);
  if (toE164.length < 10) {
    return { success: false, error: 'Número de telefone inválido' };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: new URLSearchParams({
        To: toE164,
        From: fromNumber,
        Body: body,
      }).toString(),
    });

    const data = (await res.json()) as { sid?: string; message?: string; code?: number };
    if (!res.ok) {
      return { success: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e: any) {
    console.error('[SmsService] Erro ao enviar SMS:', e?.message);
    return { success: false, error: e?.message || 'Erro ao enviar SMS' };
  }
}
