/**
 * Serviço de comunicação com dispositivos ZKTeco
 * Implementa o protocolo proprietário ZKTeco via TCP/IP
 */

import net from 'net';
import crypto from 'crypto';

export interface ZKTecoDevice {
  ip: string;
  porta: number;
  serial?: string;
  modelo?: string;
}

export interface ZKTecoUser {
  uid: number; // ID do usuário no dispositivo
  nome: string;
  senha?: string;
  privilegio?: number;
  ativo?: boolean;
}

export interface ZKTecoAttendance {
  uid: number;
  timestamp: Date;
  status: number; // 0 = Check-in, 1 = Check-out
  verify: number; // Método de verificação (0=senha, 1=fingerprint, etc)
}

export class ZKTecoService {
  private socket: net.Socket | null = null;
  private sessionId: number = 0;
  private replyId: number = 0;
  private connected: boolean = false;
  private device: ZKTecoDevice;

  constructor(device: ZKTecoDevice) {
    this.device = device;
  }

  /**
   * Conectar ao dispositivo ZKTeco
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new net.Socket();
        
        const timeout = setTimeout(() => {
          if (this.socket && !this.connected) {
            this.socket.destroy();
            reject(new Error('Timeout ao conectar'));
          }
        }, 5000);

        this.socket.once('connect', async () => {
          clearTimeout(timeout);
          console.log(`[ZKTeco] Conectado a ${this.device.ip}:${this.device.porta}`);
          
          try {
            // Realizar handshake (C_DATA_OPLOG)
            const connected = await this.handshake();
            this.connected = connected;
            resolve(connected);
          } catch (error) {
            this.socket?.destroy();
            reject(error);
          }
        });

        this.socket.on('error', (error) => {
          clearTimeout(timeout);
          console.error(`[ZKTeco] Erro na conexão:`, error);
          reject(error);
        });

        this.socket.connect(this.device.porta, this.device.ip);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Desconectar do dispositivo
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      try {
        await this.sendCommand(0x0005, Buffer.alloc(0)); // CMD_EXIT
      } catch (error) {
        console.error('[ZKTeco] Erro ao desconectar:', error);
      }
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   * Handshake com o dispositivo
   */
  private async handshake(): Promise<boolean> {
    try {
      // Comando C_DATA_OPLOG (0x0002) para iniciar comunicação
      const response = await this.sendCommand(0x0002, Buffer.from([0x00, 0x00, 0x00, 0x00]));
      
      if (response && response.length > 0) {
        // Extrair session_id da resposta
        this.sessionId = response.readUInt16LE(0);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ZKTeco] Erro no handshake:', error);
      return false;
    }
  }

