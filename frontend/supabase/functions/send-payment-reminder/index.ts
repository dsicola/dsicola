import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentReminderRequest {
  nome: string;
  email: string;
  valor: number;
  mesReferencia: string;
  instituicaoNome: string;
  portalUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, email, valor, mesReferencia, instituicaoNome, portalUrl }: PaymentReminderRequest = await req.json();

    console.log(`Sending payment reminder to: ${email}`);

    const valorFormatado = new Intl.NumberFormat("pt-AO", {
      style: "currency",
      currency: "AOA",
    }).format(valor);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${instituicaoNome} <onboarding@resend.dev>`,
        to: [email],
        subject: `Lembrete de Mensalidade em Atraso - ${mesReferencia}`,
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
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Sistema de Gestão Acadêmica</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
              <h2 style="color: #333; margin-top: 0;">Olá ${nome},</h2>
              
              <p>Identificamos que a mensalidade referente ao mês de <strong>${mesReferencia}</strong> está em atraso.</p>
              
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                  <strong>⚠️ Valor em aberto:</strong> ${valorFormatado}
                </p>
              </div>
              
              <p>Para regularizar sua situação e continuar tendo acesso a todos os recursos do sistema, por favor efetue o pagamento o mais breve possível.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${portalUrl}" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Acessar o Portal
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Caso já tenha efetuado o pagamento, por favor desconsidere este e-mail. Se tiver dúvidas, entre em contato com a secretaria da instituição.
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

    if (!res.ok) {
      const errorData = await res.text();
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
