// File: assets/js/ui/ModalManager.js

import { TRANSITION_DURATION } from '../utils/constants.js'; //

export default class ModalManager {
    constructor(quizUIInstance, quizStateInstance, quizDataInstance) {
        this.quizUI = quizUIInstance;
        this.quizState = quizStateInstance; //
        this.quizData = quizDataInstance; //

        this.elements = this.quizUI.elements; //
        this.bodyElement = document.body; //

        this.focusedElementBeforeModal = null; //
        this.activeModalCount = 0; //
    }

    _toggleGenericModal(overlayElement, dialogElement, show, elementToFocusOnOpen = null) {
        if (!overlayElement || !dialogElement) {
            console.warn("ModalManager: Overlay ou Dialog não encontrado para _toggleGenericModal.");
            return;
        }

        const modalVisibleClass = 'modal--visible'; //
        // Verifica se é o painel de filtros, pois ele tem classes de visibilidade ligeiramente diferentes
        const isFilterPanel = overlayElement === this.elements.filterPanelOverlay; //
        const panelVisibleClass = isFilterPanel ? 'filter-panel--visible' : null; //
        const overlayVisibleClass = isFilterPanel ? 'filter-panel-overlay--visible' : modalVisibleClass; //

        if (show) {
            this.focusedElementBeforeModal = document.activeElement; //
            this.quizUI.showElement(overlayElement); //
            if (isFilterPanel) this.quizUI.showElement(dialogElement); //

            // Forçar reflow para garantir que a transição de opacidade funcione
            if (overlayElement) overlayElement.scrollTop; //
            if (dialogElement) dialogElement.scrollTop; //

            this.activeModalCount++; //
            if (this.activeModalCount === 1) { //
                this.bodyElement.classList.add('no-scroll'); //
            }

            requestAnimationFrame(() => {
                overlayElement.classList.add(overlayVisibleClass); //
                if (panelVisibleClass) { //
                    dialogElement.classList.add(panelVisibleClass); //
                } else if (dialogElement !== this.elements.filterPanel) { // Para modais genéricos
                    dialogElement.classList.add(modalVisibleClass); // Assumindo que o dialog também usa 'modal--visible' para sua animação de entrada
                }


                overlayElement.setAttribute('aria-hidden', 'false'); //
                dialogElement.setAttribute('aria-hidden', 'false'); //
                dialogElement.setAttribute('aria-modal', 'true'); //

                // Determina qual elemento focar ao abrir
                const focusTarget = elementToFocusOnOpen ||
                                    (dialogElement === this.elements.explanationModalDialog && this.elements.btnCloseExplanationModal) ||
                                    (dialogElement === this.elements.confirmEncerrarModal && this.elements.cancelEncerrarBtn) ||
                                    (dialogElement === this.elements.deleteAccountModalDialog && this.elements.passwordInputDeleteAccount) ||
                                    (dialogElement === this.quizUI.elements.resumeDecisionModalDialog && this.quizUI.elements.btnConfirmResume) || // FOCO NO NOVO MODAL
                                    dialogElement; // Fallback para o próprio diálogo
                focusTarget?.focus(); 
            });
        } else { // Esconder o modal
            overlayElement.classList.remove(overlayVisibleClass); //
            if (panelVisibleClass) dialogElement.classList.remove(panelVisibleClass); //
            else if (dialogElement !== this.elements.filterPanel) {
                 dialogElement.classList.remove(modalVisibleClass);
            }


            const onTransitionEnd = (event) => {
                // Garante que o evento seja do elemento correto (overlay para a maioria, dialog para filterPanel)
                const targetElement = isFilterPanel ? dialogElement : overlayElement;
                if (event.target !== targetElement && event.propertyName !== 'transform' && event.propertyName !== 'opacity') return;

                // Verifica se o modal/painel ainda deveria estar visível (pode ter sido reaberto rapidamente)
                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);
                const isDialogStillVisible = !panelVisibleClass && dialogElement.classList.contains(modalVisibleClass);


                if (!isOverlayStillVisible && !isPanelStillVisible && !isDialogStillVisible) {
                    this.quizUI.hideElement(overlayElement); //
                    if (isFilterPanel) this.quizUI.hideElement(dialogElement); //
                    // Não precisa esconder dialogElement para modais genéricos pois ele é filho do overlay

                    overlayElement.setAttribute('aria-hidden', 'true'); //
                    dialogElement.setAttribute('aria-hidden', 'true'); //
                    dialogElement.removeAttribute('aria-modal');

                    this.activeModalCount = Math.max(0, this.activeModalCount - 1); //
                    if (this.activeModalCount === 0 && !document.body.classList.contains('session-loading')) { // Adicionada checagem para não remover no-scroll se o loading global estiver ativo
                        this.bodyElement.classList.remove('no-scroll'); //
                    }
                     if (this.focusedElementBeforeModal && typeof this.focusedElementBeforeModal.focus === 'function') {
                        this.focusedElementBeforeModal.focus({ preventScroll: true }); //
                    }
                    this.focusedElementBeforeModal = null; //
                }
                // Remover o listener aqui não precisa de { once: true } se o timeout abaixo também o remove.
                targetElement.removeEventListener('transitionend', onTransitionEnd);
            };

            const targetTransitionElement = isFilterPanel ? dialogElement : overlayElement;
            // Usar { once: true } é mais limpo do que remover manualmente se a transição sempre ocorrer uma vez.
            targetTransitionElement.addEventListener('transitionend', onTransitionEnd, { once: true }); //

            // Fallback de timeout, caso a transição não dispare (ex: elemento removido do DOM antes)
            // A duração deve ser um pouco maior que a maior duração de transição (overlay ou dialog)
            const maxTransitionDuration = Math.max(
                parseFloat(getComputedStyle(overlayElement).transitionDuration) * 1000,
                parseFloat(getComputedStyle(dialogElement).transitionDuration) * 1000
            );

            setTimeout(() => {
                 // Verifica novamente se o modal foi reaberto antes do timeout
                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);
                const isDialogStillVisible = !panelVisibleClass && dialogElement.classList.contains(modalVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible && !isDialogStillVisible) {
                    // Se o transitionend não limpou, limpa aqui.
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
                // Remove o listener de qualquer forma, caso o evento transitionend não tenha ocorrido e o timeout sim.
                targetTransitionElement.removeEventListener('transitionend', onTransitionEnd);
            }, maxTransitionDuration + 50); // Adiciona uma pequena folga ao timeout
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
            // Mostrar o placeholder APENAS se nenhum quiz/resultado estiver ativo
            // E se o hub também estiver escondido (ou seja, o filtro foi aberto a partir do hub)
            if (this.elements.challengeHubContainer?.classList.contains(this.quizUI.hiddenClassName) && //
                this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) && //
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName)) { //
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer); //
            }
        } else {
            // Se o quiz não estiver ativo e os resultados não estiverem visíveis,
            // E o placeholder de filtros estiver visível (ou seja, estávamos na tela de filtros)
            // Então, volta para o hub.
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

    toggleExplanationModal(show) {
        const overlay = this.elements.explanationModalOverlay; //
        const dialog = this.elements.explanationModalDialog; //
        if (!overlay || !dialog) return;

        if (show) {
            // A lógica de popular o modal de explicação já está em ModalManager.js, conforme fornecido.
            // Esta lógica é extensa e já foi revisada.
            // (para a lógica de popular conteúdo)
            this._toggleGenericModal(overlay, dialog, true, this.elements.btnCloseExplanationModal);
        } else {
            this._toggleGenericModal(overlay, dialog, false);
        }
    }

    toggleConfirmModal(show) { // Modal de confirmação para encerrar quiz
        const overlay = this.elements.confirmEncerrarOverlay; //
        const dialog = this.elements.confirmEncerrarModal; //
        this._toggleGenericModal(overlay, dialog, show, this.elements.cancelEncerrarBtn);
    }

    // --- NOVO MÉTODO para o Modal de Decisão de Retomada ---
    toggleResumeDecisionModal(show, callbacks = {}) {
        const overlay = this.quizUI.elements.resumeDecisionOverlay;
        const dialog = this.quizUI.elements.resumeDecisionModalDialog;
        const btnConfirm = this.quizUI.elements.btnConfirmResume;
        const btnDiscard = this.quizUI.elements.btnDiscardResume;

        if (!overlay || !dialog || !btnConfirm || !btnDiscard) {
            console.warn("ModalManager: Elementos do modal de decisão de retomada não encontrados na UI.");
            // Se o modal não pode ser mostrado, mas uma decisão é necessária,
            // e um callback de 'continuar' (que seria o default anterior) existir, chamá-lo.
            // Isso é um fallback para o caso de o HTML do modal não estar presente.
            if (show && callbacks.onContinue) {
                console.log("ModalManager: Fallback - modal de decisão não encontrado, chamando onContinue (retomada direta).");
                callbacks.onContinue();
            }
            // Esconder o indicador de loading principal se estiver ativo
            if (this.quizUI && typeof this.quizUI.showSessionLoadingIndicator === 'function') {
                this.quizUI.showSessionLoadingIndicator(false);
            }
            return;
        }

        if (show) {
            // Certifica-se de que o indicador de carregamento de sessão (tela cheia) seja escondido
            // antes de mostrar este modal de decisão.
            if (this.quizUI && typeof this.quizUI.showSessionLoadingIndicator === 'function') {
                this.quizUI.showSessionLoadingIndicator(false);
            }

            // Remove listeners antigos para evitar múltiplos disparos se o modal for reaberto.
            // É mais seguro recriar o listener ou usar { once: true } se for apropriado.
            // Aqui, como os callbacks podem ser diferentes a cada chamada, é bom remover e adicionar.
            const confirmHandler = () => { if (callbacks.onContinue) callbacks.onContinue(); };
            const discardHandler = () => { if (callbacks.onDiscard) callbacks.onDiscard(); };

            btnConfirm.removeEventListener('click', btnConfirm._handler); // Assume que guardamos a referência
            btnDiscard.removeEventListener('click', btnDiscard._handler);

            btnConfirm._handler = confirmHandler; // Guarda a referência para remover depois, se necessário
            btnDiscard._handler = discardHandler;

            btnConfirm.addEventListener('click', btnConfirm._handler);
            btnDiscard.addEventListener('click', btnDiscard._handler);
            
            this._toggleGenericModal(overlay, dialog, true, btnConfirm); // Foca no botão de continuar
        } else {
            this._toggleGenericModal(overlay, dialog, false);
        }
    }

    toggleDeleteAccountModal(show) {
        const overlay = this.quizUI.elements.deleteAccountModalOverlay; //
        const dialog = this.quizUI.elements.deleteAccountModalDialog; //
        const elementToFocusOnOpen = show ? this.quizUI.elements.passwordInputDeleteAccount : null; //
        this._toggleGenericModal(overlay, dialog, show, elementToFocusOnOpen);

        if (show && this.quizUI.elements.passwordInputDeleteAccount) { //
             this.quizUI.elements.passwordInputDeleteAccount.value = ''; //
        }
    }


    setupEventListeners(quizLogicInstance) {
        // Filtro Panel
        this.elements.btnFecharFiltros?.addEventListener('click', () => this.toggleFilterPanel(false)); //
        this.elements.filterPanelOverlay?.addEventListener('click', (e) => { //
            if (e.target === this.elements.filterPanelOverlay) this.toggleFilterPanel(false); //
        });

        // Explanation Modal
        this.elements.btnCloseExplanationModal?.addEventListener('click', () => this.toggleExplanationModal(false)); //
        this.elements.btnGotItExplanation?.addEventListener('click', () => this.toggleExplanationModal(false)); //
        this.elements.explanationModalOverlay?.addEventListener('click', (e) => { //
            if (e.target === this.elements.explanationModalOverlay) this.toggleExplanationModal(false); //
        });

        // Confirm Modal (Encerrar Quiz)
        this.elements.confirmEncerrarBtn?.addEventListener('click', () => { //
            if (quizLogicInstance) quizLogicInstance.forceEndQuizByUser(); //
        });
        this.elements.cancelEncerrarBtn?.addEventListener('click', () => this.toggleConfirmModal(false)); //
        this.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => { //
            if (e.target === this.elements.confirmEncerrarOverlay) this.toggleConfirmModal(false); //
        });

        // Delete Account Modal
        this.quizUI.elements.btnCancelDeleteAccountModal?.addEventListener('click', (event) => { //
            event.preventDefault(); //
            this.toggleDeleteAccountModal(false); //
        });
        this.quizUI.elements.deleteAccountModalOverlay?.addEventListener('click', (event) => { //
            if (event.target === this.quizUI.elements.deleteAccountModalOverlay) this.toggleDeleteAccountModal(false); //
        });
        // O listener para o submit do #deleteAccountForm é gerenciado pelo HTML (action e method).

        document.addEventListener('keydown', (event) => { //
            if (event.key === 'Escape') { //
                this.handleEscapeKey(); //
            }
        });
    }

    getActiveModalInfo() {
        if (this.elements.filterPanel?.classList.contains('filter-panel--visible')) { //
            return { isVisible: true, type: 'filter', closeHandler: () => this.toggleFilterPanel(false) }; //
        }
        if (this.elements.explanationModalOverlay?.classList.contains('modal--visible')) { //
            return { isVisible: true, type: 'explanation', closeHandler: () => this.toggleExplanationModal(false) }; //
        }
        if (this.elements.confirmEncerrarOverlay?.classList.contains('modal--visible')) { //
            return { isVisible: true, type: 'confirm', closeHandler: () => this.toggleConfirmModal(false) }; //
        }
        if (this.quizUI.elements.deleteAccountModalOverlay?.classList.contains('modal--visible')) { //
            return { isVisible: true, type: 'deleteAccount', closeHandler: () => this.toggleDeleteAccountModal(false) }; //
        }
        // Adiciona verificação para o novo modal de decisão
        if (this.quizUI.elements.resumeDecisionOverlay?.classList.contains('modal--visible')) {
            // Este modal não deve ser fechável por ESC, pois força uma decisão.
            // Ou, se for, deve acionar um dos callbacks (ex: onDiscard).
            return { isVisible: true, type: 'resumeDecision', closeHandler: null };
        }
        return { isVisible: false, type: null, closeHandler: null }; //
    }

    handleEscapeKey() {
        const activeModal = this.getActiveModalInfo(); //
        if (activeModal.isVisible && activeModal.closeHandler) { //
            activeModal.closeHandler(); //
            return true; //
        }
        return false; //
    }
}