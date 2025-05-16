// File: assets/js/ui/QuizUI.js

import { QUESTOES_POR_PAGINA_GRID, TRANSITION_DURATION } from '../utils/constants.js';

export default class QuizUI {
    constructor(onSectionChangeCallback = null) {
        console.log("QuizUI: Constructor called");
        this.hiddenClassName = 'u-is-hidden';
        this.currentSection = null;
        this.onSectionChange = onSectionChangeCallback;

        this.timerInterval = null;
        this.timerSeconds = 0;
        this.timerRunning = false;

        this.focusedElementBeforePanel = null;
        this.focusedElementBeforeExplanationModal = null;
        this.focusedElementBeforeConfirmModal = null;

        this.quizState = null;
        this.quizData = null;
        this.filterPanelInstance = null; // Para referência à instância de FilterPanel

        this._cacheDOMelements();
    }

    setQuizState(quizStateInstance) {
        console.log("QuizUI: Setting QuizState instance");
        this.quizState = quizStateInstance;
    }

    setQuizData(quizDataInstance) {
        console.log("QuizUI: Setting QuizData instance");
        this.quizData = quizDataInstance;
    }

    setFilterPanelInstance(filterPanelInstance) {
        console.log("QuizUI: Setting FilterPanel instance");
        this.filterPanelInstance = filterPanelInstance;
    }

