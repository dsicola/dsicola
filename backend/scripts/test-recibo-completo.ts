#!/usr/bin/env npx tsx
/**
 * TESTE COMPLETO DE RECIBO DE MENSALIDADE
 *
 * Valida que TODOS os campos do recibo são carregados corretamente para:
 * - Ensino Secundário: Instituição, Aluno, Nº, Classe, Turma, Curso, Mês Referente,
 *   valor, forma de pagamento, Nº recibo, data
 * - Ensino Superior: Instituição, Estudante, Nº, Curso, Ano Curricular, Turno, Turma,
 *   Semestre, Série, Mês Referente, valor, forma de pagamento, Nº recibo, data
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npm run test:recibo-completo
 */
import axios from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA_TESTE = process.env.TEST_RECIBO_PASS || 'Recibo@123';

interface PdfData {
  instituicao?: {
    nome?: string;
    endereco?: string | null;
    telefone?: string | null;
    email?: string | null;
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  };
  aluno?: {
    nome?: string | null;
    numeroId?: string | null;
    curso?: string | null;
    turma?: string | null;
    classeFrequencia?: string | null;
    anoFrequencia?: string | null;
    turno?: string | null;
    semestre?: string | null;
  };
  pagamento?: {
    valor?: number;
    reciboNumero?: string;
    dataPagamento?: string;
    formaPagamento?: string;
    mesReferencia?: number;
    anoReferencia?: number;
    serie?: string | null;
  };
}

function validarCampo(valor: unknown, nome: string, obrigatorio = true): string | null {
  const v = valor == null ? '' : String(valor).trim();
  if (!v || v === '-') {
    return obrigatorio ? `${nome}: ausente ou vazio` : null;
  }
  return null;
}

