import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from '../services/audit.service.js';
import { BackupService } from '../services/backup.service.js';
import { CryptoService } from '../services/crypto.service.js';
import { DigitalSignatureService } from '../services/digitalSignature.service.js';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs/promises';

export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query;
    const filter = addInstitutionFilter(req);
    
    // CRÍTICO: Filtrar sempre por instituição do JWT
    const history = await prisma.backupHistory.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 50,
    });
    
    // Converter campos de camelCase para snake_case (compatibilidade com frontend)
    const formatted = history.map(backup => {
      const b = backup as any; // Acessar campos Enterprise
      return {
        id: backup.id,
        instituicao_id: backup.instituicaoId,
        user_id: backup.userId,
        user_email: backup.userEmail,
        tipo: backup.tipo,
        status: backup.status,
        arquivo_url: backup.arquivoUrl,
        tamanho_bytes: backup.tamanhoBytes,
        erro: backup.erro,
        // Campos Enterprise: Criptografia
        criptografado: b.criptografado || false,
        algoritmo: b.algoritmo || null,
        iv: b.iv || null,
        tag_autenticacao: b.tagAutenticacao || null,
        // Campos Enterprise: Integridade
        hash_sha256: b.hashSha256 || null,
        hash_verificado: b.hashVerificado || false,
        // Campos Enterprise: Assinatura Digital
        assinatura_digital: b.assinaturaDigital || null,
        algoritmo_assinatura: b.algoritmoAssinatura || null,
        assinatura_verificada: b.assinaturaVerificada || false,
        // Campos Enterprise: Retenção
        status_retencao: b.statusRetencao || 'ativo',
        expirado_em: b.expiradoEm ? new Date(b.expiradoEm).toISOString() : null,
        created_at: backup.createdAt.toISOString(),
      };
    });
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getSchedules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    
    // CRÍTICO: Filtrar sempre por instituição do JWT
    const schedules = await prisma.backupSchedule.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(schedules);
  } catch (error) {
    next(error);
  }
};

export const createSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRÍTICO: instituicaoId vem EXCLUSIVAMENTE do JWT
    const instituicaoId = requireTenantScope(req);
    const data = req.body;
    
    // NUNCA aceitar instituicaoId do body
    if (data.instituicaoId) {
      throw new AppError('instituicaoId não deve ser fornecido no corpo da requisição. Use o token de autenticação.', 400);
    }
    
    const schedule = await prisma.backupSchedule.create({
      data: {
        instituicaoId, // Do JWT
        frequencia: data.frequencia || 'diario',
        horaExecucao: data.horaExecucao || '03:00',
        diaSemana: data.diaSemana,
        diaMes: data.diaMes,
        tipoBackup: data.tipoBackup || 'completo',
        ativo: data.ativo !== undefined ? data.ativo : true,
        createdBy: req.user?.userId,
      },
    });
    
    // Auditoria
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'CREATE',
      entidade: 'BACKUP_SCHEDULE',
      entidadeId: schedule.id,
      dadosNovos: schedule,
    });
    
    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
};

export const updateSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const data = req.body;
    
    // CRÍTICO: Não permitir mudar instituicaoId
    if (data.instituicaoId) {
      throw new AppError('Não é permitido alterar instituicaoId', 400);
    }
    
    // Verificar se o schedule pertence à instituição do usuário
    const existing = await prisma.backupSchedule.findFirst({
      where: { id, ...filter },
    });
    
    if (!existing) {
      throw new AppError('Agendamento não encontrado ou não pertence à sua instituição', 404);
    }
    
    const schedule = await prisma.backupSchedule.update({
      where: { id },
      data: {
        ...data,
        instituicaoId: undefined, // Remover se foi enviado
      },
    });
    
    // Auditoria
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'UPDATE',
      entidade: 'BACKUP_SCHEDULE',
      entidadeId: schedule.id,
      dadosAnteriores: existing,
      dadosNovos: schedule,
    });
    
    res.json(schedule);
  } catch (error) {
    next(error);
  }
};

