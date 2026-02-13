import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      throw new Error("Only SUPER_ADMIN can create institution admins");
    }

    // Get request body
    const { instituicao_id, email, password, nome_completo } = await req.json();

    if (!instituicao_id || !email || !password || !nome_completo) {
      throw new Error("Missing required fields: instituicao_id, email, password, nome_completo");
    }

    console.log(`Creating admin for institution ${instituicao_id}: ${email}`);

    // Verify institution exists
    const { data: instituicao, error: instError } = await supabaseAdmin
      .from("instituicoes")
      .select("id, nome")
      .eq("id", instituicao_id)
      .single();

    if (instError || !instituicao) {
      throw new Error("Institution not found");
    }

    // Create the user in auth with role metadata to prevent ALUNO creation
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome_completo,
        instituicao_id,
        role: 'ADMIN', // Importante: indica que é ADMIN para evitar criação de role ALUNO
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw new Error(createError.message);
    }

    const newUserId = authData.user.id;
    console.log(`User created with ID: ${newUserId}`);

    // Ensure profile exists + attach instituicao_id
    const { error: profileUpsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          email,
          nome_completo,
          instituicao_id,
        },
        { onConflict: "id" },
      );

    if (profileUpsertError) {
      console.error("Error upserting profile:", profileUpsertError);
    }

    // Limpar qualquer role ALUNO que possa ter sido criada e garantir role ADMIN
    // Primeiro, deletar qualquer role existente para este usuário
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", newUserId);

    // Depois, inserir apenas a role ADMIN
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUserId,
        role: "ADMIN",
        instituicao_id,
      });

    if (roleInsertError) {
      console.error("Error inserting ADMIN role:", roleInsertError);
    }

    console.log(`Admin created successfully for ${instituicao.nome}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Admin ${nome_completo} criado com sucesso para ${instituicao.nome}`,
        user_id: newUserId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
