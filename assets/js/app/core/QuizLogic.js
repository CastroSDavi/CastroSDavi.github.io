// File: assets/js/app/core/QuizLogic.js

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        this.isFetchingQuestions = false;
        console.log("QuizLogic.js: CONSTRUCTOR - Instância QuizLogic criada.");

        if (this.ui) {
            this.ui.setCallbacks({
                answerQuestionCallback: this.answerQuestion.bind(this),
                navigationCallback: this._handleQuestionNavigation.bind(this),
                toggleFavoriteCallback: this.toggleFavoriteCurrentQuestion.bind(this),
                endSessionCallback: () => {
                    console.log("QuizLogic.js: Callback endSessionCallback chamado (para abrir modal de confirmação).");
                    if (this.ui.modalManager) this.ui.modalManager.toggleConfirmModal(true);
                },
                restartQuizCallback: this.restartQuiz.bind(this),
            });
        } else {
            console.error("QuizLogic.js: CONSTRUCTOR - ERRO: this.ui é NULO ou INDEFINIDO.");
        }
    }

    async initializeQuizPage() {
        console.log("QuizLogic.js: initializeQuizPage - Entrou.");
        if (!this.state) {
            console.error("QuizLogic.js: initializeQuizPage - ERRO CRÍTICO: this.state é NULO ou INDEFINIDO.");
            if (this.ui?.challengeHubInstance) {
                console.log("QuizLogic.js: initializeQuizPage - Mostrando Challenge Hub devido a estado nulo.");
                this.ui.challengeHubInstance.showHub();
            }
            return;
        }
        const isActive = this.state.isQuizActive ? this.state.isQuizActive() : "ERRO: método isQuizActive ausente";
        console.log("QuizLogic.js: initializeQuizPage - this.state.isQuizActive:", isActive);

        if (this.ui.userIsAuthenticated && !this.state.isQuizActive()) {
            console.log("QuizLogic.js: initializeQuizPage - Usuário autenticado, sem quiz ativo. Tentando retomar sessão...");
            const resumed = await this.tryResumeSession();
            if (!resumed && this.ui.challengeHubInstance) {
                console.log("QuizLogic.js: initializeQuizPage - Sessão não retomada. Mostrando Challenge Hub.");
                this.ui.challengeHubInstance.showHub();
            }
        } else if (this.ui.challengeHubInstance) {
            if(this.state.isQuizActive()){
                 console.log("QuizLogic.js: initializeQuizPage - Quiz já ativo. Não mostrando Challenge Hub. Deixando UI como está.");
                 if (this.ui.elements.quizSectionContent?.classList.contains(this.ui.hiddenClassName)) {
                    console.warn("QuizLogic.js: initializeQuizPage - Quiz ativo, mas quizSectionContent está escondido. Verifique a lógica de exibição da UI.");
                 }
            } else {
                console.log("QuizLogic.js: initializeQuizPage - Usuário não autenticado ou nenhum quiz ativo. Mostrando Challenge Hub.");
                this.ui.challengeHubInstance.showHub();
            }
        } else {
            console.warn("QuizLogic.js: initializeQuizPage - ChallengeHubInstance não disponível.");
        }
    }

    async tryResumeSession() {
        console.log("QuizLogic.js: tryResumeSession - Entrou.");
        if (!this.apiService) {
            console.error("QuizLogic.js: tryResumeSession - ERRO: apiService não está definido.");
            return false;
        }
        try {
            const resumeData = await this.apiService.resumeQuizSession();
            console.log("QuizLogic.js: tryResumeSession - Dados da API:", resumeData);
            if (resumeData && resumeData.status === 'success' && resumeData.perguntas?.length > 0) {
                console.log("QuizLogic.js: tryResumeSession - Sucesso. Rehidratando estado...");
                this.state.rehydrateFromResumedSession(resumeData);
                this.user.updateFromServer(resumeData.total_acertos_atual, resumeData.total_erros_atual, resumeData.pontuacao_atual);

                console.log("QuizLogic.js: tryResumeSession - Chamando this.ui.displayQuizLayout(true).");
                this.ui.displayQuizLayout(true);
                console.log("QuizLogic.js: tryResumeSession - Chamando _displayCurrentQuestionUI.");
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
                console.log("QuizLogic.js: tryResumeSession - Sessão retomada e UI atualizada com sucesso.");
                return true;
            }
            console.log("QuizLogic.js: tryResumeSession - Não foi possível retomar (resposta da API sem sucesso ou sem perguntas).");
        } catch (error) {
            console.warn("QuizLogic.js: tryResumeSession - ERRO durante a tentativa de retomar:", error.message, error);
        }
        return false;
    }


    async _handleQuestionNavigation(target) {
        console.log(`QuizLogic.js: _handleQuestionNavigation - Target: ${target}`);
        if (target === 'next') await this.nextQuestion();
        else if (target === 'prev') await this.previousQuestion();
        else if (typeof target === 'number') await this.goToQuestion(target);
    }

    _getFriendlyErrorMessage(error, defaultMessage = "Ocorreu um erro inesperado. Tente novamente.") {
        // console.log("QuizLogic.js: _getFriendlyErrorMessage - Erro original:", error);
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
            return error.message;
        }
        return defaultMessage;
    }

    async _fetchAndPrepareQuestions(filterParams, quizTypeContext = { isQuickQuiz: false, isPredefinedQuiz: false }) {
        if (this.isFetchingQuestions) {
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Já buscando, retornando.");
            return null;
        }
        this.isFetchingQuestions = true;
        console.log("QuizLogic.js: _fetchAndPrepareQuestions - Iniciando. Filtros:", JSON.stringify(filterParams), "Contexto:", JSON.stringify(quizTypeContext));

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
            const questionsArray = await this.quizData.fetchFilteredQuestions(filterParams); 
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Perguntas da API (após QuizData.fetchFilteredQuestions):", questionsArray ? questionsArray.length : "Nulo/Indefinido");

            if (!questionsArray || questionsArray.length === 0) {
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - Nenhuma pergunta encontrada.");
                this.state.initializeWithQuestions([], filterParams.mode || 'Desconhecido');
                if (this.state && typeof this.state.setQuizDisplayContext === 'function') {
                    this.state.setQuizDisplayContext('none', ''); 
                } else {
                    console.error("QuizLogic.js: _fetchAndPrepareQuestions (Nenhuma pergunta) - ERRO: this.state.setQuizDisplayContext não é uma função!");
                }
                if (this.ui.warningDisplay) { 
                    const message = quizTypeContext.isQuickQuiz
                        ? "Nenhuma pergunta para Quiz Rápido."
                        : (quizTypeContext.isPredefinedQuiz ? "Este quiz definido não possui perguntas ou está inativo." : "Nenhuma questão para os filtros selecionados.");
                    this.ui.warningDisplay.show(message, 'info', true);
                }
            } else {
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - Perguntas encontradas. Inicializando estado...");
                this.state.initializeWithQuestions(questionsArray, filterParams.mode, null, filterParams.quiz_definicao_id);

                let displayMode = 'challenge';
                let mainQuizTitle = 'Desafio Personalizado';

                if (quizTypeContext.isQuickQuiz) {
                    mainQuizTitle = 'Quiz Rápido';
                } else if (quizTypeContext.isPredefinedQuiz && filterParams.quiz_definicao_id) {
                    const quizDefName = this.quizData.getLastFetchedQuizDefinitionName();
                    console.log("QuizLogic.js: _fetchAndPrepareQuestions - Nome do Quiz Definido (de QuizData):", quizDefName);
                    if (quizDefName) {
                        displayMode = 'focused';
                        mainQuizTitle = quizDefName;
                    } else {
                        mainQuizTitle = "Quiz Temático"; 
                        displayMode = 'focused';
                    }
                } else if (filterParams.category_ids && filterParams.category_ids.length === 1) {
                    const singleCategoryId = parseInt(filterParams.category_ids[0], 10);
                    const allCategories = this.quizData.getCategorias();
                    const category = allCategories.find(cat => cat.id_categoria === singleCategoryId);
                    if (category) {
                        displayMode = 'focused';
                        mainQuizTitle = category.nome_categoria;
                    }
                }
                console.log(`QuizLogic.js: _fetchAndPrepareQuestions - Definindo quizDisplayContext: Mode='${displayMode}', Title='${mainQuizTitle}'`);
                
                if (this.state && typeof this.state.setQuizDisplayContext === 'function') {
                    this.state.setQuizDisplayContext(displayMode, mainQuizTitle);
                } else {
                    console.error("QuizLogic.js: _fetchAndPrepareQuestions (Com perguntas) - ERRO: this.state.setQuizDisplayContext não é uma função!");
                }
            }

            if (!quizTypeContext.isPredefinedQuiz) {
                this.state.setQuizFiltersForNewDynamicQuiz(filterParams.category_ids || [], filterParams.difficulty_levels || ['all'], filterParams.num_questions);
            }
            return questionsArray;
        } catch (error) {
            console.error("QuizLogic.js: _fetchAndPrepareQuestions - ERRO no CATCH:", error);
            const userMessage = this._getFriendlyErrorMessage(error, "Erro ao carregar perguntas do quiz.");
            if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
            this.state.initializeWithQuestions([], filterParams.mode || 'Erro');
            if (this.state && typeof this.state.setQuizDisplayContext === 'function') {
                this.state.setQuizDisplayContext('none', '');
            } else {
                 console.error("QuizLogic.js: _fetchAndPrepareQuestions (CATCH) - ERRO: this.state.setQuizDisplayContext não é uma função!");
            }
            return null;
        } finally {
            this.isFetchingQuestions = false;
            if (triggerButton) this.ui.setButtonLoading(triggerButton, false, originalButtonText);
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Finalizado.");

            const quizWillStart = this.state.currentQuestionsSet && this.state.currentQuestionsSet.length > 0;
             if (this.ui.elements.placeholderFiltrosContainer) {
                if (quizWillStart || (this.ui.elements.filterPanel && this.ui.elements.filterPanel.classList.contains('filter-panel--visible'))) {
                    this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                } else if (!this.ui.elements.avisoContainer || this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName)) {
                    const filterPanelIsOpen = this.ui.elements.filterPanel && this.ui.elements.filterPanel.classList.contains('filter-panel--visible');
                    if (!filterPanelIsOpen && this.ui.challengeHubInstance) {
                         this.ui.challengeHubInstance.showHub();
                    }
                    this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                }
            }
        }
    }
    async applyFiltersAndStartQuiz() {
        console.log("QuizLogic.js: applyFiltersAndStartQuiz - Entrou.");
        if (!this.ui.filterPanelInstance) {
            console.error("QuizLogic.js: applyFiltersAndStartQuiz - ERRO: filterPanelInstance não disponível.");
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Erro: Painel de filtros indisponível.", 'error', true);
            return;
        }
        const selectedCategoryIds = this.ui.filterPanelInstance.getSelectedCategories();
        const selectedDifficulties = this.ui.filterPanelInstance.getSelectedDifficulties();
        const selectedNumQuestions = this.ui.filterPanelInstance.getSelectedNumberOfQuestions();
        console.log("QuizLogic.js: applyFiltersAndStartQuiz - Filtros obtidos:", {selectedCategoryIds, selectedDifficulties, selectedNumQuestions});

        if (this.ui.modalManager) this.ui.modalManager.toggleFilterPanel(false);

        const filterParams = {
            category_ids: selectedCategoryIds,
            difficulty_levels: selectedDifficulties,
            num_questions: selectedNumQuestions,
            mode: 'Por Categoria'
        };
        console.log("QuizLogic.js: applyFiltersAndStartQuiz - Chamando _fetchAndPrepareQuestions com filtros:", filterParams);
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: false, isPredefinedQuiz: false });

        if (questions && questions.length > 0) {
            console.log("QuizLogic.js: applyFiltersAndStartQuiz - Perguntas carregadas (" + questions.length + "). Chamando _initiateQuizSession.");
            await this._initiateQuizSession(questions, filterParams);
        } else {
            console.log("QuizLogic.js: applyFiltersAndStartQuiz - Nenhuma pergunta para iniciar ou erro ao buscar.");
             if (this.ui.challengeHubInstance && (!this.ui.elements.avisoContainer || this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName))) {
                console.log("QuizLogic.js: applyFiltersAndStartQuiz - Mostrando Challenge Hub pois não há perguntas.");
                this.ui.challengeHubInstance.showHub(); 
            }
        }
    }

    async startQuickQuiz() {
        console.log("QuizLogic.js: startQuickQuiz - Entrou.");
        const filterParams = { mode: 'Rápido' };
        console.log("QuizLogic.js: startQuickQuiz - Chamando _fetchAndPrepareQuestions.");
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: true, isPredefinedQuiz: false });
        
        if (questions && questions.length > 0) {
            console.log("QuizLogic.js: startQuickQuiz - Perguntas carregadas (" + questions.length + "). Chamando _initiateQuizSession.");
            await this._initiateQuizSession(questions, filterParams);
        } else {
            console.log("QuizLogic.js: startQuickQuiz - Nenhuma pergunta para iniciar ou erro ao buscar.");
            if (this.ui.challengeHubInstance && (!this.ui.elements.avisoContainer || this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName))) {
                console.log("QuizLogic.js: startQuickQuiz - Mostrando Challenge Hub pois não há perguntas.");
                this.ui.challengeHubInstance.showHub();
            }
        }
    }

    async startPredefinedQuiz(quizDefinicaoId) {
        console.log("QuizLogic.js: startPredefinedQuiz - Entrou com ID:", quizDefinicaoId);
        if (!quizDefinicaoId) {
            console.error("QuizLogic.js: startPredefinedQuiz - ERRO: ID do Quiz Definido não fornecido.");
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("ID do Quiz Definido não fornecido.", 'error', true);
            return;
        }
        const filterParams = {
            quiz_definicao_id: quizDefinicaoId,
            mode: 'Definido'
        };
        console.log("QuizLogic.js: startPredefinedQuiz - Chamando _fetchAndPrepareQuestions com filtros:", filterParams);
        const questions = await this._fetchAndPrepareQuestions(filterParams, { isQuickQuiz: false, isPredefinedQuiz: true });

        if (questions && questions.length > 0) {
            console.log("QuizLogic.js: startPredefinedQuiz - Perguntas carregadas (" + questions.length + "). Chamando _initiateQuizSession.");
            await this._initiateQuizSession(questions, filterParams);
        } else {
            console.log("QuizLogic.js: startPredefinedQuiz - Nenhuma pergunta para iniciar ou erro ao buscar.");
             if (this.ui.challengeHubInstance && (!this.ui.elements.avisoContainer || this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName))) {
                console.log("QuizLogic.js: startPredefinedQuiz - Mostrando Challenge Hub pois não há perguntas.");
                this.ui.challengeHubInstance.showHub();
            }
        }
    }

    async _initiateQuizSession(questionsForSession, sessionParams) {
        console.log("QuizLogic.js: _initiateQuizSession - Entrou. N_Perguntas:", questionsForSession?.length, "Params:", JSON.stringify(sessionParams));
        this.user.reset();
        if (this.ui.scorePanel) this.ui.scorePanel.resetDisplay();
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide();
        if (this.ui.timer) this.ui.timer.reset(0);
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        if (questionsForSession && questionsForSession.length > 0) {
            const questionIdsInSession = questionsForSession.map(q => q.id_pergunta);
            const sessionPayload = {
                modo_quiz: this.state.getQuizMode(), // Modo já definido no estado por _fetchAndPrepareQuestions
                categoria_ids: sessionParams.category_ids || [],
                question_ids_in_session: questionIdsInSession,
                quiz_definicao_id: sessionParams.quiz_definicao_id,
                dificuldades_selecionadas: sessionParams.difficulty_levels,
                num_questoes_solicitadas: sessionParams.num_questions || sessionParams.count // Para quiz rápido
            };
            console.log("QuizLogic.js: _initiateQuizSession - Payload para API startQuizSession:", JSON.stringify(sessionPayload));

            try {
                const sessionDataFromBackend = await this.apiService.startQuizSession(sessionPayload);
                console.log("QuizLogic.js: _initiateQuizSession - Resposta da API startQuizSession:", sessionDataFromBackend);
                if (sessionDataFromBackend && sessionDataFromBackend.status === 'success' && sessionDataFromBackend.session_id) {
                    this.state.currentSessionId = sessionDataFromBackend.session_id;
                    console.log("QuizLogic.js: _initiateQuizSession - Sessão ID definida no estado:", this.state.currentSessionId);
                    
                    console.log("QuizLogic.js: _initiateQuizSession - Chamando this.ui.displayQuizLayout(true).");
                    this.ui.displayQuizLayout(true);
                    console.log("QuizLogic.js: _initiateQuizSession - Chamando _displayCurrentQuestionUI.");
                    this._displayCurrentQuestionUI(false); // quizDisplayContext é pego de this.state por QuestionDisplay
                    
                    if (this.ui.timer) this.ui.timer.start(0);
                    console.log("QuizLogic.js: _initiateQuizSession - Sessão iniciada com sucesso e UI deve estar pronta.");
                } else {
                    const userMessage = this._getFriendlyErrorMessage({ data: sessionDataFromBackend }, "Não foi possível iniciar a sessão de quiz.");
                    console.error("QuizLogic.js: _initiateQuizSession - Falha ao iniciar sessão no backend:", userMessage, sessionDataFromBackend);
                    if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
                    this.ui.displayQuizLayout(false);
                    if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
                }
            } catch (error) {
                console.error("QuizLogic.js: _initiateQuizSession - ERRO ao chamar startQuizSession API:", error);
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao iniciar o quiz.");
                if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'error', true);
                this.ui.displayQuizLayout(false);
                if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
            }
        } else {
            console.log("QuizLogic.js: _initiateQuizSession - Nenhuma pergunta para a sessão. Exibindo hub (se existir).");
            this.ui.displayQuizLayout(false);
            if (this.ui.warningDisplay) this.ui.warningDisplay.show("Nenhuma pergunta foi carregada para esta sessão.", 'info', true);
            if (this.ui.timer) this.ui.timer.stop();
            if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.showHub();
        }
         console.log("QuizLogic.js: _initiateQuizSession - Saindo.");
    }

    async answerQuestion(selectedOptionId) {
        console.log(`QuizLogic.js: answerQuestion - Opção ID: ${selectedOptionId}`);
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion || currentQuestion.respostaDadaId !== undefined || !this.state.getSessionId()) {
            console.warn("QuizLogic.js: answerQuestion - Retorno antecipado. Pergunta já respondida, nula, ou sem sessão ID.");
            return;
        }
        const options = currentQuestion.opcoes; 
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);

        if (!selectedOption) {
            console.warn("QuizLogic.js: answerQuestion - Opção selecionada não encontrada na pergunta atual.");
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
        console.log("QuizLogic.js: _handleSkippedQuestion - Entrou.");
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
        console.log("QuizLogic.js: nextQuestion - Entrou.");
        const isLastBeforeAdvance = this.state.isLastQuestion();
        const currentQ = this.state.getCurrentQuestion();
        if (currentQ && currentQ.respostaDadaId === undefined) { // Se a pergunta atual ainda não foi respondida/pulada
            console.log("QuizLogic.js: nextQuestion - Pergunta atual não respondida. Marcando como pulada.");
            await this._handleSkippedQuestion();
        }

        if (this.state.goToNextQuestion()) { // Avança o índice
            if (this.state.isQuizComplete()) { // Checa se o novo índice está além do limite
                console.log("QuizLogic.js: nextQuestion - Quiz completo (índice >= total). Finalizando...");
                await this.endQuiz();
            } else {
                console.log("QuizLogic.js: nextQuestion - Exibindo próxima questão no índice:", this.state.currentQuestionIndex);
                this._displayCurrentQuestionUI();
            }
        } else if (isLastBeforeAdvance && !this.state.isQuizComplete()) { 
            // Estava na última, mas goToNextQuestion não avançou (o que significa que já estava no limite para ser completo)
            console.log("QuizLogic.js: nextQuestion - Estava na última e goToNextQuestion indicou fim. Finalizando quiz.");
            await this.endQuiz();
        } else if (this.state.isQuizComplete() && (!this.ui.elements.resultadoCard || this.ui.elements.resultadoCard.classList.contains(this.ui.hiddenClassName))) {
            console.log("QuizLogic.js: nextQuestion - Quiz já marcado como completo, mas resultados não mostrados. Mostrando resultados.");
            await this.endQuiz();
        } else {
            console.log("QuizLogic.js: nextQuestion - Não avançou nem finalizou. Estado atual:", { isLast: isLastBeforeAdvance, isComplete: this.state.isQuizComplete(), currentIndex: this.state.currentQuestionIndex, totalQ: this.state.getTotalFilteredQuestions() });
        }
    }

    async previousQuestion() {
        console.log("QuizLogic.js: previousQuestion - Entrou.");
        const currentQ = this.state.getCurrentQuestion();
        if (currentQ && currentQ.respostaDadaId === undefined) { // Se a pergunta atual ainda não foi respondida/pulada
            console.log("QuizLogic.js: previousQuestion - Pergunta atual não respondida. Marcando como pulada.");
            await this._handleSkippedQuestion();
        }
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestionUI();
        } else {
            console.log("QuizLogic.js: previousQuestion - Não foi possível ir para a anterior (provavelmente já é a primeira).");
        }
    }

    async goToQuestion(index) {
        console.log(`QuizLogic.js: goToQuestion - Indo para índice: ${index}`);
        const currentQ = this.state.getCurrentQuestion();
        if (index !== this.state.currentQuestionIndex && currentQ && currentQ.respostaDadaId === undefined) {
            console.log("QuizLogic.js: goToQuestion - Pergunta atual não respondida. Marcando como pulada antes de navegar.");
            await this._handleSkippedQuestion();
        }

        if (index >= this.state.getTotalFilteredQuestions() && this.state.getTotalFilteredQuestions() > 0) {
            // Isso significa que o usuário clicou em um "número de questão" no grid que representa o "fim"
            console.log(`QuizLogic.js: goToQuestion - Índice ${index} é para finalizar o quiz (total: ${this.state.getTotalFilteredQuestions()}). Finalizando quiz.`);
            await this.endQuiz();
        } else if (this.state.goToQuestion(index)) {
            this._displayCurrentQuestionUI();
        } else {
             console.log(`QuizLogic.js: goToQuestion - Não foi possível ir para o índice ${index}. (Índice: ${index}, Total: ${this.state.getTotalFilteredQuestions()})`);
        }
    }

    _displayCurrentQuestionUI(shouldScroll = true) {
        console.log("QuizLogic.js: _displayCurrentQuestionUI - Entrou. Scroll:", shouldScroll);
        if (!this.ui.questionDisplay) {
            console.error("QuizLogic.js: _displayCurrentQuestionUI - ERRO: this.ui.questionDisplay é NULO ou INDEFINIDO.");
            return;
        }
        const currentQ = this.state.getCurrentQuestion();
        if (!currentQ) {
            console.warn("QuizLogic.js: _displayCurrentQuestionUI - Nenhuma pergunta atual no estado para exibir.");
             if (this.state.isQuizActive() && this.state.getTotalFilteredQuestions() > 0 && !this.state.isQuizComplete()) { 
                console.error("QuizLogic.js: _displayCurrentQuestionUI - Tentativa de exibir pergunta nula com quiz ativo e não completo. Verifique currentQuestionIndex:", this.state.currentQuestionIndex, "Total:", this.state.getTotalFilteredQuestions());
             } else if (this.state.isQuizComplete()){
                console.log("QuizLogic.js: _displayCurrentQuestionUI - getCurrentQuestion retornou nulo, mas o quiz está completo. Chamando endQuiz.");
                this.endQuiz(); // Se está completo, mas por alguma razão não mostrou resultados, força.
             } else if (!this.state.isQuizActive() && this.ui.challengeHubInstance) {
                console.log("QuizLogic.js: _displayCurrentQuestionUI - getCurrentQuestion retornou nulo e quiz não está ativo. Mostrando Hub.");
                this.ui.challengeHubInstance.showHub();
             }
            return;
        }

        console.log("QuizLogic.js: _displayCurrentQuestionUI - Chamando this.ui.questionDisplay.displayCurrentQuestion(). Pergunta ID:", currentQ.id_pergunta);
        
        const questionWrapper = this.ui.elements.questionWrap;
        const isInitialLoad = this.state.isInitialQuestionLoad;

        const displayLogic = () => {
            this.ui.questionDisplay.displayCurrentQuestion(); // QuestionDisplay pegará o contexto de this.state
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
        console.log("QuizLogic.js: _displayCurrentQuestionUI - Finalizado para pergunta ID:", currentQ.id_pergunta);
    }

    async endQuiz(forceByUser = false) {
        console.log(`QuizLogic.js: endQuiz - Entrou. Forçado pelo usuário: ${forceByUser}`);
        if (this.ui.timer) this.ui.timer.stop();
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        const sessionId = this.state.getSessionId(); // Pega o ID da sessão ANTES de resetar
        const totalQuestionsInThisSession = this.state.getTotalFilteredQuestions(); // Pega antes de resetar

        if (sessionId) {
            console.log("QuizLogic.js: endQuiz - Sessão ID:", sessionId);
            try {
                const endSessionPayload = {
                    session_id: sessionId,
                    tempo_total_segundos: this.ui.timer ? this.ui.timer.getCurrentSeconds() : 0,
                };
                console.log("QuizLogic.js: endQuiz - Payload para endQuizSession:", endSessionPayload);
                const responseData = await this.apiService.endQuizSession(endSessionPayload);
                console.log("QuizLogic.js: endQuiz - Resposta de endQuizSession:", responseData);

                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) {
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                    console.log("QuizLogic.js: endQuiz - Dados do usuário atualizados do backend.");
                } else {
                    const userMessage = this._getFriendlyErrorMessage({ data: responseData }, "Problema ao finalizar sessão no servidor.");
                    console.warn("QuizLogic.js: endQuiz - Problema ao finalizar sessão no backend:", userMessage, responseData);
                    if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'warning');
                }
            } catch (error) {
                console.error("QuizLogic.js: endQuiz - ERRO ao chamar endQuizSession API:", error);
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao finalizar sessão.");
                if (this.ui.warningDisplay) this.ui.warningDisplay.show(userMessage, 'warning');
            } finally {
                // Não reseta o estado aqui imediatamente, apenas o ID da sessão.
                // O fullReset ou resetQuizStateForNewSession será feito em restartQuiz.
                this.state.currentSessionId = null; 
                console.log("QuizLogic.js: endQuiz - SessionId limpo no estado.");
            }
        } else {
             console.log("QuizLogic.js: endQuiz - Nenhuma sessão ID para finalizar.");
        }
        
        if (this.ui.resultDisplay) {
            console.log("QuizLogic.js: endQuiz - Exibindo resultados. UserData:", this.user, "Total Perguntas:", totalQuestionsInThisSession);
            this.ui.resultDisplay.show(this.user, totalQuestionsInThisSession);
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
        console.log("QuizLogic.js: restartQuiz - Entrou.");
        this.user.reset();
        this.state.fullReset(); 
        if (this.ui.scorePanel) this.ui.scorePanel.resetDisplay();
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide();
        if (this.ui.timer) this.ui.timer.reset(0);
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);
        
        console.log("QuizLogic.js: restartQuiz - Chamando this.ui.displayQuizLayout(false).");
        this.ui.displayQuizLayout(false);
        
        if (this.ui.warningDisplay) this.ui.warningDisplay.clear();
        if (this.ui.filterPanelInstance) this.ui.filterPanelInstance.resetFiltersToDefault();
        
        if (this.ui.challengeHubInstance) {
            console.log("QuizLogic.js: restartQuiz - Mostrando Challenge Hub.");
            this.ui.challengeHubInstance.showHub();
        } else {
            console.warn("QuizLogic.js: restartQuiz - challengeHubInstance não definido.");
        }
        if(this.ui.elements.placeholderFiltrosContainer) this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
        console.log("QuizLogic.js: restartQuiz - Finalizado.");
    }

    async forceEndQuizByUser() {
        console.log("QuizLogic.js: forceEndQuizByUser - Chamado.");
        await this.endQuiz(true);
    }

    async toggleFavoriteCurrentQuestion() {
        console.log("QuizLogic.js: toggleFavoriteCurrentQuestion - Entrou.");
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
        console.log("QuizLogic.js: loadAndDisplayFavoriteQuestionsForAccountPage - Entrou.");
        if (this.ui.favoriteManager) {
            await this.ui.favoriteManager.loadUserFavorites();
        } else {
            console.warn("QuizLogic.js: loadAndDisplayFavoriteQuestionsForAccountPage - favoriteManager não disponível.");
        }
    }
}