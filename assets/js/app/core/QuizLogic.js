// File: assets/js/app/core/QuizLogic.js

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        this.challengeHub = null; // Injetado por App.js via setChallengeHub
        this.filterPanel = null;  // Injetado por App.js via setFilterPanel
        this.currentSessionId = null;
        this.isFetchingQuestions = false;
    }

    setChallengeHub(challengeHubInstance) {
        this.challengeHub = challengeHubInstance;
    }

    setFilterPanel(filterPanelInstance) {
        this.filterPanel = filterPanelInstance;
    }

    async _fetchAndPrepareQuestions(filterParams, isQuickQuiz = false) {
        if (this.isFetchingQuestions) return null;
        this.isFetchingQuestions = true;

        if (this.ui.elements.placeholderFiltrosContainer && this.ui.elements.challengeHubContainer) {
            this.ui.showElement(this.ui.elements.placeholderFiltrosContainer);
            this.ui.hideElement(this.ui.elements.challengeHubContainer);
        }
        this.ui.hideElement(this.ui.elements.quizSectionContent);
        this.ui.clearWarning();

        try {
            const questions = await this.quizData.fetchFilteredQuestions(filterParams);
            this.state.initializeWithQuestions(questions); // Popula QuizState com as novas perguntas
            this.state.setQuizModeAndFilters( // Informa QuizState sobre o modo e filtros usados
                isQuickQuiz,
                filterParams.category_ids || [],
                filterParams.difficulty_levels || ['all']
            );
            return questions;
        } catch (error) {
            this.ui.showWarning(`Erro ao buscar perguntas: ${error.message}. Tente novamente ou ajuste os filtros.`);
            return null;
        } finally {
            this.isFetchingQuestions = false;
            if (this.ui.elements.placeholderFiltrosContainer) {
                this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
            }
        }
    }

    async applyFiltersAndStartQuiz() {
        if (!this.filterPanel) {
            console.error("QuizLogic: FilterPanel não está definido.");
            return;
        }
        // Obter filtros diretamente do FilterPanel
        const selectedCategoryIds = this.filterPanel.getSelectedCategories();
        const selectedDifficulties = this.filterPanel.getSelectedDifficulties();

        this.ui.toggleFilterPanel(false, this.filterPanel); // Fecha o painel de filtros

        const questions = await this._fetchAndPrepareQuestions(
            { category_ids: selectedCategoryIds, difficulty_levels: selectedDifficulties },
            false
        );

        if (questions) {
            this._initiateQuizSession(questions, selectedCategoryIds);
        } else {
            if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName)) {
                this.challengeHub.showHub();
            }
        }
    }

    clearAllFiltersInPanel() {
        if (this.filterPanel) {
            this.filterPanel.resetFiltersToDefault(); // FilterPanel reseta seus próprios controles visuais
        }
        // O QuizState também é resetado dentro de FilterPanel.resetFiltersToDefault se estiver configurado assim,
        // ou podemos fazer explicitamente aqui se FilterPanel não mexer no QuizState diretamente.
        // No FilterPanel.js que enviei, ele atualiza o QuizState.
    }

    async startQuickQuiz() {
        const questions = await this._fetchAndPrepareQuestions(
            { mode: 'quick', count: this.state.quickQuizDefaultCount },
            true
        );

        if (questions) {
            this._initiateQuizSession(questions, []);
        } else {
            if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName)) {
                this.challengeHub.showHub();
            }
        }
    }

    async _initiateQuizSession(questionsForSession, selectedCategoryIdsForSessionStart = []) {
        this.user.reset();
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);

        if (questionsForSession && questionsForSession.length > 0) {
            const questionIdsInSession = questionsForSession.map(q => q.id_pergunta);
            try {
                const sessionData = await this.apiService.startQuizSession({
                    modo_quiz: this.state.isQuickQuizMode ? 'Rápido' : 'Por Categoria',
                    categoria_ids: this.state.isQuickQuizMode ? [] : selectedCategoryIdsForSessionStart,
                    question_ids_in_session: questionIdsInSession,
                });

                if (sessionData && sessionData.status === 'success' && sessionData.session_id) {
                    this.currentSessionId = sessionData.session_id;
                    this.ui.displayQuizContent(true);
                    this._displayCurrentQuestion(false);
                    this.ui.startTimer();
                } else {
                    this.ui.showWarning(`Não foi possível iniciar a sessão de quiz: ${sessionData.message || 'Erro desconhecido.'}`);
                }
            } catch (error) {
                this.ui.showWarning(`Erro de conexão ao iniciar o quiz: ${error.message}.`);
            }
        } else {
            this.ui.displayQuizContent(false);
            this.ui.showWarning(
                this.state.isQuickQuizMode
                    ? "Nenhuma pergunta disponível para um Quiz Rápido."
                    : "Nenhuma questão encontrada com os filtros selecionados."
            );
            this.ui.stopTimer();
        }
    }

    async answerQuestion(selectedOptionId) {
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion || !this.currentSessionId || currentQuestion.respostaDadaId !== undefined) {
            return;
        }
        const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);
        if (!selectedOption) return;

        const isCorrect = selectedOption.eh_correta;
        this.state.recordAnswer(selectedOptionId, isCorrect);
        this.ui.disableAnswers();
        this.ui.applyAnswerFeedback(selectedOptionId, options);
        this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
        this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
        this.ui.focusNextButton(true);
        this.ui.smoothScrollToNextButton();

        try {
            const responseData = await this.apiService.registerAnswer({
                session_id: this.currentSessionId,
                pergunta_id: currentQuestion.id_pergunta,
                opcao_id: selectedOptionId,
            });
            if (responseData && responseData.status === 'success') {
                this.user.updateFromServer(responseData.total_acertos_sessao, responseData.total_erros_sessao, responseData.pontuacao_sessao);
                this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            } else {
                console.warn("Backend: Falha ao registrar resposta:", responseData?.message);
            }
        } catch (error) {
            console.error("Erro de rede ao registrar resposta:", error.message);
        }
    }

    async _handleSkippedQuestion() {
        const currentQuestion = this.state.getCurrentQuestion();
        if (currentQuestion && this.currentSessionId && currentQuestion.respostaDadaId === undefined) {
            this.state.markAsSkipped();
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            try {
                await this.apiService.registerAnswer({
                    session_id: this.currentSessionId,
                    pergunta_id: currentQuestion.id_pergunta,
                    opcao_id: null
                });
            } catch (err) {
                console.warn("Erro ao registrar pulo de questão no backend:", err.message);
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
        }
    }

    previousQuestion() {
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestion();
        }
    }

    goToQuestion(index) {
        if (index >= this.state.getTotalFilteredQuestions()) {
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
                    this.quizData.getRelacaoPerguntaCategorias(),
                    this.state.isQuickQuizMode
                );
                this.ui.generateAnswerButtons(question.id_pergunta, options, question.respostaDadaId, (opId) => this.answerQuestion(opId));
                if (question.respostaDadaId !== undefined) {
                    this.ui.disableAnswers();
                    this.ui.applyAnswerFeedback(question.respostaDadaId, options);
                }
            } else {
                if (!this.state.isQuizComplete()) {
                    this.ui.showWarning("Nenhuma pergunta disponível para exibir.");
                }
                this.endQuiz();
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
            // Usar uma promise para aguardar a transição CSS é mais complexo do que o necessário aqui.
            // Um simples setTimeout pode ser suficiente se a duração da transição for conhecida e consistente.
            // Para robustez, o ideal seria usar 'transitionend' event listener.
            await new Promise(resolve => setTimeout(resolve, this.ui.TRANSITION_DURATION || 300)); // Usa a constante de QuizUI se acessível ou um valor padrão

            questionWrapper.classList.remove("is-fading-out");
            questionWrapper.classList.add("is-transparent"); // Para evitar "flash" do conteúdo antigo
            requestAnimationFrame(() => {
                displayLogic();
                requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent"));
            });
        } else {
            displayLogic();
            if (questionWrapper) questionWrapper.classList.remove("is-fading-out", "is-transparent");
            if (this.state.getTotalFilteredQuestions() > 0) {
                this.state.markNavigated();
            }
        }
    }

    async endQuiz(forceByUser = false) {
        this.ui.stopTimer();
        this.ui.toggleExplanationModal(false);

        if (this.currentSessionId) {
            try {
                const responseData = await this.apiService.endQuizSession({
                    session_id: this.currentSessionId,
                    tempo_total_segundos: this.ui.timerSeconds,
                });
                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) {
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                } else {
                    console.warn("Falha ao sincronizar o fim da sessão com o backend:", responseData?.message);
                }
            } catch (error) {
                console.error("Erro de rede ao finalizar a sessão:", error.message);
            } finally {
                this.currentSessionId = null;
                this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
            }
        } else {
            this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        }
        if (forceByUser) {
            this.ui.toggleConfirmModal(false);
        }
    }

    restartQuiz() {
        this.user.reset();
        this.state.fullReset(); // Reseta o estado do quiz, incluindo filtros ativos
        this.currentSessionId = null;
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);
        this.ui.displayQuizContent(false);
        this.ui.clearWarning();

        if (this.filterPanel) { // Usa o método do filterPanel para resetar os filtros visuais
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
}