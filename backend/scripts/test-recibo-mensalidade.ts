#!/usr/bin/env npx tsx
/**
 * TESTE DE EMISSÃO DE RECIBO DE MENSALIDADE
 *
 * Valida que ao registrar um pagamento de mensalidade, o recibo gerado
 * contém TODAS as informações necessárias: instituição, aluno (nome, Nº, curso,
 * turma, classe/ano), pagamento (valor, data, forma, número recibo).
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-recibo-mensalidade.ts
 */
import axios from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA_TESTE = process.env.TEST_RECIBO_PASS || 'Recibo@123';

interface PdfDataAluno {
  nome?: string | null;
  numeroId?: string | null;
  bi?: string | null;
  email?: string | null;
  curso?: string | null;
  turma?: string | null;
  anoFrequencia?: string | null;
  classeFrequencia?: string | null;
  anoLetivo?: number | null;
}

interface PdfData {
  instituicao?: { nome?: string; logoUrl?: string | null };
  aluno?: PdfDataAluno;
  pagamento?: {
    valor?: number;
    reciboNumero?: string;
    dataPagamento?: string;
    formaPagamento?: string;
    mesReferencia?: number;
    anoReferencia?: number;
  };
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE DE EMISSÃO DE RECIBO DE MENSALIDADE - DSICOLA');
  console.log('  Validação: CURSO, TURMA, CLASSE e demais dados no recibo');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  // ─── 1. ENCONTRAR MENSALIDADE PENDENTE COM DADOS COMPLETOS ─────────────────────────────
  const mensalidadeCompleta = await prisma.mensalidade.findFirst({
    where: {
      status: 'Pendente',
      pagamentos: { none: {} },
    },
    include: {
      pagamentos: true,
      aluno: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          numeroIdentificacao: true,
          numeroIdentificacaoPublica: true,
          instituicaoId: true,
        },
      },
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

  if (!mensalidadeCompleta) {
    console.log('⚠️  Nenhuma mensalidade pendente encontrada.');
    console.log('   Crie mensalidades pendentes (ex: via Secretaria ou gerar para todos) e execute novamente.');
    await prisma.$disconnect();
    process.exit(0);
  }

  const instituicaoId = mensalidadeCompleta.aluno?.instituicaoId;
  if (!instituicaoId) {
    console.error('❌ Mensalidade sem instituição associada ao aluno.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const cursoNome =
    mensalidadeCompleta.curso?.nome ??
    (mensalidadeCompleta.matricula as any)?.turma?.curso?.nome ??
    null;
  const turmaNome = (mensalidadeCompleta.matricula as any)?.turma?.nome ?? null;
  const classeNome =
    mensalidadeCompleta.classe?.nome ??
    (mensalidadeCompleta.matricula as any)?.turma?.classe?.nome ??
    null;

  console.log('Mensalidade selecionada:');
  console.log(`  ID: ${mensalidadeCompleta.id}`);
  console.log(`  Aluno: ${mensalidadeCompleta.aluno?.nomeCompleto}`);
  console.log(`  Valor: ${mensalidadeCompleta.valor}`);
  console.log(`  Curso (esperado): ${cursoNome ?? '(vazio - será validado)'}`);
  console.log(`  Turma (esperada): ${turmaNome ?? '(vazio - será validado)'}`);
  console.log(`  Classe (esperada): ${classeNome ?? '(vazio - será validado)'}\n`);

  // ─── 2. ENCONTRAR USUÁRIO SECRETARIA/POS PARA LOGIN ─────────────────────────────────────
  const userWithRole = await prisma.user.findFirst({
    where: {
      instituicaoId,
      roles: { some: { role: { in: ['SECRETARIA', 'POS', 'FINANCEIRO', 'ADMIN'] } } },
    },
    select: { id: true, email: true, nomeCompleto: true },
  });

  if (!userWithRole) {
    console.error('❌ Nenhum usuário SECRETARIA/POS/FINANCEIRO/ADMIN encontrado para esta instituição.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const hash = await bcrypt.hash(SENHA_TESTE, 10);
  await prisma.user.update({
    where: { id: userWithRole.id },
    data: { password: hash, mustChangePassword: false },
  });
  console.log(`Usuário de teste: ${userWithRole.email} (senha: ${SENHA_TESTE})\n`);
  await prisma.$disconnect();

  // ─── 3. LOGIN E REGISTRAR PAGAMENTO ───────────────────────────────────────────────────
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
    console.error('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    process.exit(1);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.accessToken}`;
  console.log('✅ Login OK\n');

  const valorTotal =
    Number(mensalidadeCompleta.valor) -
    Number(mensalidadeCompleta.valorDesconto || 0) +
    Number(mensalidadeCompleta.valorMulta || 0) +
    Number(mensalidadeCompleta.valorJuros || 0);

  const registrarRes = await api.post(
    `/pagamentos/mensalidade/${mensalidadeCompleta.id}/registrar`,
    {
      valor: valorTotal,
      metodoPagamento: 'TRANSFERENCIA',
      observacoes: 'Teste automático de recibo',
    }
  );

  if (registrarRes.status !== 201) {
    console.error('❌ Falha ao registrar pagamento:', registrarRes.data?.message || registrarRes.statusText);
    process.exit(1);
  }

  const reciboId = registrarRes.data?.reciboId;
  if (!reciboId) {
    console.error('❌ Resposta não contém reciboId.');
    process.exit(1);
  }

  console.log(`✅ Pagamento registrado. Recibo ID: ${reciboId}\n`);

  // ─── 4. BUSCAR RECIBO E VALIDAR pdfData ─────────────────────────────────────────────────
  const reciboRes = await api.get(`/recibos/${reciboId}`);

  if (reciboRes.status !== 200) {
    console.error('❌ Falha ao buscar recibo:', reciboRes.data?.message || reciboRes.statusText);
    process.exit(1);
  }

  const pdfData: PdfData | undefined = reciboRes.data?.pdfData;
  if (!pdfData) {
    console.error('❌ Recibo não contém pdfData.');
    process.exit(1);
  }

  // ─── 5. VALIDAÇÃO DOS CAMPOS OBRIGATÓRIOS ───────────────────────────────────────────────
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!pdfData.instituicao?.nome?.trim()) {
    erros.push('Instituição: nome ausente ou vazio');
  }

  const aluno = pdfData.aluno;
  if (!aluno?.nome?.trim()) {
    erros.push('Aluno: nome ausente ou vazio');
  }
  if (!aluno?.numeroId?.trim() && !aluno?.bi?.trim()) {
    avisos.push('Aluno: Nº público e BI ausentes (pode ser aceitável em alguns fluxos)');
  }

  // CURSO, TURMA, CLASSE/ANO - obrigatórios no recibo
  const temCurso = !!aluno?.curso?.trim();
  const temTurma = !!aluno?.turma?.trim();
  const temClasseOuAno =
    !!aluno?.classeFrequencia?.trim() || !!aluno?.anoFrequencia?.trim();

  // Regras: Superior = anoFrequencia "1º Ano", "2º Ano" (NUNCA "2026º Ano")
  //         Secundário = classeFrequencia "10ª Classe", "12ª Classe"
  const tipoAcad = (pdfData as any).instituicao?.tipoAcademico ?? null;
  if (tipoAcad === 'SUPERIOR' && aluno?.anoFrequencia) {
    if (/\d{4}º\s*Ano/.test(aluno.anoFrequencia)) {
      erros.push(
        `ANO inválido: "${aluno.anoFrequencia}" (ano civil). Deve ser "1º Ano", "2º Ano", etc.`
      );
    } else if (!/^\dº\s*Ano$/i.test(aluno.anoFrequencia.trim())) {
      avisos.push(`ANO formato: "${aluno.anoFrequencia}" (esperado "1º Ano", "2º Ano")`);
    }
  }
  if (tipoAcad === 'SECUNDARIO' && aluno?.classeFrequencia) {
    if (!/\d+ª\s*Classe/i.test(aluno.classeFrequencia)) {
      avisos.push(`CLASSE formato: "${aluno.classeFrequencia}" (esperado "10ª Classe", "12ª Classe")`);
    }
  }

  if (!temCurso) {
    erros.push('CURSO: ausente ou "-" no recibo (deve vir da matrícula/mensalidade)');
  }
  if (!temTurma) {
    erros.push('TURMA: ausente ou "-" no recibo (deve vir da matrícula)');
  }
  if (!temClasseOuAno) {
    erros.push(
      'CLASSE/ANO: ausente ou "-" no recibo (classeFrequencia para Secundário, anoFrequencia para Superior)'
    );
  }

  if (!pdfData.pagamento?.reciboNumero?.trim()) {
    erros.push('Pagamento: número do recibo ausente');
  }
  if (pdfData.pagamento?.valor == null || pdfData.pagamento?.valor <= 0) {
    erros.push('Pagamento: valor ausente ou inválido');
  }
  if (!pdfData.pagamento?.formaPagamento?.trim()) {
    erros.push('Pagamento: forma de pagamento ausente');
  }

  // ─── 6. RELATÓRIO ──────────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  VALIDAÇÃO DO RECIBO (pdfData)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  console.log('Dados retornados no recibo:');
  console.log(`  Instituição: ${pdfData.instituicao?.nome ?? '(vazio)'}`);
  console.log(`  Aluno nome: ${aluno?.nome ?? '(vazio)'}`);
  console.log(`  Aluno Nº: ${aluno?.numeroId ?? aluno?.bi ?? '(vazio)'}`);
  console.log(`  CURSO: ${aluno?.curso ?? '-'}`);
  console.log(`  TURMA: ${aluno?.turma ?? '-'}`);
  console.log(`  CLASSE: ${aluno?.classeFrequencia ?? '-'}`);
  console.log(`  ANO: ${aluno?.anoFrequencia ?? '-'}`);
  console.log(`  Valor: ${pdfData.pagamento?.valor ?? '-'}`);
  console.log(`  Nº Recibo: ${pdfData.pagamento?.reciboNumero ?? '-'}`);
  console.log(`  Forma: ${pdfData.pagamento?.formaPagamento ?? '-'}`);
  console.log(`  Data: ${pdfData.pagamento?.dataPagamento ?? '-'}\n`);

  if (avisos.length > 0) {
    avisos.forEach((a) => console.log(`  ⚠️  ${a}`));
    console.log('');
  }

  if (erros.length > 0) {
    console.log('❌ FALHAS:');
    erros.forEach((e) => console.log(`   - ${e}`));
    console.log('\nO recibo NÃO contém todas as informações necessárias.\n');
    process.exit(1);
  }

  console.log('✅ SUCESSO: O recibo contém todas as informações obrigatórias.');
  console.log('   CURSO, TURMA e CLASSE/ANO estão carregados corretamente.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
