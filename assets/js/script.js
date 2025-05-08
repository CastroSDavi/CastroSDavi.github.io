/**
 * script.js - Refatorado com BEM, SOLID e seletores/IDs atualizados
 * + Adicionado console.log para depurar visibilidade de seção
 * + Adicionado funcionalidade de cronômetro
 * + Melhorias na tela de resultados (tempo, mensagem, novo botão)
 * + Correção do erro 'getTotalFilteredQuestions' em showResults
 * + Modificações para "Tentar Novamente" e "Quiz Rápido"
 */

// --- Módulo: UserData ---
class UserData {
    constructor() { this.reset(); }
    get acertos() { return this._acertos; }
    get erros() { return this._erros; }
    get pontos() { return this._pontos; }
    incrementarAcertos() { this._acertos++; this._atualizarPontos(); }
    incrementarErros() { this._erros++; this._atualizarPontos(); }
    _atualizarPontos() { this._pontos = Math.max(0, (15 * this._acertos) - (5 * this._erros)); }
    reset() { this._acertos = 0; this._erros = 0; this._pontos = 0; }
}

// --- Módulo: QuizData ---
class QuizData {
    constructor(url = 'assets/data/questions.json') { this.url = url; this.allQuestions = []; }
    async loadQuestions() { try { const t = Date.now(), e = await fetch(`${this.url}?t=${t}`); if (!e.ok) throw new Error(`Falha ao carregar: ${e.status} ${e.statusText}`); const s = await e.json(); if (!Array.isArray(s)) throw new Error("Formato de dados inválido (esperava um Array)."); return this.allQuestions = s, console.log(`Perguntas carregadas com sucesso (${this.allQuestions.length} perguntas).`), !0 } catch (t) { throw console.error("Erro CRÍTICO ao carregar ou processar 'questions.json':", t), this.allQuestions = [], t } }
    getQuestions() { return [...this.allQuestions]; }
    extractUniqueCategories() { const t = new Set; return this.allQuestions.forEach((e => { e.categorias?.forEach((e => { e && "string" == typeof e && t.add(e.trim()) })) })), [...t].sort(((t, e) => t.localeCompare(e))) }
}

// --- Módulo: QuizState ---
class QuizState {
    constructor() { this.allQuestions = [], this.filteredQuestions = [], this.currentQuestionIndex = 0, this.selectedCategories = [], this.isInitialQuestionLoad = !0 } initialize(t) { this.allQuestions = t, this.resetQuizState() } resetQuizState() { this.filteredQuestions = [], this.currentQuestionIndex = 0, this.isInitialQuestionLoad = !0, this.allQuestions.forEach((t => delete t.respostaDada)) } fullReset() { this.resetQuizState(), this.selectedCategories = [] } filterQuestions() { return this.resetQuizState(), this.selectedCategories.length > 0 ? this.filteredQuestions = this.allQuestions.filter((t => t.categorias?.some((t => this.selectedCategories.includes(t))))) : this.filteredQuestions = [], this.filteredQuestions } setSelectedCategories(t) { this.selectedCategories = Array.isArray(t) ? t : [] } getCurrentQuestion() { return this.filteredQuestions[this.currentQuestionIndex] ?? null } getCurrentQuestionNumberForDisplay() { return this.currentQuestionIndex + 1 } getTotalFilteredQuestions() { return this.filteredQuestions.length } isQuizComplete() { return this.currentQuestionIndex >= this.filteredQuestions.length } isFirstQuestion() { return 0 === this.currentQuestionIndex } isLastQuestion() { return this.currentQuestionIndex === this.filteredQuestions.length - 1 } recordAnswer(t) { const e = this.getCurrentQuestion(); return e && !e.hasOwnProperty("respostaDada") && e.respostas?.includes(t) ? (e.respostaDada = t, !0) : (e && !e.hasOwnProperty("respostaDada") && !e.respostas?.includes(t) && console.warn(`Tentativa de registrar resposta inválida: "${t}" para a questão ${this.currentQuestionIndex}`), !1) } markNavigated() { this.isInitialQuestionLoad = !1 } goToQuestion(t) { return t >= 0 && t < this.filteredQuestions.length ? (this.currentQuestionIndex = t, this.markNavigated(), !0) : !1 } goToNextQuestion() { return this.currentQuestionIndex < this.filteredQuestions.length ? (this.currentQuestionIndex++, this.markNavigated(), !0) : !1 } goToPreviousQuestion() { return this.currentQuestionIndex > 0 ? (this.currentQuestionIndex--, this.markNavigated(), !0) : !1 }
}

// --- Módulo: LayoutManager ---
class LayoutManager {
    constructor() {
        this.footerElement = document.getElementById('footer') || document.querySelector('.site-footer');
        this.hiddenClassName = 'u-is-hidden';
        if (!this.footerElement) { console.warn("LayoutManager: Footer element not found!"); }
    }
    handleSectionChange(sectionId, previousSectionId) {
        if (!this.footerElement) return;
        if (sectionId === 'question-section') { this.footerElement.classList.add(this.hiddenClassName); }
        else { this.footerElement.classList.remove(this.hiddenClassName); }
    }
}

