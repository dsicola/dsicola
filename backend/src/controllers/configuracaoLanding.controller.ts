import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

const CHAVES_COORDENADAS = ['coordenadas_banco', 'coordenadas_iban', 'coordenadas_nib', 'coordenadas_titular', 'coordenadas_instrucoes', 'coordenadas_restricao'] as const;

function isChaveSensivelLanding(chave: string): boolean {
  const k = chave.trim();
  return k.startsWith('coordenadas_') || (CHAVES_COORDENADAS as readonly string[]).includes(k);
}

/** Retorna coordenadas bancárias para pagamentos (emails, Minha Licença) */
export async function getCoordenadasBancarias(): Promise<{
  banco: string;
  iban: string;
  nib: string;
  titular: string;
  instrucoes: string;
  restricao: string;
}> {
  const configs = await prisma.configuracaoLanding.findMany({
    where: { chave: { in: [...CHAVES_COORDENADAS] } },
  });
  const map = new Map(configs.map((c) => [c.chave, c.valor ?? '']));
  return {
    banco: map.get('coordenadas_banco') ?? '',
    iban: map.get('coordenadas_iban') ?? '',
    nib: map.get('coordenadas_nib') ?? '',
    titular: map.get('coordenadas_titular') ?? '',
    instrucoes: map.get('coordenadas_instrucoes') ?? '',
    restricao: map.get('coordenadas_restricao') ?? 'Só aceitamos transferência pelo ATM ou Depósito na Conta',
  };
}

export const getCoordenadasBancariasEndpoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coords = await getCoordenadasBancarias();
    res.json(coords);
  } catch (error) {
    next(error);
  }
};

/** Lista completa — apenas SUPER_ADMIN (rota protegida). */
export const getAllAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configuracoes = await prisma.configuracaoLanding.findMany({
      orderBy: { chave: 'asc' },
    });

    res.json(configuracoes);
  } catch (error) {
    next(error);
  }
};

/** Landing pública / vendas: sem dados bancários nem chaves coordenadas_. */
export const getAllPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configuracoes = await prisma.configuracaoLanding.findMany({
      where: {
        NOT: { chave: { startsWith: 'coordenadas_' } },
        chave: { notIn: [...CHAVES_COORDENADAS] },
      },
      orderBy: { chave: 'asc' },
    });

    res.json(configuracoes);
  } catch (error) {
    next(error);
  }
};

export const getByChave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chave } = req.params;
    if (isChaveSensivelLanding(chave)) {
      throw new AppError('Configuração não encontrada', 404);
    }

    const configuracao = await prisma.configuracaoLanding.findUnique({
      where: { chave },
    });

    if (!configuracao) {
      throw new AppError('Configuração não encontrada', 404);
    }

    res.json(configuracao);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chave } = req.params;
    const { valor } = req.body;

    if (!chave || typeof chave !== 'string' || !chave.trim()) {
      throw new AppError('Chave inválida', 400);
    }
    const valorStr = valor == null ? '' : String(valor);

    const configuracao = await prisma.configuracaoLanding.upsert({
      where: { chave: chave.trim() },
      update: { valor: valorStr },
      create: { chave: chave.trim(), valor: valorStr },
    });

    res.json(configuracao);
  } catch (error) {
    next(error);
  }
};
