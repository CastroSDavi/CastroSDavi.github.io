// File: assets/js/ui/FilterPanel.js

import { debounce } from '../utils/helpers.js';
import { quizActions } from '../app/flux/actions.js';

export default class FilterPanel {
    constructor(filterPanelElement, quizUIInstance) {
        if (!filterPanelElement) {
            return;
        }
        this.panelElement = filterPanelElement;
        this.quizUI = quizUIInstance;
        
        this.actionOrchestrator = null;
        this.store = null;

        this.previousFilterPanelState = {};

        this.allCategories = [];
        this.categoryIdSet = new Set();
        this.persistedCategorySelection = new Set();
        this.searchQuery = '';

        this.storageKey = 'medquiz.filterPanelState';
        this.savedCollectionsStorageKey = 'medquiz.filterPanelCollections';
        this.hasInitialized = false;
        this.hasGeneratedTree = false;
        this.cachedCategoriesSignature = null;
        this.lastPersistedFilters = null;
        this.predefinedListSignature = null;
        this.savedCollections = [];
        this.maxSavedCollections = 12;

        this.debouncedTriggerCountFetch = debounce(this._triggerCountFetch.bind(this), 400);

        this._cacheOwnElements();
        this.savedCollections = this._loadSavedCollections();
        this._renderSavedCollections();
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }
    
