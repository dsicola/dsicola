import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { requireTenantScope } from '../middlewares/auth.js';

/**
 * Módulos do sistema que podem ser auditados
 */
export enum ModuloAuditoria {
  CALENDARIO_ACADEMICO = 'CALENDARIO_ACADEMICO',
  PLANO_ENSINO = 'PLANO_ENSINO',
  DISTRIBUICAO_AULAS = 'DISTRIBUICAO_AULAS',
  LANCAMENTO_AULAS = 'LANCAMENTO_AULAS',
  PRESENCAS = 'PRESENCAS',
  AVALIACOES_NOTAS = 'AVALIACOES_NOTAS',
  PERIODO_LANCAMENTO_NOTAS = 'PERIODO_LANCAMENTO_NOTAS',
  TRIMESTRE = 'TRIMESTRE',
  ANO_LETIVO = 'ANO_LETIVO',
  CONFIGURACAO = 'CONFIGURACAO',
  RELATORIOS_OFICIAIS = 'RELATORIOS_OFICIAIS',
  DOCUMENTOS_OFICIAIS = 'DOCUMENTOS_OFICIAIS',
  FOLHA_PAGAMENTO = 'FOLHA_PAGAMENTO',
  PRESENCA_BIOMETRICA = 'PRESENCA_BIOMETRICA',
  JUSTIFICATIVA_FALTA = 'JUSTIFICATIVA_FALTA',
  RECURSOS_HUMANOS = 'RECURSOS_HUMANOS',
  LICENCIAMENTO = 'LICENCIAMENTO',
  COMUNICACAO = 'COMUNICACAO',
  BACKUP = 'BACKUP',
  RESTORE = 'RESTORE',
  TERMO_LEGAL = 'TERMO_LEGAL', // Termos legais institucionais e aceites
  BIBLIOTECA = 'BIBLIOTECA',
  FINANCEIRO = 'FINANCEIRO',
  ALUNOS = 'ALUNOS', // Módulo para operações acadêmicas de alunos (matrículas, equivalências, etc.)
  ACADEMICO = 'ACADEMICO', // Módulo acadêmico geral (conclusões, colações, certificados)
  INTEGRACAO_GOVERNAMENTAL = 'INTEGRACAO_GOVERNAMENTAL', // Integração com órgãos governamentais
  FORNECEDORES = 'FORNECEDORES', // Módulo de fornecedores/prestadores de serviço (pessoa jurídica)
  SEGURANCA = 'SEGURANCA', // Módulo de segurança (logins, resets, bloqueios)
}

/**
 * Entidades do sistema que podem ser auditadas
 */
