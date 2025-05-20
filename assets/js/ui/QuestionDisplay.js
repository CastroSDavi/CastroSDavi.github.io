// File: assets/js/ui/QuestionDisplay.js

import { QUESTOES_POR_PAGINA_GRID, TRANSITION_DURATION } from '../utils/constants.js';

export default class QuestionDisplay {
    constructor(quizUIInstance, quizStateInstance, quizDataInstance, callbacks = {}) {
        // console.log("QUESTIONDISPLAY.JS: Constructor - Instanciando QuestionDisplay.");
        this.quizUI = quizUIInstance; // Para acesso a elementos e utils de UI
        this.quizState = quizStateInstance;
        this.quizData = quizDataInstance;
        this.elements = this.quizUI.elements; // Atalho para os elementos DOM cacheados em QuizUI

        // Callbacks para interações
        this.answerCallback = callbacks.answerCallback; // (selectedOptionId) => {}
        this.navigationCallback = callbacks.navigationCallback; // (targetIndex | 'next' | 'prev') => {}
        this.toggleFavoriteCallback = callbacks.toggleFavoriteCallback; // () => {}

        this._setupNavigationListeners();
    }

    _setupNavigationListeners() {
        this.elements.prevBtn?.addEventListener('click', () => {
            if (this.navigationCallback) this.navigationCallback('prev');
        });
        this.elements.nextBtn?.addEventListener('click', () => {
            if (this.navigationCallback) this.navigationCallback('next');
        });
        this.elements.btnToggleFavorite?.addEventListener('click', () => {
            if (this.toggleFavoriteCallback) this.toggleFavoriteCallback();
        });
    }

