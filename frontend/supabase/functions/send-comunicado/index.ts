import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ComunicadoRequest {
  comunicadoId: string;
  destinatarios: string; // Todos, Alunos, Professores
  titulo: string;
  conteudo: string;
  instituicaoNome: string;
  instituicaoId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { comunicadoId, destinatarios, titulo, conteudo, instituicaoNome, instituicaoId }: ComunicadoRequest = await req.json();

    console.log(`Sending comunicado to: ${destinatarios}`);

    // Get recipients based on destinatarios type
    let recipientQuery = supabaseClient.from("profiles").select("email, nome_completo");
    
    if (destinatarios === "Alunos") {
      const { data: alunoRoles } = await supabaseClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "ALUNO");
      
      if (alunoRoles && alunoRoles.length > 0) {
        const userIds = alunoRoles.map(r => r.user_id);
        recipientQuery = recipientQuery.in("id", userIds);
      }
    } else if (destinatarios === "Professores") {
      const { data: profRoles } = await supabaseClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "PROFESSOR");
      
      if (profRoles && profRoles.length > 0) {
        const userIds = profRoles.map(r => r.user_id);
        recipientQuery = recipientQuery.in("id", userIds);
      }
    }

    const { data: recipients, error: recipientsError } = await recipientQuery;

    if (recipientsError) {
      throw new Error(`Error fetching recipients: ${recipientsError.message}`);
    }

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No recipients found", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${instituicaoNome}</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
          <h2 style="color: #333; margin-top: 0;">${titulo}</h2>
          
          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            ${conteudo.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
          <p>Este é um email automático enviado por ${instituicaoNome}.</p>
        </div>
      </body>
      </html>
    `;

    let sentCount = 0;
    let errorCount = 0;

    for (const recipient of recipients) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${instituicaoNome} <onboarding@resend.dev>`,
            to: [recipient.email],
            subject: `Comunicado: ${titulo}`,
            html: emailHtml,
          }),
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const emailResponse = await res.json();

        // Log email sent
        await supabaseClient.from("emails_enviados").insert({
          destinatario_email: recipient.email,
          destinatario_nome: recipient.nome_completo,
          assunto: `Comunicado: ${titulo}`,
          tipo: "comunicado",
          status: "Enviado",
          instituicao_id: instituicaoId || null,
        });

        sentCount++;
        console.log(`Email sent to ${recipient.email}:`, emailResponse);
      } catch (emailError: unknown) {
        errorCount++;
        const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
        console.error(`Failed to send to ${recipient.email}:`, errorMessage);

        await supabaseClient.from("emails_enviados").insert({
          destinatario_email: recipient.email,
          destinatario_nome: recipient.nome_completo,
          assunto: `Comunicado: ${titulo}`,
          tipo: "comunicado",
          status: "Falhou",
          erro: errorMessage,
          instituicao_id: instituicaoId || null,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        failed: errorCount,
        total: recipients.length 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-comunicado function:", errorMessage);
    
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
