// Arquivo Completo: assets/js/app/flux/reducer.js

import { ActionTypes } from './actions.js';
import { QUICK_QUIZ_COUNT } from '../../utils/constants.js';

const initialState = {
    geral: {
        allCategories: [],
        totalQuestionsAvailable: 0,
        isInitialDataLoaded: false,
        lastFetchedQuizDefinitionName: null,
        homeSummary: {
            totalCategories: 0,
            quickQuizDefaultCount: QUICK_QUIZ_COUNT,
        },
        isHomeSummaryLoaded: false,
    },
    quiz: {
        currentQuestionsSet: [],
        currentQuestionIndex: -1, 
        isInitialQuestionLoad: true,
        resumableSession: null, 
        currentSessionId: null,
        currentQuizMode: null,
        currentQuizDefinicaoId: null,
        quizDisplayContext: { displayMode: 'none', mainQuizTitle: '' },
        activeFiltersForCurrentSet: {
            category_ids: [],
            difficulty_levels: ['all'],
            num_questions: null,
        },
        quizEnded: false,
    },
    timer: {
        isRunning: false,
        seconds: 0,
    },
    user: {
        pontos: 0,
        acertos: 0,
        erros: 0,
        favorites: {
            isLoading: false,
            items: [],
            error: null,
            hasBeenFetched: false,
        },
    },
    ui: {
        activeSection: 'home',
        accountPageActiveTab: 'profile-info-content',
        filterPanel: { 
            isLoadingCount: false,
            filteredQuestionsCount: null,
            countError: null,
        },
        uiReady: false, 
    },
    statistics: { 
        isLoading: false,
        data: null,
        error: null,
    }
};

