// File: assets/js/ui/ModalManager.js

import { TRANSITION_DURATION } from '../utils/constants.js';

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
                }

                overlayElement.removeAttribute('aria-hidden');
                dialogElement.removeAttribute('aria-hidden');

                const focusTarget = elementToFocusOnOpen ||
                                    (dialogElement === this.elements.explanationModalDialog && this.elements.btnCloseExplanationModal) ||
                                    (dialogElement === this.elements.confirmEncerrarModal && this.elements.cancelEncerrarBtn) ||
                                    (dialogElement === this.elements.deleteAccountModalDialog && this.elements.passwordInputDeleteAccount) || 
                                    dialogElement;
                focusTarget?.focus(); 
            });
        } else {
            overlayElement.classList.remove(overlayVisibleClass);
            if (panelVisibleClass) dialogElement.classList.remove(panelVisibleClass);

            const onTransitionEnd = (event) => {
                const targetElement = isFilterPanel ? dialogElement : overlayElement;
                if (event.target !== targetElement) return;

                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible) {
                    this.quizUI.hideElement(overlayElement);
                    if (isFilterPanel) this.quizUI.hideElement(dialogElement);

                    overlayElement.setAttribute('aria-hidden', 'true');
                    dialogElement.setAttribute('aria-hidden', 'true');

                    this.activeModalCount = Math.max(0, this.activeModalCount - 1);
                    if (this.activeModalCount === 0) {
                        this.bodyElement.classList.remove('no-scroll');
                    }
                }
                targetElement.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeModal?.focus({ preventScroll: true });
                this.focusedElementBeforeModal = null;
            };

            const targetTransitionElement = isFilterPanel ? dialogElement : overlayElement;
            targetTransitionElement.addEventListener('transitionend', onTransitionEnd, { once: true });

            setTimeout(() => {
                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible) {
                    this.quizUI.hideElement(overlayElement);
                    if (isFilterPanel) this.quizUI.hideElement(dialogElement);
                    overlayElement.setAttribute('aria-hidden', 'true');
                    dialogElement.setAttribute('aria-hidden', 'true');

                    this.activeModalCount = Math.max(0, this.activeModalCount - 1);
                    if (this.activeModalCount === 0) {
                        this.bodyElement.classList.remove('no-scroll');
                    }
                }
                targetTransitionElement.removeEventListener('transitionend', onTransitionEnd);
                if (this.focusedElementBeforeModal && document.body.contains(this.focusedElementBeforeModal)) {
                     this.focusedElementBeforeModal.focus({ preventScroll: true });
                }
                this.focusedElementBeforeModal = null;
            }, TRANSITION_DURATION + 150);
        }
    }

    toggleFilterPanel(show) {
        const panel = this.elements.filterPanel;
        const overlay = this.elements.filterPanelOverlay;
        if (!panel || !overlay) return;

        if (show) {
            if (this.quizUI.filterPanelInstance) {
                this.quizUI.filterPanelInstance.loadCurrentFilters();
            }
            if (this.elements.challengeHubContainer?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName)) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
        } else {
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
            const userAnswerId = currentQuestion.respostaDadaId;
            let hasContent = false;

            const metaContainer = this.elements.explanationModalMetaContainer; // Usando o elemento cacheado
            const difficultyEl = this.elements.explanationModalDifficulty;
            const categoriesEl = this.elements.explanationModalCategories; // Este é o <span> para as tags
            const categoriesWrapper = categoriesEl ? categoriesEl.closest('.meta-item') : null; // O <p class="meta-item"> que contém "Categorias:"

            if (metaContainer && difficultyEl && categoriesEl) {
                difficultyEl.innerHTML = `&nbsp;${currentQuestion.nivel_dificuldade || 'Não informada'}`;
                
                // --- LÓGICA DE TAGS DE CATEGORIA ---
                categoriesEl.innerHTML = ''; // Limpa tags anteriores
                const allCategoriesData = this.quizData.getCategorias();
                const questionCategoryIds = currentQuestion.categoria_ids || [];
                const categoryNames = questionCategoryIds
                    .map(id => {
                        const cat = allCategoriesData.find(c => c.id_categoria === id);
                        return cat ? cat.nome_categoria : null; // Usar nomes simples por enquanto. Caminhos completos podem ser longos para tags.
                    })
                    .filter(name => name);

                if (categoryNames.length > 0) {
                    categoryNames.forEach(name => {
                        const tag = document.createElement('span');
                        tag.className = 'category-tag';
                        tag.textContent = name;
                        categoriesEl.appendChild(tag);
                    });
                    if (categoriesWrapper) this.quizUI.showElement(categoriesWrapper);
                } else {
                    categoriesEl.textContent = 'Não informadas'; // Ou deixar vazio e esconder o wrapper
                    // if (categoriesWrapper) this.quizUI.hideElement(categoriesWrapper); // Opcional: esconder se não houver categorias
                }
                this.quizUI.showElement(metaContainer);
                hasContent = true; // Considera que meta info é conteúdo
            } else {
                if (metaContainer) this.quizUI.hideElement(metaContainer);
            }


            const generalBlock = this.elements.explanationModalGeneralBlock;
            const generalText = this.elements.explanationModalGeneralText;
            const dividerGenOpt = this.elements.explanationModalDividerGeneralOptions; // Usando o elemento cacheado

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
                optionsList.innerHTML = '';
                if (Array.isArray(options) && options.length > 0) {
                    options.forEach(opt => {
                        const li = document.createElement('li');
                        li.className = 'explanation-modal__option-item';

                        if (opt.eh_correta) {
                            li.classList.add('is-correct-option');
                        } else {
                            if (opt.id_opcao_resposta !== userAnswerId) {
                                li.classList.add('is-generally-incorrect');
                            }
                        }

                        if (opt.id_opcao_resposta === userAnswerId) {
                            li.classList.add('is-user-selected');
                            if (!opt.eh_correta) {
                                li.classList.add('is-user-incorrect');
                                li.classList.remove('is-generally-incorrect');
                            }
                        }

                        const optionTextSpan = document.createElement('span');
                        optionTextSpan.className = 'option-item__text';
                        optionTextSpan.textContent = opt.texto_opcao;
                        li.appendChild(optionTextSpan);

                        if (opt.feedback_opcao && opt.feedback_opcao.trim()) {
                            const feedbackValueSpan = document.createElement('p');
                            feedbackValueSpan.className = 'option-item__feedback';
                            feedbackValueSpan.innerHTML = opt.feedback_opcao.replace(/\n/g, '<br>');
                            li.appendChild(feedbackValueSpan);
                        }
                        optionsList.appendChild(li);
                    });
                    this.quizUI.showElement(optionsBlock);
                    hasContent = true;
                } else {
                    this.quizUI.hideElement(optionsBlock);
                }
            }

            if (dividerGenOpt) {
                const generalVisible = generalBlock && !generalBlock.classList.contains(this.quizUI.hiddenClassName);
                const optionsVisible = optionsBlock && !optionsBlock.classList.contains(this.quizUI.hiddenClassName);
                if (generalVisible && optionsVisible) {
                    this.quizUI.showElement(dividerGenOpt);
                } else {
                    this.quizUI.hideElement(dividerGenOpt);
                }
            }

            const referenceBlock = this.elements.explanationModalReferenceBlock; // Usando o elemento cacheado
            const referenceTextEl = this.elements.explanationModalReferenceText;
            const dividerOptRef = this.elements.explanationModalDividerOptionsReference; // Usando o elemento cacheado

            if (referenceBlock && referenceTextEl) {
                if (currentQuestion.referencia_bibliografica && currentQuestion.referencia_bibliografica.trim()) {
                    const refText = currentQuestion.referencia_bibliografica;
                    if (refText.startsWith('http://') || refText.startsWith('https://')) {
                        referenceTextEl.innerHTML = `<a href="${refText}" target="_blank" rel="noopener noreferrer">${refText}</a>`;
                    } else {
                        referenceTextEl.textContent = refText;
                    }
                    this.quizUI.showElement(referenceBlock);
                    hasContent = true;
                } else {
                    this.quizUI.hideElement(referenceBlock);
                    referenceTextEl.textContent = 'Não informada.';
                }
            }

            if (dividerOptRef) {
                const optionsVisible = optionsBlock && !optionsBlock.classList.contains(this.quizUI.hiddenClassName);
                const referenceVisible = referenceBlock && !referenceBlock.classList.contains(this.quizUI.hiddenClassName);
                if (optionsVisible && referenceVisible) {
                    this.quizUI.showElement(dividerOptRef);
                } else {
                    this.quizUI.hideElement(dividerOptRef);
                }
            }

            const emptyState = this.elements.explanationModalEmptyState;
            if (!hasContent && emptyState) {
                this.quizUI.showElement(emptyState);
                if(dividerGenOpt) this.quizUI.hideElement(dividerGenOpt);
                if(dividerOptRef) this.quizUI.hideElement(dividerOptRef);
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
        // Filtro Panel
        this.elements.btnFecharFiltros?.addEventListener('click', () => this.toggleFilterPanel(false));
        this.elements.filterPanelOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.filterPanelOverlay) this.toggleFilterPanel(false);
        });

        // Explanation Modal
        this.elements.btnCloseExplanationModal?.addEventListener('click', () => this.toggleExplanationModal(false));
        this.elements.btnGotItExplanation?.addEventListener('click', () => this.toggleExplanationModal(false));
        this.elements.explanationModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.explanationModalOverlay) this.toggleExplanationModal(false);
        });

        // Confirm Modal (Encerrar Quiz)
        this.elements.confirmEncerrarBtn?.addEventListener('click', () => {
            if (quizLogicInstance) quizLogicInstance.forceEndQuizByUser();
        });
        this.elements.cancelEncerrarBtn?.addEventListener('click', () => this.toggleConfirmModal(false));
        this.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmEncerrarOverlay) this.toggleConfirmModal(false);
        });

        // Delete Account Modal
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