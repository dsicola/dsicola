import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';

/**
 * Endpoint INTERNO para receber eventos dos dispositivos biométricos
 * Autenticação via token do dispositivo
 */
export const receberEvento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { device_id, funcionario_id, tipo, timestamp, token } = req.body;
    const ipOrigem = req.ip || req.socket.remoteAddress || '';

    // Validar campos obrigatórios
    if (!device_id || !funcionario_id || !tipo || !timestamp || !token) {
      throw new AppError('Campos obrigatórios: device_id, funcionario_id, tipo, timestamp, token', 400);
    }

    // Validar tipo de evento
    if (!['ENTRADA', 'SAIDA'].includes(tipo)) {
      throw new AppError('Tipo de evento inválido. Deve ser ENTRADA ou SAIDA', 400);
    }

    // Buscar dispositivo e validar token
    const dispositivo = await prisma.dispositivoBiometrico.findUnique({
      where: { id: device_id },
      include: {
        instituicao: true,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo não encontrado', 404);
    }

    if (!dispositivo.ativo) {
      throw new AppError('Dispositivo inativo', 403);
    }

    // Validar token
    if (dispositivo.token !== token) {
      throw new AppError('Token inválido', 401);
    }

    // Validar IP se houver whitelist
    if (dispositivo.ipsPermitidos.length > 0) {
      const ipPermitido = dispositivo.ipsPermitidos.some((ipPermitido) => {
        return ipOrigem.includes(ipPermitido) || ipPermitido.includes(ipOrigem);
      });

      if (!ipPermitido) {
        throw new AppError(`IP ${ipOrigem} não está na whitelist do dispositivo`, 403);
      }
    }

    // Verificar se funcionário existe e pertence à mesma instituição
    const funcionario = await prisma.funcionario.findFirst({
      where: {
        id: funcionario_id,
        instituicaoId: dispositivo.instituicaoId,
      },
    });

    if (!funcionario) {
      throw new AppError('Funcionário não encontrado ou não pertence à instituição do dispositivo', 404);
    }

    // Converter timestamp para Date
    const timestampDate = new Date(timestamp);
    if (isNaN(timestampDate.getTime())) {
      throw new AppError('Timestamp inválido', 400);
    }

    // VALIDAÇÃO DE DUPLICAÇÃO MELHORADA
    // Verificar duplicação: mesmo dispositivo, funcionário, tipo e timestamp (janela de 60 segundos)
    const timestampInicio = new Date(timestampDate.getTime() - 60000); // 1 minuto antes
    const timestampFim = new Date(timestampDate.getTime() + 60000); // 1 minuto depois

    const eventoDuplicado = await prisma.eventoBiometrico.findFirst({
      where: {
        dispositivoId: device_id,
        funcionarioId: funcionario_id,
        tipoEvento: tipo as 'ENTRADA' | 'SAIDA',
        timestamp: {
          gte: timestampInicio,
          lte: timestampFim,
        },
        processado: false, // Ainda não processado
      },
      orderBy: {
        recebidoEm: 'desc',
      },
    });

    if (eventoDuplicado) {
      // Retornar sucesso mas não criar duplicado
      // Registrar tentativa de evento duplicado na auditoria
      await prisma.logAuditoria.create({
        data: {
          instituicaoId: dispositivo.instituicaoId,
          modulo: 'PRESENCA_BIOMETRICA',
          entidade: 'EVENTO_BIOMETRICO',
          entidadeId: eventoDuplicado.id,
          acao: 'BLOCK',
          tabela: 'eventos_biometricos',
          registroId: eventoDuplicado.id,
          dadosAnteriores: {
            timestampOriginal: eventoDuplicado.timestamp,
            tipoEvento: eventoDuplicado.tipoEvento,
            processado: eventoDuplicado.processado,
          },
          dadosNovos: {
            motivo: 'Evento duplicado bloqueado',
            timestampOriginal: eventoDuplicado.timestamp.toISOString(),
            timestampTentativa: timestampDate.toISOString(),
            diferencaSegundos: Math.abs((timestampDate.getTime() - eventoDuplicado.timestamp.getTime()) / 1000),
          },
          ipOrigem: ipOrigem || 'Desconhecido',
          userId: null,
          observacao: `Tentativa de evento duplicado bloqueada. Funcionário: ${funcionario.nomeCompleto}, Tipo: ${tipo}, Dispositivo: ${dispositivo.nome}. Janela de duplicação: 60 segundos.`,
        },
      });

      return res.json({
        success: true,
        message: 'Evento duplicado detectado e ignorado',
        evento_id: eventoDuplicado.id,
        duplicado: true,
      });
    }

    // Criar evento biométrico
    const evento = await prisma.eventoBiometrico.create({
      data: {
        dispositivoId: device_id,
        funcionarioId: funcionario_id,
        tipoEvento: tipo as 'ENTRADA' | 'SAIDA',
        timestamp: timestampDate,
        ipOrigem: ipOrigem || null,
        instituicaoId: dispositivo.instituicaoId,
        processado: false,
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nomeCompleto: true,
          },
        },
        dispositivo: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Atualizar último status do dispositivo
    await prisma.dispositivoBiometrico.update({
      where: { id: device_id },
      data: {
        ultimoStatus: 'online',
        ultimaSincronizacao: new Date(),
      },
    });

    // Processar evento assincronamente (criar/atualizar FrequenciaFuncionario)
    processarEventoBiometrico(evento.id).catch((error) => {
      console.error('Erro ao processar evento biométrico:', error);
    });

    // Log de auditoria será criado pelo processamento

    res.status(201).json({
      success: true,
      evento_id: evento.id,
      message: 'Evento recebido e processando',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Processar evento biométrico e criar/atualizar FrequenciaFuncionario
 * Exportada para uso em outros controllers
 * Calcula automaticamente atrasos, faltas e horas trabalhadas
 */
export async function processarEventoBiometrico(eventoId: string) {
  try {
    const evento = await prisma.eventoBiometrico.findUnique({
      where: { id: eventoId },
      include: {
        funcionario: {
          include: {
            cargo: true,
          },
        },
        dispositivo: true,
      },
    });

    if (!evento || evento.processado) {
      return;
    }

    // VALIDAÇÃO CRÍTICA: Verificar se dispositivo está ativo e válido
    if (!evento.dispositivo.ativo) {
      await prisma.eventoBiometrico.update({
        where: { id: eventoId },
        data: {
          erro: 'Dispositivo inativo',
          processado: false,
        },
      });
      throw new AppError('Dispositivo biométrico inativo. Evento não processado.', 403);
    }

    // Data do evento (apenas a data, sem hora)
    const dataEvento = new Date(evento.timestamp);
    dataEvento.setHours(0, 0, 0, 0);

    // Hora do evento (formato HH:mm)
    const horaEvento = evento.timestamp.toTimeString().slice(0, 5);

    // Buscar horário padrão (do cargo se disponível, senão usar padrão 08:00)
    // Por enquanto, usar 08:00 como padrão (pode ser configurado no cargo futuramente)
    const horarioPadraoEntrada = '08:00'; // TODO: Buscar do cargo do funcionário
    const horarioPadraoSaida = '17:00'; // TODO: Buscar do cargo do funcionário

    // Função auxiliar para calcular status com atraso
    const calcularStatus = (horaEntrada: string | null, horaSaida: string | null): 'PRESENTE' | 'ATRASO' | 'INCOMPLETO' => {
      if (!horaEntrada) {
        return 'INCOMPLETO';
      }

      if (!horaSaida) {
        return 'INCOMPLETO';
      }

      // Verificar atraso na entrada
      if (horarioPadraoEntrada) {
        const [horaPadrao, minutoPadrao] = horarioPadraoEntrada.split(':').map(Number);
        const [horaEntradaNum, minutoEntradaNum] = horaEntrada.split(':').map(Number);

        const minutosPadrao = horaPadrao * 60 + minutoPadrao;
        const minutosEntrada = horaEntradaNum * 60 + minutoEntradaNum;

        if (minutosEntrada > minutosPadrao) {
          return 'ATRASO';
        }
      }

      return 'PRESENTE';
    };

    // Função auxiliar para calcular horas trabalhadas
    const calcularHorasTrabalhadas = (horaEntrada: string, horaSaida: string): number => {
      const [horaE, minutoE] = horaEntrada.split(':').map(Number);
      const [horaS, minutoS] = horaSaida.split(':').map(Number);

      const minutosEntrada = horaE * 60 + minutoE;
      const minutosSaida = horaS * 60 + minutoS;

      const minutosTrabalhados = minutosSaida - minutosEntrada;
      const horasTrabalhadas = minutosTrabalhados / 60;

      return Math.max(0, horasTrabalhadas);
    };

    // Buscar ou criar frequência para o dia
    const frequenciaAnterior = await prisma.frequenciaFuncionario.findUnique({
      where: {
        funcionarioId_data: {
          funcionarioId: evento.funcionarioId,
          data: dataEvento,
        },
      },
    });

    let frequencia;
    let acaoAuditoria: 'CREATE' | 'UPDATE' = 'CREATE';

    if (!frequenciaAnterior) {
      // Criar nova frequência
      const statusInicial = evento.tipoEvento === 'ENTRADA' 
        ? calcularStatus(horaEvento, null)
        : 'INCOMPLETO';

      frequencia = await prisma.frequenciaFuncionario.create({
        data: {
          funcionarioId: evento.funcionarioId,
          data: dataEvento,
          status: statusInicial === 'INCOMPLETO' ? 'PRESENTE' : statusInicial, // INCOMPLETO vira PRESENTE inicialmente
          origem: 'BIOMETRIA',
          instituicaoId: evento.instituicaoId,
          horaEntrada: evento.tipoEvento === 'ENTRADA' ? horaEvento : null,
          horaSaida: evento.tipoEvento === 'SAIDA' ? horaEvento : null,
        },
      });
    } else {
      // BLOQUEIO: Não permitir atualizar presença manual com biométrica
      if (frequenciaAnterior.origem !== 'BIOMETRIA') {
        await prisma.eventoBiometrico.update({
          where: { id: eventoId },
          data: {
            erro: 'Já existe presença manual para esta data. Não é possível substituir por biométrica.',
            processado: false,
          },
        });
        throw new AppError('Já existe presença manual registrada para esta data. Evento biométrico não processado.', 409);
      }

      // Atualizar frequência existente
      acaoAuditoria = 'UPDATE';
      const updateData: any = {
        origem: 'BIOMETRIA',
      };

      if (evento.tipoEvento === 'ENTRADA' && !frequenciaAnterior.horaEntrada) {
        updateData.horaEntrada = horaEvento;
        // Calcular status considerando possível atraso
        updateData.status = calcularStatus(horaEvento, frequenciaAnterior.horaSaida);
      } else if (evento.tipoEvento === 'SAIDA') {
        updateData.horaSaida = horaEvento;

        // Calcular horas trabalhadas se tiver entrada e saída
        const horaEntradaFinal = frequenciaAnterior.horaEntrada || horaEvento;
        if (frequenciaAnterior.horaEntrada) {
          updateData.horasTrabalhadas = calcularHorasTrabalhadas(
            frequenciaAnterior.horaEntrada,
            horaEvento
          ).toFixed(2);
        }

        // Calcular status final
        updateData.status = calcularStatus(horaEntradaFinal, horaEvento);
      }

      frequencia = await prisma.frequenciaFuncionario.update({
        where: { id: frequenciaAnterior.id },
        data: updateData,
      });
    }

    // Marcar evento como processado
    await prisma.eventoBiometrico.update({
      where: { id: eventoId },
      data: {
        processado: true,
        erro: null,
      },
    });

    // Criar log de auditoria completo
    // NOTA: Usando prisma diretamente pois não temos Request object neste contexto assíncrono
    await prisma.logAuditoria.create({
      data: {
        instituicaoId: evento.instituicaoId,
        modulo: 'PRESENCA_BIOMETRICA',
        entidade: 'FREQUENCIA_FUNCIONARIO',
        entidadeId: frequencia.id,
        acao: acaoAuditoria,
        tabela: 'frequencia_funcionarios',
        registroId: frequencia.id,
        dadosAnteriores: frequenciaAnterior ? {
          status: frequenciaAnterior.status,
          horaEntrada: frequenciaAnterior.horaEntrada,
          horaSaida: frequenciaAnterior.horaSaida,
          origem: frequenciaAnterior.origem,
          horasTrabalhadas: frequenciaAnterior.horasTrabalhadas,
        } : undefined,
        dadosNovos: {
          status: frequencia.status,
          horaEntrada: frequencia.horaEntrada,
          horaSaida: frequencia.horaSaida,
          origem: frequencia.origem,
          horasTrabalhadas: frequencia.horasTrabalhadas,
          eventoBiometricoId: eventoId,
          dispositivoId: evento.dispositivoId,
        },
        ipOrigem: evento.ipOrigem || 'Sistema',
        userId: null,
        observacao: `Presença biométrica ${evento.tipoEvento.toLowerCase()} registrada para ${evento.funcionario.nomeCompleto} via dispositivo ${evento.dispositivo.nome} (ID: ${evento.dispositivo.id}). Status calculado: ${frequencia.status}.`,
      },
    });
  } catch (error) {
    // Marcar evento com erro
    await prisma.eventoBiometrico.update({
      where: { id: eventoId },
      data: {
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
        processado: false,
      },
    });

    throw error;
  }
}

/**
 * Endpoint para sincronizar funcionários com dispositivo
 * Usado pelo serviço de integração para enviar lista de funcionários
 */
export const syncFuncionarios = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { device_id, token } = req.body;

    if (!device_id || !token) {
      throw new AppError('device_id e token são obrigatórios', 400);
    }

    // Validar dispositivo
    const dispositivo = await prisma.dispositivoBiometrico.findUnique({
      where: { id: device_id },
      include: {
        instituicao: true,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo não encontrado', 404);
    }

    if (!dispositivo.ativo) {
      throw new AppError('Dispositivo inativo', 403);
    }

    if (dispositivo.token !== token) {
      throw new AppError('Token inválido', 401);
    }

    // Buscar funcionários ativos da instituição
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        instituicaoId: dispositivo.instituicaoId,
        dataDemissao: null, // Apenas funcionários ativos
      },
      select: {
        id: true,
        nomeCompleto: true,
        numeroIdentificacao: true,
        dataAdmissao: true,
      },
      orderBy: {
        nomeCompleto: 'asc',
      },
    });

    res.json({
      success: true,
      funcionarios: funcionarios.map((f) => ({
        id: f.id,
        nome: f.nomeCompleto,
        numero_identificacao: f.numeroIdentificacao,
      })),
      total: funcionarios.length,
    });
  } catch (error) {
    next(error);
  }
};

