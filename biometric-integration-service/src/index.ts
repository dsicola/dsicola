/**
 * Entry point do serviço de integração biométrica
 */

import { BaseBiometricProvider } from './providers/BaseBiometricProvider.js';
import { ZKTecoProvider } from './providers/ZKTecoProvider.js';
import { HikvisionProvider } from './providers/HikvisionProvider.js';
import { SupremaProvider } from './providers/SupremaProvider.js';
import { EventProcessor } from './services/EventProcessor.js';
import { DSICOLAClient } from './services/DSICOLAClient.js';
import { TipoDispositivo, ConfigDispositivo } from './types/biometric.js';

/**
 * Factory para criar providers baseado no tipo
 */
function createProvider(config: ConfigDispositivo): BaseBiometricProvider {
  switch (config.tipo) {
    case TipoDispositivo.ZKTECO:
      return new ZKTecoProvider(config);
    case TipoDispositivo.HIKVISION:
      return new HikvisionProvider(config);
    case TipoDispositivo.SUPREMA:
      return new SupremaProvider(config);
    default:
      throw new Error(`Tipo de dispositivo não suportado: ${config.tipo}`);
  }
}

/**
 * Inicializar integração para um dispositivo
 */
async function iniciarIntegracao(config: ConfigDispositivo, apiUrl: string) {
  console.log(`[Integração] Iniciando para dispositivo: ${config.nome} (${config.tipo})`);

  const provider = createProvider(config);
  const eventProcessor = new EventProcessor(apiUrl, config.token);
  const dsicolaClient = new DSICOLAClient(apiUrl);

  try {
    // Conectar ao dispositivo
    const conectado = await provider.connect();
    if (!conectado) {
      throw new Error('Falha ao conectar ao dispositivo');
    }

    // Sincronizar funcionários
    const funcionarios = await dsicolaClient.buscarFuncionarios(config.id, config.token);
    if (funcionarios.length > 0) {
      await provider.syncFuncionarios(funcionarios);
    }

    // Iniciar escuta de eventos
    await provider.startListening(async (evento) => {
      await eventProcessor.processarEvento(evento);
    });

    console.log(`[Integração] Dispositivo ${config.nome} integrado com sucesso`);

    return provider;
  } catch (error) {
    console.error(`[Integração] Erro ao iniciar integração:`, error);
    await provider.disconnect();
    throw error;
  }
}

/**
 * Função principal
 * Em produção, isso seria executado como serviço e receberia configurações
 * via variáveis de ambiente ou API de descoberta do DSICOLA
 */
async function main() {
  const apiUrl = process.env.DSICOLA_API_URL || 'http://localhost:3000';

  // TODO: Buscar dispositivos ativos do DSICOLA
  // Por enquanto, exemplo de configuração manual:
  
  const dispositivos: ConfigDispositivo[] = [
    // Exemplo:
    // {
    //   id: 'device-1',
    //   nome: 'Biometria Portaria',
    //   tipo: TipoDispositivo.ZKTECO,
    //   ip: '192.168.1.100',
    //   porta: 4370,
    //   token: 'token-do-dispositivo',
    //   instituicaoId: 'instituicao-id',
    // },
  ];

  const providers: BaseBiometricProvider[] = [];

  // Inicializar cada dispositivo
  for (const dispositivo of dispositivos) {
    try {
      const provider = await iniciarIntegracao(dispositivo, apiUrl);
      providers.push(provider);
    } catch (error) {
      console.error(`[Main] Erro ao iniciar dispositivo ${dispositivo.nome}:`, error);
    }
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[Main] Encerrando serviços...');
    for (const provider of providers) {
      await provider.disconnect();
    }
    process.exit(0);
  });
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { iniciarIntegracao, createProvider };

