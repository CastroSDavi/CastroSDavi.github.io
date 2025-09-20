// assets/js/ui/FavoriteManager.js

export const FAVORITE_REVIEW_STORAGE_KEY = 'medquiz.favoriteReviewTarget';

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
        const questionsPageUrl = this._getQuestionsPageUrl();
        
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

        container.classList.add('favorite-questions-list');

        favoriteQuestionsData.forEach(fav => {
            const questionCard = document.createElement('article');
            questionCard.className = 'favorite-question-card';
            questionCard.dataset.perguntaId = fav.id_pergunta;

            const header = document.createElement('header');
            header.className = 'favorite-question-card__header';

            const headingWrapper = document.createElement('div');
            headingWrapper.className = 'favorite-question-card__heading';

            const idBadge = document.createElement('span');
            idBadge.className = 'favorite-question-card__badge';
            idBadge.textContent = `P${fav.id_pergunta}`;
            headingWrapper.appendChild(idBadge);

            const title = document.createElement('h3');
            title.className = 'favorite-question-card__title';
            title.textContent = fav.texto_pergunta;
            headingWrapper.appendChild(title);

            header.appendChild(headingWrapper);

            const metaContainer = document.createElement('div');
            metaContainer.className = 'favorite-question-card__meta';

            if (fav.nivel_dificuldade) {
                const difficultySpan = document.createElement('span');
                const difficultyModifier = this._getDifficultyModifier(fav.nivel_dificuldade);
                difficultySpan.className = `favorite-question-card__difficulty favorite-question-card__difficulty--${difficultyModifier}`;
                difficultySpan.textContent = fav.nivel_dificuldade;
                metaContainer.appendChild(difficultySpan);
            }

            const formattedDate = this._formatFavoriteDate(fav.data_favoritada);
            if (formattedDate) {
                const dateSpan = document.createElement('span');
                dateSpan.className = 'favorite-question-card__date favorite-question-date';
                dateSpan.textContent = `Favoritada em ${formattedDate}`;
                metaContainer.appendChild(dateSpan);
            }

            if (metaContainer.childElementCount > 0) {
                header.appendChild(metaContainer);
            }

            questionCard.appendChild(header);

            const body = document.createElement('div');
            body.className = 'favorite-question-card__body';

            if (fav.url_imagem) {
                const imageWrapper = document.createElement('figure');
                imageWrapper.className = 'favorite-question-card__image-wrapper';

                const imageElement = document.createElement('img');
                imageElement.className = 'favorite-question-card__image';
                imageElement.src = fav.url_imagem;
                imageElement.alt = `Imagem ilustrativa da questão P${fav.id_pergunta}`;
                imageWrapper.appendChild(imageElement);

                body.appendChild(imageWrapper);
            }

            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'favorite-question-card__tags categories-tags-container';

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
                noCatTag.textContent = 'Categoria não informada';
                tagsContainer.appendChild(noCatTag);
            }

            body.appendChild(tagsContainer);

            const options = Array.isArray(fav.opcoes) ? [...fav.opcoes] : [];
            if (options.length > 0) {
                options.sort((a, b) => {
                    const orderA = typeof a.ordem_exibicao === 'number' ? a.ordem_exibicao : Number.MAX_SAFE_INTEGER;
                    const orderB = typeof b.ordem_exibicao === 'number' ? b.ordem_exibicao : Number.MAX_SAFE_INTEGER;
                    if (orderA === orderB) {
                        return (a.id_opcao_resposta || 0) - (b.id_opcao_resposta || 0);
                    }
                    return orderA - orderB;
                });

                const optionsList = document.createElement('ul');
                optionsList.className = 'favorite-question-card__options';

                options.forEach((option, index) => {
                    const optionItem = document.createElement('li');
                    optionItem.className = 'favorite-question-card__option';
                    if (option.eh_correta) {
                        optionItem.classList.add('is-correct');
                    }

                    const letterSpan = document.createElement('span');
                    letterSpan.className = 'favorite-question-card__option-letter';
                    letterSpan.textContent = this._getOptionLetter(index);
                    optionItem.appendChild(letterSpan);

                    const optionText = document.createElement('span');
                    optionText.className = 'favorite-question-card__option-text';
                    optionText.textContent = option.texto_opcao;
                    optionItem.appendChild(optionText);

                    optionsList.appendChild(optionItem);
                });

                body.appendChild(optionsList);
            }

            let explanationContainer = null;
            const explanationId = `favorite-question-explanation-${fav.id_pergunta}`;
            if (fav.explicacao_resposta) {
                explanationContainer = document.createElement('div');
                explanationContainer.className = 'favorite-question-card__explanation';
                explanationContainer.id = explanationId;
                explanationContainer.hidden = true;

                const explanationTitle = document.createElement('h4');
                explanationTitle.className = 'favorite-question-card__explanation-title';
                explanationTitle.textContent = 'Explicação da resposta';
                explanationContainer.appendChild(explanationTitle);

                const explanationText = document.createElement('p');
                explanationText.className = 'favorite-question-card__explanation-text';
                explanationText.textContent = fav.explicacao_resposta;
                explanationContainer.appendChild(explanationText);

                body.appendChild(explanationContainer);
            }

            questionCard.appendChild(body);

            const footer = document.createElement('footer');
            footer.className = 'favorite-question-card__footer';

            if (fav.referencia_bibliografica) {
                const referenceParagraph = document.createElement('p');
                referenceParagraph.className = 'favorite-question-card__reference';
                referenceParagraph.textContent = fav.referencia_bibliografica;
                footer.appendChild(referenceParagraph);
            }

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'favorite-question-card__actions';

            const reviewLink = document.createElement('a');
            reviewLink.href = questionsPageUrl;
            reviewLink.className = 'button button--outline button--small favorite-question-card__action favorite-question-link';
            reviewLink.dataset.perguntaId = fav.id_pergunta;
            reviewLink.title = `Revisar a questão P${fav.id_pergunta} no quiz`;

            const reviewLabel = document.createElement('span');
            reviewLabel.className = 'button__label';
            reviewLabel.textContent = 'Ir para a questão';
            reviewLink.appendChild(reviewLabel);
            reviewLink.addEventListener('click', event => this._handleReviewLinkClick(event, fav));
            actionsContainer.appendChild(reviewLink);

            if (explanationContainer) {
                const explanationButton = document.createElement('button');
                explanationButton.type = 'button';
                explanationButton.className = 'button button--text favorite-question-card__action';
                explanationButton.setAttribute('aria-expanded', 'false');
                explanationButton.setAttribute('aria-controls', explanationId);

                const explanationButtonLabel = document.createElement('span');
                explanationButtonLabel.className = 'button__label';
                explanationButtonLabel.textContent = 'Ver explicação';
                explanationButton.appendChild(explanationButtonLabel);

                explanationButton.addEventListener('click', () => {
                    const isExpanded = explanationButton.getAttribute('aria-expanded') === 'true';
                    explanationContainer.hidden = isExpanded;
                    explanationButton.setAttribute('aria-expanded', String(!isExpanded));
                    explanationButtonLabel.textContent = isExpanded ? 'Ver explicação' : 'Ocultar explicação';
                });

                actionsContainer.appendChild(explanationButton);
            }

            footer.appendChild(actionsContainer);
            questionCard.appendChild(footer);

            container.appendChild(questionCard);
        });
    }

    consumePendingReviewRequest() {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return null;
        }

        const storedValue = window.sessionStorage.getItem(FAVORITE_REVIEW_STORAGE_KEY);
        if (!storedValue) return null;

        window.sessionStorage.removeItem(FAVORITE_REVIEW_STORAGE_KEY);

        try {
            const parsedValue = JSON.parse(storedValue);
            const questionId = Number.parseInt(parsedValue?.questionId, 10);
            if (!Number.isInteger(questionId) || questionId <= 0) {
                return null;
            }
            return { questionId };
        } catch (error) {
            console.warn('FavoriteManager: dados inválidos encontrados para revisão de favorito.', error);
            return null;
        }
    }

    _handleReviewLinkClick(event, favoriteQuestion) {
        if (event) {
            event.preventDefault();
        }

        if (!favoriteQuestion || typeof favoriteQuestion.id_pergunta === 'undefined') {
            return;
        }

        if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
                window.sessionStorage.setItem(
                    FAVORITE_REVIEW_STORAGE_KEY,
                    JSON.stringify({
                        questionId: favoriteQuestion.id_pergunta,
                        timestamp: Date.now(),
                    })
                );
            } catch (storageError) {
                console.warn('FavoriteManager: não foi possível armazenar dados para revisão da questão favorita.', storageError);
            }
        }

        const destinationUrl = this._getQuestionsPageUrl();
        if (typeof window !== 'undefined' && destinationUrl) {
            window.location.href = destinationUrl;
        }
    }

    _getQuestionsPageUrl() {
        const bottomNav = this.quizUI?.elements?.bottomNavElement;
        const questionsLink = bottomNav?.querySelector('[data-section-target-django="questions"]');
        if (questionsLink && questionsLink.href) {
            return questionsLink.href;
        }

        if (typeof window !== 'undefined' && window.location) {
            return `${window.location.origin}/questions/`;
        }

        return '/questions/';
    }

    _formatFavoriteDate(isoDateString) {
        if (!isoDateString) return null;
        const parsedDate = new Date(isoDateString);
        if (Number.isNaN(parsedDate.getTime())) return null;
        return parsedDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    _getDifficultyModifier(difficultyLabel) {
        if (!difficultyLabel) return 'padrao';
        const normalized = difficultyLabel
            .toString()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase();

        if (normalized.includes('fac')) return 'facil';
        if (normalized.includes('med')) return 'medio';
        if (normalized.includes('dific')) return 'dificil';
        return 'padrao';
    }

    _getOptionLetter(index) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (index < alphabet.length) {
            return alphabet[index];
        }
        return String(index + 1);
    }
}