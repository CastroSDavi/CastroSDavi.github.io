// File: assets/js/app/core/QuizState.js

import { QUICK_QUIZ_COUNT } from '../../utils/constants.js';

export default class QuizState {
    constructor() {
        console.log("QuizState.js: CONSTRUCTOR - Instância QuizState criada.");
        this.resetQuizStateForNewSession(); 

        this.activeFiltersForCurrentSet = {
            category_ids: [],
            difficulty_levels: ['all'],
            num_questions: null,
        };

        this.currentSessionId = null;
        this.currentQuizMode = null;
        this.currentQuizDefinicaoId = null;

        this.quizDisplayContext = { displayMode: 'none', mainQuizTitle: '' };
        console.log("QuizState.js: CONSTRUCTOR - quizDisplayContext inicializado:", JSON.stringify(this.quizDisplayContext));


        this.quickQuizDefaultCount = QUICK_QUIZ_COUNT;
    }

    initializeWithQuestions(questions, mode, sessionId = null, quizDefId = null) {
        console.log(`QuizState.js: initializeWithQuestions - Entrou. Modo: ${mode}, SessãoID: ${sessionId}, QuizDefID: ${quizDefId}, N_Perguntas: ${questions?.length}`);
        this.currentQuestionsSet = questions.map(q => ({
            ...q,
            respostaDadaId: undefined,
            foiCorretaNaSessao: undefined,
            foiPulada: undefined,
        }));
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        this.currentSessionId = sessionId;
        this.currentQuizMode = mode;
        this.currentQuizDefinicaoId = quizDefId;
        console.log("QuizState.js: initializeWithQuestions - Estado inicializado.");
    }

    rehydrateFromResumedSession(resumeData) {
        console.log("QuizState.js: rehydrateFromResumedSession - Entrou. resumeData:", resumeData ? "Recebido" : "Nulo/Indefinido");
        if (!resumeData) {
            console.error("QuizState.js: rehydrateFromResumedSession - resumeData é nulo ou indefinido.");
            return;
        }
        this.currentSessionId = resumeData.session_id;
        this.currentQuizMode = resumeData.modo_quiz;
        this.currentQuizDefinicaoId = resumeData.id_quiz_definicao;

        let displayMode = 'challenge';
        let mainQuizTitle = '';

        // MODOS DE QUIZ DO BACKEND: 'Definido', 'Rápido', 'Por Categoria'
        if (this.currentQuizMode === 'Definido' && resumeData.quiz_definition_name) {
            displayMode = 'focused';
            mainQuizTitle = resumeData.quiz_definition_name;
        } else if (this.currentQuizMode === 'Rápido') {
            displayMode = 'challenge';
            mainQuizTitle = 'Quiz Rápido';
        } else if (this.currentQuizMode === 'Por Categoria') {
            displayMode = 'challenge';
            mainQuizTitle = 'Desafio Personalizado';
        }
        console.log(`QuizState.js: rehydrateFromResumedSession - Antes de setQuizDisplayContext. Modo Determinado: ${displayMode}, Título: ${mainQuizTitle}`);
        this.setQuizDisplayContext(displayMode, mainQuizTitle);

        this.currentQuestionsSet = resumeData.perguntas.map(q => {
            const respostaSalva = resumeData.respostas_dadas ? resumeData.respostas_dadas[q.id_pergunta] : null;
            return {
                ...q,
                respostaDadaId: respostaSalva ? respostaSalva.opcao_selecionada_id : undefined,
                foiCorretaNaSessao: respostaSalva ? respostaSalva.foi_correta : undefined,
                foiPulada: respostaSalva && respostaSalva.opcao_selecionada_id === null ? true : undefined,
            };
        });

        this.currentQuestionIndex = resumeData.indice_ultima_pergunta_vista !== null ? resumeData.indice_ultima_pergunta_vista : 0;
        this.isInitialQuestionLoad = true;
        console.log("QuizState.js: rehydrateFromResumedSession - Estado rehidratado. currentQuestionIndex:", this.currentQuestionIndex);
    }

    resetQuizStateForNewSession() {
        console.log("QuizState.js: resetQuizStateForNewSession - Entrou.");
        this.currentQuestionsSet = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        this.currentSessionId = null;
        this.currentQuizMode = null;
        this.currentQuizDefinicaoId = null;
        this.quizDisplayContext = { displayMode: 'none', mainQuizTitle: '' };
        console.log("QuizState.js: resetQuizStateForNewSession - quizDisplayContext resetado:", JSON.stringify(this.quizDisplayContext));
    }

