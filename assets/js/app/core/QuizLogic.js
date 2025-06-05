// File: assets/js/app/core/QuizLogic.js

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        this.isFetchingQuestions = false;
        this.pendingResumeData = null; // Para armazenar dados da sessão retomada antes da decisão do usuário
        console.log("QuizLogic.js: CONSTRUCTOR - Instância QuizLogic criada.");

        if (this.ui) {
            this.ui.setCallbacks({
                answerQuestionCallback: this.answerQuestion.bind(this),
                navigationCallback: this._handleQuestionNavigation.bind(this),
                toggleFavoriteCallback: this.toggleFavoriteCurrentQuestion.bind(this),
                endSessionCallback: () => { // Callback para o botão "Encerrar Sessão" no ScorePanel
                    console.log("QuizLogic.js: Callback endSessionCallback chamado (para abrir modal de confirmação de encerramento).");
                    if (this.ui.modalManager) this.ui.modalManager.toggleConfirmModal(true);
                },
                restartQuizCallback: this.restartQuiz.bind(this),
                // goHomeCallback não é diretamente usado por QuizLogic, mas ResultDisplay pode usá-lo.
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
                this.ui.challengeHubInstance.showHub(); //
            }
            return;
        }

        const isUserAuth = this.ui.userIsAuthenticated;
        const quizIsCurrentlyActiveInState = this.state.isQuizActive(); //

        if (isUserAuth && !quizIsCurrentlyActiveInState) {
            console.log("QuizLogic.js: initializeQuizPage - Usuário autenticado, sem quiz ativo no estado. Tentando retomar...");
            const resumedOrDecisionOffered = await this.tryResumeSession();
            if (!resumedOrDecisionOffered && this.ui.challengeHubInstance) {
                if (!this.state.isQuizActive()) { // Se após tryResumeSession ainda não há quiz ativo (ex: usuário descartou)
                    console.log("QuizLogic.js: initializeQuizPage - Sessão não retomada ou descartada. Mostrando Challenge Hub.");
                    this.ui.challengeHubInstance.showHub();
                }
            }
        } else if (quizIsCurrentlyActiveInState) {
            console.log("QuizLogic.js: initializeQuizPage - Quiz já ativo no estado. Mantendo UI do quiz.");
            this.ui.displayQuizLayout(true); //
             // Se já está ativo no estado, não é o primeiro display após um resume da API,
             // mas pode ser a primeira vez que _displayCurrentQuestionUI é chamado nesta "instância" da página.
             // A flag isInitialQuestionLoad no QuizState deve lidar com o scroll.
            this._displayCurrentQuestionUI(this.state.isInitialQuestionLoad ? false : true);
        } else if (this.ui.challengeHubInstance) {
            console.log("QuizLogic.js: initializeQuizPage - Nenhuma condição de retomada ou quiz ativo. Mostrando Challenge Hub.");
            this.ui.challengeHubInstance.showHub();
        } else {
            console.warn("QuizLogic.js: initializeQuizPage - ChallengeHubInstance não disponível e nenhuma outra ação tomada.");
        }
    }

    async tryResumeSession() {
        console.log("QuizLogic.js: tryResumeSession - Entrou.");
        if (!this.apiService) {
            console.error("QuizLogic.js: tryResumeSession - ERRO: apiService não está definido.");
            return false;
        }

        if (this.ui && typeof this.ui.showSessionLoadingIndicator === 'function') {
            this.ui.showSessionLoadingIndicator(true, "Verificando sessão anterior...");
        }

        try {
            const resumeData = await this.apiService.resumeQuizSession(); //
            console.log("QuizLogic.js: tryResumeSession - Dados da API:", resumeData);

            if (resumeData && resumeData.status === 'success' && resumeData.perguntas?.length > 0) {
                console.log("QuizLogic.js: tryResumeSession - Sessão encontrada. Exibindo modal de decisão.");
                this.pendingResumeData = resumeData;

                if (this.ui.modalManager && typeof this.ui.modalManager.toggleResumeDecisionModal === 'function') {
                    // O indicador de loading será escondido pelo ModalManager ou pelas ações do modal
                    this.ui.modalManager.toggleResumeDecisionModal(true, {
                        onContinue: () => this._proceedWithResumedSession(this.pendingResumeData),
                        onDiscard: () => this._discardAndGoToHub(this.pendingResumeData.session_id)
                    });
                } else {
                    console.warn("QuizLogic.js: Modal de decisão de retomada não encontrado. Retomando diretamente.");
                    this._proceedWithResumedSession(resumeData); // Fallback
                }
                return true; // Indica que uma sessão foi encontrada e a decisão será/foi processada
            }
            
            console.log("QuizLogic.js: tryResumeSession - Nenhuma sessão para retomar ou falha na API.");
            if (this.ui && typeof this.ui.showSessionLoadingIndicator === 'function') {
                this.ui.showSessionLoadingIndicator(false); // Esconde se não houver sessão
            }
            return false; // Nenhuma sessão ativa encontrada
        } catch (error) {
            console.warn("QuizLogic.js: tryResumeSession - ERRO durante a tentativa de retomar:", error.message, error);
            if (this.ui.warningDisplay && typeof this.ui.showWarning === 'function') { //
                 this.ui.showWarning(this._getFriendlyErrorMessage(error, "Não foi possível verificar sua sessão anterior."), 'error');
            }
            if (this.ui && typeof this.ui.showSessionLoadingIndicator === 'function') {
                this.ui.showSessionLoadingIndicator(false);
            }
            return false; // Erro ao tentar retomar
        }
    }

    _proceedWithResumedSession(resumeData) {
        console.log("QuizLogic.js: _proceedWithResumedSession - Procedendo com a sessão retomada.");
        if (this.ui.modalManager) this.ui.modalManager.toggleResumeDecisionModal(false); //
        if (this.ui && typeof this.ui.showSessionLoadingIndicator === 'function') {
            this.ui.showSessionLoadingIndicator(false);
        }

        this.state.rehydrateFromResumedSession(resumeData); //
        this.user.updateFromServer(resumeData.total_acertos_atual, resumeData.total_erros_atual, resumeData.pontuacao_atual); //

        console.log("QuizLogic.js: _proceedWithResumedSession - Chamando this.ui.displayQuizLayout(true).");
        this.ui.displayQuizLayout(true);
        
        if (this.state && typeof this.state.setSessionResumedFirstDisplay === 'function') {
            this.state.setSessionResumedFirstDisplay(true);
        }

        console.log("QuizLogic.js: _proceedWithResumedSession - Chamando _displayCurrentQuestionUI.");
        this._displayCurrentQuestionUI(false); // shouldScroll = false para a retomada inicial

        if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros); //

        if (this.ui.timer) { //
            this.ui.timer.reset();
            let tempoInicialParaDisplay = 0;
            if (resumeData.data_inicio_sessao_iso) {
                const dataInicio = new Date(resumeData.data_inicio_sessao_iso);
                const agora = new Date();
                tempoInicialParaDisplay = Math.max(0, Math.floor((agora.getTime() - dataInicio.getTime()) / 1000));
            }
            this.ui.timer.start(tempoInicialParaDisplay);
        }
        this.pendingResumeData = null;
        console.log("QuizLogic.js: _proceedWithResumedSession - Sessão retomada e UI atualizada.");
    }

    async _discardAndGoToHub(sessionIdToDiscard) {
        console.log("QuizLogic.js: _discardAndGoToHub - Descartando sessão ID:", sessionIdToDiscard);
        if (this.ui.modalManager) this.ui.modalManager.toggleResumeDecisionModal(false);
        if (this.ui && typeof this.ui.showSessionLoadingIndicator === 'function') {
            this.ui.showSessionLoadingIndicator(false);
        }

        if (sessionIdToDiscard) {
            try {
                await this.apiService.endQuizSession({
                    session_id: sessionIdToDiscard,
                    tempo_total_segundos: this.ui.timer ? this.ui.timer.getCurrentSeconds() : 0,
                    // Aqui, o backend pode tratar uma sessão finalizada com poucas respostas como abandonada,
                    // ou você pode adicionar um campo como 'status_override: "ABANDONADA"' se o backend suportar.
                    // Em views.py, end_quiz_session_view já trata de atualizar as estatísticas.
                });
                console.log("QuizLogic.js: _discardAndGoToHub - Sessão marcada como finalizada (abandonada) no backend.");
            } catch (error) {
                console.warn("QuizLogic.js: _discardAndGoToHub - Erro ao tentar finalizar/marcar sessão como abandonada no backend:", error);
                // Não impede o fluxo do frontend, apenas loga o erro.
            }
        }
        this.state.fullReset();
        this.user.reset();
        if (this.ui.timer) this.ui.timer.reset(0);
        this.ui.displayQuizLayout(false);
        if (this.ui.challengeHubInstance) {
            this.ui.challengeHubInstance.showHub();
        }
        this.pendingResumeData = null;
        console.log("QuizLogic.js: _discardAndGoToHub - Estado resetado, Hub exibido.");
    }


    async _handleQuestionNavigation(target) {
        console.log(`QuizLogic.js: _handleQuestionNavigation - Target: ${target}`);
        if (target === 'next') await this.nextQuestion();
        else if (target === 'prev') await this.previousQuestion();
        else if (typeof target === 'number') await this.goToQuestion(target);
    }

    _getFriendlyErrorMessage(error, defaultMessage = "Ocorreu um erro inesperado. Tente novamente.") {
        if (!error) return defaultMessage;
        // console.log("QuizLogic.js: _getFriendlyErrorMessage - Erro original:", error);
        if (!error.response && error.message && error.message.toLowerCase().includes('failed to fetch')) {
            return "Falha na conexão com o servidor. Verifique sua internet e tente novamente.";
        }
        if (error.data && error.data.message) return error.data.message;
        if (error.response && error.response.status) {
            const status = error.response.status;
            if (status === 500) return "Ocorreu um problema em nosso servidor. Tente mais tarde.";
            if (status === 404) return "Recurso não encontrado.";
            if (status === 403) return "Você não tem permissão para esta ação."; //
            if (status === 401) return "Sessão expirada. Faça login novamente.";
            if (status === 400) return error.data?.message || "Problema com sua solicitação."; //
            if (status > 400 && status < 500) return "Problema com sua solicitação.";
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
            ? this.ui.elements.hubQuickQuizBtn //
            : (quizTypeContext.isPredefinedQuiz ? null : this.ui.elements.btnAplicarFiltrosPainel); //

        const originalButtonText = triggerButton
            ? (triggerButton.querySelector('.button__label') || triggerButton).textContent
            : (quizTypeContext.isQuickQuiz ? "Quiz Rápido" : "Aplicar Filtros");

        if (triggerButton) this.ui.setButtonLoading(triggerButton, true, originalButtonText); //
        if (this.ui.challengeHubInstance) this.ui.challengeHubInstance.hideHub();
        
        // Mostrar indicador de placeholder de filtros APENAS se o painel de filtros estiver aberto.
        if (this.ui.elements.filterPanel?.classList.contains('filter-panel--visible') && 
            !quizTypeContext.isQuickQuiz && !quizTypeContext.isPredefinedQuiz && 
            this.ui.elements.placeholderFiltrosContainer) {
            this.ui.showElement(this.ui.elements.placeholderFiltrosContainer);
        } else if (this.ui.elements.placeholderFiltrosContainer){
             this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
        }

        this.ui.hideActiveQuizElements();
        if (this.ui.warningDisplay) this.ui.warningDisplay.clear();

        try {
            const questionsArray = await this.quizData.fetchFilteredQuestions(filterParams); //
            console.log("QuizLogic.js: _fetchAndPrepareQuestions - Perguntas da API:", questionsArray ? questionsArray.length : "Nulo/Indefinido");

            if (!questionsArray || questionsArray.length === 0) {
                console.log("QuizLogic.js: _fetchAndPrepareQuestions - Nenhuma pergunta encontrada.");
                this.state.initializeWithQuestions([], filterParams.mode || 'Desconhecido');
                if (this.state && typeof this.state.setQuizDisplayContext === 'function') {
                    this.state.setQuizDisplayContext('none', ''); 
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
                    mainQuizTitle = 'Quiz Rápido'; // (ModoQuiz.RAPIDO)
                } else if (quizTypeContext.isPredefinedQuiz && filterParams.quiz_definicao_id) { // (ModoQuiz.DEFINIDO)
                    const quizDefName = this.quizData.getLastFetchedQuizDefinitionName(); //
                    console.log("QuizLogic.js: _fetchAndPrepareQuestions - Nome do Quiz Definido (de QuizData):", quizDefName);
                    if (quizDefName) {
                        displayMode = 'focused';
                        mainQuizTitle = quizDefName;
                    } else {
                        mainQuizTitle = "Quiz Temático"; 
                        displayMode = 'focused';
                    }
                } else if (filterParams.category_ids && filterParams.category_ids.length === 1) { // (ModoQuiz.POR_CATEGORIA)
                    const singleCategoryId = parseInt(filterParams.category_ids[0], 10);
                    const allCategories = this.quizData.getCategorias(); //
                    const category = allCategories.find(cat => cat.id_categoria === singleCategoryId);
                    if (category) {
                        displayMode = 'focused';
                        mainQuizTitle = category.nome_categoria; // (Categoria.nome_categoria)
                    }
                }
                console.log(`QuizLogic.js: _fetchAndPrepareQuestions - Definindo quizDisplayContext: Mode='${displayMode}', Title='${mainQuizTitle}'`);
                
                if (this.state && typeof this.state.setQuizDisplayContext === 'function') {
                    this.state.setQuizDisplayContext(displayMode, mainQuizTitle);
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
        const selectedCategoryIds = this.ui.filterPanelInstance.getSelectedCategories(); //
        const selectedDifficulties = this.ui.filterPanelInstance.getSelectedDifficulties(); //
        const selectedNumQuestions = this.ui.filterPanelInstance.getSelectedNumberOfQuestions(); //
        console.log("QuizLogic.js: applyFiltersAndStartQuiz - Filtros obtidos:", {selectedCategoryIds, selectedDifficulties, selectedNumQuestions});

        if (this.ui.modalManager) this.ui.modalManager.toggleFilterPanel(false);

        const filterParams = {
            category_ids: selectedCategoryIds,
            difficulty_levels: selectedDifficulties,
            num_questions: selectedNumQuestions,
            mode: 'Por Categoria' // (SessoesQuizUsuario.ModoQuiz.POR_CATEGORIA)
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
        // Não obtemos `quickQuizDefaultCount` de `this.state` aqui, pois ele pode vir de `ConfiguracoesGeraisQuiz`
        // A API já tem o valor padrão se `count` não for enviado.
        const filterParams = { mode: 'Rápido' }; // (SessoesQuizUsuario.ModoQuiz.RAPIDO)
                                                // O `get_quiz_data_dict` no backend usará `quiz_config.numero_perguntas_quiz_rapido`
                                                //
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
            quiz_definicao_id: quizDefinicaoId, //
            mode: 'Definido' // (SessoesQuizUsuario.ModoQuiz.DEFINIDO)
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
        if (this.ui.resultDisplay) this.ui.resultDisplay.hide(); //
        if (this.ui.timer) this.ui.timer.reset(0);
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        if (questionsForSession && questionsForSession.length > 0) {
            const questionIdsInSession = questionsForSession.map(q => q.id_pergunta);
            const sessionPayload = {
                modo_quiz: this.state.getQuizMode(),
                categoria_ids: sessionParams.category_ids || [], //
                question_ids_in_session: questionIdsInSession, //
                quiz_definicao_id: sessionParams.quiz_definicao_id, //
                dificuldades_selecionadas: sessionParams.difficulty_levels,  //
                num_questoes_solicitadas: sessionParams.num_questions || (sessionParams.mode === 'Rápido' ? (this.quizData.getTotalPerguntasParaHub() > 0 ? this.state.quickQuizDefaultCount : questionsForSession.length) : questionsForSession.length)
                 //
                 // sessionParams.count é usado pela API para quiz rápido, num_questions para personalizado
            };
            console.log("QuizLogic.js: _initiateQuizSession - Payload para API startQuizSession:", JSON.stringify(sessionPayload));

            try {
                const sessionDataFromBackend = await this.apiService.startQuizSession(sessionPayload); //
                console.log("QuizLogic.js: _initiateQuizSession - Resposta da API startQuizSession:", sessionDataFromBackend);
                if (sessionDataFromBackend && sessionDataFromBackend.status === 'success' && sessionDataFromBackend.session_id) {
                    this.state.currentSessionId = sessionDataFromBackend.session_id; //
                    console.log("QuizLogic.js: _initiateQuizSession - Sessão ID definida no estado:", this.state.currentSessionId);
                    
                    console.log("QuizLogic.js: _initiateQuizSession - Chamando this.ui.displayQuizLayout(true).");
                    this.ui.displayQuizLayout(true);

                    if (this.state && typeof this.state.setSessionResumedFirstDisplay === 'function') {
                        // Mesmo para uma nova sessão, a primeira exibição da questão pode ter uma animação de entrada.
                        this.state.setSessionResumedFirstDisplay(true);
                    }

                    console.log("QuizLogic.js: _initiateQuizSession - Chamando _displayCurrentQuestionUI.");
                    this._displayCurrentQuestionUI(false); // shouldScroll = false para a primeira questão
                    
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
        const options = currentQuestion.opcoes; // (OpcoesResposta)
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);

        if (!selectedOption) {
            console.warn("QuizLogic.js: answerQuestion - Opção selecionada não encontrada na pergunta atual.");
            return;
        }

        const isCorrect = selectedOption.eh_correta; // (OpcaoResposta.eh_correta)
        this.state.recordAnswer(selectedOptionId, isCorrect);
        console.log(`QuizLogic.js: answerQuestion - Resposta registrada no estado. Correta: ${isCorrect}`);

        if (this.ui.questionDisplay) { //
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
                session_id: this.state.getSessionId(), //
                pergunta_id: currentQuestion.id_pergunta, //
                opcao_id: selectedOptionId, //
                current_question_index: this.state.currentQuestionIndex //
            };
            console.log("QuizLogic.js: answerQuestion - Enviando para API registerAnswer:", answerPayload);
            const responseData = await this.apiService.registerAnswer(answerPayload); //
            console.log("QuizLogic.js: answerQuestion - Resposta de registerAnswer:", responseData);
            if (responseData && responseData.status === 'success') {
                this.user.updateFromServer(responseData.total_acertos_sessao, responseData.total_erros_sessao, responseData.pontuacao_sessao);
                if (this.ui.scorePanel) this.ui.scorePanel.updateDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            }
        } catch (error) {
            console.error("QuizLogic.js: answerQuestion - Erro de rede ao registrar resposta:", error.message || error);
             if (this.ui.warningDisplay) this.ui.warningDisplay.show(this._getFriendlyErrorMessage(error, "Erro ao registrar sua resposta."), 'error');
        }
    }

    async _handleSkippedQuestion() {
        console.log("QuizLogic.js: _handleSkippedQuestion - Entrou.");
        const currentQuestion = this.state.getCurrentQuestion();
        // Só registra o pulo se a pergunta não foi respondida E existe uma sessão no backend
        if (currentQuestion && this.state.getSessionId() && currentQuestion.respostaDadaId === undefined) {
            this.state.markAsSkipped();
            if (this.ui.questionDisplay) this.ui.questionDisplay.renderQuestionGrid();
            console.log("QuizLogic.js: _handleSkippedQuestion - Pergunta marcada como pulada no estado.");
            try {
                const skipPayload = {
                    session_id: this.state.getSessionId(),
                    pergunta_id: currentQuestion.id_pergunta,
                    opcao_id: null, // Indica que a questão foi pulada
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
                // Não mostrar warning para o usuário aqui, pois é uma ação implícita ao navegar.
            }
        }
    }

    async nextQuestion() {
        console.log("QuizLogic.js: nextQuestion - Entrou.");
        const isLastBeforeAdvance = this.state.isLastQuestion();
        const currentQ = this.state.getCurrentQuestion();
        if (currentQ && currentQ.respostaDadaId === undefined) {
            console.log("QuizLogic.js: nextQuestion - Pergunta atual não respondida. Marcando como pulada.");
            await this._handleSkippedQuestion();
        }

        if (this.state.goToNextQuestion()) {
            if (this.state.isQuizComplete()) {
                console.log("QuizLogic.js: nextQuestion - Quiz completo (índice >= total). Finalizando...");
                await this.endQuiz();
            } else {
                console.log("QuizLogic.js: nextQuestion - Exibindo próxima questão no índice:", this.state.currentQuestionIndex);
                this._displayCurrentQuestionUI();
            }
        } else if (isLastBeforeAdvance && !this.state.isQuizComplete()) { 
            console.log("QuizLogic.js: nextQuestion - Estava na última e goToNextQuestion indicou fim. Finalizando quiz.");
            await this.endQuiz();
        } else if (this.state.isQuizComplete() && (!this.ui.elements.resultadoCard || this.ui.elements.resultadoCard.classList.contains(this.ui.hiddenClassName))) {
            console.log("QuizLogic.js: nextQuestion - Quiz já marcado como completo, mas resultados não mostrados. Mostrando resultados.");
            await this.endQuiz();
        } else {
            console.log("QuizLogic.js: nextQuestion - Não avançou nem finalizou.");
        }
    }

    async previousQuestion() {
        console.log("QuizLogic.js: previousQuestion - Entrou.");
        const currentQ = this.state.getCurrentQuestion();
        if (currentQ && currentQ.respostaDadaId === undefined) {
            console.log("QuizLogic.js: previousQuestion - Pergunta atual não respondida. Marcando como pulada.");
            await this._handleSkippedQuestion();
        }
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestionUI();
        } else {
            console.log("QuizLogic.js: previousQuestion - Não foi possível ir para a anterior.");
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
            console.log(`QuizLogic.js: goToQuestion - Índice ${index} é para finalizar o quiz. Finalizando.`);
            await this.endQuiz();
        } else if (this.state.goToQuestion(index)) {
            this._displayCurrentQuestionUI();
        } else {
             console.log(`QuizLogic.js: goToQuestion - Não foi possível ir para o índice ${index}.`);
        }
    }

    _displayCurrentQuestionUI(shouldScroll = true) {
        console.log("QuizLogic.js: _displayCurrentQuestionUI - Entrou. Scroll:", shouldScroll);
        if (!this.ui.questionDisplay) {
            console.error("QuizLogic.js: _displayCurrentQuestionUI - ERRO: this.ui.questionDisplay é NULO.");
            return;
        }
        const currentQ = this.state.getCurrentQuestion();
        if (!currentQ) {
            console.warn("QuizLogic.js: _displayCurrentQuestionUI - Nenhuma pergunta atual no estado para exibir.");
             if (this.state.isQuizActive() && !this.state.isQuizComplete()){
                console.error("QuizLogic.js: _displayCurrentQuestionUI - Tentativa de exibir pergunta nula com quiz ativo e não completo.");
             } else if (this.state.isQuizComplete()){
                this.endQuiz();
             } else if (!this.state.isQuizActive() && this.ui.challengeHubInstance) {
                this.ui.challengeHubInstance.showHub();
             }
            return;
        }

        console.log("QuizLogic.js: _displayCurrentQuestionUI - Chamando this.ui.questionDisplay.displayCurrentQuestion().");
        
        const questionWrapper = this.ui.elements.questionWrap;
        const isInitialLoadOfSession = this.state.isInitialQuestionLoad; // Se é a primeira questão da sessão (nova ou retomada)
        const isFirstDisplayAfterResume = this.state.isResumingDisplay; // Se é o primeiro display após uma retomada da API

        const displayLogicInternal = () => {
            this.ui.questionDisplay.displayCurrentQuestion();
            if (shouldScroll && !isInitialLoadOfSession && !isFirstDisplayAfterResume) {
                this.ui.questionDisplay.scrollToQuestionStart();
            }
        };
        
        if (isFirstDisplayAfterResume && questionWrapper) {
            questionWrapper.classList.remove("is-fading-out", "is-transparent");
            questionWrapper.classList.add("quiz-session-entering"); // Sua nova classe de animação
            
            displayLogicInternal();
            
            questionWrapper.addEventListener('animationend', () => {
                questionWrapper.classList.remove("quiz-session-entering");
            }, { once: true });

            if (this.state.sessionResumedFirstDisplayProcessed) {
                this.state.sessionResumedFirstDisplayProcessed(); // Reseta a flag
            }

        } else if (!isInitialLoadOfSession && questionWrapper) { // Transição normal entre questões
            questionWrapper.classList.add("is-fading-out");
            const fadeOutDuration = parseFloat(getComputedStyle(questionWrapper).transitionDuration) * 1000 || 300;

            setTimeout(() => {
                questionWrapper.classList.remove("is-fading-out");
                questionWrapper.classList.add("is-transparent");
                requestAnimationFrame(() => {
                    displayLogicInternal();
                    requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent"));
                });
            }, fadeOutDuration);
        } else { // Carregamento inicial da primeira questão (sem ser retomada) ou sem transição
            displayLogicInternal();
            if (questionWrapper) questionWrapper.classList.remove("is-fading-out", "is-transparent", "quiz-session-entering");
            if (this.state.getTotalFilteredQuestions() > 0 && isInitialLoadOfSession) {
                this.state.markNavigated(); // Marca que a primeira questão foi carregada/vista
            }
        }
        console.log("QuizLogic.js: _displayCurrentQuestionUI - Finalizado para pergunta ID:", currentQ.id_pergunta);
    }

    async endQuiz(forceByUser = false) {
        console.log(`QuizLogic.js: endQuiz - Entrou. Forçado pelo usuário: ${forceByUser}`);
        if (this.ui.timer) this.ui.timer.stop();
        if (this.ui.modalManager) this.ui.modalManager.toggleExplanationModal(false);

        const sessionId = this.state.getSessionId();
        const totalQuestionsInThisSession = this.state.getTotalFilteredQuestions();

        if (sessionId) {
            console.log("QuizLogic.js: endQuiz - Sessão ID:", sessionId);
            try {
                const endSessionPayload = {
                    session_id: sessionId, //
                    tempo_total_segundos: this.ui.timer ? this.ui.timer.getCurrentSeconds() : 0, //
                };
                console.log("QuizLogic.js: endQuiz - Payload para endQuizSession:", endSessionPayload);
                const responseData = await this.apiService.endQuizSession(endSessionPayload); //
                console.log("QuizLogic.js: endQuiz - Resposta de endQuizSession:", responseData);

                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) {
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final); //
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
                this.state.currentSessionId = null; 
                console.log("QuizLogic.js: endQuiz - SessionId limpo no estado.");
            }
        } else {
             console.log("QuizLogic.js: endQuiz - Nenhuma sessão ID para finalizar.");
        }
        
        if (this.ui.resultDisplay) {
            console.log("QuizLogic.js: endQuiz - Exibindo resultados. UserData:", this.user, "Total Perguntas:", totalQuestionsInThisSession);
            this.ui.resultDisplay.show(this.user, totalQuestionsInThisSession); //
        } else {
            console.warn("QuizLogic.js: endQuiz - resultDisplay não disponível na UI.");
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
        if (this.ui.filterPanelInstance) this.ui.filterPanelInstance.resetFiltersToDefault(); //
        
        if (this.ui.challengeHubInstance) {
            console.log("QuizLogic.js: restartQuiz - Mostrando Challenge Hub.");
            this.ui.challengeHubInstance.showHub();
        } else {
            console.warn("QuizLogic.js: restartQuiz - challengeHubInstance não definido.");
        }
        if(this.ui.elements.placeholderFiltrosContainer) this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
        console.log("QuizLogic.js: restartQuiz - Finalizado.");
    }

    async forceEndQuizByUser() { // Chamado pelo botão "Confirmar" do modal de encerrar sessão
        console.log("QuizLogic.js: forceEndQuizByUser - Chamado.");
        await this.endQuiz(true); // O true indica que foi forçado pelo usuário
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
        const btnFav = this.ui.elements.btnToggleFavorite; //
        if(btnFav) this.ui.setButtonLoading(btnFav, true);

        try {
            console.log("QuizLogic.js: toggleFavoriteCurrentQuestion - Chamando API para pergunta ID:", perguntaId);
            const response = await this.apiService.toggleFavoriteStatus(perguntaId); //
            console.log("QuizLogic.js: toggleFavoriteCurrentQuestion - Resposta da API:", response);
            if (response && response.status === 'success') {
                if (this.ui.favoriteManager) this.ui.favoriteManager.updateFavoriteButtonState(response.is_favorited); //
                this.state.updateFavoriteStatusForCurrentQuestion(response.is_favorited); //
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