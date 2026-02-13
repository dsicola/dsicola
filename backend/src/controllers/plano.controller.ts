import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService } from '../services/audit.service.js';
import Decimal from 'decimal.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ativo } = req.query;
    
    const planos = await prisma.plano.findMany({
      where: {
        ...(ativo !== undefined && { ativo: ativo === 'true' }),
      },
      orderBy: { nome: 'asc' },
    });
    
    // Formatar resposta para compatibilidade com frontend (snake_case)
    const planosFormatados = planos.map(plano => ({
      id: plano.id,
      nome: plano.nome,
      descricao: plano.descricao,
      valor_mensal: plano.valorMensal.toNumber(),
      valor_anual: plano.valorAnual?.toNumber() || null,
      preco_secundario: plano.precoSecundario?.toNumber() || plano.valorMensal.toNumber(),
      preco_universitario: plano.precoUniversitario?.toNumber() || plano.valorMensal.toNumber(),
      limite_alunos: plano.limiteAlunos,
      limite_professores: plano.limiteProfessores,
      limite_cursos: plano.limiteCursos,
      funcionalidades: plano.funcionalidades,
      ativo: plano.ativo,
      created_at: plano.createdAt,
      updated_at: plano.updatedAt,
    }));
    
    res.json(planosFormatados);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const plano = await prisma.plano.findUnique({ where: { id } });
    
    if (!plano) {
      throw new AppError('Plano não encontrado', 404);
    }

    // Formatar resposta para compatibilidade com frontend (snake_case)
    const planoFormatado = {
      id: plano.id,
      nome: plano.nome,
      descricao: plano.descricao,
      valor_mensal: plano.valorMensal.toNumber(),
      valor_anual: plano.valorAnual?.toNumber() || null,
      preco_secundario: plano.precoSecundario?.toNumber() || plano.valorMensal.toNumber(),
      preco_universitario: plano.precoUniversitario?.toNumber() || plano.valorMensal.toNumber(),
      limite_alunos: plano.limiteAlunos,
      limite_professores: plano.limiteProfessores,
      limite_cursos: plano.limiteCursos,
      funcionalidades: plano.funcionalidades,
      ativo: plano.ativo,
      created_at: plano.createdAt,
      updated_at: plano.updatedAt,
    };
    
    res.json(planoFormatado);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validar que é SUPER_ADMIN (já validado no middleware, mas garantindo aqui também)
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Apenas SUPER_ADMIN pode criar planos', 403);
    }

    const {
      nome,
      descricao,
      valorMensal,
      precoMensal, // Compatibilidade com frontend
      valorAnual,
      precoSecundario,
      precoUniversitario,
      limiteAlunos,
      limiteProfessores,
      limiteCursos,
      funcionalidades,
      ativo = true,
    } = req.body;

    // Validar campos obrigatórios
    if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
      throw new AppError('Nome do plano é obrigatório', 400);
    }

    // Validar valores monetários
    const valorMensalFinal = valorMensal || precoMensal || precoSecundario;
    
    if (valorMensalFinal === undefined || valorMensalFinal === null || valorMensalFinal === '') {
      throw new AppError('Valor mensal (precoSecundario) é obrigatório', 400);
    }

    const valorMensalNum = typeof valorMensalFinal === 'string' ? parseFloat(valorMensalFinal) : valorMensalFinal;
    
    if (isNaN(valorMensalNum) || valorMensalNum <= 0) {
      throw new AppError('Valor mensal deve ser um número maior que zero', 400);
    }

    // Validar precoUniversitario se fornecido
    if (precoUniversitario !== undefined && precoUniversitario !== null && precoUniversitario !== '') {
      const precoUnivNum = typeof precoUniversitario === 'string' ? parseFloat(precoUniversitario) : precoUniversitario;
      if (isNaN(precoUnivNum) || precoUnivNum <= 0) {
        throw new AppError('Preço universitário deve ser um número maior que zero', 400);
      }
    }

    // Normalizar funcionalidades (garantir que é array válido ou null)
    let funcionalidadesNormalizadas: any = null;
    if (funcionalidades !== undefined && funcionalidades !== null) {
      if (Array.isArray(funcionalidades)) {
        funcionalidadesNormalizadas = funcionalidades;
      } else if (typeof funcionalidades === 'string') {
        try {
          funcionalidadesNormalizadas = JSON.parse(funcionalidades);
        } catch {
          funcionalidadesNormalizadas = null;
        }
      }
    }

    // Calcular valores finais
    const precoSecundarioNum = precoSecundario 
      ? (typeof precoSecundario === 'string' ? parseFloat(precoSecundario) : precoSecundario)
      : valorMensalNum;
    
    const precoUniversitarioNum = precoUniversitario && precoUniversitario !== ''
      ? (typeof precoUniversitario === 'string' ? parseFloat(precoUniversitario) : precoUniversitario)
      : valorMensalNum;

    // Normalizar dados - Prisma aceita números diretamente para campos Decimal
    const planoData: any = {
      nome: nome.trim(),
      descricao: descricao ? descricao.trim() : null,
      valorMensal: valorMensalNum, // Prisma converte automaticamente
      valorAnual: valorAnual && valorAnual !== '' 
        ? (typeof valorAnual === 'string' ? parseFloat(valorAnual) : valorAnual)
        : null,
      precoSecundario: precoSecundarioNum, // Prisma converte automaticamente
      precoUniversitario: precoUniversitarioNum, // Prisma converte automaticamente
      limiteAlunos: limiteAlunos !== undefined && limiteAlunos !== null && limiteAlunos !== '' 
        ? parseInt(String(limiteAlunos)) 
        : null,
      limiteProfessores: limiteProfessores !== undefined && limiteProfessores !== null && limiteProfessores !== '' 
        ? parseInt(String(limiteProfessores)) 
        : null,
      limiteCursos: limiteCursos !== undefined && limiteCursos !== null && limiteCursos !== '' 
        ? parseInt(String(limiteCursos)) 
        : null,
      funcionalidades: funcionalidadesNormalizadas,
      ativo: ativo !== undefined ? Boolean(ativo) : true,
    };

    // Validar tipos antes de criar
    if (planoData.limiteAlunos !== null && isNaN(planoData.limiteAlunos)) {
      throw new AppError('Limite de alunos deve ser um número válido', 400);
    }
    if (planoData.limiteProfessores !== null && isNaN(planoData.limiteProfessores)) {
      throw new AppError('Limite de professores deve ser um número válido', 400);
    }
    if (planoData.limiteCursos !== null && isNaN(planoData.limiteCursos)) {
      throw new AppError('Limite de cursos deve ser um número válido', 400);
    }

    try {
      const plano = await prisma.plano.create({ data: planoData });

      // Auditoria: Log CREATE_PLAN
      await AuditService.log(req, {
        modulo: 'LICENCIAMENTO',
        acao: 'CREATE_PLAN' as any,
        entidade: 'PLANO',
        entidadeId: plano.id,
        observacao: `Plano criado: ${plano.nome} - Valor Mensal: ${plano.valorMensal.toNumber()}`,
      }).catch((error) => {
        console.error('[create] Erro ao gerar audit log:', error);
      });

      res.status(201).json(plano);
    } catch (dbError: any) {
      // Log detalhado do erro do Prisma
      console.error('[PlanoController.create] Erro ao criar plano:', {
        error: dbError,
        data: planoData,
        message: dbError?.message,
        code: dbError?.code,
      });
      
      // Se for erro de validação do Prisma, dar mensagem mais específica
      if (dbError?.code === 'P2003' || dbError?.code === 'P2014') {
        throw new AppError('Erro ao criar plano. Verifique se todos os campos estão preenchidos corretamente.', 400);
      }
      
      // Re-throw para o errorHandler processar
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validar que é SUPER_ADMIN
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Apenas SUPER_ADMIN pode atualizar planos', 403);
    }

    const { id } = req.params;
    
    // Buscar plano atual para auditoria
    const planoAnterior = await prisma.plano.findUnique({
      where: { id },
    });

    if (!planoAnterior) {
      throw new AppError('Plano não encontrado', 404);
    }

    const {
      nome,
      descricao,
      valorMensal,
      precoMensal, // Compatibilidade
      valorAnual,
      precoSecundario,
      precoUniversitario,
      limiteAlunos,
      limiteProfessores,
      limiteCursos,
      funcionalidades,
      ativo,
    } = req.body;

    // Preparar dados de atualização
    const updateData: any = {};
    
    if (nome !== undefined) updateData.nome = nome;
    if (descricao !== undefined) updateData.descricao = descricao || null;
    if (valorMensal !== undefined || precoMensal !== undefined) {
      const novoValor = typeof (valorMensal || precoMensal) === 'string' 
        ? parseFloat(valorMensal || precoMensal || '0')
        : (valorMensal || precoMensal || 0);
      if (isNaN(novoValor) || novoValor <= 0) {
        throw new AppError('Valor mensal deve ser maior que zero', 400);
      }
      updateData.valorMensal = novoValor;
    }
    if (valorAnual !== undefined) {
      updateData.valorAnual = valorAnual 
        ? (typeof valorAnual === 'string' ? parseFloat(valorAnual) : valorAnual)
        : null;
    }
    if (precoSecundario !== undefined) {
      updateData.precoSecundario = precoSecundario 
        ? (typeof precoSecundario === 'string' ? parseFloat(precoSecundario) : precoSecundario)
        : null;
    }
    if (precoUniversitario !== undefined) {
      updateData.precoUniversitario = precoUniversitario 
        ? (typeof precoUniversitario === 'string' ? parseFloat(precoUniversitario) : precoUniversitario)
        : null;
    }
    if (limiteAlunos !== undefined) updateData.limiteAlunos = limiteAlunos || null;
    if (limiteProfessores !== undefined) updateData.limiteProfessores = limiteProfessores || null;
    if (limiteCursos !== undefined) updateData.limiteCursos = limiteCursos || null;
    if (funcionalidades !== undefined) updateData.funcionalidades = funcionalidades || null;
    if (ativo !== undefined) updateData.ativo = ativo;

    const planoAtualizado = await prisma.plano.update({
      where: { id },
      data: updateData,
    });

    // Auditoria: Log UPDATE_PRICE se preço foi alterado
    const precoAlterado = 
      (updateData.valorMensal && !planoAnterior.valorMensal.equals(updateData.valorMensal)) ||
      (updateData.valorAnual && (!planoAnterior.valorAnual || !planoAnterior.valorAnual.equals(updateData.valorAnual))) ||
      (updateData.precoSecundario && (!planoAnterior.precoSecundario || !planoAnterior.precoSecundario.equals(updateData.precoSecundario))) ||
      (updateData.precoUniversitario && (!planoAnterior.precoUniversitario || !planoAnterior.precoUniversitario.equals(updateData.precoUniversitario)));

    if (precoAlterado) {
      await AuditService.log(req, {
        modulo: 'LICENCIAMENTO',
        acao: 'UPDATE_PRICE' as any,
        entidade: 'PLANO',
        entidadeId: planoAtualizado.id,
        observacao: `Preço atualizado para plano ${planoAtualizado.nome}. ` +
          `Valor Mensal: ${planoAnterior.valorMensal.toNumber()} → ${planoAtualizado.valorMensal.toNumber()}` +
          (planoAnterior.valorAnual && planoAtualizado.valorAnual 
            ? `. Valor Anual: ${planoAnterior.valorAnual.toNumber()} → ${planoAtualizado.valorAnual.toNumber()}` 
            : ''),
      }).catch((error) => {
        console.error('[update] Erro ao gerar audit log:', error);
      });
    } else {
      // Log de atualização geral
      await AuditService.log(req, {
        modulo: 'LICENCIAMENTO',
        acao: 'UPDATE_PLAN' as any,
        entidade: 'PLANO',
        entidadeId: planoAtualizado.id,
        observacao: `Plano ${planoAtualizado.nome} atualizado`,
      }).catch((error) => {
        console.error('[update] Erro ao gerar audit log:', error);
      });
    }
    
    res.json(planoAtualizado);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.plano.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
