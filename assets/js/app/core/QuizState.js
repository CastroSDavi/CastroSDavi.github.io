// File: assets/js/app/core/QuizState.js

import { QUICK_QUIZ_COUNT } from '../../utils/constants.js';

export default class QuizState {
    constructor() {
        this.resetQuizStateForNewSession(); // Inicializa com valores padrão

        // Filtros que foram usados para buscar o currentQuestionsSet para um quiz dinâmico
        // Estes são definidos ANTES de iniciar um quiz dinâmico.
        this.activeFiltersForCurrentSet = {
            category_ids: [],
            difficulty_levels: ['all'],
            num_questions: null,
        };

        // Informações da sessão atual, preenchidas ao iniciar ou retomar
        this.currentSessionId = null;
        this.currentQuizMode = null; // Ex: 'Rápido', 'Por Categoria', 'Definido'
        this.currentQuizDefinicaoId = null; // ID se for um quiz pré-definido

        this.quickQuizDefaultCount = QUICK_QUIZ_COUNT;
        // console.log("QUIZSTATE.JS: Estado inicial dos filtros:", JSON.parse(JSON.stringify(this.activeFiltersForCurrentSet)));
    }

    /**
     * Inicializa o estado do quiz com um novo conjunto de perguntas.
     * @param {Array<Object>} questions - Array de objetos de pergunta do backend.
     * @param {string} mode - O modo do quiz (ex: 'Rápido', 'Por Categoria', 'Definido').
     * @param {number|null} [sessionId=null] - O ID da sessão do backend.
     * @param {number|null} [quizDefId=null] - O ID da definição do quiz, se aplicável.
     */
    initializeWithQuestions(questions, mode, sessionId = null, quizDefId = null) {
        this.currentQuestionsSet = questions.map(q => ({
            ...q, // Dados originais da pergunta (id_pergunta, texto_pergunta, opcoes, etc.)
            respostaDadaId: undefined,       // ID da opção que o usuário selecionou nesta sessão
            foiCorretaNaSessao: undefined, // true, false, ou undefined se não respondida/avaliada
            foiPulada: undefined,            // true se o usuário pulou a questão
            // 'is_favorited' já deve vir do backend em 'q'
        }));
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        this.currentSessionId = sessionId;
        this.currentQuizMode = mode;
        this.currentQuizDefinicaoId = quizDefId;
        // console.log(`QUIZSTATE.JS: initializeWithQuestions - Quiz inicializado. Modo: ${mode}, Sessão ID: ${sessionId}, Def ID: ${quizDefId}, Perguntas: ${questions.length}`);
    }

    /**
     * Reconstitui o estado de um quiz existente (retomado).
     * @param {Object} resumeData - Dados da sessão recebidos da API api_resume_quiz_session.
     * @param {number} resumeData.session_id
     * @param {string} resumeData.modo_quiz
     * @param {number|null} resumeData.id_quiz_definicao
     * @param {Array<Object>} resumeData.perguntas - Lista de perguntas da sessão.
     * @param {Object} resumeData.respostas_dadas - Mapa de pergunta_id para { opcao_selecionada_id, foi_correta }.
     * @param {number|null} resumeData.indice_ultima_pergunta_vista
     */
    rehydrateFromResumedSession(resumeData) {
        this.currentSessionId = resumeData.session_id;
        this.currentQuizMode = resumeData.modo_quiz;
        this.currentQuizDefinicaoId = resumeData.id_quiz_definicao;

        this.currentQuestionsSet = resumeData.perguntas.map(q => {
            const respostaSalva = resumeData.respostas_dadas[q.id_pergunta];
            return {
                ...q, // Dados da pergunta (incluindo 'is_favorited' e 'opcoes' do backend)
                respostaDadaId: respostaSalva ? respostaSalva.opcao_selecionada_id : undefined,
                foiCorretaNaSessao: respostaSalva ? respostaSalva.foi_correta : undefined,
                foiPulada: respostaSalva && respostaSalva.opcao_selecionada_id === null ? true : undefined,
            };
        });

        this.currentQuestionIndex = resumeData.indice_ultima_pergunta_vista !== null ? resumeData.indice_ultima_pergunta_vista : 0;
        this.isInitialQuestionLoad = true; // Tratar como uma carga inicial para a UI
        // console.log(`QUIZSTATE.JS: rehydrateFromResumedSession - Estado reconstituído. Sessão ID: ${this.currentSessionId}, Índice: ${this.currentQuestionIndex}`);
    }


