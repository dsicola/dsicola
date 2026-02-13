import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from './audit.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Tipos de notificação conforme especificação
 */
export enum TipoNotificacao {
  // SISTÊMICAS (ALTA PRIORIDADE) - Não podem ser desativadas
  ENCERRAMENTO_ANO_LETIVO = 'ENCERRAMENTO_ANO_LETIVO',
  REABERTURA_ANO_LETIVO = 'REABERTURA_ANO_LETIVO',
  ASSINATURA_EXPIRADA = 'ASSINATURA_EXPIRADA',
  BLOQUEIO_ASSINATURA = 'BLOQUEIO_ASSINATURA',
  ALTERACAO_CRITICA = 'ALTERACAO_CRITICA',

  // ADMINISTRATIVAS
  MATRICULA_REALIZADA = 'MATRICULA_REALIZADA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  EQUIVALENCIA = 'EQUIVALENCIA',
  PROFESSOR_CRIADO = 'PROFESSOR_CRIADO',
  TURMA_CRIADA = 'TURMA_CRIADA',
  ALTERACAO_ACADEMICA = 'ALTERACAO_ACADEMICA',

  // ACADÊMICAS
  PROFESSOR_ATRIBUIDO = 'PROFESSOR_ATRIBUIDO',
  TURMA_VINCULADA = 'TURMA_VINCULADA',
  AULA_CRIADA = 'AULA_CRIADA',
  AVALIACAO_CRIADA = 'AVALIACAO_CRIADA',
  NOTA_LANCADA = 'NOTA_LANCADA',
  AVISO_DISCIPLINA = 'AVISO_DISCIPLINA',
  PRESENCA_REGISTRADA = 'PRESENCA_REGISTRADA',
  CHAT_MESSAGE = 'CHAT_MESSAGE',

  // INFORMATIVAS
  AVISO_INSTITUCIONAL = 'AVISO_INSTITUCIONAL',
  COMUNICADO = 'COMUNICADO',
  LEMBRETE = 'LEMBRETE',
  
  // GENÉRICO
  INFO = 'INFO',
  SUCESSO = 'SUCESSO',
  AVISO = 'AVISO',
  ERRO = 'ERRO',
}

/**
 * Interface para criar notificação
 */
export interface CriarNotificacaoParams {
  userId: string;
  titulo: string;
  mensagem: string;
  tipo?: TipoNotificacao | string;
  link?: string;
  instituicaoId?: string; // Opcional: se não fornecido, vem do req
  prioridade?: 'alta' | 'normal' | 'baixa';
}

/**
 * Serviço centralizado de notificações
 * Garante:
 * - Multi-tenant seguro
 * - RBAC correto
 * - Nunca quebra fluxos principais (try/catch)
 * - Notificações contextuais e objetivas
 */
export class NotificacaoService {
  /**
   * Validar que usuário pertence ao tenant
   */
  private static async validarTenant(instituicaoId: string, userId: string): Promise<boolean> {
    try {
      const usuario = await prisma.user.findUnique({
        where: { id: userId },
        select: { instituicaoId: true },
      });

      return usuario?.instituicaoId === instituicaoId;
    } catch (error) {
      console.error('[NotificacaoService] Erro ao validar tenant:', error);
      return false;
    }
  }

  /**
   * Validar RBAC - verificar se usuário deve receber notificação baseado no perfil
   */
  private static async validarRBAC(
    userId: string,
    tipo: TipoNotificacao | string,
    contexto?: any
  ): Promise<boolean> {
    try {
      const usuario = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
      });

      if (!usuario) return false;

      const roles = usuario.roles.map(r => r.role);
      const isAdmin = roles.includes('ADMIN') || roles.includes('SECRETARIA');
      const isSuperAdmin = roles.includes('SUPER_ADMIN');
      const isProfessor = roles.includes('PROFESSOR');
      const isAluno = roles.includes('ALUNO');

      // Notificações sistêmicas: todos recebem (exceto SUPER_ADMIN sem instituição)
      if (
        tipo === TipoNotificacao.ENCERRAMENTO_ANO_LETIVO ||
        tipo === TipoNotificacao.REABERTURA_ANO_LETIVO ||
        tipo === TipoNotificacao.ASSINATURA_EXPIRADA ||
        tipo === TipoNotificacao.BLOQUEIO_ASSINATURA ||
        tipo === TipoNotificacao.ALTERACAO_CRITICA
      ) {
        return true;
      }

