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
            console.warn("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Já buscando perguntas, retornando null para evitar requisições duplicadas.");
            return null;
        }
        this.isFetchingQuestions = true;
        console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - isFetchingQuestions definido como true.");

        if (this.ui.elements.placeholderFiltrosContainer && this.ui.elements.challengeHubContainer) {
            this.ui.showElement(this.ui.elements.placeholderFiltrosContainer);
            this.ui.hideElement(this.ui.elements.challengeHubContainer);
        }
        this.ui.hideElement(this.ui.elements.quizSectionContent);
        this.ui.clearWarning();
        console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - UI preparada para carregar (hub escondido, placeholder de filtros visível se aplicável).");

        try {
            console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Chamando quizData.fetchFilteredQuestions com filtros:", filterParams);
            const questions = await this.quizData.fetchFilteredQuestions(filterParams);
            console.log("QUIZLOGIC.JS: _fetchAndPrepareQuestions - Perguntas recebidas da API (via QuizData):", questions);

            if (!questions || questions.length === 0) {
                console.warn("QUIZLOGIC.JS: _fetchAndPrepareQuestions - NENHUMA pergunta encontrada para os filtros fornecidos.");
                this.state.initializeWithQuestions([]); // Inicializa com array vazio para limpar estado anterior
            } else {
                this.state.initializeWithQuestions(questions); // Popula QuizState com as novas perguntas
            }
            this.state.setQuizModeAndFilters( // Informa QuizState sobre o modo e filtros usados
                isQuickQuiz,
                filterParams.category_ids || [],
                filterParams.difficulty_levels || ['all']
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
        console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - Filtros obtidos do painel:", { selectedCategoryIds, selectedDifficulties });

        this.ui.toggleFilterPanel(false); // Fecha o painel de filtros
        console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - Painel de filtros fechado.");

        const questions = await this._fetchAndPrepareQuestions(
            { category_ids: selectedCategoryIds, difficulty_levels: selectedDifficulties },
            false // isQuickQuiz = false
        );

        if (questions) { // questions pode ser um array vazio se nada for encontrado
            console.log("QUIZLOGIC.JS: applyFiltersAndStartQuiz - _fetchAndPrepareQuestions retornou. Número de perguntas:", questions.length);
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
        const questions = await this._fetchAndPrepareQuestions(
            { mode: 'quick', count: this.state.quickQuizDefaultCount },
            true // isQuickQuiz = true
        );

        if (questions) { // questions pode ser um array vazio
            console.log("QUIZLOGIC.JS: startQuickQuiz - _fetchAndPrepareQuestions retornou. Número de perguntas:", questions.length);
            this._initiateQuizSession(questions, []); // Para quiz rápido, não há categorias selecionadas inicialmente
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
        console.log(`QUIZLOGIC.JS: _initiateQuizSession - Tentando iniciar sessão com ${numQuestions} perguntas. Modo Rápido: ${this.state.isQuickQuizMode}. Categorias selecionadas para início:`, selectedCategoryIdsForSessionStart);

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
                categoria_ids: this.state.isQuickQuizMode ? [] : selectedCategoryIdsForSessionStart, // IDs de categoria apenas se não for quiz rápido
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
                    this.ui.displayQuizContent(false); // Garante que o quiz não seja mostrado
                    if (this.challengeHub) this.challengeHub.showHub(); // Volta para o hub
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
                    : "Nenhuma questão encontrada com os filtros selecionados. Por favor, ajuste os filtros."
            );
            this.ui.stopTimer();
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
        if (currentQuestion.respostaDadaId !== undefined) {
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
            console.error("QUIZLOGIC.JS: answerQuestion - Opção selecionada não encontrada nos dados da pergunta. ID da opção:", selectedOptionId);
            return;
        }

        const isCorrect = selectedOption.eh_correta;
        console.log(`QUIZLOGIC.JS: answerQuestion - Resposta é correta: ${isCorrect}`);
        this.state.recordAnswer(selectedOptionId, isCorrect);
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
                console.log("QUIZLOGIC.JS: answerQuestion - Pontuação do usuário atualizada a partir da resposta do backend.");
            } else {
                console.warn("QUIZLOGIC.JS: answerQuestion - Backend FALHOU ao registrar resposta ou status não foi 'success'. Mensagem:", responseData?.message);
            }
        } catch (error) {
            console.error("QUIZLOGIC.JS: answerQuestion - ERRO DE REDE ao registrar resposta:", error.message, error);
            // Considerar mostrar um aviso ao usuário aqui também, se a falha for crítica.
        }
        console.log("QUIZLOGIC.JS: answerQuestion - FINALIZADO.");
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
                    opcao_id: null // Indica que foi pulada
                };
                console.log("QUIZLOGIC.JS: _handleSkippedQuestion - Payload para registrar pulo:", skipPayload);
                const response = await this.apiService.registerAnswer(skipPayload);
                console.log("QUIZLOGIC.JS: _handleSkippedQuestion - Resposta do backend ao registrar pulo:", response);
                 if (response && response.status === 'success') {
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
        // Lida com o pulo ANTES de tentar avançar para a próxima questão ou finalizar
        await this._handleSkippedQuestion();

        if (this.state.goToNextQuestion()) { // Tenta avançar o índice
            if (this.state.isQuizComplete()) { // Verifica se, após avançar, o quiz está completo
                console.log("QUIZLOGIC.JS: nextQuestion - Quiz COMPLETO após avançar. Finalizando quiz.");
                this.endQuiz();
            } else {
                console.log("QUIZLOGIC.JS: nextQuestion - Avançou para a próxima pergunta. Exibindo.");
                this._displayCurrentQuestion();
            }
        } else if (isLastBeforeAdvance && !this.state.isQuizComplete()) {
            // Se estava na última e não conseguiu avançar mais (goToNextQuestion retornou false),
            // mas o quiz ainda não está marcado como completo (currentQuestionIndex não ultrapassou o total),
            // significa que o usuário clicou em "Avançar" na última questão, o que deve finalizar o quiz.
            console.log("QUIZLOGIC.JS: nextQuestion - Estava na última pergunta e clicou em avançar. Finalizando quiz.");
            this.endQuiz();
        } else {
            console.log("QUIZLOGIC.JS: nextQuestion - Não foi possível avançar ou já está completo. Nenhuma ação de exibição.");
        }
        console.log("QUIZLOGIC.JS: nextQuestion - FINALIZADO.");
    }

    previousQuestion() {
        console.log("QUIZLOGIC.JS: previousQuestion - INICIADO. Índice atual:", this.state.currentQuestionIndex);
        // Não é comum registrar pulo ao voltar, mas a lógica de resposta já impede re-responder.
        if (this.state.goToPreviousQuestion()) {
            console.log("QUIZLOGIC.JS: previousQuestion - Voltou para a pergunta anterior. Exibindo.");
            this._displayCurrentQuestion();
        } else {
            console.log("QUIZLOGIC.JS: previousQuestion - Já está na primeira pergunta. Nenhuma ação.");
        }
        console.log("QUIZLOGIC.JS: previousQuestion - FINALIZADO.");
    }

    goToQuestion(index) {
        console.log(`QUIZLOGIC.JS: goToQuestion - Tentando ir para o índice: ${index}`);
        // Antes de ir para uma questão específica, verificar se a atual foi respondida/pulada.
        // No entanto, se o usuário está navegando pelo grid, ele pode estar querendo apenas ver.
        // A lógica de _handleSkippedQuestion é mais relevante para quando se avança (nextQuestion).
        // Se formos muito estritos, poderíamos chamar _handleSkippedQuestion aqui também, mas pode ser intrusivo.

        if (index >= this.state.getTotalFilteredQuestions()) {
            console.log("QUIZLOGIC.JS: goToQuestion - Índice está além do total de perguntas. Finalizando quiz.");
            this.endQuiz();
        } else if (this.state.goToQuestion(index)) {
            console.log(`QUIZLOGIC.JS: goToQuestion - Movido para o índice ${index}. Exibindo pergunta.`);
            this._displayCurrentQuestion();
        } else {
            console.warn(`QUIZLOGIC.JS: goToQuestion - Não foi possível mover para o índice ${index}.`);
        }
        console.log("QUIZLOGIC.JS: goToQuestion - FINALIZADO.");
    }

    async _displayCurrentQuestion(shouldScroll = true) {
        console.log(`QUIZLOGIC.JS: _displayCurrentQuestion - Exibindo pergunta no índice: ${this.state.currentQuestionIndex}. Scroll: ${shouldScroll}`);
        const questionWrapper = this.ui.elements.questionWrap;
        const isInitialLoad = this.state.isInitialQuestionLoad;
        console.log(`QUIZLOGIC.JS: _displayCurrentQuestion - É a carga inicial da questão (para animação)? ${isInitialLoad}`);

        const displayLogic = () => {
            const question = this.state.getCurrentQuestion();
            if (question) {
                console.log(`QUIZLOGIC.JS: _displayCurrentQuestion - Dados da pergunta a ser exibida:`, question);
                const options = this.quizData.getOpcoesPorPerguntaId(question.id_pergunta);
                console.log(`QUIZLOGIC.JS: _displayCurrentQuestion - Opções para a pergunta:`, options);
                this.ui.displayQuestion(
                    question,
                    this.state.getCurrentQuestionNumberForDisplay(),
                    this.state.getTotalFilteredQuestions(),
                    this.quizData.getCategorias(),
                    this.quizData.getRelacaoPerguntaCategorias(),
                    this.state.isQuickQuizMode
                );
                this.ui.generateAnswerButtons(question.id_pergunta, options, question.respostaDadaId, (opId) => this.answerQuestion(opId));

                if (question.respostaDadaId !== undefined) { // Se a pergunta já foi respondida (ao navegar de volta)
                    console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Pergunta já tem resposta. Aplicando feedback e desabilitando opções.");
                    this.ui.disableAnswers();
                    this.ui.applyAnswerFeedback(question.respostaDadaId, options);
                }
            } else {
                console.warn("QUIZLOGIC.JS: _displayCurrentQuestion - Nenhuma pergunta atual para exibir (getCurrentQuestion retornou null).");
                if (!this.state.isQuizComplete()) {
                    this.ui.showWarning("Nenhuma pergunta disponível para exibir no momento.");
                }
                // Se não há pergunta e o quiz não está completo, pode ser um estado inesperado.
                // A finalização do quiz já deve ser tratada por nextQuestion ou goToQuestion.
                // Se chegarmos aqui sem uma pergunta e o quiz não estiver completo,
                // é melhor mostrar o hub para evitar um estado de UI vazio.
                if (this.challengeHub && !this.state.isQuizComplete()) {
                     console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Sem pergunta e quiz não completo, mostrando hub.");
                     this.ui.displayQuizContent(false); // Esconde a área do quiz
                     this.challengeHub.showHub();
                }
                return; // Não continua se não houver pergunta
            }
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            if (shouldScroll) {
                this.ui.scrollToQuestionStart();
            }
        };

        // Lógica de animação de fade (mantida como estava)
        if (!isInitialLoad && questionWrapper) {
            console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Aplicando animação de fade para transição de pergunta.");
            questionWrapper.classList.add("is-fading-out");
            await new Promise(resolve => setTimeout(resolve, this.ui.elements.TRANSITION_DURATION || 300));

            questionWrapper.classList.remove("is-fading-out");
            questionWrapper.classList.add("is-transparent");
            requestAnimationFrame(() => {
                displayLogic();
                requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent"));
                console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Lógica de display executada após animação.");
            });
        } else {
            console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Exibindo pergunta diretamente (sem animação de fade).");
            displayLogic();
            if (questionWrapper) questionWrapper.classList.remove("is-fading-out", "is-transparent");
            if (this.state.getTotalFilteredQuestions() > 0 && isInitialLoad) { // Só marca como navegada se realmente houve carga inicial e tem perguntas
                this.state.markNavigated();
                console.log("QUIZLOGIC.JS: _displayCurrentQuestion - Marcado como isInitialQuestionLoad = false.");
            }
        }
        console.log("QUIZLOGIC.JS: _displayCurrentQuestion - FINALIZADO.");
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
                console.log("QUIZLOGIC.JS: endQuiz - Payload para finalizar sessão:", endSessionPayload);
                const responseData = await this.apiService.endQuizSession(endSessionPayload);
                console.log("QUIZLOGIC.JS: endQuiz - Resposta da API end_quiz_session:", responseData);

                if (responseData && (responseData.status === 'success' || responseData.status === 'info')) { // 'info' se já finalizada
                    this.user.updateFromServer(responseData.total_acertos, responseData.total_erros, responseData.pontuacao_final);
                    console.log("QUIZLOGIC.JS: endQuiz - Pontuação do usuário atualizada a partir da resposta do backend.");
                } else {
                    console.warn("QUIZLOGIC.JS: endQuiz - FALHA ao sincronizar o fim da sessão com o backend ou status não foi 'success'/'info'. Mensagem:", responseData?.message);
                    // Mesmo se falhar, mostrar resultados com os dados do frontend.
                }
            } catch (error) {
                console.error("QUIZLOGIC.JS: endQuiz - ERRO DE REDE ao finalizar a sessão:", error.message, error);
                // Mostrar resultados com os dados do frontend, mesmo com erro de rede.
            } finally {
                this.currentSessionId = null; // Limpa o ID da sessão
                console.log("QUIZLOGIC.JS: endQuiz - ID da sessão limpo.");
            }
        } else {
            console.warn("QUIZLOGIC.JS: endQuiz - Nenhuma sessão atual (currentSessionId é nulo). Mostrando resultados com dados locais.");
        }

        // Sempre mostrar resultados, mesmo que a chamada ao backend falhe
        this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        console.log("QUIZLOGIC.JS: endQuiz - Resultados exibidos.");

        if (forceByUser) {
            this.ui.toggleConfirmModal(false); // Fecha o modal de confirmação se foi encerramento forçado
            console.log("QUIZLOGIC.JS: endQuiz - Modal de confirmação de encerramento fechado.");
        }
        console.log("QUIZLOGIC.JS: endQuiz - FINALIZADO.");
    }

    restartQuiz() {
        console.log("QUIZLOGIC.JS: restartQuiz - INICIADO");
        this.user.reset();
        this.state.fullReset(); // Reseta o estado do quiz, incluindo filtros ativos
        this.currentSessionId = null;
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);
        this.ui.displayQuizContent(false); // Esconde a área do quiz
        this.ui.clearWarning();
        console.log("QUIZLOGIC.JS: restartQuiz - Estado do usuário, quiz e UI resetados.");

        if (this.filterPanel) {
            this.filterPanel.resetFiltersToDefault(); // Reseta os filtros visuais no painel
            console.log("QUIZLOGIC.JS: restartQuiz - Filtros no painel resetados.");
        }
        if (this.challengeHub) {
            this.challengeHub.showHub(); // Mostra o hub de desafios
            console.log("QUIZLOGIC.JS: restartQuiz - Hub de desafios mostrado.");
        }
        if(this.ui.elements.placeholderFiltrosContainer) {
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