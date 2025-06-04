// assets/js/ui/FavoriteManager.js

export default class FavoriteManager {
    constructor(quizUIInstance, apiServiceInstance, quizStateInstance) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements;
        this.apiService = apiServiceInstance;
        this.quizState = quizStateInstance;
        this.isLoadingFavorites = false; // Flag to prevent re-entrant loading
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

    renderFavoritesList(favoriteQuestionsData, allCategoriesData) {
        const container = this.elements.favoriteQuestionsContainer;
        const emptyState = this.elements.favoriteQuestionsEmptyState;
        const placeholder = container?.querySelector('.placeholder-text');

        if (!container) {
            // console.error("FavoriteManager: Container de questões favoritas não encontrado.");
            return;
        }

        if (placeholder) this.quizUI.hideElement(placeholder);
        container.innerHTML = ''; 

        if (!favoriteQuestionsData || favoriteQuestionsData.length === 0) {
            if (emptyState) this.quizUI.showElement(emptyState);
            return;
        }
        if (emptyState) this.quizUI.hideElement(emptyState);

        const categoryMap = new Map();
        if (allCategoriesData) {
            allCategoriesData.forEach(cat => categoryMap.set(cat.id_categoria, cat.nome_categoria));
        }

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

            // --- MODIFICAÇÃO PARA EXIBIR CATEGORIAS COMO TAGS ---
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'categories-tags-container'; // Classe para estilização flex e gap

            if (fav.categoria_ids && fav.categoria_ids.length > 0) {
                fav.categoria_ids.forEach(id => {
                    const categoryName = categoryMap.get(id) || `ID ${id}`; // Fallback se o nome não for encontrado
                    const tag = document.createElement('span');
                    tag.className = 'category-tag'; // Classe da tag individual
                    tag.textContent = categoryName;
                    tagsContainer.appendChild(tag);
                });
            } else {
                const noCatTag = document.createElement('span');
                noCatTag.className = 'category-tag category-tag--none'; // Classe opcional para estilo específico
                noCatTag.textContent = 'Não especificada';
                tagsContainer.appendChild(noCatTag);
            }
            detailsDiv.appendChild(tagsContainer); // Adiciona o container de tags
            // --- FIM DA MODIFICAÇÃO ---

            const dataFavoritada = new Date(fav.data_favoritada).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            const dataSmall = document.createElement('small');
            dataSmall.className = 'favorite-question-date';
            dataSmall.textContent = `Favoritada em: ${dataFavoritada}`;
            detailsDiv.appendChild(dataSmall); // Adiciona a data após as tags

            itemDiv.appendChild(questionLink);
            itemDiv.appendChild(detailsDiv);
            container.appendChild(itemDiv);
        });

        const lastItem = container.querySelector('.favorite-question-item:last-child');
        if(lastItem) lastItem.style.borderBottom = 'none';
    }

    async loadUserFavorites() {
        if (this.isLoadingFavorites) {
            return;
        }
        this.isLoadingFavorites = true;

        const favContainer = this.elements.favoriteQuestionsContainer;

        if (!this.quizUI.userIsAuthenticated) {
            if (favContainer) {
                favContainer.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Você precisa estar logado para ver suas questões favoritas.</p>';
            }
            if (this.elements.favoriteQuestionsEmptyState) this.quizUI.hideElement(this.elements.favoriteQuestionsEmptyState);
            this.isLoadingFavorites = false;
            return;
        }

        if(favContainer) {
            if (this.elements.favoriteQuestionsEmptyState) this.quizUI.hideElement(this.elements.favoriteQuestionsEmptyState);
            favContainer.innerHTML = '<p class="placeholder-text" style="text-align: center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Carregando suas questões favoritas...</p>';
        }

        try {
            const response = await this.apiService.getFavoriteQuestions();
            if (response && response.status === 'success') {
                this.renderFavoritesList(response.favorite_questions, response.all_categories_for_mapping);
            } else {
                const userMessage = this.quizUI._getFriendlyErrorMessage
                    ? this.quizUI._getFriendlyErrorMessage({ data: response }, "Não foi possível carregar suas questões favoritas.")
                    : "Não foi possível carregar suas questões favoritas. Tente novamente.";
                if(favContainer) favContainer.innerHTML = `<p class="placeholder-text" style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">${userMessage}</p>`;
                if (this.elements.favoriteQuestionsEmptyState) this.quizUI.hideElement(this.elements.favoriteQuestionsEmptyState);
            }
        } catch (error) {
            const userMessage = this.quizUI._getFriendlyErrorMessage
                ? this.quizUI._getFriendlyErrorMessage(error, "Erro de conexão ao carregar suas questões favoritas.")
                : "Erro de conexão ao carregar suas questões favoritas. Verifique sua internet.";
            if(favContainer) favContainer.innerHTML = `<p class="placeholder-text" style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">${userMessage}</p>`;
            if (this.elements.favoriteQuestionsEmptyState) this.quizUI.hideElement(this.elements.favoriteQuestionsEmptyState);
        } finally {
            this.isLoadingFavorites = false;
        }
    }

    async toggleCurrentQuestionFavoriteStatus() {
        if (!this.quizUI.userIsAuthenticated) {
            this.quizUI.showWarning("Apenas usuários logados podem favoritar questões. <a href='/accounts/login/' class='alert-link'>Faça login</a> ou <a href='/register/' class='alert-link'>crie uma conta</a>.", 'info');
            return;
        }

        const currentQuestion = this.quizState.getCurrentQuestion();
        if (!currentQuestion) {
            return;
        }

        const perguntaId = currentQuestion.id_pergunta;
        const btnFav = this.elements.btnToggleFavorite;
        if(btnFav) this.quizUI.setButtonLoading(btnFav, true);

        try {
            const response = await this.apiService.toggleFavoriteStatus(perguntaId);
            if (response && response.status === 'success') {
                this.updateFavoriteButtonState(response.is_favorited);
                this.state.updateFavoriteStatusForCurrentQuestion(response.is_favorited);
            } else {
                const userMessage = this.quizUI._getFriendlyErrorMessage
                    ? this.quizUI._getFriendlyErrorMessage({ data: response }, "Falha ao atualizar status de favorito.")
                    : "Falha ao atualizar status de favorito.";
                this.quizUI.showWarning(userMessage, 'error');
            }
        } catch (error) {
            const userMessage = this.quizUI._getFriendlyErrorMessage
                ? this.quizUI._getFriendlyErrorMessage(error, "Erro de conexão ao tentar favoritar a questão.")
                : "Erro de conexão ao tentar favoritar a questão.";
            this.quizUI.showWarning(userMessage, 'error');
        } finally {
            if(btnFav) this.quizUI.setButtonLoading(btnFav, false);
        }
    }
}