export const deleteSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verificar se o schedule pertence à instituição do usuário
    const existing = await prisma.backupSchedule.findFirst({
      where: { id, ...filter },
    });
    
    if (!existing) {
      throw new AppError('Agendamento não encontrado ou não pertence à sua instituição', 404);
    }
    
    await prisma.backupSchedule.delete({ where: { id } });
    
    // Auditoria
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'DELETE',
      entidade: 'BACKUP_SCHEDULE',
      entidadeId: id,
      dadosAnteriores: existing,
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const generate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRÍTICO: instituicaoId vem EXCLUSIVAMENTE do JWT
    const instituicaoId = requireTenantScope(req);
    const { tipo } = req.body;
    
    // NUNCA aceitar instituicaoId do body
    if (req.body.instituicaoId) {
      throw new AppError('instituicaoId não deve ser fornecido no corpo da requisição. Use o token de autenticação.', 400);
    }
    
    const backupType = tipo || 'completo';
    
    // Criar registro inicial para retornar ao usuário
    const backupRecord = await prisma.backupHistory.create({
      data: {
        instituicaoId,
        userId: req.user?.userId || null,
        userEmail: req.user?.email || null,
        tipo: `backup_manual_${backupType}`,
        status: 'em_progresso',
      },
    });
    
    // Executar backup em background (não bloquear request)
    // Passar backupId para usar o registro já criado
    Promise.resolve().then(async () => {
      try {
        await BackupService.generateBackup(
          instituicaoId,
          backupType,
          'manual',
          req.user?.userId,
          req.user?.email,
          backupRecord.id // Passar ID do registro já criado
        );
      } catch (error) {
        console.error('[BackupController] Erro ao gerar backup em background:', error);
        // Erro já é tratado no BackupService (atualiza status para 'erro')
      }
    }).catch((error) => {
      console.error('[BackupController] Erro não tratado no backup em background:', error);
    });
    
    // Auditoria - início do backup (ADMIN - modo NORMAL)
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'GENERATE',
      entidade: 'BACKUP',
      entidadeId: backupRecord.id,
      dadosNovos: {
        tipo: backupType,
        instituicaoId,
        origem: 'manual',
        modo: 'NORMAL',
        tipo_operacao: 'BACKUP',
        status: 'em_progresso',
      },
    });
    
    // Retornar imediatamente (backup está sendo processado em background)
    res.status(202).json({
      id: backupRecord.id,
      instituicaoId: backupRecord.instituicaoId,
      tipo: backupRecord.tipo,
      status: backupRecord.status,
      message: 'Backup iniciado. O processamento está sendo executado em background.',
      createdAt: backupRecord.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

export const download = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Buscar backup (incluindo campos enterprise)
    const backup = await prisma.backupHistory.findUnique({
      where: { id },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    
    if (!backup) {
      throw new AppError('Backup não encontrado', 404);
    }
    
    // CRÍTICO: Verificar permissões multi-tenant
    // ADMIN apenas backups da sua instituição (rotas /backup são exclusivas para ADMIN)
    const userInstituicaoId = req.user?.instituicaoId;
    
    // ADMIN só pode baixar backups da sua instituição
    if (!backup.instituicaoId || backup.instituicaoId !== userInstituicaoId) {
      // Auditoria de tentativa de download não autorizado
      await AuditService.log(req, {
        modulo: 'BACKUP',
        acao: 'BLOCK_BACKUP_ACCESS',
        entidade: 'BACKUP',
        entidadeId: id,
        dadosNovos: {
          backup_instituicao_id: backup.instituicaoId,
          user_instituicao_id: userInstituicaoId,
          modo: 'NORMAL',
        },
        observacao: 'Tentativa de download de backup de outra instituição bloqueada',
      });
      
      throw new AppError('Acesso negado: Este backup pertence a outra instituição.', 403);
    }
    
    // Verificar se backup está completo
    if (backup.status !== 'concluido') {
      throw new AppError(`Backup ainda não está completo. Status: ${backup.status}`, 400);
    }
    
    if (!backup.arquivoUrl) {
      throw new AppError('Arquivo de backup não encontrado', 404);
    }
    
    // Buscar arquivo usando BackupService
    const filePath = await BackupService.getBackupFilePath(backup.arquivoUrl, backup.instituicaoId || '');
    
    // Verificar se arquivo existe
    try {
      await fs.access(filePath);
    } catch {
      throw new AppError('Arquivo de backup não encontrado no sistema de arquivos', 404);
    }
    
    // VALIDAÇÃO DE INTEGRIDADE: Hash SHA-256 é OBRIGATÓRIO para download
    const backupHash = (backup as any).hashSha256;
    if (!backupHash) {
      // AUDITORIA: Registrar tentativa de download sem hash
      await AuditService.log(req, {
        modulo: 'BACKUP',
        acao: 'VALIDACAO_HASH',
        entidade: 'BACKUP',
        entidadeId: id,
        observacao: `Tentativa de download bloqueada: backup não possui hash SHA-256. Backup inseguro ou antigo.`,
      });
      
      throw new AppError(
        'Backup inseguro: hash SHA-256 não encontrado. Este backup não possui verificação de integridade e não pode ser baixado por segurança. Entre em contato com o suporte.',
        400
      );
    }

    // VALIDAÇÃO DE INTEGRIDADE: Verificar hash SHA-256 antes de permitir download
    {
      try {
        const fileBuffer = await fs.readFile(filePath);
        const calculatedHash = CryptoService.calculateHash(fileBuffer);
        
        if (calculatedHash !== backupHash) {
          // AUDITORIA: Registrar falha de validação de hash
          await AuditService.log(req, {
            modulo: 'BACKUP',
            acao: 'VALIDACAO_HASH',
            entidade: 'BACKUP',
            entidadeId: id,
            dadosAnteriores: {
              hash_esperado: backupHash.substring(0, 16) + '...',
            },
            dadosNovos: {
              hash_calculado: calculatedHash.substring(0, 16) + '...',
            },
            observacao: `Validação de hash SHA-256 FALHOU ao tentar download. Backup possivelmente corrompido ou adulterado. Download BLOQUEADO.`,
          });
          
          throw new AppError(
            'Integridade do backup comprometida: hash SHA-256 não corresponde. O arquivo pode estar corrompido ou adulterado. Entre em contato com o suporte.',
            400
          );
        }

        // AUDITORIA: Registrar sucesso na validação de hash
        try {
          await AuditService.log(req, {
            modulo: 'BACKUP',
            acao: 'VALIDACAO_HASH',
            entidade: 'BACKUP',
            entidadeId: id,
            dadosNovos: {
              hash_verificado: true,
              hash_sha256: calculatedHash.substring(0, 16) + '...',
            },
            observacao: `Validação de hash SHA-256 bem-sucedida. Download permitido.`,
          });

          // Atualizar campo hashVerificado (após regenerar Prisma Client)
          // TODO: Descomentar após executar: npx prisma generate
          // await prisma.backupHistory.update({
          //   where: { id },
          //   data: { hashVerificado: true },
          // }).catch((error) => {
          //   console.warn('[BackupController] Erro ao atualizar hashVerificado:', error);
          //   // Não falhar se atualização falhar
          // });
        } catch (auditError) {
          console.warn('[BackupController] Erro ao registrar auditoria de sucesso de hash:', auditError);
          // Não falhar se auditoria falhar, mas logar
        }
      } catch (hashError) {
        // Se erro não for de validação, relançar
        if (hashError instanceof AppError) {
          throw hashError;
        }
        // Se for erro ao ler arquivo, lançar erro genérico
        console.error('[BackupController] Erro ao validar hash do backup:', hashError);
        throw new AppError('Erro ao validar integridade do backup', 500);
      }
    }

    // VALIDAÇÃO DE ASSINATURA DIGITAL: Se backup tem assinatura, validar antes de permitir download
    const backupAssinatura = (backup as any).assinaturaDigital;
    const backupAlgoritmoAssinatura = (backup as any).algoritmoAssinatura;
    if (backupHash && backupAssinatura && backupAlgoritmoAssinatura) {
      try {
        const isValid = await DigitalSignatureService.verifySignature(backupHash, backupAssinatura);

        if (!isValid) {
          // AUDITORIA: Registrar falha de validação de assinatura
          await AuditService.log(req, {
            modulo: 'BACKUP',
            acao: 'VALIDACAO_ASSINATURA',
            entidade: 'BACKUP',
            entidadeId: id,
            dadosAnteriores: {
              algoritmo_assinatura: backupAlgoritmoAssinatura,
            },
            dadosNovos: {
              assinatura_valida: false,
            },
            observacao: `Validação de assinatura digital FALHOU ao tentar download. Backup possivelmente adulterado. Download BLOQUEADO.`,
          });

          throw new AppError(
            'Assinatura digital inválida: o backup pode ter sido adulterado. Download bloqueado por segurança.',
            400
          );
        }

        // AUDITORIA: Registrar sucesso na validação de assinatura
        try {
          await AuditService.log(req, {
            modulo: 'BACKUP',
            acao: 'VALIDACAO_ASSINATURA',
            entidade: 'BACKUP',
            entidadeId: id,
            dadosNovos: {
              assinatura_valida: true,
              algoritmo_assinatura: backupAlgoritmoAssinatura,
            },
            observacao: `Validação de assinatura digital bem-sucedida. Backup autenticado. Download permitido.`,
          });
        } catch (auditError) {
          console.warn('[BackupController] Erro ao registrar auditoria de sucesso de assinatura:', auditError);
          // Não falhar se auditoria falhar
        }
      } catch (signError) {
        // Se erro for AppError (assinatura inválida), relançar
        if (signError instanceof AppError) {
          throw signError;
        }
        // Se for outro erro, logar mas não bloquear (backup pode não ter assinatura)
        console.error('[BackupController] Erro ao verificar assinatura digital:', signError);
      }
    }
    
    // Obter informações do arquivo
    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    
    // Definir nome do arquivo para download
    // Embora o conteúdo original seja SQL (via pg_dump), ele pode estar criptografado.
    // Usamos extensão .sql para deixar claro que é um dump lógico da base.
    const downloadFileName = `backup_${backup.instituicao?.nome || 'instituicao'}_${backup.id.substring(0, 8)}_${backup.createdAt.toISOString().split('T')[0]}.sql`;
    
    // Configurar headers (genérico / binário para suportar arquivo criptografado)
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stats.size.toString());
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
    
    // IMPORTANTE: Download NÃO descriptografa automaticamente
    // O arquivo é enviado como está (criptografado ou não)
    // Se criptografado, o cliente precisa descriptografar manualmente
    
    // Auditoria - download
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'BACKUP_DOWNLOADED',
      entidade: 'BACKUP',
      entidadeId: id,
      dadosNovos: {
        backup_id: id,
        instituicao_id: backup.instituicaoId,
        tamanho_bytes: backup.tamanhoBytes,
        criptografado: (backup as any).criptografado,
        hash_sha256: (backup as any).hashSha256,
      },
    });
    
    // Stream do arquivo (SEM descriptografia - arquivo como está)
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error: Error) => {
      next(new AppError('Erro ao ler arquivo de backup', 500));
    });
  } catch (error) {
    next(error);
  }
};

