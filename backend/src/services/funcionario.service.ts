import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { StatusFuncionario, TipoVinculo, RegimeTrabalho, CategoriaDocente } from '@prisma/client';
import { validarCargoComPerfil, validarDepartamento } from './cargo-departamento.service.js';

/**
 * ========================================
 * SERVIÇO DE FUNCIONÁRIO - NORMALIZAÇÃO E BLINDAGEM
 * ========================================
 * 
 * Responsável por:
 * - Normalizar dados antes de salvar
 * - Definir valores padrão seguros
 * - Garantir consistência institucional
 * - Validar relacionamentos
 */

export interface FuncionarioCreateData {
  nomeCompleto?: string;
  nome_completo?: string;
  email?: string;
  telefone?: string | null;
  dataNascimento?: string | Date;
  data_nascimento?: string | Date;
  genero?: string | null;
  numeroIdentificacao?: string | null;
  numero_identificacao?: string | null;
  morada?: string | null;
  cidade?: string | null;
  pais?: string | null;
  provincia?: string | null;
  municipio?: string | null;
  nomePai?: string | null;
  nome_pai?: string | null;
  nomeMae?: string | null;
  nome_mae?: string | null;
  fotoUrl?: string | null;
  foto_url?: string | null;
  grauAcademico?: string | null;
  grau_academico?: string | null;
  grauAcademicoOutro?: string | null;
  grau_academico_outro?: string | null;
  dataAdmissao?: string | Date;
  data_admissao?: string | Date;
  cargoId?: string | null;
  cargo_id?: string | null;
  departamentoId?: string | null;
  departamento_id?: string | null;
  salarioBase?: number | string | null;
  salario_base?: number | string | null;
  salario?: number | string | null;
  status?: string | StatusFuncionario;
  tipoVinculo?: string | TipoVinculo;
  tipo_vinculo?: string | TipoVinculo;
  regimeTrabalho?: string | RegimeTrabalho;
  regime_trabalho?: string | RegimeTrabalho;
  cargaHorariaSemanal?: number | string | null;
  carga_horaria_semanal?: number | string | null;
  categoriaDocente?: string | CategoriaDocente;
  categoria_docente?: string | CategoriaDocente;
  userId?: string | null;
  user_id?: string | null;
  instituicaoId: string; // OBRIGATÓRIO - sempre do token
}

export interface FuncionarioUpdateData extends Partial<FuncionarioCreateData> {
  id: string;
}

export class FuncionarioService {
  /**
   * Normalizar status do funcionário
   * Garante que sempre retorna um StatusFuncionario válido
   */
  static normalizeStatus(status?: string | StatusFuncionario): StatusFuncionario {
    if (!status) {
      // Usar string literal em vez de enum para evitar erro de importação
      return 'ATIVO' as StatusFuncionario; // Default seguro
    }

    const statusUpper = String(status).trim().toUpperCase();
    
    // Mapear variações comuns
    if (statusUpper === 'ATIVO' || statusUpper === 'ACTIVE' || statusUpper === 'ATIVA') {
      return 'ATIVO' as StatusFuncionario;
    }
    if (statusUpper === 'SUSPENSO' || statusUpper === 'SUSPENDED' || statusUpper === 'SUSPENSA') {
      return 'SUSPENSO' as StatusFuncionario;
    }
    if (statusUpper === 'ENCERRADO' || statusUpper === 'CLOSED' || statusUpper === 'FINALIZADO') {
      return 'ENCERRADO' as StatusFuncionario;
    }

    // Se não reconhecer, retornar default seguro
    return 'ATIVO' as StatusFuncionario;
  }

  /**
   * Normalizar tipo de vínculo
   */
  static normalizeTipoVinculo(tipo?: string | TipoVinculo | null): TipoVinculo | null {
    if (!tipo || tipo === '' || tipo === 'null') {
      return null;
    }

    const tipoUpper = String(tipo).trim().toUpperCase();
    
    if (tipoUpper === 'EFETIVO' || tipoUpper === 'PERMANENTE') {
      return 'EFETIVO' as TipoVinculo;
    }
    if (tipoUpper === 'CONTRATADO' || tipoUpper === 'CONTRACT') {
      return 'CONTRATADO' as TipoVinculo;
    }
    if (tipoUpper === 'TEMPORARIO' || tipoUpper === 'TEMPORARY') {
      return 'TEMPORARIO' as TipoVinculo;
    }

    return null;
  }

