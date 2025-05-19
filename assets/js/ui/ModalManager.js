// File: assets/js/ui/ModalManager.js

import { TRANSITION_DURATION } from '../utils/constants.js';

export default class ModalManager {
    constructor(quizUIInstance, quizStateInstance, quizDataInstance) {
        // console.log("MODALMANAGER.JS: Constructor - Instanciando ModalManager.");
        this.quizUI = quizUIInstance; // Referência à instância principal da QuizUI
        this.quizState = quizStateInstance;
        this.quizData = quizDataInstance;

        // Elementos DOM são acessados via this.quizUI.elements
        this.elements = this.quizUI.elements;

        this.focusedElementBeforeModal = null; // Genérico para qualquer modal ativo
    }

    /**
     * Método genérico privado para abrir e fechar modais.
     * @param {HTMLElement} overlayElement - O elemento do overlay do modal.
     * @param {HTMLElement} dialogElement - O elemento do diálogo do modal.
     * @param {boolean} show - True para mostrar, false para esconder.
     * @param {HTMLElement} elementToFocusOnOpen - Elemento a focar quando o modal abre.
     */
    _toggleGenericModal(overlayElement, dialogElement, show, elementToFocusOnOpen = null) {
        if (!overlayElement || !dialogElement) {
            // console.warn("ModalManager: Tentativa de alternar modal com elementos ausentes.");
            return;
        }

        const modalVisibleClass = 'modal--visible'; // Classe de visibilidade do overlay
        // Para o painel de filtro, as classes são diferentes
        const isFilterPanel = overlayElement === this.elements.filterPanelOverlay;
        const panelVisibleClass = isFilterPanel ? 'filter-panel--visible' : null;
        const overlayVisibleClass = isFilterPanel ? 'filter-panel-overlay--visible' : modalVisibleClass;

        if (show) {
            this.focusedElementBeforeModal = document.activeElement;
            this.quizUI.showElement(overlayElement);
            if (isFilterPanel) this.quizUI.showElement(dialogElement); // dialogElement é o próprio painel de filtro

            // Força reflow para garantir que a transição ocorra
            // Em alguns casos, apenas `overlayElement.scrollTop` ou `dialogElement.scrollTop` podem ser necessários.
            if (overlayElement) overlayElement.scrollTop;
            if (dialogElement) dialogElement.scrollTop;


            requestAnimationFrame(() => {
                overlayElement.classList.add(overlayVisibleClass);
                if (panelVisibleClass) {
                    dialogElement.classList.add(panelVisibleClass);
                } else {
                    // Para modais genéricos, o dialog é filho do overlay e a classe modal--visible no overlay o anima
                }
                
                overlayElement.removeAttribute('aria-hidden');
                dialogElement.removeAttribute('aria-hidden');

                if (elementToFocusOnOpen) {
                    elementToFocusOnOpen.focus();
                } else if (dialogElement.contains(this.elements.btnCloseExplanationModal) && dialogElement === this.elements.explanationModalDialog) {
                    this.elements.btnCloseExplanationModal.focus(); // Foco no botão de fechar do modal de explicação
                } else if (dialogElement.contains(this.elements.cancelEncerrarBtn) && dialogElement === this.elements.confirmEncerrarModal) {
                    this.elements.cancelEncerrarBtn.focus(); // Foco no botão cancelar do modal de confirmação
                } else if (isFilterPanel) {
                    dialogElement.focus(); // Foca o painel de filtro em si
                } else {
                    dialogElement.focus(); // Foco genérico no diálogo
                }
            });
        } else {
            overlayElement.classList.remove(overlayVisibleClass);
            if (panelVisibleClass) dialogElement.classList.remove(panelVisibleClass);

            const onTransitionEnd = (event) => {
                // Garante que a transição seja do elemento correto (overlay ou dialog, dependendo do tipo de modal)
                const targetElement = isFilterPanel ? dialogElement : overlayElement;
                if (event.target !== targetElement) return;

                // Verifica se o modal realmente não está mais visível pela classe
                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible) {
                    this.quizUI.hideElement(overlayElement);
                    if (isFilterPanel) this.quizUI.hideElement(dialogElement);
                    
                    overlayElement.setAttribute('aria-hidden', 'true');
                    dialogElement.setAttribute('aria-hidden', 'true');
                }
                targetElement.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeModal?.focus();
                this.focusedElementBeforeModal = null;
            };

            const targetTransitionElement = isFilterPanel ? dialogElement : overlayElement;
            targetTransitionElement.addEventListener('transitionend', onTransitionEnd, { once: true });

            // Fallback caso a transição não dispare (ex: se display:none for aplicado antes)
            setTimeout(() => {
                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible) {
                    this.quizUI.hideElement(overlayElement);
                    if (isFilterPanel) this.quizUI.hideElement(dialogElement);
                    overlayElement.setAttribute('aria-hidden', 'true');
                    dialogElement.setAttribute('aria-hidden', 'true');
                }
                targetTransitionElement.removeEventListener('transitionend', onTransitionEnd);
                if (this.focusedElementBeforeModal && document.body.contains(this.focusedElementBeforeModal)) {
                     this.focusedElementBeforeModal.focus();
                }
                this.focusedElementBeforeModal = null;
            }, TRANSITION_DURATION + 150); // Um pouco mais que a duração da transição
        }
    }

    toggleFilterPanel(show) {
        const panel = this.elements.filterPanel;
        const overlay = this.elements.filterPanelOverlay;
        if (!panel || !overlay) return;

        if (show) {
            if (this.quizUI.filterPanelInstance) { // filterPanelInstance é a instância da classe FilterPanel
                this.quizUI.filterPanelInstance.loadCurrentFilters();
            }
            // Mostra o placeholder se o quiz não estiver ativo
            if (this.elements.challengeHubContainer?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName)) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
        } else {
            // Esconde o placeholder e mostra o hub se o quiz não estiver ativo
            if (this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName)) {
                this.quizUI.hideElement(this.elements.placeholderFiltrosContainer);
                if(this.elements.challengeHubContainer) this.quizUI.showElement(this.elements.challengeHubContainer);
            }
        }
        this._toggleGenericModal(overlay, panel, show, panel);
    }

    toggleExplanationModal(show) {
        const overlay = this.elements.explanationModalOverlay;
        const dialog = this.elements.explanationModalDialog;
        if (!overlay || !dialog) return;

        if (show) {
            if (!this.quizState || !this.quizData) {
                // console.warn("ModalManager: QuizState ou QuizData não disponíveis para o modal de explicação.");
                return;
            }
            const currentQuestion = this.quizState.getCurrentQuestion();
            if (!currentQuestion) {
                // console.warn("ModalManager: Nenhuma questão atual para exibir explicação.");
                return;
            }
            const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
            let hasContent = false;

            // Popular conteúdo do modal de explicação
            const generalBlock = this.elements.explanationModalGeneralBlock;
            const generalText = this.elements.explanationModalGeneralText;
            if (generalText && currentQuestion.explicacao_resposta && currentQuestion.explicacao_resposta.trim()) {
                generalText.innerHTML = currentQuestion.explicacao_resposta.replace(/\n/g, '<br>');
                this.quizUI.showElement(generalBlock);
                hasContent = true;
            } else {
                this.quizUI.hideElement(generalBlock);
            }

            const optionsBlock = this.elements.explanationModalOptionsBlock;
            const optionsList = this.elements.explanationModalOptionsList;
            if (optionsList) {
                optionsList.innerHTML = ''; // Limpa antes de popular
                let hasSpecificOptionFeedback = false;
                if (Array.isArray(options)) {
                    options.forEach(opt => {
                        if (opt.feedback_opcao && opt.feedback_opcao.trim()) {
                            hasSpecificOptionFeedback = true;
                            const li = document.createElement('li');
                            li.classList.add(opt.eh_correta ? 'is-correct-feedback' : 'is-incorrect-feedback');
                            
                            const originalTextSpan = document.createElement('span');
                            originalTextSpan.className = 'option-original-text';
                            originalTextSpan.textContent = `Alternativa: "${opt.texto_opcao}"`;
                            li.appendChild(originalTextSpan);

                            const feedbackValueSpan = document.createElement('span');
                            feedbackValueSpan.className = 'option-feedback-value';
                            feedbackValueSpan.classList.add(opt.eh_correta ? 'correct' : 'incorrect');
                            feedbackValueSpan.innerHTML = opt.feedback_opcao.replace(/\n/g, '<br>');
                            li.appendChild(feedbackValueSpan);
                            optionsList.appendChild(li);
                        }
                    });
                }
                if (hasSpecificOptionFeedback) {
                    this.quizUI.showElement(optionsBlock);
                    hasContent = true;
                } else {
                    this.quizUI.hideElement(optionsBlock);
                }
            }

            const divider = this.elements.explanationModalDivider;
            if (generalBlock && !generalBlock.classList.contains(this.quizUI.hiddenClassName) &&
                optionsBlock && !optionsBlock.classList.contains(this.quizUI.hiddenClassName) && divider) {
                this.quizUI.showElement(divider);
            } else if (divider) {
                this.quizUI.hideElement(divider);
            }

            const emptyState = this.elements.explanationModalEmptyState;
            if (!hasContent && emptyState) {
                this.quizUI.showElement(emptyState);
            } else if (emptyState) {
                this.quizUI.hideElement(emptyState);
            }
            this._toggleGenericModal(overlay, dialog, true, this.elements.btnCloseExplanationModal);
        } else {
            this._toggleGenericModal(overlay, dialog, false);
        }
    }

    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay;
        const dialog = this.elements.confirmEncerrarModal;
        this._toggleGenericModal(overlay, dialog, show, this.elements.cancelEncerrarBtn);
    }

    /**
     * Configura os event listeners para os modais.
     * @param {QuizLogic} quizLogicInstance - Instância de QuizLogic para callbacks.
     */
    setupEventListeners(quizLogicInstance) {
        // console.log("MODALMANAGER.JS: setupEventListeners - Configurando listeners dos modais.");

        // Filtro Panel
        this.elements.btnFecharFiltros?.addEventListener('click', () => this.toggleFilterPanel(false));
        this.elements.filterPanelOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.filterPanelOverlay) this.toggleFilterPanel(false);
        });
        // O botão 'Voltar para Modos de Jogo' no placeholder de filtros já está coberto pelo ChallengeHub ou QuizUI principal.

        // Explanation Modal
        this.elements.btnCloseExplanationModal?.addEventListener('click', () => this.toggleExplanationModal(false));
        this.elements.btnGotItExplanation?.addEventListener('click', () => this.toggleExplanationModal(false));
        this.elements.explanationModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.explanationModalOverlay) this.toggleExplanationModal(false);
        });

        // Confirm Modal (Encerrar Quiz)
        this.elements.confirmEncerrarBtn?.addEventListener('click', () => {
            if (quizLogicInstance) quizLogicInstance.forceEndQuizByUser();
            // O modal será fechado por QuizLogic.forceEndQuizByUser -> QuizLogic.endQuiz -> QuizUI.showResults que esconde tudo.
            // Ou explicitamente aqui se necessário: this.toggleConfirmModal(false);
        });
        this.elements.cancelEncerrarBtn?.addEventListener('click', () => this.toggleConfirmModal(false));
        this.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmEncerrarOverlay) this.toggleConfirmModal(false);
        });
        // console.log("MODALMANAGER.JS: setupEventListeners - Listeners dos modais configurados.");
    }

    /**
     * Verifica se algum modal gerenciado por esta classe está visível.
     * @returns {{isVisible: boolean, closeHandler: function|null}}
     */
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
        return { isVisible: false, type: null, closeHandler: null };
    }

    handleEscapeKey() {
        const activeModal = this.getActiveModalInfo();
        if (activeModal.isVisible && activeModal.closeHandler) {
            activeModal.closeHandler();
            return true; // Indica que a tecla Escape foi tratada
        }
        return false; // Nenhum modal ativo para fechar
    }
}