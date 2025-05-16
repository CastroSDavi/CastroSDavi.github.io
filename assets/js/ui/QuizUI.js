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
        console.log("QuizUI: Setting QuizState instance:", quizStateInstance);
        this.quizState = quizStateInstance;
    }

    setQuizData(quizDataInstance) {
        console.log("QuizUI: Setting QuizData instance:", quizDataInstance);
        this.quizData = quizDataInstance;
    }

    setFilterPanelInstance(filterPanelInstance) {
        console.log("QuizUI: Setting FilterPanel instance:", filterPanelInstance);
        this.filterPanelInstance = filterPanelInstance;
    }

    _cacheDOMelements() {
        console.log("QuizUI: _cacheDOMelements - Iniciando cache de elementos DOM.");
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

            // ===== CORREÇÃO E VERIFICAÇÃO =====
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'),
            hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),
            // =======================================

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
        // Logs para verificar se os botões do hub foram encontrados
        console.log("QuizUI _cacheDOMelements: hubCustomizeQuizBtn encontrado:", this.elements.hubCustomizeQuizBtn);
        console.log("QuizUI _cacheDOMelements: hubQuickQuizBtn encontrado:", this.elements.hubQuickQuizBtn);
        console.log("QuizUI _cacheDOMelements: Todos os elementos cacheados:", this.elements);
    }

    showElement(element) {
        // console.log("QuizUI: showElement - Tentando mostrar:", element);
        element?.classList.remove(this.hiddenClassName);
    }

    hideElement(element) {
        // console.log("QuizUI: hideElement - Tentando esconder:", element);
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
        console.log(`QuizUI: displayQuizContent - Tentando ${show ? 'MOSTRAR' : 'ESCONDER'} conteúdo do quiz.`);
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
            console.log("QuizUI: displayQuizContent - Conteúdo do quiz MOSTRADO.");
        } else {
            this.hideElement(scorePanel);
            this.hideElement(quizSectionContent);
            this.hideElement(btnEncerrarSessao);
            this.hideProgressBar();
            this.hideElement(questionGridContainer);
            this.toggleExplanationModal(false); // Garante que o modal de explicação seja fechado
            this.hideElement(this.elements.btnToggleExplanation); // Esconde o botão de explicação
            // Lógica para mostrar o hub ou placeholder se o quiz for escondido
            if (resultadoCard && !resultadoCard.classList.contains(this.hiddenClassName)) {
                 console.log("QuizUI: displayQuizContent - Resultados estão visíveis, hub permanecerá escondido.");
                this.hideElement(challengeHubContainer); // Mantém o hub escondido se os resultados estiverem visíveis
            } else {
                console.log("QuizUI: displayQuizContent - Quiz escondido, mostrando hub e escondendo placeholder de filtros.");
                if(challengeHubContainer) this.showElement(challengeHubContainer);
                this.hideElement(placeholderFiltrosContainer);
            }
             console.log("QuizUI: displayQuizContent - Conteúdo do quiz ESCONDIDO.");
        }
    }

    hideQuizElements() {
        console.log("QuizUI: hideQuizElements - Escondendo todos os elementos ativos do quiz.");
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
        console.log(`QuizUI: displayQuestion - Exibindo pergunta #${qNum}/${totalQ}. Modo rápido: ${isQuickQuizMode}`, perguntaObj);
        if (!perguntaObj || !this.quizData || !this.quizState) {
            console.error("QuizUI: displayQuestion - ERRO: Não é possível exibir a pergunta, faltam dados ou estado.", {perguntaObj, quizData: this.quizData, quizState: this.quizState });
            return;
        }
        let tituloCat = "Questão";
        if (isQuickQuizMode) {
            tituloCat = "Quiz Rápido";
        } else {
            // Lógica para encontrar o nome da categoria mais específico
            const idsCatPerg = perguntaObj.categoria_ids || []; // Garante que seja um array
            if (idsCatPerg.length > 0) {
                let idCatMostrar = idsCatPerg[0];
                // Se a pergunta tiver múltiplas categorias, tenta encontrar a mais aninhada (mais específica)
                if (idsCatPerg.length > 1 && Array.isArray(todasCategorias)) {
                    const catObjsPerg = todasCategorias.filter(c => idsCatPerg.includes(c.id_categoria));
                    if (catObjsPerg.length > 0) {
                        idCatMostrar = catObjsPerg.reduce((deepest, curr) =>
                            this._getCategoriaProfundidade(curr, todasCategorias) > this._getCategoriaProfundidade(deepest, todasCategorias) ? curr : deepest,
                            catObjsPerg[0]
                        ).id_categoria;
                    }
                }
                // Constrói o caminho da categoria (breadcrumbs)
                let caminho = []; let idAtual = idCatMostrar; let i = 0;
                while (idAtual != null && Array.isArray(todasCategorias) && i < 5) { // i < 5 para evitar loops infinitos
                    const catEnc = todasCategorias.find(cat => cat.id_categoria === idAtual);
                    if (catEnc) {
                        caminho.unshift(catEnc.nome_categoria);
                        idAtual = catEnc.id_categoria_pai; // Assumindo que o pai é id_categoria_pai
                    } else {
                        break;
                    }
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
        this.elements.questionTitle?.focus({ preventScroll: true }); // Foco para acessibilidade
        this.hideElement(this.elements.btnToggleExplanation); // Esconde o botão de explicação por padrão
        this.toggleExplanationModal(false); // Garante que o modal de explicação está fechado
        console.log("QuizUI: displayQuestion - Pergunta renderizada na UI.");
    }

    _getCategoriaProfundidade(cat, allCats) {
        if (!cat || !allCats || !Array.isArray(allCats)) return -1;
        let depth = 0;
        let parentId = cat.id_categoria_pai;
        let iterations = 0; // Para evitar loops infinitos em caso de dados malformados
        while (parentId != null && iterations < 10) { // Limite de 10 níveis de profundidade
            depth++;
            const parent = allCats.find(c => c.id_categoria === parentId);
            parentId = parent ? parent.id_categoria_pai : null;
            iterations++;
        }
        return depth;
    }

    _displayQuestionImage(url, qNum) {
        // console.log("QuizUI: _displayQuestionImage - Tentando exibir imagem:", url);
        const imgElement = this.elements.perguntaImagem;
        if (imgElement) {
            if (url && typeof url === 'string' && url.trim()) {
                imgElement.src = url;
                imgElement.alt = `Ilustração para questão ${qNum}`;
                this.showElement(imgElement);
                imgElement.onerror = () => {
                    console.warn("QuizUI: _displayQuestionImage - ERRO ao carregar imagem:", url);
                    this.hideElement(imgElement);
                    imgElement.onerror = null; // Evita loop de erro se a imagem de fallback também falhar
                };
            } else {
                this.hideElement(imgElement);
                imgElement.src = "";
                imgElement.alt = "";
            }
        }
    }

    generateAnswerButtons(perguntaId, opcoes, respostaDadaId, callbackResposta) {
        console.log(`QuizUI: generateAnswerButtons - Gerando botões para pergunta ID ${perguntaId}. Já respondida (ID): ${respostaDadaId}`);
        const container = this.elements.respostasContainer;
        if (!container) {
            console.error("QuizUI: generateAnswerButtons - ERRO: Container de respostas não encontrado.");
            return;
        }
        container.innerHTML = ''; // Limpa opções anteriores
        if (!opcoes || !Array.isArray(opcoes) || opcoes.length === 0) {
            console.warn("QuizUI: generateAnswerButtons - Nenhuma opção fornecida para a pergunta ID", perguntaId);
            // Opcional: exibir uma mensagem no container se não houver opções
            // container.textContent = "Nenhuma opção de resposta disponível.";
            return;
        }

        const temResposta = typeof respostaDadaId !== 'undefined' && respostaDadaId !== null;
        const baseClass = 'question-display__answer-option';

        opcoes.forEach(opt => {
            const button = document.createElement('button');
            button.className = baseClass;
            button.textContent = opt.texto_opcao;
            button.dataset.opcaoId = opt.id_opcao_resposta.toString(); // Garante que seja string
            button.disabled = temResposta;
            button.style.cursor = temResposta ? 'default' : 'pointer';
            button.tabIndex = temResposta ? -1 : 0; // Acessibilidade

            if (temResposta) {
                button.classList.add(`${baseClass}--answered`);
                if (opt.eh_correta) {
                    button.classList.add(`${baseClass}--correct`);
                } else if (opt.id_opcao_resposta === respostaDadaId) { // Se esta foi a opção incorreta selecionada
                    button.classList.add(`${baseClass}--incorrect`);
                }
            } else if (callbackResposta && typeof callbackResposta === 'function') {
                button.onclick = () => {
                    console.log(`QuizUI: Botão de resposta CLICADO. Pergunta ID: ${perguntaId}, Opção ID: ${opt.id_opcao_resposta}`);
                    callbackResposta(opt.id_opcao_resposta); // Chama o callback com o ID da opção
                };
            }
            container.appendChild(button);
        });
        // console.log("QuizUI: generateAnswerButtons - Botões de resposta gerados.");
    }

    disableAnswers() {
        console.log("QuizUI: disableAnswers - Desabilitando botões de resposta.");
        const baseClass = 'question-display__answer-option';
        const answeredClass = `${baseClass}--answered`;
        this.elements.respostasContainer?.querySelectorAll(`button.${baseClass}`).forEach(button => {
            button.onclick = null; // Remove listener de clique
            button.disabled = true;
            button.classList.add(answeredClass); // Adiciona classe que pode ter estilo para desabilitado/respondido
            button.style.cursor = "default";
            button.tabIndex = -1; // Remove da navegação por Tab
        });
    }

    applyAnswerFeedback(selectedOpId, opcoes) {
        console.log(`QuizUI: applyAnswerFeedback - Aplicando feedback para opção ID selecionada: ${selectedOpId}`);
        const baseCl = "question-display__answer-option";
        const corrCl = `${baseCl}--correct`;
        const incorrCl = `${baseCl}--incorrect`;
        let userCorrect = false;

        if (!Array.isArray(opcoes)) {
            console.error("QuizUI: applyAnswerFeedback - ERRO: 'opcoes' não é um array.");
            return;
        }

        this.elements.respostasContainer?.querySelectorAll(`button.${baseCl}`).forEach(btn => {
            const btnOpId = parseInt(btn.dataset.opcaoId, 10); // Converte para número
            const optionData = opcoes.find(op => op.id_opcao_resposta === btnOpId);

            if (!optionData) {
                console.warn("QuizUI: applyAnswerFeedback - Não encontrou dados para a opção do botão ID:", btnOpId);
                return; // Pula este botão se não encontrar a opção correspondente
            }

            // Aplica feedback se esta é a opção que o usuário selecionou
            if (btnOpId === selectedOpId) {
                if (optionData.eh_correta) {
                    btn.classList.add(corrCl);
                    userCorrect = true;
                } else {
                    btn.classList.add(incorrCl);
                }
            } else if (optionData.eh_correta) {
                // Se não foi a selecionada, mas é a correta, marca como correta (para o usuário ver)
                btn.classList.add(corrCl);
            }
        });

        if (this.elements.feedbackAcessivel) {
            this.elements.feedbackAcessivel.textContent = userCorrect ? "Você acertou!" : "Resposta incorreta.";
        }

        // Mostra o botão de "Analisar Resposta" se houver explicação
        const currentQ = this.quizState?.getCurrentQuestion();
        const hasGeneralExplanation = currentQ && currentQ.explicacao_resposta && currentQ.explicacao_resposta.trim() !== '';
        const hasOptionSpecificFeedback = opcoes.some(op => op.feedback_opcao && op.feedback_opcao.trim() !== '');

        if ((hasGeneralExplanation || hasOptionSpecificFeedback) && this.elements.btnToggleExplanation) {
            console.log("QuizUI: applyAnswerFeedback - Mostrando botão 'Analisar Resposta'.");
            this.showElement(this.elements.btnToggleExplanation);
        } else {
            this.hideElement(this.elements.btnToggleExplanation);
        }
    }

    updateProgressBar(current, total) {
        // console.log(`QuizUI: updateProgressBar - Atual: ${current}, Total: ${total}`);
        const { progressContainer, progressBarFill, progressText } = this.elements;
        if (progressContainer && progressBarFill && progressText) {
            if (total > 0) {
                const percentage = Math.min(current, total) / total * 100;
                progressBarFill.style.width = `${percentage}%`;
                progressText.textContent = `${Math.min(current,total)} / ${total}`; // Garante que current não exceda total no display
                this.showElement(progressContainer);
                this.showElement(progressText);
            } else {
                this.hideProgressBar(); // Esconde se não houver total (ex: quiz vazio)
            }
        }
    }

    hideProgressBar() {
        // console.log("QuizUI: hideProgressBar - Escondendo barra de progresso.");
        this.hideElement(this.elements.progressContainer);
        this.hideElement(this.elements.progressText);
        if (this.elements.progressBarFill) this.elements.progressBarFill.style.width = "0%";
        if (this.elements.progressText) this.elements.progressText.textContent = "";
    }

    updateNavigationButtons(isFirst, isLast, totalQuestions) {
        console.log(`QuizUI: updateNavigationButtons - É a primeira: ${isFirst}, É a última: ${isLast}, Total de questões: ${totalQuestions}`);
        const { navigationButtons, prevBtn, nextBtn } = this.elements;

        if (navigationButtons && prevBtn && nextBtn) {
            if (totalQuestions <= 0) {
                this.hideElement(navigationButtons);
                 console.log("QuizUI: updateNavigationButtons - Sem questões, botões de navegação escondidos.");
            } else {
                this.showElement(navigationButtons);
                prevBtn.disabled = isFirst;

                // O botão "Avançar" nunca deve ser desabilitado se houver questões.
                // Ele se torna "Ver Resultado" na última questão.
                nextBtn.disabled = false;

                const nextButtonLabel = nextBtn.querySelector('.button__label') || nextBtn; // Pega o label ou o próprio botão
                let iconSpan = nextBtn.querySelector('.material-symbols-outlined.button__icon--right');

                if (isLast) {
                    nextButtonLabel.textContent = "Ver Resultado";
                    if (iconSpan) iconSpan.remove(); // Remove ícone de seta se existir
                } else {
                    nextButtonLabel.textContent = "Avançar";
                    if (!iconSpan) { // Adiciona ícone de seta se não existir
                        iconSpan = document.createElement('span');
                        iconSpan.className = 'material-symbols-outlined button__icon button__icon--right';
                        iconSpan.textContent = 'arrow_forward';
                        // Se o texto está diretamente no botão, e não num span .button__label
                        if (nextBtn === nextButtonLabel) {
                            nextBtn.appendChild(iconSpan);
                        } else { // Se houver um .button__label, insere o ícone após ele
                            nextButtonLabel.parentNode.insertBefore(iconSpan, nextButtonLabel.nextSibling);
                        }
                    } else {
                        iconSpan.textContent = 'arrow_forward'; // Garante que o ícone seja o de avançar
                    }
                }
                // console.log("QuizUI: updateNavigationButtons - Botões de navegação atualizados.");
            }
        } else {
            console.warn("QuizUI: updateNavigationButtons - Elementos de navegação (ou botões) não encontrados.");
        }
    }

    toggleFilterPanel(show) {
        console.log(`QuizUI: toggleFilterPanel - Tentando ${show ? 'MOSTRAR' : 'ESCONDER'} painel de filtros.`);
        const panel = this.elements.filterPanel;
        const overlay = this.elements.filterPanelOverlay;
        if (!panel || !overlay) {
            console.error("QuizUI: toggleFilterPanel - ERRO: Elemento do painel de filtros ou overlay não encontrado.");
            return;
        }

        const panelVisibleClass = 'filter-panel--visible';
        const overlayVisibleClass = 'filter-panel-overlay--visible';

        if (show) {
            this.focusedElementBeforePanel = document.activeElement;
            console.log("QuizUI: toggleFilterPanel - Elemento focado antes de abrir o painel:", this.focusedElementBeforePanel);

            if (this.filterPanelInstance) {
                console.log("QuizUI: toggleFilterPanel - Carregando filtros atuais no painel.");
                this.filterPanelInstance.loadCurrentFilters(); // FilterPanel carrega seus próprios dados
            } else {
                console.warn("QuizUI: toggleFilterPanel - Instância de FilterPanel não definida, filtros podem não ser carregados corretamente.");
            }

            this.showElement(overlay);
            this.showElement(panel);

            // Lógica para mostrar placeholder
            if (this.elements.challengeHubContainer?.classList.contains(this.hiddenClassName) &&
                this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                this.showElement(this.elements.placeholderFiltrosContainer);
                console.log("QuizUI: toggleFilterPanel - Placeholder de filtros mostrado.");
            }

            panel.removeAttribute('aria-hidden');
            overlay.removeAttribute('aria-hidden');

            requestAnimationFrame(() => { // Garante que as classes sejam adicionadas após o display block
                overlay.classList.add(overlayVisibleClass);
                panel.classList.add(panelVisibleClass);
                panel.focus(); // Foco no painel para acessibilidade
                console.log("QuizUI: toggleFilterPanel - Painel de filtros MOSTRADO e focado.");
            });
        } else {
            panel.classList.remove(panelVisibleClass);
            overlay.classList.remove(overlayVisibleClass);
            console.log("QuizUI: toggleFilterPanel - Classes de visibilidade removidas do painel e overlay.");

            const onTransitionEnd = (event) => {
                // Garante que a transição seja do painel principal e não de um filho
                if (event.target !== panel) return;

                if (!panel.classList.contains(panelVisibleClass)) { // Confirma que ainda deve estar escondido
                    this.hideElement(panel);
                    this.hideElement(overlay);
                    panel.setAttribute('aria-hidden', 'true');
                    overlay.setAttribute('aria-hidden', 'true');
                    console.log("QuizUI: toggleFilterPanel - Painel e overlay ESCONDIDOS (onTransitionEnd).");
                }
                panel.removeEventListener('transitionend', onTransitionEnd); // Limpa o listener
                this.focusedElementBeforePanel?.focus(); // Devolve o foco
                console.log("QuizUI: toggleFilterPanel - Foco devolvido para:", this.focusedElementBeforePanel);

                // Lógica para esconder placeholder e mostrar hub
                if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                    this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                    this.hideElement(this.elements.placeholderFiltrosContainer);
                    if (this.elements.challengeHubContainer) this.showElement(this.elements.challengeHubContainer);
                    console.log("QuizUI: toggleFilterPanel - Placeholder escondido, hub mostrado (se aplicável).");
                }
            };
            panel.addEventListener('transitionend', onTransitionEnd, { once: true });

            // Fallback caso o evento transitionend não dispare (ex: se não houver transição CSS)
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
                    console.log("QuizUI: toggleFilterPanel - Painel e overlay ESCONDIDOS (fallback timeout).");
                }
                panel.removeEventListener('transitionend', onTransitionEnd); // Garante limpeza se o timeout ocorrer primeiro
            }, TRANSITION_DURATION + 100); // Um pouco mais que a duração da transição
        }
    }

    toggleExplanationModal(show) {
        // console.log(`QuizUI: toggleExplanationModal - Tentando ${show ? 'MOSTRAR' : 'ESCONDER'} modal de explicação.`);
        const overlay = this.elements.explanationModalOverlay;
        const dialog = this.elements.explanationModalDialog;

        if (!overlay || !dialog) {
            console.error("QuizUI: toggleExplanationModal - ERRO: Overlay ou diálogo do modal de explicação não encontrado.");
            return;
        }
        if (show && (!this.quizState || !this.quizData)) {
             console.error("QuizUI: toggleExplanationModal - ERRO: QuizState ou QuizData não definido ao tentar mostrar modal.");
            return;
        }

        const modalVisibleClass = 'modal--visible';

        if (show) {
            const currentQuestion = this.quizState.getCurrentQuestion();
            if (!currentQuestion) {
                console.warn("QuizUI: toggleExplanationModal - Nenhuma pergunta atual para mostrar explicação.");
                return;
            }
            const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
            let hasContent = false;

            // Bloco de explicação geral
            const generalBlock = this.elements.explanationModalGeneralBlock;
            const generalText = this.elements.explanationModalGeneralText;
            if (currentQuestion.explicacao_resposta && currentQuestion.explicacao_resposta.trim()) {
                generalText.innerHTML = currentQuestion.explicacao_resposta.replace(/\n/g, '<br>');
                this.showElement(generalBlock);
                hasContent = true;
            } else {
                this.hideElement(generalBlock);
            }

            // Bloco de feedback das opções
            const optionsBlock = this.elements.explanationModalOptionsBlock;
            const optionsList = this.elements.explanationModalOptionsList;
            optionsList.innerHTML = ''; // Limpa lista anterior
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
                        feedbackValueSpan.classList.add(opt.eh_correta ? 'correct' : 'incorrect'); // Para estilizar o ícone/cor
                        feedbackValueSpan.innerHTML = opt.feedback_opcao.replace(/\n/g, '<br>'); // Permite quebras de linha
                        li.appendChild(feedbackValueSpan);
                        optionsList.appendChild(li);
                    }
                });
            }
            if (hasSpecificOptionFeedback) {
                this.showElement(optionsBlock);
                hasContent = true;
            } else {
                this.hideElement(optionsBlock);
            }

            // Divisor entre blocos
            const divider = this.elements.explanationModalDivider;
            if (generalBlock && !generalBlock.classList.contains(this.hiddenClassName) &&
                optionsBlock && !optionsBlock.classList.contains(this.hiddenClassName) && divider) {
                this.showElement(divider);
            } else if (divider) {
                this.hideElement(divider);
            }

            // Estado vazio
            const emptyState = this.elements.explanationModalEmptyState;
            if (!hasContent && emptyState) {
                this.showElement(emptyState);
            } else if (emptyState) {
                this.hideElement(emptyState);
            }

            this.focusedElementBeforeExplanationModal = document.activeElement;
            this.showElement(overlay);
            overlay.scrollTop; // Força reflow para garantir que a transição de opacidade ocorra
            requestAnimationFrame(() => {
                overlay.classList.add(modalVisibleClass);
                dialog.focus(); // Foco no diálogo para acessibilidade
                // console.log("QuizUI: toggleExplanationModal - Modal de explicação MOSTRADO.");
            });
        } else {
            overlay.classList.remove(modalVisibleClass);
            const onTransitionEnd = (event) => {
                if (event.target !== overlay) return;
                if (!overlay.classList.contains(modalVisibleClass)) {
                    this.hideElement(overlay);
                    // console.log("QuizUI: toggleExplanationModal - Modal de explicação ESCONDIDO (onTransitionEnd).");
                }
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeExplanationModal?.focus();
            };
            overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
            // Fallback
            setTimeout(() => {
                if (!overlay.classList.contains(modalVisibleClass)) {
                    this.hideElement(overlay);
                    // console.log("QuizUI: toggleExplanationModal - Modal de explicação ESCONDIDO (fallback timeout).");
                }
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeExplanationModal?.focus();
            }, TRANSITION_DURATION + 100);
        }
    }

    toggleConfirmModal(show) {
        console.log(`QuizUI: toggleConfirmModal - Tentando ${show ? 'MOSTRAR' : 'ESCONDER'} modal de confirmação.`);
        const overlay = this.elements.confirmEncerrarOverlay;
        if (!overlay) {
            console.error("QuizUI: toggleConfirmModal - ERRO: Overlay do modal de confirmação não encontrado.");
            return;
        }
        const modalVisibleClass = 'modal--visible';
        if (show) {
            this.focusedElementBeforeConfirmModal = document.activeElement;
            this.showElement(overlay);
            overlay.scrollTop;
            requestAnimationFrame(() => {
                overlay.classList.add(modalVisibleClass);
                this.elements.cancelEncerrarBtn?.focus(); // Foco no botão de cancelar por padrão
                 console.log("QuizUI: toggleConfirmModal - Modal de confirmação MOSTRADO.");
            });
        } else {
            overlay.classList.remove(modalVisibleClass);
            const onTransitionEnd = (event) => {
                if (event.target !== overlay) return;
                if (!overlay.classList.contains(modalVisibleClass)) {
                    this.hideElement(overlay);
                    console.log("QuizUI: toggleConfirmModal - Modal de confirmação ESCONDIDO (onTransitionEnd).");
                }
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeConfirmModal?.focus();
            };
            overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
             // Fallback
            setTimeout(() => {
                if (!overlay.classList.contains(modalVisibleClass)) {
                    this.hideElement(overlay);
                    console.log("QuizUI: toggleConfirmModal - Modal de confirmação ESCONDIDO (fallback timeout).");
                }
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeConfirmModal?.focus();
            }, TRANSITION_DURATION + 100);
        }
    }

    showResults(userData, totalQuestionsInSession) {
        console.log("QuizUI: showResults - Exibindo resultados. Dados do usuário:", userData, "Total de questões na sessão:", totalQuestionsInSession, "Tempo (s):", this.timerSeconds);
        const { resultadoCard, resultadoTitulo, resultadoPontos, resultadoAcertos, resultadoErros, resultadoTempo, resultadoMensagemMotivacional, scorePanel, challengeHubContainer, placeholderFiltrosContainer } = this.elements;

        if (!resultadoCard || !userData) {
            console.error("QuizUI: showResults - ERRO: Não é possível mostrar resultados, faltam elementos DOM ou dados do usuário.");
            return;
        }

        this.hideQuizElements(); // Esconde elementos do quiz ativo (perguntas, etc.)
        this.hideElement(scorePanel);
        this.hideElement(challengeHubContainer);
        this.hideElement(placeholderFiltrosContainer);
        console.log("QuizUI: showResults - Elementos de quiz, score panel, hub e placeholder escondidos.");

        if(resultadoTitulo) resultadoTitulo.textContent = "Seu Desempenho Final";
        if(resultadoPontos) resultadoPontos.textContent = userData.pontos !== undefined ? userData.pontos.toString() : '0';
        if(resultadoAcertos) resultadoAcertos.textContent = userData.acertos !== undefined ? userData.acertos.toString() : '0';
        if(resultadoErros) resultadoErros.textContent = userData.erros !== undefined ? userData.erros.toString() : '0';
        if(resultadoTempo) resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds);

        if(resultadoMensagemMotivacional) {
            const pontos = userData.pontos || 0;
            const acertos = userData.acertos || 0;
            let mensagem = "Continue praticando para melhorar!";
            if (totalQuestionsInSession > 0) {
                const maxPontosPossiveis = totalQuestionsInSession * 15; // Assumindo 15 pontos por acerto
                if (pontos >= maxPontosPossiveis * 0.9) mensagem = "Resultado Incrível! Parabéns!";
                else if (pontos >= maxPontosPossiveis * 0.7) mensagem = "Excelente desempenho! Continue assim!";
                else if (pontos >= maxPontosPossiveis * 0.5) mensagem = "Muito bom! Você está no caminho certo.";
                else if (pontos <= 0 && acertos === 0 && (userData.erros || 0) > 0 && totalQuestionsInSession > 0) mensagem = "Ops! Nenhuma questão acertada. Revise o conteúdo e tente novamente!";
            } else if (pontos === 0 && acertos === 0 && (userData.erros || 0) === 0 && totalQuestionsInSession === 0) {
                mensagem = "Nenhuma questão foi jogada nesta sessão. Que tal tentar um novo desafio?";
            }
            resultadoMensagemMotivacional.textContent = mensagem;
             console.log("QuizUI: showResults - Mensagem motivacional definida:", mensagem);
        }

        this.showElement(resultadoCard);
        resultadoTitulo?.focus(); // Foco no título dos resultados para acessibilidade
        console.log("QuizUI: showResults - Card de resultados MOSTRADO e focado.");
    }

    hideResults() {
        console.log("QuizUI: hideResults - Escondendo card de resultados.");
        this.hideElement(this.elements.resultadoCard);
    }

    showWarning(message) {
        console.warn("QuizUI: showWarning - Exibindo aviso:", message);
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        if (avisoContainer && avisoMensagem) {
            avisoMensagem.textContent = message;
            avisoMensagem.setAttribute("role", "alert"); // Para leitores de tela
            this.showElement(avisoContainer);
            // Esconde outras seções principais para dar foco ao aviso
            this.hideElement(placeholderFiltrosContainer);
            this.hideElement(challengeHubContainer);
            this.hideElement(quizSectionContent);
            this.hideElement(resultadoCard);
        } else {
            console.error("QuizUI: showWarning - ERRO: Elemento de aviso ou mensagem de aviso não encontrado.");
        }
    }

    clearWarning() {
        // console.log("QuizUI: clearWarning - Limpando aviso.");
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        this.hideElement(avisoContainer);
        if (avisoMensagem) avisoMensagem.removeAttribute("role");

        // Decide o que mostrar após limpar o aviso
        // Se estivermos na página de questões e nenhum quiz/resultado estiver ativo, mostra o hub
        if (document.getElementById('question-section')) { // Confirma que estamos na página de questões
            if (quizSectionContent?.classList.contains(this.hiddenClassName) &&
                resultadoCard?.classList.contains(this.hiddenClassName) &&
                placeholderFiltrosContainer?.classList.contains(this.hiddenClassName) && // E o placeholder também está escondido
                challengeHubContainer) { // E o hub existe
                this.showElement(challengeHubContainer);
                // console.log("QuizUI: clearWarning - Aviso limpo, mostrando challengeHub.");
            }
        }
    }

    scrollToQuestionStart() {
        const titleElement = this.elements.questionTitle;
        if (this.currentSection === "question-section-page" && titleElement) { // Assumindo que o ID da página de questões é este
            titleElement.scrollIntoView({ behavior: "smooth", block: "center" }); // 'center' pode ser melhor
            console.log("QuizUI: scrollToQuestionStart - Rolado para o início da questão.");
        }
    }

    focusNextButton(preventScroll = false) {
        this.elements.nextBtn?.focus({ preventScroll: preventScroll });
        // console.log("QuizUI: focusNextButton - Foco no botão 'próximo'. Prevent scroll:", preventScroll);
    }

    smoothScrollToNextButton() {
        const navButtonsContainer = this.elements.navigationButtons;
        navButtonsContainer?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        // console.log("QuizUI: smoothScrollToNextButton - Rolado suavemente para os botões de navegação.");
    }

    setupGlobalEventListeners(quizLogicInstance) {
        console.log("QuizUI: setupGlobalEventListeners - Configurando listeners globais da UI.");
        if (!quizLogicInstance) {
            console.error("QuizUI: setupGlobalEventListeners - ERRO: Instância de QuizLogic não fornecida.");
            return;
        }

        this.elements.btnFecharFiltros?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Fechar Filtros' (painel) CLICADO.");
            this.toggleFilterPanel(false);
        });
        this.elements.filterPanelOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.filterPanelOverlay) {
                console.log("QuizUI Event: Overlay do painel de filtros CLICADO.");
                this.toggleFilterPanel(false);
            }
        });
        this.elements.closeFiltersAndShowHubBtn?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Voltar para Modos de Jogo' (placeholder) CLICADO.");
            this.toggleFilterPanel(false);
            if(this.elements.challengeHubContainer) this.showElement(this.elements.challengeHubContainer);
            this.hideElement(this.elements.placeholderFiltrosContainer);
        });

        this.elements.prevBtn?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Anterior' (navegação do quiz) CLICADO.");
            quizLogicInstance.previousQuestion();
        });
        this.elements.nextBtn?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Avançar/Ver Resultado' (navegação do quiz) CLICADO.");
            quizLogicInstance.nextQuestion();
        });

        this.elements.btnRecomecar?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Nova Tentativa' (resultados) CLICADO.");
            quizLogicInstance.restartQuiz();
        });
        this.elements.btnExplorarMais?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Voltar ao Início' (resultados) CLICADO.");
            // Tenta encontrar um link para a home de forma mais genérica
            const homeLink = document.querySelector('a[href="/"], a[href="{% url \'quiz:home\' %}"], .site-header__logo a, .main-nav__link[data-section-target-django="home"], .bottom-nav__link[data-section-target-django="home"]');
            if (homeLink && homeLink.href) {
                window.location.href = homeLink.href;
            } else {
                window.location.href = '/'; // Fallback para a raiz
            }
        });

        this.elements.btnEncerrarSessao?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Encerrar Sessão' (score panel) CLICADO - abrindo modal.");
            this.toggleConfirmModal(true);
        });
        this.elements.confirmEncerrarBtn?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Confirmar Encerramento' (modal) CLICADO.");
            quizLogicInstance.forceEndQuizByUser();
        });
        this.elements.cancelEncerrarBtn?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Cancelar Encerramento' (modal) CLICADO.");
            this.toggleConfirmModal(false);
        });
        this.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmEncerrarOverlay) {
                console.log("QuizUI Event: Overlay do modal de confirmação de encerramento CLICADO.");
                this.toggleConfirmModal(false);
            }
        });

        this.elements.btnToggleExplanation?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Analisar Resposta' CLICADO.");
            this.toggleExplanationModal(true);
        });
        this.elements.btnCloseExplanationModal?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Fechar Análise' (modal de explicação) CLICADO.");
            this.toggleExplanationModal(false);
        });
        this.elements.btnGotItExplanation?.addEventListener('click', () => {
            console.log("QuizUI Event: Botão 'Entendido!' (modal de explicação) CLICADO.");
            this.toggleExplanationModal(false);
        });
        this.elements.explanationModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.explanationModalOverlay) {
                console.log("QuizUI Event: Overlay do modal de explicação CLICADO.");
                this.toggleExplanationModal(false);
            }
        });
        console.log("QuizUI: setupGlobalEventListeners - Listeners globais da UI configurados.");
    }

    renderQuestionGrid(questions, currentIndex, callbackSelectQuestion) {
        // console.log(`QuizUI: renderQuestionGrid - Renderizando grid. Índice atual: ${currentIndex}, Total de questões: ${questions?.length}`);
        const container = this.elements.questionGridContainer;
        if (!container) {
            console.warn("QuizUI: renderQuestionGrid - Container do grid de questões não encontrado.");
            return;
        }
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            this.hideElement(container);
            // console.log("QuizUI: renderQuestionGrid - Sem questões para renderizar no grid, container escondido.");
            return;
        }
        this.showElement(container);
        container.innerHTML = ''; // Limpa grid anterior

        const currentPage = Math.floor(currentIndex / QUESTOES_POR_PAGINA_GRID);
        const startIndex = currentPage * QUESTOES_POR_PAGINA_GRID;
        const endIndex = Math.min(startIndex + QUESTOES_POR_PAGINA_GRID, questions.length);

        // Seta para a página anterior de questões no grid
        container.appendChild(this._createGridArrow(
            'prev',
            startIndex === 0, // Desabilitado se estiver na primeira página
            () => callbackSelectQuestion(Math.max(0, startIndex - 1)), // Vai para a última da página anterior
            'Página Anterior de Questões',
            ['question-grid__arrow--left']
        ));

        for (let i = startIndex; i < endIndex; i++) {
            const questionState = questions[i]; // Objeto contendo dados da pergunta e estado da resposta
            const item = document.createElement('button');
            item.className = 'question-grid__item';
            item.textContent = i + 1; // Número da questão
            item.dataset.index = i.toString();
            item.setAttribute('aria-label', `Ir para Questão ${i + 1}`);
            item.onclick = () => {
                console.log(`QuizUI: Item do grid de questão CLICADO. Índice: ${i}`);
                callbackSelectQuestion(i);
            };

            // Aplica classes de status
            if (questionState.respostaDadaId !== undefined && questionState.respostaDadaId !== null) {
                if (questionState.foiCorretaNaSessao === true) {
                    item.classList.add('question-grid__item--correct');
                } else if (questionState.foiCorretaNaSessao === false) {
                    item.classList.add('question-grid__item--incorrect');
                }
            } else if (questionState.foiPulada === true) {
                item.classList.add('question-grid__item--skipped');
            }

            if (i === currentIndex) {
                item.classList.add('question-grid__item--current');
            }
            container.appendChild(item);
        }

        // Seta para a próxima página de questões no grid
        container.appendChild(this._createGridArrow(
            'next',
            endIndex >= questions.length, // Desabilitado se estiver na última página
            () => callbackSelectQuestion(endIndex), // Vai para a primeira da próxima página
            'Próxima Página de Questões',
            ['question-grid__arrow--right']
        ));
        // console.log("QuizUI: renderQuestionGrid - Grid de questões renderizado.");
    }

    _createGridArrow(direction, isDisabled, callback, ariaLabel, extraClasses = []) {
        const button = document.createElement('button');
        button.className = 'question-grid__arrow';
        if (Array.isArray(extraClasses)) button.classList.add(...extraClasses);
        button.classList.add('u-is-circle'); // Garante forma de círculo
        button.setAttribute('aria-label', ariaLabel);
        button.disabled = isDisabled;
        button.onclick = callback;

        const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgIcon.setAttribute("viewBox", "0 -960 960 960"); // ViewBox padrão do Material Symbols
        svgIcon.setAttribute("fill", "currentColor");
        // svgIcon.style.width = "20px"; // Controlar tamanho pelo CSS da classe .question-grid__arrow svg
        // svgIcon.style.height = "20px";

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", direction === 'prev' ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"); // Paths para chevron_left e chevron_right

        svgIcon.appendChild(path);
        button.appendChild(svgIcon);
        return button;
    }
}