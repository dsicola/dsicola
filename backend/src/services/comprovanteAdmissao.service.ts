/**
 * Comprovante de Admissão de Funcionário
 * Geração de PDF A4 profissional com numeração sequencial ADM-YYYY-NNNNNN
 */
import prisma from '../lib/prisma.js';
import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler.js';
import { Decimal } from '@prisma/client/runtime/library';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/**
 * Gera número sequencial ADM-YYYY-NNNNNN por instituição (transação para evitar colisão).
 * Retorna o número e registra a emissão na mesma transação.
 */
export async function gerarERegistrarNumeroAdmissao(
  instituicaoId: string,
  funcionarioId: string,
  emitidoPorId: string
): Promise<string> {
  const ano = new Date().getFullYear();
  const prefixo = `ADM-${ano}-`;

  return await prisma.$transaction(async (tx) => {
    const ultimo = await tx.comprovanteAdmissao.findFirst({
      where: {
        instituicaoId,
        numero: { startsWith: prefixo },
      },
      orderBy: { numero: 'desc' },
    });

    let proximoNumero = 1;
    if (ultimo) {
      const match = ultimo.numero.match(/\d+$/);
      proximoNumero = match ? parseInt(match[0], 10) + 1 : 1;
    }

    const numero = `${prefixo}${String(proximoNumero).padStart(6, '0')}`;

    await tx.comprovanteAdmissao.create({
      data: {
        instituicaoId,
        funcionarioId,
        numero,
        emitidoPorId,
      },
    });

    return numero;
  });
}

/**
 * Gera PDF do Comprovante de Admissão
 */
export async function gerarPDFComprovanteAdmissao(
  funcionarioId: string,
  instituicaoId: string,
  emitidoPorId: string,
  operadorNome: string
): Promise<{ pdfBuffer: Buffer; numeroDocumento: string }> {
  // Buscar funcionário com relações (multi-tenant: validar instituição)
  const funcionario = await prisma.funcionario.findFirst({
    where: {
      id: funcionarioId,
      instituicaoId,
    },
    include: {
      cargo: true,
      departamento: true,
      instituicao: {
        include: {
          configuracao: true,
        },
      },
    },
  });

  if (!funcionario) {
    throw new AppError('Funcionário não encontrado ou acesso negado', 404);
  }

  if (funcionario.instituicaoId !== instituicaoId) {
    throw new AppError('Funcionário não pertence à sua instituição', 403);
  }

  // Gerar número sequencial e registrar emissão em transação (evita colisão)
  const numeroDocumento = await gerarERegistrarNumeroAdmissao(
    instituicaoId,
    funcionarioId,
    emitidoPorId
  );

  // NIF da instituição (ConfiguracaoInstituicao)
  const nif = funcionario.instituicao?.configuracao?.nif || '';

  // Formatar tipo de vínculo
  const tipoVinculo = funcionario.tipoVinculo
    ? funcionario.tipoVinculo === 'EFETIVO'
      ? 'Efetivo'
      : funcionario.tipoVinculo === 'CONTRATADO'
        ? 'Contrato'
        : funcionario.tipoVinculo === 'TEMPORARIO'
          ? 'Temporário'
          : String(funcionario.tipoVinculo)
    : 'Não informado';

  // Salário base (opcional - conforme política)
  const salarioBase = funcionario.salarioBase != null
    ? `Kz ${Number(funcionario.salarioBase).toLocaleString('pt-AO')}`
    : 'Conforme política interna';

  const dataAdmissao = funcionario.dataAdmissao
    ? new Date(funcionario.dataAdmissao).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';

  const dataEmissao = new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Gerar PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    const instituicaoNome = funcionario.instituicao?.nome || 'Instituição de Ensino';
    const cargoNome = funcionario.cargo?.nome || '-';
    const departamentoNome = funcionario.departamento?.nome || '-';

    // Cabeçalho
    doc.fontSize(18).font('Helvetica-Bold').text(instituicaoNome, { align: 'center' });
    if (nif) {
      doc.fontSize(10).font('Helvetica').text(`NIF: ${nif}`, { align: 'center' });
    }
    doc.moveDown(2);

    // Título
    doc.fontSize(16).font('Helvetica-Bold').text('COMPROVANTE DE ADMISSÃO', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica').text(`Nº ${numeroDocumento}`, { align: 'right' });
    doc.moveDown(2);

    // Conteúdo
    doc.fontSize(11).font('Helvetica');
    const campos = [
      ['Nome completo:', funcionario.nomeCompleto],
      ['Nº do funcionário:', funcionario.numeroIdentificacao || '-'],
      ['Cargo:', cargoNome],
      ['Departamento:', departamentoNome],
      ['Tipo de vínculo:', tipoVinculo],
      ['Data de admissão:', dataAdmissao],
      ['Salário base:', salarioBase],
      ['Data de emissão:', dataEmissao],
      ['Emitido por:', operadorNome],
    ];

    campos.forEach(([label, valor]) => {
      doc.font('Helvetica-Bold').text(String(label), { continued: true });
      doc.font('Helvetica').text(` ${valor}`);
    });

    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica').text('_________________________________', { align: 'center' });
    doc.text('Assinatura institucional', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(8).text(`Documento gerado em ${new Date().toLocaleString('pt-AO')} - ${numeroDocumento}`, {
      align: 'center',
    });

    doc.end();
  });

  return { pdfBuffer: Buffer.concat(chunks), numeroDocumento };
}
