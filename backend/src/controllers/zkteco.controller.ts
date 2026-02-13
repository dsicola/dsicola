import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { ZKTecoService } from '../services/zkteco.service.js';

/**
 * Testar conexão com dispositivo ZKTeco
 */
export const testarConexao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        tipo: 'ZKTECO',
        ...filter,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo ZKTeco não encontrado', 404);
    }

    const zkteco = new ZKTecoService({
      ip: dispositivo.ip,
      porta: dispositivo.porta,
    });

    try {
      const conectado = await zkteco.testConnection();
      
      // Atualizar status
      await prisma.dispositivoBiometrico.update({
        where: { id },
        data: {
          ultimoStatus: conectado ? 'online' : 'offline',
        },
      });

      res.json({
        success: conectado,
        mensagem: conectado ? 'Conexão bem-sucedida' : 'Falha na conexão',
        dispositivo: {
          id: dispositivo.id,
          nome: dispositivo.nome,
          ip: dispositivo.ip,
          porta: dispositivo.porta,
        },
      });
    } catch (error) {
      await prisma.dispositivoBiometrico.update({
        where: { id },
        data: {
          ultimoStatus: 'erro',
        },
      });

      throw new AppError(
        `Erro ao conectar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        500
      );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Sincronizar funcionários com dispositivo ZKTeco
 */
export const sincronizarFuncionarios = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        tipo: 'ZKTECO',
        ...filter,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo ZKTeco não encontrado', 404);
    }

    // Buscar funcionários ativos da instituição
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        instituicaoId: dispositivo.instituicaoId,
        dataDemissao: null,
      },
      select: {
        id: true,
        nomeCompleto: true,
        numeroIdentificacao: true,
      },
      orderBy: {
        nomeCompleto: 'asc',
      },
    });

    const zkteco = new ZKTecoService({
      ip: dispositivo.ip,
      porta: dispositivo.porta,
    });

    try {
      await zkteco.connect();

      const resultados = {
        sucesso: 0,
        falhas: 0,
        detalhes: [] as Array<{ funcionario: string; sucesso: boolean; mensagem?: string }>,
      };

      // Gerar UIDs únicos (usando hash do ID para garantir unicidade)
      for (const funcionario of funcionarios) {
        try {
          // Gerar UID baseado no ID do funcionário (últimos 4 dígitos do hash)
          const hash = Buffer.from(funcionario.id).toString('hex');
          const uid = parseInt(hash.slice(-4), 16) % 65535; // Limitar a 16 bits
          
          // Verificar se já existe mapeamento
          const mapeamentoExistente = await prisma.dispositivoBiometricoUsuario.findUnique({
            where: {
              dispositivoId_funcionarioId: {
                dispositivoId: dispositivo.id,
                funcionarioId: funcionario.id,
              },
            },
          });

          const deviceUserId = mapeamentoExistente?.deviceUserId || uid;

          // Criar/atualizar usuário no dispositivo
          const sucesso = await zkteco.setUser({
            uid: deviceUserId,
            nome: funcionario.nomeCompleto,
            privilegio: 0, // Usuário comum
            ativo: true,
          });

          if (sucesso) {
            // Salvar mapeamento
            await prisma.dispositivoBiometricoUsuario.upsert({
              where: {
                dispositivoId_funcionarioId: {
                  dispositivoId: dispositivo.id,
                  funcionarioId: funcionario.id,
                },
              },
              create: {
                dispositivoId: dispositivo.id,
                funcionarioId: funcionario.id,
                deviceUserId: deviceUserId.toString(),
                instituicaoId: dispositivo.instituicaoId,
              },
              update: {
                deviceUserId: deviceUserId.toString(),
              },
            });

            resultados.sucesso++;
            resultados.detalhes.push({
              funcionario: funcionario.nomeCompleto,
              sucesso: true,
            });
          } else {
            resultados.falhas++;
            resultados.detalhes.push({
              funcionario: funcionario.nomeCompleto,
              sucesso: false,
              mensagem: 'Falha ao criar usuário no dispositivo',
            });
          }
        } catch (error) {
          resultados.falhas++;
          resultados.detalhes.push({
            funcionario: funcionario.nomeCompleto,
            sucesso: false,
            mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
      }

      await zkteco.disconnect();

      // Atualizar última sincronização
      await prisma.dispositivoBiometrico.update({
        where: { id },
        data: {
          ultimaSincronizacao: new Date(),
          ultimoStatus: 'online',
        },
      });

      res.json({
        success: true,
        total: funcionarios.length,
        ...resultados,
      });
    } catch (error) {
      await zkteco.disconnect().catch(() => {});
      throw new AppError(
        `Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        500
      );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Sincronizar logs offline do dispositivo ZKTeco
 */
export const sincronizarLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { dataInicio, dataFim } = req.query;
    const filter = addInstitutionFilter(req);

    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        tipo: 'ZKTECO',
        ...filter,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo ZKTeco não encontrado', 404);
    }

    const zkteco = new ZKTecoService({
      ip: dispositivo.ip,
      porta: dispositivo.porta,
    });

    try {
      await zkteco.connect();

      // Definir período (padrão: últimos 30 dias)
      const endDate = dataFim ? new Date(dataFim as string) : new Date();
      const startDate = dataInicio
        ? new Date(dataInicio as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Buscar logs do dispositivo
      const attendances = await zkteco.getAttendances(startDate, endDate);

      // Buscar mapeamentos de usuários
      const mapeamentos = await prisma.dispositivoBiometricoUsuario.findMany({
        where: {
          dispositivoId: dispositivo.id,
        },
      });

      const mapeamentoMap = new Map(
        mapeamentos.map((m) => [parseInt(m.deviceUserId), m.funcionarioId])
      );

      let importados = 0;
      let ignorados = 0;

      for (const attendance of attendances) {
        const funcionarioId = mapeamentoMap.get(attendance.uid);

        if (!funcionarioId) {
          ignorados++;
          continue;
        }

        // Verificar se evento já existe (evitar duplicação)
        const eventoExistente = await prisma.eventoBiometrico.findFirst({
          where: {
            dispositivoId: dispositivo.id,
            funcionarioId,
            timestamp: {
              gte: new Date(attendance.timestamp.getTime() - 30000),
              lte: new Date(attendance.timestamp.getTime() + 30000),
            },
            tipoEvento: attendance.status === 0 ? 'ENTRADA' : 'SAIDA',
          },
        });

        if (eventoExistente) {
          ignorados++;
          continue;
        }

        // Criar evento biométrico
        await prisma.eventoBiometrico.create({
          data: {
            dispositivoId: dispositivo.id,
            funcionarioId,
            tipoEvento: attendance.status === 0 ? 'ENTRADA' : 'SAIDA',
            timestamp: attendance.timestamp,
            ipOrigem: dispositivo.ip,
            instituicaoId: dispositivo.instituicaoId,
            processado: false,
          },
        });

        importados++;
      }

      await zkteco.disconnect();

      // Importar função de processamento do controller de integração
      const { processarEventoBiometrico } = await import('./integracaoBiometria.controller.js');
      
      // Processar eventos importados
      const eventosParaProcessar = await prisma.eventoBiometrico.findMany({
        where: {
          dispositivoId: dispositivo.id,
          processado: false,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Processar assincronamente
      for (const evento of eventosParaProcessar) {
        try {
          await processarEventoBiometrico(evento.id);
        } catch (error) {
          console.error(`Erro ao processar evento ${evento.id}:`, error);
        }
      }

      res.json({
        success: true,
        importados,
        ignorados,
        total: attendances.length,
        periodo: {
          inicio: startDate,
          fim: endDate,
        },
      });
    } catch (error) {
      await zkteco.disconnect().catch(() => {});
      throw new AppError(
        `Erro ao sincronizar logs: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        500
      );
    }
  } catch (error) {
    next(error);
  }
};


/**
 * Obter informações do dispositivo ZKTeco
 */
export const getDeviceInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        tipo: 'ZKTECO',
        ...filter,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo ZKTeco não encontrado', 404);
    }

    const zkteco = new ZKTecoService({
      ip: dispositivo.ip,
      porta: dispositivo.porta,
    });

    try {
      await zkteco.connect();
      const info = await zkteco.getDeviceInfo();
      await zkteco.disconnect();

      res.json({
        success: true,
        dispositivo: {
          id: dispositivo.id,
          nome: dispositivo.nome,
          ip: dispositivo.ip,
          porta: dispositivo.porta,
        },
        info,
      });
    } catch (error) {
      await zkteco.disconnect().catch(() => {});
      throw new AppError(
        `Erro ao obter informações: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        500
      );
    }
  } catch (error) {
    next(error);
  }
};

