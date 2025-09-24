export const MESSAGE_TYPES = Object.freeze({
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    SUCCESS: 'success'
});

const createAction = (id, label, { variant = 'primary', icon = null, ariaLabel = null } = {}) => ({
    id,
    label,
    variant,
    icon,
    ariaLabel
});

const createQuizMessages = () => ({
    noQuestionsForFilters: {
        type: MESSAGE_TYPES.INFO,
        title: 'Nenhum conjunto de perguntas encontrado',
        body: 'Não encontramos questões que combinem com a seleção atual de filtros.',
        supportingText: 'Amplie os filtros escolhendo novas categorias ou ajustando o nível de dificuldade para explorar mais conteúdos.',
        features: [
            'Combine diferentes especialidades para gerar conjuntos variados de estudo.',
            'Diminua o número de questões para montar um quiz rápido e focado.',
            'Experimente o modo Quiz Rápido para iniciar imediatamente com uma curadoria automática.',
        ],
        actions: [
            createAction('openFilters', 'Ajustar filtros', { variant: 'primary', icon: 'tune' }),
            createAction('returnToHub', 'Voltar para modos de jogo', { variant: 'ghost', icon: 'arrow_back' }),
        ],
        isTextCentered: true,
    },
    resumeSessionError: {
        type: MESSAGE_TYPES.WARNING,
        title: 'Não foi possível retomar sua sessão',
        body: 'Tentamos recuperar o progresso da sessão anterior, mas ele não está mais disponível.',
        supportingText: params => params?.detail || 'Inicie um novo desafio a partir do hub de modos de jogo para continuar praticando.',
        actions: [
            createAction('returnToHub', 'Ir para o hub', { variant: 'secondary', icon: 'stadia_controller' }),
        ],
    },
    loadQuestionsError: {
        type: MESSAGE_TYPES.ERROR,
        title: 'Não foi possível carregar as perguntas',
        body: 'Houve uma instabilidade ao montar o quiz solicitado.',
        supportingText: params => params?.detail || 'Verifique sua conexão ou tente novamente em alguns instantes.',
        actions: [
            createAction('retryLastQuiz', 'Tentar novamente', { variant: 'primary', icon: 'refresh' }),
        ],
    },
    startSessionFailed: {
        type: MESSAGE_TYPES.ERROR,
        title: 'Não conseguimos iniciar o quiz',
        body: 'O serviço não conseguiu criar a sessão de perguntas solicitada.',
        supportingText: params => params?.detail || 'Tente novamente em alguns instantes. Se o problema persistir, verifique seus filtros ou a conexão.',
        actions: [
            createAction('retryLastQuiz', 'Tentar novamente', { variant: 'primary', icon: 'refresh' }),
            createAction('contactSupport', 'Falar com o suporte', { variant: 'text', icon: 'support_agent' }),
        ],
    },
    saveAnswerError: {
        type: MESSAGE_TYPES.ERROR,
        title: 'Resposta não registrada',
        body: 'Encontramos um erro ao salvar sua resposta.',
        supportingText: params => params?.detail || 'Verifique sua conexão e tente novamente responder a questão.',
    },
    finalizeSessionError: {
        type: MESSAGE_TYPES.WARNING,
        title: 'Finalização pendente',
        body: 'A sessão foi encerrada, mas ainda estamos confirmando seus resultados.',
        supportingText: params => params?.detail || 'Atualize a página em alguns segundos caso os dados não apareçam no painel.',
    },
});

const createFavoriteMessages = () => ({
    loginRequiredToFavorite: {
        type: MESSAGE_TYPES.INFO,
        title: 'Entre para salvar favoritos',
        body: 'Faça login ou crie uma conta gratuita para sincronizar suas questões favoritas em todos os dispositivos.',
        isTextCentered: true,
        actions: [
            createAction('goToLogin', 'Fazer login', { variant: 'primary', icon: 'login' }),
            createAction('goToRegister', 'Criar conta', { variant: 'ghost', icon: 'person_add' }),
        ],
    },
    loginRequiredToManage: {
        type: MESSAGE_TYPES.INFO,
        title: 'Requer autenticação',
        body: 'Para gerenciar sua lista de favoritos é necessário estar autenticado.',
        supportingText: 'Entre com sua conta para continuar organizando seu conteúdo personalizado.',
        actions: [
            createAction('goToLogin', 'Entrar agora', { variant: 'primary', icon: 'login' }),
        ],
    },
    toggleError: {
        type: MESSAGE_TYPES.ERROR,
        title: 'Não foi possível atualizar seus favoritos',
        supportingText: params => params?.detail || 'Tente novamente em alguns instantes.',
    },
    networkError: {
        type: MESSAGE_TYPES.ERROR,
        title: 'Instabilidade na conexão',
        body: 'Não foi possível se comunicar com o serviço de favoritos.',
        supportingText: params => params?.detail || 'Verifique sua internet e tente novamente.',
    },
    loadSingleError: {
        type: MESSAGE_TYPES.ERROR,
        title: 'Questão favorita indisponível',
        body: 'Não conseguimos carregar a versão mais recente dessa questão favorita.',
        supportingText: params => params?.detail || 'Ela pode ter sido removida ou alterada recentemente.',
    },
});

const createGeneralMessages = () => ({
    networkOffline: {
        type: MESSAGE_TYPES.ERROR,
        title: 'Você está offline',
        body: 'Detectamos uma instabilidade na conexão com a internet.',
        supportingText: params => params?.detail || 'Verifique seus cabos ou a rede Wi-Fi e tente novamente.',
        actions: [
            createAction('reloadPage', 'Recarregar página', { variant: 'primary', icon: 'refresh' }),
        ],
    },
    criticalFailure: {
        type: MESSAGE_TYPES.ERROR,
        title: 'Algo não saiu como esperado',
        body: 'Encontramos uma inconsistência ao carregar a interface.',
        supportingText: params => params?.detail || 'Recarregue a página para tentar novamente. Se o problema persistir, entre em contato com o suporte.',
        actions: [
            createAction('reloadPage', 'Recarregar', { variant: 'primary', icon: 'refresh' }),
            createAction('contactSupport', 'Falar com o suporte', { variant: 'text', icon: 'support_agent' }),
        ],
    },
});

export const MESSAGE_CATALOG = Object.freeze({
    general: createGeneralMessages(),
    quiz: createQuizMessages(),
    favorites: createFavoriteMessages(),
});
