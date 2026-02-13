import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BoletimEmailRequest {
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  instituicaoNome: string;
  boletimHtml: string;
  anoLetivo: string;
  semestre?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const { 
      alunoId,
      alunoNome, 
      alunoEmail, 
      instituicaoNome,
      boletimHtml,
      anoLetivo,
      semestre
    }: BoletimEmailRequest = await req.json();

    console.log(`Sending boletim to: ${alunoEmail}`);

    const periodoTexto = semestre ? `${semestre}º Semestre de ${anoLetivo}` : `Ano Letivo ${anoLetivo}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${instituicaoNome} <onboarding@resend.dev>`,
        to: [alunoEmail],
        subject: `Boletim Escolar - ${periodoTexto}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${instituicaoNome}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Boletim Escolar</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
              <h2 style="color: #333; margin-top: 0;">Olá ${alunoNome},</h2>
              
              <p>Segue abaixo o seu boletim escolar referente ao período: <strong>${periodoTexto}</strong></p>
              
              <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                ${boletimHtml}
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Para mais detalhes, acesse o portal do aluno. Em caso de dúvidas, entre em contato com a secretaria acadêmica.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p>Este é um e-mail automático enviado pelo sistema DSICOLA.</p>
              <p>Por favor, não responda a esta mensagem.</p>
              <p style="margin-top: 10px;">Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const status = res.ok ? "Enviado" : "Falhou";
    const errorData = res.ok ? null : await res.text();

    // Log email
    await supabase.from("emails_enviados").insert({
      destinatario_email: alunoEmail,
      destinatario_nome: alunoNome,
      assunto: `Boletim Escolar - ${periodoTexto}`,
      tipo: "boletim",
      status,
      erro: errorData,
    });

    if (!res.ok) {
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
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
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
