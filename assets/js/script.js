/**
 * script.js - Refatorado com BEM, SOLID e seletores/IDs atualizados
 * + Adicionado console.log para depurar visibilidade de seção
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
        this.cacheDOMelements();
        this.currentSection = 'home-section';
        this.QUESTOES_POR_PAGINA_GRID = 5;
        this.TRANSITION_DURATION = 400;
        this.onSectionChange = onSectionChangeCallback;
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
            quizSectionContent: document.getElementById('quiz-section'), // Container INTERNO do quiz
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
            btnRecomecar: document.getElementById('btn-recomecar'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarModal: document.getElementById('confirm-encerrar-modal'),
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn')
        };
        this.sectionElements = {
            'home-section': this.elements.homeSection,
            'question-section': this.elements.questionSection,
            'account-section': this.elements.accountSection
        };
        this._validateCache();
    }

    _validateCache() {
        const optionalElements = ['feedbackAcessivel', 'filtroLabel'];
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

    // --- Gerenciamento de Seções ---
    showSection(sectionId) {
        // Adiciona Logs para depuração
        console.log(`[Log] Tentando mostrar seção: ${sectionId}`);
        let foundAndHid = 0;
        let totalSections = Object.keys(this.sectionElements).length;

        // 1. Esconde TODAS as seções mapeadas
        Object.entries(this.sectionElements).forEach(([key, sectionEl]) => {
            if (sectionEl) {
                this.hideElement(sectionEl);
                foundAndHid++;
                // console.log(`[Log] Escondendo ${key} (Elemento: ${sectionEl.id})`);
            } else {
                 console.warn(`[Log] Seção mapeada '${key}' não encontrada no cache ao tentar esconder.`);
            }
        });
        console.log(`[Log] ${foundAndHid}/${totalSections} seções escondidas.`);

        // 2. Encontra a seção alvo
        const sectionToShow = this.sectionElements[sectionId];
        console.log(`[Log] Elemento encontrado para mostrar (${sectionId}):`, sectionToShow);

        if (sectionToShow) {
            const previousSection = this.currentSection;
            // 3. Mostra a seção alvo
            this.showElement(sectionToShow);
             console.log(`[Log] Mostrando ${sectionToShow.id}. Classe ${this.hiddenClassName} removida? ${!sectionToShow.classList.contains(this.hiddenClassName)}`);
            this.currentSection = sectionId;
            this._updateActiveNavLinks(sectionId);

            // 4. Aplica configuração específica
            const config = this.getSectionUIConfig()[sectionId];
            if (config) {
                config.visible?.forEach(el => this.showElement(el));
                config.hidden?.forEach(el => this.hideElement(el));
                config.onEnter?.();
            } else {
                 console.warn(`Configuração de UI para a seção '${sectionId}' não encontrada.`);
            }

            // 5. Limpa aviso
            if (sectionId !== 'question-section') { this.clearWarning(); }

            // 6. Notifica mudança
            if (this.onSectionChange && typeof this.onSectionChange === 'function' && previousSection !== sectionId) {
                try { this.onSectionChange(sectionId, previousSection); }
                catch (error) { console.error("Erro no callback onSectionChange:", error); }
            }
        } else {
            console.error(`QuizUI.showSection: Seção com ID '${sectionId}' NÃO FOI ENCONTRADA no mapeamento sectionElements.`);
            // Aqui está o problema: se não encontra a seção para mostrar, nenhuma seção fica visível.
        }
    }

    // --- Atualização de Links/Ícones Ativos ---
     _updateActiveNavLinks(activeSectionId) { this.elements.navElements?.forEach(t => { if (t) { const e = t.dataset.section === activeSectionId, s = "main-nav__link", i = "bottom-nav__link", n = "--active"; t.classList.remove(`${s}${n}`, `${i}${n}`), e ? (t.classList.contains(s) ? t.classList.add(`${s}${n}`) : t.classList.contains(i) && t.classList.add(`${i}${n}`), t.setAttribute("aria-current", "page")) : t.removeAttribute("aria-current") } }) }

    // --- Aviso ---
     showWarning(message) { const t = this.elements.avisoContainer, e = this.elements.avisoMensagem; t && e && (e.textContent = message, e.setAttribute("role", "alert"), this.showElement(t), this.currentSection === "question-section" && this.hideQuizElements()) }
     clearWarning() { this.hideElement(this.elements.avisoContainer), this.elements.avisoMensagem?.removeAttribute("role") }

     // --- Conteúdo do Quiz ---
     displayQuizContent(show = true) { if (show) { this.showElement(this.elements.quizSectionContent), this.showElement(this.elements.btnEncerrarSessao), this.showElement(this.elements.progressContainer), this.showElement(this.elements.progressText), this.showElement(this.elements.questionGridContainer), this.clearWarning(), this.hideElement(this.elements.resultadoCard) } else { this.hideElement(this.elements.quizSectionContent), this.hideElement(this.elements.btnEncerrarSessao), this.hideProgressBar(), this.hideElement(this.elements.questionGridContainer) } }
     hideQuizElements() { this.hideElement(this.elements.quizSectionContent), this.hideElement(this.elements.resultadoCard), this.hideElement(this.elements.questionGridContainer), this.hideElement(this.elements.btnEncerrarSessao), this.hideProgressBar() }

    // --- Exibição da Questão ---
     displayQuestion(question, questionNumber, totalQuestions, selectedCategories) { if (!question) return void console.error("Tentativa de exibir questão nula."); { const t = this.determineCategoryTitle(question, selectedCategories); this.elements.categoriaTitulo && (this.elements.categoriaTitulo.innerText = t), this.elements.idQuestao && (this.elements.idQuestao.innerText = questionNumber), this.elements.perguntaTexto && (this.elements.perguntaTexto.textContent = question.pergunta), this.elements.referenciaQuestao && (this.elements.referenciaQuestao.textContent = `Referência: ${question.referencia || "N/A"}`), this.displayQuestionImage(question.imagem, questionNumber), this.updateProgressBar(questionNumber, totalQuestions), this.elements.questionTitle?.focus({ preventScroll: !0 }) } }
     determineCategoryTitle(question, selectedCategories) { let t = "Questão"; const e = question.categorias || [], s = this.elements.filtroCheckboxesScroll?.querySelector('input[value="Todas"]'); return s?.checked && e.length > 0 ? t = e.join(" / ") : selectedCategories?.length > 0 ? t = selectedCategories.find((t => e.includes(t))) ?? (e.length > 0 ? e[0] : t) : e.length > 0 && (t = e[0]), t }
     displayQuestionImage(imageUrl, questionNumber) { const t = this.elements.perguntaImagem; t && (imageUrl?.trim() ? (t.src = imageUrl, t.alt = `Imagem ilustrativa da questão ${questionNumber}`, t.loading = "lazy", this.showElement(t), t.onerror = () => { this.hideElement(t), console.warn(`Erro ao carregar imagem: ${imageUrl}`), t.onerror = null }) : (this.hideElement(t), t.src = "", t.alt = "")) }

    // --- Geração/Manipulação dos Botões de Resposta ---
     generateAnswerButtons(question, answerClickHandler) { const container = this.elements.respostasContainer; if (!container) return; container.innerHTML = ''; if (!question || !question.respostas?.length) { container.innerHTML = '<p class="error-message">Erro: Opções de resposta não encontradas.</p>'; return; } const hasAnswered = question.hasOwnProperty('respostaDada'); const answerBaseClass = 'question-display__answer-option'; question.respostas.forEach((answerText) => { const btn = document.createElement('button'); btn.className = answerBaseClass; btn.textContent = answerText; btn.disabled = hasAnswered; btn.style.cursor = hasAnswered ? 'default' : 'pointer'; btn.tabIndex = hasAnswered ? -1 : 0; if (hasAnswered) { this.markAnswerAsAlreadyDone(btn, question, answerText); } else if (answerClickHandler) { btn.onclick = () => answerClickHandler(answerText); } container.appendChild(btn); }); }
     markAnswerAsAlreadyDone(answerElement, question, answerText) { const t = "question-display__answer-option", e = `${t}--answered`, s = `${t}--correct`, i = `${t}--incorrect`; answerElement.classList.add(e), answerText === question.correta ? answerElement.classList.add(s) : answerText === question.respostaDada && answerElement.classList.add(i) }
     disableAnswers() { const t = "question-display__answer-option", e = `${t}--answered`; this.elements.respostasContainer?.querySelectorAll(`.${t}`).forEach((t => { t.onclick = null, t.disabled = !0, t.classList.add(e), t.style.cursor = "default", t.tabIndex = -1 })) }
     applyAnswerFeedback(selectedAnswerText, correctAnswerText, isCorrect) { const t = "question-display__answer-option", e = `${t}--correct`, s = `${t}--incorrect`; this.elements.respostasContainer?.querySelectorAll(`.${t}`).forEach((t => { const i = t.textContent; i === selectedAnswerText && t.classList.add(isCorrect ? e : s), isCorrect || i !== correctAnswerText || t.classList.add(e) })), this.elements.feedbackAcessivel && (this.elements.feedbackAcessivel.textContent = isCorrect ? "Resposta correta!" : "Resposta incorreta.") }

    // --- Barra de Progresso ---
     updateProgressBar(current, total) { const t = this.elements.progressContainer, e = this.elements.progressBarFill, s = this.elements.progressText; t && e && s && (total > 0 ? (e.style.width = `${Math.min(current, total) / total * 100}%`, s.textContent = `${current} / ${total}`, this.showElement(t), this.showElement(s)) : this.hideProgressBar()) }
     hideProgressBar() { this.hideElement(this.elements.progressContainer), this.hideElement(this.elements.progressText), this.elements.progressBarFill && (this.elements.progressBarFill.style.width = "0%"), this.elements.progressText && (this.elements.progressText.textContent = "") }

    // --- Botões de Navegação Anterior/Próxima ---
     updateNavigationButtons(isFirst, isLast, totalQuestions) { const t = this.elements.navigationButtons, e = this.elements.prevBtn, s = this.elements.nextBtn; t && e && s && (totalQuestions <= 0 ? this.hideElement(t) : (this.showElement(t), e.disabled = isFirst, s.disabled = !1, s.textContent = isLast ? "Ver Resultado" : "Próxima")) }

    // --- Grid de Navegação entre Questões ---
     renderQuestionGrid(questions, currentIndex, questionClickHandler) { const container = this.elements.questionGridContainer; if (!container) { console.warn("Container do grid de questões não encontrado."); return; } if (!questions?.length) { this.hideElement(container); return; } this.showElement(container); container.innerHTML = ''; const currentPage = Math.floor(currentIndex / this.QUESTOES_POR_PAGINA_GRID); const startIndex = currentPage * this.QUESTOES_POR_PAGINA_GRID; const endIndex = Math.min(startIndex + this.QUESTOES_POR_PAGINA_GRID, questions.length); const arrowBaseClass = 'question-grid__arrow'; const leftModifier = `${arrowBaseClass}--left`; const rightModifier = `${arrowBaseClass}--right`; const itemBaseClass = 'question-grid__item'; const currentModifier = `${itemBaseClass}--current`; const correctModifier = `${itemBaseClass}--correct`; const incorrectModifier = `${itemBaseClass}--incorrect`; container.appendChild(this._createGridArrow('prev', startIndex === 0, () => questionClickHandler(startIndex - 1), 'Página Anterior de Questões', [arrowBaseClass, leftModifier])); for (let i = startIndex; i < endIndex; i++) { const question = questions[i]; const gridItem = document.createElement('button'); gridItem.className = itemBaseClass; gridItem.textContent = i + 1; gridItem.dataset.index = i; gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`); gridItem.onclick = () => questionClickHandler(i); if (question.hasOwnProperty('respostaDada')) { const correct = question.respostaDada === question.correta; gridItem.classList.add(correct ? correctModifier : incorrectModifier); } if (i === currentIndex) { gridItem.classList.add(currentModifier); gridItem.setAttribute('aria-current', 'step'); } container.appendChild(gridItem); } container.appendChild(this._createGridArrow('next', endIndex >= questions.length, () => questionClickHandler(endIndex), 'Próxima Página de Questões', [arrowBaseClass, rightModifier])); }
     _createGridArrow(direction, disabled, clickHandler, ariaLabel, classList = []) { const arrowBtn = document.createElement('button'); arrowBtn.classList.add(...classList); arrowBtn.classList.add('u-is-circle'); arrowBtn.setAttribute('aria-label', ariaLabel); arrowBtn.disabled = disabled; arrowBtn.onclick = clickHandler; const svgNS = "http://www.w3.org/2000/svg"; const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("viewBox", "0 -960 960 960"); svg.setAttribute("fill", "currentColor"); const path = document.createElementNS(svgNS, "path"); const pathD = direction === 'prev' ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"; path.setAttribute("d", pathD); svg.appendChild(path); arrowBtn.appendChild(svg); return arrowBtn; }


    // --- Filtros de Categoria ---
     generateCategoryFilters(categories) { const container = this.elements.filtroCheckboxesScroll; if (!container) return; container.innerHTML = ''; const labelId = this.elements.filtroLabel?.id; const itemClass = 'category-filter__item'; const inputClass = 'category-filter__input'; const chipClass = 'category-filter__chip'; const createCheckboxItem = (id, value, text, checked = false) => { const div = document.createElement('div'); div.className = itemClass; const input = document.createElement('input'); input.type = 'checkbox'; input.id = id; input.name = 'categoria'; input.value = value; input.checked = checked; input.className = inputClass; if(labelId) input.setAttribute('aria-describedby', labelId); const label = document.createElement('label'); label.htmlFor = id; label.textContent = text; label.className = chipClass; div.append(input, label); return div; }; container.appendChild(createCheckboxItem('cat-todas', 'Todas', 'Todas', false)); categories.forEach(category => { const id = `cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; container.appendChild(createCheckboxItem(id, category, category, false)); }); this.updateFilterScrollArrows(); }
     getSelectedCategories() { const t = []; return this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:checked:not([value="Todas"])').forEach((e => t.push(e.value))), t }
     syncSelectAllCheckbox() { const t = this.elements.filtroCheckboxesScroll, e = t?.querySelector('input[value="Todas"]'), s = t?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])'); e && s?.length && (e.checked = ![...s].some((t => !t.checked))) }
     toggleAllCategories(isChecked) { this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').forEach((t => { t.checked !== isChecked && (t.checked = isChecked, t.dispatchEvent(new Event("change", { bubbles: !0 }))) })) }
     updateFilterScrollArrows() { const t = this.elements.filtroCheckboxesScroll, e = this.elements.catScrollLeft, s = this.elements.catScrollRight; if (window.innerWidth <= 768) return this.hideElement(e), this.hideElement(s), e && (e.disabled = !0), void(s && (s.disabled = !0)); if (!t || !e || !s) return this.hideElement(e), this.hideElement(s), e && (e.disabled = !0), void(s && (s.disabled = !0)); requestAnimationFrame((() => { if (!this.elements.filtroCheckboxesScroll || !this.elements.catScrollLeft || !this.elements.catScrollRight) return; const { scrollLeft: i, scrollWidth: l, clientWidth: n } = t; l > n + 2 ? (this.showElement(e), this.showElement(s), e.disabled = i <= 0, s.disabled = i + n >= l - 2) : (this.hideElement(e), this.hideElement(s), e.disabled = !0, s.disabled = !0) })) }
     scrollCategories(direction) { const t = this.elements.filtroCheckboxesScroll; t && t.scrollBy({ left: "left" === direction ? -.6 * t.clientWidth : .6 * t.clientWidth, behavior: "smooth" }) }

    // --- Pontuação ---
     updateScoreDisplay(points, correct, incorrect) { this.elements.pontuacaoDisplay && (this.elements.pontuacaoDisplay.textContent = points), this.elements.acertosNumDisplay && (this.elements.acertosNumDisplay.textContent = correct), this.elements.errosNumDisplay && (this.elements.errosNumDisplay.textContent = incorrect) }

    // --- Resultado Final ---
     showResults(userData, filteredQuestions, selectedCategories) { const card = this.elements.resultadoCard; console.log("[Debug] showResults chamado. Card encontrado:", card); if (!card) { console.error("showResults: Elemento do card de resultado não encontrado no cache."); return; } if (!userData) { console.error("showResults: Dados do usuário inválidos."); return; } this.hideQuizElements(); this.hideElement(this.elements.filtroContainer); if (this.elements.resultadoTitulo) this.elements.resultadoTitulo.textContent = this._generateResultTitle(filteredQuestions, selectedCategories); if (this.elements.resultadoPontos) this.elements.resultadoPontos.textContent = userData.pontos; if (this.elements.resultadoAcertos) this.elements.resultadoAcertos.textContent = userData.acertos; if (this.elements.resultadoErros) this.elements.resultadoErros.textContent = userData.erros; this.showElement(card); console.log(`[Debug] Mostrando resultadoCard. Classe hidden removida? ${!card.classList.contains(this.hiddenClassName)}`); this.elements.resultadoTitulo?.focus(); }
     _generateResultTitle(filteredQuestions, selectedCategories) { const t = filteredQuestions?.length ?? 0, e = this.elements.filtroCheckboxesScroll?.querySelectorAll(`input.${'category-filter__input'}[type="checkbox"]:not([value="Todas"])`).length ?? 0, s = this.elements.filtroCheckboxesScroll?.querySelector(`input.${'category-filter__input'}[value="Todas"]`); return 0 === t && selectedCategories.length > 0 ? "Nenhuma questão encontrada" : 0 === t ? "Nenhuma questão respondida" : s?.checked && e > 0 ? "Quiz de Todas as Categorias Concluído!" : 1 === selectedCategories.length ? `Quiz de "${selectedCategories[0]}" Concluído!` : selectedCategories.length === e && e > 0 ? `Quiz (Todas as ${selectedCategories.length} Categorias) Concluído!` : selectedCategories.length > 1 ? `Quiz de ${selectedCategories.length} Categorias Concluído!` : "Quiz Finalizado!" }
     hideResults() { this.hideElement(this.elements.resultadoCard) }

    // --- Modal de Confirmação ---
     toggleConfirmModal(show) { const overlay = this.elements.confirmEncerrarOverlay; if (!overlay) return; const visibleModifier = 'modal--visible'; if (show) { this.showElement(overlay); overlay.scrollTop; requestAnimationFrame(() => { overlay.classList.add(visibleModifier); this.elements.cancelEncerrarBtn?.focus(); }); } else { overlay.classList.remove(visibleModifier); overlay.addEventListener('transitionend', () => { if (!overlay.classList.contains(visibleModifier)) { this.hideElement(overlay); } }, { once: true }); } }

    // --- Scroll e Foco ---
     scrollToQuestionStart() { const t = this.elements.questionTitle; "question-section" === this.currentSection && t ? t.scrollIntoView({ behavior: "smooth", block: "nearest" }) : "question-section" === this.currentSection && console.warn("scrollToQuestionStart: Título da questão não encontrado.") }
     focusNextButton(preventScroll = false) { this.elements.nextBtn?.focus({ preventScroll }) }
     smoothScrollToNextButton() { const t = this.elements.navigationButtons; t && t.scrollIntoView({ behavior: "smooth", block: "nearest" }) }
}


// --- Módulo: QuizLogic ---
class QuizLogic { constructor(quizState, quizUI, userData) { this.state = quizState; this.ui = quizUI; this.user = userData; } startQuiz() { this.user.reset(), this.state.filterQuestions(), this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros), this.ui.hideResults(); const t = this.state.filteredQuestions, e = this.state.selectedCategories; t.length > 0 ? (this.ui.displayQuizContent(!0), this._displayCurrentQuestion(!1)) : (this.ui.displayQuizContent(!1), this.ui.elements.filtroCheckboxesScroll?.querySelector('input[type="checkbox"]:not([value="Todas"])') ? 0 === e.length ? this.ui.showWarning("Selecione pelo menos uma categoria para começar.") : e.length > 0 && this.ui.showWarning("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).") : this.ui.showWarning("Nenhuma categoria de pergunta disponível para seleção.")) } handleCategoryChange() { const t = this.ui.getSelectedCategories(); this.state.setSelectedCategories(t), this.startQuiz() } answerQuestion(selectedAnswer) { const t = this.state.getCurrentQuestion(); this.state.recordAnswer(selectedAnswer) && (selectedAnswer === t.correta ? this.user.incrementarAcertos() : this.user.incrementarErros(), this.ui.disableAnswers(), this.ui.applyAnswerFeedback(selectedAnswer, t.correta, selectedAnswer === t.correta), this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros), this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (t => this.goToQuestion(t))), this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions()), this.ui.focusNextButton(!0), this.ui.smoothScrollToNextButton()) } nextQuestion() { const t = this.state.isLastQuestion(), e = this.state.getCurrentQuestion(); this.state.goToNextQuestion() ? this.state.isQuizComplete() ? this.endQuiz() : this._displayCurrentQuestion() : t && e?.hasOwnProperty("respostaDada") && this.endQuiz() } previousQuestion() { this.state.goToPreviousQuestion() && this._displayCurrentQuestion() } goToQuestion(index) { index >= this.state.getTotalFilteredQuestions() ? this.endQuiz() : this.state.goToQuestion(index) && this._displayCurrentQuestion() } async _displayCurrentQuestion(shouldScroll = true) { const t = this.ui.elements.questionWrap, e = this.state.isInitialQuestionLoad, s = () => { const t = this.state.getCurrentQuestion(); t ? (this.ui.displayQuestion(t, this.state.getCurrentQuestionNumberForDisplay(), this.state.getTotalFilteredQuestions(), this.state.selectedCategories), this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions()), this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (t => this.goToQuestion(t))), this.ui.generateAnswerButtons(t, (t => this.answerQuestion(t))), shouldScroll && this.ui.scrollToQuestionStart()) : (console.error("_displayCurrentQuestion: Questão inválida no índice:", this.state.currentQuestionIndex), this.endQuiz()) }; if (!e && t) { t.classList.add("is-fading-out"), await new Promise((e => { let s = !1; const i = () => { s || (t.removeEventListener("transitionend", i), s = !0, e()) }; t.addEventListener("transitionend", i), setTimeout((() => { s || (t.removeEventListener("transitionend", i), s = !0, e()) }), this.ui.TRANSITION_DURATION + 50) })), t.classList.remove("is-fading-out"), t.classList.add("is-transparent"), requestAnimationFrame((() => { s(), requestAnimationFrame((() => { t.classList.remove("is-transparent") })) })) } else s(), t?.classList.remove("is-fading-out", "is-transparent"), this.state.getTotalFilteredQuestions() > 0 && this.state.markNavigated() } endQuiz() { console.log("Quiz encerrado."); this.ui.showResults(this.user, this.state.filteredQuestions, this.state.selectedCategories) } restartQuiz() { console.log("Reiniciando quiz..."), this.startQuiz() } forceEndQuiz() { console.log("Forçando encerramento do quiz."), this.endQuiz(), this.ui.toggleConfirmModal(!1) } }


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
        try {
            const loaded = await this.quizData.loadQuestions();
            if (loaded && this.quizData.allQuestions.length > 0) {
                this.quizState.initialize(this.quizData.getQuestions());
                const categories = this.quizData.extractUniqueCategories();
                this.quizUI.generateCategoryFilters(categories);
                this.setupEventListeners();

                // Usa novos IDs de seção
                const initialActiveLink = document.querySelector('.main-nav__link--active, .bottom-nav__link--active');
                const initialSection = initialActiveLink?.dataset.section || 'home-section'; // Usa 'home-section' como padrão
                console.log(`[Debug] Seção Inicial Detectada: ${initialSection}`); // Log
                this.quizUI.showSection(initialSection);

                console.log("App inicializado com sucesso.");

                 if (initialSection === 'question-section') { // Usa novo ID
                     this.quizUI.updateFilterScrollArrows();
                 }

            } else if (loaded) {
                 console.warn("Arquivo de perguntas carregado, mas vazio ou inválido.");
                 this.quizUI.showSection('question-section'); // Usa novo ID
                 this.quizUI.showWarning("Não foi possível carregar as perguntas.");
                 this.disableCoreFunctionality();
            }
        } catch (error) {
            console.error("Falha crítica ao inicializar o App:", error);
            try {
                this.quizUI.showSection('question-section'); // Usa novo ID
                this.quizUI.showWarning(`Erro fatal ao carregar: ${error.message}. Por favor, recarregue a página.`);
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
        // Listener GERAL para navegação entre seções
        this.quizUI.elements.navElements?.forEach(navElement => {
            if (!navElement) return;
            navElement.addEventListener('click', (e) => {
                if (navElement.tagName === 'A') e.preventDefault();
                const targetSection = navElement.dataset.section;
                console.log(`[Debug] Clicou para ir para: ${targetSection}, Seção Atual: ${this.quizUI.currentSection}`); // Log
                if (targetSection && targetSection !== this.quizUI.currentSection) {
                     this.quizUI.showSection(targetSection);
                     if (targetSection === 'question-section') { // Usa novo ID
                          this.quizLogic.handleCategoryChange();
                     }
                }
            });
        });

        // --- Listeners Específicos ---
        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());
        this.quizUI.elements.catScrollLeft?.addEventListener('click', () => this.quizUI.scrollCategories('left'));
        this.quizUI.elements.catScrollRight?.addEventListener('click', () => this.quizUI.scrollCategories('right'));
        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('scroll', () => this.quizUI.updateFilterScrollArrows(), { passive: true });
        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => this.quizLogic.forceEndQuiz());
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => this.quizUI.toggleConfirmModal(false));
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (event) => { if (event.target === this.quizUI.elements.confirmEncerrarOverlay) { this.quizUI.toggleConfirmModal(false); } });
        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('change', (event) => { if (event.target.matches(`input.${'category-filter__input'}[type="checkbox"][name="categoria"]`)) { this.handleFilterChange(event.target); } });
        let resizeTimeout; window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(() => { this.quizUI.updateFilterScrollArrows(); }, 150); });
    }

    // Handler para mudança nos filtros
    handleFilterChange(changedCheckbox) { const container = this.quizUI.elements.filtroCheckboxesScroll; if (!container || !changedCheckbox) return; const isSelectAll = changedCheckbox.value === 'Todas'; if (isSelectAll) { this.quizUI.toggleAllCategories(changedCheckbox.checked); } else { this.quizUI.syncSelectAllCheckbox(); this.quizLogic.handleCategoryChange(); } this.quizUI.updateFilterScrollArrows(); }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});