export enum EntidadeAuditoria {
  EVENTO_CALENDARIO = 'EVENTO_CALENDARIO',
  PERIODO_LETIVO = 'PERIODO_LETIVO',
  PLANO_ENSINO = 'PLANO_ENSINO',
  PLANO_AULA = 'PLANO_AULA',
  DISTRIBUICAO_AULA = 'DISTRIBUICAO_AULA',
  AULA_LANCADA = 'AULA_LANCADA',
  PRESENCA = 'PRESENCA',
  AVALIACAO = 'AVALIACAO',
  NOTA = 'NOTA',
  PERIODO_LANCAMENTO_NOTAS = 'PERIODO_LANCAMENTO_NOTAS',
  TRIMESTRE = 'TRIMESTRE',
  ANO_LETIVO = 'ANO_LETIVO',
  RELATORIO_GERADO = 'RELATORIO_GERADO',
  FOLHA_PAGAMENTO = 'FOLHA_PAGAMENTO',
  FREQUENCIA_FUNCIONARIO = 'FREQUENCIA_FUNCIONARIO',
  JUSTIFICATIVA_FALTA = 'JUSTIFICATIVA_FALTA',
  EVENTO_BIOMETRICO = 'EVENTO_BIOMETRICO',
  BIOMETRIA_FUNCIONARIO = 'BIOMETRIA_FUNCIONARIO',
  ASSINATURA = 'ASSINATURA',
  COMUNICADO = 'COMUNICADO',
  MENSSAGEM_RESPONSAVEL = 'MENSAGEM_RESPONSAVEL',
  NOTIFICACAO = 'NOTIFICACAO',
  EMAIL_ENVIADO = 'EMAIL_ENVIADO',
  BACKUP = 'BACKUP',
  BACKUP_SCHEDULE = 'BACKUP_SCHEDULE',
  BACKUP_HISTORY = 'BACKUP_HISTORY',
  BIBLIOTECA_ITEM = 'BIBLIOTECA_ITEM',
  EMPRESTIMO_BIBLIOTECA = 'EMPRESTIMO_BIBLIOTECA',
  PAGAMENTO = 'PAGAMENTO',
  MENSALIDADE = 'MENSALIDADE',
  RECIBO = 'RECIBO',
  EQUIVALENCIA_DISCIPLINA = 'EQUIVALENCIA_DISCIPLINA',
  CONCLUSAO_CURSO = 'CONCLUSAO_CURSO',
  COLACAO_GRAU = 'COLACAO_GRAU',
  CERTIFICADO = 'CERTIFICADO',
  DOCUMENTO_EMITIDO = 'DOCUMENTO_EMITIDO',
  TERMO_LEGAL = 'TERMO_LEGAL',
  ACEITE_TERMO_LEGAL = 'ACEITE_TERMO_LEGAL',
  EVENTO_GOVERNAMENTAL = 'EVENTO_GOVERNAMENTAL',
  FORNECEDOR = 'FORNECEDOR',
  CONTRATO_FORNECEDOR = 'CONTRATO_FORNECEDOR',
  PAGAMENTO_FORNECEDOR = 'PAGAMENTO_FORNECEDOR',
  COMPROVANTE_ADMISSAO = 'COMPROVANTE_ADMISSAO', // Comprovante de admissão de funcionário
  HORARIO = 'HORARIO', // Impressão de horário (turma/professor)
  LOGIN_EVENT = 'LOGIN_EVENT', // Eventos de login (sucesso, falha, bloqueio)
  PASSWORD_RESET = 'PASSWORD_RESET', // Resets de senha
  TWO_FACTOR = 'TWO_FACTOR', // Configuração de 2FA
  USER = 'USER', // Usuário (2FA, perfil, etc.)
  INSTITUICAO = 'INSTITUICAO', // Instituição (2FA institucional, etc.)
}

/**
 * Ações que podem ser auditadas
 */
