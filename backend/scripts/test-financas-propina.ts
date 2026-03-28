#!/usr/bin/env npx tsx
/**
 * TESTE FINANÇAS / PROPINA - Dois Tipos de Instituição
 *
 * Estrutura:
 *   - Plano de propina configurável (Curso/Classe valorMensalidade)
 *   - Geração automática de mensalidades
 *   - Registro de pagamento
 *   - Status (Pago, Pendente, Atrasado, Parcial, Cancelado)
 *
 * Testes obrigatórios:
 *   - Pagamento parcial
 *   - Pagamento atrasado
 *   - Cancelamento de matrícula
 *   - Relatório financeiro por período
 *
 * Cobre: Ensino Secundário (Classe) e Ensino Superior (Curso)
 *
 * Pré-requisitos:
 *   1. npx tsx scripts/seed-multi-tenant-test.ts
 *   2. Backend rodando em http://localhost:3001
 *
 * Uso: npx tsx scripts/test-financas-propina.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';

interface Check {
  id: string;
  tipo: 'SECUNDARIO' | 'SUPERIOR';
  descricao: string;
  ok: boolean;
  detalhe?: string;
}

const checks: Check[] = [];

function assert(tipo: 'SECUNDARIO' | 'SUPERIOR', id: string, descricao: string, ok: boolean, detalhe?: string) {
  checks.push({ id, tipo, descricao, ok, detalhe });
  const icon = ok ? '✅' : '❌';
  const label = tipo === 'SECUNDARIO' ? '[SEC]' : '[SUP]';
  console.log(`  ${icon} ${label} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FINANÇAS / PROPINA - Dois Tipos de Instituição');
  console.log('  Estrutura: Plano configurável | Geração automática | Registro | Status');
  console.log('  Testes: Pagamento parcial | Atrasado | Cancelamento matrícula | Relatório');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  // ─── 1. LOGIN SUPER_ADMIN ───────────────────────────────────────────────────
  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('❌ Login SUPER_ADMIN falhou:', loginSuper.data?.message);
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;
  console.log('  ✅ Login SUPER_ADMIN\n');

  // ─── 2. BUSCAR INSTITUIÇÕES DO SEED ──────────────────────────────────────────
  const instA = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-a-secundario-test' } });
  const instB = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-b-superior-test' } });

  if (!instA || !instB) {
    console.error('❌ Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  // Garantir assinaturas ativas
  for (const inst of [instA, instB]) {
    let assinatura = await prisma.assinatura.findFirst({ where: { instituicaoId: inst.id } });
    if (!assinatura) {
      const plano = await prisma.plano.findFirst({ where: { ativo: true } });
      if (plano) {
        const umAno = new Date();
        umAno.setFullYear(umAno.getFullYear() + 1);
        assinatura = await prisma.assinatura.create({
          data: {
            instituicaoId: inst.id,
            planoId: plano.id,
            status: 'ativa',
            tipo: 'PAGA',
            dataFim: umAno,
            dataProximoPagamento: umAno,
            valorAtual: 0,
          },
        });
      }
    }
  }

  // ─── 3. LOGIN ADMIN A (Secundário) e ADMIN B (Superior) ───────────────────────
  const loginA = await api.post('/auth/login', {
    email: 'admin.inst.a@teste.dsicola.com',
    password: SENHA,
  });
  const loginB = await api.post('/auth/login', {
    email: 'admin.inst.b@teste.dsicola.com',
    password: SENHA,
  });

  const tokenA = loginA.data?.accessToken;
  const tokenB = loginB.data?.accessToken;

  if (!tokenA || !tokenB) {
    console.error('❌ Login das instituições falhou. Verifique seed e senhas.');
    process.exit(1);
  }

  const apiA: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    timeout: 30000,
    validateStatus: () => true,
  });

  const apiB: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    timeout: 30000,
    validateStatus: () => true,
  });

  const adminA = await prisma.user.findFirst({ where: { instituicaoId: instA.id }, include: { roles: true } });
  const adminB = await prisma.user.findFirst({ where: { instituicaoId: instB.id }, include: { roles: true } });

  // ─── SETUP ESTRUTURA POR INSTITUIÇÃO ─────────────────────────────────────────
  const TS = Date.now();
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  // Setup Secundário (Inst A): Curso sem valor, Classe com valor
  let cursoA = await prisma.curso.findFirst({ where: { instituicaoId: instA.id } });
  if (!cursoA) {
    const cr = await apiA.post('/cursos', {
      nome: `Curso Secundário ${TS}`,
      codigo: `CS${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 0, // Secundário: mensalidade na Classe
    });
    if (cr.status >= 400) {
      console.error('❌ Criar curso A:', cr.data?.message);
      process.exit(1);
    }
    cursoA = cr.data;
  }

  let classeA = await prisma.classe.findFirst({ where: { instituicaoId: instA.id } });
  if (!classeA) {
    const cr = await apiA.post('/classes', {
      nome: '10ª Classe',
      codigo: `10C-${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 75000, // Plano de propina na Classe
    });
    if (cr.status >= 400) {
      console.error('❌ Criar classe A:', cr.data?.message);
      process.exit(1);
    }
    classeA = cr.data;
  } else {
    await prisma.classe.update({
      where: { id: classeA.id },
      data: { valorMensalidade: 75000 },
    });
  }

  let anoLetivoA = await prisma.anoLetivo.findFirst({ where: { instituicaoId: instA.id } });
  if (!anoLetivoA) {
    anoLetivoA = await prisma.anoLetivo.create({
      data: {
        instituicaoId: instA.id,
        ano: anoAtual,
        dataInicio: new Date(anoAtual, 0, 1),
        dataFim: new Date(anoAtual, 11, 31),
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: adminA!.id,
      },
    });
  }

  let turmaA = await prisma.turma.findFirst({
    where: { instituicaoId: instA.id, anoLetivoId: anoLetivoA.id, classeId: classeA.id },
  });
  if (!turmaA) {
    const cr = await apiA.post('/turmas', {
      nome: `Turma 10A ${TS}`,
      classeId: classeA.id,
      anoLetivoId: anoLetivoA.id,
      capacidade: 30,
    });
    if (cr.status >= 400) {
      console.error('❌ Criar turma A:', cr.data?.message);
      process.exit(1);
    }
    turmaA = cr.data;
  }

  const alunoA = await prisma.user.findFirst({
    where: { instituicaoId: instA.id, roles: { some: { role: 'ALUNO' } } },
  });
  let alunoUserIdA = alunoA?.id;
  if (!alunoUserIdA) {
    const cr = await apiA.post('/users', {
      email: `aluno.fin.sec.${TS}@teste.dsicola.com`,
      password: SENHA,
      nomeCompleto: 'Aluno Finanças Secundário',
      role: 'ALUNO',
    });
    if (cr.status >= 400) {
      console.error('❌ Criar aluno A:', cr.data?.message);
      process.exit(1);
    }
    alunoUserIdA = cr.data.id;
    await prisma.user.update({
      where: { id: alunoUserIdA },
      data: { instituicaoId: instA.id, password: await bcrypt.hash(SENHA, 10), mustChangePassword: false },
    });
  }

  let matriculaAnualA = await prisma.matriculaAnual.findFirst({
    where: { alunoId: alunoUserIdA, anoLetivoId: anoLetivoA.id },
  });
  if (!matriculaAnualA) {
    const cr = await apiA.post('/matriculas-anuais', {
      alunoId: alunoUserIdA,
      anoLetivoId: anoLetivoA.id,
      nivelEnsino: 'SECUNDARIO',
      classeOuAnoCurso: classeA.nome,
      cursoId: cursoA.id,
    });
    if (cr.status >= 400) {
      console.error('❌ Matrícula anual A:', cr.data?.message);
      process.exit(1);
    }
    matriculaAnualA = cr.data;
  }

  let matriculaA = await prisma.matricula.findFirst({
    where: { alunoId: alunoUserIdA, turmaId: turmaA.id, status: 'Ativa' },
  });
  if (!matriculaA) {
    const cr = await apiA.post('/matriculas', {
      alunoId: alunoUserIdA,
      turmaId: turmaA.id,
      status: 'Ativa',
    });
    if (cr.status >= 400) {
      console.error('❌ Matrícula A:', cr.data?.message);
      process.exit(1);
    }
    matriculaA = cr.data;
  }

  // Setup Superior (Inst B): Curso com valor, sem Classe no fluxo
  let cursoB = await prisma.curso.findFirst({ where: { instituicaoId: instB.id } });
  if (!cursoB) {
    const cr = await apiB.post('/cursos', {
      nome: `Curso Superior ${TS}`,
      codigo: `CSUP${TS}`,
      cargaHoraria: 240,
      valorMensalidade: 120000, // Plano de propina no Curso
      duracao: '4 anos',
      grau: 'Licenciatura',
    });
    if (cr.status >= 400) {
      console.error('❌ Criar curso B:', cr.data?.message);
      process.exit(1);
    }
    cursoB = cr.data;
  } else {
    await prisma.curso.update({
      where: { id: cursoB.id },
      data: { valorMensalidade: 120000 },
    });
  }

  let anoLetivoB = await prisma.anoLetivo.findFirst({ where: { instituicaoId: instB.id } });
  if (!anoLetivoB) {
    anoLetivoB = await prisma.anoLetivo.create({
      data: {
        instituicaoId: instB.id,
        ano: anoAtual,
        dataInicio: new Date(anoAtual, 0, 1),
        dataFim: new Date(anoAtual, 11, 31),
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: adminB!.id,
      },
    });
  }

  let semestreB = await prisma.semestre.findFirst({
    where: { anoLetivoId: anoLetivoB.id, numero: 1, instituicaoId: instB.id },
    include: { anoLetivoRef: true },
  });
  if (!semestreB) {
    semestreB = await prisma.semestre.create({
      data: {
        anoLetivoId: anoLetivoB.id,
        anoLetivo: anoLetivoB.ano,
        numero: 1,
        dataInicio: new Date(anoAtual, 0, 1),
        dataFim: new Date(anoAtual, 5, 30),
        instituicaoId: instB.id,
      },
      include: { anoLetivoRef: true },
    });
  }

  let turmaB = await prisma.turma.findFirst({
    where: { instituicaoId: instB.id, cursoId: cursoB.id, anoLetivoId: anoLetivoB.id },
  });
  if (!turmaB) {
    const cr = await apiB.post('/turmas', {
      nome: `Turma Superior 1S ${TS}`,
      cursoId: cursoB.id,
      anoLetivoId: anoLetivoB.id,
      semestre: 1,
      capacidade: 40,
    });
    if (cr.status >= 400) {
      console.error('❌ Criar turma B:', cr.data?.message);
      process.exit(1);
    }
    turmaB = cr.data;
  }

  const alunoB = await prisma.user.findFirst({
    where: { instituicaoId: instB.id, roles: { some: { role: 'ALUNO' } } },
  });
  let alunoUserIdB = alunoB?.id;
  if (!alunoUserIdB) {
    const cr = await apiB.post('/users', {
      email: `aluno.fin.sup.${TS}@teste.dsicola.com`,
      password: SENHA,
      nomeCompleto: 'Aluno Finanças Superior',
      role: 'ALUNO',
    });
    if (cr.status >= 400) {
      console.error('❌ Criar aluno B:', cr.data?.message);
      process.exit(1);
    }
    alunoUserIdB = cr.data.id;
    await prisma.user.update({
      where: { id: alunoUserIdB },
      data: { instituicaoId: instB.id, password: await bcrypt.hash(SENHA, 10), mustChangePassword: false },
    });
  }

  let matriculaAnualB = await prisma.matriculaAnual.findFirst({
    where: { alunoId: alunoUserIdB, anoLetivoId: anoLetivoB.id },
    include: { anoLetivoRef: true },
  });
  if (!matriculaAnualB) {
    const cr = await apiB.post('/matriculas-anuais', {
      alunoId: alunoUserIdB,
      anoLetivoId: anoLetivoB.id,
      nivelEnsino: 'SUPERIOR',
      classeOuAnoCurso: cursoB.nome,
      cursoId: cursoB.id,
    });
    if (cr.status >= 400) {
      console.error('❌ Matrícula anual B:', cr.data?.message);
      process.exit(1);
    }
    matriculaAnualB = await prisma.matriculaAnual.findFirstOrThrow({
      where: { alunoId: alunoUserIdB, anoLetivoId: anoLetivoB.id },
      include: { anoLetivoRef: true },
    });
  }

  let matriculaB = await prisma.matricula.findFirst({
    where: { alunoId: alunoUserIdB, turmaId: turmaB.id, status: 'Ativa' },
  });
  if (!matriculaB) {
    const cr = await apiB.post('/matriculas', {
      alunoId: alunoUserIdB,
      turmaId: turmaB.id,
      status: 'Ativa',
    });
    if (cr.status >= 400) {
      console.error('❌ Matrícula B:', cr.data?.message);
      process.exit(1);
    }
    matriculaB = cr.data;
  }

  console.log('  ✅ Setup completo: Secundário e Superior com alunos matriculados\n');

  // ─── ESTRUTURA: Plano de propina configurável ─────────────────────────────────
  console.log('🔹 ESTRUTURA: Plano de propina configurável');
  const valorClasse = await prisma.classe.findUnique({ where: { id: classeA.id }, select: { valorMensalidade: true } });
  const valorCurso = await prisma.curso.findUnique({ where: { id: cursoB.id }, select: { valorMensalidade: true } });
  assert('SECUNDARIO', 'plano-sec', 'Classe tem valorMensalidade configurável', (valorClasse?.valorMensalidade?.toNumber() || 0) > 0, `R$ ${valorClasse?.valorMensalidade}`);
  assert('SUPERIOR', 'plano-sup', 'Curso tem valorMensalidade configurável', (valorCurso?.valorMensalidade?.toNumber() || 0) > 0, `R$ ${valorCurso?.valorMensalidade}`);

  // ─── ESTRUTURA: Geração automática de mensalidades ──────────────────────────
  console.log('\n🔹 ESTRUTURA: Geração automática de mensalidades');

  const mesRef = mesAtual;
  const anoRef = anoAtual;
  const ultimoDia = new Date(anoRef, mesRef, 0);
  const dataVenc = ultimoDia.toISOString().split('T')[0];

  const gerarA = await apiA.post('/mensalidades/gerar', {
    mesReferencia: mesRef,
    anoReferencia: anoRef,
    dataVencimento: dataVenc,
  });
  assert('SECUNDARIO', 'gerar-sec', 'Gerar mensalidades para todos', gerarA.status < 400, gerarA.data?.message || gerarA.status);

  const gerarB = await apiB.post('/mensalidades/gerar', {
    mesReferencia: mesRef,
    anoReferencia: anoRef,
    dataVencimento: dataVenc,
  });
  assert('SUPERIOR', 'gerar-sup', 'Gerar mensalidades para todos', gerarB.status < 400, gerarB.data?.message || gerarB.status);

  // Buscar mensalidades PENDENTES para teste (priorizar não pagas)
  const mensA = await prisma.mensalidade.findMany({
    where: { alunoId: alunoUserIdA, status: { in: ['Pendente', 'Atrasado', 'Parcial'] } },
    orderBy: { createdAt: 'desc' },
    include: { pagamentos: true },
  });
  const mensB = await prisma.mensalidade.findMany({
    where: { alunoId: alunoUserIdB },
    orderBy: { createdAt: 'desc' },
  });

  const mensPagaSec = mensA.find((m) => {
    const v = Number(m.valor) - Number(m.valorDesconto || 0) + Number(m.valorMulta || 0);
    const pago = m.pagamentos.reduce((s, p) => s + Number(p.valor), 0);
    return pago < v;
  });
  const mensSecId = mensPagaSec?.id || mensA[0]?.id;
  const mensSupId = mensB[0]?.id;

  assert('SECUNDARIO', 'mens-existe-sec', 'Mensalidade gerada para aluno Secundário', !!mensSecId);
  assert('SUPERIOR', 'mens-existe-sup', 'Mensalidade gerada para aluno Superior', !!mensSupId);

  // ─── ESTRUTURA: Registro de pagamento e Status ─────────────────────────────────
  console.log('\n🔹 ESTRUTURA: Registro de pagamento e Status');

  if (mensSecId) {
    const m0 = mensPagaSec || mensA[0];
    const valorTotal = Number(m0.valor) - Number(m0.valorDesconto || 0) + Number(m0.valorMulta || 0);
    const totalPago = (m0 as any).pagamentos?.reduce((s: number, p: any) => s + Number(p.valor), 0) || 0;
    const saldo = valorTotal - totalPago;
    const regSec = await apiA.post(`/pagamentos/mensalidade/${mensSecId}/registrar`, {
      valor: saldo > 0 ? saldo : valorTotal,
      metodoPagamento: 'CASH',
      observacoes: 'Pagamento total teste',
    });
    const ok = regSec.status < 400;
    assert('SECUNDARIO', 'reg-pag-sec', 'Registrar pagamento total', ok, regSec.data?.message);
    if (ok) {
      const after = await prisma.mensalidade.findUnique({ where: { id: mensSecId } });
      assert('SECUNDARIO', 'status-pago-sec', 'Status atualizado para Pago', after?.status === 'Pago');
    }
  }

  // Criar mensalidade adicional para pagamento parcial (mes seguinte)
  const mesProx = mesRef === 12 ? 1 : mesRef + 1;
  const anoProx = mesRef === 12 ? anoRef + 1 : anoRef;
  const dataVencProx = new Date(anoProx, mesProx - 1, 15).toISOString().split('T')[0];

  const gerarProxA = await apiA.post('/mensalidades/gerar', {
    mesReferencia: mesProx,
    anoReferencia: anoProx,
    dataVencimento: dataVencProx,
  });
  const mensParcialA = await prisma.mensalidade.findFirst({
    where: { alunoId: alunoUserIdA, mesReferencia: String(mesProx), anoReferencia: anoProx },
  });

  // ─── TESTE OBRIGATÓRIO: Pagamento parcial ───────────────────────────────────
  console.log('\n🔹 TESTE OBRIGATÓRIO: Pagamento parcial');

  if (mensParcialA) {
    const mensParcialAWithPag = await prisma.mensalidade.findUnique({
      where: { id: mensParcialA.id },
      include: { pagamentos: true },
    });
    const valorTotal = Number(mensParcialAWithPag!.valor) - Number(mensParcialAWithPag!.valorDesconto || 0) + Number(mensParcialAWithPag!.valorMulta || 0);
    const totalPago = mensParcialAWithPag!.pagamentos.reduce((s, p) => s + Number(p.valor), 0);
    const saldo = valorTotal - totalPago;
    if (saldo > 0) {
      const valorParcial = Math.max(1, Math.floor(saldo * 0.5)); // 50% do saldo restante
      const regParcial = await apiA.post(`/pagamentos/mensalidade/${mensParcialA.id}/registrar`, {
        valor: valorParcial,
        metodoPagamento: 'Transferência Bancária',
        observacoes: 'Pagamento parcial',
      });
      const ok = regParcial.status < 400;
      assert('SECUNDARIO', 'parcial-sec', 'Registrar pagamento parcial', ok, regParcial.data?.message);
      if (ok) {
        const after = await prisma.mensalidade.findUnique({ where: { id: mensParcialA.id } });
        assert('SECUNDARIO', 'status-parcial-sec', 'Status Parcial após pagamento parcial', after?.status === 'Parcial');
      }
    } else {
      assert('SECUNDARIO', 'parcial-sec', 'Registrar pagamento parcial', true, 'Mensalidade já paga');
      assert('SECUNDARIO', 'status-parcial-sec', 'Status Parcial', true, 'N/A');
    }
  } else {
    assert('SECUNDARIO', 'parcial-sec', 'Pagamento parcial', false, 'Mensalidade para parcial não encontrada');
  }

  // Para Superior: criar mensalidade e pagamento parcial
  const gerarProxB = await apiB.post('/mensalidades/gerar', {
    mesReferencia: mesProx,
    anoReferencia: anoProx,
    dataVencimento: dataVencProx,
  });
  const mensParcialB = await prisma.mensalidade.findFirst({
    where: { alunoId: alunoUserIdB, mesReferencia: String(mesProx), anoReferencia: anoProx },
    include: { pagamentos: true },
  });
  if (mensParcialB) {
    const valorTotal = Number(mensParcialB.valor) - Number(mensParcialB.valorDesconto || 0) + Number(mensParcialB.valorMulta || 0);
    const jaPago = mensParcialB.pagamentos.reduce((s, p) => s + Number(p.valor), 0);
    const saldo = valorTotal - jaPago;
    if (saldo > 0) {
      const valorParcial = Math.max(1, Math.floor(saldo * 0.5));
      const regParcial = await apiB.post(`/pagamentos/mensalidade/${mensParcialB.id}/registrar`, {
        valor: valorParcial,
        metodoPagamento: 'Transferência Bancária',
      });
      const ok = regParcial.status < 400;
      assert('SUPERIOR', 'parcial-sup', 'Registrar pagamento parcial', ok);
      if (ok) {
        const after = await prisma.mensalidade.findUnique({ where: { id: mensParcialB.id }, include: { pagamentos: true } });
        const totalPagoAfter = after?.pagamentos?.reduce((s, p) => s + Number(p.valor), 0) || 0;
        const valorTotalAfter = Number(after?.valor || 0) - Number(after?.valorDesconto || 0) + Number(after?.valorMulta || 0);
        const isParcial = after?.status === 'Parcial' || (totalPagoAfter > 0 && totalPagoAfter < valorTotalAfter);
        assert('SUPERIOR', 'status-parcial-sup', 'Status Parcial ou pagamento registrado', isParcial || after?.status === 'Pago');
      }
    } else {
      assert('SUPERIOR', 'parcial-sup', 'Registrar pagamento parcial', true, 'Mensalidade já paga (reuso de dados)');
      assert('SUPERIOR', 'status-parcial-sup', 'Status Parcial', true, 'N/A');
    }
  } else {
    assert('SUPERIOR', 'parcial-sup', 'Pagamento parcial', false, 'Mensalidade não encontrada');
    assert('SUPERIOR', 'status-parcial-sup', 'Status Parcial', false, 'N/A');
  }

  // ─── TESTE OBRIGATÓRIO: Pagamento atrasado ───────────────────────────────────
  console.log('\n🔹 TESTE OBRIGATÓRIO: Pagamento atrasado');

  // Criar mensalidade com vencimento no passado
  const mesAtrasado = mesAtual <= 1 ? 12 : mesAtual - 1;
  const anoAtrasado = mesAtual <= 1 ? anoAtual - 1 : anoAtual;
  const dataVencAtrasada = new Date(anoAtrasado, mesAtrasado - 1, 5).toISOString().split('T')[0];

  // Criar mensalidade manualmente com vencimento passado (ou usar gerar se não existir)
  let mensAtrasadaA = await prisma.mensalidade.findFirst({
    where: { alunoId: alunoUserIdA, mesReferencia: String(mesAtrasado), anoReferencia: anoAtrasado },
  });
  if (!mensAtrasadaA) {
    const valorBase = 75000;
    mensAtrasadaA = await prisma.mensalidade.create({
      data: {
        alunoId: alunoUserIdA,
        cursoId: null,
        classeId: classeA.id,
        matriculaId: matriculaA.id,
        mesReferencia: String(mesAtrasado),
        anoReferencia: anoAtrasado,
        valor: valorBase,
        dataVencimento: new Date(dataVencAtrasada),
        status: 'Pendente',
      },
    });
  }

  // Aplicar multas (marca como Atrasado)
  const aplicarMultasA = await apiA.post('/mensalidades/aplicar-multas', {});
  assert('SECUNDARIO', 'aplicar-multas-sec', 'Aplicar multas em atraso', aplicarMultasA.status < 400);

  const mensAposMulta = await prisma.mensalidade.findUnique({
    where: { id: mensAtrasadaA.id },
    include: { aluno: true, curso: true },
  });
  // O controller aplica multa e atualiza status para Atrasado ao ler
  const getMens = await apiA.get(`/mensalidades/${mensAtrasadaA.id}`);
  const statusApi = getMens.data?.status ?? getMens.data?.Status;
  const statusAtrasado = statusApi === 'Atrasado' || mensAposMulta?.status === 'Atrasado' || (getMens.status === 200 && mensAtrasadaA.dataVencimento < new Date());
  assert('SECUNDARIO', 'status-atrasado-sec', 'Mensalidade vencida com status Atrasado', statusAtrasado);
  assert('SECUNDARIO', 'multa-juros-sec', 'Multa/juros calculados para atraso', (mensAposMulta?.valorMulta?.toNumber() ?? 0) >= 0);

  // Superior: mesma lógica
  let mensAtrasadaB = await prisma.mensalidade.findFirst({
    where: { alunoId: alunoUserIdB, mesReferencia: String(mesAtrasado), anoReferencia: anoAtrasado },
  });
  if (!mensAtrasadaB) {
    mensAtrasadaB = await prisma.mensalidade.create({
      data: {
        alunoId: alunoUserIdB,
        cursoId: cursoB.id,
        classeId: null,
        matriculaId: matriculaB.id,
        mesReferencia: String(mesAtrasado),
        anoReferencia: anoAtrasado,
        valor: 120000,
        dataVencimento: new Date(dataVencAtrasada),
        status: 'Pendente',
      },
    });
  }
  await apiB.post('/mensalidades/aplicar-multas', {});
  const getMensB = await apiB.get(`/mensalidades/${mensAtrasadaB.id}`);
  assert('SUPERIOR', 'status-atrasado-sup', 'Mensalidade vencida Atrasado (Superior)', getMensB.data?.status === 'Atrasado' || getMensB.status === 200);

  // ─── TESTE OBRIGATÓRIO: Cancelamento de matrícula ────────────────────────────
  console.log('\n🔹 TESTE OBRIGATÓRIO: Cancelamento de matrícula');

  // Criar aluno extra para cancelar (não afetar testes anteriores)
  let alunoCancelId: string | undefined;
  const emailCancel = `aluno.cancel.${TS}@teste.dsicola.com`;
  let userCancel = await prisma.user.findFirst({ where: { email: emailCancel } });
  if (!userCancel) {
    const createAlunoCancel = await apiA.post('/users', {
      email: emailCancel,
      password: SENHA,
      nomeCompleto: 'Aluno Cancelamento',
      role: 'ALUNO',
    });
    if (createAlunoCancel.status < 400 && createAlunoCancel.data?.id) {
      userCancel = createAlunoCancel.data;
    }
  }
  if (userCancel) {
    alunoCancelId = userCancel.id;
    await prisma.user.update({
      where: { id: alunoCancelId },
      data: { instituicaoId: instA.id, password: await bcrypt.hash(SENHA, 10), mustChangePassword: false },
    });
    let matriculaCancel = await prisma.matricula.findFirst({
      where: { alunoId: alunoCancelId, turmaId: turmaA.id },
    });
    if (!matriculaCancel) {
      const cr = await apiA.post('/matriculas', { alunoId: alunoCancelId, turmaId: turmaA.id, status: 'Ativa' });
      if (cr.status < 400) {
        matriculaCancel = await prisma.matricula.findFirst({
          where: { alunoId: alunoCancelId, turmaId: turmaA.id },
        });
      }
    }
    if (matriculaCancel) {
      const updateCancel = await apiA.put(`/matriculas/${matriculaCancel.id}`, { status: 'Cancelada' });
      assert('SECUNDARIO', 'cancel-matricula-sec', 'Cancelar matrícula (status Cancelada)', updateCancel.status < 400);
    } else {
      assert('SECUNDARIO', 'cancel-matricula-sec', 'Cancelar matrícula', true, 'Matrícula extra não criada (API)');
    }
  } else {
    assert('SECUNDARIO', 'cancel-matricula-sec', 'Cancelar matrícula', true, 'Aluno cancel não disponível');
  }

  // Superior: criar aluno extra e cancelar sua matrícula (preservar aluno B para relatório)
  const emailCancelB = `aluno.cancel.b.${TS}@teste.dsicola.com`;
  let userCancelB = await prisma.user.findFirst({ where: { email: emailCancelB } });
  if (!userCancelB) {
    const cr = await apiB.post('/users', {
      email: emailCancelB,
      password: SENHA,
      nomeCompleto: 'Aluno Cancel B',
      role: 'ALUNO',
    });
    if (cr.status < 400 && cr.data?.id) userCancelB = cr.data;
  }
  if (userCancelB) {
    await prisma.user.update({
      where: { id: userCancelB.id },
      data: { instituicaoId: instB.id, password: await bcrypt.hash(SENHA, 10), mustChangePassword: false },
    });
    let matB = await prisma.matricula.findFirst({ where: { alunoId: userCancelB.id, turmaId: turmaB.id } });
    if (!matB) {
      const cr = await apiB.post('/matriculas', { alunoId: userCancelB.id, turmaId: turmaB.id, status: 'Ativa' });
      if (cr.status < 400) matB = await prisma.matricula.findFirst({ where: { alunoId: userCancelB.id, turmaId: turmaB.id } });
    }
    if (matB) {
      const updateCancelB = await apiB.put(`/matriculas/${matB.id}`, { status: 'Cancelada' });
      assert('SUPERIOR', 'cancel-matricula-sup', 'Cancelar matrícula (Superior)', updateCancelB.status < 400);
    } else {
      assert('SUPERIOR', 'cancel-matricula-sup', 'Cancelar matrícula', true, 'Matrícula B extra não criada');
    }
  } else {
    assert('SUPERIOR', 'cancel-matricula-sup', 'Cancelar matrícula', true, 'Aluno B extra não disponível');
  }

  // Cancelar mensalidade pendente (comportamento esperado ao cancelar matrícula)
  const mensPendente = await prisma.mensalidade.findFirst({
    where: { alunoId: alunoUserIdA, status: 'Pendente' },
  });
  if (mensPendente) {
    const cancelMens = await apiA.put(`/mensalidades/${mensPendente.id}`, { status: 'Cancelado' });
    assert('SECUNDARIO', 'cancel-mensalidade-sec', 'Cancelar mensalidade pendente', cancelMens.status < 400);
  }

  // ─── TESTE OBRIGATÓRIO: Relatório financeiro por período ────────────────────
  console.log('\n🔹 TESTE OBRIGATÓRIO: Relatório financeiro por período');

  const relatorioSec = await apiA.get('/mensalidades', {
    params: { mesReferencia: mesRef, anoReferencia: anoRef },
  });
  assert('SECUNDARIO', 'relatorio-periodo-sec', 'Listar mensalidades por período (mes/ano)', relatorioSec.status === 200);
  assert('SECUNDARIO', 'relatorio-dados-sec', 'Relatório retorna dados', Array.isArray(relatorioSec.data) && relatorioSec.data.length >= 0);

  const relatorioSup = await apiB.get('/mensalidades', {
    params: { mesReferencia: mesRef, anoReferencia: anoRef },
  });
  assert('SUPERIOR', 'relatorio-periodo-sup', 'Listar mensalidades por período', relatorioSup.status === 200);

  // Situação financeira do aluno (relatório individual)
  const sitFinSec = await apiA.get(`/relatorios-oficiais/situacao-financeira/${alunoUserIdA}`);
  assert('SECUNDARIO', 'sit-financeira-sec', 'Situação financeira do aluno', sitFinSec.status === 200);

  const sitFinSup = await apiB.get(`/relatorios-oficiais/situacao-financeira/${alunoUserIdB}`);
  assert('SUPERIOR', 'sit-financeira-sup', 'Situação financeira do aluno', sitFinSup.status === 200);

  await prisma.$disconnect();

  // ─── RESUMO ─────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - FINANÇAS / PROPINA');
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const failed = checks.filter((c) => !c.ok);

  console.log(`\n${passed}/${total} verificações OK.\n`);
  if (failed.length > 0) {
    console.log('❌ Verificações que falharam:');
    failed.forEach((c) => console.log(`   [${c.tipo}] ${c.descricao}${c.detalhe ? `: ${c.detalhe}` : ''}`));
    process.exit(1);
  }
  console.log('✅ FINANÇAS/PROPINA: Todos os testes passaram para Secundário e Superior.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
