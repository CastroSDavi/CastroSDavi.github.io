// File: assets/js/ui/QuizUI.js
import { QUESTOES_POR_PAGINA_GRID, TRANSITION_DURATION } from '../utils/constants.js'; // Mantenha seus imports

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
        this.filterPanelInstance = null;
        
        this.userIsAuthenticated = false; // <<< NOVA PROPRIEDADE
        
        this._cacheDOMelements();
        this._checkUserAuthentication(); // <<< CHAMADA DO NOVO MÉTODO
    }

    _checkUserAuthentication() { // <<< NOVO MÉTODO
        const bodyEl = document.body;
        // Prioriza o data-attribute se existir, pois é mais explícito
        if (bodyEl && bodyEl.dataset.userAuthenticated === 'true') {
            this.userIsAuthenticated = true;
        } else if (bodyEl && bodyEl.dataset.userAuthenticated === 'false') {
            this.userIsAuthenticated = false;
        }
        else {
            // Fallback: verificar se existe algum elemento que só aparece para usuários logados
            // Este seletor deve ser robusto e específico para um elemento que SÓ existe se logado.
            const accountLinkInHeader = document.querySelector('.site-header__actions a[href*="/account/"]');
             if (accountLinkInHeader) { // Se o link para "Minha Conta" no header estiver presente
                 this.userIsAuthenticated = true;
             } else {
                this.userIsAuthenticated = false;
             }
        }
        console.log("QuizUI: User authenticated status:", this.userIsAuthenticated);
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
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'),
            hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),
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
            confirmEncerrarModal: document.getElementById('confirm-encerrar-modal'), // Para focar
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

            // <<< NOVOS ELEMENTOS PARA FAVORITOS >>>
            btnToggleFavorite: document.getElementById('btn-toggle-favorite'),
            favoriteQuestionsContainer: document.getElementById('favorite-questions-container'),
            favoriteQuestionsEmptyState: document.getElementById('favorite-questions-empty-state'),
        };
        console.log("QuizUI _cacheDOMelements: Elementos cacheados, incluindo para favoritos:", this.elements);
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
        console.log(`QuizUI: displayQuizContent - Tentando ${show ? 'MOSTRAR' : 'ESCONDER'} conteúdo do quiz.`);
        const { quizSectionContent, btnEncerrarSessao, progressContainer, progressText, questionGridContainer, scorePanel, challengeHubContainer, placeholderFiltrosContainer, resultadoCard, btnToggleFavorite } = this.elements;
        if (show) {
            this.showElement(scorePanel);
            this.hideElement(challengeHubContainer);
            this.showElement(quizSectionContent);
            this.showElement(btnEncerrarSessao);
            this.showElement(progressContainer);
            this.showElement(progressText);
            this.showElement(questionGridContainer);
            // O botão de favorito (btnToggleFavorite) é controlado dentro de displayQuestion
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
            this.hideElement(this.elements.btnToggleExplanation);
            if (btnToggleFavorite) this.hideElement(btnToggleFavorite); // Esconder botão de favorito também
            this.toggleExplanationModal(false);
            
            if (resultadoCard && !resultadoCard.classList.contains(this.hiddenClassName)) {
                 console.log("QuizUI: displayQuizContent - Resultados estão visíveis, hub permanecerá escondido.");
                this.hideElement(challengeHubContainer);
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
        const { quizSectionContent, resultadoCard, questionGridContainer, btnEncerrarSessao, scorePanel, btnToggleFavorite } = this.elements;
        this.hideElement(quizSectionContent);
        this.hideElement(resultadoCard);
        this.hideElement(questionGridContainer);
        this.hideElement(btnEncerrarSessao);
        this.hideElement(scorePanel);
        if (btnToggleFavorite) this.hideElement(btnToggleFavorite); // <<< ADICIONADO
        this.hideProgressBar();
        this.toggleExplanationModal(false);
        this.hideElement(this.elements.btnToggleExplanation);
    }

    displayQuestion(perguntaObj, qNum, totalQ, todasCategorias, relacaoPerguntaCategorias, isQuickQuizMode) {
        console.log(`QuizUI: displayQuestion - Exibindo pergunta #${qNum}/${totalQ}. Autenticado: ${this.userIsAuthenticated}. Dados da pergunta:`, perguntaObj);
        if (!perguntaObj || !this.quizData || !this.quizState) {
            console.error("QuizUI: displayQuestion - ERRO: Não é possível exibir a pergunta, faltam dados ou estado.");
            return;
        }
        
        let tituloCat = "Questão";
        if (isQuickQuizMode) {
            tituloCat = "Quiz Rápido";
        } else {
            const idsCatPerg = perguntaObj.categoria_ids || [];
            if (idsCatPerg.length > 0 && Array.isArray(todasCategorias)) {
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
                while (idAtual != null && Array.isArray(todasCategorias) && i < 5) { 
                    const catEnc = todasCategorias.find(cat => cat.id_categoria === idAtual);
                    if (catEnc) {
                        caminho.unshift(catEnc.nome_categoria);
                        idAtual = catEnc.id_categoria_pai;
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
        this.elements.questionTitle?.focus({ preventScroll: true });

        // Lógica do botão de Favoritar <<< MODIFICADO/MOVIDO AQUI
        if (this.elements.btnToggleFavorite) {
            if (this.userIsAuthenticated && perguntaObj && perguntaObj.id_pergunta !== undefined) {
                this.showElement(this.elements.btnToggleFavorite);
                // O campo 'is_favorited' deve vir do backend (via get_quiz_data_dict)
                this.updateFavoriteButton(perguntaObj.is_favorited || false); 
                this.elements.btnToggleFavorite.dataset.perguntaId = perguntaObj.id_pergunta.toString();
            } else {
                this.hideElement(this.elements.btnToggleFavorite);
            }
        }

        this.hideElement(this.elements.btnToggleExplanation);
        this.toggleExplanationModal(false);
        console.log("QuizUI: displayQuestion - Pergunta renderizada na UI.");
    }
    
    _getCategoriaProfundidade(cat, allCats) {
        if (!cat || !allCats || !Array.isArray(allCats)) return -1;
        let depth = 0;
        let parentId = cat.id_categoria_pai;
        let iterations = 0;
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
            if (url && typeof url === 'string' && url.trim()) {
                imgElement.src = url;
                imgElement.alt = `Ilustração para questão ${qNum}`;
                this.showElement(imgElement);
                imgElement.onerror = () => {
                    this.hideElement(imgElement);
                    imgElement.onerror = null; 
                };
            } else {
                this.hideElement(imgElement);
                imgElement.src = "";
                imgElement.alt = "";
            }
        }
    }

    generateAnswerButtons(perguntaId, opcoes, respostaDadaId, callbackResposta) {
        // console.log(`QuizUI: generateAnswerButtons - Gerando botões para pergunta ID ${perguntaId}. Já respondida (ID): ${respostaDadaId}`);
        const container = this.elements.respostasContainer;
        if (!container) {
            console.error("QuizUI: generateAnswerButtons - ERRO: Container de respostas não encontrado.");
            return;
        }
        container.innerHTML = '';
        if (!opcoes || !Array.isArray(opcoes) || opcoes.length === 0) {
            // console.warn("QuizUI: generateAnswerButtons - Nenhuma opção fornecida para a pergunta ID", perguntaId);
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
                if (opt.eh_correta) {
                    button.classList.add(`${baseClass}--correct`);
                } else if (opt.id_opcao_resposta === respostaDadaId) {
                    button.classList.add(`${baseClass}--incorrect`);
                }
            } else if (callbackResposta && typeof callbackResposta === 'function') {
                button.onclick = () => {
                    // console.log(`QuizUI: Botão de resposta CLICADO. Pergunta ID: ${perguntaId}, Opção ID: ${opt.id_opcao_resposta}`);
                    callbackResposta(opt.id_opcao_resposta);
                };
            }
            container.appendChild(button);
        });
    }

    disableAnswers() {
        // console.log("QuizUI: disableAnswers - Desabilitando botões de resposta.");
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
        // console.log(`QuizUI: applyAnswerFeedback - Aplicando feedback para opção ID selecionada: ${selectedOpId}`);
        const baseCl = "question-display__answer-option";
        const corrCl = `${baseCl}--correct`;
        const incorrCl = `${baseCl}--incorrect`;
        let userCorrect = false;

        if (!Array.isArray(opcoes)) {
            console.error("QuizUI: applyAnswerFeedback - ERRO: 'opcoes' não é um array.");
            return;
        }

        this.elements.respostasContainer?.querySelectorAll(`button.${baseCl}`).forEach(btn => {
            const btnOpId = parseInt(btn.dataset.opcaoId, 10);
            const optionData = opcoes.find(op => op.id_opcao_resposta === btnOpId);
            if (!optionData) {
                // console.warn("QuizUI: applyAnswerFeedback - Não encontrou dados para a opção do botão ID:", btnOpId);
                return;
            }

            if (btnOpId === selectedOpId) {
                if (optionData.eh_correta) {
                    btn.classList.add(corrCl);
                    userCorrect = true;
                } else {
                    btn.classList.add(incorrCl);
                }
            } else if (optionData.eh_correta) {
                btn.classList.add(corrCl);
            }
        });

        if (this.elements.feedbackAcessivel) {
            this.elements.feedbackAcessivel.textContent = userCorrect ? "Você acertou!" : "Resposta incorreta.";
        }

        const currentQ = this.quizState?.getCurrentQuestion();
        const hasGeneralExplanation = currentQ && currentQ.explicacao_resposta && currentQ.explicacao_resposta.trim() !== '';
        const hasOptionSpecificFeedback = opcoes.some(op => op.feedback_opcao && op.feedback_opcao.trim() !== '');

        if ((hasGeneralExplanation || hasOptionSpecificFeedback) && this.elements.btnToggleExplanation) {
            // console.log("QuizUI: applyAnswerFeedback - Mostrando botão 'Analisar Resposta'.");
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
                progressText.textContent = `${Math.min(current,total)} / ${total}`;
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
        // console.log(`QuizUI: updateNavigationButtons - É a primeira: ${isFirst}, É a última: ${isLast}, Total de questões: ${totalQuestions}`);
        const { navigationButtons, prevBtn, nextBtn } = this.elements;
        if (navigationButtons && prevBtn && nextBtn) {
            if (totalQuestions <= 0) {
                this.hideElement(navigationButtons);
            } else {
                this.showElement(navigationButtons);
                prevBtn.disabled = isFirst;
                nextBtn.disabled = false;
                const nextButtonLabel = nextBtn.querySelector('.button__label') || nextBtn;
                let iconSpan = nextBtn.querySelector('.material-symbols-outlined.button__icon--right');
                if (isLast) {
                    nextButtonLabel.textContent = "Ver Resultado";
                    if (iconSpan) iconSpan.remove();
                } else {
                    nextButtonLabel.textContent = "Avançar";
                    if (!iconSpan) {
                        iconSpan = document.createElement('span');
                        iconSpan.className = 'material-symbols-outlined button__icon button__icon--right';
                        if (nextBtn === nextButtonLabel) nextBtn.appendChild(iconSpan); // Se o texto está diretamente no botão
                        else nextButtonLabel.parentNode.insertBefore(iconSpan, nextButtonLabel.nextSibling); // Se houver um .button__label
                    }
                    iconSpan.textContent = 'arrow_forward';
                }
            }
        }
    }

    // <<< NOVO MÉTODO >>>
    updateFavoriteButton(isFavorited) {
        const btn = this.elements.btnToggleFavorite;
        if (!btn) return;

        const icon = btn.querySelector('.material-symbols-outlined');
        if (isFavorited) {
            btn.classList.add('is-favorited');
            if (icon) icon.textContent = 'star'; // Ícone preenchido (Material Symbols)
            btn.setAttribute('aria-label', 'Remover dos Favoritos');
            btn.title = 'Remover dos Favoritos';
        } else {
            btn.classList.remove('is-favorited');
            if (icon) icon.textContent = 'star_outline'; // Ícone contorno (Material Symbols)
            btn.setAttribute('aria-label', 'Adicionar aos Favoritos');
            btn.title = 'Adicionar aos Favoritos';
        }
    }

    // <<< NOVO MÉTODO >>>
    renderFavoriteQuestions(favoriteQuestionsData, allCategoriesForMapping) {
        const container = this.elements.favoriteQuestionsContainer;
        const emptyState = this.elements.favoriteQuestionsEmptyState;
        const placeholder = container?.querySelector('.placeholder-text');

        if (!container) {
            console.error("QuizUI: Container de questões favoritas não encontrado.");
            return;
        }
        if (placeholder) this.hideElement(placeholder); // Esconde o "Carregando..."
        container.innerHTML = ''; // Limpa conteúdo anterior

        if (!favoriteQuestionsData || favoriteQuestionsData.length === 0) {
            if (emptyState) this.showElement(emptyState);
            return;
        }

        if (emptyState) this.hideElement(emptyState);
        
        // Criar um mapa de categorias para fácil busca de nomes
        const categoryMap = new Map();
        if (allCategoriesForMapping) {
            allCategoriesForMapping.forEach(cat => categoryMap.set(cat.id_categoria, cat.nome_categoria));
        }

        favoriteQuestionsData.forEach(fav => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'favorite-question-item'; // Classe para estilização CSS
            
            const questionLink = document.createElement('a');
            questionLink.href = `#q${fav.id_pergunta}`; // Link para âncora ou futura funcionalidade
            questionLink.className = 'favorite-question-link';
            questionLink.textContent = `P${fav.id_pergunta}: ${fav.texto_pergunta.substring(0, 120)}${fav.texto_pergunta.length > 120 ? '...' : ''}`;
            questionLink.title = `Revisar questão P${fav.id_pergunta}`;
            // Adicionar um data attribute para o ID da pergunta pode ser útil
            questionLink.dataset.perguntaId = fav.id_pergunta;
            // O listener de clique para o link pode ser adicionado aqui ou delegado em App.js/QuizLogic.js
            // Exemplo:
            // questionLink.addEventListener('click', (e) => {
            // e.preventDefault();
            // window.location.hash = `q${fav.id_pergunta}`; // Simplesmente muda o hash
            // quizLogicInstance.reviewQuestion(fav.id_pergunta); // Chama método para carregar a questão
            // });


            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'favorite-question-details';

            let categoriasText = "Não especificadas";
            if (fav.categoria_ids && fav.categoria_ids.length > 0) {
                categoriasText = fav.categoria_ids.map(id => categoryMap.get(id) || `ID ${id}`).join(', ');
            }
            const catSmall = document.createElement('small');
            catSmall.className = 'favorite-question-categories';
            catSmall.textContent = `Categorias: ${categoriasText}`;
            
            const dataFavoritada = new Date(fav.data_favoritada).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            const dataSmall = document.createElement('small');
            dataSmall.className = 'favorite-question-date';
            dataSmall.textContent = `Favoritada em: ${dataFavoritada}`;

            detailsDiv.appendChild(catSmall);
            detailsDiv.appendChild(dataSmall);

            itemDiv.appendChild(questionLink);
            itemDiv.appendChild(detailsDiv);
            container.appendChild(itemDiv);
        });
        
        // Remove a borda inferior do último item para um visual mais limpo
        const lastItem = container.querySelector('.favorite-question-item:last-child');
        if(lastItem) lastItem.style.borderBottom = 'none';
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

        // <<< NOVO LISTENER PARA O BOTÃO DE FAVORITAR >>>
        this.elements.btnToggleFavorite?.addEventListener('click', () => {
            const perguntaId = this.elements.btnToggleFavorite.dataset.perguntaId;
            if (perguntaId && quizLogicInstance && this.userIsAuthenticated) { // Adicionada verificação de autenticação
                console.log(`QuizUI Event: Botão 'Favoritar' CLICADO para pergunta ID: ${perguntaId}.`);
                quizLogicInstance.toggleFavoriteCurrentQuestion();
            } else if (!this.userIsAuthenticated) {
                 // Você pode usar o sistema de mensagens/avisos da UI aqui
                 // this.showWarning("Você precisa estar logado para favoritar questões.");
                 alert("Você precisa estar logado para favoritar questões.");
            } else {
                console.warn("QuizUI Event: Não foi possível favoritar - ID da pergunta ou quizLogic ausente.");
            }
        });
        
        console.log("QuizUI: setupGlobalEventListeners - Listeners globais da UI configurados.");
    }

    // ... (demais métodos da QuizUI como toggleFilterPanel, toggleExplanationModal, etc.)
    toggleFilterPanel(show) {
        const panel = this.elements.filterPanel;
        const overlay = this.elements.filterPanelOverlay;
        if (!panel || !overlay) return;
        const panelVisibleClass = 'filter-panel--visible';
        const overlayVisibleClass = 'filter-panel-overlay--visible';
        if (show) {
            this.focusedElementBeforePanel = document.activeElement;
            if (this.filterPanelInstance) this.filterPanelInstance.loadCurrentFilters();
            this.showElement(overlay); this.showElement(panel);
            if (this.elements.challengeHubContainer?.classList.contains(this.hiddenClassName) &&
                this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                this.showElement(this.elements.placeholderFiltrosContainer);
            }
            panel.removeAttribute('aria-hidden'); overlay.removeAttribute('aria-hidden');
            requestAnimationFrame(() => {
                overlay.classList.add(overlayVisibleClass); panel.classList.add(panelVisibleClass); panel.focus();
            });
        } else {
            panel.classList.remove(panelVisibleClass); overlay.classList.remove(overlayVisibleClass);
            const onTransitionEnd = (event) => {
                if (event.target !== panel) return;
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
            }, TRANSITION_DURATION + 100);
        }
    }

    toggleExplanationModal(show) {
        const overlay = this.elements.explanationModalOverlay;
        const dialog = this.elements.explanationModalDialog;
        if (!overlay || !dialog) return;
        if (show && (!this.quizState || !this.quizData)) return;
        const modalVisibleClass = 'modal--visible';
        if (show) {
            const currentQuestion = this.quizState.getCurrentQuestion();
            if (!currentQuestion) return;
            const options = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
            let hasContent = false;
            const generalBlock = this.elements.explanationModalGeneralBlock;
            const generalText = this.elements.explanationModalGeneralText;
            if (currentQuestion.explicacao_resposta && currentQuestion.explicacao_resposta.trim()) {
                generalText.innerHTML = currentQuestion.explicacao_resposta.replace(/\n/g, '<br>');
                this.showElement(generalBlock); hasContent = true;
            } else this.hideElement(generalBlock);
            const optionsBlock = this.elements.explanationModalOptionsBlock;
            const optionsList = this.elements.explanationModalOptionsList;
            optionsList.innerHTML = '';
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
                        li.appendChild(feedbackValueSpan); optionsList.appendChild(li);
                    }
                });
            }
            if (hasSpecificOptionFeedback) { this.showElement(optionsBlock); hasContent = true; }
            else this.hideElement(optionsBlock);
            const divider = this.elements.explanationModalDivider;
            if (generalBlock && !generalBlock.classList.contains(this.hiddenClassName) && optionsBlock && !optionsBlock.classList.contains(this.hiddenClassName) && divider) this.showElement(divider);
            else if (divider) this.hideElement(divider);
            const emptyState = this.elements.explanationModalEmptyState;
            if (!hasContent && emptyState) this.showElement(emptyState);
            else if (emptyState) this.hideElement(emptyState);
            this.focusedElementBeforeExplanationModal = document.activeElement;
            this.showElement(overlay); overlay.scrollTop; // Força reflow
            requestAnimationFrame(() => { overlay.classList.add(modalVisibleClass); dialog.focus(); });
        } else {
            overlay.classList.remove(modalVisibleClass);
            const onTransitionEnd = (event) => {
                if (event.target !== overlay) return;
                if (!overlay.classList.contains(modalVisibleClass)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeExplanationModal?.focus();
            };
            overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
            setTimeout(() => { // Fallback
                if (!overlay.classList.contains(modalVisibleClass)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeExplanationModal?.focus();
            }, TRANSITION_DURATION + 100);
        }
    }

    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay;
        if (!overlay) return;
        const modalVisibleClass = 'modal--visible';
        if (show) {
            this.focusedElementBeforeConfirmModal = document.activeElement;
            this.showElement(overlay); overlay.scrollTop; // Força reflow
            requestAnimationFrame(() => {
                overlay.classList.add(modalVisibleClass);
                this.elements.cancelEncerrarBtn?.focus(); // Foco no botão de cancelar por padrão
            });
        } else {
            overlay.classList.remove(modalVisibleClass);
            const onTransitionEnd = (event) => {
                if (event.target !== overlay) return;
                if (!overlay.classList.contains(modalVisibleClass)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeConfirmModal?.focus();
            };
            overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
            setTimeout(() => { // Fallback
                if (!overlay.classList.contains(modalVisibleClass)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeConfirmModal?.focus();
            }, TRANSITION_DURATION + 100);
        }
    }

    showResults(userData, totalQuestionsInSession) {
        const { resultadoCard, resultadoTitulo, resultadoPontos, resultadoAcertos, resultadoErros, resultadoTempo, resultadoMensagemMotivacional, scorePanel, challengeHubContainer, placeholderFiltrosContainer } = this.elements;
        if (!resultadoCard || !userData) return;
        this.hideQuizElements(); this.hideElement(scorePanel); this.hideElement(challengeHubContainer); this.hideElement(placeholderFiltrosContainer);
        if(resultadoTitulo) resultadoTitulo.textContent = "Seu Desempenho Final";
        if(resultadoPontos) resultadoPontos.textContent = userData.pontos !== undefined ? userData.pontos.toString() : '0';
        if(resultadoAcertos) resultadoAcertos.textContent = userData.acertos !== undefined ? userData.acertos.toString() : '0';
        if(resultadoErros) resultadoErros.textContent = userData.erros !== undefined ? userData.erros.toString() : '0';
        if(resultadoTempo) resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds);
        if(resultadoMensagemMotivacional) {
            const pontos = userData.pontos || 0; const acertos = userData.acertos || 0; let mensagem = "Continue praticando para melhorar!";
            if (totalQuestionsInSession > 0) {
                const maxPontosPossiveis = totalQuestionsInSession * 15;
                if (pontos >= maxPontosPossiveis * 0.9) mensagem = "Resultado Incrível! Parabéns!";
                else if (pontos >= maxPontosPossiveis * 0.7) mensagem = "Excelente desempenho! Continue assim!";
                else if (pontos >= maxPontosPossiveis * 0.5) mensagem = "Muito bom! Você está no caminho certo.";
                else if (pontos <= 0 && acertos === 0 && (userData.erros || 0) > 0 && totalQuestionsInSession > 0) mensagem = "Ops! Nenhuma questão acertada. Revise o conteúdo e tente novamente!";
            } else if (pontos === 0 && acertos === 0 && (userData.erros || 0) === 0 && totalQuestionsInSession === 0) {
                mensagem = "Nenhuma questão foi jogada nesta sessão. Que tal tentar um novo desafio?";
            }
            resultadoMensagemMotivacional.textContent = mensagem;
        }
        this.showElement(resultadoCard); resultadoTitulo?.focus();
    }

    hideResults() { this.hideElement(this.elements.resultadoCard); }

    showWarning(message) {
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        if (avisoContainer && avisoMensagem) {
            avisoMensagem.textContent = message; avisoMensagem.setAttribute("role", "alert");
            this.showElement(avisoContainer);
            this.hideElement(placeholderFiltrosContainer); this.hideElement(challengeHubContainer); this.hideElement(quizSectionContent); this.hideElement(resultadoCard);
        }
    }

    clearWarning() {
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        this.hideElement(avisoContainer);
        if (avisoMensagem) avisoMensagem.removeAttribute("role");
        if (document.getElementById('question-section')) {
            if (quizSectionContent?.classList.contains(this.hiddenClassName) &&
                resultadoCard?.classList.contains(this.hiddenClassName) &&
                placeholderFiltrosContainer?.classList.contains(this.hiddenClassName) &&
                challengeHubContainer) {
                this.showElement(challengeHubContainer);
            }
        }
    }

    scrollToQuestionStart() {
        const titleElement = this.elements.questionTitle;
        // Verifica se a seção de questões está visível antes de tentar rolar
        if (this.elements.questionSection && !this.elements.questionSection.classList.contains(this.hiddenClassName) && titleElement) {
            titleElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    focusNextButton(preventScroll = false) { this.elements.nextBtn?.focus({ preventScroll: preventScroll }); }
    smoothScrollToNextButton() { this.elements.navigationButtons?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }

    renderQuestionGrid(questions, currentIndex, callbackSelectQuestion) {
        const container = this.elements.questionGridContainer;
        if (!container) return;
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            this.hideElement(container); return;
        }
        this.showElement(container); container.innerHTML = '';
        const currentPage = Math.floor(currentIndex / QUESTOES_POR_PAGINA_GRID);
        const startIndex = currentPage * QUESTOES_POR_PAGINA_GRID;
        const endIndex = Math.min(startIndex + QUESTOES_POR_PAGINA_GRID, questions.length);
        container.appendChild(this._createGridArrow('prev',startIndex === 0,() => callbackSelectQuestion(Math.max(0, startIndex - 1)),'Página Anterior de Questões',['question-grid__arrow--left']));
        for (let i = startIndex; i < endIndex; i++) {
            const questionState = questions[i];
            const item = document.createElement('button');
            item.className = 'question-grid__item'; item.textContent = i + 1;
            item.dataset.index = i.toString(); item.setAttribute('aria-label', `Ir para Questão ${i + 1}`);
            item.onclick = () => callbackSelectQuestion(i);
            if (questionState.respostaDadaId !== undefined && questionState.respostaDadaId !== null) {
                if (questionState.foiCorretaNaSessao === true) item.classList.add('question-grid__item--correct');
                else if (questionState.foiCorretaNaSessao === false) item.classList.add('question-grid__item--incorrect');
            } else if (questionState.foiPulada === true) item.classList.add('question-grid__item--skipped');
            if (i === currentIndex) item.classList.add('question-grid__item--current');
            container.appendChild(item);
        }
        container.appendChild(this._createGridArrow('next',endIndex >= questions.length,() => callbackSelectQuestion(endIndex),'Próxima Página de Questões',['question-grid__arrow--right']));
    }

    _createGridArrow(direction, isDisabled, callback, ariaLabel, extraClasses = []) {
        const button = document.createElement('button');
        button.className = 'question-grid__arrow';
        if (Array.isArray(extraClasses)) button.classList.add(...extraClasses);
        button.classList.add('u-is-circle');
        button.setAttribute('aria-label', ariaLabel); button.disabled = isDisabled; button.onclick = callback;
        const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgIcon.setAttribute("viewBox", "0 -960 960 960"); svgIcon.setAttribute("fill", "currentColor");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", direction === 'prev' ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z");
        svgIcon.appendChild(path); button.appendChild(svgIcon); return button;
    }
}