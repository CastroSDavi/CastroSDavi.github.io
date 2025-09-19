// assets/js/ui/FavoriteManager.js

export default class FavoriteManager {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements;
        
        this.store = null;
        this.actionOrchestrator = null;
        
        this.hasInitialized = false; // <-- ALTERAÇÃO: Guarda de inicialização
        this.previousIsLoading = undefined;
        this.previousFavorites = [];
        this.previousError = null;
    }

    init() { // <-- ALTERAÇÃO: Novo método de inicialização
        if (this.hasInitialized) {
            return;
        }
        // No momento, não há event listeners para configurar aqui, mas a estrutura está pronta.
        this.hasInitialized = true;
    }

    setStore(storeInstance) {
        this.store = storeInstance;
        if (this.store) {
            this.handleStateUpdate();
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }
    
    handleStateUpdate() {
        if (!this.store) return;
        
        const state = this.store.getState();
        const { currentQuestionsSet, currentQuestionIndex } = state.quiz;
        const favoritesState = state.user.favorites;
        
        const currentQuestion = currentQuestionsSet[currentQuestionIndex];
        if (currentQuestion) {
            this.updateFavoriteButtonState(currentQuestion.is_favorited || false);
        }

        if (
            favoritesState.isLoading !== this.previousIsLoading ||
            JSON.stringify(favoritesState.items) !== JSON.stringify(this.previousFavorites) ||
            favoritesState.error !== this.previousError
        ) {
            this.renderFavoritesList(favoritesState);
            this.previousIsLoading = favoritesState.isLoading;
            this.previousFavorites = favoritesState.items;
            this.previousError = favoritesState.error;
        }
    }

    updateFavoriteButtonState(isFavorited) {
        const btn = this.elements.btnToggleFavorite;
        if (!btn) return;

        const icon = btn.querySelector('.material-symbols-outlined');
        if (isFavorited) {
            btn.classList.add('is-favorited');
            if (icon) icon.textContent = 'star';
            btn.setAttribute('aria-label', 'Remover dos Favoritos');
            btn.title = 'Remover dos Favoritos';
        } else {
            btn.classList.remove('is-favorited');
            if (icon) icon.textContent = 'star_outline';
            btn.setAttribute('aria-label', 'Adicionar aos Favoritos');
            btn.title = 'Adicionar aos Favoritos';
        }
    }

    renderFavoritesList(favoritesState) {
        const container = this.elements.favoriteQuestionsContainer;
        const emptyState = this.elements.favoriteQuestionsEmptyState;

        if (!container) return;

        const { isLoading, items: favoriteQuestionsData, error } = favoritesState;

        if (isLoading) {
            this.quizUI.hideElement(emptyState);
            container.innerHTML = '<p class="placeholder-text" style="text-align: center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Carregando suas quest\u00f5es favoritas...</p>';
            return;
        }

        if (error) {
            this.quizUI.hideElement(emptyState);
            container.innerHTML = `<p class="placeholder-text" style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">${error}</p>`;
            return;
        }

        if (!favoriteQuestionsData || favoriteQuestionsData.length === 0) {
            this.quizUI.showElement(emptyState);
            container.innerHTML = '';
            return;
        }

        this.quizUI.hideElement(emptyState);
        container.innerHTML = '';

        const allCategories = this.store.getState().geral.allCategories || [];
        const categoryMap = new Map(allCategories.map(cat => [cat.id_categoria, cat.nome_categoria]));

        favoriteQuestionsData.forEach((fav) => {
            const card = document.createElement('article');
            card.className = 'favorite-question-card';

            const header = document.createElement('header');
            header.className = 'favorite-question-card__header';

            const titleGroup = document.createElement('div');
            titleGroup.className = 'favorite-question-card__title-group';

            const title = document.createElement('h3');
            title.className = 'favorite-question-card__title';
            title.textContent = fav.texto_pergunta;
            titleGroup.appendChild(title);

            const meta = document.createElement('div');
            meta.className = 'favorite-question-card__meta';

            const difficultyPill = document.createElement('span');
            difficultyPill.className = 'favorite-question-card__meta-pill';
            const difficultyIcon = document.createElement('span');
            difficultyIcon.className = 'material-symbols-outlined';
            difficultyIcon.textContent = 'insights';
            difficultyPill.appendChild(difficultyIcon);
            const difficultyText = document.createElement('span');
            difficultyText.textContent = fav.nivel_dificuldade || 'N\u00e3o informado';
            difficultyPill.appendChild(difficultyText);
            meta.appendChild(difficultyPill);

            const favoritedDate = new Date(fav.data_favoritada);
            const datePill = document.createElement('span');
            datePill.className = 'favorite-question-card__meta-pill';
            const dateIcon = document.createElement('span');
            dateIcon.className = 'material-symbols-outlined';
            dateIcon.textContent = 'schedule';
            datePill.appendChild(dateIcon);
            const dateLabel = document.createElement('span');
            dateLabel.textContent = Number.isNaN(favoritedDate.getTime())
                ? 'Favoritada recentemente'
                : `Favoritada em ${favoritedDate.toLocaleDateString('pt-BR')}`;
            datePill.appendChild(dateLabel);
            meta.appendChild(datePill);

            header.appendChild(titleGroup);
            header.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'favorite-question-card__actions';

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'favorite-question-card__toggle button button--secondary button--compact';
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.textContent = 'Ver detalhes';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'favorite-question-card__remove button button--text button--compact';
            removeBtn.textContent = 'Remover';

            actions.appendChild(toggleBtn);
            actions.appendChild(removeBtn);

            const details = document.createElement('div');
            details.className = 'favorite-question-card__details';
            details.hidden = true;

            const questionText = document.createElement('p');
            questionText.className = 'favorite-question-card__question';
            questionText.textContent = fav.texto_pergunta;
            details.appendChild(questionText);

            const chipsWrapper = document.createElement('div');
            chipsWrapper.className = 'favorite-question-card__chips';
            if (Array.isArray(fav.categoria_ids) && fav.categoria_ids.length > 0) {
                fav.categoria_ids.forEach((id) => {
                    const chip = document.createElement('span');
                    chip.className = 'category-tag';
                    chip.textContent = categoryMap.get(id) || `Categoria ${id}`;
                    chipsWrapper.appendChild(chip);
                });
            } else {
                const chip = document.createElement('span');
                chip.className = 'category-tag category-tag--none';
                chip.textContent = 'Categoria n\u00e3o informada';
                chipsWrapper.appendChild(chip);
            }
            details.appendChild(chipsWrapper);

            const optionsList = document.createElement('ul');
            optionsList.className = 'favorite-question-card__options';
            const options = Array.isArray(fav.opcoes) ? fav.opcoes : [];
            options.forEach((option, index) => {
                const optionItem = document.createElement('li');
                optionItem.className = 'favorite-question-card__option';
                if (option && option.eh_correta) {
                    optionItem.classList.add('is-correct');
                }
                const optionLabel = document.createElement('span');
                optionLabel.className = 'favorite-question-card__option-label';
                optionLabel.textContent = String.fromCharCode(65 + index);
                optionItem.appendChild(optionLabel);

                const optionText = document.createElement('span');
                optionText.className = 'favorite-question-card__option-text';
                optionText.textContent = option && option.texto_opcao ? option.texto_opcao : '';
                optionItem.appendChild(optionText);

                if (option && option.feedback_opcao) {
                    const feedback = document.createElement('small');
                    feedback.className = 'favorite-question-card__option-feedback';
                    feedback.textContent = option.feedback_opcao;
                    optionItem.appendChild(feedback);
                }

                optionsList.appendChild(optionItem);
            });
            details.appendChild(optionsList);

            if (fav.explicacao_resposta) {
                const explanationBlock = document.createElement('div');
                explanationBlock.className = 'favorite-question-card__explanation';
                const explanationTitle = document.createElement('h4');
                explanationTitle.textContent = 'Explicação';
                explanationBlock.appendChild(explanationTitle);
                const explanationText = document.createElement('p');
                explanationText.textContent = fav.explicacao_resposta;
                explanationBlock.appendChild(explanationText);
                details.appendChild(explanationBlock);
            }

            if (fav.referencia_bibliografica) {
                const reference = document.createElement('p');
                reference.className = 'favorite-question-card__reference';
                reference.textContent = `Referência: ${fav.referencia_bibliografica}`;
                details.appendChild(reference);
            }

            toggleBtn.addEventListener('click', () => {
                const isExpanded = details.hidden === false;
                if (isExpanded) {
                    details.hidden = true;
                    card.classList.remove('is-expanded');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                    toggleBtn.textContent = 'Ver detalhes';
                } else {
                    details.hidden = false;
                    card.classList.add('is-expanded');
                    toggleBtn.setAttribute('aria-expanded', 'true');
                    toggleBtn.textContent = 'Ocultar detalhes';
                }
            });

            removeBtn.addEventListener('click', () => {
                if (!this.actionOrchestrator) {
                    return;
                }
                this.actionOrchestrator.removeFavoriteFromAccount(fav.id_pergunta, removeBtn);
            });

            card.appendChild(header);
            card.appendChild(actions);
            card.appendChild(details);
            container.appendChild(card);
        });
    }

}