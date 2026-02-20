#!/usr/bin/env npx tsx
/**
 * TESTE DE EMISSÃO DE RECIBO DE MENSALIDADE - ENSINO SECUNDÁRIO
 *
 * Valida que no Ensino Secundário o recibo mostra CLASSE (ex: 10ª Classe, 12ª Classe)
 * e não ANO. Garante CURSO, TURMA, CLASSE corretos.
 *
 * Requer: Backend rodando em http://localhost:3001
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts (cria Inst A Secundário)
 * Uso: npx tsx scripts/test-recibo-mensalidade-secundario.ts
 */
import axios from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA_TESTE = process.env.TEST_RECIBO_PASS || 'Recibo@123';
const SENHA_SEED = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE RECIBO MENSALIDADE - ENSINO SECUNDÁRIO');
  console.log('  Validação: CLASSE (10ª Classe, 12ª Classe) no recibo');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  // ─── 1. ENCONTRAR INSTITUIÇÃO SECUNDÁRIA COM ALUNOS ──────────────────────────────────────
  const instSec = await prisma.instituicao.findFirst({
    where: {
      tipoAcademico: 'SECUNDARIO',
      users: { some: { roles: { some: { role: 'ALUNO' } } } },
    },
    select: { id: true, nome: true },
  });

  if (!instSec) {
    console.error('❌ Nenhuma instituição SECUNDARIO encontrada.');
    console.error('   Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Instituição Secundária: ${instSec.nome} (${instSec.id})\n`);

  // ─── 2. ENCONTRAR MENSALIDADE PENDENTE (Secundário, sem pagamentos) ───────────────────────
  let mensalidade = await prisma.mensalidade.findFirst({
    where: {
      status: 'Pendente',
      pagamentos: { none: {} },
      aluno: { instituicaoId: instSec.id },
    },
    include: {
      pagamentos: true,
      aluno: { select: { id: true, nomeCompleto: true, email: true, instituicaoId: true } },
      curso: { select: { nome: true } },
      classe: { select: { nome: true } },
      matricula: {
        select: {
          turma: {
            select: {
              nome: true,
              ano: true,
              curso: { select: { nome: true } },
              classe: { select: { nome: true } },
            },
          },
        },
      },
    },
  });

  // Se não houver mensalidade, criar estrutura e mensalidade
  if (!mensalidade) {
    console.log('⚠️  Nenhuma mensalidade pendente. Criando dados de teste...\n');

    const ano = new Date().getFullYear();
    let anoLetivo = await prisma.anoLetivo.findFirst({
      where: { instituicaoId: instSec.id, ano },
    });
    if (!anoLetivo) {
      anoLetivo = await prisma.anoLetivo.create({
        data: {
          instituicaoId: instSec.id,
          ano,
          status: 'ATIVO',
          dataInicio: new Date(ano, 0, 1),
        },
      });
    }

    let classe = await prisma.classe.findFirst({
      where: { instituicaoId: instSec.id, nome: { contains: '10' } },
    });
    if (!classe) {
      classe = await prisma.classe.create({
        data: {
          instituicaoId: instSec.id,
          codigo: '10',
          nome: '10ª Classe',
          ordem: 10,
        },
      });
    }

    let curso = await prisma.curso.findFirst({
      where: { instituicaoId: instSec.id },
    });
    if (!curso) {
      curso = await prisma.curso.create({
        data: {
          instituicaoId: instSec.id,
          nome: 'Ciências Físico-Naturais',
          codigo: 'CFN',
          valorMensalidade: 0,
        },
      });
    }

    let turma = await prisma.turma.findFirst({
      where: {
        instituicaoId: instSec.id,
        anoLetivoId: anoLetivo.id,
        classeId: classe.id,
      },
    });
    if (!turma) {
      turma = await prisma.turma.create({
        data: {
          instituicaoId: instSec.id,
          anoLetivoId: anoLetivo.id,
          nome: '10ª Classe - Turma A',
          cursoId: curso.id,
          classeId: classe.id,
          capacidade: 30,
        },
      });
    }

    let aluno = await prisma.user.findFirst({
      where: {
        instituicaoId: instSec.id,
        roles: { some: { role: 'ALUNO' } },
      },
      select: { id: true, nomeCompleto: true, email: true },
    });
    if (!aluno) {
      console.error('❌ Nenhum aluno na instituição. Execute seed-multi-tenant-test.ts');
      await prisma.$disconnect();
      process.exit(1);
    }

    let matAnual = await prisma.matriculaAnual.findFirst({
      where: { alunoId: aluno.id, anoLetivoId: anoLetivo.id, status: 'ATIVA' },
    });
    if (!matAnual) {
      matAnual = await prisma.matriculaAnual.create({
        data: {
          alunoId: aluno.id,
          anoLetivoId: anoLetivo.id,
          instituicaoId: instSec.id,
          nivelEnsino: 'SECUNDARIO',
          classeOuAnoCurso: classe.nome,
          cursoId: curso.id,
          classeId: classe.id,
          status: 'ATIVA',
        },
      });
    }

    let matricula = await prisma.matricula.findFirst({
      where: { alunoId: aluno.id, turmaId: turma.id, status: 'Ativa' },
    });
    if (!matricula) {
      matricula = await prisma.matricula.create({
        data: {
          alunoId: aluno.id,
          turmaId: turma.id,
          anoLetivoId: anoLetivo.id,
          status: 'Ativa',
        },
      });
    }

    // Encontrar mês/ano sem mensalidade existente (evita unique constraint)
    let mesRef = new Date().getMonth() + 1;
    let anoRef = ano;
    for (let t = 0; t < 24; t++) {
      const exists = await prisma.mensalidade.findFirst({
        where: {
          alunoId: aluno.id,
          mesReferencia: String(mesRef),
          anoReferencia: anoRef,
        },
      });
      if (!exists) break;
      mesRef--;
      if (mesRef < 1) {
        mesRef = 12;
        anoRef--;
      }
    }

    const venc = new Date(anoRef, mesRef - 1, 10);
    mensalidade = await prisma.mensalidade.create({
      data: {
        alunoId: aluno.id,
        matriculaId: matricula.id,
        cursoId: curso.id,
        classeId: classe.id,
        mesReferencia: String(mesRef),
        anoReferencia: anoRef,
        valor: new Decimal(25000),
        dataVencimento: venc,
        status: 'Pendente',
      },
      include: {
        aluno: { select: { id: true, nomeCompleto: true, email: true, instituicaoId: true } },
        curso: { select: { nome: true } },
        classe: { select: { nome: true } },
        matricula: {
          select: {
            turma: {
              select: {
                nome: true,
                ano: true,
                curso: { select: { nome: true } },
                classe: { select: { nome: true } },
              },
            },
          },
        },
      },
    });

    console.log('  ✔ Mensalidade criada para', mensalidade.aluno?.nomeCompleto);
    console.log(`  ✔ Turma: ${(mensalidade.matricula as any)?.turma?.nome}`);
    console.log(`  ✔ Classe: ${mensalidade.classe?.nome ?? (mensalidade.matricula as any)?.turma?.classe?.nome}\n`);
  }

  const instituicaoId = mensalidade!.aluno?.instituicaoId;
  if (!instituicaoId) {
    console.error('❌ Mensalidade sem instituição.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const classeEsperada =
    mensalidade!.classe?.nome ??
    (mensalidade!.matricula as any)?.turma?.classe?.nome ??
    null;
  console.log('Mensalidade selecionada:');
  console.log(`  Aluno: ${mensalidade!.aluno?.nomeCompleto}`);
  console.log(`  Valor: ${mensalidade!.valor}`);
  console.log(`  Classe (esperada no recibo): ${classeEsperada ?? '(será validada)'}\n`);

  // ─── 3. USUÁRIO PARA LOGIN ─────────────────────────────────────────────────────────────
  let userWithRole = await prisma.user.findFirst({
    where: {
      instituicaoId,
      roles: { some: { role: { in: ['SECRETARIA', 'POS', 'FINANCEIRO', 'ADMIN'] } } },
    },
    select: { id: true, email: true },
  });

  if (!userWithRole) {
    const admin = await prisma.user.findFirst({
      where: { instituicaoId },
      select: { id: true, email: true },
    });
    if (admin) {
      await prisma.userRole_.upsert({
        where: {
          userId_role_instituicaoId: {
            userId: admin.id,
            role: 'SECRETARIA',
            instituicaoId,
          },
        },
        update: {},
        create: { userId: admin.id, role: 'SECRETARIA', instituicaoId },
      });
      userWithRole = admin;
    }
  }

  if (!userWithRole) {
    console.error('❌ Nenhum usuário com role SECRETARIA/POS/ADMIN na instituição.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const hash = await bcrypt.hash(SENHA_TESTE, 10);
  await prisma.user.update({
    where: { id: userWithRole.id },
    data: { password: hash, mustChangePassword: false },
  });
  console.log(`Usuário: ${userWithRole.email} (senha: ${SENHA_TESTE})\n`);
  await prisma.$disconnect();

  // ─── 4. LOGIN E REGISTRAR PAGAMENTO ───────────────────────────────────────────────────
  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  const loginRes = await api.post('/auth/login', {
    email: userWithRole.email,
    password: SENHA_TESTE,
  });

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('❌ Login falhou. Tente:', SENHA_SEED, 'se seed usou senha padrão.');
    process.exit(1);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.accessToken}`;
  console.log('✅ Login OK\n');

  const valorTotal =
    Number(mensalidade!.valor) -
    Number(mensalidade!.valorDesconto || 0) +
    Number(mensalidade!.valorMulta || 0) +
    Number(mensalidade!.valorJuros || 0);

  const registrarRes = await api.post(
    `/pagamentos/mensalidade/${mensalidade!.id}/registrar`,
    { valor: valorTotal, metodoPagamento: 'TRANSFERENCIA', observacoes: 'Teste Secundário' }
  );

  if (registrarRes.status !== 201) {
    console.error('❌ Falha ao registrar pagamento:', registrarRes.data?.message);
    process.exit(1);
  }

  const reciboId = registrarRes.data?.reciboId;
  if (!reciboId) {
    console.error('❌ Resposta sem reciboId.');
    process.exit(1);
  }

  console.log(`✅ Pagamento registrado. Recibo ID: ${reciboId}\n`);

  // ─── 5. VALIDAR pdfData ───────────────────────────────────────────────────────────────
  const reciboRes = await api.get(`/recibos/${reciboId}`);
  if (reciboRes.status !== 200) {
    console.error('❌ Falha ao buscar recibo.');
    process.exit(1);
  }

  const pdfData = reciboRes.data?.pdfData;
  if (!pdfData) {
    console.error('❌ Recibo sem pdfData.');
    process.exit(1);
  }

  const tipoAcad = pdfData.instituicao?.tipoAcademico;
  const alunoData = pdfData.aluno;

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  VALIDAÇÃO DO RECIBO (Ensino Secundário)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  console.log('Dados no recibo:');
  console.log(`  Instituição: ${pdfData.instituicao?.nome}`);
  console.log(`  tipoAcademico: ${tipoAcad}`);
  console.log(`  CURSO: ${alunoData?.curso ?? '-'}`);
  console.log(`  TURMA: ${alunoData?.turma ?? '-'}`);
  console.log(`  CLASSE: ${alunoData?.classeFrequencia ?? '-'}`);
  console.log(`  ANO (não usado no Secundário): ${alunoData?.anoFrequencia ?? '-'}\n`);

  const erros: string[] = [];

  if (tipoAcad !== 'SECUNDARIO') {
    erros.push(`tipoAcademico esperado SECUNDARIO, obtido: ${tipoAcad}`);
  }

  if (!alunoData?.classeFrequencia?.trim()) {
    erros.push('CLASSE ausente no recibo. Deve vir "10ª Classe", "12ª Classe", etc.');
  } else if (!/\d+ª\s*Classe/i.test(alunoData.classeFrequencia)) {
    erros.push(`CLASSE formato inválido: "${alunoData.classeFrequencia}". Esperado "10ª Classe", "12ª Classe"`);
  }

  if (alunoData?.anoFrequencia && tipoAcad === 'SECUNDARIO') {
    console.log('  ⚠️  ANO preenchido (Secundário usa CLASSE; anoFrequencia pode ficar null)');
  }

  if (!alunoData?.curso?.trim()) erros.push('CURSO ausente');
  if (!alunoData?.turma?.trim()) erros.push('TURMA ausente');

  if (erros.length > 0) {
    console.log('❌ FALHAS:');
    erros.forEach((e) => console.log(`   - ${e}`));
    process.exit(1);
  }

  console.log('✅ SUCESSO: Recibo Ensino Secundário contém CLASSE corretamente.');
  console.log(`   CLASSE: ${alunoData?.classeFrequencia}\n`);
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