    fullReset() {
        console.log("QuizState.js: fullReset - Entrou.");
        this.resetQuizStateForNewSession();
        this.activeFiltersForCurrentSet = {
            category_ids: [],
            difficulty_levels: ['all'],
            num_questions: null,
        };
        console.log("QuizState.js: fullReset - Filtros resetados.");
    }

    setQuizDisplayContext(displayMode, mainQuizTitle) {
        console.log(`QuizState.js: setQuizDisplayContext - Entrou. Tentando definir displayMode='${displayMode}', mainQuizTitle='${mainQuizTitle}'`);
        this.quizDisplayContext = { displayMode, mainQuizTitle };
        console.log("QuizState.js: setQuizDisplayContext - quizDisplayContext AGORA é:", JSON.stringify(this.quizDisplayContext));
    }

    setQuizFiltersForNewDynamicQuiz(categories = [], difficulties = ['all'], numQuestions = null) {
        console.log("QuizState.js: setQuizFiltersForNewDynamicQuiz - Entrou. Categorias:", categories, "Dificuldades:", difficulties, "NumPerguntas:", numQuestions);
        this.activeFiltersForCurrentSet = {
            category_ids: categories,
            difficulty_levels: difficulties,
            num_questions: numQuestions,
        };
    }

    // --- Getters ---
    getCurrentQuestion() {
        const question = this.currentQuestionsSet[this.currentQuestionIndex] ?? null;
        // console.log("QuizState.js: getCurrentQuestion - Índice:", this.currentQuestionIndex, "Pergunta:", question ? `ID ${question.id_pergunta}`: "Nula");
        return question;
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

    getQuizDisplayContext() {
        // console.log("QuizState.js: getQuizDisplayContext - Retornando:", JSON.stringify(this.quizDisplayContext));
        return this.quizDisplayContext;
    }

    getQuizDefinicaoId() {
        return this.currentQuizDefinicaoId;
    }

    // --- Checagens de Estado ---
    isQuizActive() {
        return this.currentSessionId !== null && this.currentQuestionsSet.length > 0;
    }

    isQuizComplete() {
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
        // console.log(`QuizState.js: recordAnswer - Entrou. OpçãoID: ${selectedOptionId}, Correta: ${isCorrect}`);
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion && currentQuestion.respostaDadaId === undefined) {
            currentQuestion.respostaDadaId = selectedOptionId;
            currentQuestion.foiCorretaNaSessao = isCorrect;
            currentQuestion.foiPulada = false;
            return true;
        }
        return false;
    }

    markAsSkipped() {
        // console.log("QuizState.js: markAsSkipped - Entrou.");
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion && currentQuestion.respostaDadaId === undefined) {
            currentQuestion.foiPulada = true;
            currentQuestion.respostaDadaId = null;
            currentQuestion.foiCorretaNaSessao = undefined;
            return true;
        }
        return false;
    }

    updateFavoriteStatusForCurrentQuestion(isFavorited) {
        // console.log("QuizState.js: updateFavoriteStatusForCurrentQuestion - Entrou. Favoritada:", isFavorited);
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
        // console.log("QuizState.js: goToQuestion - Entrou. Índice:", index);
        if (index >= 0 && index < this.currentQuestionsSet.length) {
            this.currentQuestionIndex = index;
            this.markNavigated();
            return true;
        }
        return false;
    }

    goToNextQuestion() {
        // console.log("QuizState.js: goToNextQuestion - Entrou. Índice atual:", this.currentQuestionIndex);
        if (this.currentQuestionIndex < this.currentQuestionsSet.length) {
            this.currentQuestionIndex++;
            this.markNavigated();
            return true;
        }
        return false;
    }

    goToPreviousQuestion() {
        // console.log("QuizState.js: goToPreviousQuestion - Entrou. Índice atual:", this.currentQuestionIndex);
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.markNavigated();
            return true;
        }
        return false;
    }

    getUserResponsesForCurrentSet() {
        return this.currentQuestionsSet.map(q => ({
            id_pergunta: q.id_pergunta,
            respostaDadaId: q.respostaDadaId,
            foiCorretaNaSessao: q.foiCorretaNaSessao,
            foiPulada: q.foiPulada,
        }));
    }
}