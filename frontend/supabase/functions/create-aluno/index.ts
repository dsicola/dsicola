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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin or secretaria
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const allowedRoles = ['ADMIN', 'SECRETARIA']
    if (roleError || !roleData?.role || !allowedRoles.includes(roleData.role)) {
      console.error('Access denied for role:', roleData?.role)
      throw new Error('Forbidden: Admin or Secretaria access required')
    }

    console.log('Access granted for role:', roleData.role)

    // Get caller's instituicao_id
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('instituicao_id')
      .eq('id', user.id)
      .single()

    const instituicaoId = callerProfile?.instituicao_id

    // Check student limit if institution has a subscription
    if (instituicaoId) {
      const { data: limiteOk, error: limiteError } = await supabaseAdmin
        .rpc('verificar_limite_alunos', { _instituicao_id: instituicaoId })

      if (limiteError) {
        console.error('Error checking limit:', limiteError)
      } else if (limiteOk === false) {
        // Get current usage for error message
        const { data: usoData } = await supabaseAdmin
          .rpc('get_uso_instituicao', { _instituicao_id: instituicaoId })
        
        const uso = usoData?.[0]
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Limite de alunos atingido! Seu plano ${uso?.plano_nome || ''} permite até ${uso?.alunos_limite} alunos. Atualmente você tem ${uso?.alunos_atual} alunos cadastrados. Atualize seu plano para cadastrar mais alunos.`,
            error_type: 'LIMIT_EXCEEDED'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
    }

    const { 
      email, 
      nome_completo, 
      telefone, 
      numero_identificacao, 
      data_nascimento, 
      status_aluno, 
      turma_id, 
      nome_pai, 
      nome_mae, 
      morada, 
      profissao,
      senha,
      genero,
      tipo_sanguineo,
      cidade,
      pais,
      codigo_postal
    } = await req.json()

    if (!email || !nome_completo) {
      throw new Error('Email e nome completo são obrigatórios')
    }

    if (!numero_identificacao) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Número de identificação (BI) é obrigatório',
          error_type: 'VALIDATION_ERROR'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Check if BI already exists for another user
    const { data: existingBI, error: biError } = await supabaseAdmin
      .from('profiles')
      .select('id, nome_completo')
      .eq('numero_identificacao', numero_identificacao)
      .maybeSingle()

    if (biError) {
      console.error('Error checking BI:', biError)
    }

    // Check if user already exists by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string
    let generatedPassword: string | null = null

    if (existingUser) {
      userId = existingUser.id
      
      // If BI exists and belongs to a different user, reject
      if (existingBI && existingBI.id !== userId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `O BI ${numero_identificacao} já está cadastrado para ${existingBI.nome_completo}`,
            error_type: 'DUPLICATE_BI'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      console.log('User already exists, keeping role as ALUNO:', userId)
    } else {
      // If BI exists for any user, reject (new user can't have existing BI)
      if (existingBI) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `O BI ${numero_identificacao} já está cadastrado para ${existingBI.nome_completo}`,
            error_type: 'DUPLICATE_BI'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      // Use provided password or generate a random one
      const password = senha || Math.random().toString(36).slice(-12) + 'A1!'
      if (!senha) {
        generatedPassword = password
      }

      // Create user with admin API (doesn't change session)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome_completo
        }
      })

      if (createError) {
        throw createError
      }

      if (!newUser.user) {
        throw new Error('Falha ao criar usuário')
      }

      userId = newUser.user.id
    }

    // Generate unique public identification number for students
    let numeroIdentificacaoPublica = null
    if (!existingUser) {
      const { data: numPublico } = await supabaseAdmin
        .rpc('gerar_numero_identificacao_publica', { _tipo: 'ALUNO' })
      numeroIdentificacaoPublica = numPublico
      console.log('Generated numero_identificacao_publica:', numeroIdentificacaoPublica)
    }

    // Update profile with additional fields including instituicao_id
    const updateData: Record<string, unknown> = {
      nome_completo,
      telefone: telefone || null,
      numero_identificacao: numero_identificacao,
      data_nascimento: data_nascimento || null,
      status_aluno: status_aluno || 'Ativo',
      nome_pai: nome_pai || null,
      nome_mae: nome_mae || null,
      morada: morada || null,
      profissao: profissao || null,
      genero: genero || null,
      tipo_sanguineo: tipo_sanguineo || null,
      cidade: cidade || null,
      pais: pais || null,
      codigo_postal: codigo_postal || null,
      instituicao_id: instituicaoId || null,
    }
    
    // Only set numero_identificacao_publica if generated (new user)
    if (numeroIdentificacaoPublica) {
      updateData.numero_identificacao_publica = numeroIdentificacaoPublica
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (profileError) {
      console.error('Profile update error:', profileError)
      if (profileError.code === '23505') {
        throw new Error(`O BI ${numero_identificacao} já está cadastrado para outro usuário`)
      }
      throw profileError
    }

    // If turma_id provided, create enrollment
    if (turma_id) {
      const { error: matriculaError } = await supabaseAdmin
        .from('matriculas')
        .upsert({
          aluno_id: userId,
          turma_id: turma_id,
          status: 'ativa'
        }, { onConflict: 'aluno_id,turma_id' })

      if (matriculaError) {
        console.error('Matricula error:', matriculaError)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        generated_password: generatedPassword,
        message: existingUser ? 'Aluno existente atualizado' : 'Aluno criado com sucesso'
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