async function executarTeste(
  tipo: 'SECUNDARIO' | 'SUPERIOR',
  instFiltro: { tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' }
) {
  const rotulo = tipo === 'SECUNDARIO' ? 'Ensino Secundário' : 'Ensino Superior';
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  TESTE: ${rotulo}`);
  console.log(`${'─'.repeat(60)}\n`);

  // 1. Encontrar ou criar mensalidade com estrutura completa (matrícula + turma com turno para Superior)
  let mensalidade = await prisma.mensalidade.findFirst({
    where: {
      status: 'Pendente',
      pagamentos: { none: {} },
      matriculaId: { not: null },
      aluno: { instituicao: { tipoAcademico: instFiltro.tipoAcademico } },
      ...(tipo === 'SUPERIOR'
        ? { matricula: { turma: { turnoId: { not: null } } } }
        : {}),
    },
    include: {
      aluno: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          numeroIdentificacaoPublica: true,
          numeroIdentificacao: true,
          instituicaoId: true,
        },
      },
      curso: { select: { nome: true } },
      classe: { select: { nome: true } },
      matricula: {
        select: {
          id: true,
          turma: {
            select: {
              id: true,
              nome: true,
              ano: true,
              semestre: true,
              curso: { select: { nome: true } },
              classe: { select: { nome: true } },
              turno: { select: { nome: true } },
            },
          },
        },
      },
    },
  });

  if (!mensalidade) {
    console.log(`  ⚠️  Criando dados de teste para ${rotulo}...\n`);
    mensalidade = await criarMensalidadeTeste(instFiltro.tipoAcademico);
  }

  if (mensalidade && !mensalidade.aluno?.numeroIdentificacaoPublica?.trim()) {
    const num = `T${Date.now().toString().slice(-6)}`;
    await prisma.user.update({
      where: { id: mensalidade.aluno!.id },
      data: { numeroIdentificacaoPublica: num },
    });
    mensalidade = { ...mensalidade, aluno: { ...mensalidade.aluno!, numeroIdentificacaoPublica: num } };
  }

  if (mensalidade && tipo === 'SUPERIOR') {
    const mat = mensalidade.matricula as { turma?: { id: string; turno?: { nome: string } | null } } | null;
    if (mat?.turma && !mat.turma.turno) {
      let turno = await prisma.turno.findFirst({ where: { instituicaoId: mensalidade.aluno!.instituicaoId } });
      if (!turno) {
        turno = await prisma.turno.create({
          data: { instituicaoId: mensalidade.aluno!.instituicaoId, nome: 'Manhã' },
        });
      }
      await prisma.turma.update({
        where: { id: mat.turma.id },
        data: { turnoId: turno.id },
      });
    }
  }

  if (!mensalidade) {
    throw new Error(`Não foi possível obter mensalidade para ${rotulo}`);
  }

  const instituicaoId = mensalidade.aluno?.instituicaoId;
  if (!instituicaoId) {
    throw new Error('Mensalidade sem instituição');
  }

  const matricula = mensalidade.matricula as typeof mensalidade.matricula & { turma?: { nome?: string; turno?: { nome?: string }; semestre?: number } };
  const turma = matricula?.turma;

  console.log(`  Mensalidade: ${mensalidade.aluno?.nomeCompleto}`);
  console.log(`  Curso: ${mensalidade.curso?.nome ?? turma?.curso?.nome ?? '-'}`);
  console.log(`  Turma: ${turma?.nome ?? '-'}`);
  console.log(`  Classe: ${mensalidade.classe?.nome ?? turma?.classe?.nome ?? '-'}`);
  if (tipo === 'SUPERIOR') {
    console.log(`  Turno: ${turma?.turno?.nome ?? '-'}`);
    console.log(`  Semestre: ${turma?.semestre ?? '-'}`);
  }
  console.log('');

  // 2. Usuário para login
  const userWithRole = await prisma.user.findFirst({
    where: {
      instituicaoId,
      roles: { some: { role: { in: ['SECRETARIA', 'POS', 'FINANCEIRO', 'ADMIN'] } } },
    },
    select: { id: true, email: true },
  });

  if (!userWithRole) {
    throw new Error(`Nenhum usuário SECRETARIA/POS/ADMIN na instituição ${instituicaoId}`);
  }

  await prisma.user.update({
    where: { id: userWithRole.id },
    data: { password: await bcrypt.hash(SENHA_TESTE, 10), mustChangePassword: false },
  });
  await prisma.$disconnect();

  // 3. Login e registrar pagamento
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
    throw new Error(`Login falhou: ${loginRes.data?.message || loginRes.statusText}`);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.accessToken}`;

  const valorTotal =
    Number(mensalidade.valor) -
    Number(mensalidade.valorDesconto || 0) +
    Number(mensalidade.valorMulta || 0) +
    Number(mensalidade.valorJuros || 0);

  const registrarRes = await api.post(
    `/pagamentos/mensalidade/${mensalidade.id}/registrar`,
    { valor: valorTotal, metodoPagamento: 'TRANSFERENCIA', observacoes: `Teste ${rotulo}` }
  );

  if (registrarRes.status !== 201) {
    throw new Error(`Falha ao registrar pagamento: ${registrarRes.data?.message || registrarRes.statusText}`);
  }

  const reciboId = registrarRes.data?.reciboId;
  if (!reciboId) {
    throw new Error('Resposta sem reciboId');
  }

  // 4. Buscar recibo e validar pdfData
  const reciboRes = await api.get(`/recibos/${reciboId}`);
  if (reciboRes.status !== 200) {
    throw new Error(`Falha ao buscar recibo: ${reciboRes.data?.message}`);
  }

  const pdfData: PdfData | undefined = reciboRes.data?.pdfData;
  if (!pdfData) {
    throw new Error('Recibo sem pdfData');
  }

  // 5. Validação de todos os campos
  const erros: string[] = [];

  const inst = pdfData.instituicao;
  const aluno = pdfData.aluno;
  const pag = pdfData.pagamento;

  // Instituição
  erros.push(validarCampo(inst?.nome, 'Instituição.nome') ?? '');

  // Aluno/Estudante
  erros.push(validarCampo(aluno?.nome, 'Aluno.nome') ?? '');
  const numeroOk = !!(aluno?.numeroId?.trim() || (aluno as { bi?: string })?.bi?.trim());
  if (!numeroOk) {
    erros.push('Aluno: Nº público (numeroId) ausente - obrigatório em recibos');
  }

  // Campos comuns
  erros.push(validarCampo(aluno?.curso, 'Curso') ?? '');
  erros.push(validarCampo(aluno?.turma, 'Turma') ?? '');
  erros.push(validarCampo(pag?.reciboNumero, 'Nº Recibo') ?? '');
  erros.push(validarCampo(pag?.valor, 'Valor', false) ?? '');
  if (pag?.valor != null && pag.valor <= 0) {
    erros.push('Valor deve ser > 0');
  }
  erros.push(validarCampo(pag?.formaPagamento, 'Forma de Pagamento') ?? '');
  erros.push(validarCampo(pag?.dataPagamento, 'Data de Pagamento') ?? '');
  erros.push(validarCampo(pag?.mesReferencia, 'Mês Referência') ?? '');
  erros.push(validarCampo(pag?.anoReferencia, 'Ano Referência') ?? '');

  if (tipo === 'SECUNDARIO') {
    erros.push(validarCampo(aluno?.classeFrequencia, 'Classe (classeFrequencia)') ?? '');
    if (aluno?.classeFrequencia && !/\d+ª\s*Classe/i.test(aluno.classeFrequencia)) {
      erros.push(`Classe formato inválido: "${aluno.classeFrequencia}". Esperado "10ª Classe", "12ª Classe"`);
    }
  }

  if (tipo === 'SUPERIOR') {
    erros.push(validarCampo(aluno?.anoFrequencia, 'Ano Curricular (anoFrequencia)') ?? '');
    if (aluno?.anoFrequencia && /\d{4}º\s*Ano/.test(aluno.anoFrequencia)) {
      erros.push(`ANO inválido (ano civil): "${aluno.anoFrequencia}". Deve ser "1º Ano", "2º Ano"`);
    }
    // Turno e Semestre: desejáveis; podem ser "-" se turma não tiver
    const turnoOk = aluno?.turno?.trim() && aluno.turno !== '-';
    const semestreOk = aluno?.semestre?.trim() && aluno.semestre !== '-';
    if (!turnoOk) erros.push('Turno: ausente ou "-" (turma deve ter turno configurado)');
    if (!semestreOk) erros.push('Semestre: ausente ou "-" (turma deve ter semestre configurado)');
    erros.push(validarCampo(pag?.serie, 'Série') ?? '');
  }

  const errosFiltrados = erros.filter(Boolean);

  // Relatório
  console.log(`  Dados no recibo (${rotulo}):`);
  console.log(`    Instituição: ${inst?.nome ?? '-'}`);
  console.log(`    Tel/Email: ${inst?.telefone ?? '-'} | ${inst?.email ?? '-'}`);
  console.log(`    Aluno: ${aluno?.nome ?? '-'}`);
  console.log(`    Nº: ${aluno?.numeroId ?? '-'}`);
  console.log(`    Curso: ${aluno?.curso ?? '-'}`);
  console.log(`    Turma: ${aluno?.turma ?? '-'}`);
  if (tipo === 'SECUNDARIO') {
    console.log(`    Classe: ${aluno?.classeFrequencia ?? '-'}`);
  } else {
    console.log(`    Ano Curricular: ${aluno?.anoFrequencia ?? '-'}`);
    console.log(`    Turno: ${aluno?.turno ?? '-'}`);
    console.log(`    Semestre: ${aluno?.semestre ?? '-'}`);
    console.log(`    Série: ${pag?.serie ?? '-'}`);
  }
  console.log(`    Mês/Ano Ref: ${pag?.mesReferencia ?? '-'}/${pag?.anoReferencia ?? '-'}`);
  console.log(`    Valor: ${pag?.valor ?? '-'}`);
  console.log(`    Forma: ${pag?.formaPagamento ?? '-'}`);
  console.log(`    Nº Recibo: ${pag?.reciboNumero ?? '-'}`);
  console.log('');

  if (errosFiltrados.length > 0) {
    console.log(`  ❌ FALHAS (${rotulo}):`);
    errosFiltrados.forEach((e) => console.log(`     - ${e}`));
    return false;
  }

  console.log(`  ✅ SUCESSO: Todos os campos carregados corretamente para ${rotulo}\n`);
  return true;
}

async function criarMensalidadeTeste(
  tipoAcademico: 'SECUNDARIO' | 'SUPERIOR'
): Promise<any> {
  // Prefer instituições com alunos (seed inst-a, inst-b)
  const inst = await prisma.instituicao.findFirst({
    where: {
      tipoAcademico,
      users: { some: { roles: { some: { role: 'ALUNO' } } } },
    },
    select: { id: true },
  }) ?? await prisma.instituicao.findFirst({
    where: { tipoAcademico },
    select: { id: true },
  });
  if (!inst) return null;

  const ano = new Date().getFullYear();
  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: inst.id, ano },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.create({
      data: {
        instituicaoId: inst.id,
        ano,
        status: 'ATIVO',
        dataInicio: new Date(ano, 0, 1),
      },
    });
  }

  const isSec = tipoAcademico === 'SECUNDARIO';

  let classe = isSec
    ? await prisma.classe.findFirst({
        where: { instituicaoId: inst.id, nome: { contains: '10' } },
      })
    : null;
  if (isSec && !classe) {
    classe = await prisma.classe.create({
      data: {
        instituicaoId: inst.id,
        codigo: '10',
        nome: '10ª Classe',
        ordem: 10,
        cargaHoraria: 0,
      },
    });
  }

  if (!isSec && !classe) {
    classe = await prisma.classe.findFirst({
      where: { instituicaoId: inst.id, nome: { contains: '1º' } },
    });
    if (!classe) {
      classe = await prisma.classe.create({
        data: {
          instituicaoId: inst.id,
          codigo: '1A',
          nome: '1º Ano',
          ordem: 1,
          cargaHoraria: 0,
        },
      });
    }
  }

  let curso = await prisma.curso.findFirst({
    where: { instituicaoId: inst.id },
  });
  if (!curso) {
    curso = await prisma.curso.create({
      data: {
        instituicaoId: inst.id,
        nome: isSec ? 'Ciências Humanas' : 'Engenharia Informática',
        codigo: isSec ? 'CH' : 'EI',
        valorMensalidade: 0,
      },
    });
  }

  let turno = await prisma.turno.findFirst({
    where: { instituicaoId: inst.id },
  });
  if (!turno) {
    turno = await prisma.turno.create({
      data: {
        instituicaoId: inst.id,
        nome: 'Manhã',
      },
    });
  }

  const nomeTurma = isSec ? '10ª Classe - Turma A' : 'Turma A';
  let turma = await prisma.turma.findFirst({
    where: {
      instituicaoId: inst.id,
      anoLetivoId: anoLetivo.id,
    },
  });
  if (!turma) {
    turma = await prisma.turma.create({
      data: {
        instituicaoId: inst.id,
        anoLetivoId: anoLetivo.id,
        nome: nomeTurma,
        cursoId: curso.id,
        classeId: classe!.id,
        turnoId: turno.id,
        capacidade: 30,
        ano: isSec ? undefined : 2,
        semestre: isSec ? undefined : 1,
      },
    });
  } else if (!isSec && (!turma.turnoId || turma.semestre == null)) {
    turma = await prisma.turma.update({
      where: { id: turma.id },
      data: {
        turnoId: turma.turnoId ?? turno.id,
        ano: turma.ano ?? 2,
        semestre: turma.semestre ?? 1,
      },
    });
  }

  let aluno = await prisma.user.findFirst({
    where: {
      instituicaoId: inst.id,
      roles: { some: { role: 'ALUNO' } },
    },
    select: { id: true, nomeCompleto: true, email: true, numeroIdentificacaoPublica: true, numeroIdentificacao: true, instituicaoId: true },
  });
  if (!aluno) return null;
  // Garantir Nº público para recibo (obrigatório)
  if (!aluno.numeroIdentificacaoPublica?.trim()) {
    const num = `TEST${Date.now().toString().slice(-6)}`;
    await prisma.user.update({
      where: { id: aluno.id },
      data: { numeroIdentificacaoPublica: num },
    });
    aluno = { ...aluno, numeroIdentificacaoPublica: num };
  }

  let matriculaAnual = await prisma.matriculaAnual.findFirst({
    where: { alunoId: aluno.id, anoLetivoId: anoLetivo.id, status: 'ATIVA' },
  });
  if (!matriculaAnual) {
    matriculaAnual = await prisma.matriculaAnual.create({
      data: {
        alunoId: aluno.id,
        anoLetivoId: anoLetivo.id,
        instituicaoId: inst.id,
        nivelEnsino: isSec ? 'SECUNDARIO' : 'SUPERIOR',
        classeOuAnoCurso: isSec ? classe!.nome : '2º Ano',
        cursoId: curso.id,
        classeId: classe!.id,
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
  return prisma.mensalidade.create({
    data: {
      alunoId: aluno.id,
      matriculaId: matricula.id,
      cursoId: curso.id,
      classeId: classe!.id,
      mesReferencia: String(mesRef),
      anoReferencia: anoRef,
      valor: new Decimal(75000),
      dataVencimento: venc,
      status: 'Pendente',
    },
    include: {
      aluno: { select: { id: true, nomeCompleto: true, email: true, numeroIdentificacaoPublica: true, instituicaoId: true } },
      curso: { select: { nome: true } },
      classe: { select: { nome: true } },
      matricula: {
        select: {
          turma: {
            select: {
              nome: true,
              ano: true,
              semestre: true,
              curso: { select: { nome: true } },
              classe: { select: { nome: true } },
              turno: { select: { nome: true } },
            },
          },
        },
      },
    },
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE COMPLETO DE RECIBO DE MENSALIDADE');
  console.log('  Validação de todos os campos: Ensino Secundário e Ensino Superior');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`\nAPI: ${API_URL}\n`);

  let okSec = false;
  let okSup = false;

  try {
    okSec = await executarTeste('SECUNDARIO', { tipoAcademico: 'SECUNDARIO' });
  } catch (e) {
    console.error(`  ❌ Erro no teste Secundário:`, (e as Error).message);
  }

  try {
    okSup = await executarTeste('SUPERIOR', { tipoAcademico: 'SUPERIOR' });
  } catch (e) {
    console.error(`  ❌ Erro no teste Superior:`, (e as Error).message);
  }

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  if (okSec && okSup) {
    console.log('  ✅ TODOS OS TESTES PASSARAM - Recibos carregam todos os campos corretamente');
  } else {
    console.log('  ❌ ALGUNS TESTES FALHARAM');
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
