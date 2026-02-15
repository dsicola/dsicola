/**
 * Seed dos planos conforme proposta comercial DSICOLA
 * 
 * Estratégia:
 * - Valor fixo mensal por instituição (não por aluno)
 * - Diferenciação por limite de alunos
 * - Planos separados para Ensino Secundário e Superior (preços e limites diferentes)
 * 
 * Executar: npx tsx scripts/seed-planos-comerciais.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLANOS_SECUNDARIO = [
  {
    nome: 'Básico Secundário',
    descricao: 'Para escolas até 400 alunos. Inclui: Gestão de Alunos, Professores, Notas, Frequência, Financeiro, Documentos.',
    tipoAcademico: 'SECUNDARIO' as const,
    valorMensal: 35000,
    valorAnual: 350000,   // 2 meses grátis (10 meses)
    valorSemestral: 190000,
    limiteAlunos: 400,
    funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos'],
  },
  {
    nome: 'Profissional Secundário',
    descricao: 'Até 1000 alunos. Inclui tudo do Básico + Comunicação, Analytics, Relatórios avançados.',
    tipoAcademico: 'SECUNDARIO' as const,
    valorMensal: 60000,
    valorAnual: 600000,
    valorSemestral: 330000,
    limiteAlunos: 1000,
    funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos', 'comunicados', 'analytics'],
  },
  {
    nome: 'Enterprise Secundário',
    descricao: 'Alunos ilimitados. Inclui tudo + API, Suporte prioritário, Personalizações.',
    tipoAcademico: 'SECUNDARIO' as const,
    valorMensal: 90000,
    valorAnual: 900000,
    valorSemestral: null,
    limiteAlunos: null, // Ilimitado
    funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos', 'comunicados', 'analytics', 'api_access', 'alojamentos'],
  },
];

const PLANOS_SUPERIOR = [
  {
    nome: 'Standard Superior',
    descricao: 'Para universidades até 1000 estudantes.',
    tipoAcademico: 'SUPERIOR' as const,
    valorMensal: 120000,
    valorAnual: 1200000,
    valorSemestral: null,
    limiteAlunos: 1000,
    funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos'],
  },
  {
    nome: 'Profissional Superior',
    descricao: 'Até 3000 estudantes. Maior complexidade, mais cursos e departamentos.',
    tipoAcademico: 'SUPERIOR' as const,
    valorMensal: 200000,
    valorAnual: 2000000,
    valorSemestral: null,
    limiteAlunos: 3000,
    funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos', 'comunicados', 'analytics'],
  },
  {
    nome: 'Enterprise Superior',
    descricao: 'Ilimitado. Negociado por contrato anual. Inclui API, Suporte prioritário, Personalizações.',
    tipoAcademico: 'SUPERIOR' as const,
    valorMensal: 375000, // Média 300.000 - 450.000 AOA
    valorAnual: 4500000,
    valorSemestral: null,
    limiteAlunos: null, // Ilimitado
    funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos', 'comunicados', 'analytics', 'api_access', 'alojamentos'],
  },
];

async function main() {
  console.log('🌱 Seed de planos comerciais DSICOLA\n');

  // Desativar planos antigos (BASIC, PRO, ENTERPRISE genéricos) em vez de apagar
  const desativados = await prisma.plano.updateMany({
    where: {
      nome: { in: ['BASIC', 'PRO', 'ENTERPRISE'] },
    },
    data: { ativo: false },
  });
  if (desativados.count > 0) {
    console.log(`   ⚠ Planos legados (BASIC/PRO/ENTERPRISE) desativados: ${desativados.count}`);
  }

  const todosPlanos = [...PLANOS_SECUNDARIO, ...PLANOS_SUPERIOR];

  for (const p of todosPlanos) {
    const existente = await prisma.plano.findFirst({
      where: {
        nome: p.nome,
        tipoAcademico: p.tipoAcademico,
      },
    });

    if (existente) {
      await prisma.plano.update({
        where: { id: existente.id },
        data: {
          descricao: p.descricao,
          valorMensal: p.valorMensal,
          valorAnual: p.valorAnual,
          valorSemestral: p.valorSemestral,
          precoSecundario: p.tipoAcademico === 'SECUNDARIO' ? p.valorMensal : null,
          precoUniversitario: p.tipoAcademico === 'SUPERIOR' ? p.valorMensal : null,
          limiteAlunos: p.limiteAlunos,
          funcionalidades: p.funcionalidades as any,
          ativo: true,
        },
      });
      console.log(`   ✓ Atualizado: ${p.nome} (${p.tipoAcademico})`);
    } else {
      await prisma.plano.create({
        data: {
          nome: p.nome,
          descricao: p.descricao,
          tipoAcademico: p.tipoAcademico,
          valorMensal: p.valorMensal,
          valorAnual: p.valorAnual,
          valorSemestral: p.valorSemestral,
          precoSecundario: p.tipoAcademico === 'SECUNDARIO' ? p.valorMensal : null,
          precoUniversitario: p.tipoAcademico === 'SUPERIOR' ? p.valorMensal : null,
          limiteAlunos: p.limiteAlunos,
          funcionalidades: p.funcionalidades as any,
          ativo: true,
        },
      });
      console.log(`   + Criado: ${p.nome} (${p.tipoAcademico})`);
    }
  }

  console.log('\n✅ Seed de planos concluído.');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
