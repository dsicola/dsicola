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

interface FrequenciaAlertRequest {
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  disciplina: string;
  turma: string;
  percentualPresenca: number;
  totalAulas: number;
  aulasPresentes: number;
  instituicaoNome: string;
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
      disciplina,
      turma,
      percentualPresenca,
      totalAulas,
      aulasPresentes,
      instituicaoNome 
    }: FrequenciaAlertRequest = await req.json();

    console.log(`Sending attendance alert to: ${alunoEmail}`);

    const aulasFaltantes = totalAulas - aulasPresentes;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${instituicaoNome} <onboarding@resend.dev>`,
        to: [alunoEmail],
        subject: `⚠️ Alerta de Frequência Crítica - ${disciplina}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #dc2626 0%, #f87171 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${instituicaoNome}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Alerta de Frequência</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
              <h2 style="color: #333; margin-top: 0;">Olá ${alunoNome},</h2>
              
              <p>Identificamos que sua frequência está abaixo do mínimo exigido (75%) em uma de suas disciplinas.</p>
              
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <div style="text-align: center; margin-bottom: 15px;">
                  <span style="font-size: 48px; font-weight: bold; color: #dc2626;">${percentualPresenca.toFixed(1)}%</span>
                  <p style="margin: 5px 0 0 0; color: #991b1b; font-size: 14px;">Frequência Atual</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #991b1b;"><strong>Disciplina:</strong></td>
                    <td style="padding: 8px 0;">${disciplina}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #991b1b;"><strong>Turma:</strong></td>
                    <td style="padding: 8px 0;">${turma}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #991b1b;"><strong>Total de Aulas:</strong></td>
                    <td style="padding: 8px 0;">${totalAulas}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #991b1b;"><strong>Presenças:</strong></td>
                    <td style="padding: 8px 0;">${aulasPresentes}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #991b1b;"><strong>Faltas:</strong></td>
                    <td style="padding: 8px 0; font-weight: bold; color: #dc2626;">${aulasFaltantes}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #854d0e; font-size: 14px;">
                  <strong>⚠️ Atenção:</strong> A frequência mínima obrigatória é de 75%. 
                  Caso não regularize sua situação, você poderá ser reprovado por faltas na disciplina.
                </p>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Recomendamos que entre em contato com a coordenação ou secretaria acadêmica para regularizar sua situação.
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
    const errorData = res.ok ? null : await res.text();

    // Log email
    await supabase.from("emails_enviados").insert({
      destinatario_email: alunoEmail,
      destinatario_nome: alunoNome,
      assunto: `Alerta de Frequência Crítica - ${disciplina}`,
      tipo: "frequencia_critica",
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
