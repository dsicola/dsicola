import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from './audit.service.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const REPORTS_BASE = path.resolve(process.cwd(), 'uploads', 'relatorios');

// Tipos de relatórios
export enum TipoRelatorio {
  PLANO_ENSINO_OFICIAL = 'PLANO_ENSINO_OFICIAL',
  MAPA_AULAS_MINISTRADAS = 'MAPA_AULAS_MINISTRADAS',
  MAPA_PRESENCAS = 'MAPA_PRESENCAS',
  ATA_AVALIACOES = 'ATA_AVALIACOES',
  BOLETIM_ALUNO = 'BOLETIM_ALUNO',
  PAUTA_FINAL = 'PAUTA_FINAL',
  HISTORICO_ACADEMICO = 'HISTORICO_ACADEMICO',
  DECLARACAO_MATRICULA = 'DECLARACAO_MATRICULA',
  DECLARACAO_FREQUENCIA = 'DECLARACAO_FREQUENCIA',
  MAPA_PRESENCAS_OFICIAL = 'MAPA_PRESENCAS_OFICIAL',
  RELATORIO_FECHAMENTO_ACADEMICO = 'RELATORIO_FECHAMENTO_ACADEMICO',
  RELATORIO_FINAL_ANO_LETIVO = 'RELATORIO_FINAL_ANO_LETIVO',
  RELATORIO_PONTO_DIARIO = 'RELATORIO_PONTO_DIARIO',
  RELATORIO_PONTO_MENSAL = 'RELATORIO_PONTO_MENSAL',
  RELATORIO_PONTO_INDIVIDUAL = 'RELATORIO_PONTO_INDIVIDUAL',
}

interface GerarRelatorioParams {
  tipoRelatorio: TipoRelatorio;
  referenciaId: string;
  anoLetivo?: number;
  turmaId?: string;
  disciplinaId?: string;
  alunoId?: string;
  trimestre?: number;
}

