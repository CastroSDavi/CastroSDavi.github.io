// assets/js/ui/FavoriteManager.js

export const FAVORITE_REVIEW_STORAGE_KEY = 'medquiz.favoriteReviewTarget';
export const FAVORITE_REVIEW_QUERY_PARAM = 'favorite_question';

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

        container.setAttribute('aria-busy', isLoading ? 'true' : 'false');

        if (isLoading) {
            this.quizUI.hideElement(emptyState);
            this._renderFavoriteStatus(container, 'Carregando suas questões favoritas...', 'loading');
            return;
        }

        if (error) {
            this.quizUI.hideElement(emptyState);
            this._renderFavoriteStatus(container, error, 'error');
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
        const categoryMap = new Map();
        allCategories.forEach(cat => {
            if (cat && typeof cat.id_categoria !== 'undefined') {
                const name = typeof cat.nome_categoria === 'string' ? cat.nome_categoria.trim() : '';
                categoryMap.set(cat.id_categoria, name);
                categoryMap.set(String(cat.id_categoria), name);
            }
        });

        container.classList.add('favorite-questions-list');

        favoriteQuestionsData.forEach((fav, index) => {
            const questionCard = document.createElement('article');
            questionCard.className = 'favorite-question-card';
            questionCard.dataset.perguntaId = fav.id_pergunta;

            const contentWrapperId = `favorite-question-content-${fav.id_pergunta}`;
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'favorite-question-card__content';
            contentWrapper.id = contentWrapperId;

            if (fav.esta_ativa === false) {
                questionCard.classList.add('favorite-question-card--inactive');
            }

            const questionDisplayLabel = `Questão favorita ${index + 1}`;

            const header = document.createElement('header');
            header.className = 'favorite-question-card__header';

            const headerTopRow = document.createElement('div');
            headerTopRow.className = 'favorite-question-card__top';

            const headingWrapper = document.createElement('div');
            headingWrapper.className = 'favorite-question-card__heading';

            const idBadge = document.createElement('span');
            idBadge.className = 'favorite-question-card__badge';
            idBadge.textContent = questionDisplayLabel;
            headingWrapper.appendChild(idBadge);

            const title = document.createElement('h3');
            title.className = 'favorite-question-card__title';
            title.textContent = fav.texto_pergunta;
            headingWrapper.appendChild(title);

            if (fav.esta_ativa === false) {
                const statusBadge = document.createElement('span');
                statusBadge.className = 'favorite-question-card__status-badge favorite-question-card__status-badge--inactive';
                statusBadge.textContent = 'Questão inativa';
                headingWrapper.appendChild(statusBadge);
            }

            headerTopRow.appendChild(headingWrapper);

            const collapseButton = document.createElement('button');
            collapseButton.type = 'button';
            collapseButton.className = 'button button--icon-only favorite-question-card__toggle';
            collapseButton.setAttribute('aria-expanded', 'false');
            collapseButton.setAttribute('aria-controls', contentWrapperId);

            const collapseIcon = document.createElement('span');
            collapseIcon.className = 'material-symbols-outlined';
            collapseIcon.textContent = 'expand_more';
            collapseButton.appendChild(collapseIcon);

            const collapseLabel = document.createElement('span');
            collapseLabel.className = 'u-sr-only';
            collapseLabel.textContent = `Expandir detalhes da ${questionDisplayLabel}`;
            collapseButton.appendChild(collapseLabel);

            const updateCollapseState = isExpanded => {
                collapseButton.setAttribute('aria-expanded', String(isExpanded));
                collapseLabel.textContent = isExpanded
                    ? `Ocultar detalhes da ${questionDisplayLabel}`
                    : `Expandir detalhes da ${questionDisplayLabel}`;
                collapseIcon.textContent = isExpanded ? 'expand_less' : 'expand_more';
                contentWrapper.hidden = !isExpanded;
                questionCard.classList.toggle('favorite-question-card--collapsed', !isExpanded);
            };

            collapseButton.addEventListener('click', () => {
                const isExpanded = collapseButton.getAttribute('aria-expanded') === 'true';
                updateCollapseState(!isExpanded);
            });

            headerTopRow.appendChild(collapseButton);
            header.appendChild(headerTopRow);

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
                imageElement.alt = `Imagem ilustrativa da ${questionDisplayLabel}`;
                imageWrapper.appendChild(imageElement);

                body.appendChild(imageWrapper);
            }

            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'favorite-question-card__tags categories-tags-container';

            const categoryLabels = this._getCategoryLabels(fav, categoryMap);
            if (categoryLabels.length > 0) {
                categoryLabels.forEach(label => {
                    const tag = document.createElement('span');
                    tag.className = 'category-tag';
                    tag.textContent = label;
                    tagsContainer.appendChild(tag);
                });
            } else {
                const noCatTag = document.createElement('span');
                noCatTag.className = 'category-tag category-tag--none';
                noCatTag.textContent = 'Categoria não informada';
                tagsContainer.appendChild(noCatTag);
            }

            body.appendChild(tagsContainer);

            const optionFeedbackElements = [];
            const options = Array.isArray(fav.opcoes) ? [...fav.opcoes] : [];
            let optionsList = null;
            if (options.length > 0) {
                options.sort((a, b) => {
                    const orderA = typeof a.ordem_exibicao === 'number' ? a.ordem_exibicao : Number.MAX_SAFE_INTEGER;
                    const orderB = typeof b.ordem_exibicao === 'number' ? b.ordem_exibicao : Number.MAX_SAFE_INTEGER;
                    if (orderA === orderB) {
                        return (a.id_opcao_resposta || 0) - (b.id_opcao_resposta || 0);
                    }
                    return orderA - orderB;
                });

                optionsList = document.createElement('ul');
                optionsList.className = 'favorite-question-card__options';
                optionsList.id = `favorite-question-options-${fav.id_pergunta}`;

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

                    const optionContent = document.createElement('div');
                    optionContent.className = 'favorite-question-card__option-content';

                    const optionText = document.createElement('span');
                    optionText.className = 'favorite-question-card__option-text';
                    optionText.textContent = option.texto_opcao || '';
                    optionContent.appendChild(optionText);

                    const optionFeedbackText = typeof option.feedback_opcao === 'string'
                        ? option.feedback_opcao.trim()
                        : '';
                    if (optionFeedbackText) {
                        const optionFeedback = document.createElement('p');
                        optionFeedback.className = 'favorite-question-card__option-feedback';
                        optionFeedback.textContent = optionFeedbackText;
                        optionFeedback.hidden = true;
                        optionContent.appendChild(optionFeedback);
                        optionFeedbackElements.push(optionFeedback);
                    }

                    optionItem.appendChild(optionContent);
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

            if (optionFeedbackElements.length > 0 && optionsList) {
                const optionFeedbackButton = document.createElement('button');
                optionFeedbackButton.type = 'button';
                optionFeedbackButton.className = 'button button--outline button--small favorite-question-card__action';
                optionFeedbackButton.setAttribute('aria-expanded', 'false');
                optionFeedbackButton.setAttribute('aria-controls', optionsList.id);

                const optionFeedbackLabel = document.createElement('span');
                optionFeedbackLabel.className = 'button__label';
                optionFeedbackLabel.textContent = 'Ver explicações das alternativas';
                optionFeedbackButton.appendChild(optionFeedbackLabel);

                optionFeedbackButton.addEventListener('click', () => {
                    const isExpanded = optionFeedbackButton.getAttribute('aria-expanded') === 'true';
                    const nextExpandedState = !isExpanded;
                    optionFeedbackButton.setAttribute('aria-expanded', String(nextExpandedState));
                    optionFeedbackLabel.textContent = nextExpandedState
                        ? 'Ocultar explicações das alternativas'
                        : 'Ver explicações das alternativas';
                    optionFeedbackElements.forEach(element => {
                        element.hidden = !nextExpandedState;
                    });
                    questionCard.classList.toggle('favorite-question-card--showing-feedback', nextExpandedState);
                    optionsList.classList.toggle('favorite-question-card__options--showing-feedback', nextExpandedState);
                });

                actionsContainer.appendChild(optionFeedbackButton);
            }

            if (explanationContainer) {
                const explanationButton = document.createElement('button');
                explanationButton.type = 'button';
                explanationButton.className = 'button button--text favorite-question-card__action';
                explanationButton.setAttribute('aria-expanded', 'false');
                explanationButton.setAttribute('aria-controls', explanationId);

                const explanationButtonLabel = document.createElement('span');
                explanationButtonLabel.className = 'button__label';
                explanationButtonLabel.textContent = 'Ver explicação da questão';
                explanationButton.appendChild(explanationButtonLabel);

                explanationButton.addEventListener('click', () => {
                    const isExpanded = explanationButton.getAttribute('aria-expanded') === 'true';
                    explanationContainer.hidden = isExpanded;
                    explanationButton.setAttribute('aria-expanded', String(!isExpanded));
                    explanationButtonLabel.textContent = isExpanded
                        ? 'Ver explicação da questão'
                        : 'Ocultar explicação da questão';
                });

                actionsContainer.appendChild(explanationButton);
            }

            if (fav.detail_url) {
                const detailLink = document.createElement('a');
                detailLink.href = fav.detail_url;
                detailLink.className = 'button button--text button--compact favorite-question-card__action';
                detailLink.setAttribute('role', 'link');

                const detailLabel = document.createElement('span');
                detailLabel.className = 'button__label';
                detailLabel.textContent = 'Abrir detalhes';
                detailLink.appendChild(detailLabel);

                actionsContainer.appendChild(detailLink);
            }

            const unfavoriteButton = this._createUnfavoriteButton(fav);
            if (unfavoriteButton) {
                actionsContainer.appendChild(unfavoriteButton);
            }

            footer.appendChild(actionsContainer);
            contentWrapper.appendChild(body);
            contentWrapper.appendChild(footer);
            questionCard.appendChild(contentWrapper);

            updateCollapseState(false);

            container.appendChild(questionCard);
        });
    }

    _renderFavoriteStatus(container, message, modifier = null) {
        if (!container) return;

        container.innerHTML = '';
        const statusElement = document.createElement('p');
        statusElement.className = 'favorite-questions__status placeholder-text';

        if (modifier === 'error') {
            statusElement.classList.add('favorite-questions__status--error');
        } else if (modifier === 'empty') {
            statusElement.classList.add('favorite-questions__status--empty');
        }

        statusElement.textContent = typeof message === 'string' ? message : String(message ?? '');
        container.appendChild(statusElement);
    }

    _createUnfavoriteButton(favoriteQuestion) {
        if (!favoriteQuestion) return null;

        const questionId = Number.parseInt(favoriteQuestion.id_pergunta, 10);
        if (!Number.isInteger(questionId) || questionId <= 0) {
            return null;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button button--text button--small favorite-question-card__action favorite-question-card__unfavorite';
        button.dataset.perguntaId = String(questionId);

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'bookmark_remove';
        button.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'button__label';
        label.textContent = 'Remover dos favoritos';
        button.appendChild(label);

        button.addEventListener('click', () => {
            this._handleUnfavoriteClick(questionId, button);
        });

        return button;
    }

    async _handleUnfavoriteClick(questionId, buttonElement) {
        if (!Number.isInteger(questionId) || questionId <= 0) {
            return false;
        }

        if (!this.actionOrchestrator) {
            console.warn('FavoriteManager: actionOrchestrator não configurado para remover favoritos.');
            return false;
        }

        if (!buttonElement) {
            return false;
        }

        const labelElement = buttonElement.querySelector('.button__label');
        const originalLabel = labelElement ? labelElement.textContent : null;

        buttonElement.disabled = true;
        buttonElement.setAttribute('aria-disabled', 'true');
        if (labelElement) {
            labelElement.textContent = 'Removendo...';
        }

        let wasRemoved = false;
        try {
            wasRemoved = await this.actionOrchestrator.toggleFavoriteFromAccountPage(questionId);
        } catch (error) {
            console.error('FavoriteManager: erro ao remover questão dos favoritos.', error);
        } finally {
            if (!wasRemoved && buttonElement.isConnected) {
                if (labelElement && originalLabel !== null) {
                    labelElement.textContent = originalLabel;
                }
                buttonElement.disabled = false;
                buttonElement.removeAttribute('aria-disabled');
            }
        }

        return wasRemoved;
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

            const questionData = parsedValue?.questionData && typeof parsedValue.questionData === 'object'
                ? parsedValue.questionData
                : null;

            const forceUseCache = parsedValue?.forceUseCache === true;
            return { questionId, questionData, forceUseCache };
        } catch (error) {
            console.warn('FavoriteManager: dados inválidos encontrados para revisão de favorito.', error);
            return null;
        }
    }

    _handleReviewLinkClick(event, favoriteQuestion) {
        if (!favoriteQuestion || typeof favoriteQuestion.id_pergunta === 'undefined') {
            return;
        }

        const isModifiedClick = Boolean(
            event && (
                event.defaultPrevented ||
                (typeof event.button === 'number' && event.button !== 0) ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            )
        );

        if (isModifiedClick) {
            return;
        }

        if (event) {
            event.preventDefault();
        }

        const baseUrl = this._getQuestionsPageUrl();
        const destinationUrl = favoriteQuestion?.detail_url
            || this._buildQuestionReviewLink(baseUrl, favoriteQuestion.id_pergunta)
            || baseUrl;

        if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
                const sanitizedQuestionData = this._sanitizeFavoriteQuestionForReview(favoriteQuestion);
                const payloadToStore = {
                    questionId: favoriteQuestion.id_pergunta,
                    timestamp: Date.now(),
                };

                if (favoriteQuestion.esta_ativa === false) {
                    payloadToStore.forceUseCache = true;
                }

                if (sanitizedQuestionData) {
                    payloadToStore.questionData = sanitizedQuestionData;
                }

                window.sessionStorage.setItem(
                    FAVORITE_REVIEW_STORAGE_KEY,
                    JSON.stringify(payloadToStore)
                );
            } catch (storageError) {
                console.warn('FavoriteManager: não foi possível armazenar dados para revisão da questão favorita.', storageError);
            }
        }

        if (typeof window !== 'undefined' && destinationUrl) {
            window.location.href = destinationUrl;
        }
    }

    _buildQuestionReviewLink(baseUrl, questionId) {
        if (!baseUrl) {
            return null;
        }

        const parsedId = Number.parseInt(questionId, 10);
        if (!Number.isInteger(parsedId) || parsedId <= 0) {
            return baseUrl;
        }

        const questionIdString = String(parsedId);

        try {
            const hashIndex = baseUrl.indexOf('#');
            const pathAndQuery = hashIndex >= 0 ? baseUrl.slice(0, hashIndex) : baseUrl;
            const hashFragment = hashIndex >= 0 ? baseUrl.slice(hashIndex) : '';

            const queryIndex = pathAndQuery.indexOf('?');
            const pathOnly = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;
            const queryString = queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : '';

            const searchParams = new URLSearchParams(queryString);
            searchParams.set(FAVORITE_REVIEW_QUERY_PARAM, questionIdString);

            const newQuery = searchParams.toString();
            const newPathAndQuery = newQuery ? `${pathOnly}?${newQuery}` : pathOnly;

            return `${newPathAndQuery}${hashFragment}`;
        } catch (urlError) {
            console.warn('FavoriteManager: não foi possível construir URL para revisão da questão favorita.', urlError);
            const separator = baseUrl.includes('?') ? '&' : '?';
            return `${baseUrl}${separator}${encodeURIComponent(FAVORITE_REVIEW_QUERY_PARAM)}=${encodeURIComponent(questionIdString)}`;
        }
    }

    _sanitizeFavoriteQuestionForReview(favoriteQuestion) {
        if (!favoriteQuestion || typeof favoriteQuestion.id_pergunta === 'undefined') {
            return null;
        }

        const sanitizedQuestion = {
            id_pergunta: favoriteQuestion.id_pergunta,
            slug: favoriteQuestion.slug || null,
            detail_url: favoriteQuestion.detail_url || null,
            texto_pergunta: favoriteQuestion.texto_pergunta || '',
            url_imagem: favoriteQuestion.url_imagem || null,
            referencia_bibliografica: favoriteQuestion.referencia_bibliografica || null,
            categoria_ids: Array.isArray(favoriteQuestion.categoria_ids)
                ? [...favoriteQuestion.categoria_ids]
                : [],
            nivel_dificuldade: favoriteQuestion.nivel_dificuldade || null,
            explicacao_resposta: favoriteQuestion.explicacao_resposta || null,
            is_favorited: true,
            esta_ativa: favoriteQuestion.esta_ativa === false ? false : true,
        };

        const normalizedCategories = this._normalizeFavoriteCategories(favoriteQuestion);
        sanitizedQuestion.categorias = normalizedCategories;
        sanitizedQuestion.categoria_nomes = normalizedCategories
            .map(category => category.nome_categoria)
            .filter(name => typeof name === 'string' && name.trim() !== '');

        if (Array.isArray(favoriteQuestion.opcoes)) {
            sanitizedQuestion.opcoes = favoriteQuestion.opcoes
                .map(option => ({
                    id_opcao_resposta: option.id_opcao_resposta,
                    id_pergunta: option.id_pergunta ?? favoriteQuestion.id_pergunta,
                    texto_opcao: option.texto_opcao || '',
                    eh_correta: Boolean(option.eh_correta),
                    ordem_exibicao: typeof option.ordem_exibicao === 'number' ? option.ordem_exibicao : null,
                    feedback_opcao: option.feedback_opcao || null,
                }))
                .sort((a, b) => {
                    const orderA = typeof a.ordem_exibicao === 'number' ? a.ordem_exibicao : Number.MAX_SAFE_INTEGER;
                    const orderB = typeof b.ordem_exibicao === 'number' ? b.ordem_exibicao : Number.MAX_SAFE_INTEGER;

                    if (orderA === orderB) {
                        const idA = typeof a.id_opcao_resposta === 'number' ? a.id_opcao_resposta : Number.MAX_SAFE_INTEGER;
                        const idB = typeof b.id_opcao_resposta === 'number' ? b.id_opcao_resposta : Number.MAX_SAFE_INTEGER;
                        return idA - idB;
                    }

                    return orderA - orderB;
                });
        } else {
            sanitizedQuestion.opcoes = [];
        }

        return sanitizedQuestion;
    }

    _getCategoryLabels(favoriteQuestion, categoryMap) {
        if (!favoriteQuestion) {
            return [];
        }

        const normalizedCategories = this._normalizeFavoriteCategories(favoriteQuestion);
        const labelsSet = new Set();

        normalizedCategories.forEach(category => {
            if (category.nome_categoria) {
                labelsSet.add(category.nome_categoria);
            } else if (category.id_categoria !== null) {
                const resolvedName = this._resolveCategoryNameById(category.id_categoria, categoryMap);
                if (resolvedName) {
                    labelsSet.add(resolvedName);
                }
            }
        });

        if (labelsSet.size === 0 && Array.isArray(favoriteQuestion.categoria_ids)) {
            favoriteQuestion.categoria_ids.forEach(id => {
                const resolvedName = this._resolveCategoryNameById(id, categoryMap);
                if (resolvedName) {
                    labelsSet.add(resolvedName);
                }
            });
        }

        return Array.from(labelsSet);
    }

    _normalizeFavoriteCategories(favoriteQuestion) {
        if (!favoriteQuestion) {
            return [];
        }

        const normalized = [];
        const seenKeys = new Set();

        const addCategory = (idValue, nameValue) => {
            const normalizedName = typeof nameValue === 'string' ? nameValue.trim() : '';
            const normalizedId = this._normalizeCategoryId(idValue);
            if (!normalizedName && normalizedId === null) {
                return;
            }

            const keyNamePart = normalizedName ? normalizedName.toLowerCase() : '';
            const keyIdPart = normalizedId !== null ? `id:${normalizedId}` : '';
            const dedupeKey = `${keyNamePart}|${keyIdPart}`;
            if (seenKeys.has(dedupeKey)) {
                return;
            }
            seenKeys.add(dedupeKey);

            normalized.push({
                id_categoria: normalizedId,
                nome_categoria: normalizedName || null,
            });
        };

        if (Array.isArray(favoriteQuestion.categorias)) {
            favoriteQuestion.categorias.forEach(category => {
                if (typeof category === 'string') {
                    addCategory(null, category);
                } else if (category && typeof category === 'object') {
                    addCategory(
                        category.id_categoria ?? category.id ?? category.pk ?? category.value ?? category.idCategoria ?? null,
                        category.nome_categoria ?? category.nome ?? category.label ?? category.title ?? category.text ?? category.name ?? null,
                    );
                }
            });
        }

        if (Array.isArray(favoriteQuestion.categoria_nomes)) {
            favoriteQuestion.categoria_nomes.forEach(name => addCategory(null, name));
        }

        return normalized;
    }

    _normalizeCategoryId(rawId) {
        if (typeof rawId === 'number' && Number.isFinite(rawId)) {
            return rawId;
        }
        if (typeof rawId === 'string') {
            const trimmed = rawId.trim();
            if (!trimmed) {
                return null;
            }
            const parsed = Number.parseInt(trimmed, 10);
            if (!Number.isNaN(parsed)) {
                return parsed;
            }
        }
        return null;
    }

    _resolveCategoryNameById(categoryId, categoryMap) {
        if (!categoryMap || typeof categoryMap.has !== 'function' || typeof categoryMap.get !== 'function') {
            return null;
        }

        if (categoryMap.has(categoryId)) {
            return categoryMap.get(categoryId);
        }

        const normalizedId = this._normalizeCategoryId(categoryId);
        if (normalizedId !== null && categoryMap.has(normalizedId)) {
            return categoryMap.get(normalizedId);
        }

        if (typeof categoryId === 'string') {
            const trimmed = categoryId.trim();
            if (trimmed && categoryMap.has(trimmed)) {
                return categoryMap.get(trimmed);
            }
        }

        return null;
    }

    _getQuestionsPageUrl() {
        const bottomNav = this.quizUI?.elements?.bottomNavElement;
        const hubLink = bottomNav?.querySelector('[data-section-target-django="hub"]')
            || bottomNav?.querySelector('[data-section-target-django="questions"]');
        if (hubLink && hubLink.href) {
            return hubLink.href;
        }

        if (typeof window !== 'undefined' && window.location) {
            return `${window.location.origin}/hub/`;
        }

        return '/hub/';
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
