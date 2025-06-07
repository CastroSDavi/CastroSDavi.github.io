// File: assets/js/ui/ModalManager.js

import { TRANSITION_DURATION } from '../utils/constants.js'; //

export default class ModalManager {
    constructor(quizUIInstance, quizStateInstance, quizDataInstance) {
        this.quizUI = quizUIInstance;
        this.quizState = quizStateInstance;
        this.quizData = quizDataInstance;

        this.elements = this.quizUI.elements;
        this.bodyElement = document.body;

        this.focusedElementBeforeModal = null;
        this.activeModalCount = 0;
    }

    _toggleGenericModal(overlayElement, dialogElement, show, elementToFocusOnOpen = null) {
        if (!overlayElement || !dialogElement) {
            console.warn("ModalManager: Overlay ou Dialog não encontrado para _toggleGenericModal.");
            return;
        }

        const modalVisibleClass = 'modal--visible';
        const isFilterPanel = overlayElement === this.elements.filterPanelOverlay;
        const panelVisibleClass = isFilterPanel ? 'filter-panel--visible' : null;
        const overlayVisibleClass = isFilterPanel ? 'filter-panel-overlay--visible' : modalVisibleClass;

        if (show) {
            this.focusedElementBeforeModal = document.activeElement;
            this.quizUI.showElement(overlayElement);
            if (isFilterPanel) this.quizUI.showElement(dialogElement);

            if (overlayElement) overlayElement.scrollTop;
            if (dialogElement) dialogElement.scrollTop;

            this.activeModalCount++;
            if (this.activeModalCount === 1) {
                this.bodyElement.classList.add('no-scroll');
            }

            requestAnimationFrame(() => {
                overlayElement.classList.add(overlayVisibleClass);
                if (panelVisibleClass) {
                    dialogElement.classList.add(panelVisibleClass);
                } else if (dialogElement !== this.elements.filterPanel) {
                    dialogElement.classList.add(modalVisibleClass);
                }

                overlayElement.setAttribute('aria-hidden', 'false');
                dialogElement.setAttribute('aria-hidden', 'false');
                dialogElement.setAttribute('aria-modal', 'true');

                const focusTarget = elementToFocusOnOpen || dialogElement;
                focusTarget?.focus();
            });
        } else {
            overlayElement.classList.remove(overlayVisibleClass);
            if (panelVisibleClass) dialogElement.classList.remove(panelVisibleClass);
            else if (dialogElement !== this.elements.filterPanel) {
                dialogElement.classList.remove(modalVisibleClass);
            }

            const onTransitionEnd = (event) => {
                const targetElement = isFilterPanel ? dialogElement : overlayElement;
                if (event.target !== targetElement && event.propertyName !== 'transform' && event.propertyName !== 'opacity') return;

                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);
                const isDialogStillVisible = !panelVisibleClass && dialogElement.classList.contains(modalVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible && !isDialogStillVisible) {
                    this.quizUI.hideElement(overlayElement);
                    if (isFilterPanel) this.quizUI.hideElement(dialogElement);

                    overlayElement.setAttribute('aria-hidden', 'true');
                    dialogElement.setAttribute('aria-hidden', 'true');
                    dialogElement.removeAttribute('aria-modal');

                    this.activeModalCount = Math.max(0, this.activeModalCount - 1);
                    if (this.activeModalCount === 0 && !document.body.classList.contains('session-loading')) {
                        this.bodyElement.classList.remove('no-scroll');
                    }
                    if (this.focusedElementBeforeModal && typeof this.focusedElementBeforeModal.focus === 'function') {
                        this.focusedElementBeforeModal.focus({ preventScroll: true });
                    }
                    this.focusedElementBeforeModal = null;
                }
                targetElement.removeEventListener('transitionend', onTransitionEnd);
            };
            
            const targetTransitionElement = isFilterPanel ? dialogElement : overlayElement;
            targetTransitionElement.addEventListener('transitionend', onTransitionEnd, { once: true });
            
            const maxTransitionDuration = Math.max(
                parseFloat(getComputedStyle(overlayElement).transitionDuration) * 1000,
                parseFloat(getComputedStyle(dialogElement).transitionDuration) * 1000
            );

            setTimeout(() => {
                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);
                const isDialogStillVisible = !panelVisibleClass && dialogElement.classList.contains(modalVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible && !isDialogStillVisible) {
                    if (!overlayElement.classList.contains(this.quizUI.hiddenClassName)) {
                        this.quizUI.hideElement(overlayElement);
                        if (isFilterPanel) this.quizUI.hideElement(dialogElement);
                        overlayElement.setAttribute('aria-hidden', 'true');
                        dialogElement.setAttribute('aria-hidden', 'true');
                        dialogElement.removeAttribute('aria-modal');

                        this.activeModalCount = Math.max(0, this.activeModalCount - 1);
                        if (this.activeModalCount === 0 && !document.body.classList.contains('session-loading')) {
                            this.bodyElement.classList.remove('no-scroll');
                        }
                        if (this.focusedElementBeforeModal && typeof this.focusedElementBeforeModal.focus === 'function' && document.body.contains(this.focusedElementBeforeModal)) {
                             this.focusedElementBeforeModal.focus({ preventScroll: true });
                        }
                        this.focusedElementBeforeModal = null;
                    }
                }
                targetTransitionElement.removeEventListener('transitionend', onTransitionEnd);
            }, maxTransitionDuration + 50);
        }
    }

    _populateAndShowExplanationContent() {
        const {
            explanationModalDifficulty, explanationModalCategories, explanationModalMetaContainer,
            explanationModalGeneralBlock, explanationModalGeneralText,
            explanationModalOptionsBlock, explanationModalOptionsList,
            explanationModalReferenceBlock, explanationModalReferenceText,
            explanationModalDividerGeneralOptions, explanationModalDividerOptionsReference,
            explanationModalEmptyState
        } = this.elements;
    
        const question = this.quizState?.getCurrentQuestion();
        if (!question) {
            this.quizUI.hideElement(explanationModalMetaContainer);
            this.quizUI.showElement(explanationModalEmptyState);
            return;
        }
    
        const hasGeneralExplanation = question.explicacao_resposta?.trim();
        const hasReference = question.referencia_bibliografica?.trim();
        const hasOptionFeedback = question.opcoes?.some(op => op.feedback_opcao?.trim());
    
        if (!hasGeneralExplanation && !hasReference && !hasOptionFeedback) {
            this.quizUI.showElement(explanationModalEmptyState);
            [explanationModalMetaContainer, explanationModalGeneralBlock, explanationModalOptionsBlock, explanationModalReferenceBlock].forEach(el => this.quizUI.hideElement(el));
            return;
        }
    
        this.quizUI.hideElement(explanationModalEmptyState);
    
        // Preenche Meta Info (Dificuldade e Categorias)
        if (explanationModalDifficulty) explanationModalDifficulty.textContent = question.nivel_dificuldade || 'Não informada';
        
        const categoryNames = question.categoria_ids?.map(id => this.quizData?.allCategories.find(c => c.id_categoria === id)?.nome_categoria).filter(Boolean).join(', ') || 'Não informadas';
        if (explanationModalCategories) explanationModalCategories.textContent = categoryNames;
        this.quizUI.showElement(explanationModalMetaContainer);
    
        // Bloco de Explicação Geral
        if (hasGeneralExplanation && explanationModalGeneralText) {
            explanationModalGeneralText.textContent = question.explicacao_resposta;
            this.quizUI.showElement(explanationModalGeneralBlock);
        } else {
            this.quizUI.hideElement(explanationModalGeneralBlock);
        }
    
        // Bloco de Opções
        if (hasOptionFeedback && explanationModalOptionsList) {
            explanationModalOptionsList.innerHTML = ''; // Limpa a lista
            question.opcoes.forEach(opt => {
                if (opt.feedback_opcao?.trim()) {
                    const li = document.createElement('li');
                    li.className = 'explanation-modal__option-item';
    
                    if (opt.eh_correta) li.classList.add('is-correct-option');
                    if (question.respostaDadaId === opt.id_opcao_resposta) {
                        li.classList.add('is-user-selected');
                        if (!opt.eh_correta) li.classList.add('is-user-incorrect');
                    } else if (!opt.eh_correta) {
                        li.classList.add('is-generally-incorrect');
                    }
    
                    const textSpan = document.createElement('span');
                    textSpan.className = 'option-item__text';
                    textSpan.textContent = opt.texto_opcao;
    
                    const feedbackP = document.createElement('p');
                    feedbackP.className = 'option-item__feedback';
                    feedbackP.textContent = opt.feedback_opcao;
    
                    li.appendChild(textSpan);
                    li.appendChild(feedbackP);
                    explanationModalOptionsList.appendChild(li);
                }
            });
            this.quizUI.showElement(explanationModalOptionsBlock);
        } else {
            this.quizUI.hideElement(explanationModalOptionsBlock);
        }
    
        // Bloco de Referência
        if (hasReference && explanationModalReferenceText) {
            explanationModalReferenceText.textContent = question.referencia_bibliografica;
            this.quizUI.showElement(explanationModalReferenceBlock);
        } else {
            this.quizUI.hideElement(explanationModalReferenceBlock);
        }
    
        // Controla a visibilidade das linhas divisórias
        const showDivider1 = hasGeneralExplanation && (hasOptionFeedback || hasReference);
        const showDivider2 = hasOptionFeedback && hasReference;
        showDivider1 ? this.quizUI.showElement(explanationModalDividerGeneralOptions) : this.quizUI.hideElement(explanationModalDividerGeneralOptions);
        showDivider2 ? this.quizUI.showElement(explanationModalDividerOptionsReference) : this.quizUI.hideElement(explanationModalDividerOptionsReference);
    }
    
    // FUNÇÃO PRINCIPAL ATUALIZADA
    toggleExplanationModal(show) {
        const overlay = this.elements.explanationModalOverlay;
        const dialog = this.elements.explanationModalDialog;
        if (!overlay || !dialog) return;
    
        if (show) {
            this._populateAndShowExplanationContent(); // <<< LÓGICA ADICIONADA AQUI
            this._toggleGenericModal(overlay, dialog, true, this.elements.btnCloseExplanationModal);
        } else {
            this._toggleGenericModal(overlay, dialog, false);
        }
    }

    toggleFilterPanel(show) {
        const panel = this.elements.filterPanel; //
        const overlay = this.elements.filterPanelOverlay; //
        if (!panel || !overlay) return;

        if (show) {
            if (this.quizUI.filterPanelInstance) {
                this.quizUI.filterPanelInstance.loadCurrentFilters(); //
            }
            if (this.elements.challengeHubContainer?.classList.contains(this.quizUI.hiddenClassName) && //
                this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) && //
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName)) { //
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer); //
            }
        } else {
            if (this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName) &&
                !this.elements.placeholderFiltrosContainer?.classList.contains(this.quizUI.hiddenClassName)
                ) {
                this.quizUI.hideElement(this.elements.placeholderFiltrosContainer); //
                if(this.elements.challengeHubContainer) this.quizUI.showElement(this.elements.challengeHubContainer); //
            }
        }
        this._toggleGenericModal(overlay, panel, show, panel); // Foca no painel ao abrir
    }

    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay;
        const dialog = this.elements.confirmEncerrarModal;
        this._toggleGenericModal(overlay, dialog, show, this.elements.cancelEncerrarBtn);
    }
    
    toggleResumeDecisionModal(show, callbacks = {}) {
        const overlay = this.quizUI.elements.resumeDecisionOverlay;
        const dialog = this.quizUI.elements.resumeDecisionModalDialog;
        const btnConfirm = this.quizUI.elements.btnConfirmResume;
        const btnDiscard = this.quizUI.elements.btnDiscardResume;

        if (!overlay || !dialog || !btnConfirm || !btnDiscard) {
            if (show && callbacks.onContinue) {
                callbacks.onContinue();
            }
            if (this.quizUI && typeof this.quizUI.showSessionLoadingIndicator === 'function') {
                this.quizUI.showSessionLoadingIndicator(false);
            }
            return;
        }

        if (show) {
            if (this.quizUI && typeof this.quizUI.showSessionLoadingIndicator === 'function') {
                this.quizUI.showSessionLoadingIndicator(false);
            }

            const confirmHandler = () => { if (callbacks.onContinue) callbacks.onContinue(); };
            const discardHandler = () => { if (callbacks.onDiscard) callbacks.onDiscard(); };

            btnConfirm.removeEventListener('click', btnConfirm._handler);
            btnDiscard.removeEventListener('click', btnDiscard._handler);

            btnConfirm._handler = confirmHandler;
            btnDiscard._handler = discardHandler;

            btnConfirm.addEventListener('click', btnConfirm._handler);
            btnDiscard.addEventListener('click', btnDiscard._handler);
            
            this._toggleGenericModal(overlay, dialog, true, btnConfirm);
        } else {
            this._toggleGenericModal(overlay, dialog, false);
        }
    }

    toggleDeleteAccountModal(show) {
        const overlay = this.quizUI.elements.deleteAccountModalOverlay;
        const dialog = this.quizUI.elements.deleteAccountModalDialog;
        const elementToFocusOnOpen = show ? this.quizUI.elements.passwordInputDeleteAccount : null;
        this._toggleGenericModal(overlay, dialog, show, elementToFocusOnOpen);

        if (show && this.quizUI.elements.passwordInputDeleteAccount) {
             this.quizUI.elements.passwordInputDeleteAccount.value = '';
        }
    }

    setupEventListeners(quizLogicInstance) {
        this.elements.btnFecharFiltros?.addEventListener('click', () => this.toggleFilterPanel(false));
        this.elements.filterPanelOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.filterPanelOverlay) this.toggleFilterPanel(false);
        });

        this.elements.btnCloseExplanationModal?.addEventListener('click', () => this.toggleExplanationModal(false));
        this.elements.btnGotItExplanation?.addEventListener('click', () => this.toggleExplanationModal(false));
        this.elements.explanationModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.explanationModalOverlay) this.toggleExplanationModal(false);
        });

        this.elements.confirmEncerrarBtn?.addEventListener('click', () => {
            if (quizLogicInstance) quizLogicInstance.forceEndQuizByUser();
        });
        this.elements.cancelEncerrarBtn?.addEventListener('click', () => this.toggleConfirmModal(false));
        this.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmEncerrarOverlay) this.toggleConfirmModal(false);
        });

        this.quizUI.elements.btnCancelDeleteAccountModal?.addEventListener('click', (event) => {
            event.preventDefault();
            this.toggleDeleteAccountModal(false);
        });
        this.quizUI.elements.deleteAccountModalOverlay?.addEventListener('click', (event) => {
            if (event.target === this.quizUI.elements.deleteAccountModalOverlay) this.toggleDeleteAccountModal(false);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.handleEscapeKey();
            }
        });
    }

    getActiveModalInfo() {
        if (this.elements.filterPanel?.classList.contains('filter-panel--visible')) {
            return { isVisible: true, type: 'filter', closeHandler: () => this.toggleFilterPanel(false) };
        }
        if (this.elements.explanationModalOverlay?.classList.contains('modal--visible')) {
            return { isVisible: true, type: 'explanation', closeHandler: () => this.toggleExplanationModal(false) };
        }
        if (this.elements.confirmEncerrarOverlay?.classList.contains('modal--visible')) {
            return { isVisible: true, type: 'confirm', closeHandler: () => this.toggleConfirmModal(false) };
        }
        if (this.quizUI.elements.deleteAccountModalOverlay?.classList.contains('modal--visible')) {
            return { isVisible: true, type: 'deleteAccount', closeHandler: () => this.toggleDeleteAccountModal(false) };
        }
        if (this.quizUI.elements.resumeDecisionOverlay?.classList.contains('modal--visible')) {
            return { isVisible: true, type: 'resumeDecision', closeHandler: null };
        }
        return { isVisible: false, type: null, closeHandler: null };
    }

    handleEscapeKey() {
        const activeModal = this.getActiveModalInfo();
        if (activeModal.isVisible && activeModal.closeHandler) {
            activeModal.closeHandler();
            return true;
        }
        return false;
    }
}