      // Notificações administrativas: ADMIN, SECRETARIA
      if (
        tipo === TipoNotificacao.MATRICULA_REALIZADA ||
        tipo === TipoNotificacao.TRANSFERENCIA ||
        tipo === TipoNotificacao.EQUIVALENCIA ||
        tipo === TipoNotificacao.PROFESSOR_CRIADO ||
        tipo === TipoNotificacao.TURMA_CRIADA ||
        tipo === TipoNotificacao.ALTERACAO_ACADEMICA
      ) {
        return isAdmin || isSuperAdmin;
      }

      // Notificações acadêmicas: PROFESSOR, ALUNO (conforme contexto)
      if (tipo === TipoNotificacao.PROFESSOR_ATRIBUIDO) {
        return isProfessor;
      }

      if (tipo === TipoNotificacao.NOTA_LANCADA || tipo === TipoNotificacao.PRESENCA_REGISTRADA) {
        return isAluno; // Aluno recebe notificação de suas próprias notas/presenças
      }

      if (tipo === TipoNotificacao.AULA_CRIADA || tipo === TipoNotificacao.AVALIACAO_CRIADA) {
        // Professor e aluno recebem (contexto específico será validado pela função chamadora)
        return isProfessor || isAluno;
      }

      if (tipo === TipoNotificacao.AVISO_DISCIPLINA) {
        return isAluno; // Alunos recebem avisos do mural da disciplina
      }

      if (tipo === TipoNotificacao.CHAT_MESSAGE) {
        return true; // Participantes do chat recebem (validação feita no ChatService)
      }

      // Notificações informativas: todos podem receber
      if (
        tipo === TipoNotificacao.AVISO_INSTITUCIONAL ||
        tipo === TipoNotificacao.COMUNICADO ||
        tipo === TipoNotificacao.LEMBRETE
      ) {
        return true;
      }

