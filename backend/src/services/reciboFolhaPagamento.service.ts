/**
 * Recibo de Folha de Pagamento - geração de PDF e envio por e-mail
 * Usado ao marcar como pago ou ao fechar a folha (opção "Enviar recibo por e-mail").
 */
import { Request } from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma.js';
import { EmailService } from './email.service.js';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getMesNome(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}

function formatValorAO(value: number): string {
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Valor por extenso em português (Kwanzas) - simplificado */
function valorPorExtenso(valor: number): string {
  const unidade = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezena1 = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
  const dezena2 = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centena = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const int = Math.floor(valor);
  const dec = Math.round((valor - int) * 100);
  let n = int;
  const partes: string[] = [];

  const aux = (num: number): void => {
    if (num >= 1000000) {
      const m = Math.floor(num / 1000000);
      partes.push(m === 1 ? 'um milhão' : `${valorPorExtenso(m)} milhões`);
      num %= 1000000;
      if (num > 0) partes.push('e');
      aux(num);
      return;
    }
    if (num >= 1000) {
      const mil = Math.floor(num / 1000);
      partes.push(mil === 1 ? 'mil' : `${valorPorExtenso(mil)} mil`);
      num %= 1000;
      if (num > 0) partes.push('e');
      aux(num);
      return;
    }
    if (num >= 100) {
      const c = Math.floor(num / 100);
      partes.push(c === 1 && num % 100 === 0 ? 'cem' : centena[c]);
      num %= 100;
      if (num > 0) partes.push('e');
    }
    if (num >= 20) {
      const d = Math.floor(num / 10);
      partes.push(dezena2[d]);
      num %= 10;
      if (num > 0) partes.push('e');
    }
    if (num >= 10) {
      partes.push(dezena1[num - 10]);
      return;
    }
    if (num > 0) partes.push(unidade[num]);
  };

  if (n === 0) partes.push('zero');
  else aux(n);

  const extenso = partes.join(' ').replace(/\s+/g, ' ').trim();
  const moeda = ' Kwanzas';
  const resultado = dec > 0 ? `${extenso}${moeda} e ${dec}/100` : `${extenso}${moeda}`;
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}

export interface DadosReciboFolha {
  instituicaoNome: string;
  instituicaoEndereco?: string | null;
  funcionarioNome: string;
  funcionarioNumeroId: string | null;
  funcionarioCargo: string | null;
  funcionarioEmail: string | null;
  mes: number;
  ano: number;
  salarioBase: number;
  bonus: number;
  valorHorasExtras: number;
  beneficioTransporte: number;
  beneficioAlimentacao: number;
  outrosBeneficios: number;
  descontosFaltas: number;
  inss: number;
  irt: number;
  outrosDescontos: number;
  salarioLiquido: number;
  reciboNumero: string;
}

/**
 * Gera o buffer PDF do recibo de folha de pagamento (uma página A4).
 */
export function gerarPDFReciboFolha(dados: DadosReciboFolha): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PDFKit typings não incluem text(text,x,y,options) nem rect(x,y,w,h)
    const doc: any = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 50;
    const pageWidth = 595.28 - margin * 2; // A4 width in points
    let yPos = 30;

    // Cabeçalho — modelo recibo salarial
    doc.fontSize(16).font('Helvetica-Bold').fillColor(0.12, 0.25, 0.69).text(dados.instituicaoNome.toUpperCase(), margin, yPos);
    yPos += 22;

    doc.fontSize(13).font('Helvetica-Bold').fillColor(0.12, 0.25, 0.69).text('RECIBO SALARIAL', margin, yPos);
    doc.fontSize(9).font('Helvetica').fillColor(0.4, 0.4, 0.4).text(`Nº ${dados.reciboNumero}`, margin + pageWidth - 30, yPos - 2, { width: 80, align: 'right' });
    doc.fontSize(9).text(`${getMesNome(dados.mes)} / ${dados.ano}`, margin + pageWidth - 30, yPos + 6, { width: 80, align: 'right' });
    yPos += 26;

    doc.fontSize(10).font('Helvetica').fillColor(0, 0, 0);
    doc.font('Helvetica-Bold').text('Pagamento efetuado a', margin, yPos);
    doc.font('Helvetica').text(`${getMesNome(dados.mes)}/${dados.ano}`, margin + pageWidth - 30, yPos, { width: 80, align: 'right' });
    yPos += 18;

    doc.text(`FUNCIONÁRIO: ${dados.funcionarioNome}`, margin, yPos);
    yPos += 7;
    doc.text(`Nº: ${dados.funcionarioNumeroId?.trim() || '-'}`, margin, yPos);
    yPos += 7;
    if (dados.funcionarioCargo) {
      doc.text(`CARGO: ${dados.funcionarioCargo}`, margin, yPos);
      yPos += 7;
    }
    if (dados.funcionarioEmail) {
      doc.text(`EMAIL: ${dados.funcionarioEmail}`, margin, yPos);
      yPos += 7;
    }
    yPos += 10;

    // Tabela
    const tableCols = [100, 45, 20, 50];
    const tableX = margin;
    const tableWidth = pageWidth;

    doc.rect(tableX, yPos, tableWidth, 10).fillAndStroke(0.9, 0.94, 1, 0.9, 0.9, 0.9);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(0.12, 0.25, 0.69);
    doc.text('Descrição', tableX + 4, yPos + 7);
    doc.text('Ref.', tableX + 4 + tableCols[0], yPos + 7);
    doc.text('Qtd', tableX + 4 + tableCols[0] + tableCols[1], yPos + 7);
    doc.text('Valor (AO)', tableX + tableWidth - 4, yPos + 7, { align: 'right' });
    yPos += 10;

    const f = {
      salario_base: dados.salarioBase,
      bonus: dados.bonus,
      valor_horas_extras: dados.valorHorasExtras,
      beneficio_transporte: dados.beneficioTransporte,
      beneficio_alimentacao: dados.beneficioAlimentacao,
      outros_beneficios: dados.outrosBeneficios,
      descontos_faltas: dados.descontosFaltas,
      inss: dados.inss,
      irt: dados.irt,
      outros_descontos: dados.outrosDescontos,
      salario_liquido: dados.salarioLiquido,
    };

    const addRow = (desc: string, valor: number) => {
      doc.moveTo(tableX, yPos).lineTo(tableX + tableWidth, yPos).stroke(0.9, 0.9, 0.9);
      doc.font('Helvetica').fillColor(0, 0, 0);
      doc.fontSize(9).text(desc, tableX + 4, yPos + 6);
      doc.text('-', tableX + 4 + tableCols[0], yPos + 6);
      doc.text('1', tableX + 4 + tableCols[0] + tableCols[1], yPos + 6);
      doc.text(formatValorAO(valor), tableX + tableWidth - 4, yPos + 6, { align: 'right' });
      yPos += 8;
    };

    if (f.salario_base > 0) addRow('Salário Base', f.salario_base);
    if (f.bonus > 0) addRow('Bônus', f.bonus);
    if (f.valor_horas_extras > 0) addRow('Horas Extras', f.valor_horas_extras);
    if (f.beneficio_transporte > 0) addRow('Benefício Transporte', f.beneficio_transporte);
    if (f.beneficio_alimentacao > 0) addRow('Benefício Alimentação', f.beneficio_alimentacao);
    if (f.outros_beneficios > 0) addRow('Outros Benefícios', f.outros_beneficios);
    if (f.descontos_faltas > 0) addRow('Desconto por Faltas', -f.descontos_faltas);
    if (f.inss > 0) addRow('INSS', -f.inss);
    if (f.irt > 0) addRow('IRT', -f.irt);
    if (f.outros_descontos > 0) addRow('Outros Descontos', -f.outros_descontos);

    doc.moveTo(tableX, yPos).lineTo(tableX + tableWidth, yPos).stroke(0.8, 0.8, 0.8);
    yPos += 2;
    doc.font('Helvetica-Bold').text('Líquido a receber', tableX + 4, yPos + 7);
    doc.fontSize(11).text(formatValorAO(f.salario_liquido), tableX + tableWidth - 4, yPos + 7, { align: 'right' });
    doc.fontSize(9);
    yPos += 18;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(0.15, 0.15, 0.15).text(valorPorExtenso(f.salario_liquido), margin, yPos);
    yPos += 20;

    // Rodapé — instituição, número do recibo e endereço (modelo profissional)
    const footerY = 842 - 50;
    doc.moveTo(margin, footerY - 5).lineTo(595.28 - margin, footerY - 5).stroke(0.86, 0.86, 0.86);
    doc.fontSize(8).font('Helvetica').fillColor(0.4, 0.4, 0.4);
    doc.text(`${dados.instituicaoNome} • ${dados.reciboNumero}`, margin, footerY + 4, { align: 'center', width: 495.28 });
    if (dados.instituicaoEndereco?.trim()) {
      doc.fontSize(7).fillColor(0.45, 0.45, 0.45);
      doc.text(dados.instituicaoEndereco.trim(), margin, footerY + 14, { align: 'center', width: 495.28 });
    }

    doc.end();
  });
}

