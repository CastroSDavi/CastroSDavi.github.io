// File: assets/js/ui/ChallengeHub.js

export default class ChallengeHub {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance; 
        
        // A dependência do actionOrchestrator será injetada via setter
        this.actionOrchestrator = null;
        this.store = null;
        this.unsubscribeStore = null;
        this.previousPredefinedSignature = null;

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
            
            predefinedQuizzesSection: this.quizUI.elements.predefinedQuizzesSection,
            predefinedQuizzesContainer: this.quizUI.elements.predefinedQuizzesContainer,
            predefinedQuizzesLoading: this.quizUI.elements.predefinedQuizzesLoading,
            predefinedQuizzesEmpty: this.quizUI.elements.predefinedQuizzesEmpty,
            predefinedQuizzesError: this.quizUI.elements.predefinedQuizzesError,
            predefinedQuizzesMetrics: this.quizUI.elements.predefinedQuizzesMetrics,
            predefinedQuizzesCount: this.quizUI.elements.predefinedQuizzesCount,
            predefinedQuestionsTotal: this.quizUI.elements.predefinedQuestionsTotal,
            
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

    setStore(storeInstance) {
        if (this.unsubscribeStore) {
            this.unsubscribeStore();
            this.unsubscribeStore = null;
        }
        this.store = storeInstance;
        if (this.store && typeof this.store.subscribe === 'function') {
            const boundHandler = this.handleStateUpdate.bind(this);
            this.unsubscribeStore = this.store.subscribe(boundHandler);
            this.handleStateUpdate();
        }
    }

    handleStateUpdate() {
        if (!this.store) return;
        const geralState = this.store.getState().geral || {};
        const quizzes = Array.isArray(geralState.predefinedQuizzes) ? geralState.predefinedQuizzes : [];
        const signature = JSON.stringify({
            ids: quizzes.map(item => item?.id).filter(Boolean),
            loading: geralState.isLoadingPredefinedQuizzes === true,
            error: geralState.predefinedQuizzesError || null,
        });
        if (this.previousPredefinedSignature === signature) {
            return;
        }
        this.previousPredefinedSignature = signature;
        this.renderPredefinedQuizzes({
            quizzes,
            isLoading: geralState.isLoadingPredefinedQuizzes === true,
            error: geralState.predefinedQuizzesError,
        });
    }

