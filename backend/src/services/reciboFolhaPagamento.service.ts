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
  instituicaoNif?: string | null;
  funcionarioNome: string;
  funcionarioNumeroId: string | null;
  funcionarioCargo: string | null;
  funcionarioDepartamento: string | null;
  funcionarioEmail: string | null;
  mes: number;
  ano: number;
  diasUteis: number;
  valorDia: number;
  valorHora: number;
  dataFecho: string; // ex: 28/02/2026
  formaPagamento: string; // ex: Transferência
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
 * Gera o buffer PDF do recibo de folha (modelo Recibo de Vencimentos, estilo Primavera).
 */
export function gerarPDFReciboFolha(dados: DadosReciboFolha): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PDFKit typings
    const doc: any = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 50;
    const pageW = 595.28;
    const contentW = pageW - margin * 2;
    let y = 28;

    // 1. Nome da instituição (topo)
    doc.fontSize(14).font('Helvetica-Bold').fillColor(0, 0, 0).text(dados.instituicaoNome.toUpperCase(), margin, y);
    y += 8;
    if (dados.instituicaoEndereco?.trim()) {
      doc.fontSize(9).font('Helvetica').fillColor(0.3, 0.3, 0.3).text(dados.instituicaoEndereco.trim(), margin, y);
      y += 8;
    }
    // 2. Título "Recibo de Vencimentos"
    doc.fontSize(12).font('Helvetica-Bold').fillColor(0, 0, 0).text('Recibo de Vencimentos', margin, y);
    y += 8;
    // 3. NIF | NISS (quando existir)
    const nifNiss = `NIF ${dados.instituicaoNif?.trim() || '—'} | NISS —`;
    doc.fontSize(8).font('Helvetica').fillColor(0.4, 0.4, 0.4).text(nifNiss, margin, y);
    y += 8;
    // 4. Original + Nº do recibo (à direita)
    doc.fontSize(9).font('Helvetica').fillColor(0.3, 0.3, 0.3).text('Original', margin, y);
    doc.fontSize(9).font('Helvetica-Bold').text(dados.reciboNumero, margin + contentW - 90, y, { width: 90, align: 'right' });
    y += 14;

    // 5. Bloco funcionário: N.º Contrib. / N.º Benef. | Nome
    doc.fontSize(8).font('Helvetica').fillColor(0.4, 0.4, 0.4).text('N.º Contrib.', margin, y);
    doc.text(dados.funcionarioNumeroId?.trim() || '—', margin + 52, y);
    doc.text('N.º Benef.\tNome', margin + 120, y);
    doc.font('Helvetica-Bold').fillColor(0, 0, 0).text(dados.funcionarioNome, margin + 185, y);
    y += 8;
    // N.º Mecan. | N.º Dias Úteis | Venc./Hora | Vencimento | Data Fecho | Período
    doc.font('Helvetica').fillColor(0.4, 0.4, 0.4).text('N.º Mecan.', margin, y);
    doc.text(dados.funcionarioNumeroId?.trim() || '—', margin + 42, y);
    doc.text('N.º Dias Úteis', margin + 95, y);
    doc.text(formatValorAO(dados.diasUteis), margin + 155, y);
    doc.text('Venc. / Hora', margin + 195, y);
    doc.text(formatValorAO(dados.valorHora), margin + 255, y);
    doc.text('Vencimento', margin + 315, y);
    doc.text(formatValorAO(dados.salarioBase), margin + 375, y);
    doc.text('Data Fecho', margin + 435, y);
    doc.text(dados.dataFecho, margin + 495, y);
    y += 7;
    doc.text('Período', margin, y);
    doc.text(getMesNome(dados.mes), margin + 42, y);
    if (dados.funcionarioDepartamento) {
      doc.text('Departamento', margin + 180, y);
      doc.text(dados.funcionarioDepartamento, margin + 245, y);
    }
    if (dados.funcionarioCargo) {
      doc.text('Categoria', margin + 380, y);
      doc.text(dados.funcionarioCargo, margin + 425, y);
    }
    y += 14;

    // 6. Tabela: Cód. | Remunerações / Descontos | Descrição | Valor (AO)
    const colCod = 35;
    const colDesc = margin + colCod + 10;
    const colDescW = contentW - colCod - 10 - 85;
    const colValorX = margin + contentW - 82;
    const colValorW = 82;

    doc.rect(margin, y, contentW, 9).fillAndStroke(0.95, 0.95, 0.98, 0.85, 0.85, 0.85);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(0.15, 0.15, 0.2);
    doc.text('Cód.', margin + 4, y + 6);
    doc.text('Remunerações', colDesc, y + 6);
    doc.text('Descrição', colDesc + 120, y + 6);
    doc.text('Valor (AO)', colValorX, y + 6, { width: colValorW, align: 'right' });
    y += 9;

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

    let totalRemun = 0;
    let totalDesc = 0;
    const addRemun = (desc: string, valor: number, cod: string) => {
      doc.moveTo(margin, y).lineTo(margin + contentW, y).stroke(0.9, 0.9, 0.9);
      doc.font('Helvetica').fontSize(8).fillColor(0, 0, 0);
      doc.text(cod, margin + 4, y + 5);
      doc.text(desc, colDesc, y + 5, { width: colDescW - 30 });
      doc.text(formatValorAO(valor), colValorX, y + 5, { width: colValorW, align: 'right' });
      totalRemun += valor;
      y += 7;
    };
    const addDesc = (desc: string, valor: number, cod: string) => {
      doc.moveTo(margin, y).lineTo(margin + contentW, y).stroke(0.9, 0.9, 0.9);
      doc.font('Helvetica').fontSize(8).fillColor(0, 0, 0);
      doc.text(cod, margin + 4, y + 5);
      doc.text(desc, colDesc, y + 5, { width: colDescW - 30 });
      doc.text(formatValorAO(-valor), colValorX, y + 5, { width: colValorW, align: 'right' });
      totalDesc += valor;
      y += 7;
    };

    if (f.salario_base > 0) addRemun('Vencimento', f.salario_base, 'R01');
    if (f.bonus > 0) addRemun('Bônus', f.bonus, 'R02');
    if (f.valor_horas_extras > 0) addRemun('Horas Extras', f.valor_horas_extras, 'R03');
    if (f.beneficio_transporte > 0) addRemun('Subsídio Transporte', f.beneficio_transporte, 'R14');
    if (f.beneficio_alimentacao > 0) addRemun('Subsídio Alimentação', f.beneficio_alimentacao, 'R15');
    if (f.outros_beneficios > 0) addRemun('Outros Benefícios', f.outros_beneficios, 'R99');
    if (f.descontos_faltas > 0) addDesc('Desconto por Faltas', f.descontos_faltas, 'D01');
    if (f.inss > 0) addDesc('Segurança Social (INSS)', f.inss, 'D02');
    if (f.irt > 0) addDesc('IRT', f.irt, 'D03');
    if (f.outros_descontos > 0) addDesc('Outros Descontos', f.outros_descontos, 'D99');

    doc.moveTo(margin, y).lineTo(margin + contentW, y).stroke(0.5, 0.5, 0.5);
    y += 2;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(0, 0, 0);
    doc.text('Total', margin + 4, y + 6);
    doc.text(formatValorAO(totalRemun), colValorX - 90, y + 6, { width: 85, align: 'right' });
    doc.text(formatValorAO(totalDesc), colValorX, y + 6, { width: colValorW, align: 'right' });
    y += 10;
    doc.fontSize(10).text('Total Pago (AKZ)', margin + 4, y + 7);
    doc.text(formatValorAO(f.salario_liquido), colValorX, y + 7, { width: colValorW, align: 'right' });
    y += 18;

    // 7. Forma de Pagamento
    doc.fontSize(9).font('Helvetica').fillColor(0.3, 0.3, 0.3).text('Formas de Pagamento:', margin, y);
    y += 6;
    doc.text(`Remuneração  100,00 AKZ\t${dados.formaPagamento}`, margin, y);
    y += 14;

    // 8. Declaração de recebimento
    doc.fontSize(8).fillColor(0.35, 0.35, 0.35).text('Declaro que recebi a quantia constante neste recibo.', margin, y);
    y += 10;

    // 9. Valor por extenso
    doc.font('Helvetica-Bold').fontSize(9).fillColor(0.15, 0.15, 0.15).text(valorPorExtenso(f.salario_liquido), margin, y);
    y += 14;

    // 10. Rodapé
    const footerY = 842 - 45;
    doc.moveTo(margin, footerY - 4).lineTo(margin + contentW, footerY - 4).stroke(0.86, 0.86, 0.86);
    doc.fontSize(8).font('Helvetica').fillColor(0.4, 0.4, 0.4);
    doc.text(`© ${dados.instituicaoNome} • ${dados.reciboNumero}`, margin, footerY + 2, { align: 'center', width: contentW });
    if (dados.instituicaoEndereco?.trim()) {
      doc.fontSize(7).fillColor(0.45, 0.45, 0.45).text(dados.instituicaoEndereco.trim(), margin, footerY + 10, { align: 'center', width: contentW });
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
            departamento: { select: { nome: true } },
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
      select: { endereco: true, telefone: true, email: true, nif: true },
    });

    const lastDay = new Date(folha.ano, folha.mes, 0);
    const dataFechoStr = `${String(lastDay.getDate()).padStart(2, '0')}/${String(lastDay.getMonth() + 1).padStart(2, '0')}/${lastDay.getFullYear()}`;
    const formaPagamento = folha.metodoPagamento || folha.formaPagamento || 'Transferência';

    const dados: DadosReciboFolha = {
      instituicaoNome: instituicao?.nome ?? 'Instituição',
      instituicaoEndereco: config?.endereco?.trim() || null,
      instituicaoNif: config?.nif?.trim() || null,
      funcionarioNome: folha.funcionario.nomeCompleto,
      funcionarioNumeroId: folha.funcionario.numeroIdentificacao,
      funcionarioCargo: folha.funcionario.cargo?.nome ?? null,
      funcionarioDepartamento: folha.funcionario.departamento?.nome ?? null,
      funcionarioEmail: folha.funcionario.email,
      mes: folha.mes,
      ano: folha.ano,
      diasUteis: Number(folha.diasUteis ?? 0),
      valorDia: Number(folha.valorDia ?? 0),
      valorHora: Number(folha.valorHora ?? 0),
      dataFecho: dataFechoStr,
      formaPagamento,
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
