import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is a SUPER_ADMIN
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      throw new Error("Invalid authentication token");
    }

    // Check if requesting user is SUPER_ADMIN
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "SUPER_ADMIN")
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error("Only SUPER_ADMIN can onboard institutions");
    }

    // Get request body
    const { 
      // Institution data
      nome_instituicao,
      subdominio,
      tipo_instituicao = 'UNIVERSIDADE',
      logo_url,
      email_contato,
      telefone,
      endereco,
      // Admin data
      admin_nome,
      admin_email,
      admin_password,
      // Options
      send_welcome_email = true,
      iniciar_teste = true,
      dias_teste = 14,
    } = await req.json();

    // Validate required fields
    if (!nome_instituicao || !subdominio || !admin_nome || !admin_email || !admin_password) {
      throw new Error("Campos obrigatórios: nome_instituicao, subdominio, admin_nome, admin_email, admin_password");
    }

    console.log(`Starting onboarding for institution: ${nome_instituicao}`);

    // Step 1: Create the institution
    const { data: instituicao, error: instError } = await supabaseAdmin
      .from("instituicoes")
      .insert({
        nome: nome_instituicao,
        subdominio: subdominio.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        tipo_instituicao: tipo_instituicao,
        logo_url: logo_url || null,
        email_contato: email_contato || null,
        telefone: telefone || null,
        endereco: endereco || null,
        status: 'ativa',
      })
      .select()
      .single();

    if (instError) {
      console.error("Error creating institution:", instError);
      if (instError.code === '23505') {
        throw new Error("Este subdomínio já está em uso por outra instituição");
      }
      throw new Error("Erro ao criar instituição: " + instError.message);
    }

    console.log(`Institution created with ID: ${instituicao.id}`);

    // Create the admin user with role metadata
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: {
        nome_completo: admin_nome,
        instituicao_id: instituicao.id,
        role: 'ADMIN', // Importante: indica que é ADMIN para evitar criação de role ALUNO
      },
    });

    if (createError) {
      console.error("Error creating admin user:", createError);
      // Rollback: delete the institution
      await supabaseAdmin.from("instituicoes").delete().eq("id", instituicao.id);
      throw new Error("Erro ao criar usuário admin: " + createError.message);
    }

    const adminUserId = authData.user.id;
    console.log(`Admin user created with ID: ${adminUserId}`);

    // Step 3: Ensure profile exists + attach instituicao_id
    const { error: profileUpsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: adminUserId,
          email: admin_email,
          nome_completo: admin_nome,
          instituicao_id: instituicao.id,
        },
        { onConflict: "id" },
      );

    if (profileUpsertError) {
      console.error("Error upserting profile:", profileUpsertError);
    }

    // Step 4: Limpar qualquer role ALUNO que possa ter sido criada e garantir role ADMIN
    // Primeiro, deletar qualquer role existente para este usuário
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", adminUserId);

    // Depois, inserir apenas a role ADMIN
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: adminUserId,
        role: "ADMIN",
        instituicao_id: instituicao.id,
      });

    if (roleInsertError) {
      console.error("Error inserting ADMIN role:", roleInsertError);
    }

    console.log(`Admin role set for user ${adminUserId}`);

    // Step 5: Create subscription with trial period if enabled
    if (iniciar_teste) {
      const dataFimTeste = new Date();
      dataFimTeste.setDate(dataFimTeste.getDate() + (dias_teste || 14));
      
      // Get a default plan (first available)
      const { data: planoDefault } = await supabaseAdmin
        .from("planos")
        .select("id, preco_secundario, preco_universitario")
        .eq("ativo", true)
        .order("preco_mensal", { ascending: true })
        .limit(1)
        .single();

      if (planoDefault) {
        const valorAtual = tipo_instituicao === 'ENSINO_MEDIO' 
          ? (planoDefault.preco_secundario || 0) 
          : (planoDefault.preco_universitario || 0);

        const { error: assinaturaError } = await supabaseAdmin
          .from("assinaturas")
          .insert({
            instituicao_id: instituicao.id,
            plano_id: planoDefault.id,
            status: 'teste',
            em_teste: true,
            dias_teste: dias_teste || 14,
            data_fim_teste: dataFimTeste.toISOString().split('T')[0],
            data_inicio: new Date().toISOString().split('T')[0],
            valor_atual: valorAtual,
          });

        if (assinaturaError) {
          console.error("Error creating trial subscription:", assinaturaError);
        } else {
          console.log(`Trial subscription created for ${dias_teste} days`);
        }
      }
    }

    // Step 6: Send welcome email

    // Step 5: Send welcome email
    let emailSent = false;
    let emailError = null;
    
    if (send_welcome_email && resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const accessUrl = `https://${subdominio}.dsicola.com`;
        
        const emailResponse = await resend.emails.send({
          from: "DSICOLA <onboarding@resend.dev>",
          to: [admin_email],
          subject: `🎉 Bem-vindo ao DSICOLA - ${nome_instituicao}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">🎓 DSICOLA</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Sistema de Gestão Académica</p>
                </div>
                
                <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
                    Bem-vindo(a), ${admin_nome}! 🎉
                  </h2>
                  
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Sua instituição <strong>${nome_instituicao}</strong> foi cadastrada com sucesso na plataforma DSICOLA.
                  </p>
                  
                  <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0;">
                    <h3 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">📋 Dados de Acesso</h3>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="color: #6b7280; padding: 8px 0; font-size: 14px;">URL de Acesso:</td>
                        <td style="color: #1f2937; padding: 8px 0; font-size: 14px; font-weight: 600;">
                          <a href="${accessUrl}" style="color: #6366f1; text-decoration: none;">${accessUrl}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; padding: 8px 0; font-size: 14px;">E-mail:</td>
                        <td style="color: #1f2937; padding: 8px 0; font-size: 14px; font-weight: 600;">${admin_email}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; padding: 8px 0; font-size: 14px;">Senha:</td>
                        <td style="color: #1f2937; padding: 8px 0; font-size: 14px; font-weight: 600;">${admin_password}</td>
                      </tr>
                    </table>
                  </div>
                  
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${accessUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Acessar o Sistema
                    </a>
                  </div>
                  
                  <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <p style="color: #92400e; font-size: 14px; margin: 0;">
                      ⚠️ <strong>Importante:</strong> Recomendamos que altere sua senha após o primeiro acesso.
                    </p>
                  </div>
                  
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                  
                  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                    Este email foi enviado automaticamente pelo sistema DSICOLA.<br>
                    Em caso de dúvidas, entre em contato com o suporte.
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
        });

        console.log("Welcome email sent successfully:", emailResponse);
        emailSent = true;
      } catch (err: any) {
        console.error("Error sending welcome email:", err);
        emailError = err.message;
      }
    }

    // Log the onboarding action
    await supabaseAdmin.from("logs_auditoria").insert({
      user_id: requestingUser.id,
      acao: "ONBOARD_INSTITUICAO",
      tabela: "instituicoes",
      registro_id: instituicao.id,
      dados_novos: {
        instituicao: nome_instituicao,
        admin_email: admin_email,
        subdominio: subdominio,
      },
    });

    console.log(`Onboarding completed for ${nome_instituicao}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Instituição "${nome_instituicao}" criada com sucesso!`,
        instituicao: {
          id: instituicao.id,
          nome: nome_instituicao,
          subdominio: subdominio,
          access_url: `https://${subdominio}.dsicola.com`,
        },
        admin: {
          id: adminUserId,
          nome: admin_nome,
          email: admin_email,
        },
        email_sent: emailSent,
        email_error: emailError,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Onboarding error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
