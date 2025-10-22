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
        this.isAutoEndingByTimer = false;


        this.lastQuizRequest = null;
        this._restoreLastQuizRequest();

        this.preloadedHubSummary = null;
    }

    // --- METODOS DE CONTROLE DO TIMER ---
    _coerceBoolean(value, fallback = false) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['true', '1', 'yes', 'on', 'sim'].includes(normalized)) {
                return true;
            }
            if (['false', '0', 'no', 'off', 'nao'].includes(normalized)) {
                return false;
            }
        }
        return fallback;
    }

    _resolveTimerConfiguration(scorePanelSettings, fallback = null) {
        const defaults = fallback || {
            mode: 'countup',
            durationSeconds: null,
            autoFinalize: true,
        };

        if (!scorePanelSettings || typeof scorePanelSettings !== 'object') {
            return { ...defaults };
        }

        const nested = typeof scorePanelSettings.timer_config === 'object'
            ? scorePanelSettings.timer_config
            : {};

        const rawMode = (nested.mode ?? scorePanelSettings.timer_mode ?? scorePanelSettings.timerMode ?? defaults.mode);
        const normalizedMode = typeof rawMode === 'string' && rawMode.trim().toLowerCase() === 'countdown'
            ? 'countdown'
            : 'countup';

        const rawDuration = nested.duration_seconds
            ?? scorePanelSettings.timer_duration_seconds
            ?? scorePanelSettings.timer_limit_seconds
            ?? scorePanelSettings.duration_seconds
            ?? null;

        let durationSeconds = null;
        if (rawDuration !== null && rawDuration !== '' && rawDuration !== undefined) {
            const parsedDuration = Number(rawDuration);
            if (Number.isFinite(parsedDuration)) {
                durationSeconds = Math.max(0, Math.floor(parsedDuration));
            }
        }

        const rawAutoFinalize = nested.auto_finalize
            ?? scorePanelSettings.timer_auto_finalize
            ?? scorePanelSettings.auto_finalize_on_timeout
            ?? defaults.autoFinalize;

        return {
            mode: normalizedMode,
            durationSeconds,
            autoFinalize: this._coerceBoolean(rawAutoFinalize, defaults.autoFinalize),
        };
    }

    _normalizeTimerStartPayload(rawOptions = null) {
        const state = this.store?.getState?.() || {};
        const quizConfig = state.quiz?.timerConfig || this._resolveTimerConfiguration(state.quiz?.scorePanelSettings || null);
        let mode = quizConfig?.mode === 'countdown' ? 'countdown' : 'countup';
        let durationSeconds = Number.isFinite(quizConfig?.durationSeconds)
            ? Math.max(0, Math.floor(Number(quizConfig.durationSeconds)))
            : null;
        let autoFinalize = this._coerceBoolean(quizConfig?.autoFinalize, true);

        let options;
        if (typeof rawOptions === 'number') {
            options = { elapsedSeconds: rawOptions };
        } else if (rawOptions && typeof rawOptions === 'object') {
            options = { ...rawOptions };
        } else {
            options = {};
        }

        if (typeof options.mode === 'string') {
            const normalized = options.mode.trim().toLowerCase();
            mode = normalized === 'countdown' ? 'countdown' : 'countup';
        }
        if (Number.isFinite(options.durationSeconds)) {
            durationSeconds = Math.max(0, Math.floor(Number(options.durationSeconds)));
        }
        if (Object.prototype.hasOwnProperty.call(options, 'autoFinalize')) {
            autoFinalize = this._coerceBoolean(options.autoFinalize, autoFinalize);
        }

        let elapsedSeconds = Number.isFinite(options.elapsedSeconds)
            ? Math.max(0, Math.floor(Number(options.elapsedSeconds)))
            : null;

        if (mode === 'countdown' && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
            mode = 'countup';
            durationSeconds = null;
        }

        let seconds;
        if (mode === 'countdown') {
            let remaining = options.remainingSeconds;
            if (!Number.isFinite(remaining)) {
                if (Number.isFinite(options.seconds)) {
                    remaining = options.seconds;
                } else if (Number.isFinite(options.initialSeconds)) {
                    remaining = options.initialSeconds;
                } else if (Number.isFinite(durationSeconds)) {
                    if (elapsedSeconds !== null) {
                        remaining = durationSeconds - elapsedSeconds;
                    } else if (Number.isFinite(state.timer?.elapsedSeconds)) {
                        remaining = durationSeconds - state.timer.elapsedSeconds;
                    } else {
                        remaining = durationSeconds;
                    }
                } else {
                    remaining = 0;
                }
            }
            remaining = Math.max(0, Math.floor(Number(remaining)));
            if (!Number.isFinite(remaining)) {
                remaining = 0;
            }
            seconds = remaining;
            if (elapsedSeconds === null) {
                if (Number.isFinite(durationSeconds)) {
                    elapsedSeconds = Math.max(0, durationSeconds - remaining);
                } else {
                    elapsedSeconds = 0;
                }
            }
        } else {
            if (Number.isFinite(options.seconds)) {
                seconds = Math.max(0, Math.floor(Number(options.seconds)));
            } else if (Number.isFinite(options.initialSeconds)) {
                seconds = Math.max(0, Math.floor(Number(options.initialSeconds)));
            } else if (elapsedSeconds !== null) {
                seconds = elapsedSeconds;
            } else if (Number.isFinite(state.timer?.elapsedSeconds)) {
                seconds = Math.max(0, Math.floor(Number(state.timer.elapsedSeconds)));
            } else if (Number.isFinite(state.timer?.seconds)) {
                seconds = Math.max(0, Math.floor(Number(state.timer.seconds)));
            } else {
                seconds = 0;
            }
            if (elapsedSeconds === null) {
                elapsedSeconds = seconds;
            }
            durationSeconds = null;
        }

        if (elapsedSeconds === null || !Number.isFinite(elapsedSeconds)) {
            elapsedSeconds = 0;
        }

        if (mode === 'countdown' && Number.isFinite(durationSeconds)) {
            if (elapsedSeconds > durationSeconds) {
                elapsedSeconds = durationSeconds;
            }
            seconds = Math.max(0, Math.min(seconds, durationSeconds));
        }

        return {
            seconds,
            elapsedSeconds,
            mode,
            durationSeconds,
            autoFinalize,
        };
    }

    _finalizeTimerDueTimeout(autoFinalize = true) {
        if (!autoFinalize || this.isAutoEndingByTimer) {
            return;
        }
        this.isAutoEndingByTimer = true;
        if (this.ui && typeof this.ui.showWarning === 'function') {
            this.ui.showWarning({
                body: 'O tempo terminou! O quiz foi finalizado automaticamente.',
                type: 'warning',
                icon: 'timer_off',
            });
        }
        Promise.resolve(this.endQuiz())
            .catch(error => {
                console.error('ActionOrchestrator: erro ao finalizar quiz por tempo esgotado.', error);
            })
            .finally(() => {
                this.isAutoEndingByTimer = false;
            });
    }

    startTimer(options = null) {
        if (this.timerIntervalId) {
            this.stopTimer();
        }

        this.isAutoEndingByTimer = false;

        const payload = this._normalizeTimerStartPayload(options);
        payload.autoFinalize = this._coerceBoolean(payload.autoFinalize, true);
        const autoFinalize = payload.autoFinalize;
        const isCountdownExpired = payload.mode === 'countdown' && payload.seconds <= 0;
        const shouldStartInterval = !isCountdownExpired;

        this.store.dispatch({ type: ActionTypes.START_TIMER, payload });

        if (shouldStartInterval) {
            this.timerIntervalId = setInterval(() => {
                this.store.dispatch({ type: ActionTypes.TICK_TIMER });

                const timerState = this.store.getState().timer;
                if (!timerState?.isRunning) {
                    return;
                }

                if (timerState.mode === 'countdown' && timerState.seconds <= 0) {
                    const shouldFinalize = this._coerceBoolean(timerState.autoFinalize, true);
                    this.stopTimer();
                    this._finalizeTimerDueTimeout(shouldFinalize);
                }
            }, 1000);
        } else {
            this.store.dispatch({ type: ActionTypes.STOP_TIMER });
            if (isCountdownExpired) {
                this._finalizeTimerDueTimeout(autoFinalize);
            }
        }
    }

    stopTimer() {
        if (this.timerIntervalId) {
            clearInterval(this.timerIntervalId);
            this.timerIntervalId = null;
            this.store.dispatch({ type: ActionTypes.STOP_TIMER });
        }
        this.isAutoEndingByTimer = false;
    }

    pauseTimer() {
        const state = this.store.getState();
        if (state?.timer?.isRunning) {
            this.stopTimer();
        }
    }

    resumeTimer() {
        const state = this.store.getState();
        if (!state) return;

        const quizState = state.quiz || {};
        if (quizState.quizEnded || !quizState.currentSessionId) {
            return;
        }

        if (state.timer?.isRunning) {
            return;
        }

        const timerState = state.timer || {};
        this.startTimer({
            seconds: timerState.seconds,
            elapsedSeconds: timerState.elapsedSeconds,
            mode: timerState.mode,
            durationSeconds: timerState.durationSeconds,
            autoFinalize: timerState.autoFinalize,
        });
    }
