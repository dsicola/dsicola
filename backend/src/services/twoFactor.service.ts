import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';

/**
 * Serviço de Autenticação em Dois Fatores (2FA) baseado em TOTP
 * Segue padrão SIGA/SIGAE moderno
 */
class TwoFactorService {
  /**
   * Gera um novo secret TOTP para o usuário
   * @param userId ID do usuário
   * @param email Email do usuário (para o label do QR code)
   * @param instituicaoNome Nome da instituição (para o label do QR code)
   * @returns Objeto com secret e QR code em base64
   */
  async generateSecret(
    userId: string,
    email: string,
    instituicaoNome?: string
  ): Promise<{ secret: string; qrCode: string; otpauthUrl: string }> {
    // Buscar usuário para validar
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { instituicao: { select: { nome: true } } }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Verificar se usuário é ADMIN (2FA só se aplica a ADMIN)
    const roles = await prisma.userRole_.findMany({
      where: { userId },
      select: { role: true }
    });

    const isAdmin = roles.some(r => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN');
    if (!isAdmin) {
      throw new AppError('2FA está disponível apenas para administradores', 403);
    }

    // Gerar secret TOTP
    const secret = speakeasy.generateSecret({
      name: `${email} (${instituicaoNome || user.instituicao?.nome || 'DSICOLA'})`,
      issuer: instituicaoNome || user.instituicao?.nome || 'DSICOLA',
      length: 32
    });

    // Gerar URL OTPAuth (padrão para apps autenticadores)
    const otpauthUrl = secret.otpauth_url;
    if (!otpauthUrl) {
      throw new AppError('Erro ao gerar URL de autenticação', 500);
    }

    // Gerar QR Code em base64
    let qrCode: string;
    try {
      qrCode = await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      console.error('[2FA] Erro ao gerar QR Code:', error);
      throw new AppError('Erro ao gerar QR Code', 500);
    }

    // IMPORTANTE: NÃO salvar o secret ainda - apenas retornar
    // O secret só será salvo após validação do código
    return {
      secret: secret.base32 || '',
      qrCode,
      otpauthUrl
    };
  }

  /**
   * Valida código TOTP e ativa 2FA para o usuário
   * @param userId ID do usuário
   * @param token Código TOTP de 6 dígitos
   * @param secret Secret temporário (vem do generateSecret)
   * @param req Request para auditoria
   * @returns true se válido e 2FA foi ativado
   */
  async verifyAndEnable(
    userId: string,
    token: string,
    secret: string,
    req?: any
  ): Promise<boolean> {
    // Validar formato do token
    if (!/^\d{6}$/.test(token)) {
      throw new AppError('Código 2FA deve ter 6 dígitos', 400);
    }

    // Verificar código TOTP
    const isValid = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Aceitar códigos com até 2 períodos de diferença (60 segundos)
    });

