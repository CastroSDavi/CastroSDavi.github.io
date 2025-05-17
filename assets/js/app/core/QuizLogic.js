// File: assets/js/app/core/QuizLogic.js
import { TRANSITION_DURATION } from '../../utils/constants.js'; // Certifique-se que está sendo usado ou remova

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        console.log("QUIZLOGIC.JS: Constructor - Inicializando QuizLogic");
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        this.challengeHub = null;
        this.filterPanel = null;
        this.currentSessionId = null;
        this.isFetchingQuestions = false;
        console.log("QUIZLOGIC.JS: Constructor - Instâncias recebidas:", { quizState, quizUI, userData, quizData, apiService });
    }

    setChallengeHub(challengeHubInstance) {
        console.log("QUIZLOGIC.JS: setChallengeHub - Instância de ChallengeHub definida:", challengeHubInstance);
        this.challengeHub = challengeHubInstance;
    }

    setFilterPanel(filterPanelInstance) {
        console.log("QUIZLOGIC.JS: setFilterPanel - Instância de FilterPanel definida:", filterPanelInstance);
        this.filterPanel = filterPanelInstance;
    }

    async _fetchAndPrepareQuestions(filterParams, isQuickQuiz = false) {
        console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Iniciado. Filtros:", filterParams, "É rápido:", isQuickQuiz);
        if (this.isFetchingQuestions) {
            console.warn("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Já buscando perguntas, retornando null.");
            return null;
        }
        this.isFetchingQuestions = true;

        if (this.ui.elements.placeholderFiltrosContainer && this.ui.elements.challengeHubContainer) {
            this.ui.showElement(this.ui.elements.placeholderFiltrosContainer);
            this.ui.hideElement(this.ui.elements.challengeHubContainer);
        }
        this.ui.hideElement(this.ui.elements.quizSectionContent);
        this.ui.clearWarning();

        try {
            const questions = await this.quizData.fetchFilteredQuestions(filterParams);
            if (!questions || questions.length === 0) {
                this.state.initializeWithQuestions([]);
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
            console.error("QUIZLOGIC.JS: _fetchAndPrepareQuestions - ERRO CRÍTICO:", error);
            this.ui.showWarning(`Erro ao buscar perguntas: ${error.message}. Tente novamente ou ajuste os filtros.`);
            this.state.initializeWithQuestions([]);
            return null;
        } finally {
            this.isFetchingQuestions = false;
            if (this.ui.elements.placeholderFiltrosContainer) {
                this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
            }
        }
    }

    async applyFiltersAndStartQuiz() {
        console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - INICIADO");
        if (!this.filterPanel) {
            console.error("QUIZLOGIC.JS: applyFiltersAndStartQuiz - FilterPanel não definido.");
            return;
        }
        const selectedCategoryIds = this.filterPanel.getSelectedCategories();
        const selectedDifficulties = this.filterPanel.getSelectedDifficulties();
        const selectedNumQuestions = this.filterPanel.getSelectedNumberOfQuestions();
        this.ui.toggleFilterPanel(false);
        const filterParams = { 
            category_ids: selectedCategoryIds, 
            difficulty_levels: selectedDifficulties,
            num_questions: selectedNumQuestions
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, false);
        if (questions) {
            this._initiateQuizSession(questions, selectedCategoryIds); 
        } else {
            if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName)) {
                this.challengeHub.showHub();
            }
        }
        console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - FINALIZADO");
    }

    async startQuickQuiz() {
        console.log("QUIZLOGIC.JS: startQuickQuiz - INICIADO");
        const filterParams = { 
            mode: 'quick', 
            count: this.state.quickQuizDefaultCount
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, true);
        if (questions) {
            this._initiateQuizSession(questions, []);
        } else {
            if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName)) {
                this.challengeHub.showHub();
            }
        }
        console.log("QUIZLOGIC.JS: startQuickQuiz - FINALIZADO");
    }

    async _initiateQuizSession(questionsForSession, selectedCategoryIdsForSessionStart = []) {
        const numQuestions = questionsForSession ? questionsForSession.length : 0;
        console.log(`QUIZLOGIC.JS: _initiateQuizSession - Iniciando com ${numQuestions} perguntas. Modo Rápido: ${this.state.isQuickQuizMode}.`);
        this.user.reset();
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);

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
                    this.ui.displayQuizContent(true);
                    this._displayCurrentQuestion(false); // false para não scrollar na primeira questão
                    this.ui.startTimer();
                } else {
                    this.ui.showWarning(`Não foi possível iniciar a sessão de quiz: ${sessionData?.message || 'Erro desconhecido do backend.'}`);
                    this.ui.displayQuizContent(false); 
                    if (this.challengeHub) this.challengeHub.showHub();
                }
            } catch (error) {
                this.ui.showWarning(`Erro de conexão ao iniciar o quiz: ${error.message}.`);
                this.ui.displayQuizContent(false); 
                if (this.challengeHub) this.challengeHub.showHub();
            }
        } else {
            this.ui.displayQuizContent(false);
            this.ui.showWarning(
                this.state.isQuickQuizMode
                    ? "Nenhuma pergunta disponível para um Quiz Rápido no momento."
                    : "Nenhuma questão encontrada com os filtros selecionados. Por favor, ajuste os filtros ou a quantidade desejada."
            );
            this.ui.stopTimer();
            if (this.challengeHub) this.challengeHub.showHub();
        }
        console.log("QUIZLOGIC.JS: _initiateQuizSession - FINALIZADO.");
    }

    async answerQuestion(selectedOptionId) {
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion || currentQuestion.respostaDadaId !== undefined || !this.currentSessionId) {
            return;
        }
        const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);
        if (!selectedOption) {
            return;
        }
        const isCorrect = selectedOption.eh_correta;
        this.state.recordAnswer(selectedOptionId, isCorrect);
        this.ui.disableAnswers();
        this.ui.applyAnswerFeedback(selectedOptionId, options);
        this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
        this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
        this.ui.focusNextButton(true); 
        this.ui.smoothScrollToNextButton();
        try {
            const answerPayload = {
                session_id: this.currentSessionId,
                pergunta_id: currentQuestion.id_pergunta,
                opcao_id: selectedOptionId,
            };
            const responseData = await this.apiService.registerAnswer(answerPayload);
            if (responseData && responseData.status === 'success') {
                this.user.updateFromServer(responseData.total_acertos_sessao, responseData.total_erros_sessao, responseData.pontuacao_sessao);
                this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            }
        } catch (error) {
            console.error("QUIZLOGIC.JS: answerQuestion - ERRO DE REDE ao registrar resposta:", error.message, error);
        }
    }

    async _handleSkippedQuestion() {
        const currentQuestion = this.state.getCurrentQuestion();
        if (currentQuestion && this.currentSessionId && currentQuestion.respostaDadaId === undefined) {
            console.log(`QUIZLOGIC.JS: _handleSkippedQuestion - Marcando pergunta ID ${currentQuestion.id_pergunta} como pulada.`);
            this.state.markAsSkipped();
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            try {
                const skipPayload = {
                    session_id: this.currentSessionId,
                    pergunta_id: currentQuestion.id_pergunta,
                    opcao_id: null 
                };
                const response = await this.apiService.registerAnswer(skipPayload);
                 if (response && response.status === 'success') {
                    this.user.updateFromServer(response.total_acertos_sessao, response.total_erros_sessao, response.pontuacao_sessao);
                    this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
                }
            } catch (err) {
                console.warn("QUIZLOGIC.JS: _handleSkippedQuestion - ERRO ao registrar pulo de questão no backend:", err.message);
            }
        }
    }

    async nextQuestion() {
        const isLastBeforeAdvance = this.state.isLastQuestion();
        await this._handleSkippedQuestion();

        if (this.state.goToNextQuestion()) { 
            if (this.state.isQuizComplete()) { 
                this.endQuiz();
            } else {
                this._displayCurrentQuestion();
            }
        } else if (isLastBeforeAdvance && !this.state.isQuizComplete()) {
            this.endQuiz();
        } else if (this.state.isQuizComplete() && this.ui.elements.resultadoCard.classList.contains(this.ui.hiddenClassName)) {
             this.endQuiz(); // Caso raro: quiz completo mas resultados não visíveis
        }
    }

    previousQuestion() {
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestion();
        }
    }

    goToQuestion(index) {
        if (index !== this.state.currentQuestionIndex) {
            this._handleSkippedQuestion(); 
        }

        if (index >= this.state.getTotalFilteredQuestions() && this.state.getTotalFilteredQuestions() > 0) {
            this.endQuiz();
        } else if (this.state.goToQuestion(index)) { 
            this._displayCurrentQuestion();
        }
    }

    async _displayCurrentQuestion(shouldScroll = true) {
        const questionWrapper = this.ui.elements.questionWrap;
        const isInitialLoad = this.state.isInitialQuestionLoad;

        const displayLogic = () => {
            const question = this.state.getCurrentQuestion();
            if (question) {
                const options = this.quizData.getOpcoesPorPerguntaId(question.id_pergunta);
                this.ui.displayQuestion(
                    question,
                    this.state.getCurrentQuestionNumberForDisplay(),
                    this.state.getTotalFilteredQuestions(),
                    this.quizData.getCategorias(),
                    null, 
                    this.state.isQuickQuizMode
                );
                this.ui.generateAnswerButtons(question.id_pergunta, options, question.respostaDadaId, (opId) => this.answerQuestion(opId));

                if (question.respostaDadaId !== undefined) {
                    this.ui.disableAnswers();
                    this.ui.applyAnswerFeedback(question.respostaDadaId, options);
                }
            } else {
                if (!this.state.isQuizComplete()) {
                    this.ui.showWarning("Nenhuma pergunta disponível para exibir no momento.");
                     if (this.challengeHub) {
                         this.ui.displayQuizContent(false); 
                         this.challengeHub.showHub();
                     }
                }
                return; 
            }
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            if (shouldScroll) {
                this.ui.scrollToQuestionStart();
            }
        };

        if (!isInitialLoad && questionWrapper) {
            questionWrapper.classList.add("is-fading-out");
            await new Promise(resolve => setTimeout(resolve, TRANSITION_DURATION || 300)); 

            questionWrapper.classList.remove("is-fading-out");
            questionWrapper.classList.add("is-transparent"); 
            requestAnimationFrame(() => { 
                displayLogic(); 
                requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent")); 
            });
        } else {
            displayLogic();
            if (questionWrapper) questionWrapper.classList.remove("is-fading-out", "is-transparent");
            if (this.state.getTotalFilteredQuestions() > 0 && isInitialLoad) {
                this.state.markNavigated(); 
            }
        }
    }

    async endQuiz(forceByUser = false) {
        console.log(`QUIZLOGIC.JS: endQuiz - INICIADO. Forçado pelo usuário: ${forceByUser}. ID Sessão: ${this.currentSessionId}`);
        this.ui.stopTimer();
        this.ui.toggleExplanationModal(false);

        if (this.currentSessionId) {
            try {
                const endSessionPayload = {
                    session_id: this.currentSessionId,
                    tempo_total_segundos: this.ui.timerSeconds,
                };
                const responseData = await this.apiService.endQuizSession(endSessionPayload);
                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) { // 'info' para sessões já finalizadas
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                }
            } catch (error) {
                console.error("QUIZLOGIC.JS: endQuiz - ERRO DE REDE ao finalizar a sessão:", error.message, error);
            } finally {
                this.currentSessionId = null;
            }
        }
        this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        if (forceByUser) {
            this.ui.toggleConfirmModal(false);
        }
    }

    restartQuiz() {
        console.log("QUIZLOGIC.JS: restartQuiz - INICIADO");
        this.user.reset(); 
        this.state.fullReset(); 
        this.currentSessionId = null; 
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);
        this.ui.displayQuizContent(false); 
        this.ui.clearWarning();
        if (this.filterPanel) {
            this.filterPanel.resetFiltersToDefault();
        }
        if (this.challengeHub) {
            this.challengeHub.showHub();
        }
        if(this.ui.elements.placeholderFiltrosContainer) {
            this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
        }
    }

    async forceEndQuizByUser() {
        await this.endQuiz(true);
    }

    // <<< NOVO MÉTODO para lidar com o toggle de favorito >>>
    async toggleFavoriteCurrentQuestion() {
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion || !this.ui.userIsAuthenticated) { // Verifica autenticação via QuizUI
            if (!this.ui.userIsAuthenticated) {
                // Idealmente, a UI já lidaria com isso (botão não visível/clicável).
                // Mas um alerta aqui pode ser um fallback.
                alert("Você precisa estar logado para favoritar questões."); 
                console.warn("QuizLogic: Tentativa de favoritar sem estar logado.");
            } else {
                console.warn("QuizLogic: Tentativa de favoritar sem questão atual.");
            }
            return;
        }
        const perguntaId = currentQuestion.id_pergunta;
        console.log(`QuizLogic: Tentando dar toggle no favorito para pergunta ID ${perguntaId}`);

        try {
            const response = await this.apiService.toggleFavoriteStatus(perguntaId);
            if (response && response.status === 'success') {
                console.log(`QuizLogic: Status de favorito atualizado no backend para ${response.is_favorited}. Mensagem: ${response.message}`);
                this.ui.updateFavoriteButton(response.is_favorited);
                
                // Atualiza o estado 'is_favorited' da pergunta atual no QuizState
                if (currentQuestion.is_favorited !== undefined) { 
                    currentQuestion.is_favorited = response.is_favorited;
                } else {
                    // Se a propriedade não existia, adiciona-a.
                    // Isso pode acontecer se a pergunta foi carregada antes da lógica de 'is_favorited' existir no backend
                    // para a chamada inicial que populou currentQuestionsSet.
                    currentQuestion.is_favorited = response.is_favorited;
                }
                console.log("QuizLogic: Estado 'is_favorited' da pergunta atual no QuizState atualizado para:", currentQuestion.is_favorited);
            } else {
                console.error("QuizLogic: Falha ao atualizar status de favorito no backend. Resposta:", response);
                this.ui.showWarning(response?.message || "Erro ao tentar favoritar a questão.");
            }
        } catch (error) {
            console.error("QuizLogic: Erro de API ao tentar favoritar questão:", error);
            this.ui.showWarning("Erro de conexão ao tentar favoritar a questão.");
        }
    }

    // <<< NOVO MÉTODO para carregar e exibir os favoritos na página da conta >>>
    async loadAndDisplayFavoriteQuestions() {
        if (!this.ui.userIsAuthenticated) { // Verifica autenticação via QuizUI
            console.log("QuizLogic: Usuário não autenticado, não carregando favoritos.");
            const container = this.ui.elements.favoriteQuestionsContainer;
            if (container) {
                const placeholder = container.querySelector('.placeholder-text');
                if (placeholder) this.ui.hideElement(placeholder);
                container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Você precisa estar logado para ver suas questões favoritas.</p>';
            }
            if (this.ui.elements.favoriteQuestionsEmptyState) {
                this.ui.hideElement(this.ui.elements.favoriteQuestionsEmptyState);
            }
            return;
        }

        console.log("QuizLogic: Carregando questões favoritas do usuário...");
        try {
            const response = await this.apiService.getFavoriteQuestions();
            if (response && response.status === 'success') {
                this.ui.renderFavoriteQuestions(response.favorite_questions, response.all_categories_for_mapping);
            } else {
                console.error("QuizLogic: Falha ao buscar questões favoritas. Resposta:", response);
                if(this.ui.elements.favoriteQuestionsContainer) {
                    const placeholder = this.ui.elements.favoriteQuestionsContainer.querySelector('.placeholder-text');
                    if (placeholder) this.ui.hideElement(placeholder);
                    this.ui.elements.favoriteQuestionsContainer.innerHTML = '<p style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">Erro ao carregar suas questões favoritas.</p>';
                }
                 if (this.ui.elements.favoriteQuestionsEmptyState) { 
                    this.ui.hideElement(this.ui.elements.favoriteQuestionsEmptyState);
                }
            }
        } catch (error) {
            console.error("QuizLogic: Erro de API ao buscar questões favoritas:", error);
            if(this.ui.elements.favoriteQuestionsContainer) {
                const placeholder = this.ui.elements.favoriteQuestionsContainer.querySelector('.placeholder-text');
                if (placeholder) this.ui.hideElement(placeholder);
                this.ui.elements.favoriteQuestionsContainer.innerHTML = '<p style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">Erro de conexão ao carregar suas questões favoritas.</p>';
            }
            if (this.ui.elements.favoriteQuestionsEmptyState) { 
                this.ui.hideElement(this.ui.elements.favoriteQuestionsEmptyState);
            }
        }
    }
}