// File: assets/js/app/core/QuizState.js

import { QUICK_QUIZ_COUNT } from '../../utils/constants.js';

export default class QuizState {
    constructor() {
        this.currentQuestionsSet = []; // Perguntas atualmente carregadas para o quiz (com respostas do usuário)
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true; // Para controlar animações/comportamento na primeira carga de questão
        this.isQuickQuizMode = false;
        this.quickQuizDefaultCount = QUICK_QUIZ_COUNT; // Usando a constante

        // Filtros que foram usados para buscar o currentQuestionsSet
        this.activeFiltersForCurrentSet = {
            category_ids: [],
            difficulty_levels: ['all'], // Default para 'all' se não especificado
            num_questions: null, // NOVO: Filtro para número de questões (null significa "todas")
        };
        console.log("QUIZSTATE.JS: Estado inicial dos filtros:", JSON.parse(JSON.stringify(this.activeFiltersForCurrentSet)));
    }

    initializeWithQuestions(questions) {
        this.currentQuestionsSet = questions.map(q => ({
            ...q, // Dados originais da pergunta
            respostaDadaId: undefined,       // ID da opção que o usuário selecionou
            foiCorretaNaSessao: undefined, // true, false, ou undefined se não respondida/avaliada
            foiPulada: undefined,            // true se o usuário pulou a questão
        }));
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true; // Resetar para a carga inicial de um novo conjunto
        console.log("QUIZSTATE.JS: initializeWithQuestions - Quiz inicializado com", questions.length, "perguntas.");
    }

    resetQuizStateForNewSession() {
        this.currentQuestionsSet = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        // Nota: activeFiltersForCurrentSet e isQuickQuizMode NÃO são resetados aqui.
        // Eles são redefinidos explicitamente antes de iniciar um novo tipo de quiz
        // ou através do fullReset. Isso permite que o usuário possa, por exemplo,
        // reiniciar um quiz com os mesmos filtros.
        console.log("QUIZSTATE.JS: resetQuizStateForNewSession - Estado da sessão de quiz resetado (perguntas, índice).");
    }

    // Reseta completamente, incluindo modo e filtros (para quando o usuário quer recomeçar do zero do Hub)
    fullReset() {
        this.resetQuizStateForNewSession(); // Reseta perguntas e índice
        this.isQuickQuizMode = false;
        this.activeFiltersForCurrentSet = { // Reseta todos os filtros para o padrão
            category_ids: [],
            difficulty_levels: ['all'],
            num_questions: null, // Número de questões volta para "todas"
        };
        console.log("QUIZSTATE.JS: fullReset - Estado completo resetado, incluindo filtros:", JSON.parse(JSON.stringify(this.activeFiltersForCurrentSet)));
    }

    // MODIFICADO: Adicionado numQuestions como parâmetro e no objeto activeFiltersForCurrentSet
    setQuizModeAndFilters(isQuick, categories = [], difficulties = ['all'], numQuestions = null) {
        this.isQuickQuizMode = isQuick;
        this.activeFiltersForCurrentSet = {
            category_ids: categories,
            difficulty_levels: difficulties,
            num_questions: numQuestions, // Armazena o filtro de número de questões
        };
        console.log("QUIZSTATE.JS: setQuizModeAndFilters - Modo e filtros definidos. É rápido:", isQuick, "Filtros:", JSON.parse(JSON.stringify(this.activeFiltersForCurrentSet)));
    }

    getCurrentQuestion() {
        return this.currentQuestionsSet[this.currentQuestionIndex] ?? null;
    }

    getCurrentQuestionNumberForDisplay() {
        return this.currentQuestionIndex + 1;
    }

    getTotalFilteredQuestions() {
        return this.currentQuestionsSet.length;
    }

    isQuizComplete() {
        return this.currentQuestionIndex >= this.currentQuestionsSet.length && this.currentQuestionsSet.length > 0;
    }

    isFirstQuestion() {
        return this.currentQuestionIndex === 0;
    }

    isLastQuestion() {
        // Verdadeiro se o índice atual é o último de um conjunto de questões não vazio
        return this.currentQuestionsSet.length > 0 && this.currentQuestionIndex === this.currentQuestionsSet.length - 1;
    }

    recordAnswer(selectedOptionId, isCorrect) {
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion && currentQuestion.respostaDadaId === undefined) {
            currentQuestion.respostaDadaId = selectedOptionId;
            currentQuestion.foiCorretaNaSessao = isCorrect;
            currentQuestion.foiPulada = false;
            // console.log(`QUIZSTATE.JS: recordAnswer - Pergunta ID ${currentQuestion.id_pergunta} respondida. Correta: ${isCorrect}`);
            return true;
        }
        // console.log(`QUIZSTATE.JS: recordAnswer - Não foi possível registrar resposta. Pergunta atual:`, currentQuestion);
        return false;
    }

    markAsSkipped() {
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion && currentQuestion.respostaDadaId === undefined) {
            currentQuestion.foiPulada = true;
            currentQuestion.respostaDadaId = null; 
            currentQuestion.foiCorretaNaSessao = undefined;
            // console.log(`QUIZSTATE.JS: markAsSkipped - Pergunta ID ${currentQuestion.id_pergunta} marcada como pulada.`);
            return true;
        }
        return false;
    }

    markNavigated() {
        if (this.isInitialQuestionLoad) {
            this.isInitialQuestionLoad = false;
            // console.log("QUIZSTATE.JS: markNavigated - isInitialQuestionLoad definido como false.");
        }
    }

    goToQuestion(index) {
        if (index >= 0 && index < this.currentQuestionsSet.length) {
            this.currentQuestionIndex = index;
            this.markNavigated(); // Usuário navegou, não é mais a carga inicial "pura"
            // console.log(`QUIZSTATE.JS: goToQuestion - Movido para índice ${index}.`);
            return true;
        }
        // console.log(`QUIZSTATE.JS: goToQuestion - Índice ${index} fora dos limites.`);
        return false;
    }

    goToNextQuestion() {
        // Permite avançar até um índice além do último para indicar que o quiz terminou
        if (this.currentQuestionIndex < this.currentQuestionsSet.length) {
            this.currentQuestionIndex++;
            this.markNavigated();
            // console.log(`QUIZSTATE.JS: goToNextQuestion - Avançou para índice ${this.currentQuestionIndex}. Completo: ${this.isQuizComplete()}`);
            return true;
        }
        // console.log(`QUIZSTATE.JS: goToNextQuestion - Não pôde avançar, já no final ou além. Índice: ${this.currentQuestionIndex}`);
        return false;
    }

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.markNavigated();
            // console.log(`QUIZSTATE.JS: goToPreviousQuestion - Voltou para índice ${this.currentQuestionIndex}.`);
            return true;
        }
        // console.log(`QUIZSTATE.JS: goToPreviousQuestion - Já na primeira questão. Índice: ${this.currentQuestionIndex}`);
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