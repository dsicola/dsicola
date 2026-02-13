/**
 * Processador de eventos biométricos
 */

import { BaseBiometricProvider } from '../providers/BaseBiometricProvider.js';
import { DSICOLAClient } from './DSICOLAClient.js';
import { EventoBiometricoRaw, EventoBiometricoProcessado } from '../types/biometric.js';

export class EventProcessor {
  private dsicolaClient: DSICOLAClient;
  private deviceToken: string;
  private retryQueue: EventoBiometricoProcessado[] = [];
  private processing: boolean = false;

  constructor(apiUrl: string, deviceToken: string) {
    this.dsicolaClient = new DSICOLAClient(apiUrl);
    this.deviceToken = deviceToken;
  }

  /**
   * Processar evento recebido do dispositivo
   */
  async processarEvento(evento: EventoBiometricoRaw): Promise<void> {
    const eventoProcessado: EventoBiometricoProcessado = {
      device_id: evento.device_id,
      funcionario_id: evento.funcionario_id,
      tipo: evento.tipo,
      timestamp: evento.timestamp instanceof Date
        ? evento.timestamp.toISOString()
        : evento.timestamp,
    };

    console.log(`[EventProcessor] Processando evento:`, eventoProcessado);

    const enviado = await this.dsicolaClient.enviarEvento(eventoProcessado, this.deviceToken);

    if (!enviado) {
      console.warn(`[EventProcessor] Falha ao enviar evento, adicionando à fila de retry`);
      this.retryQueue.push(eventoProcessado);
      
      // Tentar novamente após 5 segundos
      setTimeout(() => {
        this.processarRetryQueue();
      }, 5000);
    } else {
      console.log(`[EventProcessor] Evento enviado com sucesso`);
    }
  }

  /**
   * Processar fila de retry
   */
  private async processarRetryQueue(): Promise<void> {
    if (this.processing || this.retryQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.retryQueue.length > 0) {
      const evento = this.retryQueue.shift();
      if (!evento) break;

      const enviado = await this.dsicolaClient.enviarEvento(evento, this.deviceToken);
      
      if (!enviado) {
        // Adicionar novamente ao final da fila
        this.retryQueue.push(evento);
        break;
      }
    }

    this.processing = false;

    // Se ainda houver eventos na fila, tentar novamente
    if (this.retryQueue.length > 0) {
      setTimeout(() => {
        this.processarRetryQueue();
      }, 10000); // Aguardar 10 segundos antes de tentar novamente
    }
  }
}

