// File: assets/js/ui/FavoriteManager.js

export default class FavoriteManager {
    constructor(quizUIInstance, apiServiceInstance, quizStateInstance) {
        // console.log("FAVORITEMANAGER.JS: Constructor - Instanciando FavoriteManager.");
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements; // Atalho para os elementos DOM
        this.apiService = apiServiceInstance;
        this.quizState = quizStateInstance;
    }

    /**
     * Atualiza a aparência do botão de favorito.
     * @param {boolean} isFavorited - O estado atual de favorito da questão.
     */
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
        // console.log("FavoriteManager: Botão de favorito atualizado para estado:", isFavorited);
    }

    /**
     * Renderiza a lista de questões favoritas na página da conta.
     * @param {Array} favoriteQuestionsData - Array de objetos de questão favorita.
     * @param {Array} allCategoriesData - Array de todas as categorias para mapeamento.
     */
    renderFavoritesList(favoriteQuestionsData, allCategoriesData) {
        const container = this.elements.favoriteQuestionsContainer;
        const emptyState = this.elements.favoriteQuestionsEmptyState;
        const placeholder = container?.querySelector('.placeholder-text');

        if (!container) {
            // console.error("FavoriteManager: Container de questões favoritas não encontrado.");
            return;
        }
        if (placeholder) this.quizUI.hideElement(placeholder);
        container.innerHTML = ''; // Limpa o container

        if (!favoriteQuestionsData || favoriteQuestionsData.length === 0) {
            if (emptyState) this.quizUI.showElement(emptyState);
            // console.log("FavoriteManager: Nenhuma questão favorita para renderizar.");
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
            // Link para a questão (funcionalidade de clique a ser implementada)
            const questionLink = document.createElement('a');
            questionLink.href = `#q${fav.id_pergunta}`; 
            questionLink.className = 'favorite-question-link';
            questionLink.textContent = `P${fav.id_pergunta}: ${fav.texto_pergunta.substring(0, 120)}${fav.texto_pergunta.length > 120 ? '...' : ''}`;
            questionLink.title = `Revisar questão P${fav.id_pergunta}`;
            questionLink.dataset.perguntaId = fav.id_pergunta;
            // TODO: Adicionar listener para o questionLink para abrir detalhes da questão, se desejado.

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'favorite-question-details';

            let categoriasText = "Não especificadas";
            if (fav.categoria_ids && fav.categoria_ids.length > 0) {
                categoriasText = fav.categoria_ids.map(id => categoryMap.get(id) || `ID ${id}`).join(', ');
            }
            const catSmall = document.createElement('small');
            catSmall.className = 'favorite-question-categories';
            catSmall.textContent = `Categorias: ${categoriasText}`;
            
            const dataFavoritada = new Date(fav.data_favoritada).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            const dataSmall = document.createElement('small');
            dataSmall.className = 'favorite-question-date';
            dataSmall.textContent = `Favoritada em: ${dataFavoritada}`;

            detailsDiv.appendChild(catSmall);
            detailsDiv.appendChild(dataSmall);

            itemDiv.appendChild(questionLink);
            itemDiv.appendChild(detailsDiv);
            container.appendChild(itemDiv);
        });

        const lastItem = container.querySelector('.favorite-question-item:last-child');
        if(lastItem) lastItem.style.borderBottom = 'none'; // Remove borda do último item
        // console.log(`FavoriteManager: ${favoriteQuestionsData.length} questões favoritas renderizadas.`);
    }

    /**
     * Carrega e exibe as questões favoritas do usuário.
     */
    async loadUserFavorites() {
        if (!this.quizUI.userIsAuthenticated) {
            const container = this.elements.favoriteQuestionsContainer;
            if (container) {
                const placeholder = container.querySelector('.placeholder-text');
                if (placeholder) this.quizUI.hideElement(placeholder);
                container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Você precisa estar logado para ver suas questões favoritas.</p>';
            }
            if (this.elements.favoriteQuestionsEmptyState) this.quizUI.hideElement(this.elements.favoriteQuestionsEmptyState);
            // console.log("FavoriteManager: Usuário não autenticado, não carregando favoritos.");
            return;
        }

        // console.log("FavoriteManager: Carregando questões favoritas do usuário...");
        const favContainer = this.elements.favoriteQuestionsContainer;
        if(favContainer) {
            favContainer.innerHTML = '<p class="placeholder-text" style="text-align: center; color: var(--color-text-muted); padding: var(--spacing-md) 0;">Carregando suas questões favoritas...</p>';
        }

        try {
            const response = await this.apiService.getFavoriteQuestions();
            if (response && response.status === 'success') {
                this.renderFavoritesList(response.favorite_questions, response.all_categories_for_mapping);
            } else {
                const userMessage = this.quizUI._getFriendlyErrorMessage // Assumindo que _getFriendlyErrorMessage está em QuizUI ou acessível
                    ? this.quizUI._getFriendlyErrorMessage({ data: response }, "Não foi possível carregar suas questões favoritas.")
                    : "Não foi possível carregar suas questões favoritas. Tente novamente.";
                if(favContainer) favContainer.innerHTML = `<p style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">${userMessage}</p>`;
                if (this.elements.favoriteQuestionsEmptyState) this.quizUI.hideElement(this.elements.favoriteQuestionsEmptyState);
            }
        } catch (error) {
            const userMessage = this.quizUI._getFriendlyErrorMessage
                ? this.quizUI._getFriendlyErrorMessage(error, "Erro de conexão ao carregar suas questões favoritas.")
                : "Erro de conexão ao carregar suas questões favoritas. Verifique sua internet.";
            if(favContainer) favContainer.innerHTML = `<p style="text-align:center; color: var(--color-accent-red); padding: var(--spacing-md) 0;">${userMessage}</p>`;
            if (this.elements.favoriteQuestionsEmptyState) this.quizUI.hideElement(this.elements.favoriteQuestionsEmptyState);
        }
    }

    /**
     * Alterna o status de favorito da questão atual (visível no quiz).
     */
    async toggleCurrentQuestionFavoriteStatus() {
        if (!this.quizUI.userIsAuthenticated) {
            this.quizUI.showWarning("Apenas usuários logados podem favoritar questões. <a href='/accounts/login/' class='alert-link'>Faça login</a> ou <a href='/register/' class='alert-link'>crie uma conta</a>.", 'info');
            // console.log("FavoriteManager: Tentativa de favoritar sem autenticação.");
            return;
        }

        const currentQuestion = this.quizState.getCurrentQuestion();
        if (!currentQuestion) {
            // console.warn("FavoriteManager: Nenhuma questão atual para favoritar.");
            return;
        }

        const perguntaId = currentQuestion.id_pergunta;
        // console.log(`FavoriteManager: Alternando favorito para pergunta ID ${perguntaId}`);
        
        const btnFav = this.elements.btnToggleFavorite;
        if(btnFav) this.quizUI.setButtonLoading(btnFav, true); // Feedback visual

        try {
            const response = await this.apiService.toggleFavoriteStatus(perguntaId);
            if (response && response.status === 'success') {
                this.updateFavoriteButtonState(response.is_favorited);
                // Atualiza o estado da pergunta no QuizState
                currentQuestion.is_favorited = response.is_favorited;
                // console.log(`FavoriteManager: Pergunta ID ${perguntaId} agora é ${response.is_favorited ? 'favorita' : 'não favorita'}.`);
                // Opcional: Mostrar uma mensagem de sucesso sutil (toast)
                // this.quizUI.showToast(response.message, 'success');
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