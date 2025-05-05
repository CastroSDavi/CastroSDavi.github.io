/**
 * script.js - Refatorado para Modularidade e Aprimorado (vSOLID + Scroll + Fade)
 *
 * Melhorias aplicadas:
 * - Acessibilidade: Foco, feedback aria-live, roles.
 * - Estado: fullReset, validação.
 * - Performance: Lazy loading, requestAnimationFrame.
 * - Manutenção: Classes CSS visibilidade, nomes métodos, SRP.
 * - Scroll: Suave ('nearest'), condicional, margem CSS.
 * - UX: Transição Fade-in/out para suavizar mudança de altura da questão.
 */

// --- Módulo: UserData ---
class UserData {
    constructor() {
        this.reset();
    }

    get acertos() { return this._acertos; }
    get erros() { return this._erros; }
    get pontos() { return this._pontos; }

    incrementarAcertos() {
        this._acertos++;
        this._atualizarPontos();
    }

    incrementarErros() {
        this._erros++;
        this._atualizarPontos();
    }

    _atualizarPontos() {
        this._pontos = (15 * this._acertos) - (5 * this._erros);
        if (this._pontos < 0) this._pontos = 0;
    }

    reset() {
        this._acertos = 0;
        this._erros = 0;
        this._pontos = 0;
    }
}

// --- Módulo: QuizData ---
class QuizData {
    constructor(url = 'assets/data/questions.json') {
        this.url = url;
        this.allQuestions = [];
    }

    async loadQuestions() {
        try {
            const timestamp = Date.now();
            const response = await fetch(`${this.url}?t=${timestamp}`);
            if (!response.ok) throw new Error(`Falha ao carregar: ${response.status} ${response.statusText}`);
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("Formato de dados inválido (esperava um Array).");
            this.allQuestions = data;
            console.log(`Perguntas carregadas com sucesso (${this.allQuestions.length} perguntas).`);
            return true;
        } catch (error) {
            console.error("Erro CRÍTICO ao carregar ou processar 'questions.json':", error);
            this.allQuestions = [];
            throw error;
        }
    }

    getQuestions() {
        return [...this.allQuestions];
    }

    extractUniqueCategories() {
        const categorias = new Set();
        this.allQuestions.forEach(pergunta => {
            pergunta.categorias?.forEach(cat => {
                if (cat && typeof cat === 'string') categorias.add(cat.trim());
            });
        });
        return [...categorias].sort((a, b) => a.localeCompare(b));
    }
}

// --- Módulo: QuizState ---
class QuizState {
    constructor() {
        this.allQuestions = [];
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.selectedCategories = [];
        // Flag para indicar se é a primeira vez que uma questão está sendo carregada
        // Útil para pular a animação de fade-out inicial.
        this.isInitialQuestionLoad = true;
    }

    initialize(allQuestions) {
        this.allQuestions = allQuestions;
        this.resetQuizState();
    }

    resetQuizState() {
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true; // Reseta a flag
        this.allQuestions.forEach(q => delete q.respostaDada);
    }

    fullReset() {
        this.resetQuizState();
        this.selectedCategories = [];
        // Idealmente, desmarcar checkboxes na UI aqui.
    }

    filterQuestions() {
        this.resetQuizState(); // Garante que isInitialQuestionLoad seja true após filtrar
        if (this.selectedCategories.length > 0) {
            this.filteredQuestions = this.allQuestions.filter(p =>
                p.categorias?.some(cat => this.selectedCategories.includes(cat))
            );
        } else {
             this.filteredQuestions = [];
        }
        return this.filteredQuestions;
    }

    setSelectedCategories(categories) {
        this.selectedCategories = categories;
    }

    getCurrentQuestion() {
        return this.filteredQuestions[this.currentQuestionIndex] ?? null;
    }

    getCurrentQuestionNumberForDisplay() {
        return this.currentQuestionIndex + 1;
    }

    getTotalFilteredQuestions() {
        return this.filteredQuestions.length;
    }

    isQuizComplete() {
        return this.currentQuestionIndex >= this.filteredQuestions.length;
    }

    isFirstQuestion() {
        return this.currentQuestionIndex === 0;
    }

    isLastQuestion() {
        return this.currentQuestionIndex === this.filteredQuestions.length - 1;
    }

    recordAnswer(answer) {
        const question = this.getCurrentQuestion();
        if (question && !question.hasOwnProperty('respostaDada') && question.respostas?.includes(answer)) {
            question.respostaDada = answer;
            return true;
        }
         if (question && !question.hasOwnProperty('respostaDada') && !question.respostas?.includes(answer)) {
              console.warn(`Tentativa de registrar resposta inválida: "${answer}" para a questão ${this.currentQuestionIndex}`);
         }
        return false;
    }

