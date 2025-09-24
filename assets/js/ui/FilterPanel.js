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
        this.hasInitialized = false;
        this.hasGeneratedTree = false;
        this.cachedCategoriesSignature = null;
        this.lastPersistedFilters = null;

        this.debouncedTriggerCountFetch = debounce(this._triggerCountFetch.bind(this), 400);

        this._cacheOwnElements();
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