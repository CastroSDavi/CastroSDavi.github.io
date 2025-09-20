// Arquivo Completo: assets/js/app/flux/ActionOrchestrator.js

import { quizActions, ActionTypes } from './actions.js';
import { getFriendlyErrorMessage, isAnswerCorrect } from './businessLogic.js';

export default class ActionOrchestrator {
    constructor(store, ui, apiService) {
        this.store = store;
        this.ui = ui;
        this.apiService = apiService;
        this.isFetching = false;
        
        this.timerIntervalId = null;
    }

    // --- MÉTODOS DE CONTROLE DO TIMER ---
    startTimer(initialSeconds = 0) {
        if (this.timerIntervalId) {
            this.stopTimer();
        }
        
        this.store.dispatch({ type: ActionTypes.START_TIMER, payload: { initialSeconds } });

        this.timerIntervalId = setInterval(() => {
            this.store.dispatch({ type: ActionTypes.TICK_TIMER });
        }, 1000);
    }

    stopTimer() {
        if (this.timerIntervalId) {
            clearInterval(this.timerIntervalId);
            this.timerIntervalId = null;
            this.store.dispatch({ type: ActionTypes.STOP_TIMER });
        }
    }

    // --- MÉTODOS DE INICIALIZAÇÃO E FLUXO ---
    async loadInitialSummary() {
        const state = this.store.getState();
        if (state.geral.isHomeSummaryLoaded) {
            return true;
        }

        try {
            const summary = await this.apiService.fetchAppSummary();
            if (summary && summary.status === 'success') {
                this.store.dispatch(quizActions.setGeneralSummary({
                    totalQuestions: summary.total_questions,
                    categories: summary.categories,
                    totalCategories: summary.total_categories,
                    quickQuizDefaultCount: summary.quick_quiz_default_count,
                }));
                return true;
            }
        } catch (error) {
            console.error('ActionOrchestrator: erro ao carregar resumo inicial.', error);
        }
        return false;
    }

    async initializeAppData() {
        const state = this.store.getState();
        if (state.geral.isInitialDataLoaded) return true;

        try {
            const data = await this.apiService.fetchQuizData({});
            if (data && data.perguntas && data.categorias) {
                this.store.dispatch({
                    type: ActionTypes.SET_INITIAL_DATA,
                    payload: {
                        perguntas: data.perguntas,
                        categorias: data.categorias,
                        quizDefinitionName: data.quiz_definition_name,
                    }
                });
                return true;
            }
            throw new Error("Dados iniciais recebidos em formato inválido.");
        } catch (error) {
            console.error("ActionOrchestrator: Erro crítico ao buscar dados iniciais.", error);
            throw error;
        }
    }

    async initializeQuizPage() {
        const state = this.store.getState();
        const isUserAuth = this.ui.userIsAuthenticated;

        if (isUserAuth && !state.quiz.currentSessionId) {
            await this.tryResumeSession();
        }
    }

    async tryResumeSession() {
        try {
            const resumeData = await this.apiService.resumeQuizSession();
            this.ui.showSessionLoadingIndicator(false);

            if (resumeData && resumeData.status === 'success' && resumeData.perguntas?.length > 0) {
                this.store.dispatch({
                    type: ActionTypes.SET_RESUMABLE_SESSION,
                    payload: resumeData
                });
            } else {
                this.ui.challengeHubInstance?.showHub();
            }
        } catch (error) {
            this.ui.showSessionLoadingIndicator(false);
            if (error.data && error.data.status === 'not_found') {
                this.ui.challengeHubInstance?.showHub();
            } else {
                this.ui.showWarning(getFriendlyErrorMessage(error, "Não foi possível verificar sua sessão anterior."), 'error');
            }
        }
    }

    _proceedWithResumedSession() {
        const { resumableSession } = this.store.getState().quiz;
        if (!resumableSession) return;
        
        this.store.dispatch(
            quizActions.updateUserStats(
                resumableSession.pontuacao_atual,
                resumableSession.total_acertos_atual,
                resumableSession.total_erros_atual
            )
        );
        
        this.store.dispatch(quizActions.rehydrateSession(resumableSession));
        
        let elapsedSeconds = 0;
        if (resumableSession.data_inicio_sessao_iso) {
            const startTime = new Date(resumableSession.data_inicio_sessao_iso).getTime();
            const now = new Date().getTime();
            elapsedSeconds = Math.floor((now - startTime) / 1000);
        }
        this.startTimer(elapsedSeconds);
    }

