import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssinaturaComInstituicao {
  id: string;
  instituicao_id: string;
  status: string;
  data_proximo_pagamento: string | null;
  valor_atual: number;
  ultimo_lembrete_enviado: string | null;
  iban: string | null;
  multicaixa_numero: string | null;
  instrucoes_pagamento: string | null;
  instituicao: {
    id: string;
    nome: string;
    email_contato: string | null;
  };
  plano: {
    nome: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Check if this is a new payment proof notification
    let body: { 
      type?: string; 
      instituicao_id?: string; 
      instituicao_nome?: string;
      valor?: number;
      plano_nome?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      // No body, proceed with normal reminder flow
    }

    // Handle new payment proof notification
    if (body.type === 'new_payment_proof') {
      console.log(`New payment proof from: ${body.instituicao_nome}`);
      
      // Fetch all SUPER_ADMIN users with their profiles
      const { data: superAdminRoles, error: adminsError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'SUPER_ADMIN');

      if (adminsError) {
        console.error("Error fetching SUPER_ADMIN users:", adminsError);
        throw adminsError;
      }

      // Get profiles for each SUPER_ADMIN
      const superAdminUserIds = (superAdminRoles || []).map(r => r.user_id);
      
      const { data: superAdminProfiles } = await supabase
        .from('profiles')
        .select('id, email, nome_completo')
        .in('id', superAdminUserIds);

      console.log(`Found ${superAdminProfiles?.length || 0} SUPER_ADMIN users`);

      // Get institution details
      const { data: instituicao } = await supabase
        .from('instituicoes')
        .select('nome, email_contato, subdominio')
        .eq('id', body.instituicao_id)
        .single();

      // Get subscription details
      const { data: assinaturaData } = await supabase
        .from('assinaturas')
        .select('valor_atual, plano_id')
        .eq('instituicao_id', body.instituicao_id)
        .single();

      // Get plan name
      let planoNome = 'N/A';
      if (assinaturaData?.plano_id) {
        const { data: planoData } = await supabase
          .from('planos')
          .select('nome')
          .eq('id', assinaturaData.plano_id)
          .single();
        planoNome = planoData?.nome || 'N/A';
      }

      const formatCurrency = (value: number) => 
        new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value);

      const valorFormatado = assinaturaData ? formatCurrency(assinaturaData.valor_atual) : 'N/A';
      const dataAtual = new Date().toLocaleDateString('pt-AO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Send email to each SUPER_ADMIN
      const emailsSent = [];
      for (const adminProfile of superAdminProfiles || []) {
        if (!adminProfile.email) continue;

        const assunto = `📩 Novo Comprovativo de Pagamento – ${instituicao?.nome || body.instituicao_nome}`;
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
              .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
              .content { padding: 30px 20px; }
              .info-box { background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
              .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
              .info-row:last-child { border-bottom: none; }
              .info-label { color: #6b7280; font-size: 14px; }
              .info-value { font-weight: 600; color: #1f2937; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
              .alert-icon { font-size: 48px; margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="alert-icon">📩</div>
                <h1>Novo Comprovativo Recebido</h1>
              </div>
              <div class="content">
                <p>Olá <strong>${adminProfile.nome_completo || 'Administrador'}</strong>,</p>
                
                <p>Uma instituição acabou de enviar um <strong>comprovativo de pagamento</strong> e está aguardando a sua análise.</p>
                
                <div class="info-box">
                  <div class="info-row">
                    <span class="info-label">🏛️ Instituição:</span>
                    <span class="info-value">${instituicao?.nome || body.instituicao_nome}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">📧 Email de Contato:</span>
                    <span class="info-value">${instituicao?.email_contato || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">📦 Plano:</span>
                    <span class="info-value">${planoNome}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">💰 Valor:</span>
                    <span class="info-value">${valorFormatado}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">📅 Data de Envio:</span>
                    <span class="info-value">${dataAtual}</span>
                  </div>
                </div>

                <p style="text-align: center;">
                  <a href="https://dsicola.lovable.app/superadmin" class="cta-button">
                    🔍 Revisar Comprovativo no Painel
                  </a>
                </p>
                
                <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                  Acesse o painel de administração para visualizar o comprovativo e confirmar ou rejeitar o pagamento.
                </p>
              </div>
              <div class="footer">
                <p>Este é um e-mail automático do sistema <strong>DSICOLA</strong>.</p>
                <p>Por favor, não responda a este e-mail.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "DSICOLA <onboarding@resend.dev>",
              to: [adminProfile.email],
              subject: assunto,
              html: htmlContent,
            }),
          });

          const status = res.ok ? "Enviado" : "Erro";
          const errorData = res.ok ? null : await res.text();

          if (!res.ok) {
            console.error(`Error sending email to ${adminProfile.email}:`, errorData);
          } else {
            console.log(`Email sent successfully to ${adminProfile.email}`);
          }

          // Log the email
          await supabase.from("emails_enviados").insert({
            destinatario_email: adminProfile.email,
            destinatario_nome: adminProfile.nome_completo,
            assunto: assunto,
            tipo: "novo_comprovativo",
            status,
            erro: errorData,
          });

          emailsSent.push({
            email: adminProfile.email,
            status,
          });
        } catch (emailError) {
          console.error(`Error sending email to ${adminProfile.email}:`, emailError);
          
          await supabase.from("emails_enviados").insert({
            destinatario_email: adminProfile.email,
            destinatario_nome: adminProfile.nome_completo,
            assunto: assunto,
            tipo: "novo_comprovativo",
            status: "Erro",
            erro: String(emailError),
          });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `${emailsSent.length} SUPER_ADMIN(s) notificado(s)`,
          details: emailsSent 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Normal reminder flow for subscriptions
    const today = new Date();

    // Fetch all active subscriptions with payment dates
    const { data: assinaturas, error: fetchError } = await supabase
      .from("assinaturas")
      .select(`
        *,
        instituicao:instituicoes(id, nome, email_contato),
        plano:planos(nome)
      `)
      .eq("status", "ativa")
      .not("data_proximo_pagamento", "is", null);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    const emailsSent = [];

    for (const assinatura of (assinaturas as AssinaturaComInstituicao[]) || []) {
      if (!assinatura.instituicao?.email_contato) continue;

      const vencimento = new Date(assinatura.data_proximo_pagamento!);
      const diffDays = Math.ceil((vencimento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let tipoLembrete: string | null = null;
      let assunto = "";
      let mensagem = "";

      const formatCurrency = (value: number) => 
        new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value);

      const valorFormatado = formatCurrency(assinatura.valor_atual);
      const dataVencimento = vencimento.toLocaleDateString("pt-AO");

      // 5 days before
      if (diffDays === 5) {
        tipoLembrete = "5_dias";
        assunto = `Lembrete: Renovação de assinatura em 5 dias - ${assinatura.instituicao.nome}`;
        mensagem = `
          <h2>Lembrete de Renovação</h2>
          <p>Prezado(a) Administrador(a),</p>
          <p>Este é um lembrete de que a assinatura da <strong>${assinatura.instituicao.nome}</strong> 
          vence em <strong>5 dias</strong> (${dataVencimento}).</p>
          <p><strong>Plano:</strong> ${assinatura.plano?.nome || "N/A"}</p>
          <p><strong>Valor:</strong> ${valorFormatado}</p>
          ${assinatura.iban ? `<p><strong>IBAN:</strong> ${assinatura.iban}</p>` : ""}
          ${assinatura.multicaixa_numero ? `<p><strong>Multicaixa Express:</strong> ${assinatura.multicaixa_numero}</p>` : ""}
          ${assinatura.instrucoes_pagamento ? `<p><strong>Instruções:</strong> ${assinatura.instrucoes_pagamento}</p>` : ""}
          <p>Por favor, efetue o pagamento para evitar a suspensão do serviço.</p>
        `;
      }
      // On the day
      else if (diffDays === 0) {
        tipoLembrete = "dia_vencimento";
        assunto = `URGENTE: Assinatura vence hoje - ${assinatura.instituicao.nome}`;
        mensagem = `
          <h2>⚠️ Assinatura Vence Hoje</h2>
          <p>Prezado(a) Administrador(a),</p>
          <p>A assinatura da <strong>${assinatura.instituicao.nome}</strong> 
          <strong>vence hoje</strong> (${dataVencimento}).</p>
          <p><strong>Plano:</strong> ${assinatura.plano?.nome || "N/A"}</p>
          <p><strong>Valor:</strong> ${valorFormatado}</p>
          ${assinatura.iban ? `<p><strong>IBAN:</strong> ${assinatura.iban}</p>` : ""}
          ${assinatura.multicaixa_numero ? `<p><strong>Multicaixa Express:</strong> ${assinatura.multicaixa_numero}</p>` : ""}
          <p><strong>Por favor, efetue o pagamento imediatamente para evitar a suspensão do acesso.</strong></p>
        `;
      }
      // 3 days overdue
      else if (diffDays === -3) {
        tipoLembrete = "3_dias_apos";
        assunto = `BLOQUEIO IMINENTE: Assinatura vencida há 3 dias - ${assinatura.instituicao.nome}`;
        mensagem = `
          <h2>🚨 Bloqueio Iminente</h2>
          <p>Prezado(a) Administrador(a),</p>
          <p>A assinatura da <strong>${assinatura.instituicao.nome}</strong> 
          está <strong>vencida há 3 dias</strong>.</p>
          <p><strong>O acesso ao sistema será bloqueado em breve.</strong></p>
          <p><strong>Plano:</strong> ${assinatura.plano?.nome || "N/A"}</p>
          <p><strong>Valor:</strong> ${valorFormatado}</p>
          ${assinatura.iban ? `<p><strong>IBAN:</strong> ${assinatura.iban}</p>` : ""}
          ${assinatura.multicaixa_numero ? `<p><strong>Multicaixa Express:</strong> ${assinatura.multicaixa_numero}</p>` : ""}
          <p>Para evitar o bloqueio, efetue o pagamento e entre em contato com o suporte.</p>
        `;
      }

      if (tipoLembrete) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "DSICOLA <onboarding@resend.dev>",
              to: [assinatura.instituicao.email_contato],
              subject: assunto,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    h2 { color: #1e40af; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    ${mensagem}
                    <div class="footer">
                      <p>Este é um e-mail automático do sistema DSICOLA.</p>
                      <p>Dúvidas? Entre em contato com o suporte.</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
            }),
          });

          const status = res.ok ? "Enviado" : "Erro";
          const errorData = res.ok ? null : await res.text();

          // Log the email
          await supabase.from("emails_enviados").insert({
            destinatario_email: assinatura.instituicao.email_contato,
            destinatario_nome: assinatura.instituicao.nome,
            assunto: assunto,
            tipo: `lembrete_assinatura_${tipoLembrete}`,
            status,
            erro: errorData,
          });

          // Update last reminder sent
          await supabase
            .from("assinaturas")
            .update({ ultimo_lembrete_enviado: new Date().toISOString() })
            .eq("id", assinatura.id);

          emailsSent.push({
            instituicao: assinatura.instituicao.nome,
            tipo: tipoLembrete,
            email: assinatura.instituicao.email_contato,
          });

          console.log(`Email sent to ${assinatura.instituicao.nome}: ${tipoLembrete}`);
        } catch (emailError) {
          console.error(`Error sending email to ${assinatura.instituicao.nome}:`, emailError);
          
          // Log failed email
          await supabase.from("emails_enviados").insert({
            destinatario_email: assinatura.instituicao.email_contato,
            destinatario_nome: assinatura.instituicao.nome,
            assunto: assunto,
            tipo: `lembrete_assinatura_${tipoLembrete}`,
            status: "Erro",
            erro: String(emailError),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${emailsSent.length} lembretes enviados`,
        details: emailsSent 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-subscription-reminder:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
