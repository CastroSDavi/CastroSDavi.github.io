// File: assets/js/ui/ChallengeHub.js

export default class ChallengeHub {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;

        // A dependência do actionOrchestrator será injetada via setter
        this.actionOrchestrator = null;

        // Atalho para os elementos DOM relevantes gerenciados por QuizUI
        this._cacheElements();

        this._setHubActiveClass(this._isHubVisible());

        this.lastTotalQuestions = null;
        this.lastQuickQuizCount = null;
        this.predefinedQuizzesCache = [];
        this.lastResumableSessionId = null;
        this.lastResumeQuestionCount = null;
    }

    _cacheElements() {
        this.elements = {
            challengeHubContainer: this.quizUI.elements.challengeHubContainer,
            hubCustomizeQuizBtn: this.quizUI.elements.hubCustomizeQuizBtn,
            hubQuickQuizBtn: this.quizUI.elements.hubQuickQuizBtn,
            hubSmartDrillBtn: this.quizUI.elements.hubSmartDrillBtn,
            hubTimedQuizBtn: this.quizUI.elements.hubTimedQuizBtn,
            hubFavoriteReviewBtn: this.quizUI.elements.hubFavoriteReviewBtn,
            hubRepeatLastBtn: this.quizUI.elements.hubRepeatLastBtn,
            hubTotalQuestionsCount: this.quizUI.elements.hubTotalQuestionsCount,
            hubQuickQuizCount: this.quizUI.elements.hubQuickQuizCount,
            challengeStatTotal: this.quizUI.elements.challengeStatTotal,
            placeholderFiltrosContainer: this.quizUI.elements.placeholderFiltrosContainer,
            closeFiltersAndShowHubBtn: this.quizUI.elements.closeFiltersAndShowHubBtn,
            predefinedSection: this.quizUI.elements.hubPredefinedSection,
            predefinedList: this.quizUI.elements.hubPredefinedList,

            // --- INÍCIO DA CORREÇÃO: Mapeando para os novos IDs e estrutura ---
            resumeCard: document.getElementById('hub-resume-quiz-card'),
            resumeCardDescription: document.getElementById('hub-resume-card-description'),
            confirmResumeBtn: document.getElementById('hub-confirm-resume-btn'),
            discardResumeBtn: document.getElementById('hub-discard-resume-btn'),
            // --- FIM DA CORREÇÃO ---
        };
    }

    _isHubVisible() {
        if (!this.elements.challengeHubContainer) {
            return false;
        }

        const hiddenClass = this.quizUI?.hiddenClassName || 'u-is-hidden';
        return !this.elements.challengeHubContainer.classList.contains(hiddenClass);
    }

    _setHubActiveClass(isActive) {
        const bodyElement = document.body;
        if (!bodyElement) {
            return;
        }

        bodyElement.classList.toggle('is-challenge-hub-active', Boolean(isActive));

        if (isActive) {
            bodyElement.classList.remove('is-quiz-active');
        }
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

        this._setHubActiveClass(true);

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

        this._setHubActiveClass(false);
    }

    /**
     * Atualiza a contagem total de questões exibida no hub.
     * @param {number|string} count - O número de questões.
     */
    updateTotalQuestionsCount(count) {
        const formattedCount = typeof count === 'number'
            ? count.toLocaleString('pt-BR')
            : (count || '0');

        if (this.elements.hubTotalQuestionsCount) {
            this.elements.hubTotalQuestionsCount.textContent = formattedCount;
        }

        if (this.elements.challengeStatTotal) {
            this.elements.challengeStatTotal.textContent = formattedCount;
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
        this.lastResumableSessionId = resumableSession.session_id ?? null;
        this.lastResumeQuestionCount = questionCount;
    }

    /**
     * Esconde o card de "Continuar Desafio".
     */
    hideResumeOption() {
        if (this.elements.resumeCard) {
            this.quizUI.hideElement(this.elements.resumeCard);
        }
        this.lastResumableSessionId = null;
        this.lastResumeQuestionCount = null;
    }

    handleStateChange(currentState, previousState = {}) {
        if (!currentState) {
            return;
        }

        const totalQuestionsRaw = currentState?.geral?.totalQuestionsAvailable;
        const normalizedTotal = this._normalizeCount(totalQuestionsRaw);
        if (normalizedTotal !== null && normalizedTotal !== this.lastTotalQuestions) {
            this.lastTotalQuestions = normalizedTotal;
            this.updateTotalQuestionsCount(normalizedTotal);
        }

        const quickQuizRaw = currentState?.geral?.homeSummary?.quickQuizDefaultCount;
        const normalizedQuickQuiz = this._normalizeCount(quickQuizRaw);
        if (normalizedQuickQuiz !== null && normalizedQuickQuiz !== this.lastQuickQuizCount) {
            this.lastQuickQuizCount = normalizedQuickQuiz;
            this.updateQuickQuizCount(normalizedQuickQuiz);
        }

        const predefinedQuizzes = Array.isArray(currentState?.geral?.predefinedQuizzes?.items)
            ? currentState.geral.predefinedQuizzes.items
            : [];
        if (this._predefinedQuizzesChanged(predefinedQuizzes)) {
            this.renderPredefinedQuizzes(predefinedQuizzes);
        }

        const resumableSession = currentState?.quiz?.resumableSession || null;
        const sessionId = resumableSession?.session_id ?? null;
        const questionCount = resumableSession?.perguntas ? resumableSession.perguntas.length : null;

        if (resumableSession && (this.lastResumableSessionId !== sessionId || this.lastResumeQuestionCount !== questionCount)) {
            this.showResumeOption(resumableSession);
        } else if (!resumableSession && this.lastResumableSessionId !== null) {
            this.hideResumeOption();
        }
    }

    /**
     * Configura os event listeners para os botões dentro do hub de desafios.
     */
    setupEventListeners() {
        const openCustomizationFlow = () => {
            if (!this.quizUI.modalManager) {
                console.error("ChallengeHub: modalManager não encontrado para abrir painel de filtros.");
                return;
            }
            this.hideHub();
            if (this.elements.placeholderFiltrosContainer) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
            this.quizUI.modalManager.toggleFilterPanel(true);
        };

        this.elements.hubCustomizeQuizBtn?.addEventListener('click', openCustomizationFlow);
        this.elements.hubSmartDrillBtn?.addEventListener('click', openCustomizationFlow);

        this.elements.hubQuickQuizBtn?.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.hideHub();
                this.actionOrchestrator.startQuickQuiz();
            } else {
                console.error("ChallengeHub: actionOrchestrator indisponível ao clicar em Quiz Rápido.");
            }
        });

        this.elements.hubTimedQuizBtn?.addEventListener('click', async () => {
            if (!this.actionOrchestrator) {
                console.error("ChallengeHub: actionOrchestrator indisponível ao iniciar simulado cronometrado.");
                return;
            }
            this.hideHub();
            await this.actionOrchestrator.startTimedSimulation();
        });

        this.elements.hubFavoriteReviewBtn?.addEventListener('click', async () => {
            if (!this.actionOrchestrator) {
                console.error("ChallengeHub: actionOrchestrator indisponível ao iniciar revisão de favoritos.");
                return;
            }
            await this.actionOrchestrator.startFavoritesReview();
        });

        this.elements.hubRepeatLastBtn?.addEventListener('click', async () => {
            if (!this.actionOrchestrator) {
                console.error("ChallengeHub: actionOrchestrator indisponível ao repetir último desafio.");
                return;
            }
            const executed = await this.actionOrchestrator.retryLastQuizRequest();
            if (executed) {
                this.hideHub();
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

        this.elements.predefinedList?.addEventListener('click', (event) => {
            const targetCard = event.target.closest('[data-quiz-def-id]');
            if (!targetCard) {
                return;
            }
            if (!this.actionOrchestrator) {
                console.error('ChallengeHub: actionOrchestrator indisponível ao iniciar quiz pré-definido.');
                return;
            }

            const quizId = Number.parseInt(targetCard.dataset.quizDefId, 10);
            if (Number.isNaN(quizId)) {
                return;
            }

            this.hideHub();
            this.actionOrchestrator.startPredefinedQuiz(quizId);
        });
    }

    _normalizeCount(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const sanitized = value.replace(/[^0-9]/g, '');
            if (sanitized) {
                const parsed = Number.parseInt(sanitized, 10);
                if (!Number.isNaN(parsed)) {
                    return parsed;
                }
            }
        }
        return null;
    }

    _formatCount(value) {
        const normalized = this._normalizeCount(value);
        if (normalized === null) {
            return '0';
        }
        return normalized.toLocaleString('pt-BR');
    }

    _predefinedQuizzesChanged(newList) {
        if (!Array.isArray(newList)) {
            return this.predefinedQuizzesCache.length > 0;
        }

        if (newList.length !== this.predefinedQuizzesCache.length) {
            return true;
        }

        for (let index = 0; index < newList.length; index += 1) {
            const cached = this.predefinedQuizzesCache[index];
            const current = newList[index];
            if (!cached || !current) {
                return true;
            }
            if (
                cached.id !== current.id
                || cached.total_perguntas !== current.total_perguntas
                || cached.nome !== current.nome
                || cached.descricao !== current.descricao
            ) {
                return true;
            }
        }

        return false;
    }

    renderPredefinedQuizzes(quizzes = []) {
        if (!this.elements.predefinedList || !this.elements.predefinedSection) {
            return;
        }

        const sanitizedList = Array.isArray(quizzes)
            ? quizzes
                .map((quiz) => ({
                    id: Number.parseInt(quiz.id, 10),
                    nome: typeof quiz.nome === 'string' ? quiz.nome : String(quiz.nome ?? ''),
                    descricao: typeof quiz.descricao === 'string' ? quiz.descricao : '',
                    total_perguntas: this._normalizeCount(quiz.total_perguntas) ?? 0,
                }))
                .filter((quiz) => Number.isInteger(quiz.id) && quiz.id > 0)
            : [];

        this.elements.predefinedList.innerHTML = '';

        if (sanitizedList.length === 0) {
            this.quizUI.hideElement(this.elements.predefinedSection);
            this.predefinedQuizzesCache = [];
            return;
        }

        sanitizedList.forEach((quiz) => {
            const cardButton = document.createElement('button');
            cardButton.type = 'button';
            cardButton.classList.add('challenge-card');
            cardButton.dataset.quizDefId = String(quiz.id);
            cardButton.dataset.quizName = quiz.nome;
            cardButton.title = `${quiz.nome} • ${this._formatCount(quiz.total_perguntas)} questões`;
            cardButton.setAttribute('aria-label', `${quiz.nome} com ${this._formatCount(quiz.total_perguntas)} questões`);
            cardButton.setAttribute('role', 'listitem');

            const header = document.createElement('div');
            header.classList.add('challenge-card__header');

            const iconWrapper = document.createElement('div');
            iconWrapper.classList.add('challenge-card__icon-wrapper');

            const icon = document.createElement('span');
            icon.classList.add('material-symbols-outlined', 'challenge-card__icon');
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = 'menu_book';

            iconWrapper.appendChild(icon);

            const content = document.createElement('div');
            content.classList.add('challenge-card__content');

            const title = document.createElement('h3');
            title.classList.add('challenge-card__title');
            title.textContent = quiz.nome;
            content.appendChild(title);

            if (quiz.descricao && quiz.descricao.trim().length > 0) {
                const description = document.createElement('p');
                description.classList.add('challenge-card__description');
                description.textContent = quiz.descricao.trim();
                content.appendChild(description);
            }

            header.append(iconWrapper, content);

            const footer = document.createElement('div');
            footer.classList.add('challenge-card__footer');

            const meta = document.createElement('span');
            meta.classList.add('challenge-card__meta');
            meta.textContent = `${this._formatCount(quiz.total_perguntas)} questões`;
            footer.appendChild(meta);

            cardButton.append(header, footer);

            this.elements.predefinedList.appendChild(cardButton);
        });

        this.quizUI.showElement(this.elements.predefinedSection);
        this.predefinedQuizzesCache = sanitizedList;
    }
}