import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    console.log('User found:', !!user, 'Error:', userError?.message)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token or user not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Check if user is admin - user may have multiple roles
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    console.log('Role data:', roleData, 'Role error:', roleError?.message)

    // Check if user has ADMIN or SUPER_ADMIN role
    const hasAdminAccess = roleData?.some(r => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN')

    if (roleError || !hasAdminAccess) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const { aluno_id } = await req.json()

    if (!aluno_id) {
      throw new Error('ID do aluno é obrigatório')
    }

    // Delete related records first
    // Delete from aluno_disciplinas
    await supabaseAdmin
      .from('aluno_disciplinas')
      .delete()
      .eq('aluno_id', aluno_id)

    // Delete from frequencias
    await supabaseAdmin
      .from('frequencias')
      .delete()
      .eq('aluno_id', aluno_id)

    // Get matriculas to delete notas
    const { data: matriculas } = await supabaseAdmin
      .from('matriculas')
      .select('id')
      .eq('aluno_id', aluno_id)

    if (matriculas && matriculas.length > 0) {
      const matriculaIds = matriculas.map(m => m.id)
      
      // Delete notas
      await supabaseAdmin
        .from('notas')
        .delete()
        .in('matricula_id', matriculaIds)
    }

    // Delete from matriculas
    await supabaseAdmin
      .from('matriculas')
      .delete()
      .eq('aluno_id', aluno_id)

    // Delete from user_roles
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', aluno_id)

    // Delete from profiles
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', aluno_id)

    // Delete from auth.users
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(aluno_id)

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError)
      // Continue even if auth user deletion fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Aluno excluído com sucesso'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
