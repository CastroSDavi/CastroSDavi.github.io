// File: assets/js/ui/ChallengeHub.js

export default class ChallengeHub {
    constructor(uiElements, quizLogicInstance = null) {
        console.log("CHALLENGEHUB.JS: Constructor - uiElements recebidos:", uiElements);
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
        console.log("CHALLENGEHUB.JS: Constructor - Elementos cacheados:", this.elements);
    }

    // Método para injetar a instância de QuizLogic após a criação
    setQuizLogic(quizLogicInstance) {
        console.log("CHALLENGEHUB.JS: setQuizLogic - Instância de QuizLogic definida:", quizLogicInstance);
        this.quizLogic = quizLogicInstance;
    }

    // Método para injetar a instância principal da QuizUI
    setQuizUI(quizUIInstance) {
        console.log("CHALLENGEHUB.JS: setQuizUI - Instância de QuizUI definida:", quizUIInstance);
        this.quizUI = quizUIInstance;
    }

    showHub() {
        console.log("CHALLENGEHUB.JS: showHub - Tentando mostrar o hub.");
        if (this.elements.challengeHubContainer) {
            this.quizUI?.showElement(this.elements.challengeHubContainer);
            console.log("CHALLENGEHUB.JS: showHub - Hub principal mostrado (ou tentativa).");
        } else {
            console.warn("CHALLENGEHUB.JS: showHub - Elemento challengeHubContainer não encontrado.");
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
        console.log("CHALLENGEHUB.JS: hideHub - Tentando esconder o hub.");
        if (this.elements.challengeHubContainer) {
            this.quizUI?.hideElement(this.elements.challengeHubContainer);
            console.log("CHALLENGEHUB.JS: hideHub - Hub principal escondido (ou tentativa).");
        } else {
            console.warn("CHALLENGEHUB.JS: hideHub - Elemento challengeHubContainer não encontrado.");
        }
    }

    updateTotalQuestionsCount(count) {
        console.log("CHALLENGEHUB.JS: updateTotalQuestionsCount - Atualizando contagem total para:", count);
        if (this.elements.hubTotalQuestionsCount) {
            this.elements.hubTotalQuestionsCount.textContent = count || '0';
        }
        // Atualiza também o span na home page, se existir
        const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count'); // Este ID pode estar duplicado
        if (totalQuestionsSpanHome && totalQuestionsSpanHome !== this.elements.hubTotalQuestionsCount) { // Evita re-setar o mesmo elemento se for o caso
            totalQuestionsSpanHome.textContent = count || '0';
        }
    }

    updateQuickQuizCount(count) {
        console.log("CHALLENGEHUB.JS: updateQuickQuizCount - Atualizando contagem do quiz rápido para:", count);
        if (this.elements.hubQuickQuizCount) {
            this.elements.hubQuickQuizCount.textContent = count || '0';
        }
    }

    setupEventListeners() {
        console.log("CHALLENGEHUB.JS: setupEventListeners - Anexando listeners.");
        console.log("CHALLENGEHUB.JS: setupEventListeners - Botão Personalizar Quiz (hubCustomizeQuizBtn):", this.elements.hubCustomizeQuizBtn);
        console.log("CHALLENGEHUB.JS: setupEventListeners - Botão Quiz Rápido (hubQuickQuizBtn):", this.elements.hubQuickQuizBtn);
        console.log("CHALLENGEHUB.JS: setupEventListeners - Botão Fechar Filtros e Mostrar Hub (closeFiltersAndShowHubBtn):", this.elements.closeFiltersAndShowHubBtn);

        this.elements.hubCustomizeQuizBtn?.addEventListener('click', () => {
            console.log("CHALLENGEHUB.JS: Botão PERSONALIZAR QUIZ CLICADO");
            if (!this.quizUI || !this.quizLogic) {
                console.error("CHALLENGEHUB.JS: quizUI ou quizLogic INDISPONÍVEL ao clicar em Personalizar!");
                return;
            }
            console.log("CHALLENGEHUB.JS: Personalizar Quiz - Escondendo hub e mostrando painel de filtros.");
            this.hideHub();
            // Mostra o placeholder de filtros e abre o painel de filtros
            if (this.elements.placeholderFiltrosContainer) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
            this.quizUI.toggleFilterPanel(true);
        });

        this.elements.hubQuickQuizBtn?.addEventListener('click', () => {
            console.log("CHALLENGEHUB.JS: Botão QUIZ RÁPIDO CLICADO");
            if (this.quizLogic) {
                console.log("CHALLENGEHUB.JS: Quiz Rápido - Chamando quizLogic.startQuickQuiz()");
                this.hideHub();
                this.quizLogic.startQuickQuiz();
            } else {
                console.error("CHALLENGEHUB.JS: quizLogic INDISPONÍVEL ao clicar em Quiz Rápido!");
            }
        });

        this.elements.closeFiltersAndShowHubBtn?.addEventListener('click', () => {
            console.log("CHALLENGEHUB.JS: Botão 'Voltar para Modos de Jogo' (placeholder de filtros) CLICADO");
            if (this.quizUI) {
                this.quizUI.toggleFilterPanel(false); // Fecha o painel de filtros
            }
            this.showHub(); // Mostra o hub novamente
        });
    }
}