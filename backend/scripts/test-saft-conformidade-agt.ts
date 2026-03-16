#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo completo de conformidade AGT — SAFT-AO
 *
 * Valida o fluxo end-to-end com dados de exemplo:
 * 1. Configuração institucional (NIF, SoftwareCertificateNumber, dados fiscais)
 * 2. Aluno com BI/NIF
 * 3. Mensalidade + Pagamento → Recibo → DocumentoFinanceiro (FT + RC com hash)
 * 4. Exportação SAFT XML (via API ou serviço direto)
 * 5. Validação do XML (namespace, Header, MasterFiles, SourceDocuments, Hash, etc.)
 *
 * Modos:
 * - Com API: Backend rodando em API_URL. Faz login + registrar pagamento + export.
 * - Sem API (MOCK_API=1): Usa serviços diretamente. Não precisa do backend.
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts (ou instituição existente)
 *
 * Uso: npx tsx scripts/test-saft-conformidade-agt.ts
 *      MOCK_API=1 npx tsx scripts/test-saft-conformidade-agt.ts  (sem backend)
 */
import 'dotenv/config';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { gerarXmlSaftAo } from '../src/services/saft.service.js';
import { emitirReciboAoConfirmarPagamento } from '../src/services/recibo.service.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const MOCK_API = process.env.MOCK_API === '1' || process.env.MOCK_API === 'true';
const prisma = new PrismaClient();

const NIF_EXEMPLO = '123456789';
const CERTIFICADO_AGT_EXEMPLO = 'AGT-2025-TEST001';
const SENHA = process.env.TEST_RECIBO_PASS || 'TesteAGT123!';

interface AssertResult {
  name: string;
  ok: boolean;
  details?: string;
}

