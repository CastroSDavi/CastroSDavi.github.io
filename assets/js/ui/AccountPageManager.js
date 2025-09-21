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
        this.preferencesElements = {
            section: document.getElementById('preferences-content'),
            summaryCards: [],
            themeOptionLabels: [],
            summaryValueMap: {},
            summaryHintMap: {},
            summaryCardMap: {},
            initialState: {
                theme: '',
                toggles: {},
            },
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
        this.securityCopyFeedbackTimeout = null;
        this.preferencesInteractionsInitialized = false;
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

        this._setupPreferencesInteractions();

        this.elements.accountSectionPage?.addEventListener('click', (event) => {
            const securityActionTrigger = event.target.closest('[data-security-action]');
            if (securityActionTrigger) {
                event.preventDefault();
                this._handleSecurityAction(securityActionTrigger);
                return;
            }

            const trigger = event.target.closest('[data-open-account-tab]');
            if (!trigger) {
                return;
            }

            const targetId = trigger.dataset.openAccountTab;
            if (!targetId) {
                return;
            }

            event.preventDefault();

            if (this.store) {
                this.store.dispatch(quizActions.setAccountPageTab(targetId));
            }

            if (this._isMobileView()) {
                this._updateUIVisibility(true);
            }
        });
    }

    _setupPreferencesInteractions() {
        if (this.preferencesInteractionsInitialized) {
            return;
        }

        const { section } = this.preferencesElements;
        if (!section) {
            return;
        }

        const themeOptionLabels = Array.from(section.querySelectorAll('.preferences-theme-option'));
        const summaryCards = Array.from(section.querySelectorAll('[data-preferences-summary-item]'));
        const summaryValueNodes = Array.from(section.querySelectorAll('[data-preferences-summary-value]'));
        const summaryHintNodes = Array.from(section.querySelectorAll('[data-preferences-summary-hint]'));
        const toggleWrappers = Array.from(section.querySelectorAll('.preferences-toggle'));

        const summaryValueMap = {};
        summaryValueNodes.forEach((node) => {
            const key = node.dataset.preferencesSummaryValue;
            if (!key) {
                return;
            }

            summaryValueMap[key] = node;
            if (!node.dataset.defaultValue) {
                node.dataset.defaultValue = node.textContent.trim();
            }
        });

        const summaryHintMap = {};
        summaryHintNodes.forEach((node) => {
            const key = node.dataset.preferencesSummaryHint;
            if (!key) {
                return;
            }

            summaryHintMap[key] = node;
            if (!node.dataset.defaultHint) {
                node.dataset.defaultHint = node.textContent.trim();
            }
        });

        const summaryCardMap = {};
        summaryCards.forEach((card) => {
            const key = card.dataset.preferencesSummaryKey;
            if (key) {
                summaryCardMap[key] = card;
            }
        });

        const pendingHintMessage = section.dataset.preferencesPendingHint
            || 'Lembre-se de salvar suas alterações para aplicá-las.';

        const summaryDefaults = new Map();
        Object.entries(summaryValueMap).forEach(([key, node]) => {
            const entry = summaryDefaults.get(key) || {};
            entry.value = node.textContent.trim();
            summaryDefaults.set(key, entry);
        });
        Object.entries(summaryHintMap).forEach(([key, node]) => {
            const entry = summaryDefaults.get(key) || {};
            entry.hint = node.textContent.trim();
            summaryDefaults.set(key, entry);
        });

        const themeInitialInput = section.querySelector('.preferences-theme-option__input:checked');
        const themeInitialValue = themeInitialInput?.value || '';
        const toggleInitialStates = {};

        toggleWrappers.forEach((wrapper) => {
            const summaryKey = wrapper.dataset.summaryKey;
            const input = wrapper.querySelector('.preferences-toggle__input');
            if (!summaryKey || !input) {
                return;
            }

            toggleInitialStates[summaryKey] = Boolean(input.checked);
        });

        const updateSummaryCardPendingState = (key, isPending) => {
            const card = summaryCardMap[key];
            if (card) {
                card.classList.toggle('is-pending-save', Boolean(isPending));
            }
        };

        const updateThemeSummaryCard = () => {
            const summaryValueNode = summaryValueMap.theme;
            const summaryHintNode = summaryHintMap.theme;
            const selectedInput = section.querySelector('.preferences-theme-option__input:checked');
            const selectedLabel = selectedInput?.closest('.preferences-theme-option');
            const summaryLabel = selectedLabel?.dataset.summaryLabel
                || selectedLabel?.querySelector('.preferences-theme-option__title')?.textContent?.trim()
                || summaryDefaults.get('theme')?.value
                || '';

            if (summaryValueNode && summaryLabel) {
                summaryValueNode.textContent = summaryLabel;
            }

            const isDirty = Boolean(selectedInput?.value) && selectedInput.value !== themeInitialValue;
            if (summaryHintNode) {
                if (isDirty) {
                    summaryHintNode.textContent = pendingHintMessage;
                } else {
                    const defaultHint = summaryDefaults.get('theme')?.hint;
                    if (defaultHint) {
                        summaryHintNode.textContent = defaultHint;
                    }
                }
            }

            updateSummaryCardPendingState('theme', isDirty);
        };

        const updateThemeSelectionState = () => {
            themeOptionLabels.forEach((label) => {
                const input = label.querySelector('.preferences-theme-option__input');
                label.classList.toggle('is-selected', Boolean(input?.checked));
            });

            updateThemeSummaryCard();
        };

        if (themeOptionLabels.length > 0) {
            themeOptionLabels.forEach((label) => {
                const input = label.querySelector('.preferences-theme-option__input');
                if (!input) {
                    return;
                }

                input.addEventListener('change', updateThemeSelectionState);
            });

            updateThemeSelectionState();
        } else {
            updateThemeSummaryCard();
        }

        const updateToggleSummary = (wrapper) => {
            const summaryKey = wrapper.dataset.summaryKey;
            const input = wrapper.querySelector('.preferences-toggle__input');
            if (!summaryKey || !input) {
                return;
            }

            const summaryValueNode = summaryValueMap[summaryKey];
            const summaryHintNode = summaryHintMap[summaryKey];
            const defaults = summaryDefaults.get(summaryKey) || {};

            const onLabel = wrapper.dataset.summaryOnLabel
                || summaryValueNode?.dataset.valueOn
                || defaults.value
                || '';
            const offLabel = wrapper.dataset.summaryOffLabel
                || summaryValueNode?.dataset.valueOff
                || defaults.value
                || '';
            const onHint = wrapper.dataset.summaryOnHint
                || summaryHintNode?.dataset.hintOn
                || defaults.hint
                || '';
            const offHint = wrapper.dataset.summaryOffHint
                || summaryHintNode?.dataset.hintOff
                || defaults.hint
                || '';

            const isChecked = Boolean(input.checked);
            const initialState = Object.prototype.hasOwnProperty.call(toggleInitialStates, summaryKey)
                ? toggleInitialStates[summaryKey]
                : isChecked;
            const isDirty = initialState !== isChecked;

            if (summaryValueNode) {
                summaryValueNode.textContent = isChecked ? onLabel : offLabel;
            }

            if (summaryHintNode) {
                summaryHintNode.textContent = isDirty
                    ? pendingHintMessage
                    : (isChecked ? onHint : offHint);
            }

            updateSummaryCardPendingState(summaryKey, isDirty);
        };

        if (summaryCards.length > 0) {
            summaryCards.forEach((card) => {
                if (!card.hasAttribute('tabindex')) {
                    card.setAttribute('tabindex', '0');
                }

                if (!card.hasAttribute('role')) {
                    card.setAttribute('role', 'button');
                }

                card.addEventListener('click', () => {
                    this._scrollToPreferencesForm();
                });

                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this._scrollToPreferencesForm();
                    }
                });
            });
        }

        toggleWrappers.forEach((wrapper) => {
            const input = wrapper.querySelector('.preferences-toggle__input');
            if (!input) {
                return;
            }

            input.addEventListener('change', () => updateToggleSummary(wrapper));
            updateToggleSummary(wrapper);
        });

        this.preferencesElements = {
            section,
            summaryCards,
            themeOptionLabels,
            summaryValueMap,
            summaryHintMap,
            summaryCardMap,
            initialState: {
                theme: themeInitialValue,
                toggles: toggleInitialStates,
            },
        };

        this.preferencesInteractionsInitialized = true;
    }

    _scrollToPreferencesForm() {
        const form = this.preferencesElements.section?.querySelector('.preferences-form');
        if (!form) {
            return;
        }

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const focusableSelector = 'input:not([type="hidden"]), select, textarea, button';
        const focusTarget = form.querySelector(focusableSelector);
        if (!focusTarget) {
            return;
        }

        const focusElement = () => {
            focusTarget.focus({ preventScroll: true });
        };

        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(focusElement);
        } else {
            focusElement();
        }
    }

    _handleSecurityAction(trigger) {
        if (!trigger) {
            return;
        }

        const action = trigger.dataset.securityAction;
        if (!action) {
            return;
        }

        switch (action) {
            case 'copy-summary':
                this._copySecuritySummary();
                break;
            default:
                break;
        }
    }

    async _copySecuritySummary() {
        const securitySection = document.getElementById('security-content');
        if (!securitySection) {
            return;
        }

        const summaryNodes = Array.from(securitySection.querySelectorAll('[data-security-summary-item]'));
        if (summaryNodes.length === 0) {
            this._showSecurityCopyFeedback('Não há dados disponíveis para copiar.', true);
            return;
        }

        const lines = summaryNodes.map((node) => {
            const label = (node.dataset.label || '').trim();
            let value = node.dataset.summaryValue || '';

            if (typeof value === 'string') {
                value = value.trim();
            }

            if (!value) {
                const valueElement = node.querySelector('.security-summary-card__value') || node.querySelector('dd') || node.querySelector('.security-summary-card__hint');
                value = valueElement ? valueElement.textContent.trim() : '';
            }

            if (value) {
                value = value.replace(/\s+/g, ' ');
            }

            if (label && value) {
                return `${label}: ${value}`;
            }

            if (label) {
                return label;
            }

            return value;
        }).filter(Boolean);

        if (!lines.length) {
            this._showSecurityCopyFeedback('Não há dados disponíveis para copiar.', true);
            return;
        }

        const textToCopy = lines.join('\n');

        const attemptFallbackCopy = () => {
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);

            let copied = false;
            try {
                textarea.select();
                textarea.setSelectionRange(0, textarea.value.length);
                copied = document.execCommand('copy');
            } catch (error) {
                copied = false;
                console.warn('AccountPageManager: fallback de cópia falhou.', error);
            } finally {
                document.body.removeChild(textarea);
            }

            return copied;
        };

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(textToCopy);
                this._showSecurityCopyFeedback('Resumo copiado para a área de transferência.');
                return;
            }
        } catch (error) {
            console.warn('AccountPageManager: falha ao copiar com Clipboard API.', error);
        }

        const fallbackSucceeded = attemptFallbackCopy();
        if (fallbackSucceeded) {
            this._showSecurityCopyFeedback('Resumo copiado para a área de transferência.');
        } else {
            this._showSecurityCopyFeedback('Não foi possível copiar o resumo.', true);
        }
    }

    _showSecurityCopyFeedback(message, isError = false) {
        const feedbackElement = document.getElementById('security-copy-feedback');
        if (!feedbackElement) {
            return;
        }

        if (this.securityCopyFeedbackTimeout) {
            clearTimeout(this.securityCopyFeedbackTimeout);
            this.securityCopyFeedbackTimeout = null;
        }

        feedbackElement.textContent = message;
        feedbackElement.classList.toggle('is-error', Boolean(isError));
        feedbackElement.classList.add('is-visible');

        this.securityCopyFeedbackTimeout = setTimeout(() => {
            feedbackElement.classList.remove('is-visible');
            feedbackElement.classList.remove('is-error');
            feedbackElement.textContent = '';
            this.securityCopyFeedbackTimeout = null;
        }, 4000);
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
            this._setMessageContent(errorState, message, '[data-role="error-message"]');
            this.quizUI.showElement(errorState);
        } else {
            this._setMessageContent(errorState, '', '[data-role="error-message"]');
            this.quizUI.hideElement(errorState);
        }
    }

    _setMessageContent(container, message, selector) {
        if (!container) return;
        const target = selector ? container.querySelector(selector) : null;
        if (target) {
            target.textContent = message || '';
        } else {
            container.textContent = message || '';
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
            this._setMessageContent(errorState, '', '[data-role="error-message"]');
            this.quizUI.hideElement(errorState);
        }

        if (!this.historyState.items.length) {
            if (tableWrapper) this.quizUI.hideElement(tableWrapper);
            if (emptyState) {
                this._setMessageContent(emptyState, 'Nenhuma resposta encontrada para os filtros selecionados.', '[data-role="empty-message"]');
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
        const card = document.createElement('article');
        card.classList.add('quiz-history-card');
        card.setAttribute('role', 'listitem');

        const header = document.createElement('header');
        header.classList.add('quiz-history-card__header');

        const metaGroup = document.createElement('div');
        metaGroup.classList.add('quiz-history-card__meta-group');
        const dateMeta = this._buildMetaItem('schedule', 'Respondida em', this._formatDateTime(item?.data_resposta));
        const sessionMeta = this._buildMetaItem('play_circle', 'Sessão', this._formatSessionLabel(item?.session));
        if (dateMeta) metaGroup.appendChild(dateMeta);
        if (sessionMeta) metaGroup.appendChild(sessionMeta);
        header.appendChild(metaGroup);

        card.appendChild(header);
        card.appendChild(this._buildQuestionCellContent(item));
        card.appendChild(this._buildAnswerCellContent(item));
        card.appendChild(this._buildExplanationCellContent(item));

        return card;
    }

    _buildQuestionCellContent(item) {
        const section = document.createElement('section');
        section.classList.add('quiz-history-card__section', 'quiz-history-card__question');
        section.appendChild(this._createSectionHeader('Pergunta', 'quiz'));

        const questionText = document.createElement('p');
        questionText.classList.add('quiz-history__question-text', 'quiz-history-card__question-title');
        questionText.textContent = item?.question?.texto_pergunta || '—';
        section.appendChild(questionText);

        if (item?.question?.categorias?.length) {
            const categories = document.createElement('p');
            categories.classList.add('quiz-history__question-meta', 'quiz-history-card__question-meta');
            categories.textContent = item.question.categorias.map(cat => cat.nome_categoria).join(', ');
            section.appendChild(categories);
        }

        if (item?.question?.nivel_dificuldade) {
            const difficulty = document.createElement('span');
            difficulty.classList.add('quiz-history__question-tag', 'quiz-history-card__question-tag');
            difficulty.textContent = item.question.nivel_dificuldade;
            section.appendChild(difficulty);
        }

        return section;
    }

    _buildAnswerCellContent(item) {
        const section = document.createElement('section');
        section.classList.add('quiz-history-card__section', 'quiz-history-card__answer');

        const resultBadge = this._buildResultBadge(item);
        resultBadge.classList.add('quiz-history-card__status');
        section.appendChild(this._createSectionHeader('Sua resposta', 'task_alt', resultBadge));

        const answerText = document.createElement('p');
        answerText.classList.add('quiz-history__answer-text');
        if (item?.selected_option?.texto_opcao) {
            answerText.textContent = item.selected_option.texto_opcao;
        } else if (!item?.foi_respondida) {
            answerText.textContent = 'Questão pulada ou não respondida.';
        } else {
            answerText.textContent = 'Resposta registrada indisponível.';
        }
        section.appendChild(answerText);

        if (Array.isArray(item?.correct_option_ids) && item.correct_option_ids.length > 0) {
            const correctOptions = (item?.question?.opcoes || []).filter(opcao => item.correct_option_ids.includes(opcao.id_opcao_resposta));
            if (correctOptions.length > 0) {
                const correctAnswer = document.createElement('p');
                correctAnswer.classList.add('quiz-history__correct-answer');
                correctAnswer.textContent = `Resposta correta: ${correctOptions.map(opcao => opcao.texto_opcao).join(', ')}`;
                section.appendChild(correctAnswer);
            }
        }

        return section;
    }

    _buildExplanationCellContent(item) {
        const section = document.createElement('section');
        section.classList.add('quiz-history-card__section', 'quiz-history-card__explanation');
        section.appendChild(this._createSectionHeader('Explicação e referências', 'menu_book'));

        const explanationText = item?.question?.explicacao_resposta || item?.selected_option?.feedback_opcao;
        if (explanationText) {
            const paragraph = document.createElement('p');
            paragraph.textContent = explanationText;
            section.appendChild(paragraph);
        } else {
            const placeholder = document.createElement('span');
            placeholder.classList.add('quiz-history__explanation-empty');
            placeholder.textContent = 'Nenhuma explicação cadastrada para esta questão.';
            section.appendChild(placeholder);
        }

        if (item?.question?.referencia_bibliografica) {
            const reference = document.createElement('p');
            reference.classList.add('quiz-history__reference');
            reference.textContent = `Referência: ${item.question.referencia_bibliografica}`;
            section.appendChild(reference);
        }

        return section;
    }

    _buildResultBadge(item) {
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

        return resultBadge;
    }

    _createSectionHeader(label, iconName, trailingElement = null) {
        const header = document.createElement('div');
        header.classList.add('quiz-history-card__section-header');

        if (iconName) {
            const icon = document.createElement('span');
            icon.classList.add('material-symbols-outlined', 'quiz-history-card__section-icon');
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = iconName;
            header.appendChild(icon);
        }

        const title = document.createElement('span');
        title.classList.add('quiz-history-card__section-title');
        title.textContent = label;
        header.appendChild(title);

        if (trailingElement) {
            header.appendChild(trailingElement);
        }

        return header;
    }

    _buildMetaItem(iconName, label, value) {
        const meta = document.createElement('div');
        meta.classList.add('quiz-history-card__meta-item');

        const icon = document.createElement('span');
        icon.classList.add('material-symbols-outlined', 'quiz-history-card__meta-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = iconName;
        meta.appendChild(icon);

        const content = document.createElement('div');
        content.classList.add('quiz-history-card__meta-content');

        const labelElement = document.createElement('span');
        labelElement.classList.add('quiz-history-card__meta-label');
        labelElement.textContent = label;
        content.appendChild(labelElement);

        const valueElement = document.createElement('span');
        valueElement.classList.add('quiz-history-card__meta-value');
        let safeValue = value;
        if (typeof safeValue === 'string') {
            safeValue = safeValue.trim();
        }
        if (!safeValue) {
            safeValue = '—';
        }
        valueElement.textContent = safeValue;
        content.appendChild(valueElement);

        meta.appendChild(content);
        return meta;
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