export enum AcaoAuditoria {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  CLOSE = 'CLOSE',
  REOPEN = 'REOPEN',
  BLOCK = 'BLOCK',
  GENERATE_REPORT = 'GENERATE_REPORT',
  ANULAR = 'ANULAR', // Anulação de documento emitido
  CALCULATE = 'CALCULATE',
  PAY = 'PAY',
  REVERSE_PAY = 'REVERSE_PAY',
  // Backup & Restore
  GENERATE = 'GENERATE',
  RESTORE_STARTED = 'RESTORE_STARTED',
  RESTORE_COMPLETED = 'RESTORE_COMPLETED',
  RESTORE_FAILED = 'RESTORE_FAILED',
  BLOCK_BACKUP_ACCESS = 'BLOCK_BACKUP_ACCESS',
  BLOCK_RESTORE = 'BLOCK_RESTORE',
  BACKUP_DOWNLOADED = 'BACKUP_DOWNLOADED',
  BACKUP_EXPIRADO = 'BACKUP_EXPIRADO',
  BACKUP_HASH = 'BACKUP_HASH', // Hash SHA-256 gerado após backup
  VALIDACAO_HASH = 'VALIDACAO_HASH', // Validação de hash antes de restore/download
  ASSINATURA_BACKUP = 'ASSINATURA_BACKUP', // Assinatura digital gerada para backup
  VALIDACAO_ASSINATURA = 'VALIDACAO_ASSINATURA', // Validação de assinatura digital antes de restore
  CRIPTOGRAFIA_BACKUP = 'CRIPTOGRAFIA_BACKUP', // Criptografia AES-256 do backup
  GERACAO_BACKUP = 'GERACAO_BACKUP', // Geração completa de backup (cadeia de confiança)
  VALIDACAO_BACKUP = 'VALIDACAO_BACKUP', // Validação completa do backup (hash + assinatura + auditoria)
  // Backup & Restore - Ações Excepcionais (SUPER_ADMIN)
  FORCE_GENERATE = 'FORCE_GENERATE',
  RESTORE_EXCEPCIONAL_STARTED = 'RESTORE_EXCEPCIONAL_STARTED',
  RESTORE_EXCEPCIONAL_COMPLETED = 'RESTORE_EXCEPCIONAL_COMPLETED',
  RESTORE_EXCEPCIONAL_FAILED = 'RESTORE_EXCEPCIONAL_FAILED',
  VIEW_GLOBAL = 'VIEW_GLOBAL',
  // Licenciamento
  CREATE_LICENSE = 'CREATE_LICENSE',
  RENEW_LICENSE = 'RENEW_LICENSE',
  SUSPEND_LICENSE = 'SUSPEND_LICENSE',
  PRICE_OVERRIDE = 'PRICE_OVERRIDE',
  // Pagamentos de Licença
  CREATE_PAYMENT = 'CREATE_PAYMENT',
  CONFIRM_PAYMENT = 'CONFIRM_PAYMENT',
  CANCEL_PAYMENT = 'CANCEL_PAYMENT',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  // Equivalência de Disciplinas
  DEFERIR = 'DEFERIR',
  INDEFERIR = 'INDEFERIR',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  // Comunicação
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_READ = 'MESSAGE_READ',
  EMAIL_SENT = 'EMAIL_SENT',
  EMAIL_FAILED = 'EMAIL_FAILED',
  BLOCK_COMMUNICATION = 'BLOCK_COMMUNICATION',
  SECURITY_ALERT = 'SECURITY_ALERT',
  // Segurança (Login, Reset, Bloqueio)
  LOGIN_SUCCESS = 'LOGIN_SUCCESS', // Login bem-sucedido
  LOGIN_FAILED = 'LOGIN_FAILED', // Tentativa de login falhada
  LOGIN_BLOCKED = 'LOGIN_BLOCKED', // Conta bloqueada por múltiplas tentativas
  LOGIN_UNLOCKED = 'LOGIN_UNLOCKED', // Desbloqueio automático após login bem-sucedido
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED', // Solicitação de reset de senha
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED', // Reset de senha concluído
  PASSWORD_CHANGED = 'PASSWORD_CHANGED', // Senha alterada pelo usuário
  // 2FA (Autenticação em Dois Fatores)
  ENABLE_2FA = 'ENABLE_2FA', // 2FA ativado
  DISABLE_2FA = 'DISABLE_2FA', // 2FA desativado
  RESET_2FA = 'RESET_2FA', // 2FA resetado (apenas SUPER_ADMIN)
  // Termos Legais
  ACEITE_TERMO = 'ACEITE_TERMO', // Aceite de termo legal obrigatório
  VALIDACAO_TERMO = 'VALIDACAO_TERMO', // Validação de termo antes de ação crítica
  // Semestre automático
  SEMESTRE_INICIADO_AUTOMATICO = 'SEMESTRE_INICIADO_AUTOMATICO',
  SEMESTRE_INICIADO_MANUAL = 'SEMESTRE_INICIADO_MANUAL',
  TRIMESTRE_INICIADO_MANUAL = 'TRIMESTRE_INICIADO_MANUAL',
  // Ano Letivo
  ANO_LETIVO_ATIVADO = 'ANO_LETIVO_ATIVADO',
  ANO_LETIVO_ENCERRADO = 'ANO_LETIVO_ENCERRADO',
  ANO_LETIVO_REABERTO = 'ANO_LETIVO_REABERTO',
  ENCERRAMENTO_OVERRIDE = 'ENCERRAMENTO_OVERRIDE', // SUPER_ADMIN usando override
  CANCELAR = 'CANCELAR', // Cancelar operação (ex: evento governamental)
}

