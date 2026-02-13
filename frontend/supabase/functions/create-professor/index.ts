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
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão não encontrada. Faça login novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('Validating token...')
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError) {
      console.error('Auth error:', userError.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão expirada. Faça login novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }
    
    if (!user) {
      console.error('No user found for token')
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado. Faça login novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }
    
    console.log('User authenticated:', user.id)

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || roleData?.role !== 'ADMIN') {
      throw new Error('Forbidden: Admin access required')
    }

    // Get caller's instituicao_id
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('instituicao_id')
      .eq('id', user.id)
      .single()

    const instituicaoId = callerProfile?.instituicao_id

    // Check professor limit if institution has a subscription
    if (instituicaoId) {
      const { data: limiteOk, error: limiteError } = await supabaseAdmin
        .rpc('verificar_limite_professores', { _instituicao_id: instituicaoId })

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
            error: `Limite de professores atingido! Seu plano ${uso?.plano_nome || ''} permite até ${uso?.professores_limite} professores. Atualmente você tem ${uso?.professores_atual} professores cadastrados. Atualize seu plano para cadastrar mais professores.`,
            error_type: 'LIMIT_EXCEEDED'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
    }

    const { email, nome_completo, telefone, numero_identificacao, avatar_url, senha } = await req.json()

    if (!email || !nome_completo) {
      throw new Error('Email e nome completo são obrigatórios')
    }

    if (!numero_identificacao) {
      throw new Error('Número de identificação (BI) é obrigatório')
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
        throw new Error(`O BI ${numero_identificacao} já está cadastrado para ${existingBI.nome_completo}`)
      }
      
      console.log('User already exists, updating role to PROFESSOR:', userId)
    } else {
      // If BI exists for any user, reject (new user can't have existing BI)
      if (existingBI) {
        throw new Error(`O BI ${numero_identificacao} já está cadastrado para ${existingBI.nome_completo}`)
      }

      // Use provided password or generate a random one
      const password = senha || (Math.random().toString(36).slice(-8) + 'A1!')
      generatedPassword = senha ? null : password // Only return if generated

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

    // Generate unique public identification number for professors
    let numeroIdentificacaoPublica = null
    if (!existingUser) {
      const { data: numPublico } = await supabaseAdmin
        .rpc('gerar_numero_identificacao_publica', { _tipo: 'PROFESSOR' })
      numeroIdentificacaoPublica = numPublico
      console.log('Generated numero_identificacao_publica:', numeroIdentificacaoPublica)
    }

    // Update profile with additional fields including instituicao_id
    const updateData: Record<string, unknown> = {
      nome_completo,
      telefone: telefone || null,
      numero_identificacao: numero_identificacao,
      avatar_url: avatar_url || null,
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

    // Update role to PROFESSOR
    const { error: roleUpdateError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: 'PROFESSOR' })
      .eq('user_id', userId)

    if (roleUpdateError) {
      console.error('Role update error:', roleUpdateError)
    }

    // Send welcome email if password was generated (new user)
    if (generatedPassword) {
      try {
        const portalUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'https://portal.universidade.com'
        
        const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-professor-welcome`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            nome: nome_completo,
            email: email,
            senha: generatedPassword,
            portalUrl: portalUrl,
          }),
        })

        if (!emailResponse.ok) {
          console.error('Failed to send welcome email:', await emailResponse.text())
        } else {
          console.log('Welcome email sent successfully')
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError)
        // Don't fail the professor creation if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        generated_password: generatedPassword,
        email_sent: !!generatedPassword,
        message: existingUser ? 'Usuário existente promovido a professor' : 'Professor criado com sucesso'
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
