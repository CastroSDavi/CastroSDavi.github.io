// File: assets/js/ui/QuestionDisplay.js

import { QUESTOES_POR_PAGINA_GRID, TRANSITION_DURATION } from '../utils/constants.js'; //

export default class QuestionDisplay {
    constructor(quizUIInstance, quizStateInstance, quizDataInstance, callbacks = {}) {
        // console.log("QuestionDisplay.js: CONSTRUCTOR - Entrou. QuizState recebido:", quizStateInstance ? "Instância" : "Nulo/Indefinido");
        this.quizUI = quizUIInstance; //
        this.quizState = quizStateInstance; 
        this.quizData = quizDataInstance; //
        this.elements = this.quizUI.elements; //

        this.answerCallback = callbacks.answerCallback; //
        this.navigationCallback = callbacks.navigationCallback; //
        this.toggleFavoriteCallback = callbacks.toggleFavoriteCallback; //

        this._setupNavigationListeners();
    }

    _setupNavigationListeners() {
        this.elements.prevBtn?.addEventListener('click', () => { //
            if (this.navigationCallback) this.navigationCallback('prev'); //
        });
        this.elements.nextBtn?.addEventListener('click', () => { //
            if (this.navigationCallback) this.navigationCallback('next'); //
        });
        this.elements.btnToggleFavorite?.addEventListener('click', () => { //
            if (this.toggleFavoriteCallback) this.toggleFavoriteCallback(); //
        });
    }

    _displayQuestionImage(url, qNum) {
        const imgElement = this.elements.perguntaImagem; //
        if (imgElement) {
            if (url && typeof url === 'string' && url.trim()) {
                imgElement.src = url; //
                imgElement.alt = `Ilustração para questão ${qNum}`; //
                this.quizUI.showElement(imgElement); //
                imgElement.onerror = () => { this.quizUI.hideElement(imgElement); imgElement.onerror = null; }; //
            } else {
                this.quizUI.hideElement(imgElement); //
                imgElement.src = ""; //
                imgElement.alt = ""; //
            }
        }
    }

    // Método interno para renderizar o conteúdo da questão
    _renderQuestionContent(question, qNum, totalQ, options, shouldScroll) {
        if (this.elements.perguntaTexto) { //
             this.elements.perguntaTexto.textContent = question.texto_pergunta || "Texto da pergunta indisponível."; //
        }
        if (this.elements.referenciaQuestao) { //
            this.elements.referenciaQuestao.textContent = `Fonte: ${question.referencia_bibliografica || "Não informada"}`; //
        }
        this._displayQuestionImage(question.url_imagem, qNum);
        this.updateProgressBar(qNum, totalQ); //
        
        if (this.elements.btnToggleFavorite) { //
            if (this.quizUI.userIsAuthenticated && question.id_pergunta !== undefined) { //
                this.quizUI.showElement(this.elements.btnToggleFavorite); //
                if (this.quizUI.favoriteManager) { //
                    this.quizUI.favoriteManager.updateFavoriteButtonState(question.is_favorited || false); //
                }
                this.elements.btnToggleFavorite.dataset.perguntaId = question.id_pergunta.toString(); //
            } else {
                this.quizUI.hideElement(this.elements.btnToggleFavorite); //
            }
        }
        this.generateAnswerButtons(question.id_pergunta, options || [], question.respostaDadaId); //

        if (question.respostaDadaId !== undefined) { //
            this.disableAnswers(); //
            if (question.respostaDadaId !== null) { 
                this.applyAnswerFeedback(question.respostaDadaId, options || []); //
            }
        }

        this.quizUI.hideElement(this.elements.btnToggleExplanation); //
        if (this.quizUI.modalManager) this.quizUI.modalManager.toggleExplanationModal(false); //

        this.updateNavigationButtons(); //
        this.renderQuestionGrid(); //

        if (shouldScroll) {
            this.scrollToQuestionStart();
        }
    }

