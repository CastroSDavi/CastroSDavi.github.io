// File: assets/js/app/core/QuizLogic.js
import { TRANSITION_DURATION } from '../../utils/constants.js'; // Certifique-se que está sendo usado ou remova

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        // console.log("QUIZLOGIC.JS: Constructor - Inicializando QuizLogic");
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        this.challengeHub = null;
        this.filterPanel = null;
        this.currentSessionId = null;
        this.isFetchingQuestions = false;
        // console.log("QUIZLOGIC.JS: Constructor - Instâncias recebidas:", { quizState, quizUI, userData, quizData, apiService });
    }

    setChallengeHub(challengeHubInstance) {
        // console.log("QUIZLOGIC.JS: setChallengeHub - Instância de ChallengeHub definida:", challengeHubInstance);
        this.challengeHub = challengeHubInstance;
    }

    setFilterPanel(filterPanelInstance) {
        // console.log("QUIZLOGIC.JS: setFilterPanel - Instância de FilterPanel definida:", filterPanelInstance);
        this.filterPanel = filterPanelInstance;
    }

    /**
     * Helper para gerar mensagens de erro amigáveis para o usuário.
     * @param {Error} error - O objeto de erro capturado.
     * @param {string} defaultMessage - Mensagem padrão se nenhuma outra for adequada.
     * @returns {string} Mensagem de erro formatada para o usuário.
     */
    _getFriendlyErrorMessage(error, defaultMessage = "Ocorreu um erro inesperado. Tente novamente.") {
        // console.error("Full error object:", error); // Para depuração
        if (!error.response && error.message && error.message.toLowerCase().includes('failed to fetch')) {
            return "Falha na conexão com o servidor. Verifique sua internet e tente novamente.";
        }
        if (error.data && error.data.message) {
            return error.data.message; // Mensagem específica da API
        }
        if (error.response && error.response.status) {
            const status = error.response.status;
            if (status === 500) return "Ocorreu um problema em nosso servidor. Por favor, tente novamente mais tarde.";
            if (status === 404) return "O recurso solicitado não foi encontrado em nosso sistema.";
            if (status === 403) return "Você não tem permissão para realizar esta ação.";
            if (status === 401) return "Sua sessão pode ter expirado ou você não está autenticado. Por favor, faça login novamente.";
            if (status >= 400 && status < 500) return "Houve um problema com sua solicitação. Verifique os dados ou seleções e tente novamente.";
        }
        if (error.message) { // Fallback para a mensagem do objeto Error, mas menos técnico
            return defaultMessage; // Evita expor detalhes técnicos da mensagem original do erro
        }
        return defaultMessage;
    }


    async _fetchAndPrepareQuestions(filterParams, isQuickQuiz = false) {
        // console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Iniciado. Filtros:", filterParams, "É rápido:", isQuickQuiz);
        if (this.isFetchingQuestions) {
            console.warn("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Já buscando perguntas, retornando null.");
            return null;
        }
        this.isFetchingQuestions = true;

        const triggerButton = isQuickQuiz ? this.ui.elements.hubQuickQuizBtn : this.ui.elements.btnAplicarFiltrosPainel;
        const originalButtonText = triggerButton ? (triggerButton.querySelector('.button__label') || triggerButton).textContent : (isQuickQuiz ? "Quiz Rápido" : "Aplicar Filtros");
        if(triggerButton) this.ui.setButtonLoading(triggerButton, true, originalButtonText);
        
        // Esconder o hub e mostrar o placeholder de filtros pode ser feito aqui ou antes
        if (this.ui.elements.challengeHubContainer) this.ui.hideElement(this.ui.elements.challengeHubContainer);
        if (this.filterPanel && !isQuickQuiz && this.ui.elements.placeholderFiltrosContainer) {
             // Apenas mostra o placeholder se for um quiz personalizado e o painel de filtros estiver fechado.
            if (!this.ui.elements.filterPanel.classList.contains('filter-panel--visible')) {
                this.ui.showElement(this.ui.elements.placeholderFiltrosContainer);
            }
        }


        this.ui.hideElement(this.ui.elements.quizSectionContent);
        this.ui.clearWarning();

        try {
            const questions = await this.quizData.fetchFilteredQuestions(filterParams);
            if (!questions || questions.length === 0) {
                this.state.initializeWithQuestions([]);
                 this.ui.showWarning(
                    isQuickQuiz
                        ? "Nenhuma pergunta disponível para um Quiz Rápido no momento. Que tal tentar personalizar um?"
                        : "Nenhuma questão encontrada para os filtros selecionados. Por favor, ajuste suas preferências e tente novamente.",
                    'info', // Tipo 'info' para "nenhuma questão encontrada"
                    true // Centralizar texto para este tipo de aviso
                );
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
            const userMessage = this._getFriendlyErrorMessage(error, "Erro ao carregar as perguntas. Tente novamente.");
            this.ui.showWarning(userMessage, 'error', true); // Centralizar texto de erro
            this.state.initializeWithQuestions([]);
            return null;
        } finally {
            this.isFetchingQuestions = false;
            if(triggerButton) this.ui.setButtonLoading(triggerButton, false, originalButtonText);
            // Esconde o placeholder de filtros APÓS a tentativa de carregar, se o quiz não for começar
            if (this.ui.elements.placeholderFiltrosContainer && (!this.state.currentQuestionsSet || this.state.currentQuestionsSet.length === 0)) {
                this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                if (this.ui.elements.challengeHubContainer) this.ui.showElement(this.ui.elements.challengeHubContainer);
            } else if (this.ui.elements.placeholderFiltrosContainer && this.state.currentQuestionsSet && this.state.currentQuestionsSet.length > 0) {
                 this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer); // Esconde se o quiz vai começar
            }
        }
    }

    async applyFiltersAndStartQuiz() {
        // console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - INICIADO");
        if (!this.filterPanel) {
            console.error("QUIZLOGIC.JS: applyFiltersAndStartQuiz - FilterPanel não definido.");
            this.ui.showWarning("Erro interno: O painel de filtros não está funcionando corretamente.", 'error', true);
            return;
        }
        const selectedCategoryIds = this.filterPanel.getSelectedCategories();
        const selectedDifficulties = this.filterPanel.getSelectedDifficulties();
        const selectedNumQuestions = this.filterPanel.getSelectedNumberOfQuestions();
        
        this.ui.toggleFilterPanel(false); // Fecha o painel antes de carregar
        
        const filterParams = { 
            category_ids: selectedCategoryIds, 
            difficulty_levels: selectedDifficulties,
            num_questions: selectedNumQuestions
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, false);
        
        if (questions && questions.length > 0) {
            this._initiateQuizSession(questions, selectedCategoryIds); 
        } else {
            // Se não houver perguntas, o _fetchAndPrepareQuestions já mostrou um aviso.
            // Apenas garante que o hub seja mostrado se nada mais estiver ativo.
            if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName) && this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName)) {
                // A condição this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName)
                // é para não esconder um aviso que já está sendo exibido pelo _fetchAndPrepareQuestions.
            } else if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName) && !this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName)) {
                // Se um aviso está sendo mostrado, não mostre o hub por cima.
            }
        }
        // console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - FINALIZADO");
    }

    async startQuickQuiz() {
        // console.log("QUIZLOGIC.JS: startQuickQuiz - INICIADO");
        const filterParams = { 
            mode: 'quick', 
            count: this.state.quickQuizDefaultCount
        };
        const questions = await this._fetchAndPrepareQuestions(filterParams, true);
        if (questions && questions.length > 0) {
            this._initiateQuizSession(questions, []);
        } else {
            // _fetchAndPrepareQuestions já cuida de mostrar o aviso.
            // Garante que o hub seja mostrado se nada mais estiver ativo e não houver aviso.
             if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName) && this.ui.elements.avisoContainer.classList.contains(this.ui.hiddenClassName)) {
                // this.challengeHub.showHub(); // Ocultado, pois o finally de _fetchAndPrepareQuestions pode lidar com isso.
            }
        }
        // console.log("QUIZLOGIC.JS: startQuickQuiz - FINALIZADO");
    }

    async _initiateQuizSession(questionsForSession, selectedCategoryIdsForSessionStart = []) {
        const numQuestions = questionsForSession ? questionsForSession.length : 0;
        // console.log(`QUIZLOGIC.JS: _initiateQuizSession - Iniciando com ${numQuestions} perguntas. Modo Rápido: ${this.state.isQuickQuizMode}.`);
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
                    const userMessage = this._getFriendlyErrorMessage({ data: sessionData }, "Não foi possível iniciar a sessão de quiz. Tente novamente.");
                    this.ui.showWarning(userMessage, 'error', true);
                    this.ui.displayQuizContent(false); 
                    if (this.challengeHub) this.challengeHub.showHub();
                }
            } catch (error) {
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao iniciar o quiz. Verifique sua internet.");
                this.ui.showWarning(userMessage, 'error', true);
                this.ui.displayQuizContent(false); 
                if (this.challengeHub) this.challengeHub.showHub();
            }
        } else {
            // Este caso deve ser coberto pela lógica em _fetchAndPrepareQuestions, mas é um fallback.
            this.ui.displayQuizContent(false);
            this.ui.showWarning(
                "Nenhuma pergunta foi carregada para esta sessão. Por favor, tente novamente.",
                'info',
                true
            );
            this.ui.stopTimer();
            if (this.challengeHub) this.challengeHub.showHub();
        }
        // console.log("QUIZLOGIC.JS: _initiateQuizSession - FINALIZADO.");
    }

    async answerQuestion(selectedOptionId) {
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion || currentQuestion.respostaDadaId !== undefined || !this.currentSessionId) {
            // console.warn("QUIZLOGIC: Tentativa de responder pergunta já respondida, sem questão ou sem sessão.");
            return;
        }
        const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);
        if (!selectedOption) {
            console.error("QUIZLOGIC: Opção selecionada não encontrada para a pergunta atual.");
            return;
        }

        const isCorrect = selectedOption.eh_correta;
        this.state.recordAnswer(selectedOptionId, isCorrect);
        this.ui.disableAnswers();
        this.ui.applyAnswerFeedback(selectedOptionId, options);
        this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
        this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
        
        // Focar e scrollar suavemente para o próximo botão após um pequeno delay para a UI atualizar
        setTimeout(() => {
            this.ui.focusNextButton(true); 
            this.ui.smoothScrollToNextButton();
        }, 100); // Pequeno delay

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
            } else {
                 // Se o backend retornar um erro ao registrar, mas a resposta foi aceita no frontend.
                 // Poderia mostrar um aviso sutil se responseData.message existir.
                 console.warn("QUIZLOGIC: Resposta registrada no frontend, mas backend retornou:", responseData);
            }
        } catch (error) {
            console.error("QUIZLOGIC.JS: answerQuestion - ERRO DE REDE ao registrar resposta:", error);
            // Considerar um feedback não obstrutivo, pois a resposta já foi processada na UI.
            // this.ui.showWarning("Houve um problema ao salvar sua resposta no servidor, mas ela foi registrada localmente.", 'info');
        }
    }

    async _handleSkippedQuestion() {
        const currentQuestion = this.state.getCurrentQuestion();
        if (currentQuestion && this.currentSessionId && currentQuestion.respostaDadaId === undefined) {
            // console.log(`QUIZLOGIC.JS: _handleSkippedQuestion - Marcando pergunta ID ${currentQuestion.id_pergunta} como pulada.`);
            this.state.markAsSkipped();
            // Atualizar o grid imediatamente após marcar como pulada
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
        // Lidar com a questão atual (que está sendo deixada para trás) se não foi respondida
        if (this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion();
        }

        if (this.state.goToNextQuestion()) { 
            if (this.state.isQuizComplete()) { 
                await this.endQuiz(); // Adicionado await
            } else {
                this._displayCurrentQuestion();
            }
        } else if (isLastBeforeAdvance && !this.state.isQuizComplete()) {
            // Este bloco pode ser alcançado se goToNextQuestion falhar (já no fim)
            // e a questão anterior era a última.
            await this.endQuiz(); // Adicionado await
        } else if (this.state.isQuizComplete() && this.ui.elements.resultadoCard.classList.contains(this.ui.hiddenClassName)) {
             await this.endQuiz(); // Adicionado await - Caso raro: quiz completo mas resultados não visíveis
        }
    }

    async previousQuestion() {
        // Lidar com a questão atual (que está sendo deixada para trás) se não foi respondida
        if (this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
           await this._handleSkippedQuestion(); // Marcar como pulada antes de voltar
        }
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestion();
        }
    }

    async goToQuestion(index) {
        // Lidar com a questão atual (antes de pular para outra) se não foi respondida e não é o mesmo índice
        if (index !== this.state.currentQuestionIndex && this.state.getCurrentQuestion() && this.state.getCurrentQuestion().respostaDadaId === undefined) {
            await this._handleSkippedQuestion(); 
        }

        if (index >= this.state.getTotalFilteredQuestions() && this.state.getTotalFilteredQuestions() > 0) {
            await this.endQuiz(); // Adicionado await
        } else if (this.state.goToQuestion(index)) { 
            this._displayCurrentQuestion();
        }
    }

    _displayCurrentQuestion(shouldScroll = true) {
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

                if (question.respostaDadaId !== undefined) { // Se já foi respondida (ou pulada)
                    this.ui.disableAnswers();
                    if (question.respostaDadaId !== null) { // Se não foi apenas pulada, mas uma opção foi selecionada
                         this.ui.applyAnswerFeedback(question.respostaDadaId, options);
                    }
                }
            } else {
                if (!this.state.isQuizComplete()) { // Se não há questão e o quiz não terminou (erro)
                    this.ui.showWarning("Não foi possível carregar a próxima questão. Por favor, tente reiniciar o quiz.", 'error', true);
                     if (this.challengeHub) {
                         this.ui.displayQuizContent(false); 
                         this.challengeHub.showHub();
                     }
                }
                return; 
            }
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            if (shouldScroll && !isInitialLoad) { // Scroll apenas se não for a carga inicial da primeira questão
                this.ui.scrollToQuestionStart();
            }
        };

        if (!isInitialLoad && questionWrapper) {
            questionWrapper.classList.add("is-fading-out");
            // Usar Promise para esperar a transição CSS, se definida
            const fadeOutDuration = parseFloat(getComputedStyle(questionWrapper).transitionDuration) * 1000 || (TRANSITION_DURATION || 300);
            
            setTimeout(async () => { // Adicionado async aqui se displayLogic fizer chamadas async
                questionWrapper.classList.remove("is-fading-out");
                questionWrapper.classList.add("is-transparent"); 
                
                await Promise.resolve(); // Garante que a renderização do DOM ocorra
                
                requestAnimationFrame(async () => { 
                    displayLogic(); 
                    requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent")); 
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
        // console.log(`QUIZLOGIC.JS: endQuiz - INICIADO. Forçado pelo usuário: ${forceByUser}. ID Sessão: ${this.currentSessionId}`);
        this.ui.stopTimer();
        this.ui.toggleExplanationModal(false);

        if (this.currentSessionId) {
            try {
                const endSessionPayload = {
                    session_id: this.currentSessionId,
                    tempo_total_segundos: this.ui.timerSeconds,
                };
                const responseData = await this.apiService.endQuizSession(endSessionPayload);
                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) {
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                } else {
                    // Mesmo se falhar, mostrar os resultados calculados no frontend, com um aviso
                    const userMessage = this._getFriendlyErrorMessage({ data: responseData }, "Houve um problema ao finalizar sua sessão no servidor, mas seu resultado local será exibido.");
                    this.ui.showWarning(userMessage, 'warning'); // Aviso não crítico
                }
            } catch (error) {
                const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao finalizar a sessão. Seu resultado local será exibido.");
                this.ui.showWarning(userMessage, 'warning'); // Aviso não crítico
                console.error("QUIZLOGIC.JS: endQuiz - ERRO DE REDE ao finalizar a sessão:", error);
            } finally {
                this.currentSessionId = null; // Importante resetar, mesmo se falhar
            }
        } else if (!forceByUser) { // Se não há ID de sessão e não foi forçado (ex: quiz de 0 questões)
            // console.log("QUIZLOGIC.JS: endQuiz - Nenhuma sessão ativa para finalizar. Mostrando resultados locais/vazios.");
        }
        this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        if (forceByUser) {
            this.ui.toggleConfirmModal(false);
        }
    }

    restartQuiz() {
        // console.log("QUIZLOGIC.JS: restartQuiz - INICIADO");
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
            this.filterPanel.resetFiltersToDefault(); // Reseta os filtros no painel
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

    async toggleFavoriteCurrentQuestion() {
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion ) {
            console.warn("QuizLogic: Tentativa de favoritar sem questão atual.");
            if (!this.ui.userIsAuthenticated) { // Dupla checagem
                 this.ui.showWarning("Você precisa estar logado para favoritar questões.", 'info');
            }
            return;
        }
        if (!this.ui.userIsAuthenticated) {
            this.ui.showWarning("Apenas usuários logados podem favoritar questões. <a href='/accounts/login/' class='alert-link'>Faça login</a> ou <a href='/register/' class='alert-link'>crie uma conta</a>.", 'info');
            return;
        }

        const perguntaId = currentQuestion.id_pergunta;
        // console.log(`QuizLogic: Tentando dar toggle no favorito para pergunta ID ${perguntaId}`);
        const btnFav = this.ui.elements.btnToggleFavorite;
        if(btnFav) this.ui.setButtonLoading(btnFav, true); // Feedback visual no botão

        try {
            const response = await this.apiService.toggleFavoriteStatus(perguntaId);
            if (response && response.status === 'success') {
                this.ui.updateFavoriteButton(response.is_favorited);
                if (currentQuestion.is_favorited !== undefined) { 
                    currentQuestion.is_favorited = response.is_favorited;
                } else {
                    currentQuestion.is_favorited = response.is_favorited;
                }
                // Opcional: Mostrar uma mensagem de sucesso/confirmação sutil
                // this.ui.showToast(response.message, 'success'); // Se tivesse um sistema de toast
            } else {
                const userMessage = this._getFriendlyErrorMessage({ data: response }, "Falha ao atualizar status de favorito.");
                this.ui.showWarning(userMessage, 'error');
            }
        } catch (error) {
            const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao tentar favoritar a questão.");
            this.ui.showWarning(userMessage, 'error');
        } finally {
            if(btnFav) this.ui.setButtonLoading(btnFav, false);
        }
    }

    async loadAndDisplayFavoriteQuestions() {
        if (!this.ui.userIsAuthenticated) {
            const container = this.ui.elements.favoriteQuestionsContainer;
            if (container) {
                const placeholder = container.querySelector('.placeholder-text');
                if (placeholder) this.ui.hideElement(placeholder);
                container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Você precisa estar logado para ver suas questões favoritas.</p>';
            }
            if (this.ui.elements.favoriteQuestionsEmptyState) this.ui.hideElement(this.ui.elements.favoriteQuestionsEmptyState);
            return;
        }

        // console.log("QuizLogic: Carregando questões favoritas do usuário...");
        // Adicionar feedback de carregamento se a lista de favoritos for grande
        const favContainer = this.ui.elements.favoriteQuestionsContainer;
        const originalContent = favContainer ? favContainer.innerHTML : null; // Salvar conteúdo atual (placeholder)
        if(favContainer) favContainer.innerHTML = '<p class="placeholder-text" style="text-align: center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Carregando suas questões favoritas...</p>';


        try {
            const response = await this.apiService.getFavoriteQuestions();
            if (response && response.status === 'success') {
                this.ui.renderFavoriteQuestions(response.favorite_questions, response.all_categories_for_mapping);
            } else {
                const userMessage = this._getFriendlyErrorMessage({ data: response }, "Não foi possível carregar suas questões favoritas.");
                if(favContainer) favContainer.innerHTML = `<p style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">${userMessage}</p>`;
                if (this.ui.elements.favoriteQuestionsEmptyState) this.ui.hideElement(this.ui.elements.favoriteQuestionsEmptyState);
            }
        } catch (error) {
            const userMessage = this._getFriendlyErrorMessage(error, "Erro de conexão ao carregar suas questões favoritas.");
            if(favContainer) favContainer.innerHTML = `<p style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">${userMessage}</p>`;
            if (this.ui.elements.favoriteQuestionsEmptyState) this.ui.hideElement(this.ui.elements.favoriteQuestionsEmptyState);
        }
    }
}