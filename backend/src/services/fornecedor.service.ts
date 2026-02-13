import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface CreateFornecedorData {
  razaoSocial: string;
  nif?: string;
  tipoServico: 'SEGURANCA' | 'LIMPEZA' | 'TI' | 'CANTINA' | 'MANUTENCAO' | 'OUTRO';
  contato?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  pais?: string;
  provincia?: string;
  municipio?: string;
  observacoes?: string;
}

export interface UpdateFornecedorData extends Partial<CreateFornecedorData> {
  status?: 'ATIVO' | 'INATIVO' | 'SUSPENSO';
}

export class FornecedorService {
  /**
   * Criar novo fornecedor
   */
  static async create(
    instituicaoId: string,
    data: CreateFornecedorData,
    userId?: string
  ) {
    // Validar que não é pessoa física (não pode ter campos de funcionário)
    if (!data.razaoSocial || data.razaoSocial.trim().length === 0) {
      throw new AppError('Razão social é obrigatória para fornecedores (pessoa jurídica)', 400);
    }

    // VALIDAÇÃO CRÍTICA: Verificar se não é funcionário cadastrado
    // Fornecedor = Pessoa Jurídica, Funcionário = Pessoa Física
    // NUNCA permitir que fornecedor seja cadastrado como funcionário
    const funcionarioExistente = await prisma.funcionario.findFirst({
      where: {
        instituicaoId,
        OR: [
          { numeroIdentificacao: data.nif || '' },
          { email: data.email || '' },
        ],
      },
    });

    if (funcionarioExistente) {
      throw new AppError(
        'Não é permitido cadastrar fornecedor que já é funcionário. Fornecedor = Pessoa Jurídica, Funcionário = Pessoa Física.',
        400
      );
    }

    // Criar fornecedor
    const fornecedor = await prisma.fornecedor.create({
      data: {
        instituicaoId,
        razaoSocial: data.razaoSocial.trim(),
        nif: data.nif?.trim() || null,
        tipoServico: data.tipoServico,
        contato: data.contato?.trim() || null,
        email: data.email?.trim() || null,
        telefone: data.telefone?.trim() || null,
        endereco: data.endereco?.trim() || null,
        cidade: data.cidade?.trim() || null,
        pais: data.pais?.trim() || 'Angola',
        provincia: data.provincia?.trim() || null,
        municipio: data.municipio?.trim() || null,
        status: 'ATIVO',
        observacoes: data.observacoes?.trim() || null,
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Auditoria
    try {
      await AuditService.log(null, {
        modulo: 'FORNECEDORES',
        acao: 'CREATE',
        entidade: 'FORNECEDOR',
        entidadeId: fornecedor.id,
        instituicaoId,
        dadosNovos: {
          razao_social: fornecedor.razaoSocial,
          tipo_servico: fornecedor.tipoServico,
          nif: fornecedor.nif ? fornecedor.nif.substring(0, 4) + '...' : null,
        },
        observacao: `Fornecedor criado: ${fornecedor.razaoSocial}`,
      });
    } catch (auditError) {
      console.warn('[FornecedorService] Erro ao registrar auditoria:', auditError);
    }

    return fornecedor;
  }

  /**
   * Atualizar fornecedor
   */
  static async update(
    id: string,
    instituicaoId: string,
    data: UpdateFornecedorData,
    userId?: string
  ) {
    // Verificar se fornecedor existe e pertence à instituição
    const fornecedorExistente = await prisma.fornecedor.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!fornecedorExistente) {
      throw new AppError('Fornecedor não encontrado ou acesso negado', 404);
    }

    // Preparar dados para atualização
    const updateData: any = {};
    if (data.razaoSocial !== undefined) {
      if (!data.razaoSocial || data.razaoSocial.trim().length === 0) {
        throw new AppError('Razão social é obrigatória', 400);
      }
      updateData.razaoSocial = data.razaoSocial.trim();
    }
    if (data.nif !== undefined) updateData.nif = data.nif?.trim() || null;
    if (data.tipoServico !== undefined) updateData.tipoServico = data.tipoServico;
    if (data.contato !== undefined) updateData.contato = data.contato?.trim() || null;
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;
    if (data.telefone !== undefined) updateData.telefone = data.telefone?.trim() || null;
    if (data.endereco !== undefined) updateData.endereco = data.endereco?.trim() || null;
    if (data.cidade !== undefined) updateData.cidade = data.cidade?.trim() || null;
    if (data.pais !== undefined) updateData.pais = data.pais?.trim() || null;
    if (data.provincia !== undefined) updateData.provincia = data.provincia?.trim() || null;
    if (data.municipio !== undefined) updateData.municipio = data.municipio?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.observacoes !== undefined) updateData.observacoes = data.observacoes?.trim() || null;

    // Atualizar
    const fornecedor = await prisma.fornecedor.update({
      where: { id },
      data: updateData,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Auditoria
    try {
      await AuditService.log(null, {
        modulo: 'FORNECEDORES',
        acao: 'UPDATE',
        entidade: 'FORNECEDOR',
        entidadeId: fornecedor.id,
        instituicaoId,
        dadosAnteriores: {
          razao_social: fornecedorExistente.razaoSocial,
          status: fornecedorExistente.status,
        },
        dadosNovos: {
          razao_social: fornecedor.razaoSocial,
          status: fornecedor.status,
        },
        observacao: `Fornecedor atualizado: ${fornecedor.razaoSocial}`,
      });
    } catch (auditError) {
      console.warn('[FornecedorService] Erro ao registrar auditoria:', auditError);
    }

    return fornecedor;
  }

  /**
   * Listar fornecedores
   */
  static async list(instituicaoId: string, filters?: {
    status?: 'ATIVO' | 'INATIVO' | 'SUSPENSO';
    tipoServico?: string;
    search?: string;
  }) {
    const where: any = {
      instituicaoId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.tipoServico) {
      where.tipoServico = filters.tipoServico;
    }

    if (filters?.search) {
      where.OR = [
        { razaoSocial: { contains: filters.search, mode: 'insensitive' } },
        { contato: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { nif: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const fornecedores = await prisma.fornecedor.findMany({
      where,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return fornecedores;
  }

  /**
   * Obter fornecedor por ID
   */
  static async getById(id: string, instituicaoId: string) {
    const fornecedor = await prisma.fornecedor.findFirst({
      where: {
        id,
        instituicaoId,
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!fornecedor) {
      throw new AppError('Fornecedor não encontrado ou acesso negado', 404);
    }

    return fornecedor;
  }

  /**
   * Deletar fornecedor (soft delete - mudar status para INATIVO)
   */
  static async delete(id: string, instituicaoId: string, userId?: string) {
    const fornecedor = await prisma.fornecedor.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!fornecedor) {
      throw new AppError('Fornecedor não encontrado ou acesso negado', 404);
    }

    // Soft delete - mudar status para INATIVO
    const fornecedorAtualizado = await prisma.fornecedor.update({
      where: { id },
      data: { status: 'INATIVO' },
    });

    // Auditoria
    try {
      await AuditService.log(null, {
        modulo: 'FORNECEDORES',
        acao: 'DELETE',
        entidade: 'FORNECEDOR',
        entidadeId: fornecedor.id,
        instituicaoId,
        dadosAnteriores: {
          razao_social: fornecedor.razaoSocial,
          status: fornecedor.status,
        },
        dadosNovos: {
          status: 'INATIVO',
        },
        observacao: `Fornecedor desativado: ${fornecedor.razaoSocial}`,
      });
    } catch (auditError) {
      console.warn('[FornecedorService] Erro ao registrar auditoria:', auditError);
    }

    return fornecedorAtualizado;
  }
}

