// File: assets/js/ui/ModalManager.js

import { TRANSITION_DURATION } from '../utils/constants.js';

export default class ModalManager {
    constructor(quizUIInstance, quizStateInstance, quizDataInstance) {
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

        const modalVisibleClass = 'modal--visible'; 
        const isFilterPanel = overlayElement === this.elements.filterPanelOverlay;
        const panelVisibleClass = isFilterPanel ? 'filter-panel--visible' : null;
        const overlayVisibleClass = isFilterPanel ? 'filter-panel-overlay--visible' : modalVisibleClass;

        if (show) {
            this.focusedElementBeforeModal = document.activeElement;
            this.quizUI.showElement(overlayElement);
            if (isFilterPanel) this.quizUI.showElement(dialogElement); 

            // Força reflow para garantir que a transição ocorra
            if (overlayElement) overlayElement.scrollTop;
            if (dialogElement) dialogElement.scrollTop;


            requestAnimationFrame(() => {
                overlayElement.classList.add(overlayVisibleClass);
                if (panelVisibleClass) {
                    dialogElement.classList.add(panelVisibleClass);
                }
                
                overlayElement.removeAttribute('aria-hidden');
                dialogElement.removeAttribute('aria-hidden');

                // Tenta focar o elemento especificado, ou um padrão para o modal, ou o próprio diálogo
                const focusTarget = elementToFocusOnOpen || 
                                    (dialogElement === this.elements.explanationModalDialog && this.elements.btnCloseExplanationModal) ||
                                    (dialogElement === this.elements.confirmEncerrarModal && this.elements.cancelEncerrarBtn) ||
                                    dialogElement; // Foco genérico no diálogo como fallback
                focusTarget.focus();
            });
        } else { // show === false
            overlayElement.classList.remove(overlayVisibleClass);
            if (panelVisibleClass) dialogElement.classList.remove(panelVisibleClass);

            const onTransitionEnd = (event) => {
                const targetElement = isFilterPanel ? dialogElement : overlayElement;
                // Garante que a transição seja do elemento correto
                if (event.target !== targetElement) return;

                // Verifica se o modal realmente não está mais visível pela classe (para evitar fechar prematuramente se houver múltiplas transições)
                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible) {
                    this.quizUI.hideElement(overlayElement);
                    if (isFilterPanel) this.quizUI.hideElement(dialogElement); // Esconde o painel de filtro especificamente
                    
                    overlayElement.setAttribute('aria-hidden', 'true');
                    dialogElement.setAttribute('aria-hidden', 'true');
                }
                targetElement.removeEventListener('transitionend', onTransitionEnd); // Remove o listener após a execução
                this.focusedElementBeforeModal?.focus({ preventScroll: true }); // Evita scroll ao retornar foco
                this.focusedElementBeforeModal = null;
            };

            // O elemento que dispara a transição principal de "saída"
            const targetTransitionElement = isFilterPanel ? dialogElement : overlayElement;
            targetTransitionElement.addEventListener('transitionend', onTransitionEnd, { once: true });

            // Fallback caso a transição não dispare (ex: se display:none for aplicado antes, ou se não houver transição CSS)
            setTimeout(() => {
                const isOverlayStillVisible = overlayElement.classList.contains(overlayVisibleClass);
                const isPanelStillVisible = panelVisibleClass && dialogElement.classList.contains(panelVisibleClass);

                if (!isOverlayStillVisible && !isPanelStillVisible) {
                    this.quizUI.hideElement(overlayElement);
                    if (isFilterPanel) this.quizUI.hideElement(dialogElement);
                    overlayElement.setAttribute('aria-hidden', 'true');
                    dialogElement.setAttribute('aria-hidden', 'true');
                }
                // Garante a remoção do listener se o timeout ocorrer antes da transição
                targetTransitionElement.removeEventListener('transitionend', onTransitionEnd);
                if (this.focusedElementBeforeModal && document.body.contains(this.focusedElementBeforeModal)) {
                     this.focusedElementBeforeModal.focus({ preventScroll: true });
                }
                this.focusedElementBeforeModal = null;
            }, TRANSITION_DURATION + 150); // Um pouco mais que a duração da transição definida no CSS
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
            // Mostra o placeholder se o quiz não estiver ativo e o painel de filtro estiver sendo aberto
            if (this.elements.challengeHubContainer?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName)) {
                this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
        } else {
            // Esconde o placeholder e mostra o hub se o quiz não estiver ativo ao fechar o painel
            if (this.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.quizUI.hiddenClassName)) {
                this.quizUI.hideElement(this.elements.placeholderFiltrosContainer);
                if(this.elements.challengeHubContainer) this.quizUI.showElement(this.elements.challengeHubContainer);
            }
        }
        this._toggleGenericModal(overlay, panel, show, panel); // Foco no próprio painel ao abrir
    }

    toggleExplanationModal(show) {
        const overlay = this.elements.explanationModalOverlay;
        const dialog = this.elements.explanationModalDialog; // O card interno do modal de explicação
        if (!overlay || !dialog) return;

        if (show) {
            if (!this.quizState || !this.quizData) {
                console.warn("ModalManager: QuizState ou QuizData não disponíveis para o modal de explicação.");
                return;
            }
            const currentQuestion = this.quizState.getCurrentQuestion();
            if (!currentQuestion) {
                console.warn("ModalManager: Nenhuma questão atual para exibir explicação.");
                return;
            }
            const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
            const userAnswerId = currentQuestion.respostaDadaId; // ID da opção que o usuário marcou
            let hasContent = false; // Flag para verificar se há algo a ser mostrado além do título

            // --- Popular Meta Informações da Questão (Dificuldade, Categorias) ---
            const metaContainer = dialog.querySelector('#explanation-modal-meta-container'); // Busca dentro do dialog
            const difficultyEl = dialog.querySelector('#explanation-modal-difficulty');
            const categoriesEl = dialog.querySelector('#explanation-modal-categories');

            if (metaContainer && difficultyEl && categoriesEl) {
                difficultyEl.innerHTML = `&nbsp;${currentQuestion.nivel_dificuldade || 'Não informada'}`;
                
                const allCategoriesData = this.quizData.getCategorias(); // Pega todas as categorias do QuizData
                const categoryNames = currentQuestion.categoria_ids
                    ?.map(id => allCategoriesData.find(cat => cat.id_categoria === id)?.nome_categoria)
                    .filter(name => name) // Remove undefined/null se alguma categoria não for encontrada
                    .join(', ');
                categoriesEl.innerHTML = `&nbsp;${categoryNames || 'Não informadas'}`;
                this.quizUI.showElement(metaContainer); // Mostra o container de metadados
                // Não define hasContent = true aqui, pois meta-informações são secundárias
            }


            // --- Popular Explicação Geral da Resposta ---
            const generalBlock = this.elements.explanationModalGeneralBlock; // Já cacheado em QuizUI
            const generalText = this.elements.explanationModalGeneralText;   // Já cacheado em QuizUI
            const dividerGenOpt = dialog.querySelector('#explanation-divider-general-options');


            if (generalText && currentQuestion.explicacao_resposta && currentQuestion.explicacao_resposta.trim()) {
                generalText.innerHTML = currentQuestion.explicacao_resposta.replace(/\n/g, '<br>');
                this.quizUI.showElement(generalBlock);
                hasContent = true;
            } else {
                this.quizUI.hideElement(generalBlock);
            }

            // --- Popular Detalhamento das Alternativas ---
            const optionsBlock = this.elements.explanationModalOptionsBlock; // Já cacheado
            const optionsList = this.elements.explanationModalOptionsList;   // Já cacheado
            if (optionsList) {
                optionsList.innerHTML = ''; // Limpa antes de popular
                if (Array.isArray(options) && options.length > 0) {
                    options.forEach(opt => {
                        const li = document.createElement('li');
                        li.className = 'explanation-modal__option-item'; // Classe base para cada item de opção
                        
                        // Aplicar classes de estado
                        if (opt.eh_correta) {
                            li.classList.add('is-correct-option'); // Verde para a correta
                        } else {
                            // Adiciona classe para TODAS as incorretas que não foram a escolha do usuário
                            if (opt.id_opcao_resposta !== userAnswerId) { 
                                li.classList.add('is-generally-incorrect');
                            }
                        }

                        if (opt.id_opcao_resposta === userAnswerId) {
                            li.classList.add('is-user-selected'); // Destaque para a escolha do usuário
                            if (!opt.eh_correta) { // Se a escolha do usuário FOI INCORRETA
                                li.classList.add('is-user-incorrect'); // Destaque vermelho específico para a escolha errada do usuário
                                li.classList.remove('is-generally-incorrect'); // Remove a classe geral se esta foi a escolhida
                            }
                        }

                        const optionTextSpan = document.createElement('span');
                        optionTextSpan.className = 'option-item__text';
                        optionTextSpan.textContent = opt.texto_opcao;
                        li.appendChild(optionTextSpan);

                        if (opt.feedback_opcao && opt.feedback_opcao.trim()) {
                            const feedbackValueSpan = document.createElement('p'); // Usar <p> para o feedback
                            feedbackValueSpan.className = 'option-item__feedback';
                            feedbackValueSpan.innerHTML = opt.feedback_opcao.replace(/\n/g, '<br>');
                            li.appendChild(feedbackValueSpan);
                        }
                        optionsList.appendChild(li);
                    });
                    this.quizUI.showElement(optionsBlock); // Mostra o bloco de opções
                    hasContent = true; // Se há opções, há conteúdo
                } else {
                    this.quizUI.hideElement(optionsBlock); // Esconde se não houver opções
                }
            }
            
            // Gerenciar o divisor entre explicação geral e opções
            if (dividerGenOpt) {
                const generalVisible = generalBlock && !generalBlock.classList.contains(this.quizUI.hiddenClassName);
                const optionsVisible = optionsBlock && !optionsBlock.classList.contains(this.quizUI.hiddenClassName);
                if (generalVisible && optionsVisible) {
                    this.quizUI.showElement(dividerGenOpt);
                } else {
                    this.quizUI.hideElement(dividerGenOpt);
                }
            }


            // --- Popular Referência Bibliográfica ---
            const referenceBlock = dialog.querySelector('#explanation-modal-reference-block');
            const referenceTextEl = dialog.querySelector('#explanation-modal-reference-text');
            const dividerOptRef = dialog.querySelector('#explanation-divider-options-reference');

            if (referenceBlock && referenceTextEl) { // Verifica se os elementos existem
                if (currentQuestion.referencia_bibliografica && currentQuestion.referencia_bibliografica.trim()) {
                    const refText = currentQuestion.referencia_bibliografica;
                    // Tenta detectar se é uma URL para criar um link
                    if (refText.startsWith('http://') || refText.startsWith('https://')) {
                        referenceTextEl.innerHTML = `<a href="${refText}" target="_blank" rel="noopener noreferrer">${refText}</a>`;
                    } else {
                        referenceTextEl.textContent = refText;
                    }
                    this.quizUI.showElement(referenceBlock);
                    hasContent = true;
                } else {
                    this.quizUI.hideElement(referenceBlock);
                    // Garante que o texto padrão seja exibido se o bloco for escondido após ter conteúdo
                    referenceTextEl.textContent = 'Não informada.'; 
                }
            }

            // Gerenciar o divisor entre opções e referência
            if (dividerOptRef) {
                const optionsVisible = optionsBlock && !optionsBlock.classList.contains(this.quizUI.hiddenClassName);
                const referenceVisible = referenceBlock && !referenceBlock.classList.contains(this.quizUI.hiddenClassName);
                if (optionsVisible && referenceVisible) {
                    this.quizUI.showElement(dividerOptRef);
                } else {
                    this.quizUI.hideElement(dividerOptRef);
                }
            }

            // --- Gerenciar Estado Vazio ---
            const emptyState = this.elements.explanationModalEmptyState; // Já cacheado
            if (!hasContent && emptyState) { // Se NADA (explicação, opções, referência) foi mostrado
                this.quizUI.showElement(emptyState);
                // Esconde divisores se o estado vazio for mostrado
                if(dividerGenOpt) this.quizUI.hideElement(dividerGenOpt);
                if(dividerOptRef) this.quizUI.hideElement(dividerOptRef);
            } else if (emptyState) {
                this.quizUI.hideElement(emptyState);
            }

            this._toggleGenericModal(overlay, dialog, true, this.elements.btnCloseExplanationModal);
        } else { // if (show === false)
            this._toggleGenericModal(overlay, dialog, false);
        }
    }

    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay; // Cacheado
        const dialog = this.elements.confirmEncerrarModal;   // Cacheado
        this._toggleGenericModal(overlay, dialog, show, this.elements.cancelEncerrarBtn);
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