    _cacheDOMelements() {
        console.log("QuizUI: Caching DOM elements");
        this.elements = {
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'),
            accountSection: document.getElementById('account-section-page'),
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),
            scorePanel: document.querySelector('.score-panel'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            timerDisplay: document.getElementById('timer-display'),
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),
            challengeHubContainer: document.getElementById('challenge-hub-container'),
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'),
            hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'),
            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'),
            avisoContainer: document.getElementById('aviso-container'),
            avisoMensagem: document.querySelector('#aviso-container .card--aviso p'),
            quizSectionContent: document.getElementById('quiz-section'),
            questionWrap: document.querySelector('#quiz-section .card--question-wrap'),
            progressContainer: document.getElementById('progress-container'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressText: document.getElementById('progress-text'),
            questionTitle: document.getElementById('question-title'),
            categoriaTitulo: document.getElementById('categoria-titulo'),
            idQuestao: document.getElementById('id-questao'),
            perguntaTexto: document.getElementById('pergunta-texto'),
            perguntaImagem: document.getElementById('pergunta-imagem'),
            respostasContainer: document.getElementById('respostas-container'),
            referenciaQuestao: document.getElementById('referencia-questao'),
            feedbackAcessivel: document.getElementById('feedback-acessivel'),
            btnToggleExplanation: document.getElementById('btn-toggle-explanation'),
            navigationButtons: document.querySelector('#quiz-section .quiz-navigation'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            questionGridContainer: document.getElementById('question-grid-container'),
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn'),
            resultadoCard: document.querySelector('#question-section .card--quiz-result'),
            resultadoTitulo: document.querySelector('#question-section .card--quiz-result .quiz-results__main-title'),
            resultadoPontos: document.getElementById('resultado-pontos'),
            resultadoAcertos: document.getElementById('resultado-acertos'),
            resultadoErros: document.getElementById('resultado-erros'),
            resultadoTempo: document.getElementById('resultado-tempo'),
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'),
            btnRecomecar: document.getElementById('btn-recomecar'),
            btnExplorarMais: document.getElementById('btn-explorar-mais'),
            filterPanel: document.getElementById('filter-panel'),
            btnFecharFiltros: document.getElementById('btn-fechar-filtros'),
            filterPanelOverlay: document.getElementById('filter-panel-overlay'),
            explanationModalOverlay: document.getElementById('explanation-modal-overlay'),
            explanationModalDialog: document.getElementById('explanation-modal-dialog'),
            btnCloseExplanationModal: document.getElementById('btn-close-explanation-modal'),
            explanationModalGeneralBlock: document.getElementById('explanation-modal-general-block'),
            explanationModalGeneralText: document.getElementById('explanation-modal-general-text'),
            explanationModalOptionsBlock: document.getElementById('explanation-modal-options-block'),
            explanationModalOptionsList: document.getElementById('explanation-modal-options-list'),
            explanationModalDivider: document.querySelector('.explanation-modal__divider'),
            explanationModalEmptyState: document.getElementById('explanation-modal-empty-state'),
            btnGotItExplanation: document.getElementById('btn-got-it-explanation'),
        };
    }

    showElement(element) {
        element?.classList.remove(this.hiddenClassName);
    }

    hideElement(element) {
        element?.classList.add(this.hiddenClassName);
    }

    startTimer() {
        if (this.timerRunning) return;
        console.log("QuizUI: Starting timer");
        this.timerRunning = true;
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = this._formatDisplayTime(this.timerSeconds);
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            console.log("QuizUI: Stopping timer");
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerRunning = false;
    }

    resetTimer() {
        console.log("QuizUI: Resetting timer");
        this.stopTimer();
        this.timerSeconds = 0;
        if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = "00:00";
        if (this.elements.resultadoTempo && !this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
            this.elements.resultadoTempo.textContent = "00:00";
        }
    }

    _formatDisplayTime(totalSeconds) {
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    updateScoreDisplay(pontos, acertos, erros) {
        console.log(`QuizUI: Updating score display - Pontos: ${pontos}, Acertos: ${acertos}, Erros: ${erros}`);
        if (this.elements.pontuacaoDisplay) this.elements.pontuacaoDisplay.textContent = pontos;
        if (this.elements.acertosNumDisplay) this.elements.acertosNumDisplay.textContent = acertos;
        if (this.elements.errosNumDisplay) this.elements.errosNumDisplay.textContent = erros;
    }

    displayQuizContent(show = true) {
        console.log(`QuizUI: Toggling quiz content display to: ${show}`);
        const { quizSectionContent, btnEncerrarSessao, progressContainer, progressText, questionGridContainer, scorePanel, challengeHubContainer, placeholderFiltrosContainer, resultadoCard } = this.elements;
        if (show) {
            this.showElement(scorePanel);
            this.hideElement(challengeHubContainer);
            this.showElement(quizSectionContent);
            this.showElement(btnEncerrarSessao);
            this.showElement(progressContainer);
            this.showElement(progressText);
            this.showElement(questionGridContainer);
            this.clearWarning();
            this.hideElement(placeholderFiltrosContainer);
            this.hideElement(resultadoCard);
        } else {
            this.hideElement(scorePanel);
            this.hideElement(quizSectionContent);
            this.hideElement(btnEncerrarSessao);
            this.hideProgressBar();
            this.hideElement(questionGridContainer);
            this.toggleExplanationModal(false);
            this.hideElement(this.elements.btnToggleExplanation);
            if (resultadoCard && !resultadoCard.classList.contains(this.hiddenClassName)) {
                this.hideElement(challengeHubContainer);
            } else {
                if(challengeHubContainer) this.showElement(challengeHubContainer);
                this.hideElement(placeholderFiltrosContainer);
            }
        }
    }

    hideQuizElements() {
        console.log("QuizUI: Hiding all active quiz elements");
        const { quizSectionContent, resultadoCard, questionGridContainer, btnEncerrarSessao, scorePanel } = this.elements;
        this.hideElement(quizSectionContent);
        this.hideElement(resultadoCard);
        this.hideElement(questionGridContainer);
        this.hideElement(btnEncerrarSessao);
        this.hideElement(scorePanel);
        this.hideProgressBar();
        this.toggleExplanationModal(false);
        this.hideElement(this.elements.btnToggleExplanation);
    }

    displayQuestion(perguntaObj, qNum, totalQ, todasCategorias, relacaoPerguntaCategorias, isQuickQuizMode) {
        console.log(`QuizUI: Displaying question #${qNum}/${totalQ}`, perguntaObj);
        if (!perguntaObj || !this.quizData || !this.quizState) {
            console.error("QuizUI: Cannot display question, missing data or state.", {perguntaObj, quizData: this.quizData, quizState: this.quizState });
            return;
        }
        let tituloCat = "Questão";
        if (isQuickQuizMode) {
            tituloCat = "Quiz Rápido";
        } else {
            const idsCatPerg = relacaoPerguntaCategorias.filter(pc => pc.id_pergunta === perguntaObj.id_pergunta).map(pc => pc.id_categoria);
            if (idsCatPerg.length > 0) {
                let idCatMostrar = idsCatPerg[0];
                if (idsCatPerg.length > 1) {
                    const catObjsPerg = todasCategorias.filter(c => idsCatPerg.includes(c.id_categoria));
                    if (catObjsPerg.length > 0) {
                        idCatMostrar = catObjsPerg.reduce((deepest, curr) =>
                            this._getCategoriaProfundidade(curr, todasCategorias) > this._getCategoriaProfundidade(deepest, todasCategorias) ? curr : deepest,
                            catObjsPerg[0]
                        ).id_categoria;
                    }
                }
                let caminho = []; let idAtual = idCatMostrar; let i = 0;
                while (idAtual != null && i < 5) {
                    const catEnc = todasCategorias.find(cat => cat.id_categoria === idAtual);
                    if (catEnc) { caminho.unshift(catEnc.nome_categoria); idAtual = catEnc.id_categoria_pai; }
                    else break;
                    i++;
                }
                tituloCat = caminho.length > 0 ? caminho.join(' › ') : "Tópicos Diversos";
            }
        }
        if (this.elements.categoriaTitulo) this.elements.categoriaTitulo.innerText = tituloCat;
        if (this.elements.idQuestao) this.elements.idQuestao.innerText = qNum;
        if (this.elements.perguntaTexto) this.elements.perguntaTexto.textContent = perguntaObj.texto_pergunta;
        if (this.elements.referenciaQuestao) this.elements.referenciaQuestao.textContent = `Fonte: ${perguntaObj.referencia_bibliografica || "Não informada"}`;
        this._displayQuestionImage(perguntaObj.url_imagem, qNum);
        this.updateProgressBar(qNum, totalQ);
        this.elements.questionTitle?.focus({ preventScroll: true });
        this.hideElement(this.elements.btnToggleExplanation);
        this.toggleExplanationModal(false);
    }

    _getCategoriaProfundidade(cat, allCats) {
        if (!cat || !allCats) return -1;
        let depth = 0; let parentId = cat.id_categoria_pai; let iterations = 0;
        while (parentId != null && iterations < 10) {
            depth++;
            const parent = allCats.find(c => c.id_categoria === parentId);
            parentId = parent ? parent.id_categoria_pai : null;
            iterations++;
        }
        return depth;
    }

    _displayQuestionImage(url, qNum) {
        const imgElement = this.elements.perguntaImagem;
        if (imgElement) {
            if (url && url.trim()) {
                imgElement.src = url;
                imgElement.alt = `Ilustração para questão ${qNum}`;
                this.showElement(imgElement);
                imgElement.onerror = () => { this.hideElement(imgElement); imgElement.onerror = null; };
            } else {
                this.hideElement(imgElement);
                imgElement.src = ""; imgElement.alt = "";
            }
        }
    }

    generateAnswerButtons(perguntaId, opcoes, respostaDadaId, callbackResposta) {
        console.log(`QuizUI: Generating answer buttons for question ID ${perguntaId}. Answered: ${respostaDadaId !== undefined}`);
        const container = this.elements.respostasContainer;
        if (!container) return;
        container.innerHTML = '';
        if (!opcoes || opcoes.length === 0) {
            console.warn("QuizUI: No options provided to generateAnswerButtons for question ID", perguntaId);
            return;
        }
        const temResposta = typeof respostaDadaId !== 'undefined' && respostaDadaId !== null;
        const baseClass = 'question-display__answer-option';
        opcoes.forEach(opt => {
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
            } else if (callbackResposta) {
                button.onclick = () => {
                    console.log(`QuizUI: Answer button clicked, option ID: ${opt.id_opcao_resposta}`);
                    callbackResposta(opt.id_opcao_resposta);
                };
            }
            container.appendChild(button);
        });
    }

    disableAnswers() {
        console.log("QuizUI: Disabling answer buttons");
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
        console.log(`QuizUI: Applying answer feedback for selected option ID: ${selectedOpId}`);
        const baseCl = "question-display__answer-option";
        const corrCl = `${baseCl}--correct`;
        const incorrCl = `${baseCl}--incorrect`;
        let userCorrect = false;
        this.elements.respostasContainer?.querySelectorAll(`button.${baseCl}`).forEach(btn => {
            const btnOpId = parseInt(btn.dataset.opcaoId);
            const optionData = opcoes.find(op => op.id_opcao_resposta === btnOpId);
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
        const currentQ = this.quizState?.getCurrentQuestion();
        const hasGeneralExplanation = currentQ && currentQ.explicacao_resposta?.trim() !== '';
        const hasOptionSpecificFeedback = opcoes.some(op => op.feedback_opcao?.trim() !== '');
        if ((hasGeneralExplanation || hasOptionSpecificFeedback) && this.elements.btnToggleExplanation) {
            console.log("QuizUI: Showing toggle explanation button");
            this.showElement(this.elements.btnToggleExplanation);
        } else {
            this.hideElement(this.elements.btnToggleExplanation);
        }
    }

    updateProgressBar(current, total) {
        const { progressContainer, progressBarFill, progressText } = this.elements;
        if (progressContainer && progressBarFill && progressText) {
            if (total > 0) {
                const percentage = Math.min(current, total) / total * 100;
                progressBarFill.style.width = `${percentage}%`;
                progressText.textContent = `${current} / ${total}`;
                this.showElement(progressContainer);
                this.showElement(progressText);
            } else {
                this.hideProgressBar();
            }
        }
    }

    hideProgressBar() {
        this.hideElement(this.elements.progressContainer);
        this.hideElement(this.elements.progressText);
        if (this.elements.progressBarFill) this.elements.progressBarFill.style.width = "0%";
        if (this.elements.progressText) this.elements.progressText.textContent = "";
    }

    updateNavigationButtons(isFirst, isLast, totalQuestions) {
        console.log(`QuizUI: Updating navigation buttons - isFirst: ${isFirst}, isLast: ${isLast}, totalQ: ${totalQuestions}`);
        const { navigationButtons, prevBtn, nextBtn } = this.elements;
        if (navigationButtons && prevBtn && nextBtn) {
            if (totalQuestions <= 0) {
                this.hideElement(navigationButtons);
            } else {
                this.showElement(navigationButtons);
                prevBtn.disabled = isFirst;
                nextBtn.disabled = false;
                nextBtn.textContent = isLast ? "Ver Resultado" : " Avançar";
                const existingIcon = nextBtn.querySelector('.button__icon--right');
                if (!isLast && !existingIcon) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'material-symbols-outlined button__icon button__icon--right';
                    iconSpan.textContent = 'arrow_forward';
                    nextBtn.appendChild(iconSpan);
                } else if (isLast && existingIcon) {
                    existingIcon.remove();
                }
            }
        }
    }

    toggleFilterPanel(show) { // Removido filterPanelInstance, pois QuizUI só controla visibilidade
        console.log(`QuizUI: Toggling filter panel to: ${show}`);
        const panel = this.elements.filterPanel;
        const overlay = this.elements.filterPanelOverlay;
        if (!panel || !overlay) return;

        const panelVisibleClass = 'filter-panel--visible';
        const overlayVisibleClass = 'filter-panel-overlay--visible';

        if (show) {
            this.focusedElementBeforePanel = document.activeElement;
            // Agora, FilterPanel.loadCurrentFilters() é chamado por App.js ou QuizLogic antes de mostrar
            // ou quando FilterPanel é instanciado/inicializado.
            if (this.filterPanelInstance) { // Verifica se a instância foi setada
                this.filterPanelInstance.loadCurrentFilters();
            }


            this.showElement(overlay); this.showElement(panel);
            if (this.elements.challengeHubContainer?.classList.contains(this.hiddenClassName) &&
                this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                this.showElement(this.elements.placeholderFiltrosContainer);
            }
            panel.removeAttribute('aria-hidden'); overlay.removeAttribute('aria-hidden');
            requestAnimationFrame(() => {
                overlay.classList.add(overlayVisibleClass);
                panel.classList.add(panelVisibleClass);
                panel.focus();
            });
        } else {
            panel.classList.remove(panelVisibleClass);
            overlay.classList.remove(overlayVisibleClass);
            const onTransitionEnd = () => {
                if (!panel.classList.contains(panelVisibleClass)) {
                    this.hideElement(panel); this.hideElement(overlay);
                    panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true');
                }
                panel.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforePanel?.focus();
                if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                    this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                    this.hideElement(this.elements.placeholderFiltrosContainer);
                    if(this.elements.challengeHubContainer) this.showElement(this.elements.challengeHubContainer);
                }
            };
            panel.addEventListener('transitionend', onTransitionEnd, { once: true });
            setTimeout(() => {
                if (!panel.classList.contains(panelVisibleClass)) {
                    this.hideElement(panel); this.hideElement(overlay);
                    panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true');
                    this.focusedElementBeforePanel?.focus();
                     if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                        this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                        this.hideElement(this.elements.placeholderFiltrosContainer);
                        if(this.elements.challengeHubContainer) this.showElement(this.elements.challengeHubContainer);
                    }
                }
                panel.removeEventListener('transitionend', onTransitionEnd);
            }, TRANSITION_DURATION + 70);
        }
    }