    displayCurrentQuestion(shouldScroll = true) { // Adicionado shouldScroll como parâmetro, default true
        // console.log("QuestionDisplay.js: displayCurrentQuestion - Entrou.");
        if (!this.quizState) {
            console.error("QuestionDisplay.js: displayCurrentQuestion - ERRO CRÍTICO: this.quizState é NULO/INDEFINIDO.");
            return;
        }
        const question = this.quizState.getCurrentQuestion(); //
        // console.log("QuestionDisplay.js: displayCurrentQuestion - Pergunta atual do estado:", question ? `ID ${question.id_pergunta}` : "Nula");

        if (!question || typeof question.id_pergunta === 'undefined') {
            console.error("QuestionDisplay.js: displayCurrentQuestion - Pergunta atual é inválida ou nula. Saindo.", question);
            return;
        }

        const qNum = this.quizState.getCurrentQuestionNumberForDisplay(); //
        const totalQ = this.quizState.getTotalFilteredQuestions(); //
        const options = question.opcoes; 

        if (!options || !Array.isArray(options)) {
            console.warn(`QuestionDisplay.js: displayCurrentQuestion - Opções ausentes ou em formato inválido para a pergunta ID ${question.id_pergunta}.`, question);
        }
        // console.log("QuestionDisplay.js: displayCurrentQuestion - Opções para pergunta ID", question.id_pergunta, ":", options ? options.length : "Nenhuma/Inválida");

        if (this.elements.idQuestao) { //
            this.elements.idQuestao.innerText = qNum; //
        }

        const quizDisplayContext = this.quizState.getQuizDisplayContext(); //
        if (this.elements.categoriaTitulo) { //
            if (quizDisplayContext && quizDisplayContext.mainQuizTitle &&
                (quizDisplayContext.displayMode === 'focused' || quizDisplayContext.displayMode === 'challenge')) { //
                this.elements.categoriaTitulo.innerText = quizDisplayContext.mainQuizTitle; //
                this.elements.categoriaTitulo.setAttribute('title', quizDisplayContext.mainQuizTitle); //
                this.quizUI.showElement(this.elements.categoriaTitulo); //
            } else {
                this.quizUI.hideElement(this.elements.categoriaTitulo); //
                this.elements.categoriaTitulo.innerText = ''; //
                this.elements.categoriaTitulo.removeAttribute('title'); //
            }
        }
        
        const questionWrapper = this.elements.questionWrap;
        const isInitialLoadOfSession = this.quizState.isInitialQuestionLoad;
        const isFirstDisplayAfterResume = this.quizState.isResumingDisplay; // Verifica a nova flag

        if (isFirstDisplayAfterResume && questionWrapper) {
            // console.log("QuestionDisplay.js: Aplicando animação de entrada da sessão.");
            questionWrapper.classList.remove("is-fading-out", "is-transparent");
            questionWrapper.classList.add("quiz-session-entering"); // Aplica a classe de animação de entrada

            this._renderQuestionContent(question, qNum, totalQ, options, false); // Renderiza o conteúdo, sem scroll imediato

            questionWrapper.addEventListener('animationend', () => {
                questionWrapper.classList.remove("quiz-session-entering");
                 if (shouldScroll) this.scrollToQuestionStart(); // Scroll após a animação
            }, { once: true });

            if (this.quizState.sessionResumedFirstDisplayProcessed) {
                this.quizState.sessionResumedFirstDisplayProcessed(); // Reseta a flag
            }
             if (isInitialLoadOfSession) { // Marca como navegada se for a primeira questão da sessão
                this.quizState.markNavigated();
            }

        } else if (!isInitialLoadOfSession && questionWrapper) { // Transição normal entre questões
            // console.log("QuestionDisplay.js: Aplicando transição normal entre questões.");
            questionWrapper.classList.add("is-fading-out"); //
            const fadeOutDuration = parseFloat(getComputedStyle(questionWrapper).transitionDuration) * 1000 || TRANSITION_DURATION; //

            setTimeout(() => {
                questionWrapper.classList.remove("is-fading-out"); //
                questionWrapper.classList.add("is-transparent"); //
                requestAnimationFrame(() => {
                    this._renderQuestionContent(question, qNum, totalQ, options, shouldScroll); // Passa shouldScroll
                    requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent")); //
                });
            }, fadeOutDuration);
        } else { // Carregamento inicial da primeira questão (sem ser retomada, ou sem wrapper para animar)
            // console.log("QuestionDisplay.js: Exibição direta (primeira questão ou sem wrapper).");
            if (questionWrapper) questionWrapper.classList.remove("is-fading-out", "is-transparent", "quiz-session-entering");
            this._renderQuestionContent(question, qNum, totalQ, options, false); // Sem scroll imediato aqui
             if (shouldScroll && isInitialLoadOfSession) { // Scroll apenas se for o carregamento inicial
                this.scrollToQuestionStart();
            }
            if (this.quizState.getTotalFilteredQuestions() > 0 && isInitialLoadOfSession) { //
                this.quizState.markNavigated(); //
            }
        }
        // console.log("QuestionDisplay.js: displayCurrentQuestion - Finalizado.");
    }


