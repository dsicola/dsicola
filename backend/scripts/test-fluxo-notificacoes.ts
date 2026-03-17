#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo completo de notificações (email, telegram, sms)
 *
 * Valida:
 * 1. Migração notificacao_config aplicada
 * 2. notificacaoConfig.service: getNotificacaoConfig, getTriggerConfig, updateNotificacaoConfig
 * 3. Formato das mensagens para cada tipo (SMS/Telegram)
 * 4. Broadcast mensalidade pendente (estrutura)
 * 5. Triggers configuráveis: conta_criada, funcionario_criado, matricula_realizada,
 *    pagamento_confirmado, mensalidade_estornada, mensalidade_pendente
 *
 * Uso: npx tsx scripts/test-fluxo-notificacoes.ts
 *   ou: npm run test:fluxo-notificacoes
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TRIGGERS_ESPERADOS = [
  'conta_criada',
  'funcionario_criado',
  'matricula_realizada',
  'pagamento_confirmado',
  'mensalidade_estornada',
  'mensalidade_pendente',
] as const;

const CANAIS_VALIDOS = ['email', 'telegram', 'sms'] as const;

interface Resultado {
  passo: string;
  ok: boolean;
  detalhe?: string;
}

const resultados: Resultado[] = [];

function log(passo: string, ok: boolean, detalhe?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${passo}${detalhe ? ` — ${detalhe}` : ''}`);
  resultados.push({ passo, ok, detalhe });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE: Fluxo completo de notificações');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // 1. Migração aplicada
  console.log('1. MIGRAÇÃO notificacao_config');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const colunas = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'configuracoes_instituicao' AND column_name = 'notificacao_config'
    `;
    const temColuna = colunas.length > 0;
    log('Coluna notificacao_config existe', temColuna, temColuna ? 'OK' : 'Migração não aplicada');
    await prisma.$disconnect();
  } catch (e: any) {
    log('Verificar migração', false, e?.message || 'Erro');
  }

  // 2. notificacaoConfig.service
  console.log('\n2. SERVIÇO notificacaoConfig');
  try {
    const { getNotificacaoConfig, getTriggerConfig, updateNotificacaoConfig } = await import(
      '../src/services/notificacaoConfig.service.js'
    );

    // get com null retorna defaults
    const configNull = await getNotificacaoConfig(null);
    const triggersNull = configNull.triggers;
    const todosTriggers = Object.keys(triggersNull);
    const temTodos = TRIGGERS_ESPERADOS.every((t) => todosTriggers.includes(t));
    log('getNotificacaoConfig(null) retorna todos os triggers', temTodos, todosTriggers.join(', '));

    // getTriggerConfig para cada trigger
    for (const trigger of TRIGGERS_ESPERADOS) {
      const cfg = await getTriggerConfig(null, trigger);
      const canaisOk = cfg.canais.every((c) => CANAIS_VALIDOS.includes(c));
      log(`getTriggerConfig(${trigger})`, cfg && typeof cfg.enabled === 'boolean' && canaisOk);
    }

    // update (precisa instituicaoId real - vamos usar a primeira instituição)
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const inst = await prisma.instituicao.findFirst({ select: { id: true } });
    if (inst) {
      const updated = await updateNotificacaoConfig(inst.id, {
        triggers: {
          mensalidade_pendente: { enabled: true, canais: ['email', 'telegram'] },
        },
      });
      const mp = updated.triggers.mensalidade_pendente;
      const updateOk = mp?.enabled === true && mp?.canais?.includes('telegram');
      log('updateNotificacaoConfig (mensalidade_pendente)', updateOk);

      // Restaurar default
      await updateNotificacaoConfig(inst.id, {
        triggers: { mensalidade_pendente: { enabled: false, canais: ['email'] } },
      });
    } else {
      log('updateNotificacaoConfig (sem instituição)', true, 'Pulado - nenhuma instituição');
    }
    await prisma.$disconnect();
  } catch (e: any) {
    log('Serviço notificacaoConfig', false, e?.message || 'Erro');
  }

  // 3. Formato das mensagens (SMS/Telegram)
  console.log('\n3. FORMATO DAS MENSAGENS (buildMensagemCurtaParaTest)');
  try {
    const { buildMensagemCurtaParaTest } = await import(
      '../src/services/notificacaoCanal.service.js'
    );

    const tipos: Array<{ tipo: any; dados: any; mustContain: string[] }> = [
      {
        tipo: 'CRIACAO_CONTA_ACESSO',
        dados: { nomeUsuario: 'João', email: 'joao@test.ao', senhaTemporaria: 'Temp123', linkLogin: 'https://app.dsicola.com/auth' },
        mustContain: ['Olá João', 'conta de acesso', 'criada', 'Por segurança'],
      },
      {
        tipo: 'CRIACAO_CONTA_FUNCIONARIO',
        dados: { nomeUsuario: 'Maria', nomeFuncionario: 'Maria Silva', cargo: 'Professora', email: 'maria@test.ao' },
        mustContain: ['Olá Maria', 'conta de acesso', 'criada'],
      },
      {
        tipo: 'MATRICULA_ALUNO',
        dados: { nomeAluno: 'Ana', curso: 'Eng. Informática', turma: '1º A', anoLetivo: '2025', numeroMatricula: '2025-001' },
        mustContain: ['Olá Ana', 'matrícula', 'confirmada', 'Eng. Informática', '1º A', '2025-001'],
      },
      {
        tipo: 'PAGAMENTO_CONFIRMADO',
        dados: { nomeAluno: 'Carlos', valor: '150000', referencia: 'RCB-2025-0001' },
        mustContain: ['Olá Carlos', 'pagamento', 'confirmado', 'RCB-2025-0001'],
      },
      {
        tipo: 'PAGAMENTO_ESTORNADO',
        dados: { nomeAluno: 'Pedro', referencia: '03/2025' },
        mustContain: ['Olá Pedro', 'estornado', 'contacte a secretaria'],
      },
    ];

    for (const { tipo, dados, mustContain } of tipos) {
      const msg = buildMensagemCurtaParaTest(tipo, dados);
      const allOk = mustContain.every((s) => msg.includes(s));
      log(`Mensagem ${tipo}`, allOk, allOk ? msg.slice(0, 60) + '...' : `Faltou: ${mustContain.filter((s) => !msg.includes(s)).join(', ')}`);
    }
  } catch (e: any) {
    log('Formato mensagens', false, e?.message || 'Erro');
  }

  // 4. Broadcast mensalidade pendente (com userIds vazios - deve retornar 0 enviados)
  console.log('\n4. BROADCAST mensalidade pendente');
  try {
    const { enviarBroadcastMensalidadePendente } = await import('../src/services/notificacaoCanal.service.js');
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const inst = await prisma.instituicao.findFirst({ select: { id: true } });
    await prisma.$disconnect();

    if (inst) {
      const req = {} as any;
      const res = await enviarBroadcastMensalidadePendente(req, {
        instituicaoId: inst.id,
        userIds: [],
        mensagem: 'Teste: mensalidade pendente.',
        assuntoEmail: 'Teste',
      });
      const ok = res.enviados === 0 && res.erros === 0;
      log('enviarBroadcastMensalidadePendente([], ...)', ok, `enviados=${res.enviados}, erros=${res.erros}`);
    } else {
      log('Broadcast (sem instituição)', true, 'Pulado');
    }
  } catch (e: any) {
    log('Broadcast', false, e?.message || 'Erro');
  }

  // 5. Resumo
  const total = resultados.length;
  const passou = resultados.filter((r) => r.ok).length;
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${passou}/${total} passou`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  process.exit(passou === total ? 0 : 1);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
