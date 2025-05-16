// File: assets/js/ui/FilterPanel.js

import { TRANSITION_DURATION } from '../utils/constants.js';

export default class FilterPanel {
    constructor(filterPanelElement, quizLogicInstance, quizStateInstance, quizDataInstance, quizUIInstance) {
        console.log("FILTERPANEL.JS: Constructor - Iniciando. Elemento do painel:", filterPanelElement);
        if (!filterPanelElement) {
            console.error("FilterPanel: O elemento principal do painel de filtros não foi fornecido.");
            return;
        }
        this.panelElement = filterPanelElement;
        this.quizLogic = quizLogicInstance;
        this.quizState = quizStateInstance;
        this.quizData = quizDataInstance;
        this.quizUI = quizUIInstance;

        this._cacheOwnElements();
        console.log("FILTERPANEL.JS: Constructor - Elementos internos cacheados. categoryTreeList:", this.elements.categoryTreeList);
    }

    _cacheOwnElements() {
        this.elements = {
            categoryTreeList: this.panelElement.querySelector('#category-tree-list'),
            btnCatSelectAll: this.panelElement.querySelector('#btn-cat-select-all'),
            btnCatClearAll: this.panelElement.querySelector('#btn-cat-clear-all'),
            btnLimparFiltrosPainel: this.panelElement.querySelector('#btn-limpar-filtros-painel'),
            btnAplicarFiltrosPainel: this.panelElement.querySelector('#btn-aplicar-filtros-painel'),
            filterGroupDifficulty: this.panelElement.querySelector('#filter-group-difficulty'),
        };
    }

    setupEventListeners() {
        console.log("FILTERPANEL.JS: setupEventListeners - Configurando listeners internos do painel.");
        this.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => {
            console.log("FILTERPANEL.JS Event: Botão 'Aplicar Filtros' CLICADO.");
            if (this.quizLogic) {
                this.quizLogic.applyFiltersAndStartQuiz();
            } else {
                console.error("FILTERPANEL.JS: quizLogic não definido ao tentar aplicar filtros.");
            }
        });

        this.elements.btnLimparFiltrosPainel?.addEventListener('click', () => {
            console.log("FILTERPANEL.JS Event: Botão 'Limpar Filtros' (painel) CLICADO.");
            this.resetFiltersToDefault();
        });

        this.elements.btnCatSelectAll?.addEventListener('click', () => {
            console.log("FILTERPANEL.JS Event: Botão 'Selecionar Todas Categorias' CLICADO.");
            if (this.quizData && this.elements.categoryTreeList.hasChildNodes()) { // Só define se a árvore já foi gerada
                this.setCategoryTreeState(this.quizData.getCategorias().map(c => c.id_categoria.toString()));
            } else if (!this.quizData) {
                console.warn("FILTERPANEL.JS: quizData não disponível para selecionar todas as categorias.");
            } else {
                console.warn("FILTERPANEL.JS: 'Selecionar Todas' clicado, mas a árvore de categorias parece vazia. A árvore deve ser gerada primeiro por loadCurrentFilters.");
            }
        });

        this.elements.btnCatClearAll?.addEventListener('click', () => {
            console.log("FILTERPANEL.JS Event: Botão 'Limpar Todas Categorias' CLICADO.");
            this.setCategoryTreeState([]);
        });

