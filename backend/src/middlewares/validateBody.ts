/**
 * Middleware de validação Zod para body de requisições.
 * Retorna 400 com mensagens amigáveis em caso de falha.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return res.status(400).json({
          error: 'Dados inválidos',
          message: messages || 'Verifique os campos enviados.',
          details: process.env.NODE_ENV !== 'production' ? err.errors : undefined,
        });
      }
      next(err);
    }
  };
}