export interface ResultadoEnvioRecibo {
  enviado: boolean;
  motivo?: string;
}

/**
 * Envia o recibo da folha por e-mail ao funcionário (e-mail obtido do cadastro).
 * Não lança erro: falhas são logadas e retornadas em resultado.
 * Atualiza reciboEnviadoEm/reciboEnviadoPor apenas quando o envio for bem-sucedido.
 */
export async function enviarReciboFolhaPorEmail(
  req: Request | null,
  folhaId: string,
  userId: string,
  instituicaoId: string
): Promise<ResultadoEnvioRecibo> {
  try {
    const folha = await prisma.folhaPagamento.findFirst({
      where: {
        id: folhaId,
        funcionario: { instituicaoId },
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacao: true,
            cargo: { select: { nome: true } },
          },
        },
      },
    });

    if (!folha) {
      return { enviado: false, motivo: 'Folha não encontrada' };
    }

    const emailFunc = folha.funcionario.email?.trim();
    if (!emailFunc) {
      return { enviado: false, motivo: 'Funcionário sem e-mail cadastrado' };
    }

    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { nome: true },
    });
    const config = await prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId },
      select: { endereco: true, telefone: true, email: true },
    });

    const dados: DadosReciboFolha = {
      instituicaoNome: instituicao?.nome ?? 'Instituição',
      instituicaoEndereco: config?.endereco?.trim() || null,
      funcionarioNome: folha.funcionario.nomeCompleto,
      funcionarioNumeroId: folha.funcionario.numeroIdentificacao,
      funcionarioCargo: folha.funcionario.cargo?.nome ?? null,
      funcionarioEmail: folha.funcionario.email,
      mes: folha.mes,
      ano: folha.ano,
      salarioBase: Number(folha.salarioBase),
      bonus: Number(folha.bonus),
      valorHorasExtras: Number(folha.valorHorasExtras),
      beneficioTransporte: Number(folha.beneficioTransporte),
      beneficioAlimentacao: Number(folha.beneficioAlimentacao),
      outrosBeneficios: Number(folha.outrosBeneficios),
      descontosFaltas: Number(folha.descontosFaltas),
      inss: Number(folha.inss),
      irt: Number(folha.irt),
      outrosDescontos: Number(folha.outrosDescontos),
      salarioLiquido: Number(folha.salarioLiquido),
      reciboNumero: `REC-${folha.mes}${folha.ano}-${folha.id.substring(0, 6)}`,
    };

    const pdfBuffer = await gerarPDFReciboFolha(dados);
    const nomeArquivo = `recibo-${folha.funcionario.nomeCompleto.replace(/\s+/g, '_')}-${folha.mes}-${folha.ano}.pdf`;

    const mesNome = getMesNome(folha.mes);
    const result = await EmailService.sendEmail(
      req,
      emailFunc,
      'RECIBO_FOLHA_PAGAMENTO',
      {
        nomeFuncionario: folha.funcionario.nomeCompleto,
        mesNome,
        ano: folha.ano,
        mesAno: `${mesNome}/${folha.ano}`,
        reciboNumero: dados.reciboNumero,
        enderecoInstituicao: config?.endereco?.trim() || null,
        nomeInstituicao: instituicao?.nome ?? undefined,
      },
      {
        destinatarioNome: folha.funcionario.nomeCompleto,
        instituicaoId,
        attachments: [{ filename: nomeArquivo, content: pdfBuffer }],
      }
    );

    if (!result.success) {
      console.warn('[ReciboFolha] Falha ao enviar e-mail:', result.error);
      return { enviado: false, motivo: result.error ?? 'Falha no envio do e-mail' };
    }

    await prisma.folhaPagamento.update({
      where: { id: folhaId },
      data: {
        reciboEnviadoEm: new Date(),
        reciboEnviadoPor: userId,
      },
    });

    return { enviado: true };
  } catch (err: any) {
    console.error('[ReciboFolha] Erro ao enviar recibo por e-mail:', err);
    return { enviado: false, motivo: err?.message ?? 'Erro inesperado' };
  }
}