// --- Módulo: QuizUI ---
class QuizUI {
    constructor(onSectionChangeCallback = null) {
        this.hiddenClassName = 'u-is-hidden';
        this.currentSection = 'home-section';
        this.QUESTOES_POR_PAGINA_GRID = 5;
        this.TRANSITION_DURATION = 400;
        this.onSectionChange = onSectionChangeCallback;

        this.timerInterval = null;
        this.timerSeconds = 0;
        this.timerRunning = false;

        this.cacheDOMelements();
    }

    cacheDOMelements() {
        this.elements = {
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'),
            accountSection: document.getElementById('account-section'),
            navElements: document.querySelectorAll('[data-section]'),
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),
            filtroContainer: document.querySelector('#question-section .category-filter'),
            filtroLabel: document.getElementById('categorias-label'),
            filtroCheckboxesScroll: document.getElementById('filtro-checkboxes-scroll'),
            catScrollLeft: document.getElementById('cat-scroll-left'),
            catScrollRight: document.getElementById('cat-scroll-right'),
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
            navigationButtons: document.querySelector('#quiz-section .quiz-navigation'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            feedbackAcessivel: document.getElementById('feedback-acessivel'),
            questionGridContainer: document.getElementById('question-grid-container'),
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),
            resultadoCard: document.querySelector('#question-section .card--quiz-result'),
            resultadoTitulo: document.querySelector('#question-section .card--quiz-result .quiz-results__title'),
            resultadoPontos: document.getElementById('resultado-pontos'),
            resultadoAcertos: document.getElementById('resultado-acertos'),
            resultadoErros: document.getElementById('resultado-erros'),
            resultadoTempo: document.getElementById('resultado-tempo'),
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'),
            btnRecomecar: document.getElementById('btn-recomecar'),
            btnExplorarMais: document.getElementById('btn-explorar-mais'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarModal: document.getElementById('confirm-encerrar-modal'),
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn'),
            timerDisplay: document.getElementById('timer-display'),
            // START --- MODIFICATION: Cache new buttons from home page --- START
            startRandomQuiz: document.getElementById('start-random-quiz'),
            // END --- MODIFICATION --- END
        };
        this.sectionElements = {
            'home-section': this.elements.homeSection,
            'question-section': this.elements.questionSection,
            'account-section': this.elements.accountSection
        };
        this._validateCache();
    }

    _validateCache() {
        const optionalElements = ['feedbackAcessivel', 'filtroLabel', 'confirmEncerrarModal'];
        for (const key in this.elements) {
            if (!this.elements[key] && !optionalElements.includes(key) && !(key in this.sectionElements)) {
                console.warn(`QuizUI Cache DOM: Elemento ${key} não encontrado!`);
            }
        }
        for (const key in this.sectionElements) {
             if (!this.sectionElements[key]) {
                  console.warn(`QuizUI Cache DOM: Elemento de Seção ${key} não encontrado! Verifique o ID no HTML.`);
             }
        }
    }

    showElement(element) { element?.classList.remove(this.hiddenClassName); }
    hideElement(element) { element?.classList.add(this.hiddenClassName); }

