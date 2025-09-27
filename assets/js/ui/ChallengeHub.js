// File: assets/js/ui/ChallengeHub.js

export default class ChallengeHub {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance; 
        
        // A dependência do actionOrchestrator será injetada via setter
        this.actionOrchestrator = null;

        // Atalho para os elementos DOM relevantes gerenciados por QuizUI
        this._cacheElements();
    }
    
    _cacheElements() {
        this.elements = {
            challengeHubContainer: this.quizUI.elements.challengeHubContainer,
            hubCustomizeQuizBtn: this.quizUI.elements.hubCustomizeQuizBtn,
            hubQuickQuizBtn: this.quizUI.elements.hubQuickQuizBtn,
            hubTotalQuestionsCount: this.quizUI.elements.hubTotalQuestionsCount,
            hubQuickQuizCount: this.quizUI.elements.hubQuickQuizCount,
            hubTotalQuestionsCountSummary: document.getElementById('hub-total-questions-count-summary'),
            hubWarmupQuizBtn: document.getElementById('hub-warmup-quiz-btn'),
            hubFocusedQuizBtn: document.getElementById('hub-focused-quiz-btn'),
            hubMarathonQuizBtn: document.getElementById('hub-marathon-quiz-btn'),
            hubHardcoreQuizBtn: document.getElementById('hub-hardcore-quiz-btn'),
            placeholderFiltrosContainer: this.quizUI.elements.placeholderFiltrosContainer,
            closeFiltersAndShowHubBtn: this.quizUI.elements.closeFiltersAndShowHubBtn,

            // --- INÍCIO DA CORREÇÃO: Mapeando para os novos IDs e estrutura ---
            resumeCard: document.getElementById('hub-resume-quiz-card'),
            resumeCardDescription: document.getElementById('hub-resume-card-description'),
            confirmResumeBtn: document.getElementById('hub-confirm-resume-btn'),
            discardResumeBtn: document.getElementById('hub-discard-resume-btn'),
            // --- FIM DA CORREÇÃO ---
        };
    }

    /**
     * Define a instância do ActionOrchestrator.
     * @param {ActionOrchestrator} orchestrator - A instância do orquestrador.
     */
    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }

    /**
     * Mostra o hub de desafios e garante que outros painéis conflitantes estejam escondidos.
     */
    showHub() {
        if (this.elements.challengeHubContainer) {
            this.quizUI.showElement(this.elements.challengeHubContainer);
        }
        
        this.quizUI.hideElement(this.elements.placeholderFiltrosContainer);
        this.quizUI.hideElement(this.quizUI.elements.quizSectionContent);
        this.quizUI.hideElement(this.quizUI.elements.resultadoCard);
        
        if (this.quizUI.scorePanel) {
            this.quizUI.scorePanel.hide();
        } else {
            this.quizUI.hideElement(this.quizUI.elements.scorePanel);
        }
        
        if (typeof this.quizUI.clearInlineMessages === 'function') {
            this.quizUI.clearInlineMessages();
        } else if (this.quizUI.warningDisplay) {
            this.quizUI.warningDisplay.clear();
        }
    }

    /**
     * Esconde o hub de desafios.
     */
    hideHub() {
        if (this.elements.challengeHubContainer) {
            this.quizUI.hideElement(this.elements.challengeHubContainer);
        }
    }

    /**
     * Atualiza a contagem total de questões exibida no hub.
     * @param {number|string} count - O número de questões.
     */
    updateTotalQuestionsCount(count) {
        let formattedCount = '0';

        if (typeof count === 'number' && Number.isFinite(count)) {
            formattedCount = count.toLocaleString('pt-BR');
        } else if (typeof count === 'string') {
            const trimmed = count.trim();
            if (trimmed.length > 0) {
                const normalized = trimmed.replace(/\./g, '').replace(',', '.');
                const numericCount = Number(normalized);
                formattedCount = Number.isFinite(numericCount)
                    ? numericCount.toLocaleString('pt-BR')
                    : trimmed;
            }
        }

        if (this.elements.hubTotalQuestionsCount) {
            this.elements.hubTotalQuestionsCount.textContent = formattedCount;
        }

        if (this.elements.hubTotalQuestionsCountSummary) {
            this.elements.hubTotalQuestionsCountSummary.textContent = formattedCount;
        }

        const totalQuestionsSpanHome = document.querySelector('#home-section #hub-total-questions-count');
        if (totalQuestionsSpanHome && totalQuestionsSpanHome !== this.elements.hubTotalQuestionsCount) {
            totalQuestionsSpanHome.textContent = formattedCount;
        }
    }

    /**
     * Atualiza a contagem de questões para o modo "Quiz Rápido".
     * @param {number|string} count - O número de questões para o quiz rápido.
     */
    updateQuickQuizCount(count) {
        if (this.elements.hubQuickQuizCount) {
            this.elements.hubQuickQuizCount.textContent = count || '0';
        }
    }

    /**
     * Exibe e configura o card de "Continuar Desafio".
     * @param {object} resumableSession - Os dados da sessão a ser resumida.
     */
    showResumeOption(resumableSession) {
        if (!this.elements.resumeCard || !resumableSession) return;

        const questionCount = resumableSession.perguntas?.length || 0;
        this.elements.resumeCardDescription.innerHTML = `Você tem uma sessão em andamento de <strong>${questionCount}</strong> questões.`;

        this.quizUI.showElement(this.elements.resumeCard);
    }

    /**
     * Esconde o card de "Continuar Desafio".
     */
    hideResumeOption() {
        if (this.elements.resumeCard) {
            this.quizUI.hideElement(this.elements.resumeCard);
        }
    }

    /**
     * Configura os event listeners para os botões dentro do hub de desafios.
     */
    setupEventListeners() {
        this.elements.hubCustomizeQuizBtn?.addEventListener('click', () => {
            if (!this.quizUI.modalManager) { 
                console.error("ChallengeHub: modalManager não encontrado para abrir painel de filtros.");
                return;
            }
            this.hideHub();
            if (this.elements.placeholderFiltrosContainer) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
            this.quizUI.modalManager.toggleFilterPanel(true);
        });

        this.elements.hubQuickQuizBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startQuickQuiz();
            } else {
                console.error("ChallengeHub: actionOrchestrator indisponível ao clicar em Quiz Rápido.");
            }
        });

        this.elements.hubWarmupQuizBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startWarmupQuiz();
            }
        });

        this.elements.hubFocusedQuizBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startFocusedQuiz();
            }
        });

        this.elements.hubMarathonQuizBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startMarathonQuiz();
            }
        });

        this.elements.hubHardcoreQuizBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startHardcoreQuiz();
            }
        });

        // --- INÍCIO DA CORREÇÃO: Listeners agora nos botões corretos e separados ---
        this.elements.confirmResumeBtn?.addEventListener('click', () => {
             if (this.actionOrchestrator) {
                this.actionOrchestrator._proceedWithResumedSession();
            }
        });

        this.elements.discardResumeBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.actionOrchestrator._discardAndGoToHub();
            }
        });
        // --- FIM DA CORREÇÃO ---
    }
}