  /**
   * Normalizar regime de trabalho
   */
  static normalizeRegimeTrabalho(regime?: string | RegimeTrabalho | null): RegimeTrabalho | null {
    if (!regime || regime === '' || regime === 'null') {
      return null;
    }

    const regimeUpper = String(regime).trim().toUpperCase();
    
    if (regimeUpper === 'INTEGRAL' || regimeUpper === 'FULL_TIME') {
      return 'INTEGRAL' as RegimeTrabalho;
    }
    if (regimeUpper === 'PARCIAL' || regimeUpper === 'PART_TIME') {
      return 'PARCIAL' as RegimeTrabalho;
    }

    return null;
  }

  /**
   * Normalizar categoria docente
   */
  static normalizeCategoriaDocente(categoria?: string | CategoriaDocente | null): CategoriaDocente | null {
    if (!categoria || categoria === '' || categoria === 'null') {
      return null;
    }

    const categoriaUpper = String(categoria).trim().toUpperCase();
    
    const categoriasValidas = [
      'ASSISTENTE', 'AUXILIAR', 'ADJUNTO', 
      'ASSOCIADO', 'TITULAR', 'VISITANTE'
    ];

    if (categoriasValidas.includes(categoriaUpper)) {
      return categoriaUpper as CategoriaDocente;
    }

    return null;
  }

  /**
   * Normalizar data
   */
  static normalizeDate(date?: string | Date | null): Date | null {
    if (!date || date === '' || date === 'null') {
      return null;
    }

    try {
      return new Date(date);
    } catch {
      return null;
    }
  }

