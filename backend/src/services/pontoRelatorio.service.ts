import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from './audit.service.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
// PDFKit precisa ser instalado: npm install pdfkit @types/pdfkit
// Por enquanto, usando geração básica - TODO: Instalar PDFKit
// import PDFDocument from 'pdfkit';

const REPORT_BASE = path.resolve(process.cwd(), 'reports');

interface RelatorioPontoParams {
  tipo: 'DIARIO' | 'MENSAL' | 'INDIVIDUAL';
  data?: Date; // Para diário
  mes?: number; // Para mensal
  ano?: number; // Para mensal
  funcionarioId?: string; // Para individual
  dataInicio?: Date; // Para individual
  dataFim?: Date; // Para individual
}

export class PontoRelatorioService {
  /**
   * Gerar relatório de ponto e salvar no banco
   */
  static async gerarRelatorio(
    req: Request,
    params: RelatorioPontoParams
  ): Promise<{ id: string; nomeArquivo: string; hash: string }> {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Validar parâmetros
    this.validarParametros(params);

    // Buscar dados de presença
    const dadosPresenca = await this.buscarDadosPresenca(instituicaoId, params);

    // Criar registro de relatório (status GERANDO)
    const tipoRelatorio = `RELATORIO_PONTO_${params.tipo}` as any;
    const referenciaId = params.funcionarioId || `${params.ano}-${params.mes || new Date().getDate()}`;

    const relatorio = await prisma.relatorioGerado.create({
      data: {
        instituicaoId,
        tipoRelatorio,
        referenciaId,
        geradoPor: userId,
        status: 'GERANDO',
      },
    });

    try {
      // Gerar PDF A4
      const pdfBuffer = await this.gerarPDFA4(instituicaoId, params, dadosPresenca);

      // Calcular hash SHA256 para integridade
      const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      // Salvar arquivo
      const nomeArquivo = await this.salvarArquivo(relatorio.id, pdfBuffer);

      // Atualizar registro com hash
      const relatorioAtualizado = await prisma.relatorioGerado.update({
        where: { id: relatorio.id },
        data: {
          status: 'CONCLUIDO',
          hashDocumento: hash,
          nomeArquivo,
          caminhoArquivo: `relatorios/${instituicaoId}/${nomeArquivo}`,
          tamanhoBytes: pdfBuffer.length,
        },
      });

      // Registrar auditoria CREATE
      await AuditService.log(req, {
        modulo: 'RELATORIOS_OFICIAIS',
        acao: 'CREATE',
        entidade: 'RELATORIO_PONTO',
        entidadeId: relatorio.id,
        dadosNovos: {
          tipoRelatorio,
          referenciaId,
          hash,
          tipo: params.tipo,
        },
      });

      return {
        id: relatorioAtualizado.id,
        nomeArquivo: relatorioAtualizado.nomeArquivo || nomeArquivo,
        hash,
      };
    } catch (error: any) {
      // Atualizar com erro
      await prisma.relatorioGerado.update({
        where: { id: relatorio.id },
        data: {
          status: 'ERRO',
          erro: error.message || 'Erro desconhecido ao gerar relatório',
        },
      });

      throw error;
    }
  }

  /**
   * Validar parâmetros do relatório
   */
  private static validarParametros(params: RelatorioPontoParams): void {
    if (params.tipo === 'DIARIO' && !params.data) {
      throw new AppError('Data é obrigatória para relatório diário', 400);
    }

    if (params.tipo === 'MENSAL' && (!params.mes || !params.ano)) {
      throw new AppError('Mês e ano são obrigatórios para relatório mensal', 400);
    }

    if (params.tipo === 'INDIVIDUAL' && (!params.funcionarioId || !params.dataInicio || !params.dataFim)) {
      throw new AppError('Funcionário, data início e data fim são obrigatórios para relatório individual', 400);
    }
  }