/**
 * Serviço centralizado de auditoria
 * Garante rastreabilidade total de ações críticas no sistema
 * LOGS SÃO IMUTÁVEIS - apenas INSERT, nunca UPDATE ou DELETE
 */
export class AuditService {
  /**
   * Verificar se logs acadêmicos estão ativados para a instituição
   */
  private static async verificarLogsAcademicosAtivados(instituicaoId: string | null): Promise<boolean> {
    if (!instituicaoId) {
      return true; // Se não há instituicaoId, permitir log (modo de compatibilidade)
    }

    try {
      const parametrosSistema = await prisma.parametrosSistema.findUnique({
        where: { instituicaoId },
        select: { ativarLogsAcademicos: true },
      });

      // Valor padrão: true (se não houver configuração, ativar por padrão)
      return parametrosSistema?.ativarLogsAcademicos ?? true;
    } catch (error) {
      // Em caso de erro, permitir log para não bloquear operações
      console.warn('[AuditService] Erro ao verificar ativarLogsAcademicos:', error);
      return true;
    }
  }

  /**
   * Verificar se o módulo é acadêmico
   */
  private static isModuloAcademico(modulo?: ModuloAuditoria | string): boolean {
    const modulosAcademicos = [
      ModuloAuditoria.PLANO_ENSINO,
      ModuloAuditoria.DISTRIBUICAO_AULAS,
      ModuloAuditoria.LANCAMENTO_AULAS,
      ModuloAuditoria.PRESENCAS,
      ModuloAuditoria.AVALIACOES_NOTAS,
      ModuloAuditoria.TRIMESTRE,
      ModuloAuditoria.ANO_LETIVO,
      ModuloAuditoria.ALUNOS,
      ModuloAuditoria.ACADEMICO,
      'PLANO_ENSINO',
      'DISTRIBUICAO_AULAS',
      'LANCAMENTO_AULAS',
      'PRESENCAS',
      'AVALIACOES_NOTAS',
      'TRIMESTRE',
      'ANO_LETIVO',
      'ALUNOS',
      'ACADEMICO',
    ];

    return modulo ? modulosAcademicos.includes(modulo) : false;
  }

