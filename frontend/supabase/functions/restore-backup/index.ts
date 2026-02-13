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
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas ADMIN ou SUPER_ADMIN podem restaurar backups.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { backupData, options } = await req.json();

    if (!backupData || !backupData.metadata) {
      return new Response(JSON.stringify({ error: 'Formato de backup inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Restoring backup from ${backupData.metadata.generated_at} by user ${user.email}`);
    console.log('Restore options:', options);

    const results: Record<string, { success: number; errors: number; messages: string[] }> = {};

    // Helper function to restore table data
    const restoreTable = async (tableName: string, data: unknown[], keyColumn = 'id') => {
      if (!data || !Array.isArray(data) || data.length === 0) {
        results[tableName] = { success: 0, errors: 0, messages: ['Sem dados para restaurar'] };
        return;
      }

      let success = 0;
      let errors = 0;
      const messages: string[] = [];

      for (const row of data) {
        try {
          // Check if record exists
          const { data: existing } = await supabaseAdmin
            .from(tableName)
            .select(keyColumn)
            .eq(keyColumn, (row as Record<string, unknown>)[keyColumn])
            .maybeSingle();

          if (existing && options.skipExisting) {
            messages.push(`Registro ${(row as Record<string, unknown>)[keyColumn]} já existe, ignorado`);
            continue;
          }

          if (existing && options.overwrite) {
            // Update existing record
            const { error } = await supabaseAdmin
              .from(tableName)
              .update(row as Record<string, unknown>)
              .eq(keyColumn, (row as Record<string, unknown>)[keyColumn]);

            if (error) {
              errors++;
              messages.push(`Erro ao atualizar ${(row as Record<string, unknown>)[keyColumn]}: ${error.message}`);
            } else {
              success++;
            }
          } else if (!existing) {
            // Insert new record
            const { error } = await supabaseAdmin
              .from(tableName)
              .insert(row as Record<string, unknown>);

            if (error) {
              errors++;
              messages.push(`Erro ao inserir ${(row as Record<string, unknown>)[keyColumn]}: ${error.message}`);
            } else {
              success++;
            }
          }
        } catch (e) {
          errors++;
          messages.push(`Erro inesperado: ${(e as Error).message}`);
        }
      }

      results[tableName] = { success, errors, messages: messages.slice(0, 10) }; // Limit messages
    };

    // Restore tables in order (respecting foreign key dependencies)
    const tablesToRestore = [
      { name: 'instituicoes', data: backupData.instituicoes || backupData.instituicao },
      { name: 'planos', data: backupData.planos },
      { name: 'cursos', data: backupData.cursos },
      { name: 'disciplinas', data: backupData.disciplinas },
      { name: 'configuracoes_instituicao', data: backupData.configuracoes_instituicao },
      { name: 'bolsas_descontos', data: backupData.bolsas_descontos },
      { name: 'turnos', data: backupData.turnos },
      { name: 'tipos_documento', data: backupData.tipos_documento },
      { name: 'email_templates', data: backupData.email_templates },
      { name: 'alojamentos', data: backupData.alojamentos },
    ];

    // Restore independent tables first
    for (const table of tablesToRestore) {
      if (table.data && options.tables?.includes(table.name) !== false) {
        await restoreTable(table.name, table.data);
      }
    }

    // Restore profiles (depends on instituicoes)
    if (backupData.profiles && options.tables?.includes('profiles') !== false) {
      // Skip profiles restoration for security reasons - users should be created through proper channels
      results['profiles'] = { 
        success: 0, 
        errors: 0, 
        messages: ['Perfis de usuário não são restaurados automaticamente por razões de segurança'] 
      };
    }

    // Restore dependent tables
    const dependentTables = [
      { name: 'turmas', data: backupData.turmas },
      { name: 'candidaturas', data: backupData.candidaturas },
      { name: 'comunicados', data: backupData.comunicados },
      { name: 'assinaturas', data: backupData.assinaturas },
    ];

    for (const table of dependentTables) {
      if (table.data && options.tables?.includes(table.name) !== false) {
        await restoreTable(table.name, table.data);
      }
    }

    // Log the restore action
    await supabaseAdmin.from('logs_auditoria').insert({
      user_id: user.id,
      user_email: user.email,
      acao: 'RESTORE_BACKUP',
      dados_novos: {
        backup_date: backupData.metadata.generated_at,
        backup_type: backupData.metadata.tipo,
        options,
        results_summary: Object.entries(results).map(([table, r]) => ({
          table,
          success: r.success,
          errors: r.errors
        }))
      }
    });

    // Record in backup history
    await supabaseAdmin.from('backup_history').insert({
      user_id: user.id,
      user_email: user.email,
      tipo: 'restauracao',
      status: 'concluido',
      instituicao_id: backupData.metadata.instituicao_id,
    });

    console.log('Restore completed:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Restauração concluída',
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error restoring backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
