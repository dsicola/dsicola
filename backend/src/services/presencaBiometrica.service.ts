import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { BiometriaService } from './biometria.service.js';

/**
 * Service para processar presenças biométricas
 * Calcula automaticamente atrasos, faltas e horas trabalhadas
 */

export class PresencaBiometricaService {
  /**
   * Marcar presença via biometria (Check-in ou Check-out)
   */
  static async marcarPresenca(
    template: string,
    instituicaoId: string,
    horarioPadraoEntrada?: string, // Ex: "08:00"
    horarioPadraoSaida?: string // Ex: "17:00"
  ) {
    // Identificar funcionário pelo template
    const funcionarioId = await BiometriaService.identificarFuncionario(
      template,
      instituicaoId
    );

    if (!funcionarioId) {
      throw new AppError('Funcionário não identificado pela biometria', 404);
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Buscar ou criar registro de frequência do dia
    let frequencia = await prisma.frequenciaFuncionario.findUnique({
      where: {
        funcionarioId_data: {
          funcionarioId,
          data: hoje,
        },
      },
    });

    const agora = new Date();
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

    if (!frequencia) {
      // Primeira marcação do dia (Check-in)
      frequencia = await prisma.frequenciaFuncionario.create({
        data: {
          funcionarioId,
          data: hoje,
          horaEntrada: horaAtual,
          origem: 'BIOMETRIA',
          instituicaoId,
          status: this.calcularStatus(horaAtual, horarioPadraoEntrada, null),
        },
      });
    } else {
      // Segunda marcação do dia (Check-out)
      if (frequencia.horaSaida) {
        throw new AppError('Presença já registrada para este dia', 400);
      }

      frequencia = await prisma.frequenciaFuncionario.update({
        where: { id: frequencia.id },
        data: {
          horaSaida: horaAtual,
          status: this.calcularStatus(
            frequencia.horaEntrada || horaAtual,
            horarioPadraoEntrada,
            horaAtual,
            horarioPadraoSaida
          ),
          horasTrabalhadas: this.calcularHorasTrabalhadas(
            frequencia.horaEntrada || horaAtual,
            horaAtual
          ),
        },
      });
    }

    return frequencia;
  }

  /**
   * Calcular status da presença
   */
  private static calcularStatus(
    horaEntrada: string | null,
    horarioPadraoEntrada?: string,
    horaSaida?: string | null,
    horarioPadraoSaida?: string
  ): 'PRESENTE' | 'ATRASO' | 'FALTA' | 'INCOMPLETO' {
    if (!horaEntrada) {
      return 'FALTA';
    }

    // Se não tem saída, está incompleto
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
  }

  /**
   * Calcular horas trabalhadas
   */
  private static calcularHorasTrabalhadas(
    horaEntrada: string,
    horaSaida: string
  ): number {
    const [horaE, minutoE] = horaEntrada.split(':').map(Number);
    const [horaS, minutoS] = horaSaida.split(':').map(Number);

    const minutosEntrada = horaE * 60 + minutoE;
    const minutosSaida = horaS * 60 + minutoS;

    const minutosTrabalhados = minutosSaida - minutosEntrada;
    const horasTrabalhadas = minutosTrabalhados / 60;

    return Math.max(0, horasTrabalhadas); // Não permitir horas negativas
  }

  /**
   * Processar presenças do dia e marcar faltas
   */
  static async processarPresencasDia(
    data: Date,
    instituicaoId: string,
    horarioPadraoEntrada?: string
  ) {
    // Buscar todos os funcionários ativos da instituição
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        instituicaoId,
            status: 'ATIVO',
      },
      select: {
        id: true,
      },
    });

    const dataFormatada = new Date(data);
    dataFormatada.setHours(0, 0, 0, 0);

    const faltas: string[] = [];

    for (const funcionario of funcionarios) {
      // Verificar se já existe registro de presença
      const frequencia = await prisma.frequenciaFuncionario.findUnique({
        where: {
          funcionarioId_data: {
            funcionarioId: funcionario.id,
            data: dataFormatada,
          },
        },
      });

      // Se não existe presença e já passou do horário de entrada padrão
      if (!frequencia && horarioPadraoEntrada) {
        const [horaPadrao] = horarioPadraoEntrada.split(':').map(Number);
        const agora = new Date();

        // Se já passou do horário padrão, marcar como falta
        if (agora.getHours() >= horaPadrao + 1) {
          await prisma.frequenciaFuncionario.create({
            data: {
              funcionarioId: funcionario.id,
              data: dataFormatada,
              status: 'FALTA',
              origem: 'MANUAL', // Gerada automaticamente pelo sistema
              instituicaoId,
            },
          });

          faltas.push(funcionario.id);
        }
      }
    }

    return { faltasProcessadas: faltas.length, faltas };
  }

  /**
   * Buscar presenças de funcionário
   */
  static async getPresencas(
    funcionarioId: string,
    instituicaoId: string,
    dataInicio?: Date,
    dataFim?: Date
  ) {
    const where: any = {
      funcionarioId,
      instituicaoId,
    };

    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) {
        where.data.gte = new Date(dataInicio);
      }
      if (dataFim) {
        where.data.lte = new Date(dataFim);
      }
    }

    return await prisma.frequenciaFuncionario.findMany({
      where,
      include: {
        funcionario: {
          select: {
            id: true,
            nomeCompleto: true,
          },
        },
        justificativa: {
          select: {
            id: true,
            status: true,
            motivo: true,
          },
        },
      },
      orderBy: {
        data: 'desc',
      },
    });
  }
}