  /**
   * Registrar ação de auditoria (ASSÍNCRONO - não bloqueia a operação principal)
   * LOGS SÃO IMUTÁVEIS - apenas INSERT, nunca UPDATE ou DELETE
   * VALIDAÇÃO: Verifica ativarLogsAcademicos antes de registrar logs acadêmicos
   */
  static async log(
    req: Request | null,
    params: {
      modulo?: ModuloAuditoria | string;
      acao: AcaoAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId?: string;
      dadosAnteriores?: any;
      dadosNovos?: any;
      observacao?: string;
      instituicaoId?: string; // Para auditoria de sistema (sem Request)
    }
  ): Promise<void> {
    // Executar de forma assíncrona para não bloquear a operação principal
    // Usar Promise.resolve().then() para garantir que não bloqueie
    Promise.resolve().then(async () => {
      try {
        // Suporte para auditoria de sistema (sem Request)
        let instituicaoId: string | null = null;
        let userId: string | null = null;
        let perfilUsuario = 'SYSTEM';
        let userNome = 'SYSTEM';
        let userEmail = 'system@dsicola.com';
        let ipOrigem = 'SYSTEM';
        let userAgent = 'DSICOLA-Scheduler';
        let rota = 'AUTO';

        if (req) {
          // Obter IP e User Agent (sempre, inclusive para login sem user)
          ipOrigem = req.ip || req.socket?.remoteAddress || (typeof req.headers['x-forwarded-for'] === 'string'
            ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
            : Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : null) || 'unknown';
          userAgent = (req.headers['user-agent'] as string) || 'unknown';

          // Capturar rota automaticamente
          rota = req.method + ' ' + (req.route?.path || req.path || req.url);

          const user = req.user;
          const isLoginEvent = params.entidade === EntidadeAuditoria.LOGIN_EVENT || 
            (params.modulo === ModuloAuditoria.SEGURANCA && String(params.acao || '').startsWith('LOGIN_'));

          // Para eventos de login, permitir log mesmo sem user (ex: LOGIN_FAILED - email não encontrado)
          if (!user && !isLoginEvent) {
            console.warn('[AuditService] Tentativa de log sem usuário autenticado');
            return;
          }

          // instituicaoId: para login events pode ser null
          if (isLoginEvent && (!user?.instituicaoId || user.userId == null)) {
            instituicaoId = user?.instituicaoId ?? params.instituicaoId ?? null;
          } else {
            try {
              instituicaoId = requireTenantScope(req);
            } catch {
              instituicaoId = user?.instituicaoId ?? params.instituicaoId ?? null;
            }
          }

          userId = user?.userId || null;

          // Determinar perfil do usuário
          perfilUsuario = user?.roles && user.roles.length > 0 ? user.roles[0] : (isLoginEvent ? 'VISITANTE' : 'UNKNOWN');

          // Dados do usuário: do profile ou do evento (para login failed, usar email do dadosNovos)
          userNome = user?.email || (params.dadosNovos as any)?.email || 'Unknown';
          userEmail = user?.email || (params.dadosNovos as any)?.email || '';

          if (user?.userId) {
            try {
              const userProfile = await prisma.user.findUnique({
                where: { id: user.userId },
                select: { nomeCompleto: true, email: true },
              });
              if (userProfile) {
                userNome = userProfile.nomeCompleto || userNome;
                userEmail = userProfile.email || userEmail;
              }
            } catch (error) {
              // Continuar sem dados adicionais do usuário
              console.warn('[AuditService] Erro ao buscar dados do usuário:', error);
            }
          }
        } else {
          // Auditoria de sistema (sem Request)
          instituicaoId = params.instituicaoId || null;
          userId = null; // Sistema não tem userId
        }

        // VALIDAÇÃO: Verificar se logs acadêmicos estão ativados (se módulo for acadêmico)
        if (this.isModuloAcademico(params.modulo)) {
          const logsAcademicosAtivados = await this.verificarLogsAcademicosAtivados(instituicaoId);
          if (!logsAcademicosAtivados) {
            // Logs acadêmicos desativados - não registrar
            return;
          }
        }

        // Calcular campos alterados (apenas para UPDATE)
        let camposAlterados: string[] | null = null;
        if (params.acao === 'UPDATE' && params.dadosAnteriores && params.dadosNovos) {
          try {
            const antes = typeof params.dadosAnteriores === 'string' 
              ? JSON.parse(params.dadosAnteriores) 
              : params.dadosAnteriores;
            const depois = typeof params.dadosNovos === 'string' 
              ? JSON.parse(params.dadosNovos) 
              : params.dadosNovos;
            
            camposAlterados = this.calcularCamposAlterados(antes, depois);
          } catch (error) {
            console.warn('[AuditService] Erro ao calcular campos alterados:', error);
          }
        }

        // Inferir domínio automaticamente baseado no módulo/entidade
        const dominio = this.inferirDominio(params.modulo, params.entidade);

        // Criar log de auditoria (APENAS INSERT - IMUTÁVEL)
        await prisma.logAuditoria.create({
          data: {
            instituicaoId: instituicaoId,
            modulo: params.modulo || null,
            entidade: params.entidade,
            entidadeId: params.entidadeId || null,
            acao: params.acao,
            dadosAnteriores: params.dadosAnteriores ? JSON.parse(JSON.stringify(params.dadosAnteriores)) : null,
            dadosNovos: params.dadosNovos ? JSON.parse(JSON.stringify(params.dadosNovos)) : null,
            camposAlterados: camposAlterados && camposAlterados.length > 0 ? (camposAlterados as object) : undefined,
            dominio: dominio,
            userId: userId,
            perfilUsuario: perfilUsuario,
            rota: rota,
            ipOrigem: typeof ipOrigem === 'string' ? ipOrigem : String(ipOrigem),
            userAgent: userAgent,
            observacao: params.observacao,
            // Campos de compatibilidade
            userEmail: userEmail,
            userNome: userNome,
            tabela: params.entidade, // Manter compatibilidade
            registroId: params.entidadeId, // Manter compatibilidade
          },
        });
      } catch (error) {
        // Não falhar a operação principal por erro de auditoria
        // Mas registrar o erro
        console.error('[AuditService] Erro ao registrar log de auditoria:', error);
      }
    }).catch((error) => {
      // Capturar erros não tratados
      console.error('[AuditService] Erro não tratado ao registrar log:', error);
    });
  }

