// File: assets/js/ui/ChallengeHub.js

export default class ChallengeHub {
    constructor(uiElements, quizLogicInstance = null) {
        // uiElements é o objeto this.elements da QuizUI, passado para ter acesso rápido
        // aos elementos DOM relevantes que QuizUI já cacheou.
        this.elements = {
            challengeHubContainer: uiElements.challengeHubContainer,
            hubCustomizeQuizBtn: uiElements.hubCustomizeQuizBtn,
            hubQuickQuizBtn: uiElements.hubQuickQuizBtn,
            hubTotalQuestionsCount: uiElements.hubTotalQuestionsCount, // Span na home e na página de questões
            hubQuickQuizCount: uiElements.hubQuickQuizCount,           // Span na página de questões
            placeholderFiltrosContainer: uiElements.placeholderFiltrosContainer,
            closeFiltersAndShowHubBtn: uiElements.closeFiltersAndShowHubBtn, // Botão no placeholder de filtros
        };
        this.quizLogic = quizLogicInstance; // Instância de QuizLogic para delegar ações
        this.quizUI = null; // Referência para a instância principal da QuizUI
    }

    // Método para injetar a instância de QuizLogic após a criação
    setQuizLogic(quizLogicInstance) {
        this.quizLogic = quizLogicInstance;
    }

    // Método para injetar a instância principal da QuizUI
    setQuizUI(quizUIInstance) {
        this.quizUI = quizUIInstance;
    }

    showHub() {
        if (this.elements.challengeHubContainer) {
            this.quizUI?.showElement(this.elements.challengeHubContainer);
        }
        if (this.elements.placeholderFiltrosContainer) {
            this.quizUI?.hideElement(this.elements.placeholderFiltrosContainer);
        }
        // Garante que outros painéis/seções do quiz estejam escondidos
        this.quizUI?.hideElement(this.quizUI?.elements.quizSectionContent);
        this.quizUI?.hideElement(this.quizUI?.elements.resultadoCard);
        this.quizUI?.hideElement(this.quizUI?.elements.scorePanel);
        this.quizUI?.clearWarning();
    }

    hideHub() {
        if (this.elements.challengeHubContainer) {
            this.quizUI?.hideElement(this.elements.challengeHubContainer);
        }
    }

    updateTotalQuestionsCount(count) {
        if (this.elements.hubTotalQuestionsCount) {
            this.elements.hubTotalQuestionsCount.textContent = count || '0';
        }
        // Atualiza também o span na home page, se existir
        const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
        if (totalQuestionsSpanHome) {
            totalQuestionsSpanHome.textContent = count || '0';
        }
    }

    updateQuickQuizCount(count) {
        if (this.elements.hubQuickQuizCount) {
            this.elements.hubQuickQuizCount.textContent = count || '0';
        }
    }

    setupEventListeners() {
        this.elements.hubCustomizeQuizBtn?.addEventListener('click', () => {
            if (!this.quizUI || !this.quizLogic) return;
            this.hideHub();
            // Mostra o placeholder de filtros e abre o painel de filtros
            if (this.elements.placeholderFiltrosContainer) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
            this.quizUI.toggleFilterPanel(true);
        });

        this.elements.hubQuickQuizBtn?.addEventListener('click', () => {
            if (this.quizLogic) {
                this.hideHub(); // Esconde o hub antes de iniciar o quiz rápido
                this.quizLogic.startQuickQuiz();
            }
        });

        this.elements.closeFiltersAndShowHubBtn?.addEventListener('click', () => {
            if (this.quizUI) {
                this.quizUI.toggleFilterPanel(false); // Fecha o painel de filtros
            }
            this.showHub(); // Mostra o hub novamente
        });
    }
}