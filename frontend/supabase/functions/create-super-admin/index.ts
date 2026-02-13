import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, password, nome_completo } = await req.json();

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      // Update existing user role to SUPER_ADMIN
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: 'SUPER_ADMIN' })
        .eq('user_id', existingUser.id);

      if (roleError) {
        throw new Error(`Error updating role: ${roleError.message}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User role updated to SUPER_ADMIN',
          user_id: existingUser.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome_completo,
      },
    });

    if (authError) {
      throw new Error(`Error creating user: ${authError.message}`);
    }

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ nome_completo })
      .eq('id', authUser.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    // Set role to SUPER_ADMIN
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('user_id', authUser.user.id);

    if (roleError) {
      // Try upsert if update fails
      const { error: upsertError } = await supabaseAdmin
        .from('user_roles')
        .upsert({ 
          user_id: authUser.user.id, 
          role: 'SUPER_ADMIN' 
        }, { 
          onConflict: 'user_id' 
        });

      if (upsertError) {
        throw new Error(`Error setting role: ${upsertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SUPER_ADMIN user created successfully',
        user_id: authUser.user.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