  /**
   * Registrar criação de registro
   */
  static async logCreate(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      dadosNovos: any;
      observacao?: string;
    }
  ): Promise<void> {
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.CREATE,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosNovos: params.dadosNovos,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar atualização de registro
   */
  static async logUpdate(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      dadosAnteriores: any;
      dadosNovos: any;
      observacao?: string;
    }
  ): Promise<void> {
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.UPDATE,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosAnteriores: params.dadosAnteriores,
      dadosNovos: params.dadosNovos,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar exclusão de registro
   */
  static async logDelete(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      dadosAnteriores: any;
      observacao?: string;
    }
  ): Promise<void> {
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.DELETE,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosAnteriores: params.dadosAnteriores,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar aprovação (workflow)
   */
  static async logApprove(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      dadosNovos?: any;
      observacao?: string;
    }
  ): Promise<void> {
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.APPROVE,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosNovos: params.dadosNovos,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar rejeição (workflow) - requer justificativa
   */
  static async logReject(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      observacao: string; // OBRIGATÓRIO para rejeição
      dadosAnteriores?: any;
    }
  ): Promise<void> {
    if (!params.observacao || params.observacao.trim().length === 0) {
      throw new Error('Observação é obrigatória para rejeições');
    }
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.REJECT,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosAnteriores: params.dadosAnteriores,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar encerramento (trimestre/ano letivo)
   */
  static async logClose(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      dadosNovos?: any;
      observacao?: string;
    }
  ): Promise<void> {
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.CLOSE,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosNovos: params.dadosNovos,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar reabertura (trimestre/ano letivo) - requer justificativa
   */
  static async logReopen(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      observacao: string; // OBRIGATÓRIO para reabertura
      dadosAnteriores?: any;
      dadosNovos?: any;
    }
  ): Promise<void> {
    if (!params.observacao || params.observacao.trim().length === 0) {
      throw new Error('Observação é obrigatória para reaberturas');
    }
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.REOPEN,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosAnteriores: params.dadosAnteriores,
      dadosNovos: params.dadosNovos,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar bloqueio
   */
  static async logBlock(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      dadosAnteriores?: any;
      dadosNovos?: any;
      observacao?: string;
    }
  ): Promise<void> {
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.BLOCK,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosAnteriores: params.dadosAnteriores,
      dadosNovos: params.dadosNovos,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar submissão (workflow)
   */
  static async logSubmit(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      entidade: EntidadeAuditoria | string;
      entidadeId: string;
      dadosNovos?: any;
      observacao?: string;
    }
  ): Promise<void> {
    return this.log(req, {
      modulo: params.modulo,
      acao: AcaoAuditoria.SUBMIT,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosNovos: params.dadosNovos,
      observacao: params.observacao,
    });
  }

  /**
   * Registrar tentativa de acesso bloqueado (para auditoria de segurança)
   */
  static async logAccessBlocked(
    req: Request,
    params: {
      modulo?: ModuloAuditoria | string;
      acao: AcaoAuditoria | string;
      recurso?: string;
      motivo?: string;
    }
  ): Promise<void> {
    await this.log(req, {
      modulo: params.modulo,
      acao: 'BLOCK',
      entidade: params.recurso || 'SISTEMA',
      observacao: `Tentativa de ${params.acao} bloqueada: ${params.motivo || 'Permissão insuficiente'}`,
    });
  }

  /**
   * Calcular campos alterados comparando dados anteriores e novos
   * Retorna array de strings com nomes dos campos que mudaram
   * Exclui campos técnicos que não são relevantes para auditoria
   */
  private static calcularCamposAlterados(antes: any, depois: any): string[] {
    if (!antes || !depois || typeof antes !== 'object' || typeof depois !== 'object') {
      return [];
    }

    // Campos técnicos que devem ser ignorados na comparação
    const camposIgnorados = new Set([
      'createdAt',
      'created_at',
      'updatedAt',
      'updated_at',
      'id', // ID nunca muda, mas pode ser útil manter para referência
    ]);

    const camposAlterados: string[] = [];
    const todosCampos = new Set([...Object.keys(antes), ...Object.keys(depois)]);

    for (const campo of todosCampos) {
      // Ignorar campos técnicos
      if (camposIgnorados.has(campo)) {
        continue;
      }

      const valorAntes = antes[campo];
      const valorDepois = depois[campo];

      // Comparar valores (considerando null/undefined)
      // Normalizar para comparação: null e undefined são tratados como iguais
      const antesNormalizado = valorAntes === undefined ? null : valorAntes;
      const depoisNormalizado = valorDepois === undefined ? null : valorDepois;

      if (JSON.stringify(antesNormalizado) !== JSON.stringify(depoisNormalizado)) {
        camposAlterados.push(campo);
      }
    }

    return camposAlterados;
  }

  /**
   * Inferir domínio automaticamente baseado no módulo e entidade
   * ACADEMICO: Calendário, Plano de Ensino, Aulas, Presenças, Avaliações, Notas
   * FINANCEIRO: Mensalidades, Pagamentos, Bolsas, Multas
   * ADMINISTRATIVO: Usuários, Turmas, Cursos, Disciplinas, Configurações
   * SEGURANCA: Logins, Permissões, Bloqueios, Acessos
   */
  private static inferirDominio(modulo?: string | null, entidade?: string | null): string | null {
    const moduloStr = modulo?.toUpperCase() || '';
    const entidadeStr = entidade?.toUpperCase() || '';

    // Domínio ACADEMICO
    if (
      moduloStr.includes('CALENDARIO') ||
      moduloStr.includes('PLANO_ENSINO') ||
      moduloStr.includes('AULA') ||
      moduloStr.includes('PRESENCA') ||
      moduloStr.includes('AVALIACAO') ||
      moduloStr.includes('NOTA') ||
      moduloStr.includes('TRIMESTRE') ||
      moduloStr.includes('ANO_LETIVO') ||
      entidadeStr.includes('PLANO') ||
      entidadeStr.includes('AULA') ||
      entidadeStr.includes('PRESENCA') ||
      entidadeStr.includes('AVALIACAO') ||
      entidadeStr.includes('NOTA') ||
      entidadeStr.includes('CALENDARIO')
    ) {
      return 'ACADEMICO';
    }

    // Domínio FINANCEIRO
    if (
      moduloStr.includes('MENSALIDADE') ||
      moduloStr.includes('PAGAMENTO') ||
      moduloStr.includes('BOLSA') ||
      moduloStr.includes('MULTA') ||
      moduloStr.includes('FINANCEIRO') ||
      entidadeStr.includes('MENSALIDADE') ||
      entidadeStr.includes('PAGAMENTO') ||
      entidadeStr.includes('BOLSA') ||
      entidadeStr.includes('MULTA')
    ) {
      return 'FINANCEIRO';
    }

    // Domínio SEGURANCA
    if (
      moduloStr.includes('SEGURANCA') ||
      moduloStr.includes('LOGIN') ||
      moduloStr.includes('PERMISSAO') ||
      moduloStr.includes('ACESSO') ||
      entidadeStr.includes('LOGIN') ||
      entidadeStr.includes('PERMISSAO') ||
      entidadeStr.includes('ACESSO')
    ) {
      return 'SEGURANCA';
    }

    // Domínio ADMINISTRATIVO (padrão para outros casos)
    return 'ADMINISTRATIVO';
  }
}