    if (!isValid) {
      // Auditoria: Tentativa de ativação com código inválido
      if (req) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, instituicaoId: true }
        });
        if (user) {
          await AuditService.log(req, {
            modulo: ModuloAuditoria.SEGURANCA,
            acao: AcaoAuditoria.SECURITY_ALERT,
            entidade: EntidadeAuditoria.USER,
            entidadeId: userId,
            dadosNovos: {
              event: '2FA_SETUP_FAILED',
              reason: 'Código inválido',
              email: user.email
            },
            observacao: 'Tentativa de ativar 2FA com código inválido'
          });
        }
      }
      throw new AppError('Código 2FA inválido', 401);
    }

    // IMPORTANTE: Armazenar secret em base32 diretamente
    // Em produção, considere usar criptografia AES reversível
    // Por enquanto, armazenamos em base32 (o secret já vem em base32 do speakeasy)
    // O campo twoFactorSecret no banco deve ser tratado como informação sensível

    // Atualizar usuário: ativar 2FA e salvar secret
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret, // Armazenar em base32 (em produção, criptografar com AES)
        twoFactorVerifiedAt: new Date()
      }
    });

    // Auditoria: 2FA ativado com sucesso
    if (req) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, instituicaoId: true }
      });
      if (user) {
        await AuditService.log(req, {
          modulo: ModuloAuditoria.SEGURANCA,
          acao: AcaoAuditoria.UPDATE,
          entidade: EntidadeAuditoria.USER,
          entidadeId: userId,
          dadosAnteriores: { twoFactorEnabled: false },
          dadosNovos: {
            twoFactorEnabled: true,
            twoFactorVerifiedAt: new Date().toISOString()
          },
          observacao: `2FA ativado para ${user.email}`
        });
      }
    }

    return true;
  }

  /**
   * Valida código TOTP durante login
   * @param userId ID do usuário
   * @param token Código TOTP de 6 dígitos
   * @returns true se válido
   */
  async verifyTwoFactorLogin(userId: string, token: string): Promise<boolean> {
    // Buscar usuário e secret
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true
      }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new AppError('2FA não está ativado para este usuário', 400);
    }

    // Validar formato do token
    if (!/^\d{6}$/.test(token)) {
      return false;
    }

    // Recuperar secret original (descriptografar)
    // Em produção, implementar descriptografia adequada
    const secret = await this.decryptSecret(user.twoFactorSecret);

    // Verificar código TOTP
    const isValid = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Aceitar códigos com até 2 períodos de diferença
    });

    return isValid;
  }

  /**
   * Desativa 2FA para o usuário
   * @param userId ID do usuário
   * @param req Request para auditoria
   */
  async disable(userId: string, req?: any): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    if (!user.twoFactorEnabled) {
      throw new AppError('2FA não está ativado para este usuário', 400);
    }

    // Desativar 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorVerifiedAt: null
      }
    });

    // Auditoria: 2FA desativado
    if (req) {
      await AuditService.log(req, {
        modulo: ModuloAuditoria.SEGURANCA,
        acao: AcaoAuditoria.UPDATE,
        entidade: EntidadeAuditoria.USER,
        entidadeId: userId,
        dadosAnteriores: { twoFactorEnabled: true },
        dadosNovos: { twoFactorEnabled: false },
        observacao: `2FA desativado para ${user.email}`
      });
    }
  }

  /**
   * Reseta 2FA para o usuário (apenas ADMIN/SUPER_ADMIN)
   * Requer validação adicional de segurança
   * @param userId ID do usuário
   * @param requestedBy ID do usuário que está solicitando o reset
   * @param req Request para auditoria
   */
  async reset(userId: string, requestedBy: string, req?: any): Promise<void> {
    // Verificar permissões
    const requester = await prisma.user.findUnique({
      where: { id: requestedBy },
      include: { roles: { select: { role: true } } }
    });

    if (!requester) {
      throw new AppError('Usuário não autorizado', 403);
    }

    const requesterRoles = requester.roles.map(r => r.role);
    const hasPermission = requesterRoles.some(r => r === 'ADMIN' || r === 'SUPER_ADMIN');

    if (!hasPermission) {
      throw new AppError('Apenas administradores podem resetar 2FA', 403);
    }

    // Buscar usuário alvo
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Resetar 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorVerifiedAt: null
      }
    });

    // Auditoria: 2FA resetado por administrador
    if (req) {
      await AuditService.log(req, {
        modulo: ModuloAuditoria.SEGURANCA,
        acao: AcaoAuditoria.SECURITY_ALERT,
        entidade: EntidadeAuditoria.USER,
        entidadeId: userId,
        dadosNovos: {
          event: '2FA_RESET',
          resetBy: requestedBy,
          resetByEmail: requester.email,
          targetEmail: user.email
        },
        observacao: `2FA resetado para ${user.email} por ${requester.email}`
      });
    }
  }

  /**
   * Verifica se 2FA está ativado para o usuário
   * @param userId ID do usuário
   * @returns true se ativado
   */
  async isEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true }
    });

    return user?.twoFactorEnabled === true;
  }


  /**
   * Recupera secret do banco
   * NOTA: Em produção, implementar descriptografia AES se o secret foi criptografado
   */
  private async decryptSecret(storedSecret: string): Promise<string> {
    // Por enquanto, o secret está armazenado em base32 diretamente
    // Em produção, se usar criptografia AES, descriptografar aqui
    return storedSecret;
  }
}

export const twoFactorService = new TwoFactorService();
export default twoFactorService;
