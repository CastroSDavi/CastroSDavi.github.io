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
            container.innerHTML = '<p class="placeholder-text" style="text-align: center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Carregando suas questões favoritas...</p>';
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

        favoriteQuestionsData.forEach(fav => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'favorite-question-item';

            const questionLink = document.createElement('a');
            questionLink.href = `#q${fav.id_pergunta}`;
            questionLink.className = 'favorite-question-link';
            questionLink.textContent = `P${fav.id_pergunta}: ${fav.texto_pergunta.substring(0, 120)}${fav.texto_pergunta.length > 120 ? '...' : ''}`;
            questionLink.title = `Revisar questão P${fav.id_pergunta}`;
            questionLink.dataset.perguntaId = fav.id_pergunta;

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'favorite-question-details';

            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'categories-tags-container';

            if (fav.categoria_ids && fav.categoria_ids.length > 0) {
                fav.categoria_ids.forEach(id => {
                    const categoryName = categoryMap.get(id) || `ID ${id}`;
                    const tag = document.createElement('span');
                    tag.className = 'category-tag';
                    tag.textContent = categoryName;
                    tagsContainer.appendChild(tag);
                });
            } else {
                const noCatTag = document.createElement('span');
                noCatTag.className = 'category-tag category-tag--none';
                noCatTag.textContent = 'Não especificada';
                tagsContainer.appendChild(noCatTag);
            }
            detailsDiv.appendChild(tagsContainer);

            const dataFavoritada = new Date(fav.data_favoritada).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            const dataSmall = document.createElement('small');
            dataSmall.className = 'favorite-question-date';
            dataSmall.textContent = `Favoritada em: ${dataFavoritada}`;
            detailsDiv.appendChild(dataSmall);

            itemDiv.appendChild(questionLink);
            itemDiv.appendChild(detailsDiv);
            container.appendChild(itemDiv);
        });

        const lastItem = container.querySelector('.favorite-question-item:last-child');
        if (lastItem) lastItem.style.borderBottom = 'none';
    }
}