// File: assets/js/app/core/QuizLogic.js
// import { TRANSITION_DURATION } from '../../utils/constants.js'; // Não parece ser usado diretamente aqui

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        this.state = quizState;
        this.ui = quizUI; // quizUI agora contém referências aos submódulos de UI
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        // As instâncias de challengeHub e filterPanel são injetadas em QuizUI pelo App.js
        // e podem ser acessadas via this.ui.challengeHubInstance e this.ui.filterPanelInstance
        // se QuizLogic precisar interagir diretamente com eles (geralmente não precisa,
        // pois QuizUI ou App coordenam isso).

        this.currentSessionId = null;
        this.isFetchingQuestions = false;

        // Configura os callbacks que QuizUI passará para seus submódulos
        if (this.ui) {
            this.ui.setCallbacks({
                answerQuestionCallback: this.answerQuestion.bind(this),
                navigationCallback: this._handleQuestionNavigation.bind(this),
                toggleFavoriteCallback: this.toggleFavoriteCurrentQuestion.bind(this),
                endSessionCallback: () => { // Para o botão "Encerrar" no ScorePanel
                    if (this.ui.modalManager) this.ui.modalManager.toggleConfirmModal(true);
                },
                restartQuizCallback: this.restartQuiz.bind(this), // Para o ResultDisplay
                // goHomeCallback é tratado diretamente no ResultDisplay por simplicidade
            });
        }
    }

    // Método para ser chamado pelo QuestionDisplay através do callback
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
            if (status === 500) return "Ocorreu um problema em nosso servidor. Por favor, tente novamente mais tarde.";
            if (status === 404) return "O recurso solicitado não foi encontrado em nosso sistema.";
            if (status === 403) return "Você não tem permissão para realizar esta ação.";
            if (status === 401) return "Sua sessão pode ter expirado ou você não está autenticado. Por favor, faça login novamente.";
            if (status >= 400 && status < 500) return "Houve um problema com sua solicitação. Verifique os dados ou seleções e tente novamente.";
        }
        if (error.message) return defaultMessage;
        return defaultMessage;
    }

    async _fetchAndPrepareQuestions(filterParams, isQuickQuiz = false) {
        if (this.isFetchingQuestions) return null;
        this.isFetchingQuestions = true;

        const triggerButton = isQuickQuiz 
            ? this.ui.elements.hubQuickQuizBtn 
            : this.ui.elements.btnAplicarFiltrosPainel;
        const originalButtonText = triggerButton 
            ? (triggerButton.querySelector('.button__label') || triggerButton).textContent 
            : (isQuickQuiz ? "Quiz Rápido" : "Aplicar Filtros");
        
        if(triggerButton) this.ui.setButtonLoading(triggerButton, true, originalButtonText);
        
        if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.hideHub();
        
        if (this.ui.filterPanelInstance && !isQuickQuiz && this.ui.elements.placeholderFiltrosContainer) {
            if (!this.ui.elements.filterPanel.classList.contains('filter-panel--visible')) {
                this.ui.showElement(this.ui.elements.placeholderFiltrosContainer);
            }
        }
        this.ui.hideActiveQuizElements(); // Garante que o layout do quiz anterior seja limpo
        if (this.ui.warningDisplay) this.ui.warningDisplay.clear();

        try {
            const questions = await this.quizData.fetchFilteredQuestions(filterParams);
            if (!questions || questions.length === 0) {
                this.state.initializeWithQuestions([]);
                if (this.ui.warningDisplay) {
                    this.ui.warningDisplay.show(
                        isQuickQuiz
                            ? "Nenhuma pergunta disponível para um Quiz Rápido no momento. Que tal tentar personalizar um?"
                            : "Nenhuma questão encontrada para os filtros selecionados. Por favor, ajuste suas preferências e tente novamente.",
                        'info', true
                    );
                }
            } else {
                this.state.initializeWithQuestions(questions);
            }
            this.state.setQuizModeAndFilters(
                isQuickQuiz,
                filterParams.category_ids || [],
                filterParams.difficulty_levels || ['all'],
                isQuickQuiz ? null : filterParams.num_questions
            );
            return questions;
        } catch (error) {
            const userMessage = this._getFriendlyErrorMessage(error, "Erro ao carregar as perguntas. Tente novamente.");
            if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
            this.state.initializeWithQuestions([]);
            return null;
        } finally {
            this.isFetchingQuestions = false;
            if(triggerButton) this.ui.setButtonLoading(triggerButton, false, originalButtonText);

            const quizWillStart = this.state.currentQuestionsSet && this.state.currentQuestionsSet.length > 0;
            if (this.ui.elements.placeholderFiltrosContainer) {
                if (quizWillStart) {
                    this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                } else if (!this.ui.elements.avisoContainer || this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName)) {
                    // Se o quiz não vai começar E não há um aviso sendo mostrado, mostra o hub.
                    this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                    if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
                }
            }
        }
    }

    async applyFiltersAndStartQuiz() {
        if (!this.ui.filterPanelInstance) {
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Erro interno: O painel de filtros não está funcionando corretamente.", 'error', true);
            return;
        }
        const selectedCategoryIds = this.ui.filterPanelInstance.getSelectedCategories();
        const selectedDifficulties = this.ui.filterPanelInstance.getSelectedDifficulties();
        const selectedNumQuestions = this.ui.filterPanelInstance.getSelectedNumberOfQuestions();
        
        if (this.ui.modalManager) this.ui.modalManager.toggleFilterPanel(false);
        
        const filterParams = { 
            category_ids: selectedCategoryIds, 
            difficulty_levels: selectedDifficulties,
            num_questions: selectedNumQuestions
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, false);
        
        if (questions && questions.length > 0) {
            this._initiateQuizSession(questions, selectedCategoryIds); 
        }
        // Se não houver perguntas, _fetchAndPrepareQuestions já mostrou o aviso e lidou com a UI.
    }

    async startQuickQuiz() {
        const filterParams = { 
            mode: 'quick', 
            count: this.state.quickQuizDefaultCount
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, true);
        if (questions && questions.length > 0) {
            this._initiateQuizSession(questions, []);
        }
        // Se não houver perguntas, _fetchAndPrepareQuestions já mostrou o aviso e lidou com a UI.
    }

    async _initiateQuizSession(questionsForSession, selectedCategoryIdsForSessionStart = []) {
        this.user.reset();
        if (this.ui.scorePanel) this.ui.scorePanel.resetDisplay();
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide(); // Usa ResultDisplay
        if (this.ui.timer) this.ui.timer.reset();
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        if (questionsForSession && questionsForSession.length > 0) {
            const questionIdsInSession = questionsForSession.map(q => q.id_pergunta);
            const sessionPayload = {
                modo_quiz: this.state.isQuickQuizMode ? 'Rápido' : 'Por Categoria',
                categoria_ids: (this.state.isQuickQuizMode || !selectedCategoryIdsForSessionStart) ? [] : selectedCategoryIdsForSessionStart,
                question_ids_in_session: questionIdsInSession,
            };
            try {
                const sessionData = await this.apiService.startQuizSession(sessionPayload);
                if (sessionData && sessionData.status === 'success' && sessionData.session_id) {
                    this.currentSessionId = sessionData.session_id;
                    this.ui.displayQuizLayout(true); // Mostra o layout geral do quiz
                    this._displayCurrentQuestionUI(false); // false para não scrollar na primeira questão
                    if (this.ui.timer) this.ui.timer.start();
                } else {
                    const userMessage = this._getFriendlyErrorMessage({ data: sessionData }, "Não foi possível iniciar a sessão de quiz. Tente novamente.");
                    if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
                    this.ui.displayQuizLayout(false); 
                    if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
                }
            } catch (error) {
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao iniciar o quiz. Verifique sua internet.");
                if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
                this.ui.displayQuizLayout(false); 
                if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
            }
        } else {
            this.ui.displayQuizLayout(false);
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Nenhuma pergunta foi carregada para esta sessão. Por favor, tente novamente.", 'info', true);
            if (this.ui.timer) this.ui.timer.stop();
            if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        }
    }
    
    /**
     * Chamado pelo QuestionDisplay via callback.
     */
    async answerQuestion(selectedOptionId) {
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion || currentQuestion.respostaDadaId !== undefined || !this.currentSessionId) {
            return;
        }
        // A lógica de encontrar a opção e verificar se é correta permanece aqui
        const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);
        if (!selectedOption) return;

        const isCorrect = selectedOption.eh_correta;
        this.state.recordAnswer(selectedOptionId, isCorrect);

        // QuestionDisplay já foi instruído (ou instruirá a si mesmo) a atualizar sua UI
        // com base no estado da resposta (disableAnswers, applyAnswerFeedback, renderQuestionGrid).
        // Aqui, focamos em registrar a resposta no backend e atualizar a pontuação.

        if (this.ui.questionDisplay) {
            this.ui.questionDisplay.disableAnswers(); // Garante que estejam desabilitadas
            this.ui.questionDisplay.applyAnswerFeedback(selectedOptionId, options); // Mostra feedback
            this.ui.questionDisplay.renderQuestionGrid(); // Atualiza o grid
            this.ui.questionDisplay.updateNavigationButtons(); // Atualiza botões de navegação
            setTimeout(() => {
                this.ui.questionDisplay.focusNextButton(true); 
                this.ui.questionDisplay.smoothScrollToNextButton();
            }, 100);
        }


        try {
            const answerPayload = {
                session_id: this.currentSessionId,
                pergunta_id: currentQuestion.id_pergunta,
                opcao_id: selectedOptionId,
            };
            const responseData = await this.apiService.registerAnswer(answerPayload);
            if (responseData && responseData.status === 'success') {
                this.user.updateFromServer(responseData.total_acertos_sessao, responseData.total_erros_sessao, responseData.pontuacao_sessao);
                if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            } else {
                 console.warn("QuizLogic: Resposta registrada no frontend, mas backend retornou:", responseData);
            }
        } catch (error) {
            console.error("QuizLogic: Erro de rede ao registrar resposta:", error);
            // Opcional: mostrar um aviso não bloqueante para o usuário
        }
    }

    async _handleSkippedQuestion() {
        const currentQuestion = this.state.getCurrentQuestion();
        if (currentQuestion && this.currentSessionId && currentQuestion.respostaDadaId === undefined) {
            this.state.markAsSkipped();
            if (this.ui.questionDisplay) this.ui.questionDisplay.renderQuestionGrid();
            try {
                const skipPayload = {
                    session_id: this.currentSessionId,
                    pergunta_id: currentQuestion.id_pergunta,
                    opcao_id: null 
                };
                const response = await this.apiService.registerAnswer(skipPayload);
                 if (response && response.status === 'success') {
                    this.user.updateFromServer(response.total_acertos_sessao, response.total_erros_sessao, response.pontuacao_sessao);
                    if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);
                }
            } catch (err) {
                console.warn("QuizLogic: Erro ao registrar pulo de questão no backend:", err.message);
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
                this._displayCurrentQuestionUI(); // Chama o método de UI
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
            this._displayCurrentQuestionUI(); // Chama o método de UI
        }
    }

    async goToQuestion(index) {
        if (index !== this.state.currentQuestionIndex && this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion(); 
        }

        if (index >= this.state.getTotalFilteredQuestions() && this.state.getTotalFilteredQuestions() > 0) {
            await this.endQuiz();
        } else if (this.state.goToQuestion(index)) { 
            this._displayCurrentQuestionUI(); // Chama o método de UI
        }
    }

    /**
     * Orquestra a exibição da questão atual usando o QuestionDisplay.
     * @param {boolean} [shouldScroll=true] - Se a UI deve scrollar para a questão.
     */
    _displayCurrentQuestionUI(shouldScroll = true) {
        if (!this.ui.questionDisplay) return;

        const questionWrapper = this.ui.elements.questionWrap; // Usado para animação
        const isInitialLoad = this.state.isInitialQuestionLoad;

        const displayLogic = () => {
            this.ui.questionDisplay.displayCurrentQuestion(); // QuestionDisplay agora busca os dados do estado e os renderiza
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

        if (this.currentSessionId) {
            try {
                const endSessionPayload = {
                    session_id: this.currentSessionId,
                    tempo_total_segundos: this.ui.timer ? this.ui.timer.getCurrentSeconds() : 0,
                };
                const responseData = await this.apiService.endQuizSession(endSessionPayload);
                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) {
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                } else {
                    const userMessage = this._getFriendlyErrorMessage({ data: responseData }, "Houve um problema ao finalizar sua sessão no servidor, mas seu resultado local será exibido.");
                    if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'warning');
                }
            } catch (error) {
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao finalizar a sessão. Seu resultado local será exibido.");
                if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'warning');
            } finally {
                this.currentSessionId = null;
            }
        }
        
        if (this.ui.resultDisplay) {
            this.ui.resultDisplay.show(this.user, this.state.getTotalFilteredQuestions());
        } else {
            this.ui.displayQuizLayout(false); // Fallback se ResultDisplay não estiver pronto
            if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        }

        if (forceByUser && this.ui.modalManager) {
            this.ui.modalManager.toggleConfirmModal(false);
        }
    }

    restartQuiz() {
        this.user.reset(); 
        this.state.fullReset(); 
        this.currentSessionId = null; 
        if (this.ui.scorePanel) this.ui.scorePanel.resetDisplay();
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide();
        if (this.ui.timer) this.ui.timer.reset();
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
        if (this.ui.favoriteManager) {
            await this.ui.favoriteManager.toggleCurrentQuestionFavoriteStatus();
        } else {
            // Fallback ou aviso se FavoriteManager não estiver disponível
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Funcionalidade de favoritos indisponível no momento.", 'info');
        }
    }

    async loadAndDisplayFavoriteQuestionsForAccountPage() {
        if (this.ui.favoriteManager) {
            await this.ui.favoriteManager.loadUserFavorites();
        } else {
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Não foi possível carregar os favoritos.", 'error');
        }
    }
}