        const diffInputs = this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]');
        const allDiffCb = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        diffInputs?.forEach(input => {
            input.addEventListener('change', () => {
                console.log(`FILTERPANEL.JS Event: Checkbox de dificuldade '${input.value}' alterado para ${input.checked}.`);
                if (input.value === 'all' && input.checked) {
                    diffInputs.forEach(other => { if (other.value !== 'all') other.checked = false; });
                } else if (input.value !== 'all' && input.checked) {
                    if (allDiffCb) allDiffCb.checked = false;
                }
                const anySpecificChecked = Array.from(diffInputs).some(cb => cb.value !== 'all' && cb.checked);
                if (!anySpecificChecked && allDiffCb && !allDiffCb.checked) {
                    allDiffCb.checked = true;
                }
                if (this.quizState) {
                    this.quizState.activeFiltersForCurrentSet.difficulty_levels = this.getSelectedDifficulties();
                    console.log("FILTERPANEL.JS: Filtros de dificuldade no QuizState atualizados para:", this.quizState.activeFiltersForCurrentSet.difficulty_levels);
                }
            });
        });
         console.log("FILTERPANEL.JS: setupEventListeners - Listeners internos configurados.");
    }

    loadCurrentFilters() {
        console.log("FILTERPANEL.JS: loadCurrentFilters - INICIADO. Tentando carregar filtros atuais para o painel.");
        if (this.quizState) {
            console.log("FILTERPANEL.JS: loadCurrentFilters - Carregando filtros do QuizState:", JSON.parse(JSON.stringify(this.quizState.activeFiltersForCurrentSet)));
            // A chamada para setCategoryTreeState foi movida para DEPOIS da geração da árvore
            this.setDifficultyState(this.quizState.activeFiltersForCurrentSet.difficulty_levels);
        } else {
            console.warn("FILTERPANEL.JS: loadCurrentFilters - QuizState não disponível. Filtros não podem ser carregados do estado.");
        }

        // Lógica para gerar/regerar a árvore de categorias
        if (this.quizData && this.elements.categoryTreeList) {
            const categorias = this.quizData.getCategorias();
            console.log("FILTERPANEL.JS: loadCurrentFilters - QuizData disponível. Total de categorias planas:", categorias.length);

            if (categorias.length > 0) {
                console.log("FILTERPANEL.JS: loadCurrentFilters - Há categorias para processar. Tentando gerar/regerar a árvore.");
                const categoriasHierarquicas = this.quizData.getCategoriasHierarquicamente();
                console.log("FILTERPANEL.JS: loadCurrentFilters - Categorias hierárquicas recebidas para gerar árvore:",
                    categoriasHierarquicas ? categoriasHierarquicas.length : "Nenhuma", "categorias raiz.",
                    categoriasHierarquicas?.length > 0 ? JSON.parse(JSON.stringify(categoriasHierarquicas.slice(0,2))) : "Array vazio"
                );

                if (categoriasHierarquicas && categoriasHierarquicas.length > 0) {
                    this.generateCategoryTree(categoriasHierarquicas); // Gera/Regera a árvore
                    console.log("FILTERPANEL.JS: loadCurrentFilters - Chamada para generateCategoryTree CONCLUÍDA.");
                    // Após gerar/regerar a árvore, reaplica o estado dos checkboxes selecionados
                    if (this.quizState) {
                         console.log("FILTERPANEL.JS: loadCurrentFilters - Reaplicando estado da árvore de categorias após geração com IDs:", JSON.parse(JSON.stringify(this.quizState.activeFiltersForCurrentSet.category_ids)));
                        this.setCategoryTreeState(this.quizState.activeFiltersForCurrentSet.category_ids);
                    }
                } else {
                    console.warn("FILTERPANEL.JS: loadCurrentFilters - Nenhuma categoria hierárquica retornada para gerar a árvore.");
                    this.elements.categoryTreeList.innerHTML = '<li style="padding: 8px; color: var(--color-text-muted); font-style: italic;">Nenhuma categoria para filtrar.</li>';
                }
            } else {
                console.warn("FILTERPANEL.JS: loadCurrentFilters - QuizData não tem categorias. Árvore não será populada.");
                this.elements.categoryTreeList.innerHTML = '<li style="padding: 8px; color: var(--color-text-muted); font-style: italic;">Categorias indisponíveis no momento.</li>';
            }
        } else {
            console.warn("FILTERPANEL.JS: loadCurrentFilters - QuizData ou categoryTreeList não disponível. Árvore não será populada.");
            if (this.elements.categoryTreeList) {
                 this.elements.categoryTreeList.innerHTML = '<li style="padding: 8px; color: var(--color-text-muted); font-style: italic;">Erro ao carregar categorias.</li>';
            }
        }
        console.log("FILTERPANEL.JS: loadCurrentFilters - FINALIZADO.");
    }


    resetFiltersToDefault() {
        console.log("FILTERPANEL.JS: resetFiltersToDefault - Resetando filtros para o padrão.");
        this.setCategoryTreeState([]);
        this.setDifficultyState(['all']);

        if (this.quizState) {
            this.quizState.activeFiltersForCurrentSet.category_ids = [];
            this.quizState.activeFiltersForCurrentSet.difficulty_levels = ['all'];
            console.log("FILTERPANEL.JS: resetFiltersToDefault - Filtros no QuizState resetados:", JSON.parse(JSON.stringify(this.quizState.activeFiltersForCurrentSet)));
        }
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
        console.log("FILTERPANEL.JS: generateCategoryTree - INICIADO. Recebeu categorias hierárquicas:",
            categoriesHierarchical ? categoriesHierarchical.length : "Nenhuma", "categorias raiz.",
            categoriesHierarchical?.length > 0 ? JSON.parse(JSON.stringify(categoriesHierarchical.slice(0,1))) : "Array vazio"
        );
        const treeContainer = this.elements.categoryTreeList;
        if (!treeContainer) {
            console.error("FILTERPANEL.JS: generateCategoryTree - ERRO CRÍTICO: Container da árvore (categoryTreeList) NÃO ENCONTRADO no DOM.");
            return;
        }
        if (!categoriesHierarchical || !Array.isArray(categoriesHierarchical) || categoriesHierarchical.length === 0) {
            console.warn("FILTERPANEL.JS: generateCategoryTree - Nenhuma categoria hierárquica fornecida ou array vazio. Árvore não será gerada.");
            treeContainer.innerHTML = '<li style="padding: 8px; color: var(--color-text-muted); font-style: italic;">Nenhuma categoria para exibir nos filtros.</li>';
            return;
        }

        treeContainer.innerHTML = ''; // Limpa conteúdo anterior

        const createTreeNodes = (nodes, parentElement, level = 0) => {
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
                    subMenu.style.overflow = 'hidden';
                    subMenu.style.display = 'block';

                    createTreeNodes(catNode.subcategorias, subMenu, level + 1);
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
                        if (newExpandedState) {
                            subMenu.classList.add('category-tree__submenu--expanded');
                        } else {
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
                        if (event.key === ' ' || event.key === 'Enter') {
                            toggleAction(event);
                            event.preventDefault();
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

        const parentListItems = Array.from(treeContainer.querySelectorAll('.category-tree__item--has-children') || []);
        for (let i = parentListItems.length - 1; i >= 0; i--) {
            this._updateParentCheckboxState(parentListItems[i]);
        }
        console.log("FILTERPANEL.JS: generateCategoryTree - Árvore de categorias GERADA e adicionada ao DOM.");
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
                    todosMarcados = false;
                    nenhumMarcado = false;
                } else if (childInput.checked) {
                    nenhumMarcado = false;
                } else {
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
        console.log("FILTERPANEL.JS: setCategoryTreeState - Definindo estado da árvore com IDs selecionados:", selectedCategoryIds);
        const allCategoryCheckboxes = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input') || []);

        if (allCategoryCheckboxes.length === 0) { // Modificado: Verifica se a árvore está vazia
            console.warn("FILTERPANEL.JS: setCategoryTreeState - Árvore de categorias está vazia no DOM. Não é possível definir estado dos checkboxes.");
            // Isso pode acontecer se setCategoryTreeState for chamado ANTES de generateCategoryTree popular a árvore.
            // A lógica em loadCurrentFilters agora tenta chamar setCategoryTreeState APÓS generateCategoryTree.
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
        console.log("FILTERPANEL.JS: setDifficultyState - Definindo estado de dificuldade para:", difficulties);
        const allDifficultiesCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        const specificDifficultyCheckboxes = Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])') || []);

        if (!allDifficultiesCheckbox && specificDifficultyCheckboxes.length === 0) {
            console.warn("FILTERPANEL.JS: setDifficultyState - Nenhum checkbox de dificuldade encontrado no DOM.");
            return;
        }

        if (difficulties.includes('all')) {
            if (allDifficultiesCheckbox) allDifficultiesCheckbox.checked = true;
            specificDifficultyCheckboxes.forEach(cb => cb.checked = false);
        } else {
            if (allDifficultiesCheckbox) allDifficultiesCheckbox.checked = false;
            specificDifficultyCheckboxes.forEach(cb => {
                cb.checked = difficulties.includes(cb.value);
            });
            const anySpecificChecked = specificDifficultyCheckboxes.some(cb => cb.checked);
            if (!anySpecificChecked && allDifficultiesCheckbox && !allDifficultiesCheckbox.checked) {
                allDifficultiesCheckbox.checked = true;
                 console.log("FILTERPANEL.JS: setDifficultyState - Nenhuma dificuldade específica selecionada, marcando 'Todas' por padrão.");
            }
        }
    }
}