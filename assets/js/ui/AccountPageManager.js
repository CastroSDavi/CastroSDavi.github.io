// assets/js/ui/AccountPageManager.js

import { quizActions } from '../app/flux/actions.js';

export default class AccountPageManager {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        
        this.store = null;
        this.actionOrchestrator = null;
        this.statisticsChartManager = null;
        this.favoriteManager = null;

        this.hasInitialized = false;
        this.previousActiveTab = null;
        
        this.elements = {
            accountSectionPage: document.getElementById('account-section-page'),
            sidebar: document.querySelector('#account-section-page .account-sidebar'),
            contentArea: document.querySelector('#account-section-page .account-content'),
            backToMenuButton: document.getElementById('account-back-to-menu'),
            sidebarLinks: null,
            contentSections: null,
            btnOpenDeleteModal: this.quizUI.elements.btnOpenDeleteAccountModal,
            deleteAccountForm: this.quizUI.elements.deleteAccountForm,
            passwordInputDelete: this.quizUI.elements.passwordInputDeleteAccount,
        };
        this.historyElements = {
            contentSection: document.getElementById('quiz-history-content'),
            loadingMessage: document.getElementById('quiz-history-loading'),
            tableWrapper: document.getElementById('quiz-history-table-wrapper'),
            tableBody: document.getElementById('quiz-history-table-body'),
            emptyState: document.getElementById('quiz-history-empty'),
            errorState: document.getElementById('quiz-history-error'),
            pagination: {
                container: document.getElementById('quiz-history-pagination'),
                prevButton: document.getElementById('quiz-history-prev'),
                nextButton: document.getElementById('quiz-history-next'),
                pageIndicator: document.getElementById('quiz-history-page-indicator'),
            },
            filters: {
                sessionSelect: document.getElementById('quiz-history-session-filter'),
                startDateInput: document.getElementById('quiz-history-start-date'),
                endDateInput: document.getElementById('quiz-history-end-date'),
                applyButton: document.getElementById('quiz-history-filter-apply'),
                resetButton: document.getElementById('quiz-history-filter-reset'),
            },
        };
        this.bodyElement = document.body;
        // --- INÍCIO DA CORREÇÃO ---
        // A referência ao bottomNavElement foi removida daqui.
        // --- FIM DA CORREÇÃO ---
        this.defaultMenuTargetId = 'profile-info-content';
        this.historyState = {
            initialized: false,
            isLoading: false,
            error: null,
            hasFetched: false,
            items: [],
            pagination: {
                count: 0,
                next: null,
                previous: null,
                page: 1,
                pageSize: 10,
            },
            filters: {
                sessionId: '',
                startDate: '',
                endDate: '',
            },
        };
    }

    setStore(storeInstance) {
        this.store = storeInstance;
        if(this.store) {
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }
    
    setStatisticsChartManager(manager) {
        this.statisticsChartManager = manager;
    }

    setFavoriteManager(manager) {
        this.favoriteManager = manager;
    }

    init() {
        if (this.hasInitialized || !this.elements.accountSectionPage || (this.bodyElement.dataset.pageId !== 'account')) {
            return;
        }

        this.elements.sidebarLinks = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-sidebar__link'));
        this.elements.contentSections = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-content__section'));

        if (this.elements.sidebarLinks.length === 0 || this.elements.contentSections.length === 0) return;

        this.defaultMenuTargetId = this.elements.sidebarLinks[0]?.dataset.target || 'profile-info-content';
        
        this._setupEventListeners();
        this._setInitialTabFromURL();

        this._updateUIVisibility(!this._isMobileView());
        
        this.hasInitialized = true;
    }

    _setupEventListeners() {
        this.elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetId = link.dataset.target;
                this.store.dispatch(quizActions.setAccountPageTab(targetId));
                
                if (this._isMobileView()) {
                    this._updateUIVisibility(true);
                }
            });
        });

        this.elements.backToMenuButton?.addEventListener('click', () => {
            if (this._isMobileView()) {
                this._updateUIVisibility(false); 
            }
        });

        window.addEventListener('resize', this._handleResize.bind(this));

        this.elements.btnOpenDeleteModal?.addEventListener('click', () => {
            if (this.quizUI.modalManager) {
                this.quizUI.modalManager.toggleDeleteAccountModal(true);
            }
        });
    }

    handleStateUpdate() {
        if (!this.hasInitialized || !this.store) return;

        const currentState = this.store.getState();
        const newActiveTab = currentState.ui.accountPageActiveTab;

        if (newActiveTab !== this.previousActiveTab) {
            this.previousActiveTab = newActiveTab;
            
            this.setActiveTab(newActiveTab);
            this._loadDynamicContent(newActiveTab);
        }
    }
    
    _loadDynamicContent(targetId) {
        if (targetId === 'favorite-questions-content' && this.favoriteManager) {
            this.favoriteManager.init();
            const favoritesState = this.store.getState().user.favorites;
            if (!favoritesState.hasBeenFetched && !favoritesState.isLoading) {
                this.actionOrchestrator?.loadAndDisplayFavoriteQuestionsForAccountPage();
            }
        } else if (targetId === 'quiz-history-content') {
            this._initializeHistoryTab();
        } else if (targetId === 'statistics-content' && this.statisticsChartManager) {
            this.statisticsChartManager.init();
        }
    }

    _initializeHistoryTab() {
        if (!this.historyElements.contentSection) {
            return;
        }

        if (!this.historyState.initialized) {
            const { filters, pagination } = this.historyElements;

            filters?.applyButton?.addEventListener('click', (event) => {
                event.preventDefault();
                this._applyHistoryFilters();
            });

            filters?.resetButton?.addEventListener('click', (event) => {
                event.preventDefault();
                this._resetHistoryFilters();
            });

            pagination?.prevButton?.addEventListener('click', (event) => {
                event.preventDefault();
                this._goToHistoryPage('previous');
            });

            pagination?.nextButton?.addEventListener('click', (event) => {
                event.preventDefault();
                this._goToHistoryPage('next');
            });

            this.historyState.initialized = true;
        }

        if (!this.historyState.hasFetched && !this.historyState.isLoading) {
            this._fetchAndRenderHistory();
        }
    }

    _applyHistoryFilters() {
        const parsedFilters = this._readHistoryFilters();
        if (parsedFilters.error) {
            this._setHistoryError(parsedFilters.error);
            this.historyState.items = [];
            this._renderHistoryTable();
            return;
        }

        this.historyState.filters = {
            sessionId: parsedFilters.sessionId,
            startDate: parsedFilters.startDate,
            endDate: parsedFilters.endDate,
        };
        this.historyState.pagination.page = 1;
        this.historyState.pagination.next = null;
        this.historyState.pagination.previous = null;
        this.historyState.hasFetched = false;
        this._setHistoryError(null);
        this._fetchAndRenderHistory();
    }

    _resetHistoryFilters() {
        const { sessionSelect, startDateInput, endDateInput } = this.historyElements.filters || {};
        if (sessionSelect) sessionSelect.value = '';
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';

        this.historyState.filters = { sessionId: '', startDate: '', endDate: '' };
        this.historyState.pagination.page = 1;
        this.historyState.pagination.next = null;
        this.historyState.pagination.previous = null;
        this.historyState.hasFetched = false;
        this._setHistoryError(null);
        this._fetchAndRenderHistory();
    }

    _readHistoryFilters() {
        const { sessionSelect, startDateInput, endDateInput } = this.historyElements.filters || {};
        const sessionId = sessionSelect?.value?.trim() || '';
        const startDate = startDateInput?.value?.trim() || '';
        const endDate = endDateInput?.value?.trim() || '';

        if (startDate && endDate && endDate < startDate) {
            return { error: 'A data final deve ser igual ou posterior à data inicial.' };
        }

        return {
            sessionId,
            startDate,
            endDate,
        };
    }

    async _fetchAndRenderHistory(pageUrl = null) {
        if (!this.actionOrchestrator) {
            return;
        }

        this.historyState.isLoading = true;
        this._setHistoryLoading(true);
        this._setHistoryError(null);

        try {
            const params = {
                sessionId: this.historyState.filters.sessionId || undefined,
                startDate: this.historyState.filters.startDate || undefined,
                endDate: this.historyState.filters.endDate || undefined,
                page: this.historyState.pagination.page,
                pageSize: this.historyState.pagination.pageSize,
            };

            const response = await this.actionOrchestrator.fetchUserQuestionHistory(params, pageUrl);

            if (!response || response.status !== 'success') {
                throw new Error(response?.message || 'Erro ao carregar histórico.');
            }

            this.historyState.items = response.results || [];
            this.historyState.pagination.count = response.count ?? this.historyState.items.length;
            this.historyState.pagination.next = response.next;
            this.historyState.pagination.previous = response.previous;

            if (pageUrl) {
                const derivedPage = this._getPageNumberFromUrl(pageUrl);
                if (derivedPage) {
                    this.historyState.pagination.page = derivedPage;
                }
            } else {
                this.historyState.pagination.page = params.page || 1;
            }

            this.historyState.hasFetched = true;
            this._renderHistoryTable();
        } catch (error) {
            console.error('AccountPageManager: erro ao carregar histórico de questões.', error);
            this.historyState.items = [];
            this.historyState.hasFetched = false;
            this._setHistoryError('Não foi possível carregar seu histórico no momento. Tente novamente mais tarde.');
            this._renderHistoryTable();
        } finally {
            this.historyState.isLoading = false;
            this._setHistoryLoading(false);
        }
    }

    _setHistoryLoading(isLoading) {
        const { loadingMessage, tableWrapper, pagination, emptyState, errorState } = this.historyElements;
        if (isLoading) {
            if (loadingMessage) this.quizUI.showElement(loadingMessage);
            if (tableWrapper) this.quizUI.hideElement(tableWrapper);
            if (pagination?.container) this.quizUI.hideElement(pagination.container);
            if (emptyState) this.quizUI.hideElement(emptyState);
            if (errorState) this.quizUI.hideElement(errorState);
        } else if (loadingMessage) {
            this.quizUI.hideElement(loadingMessage);
        }
    }

    _setHistoryError(message) {
        this.historyState.error = message;
        const { errorState } = this.historyElements;
        if (!errorState) return;

        if (message) {
            errorState.textContent = message;
            this.quizUI.showElement(errorState);
        } else {
            errorState.textContent = '';
            this.quizUI.hideElement(errorState);
        }
    }

    _renderHistoryTable() {
        const { tableWrapper, tableBody, emptyState, pagination, errorState } = this.historyElements;
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (this.historyState.error) {
            if (emptyState) this.quizUI.hideElement(emptyState);
            if (tableWrapper) this.quizUI.hideElement(tableWrapper);
            if (pagination?.container) this.quizUI.hideElement(pagination.container);
            return;
        }

        if (errorState) {
            this.quizUI.hideElement(errorState);
            errorState.textContent = '';
        }

        if (!this.historyState.items.length) {
            if (tableWrapper) this.quizUI.hideElement(tableWrapper);
            if (emptyState) {
                emptyState.textContent = 'Nenhuma resposta encontrada para os filtros selecionados.';
                this.quizUI.showElement(emptyState);
            }
            if (pagination?.container) this.quizUI.hideElement(pagination.container);
            return;
        }

        if (emptyState) {
            this.quizUI.hideElement(emptyState);
        }

        const fragment = document.createDocumentFragment();
        this.historyState.items.forEach((item) => {
            fragment.appendChild(this._createHistoryRow(item));
        });
        tableBody.appendChild(fragment);

        if (tableWrapper) {
            this.quizUI.showElement(tableWrapper);
        }

        this._renderHistoryPagination();
    }

    _renderHistoryPagination() {
        const { pagination } = this.historyElements;
        if (!pagination?.container) return;

        const totalResults = this.historyState.pagination.count || 0;
        if (totalResults === 0) {
            this.quizUI.hideElement(pagination.container);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(totalResults / this.historyState.pagination.pageSize));
        if (pagination.pageIndicator) {
            pagination.pageIndicator.textContent = `Página ${this.historyState.pagination.page} de ${totalPages} (${totalResults} itens)`;
        }

        if (pagination.prevButton) {
            pagination.prevButton.disabled = !this.historyState.pagination.previous;
        }
        if (pagination.nextButton) {
            pagination.nextButton.disabled = !this.historyState.pagination.next;
        }

        this.quizUI.showElement(pagination.container);
    }

    _createHistoryRow(item) {
        const row = document.createElement('tr');

        const dateCell = document.createElement('td');
        dateCell.dataset.label = 'Respondida em:';
        dateCell.textContent = this._formatDateTime(item?.data_resposta);
        row.appendChild(dateCell);

        const sessionCell = document.createElement('td');
        sessionCell.dataset.label = 'Sessão:';
        sessionCell.textContent = this._formatSessionLabel(item?.session);
        row.appendChild(sessionCell);

        const questionCell = document.createElement('td');
        questionCell.dataset.label = 'Pergunta:';
        questionCell.appendChild(this._buildQuestionCellContent(item));
        row.appendChild(questionCell);

        const answerCell = document.createElement('td');
        answerCell.dataset.label = 'Sua Resposta:';
        answerCell.appendChild(this._buildAnswerCellContent(item));
        row.appendChild(answerCell);

        const explanationCell = document.createElement('td');
        explanationCell.dataset.label = 'Explicação:';
        explanationCell.appendChild(this._buildExplanationCellContent(item));
        row.appendChild(explanationCell);

        return row;
    }

    _buildQuestionCellContent(item) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('quiz-history__question');

        const questionText = document.createElement('p');
        questionText.classList.add('quiz-history__question-text');
        questionText.textContent = item?.question?.texto_pergunta || '—';
        wrapper.appendChild(questionText);

        if (item?.question?.categorias?.length) {
            const categories = document.createElement('p');
            categories.classList.add('quiz-history__question-meta');
            categories.textContent = item.question.categorias.map(cat => cat.nome_categoria).join(', ');
            wrapper.appendChild(categories);
        }

        if (item?.question?.nivel_dificuldade) {
            const difficulty = document.createElement('span');
            difficulty.classList.add('quiz-history__question-tag');
            difficulty.textContent = item.question.nivel_dificuldade;
            wrapper.appendChild(difficulty);
        }

        return wrapper;
    }

    _buildAnswerCellContent(item) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('quiz-history__answer');

        const resultBadge = document.createElement('span');
        resultBadge.classList.add('quiz-history__result-badge');

        if (!item?.foi_respondida) {
            resultBadge.textContent = 'Não respondida';
            resultBadge.classList.add('quiz-history__result-badge--skipped');
        } else if (item?.foi_correta) {
            resultBadge.textContent = 'Correta';
            resultBadge.classList.add('quiz-history__result-badge--correct');
        } else {
            resultBadge.textContent = 'Incorreta';
            resultBadge.classList.add('quiz-history__result-badge--incorrect');
        }

        wrapper.appendChild(resultBadge);

        const answerText = document.createElement('p');
        answerText.classList.add('quiz-history__answer-text');
        if (item?.selected_option?.texto_opcao) {
            answerText.textContent = item.selected_option.texto_opcao;
        } else if (!item?.foi_respondida) {
            answerText.textContent = 'Questão pulada ou não respondida.';
        } else {
            answerText.textContent = 'Resposta registrada indisponível.';
        }
        wrapper.appendChild(answerText);

        if (Array.isArray(item?.correct_option_ids) && item.correct_option_ids.length > 0) {
            const correctOptions = (item?.question?.opcoes || []).filter(opcao => item.correct_option_ids.includes(opcao.id_opcao_resposta));
            if (correctOptions.length > 0) {
                const correctAnswer = document.createElement('p');
                correctAnswer.classList.add('quiz-history__correct-answer');
                correctAnswer.textContent = `Resposta correta: ${correctOptions.map(opcao => opcao.texto_opcao).join(', ')}`;
                wrapper.appendChild(correctAnswer);
            }
        }

        return wrapper;
    }

    _buildExplanationCellContent(item) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('quiz-history__explanation');

        const explanationText = item?.question?.explicacao_resposta || item?.selected_option?.feedback_opcao;
        if (explanationText) {
            const paragraph = document.createElement('p');
            paragraph.textContent = explanationText;
            wrapper.appendChild(paragraph);
        } else {
            const placeholder = document.createElement('span');
            placeholder.classList.add('quiz-history__explanation-empty');
            placeholder.textContent = 'Nenhuma explicação cadastrada para esta questão.';
            wrapper.appendChild(placeholder);
        }

        if (item?.question?.referencia_bibliografica) {
            const reference = document.createElement('p');
            reference.classList.add('quiz-history__reference');
            reference.textContent = `Referência: ${item.question.referencia_bibliografica}`;
            wrapper.appendChild(reference);
        }

        return wrapper;
    }

    _formatDateTime(isoString) {
        if (!isoString) return '—';
        try {
            const date = new Date(isoString);
            if (Number.isNaN(date.getTime())) {
                return '—';
            }
            return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        } catch (error) {
            console.warn('AccountPageManager: falha ao formatar data.', error);
            return isoString;
        }
    }

    _formatSessionLabel(session) {
        if (!session) return '—';
        const parts = [];
        if (session.modo_quiz) {
            parts.push(session.modo_quiz);
        }
        if (session.quiz_definicao?.nome_quiz) {
            parts.push(session.quiz_definicao.nome_quiz);
        }
        const baseLabel = parts.join(' • ') || (session.id_sessao ? `Sessão ${session.id_sessao}` : 'Sessão');
        const dateLabel = session.data_inicio ? this._formatDateTime(session.data_inicio) : null;
        return dateLabel ? `${baseLabel} (${dateLabel})` : baseLabel;
    }

    _goToHistoryPage(direction) {
        const { next, previous, page } = this.historyState.pagination;
        if (direction === 'next' && next) {
            const nextPage = this._getPageNumberFromUrl(next) || (page + 1);
            this.historyState.pagination.page = nextPage;
            this._fetchAndRenderHistory(next);
        } else if (direction === 'previous' && previous) {
            const previousPage = this._getPageNumberFromUrl(previous) || Math.max(1, page - 1);
            this.historyState.pagination.page = previousPage;
            this._fetchAndRenderHistory(previous);
        }
    }

    _getPageNumberFromUrl(url) {
        if (!url) return null;
        try {
            const parsed = new URL(url, window.location.origin);
            const pageParam = parsed.searchParams.get('page');
            if (pageParam) {
                const parsedPage = Number.parseInt(pageParam, 10);
                return Number.isNaN(parsedPage) ? null : parsedPage;
            }
        } catch (error) {
            console.warn('AccountPageManager: não foi possível interpretar o número da página.', error);
        }
        return null;
    }

    _setInitialTabFromURL() {
        const hash = window.location.hash;
        const activeTabOnError = this.bodyElement.dataset.activeTabOnError;
        let initialTabId = this.defaultMenuTargetId;

        if (activeTabOnError) {
            initialTabId = activeTabOnError;
        } else if (hash) {
            const linkByHash = this.elements.sidebarLinks.find(link => link.getAttribute('href') === hash);
            if (linkByHash) {
                initialTabId = linkByHash.dataset.target;
            }
        }
        
        this.store.dispatch(quizActions.setAccountPageTab(initialTabId));

        const showDeleteModalOnError = this.bodyElement.dataset.showDeleteModalOnError === 'true';
        if (activeTabOnError && showDeleteModalOnError && activeTabOnError === 'security-content') {
            setTimeout(() => {
                if (this.quizUI.modalManager) {
                    this.quizUI.modalManager.toggleDeleteAccountModal(true);
                }
            }, 150);
        }
    }

    setActiveTab(targetId) {
        if (!this.elements.sidebarLinks || !this.elements.contentSections) return;
        
        const linkToActivate = this.elements.sidebarLinks.find(link => link.dataset.target === targetId);

        this.elements.sidebarLinks.forEach(link => {
            link.classList.toggle('is-active', link === linkToActivate);
            link.setAttribute('aria-current', link === linkToActivate ? 'page' : 'false');
        });

        this.elements.contentSections.forEach(section => {
            const isVisible = section.id === targetId;
            section.classList.toggle('is-visible', isVisible);
            section.setAttribute('aria-hidden', String(!isVisible));
            if (isVisible) {
                const title = section.querySelector('.card__title');
                title?.focus({ preventScroll: true });
            }
        });
    }

    _isMobileView() { 
        return window.innerWidth <= 768; 
    }

    // --- INÍCIO DA CORREÇÃO ---
    // O método _adjustBodyPaddingForBottomNav foi completamente removido,
    // pois a lógica de espaçamento agora será tratada puramente por CSS.
    // --- FIM DA CORREÇÃO ---

    _updateUIVisibility(isContentActive) {
        const isMobile = this._isMobileView();
        if (isMobile) {
            this.quizUI.showElement(isContentActive ? this.elements.backToMenuButton : this.elements.sidebar);
            this.quizUI.hideElement(isContentActive ? this.elements.sidebar : this.elements.backToMenuButton);
            this.quizUI.showElement(isContentActive ? this.elements.contentArea : null);
            this.quizUI.hideElement(isContentActive ? null : this.elements.contentArea);
        } else { // Desktop
            [this.elements.sidebar, this.elements.contentArea].forEach(el => this.quizUI.showElement(el));
            this.quizUI.hideElement(this.elements.backToMenuButton);
        }
        // A chamada ao _adjustBodyPaddingForBottomNav também foi removida daqui.
    }

    _handleResize() {
        if (!this.hasInitialized) return;
        const isContentVisible = this.elements.contentArea && !this.elements.contentArea.classList.contains('u-is-hidden');
        this._updateUIVisibility(this._isMobileView() ? isContentVisible : true);
    }
    
    _scrollToContentTop() {
        if (this.elements.contentArea?.classList.contains('is-visible') && this.elements.contentArea.scrollHeight > this.elements.contentArea.clientHeight) {
            this.elements.contentArea.scrollTop = 0;
        } 
        else if (this.elements.sidebar && !this.elements.sidebar.classList.contains('u-is-hidden') && this.elements.sidebar.scrollHeight > this.elements.sidebar.clientHeight && this._isMobileView()) {
            this.elements.sidebar.scrollTop = 0;
        }
    }
}