      // Genérico: permitir (validação será feita caso a caso)
      return true;
    } catch (error) {
      console.error('[NotificacaoService] Erro ao validar RBAC:', error);
      return false; // Em caso de erro, não criar notificação
    }
  }

  /**
   * Criar notificação de forma segura (multi-tenant + RBAC)
   * NUNCA quebra o fluxo principal - erros são logados mas não lançados
   */
  static async criar(
    req: Request | null,
    params: CriarNotificacaoParams
  ): Promise<any | null> {
    try {
      // Determinar instituicaoId
      let instituicaoId: string | null = null;
      
      if (params.instituicaoId) {
        instituicaoId = params.instituicaoId;
      } else if (req) {
        try {
          instituicaoId = requireTenantScope(req);
        } catch (error: any) {
          // Se não tiver instituição no token (ex: SUPER_ADMIN), tentar buscar do usuário
          if (error?.message?.includes('escopo de instituição')) {
            const usuario = await prisma.user.findUnique({
              where: { id: params.userId },
              select: { instituicaoId: true },
            });
            instituicaoId = usuario?.instituicaoId || null;
          } else {
            throw error;
          }
        }
      } else {
        // Se não tiver req nem instituicaoId, buscar do usuário
        const usuario = await prisma.user.findUnique({
          where: { id: params.userId },
          select: { instituicaoId: true },
        });
        instituicaoId = usuario?.instituicaoId || null;
      }

      if (!instituicaoId) {
        console.warn(`[NotificacaoService] Instituição não encontrada para notificação: ${params.titulo}`);
        return null; // Não criar notificação sem instituição
      }

      // Validar tenant
      const tenantValido = await this.validarTenant(instituicaoId, params.userId);
      if (!tenantValido) {
        console.warn(
          `[NotificacaoService] Tentativa de criar notificação para usuário de outro tenant: ${params.userId}`
        );
        return null; // Não criar notificação para outro tenant
      }

      // Validar RBAC
      const rbacValido = await this.validarRBAC(params.userId, params.tipo || TipoNotificacao.INFO);
      if (!rbacValido) {
        // Silenciosamente não criar - usuário não deve receber esta notificação
        return null;
      }

      // Criar notificação
      const notificacao = await prisma.notificacao.create({
        data: {
          userId: params.userId,
          titulo: params.titulo,
          mensagem: params.mensagem,
          tipo: params.tipo || TipoNotificacao.INFO,
          link: params.link || null,
          instituicaoId,
        },
      });

      // Auditoria (não bloquear se falhar)
      if (req) {
        try {
          await AuditService.log(req, {
            modulo: 'COMUNICACAO',
            acao: 'MESSAGE_SENT',
            entidade: 'Notificacao',
            entidadeId: notificacao.id,
            dadosNovos: { titulo: params.titulo, userId: params.userId, tipo: params.tipo },
          });
        } catch (auditError) {
          console.error('[NotificacaoService] Erro na auditoria (não crítico):', auditError);
        }
      }

      return notificacao;
    } catch (error: any) {
      // CRÍTICO: Nunca lançar erro - apenas logar
      console.error(`[NotificacaoService] Erro ao criar notificação (não crítico):`, {
        erro: error.message,
        titulo: params.titulo,
        userId: params.userId,
        stack: error.stack,
      });
      return null; // Retornar null em vez de lançar erro
    }
  }

  /**
   * Criar múltiplas notificações (para eventos que afetam vários usuários)
   */
  static async criarMultiplas(
    req: Request | null,
    paramsList: CriarNotificacaoParams[]
  ): Promise<number> {
    let criadas = 0;

    for (const params of paramsList) {
      const notificacao = await this.criar(req, params);
      if (notificacao) {
        criadas++;
      }
    }

    return criadas;
  }

  /**
   * Notificação sistêmica: Encerramento de Ano Letivo
   */
  static async notificarEncerramentoAnoLetivo(
    req: Request | null,
    instituicaoId: string,
    ano: number
  ): Promise<void> {
    try {
      // Buscar todos os usuários ativos da instituição
      const usuarios = await prisma.user.findMany({
        where: {
          instituicaoId,
        },
        select: { id: true },
      });

      const paramsList: CriarNotificacaoParams[] = usuarios.map(usuario => ({
        userId: usuario.id,
        titulo: 'Ano Letivo Encerrado',
        mensagem: `O ano letivo ${ano} foi encerrado.`,
        tipo: TipoNotificacao.ENCERRAMENTO_ANO_LETIVO,
        link: '/ano-letivo',
        instituicaoId,
        prioridade: 'alta',
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar encerramento ano letivo:', error);
    }
  }

  /**
   * Notificação sistêmica: Reabertura de Ano Letivo
   */
  static async notificarReaberturaAnoLetivo(
    req: Request | null,
    instituicaoId: string,
    ano: number
  ): Promise<void> {
    try {
      const usuarios = await prisma.user.findMany({
        where: {
          instituicaoId,
        },
        select: { id: true },
      });

      const paramsList: CriarNotificacaoParams[] = usuarios.map(usuario => ({
        userId: usuario.id,
        titulo: 'Ano Letivo Reaberto',
        mensagem: `O ano letivo ${ano} foi reaberto.`,
        tipo: TipoNotificacao.REABERTURA_ANO_LETIVO,
        link: '/ano-letivo',
        instituicaoId,
        prioridade: 'alta',
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar reabertura ano letivo:', error);
    }
  }

  /**
   * Notificação administrativa: Matrícula realizada
   */
  static async notificarMatriculaRealizada(
    req: Request | null,
    alunoId: string,
    turmaNome: string,
    instituicaoId?: string
  ): Promise<void> {
    try {
      // Notificar ADMIN e SECRETARIA
      const admins = await prisma.user.findMany({
        where: {
          instituicaoId: instituicaoId || undefined,
          roles: {
            some: {
              role: { in: ['ADMIN', 'SECRETARIA'] },
            },
          },
        },
        select: { id: true },
      });

      const paramsList: CriarNotificacaoParams[] = admins.map(admin => ({
        userId: admin.id,
        titulo: 'Nova Matrícula',
        mensagem: `Nova matrícula realizada na turma ${turmaNome}.`,
        tipo: TipoNotificacao.MATRICULA_REALIZADA,
        link: '/matriculas',
        instituicaoId: instituicaoId || undefined,
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar matrícula:', error);
    }
  }

  /**
   * Notificação acadêmica: Professor atribuído a Plano de Ensino
   */
  static async notificarProfessorAtribuido(
    req: Request | null,
    professorId: string,
    disciplinaNome: string,
    turmaNome: string,
    instituicaoId?: string
  ): Promise<void> {
    try {
      await this.criar(req, {
        userId: professorId,
        titulo: 'Plano de Ensino Atribuído',
        mensagem: `Você foi atribuído ao plano de ensino de ${disciplinaNome} - ${turmaNome}.`,
        tipo: TipoNotificacao.PROFESSOR_ATRIBUIDO,
        link: '/plano-ensino',
        instituicaoId,
      });
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar professor atribuído:', error);
    }
  }

  /**
   * Notificação acadêmica: Nota lançada
   */
  static async notificarNotaLancada(
    req: Request | null,
    alunoId: string,
    disciplinaNome: string,
    nota: number,
    instituicaoId?: string
  ): Promise<void> {
    try {
      await this.criar(req, {
        userId: alunoId,
        titulo: 'Nova Nota Lançada',
        mensagem: `Nota ${nota} lançada em ${disciplinaNome}.`,
        tipo: TipoNotificacao.NOTA_LANCADA,
        link: '/boletim',
        instituicaoId,
      });
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar nota lançada:', error);
    }
  }

  /**
   * Notificação acadêmica: Avaliação criada
   */
  static async notificarAvaliacaoCriada(
    req: Request | null,
    alunoIds: string[],
    avaliacaoNome: string,
    disciplinaNome: string,
    instituicaoId?: string
  ): Promise<void> {
    try {
      const paramsList: CriarNotificacaoParams[] = alunoIds.map(alunoId => ({
        userId: alunoId,
        titulo: 'Nova Avaliação',
        mensagem: `Nova avaliação: ${avaliacaoNome} em ${disciplinaNome}.`,
        tipo: TipoNotificacao.AVALIACAO_CRIADA,
        link: '/avaliacoes',
        instituicaoId,
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar avaliação criada:', error);
    }
  }

  /**
   * Notificação acadêmica: Aula criada
   */
  static async notificarAulaCriada(
    req: Request | null,
    alunoIds: string[],
    disciplinaNome: string,
    dataAula: string,
    instituicaoId?: string
  ): Promise<void> {
    try {
      const paramsList: CriarNotificacaoParams[] = alunoIds.map(alunoId => ({
        userId: alunoId,
        titulo: 'Nova Aula Agendada',
        mensagem: `Nova aula de ${disciplinaNome} agendada para ${dataAula}.`,
        tipo: TipoNotificacao.AULA_CRIADA,
        link: '/aulas',
        instituicaoId,
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar aula criada:', error);
    }
  }

  /**
   * Notificação administrativa: Professor criado
   */
  static async notificarProfessorCriado(
    req: Request | null,
    instituicaoId: string
  ): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: {
          instituicaoId,
          roles: {
            some: {
              role: { in: ['ADMIN', 'SECRETARIA'] },
            },
          },
        },
        select: { id: true },
      });

      const paramsList: CriarNotificacaoParams[] = admins.map(admin => ({
        userId: admin.id,
        titulo: 'Novo Professor Cadastrado',
        mensagem: 'Um novo professor foi cadastrado no sistema.',
        tipo: TipoNotificacao.PROFESSOR_CRIADO,
        link: '/professores',
        instituicaoId,
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar professor criado:', error);
    }
  }

  /**
   * Notificação administrativa: Turma criada
   */
  static async notificarTurmaCriada(
    req: Request | null,
    turmaNome: string,
    instituicaoId: string
  ): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: {
          instituicaoId,
          roles: {
            some: {
              role: { in: ['ADMIN', 'SECRETARIA'] },
            },
          },
        },
        select: { id: true },
      });

      const paramsList: CriarNotificacaoParams[] = admins.map(admin => ({
        userId: admin.id,
        titulo: 'Nova Turma Criada',
        mensagem: `Nova turma criada: ${turmaNome}.`,
        tipo: TipoNotificacao.TURMA_CRIADA,
        link: '/turmas',
        instituicaoId,
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar turma criada:', error);
    }
  }

  /**
   * Notificação sistêmica: Assinatura expirada
   */
  static async notificarAssinaturaExpirada(
    req: Request | null,
    instituicaoId: string
  ): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: {
          instituicaoId,
          roles: {
            some: {
              role: 'ADMIN',
            },
          },
        },
        select: { id: true },
      });

      const paramsList: CriarNotificacaoParams[] = admins.map(admin => ({
        userId: admin.id,
        titulo: 'Assinatura Expirada',
        mensagem: 'A assinatura da instituição expirou. Renove para continuar usando o sistema.',
        tipo: TipoNotificacao.ASSINATURA_EXPIRADA,
        link: '/assinatura',
        instituicaoId,
        prioridade: 'alta',
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar assinatura expirada:', error);
    }
  }

  /**
   * Notificação sistêmica: Bloqueio por assinatura
   */
  static async notificarBloqueioAssinatura(
    req: Request | null,
    instituicaoId: string
  ): Promise<void> {
    try {
      const usuarios = await prisma.user.findMany({
        where: {
          instituicaoId,
        },
        select: { id: true },
      });

      const paramsList: CriarNotificacaoParams[] = usuarios.map(usuario => ({
        userId: usuario.id,
        titulo: 'Acesso Bloqueado',
        mensagem: 'O acesso foi bloqueado devido ao status da assinatura.',
        tipo: TipoNotificacao.BLOQUEIO_ASSINATURA,
        link: '/assinatura',
        instituicaoId,
        prioridade: 'alta',
      }));

      await this.criarMultiplas(req, paramsList);
    } catch (error: any) {
      console.error('[NotificacaoService] Erro ao notificar bloqueio assinatura:', error);
    }
  }
}

