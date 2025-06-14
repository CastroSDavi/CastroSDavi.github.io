// Arquivo Completo: assets/js/app/flux/actions.js

/*
 * Action Types: constantes que definem os tipos de ações possíveis.
 */
export const ActionTypes = {
    // Ações de Estado do Quiz
    INITIALIZE_QUIZ: 'INITIALIZE_QUIZ',
    REHYDRATE_SESSION: 'REHYDRATE_SESSION',
    RESET_QUIZ: 'RESET_QUIZ',
    QUIZ_ENDED: 'QUIZ_ENDED',
    SET_QUIZ_CONTEXT: 'SET_QUIZ_CONTEXT',
    SET_ACTIVE_FILTERS: 'SET_ACTIVE_FILTERS',
    SET_RESUMABLE_SESSION: 'SET_RESUMABLE_SESSION', // <-- NOVO
    CLEAR_RESUMABLE_SESSION: 'CLEAR_RESUMABLE_SESSION', // <-- NOVO
    
    // Ações de Navegação e Resposta
    ANSWER_QUESTION: 'ANSWER_QUESTION',
    SKIP_QUESTION: 'SKIP_QUESTION',
    GO_TO_QUESTION: 'GO_TO_QUESTION',
    GO_TO_NEXT_QUESTION: 'GO_TO_NEXT_QUESTION',
    GO_TO_PREVIOUS_QUESTION: 'GO_TO_PREVIOUS_QUESTION',

    // Ações de Perguntas e Favoritos
    UPDATE_FAVORITE_STATUS: 'UPDATE_FAVORITE_STATUS',
    LOAD_FAVORITES_REQUEST: 'LOAD_FAVORITES_REQUEST',
    LOAD_FAVORITES_SUCCESS: 'LOAD_FAVORITES_SUCCESS',
    LOAD_FAVORITES_FAILURE: 'LOAD_FAVORITES_FAILURE',
    
    // Ações de Dados Gerais
    SET_INITIAL_DATA: 'SET_INITIAL_DATA',

    // Ações do Usuário
    UPDATE_USER_STATS: 'UPDATE_USER_STATS',

    // Ações do Timer
    START_TIMER: 'START_TIMER',
    STOP_TIMER: 'STOP_TIMER',
    TICK_TIMER: 'TICK_TIMER',
    RESET_TIMER: 'RESET_TIMER',

    // Ações de UI
    SET_ACTIVE_SECTION: 'SET_ACTIVE_SECTION',
    SET_ACCOUNT_PAGE_TAB: 'SET_ACCOUNT_PAGE_TAB',
    UI_READY: 'UI_READY',

    // Ações do Painel de Filtro
    FETCH_FILTERED_COUNT_REQUEST: 'FETCH_FILTERED_COUNT_REQUEST',
    FETCH_FILTERED_COUNT_SUCCESS: 'FETCH_FILTERED_COUNT_SUCCESS',
    FETCH_FILTERED_COUNT_FAILURE: 'FETCH_FILTERED_COUNT_FAILURE',
    UPDATE_FILTER_SELECTIONS: 'UPDATE_FILTER_SELECTIONS',

    // Ações de Estatísticas
    FETCH_STATS_REQUEST: 'FETCH_STATS_REQUEST',
    FETCH_STATS_SUCCESS: 'FETCH_STATS_SUCCESS',
    FETCH_STATS_FAILURE: 'FETCH_STATS_FAILURE',
};


/*
 * Action Creators: funções que retornam objetos de ação.
 */
export const quizActions = {
    initializeQuiz: (questions, mode, sessionId, quizDefId, quizDefinitionName) => ({
        type: ActionTypes.INITIALIZE_QUIZ,
        payload: { questions, mode, sessionId, quizDefId, quizDefinitionName }
    }),
    
    rehydrateSession: (resumeData) => ({
        type: ActionTypes.REHYDRATE_SESSION,
        payload: { resumeData }
    }),

    resetQuiz: () => ({
        type: ActionTypes.RESET_QUIZ
    }),
    
    answerQuestion: (selectedOptionId, isCorrect) => ({
        type: ActionTypes.ANSWER_QUESTION,
        payload: { selectedOptionId, isCorrect }
    }),

    updateUserStats: (pontos, acertos, erros) => ({
        type: ActionTypes.UPDATE_USER_STATS,
        payload: { pontos, acertos, erros }
    }),

    setActiveSection: (section) => ({
        type: ActionTypes.SET_ACTIVE_SECTION,
        payload: { section }
    }),
    
    setAccountPageTab: (tabId) => ({
        type: ActionTypes.SET_ACCOUNT_PAGE_TAB,
        payload: { tabId }
    }),

    loadFavoritesRequest: () => ({
        type: ActionTypes.LOAD_FAVORITES_REQUEST
    }),

    loadFavoritesSuccess: (favoriteQuestions) => ({
        type: ActionTypes.LOAD_FAVORITES_SUCCESS,
        payload: { favoriteQuestions }
    }),

    loadFavoritesFailure: (error) => ({
        type: ActionTypes.LOAD_FAVORITES_FAILURE,
        payload: { error }
    }),

    fetchFilteredCountRequest: (filters) => ({
        type: ActionTypes.FETCH_FILTERED_COUNT_REQUEST,
        payload: { filters }
    }),

    fetchFilteredCountSuccess: (count) => ({
        type: ActionTypes.FETCH_FILTERED_COUNT_SUCCESS,
        payload: { count }
    }),

    fetchFilteredCountFailure: (error) => ({
        type: ActionTypes.FETCH_FILTERED_COUNT_FAILURE,
        payload: { error }
    }),
    
    updateFilterSelections: (selections) => ({
        type: ActionTypes.UPDATE_FILTER_SELECTIONS,
        payload: { selections }
    }),

    fetchStatsRequest: () => ({
        type: ActionTypes.FETCH_STATS_REQUEST
    }),

    fetchStatsSuccess: (data) => ({
        type: ActionTypes.FETCH_STATS_SUCCESS,
        payload: { data }
    }),

    fetchStatsFailure: (error) => ({
        type: ActionTypes.FETCH_STATS_FAILURE,
        payload: { error }
    }),
};