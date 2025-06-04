// File: assets/js/app/core/QuizLogic.js

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        this.isFetchingQuestions = false;
        console.log("QuizLogic.js: Construtor - Instância criada.");

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
        console.log("QuizLogic.js: Entrando em initializeQuizPage. this.state:", this.state);
        if (this.state) {
            console.log("QuizLogic.js: this.state.isQuizActive existe?", typeof this.state.isQuizActive);
            // Para o instanceof funcionar corretamente aqui, QuizState precisaria ser importado em QuizLogic.js
            // Como é apenas para depuração, vamos confiar no typeof por enquanto ou em outras propriedades.
            // console.log("QuizLogic.js: this.state é uma instância de QuizState?", this.state instanceof QuizState);
            console.log("QuizLogic.js: this.state tem currentSessionId?", 'currentSessionId' in this.state);
        } else {
            console.error("QuizLogic.js: CRITICAL - this.state é undefined em initializeQuizPage.");
        }


        if (this.ui.userIsAuthenticated && (!this.state || typeof this.state.isQuizActive !== 'function' || !this.state.isQuizActive())) {
            if (!this.state || typeof this.state.isQuizActive !== 'function') {
                console.error("QuizLogic.js: ERRO - this.state.isQuizActive não é uma função ou this.state é inválido. Valor de this.state:", this.state);
                if (this.ui.challengeHubInstance) {
                    this.ui.challengeHubInstance.showHub(); // Fallback para mostrar o hub
                }
                return; // Interrompe a tentativa de resumir se o estado for inválido
            }
            console.log("QuizLogic.js: initializeQuizPage - Usuário autenticado e sem quiz ativo. Tentando retomar sessão...");
            const resumed = await this.tryResumeSession();
            if (!resumed && this.ui.challengeHubInstance) {
                console.log("QuizLogic.js: initializeQuizPage - Sessão não retomada. Mostrando Challenge Hub.");
                this.ui.challengeHubInstance.showHub();
            }
        } else if (this.ui.challengeHubInstance) {
            console.log("QuizLogic.js: initializeQuizPage - Usuário não autenticado ou quiz já ativo. Mostrando Challenge Hub.");
            this.ui.challengeHubInstance.showHub();
        }
    }

    async tryResumeSession() {
        console.log("QuizLogic.js: tryResumeSession - Iniciando tentativa de retomar sessão.");
        try {
            const resumeData = await this.apiService.resumeQuizSession();
            console.log("QuizLogic.js: tryResumeSession - Dados recebidos de resumeQuizSession:", resumeData);
            if (resumeData && resumeData.status === 'success' && resumeData.perguntas?.length > 0) {
                console.log("QuizLogic.js: tryResumeSession - Sucesso ao retomar. Rehidratando estado.");
                this.state.rehydrateFromResumedSession(resumeData);
                this.user.updateFromServer(resumeData.total_acertos_atual, resumeData.total_erros_atual, resumeData.pontuacao_atual);

                this.ui.displayQuizLayout(true);
                this._displayCurrentQuestionUI(false);
                if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);

                if (this.ui.timer) {
                    this.ui.timer.reset();
                    let tempoInicialParaDisplay = 0;
                    if (resumeData.data_inicio_sessao_iso) {
                        const dataInicio = new Date(resumeData.data_inicio_sessao_iso);
                        const agora = new Date();
                        tempoInicialParaDisplay = Math.max(0, Math.floor((agora.getTime() - dataInicio.getTime()) / 1000));
                    }
                    this.ui.timer.start(tempoInicialParaDisplay);
                }
                console.log("QuizLogic.js: tryResumeSession - Sessão retomada e UI atualizada.");
                return true;
            }
            console.log("QuizLogic.js: tryResumeSession - Não foi possível retomar (sem dados válidos ou sucesso na resposta).");
        } catch (error) {
            console.warn("QuizLogic.js: tryResumeSession - Erro durante a tentativa de retomar sessão:", error);
            if (error.response && error.response.status !== 404) {
                console.error("QuizLogic.js: tryResumeSession - Erro não-404 ao tentar retomar:", error.message || error);
            }
        }
        return false;
    }


    async _handleQuestionNavigation(target) {
        console.log("QuizLogic.js: _handleQuestionNavigation - Target:", target);
        if (target === 'next') {
            await this.nextQuestion();
        } else if (target === 'prev') {
            await this.previousQuestion();
        } else if (typeof target === 'number') {
            await this.goToQuestion(target);
        }
    }

    _getFriendlyErrorMessage(error, defaultMessage = "Ocorreu um erro inesperado. Tente novamente.") {
        console.log("QuizLogic.js: _getFriendlyErrorMessage - Erro original:", error);
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
        if (error.message && typeof error.message === 'string' && !error.message.toLowerCase().includes('typeerror')) {
             // Evita mostrar mensagens de TypeError puras que não são amigáveis
            return error.message;
        }
        console.log("QuizLogic.js: _getFriendlyErrorMessage - Usando mensagem padrão:", defaultMessage);
        return defaultMessage;
    }

    async _fetchAndPrepareQuestions(filterParams, quizTypeContext = { isQuickQuiz: false, isPredefinedQuiz: false }) {
        if (this.isFetchingQuestions) {
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Já buscando questões, retornando null.");
            return null;
        }
        this.isFetchingQuestions = true;
        console.log("QuizLogic.js: _fetchAndPrepareQuestions - INICIANDO com filtros:", JSON.stringify(filterParams), "Contexto:", JSON.stringify(quizTypeContext));

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
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Chamando this.quizData.fetchFilteredQuestions...");
            // `fetchFilteredQuestions` é o método apropriado em QuizData para buscar com filtros
            const questionsArray = await this.quizData.fetchFilteredQuestions(filterParams);
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Resultado de fetchFilteredQuestions:", questionsArray);

            // ESTA É A CORREÇÃO SUGERIDA:
            const questions = questionsArray;

            console.log("QuizLogic.js: _fetchAndPrepareQuestions - 'questions' (deve ser array):", questions);
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Verificando se 'questions' é array:", Array.isArray(questions));

            if (!questions || questions.length === 0) {
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - Nenhuma pergunta encontrada ou array vazio.");
                this.state.initializeWithQuestions([], filterParams.mode || 'Desconhecido');
                if (this.ui.warningDisplay) {
                    const message = quizTypeContext.isQuickQuiz
                        ? "Nenhuma pergunta para Quiz Rápido."
                        : (quizTypeContext.isPredefinedQuiz ? "Este quiz definido não possui perguntas ou está inativo." : "Nenhuma questão para os filtros selecionados.");
                    this.ui.warningDisplay.show(message, 'info', true);
                    console.log("QuizLogic.js: _fetchAndPrepareQuestions - Mostrou aviso INFO:", message);
                }
            } else {
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - Perguntas encontradas:", questions.length);
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - Chamando this.state.initializeWithQuestions...");
                this.state.initializeWithQuestions(questions, filterParams.mode, null, filterParams.quiz_definicao_id);
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - this.state.initializeWithQuestions CONCLUÍDO.");
            }

            if (!quizTypeContext.isPredefinedQuiz) {
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - Chamando this.state.setQuizFiltersForNewDynamicQuiz...");
                this.state.setQuizFiltersForNewDynamicQuiz(
                    filterParams.category_ids || [],
                    filterParams.difficulty_levels || ['all'],
                    filterParams.num_questions
                );
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - this.state.setQuizFiltersForNewDynamicQuiz CONCLUÍDO.");
            }
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - RETORNANDO questions:", questions);
            return questions;
        } catch (error) {
            console.error("QuizLogic.js: _fetchAndPrepareQuestions - ERRO NO CATCH:", error, error.stack);
            const userMessage = this._getFriendlyErrorMessage(error, "Erro ao carregar perguntas do quiz.");
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Mensagem de erro para UI:", userMessage);
            if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
            this.state.initializeWithQuestions([], filterParams.mode || 'Erro');
            return null;
        } finally {
            this.isFetchingQuestions = false;
            if (triggerButton) this.ui.setButtonLoading(triggerButton, false, originalButtonText);
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - FINALIZANDO.");

            // Lógica para reexibir o hub se nenhum quiz iniciou e nenhum filtro/aviso está ativo
            const quizWillStart = this.state.currentQuestionsSet && this.state.currentQuestionsSet.length > 0;
             if (this.ui.elements.placeholderFiltrosContainer) {
                if (quizWillStart || (this.ui.elements.filterPanel && this.ui.elements.filterPanel.classList.contains('filter-panel--visible'))) {
                    this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                } else if (!this.ui.elements.avisoContainer || this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName)) {
                    // Se nenhum quiz vai começar e não há aviso sendo mostrado
                    // E o painel de filtros não está aberto, então reexibir o Hub
                    const filterPanelIsOpen = this.ui.elements.filterPanel && this.ui.elements.filterPanel.classList.contains('filter-panel--visible');
                    if (!filterPanelIsOpen && this.ui.challengeHubInstance) {
                         console.log("QuizLogic.js: _fetchAndPrepareQuestions - Quiz não iniciou, sem avisos/filtros. Mostrando Challenge Hub no finally.");
                         this.ui.challengeHubInstance.showHub();
                    }
                    this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                }
            }
        }
    }

    async applyFiltersAndStartQuiz() {
        console.log("QuizLogic.js: applyFiltersAndStartQuiz - Iniciado.");
        if (!this.ui.filterPanelInstance) {
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Erro: Painel de filtros indisponível.", 'error', true);
            console.error("QuizLogic.js: applyFiltersAndStartQuiz - filterPanelInstance indisponível.");
            return;
        }
        const selectedCategoryIds = this.ui.filterPanelInstance.getSelectedCategories();
        const selectedDifficulties = this.ui.filterPanelInstance.getSelectedDifficulties();
        const selectedNumQuestions = this.ui.filterPanelInstance.getSelectedNumberOfQuestions();
        console.log("QuizLogic.js: applyFiltersAndStartQuiz - Filtros selecionados:", {selectedCategoryIds, selectedDifficulties, selectedNumQuestions});


        if (this.ui.modalManager) this.ui.modalManager.toggleFilterPanel(false);

        const filterParams = {
            category_ids: selectedCategoryIds,
            difficulty_levels: selectedDifficulties,
            num_questions: selectedNumQuestions,
            mode: 'Por Categoria'
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: false, isPredefinedQuiz: false });

        if (questions && questions.length > 0) {
            console.log("QuizLogic.js: applyFiltersAndStartQuiz - Perguntas carregadas. Iniciando sessão...");
            await this._initiateQuizSession(questions, filterParams);
        } else {
            console.log("QuizLogic.js: applyFiltersAndStartQuiz - Nenhuma pergunta carregada ou erro. Sessão não iniciada.");
        }
    }

    async startQuickQuiz() {
        console.log("QuizLogic.js: startQuickQuiz - Iniciado.");
        const filterParams = {
            mode: 'Rápido',
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: true, isPredefinedQuiz: false });
        if (questions && questions.length > 0) {
            console.log("QuizLogic.js: startQuickQuiz - Perguntas carregadas. Iniciando sessão...");
            await this._initiateQuizSession(questions, filterParams);
        } else {
             console.log("QuizLogic.js: startQuickQuiz - Nenhuma pergunta carregada ou erro. Sessão não iniciada.");
        }
    }

    async startPredefinedQuiz(quizDefinicaoId) {
        console.log("QuizLogic.js: startPredefinedQuiz - Iniciado com ID:", quizDefinicaoId);
        if (!quizDefinicaoId) {
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("ID do Quiz Definido não fornecido.", 'error', true);
            console.error("QuizLogic.js: startPredefinedQuiz - ID não fornecido.");
            return;
        }
        const filterParams = {
            quiz_definicao_id: quizDefinicaoId,
            mode: 'Definido'
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: false, isPredefinedQuiz: true });
        if (questions && questions.length > 0) {
            console.log("QuizLogic.js: startPredefinedQuiz - Perguntas carregadas. Iniciando sessão...");
            await this._initiateQuizSession(questions, filterParams);
        } else {
            console.log("QuizLogic.js: startPredefinedQuiz - Nenhuma pergunta carregada ou erro. Sessão não iniciada.");
        }
    }


    async _initiateQuizSession(questionsForSession, sessionParams) {
        console.log("QuizLogic.js: _initiateQuizSession - Iniciando. Perguntas:", questionsForSession.length, "Params:", sessionParams);
        this.user.reset();
        if (this.ui.scorePanel) this.ui.scorePanel.resetDisplay();
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide();
        if (this.ui.timer) this.ui.timer.reset(0);
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        if (questionsForSession && questionsForSession.length > 0) {
            const questionIdsInSession = questionsForSession.map(q => q.id_pergunta);
            const sessionPayload = {
                modo_quiz: this.state.getQuizMode(), // Modo definido por _fetchAndPrepareQuestions no QuizState
                categoria_ids: sessionParams.category_ids || [],
                question_ids_in_session: questionIdsInSession,
                quiz_definicao_id: sessionParams.quiz_definicao_id,
                dificuldades_selecionadas: sessionParams.difficulty_levels,
                num_questoes_solicitadas: sessionParams.num_questions || sessionParams.count
            };
            console.log("QuizLogic.js: _initiateQuizSession - Payload para startQuizSession:", sessionPayload);

            try {
                const sessionDataFromBackend = await this.apiService.startQuizSession(sessionPayload);
                console.log("QuizLogic.js: _initiateQuizSession - Resposta de startQuizSession:", sessionDataFromBackend);
                if (sessionDataFromBackend && sessionDataFromBackend.status === 'success' && sessionDataFromBackend.session_id) {
                    this.state.currentSessionId = sessionDataFromBackend.session_id;
                    this.ui.displayQuizLayout(true);
                    this._displayCurrentQuestionUI(false);
                    if (this.ui.timer) this.ui.timer.start(0);
                    console.log("QuizLogic.js: _initiateQuizSession - Sessão iniciada com sucesso. ID:", this.state.currentSessionId);
                } else {
                    const userMessage = this._getFriendlyErrorMessage({ data: sessionDataFromBackend }, "Não foi possível iniciar a sessão de quiz.");
                    if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
                    console.error("QuizLogic.js: _initiateQuizSession - Falha ao iniciar sessão no backend:", userMessage);
                    this.ui.displayQuizLayout(false);
                    if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
                }
            } catch (error) {
                console.error("QuizLogic.js: _initiateQuizSession - Erro ao chamar startQuizSession:", error);
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao iniciar o quiz.");
                if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
                this.ui.displayQuizLayout(false);
                if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
            }
        } else {
            console.log("QuizLogic.js: _initiateQuizSession - Nenhuma pergunta para a sessão. Exibindo hub.");
            this.ui.displayQuizLayout(false);
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Nenhuma pergunta foi carregada para esta sessão.", 'info', true);
            if (this.ui.timer) this.ui.timer.stop();
            if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        }
    }

    async answerQuestion(selectedOptionId) {
        console.log("QuizLogic.js: answerQuestion - Opção selecionada ID:", selectedOptionId);
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion || currentQuestion.respostaDadaId !== undefined || !this.state.getSessionId()) {
            console.warn("QuizLogic.js: answerQuestion - Retornando cedo. Condições não atendidas.", {currentQuestion, sessionId: this.state.getSessionId()});
            return;
        }
        const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);
        if (!selectedOption) {
            console.warn("QuizLogic.js: answerQuestion - Opção selecionada não encontrada nos dados da pergunta.");
            return;
        }

        const isCorrect = selectedOption.eh_correta;
        this.state.recordAnswer(selectedOptionId, isCorrect);
        console.log(`QuizLogic.js: answerQuestion - Resposta registrada no estado. Correta: ${isCorrect}`);


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
            console.log("QuizLogic.js: answerQuestion - Enviando para API registerAnswer:", answerPayload);
            const responseData = await this.apiService.registerAnswer(answerPayload);
            console.log("QuizLogic.js: answerQuestion - Resposta de registerAnswer:", responseData);
            if (responseData && responseData.status === 'success') {
                this.user.updateFromServer(responseData.total_acertos_sessao, responseData.total_erros_sessao, responseData.pontuacao_sessao);
                if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            }
        } catch (error) {
            console.error("QuizLogic.js: answerQuestion - Erro de rede ao registrar resposta:", error.message || error);
        }
    }

    async _handleSkippedQuestion() {
        console.log("QuizLogic.js: _handleSkippedQuestion - Iniciado.");
        const currentQuestion = this.state.getCurrentQuestion();
        if (currentQuestion && this.state.getSessionId() && currentQuestion.respostaDadaId === undefined) {
            this.state.markAsSkipped();
            if (this.ui.questionDisplay) this.ui.questionDisplay.renderQuestionGrid();
            console.log("QuizLogic.js: _handleSkippedQuestion - Pergunta marcada como pulada no estado.");
            try {
                const skipPayload = {
                    session_id: this.state.getSessionId(),
                    pergunta_id: currentQuestion.id_pergunta,
                    opcao_id: null,
                    current_question_index: this.state.currentQuestionIndex
                };
                console.log("QuizLogic.js: _handleSkippedQuestion - Enviando para API registerAnswer (skip):", skipPayload);
                const response = await this.apiService.registerAnswer(skipPayload);
                console.log("QuizLogic.js: _handleSkippedQuestion - Resposta de registerAnswer (skip):", response);
                if (response && response.status === 'success') {
                    this.user.updateFromServer(response.total_acertos_sessao, response.total_erros_sessao, response.pontuacao_sessao);
                    if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);
                }
            } catch (err) {
                console.warn("QuizLogic.js: _handleSkippedQuestion - Erro ao registrar pulo de questão no backend:", err.message || err);
            }
        }
    }

    async nextQuestion() {
        console.log("QuizLogic.js: nextQuestion - Iniciado.");
        const isLastBeforeAdvance = this.state.isLastQuestion();
        if (this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion();
        }

        if (this.state.goToNextQuestion()) {
            if (this.state.isQuizComplete()) {
                console.log("QuizLogic.js: nextQuestion - Quiz completo. Finalizando...");
                await this.endQuiz();
            } else {
                console.log("QuizLogic.js: nextQuestion - Exibindo próxima questão.");
                this._displayCurrentQuestionUI();
            }
        } else if (isLastBeforeAdvance && !this.state.isQuizComplete()) {
            // Caso especial: estava na última, goToNextQuestion pode não ter avançado o índice para além do limite
            // mas a intenção é finalizar.
            console.log("QuizLogic.js: nextQuestion - Estava na última, finalizando quiz.");
            await this.endQuiz();
        } else if (this.state.isQuizComplete() && (!this.ui.elements.resultadoCard || this.ui.elements.resultadoCard.classList.contains(this.ui.hiddenClassName))) {
            // Se já está completo mas os resultados não foram mostrados
            console.log("QuizLogic.js: nextQuestion - Quiz já completo, mostrando resultados.");
            await this.endQuiz();
        }
    }

    async previousQuestion() {
        console.log("QuizLogic.js: previousQuestion - Iniciado.");
        if (this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion();
        }
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestionUI();
        }
    }

    async goToQuestion(index) {
        console.log("QuizLogic.js: goToQuestion - Indo para índice:", index);
        if (index !== this.state.currentQuestionIndex && this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion();
        }

        if (index >= this.state.getTotalFilteredQuestions() && this.state.getTotalFilteredQuestions() > 0) {
            console.log("QuizLogic.js: goToQuestion - Índice além do limite. Finalizando quiz.");
            await this.endQuiz();
        } else if (this.state.goToQuestion(index)) {
            this._displayCurrentQuestionUI();
        }
    }

    _displayCurrentQuestionUI(shouldScroll = true) {
        console.log("QuizLogic.js: _displayCurrentQuestionUI - Exibindo questão. Scroll:", shouldScroll);
        if (!this.ui.questionDisplay) {
            console.error("QuizLogic.js: _displayCurrentQuestionUI - questionDisplay não está disponível na UI.");
            return;
        }
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
                Promise.resolve().then(() => {
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
        console.log("QuizLogic.js: endQuiz - Iniciado. Forçado pelo usuário:", forceByUser);
        if (this.ui.timer) this.ui.timer.stop();
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        if (this.state.getSessionId()) {
            console.log("QuizLogic.js: endQuiz - Sessão ID existe:", this.state.getSessionId());
            try {
                const endSessionPayload = {
                    session_id: this.state.getSessionId(),
                    tempo_total_segundos: this.ui.timer ? this.ui.timer.getCurrentSeconds() : 0,
                };
                console.log("QuizLogic.js: endQuiz - Payload para endQuizSession:", endSessionPayload);
                const responseData = await this.apiService.endQuizSession(endSessionPayload);
                console.log("QuizLogic.js: endQuiz - Resposta de endQuizSession:", responseData);
                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) {
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                } else {
                    const userMessage = this._getFriendlyErrorMessage({ data: responseData }, "Problema ao finalizar sessão no servidor.");
                    if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'warning');
                     console.warn("QuizLogic.js: endQuiz - Problema ao finalizar sessão no backend:", userMessage);
                }
            } catch (error) {
                console.error("QuizLogic.js: endQuiz - Erro ao chamar endQuizSession:", error);
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao finalizar sessão.");
                if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'warning');
            } finally {
                this.state.currentSessionId = null;
                console.log("QuizLogic.js: endQuiz - SessionId limpo no estado.");
            }
        } else {
             console.log("QuizLogic.js: endQuiz - Nenhuma sessão ID para finalizar.");
        }

        if (this.ui.resultDisplay) {
            this.ui.resultDisplay.show(this.user, this.state.getTotalFilteredQuestions());
        } else {
            console.warn("QuizLogic.js: endQuiz - resultDisplay não disponível na UI. Exibindo layout padrão.");
            this.ui.displayQuizLayout(false);
            if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        }

        if (forceByUser && this.ui.modalManager) {
            this.ui.modalManager.toggleConfirmModal(false);
        }
         console.log("QuizLogic.js: endQuiz - Finalizado.");
    }

    restartQuiz() {
        console.log("QuizLogic.js: restartQuiz - Iniciado.");
        this.user.reset();
        this.state.fullReset();
        if (this.ui.scorePanel) this.ui.scorePanel.resetDisplay();
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide();
        if (this.ui.timer) this.ui.timer.reset(0);
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);
        this.ui.displayQuizLayout(false);
        if (this.ui.warningDisplay) this.ui.warningDisplay.clear();
        if (this.ui.filterPanelInstance) this.ui.filterPanelInstance.resetFiltersToDefault();
        if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        if(this.ui.elements.placeholderFiltrosContainer) this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
        console.log("QuizLogic.js: restartQuiz - Finalizado. Hub deve estar visível.");
    }

    async forceEndQuizByUser() {
        console.log("QuizLogic.js: forceEndQuizByUser - Chamado.");
        await this.endQuiz(true);
    }

    async toggleFavoriteCurrentQuestion() {
        console.log("QuizLogic.js: toggleFavoriteCurrentQuestion - Iniciado.");
        if (!this.ui.userIsAuthenticated) {
            this.ui.showWarning("Faça login para favoritar questões.", 'info');
            return;
        }
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion) {
            console.warn("QuizLogic.js: toggleFavoriteCurrentQuestion - Nenhuma pergunta atual.");
            return;
        }

        const perguntaId = currentQuestion.id_pergunta;
        const btnFav = this.ui.elements.btnToggleFavorite;
        if(btnFav) this.ui.setButtonLoading(btnFav, true);

        try {
            console.log("QuizLogic.js: toggleFavoriteCurrentQuestion - Chamando API para pergunta ID:", perguntaId);
            const response = await this.apiService.toggleFavoriteStatus(perguntaId);
            console.log("QuizLogic.js: toggleFavoriteCurrentQuestion - Resposta da API:", response);
            if (response && response.status === 'success') {
                this.ui.favoriteManager.updateFavoriteButtonState(response.is_favorited);
                this.state.updateFavoriteStatusForCurrentQuestion(response.is_favorited);
            } else {
                const msg = this._getFriendlyErrorMessage({ data: response }, "Falha ao atualizar status de favorito.");
                this.ui.showWarning(msg, 'error');
                console.error("QuizLogic.js: toggleFavoriteCurrentQuestion - Falha na API:", msg);
            }
        } catch (error) {
            console.error("QuizLogic.js: toggleFavoriteCurrentQuestion - Erro na API:", error);
            const msg = this._getFriendlyErrorMessage(error, "Erro de conexão ao tentar favoritar.");
            this.ui.showWarning(msg, 'error');
        } finally {
            if(btnFav) this.ui.setButtonLoading(btnFav, false);
        }
    }

    async loadAndDisplayFavoriteQuestionsForAccountPage() {
        console.log("QuizLogic.js: loadAndDisplayFavoriteQuestionsForAccountPage - Chamado.");
        if (this.ui.favoriteManager) {
            await this.ui.favoriteManager.loadUserFavorites();
        } else {
            console.warn("QuizLogic.js: loadAndDisplayFavoriteQuestionsForAccountPage - favoriteManager não disponível.");
        }
    }
}