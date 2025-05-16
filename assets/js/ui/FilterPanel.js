// File: assets/js/ui/FilterPanel.js

import { TRANSITION_DURATION } from '../utils/constants.js';

export default class FilterPanel {
    constructor(filterPanelElement, quizLogicInstance, quizStateInstance, quizDataInstance, quizUIInstance) {
        if (!filterPanelElement) {
            console.error("FilterPanel: O elemento principal do painel de filtros não foi fornecido.");
            return;
        }
        this.panelElement = filterPanelElement; // O elemento <aside class="filter-panel">
        this.quizLogic = quizLogicInstance;
        this.quizState = quizStateInstance;   // Para saber os filtros ativos atuais
        this.quizData = quizDataInstance;     // Para obter a lista de todas as categorias
        this.quizUI = quizUIInstance;         // Para interações como fechar o painel

        this._cacheOwnElements();
    }

    _cacheOwnElements() {
        this.elements = {
            // Elementos internos do painel
            categoryTreeList: this.panelElement.querySelector('#category-tree-list'),
            btnCatSelectAll: this.panelElement.querySelector('#btn-cat-select-all'),
            btnCatClearAll: this.panelElement.querySelector('#btn-cat-clear-all'),
            btnLimparFiltrosPainel: this.panelElement.querySelector('#btn-limpar-filtros-painel'),
            btnAplicarFiltrosPainel: this.panelElement.querySelector('#btn-aplicar-filtros-painel'),
            filterGroupDifficulty: this.panelElement.querySelector('#filter-group-difficulty'),
            // Os botões btnFecharFiltros e filterPanelOverlay são gerenciados por QuizUI
        };
    }

    // Este método é chamado por App.js ou QuizUI para configurar os listeners internos
    setupEventListeners() {
        this.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => {
            this.quizLogic.applyFiltersAndStartQuiz(); // QuizLogic obterá os filtros deste painel
        });

        this.elements.btnLimparFiltrosPainel?.addEventListener('click', () => {
            this.resetFiltersToDefault(); // Limpa visualmente e o QuizLogic pode precisar ser notificado
            // Opcionalmente, pode chamar applyFiltersAndStartQuiz aqui se limpar deve auto-aplicar
        });

        this.elements.btnCatSelectAll?.addEventListener('click', () => {
            if (this.quizData) {
                this.setCategoryTreeState(this.quizData.getCategorias().map(c => c.id_categoria.toString()));
            }
        });

        this.elements.btnCatClearAll?.addEventListener('click', () => {
            this.setCategoryTreeState([]);
        });