    toggleExplanationModal(show) {
        console.log(`QuizUI: Toggling explanation modal to: ${show}`);
        const overlay = this.elements.explanationModalOverlay;
        const dialog = this.elements.explanationModalDialog;
        if (!overlay || !dialog || !this.quizState || !this.quizData) return;
        const modalVisibleClass = 'modal--visible';
        if (show) {
            const currentQuestion = this.quizState.getCurrentQuestion();
            if (!currentQuestion) return;
            const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
            let hasContent = false;
            const generalBlock = this.elements.explanationModalGeneralBlock;
            const generalText = this.elements.explanationModalGeneralText;
            if (currentQuestion.explicacao_resposta?.trim()) {
                generalText.innerHTML = currentQuestion.explicacao_resposta.replace(/\n/g, '<br>');
                this.showElement(generalBlock); hasContent = true;
            } else { this.hideElement(generalBlock); }
            const optionsBlock = this.elements.explanationModalOptionsBlock;
            const optionsList = this.elements.explanationModalOptionsList;
            optionsList.innerHTML = ''; let hasSpecificOptionFeedback = false;
            options.forEach(opt => {
                if (opt.feedback_opcao?.trim()) {
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
                    li.appendChild(feedbackValueSpan); optionsList.appendChild(li);
                }
            });
            if (hasSpecificOptionFeedback) { this.showElement(optionsBlock); hasContent = true; }
            else { this.hideElement(optionsBlock); }
            const divider = this.elements.explanationModalDivider;
            if (generalBlock && !generalBlock.classList.contains(this.hiddenClassName) &&
                optionsBlock && !optionsBlock.classList.contains(this.hiddenClassName) && divider) {
                this.showElement(divider);
            } else if (divider) { this.hideElement(divider); }
            const emptyState = this.elements.explanationModalEmptyState;
            if (!hasContent && emptyState) { this.showElement(emptyState); }
            else if (emptyState) { this.hideElement(emptyState); }
            this.focusedElementBeforeExplanationModal = document.activeElement;
            this.showElement(overlay); overlay.scrollTop;
            requestAnimationFrame(() => { overlay.classList.add(modalVisibleClass); dialog.focus(); });
        } else {
            overlay.classList.remove(modalVisibleClass);
            const onTransitionEnd = () => {
                if (!overlay.classList.contains(modalVisibleClass)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeExplanationModal?.focus();
            };
            overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
            setTimeout(() => {
                if (!overlay.classList.contains(modalVisibleClass)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeExplanationModal?.focus();
            }, TRANSITION_DURATION + 70);
        }
    }

    toggleConfirmModal(show) {
        console.log(`QuizUI: Toggling confirm modal to: ${show}`);
        const overlay = this.elements.confirmEncerrarOverlay;
        if (!overlay) return;
        const modalVisibleClass = 'modal--visible';
        if (show) {
            this.focusedElementBeforeConfirmModal = document.activeElement;
            this.showElement(overlay); overlay.scrollTop;
            requestAnimationFrame(() => {
                overlay.classList.add(modalVisibleClass);
                this.elements.cancelEncerrarBtn?.focus();
            });
        } else {
            overlay.classList.remove(modalVisibleClass);
            const onTransitionEnd = () => {
                if (!overlay.classList.contains(modalVisibleClass)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeConfirmModal?.focus();
            };
            overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
            setTimeout(() => {
                if (!overlay.classList.contains(modalVisibleClass)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeConfirmModal?.focus();
            }, TRANSITION_DURATION + 70);
        }
    }

    showResults(userData, totalQuestionsInSession) {
        console.log("QuizUI: Displaying results", { userData, totalQuestionsInSession, timerSeconds: this.timerSeconds });
        const { resultadoCard, resultadoTitulo, resultadoPontos, resultadoAcertos, resultadoErros, resultadoTempo, resultadoMensagemMotivacional, scorePanel, challengeHubContainer, placeholderFiltrosContainer } = this.elements;
        if (!resultadoCard || !userData) {
            console.error("QuizUI: Cannot show results, missing elements or userData.");
            return;
        }
        this.hideQuizElements();
        this.hideElement(scorePanel); this.hideElement(challengeHubContainer); this.hideElement(placeholderFiltrosContainer);
        if(resultadoTitulo) resultadoTitulo.textContent = "Seu Desempenho Final";
        if(resultadoPontos) resultadoPontos.textContent = userData.pontos;
        if(resultadoAcertos) resultadoAcertos.textContent = userData.acertos;
        if(resultadoErros) resultadoErros.textContent = userData.erros;
        if(resultadoTempo) resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds);
        if(resultadoMensagemMotivacional) {
            const pontos = userData.pontos; const acertos = userData.acertos; let mensagem = "Continue praticando para melhorar!";
            if (totalQuestionsInSession > 0) {
                const maxPontosPossiveis = totalQuestionsInSession * 15;
                if (pontos >= maxPontosPossiveis * 0.9) mensagem = "Resultado Incrível! Parabéns!";
                else if (pontos >= maxPontosPossiveis * 0.7) mensagem = "Excelente desempenho! Continue assim!";
                else if (pontos >= maxPontosPossiveis * 0.5) mensagem = "Muito bom! Você está no caminho certo.";
                else if (pontos === 0 && acertos === 0 && userData.erros > 0) mensagem = "Ops! Nenhuma questão acertada. Revise o conteúdo e tente novamente!";
            } else if (pontos === 0 && acertos === 0 && userData.erros === 0 && totalQuestionsInSession === 0) {
                mensagem = "Nenhuma questão foi jogada nesta sessão. Que tal tentar um novo desafio?";
            }
            resultadoMensagemMotivacional.textContent = mensagem;
        }
        this.showElement(resultadoCard); resultadoTitulo?.focus();
    }

    hideResults() {
        console.log("QuizUI: Hiding results card");
        this.hideElement(this.elements.resultadoCard);
    }

    showWarning(message) {
        console.warn("QuizUI: Displaying warning:", message);
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        if (avisoContainer && avisoMensagem) {
            avisoMensagem.textContent = message; avisoMensagem.setAttribute("role", "alert");
            this.showElement(avisoContainer);
            this.hideElement(placeholderFiltrosContainer); this.hideElement(challengeHubContainer);
            this.hideElement(quizSectionContent); this.hideElement(resultadoCard);
        }
    }

    clearWarning() {
        console.log("QuizUI: Clearing warning");
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        this.hideElement(avisoContainer);
        if (avisoMensagem) avisoMensagem.removeAttribute("role");
        if (document.getElementById('question-section')) {
            if (quizSectionContent?.classList.contains(this.hiddenClassName) &&
                resultadoCard?.classList.contains(this.hiddenClassName) &&
                placeholderFiltrosContainer?.classList.contains(this.hiddenClassName)) {
                if(challengeHubContainer) this.showElement(challengeHubContainer);
            }
        }
    }

    scrollToQuestionStart() {
        const titleElement = this.elements.questionTitle;
        if (this.currentSection === "question-section-page" && titleElement) {
            titleElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    focusNextButton(preventScroll = false) {
        this.elements.nextBtn?.focus({ preventScroll: preventScroll });
    }

    smoothScrollToNextButton() {
        const navButtonsContainer = this.elements.navigationButtons;
        navButtonsContainer?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    setupGlobalEventListeners(quizLogicInstance) {
        console.log("QuizUI: Setting up global event listeners");
        if (!quizLogicInstance) {
            console.error("QuizUI: QuizLogic instance not provided to setupGlobalEventListeners");
            return;
        }

        this.elements.btnFecharFiltros?.addEventListener('click', () => {
            console.log("QuizUI: Close filter panel button clicked");
            this.toggleFilterPanel(false); // filterPanelInstance é gerenciado por App e passado para toggleFilterPanel se necessário
        });
        this.elements.filterPanelOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.filterPanelOverlay) {
                console.log("QuizUI: Filter panel overlay clicked");
                this.toggleFilterPanel(false);
            }
        });
        this.elements.closeFiltersAndShowHubBtn?.addEventListener('click', () => {
            console.log("QuizUI: Close filters and show hub button clicked");
            this.toggleFilterPanel(false);
            if(this.elements.challengeHubContainer) this.showElement(this.elements.challengeHubContainer);
            this.hideElement(this.elements.placeholderFiltrosContainer);
        });

        this.elements.prevBtn?.addEventListener('click', () => {
            console.log("QuizUI: Previous question button clicked");
            quizLogicInstance.previousQuestion();
        });
        this.elements.nextBtn?.addEventListener('click', () => {
            console.log("QuizUI: Next question button clicked");
            quizLogicInstance.nextQuestion();
        });

        this.elements.btnRecomecar?.addEventListener('click', () => {
            console.log("QuizUI: Restart quiz button clicked");
            quizLogicInstance.restartQuiz();
        });
        this.elements.btnExplorarMais?.addEventListener('click', () => {
            console.log("QuizUI: Explore more (back to home) button clicked");
            const homeLink = document.querySelector('.site-header__logo a, .main-nav__link[href="/"], .bottom-nav__link[href="/"], a[href="{% url \'quiz:home\' %}"]'); // Tentativa de ser genérico
            if (homeLink && homeLink.href) window.location.href = homeLink.href;
            else window.location.href = '/';
        });

        this.elements.btnEncerrarSessao?.addEventListener('click', () => {
            console.log("QuizUI: End session button clicked (opens confirm modal)");
            this.toggleConfirmModal(true);
        });
        this.elements.confirmEncerrarBtn?.addEventListener('click', () => {
            console.log("QuizUI: Confirm end session button clicked");
            quizLogicInstance.forceEndQuizByUser();
        });
        this.elements.cancelEncerrarBtn?.addEventListener('click', () => {
            console.log("QuizUI: Cancel end session button clicked");
            this.toggleConfirmModal(false);
        });
        this.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmEncerrarOverlay) {
                console.log("QuizUI: Confirm end session overlay clicked");
                this.toggleConfirmModal(false);
            }
        });

        this.elements.btnToggleExplanation?.addEventListener('click', () => {
            console.log("QuizUI: Toggle explanation button clicked");
            this.toggleExplanationModal(true);
        });
        this.elements.btnCloseExplanationModal?.addEventListener('click', () => {
            console.log("QuizUI: Close explanation modal button clicked");
            this.toggleExplanationModal(false);
        });
        this.elements.btnGotItExplanation?.addEventListener('click', () => {
            console.log("QuizUI: 'Got it' explanation button clicked");
            this.toggleExplanationModal(false);
        });
        this.elements.explanationModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.explanationModalOverlay) {
                console.log("QuizUI: Explanation modal overlay clicked");
                this.toggleExplanationModal(false);
            }
        });
    }

    renderQuestionGrid(questions, currentIndex, callbackSelectQuestion) {
        // console.log(`QuizUI: Rendering question grid. Current index: ${currentIndex}, Total questions in set: ${questions?.length}`);
        const container = this.elements.questionGridContainer;
        if (!container) return;
        if (!questions?.length) { this.hideElement(container); return; }
        this.showElement(container); container.innerHTML = '';
        const currentPage = Math.floor(currentIndex / QUESTOES_POR_PAGINA_GRID);
        const startIndex = currentPage * QUESTOES_POR_PAGINA_GRID;
        const endIndex = Math.min(startIndex + QUESTOES_POR_PAGINA_GRID, questions.length);
        container.appendChild(this._createGridArrow('prev', startIndex === 0, () => callbackSelectQuestion(Math.max(0, startIndex - QUESTOES_POR_PAGINA_GRID)), 'Página Anterior de Questões', ['question-grid__arrow--left']));
        for (let i = startIndex; i < endIndex; i++) {
            const questionState = questions[i];
            const item = document.createElement('button');
            item.className = 'question-grid__item'; item.textContent = i + 1;
            item.dataset.index = i.toString(); item.setAttribute('aria-label', `Ir para Questão ${i + 1}`);
            item.onclick = () => callbackSelectQuestion(i);
            if (questionState.respostaDadaId !== undefined && questionState.respostaDadaId !== null) {
                if (questionState.foiCorretaNaSessao === true) item.classList.add('question-grid__item--correct');
                else if (questionState.foiCorretaNaSessao === false) item.classList.add('question-grid__item--incorrect');
            } else if (questionState.foiPulada === true) {
                item.classList.add('question-grid__item--skipped');
            }
            if (i === currentIndex) item.classList.add('question-grid__item--current');
            container.appendChild(item);
        }
        container.appendChild(this._createGridArrow('next', endIndex >= questions.length, () => callbackSelectQuestion(Math.min(questions.length - 1, endIndex)), 'Próxima Página de Questões', ['question-grid__arrow--right']));
    }

    _createGridArrow(direction, isDisabled, callback, ariaLabel, extraClasses = []) {
        const button = document.createElement('button');
        button.className = 'question-grid__arrow'; button.classList.add(...extraClasses, 'u-is-circle');
        button.setAttribute('aria-label', ariaLabel); button.disabled = isDisabled; button.onclick = callback;
        const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgIcon.setAttribute("viewBox", "0 -960 960 960"); svgIcon.setAttribute("fill", "currentColor");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", direction === 'prev' ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z");
        svgIcon.appendChild(path); button.appendChild(svgIcon); return button;
    }
}