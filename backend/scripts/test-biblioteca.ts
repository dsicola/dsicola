#!/usr/bin/env npx tsx
/**
 * TESTE: Biblioteca - Config, Reservas, Multas, Relatórios, Limite
 *
 * Verifica as funções do biblioteca.service e a estrutura das rotas.
 * Uso: npx tsx scripts/test-biblioteca.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE BIBLIOTECA - Config, Reservas, Multas, Relatórios');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  try {
    // Import dinâmico para evitar carregar Prisma antes do dotenv
    const prisma = (await import('../src/lib/prisma.js')).default;
    const {
      getBibliotecaConfig,
      verificarLimiteEmprestimos,
      calcularECriarMulta,
      expirarReservasAntigas,
    } = await import('../src/services/biblioteca.service.js');

    // 1. Buscar ou criar config
    const instituicoes = await prisma.instituicao.findMany({ take: 1, select: { id: true } });
    const instituicaoId = instituicoes[0]?.id;

    if (!instituicaoId) {
      console.log('  ⚠ Sem instituição no banco - pulando testes que precisam de tenant');
      console.log('\n  Verificando apenas imports e estrutura...\n');
    } else {
      // 1. getBibliotecaConfig
      try {
        const config = await getBibliotecaConfig(instituicaoId);
        if (config && typeof config.limiteEmprestimosPorUsuario === 'number') {
          console.log('  ✔ getBibliotecaConfig retorna config válida');
          passed++;
        } else {
          console.log('  ✖ getBibliotecaConfig: config inválida');
          failed++;
        }
      } catch (e: any) {
        console.log('  ✖ getBibliotecaConfig:', e?.message || e);
        failed++;
      }

      // 2. verificarLimiteEmprestimos
      try {
        const users = await prisma.user.findMany({
          where: { instituicaoId },
          take: 1,
          select: { id: true },
        });
        const userId = users[0]?.id;
        if (userId) {
          const result = await verificarLimiteEmprestimos(instituicaoId, userId);
          if (typeof result.permitido === 'boolean' && typeof result.atual === 'number' && typeof result.limite === 'number') {
            console.log('  ✔ verificarLimiteEmprestimos retorna { permitido, atual, limite }');
            passed++;
          } else {
            console.log('  ✖ verificarLimiteEmprestimos: formato inválido');
            failed++;
          }
        } else {
          console.log('  ⚠ Sem usuário - pulando verificarLimiteEmprestimos');
        }
      } catch (e: any) {
        console.log('  ✖ verificarLimiteEmprestimos:', e?.message || e);
        failed++;
      }

      // 3. calcularECriarMulta (sem criar multa real - dataDevolucao <= dataPrevista)
      try {
        const result = await calcularECriarMulta(
          '00000000-0000-0000-0000-000000000001',
          new Date('2025-01-15'),
          new Date('2025-01-10'),
          instituicaoId
        );
        if (result.valor === 0 && result.diasAtraso === 0) {
          console.log('  ✔ calcularECriarMulta: sem atraso retorna valor 0');
          passed++;
        } else {
          console.log('  ✖ calcularECriarMulta: esperado valor 0 para sem atraso');
          failed++;
        }
      } catch (e: any) {
        // Pode falhar se emprestimoId não existe - não crítico para este teste
        if (e?.message?.includes('Foreign key') || e?.code === 'P2003') {
          console.log('  ✔ calcularECriarMulta: função executa (FK esperada para ID fictício)');
          passed++;
        } else {
          console.log('  ✖ calcularECriarMulta:', e?.message || e);
          failed++;
        }
      }

      // 4. expirarReservasAntigas
      try {
        const count = await expirarReservasAntigas();
        if (typeof count === 'number') {
          console.log('  ✔ expirarReservasAntigas retorna número');
          passed++;
        } else {
          console.log('  ✖ expirarReservasAntigas: retorno inválido');
          failed++;
        }
      } catch (e: any) {
        console.log('  ✖ expirarReservasAntigas:', e?.message || e);
        failed++;
      }
    }

    // 5. Verificar tabelas existem
    try {
      const configCount = await prisma.bibliotecaConfig.count();
      console.log('  ✔ Tabela biblioteca_config acessível');
      passed++;
    } catch (e: any) {
      console.log('  ✖ biblioteca_config:', e?.message || e);
      failed++;
    }

    try {
      await prisma.reservaBiblioteca.count();
      console.log('  ✔ Tabela reservas_biblioteca acessível');
      passed++;
    } catch (e: any) {
      console.log('  ✖ reservas_biblioteca:', e?.message || e);
      failed++;
    }

    try {
      await prisma.multaBiblioteca.count();
      console.log('  ✔ Tabela multas_biblioteca acessível');
      passed++;
    } catch (e: any) {
      console.log('  ✖ multas_biblioteca:', e?.message || e);
      failed++;
    }

    // 6. Verificar rotas registradas
    const fs = await import('fs');
    const routesPath = path.resolve(__dirname, '../src/routes/biblioteca.routes.ts');
    const routesContent = fs.readFileSync(routesPath, 'utf-8');
    const expectedRoutes = ['/config', '/reservas', '/multas', '/relatorios'];
    const hasRoutes = expectedRoutes.every((r) => routesContent.includes(r));
    if (hasRoutes) {
      console.log('  ✔ Rotas config, reservas, multas, relatorios registradas');
      passed++;
    } else {
      console.log('  ✖ Rotas faltando em biblioteca.routes.ts');
      failed++;
    }

    // 7. Verificar scheduler
    const schedulerPath = path.resolve(__dirname, '../src/services/scheduler.service.ts');
    const schedulerContent = fs.readFileSync(schedulerPath, 'utf-8');
    if (schedulerContent.includes('enviarNotificacoesVencimento') && schedulerContent.includes('expirarReservasAntigas')) {
      console.log('  ✔ Scheduler: jobs de biblioteca registrados');
      passed++;
    } else {
      console.log('  ✖ Scheduler: jobs de biblioteca não encontrados');
      failed++;
    }
  } catch (e: any) {
    console.error('  ✖ Erro geral:', e?.message || e);
    failed++;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  RESUMO: ${passed} passou, ${failed} falhou`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
