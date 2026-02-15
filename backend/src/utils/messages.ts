/**
 * Mensagens formais do sistema DSICOLA (Backend)
 *
 * Centraliza mensagens exibidas aos utilizadores para garantir
 * comunicação clara, profissional e consistente.
 */

export const messages = {
  // === Não encontrado (404) ===
  notFound: {
    profile: 'O perfil solicitado não foi encontrado na base de dados.',
    user: 'O utilizador solicitado não foi encontrado na base de dados.',
    student: 'O estudante solicitado não foi encontrado ou não pertence à sua instituição.',
    exam: 'O exame solicitado não foi encontrado.',
    evaluation: 'A avaliação solicitada não foi encontrada.',
    plan: 'O plano de ensino solicitado não foi encontrado ou não pertence à sua instituição.',
    institution: 'A instituição solicitada não foi encontrada.',
    generic: 'O recurso solicitado não foi encontrado.',
  },

  // === Acesso negado (403) ===
  forbidden: {
    generic: 'Não possui permissão para efectuar esta acção.',
    profile: 'Não possui permissão para aceder a este perfil.',
    notes: 'Não possui permissão para visualizar ou alterar estas notas.',
  },

  // === Validação (400) ===
  validation: {
    invalidEmail: 'O endereço de correio electrónico introduzido não é válido.',
    emailInUse: 'O endereço de correio electrónico já se encontra registado no sistema.',
    invalidData: 'Os dados introduzidos contêm erros. Por favor, verifique e tente novamente.',
    requiredFields: 'Existem campos obrigatórios que não foram preenchidos.',
    invalidName: 'O nome completo introduzido não é válido.',
  },

  // === Autenticação ===
  auth: {
    invalidCredentials: 'As credenciais introduzidas estão incorrectas. Por favor, tente novamente.',
    userNotFound: 'O utilizador solicitado não foi encontrado na base de dados.',
  },
} as const;