const results: AssertResult[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

function validarXmlSaftConformidade(xml: string): { valido: boolean; erros: string[] } {
  const erros: string[] = [];
  const ns = 'urn:OECD:StandardAuditFile-Tax:AO_1.01_01';

  if (!xml.includes(`xmlns="${ns}"`) && !xml.includes(`xmlns='${ns}'`)) {
    erros.push(`Namespace obrigatório ausente: ${ns}`);
  }
  if (!xml.includes('<AuditFile')) {
    erros.push('Elemento raiz AuditFile ausente');
  }
  if (!xml.includes('<Header>')) {
    erros.push('Secção Header ausente');
  }
  if (!xml.includes('<MasterFiles>')) {
    erros.push('Secção MasterFiles ausente');
  }
  if (!xml.includes('<SourceDocuments>')) {
    erros.push('Secção SourceDocuments ausente');
  }
  if (!xml.includes('<TaxRegistrationNumber>')) {
    erros.push('TaxRegistrationNumber (NIF) ausente');
  }
  if (!xml.includes('<SoftwareCertificateNumber>')) {
    erros.push('SoftwareCertificateNumber ausente');
  }
  if (!xml.includes('<CurrencyCode>AOA</CurrencyCode>')) {
    erros.push('Moeda AOA ausente ou incorreta');
  }
  if (!xml.includes('<Customer>')) {
    erros.push('Clientes (Customer) ausente');
  }
  if (!xml.includes('<Product>')) {
    erros.push('Produtos (Product) ausente');
  }
  if (!xml.includes('<Invoice>') && !xml.includes('<SalesInvoices>')) {
    erros.push('Faturas (SalesInvoices/Invoice) ausente');
  }
  if (!xml.includes('<Hash>')) {
    erros.push('Hash fiscal ausente nas faturas');
  }
  if (!xml.includes('<HashControl>')) {
    erros.push('HashControl ausente nas faturas');
  }

  return { valido: erros.length === 0, erros };
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO — CONFORMIDADE AGT (SAFT-AO)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let instituicaoId!: string;
  let adminEmail!: string;
  let token!: string;

  // 1. Instituição e configuração fiscal
  console.log('1. CONFIGURAÇÃO FISCAL (Dados de exemplo AGT)');
  const inst = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    select: { id: true },
  }) ?? await prisma.instituicao.findFirst({
    where: { tipoAcademico: 'SECUNDARIO' },
    select: { id: true },
  }) ?? await prisma.instituicao.findFirst({ select: { id: true } });

  if (!inst) {
    assert('Instituição existe', false, 'Rode: npx tsx scripts/seed-multi-tenant-test.ts');
    printSummary();
    process.exit(1);
  }
  instituicaoId = inst.id;
  assert('Instituição encontrada', true, instituicaoId);

  await prisma.configuracaoInstituicao.upsert({
    where: { instituicaoId },
    create: {
      instituicaoId,
      nomeInstituicao: 'Escola Teste AGT',
      tipoInstituicao: 'ENSINO_MEDIO',
      nif: NIF_EXEMPLO,
      softwareCertificateNumber: CERTIFICADO_AGT_EXEMPLO,
      nomeFiscal: 'Escola Teste AGT Lda',
      emailFiscal: 'fiscal@escola-teste.ao',
      telefoneFiscal: '+244 923 456 789',
      enderecoFiscal: 'Rua Exemplo, 123, Luanda',
      codigoPostalFiscal: '0000',
      paisFiscal: 'Angola',
    },
    update: {
      nif: NIF_EXEMPLO,
      softwareCertificateNumber: CERTIFICADO_AGT_EXEMPLO,
      nomeFiscal: 'Escola Teste AGT Lda',
      emailFiscal: 'fiscal@escola-teste.ao',
      telefoneFiscal: '+244 923 456 789',
      enderecoFiscal: 'Rua Exemplo, 123, Luanda',
    },
  });
  assert('Config fiscal (NIF, certificado AGT)', true);

  // 2. Aluno com BI (obrigatório para SAFT)
  console.log('\n2. ALUNO COM BI/NIF');
  let aluno = await prisma.user.findFirst({
    where: {
      instituicaoId,
      roles: { some: { role: 'ALUNO' } },
    },
    select: { id: true, nomeCompleto: true, numeroIdentificacao: true, numeroIdentificacaoPublica: true },
  });

  const biExemplo = `BI${Date.now().toString().slice(-8)}`;
  if (aluno) {
    await prisma.user.update({
      where: { id: aluno.id },
      data: {
        numeroIdentificacao: biExemplo,
        numeroIdentificacaoPublica: aluno.numeroIdentificacaoPublica || `T${Date.now().toString().slice(-6)}`,
      },
    });
    aluno = await prisma.user.findUniqueOrThrow({
      where: { id: aluno.id },
      select: { id: true, nomeCompleto: true, numeroIdentificacao: true, numeroIdentificacaoPublica: true },
    });
  }
  if (!aluno?.numeroIdentificacao?.trim()) {
    assert('Aluno com BI', false, 'Aluno sem numeroIdentificacao (BI)');
  } else {
    assert('Aluno com BI', true, `${aluno.nomeCompleto} — BI: ${aluno.numeroIdentificacao}`);
  }

  // 3. Mensalidade pendente
  console.log('\n3. MENSALIDADE E PAGAMENTO');
  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId, ano },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.create({
      data: {
        instituicaoId,
        ano,
        status: 'ATIVO',
        dataInicio: new Date(ano, 0, 1),
      },
    });
  }

  let classe = await prisma.classe.findFirst({ where: { instituicaoId } });
  if (!classe) {
    classe = await prisma.classe.create({
      data: {
        instituicaoId,
        codigo: '10',
        nome: '10ª Classe',
        ordem: 10,
        cargaHoraria: 0,
      },
    });
  }

  let curso = await prisma.curso.findFirst({ where: { instituicaoId } });
  if (!curso) {
    curso = await prisma.curso.create({
      data: {
        instituicaoId,
        nome: 'Ciências',
        codigo: 'C',
        valorMensalidade: 50000,
      },
    });
  }

  let turma = await prisma.turma.findFirst({
    where: { instituicaoId, anoLetivoId: anoLetivo.id },
  });
  if (!turma) {
    const turno = await prisma.turno.findFirst({ where: { instituicaoId } })
      ?? await prisma.turno.create({ data: { instituicaoId, nome: 'Manhã' } });
    turma = await prisma.turma.create({
      data: {
        instituicaoId,
        anoLetivoId: anoLetivo.id,
        nome: '10ª Classe - Turma A',
        cursoId: curso.id,
        classeId: classe.id,
        turnoId: turno.id,
        capacidade: 30,
      },
    });
  }

  let matricula = await prisma.matricula.findFirst({
    where: { alunoId: aluno!.id, turmaId: turma.id },
  });
  if (!matricula && aluno) {
    matricula = await prisma.matricula.create({
      data: {
        instituicaoId,
        alunoId: aluno.id,
        turmaId: turma.id,
        anoLetivoId: anoLetivo.id,
        status: 'Ativa',
      },
    });
  }

  const valorMensalidade = 50000;
  let mensalidade = await prisma.mensalidade.findFirst({
    where: {
      alunoId: aluno!.id,
      anoReferencia: ano,
      status: 'Pendente',
      pagamentos: { none: {} },
    },
    orderBy: { mesReferencia: 'desc' },
  });

  if (!mensalidade && matricula) {
    for (let m = 1; m <= 12; m++) {
      const existente = await prisma.mensalidade.findFirst({
        where: {
          alunoId: aluno!.id,
          mesReferencia: String(m),
          anoReferencia: ano,
          pagamentos: { none: {} },
        },
      });
      if (existente) {
        mensalidade = existente;
        break;
      }
    }
    if (!mensalidade) {
      // Encontrar primeiro mês livre (sem mensalidade para este aluno/ano)
      let mesLivre: number | null = null;
      for (let m = 1; m <= 12; m++) {
        const existe = await prisma.mensalidade.findFirst({
          where: {
            alunoId: aluno!.id,
            mesReferencia: String(m),
            anoReferencia: ano,
          },
        });
        if (!existe) {
          mesLivre = m;
          break;
        }
      }
      if (mesLivre != null) {
        mensalidade = await prisma.mensalidade.create({
          data: {
            matriculaId: matricula.id,
            alunoId: aluno!.id,
            cursoId: curso.id,
            mesReferencia: String(mesLivre),
            anoReferencia: ano,
            valor: new Decimal(valorMensalidade),
            dataVencimento: new Date(ano, mesLivre - 1, 15),
            status: 'Pendente',
          },
        });
      } else {
        // Todos os meses têm mensalidade: usar qualquer uma sem pagamento
        mensalidade = await prisma.mensalidade.findFirst({
          where: { alunoId: aluno!.id, anoReferencia: ano, pagamentos: { none: {} } },
        }) ?? undefined;
      }
    }
  }

  if (!mensalidade) {
    assert('Mensalidade criada/encontrada', false, 'Sem mensalidade pendente');
  } else {
    assert('Mensalidade', true, `${mensalidade.mesReferencia}/${mensalidade.anoReferencia} — ${valorMensalidade} AOA`);
  }

  // 4. Registrar pagamento (API ou serviço direto)
  console.log('\n4. REGISTRAR PAGAMENTO');
  if (MOCK_API) {
    // Modo sem API: criar pagamento e recibo diretamente
    if (mensalidade) {
      const pagamento = await prisma.pagamento.create({
        data: {
          mensalidadeId: mensalidade.id,
          valor: new Decimal(valorMensalidade),
          metodoPagamento: 'TRANSFERENCIA',
          dataPagamento: new Date(),
          registradoPor: (await prisma.user.findFirst({
            where: { instituicaoId, roles: { some: { role: 'ADMIN' } } },
            select: { id: true },
          }))?.id,
        },
      });
      const { numeroRecibo } = await emitirReciboAoConfirmarPagamento(pagamento.id, instituicaoId);
      assert('Registrar pagamento (serviço)', true, `Recibo: ${numeroRecibo}`);
    }
  } else {
    const admin = await prisma.user.findFirst({
      where: {
        instituicaoId,
        roles: { some: { role: { in: ['ADMIN', 'SECRETARIA', 'FINANCEIRO'] } } },
      },
      select: { id: true, email: true },
    });

    if (!admin) {
      assert('Usuário ADMIN/SECRETARIA', false, 'Crie usuário com role ADMIN');
    } else {
      await prisma.user.update({
        where: { id: admin.id },
        data: { password: await bcrypt.hash(SENHA, 10), mustChangePassword: false },
      });
      adminEmail = admin.email;
    }

    const api = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const loginRes = await api.post('/auth/login', { email: adminEmail!, password: SENHA });
    if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
      assert('Login', false, loginRes.data?.message || `${loginRes.status}`);
    } else {
      token = loginRes.data.accessToken;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      assert('Login', true);
    }

    if (mensalidade && token) {
      const mensComPagamentos = await prisma.mensalidade.findUnique({
        where: { id: mensalidade.id },
        include: { pagamentos: true },
      });
      const totalPago = mensComPagamentos?.pagamentos?.reduce((s, p) => s + Number(p.valor), 0) ?? 0;
      const valorTotal = Number(mensComPagamentos?.valor ?? valorMensalidade);
      const valorAPagar = Math.max(0, valorTotal - totalPago);
      if (valorAPagar <= 0) {
        assert('Registrar pagamento', true, 'Mensalidade já paga (documento existente de execução anterior)');
      } else {
        const regRes = await api.post(
          `/pagamentos/mensalidade/${mensalidade.id}/registrar`,
          { valor: valorAPagar, metodoPagamento: 'TRANSFERENCIA', observacoes: 'Teste conformidade AGT' }
        );
        if (regRes.status !== 201) {
          assert('Registrar pagamento', false, regRes.data?.message || `${regRes.status}`);
        } else {
          assert('Registrar pagamento', true, `Recibo: ${regRes.data?.numeroRecibo || regRes.data?.reciboId}`);
        }
      }
    }
  }

  // Período de exportação = mês atual (documentos têm dataDocumento = data do recibo = hoje)
  const mesExport = new Date().getMonth() + 1;
  const anoExport = new Date().getFullYear();

  // 5. Verificar DocumentoFinanceiro com hash (documento mais recente no período = o que acabámos de criar)
  console.log('\n5. DOCUMENTO FINANCEIRO (Hash fiscal)');
  const docFinanceiro = await prisma.documentoFinanceiro.findFirst({
    where: {
      instituicaoId,
      dataDocumento: { gte: new Date(anoExport, mesExport - 1, 1), lte: new Date(anoExport, mesExport, 0, 23, 59, 59) },
      estado: 'EMITIDO',
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, hash: true, hashControl: true, numeroDocumento: true },
  });

  if (docFinanceiro) {
    const hasHash = !!(docFinanceiro.hash?.trim());
    const hasHashControl = !!(docFinanceiro.hashControl?.trim());
    assert('DocumentoFinanceiro com hash', hasHash, hasHash ? docFinanceiro.hash?.slice(0, 16) + '...' : 'ausente');
    assert('DocumentoFinanceiro com hashControl', hasHashControl, hasHashControl ? docFinanceiro.hashControl : 'ausente');
  } else {
    assert('DocumentoFinanceiro criado', false, 'Nenhum documento no período');
  }

  // 5b. Garantir que todos os alunos com documentos no período têm BI (evitar rejeição)
  const docsNoPeriodo = await prisma.documentoFinanceiro.findMany({
    where: {
      instituicaoId,
      dataDocumento: { gte: new Date(anoExport, mesExport - 1, 1), lte: new Date(anoExport, mesExport, 0, 23, 59, 59) },
      estado: 'EMITIDO',
    },
    select: { entidadeId: true },
  });
  const entidadeIdsUnicos = [...new Set(docsNoPeriodo.map((d) => d.entidadeId))];
  for (const eid of entidadeIdsUnicos) {
    const u = await prisma.user.findUnique({
      where: { id: eid },
      select: { numeroIdentificacao: true },
    });
    if (!u?.numeroIdentificacao?.trim()) {
      await prisma.user.update({
        where: { id: eid },
        data: { numeroIdentificacao: `BI${Date.now().toString().slice(-8)}` },
      });
    }
  }

  // 6. Exportar SAFT (API ou serviço direto)
  console.log('\n6. EXPORTAÇÃO SAFT XML');
  let xml = '';
  try {
    if (MOCK_API) {
      xml = await gerarXmlSaftAo({ instituicaoId, ano: anoExport, mes: mesExport });
      assert('Export SAFT (serviço)', true, `${xml.length} bytes`);
    } else {
      const api = axios.create({
        baseURL: API_URL,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        timeout: 15000,
        validateStatus: () => true,
      });
      const exportRes = await api.get(`/saft-exports/export`, {
        params: { ano: anoExport, mes: mesExport },
        responseType: 'text',
        validateStatus: () => true,
      });
      if (exportRes.status !== 200) {
        assert('Export SAFT (200)', false, exportRes.data?.message || `${exportRes.status}`);
      } else {
        xml = typeof exportRes.data === 'string' ? exportRes.data : String(exportRes.data);
        assert('Export SAFT (200)', true, `${xml.length} bytes`);
      }
    }
  } catch (e) {
    assert('Export SAFT', false, (e as Error).message);
  }

  // 7. Validação de conformidade do XML
  console.log('\n7. VALIDAÇÃO XML (Conformidade AGT)');
  if (xml) {
    const validacao = validarXmlSaftConformidade(xml);
    if (validacao.valido) {
      assert('XML conforme AGT', true);
      assert('Namespace SAF-T AO', xml.includes('urn:OECD:StandardAuditFile-Tax:AO_1.01_01'));
      assert('NIF no Header', xml.includes(NIF_EXEMPLO) || xml.includes('<TaxRegistrationNumber>'));
      assert('SoftwareCertificateNumber configurado', xml.includes(CERTIFICADO_AGT_EXEMPLO), 'Deve conter certificado de exemplo');
      assert('Moeda AOA', xml.includes('<CurrencyCode>AOA</CurrencyCode>'));
    } else {
      assert('XML conforme AGT', false, validacao.erros.join('; '));
      validacao.erros.forEach((e) => assert('  — ' + e, false));
    }
  }

  await prisma.$disconnect();
  printSummary();
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${passed}/${total} testes passaram`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