    generateAnswerButtons(perguntaId, opcoes, respostaDadaId) {
        // console.log(`QuestionDisplay.js: generateAnswerButtons - Pergunta ID: ${perguntaId}, N_Opções: ${opcoes?.length}`);
        const container = this.elements.respostasContainer; //
        if (!container) {
            console.error("QuestionDisplay.js: generateAnswerButtons - ERRO: Container de respostas não encontrado.");
            return;
        }
        container.innerHTML = ''; //
        
        if (!opcoes || !Array.isArray(opcoes)) { 
            console.warn(`QuestionDisplay.js: generateAnswerButtons - 'opcoes' não é um array ou é nulo para pergunta ID ${perguntaId}.`);
            return;
        }

        const temResposta = typeof respostaDadaId !== 'undefined' && respostaDadaId !== null; //
        const baseClass = 'question-display__answer-option'; //

        opcoes.forEach(opt => {
            if (!opt || typeof opt.id_opcao_resposta === 'undefined' || typeof opt.texto_opcao === 'undefined') {
                console.warn("QuestionDisplay.js: generateAnswerButtons - Opção inválida encontrada e pulada:", opt);
                return; 
            }
            const button = document.createElement('button'); //
            button.className = baseClass; //
            button.textContent = opt.texto_opcao; //
            button.dataset.opcaoId = opt.id_opcao_resposta.toString(); //
            button.disabled = temResposta; //
            button.style.cursor = temResposta ? 'default' : 'pointer'; //
            button.tabIndex = temResposta ? -1 : 0; //

            if (temResposta) { //
                button.classList.add(`${baseClass}--answered`); //
                if (opt.eh_correta) button.classList.add(`${baseClass}--correct`); //
                else if (opt.id_opcao_resposta === respostaDadaId) button.classList.add(`${baseClass}--incorrect`); //
            } else if (this.answerCallback && typeof this.answerCallback === 'function') { //
                button.onclick = () => this.answerCallback(opt.id_opcao_resposta); //
            }
            container.appendChild(button); //
        });
        // console.log(`QuestionDisplay.js: generateAnswerButtons - Botões de resposta gerados para pergunta ID: ${perguntaId}`);
    }

    disableAnswers() {
        // console.log("QuestionDisplay.js: disableAnswers - Desabilitando respostas.");
        const baseClass = 'question-display__answer-option'; //
        const answeredClass = `${baseClass}--answered`; //
        this.elements.respostasContainer?.querySelectorAll(`button.${baseClass}`).forEach(button => { //
            button.onclick = null; //
            button.disabled = true; //
            button.classList.add(answeredClass); //
            button.style.cursor = "default"; //
            button.tabIndex = -1; //
        });
    }

