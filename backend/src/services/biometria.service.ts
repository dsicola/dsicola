import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import * as crypto from 'crypto';

/**
 * Service para gerenciar biometria de funcionários
 *
 * ARQUITETURA:
 * - Fluxo principal (produção): Dispositivos (ZKTeco, etc.) fazem matching localmente e enviam
 *   funcionario_id via /integracao/biometria/evento. Não usa este service.
 * - Fluxo alternativo: Registro de template para cenários web ou dispositivos que enviam
 *   template. Requer que o mesmo template exato seja enviado na captura e na verificação.
 *
 * LIMITAÇÃO IMPORTANTE:
 * O armazenamento usa SHA-256 (hash unidirecional). A verificação é por comparação exata.
 * Impressões digitais reais raramente produzem o mesmo template em capturas diferentes.
 * Este fluxo é adequado para: templates normalizados por SDK, testes, ou dispositivos com
 * saída de template estável. Para produção com dispositivos físicos, use a integração via
 * DispositivoBiometrico e sincronize funcionários com o dispositivo.
 */

const TEMPLATE_MIN_LENGTH = 32;
const TEMPLATE_MAX_LENGTH = 4096;
const DEDO_MIN = 1;
const DEDO_MAX = 10;

export class BiometriaService {
  /**
   * Criptografar template biométrico (hash SHA-256 para armazenamento)
   * NOTA: Hash impede recuperação. Verificação requer match exato.
   */
  private static encryptTemplate(template: string): string {
    return crypto.createHash('sha256').update(template, 'utf8').digest('hex');
  }

  /**
   * Verificar se template corresponde ao hash armazenado (comparação exata, timing-safe)
   */
  private static verifyTemplate(template: string, storedHash: string): boolean {
    const templateHash = this.encryptTemplate(template);
    const a = Buffer.from(templateHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Validar e sanitizar template biométrico
   */
  private static validateTemplate(template: string): void {
    if (typeof template !== 'string' || !template.trim()) {
      throw new AppError('Template biométrico é obrigatório e deve ser uma string não vazia', 400);
    }
    const len = Buffer.byteLength(template, 'utf8');
    if (len < TEMPLATE_MIN_LENGTH || len > TEMPLATE_MAX_LENGTH) {
      throw new AppError(
        `Template deve ter entre ${TEMPLATE_MIN_LENGTH} e ${TEMPLATE_MAX_LENGTH} bytes`,
        400
      );
    }
  }

  /**
   * Validar número do dedo (1-10)
   */
  private static validateDedo(dedo: number): void {
    if (dedo < DEDO_MIN || dedo > DEDO_MAX || !Number.isInteger(dedo)) {
      throw new AppError(`Dedo inválido. Deve ser um número inteiro entre ${DEDO_MIN} e ${DEDO_MAX}`, 400);
    }
  }

  /**
   * Registrar biometria de funcionário
   * Apenas ADMIN ou RH pode autorizar
   */
  static async registrarBiometria(
    funcionarioId: string,
    template: string,
    dedo: number,
    criadoPor: string,
    instituicaoId: string
  ) {
    this.validateTemplate(template);
    this.validateDedo(dedo);

    // Verificar se funcionário existe e pertence à instituição
    const funcionario = await prisma.funcionario.findFirst({
      where: {
        id: funcionarioId,
        instituicaoId,
        status: 'ATIVO',
      },
    });

    if (!funcionario) {
      throw new AppError('Funcionário não encontrado ou não está ativo', 404);
    }

    // Verificar se já existe biometria para este dedo
    const existing = await prisma.biometriaFuncionario.findUnique({
      where: {
        funcionarioId_dedo: {
          funcionarioId,
          dedo,
        },
      },
    });

    const templateHash = this.encryptTemplate(template);

    if (existing) {
      // Atualizar biometria existente
      return await prisma.biometriaFuncionario.update({
        where: { id: existing.id },
        data: {
          templateHash,
          ativo: true,
          criadoPor,
          updatedAt: new Date(),
        },
      });
    }

    // Criar nova biometria
    return await prisma.biometriaFuncionario.create({
      data: {
        funcionarioId,
        templateHash,
        dedo,
        ativo: true,
        criadoPor,
        instituicaoId,
      },
    });
  }

  /**
   * Identificar funcionário pelo template biométrico
   * Retorna funcionarioId se encontrado
   */
  static async identificarFuncionario(
    template: string,
    instituicaoId: string
  ): Promise<string | null> {
    this.validateTemplate(template);


    // Buscar todas as biometrias ativas da instituição
    const biometrias = await prisma.biometriaFuncionario.findMany({
      where: {
        instituicaoId,
        ativo: true,
      },
      include: {
        funcionario: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    // Comparar template com cada hash armazenado
    for (const biometria of biometrias) {
      if (this.verifyTemplate(template, biometria.templateHash)) {
        // Verificar se funcionário está ativo
        if (biometria.funcionario.status === 'ATIVO') {
          return biometria.funcionarioId;
        }
      }
    }

    return null;
  }

  /**
   * Buscar biometrias de um funcionário
   */
  static async getBiometriasFuncionario(
    funcionarioId: string,
    instituicaoId: string
  ) {
    return await prisma.biometriaFuncionario.findMany({
      where: {
        funcionarioId,
        instituicaoId,
      },
      select: {
        id: true,
        dedo: true,
        ativo: true,
        createdAt: true,
        // NUNCA retornar templateHash por segurança
      },
      orderBy: {
        dedo: 'asc',
      },
    });
  }

  /**
   * Desativar biometria
   */
  static async desativarBiometria(
    biometriaId: string,
    instituicaoId: string
  ) {
    const biometria = await prisma.biometriaFuncionario.findFirst({
      where: {
        id: biometriaId,
        instituicaoId,
      },
    });

    if (!biometria) {
      throw new AppError('Biometria não encontrada', 404);
    }

    return await prisma.biometriaFuncionario.update({
      where: { id: biometriaId },
      data: {
        ativo: false,
      },
    });
  }
}

