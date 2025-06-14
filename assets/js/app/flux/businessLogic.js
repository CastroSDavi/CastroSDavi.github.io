// assets/js/app/flux/businessLogic.js

/**
 * Verifica se a opção selecionada pelo usuário é a correta.
 * @param {object} question - O objeto da questão atual.
 * @param {number} selectedOptionId - O ID da opção que o usuário selecionou.
 * @returns {boolean|null} Retorna true se correta, false se incorreta, ou null se a opção não for encontrada.
 */
export function isAnswerCorrect(question, selectedOptionId) {
    if (!question || !question.opcoes) {
        return null;
    }
    const selectedOption = question.opcoes.find(opt => opt.id_opcao_resposta === selectedOptionId);
    if (!selectedOption) {
        return null;
    }
    return selectedOption.eh_correta;
}

/**
 * Converte um objeto de erro (de API ou de rede) em uma mensagem amigável para o usuário,
 * agora com mais detalhes baseados no status HTTP.
 * @param {object} error - O objeto de erro, que pode conter 'response' e 'data'.
 * @param {string} defaultMessage - Uma mensagem padrão para usar como fallback.
 * @returns {string} A mensagem de erro formatada.
 */
export function getFriendlyErrorMessage(error, defaultMessage = "Ocorreu um erro. Tente novamente.") {
    // 1. Erro de Rede (Fetch falhou em si)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
        return "Erro de conexão. Verifique sua internet e tente novamente.";
    }

    // 2. Erro de API com resposta do servidor
    if (error && error.response) {
        const status = error.response.status;
        const responseData = error.data;

        // Tenta pegar a mensagem específica do corpo da resposta da API
        if (responseData && (responseData.message || responseData.detail)) {
            return responseData.message || responseData.detail;
        }

        // Fallback para mensagens baseadas no status code
        switch (status) {
            case 400:
                return "Requisição inválida. Verifique os dados enviados.";
            case 401:
                return "Não autorizado. Você precisa fazer login para realizar esta ação.";
            case 403:
                return "Acesso negado. Você não tem permissão para realizar esta ação.";
            case 404:
                return "O recurso solicitado não foi encontrado.";
            case 500:
                return "Erro interno no servidor. A equipe já foi notificada. Por favor, tente novamente mais tarde.";
            default:
                // Para outros erros 4xx e 5xx
                if (status >= 400 && status < 500) {
                    return `Erro do cliente (código: ${status}). Por favor, tente novamente.`;
                }
                if (status >= 500 && status < 600) {
                    return `Erro no servidor (código: ${status}). Por favor, tente novamente mais tarde.`;
                }
        }
    }

    // 3. Erro de JavaScript genérico com uma propriedade 'message'
    if (error && error.message) {
        return typeof error.message === 'string' ? error.message : defaultMessage;
    }
    
    // 4. Fallback final
    return defaultMessage;
}