  /**
   * Enviar comando ao dispositivo
   */
  private async sendCommand(command: number, data: Buffer): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Não conectado ao dispositivo'));
        return;
      }

      this.replyId += 1;
      const replyId = this.replyId;

      // Montar pacote ZKTeco
      const packet = this.buildPacket(command, this.sessionId, replyId, data);

      // Listener temporário para resposta
      let bufferAcumulado = Buffer.alloc(0);
      
      // Timeout de 10 segundos
      const timeout = setTimeout(() => {
        this.socket?.removeListener('data', responseHandler);
        reject(new Error('Timeout ao aguardar resposta'));
      }, 10000);

      const responseHandler = (chunk: Buffer) => {
        try {
          bufferAcumulado = Buffer.concat([bufferAcumulado, chunk]);
          
          // Tentar parsear quando tivermos dados suficientes
          if (bufferAcumulado.length >= 12) {
            const parsed = this.parsePacket(bufferAcumulado);
            if (parsed && parsed.replyId === replyId) {
              this.socket?.removeListener('data', responseHandler);
              clearTimeout(timeout);
              resolve(parsed.data);
            } else if (parsed && parsed.replyId !== replyId) {
              // Resposta para outro comando, continuar acumulando
              // (pode ser resposta parcial de múltiplos pacotes)
            }
          }
        } catch (error) {
          this.socket?.removeListener('data', responseHandler);
          clearTimeout(timeout);
          reject(error);
        }
      };

      this.socket.on('data', responseHandler);

      // Enviar pacote
      this.socket.write(packet, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.socket?.removeListener('data', responseHandler);
          reject(error);
        }
      });
    });
  }

  /**
   * Montar pacote ZKTeco
   */
  private buildPacket(command: number, sessionId: number, replyId: number, data: Buffer): Buffer {
    const header = Buffer.alloc(8);
    
    // START (2 bytes) - 0x50 0x50
    header.writeUInt16LE(0x5050, 0);
    
    // CMD (2 bytes)
    header.writeUInt16LE(command, 2);
    
    // CHECKSUM (2 bytes) - será calculado depois
    header.writeUInt16LE(0, 4);
    
    // SESSION_ID (2 bytes)
    header.writeUInt16LE(sessionId, 6);
    
    // REPLY_ID (2 bytes)
    const replyIdBuf = Buffer.alloc(2);
    replyIdBuf.writeUInt16LE(replyId, 0);
    
    // Montar pacote completo
    const packet = Buffer.concat([header, replyIdBuf, data]);
    
    // Calcular checksum (soma de todos os bytes após START)
    let checksum = 0;
    for (let i = 2; i < packet.length; i++) {
      checksum += packet[i];
    }
    checksum = checksum % 0x10000;
    
    // Atualizar checksum no header
    packet.writeUInt16LE(checksum, 4);
    
    // Adicionar terminator
    const terminator = Buffer.from([0x29, 0x00]);
    
    return Buffer.concat([packet, terminator]);
  }

  /**
   * Parsear resposta do dispositivo
   */
  private parsePacket(buffer: Buffer): { command: number; sessionId: number; replyId: number; data: Buffer } | null {
    if (buffer.length < 10) {
      return null;
    }

    // Verificar START
    const start = buffer.readUInt16LE(0);
    if (start !== 0x5050) {
      return null;
    }

    const command = buffer.readUInt16LE(2);
    const checksum = buffer.readUInt16LE(4);
    const sessionId = buffer.readUInt16LE(6);
    const replyId = buffer.readUInt16LE(8);
    
    // Verificar checksum
    let calculatedChecksum = 0;
    for (let i = 2; i < buffer.length - 2; i++) {
      calculatedChecksum += buffer[i];
    }
    calculatedChecksum = calculatedChecksum % 0x10000;
    
    if (calculatedChecksum !== checksum) {
      console.warn('[ZKTeco] Checksum inválido na resposta');
    }

    // Extrair dados (após header de 10 bytes)
    const data = buffer.slice(10, buffer.length - 2); // Remover terminator

    return { command, sessionId, replyId, data };
  }

  /**
   * Verificar se está conectado
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null && !this.socket.destroyed;
  }

  /**
   * Obter informações do dispositivo
   */
  async getDeviceInfo(): Promise<{ serial?: string; modelo?: string; firmware?: string }> {
    try {
      // CMD_OPTIONS_RRQ (0x0011) - Obter opções do dispositivo
      const response = await this.sendCommand(0x0011, Buffer.alloc(0));
      
      if (response && response.length > 0) {
        // Parsear informações (formato varia por modelo)
        return {
          serial: response.slice(0, 16).toString('utf8').replace(/\0/g, ''),
          modelo: response.slice(16, 32).toString('utf8').replace(/\0/g, ''),
        };
      }
      
      return {};
    } catch (error) {
      console.error('[ZKTeco] Erro ao obter informações:', error);
      throw error;
    }
  }

  /**
   * Testar conexão
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }
      const info = await this.getDeviceInfo();
      return !!info;
    } catch (error) {
      console.error('[ZKTeco] Erro no teste de conexão:', error);
      return false;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Listar usuários do dispositivo
   */
  async getUsers(): Promise<ZKTecoUser[]> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      // CMD_USERTEMP_RRQ (0x0009) - Solicitar template de usuários
      const response = await this.sendCommand(0x0009, Buffer.from([0x05, 0x00, 0x00, 0x00])); // 5 = usuário geral
      
      const users: ZKTecoUser[] = [];
      
      if (response && response.length > 0) {
        // Parsear usuários (formato: size(2) + data)
        let offset = 0;
        while (offset < response.length) {
          const size = response.readUInt16LE(offset);
          offset += 2;
          
          if (size > 0 && offset + size <= response.length) {
            const userData = response.slice(offset, offset + size);
            
            const uid = userData.readUInt16LE(2);
            const privilegio = userData.readUInt8(4);
            const senha = userData.slice(5, 9).toString('utf8').replace(/\0/g, '');
            const nomeLength = userData.readUInt8(9);
            const nome = userData.slice(10, 10 + nomeLength).toString('utf8');
            const ativo = userData.readUInt8(10 + nomeLength + 1) === 1;
            
            users.push({
              uid,
              nome,
              senha,
              privilegio,
              ativo,
            });
            
            offset += size;
          } else {
            break;
          }
        }
      }
      
      return users;
    } catch (error) {
      console.error('[ZKTeco] Erro ao listar usuários:', error);
      throw error;
    }
  }

  /**
   * Criar/atualizar usuário no dispositivo
   */
  async setUser(user: ZKTecoUser): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      // CMD_USER_WRQ (0x0008) - Escrever usuário
      const nomeBuffer = Buffer.from(user.nome, 'utf8');
      const senhaBuffer = Buffer.from(user.senha || '', 'utf8').slice(0, 8);
      const senhaPadded = Buffer.alloc(8);
      senhaBuffer.copy(senhaPadded);
      
      const userData = Buffer.alloc(72);
      userData.writeUInt16LE(user.uid, 0);
      userData.writeUInt16LE(0, 2); // Reserved
      userData.writeUInt8(user.privilegio || 0, 4);
      senhaPadded.copy(userData, 5);
      userData.writeUInt8(nomeBuffer.length, 9);
      nomeBuffer.copy(userData, 10);
      userData.writeUInt8(user.ativo !== false ? 1 : 0, 10 + nomeBuffer.length + 1);

      const response = await this.sendCommand(0x0008, userData);
      return response !== null;
    } catch (error) {
      console.error('[ZKTeco] Erro ao criar usuário:', error);
      throw error;
    }
  }

  /**
   * Deletar usuário do dispositivo
   */
  async deleteUser(uid: number): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      // CMD_DELETE_USER (0x0004)
      const userData = Buffer.alloc(5);
      userData.writeUInt16LE(uid, 0);
      
      const response = await this.sendCommand(0x0004, userData);
      return response !== null;
    } catch (error) {
      console.error('[ZKTeco] Erro ao deletar usuário:', error);
      throw error;
    }
  }

  /**
   * Obter logs de presença (attendance)
   */
  async getAttendances(startDate?: Date, endDate?: Date): Promise<ZKTecoAttendance[]> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      // CMD_ATTLOG_RRQ (0x000D) - Solicitar logs
      const requestData = Buffer.alloc(16);
      
      // Timestamps (formato ZKTeco: year(2) + month(1) + day(1) + hour(1) + minute(1) + second(1))
      const start = startDate || new Date(0);
      const end = endDate || new Date();
      
      requestData.writeUInt16LE(start.getFullYear() - 2000, 0);
      requestData.writeUInt8(start.getMonth() + 1, 2);
      requestData.writeUInt8(start.getDate(), 3);
      requestData.writeUInt8(start.getHours(), 4);
      requestData.writeUInt8(start.getMinutes(), 5);
      requestData.writeUInt8(start.getSeconds(), 6);
      
      requestData.writeUInt16LE(end.getFullYear() - 2000, 8);
      requestData.writeUInt8(end.getMonth() + 1, 10);
      requestData.writeUInt8(end.getDate(), 11);
      requestData.writeUInt8(end.getHours(), 12);
      requestData.writeUInt8(end.getMinutes(), 13);
      requestData.writeUInt8(end.getSeconds(), 14);

      const response = await this.sendCommand(0x000D, requestData);
      
      const attendances: ZKTecoAttendance[] = [];
      
      if (response && response.length > 0) {
        // Parsear logs (formato: size(2) + data repetido)
        let offset = 0;
        while (offset < response.length) {
          const size = response.readUInt16LE(offset);
          offset += 2;
          
          if (size >= 16 && offset + size <= response.length) {
            const logData = response.slice(offset, offset + size);
            
            const uid = logData.readUInt16LE(0);
            const status = logData.readUInt8(4);
            const verify = logData.readUInt8(5);
            
            // Timestamp (ZKTeco format)
            const year = 2000 + logData.readUInt16LE(6);
            const month = logData.readUInt8(8) - 1;
            const day = logData.readUInt8(9);
            const hour = logData.readUInt8(10);
            const minute = logData.readUInt8(11);
            const second = logData.readUInt8(12);
            
            const timestamp = new Date(year, month, day, hour, minute, second);
            
            attendances.push({
              uid,
              timestamp,
              status,
              verify,
            });
            
            offset += size;
          } else {
            break;
          }
        }
      }
      
      return attendances;
    } catch (error) {
      console.error('[ZKTeco] Erro ao obter logs:', error);
      throw error;
    }
  }

  /**
   * Limpar logs do dispositivo
   */
  async clearAttendances(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      // CMD_CLEAR_ATTLOG (0x000E)
      const response = await this.sendCommand(0x000E, Buffer.alloc(0));
      return response !== null;
    } catch (error) {
      console.error('[ZKTeco] Erro ao limpar logs:', error);
      throw error;
    }
  }

  /**
   * Configurar data/hora do dispositivo
   */
  async setTime(date: Date = new Date()): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      // CMD_SET_TIME (0x0017)
      const timeData = Buffer.alloc(7);
      timeData.writeUInt16LE(date.getFullYear() - 2000, 0);
      timeData.writeUInt8(date.getMonth() + 1, 2);
      timeData.writeUInt8(date.getDate(), 3);
      timeData.writeUInt8(date.getHours(), 4);
      timeData.writeUInt8(date.getMinutes(), 5);
      timeData.writeUInt8(date.getSeconds(), 6);

      const response = await this.sendCommand(0x0017, timeData);
      return response !== null;
    } catch (error) {
      console.error('[ZKTeco] Erro ao configurar hora:', error);
      throw error;
    }
  }
}

