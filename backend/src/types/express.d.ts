/**
 * Extensões do Express Request - propriedades adicionadas pelos middlewares.
 * professor: resolveProfessor middleware
 */
declare module 'express-serve-static-core' {
  interface Request {
    professor?: {
      id: string; // professores.id
      userId: string; // users.id (referência)
      instituicaoId: string; // instituições.id
    };
  }
}

/** Tipo para uso com type assertion quando module augmentation não é aplicada (ex: Docker/Railway) */
export type RequestWithProfessor = import('express-serve-static-core').Request & {
  professor?: { id: string; userId: string; instituicaoId: string };
};
