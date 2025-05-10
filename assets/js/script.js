/**
 * script.js
 * - Implements a slide-out filter panel for categories and other potential filters.
 * - Loads data from separate JSON files: perguntas.json, categorias.json, opcoes_resposta.json.
 * - Supports hierarchical category display and selection in the filter panel.
 * - Quiz by Category flujo is now driven by "Apply Filters" from the panel.
 * - Quick Quiz remains N random questions.
 * - Includes a placeholder/guidance box before filters are applied.
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
    constructor(
        urlPerguntas = 'assets/data/perguntas.json',
        urlCategorias = 'assets/data/categorias.json',
        urlOpcoes = 'assets/data/opcoes_resposta.json'
    ) {
        this.urlPerguntas = urlPerguntas;
        this.urlCategorias = urlCategorias;
        this.urlOpcoes = urlOpcoes;
        this.perguntas = [];
        this.categorias = [];
        this.opcoesResposta = [];
    }

    async _fetchJson(url, required = true) {
        try {
            const t = Date.now(); // Cache buster
            const response = await fetch(`${url}?t=${t}`);
            if (!response.ok) {
                if (required) throw new Error(`Falha ao carregar ${url}: ${response.status} ${response.statusText}`);
                console.warn(`Aviso: Falha ao carregar ${url}. Retornando array vazio.`);
                return [];
            }
            const data = await response.json();
            if (!Array.isArray(data) && required && data !== null) {
                 throw new Error(`Formato de dados inválido em ${url} (esperava um Array ou null). Recebido: ${typeof data}`);
            }
            return data || [];
        } catch (error) {
            if (required) throw error;
            console.warn(`Erro ao processar ${url}: ${error.message}. Retornando array vazio.`);
            return [];
        }
    }

    async loadAllData() {
        try {
            const [perguntasData, categoriasData, opcoesData] = await Promise.all([
                this._fetchJson(this.urlPerguntas),
                this._fetchJson(this.urlCategorias),
                this._fetchJson(this.urlOpcoes)
            ]);
            this.perguntas = Array.isArray(perguntasData) ? perguntasData : [];
            this.categorias = Array.isArray(categoriasData) ? categoriasData : [];
            this.opcoesResposta = Array.isArray(opcoesData) ? opcoesData : [];

            if (!this.perguntas.length) console.warn("Nenhuma pergunta foi carregada. Verifique o arquivo perguntas.json.");
            if (!this.categorias.length) console.warn("Nenhuma categoria foi carregada. Verifique o arquivo categorias.json.");
            if (!this.opcoesResposta.length && this.perguntas.length > 0) console.warn("Nenhuma opção de resposta foi carregada, mas existem perguntas.");

            this._validateDataIntegrity();
            console.log(`Dados carregados: ${this.perguntas.length}p, ${this.categorias.length}c, ${this.opcoesResposta.length}o.`);
            return true;
        } catch (error) {
            console.error("Erro CRÍTICO ao carregar dados JSON:", error);
            this._resetProcessedData();
            throw error;
        }
    }

    _resetProcessedData() { this.perguntas = []; this.categorias = []; this.opcoesResposta = []; }

    _validateDataIntegrity() {
        let issues = 0;
        if (!this.perguntas || !this.categorias || !this.opcoesResposta) { console.error("Dados base não carregados."); issues++; return; }
        this.perguntas.forEach(p => {
            if (typeof p.id_pergunta !== 'number' || !p.texto_pergunta || !Array.isArray(p.categoria_ids)) { console.warn(`P inválida: ID ${p.id_pergunta || '?'}`); issues++; }
            p.categoria_ids.forEach(catId => { if (!this.categorias.find(c => c.id_categoria === catId)) { console.warn(`P${p.id_pergunta} ref. catID ${catId} inexistente.`); issues++; } });
            const opts = this.opcoesResposta.filter(o => o.id_pergunta === p.id_pergunta);
            if (opts.length < 2) { console.warn(`P${p.id_pergunta} poucas/nenhuma opção.`); issues++; }
            if (!opts.some(o => o.eh_correta === true)) { console.warn(`P${p.id_pergunta} sem opção correta.`); issues++; }
        });
        this.opcoesResposta.forEach(o => { if (!this.perguntas.find(p => p.id_pergunta === o.id_pergunta)) { console.warn(`Opt ${o.id_opcao_resposta} ref. P${o.id_pergunta} inexistente.`); issues++; } });
        this.categorias.forEach(c => { if (c.id_categoria_pai !== null && !this.categorias.find(p_cat => p_cat.id_categoria === c.id_categoria_pai)) { console.warn(`Cat ${c.id_categoria} ("${c.nome_categoria}") ref. paiID ${c.id_categoria_pai} inexistente.`); issues++; } });
        if (issues > 0) console.error(`${issues} problemas de integridade! Verifique JSONs e logs.`); else console.log("Validação de dados OK.");
    }

    getPerguntas() { return [...this.perguntas]; }
    getCategorias() { return [...this.categorias]; }
    getCategoriasHierarquicamente() {
        if (!this.categorias || this.categorias.length === 0) return [];
        const catMap = new Map(this.categorias.map(cat => [cat.id_categoria, { ...cat, subcategorias: [] }]));
        const raizes = [];
        catMap.forEach(node => {
            if (node.id_categoria_pai === null) raizes.push(node);
            else { const pai = catMap.get(node.id_categoria_pai); if (pai) pai.subcategorias.push(node); else { /*console.warn(`Pai ${node.id_categoria_pai} não encontrado para ${node.nome_categoria}.`);*/ raizes.push(node);}}
        });
        const sortRec = (nodes) => { nodes.sort((a,b)=>a.nome_categoria.localeCompare(b.nome_categoria)).forEach(n=>n.subcategorias.length && sortRec(n.subcategorias)); };
        sortRec(raizes);
        return raizes;
    }
    getOpcoesPorPerguntaId(id) { return this.opcoesResposta.filter(op => op.id_pergunta === id).sort((a,b) => (a.ordem_exibicao||0) - (b.ordem_exibicao||0)); }
    getRelacaoPerguntaCategorias() { const r = []; this.perguntas.forEach(p => p.categoria_ids?.forEach(cId => this.categorias.some(c=>c.id_categoria===cId) && r.push({id_pergunta:p.id_pergunta, id_categoria:cId}))); return r; }
}

