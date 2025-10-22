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

    _openCustomizationFlow() {
        if (!this.quizUI.modalManager) {
            console.error("ChallengeHub: modalManager não encontrado para abrir painel de filtros.");
            return;
        }
        this._setHubActiveClass(true);
        this.quizUI.modalManager.toggleFilterPanel(true);
    }

    async _handleChallengeCardClick(cardElement, originatingEvent = null) {
        if (!this.actionOrchestrator) {
            console.error('ChallengeHub: actionOrchestrator indisponível ao processar o card selecionado.');
            return;
        }

        if (cardElement?.id === 'hub-resume-quiz-card') {
            return;
        }

        const dataset = cardElement.dataset || {};
        const rawDefinitionId = dataset.quizDefinitionId ?? dataset.quizDefId;
        const quizDefinitionId = rawDefinitionId ? Number.parseInt(rawDefinitionId, 10) : Number.NaN;
        const quizSlug = dataset.quizSlug;
        const cardKey = (dataset.cardKey || '').toLowerCase();
        const hasPredefinedId = Number.isInteger(quizDefinitionId) && quizDefinitionId > 0;

        if (originatingEvent && typeof originatingEvent.preventDefault === 'function') {
            originatingEvent.preventDefault();
        }

        if (hasPredefinedId) {
            this.hideHub();
            await this.actionOrchestrator.startPredefinedQuiz(quizDefinitionId);
            return;
        }

        if (quizSlug && typeof this.actionOrchestrator.startPredefinedQuizBySlug === 'function') {
            this.hideHub();
            const executed = await this.actionOrchestrator.startPredefinedQuizBySlug(quizSlug);
            if (!executed) {
                this.quizUI.showWarning('Não foi possível iniciar este modo. Tente novamente.');
            }
            return;
        }

        switch (cardKey) {
            case 'smart_drill':
            case 'customize':
                this._openCustomizationFlow();
                return;
            case 'quick_quiz':
            case 'quick_start':
                this.hideHub();
                this.actionOrchestrator.startQuickQuiz();
                return;
            case 'timed_quiz':
                this.hideHub();
                await this.actionOrchestrator.startTimedSimulation();
                return;
            case 'favorite_review': {
                const executed = await this.actionOrchestrator.startFavoritesReview();
                if (executed) {
                    this.hideHub();
                }
                return;
            }
            case 'repeat_last': {
                const executed = await this.actionOrchestrator.retryLastQuizRequest();
                if (executed) {
                    this.hideHub();
                }
                return;
            }
            case 'training_mode': {
                const trainingId = dataset.quizDefinitionId ?? dataset.quizDefId;
                if (trainingId) {
                    const parsedId = Number.parseInt(trainingId, 10);
                    if (Number.isInteger(parsedId) && parsedId > 0) {
                        this.hideHub();
                        await this.actionOrchestrator.startPredefinedQuiz(parsedId);
                        return;
                    }
                }
                break;
            }
            default:
                break;
        }

        console.warn('ChallengeHub: nenhum manipulador configurado para o card selecionado.', cardElement);
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
        this.elements.hubCustomizeQuizBtn?.addEventListener('click', () => {
            this._openCustomizationFlow();
        });
        this.elements.hubSmartDrillBtn?.addEventListener('click', () => {
            this._openCustomizationFlow();
        });

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

        this.elements.hubFavoriteReviewBtn?.addEventListener('click', async (event) => {
            if (!this.actionOrchestrator) {
                console.error("ChallengeHub: actionOrchestrator indisponível ao iniciar revisão de favoritos.");
                return;
            }
            const target = event?.currentTarget;
            const quizDefinitionId = target && target.dataset
                ? Number.parseInt(target.dataset.quizDefinitionId ?? '', 10)
                : Number.NaN;
            if (Number.isInteger(quizDefinitionId) && quizDefinitionId > 0) {
                this.hideHub();
                await this.actionOrchestrator.startPredefinedQuiz(quizDefinitionId);
                return;
            }

            const executed = await this.actionOrchestrator.startFavoritesReview();
            if (executed) {
                this.hideHub();
            }
        });

        this.elements.hubRepeatLastBtn?.addEventListener('click', async (event) => {
            if (!this.actionOrchestrator) {
                console.error("ChallengeHub: actionOrchestrator indisponível ao repetir último desafio.");
                return;
            }
            const target = event?.currentTarget;
            const quizDefinitionId = target && target.dataset
                ? Number.parseInt(target.dataset.quizDefinitionId ?? '', 10)
                : Number.NaN;
            if (Number.isInteger(quizDefinitionId) && quizDefinitionId > 0) {
                this.hideHub();
                await this.actionOrchestrator.startPredefinedQuiz(quizDefinitionId);
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

        this.elements.challengeHubContainer?.addEventListener('click', async (event) => {
            const cardElement = event.target.closest('.challenge-card');
            if (!cardElement || !this.elements.challengeHubContainer.contains(cardElement)) {
                return;
            }
            if (this.elements.predefinedList && this.elements.predefinedList.contains(cardElement)) {
                return;
            }
            if (cardElement.tagName === 'A') {
                event.preventDefault();
            }
            await this._handleChallengeCardClick(cardElement, event);
        });

        this.elements.predefinedList?.addEventListener('click', async (event) => {
            const targetCard = event.target.closest('[data-quiz-def-id]');
            if (!targetCard) {
                return;
            }
            if (!this.actionOrchestrator) {
                console.error('ChallengeHub: actionOrchestrator indisponível ao iniciar quiz pré-definido.');
                return;
            }
            if (event.defaultPrevented) {
                return;
            }
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            await this._handleChallengeCardClick(targetCard, event);
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
                || cached.slug !== current.slug
                || cached.total_perguntas !== current.total_perguntas
                || cached.nome !== current.nome
                || cached.descricao !== current.descricao
                || cached.generation_type !== current.generation_type
                || cached.generation_label !== current.generation_label
                || cached.study_method !== current.study_method
                || cached.study_method_label !== current.study_method_label
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
                    slug: typeof quiz.slug === 'string' ? quiz.slug : '',
                    nome: typeof quiz.nome === 'string' ? quiz.nome : String(quiz.nome ?? ''),
                    descricao: typeof quiz.descricao === 'string' ? quiz.descricao : '',
                    total_perguntas: this._normalizeCount(quiz.total_perguntas) ?? 0,
                    generation_type: typeof quiz.generation_type === 'string' ? quiz.generation_type : null,
                    generation_label: typeof quiz.generation_label === 'string' ? quiz.generation_label : '',
                    study_method: typeof quiz.study_method === 'string' ? quiz.study_method : null,
                    study_method_label: typeof quiz.study_method_label === 'string'
                        ? quiz.study_method_label
                        : '',
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
            const cardLink = document.createElement('a');
            cardLink.classList.add('challenge-card', 'challenge-card--predefined');
            cardLink.dataset.quizDefId = String(quiz.id);
            cardLink.dataset.quizName = quiz.nome;
            if (quiz.slug) {
                cardLink.dataset.quizSlug = quiz.slug;
                cardLink.href = `/questions/?predefined_slug=${quiz.slug}#challenge-hub-container`;
            } else {
                cardLink.href = '#';
            }
            if (quiz.generation_type) {
                cardLink.dataset.generationType = quiz.generation_type;
            }
            if (quiz.generation_label) {
                cardLink.dataset.generationLabel = quiz.generation_label;
            }
            if (quiz.study_method) {
                cardLink.dataset.studyMethod = quiz.study_method;
            }
            if (quiz.study_method_label) {
                cardLink.dataset.studyMethodLabel = quiz.study_method_label;
            }
            cardLink.setAttribute('role', 'listitem');

            const formattedCount = this._formatCount(quiz.total_perguntas);
            const tooltipParts = [quiz.nome, `${formattedCount} questões`];
            if (quiz.study_method_label) {
                tooltipParts.push(quiz.study_method_label);
            } else if (quiz.generation_label) {
                tooltipParts.push(quiz.generation_label);
            }
            cardLink.title = tooltipParts.join(' • ');

            const ariaDetails = [];
            if (quiz.study_method_label) {
                ariaDetails.push(quiz.study_method_label);
            }
            if (quiz.generation_label) {
                ariaDetails.push(quiz.generation_label);
            }
            const ariaMeta = ariaDetails.length > 0
                ? `${formattedCount} questões • ${ariaDetails.join(' • ')}`
                : `${formattedCount} questões`;
            cardLink.setAttribute('aria-label', `${quiz.nome} com ${ariaMeta}`);
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
            const metaParts = [`${formattedCount} questões`];
            if (quiz.study_method_label) {
                metaParts.push(quiz.study_method_label);
            } else if (quiz.generation_label) {
                metaParts.push(quiz.generation_label);
            }
            meta.textContent = metaParts.join(' • ');
            footer.appendChild(meta);

            cardLink.append(header, footer);

            this.elements.predefinedList.appendChild(cardLink);
        });

        this.quizUI.showElement(this.elements.predefinedSection);
        this.predefinedQuizzesCache = sanitizedList;
    }
}
