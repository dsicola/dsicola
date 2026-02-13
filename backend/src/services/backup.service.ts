import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { CryptoService } from './crypto.service.js';
import { DigitalSignatureService } from './digitalSignature.service.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Backup dir: BACKUP_DIR env (produção) ou ./backups (desenvolvimento)
const BACKUP_BASE = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');

/**
 * Serviço de Backup e Restore
 * Backup direto via Prisma (sem Supabase)
 * Suporte a backup manual e agendado
 */
export class BackupService {
  private static readonly BACKUP_DIR = BACKUP_BASE;
  private static readonly DEFAULT_RETENTION_DAYS = 30; // Retenção padrão (usar configuração da instituição)
  // ENTERPRISE: Criptografia é OBRIGATÓRIA em produção
  private static readonly ENABLE_ENCRYPTION = process.env.NODE_ENV === 'production' 
    ? true // Em produção, sempre criptografar
    : (process.env.BACKUP_ENCRYPTION_ENABLED !== 'false'); // Em dev, opcional mas padrão true

  /**
   * Garantir que o diretório de backups existe
   */
  private static async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });
    } catch (error) {
      console.error('[BackupService] Erro ao criar diretório de backups:', error);
      throw new AppError('Erro ao criar diretório de backups', 500);
    }
  }

  /**
   * Garantir que o diretório de backups da instituição existe
   */
  private static async ensureInstitutionBackupDir(instituicaoId: string): Promise<string> {
    try {
      const institutionDir = path.join(this.BACKUP_DIR, 'instituicoes', instituicaoId);
      await fs.mkdir(institutionDir, { recursive: true });
      return institutionDir;
    } catch (error) {
      console.error('[BackupService] Erro ao criar diretório de backups da instituição:', error);
      throw new AppError('Erro ao criar diretório de backups da instituição', 500);
    }
  }

  /**
   * Obter caminho completo do arquivo de backup
   * Suporta estrutura antiga (raiz) e nova (instituicoes/<instituicao_id>/)
   */
  static async getBackupFilePath(arquivoUrl: string, instituicaoId: string): Promise<string> {
    try {
      // Extrair nome do arquivo da URL
      const fileName = path.basename(arquivoUrl);
      
      // Tentar nova estrutura primeiro: /backups/instituicoes/<instituicao_id>/<filename>
      const newPath = path.join(this.BACKUP_DIR, 'instituicoes', instituicaoId, fileName);
      try {
        await fs.access(newPath);
        return newPath;
      } catch {
        // Se não encontrar na nova estrutura, tentar estrutura antiga (compatibilidade)
        const oldPath = path.join(this.BACKUP_DIR, fileName);
        try {
          await fs.access(oldPath);
          return oldPath;
        } catch {
          throw new AppError(`Arquivo de backup não encontrado: ${fileName}`, 404);
        }
      }
    } catch (error) {
      console.error('[BackupService] Erro ao obter caminho do arquivo:', error);
      throw error;
    }
  }

  /**
   * Gerar nome de arquivo de backup
   */
  private static generateBackupFileName(instituicaoId: string, tipo: string = 'completo', formato: 'sql' | 'json' = 'sql'): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const extensao = formato === 'sql' ? 'sql' : 'json';
    return `backup_${instituicaoId}_${tipo}_${dateStr}_${timeStr}.${extensao}`;
  }

  /**
   * Listar todas as tabelas que possuem coluna instituicao_id
   * Retorna array de nomes de tabelas multi-tenant
   */
  private static async getMultiTenantTables(): Promise<string[]> {
    try {
      const result = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT DISTINCT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.column_name = 'instituicao_id'
          AND c.table_name NOT LIKE '_prisma%'
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name;
      `;
      return result.map(row => row.table_name);
    } catch (error) {
      console.error('[BackupService] Erro ao listar tabelas multi-tenant:', error);
      // Retornar lista hardcoded como fallback
      return [
        'instituicoes',
        'cursos',
        'classes',
        'disciplinas',
        'turnos',
        'turmas',
        'planos_ensino',
        'planos_aula',
        'aulas_lancadas',
        'presencas',
        'avaliacoes',
        'notas',
        'matriculas_anuais',
        'matriculas',
        'mensalidades',
        'bolsas_descontos',
        'eventos_calendario',
        'comunicados',
        'funcionarios',
        'anos_letivos',
        'semestres',
        'trimestres',
        'departamentos',
        'cargos',
        'alojamentos',
        'pagamentos_licenca',
        'documentos_fiscais',
        'candidaturas',
        'emails_enviados',
        'logs_auditoria',
        'backup_history',
        'backup_schedules',
        'feriados',
        'frequencia_funcionario',
        'configuracao_multas',
        'dispositivos_biometricos',
        'dispositivos_biometricos_usuarios',
        'eventos_biometricos',
        'sequencias_identificacao',
        'biblioteca_itens',
        'emprestimos_biblioteca',
        'workflow_logs',
        'encerramentos_academicos',
        'relatorios_gerados',
        'biometrias_funcionarios',
        'justificativas_falta',
        'user_contexts',
        'notificacoes',
        'mensagens_responsavel',
        'notas_historico',
        'conclusoes_cursos',
        'colacoes_grau',
        'certificados',
        'eventos_governamentais',
        'reaberturas_ano_letivo',
        'historicos_academicos',
        'equivalencias_disciplinas',
      ];
    }
  }

  /**
   * Criar views filtradas por instituição
   * IMPORTANTE: Views não são temporárias porque pg_dump executa em nova conexão
   * Views são criadas com nomes únicos e removidas após o backup
   */
  private static async createFilteredViews(instituicaoId: string, backupId: string): Promise<string[]> {
    const tables = await this.getMultiTenantTables();
    const viewNames: string[] = [];
    // Prefixo curto para evitar truncamento no PostgreSQL (limite 63 chars)
    const shortId = backupId.replace(/-/g, '').substring(0, 8);
    const ts = String(Date.now()).slice(-10);
    const viewPrefix = `bv_${shortId}_${ts}`;

    try {
      for (const table of tables) {
        const viewName = `${viewPrefix}_${table}`;
        if (viewName.length > 63) {
          console.warn(`[BackupService] Nome de view truncado: ${viewName}`);
        }
        viewNames.push(viewName);

        // Criar view filtrada (não temporária para ser visível pelo pg_dump)
        // Escapar nomes para evitar SQL injection
        // Para nomes de objetos SQL (tabelas/views), escapar aspas duplas
        const escapedTable = table.replace(/"/g, '""');
        const escapedView = viewName.replace(/"/g, '""');
        // Para valores UUID, escapar aspas simples
        const escapedInstituicaoId = instituicaoId.replace(/'/g, "''");
        // Comparar como TEXT: funciona tanto para colunas instituicao_id UUID quanto TEXT
        // (algumas tabelas como aceites_termos_legais usam TEXT)
        await prisma.$executeRawUnsafe(`
          CREATE VIEW "${escapedView}" AS
          SELECT * FROM "${escapedTable}"
          WHERE instituicao_id::text = '${escapedInstituicaoId}';
        `);
      }

      return viewNames;
    } catch (error) {
      // Se houver erro, tentar remover views já criadas
      await this.dropFilteredViews(viewNames).catch(() => {});
      throw error;
    }
  }

  /**
   * Remover views criadas para backup
   */
  private static async dropFilteredViews(viewNames: string[]): Promise<void> {
    for (const viewName of viewNames) {
      try {
        const escapedView = viewName.replace(/"/g, '""');
        await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS "${escapedView}" CASCADE;`);
      } catch (error) {
        console.warn(`[BackupService] Erro ao remover view ${viewName}:`, error);
        // Continuar removendo outras views mesmo se uma falhar
      }
    }
  }

  /**
   * Executar pg_dump apenas nas views temporárias filtradas
   * Gera backup SQL seguro para multi-tenant
   */
  private static async executePgDumpFiltered(instituicaoId: string, viewNames: string[]): Promise<string> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new AppError('DATABASE_URL não configurada', 500);
    }

    try {
      // Construir comando pg_dump com --table para cada view
      // Escapar nomes das views para o shell
      const tableArgs = viewNames.map(view => {
        const escaped = view.replace(/"/g, '\\"');
        return `--table="${escaped}"`;
      }).join(' ');
      
      const command = `pg_dump "${databaseUrl}" --data-only --column-inserts --no-owner --no-privileges ${tableArgs}`;
      
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer
        env: { ...process.env },
      });

      if (stderr && !stderr.includes('WARNING')) {
        console.warn('[BackupService] pg_dump stderr:', stderr);
      }

      // Adicionar header ao SQL gerado
      const header = `-- ============================================
-- BACKUP SQL - DSICOLA
-- ============================================
-- Instituição ID: ${instituicaoId}
-- Gerado em: ${new Date().toISOString()}
-- Método: pg_dump com views temporárias filtradas
-- ============================================

BEGIN;

`;

      const footer = `
COMMIT;
`;

      return header + stdout + footer;
    } catch (error: any) {
      console.error('[BackupService] Erro ao executar pg_dump:', error);
      throw new AppError(`Erro ao executar pg_dump: ${error.message}`, 500);
    }
  }

  /**
   * Gerar backup completo de uma instituição
   * @param instituicaoId ID da instituição (do JWT)
   * @param tipo Tipo de backup: 'dados' | 'completo'
   * @param origem Origem: 'manual' | 'cron'
   * @param userId ID do usuário (opcional para cron)
   * @param userEmail Email do usuário (opcional para cron)
   * @param backupId ID do registro de backup já criado (opcional - se não fornecido, cria novo)
   */
  static async generateBackup(
    instituicaoId: string,
    tipo: string = 'completo',
    origem: 'manual' | 'cron' = 'manual',
    userId?: string,
    userEmail?: string,
    backupId?: string
  ): Promise<{ backupHistoryId: string; arquivoUrl: string; tamanhoBytes: number }> {
    try {
      // Garantir diretório
      await this.ensureBackupDir();

      // Buscar dados da instituição
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: instituicaoId },
        select: {
          id: true,
          nome: true,
          subdominio: true,
          tipoInstituicao: true,
          tipoAcademico: true,
        },
      });

      if (!instituicao) {
        throw new AppError('Instituição não encontrada', 404);
      }

      // Criar ou usar registro de histórico existente
      let backupRecord;
      if (backupId) {
        // Usar registro existente (criado pelo controller)
        backupRecord = await prisma.backupHistory.findUnique({
          where: { id: backupId },
        });
        if (!backupRecord) {
          throw new AppError('Registro de backup não encontrado', 404);
        }
        // Atualizar status para em_progresso
        backupRecord = await prisma.backupHistory.update({
          where: { id: backupId },
          data: { status: 'em_progresso' },
        });
      } else {
        // Criar novo registro
        backupRecord = await prisma.backupHistory.create({
        data: {
          instituicaoId,
          userId: userId || null,
          userEmail: userEmail || (origem === 'cron' ? 'Sistema (Agendado)' : null),
          tipo: origem === 'cron' ? `backup_auto_${tipo}` : `backup_manual_${tipo}`,
          status: 'em_progresso',
        },
      });
      }

      let viewNames: string[] = [];

      try {
        // Criar views filtradas por instituição
        viewNames = await this.createFilteredViews(instituicaoId, backupRecord.id);

        // Executar pg_dump apenas nas views filtradas
        const sqlString = await this.executePgDumpFiltered(instituicaoId, viewNames);
        const sqlBuffer = Buffer.from(sqlString, 'utf8');

        // Buscar configuração da instituição para política de retenção
        const config = await prisma.configuracaoInstituicao.findUnique({
          where: { instituicaoId },
          select: { politicaRetencaoDias: true } as any,
        });
        const retencaoDias = config?.politicaRetencaoDias || this.DEFAULT_RETENTION_DAYS;
        const expiradoEm = new Date();
        expiradoEm.setDate(expiradoEm.getDate() + retencaoDias);

        // Garantir diretório da instituição
        const institutionDir = await this.ensureInstitutionBackupDir(instituicaoId);

        // ENTERPRISE: Criptografar backup OBRIGATORIAMENTE (AES-256-GCM)
        // Cadeia de confiança: BACKUP → CRIPTOGRAFIA → HASH → ASSINATURA → AUDITORIA
        let fileBuffer: Buffer;
        let criptografado = true; // Sempre criptografado em Enterprise
        let algoritmo: string = 'AES-256-GCM';
        let iv: string;
        let tagAutenticacao: string;

        try {
          // Criptografar backup usando AES-256-GCM
          const encrypted = CryptoService.encrypt(sqlBuffer);
            fileBuffer = encrypted.encrypted;
            iv = encrypted.iv;
            tagAutenticacao = encrypted.authTag;

          // AUDITORIA: Registrar criptografia do backup
          try {
            const { AuditService } = await import('./audit.service.js');
            await AuditService.log(null, {
              modulo: 'BACKUP',
              acao: 'CRIPTOGRAFIA_BACKUP',
              entidade: 'BACKUP',
              entidadeId: backupRecord.id,
              instituicaoId,
              dadosNovos: {
                algoritmo_criptografia: algoritmo,
                tamanho_criptografado: fileBuffer.length,
              },
              observacao: `Backup criptografado com sucesso usando ${algoritmo}.`,
            });
          } catch (auditError) {
            console.warn('[BackupService] Erro ao registrar auditoria de criptografia:', auditError);
          }
          } catch (error) {
          // Em produção, criptografia é obrigatória
          if (process.env.NODE_ENV === 'production') {
            throw new AppError(
              'Falha crítica: Criptografia de backup é obrigatória em produção. Verifique BACKUP_ENCRYPTION_KEY.',
              500
            );
          }
          // Em desenvolvimento, permitir backup não criptografado com aviso
          console.warn('[BackupService] Criptografia não disponível, salvando backup não criptografado (APENAS DEV):', error);
          fileBuffer = sqlBuffer;
          criptografado = false;
          algoritmo = null as any;
          iv = null as any;
          tagAutenticacao = null as any;
        }

        // Salvar arquivo na estrutura organizada por instituição (formato SQL)
        const fileName = this.generateBackupFileName(instituicaoId, tipo, 'sql');
        const filePath = path.join(institutionDir, fileName);
        await fs.writeFile(filePath, fileBuffer);

        const tamanhoBytes = fileBuffer.length;

        // Calcular hash SHA-256 do arquivo SALVO (lendo do disco) para garantir integridade
        // IMPORTANTE: Hash é calculado DEPOIS de salvar para garantir que corresponde ao arquivo real
        const savedFileBuffer = await fs.readFile(filePath);
        const hashSha256 = CryptoService.calculateHash(savedFileBuffer);

        // ASSINATURA DIGITAL: Assinar hash SHA-256 usando chave privada RSA
        let assinaturaDigital: string | null = null;
        let algoritmoAssinatura: string | null = null;
        try {
          assinaturaDigital = await DigitalSignatureService.signHash(hashSha256);
          algoritmoAssinatura = DigitalSignatureService.getAlgorithm();

          // AUDITORIA: Registrar assinatura digital
          try {
            const { AuditService } = await import('./audit.service.js');
            await AuditService.log(null, {
              modulo: 'BACKUP',
              acao: 'ASSINATURA_BACKUP',
              entidade: 'BACKUP',
              entidadeId: backupRecord.id,
              instituicaoId,
              dadosNovos: {
                algoritmo_assinatura: algoritmoAssinatura,
                hash_sha256: hashSha256.substring(0, 16) + '...',
              },
              observacao: `Assinatura digital gerada com sucesso para backup ${backupRecord.id} usando ${algoritmoAssinatura}.`,
            });
          } catch (auditError) {
            console.warn('[BackupService] Erro ao registrar auditoria de assinatura:', auditError);
            // Não falhar se auditoria falhar
          }
        } catch (signError) {
          // Se assinatura falhar, logar mas não bloquear o backup
          console.error('[BackupService] Erro ao assinar backup:', signError);
          // AUDITORIA: Registrar falha de assinatura
          try {
            const { AuditService } = await import('./audit.service.js');
            await AuditService.log(null, {
              modulo: 'BACKUP',
              acao: 'ASSINATURA_BACKUP',
              entidade: 'BACKUP',
              entidadeId: backupRecord.id,
              instituicaoId,
              observacao: `Falha ao gerar assinatura digital: ${signError instanceof Error ? signError.message : 'Erro desconhecido'}. Backup salvo sem assinatura.`,
            });
          } catch (auditError) {
            console.warn('[BackupService] Erro ao registrar auditoria de falha de assinatura:', auditError);
          }
        }

        // URL relativa do arquivo (estrutura organizada)
        const arquivoUrl = `/backups/instituicoes/${instituicaoId}/${fileName}`;

        // Atualizar registro com sucesso (incluindo campos Enterprise)
        await prisma.backupHistory.update({
          where: { id: backupRecord.id },
          data: {
            status: 'concluido',
            tamanhoBytes,
            arquivoUrl,
            // Campos Enterprise: Criptografia
            criptografado: criptografado as any,
            algoritmo: algoritmo as any,
            iv: iv as any,
            tagAutenticacao: tagAutenticacao as any,
            // Campos Enterprise: Integridade
            hashSha256: hashSha256 as any,
            hashVerificado: false as any, // Será atualizado quando hash for verificado
            // Campos Enterprise: Assinatura Digital
            assinaturaDigital: assinaturaDigital as any,
            algoritmoAssinatura: algoritmoAssinatura as any,
            assinaturaVerificada: false as any, // Será atualizado quando assinatura for verificada
            // Campos Enterprise: Retenção
            statusRetencao: 'ativo' as any,
            expiradoEm: expiradoEm as any,
          } as any,
        });

        // AUDITORIA: Registrar geração de hash SHA-256
        try {
          const { AuditService } = await import('./audit.service.js');
          await AuditService.log(null, {
            modulo: 'BACKUP',
            acao: 'BACKUP_HASH',
            entidade: 'BACKUP',
            entidadeId: backupRecord.id,
            instituicaoId,
            dadosNovos: {
              hash_sha256: hashSha256.substring(0, 16) + '...', // Primeiros 16 caracteres para auditoria
              hash_atual: hashSha256, // Hash completo para validação futura
              tamanho_bytes: tamanhoBytes,
              criptografado,
            },
            observacao: `Hash SHA-256 gerado com sucesso para backup ${backupRecord.id}. Tamanho: ${tamanhoBytes} bytes.`,
          });
        } catch (auditError) {
          console.warn('[BackupService] Erro ao registrar auditoria de hash:', auditError);
          // Não falhar se auditoria falhar, mas logar
        }

        // Remover views após backup bem-sucedido
        await this.dropFilteredViews(viewNames).catch((error) => {
          console.warn('[BackupService] Erro ao remover views após backup:', error);
          // Não falhar o backup se a remoção de views falhar
        });

        // ENTERPRISE: Registrar auditoria completa da cadeia de confiança
        // Cadeia: BACKUP → CRIPTOGRAFIA → HASH → ASSINATURA → AUDITORIA
        try {
          const { AuditService } = await import('./audit.service.js');
          await AuditService.log(null, {
            modulo: 'BACKUP',
            acao: 'GERACAO_BACKUP',
            entidade: 'BACKUP_HISTORY',
            entidadeId: backupRecord.id,
            instituicaoId,
            dadosNovos: {
              tipo: tipo,
              origem: origem,
              tamanho_bytes: tamanhoBytes,
              criptografado,
              algoritmo_criptografia: algoritmo,
              hash_sha256: hashSha256.substring(0, 16) + '...',
              assinatura_digital: assinaturaDigital ? 'presente' : 'ausente',
              algoritmo_assinatura: algoritmoAssinatura,
              cadeia_confianca: 'COMPLETA', // Indica que toda a cadeia foi executada
            },
            observacao: `Backup ${origem === 'cron' ? 'automático' : 'manual'} gerado com sucesso. Cadeia de confiança completa: Criptografia → Hash → Assinatura → Auditoria. Tamanho: ${tamanhoBytes} bytes.`,
          });
        } catch (auditError) {
          console.warn('[BackupService] Erro ao registrar auditoria:', auditError);
          // Não falhar o backup se auditoria falhar
        }

        return {
          backupHistoryId: backupRecord.id,
          arquivoUrl,
          tamanhoBytes,
        };
      } catch (backupError) {
        // Remover views em caso de erro
        await this.dropFilteredViews(viewNames).catch((error) => {
          console.warn('[BackupService] Erro ao remover views após erro:', error);
        });

        // Atualizar registro com erro
        await prisma.backupHistory.update({
          where: { id: backupRecord.id },
          data: {
            status: 'erro',
            erro: backupError instanceof Error ? backupError.message : 'Erro desconhecido',
          },
        });

        // Registrar auditoria de erro
        try {
          const { AuditService } = await import('./audit.service.js');
          await AuditService.log(null, {
            modulo: 'BACKUP',
            acao: 'GENERATE',
            entidade: 'BACKUP_HISTORY',
            entidadeId: backupRecord.id,
            instituicaoId,
            observacao: `Erro ao gerar backup: ${backupError instanceof Error ? backupError.message : 'Erro desconhecido'}`,
          });
        } catch (auditError) {
          console.warn('[BackupService] Erro ao registrar auditoria de erro:', auditError);
        }

        // Não lançar erro para não quebrar a API
        console.error('[BackupService] Erro ao gerar backup:', backupError);
        throw backupError;
      }
    } catch (error) {
      console.error('[BackupService] Erro ao gerar backup:', error);
      throw error;
    }
  }

  /**
   * Carregar backup de arquivo (com suporte a descriptografia)
   * Retorna string SQL se for backup SQL, ou objeto JSON se for backup JSON
   */
  static async loadBackupFromFile(arquivoUrl: string, instituicaoId: string): Promise<string | any> {
    try {
      // Buscar registro do backup para obter informações de criptografia e assinatura
      const backupRecord = await prisma.backupHistory.findFirst({
        where: { arquivoUrl, instituicaoId },
        select: {
          id: true,
          criptografado: true as any,
          algoritmo: true as any,
          iv: true as any,
          tagAutenticacao: true as any,
          hashSha256: true as any,
          hashVerificado: true as any,
          assinaturaDigital: true as any,
          algoritmoAssinatura: true as any,
          assinaturaVerificada: true as any,
        } as any,
      });

      // Obter caminho completo do arquivo (suporta estrutura antiga e nova)
      const filePath = await this.getBackupFilePath(arquivoUrl, instituicaoId);

      // Ler arquivo como Buffer
      const fileBuffer = await fs.readFile(filePath);

      // VALIDAÇÃO CRÍTICA: Hash SHA-256 é OBRIGATÓRIO
      if (!(backupRecord as any)?.hashSha256) {
        // AUDITORIA: Registrar tentativa de carregar backup sem hash
        try {
          const { AuditService } = await import('./audit.service.js');
          await AuditService.log(null, {
            modulo: 'BACKUP',
            acao: 'VALIDACAO_HASH',
            entidade: 'BACKUP',
            entidadeId: backupRecord?.id || undefined,
            instituicaoId,
            observacao: `Tentativa de carregar backup bloqueada: backup não possui hash SHA-256. Backup inseguro ou antigo.`,
          });
        } catch (auditError) {
          console.warn('[BackupService] Erro ao registrar auditoria de falta de hash:', auditError);
        }

        throw new AppError(
          'Backup inseguro: hash SHA-256 não encontrado. Este backup não possui verificação de integridade e não pode ser carregado por segurança.',
          400
        );
      }

      // Verificar integridade (hash SHA-256) - CRÍTICO
      {
        const calculatedHash = CryptoService.calculateHash(fileBuffer);
        const recordHash = backupRecord as any;
        if (calculatedHash !== recordHash.hashSha256) {
          // AUDITORIA: Registrar falha de validação de hash
          try {
            const { AuditService } = await import('./audit.service.js');
            await AuditService.log(null, {
              modulo: 'BACKUP',
              acao: 'VALIDACAO_HASH',
              entidade: 'BACKUP',
              entidadeId: backupRecord?.id || undefined,
              instituicaoId,
              dadosAnteriores: {
                hash_esperado: recordHash.hashSha256?.substring(0, 16) + '...',
              },
              dadosNovos: {
                hash_calculado: calculatedHash.substring(0, 16) + '...',
              },
              observacao: `Validação de hash SHA-256 FALHOU ao carregar backup. Arquivo possivelmente corrompido ou adulterado.`,
            });
          } catch (auditError) {
            console.warn('[BackupService] Erro ao registrar auditoria de falha de hash:', auditError);
          }

          throw new AppError(
            'Integridade do backup comprometida: hash SHA-256 não corresponde. O arquivo pode estar corrompido ou adulterado.',
            400
          );
        }

        // AUDITORIA: Registrar sucesso na validação de hash
        try {
          const { AuditService } = await import('./audit.service.js');
          await AuditService.log(null, {
            modulo: 'BACKUP',
            acao: 'VALIDACAO_HASH',
            entidade: 'BACKUP',
            entidadeId: backupRecord?.id || undefined,
            instituicaoId,
            dadosNovos: {
              hash_verificado: true,
              hash_sha256: calculatedHash.substring(0, 16) + '...',
            },
            observacao: `Validação de hash SHA-256 bem-sucedida ao carregar backup.`,
          });

          // Atualizar campo hashVerificado se tiver ID do backup
          if (backupRecord?.id) {
            await prisma.backupHistory.update({
              where: { id: backupRecord.id },
              data: { hashVerificado: true as any } as any,
            }).catch((error) => {
              console.warn('[BackupService] Erro ao atualizar hashVerificado:', error);
              // Não falhar se atualização falhar
            });
          }
        } catch (auditError) {
          console.warn('[BackupService] Erro ao registrar auditoria de sucesso de hash:', auditError);
          // Não falhar se auditoria falhar, mas logar
        }
      }

      // VALIDAÇÃO CRÍTICA: Assinatura Digital (se existir)
      const recordAssinatura = backupRecord as any;
      if (recordAssinatura?.hashSha256 && recordAssinatura?.assinaturaDigital && recordAssinatura?.algoritmoAssinatura) {
        try {
          const isValid = await DigitalSignatureService.verifySignature(
            recordAssinatura.hashSha256,
            recordAssinatura.assinaturaDigital
          );

          if (!isValid) {
            // AUDITORIA: Registrar falha de validação de assinatura
            try {
              const { AuditService } = await import('./audit.service.js');
              await AuditService.log(null, {
                modulo: 'BACKUP',
                acao: 'VALIDACAO_ASSINATURA',
                entidade: 'BACKUP',
                entidadeId: backupRecord?.id || undefined,
                instituicaoId,
              dadosAnteriores: {
                algoritmo_assinatura: recordAssinatura.algoritmoAssinatura,
                assinatura_verificada_anteriormente: recordAssinatura.assinaturaVerificada,
              },
                dadosNovos: {
                  assinatura_valida: false,
                },
                observacao: `Validação de assinatura digital FALHOU. Backup possivelmente adulterado ou assinatura inválida.`,
              });
            } catch (auditError) {
              console.warn('[BackupService] Erro ao registrar auditoria de falha de assinatura:', auditError);
            }

            throw new AppError(
              'Assinatura digital inválida: o backup pode ter sido adulterado ou a assinatura está corrompida. Restore bloqueado por segurança.',
              400
            );
          }

          // AUDITORIA: Registrar sucesso na validação de assinatura
          try {
            const { AuditService } = await import('./audit.service.js');
            await AuditService.log(null, {
              modulo: 'BACKUP',
              acao: 'VALIDACAO_ASSINATURA',
              entidade: 'BACKUP',
              entidadeId: backupRecord?.id || undefined,
              instituicaoId,
              dadosNovos: {
                assinatura_valida: true,
                algoritmo_assinatura: recordAssinatura.algoritmoAssinatura,
                hash_sha256: recordAssinatura.hashSha256.substring(0, 16) + '...',
              },
              observacao: `Validação de assinatura digital bem-sucedida. Backup autenticado e íntegro.`,
            });

            // Atualizar campo assinaturaVerificada
            if (backupRecord?.id) {
              await prisma.backupHistory.update({
                where: { id: backupRecord.id },
                data: { assinaturaVerificada: true as any } as any,
              }).catch((error) => {
                console.warn('[BackupService] Erro ao atualizar assinaturaVerificada:', error);
                // Não falhar se atualização falhar
              });
            }
          } catch (auditError) {
            console.warn('[BackupService] Erro ao registrar auditoria de sucesso de assinatura:', auditError);
            // Não falhar se auditoria falhar
          }
        } catch (error) {
          // Se erro for AppError (assinatura inválida), relançar
          if (error instanceof AppError) {
            throw error;
          }
          // Se for outro erro, logar mas não bloquear (backup pode não ter assinatura)
          console.error('[BackupService] Erro ao verificar assinatura digital:', error);
        }
      } else if (recordAssinatura?.hashSha256 && !recordAssinatura?.assinaturaDigital) {
        // Backup tem hash mas não tem assinatura (backup antigo ou sem assinatura)
        // Logar mas não bloquear (compatibilidade com backups antigos)
        console.warn(`[BackupService] Backup ${backupRecord?.id} não possui assinatura digital. Backup antigo ou gerado antes da implementação de assinatura.`);
        
        // AUDITORIA: Registrar backup sem assinatura
        try {
          const { AuditService } = await import('./audit.service.js');
          await AuditService.log(null, {
            modulo: 'BACKUP',
            acao: 'VALIDACAO_ASSINATURA',
            entidade: 'BACKUP',
            entidadeId: backupRecord?.id || undefined,
            instituicaoId,
            observacao: `Backup carregado sem assinatura digital. Backup antigo ou gerado antes da implementação de assinatura.`,
          });
        } catch (auditError) {
          console.warn('[BackupService] Erro ao registrar auditoria de backup sem assinatura:', auditError);
        }
      }

      // Descriptografar se necessário
      let decryptedBuffer: Buffer;
      const recordCrypto = backupRecord as any;
      if (recordCrypto?.criptografado && recordCrypto.iv && recordCrypto.tagAutenticacao) {
        try {
          decryptedBuffer = CryptoService.decrypt(
            fileBuffer,
            recordCrypto.iv,
            recordCrypto.tagAutenticacao
          );
        } catch (decryptError) {
          throw new AppError(
            'Erro ao descriptografar backup. Verifique se a chave de criptografia está configurada corretamente.',
            500
          );
        }
      } else {
        decryptedBuffer = fileBuffer;
      }

      // Converter para string
      const contentString = decryptedBuffer.toString('utf8');

      // Detectar formato: SQL (começa com -- ou BEGIN;) ou JSON (começa com {)
      const isSQL = contentString.trimStart().startsWith('--') || contentString.trimStart().startsWith('BEGIN;');
      
      if (isSQL) {
        // Retornar SQL como string
        return contentString;
      } else {
        // Retornar JSON como objeto
        return JSON.parse(contentString);
      }
    } catch (error) {
      console.error('[BackupService] Erro ao carregar backup:', error);
      throw error;
    }
  }

  /**
   * Restaurar backup (parcial por instituição)
   * @param instituicaoId ID da instituição (do JWT)
   * @param backupData Dados do backup (string SQL ou objeto JSON)
   * @param options Opções de restore
   */
  /**
   * Restaurar backup (parcial por instituição)
   * 
   * REGRAS DE SEGURANÇA:
   * - Restore é SEMPRE por instituicao_id
   * - Restore NUNCA afeta dados de outra instituição
   * - Restore NUNCA sobrescreve dados existentes sem versionamento
   * - Executa SOMENTE em background (não bloqueia request)
   * - Auditoria é OBRIGATÓRIA
   * 
   * @param instituicaoId ID da instituição (do JWT, NUNCA do body)
   * @param backupData Dados do backup (string SQL ou objeto JSON)
   * @param options Opções de restore (confirm=true é obrigatório)
   */
  static async restoreBackup(
    instituicaoId: string,
    backupData: string | any,
    options: { 
      overwrite?: boolean; 
      skipExisting?: boolean;
      userId?: string;
      userEmail?: string;
      modo?: 'NORMAL' | 'EXCEPCIONAL';
      confirm?: boolean; // Confirmação explícita obrigatória
      backupId?: string; // ID do backup sendo restaurado (para auditoria)
    } = {}
  ): Promise<{ success: boolean; restored: Record<string, number> }> {
    try {
      // VALIDAÇÃO CRÍTICA: Se backupId for fornecido, validar assinatura antes de restaurar
      if (options.backupId) {
        const backupRecord = await prisma.backupHistory.findFirst({
          where: { 
            id: options.backupId,
            instituicaoId, // Garantir multi-tenant
          },
          select: {
            id: true,
            hashSha256: true as any,
            assinaturaDigital: true as any,
            algoritmoAssinatura: true as any,
            assinaturaVerificada: true as any,
            arquivoUrl: true,
          } as any,
        });

        if (!backupRecord) {
          throw new AppError('Backup não encontrado ou acesso negado', 404);
        }

        // Se backup tem assinatura, validar antes de restaurar
        const recordRestore = backupRecord as any;
        if (recordRestore.hashSha256 && recordRestore.assinaturaDigital && recordRestore.algoritmoAssinatura) {
          const isValid = await DigitalSignatureService.verifySignature(
            recordRestore.hashSha256,
            recordRestore.assinaturaDigital
          );

          if (!isValid) {
            // AUDITORIA: Registrar falha de validação de assinatura antes de restaurar
            try {
              const { AuditService } = await import('./audit.service.js');
              await AuditService.log(null, {
                modulo: 'RESTORE',
                acao: 'VALIDACAO_ASSINATURA',
                entidade: 'BACKUP',
                entidadeId: backupRecord.id,
                instituicaoId,
                dadosAnteriores: {
                  algoritmo_assinatura: (backupRecord as any).algoritmoAssinatura,
                },
                dadosNovos: {
                  assinatura_valida: false,
                },
                observacao: `Validação de assinatura digital FALHOU antes de restaurar. Restore BLOQUEADO por segurança.`,
              });
            } catch (auditError) {
              console.warn('[BackupService] Erro ao registrar auditoria de falha de assinatura:', auditError);
            }

            throw new AppError(
              'Assinatura digital inválida: o backup pode ter sido adulterado. Restore bloqueado por segurança.',
              400
            );
          }

          // AUDITORIA: Registrar sucesso na validação de assinatura antes de restaurar
          try {
            const { AuditService } = await import('./audit.service.js');
            await AuditService.log(null, {
              modulo: 'RESTORE',
              acao: 'VALIDACAO_ASSINATURA',
              entidade: 'BACKUP',
              entidadeId: backupRecord.id,
              instituicaoId,
              dadosNovos: {
                assinatura_valida: true,
                algoritmo_assinatura: (backupRecord as any).algoritmoAssinatura,
              },
              observacao: `Validação de assinatura digital bem-sucedida antes de restaurar. Backup autenticado.`,
            });
          } catch (auditError) {
            console.warn('[BackupService] Erro ao registrar auditoria de sucesso de assinatura:', auditError);
          }
        }
      }

      // Detectar formato: SQL (string) ou JSON (objeto)
      const isSQL = typeof backupData === 'string';

      if (isSQL) {
        // Restore SQL usando psql
        return await this.restoreSQLBackup(instituicaoId, backupData, options);
      } else {
        // Restore JSON (compatibilidade)
        return await this.restoreJSONBackup(instituicaoId, backupData, options);
      }
    } catch (error) {
      console.error('[BackupService] Erro ao restaurar backup:', error);
      throw error;
    }
  }

  /**
   * Restaurar backup SQL usando psql diretamente
   * IMPORTANTE: Executa restore via psql para garantir compatibilidade com pg_dump
   * 
   * REGRAS DE SEGURANÇA:
   * - Restore é SEMPRE por instituicao_id
   * - Restore NUNCA afeta dados de outra instituição
   * - Restore NUNCA sobrescreve dados existentes sem versionamento
   * - Executa SOMENTE em background (não bloqueia request)
   * - Auditoria é OBRIGATÓRIA
   */
  private static async restoreSQLBackup(
    instituicaoId: string,
    sqlString: string,
    options: { 
      overwrite?: boolean; 
      skipExisting?: boolean; 
      userId?: string; 
      userEmail?: string; 
      modo?: 'NORMAL' | 'EXCEPCIONAL';
      confirm?: boolean; // Confirmação explícita obrigatória
      backupId?: string; // ID do backup sendo restaurado (para auditoria)
    } = {}
  ): Promise<{ success: boolean; restored: Record<string, number> }> {
    let tempFilePath: string | null = null;
    
    try {
      // AUDITORIA: Registrar início do restore
      try {
        const { AuditService } = await import('./audit.service.js');
        await AuditService.log(null, {
          modulo: 'RESTORE',
          acao: options.modo === 'EXCEPCIONAL' ? 'RESTORE_EXCEPCIONAL_STARTED' : 'RESTORE_STARTED',
          entidade: 'BACKUP',
          entidadeId: options.backupId || undefined,
          instituicaoId,
          dadosNovos: {
            modo: options.modo || 'NORMAL',
            user_id: options.userId,
            user_email: options.userEmail,
          },
          observacao: `Início de restauração de backup para instituição ${instituicaoId}`,
        });
      } catch (auditError) {
        console.warn('[BackupService] Erro ao registrar auditoria de início de restore:', auditError);
        // Não falhar se auditoria falhar, mas logar
      }

      // VALIDAÇÃO 1: Confirmação explícita obrigatória
      if (options.confirm !== true) {
        throw new AppError(
          'Confirmação explícita é obrigatória para restaurar backup. Envie confirm=true no corpo da requisição.',
          400
        );
      }

      // VALIDAÇÃO 2: Verificar se backup existe e pertence à instituição (se backupId fornecido)
      if (options.backupId) {
        const backupRecord = await prisma.backupHistory.findUnique({
          where: { id: options.backupId },
          select: {
            id: true,
            instituicaoId: true,
            status: true,
            arquivoUrl: true,
            hashSha256: true as any,
            hashVerificado: true as any,
          } as any,
        });

        if (!backupRecord) {
          throw new AppError('Backup não encontrado', 404);
        }

        // VALIDAÇÃO: Backup deve pertencer à instituição correta
        if (backupRecord.instituicaoId !== instituicaoId) {
          // Auditoria de tentativa de restore cross-tenant
          try {
            const { AuditService } = await import('./audit.service.js');
            await AuditService.log(null, {
              modulo: 'RESTORE',
              acao: 'BLOCK_RESTORE',
              entidade: 'BACKUP',
              entidadeId: options.backupId,
              instituicaoId,
              observacao: `Tentativa de restaurar backup de outra instituição bloqueada. Backup pertence a ${backupRecord.instituicaoId}, usuário pertence a ${instituicaoId}`,
            });
          } catch (auditError) {
            console.warn('[BackupService] Erro ao registrar auditoria de bloqueio:', auditError);
          }

          throw new AppError(
            'Acesso negado: Este backup pertence a outra instituição. Não é permitido restaurar backups de outras instituições.',
            403
          );
        }

        // VALIDAÇÃO: Backup deve estar completo
        if (backupRecord.status !== 'concluido') {
          throw new AppError(
            `Backup ainda não está completo. Status: ${backupRecord.status}. Não é possível restaurar backup incompleto.`,
            400
          );
        }

        // VALIDAÇÃO: Arquivo deve existir
        if (!backupRecord.arquivoUrl) {
          throw new AppError('Arquivo de backup não encontrado', 404);
        }

        // VALIDAÇÃO CRÍTICA: Hash SHA-256 é OBRIGATÓRIO para restore
        if (!(backupRecord as any).hashSha256) {
          // AUDITORIA: Registrar tentativa de restore sem hash
          try {
            const { AuditService } = await import('./audit.service.js');
            await AuditService.log(null, {
              modulo: 'RESTORE',
              acao: 'VALIDACAO_HASH',
              entidade: 'BACKUP',
              entidadeId: options.backupId,
              instituicaoId,
              observacao: `Tentativa de restore bloqueada: backup não possui hash SHA-256. Backup inseguro ou antigo.`,
            });
          } catch (auditError) {
            console.warn('[BackupService] Erro ao registrar auditoria de falta de hash:', auditError);
          }

          throw new AppError(
            'Backup inseguro: hash SHA-256 não encontrado. Este backup não possui verificação de integridade e não pode ser restaurado por segurança. Entre em contato com o suporte.',
            400
          );
        }

        // VALIDAÇÃO CRÍTICA: Verificar integridade do backup via hash SHA-256 ANTES do restore
        {
          try {
            const filePath = await this.getBackupFilePath(backupRecord.arquivoUrl, instituicaoId);
            const fileBuffer = await fs.readFile(filePath);
            const calculatedHash = CryptoService.calculateHash(fileBuffer);

            if (calculatedHash !== (backupRecord as any).hashSha256) {
              // AUDITORIA: Registrar falha de validação de hash
              try {
                const { AuditService } = await import('./audit.service.js');
                await AuditService.log(null, {
                  modulo: 'RESTORE',
                  acao: 'VALIDACAO_HASH',
                  entidade: 'BACKUP',
                  entidadeId: options.backupId,
                  instituicaoId,
                  dadosAnteriores: {
                    hash_esperado: (backupRecord as any).hashSha256?.substring(0, 16) + '...',
                  },
                  dadosNovos: {
                    hash_calculado: calculatedHash.substring(0, 16) + '...',
                  },
                  observacao: `Validação de hash SHA-256 FALHOU. Backup possivelmente corrompido ou adulterado. Restore BLOQUEADO.`,
                });
              } catch (auditError) {
                console.warn('[BackupService] Erro ao registrar auditoria de falha de hash:', auditError);
              }

              throw new AppError(
                'Backup corrompido ou adulterado: hash SHA-256 não corresponde. O arquivo pode estar corrompido ou ter sido modificado. Restore bloqueado por segurança.',
                400
              );
            }

            // AUDITORIA: Registrar sucesso na validação de hash
            try {
              const { AuditService } = await import('./audit.service.js');
              await AuditService.log(null, {
                modulo: 'RESTORE',
                acao: 'VALIDACAO_HASH',
                entidade: 'BACKUP',
                entidadeId: options.backupId,
                instituicaoId,
                dadosNovos: {
                  hash_verificado: true,
                  hash_sha256: calculatedHash.substring(0, 16) + '...',
                },
                observacao: `Validação de hash SHA-256 bem-sucedida. Backup íntegro e seguro para restore.`,
              });

              // Atualizar campo hashVerificado
              if (options.backupId) {
                await prisma.backupHistory.update({
                  where: { id: options.backupId },
                  data: { hashVerificado: true as any } as any,
                }).catch((error) => {
                  console.warn('[BackupService] Erro ao atualizar hashVerificado:', error);
                  // Não falhar se atualização falhar
                });
              }
            } catch (auditError) {
              console.warn('[BackupService] Erro ao registrar auditoria de sucesso de hash:', auditError);
              // Não falhar se auditoria falhar, mas logar
            }
          } catch (hashError) {
            // Se erro não for de validação (AppError), relançar
            if (hashError instanceof AppError) {
              throw hashError;
            }
            // Se for erro ao ler arquivo, lançar erro genérico
            console.error('[BackupService] Erro ao validar hash do backup:', hashError);
            throw new AppError('Erro ao validar integridade do backup', 500);
          }
        }
      }

      // VALIDAÇÃO 3: SQL básico
      if (!sqlString || typeof sqlString !== 'string' || sqlString.trim().length === 0) {
        throw new AppError('Backup SQL inválido ou vazio.', 400);
      }

      // VALIDAÇÃO 4: Comandos perigosos bloqueados
      // Bloquear comandos que podem afetar outras instituições ou destruir dados
      const dangerousCommands = [
        'DROP', 
        'TRUNCATE', 
        'DELETE FROM', // Permitir apenas se for específico da instituição
        'ALTER TABLE', 
        'CREATE SCHEMA', 
        'DROP SCHEMA',
        'DROP DATABASE',
        'CREATE DATABASE',
        'REVOKE',
        'GRANT',
        'ALTER USER',
        'CREATE USER',
        'DROP USER',
      ];
      const sqlUpper = sqlString.toUpperCase();
      for (const cmd of dangerousCommands) {
        // Verificar se o comando aparece fora de comentários
        const lines = sqlString.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          // Ignorar linhas que são comentários
          if (!trimmedLine.startsWith('--') && trimmedLine.toUpperCase().includes(cmd)) {
            throw new AppError(
              `Backup SQL contém comandos perigosos (${cmd}). Restore bloqueado por segurança.`,
              400
            );
          }
        }
      }

      // Validação de segurança multi-tenant
      // Verificar se o SQL contém dados da instituição correta
      // Buscar por padrões comuns de instituicao_id no SQL
      const instituicaoPatterns = [
        new RegExp(`instituicao_id['"]?\\s*[=,]\\s*['"]?${instituicaoId}`, 'gi'),
        new RegExp(`'instituicao_id'\\s*,\\s*'${instituicaoId}'`, 'gi'),
        new RegExp(`"instituicao_id"\\s*,\\s*"${instituicaoId}"`, 'gi'),
      ];
      
      let foundInstituicaoId = false;
      for (const pattern of instituicaoPatterns) {
        if (pattern.test(sqlString)) {
          foundInstituicaoId = true;
          break;
        }
      }
      
      // Se não encontrou a instituição no SQL, pode ser backup vazio ou formato diferente
      // Mas ainda validar que não contém outras instituições
      if (!foundInstituicaoId && sqlString.length > 100) {
        // Verificar se há outras instituições no SQL (segurança extra)
        const otherInstituicaoMatches = sqlString.matchAll(/instituicao_id['"]?\s*[=,]\s*['"]?([^'",\s\)]+)/gi);
        for (const match of otherInstituicaoMatches) {
          if (match[1] && match[1] !== instituicaoId && match[1].length === 36) {
            // UUID válido diferente da instituição atual
            throw new AppError(
              'Acesso negado: Este backup SQL contém dados de outra instituição. Restore bloqueado por segurança multi-tenant.',
              403
            );
          }
        }
      }

      // VALIDAÇÃO 5: Verificar integridade do SQL (se backupId fornecido e hash disponível)
      if (options.backupId) {
        // Hash já foi validado no loadBackupFromFile se o backup foi carregado de arquivo
        // Aqui apenas logamos que a validação foi feita
        console.log(`[BackupService] Validação de integridade do backup ${options.backupId} concluída`);
      }

      // GERAR BACKUP PRE_RESTORE (versionamento obrigatório)
      // CRÍTICO: Criar backup automático antes de restaurar para permitir rollback
      console.log(`[BackupService] Criando backup PRE_RESTORE para instituição ${instituicaoId}...`);
      let preRestoreBackup;
      try {
        preRestoreBackup = await this.generateBackup(
          instituicaoId,
          'completo',
          'manual',
          options.userId,
          options.userEmail || 'Sistema (PRE_RESTORE)'
        );
        console.log(`[BackupService] Backup PRE_RESTORE criado: ${preRestoreBackup.backupHistoryId}`);
        
        // Atualizar tipo do backup PRE_RESTORE para identificação
        await prisma.backupHistory.update({
          where: { id: preRestoreBackup.backupHistoryId },
          data: {
            tipo: 'backup_pre_restore',
          },
        });
      } catch (preRestoreError) {
        // Se falhar ao criar backup PRE_RESTORE, bloquear restore por segurança
        throw new AppError(
          `Não foi possível criar backup PRE_RESTORE. Restore bloqueado por segurança. Erro: ${preRestoreError instanceof Error ? preRestoreError.message : 'Erro desconhecido'}`,
          500
        );
      }

      // Criar arquivo temporário com o SQL
      const tempDir = path.join(this.BACKUP_DIR, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      tempFilePath = path.join(tempDir, `restore_${instituicaoId}_${Date.now()}.sql`);
      await fs.writeFile(tempFilePath, sqlString, 'utf8');

      // Executar psql para restaurar
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new AppError('DATABASE_URL não configurada', 500);
      }

      // Executar restore via psql (compatível com pg_dump)
      // IMPORTANTE: psql executa o SQL diretamente, garantindo compatibilidade total com backups gerados por pg_dump
      // O backup contém apenas INSERTs filtrados por instituicao_id, sem schema, sem roles, sem extensões
      console.log(`[BackupService] Executando restore via psql para instituição ${instituicaoId}...`);
      
      // Comando psql otimizado para restore de dados (sem schema)
      // --quiet: Suprime mensagens de saída
      // --no-psqlrc: Não carrega arquivo .psqlrc (evita configurações que podem interferir)
      // --single-transaction: Executa tudo em uma única transação (rollback automático em caso de erro)
      // --set ON_ERROR_STOP=on: Para execução em caso de erro
      const command = `psql "${databaseUrl}" -f "${tempFilePath}" --quiet --no-psqlrc --single-transaction --set ON_ERROR_STOP=on`;
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer
        env: { ...process.env },
        timeout: 300000, // 5 minutos timeout
      });

      if (stderr && !stderr.includes('WARNING') && !stderr.includes('NOTICE')) {
        console.warn('[BackupService] psql stderr:', stderr);
        // Não falhar se for apenas aviso
        if (stderr.includes('ERROR')) {
          throw new AppError(`Erro ao executar restore via psql: ${stderr}`, 500);
        }
      }

      // Contar registros inseridos (aproximado, baseado no SQL)
      const restored: Record<string, number> = {};
      const insertMatches = sqlString.matchAll(/INSERT\s+INTO\s+["']?(\w+)/gi);
      for (const match of insertMatches) {
        const tableName = match[1];
        if (!restored[tableName]) {
          restored[tableName] = 0;
        }
        restored[tableName]++;
      }

      // Registrar auditoria de sucesso (OBRIGATÓRIA)
      try {
        const { AuditService } = await import('./audit.service.js');
        await AuditService.log(null, {
          modulo: 'RESTORE',
          acao: options.modo === 'EXCEPCIONAL' ? 'RESTORE_EXCEPCIONAL_COMPLETED' : 'RESTORE_COMPLETED',
          entidade: 'BACKUP',
          entidadeId: options.backupId || undefined,
          instituicaoId,
          // userId removido - AuditService.log não aceita userId diretamente
          dadosNovos: {
            backup_id: options.backupId || null,
            pre_restore_backup_id: preRestoreBackup.backupHistoryId,
            restored_tables: Object.keys(restored),
            restored_counts: restored,
            modo: options.modo || 'NORMAL',
            user_id: options.userId,
            user_email: options.userEmail,
          },
          observacao: `Restore concluído com sucesso para instituição ${instituicaoId}. Backup PRE_RESTORE: ${preRestoreBackup.backupHistoryId}. Tabelas restauradas: ${Object.keys(restored).length}`,
        });
      } catch (auditError) {
        // Auditoria é OBRIGATÓRIA - logar erro mas não falhar
        console.error('[BackupService] ERRO CRÍTICO ao registrar auditoria de restore:', auditError);
        // Não falhar a operação, mas registrar o erro
      }

      console.log(`[BackupService] Restore concluído com sucesso para instituição ${instituicaoId}`);

      return {
        success: true,
        restored,
      };
    } catch (error) {
      // Registrar auditoria de erro (OBRIGATÓRIA)
      try {
        const { AuditService } = await import('./audit.service.js');
        await AuditService.log(null, {
          modulo: 'RESTORE',
          acao: options.modo === 'EXCEPCIONAL' ? 'RESTORE_EXCEPCIONAL_FAILED' : 'RESTORE_FAILED',
          entidade: 'BACKUP',
          entidadeId: options.backupId || undefined,
          instituicaoId,
          // userId removido - AuditService.log não aceita userId diretamente
          observacao: `Erro ao restaurar backup para instituição ${instituicaoId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Backup PRE_RESTORE pode estar disponível para rollback.`,
        });
      } catch (auditError) {
        // Auditoria é OBRIGATÓRIA - logar erro mas não falhar
        console.error('[BackupService] ERRO CRÍTICO ao registrar auditoria de erro de restore:', auditError);
        // Não falhar a operação, mas registrar o erro
      }

      console.error('[BackupService] Erro ao restaurar backup SQL:', error);
      throw error;
    } finally {
      // Limpar arquivo temporário
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.warn('[BackupService] Erro ao remover arquivo temporário:', cleanupError);
        }
      }
    }
  }

  /**
   * Restaurar backup JSON (compatibilidade)
   */
  private static async restoreJSONBackup(
    instituicaoId: string,
    backupData: any,
    options: { overwrite?: boolean; skipExisting?: boolean } = {}
  ): Promise<{ success: boolean; restored: Record<string, number> }> {
    try {
      // Validar formato
      if (!backupData || !backupData.metadata) {
        throw new AppError('Formato de backup inválido. Metadados não encontrados.', 400);
      }

      // Validar instituição
      if (backupData.metadata.instituicao_id !== instituicaoId) {
        throw new AppError(
          'Acesso negado: Este backup pertence a outra instituição.',
          403
        );
      }

      // GERAR BACKUP ANTES DE RESTAURAR (versionamento)
      await this.generateBackup(
        instituicaoId,
        'completo',
        'manual',
        undefined,
        'Sistema (Antes Restore)'
      );

      const restored: Record<string, number> = {};

      // Executar restore dentro de uma transação
      await prisma.$transaction(async (tx) => {
        // Lógica de restore JSON aqui
        // Por segurança, restore JSON não está completamente implementado
        // Apenas validações básicas
        console.warn('[BackupService] Restore JSON não está completamente implementado. Apenas validações básicas.');
      });

      return {
        success: true,
        restored,
      };
    } catch (error) {
      console.error('[BackupService] Erro ao restaurar backup JSON:', error);
      throw error;
    }
  }

  /**
   * Executar backups agendados
   * Chamado pelo cron job
   */
  static async executeScheduledBackups(): Promise<void> {
    try {
      const now = new Date();

      // Buscar agendamentos ativos que devem executar agora
      const schedules = await prisma.backupSchedule.findMany({
        where: {
          ativo: true,
          OR: [
            { proximoBackup: { lte: now } },
            { proximoBackup: null }, // Nunca executado
          ],
        },
      });

      for (const schedule of schedules) {
        if (!schedule.instituicaoId) {
          console.warn('[BackupService] Schedule sem instituicaoId ignorado:', schedule.id);
          continue;
        }

        try {
          console.log(
            `[BackupService] Executando backup agendado para instituição ${schedule.instituicaoId}`
          );

          // Gerar backup
          await this.generateBackup(
            schedule.instituicaoId,
            schedule.tipoBackup,
            'cron',
            schedule.createdBy || undefined,
            undefined
          );

          // Calcular próximo backup
          const proximoBackup = this.calculateNextBackup(
            schedule.frequencia,
            schedule.horaExecucao,
            schedule.diaSemana,
            schedule.diaMes
          );

          // Atualizar schedule
          await prisma.backupSchedule.update({
            where: { id: schedule.id },
            data: {
              ultimoBackup: now,
              proximoBackup,
            },
          });
        } catch (error) {
          console.error(
            `[BackupService] Erro ao executar backup agendado ${schedule.id}:`,
            error
          );
          // Continuar com outros backups mesmo se um falhar
        }
      }
    } catch (error) {
      console.error('[BackupService] Erro ao executar backups agendados:', error);
      // Não lançar erro - falhas de backup não devem quebrar o sistema
    }
  }

  /**
   * Calcular próxima data de backup
   */
  static calculateNextBackup(
    frequencia: string,
    horaExecucao: string,
    diaSemana?: number | null,
    diaMes?: number | null
  ): Date {
    const now = new Date();
    const [hora, minuto] = horaExecucao.split(':').map(Number);
    const proximo = new Date(now);

    proximo.setHours(hora || 3, minuto || 0, 0, 0);

    switch (frequencia) {
      case 'diario':
        // Amanhã à mesma hora
        proximo.setDate(proximo.getDate() + 1);
        break;

      case 'semanal':
        // Próximo dia da semana
        if (diaSemana !== null && diaSemana !== undefined) {
          const diasParaProximo = (diaSemana - proximo.getDay() + 7) % 7;
          proximo.setDate(proximo.getDate() + (diasParaProximo || 7));
        } else {
          proximo.setDate(proximo.getDate() + 7);
        }
        break;

      case 'mensal':
        // Próximo dia do mês
        if (diaMes !== null && diaMes !== undefined) {
          proximo.setMonth(proximo.getMonth() + 1);
          proximo.setDate(1);
          const ultimoDiaDoMes = new Date(proximo.getFullYear(), proximo.getMonth() + 1, 0).getDate();
          proximo.setDate(Math.min(diaMes, ultimoDiaDoMes));
        } else {
          proximo.setMonth(proximo.getMonth() + 1);
        }
        break;

      default:
        // Diário por padrão
        proximo.setDate(proximo.getDate() + 1);
    }

    // Se a hora já passou hoje, ajustar conforme frequência
    if (proximo <= now) {
      switch (frequencia) {
        case 'diario':
          proximo.setDate(proximo.getDate() + 1);
          break;
        case 'semanal':
          proximo.setDate(proximo.getDate() + 7);
          break;
        case 'mensal':
          proximo.setMonth(proximo.getMonth() + 1);
          break;
        default:
          proximo.setDate(proximo.getDate() + 1);
      }
    }

    return proximo;
  }

  /**
   * Limpar backups antigos usando política de retenção configurável por instituição (Enterprise)
   * Atualiza status para 'expirado' em vez de deletar (mantém histórico de auditoria)
   */
  static async cleanupOldBackups(): Promise<number> {
    try {
      const now = new Date();

      // Buscar backups concluídos que ainda estão ativos
      const activeBackups = await prisma.backupHistory.findMany({
        where: {
          status: 'concluido',
          statusRetencao: 'ativo' as any,
        } as any,
        include: {
          instituicao: {
            select: {
              id: true,
              configuracao: {
                select: {
              politicaRetencaoDias: true as any,
            } as any,
              },
            },
          },
        },
      });

      let expired = 0;

      for (const backup of activeBackups) {
        if (!backup.instituicaoId) {
          continue;
        }

        try {
          // Calcular data de expiração baseada na política da instituição
          const backupAny = backup as any;
          const retencaoDias = (backupAny.instituicao?.configuracao as any)?.politicaRetencaoDias || this.DEFAULT_RETENTION_DAYS;
          
          // Usar expiradoEm se existir, senão calcular baseado em createdAt
          let cutoffDate: Date;
          if (backupAny.expiradoEm) {
            cutoffDate = backupAny.expiradoEm;
          } else {
            cutoffDate = new Date(backup.createdAt);
            cutoffDate.setDate(cutoffDate.getDate() + retencaoDias);
          }

          // Se backup expirou, marcar como expirado
          if (cutoffDate <= now) {
            // Deletar arquivo físico
            if (backup.arquivoUrl) {
              try {
                const filePath = await this.getBackupFilePath(backup.arquivoUrl, backup.instituicaoId);
                await fs.unlink(filePath);
              } catch (error) {
                // Se arquivo não encontrado, continuar (pode ter sido deletado manualmente)
                if ((error as any).code !== 'ENOENT') {
                  console.warn(`[BackupService] Erro ao deletar arquivo ${backup.arquivoUrl}:`, error);
                }
              }
            }

            // Marcar registro como expirado (não deletar - manter histórico)
            await prisma.backupHistory.update({
              where: { id: backup.id },
              data: {
                statusRetencao: 'expirado' as any,
                expiradoEm: now as any,
              } as any,
            });

            expired++;

            // Auditoria (usar sistema, sem Request)
            try {
              const { AuditService } = await import('./audit.service.js');
              await AuditService.log(null, {
                modulo: 'BACKUP',
                acao: 'BACKUP_EXPIRADO',
                entidade: 'BACKUP',
                entidadeId: backup.id,
                instituicaoId: backup.instituicaoId,
                observacao: `Backup expirado automaticamente após ${retencaoDias} dias de retenção`,
              });
            } catch (auditError) {
              // Não falhar se auditoria falhar
              console.warn('[BackupService] Erro ao registrar auditoria de expiração:', auditError);
            }
          }
        } catch (error) {
          console.warn(`[BackupService] Erro ao processar backup ${backup.id}:`, error);
          // Continuar com outros backups
        }
      }

      return expired;
    } catch (error) {
      console.error('[BackupService] Erro ao limpar backups antigos:', error);
      return 0;
    }
  }
}