// --- Módulo: QuizState ---
class QuizState {
    constructor() { this.allQuestions = []; this.filteredQuestions = []; this.currentQuestionIndex = 0; this.selectedCategories = []; this.selectedDifficulty = 'all'; this.isInitialQuestionLoad = true; this.isQuickQuizMode = false; this.QUICK_QUIZ_COUNT = 10; }
    initialize(p) { this.allQuestions = p; this.resetQuizState(); }
    resetQuizState() { this.filteredQuestions = []; this.currentQuestionIndex = 0; this.isInitialQuestionLoad = true; this.allQuestions.forEach(q => { delete q.respostaDadaId; delete q.foiCorretaNaSessao; }); }
    fullReset() { this.resetQuizState(); this.selectedCategories = []; this.isQuickQuizMode = false; this.selectedDifficulty = 'all'; }
    setQuickQuizMode(isQuick) { this.isQuickQuizMode = isQuick; }
    setFilters(selectedCategories = [], selectedDifficulty = 'all') { this.selectedCategories = Array.isArray(selectedCategories) ? selectedCategories : []; this.selectedDifficulty = selectedDifficulty; }
    filterQuestions(todasCategorias, relacaoPerguntaCategorias) {
        this.resetQuizState();
        if (this.isQuickQuizMode) {
            if (!this.allQuestions.length) { this.filteredQuestions = []; return this.filteredQuestions; }
            const shuffled = [...this.allQuestions].sort(() => 0.5 - Math.random());
            this.filteredQuestions = shuffled.slice(0, Math.min(this.QUICK_QUIZ_COUNT, shuffled.length));
        } else {
            let perguntasPotenciais = [...this.allQuestions];
            if (this.selectedCategories.length > 0) {
                const idsCatRelevantes = new Set();
                const getDescendentes = (catIdNum) => { if (idsCatRelevantes.has(catIdNum) || !todasCategorias.find(c=>c.id_categoria === catIdNum)) return; idsCatRelevantes.add(catIdNum); todasCategorias.filter(c => c.id_categoria_pai === catIdNum).forEach(sub => getDescendentes(sub.id_categoria)); };
                this.selectedCategories.forEach(selCatIdStr => { const id = parseInt(selCatIdStr); if(!isNaN(id)) getDescendentes(id); });
                const idsPerguntasComCat = new Set(relacaoPerguntaCategorias.filter(pc => idsCatRelevantes.has(pc.id_categoria)).map(pc => pc.id_pergunta));
                perguntasPotenciais = perguntasPotenciais.filter(p => idsPerguntasComCat.has(p.id_pergunta));
            }
            if (this.selectedDifficulty && this.selectedDifficulty !== 'all') {
                perguntasPotenciais = perguntasPotenciais.filter(p => p.nivel_dificuldade && p.nivel_dificuldade.toLowerCase() === this.selectedDifficulty.toLowerCase());
            }
            this.filteredQuestions = perguntasPotenciais;
        }
        return this.filteredQuestions;
    }
    getCurrentQuestion() { return this.filteredQuestions[this.currentQuestionIndex] ?? null; }
    getCurrentQuestionNumberForDisplay() { return this.currentQuestionIndex + 1; }
    getTotalFilteredQuestions() { return this.filteredQuestions.length; }
    isQuizComplete() { return this.currentQuestionIndex >= this.filteredQuestions.length; }
    isFirstQuestion() { return 0 === this.currentQuestionIndex; }
    isLastQuestion() { return this.currentQuestionIndex === this.filteredQuestions.length - 1; }
    recordAnswer(opId) { const cq = this.getCurrentQuestion(); if (cq && !cq.hasOwnProperty('respostaDadaId')) { cq.respostaDadaId = opId; return true; } return false; }
    markNavigated() { this.isInitialQuestionLoad = false; }
    goToQuestion(idx) { return idx >= 0 && idx < this.filteredQuestions.length ? (this.currentQuestionIndex = idx, this.markNavigated(), true) : false; }
    goToNextQuestion() { return this.currentQuestionIndex < this.filteredQuestions.length ? (this.currentQuestionIndex++, this.markNavigated(), true) : false; }
    goToPreviousQuestion() { return this.currentQuestionIndex > 0 ? (this.currentQuestionIndex--, this.markNavigated(), true) : false; }
}

// --- Módulo: LayoutManager ---
class LayoutManager { constructor() { this.footerElement = document.getElementById('footer') || document.querySelector('.site-footer'); this.hiddenClassName = 'u-is-hidden'; if (!this.footerElement) { console.warn("LayoutManager: Footer element not found!"); } } handleSectionChange(sectionId, previousSectionId) { if (!this.footerElement) return; if (sectionId === 'question-section') { this.footerElement.classList.add(this.hiddenClassName); } else { this.footerElement.classList.remove(this.hiddenClassName); } } }

// --- Módulo: QuizUI ---
class QuizUI {
    constructor(onSectionChangeCallback = null) {
        this.hiddenClassName = 'u-is-hidden';
        this.currentSection = 'home-section';
        this.QUESTOES_POR_PAGINA_GRID = 5;
        this.TRANSITION_DURATION = 350;
        this.onSectionChange = onSectionChangeCallback;
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.timerRunning = false;
        this.focusedElementBeforePanel = null;
        this.cacheDOMelements();
    }

