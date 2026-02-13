import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Ensure CORS headers are set even on errors
  // This is important for CORS preflight and error responses
  const origin = req.headers.origin;
  if (origin && (
    origin.startsWith('http://localhost:') || 
    origin.startsWith('http://127.0.0.1:') ||
    process.env.FRONTEND_URL?.split(',').map(url => url.trim()).includes(origin)
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  console.error('Error:', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      message: 'Dados inválidos',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Registro duplicado',
        message: 'Registro duplicado',
        field: (err.meta?.target as string[])?.join(', ')
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Registro não encontrado',
        message: 'Registro não encontrado'
      });
    }
    if (err.code === 'P2003') {
      // P2003 = Foreign key constraint failed
      // Tentar extrair informações sobre qual campo causou o erro
      const fieldName = (err.meta?.field_name as string) || 'campo relacionado';
      const modelName = (err.meta?.model_name as string) || 'registro';
      
      // Log detalhado para debug
      if (process.env.NODE_ENV !== 'production') {
        console.error('[P2003] Foreign key constraint failed:', {
          fieldName,
          modelName,
          meta: err.meta,
          route: `${req.method} ${req.path}`,
          body: req.body,
        });
      }
      
      return res.status(400).json({
        error: 'Erro de referência',
        message: `Falha ao criar/atualizar registro. O campo "${fieldName}" referencia um ${modelName} que não existe ou não pertence à sua instituição. Verifique se todos os dados relacionados (curso, classe, disciplina, professor, turma, ano letivo) estão cadastrados corretamente.`,
        field: fieldName,
        model: modelName,
      });
    }
    if (err.code === 'P2014') {
      return res.status(400).json({
        error: 'Violação de relacionamento',
        message: 'Não é possível atualizar este registro devido a restrições de relacionamento.'
      });
    }
    // Log other Prisma errors for debugging
    console.error('Prisma error:', err.code, err.meta);
  }
  
  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    // Log detalhado para debug
    console.error('[Prisma Validation Error]', {
      message: err.message,
      route: `${req.method} ${req.path}`,
      body: req.body,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });
    
    const errorDetails = process.env.NODE_ENV !== 'production' 
      ? {
          error: 'Dados inválidos',
          message: 'Os dados fornecidos não são válidos. Verifique os campos enviados.',
          details: err.message,
          route: `${req.method} ${req.path}`,
          hint: 'Verifique se todos os campos obrigatórios foram preenchidos corretamente (alunoId, planoEnsinoId, avaliacaoId, valor).',
        }
      : {
          error: 'Dados inválidos',
          message: 'Os dados fornecidos não são válidos. Verifique os campos enviados.'
        };
    
    return res.status(400).json(errorDetails);
  }

  // Custom AppError
  if (err instanceof AppError) {
    // Log detalhado para debug
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ERROR_HANDLER] AppError:', {
        statusCode: err.statusCode,
        message: err.message,
        reason: (err as any).reason,
        code: (err as any).code,
        route: `${req.method} ${req.path}`,
        userId: req.user?.userId,
        instituicaoId: req.user?.instituicaoId,
      });
    }

    const response: any = {
      error: (err as any).code || err.message,
      message: err.message,
    };

    // Incluir reason se existir
    if ((err as any).reason) {
      response.reason = (err as any).reason;
    }

    // Tratamento especial para TERMO_NAO_ACEITO
    if ((err as any).code === 'TERMO_NAO_ACEITO') {
      response.error = 'TERMO_NAO_ACEITO';
      response.termo = (err as any).termo;
      response.termoId = (err as any).termoId;
    }

    return res.status(err.statusCode).json(response);
  }

  // Default error
  return res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message
  });
};
