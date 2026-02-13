/**
 * Classe abstrata base para providers de dispositivos biométricos
 */

import { ConfigDispositivo, EventoBiometricoRaw, FuncionarioSync } from '../types/biometric.js';

export abstract class BaseBiometricProvider {
  protected config: ConfigDispositivo;

  constructor(config: ConfigDispositivo) {
    this.config = config;
  }

  /**
   * Conectar ao dispositivo
   */
  abstract connect(): Promise<boolean>;

  /**
   * Desconectar do dispositivo
   */
  abstract disconnect(): Promise<void>;

  /**
   * Verificar se está conectado
   */
  abstract isConnected(): boolean;

  /**
   * Sincronizar funcionários com o dispositivo
   */
  abstract syncFuncionarios(funcionarios: FuncionarioSync[]): Promise<boolean>;

  /**
   * Escutar eventos de presença (ENTRADA/SAIDA)
   * Deve chamar onEvento quando um evento for detectado
   */
  abstract startListening(onEvento: (evento: EventoBiometricoRaw) => void): Promise<void>;

  /**
   * Parar de escutar eventos
   */
  abstract stopListening(): Promise<void>;

  /**
   * Converter evento raw para formato padrão DSICOLA
   */
  protected normalizeEvent(evento: EventoBiometricoRaw): EventoBiometricoRaw {
    return {
      device_id: this.config.id,
      funcionario_id: evento.funcionario_id,
      tipo: evento.tipo,
      timestamp: evento.timestamp instanceof Date 
        ? evento.timestamp.toISOString() 
        : evento.timestamp,
      dados_adicionais: evento.dados_adicionais,
    };
  }
}

