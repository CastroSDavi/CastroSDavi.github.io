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
            placeholderFiltrosContainer: this.quizUI.elements.placeholderFiltrosContainer,
            closeFiltersAndShowHubBtn: this.quizUI.elements.closeFiltersAndShowHubBtn,

            resumeCard: document.getElementById('hub-resume-quiz-card'),
            resumeCardDescription: document.getElementById('hub-resume-card-description'),
            confirmResumeBtn: document.getElementById('hub-confirm-resume-btn'),
            discardResumeBtn: document.getElementById('hub-discard-resume-btn'),

            hubDailyChallengeBtn: document.getElementById('hub-daily-challenge-btn'),
            hubFocusedReviewBtn: document.getElementById('hub-focused-review-btn'),
            hubTotalCategoriesCount: document.getElementById('hub-total-categories-count'),
            statTotalPoints: document.getElementById('hub-stat-total-points'),
            statQuestionsMastered: document.getElementById('hub-stat-questions-mastered'),
            statQuestionsToReview: document.getElementById('hub-stat-questions-to-review'),
            categoryChipList: document.getElementById('hub-category-chip-list'),
            quickFilterList: document.getElementById('hub-quick-filter-list'),
        };
    }

    _formatNumber(value) {
        if (value === null || value === undefined) {
            return '0';
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value.toLocaleString('pt-BR');
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed === '') return '0';
            const parsed = Number(trimmed.replace(/\./g, '').replace(',', '.'));
            if (!Number.isNaN(parsed)) {
                return parsed.toLocaleString('pt-BR');
            }
            return trimmed;
        }
        return '0';
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
        
        if (this.quizUI.warningDisplay) {
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
        const formattedCount = this._formatNumber(count);

        if (this.elements.hubTotalQuestionsCount) {
            this.elements.hubTotalQuestionsCount.textContent = formattedCount;
        }

        const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
        if (totalQuestionsSpanHome && totalQuestionsSpanHome !== this.elements.hubTotalQuestionsCount) {
            totalQuestionsSpanHome.textContent = formattedCount;
        }
    }

    /**
     * Atualiza a contagem de questões para o modo "Quiz Rápido".
     * @param {number|string} count - O número de questões para o quiz rápido.
     */
    updateQuickQuizCount(count) {
        const formattedCount = this._formatNumber(count);
        if (this.elements.hubQuickQuizCount) {
            this.elements.hubQuickQuizCount.textContent = formattedCount;
        }
    }

    updateTotalCategoriesCount(count) {
        const formattedCount = this._formatNumber(count);
        if (this.elements.hubTotalCategoriesCount) {
            this.elements.hubTotalCategoriesCount.textContent = formattedCount;
        }
    }

    updateUserStats(stats = {}) {
        const {
            pontos = 0,
            acertos = 0,
            erros = 0,
        } = stats;

        if (this.elements.statTotalPoints) {
            this.elements.statTotalPoints.textContent = this._formatNumber(pontos);
        }
        if (this.elements.statQuestionsMastered) {
            this.elements.statQuestionsMastered.textContent = this._formatNumber(acertos);
        }
        if (this.elements.statQuestionsToReview) {
            this.elements.statQuestionsToReview.textContent = this._formatNumber(erros);
        }
    }

    updateFeaturedCategories(categories = []) {
        const container = this.elements.categoryChipList;
        if (!container) return;

        container.innerHTML = '';

        const validCategories = Array.isArray(categories)
            ? categories.filter(cat => cat && cat.id_categoria !== undefined && cat.nome_categoria)
            : [];

        if (!validCategories.length) {
            const emptyState = document.createElement('p');
            emptyState.className = 'challenge-hub__empty-state';
            emptyState.textContent = 'As trilhas serão carregadas assim que os dados estiverem disponíveis.';
            container.appendChild(emptyState);
            return;
        }

        const topCategories = validCategories.slice(0, 6);

        topCategories.forEach(cat => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'challenge-chip';
            chip.dataset.categoryId = cat.id_categoria;
            chip.setAttribute('role', 'listitem');

            const titleSpan = document.createElement('span');
            titleSpan.className = 'challenge-chip__label';
            titleSpan.textContent = cat.nome_categoria;
            chip.appendChild(titleSpan);

            const description = typeof cat.descricao_categoria === 'string' ? cat.descricao_categoria.trim() : '';
            if (description) {
                const truncated = description.length > 72 ? `${description.slice(0, 69)}…` : description;
                const descriptionSpan = document.createElement('span');
                descriptionSpan.className = 'challenge-chip__meta';
                descriptionSpan.textContent = truncated;
                chip.appendChild(descriptionSpan);
                chip.title = `${cat.nome_categoria} • ${description}`;
            } else {
                chip.title = cat.nome_categoria;
            }

            container.appendChild(chip);
        });
    }

    _openFilterPanelWithPreset({ categoryIds = [], difficultyLevels = ['all'], numQuestions = null } = {}) {
        if (!this.quizUI.modalManager) {
            console.error('ChallengeHub: modalManager não encontrado para abrir painel de filtros.');
            return;
        }

        const normalizedCategoryIds = Array.isArray(categoryIds)
            ? categoryIds.filter(Boolean).map(id => id.toString())
            : [];

        if (this.quizUI.filterPanelInstance) {
            this.quizUI.filterPanelInstance.setCategoryTreeState(normalizedCategoryIds);
            if (Array.isArray(difficultyLevels) && difficultyLevels.length > 0) {
                this.quizUI.filterPanelInstance.setDifficultyState(difficultyLevels);
            }

            if (Number.isInteger(numQuestions) && numQuestions > 0) {
                this.quizUI.filterPanelInstance.setNumberOfQuestionsState(numQuestions);
            } else {
                this.quizUI.filterPanelInstance.setNumberOfQuestionsState(null);
            }

            this.quizUI.filterPanelInstance.setSearchQuery('');
        }

        this.hideHub();
        if (this.elements.placeholderFiltrosContainer) {
            this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
        }
        this.quizUI.modalManager.toggleFilterPanel(true);
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
            this._openFilterPanelWithPreset();
        });

        this.elements.hubQuickQuizBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startQuickQuiz();
            } else {
                console.error("ChallengeHub: actionOrchestrator indisponível ao clicar em Quiz Rápido.");
            }
        });

        this.elements.hubDailyChallengeBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startQuickQuiz(20);
            } else {
                console.error('ChallengeHub: actionOrchestrator indisponível ao iniciar o Desafio do Dia.');
            }
        });

        this.elements.hubFocusedReviewBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startCuratedChallenge({
                    difficultyLevels: ['difícil'],
                    numQuestions: 12,
                });
            } else {
                console.error('ChallengeHub: actionOrchestrator indisponível ao iniciar Revisão Focada.');
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

        this.elements.categoryChipList?.addEventListener('click', (event) => {
            const target = event.target.closest('.challenge-chip[data-category-id]');
            if (!target) return;

            const categoryId = target.dataset.categoryId;
            if (!categoryId) return;

            this._openFilterPanelWithPreset({ categoryIds: [categoryId] });
        });

        this.elements.quickFilterList?.addEventListener('click', (event) => {
            const actionButton = event.target.closest('.challenge-quick-action');
            if (!actionButton) return;
            if (!this.actionOrchestrator) {
                console.error('ChallengeHub: actionOrchestrator indisponível ao utilizar atalhos rápidos.');
                return;
            }

            const difficulty = actionButton.dataset.hubDifficulty;
            const numQuestions = Number.parseInt(actionButton.dataset.hubNumQuestions, 10);

            this.hideHub();
            this.actionOrchestrator.startCuratedChallenge({
                difficultyLevels: difficulty ? [difficulty] : undefined,
                numQuestions: Number.isInteger(numQuestions) && numQuestions > 0 ? numQuestions : undefined,
            });
        });
    }
}