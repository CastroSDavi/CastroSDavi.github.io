// File: assets/js/app/core/QuizLogic.js

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        this.isFetchingQuestions = false;

        if (this.ui) {
            this.ui.setCallbacks({
                answerQuestionCallback: this.answerQuestion.bind(this),
                navigationCallback: this._handleQuestionNavigation.bind(this),
                toggleFavoriteCallback: this.toggleFavoriteCurrentQuestion.bind(this),
                endSessionCallback: () => {
                    if (this.ui.modalManager) this.ui.modalManager.toggleConfirmModal(true);
                },
                restartQuizCallback: this.restartQuiz.bind(this),
            });
        }
    }

    async initializeQuizPage() {
        if (this.ui.userIsAuthenticated && !this.state.isQuizActive()) {
            const resumed = await this.tryResumeSession();
            if (!resumed && this.ui.challengeHubInstance) { // Se não retomou e o hub existe, mostra o hub
                this.ui.challengeHubInstance.showHub();
            }
        } else if (this.ui.challengeHubInstance) { // Se não autenticado ou quiz já ativo (improvável), mostra hub
            this.ui.challengeHubInstance.showHub();
        }
    }

    async tryResumeSession() {
        try {
            const resumeData = await this.apiService.resumeQuizSession();
            if (resumeData && resumeData.status === 'success' && resumeData.perguntas?.length > 0) {
                this.state.rehydrateFromResumedSession(resumeData);
                this.user.updateFromServer(resumeData.total_acertos_atual, resumeData.total_erros_atual, resumeData.pontuacao_atual);

                this.ui.displayQuizLayout(true);
                this._displayCurrentQuestionUI(false);
                if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);
                
                if (this.ui.timer) {
                    this.ui.timer.reset(); // Garante parada e zera visualmente
                    let tempoInicialParaDisplay = 0;
                    if (resumeData.data_inicio_sessao_iso) {
                        const dataInicio = new Date(resumeData.data_inicio_sessao_iso);
                        const agora = new Date();
                        tempoInicialParaDisplay = Math.max(0, Math.floor((agora.getTime() - dataInicio.getTime()) / 1000));
                    }
                    this.ui.timer.start(tempoInicialParaDisplay);
                }
                return true;
            }
        } catch (error) {
            // Silenciosamente falha em retomar se não for 404 (nenhuma sessão)
            // Erros de rede ou 500 podem ser logados no console do ApiService
            if (error.response && error.response.status !== 404) {
                console.error("QuizLogic: Erro ao tentar retomar sessão:", error.message || error);
            }
        }
        return false;
    }


    async _handleQuestionNavigation(target) {
        if (target === 'next') {
            await this.nextQuestion();
        } else if (target === 'prev') {
            await this.previousQuestion();
        } else if (typeof target === 'number') {
            await this.goToQuestion(target);
        }
    }

    _getFriendlyErrorMessage(error, defaultMessage = "Ocorreu um erro inesperado. Tente novamente.") {
        if (!error.response && error.message && error.message.toLowerCase().includes('failed to fetch')) {
            return "Falha na conexão com o servidor. Verifique sua internet e tente novamente.";
        }
        if (error.data && error.data.message) return error.data.message;
        if (error.response && error.response.status) {
            const status = error.response.status;
            if (status === 500) return "Ocorreu um problema em nosso servidor. Tente mais tarde.";
            if (status === 404) return "Recurso não encontrado.";
            if (status === 403) return "Você não tem permissão para esta ação.";
            if (status === 401) return "Sessão expirada. Faça login novamente.";
            if (status >= 400 && status < 500) return "Problema com sua solicitação.";
        }
        if (error.message) return defaultMessage; // Usa a mensagem do erro se disponível
        return defaultMessage;
    }

    async _fetchAndPrepareQuestions(filterParams, quizTypeContext = { isQuickQuiz: false, isPredefinedQuiz: false }) {
        if (this.isFetchingQuestions) return null;
        this.isFetchingQuestions = true;

        const triggerButton = quizTypeContext.isQuickQuiz
            ? this.ui.elements.hubQuickQuizBtn
            : (quizTypeContext.isPredefinedQuiz ? null : this.ui.elements.btnAplicarFiltrosPainel);

        const originalButtonText = triggerButton
            ? (triggerButton.querySelector('.button__label') || triggerButton).textContent
            : (quizTypeContext.isQuickQuiz ? "Quiz Rápido" : "Aplicar Filtros");

        if (triggerButton) this.ui.setButtonLoading(triggerButton, true, originalButtonText);
        if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.hideHub();
        if (this.ui.filterPanelInstance && !quizTypeContext.isQuickQuiz && !quizTypeContext.isPredefinedQuiz && this.ui.elements.placeholderFiltrosContainer) {
            if (!this.ui.elements.filterPanel.classList.contains('filter-panel--visible')) {
                this.ui.showElement(this.ui.elements.placeholderFiltrosContainer);
            }
        }
        this.ui.hideActiveQuizElements();
        if (this.ui.warningDisplay) this.ui.warningDisplay.clear();

        try {
            const data = await this.quizData.fetchQuizData(filterParams);
            const questions = data?.perguntas;

            if (!questions || questions.length === 0) {
                this.state.initializeWithQuestions([], filterParams.mode || 'Desconhecido');
                if (this.ui.warningDisplay) {
                    const message = quizTypeContext.isQuickQuiz
                        ? "Nenhuma pergunta para Quiz Rápido."
                        : (quizTypeContext.isPredefinedQuiz ? "Este quiz definido não possui perguntas ou está inativo." : "Nenhuma questão para os filtros selecionados.");
                    this.ui.warningDisplay.show(message, 'info', true);
                }
            } else {
                this.state.initializeWithQuestions(questions, filterParams.mode, null, filterParams.quiz_definicao_id);
            }
            
            if (!quizTypeContext.isPredefinedQuiz) {
                this.state.setQuizFiltersForNewDynamicQuiz(
                    filterParams.category_ids || [],
                    filterParams.difficulty_levels || ['all'],
                    filterParams.num_questions // num_questions pode ser null (pega todas) ou um número
                );
            }
            return questions;
        } catch (error) {
            const userMessage = this._getFriendlyErrorMessage(error, "Erro ao carregar perguntas do quiz.");
            if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
            this.state.initializeWithQuestions([], filterParams.mode || 'Erro');
            return null;
        } finally {
            this.isFetchingQuestions = false;
            if (triggerButton) this.ui.setButtonLoading(triggerButton, false, originalButtonText);

            const quizWillStart = this.state.currentQuestionsSet && this.state.currentQuestionsSet.length > 0;
            if (this.ui.elements.placeholderFiltrosContainer) {
                if (quizWillStart || (this.ui.elements.filterPanel && this.ui.elements.filterPanel.classList.contains('filter-panel--visible'))) {
                    this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                } else if (!this.ui.elements.avisoContainer || this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName)) {
                    this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                    if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
                }
            }
        }
    }

    async applyFiltersAndStartQuiz() {
        if (!this.ui.filterPanelInstance) {
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Erro: Painel de filtros indisponível.", 'error', true);
            return;
        }
        const selectedCategoryIds = this.ui.filterPanelInstance.getSelectedCategories();
        const selectedDifficulties = this.ui.filterPanelInstance.getSelectedDifficulties();
        const selectedNumQuestions = this.ui.filterPanelInstance.getSelectedNumberOfQuestions();

        if (this.ui.modalManager) this.ui.modalManager.toggleFilterPanel(false);

        const filterParams = {
            category_ids: selectedCategoryIds,
            difficulty_levels: selectedDifficulties,
            num_questions: selectedNumQuestions, // Pode ser null para pegar todas
            mode: 'Por Categoria' // Modo base para quando se usa filtros
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: false, isPredefinedQuiz: false });

        if (questions && questions.length > 0) {
            await this._initiateQuizSession(questions, filterParams);
        }
    }

    async startQuickQuiz() {
        const filterParams = {
            mode: 'Rápido',
            // O backend usará o valor de ConfiguracoesGeraisQuiz se 'count' não for enviado.
            // Se a UI permitir que o usuário escolha um 'count' para o quiz rápido, envie-o aqui.
            // Ex: count: this.ui.challengeHubInstance.getSelectedQuickQuizCount() || undefined
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: true, isPredefinedQuiz: false });
        if (questions && questions.length > 0) {
            await this._initiateQuizSession(questions, filterParams);
        }
    }

    async startPredefinedQuiz(quizDefinicaoId) {
        if (!quizDefinicaoId) {
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("ID do Quiz Definido não fornecido.", 'error', true);
            return;
        }
        const filterParams = {
            quiz_definicao_id: quizDefinicaoId,
            mode: 'Definido'
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: false, isPredefinedQuiz: true });
        if (questions && questions.length > 0) {
            await this._initiateQuizSession(questions, filterParams);
        }
    }


    async _initiateQuizSession(questionsForSession, sessionParams) {
        this.user.reset();
        if (this.ui.scorePanel) this.ui.scorePanel.resetDisplay();
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide();
        if (this.ui.timer) this.ui.timer.reset(0); // Reseta para 0 segundos
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        if (questionsForSession && questionsForSession.length > 0) {
            const questionIdsInSession = questionsForSession.map(q => q.id_pergunta);
            const sessionPayload = {
                modo_quiz: this.state.getQuizMode(),
                categoria_ids: sessionParams.category_ids || [],
                question_ids_in_session: questionIdsInSession,
                quiz_definicao_id: sessionParams.quiz_definicao_id, // Será null se não for quiz definido
                dificuldades_selecionadas: sessionParams.difficulty_levels,
                num_questoes_solicitadas: sessionParams.num_questions || sessionParams.count
            };

            try {
                const sessionDataFromBackend = await this.apiService.startQuizSession(sessionPayload);
                if (sessionDataFromBackend && sessionDataFromBackend.status === 'success' && sessionDataFromBackend.session_id) {
                    this.state.currentSessionId = sessionDataFromBackend.session_id;
                    // A data_inicio da sessão será a do backend, que é importante para o cálculo do tempo ao retomar.
                    // Não precisamos armazenar a data_inicio no QuizState separadamente, pois resumeQuizSession a buscará.
                    this.ui.displayQuizLayout(true);
                    this._displayCurrentQuestionUI(false);
                    if (this.ui.timer) this.ui.timer.start(0); // Inicia do zero para nova sessão
                } else {
                    const userMessage = this._getFriendlyErrorMessage({ data: sessionDataFromBackend }, "Não foi possível iniciar a sessão de quiz.");
                    if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
                    this.ui.displayQuizLayout(false);
                    if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
                }
            } catch (error) {
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao iniciar o quiz.");
                if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
                this.ui.displayQuizLayout(false);
                if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
            }
        } else {
            this.ui.displayQuizLayout(false);
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Nenhuma pergunta foi carregada para esta sessão.", 'info', true);
            if (this.ui.timer) this.ui.timer.stop(); // Garante que o timer pare se não houver perguntas
            if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        }
    }

    async answerQuestion(selectedOptionId) {
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion || currentQuestion.respostaDadaId !== undefined || !this.state.getSessionId()) {
            return;
        }
        const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);
        if (!selectedOption) return;

        const isCorrect = selectedOption.eh_correta;
        this.state.recordAnswer(selectedOptionId, isCorrect);

        if (this.ui.questionDisplay) {
            this.ui.questionDisplay.disableAnswers();
            this.ui.questionDisplay.applyAnswerFeedback(selectedOptionId, options);
            this.ui.questionDisplay.renderQuestionGrid();
            this.ui.questionDisplay.updateNavigationButtons();
            setTimeout(() => {
                this.ui.questionDisplay.focusNextButton(true);
                this.ui.questionDisplay.smoothScrollToNextButton();
            }, 100);
        }

        try {
            const answerPayload = {
                session_id: this.state.getSessionId(),
                pergunta_id: currentQuestion.id_pergunta,
                opcao_id: selectedOptionId,
                current_question_index: this.state.currentQuestionIndex
            };
            const responseData = await this.apiService.registerAnswer(answerPayload);
            if (responseData && responseData.status === 'success') {
                this.user.updateFromServer(responseData.total_acertos_sessao, responseData.total_erros_sessao, responseData.pontuacao_sessao);
                if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            }
        } catch (error) {
            // console.error("QuizLogic: Erro de rede ao registrar resposta:", error.message || error);
        }
    }

    async _handleSkippedQuestion() {
        const currentQuestion = this.state.getCurrentQuestion();
        if (currentQuestion && this.state.getSessionId() && currentQuestion.respostaDadaId === undefined) {
            this.state.markAsSkipped();
            if (this.ui.questionDisplay) this.ui.questionDisplay.renderQuestionGrid();
            try {
                const skipPayload = {
                    session_id: this.state.getSessionId(),
                    pergunta_id: currentQuestion.id_pergunta,
                    opcao_id: null,
                    current_question_index: this.state.currentQuestionIndex
                };
                const response = await this.apiService.registerAnswer(skipPayload);
                if (response && response.status === 'success') {
                    this.user.updateFromServer(response.total_acertos_sessao, response.total_erros_sessao, response.pontuacao_sessao);
                    if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);
                }
            } catch (err) {
                // console.warn("QuizLogic: Erro ao registrar pulo de questão no backend:", err.message || err);
            }
        }
    }

    async nextQuestion() {
        const isLastBeforeAdvance = this.state.isLastQuestion();
        if (this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion();
        }

        if (this.state.goToNextQuestion()) {
            if (this.state.isQuizComplete()) {
                await this.endQuiz();
            } else {
                this._displayCurrentQuestionUI();
            }
        } else if (isLastBeforeAdvance && !this.state.isQuizComplete()) {
            await this.endQuiz();
        } else if (this.state.isQuizComplete() && (!this.ui.elements.resultadoCard || this.ui.elements.resultadoCard.classList.contains(this.ui.hiddenClassName))) {
            await this.endQuiz();
        }
    }

    async previousQuestion() {
        if (this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion();
        }
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestionUI();
        }
    }

    async goToQuestion(index) {
        if (index !== this.state.currentQuestionIndex && this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion();
        }

        if (index >= this.state.getTotalFilteredQuestions() && this.state.getTotalFilteredQuestions() > 0) {
            await this.endQuiz();
        } else if (this.state.goToQuestion(index)) {
            this._displayCurrentQuestionUI();
        }
    }

    _displayCurrentQuestionUI(shouldScroll = true) {
        if (!this.ui.questionDisplay) return;
        const questionWrapper = this.ui.elements.questionWrap;
        const isInitialLoad = this.state.isInitialQuestionLoad;

        const displayLogic = () => {
            this.ui.questionDisplay.displayCurrentQuestion();
            if (shouldScroll && !isInitialLoad) {
                this.ui.questionDisplay.scrollToQuestionStart();
            }
        };

        if (!isInitialLoad && questionWrapper) {
            questionWrapper.classList.add("is-fading-out");
            const fadeOutDuration = parseFloat(getComputedStyle(questionWrapper).transitionDuration) * 1000 || 300;

            setTimeout(() => {
                questionWrapper.classList.remove("is-fading-out");
                questionWrapper.classList.add("is-transparent");
                Promise.resolve().then(() => { // Garante que a renderização do DOM ocorra
                    requestAnimationFrame(() => {
                        displayLogic();
                        requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent"));
                    });
                });
            }, fadeOutDuration);
        } else {
            displayLogic();
            if (questionWrapper) questionWrapper.classList.remove("is-fading-out", "is-transparent");
            if (this.state.getTotalFilteredQuestions() > 0 && isInitialLoad) {
                this.state.markNavigated();
            }
        }
    }

    async endQuiz(forceByUser = false) {
        if (this.ui.timer) this.ui.timer.stop();
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        if (this.state.getSessionId()) {
            try {
                const endSessionPayload = {
                    session_id: this.state.getSessionId(),
                    tempo_total_segundos: this.ui.timer ? this.ui.timer.getCurrentSeconds() : 0,
                };
                const responseData = await this.apiService.endQuizSession(endSessionPayload);
                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) {
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                } else {
                    const userMessage = this._getFriendlyErrorMessage({ data: responseData }, "Problema ao finalizar sessão no servidor.");
                    if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'warning');
                }
            } catch (error) {
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao finalizar sessão.");
                if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'warning');
            } finally {
                this.state.currentSessionId = null; // Limpa o ID da sessão no estado
            }
        }

        if (this.ui.resultDisplay) {
            this.ui.resultDisplay.show(this.user, this.state.getTotalFilteredQuestions());
        } else {
            this.ui.displayQuizLayout(false);
            if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        }

        if (forceByUser && this.ui.modalManager) {
            this.ui.modalManager.toggleConfirmModal(false);
        }
    }

    restartQuiz() {
        this.user.reset();
        this.state.fullReset();
        if (this.ui.scorePanel) this.ui.scorePanel.resetDisplay();
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide();
        if (this.ui.timer) this.ui.timer.reset(0); // Reseta para 0
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);
        this.ui.displayQuizLayout(false);
        if (this.ui.warningDisplay) this.ui.warningDisplay.clear();
        if (this.ui.filterPanelInstance) this.ui.filterPanelInstance.resetFiltersToDefault();
        if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        if(this.ui.elements.placeholderFiltrosContainer) this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
    }

    async forceEndQuizByUser() {
        await this.endQuiz(true);
    }

    async toggleFavoriteCurrentQuestion() {
        if (!this.ui.userIsAuthenticated) {
            this.ui.showWarning("Faça login para favoritar questões.", 'info');
            return;
        }
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion) return;

        const perguntaId = currentQuestion.id_pergunta;
        const btnFav = this.ui.elements.btnToggleFavorite;
        if(btnFav) this.ui.setButtonLoading(btnFav, true);

        try {
            const response = await this.apiService.toggleFavoriteStatus(perguntaId);
            if (response && response.status === 'success') {
                this.ui.favoriteManager.updateFavoriteButtonState(response.is_favorited);
                this.state.updateFavoriteStatusForCurrentQuestion(response.is_favorited);
            } else {
                const msg = this._getFriendlyErrorMessage({ data: response }, "Falha ao atualizar status de favorito.");
                this.ui.showWarning(msg, 'error');
            }
        } catch (error) {
            const msg = this._getFriendlyErrorMessage(error, "Erro de conexão ao tentar favoritar.");
            this.ui.showWarning(msg, 'error');
        } finally {
            if(btnFav) this.ui.setButtonLoading(btnFav, false);
        }
    }

    async loadAndDisplayFavoriteQuestionsForAccountPage() {
        if (this.ui.favoriteManager) {
            await this.ui.favoriteManager.loadUserFavorites();
        }
    }
}