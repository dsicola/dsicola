import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromAuth } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';

/**
 * GET /rh/estrutura-organizacional
 * Retorna estrutura hierárquica completa: Departamento → Cargos → Funcionários
 */
export const getEstruturaOrganizacional = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Log inicial para debug
    if (process.env.NODE_ENV !== 'production') {
      console.log('[EstruturaOrganizacional] Iniciando busca...');
      console.log('[EstruturaOrganizacional] User:', req.user?.userId, req.user?.email);
    }

    // Validar que usuário tem instituição (exceto SUPER_ADMIN)
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    const userRoles = req.user.roles || [];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

    // SUPER_ADMIN pode não ter instituicaoId, mas para estrutura organizacional precisa
    if (!isSuperAdmin && !req.user.instituicaoId) {
      throw new AppError('Usuário sem instituição associada. Entre em contato com o administrador.', 403);
    }

    // Obter instituicaoId de forma mais segura
    let instituicaoId: string | null = null;
    
    // Tentar obter de diferentes fontes
    instituicaoId = getInstituicaoIdFromAuth(req);
    
    if (!instituicaoId && req.user?.instituicaoId) {
      instituicaoId = req.user.instituicaoId;
    }
    
    if (!instituicaoId) {
      const filter = addInstitutionFilter(req);
      instituicaoId = filter.instituicaoId as string || null;
    }

    if (!instituicaoId && !isSuperAdmin) {
      throw new AppError('Instituição não identificada', 400);
    }

    // Se for SUPER_ADMIN sem instituicaoId, retornar erro (estrutura organizacional requer instituição)
    if (isSuperAdmin && !instituicaoId) {
      throw new AppError('SUPER_ADMIN deve especificar uma instituição para visualizar estrutura organizacional', 400);
    }

    // Criar filter com instituicaoId garantido
    const filter = addInstitutionFilter(req);
    
    // Garantir que filter.instituicaoId está definido
    if (!filter.instituicaoId && instituicaoId) {
      filter.instituicaoId = instituicaoId;
    }

    // Buscar todos os departamentos da instituição
    const departamentos = await prisma.departamento.findMany({
      where: {
        ...filter,
        ativo: true, // Apenas departamentos ativos
      },
      orderBy: { nome: 'asc' },
    });

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[EstruturaOrganizacional] Departamentos encontrados:', departamentos.length);
      console.log('[EstruturaOrganizacional] InstituicaoId:', instituicaoId);
      console.log('[EstruturaOrganizacional] Filter:', filter);
    }

    // Buscar TODOS os cargos ativos da instituição (para mostrar mesmo sem funcionários)
    const todosCargosAtivos = await prisma.cargo.findMany({
      where: {
        ...filter,
        ativo: true,
      },
      orderBy: { nome: 'asc' },
    });

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[EstruturaOrganizacional] Cargos ativos encontrados:', todosCargosAtivos.length);
      console.log('[EstruturaOrganizacional] Cargos:', todosCargosAtivos.map(c => ({ id: c.id, nome: c.nome, ativo: c.ativo })));
    }

    // Para cada departamento, buscar cargos e funcionários
    const estrutura = await Promise.all(
      departamentos.map(async (departamento) => {
        // Buscar funcionários do departamento
        // Buscar todos e filtrar por status depois (para garantir compatibilidade)
        const funcionariosDoDepartamentoRaw = await prisma.funcionario.findMany({
          where: {
            departamentoId: departamento.id,
            instituicaoId,
          },
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            telefone: true,
            status: true,
            dataAdmissao: true,
            fotoUrl: true,
            cargoId: true,
            departamentoId: true,
            cargo: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                tipo: true,
                salarioBase: true,
                ativo: true,
              },
            },
          },
          orderBy: { nomeCompleto: 'asc' },
        });

        // Filtrar apenas funcionários ativos (aceitar diferentes formatos)
        // IMPORTANTE: Aceitar 'ATIVO', 'Ativo', 'ativo' ou qualquer variação
        const funcionariosDoDepartamento = funcionariosDoDepartamentoRaw.filter((f) => {
          if (!f.status) return false;
          const statusUpper = String(f.status).trim().toUpperCase();
          return statusUpper === 'ATIVO';
        });

        // Agrupar funcionários por cargo
        const funcionariosPorCargo = new Map<string, typeof funcionariosDoDepartamento>();

        funcionariosDoDepartamento.forEach((funcionario) => {
          if (funcionario.cargoId && funcionario.cargo) {
            const cargoId = funcionario.cargoId;
            if (!funcionariosPorCargo.has(cargoId)) {
              funcionariosPorCargo.set(cargoId, []);
            }
            funcionariosPorCargo.get(cargoId)!.push(funcionario);
          }
        });

        // Buscar cargos que têm funcionários neste departamento
        const cargoIdsComFuncionarios = Array.from(funcionariosPorCargo.keys());
        
        // CORREÇÃO: Mostrar APENAS os cargos que têm funcionários neste departamento
        // Não incluir todos os cargos da instituição, apenas os que pertencem a este departamento
        const cargosDoDepartamento = todosCargosAtivos
          .filter((cargo) => cargoIdsComFuncionarios.includes(cargo.id)) // Apenas cargos com funcionários neste departamento
          .sort((a, b) => a.nome.localeCompare(b.nome)); // Ordenar por nome

        // Formatar cargos com funcionários
        const cargosFormatados = cargosDoDepartamento.map((cargo) => {
          const funcionarios = funcionariosPorCargo.get(cargo.id) || [];
          
          return {
            id: cargo.id,
            nome: cargo.nome,
            descricao: cargo.descricao,
            tipo: cargo.tipo,
            salario_base: cargo.salarioBase,
            quantidade_funcionarios: funcionarios.length,
            funcionarios: funcionarios.map((func) => ({
              id: func.id,
              nome_completo: func.nomeCompleto,
              email: func.email,
              telefone: func.telefone,
              status: func.status,
              data_admissao: func.dataAdmissao,
              foto_url: func.fotoUrl,
            })),
          };
        });

        // Identificar funcionários sem cargo (inconsistência)
        const funcionariosSemCargo = funcionariosDoDepartamento.filter(
          (f) => !f.cargoId || !f.cargo
        );

        return {
          id: departamento.id,
          nome: departamento.nome,
          descricao: departamento.descricao,
          total_cargos: cargosFormatados.length, // Apenas cargos com funcionários neste departamento
          total_funcionarios: funcionariosDoDepartamento.length, // Total de funcionários ativos no departamento
          cargos: cargosFormatados,
          funcionarios_sem_cargo: funcionariosSemCargo.length > 0 ? funcionariosSemCargo.map((f) => ({
            id: f.id,
            nome_completo: f.nomeCompleto,
            email: f.email,
            status: f.status,
            aviso: 'Funcionário sem cargo vinculado',
          })) : [],
        };
      })
    );

    // Identificar cargos sem departamento (inconsistência)
    // Buscar cargos que têm funcionários mas nenhum está vinculado a departamento
    const cargosComFuncionarios = await prisma.cargo.findMany({
      where: {
        ...filter,
        ativo: true,
      },
      include: {
        funcionarios: {
          where: {
            instituicaoId,
            // Não filtrar por status aqui, vamos filtrar depois
          },
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            status: true,
            departamentoId: true,
            cargoId: true,
            instituicaoId: true,
          },
        },
      },
    });

    const cargosSemDepartamento = cargosComFuncionarios
      .filter((cargo) => {
        // Filtrar apenas funcionários ativos primeiro
        const funcionariosAtivos = cargo.funcionarios.filter((f) => {
          if (!f.status) return false;
          const statusUpper = String(f.status).trim().toUpperCase();
          return statusUpper === 'ATIVO';
        });
        // Verificar se algum funcionário ativo deste cargo tem departamento
        const funcionariosComDepartamento = funcionariosAtivos.filter((f) => f.departamentoId);
        return funcionariosComDepartamento.length === 0 && funcionariosAtivos.length > 0;
      })
      .map((cargo) => {
        // Contar apenas funcionários ativos
        const funcionariosAtivos = cargo.funcionarios.filter((f) => {
          if (!f.status) return false;
          const statusUpper = String(f.status).trim().toUpperCase();
          return statusUpper === 'ATIVO';
        });
        return {
          id: cargo.id,
          nome: cargo.nome,
          quantidade_funcionarios: funcionariosAtivos.length,
          aviso: 'Cargo sem departamento vinculado',
        };
      });

    // Identificar cargos sem funcionários (para mostrar na estrutura)
    const cargosSemFuncionarios = todosCargosAtivos
      .filter((cargo) => {
        // Verificar se o cargo tem funcionários ativos
        const cargoComFuncionarios = cargosComFuncionarios.find(c => c.id === cargo.id);
        if (!cargoComFuncionarios) return true;
        // Filtrar apenas funcionários ativos
        const funcionariosAtivos = cargoComFuncionarios.funcionarios.filter((f) => {
          if (!f.status) return false;
          const statusUpper = String(f.status).trim().toUpperCase();
          return statusUpper === 'ATIVO';
        });
        return funcionariosAtivos.length === 0;
      })
      .map((cargo) => ({
        id: cargo.id,
        nome: cargo.nome,
        descricao: cargo.descricao,
        tipo: cargo.tipo,
        salario_base: cargo.salarioBase,
        quantidade_funcionarios: 0,
        funcionarios: [],
        aviso: 'Cargo sem funcionários vinculados',
      }));

    // Buscar TODOS os funcionários ativos da instituição (para debug e inconsistências)
    // IMPORTANTE: Buscar TODOS os funcionários primeiro, depois filtrar por status
    // Isso garante que funcionários com status em diferentes formatos sejam encontrados
    const todosFuncionarios = await prisma.funcionario.findMany({
      where: {
        ...filter,
      },
      include: {
        cargo: {
          select: {
            id: true,
            nome: true,
            ativo: true,
          },
        },
        departamento: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: { nomeCompleto: 'asc' },
    });

    // Filtrar funcionários ativos (aceitar diferentes formatos de status)
    // IMPORTANTE: Aceitar 'ATIVO', 'Ativo', 'ativo' ou qualquer variação
    const todosFuncionariosAtivos = todosFuncionarios.filter((f) => {
      if (!f.status) return false;
      const statusUpper = String(f.status).trim().toUpperCase();
      // Aceitar ATIVO em qualquer formato
      return statusUpper === 'ATIVO';
    });

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[EstruturaOrganizacional] Total de funcionários encontrados:', todosFuncionarios.length);
      console.log('[EstruturaOrganizacional] Funcionários ativos encontrados:', todosFuncionariosAtivos.length);
      console.log('[EstruturaOrganizacional] InstituicaoId usado:', instituicaoId);
      console.log('[EstruturaOrganizacional] Filter usado:', filter);
      console.log('[EstruturaOrganizacional] Status dos funcionários:', todosFuncionarios.map(f => ({ 
        id: f.id, 
        nome: f.nomeCompleto, 
        status: f.status,
        statusRaw: f.status,
        statusType: typeof f.status,
        statusUpper: String(f.status).toUpperCase(),
        isAtivo: String(f.status).toUpperCase() === 'ATIVO',
        cargoId: f.cargoId, 
        departamentoId: f.departamentoId,
        cargo_nome: f.cargo?.nome,
        cargo_ativo: f.cargo?.ativo,
        departamento_nome: f.departamento?.nome,
        instituicaoId: f.instituicaoId,
      })));
      console.log('[EstruturaOrganizacional] Funcionários ativos detalhados:', todosFuncionariosAtivos.map(f => ({ 
        id: f.id, 
        nome: f.nomeCompleto, 
        cargoId: f.cargoId, 
        departamentoId: f.departamentoId,
        cargo_nome: f.cargo?.nome,
        departamento_nome: f.departamento?.nome,
      })));
    }

    // Identificar funcionários sem cargo (inconsistência global)
    const funcionariosSemCargoAtivo = todosFuncionariosAtivos.filter(
      (f) => !f.cargoId || !f.cargo || !f.cargo.ativo
    );

    // Identificar funcionários sem departamento (para mostrar na estrutura)
    const funcionariosSemDepartamento = todosFuncionariosAtivos.filter(
      (f) => !f.departamentoId
    );

    // Criar seção especial para funcionários sem departamento
    // SEMPRE criar esta seção se houver funcionários sem departamento
    let estruturaFinal = [...estrutura];
    
    // Agrupar funcionários sem departamento por cargo
    const funcionariosPorCargoSemDept = new Map<string, (typeof todosFuncionariosAtivos[number])[]>();
    
    funcionariosSemDepartamento.forEach((funcionario) => {
      if (funcionario.cargoId && funcionario.cargo && funcionario.cargo.ativo) {
        const cargoId = funcionario.cargoId;
        if (!funcionariosPorCargoSemDept.has(cargoId)) {
          funcionariosPorCargoSemDept.set(cargoId, []);
        }
        const funcionariosDoCargo = funcionariosPorCargoSemDept.get(cargoId);
        if (funcionariosDoCargo) {
          funcionariosDoCargo.push(funcionario);
        }
      }
    });

    // Identificar quais cargos já aparecem em departamentos (para evitar duplicação)
    const cargosEmDepartamentos = new Set<string>();
    estrutura.forEach(dept => {
      dept.cargos.forEach(cargo => {
        if (cargo.quantidade_funcionarios > 0) {
          cargosEmDepartamentos.add(cargo.id);
        }
      });
    });

    // Se há funcionários sem departamento, criar seção especial
    if (funcionariosSemDepartamento.length > 0) {
      // Incluir TODOS os cargos ativos nesta seção
      // Mas mostrar quantidade de funcionários apenas para os que têm funcionários sem departamento
      const todosCargosFormatados = todosCargosAtivos.map((cargo) => {
        const funcionarios = funcionariosPorCargoSemDept.get(cargo.id) || [];
        return {
          id: cargo.id,
          nome: cargo.nome,
          descricao: cargo.descricao,
          tipo: cargo.tipo,
          salario_base: cargo.salarioBase,
          quantidade_funcionarios: funcionarios.length,
          funcionarios: funcionarios.map((func) => ({
            id: func.id,
            nome_completo: func.nomeCompleto,
            email: func.email,
            telefone: func.telefone,
            status: func.status,
            data_admissao: func.dataAdmissao,
            foto_url: func.fotoUrl,
          })),
        };
      });

      estruturaFinal.push({
        id: 'sem-departamento',
        nome: estrutura.length > 0 ? 'Funcionários sem Departamento' : 'Estrutura Organizacional',
        descricao: estrutura.length > 0 
          ? 'Funcionários que não estão vinculados a nenhum departamento'
          : 'Cargos e funcionários da instituição',
        total_cargos: todosCargosFormatados.length,
        total_funcionarios: funcionariosSemDepartamento.length,
        cargos: todosCargosFormatados,
        funcionarios_sem_cargo: funcionariosSemDepartamento
          .filter(f => !f.cargoId || !f.cargo || !f.cargo.ativo)
          .map((f) => ({
            id: f.id,
            nome_completo: f.nomeCompleto,
            email: f.email,
            status: f.status,
            aviso: 'Funcionário sem cargo vinculado',
          })),
      });
    }
    
    // Se não há departamentos e não há funcionários sem departamento, criar estrutura básica apenas com cargos
    if (estrutura.length === 0 && funcionariosSemDepartamento.length === 0 && todosCargosAtivos.length > 0) {
      estruturaFinal = [{
        id: 'sem-departamento',
        nome: 'Estrutura Organizacional',
        descricao: 'Cargos da instituição',
        total_cargos: todosCargosAtivos.length,
        total_funcionarios: 0,
        cargos: todosCargosAtivos.map((cargo) => ({
          id: cargo.id,
          nome: cargo.nome,
          descricao: cargo.descricao,
          tipo: cargo.tipo,
          salario_base: cargo.salarioBase,
          quantidade_funcionarios: 0,
          funcionarios: [],
        })),
        funcionarios_sem_cargo: [],
      }];
    }
    
    // Se há cargos sem funcionários (e não foram incluídos acima), adicionar como seção especial
    // Filtrar apenas cargos que não têm funcionários em nenhum lugar
    const cargosSemFuncionariosFiltrados = cargosSemFuncionarios.filter(cargo => {
      // Verificar se o cargo não está em nenhum departamento e não tem funcionários sem departamento
      const temFuncionariosSemDept = funcionariosPorCargoSemDept.has(cargo.id);
      const estaEmAlgumDepartamento = cargosEmDepartamentos.has(cargo.id);
      return !temFuncionariosSemDept && !estaEmAlgumDepartamento;
    });
    
    if (cargosSemFuncionariosFiltrados.length > 0) {
      estruturaFinal.push({
        id: 'cargos-sem-funcionarios',
        nome: 'Cargos Disponíveis',
        descricao: 'Cargos ativos sem funcionários vinculados',
        total_cargos: cargosSemFuncionariosFiltrados.length,
        total_funcionarios: 0,
        cargos: cargosSemFuncionariosFiltrados,
        funcionarios_sem_cargo: [],
      });
    }

    const response = {
      estrutura: estruturaFinal,
      inconsistencias: {
        cargos_sem_departamento: cargosSemDepartamento,
        cargos_sem_funcionarios: cargosSemFuncionarios.map((c) => ({
          id: c.id,
          nome: c.nome,
          aviso: 'Cargo sem funcionários vinculados',
        })),
        funcionarios_sem_cargo: funcionariosSemCargoAtivo.map((f) => ({
          id: f.id,
          nome_completo: f.nomeCompleto,
          email: f.email,
          departamento: f.departamento ? {
            id: f.departamento.id,
            nome: f.departamento.nome,
          } : null,
          aviso: 'Funcionário sem cargo vinculado',
        })),
      },
      estatisticas: {
        total_departamentos: estruturaFinal.filter(dept => dept.id !== 'cargos-sem-funcionarios' && dept.id !== 'sem-departamento').length, // Apenas departamentos reais (excluir seções especiais)
        total_cargos: todosCargosAtivos.length, // Total de cargos ativos da instituição
        total_cargos_com_funcionarios: estruturaFinal.reduce((acc, dept) => {
          // Contar apenas cargos que têm pelo menos um funcionário
          const cargosComFuncionarios = dept.cargos.filter(c => c.quantidade_funcionarios > 0).length;
          return acc + cargosComFuncionarios;
        }, 0),
        total_funcionarios: todosFuncionariosAtivos.length, // Total de TODOS os funcionários ativos da instituição
        // Contar apenas inconsistências reais:
        // - Cargos com funcionários mas sem departamento
        // - Funcionários sem cargo
        // NOTA: Cargos sem funcionários NÃO são inconsistências (é normal ter cargos disponíveis)
        total_inconsistencias: cargosSemDepartamento.length + funcionariosSemCargoAtivo.length,
      },
    };

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[EstruturaOrganizacional] Resposta:', {
        total_departamentos: response.estatisticas.total_departamentos,
        total_cargos: response.estatisticas.total_cargos,
        total_cargos_com_funcionarios: response.estatisticas.total_cargos_com_funcionarios,
        total_funcionarios: response.estatisticas.total_funcionarios,
        total_inconsistencias: response.estatisticas.total_inconsistencias,
        estrutura_length: response.estrutura.length,
        cargos_sem_funcionarios: cargosSemFuncionarios.length,
        funcionarios_sem_cargo: funcionariosSemCargoAtivo.length,
        funcionarios_sem_departamento: funcionariosSemDepartamento.length,
      });
    }

    res.json(response);
  } catch (error: any) {
    // Log detalhado do erro para debug
    console.error('[EstruturaOrganizacional] ❌ Erro ao buscar estrutura:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      user: req.user?.userId,
      email: req.user?.email,
      roles: req.user?.roles,
      instituicaoId: req.user?.instituicaoId,
    });
    
    // Se for erro do Prisma, logar detalhes adicionais
    if (error?.code) {
      console.error('[EstruturaOrganizacional] Erro Prisma:', {
        code: error.code,
        meta: error.meta,
        clientVersion: error.clientVersion,
      });
    }
    
    // Se for AppError, passar direto
    if (error instanceof AppError) {
      return next(error);
    }
    
    // Para outros erros, criar AppError genérico com mensagem mais informativa
    const errorMessage = error?.message || 'Erro ao buscar estrutura organizacional';
    console.error('[EstruturaOrganizacional] Erro desconhecido:', error);
    return next(new AppError(errorMessage, 500));
  }
};

