/**
 * Cliente para comunicação com a API do DSICOLA
 */

import axios, { AxiosInstance } from 'axios';
import { EventoBiometricoProcessado } from '../types/biometric.js';

export class DSICOLAClient {
  private httpClient: AxiosInstance;
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
    this.httpClient = axios.create({
      baseURL: apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Enviar evento de presença para o DSICOLA
   */
  async enviarEvento(
    evento: EventoBiometricoProcessado,
    token: string
  ): Promise<boolean> {
    try {
      const response = await this.httpClient.post(
        '/integracao/biometria/evento',
        {
          ...evento,
          token,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.status === 201;
    } catch (error: any) {
      console.error('[DSICOLA] Erro ao enviar evento:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Buscar lista de funcionários para sincronização
   */
  async buscarFuncionarios(deviceId: string, token: string): Promise<any[]> {
    try {
      const response = await this.httpClient.post(
        '/integracao/biometria/sync-funcionarios',
        {
          device_id: deviceId,
          token,
        }
      );

      return response.data.funcionarios || [];
    } catch (error: any) {
      console.error('[DSICOLA] Erro ao buscar funcionários:', error.response?.data || error.message);
      return [];
    }
  }
}