    async _discardAndGoToHub() {
        const { resumableSession } = this.store.getState().quiz;
        if (!resumableSession) return;

        try {
            await this.apiService.endQuizSession({ session_id: resumableSession.session_id, tempo_total_segundos: 0 });
        } catch (error) {
            console.warn("ActionOrchestrator: Erro ao descartar sessão no backend:", error);
        }
        this.store.dispatch({ type: ActionTypes.CLEAR_RESUMABLE_SESSION });
        this.store.dispatch(quizActions.resetQuiz());
    }

    async _fetchAndInitiateQuiz(filterParams) {
        if (this.isFetching) return;
        this.isFetching = true;
        this.ui.showSessionLoadingIndicator(true, "Preparando novo desafio...");
        
        try {
            const resumableSession = this.store.getState().quiz.resumableSession;
            if (resumableSession && resumableSession.session_id) {
                await this.apiService.endQuizSession({ session_id: resumableSession.session_id, tempo_total_segundos: 0 });
                this.store.dispatch({ type: ActionTypes.CLEAR_RESUMABLE_SESSION });
            }
            
            this.ui.showSessionLoadingIndicator(true, "Carregando questões...");

            const data = await this.apiService.fetchQuizData(filterParams);
            const questionsArray = data?.perguntas || [];

            if (questionsArray.length === 0) {
                this.ui.showWarning("Nenhuma questão encontrada para os filtros selecionados.", 'info', true);
                this.store.dispatch(quizActions.resetQuiz());
                return;
            }

            const sessionPayload = {
                modo_quiz: filterParams.mode,
                question_ids_in_session: questionsArray.map(q => q.id_pergunta),
                quiz_definicao_id: filterParams.quiz_definicao_id,
                categoria_ids: filterParams.category_ids,
                dificuldades_selecionadas: filterParams.difficulty_levels,
                num_questoes_solicitadas: filterParams.num_questions,
            };

            const session = await this.apiService.startQuizSession(sessionPayload);
            if (session && session.status === 'success') {
                this.store.dispatch(
                    quizActions.initializeQuiz(
                        questionsArray,
                        filterParams.mode,
                        session.session_id,
                        filterParams.quiz_definicao_id,
                        data.quiz_definition_name
                    )
                );
                this.startTimer();
            } else {
                 this.ui.showWarning(session.message || "Não foi possível iniciar uma nova sessão de quiz.", 'error', true);
            }

        } catch (error) {
            this.ui.showWarning(getFriendlyErrorMessage(error, "Erro ao carregar perguntas."), 'error', true);
        } finally {
            this.isFetching = false;
            this.ui.showSessionLoadingIndicator(false);
        }
    }
    
    async fetchStatistics(period) {
        this.store.dispatch(quizActions.fetchStatsRequest());
        try {
            const statsData = await this.apiService.fetchUserStatistics(period);
            if (statsData && statsData.status === 'success') {
                this.store.dispatch(quizActions.fetchStatsSuccess(statsData));
            } else {
                throw new Error(statsData.message || 'Falha ao carregar estatísticas.');
            }
        } catch (error) {
            const friendlyError = getFriendlyErrorMessage(error, "Não foi possível carregar as estatísticas.");
            this.store.dispatch(quizActions.fetchStatsFailure(friendlyError));
        }
    }

    async fetchUserQuestionHistory(params = {}, absoluteUrl = null) {
        return this.apiService.fetchUserQuestionHistory(params, absoluteUrl);
    }

    async fetchFilteredQuestionCount(filterParams) {
        this.store.dispatch(quizActions.fetchFilteredCountRequest());
        try {
            const data = await this.apiService.fetchFilteredQuestionCount({
                category_ids: filterParams.category_ids,
                difficulty_levels: filterParams.difficulty_levels,
                search_query: filterParams.search_query,
            });
            const count = data?.count ?? 0;
            this.store.dispatch(quizActions.fetchFilteredCountSuccess(count));
        } catch (error) {
            const friendlyError = getFriendlyErrorMessage(error, "Erro ao buscar contagem.");
            this.store.dispatch(quizActions.fetchFilteredCountFailure(friendlyError));
        }
    }