    renderPredefinedQuizzes({ quizzes, isLoading, error }) {
        const section = this.elements.predefinedQuizzesSection;
        if (!section) {
            return;
        }

        const container = this.elements.predefinedQuizzesContainer;
        const loadingEl = this.elements.predefinedQuizzesLoading;
        const emptyEl = this.elements.predefinedQuizzesEmpty;
        const errorEl = this.elements.predefinedQuizzesError;
        const metricsWrapper = this.elements.predefinedQuizzesMetrics;
        const listsCountEl = this.elements.predefinedQuizzesCount;
        const totalQuestionsEl = this.elements.predefinedQuestionsTotal;

        const hideFeedback = () => {
            if (loadingEl) this.quizUI.hideElement(loadingEl);
            if (emptyEl) this.quizUI.hideElement(emptyEl);
            if (errorEl) {
                errorEl.textContent = '';
                this.quizUI.hideElement(errorEl);
            }
        };

        if (loadingEl) {
            loadingEl.textContent = 'Carregando listas...';
        }

        const list = Array.isArray(quizzes) ? quizzes : [];

        if (isLoading) {
            this.quizUI.showElement(section);
            hideFeedback();
            if (loadingEl) {
                this.quizUI.showElement(loadingEl);
            }
            if (metricsWrapper) {
                this.quizUI.hideElement(metricsWrapper);
            }
            if (container) {
                container.innerHTML = '';
            }
            return;
        }

        const hasError = typeof error === 'string' && error.trim() !== '';
        if (hasError) {
            this.quizUI.showElement(section);
            hideFeedback();
            if (container) {
                container.innerHTML = '';
            }
            if (errorEl) {
                errorEl.textContent = error;
                this.quizUI.showElement(errorEl);
            }
            if (metricsWrapper) {
                this.quizUI.hideElement(metricsWrapper);
            }
            return;
        }

        if (list.length === 0) {
            this.quizUI.showElement(section);
            hideFeedback();
            if (container) {
                container.innerHTML = '';
            }
            if (emptyEl) {
                this.quizUI.showElement(emptyEl);
            }
            if (metricsWrapper) {
                this.quizUI.hideElement(metricsWrapper);
            }
            return;
        }

        this.quizUI.showElement(section);
        hideFeedback();

        if (!container) {
            return;
        }

        container.innerHTML = '';
        let totalQuestions = 0;
        list.forEach((quiz) => {
            totalQuestions += Number.isFinite(Number(quiz?.question_count)) ? Number(quiz.question_count) : 0;
            container.appendChild(this._createPredefinedQuizCard(quiz));
        });

        if (listsCountEl) {
            listsCountEl.textContent = String(list.length);
        }
        if (totalQuestionsEl) {
            totalQuestionsEl.textContent = String(totalQuestions);
        }
        if (metricsWrapper) {
            this.quizUI.showElement(metricsWrapper);
        }
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
        if (this.elements.hubTotalQuestionsCount) {
            this.elements.hubTotalQuestionsCount.textContent = count || '0';
        }
        
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

    _createPredefinedQuizCard(quiz) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'challenge-card challenge-card--predefined';
        if (quiz?.id !== undefined && quiz?.id !== null) {
            card.dataset.quizId = String(quiz.id);
        }

        const label = (quiz?.nome || 'Lista curada').toString();
        const questionCountRaw = Number(quiz?.question_count);
        const questionCount = Number.isNaN(questionCountRaw) ? 0 : questionCountRaw;
        const questionLabel = questionCount === 1 ? 'questão' : 'questões';
        const topCategories = Array.isArray(quiz?.top_categories)
            ? quiz.top_categories.map((item) => (item ?? '').toString().trim()).filter(Boolean)
            : [];
        const totalCategoriesRaw = Number(quiz?.total_categories);
        const totalCategories = Number.isNaN(totalCategoriesRaw)
            ? topCategories.length
            : totalCategoriesRaw;
        const description = this._resolvePredefinedDescription({
            quiz,
            topCategories,
            questionCount,
            totalCategories,
        });
        const updatedLabel = this._formatRelativeDate(quiz?.updated_at);

        card.title = label + ' - ' + questionCount + ' ' + questionLabel;

        const ariaParts = ['Iniciar ' + label];
        if (questionCount) {
            ariaParts.push(questionCount + ' ' + questionLabel);
        }
        if (topCategories.length) {
            ariaParts.push('Temas: ' + topCategories.slice(0, 2).join(', '));
        }
        card.setAttribute('aria-label', ariaParts.join('. ') + '.');

        const content = document.createElement('div');
        content.className = 'challenge-card__content challenge-card__content--predefined';

        const header = document.createElement('div');
        header.className = 'challenge-card__header';

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'challenge-card__icon-wrapper challenge-card__icon-wrapper--predefined';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined challenge-card__icon';
        icon.textContent = 'menu_book';
        iconWrapper.appendChild(icon);
        header.appendChild(iconWrapper);

        const headerText = document.createElement('div');
        headerText.className = 'challenge-card__header-text';
        const title = document.createElement('h3');
        title.className = 'challenge-card__title';
        title.textContent = label;
        headerText.appendChild(title);

        if (updatedLabel) {
            const updatedBadge = document.createElement('span');
            updatedBadge.className = 'challenge-card__meta-note';
            updatedBadge.textContent = updatedLabel;
            headerText.appendChild(updatedBadge);
        }

        header.appendChild(headerText);
        content.appendChild(header);

        if (description) {
            const descriptionEl = document.createElement('p');
            descriptionEl.className = 'challenge-card__description challenge-card__description--predefined';
            descriptionEl.textContent = description;
            content.appendChild(descriptionEl);
        }

        const metaItems = [];
        if (questionCount) {
            metaItems.push(this._createMetaItem('quiz', questionCount + ' ' + questionLabel));
        }
        if (totalCategories > 0) {
            const categoryLabel = totalCategories === 1 ? 'tema' : 'temas';
            metaItems.push(this._createMetaItem('category', totalCategories + ' ' + categoryLabel));
        }
        if (metaItems.length) {
            const meta = document.createElement('div');
            meta.className = 'challenge-card__meta';
            metaItems.forEach((item) => meta.appendChild(item));
            content.appendChild(meta);
        }

        const displayedCategories = topCategories.slice(0, 2);
        const referenceTotal = totalCategories || topCategories.length;
        if (displayedCategories.length) {
            const tagsWrapper = document.createElement('div');
            tagsWrapper.className = 'challenge-card__tags';
            displayedCategories.forEach((category) => {
                const tag = document.createElement('span');
                tag.className = 'challenge-card__tag';
                tag.textContent = category;
                tagsWrapper.appendChild(tag);
            });
            const remaining = Math.max(referenceTotal - displayedCategories.length, 0);
            if (remaining > 0) {
                const tag = document.createElement('span');
                tag.className = 'challenge-card__tag challenge-card__tag--more';
                const remainingLabel = '+' + remaining + ' ' + (remaining === 1 ? 'tema' : 'temas');
                tag.textContent = remainingLabel;
                tagsWrapper.appendChild(tag);
            }
            content.appendChild(tagsWrapper);
        }

        card.appendChild(content);

        card.addEventListener('click', () => {
            if (this.actionOrchestrator) {
                this.actionOrchestrator.startPredefinedQuiz(quiz?.id);
            }
        });

        return card;
    }