        const diffInputs = this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]');
        const allDiffCb = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        diffInputs?.forEach(input => {
            input.addEventListener('change', () => {
                if (input.value === 'all' && input.checked) {
                    diffInputs.forEach(other => { if (other.value !== 'all') other.checked = false; });
                } else if (input.value !== 'all' && input.checked) {
                    if (allDiffCb) allDiffCb.checked = false;
                }
                const anySpecificChecked = Array.from(diffInputs).some(cb => cb.value !== 'all' && cb.checked);
                if (!anySpecificChecked && allDiffCb && !allDiffCb.checked) {
                    allDiffCb.checked = true;
                }
                // Notifica o QuizState sobre a mudança para que possa ser refletido se o painel for reaberto
                if (this.quizState) {
                    this.quizState.activeFiltersForCurrentSet.difficulty_levels = this.getSelectedDifficulties();
                }
            });
        });
    }

    // Chamado quando o painel é aberto para refletir o estado atual dos filtros
    loadCurrentFilters() {
        if (this.quizState) {
            this.setCategoryTreeState(this.quizState.activeFiltersForCurrentSet.category_ids);
            this.setDifficultyState(this.quizState.activeFiltersForCurrentSet.difficulty_levels);
        }
        if (this.quizData && this.quizData.getCategorias().length > 0 && !this.elements.categoryTreeList.hasChildNodes()) {
             this.generateCategoryTree(this.quizData.getCategoriasHierarquicamente());
        }
    }

    resetFiltersToDefault() {
        this.setCategoryTreeState([]);
        this.setDifficultyState(['all']);
        if (this.quizState) {
            this.quizState.activeFiltersForCurrentSet.category_ids = [];
            this.quizState.activeFiltersForCurrentSet.difficulty_levels = ['all'];
        }
    }

    // --- Métodos de Manipulação da Árvore de Categorias (movidos de QuizUI) ---
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
        if (!treeContainer) return;
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

                if (catNode.subcategorias && catNode.subcategorias.length > 0) {
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
                    subMenu.style.display = 'block';
                    subMenu.style.overflow = 'hidden';
                    createTreeNodes(catNode.subcategorias, subMenu);
                    listItem.appendChild(labelWrapper);
                    listItem.appendChild(subMenu);
                    const toggleAction = (event) => {
                        event.stopPropagation();
                        const isCurrentlyExpanded = listItem.getAttribute('aria-expanded') === 'true';
                        const newExpandedState = !isCurrentlyExpanded;
                        listItem.setAttribute('aria-expanded', String(newExpandedState));
                        toggleButton.setAttribute('aria-expanded', String(newExpandedState));
                        toggleButton.setAttribute('aria-label', `${newExpandedState ? 'Recolher' : 'Expandir'} categoria ${catNode.nome_categoria}`);
                        toggleButton.querySelector('.material-symbols-outlined').textContent = newExpandedState ? 'expand_more' : 'chevron_right';
                        this._updateSubmenuHeight(subMenu, newExpandedState);
                        if (newExpandedState) subMenu.classList.add('category-tree__submenu--expanded');
                        else {
                            setTimeout(() => {
                                if (listItem.getAttribute('aria-expanded') === 'false') {
                                    subMenu.classList.remove('category-tree__submenu--expanded');
                                }
                            }, TRANSITION_DURATION);
                        }
                        this._updateParentSubmenuHeights(listItem);
                    };
                    toggleButton.addEventListener('click', toggleAction);
                    toggleButton.addEventListener('keydown', (event) => {
                        if (event.key === ' ' || event.key === 'Enter') { toggleAction(event); event.preventDefault(); }
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
        const parentListItems = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
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
        if (this.quizState) { // Atualiza o QuizState
            this.quizState.activeFiltersForCurrentSet.category_ids = this.getSelectedCategories();
        }
    }

    _updateParentCheckboxState(parentListItem) {
        if (!parentListItem) return;
        const parentCheckbox = parentListItem.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
        if (!parentCheckbox) return;
        const childListItems = parentListItem.querySelectorAll(':scope > .category-tree__submenu > .category-tree__item');
        if (childListItems.length === 0) return;
        let todosMarcados = true; let nenhumMarcado = true; let algumIndeterminado = false;
        childListItems.forEach(childLi => {
            const childInput = childLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
            if (childInput) {
                if (childInput.classList.contains('is-indeterminate')) { algumIndeterminado = true; todosMarcados = false; nenhumMarcado = false; }
                else if (childInput.checked) { nenhumMarcado = false; }
                else { todosMarcados = false; }
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

    getSelectedCategories() { // Renomeado de getSelectedCategoriesFromTree
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
        if (this.quizState) { // Atualiza o QuizState
            this.quizState.activeFiltersForCurrentSet.category_ids = selectedCategoryIds;
        }
    }

    getSelectedDifficulties() {
        const difficultyCheckboxes = this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])');
        const selectedSpecificDifficulties = [];
        difficultyCheckboxes?.forEach(cb => {
            if (cb.checked) selectedSpecificDifficulties.push(cb.value);
        });
        const allDifficultiesCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        if (allDifficultiesCheckbox?.checked || selectedSpecificDifficulties.length === 0) {
            return ['all'];
        }
        return selectedSpecificDifficulties;
    }

    setDifficultyState(difficulties = ['all']) {
        const allDifficultiesCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        const specificDifficultyCheckboxes = Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])') || []);
        if (difficulties.includes('all')) {
            if (allDifficultiesCheckbox) allDifficultiesCheckbox.checked = true;
            specificDifficultyCheckboxes.forEach(cb => cb.checked = false);
        } else {
            if (allDifficultiesCheckbox) allDifficultiesCheckbox.checked = false;
            specificDifficultyCheckboxes.forEach(cb => {
                cb.checked = difficulties.includes(cb.value);
            });
        }
        if (this.quizState) { // Atualiza o QuizState
            this.quizState.activeFiltersForCurrentSet.difficulty_levels = difficulties;
        }
    }
}