    // Chamado ao avançar/voltar/ir para, marca que não é mais o load inicial
    markNavigated() {
        this.isInitialQuestionLoad = false;
    }

    goToQuestion(index) {
        if (index >= 0 && index < this.filteredQuestions.length) {
            this.currentQuestionIndex = index;
            this.markNavigated(); // Marca que houve navegação
            return true;
        }
        return false;
    }

    goToNextQuestion() {
        if (this.currentQuestionIndex < this.filteredQuestions.length) {
            this.currentQuestionIndex++;
            this.markNavigated(); // Marca que houve navegação
            return true;
        }
        return false;
    }

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.markNavigated(); // Marca que houve navegação
            return true;
        }
        return false;
    }
}


// --- Módulo: QuizUI ---
class QuizUI {
    constructor() {
        this.cacheDOMelements();
        this.currentSection = 'inicio-section';
        this.QUESTOES_POR_PAGINA_GRID = 5;
        this.TRANSITION_DURATION = 200; // ms - Deve corresponder à duração no CSS
    }

    cacheDOMelements() {
        this.elements = {
            // Seções
            inicioSection: document.getElementById('inicio-section'),
            questoesSection: document.getElementById('questoes-section'),
            mainContentQuestoes: document.querySelector('#questoes-section .main-content'),

            // Navegação
            navLinksTop: document.querySelectorAll('.navbar .nav-link'),
            navLinksBottom: document.querySelectorAll('.bottom-navbar .bottom-nav-link'),

            // Filtros
            filtroContainer: document.querySelector('.filtro-categorias-container'),
            filtroLabel: document.getElementById('categorias-label'),
            filtroCheckboxesScroll: document.getElementById('filtro-checkboxes-scroll'),
            catScrollLeft: document.getElementById('cat-scroll-left'),
            catScrollRight: document.getElementById('cat-scroll-right'),

            // Aviso
            avisoContainer: document.getElementById('aviso-container'),
            avisoMensagem: document.querySelector('#aviso-container .aviso-mensagem'),

            // Quiz
            quizSectionContent: document.getElementById('quiz-section'),
            questionWrap: document.querySelector('#quiz-section .question-wrap'), // *** Cache do container da pergunta ***
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
            navigationButtons: document.querySelector('#quiz-section .navigation-buttons'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            feedbackAcessivel: document.getElementById('feedback-acessivel'),

            // Grid
            questionGridContainer: document.getElementById('question-grid-container'),

            // Aside
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),

            // Resultado
            resultadoCard: document.querySelector('.resultado-final-card'),
            resultadoTitulo: document.querySelector('.resultado-final-titulo'),
            resultadoPontos: document.querySelector('.pontos-valor'),
            resultadoAcertos: document.querySelector('.acertos-valor'),
            resultadoErros: document.querySelector('.erros-valor'),
            btnRecomecar: document.getElementById('btn-recomecar'),

            // Modal
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn')
        };
        for (const key in this.elements) {
            if (!this.elements[key] && key !== 'filtroLabel' && key !== 'feedbackAcessivel') { // Permite que alguns não existam
                 console.warn(`QuizUI Cache DOM: Elemento ${key} não encontrado!`);
            }
        }
    }

    // --- Gerenciamento de Visibilidade ---
    showElement(element) { element?.classList.remove('is-hidden'); }
    hideElement(element) { element?.classList.add('is-hidden'); }

    // --- Gerenciamento de Seções ---
    showSection(sectionId) {
        document.querySelectorAll('.main-section').forEach(s => this.hideElement(s));
        const sectionToShow = this.elements[`${sectionId.replace('-', '')}Section`] || document.getElementById(sectionId);
        if (sectionToShow) {
            this.showElement(sectionToShow);
            this.currentSection = sectionId;
            this._updateActiveNavLinks(sectionId);
            if (sectionId === 'questoes-section') {
                this.showElement(this.elements.filtroContainer);
                this.hideElement(this.elements.quizSectionContent);
                this.hideElement(this.elements.resultadoCard);
                this.clearWarning();
                this.hideElement(this.elements.btnEncerrarSessao);
                this.updateFilterScrollArrows();
            } else {
                this.hideQuizElements();
            }
        } else {
            console.error(`QuizUI: Seção com ID '${sectionId}' não encontrada.`);
        }
        this.clearWarning();
    }

    _updateActiveNavLinks(activeSectionId) {
        [...this.elements.navLinksTop, ...this.elements.navLinksBottom].forEach(link => {
             const isActive = link.dataset.section === activeSectionId;
             link.classList.toggle('active', isActive);
             if (isActive) link.setAttribute('aria-current', 'page');
             else link.removeAttribute('aria-current');
        });
    }

