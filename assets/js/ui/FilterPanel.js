// File: assets/js/ui/FilterPanel.js

import { TRANSITION_DURATION } from '../utils/constants.js';
import { debounce } from '../utils/helpers.js';

export default class FilterPanel {
    constructor(filterPanelElement, quizLogicInstance, quizStateInstance, quizDataInstance, quizUIInstance, apiServiceInstance) {
        if (!filterPanelElement) {
            console.error("FilterPanel: Elemento principal do painel de filtros não fornecido.");
            return;
        }
        this.panelElement = filterPanelElement;
        this.quizLogic = quizLogicInstance;
        this.quizState = quizStateInstance;
        this.quizData = quizDataInstance;
        this.quizUI = quizUIInstance;
        this.apiService = apiServiceInstance;

        this.isFetchingCount = false;
        this.debouncedFetchFilteredQuestionCount = debounce(this._fetchFilteredQuestionCount.bind(this), 600);

        this.lastProcessedNumQuestionsValue = undefined; // Usar undefined para estado inicial não processado

        this._cacheOwnElements();
    }

    _cacheOwnElements() {
        this.elements = {
            categoryTreeList: this.panelElement.querySelector('#category-tree-list'),
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
    }

    setupEventListeners() {
        const triggerCountFetch = () => {
            // console.log("Triggering count fetch due to filter change.");
            this.debouncedFetchFilteredQuestionCount();
        }

        this.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => {
            if (this.quizLogic) this.quizLogic.applyFiltersAndStartQuiz();
        });
        this.elements.btnLimparFiltrosPainel?.addEventListener('click', () => this.resetFiltersToDefault());

        this.elements.btnCatSelectAll?.addEventListener('click', () => {
            if (this.quizData && this.elements.categoryTreeList.hasChildNodes()) {
                const allCategoryIds = this.quizData.getCategorias().map(c => c.id_categoria.toString());
                this.setCategoryTreeState(allCategoryIds);
                if (this.quizState) this.quizState.activeFiltersForCurrentSet.category_ids = allCategoryIds;
                triggerCountFetch();
            }
        });
        this.elements.btnCatClearAll?.addEventListener('click', () => {
            this.setCategoryTreeState([]);
            if (this.quizState) this.quizState.activeFiltersForCurrentSet.category_ids = [];
            triggerCountFetch();
        });

        // _handleCategoryCheckboxChange chama triggerCountFetch internamente
        // então não precisamos de um listener separado aqui no categoryTreeList para 'change'
        // a menos que _handleCategoryCheckboxChange seja refatorado para não chamá-lo.
        // Por agora, vamos assumir que _handleCategoryCheckboxChange lida com isso.

        this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]').forEach(input => {
            input.addEventListener('change', () => {
                const diffInputs = Array.from(this.elements.filterGroupDifficulty.querySelectorAll('input[name="difficulty"]'));
                const allDiffCb = diffInputs.find(cb => cb.value === 'all');
                if (input.value === 'all' && input.checked) {
                    diffInputs.forEach(other => { if (other.value !== 'all') other.checked = false; });
                } else if (input.value !== 'all' && input.checked) {
                    if (allDiffCb) allDiffCb.checked = false;
                }
                const anySpecificChecked = diffInputs.some(cb => cb.value !== 'all' && cb.checked);
                if (!anySpecificChecked && allDiffCb && !allDiffCb.checked) allDiffCb.checked = true;
                
                if (this.quizState) this.quizState.activeFiltersForCurrentSet.difficulty_levels = this.getSelectedDifficulties();
                triggerCountFetch();
            });
        });

        this.elements.numQuestionsInput?.addEventListener('input', (event) => {
            this._validateAndProcessNumQuestionsInput(event.target, false); // false: não forçar no input, apenas se valor mudar
        });
        this.elements.numQuestionsInput?.addEventListener('blur', (event) => {
            // No blur, sempre revalidamos e potencialmente atualizamos o feedback se o campo estiver vazio,
            // para garantir que "Listando todas..." seja mostrado corretamente.
            this._validateAndProcessNumQuestionsInput(event.target, true);
        });

        this.elements.btnNumDecrement?.addEventListener('click', () => {
            if (this.elements.numQuestionsInput) {
                let currentValue = parseInt(this.elements.numQuestionsInput.value, 10);
                const min = parseInt(this.elements.numQuestionsInput.min, 10) || 1;
                
                if (isNaN(currentValue)) {
                    const maxAttr = this.elements.numQuestionsInput.getAttribute('max');
                    currentValue = maxAttr && !isNaN(parseInt(maxAttr)) ? parseInt(maxAttr, 10) : 10; 
                    if (isNaN(currentValue) || currentValue < min ) currentValue = min; // Garante que não seja menor que o min
                    this.elements.numQuestionsInput.value = Math.max(min, currentValue -1).toString(); // Decrementa se possível
                } else if (currentValue <= min) {
                     this.elements.numQuestionsInput.value = ""; 
                } else {
                    currentValue -= (parseInt(this.elements.numQuestionsInput.step, 10) || 1);
                    this.elements.numQuestionsInput.value = Math.max(min, currentValue).toString();
                }
                // Dispara o evento input para que a lógica de _validateAndProcessNumQuestionsInput seja acionada
                this.elements.numQuestionsInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        this.elements.btnNumIncrement?.addEventListener('click', () => {
            if (this.elements.numQuestionsInput) {
                let currentValue = parseInt(this.elements.numQuestionsInput.value, 10) || 0; 
                const min = parseInt(this.elements.numQuestionsInput.min, 10) || 1;
                const step = parseInt(this.elements.numQuestionsInput.step, 10) || 1;
                const maxStr = this.elements.numQuestionsInput.getAttribute('max');
                // Se maxQuestions for 0, max será 0. Não permitir incremento.
                const max = maxStr && !isNaN(parseInt(maxStr)) ? parseInt(maxStr, 10) : Infinity;

                if (max === 0) return; // Não incrementa se o máximo é 0

                if (currentValue < min) { 
                    currentValue = min;
                } else {
                    currentValue += step;
                }
                
                this.elements.numQuestionsInput.value = Math.min(max, currentValue).toString();
                this.elements.numQuestionsInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    _validateAndProcessNumQuestionsInput(inputElement, forceFetchOnEmptyBlur = false) {
        if (!inputElement) return;

        let currentValueStr = inputElement.value.trim();
        let processedValue = null; 

        if (currentValueStr !== "") {
            let numValue = parseInt(currentValueStr, 10);
            const min = parseInt(inputElement.min, 10) || 1;
            const maxStr = inputElement.getAttribute('max');
            // max pode ser 0 se não houver questões.
            const max = (maxStr && !isNaN(parseInt(maxStr, 10)) && parseInt(maxStr, 10) >= 0) ? parseInt(maxStr, 10) : null;

            if (isNaN(numValue) || numValue <= 0) { // Se for inválido ou 0/negativo, trata como "todas"
                inputElement.value = ""; 
                processedValue = null;
            } else if (max !== null && numValue > max && max >= 0) { // Se exceder um max válido (incluindo 0)
                numValue = max;
                inputElement.value = max === 0 ? "" : numValue.toString(); // Se max é 0, limpa o campo
                processedValue = max === 0 ? null : numValue;
            } else {
                processedValue = numValue;
            }
        } else { 
            processedValue = null; // Vazio significa "todas"
        }

        const oldValueInState = this.quizState?.activeFiltersForCurrentSet?.num_questions;
        if (this.quizState) {
            this.quizState.activeFiltersForCurrentSet.num_questions = processedValue;
        }

        // Dispara a busca da contagem se o valor lógico mudou,
        // ou se estamos no blur de um campo que ficou vazio (para atualizar "Listando todas...").
        if (this.lastProcessedNumQuestionsValue !== processedValue || (forceFetchOnEmptyBlur && currentValueStr === "")) {
            // console.log(`Num questions changed from ${this.lastProcessedNumQuestionsValue} to ${processedValue}. Triggering fetch.`);
            this.lastProcessedNumQuestionsValue = processedValue;
            this.debouncedFetchFilteredQuestionCount();
        } else if (oldValueInState !== processedValue) {
            // Se o valor lógico mudou mas o lastProcessedNumQuestionsValue era o mesmo (ex: de null para "" que ainda é null lógico)
            // mas o estado precisa ser atualizado no feedback (ex: maxQuestions mudou).
            // Força a atualização do feedback, mas não necessariamente uma nova busca se a lógica acima não pegar.
            // No entanto, a _updateNumQuestionsFeedback já usa o valor do quizState.
            // O importante é que debouncedFetchFilteredQuestionCount seja chamado se a *interpretação* do filtro mudou.
        }
    }

    async _fetchFilteredQuestionCount() {
        if (this.isFetchingCount || !this.apiService) {
            return;
        }
        this.isFetchingCount = true;
        
        const feedbackTextEl = this.elements.numQuestionsFeedbackText;
        const aplicarFiltrosBtn = this.elements.btnAplicarFiltrosPainel;

        // APENAS MUDAR O TEXTO E ESTADO DO BOTÃO "APLICAR" SE ESTIVER REALMENTE BUSCANDO
        if (feedbackTextEl) {
            feedbackTextEl.textContent = "Verificando questões...";
            feedbackTextEl.className = 'form-text-feedback form-text-feedback--filter-panel is-loading';
        }
        // Não mexer no botão aqui ainda. Apenas no final da operação.

        const countFilterParams = {
            category_ids: this.quizState?.activeFiltersForCurrentSet?.category_ids || [],
            difficulty_levels: this.quizState?.activeFiltersForCurrentSet?.difficulty_levels || ['all'],
        };

        try {
            const data = await this.apiService.fetchQuizData(countFilterParams);
            const maxQuestions = (data?.perguntas?.length) || 0;
            this._updateNumQuestionsFeedback(maxQuestions); // Atualiza o feedback e o botão "Aplicar"
        } catch (error) {
            console.error("FilterPanel: Erro ao buscar contagem de questões:", error);
            this._updateNumQuestionsFeedback(null); // Trata erro e atualiza botão "Aplicar"
        } finally {
            this.isFetchingCount = false;
            // A classe 'is-loading' é removida e o botão "Aplicar" é ajustado dentro de _updateNumQuestionsFeedback
        }
    }

    _updateNumQuestionsFeedback(maxQuestions) {
        const input = this.elements.numQuestionsInput;
        const feedbackTextEl = this.elements.numQuestionsFeedbackText;
        const aplicarFiltrosBtn = this.elements.btnAplicarFiltrosPainel;
        
        if (!input || !feedbackTextEl) return;

        feedbackTextEl.className = 'form-text-feedback form-text-feedback--filter-panel'; // Reseta classes
        const defaultPlaceholder = "Qtd.";
        let currentSelectedNum = this.quizState?.activeFiltersForCurrentSet?.num_questions;

        // Gerencia o botão "Aplicar Filtros"
        const enableAplicarFiltros = (enable) => {
            if (aplicarFiltrosBtn) {
                aplicarFiltrosBtn.disabled = !enable;
            }
        };

        if (maxQuestions === null) { // Erro
            input.removeAttribute('max');
            input.placeholder = defaultPlaceholder;
            feedbackTextEl.textContent = "Erro ao carregar contagem.";
            feedbackTextEl.classList.add('has-error');
            enableAplicarFiltros(false);
        } else if (maxQuestions === 0) {
            input.setAttribute('max', '0');
            input.placeholder = "0";
            // Se maxQuestions é 0, currentSelectedNum no quizState deve ser null (ou 0 e tratado como null).
            // E o input.value deve ser limpo por _validateAndProcessNumQuestionsInput.
            if (input.value !== "" && parseInt(input.value, 10) !== 0) { // Garante que o input esteja vazio se max é 0
                 // input.value = ""; // Comentado para ver se a validação resolve
            }
            feedbackTextEl.textContent = "Nenhuma questão encontrada.";
            feedbackTextEl.classList.add('is-empty');
            enableAplicarFiltros(false);
        } else { // maxQuestions > 0
            input.setAttribute('max', maxQuestions.toString());
            input.placeholder = `${maxQuestions}`;

            if (currentSelectedNum === null || currentSelectedNum === 0) {
                feedbackTextEl.textContent = `Disponíveis: ${maxQuestions} questões.`;
            } else if (currentSelectedNum > maxQuestions) {
                // A validação deveria ter corrigido input.value, aqui apenas refletimos o estado.
                feedbackTextEl.textContent = `Disponíveis: ${maxQuestions}. (Definido: ${currentSelectedNum})`;
                 // Se quizState.num_questions ainda for > maxQuestions, pode ser um problema de timing.
                 // A ação correta aqui seria desabilitar o botão Aplicar, pois o estado é inválido.
                 // No entanto, _validateAndProcessNumQuestionsInput deveria ter corrigido o valor no input e no quizState.
            } else {
                feedbackTextEl.textContent = `Selecionadas: ${currentSelectedNum} de ${maxQuestions} questões.`;
            }
            enableAplicarFiltros(true);
        }
    }
    
    loadCurrentFilters() {
        const filters = this.quizState?.activeFiltersForCurrentSet || { difficulty_levels: ['all'], category_ids: [], num_questions: null };
        
        this.setDifficultyState(filters.difficulty_levels);
        this.setNumberOfQuestionsState(filters.num_questions); 
        this.lastProcessedNumQuestionsValue = filters.num_questions;
        
        if (this.quizData && this.elements.categoryTreeList) {
            const categorias = this.quizData.getCategorias();
            if (categorias.length > 0) {
                const categoriasHierarquicas = this.quizData.getCategoriasHierarquicamente();
                if (categoriasHierarquicas && categoriasHierarquicas.length > 0) {
                    this.generateCategoryTree(categoriasHierarquicas);
                    this.setCategoryTreeState(filters.category_ids);
                } else {
                    this.elements.categoryTreeList.innerHTML = '<li class="category-tree__empty-state">Nenhuma categoria para filtrar.</li>';
                }
            } else {
                this.elements.categoryTreeList.innerHTML = '<li class="category-tree__empty-state">Categorias indisponíveis.</li>';
            }
        } else {
             if (this.elements.categoryTreeList) {
                 this.elements.categoryTreeList.innerHTML = '<li class="category-tree__empty-state">Erro ao carregar categorias.</li>';
            }
        }
        this._fetchFilteredQuestionCount();
    }

    resetFiltersToDefault() {
        this.setCategoryTreeState([]);
        this.setDifficultyState(['all']);
        this.setNumberOfQuestionsState(null); 
        this.lastProcessedNumQuestionsValue = undefined; // Reset para indefinido

        if (this.quizState) {
            this.quizState.activeFiltersForCurrentSet.category_ids = [];
            this.quizState.activeFiltersForCurrentSet.difficulty_levels = ['all'];
            this.quizState.activeFiltersForCurrentSet.num_questions = null;
        }
        this._fetchFilteredQuestionCount();
    }

    _updateSubmenuHeight(subMenuElement, isExpanding) {
        if (!subMenuElement) return;
        if (isExpanding) {
            subMenuElement.style.display = 'block';
            requestAnimationFrame(() => {
                const scrollHeight = subMenuElement.scrollHeight;
                subMenuElement.style.maxHeight = scrollHeight + "px";
            });
        } else {
            subMenuElement.style.maxHeight = '0';
        }
    }

    _updateParentSubmenuHeights(listItemElement) {
        let currentAncestor = listItemElement.parentElement?.closest('.category-tree__item--has-children');
        let level = 0;
        while (currentAncestor && level < 10) {
            level++;
            const parentSubmenu = currentAncestor.querySelector(':scope > .category-tree__submenu');
            if (parentSubmenu && currentAncestor.getAttribute('aria-expanded') === 'true') {
                parentSubmenu.style.display = 'block';
                requestAnimationFrame(() => {
                    const newParentScrollHeight = parentSubmenu.scrollHeight;
                    parentSubmenu.style.maxHeight = newParentScrollHeight + "px";
                });
            }
            currentAncestor = currentAncestor.parentElement?.closest('.category-tree__item--has-children');
        }
    }

    generateCategoryTree(categoriesHierarchical) {
        const treeContainer = this.elements.categoryTreeList;
        if (!treeContainer) { console.error("FilterPanel: categoryTreeList não encontrado."); return; }
        if (!categoriesHierarchical?.length) {
            treeContainer.innerHTML = '<li class="category-tree__empty-state">Nenhuma categoria para exibir.</li>';
            return;
        }
        treeContainer.innerHTML = ''; 

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
                inputCheckbox.tabIndex = -1; 
                inputCheckbox.addEventListener('change', (e) => this._handleCategoryCheckboxChange(e.target));

                const label = document.createElement('label');
                label.htmlFor = inputCheckbox.id;
                label.className = 'category-tree__label';
                label.textContent = catNode.nome_categoria;
                label.tabIndex = 0; 
                label.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        inputCheckbox.checked = !inputCheckbox.checked;
                        inputCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                        e.preventDefault(); 
                    }
                });

                if (catNode.subcategorias?.length > 0) {
                    listItem.classList.add('category-tree__item--has-children');
                    listItem.setAttribute('aria-expanded', 'false'); 

                    const toggleButton = document.createElement('button');
                    toggleButton.type = 'button';
                    toggleButton.className = 'category-tree__toggle';
                    toggleButton.setAttribute('aria-label', `Expandir categoria ${catNode.nome_categoria}`);
                    toggleButton.setAttribute('aria-expanded', 'false');
                    toggleButton.innerHTML = `<span class="material-symbols-outlined">chevron_right</span>`;
                    
                    labelWrapper.appendChild(toggleButton); 
                    labelWrapper.appendChild(inputCheckbox);
                    labelWrapper.appendChild(label);

                    const subMenu = document.createElement('ul');
                    subMenu.className = 'category-tree__submenu';
                    subMenu.setAttribute('role', 'group');
                    subMenu.style.maxHeight = '0'; 
                    subMenu.style.overflow = 'hidden';
                    subMenu.style.display = 'block'; 
                    
                    createTreeNodes(catNode.subcategorias, subMenu);
                    
                    listItem.appendChild(labelWrapper);
                    listItem.appendChild(subMenu);

                    const toggleAction = (event) => {
                        event.stopPropagation(); 
                        const isCurrentlyExpanded = listItem.getAttribute('aria-expanded') === 'true';
                        listItem.setAttribute('aria-expanded', String(!isCurrentlyExpanded));
                        toggleButton.setAttribute('aria-expanded', String(!isCurrentlyExpanded));
                        toggleButton.setAttribute('aria-label', `${!isCurrentlyExpanded ? 'Recolher' : 'Expandir'} ${catNode.nome_categoria}`);
                        toggleButton.querySelector('.material-symbols-outlined').textContent = !isCurrentlyExpanded ? 'expand_more' : 'chevron_right';
                        this._updateSubmenuHeight(subMenu, !isCurrentlyExpanded);
                        
                        if (!isCurrentlyExpanded) {
                            this._updateParentSubmenuHeights(listItem);
                        }
                    };

                    toggleButton.addEventListener('click', toggleAction);
                    toggleButton.addEventListener('keydown', (e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                            toggleAction(e);
                            e.preventDefault();
                        }
                    });

                } else { 
                    labelWrapper.appendChild(inputCheckbox);
                    labelWrapper.appendChild(label);
                    listItem.appendChild(labelWrapper);
                }
                parentElement.appendChild(listItem);
            });
        };

        createTreeNodes(categoriesHierarchical, treeContainer);
        
        const parentListItems = Array.from(treeContainer.querySelectorAll('.category-tree__item--has-children'));
        for (let i = parentListItems.length - 1; i >= 0; i--) {
            this._updateParentCheckboxState(parentListItems[i]);
        }
    }

    _handleCategoryCheckboxChange(checkboxElement) {
        const isChecked = checkboxElement.checked;
        const listItem = checkboxElement.closest('.category-tree__item');
        if (!listItem) return;

        checkboxElement.classList.remove('is-indeterminate');
        listItem.setAttribute('aria-checked', String(isChecked));

        const childCheckboxes = listItem.querySelectorAll(':scope > .category-tree__submenu .category-tree__input');
        childCheckboxes.forEach(childCb => {
            childCb.checked = isChecked;
            childCb.classList.remove('is-indeterminate'); 
            const childLi = childCb.closest('.category-tree__item');
            if (childLi) childLi.setAttribute('aria-checked', String(isChecked));
        });

        this._updateParentCheckboxState(listItem.parentElement?.closest('.category-tree__item'));
        
        if (this.quizState) {
            this.quizState.activeFiltersForCurrentSet.category_ids = this.getSelectedCategories();
            this.debouncedFetchFilteredQuestionCount();
        }
    }
    
    _updateParentCheckboxState(parentListItem) {
        if (!parentListItem) return; 

        const parentCheckbox = parentListItem.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
        if (!parentCheckbox) return;

        const childListItems = parentListItem.querySelectorAll(':scope > .category-tree__submenu > .category-tree__item');
        if (childListItems.length === 0) return; 

        let todosMarcados = true;
        let nenhumMarcado = true;
        let algumIndeterminado = false;

        childListItems.forEach(childLi => {
            const childInput = childLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
            if (childInput) {
                if (childInput.classList.contains('is-indeterminate')) {
                    algumIndeterminado = true;
                }
                if (childInput.checked || childInput.classList.contains('is-indeterminate')) {
                    nenhumMarcado = false; 
                }
                if (!childInput.checked) { 
                    todosMarcados = false;
                }
            } else { 
                todosMarcados = false;
            }
        });

        parentCheckbox.classList.remove('is-indeterminate'); 

        if (algumIndeterminado || (!todosMarcados && !nenhumMarcado)) {
            parentCheckbox.checked = false; 
            parentCheckbox.classList.add('is-indeterminate');
            parentListItem.setAttribute('aria-checked', 'mixed');
        } else if (todosMarcados) {
            parentCheckbox.checked = true;
            parentListItem.setAttribute('aria-checked', 'true');
        } else { 
            parentCheckbox.checked = false;
            parentListItem.setAttribute('aria-checked', 'false');
        }
        this._updateParentCheckboxState(parentListItem.parentElement?.closest('.category-tree__item'));
    }

    getSelectedCategories() {
        const selectedIds = [];
        this.elements.categoryTreeList?.querySelectorAll('.category-tree__input').forEach(checkbox => {
            if (checkbox.checked && !checkbox.classList.contains('is-indeterminate')) {
                selectedIds.push(checkbox.value);
            }
        });
        return selectedIds;
    }
    
    setCategoryTreeState(selectedCategoryIds = []) {
        const allCategoryCheckboxes = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input') || []);
        if (allCategoryCheckboxes.length === 0 && selectedCategoryIds.length > 0) {
            return;
        }
        
        allCategoryCheckboxes.forEach(cb => {
            cb.checked = selectedCategoryIds.includes(cb.value);
            cb.classList.remove('is-indeterminate'); 
            const li = cb.closest('.category-tree__item');
            if (li) li.setAttribute('aria-checked', String(cb.checked));
        });
        const parentListItems = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
        for (let i = parentListItems.length - 1; i >= 0; i--) {
            this._updateParentCheckboxState(parentListItems[i]);
        }
    }

    getSelectedDifficulties() {
        const difficultyCheckboxes = this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])');
        const selectedSpecificDifficulties = [];
        difficultyCheckboxes?.forEach(cb => { if (cb.checked) selectedSpecificDifficulties.push(cb.value); });
        const allDifficultiesCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        if (allDifficultiesCheckbox?.checked || selectedSpecificDifficulties.length === 0) {
            return ['all'];
        }
        return selectedSpecificDifficulties;
    }

    setDifficultyState(difficulties = ['all']) {
        const allDifficultiesCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        const specificDifficultyCheckboxes = Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])') || []);
        if (!allDifficultiesCheckbox && specificDifficultyCheckboxes.length === 0) return;
        const useAll = difficulties.includes('all') || difficulties.length === 0;
        if (allDifficultiesCheckbox) allDifficultiesCheckbox.checked = useAll;
        specificDifficultyCheckboxes.forEach(cb => {
            cb.checked = !useAll && difficulties.includes(cb.value);
        });
        if (!useAll && !specificDifficultyCheckboxes.some(cb => cb.checked) && allDifficultiesCheckbox) {
            allDifficultiesCheckbox.checked = true;
        }
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

    setNumberOfQuestionsState(numQuestions) {
        if (this.elements.numQuestionsInput) {
            this.elements.numQuestionsInput.value = (numQuestions && numQuestions > 0) ? numQuestions.toString() : '';
        }
    }
}