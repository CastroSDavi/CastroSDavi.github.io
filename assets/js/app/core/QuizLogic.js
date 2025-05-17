// File: assets/js/app/core/QuizLogic.js

export default class QuizLogic {
    constructor(quizState, quizUI, userData, quizData, apiService) {
        console.log("QUIZLOGIC.JS: Constructor - Inicializando QuizLogic");
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.apiService = apiService;

        this.challengeHub = null; // Injetado por App.js via setChallengeHub
        this.filterPanel = null;  // Injetado por App.js via setFilterPanel
        this.currentSessionId = null;
        this.isFetchingQuestions = false; // Para prevenir múltiplas buscas simultâneas
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
            console.warn("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Já buscando perguntas, retornando null para evitar requisições duplicadas.");
            return null;
        }
        this.isFetchingQuestions = true;
        console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - isFetchingQuestions definido como true.");

        // Prepara a UI para o carregamento
        if (this.ui.elements.placeholderFiltrosContainer && this.ui.elements.challengeHubContainer) {
            this.ui.showElement(this.ui.elements.placeholderFiltrosContainer);
            this.ui.hideElement(this.ui.elements.challengeHubContainer);
        }
        this.ui.hideElement(this.ui.elements.quizSectionContent); // Esconde conteúdo do quiz anterior
        this.ui.clearWarning(); // Limpa avisos anteriores
        console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - UI preparada para carregar.");

