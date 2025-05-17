// File: assets/js/ui/FilterPanel.js

import { TRANSITION_DURATION } from '../utils/constants.js';
import { debounce } from '../utils/helpers.js';

export default class FilterPanel {
    constructor(filterPanelElement, quizLogicInstance, quizStateInstance, quizDataInstance, quizUIInstance, apiServiceInstance) {
        console.log("FILTERPANEL.JS: Constructor - Iniciando FilterPanel.");
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
        this.debouncedFetchFilteredQuestionCount = debounce(this._fetchFilteredQuestionCount.bind(this), 650); // Ajuste o delay conforme necessário

        this._cacheOwnElements();
        // A chamada para setupEventListeners é feita no App.js após todas as instâncias estarem prontas.
    }

    _cacheOwnElements() {
        this.elements = {
            // Elementos da árvore de categorias e controles
            categoryTreeList: this.panelElement.querySelector('#category-tree-list'),
            btnCatSelectAll: this.panelElement.querySelector('#btn-cat-select-all'),
            btnCatClearAll: this.panelElement.querySelector('#btn-cat-clear-all'),

            // Elementos do filtro de dificuldade
            filterGroupDifficulty: this.panelElement.querySelector('#filter-group-difficulty'),
            
            // Elementos para o input de número de questões com steppers
            numQuestionsInput: this.panelElement.querySelector('#num-questions-input'),
            btnNumDecrement: this.panelElement.querySelector('.numeric-stepper__button--decrement'),
            btnNumIncrement: this.panelElement.querySelector('.numeric-stepper__button--increment'),
            numQuestionsFeedbackText: this.panelElement.querySelector('#num-questions-feedback'), // O <small> para feedback

            // Botões do rodapé do painel
            btnLimparFiltrosPainel: this.panelElement.querySelector('#btn-limpar-filtros-painel'),
            btnAplicarFiltrosPainel: this.panelElement.querySelector('#btn-aplicar-filtros-painel'),
        };
        console.log("FILTERPANEL.JS _cacheOwnElements: Elementos cacheados. numQuestionsInput:", this.elements.numQuestionsInput);
    }

    setupEventListeners() {
        console.log("FILTERPANEL.JS: setupEventListeners - Configurando listeners do painel.");

        // Botões do rodapé
        this.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => {
            if (this.quizLogic) this.quizLogic.applyFiltersAndStartQuiz();
        });
        this.elements.btnLimparFiltrosPainel?.addEventListener('click', () => this.resetFiltersToDefault());

        // Controles da árvore de categorias
        this.elements.btnCatSelectAll?.addEventListener('click', () => {
            if (this.quizData && this.elements.categoryTreeList.hasChildNodes()) {
                const allCategoryIds = this.quizData.getCategorias().map(c => c.id_categoria.toString());
                this.setCategoryTreeState(allCategoryIds);
                if (this.quizState) this.quizState.activeFiltersForCurrentSet.category_ids = allCategoryIds;
                this.debouncedFetchFilteredQuestionCount();
            }
        });
        this.elements.btnCatClearAll?.addEventListener('click', () => {
            this.setCategoryTreeState([]);
            if (this.quizState) this.quizState.activeFiltersForCurrentSet.category_ids = [];
            this.debouncedFetchFilteredQuestionCount();
        });

        // Listener na árvore de categorias (delegação)
        this.elements.categoryTreeList?.addEventListener('change', (event) => {
            if (event.target?.type === 'checkbox' && event.target.classList.contains('category-tree__input')) {
                // _handleCategoryCheckboxChange já atualiza o QuizState
                this.debouncedFetchFilteredQuestionCount();
            }
        });