    getSectionUIConfig() {
        return {
            'home-section': { visible: [], hidden: [this.elements.filtroContainer, this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer], onEnter: null },
            'question-section': { visible: [this.elements.filtroContainer], hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText], onEnter: () => this.updateFilterScrollArrows() },
            'account-section': { visible: [], hidden: [this.elements.filtroContainer, this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer], onEnter: null }
        };
    }

    showSection(sectionId) {
        console.log(`[Log] Tentando mostrar seção: ${sectionId}`);
        Object.values(this.sectionElements).forEach(sectionEl => {
            if (sectionEl) this.hideElement(sectionEl);
        });

        const sectionToShow = this.sectionElements[sectionId];
        if (sectionToShow) {
            const previousSection = this.currentSection;
            this.showElement(sectionToShow);
            this.currentSection = sectionId;
            this._updateActiveNavLinks(sectionId);

            const config = this.getSectionUIConfig()[sectionId];
            if (config) {
                config.visible?.forEach(el => this.showElement(el));
                config.hidden?.forEach(el => this.hideElement(el));
                config.onEnter?.();
            } else {
                 console.warn(`Configuração de UI para a seção '${sectionId}' não encontrada.`);
            }
            if (sectionId !== 'question-section') { this.clearWarning(); }
            if (this.onSectionChange && typeof this.onSectionChange === 'function' && previousSection !== sectionId) {
                try { this.onSectionChange(sectionId, previousSection); }
                catch (error) { console.error("Erro no callback onSectionChange:", error); }
            }
        } else {
            console.error(`QuizUI.showSection: Seção com ID '${sectionId}' NÃO FOI ENCONTRADA.`);
        }
    }

    _updateActiveNavLinks(activeSectionId) { this.elements.navElements?.forEach(t => { if (t) { const e = t.dataset.section === activeSectionId, s = "main-nav__link", i = "bottom-nav__link", n = "--active"; t.classList.remove(`${s}${n}`, `${i}${n}`), e ? (t.classList.contains(s) ? t.classList.add(`${s}${n}`) : t.classList.contains(i) && t.classList.add(`${i}${n}`), t.setAttribute("aria-current", "page")) : t.removeAttribute("aria-current") } }) }
    showWarning(message) { const t = this.elements.avisoContainer, e = this.elements.avisoMensagem; t && e && (e.textContent = message, e.setAttribute("role", "alert"), this.showElement(t), this.currentSection === "question-section" && this.hideQuizElements()) }
    clearWarning() { this.hideElement(this.elements.avisoContainer), this.elements.avisoMensagem?.removeAttribute("role") }
    displayQuizContent(show = true) { if (show) { this.showElement(this.elements.quizSectionContent), this.showElement(this.elements.btnEncerrarSessao), this.showElement(this.elements.progressContainer), this.showElement(this.elements.progressText), this.showElement(this.elements.questionGridContainer), this.clearWarning(), this.hideElement(this.elements.resultadoCard) } else { this.hideElement(this.elements.quizSectionContent), this.hideElement(this.elements.btnEncerrarSessao), this.hideProgressBar(), this.hideElement(this.elements.questionGridContainer) } }
    hideQuizElements() { this.hideElement(this.elements.quizSectionContent), this.hideElement(this.elements.resultadoCard), this.hideElement(this.elements.questionGridContainer), this.hideElement(this.elements.btnEncerrarSessao), this.hideProgressBar() }
    displayQuestion(question, questionNumber, totalQuestions, selectedCategories) { if (!question) return void console.error("Tentativa de exibir questão nula."); { const t = this.determineCategoryTitle(question, selectedCategories); this.elements.categoriaTitulo && (this.elements.categoriaTitulo.innerText = t), this.elements.idQuestao && (this.elements.idQuestao.innerText = questionNumber), this.elements.perguntaTexto && (this.elements.perguntaTexto.textContent = question.pergunta), this.elements.referenciaQuestao && (this.elements.referenciaQuestao.textContent = `Referência: ${question.referencia || "N/A"}`), this.displayQuestionImage(question.imagem, questionNumber), this.updateProgressBar(questionNumber, totalQuestions), this.elements.questionTitle?.focus({ preventScroll: !0 }) } }
    determineCategoryTitle(question, selectedCategories) { let t = "Questão"; const e = question.categorias || [], s = this.elements.filtroCheckboxesScroll?.querySelector('input[value="Todas"]'); return s?.checked && e.length > 0 ? t = e.join(" / ") : selectedCategories?.length > 0 ? t = selectedCategories.find((t => e.includes(t))) ?? (e.length > 0 ? e[0] : t) : e.length > 0 && (t = e[0]), t }
    displayQuestionImage(imageUrl, questionNumber) { const t = this.elements.perguntaImagem; t && (imageUrl?.trim() ? (t.src = imageUrl, t.alt = `Imagem ilustrativa da questão ${questionNumber}`, t.loading = "lazy", this.showElement(t), t.onerror = () => { this.hideElement(t), console.warn(`Erro ao carregar imagem: ${imageUrl}`), t.onerror = null }) : (this.hideElement(t), t.src = "", t.alt = "")) }
    generateAnswerButtons(question, answerClickHandler) { const container = this.elements.respostasContainer; if (!container) return; container.innerHTML = ''; if (!question || !question.respostas?.length) { container.innerHTML = '<p class="error-message">Erro: Opções de resposta não encontradas.</p>'; return; } const hasAnswered = question.hasOwnProperty('respostaDada'); const answerBaseClass = 'question-display__answer-option'; question.respostas.forEach((answerText) => { const btn = document.createElement('button'); btn.className = answerBaseClass; btn.textContent = answerText; btn.disabled = hasAnswered; btn.style.cursor = hasAnswered ? 'default' : 'pointer'; btn.tabIndex = hasAnswered ? -1 : 0; if (hasAnswered) { this.markAnswerAsAlreadyDone(btn, question, answerText); } else if (answerClickHandler) { btn.onclick = () => answerClickHandler(answerText); } container.appendChild(btn); }); }
    markAnswerAsAlreadyDone(answerElement, question, answerText) { const t = "question-display__answer-option", e = `${t}--answered`, s = `${t}--correct`, i = `${t}--incorrect`; answerElement.classList.add(e), answerText === question.correta ? answerElement.classList.add(s) : answerText === question.respostaDada && answerElement.classList.add(i) }
    disableAnswers() { const t = "question-display__answer-option", e = `${t}--answered`; this.elements.respostasContainer?.querySelectorAll(`.${t}`).forEach((t => { t.onclick = null, t.disabled = !0, t.classList.add(e), t.style.cursor = "default", t.tabIndex = -1 })) }
    applyAnswerFeedback(selectedAnswerText, correctAnswerText, isCorrect) { const t = "question-display__answer-option", e = `${t}--correct`, s = `${t}--incorrect`; this.elements.respostasContainer?.querySelectorAll(`.${t}`).forEach((t => { const i = t.textContent; i === selectedAnswerText && t.classList.add(isCorrect ? e : s), isCorrect || i !== correctAnswerText || t.classList.add(e) })), this.elements.feedbackAcessivel && (this.elements.feedbackAcessivel.textContent = isCorrect ? "Resposta correta!" : "Resposta incorreta.") }
    updateProgressBar(current, total) { const t = this.elements.progressContainer, e = this.elements.progressBarFill, s = this.elements.progressText; t && e && s && (total > 0 ? (e.style.width = `${Math.min(current, total) / total * 100}%`, s.textContent = `${current} / ${total}`, this.showElement(t), this.showElement(s)) : this.hideProgressBar()) }
    hideProgressBar() { this.hideElement(this.elements.progressContainer), this.hideElement(this.elements.progressText), this.elements.progressBarFill && (this.elements.progressBarFill.style.width = "0%"), this.elements.progressText && (this.elements.progressText.textContent = "") }
    updateNavigationButtons(isFirst, isLast, totalQuestions) { const t = this.elements.navigationButtons, e = this.elements.prevBtn, s = this.elements.nextBtn; t && e && s && (totalQuestions <= 0 ? this.hideElement(t) : (this.showElement(t), e.disabled = isFirst, s.disabled = !1, s.textContent = isLast ? "Ver Resultado" : "Próxima")) }
    renderQuestionGrid(questions, currentIndex, questionClickHandler) { const container = this.elements.questionGridContainer; if (!container) { console.warn("Container do grid de questões não encontrado."); return; } if (!questions?.length) { this.hideElement(container); return; } this.showElement(container); container.innerHTML = ''; const currentPage = Math.floor(currentIndex / this.QUESTOES_POR_PAGINA_GRID); const startIndex = currentPage * this.QUESTOES_POR_PAGINA_GRID; const endIndex = Math.min(startIndex + this.QUESTOES_POR_PAGINA_GRID, questions.length); const arrowBaseClass = 'question-grid__arrow'; const leftModifier = `${arrowBaseClass}--left`; const rightModifier = `${arrowBaseClass}--right`; const itemBaseClass = 'question-grid__item'; const currentModifier = `${itemBaseClass}--current`; const correctModifier = `${itemBaseClass}--correct`; const incorrectModifier = `${itemBaseClass}--incorrect`; container.appendChild(this._createGridArrow('prev', startIndex === 0, () => questionClickHandler(startIndex - 1), 'Página Anterior de Questões', [arrowBaseClass, leftModifier])); for (let i = startIndex; i < endIndex; i++) { const question = questions[i]; const gridItem = document.createElement('button'); gridItem.className = itemBaseClass; gridItem.textContent = i + 1; gridItem.dataset.index = i; gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`); gridItem.onclick = () => questionClickHandler(i); if (question.hasOwnProperty('respostaDada')) { const correct = question.respostaDada === question.correta; gridItem.classList.add(correct ? correctModifier : incorrectModifier); } if (i === currentIndex) { gridItem.classList.add(currentModifier); gridItem.setAttribute('aria-current', 'step'); } container.appendChild(gridItem); } container.appendChild(this._createGridArrow('next', endIndex >= questions.length, () => questionClickHandler(endIndex), 'Próxima Página de Questões', [arrowBaseClass, rightModifier])); }
    _createGridArrow(direction, disabled, clickHandler, ariaLabel, classList = []) { const arrowBtn = document.createElement('button'); arrowBtn.classList.add(...classList); arrowBtn.classList.add('u-is-circle'); arrowBtn.setAttribute('aria-label', ariaLabel); arrowBtn.disabled = disabled; arrowBtn.onclick = clickHandler; const svgNS = "http://www.w3.org/2000/svg"; const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("viewBox", "0 -960 960 960"); svg.setAttribute("fill", "currentColor"); const path = document.createElementNS(svgNS, "path"); const pathD = direction === 'prev' ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"; path.setAttribute("d", pathD); svg.appendChild(path); arrowBtn.appendChild(svg); return arrowBtn; }
    generateCategoryFilters(categories) { const container = this.elements.filtroCheckboxesScroll; if (!container) return; container.innerHTML = ''; const labelId = this.elements.filtroLabel?.id; const itemClass = 'category-filter__item'; const inputClass = 'category-filter__input'; const chipClass = 'category-filter__chip'; const createCheckboxItem = (id, value, text, checked = false) => { const div = document.createElement('div'); div.className = itemClass; const input = document.createElement('input'); input.type = 'checkbox'; input.id = id; input.name = 'categoria'; input.value = value; input.checked = checked; input.className = inputClass; if(labelId) input.setAttribute('aria-describedby', labelId); const label = document.createElement('label'); label.htmlFor = id; label.textContent = text; label.className = chipClass; div.append(input, label); return div; }; container.appendChild(createCheckboxItem('cat-todas', 'Todas', 'Todas', false)); categories.forEach(category => { const id = `cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; container.appendChild(createCheckboxItem(id, category, category, false)); }); this.updateFilterScrollArrows(); }
    getSelectedCategories() { const t = []; return this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:checked:not([value="Todas"])').forEach((e => t.push(e.value))), t }
    syncSelectAllCheckbox() { const t = this.elements.filtroCheckboxesScroll, e = t?.querySelector('input[value="Todas"]'), s = t?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])'); e && s?.length && (e.checked = ![...s].some((t => !t.checked))) }
    toggleAllCategories(isChecked) { this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').forEach((t => { t.checked !== isChecked && (t.checked = isChecked, t.dispatchEvent(new Event("change", { bubbles: !0 }))) })) }
    updateFilterScrollArrows() { const t = this.elements.filtroCheckboxesScroll, e = this.elements.catScrollLeft, s = this.elements.catScrollRight; if (window.innerWidth <= 768) return this.hideElement(e), this.hideElement(s), e && (e.disabled = !0), void(s && (s.disabled = !0)); if (!t || !e || !s) return this.hideElement(e), this.hideElement(s), e && (e.disabled = !0), void(s && (s.disabled = !0)); requestAnimationFrame((() => { if (!this.elements.filtroCheckboxesScroll || !this.elements.catScrollLeft || !this.elements.catScrollRight) return; const { scrollLeft: i, scrollWidth: l, clientWidth: n } = t; l > n + 2 ? (this.showElement(e), this.showElement(s), e.disabled = i <= 0, s.disabled = i + n >= l - 2) : (this.hideElement(e), this.hideElement(s), e.disabled = !0, s.disabled = !0) })) }
    scrollCategories(direction) { const t = this.elements.filtroCheckboxesScroll; t && t.scrollBy({ left: "left" === direction ? -.6 * t.clientWidth : .6 * t.clientWidth, behavior: "smooth" }) }
    updateScoreDisplay(points, correct, incorrect) { this.elements.pontuacaoDisplay && (this.elements.pontuacaoDisplay.textContent = points), this.elements.acertosNumDisplay && (this.elements.acertosNumDisplay.textContent = correct), this.elements.errosNumDisplay && (this.elements.errosNumDisplay.textContent = incorrect) }

    _formatTime(timeUnit) {
        return timeUnit < 10 ? `0${timeUnit}` : timeUnit;
    }

    _formatDisplayTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        let timeString = `${this._formatTime(minutes)}:${this._formatTime(seconds)}`;
        if (hours > 0) {
            timeString = `${this._formatTime(hours)}:${timeString}`;
        }
        return timeString;
    }

    _updateTimerDisplay() {
        if (!this.elements.timerDisplay) return;
        this.elements.timerDisplay.textContent = this._formatDisplayTime(this.timerSeconds);
    }

    startTimer() {
        if (this.timerRunning) return;
        this.timerRunning = true;
        if (this.timerInterval) { clearInterval(this.timerInterval); }
        this._updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            this._updateTimerDisplay();
        }, 1000);
        console.log("Timer iniciado.");
    }

    stopTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.timerRunning = false;
        console.log("Timer parado. Tempo final:", this._formatDisplayTime(this.timerSeconds));
    }

    resetTimer() {
        this.stopTimer();
        this.timerSeconds = 0;
        if (this.elements.timerDisplay) {
            this.elements.timerDisplay.textContent = "00:00";
        }
        console.log("Timer resetado.");
    }

    showResults(userData, filteredQuestions, selectedCategories, totalFilteredQuestions) { 
        const card = this.elements.resultadoCard;
        if (!card) { console.error("showResults: Elemento do card de resultado não encontrado."); return; }
        if (!userData) { console.error("showResults: Dados do usuário inválidos."); return; }

        this.hideQuizElements();
        this.hideElement(this.elements.filtroContainer); // This hides the category filters

        if (this.elements.resultadoTitulo) this.elements.resultadoTitulo.textContent = "Desempenho Final!";
        if (this.elements.resultadoPontos) this.elements.resultadoPontos.textContent = userData.pontos;
        if (this.elements.resultadoAcertos) this.elements.resultadoAcertos.textContent = userData.acertos;
        if (this.elements.resultadoErros) this.elements.resultadoErros.textContent = userData.erros;
        if (this.elements.resultadoTempo) this.elements.resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds);

        if (this.elements.resultadoMensagemMotivacional) {
            const pontos = userData.pontos;
            const totalQuestoes = totalFilteredQuestions;
            let mensagem = "Continue praticando para melhorar ainda mais!";
            if (totalQuestoes > 0) {
                const pontuacaoMaximaPossivel = totalQuestoes * 15;
                if (pontos >= pontuacaoMaximaPossivel * 0.8) {
                     mensagem = "Excelente desempenho! Você é um mestre da histologia!";
                } else if (pontos >= pontuacaoMaximaPossivel * 0.5) {
                     mensagem = "Muito bom! Você está no caminho certo.";
                }
            } else if (pontos === 0 && userData.acertos === 0 && userData.erros === 0) {
                mensagem = "Nenhuma questão foi respondida ou encontrada para este quiz.";
            }
            this.elements.resultadoMensagemMotivacional.textContent = mensagem;
        }

        this.showElement(card);
        this.elements.resultadoTitulo?.focus();
    }

    _generateResultTitle(filteredQuestions, selectedCategories) {
        const numFiltered = filteredQuestions?.length ?? 0;
        const numTotalCategoriasCheckbox = this.elements.filtroCheckboxesScroll?.querySelectorAll(`input.${'category-filter__input'}[type="checkbox"]:not([value="Todas"])`).length ?? 0;
        const selectAllChecked = this.elements.filtroCheckboxesScroll?.querySelector(`input.${'category-filter__input'}[value="Todas"]`)?.checked;

        if (numFiltered === 0 && selectedCategories.length > 0) return "Nenhuma questão encontrada";
        if (numFiltered === 0) return "Nenhuma questão respondida";
        if (selectAllChecked && numTotalCategoriasCheckbox > 0) return "Quiz de Todas as Categorias Concluído!";
        if (selectedCategories.length === 1) return `Quiz de "${selectedCategories[0]}" Concluído!`;
        if (selectedCategories.length === numTotalCategoriasCheckbox && numTotalCategoriasCheckbox > 0) return `Quiz (Todas as ${selectedCategories.length} Categorias) Concluído!`;
        if (selectedCategories.length > 1) return `Quiz de ${selectedCategories.length} Categorias Concluído!`;
        return "Quiz Finalizado!";
    }

    hideResults() { this.hideElement(this.elements.resultadoCard); }

    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay;
        if (!overlay) { console.error("Modal de confirmação (overlay) não encontrado."); return; }
        const visibleModifier = 'modal--visible';
        if (show) {
            this.showElement(overlay);
            overlay.scrollTop;
            requestAnimationFrame(() => {
                overlay.classList.add(visibleModifier);
                this.elements.cancelEncerrarBtn?.focus();
            });
        } else {
            overlay.classList.remove(visibleModifier);
            const handleTransitionEnd = () => {
                if (!overlay.classList.contains(visibleModifier)) {
                    this.hideElement(overlay);
                }
                overlay.removeEventListener('transitionend', handleTransitionEnd);
            };
            overlay.addEventListener('transitionend', handleTransitionEnd, { once: true });
             setTimeout(() => {
                 if (!overlay.classList.contains(visibleModifier)) {
                    this.hideElement(overlay);
                 }
                 overlay.removeEventListener('transitionend', handleTransitionEnd);
             }, this.TRANSITION_DURATION + 50);
        }
    }

    scrollToQuestionStart() { const t = this.elements.questionTitle; "question-section" === this.currentSection && t ? t.scrollIntoView({ behavior: "smooth", block: "nearest" }) : "question-section" === this.currentSection && console.warn("scrollToQuestionStart: Título da questão não encontrado.") }
    focusNextButton(preventScroll = false) { this.elements.nextBtn?.focus({ preventScroll }) }
    smoothScrollToNextButton() { const t = this.elements.navigationButtons; t && t.scrollIntoView({ behavior: "smooth", block: "nearest" }) }
}