    applyAnswerFeedback(selectedOpId, opcoes) {
        // console.log(`QuestionDisplay.js: applyAnswerFeedback - Aplicando feedback para opção ID: ${selectedOpId}`);
        const baseCl = "question-display__answer-option"; //
        const corrCl = `${baseCl}--correct`; //
        const incorrCl = `${baseCl}--incorrect`; //
        let userCorrect = false; //

        if (!Array.isArray(opcoes)) {
             console.warn(`QuestionDisplay.js: applyAnswerFeedback - 'opcoes' não é um array.`);
            return;
        }

        this.elements.respostasContainer?.querySelectorAll(`button.${baseCl}`).forEach(btn => { //
            const btnOpId = parseInt(btn.dataset.opcaoId, 10); //
            const optionData = opcoes.find(op => op && op.id_opcao_resposta === btnOpId); //
            if (!optionData) return;

            if (btnOpId === selectedOpId) { //
                if (optionData.eh_correta) { btn.classList.add(corrCl); userCorrect = true; } //
                else { btn.classList.add(incorrCl); } //
            } else if (optionData.eh_correta) { //
                btn.classList.add(corrCl); //
            }
        });

        if (this.elements.feedbackAcessivel) { //
            this.elements.feedbackAcessivel.textContent = userCorrect ? "Você acertou!" : "Resposta incorreta."; //
        }

        const currentQ = this.quizState?.getCurrentQuestion(); //
        const hasGeneralExplanation = currentQ && currentQ.explicacao_resposta && currentQ.explicacao_resposta.trim() !== ''; //
        const hasOptionSpecificFeedback = opcoes.some(op => op && op.feedback_opcao && op.feedback_opcao.trim() !== ''); //

        if ((hasGeneralExplanation || hasOptionSpecificFeedback) && this.elements.btnToggleExplanation) { //
            this.quizUI.showElement(this.elements.btnToggleExplanation); //
        } else {
            this.quizUI.hideElement(this.elements.btnToggleExplanation); //
        }
        // console.log("QuestionDisplay.js: applyAnswerFeedback - Feedback aplicado.");
    }

    updateProgressBar(current, total) {
        // console.log(`QuestionDisplay.js: updateProgressBar - Progresso: ${current}/${total}`);
        const { progressContainer, progressBarFill, progressText } = this.elements; //
        if (progressContainer && progressBarFill && progressText) { //
            if (total > 0) {
                const percentage = Math.min(current, total) / total * 100; //
                progressBarFill.style.width = `${percentage}%`; //
                progressText.textContent = `${Math.min(current,total)} / ${total}`; //
                this.quizUI.showElement(progressContainer); //
                this.quizUI.showElement(progressText); //
            } else {
                this.hideProgressBar(); //
            }
        }
    }

    hideProgressBar() {
        // console.log("QuestionDisplay.js: hideProgressBar - Ocultando barra de progresso.");
        this.quizUI.hideElement(this.elements.progressContainer); //
        this.quizUI.hideElement(this.elements.progressText); //
        if (this.elements.progressBarFill) this.elements.progressBarFill.style.width = "0%"; //
        if (this.elements.progressText) this.elements.progressText.textContent = ""; //
    }

    updateNavigationButtons() {
        // console.log("QuestionDisplay.js: updateNavigationButtons - Entrou.");
        const { navigationButtons, prevBtn, nextBtn } = this.elements; //
        if (!navigationButtons || !prevBtn || !nextBtn) {
            console.warn("QuestionDisplay.js: updateNavigationButtons - Elementos de navegação não encontrados.");
            return;
        }
        if (!this.quizState) { 
            console.error("QuestionDisplay.js: updateNavigationButtons - ERRO CRÍTICO: this.quizState é NULO ou INDEFINIDO.");
            prevBtn.disabled = true; //
            nextBtn.disabled = true; //
            return;
        }

        const totalQuestions = this.quizState.getTotalFilteredQuestions(); //
        const isFirst = this.quizState.isFirstQuestion(); //
        const isLast = this.quizState.isLastQuestion(); //

        if (totalQuestions <= 0) {
            this.quizUI.hideElement(navigationButtons); //
        } else {
            this.quizUI.showElement(navigationButtons); //
            prevBtn.disabled = isFirst; //
            nextBtn.disabled = false;  //

            const nextButtonLabel = nextBtn.querySelector('.button__label') || nextBtn; //
            if (isLast) { //
                nextButtonLabel.textContent = "Ver Resultado"; //
            } else {
                nextButtonLabel.textContent = "Avançar"; //
            }
        }
        // console.log("QuestionDisplay.js: updateNavigationButtons - Finalizado.");
    }
    
