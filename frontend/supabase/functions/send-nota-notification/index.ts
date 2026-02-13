import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
const RESEND_FROM_NAME = Deno.env.get("RESEND_FROM_NAME");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotaNotificationRequest {
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  disciplina: string;
  turma: string;
  tipoAvaliacao: string;
  nota: number;
  instituicaoNome: string;
  professorNome?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const {
      alunoNome,
      alunoEmail,
      disciplina,
      turma,
      tipoAvaliacao,
      nota,
      instituicaoNome,
      professorNome,
    }: NotaNotificationRequest = await req.json();

    console.log(`Sending grade notification to: ${alunoEmail}`);

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RESEND_API_KEY não configurada.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const fromName = RESEND_FROM_NAME || instituicaoNome;
    const from = `${fromName} <${RESEND_FROM_EMAIL}>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: [alunoEmail],
        subject: `Nova Nota Lançada - ${tipoAvaliacao}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${instituicaoNome}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Notificação Acadêmica</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
              <h2 style="color: #333; margin-top: 0;">Olá ${alunoNome},</h2>
              
              <p>Uma nova nota foi lançada para você!</p>
              
              <div style="background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #0369a1;"><strong>Disciplina:</strong></td>
                    <td style="padding: 8px 0;">${disciplina}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #0369a1;"><strong>Turma:</strong></td>
                    <td style="padding: 8px 0;">${turma}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #0369a1;"><strong>Avaliação:</strong></td>
                    <td style="padding: 8px 0;">${tipoAvaliacao}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #0369a1;"><strong>Nota:</strong></td>
                    <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: ${nota >= 10 ? "#16a34a" : "#dc2626"};">${nota.toFixed(1)}</td>
                  </tr>
                  ${professorNome ? `
                  <tr>
                    <td style="padding: 8px 0; color: #0369a1;"><strong>Professor:</strong></td>
                    <td style="padding: 8px 0;">${professorNome}</td>
                  </tr>
                  ` : ""}
                </table>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Acesse o portal do aluno para visualizar seu boletim completo e acompanhar seu desempenho acadêmico.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p>Este é um e-mail automático enviado pelo sistema DSICOLA.</p>
              <p>Por favor, não responda a esta mensagem.</p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const status = res.ok ? "Enviado" : "Falhou";
    const responseText = res.ok ? null : await res.text();

    await supabase.from("emails_enviados").insert({
      destinatario_email: alunoEmail,
      destinatario_nome: alunoNome,
      assunto: `Nova Nota Lançada - ${tipoAvaliacao}`,
      tipo: "nota_lancada",
      status,
      erro: responseText,
    });

    if (!res.ok) {
      console.error("Resend API error:", responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Falha ao enviar e-mail. Verifique se o domínio do remetente está verificado no Resend e se o FROM usa esse domínio.",
          resend: responseText,
        }),
        {
          status: res.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const data = await res.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending email:", errorMessage);

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
