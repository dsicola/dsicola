import crypto from 'crypto';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Serviço de Criptografia Enterprise
 * Implementa AES-256-GCM para criptografia de backups
 */
export class CryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly TAG_LENGTH = 16; // 128 bits

  /**
   * Obter chave de criptografia do ambiente
   * Se não existir, gera uma (apenas para desenvolvimento)
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.BACKUP_ENCRYPTION_KEY;
    
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError(
          'BACKUP_ENCRYPTION_KEY não configurada. Configure a variável de ambiente para criptografia de backups.',
          500
        );
      }
      
      // Em desenvolvimento, usar uma chave padrão (AVISO: NÃO usar em produção)
      console.warn('[CryptoService] Usando chave padrão (apenas desenvolvimento). Configure BACKUP_ENCRYPTION_KEY em produção.');
      return crypto.createHash('sha256').update('dsicola-backup-default-key-dev-only').digest();
    }

    // A chave deve ter 32 bytes (256 bits)
    // Se for uma string, derivar usando SHA-256
    if (key.length === 64) {
      // Assumir que é hex (32 bytes em hex = 64 caracteres)
      return Buffer.from(key, 'hex');
    }
    
    // Derivar chave usando SHA-256
    return crypto.createHash('sha256').update(key).digest();
  }

  /**
   * Criptografar dados usando AES-256-GCM
   * @param data Dados a criptografar (Buffer ou string)
   * @returns Objeto com dados criptografados, IV e tag de autenticação (todos em base64)
   */
  static encrypt(data: Buffer | string): {
    encrypted: Buffer;
    iv: string; // base64
    authTag: string; // base64
  } {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Converter dados para Buffer se necessário
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

      // Criar cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      // Criptografar
      const encrypted = Buffer.concat([
        cipher.update(dataBuffer),
        cipher.final(),
      ]);

      // Obter tag de autenticação
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
      };
    } catch (error) {
      console.error('[CryptoService] Erro ao criptografar:', error);
      throw new AppError('Erro ao criptografar dados', 500);
    }
  }

  /**
   * Descriptografar dados usando AES-256-GCM
   * @param encrypted Dados criptografados (Buffer)
   * @param iv Initialization Vector (base64)
   * @param authTag Tag de autenticação (base64)
   * @returns Dados descriptografados (Buffer)
   */
  static decrypt(
    encrypted: Buffer,
    iv: string, // base64
    authTag: string // base64
  ): Buffer {
    try {
      const key = this.getEncryptionKey();
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');

      // Criar decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      // Descriptografar
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted;
    } catch (error) {
      console.error('[CryptoService] Erro ao descriptografar:', error);
      throw new AppError('Erro ao descriptografar dados. Arquivo pode estar corrompido ou chave incorreta.', 500);
    }
  }

  /**
   * Calcular hash SHA-256 de dados
   * @param data Dados para calcular hash (Buffer ou string)
   * @returns Hash SHA-256 em hexadecimal
   */
  static calculateHash(data: Buffer | string): string {
    try {
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      return crypto.createHash('sha256').update(dataBuffer).digest('hex');
    } catch (error) {
      console.error('[CryptoService] Erro ao calcular hash:', error);
      throw new AppError('Erro ao calcular hash dos dados', 500);
    }
  }

  /**
   * Verificar integridade usando hash SHA-256
   * @param data Dados para verificar (Buffer ou string)
   * @param expectedHash Hash esperado (hexadecimal)
   * @returns true se o hash corresponder, false caso contrário
   */
  static verifyHash(data: Buffer | string, expectedHash: string): boolean {
    try {
      const calculatedHash = this.calculateHash(data);
      return calculatedHash.toLowerCase() === expectedHash.toLowerCase();
    } catch (error) {
      console.error('[CryptoService] Erro ao verificar hash:', error);
      return false;
    }
  }
}