export const upload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRÍTICO: instituicaoId vem EXCLUSIVAMENTE do JWT
    const instituicaoId = requireTenantScope(req);
    
    // NOTA: Verificação de aceite de termo legal é feita pelo middleware checkAceiteTermo
    
    // Obter arquivo enviado
    const file = req.file;
    
    if (!file) {
      throw new AppError('Arquivo de backup é obrigatório', 400);
    }
    
    // Ler conteúdo do arquivo
    let backupData: any;
    try {
      const fileContent = await fs.readFile(file.path, 'utf8');
      backupData = JSON.parse(fileContent);
    } catch (parseError) {
      // Limpar arquivo temporário em caso de erro
      try {
        await fs.unlink(file.path);
      } catch {
        // Ignorar erro ao deletar
      }
      
      if (parseError instanceof SyntaxError) {
        throw new AppError('Arquivo JSON inválido', 400);
      }
      throw new AppError('Erro ao ler arquivo de backup', 400);
    }
    
    // Validar formato do backup
    if (!backupData || !backupData.metadata) {
      // Limpar arquivo temporário
      try {
        await fs.unlink(file.path);
      } catch {
        // Ignorar erro ao deletar
      }
      throw new AppError('Formato de backup inválido. Metadados não encontrados.', 400);
    }
    
    // NOTA: Verificação de aceite de termo legal é feita pelo middleware checkAceiteTermo

    // VALIDAÇÃO CRÍTICA: Backup deve pertencer à mesma instituição do usuário
    if (backupData.metadata.instituicao_id !== instituicaoId) {
      // Limpar arquivo temporário
      try {
        await fs.unlink(file.path);
      } catch {
        // Ignorar erro ao deletar
      }
      
      // Auditoria de tentativa de upload cross-tenant
      await AuditService.log(req, {
        modulo: 'BACKUP',
        acao: 'BLOCK_RESTORE',
        entidade: 'BACKUP',
        dadosNovos: {
          backup_instituicao_id: backupData.metadata.instituicao_id,
          user_instituicao_id: instituicaoId,
          backup_id: backupData.metadata.backup_id,
          tipo_operacao: 'UPLOAD',
        },
        observacao: 'Tentativa de fazer upload de backup de outra instituição bloqueada',
      });
      
      throw new AppError(
        'Acesso negado: Este backup pertence a outra instituição. Não é permitido fazer upload de backups de outras instituições.',
        403
      );
    }
    
    // Criar registro BackupHistory tipo UPLOAD
    const backupRecord = await prisma.backupHistory.create({
      data: {
        instituicaoId,
        userId: req.user?.userId,
        userEmail: req.user?.email,
        tipo: 'upload',
        status: 'em_progresso',
        tamanhoBytes: file.size,
      },
    });
    
    try {
      // Auditoria - início do upload/restore (ADMIN - modo NORMAL)
      await AuditService.log(req, {
        modulo: 'BACKUP',
        acao: 'RESTORE_STARTED',
        entidade: 'BACKUP',
        entidadeId: backupRecord.id,
        dadosNovos: {
          backup_id: backupData.metadata.backup_id,
          backup_date: backupData.metadata.generated_at,
          tipo_operacao: 'UPLOAD',
          arquivo_original: file.originalname,
          modo: 'NORMAL',
        },
      });
      
      // Executar restore (ADMIN - modo NORMAL)
      const resultado = await BackupService.restoreBackup(instituicaoId, backupData, {
        userId: req.user?.userId,
        userEmail: req.user?.email,
        modo: 'NORMAL',
        confirm: true, // Confirmação obrigatória
        backupId: backupData.metadata?.backup_id || null,
      });
      
      // Limpar arquivo temporário após sucesso
      try {
        await fs.unlink(file.path);
      } catch {
        // Ignorar erro ao deletar
      }
      
      // Atualizar registro com sucesso
      await prisma.backupHistory.update({
        where: { id: backupRecord.id },
        data: {
          status: 'concluido',
        },
      });
      
      // Auditoria - sucesso (ADMIN - modo NORMAL)
      await AuditService.log(req, {
        modulo: 'BACKUP',
        acao: 'RESTORE_COMPLETED',
        entidade: 'BACKUP',
        entidadeId: backupRecord.id,
        dadosNovos: {
          backup_id: backupData.metadata.backup_id,
          restored: resultado.restored,
          tipo_operacao: 'UPLOAD',
          modo: 'NORMAL',
        },
      });
      
      res.json({
        success: true,
        message: 'Backup restaurado com sucesso via upload',
        restoreId: backupRecord.id,
        restored: resultado.restored,
      });
    } catch (restoreError) {
      // Limpar arquivo temporário em caso de erro
      try {
        await fs.unlink(file.path);
      } catch {
        // Ignorar erro ao deletar
      }
      
      // Atualizar registro com erro
      await prisma.backupHistory.update({
        where: { id: backupRecord.id },
        data: {
          status: 'erro',
          erro: restoreError instanceof Error ? restoreError.message : 'Erro desconhecido',
        },
      });
      
      // Auditoria - erro
      await AuditService.log(req, {
        modulo: 'BACKUP',
        acao: 'RESTORE_FAILED',
        entidade: 'BACKUP',
        entidadeId: backupRecord.id,
        observacao: `Erro ao restaurar backup via upload: ${restoreError instanceof Error ? restoreError.message : 'Erro desconhecido'}`,
      });
      
      throw restoreError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Restaurar backup a partir do histórico (ADMIN da instituição)
 * POST /backup/history/:id/restore
 *
 * Usa o formato novo (dump SQL/criptografado via pg_dump) ou JSON legado,
 * carregando o arquivo diretamente do servidor e aplicando as mesmas regras
 * de hash, assinatura e multi-tenant já usadas no fluxo excepcional.
 */
export const restoreFromHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRÍTICO: instituicaoId vem EXCLUSIVAMENTE do JWT
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { options } = req.body || {};

    // Buscar backup da própria instituição
    const backup = await prisma.backupHistory.findFirst({
      where: {
        id,
        instituicaoId,
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

    if (!backup) {
      throw new AppError('Backup não encontrado ou não pertence à sua instituição', 404);
    }

    if (backup.status !== 'concluido') {
      throw new AppError(`Backup ainda não está completo. Status: ${backup.status}`, 400);
    }

    if (!backup.arquivoUrl) {
      throw new AppError('Arquivo de backup não encontrado', 404);
    }

    // Carregar backup do arquivo (SQL Enterprise ou JSON legado)
    const backupData = await BackupService.loadBackupFromFile(backup.arquivoUrl, instituicaoId);

    // Registrar início do restore (ADMIN - modo NORMAL)
    const restoreRecord = await prisma.backupHistory.create({
      data: {
        instituicaoId,
        userId: req.user?.userId,
        userEmail: req.user?.email,
        tipo: 'restauracao',
        status: 'em_progresso',
      },
    });

    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'RESTORE_STARTED',
      entidade: 'BACKUP',
      entidadeId: restoreRecord.id,
      dadosNovos: {
        backup_id: backup.id,
        backup_date: backup.createdAt.toISOString(),
        options,
        modo: 'NORMAL',
        tipo_operacao: 'RESTORE',
      },
    });

    // Executar restore em background para não bloquear a requisição
    Promise.resolve()
      .then(async () => {
        try {
          const resultado = await BackupService.restoreBackup(instituicaoId, backupData, {
            ...(options || {}),
            userId: req.user?.userId,
            userEmail: req.user?.email,
            modo: 'NORMAL',
            confirm: true,
            backupId: backup.id,
          });

          await prisma.backupHistory.update({
            where: { id: restoreRecord.id },
            data: { status: 'concluido' },
          });

          await AuditService.log(req, {
            modulo: 'BACKUP',
            acao: 'RESTORE_COMPLETED',
            entidade: 'BACKUP',
            entidadeId: restoreRecord.id,
            dadosNovos: {
              backup_id: backup.id,
              restored: resultado.restored,
              modo: 'NORMAL',
            },
          });
        } catch (restoreError) {
          await prisma.backupHistory.update({
            where: { id: restoreRecord.id },
            data: {
              status: 'erro',
              erro: restoreError instanceof Error ? restoreError.message : 'Erro desconhecido',
            },
          });

          await AuditService.log(req, {
            modulo: 'BACKUP',
            acao: 'RESTORE_FAILED',
            entidade: 'BACKUP',
            entidadeId: restoreRecord.id,
            observacao: `Erro ao restaurar backup a partir do histórico: ${
              restoreError instanceof Error ? restoreError.message : 'Erro desconhecido'
            }`,
          });
        }
      })
      .catch((error) => {
        console.error('[BackupController] Erro não tratado no restoreFromHistory em background:', error);
      });

    // Resposta imediata ao cliente
    res.json({
      success: true,
      message: 'Restauração de backup iniciada a partir do histórico. O processo está executando em background.',
      restoreId: restoreRecord.id,
      status: 'em_progresso',
      instituicao: backup.instituicao?.nome || 'N/A',
    });
  } catch (error) {
    next(error);
  }
};

