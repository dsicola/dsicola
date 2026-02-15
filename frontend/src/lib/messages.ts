/**
 * Mensagens formais do sistema DSICOLA
 * 
 * Centraliza todas as mensagens exibidas aos utilizadores para garantir
 * comunicação clara, profissional e consistente em toda a aplicação.
 */

export const messages = {
  // === Estados vazios / sem dados ===
  empty: {
    noResults: 'Não foram encontrados resultados para a sua pesquisa.',
    noData: 'Não existem registos disponíveis no momento.',
    noRecords: 'Não existem registos que correspondam aos critérios selecionados.',
    tryAdjustFilters: 'Sugerimos que ajuste os filtros aplicados para obter resultados.',
    noCadastro: 'Não existe nenhum registo cadastrado no sistema para este item.',
    noMatricula: 'Não existe nenhuma matrícula associada. Por favor, efectue a matrícula para continuar.',
  },

  // === Busca / pesquisa ===
  search: {
    placeholder: 'Introduza o termo de pesquisa...',
    searching: 'A pesquisar...',
    minChars: 'Introduza pelo menos {n} caracteres para iniciar a pesquisa.',
    selected: 'Registo selecionado com sucesso.',
    selectedItem: 'Registo "{nome}" selecionado com sucesso.',
  },

  // === Autenticação ===
  auth: {
    loginSuccess: 'Autenticação efectuada com sucesso. Bem-vindo(a)!',
    loginError: 'Não foi possível efectuar o início de sessão. Verifique as credenciais e tente novamente.',
    invalidCredentials: 'O endereço de correio electrónico ou a palavra-passe introduzidos estão incorrectos. Por favor, verifique e tente novamente.',
    accountLocked: 'A sua conta encontra-se temporariamente bloqueada devido a várias tentativas de início de sessão falhadas. Por favor, aguarde alguns minutos e tente novamente.',
    subscriptionExpired: 'A assinatura da instituição encontra-se expirada. Por favor, contacte o administrador da plataforma.',
    unexpectedError: 'Ocorreu um erro inesperado na comunicação com o servidor. Por favor, tente novamente.',
    passwordRequired: 'É obrigatório definir uma palavra-passe para aceder à plataforma.',
  },

  // === Validação de formulários ===
  validation: {
    requiredFields: 'Por favor, preencha todos os campos obrigatórios.',
    invalidEmail: 'Por favor, introduza um endereço de correio electrónico válido.',
    passwordMinLength: 'A palavra-passe deve ter no mínimo 6 caracteres.',
    passwordStrong: 'A palavra-passe deve conter pelo menos uma letra maiúscula e um caractere especial.',
    passwordsMismatch: 'As palavras-passe introduzidas não coincidem. Por favor, verifique e tente novamente.',
  },

  // === Perfil ===
  profile: {
    loadError: 'Não foi possível carregar os dados do perfil. Por favor, tente novamente.',
    updateSuccess: 'Os dados do perfil foram actualizados com sucesso.',
    updateError: 'Não foi possível actualizar o perfil. Por favor, tente novamente.',
    passwordChangeSuccess: 'A palavra-passe foi alterada com sucesso. Será redirecionado(a) para o início de sessão.',
    passwordChangeError: 'Não foi possível alterar a palavra-passe. Por favor, tente novamente.',
    imageMaxSize: 'A imagem seleccionada excede o tamanho máximo permitido (3 MB).',
    imageFormat: 'Apenas imagens nos formatos JPEG e PNG são permitidas.',
  },

  // === Operações genéricas ===
  operations: {
    saveSuccess: 'Os dados foram gravados com sucesso.',
    saveError: 'Não foi possível gravar os dados. Por favor, tente novamente.',
    deleteSuccess: 'O registo foi removido com sucesso.',
    deleteError: 'Não foi possível remover o registo. Por favor, tente novamente.',
    updateSuccess: 'Os dados foram actualizados com sucesso.',
    updateError: 'Não foi possível actualizar os dados. Por favor, tente novamente.',
    loadError: 'Não foi possível carregar os dados. Por favor, tente novamente.',
  },

  // === Mensagens contextuais (listas/gestão) ===
  list: {
    noItems: 'Nenhum item encontrado.',
    noItemsHint: 'Não existem itens que correspondam à sua pesquisa. Sugerimos que ajuste os filtros.',
    createFirst: 'Não existem registos. Utilize o botão acima para adicionar o primeiro registo.',
    createFirstAction: 'Clique em "Novo" ou "Adicionar" para criar o primeiro registo.',
  },

  // === Mensagens de permissão ===
  permission: {
    denied: 'Não possui permissão para efectuar esta acção.',
    contactAdmin: 'Contacte o administrador da instituição para solicitar acesso.',
    professorNotRegistered: 'O seu perfil de professor ainda não se encontra registado nesta instituição. Por favor, contacte a administração para solicitar o cadastro.',
  },

  // === Mensagens académicas ===
  academic: {
    noTurmas: 'Não possui turmas ou disciplinas atribuídas. Por favor, contacte a administração para efectuar a atribuição.',
    noAlunos: 'Não existem estudantes matriculados neste momento. Para registar presenças, é necessário efectuar matrículas previamente.',
  },
} as const;

/**
 * Função auxiliar para substituir placeholders em mensagens
 * Ex: formatMessage(messages.search.minChars, { n: '2' }) => "Introduza pelo menos 2 caracteres..."
 */
export function formatMessage(
  message: string,
  params: Record<string, string | number>
): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
    message
  );
}
