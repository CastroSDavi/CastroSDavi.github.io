// File: assets/js/ui/WarningDisplay.js

export default class WarningDisplay {
    constructor(quizUIInstance) {
        // console.log("WARNINGDISPLAY.JS: Constructor - Instanciando WarningDisplay.");
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements; // Atalho para os elementos DOM

        this.currentActionHandlers = [];
    }

    /**
     * Mostra uma mensagem de aviso/erro na UI.
     * @param {object} messageConfig - Configuração normalizada da mensagem do sistema.
     */
    show(messageConfig) {
        if (!messageConfig || typeof messageConfig !== 'object') {
            return;
        }

        const {
            type = 'info',
            title = null,
            body = null,
            supportingText = null,
            actions = [],
            features = [],
            isTextCentered = false,
            role = 'alert',
            icon = null,
        } = messageConfig;

        const {
            avisoContainer,
            avisoTitle,
            avisoBody,
            avisoSupporting,
            avisoFeatureList,
            avisoActions,
            placeholderFiltrosContainer,
            challengeHubContainer,
            quizSectionContent,
            resultadoCard,
        } = this.elements;

        if (!avisoContainer) {
            return;
        }

        this._teardownActions();

        const baseClasses = ['form-message', `form-message--${type}`];
        if (isTextCentered) {
            baseClasses.push('text-centered');
        }
        avisoContainer.className = baseClasses.join(' ');
        avisoContainer.setAttribute('role', role || 'alert');

        if (icon) {
            avisoContainer.dataset.icon = icon;
        } else {
            delete avisoContainer.dataset.icon;
            avisoContainer.removeAttribute('data-icon');
        }

        if (avisoTitle) {
            if (title) {
                avisoTitle.textContent = title;
                this.quizUI.showElement(avisoTitle);
            } else {
                avisoTitle.textContent = '';
                this.quizUI.hideElement(avisoTitle);
            }
        }

        if (avisoBody) {
            if (body) {
                avisoBody.textContent = body;
                this.quizUI.showElement(avisoBody);
            } else {
                avisoBody.textContent = '';
                this.quizUI.hideElement(avisoBody);
            }
        }

        if (avisoSupporting) {
            if (supportingText) {
                avisoSupporting.textContent = supportingText;
                this.quizUI.showElement(avisoSupporting);
            } else {
                avisoSupporting.textContent = '';
                this.quizUI.hideElement(avisoSupporting);
            }
        }

        if (avisoFeatureList) {
            avisoFeatureList.innerHTML = '';
            if (Array.isArray(features) && features.length > 0) {
                features.forEach(featureText => {
                    const item = document.createElement('li');
                    item.className = 'form-message__feature-item';
                    item.textContent = featureText;
                    avisoFeatureList.appendChild(item);
                });
                this.quizUI.showElement(avisoFeatureList);
            } else {
                this.quizUI.hideElement(avisoFeatureList);
            }
        }

        if (avisoActions) {
            avisoActions.innerHTML = '';
            if (Array.isArray(actions) && actions.length > 0) {
                actions.forEach(action => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = this._getActionButtonClass(action.variant);
                    button.dataset.messageActionId = action.id;

                    if (action.ariaLabel) {
                        button.setAttribute('aria-label', action.ariaLabel);
                    }

                    if (action.icon) {
                        const iconSpan = document.createElement('span');
                        iconSpan.className = 'material-symbols-outlined form-message__action-icon';
                        iconSpan.setAttribute('aria-hidden', 'true');
                        iconSpan.textContent = action.icon;
                        button.appendChild(iconSpan);
                    }

                    const labelSpan = document.createElement('span');
                    labelSpan.className = 'form-message__action-label';
                    labelSpan.textContent = action.label;
                    button.appendChild(labelSpan);

                    const handler = (event) => {
                        event.preventDefault();
                        if (this.quizUI && typeof this.quizUI.handleSystemMessageAction === 'function') {
                            this.quizUI.handleSystemMessageAction(action.id, { action, messageConfig });
                        }
                    };

                    button.addEventListener('click', handler);
                    this.currentActionHandlers.push({ element: button, handler });
                    avisoActions.appendChild(button);
                });
                this.quizUI.showElement(avisoActions);
            } else {
                this.quizUI.hideElement(avisoActions);
            }
        }

        this.quizUI.showElement(avisoContainer);

        this.quizUI.hideElement(placeholderFiltrosContainer);
        this.quizUI.hideElement(challengeHubContainer);
        this.quizUI.hideElement(quizSectionContent);
        this.quizUI.hideElement(resultadoCard);
        this.quizUI.hideElement(this.quizUI.elements.scorePanel);
    }

    clear() {
        // console.log("WARNINGDISPLAY.JS: clear - Limpando aviso.");
        const {
            avisoContainer,
            avisoTitle,
            avisoBody,
            avisoSupporting,
            avisoFeatureList,
            avisoActions,
            placeholderFiltrosContainer,
            challengeHubContainer,
            quizSectionContent,
            resultadoCard,
        } = this.elements;

        this._teardownActions();

        this.quizUI.hideElement(avisoContainer);
        if (avisoContainer) {
            avisoContainer.removeAttribute('role');
            const baseClasses = ['form-message', this.quizUI.hiddenClassName];
            avisoContainer.className = baseClasses.join(' ');
            delete avisoContainer.dataset.icon;
            avisoContainer.removeAttribute('data-icon');
        }

        if (this.quizUI) {
            this.quizUI.lastSystemMessage = null;
        }

        if (avisoTitle) {
            avisoTitle.textContent = '';
            this.quizUI.hideElement(avisoTitle);
        }

        if (avisoBody) {
            avisoBody.textContent = '';
            this.quizUI.hideElement(avisoBody);
        }

        if (avisoSupporting) {
            avisoSupporting.textContent = '';
            this.quizUI.hideElement(avisoSupporting);
        }

        if (avisoFeatureList) {
            avisoFeatureList.innerHTML = '';
            this.quizUI.hideElement(avisoFeatureList);
        }

        if (avisoActions) {
            avisoActions.innerHTML = '';
            this.quizUI.hideElement(avisoActions);
        }

        // Restaura a visibilidade do ChallengeHub se nenhuma outra seção principal (quiz ou resultados) estiver ativa.
        // Isso assume que o ChallengeHub é o estado padrão da página de questões se não houver quiz/resultado/aviso.
        if (document.getElementById('question-section')) { // Verifica se estamos na página de questões
            const isQuizActive = quizSectionContent && !quizSectionContent.classList.contains(this.quizUI.hiddenClassName);
            const areResultsVisible = resultadoCard && !resultadoCard.classList.contains(this.quizUI.hiddenClassName);
            
            if (!isQuizActive && !areResultsVisible && challengeHubContainer) {
                this.quizUI.showElement(challengeHubContainer);
                this.quizUI.hideElement(placeholderFiltrosContainer); // Garante que placeholder esteja escondido
            }
        }
    }

    _teardownActions() {
        if (!Array.isArray(this.currentActionHandlers)) {
            this.currentActionHandlers = [];
            return;
        }

        this.currentActionHandlers.forEach(({ element, handler }) => {
            if (element && handler) {
                element.removeEventListener('click', handler);
            }
        });
        this.currentActionHandlers = [];
    }

    _getActionButtonClass(variant = 'primary') {
        const base = 'button button--small form-message__action-button';
        switch (variant) {
            case 'secondary':
                return `${base} button--secondary`;
            case 'ghost':
            case 'text':
                return `${base} button--text`;
            case 'primary':
            default:
                return `${base} button--primary`;
        }
    }
}