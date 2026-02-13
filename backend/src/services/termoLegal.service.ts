import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { Request } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

const TERMOS_BASE = path.resolve(process.cwd(), 'termos_legais');

/**
 * Tipos de ações que exigem termo legal
 */
export enum TipoAcaoTermoLegal {
  RESTORE_BACKUP = 'RESTORE_BACKUP',
  REABERTURA_ANO = 'REABERTURA_ANO',
  ENCERRAMENTO_ANO = 'ENCERRAMENTO_ANO',
  OUTRO = 'OUTRO',
}

/**
 * Serviço de Termos Legais Institucionais
 * Implementa termos legais em PDF com aceite obrigatório
 * Padrão SIGA / SIGAE / Enterprise
 */
export class TermoLegalService {
  private static readonly TERMOS_DIR = TERMOS_BASE;

  /**
   * Garantir que o diretório de termos existe
   */
  private static async ensureTermosDir(instituicaoId: string, tipoAcao: string): Promise<string> {
    const dirPath = path.join(this.TERMOS_DIR, instituicaoId, tipoAcao);
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error('[TermoLegalService] Erro ao criar diretório de termos:', error);
      throw new AppError('Erro ao criar diretório de termos legais', 500);
    }
    return dirPath;
  }

  /**
   * Verificar se usuário já aceitou termo ativo para ação
   * Se não existir termo, cria automaticamente o termo padrão
   */
  static async verificarAceite(
    userId: string,
    instituicaoId: string,
    tipoAcao: TipoAcaoTermoLegal
  ): Promise<{ aceito: boolean; termoId?: string; termo?: any }> {
    // Buscar termo ativo para a ação
    let termo = await prisma.termoLegal.findFirst({
      where: {
        instituicaoId,
        tipoAcao,
        ativo: true,
      },
      orderBy: {
        versao: 'desc',
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Se não existe termo e é RESTORE_BACKUP, criar termo padrão automaticamente
    if (!termo && tipoAcao === TipoAcaoTermoLegal.RESTORE_BACKUP) {
      const TERMO_HTML = `<h1>TERMO DE RESPONSABILIDADE E ACEITE INSTITUCIONAL</h1>

<p>
Este Termo regula o uso de funcionalidades críticas do sistema <strong>DSICOLA</strong>,
plataforma de gestão acadêmica institucional, aplicável a instituições de
<strong>Ensino Superior</strong> e <strong>Ensino Secundário</strong>.
</p>

<h2>1. DAS DEFINIÇÕES</h2>
<p>
Para fins deste Termo:
<ul>
  <li><strong>Sistema</strong>: DSICOLA – Sistema de Gestão Acadêmica</li>
  <li><strong>Instituição</strong>: Entidade educacional cadastrada no sistema</li>
  <li><strong>Usuário</strong>: Pessoa autenticada com perfil institucional válido</li>
  <li><strong>Ação Crítica</strong>: Qualquer operação que impacte dados oficiais, históricos ou legais</li>
</ul>
</p>

<h2>2. DAS AÇÕES CRÍTICAS</h2>
<p>
São consideradas ações críticas, entre outras:
<ul>
  <li>Geração e restauração de backups institucionais</li>
  <li>Encerramento e reabertura de Ano Letivo</li>
  <li>Alterações em históricos acadêmicos</li>
  <li>Emissão de documentos oficiais</li>
</ul>
</p>

<h2>3. DA RESPONSABILIDADE</h2>
<p>
Ao aceitar este Termo, o Usuário declara que:
<ul>
  <li>Possui autorização institucional para executar a ação</li>
  <li>Compreende os impactos acadêmicos, administrativos e legais</li>
  <li>Assume total responsabilidade pelos efeitos da operação</li>
</ul>
</p>

<h2>4. DA AUDITORIA E RASTREABILIDADE</h2>
<p>
Todas as ações são registradas com:
<ul>
  <li>Identificação do usuário</li>
  <li>Instituição vinculada</li>
  <li>Data, hora e endereço IP</li>
  <li>Hash criptográfico do documento de aceite</li>
</ul>
</p>

<h2>5. DA VALIDADE LEGAL</h2>
<p>
Este aceite possui validade legal equivalente à assinatura eletrônica,
nos termos das boas práticas de governança institucional e compliance.
</p>

<h2>6. DISPOSIÇÕES FINAIS</h2>
<p>
Este Termo é parte integrante do uso do sistema DSICOLA.
A continuidade da operação está condicionada à sua aceitação.
</p>

<p>
<strong>Data:</strong> {{DATA}} <br/>
<strong>Usuário:</strong> {{USUARIO}} <br/>
<strong>Perfil:</strong> {{PERFIL}} <br/>
<strong>Instituição:</strong> {{INSTITUICAO}}
</p>`;

      const resultado = await this.criarOuAtualizarTermo(
        instituicaoId,
        tipoAcao,
        'Termo de Responsabilidade e Aceite Institucional - Backup e Restore',
        TERMO_HTML
      );

      // Buscar termo criado
      termo = await prisma.termoLegal.findUnique({
        where: { id: resultado.id },
        include: {
          instituicao: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });
    }

    if (!termo) {
      // Se não existe termo e não foi possível criar, não é obrigatório (compatibilidade)
      return { aceito: true };
    }

    // Verificar se usuário já aceitou este termo
    const aceite = await prisma.aceiteTermoLegal.findFirst({
      where: {
        termoId: termo.id,
        userId,
        instituicaoId,
      },
    });

    // Se termo existe mas usuário não aceitou, substituir variáveis dinâmicas
    let termoFormatado = termo;
    if (!aceite && termo) {
      // Buscar dados do usuário e instituição para substituir variáveis
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            select: { role: true },
          },
        },
      });

      const instituicao = await prisma.instituicao.findUnique({
        where: { id: instituicaoId },
        select: { nome: true },
      });

      // Substituir variáveis no HTML
      let conteudoHtml = termo.conteudoHtml;
      if (user) {
        conteudoHtml = conteudoHtml.replace(/{{USUARIO}}/g, user.nomeCompleto || user.email || 'N/A');
        conteudoHtml = conteudoHtml.replace(/{{PERFIL}}/g, user.roles.map((r: any) => r.role).join(', ') || 'N/A');
      }
      if (instituicao) {
        conteudoHtml = conteudoHtml.replace(/{{INSTITUICAO}}/g, instituicao.nome);
      }
      conteudoHtml = conteudoHtml.replace(/{{DATA}}/g, new Date().toLocaleString('pt-BR'));

      termoFormatado = {
        ...termo,
        conteudoHtml,
      };
    }

    return {
      aceito: !!aceite,
      termoId: termo.id,
      termo: aceite ? undefined : termoFormatado, // Retornar termo apenas se não aceitou
    };
  }

  /**
   * Registrar aceite de termo legal e gerar PDF
   */
  static async aceitarTermo(
    userId: string,
    instituicaoId: string,
    termoId: string,
    req: Request
  ): Promise<{ aceiteId: string; pdfPath: string; hashPdf: string }> {
    // Verificar se termo existe e está ativo
    const termo = await prisma.termoLegal.findFirst({
      where: {
        id: termoId,
        instituicaoId,
        ativo: true,
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!termo) {
      throw new AppError('Termo legal não encontrado ou inativo', 404);
    }

    // Verificar se usuário já aceitou
    const aceiteExistente = await prisma.aceiteTermoLegal.findFirst({
      where: {
        termoId: termo.id,
        userId,
        instituicaoId,
      },
    });

    if (aceiteExistente) {
      throw new AppError('Termo legal já foi aceito anteriormente', 400);
    }

    // Buscar dados do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Capturar IP e User-Agent
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    // Gerar PDF do termo
    const { pdfPath, hashPdf } = await this.gerarPDFTermo(
      termo,
      user,
      instituicaoId,
      ip,
      userAgent
    );

    // Criar registro de aceite
    const aceite = await prisma.aceiteTermoLegal.create({
      data: {
        termoId: termo.id,
        instituicaoId,
        userId,
        ip,
        userAgent,
        hashPdf,
        caminhoPdf: pdfPath,
      },
    });

    // AUDITORIA: Registrar aceite
    try {
      const { AuditService } = await import('./audit.service.js');
      await AuditService.log(req, {
        modulo: 'TERMO_LEGAL',
        acao: 'ACEITE_TERMO',
        entidade: 'ACEITE_TERMO_LEGAL',
        entidadeId: aceite.id,
        instituicaoId,
        dadosNovos: {
          termo_id: termo.id,
          tipo_acao: termo.tipoAcao,
          versao: termo.versao,
          hash_pdf: hashPdf.substring(0, 16) + '...',
        },
        observacao: `Termo legal aceito: ${termo.titulo} (${termo.tipoAcao})`,
      });
    } catch (auditError) {
      console.warn('[TermoLegalService] Erro ao registrar auditoria:', auditError);
      // Não falhar se auditoria falhar
    }

    return {
      aceiteId: aceite.id,
      pdfPath,
      hashPdf,
    };
  }

  /**
   * Gerar PDF do termo legal
   */
  private static async gerarPDFTermo(
    termo: any,
    user: any,
    instituicaoId: string,
    ip: string | null,
    userAgent: string | null
  ): Promise<{ pdfPath: string; hashPdf: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        // Criar diretório
        const dirPath = await this.ensureTermosDir(instituicaoId, termo.tipoAcao);
        
        // Nome do arquivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `termo_${termo.id}_${timestamp}.pdf`;
        const filePath = path.join(dirPath, fileName);

        // Criar documento PDF
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const stream = fsSync.createWriteStream(filePath);
        doc.pipe(stream);

        // Cabeçalho
        doc.fontSize(16).font('Helvetica-Bold');
        doc.text('TERMO LEGAL INSTITUCIONAL', { align: 'center' });
        doc.moveDown(1);

        // Dados da instituição
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('INSTITUIÇÃO:', { underline: true });
        doc.fontSize(10).font('Helvetica');
        doc.text(termo.instituicao.nome);
        doc.moveDown(1);

        // Tipo de ação
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('TIPO DE AÇÃO:', { underline: true });
        doc.fontSize(10).font('Helvetica');
        doc.text(this.getTipoAcaoLabel(termo.tipoAcao));
        doc.moveDown(1);

        // Título do termo
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text(termo.titulo);
        doc.moveDown(1);

        // Conteúdo HTML convertido para texto simples
        // TODO: Implementar conversão HTML → PDF mais sofisticada se necessário
        const conteudoTexto = this.htmlToText(termo.conteudoHtml);
        doc.fontSize(10).font('Helvetica');
        const lines = conteudoTexto.split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            doc.text(line.trim(), { align: 'justify' });
            doc.moveDown(0.5);
          }
        });

        doc.moveDown(2);

        // Dados do aceite
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('DADOS DO ACEITE:', { underline: true });
        doc.fontSize(10).font('Helvetica');
        doc.text(`Usuário: ${user.nomeCompleto}`);
        doc.text(`Email: ${user.email}`);
        doc.text(`Cargo: ${user.roles.map((r: any) => r.role).join(', ')}`);
        doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
        if (ip) {
          doc.text(`IP: ${ip}`);
        }
        if (userAgent) {
          doc.text(`User-Agent: ${userAgent.substring(0, 100)}`);
        }
        doc.moveDown(1);

        // Versão
        doc.fontSize(8).font('Helvetica');
        doc.text(`Versão do Termo: ${termo.versao}`, { align: 'right' });
        doc.text(`ID do Termo: ${termo.id}`, { align: 'right' });

        // Finalizar PDF
        doc.end();

        stream.on('finish', async () => {
          try {
            // Ler arquivo e calcular hash
            const pdfBuffer = await fs.readFile(filePath);
            const hashPdf = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

            resolve({
              pdfPath: filePath,
              hashPdf,
            });
          } catch (error) {
            reject(error);
          }
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Converter HTML simples para texto
   */
  private static htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remover tags HTML
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Obter label do tipo de ação
   */
  private static getTipoAcaoLabel(tipoAcao: string): string {
    const labels: Record<string, string> = {
      RESTORE_BACKUP: 'Restauração de Backup',
      REABERTURA_ANO: 'Reabertura de Ano Letivo',
      ENCERRAMENTO_ANO: 'Encerramento de Ano Letivo',
      OUTRO: 'Outro',
    };
    return labels[tipoAcao] || tipoAcao;
  }

  /**
   * Criar ou atualizar termo legal
   */
  static async criarOuAtualizarTermo(
    instituicaoId: string,
    tipoAcao: TipoAcaoTermoLegal,
    titulo: string,
    conteudoHtml: string
  ): Promise<{ id: string; versao: number }> {
    // Buscar termo ativo existente
    const termoExistente = await prisma.termoLegal.findFirst({
      where: {
        instituicaoId,
        tipoAcao,
        ativo: true,
      },
      orderBy: {
        versao: 'desc',
      },
    });

    if (termoExistente) {
      // Desativar termo anterior
      await prisma.termoLegal.update({
        where: { id: termoExistente.id },
        data: { ativo: false },
      });
    }

    // Criar novo termo com versão incrementada
    const novaVersao = termoExistente ? termoExistente.versao + 1 : 1;

    const termo = await prisma.termoLegal.create({
      data: {
        instituicaoId,
        tipoAcao,
        titulo,
        conteudoHtml,
        versao: novaVersao,
        ativo: true,
      },
    });

    return {
      id: termo.id,
      versao: termo.versao,
    };
  }
}

