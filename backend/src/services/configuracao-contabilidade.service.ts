/**
 * Configuração de contas contabilísticas por instituição
 * Permite cada instituição usar códigos de conta diferentes sem alterar código
 */
import prisma from '../lib/prisma.js';

export interface ConfiguracaoContabilidadeData {
  contaCaixaCodigo?: string;
  contaBancoCodigo?: string;
  contaReceitaMensalidadesCodigo?: string;
  contaReceitaTaxasCodigo?: string;
  contaPessoalCodigo?: string;
  contaFornecedoresCodigo?: string;
}

const DEFAULTS: Required<ConfiguracaoContabilidadeData> = {
  contaCaixaCodigo: '11',
  contaBancoCodigo: '12',
  contaReceitaMensalidadesCodigo: '41',
  contaReceitaTaxasCodigo: '42',
  contaPessoalCodigo: '51',
  contaFornecedoresCodigo: '21',
};

export class ConfiguracaoContabilidadeService {
  /**
   * Obter configuração da instituição (cria com defaults se não existir)
   */
  static async get(instituicaoId: string) {
    let config = await prisma.configuracaoContabilidade.findUnique({
      where: { instituicaoId },
    });
    if (!config) {
      config = await prisma.configuracaoContabilidade.create({
        data: {
          instituicaoId,
          ...DEFAULTS,
        },
      });
    }
    return config;
  }

  /**
   * Atualizar configuração
   */
  static async update(instituicaoId: string, data: ConfiguracaoContabilidadeData) {
    const existing = await prisma.configuracaoContabilidade.findUnique({
      where: { instituicaoId },
    });

    const updateData: Record<string, string> = {};
    if (data.contaCaixaCodigo !== undefined) updateData.contaCaixaCodigo = data.contaCaixaCodigo.trim();
    if (data.contaBancoCodigo !== undefined) updateData.contaBancoCodigo = data.contaBancoCodigo.trim();
    if (data.contaReceitaMensalidadesCodigo !== undefined)
      updateData.contaReceitaMensalidadesCodigo = data.contaReceitaMensalidadesCodigo.trim();
    if (data.contaReceitaTaxasCodigo !== undefined)
      updateData.contaReceitaTaxasCodigo = data.contaReceitaTaxasCodigo.trim();
    if (data.contaPessoalCodigo !== undefined) updateData.contaPessoalCodigo = data.contaPessoalCodigo.trim();
    if (data.contaFornecedoresCodigo !== undefined)
      updateData.contaFornecedoresCodigo = data.contaFornecedoresCodigo.trim();

    if (!existing) {
      return prisma.configuracaoContabilidade.create({
        data: {
          instituicaoId,
          ...DEFAULTS,
          ...updateData,
        },
      });
    }

    return prisma.configuracaoContabilidade.update({
      where: { instituicaoId },
      data: updateData,
    });
  }

  /**
   * Obter códigos de conta para integração (com fallback para defaults)
   */
  static async getCodigosContas(instituicaoId: string) {
    const config = await this.get(instituicaoId);
    return {
      contaCaixa: config.contaCaixaCodigo,
      contaBanco: config.contaBancoCodigo,
      contaReceitaMensalidades: config.contaReceitaMensalidadesCodigo,
      contaReceitaTaxas: config.contaReceitaTaxasCodigo,
      contaPessoal: config.contaPessoalCodigo,
      contaFornecedores: config.contaFornecedoresCodigo,
    };
  }
}
