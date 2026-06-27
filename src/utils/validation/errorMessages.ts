export const errorMessagesMap: Record<string, string> = {
  USER_EXISTS: 'Este email já está cadastrado. Faça login ou recupere sua senha.',
  INVALID_EMAIL: 'Email inválido. Verifique o formato e tente novamente.',
  WEAK_PASSWORD:
    'Senha muito fraca. Use letras maiúsculas, minúsculas, números e caracteres especiais.',
  NETWORK_ERROR: 'Erro de conexão. Verifique sua internet e tente novamente.',
  TIMEOUT: 'A requisição demorou muito. Tente novamente.',
  VALIDATION_ERROR: 'Dados inválidos. Verifique os campos e tente novamente.',
  SERVER_ERROR: 'Erro no servidor. Tente novamente mais tarde.',
  UNKNOWN_ERROR: 'Ocorreu um erro inesperado. Tente novamente.',
};

export function getErrorMessage(error: any): string {
  if (!error) {
    return errorMessagesMap.UNKNOWN_ERROR;
  }

  // Se for uma string, retornar diretamente
  if (typeof error === 'string') {
    return error;
  }

  // Se for um ApiError com código
  if (error.details?.code && errorMessagesMap[error.details.code]) {
    return errorMessagesMap[error.details.code];
  }

  // Se tiver message, usar ela
  if (error.message) {
    // Verificar se é erro de rede
    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Network request failed')
    ) {
      return errorMessagesMap.NETWORK_ERROR;
    }

    // Verificar se é timeout
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return errorMessagesMap.TIMEOUT;
    }

    // Verificar se contém código conhecido
    for (const [code, message] of Object.entries(errorMessagesMap)) {
      if (error.message.includes(code)) {
        return message;
      }
    }

    return error.message;
  }

  // Se tiver error.error (formato comum de API)
  if (error.error) {
    if (typeof error.error === 'string') {
      return error.error;
    }
    if (error.error.code && errorMessagesMap[error.error.code]) {
      return errorMessagesMap[error.error.code];
    }
  }

  return errorMessagesMap.UNKNOWN_ERROR;
}
