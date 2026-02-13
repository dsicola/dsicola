import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { AppError } from '../middlewares/errorHandler.js';

const KEYS_BASE = path.resolve(process.cwd(), 'keys');

/**
 * Serviço de Assinatura Digital Criptográfica
 * Implementa assinatura RSA-SHA256 para backups institucionais
 * Garante autenticidade, não-repúdio e validade jurídica
 */
export class DigitalSignatureService {
  private static readonly ALGORITHM = 'RSA-SHA256';
  private static readonly KEY_SIZE = 2048; // RSA 2048 bits (mínimo recomendado)
  private static readonly KEYS_DIR = KEYS_BASE;
  private static readonly PRIVATE_KEY_PATH = path.join(this.KEYS_DIR, 'backup_private_key.pem');
  private static readonly PUBLIC_KEY_PATH = path.join(this.KEYS_DIR, 'backup_public_key.pem');

  /**
   * Garantir que o diretório de chaves existe
   */
  private static async ensureKeysDir(): Promise<void> {
    try {
      await fs.mkdir(this.KEYS_DIR, { recursive: true });
    } catch (error) {
      console.error('[DigitalSignatureService] Erro ao criar diretório de chaves:', error);
      throw new AppError('Erro ao criar diretório de chaves', 500);
    }
  }

  /**
   * Gerar par de chaves RSA (executar uma vez)
   * @returns Objeto com chave privada e pública (PEM format)
   */
  static async generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
    try {
      await this.ensureKeysDir();

      // Gerar par de chaves RSA
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: this.KEY_SIZE,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      // Salvar chaves em arquivos (apenas se não existirem)
      try {
        await fs.access(this.PRIVATE_KEY_PATH);
        console.warn('[DigitalSignatureService] Chave privada já existe. Não sobrescrevendo.');
      } catch {
        // Arquivo não existe, criar
        await fs.writeFile(this.PRIVATE_KEY_PATH, privateKey, { mode: 0o600 }); // Permissões: apenas owner pode ler/escrever
        console.log('[DigitalSignatureService] Chave privada gerada e salva.');
      }

      try {
        await fs.access(this.PUBLIC_KEY_PATH);
        console.warn('[DigitalSignatureService] Chave pública já existe. Não sobrescrevendo.');
      } catch {
        // Arquivo não existe, criar
        await fs.writeFile(this.PUBLIC_KEY_PATH, publicKey, { mode: 0o644 }); // Permissões: owner pode ler/escrever, outros podem ler
        console.log('[DigitalSignatureService] Chave pública gerada e salva.');
      }

      return { privateKey, publicKey };
    } catch (error) {
      console.error('[DigitalSignatureService] Erro ao gerar par de chaves:', error);
      throw new AppError('Erro ao gerar par de chaves RSA', 500);
    }
  }

  /**
   * Obter chave privada (do arquivo ou ENV)
   */
  private static async getPrivateKey(): Promise<string> {
    // Prioridade 1: Variável de ambiente (mais seguro para produção)
    const envPrivateKey = process.env.BACKUP_PRIVATE_KEY;
    if (envPrivateKey) {
      return envPrivateKey;
    }

    // Prioridade 2: Arquivo
    try {
      const privateKey = await fs.readFile(this.PRIVATE_KEY_PATH, 'utf8');
      return privateKey;
    } catch (error) {
      // Se não existir, tentar gerar
      console.warn('[DigitalSignatureService] Chave privada não encontrada. Gerando novo par de chaves...');
      const { privateKey } = await this.generateKeyPair();
      return privateKey;
    }
  }

  /**
   * Obter chave pública (do arquivo ou ENV)
   */
  private static async getPublicKey(): Promise<string> {
    // Prioridade 1: Variável de ambiente
    const envPublicKey = process.env.BACKUP_PUBLIC_KEY;
    if (envPublicKey) {
      return envPublicKey;
    }

    // Prioridade 2: Arquivo
    try {
      const publicKey = await fs.readFile(this.PUBLIC_KEY_PATH, 'utf8');
      return publicKey;
    } catch (error) {
      // Se não existir, tentar gerar
      console.warn('[DigitalSignatureService] Chave pública não encontrada. Gerando novo par de chaves...');
      const { publicKey } = await this.generateKeyPair();
      return publicKey;
    }
  }

  /**
   * Assinar hash SHA-256 usando chave privada
   * @param hash Hash SHA-256 a ser assinado (hexadecimal)
   * @returns Assinatura digital em base64
   */
  static async signHash(hash: string): Promise<string> {
    try {
      const privateKey = await this.getPrivateKey();
      const hashBuffer = Buffer.from(hash, 'hex');

      // Assinar usando RSA-SHA256
      const signature = crypto.sign(this.ALGORITHM, hashBuffer, {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      });

      // Retornar assinatura em base64
      return signature.toString('base64');
    } catch (error) {
      console.error('[DigitalSignatureService] Erro ao assinar hash:', error);
      throw new AppError('Erro ao assinar hash do backup', 500);
    }
  }

  /**
   * Verificar assinatura digital usando chave pública
   * @param hash Hash SHA-256 original (hexadecimal)
   * @param signature Assinatura digital (base64)
   * @returns true se assinatura for válida, false caso contrário
   */
  static async verifySignature(hash: string, signature: string): Promise<boolean> {
    try {
      const publicKey = await this.getPublicKey();
      const hashBuffer = Buffer.from(hash, 'hex');
      const signatureBuffer = Buffer.from(signature, 'base64');

      // Verificar assinatura usando RSA-SHA256
      const isValid = crypto.verify(
        this.ALGORITHM,
        hashBuffer,
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        signatureBuffer
      );

      return isValid;
    } catch (error) {
      console.error('[DigitalSignatureService] Erro ao verificar assinatura:', error);
      return false;
    }
  }

  /**
   * Obter algoritmo de assinatura
   */
  static getAlgorithm(): string {
    return this.ALGORITHM;
  }
}