// --- MÉTODOS DE INICIALIZAÇÃO E FLUXO ---
    _getPreloadedHubSummary() {
        if (this.preloadedHubSummary) {
            return this.preloadedHubSummary;
        }

        if (typeof document === 'undefined') {
            return null;
        }

        const scriptElement = document.getElementById('challenge-hub-initial-data');
        if (!scriptElement) {
            return null;
        }

        const rawContent = scriptElement.textContent || scriptElement.innerText || '';
        if (!rawContent.trim()) {
            return null;
        }

        try {
            const parsed = JSON.parse(rawContent);
            if (parsed && typeof parsed === 'object') {
                this.preloadedHubSummary = parsed;
                return this.preloadedHubSummary;
            }
        } catch (error) {
            console.warn('ActionOrchestrator: falha ao interpretar dados iniciais do Challenge Hub.', error);
        }

        return null;
    }

    async loadInitialSummary() {
        const state = this.store.getState();
        if (state.geral.isHomeSummaryLoaded) {
            return true;
        }

        const preloadedSummary = this._getPreloadedHubSummary();
        if (preloadedSummary) {
            this.store.dispatch(quizActions.setGeneralSummary({
                totalQuestions: preloadedSummary.total_questions,
                categories: preloadedSummary.categories,
                totalCategories: preloadedSummary.total_categories,
                quickQuizDefaultCount: preloadedSummary.quick_quiz_default_count,
                predefinedQuizzes: preloadedSummary.predefined_quizzes,
            }));
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
                    predefinedQuizzes: summary.predefined_quizzes,
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
                const detail = getFriendlyErrorMessage(error, "Não foi possível verificar sua sessão anterior.");
                this.ui.showWarning({ key: 'quiz.resumeSessionError', detail });
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
                resumableSession.total_erros_atual,
                {
                    xp: resumableSession.xp_atual ?? 0,
                    currentStreak: resumableSession.sequencia_atual ?? 0,
                    bestStreak: resumableSession.melhor_sequencia ?? 0,
                    multiplier: resumableSession.multiplicador_atual ?? 1,
                }
            )
        );
        
        const timerConfig = this._resolveTimerConfiguration(resumableSession.score_panel_settings);
        this.store.dispatch(quizActions.rehydrateSession(resumableSession, timerConfig));
        
        let elapsedSeconds = 0;
        if (resumableSession.data_inicio_sessao_iso) {
            const startTime = new Date(resumableSession.data_inicio_sessao_iso).getTime();
            const now = new Date().getTime();
            elapsedSeconds = Math.floor((now - startTime) / 1000);
        }
        this.startTimer({ elapsedSeconds });
    }

    launchStandaloneQuestion(questionPayload, options = {}) {
        if (!questionPayload || typeof questionPayload !== 'object') {
            console.warn('ActionOrchestrator: payload inválido para question standalone.', questionPayload);
            return false;
        }

        const sanitizedQuestion = { ...questionPayload };
        if (Array.isArray(sanitizedQuestion.opcoes)) {
            sanitizedQuestion.opcoes = [...sanitizedQuestion.opcoes].sort((a, b) => {
                const ordemA = typeof a?.ordem_exibicao === 'number' ? a.ordem_exibicao : 0;
                const ordemB = typeof b?.ordem_exibicao === 'number' ? b.ordem_exibicao : 0;
                return ordemA - ordemB || (a?.id_opcao_resposta ?? 0) - (b?.id_opcao_resposta ?? 0);
            });
        } else {
            sanitizedQuestion.opcoes = [];
        }

        const mode = typeof options.mode === 'string' && options.mode.trim()
            ? options.mode.trim()
            : 'Standalone';
        const quizTitle =
            typeof options.quizTitle === 'string' && options.quizTitle.trim()
                ? options.quizTitle.trim()
                : (typeof sanitizedQuestion.texto_pergunta === 'string' && sanitizedQuestion.texto_pergunta.trim()
                    ? sanitizedQuestion.texto_pergunta.trim()
                    : 'Questão Avulsa');
        const scorePanelSettings = options.scorePanelSettings || null;
        const timerConfig = this._resolveTimerConfiguration(scorePanelSettings);

        this.stopTimer();
        this.lastQuizRequest = null;

        this.store.dispatch(
            quizActions.initializeQuiz(
                [sanitizedQuestion],
                mode,
                null,
                null,
                quizTitle,
                scorePanelSettings,
                timerConfig
            )
        );
        this.store.dispatch(quizActions.setActiveSection('questions'));
        this.ui.showSessionLoadingIndicator(false);

        const shouldStartTimer = !scorePanelSettings || scorePanelSettings.show_timer !== false;
        if (shouldStartTimer) {
            this.startTimer();
        } else {
            this.store.dispatch({ type: ActionTypes.RESET_TIMER });
        }

        this.ui.displayQuizLayout(true);
        this.ui.challengeHubInstance?.hideHub();
        return true;
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

    _cloneQuizRequest(filterParams = {}) {
        if (!filterParams || typeof filterParams !== 'object') {
            return {};
        }

        const cloned = { ...filterParams };

        if (Array.isArray(filterParams.category_ids)) {
            cloned.category_ids = [...filterParams.category_ids];
        }

        if (Array.isArray(filterParams.difficulty_levels)) {
            cloned.difficulty_levels = [...filterParams.difficulty_levels];
        }

        if (Array.isArray(filterParams.question_ids_in_session)) {
            cloned.question_ids_in_session = [...filterParams.question_ids_in_session];
        }

        return cloned;
    }

    _getPredefinedQuizzesFromState() {
        const state = this.store.getState();
        const items = state?.geral?.predefinedQuizzes?.items;
        return Array.isArray(items) ? items : [];
    }

    _findPredefinedQuizByGenerationType(generationType) {
        if (!generationType) {
            return null;
        }

        const normalized = generationType.toString().trim().toLowerCase();
        if (!normalized) {
            return null;
        }

        const predefined = this._getPredefinedQuizzesFromState();
        return predefined.find((item) => (
            typeof item.generation_type === 'string'
            && item.generation_type.toLowerCase() === normalized
        )) || null;
    }

    _storeLastQuizRequest(filterParams) {
        this.lastQuizRequest = this._cloneQuizRequest(filterParams);
        if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
                window.sessionStorage.setItem('medquiz:lastQuizRequest', JSON.stringify(this.lastQuizRequest));
            } catch (error) {
                console.warn('ActionOrchestrator: falha ao persistir último pedido de quiz.', error);
            }
        }
    }

    _restoreLastQuizRequest() {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return;
        }
        try {
            const stored = window.sessionStorage.getItem('medquiz:lastQuizRequest');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') {
                    this.lastQuizRequest = this._cloneQuizRequest(parsed);
                }
            }
        } catch (error) {
            console.warn('ActionOrchestrator: não foi possível restaurar o último pedido de quiz.', error);
        }
    }

    async retryLastQuizRequest() {
        if (!this.lastQuizRequest) {
            const repeatDefinition = this._findPredefinedQuizByGenerationType('repeat_last');
            if (repeatDefinition?.id) {
                await this.startPredefinedQuiz(repeatDefinition.id);
                return true;
            }

            this.ui.showWarning({
                body: 'Nenhum quiz anterior disponível para tentar novamente.',
                type: 'info',
                isTextCentered: true,
            });
            return false;
        }

        await this._fetchAndInitiateQuiz({ ...this.lastQuizRequest });
        return true;
    }

    async _fetchAndInitiateQuiz(filterParams = {}) {
        if (this.isFetching) return;
        this.isFetching = true;
        this.ui.showSessionLoadingIndicator(true, "Preparando novo desafio...");

        const requestParams = this._cloneQuizRequest(filterParams);
        this._storeLastQuizRequest(requestParams);

        try {
            const resumableSession = this.store.getState().quiz.resumableSession;
            if (resumableSession && resumableSession.session_id) {
                await this.apiService.endQuizSession({ session_id: resumableSession.session_id, tempo_total_segundos: 0 });
                this.store.dispatch({ type: ActionTypes.CLEAR_RESUMABLE_SESSION });
            }

            this.ui.showSessionLoadingIndicator(true, "Carregando questões...");

            const data = await this.apiService.fetchQuizData(requestParams);
            const questionsArray = data?.perguntas || [];

            if (questionsArray.length === 0) {
                this.ui.showWarning({ key: 'quiz.noQuestionsForFilters' });
                this.store.dispatch(quizActions.resetQuiz());
                return;
            }

            const sessionPayload = {
                modo_quiz: requestParams.mode,
                question_ids_in_session: questionsArray.map(q => q.id_pergunta),
                quiz_definicao_id: requestParams.quiz_definicao_id,
                categoria_ids: requestParams.category_ids,
                dificuldades_selecionadas: requestParams.difficulty_levels,
                num_questoes_solicitadas: requestParams.num_questions,
                study_method: data?.selected_study_method || null,
            };

            const session = await this.apiService.startQuizSession(sessionPayload);
            if (session && session.status === 'success') {
                const scorePanelSettings = session.score_panel_settings || null;
                const timerConfig = this._resolveTimerConfiguration(scorePanelSettings);
                this.store.dispatch(
                    quizActions.initializeQuiz(
                        questionsArray,
                        requestParams.mode,
                        session.session_id,
                        requestParams.quiz_definicao_id,
                        data.quiz_definition_name,
                        scorePanelSettings,
                        timerConfig
                    )
                );
                this.startTimer();
            } else {
                 this.ui.showWarning({
                    key: 'quiz.startSessionFailed',
                    detail: session?.message,
                });
            }

        } catch (error) {
            const detail = getFriendlyErrorMessage(error, "Erro ao carregar perguntas.");
            this.ui.showWarning({ key: 'quiz.loadQuestionsError', detail });
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

    async startTimedSimulation(questionCount = 40) {
        const normalized = Number.parseInt(questionCount, 10);
        const effectiveCount = Number.isInteger(normalized) && normalized > 0 ? normalized : 40;
        await this._fetchAndInitiateQuiz({ mode: 'Rápido', count: effectiveCount, num_questions: effectiveCount });
    }

    async startFavoritesReview(limit = 12) {
        if (!this.ui.userIsAuthenticated) {
            this.ui.showWarning('Entre na sua conta para revisar suas questões favoritas.');
            return false;
        }

        this.stopTimer();

        const favoritesDefinition = this._findPredefinedQuizByGenerationType('favorites');
        if (favoritesDefinition?.id) {
            this.ui.challengeHubInstance?.hideHub();
            await this.startPredefinedQuiz(favoritesDefinition.id);
            return true;
        }

        const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 12;
        let success = false;

        this.ui.showSessionLoadingIndicator(true, 'Preparando revisão de favoritos...');

        try {
            const response = await this.apiService.getFavoriteQuestions();
            const favoritesList = Array.isArray(response?.favorite_questions)
                ? response.favorite_questions
                : [];

            if (favoritesList.length === 0) {
                this.ui.showWarning('Você ainda não possui questões favoritas para revisar.');
            } else {
                const normalizedQuestions = favoritesList
                    .filter(question => question && Array.isArray(question.opcoes) && question.opcoes.length > 0)
                    .slice(0, normalizedLimit)
                    .map(question => ({
                        ...question,
                        is_favorited: true,
                        opcoes: question.opcoes.map(option => ({
                            id_opcao_resposta: option.id_opcao_resposta,
                            id_pergunta: option.id_pergunta ?? question.id_pergunta,
                            texto_opcao: option.texto_opcao,
                            eh_correta: option.eh_correta,
                            ordem_exibicao: option.ordem_exibicao,
                            feedback_opcao: option.feedback_opcao,
                        })),
                    }));

                if (normalizedQuestions.length === 0) {
                    this.ui.showWarning('Não encontramos questões válidas na sua lista de favoritos.');
                } else {
                    this.store.dispatch(quizActions.setActiveSection('questions'));
                    this.store.dispatch(
                        quizActions.initializeQuiz(
                            normalizedQuestions,
                            'Revisão',
                            null,
                            null,
                            'Revisão de Favoritos',
                            null,
                            this._resolveTimerConfiguration(null)
                        )
                    );

                    this.ui.challengeHubInstance?.hideHub();
                    success = true;
                }
            }
        } catch (error) {
            const detail = getFriendlyErrorMessage(error, 'Não foi possível carregar seus favoritos agora.');
            this.ui.showWarning(detail);
        } finally {
            this.ui.showSessionLoadingIndicator(false);
            if (!success) {
                if (this.ui.challengeHubInstance && typeof this.ui.challengeHubInstance.showHub === 'function') {
                    this.ui.challengeHubInstance.showHub();
                } else {
                    this.ui.displayQuizLayout(false);
                }
            }
        }

        return success;
    }

    async startPredefinedQuiz(quizDefinicaoId) {
        await this._fetchAndInitiateQuiz({ quiz_definicao_id: quizDefinicaoId, mode: 'Definido' });
    }

    async startPredefinedQuizBySlug(slug) {
        if (!slug || typeof slug !== 'string') {
            return false;
        }

        const normalizedSlug = slug.trim().toLowerCase();
        if (!normalizedSlug) {
            return false;
        }

        await this.loadInitialSummary();
        const predefined = this._getPredefinedQuizzesFromState();
        const match = predefined.find((item) => (
            typeof item.slug === 'string' && item.slug.trim().toLowerCase() === normalizedSlug
        ));

        if (match && Number.isInteger(match.id) && match.id > 0) {
            await this.startPredefinedQuiz(match.id);
            return true;
        }

        console.warn(`ActionOrchestrator: nenhum quiz pré-definido encontrado para o slug "${slug}".`);
        return false;
    }

    async answerQuestion(selectedOptionId) {
        const rootState = this.store.getState();
        const state = rootState.quiz;
        const userState = rootState.user || {};
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
                    response.total_erros_sessao,
                    {
                        xp: response.xp_sessao ?? userState.xp ?? 0,
                        currentStreak: response.sequencia_atual ?? userState.currentStreak ?? 0,
                        bestStreak: response.melhor_sequencia_sessao ?? userState.bestStreak ?? 0,
                        multiplier: typeof response.multiplicador_atual === 'number'
                            ? response.multiplicador_atual
                            : userState.multiplier ?? 1,
                    }
                )
            );
        } catch (error) {
            const detail = getFriendlyErrorMessage(error, "Erro ao salvar resposta.");
            this.ui.showWarning({ key: 'quiz.saveAnswerError', detail });
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
        this.stopTimer();
        const state = this.store.getState();
        const sessionId = state.quiz.currentSessionId;

        if (forceByUser && this.ui?.modalManager) {
            this.ui.modalManager.toggleConfirmModal(false);
        }

        if (!sessionId) {
            this._finalizeStandaloneQuiz(state);
            return;
        }

        try {
            const responseData = await this.apiService.endQuizSession({
                session_id: sessionId,
                tempo_total_segundos: state.timer.elapsedSeconds,
            });

            this.store.dispatch(
                quizActions.updateUserStats(
                    responseData.pontuacao_final,
                    responseData.total_acertos,
                    responseData.total_erros,
                    {
                        xp: responseData.xp_final ?? state.user?.xp ?? 0,
                        currentStreak: responseData.sequencia_final ?? 0,
                        bestStreak: responseData.melhor_sequencia ?? state.user?.bestStreak ?? 0,
                        multiplier: 1,
                        achievementsUnlocked: responseData.conquistas_desbloqueadas ?? 0,
                        recentAchievements: responseData.gamificacao?.achievements?.newly_unlocked || [],
                        gamification: responseData.gamificacao || state.user?.gamification || null,
                    }
                )
            );
        } catch (error) {
            console.error("ActionOrchestrator: ERRO ao finalizar sess�o:", error);
            const detail = getFriendlyErrorMessage(error, "Erro ao finalizar sess�o.");
            this.ui.showWarning({ key: 'quiz.finalizeSessionError', detail });
        } finally {
            this.store.dispatch({ type: ActionTypes.QUIZ_ENDED });
        }
    }

    _finalizeStandaloneQuiz(stateSnapshot) {
        const quizState = stateSnapshot?.quiz;
        if (!quizState || quizState.quizEnded) {
            return;
        }

        const userState = stateSnapshot?.user || {};
        const questions = Array.isArray(quizState.currentQuestionsSet)
            ? quizState.currentQuestionsSet
            : [];

        let correctCount = 0;
        let incorrectCount = 0;

        questions.forEach((question) => {
            if (!question) return;
            if (typeof question.respostaDadaId === 'undefined') return;

            if (question.foiPulada) {
                incorrectCount += 1;
                return;
            }

            if (question.foiCorretaNaSessao === true) {
                correctCount += 1;
            } else if (question.foiCorretaNaSessao === false || question.respostaDadaId !== null) {
                incorrectCount += 1;
            }
        });

        const estimatedPoints = correctCount * 15;

        this.store.dispatch(
            quizActions.updateUserStats(
                estimatedPoints,
                correctCount,
                incorrectCount,
                {
                    xp: userState?.xp ?? 0,
                    currentStreak: correctCount,
                    bestStreak: Math.max(userState?.bestStreak ?? 0, correctCount),
                    multiplier: 1,
                    achievementsUnlocked: userState?.achievementsUnlocked ?? 0,
                    recentAchievements: Array.isArray(userState?.recentAchievements)
                        ? [...userState.recentAchievements]
                        : [],
                    gamification: userState?.gamification ?? null,
                },
            ),
        );

        this.store.dispatch({ type: ActionTypes.QUIZ_ENDED });
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
            this.ui.showWarning({ key: 'favorites.loginRequiredToFavorite' });
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
                const detail = getFriendlyErrorMessage({ data: response }, "Falha ao favoritar.");
                this.ui.showWarning({ key: 'favorites.toggleError', detail });
            }
        } catch (error) {
            const detail = getFriendlyErrorMessage(error, "Erro de conexão ao favoritar.");
            this.ui.showWarning({ key: 'favorites.networkError', detail });
        } finally {
            if (btnFav) {
                btnFav.disabled = false;
                btnFav.removeAttribute('aria-disabled');
            }
        }
    }





    async submitIssueReport(questionId, description, categoria = null, origem = 'quiz_session') {
        const normalizedId = Number.parseInt(questionId, 10);
        if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
            this.ui.handleReportIssueError('Nao foi possivel identificar a questao selecionada.');
            return false;
        }

        const trimmedDescription = typeof description === 'string' ? description.trim() : '';
        if (trimmedDescription.length < 10) {
            this.ui.handleReportIssueError('Descreva o problema com pelo menos 10 caracteres.');
            return false;
        }

        this.ui.setReportIssueLoading(true);

        try {
            const payload = {
                descricao: trimmedDescription,
                origem,
            };
            if (typeof categoria === 'string' && categoria.trim()) {
                payload.categoria = categoria.trim();
            }
            const response = await this.apiService.submitQuestionIssueReport(normalizedId, payload);

            if (response && response.status === 'success') {
                this.ui.handleReportIssueSuccess();
                return true;
            }

            const detail = response?.message || 'Nao foi possivel registrar o relato.';
            this.ui.handleReportIssueError(detail);
            return false;
        } catch (error) {
            const detail = getFriendlyErrorMessage(error, 'Erro ao enviar o relato.');
            this.ui.handleReportIssueError(detail);
            return false;
        } finally {
            this.ui.setReportIssueLoading(false);
        }
    }

    async submitSupportRequest({ message, email = '', origin = null, context = null, tipo = null } = {}) {
        const trimmedMessage = typeof message === 'string' ? message.trim() : '';
        if (trimmedMessage.length < 10) {
            this.ui.handleSupportRequestError('Descreva sua reclamação com pelo menos 10 caracteres.');
            return false;
        }

        const payload = {
            mensagem: trimmedMessage,
        };

        if (typeof email === 'string' && email.trim()) {
            payload.email = email.trim();
        }

        if (typeof origin === 'string' && origin.trim()) {
            payload.origem = origin.trim();
        }

        if (context && typeof context === 'object') {
            payload.contexto = context;
        }

        if (typeof tipo === 'string' && tipo.trim()) {
            payload.tipo = tipo.trim();
        }

        this.ui.setSupportRequestLoading(true);

        try {
            const response = await this.apiService.submitSupportRequest(payload);
            if (response && response.status === 'success') {
                this.ui.handleSupportRequestSuccess(response.message);
                return true;
            }

            const detail = response?.message || 'Não foi possível enviar sua mensagem.';
            this.ui.handleSupportRequestError(detail);
            return false;
        } catch (error) {
            const detail = getFriendlyErrorMessage(error, 'Erro ao enviar sua mensagem.');
            this.ui.handleSupportRequestError(detail);
            return false;
        } finally {
            this.ui.setSupportRequestLoading(false);
        }
    }

    async toggleFavoriteFromAccountPage(questionId) {
        const normalizedId = Number.parseInt(questionId, 10);
        if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
            console.warn('ActionOrchestrator: ID inválido recebido para remover favorito.', questionId);
            return false;
        }

        if (!this.ui.userIsAuthenticated) {
            this.ui.showWarning({ key: 'favorites.loginRequiredToManage' });
            return false;
        }

        try {
            const response = await this.apiService.toggleFavoriteStatus(normalizedId);
            if (response && response.status === 'success') {
                const isStillFavorited = (() => {
                    if (typeof response.is_favorited === 'string') {
                        return response.is_favorited.toLowerCase() === 'true';
                    }
                    return Boolean(response.is_favorited);
                })();

                if (isStillFavorited) {
                    const warningMessage = typeof response.message === 'string'
                        ? response.message
                        : 'Não foi possível remover esta questão dos favoritos.';
                    const warningType = typeof response.message_type === 'string'
                        ? response.message_type
                        : 'warning';
                    this.ui.showWarning(warningMessage, warningType);
                    return false;
                }

                this.store.dispatch(quizActions.removeFavoriteFromList(normalizedId));
                const successMessage = typeof response.message === 'string'
                    ? response.message
                    : 'Questão removida dos favoritos.';
                const successType = typeof response.message_type === 'string'
                    ? response.message_type
                    : 'success';

                if (successType === 'success' && typeof this.ui.showToast === 'function') {
                    this.ui.showToast(successMessage, 'success');
                } else {
                    this.ui.showWarning(successMessage, successType);
                }
                return true;
            }

            const detail = getFriendlyErrorMessage({ data: response }, 'Não foi possível atualizar seus favoritos.');
            this.ui.showWarning({ key: 'favorites.toggleError', detail });
        } catch (error) {
            const detail = getFriendlyErrorMessage(error, 'Erro ao atualizar seus favoritos.');
            this.ui.showWarning({ key: 'favorites.toggleError', detail });
        }

        return false;
    }

    async claimLevelReward(levelId, rewardId) {
        const normalizedLevel = Number.parseInt(levelId, 10);
        const rewardIdentifier = typeof rewardId === 'string' ? rewardId : String(rewardId);

        if (!Number.isInteger(normalizedLevel) || !rewardIdentifier) {
            throw new Error('Recompensa informada é inválida.');
        }

        try {
            const response = await this.apiService.claimLevelReward(normalizedLevel, rewardIdentifier);
            if (!response || response.status !== 'success') {
                throw new Error(response?.message || 'Não foi possível resgatar a recompensa.');
            }

            const state = this.store.getState();
            const userState = state?.user || {};

            this.store.dispatch(
                quizActions.updateUserStats(
                    userState.pontos,
                    userState.acertos,
                    userState.erros,
                    {
                        xp: userState.xp,
                        currentStreak: userState.currentStreak,
                        bestStreak: userState.bestStreak,
                        multiplier: userState.multiplier,
                        achievementsUnlocked: userState.achievementsUnlocked,
                        recentAchievements: userState.recentAchievements,
                        gamification: response.gamificacao || userState.gamification || null,
                    },
                ),
            );

            return response;
        } catch (error) {
            const message = error?.message || 'Não foi possível resgatar a recompensa.';
            throw new Error(message);
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
                    'Questão Favorita',
                    null,
                    this._resolveTimerConfiguration(null)
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

            this.ui.showWarning({ key: 'favorites.loadSingleError' });
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

            this.ui.showWarning({ key: 'favorites.loadSingleError', detail: response?.message });
            return false;
        } catch (error) {
            if (error?.response?.status === 404 && useCachedQuestion('Questão não encontrada no banco atual. Exibindo dados salvos da sua lista de favoritos.')) {
                return true;
            }

            const detail = getFriendlyErrorMessage(error, 'Erro ao carregar questão favorita.');
            this.ui.showWarning({ key: 'favorites.loadSingleError', detail });
            return false;
        } finally {
            this.ui.showSessionLoadingIndicator(false);
        }
    }
}





