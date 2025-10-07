// File: assets/js/ui/ModalManager.js

import { TRANSITION_DURATION } from '../utils/constants.js';

export default class ModalManager {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements;
        this.bodyElement = document.body;

        this.focusedElementBeforeModal = null;
        this.activeModalCount = 0;
        
        // As dependências como `store` e `actionOrchestrator` serão injetadas via setters
        this.store = null;
        this.actionOrchestrator = null;
    }

    // --- MÉTODOS DE INJEÇÃO ---
    setStore(storeInstance) {
        this.store = storeInstance;
        // O ModalManager agora pode, se necessário, ouvir o estado do store
        // para controlar a visibilidade dos modais de forma reativa.
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
        // Configura os listeners dos modais que disparam ações
        this._setupModalActionListeners();
    }
    
    // --- LÓGICA DE EVENTOS ---
    
    _setupModalActionListeners() {
        // Listener para fechar o painel de filtros
        this.elements.btnFecharFiltros?.addEventListener('click', () => this.toggleFilterPanel(false));
        this.elements.filterPanelOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.filterPanelOverlay) this.toggleFilterPanel(false);
        });

        // Listeners para fechar o modal de explicação
        this.elements.btnCloseExplanationModal?.addEventListener('click', () => this.toggleExplanationModal(false));
        this.elements.btnGotItExplanation?.addEventListener('click', () => this.toggleExplanationModal(false));
        this.elements.explanationModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.explanationModalOverlay) this.toggleExplanationModal(false);
        });

        // Listeners para o modal de confirmação de encerrar quiz
        this.elements.confirmEncerrarBtn?.addEventListener('click', () => {
            // Delega a ação para o orquestrador
            this.actionOrchestrator?.forceEndQuizByUser();
        });
        this.elements.cancelEncerrarBtn?.addEventListener('click', () => this.toggleConfirmModal(false));
        this.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmEncerrarOverlay) this.toggleConfirmModal(false);
        });
        
        // Listeners para o modal de apagar conta
        this.elements.btnCancelDeleteAccountModal?.addEventListener('click', (event) => {
            event.preventDefault();
            this.toggleDeleteAccountModal(false);
        });
        this.elements.deleteAccountModalOverlay?.addEventListener('click', (event) => {
            if (event.target === this.elements.deleteAccountModalOverlay) this.toggleDeleteAccountModal(false);
        });
        
        // Listener global para a tecla 'Escape'
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.handleEscapeKey();
            }
        });
    }

    // --- MÉTODOS DE CONTROLE DE MODAL (MANTIDOS, MAS PODEM SER REATIVOS NO FUTURO) ---

    _toggleGenericModal(overlayElement, dialogElement, show, elementToFocusOnOpen = null) {
        // A implementação deste método permanece a mesma do arquivo original
        if (!overlayElement || !dialogElement) return;

        const modalVisibleClass = 'modal--visible';
        const isFilterPanel = overlayElement === this.elements.filterPanelOverlay;
        const panelVisibleClass = isFilterPanel ? 'filter-panel--visible' : null;
        const overlayVisibleClass = isFilterPanel ? 'filter-panel-overlay--visible' : modalVisibleClass;

        if (show) {
            this.focusedElementBeforeModal = document.activeElement;
            this.quizUI.showElement(overlayElement);
            if (isFilterPanel) this.quizUI.showElement(dialogElement);

            if (overlayElement) overlayElement.scrollTop = 0;
            if (dialogElement) dialogElement.scrollTop = 0;

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
            
            const onTransitionEnd = () => {
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
            };

            const targetTransitionElement = isFilterPanel ? dialogElement : overlayElement;
            targetTransitionElement.addEventListener('transitionend', onTransitionEnd, { once: true });
        }
    }

    _populateAndShowExplanationContent() {
        // A implementação deste método permanece a mesma do arquivo original,
        // mas agora obtém os dados do store.
        const state = this.store.getState();
        const question = state.quiz.currentQuestionsSet[state.quiz.currentQuestionIndex];
        const allCategories = state.geral.allCategories;
        const {
            explanationModalDifficulty, explanationModalCategories, explanationModalMetaContainer,
            explanationModalGeneralBlock, explanationModalGeneralText,
            explanationModalOptionsBlock, explanationModalOptionsList,
            explanationModalReferenceBlock, explanationModalReferenceText,
            explanationModalDividerGeneralOptions, explanationModalDividerOptionsReference,
            explanationModalEmptyState
        } = this.elements;
        
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
    
        if (explanationModalDifficulty) explanationModalDifficulty.textContent = question.nivel_dificuldade || 'Não informada';
        const categoryLabels = this._getCategoryLabelsForModal(question, allCategories);
        if (explanationModalCategories) {
            explanationModalCategories.textContent = categoryLabels.length > 0
                ? categoryLabels.join(', ')
                : 'Não informadas';
        }
        this.quizUI.showElement(explanationModalMetaContainer);
    
        if (hasGeneralExplanation && explanationModalGeneralText) {
            explanationModalGeneralText.textContent = question.explicacao_resposta;
            this.quizUI.showElement(explanationModalGeneralBlock);
        } else {
            this.quizUI.hideElement(explanationModalGeneralBlock);
        }
    
        if (hasOptionFeedback && explanationModalOptionsList) {
            explanationModalOptionsList.innerHTML = '';
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
    
        if (hasReference && explanationModalReferenceText) {
            explanationModalReferenceText.textContent = question.referencia_bibliografica;
            this.quizUI.showElement(explanationModalReferenceBlock);
        } else {
            this.quizUI.hideElement(explanationModalReferenceBlock);
        }
    
        const showDivider1 = hasGeneralExplanation && (hasOptionFeedback || hasReference);
        const showDivider2 = hasOptionFeedback && hasReference;
        showDivider1 ? this.quizUI.showElement(explanationModalDividerGeneralOptions) : this.quizUI.hideElement(explanationModalDividerGeneralOptions);
        showDivider2 ? this.quizUI.showElement(explanationModalDividerOptionsReference) : this.quizUI.hideElement(explanationModalDividerOptionsReference);
    }
    
    toggleExplanationModal(show) {
        const overlay = this.elements.explanationModalOverlay;
        const dialog = this.elements.explanationModalDialog;
        if (!overlay || !dialog) return;
        if (show) {
            this._populateAndShowExplanationContent();
            this._toggleGenericModal(overlay, dialog, true, this.elements.btnCloseExplanationModal);
        } else {
            this._toggleGenericModal(overlay, dialog, false);
        }
    }

    toggleFilterPanel(show) {
        const panel = this.elements.filterPanel;
        const overlay = this.elements.filterPanelOverlay;
        if (!panel || !overlay) return;

        if (show) {
            if (this.quizUI.filterPanelInstance) {
                // Em vez de 'loadCurrentFilters', o painel pode ser renderizado com o estado atual do store
                this.quizUI.filterPanelInstance.render(this.store.getState());
            }
            if (this.elements.challengeHubContainer?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName)) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
        } else {
            if (this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName) &&
                !this.elements.placeholderFiltrosContainer?.classList.contains(this.quizUI.hiddenClassName)
                ) {
                this.quizUI.hideElement(this.elements.placeholderFiltrosContainer);
                if(this.elements.challengeHubContainer) this.quizUI.showElement(this.elements.challengeHubContainer);
            }
        }
        this._toggleGenericModal(overlay, panel, show, panel);
    }

    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay;
        const dialog = this.elements.confirmEncerrarModal;
        if (!overlay || !dialog) {
            return;
        }

        if (
            show &&
            this.elements.filterPanel &&
            this.elements.filterPanel.classList.contains('filter-panel--visible')
        ) {
            this.toggleFilterPanel(false);
        }

        this._toggleGenericModal(overlay, dialog, show, this.elements.cancelEncerrarBtn);
    }
    
    toggleResumeDecisionModal(show, callbacks = {}) {
        const { resumeDecisionOverlay, resumeDecisionModalDialog, btnConfirmResume, btnDiscardResume } = this.quizUI.elements;
        
        if (!resumeDecisionOverlay || !resumeDecisionModalDialog || !btnConfirmResume || !btnDiscardResume) {
            if (show && callbacks.onContinue) callbacks.onContinue();
            this.quizUI.showSessionLoadingIndicator(false);
            return;
        }

        if (show) {
            this.quizUI.showSessionLoadingIndicator(false);
            
            const confirmHandler = () => { if (callbacks.onContinue) callbacks.onContinue(); };
            const discardHandler = () => { if (callbacks.onDiscard) callbacks.onDiscard(); };
            
            btnConfirmResume.removeEventListener('click', btnConfirmResume._handler);
            btnDiscardResume.removeEventListener('click', btnDiscardResume._handler);
            
            btnConfirmResume._handler = confirmHandler;
            btnDiscardResume._handler = discardHandler;
            
            btnConfirmResume.addEventListener('click', btnConfirmResume._handler);
            btnDiscardResume.addEventListener('click', btnDiscardResume._handler);
            
            this._toggleGenericModal(resumeDecisionOverlay, resumeDecisionModalDialog, true, btnConfirmResume);
        } else {
            this._toggleGenericModal(resumeDecisionOverlay, resumeDecisionModalDialog, false);
        }
    }

    toggleDeleteAccountModal(show) {
        const { deleteAccountModalOverlay, deleteAccountModalDialog, passwordInputDeleteAccount } = this.quizUI.elements;
        const elementToFocusOnOpen = show ? passwordInputDeleteAccount : null;
        this._toggleGenericModal(deleteAccountModalOverlay, deleteAccountModalDialog, show, elementToFocusOnOpen);
        if (show && passwordInputDeleteAccount) {
             passwordInputDeleteAccount.value = '';
        }
    }
    
    getActiveModalInfo() {
        // Implementação mantida, pois é uma lógica interna de verificação de estado do DOM
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

    _getCategoryLabelsForModal(question, allCategories = []) {
        if (!question) {
            return [];
        }

        const labelsSet = new Set();

        if (Array.isArray(question.categorias)) {
            question.categorias.forEach(category => {
                if (typeof category === 'string') {
                    const trimmed = category.trim();
                    if (trimmed) {
                        labelsSet.add(trimmed);
                    }
                } else if (category && typeof category === 'object') {
                    const name = category.nome_categoria || category.nome || category.label || category.title || category.text || category.name;
                    if (typeof name === 'string' && name.trim()) {
                        labelsSet.add(name.trim());
                    }
                }
            });
        }

        if (labelsSet.size === 0 && Array.isArray(question.categoria_nomes)) {
            question.categoria_nomes.forEach(name => {
                if (typeof name === 'string') {
                    const trimmed = name.trim();
                    if (trimmed) {
                        labelsSet.add(trimmed);
                    }
                }
            });
        }

        if (labelsSet.size === 0 && Array.isArray(question.categoria_ids) && allCategories) {
            const categoryMap = new Map();
            allCategories.forEach(cat => {
                if (cat && typeof cat.id_categoria !== 'undefined') {
                    const label = typeof cat.nome_categoria === 'string' ? cat.nome_categoria.trim() : '';
                    categoryMap.set(cat.id_categoria, label);
                    categoryMap.set(String(cat.id_categoria), label);
                }
            });

            question.categoria_ids.forEach(id => {
                if (categoryMap.has(id)) {
                    const label = categoryMap.get(id);
                    if (label) {
                        labelsSet.add(label);
                    }
                    return;
                }

                const normalizedId = this._normalizeCategoryId(id);
                if (normalizedId !== null) {
                    const label = categoryMap.get(normalizedId) || categoryMap.get(String(normalizedId));
                    if (label) {
                        labelsSet.add(label);
                    }
                }
            });
        }

        return Array.from(labelsSet);
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
}
