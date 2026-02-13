import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateFuncionarioRequest {
  email: string;
  password: string;
  nome_completo: string;
  telefone?: string;
  numero_identificacao: string;
  role: "ADMIN" | "PROFESSOR" | "SECRETARIA" | "POS" | "RESPONSAVEL";
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão não encontrada. Faça login novamente.' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user is admin or secretaria - both can create funcionarios
    const { data: callerRoleData, error: callerRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (callerRoleError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar permissões.' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userRoles = callerRoleData?.map(r => r.role) || [];
    const canCreateFuncionario = userRoles.includes('ADMIN') || userRoles.includes('SECRETARIA') || userRoles.includes('SUPER_ADMIN');

    if (!canCreateFuncionario) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado: Apenas administradores ou secretaria podem cadastrar funcionários.' }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get caller's instituicao_id
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('instituicao_id')
      .eq('id', user.id)
      .single();

    const instituicaoId = callerProfile?.instituicao_id;

    const { email, password, nome_completo, telefone, numero_identificacao, role }: CreateFuncionarioRequest = await req.json();

    console.log(`Creating funcionario: ${email} with role: ${role}`);

    // Validate required fields
    if (!email || !nome_completo) {
      return new Response(
        JSON.stringify({ success: false, error: "Email e nome completo são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!numero_identificacao) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Número de identificação (BI) é obrigatório",
          error_type: "VALIDATION_ERROR"
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate role
    const validRoles = ["ADMIN", "PROFESSOR", "SECRETARIA", "POS", "RESPONSAVEL"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, error: `Role inválido: ${role}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if BI already exists for another user IN THE SAME INSTITUTION
    // Allow when it's the SAME user (same email) — this happens when linking an existing account as funcionário.
    let biQuery = supabaseAdmin
      .from('profiles')
      .select('id, nome_completo, email')
      .eq('numero_identificacao', numero_identificacao);
    
    // Only check within the same institution (multi-tenant)
    if (instituicaoId) {
      biQuery = biQuery.eq('instituicao_id', instituicaoId);
    }
    
    const { data: existingBI, error: biError } = await biQuery.maybeSingle();

    if (biError) {
      console.error('Error checking BI:', biError);
    }

    if (existingBI && existingBI.email?.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `O BI ${numero_identificacao} já está cadastrado para ${existingBI.nome_completo}`,
          error_type: "DUPLICATE_BI"
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let userId: string;
    let isExistingUser = false;

    // First, check if user already exists by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // User already exists in auth - use their ID
      userId = existingUser.id;
      isExistingUser = true;
      console.log(`User already exists with ID: ${userId}, will link to institution`);
      
      // Check if this user is already a funcionario in this institution
      const { data: existingFunc } = await supabaseAdmin
        .from('funcionarios')
        .select('id')
        .eq('user_id', userId)
        .eq('instituicao_id', instituicaoId)
        .maybeSingle();
      
      if (existingFunc) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Este usuário já está cadastrado como funcionário nesta instituição`,
            error_type: "DUPLICATE_FUNCIONARIO"
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      // Create new user with admin client (doesn't auto-login)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          nome_completo,
          instituicao_id: instituicaoId,
        },
      });

      if (authError) {
        console.error("Error creating user:", authError);
        throw new Error(`Erro ao criar usuário: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error("Usuário não foi criado");
      }

      userId = authData.user.id;
      console.log(`New user created with ID: ${userId}`);

      // Wait for trigger to create profile and role
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate unique public identification number for funcionarios
    let numeroIdentificacaoPublica = null
    if (!isExistingUser) {
      // Map role to sequence type
      const tipoSeq = role === 'PROFESSOR' ? 'PROFESSOR' 
        : role === 'SECRETARIA' ? 'SECRETARIA' 
        : role === 'ADMIN' ? 'ADMIN' 
        : 'FUNCIONARIO'
      
      const { data: numPublico } = await supabaseAdmin
        .rpc('gerar_numero_identificacao_publica', { _tipo: tipoSeq })
      numeroIdentificacaoPublica = numPublico
      console.log('Generated numero_identificacao_publica:', numeroIdentificacaoPublica)
    }

    // Update or insert profile with additional info including BI and instituicao_id
    const profileData: Record<string, unknown> = {
      id: userId,
      email,
      nome_completo,
      telefone: telefone || null,
      numero_identificacao: numero_identificacao,
      instituicao_id: instituicaoId || null,
    }
    
    // Only set numero_identificacao_publica if generated (new user)
    if (numeroIdentificacaoPublica) {
      profileData.numero_identificacao_publica = numeroIdentificacaoPublica
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profileData, { onConflict: 'id' });

    if (profileError) {
      console.error("Error updating profile:", profileError);
      if (profileError.code === '23505') {
        throw new Error(`O BI ${numero_identificacao} já está cadastrado para outro usuário`);
      }
    }

    // Update role to the selected one (the DB has UNIQUE (user_id, role), so we can't upsert on user_id)
    const { data: existingRoles, error: existingRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", userId);

    if (existingRolesError) {
      console.error("Error fetching existing roles:", existingRolesError);
      throw new Error(`Erro ao obter roles: ${existingRolesError.message}`);
    }

    if (existingRoles && existingRoles.length > 0) {
      // If the desired role already exists, just ensure instituicao_id is aligned
      const desired = existingRoles.find((r) => r.role === role);
      if (desired) {
        const { error: updRoleError } = await supabaseAdmin
          .from("user_roles")
          .update({ instituicao_id: instituicaoId })
          .eq("id", desired.id);

        if (updRoleError) {
          console.error("Error updating role:", updRoleError);
          throw new Error(`Erro ao definir role: ${updRoleError.message}`);
        }
      } else {
        // Replace the first role row with the desired role
        const { error: updRoleError } = await supabaseAdmin
          .from("user_roles")
          .update({ role, instituicao_id: instituicaoId })
          .eq("id", existingRoles[0].id);

        if (updRoleError) {
          console.error("Error updating role:", updRoleError);
          throw new Error(`Erro ao definir role: ${updRoleError.message}`);
        }

        // Clean up any extra roles for this user to keep a single active role
        if (existingRoles.length > 1) {
          const { error: cleanupError } = await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", userId)
            .neq("id", existingRoles[0].id);

          if (cleanupError) {
            console.error("Error cleaning up roles:", cleanupError);
          }
        }
      }
    } else {
      const { error: insRoleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role, instituicao_id: instituicaoId });

      if (insRoleError) {
        console.error("Error inserting role:", insRoleError);
        throw new Error(`Erro ao definir role: ${insRoleError.message}`);
      }
    }

    console.log(`Role updated to: ${role}`);

    // Verify the role was set correctly
    const { data: verifyRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    console.log(`Verified role: ${verifyRole?.role}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: email,
          role: verifyRole?.role || role,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-funcionario:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});