    cacheDOMelements() {
        this.elements = {
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'),
            accountSection: document.getElementById('account-section'),
            navElements: document.querySelectorAll('[data-section]'),
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),
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
            startRandomQuiz: document.getElementById('start-random-quiz'),
            btnAbrirFiltros: document.getElementById('btn-abrir-filtros'),
            filterPanel: document.getElementById('filter-panel'),
            btnFecharFiltros: document.getElementById('btn-fechar-filtros'),
            filterPanelOverlay: document.getElementById('filter-panel-overlay'),
            categoryTreeList: document.getElementById('category-tree-list'),
            btnCatSelectAll: document.getElementById('btn-cat-select-all'),
            btnCatClearAll: document.getElementById('btn-cat-clear-all'),
            btnLimparFiltrosPainel: document.getElementById('btn-limpar-filtros-painel'),
            btnAplicarFiltrosPainel: document.getElementById('btn-aplicar-filtros-painel'),
            filterGroupDifficulty: document.getElementById('filter-group-difficulty'),
            filteredQuestionCountDisplay: document.getElementById('filtered-question-count-display'),
            // Cache do novo placeholder e seu botão interno
            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),
            startRandomQuizPlaceholderBtn: document.getElementById('start-random-quiz-placeholder'),
        };
        this.sectionElements = { 'home-section': this.elements.homeSection, 'question-section': this.elements.questionSection, 'account-section': this.elements.accountSection };
        this._validateCache();
    }

    _validateCache() { const opt = ['feedbackAcessivel', 'filterGroupDifficulty', 'placeholderFiltrosContainer', 'startRandomQuizPlaceholderBtn']; for (const k in this.elements) { if (!this.elements[k] && !opt.includes(k) && !(k in this.sectionElements)) console.warn(`QuizUI Cache: ${k} não encontrado!`); } for (const k in this.sectionElements) if(!this.sectionElements[k]) console.warn(`QuizUI Cache: Seção ${k} não encontrada!`);}

    showElement(el) { el?.classList.remove(this.hiddenClassName); }
    hideElement(el) { el?.classList.add(this.hiddenClassName); }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerRunning = false;
        console.log("Timer parado.");
    }

    resetTimer() {
        this.stopTimer();
        this.timerSeconds = 0;
        if (this.elements.timerDisplay) {
            this.elements.timerDisplay.textContent = "00:00";
        }
        if (this.elements.resultadoTempo && !this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
            this.elements.resultadoTempo.textContent = "00:00";
        }
        console.log("Timer resetado.");
    }

    startTimer() {
        if (this.timerRunning) return;
        this.timerRunning = true;
        console.log("Timer iniciado.");
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = this._formatDisplayTime(this.timerSeconds);
            }
        }, 1000);
    }

    _formatDisplayTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    updateScoreDisplay(pontos, acertos, erros) {
        if (this.elements.pontuacaoDisplay) this.elements.pontuacaoDisplay.textContent = pontos;
        if (this.elements.acertosNumDisplay) this.elements.acertosNumDisplay.textContent = acertos;
        if (this.elements.errosNumDisplay) this.elements.errosNumDisplay.textContent = erros;
    }

    toggleFilterPanel(show) {
        const { filterPanel: panel, filterPanelOverlay: overlay } = this.elements;
        if (!panel || !overlay) { console.error("Painel de filtros ou overlay não encontrado."); return; }

        const panelVisibleClass = 'filter-panel--visible';
        const overlayVisibleClass = 'filter-panel-overlay--visible';

        if (show) {
            this.focusedElementBeforePanel = document.activeElement;
            if (this.quizState) {
                 const currentSelectedCategories = this.quizState.selectedCategories;
                 const currentDifficulty = this.quizState.selectedDifficulty;
                 this.setCategoryTreeState(currentSelectedCategories);
                 this.setDifficultyState(currentDifficulty);
            }

            this.showElement(overlay); this.showElement(panel);
            panel.removeAttribute('aria-hidden'); overlay.removeAttribute('aria-hidden');
            requestAnimationFrame(() => { overlay.classList.add(overlayVisibleClass); panel.classList.add(panelVisibleClass); panel.focus(); });
        } else {
            panel.classList.remove(panelVisibleClass); overlay.classList.remove(overlayVisibleClass);
            const onEnd = () => {
                if (!panel.classList.contains(panelVisibleClass)) { this.hideElement(panel); this.hideElement(overlay); panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true'); }
                panel.removeEventListener('transitionend', onEnd);
                this.focusedElementBeforePanel?.focus();
            };
            panel.addEventListener('transitionend', onEnd, { once: true });
            setTimeout(() => { if (!panel.classList.contains(panelVisibleClass)) { this.hideElement(panel); this.hideElement(overlay); panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true'); this.focusedElementBeforePanel?.focus(); } panel.removeEventListener('transitionend', onEnd); }, this.TRANSITION_DURATION + 50);
        }
    }

    getSectionUIConfig() {
        return {
            'home-section': {
                visible: [],
                hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.btnAbrirFiltros, this.elements.filteredQuestionCountDisplay, this.elements.placeholderFiltrosContainer],
                onEnter: null
            },
            'question-section': {
                visible: [this.elements.btnAbrirFiltros, this.elements.filteredQuestionCountDisplay, this.elements.placeholderFiltrosContainer], // Placeholder visível por padrão
                hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText /* avisoContainer tem lógica própria */],
                onEnter: () => {
                    // Lógica adicional ao entrar na seção de questões, se necessário
                    // Por exemplo, garantir que o placeholder seja mostrado se nenhum quiz estiver ativo
                    if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                        this.elements.avisoContainer?.classList.contains(this.hiddenClassName)) {
                        this.showElement(this.elements.placeholderFiltrosContainer);
                    }
                }
            },
            'account-section': {
                visible: [],
                hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.btnAbrirFiltros, this.elements.filteredQuestionCountDisplay, this.elements.placeholderFiltrosContainer],
                onEnter: null
            }
        };
    }

    showSection(sectionId) {
        console.log(`[Log] Tentando mostrar seção: ${sectionId}`);
        Object.values(this.sectionElements).forEach(sectionEl => { if (sectionEl) this.hideElement(sectionEl); });
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
                console.warn(`Configuração de UI para '${sectionId}' não encontrada.`);
            }

            if (sectionId !== 'question-section') {
                this.clearWarning(); // Limpa avisos e, por consequência, placeholder se estiver na question-section
                this.hideElement(this.elements.placeholderFiltrosContainer); // Garante que placeholder está escondido fora da question-section
                this.toggleFilterPanel(false);
            } else {
                // Se estamos na question-section, e nenhum quiz/aviso está ativo, o placeholder deve aparecer
                if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                    this.elements.avisoContainer?.classList.contains(this.hiddenClassName) &&
                    this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                    this.showElement(this.elements.placeholderFiltrosContainer);
                }
            }

            if (this.onSectionChange && typeof this.onSectionChange === 'function' && previousSection !== sectionId) {
                try { this.onSectionChange(sectionId, previousSection); } catch (error) { console.error("Erro no onSectionChange:", error); }
            }
        } else {
            console.error(`QuizUI.showSection: Seção ID '${sectionId}' NÃO ENCONTRADA.`);
        }
    }

    _updateActiveNavLinks(activeSectionId) { this.elements.navElements?.forEach(t => { if (t) { const e = t.dataset.section === activeSectionId, s = "main-nav__link", i = "bottom-nav__link", n = "--active"; t.classList.remove(`${s}${n}`, `${i}${n}`); e ? (t.classList.contains(s) ? t.classList.add(`${s}${n}`) : t.classList.contains(i) && t.classList.add(`${i}${n}`), t.setAttribute("aria-current", "page")) : t.removeAttribute("aria-current"); } }); }

    showWarning(message) {
        const t = this.elements.avisoContainer, e = this.elements.avisoMensagem;
        if (t && e) {
            e.textContent = message;
            e.setAttribute("role", "alert");
            this.showElement(t);
            this.hideElement(this.elements.placeholderFiltrosContainer); // Esconde placeholder ao mostrar aviso
            if (this.currentSection === "question-section") this.hideQuizElements();
        }
    }

    clearWarning() {
        this.hideElement(this.elements.avisoContainer);
        this.elements.avisoMensagem?.removeAttribute("role");
        // Reavalia se o placeholder deve ser mostrado
        if (this.currentSection === "question-section" &&
            this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
            this.elements.resultadoCard?.classList.contains(this.hiddenClassName) ) {
            this.showElement(this.elements.placeholderFiltrosContainer);
        }
    }

    displayQuizContent(show = true) {
        if (show) {
            this.showElement(this.elements.quizSectionContent);
            this.showElement(this.elements.btnEncerrarSessao);
            this.showElement(this.elements.progressContainer);
            this.showElement(this.elements.progressText);
            this.showElement(this.elements.questionGridContainer);
            this.clearWarning(); // Limpa avisos
            this.hideElement(this.elements.placeholderFiltrosContainer); // Esconde o placeholder
            this.hideElement(this.elements.resultadoCard);
            this.hideElement(this.elements.btnAbrirFiltros);
            this.hideElement(this.elements.filteredQuestionCountDisplay);
        } else { // Escondendo conteúdo do quiz (ex: ao encerrar, antes de mostrar resultados ou filtros)
            this.hideElement(this.elements.quizSectionContent);
            this.hideElement(this.elements.btnEncerrarSessao);
            this.hideProgressBar();
            this.hideElement(this.elements.questionGridContainer);
            // Mostra controles de filtro novamente
            this.showElement(this.elements.btnAbrirFiltros);
            this.showElement(this.elements.filteredQuestionCountDisplay);
            // Se nenhum aviso estiver ativo, mostra o placeholder
            if (this.elements.avisoContainer?.classList.contains(this.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.hiddenClassName) ) { // E se resultados também não estiverem visíveis
                this.showElement(this.elements.placeholderFiltrosContainer);
            }
        }
    }

    hideQuizElements() { this.hideElement(this.elements.quizSectionContent); this.hideElement(this.elements.resultadoCard); this.hideElement(this.elements.questionGridContainer); this.hideElement(this.elements.btnEncerrarSessao); this.hideProgressBar(); }
    displayQuestion(perguntaObj, questionNumber, totalQuestions, todasCategoriasDoSistema, relacaoPerguntaCategorias, isQuickQuizMode = false) {
        if (!perguntaObj) return console.error("Tentativa de exibir questão nula.");
        let tituloCategoriaDisplay = "Questão";
        if (isQuickQuizMode) {
            tituloCategoriaDisplay = "Quiz Rápido";
        } else {
            const idsCatDaPergunta = relacaoPerguntaCategorias.filter(pc => pc.id_pergunta === perguntaObj.id_pergunta).map(pc => pc.id_categoria);
            if (idsCatDaPergunta.length > 0) {
                let catIdParaHierarquia = idsCatDaPergunta[0];
                if (idsCatDaPergunta.length > 0) {
                    const categoriasDaPerguntaObjs = todasCategoriasDoSistema.filter(c => idsCatDaPergunta.includes(c.id_categoria));
                    if (categoriasDaPerguntaObjs.length > 0) {
                        const maisEspecifica = categoriasDaPerguntaObjs.reduce((maisProfunda, atual) => {
                            const profundidadeMP = this._getCategoriaProfundidade(maisProfunda, todasCategoriasDoSistema);
                            const profundidadeA = this._getCategoriaProfundidade(atual, todasCategoriasDoSistema);
                            return profundidadeA > profundidadeMP ? atual : maisProfunda;
                        }, categoriasDaPerguntaObjs[0]);
                        catIdParaHierarquia = maisEspecifica.id_categoria;
                    }
                }
                let caminhoCategoria = []; let catAtualId = catIdParaHierarquia; let countNiveis = 0;
                while(catAtualId !== null && catAtualId !== undefined && countNiveis < 5) {
                    const catObj = todasCategoriasDoSistema.find(c => c.id_categoria === catAtualId);
                    if (catObj) { caminhoCategoria.unshift(catObj.nome_categoria); catAtualId = catObj.id_categoria_pai; }
                    else { break; }
                    countNiveis++;
                }
                tituloCategoriaDisplay = caminhoCategoria.length > 0 ? caminhoCategoria.join(' › ') : "Categorias";
            }
        }
        if (this.elements.categoriaTitulo) this.elements.categoriaTitulo.innerText = tituloCategoriaDisplay;
        if (this.elements.idQuestao) this.elements.idQuestao.innerText = questionNumber;
        if (this.elements.perguntaTexto) this.elements.perguntaTexto.textContent = perguntaObj.texto_pergunta;
        if (this.elements.referenciaQuestao) this.elements.referenciaQuestao.textContent = `Referência: ${perguntaObj.referencia_bibliografica || "N/A"}`;
        this.displayQuestionImage(perguntaObj.url_imagem, questionNumber);
        this.updateProgressBar(questionNumber, totalQuestions);
        this.elements.questionTitle?.focus({ preventScroll: true });
    }
    _getCategoriaProfundidade(categoriaObj, todasCategorias) {
        if(!categoriaObj || !todasCategorias) return -1;
        let profundidade = 0; let paiId = categoriaObj.id_categoria_pai;
        while(paiId !== null && profundidade < 10) { profundidade++; const pai = todasCategorias.find(c => c.id_categoria === paiId); paiId = pai ? pai.id_categoria_pai : null; }
        return profundidade;
    }
    displayQuestionImage(imageUrl, qNum) { const el = this.elements.perguntaImagem; if(el){ if(imageUrl?.trim()){ el.src=imageUrl; el.alt=`Ilustração questão ${qNum}`; this.showElement(el); el.onerror=()=>{this.hideElement(el); console.warn(`Erro img: ${imageUrl}`); el.onerror=null;}} else {this.hideElement(el); el.src=""; el.alt="";}}}
    generateAnswerButtons(idPergunta, opcoesDaPergunta, respostaDadaId, answerClickHandler) {
        const container = this.elements.respostasContainer; if (!container) return; container.innerHTML = '';
        if (!opcoesDaPergunta || opcoesDaPergunta.length === 0) { container.innerHTML = `<p class="error-message">Opções para P${idPergunta} não encontradas.</p>`; return; }
        const hasAnswered = typeof respostaDadaId !== 'undefined' && respostaDadaId !== null;
        const baseClass = 'question-display__answer-option';
        opcoesDaPergunta.forEach(opcao => {
            const btn = document.createElement('button'); btn.className = baseClass; btn.textContent = opcao.texto_opcao; btn.dataset.opcaoId = opcao.id_opcao_resposta.toString(); btn.disabled = hasAnswered; btn.style.cursor = hasAnswered ? 'default' : 'pointer'; btn.tabIndex = hasAnswered ? -1 : 0;
            if (hasAnswered) { btn.classList.add(`${baseClass}--answered`); if (opcao.eh_correta) { btn.classList.add(`${baseClass}--correct`); } else if (opcao.id_opcao_resposta === respostaDadaId) { btn.classList.add(`${baseClass}--incorrect`); } }
            else if (answerClickHandler) { btn.onclick = () => answerClickHandler(opcao.id_opcao_resposta); }
            container.appendChild(btn);
        });
    }
    disableAnswers() { const t = "question-display__answer-option", e = `${t}--answered`; this.elements.respostasContainer?.querySelectorAll(`button.${t}`).forEach(btn => { btn.onclick = null; btn.disabled = true; btn.classList.add(e); btn.style.cursor = "default"; btn.tabIndex = -1; }); }
    applyAnswerFeedback(selectedOpcaoId, opcoesDaPergunta) {
        const baseClass = "question-display__answer-option", correctCl = `${baseClass}--correct`, incorrectCl = `${baseClass}--incorrect`; let isUserChoiceCorrect = false;
        this.elements.respostasContainer?.querySelectorAll(`button.${baseClass}`).forEach(btn => {
            const btnOpId = parseInt(btn.dataset.opcaoId); const optData = opcoesDaPergunta.find(op => op.id_opcao_resposta === btnOpId); if (!optData) return;
            if (btnOpId === selectedOpcaoId) { if (optData.eh_correta) { btn.classList.add(correctCl); isUserChoiceCorrect = true; } else { btn.classList.add(incorrectCl); } }
            else if (optData.eh_correta) { btn.classList.add(correctCl); }
        });
        if (this.elements.feedbackAcessivel) this.elements.feedbackAcessivel.textContent = isUserChoiceCorrect ? "Resposta correta!" : "Resposta incorreta.";
    }
    updateProgressBar(curr, total) { const elP = this.elements.progressContainer, elF = this.elements.progressBarFill, elT = this.elements.progressText; if(elP && elF && elT){ if(total > 0){ elF.style.width = `${Math.min(curr,total)/total*100}%`; elT.textContent = `${curr} / ${total}`; this.showElement(elP); this.showElement(elT); } else this.hideProgressBar();}}
    hideProgressBar() { this.hideElement(this.elements.progressContainer); this.hideElement(this.elements.progressText); if(this.elements.progressBarFill) this.elements.progressBarFill.style.width = "0%"; if(this.elements.progressText) this.elements.progressText.textContent = ""; }
    updateNavigationButtons(isFirst, isLast, total) { const elN = this.elements.navigationButtons, elP = this.elements.prevBtn, elNext = this.elements.nextBtn; if(elN && elP && elNext){ if(total <=0) this.hideElement(elN); else { this.showElement(elN); elP.disabled = isFirst; elNext.disabled = false; elNext.textContent = isLast ? "Ver Resultado" : "Próxima";}}}
    renderQuestionGrid(perguntas, currIdx, clickHandler) { const container = this.elements.questionGridContainer; if (!container) { console.warn("Grid de questões não encontrado."); return; } if (!perguntas?.length) { this.hideElement(container); return; } this.showElement(container); container.innerHTML = ''; const page = Math.floor(currIdx / this.QUESTOES_POR_PAGINA_GRID); const start = page * this.QUESTOES_POR_PAGINA_GRID; const end = Math.min(start + this.QUESTOES_POR_PAGINA_GRID, perguntas.length); const arrBase = 'question-grid__arrow', itBase = 'question-grid__item', itCurr = `${itBase}--current`, itCorr = `${itBase}--correct`, itInc = `${itBase}--incorrect`; container.appendChild(this._createGridArrow('prev', start === 0, () => clickHandler(Math.max(0, start - 1)), 'Página Anterior', [arrBase, `${arrBase}--left`])); for (let i = start; i < end; i++) { const p = perguntas[i]; const item = document.createElement('button'); item.className = itBase; item.textContent = i + 1; item.dataset.index = i.toString(); item.setAttribute('aria-label', `Questão ${i + 1}`); item.onclick = () => clickHandler(i); if (p.hasOwnProperty('respostaDadaId') && p.respostaDadaId !== null) { if (p.foiCorretaNaSessao === true) item.classList.add(itCorr); else if (p.foiCorretaNaSessao === false) item.classList.add(itInc); } if (i === currIdx) { item.classList.add(itCurr); item.setAttribute('aria-current', 'step'); } container.appendChild(item); } container.appendChild(this._createGridArrow('next', end >= perguntas.length, () => clickHandler(Math.min(perguntas.length -1, end)), 'Próxima Página', [arrBase, `${arrBase}--right`])); }
    _createGridArrow(dir, dis, click, label, classes = []) { const btn = document.createElement('button'); btn.classList.add(...classes); btn.classList.add('u-is-circle'); btn.setAttribute('aria-label', label); btn.disabled = dis; btn.onclick = click; const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 -960 960 960"); svg.setAttribute("fill", "currentColor"); const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", dir === 'prev' ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"); svg.appendChild(path); btn.appendChild(svg); return btn; }

    generateCategoryTree(categoriasHierarquicas) {
        const treeContainer = this.elements.categoryTreeList;
        if (!treeContainer) { console.error("Contêiner da árvore de categorias (#category-tree-list) não encontrado."); return; }
        treeContainer.innerHTML = '';

        const createTreeRecursive = (categorias, parentElement, nivel = 0) => {
            categorias.forEach(cat => {
                const li = document.createElement('li');
                li.className = 'category-tree__item';
                li.setAttribute('role', 'treeitem');
                li.setAttribute('aria-checked', 'false');

                const wrapper = document.createElement('div');
                wrapper.className = 'category-tree__label-wrapper';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `cat-tree-${cat.id_categoria}`;
                input.className = 'category-tree__input u-sr-only';
                input.value = cat.id_categoria.toString();
                input.tabIndex = -1;
                input.addEventListener('change', (e) => this.handleCategoryCheckboxChange(e.target));


                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.className = 'category-tree__label';
                label.textContent = cat.nome_categoria;
                label.tabIndex = 0;
                label.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        input.checked = !input.checked;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        e.preventDefault();
                    }
                });

                if (cat.subcategorias && cat.subcategorias.length > 0) {
                    li.classList.add('category-tree__item--has-children');
                    li.setAttribute('aria-expanded', 'false');

                    const toggleBtn = document.createElement('button');
                    toggleBtn.type = 'button';
                    toggleBtn.className = 'category-tree__toggle';
                    toggleBtn.setAttribute('aria-label', `Expandir ${cat.nome_categoria}`);
                    toggleBtn.setAttribute('aria-expanded', 'false');
                    toggleBtn.innerHTML = `<span class="material-symbols-outlined">chevron_right</span>`;

                    wrapper.appendChild(toggleBtn);
                    wrapper.appendChild(input);
                    wrapper.appendChild(label);

                    const submenu = document.createElement('ul');
                    submenu.className = 'category-tree__submenu';
                    submenu.setAttribute('role', 'group');

                    createTreeRecursive(cat.subcategorias, submenu, nivel + 1);
                    li.appendChild(wrapper);
                    li.appendChild(submenu);

                    const toggleAction = (e) => {
                        e.stopPropagation();
                        const isExpanded = li.getAttribute('aria-expanded') === 'true';
                        li.setAttribute('aria-expanded', String(!isExpanded));
                        toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
                        toggleBtn.setAttribute('aria-label', `${!isExpanded ? 'Recolher' : 'Expandir'} ${cat.nome_categoria}`);
                        submenu.classList.toggle('category-tree__submenu--expanded');
                        if (!isExpanded) {
                            submenu.style.maxHeight = submenu.scrollHeight + "px";
                        } else {
                           requestAnimationFrame(() => { submenu.style.maxHeight = '0'; });
                        }
                        toggleBtn.querySelector('.material-symbols-outlined').textContent = !isExpanded ? 'expand_more' : 'chevron_right';
                    };
                    toggleBtn.addEventListener('click', toggleAction);
                } else {
                    wrapper.appendChild(input);
                    wrapper.appendChild(label);
                    li.appendChild(wrapper);
                }
                parentElement.appendChild(li);
            });
        };
        createTreeRecursive(categoriasHierarquicas, treeContainer);
        const parentLis = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
        for (let i = parentLis.length - 1; i >= 0; i--) {
            this.updateParentCheckboxState(parentLis[i]);
        }
    }

    handleCategoryCheckboxChange(checkbox) {
        const isChecked = checkbox.checked;
        const li = checkbox.closest('.category-tree__item');
        if (!li) return;

        checkbox.classList.remove('is-indeterminate');
        li.setAttribute('aria-checked', String(isChecked));

        const childCheckboxes = li.querySelectorAll(':scope > .category-tree__submenu .category-tree__input');
        childCheckboxes.forEach(childCb => {
            childCb.checked = isChecked;
            childCb.classList.remove('is-indeterminate');
             const childLi = childCb.closest('.category-tree__item');
             if(childLi) childLi.setAttribute('aria-checked', String(isChecked));
        });
        this.updateParentCheckboxState(li.parentElement?.closest('.category-tree__item'));
    }

    updateParentCheckboxState(parentLi) {
        if (!parentLi) return;

        const parentCheckbox = parentLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
        if (!parentCheckbox) return;

        const childLis = parentLi.querySelectorAll(':scope > .category-tree__submenu > .category-tree__item');
        if (childLis.length === 0) return;

        let allChecked = true;
        let noneChecked = true;
        let someIndeterminate = false;

        childLis.forEach(childLi => {
            const childInput = childLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
            if (childInput) {
                if (childInput.checked && !childInput.classList.contains('is-indeterminate')) {
                    noneChecked = false;
                } else if (childInput.classList.contains('is-indeterminate')) {
                    allChecked = false;
                    noneChecked = false;
                    someIndeterminate = true;
                } else {
                    allChecked = false;
                }
            } else {
                allChecked = false;
            }
        });

        parentCheckbox.classList.remove('is-indeterminate');
        if (someIndeterminate || (!allChecked && !noneChecked)) {
            parentCheckbox.checked = false;
            parentCheckbox.classList.add('is-indeterminate');
            parentLi.setAttribute('aria-checked', 'mixed');
        } else if (allChecked) {
            parentCheckbox.checked = true;
            parentLi.setAttribute('aria-checked', 'true');
        } else {
            parentCheckbox.checked = false;
            parentLi.setAttribute('aria-checked', 'false');
        }
        this.updateParentCheckboxState(parentLi.parentElement?.closest('.category-tree__item'));
    }

    getSelectedCategoriesFromTree() {
        const ids = [];
        this.elements.categoryTreeList?.querySelectorAll('.category-tree__input').forEach(cb => {
            if (cb.checked && !cb.classList.contains('is-indeterminate')) {
                ids.push(cb.value);
            }
        });
        return ids;
    }

    getSelectedDifficulty() {
        const selectedRadio = this.elements.filterGroupDifficulty?.querySelector('input[name="difficulty"]:checked');
        return selectedRadio ? selectedRadio.value : 'all';
    }

    setCategoryTreeState(selectedIds = []) {
        const allCheckboxes = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input') || []);
        allCheckboxes.forEach(cb => {
            cb.checked = selectedIds.includes(cb.value);
            cb.classList.remove('is-indeterminate');
        });
        const parentLis = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
        for (let i = parentLis.length - 1; i >= 0; i--) {
            this.updateParentCheckboxState(parentLis[i]);
        }
    }

    setDifficultyState(difficulty = 'all'){ const el = this.elements.filterGroupDifficulty?.querySelector(`input[name="difficulty"][value="${difficulty}"]`); if(el) el.checked = true; }
    updateFilteredQuestionCount(count) { if (this.elements.filteredQuestionCountDisplay) { this.elements.filteredQuestionCountDisplay.textContent = count > 0 ? `${count} questão(ões)` : "Nenhuma questão"; } }
    showResults(userData, totalFilteredQuestions) { const card = this.elements.resultadoCard; if (!card || !userData) return; this.hideQuizElements(); this.hideElement(this.elements.btnAbrirFiltros); this.hideElement(this.elements.filteredQuestionCountDisplay); this.hideElement(this.elements.placeholderFiltrosContainer); if (this.elements.resultadoTitulo) this.elements.resultadoTitulo.textContent = "Desempenho Final!"; if (this.elements.resultadoPontos) this.elements.resultadoPontos.textContent = userData.pontos; if (this.elements.resultadoAcertos) this.elements.resultadoAcertos.textContent = userData.acertos; if (this.elements.resultadoErros) this.elements.resultadoErros.textContent = userData.erros; if (this.elements.resultadoTempo) this.elements.resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds); if (this.elements.resultadoMensagemMotivacional) { const p = userData.pontos, t = totalFilteredQuestions; let m = "Continue praticando!"; if (t > 0) { const max = t * 15; if (p >= max * 0.8) m = "Excelente desempenho!"; else if (p >= max * 0.5) m = "Muito bom!"; } else if (p === 0 && userData.acertos === 0 && userData.erros === 0) m = "Nenhuma questão encontrada/respondida."; this.elements.resultadoMensagemMotivacional.textContent = m; } this.showElement(card); this.elements.resultadoTitulo?.focus(); }
    hideResults() { this.hideElement(this.elements.resultadoCard); }
    toggleConfirmModal(show) { const overlay = this.elements.confirmEncerrarOverlay; if (!overlay) return; const mod = 'modal--visible'; if (show) { this.showElement(overlay); overlay.scrollTop; requestAnimationFrame(() => { overlay.classList.add(mod); this.elements.cancelEncerrarBtn?.focus(); }); } else { overlay.classList.remove(mod); const end = () => { if (!overlay.classList.contains(mod)) this.hideElement(overlay); overlay.removeEventListener('transitionend', end); }; overlay.addEventListener('transitionend', end, {once:true}); setTimeout(() => { if (!overlay.classList.contains(mod)) this.hideElement(overlay); overlay.removeEventListener('transitionend', end); }, this.TRANSITION_DURATION + 50);}}
    scrollToQuestionStart() { const t = this.elements.questionTitle; if (this.currentSection === "question-section" && t) t.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    focusNextButton(prevScroll=false){this.elements.nextBtn?.focus({preventScroll:prevScroll});}
    smoothScrollToNextButton(){const t=this.elements.navigationButtons; t&&t.scrollIntoView({behavior:"smooth",block:"nearest"});}
}