    _getCategoriaProfundidade(cat, allCats) {
        if (!cat || !allCats || !Array.isArray(allCats)) return -1;
        let depth = 0;
        let parentId = cat.id_categoria_pai;
        let iterations = 0;
        while (parentId != null && iterations < 10) { // Limitador de iterações
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
                this.quizUI.showElement(imgElement);
                imgElement.onerror = () => { this.quizUI.hideElement(imgElement); imgElement.onerror = null; };
            } else {
                this.quizUI.hideElement(imgElement);
                imgElement.src = "";
                imgElement.alt = "";
            }
        }
    }

    _formatCategoriaDisplay(question, todasCategorias, isQuickQuizMode) {
        let tituloCatDisplay = "Questão"; // Fallback inicial
        let fullCategoryTooltip = "Categorias não especificadas";
        const MAX_DISPLAY_LENGTH = 45; // Máximo de caracteres para o título antes de truncar com (+N) ou "..."

        if (isQuickQuizMode) {
            tituloCatDisplay = "Quiz Rápido";
            fullCategoryTooltip = "Modo Quiz Rápido";
        } else {
            const idsCatPerg = question.categoria_ids || [];
            const totalCategoriasPergunta = idsCatPerg.length;

            if (totalCategoriasPergunta > 0 && Array.isArray(todasCategorias) && todasCategorias.length > 0) {
                // Mapear todos os nomes de categoria para o tooltip
                const nomesCategoriasQuestao = idsCatPerg
                    .map(id => todasCategorias.find(cat => cat.id_categoria === id)?.nome_categoria)
                    .filter(name => name);
                
                if (nomesCategoriasQuestao.length > 0) {
                    fullCategoryTooltip = `Categorias: ${nomesCategoriasQuestao.join(', ')}`;
                }

                // Lógica para exibir a categoria mais específica ou um resumo
                let idCatMaisEspecifica = idsCatPerg[0];
                if (totalCategoriasPergunta > 1) {
                    const catObjsPerg = todasCategorias.filter(c => idsCatPerg.includes(c.id_categoria));
                    if (catObjsPerg.length > 0) {
                        idCatMaisEspecifica = catObjsPerg.reduce((deepest, curr) =>
                            this._getCategoriaProfundidade(curr, todasCategorias) > this._getCategoriaProfundidade(deepest, todasCategorias) ? curr : deepest,
                            catObjsPerg[0]
                        ).id_categoria;
                    }
                }

                // Montar o breadcrumb para a categoria mais específica
                let caminhoBreadcrumb = [];
                let idAtual = idCatMaisEspecifica;
                let iteracoes = 0;
                while (idAtual != null && iteracoes < 5) { // Limite de profundidade do breadcrumb
                    const catEncontrada = todasCategorias.find(cat => cat.id_categoria === idAtual);
                    if (catEncontrada) {
                        caminhoBreadcrumb.unshift(catEncontrada.nome_categoria);
                        idAtual = catEncontrada.id_categoria_pai;
                    } else {
                        break;
                    }
                    iteracoes++;
                }

                let breadcrumbDisplay = caminhoBreadcrumb.length > 0 ? caminhoBreadcrumb.join(' › ') : "Tópicos Diversos";

                if (breadcrumbDisplay.length > MAX_DISPLAY_LENGTH) {
                    // Se o breadcrumb da mais específica for muito longo, truncá-lo
                    tituloCatDisplay = `${breadcrumbDisplay.substring(0, MAX_DISPLAY_LENGTH - 3)}...`;
                    if (totalCategoriasPergunta > caminhoBreadcrumb.length) {
                        // Se há mais categorias do que as mostradas no breadcrumb truncado
                        // (isso pode acontecer se a mais específica for muito aninhada e houver outras de nível superior)
                        const outrasCategoriasCount = totalCategoriasPergunta - caminhoBreadcrumb.length; // Ou um cálculo mais preciso se necessário
                        if (outrasCategoriasCount > 0) {
                           tituloCatDisplay += ` (+${outrasCategoriasCount} outras)`;
                        }
                    }
                } else if (totalCategoriasPergunta > 1) {
                    // Se o breadcrumb couber mas houver outras categorias além das que formam o breadcrumb da mais específica
                    // (e.g., a pergunta está em "Cardio > Arritmia" e também em "Emergência")
                    // Contamos quantas categorias não estão no caminho do breadcrumb da mais específica
                    const idsNoBreadcrumb = new Set();
                    let tempId = idCatMaisEspecifica;
                    let tempIter = 0;
                     while (tempId != null && tempIter < 5) {
                        const catEnc = todasCategorias.find(cat => cat.id_categoria === tempId);
                        if (catEnc) { idsNoBreadcrumb.add(catEnc.id_categoria); tempId = catEnc.id_categoria_pai; }
                        else { break; }
                        tempIter++;
                    }
                    // A lógica acima está um pouco simplificada, pois o breadcrumb é o caminho para UMA categoria.
                    // Se a pergunta tem múltiplas categorias principais (não hierárquicas entre si),
                    // o "+N" deve refletir isso.
                    // Uma forma mais simples: se o breadcrumb da mais específica couber,
                    // e houver mais de uma categoria na pergunta, mostre a contagem.
                    const outrasNaoNoBreadcrumb = idsCatPerg.filter(id => !idsNoBreadcrumb.has(id)).length;
                    
                    if (totalCategoriasPergunta > caminhoBreadcrumb.length || outrasNaoNoBreadcrumb > 0) {
                         // Ajuste para mostrar o número total de categorias se for mais de uma
                         // e o breadcrumb da mais específica for o principal.
                         // Ex: "Cardio › Arritmias (+1)" se ela também estiver em "Terapia Intensiva"
                         // Poderíamos simplificar para:
                         tituloCatDisplay = `${breadcrumbDisplay} (+${totalCategoriasPergunta - 1} outras)`;
                    } else {
                        tituloCatDisplay = breadcrumbDisplay;
                    }


                } else {
                    tituloCatDisplay = breadcrumbDisplay;
                }

            } else { // Nenhuma categoria associada ou `todasCategorias` não disponível
                tituloCatDisplay = "Tópicos Diversos";
                fullCategoryTooltip = "Categorias não especificadas";
            }
        }

        return { display: tituloCatDisplay, tooltip: fullCategoryTooltip, allCategoryIds: question.categoria_ids || [] };
    }


    displayCurrentQuestion() {
        const question = this.quizState.getCurrentQuestion();
        if (!question) {
            return;
        }

        const qNum = this.quizState.getCurrentQuestionNumberForDisplay();
        const totalQ = this.quizState.getTotalFilteredQuestions();
        const todasCategorias = this.quizData.getCategorias();
        const isQuickQuizMode = this.quizState.isQuickQuizMode;
        const options = this.quizData.getOpcoesPorPerguntaId(question.id_pergunta);

        const categoriaInfo = this._formatCategoriaDisplay(question, todasCategorias, isQuickQuizMode);

        if (this.elements.categoriaTitulo) {
            this.elements.categoriaTitulo.innerText = categoriaInfo.display;
            this.elements.categoriaTitulo.setAttribute('title', categoriaInfo.tooltip);
            // Opcional: armazenar os IDs para interações futuras (e.g., clique para ver todas)
            this.elements.categoriaTitulo.dataset.categoriaIds = categoriaInfo.allCategoryIds.join(',');
        }

        if (this.elements.idQuestao) this.elements.idQuestao.innerText = qNum;
        if (this.elements.perguntaTexto) this.elements.perguntaTexto.textContent = question.texto_pergunta;
        if (this.elements.referenciaQuestao) this.elements.referenciaQuestao.textContent = `Fonte: ${question.referencia_bibliografica || "Não informada"}`;

        this._displayQuestionImage(question.url_imagem, qNum);
        this.updateProgressBar(qNum, totalQ);
        this.elements.questionTitle?.focus({ preventScroll: true });

        if (this.elements.btnToggleFavorite) {
            if (this.quizUI.userIsAuthenticated && question.id_pergunta !== undefined) {
                this.quizUI.showElement(this.elements.btnToggleFavorite);
                if (this.quizUI.favoriteManager) {
                    this.quizUI.favoriteManager.updateFavoriteButtonState(question.is_favorited || false);
                }
                this.elements.btnToggleFavorite.dataset.perguntaId = question.id_pergunta.toString();
            } else {
                this.quizUI.hideElement(this.elements.btnToggleFavorite);
            }
        }
        
        this.generateAnswerButtons(question.id_pergunta, options, question.respostaDadaId);

        if (question.respostaDadaId !== undefined) {
            this.disableAnswers();
            if (question.respostaDadaId !== null) { 
                this.applyAnswerFeedback(question.respostaDadaId, options);
            }
        }
        
        this.quizUI.hideElement(this.elements.btnToggleExplanation);
        if (this.quizUI.modalManager) this.quizUI.modalManager.toggleExplanationModal(false); 

        this.updateNavigationButtons();
        this.renderQuestionGrid();
    }

    generateAnswerButtons(perguntaId, opcoes, respostaDadaId) {
        const container = this.elements.respostasContainer;
        if (!container) return;
        container.innerHTML = '';
        if (!opcoes || !Array.isArray(opcoes) || opcoes.length === 0) return;

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
            } else if (this.answerCallback && typeof this.answerCallback === 'function') {
                button.onclick = () => this.answerCallback(opt.id_opcao_resposta);
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
        const hasGeneralExplanation = currentQ && currentQ.explicacao_resposta && currentQ.explicacao_resposta.trim() !== '';
        const hasOptionSpecificFeedback = opcoes.some(op => op.feedback_opcao && op.feedback_opcao.trim() !== '');

        if ((hasGeneralExplanation || hasOptionSpecificFeedback) && this.elements.btnToggleExplanation) {
            this.quizUI.showElement(this.elements.btnToggleExplanation);
        } else {
            this.quizUI.hideElement(this.elements.btnToggleExplanation);
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

    updateNavigationButtons() {
        const { navigationButtons, prevBtn, nextBtn } = this.elements;
        if (!navigationButtons || !prevBtn || !nextBtn) return;

        const totalQuestions = this.quizState.getTotalFilteredQuestions();
        const isFirst = this.quizState.isFirstQuestion();
        const isLast = this.quizState.isLastQuestion();

        if (totalQuestions <= 0) {
            this.quizUI.hideElement(navigationButtons);
        } else {
            this.quizUI.showElement(navigationButtons);
            prevBtn.disabled = isFirst;
            nextBtn.disabled = false; 
            
            const nextButtonLabel = nextBtn.querySelector('.button__label') || nextBtn;
            if (isLast) {
                nextButtonLabel.textContent = "Ver Resultado";
            } else {
                nextButtonLabel.textContent = "Avançar";
            }
        }
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
    
    renderQuestionGrid() {
        const container = this.elements.questionGridContainer;
        if (!container) return;

        const questions = this.quizState.currentQuestionsSet;
        const currentIndex = this.quizState.currentQuestionIndex;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            this.quizUI.hideElement(container);
            return;
        }
        this.quizUI.showElement(container);
        container.innerHTML = '';

        const currentPage = Math.floor(currentIndex / QUESTOES_POR_PAGINA_GRID);
        const startIndex = currentPage * QUESTOES_POR_PAGINA_GRID;
        const endIndex = Math.min(startIndex + QUESTOES_POR_PAGINA_GRID, questions.length);

        const prevArrowCallback = () => {
            if (this.navigationCallback) this.navigationCallback(Math.max(0, startIndex - 1));
        }
        container.appendChild(this._createGridArrow('prev', startIndex === 0, prevArrowCallback, 'Página Anterior de Questões', ['question-grid__arrow--left']));

        for (let i = startIndex; i < endIndex; i++) {
            const questionState = questions[i];
            const item = document.createElement('button');
            item.className = 'question-grid__item';
            item.textContent = i + 1;
            item.dataset.index = i.toString();
            item.setAttribute('aria-label', `Ir para Questão ${i + 1}`);
            item.onclick = () => {
                if (this.navigationCallback) this.navigationCallback(i);
            };

            if (questionState.respostaDadaId !== undefined && questionState.respostaDadaId !== null) {
                if (questionState.foiCorretaNaSessao === true) item.classList.add('question-grid__item--correct');
                else if (questionState.foiCorretaNaSessao === false) item.classList.add('question-grid__item--incorrect');
            } else if (questionState.foiPulada === true) {
                item.classList.add('question-grid__item--skipped');
            }
            if (i === currentIndex) {
                item.classList.add('question-grid__item--current');
            }
            container.appendChild(item);
        }
        
        const nextArrowCallback = () => {
            if (this.navigationCallback) this.navigationCallback(endIndex);
        }
        container.appendChild(this._createGridArrow('next', endIndex >= questions.length, nextArrowCallback, 'Próxima Página de Questões', ['question-grid__arrow--right']));
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