        // Listeners para chips de dificuldade
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
                this.debouncedFetchFilteredQuestionCount();
            });
        });

        // Listeners para o input de número de questões e seus botões stepper
        this.elements.numQuestionsInput?.addEventListener('input', (event) => {
            this._validateNumQuestionsInput(event.target);
            if (this.quizState) this.quizState.activeFiltersForCurrentSet.num_questions = this.getSelectedNumberOfQuestions();
        });
        this.elements.numQuestionsInput?.addEventListener('blur', (event) => { // Validar também ao perder o foco
            this._validateNumQuestionsInput(event.target);
             if (this.quizState) this.quizState.activeFiltersForCurrentSet.num_questions = this.getSelectedNumberOfQuestions();
        });

        this.elements.btnNumDecrement?.addEventListener('click', () => {
            if (this.elements.numQuestionsInput) {
                let currentValue = parseInt(this.elements.numQuestionsInput.value, 10);
                const min = parseInt(this.elements.numQuestionsInput.min, 10) || 1;
                
                if (isNaN(currentValue) || currentValue <= min) {
                    this.elements.numQuestionsInput.value = ""; // Limpa para "todas" se já no mínimo ou inválido
                } else {
                    this.elements.numQuestionsInput.value = (currentValue - 1).toString();
                }
                // Dispara o evento 'input' para que o listener do input e a validação sejam acionados
                this.elements.numQuestionsInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        this.elements.btnNumIncrement?.addEventListener('click', () => {
            if (this.elements.numQuestionsInput) {
                let currentValue = parseInt(this.elements.numQuestionsInput.value, 10) || 0; // Se vazio, começa do 0 para lógica abaixo
                const min = parseInt(this.elements.numQuestionsInput.min, 10) || 1;
                const maxStr = this.elements.numQuestionsInput.getAttribute('max');
                const max = maxStr ? parseInt(maxStr, 10) : Infinity; // Se não houver max, permite incrementar

                if (currentValue < min) { // Se estava vazio ou 0, e clicou em +, começa do min (ou 1)
                    currentValue = min;
                } else {
                    currentValue += 1;
                }
                
                this.elements.numQuestionsInput.value = Math.min(max, currentValue).toString();
                this.elements.numQuestionsInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        console.log("FILTERPANEL.JS: setupEventListeners - Listeners configurados.");
    }

    async _fetchFilteredQuestionCount() {
        if (this.isFetchingCount || !this.apiService) {
            if(!this.apiService) console.error("FilterPanel: ApiService indisponível para buscar contagem.");
            return;
        }
        this.isFetchingCount = true;
        console.log("FilterPanel: Buscando contagem de questões...");

        const countFilterParams = {
            category_ids: this.quizState?.activeFiltersForCurrentSet?.category_ids || [],
            difficulty_levels: this.quizState?.activeFiltersForCurrentSet?.difficulty_levels || ['all'],
        };

        try {
            const data = await this.apiService.fetchQuizData(countFilterParams);
            const maxQuestions = (data?.perguntas?.length) || 0; // Garante que seja um número
            console.log(`FilterPanel: Contagem de questões disponíveis: ${maxQuestions}`);
            this._updateNumQuestionsInputConstraints(maxQuestions);
        } catch (error) {
            console.error("FilterPanel: Erro ao buscar contagem de questões:", error);
            this._updateNumQuestionsInputConstraints(null); // null indica erro ou contagem desconhecida
        } finally {
            this.isFetchingCount = false;
        }
    }

    _updateNumQuestionsInputConstraints(maxQuestions) {
        const input = this.elements.numQuestionsInput;
        const feedbackTextEl = this.elements.numQuestionsFeedbackText;
        
        if (!input || !feedbackTextEl) return;

        const defaultPlaceholder = "Qtd."; // Placeholder bem curto para o input com steppers
        const defaultFeedback = "Deixe em branco ou 0 para incluir todas as questões dos filtros.";

        if (maxQuestions !== null && maxQuestions >= 0) { // maxQuestions pode ser 0
            input.setAttribute('max', maxQuestions.toString());
            input.placeholder = maxQuestions > 0 ? `Máx: ${maxQuestions}` : "0"; // Se max é 0, placeholder é "0"
            
            feedbackTextEl.textContent = maxQuestions > 0 
                ? `Disponíveis: ${maxQuestions}`
                : "Nenhuma questão encontrada para os filtros selecionados.";
            this._validateNumQuestionsInput(input); // Valida o valor atual contra o novo max
        } else { // Erro ao buscar contagem
            input.removeAttribute('max');
            input.placeholder = defaultPlaceholder;
            feedbackTextEl.textContent = "Erro ao carregar contagem. " + defaultFeedback;
        }
    }
    
    _validateNumQuestionsInput(inputElement) {
        if (!inputElement) return;
        let currentValueStr = inputElement.value.trim();
        
        if (currentValueStr === "") return; // Permite campo vazio (significa "todas")

        let currentValue = parseInt(currentValueStr, 10);
        const min = parseInt(inputElement.min, 10) || 1; // min definido no HTML é 1
        const maxStr = inputElement.getAttribute('max');
        // Só considera o max se ele for um número válido e >= 0
        const max = (maxStr && !isNaN(parseInt(maxStr, 10)) && parseInt(maxStr, 10) >= 0) ? parseInt(maxStr, 10) : null;


        if (isNaN(currentValue)) {
            inputElement.value = ""; // Limpa se não for número
            return;
        }

        if (currentValue <= 0) { 
            inputElement.value = ""; // Trata 0 ou negativo como "todas" limpando o campo
            return;
        }

        if (max !== null && currentValue > max) {
            inputElement.value = max.toString(); // Corrige para o máximo se exceder
        }
    }

    loadCurrentFilters() {
        console.log("FILTERPANEL.JS: loadCurrentFilters - INICIADO.");
        const filters = this.quizState?.activeFiltersForCurrentSet || { difficulty_levels: ['all'], category_ids: [], num_questions: null };
        
        console.log("FILTERPANEL.JS: loadCurrentFilters - Carregando com filtros:", JSON.parse(JSON.stringify(filters)));
        this.setDifficultyState(filters.difficulty_levels);
        this.setNumberOfQuestionsState(filters.num_questions);
        
        if (this.quizData && this.elements.categoryTreeList) {
            const categorias = this.quizData.getCategorias();
            if (categorias.length > 0) {
                const categoriasHierarquicas = this.quizData.getCategoriasHierarquicamente();
                if (categoriasHierarquicas && categoriasHierarquicas.length > 0) {
                    this.generateCategoryTree(categoriasHierarquicas);
                    this.setCategoryTreeState(filters.category_ids);
                    this.debouncedFetchFilteredQuestionCount(); 
                } else {
                    this.elements.categoryTreeList.innerHTML = '<li class="category-tree__empty-state">Nenhuma categoria para filtrar.</li>';
                    this._updateNumQuestionsInputConstraints(0);
                }
            } else {
                this.elements.categoryTreeList.innerHTML = '<li class="category-tree__empty-state">Categorias indisponíveis.</li>';
                this._updateNumQuestionsInputConstraints(0);
            }
        } else {
             if (this.elements.categoryTreeList) {
                 this.elements.categoryTreeList.innerHTML = '<li class="category-tree__empty-state">Erro ao carregar categorias.</li>';
            }
            this._updateNumQuestionsInputConstraints(null);
        }
        console.log("FILTERPANEL.JS: loadCurrentFilters - FINALIZADO.");
    }

    resetFiltersToDefault() {
        console.log("FILTERPANEL.JS: resetFiltersToDefault - Resetando filtros.");
        this.setCategoryTreeState([]);
        this.setDifficultyState(['all']);
        this.setNumberOfQuestionsState(null); 

        if (this.quizState) {
            this.quizState.activeFiltersForCurrentSet.category_ids = [];
            this.quizState.activeFiltersForCurrentSet.difficulty_levels = ['all'];
            this.quizState.activeFiltersForCurrentSet.num_questions = null;
        }
        this.debouncedFetchFilteredQuestionCount(); 
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
                listItem.setAttribute('aria-checked', 'false');
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
                    subMenu.style.maxHeight = '0'; subMenu.style.overflow = 'hidden'; subMenu.style.display = 'block';
                    createTreeNodes(catNode.subcategorias, subMenu);
                    listItem.appendChild(labelWrapper); listItem.appendChild(subMenu);
                    const toggleAction = (event) => {
                        event.stopPropagation();
                        const isExp = listItem.getAttribute('aria-expanded') === 'true';
                        listItem.setAttribute('aria-expanded', String(!isExp));
                        toggleButton.setAttribute('aria-expanded', String(!isExp));
                        toggleButton.setAttribute('aria-label', `${!isExp ? 'Recolher' : 'Expandir'} ${catNode.nome_categoria}`);
                        toggleButton.querySelector('.material-symbols-outlined').textContent = !isExp ? 'expand_more' : 'chevron_right';
                        this._updateSubmenuHeight(subMenu, !isExp);
                        if (!isExp) subMenu.classList.add('category-tree__submenu--expanded');
                        else setTimeout(() => { if (listItem.getAttribute('aria-expanded') === 'false') subMenu.classList.remove('category-tree__submenu--expanded'); }, TRANSITION_DURATION);
                        this._updateParentSubmenuHeights(listItem);
                    };
                    toggleButton.addEventListener('click', toggleAction);
                    toggleButton.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { toggleAction(e); e.preventDefault(); }});
                } else {
                    labelWrapper.appendChild(inputCheckbox); labelWrapper.appendChild(label); listItem.appendChild(labelWrapper);
                }
                parentElement.appendChild(listItem);
            });
        };
        createTreeNodes(categoriesHierarchical, treeContainer);
        const parentListItems = Array.from(treeContainer.querySelectorAll('.category-tree__item--has-children'));
        for (let i = parentListItems.length - 1; i >= 0; i--) this._updateParentCheckboxState(parentListItems[i]);
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
            // A chamada para debouncedFetchFilteredQuestionCount é feita pelo listener geral na árvore.
        }
    }

    _updateParentCheckboxState(parentListItem) {
        if (!parentListItem) return;
        const parentCheckbox = parentListItem.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
        if (!parentCheckbox) return;
        const childListItems = parentListItem.querySelectorAll(':scope > .category-tree__submenu > .category-tree__item');
        if (childListItems.length === 0) return;
        let todosMarcados = true, nenhumMarcado = true, algumIndeterminado = false;
        childListItems.forEach(childLi => {
            const childInput = childLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
            if (childInput) {
                if (childInput.classList.contains('is-indeterminate')) algumIndeterminado = true;
                if (childInput.checked || childInput.classList.contains('is-indeterminate')) nenhumMarcado = false;
                if (!childInput.checked) todosMarcados = false;
            } else { todosMarcados = false; }
        });
        parentCheckbox.classList.remove('is-indeterminate');
        if (algumIndeterminado || (!todosMarcados && !nenhumMarcado)) {
            parentCheckbox.checked = false; parentCheckbox.classList.add('is-indeterminate'); parentListItem.setAttribute('aria-checked', 'mixed');
        } else if (todosMarcados) {
            parentCheckbox.checked = true; parentListItem.setAttribute('aria-checked', 'true');
        } else {
            parentCheckbox.checked = false; parentListItem.setAttribute('aria-checked', 'false');
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
        if (allCategoryCheckboxes.length === 0 && selectedCategoryIds.length > 0) return;
        allCategoryCheckboxes.forEach(cb => {
            cb.checked = selectedCategoryIds.includes(cb.value);
            cb.classList.remove('is-indeterminate');
            const li = cb.closest('.category-tree__item');
            if (li) li.setAttribute('aria-checked', String(cb.checked));
        });
        const parentListItems = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
        for (let i = parentListItems.length - 1; i >= 0; i--) this._updateParentCheckboxState(parentListItems[i]);
    }

    getSelectedDifficulties() {
        const difficultyCheckboxes = this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])');
        const selectedSpecificDifficulties = [];
        difficultyCheckboxes?.forEach(cb => { if (cb.checked) selectedSpecificDifficulties.push(cb.value); });
        const allDifficultiesCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        if (allDifficultiesCheckbox?.checked || selectedSpecificDifficulties.length === 0) return ['all'];
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