    // --- Aviso ---
    showWarning(message) {
        const container = this.elements.avisoContainer;
        const msgElement = this.elements.avisoMensagem;
        if (container && msgElement) {
            msgElement.textContent = message;
            msgElement.setAttribute('role', 'alert');
            this.showElement(container);
            if (this.currentSection === 'questoes-section') {
                 this.hideElement(this.elements.quizSectionContent);
                 this.hideElement(this.elements.questionGridContainer);
                 this.hideElement(this.elements.btnEncerrarSessao);
                 this.hideProgressBar();
             }
        }
    }

    clearWarning() {
        this.hideElement(this.elements.avisoContainer);
        this.elements.avisoMensagem?.removeAttribute('role');
    }

     // --- Conteúdo do Quiz ---
    displayQuizContent(show = true) {
         // Controla a visibilidade dos containers gerais do quiz
         if (show) {
             this.showElement(this.elements.quizSectionContent);
             this.showElement(this.elements.btnEncerrarSessao);
             this.showElement(this.elements.progressContainer);
             this.showElement(this.elements.progressText);
             this.showElement(this.elements.questionGridContainer);
             this.clearWarning();
             this.hideElement(this.elements.resultadoCard);
             this.showElement(this.elements.filtroContainer);
         } else {
             this.hideElement(this.elements.quizSectionContent);
             this.hideElement(this.elements.btnEncerrarSessao);
             this.hideProgressBar();
             this.hideElement(this.elements.questionGridContainer);
         }
     }

    hideQuizElements() {
        this.hideElement(this.elements.quizSectionContent);
        this.hideElement(this.elements.resultadoCard);
        this.hideElement(this.elements.avisoContainer);
        this.hideElement(this.elements.questionGridContainer);
        this.hideElement(this.elements.btnEncerrarSessao);
        this.hideProgressBar();
    }

    // *** ATUALIZADO: Este método agora APENAS atualiza os dados visuais ***
    // A lógica de fade foi movida para QuizLogic._displayCurrentQuestion
    displayQuestion(question, questionNumber, totalQuestions, selectedCategories) {
        if (!question) return;

        // Atualiza os textos e imagem
        let tituloCat = this.determineCategoryTitle(question, selectedCategories);
        this.elements.categoriaTitulo && (this.elements.categoriaTitulo.innerText = tituloCat);
        this.elements.idQuestao && (this.elements.idQuestao.innerText = questionNumber);
        this.elements.perguntaTexto && (this.elements.perguntaTexto.textContent = question.pergunta);
        this.elements.referenciaQuestao && (this.elements.referenciaQuestao.textContent = `Referência: ${question.referencia || 'N/A'}`);
        this.displayQuestionImage(question.imagem, questionNumber);

        // Atualiza a barra de progresso
        this.updateProgressBar(questionNumber, totalQuestions);

        // Foca o título (sem scroll automático)
        this.elements.questionTitle?.focus({ preventScroll: true });
    }


    determineCategoryTitle(question, selectedCategories) {
        let tituloCat = "Questão";
        const categoriasDaQuestao = question.categorias || [];
        const checkboxTodas = this.elements.filtroCheckboxesScroll?.querySelector('input[value="Todas"]');
        if (checkboxTodas?.checked && categoriasDaQuestao.length > 0) {
            tituloCat = categoriasDaQuestao.join(' / ');
        } else if (selectedCategories?.length > 0) {
            const categoriaFiltradaAtiva = selectedCategories.find(catFiltro => categoriasDaQuestao.includes(catFiltro));
            if (categoriaFiltradaAtiva) tituloCat = categoriaFiltradaAtiva;
            else if (categoriasDaQuestao.length > 0) tituloCat = categoriasDaQuestao[0];
        } else if (categoriasDaQuestao.length > 0) {
             tituloCat = categoriasDaQuestao[0];
        }
        return tituloCat;
    }

    displayQuestionImage(imageUrl, questionNumber) {
        const imgElement = this.elements.perguntaImagem;
        if (imgElement) {
            if (imageUrl?.trim()) {
                imgElement.src = imageUrl;
                imgElement.alt = `Imagem ilustrativa da questão ${questionNumber}`;
                imgElement.loading = 'lazy';
                this.showElement(imgElement);
                imgElement.onerror = () => {
                    this.hideElement(imgElement);
                    console.warn(`Erro ao carregar imagem: ${imageUrl}`);
                };
            } else {
                this.hideElement(imgElement);
                imgElement.src = ""; imgElement.alt = "";
            }
        }
    }