    async applyFiltersAndStartQuiz() {
        const params = {
            category_ids: this.ui.filterPanelInstance.getSelectedCategories(),
            difficulty_levels: this.ui.filterPanelInstance.getSelectedDifficulties(),
            num_questions: this.ui.filterPanelInstance.getSelectedNumberOfQuestions(),
            search_query: this.ui.filterPanelInstance.getSearchQuery(),
            mode: 'Por Categoria'
        };
        this.ui.modalManager.toggleFilterPanel(false);
        await this._fetchAndInitiateQuiz(params);
    }

    async startQuickQuiz() {
        await this._fetchAndInitiateQuiz({ mode: 'Rápido' });
    }

    async startPredefinedQuiz(quizDefinicaoId) {
        await this._fetchAndInitiateQuiz({ quiz_definicao_id: quizDefinicaoId, mode: 'Definido' });
    }

    async answerQuestion(selectedOptionId) {
        const state = this.store.getState().quiz;
        const question = state.currentQuestionsSet[state.currentQuestionIndex];

        if (!question || question.respostaDadaId !== undefined) return;

        const correct = isAnswerCorrect(question, selectedOptionId);
        if (correct === null) return;
        
        this.store.dispatch(quizActions.answerQuestion(selectedOptionId, correct));

        if (!state.currentSessionId) {
            return;
        }

        try {
            const response = await this.apiService.registerAnswer({
                session_id: state.currentSessionId,
                pergunta_id: question.id_pergunta,
                opcao_id: selectedOptionId,
                current_question_index: state.currentQuestionIndex
            });

            this.store.dispatch(
                quizActions.updateUserStats(
                    response.pontuacao_sessao,
                    response.total_acertos_sessao,
                    response.total_erros_sessao
                )
            );
        } catch (error) {
            this.ui.showWarning(getFriendlyErrorMessage(error, "Erro ao salvar resposta."), 'error');
        }
    }

    async handleNavigation(directionOrIndex) {
        const state = this.store.getState().quiz;
        const question = state.currentQuestionsSet[state.currentQuestionIndex];

        if (question && question.respostaDadaId === undefined) {
            this.store.dispatch({ type: ActionTypes.SKIP_QUESTION });
            if (state.currentSessionId) {
                try {
                    await this.apiService.registerAnswer({
                        session_id: state.currentSessionId,
                        pergunta_id: question.id_pergunta,
                        opcao_id: null,
                        current_question_index: state.currentQuestionIndex
                    });
                } catch (err) {
                    console.warn("ActionOrchestrator: Erro ao registrar pulo de questão:", err);
                }
            }
        }

        let action;
        if (typeof directionOrIndex === 'string') {
            action = directionOrIndex === 'next' 
                ? { type: ActionTypes.GO_TO_NEXT_QUESTION } 
                : { type: ActionTypes.GO_TO_PREVIOUS_QUESTION };
        } else if (typeof directionOrIndex === 'number') {
            action = { type: ActionTypes.GO_TO_QUESTION, payload: { index: directionOrIndex } };
        }
        
        if (action) {
            this.store.dispatch(action);
        }

        const newState = this.store.getState().quiz;
        const isQuizOver = newState.currentQuestionsSet.length > 0 && newState.currentQuestionIndex >= newState.currentQuestionsSet.length;
        
        if (isQuizOver) {
            this.endQuiz();
        }
    }

    async endQuiz(forceByUser = false) {
        const state = this.store.getState();
        const sessionId = state.quiz.currentSessionId;
        if (!sessionId) return;

        this.stopTimer();
        if (forceByUser) {
            this.ui.modalManager.toggleConfirmModal(false);
        }

        try {
            const responseData = await this.apiService.endQuizSession({
                session_id: sessionId,
                tempo_total_segundos: state.timer.seconds,
            });
            
            this.store.dispatch(
                quizActions.updateUserStats(
                    responseData.pontuacao_final,
                    responseData.total_acertos, 
                    responseData.total_erros
                )
            );
        } catch (error) {
             console.error("ActionOrchestrator: ERRO ao finalizar sessão:", error);
             this.ui.showWarning(getFriendlyErrorMessage(error, "Erro ao finalizar sessão."), 'warning');
        } finally {
            this.store.dispatch({ type: ActionTypes.QUIZ_ENDED }); 
        }
    }

    restartQuiz() {
        this.stopTimer();
        this.store.dispatch(quizActions.resetQuiz());
    }

    async forceEndQuizByUser() {
        await this.endQuiz(true);
    }

