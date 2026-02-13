/**
 * Provider para dispositivos Suprema (BioStar)
 * Implementação usando BioStar API
 */

import { BaseBiometricProvider } from './BaseBiometricProvider.js';
import { EventoBiometricoRaw, FuncionarioSync } from '../types/biometric.js';

export class SupremaProvider extends BaseBiometricProvider {
  private connected: boolean = false;
  private listening: boolean = false;

  async connect(): Promise<boolean> {
    try {
      // TODO: Implementar conexão com BioStar
      // Suprema geralmente usa HTTP API similar ao Hikvision
      
      console.log(`[Suprema] Conectando a ${this.config.ip}:${this.config.porta}`);
      
      // Exemplo:
      // const biostar = new BioStarClient(this.config.ip, this.config.porta);
      // await biostar.connect();
      // this.connected = true;
      
      console.log(`[Suprema] Conectado com sucesso`);
      this.connected = true;
      return true;
    } catch (error) {
      console.error(`[Suprema] Erro ao conectar:`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.stopListening();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async syncFuncionarios(funcionarios: FuncionarioSync[]): Promise<boolean> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      console.log(`[Suprema] Sincronizando ${funcionarios.length} funcionários`);
      
      // TODO: Implementar sincronização via BioStar API
      // POST /api/users
      
      for (const funcionario of funcionarios) {
        // await biostar.createUser({
        //   user_id: funcionario.id,
        //   name: funcionario.nome,
        // });
      }
      
      console.log(`[Suprema] Sincronização concluída`);
      return true;
    } catch (error) {
      console.error(`[Suprema] Erro ao sincronizar:`, error);
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

    this.listening = true;
    console.log(`[Suprema] Iniciando escuta de eventos`);

    // TODO: Implementar listener via BioStar API
    // Geralmente usa polling ou webhook
  }

  async stopListening(): Promise<void> {
    this.listening = false;
    console.log(`[Suprema] Escuta de eventos parada`);
  }
}

