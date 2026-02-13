import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadRequest {
  nome_instituicao: string;
  nome_responsavel: string;
  email: string;
  telefone: string;
  cidade?: string;
  mensagem?: string;
  plano_interesse?: string;
}

async function sendEmailWithResend(to: string, subject: string, html: string): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DSICOLA <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return false;
    }

    const result = await response.json();
    console.log("Email sent successfully:", result);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const leadData: LeadRequest = await req.json();
    console.log("Received lead data:", leadData);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert lead into database
    const { data: lead, error: insertError } = await supabase
      .from("leads_comerciais")
      .insert({
        nome_instituicao: leadData.nome_instituicao,
        nome_responsavel: leadData.nome_responsavel,
        email: leadData.email,
        telefone: leadData.telefone,
        cidade: leadData.cidade || null,
        mensagem: leadData.mensagem || null,
        plano_interesse: leadData.plano_interesse || null,
        status: "novo",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting lead:", insertError);
      throw new Error(`Failed to save lead: ${insertError.message}`);
    }

    console.log("Lead saved successfully:", lead.id);

    // Get all SUPER_ADMIN users to notify
    const { data: superAdmins, error: adminsError } = await supabase
      .from("user_roles")
      .select(`
        user_id,
        profiles:user_id (
          email,
          nome_completo
        )
      `)
      .eq("role", "SUPER_ADMIN");

    if (adminsError) {
      console.error("Error fetching super admins:", adminsError);
    }

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8B5CF6, #6366F1); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #6B7280; font-size: 12px; text-transform: uppercase; }
          .value { font-size: 16px; color: #111827; margin-top: 5px; }
          .footer { background: #1F2937; color: #9CA3AF; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
          .badge { display: inline-block; background: #10B981; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🎓 Nova Solicitação de Plano</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Uma nova instituição demonstrou interesse no DSICOLA</p>
          </div>
          <div class="content">
            <span class="badge">Novo Lead</span>
            
            <div class="field" style="margin-top: 20px;">
              <div class="label">Instituição</div>
              <div class="value">${leadData.nome_instituicao}</div>
            </div>
            
            <div class="field">
              <div class="label">Responsável</div>
              <div class="value">${leadData.nome_responsavel}</div>
            </div>
            
            <div class="field">
              <div class="label">Email</div>
              <div class="value"><a href="mailto:${leadData.email}">${leadData.email}</a></div>
            </div>
            
            <div class="field">
              <div class="label">Telefone</div>
              <div class="value"><a href="tel:${leadData.telefone}">${leadData.telefone}</a></div>
            </div>
            
            ${leadData.cidade ? `
            <div class="field">
              <div class="label">Cidade</div>
              <div class="value">${leadData.cidade}</div>
            </div>
            ` : ''}
            
            ${leadData.mensagem ? `
            <div class="field">
              <div class="label">Mensagem</div>
              <div class="value" style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #E5E7EB;">
                ${leadData.mensagem}
              </div>
            </div>
            ` : ''}
          </div>
          <div class="footer">
            <p style="margin: 0;">Sistema de Gestão Acadêmica DSICOLA</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Acesse o painel para gerenciar este lead</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email notification to each SUPER_ADMIN
    for (const admin of superAdmins || []) {
      const adminEmail = (admin.profiles as any)?.email;
      const adminName = (admin.profiles as any)?.nome_completo || "Administrador";

      if (!adminEmail) {
        console.log("No email found for admin:", admin.user_id);
        continue;
      }

      const subject = `🎓 Nova Solicitação de Plano - ${leadData.nome_instituicao}`;
      const success = await sendEmailWithResend(adminEmail, subject, emailHtml);

      // Log email sent
      await supabase.from("emails_enviados").insert({
        destinatario_email: adminEmail,
        destinatario_nome: adminName,
        assunto: subject,
        tipo: "lead_notification",
        status: success ? "Enviado" : "Erro",
        erro: success ? null : "Failed to send email",
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Lead registrado com sucesso",
        lead_id: lead.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-lead function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