    resetQuizStateForNewSession() {
        this.currentQuestionsSet = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        this.currentSessionId = null;
        this.currentQuizMode = null;
        this.currentQuizDefinicaoId = null;
        // Os activeFiltersForCurrentSet NÃO são resetados aqui,
        // eles são redefinidos antes de buscar um novo quiz dinâmico.
        // console.log("QUIZSTATE.JS: resetQuizStateForNewSession - Estado da sessão de quiz resetado.");
    }

    fullReset() {
        this.resetQuizStateForNewSession();
        // Reseta todos os filtros para o padrão ao sair completamente do modo quiz
        this.activeFiltersForCurrentSet = {
            category_ids: [],
            difficulty_levels: ['all'],
            num_questions: null,
        };
        // console.log("QUIZSTATE.JS: fullReset - Estado completo resetado, incluindo filtros.");
    }

    setQuizFiltersForNewDynamicQuiz(categories = [], difficulties = ['all'], numQuestions = null) {
        this.activeFiltersForCurrentSet = {
            category_ids: categories,
            difficulty_levels: difficulties,
            num_questions: numQuestions,
        };
        // console.log("QUIZSTATE.JS: setQuizFiltersForNewDynamicQuiz - Filtros para novo quiz dinâmico:", JSON.parse(JSON.stringify(this.activeFiltersForCurrentSet)));
    }

    // --- Getters ---
    getCurrentQuestion() {
        return this.currentQuestionsSet[this.currentQuestionIndex] ?? null;
    }

    getCurrentQuestionNumberForDisplay() {
        return this.currentQuestionIndex + 1;
    }

    getTotalFilteredQuestions() {
        return this.currentQuestionsSet.length;
    }

    getSessionId() {
        return this.currentSessionId;
    }

    getQuizMode() {
        return this.currentQuizMode;
    }

    getQuizDefinicaoId() {
        return this.currentQuizDefinicaoId;
    }

    // --- Checagens de Estado ---
    isQuizActive() {
        return this.currentSessionId !== null && this.currentQuestionsSet.length > 0;
    }

    isQuizComplete() {
        // Considera completo se o índice estiver além da última pergunta E houver perguntas no set
        return this.currentQuestionsSet.length > 0 && this.currentQuestionIndex >= this.currentQuestionsSet.length;
    }

    isFirstQuestion() {
        return this.currentQuestionIndex === 0;
    }

    isLastQuestion() {
        return this.currentQuestionsSet.length > 0 && this.currentQuestionIndex === this.currentQuestionsSet.length - 1;
    }

    // --- Modificadores de Estado ---
    recordAnswer(selectedOptionId, isCorrect) {
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion && currentQuestion.respostaDadaId === undefined) {
            currentQuestion.respostaDadaId = selectedOptionId;
            currentQuestion.foiCorretaNaSessao = isCorrect;
            currentQuestion.foiPulada = false;
            // console.log(`QUIZSTATE.JS: recordAnswer - Pergunta ID ${currentQuestion.id_pergunta} respondida. Correta: ${isCorrect}`);
            return true;
        }
        // console.warn(`QUIZSTATE.JS: recordAnswer - Não foi possível registrar. Pergunta atual:`, currentQuestion);
        return false;
    }

    markAsSkipped() {
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion && currentQuestion.respostaDadaId === undefined) {
            currentQuestion.foiPulada = true;
            currentQuestion.respostaDadaId = null; // Indica que foi processada (pulada)
            currentQuestion.foiCorretaNaSessao = undefined; // Não é nem correta nem incorreta
            // console.log(`QUIZSTATE.JS: markAsSkipped - Pergunta ID ${currentQuestion.id_pergunta} marcada como pulada.`);
            return true;
        }
        return false;
    }

    updateFavoriteStatusForCurrentQuestion(isFavorited) {
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion) {
            currentQuestion.is_favorited = isFavorited;
        }
    }

    markNavigated() {
        if (this.isInitialQuestionLoad) {
            this.isInitialQuestionLoad = false;
        }
    }

    goToQuestion(index) {
        if (index >= 0 && index < this.currentQuestionsSet.length) {
            this.currentQuestionIndex = index;
            this.markNavigated();
            return true;
        }
        return false;
    }

    goToNextQuestion() {
        if (this.currentQuestionIndex < this.currentQuestionsSet.length) { // Permite avançar até o índice len (para sinalizar fim)
            this.currentQuestionIndex++;
            this.markNavigated();
            return true;
        }
        return false;
    }

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.markNavigated();
            return true;
        }
        return false;
    }

    getUserResponsesForCurrentSet() { // Para eventual uso, não diretamente para o backend neste fluxo
        return this.currentQuestionsSet.map(q => ({
            id_pergunta: q.id_pergunta,
            respostaDadaId: q.respostaDadaId,
            foiCorretaNaSessao: q.foiCorretaNaSessao,
            foiPulada: q.foiPulada,
        }));
    }
}