  /**
   * Normalizar número decimal
   */
  static normalizeDecimal(value?: number | string | null): number | null {
    if (value === undefined || value === null || value === '' || value === 'null') {
      return null;
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? null : num;
  }

  /**
   * Normalizar número inteiro
   */
  static normalizeInt(value?: number | string | null): number | null {
    if (value === undefined || value === null || value === '' || value === 'null') {
      return null;
    }

    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    return isNaN(num) ? null : Math.floor(num);
  }

  /**
   * Normalizar string (trim e null se vazio)
   */
  static normalizeString(value?: string | null): string | null {
    if (!value || value === '' || value === 'null') {
      return null;
    }
    return value.trim() || null;
  }

  /**
   * Preparar dados para CREATE
   * Aplica todas as normalizações e defaults
   */
  static async prepareCreateData(
    rawData: FuncionarioCreateData,
    userRoles: string[] = []
  ): Promise<any> {
    // Validar instituicaoId (OBRIGATÓRIO)
    if (!rawData.instituicaoId) {
      throw new AppError('instituicaoId é obrigatório', 400);
    }

    // Normalizar nome e email (obrigatórios)
    const nomeCompleto = this.normalizeString(
      rawData.nomeCompleto ?? rawData.nome_completo
    );

    // VALIDAÇÃO CRÍTICA: Funcionário é SEMPRE pessoa física
    // Bloquear apenas indicadores MUITO específicos de pessoa jurídica
    // (removemos palavras genéricas que podem aparecer em nomes de pessoas)
    if (nomeCompleto) {
      const nomeUpper = nomeCompleto.toUpperCase().trim();
      
      // Apenas indicadores muito específicos de PJ que raramente aparecem em nomes de pessoas
      // Removemos: EMPRESA, COMERCIO, SERVICOS, PRESTACAO (podem ser sobrenomes)
      
      // Verificar se termina com indicador de PJ (onde geralmente ficam)
      const nomeWords = nomeUpper.split(/\s+/);
      const ultimaPalavra = nomeWords[nomeWords.length - 1];
      const indicadoresFinais = ['LTDA', 'LTDA.', 'EIRELI', 'ME', 'EPP', 'SA', 'S.A.', 'S/A'];
      
      if (indicadoresFinais.includes(ultimaPalavra)) {
        throw new AppError(
          `Funcionários são pessoas físicas. O nome termina com indicador de pessoa jurídica (${ultimaPalavra}). Empresas terceirizadas devem ser cadastradas como Fornecedores (pessoa jurídica).`,
          400
        );
      }
      
      // Verificar se contém "SOCIEDADE" como primeira palavra (muito comum em razões sociais)
      if (nomeWords.length > 0 && nomeWords[0] === 'SOCIEDADE') {
        throw new AppError(
          'Funcionários são pessoas físicas. O nome começa com "SOCIEDADE", indicando pessoa jurídica. Empresas terceirizadas devem ser cadastradas como Fornecedores (pessoa jurídica).',
          400
        );
      }
    }

    // Validação de CNPJ: bloquear apenas formato brasileiro explícito (XX.XXX.XXX/XXXX-XX).
    // Não bloquear 14 dígitos genéricos: BI angolano, passaporte e outros docs podem ter 14 dígitos.
    const numeroIdentificacao = rawData.numeroIdentificacao ?? rawData.numero_identificacao;
    if (numeroIdentificacao) {
      const numeroStr = String(numeroIdentificacao).trim();
      const formatoCNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(numeroStr);
      if (formatoCNPJ) {
        throw new AppError(
          'Funcionários são pessoas físicas. O número de identificação fornecido parece ser um CNPJ (formato brasileiro). Empresas terceirizadas devem ser cadastradas como Fornecedores (pessoa jurídica).',
          400
        );
      }
    }
    const email = this.normalizeString(rawData.email);

    if (!nomeCompleto || !email) {
      throw new AppError('Nome completo e email são obrigatórios', 400);
    }

    // Preparar dados normalizados
    const data: any = {
      nomeCompleto,
      email,
      instituicaoId: rawData.instituicaoId, // SEMPRE do token
      status: this.normalizeStatus(rawData.status), // Default: ATIVO
      dataAdmissao: this.normalizeDate(
        rawData.dataAdmissao ?? rawData.data_admissao
      ) || new Date(), // Default: hoje
    };

    // Campos opcionais normalizados
    if (rawData.telefone !== undefined) {
      data.telefone = this.normalizeString(rawData.telefone);
    }
    if (rawData.dataNascimento !== undefined || rawData.data_nascimento !== undefined) {
      data.dataNascimento = this.normalizeDate(
        rawData.dataNascimento ?? rawData.data_nascimento
      );
    }
    if (rawData.genero !== undefined) {
      data.genero = this.normalizeString(rawData.genero);
    }
    if (rawData.numeroIdentificacao !== undefined || rawData.numero_identificacao !== undefined) {
      data.numeroIdentificacao = this.normalizeString(
        rawData.numeroIdentificacao ?? rawData.numero_identificacao
      );
    }

    // Endereço
    data.morada = this.normalizeString(rawData.morada);
    data.cidade = this.normalizeString(rawData.cidade);
    data.pais = this.normalizeString(rawData.pais);
    data.provincia = this.normalizeString(rawData.provincia);
    data.municipio = this.normalizeString(rawData.municipio);

    // Dados familiares
    data.nomePai = this.normalizeString(rawData.nomePai ?? rawData.nome_pai);
    data.nomeMae = this.normalizeString(rawData.nomeMae ?? rawData.nome_mae);

    // Foto e grau acadêmico
    data.fotoUrl = this.normalizeString(rawData.fotoUrl ?? rawData.foto_url);
    data.grauAcademico = this.normalizeString(rawData.grauAcademico ?? rawData.grau_academico);
    data.grauAcademicoOutro = this.normalizeString(
      rawData.grauAcademicoOutro ?? rawData.grau_academico_outro
    );

    // Relacionamentos (validar existência)
    const cargoId = rawData.cargoId ?? rawData.cargo_id;
    const departamentoId = rawData.departamentoId ?? rawData.departamento_id;

    if (cargoId) {
      // Validar cargo existe e está ativo
      await validarCargoComPerfil(cargoId, userRoles as any, rawData.instituicaoId);
      data.cargoId = cargoId;
    } else {
      data.cargoId = null;
    }

    if (departamentoId) {
      // Validar departamento existe e está ativo
      await validarDepartamento(departamentoId, rawData.instituicaoId);
      data.departamentoId = departamentoId;
    } else {
      data.departamentoId = null;
    }

    // Salário
    const salarioFinal = this.normalizeDecimal(
      rawData.salarioBase ?? rawData.salario_base ?? rawData.salario
    );
    if (salarioFinal !== null) {
      data.salarioBase = salarioFinal;
    }

    // Tipo de vínculo
    const tipoVinculo = this.normalizeTipoVinculo(
      rawData.tipoVinculo ?? rawData.tipo_vinculo
    );
    if (tipoVinculo !== null) {
      data.tipoVinculo = tipoVinculo;
    }

    // Regime de trabalho
    const regimeTrabalho = this.normalizeRegimeTrabalho(
      rawData.regimeTrabalho ?? rawData.regime_trabalho
    );
    if (regimeTrabalho !== null) {
      data.regimeTrabalho = regimeTrabalho;
    }

    // Carga horária semanal
    const cargaHoraria = this.normalizeInt(
      rawData.cargaHorariaSemanal ?? rawData.carga_horaria_semanal
    );
    if (cargaHoraria !== null) {
      data.cargaHorariaSemanal = cargaHoraria;
    }

    // Categoria docente
    const categoriaDocente = this.normalizeCategoriaDocente(
      rawData.categoriaDocente ?? rawData.categoria_docente
    );
    if (categoriaDocente !== null) {
      data.categoriaDocente = categoriaDocente;
    }

    // User ID (opcional)
    if (rawData.userId ?? rawData.user_id) {
      data.userId = rawData.userId ?? rawData.user_id;
    }

    return data;
  }

  /**
   * Preparar dados para UPDATE
   * Aplica normalizações apenas nos campos fornecidos
   */
  static async prepareUpdateData(
    id: string,
    rawData: Partial<FuncionarioCreateData>,
    userRoles: string[] = []
  ): Promise<any> {
    // Verificar se funcionário existe
    const existing = await prisma.funcionario.findUnique({
      where: { id },
      select: { instituicaoId: true },
    });

    if (!existing) {
      throw new AppError('Funcionário não encontrado', 404);
    }

    const instituicaoId = existing.instituicaoId || rawData.instituicaoId;
    if (!instituicaoId) {
      throw new AppError('Instituição não identificada', 400);
    }

    const data: any = {};

    // Nome completo
    if (rawData.nomeCompleto !== undefined || rawData.nome_completo !== undefined) {
      const nome = this.normalizeString(
        rawData.nomeCompleto ?? rawData.nome_completo
      );
      if (!nome) {
        throw new AppError('Nome completo não pode ser vazio', 400);
      }
      data.nomeCompleto = nome;
    }

    // Email
    if (rawData.email !== undefined) {
      const email = this.normalizeString(rawData.email);
      if (!email) {
        throw new AppError('Email não pode ser vazio', 400);
      }
      data.email = email;
    }

    // Status (sempre normalizar)
    if (rawData.status !== undefined) {
      data.status = this.normalizeStatus(rawData.status);
    }

    // Telefone
    if (rawData.telefone !== undefined) {
      data.telefone = this.normalizeString(rawData.telefone);
    }

    // Data de nascimento
    if (rawData.dataNascimento !== undefined || rawData.data_nascimento !== undefined) {
      data.dataNascimento = this.normalizeDate(
        rawData.dataNascimento ?? rawData.data_nascimento
      );
    }

    // Gênero
    if (rawData.genero !== undefined) {
      data.genero = this.normalizeString(rawData.genero);
    }

    // Número de identificação
    if (rawData.numeroIdentificacao !== undefined || rawData.numero_identificacao !== undefined) {
      data.numeroIdentificacao = this.normalizeString(
        rawData.numeroIdentificacao ?? rawData.numero_identificacao
      );
    }

    // Endereço
    if (rawData.morada !== undefined) data.morada = this.normalizeString(rawData.morada);
    if (rawData.cidade !== undefined) data.cidade = this.normalizeString(rawData.cidade);
    if (rawData.pais !== undefined) data.pais = this.normalizeString(rawData.pais);
    if (rawData.provincia !== undefined) data.provincia = this.normalizeString(rawData.provincia);
    if (rawData.municipio !== undefined) data.municipio = this.normalizeString(rawData.municipio);

    // Dados familiares
    if (rawData.nomePai !== undefined || rawData.nome_pai !== undefined) {
      data.nomePai = this.normalizeString(rawData.nomePai ?? rawData.nome_pai);
    }
    if (rawData.nomeMae !== undefined || rawData.nome_mae !== undefined) {
      data.nomeMae = this.normalizeString(rawData.nomeMae ?? rawData.nome_mae);
    }

    // Foto e grau acadêmico
    if (rawData.fotoUrl !== undefined || rawData.foto_url !== undefined) {
      data.fotoUrl = this.normalizeString(rawData.fotoUrl ?? rawData.foto_url);
    }
    if (rawData.grauAcademico !== undefined || rawData.grau_academico !== undefined) {
      data.grauAcademico = this.normalizeString(rawData.grauAcademico ?? rawData.grau_academico);
    }
    if (rawData.grauAcademicoOutro !== undefined || rawData.grau_academico_outro !== undefined) {
      data.grauAcademicoOutro = this.normalizeString(
        rawData.grauAcademicoOutro ?? rawData.grau_academico_outro
      );
    }

    // Data de admissão
    if (rawData.dataAdmissao !== undefined || rawData.data_admissao !== undefined) {
      data.dataAdmissao = this.normalizeDate(
        rawData.dataAdmissao ?? rawData.data_admissao
      ) || new Date();
    }

    // Cargo (validar se fornecido)
    if (rawData.cargoId !== undefined || rawData.cargo_id !== undefined) {
      const cargoId = rawData.cargoId ?? rawData.cargo_id;
      if (cargoId) {
        await validarCargoComPerfil(cargoId, userRoles as any, instituicaoId);
        data.cargoId = cargoId;
      } else {
        data.cargoId = null;
      }
    }

    // Departamento (validar se fornecido)
    if (rawData.departamentoId !== undefined || rawData.departamento_id !== undefined) {
      const departamentoId = rawData.departamentoId ?? rawData.departamento_id;
      if (departamentoId) {
        await validarDepartamento(departamentoId, instituicaoId);
        data.departamentoId = departamentoId;
      } else {
        data.departamentoId = null;
      }
    }

    // Salário
    if (rawData.salarioBase !== undefined || rawData.salario_base !== undefined || rawData.salario !== undefined) {
      const salarioFinal = this.normalizeDecimal(
        rawData.salarioBase ?? rawData.salario_base ?? rawData.salario
      );
      if (salarioFinal !== null) {
        data.salarioBase = salarioFinal;
      } else {
        data.salarioBase = null;
      }
    }

    // Tipo de vínculo
    if (rawData.tipoVinculo !== undefined || rawData.tipo_vinculo !== undefined) {
      const tipoVinculo = this.normalizeTipoVinculo(
        rawData.tipoVinculo ?? rawData.tipo_vinculo
      );
      data.tipoVinculo = tipoVinculo;
    }

    // Regime de trabalho
    if (rawData.regimeTrabalho !== undefined || rawData.regime_trabalho !== undefined) {
      const regimeTrabalho = this.normalizeRegimeTrabalho(
        rawData.regimeTrabalho ?? rawData.regime_trabalho
      );
      data.regimeTrabalho = regimeTrabalho;
    }

    // Carga horária semanal
    if (rawData.cargaHorariaSemanal !== undefined || rawData.carga_horaria_semanal !== undefined) {
      const cargaHoraria = this.normalizeInt(
        rawData.cargaHorariaSemanal ?? rawData.carga_horaria_semanal
      );
      data.cargaHorariaSemanal = cargaHoraria;
    }

    // Categoria docente
    if (rawData.categoriaDocente !== undefined || rawData.categoria_docente !== undefined) {
      const categoriaDocente = this.normalizeCategoriaDocente(
        rawData.categoriaDocente ?? rawData.categoria_docente
      );
      data.categoriaDocente = categoriaDocente;
    }

    // User ID
    if (rawData.userId !== undefined || rawData.user_id !== undefined) {
      data.userId = rawData.userId ?? rawData.user_id ?? null;
    }

    return data;
  }
}

