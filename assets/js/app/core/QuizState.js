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
        };
    }

    initializeWithQuestions(questions) {
        this.currentQuestionsSet = questions.map(q => ({
            ...q, // Dados originais da pergunta
            respostaDadaId: undefined,       // ID da opção que o usuário selecionou
            foiCorretaNaSessao: undefined, // true, false, ou undefined se não respondida/avaliada
            foiPulada: undefined,            // true se o usuário pulou a questão
        }));
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
    }

    resetQuizStateForNewSession() {
        this.currentQuestionsSet = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        // Não reseta isQuickQuizMode ou activeFiltersForCurrentSet aqui,
        // pois eles são definidos antes de uma nova sessão começar.
    }

    // Reseta completamente, incluindo modo e filtros (para quando o usuário quer recomeçar do zero)
    fullReset() {
        this.resetQuizStateForNewSession();
        this.isQuickQuizMode = false;
        this.activeFiltersForCurrentSet = {
            category_ids: [],
            difficulty_levels: ['all'],
        };
    }

    setQuizModeAndFilters(isQuick, categories = [], difficulties = ['all']) {
        this.isQuickQuizMode = isQuick;
        this.activeFiltersForCurrentSet = {
            category_ids: categories,
            difficulty_levels: difficulties,
        };
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
        // O quiz é considerado completo se o índice ultrapassar o número de perguntas
        return this.currentQuestionIndex >= this.currentQuestionsSet.length;
    }

    isFirstQuestion() {
        return this.currentQuestionIndex === 0;
    }

    isLastQuestion() {
        return this.currentQuestionIndex === this.currentQuestionsSet.length - 1;
    }

    recordAnswer(selectedOptionId, isCorrect) {
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion && currentQuestion.respostaDadaId === undefined) { // Só registra se não foi respondida
            currentQuestion.respostaDadaId = selectedOptionId;
            currentQuestion.foiCorretaNaSessao = isCorrect;
            currentQuestion.foiPulada = false; // Se respondeu, não pulou
            return true;
        }
        return false;
    }

    markAsSkipped() {
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion && currentQuestion.respostaDadaId === undefined) { // Só marca como pulada se não foi respondida
            currentQuestion.foiPulada = true;
            currentQuestion.respostaDadaId = null; // ou um valor específico para pulada
            currentQuestion.foiCorretaNaSessao = undefined; // Pulada não é correta nem incorreta
            return true;
        }
        return false;
    }

    markNavigated() {
        // Usado para indicar que o usuário já navegou além da primeira questão
        // e a lógica de animação inicial pode não ser mais necessária.
        this.isInitialQuestionLoad = false;
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
        if (this.currentQuestionIndex < this.currentQuestionsSet.length) { // Permite ir uma além para marcar como completo
            this.currentQuestionIndex++;
            this.markNavigated();
            return true;
        }
        return false; // Já está além da última ou no estado "completo"
    }

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.markNavigated(); // Mesmo voltando, a carga inicial já ocorreu
            return true;
        }
        return false;
    }

    // Getter para obter as respostas do usuário para a sessão atual
    // Pode ser útil para enviar ao backend ou para re-renderizar o grid de questões.
    getUserResponsesForCurrentSet() {
        return this.currentQuestionsSet.map(q => ({
            id_pergunta: q.id_pergunta,
            respostaDadaId: q.respostaDadaId,
            foiCorretaNaSessao: q.foiCorretaNaSessao,
            foiPulada: q.foiPulada,
        }));
    }
}