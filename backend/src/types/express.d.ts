/**
 * Extensões do Express Request - propriedades adicionadas pelos middlewares.
 * Inclui user (auth) e professor (resolveProfessor).
 */
declare global {
  namespace Express {
    interface Request {
      professor?: {
        id: string; // professores.id
        userId: string; // users.id (referência)
        instituicaoId: string; // instituições.id
      };
    }
  }
}

export {};