    _createGridArrow(direction, isDisabled, callback, ariaLabel, extraClasses = []) {
        const button = document.createElement('button'); //
        button.className = 'question-grid__arrow'; //
        if (Array.isArray(extraClasses)) button.classList.add(...extraClasses); //
        button.classList.add('u-is-circle'); //
        button.setAttribute('aria-label', ariaLabel); //
        button.disabled = isDisabled; //
        button.onclick = callback; //
        const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg"); //
        svgIcon.setAttribute("viewBox", "0 -960 960 960"); //
        svgIcon.setAttribute("fill", "currentColor"); //
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); //
        path.setAttribute("d", direction === 'prev' ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"); //
        svgIcon.appendChild(path); //
        button.appendChild(svgIcon); //
        return button; //
    }

    renderQuestionGrid() {
        // console.log("QuestionDisplay.js: renderQuestionGrid - Entrou.");
        const container = this.elements.questionGridContainer; //
        if (!container) {
            console.error("QuestionDisplay.js: renderQuestionGrid - ERRO: Container do grid não encontrado.");
            return;
        }

        if (!this.quizState) { 
            console.error("QuestionDisplay.js: renderQuestionGrid - ERRO CRÍTICO: this.quizState é NULO ou INDEFINIDO.");
            this.quizUI.hideElement(container); //
            return;
        }

        const questions = this.quizState.currentQuestionsSet; //
        const currentIndex = this.quizState.currentQuestionIndex; //

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            this.quizUI.hideElement(container); //
            return;
        }
        this.quizUI.showElement(container); //
        container.innerHTML = ''; //

        const currentPage = Math.floor(currentIndex / QUESTOES_POR_PAGINA_GRID); //
        const startIndex = currentPage * QUESTOES_POR_PAGINA_GRID; //
        const endIndex = Math.min(startIndex + QUESTOES_POR_PAGINA_GRID, questions.length); //

        const prevArrowCallback = () => { //
            if (this.navigationCallback) this.navigationCallback(Math.max(0, startIndex - 1)); //
        }
        container.appendChild(this._createGridArrow('prev', startIndex === 0, prevArrowCallback, 'Página Anterior de Questões', ['question-grid__arrow--left'])); //

        for (let i = startIndex; i < endIndex; i++) {
            const questionState = questions[i]; //
             if (!questionState) {
                continue; 
             }
            const item = document.createElement('button'); //
            item.className = 'question-grid__item'; //
            item.textContent = i + 1; //
            item.dataset.index = i.toString(); //
            item.setAttribute('aria-label', `Ir para Questão ${i + 1}`); //
            item.onclick = () => { //
                if (this.navigationCallback) this.navigationCallback(i); //
            };

            if (questionState.respostaDadaId !== undefined && questionState.respostaDadaId !== null) { //
                if (questionState.foiCorretaNaSessao === true) item.classList.add('question-grid__item--correct'); //
                else if (questionState.foiCorretaNaSessao === false) item.classList.add('question-grid__item--incorrect'); //
            } else if (questionState.foiPulada === true) { //
                item.classList.add('question-grid__item--skipped'); //
            }
            if (i === currentIndex) { //
                item.classList.add('question-grid__item--current'); //
            }
            container.appendChild(item); //
        }

        const nextArrowCallback = () => { //
            if (this.navigationCallback) this.navigationCallback(endIndex); //
        }
        container.appendChild(this._createGridArrow('next', endIndex >= questions.length, nextArrowCallback, 'Próxima Página de Questões', ['question-grid__arrow--right'])); //
        // console.log("QuestionDisplay.js: renderQuestionGrid - Finalizado.");
    }

    scrollToQuestionStart() {
        // console.log("QuestionDisplay.js: scrollToQuestionStart - Entrou.");
        const titleElement = this.elements.questionTitle; //
        if (this.elements.questionSection && !this.elements.questionSection.classList.contains(this.quizUI.hiddenClassName) && titleElement) { //
            titleElement.scrollIntoView({ behavior: "smooth", block: "center" }); //
        }
    }

    focusNextButton(preventScroll = false) {
        // console.log("QuestionDisplay.js: focusNextButton - Entrou.");
        this.elements.nextBtn?.focus({ preventScroll: preventScroll }); //
    }

    smoothScrollToNextButton() {
        // console.log("QuestionDisplay.js: smoothScrollToNextButton - Entrou.");
        this.elements.navigationButtons?.scrollIntoView({ behavior: "smooth", block: "nearest" }); //
    }
}