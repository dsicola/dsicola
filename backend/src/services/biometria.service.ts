import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import * as crypto from 'crypto';

/**
 * Service para gerenciar biometria de funcionários
 * Armazena apenas templates hash criptografados (nunca a imagem da digital)
 */

export class BiometriaService {
  /**
   * Criptografar template biométrico
   */
  private static encryptTemplate(template: string): string {
    // Em produção, usar algoritmo mais seguro (AES-256)
    // Por agora, usar hash SHA-256 do template
    return crypto.createHash('sha256').update(template).digest('hex');
  }

  /**
   * Verificar se template corresponde ao hash armazenado
   */
  private static verifyTemplate(template: string, storedHash: string): boolean {
    const templateHash = this.encryptTemplate(template);
    return templateHash === storedHash;
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
    const templateHash = this.encryptTemplate(template);

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