    _createMetaItem(iconName, text) {
        const wrapper = document.createElement('span');
        wrapper.className = 'challenge-card__meta-item';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = iconName;
        wrapper.appendChild(icon);

        const label = document.createElement('span');
        label.textContent = text;
        wrapper.appendChild(label);

        return wrapper;
    }

    _resolvePredefinedDescription({ quiz, topCategories, questionCount, totalCategories }) {
        const raw = (quiz?.descricao ?? '').toString().trim();
        if (raw) {
            return raw;
        }

        if (topCategories.length === 1) {
            return 'Foco principal em ' + topCategories[0] + '.';
        }
        if (topCategories.length === 2) {
            return 'Mistura ' + topCategories[0] + ' e ' + topCategories[1] + '.';
        }
        if (topCategories.length > 2) {
            const highlighted = topCategories.slice(0, 3);
            const last = highlighted.pop();
            const prefix = highlighted.length ? highlighted.join(', ') + ' e ' + last : last;
            return 'Temas em destaque: ' + prefix + '.';
        }
        if (questionCount) {
            const label = questionCount === 1 ? 'questão' : 'questões';
            return 'Coleção com ' + questionCount + ' ' + label + ' selecionadas.';
        }
        if (totalCategories) {
            const label = totalCategories === 1 ? 'tema' : 'temas';
            return 'Percorra ' + totalCategories + ' ' + label + ' essenciais.';
        }
        return 'Lista pronta para revisar rapidamente os principais assuntos.';
    }


    _formatRelativeDate(isoString) {
        if (!isoString) {
            return null;
        }
        const parsed = new Date(isoString);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        const now = new Date();
        let diffMs = now.getTime() - parsed.getTime();
        const isFuture = diffMs < 0;
        diffMs = Math.abs(diffMs);

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        const week = 7 * day;
        const month = 30 * day;

        const formatter = (value, singular, plural) => `${isFuture ? 'Disponível em' : 'Atualizado há'} ${value} ${value === 1 ? singular : plural}`;

        if (diffMs < hour) {
            const minutes = Math.max(1, Math.round(diffMs / minute));
            if (minutes <= 1) {
                return isFuture ? 'Disponível em instantes' : 'Atualizado agora';
            }
            return formatter(minutes, 'minuto', 'minutos');
        }

        if (diffMs < day) {
            const hours = Math.round(diffMs / hour);
            return formatter(hours, 'hora', 'horas');
        }

        if (diffMs < week) {
            const days = Math.round(diffMs / day);
            return formatter(days, 'dia', 'dias');
        }

        if (diffMs < month) {
            const weeks = Math.round(diffMs / week);
            return formatter(weeks, 'semana', 'semanas');
        }

        const months = Math.round(diffMs / month);
        if (months < 12) {
            return formatter(months, 'mês', 'meses');
        }

        return `${isFuture ? 'Disponível em' : 'Atualizado em'} ${parsed.toLocaleDateString('pt-BR')}`;
    }

}


