/**
 * Tipos para integração biométrica
 */

export enum TipoDispositivo {
  ZKTECO = 'ZKTECO',
  HIKVISION = 'HIKVISION',
  SUPREMA = 'SUPREMA',
}

export enum TipoEvento {
  ENTRADA = 'ENTRADA',
  SAIDA = 'SAIDA',
}

export interface ConfigDispositivo {
  id: string;
  nome: string;
  tipo: TipoDispositivo;
  ip: string;
  porta: number;
  token: string;
  instituicaoId: string;
}

export interface EventoBiometricoRaw {
  device_id: string;
  funcionario_id: string;
  timestamp: Date | string;
  tipo: TipoEvento;
  dados_adicionais?: Record<string, any>;
}

export interface EventoBiometricoProcessado {
  device_id: string;
  funcionario_id: string;
  tipo: TipoEvento;
  timestamp: string; // ISO string
}

export interface FuncionarioSync {
  id: string;
  nome: string;
  numero_identificacao?: string;
}