    generateAnswerButtons(question, answerClickHandler) {
        const container = this.elements.respostasContainer;
        // ... (lógica para gerar botões como antes) ...
        if (!container) return;
        container.innerHTML = '';
        if (!question.respostas?.length) {
            container.innerHTML = '<p style="color: var(--color-accent-red);">Erro: Opções de resposta não encontradas.</p>';
            return;
        }
        const jaRespondida = question.hasOwnProperty('respostaDada');
        question.respostas.forEach((respostaTexto) => {
            const p = document.createElement('p');
            p.className = 'answer';
            p.textContent = respostaTexto;
            p.setAttribute('role', 'button');
            p.tabIndex = jaRespondida ? -1 : 0;
            if (jaRespondida) {
                this.markAnswerAsAlreadyDone(p, question, respostaTexto);
            } else if (answerClickHandler) {
                const clickHandler = () => answerClickHandler(respostaTexto);
                p.onclick = clickHandler;
                p.onkeydown = (e) => {
                     if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(); }
                };
            }
            container.appendChild(p);
        });
    }

    markAnswerAsAlreadyDone(answerElement, question, answerText) {
        // ... (lógica como antes) ...
        answerElement.onclick = null;
        answerElement.onkeydown = null;
        answerElement.classList.add('answered');
        answerElement.style.cursor = 'default';
        if (answerText === question.correta) {
            answerElement.classList.add('correct');
        } else if (answerText === question.respostaDada) {
            answerElement.classList.add('incorrect');
        }
    }

    disableAnswers() {
        // ... (lógica como antes) ...
        this.elements.respostasContainer?.querySelectorAll('.answer').forEach(answer => {
            answer.onclick = null;
            answer.onkeydown = null;
            answer.classList.add('answered');
            answer.style.cursor = 'default';
            answer.tabIndex = -1;
        });
    }

    applyAnswerFeedback(selectedAnswerText, correctAnswerText, isCorrect) {
        // ... (lógica como antes, incluindo atualização do feedbackAcessivel) ...
        this.elements.respostasContainer?.querySelectorAll('.answer').forEach(answerEl => {
            const currentAnswerText = answerEl.textContent;
            if (currentAnswerText === selectedAnswerText) {
                answerEl.classList.add(isCorrect ? 'correct' : 'incorrect');
            }
            if (!isCorrect && currentAnswerText === correctAnswerText) {
                answerEl.classList.add('correct');
            }
        });
        if (this.elements.feedbackAcessivel) {
            this.elements.feedbackAcessivel.textContent = isCorrect ? "Resposta correta!" : "Resposta incorreta.";
        }
    }

    // --- Barra de Progresso ---
    updateProgressBar(current, total) {
        // ... (lógica como antes) ...
        const container = this.elements.progressContainer;
        const bar = this.elements.progressBarFill;
        const text = this.elements.progressText;
        if (container && bar && text && total > 0) {
            const displayCurrent = Math.min(current, total);
            const percentage = total > 0 ? (displayCurrent / total) * 100 : 0;
            bar.style.width = `${percentage}%`;
            text.textContent = `${current} / ${total}`;
             this.showElement(container);
             this.showElement(text);
        } else if (container && bar && text) {
            this.hideProgressBar();
        }
    }

    hideProgressBar() {
        // ... (lógica como antes) ...
        this.hideElement(this.elements.progressContainer);
        this.hideElement(this.elements.progressText);
        if(this.elements.progressBarFill) this.elements.progressBarFill.style.width = '0%';
        if(this.elements.progressText) this.elements.progressText.textContent = '0 / 0';
    }

    // --- Botões de Navegação ---
    updateNavigationButtons(isFirst, isLast, totalQuestions) {
        // ... (lógica como antes) ...
         const navContainer = this.elements.navigationButtons;
         const prevBtn = this.elements.prevBtn;
         const nextBtn = this.elements.nextBtn;
         if (!navContainer || !prevBtn || !nextBtn) return;
         if (totalQuestions <= 0) { this.hideElement(navContainer); return; }
         this.showElement(navContainer);
         prevBtn.disabled = isFirst;
         nextBtn.disabled = false;
         nextBtn.textContent = isLast ? 'Ver Resultado' : 'Próxima';
    }

    // --- Grid de Navegação ---
    renderQuestionGrid(questions, currentIndex, questionClickHandler) {
        // ... (lógica como antes) ...
        const container = this.elements.questionGridContainer;
        if (!container || !questions?.length) { this.hideElement(container); return; }
        this.showElement(container);
        container.innerHTML = '';
        const currentPage = Math.floor(currentIndex / this.QUESTOES_POR_PAGINA_GRID);
        const startIndex = currentPage * this.QUESTOES_POR_PAGINA_GRID;
        const endIndex = Math.min(startIndex + this.QUESTOES_POR_PAGINA_GRID, questions.length);
        container.appendChild(this._createGridArrow('prev', currentIndex === 0, () => questionClickHandler(currentIndex - 1), 'Questão Anterior'));
        for (let i = startIndex; i < endIndex; i++) {
            const question = questions[i];
            const gridItem = document.createElement('button');
            gridItem.className = 'grid-item';
            gridItem.textContent = i + 1;
            gridItem.dataset.index = i;
            gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`);
            gridItem.onclick = () => questionClickHandler(i);
            if (question.hasOwnProperty('respostaDada')) {
                const correct = question.respostaDada === question.correta;
                gridItem.classList.add(correct ? 'grid-item--correct' : 'grid-item--incorrect');
            }
            if (i === currentIndex) {
                gridItem.classList.add('grid-item--current');
            }
            container.appendChild(gridItem);
        }
        container.appendChild(this._createGridArrow('next', currentIndex >= questions.length - 1, () => questionClickHandler(currentIndex + 1), 'Próxima Questão'));
    }

    _createGridArrow(direction, disabled, clickHandler, ariaLabel) {
        // ... (lógica como antes) ...
        const arrowBtn = document.createElement('button');
        arrowBtn.className = 'grid-nav-arrow';
        arrowBtn.setAttribute('aria-label', ariaLabel);
        arrowBtn.disabled = disabled;
        arrowBtn.onclick = clickHandler;
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("height", "24px"); svg.setAttribute("viewBox", "0 -960 960 960");
        svg.setAttribute("width", "24px"); svg.setAttribute("fill", "currentColor");
        const path = document.createElementNS(svgNS, "path");
        const pathD = direction === 'prev'
            ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"
            : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z";
        path.setAttribute("d", pathD);
        svg.appendChild(path);
        arrowBtn.appendChild(svg);
        return arrowBtn;
    }

    // --- Filtros ---
    generateCategoryFilters(categories, changeHandler) {
        // ... (lógica como antes) ...
        const container = this.elements.filtroCheckboxesScroll;
        if (!container) return;
        container.innerHTML = '';
        const labelId = this.elements.filtroLabel?.id;
        const createCheckboxItem = (id, value, text, checked = false) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            const input = document.createElement('input');
            input.type = 'checkbox'; input.id = id; input.name = 'categoria';
            input.value = value; input.checked = checked;
            if(labelId) input.setAttribute('aria-describedby', labelId);
            input.addEventListener('change', (e) => changeHandler(e.target));
            const label = document.createElement('label');
            label.htmlFor = id; label.textContent = text;
            div.append(input, label);
            return div;
        };
        container.appendChild(createCheckboxItem('cat-todas', 'Todas', 'Todas', false));
        categories.forEach(category => {
            const id = `cat-${category.toLowerCase().replace(/\s+/g, '-')}`;
            container.appendChild(createCheckboxItem(id, category, category, false));
        });
        this.updateFilterScrollArrows();
    }

    getSelectedCategories() {
        // ... (lógica como antes) ...
        const selected = [];
        this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:checked:not([value="Todas"])')
            .forEach(cb => selected.push(cb.value));
        return selected;
    }

    syncSelectAllCheckbox() {
        // ... (lógica como antes) ...
        const container = this.elements.filtroCheckboxesScroll;
        const cbTodas = container?.querySelector('input[value="Todas"]');
        const otherCheckboxes = container?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');
        if (!cbTodas || !otherCheckboxes?.length) return;
        cbTodas.checked = ![...otherCheckboxes].some(cb => !cb.checked);
    }

    toggleAllCategories(isChecked) {
        // ... (lógica como antes) ...
        this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])')
            .forEach(cb => cb.checked = isChecked);
    }

    updateFilterScrollArrows() {
        // ... (lógica como antes com requestAnimationFrame) ...
         const scrollContainer = this.elements.filtroCheckboxesScroll;
         const leftArrow = this.elements.catScrollLeft;
         const rightArrow = this.elements.catScrollRight;
         if (window.innerWidth <= 768) {
             this.hideElement(leftArrow); this.hideElement(rightArrow);
             if(leftArrow) leftArrow.disabled = true; if(rightArrow) rightArrow.disabled = true;
             return;
         }
         if (!scrollContainer || !leftArrow || !rightArrow) {
              this.hideElement(leftArrow); this.hideElement(rightArrow);
             if(leftArrow) leftArrow.disabled = true; if(rightArrow) rightArrow.disabled = true;
             return;
         }
         requestAnimationFrame(() => {
              if (!this.elements.filtroCheckboxesScroll || !this.elements.catScrollLeft || !this.elements.catScrollRight) return;
              const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
              const epsilon = 2;
              const canScroll = scrollWidth > clientWidth + epsilon;
              if (!canScroll) {
                  this.hideElement(leftArrow); this.hideElement(rightArrow);
                  leftArrow.disabled = true; rightArrow.disabled = true;
              } else {
                  this.showElement(leftArrow); this.showElement(rightArrow);
                  leftArrow.disabled = scrollLeft <= 0;
                  rightArrow.disabled = scrollLeft + clientWidth >= scrollWidth - epsilon;
              }
         });
     }

    scrollCategories(direction) {
        // ... (lógica como antes) ...
        const scrollContainer = this.elements.filtroCheckboxesScroll;
        if (!scrollContainer) return;
        const scrollAmount = scrollContainer.clientWidth * 0.8;
        scrollContainer.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        this.updateFilterScrollArrows();
    }

    // --- Pontuação ---
    updateScoreDisplay(points, correct, incorrect) {
        // ... (lógica como antes) ...
         if (this.elements.pontuacaoDisplay) this.elements.pontuacaoDisplay.textContent = points;
         if (this.elements.acertosNumDisplay) this.elements.acertosNumDisplay.textContent = correct;
         if (this.elements.errosNumDisplay) this.elements.errosNumDisplay.textContent = incorrect;
    }

    // --- Resultado Final ---
    showResults(userData, filteredQuestions, selectedCategories) {
        // ... (lógica como antes) ...
        const card = this.elements.resultadoCard;
        if (!card || !userData) return;
        this.hideQuizElements();
        this.hideElement(this.elements.filtroContainer);
        if(this.elements.resultadoTitulo) this.elements.resultadoTitulo.textContent = this._generateResultTitle(filteredQuestions, selectedCategories);
        if(this.elements.resultadoPontos) this.elements.resultadoPontos.textContent = userData.pontos;
        if(this.elements.resultadoAcertos) this.elements.resultadoAcertos.textContent = userData.acertos;
        if(this.elements.resultadoErros) this.elements.resultadoErros.textContent = userData.erros;
        this.showElement(card);
        this.elements.resultadoTitulo?.focus();
    }

    _generateResultTitle(filteredQuestions, selectedCategories) {
        // ... (lógica como antes) ...
         const totalFiltered = filteredQuestions?.length ?? 0;
         const allCategoriesAvailable = this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length ?? 0;
         const checkboxTodas = this.elements.filtroCheckboxesScroll?.querySelector('input[value="Todas"]');
         if (totalFiltered === 0 && selectedCategories.length > 0) return "Nenhuma questão encontrada";
         if (totalFiltered === 0) return "Nenhuma questão respondida";
         if (selectedCategories.length === 1) return `Quiz de "${selectedCategories[0]}" Concluído!`;
         if (checkboxTodas?.checked && allCategoriesAvailable > 0) return `Quiz de Todas as Categorias Concluído!`;
         if (selectedCategories.length === allCategoriesAvailable && allCategoriesAvailable > 0) return `Quiz (Todas as ${selectedCategories.length} Categorias) Concluído!`;
         if (selectedCategories.length > 1) return `Quiz de ${selectedCategories.length} Categorias Concluído!`;
         return "Quiz Finalizado!";
     }

    hideResults() {
        // ... (lógica como antes) ...
        this.hideElement(this.elements.resultadoCard);
        this.showElement(this.elements.filtroContainer);
    }

    // --- Modal ---
    toggleConfirmModal(show) {
        // ... (lógica como antes) ...
        const overlay = this.elements.confirmEncerrarOverlay;
        if (!overlay) return;
        if (show) {
            this.showElement(overlay);
            requestAnimationFrame(() => {
                overlay.classList.add('visible');
                this.elements.cancelEncerrarBtn?.focus();
            });
        } else {
            overlay.classList.remove('visible');
            overlay.addEventListener('transitionend', () => {
                 if (!overlay.classList.contains('visible')) {
                      this.hideElement(overlay);
                 }
            }, { once: true });
        }
    }

    // --- Scroll Suave para Início da Questão ---
    scrollToQuestionStart() {
        // ... (lógica como antes) ...
        const titleElement = this.elements.questionTitle;
        if (this.currentSection === 'questoes-section' && titleElement) {
            try {
                 titleElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (e) {
                 console.warn("scrollIntoView falhou:", e);
            }
        } else {
             console.warn("scrollToQuestionStart: Título da questão não encontrado ou seção incorreta.");
        }
    }

    // --- Foco e Scroll Botão Próxima ---
    focusNextButton(preventScroll = false) {
        // ... (lógica como antes) ...
        this.elements.nextBtn?.focus({ preventScroll });
    }

    smoothScrollToNextButton() {
        // ... (lógica como antes, rolando o container) ...
         const navContainer = this.elements.navigationButtons;
         if (navContainer) {
              try {
                   navContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } catch (e) {
                   console.warn("scrollIntoView (para container de botões) falhou:", e);
              }
         }
    }
}


// --- Módulo: QuizLogic ---
class QuizLogic {
    constructor(quizState, quizUI, userData) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
    }

    startQuiz() {
        // ... (lógica como antes, chama _displayCurrentQuestion(false)) ...
        this.user.reset();
        this.state.filterQuestions();
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        const questions = this.state.filteredQuestions;
        const categories = this.state.selectedCategories;
        if (questions.length > 0) {
             this.ui.displayQuizContent(true);
             this._displayCurrentQuestion(false); // Não rola ao iniciar/filtrar
        } else {
             this.ui.displayQuizContent(false);
              const hasFilters = this.ui.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length > 0;
              if (categories.length === 0 && hasFilters) this.ui.showWarning("Selecione pelo menos uma categoria para começar.");
              else if (categories.length > 0) this.ui.showWarning("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
              else if (!hasFilters) this.ui.showWarning("Nenhuma categoria de pergunta disponível.");
              else this.ui.showWarning("Selecione uma categoria para iniciar.");
        }
    }

    handleCategoryChange() {
        // ... (lógica como antes) ...
        const selectedCats = this.ui.getSelectedCategories();
        this.state.setSelectedCategories(selectedCats);
        this.startQuiz();
    }

    answerQuestion(selectedAnswer) {
        // ... (lógica como antes, chama focusNextButton(true) e smoothScrollToNextButton()) ...
        const question = this.state.getCurrentQuestion();
        if (this.state.recordAnswer(selectedAnswer)) {
            const isCorrect = selectedAnswer === question.correta;
            if (isCorrect) this.user.incrementarAcertos();
            else this.user.incrementarErros();
            this.ui.disableAnswers();
            this.ui.applyAnswerFeedback(selectedAnswer, question.correta, isCorrect);
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            this.ui.renderQuestionGrid(
                 this.state.filteredQuestions,
                 this.state.currentQuestionIndex,
                 (index) => this.goToQuestion(index)
            );
            this.ui.focusNextButton(true);
            this.ui.smoothScrollToNextButton();
        }
    }


    nextQuestion() {
        // ... (lógica como antes, chama _displayCurrentQuestion()) ...
         const isCurrentlyLast = this.state.isLastQuestion();
         if (this.state.goToNextQuestion()) {
              if (this.state.isQuizComplete()) {
                   this.endQuiz();
              } else {
                   this._displayCurrentQuestion(); // Rola por padrão
              }
         } else if (isCurrentlyLast) {
              this.endQuiz();
         }
    }

    previousQuestion() {
        // ... (lógica como antes, chama _displayCurrentQuestion()) ...
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestion(); // Rola por padrão
        }
    }

    goToQuestion(index) {
        // ... (lógica como antes, chama _displayCurrentQuestion()) ...
        if (index >= this.state.getTotalFilteredQuestions()) {
             this.endQuiz();
        } else if (this.state.goToQuestion(index)) {
           this._displayCurrentQuestion(); // Rola por padrão
       }
    }

    // *** MÉTODO ATUALIZADO COM LÓGICA DE FADE ***
    async _displayCurrentQuestion(shouldScroll = true) {
        const questionWrap = this.ui.elements.questionWrap;
        const isInitial = this.state.isInitialQuestionLoad; // Verifica se é o load inicial

        const updateContent = () => {
            const question = this.state.getCurrentQuestion();
            if (question) {
                // Atualiza conteúdo enquanto invisível/transparente
                this.ui.displayQuestion(
                    question,
                    this.state.getCurrentQuestionNumberForDisplay(),
                    this.state.getTotalFilteredQuestions(),
                    this.state.selectedCategories
                );
                this.ui.updateNavigationButtons(
                    this.state.isFirstQuestion(),
                    this.state.isLastQuestion(),
                    this.state.getTotalFilteredQuestions()
                );
                this.ui.renderQuestionGrid(
                    this.state.filteredQuestions,
                    this.state.currentQuestionIndex,
                    (index) => this.goToQuestion(index)
                );
                this.ui.generateAnswerButtons(question, (answer) => this.answerQuestion(answer));

                // Só faz o scroll para o título se explicitamente pedido
                if (shouldScroll) {
                     this.ui.scrollToQuestionStart();
                }
            } else {
                console.warn("_displayCurrentQuestion: Tentativa de exibir questão inválida.");
                this.endQuiz(); // Encerra se não encontrar questão
            }
        };

        // Lógica de Fade
        if (!isInitial && questionWrap) {
            // Aplica fade-out
            questionWrap.classList.add('is-fading-out');

            // Espera a transição terminar (com fallback de timeout)
            await new Promise(resolve => {
                let resolved = false;
                const handler = () => {
                    if (!resolved) {
                        questionWrap.removeEventListener('transitionend', handler);
                        resolved = true;
                        resolve();
                    }
                };
                questionWrap.addEventListener('transitionend', handler);
                setTimeout(() => {
                     if (!resolved) { // Se transitionend não disparou
                         console.warn("TransitionEnd fallback timeout triggered.");
                         questionWrap.removeEventListener('transitionend', handler);
                         resolved = true;
                         resolve();
                     }
                }, this.ui.TRANSITION_DURATION + 50); // Duração da transição + margem
            });

            // Mantém invisível, troca conteúdo e inicia fade-in
            questionWrap.classList.remove('is-fading-out');
            questionWrap.classList.add('is-transparent');

            // Garante que a atualização do DOM ocorra *depois* de definir transparente
            requestAnimationFrame(() => {
                 updateContent();
                 // Garante que a remoção da transparência (fade-in) ocorra *depois* da atualização
                 requestAnimationFrame(() => {
                      questionWrap.classList.remove('is-transparent');
                 });
            });
        } else {
            // Primeiro carregamento ou elemento não encontrado, atualiza direto
            updateContent();
            // Garante que esteja visível se era o primeiro load
            questionWrap?.classList.remove('is-fading-out', 'is-transparent');
            // Marca que o load inicial já ocorreu para as próximas transições
            if(this.state.getTotalFilteredQuestions() > 0) {
                 this.state.isInitialQuestionLoad = false;
            }
        }
    }


    endQuiz() {
         console.log("Quiz encerrado.");
         this.ui.showResults(this.user, this.state.filteredQuestions, this.state.selectedCategories);
         // Foco já vai para o título do resultado via showResults
    }

    restartQuiz() {
         console.log("Reiniciando quiz com as mesmas categorias.");
         this.state.resetQuizState(); // Reseta estado, incluindo isInitialQuestionLoad
         this.startQuiz(); // startQuiz chama _displayCurrentQuestion(false)
    }

    forceEndQuiz() {
        this.endQuiz();
        this.ui.toggleConfirmModal(false);
    }
}


// --- Módulo Principal: App ---
class App {
    constructor() {
        this.userData = new UserData();
        this.quizData = new QuizData();
        this.quizState = new QuizState();
        this.quizUI = new QuizUI();
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData);
    }

    async initialize() {
        try {
            const loaded = await this.quizData.loadQuestions();
            if (loaded) {
                this.quizState.initialize(this.quizData.getQuestions());
                const categories = this.quizData.extractUniqueCategories();
                this.quizUI.generateCategoryFilters(categories, (checkbox) => this.handleFilterChange(checkbox));
                this.setupEventListeners();
                const initialActiveLink = document.querySelector('.navbar .nav-link.active, .bottom-navbar .bottom-nav-link.active');
                const initialSection = initialActiveLink?.dataset.section || 'inicio-section';
                this.quizUI.showSection(initialSection);
                console.log("App inicializado com sucesso.");
                 this.quizUI.updateFilterScrollArrows();
            }
        } catch (error) {
            this.quizUI.showSection('questoes-section');
            this.quizUI.showWarning(`Falha crítica ao inicializar: ${error.message}. Recarregue a página ou verifique o arquivo de dados.`);
             this.disableCoreFunctionality();
        }
    }

    disableCoreFunctionality() {
         this.quizUI.hideElement(this.quizUI.elements.filtroContainer);
    }

    setupEventListeners() {
        const navLinks = [...this.quizUI.elements.navLinksTop, ...this.quizUI.elements.navLinksBottom];
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetSection = link.dataset.section;
                if (targetSection && targetSection !== this.quizUI.currentSection) {
                     const previousSection = this.quizUI.currentSection;
                     this.quizUI.showSection(targetSection);
                     // if (previousSection === 'questoes-section' && targetSection !== 'questoes-section') {
                     //      this.state.fullReset(); // Opcional: Resetar tudo ao sair
                     // }
                     if (targetSection === 'questoes-section') {
                         this.quizLogic.handleCategoryChange();
                     }
                }
            });
        });

        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());

        this.quizUI.elements.catScrollLeft?.addEventListener('click', () => this.quizUI.scrollCategories('left'));
        this.quizUI.elements.catScrollRight?.addEventListener('click', () => this.quizUI.scrollCategories('right'));
        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('scroll', () => this.quizUI.updateFilterScrollArrows(), { passive: true });

        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());

        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => this.quizLogic.forceEndQuiz());
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => this.quizUI.toggleConfirmModal(false));
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (event) => {
            if (event.target === this.quizUI.elements.confirmEncerrarOverlay) {
                 this.quizUI.toggleConfirmModal(false);
            }
        });

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => { this.quizUI.updateFilterScrollArrows(); }, 150);
        });
    }

    handleFilterChange(changedCheckbox) {
         const container = this.quizUI.elements.filtroCheckboxesScroll;
         if (!container) return;
         const isSelectAll = changedCheckbox.value === 'Todas';
         if (isSelectAll) this.quizUI.toggleAllCategories(changedCheckbox.checked);
         else this.quizUI.syncSelectAllCheckbox();

         this.quizLogic.handleCategoryChange();
         this.quizUI.updateFilterScrollArrows();
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});