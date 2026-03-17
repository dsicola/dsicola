#!/usr/bin/env npx tsx
/**
 * Verifica se uma instituição tem todos os pré-requisitos para o script
 * seed-documentos-teste-agt.ts (certificação AGT).
 *
 * Uso: npx tsx scripts/verificar-prerequisitos-agt.ts <instituicaoId>
 * Ou com Railway (produção): railway run npx tsx scripts/verificar-prerequisitos-agt.ts <instituicaoId>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const instituicaoId = process.argv[2];
  if (!instituicaoId) {
    console.error('Uso: npx tsx scripts/verificar-prerequisitos-agt.ts <instituicaoId>');
    console.error('Exemplo: npx tsx scripts/verificar-prerequisitos-agt.ts 669440c3-639e-4876-94e9-cc391240de46');
    process.exit(1);
  }

  console.log('\n=== Verificação de pré-requisitos AGT ===\n');
  console.log(`Instituição ID: ${instituicaoId}\n`);

  let ok = 0;
  let falhas: string[] = [];

  // 1. Instituição existe
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { id: true, nome: true, subdominio: true },
  });
  if (!instituicao) {
    console.error('❌ Instituição não encontrada. O ID está correto?');
    console.error('   (Se estiver a correr localmente, a instituição pode estar só em produção.)\n');
    process.exit(1);
  }
  console.log(`✅ Instituição: ${instituicao.nome} (${instituicao.subdominio || 'sem subdomínio'})`);
  ok++;

  // 2. Dados fiscais / NIF
  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId },
    select: {
      nif: true,
      nomeFiscal: true,
      emailFiscal: true,
      enderecoFiscal: true,
    },
  });
  if (!config) {
    console.log('❌ Configuração da instituição não encontrada.');
    falhas.push('Criar configuração em Sistema → Dados Fiscais');
  } else if (!config.nif || config.nif.replace(/\D/g, '').length < 9) {
    console.log('❌ NIF inválido ou em branco:', config.nif || '(vazio)');
    falhas.push('Preencher NIF real da instituição (9+ dígitos) em Sistema → Dados Fiscais');
  } else if (['000000000', '999999999'].includes(config.nif.replace(/\D/g, ''))) {
    console.log('❌ NIF de teste (000000000/999999999) não aceite pela AGT');
    falhas.push('Usar NIF real da instituição');
  } else {
    console.log(`✅ NIF configurado: ${config.nif}`);
    if (config.nomeFiscal) console.log(`   Nome fiscal: ${config.nomeFiscal}`);
    ok++;
  }

  // 3. Aluno(s) com NIF
  const alunosComNif = await prisma.user.findMany({
    where: {
      instituicaoId,
      roles: { some: { role: 'ALUNO' } },
      numeroIdentificacao: { not: null },
    },
    select: { id: true, nomeCompleto: true, email: true, numeroIdentificacao: true },
    take: 3,
  });
  if (alunosComNif.length === 0) {
    console.log('❌ Nenhum aluno com NIF/BI encontrado.');
    falhas.push('Criar ou editar aluno(s) e preencher "Número de identificação" (BI/NIF)');
  } else {
    console.log(`✅ Alunos com NIF: ${alunosComNif.length} (mín. 1)`);
    alunosComNif.slice(0, 2).forEach((a) =>
      console.log(`   - ${a.nomeCompleto} (${a.numeroIdentificacao})`)
    );
    ok++;
  }

  // 4. Aluno(s) sem NIF
  const alunosSemNif = await prisma.user.findMany({
    where: {
      instituicaoId,
      roles: { some: { role: 'ALUNO' } },
      numeroIdentificacao: null,
    },
    select: { id: true, nomeCompleto: true, email: true },
    take: 3,
  });
  if (alunosSemNif.length < 2) {
    console.log(
      `❌ Alunos sem NIF: ${alunosSemNif.length} (necessário: 2 para pontos 9 e 10)`
    );
    falhas.push('Criar 2 alunos com "Número de identificação" em branco');
  } else {
    console.log(`✅ Alunos sem NIF: ${alunosSemNif.length} (mín. 2)`);
    alunosSemNif.slice(0, 2).forEach((a) => console.log(`   - ${a.nomeCompleto}`));
    ok++;
  }

  // Resumo
  console.log('\n--- Resumo ---');
  if (falhas.length === 0) {
    console.log('✅ Todos os pré-requisitos cumpridos. Pode executar o script de documentos AGT:\n');
    console.log(
      `   npx tsx scripts/seed-documentos-teste-agt.ts ${instituicaoId} 2026-01-15`
    );
    console.log(
      `   npx tsx scripts/seed-documentos-teste-agt.ts ${instituicaoId} 2026-02-15\n`
    );
    if (process.env.RAILWAY_ENVIRONMENT) {
      console.log('   (Em produção: railway run antes do comando)\n');
    }
  } else {
    console.log('❌ Corrija os seguintes pontos antes de executar o script AGT:\n');
    falhas.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error('Erro:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