// --- Módulo: QuizLogic ---
class QuizLogic {
    constructor(quizState, quizUI, userData) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
    }

    startQuiz() {
        this.user.reset();
        this.state.filterQuestions();
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();

        const filteredQuestions = this.state.filteredQuestions;
        const selectedCategories = this.state.selectedCategories;

        if (filteredQuestions.length > 0) {
            this.ui.displayQuizContent(true);
            this._displayCurrentQuestion(false);
            this.ui.startTimer();
        } else {
            this.ui.displayQuizContent(false);
            const hasCategoryCheckboxes = this.ui.elements.filtroCheckboxesScroll?.querySelector('input[type="checkbox"]:not([value="Todas"])');
            if (hasCategoryCheckboxes) {
                if (selectedCategories.length === 0) {
                    this.ui.showWarning("Selecione pelo menos uma categoria para começar.");
                } else {
                    this.ui.showWarning("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
                }
            } else {
                this.ui.showWarning("Nenhuma categoria de pergunta disponível para seleção.");
            }
            this.ui.stopTimer();
        }
    }

    handleCategoryChange() {
        const selectedCategories = this.ui.getSelectedCategories();
        this.state.setSelectedCategories(selectedCategories);
        this.startQuiz();
    }

    answerQuestion(selectedAnswer) {
        const currentQuestion = this.state.getCurrentQuestion();
        if (this.state.recordAnswer(selectedAnswer)) {
            if (selectedAnswer === currentQuestion.correta) {
                this.user.incrementarAcertos();
            } else {
                this.user.incrementarErros();
            }
            this.ui.disableAnswers();
            this.ui.applyAnswerFeedback(selectedAnswer, currentQuestion.correta, selectedAnswer === currentQuestion.correta);
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (index) => this.goToQuestion(index));
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.focusNextButton(true);
            this.ui.smoothScrollToNextButton();
        }
    }

    nextQuestion() {
        const isCurrentlyLast = this.state.isLastQuestion();
        const currentQuestion = this.state.getCurrentQuestion();
        if (this.state.goToNextQuestion()) {
            if (this.state.isQuizComplete()) {
                this.endQuiz();
            } else {
                this._displayCurrentQuestion();
            }
        } else if (isCurrentlyLast && currentQuestion?.hasOwnProperty('respostaDada')) {
            this.endQuiz();
        }
    }

    previousQuestion() { if (this.state.goToPreviousQuestion()) { this._displayCurrentQuestion(); } }

    goToQuestion(index) {
        if (index >= this.state.getTotalFilteredQuestions()) {
            this.endQuiz();
        } else if (this.state.goToQuestion(index)) {
            this._displayCurrentQuestion();
        }
    }

    async _displayCurrentQuestion(shouldScroll = true) {
        const questionWrapElement = this.ui.elements.questionWrap;
        const isInitialLoad = this.state.isInitialQuestionLoad;

        const displayLogic = () => {
            const question = this.state.getCurrentQuestion();
            if (question) {
                this.ui.displayQuestion(question, this.state.getCurrentQuestionNumberForDisplay(), this.state.getTotalFilteredQuestions(), this.state.selectedCategories);
                this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
                this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
                this.ui.generateAnswerButtons(question, (answer) => this.answerQuestion(answer));
                if (shouldScroll) { this.ui.scrollToQuestionStart(); }
            } else {
                console.error("_displayCurrentQuestion: Questão inválida no índice:", this.state.currentQuestionIndex);
                this.endQuiz();
            }
        };

        if (!isInitialLoad && questionWrapElement) {
            questionWrapElement.classList.add("is-fading-out");
            await new Promise(resolve => {
                let transitioned = false;
                const transitionEndHandler = () => { if (!transitioned) { questionWrapElement.removeEventListener("transitionend", transitionEndHandler); transitioned = true; resolve(); } };
                questionWrapElement.addEventListener("transitionend", transitionEndHandler);
                setTimeout(() => { if (!transitioned) { questionWrapElement.removeEventListener("transitionend", transitionEndHandler); transitioned = true; resolve(); } }, this.ui.TRANSITION_DURATION + 50);
            });
            questionWrapElement.classList.remove("is-fading-out");
            questionWrapElement.classList.add("is-transparent");
            requestAnimationFrame(() => {
                displayLogic();
                requestAnimationFrame(() => { questionWrapElement.classList.remove("is-transparent"); });
            });
        } else {
            displayLogic();
            if (questionWrapElement) { questionWrapElement.classList.remove("is-fading-out", "is-transparent"); }
            if (this.state.getTotalFilteredQuestions() > 0) { this.state.markNavigated(); }
        }
    }

    endQuiz() {
        console.log("Quiz encerrado.");
        this.ui.stopTimer();
        this.ui.showResults(
            this.user,
            this.state.filteredQuestions,
            this.state.selectedCategories,
            this.state.getTotalFilteredQuestions() 
        );
    }

    // START --- MODIFICATION for "Tentar Novamente" --- START
    restartQuiz() {
        console.log("Reiniciando quiz...");
        this.user.reset();
        this.state.resetQuizState(); // Resets current question index, answers given, etc.
                                     // Keeps selectedCategories for now, user can change them.

        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults(); // Hide the results card
        this.ui.resetTimer();

        // Explicitly show the category filter again, as it's hidden by showResults
        this.ui.showElement(this.ui.elements.filtroContainer);
        this.ui.updateFilterScrollArrows(); // Update scroll arrows in case they were hidden/disabled

        // Hide quiz content (like questions, nav buttons) and clear any previous warnings
        this.ui.displayQuizContent(false);
        this.ui.clearWarning();

        // The UI should now primarily show category filters.
        // Call handleCategoryChange to initiate the quiz start process based on current (possibly persisted) category selections.
        // If no categories are selected, it will show the appropriate warning.
        this.handleCategoryChange();
    }
    // END --- MODIFICATION --- END


    forceEndQuiz() {
        console.log("Forçando encerramento do quiz.");
        this.ui.stopTimer();
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
        this.layoutManager = new LayoutManager();
        this.quizUI = new QuizUI(this.layoutManager.handleSectionChange.bind(this.layoutManager));
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData);
    }

    async initialize() {
        console.log("Inicializando App...");
        this.quizUI.resetTimer();

        try {
            const loaded = await this.quizData.loadQuestions();
            if (loaded && this.quizData.allQuestions.length > 0) {
                this.quizState.initialize(this.quizData.getQuestions());
                const categories = this.quizData.extractUniqueCategories();
                this.quizUI.generateCategoryFilters(categories);
                this.setupEventListeners();
                const initialActiveLink = document.querySelector('.main-nav__link--active, .bottom-nav__link--active');
                const initialSection = initialActiveLink?.dataset.section || 'home-section';
                this.quizUI.showSection(initialSection);
                console.log("App inicializado com sucesso.");
                 if (initialSection === 'question-section') {
                     this.quizUI.updateFilterScrollArrows();
                     this.quizLogic.handleCategoryChange();
                 }
            } else if (loaded) {
                 console.warn("Arquivo de perguntas carregado, mas vazio ou inválido.");
                 this.quizUI.showSection('question-section');
                 this.quizUI.showWarning("Não foi possível carregar as perguntas. O arquivo pode estar vazio ou mal formatado.");
                 this.disableCoreFunctionality();
            }
        } catch (error) {
            console.error("Falha crítica ao inicializar o App:", error);
            try {
                this.quizUI.showSection('question-section');
                this.quizUI.showWarning(`Erro fatal ao carregar: ${error.message}. Por favor, recarregue a página ou contate o suporte.`);
                this.disableCoreFunctionality();
            } catch (uiError) {
                console.error("Erro adicional ao tentar exibir mensagem de erro na UI:", uiError);
                alert(`Erro fatal ao carregar: ${error.message}. Por favor, recarregue a página.`);
            }
        }
    }

    disableCoreFunctionality() {
         this.quizUI.hideElement(this.quizUI.elements.filtroContainer);
    }

    setupEventListeners() {
        // Listener para navegação principal e botões com data-section (inclui "Quiz por Categoria")
        this.quizUI.elements.navElements?.forEach(navElement => {
            if (!navElement) return;
            navElement.addEventListener('click', (e) => {
                if (navElement.tagName === 'A') e.preventDefault(); // Para links
                const targetSection = navElement.dataset.section;
                if (targetSection && targetSection !== this.quizUI.currentSection) {
                     this.quizUI.showSection(targetSection);
                     // Se a seção de destino for 'question-section', atualize/inicie o quiz
                     if (targetSection === 'question-section') {
                          this.quizLogic.handleCategoryChange();
                     }
                } else if (targetSection && targetSection === 'question-section' && targetSection === this.quizUI.currentSection) {
                    // Se já estiver na seção de questões e clicar novamente (ex: botão "Quiz por Categoria")
                    // garante que o quiz seja (re)iniciado com as seleções atuais.
                    this.quizLogic.handleCategoryChange();
                }
            });
        });
        
        // START --- MODIFICATION: Event listener for "Quiz Rápido" --- START
        if (this.quizUI.elements.startRandomQuiz) {
            this.quizUI.elements.startRandomQuiz.addEventListener('click', () => {
                console.log("Botão 'Quiz Rápido' clicado!");
                this.quizUI.showSection('question-section'); // Navega para a seção de questões

                // Programaticamente seleciona todas as categorias individuais
                const categoryCheckboxes = this.quizUI.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');
                if (categoryCheckboxes) {
                    categoryCheckboxes.forEach(checkbox => {
                        checkbox.checked = true;
                    });
                }

                // Atualiza o estado da checkbox "Todas" para consistência da UI
                const selectAllCheckbox = this.quizUI.elements.filtroCheckboxesScroll?.querySelector('input[value="Todas"]');
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = true;
                }
                this.quizUI.updateFilterScrollArrows(); // Atualiza setas de rolagem do filtro

                // Inicia a lógica do quiz com todas as categorias selecionadas
                this.quizLogic.handleCategoryChange();
            });
        }
        // END --- MODIFICATION --- END


        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());
        this.quizUI.elements.catScrollLeft?.addEventListener('click', () => this.quizUI.scrollCategories('left'));
        this.quizUI.elements.catScrollRight?.addEventListener('click', () => this.quizUI.scrollCategories('right'));
        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('scroll', () => this.quizUI.updateFilterScrollArrows(), { passive: true });
        
        // Listener para o botão "Tentar Novamente" (Recomeçar)
        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());
        
        this.quizUI.elements.btnExplorarMais?.addEventListener('click', () => this.handleExplorarMais());
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));

        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => {
            console.log("Botão Confirmar (forceEndQuiz) clicado");
            this.quizLogic.forceEndQuiz();
        });
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => {
            console.log("Botão Cancelar (toggleConfirmModal) clicado");
            this.quizUI.toggleConfirmModal(false);
        });
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (event) => {
            if (event.target === this.quizUI.elements.confirmEncerrarOverlay) {
                console.log("Clique no Overlay (toggleConfirmModal) detectado");
                this.quizUI.toggleConfirmModal(false);
            }
        });

        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('change', (event) => {
            const target = event.target;
            if (target && target.matches(`input.${'category-filter__input'}[type="checkbox"][name="categoria"]`)) {
                this.handleFilterChange(target);
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
        if (!container || !changedCheckbox) return;
        const isSelectAllCheckbox = changedCheckbox.value === 'Todas';
        if (isSelectAllCheckbox) {
            this.quizUI.toggleAllCategories(changedCheckbox.checked);
        } else {
            this.quizUI.syncSelectAllCheckbox();
        }
        this.quizLogic.handleCategoryChange();
        this.quizUI.updateFilterScrollArrows();
    }

    handleExplorarMais() {
        console.log("Botão 'Explorar Mais' clicado!");
        alert("Funcionalidade 'Explorar Mais' em desenvolvimento!\n\nPossíveis ações:\n- Revisar Respostas do Quiz Atual\n- Ver Estatísticas Detalhadas\n- Voltar à Seleção de Categorias\n- Acessar Recursos de Estudo");
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});