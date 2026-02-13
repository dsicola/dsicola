import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is ADMIN or SUPER_ADMIN
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || !['ADMIN', 'SUPER_ADMIN'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas ADMIN ou SUPER_ADMIN podem gerar backups.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tipo, instituicao_id } = await req.json();

    // Get user's institution if not SUPER_ADMIN
    let targetInstituicaoId = instituicao_id;
    if (userRole.role === 'ADMIN') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('instituicao_id')
        .eq('id', user.id)
        .single();
      targetInstituicaoId = profile?.instituicao_id;
    }

    console.log(`Generating ${tipo} backup for institution ${targetInstituicaoId} by user ${user.email}`);

    // Record backup start
    const { data: backupRecord, error: insertError } = await supabaseAdmin
      .from('backup_history')
      .insert({
        user_id: user.id,
        user_email: user.email,
        tipo,
        status: 'em_progresso',
        instituicao_id: targetInstituicaoId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting backup record:', insertError);
      throw insertError;
    }

    const backupData: Record<string, unknown> = {
      metadata: {
        backup_id: backupRecord.id,
        generated_at: new Date().toISOString(),
        generated_by: user.email,
        tipo,
        instituicao_id: targetInstituicaoId,
      }
    };

    // Fetch data based on backup type
    if (tipo === 'dados' || tipo === 'completo') {
      // Get all relevant data
      const instituicaoFilter = targetInstituicaoId 
        ? { column: 'instituicao_id', value: targetInstituicaoId }
        : null;

      // Profiles
      let profilesQuery = supabaseAdmin.from('profiles').select('*');
      if (instituicaoFilter) profilesQuery = profilesQuery.eq('instituicao_id', targetInstituicaoId);
      const { data: profiles } = await profilesQuery;
      backupData.profiles = profiles || [];

      // User roles
      const { data: userRoles } = await supabaseAdmin.from('user_roles').select('*');
      backupData.user_roles = userRoles || [];

      // Instituição
      if (targetInstituicaoId) {
        const { data: instituicao } = await supabaseAdmin
          .from('instituicoes')
          .select('*')
          .eq('id', targetInstituicaoId);
        backupData.instituicao = instituicao || [];
      } else {
        const { data: instituicoes } = await supabaseAdmin.from('instituicoes').select('*');
        backupData.instituicoes = instituicoes || [];
      }

      // Cursos
      let cursosQuery = supabaseAdmin.from('cursos').select('*');
      if (instituicaoFilter) cursosQuery = cursosQuery.eq('instituicao_id', targetInstituicaoId);
      const { data: cursos } = await cursosQuery;
      backupData.cursos = cursos || [];

      // Disciplinas
      let disciplinasQuery = supabaseAdmin.from('disciplinas').select('*');
      if (instituicaoFilter) disciplinasQuery = disciplinasQuery.eq('instituicao_id', targetInstituicaoId);
      const { data: disciplinas } = await disciplinasQuery;
      backupData.disciplinas = disciplinas || [];

      // Turmas
      let turmasQuery = supabaseAdmin.from('turmas').select('*');
      if (instituicaoFilter) turmasQuery = turmasQuery.eq('instituicao_id', targetInstituicaoId);
      const { data: turmas } = await turmasQuery;
      backupData.turmas = turmas || [];

      // Matriculas
      const { data: matriculas } = await supabaseAdmin.from('matriculas').select('*');
      backupData.matriculas = matriculas || [];

      // Notas
      const { data: notas } = await supabaseAdmin.from('notas').select('*');
      backupData.notas = notas || [];

      // Frequencias
      const { data: frequencias } = await supabaseAdmin.from('frequencias').select('*');
      backupData.frequencias = frequencias || [];

      // Mensalidades
      let mensalidadesQuery = supabaseAdmin.from('mensalidades').select('*');
      if (instituicaoFilter) mensalidadesQuery = mensalidadesQuery.eq('instituicao_id', targetInstituicaoId);
      const { data: mensalidades } = await mensalidadesQuery;
      backupData.mensalidades = mensalidades || [];

      // Comunicados
      let comunicadosQuery = supabaseAdmin.from('comunicados').select('*');
      if (instituicaoFilter) comunicadosQuery = comunicadosQuery.eq('instituicao_id', targetInstituicaoId);
      const { data: comunicados } = await comunicadosQuery;
      backupData.comunicados = comunicados || [];

      // Candidaturas
      let candidaturasQuery = supabaseAdmin.from('candidaturas').select('*');
      if (instituicaoFilter) candidaturasQuery = candidaturasQuery.eq('instituicao_id', targetInstituicaoId);
      const { data: candidaturas } = await candidaturasQuery;
      backupData.candidaturas = candidaturas || [];

      // Configurações
      const { data: configuracoes } = await supabaseAdmin.from('configuracoes_instituicao').select('*');
      backupData.configuracoes_instituicao = configuracoes || [];

      // Bolsas e Descontos
      const { data: bolsas } = await supabaseAdmin.from('bolsas_descontos').select('*');
      backupData.bolsas_descontos = bolsas || [];

      // Alojamentos
      const { data: alojamentos } = await supabaseAdmin.from('alojamentos').select('*');
      backupData.alojamentos = alojamentos || [];

      // Alocações
      const { data: alocacoes } = await supabaseAdmin.from('alocacoes_alojamento').select('*');
      backupData.alocacoes_alojamento = alocacoes || [];

      // Exames
      const { data: exames } = await supabaseAdmin.from('exames').select('*');
      backupData.exames = exames || [];

      // Horarios
      const { data: horarios } = await supabaseAdmin.from('horarios').select('*');
      backupData.horarios = horarios || [];

      // Documentos emitidos
      const { data: documentos } = await supabaseAdmin.from('documentos_emitidos').select('*');
      backupData.documentos_emitidos = documentos || [];

      // Logs de auditoria
      const { data: logs } = await supabaseAdmin.from('logs_auditoria').select('*').limit(1000);
      backupData.logs_auditoria = logs || [];

      // Planos e Assinaturas (apenas SUPER_ADMIN)
      if (userRole.role === 'SUPER_ADMIN') {
        const { data: planos } = await supabaseAdmin.from('planos').select('*');
        backupData.planos = planos || [];
        
        const { data: assinaturas } = await supabaseAdmin.from('assinaturas').select('*');
        backupData.assinaturas = assinaturas || [];
      }
    }

    if (tipo === 'arquivos' || tipo === 'completo') {
      // List storage files
      const { data: avatarFiles } = await supabaseAdmin.storage.from('avatars').list();
      const { data: instituicaoFiles } = await supabaseAdmin.storage.from('instituicao').list();
      const { data: documentosFiles } = await supabaseAdmin.storage.from('documentos_alunos').list();

      backupData.storage_files = {
        avatars: avatarFiles || [],
        instituicao: instituicaoFiles || [],
        documentos_alunos: documentosFiles || [],
      };
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(backupData, null, 2);
    const backupSize = new TextEncoder().encode(jsonString).length;

    // Update backup record as completed
    await supabaseAdmin
      .from('backup_history')
      .update({
        status: 'concluido',
        tamanho_bytes: backupSize,
      })
      .eq('id', backupRecord.id);

    console.log(`Backup completed: ${backupSize} bytes`);

    // Return JSON data for download
    return new Response(jsonString, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup_dsicola_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error: unknown) {
    console.error('Error generating backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