    async toggleFavoriteCurrentQuestion() {
        const state = this.store.getState().quiz;
        const question = state.currentQuestionsSet[state.currentQuestionIndex];
        
        if (!question) {
             console.warn("ActionOrchestrator: Tentativa de favoritar sem questão atual.");
             return;
        }
        if (!this.ui.userIsAuthenticated) {
            this.ui.showWarning("Faça login para favoritar questões.", 'info');
            return;
        }

        const btnFav = this.ui.elements.btnToggleFavorite;
        if (btnFav) {
            btnFav.disabled = true;
            btnFav.setAttribute('aria-disabled', 'true');
        }

        try {
            const response = await this.apiService.toggleFavoriteStatus(question.id_pergunta);
            if (response && response.status === 'success') {
                this.store.dispatch({ 
                    type: ActionTypes.UPDATE_FAVORITE_STATUS, 
                    payload: { isFavorited: response.is_favorited } 
                });
            } else {
                this.ui.showWarning(getFriendlyErrorMessage({ data: response }, "Falha ao favoritar."), 'error');
            }
        } catch (error) {
            this.ui.showWarning(getFriendlyErrorMessage(error, "Erro de conexão ao favoritar."), 'error');
        } finally {
            if (btnFav) {
                btnFav.disabled = false;
                btnFav.removeAttribute('aria-disabled');
            }
        }
    }

    async loadAndDisplayFavoriteQuestionsForAccountPage() {
        this.store.dispatch(quizActions.loadFavoritesRequest());
        try {
            const response = await this.apiService.getFavoriteQuestions();
            if (response && response.status === 'success') {
                this.store.dispatch(quizActions.loadFavoritesSuccess(response.favorite_questions));
            } else {
                throw new Error(response.message || 'Falha ao carregar favoritos.');
            }
        } catch (error) {
            this.store.dispatch(quizActions.loadFavoritesFailure(error.message));
        }
    }

    async reviewFavoriteQuestion(questionId, cachedQuestionData = null, options = {}) {
        const normalizedId = Number.parseInt(questionId, 10);
        if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
            return false;
        }

        const forceUseCache = options?.forceUseCache === true;

        const initializeQuizWithQuestion = question => {
            if (!question) {
                return false;
            }

            const questionPayload = { ...question };
            if (typeof questionPayload.is_favorited === 'undefined') {
                questionPayload.is_favorited = true;
            }

            this.store.dispatch(quizActions.setActiveSection('questions'));
            this.store.dispatch(
                quizActions.initializeQuiz(
                    [questionPayload],
                    'Revisão',
                    null,
                    null,
                    'Questão Favorita'
                )
            );
            return true;
        };

        const useCachedQuestion = (message = null, messageType = 'warning') => {
            if (!cachedQuestionData) {
                return false;
            }

            const initialized = initializeQuizWithQuestion(cachedQuestionData);
            if (initialized && message) {
                this.ui.showWarning(message, messageType);
            }
            return initialized;
        };

        this.stopTimer();

        if (forceUseCache) {
            if (useCachedQuestion(
                'Esta questão não está mais disponível no banco atual. Exibindo dados salvos da sua lista de favoritos.',
                'warning'
            )) {
                return true;
            }

            this.ui.showWarning('Não foi possível carregar a questão favorita.', 'error');
            return false;
        }

        this.ui.showSessionLoadingIndicator(true, "Carregando questão favorita...");
        try {
            const response = await this.apiService.getQuestionDetail(normalizedId);
            if (response && response.status === 'success' && response.question) {
                initializeQuizWithQuestion(response.question);
                if (response.message) {
                    const messageType = typeof response.message_type === 'string' ? response.message_type : 'info';
                    this.ui.showWarning(response.message, messageType);
                }
                return true;
            }

            if (useCachedQuestion(response?.message || 'Não foi possível carregar a versão mais recente da questão. Exibindo dados salvos.')) {
                return true;
            }

            this.ui.showWarning(response?.message || 'Não foi possível carregar a questão favorita.', 'error');
            return false;
        } catch (error) {
            if (error?.response?.status === 404 && useCachedQuestion('Questão não encontrada no banco atual. Exibindo dados salvos da sua lista de favoritos.')) {
                return true;
            }

            this.ui.showWarning(getFriendlyErrorMessage(error, 'Erro ao carregar questão favorita.'), 'error');
            return false;
        } finally {
            this.ui.showSessionLoadingIndicator(false);
        }
    }
}