// --- Módulo: QuizLogic ---
class QuizLogic {
    constructor(quizState, quizUI, userData, quizDataInstance) { this.state = quizState; this.ui = quizUI; this.user = userData; this.quizData = quizDataInstance; }
    applyFiltersAndStartQuiz() {
        console.log("Aplicando filtros e iniciando quiz...");
        const selectedCategoryIds = this.ui.getSelectedCategoriesFromTree();
        const selectedDifficulty = this.ui.getSelectedDifficulty();
        this.state.setQuickQuizMode(false);
        this.state.setFilters(selectedCategoryIds, selectedDifficulty);
        this.ui.toggleFilterPanel(false);
        this.startQuiz();
    }
    clearAllFiltersInPanel() { this.ui.setCategoryTreeState([]); this.ui.setDifficultyState('all'); this.ui.updateFilteredQuestionCount(this.state.allQuestions.length); console.log("Filtros limpos no painel."); }
    startQuiz() {
        this.user.reset();
        this.state.filterQuestions(this.quizData.getCategorias(), this.quizData.getRelacaoPerguntaCategorias());
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        const filteredQuestions = this.state.filteredQuestions;
        this.ui.updateFilteredQuestionCount(filteredQuestions.length);
        if (filteredQuestions.length > 0) {
            this.ui.displayQuizContent(true); // Esconde o placeholder
            this._displayCurrentQuestion(false);
            this.ui.startTimer();
        }
        else {
            this.ui.displayQuizContent(false); // Mostra o placeholder se nenhum aviso
            this.ui.showWarning(this.state.isQuickQuizMode ? "Nenhuma pergunta para Quiz Rápido." : "Nenhuma questão encontrada para os filtros. Tente outros.");
            this.ui.stopTimer();
        }
    }
    startQuickQuiz() { console.log("Iniciando Quiz Rápido..."); this.state.setQuickQuizMode(true); this.state.setFilters([], 'all'); this.ui.toggleFilterPanel(false); this.startQuiz(); }
    answerQuestion(selectedOpcaoId) {
        const currentQuestion = this.state.getCurrentQuestion(); if (!currentQuestion) return;
        const opcoesDaPergunta = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const opcaoSelecionada = opcoesDaPergunta.find(op => op.id_opcao_resposta === selectedOpcaoId);
        if (opcaoSelecionada && this.state.recordAnswer(selectedOpcaoId)) {
            currentQuestion.foiCorretaNaSessao = opcaoSelecionada.eh_correta;
            if (opcaoSelecionada.eh_correta) { this.user.incrementarAcertos(); } else { this.user.incrementarErros(); }
            this.ui.disableAnswers(); this.ui.applyAnswerFeedback(selectedOpcaoId, opcoesDaPergunta);
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.focusNextButton(true); this.ui.smoothScrollToNextButton();
        }
    }
    nextQuestion() { const i=this.state.isLastQuestion(), q=this.state.getCurrentQuestion(); if(this.state.goToNextQuestion()){ if(this.state.isQuizComplete())this.endQuiz(); else this._displayCurrentQuestion(); } else if(i && q?.hasOwnProperty('respostaDadaId'))this.endQuiz();}
    previousQuestion() { if (this.state.goToPreviousQuestion()) { this._displayCurrentQuestion(); } }
    goToQuestion(idx) { if (idx >= this.state.getTotalFilteredQuestions()) this.endQuiz(); else if (this.state.goToQuestion(idx)) this._displayCurrentQuestion(); }
    async _displayCurrentQuestion(shouldScroll = true) {
        const el = this.ui.elements.questionWrap, init = this.state.isInitialQuestionLoad;
        const logic = () => {
            const p = this.state.getCurrentQuestion();
            if(p){
                const opts = this.quizData.getOpcoesPorPerguntaId(p.id_pergunta);
                this.ui.displayQuestion(p,this.state.getCurrentQuestionNumberForDisplay(),this.state.getTotalFilteredQuestions(),this.quizData.getCategorias(),this.quizData.getRelacaoPerguntaCategorias(),this.state.isQuickQuizMode);
                this.ui.generateAnswerButtons(p.id_pergunta, opts, p.respostaDadaId, (opId)=>this.answerQuestion(opId));
                this.ui.updateNavigationButtons(this.state.isFirstQuestion(),this.state.isLastQuestion(),this.state.getTotalFilteredQuestions());
                this.ui.renderQuestionGrid(this.state.filteredQuestions,this.state.currentQuestionIndex,(idx)=>this.goToQuestion(idx));
                if(shouldScroll)this.ui.scrollToQuestionStart();
            } else { console.error("P inválida:", this.state.currentQuestionIndex); this.endQuiz(); }
        };
        if(!init && el){ el.classList.add("is-fading-out"); await new Promise(r=>{let t=!1; const h=()=>{if(!t){el.removeEventListener("transitionend",h);t=!0;r();}}; el.addEventListener("transitionend",h); setTimeout(()=>{if(!t){el.removeEventListener("transitionend",h);t=!0;r();}}, this.ui.TRANSITION_DURATION+50);}); el.classList.remove("is-fading-out"); el.classList.add("is-transparent"); requestAnimationFrame(()=>{logic(); requestAnimationFrame(()=>el.classList.remove("is-transparent"));});
        } else { logic(); if(el)el.classList.remove("is-fading-out","is-transparent"); if(this.state.getTotalFilteredQuestions()>0)this.state.markNavigated();}
    }
    endQuiz() { console.log("Quiz encerrado."); this.ui.stopTimer(); this.ui.showResults(this.user, this.state.getTotalFilteredQuestions()); }
    restartQuiz() {
        console.log("Tentar Novamente...");
        this.user.reset();
        this.state.fullReset();
        this.ui.updateScoreDisplay(this.user.pontos,this.user.acertos,this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.displayQuizContent(false); // Garante que o placeholder seja mostrado (se nenhum aviso)
        this.ui.clearWarning(); // Limpa avisos e mostra placeholder se apropriado
        this.ui.updateFilteredQuestionCount(0);
        this.quizLogic.clearAllFiltersInPanel(); // Usa quizLogic para chamar, pois ele tem referência a ui
        this.ui.toggleFilterPanel(true);
    }
    forceEndQuiz() {
        console.log("Forçando encerramento.");
        this.ui.stopTimer();
        this.endQuiz(); // Mostra resultados, que esconde o placeholder
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
        this.quizUI.quizState = this.quizState;
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData, this.quizData);
         // Para que restartQuiz possa chamar clearAllFiltersInPanel corretamente
        this.quizLogic.quizLogic = this.quizLogic;
    }
    async initialize() {
        console.log("Inicializando App...");
        try {
            const loaded = await this.quizData.loadAllData();
            if (loaded && this.quizData.getPerguntas().length > 0) {
                this.quizState.initialize(this.quizData.getPerguntas());
                const categoriasParaArvore = this.quizData.getCategoriasHierarquicamente();
                this.quizUI.generateCategoryTree(categoriasParaArvore);
                this.quizUI.updateFilteredQuestionCount(0);
                this.setupEventListeners();
                const initialActiveLink = document.querySelector('.main-nav__link--active, .bottom-nav__link--active');
                const initialSection = initialActiveLink?.dataset.section || 'home-section';
                this.quizUI.showSection(initialSection); console.log("App inicializado com sucesso.");
                // if (initialSection === 'question-section') { // Lógica de placeholder cuidará disso
                //     this.quizState.setQuickQuizMode(false);
                //     this.quizUI.updateFilteredQuestionCount(0);
                // }
            } else { console.warn("Dados carregados, mas sem perguntas."); this.quizUI.showSection('question-section'); this.quizUI.showWarning("Não foi possível carregar as perguntas."); this.disableCoreFunctionality(); }
        } catch (error) {
            console.error("Falha crítica ao inicializar o App:", error);
            try { this.quizUI.showSection('question-section'); this.quizUI.showWarning(`Erro fatal: ${error.message}.`); this.disableCoreFunctionality(); }
            catch (uiError) { console.error("Erro na UI:", uiError); alert(`Erro fatal: ${error.message}.`); }
        }
    }
    disableCoreFunctionality() { this.quizUI.hideElement(this.quizUI.elements.btnAbrirFiltros); this.quizUI.hideElement(this.quizUI.elements.filteredQuestionCountDisplay); }
    setupEventListeners() {
        this.quizUI.elements.navElements?.forEach(navEl => {
            navEl.addEventListener('click', (e) => {
                if (navEl.tagName === 'A') e.preventDefault(); const targetSection = navEl.dataset.section;
                if (targetSection && targetSection !== this.quizUI.currentSection) {
                    this.quizUI.showSection(targetSection);
                    if (targetSection === 'question-section') { this.quizState.setQuickQuizMode(false); this.quizUI.updateFilteredQuestionCount(this.quizState.filteredQuestions.length); if (navEl.id === 'start-category-quiz' || navEl.id === 'view-all-questions-alt') this.quizUI.toggleFilterPanel(true); }
                } else if (targetSection === 'question-section' && (navEl.id === 'start-category-quiz' || navEl.id === 'view-all-questions-alt')) {
                    if (this.quizUI.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName)) {
                        this.quizState.setQuickQuizMode(false); this.quizUI.toggleFilterPanel(true);
                    }
                }
            });
        });
        this.quizUI.elements.startRandomQuiz?.addEventListener('click', () => {
            this.quizUI.showSection('question-section'); // Garante que estamos na seção certa
            this.quizLogic.startQuickQuiz();
        });
        this.quizUI.elements.startRandomQuizPlaceholderBtn?.addEventListener('click', () => {
            // Já estamos na question-section se este botão está visível
            this.quizLogic.startQuickQuiz();
        });
        this.quizUI.elements.btnAbrirFiltros?.addEventListener('click', () => this.quizUI.toggleFilterPanel(true));
        this.quizUI.elements.btnFecharFiltros?.addEventListener('click', () => this.quizUI.toggleFilterPanel(false));
        this.quizUI.elements.filterPanelOverlay?.addEventListener('click', () => this.quizUI.toggleFilterPanel(false));
        this.quizUI.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => this.quizLogic.applyFiltersAndStartQuiz());
        this.quizUI.elements.btnLimparFiltrosPainel?.addEventListener('click', () => this.quizLogic.clearAllFiltersInPanel());
        this.quizUI.elements.btnCatSelectAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState(this.quizData.getCategorias().map(c=>c.id_categoria.toString())); });
        this.quizUI.elements.btnCatClearAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState([]); });
        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());
        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());
        this.quizUI.elements.btnExplorarMais?.addEventListener('click', () => this.handleExplorarMais());
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => { this.quizLogic.forceEndQuiz(); });
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => { this.quizUI.toggleConfirmModal(false); });
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => { if (e.target === this.quizUI.elements.confirmEncerrarOverlay) this.quizUI.toggleConfirmModal(false); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.quizUI.elements.filterPanel?.classList.contains('filter-panel--visible')) { this.quizUI.toggleFilterPanel(false); }});
    }
    handleExplorarMais() { console.log("Botão 'Explorar Mais' clicado!"); alert("Funcionalidade 'Explorar Mais' em desenvolvimento!"); }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});