        try {
            // filterParams é o objeto que contém category_ids, difficulty_levels, e agora num_questions (ou mode e count para quick quiz)
            console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Chamando quizData.fetchFilteredQuestions com filtros:", filterParams);
            const questions = await this.quizData.fetchFilteredQuestions(filterParams);
            console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Perguntas recebidas da API (via QuizData):", questions ? questions.length : 'Nenhuma/Erro');

            if (!questions || questions.length === 0) {
                console.warn("QUIZLOGIC.JS: _fetchAndPrepareQuestions - NENHUMA pergunta encontrada para os filtros fornecidos.");
                this.state.initializeWithQuestions([]); // Limpa estado anterior e inicializa com array vazio
            } else {
                this.state.initializeWithQuestions(questions); // Popula QuizState com as novas perguntas
            }

            // Atualiza o QuizState com os filtros que foram efetivamente usados para buscar estas questões.
            // Se for quiz rápido, num_questions (do filtro personalizado) deve ser ignorado/null.
            this.state.setQuizModeAndFilters(
                isQuickQuiz,
                filterParams.category_ids || [], // Garante que seja um array
                filterParams.difficulty_levels || ['all'], // Garante que seja um array, default 'all'
                isQuickQuiz ? null : filterParams.num_questions // Só passa num_questions do filtro se NÃO for quiz rápido
            );
            console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Estado do quiz (QuizState) atualizado com as perguntas e filtros.");
            return questions; // Retorna as perguntas (pode ser array vazio)

        } catch (error) {
            console.error("QUIZLOGIC.JS: _fetchAndPrepareQuestions - ERRO CRÍTICO ao buscar ou preparar perguntas:", error);
            this.ui.showWarning(`Erro ao buscar perguntas: ${error.message}. Tente novamente ou ajuste os filtros.`);
            this.state.initializeWithQuestions([]); // Garante que o estado está limpo em caso de erro
            return null; // Retorna null em caso de erro crítico

        } finally {
            this.isFetchingQuestions = false;
            console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - isFetchingQuestions definido como false (finalização).");
            if (this.ui.elements.placeholderFiltrosContainer) {
                this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
                 console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Placeholder de filtros escondido.");
            }
        }
    }

    async applyFiltersAndStartQuiz() {
        console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - INICIADO");
        if (!this.filterPanel) {
            console.error("QUIZLOGIC.JS: applyFiltersAndStartQuiz - FilterPanel não está definido. Não é possível obter filtros.");
            return;
        }
        // Obter filtros diretamente do FilterPanel
        const selectedCategoryIds = this.filterPanel.getSelectedCategories();
        const selectedDifficulties = this.filterPanel.getSelectedDifficulties();
        const selectedNumQuestions = this.filterPanel.getSelectedNumberOfQuestions(); // Obtém número de questões

        console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - Filtros obtidos do painel:", 
            { categories: selectedCategoryIds, difficulties: selectedDifficulties, num_questions: selectedNumQuestions }
        );

        this.ui.toggleFilterPanel(false); // Fecha o painel de filtros
        console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - Painel de filtros fechado.");

        const filterParams = { 
            category_ids: selectedCategoryIds, 
            difficulty_levels: selectedDifficulties,
            num_questions: selectedNumQuestions // Inclui o número de questões nos parâmetros para a busca
        };

        const questions = await this._fetchAndPrepareQuestions(
            filterParams,
            false // isQuickQuiz = false, pois estamos aplicando filtros personalizados
        );

        if (questions) { // questions pode ser um array vazio se nada for encontrado
            console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - _fetchAndPrepareQuestions retornou. Número de perguntas:", questions.length);
            // Para 'Por Categoria' (que é o caso aqui), passamos os IDs das categorias selecionadas para o início da sessão.
            this._initiateQuizSession(questions, selectedCategoryIds); 
        } else {
            // _fetchAndPrepareQuestions já deve ter mostrado um aviso e retornado null em caso de erro crítico
            console.warn("QUIZLOGIC.JS: applyFiltersAndStartQuiz - _fetchAndPrepareQuestions retornou null (provável erro na busca). Hub será mostrado.");
            if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName)) {
                this.challengeHub.showHub();
            }
        }
        console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - FINALIZADO");
    }

    async startQuickQuiz() {
        console.log("QUIZLOGIC.JS: startQuickQuiz - INICIADO");
        // Para o quiz rápido, não usamos o 'num_questions' do filtro personalizado.
        // Ele usa seu próprio 'count' (this.state.quickQuizDefaultCount).
        const filterParams = { 
            mode: 'quick', 
            count: this.state.quickQuizDefaultCount
            // Não incluímos num_questions aqui intencionalmente.
        };
        const questions = await this._fetchAndPrepareQuestions(
            filterParams,
            true // isQuickQuiz = true
        );

        if (questions) { // questions pode ser um array vazio
            console.log("QUIZLOGIC.JS: startQuickQuiz - _fetchAndPrepareQuestions retornou. Número de perguntas:", questions.length);
            this._initiateQuizSession(questions, []); // Para quiz rápido, não há categorias selecionadas inicialmente para o payload da sessão
        } else {
            console.warn("QUIZLOGIC.JS: startQuickQuiz - _fetchAndPrepareQuestions retornou null (provável erro na busca). Hub será mostrado.");
            if (this.challengeHub && this.ui.elements.quizSectionContent.classList.contains(this.ui.hiddenClassName)) {
                this.challengeHub.showHub();
            }
        }
        console.log("QUIZLOGIC.JS: startQuickQuiz - FINALIZADO");
    }

    async _initiateQuizSession(questionsForSession, selectedCategoryIdsForSessionStart = []) {
        const numQuestions = questionsForSession ? questionsForSession.length : 0;
        console.log(`QUIZLOGIC.JS: _initiateQuizSession - Tentando iniciar sessão com ${numQuestions} perguntas. Modo Rápido: ${this.state.isQuickQuizMode}. Categorias para payload de sessão:`, selectedCategoryIdsForSessionStart);

        this.user.reset();
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);
        console.log("QUIZLOGIC.JS: _initiateQuizSession - Estado do usuário e UI resetados para nova sessão.");

        if (questionsForSession && questionsForSession.length > 0) {
            const questionIdsInSession = questionsForSession.map(q => q.id_pergunta);
            const sessionPayload = {
                modo_quiz: this.state.isQuickQuizMode ? 'Rápido' : 'Por Categoria',
                // Enviar categoria_ids apenas se não for quiz rápido e se houver categorias selecionadas
                categoria_ids: (this.state.isQuickQuizMode || !selectedCategoryIdsForSessionStart) ? [] : selectedCategoryIdsForSessionStart,
                question_ids_in_session: questionIdsInSession,
            };
            console.log("QUIZLOGIC.JS: _initiateQuizSession - Payload para API start_session:", sessionPayload);

            try {
                const sessionData = await this.apiService.startQuizSession(sessionPayload);
                console.log("QUIZLOGIC.JS: _initiateQuizSession - Resposta da API start_session:", sessionData);

                if (sessionData && sessionData.status === 'success' && sessionData.session_id) {
                    this.currentSessionId = sessionData.session_id;
                    console.log("QUIZLOGIC.JS: _initiateQuizSession - Sessão iniciada com SUCESSO. ID da Sessão:", this.currentSessionId);
                    this.ui.displayQuizContent(true);
                    this._displayCurrentQuestion(false); // false para não scrollar na primeira questão
                    this.ui.startTimer();
                } else {
                    console.error("QUIZLOGIC.JS: _initiateQuizSession - FALHA ao iniciar sessão no backend. Resposta:", sessionData);
                    this.ui.showWarning(`Não foi possível iniciar a sessão de quiz: ${sessionData?.message || 'Erro desconhecido do backend.'}`);
                    this.ui.displayQuizContent(false);
                    if (this.challengeHub) this.challengeHub.showHub();
                }
            } catch (error) {
                console.error("QUIZLOGIC.JS: _initiateQuizSession - ERRO DE CONEXÃO ao chamar start_session:", error);
                this.ui.showWarning(`Erro de conexão ao iniciar o quiz: ${error.message}.`);
                this.ui.displayQuizContent(false);
                if (this.challengeHub) this.challengeHub.showHub();
            }
        } else {
            console.warn("QUIZLOGIC.JS: _initiateQuizSession - Nenhuma pergunta para iniciar a sessão. Mostrando aviso.");
            this.ui.displayQuizContent(false);
            this.ui.showWarning(
                this.state.isQuickQuizMode
                    ? "Nenhuma pergunta disponível para um Quiz Rápido no momento."
                    : "Nenhuma questão encontrada com os filtros selecionados. Por favor, ajuste os filtros ou a quantidade desejada."
            );
            this.ui.stopTimer(); // Para o timer se ele estiver rodando por algum motivo
            if (this.challengeHub) this.challengeHub.showHub();
        }
        console.log("QUIZLOGIC.JS: _initiateQuizSession - FINALIZADO.");
    }

    async answerQuestion(selectedOptionId) {
        console.log(`QUIZLOGIC.JS: answerQuestion - Opção selecionada ID: ${selectedOptionId}`);
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion) {
            console.warn("QUIZLOGIC.JS: answerQuestion - Nenhuma pergunta atual para responder.");
            return;
        }
        if (currentQuestion.respostaDadaId !== undefined) { // Verifica se já foi respondida
            console.warn("QUIZLOGIC.JS: answerQuestion - Pergunta já respondida. ID da resposta dada:", currentQuestion.respostaDadaId);
            return;
        }
        if (!this.currentSessionId) {
            console.error("QUIZLOGIC.JS: answerQuestion - ID da sessão atual é NULO. Não é possível registrar resposta.");
            return;
        }

        const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const selectedOption = options.find(op => op.id_opcao_resposta === selectedOptionId);

        if (!selectedOption) {
            console.error("QUIZLOGIC.JS: answerQuestion - Opção selecionada não encontrada. ID:", selectedOptionId);
            return;
        }

        const isCorrect = selectedOption.eh_correta;
        console.log(`QUIZLOGIC.JS: answerQuestion - Resposta é correta: ${isCorrect}`);
        this.state.recordAnswer(selectedOptionId, isCorrect); // Registra no QuizState

        // Atualiza UI
        this.ui.disableAnswers();
        this.ui.applyAnswerFeedback(selectedOptionId, options);
        this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
        this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
        this.ui.focusNextButton(true); // true para preventScroll
        this.ui.smoothScrollToNextButton();
        console.log("QUIZLOGIC.JS: answerQuestion - UI atualizada após resposta.");

        try {
            const answerPayload = {
                session_id: this.currentSessionId,
                pergunta_id: currentQuestion.id_pergunta,
                opcao_id: selectedOptionId,
            };
            console.log("QUIZLOGIC.JS: answerQuestion - Payload para registrar resposta:", answerPayload);
            const responseData = await this.apiService.registerAnswer(answerPayload);
            console.log("QUIZLOGIC.JS: answerQuestion - Resposta da API register_answer:", responseData);

            if (responseData && responseData.status === 'success') {
                this.user.updateFromServer(responseData.total_acertos_sessao, responseData.total_erros_sessao, responseData.pontuacao_sessao);
                this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
                console.log("QUIZLOGIC.JS: answerQuestion - Pontuação do usuário atualizada a partir do backend.");
            } else {
                console.warn("QUIZLOGIC.JS: answerQuestion - Backend FALHOU ao registrar resposta. Mensagem:", responseData?.message);
            }
        } catch (error) {
            console.error("QUIZLOGIC.JS: answerQuestion - ERRO DE REDE ao registrar resposta:", error.message, error);
        }
        console.log("QUIZLOGIC.JS: answerQuestion - FINALIZADO.");
    }

    async _handleSkippedQuestion() {
        const currentQuestion = this.state.getCurrentQuestion();
        // Só registra o pulo se houver uma sessão, uma pergunta atual e ela ainda não foi respondida
        if (currentQuestion && this.currentSessionId && currentQuestion.respostaDadaId === undefined) {
            console.log(`QUIZLOGIC.JS: _handleSkippedQuestion - Marcando pergunta ID ${currentQuestion.id_pergunta} como pulada.`);
            this.state.markAsSkipped(); // Marca no QuizState
            // Atualiza o grid para refletir o pulo
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            
            try {
                const skipPayload = {
                    session_id: this.currentSessionId,
                    pergunta_id: currentQuestion.id_pergunta,
                    opcao_id: null // Indica que foi pulada para o backend
                };
                console.log("QUIZLOGIC.JS: _handleSkippedQuestion - Payload para registrar pulo:", skipPayload);
                const response = await this.apiService.registerAnswer(skipPayload); // Usa o mesmo endpoint de registrar resposta
                console.log("QUIZLOGIC.JS: _handleSkippedQuestion - Resposta do backend ao registrar pulo:", response);
                 if (response && response.status === 'success') {
                    // Atualiza pontuação se o backend a recalcular após um pulo (pode não mudar, mas é bom sincronizar)
                    this.user.updateFromServer(response.total_acertos_sessao, response.total_erros_sessao, response.pontuacao_sessao);
                    this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
                }
            } catch (err) {
                console.warn("QUIZLOGIC.JS: _handleSkippedQuestion - ERRO ao registrar pulo de questão no backend:", err.message);
            }
        } else {
            // console.log("QUIZLOGIC.JS: _handleSkippedQuestion - Nenhuma ação de pulo necessária (pergunta já respondida, sem sessão ou sem pergunta atual).");
        }
    }

    async nextQuestion() {
        console.log("QUIZLOGIC.JS: nextQuestion - INICIADO. Índice atual:", this.state.currentQuestionIndex, "É a última?", this.state.isLastQuestion());
        const isLastBeforeAdvance = this.state.isLastQuestion();
        // Lida com o pulo da questão atual ANTES de tentar avançar para a próxima ou finalizar
        await this._handleSkippedQuestion();

        if (this.state.goToNextQuestion()) { // Tenta avançar o índice no QuizState
            // Verifica se, após avançar, o quiz está completo (currentQuestionIndex passou do limite)
            if (this.state.isQuizComplete()) { 
                console.log("QUIZLOGIC.JS: nextQuestion - Quiz COMPLETO após avançar. Finalizando quiz.");
                this.endQuiz();
            } else {
                console.log("QUIZLOGIC.JS: nextQuestion - Avançou para a próxima pergunta. Exibindo.");
                this._displayCurrentQuestion(); // Exibe a nova pergunta atual
            }
        } else if (isLastBeforeAdvance && !this.state.isQuizComplete()) {
            // Se estava na última e não conseguiu avançar mais (goToNextQuestion retornou false),
            // mas o quiz ainda não está marcado como completo (currentQuestionIndex não ultrapassou o total),
            // significa que o usuário clicou em "Avançar/Ver Resultado" na última questão, o que deve finalizar o quiz.
            console.log("QUIZLOGIC.JS: nextQuestion - Estava na última pergunta e clicou em avançar. Finalizando quiz.");
            this.endQuiz();
        } else {
            // Pode já estar no estado "completo" (currentQuestionIndex > total) ou algo inesperado.
            console.log("QUIZLOGIC.JS: nextQuestion - Não foi possível avançar (provavelmente já completo). Nenhuma ação de exibição. Estado atual do quiz.isQuizComplete():", this.state.isQuizComplete());
            if (this.state.isQuizComplete() && !this.ui.elements.resultadoCard.classList.contains(this.ui.hiddenClassName)) {
                // Se o quiz já está completo e os resultados já estão visíveis, não faz nada.
            } else if (this.state.isQuizComplete()) {
                // Se o quiz está completo mas os resultados não estão visíveis (caso raro), finaliza.
                this.endQuiz();
            }
        }
        console.log("QUIZLOGIC.JS: nextQuestion - FINALIZADO.");
    }

    previousQuestion() {
        console.log("QUIZLOGIC.JS: previousQuestion - INICIADO. Índice atual:", this.state.currentQuestionIndex);
        // Não é comum registrar pulo ao voltar, a lógica de resposta já impede re-responder.
        if (this.state.goToPreviousQuestion()) {
            console.log("QUIZLOGIC.JS: previousQuestion - Voltou para a pergunta anterior. Exibindo.");
            this._displayCurrentQuestion();
        } else {
            console.log("QUIZLOGIC.JS: previousQuestion - Já está na primeira pergunta. Nenhuma ação.");
        }
        console.log("QUIZLOGIC.JS: previousQuestion - FINALIZADO.");
    }

    goToQuestion(index) {
        console.log(`QUIZLOGIC.JS: goToQuestion - Tentando ir para o índice: ${index}. Índice atual: ${this.state.currentQuestionIndex}`);
        // Antes de ir para uma questão específica, verificar se a questão *de onde estamos saindo*
        // foi pulada (se não foi respondida).
        // Isso é relevante se a navegação pelo grid é considerada um "avanço" da questão atual.
        if (index !== this.state.currentQuestionIndex) { // Só trata pulo se estiver realmente mudando de questão
            this._handleSkippedQuestion(); // Trata a questão atual antes de mudar
        }

        if (index >= this.state.getTotalFilteredQuestions() && this.state.getTotalFilteredQuestions() > 0) {
            console.log("QUIZLOGIC.JS: goToQuestion - Índice está além do total de perguntas. Finalizando quiz.");
            this.endQuiz();
        } else if (this.state.goToQuestion(index)) { // Tenta ir para o índice no QuizState
            console.log(`QUIZLOGIC.JS: goToQuestion - Movido para o índice ${index}. Exibindo pergunta.`);
            this._displayCurrentQuestion();
        } else {
            console.warn(`QUIZLOGIC.JS: goToQuestion - Não foi possível mover para o índice ${index}.`);
        }
        console.log("QUIZLOGIC.JS: goToQuestion - FINALIZADO.");
    }

    async _displayCurrentQuestion(shouldScroll = true) {
        console.log(`QUIZLOGIC.JS: _displayCurrentQuestion - Exibindo pergunta no índice: ${this.state.currentQuestionIndex}. Scroll: ${shouldScroll}. Carga Inicial: ${this.state.isInitialQuestionLoad}`);
        const questionWrapper = this.ui.elements.questionWrap;
        const isInitialLoad = this.state.isInitialQuestionLoad;

        const displayLogic = () => {
            const question = this.state.getCurrentQuestion();
            if (question) {
                // console.log(`QUIZLOGIC.JS: _displayCurrentQuestion - Dados da pergunta a ser exibida:`, question);
                const options = this.quizData.getOpcoesPorPerguntaId(question.id_pergunta);
                // console.log(`QUIZLOGIC.JS: _displayCurrentQuestion - Opções para a pergunta:`, options);
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
                    console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Pergunta já tem resposta. Aplicando feedback.");
                    this.ui.disableAnswers();
                    this.ui.applyAnswerFeedback(question.respostaDadaId, options);
                }
            } else {
                console.warn("QUIZLOGIC.JS: _displayCurrentQuestion - Nenhuma pergunta atual para exibir (getCurrentQuestion retornou null).");
                if (!this.state.isQuizComplete()) { // Se não há pergunta e o quiz ainda não terminou (caso estranho)
                    this.ui.showWarning("Nenhuma pergunta disponível para exibir no momento.");
                     if (this.challengeHub) {
                         this.ui.displayQuizContent(false); // Esconde a área do quiz
                         this.challengeHub.showHub();
                     }
                }
                // Se o quiz está completo, a lógica de finalização (endQuiz) já deve ter sido chamada.
                return; // Não continua se não houver pergunta
            }
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            if (shouldScroll) {
                this.ui.scrollToQuestionStart();
            }
        };

        if (!isInitialLoad && questionWrapper) {
            console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Aplicando animação de fade.");
            questionWrapper.classList.add("is-fading-out");
            await new Promise(resolve => setTimeout(resolve, this.ui.elements.TRANSITION_DURATION || 300));

            questionWrapper.classList.remove("is-fading-out");
            questionWrapper.classList.add("is-transparent"); // Prepara para fade-in
            requestAnimationFrame(() => { // Garante que is-transparent foi aplicado
                displayLogic(); // Atualiza o conteúdo enquanto transparente
                requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent")); // Inicia fade-in
                // console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Lógica de display executada após animação.");
            });
        } else {
            // console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Exibindo pergunta diretamente.");
            displayLogic();
            if (questionWrapper) questionWrapper.classList.remove("is-fading-out", "is-transparent");
            if (this.state.getTotalFilteredQuestions() > 0 && isInitialLoad) {
                this.state.markNavigated(); // Marca como "navegado" após a primeira carga real
                // console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Marcado como isInitialQuestionLoad = false.");
            }
        }
        console.log("QUIZLOGIC.JS: _displayCurrentQuestion - FINALIZADO.");
    }

    async endQuiz(forceByUser = false) {
        console.log(`QUIZLOGIC.JS: endQuiz - INICIADO. Forçado pelo usuário: ${forceByUser}. ID Sessão: ${this.currentSessionId}`);
        this.ui.stopTimer();
        this.ui.toggleExplanationModal(false); // Garante que o modal de explicação seja fechado

        if (this.currentSessionId) {
            try {
                const endSessionPayload = {
                    session_id: this.currentSessionId,
                    tempo_total_segundos: this.ui.timerSeconds,
                };
                console.log("QUIZLOGIC.JS: endQuiz - Payload para finalizar sessão:", endSessionPayload);
                const responseData = await this.apiService.endQuizSession(endSessionPayload);
                console.log("QUIZLOGIC.JS: endQuiz - Resposta da API end_quiz_session:", responseData);

                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) {
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                    console.log("QUIZLOGIC.JS: endQuiz - Pontuação do usuário atualizada a partir da resposta do backend.");
                } else {
                    console.warn("QUIZLOGIC.JS: endQuiz - FALHA ao sincronizar fim da sessão com backend. Mensagem:", responseData?.message);
                }
            } catch (error) {
                console.error("QUIZLOGIC.JS: endQuiz - ERRO DE REDE ao finalizar a sessão:", error.message, error);
            } finally {
                this.currentSessionId = null; // Limpa o ID da sessão
                console.log("QUIZLOGIC.JS: endQuiz - ID da sessão limpo.");
            }
        } else {
            console.warn("QUIZLOGIC.JS: endQuiz - Nenhuma sessão ativa (currentSessionId é nulo). Resultados com dados locais.");
        }

        this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        console.log("QUIZLOGIC.JS: endQuiz - Resultados exibidos.");

        if (forceByUser) {
            this.ui.toggleConfirmModal(false);
            console.log("QUIZLOGIC.JS: endQuiz - Modal de confirmação de encerramento fechado.");
        }
        console.log("QUIZLOGIC.JS: endQuiz - FINALIZADO.");
    }

    restartQuiz() {
        console.log("QUIZLOGIC.JS: restartQuiz - INICIADO");
        this.user.reset(); // Reseta dados do usuário (acertos, erros, pontos)
        this.state.fullReset(); // Reseta o estado do quiz, incluindo filtros ativos para o padrão
        this.currentSessionId = null; // Limpa ID da sessão anterior

        // Atualiza a UI
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);
        this.ui.displayQuizContent(false); // Esconde a área do quiz
        this.ui.clearWarning();
        console.log("QUIZLOGIC.JS: restartQuiz - Estado do usuário, quiz e UI resetados.");

        if (this.filterPanel) {
            this.filterPanel.resetFiltersToDefault(); // Reseta os filtros visuais no painel
            console.log("QUIZLOGIC.JS: restartQuiz - Filtros no painel visual resetados.");
        }
        if (this.challengeHub) {
            this.challengeHub.showHub(); // Mostra o hub de desafios
            console.log("QUIZLOGIC.JS: restartQuiz - Hub de desafios mostrado.");
        }
        if(this.ui.elements.placeholderFiltrosContainer) { // Garante que o placeholder de filtros seja escondido
            this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
            console.log("QUIZLOGIC.JS: restartQuiz - Placeholder de filtros escondido.");
        }
        console.log("QUIZLOGIC.JS: restartQuiz - FINALIZADO.");
    }

    async forceEndQuizByUser() {
        console.log("QUIZLOGIC.JS: forceEndQuizByUser - INICIADO");
        await this.endQuiz(true); // true indica que foi forçado pelo usuário
        console.log("QUIZLOGIC.JS: forceEndQuizByUser - FINALIZADO.");
    }
}