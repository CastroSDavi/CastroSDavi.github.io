/**
 * script.js
 * - Implements a slide-out filter panel for categories and other potential filters.
 * - Loads data from separate JSON files: perguntas.json, categorias.json, opcoes_resposta.json.
 * - Supports hierarchical category display and selection in the filter panel.
 * - Quiz by Category flujo is now driven by "Apply Filters" from the panel.
 * - Quick Quiz remains N random questions.
 * - Includes a placeholder/guidance box before filters are applied.
 * - Difficulty filter now supports multiple selections.
 * - Implements detailed answer explanations in a dedicated modal. // MODIFICADO
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
            else { const pai = catMap.get(node.id_categoria_pai); if (pai) pai.subcategorias.push(node); else { raizes.push(node);}}
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
    constructor() {
        this.allQuestions = [];
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.selectedCategories = [];
        this.selectedDifficulties = ['all'];
        this.isInitialQuestionLoad = true;
        this.isQuickQuizMode = false;
        this.QUICK_QUIZ_COUNT = 10;
    }
    initialize(p) { this.allQuestions = p; this.resetQuizState(); }
    resetQuizState() { this.filteredQuestions = []; this.currentQuestionIndex = 0; this.isInitialQuestionLoad = true; this.allQuestions.forEach(q => { delete q.respostaDadaId; delete q.foiCorretaNaSessao; }); }
    fullReset() {
        this.resetQuizState();
        this.selectedCategories = [];
        this.isQuickQuizMode = false;
        this.selectedDifficulties = ['all'];
    }
    setQuickQuizMode(isQuick) { this.isQuickQuizMode = isQuick; }

    setFilters(selectedCategories = [], selectedDifficulties = ['all']) {
        this.selectedCategories = Array.isArray(selectedCategories) ? selectedCategories : [];
        this.selectedDifficulties = Array.isArray(selectedDifficulties) ? selectedDifficulties : ['all'];
    }

    filterQuestions(todasCategorias, relacaoPerguntaCategorias) {
        this.resetQuizState();
        if (this.isQuickQuizMode) {
            if (!this.allQuestions.length) { this.filteredQuestions = []; return this.filteredQuestions; }
            const shuffled = [...this.allQuestions].sort(() => 0.5 - Math.random());
            this.filteredQuestions = shuffled.slice(0, Math.min(this.QUICK_QUIZ_COUNT, shuffled.length));
        } else {
            let perguntasPotenciais = [...this.allQuestions];
            // Filtro de Categoria
            if (this.selectedCategories.length > 0) {
                const idsCatRelevantes = new Set();
                const getDescendentes = (catIdNum) => { if (idsCatRelevantes.has(catIdNum) || !todasCategorias.find(c=>c.id_categoria === catIdNum)) return; idsCatRelevantes.add(catIdNum); todasCategorias.filter(c => c.id_categoria_pai === catIdNum).forEach(sub => getDescendentes(sub.id_categoria)); };
                this.selectedCategories.forEach(selCatIdStr => { const id = parseInt(selCatIdStr); if(!isNaN(id)) getDescendentes(id); });
                const idsPerguntasComCat = new Set(relacaoPerguntaCategorias.filter(pc => idsCatRelevantes.has(pc.id_categoria)).map(pc => pc.id_pergunta));
                perguntasPotenciais = perguntasPotenciais.filter(p => idsPerguntasComCat.has(p.id_pergunta));
            }

            if (this.selectedDifficulties.length > 0 && !this.selectedDifficulties.includes('all')) {
                perguntasPotenciais = perguntasPotenciais.filter(p =>
                    p.nivel_dificuldade && this.selectedDifficulties.includes(p.nivel_dificuldade.toLowerCase())
                );
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
        this.TRANSITION_DURATION = 300; // Ajustado para corresponder ao CSS do novo modal
        this.onSectionChange = onSectionChangeCallback;
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.timerRunning = false;
        this.focusedElementBeforePanel = null;
        this.focusedElementBeforeExplanationModal = null; // Para o novo modal
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
            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),
            startRandomQuizPlaceholderBtn: document.getElementById('start-random-quiz-placeholder'),
            
            // Elementos para o NOVO Modal de Explicação
            btnToggleExplanation: document.getElementById('btn-toggle-explanation'), // Botão que dispara o modal
            explanationModalOverlay: document.getElementById('explanation-modal-overlay'),
            explanationModalDialog: document.getElementById('explanation-modal-dialog'),
            explanationModalTitle: document.getElementById('explanationModalTitle'),
            btnCloseExplanationModal: document.getElementById('btn-close-explanation-modal'),
            explanationModalGeneralBlock: document.getElementById('explanation-modal-general-block'),
            explanationModalGeneralText: document.getElementById('explanation-modal-general-text'),
            explanationModalOptionsBlock: document.getElementById('explanation-modal-options-block'),
            explanationModalOptionsList: document.getElementById('explanation-modal-options-list'),
            explanationModalDivider: document.querySelector('.explanation-modal__divider'),
            explanationModalEmptyState: document.getElementById('explanation-modal-empty-state'),
            btnGotItExplanation: document.getElementById('btn-got-it-explanation')
        };
        this.sectionElements = { 'home-section': this.elements.homeSection, 'question-section': this.elements.questionSection, 'account-section': this.elements.accountSection };
        this._validateCache();
    }

    _validateCache() {
        const optional = ['feedbackAcessivel', 'filterGroupDifficulty', 'placeholderFiltrosContainer', 'startRandomQuizPlaceholderBtn',
                        // Novos elementos do modal de explicação
                        'explanationModalOverlay', 'explanationModalDialog', 'explanationModalTitle',
                        'btnCloseExplanationModal', 'explanationModalGeneralBlock', 'explanationModalGeneralText',
                        'explanationModalOptionsBlock', 'explanationModalOptionsList', 'explanationModalDivider',
                        'explanationModalEmptyState','btnGotItExplanation'
                        ];
        for (const k in this.elements) { if (!this.elements[k] && !optional.includes(k) && !(k in this.sectionElements)) console.warn(`QuizUI Cache: ${k} não encontrado!`); }
        for (const k in this.sectionElements) if(!this.sectionElements[k]) console.warn(`QuizUI Cache: Seção ${k} não encontrada!`);
    }


    showElement(el) { el?.classList.remove(this.hiddenClassName); }
    hideElement(el) { el?.classList.add(this.hiddenClassName); }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerRunning = false;
        // console.log("Timer parado."); // Removido para diminuir verbosidade
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
        // console.log("Timer resetado.");
    }

    startTimer() {
        if (this.timerRunning) return;
        this.timerRunning = true;
        // console.log("Timer iniciado.");
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
            if (this.quizState) { // quizState deve ser injetado ou acessível
                 const currentSelectedCategories = this.quizState.selectedCategories;
                 const currentDifficulties = this.quizState.selectedDifficulties;
                 this.setCategoryTreeState(currentSelectedCategories);
                 this.setDifficultyState(currentDifficulties);
            }

            this.showElement(overlay); this.showElement(panel);
            panel.removeAttribute('aria-hidden'); overlay.removeAttribute('aria-hidden');
            requestAnimationFrame(() => {
                overlay.classList.add(overlayVisibleClass);
                panel.classList.add(panelVisibleClass);
                panel.focus(); // Focar no painel ao abrir
            });
        } else {
            panel.classList.remove(panelVisibleClass);
            overlay.classList.remove(overlayVisibleClass);
            
            const onTransitionEnd = () => {
                if (!panel.classList.contains(panelVisibleClass)) { // Garante que só executa se realmente estiver escondido
                    this.hideElement(panel);
                    this.hideElement(overlay);
                    panel.setAttribute('aria-hidden', 'true');
                    overlay.setAttribute('aria-hidden', 'true');
                }
                panel.removeEventListener('transitionend', onTransitionEnd); // Remove o listener
                this.focusedElementBeforePanel?.focus(); // Devolve o foco
            };
            
            panel.addEventListener('transitionend', onTransitionEnd, { once: true });

            // Fallback caso a transição não dispare por algum motivo (ex: display:none imediato)
            setTimeout(() => {
                if (!panel.classList.contains(panelVisibleClass)) {
                    this.hideElement(panel); this.hideElement(overlay);
                    panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true');
                    this.focusedElementBeforePanel?.focus();
                }
                panel.removeEventListener('transitionend', onTransitionEnd); // Garante remoção
            }, this.TRANSITION_DURATION + 50); // Um pouco mais que a duração da transição
        }
    }

    getSectionUIConfig() {
        // Mantém a lógica de esconder elementos não relevantes para a seção atual
        // O modal de explicação não precisa ser listado aqui, pois é controlado separadamente
        return {
            'home-section': {
                visible: [],
                hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.btnAbrirFiltros, this.elements.filteredQuestionCountDisplay, this.elements.placeholderFiltrosContainer, this.elements.btnToggleExplanation /* Esconder btn de análise */],
                onEnter: null
            },
            'question-section': {
                visible: [this.elements.btnAbrirFiltros, this.elements.filteredQuestionCountDisplay, this.elements.placeholderFiltrosContainer],
                hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.btnToggleExplanation /* Esconder btn de análise por padrão */ ],
                onEnter: () => {
                    if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                        this.elements.avisoContainer?.classList.contains(this.hiddenClassName) &&
                        this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                        this.showElement(this.elements.placeholderFiltrosContainer);
                    }
                }
            },
            'account-section': {
                visible: [],
                hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.btnAbrirFiltros, this.elements.filteredQuestionCountDisplay, this.elements.placeholderFiltrosContainer, this.elements.btnToggleExplanation /* Esconder btn de análise */],
                onEnter: null
            }
        };
    }
    
    showSection(sectionId) {
        // console.log(`[Log] Tentando mostrar seção: ${sectionId}`); // Removido para verbosidade
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
                this.clearWarning();
                this.hideElement(this.elements.placeholderFiltrosContainer);
                this.toggleFilterPanel(false);
                this.toggleExplanationModal(false); // Garantir que modal de explicação está fechado
            } else {
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
            this.hideElement(this.elements.placeholderFiltrosContainer);
            if (this.currentSection === "question-section") this.hideQuizElements();
        }
    }

    clearWarning() {
        this.hideElement(this.elements.avisoContainer);
        this.elements.avisoMensagem?.removeAttribute("role");
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
            this.clearWarning();
            this.hideElement(this.elements.placeholderFiltrosContainer);
            this.hideElement(this.elements.resultadoCard);
            this.hideElement(this.elements.btnAbrirFiltros);
            this.hideElement(this.elements.filteredQuestionCountDisplay);
        } else {
            this.hideElement(this.elements.quizSectionContent);
            this.hideElement(this.elements.btnEncerrarSessao);
            this.hideProgressBar();
            this.hideElement(this.elements.questionGridContainer);
            this.showElement(this.elements.btnAbrirFiltros);
            this.showElement(this.elements.filteredQuestionCountDisplay);
            if (this.elements.avisoContainer?.classList.contains(this.hiddenClassName) &&
                this.elements.resultadoCard?.classList.contains(this.hiddenClassName) ) {
                this.showElement(this.elements.placeholderFiltrosContainer);
            }
            this.toggleExplanationModal(false); // Esconder modal de explicação ao sair do quiz
            this.hideElement(this.elements.btnToggleExplanation); // Esconder botão de análise
        }
    }

    hideQuizElements() {
        this.hideElement(this.elements.quizSectionContent);
        this.hideElement(this.elements.resultadoCard);
        this.hideElement(this.elements.questionGridContainer);
        this.hideElement(this.elements.btnEncerrarSessao);
        this.hideProgressBar();
        this.toggleExplanationModal(false); // Esconder modal de explicação
        this.hideElement(this.elements.btnToggleExplanation); // Esconder botão de análise
    }

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

        this.hideElement(this.elements.btnToggleExplanation); // Esconder botão de análise ao carregar nova questão
        this.toggleExplanationModal(false); // Garantir que o modal de explicação está fechado
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

        const currentQuestion = this.quizState.getCurrentQuestion(); // Necessário acesso ao quizState
        const hasGeneralExplanation = currentQuestion && currentQuestion.explicacao_resposta && currentQuestion.explicacao_resposta.trim() !== '';
        const hasAnyOptionFeedback = opcoesDaPergunta.some(op => op.feedback_opcao && op.feedback_opcao.trim() !== '');

        if ((hasGeneralExplanation || hasAnyOptionFeedback) && this.elements.btnToggleExplanation) {
            this.showElement(this.elements.btnToggleExplanation);
        } else {
            this.hideElement(this.elements.btnToggleExplanation);
        }
    }

    toggleExplanationModal(show) {
        const overlay = this.elements.explanationModalOverlay;
        const dialog = this.elements.explanationModalDialog;

        if (!overlay || !dialog || !this.quizState || !this.quizData) {
            console.error("Elementos do modal de explicação, quizState ou quizData não encontrados.");
            return;
        }
        const modalVisibleClass = 'modal--visible';

        if (show) {
            const currentQuestion = this.quizState.getCurrentQuestion();
            if (!currentQuestion) { console.error("Nenhuma pergunta atual para mostrar explicação no modal."); return; }
            const opcoesDaPergunta = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);

            let contentRendered = false;

            // Preencher Explicação Geral
            const generalBlock = this.elements.explanationModalGeneralBlock;
            const generalTextEl = this.elements.explanationModalGeneralText;
            if (currentQuestion.explicacao_resposta && currentQuestion.explicacao_resposta.trim() !== '') {
                generalTextEl.innerHTML = currentQuestion.explicacao_resposta.replace(/\n/g, '<br>'); // Suporta quebras de linha
                this.showElement(generalBlock);
                contentRendered = true;
            } else {
                this.hideElement(generalBlock);
            }

            // Preencher Feedback das Opções
            const optionsBlock = this.elements.explanationModalOptionsBlock;
            const optionsListEl = this.elements.explanationModalOptionsList;
            optionsListEl.innerHTML = ''; // Limpar
            let hasSpecificOptionFeedback = false;
            opcoesDaPergunta.forEach(opcao => {
                if (opcao.feedback_opcao && opcao.feedback_opcao.trim() !== '') {
                    hasSpecificOptionFeedback = true;
                    const li = document.createElement('li');
                    const originalTextSpan = document.createElement('span');
                    originalTextSpan.className = 'option-original-text';
                    originalTextSpan.textContent = `Opção: "${opcao.texto_opcao}"`; // Melhor identificação
                    li.appendChild(originalTextSpan);

                    const feedbackValueSpan = document.createElement('span');
                    feedbackValueSpan.className = 'option-feedback-value';
                    feedbackValueSpan.classList.add(opcao.eh_correta ? 'correct' : 'incorrect');
                    feedbackValueSpan.innerHTML = opcao.feedback_opcao.replace(/\n/g, '<br>');
                    li.appendChild(feedbackValueSpan);
                    optionsListEl.appendChild(li);
                }
            });

            if (hasSpecificOptionFeedback) {
                this.showElement(optionsBlock);
                contentRendered = true;
            } else {
                this.hideElement(optionsBlock);
            }
            
            // Mostrar/esconder divider
            const divider = this.elements.explanationModalDivider;
            if (generalBlock && !generalBlock.classList.contains(this.hiddenClassName) &&
                optionsBlock && !optionsBlock.classList.contains(this.hiddenClassName) && divider) {
                this.showElement(divider);
            } else if (divider) {
                this.hideElement(divider);
            }


            // Mostrar estado vazio se nenhum conteúdo
            const emptyState = this.elements.explanationModalEmptyState;
            if (!contentRendered && emptyState) {
                this.showElement(emptyState);
            } else if (emptyState) {
                this.hideElement(emptyState);
            }
            
            // Mostrar o modal
            this.focusedElementBeforeExplanationModal = document.activeElement;
            this.showElement(overlay);
            overlay.scrollTop; // Forçar reflow para transição
            requestAnimationFrame(() => {
                overlay.classList.add(modalVisibleClass);
                dialog.focus(); // Focar no diálogo do modal
            });

        } else { // Esconder o modal
            overlay.classList.remove(modalVisibleClass);
            const onTransitionEnd = () => {
                if (!overlay.classList.contains(modalVisibleClass)) {
                    this.hideElement(overlay);
                }
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeExplanationModal?.focus();
            };
            overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
            setTimeout(() => { // Fallback
                if (!overlay.classList.contains(modalVisibleClass)) {
                    this.hideElement(overlay);
                }
                overlay.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforeExplanationModal?.focus();
            }, this.TRANSITION_DURATION + 50);
        }
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
                li.setAttribute('aria-checked', 'false'); // Estado inicial

                const wrapper = document.createElement('div');
                wrapper.className = 'category-tree__label-wrapper';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `cat-tree-${cat.id_categoria}`;
                input.className = 'category-tree__input u-sr-only'; // Mantém escondido, label controla
                input.value = cat.id_categoria.toString();
                input.tabIndex = -1; // Não focável diretamente
                input.addEventListener('change', (e) => this.handleCategoryCheckboxChange(e.target));


                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.className = 'category-tree__label';
                label.textContent = cat.nome_categoria;
                label.tabIndex = 0; // Torna o label focável
                label.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        input.checked = !input.checked;
                        // Disparar o evento change manualmente para que handleCategoryCheckboxChange seja chamado
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        e.preventDefault(); // Prevenir comportamento padrão do navegador (scroll, etc.)
                    }
                });

                if (cat.subcategorias && cat.subcategorias.length > 0) {
                    li.classList.add('category-tree__item--has-children');
                    li.setAttribute('aria-expanded', 'false'); // Começa recolhido

                    const toggleBtn = document.createElement('button');
                    toggleBtn.type = 'button';
                    toggleBtn.className = 'category-tree__toggle';
                    toggleBtn.setAttribute('aria-label', `Expandir ${cat.nome_categoria}`);
                    toggleBtn.setAttribute('aria-expanded', 'false');
                    toggleBtn.innerHTML = `<span class="material-symbols-outlined">chevron_right</span>`; // Ícone inicial

                    // Ordem: toggle, input, label
                    wrapper.appendChild(toggleBtn);
                    wrapper.appendChild(input);
                    wrapper.appendChild(label);

                    const submenu = document.createElement('ul');
                    submenu.className = 'category-tree__submenu';
                    submenu.setAttribute('role', 'group'); // Submenu é um grupo de treeitems

                    createTreeRecursive(cat.subcategorias, submenu, nivel + 1);
                    li.appendChild(wrapper);
                    li.appendChild(submenu);

                    // Ação de toggle no botão
                    const toggleAction = (e) => {
                        e.stopPropagation(); // Evitar que o clique no botão propague para o label/input
                        const isExpanded = li.getAttribute('aria-expanded') === 'true';
                        li.setAttribute('aria-expanded', String(!isExpanded));
                        toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
                        toggleBtn.setAttribute('aria-label', `${!isExpanded ? 'Recolher' : 'Expandir'} ${cat.nome_categoria}`);
                        submenu.classList.toggle('category-tree__submenu--expanded');
                        // Animação de altura
                        if (!isExpanded) {
                            // submenu.style.display = 'block'; // Garante que está visível para calcular scrollHeight
                            submenu.style.maxHeight = submenu.scrollHeight + "px";
                        } else {
                           // submenu.style.maxHeight = submenu.scrollHeight + "px"; // Prepara para transição de recolhimento
                           requestAnimationFrame(() => { // Permite que o maxHeight seja aplicado antes de zerar
                               submenu.style.maxHeight = '0';
                           });
                        }
                        toggleBtn.querySelector('.material-symbols-outlined').textContent = !isExpanded ? 'expand_more' : 'chevron_right';
                    };

                    toggleBtn.addEventListener('click', toggleAction);
                    // Permitir expandir/recolher com Enter/Space no botão de toggle
                    toggleBtn.addEventListener('keydown', (e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                            toggleAction(e);
                            e.preventDefault();
                        }
                    });

                } else { // Sem filhos
                    wrapper.appendChild(input);
                    wrapper.appendChild(label);
                    li.appendChild(wrapper);
                }
                parentElement.appendChild(li);
            });
        };
        createTreeRecursive(categoriasHierarquicas, treeContainer);
        // Atualizar estado dos pais após a criação inicial
        const parentLis = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
        for (let i = parentLis.length - 1; i >= 0; i--) { // Iterar de baixo para cima
            this.updateParentCheckboxState(parentLis[i]);
        }
    }


    handleCategoryCheckboxChange(checkbox) {
        const isChecked = checkbox.checked;
        const li = checkbox.closest('.category-tree__item');
        if (!li) return;

        // Define o estado ARIA do item da árvore
        checkbox.classList.remove('is-indeterminate'); // Remove indeterminado ao ser clicado diretamente
        li.setAttribute('aria-checked', String(isChecked));

        // Propaga a mudança para os filhos
        const childCheckboxes = li.querySelectorAll(':scope > .category-tree__submenu .category-tree__input');
        childCheckboxes.forEach(childCb => {
            childCb.checked = isChecked;
            childCb.classList.remove('is-indeterminate'); // Filhos também perdem indeterminação
             const childLi = childCb.closest('.category-tree__item');
             if(childLi) childLi.setAttribute('aria-checked', String(isChecked));
        });

        // Atualiza o estado do pai (e recursivamente dos avós, etc.)
        this.updateParentCheckboxState(li.parentElement?.closest('.category-tree__item'));
    }

    updateParentCheckboxState(parentLi) {
        if (!parentLi) return;

        const parentCheckbox = parentLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
        if (!parentCheckbox) return;

        // Pega apenas os LIs filhos diretos para verificar o estado
        const childLis = parentLi.querySelectorAll(':scope > .category-tree__submenu > .category-tree__item');
        if (childLis.length === 0) return; // Sem filhos, nada a fazer

        let allChecked = true;
        let noneChecked = true;
        let someIndeterminate = false; // Se algum filho está indeterminado

        childLis.forEach(childLi => {
            const childInput = childLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
            if (childInput) {
                if (childInput.checked && !childInput.classList.contains('is-indeterminate')) {
                    noneChecked = false; // Pelo menos um está marcado (não indeterminado)
                } else if (childInput.classList.contains('is-indeterminate')) {
                    allChecked = false; // Se um filho é indeterminado, o pai não pode ser 'allChecked'
                    noneChecked = false; // Nem 'noneChecked'
                    someIndeterminate = true;
                } else { // childInput.checked é false e não é indeterminado
                    allChecked = false; // Pelo menos um não está marcado
                }
            } else {
                 allChecked = false; // Considera não marcado se o input não for encontrado
            }
        });


        parentCheckbox.classList.remove('is-indeterminate'); // Limpa estado anterior

        if (someIndeterminate || (!allChecked && !noneChecked)) {
            // Se algum filho é indeterminado, OU se nem todos estão marcados E nem todos estão desmarcados
            // (ou seja, uma mistura de marcados e desmarcados)
            parentCheckbox.checked = false; // O checkbox visual em si não fica "checked"
            parentCheckbox.classList.add('is-indeterminate');
            parentLi.setAttribute('aria-checked', 'mixed');
        } else if (allChecked) {
            parentCheckbox.checked = true;
            parentLi.setAttribute('aria-checked', 'true');
        } else { // noneChecked é true (todos os filhos estão desmarcados e nenhum é indeterminado)
            parentCheckbox.checked = false;
            parentLi.setAttribute('aria-checked', 'false');
        }

        // Recursivamente atualiza o estado do pai deste pai
        this.updateParentCheckboxState(parentLi.parentElement?.closest('.category-tree__item'));
    }

    getSelectedCategoriesFromTree() {
        const ids = [];
        this.elements.categoryTreeList?.querySelectorAll('.category-tree__input').forEach(cb => {
            // Inclui os explicitamente marcados (não indeterminados)
            // E os pais indeterminados, pois significam que algum filho está marcado
            if (cb.checked && !cb.classList.contains('is-indeterminate')) {
                ids.push(cb.value);
            }
            // Poderia adicionar lógica para incluir pais de itens marcados se a filtragem precisar disso
            // Mas a lógica atual de filtragem já considera descendentes se o pai é selecionado.
        });
        // console.log("Categorias selecionadas (raw):", ids);
        return ids;
    }

    getSelectedDifficulties() {
        const difficultyCheckboxes = this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])');
        const selectedSpecificDifficulties = [];
        difficultyCheckboxes?.forEach(cb => {
            if (cb.checked) {
                selectedSpecificDifficulties.push(cb.value);
            }
        });

        const allCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');

        if (allCheckbox?.checked || selectedSpecificDifficulties.length === 0) {
            return ['all']; // Se "Todas" está marcado OU nenhuma específica foi marcada, considera "all"
        }
        return selectedSpecificDifficulties;
    }

    setCategoryTreeState(selectedIds = []) {
        const allCheckboxes = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input') || []);
        allCheckboxes.forEach(cb => {
            cb.checked = selectedIds.includes(cb.value);
            cb.classList.remove('is-indeterminate');
             const li = cb.closest('.category-tree__item');
             if(li) li.setAttribute('aria-checked', String(cb.checked));
        });
        // Atualizar estado dos pais de baixo para cima
        const parentLis = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
        // É crucial iterar de forma que os filhos sejam processados antes dos pais
        // Uma forma simples é iterar de trás para frente na lista de todos os LIs com filhos.
        for (let i = parentLis.length - 1; i >= 0; i--) {
            this.updateParentCheckboxState(parentLis[i]);
        }
    }

    setDifficultyState(difficulties = ['all']) {
        const allCheckbox = this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        const specificCheckboxes = Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])') || []);

        if (difficulties.includes('all')) {
            if (allCheckbox) allCheckbox.checked = true;
            specificCheckboxes.forEach(cb => cb.checked = false);
        } else {
            if (allCheckbox) allCheckbox.checked = false;
            specificCheckboxes.forEach(cb => {
                cb.checked = difficulties.includes(cb.value);
            });
        }
    }

    updateFilteredQuestionCount(count) {
        if (this.elements.filteredQuestionCountDisplay) {
            this.elements.filteredQuestionCountDisplay.textContent = count > 0 ? `${count} questões` : "Nenhuma questão";
        }
    }

    showResults(userData, totalFilteredQuestions) {
        const card = this.elements.resultadoCard;
        if (!card || !userData) return;
        this.hideQuizElements();
        this.hideElement(this.elements.btnAbrirFiltros);
        this.hideElement(this.elements.filteredQuestionCountDisplay);
        this.hideElement(this.elements.placeholderFiltrosContainer);
        if (this.elements.resultadoTitulo) this.elements.resultadoTitulo.textContent = "Desempenho Final!";
        if (this.elements.resultadoPontos) this.elements.resultadoPontos.textContent = userData.pontos;
        if (this.elements.resultadoAcertos) this.elements.resultadoAcertos.textContent = userData.acertos;
        if (this.elements.resultadoErros) this.elements.resultadoErros.textContent = userData.erros;
        if (this.elements.resultadoTempo) this.elements.resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds);
        if (this.elements.resultadoMensagemMotivacional) {
            const p = userData.pontos, t = totalFilteredQuestions;
            let m = "Continue praticando!";
            if (t > 0) {
                const max = t * 15;
                if (p >= max * 0.8) m = "Excelente desempenho!";
                else if (p >= max * 0.5) m = "Muito bom!";
            } else if (p === 0 && userData.acertos === 0 && userData.erros === 0) m = "Nenhuma questão encontrada/respondida.";
            this.elements.resultadoMensagemMotivacional.textContent = m;
        }
        this.showElement(card);
        this.elements.resultadoTitulo?.focus();
    }

    hideResults() { this.hideElement(this.elements.resultadoCard); }

    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay;
        if (!overlay) return;
        const mod = 'modal--visible';
        if (show) {
            this.focusedElementBeforePanel = document.activeElement; // Reutilizando para modais genéricos
            this.showElement(overlay);
            overlay.scrollTop;
            requestAnimationFrame(() => {
                overlay.classList.add(mod);
                this.elements.cancelEncerrarBtn?.focus();
            });
        } else {
            overlay.classList.remove(mod);
            const end = () => {
                if (!overlay.classList.contains(mod)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', end);
                this.focusedElementBeforePanel?.focus();
            };
            overlay.addEventListener('transitionend', end, { once: true });
            setTimeout(() => { // Fallback
                if (!overlay.classList.contains(mod)) this.hideElement(overlay);
                overlay.removeEventListener('transitionend', end);
                this.focusedElementBeforePanel?.focus();
            }, this.TRANSITION_DURATION + 50);
        }
    }

    scrollToQuestionStart() {
        const t = this.elements.questionTitle;
        if (this.currentSection === "question-section" && t)
            t.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    focusNextButton(prevScroll = false) {
        this.elements.nextBtn?.focus({ preventScroll: prevScroll });
    }

    smoothScrollToNextButton() {
        const t = this.elements.navigationButtons;
        t && t.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

// --- Módulo: QuizLogic ---
class QuizLogic {
    constructor(quizState, quizUI, userData, quizDataInstance) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizDataInstance;
    }

    applyFiltersAndStartQuiz() {
        // console.log("Aplicando filtros e iniciando quiz...");
        const selectedCategoryIds = this.ui.getSelectedCategoriesFromTree();
        const selectedDifficulties = this.ui.getSelectedDifficulties();
        this.state.setQuickQuizMode(false);
        this.state.setFilters(selectedCategoryIds, selectedDifficulties);
        this.ui.toggleFilterPanel(false);
        this.startQuiz();
    }

    clearAllFiltersInPanel() {
        this.ui.setCategoryTreeState([]);
        this.ui.setDifficultyState(['all']); // Define para "Todas" dificuldades
        // Para mostrar o count total, precisaríamos re-filtrar ou pegar o total de this.state.allQuestions
        this.ui.updateFilteredQuestionCount(this.state.allQuestions.length);
        // console.log("Filtros limpos no painel.");
    }

    startQuiz() {
        this.user.reset();
        this.state.filterQuestions(this.quizData.getCategorias(), this.quizData.getRelacaoPerguntaCategorias());
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false); // Garante que modal de explicação está fechado

        const filteredQuestions = this.state.filteredQuestions;
        this.ui.updateFilteredQuestionCount(filteredQuestions.length);
        if (filteredQuestions.length > 0) {
            this.ui.displayQuizContent(true);
            this._displayCurrentQuestion(false); // false para não scrollar na primeira questão
            this.ui.startTimer();
        }
        else {
            this.ui.displayQuizContent(false);
            this.ui.showWarning(this.state.isQuickQuizMode ? "Nenhuma pergunta para Quiz Rápido." : "Nenhuma questão encontrada para os filtros. Tente outros.");
            this.ui.stopTimer();
        }
    }
    startQuickQuiz() {
        // console.log("Iniciando Quiz Rápido...");
        this.state.setQuickQuizMode(true);
        this.state.setFilters([], ['all']); // Sem categorias, todas as dificuldades
        this.ui.toggleFilterPanel(false); // Fecha o painel de filtros se estiver aberto
        this.startQuiz();
    }

    answerQuestion(selectedOpcaoId) {
        const currentQuestion = this.state.getCurrentQuestion();
        if (!currentQuestion) return;
        const opcoesDaPergunta = this.quizData.getOpcoesPorPerguntaId(currentQuestion.id_pergunta);
        const opcaoSelecionada = opcoesDaPergunta.find(op => op.id_opcao_resposta === selectedOpcaoId);
        if (opcaoSelecionada && this.state.recordAnswer(selectedOpcaoId)) {
            currentQuestion.foiCorretaNaSessao = opcaoSelecionada.eh_correta;
            if (opcaoSelecionada.eh_correta) {
                this.user.incrementarAcertos();
            } else {
                this.user.incrementarErros();
            }
            this.ui.disableAnswers();
            this.ui.applyAnswerFeedback(selectedOpcaoId, opcoesDaPergunta);
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.focusNextButton(true); // Foca no botão "Próxima" sem scrollar a página
            this.ui.smoothScrollToNextButton(); // Scrolla suavemente para o botão de navegação se estiver fora da tela
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

        // Transição suave para a nova questão
        if(!init && el){ // Se não for a carga inicial e o elemento existir
            el.classList.add("is-fading-out");
            // Espera a transição de fade-out terminar
            await new Promise(resolve => {
                let transitionEnded = false;
                const transitionEndHandler = () => {
                    if (!transitionEnded) {
                        el.removeEventListener("transitionend", transitionEndHandler);
                        transitionEnded = true;
                        resolve();
                    }
                };
                el.addEventListener("transitionend", transitionEndHandler);
                // Fallback caso o evento não dispare (ex: se display:none for setado antes)
                setTimeout(() => {
                    if (!transitionEnded) {
                        el.removeEventListener("transitionend", transitionEndHandler);
                        transitionEnded = true;
                        resolve();
                    }
                }, this.ui.TRANSITION_DURATION + 50); // Duração da transição + margem
            });

            el.classList.remove("is-fading-out");
            el.classList.add("is-transparent"); // Mantém invisível enquanto atualiza

            requestAnimationFrame(() => { // Garante que a classe is-transparent foi aplicada
                logic(); // Atualiza o conteúdo da questão
                requestAnimationFrame(() => el.classList.remove("is-transparent")); // Torna visível (fade-in implícito)
            });

        } else { // Carga inicial ou elemento não encontrado
            logic();
            if (el) el.classList.remove("is-fading-out", "is-transparent"); // Limpa classes de transição
            if (this.state.getTotalFilteredQuestions() > 0) this.state.markNavigated(); // Marca como navegada se houver questões
        }
    }

    endQuiz() {
        // console.log("Quiz encerrado.");
        this.ui.stopTimer();
        this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        this.ui.toggleExplanationModal(false); // Garante que modal de explicação está fechado
    }
    restartQuiz() {
        // console.log("Tentar Novamente...");
        this.user.reset();
        this.state.fullReset();
        this.ui.updateScoreDisplay(this.user.pontos,this.user.acertos,this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false); // Garante que modal de explicação está fechado

        this.ui.displayQuizContent(false);
        this.ui.clearWarning();
        this.ui.updateFilteredQuestionCount(0); // Zera a contagem exibida
        this.quizLogic.clearAllFiltersInPanel(); // Reseta os filtros no painel
        this.ui.toggleFilterPanel(true); // Abre o painel de filtros
    }
    forceEndQuiz() {
        // console.log("Forçando encerramento.");
        this.ui.stopTimer();
        this.endQuiz(); // Mostra resultados
        this.ui.toggleConfirmModal(false); // Fecha modal de confirmação
        this.ui.toggleExplanationModal(false); // Garante que modal de explicação está fechado
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
        // Injetar dependências onde necessário
        this.quizUI.quizState = this.quizState;
        this.quizUI.quizData = this.quizData;
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData, this.quizData);
        this.quizLogic.quizLogic = this.quizLogic; // Para o restartQuiz no QuizLogic chamar clearAllFiltersInPanel
    }
    async initialize() {
        console.log("Inicializando App...");
        try {
            const loaded = await this.quizData.loadAllData();
            if (loaded && this.quizData.getPerguntas().length > 0) {
                this.quizState.initialize(this.quizData.getPerguntas());
                const categoriasParaArvore = this.quizData.getCategoriasHierarquicamente();
                this.quizUI.generateCategoryTree(categoriasParaArvore);
                this.quizUI.updateFilteredQuestionCount(0); // Inicializa contagem
                this.setupEventListeners();
                const initialActiveLink = document.querySelector('.main-nav__link--active, .bottom-nav__link--active');
                const initialSection = initialActiveLink?.dataset.section || 'home-section';
                this.quizUI.showSection(initialSection);
                console.log("App inicializado com sucesso.");
            } else {
                console.warn("Dados carregados, mas sem perguntas. Verifique os arquivos JSON.");
                this.quizUI.showSection('question-section'); // Vai para a seção de questões
                this.quizUI.showWarning("Não foi possível carregar as perguntas do quiz. Por favor, verifique os arquivos de dados e tente recarregar a página.");
                this.disableCoreFunctionality();
            }
        } catch (error) {
            console.error("Falha crítica ao inicializar o App:", error);
            try {
                this.quizUI.showSection('question-section');
                this.quizUI.showWarning(`Erro fatal ao carregar o quiz: ${error.message}. Verifique o console para mais detalhes.`);
                this.disableCoreFunctionality();
            } catch (uiError) {
                console.error("Erro catastrófico na UI durante o tratamento de erro:", uiError);
                alert(`Erro fatal ao carregar o quiz: ${error.message}. Não foi possível nem mesmo exibir a mensagem de erro na página.`);
            }
        }
    }
    disableCoreFunctionality() {
        // Esconde botões que iniciam o quiz ou abrem filtros se os dados falharam
        this.quizUI.hideElement(this.quizUI.elements.btnAbrirFiltros);
        this.quizUI.hideElement(this.quizUI.elements.filteredQuestionCountDisplay);
        this.quizUI.hideElement(this.quizUI.elements.startRandomQuiz);
        this.quizUI.hideElement(this.quizUI.elements.startRandomQuizPlaceholderBtn);
        const startCategoryBtn = document.getElementById('start-category-quiz');
        if(startCategoryBtn) this.quizUI.hideElement(startCategoryBtn);
    }

    setupEventListeners() {
        // Navegação principal
        this.quizUI.elements.navElements?.forEach(navEl => {
            navEl.addEventListener('click', (e) => {
                if (navEl.tagName === 'A') e.preventDefault();
                const targetSection = navEl.dataset.section;
                if (targetSection && targetSection !== this.quizUI.currentSection) {
                    this.quizUI.showSection(targetSection);
                    if (targetSection === 'question-section') {
                        this.quizState.setQuickQuizMode(false); // Garante que não está em modo rápido
                        this.quizUI.updateFilteredQuestionCount(this.quizState.filteredQuestions.length);
                        // Se o quiz não estiver ativo e a seção de questões for acessada por um link que sugere filtros
                        if ( (navEl.id === 'start-category-quiz' || navEl.id === 'view-all-questions-alt') &&
                             this.quizUI.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName) ) {
                             this.quizUI.toggleFilterPanel(true); // Abre painel de filtros
                        }
                    }
                } else if (targetSection === 'question-section' && (navEl.id === 'start-category-quiz' || navEl.id === 'view-all-questions-alt')) {
                    // Caso já esteja na seção de questões, mas o quiz não está ativo, e clica para filtrar
                    if (this.quizUI.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName)) {
                        this.quizState.setQuickQuizMode(false);
                        this.quizUI.toggleFilterPanel(true);
                    }
                }
            });
        });

        // Botões de Início de Quiz
        this.quizUI.elements.startRandomQuiz?.addEventListener('click', () => {
            this.quizUI.showSection('question-section');
            this.quizLogic.startQuickQuiz();
        });
        this.quizUI.elements.startRandomQuizPlaceholderBtn?.addEventListener('click', () => {
            this.quizLogic.startQuickQuiz();
        });

        // Painel de Filtros
        this.quizUI.elements.btnAbrirFiltros?.addEventListener('click', () => this.quizUI.toggleFilterPanel(true));
        this.quizUI.elements.btnFecharFiltros?.addEventListener('click', () => this.quizUI.toggleFilterPanel(false));
        this.quizUI.elements.filterPanelOverlay?.addEventListener('click', () => this.quizUI.toggleFilterPanel(false));
        this.quizUI.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => this.quizLogic.applyFiltersAndStartQuiz());
        this.quizUI.elements.btnLimparFiltrosPainel?.addEventListener('click', () => this.quizLogic.clearAllFiltersInPanel());
        this.quizUI.elements.btnCatSelectAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState(this.quizData.getCategorias().map(c=>c.id_categoria.toString())); });
        this.quizUI.elements.btnCatClearAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState([]); });

        // Navegação do Quiz (Anterior/Próxima)
        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());

        // Ações de Resultado do Quiz
        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());
        this.quizUI.elements.btnExplorarMais?.addEventListener('click', () => this.handleExplorarMais());

        // Modal de Confirmação de Encerramento
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => { this.quizLogic.forceEndQuiz(); });
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => { this.quizUI.toggleConfirmModal(false); });
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (e) => { if (e.target === this.quizUI.elements.confirmEncerrarOverlay) this.quizUI.toggleConfirmModal(false); });
        
        // Fechar painel de filtros com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.quizUI.elements.filterPanel?.classList.contains('filter-panel--visible')) {
                    this.quizUI.toggleFilterPanel(false);
                }
                // Também fechar o modal de explicação com ESC
                if (this.quizUI.elements.explanationModalOverlay?.classList.contains('modal--visible')) {
                    this.quizUI.toggleExplanationModal(false);
                }
            }
        });

        // Listeners para checkboxes de dificuldade
        const difficultyInputs = this.quizUI.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]');
        const allDifficultyCheckbox = this.quizUI.elements.filterGroupDifficulty?.querySelector('input[value="all"]');

        difficultyInputs?.forEach(input => {
            input.addEventListener('change', () => {
                if (input.value === 'all' && input.checked) {
                    // Se "Todas" for marcado, desmarca os outros
                    difficultyInputs.forEach(otherInput => {
                        if (otherInput.value !== 'all') {
                            otherInput.checked = false;
                        }
                    });
                } else if (input.value !== 'all' && input.checked) {
                    // Se um específico for marcado, desmarca "Todas"
                    if (allDifficultyCheckbox) {
                        allDifficultyCheckbox.checked = false;
                    }
                }
                // Se todos os específicos forem desmarcados, marcar "Todas" automaticamente? (Opcional)
                // const specificChecked = Array.from(difficultyInputs).some(cb => cb.value !== 'all' && cb.checked);
                // if (!specificChecked && allDifficultyCheckbox && !allDifficultyCheckbox.checked) {
                //     allDifficultyCheckbox.checked = true;
                // }
            });
        });

        // Listener para o botão "Analisar Resposta" (que agora abre o modal)
        this.quizUI.elements.btnToggleExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(true));

        // Listeners para fechar o NOVO modal de explicação
        this.quizUI.elements.btnCloseExplanationModal?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.btnGotItExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.explanationModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.quizUI.elements.explanationModalOverlay) { // Só fecha se clicar no overlay
                this.quizUI.toggleExplanationModal(false);
            }
        });

    }
    handleExplorarMais() {
        console.log("Botão 'Explorar Mais' clicado!");
        this.quizUI.showSection('home-section'); // Volta para a home, por exemplo
        // Poderia ter uma lógica mais complexa aqui, como ir para uma seção de "revisão" ou "estudo"
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});