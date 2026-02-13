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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting scheduled backup check...');

    // Get all active schedules that are due
    const now = new Date();
    const { data: schedules, error: schedulesError } = await supabaseAdmin
      .from('backup_schedules')
      .select('*')
      .eq('ativo', true)
      .lte('proximo_backup', now.toISOString());

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} schedules to process`);

    const results = [];

    for (const schedule of schedules || []) {
      try {
        console.log(`Processing schedule ${schedule.id} for institution ${schedule.instituicao_id}`);

        const instituicaoFilter = schedule.instituicao_id;

        // Buscar dados da instituição (incluindo tipo) para incluir nos metadados
        let instituicaoData: { nome?: string; tipo_instituicao?: string; tipo_academico?: string | null } | null = null;
        if (instituicaoFilter) {
          const { data: instituicao } = await supabaseAdmin
            .from('instituicoes')
            .select('nome, tipo_instituicao, tipo_academico')
            .eq('id', instituicaoFilter)
            .single();
          instituicaoData = instituicao;
        }

        // Generate backup data
        const backupData: Record<string, unknown> = {
          metadata: {
            backup_id: crypto.randomUUID(),
            generated_at: new Date().toISOString(),
            generated_by: 'Sistema (Agendado)',
            tipo: schedule.tipo_backup,
            instituicao_id: schedule.instituicao_id,
            instituicao_nome: instituicaoData?.nome || null,
            tipo_instituicao: instituicaoData?.tipo_instituicao || null,
            tipo_academico: instituicaoData?.tipo_academico || null,
            schedule_id: schedule.id,
            version: '1.0',
          }
        };

        // Fetch data based on backup type
        if (schedule.tipo_backup === 'dados' || schedule.tipo_backup === 'completo') {
          // Profiles
          let profilesQuery = supabaseAdmin.from('profiles').select('*');
          if (instituicaoFilter) profilesQuery = profilesQuery.eq('instituicao_id', instituicaoFilter);
          const { data: profiles } = await profilesQuery;
          backupData.profiles = profiles || [];

          // Cursos
          let cursosQuery = supabaseAdmin.from('cursos').select('*');
          if (instituicaoFilter) cursosQuery = cursosQuery.eq('instituicao_id', instituicaoFilter);
          const { data: cursos } = await cursosQuery;
          backupData.cursos = cursos || [];

          // Disciplinas
          let disciplinasQuery = supabaseAdmin.from('disciplinas').select('*');
          if (instituicaoFilter) disciplinasQuery = disciplinasQuery.eq('instituicao_id', instituicaoFilter);
          const { data: disciplinas } = await disciplinasQuery;
          backupData.disciplinas = disciplinas || [];

          // Turmas
          let turmasQuery = supabaseAdmin.from('turmas').select('*');
          if (instituicaoFilter) turmasQuery = turmasQuery.eq('instituicao_id', instituicaoFilter);
          const { data: turmas } = await turmasQuery;
          backupData.turmas = turmas || [];

          // Matriculas (filtrar através de turma - turma tem instituicaoId)
          // Primeiro buscar turmas da instituição, depois matriculas dessas turmas
          let turmasIds: string[] = [];
          if (instituicaoFilter) {
            const { data: turmasInst } = await supabaseAdmin
              .from('turmas')
              .select('id')
              .eq('instituicao_id', instituicaoFilter);
            turmasIds = turmasInst?.map(t => t.id) || [];
          }
          
          if (instituicaoFilter && turmasIds.length > 0) {
            // Filtrar matriculas das turmas da instituição
            const { data: matriculas } = await supabaseAdmin
              .from('matriculas')
              .select('*')
              .in('turma_id', turmasIds);
            backupData.matriculas = matriculas || [];
          } else if (instituicaoFilter && turmasIds.length === 0) {
            // Se não há turmas da instituição, não há matriculas
            backupData.matriculas = [];
          } else {
            // Sem filtro de instituição (não deveria acontecer em produção)
            const { data: matriculas } = await supabaseAdmin.from('matriculas').select('*');
            backupData.matriculas = matriculas || [];
          }

          // Notas (filtrar por instituicaoId)
          let notasQuery = supabaseAdmin.from('notas').select('*');
          if (instituicaoFilter) {
            notasQuery = notasQuery.eq('instituicao_id', instituicaoFilter);
          }
          const { data: notas } = await notasQuery;
          backupData.notas = notas || [];

          // Mensalidades
          let mensalidadesQuery = supabaseAdmin.from('mensalidades').select('*');
          if (instituicaoFilter) mensalidadesQuery = mensalidadesQuery.eq('instituicao_id', instituicaoFilter);
          const { data: mensalidades } = await mensalidadesQuery;
          backupData.mensalidades = mensalidades || [];

          // Comunicados
          let comunicadosQuery = supabaseAdmin.from('comunicados').select('*');
          if (instituicaoFilter) comunicadosQuery = comunicadosQuery.eq('instituicao_id', instituicaoFilter);
          const { data: comunicados } = await comunicadosQuery;
          backupData.comunicados = comunicados || [];
        }

        if (schedule.tipo_backup === 'arquivos' || schedule.tipo_backup === 'completo') {
          // NOTA: Storage buckets não têm filtro direto por instituicaoId
          // Arquivos são organizados por pastas/buckets
          // Em produção, considerar estrutura de pastas por instituição
          const { data: avatarFiles } = await supabaseAdmin.storage.from('avatars').list();
          const { data: instituicaoFiles } = await supabaseAdmin.storage.from('instituicao').list();
          const { data: documentosFiles } = await supabaseAdmin.storage.from('documentos_alunos').list();
          
          backupData.storage_files = {
            avatars: avatarFiles || [],
            instituicao: instituicaoFiles || [],
            documentos_alunos: documentosFiles || [],
            // NOTA: Em produção, filtrar arquivos por instituição se houver estrutura de pastas
            instituicao_id: instituicaoFilter || null,
          };
        }

        const jsonString = JSON.stringify(backupData, null, 2);
        const backupSize = new TextEncoder().encode(jsonString).length;

        // Store backup in storage bucket (optional - for large backups)
        const backupFileName = `backup_${schedule.instituicao_id || 'global'}_${new Date().toISOString().split('T')[0]}.json`;
        
        // Record backup in history
        await supabaseAdmin.from('backup_history').insert({
          user_id: schedule.created_by,
          user_email: 'Sistema (Agendado)',
          tipo: schedule.tipo_backup,
          status: 'concluido',
          tamanho_bytes: backupSize,
          instituicao_id: schedule.instituicao_id,
        });

        // Calculate next backup date
        const nextBackup = calculateNextBackup(schedule);

        // Update schedule
        await supabaseAdmin
          .from('backup_schedules')
          .update({
            ultimo_backup: now.toISOString(),
            proximo_backup: nextBackup.toISOString(),
          })
          .eq('id', schedule.id);

        results.push({
          schedule_id: schedule.id,
          instituicao_id: schedule.instituicao_id,
          status: 'success',
          backup_size: backupSize,
          next_backup: nextBackup.toISOString(),
        });

        console.log(`Backup completed for schedule ${schedule.id}`);
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
        results.push({
          schedule_id: schedule.id,
          status: 'error',
          error: (error as Error).message,
        });
      }
    }

    console.log('Scheduled backup check completed:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in scheduled backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateNextBackup(schedule: {
  frequencia: string;
  hora_execucao: string;
  dia_semana?: number;
  dia_mes?: number;
}): Date {
  const now = new Date();
  const [hours, minutes] = schedule.hora_execucao.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  switch (schedule.frequencia) {
    case 'diario':
      // Next day at the specified time
      next.setDate(next.getDate() + 1);
      break;

    case 'semanal':
      // Next occurrence of the specified day of week
      const targetDay = schedule.dia_semana ?? 0;
      const currentDay = now.getDay();
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget <= 0) daysUntilTarget += 7;
      next.setDate(next.getDate() + daysUntilTarget);
      break;

    case 'mensal':
      // Next month on the specified day
      const targetDate = schedule.dia_mes ?? 1;
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(targetDate, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;

    default:
      next.setDate(next.getDate() + 7);
  }

  return next;
}