export const restore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRÍTICO: instituicaoId vem EXCLUSIVAMENTE do JWT
    const instituicaoId = requireTenantScope(req);
    const { backupData, options } = req.body;
    
    if (!backupData || !backupData.metadata) {
      throw new AppError('Formato de backup inválido. Metadados não encontrados.', 400);
    }

    // NOTA: Verificação de aceite de termo legal é feita pelo middleware checkAceiteTermo
    
    // VALIDAÇÃO CRÍTICA: Backup deve pertencer à mesma instituição do usuário
    if (backupData.metadata.instituicao_id !== instituicaoId) {
      // Auditoria de tentativa de restore cross-tenant
      await AuditService.log(req, {
        modulo: 'BACKUP',
        acao: 'BLOCK_RESTORE',
        entidade: 'BACKUP',
        dadosNovos: {
          backup_instituicao_id: backupData.metadata.instituicao_id,
          user_instituicao_id: instituicaoId,
          backup_id: backupData.metadata.backup_id,
        },
        observacao: 'Tentativa de restaurar backup de outra instituição bloqueada',
      });
      
      throw new AppError(
        'Acesso negado: Este backup pertence a outra instituição. Não é permitido restaurar backups de outras instituições.',
        403
      );
    }

    // VALIDAÇÃO DE TIPO DE INSTITUIÇÃO: Verificar compatibilidade de tipo
    const instituicaoAtual = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoInstituicao: true, tipoAcademico: true },
    });

    if (!instituicaoAtual) {
      throw new AppError('Instituição não encontrada', 404);
    }

    const tipoBackup = backupData.metadata.tipo_instituicao;
    const tipoAtual = instituicaoAtual.tipoInstituicao;

    // Validar compatibilidade de tipo de instituição
    const tiposCompativeis: Record<string, string[]> = {
      'MISTA': ['ENSINO_MEDIO', 'UNIVERSIDADE', 'MISTA', 'EM_CONFIGURACAO'],
      'EM_CONFIGURACAO': ['ENSINO_MEDIO', 'UNIVERSIDADE', 'MISTA', 'EM_CONFIGURACAO'],
      'UNIVERSIDADE': ['UNIVERSIDADE', 'MISTA'],
      'ENSINO_MEDIO': ['ENSINO_MEDIO', 'MISTA'],
    };

    const tiposPermitidos = tiposCompativeis[tipoAtual] || [];
    
    if (tipoBackup && !tiposPermitidos.includes(tipoBackup)) {
      // Auditoria de tentativa de restore com tipo incompatível
      await AuditService.log(req, {
        modulo: 'BACKUP',
        acao: 'BLOCK_RESTORE_TIPO_INCOMPATIVEL',
        entidade: 'BACKUP',
        dadosNovos: {
          backup_tipo_instituicao: tipoBackup,
          instituicao_tipo_atual: tipoAtual,
          backup_id: backupData.metadata.backup_id,
        },
        observacao: `Tentativa de restaurar backup de tipo ${tipoBackup} em instituição do tipo ${tipoAtual} bloqueada`,
      });
      
      throw new AppError(
        `Incompatibilidade de tipo de instituição: Este backup é de uma instituição do tipo ${tipoBackup || 'desconhecido'}, mas sua instituição é do tipo ${tipoAtual}. Não é permitido restaurar backups de tipos incompatíveis.`,
        400
      );
    }
    
    // Registrar início do restore
    const restoreRecord = await prisma.backupHistory.create({
      data: {
        instituicaoId,
        userId: req.user?.userId,
        userEmail: req.user?.email,
        tipo: 'restauracao',
        status: 'em_progresso',
      },
    });
    
    // Auditoria - início (ADMIN - modo NORMAL)
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'RESTORE_STARTED',
      entidade: 'BACKUP',
      entidadeId: restoreRecord.id,
      dadosNovos: {
        backup_id: backupData.metadata.backup_id,
        backup_date: backupData.metadata.generated_at,
        options,
        modo: 'NORMAL',
        tipo_operacao: 'RESTORE',
      },
    });
    
    // CRÍTICO: Executar restore em BACKGROUND (não bloquear request)
    // Usar Promise.resolve().then() para garantir execução assíncrona
    Promise.resolve().then(async () => {
      try {
        // Usar BackupService para restaurar (ADMIN - modo NORMAL)
        const resultado = await BackupService.restoreBackup(instituicaoId, backupData, {
          ...(options || {}),
          userId: req.user?.userId,
          userEmail: req.user?.email,
          modo: 'NORMAL',
          confirm: true, // Confirmação obrigatória
          backupId: backupData.metadata?.backup_id || null,
        });
        
        // Atualizar registro com sucesso
        await prisma.backupHistory.update({
          where: { id: restoreRecord.id },
          data: {
            status: 'concluido',
          },
        });
        
        // Auditoria - sucesso (ADMIN - modo NORMAL)
        await AuditService.log(req, {
          modulo: 'BACKUP',
          acao: 'RESTORE_COMPLETED',
          entidade: 'BACKUP',
          entidadeId: restoreRecord.id,
          dadosNovos: {
            backup_id: backupData.metadata.backup_id,
            restored: resultado.restored,
            modo: 'NORMAL',
            tipo_operacao: 'RESTORE',
          },
        });
        
        console.log(`[BackupController] Restore ${restoreRecord.id} concluído com sucesso em background`);
      } catch (restoreError) {
        // Atualizar registro com erro
        await prisma.backupHistory.update({
          where: { id: restoreRecord.id },
          data: {
            status: 'erro',
            erro: restoreError instanceof Error ? restoreError.message : 'Erro desconhecido',
          },
        });
        
        // Auditoria - erro
        await AuditService.log(req, {
          modulo: 'BACKUP',
          acao: 'RESTORE_FAILED',
          entidade: 'BACKUP',
          entidadeId: restoreRecord.id,
          observacao: `Erro ao restaurar backup: ${restoreError instanceof Error ? restoreError.message : 'Erro desconhecido'}`,
        });
        
        console.error(`[BackupController] Erro ao restaurar backup ${restoreRecord.id} em background:`, restoreError);
        // Não lançar erro - restore está em background, não deve quebrar o sistema
      }
    }).catch((error) => {
      // Capturar erros não tratados no restore em background
      console.error(`[BackupController] Erro não tratado no restore ${restoreRecord.id} em background:`, error);
    });
    
    // Retornar resposta imediata (restore está executando em background)
    res.json({
      success: true,
      message: 'Restauração de backup iniciada. O processo está executando em background.',
      restoreId: restoreRecord.id,
      status: 'em_progresso',
      note: 'O status do restore pode ser verificado consultando o histórico de backups.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar backups de todas as instituições (SUPER_ADMIN - Somente Leitura)
 * GET /admin/backups
 */
export const getGlobalBackups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verificar se é SUPER_ADMIN
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Acesso negado: apenas SUPER_ADMIN pode visualizar backups globais', 403);
    }

    const { instituicaoId, limit } = req.query;
    
    const where: any = {};
    
    // SUPER_ADMIN pode filtrar por instituição específica
    if (instituicaoId) {
      where.instituicaoId = instituicaoId as string;
    }

    const backups = await prisma.backupHistory.findMany({
      where,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
            subdominio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 100,
    });

    // Auditoria - visualização global
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'VIEW_GLOBAL',
      entidade: 'BACKUP',
      dadosNovos: {
        total_backups: backups.length,
        instituicao_id_filtro: instituicaoId || 'todas',
      },
    });

    // Converter campos de camelCase para snake_case (compatibilidade com frontend)
    const formatted = backups.map(backup => {
      const b = backup as any; // Acessar campos Enterprise
      return {
        id: backup.id,
        instituicao_id: backup.instituicaoId,
        user_id: backup.userId,
        user_email: backup.userEmail,
        tipo: backup.tipo,
        status: backup.status,
        arquivo_url: backup.arquivoUrl,
        tamanho_bytes: backup.tamanhoBytes,
        erro: backup.erro,
        // Campos Enterprise: Criptografia
        criptografado: b.criptografado || false,
        algoritmo: b.algoritmo || null,
        iv: b.iv || null,
        tag_autenticacao: b.tagAutenticacao || null,
        // Campos Enterprise: Integridade
        hash_sha256: b.hashSha256 || null,
        hash_verificado: b.hashVerificado || false,
        // Campos Enterprise: Assinatura Digital
        assinatura_digital: b.assinaturaDigital || null,
        algoritmo_assinatura: b.algoritmoAssinatura || null,
        assinatura_verificada: b.assinaturaVerificada || false,
        // Campos Enterprise: Retenção
        status_retencao: b.statusRetencao || 'ativo',
        expirado_em: b.expiradoEm ? new Date(b.expiradoEm).toISOString() : null,
        created_at: backup.createdAt.toISOString(),
        // Relacionamento
        instituicao: backup.instituicao ? {
          id: backup.instituicao.id,
          nome: backup.instituicao.nome,
          subdominio: backup.instituicao.subdominio,
        } : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * Forçar backup para uma instituição específica (SUPER_ADMIN - Ação Excepcional)
 * POST /admin/backups/forcar
 */
export const forcarBackup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verificar se é SUPER_ADMIN
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Acesso negado: apenas SUPER_ADMIN pode forçar backups', 403);
    }

    const { instituicaoId, tipo, justificativa } = req.body;

    // VALIDAÇÃO: instituicaoId obrigatório
    if (!instituicaoId) {
      throw new AppError('instituicaoId é obrigatório para ações excepcionais', 400);
    }

    // VALIDAÇÃO: justificativa obrigatória para SUPER_ADMIN
    if (!justificativa || typeof justificativa !== 'string' || justificativa.trim().length === 0) {
      throw new AppError('Justificativa é obrigatória para ações excepcionais do SUPER_ADMIN', 400);
    }

    // Verificar se instituição existe
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { id: true, nome: true },
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    const backupType = tipo || 'completo';

    // Gerar backup usando BackupService
    const resultado = await BackupService.generateBackup(
      instituicaoId,
      backupType,
      'manual',
      req.user?.userId,
      req.user?.email
    );

    // Buscar registro atualizado
    const backupRecord = await prisma.backupHistory.findUnique({
      where: { id: resultado.backupHistoryId },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!backupRecord) {
      throw new AppError('Registro de backup não encontrado', 404);
    }

    // Auditoria - ação excepcional
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'FORCE_GENERATE',
      entidade: 'BACKUP',
      entidadeId: resultado.backupHistoryId,
      dadosNovos: {
        tipo: backupType,
        tamanhoBytes: resultado.tamanhoBytes,
        arquivoUrl: resultado.arquivoUrl,
        instituicaoId,
        origem: 'excepcional',
        modo: 'EXCEPCIONAL',
      },
      observacao: `Ação excepcional do SUPER_ADMIN. Justificativa: ${justificativa}`,
    });

    // Retornar resultado
    res.status(201).json({
      ...backupRecord,
      arquivoUrl: resultado.arquivoUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Restaurar backup específico (SUPER_ADMIN - Ação Excepcional)
 * POST /admin/backups/:id/restaurar
 */
export const restaurarBackupExcepcional = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verificar se é SUPER_ADMIN
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Acesso negado: apenas SUPER_ADMIN pode restaurar backups excepcionalmente', 403);
    }

    const { id } = req.params;
    const { justificativa, palavraChave } = req.body;

    // VALIDAÇÃO: justificativa obrigatória para SUPER_ADMIN
    if (!justificativa || typeof justificativa !== 'string' || justificativa.trim().length === 0) {
      throw new AppError('Justificativa é obrigatória para ações excepcionais do SUPER_ADMIN', 400);
    }

    // ENTERPRISE: Verificar aceite de termo legal obrigatório para SUPER_ADMIN
    if (!req.user?.userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar backup para obter instituicaoId
    const backupTemp = await prisma.backupHistory.findUnique({
      where: { id },
      select: { instituicaoId: true },
    });

    if (!backupTemp || !backupTemp.instituicaoId) {
      throw new AppError('Backup não encontrado ou sem instituição associada', 404);
    }

    // Verificar aceite de termo legal
    const { TermoLegalService, TipoAcaoTermoLegal } = await import('../services/termoLegal.service.js');
    const verificarAceite = await TermoLegalService.verificarAceite(
      req.user.userId,
      backupTemp.instituicaoId,
      TipoAcaoTermoLegal.RESTORE_BACKUP
    );

    if (!verificarAceite.aceito) {
      // Retornar erro especial para o frontend exibir modal
      return res.status(403).json({
        error: 'TERMO_NAO_ACEITO',
        message: 'É necessário aceitar o termo legal antes de restaurar o backup',
        termo: verificarAceite.termo,
        termoId: verificarAceite.termoId,
      });
    }

    // Buscar backup
    const backup = await prisma.backupHistory.findUnique({
      where: { id },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!backup) {
      throw new AppError('Backup não encontrado', 404);
    }

    if (!backup.instituicaoId) {
      throw new AppError('Backup sem instituição associada', 400);
    }

    // Verificar se backup está completo
    if (backup.status !== 'concluido') {
      throw new AppError(`Backup ainda não está completo. Status: ${backup.status}`, 400);
    }

    if (!backup.arquivoUrl) {
      throw new AppError('Arquivo de backup não encontrado', 404);
    }

    // Garantir que instituicaoId não é null (já validado acima)
    const instituicaoIdRestore = backup.instituicaoId;

    // Carregar backup do arquivo
    const backupData = await BackupService.loadBackupFromFile(backup.arquivoUrl, instituicaoIdRestore);

    // Registrar início do restore
    const restoreRecord = await prisma.backupHistory.create({
      data: {
        instituicaoId: instituicaoIdRestore,
        userId: req.user?.userId,
        userEmail: req.user?.email,
        tipo: 'restauracao',
        status: 'em_progresso',
      },
    });

    // Auditoria - início (ação excepcional)
    await AuditService.log(req, {
      modulo: 'BACKUP',
      acao: 'RESTORE_EXCEPCIONAL_STARTED',
      entidade: 'BACKUP',
      entidadeId: restoreRecord.id,
      dadosNovos: {
        backup_id: id,
        backup_date: backup.createdAt.toISOString(),
        instituicao_id: instituicaoIdRestore,
        modo: 'EXCEPCIONAL',
      },
      observacao: `Ação excepcional do SUPER_ADMIN. Justificativa: ${justificativa}`,
    });

    // CRÍTICO: Executar restore em BACKGROUND (não bloquear request)
    // Usar Promise.resolve().then() para garantir execução assíncrona
    Promise.resolve().then(async () => {
      try {
        // Usar BackupService para restaurar (SUPER_ADMIN - modo EXCEPCIONAL)
        const resultado = await BackupService.restoreBackup(instituicaoIdRestore, backupData, {
          userId: req.user?.userId,
          userEmail: req.user?.email,
          modo: 'EXCEPCIONAL',
          confirm: true, // Confirmação obrigatória
          backupId: id, // ID do backup sendo restaurado
        });

        // Atualizar registro com sucesso
        await prisma.backupHistory.update({
          where: { id: restoreRecord.id },
          data: {
            status: 'concluido',
          },
        });

        // Auditoria - sucesso
        await AuditService.log(req, {
          modulo: 'BACKUP',
          acao: 'RESTORE_EXCEPCIONAL_COMPLETED',
          entidade: 'BACKUP',
          entidadeId: restoreRecord.id,
          dadosNovos: {
            backup_id: id,
            restored: resultado.restored,
            modo: 'EXCEPCIONAL',
          },
          observacao: `Restauração excepcional concluída. Justificativa: ${justificativa}`,
        });

        console.log(`[BackupController] Restore excepcional ${restoreRecord.id} concluído com sucesso em background`);
      } catch (restoreError) {
        // Atualizar registro com erro
        await prisma.backupHistory.update({
          where: { id: restoreRecord.id },
          data: {
            status: 'erro',
            erro: restoreError instanceof Error ? restoreError.message : 'Erro desconhecido',
          },
        });

        // Auditoria - erro
        await AuditService.log(req, {
          modulo: 'BACKUP',
          acao: 'RESTORE_EXCEPCIONAL_FAILED',
          entidade: 'BACKUP',
          entidadeId: restoreRecord.id,
          observacao: `Erro ao restaurar backup excepcionalmente: ${restoreError instanceof Error ? restoreError.message : 'Erro desconhecido'}. Justificativa original: ${justificativa}`,
        });

        console.error(`[BackupController] Erro ao restaurar backup excepcional ${restoreRecord.id} em background:`, restoreError);
        // Não lançar erro - restore está em background, não deve quebrar o sistema
      }
    }).catch((error) => {
      // Capturar erros não tratados no restore em background
      console.error(`[BackupController] Erro não tratado no restore excepcional ${restoreRecord.id} em background:`, error);
    });

    // Retornar resposta imediata (restore está executando em background)
    res.json({
      success: true,
      message: 'Restauração de backup excepcional iniciada. O processo está executando em background.',
      restoreId: restoreRecord.id,
      status: 'em_progresso',
      instituicao: backup.instituicao?.nome || 'N/A',
      note: 'O status do restore pode ser verificado consultando o histórico de backups.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exportar relatório de auditoria de backup em PDF (Enterprise)
 * GET /backup/audit/export
 */
export const exportAuditReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dataInicio, dataFim, operacao, backupId } = req.query;
    const filter = addInstitutionFilter(req);
    const isSuperAdmin = req.user?.roles.includes('SUPER_ADMIN');

    // Construir filtros de auditoria
    const auditWhere: any = {
      modulo: 'BACKUP',
    };

    // Aplicar filtro de instituição (SUPER_ADMIN vê tudo, ADMIN apenas sua instituição)
    if (!isSuperAdmin) {
      auditWhere.instituicaoId = filter.instituicaoId;
    } else if (filter.instituicaoId) {
      // SUPER_ADMIN pode filtrar por instituição específica
      auditWhere.instituicaoId = filter.instituicaoId;
    }

    // Filtros opcionais
    if (dataInicio) {
      auditWhere.createdAt = { ...auditWhere.createdAt, gte: new Date(dataInicio as string) };
    }
    if (dataFim) {
      auditWhere.createdAt = { ...auditWhere.createdAt, lte: new Date(dataFim as string) };
    }
    if (operacao) {
      auditWhere.acao = operacao;
    }
    if (backupId) {
      auditWhere.entidadeId = backupId;
    }

    // Buscar logs de auditoria
    const logs = await prisma.logAuditoria.findMany({
      where: auditWhere,
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limitar para não sobrecarregar o PDF
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Buscar informações da instituição para cabeçalho
    let instituicaoNome = 'DSICOLA';
    const instId = getInstituicaoIdFromFilter(filter);
    if (instId) {
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: instId },
        select: { nome: true },
      });
      if (instituicao) {
        instituicaoNome = instituicao.nome;
      }
    }

    // Gerar PDF
    return new Promise<void>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          
          // Configurar headers
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="auditoria-backup_${new Date().toISOString().split('T')[0]}.pdf"`
          );
          res.setHeader('Content-Length', pdfBuffer.length.toString());

          res.send(pdfBuffer);
          resolve();
        });
        doc.on('error', reject);

        // Cabeçalho
        doc.fontSize(16).font('Helvetica-Bold');
        doc.text(instituicaoNome.toUpperCase(), { align: 'center' });
        doc.moveDown(0.5);

        doc.fontSize(14).font('Helvetica-Bold');
        doc.text('RELATÓRIO DE AUDITORIA - BACKUP', { align: 'center' });
        doc.moveDown(1);

        // Período
        doc.fontSize(10).font('Helvetica');
        if (dataInicio || dataFim) {
          doc.text(
            `Período: ${dataInicio ? new Date(dataInicio as string).toLocaleDateString('pt-BR') : 'Início'} a ${
              dataFim ? new Date(dataFim as string).toLocaleDateString('pt-BR') : 'Fim'
            }`
          );
        } else {
          doc.text(`Período: Todos os registros`);
        }
        doc.text(`Total de registros: ${logs.length}`);
        doc.text(`Exportado em: ${new Date().toLocaleString('pt-BR')}`);
        doc.text(`Exportado por: ${req.user?.email || 'Sistema'}`);
        doc.moveDown(1);

        // Filtros aplicados
        if (operacao || backupId) {
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Filtros Aplicados:', { underline: true });
          doc.fontSize(10).font('Helvetica');
          if (operacao) {
            doc.text(`Operação: ${operacao}`);
          }
          if (backupId) {
            doc.text(`Backup ID: ${backupId}`);
          }
          doc.moveDown(1);
        }

        // Tabela de logs
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('REGISTROS DE AUDITORIA', { underline: true });
        doc.moveDown(0.5);

        let yPos = doc.y;
        const pageWidth = doc.page.width - 100; // Margens
        const colWidths = {
          data: 60,
          operacao: 80,
          usuario: 100,
          backupId: 100,
          status: 80,
        };

        // Cabeçalho da tabela
        doc.fontSize(9).font('Helvetica-Bold');
        doc.fillColor('#000000');
        doc.text('Data/Hora', 50, yPos);
        doc.text('Operação', 50 + colWidths.data, yPos);
        doc.text('Usuário', 50 + colWidths.data + colWidths.operacao, yPos);
        doc.text('Backup ID', 50 + colWidths.data + colWidths.operacao + colWidths.usuario, yPos);
        doc.text('Status', 50 + colWidths.data + colWidths.operacao + colWidths.usuario + colWidths.backupId, yPos);

        yPos += 15;
        doc.moveTo(50, yPos - 5).lineTo(pageWidth + 50, yPos - 5).stroke();

        // Dados da tabela
        doc.fontSize(8).font('Helvetica');
        let currentY = yPos;

        for (const log of logs) {
          // Verificar se precisa de nova página
          if (currentY > doc.page.height - 100) {
            doc.addPage();
            currentY = 50;

            // Re-desenhar cabeçalho da tabela
            doc.fontSize(9).font('Helvetica-Bold');
            doc.fillColor('#000000');
            doc.text('Data/Hora', 50, currentY);
            doc.text('Operação', 50 + colWidths.data, currentY);
            doc.text('Usuário', 50 + colWidths.data + colWidths.operacao, currentY);
            doc.text('Backup ID', 50 + colWidths.data + colWidths.operacao + colWidths.usuario, currentY);
            doc.text('Status', 50 + colWidths.data + colWidths.operacao + colWidths.usuario + colWidths.backupId, currentY);
            currentY += 15;
            doc.moveTo(50, currentY - 5).lineTo(pageWidth + 50, currentY - 5).stroke();
            doc.fontSize(8).font('Helvetica');
          }

          const dataHora = new Date(log.createdAt).toLocaleString('pt-BR');
          const operacao = log.acao || '-';
          const usuario = log.userEmail || log.userNome || log.userId || 'Sistema';
          const backupId = log.entidadeId ? log.entidadeId.substring(0, 8) + '...' : '-';
          
          // Determinar status baseado na ação
          let status = 'SUCESSO';
          if (log.acao?.includes('BLOCK') || log.acao?.includes('FAILED')) {
            status = 'BLOQUEADO';
          } else if (log.acao?.includes('ERROR')) {
            status = 'ERRO';
          }

          doc.text(dataHora.substring(0, 16), 50, currentY, { width: colWidths.data });
          doc.text(operacao, 50 + colWidths.data, currentY, { width: colWidths.operacao });
          doc.text(usuario.substring(0, 20), 50 + colWidths.data + colWidths.operacao, currentY, { width: colWidths.usuario });
          doc.text(backupId, 50 + colWidths.data + colWidths.operacao + colWidths.usuario, currentY, { width: colWidths.backupId });
          doc.text(status, 50 + colWidths.data + colWidths.operacao + colWidths.usuario + colWidths.backupId, currentY, { width: colWidths.status });

          currentY += 12;
        }

        // Rodapé (simplificado - sem número de página para evitar complexidade)
        const footerY = doc.page.height - 30;
        doc.fontSize(8).font('Helvetica');
        doc.fillColor('#666666');
        doc.text(`Sistema DSICOLA - Relatório de Auditoria de Backup`, 50, footerY, { align: 'left' });

        // Finalizar PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    next(error);
  }
};
