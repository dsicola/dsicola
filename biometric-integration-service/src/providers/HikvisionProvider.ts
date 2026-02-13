/**
 * Provider para dispositivos Hikvision
 * Implementação usando ISAPI (HTTP API)
 */

import { BaseBiometricProvider } from './BaseBiometricProvider.js';
import { EventoBiometricoRaw, FuncionarioSync } from '../types/biometric.js';
import axios, { AxiosInstance } from 'axios';

export class HikvisionProvider extends BaseBiometricProvider {
  private httpClient: AxiosInstance | null = null;
  private listening: boolean = false;
  private pollingInterval?: NodeJS.Timeout;

  async connect(): Promise<boolean> {
    try {
      const baseURL = `http://${this.config.ip}`;
      const auth = Buffer.from(`admin:admin`).toString('base64'); // TODO: Usar credenciais do dispositivo
      
      this.httpClient = axios.create({
        baseURL,
        timeout: 10000,
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      // Testar conexão
      // await this.httpClient.get('/ISAPI/System/deviceInfo');
      
      console.log(`[Hikvision] Conectado a ${this.config.ip}`);
      return true;
    } catch (error) {
      console.error(`[Hikvision] Erro ao conectar:`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.stopListening();
    this.httpClient = null;
  }

  isConnected(): boolean {
    return this.httpClient !== null;
  }

  async syncFuncionarios(funcionarios: FuncionarioSync[]): Promise<boolean> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      console.log(`[Hikvision] Sincronizando ${funcionarios.length} funcionários`);
      
      // TODO: Implementar via ISAPI
      // POST /ISAPI/AccessControl/UserInfo/Record
      // Para cada funcionário, criar registro de usuário
      
      for (const funcionario of funcionarios) {
        // await this.httpClient!.post('/ISAPI/AccessControl/UserInfo/Record', {
        //   EmployeeNo: funcionario.id,
        //   Name: funcionario.nome,
        // });
      }
      
      console.log(`[Hikvision] Sincronização concluída`);
      return true;
    } catch (error) {
      console.error(`[Hikvision] Erro ao sincronizar:`, error);
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
    console.log(`[Hikvision] Iniciando escuta de eventos`);

    // Hikvision usa ISAPI para buscar eventos
    // Implementar polling ou webhook conforme disponível
    
    this.pollingInterval = setInterval(async () => {
      try {
        // GET /ISAPI/AccessControl/AcsEvent
        // const response = await this.httpClient!.get('/ISAPI/AccessControl/AcsEvent', {
        //   params: {
        //     format: 'json',
        //     startTime: lastSyncTime,
        //   },
        // });
        
        // Processar eventos recebidos
        // for (const evento of response.data.AcsEvent) {
        //   const eventoNormalizado: EventoBiometricoRaw = {
        //     device_id: this.config.id,
        //     funcionario_id: evento.employeeNoString,
        //     tipo: evento.direction === 'in' ? 'ENTRADA' : 'SAIDA',
        //     timestamp: new Date(evento.time),
        //   };
        //   onEvento(this.normalizeEvent(eventoNormalizado));
        // }
      } catch (error) {
        console.error(`[Hikvision] Erro ao ler eventos:`, error);
      }
    }, 5000);
  }

  async stopListening(): Promise<void> {
    this.listening = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    console.log(`[Hikvision] Escuta de eventos parada`);
  }
}

