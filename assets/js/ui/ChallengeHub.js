// File: assets/js/ui/ChallengeHub.js

export default class ChallengeHub {
    constructor(quizUIInstance, quizLogicInstance = null) {
        // console.log("CHALLENGEHUB.JS: Constructor - Instanciando ChallengeHub.");
        this.quizUI = quizUIInstance; 
        this.quizLogic = quizLogicInstance;
        
        // Atalho para os elementos DOM relevantes gerenciados por QuizUI
        this.elements = {
            challengeHubContainer: this.quizUI.elements.challengeHubContainer,
            hubCustomizeQuizBtn: this.quizUI.elements.hubCustomizeQuizBtn,
            hubQuickQuizBtn: this.quizUI.elements.hubQuickQuizBtn,
            hubTotalQuestionsCount: this.quizUI.elements.hubTotalQuestionsCount,
            hubQuickQuizCount: this.quizUI.elements.hubQuickQuizCount,
            placeholderFiltrosContainer: this.quizUI.elements.placeholderFiltrosContainer,
            // O closeFiltersAndShowHubBtn é referenciado, mas seu listener principal
            // para fechar o painel de filtros é gerenciado externamente (ModalManager/QuizUI).
            closeFiltersAndShowHubBtn: this.quizUI.elements.closeFiltersAndShowHubBtn,
        };
        // console.log("CHALLENGEHUB.JS: Constructor - Elementos relevantes:", this.elements);
    }

    /**
     * Define a instância de QuizLogic.
     * @param {QuizLogic} quizLogicInstance - A instância de QuizLogic.
     */
    setQuizLogic(quizLogicInstance) {
        // console.log("CHALLENGEHUB.JS: setQuizLogic - Instância de QuizLogic definida.");
        this.quizLogic = quizLogicInstance;
    }

    /**
     * Mostra o hub de desafios e garante que outros painéis conflitantes estejam escondidos.
     */
    showHub() {
        // console.log("CHALLENGEHUB.JS: showHub - Mostrando hub.");
        if (this.elements.challengeHubContainer) {
            this.quizUI.showElement(this.elements.challengeHubContainer);
        }
        
        // Garante que outros elementos da UI do quiz estejam escondidos
        this.quizUI.hideElement(this.elements.placeholderFiltrosContainer);
        this.quizUI.hideElement(this.quizUI.elements.quizSectionContent); // Esconde a área de quiz ativo
        this.quizUI.hideElement(this.quizUI.elements.resultadoCard);    // Esconde o card de resultados
        
        // Esconde o painel de pontuação usando o submódulo ScorePanel de QuizUI
        if (this.quizUI.scorePanel) {
            this.quizUI.scorePanel.hide();
        } else {
            // Fallback se scorePanel não estiver disponível (menos provável com a nova estrutura)
            this.quizUI.hideElement(this.quizUI.elements.scorePanel);
        }
        
        // Limpa quaisquer avisos usando o submódulo WarningDisplay de QuizUI
        if (this.quizUI.warningDisplay) {
            this.quizUI.warningDisplay.clear(); 
        } else {
            // Fallback ou aviso no console se warningDisplay não estiver disponível
            // console.warn("ChallengeHub.showHub: warningDisplay não foi encontrado na instância de quizUI.");
        }
    }

    /**
     * Esconde o hub de desafios.
     */
    hideHub() {
        // console.log("CHALLENGEHUB.JS: hideHub - Escondendo hub.");
        if (this.elements.challengeHubContainer) {
            this.quizUI.hideElement(this.elements.challengeHubContainer);
        }
    }

    /**
     * Atualiza a contagem total de questões exibida no hub.
     * @param {number|string} count - O número de questões.
     */
    updateTotalQuestionsCount(count) {
        // console.log("CHALLENGEHUB.JS: updateTotalQuestionsCount - Atualizando contagem total para:", count);
        if (this.elements.hubTotalQuestionsCount) {
            this.elements.hubTotalQuestionsCount.textContent = count || '0';
        }
        // Atualiza também o span na home page, se existir e for diferente,
        // para manter a consistência se o mesmo ID for usado.
        const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
        if (totalQuestionsSpanHome && totalQuestionsSpanHome !== this.elements.hubTotalQuestionsCount) {
            totalQuestionsSpanHome.textContent = count || '0';
        }
    }

    /**
     * Atualiza a contagem de questões para o modo "Quiz Rápido".
     * @param {number|string} count - O número de questões para o quiz rápido.
     */
    updateQuickQuizCount(count) {
        // console.log("CHALLENGEHUB.JS: updateQuickQuizCount - Atualizando contagem do quiz rápido para:", count);
        if (this.elements.hubQuickQuizCount) {
            this.elements.hubQuickQuizCount.textContent = count || '0';
        }
    }

    /**
     * Configura os event listeners para os botões dentro do hub de desafios.
     */
    setupEventListeners() {
        // console.log("CHALLENGEHUB.JS: setupEventListeners - Configurando listeners do hub.");

        this.elements.hubCustomizeQuizBtn?.addEventListener('click', () => {
            // console.log("CHALLENGEHUB.JS: Botão PERSONALIZAR QUIZ CLICADO");
            if (!this.quizLogic) { 
                console.error("CHALLENGEHUB.JS: quizLogic INDISPONÍVEL ao clicar em Personalizar!");
                return;
            }
            this.hideHub();
            // Mostra o placeholder de filtros e abre o painel de filtros
            if (this.elements.placeholderFiltrosContainer) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
            // Usa o ModalManager (através de QuizUI) para abrir o painel de filtros
            if (this.quizUI.modalManager) { 
                this.quizUI.modalManager.toggleFilterPanel(true);
            } else {
                console.warn("ChallengeHub: modalManager não encontrado em quizUI para abrir painel de filtros.");
            }
        });

        this.elements.hubQuickQuizBtn?.addEventListener('click', () => {
            // console.log("CHALLENGEHUB.JS: Botão QUIZ RÁPIDO CLICADO");
            if (this.quizLogic) {
                this.hideHub();
                this.quizLogic.startQuickQuiz(); // Delega para QuizLogic iniciar o quiz rápido
            } else {
                console.error("CHALLENGEHUB.JS: quizLogic INDISPONÍVEL ao clicar em Quiz Rápido!");
            }
        });

        // O listener para this.elements.closeFiltersAndShowHubBtn (botão "Voltar para Modos de Jogo"
        // dentro do placeholder de filtros) é melhor gerenciado em QuizUI.setupGlobalEventListeners,
        // pois precisa coordenar o fechamento do painel de filtros (via ModalManager)
        // E a exibição do hub (via esta instância de ChallengeHub).
    }
}
