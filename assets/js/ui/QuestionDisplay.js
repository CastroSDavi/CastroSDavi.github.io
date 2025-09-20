// File: assets/js/ui/QuestionDisplay.js
import { QUESTOES_POR_PAGINA_GRID } from '../utils/constants.js';

export default class QuestionDisplay {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements;
        this.actionOrchestrator = null; 
        this.store = null; 
    }
    
    // --- MÉTODOS DE INJEÇÃO (CHAMADOS PELO QUIZUI) ---
    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
        this._setupNavigationListeners();
    }

    setStore(storeInstance) {
        this.store = storeInstance;
    }

    // --- MÉTODOS DE RENDERIZAÇÃO ---

    displayCurrentQuestion(quizState) {
        const question = quizState.currentQuestionsSet[quizState.currentQuestionIndex];
        if (!question || typeof question.id_pergunta === 'undefined') {
            console.error("QuestionDisplay: Tentativa de renderizar uma questão inválida.");
            return;
        }

        const qNum = quizState.currentQuestionIndex + 1;
        const totalQ = quizState.currentQuestionsSet.length;
        
        this._renderQuestionContent(question, qNum, totalQ);
    }
    
    _renderQuestionContent(question, qNum, totalQ) {
        const options = question.opcoes || [];

        if (this.elements.idQuestao) {
            this.elements.idQuestao.innerText = qNum;
        }
        
        if (this.elements.perguntaTexto) {
             this.elements.perguntaTexto.textContent = question.texto_pergunta || "Texto da pergunta indisponível.";
        }

        this._displayQuestionImage(question.url_imagem, qNum);
        this.updateProgressBar(qNum, totalQ);
        
        // --- INÍCIO DA MODIFICAÇÃO ---
        this._updateFavoriteButton(question);
        // --- FIM DA MODIFICAÇÃO ---

        this.generateAnswerButtons(question.id_pergunta, options, question.respostaDadaId);

        if (question.respostaDadaId !== undefined && question.respostaDadaId !== null) {
            this.disableAnswers();
            this.applyAnswerFeedback(question.respostaDadaId, options);
        }

        this.updateExplanationButtonVisibility(question);
        this.updateNavigationButtons(question, qNum - 1, totalQ);
        this.renderQuestionGrid();
    }
    
    // --- NOVO MÉTODO ---
    _updateFavoriteButton(question) {
        const btn = this.elements.btnToggleFavorite;
        if (!btn) return;
        
        const isUserAuthenticated = this.quizUI.userIsAuthenticated;
        
        if (!isUserAuthenticated) {
            this.quizUI.hideElement(btn);
            return;
        }

        this.quizUI.showElement(btn);
        
        const isFavorited = question.is_favorited || false;
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
    // --- FIM DO NOVO MÉTODO ---


    updateExplanationButtonVisibility(question) {
        if (!question) return;

        const options = question.opcoes || [];
        const hasExplanation = (question.explicacao_resposta && question.explicacao_resposta.trim() !== '') || options.some(op => op && op.feedback_opcao && op.feedback_opcao.trim() !== '');
        
        const actionsContainer = this.elements.questionActions;
        if (hasExplanation && question.respostaDadaId !== undefined && question.respostaDadaId !== null) {
            this.quizUI.showElement(this.elements.btnToggleExplanation);
            actionsContainer?.classList.add('question-display__actions--visible');
        } else {
            this.quizUI.hideElement(this.elements.btnToggleExplanation);
            actionsContainer?.classList.remove('question-display__actions--visible');
        }
    }
    
    _displayQuestionImage(url, qNum) {
        const imgElement = this.elements.perguntaImagem;
        if (imgElement) {
            if (url && typeof url === 'string' && url.trim()) {
                imgElement.src = url;
                imgElement.alt = `Ilustração para questão ${qNum}`;
                this.quizUI.showElement(imgElement);
                imgElement.onerror = () => { this.quizUI.hideElement(imgElement); imgElement.onerror = null; };
            } else {
                this.quizUI.hideElement(imgElement);
                imgElement.src = "";
                imgElement.alt = "";
            }
        }
    }

    generateAnswerButtons(perguntaId, opcoes, respostaDadaId) {
        const container = this.elements.respostasContainer;
        if (!container) return;
        container.innerHTML = '';
        
        if (!Array.isArray(opcoes)) return;

        const temResposta = respostaDadaId !== undefined && respostaDadaId !== null;
        
        const baseClass = 'question-display__answer-option';

        opcoes.forEach(opt => {
            if (!opt || typeof opt.id_opcao_resposta === 'undefined') return;
            
            const button = document.createElement('button');
            button.className = baseClass;
            button.textContent = opt.texto_opcao;
            button.dataset.opcaoId = opt.id_opcao_resposta.toString();
            button.disabled = temResposta;
            button.style.cursor = temResposta ? 'default' : 'pointer';
            button.tabIndex = temResposta ? -1 : 0;

            if (temResposta) {
                button.classList.add(`${baseClass}--answered`);
                if (opt.eh_correta) button.classList.add(`${baseClass}--correct`);
                else if (opt.id_opcao_resposta === respostaDadaId) button.classList.add(`${baseClass}--incorrect`);
            } else {
                button.onclick = () => this.actionOrchestrator?.answerQuestion(opt.id_opcao_resposta);
            }
            container.appendChild(button);
        });
    }

    disableAnswers() {
        const baseClass = 'question-display__answer-option';
        const answeredClass = `${baseClass}--answered`;
        this.elements.respostasContainer?.querySelectorAll(`button.${baseClass}`).forEach(button => {
            button.onclick = null;
            button.disabled = true;
            button.classList.add(answeredClass);
            button.style.cursor = "default";
            button.tabIndex = -1;
        });
    }

    applyAnswerFeedback(selectedOpId, opcoes) {
        const baseCl = "question-display__answer-option";
        const corrCl = `${baseCl}--correct`;
        const incorrCl = `${baseCl}--incorrect`;
        let userCorrect = false;

        if (!Array.isArray(opcoes)) return;

        this.elements.respostasContainer?.querySelectorAll(`button.${baseCl}`).forEach(btn => {
            const btnOpId = parseInt(btn.dataset.opcaoId, 10);
            const optionData = opcoes.find(op => op && op.id_opcao_resposta === btnOpId);
            if (!optionData) return;

            if (btnOpId === selectedOpId) {
                if (optionData.eh_correta) { btn.classList.add(corrCl); userCorrect = true; }
                else { btn.classList.add(incorrCl); }
            } else if (optionData.eh_correta) {
                btn.classList.add(corrCl);
            }
        });

        if (this.elements.feedbackAcessivel) {
            this.elements.feedbackAcessivel.textContent = userCorrect ? "Você acertou!" : "Resposta incorreta.";
        }
    }

    updateProgressBar(current, total) {
        const { progressContainer, progressBarFill, progressText } = this.elements;
        if (progressContainer && progressBarFill && progressText) {
            if (total > 0) {
                const percentage = Math.min(current, total) / total * 100;
                progressBarFill.style.width = `${percentage}%`;
                progressText.textContent = `${Math.min(current,total)} / ${total}`;
                this.quizUI.showElement(progressContainer);
                this.quizUI.showElement(progressText);
            } else {
                this.hideProgressBar();
            }
        }
    }

    hideProgressBar() {
        this.quizUI.hideElement(this.elements.progressContainer);
        this.quizUI.hideElement(this.elements.progressText);
        if (this.elements.progressBarFill) this.elements.progressBarFill.style.width = "0%";
        if (this.elements.progressText) this.elements.progressText.textContent = "";
    }

    updateNavigationButtons(question, currentIndex, totalQuestions) {
        const { navigationButtons, prevBtn, nextBtn } = this.elements;
        if (!navigationButtons || !prevBtn || !nextBtn || !question) return;

        const displayMode = this.store?.getState().quiz?.quizDisplayContext?.displayMode;
        if (displayMode === 'review') {
            this.quizUI.hideElement(navigationButtons);
            return;
        }

        if (totalQuestions <= 0) {
            this.quizUI.hideElement(navigationButtons);
        } else {
            this.quizUI.showElement(navigationButtons);
            prevBtn.disabled = currentIndex === 0;
            nextBtn.disabled = false;

            const nextButtonLabel = nextBtn.querySelector('.button__label') || nextBtn;
            
            if (currentIndex === totalQuestions - 1) {
                const isAnswered = question.respostaDadaId !== undefined;
                if (isAnswered) {
                    nextButtonLabel.textContent = "Ver Resultado";
                } else {
                    nextButtonLabel.textContent = "Finalizar";
                }
            } else {
                nextButtonLabel.textContent = "Avançar";
            }
        }
    }

    renderQuestionGrid() {
        const container = this.elements.questionGridContainer;
        if (!container || !this.store) return;

        const state = this.store.getState().quiz;
        const { currentQuestionsSet, currentQuestionIndex } = state;

        if (state.quizDisplayContext?.displayMode === 'review') {
            this.quizUI.hideElement(container);
            return;
        }

        if (!currentQuestionsSet || currentQuestionsSet.length === 0) {
            this.quizUI.hideElement(container);
            return;
        }
        this.quizUI.showElement(container);
        container.innerHTML = '';

        const currentPage = Math.floor(currentQuestionIndex / QUESTOES_POR_PAGINA_GRID);
        const startIndex = currentPage * QUESTOES_POR_PAGINA_GRID;
        const endIndex = Math.min(startIndex + QUESTOES_POR_PAGINA_GRID, currentQuestionsSet.length);

        const prevArrowCallback = () => this.actionOrchestrator?.handleNavigation(Math.max(0, startIndex - 1));
        container.appendChild(this._createGridArrow('prev', startIndex === 0, prevArrowCallback, 'Página Anterior de Questões', ['question-grid__arrow--left']));

        for (let i = startIndex; i < endIndex; i++) {
            const questionState = currentQuestionsSet[i];
            if (!questionState) continue;
            
            const item = document.createElement('button');
            item.className = 'question-grid__item';
            item.textContent = i + 1;
            item.dataset.index = i.toString();
            item.setAttribute('aria-label', `Ir para Questão ${i + 1}`);
            item.onclick = () => this.actionOrchestrator?.handleNavigation(i);

            if (questionState.respostaDadaId !== undefined && questionState.respostaDadaId !== null) {
                if (questionState.foiCorretaNaSessao === true) item.classList.add('question-grid__item--correct');
                else if (questionState.foiCorretaNaSessao === false) item.classList.add('question-grid__item--incorrect');
            } else if (questionState.foiPulada === true) {
                item.classList.add('question-grid__item--skipped');
            }
            if (i === currentQuestionIndex) {
                item.classList.add('question-grid__item--current');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
            container.appendChild(item);
        }
        
        const nextArrowCallback = () => this.actionOrchestrator?.handleNavigation(Math.min(endIndex, currentQuestionsSet.length -1));
        container.appendChild(this._createGridArrow('next', endIndex >= currentQuestionsSet.length, nextArrowCallback, 'Próxima Página de Questões', ['question-grid__arrow--right']));
    }
    
    _setupNavigationListeners() {
        this.elements.prevBtn?.addEventListener('click', () => {
            this.actionOrchestrator?.handleNavigation('prev');
        });
        this.elements.nextBtn?.addEventListener('click', () => {
            this.actionOrchestrator?.handleNavigation('next');
        });
        this.elements.btnToggleFavorite?.addEventListener('click', () => {
            this.actionOrchestrator?.toggleFavoriteCurrentQuestion();
        });
    }

    _createGridArrow(direction, isDisabled, callback, ariaLabel, extraClasses = []) {
        const button = document.createElement('button');
        button.className = 'question-grid__arrow';
        if (Array.isArray(extraClasses)) button.classList.add(...extraClasses);
        button.classList.add('u-is-circle');
        button.setAttribute('aria-label', ariaLabel);
        button.disabled = isDisabled;
        button.onclick = callback;
        const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgIcon.setAttribute("viewBox", "0 -960 960 960");
        svgIcon.setAttribute("fill", "currentColor");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", direction === 'prev' ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z");
        svgIcon.appendChild(path);
        button.appendChild(svgIcon);
        return button;
    }

    scrollToQuestionStart() {
        const titleElement = this.elements.questionTitle;
        if (this.elements.questionSection && !this.elements.questionSection.classList.contains(this.quizUI.hiddenClassName) && titleElement) {
            titleElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    focusNextButton(preventScroll = false) {
        this.elements.nextBtn?.focus({ preventScroll: preventScroll });
    }

    smoothScrollToNextButton() {
        this.elements.navigationButtons?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}