export class ReportService {
  /**
   * Gerar relatório e salvar no banco
   */
  static async gerarRelatorio(
    req: Request,
    params: GerarRelatorioParams
  ): Promise<{ id: string; nomeArquivo: string }> {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Criar registro de relatório (status GERANDO)
    const relatorio = await prisma.relatorioGerado.create({
      data: {
        instituicaoId,
        tipoRelatorio: params.tipoRelatorio as any,
        referenciaId: params.referenciaId,
        geradoPor: userId,
        status: 'GERANDO',
      },
    });

    try {
      // Validar pré-requisitos (dados aprovados/encerrados)
      await this.validarPreRequisitos(instituicaoId, params);

      // Gerar PDF
      const pdfBuffer = await this.gerarPDF(instituicaoId, params);

      // Calcular hash
      const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      // Salvar arquivo
      const nomeArquivo = await this.salvarArquivo(relatorio.id, pdfBuffer);

      // Atualizar registro
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

      // Registrar auditoria
      await AuditService.log(req, {
        modulo: 'RELATORIOS_OFICIAIS',
        acao: 'GENERATE_REPORT',
        entidade: 'RELATORIO_GERADO',
        entidadeId: relatorio.id,
        dadosNovos: {
          tipoRelatorio: params.tipoRelatorio,
          referenciaId: params.referenciaId,
        },
      });

      return {
        id: relatorioAtualizado.id,
        nomeArquivo: relatorioAtualizado.nomeArquivo || nomeArquivo,
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
   * Validar pré-requisitos (dados aprovados/encerrados)
   */
  private static async validarPreRequisitos(
    instituicaoId: string,
    params: GerarRelatorioParams
  ): Promise<void> {
    // Relatórios de ponto não precisam de pré-requisitos - sempre disponíveis
    if (
      params.tipoRelatorio === TipoRelatorio.RELATORIO_PONTO_DIARIO ||
      params.tipoRelatorio === TipoRelatorio.RELATORIO_PONTO_MENSAL ||
      params.tipoRelatorio === TipoRelatorio.RELATORIO_PONTO_INDIVIDUAL
    ) {
      return; // Sem validações de pré-requisito para relatórios de ponto
    }

    switch (params.tipoRelatorio) {
      case TipoRelatorio.PLANO_ENSINO_OFICIAL:
        // Verificar se plano está APROVADO
        const plano = await prisma.planoEnsino.findFirst({
          where: {
            id: params.referenciaId,
            instituicaoId,
          },
        });

        if (!plano) {
          throw new AppError('Plano de ensino não encontrado', 404);
        }

        if (plano.status !== 'APROVADO') {
          throw new AppError('O plano de ensino deve estar APROVADO para gerar relatório oficial', 400);
        }
        break;

      case TipoRelatorio.MAPA_AULAS_MINISTRADAS:
      case TipoRelatorio.MAPA_PRESENCAS:
        // Verificar plano aprovado
        const planoAulas = await prisma.planoEnsino.findFirst({
          where: {
            id: params.referenciaId,
            instituicaoId,
          },
        });

        if (!planoAulas || planoAulas.status !== 'APROVADO') {
          throw new AppError('O plano de ensino deve estar APROVADO', 400);
        }
        break;

      case TipoRelatorio.ATA_AVALIACOES:
        // Verificar trimestre ENCERRADO
        if (!params.trimestre || !params.anoLetivo) {
          throw new AppError('Trimestre e ano letivo são obrigatórios', 400);
        }

        const trimestreFechado = await prisma.trimestreFechado.findFirst({
          where: {
            instituicaoId,
            anoLetivo: params.anoLetivo,
            trimestre: params.trimestre,
          },
        });

        if (!trimestreFechado || trimestreFechado.fechado !== true) {
          throw new AppError(`O ${params.trimestre}º trimestre deve estar ENCERRADO para gerar ata de avaliações`, 400);
        }
        break;

      case TipoRelatorio.BOLETIM_ALUNO:
        // Verificar trimestre encerrado ou ano completo
        if (params.trimestre) {
          if (!params.anoLetivo) {
            throw new AppError('Ano letivo é obrigatório', 400);
          }

          const trimestreBoletim = await prisma.trimestreFechado.findFirst({
            where: {
              instituicaoId,
              anoLetivo: params.anoLetivo,
              trimestre: params.trimestre,
            },
          });

          if (!trimestreBoletim || trimestreBoletim.fechado !== true) {
            throw new AppError(`O ${params.trimestre}º trimestre deve estar ENCERRADO`, 400);
          }
        }
        break;

      case TipoRelatorio.RELATORIO_FINAL_ANO_LETIVO:
        // Verificar se todos os trimestres estão encerrados
        if (!params.anoLetivo) {
          throw new AppError('Ano letivo é obrigatório', 400);
        }

        const trimestres = await prisma.trimestreFechado.findMany({
          where: {
            instituicaoId,
            anoLetivo: params.anoLetivo,
          },
        });

        if (trimestres.length < 3) {
          throw new AppError('Todos os trimestres devem estar ENCERRADOS para gerar relatório final', 400);
        }

        const todosEncerrados = trimestres.every((t) => t.fechado === true);
        if (!todosEncerrados) {
          throw new AppError('Todos os trimestres devem estar ENCERRADOS', 400);
        }
        break;
    }
  }

  /**
   * Gerar PDF (implementação base - será expandida)
   */
  private static async gerarPDF(
    instituicaoId: string,
    params: GerarRelatorioParams
  ): Promise<Buffer> {
    // Buscar dados da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    // Se for Pauta Final, usar serviço específico
    if (params.tipoRelatorio === TipoRelatorio.PAUTA_FINAL) {
      const { PautaFinalService } = await import('./pautaFinal.service.js');
      return await PautaFinalService.gerarPautaFinal(
        {} as Request, // Será passado corretamente no controller
        {
          turmaId: params.turmaId!,
          disciplinaId: params.disciplinaId!,
          anoLetivo: params.anoLetivo!,
          trimestre: params.trimestre,
        }
      );
    }

    // Por enquanto, retornar PDF básico para outros tipos
    // TODO: Implementar geração real com PDFKit para outros relatórios
    const conteudoPDF = await this.gerarConteudoPDF(instituicaoId, params, instituicao.nome);

    // Simular geração de PDF (será substituído por PDFKit)
    // Por enquanto, retornar buffer simples
    return Buffer.from(conteudoPDF, 'utf-8');
  }

  /**
   * Gerar conteúdo do PDF (será substituído por PDFKit)
   */
  private static async gerarConteudoPDF(
    instituicaoId: string,
    params: GerarRelatorioParams,
    nomeInstituicao: string
  ): Promise<string> {
    // Por enquanto, retornar conteúdo texto simples
    // TODO: Implementar com PDFKit
    let conteudo = `\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nLayout: ${params.tipoRelatorio}\nInstituição: ${nomeInstituicao}\nData: ${new Date().toLocaleDateString('pt-BR')}\n`;
    
    return conteudo;
  }

  /**
   * Salvar arquivo PDF
   */
  private static async salvarArquivo(
    relatorioId: string,
    pdfBuffer: Buffer
  ): Promise<string> {
    // Criar diretório se não existir
    const uploadsDir = REPORTS_BASE;
    await fs.mkdir(uploadsDir, { recursive: true });

    const nomeArquivo = `relatorio_${relatorioId}_${Date.now()}.pdf`;
    const caminhoCompleto = path.join(uploadsDir, nomeArquivo);

    await fs.writeFile(caminhoCompleto, pdfBuffer);

    return nomeArquivo;
  }

  /**
   * Buscar relatório gerado
   */
  static async buscarRelatorio(relatorioId: string, instituicaoId: string) {
    const relatorio = await prisma.relatorioGerado.findFirst({
      where: {
        id: relatorioId,
        instituicaoId,
      },
      include: {
        usuario: {
          select: {
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    if (!relatorio) {
      throw new AppError('Relatório não encontrado', 404);
    }

    return relatorio;
  }

  /**
   * Buscar arquivo do relatório
   */
  static async buscarArquivoRelatorio(relatorioId: string, instituicaoId: string): Promise<Buffer> {
    const relatorio = await this.buscarRelatorio(relatorioId, instituicaoId);

    if (!relatorio.caminhoArquivo || !relatorio.nomeArquivo) {
      throw new AppError('Arquivo do relatório não encontrado', 404);
    }

    const caminhoCompleto = path.join(REPORTS_BASE, relatorio.nomeArquivo);

    try {
      return await fs.readFile(caminhoCompleto);
    } catch {
      throw new AppError('Erro ao ler arquivo do relatório', 500);
    }
  }

  /**
   * Listar relatórios gerados
   */
  static async listarRelatorios(
    instituicaoId: string,
    filtros?: {
      tipoRelatorio?: string;
      referenciaId?: string;
      anoLetivo?: number;
      dataInicio?: Date;
      dataFim?: Date;
    }
  ) {
    const where: any = {
      instituicaoId,
    };

    if (filtros?.tipoRelatorio) {
      where.tipoRelatorio = filtros.tipoRelatorio;
    }

    if (filtros?.referenciaId) {
      where.referenciaId = filtros.referenciaId;
    }

    if (filtros?.dataInicio || filtros?.dataFim) {
      where.geradoEm = {};
      if (filtros.dataInicio) {
        where.geradoEm.gte = filtros.dataInicio;
      }
      if (filtros.dataFim) {
        where.geradoEm.lte = filtros.dataFim;
      }
    }

    return await prisma.relatorioGerado.findMany({
      where,
      include: {
        usuario: {
          select: {
            nomeCompleto: true,
            email: true,
          },
        },
      },
      orderBy: {
        geradoEm: 'desc',
      },
    });
  }
}