  /**
   * Buscar dados de presença baseado nos parâmetros
   */
  private static async buscarDadosPresenca(
    instituicaoId: string,
    params: RelatorioPontoParams
  ): Promise<any[]> {
    const where: any = {
      funcionario: {
        instituicaoId,
      },
    };

    if (params.tipo === 'DIARIO' && params.data) {
      const dataInicio = new Date(params.data);
      dataInicio.setHours(0, 0, 0, 0);
      const dataFim = new Date(params.data);
      dataFim.setHours(23, 59, 59, 999);
      where.data = {
        gte: dataInicio,
        lte: dataFim,
      };
    } else if (params.tipo === 'MENSAL' && params.mes && params.ano) {
      const dataInicio = new Date(params.ano, params.mes - 1, 1);
      const dataFim = new Date(params.ano, params.mes, 0, 23, 59, 59, 999);
      where.data = {
        gte: dataInicio,
        lte: dataFim,
      };
    } else if (params.tipo === 'INDIVIDUAL' && params.funcionarioId && params.dataInicio && params.dataFim) {
      where.funcionarioId = params.funcionarioId;
      where.data = {
        gte: params.dataInicio,
        lte: params.dataFim,
      };
    }

    const presencas = await prisma.frequenciaFuncionario.findMany({
      where,
      include: {
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          },
        },
        justificativa: {
          select: {
            motivo: true,
            status: true,
          },
        },
      },
      orderBy: {
        data: 'asc',
      },
    });

    return presencas;
  }

  /**
   * Gerar PDF A4 do relatório de ponto
   * NOTA: Requer instalação de pdfkit: npm install pdfkit @types/pdfkit
   */
  private static async gerarPDFA4(
    instituicaoId: string,
    params: RelatorioPontoParams,
    presencas: any[]
  ): Promise<Buffer> {
    // Por enquanto, gerar PDF simples em HTML que será convertido
    // TODO: Instalar PDFKit e usar implementação completa
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    const titulo = this.getTituloRelatorio(params);
    const periodoTexto = this.getPeriodoTexto(params);
    
    // Gerar conteúdo HTML simples que será convertido para PDF
    // Na produção, usar PDFKit para gerar PDF nativo
    const htmlContent = this.gerarHTMLRelatorio(instituicao.nome, titulo, periodoTexto, presencas, params.tipo);
    
    // Retornar como buffer (em produção, converter HTML para PDF)
    // Por enquanto, retornar buffer simples - requer PDFKit para produção
    return Buffer.from(htmlContent, 'utf-8');
    
    /* CÓDIGO COM PDFKIT (requer instalação):
    return new Promise((resolve, reject) => {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Implementação completa com PDFKit aqui
      // ...
    });
    */
  }

  /**
   * Gerar HTML do relatório (temporário até instalar PDFKit)
   */
  private static gerarHTMLRelatorio(
    nomeInstituicao: string,
    titulo: string,
    periodo: string,
    presencas: any[],
    tipo: string
  ): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
    .subtitle { font-size: 14px; }
    .info { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    .footer { margin-top: 30px; font-size: 8px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${nomeInstituicao}</div>
    <div class="subtitle">${titulo}</div>
  </div>
  
  <div class="info">
    <p><strong>Período:</strong> ${periodo}</p>
    <p><strong>Data de geração:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Funcionário</th>
        <th>Entrada</th>
        <th>Saída</th>
        <th>Horas</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
`;

    if (presencas.length === 0) {
      html += '<tr><td colspan="6" style="text-align: center;">Nenhuma presença registrada no período.</td></tr>';
    } else {
      presencas.forEach(presenca => {
        const funcionarioNome = presenca.funcionario?.nomeCompleto || 'N/A';
        const data = new Date(presenca.data).toLocaleDateString('pt-BR');
        const entrada = presenca.horaEntrada || '-';
        const saida = presenca.horaSaida || '-';
        const horas = presenca.horasTrabalhadas ? parseFloat(presenca.horasTrabalhadas.toString()).toFixed(2) : '-';
        const status = this.getStatusTexto(presenca.status);

        html += `
      <tr>
        <td>${data}</td>
        <td>${funcionarioNome}</td>
        <td>${entrada}</td>
        <td>${saida}</td>
        <td>${horas}</td>
        <td>${status}</td>
      </tr>`;
      });

      // Totais
      if (tipo === 'MENSAL' || tipo === 'INDIVIDUAL') {
        const totalHoras = presencas.reduce((sum, p) => {
          return sum + (p.horasTrabalhadas ? parseFloat(p.horasTrabalhadas.toString()) : 0);
        }, 0);
        const totalFaltas = presencas.filter(p => p.status === 'FALTA_NAO_JUSTIFICADA' || p.status === 'FALTA_JUSTIFICADA').length;

        html += `
      <tr style="font-weight: bold;">
        <td colspan="4">TOTAIS</td>
        <td>${totalHoras.toFixed(2)}h</td>
        <td>${totalFaltas} faltas</td>
      </tr>`;
      }
    }

    html += `
    </tbody>
  </table>
  
  <div class="footer">
    <p>Relatório Legal de Ponto - DSICOLA</p>
    <p>Documento gerado automaticamente e não pode ser editado</p>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Obter título do relatório
   */
  private static getTituloRelatorio(params: RelatorioPontoParams): string {
    switch (params.tipo) {
      case 'DIARIO':
        return 'RELATÓRIO DE PONTO - DIÁRIO';
      case 'MENSAL':
        return 'RELATÓRIO DE PONTO - MENSAL';
      case 'INDIVIDUAL':
        return 'RELATÓRIO DE PONTO - INDIVIDUAL';
      default:
        return 'RELATÓRIO DE PONTO';
    }
  }

  /**
   * Obter texto do período
   */
  private static getPeriodoTexto(params: RelatorioPontoParams): string {
    if (params.tipo === 'DIARIO' && params.data) {
      return params.data.toLocaleDateString('pt-BR');
    }
    if (params.tipo === 'MENSAL' && params.mes && params.ano) {
      const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      return `${meses[params.mes - 1]} de ${params.ano}`;
    }
    if (params.tipo === 'INDIVIDUAL' && params.dataInicio && params.dataFim) {
      return `${params.dataInicio.toLocaleDateString('pt-BR')} a ${params.dataFim.toLocaleDateString('pt-BR')}`;
    }
    return 'N/A';
  }

  /**
   * Obter texto do status
   */
  private static getStatusTexto(status: string): string {
    const statusMap: { [key: string]: string } = {
      PRESENTE: 'Presente',
      FALTA_JUSTIFICADA: 'Falta Justificada',
      FALTA_NAO_JUSTIFICADA: 'Falta Não Justificada',
    };
    return statusMap[status] || status;
  }

  /**
   * Salvar arquivo PDF
   */
  private static async salvarArquivo(relatorioId: string, pdfBuffer: Buffer): Promise<string> {
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'relatorios');
    await fs.mkdir(uploadsDir, { recursive: true });

    const nomeArquivo = `relatorio_ponto_${relatorioId}_${Date.now()}.pdf`;
    const caminhoCompleto = path.join(uploadsDir, nomeArquivo);

    await fs.writeFile(caminhoCompleto, pdfBuffer);

    return nomeArquivo;
  }

  /**
   * Verificar integridade do relatório
   */
  static async verificarIntegridade(relatorioId: string, instituicaoId: string): Promise<boolean> {
    const relatorio = await prisma.relatorioGerado.findFirst({
      where: {
        id: relatorioId,
        instituicaoId,
      },
    });

    if (!relatorio || !relatorio.caminhoArquivo || !relatorio.nomeArquivo) {
      return false;
    }

    // Ler arquivo atual
    const caminhoCompleto = path.resolve(process.cwd(), 'uploads', 'relatorios', relatorio.nomeArquivo);

    try {
      const arquivoAtual = await fs.readFile(caminhoCompleto);
      const hashAtual = crypto.createHash('sha256').update(arquivoAtual).digest('hex');

      // Comparar com hash salvo
      return hashAtual === relatorio.hashDocumento;
    } catch {
      return false;
    }
  }
}