    setStore(storeInstance) {
        this.store = storeInstance;
        if (this.store) {
            this.previousFilterPanelState = this.store.getState().ui.filterPanel;
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }

    _cacheOwnElements() {
        this.elements = {
            categoryTreeList: this.panelElement.querySelector('#category-tree-list'),
            categorySearchWrapper: this.panelElement.querySelector('.filter-search'),
            categorySearchInput: this.panelElement.querySelector('#category-search-input'),
            categorySearchClearBtn: this.panelElement.querySelector('#category-search-clear'),
            btnCatSelectAll: this.panelElement.querySelector('#btn-cat-select-all'),
            btnCatClearAll: this.panelElement.querySelector('#btn-cat-clear-all'),
            filterGroupDifficulty: this.panelElement.querySelector('#filter-group-difficulty'),
            numQuestionsInput: this.panelElement.querySelector('#num-questions-input'),
            btnNumDecrement: this.panelElement.querySelector('.numeric-stepper__button--decrement'),
            btnNumIncrement: this.panelElement.querySelector('.numeric-stepper__button--increment'),
            numQuestionsFeedbackText: this.panelElement.querySelector('#num-questions-feedback'),
            btnLimparFiltrosPainel: this.panelElement.querySelector('#btn-limpar-filtros-painel'),
            btnAplicarFiltrosPainel: this.panelElement.querySelector('#btn-aplicar-filtros-painel'),
            predefinedList: this.panelElement.querySelector('#filter-predefined-list'),
            predefinedEmptyState: this.panelElement.querySelector('#filter-predefined-empty'),
            savedCollectionsList: this.panelElement.querySelector('#saved-collections-list'),
            savedCollectionsEmptyState: this.panelElement.querySelector('#saved-collections-empty'),
            savedCollectionNameInput: this.panelElement.querySelector('#saved-collection-name'),
            btnSaveCollection: this.panelElement.querySelector('#btn-save-filter-collection'),
        };
        this._updateSearchVisualState();
    }

    setupEventListeners() {
        this.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => {
            this.actionOrchestrator?.applyFiltersAndStartQuiz();
        });

        this.elements.btnLimparFiltrosPainel?.addEventListener('click', () => this.resetFiltersToDefault());
        this.elements.btnCatSelectAll?.addEventListener('click', () => this._handleSelectAllCategories());
        this.elements.btnCatClearAll?.addEventListener('click', () => this._handleClearAllCategories());

        this.elements.categorySearchInput?.addEventListener('input', (event) => {
            const { target } = event || {};
            const value = typeof target?.value === 'string' ? target.value : '';
            this._handleCategorySearchInput(value);
        });

        this.elements.categorySearchInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.getSearchQuery()) {
                event.preventDefault();
                event.stopPropagation();
                this._clearCategorySearch();
            }
        });

        const focusWrapperEvents = [];
        if (typeof window !== 'undefined' && window.PointerEvent) {
            focusWrapperEvents.push('pointerdown');
        } else {
            focusWrapperEvents.push('mousedown', 'touchstart');
        }
        const handleWrapperInteraction = this._handleSearchWrapperPointerDown.bind(this);
        focusWrapperEvents.forEach(eventName => {
            this.elements.categorySearchWrapper?.addEventListener(eventName, handleWrapperInteraction);
        });

        this.elements.categorySearchClearBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            this._clearCategorySearch();
        });

        this.elements.categoryTreeList?.addEventListener('change', (event) => {
            if (event.target.matches('.category-tree__input')) {
                this._handleCategoryCheckboxChange(event.target);
            }
        });

        this.elements.filterGroupDifficulty?.addEventListener('change', (event) => {
            if (event.target.matches('input[name="difficulty"]')) {
                this._handleDifficultyChange(event.target);
            }
        });
        
        this.elements.numQuestionsInput?.addEventListener('input', (e) => this._validateAndProcessNumQuestionsInput(e.target));
        this.elements.btnNumDecrement?.addEventListener('click', () => this._handleStepper(-1));
        this.elements.btnNumIncrement?.addEventListener('click', () => this._handleStepper(1));

        this.elements.predefinedList?.addEventListener('click', (event) => this._handlePredefinedListInteraction(event));

        this.elements.btnSaveCollection?.addEventListener('click', (event) => {
            event.preventDefault();
            this._handleSaveCurrentFilters();
        });

        this.elements.savedCollectionNameInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this._handleSaveCurrentFilters();
            }
        });

        this.elements.savedCollectionNameInput?.addEventListener('input', () => {
            this._clearSavedCollectionInputError();
        });

        this.elements.savedCollectionsList?.addEventListener('click', (event) => {
            this._handleSavedCollectionsClick(event);
        });
    }
    
    _handleDifficultyChange(clickedInput) {
        const allCheckbox = this.elements.filterGroupDifficulty.querySelector('input[value="all"]');
        const specificCheckboxes = Array.from(this.elements.filterGroupDifficulty.querySelectorAll('input:not([value="all"])'));

        if (clickedInput === allCheckbox) {
            if (allCheckbox.checked) {
                specificCheckboxes.forEach(cb => cb.checked = false);
            }
        } else {
            if (clickedInput.checked) {
                allCheckbox.checked = false;
            }
        }

        const anySpecificChecked = specificCheckboxes.some(cb => cb.checked);
        if (!anySpecificChecked && allCheckbox) {
            allCheckbox.checked = true;
        }

        this._persistFilters();
        this.debouncedTriggerCountFetch();
    }

    _handleCategorySearchInput(rawValue) {
        const value = typeof rawValue === 'string' ? rawValue : '';
        if (this.searchQuery === value) {
            return;
        }
        this.setSearchQuery(value);
        this.generateCategoryTree(this.allCategories || []);
        this._persistFilters();
        this.debouncedTriggerCountFetch();
    }

    _clearCategorySearch({ focusInput = true } = {}) {
        const hadQuery = !!this.getSearchQuery();
        this.setSearchQuery('');
        if (hadQuery) {
            this.generateCategoryTree(this.allCategories || []);
            this._persistFilters();
            this.debouncedTriggerCountFetch();
        }
        if (focusInput && this.elements.categorySearchInput) {
            const inputEl = this.elements.categorySearchInput;
            try {
                inputEl.focus({ preventScroll: true });
            } catch (_focusError) {
                inputEl.focus();
            }
        }
    }

    _updateSearchVisualState() {
        const hasValue = !!this.getSearchQuery();
        const wrapper = this.elements?.categorySearchWrapper;
        if (wrapper) {
            wrapper.classList.toggle('has-value', hasValue);
        }

        const clearBtn = this.elements?.categorySearchClearBtn;
        if (clearBtn) {
            if (hasValue) {
                clearBtn.removeAttribute('tabindex');
                clearBtn.setAttribute('aria-hidden', 'false');
            } else {
                clearBtn.setAttribute('tabindex', '-1');
                clearBtn.setAttribute('aria-hidden', 'true');
            }
        }
    }

    _handleSearchWrapperPointerDown(event) {
        const { categorySearchInput, categorySearchClearBtn } = this.elements || {};
        if (!categorySearchInput) {
            return;
        }
        if (event.type === 'mousedown' && event.button !== 0) {
            return;
        }
        const clickedClear = categorySearchClearBtn?.contains(event.target);
        if (clickedClear || event.target === categorySearchInput) {
            return;
        }
        if (event.type === 'pointerdown') {
            if (event.pointerType === 'mouse' || typeof event.pointerType === 'undefined') {
                event.preventDefault();
            }
        } else if (event.type === 'mousedown') {
            event.preventDefault();
        }

        if (typeof categorySearchInput.focus === 'function') {
            try {
                categorySearchInput.focus({ preventScroll: true });
            } catch (_focusError) {
                categorySearchInput.focus();
            }
        }
    }

    render(stateOverride = null) {
        if (!this.store) return;

        const rootState = stateOverride || this.store.getState();
        const categories = Array.isArray(rootState?.geral?.allCategories)
            ? rootState.geral.allCategories
            : [];
        const predefinedQuizzes = Array.isArray(rootState?.geral?.predefinedQuizzes?.items)
            ? rootState.geral.predefinedQuizzes.items
            : [];

        this._renderPredefinedQuizzes(predefinedQuizzes);
        this._renderSavedCollections();

        let initialFilters = null;
        if (!this.hasInitialized) {
            const storedFilters = this._loadPersistedFilters();
            initialFilters = storedFilters || this._getDefaultFilters();
            this.setSearchQuery(initialFilters.searchQuery || '');
            this.persistedCategorySelection = new Set(
                (initialFilters.categoryIds || []).map(id => id.toString())
            );
        }

        const categoriesChanged = this._ensureCategoryTree(categories);

        if (!this.hasInitialized) {
            this.setCategoryTreeState(initialFilters.categoryIds);
            this.setDifficultyState(initialFilters.difficultyLevels);
            this.setNumberOfQuestionsState(initialFilters.numQuestions);
            this._persistFilters();
            this._triggerCountFetch();
            this._renderFeedback();
            this.hasInitialized = true;
            return;
        }

        if (categoriesChanged) {
            const filters = this.lastPersistedFilters || this._captureCurrentFilters();
            this.setSearchQuery(filters.searchQuery || '');
            this.setCategoryTreeState(filters.categoryIds);
        }

        this._renderFeedback();
    }

    handleStateUpdate() {
        if (!this.store) return;
        const newFilterPanelState = this.store.getState().ui.filterPanel;

        if (JSON.stringify(newFilterPanelState) !== JSON.stringify(this.previousFilterPanelState)) {
            this._renderFeedback();
            this.previousFilterPanelState = newFilterPanelState;
        }
    }

    resetFiltersToDefault({ triggerFetch = true, persistState = true } = {}) {
        const hadSearch = this.getSearchQuery().length > 0;
        this.setSearchQuery('');
        if (hadSearch) {
            this.generateCategoryTree(this.allCategories || []);
        }
        this.setCategoryTreeState([]);
        this.setDifficultyState(['all']);
        this.setNumberOfQuestionsState(null);
        if (persistState) {
            this._persistFilters();
        }
        if (triggerFetch) {
            this.debouncedTriggerCountFetch();
        }
    }

    _triggerCountFetch() {
        if (!this.actionOrchestrator) return;
        const filters = {
            category_ids: this.getSelectedCategories(),
            difficulty_levels: this.getSelectedDifficulties(),
            search_query: this.getSearchQuery()
        };
        this.actionOrchestrator.fetchFilteredQuestionCount(filters);
    }

    _getDefaultFilters() {
        return {
            categoryIds: [],
            difficultyLevels: ['all'],
            numQuestions: null,
            searchQuery: '',
        };
    }

    _sanitizeFilterObject(rawFilters = {}) {
        const categoryIds = Array.isArray(rawFilters.categoryIds)
            ? rawFilters.categoryIds
                .map(id => (id !== null && id !== undefined ? id.toString() : null))
                .filter(Boolean)
            : [];

        const difficultyLevels = Array.isArray(rawFilters.difficultyLevels)
            ? rawFilters.difficultyLevels
                .filter(level => typeof level === 'string' && level.trim() !== '')
            : [];

        const normalizedDifficulty = difficultyLevels.length > 0 ? difficultyLevels : ['all'];

        const numQuestions = typeof rawFilters.numQuestions === 'number' && rawFilters.numQuestions > 0
            ? rawFilters.numQuestions
            : null;

        const searchQuery = typeof rawFilters.searchQuery === 'string' ? rawFilters.searchQuery : '';

        return {
            categoryIds,
            difficultyLevels: normalizedDifficulty,
            numQuestions,
            searchQuery,
        };
    }

    _captureCurrentFilters() {
        return this._sanitizeFilterObject({
            categoryIds: Array.from(this.persistedCategorySelection),
            difficultyLevels: this.getSelectedDifficulties(),
            numQuestions: this.getSelectedNumberOfQuestions(),
            searchQuery: this.getSearchQuery(),
        });
    }

    _persistFilters() {
        const snapshot = this._captureCurrentFilters();
        this.lastPersistedFilters = snapshot;
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
        } catch (storageError) {
            console.warn('FilterPanel: não foi possível salvar os filtros selecionados.', storageError);
        }
    }

    _loadPersistedFilters() {
        if (this.lastPersistedFilters) {
            return this.lastPersistedFilters;
        }
        if (typeof window === 'undefined' || !window.localStorage) {
            return null;
        }
        try {
            const rawValue = window.localStorage.getItem(this.storageKey);
            if (!rawValue) {
                return null;
            }
            const parsed = JSON.parse(rawValue);
            const sanitized = this._sanitizeFilterObject(parsed);
            this.lastPersistedFilters = sanitized;
            return sanitized;
        } catch (storageError) {
            console.warn('FilterPanel: não foi possível recuperar os filtros salvos.', storageError);
            return null;
        }
    }

    _persistSavedCollections(collections = this.savedCollections) {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        try {
            const payload = JSON.stringify(
                (collections || []).map(collection => ({
                    id: collection.id,
                    name: collection.name,
                    filters: collection.filters,
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                }))
            );
            window.localStorage.setItem(this.savedCollectionsStorageKey, payload);
        } catch (storageError) {
            console.warn('FilterPanel: não foi possível salvar as coleções de filtros.', storageError);
        }
    }

    _loadSavedCollections() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return [];
        }

        try {
            const rawValue = window.localStorage.getItem(this.savedCollectionsStorageKey);
            if (!rawValue) {
                return [];
            }
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
                return [];
            }

            const sanitized = parsed
                .map(entry => this._sanitizeSavedCollectionEntry(entry))
                .filter(Boolean);

            return this._sortSavedCollections(sanitized);
        } catch (storageError) {
            console.warn('FilterPanel: não foi possível recuperar coleções salvas.', storageError);
            return [];
        }
    }

    _sanitizeSavedCollectionEntry(rawEntry) {
        if (!rawEntry || typeof rawEntry !== 'object') {
            return null;
        }

        const fallbackId = `collection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const id = typeof rawEntry.id === 'string' && rawEntry.id.trim() ? rawEntry.id.trim() : fallbackId;
        const name = typeof rawEntry.name === 'string' && rawEntry.name.trim()
            ? rawEntry.name.trim()
            : 'Coleção sem título';

        const createdAtRaw = Number.parseInt(rawEntry.createdAt, 10);
        const updatedAtRaw = Number.parseInt(rawEntry.updatedAt, 10);
        const now = Date.now();

        const filters = this._sanitizeFilterObject(rawEntry.filters || {});

        return {
            id,
            name,
            filters,
            createdAt: Number.isFinite(createdAtRaw) ? createdAtRaw : now,
            updatedAt: Number.isFinite(updatedAtRaw) ? updatedAtRaw : now,
        };
    }

    _sortSavedCollections(collections = []) {
        return [...collections].sort((a, b) => {
            const referenceA = Number.isFinite(a?.updatedAt) ? a.updatedAt : a?.createdAt ?? 0;
            const referenceB = Number.isFinite(b?.updatedAt) ? b.updatedAt : b?.createdAt ?? 0;
            return referenceB - referenceA;
        });
    }

    _areFiltersEqual(firstFilters, secondFilters) {
        const first = this._sanitizeFilterObject(firstFilters || {});
        const second = this._sanitizeFilterObject(secondFilters || {});

        const normalizeArray = (array) => [...(array || [])].map(String).sort();
        const firstCategories = normalizeArray(first.categoryIds);
        const secondCategories = normalizeArray(second.categoryIds);
        if (firstCategories.length !== secondCategories.length) {
            return false;
        }
        for (let i = 0; i < firstCategories.length; i += 1) {
            if (firstCategories[i] !== secondCategories[i]) {
                return false;
            }
        }

        const firstDifficulties = normalizeArray(first.difficultyLevels);
        const secondDifficulties = normalizeArray(second.difficultyLevels);
        if (firstDifficulties.length !== secondDifficulties.length) {
            return false;
        }
        for (let j = 0; j < firstDifficulties.length; j += 1) {
            if (firstDifficulties[j] !== secondDifficulties[j]) {
                return false;
            }
        }

        const normalizedFirstNum = Number.isFinite(first.numQuestions) ? first.numQuestions : null;
        const normalizedSecondNum = Number.isFinite(second.numQuestions) ? second.numQuestions : null;
        if (normalizedFirstNum !== normalizedSecondNum) {
            return false;
        }

        const normalizedFirstSearch = (first.searchQuery || '').trim();
        const normalizedSecondSearch = (second.searchQuery || '').trim();
        return normalizedFirstSearch === normalizedSecondSearch;
    }

    _formatDifficultyLabel(label) {
        if (typeof label !== 'string' || !label) {
            return '';
        }
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    _formatNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value.toLocaleString('pt-BR');
        }
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed.toLocaleString('pt-BR');
        }
        return '0';
    }

    _describeFilters(filters) {
        const snapshot = this._sanitizeFilterObject(filters || {});
        const categoryCount = snapshot.categoryIds?.length || 0;
        const hasSearch = snapshot.searchQuery && snapshot.searchQuery.trim().length > 0;

        const categoryLabel = categoryCount > 0
            ? `${categoryCount} ${categoryCount === 1 ? 'categoria selecionada' : 'categorias selecionadas'}`
            : 'Todas as categorias';

        const difficulties = snapshot.difficultyLevels || [];
        const hasAll = difficulties.includes('all');
        const difficultyLabel = hasAll
            ? 'Todas as dificuldades'
            : `Dificuldade: ${difficulties.map(level => this._formatDifficultyLabel(level)).join(', ')}`;

        const numQuestionsLabel = snapshot.numQuestions
            ? `${this._formatNumber(snapshot.numQuestions)} questões`
            : 'Quantidade flexível';

        const parts = [categoryLabel, difficultyLabel, numQuestionsLabel];
        if (hasSearch) {
            parts.push(`Busca: "${snapshot.searchQuery.trim()}"`);
        }

        return parts.join(' • ');
    }

    _renderSavedCollections() {
        const listElement = this.elements.savedCollectionsList;
        if (!listElement) {
            return;
        }

        const collections = Array.isArray(this.savedCollections) ? this._sortSavedCollections(this.savedCollections) : [];
        listElement.innerHTML = '';

        if (!collections.length) {
            this.elements.savedCollectionsEmptyState?.classList.remove('u-is-hidden');
            return;
        }

        collections.forEach(collection => {
            listElement.appendChild(this._buildSavedCollectionItem(collection));
        });
        this.elements.savedCollectionsEmptyState?.classList.add('u-is-hidden');
    }

    _buildSavedCollectionItem(collection) {
        const listItem = document.createElement('li');
        listItem.className = 'saved-collections-list__item saved-collection-card';
        listItem.dataset.collectionId = collection.id;

        const header = document.createElement('div');
        header.className = 'saved-collection-card__header';

        const badge = document.createElement('span');
        badge.className = 'saved-collection-card__badge';
        const badgeIcon = document.createElement('span');
        badgeIcon.className = 'material-symbols-outlined';
        badgeIcon.setAttribute('aria-hidden', 'true');
        badgeIcon.textContent = 'bookmark';
        badge.appendChild(badgeIcon);

        const info = document.createElement('div');
        info.className = 'saved-collection-card__info';

        const title = document.createElement('h4');
        title.className = 'saved-collections-list__title saved-collection-card__title';
        title.textContent = collection.name;

        const timestamp = document.createElement('span');
        timestamp.className = 'saved-collection-card__timestamp';
        timestamp.textContent = this._formatSavedCollectionTimestamp(collection);

        info.append(title, timestamp);

        const actions = document.createElement('div');
        actions.className = 'saved-collections-list__actions saved-collection-card__actions';

        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.className = 'button button--surface button--small saved-collection-card__apply';
        applyButton.dataset.role = 'apply-collection';

        const applyIcon = document.createElement('span');
        applyIcon.className = 'material-symbols-outlined';
        applyIcon.setAttribute('aria-hidden', 'true');
        applyIcon.textContent = 'check_circle';
        const applyLabel = document.createElement('span');
        applyLabel.className = 'button__label';
        applyLabel.textContent = 'Aplicar filtros';
        applyButton.append(applyIcon, applyLabel);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'button button--icon-only saved-collections-list__remove saved-collection-card__remove';
        removeButton.dataset.role = 'remove-collection';
        removeButton.setAttribute('aria-label', `Remover coleção ${collection.name}`);
        const removeIcon = document.createElement('span');
        removeIcon.className = 'material-symbols-outlined';
        removeIcon.setAttribute('aria-hidden', 'true');
        removeIcon.textContent = 'delete';
        removeButton.appendChild(removeIcon);

        actions.append(applyButton, removeButton);
        header.append(badge, info, actions);

        const meta = document.createElement('p');
        meta.className = 'saved-collections-list__meta saved-collection-card__summary';
        meta.textContent = this._describeFilters(collection.filters);

        listItem.append(header, meta);

        return listItem;
    }

    _formatSavedCollectionTimestamp(collection) {
        const rawTimestamp = Number.isFinite(Number(collection?.updatedAt))
            ? Number(collection.updatedAt)
            : Number(collection?.createdAt);

        if (!Number.isFinite(rawTimestamp) || rawTimestamp <= 0) {
            return 'Coleção personalizada';
        }

        const now = Date.now();
        const delta = Math.max(0, now - rawTimestamp);

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        const week = 7 * day;

        if (delta < minute) {
            return 'Atualizado agora';
        }

        if (delta < hour) {
            const minutes = Math.round(delta / minute);
            return `Atualizado há ${minutes} min`;
        }

        if (delta < day) {
            const hours = Math.round(delta / hour);
            return `Atualizado há ${hours} h`;
        }

        if (delta < week) {
            const days = Math.round(delta / day);
            return `Atualizado há ${days} ${days === 1 ? 'dia' : 'dias'}`;
        }

        try {
            const date = new Date(rawTimestamp);
            if (!Number.isFinite(date.getTime())) {
                throw new Error('Invalid date');
            }

            return `Atualizado em ${date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
            })}`;
        } catch (_error) {
            return 'Atualizado recentemente';
        }
    }

    _handleSaveCurrentFilters() {
        const input = this.elements.savedCollectionNameInput;
        const rawName = input?.value?.trim() ?? '';

        if (!rawName) {
            this._markSavedCollectionInputError();
            if (input) {
                try {
                    input.focus({ preventScroll: true });
                } catch (_focusError) {
                    input.focus();
                }
            }
            return;
        }

        const filtersSnapshot = this._captureCurrentFilters();
        const normalizedName = rawName.toLowerCase();
        const timestamp = Date.now();

        let updatedCollections = Array.isArray(this.savedCollections) ? [...this.savedCollections] : [];

        const existingByNameIndex = updatedCollections.findIndex(collection => (collection.name || '').toLowerCase() === normalizedName);
        if (existingByNameIndex >= 0) {
            const existing = updatedCollections[existingByNameIndex];
            updatedCollections[existingByNameIndex] = {
                ...existing,
                name: rawName,
                filters: filtersSnapshot,
                updatedAt: timestamp,
            };
        } else {
            const existingByFiltersIndex = updatedCollections.findIndex(collection => this._areFiltersEqual(collection.filters, filtersSnapshot));
            if (existingByFiltersIndex >= 0) {
                const existing = updatedCollections[existingByFiltersIndex];
                updatedCollections[existingByFiltersIndex] = {
                    ...existing,
                    name: rawName,
                    filters: filtersSnapshot,
                    updatedAt: timestamp,
                };
            } else {
                const newCollection = {
                    id: `collection-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
                    name: rawName,
                    filters: filtersSnapshot,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };
                updatedCollections.unshift(newCollection);
                if (updatedCollections.length > this.maxSavedCollections) {
                    updatedCollections = updatedCollections.slice(0, this.maxSavedCollections);
                }
            }
        }

        this.savedCollections = this._sortSavedCollections(updatedCollections);
        this._persistSavedCollections();
        this._renderSavedCollections();

        if (input) {
            input.value = '';
            this._clearSavedCollectionInputError();
        }
    }

    _markSavedCollectionInputError() {
        const input = this.elements.savedCollectionNameInput;
        if (!input) {
            return;
        }
        input.classList.add('has-error');
        input.setAttribute('aria-invalid', 'true');
    }

    _clearSavedCollectionInputError() {
        const input = this.elements.savedCollectionNameInput;
        if (!input) {
            return;
        }
        input.classList.remove('has-error');
        input.removeAttribute('aria-invalid');
    }

    _handleSavedCollectionsClick(event) {
        const target = event.target;
        if (!target) {
            return;
        }

        const removeButton = target.closest('[data-role="remove-collection"]');
        const applyButton = target.closest('[data-role="apply-collection"]');
        if (!removeButton && !applyButton) {
            return;
        }

        const listItem = target.closest('[data-collection-id]');
        if (!listItem) {
            return;
        }

        const collectionId = listItem.dataset.collectionId;
        const collection = (this.savedCollections || []).find(item => item.id === collectionId);

        if (removeButton) {
            event.preventDefault();
            this._deleteSavedCollection(collectionId);
            return;
        }

        if (applyButton && collection) {
            event.preventDefault();
            this._applySavedCollection(collection);
        }
    }

    _deleteSavedCollection(collectionId) {
        if (!collectionId) {
            return;
        }
        const updated = (this.savedCollections || []).filter(item => item.id !== collectionId);
        if (updated.length === (this.savedCollections || []).length) {
            return;
        }
        this.savedCollections = this._sortSavedCollections(updated);
        this._persistSavedCollections();
        this._renderSavedCollections();
    }

    _applySavedCollection(collection) {
        if (!collection || !collection.filters) {
            return;
        }
        const snapshot = this._sanitizeFilterObject(collection.filters);
        this.persistedCategorySelection = new Set((snapshot.categoryIds || []).map(id => id.toString()));
        this.setSearchQuery(snapshot.searchQuery || '');
        this.generateCategoryTree(this.allCategories || []);
        this.setCategoryTreeState(snapshot.categoryIds || []);
        this.setDifficultyState(snapshot.difficultyLevels || ['all']);
        this.setNumberOfQuestionsState(snapshot.numQuestions);
        this._persistFilters();
        this.debouncedTriggerCountFetch();
        this._renderFeedback();

        const timestamp = Date.now();
        this.savedCollections = this._sortSavedCollections(
            (this.savedCollections || []).map(item => item.id === collection.id
                ? { ...item, updatedAt: timestamp }
                : item)
        );
        this._persistSavedCollections();
        this._renderSavedCollections();
    }

    _renderPredefinedQuizzes(predefinedList = []) {
        const listElement = this.elements.predefinedList;
        if (!listElement) {
            return;
        }

        const sanitizedList = Array.isArray(predefinedList)
            ? predefinedList
                .filter(item => item && Object.prototype.hasOwnProperty.call(item, 'id'))
                .map(item => ({
                    id: Number.parseInt(item.id, 10),
                    nome: typeof item.nome === 'string' ? item.nome : String(item.nome ?? ''),
                    descricao: typeof item.descricao === 'string' ? item.descricao : '',
                    total_perguntas: Number.isFinite(Number(item.total_perguntas))
                        ? Number(item.total_perguntas)
                        : 0,
                }))
                .filter(item => Number.isInteger(item.id) && item.id > 0)
            : [];

        const signature = JSON.stringify(sanitizedList.map(item => [item.id, item.nome, item.descricao, item.total_perguntas]));
        if (signature === this.predefinedListSignature && listElement.childElementCount === sanitizedList.length) {
            return;
        }
        this.predefinedListSignature = signature;

        listElement.innerHTML = '';

        if (!sanitizedList.length) {
            this.elements.predefinedEmptyState?.classList.remove('u-is-hidden');
            return;
        }

        sanitizedList.forEach(item => {
            listElement.appendChild(this._buildPredefinedCard(item));
        });
        this.elements.predefinedEmptyState?.classList.add('u-is-hidden');
    }

    _buildPredefinedCard(item) {
        const card = document.createElement('article');
        card.className = 'filter-predefined-card';
        card.dataset.predefinedId = item.id;

        const header = document.createElement('div');
        header.className = 'filter-predefined-card__header';

        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'filter-predefined-card__icon material-symbols-outlined';
        iconWrapper.setAttribute('aria-hidden', 'true');
        iconWrapper.textContent = 'auto_awesome';

        const content = document.createElement('div');
        content.className = 'filter-predefined-card__content';

        const title = document.createElement('h4');
        title.className = 'filter-predefined-card__title';
        title.textContent = item.nome;
        content.appendChild(title);

        if (item.descricao) {
            const description = document.createElement('p');
            description.className = 'filter-predefined-card__description';
            description.textContent = item.descricao;
            content.appendChild(description);
        }

        header.append(iconWrapper, content);
        card.appendChild(header);

        const footer = document.createElement('div');
        footer.className = 'filter-predefined-card__footer';

        const meta = document.createElement('div');
        meta.className = 'filter-predefined-card__meta';

        const metaIcon = document.createElement('span');
        metaIcon.className = 'material-symbols-outlined';
        metaIcon.setAttribute('aria-hidden', 'true');
        metaIcon.textContent = 'quiz';

        const metaText = document.createElement('span');
        metaText.className = 'filter-predefined-card__meta-text';
        metaText.textContent = `${this._formatNumber(item.total_perguntas)} questões`;

        meta.append(metaIcon, metaText);

        const actions = document.createElement('div');
        actions.className = 'filter-predefined-card__actions';

        const startButton = document.createElement('button');
        startButton.type = 'button';
        startButton.className = 'button button--surface button--small';
        startButton.dataset.role = 'start-predefined';

        const startIcon = document.createElement('span');
        startIcon.className = 'material-symbols-outlined';
        startIcon.setAttribute('aria-hidden', 'true');
        startIcon.textContent = 'play_arrow';
        const startLabel = document.createElement('span');
        startLabel.className = 'button__label';
        startLabel.textContent = 'Começar agora';
        startButton.append(startIcon, startLabel);

        actions.appendChild(startButton);
        footer.append(meta, actions);
        card.appendChild(footer);

        return card;
    }

    _handlePredefinedListInteraction(event) {
        const target = event.target;
        if (!target) {
            return;
        }

        const actionButton = target.closest('[data-role="start-predefined"]');
        if (!actionButton) {
            return;
        }

        const card = actionButton.closest('[data-predefined-id]');
        if (!card) {
            return;
        }

        const quizId = Number.parseInt(card.dataset.predefinedId, 10);
        if (Number.isNaN(quizId)) {
            return;
        }

        if (!this.actionOrchestrator || typeof this.actionOrchestrator.startPredefinedQuiz !== 'function') {
            console.error('FilterPanel: actionOrchestrator indisponível para iniciar quiz pré-definido.');
            return;
        }

        if (this.quizUI?.modalManager) {
            this.quizUI.modalManager.toggleFilterPanel(false);
        }

        this.actionOrchestrator.startPredefinedQuiz(quizId);
    }

    _computeCategoriesSignature(categories) {
        if (!Array.isArray(categories)) {
            return '[]';
        }
        try {
            return JSON.stringify(categories.map(cat => [cat?.id_categoria ?? null, cat?.nome_categoria ?? null]));
        } catch (_signatureError) {
            return String(categories.length);
        }
    }

    _ensureCategoryTree(categories) {
        const normalizedCategories = Array.isArray(categories) ? categories : [];
        const signature = this._computeCategoriesSignature(normalizedCategories);
        const hasChanged = signature !== this.cachedCategoriesSignature;
        if (hasChanged || !this.hasGeneratedTree) {
            this.cachedCategoriesSignature = signature;
            this.generateCategoryTree(normalizedCategories);
            this.hasGeneratedTree = true;
            return true;
        }
        return false;
    }

    _renderFeedback() {
        if (!this.store) return;

        const { isLoadingCount, filteredQuestionsCount, countError } = this.store.getState().ui.filterPanel;
        const input = this.elements.numQuestionsInput;
        const feedbackTextEl = this.elements.numQuestionsFeedbackText;
        const aplicarFiltrosBtn = this.elements.btnAplicarFiltrosPainel;

        if (!input || !feedbackTextEl || !aplicarFiltrosBtn) return;
        
        feedbackTextEl.className = 'form-text-feedback form-text-feedback--filter-panel';
        const enableAplicarFiltros = (enable) => { aplicarFiltrosBtn.disabled = !enable; };
        const setAplicarFiltrosBusyState = (isBusy) => {
            if (isBusy) {
                aplicarFiltrosBtn.setAttribute('aria-busy', 'true');
                aplicarFiltrosBtn.classList.add('is-loading');
            } else {
                aplicarFiltrosBtn.removeAttribute('aria-busy');
                aplicarFiltrosBtn.classList.remove('is-loading');
            }
        };

        if (isLoadingCount) {
            feedbackTextEl.textContent = "Verificando...";
            feedbackTextEl.classList.add('is-loading');
            setAplicarFiltrosBusyState(true);
            return;
        }

        setAplicarFiltrosBusyState(false);

        if (countError) {
            input.removeAttribute('max');
            feedbackTextEl.textContent = countError;
            feedbackTextEl.classList.add('has-error');
            enableAplicarFiltros(false);
            return;
        }

        const maxQuestions = filteredQuestionsCount ?? 0;
        let currentSelectedNum = this.getSelectedNumberOfQuestions();
        
        if (maxQuestions === 0) {
            input.setAttribute('max', '0');
            if (input.value !== "") input.value = "";
            currentSelectedNum = null;
            feedbackTextEl.textContent = "Nenhuma questão encontrada.";
            feedbackTextEl.classList.add('is-empty');
            enableAplicarFiltros(false); 
        } else {
            input.setAttribute('max', maxQuestions.toString());
            input.placeholder = `${maxQuestions}`;
            if (currentSelectedNum !== null && currentSelectedNum > maxQuestions) {
                feedbackTextEl.textContent = `Máx: ${maxQuestions}. (Inválido)`;
                feedbackTextEl.classList.add('has-error');
                enableAplicarFiltros(false);
            } else if (currentSelectedNum === null || currentSelectedNum === 0) {
                feedbackTextEl.textContent = `Disponíveis: ${maxQuestions} questões.`;
                enableAplicarFiltros(true);
            } else {
                feedbackTextEl.textContent = `Selecionadas: ${currentSelectedNum} de ${maxQuestions}.`;
                enableAplicarFiltros(true);
            }
        }
    }

    // --- INÍCIO DA CORREÇÃO ---
    _handleSelectAllCategories() {
        if (!this.store) return;
        const allCategories = this.store.getState().geral.allCategories;
        if (allCategories) {
            const allCategoryIds = allCategories.map(c => c.id_categoria.toString());
            this.setCategoryTreeState(allCategoryIds);
            this._persistFilters();
            this.debouncedTriggerCountFetch(); // A chamada de API será rápida por causa do getSelectedCategories() otimizado.
        }
    }

    _handleClearAllCategories() {
        this.setCategoryTreeState([]); // Limpa visualmente os checkboxes
        this._persistFilters();
        this.debouncedTriggerCountFetch(); // Dispara a busca, que será rápida.
    }
    // --- FIM DA CORREÇÃO ---

    _handleStepper(direction) {
        const input = this.elements.numQuestionsInput;
        if (!input) return;
        
        let currentValue = parseInt(input.value, 10);
        const min = parseInt(input.min, 10) || 1;
        const step = parseInt(input.step, 10) || 1;
        const maxStr = input.getAttribute('max');
        const max = (maxStr && !isNaN(parseInt(maxStr))) ? parseInt(maxStr) : Infinity;

        if (max === 0 && direction > 0) return;

        if (direction < 0) {
            if (isNaN(currentValue)) {
                currentValue = (max !== Infinity && max > 0) ? max : 10;
                input.value = String(Math.max(min, currentValue - step));
            } else if (currentValue <= min) {
                input.value = "";
            } else {
                input.value = String(Math.max(min, currentValue - step));
            }
        } else {
            if (isNaN(currentValue) || currentValue < min) {
                currentValue = min;
            } else {
                currentValue += step;
            }
            input.value = String(Math.min(max === Infinity ? currentValue : max, currentValue));
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    _validateAndProcessNumQuestionsInput(inputElement) {
        if (!inputElement) return;
        let currentValueStr = inputElement.value.trim();
        const min = parseInt(inputElement.min, 10) || 1;
        const maxStr = inputElement.getAttribute('max');
        const max = (maxStr && !isNaN(parseInt(maxStr, 10)) && parseInt(maxStr, 10) >= 0) ? parseInt(maxStr, 10) : null;

        if (max === 0) {
            inputElement.value = "";
        } else if (currentValueStr !== "") {
            let numValue = parseInt(currentValueStr, 10);
            if (isNaN(numValue) || numValue < min) {
                inputElement.value = "";
            } else if (max !== null && numValue > max) {
                inputElement.value = max.toString();
            } else {
                inputElement.value = numValue.toString();
            }
        }
        this._persistFilters();
        this._renderFeedback();
    }
    
    getSelectedCategories() {
        const totalCategories = this.categoryIdSet.size;
        const selectedIds = Array.from(this.persistedCategorySelection);

        if (totalCategories > 0 && selectedIds.length === totalCategories) {
            return [];
        }

        return selectedIds;
    }
    
    getSelectedDifficulties() {
        const selected = Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:checked') || [])
                            .map(cb => cb.value)
                            .filter(val => val !== 'all');
        return selected.length > 0 ? selected : ['all'];
    }

    getSearchQuery() {
        return this.searchQuery.trim();
    }

    getSelectedNumberOfQuestions() {
        if (this.elements.numQuestionsInput) {
            const valueStr = this.elements.numQuestionsInput.value.trim();
            if (valueStr === '') return null;
            const value = parseInt(valueStr, 10);
            return !isNaN(value) && value > 0 ? value : null; 
        }
        return null;
    }
    
    setCategoryTreeState(selectedIds = []) {
        const normalizedIds = Array.isArray(selectedIds)
            ? selectedIds
                .filter(id => id !== null && id !== undefined)
                .map(id => id.toString())
            : [];
        this.persistedCategorySelection = new Set(normalizedIds);
        const selectedIdsSet = new Set(normalizedIds);

        const allCheckboxes = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input') || []);
        allCheckboxes.forEach(cb => {
            cb.checked = selectedIdsSet.has(cb.value);
            cb.classList.remove('is-indeterminate');
        });

        const parentItems = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
        for (let i = parentItems.length - 1; i >= 0; i--) {
            this._updateParentCheckboxState(parentItems[i]);
        }
    }
    
    setDifficultyState(difficulties = ['all']) {
        const allCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        const specificCheckboxes = Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input:not([value="all"])') || []);
        if (!allCheckbox) return;

        const useAll = difficulties.includes('all') || difficulties.length === 0;
        allCheckbox.checked = useAll;
        specificCheckboxes.forEach(cb => {
            cb.checked = !useAll && difficulties.includes(cb.value);
        });
        if (!useAll && !specificCheckboxes.some(cb => cb.checked)) {
            allCheckbox.checked = true;
        }
    }

    setNumberOfQuestionsState(num) {
        if (this.elements.numQuestionsInput) {
            this.elements.numQuestionsInput.value = (num && num > 0) ? String(num) : '';
        }
    }

    setSearchQuery(query = '') {
        const normalizedQuery = typeof query === 'string' ? query : '';
        this.searchQuery = normalizedQuery;
        if (this.elements.categorySearchInput && this.elements.categorySearchInput.value !== normalizedQuery) {
            this.elements.categorySearchInput.value = normalizedQuery;
        }
        this._updateSearchVisualState();
    }

    generateCategoryTree(categories) {
        const treeContainer = this.elements.categoryTreeList;
        if (!treeContainer) return;

        this.allCategories = Array.isArray(categories) ? categories : [];
        this.categoryIdSet = new Set(
            this.allCategories
                .map(cat => (cat?.id_categoria !== undefined ? cat.id_categoria.toString() : null))
                .filter(Boolean)
        );
        this.persistedCategorySelection = new Set(
            Array.from(this.persistedCategorySelection).filter(id => this.categoryIdSet.has(id))
        );

        if (this.elements.categorySearchInput && this.elements.categorySearchInput.value !== this.searchQuery) {
            this.elements.categorySearchInput.value = this.searchQuery;
        }
        this._updateSearchVisualState();

        const hierarchicalCategories = this._buildHierarchicalCategories(this.allCategories);

        if (!hierarchicalCategories.length) {
            treeContainer.innerHTML = '<li class="category-tree__empty-state">Nenhuma categoria para exibir.</li>';
            return;
        }

        const searchTerm = this.getSearchQuery();
        const normalizedSearch = searchTerm.toLowerCase();

        let categoriesToRender = hierarchicalCategories;
        if (normalizedSearch) {
            categoriesToRender = this._filterCategoriesBySearch(hierarchicalCategories, normalizedSearch, []);
            if (!categoriesToRender.length) {
                treeContainer.innerHTML = '<li class="category-tree__empty-state">Nenhuma categoria encontrada.</li>';
                return;
            }
        }

        treeContainer.innerHTML = '';
        const shouldExpandOnRender = Boolean(normalizedSearch);

        const createTreeNodes = (nodes, parentElement) => {
            nodes.forEach(catNode => {
                const listItem = document.createElement('li');
                listItem.className = 'category-tree__item';
                listItem.setAttribute('role', 'treeitem');

                const labelWrapper = document.createElement('div');
                labelWrapper.className = 'category-tree__label-wrapper';

                const inputCheckbox = document.createElement('input');
                inputCheckbox.type = 'checkbox';
                inputCheckbox.id = `cat-tree-${catNode.id_categoria}`;
                inputCheckbox.className = 'category-tree__input u-sr-only';
                inputCheckbox.value = catNode.id_categoria.toString();

                const label = document.createElement('label');
                label.htmlFor = inputCheckbox.id;
                label.className = 'category-tree__label';
                label.tabIndex = 0;

                const labelMainText = document.createElement('span');
                labelMainText.className = 'category-tree__label-text';
                labelMainText.textContent = catNode.nome_categoria;
                label.appendChild(labelMainText);

                const searchAncestors = Array.isArray(catNode.__searchMeta?.ancestors)
                    ? catNode.__searchMeta.ancestors.filter(Boolean)
                    : [];
                if (searchAncestors.length) {
                    const contextText = searchAncestors.join(' › ');
                    const labelContext = document.createElement('span');
                    labelContext.className = 'category-tree__label-context';
                    labelContext.textContent = contextText;
                    label.appendChild(labelContext);
                    label.title = `${catNode.nome_categoria} • ${contextText}`;
                } else {
                    label.title = catNode.nome_categoria;
                }

                label.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        inputCheckbox.checked = !inputCheckbox.checked;
                        inputCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                if (catNode.subcategorias && catNode.subcategorias.length > 0) {
                    listItem.classList.add('category-tree__item--has-children');

                    const toggleButton = document.createElement('button');
                    toggleButton.type = 'button';
                    toggleButton.className = 'category-tree__toggle';
                    toggleButton.innerHTML = `<span class="material-symbols-outlined">chevron_right</span>`;
                    toggleButton.setAttribute('aria-label', `Expandir ${catNode.nome_categoria}`);

                    toggleButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isExpanded = listItem.getAttribute('aria-expanded') === 'true';
                        listItem.setAttribute('aria-expanded', String(!isExpanded));
                        toggleButton.querySelector('.material-symbols-outlined').textContent = !isExpanded ? 'expand_more' : 'chevron_right';
                        this._updateSubmenuHeight(subMenu, !isExpanded);
                    });

                    const shouldExpand = shouldExpandOnRender;
                    listItem.setAttribute('aria-expanded', String(shouldExpand));
                    toggleButton.querySelector('.material-symbols-outlined').textContent = shouldExpand ? 'expand_more' : 'chevron_right';

                    labelWrapper.appendChild(toggleButton);
                    labelWrapper.appendChild(inputCheckbox);
                    labelWrapper.appendChild(label);

                    const subMenu = document.createElement('ul');
                    subMenu.className = 'category-tree__submenu';
                    subMenu.setAttribute('role', 'group');
                    createTreeNodes(catNode.subcategorias, subMenu);

                    listItem.appendChild(labelWrapper);
                    listItem.appendChild(subMenu);
                    if (shouldExpand) {
                        this._updateSubmenuHeight(subMenu, true);
                    } else {
                        subMenu.style.maxHeight = '0';
                    }
                } else {
                    listItem.setAttribute('aria-expanded', 'false');
                    labelWrapper.appendChild(inputCheckbox);
                    labelWrapper.appendChild(label);
                    listItem.appendChild(labelWrapper);
                }
                parentElement.appendChild(listItem);
            });
        };
        createTreeNodes(categoriesToRender, treeContainer);
        this._restoreCategorySelectionOnRender();
    }

    _buildHierarchicalCategories(categories) {
        const categoryMap = new Map();
        (categories || []).forEach(cat => {
            if (!cat || cat.id_categoria === undefined) return;
            categoryMap.set(cat.id_categoria, { ...cat, subcategorias: [] });
        });

        const hierarchicalCategories = [];
        categoryMap.forEach(catNode => {
            if (catNode.id_categoria_pai && categoryMap.has(catNode.id_categoria_pai)) {
                categoryMap.get(catNode.id_categoria_pai).subcategorias.push(catNode);
            } else {
                hierarchicalCategories.push(catNode);
            }
        });
        return hierarchicalCategories;
    }

    _filterCategoriesBySearch(nodes, normalizedTerm, ancestors = []) {
        if (!Array.isArray(nodes) || !normalizedTerm) {
            return nodes || [];
        }

        const filtered = [];
        nodes.forEach(node => {
            if (!node) return;
            const nodeName = typeof node.nome_categoria === 'string' ? node.nome_categoria : '';
            const nodeMatches = nodeName.toLowerCase().includes(normalizedTerm);
            const childNodes = Array.isArray(node.subcategorias) ? node.subcategorias : [];
            const nextAncestors = [...ancestors, node];
            const filteredChildren = this._filterCategoriesBySearch(childNodes, normalizedTerm, nextAncestors);

            if (nodeMatches) {
                const clonedNode = this._cloneCategoryNode(node);
                if (clonedNode) {
                    clonedNode.__searchMeta = {
                        ancestors: ancestors
                            .map(ancestor => ancestor?.nome_categoria)
                            .filter(name => typeof name === 'string' && name.trim() !== ''),
                    };
                    if (filteredChildren.length) {
                        clonedNode.subcategorias = filteredChildren;
                    }
                    filtered.push(clonedNode);
                }
                return;
            }

            if (filteredChildren.length) {
                filteredChildren.forEach(childNode => {
                    if (childNode) {
                        filtered.push(childNode);
                    }
                });
            }
        });

        return filtered;
    }

    _cloneCategoryNode(node) {
        if (!node) return null;
        const clonedChildren = Array.isArray(node.subcategorias)
            ? node.subcategorias.map(child => this._cloneCategoryNode(child)).filter(Boolean)
            : [];
        const { __searchMeta: _ignoredMeta, ...nodeWithoutMeta } = node;
        return { ...nodeWithoutMeta, subcategorias: clonedChildren };
    }

    _restoreCategorySelectionOnRender() {
        const selectedIds = Array.from(this.persistedCategorySelection);
        if (!selectedIds.length) {
            return;
        }
        this.setCategoryTreeState(selectedIds);
    }
    
    _handleCategoryCheckboxChange(checkboxElement) {
        const isChecked = checkboxElement.checked;
        const listItem = checkboxElement.closest('.category-tree__item');
        if (!listItem) return;

        checkboxElement.classList.remove('is-indeterminate');

        const childCheckboxes = listItem.querySelectorAll('.category-tree__input');
        childCheckboxes.forEach(childCb => {
            if (childCb !== checkboxElement) {
                childCb.checked = isChecked;
                childCb.classList.remove('is-indeterminate');
            }
        });

        this._updateParentCheckboxState(listItem.parentElement?.closest('.category-tree__item'));
        this._syncPersistedSelectionWithDOM();
        this._persistFilters();
        this.debouncedTriggerCountFetch();
    }
    
    _updateParentCheckboxState(parentListItem) {
        if (!parentListItem) return;

        const parentCheckbox = parentListItem.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
        if (!parentCheckbox) return;

        const childCheckboxes = Array.from(parentListItem.querySelectorAll(':scope > .category-tree__submenu .category-tree__input'));
        if (childCheckboxes.length === 0) return;

        const totalChecked = childCheckboxes.filter(cb => cb.checked).length;
        const totalIndeterminate = childCheckboxes.filter(cb => cb.classList.contains('is-indeterminate')).length;

        if (totalChecked === 0 && totalIndeterminate === 0) {
            parentCheckbox.checked = false;
            parentCheckbox.classList.remove('is-indeterminate');
        } else if (totalChecked === childCheckboxes.length) {
            parentCheckbox.checked = true;
            parentCheckbox.classList.remove('is-indeterminate');
        } else {
            parentCheckbox.checked = false;
            parentCheckbox.classList.add('is-indeterminate');
        }
        
        this._updateParentCheckboxState(parentListItem.parentElement?.closest('.category-tree__item'));
    }

    _syncPersistedSelectionWithDOM() {
        const allCheckboxes = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input') || []);
        const visibleIds = new Set(allCheckboxes.map(cb => cb.value));
        const selectedVisibleIds = allCheckboxes
            .filter(cb => cb.checked && !cb.classList.contains('is-indeterminate'))
            .map(cb => cb.value);

        const preservedHiddenIds = Array.from(this.persistedCategorySelection).filter(id => !visibleIds.has(id));
        this.persistedCategorySelection = new Set([...preservedHiddenIds, ...selectedVisibleIds]);
    }

    _updateSubmenuHeight(subMenuElement, isExpanding) {
        if (!subMenuElement) return;

        // A altura que o submenu vai adicionar ou remover.
        const targetHeight = subMenuElement.scrollHeight;

        if (isExpanding) {
            subMenuElement.style.maxHeight = targetHeight + 'px';
        } else {
            subMenuElement.style.maxHeight = '0';
        }

        // Propaga a mudança de altura para todos os submenus pais.
        let parent = subMenuElement.parentElement.closest('.category-tree__submenu');
        while (parent) {
            const heightChange = isExpanding ? targetHeight : -targetHeight;
            // Lê a altura atual do pai, ou assume 0 se não estiver definida.
            const currentParentHeight = parseInt(parent.style.maxHeight, 10) || 0;
            const newHeight = isExpanding
                ? currentParentHeight + targetHeight
                : Math.max(0, currentParentHeight + heightChange);
            parent.style.maxHeight = newHeight + 'px';

            // Sobe na árvore para o próximo pai.
            parent = parent.parentElement.closest('.category-tree__submenu');
        }
    }
}