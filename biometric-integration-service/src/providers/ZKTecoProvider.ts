/**
 * Provider para dispositivos ZKTeco
 * Implementação usando TCP/IP e SDK ZKTeco
 */

import { BaseBiometricProvider } from './BaseBiometricProvider.js';
import { EventoBiometricoRaw, FuncionarioSync } from '../types/biometric.js';

export class ZKTecoProvider extends BaseBiometricProvider {
  private socket: any = null;
  private listening: boolean = false;
  private onEventoCallback?: (evento: EventoBiometricoRaw) => void;

  async connect(): Promise<boolean> {
    try {
      // TODO: Implementar conexão TCP/IP com dispositivo ZKTeco
      // Usar biblioteca específica ou socket TCP nativo
      
      console.log(`[ZKTeco] Conectando a ${this.config.ip}:${this.config.porta}`);
      
      // Exemplo de implementação (será completado com SDK real)
      // const zkt = new ZKTecoSDK(this.config.ip, this.config.porta);
      // await zkt.connect();
      // this.socket = zkt;
      
      console.log(`[ZKTeco] Conectado com sucesso`);
      return true;
    } catch (error) {
      console.error(`[ZKTeco] Erro ao conectar:`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.stopListening();
    
    if (this.socket) {
      // TODO: Implementar desconexão
      // await this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null;
  }

  async syncFuncionarios(funcionarios: FuncionarioSync[]): Promise<boolean> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      // TODO: Implementar sincronização de funcionários
      // Para cada funcionário:
      // 1. Criar usuário no dispositivo com ID único
      // 2. Aguardar cadastro biométrico no dispositivo físico
      // 3. Confirmar sincronização
      
      console.log(`[ZKTeco] Sincronizando ${funcionarios.length} funcionários`);
      
      for (const funcionario of funcionarios) {
        // await this.socket.createUser({
        //   uid: funcionario.id,
        //   name: funcionario.nome,
        //   privilege: 0, // Usuário normal
        // });
      }
      
      console.log(`[ZKTeco] Sincronização concluída`);
      return true;
    } catch (error) {
      console.error(`[ZKTeco] Erro ao sincronizar:`, error);
      return false;
    }
  }

  async startListening(onEvento: (evento: EventoBiometricoRaw) => void): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }

    if (this.listening) {
      return;
    }

    this.onEventoCallback = onEvento;
    this.listening = true;

    // TODO: Implementar listener de eventos em tempo real
    // ZKTeco geralmente usa polling ou webhook HTTP push
    // Exemplo com polling:
    
    console.log(`[ZKTeco] Iniciando escuta de eventos`);
    
    // setInterval(async () => {
    //   try {
    //     const eventos = await this.socket.getAttendances();
    //     for (const evento of eventos) {
    //       const eventoNormalizado: EventoBiometricoRaw = {
    //         device_id: this.config.id,
    //         funcionario_id: evento.uid,
    //         tipo: this.determinarTipoEvento(evento),
    //         timestamp: new Date(evento.timestamp * 1000), // ZKTeco usa timestamp Unix
    //       };
    //       onEvento(this.normalizeEvent(eventoNormalizado));
    //     }
    //   } catch (error) {
    //     console.error(`[ZKTeco] Erro ao ler eventos:`, error);
    //   }
    // }, 5000); // Polling a cada 5 segundos
  }

  async stopListening(): Promise<void> {
    this.listening = false;
    this.onEventoCallback = undefined;
    console.log(`[ZKTeco] Escuta de eventos parada`);
  }

  private determinarTipoEvento(evento: any): 'ENTRADA' | 'SAIDA' {
    // ZKTeco geralmente retorna type: 0 (Check-in) ou 1 (Check-out)
    // Ajustar conforme documentação do dispositivo
    return evento.type === 0 ? 'ENTRADA' : 'SAIDA';
  }
}