export function quizReducer(state = initialState, action) {
    switch (action.type) {

        case '@@INIT':
            return state;

        case ActionTypes.UI_READY:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    uiReady: true
                }
            };
        
        // --- AÇÕES DE UI ---
        case ActionTypes.SET_ACTIVE_SECTION:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    activeSection: action.payload.section,
                }
            };

        case ActionTypes.SET_ACCOUNT_PAGE_TAB:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    accountPageActiveTab: action.payload.tabId,
                }
            };
            
        // --- AÇÕES DO PAINEL DE FILTRO ---
        case ActionTypes.FETCH_FILTERED_COUNT_REQUEST:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    filterPanel: {
                        ...state.ui.filterPanel,
                        isLoadingCount: true,
                        countError: null,
                    }
                }
            };
        
        case ActionTypes.FETCH_FILTERED_COUNT_SUCCESS:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    filterPanel: {
                        ...state.ui.filterPanel,
                        isLoadingCount: false,
                        filteredQuestionsCount: action.payload.count,
                    }
                }
            };

        case ActionTypes.FETCH_FILTERED_COUNT_FAILURE:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    filterPanel: {
                        ...state.ui.filterPanel,
                        isLoadingCount: false,
                        countError: action.payload.error,
                    }
                }
            };
        
        // --- AÇÕES DE ESTATÍSTICAS ---
        case ActionTypes.FETCH_STATS_REQUEST:
            return {
                ...state,
                statistics: {
                    ...state.statistics,
                    isLoading: true,
                    error: null
                }
            };

        case ActionTypes.FETCH_STATS_SUCCESS:
            return {
                ...state,
                statistics: {
                    isLoading: false,
                    data: action.payload.data,
                    error: null
                }
            };

        case ActionTypes.FETCH_STATS_FAILURE:
            return {
                ...state,
                statistics: {
                    ...state.statistics,
                    isLoading: false,
                    error: action.payload.error
                }
            };

        // --- AÇÕES GERAIS ---
        case ActionTypes.SET_GENERAL_SUMMARY: {
            const {
                totalQuestions,
                categories,
                totalCategories,
                quickQuizDefaultCount,
            } = action.payload;

            const sanitizedCategories = Array.isArray(categories) ? categories : state.geral.allCategories;
            const sanitizedTotalQuestions = typeof totalQuestions === 'number' && totalQuestions >= 0
                ? totalQuestions
                : state.geral.totalQuestionsAvailable;
            const sanitizedTotalCategories = typeof totalCategories === 'number' && totalCategories >= 0
                ? totalCategories
                : sanitizedCategories.length;
            const sanitizedQuickQuiz = typeof quickQuizDefaultCount === 'number' && quickQuizDefaultCount > 0
                ? quickQuizDefaultCount
                : state.geral.homeSummary.quickQuizDefaultCount;

            return {
                ...state,
                geral: {
                    ...state.geral,
                    totalQuestionsAvailable: sanitizedTotalQuestions,
                    allCategories: sanitizedCategories,
                    homeSummary: {
                        totalCategories: sanitizedTotalCategories,
                        quickQuizDefaultCount: sanitizedQuickQuiz,
                    },
                    isHomeSummaryLoaded: true,
                }
            };
        }

        case ActionTypes.SET_INITIAL_DATA: {
            const { perguntas, categorias, quizDefinitionName } = action.payload;
            return {
                ...state,
                geral: {
                    ...state.geral,
                    allCategories: categorias || [],
                    totalQuestionsAvailable: perguntas?.length || 0,
                    isInitialDataLoaded: true,
                    lastFetchedQuizDefinitionName: quizDefinitionName || null,
                    homeSummary: {
                        ...state.geral.homeSummary,
                        totalCategories: categorias?.length || state.geral.homeSummary.totalCategories,
                    },
                    isHomeSummaryLoaded: true,
                }
            };
        }
            
        // --- AÇÕES DO USUÁRIO ---
        case ActionTypes.UPDATE_USER_STATS:
            return {
                ...state,
                user: {
                    ...state.user,
                    pontos: action.payload.pontos,
                    acertos: action.payload.acertos,
                    erros: action.payload.erros,
                }
            };
            
        // --- AÇÕES DE FAVORITOS (DENTRO DO 'user') ---
        case ActionTypes.LOAD_FAVORITES_REQUEST:
            return {
                ...state,
                user: { ...state.user, favorites: { ...state.user.favorites, isLoading: true, error: null } }
            };

        case ActionTypes.LOAD_FAVORITES_SUCCESS:
            return {
                ...state,
                user: { ...state.user, favorites: { isLoading: false, items: action.payload.favoriteQuestions, error: null, hasBeenFetched: true } }
            };
        
        case ActionTypes.LOAD_FAVORITES_FAILURE:
            return {
                ...state,
                user: { ...state.user, favorites: { ...state.user.favorites, isLoading: false, error: action.payload.error, hasBeenFetched: true } }
            };

        // --- AÇÕES DO TIMER ---
        case ActionTypes.START_TIMER:
            return { ...state, timer: { ...state.timer, isRunning: true, seconds: action.payload.initialSeconds || 0 } };

        case ActionTypes.STOP_TIMER:
            return { ...state, timer: { ...state.timer, isRunning: false } };

        case ActionTypes.TICK_TIMER:
            if (!state.timer.isRunning) return state;
            return { ...state, timer: { ...state.timer, seconds: state.timer.seconds + 1 } };
            
        case ActionTypes.RESET_TIMER:
            return { ...state, timer: { ...initialState.timer } };
            
        // --- AÇÕES DO QUIZ ---
        case ActionTypes.SET_RESUMABLE_SESSION:
            return {
                ...state,
                quiz: {
                    ...state.quiz,
                    // --- INÍCIO DA CORREÇÃO ---
                    resumableSession: action.payload,
                    // --- FIM DA CORREÇÃO ---
                }
            };
        
        case ActionTypes.CLEAR_RESUMABLE_SESSION:
            return {
                ...state,
                quiz: {
                    ...state.quiz,
                    resumableSession: null,
                }
            };
            
        case ActionTypes.INITIALIZE_QUIZ: {
            const { questions, mode, sessionId, quizDefId, quizDefinitionName } = action.payload;
            
            let displayMode = 'challenge';
            let mainQuizTitle = 'Desafio Personalizado';
            if (mode === 'Definido' && quizDefinitionName) {
                displayMode = 'focused';
                mainQuizTitle = quizDefinitionName;
            } else if (mode === 'Rápido') {
                mainQuizTitle = 'Quiz Rápido';
            } else if (mode === 'Revisão') {
                displayMode = 'review';
                mainQuizTitle = quizDefinitionName || 'Questão Favorita';
            }

            const newQuizState = {
                ...initialState.quiz,
                currentQuestionIndex: 0,
                isInitialQuestionLoad: true,
                currentQuestionsSet: questions.map(q => ({ ...q, respostaDadaId: undefined, foiCorretaNaSessao: undefined, foiPulada: undefined })),
                currentSessionId: sessionId,
                currentQuizMode: mode,
                currentQuizDefinicaoId: quizDefId,
                quizDisplayContext: { displayMode, mainQuizTitle },
                resumableSession: null,
            };
            return { ...state, user: { ...initialState.user }, timer: { ...initialState.timer }, quiz: newQuizState };
        }

        case ActionTypes.REHYDRATE_SESSION: {
            const { resumeData } = action.payload;
            let displayMode = 'challenge';
            let mainQuizTitle = 'Desafio Personalizado';
            if (resumeData.modo_quiz === 'Definido' && resumeData.quiz_definition_name) {
                displayMode = 'focused';
                mainQuizTitle = resumeData.quiz_definition_name;
            } else if (resumeData.modo_quiz === 'Rápido') {
                mainQuizTitle = 'Quiz Rápido';
            }
            const rehydratedQuizState = {
                ...state.quiz,
                currentSessionId: resumeData.session_id,
                currentQuizMode: resumeData.modo_quiz,
                currentQuizDefinicaoId: resumeData.id_quiz_definicao,
                quizDisplayContext: { displayMode, mainQuizTitle },
                currentQuestionsSet: resumeData.perguntas.map(q => { const r = resumeData.respostas_dadas ? resumeData.respostas_dadas[q.id_pergunta] : null; return { ...q, respostaDadaId: r ? r.opcao_selecionada_id : undefined, foiCorretaNaSessao: r ? r.foi_correta : undefined, foiPulada: r && r.opcao_selecionada_id === null ? true : undefined }; }),
                currentQuestionIndex: resumeData.indice_ultima_pergunta_vista ?? 0,
                isInitialQuestionLoad: false,
                quizEnded: false,
                resumableSession: null,
            };
            return { ...state, quiz: rehydratedQuizState };
        }

        case ActionTypes.RESET_QUIZ: {
            return { ...state, quiz: { ...initialState.quiz }, timer: { ...initialState.timer }, user: { ...initialState.user } };
        }

        case ActionTypes.QUIZ_ENDED: {
            return { ...state, quiz: { ...state.quiz, quizEnded: true, currentSessionId: null, resumableSession: null } };
        }

        case ActionTypes.ANSWER_QUESTION: {
            const newQuestionsSet = state.quiz.currentQuestionsSet.map((question, index) => {
                if (index === state.quiz.currentQuestionIndex) {
                    return { ...question, respostaDadaId: action.payload.selectedOptionId, foiCorretaNaSessao: action.payload.isCorrect, foiPulada: false };
                }
                return question;
            });
            return { ...state, quiz: { ...state.quiz, currentQuestionsSet: newQuestionsSet } };
        }

        case ActionTypes.SKIP_QUESTION: {
            const newQuestionsSet = state.quiz.currentQuestionsSet.map((question, index) => {
                if (index === state.quiz.currentQuestionIndex) {
                    return { ...question, foiPulada: true, respostaDadaId: null };
                }
                return question;
            });
            return { ...state, quiz: { ...state.quiz, currentQuestionsSet: newQuestionsSet } };
        }
        
        case ActionTypes.UPDATE_FAVORITE_STATUS: {
             const newQuestionsSet = state.quiz.currentQuestionsSet.map((question, index) => {
                if (index === state.quiz.currentQuestionIndex) {
                    return { ...question, is_favorited: action.payload.isFavorited };
                }
                return question;
            });
            return { ...state, quiz: { ...state.quiz, currentQuestionsSet: newQuestionsSet } };
        }

        case ActionTypes.GO_TO_QUESTION:
            if (action.payload.index >= 0 && action.payload.index < state.quiz.currentQuestionsSet.length) {
                return { ...state, quiz: { ...state.quiz, currentQuestionIndex: action.payload.index, isInitialQuestionLoad: false } };
            }
            return state;

        case ActionTypes.GO_TO_NEXT_QUESTION:
            if (state.quiz.currentQuestionIndex < state.quiz.currentQuestionsSet.length) {
                return { ...state, quiz: { ...state.quiz, currentQuestionIndex: state.quiz.currentQuestionIndex + 1, isInitialQuestionLoad: false } };
            }
            return state;
        
        case ActionTypes.GO_TO_PREVIOUS_QUESTION:
            if (state.quiz.currentQuestionIndex > 0) {
                return { ...state, quiz: { ...state.quiz, currentQuestionIndex: state.quiz.currentQuestionIndex - 1, isInitialQuestionLoad: false } };
            }
            return state;

        default:
            return state;
    }
}