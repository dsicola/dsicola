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

export {};
