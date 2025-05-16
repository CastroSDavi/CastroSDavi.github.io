/**
 * script.js - Lógica principal do MedQuiz
 */

// Variável global para armazenar URLs do Django injetadas pelo template
var DJANGO_URLS = {
    start_quiz_session: '/api/quiz/start-session/', // Fallback se não injetado
    register_answer: '/api/quiz/register-answer/',   // Fallback
    end_quiz_session: '/api/quiz/end-session/'      // Fallback
};

class UserData {
    constructor() {
        this.reset();
    }
    get acertos() { return this._acertos; }
    get erros() { return this._erros; }
    get pontos() { return this._pontos; }
    incrementarAcertos() { this._acertos++; this._atualizarPontos(); }
    incrementarErros() { this._erros++; this._atualizarPontos(); } // Assume que erros podem diminuir pontos
    _atualizarPontos() {
        // Lógica de pontuação: 15 pontos por acerto, -5 por erro (não pode ser negativo)
        this._pontos = Math.max(0, (15 * this._acertos) - (5 * this._erros));
    }
    reset() {
        this._acertos = 0;
        this._erros = 0;
        this._pontos = 0;
    }
    // Método para atualizar dados com base na resposta do backend (se necessário no futuro)
    // updateFromServer(acertos, erros, pontos) {
    //     this._acertos = acertos;
    //     this._erros = erros;
    //     this._pontos = pontos;
    // }
}

class QuizData {
    constructor(
        urlPerguntas = 'assets/data/perguntas.json', // Fallback, não usado se dados injetados
        urlCategorias = 'assets/data/categorias.json', // Fallback
        urlOpcoes = 'assets/data/opcoes_resposta.json' // Fallback
    ) {
        this.urlPerguntas = urlPerguntas;
        this.urlCategorias = urlCategorias;
        this.urlOpcoes = urlOpcoes;
        this.perguntas = [];
        this.categorias = [];
        this.opcoesResposta = [];
        this.dadosCarregadosCompletamente = false;
    }

    async _fetchJson(url, required = true) {
        console.warn(`QuizData._fetchJson: Tentando buscar de ${url}. Isto é um fallback e indica que os dados pré-carregados não foram usados ou estavam incompletos.`);
        try {
            const timestamp = Date.now(); // Cache busting
            const response = await fetch(`${url}?t=${timestamp}`);
            if (!response.ok) {
                if (required) throw new Error(`Falha ao carregar ${url}: ${response.statusText} (status ${response.status})`);
                return [];
            }
            const data = await response.json();
            return Array.isArray(data) ? data : (data || []);
        } catch (error) {
            if (required) throw error;
            console.warn(`Erro ao processar ${url} (não obrigatório): ${error.message}. Retornando array vazio.`);
            return [];
        }
    }

    setPreloadedData(perguntasData, categoriasData, opcoesData) {
        this.perguntas = Array.isArray(perguntasData) ? perguntasData : [];
        this.categorias = Array.isArray(categoriasData) ? categoriasData : [];
        this.opcoesResposta = Array.isArray(opcoesData) ? opcoesData : [];

        this._validateDataIntegrity(); // Você pode implementar validações mais robustas aqui

        if (this.perguntas.length > 0) {
            this.dadosCarregadosCompletamente = true;
            console.log(`QUIZDATA: Dados pré-carregados com sucesso. Perguntas: ${this.perguntas.length}`);
        } else {
            this.dadosCarregadosCompletamente = false;
            console.warn(`QUIZDATA: Dados pré-carregados incompletos ou ausentes. Perguntas: ${this.perguntas.length}`);
        }
        return this.dadosCarregadosCompletamente;
    }

    async loadAllData() {
        if (this.dadosCarregadosCompletamente && this.perguntas && this.perguntas.length > 0) {
            console.log("QUIZDATA: Usando dados pré-carregados. Fetch de JSONs pulado.");
            return true;
        }
        console.log("QUIZDATA: Tentando carregar dados dos arquivos JSON (fallback)...");
        try {
            const [perguntasData, categoriasData, opcoesData] = await Promise.all([
                this._fetchJson(this.urlPerguntas, true),
                this._fetchJson(this.urlCategorias, true),
                this._fetchJson(this.urlOpcoes, true)
            ]);
            this.perguntas = perguntasData;
            this.categorias = categoriasData;
            this.opcoesResposta = opcoesData;

            if (!this.perguntas.length) {
                console.warn("QuizData.loadAllData (fetch): Nenhuma pergunta carregada.");
                this.dadosCarregadosCompletamente = false;
                return false;
            }
            this._validateDataIntegrity();
            this.dadosCarregadosCompletamente = true;
            console.log("QuizData.loadAllData (fetch): Dados carregados dos JSONs com sucesso. Perguntas:", this.perguntas.length);
            return true;
        } catch (error) {
            console.error("QuizData.loadAllData (fetch): Erro CRÍTICO ao carregar dados JSON:", error);
            this._resetProcessedData();
            throw error;
        }
    }
    _resetProcessedData() { this.perguntas = []; this.categorias = []; this.opcoesResposta = []; this.dadosCarregadosCompletamente = false; }
    _validateDataIntegrity() { /* TODO: Implementar validações de dados se necessário */ }
    getPerguntas() { return [...this.perguntas]; }
    getTotalPerguntas() { return this.perguntas.length; }
    getCategorias() { return [...this.categorias]; }
    getCategoriasHierarquicamente() {
        if (!this.categorias || this.categorias.length === 0) return [];
        const categoriasMap = new Map(this.categorias.map(cat => [cat.id_categoria, { ...cat, subcategorias: [] }]));
        const categoriasRaiz = [];
        categoriasMap.forEach(node => {
            if (node.id_categoria_pai === null || !categoriasMap.has(node.id_categoria_pai)) {
                categoriasRaiz.push(node);
            } else {
                const parentNode = categoriasMap.get(node.id_categoria_pai);
                if (parentNode) parentNode.subcategorias.push(node);
            }
        });
        const sortRecursive = (nodes) => {
            nodes.sort((a, b) => a.nome_categoria.localeCompare(b.nome_categoria));
            nodes.forEach(node => { if (node.subcategorias.length > 0) sortRecursive(node.subcategorias); });
        };
        sortRecursive(categoriasRaiz);
        return categoriasRaiz;
    }
    getOpcoesPorPerguntaId(idPergunta) { return this.opcoesResposta.filter(op => op.id_pergunta === idPergunta).sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0)); }
    getRelacaoPerguntaCategorias() {
        const relacao = [];
        this.perguntas.forEach(p => {
            if (p.categoria_ids && Array.isArray(p.categoria_ids)) {
                p.categoria_ids.forEach(catId => {
                    if (this.categorias.some(cat => cat.id_categoria === catId)) {
                        relacao.push({ id_pergunta: p.id_pergunta, id_categoria: catId });
                    }
                });
            }
        });
        return relacao;
    }
}

class QuizState {
    constructor() {
        this.allQuestions = [];
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.selectedCategories = []; // IDs das categorias selecionadas
        this.selectedDifficulties = ['all']; // 'all', 'fácil', 'médio', 'difícil'
        this.isInitialQuestionLoad = true;
        this.isQuickQuizMode = false;
        this.QUICK_QUIZ_COUNT = 10; // Número de perguntas para o quiz rápido
    }

    initialize(perguntas) { this.allQuestions = perguntas; this.resetQuizState(); }
    resetQuizState() {
        this.filteredQuestions = []; this.currentQuestionIndex = 0; this.isInitialQuestionLoad = true;
        this.allQuestions.forEach(q => { delete q.respostaDadaId; delete q.foiCorretaNaSessao; delete q.foiPulada; });
    }
    fullReset() { this.resetQuizState(); this.selectedCategories = []; this.isQuickQuizMode = false; this.selectedDifficulties = ['all']; }
    setQuickQuizMode(isQuick) { this.isQuickQuizMode = isQuick; }
    setFilters(selectedCategories = [], selectedDifficulties = ['all']) {
        this.selectedCategories = Array.isArray(selectedCategories) ? selectedCategories : [];
        this.selectedDifficulties = Array.isArray(selectedDifficulties) && selectedDifficulties.length > 0 ? selectedDifficulties : ['all'];
    }
    filterQuestions(todasCategorias, relacaoPerguntaCategorias) {
        this.resetQuizState();
        if (this.isQuickQuizMode) {
            if (!this.allQuestions.length) { this.filteredQuestions = []; return this.filteredQuestions; }
            const shuffled = [...this.allQuestions].sort(() => 0.5 - Math.random());
            this.filteredQuestions = shuffled.slice(0, Math.min(this.QUICK_QUIZ_COUNT, shuffled.length));
        } else {
            let perguntasPotenciais = [...this.allQuestions];
            if (this.selectedCategories.length > 0) {
                const idsCategoriasRelevantes = new Set();
                const getDescendentes = (categoriaIdNum) => {
                    if (idsCategoriasRelevantes.has(categoriaIdNum) || !todasCategorias.find(c => c.id_categoria === categoriaIdNum)) return;
                    idsCategoriasRelevantes.add(categoriaIdNum);
                    todasCategorias.filter(c => c.id_categoria_pai === categoriaIdNum).forEach(sub => getDescendentes(sub.id_categoria));
                };
                this.selectedCategories.forEach(selCatIdStr => { const id = parseInt(selCatIdStr); if (!isNaN(id)) getDescendentes(id); });
                const idsPerguntasComCategoria = new Set(relacaoPerguntaCategorias.filter(pc => idsCategoriasRelevantes.has(pc.id_categoria)).map(pc => pc.id_pergunta));
                perguntasPotenciais = perguntasPotenciais.filter(p => idsPerguntasComCategoria.has(p.id_pergunta));
            }
            if (!this.selectedDifficulties.includes('all') && this.selectedDifficulties.length > 0) {
                perguntasPotenciais = perguntasPotenciais.filter(p => p.nivel_dificuldade && this.selectedDifficulties.includes(p.nivel_dificuldade.toLowerCase()));
            }
            this.filteredQuestions = perguntasPotenciais;
        }
        return this.filteredQuestions;
    }
    getCurrentQuestion() { return this.filteredQuestions[this.currentQuestionIndex] ?? null; }
    getCurrentQuestionNumberForDisplay() { return this.currentQuestionIndex + 1; }
    getTotalFilteredQuestions() { return this.filteredQuestions.length; }
    isQuizComplete() { return this.currentQuestionIndex >= this.filteredQuestions.length; }
    isFirstQuestion() { return this.currentQuestionIndex === 0; }
    isLastQuestion() { return this.currentQuestionIndex === this.filteredQuestions.length - 1; }
    recordAnswer(opcaoId) { const q = this.getCurrentQuestion(); if (q && !q.hasOwnProperty('respostaDadaId')) { q.respostaDadaId = opcaoId; q.foiPulada = false; return true; } return false; }
    markNavigated() { this.isInitialQuestionLoad = false; }
    goToQuestion(index) { if (index >= 0 && index < this.filteredQuestions.length) { this.currentQuestionIndex = index; this.markNavigated(); return true; } return false; }
    goToNextQuestion() { if (this.currentQuestionIndex < this.filteredQuestions.length) { this.currentQuestionIndex++; this.markNavigated(); return true; } return false; }
    goToPreviousQuestion() { if (this.currentQuestionIndex > 0) { this.currentQuestionIndex--; this.markNavigated(); return true; } return false; }
}

class LayoutManager {
    constructor() {
        this.footerElement = document.getElementById('footer') || document.querySelector('.site-footer');
        this.hiddenClassName = 'u-is-hidden';
        if (!this.footerElement) console.warn("LayoutManager: Rodapé não encontrado!");
    }
    handleSectionChange(sectionId) {
        if (!this.footerElement) return;
        // Esta lógica pode ser simplificada se o footer sempre for visível ou controlado pelo Django
        // const quizContentActive = this.quizUI && this.quizUI.elements.quizSectionContent && !this.quizUI.elements.quizSectionContent.classList.contains(this.hiddenClassName);
        // if (sectionId === 'question-section' && quizContentActive) {
        //     this.footerElement.classList.add(this.hiddenClassName);
        // } else {
        //     this.footerElement.classList.remove(this.hiddenClassName);
        // }
    }
}

class ChallengeHubManager {
    constructor(uiElements, quizLogic) {
        this.elements = {
            challengeHubContainer: uiElements.challengeHubContainer, hubCustomizeQuizBtn: uiElements.hubCustomizeQuizBtn,
            hubQuickQuizBtn: uiElements.hubQuickQuizBtn, hubTotalQuestionsCount: uiElements.hubTotalQuestionsCount,
            hubQuickQuizCount: uiElements.hubQuickQuizCount, placeholderFiltrosContainer: uiElements.placeholderFiltrosContainer,
            closeFiltersAndShowHubBtn: uiElements.closeFiltersAndShowHubBtn
        };
        this.quizLogic = quizLogic; this.quizUI = null;
        Object.keys(this.elements).forEach(key => { if (!this.elements[key]) console.warn(`ChallengeHubManager: Elemento '${key}' não encontrado.`); });
    }
    setQuizUI(quizUIInstance) { this.quizUI = quizUIInstance; }
    showHub() { if (this.elements.challengeHubContainer) this.quizUI.showElement(this.elements.challengeHubContainer); if (this.elements.placeholderFiltrosContainer) this.quizUI.hideElement(this.elements.placeholderFiltrosContainer); }
    hideHub() { if (this.elements.challengeHubContainer) this.quizUI.hideElement(this.elements.challengeHubContainer); }
    updateTotalQuestionsCount(count) { if (this.elements.hubTotalQuestionsCount) this.elements.hubTotalQuestionsCount.textContent = count; }
    updateQuickQuizCount(count) { if (this.elements.hubQuickQuizCount) this.elements.hubQuickQuizCount.textContent = count; }
    setupEventListeners() {
        this.elements.hubCustomizeQuizBtn?.addEventListener('click', () => {
            this.hideHub();
            if (this.quizUI) { this.quizUI.toggleFilterPanel(true); if(this.elements.placeholderFiltrosContainer) this.quizUI.showElement(this.elements.placeholderFiltrosContainer); }
        });
        this.elements.hubQuickQuizBtn?.addEventListener('click', () => {
            if (this.quizLogic) { this.quizLogic.startQuickQuiz(); }
        });
        this.elements.closeFiltersAndShowHubBtn?.addEventListener('click', () => {
            if(this.quizUI) this.quizUI.toggleFilterPanel(false); this.showHub();
        });
    }
}

class QuizUI {
    constructor(onSectionChangeCallback = null) {
        this.hiddenClassName = 'u-is-hidden';
        this.currentSection = null;
        this.QUESTOES_POR_PAGINA_GRID = 5; this.TRANSITION_DURATION = 300;
        this.onSectionChange = onSectionChangeCallback;
        this.timerInterval = null; this.timerSeconds = 0; this.timerRunning = false;
        this.focusedElementBeforePanel = null; this.focusedElementBeforeExplanationModal = null;
        this.cacheDOMelements();
    }
    cacheDOMelements() {
        this.elements = {
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'),
            accountSection: document.getElementById('account-section'),
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),
            scorePanel: document.querySelector('.score-panel'),
            challengeHubContainer: document.getElementById('challenge-hub-container'),
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'), hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'), hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'),
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'), avisoContainer: document.getElementById('aviso-container'),
            avisoMensagem: document.querySelector('#aviso-container .card--aviso p'), placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),
            quizSectionContent: document.getElementById('quiz-section'),
            questionWrap: document.querySelector('#quiz-section .card--question-wrap'),
            progressContainer: document.getElementById('progress-container'), progressBarFill: document.getElementById('progress-bar-fill'),
            progressText: document.getElementById('progress-text'), questionTitle: document.getElementById('question-title'),
            categoriaTitulo: document.getElementById('categoria-titulo'), idQuestao: document.getElementById('id-questao'),
            perguntaTexto: document.getElementById('pergunta-texto'), perguntaImagem: document.getElementById('pergunta-imagem'),
            respostasContainer: document.getElementById('respostas-container'), referenciaQuestao: document.getElementById('referencia-questao'),
            navigationButtons: document.querySelector('#quiz-section .quiz-navigation'), prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'), feedbackAcessivel: document.getElementById('feedback-acessivel'),
            questionGridContainer: document.getElementById('question-grid-container'), btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),
            pontuacaoDisplay: document.getElementById('pontuacao'), acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'), timerDisplay: document.getElementById('timer-display'),
            resultadoCard: document.querySelector('#question-section .card--quiz-result'), resultadoTitulo: document.querySelector('#question-section .card--quiz-result .quiz-results__main-title'),
            resultadoPontos: document.getElementById('resultado-pontos'), resultadoAcertos: document.getElementById('resultado-acertos'),
            resultadoErros: document.getElementById('resultado-erros'), resultadoTempo: document.getElementById('resultado-tempo'),
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'), btnRecomecar: document.getElementById('btn-recomecar'),
            btnExplorarMais: document.getElementById('btn-explorar-mais'), confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'), cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn'),
            filterPanel: document.getElementById('filter-panel'), btnFecharFiltros: document.getElementById('btn-fechar-filtros'),
            filterPanelOverlay: document.getElementById('filter-panel-overlay'), categoryTreeList: document.getElementById('category-tree-list'),
            btnCatSelectAll: document.getElementById('btn-cat-select-all'), btnCatClearAll: document.getElementById('btn-cat-clear-all'),
            btnLimparFiltrosPainel: document.getElementById('btn-limpar-filtros-painel'), btnAplicarFiltrosPainel: document.getElementById('btn-aplicar-filtros-painel'),
            filterGroupDifficulty: document.getElementById('filter-group-difficulty'), btnToggleExplanation: document.getElementById('btn-toggle-explanation'),
            explanationModalOverlay: document.getElementById('explanation-modal-overlay'), explanationModalDialog: document.getElementById('explanation-modal-dialog'),
            explanationModalTitle: document.getElementById('explanationModalTitle'), btnCloseExplanationModal: document.getElementById('btn-close-explanation-modal'),
            explanationModalGeneralBlock: document.getElementById('explanation-modal-general-block'), explanationModalGeneralText: document.getElementById('explanation-modal-general-text'),
            explanationModalOptionsBlock: document.getElementById('explanation-modal-options-block'), explanationModalOptionsList: document.getElementById('explanation-modal-options-list'),
            explanationModalDivider: document.querySelector('.explanation-modal__divider'), explanationModalEmptyState: document.getElementById('explanation-modal-empty-state'),
            btnGotItExplanation: document.getElementById('btn-got-it-explanation'),
        };
        this._validateCache();
    }
    _validateCache() { Object.keys(this.elements).forEach(key => { if (!this.elements[key] && key !== 'homeSection' && key !== 'accountSection' && !(key.startsWith('navElement'))) { /* console.warn(`QuizUI: Elemento '${key}' não encontrado no DOM.`); */ } }); } // Ajustado para não avisar sobre seções de outras páginas
    showElement(el) { el?.classList.remove(this.hiddenClassName); }
    hideElement(el) { el?.classList.add(this.hiddenClassName); }
    stopTimer() { if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; } this.timerRunning = false; }
    resetTimer() { this.stopTimer(); this.timerSeconds = 0; if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = "00:00"; if (this.elements.resultadoTempo && !this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) this.elements.resultadoTempo.textContent = "00:00"; }
    startTimer() { if (this.timerRunning) return; this.timerRunning = true; this.timerInterval = setInterval(() => { this.timerSeconds++; if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = this._formatDisplayTime(this.timerSeconds); }, 1000); }
    _formatDisplayTime(seconds) { const m = Math.floor(seconds / 60); return `${String(m).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
    updateScoreDisplay(pontos, acertos, erros) { if (this.elements.pontuacaoDisplay) this.elements.pontuacaoDisplay.textContent = pontos; if (this.elements.acertosNumDisplay) this.elements.acertosNumDisplay.textContent = acertos; if (this.elements.errosNumDisplay) this.elements.errosNumDisplay.textContent = erros; }
    toggleFilterPanel(show) {
        const panel = this.elements.filterPanel, overlay = this.elements.filterPanelOverlay; if (!panel || !overlay) return;
        const pVis = 'filter-panel--visible', oVis = 'filter-panel-overlay--visible';
        if (show) {
            this.focusedElementBeforePanel = document.activeElement;
            if (this.quizState) { this.setCategoryTreeState(this.quizState.selectedCategories); this.setDifficultyState(this.quizState.selectedDifficulties); }
            this.showElement(overlay); this.showElement(panel);
            this.hideElement(this.elements.challengeHubContainer); this.showElement(this.elements.placeholderFiltrosContainer);
            panel.removeAttribute('aria-hidden'); overlay.removeAttribute('aria-hidden');
            requestAnimationFrame(() => { overlay.classList.add(oVis); panel.classList.add(pVis); panel.focus(); });
        } else {
            panel.classList.remove(pVis); overlay.classList.remove(oVis);
            const onEnd = () => { if (!panel.classList.contains(pVis)) { this.hideElement(panel); this.hideElement(overlay); panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true'); } panel.removeEventListener('transitionend', onEnd); this.focusedElementBeforePanel?.focus(); if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) && this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) { this.hideElement(this.elements.placeholderFiltrosContainer); this.showElement(this.elements.challengeHubContainer); }};
            panel.addEventListener('transitionend', onEnd, { once: true });
            setTimeout(() => { if (!panel.classList.contains(pVis)) { this.hideElement(panel); this.hideElement(overlay); panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true'); this.focusedElementBeforePanel?.focus(); if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) && this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) { this.hideElement(this.elements.placeholderFiltrosContainer); this.showElement(this.elements.challengeHubContainer); }} panel.removeEventListener('transitionend', onEnd); }, this.TRANSITION_DURATION + 70);
        }
    }
    showWarning(message) {
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer } = this.elements;
        if (avisoContainer && avisoMensagem) {
            avisoMensagem.textContent = message; avisoMensagem.setAttribute("role", "alert");
            this.showElement(avisoContainer);
            this.hideElement(placeholderFiltrosContainer);
            this.hideElement(challengeHubContainer);
            if (document.getElementById('question-section')) { this.hideQuizElements(); }
        }
    }
    clearWarning() {
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        this.hideElement(avisoContainer); avisoMensagem?.removeAttribute("role");
        if (document.getElementById('question-section')) {
            if (quizSectionContent?.classList.contains(this.hiddenClassName) && resultadoCard?.classList.contains(this.hiddenClassName)) {
                this.hideElement(placeholderFiltrosContainer);
                this.showElement(challengeHubContainer);
            }
        }
    }
    displayQuizContent(show = true) {
        const { quizSectionContent, btnEncerrarSessao, progressContainer, progressText, questionGridContainer, scorePanel, challengeHubContainer, placeholderFiltrosContainer, resultadoCard } = this.elements;
        if (show) {
            this.showElement(scorePanel); this.hideElement(challengeHubContainer); this.showElement(quizSectionContent);
            this.showElement(btnEncerrarSessao); this.showElement(progressContainer); this.showElement(progressText);
            this.showElement(questionGridContainer); this.clearWarning(); this.hideElement(placeholderFiltrosContainer); this.hideElement(resultadoCard);
        } else {
            this.hideElement(scorePanel); this.hideElement(quizSectionContent); this.hideElement(btnEncerrarSessao);
            this.hideProgressBar(); this.hideElement(questionGridContainer); this.toggleExplanationModal(false);
            this.hideElement(this.elements.btnToggleExplanation);
            if (resultadoCard && !resultadoCard.classList.contains(this.hiddenClassName)) this.hideElement(challengeHubContainer);
            else { this.showElement(challengeHubContainer); this.hideElement(placeholderFiltrosContainer); }
        }
    }
    hideQuizElements() {
        const { quizSectionContent, resultadoCard, questionGridContainer, btnEncerrarSessao } = this.elements;
        this.hideElement(quizSectionContent); this.hideElement(resultadoCard); this.hideElement(questionGridContainer);
        this.hideElement(btnEncerrarSessao); this.hideProgressBar(); this.toggleExplanationModal(false); this.hideElement(this.elements.btnToggleExplanation);
    }
    displayQuestion(perguntaObj, qNum, totalQ, categorias, relacaoPerguntaCategorias, isQuickQuizMode) {
        if (!perguntaObj) return console.error("Tentativa de exibir questão nula.");
        let tituloCat = "Questão";
        if (isQuickQuizMode) tituloCat = "Quiz Rápido";
        else {
            const idsCatPerg = relacaoPerguntaCategorias.filter(pc => pc.id_pergunta === perguntaObj.id_pergunta).map(pc => pc.id_categoria);
            if (idsCatPerg.length > 0) {
                let idCatMostrar = idsCatPerg[0];
                if (idsCatPerg.length > 1) { const catObjsPerg = categorias.filter(c => idsCatPerg.includes(c.id_categoria)); if (catObjsPerg.length > 0) idCatMostrar = catObjsPerg.reduce((deepest, curr) => this._getCategoriaProfundidade(curr, categorias) > this._getCategoriaProfundidade(deepest, categorias) ? curr : deepest, catObjsPerg[0]).id_categoria; }
                let caminho = []; let idAtual = idCatMostrar; let i = 0;
                while (idAtual != null && i < 5) { const catEnc = categorias.find(cat => cat.id_categoria === idAtual); if (catEnc) { caminho.unshift(catEnc.nome_categoria); idAtual = catEnc.id_categoria_pai; } else break; i++; }
                tituloCat = caminho.length > 0 ? caminho.join(' › ') : "Tópicos Diversos";
            }
        }
        if(this.elements.categoriaTitulo) this.elements.categoriaTitulo.innerText = tituloCat;
        if(this.elements.idQuestao) this.elements.idQuestao.innerText = qNum;
        if(this.elements.perguntaTexto) this.elements.perguntaTexto.textContent = perguntaObj.texto_pergunta;
        if(this.elements.referenciaQuestao) this.elements.referenciaQuestao.textContent = `Fonte: ${perguntaObj.referencia_bibliografica || "Não informada"}`;
        this.displayQuestionImage(perguntaObj.url_imagem, qNum); this.updateProgressBar(qNum, totalQ);
        this.elements.questionTitle?.focus({preventScroll:true}); this.hideElement(this.elements.btnToggleExplanation); this.toggleExplanationModal(false);
    }
    _getCategoriaProfundidade(cat,allCats){if(!cat||!allCats)return -1;let d=0;let pId=cat.id_categoria_pai;let iter=0;while(pId!=null&&iter<10){d++;const p=allCats.find(c=>c.id_categoria===pId);pId=p?p.id_categoria_pai:null;iter++;}return d;}
    displayQuestionImage(url,qNum){const el=this.elements.perguntaImagem;if(el){if(url?.trim()){el.src=url;el.alt=`Ilustração para questão ${qNum}`;this.showElement(el);el.onerror=()=>{this.hideElement(el);console.warn(`Erro ao carregar imagem: ${url}`);el.onerror=null;}}else{this.hideElement(el);el.src="";el.alt="";}}}
    generateAnswerButtons(perguntaId,opcoes,respostaDadaId,callbackResposta){const cont=this.elements.respostasContainer;if(!cont)return;cont.innerHTML='';if(!opcoes||opcoes.length===0){cont.innerHTML=`<p class="error-message">Opções não encontradas para pergunta ID ${perguntaId}.</p>`;return;}const temResp=typeof respostaDadaId!=='undefined'&&respostaDadaId!==null;const bCl='question-display__answer-option';opcoes.forEach(opt=>{const btn=document.createElement('button');btn.className=bCl;btn.textContent=opt.texto_opcao;btn.dataset.opcaoId=opt.id_opcao_resposta.toString();btn.disabled=temResp;btn.style.cursor=temResp?'default':'pointer';btn.tabIndex=temResp?-1:0;if(temResp){btn.classList.add(`${bCl}--answered`);if(opt.eh_correta)btn.classList.add(`${bCl}--correct`);else if(opt.id_opcao_resposta===respostaDadaId)btn.classList.add(`${bCl}--incorrect`);}else if(callbackResposta)btn.onclick=()=>callbackResposta(opt.id_opcao_resposta);cont.appendChild(btn);});}
    disableAnswers(){const c='question-display__answer-option',a=`${c}--answered`;this.elements.respostasContainer?.querySelectorAll(`button.${c}`).forEach(b=>{b.onclick=null;b.disabled=true;b.classList.add(a);b.style.cursor="default";b.tabIndex=-1;});}
    applyAnswerFeedback(selectedOpId, opcoes) {
        const baseCl = "question-display__answer-option", corrCl = `${baseCl}--correct`, incorrCl = `${baseCl}--incorrect`;
        let userCorrect = false;
        this.elements.respostasContainer?.querySelectorAll(`button.${baseCl}`).forEach(btn => {
            const btnOpId = parseInt(btn.dataset.opcaoId); const optData = opcoes.find(op => op.id_opcao_resposta === btnOpId); if (!optData) return;
            if (btnOpId === selectedOpId) { if (optData.eh_correta) { btn.classList.add(corrCl); userCorrect = true; } else btn.classList.add(incorrCl); }
            else if (optData.eh_correta) btn.classList.add(corrCl);
        });
        if(this.elements.feedbackAcessivel) this.elements.feedbackAcessivel.textContent = userCorrect ? "Você acertou!" : "Resposta incorreta.";
        const currentQ = this.quizState.getCurrentQuestion();
        const hasGenExpl = currentQ && currentQ.explicacao_resposta?.trim() !== '';
        const hasOptExpl = opcoes.some(op => op.feedback_opcao?.trim() !== '');
        if ((hasGenExpl || hasOptExpl) && this.elements.btnToggleExplanation) this.showElement(this.elements.btnToggleExplanation);
        else this.hideElement(this.elements.btnToggleExplanation);
    }
    toggleExplanationModal(show){const o=this.elements.explanationModalOverlay,d=this.elements.explanationModalDialog;if(!o||!d||!this.quizState||!this.quizData)return;const mVis='modal--visible';if(show){const q=this.quizState.getCurrentQuestion();if(!q)return;const opts=this.quizData.getOpcoesPorPerguntaId(q.id_pergunta);let hasCont=false;const genBlk=this.elements.explanationModalGeneralBlock,genTxt=this.elements.explanationModalGeneralText;if(q.explicacao_resposta?.trim()){genTxt.innerHTML=q.explicacao_resposta.replace(/\n/g,'<br>');this.showElement(genBlk);hasCont=true;}else this.hideElement(genBlk);const optsBlk=this.elements.explanationModalOptionsBlock,optsList=this.elements.explanationModalOptionsList;optsList.innerHTML='';let hasSpecOptFeed=false;opts.forEach(opt=>{if(opt.feedback_opcao?.trim()){hasSpecOptFeed=true;const li=document.createElement('li');li.classList.add(opt.eh_correta ? 'is-correct-feedback' : 'is-incorrect-feedback'); const origSpan=document.createElement('span');origSpan.className='option-original-text';origSpan.textContent=`Alternativa: "${opt.texto_opcao}"`;li.appendChild(origSpan);const feedSpan=document.createElement('span');feedSpan.className='option-feedback-value';feedSpan.classList.add(opt.eh_correta?'correct':'incorrect');feedSpan.innerHTML=opt.feedback_opcao.replace(/\n/g,'<br>');li.appendChild(feedSpan);optsList.appendChild(li);}});if(hasSpecOptFeed){this.showElement(optsBlk);hasCont=true;}else this.hideElement(optsBlk);const div=this.elements.explanationModalDivider;if(genBlk&&!genBlk.classList.contains(this.hiddenClassName)&&optsBlk&&!optsBlk.classList.contains(this.hiddenClassName)&&div)this.showElement(div);else if(div)this.hideElement(div);const empty=this.elements.explanationModalEmptyState;if(!hasCont&&empty)this.showElement(empty);else if(empty)this.hideElement(empty);this.focusedElementBeforeExplanationModal=document.activeElement;this.showElement(o);o.scrollTop;requestAnimationFrame(()=>{o.classList.add(mVis);d.focus();});}else{o.classList.remove(mVis);const end=()=>{if(!o.classList.contains(mVis))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforeExplanationModal?.focus();};o.addEventListener('transitionend',end,{once:true});setTimeout(()=>{if(!o.classList.contains(mVis))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforeExplanationModal?.focus();},this.TRANSITION_DURATION+70);}}
    updateProgressBar(current,total){const p=this.elements.progressContainer,f=this.elements.progressBarFill,x=this.elements.progressText;if(p&&f&&x){if(total>0){f.style.width=`${Math.min(current,total)/total*100}%`;x.textContent=`${current} / ${total}`;this.showElement(p);this.showElement(x);}else this.hideProgressBar();}}
    hideProgressBar(){this.hideElement(this.elements.progressContainer);this.hideElement(this.elements.progressText);if(this.elements.progressBarFill)this.elements.progressBarFill.style.width="0%";if(this.elements.progressText)this.elements.progressText.textContent="";}
    updateNavigationButtons(isFirst,isLast,totalQuestions){const n=this.elements.navigationButtons,p=this.elements.prevBtn,nxt=this.elements.nextBtn;if(n&&p&&nxt){if(totalQuestions<=0)this.hideElement(n);else{this.showElement(n);p.disabled=isFirst;nxt.disabled=false;nxt.textContent=isLast?"Ver Resultado":" Avançar";}}}
    renderQuestionGrid(questions,currentIndex,callbackSelectQuestion){ const container=this.elements.questionGridContainer; if(!container)return; if(!questions?.length){this.hideElement(container);return;} this.showElement(container);container.innerHTML=''; const currentPage=Math.floor(currentIndex/this.QUESTOES_POR_PAGINA_GRID); const startIndex=currentPage*this.QUESTOES_POR_PAGINA_GRID; const endIndex=Math.min(startIndex+this.QUESTOES_POR_PAGINA_GRID,questions.length); const arrBase='question-grid__arrow',itBase='question-grid__item',itCurr=`${itBase}--current`,itCorr=`${itBase}--correct`,itIncorr=`${itBase}--incorrect`, itSkip = `${itBase}--skipped`; container.appendChild(this._createGridArrow('prev',startIndex===0,()=>callbackSelectQuestion(Math.max(0,startIndex-1)),'Página Anterior de Questões',[`${arrBase}--left`])); for(let i=startIndex;i<endIndex;i++){ const q=questions[i];const item=document.createElement('button');item.className=itBase;item.textContent=i+1;item.dataset.index=i.toString();item.setAttribute('aria-label',`Ir para Questão ${i+1}`);item.onclick=()=>callbackSelectQuestion(i); if(q.hasOwnProperty('respostaDadaId')&&q.respostaDadaId!==null){ if(q.foiCorretaNaSessao===true)item.classList.add(itCorr); else if(q.foiCorretaNaSessao===false)item.classList.add(itIncorr); } else if (q.foiPulada) item.classList.add(itSkip); if(i===currentIndex)item.classList.add(itCurr); container.appendChild(item); } container.appendChild(this._createGridArrow('next',endIndex>=questions.length,()=>callbackSelectQuestion(Math.min(questions.length-1,endIndex)),'Próxima Página de Questões',[`${arrBase}--right`])); }
    _createGridArrow(dir,dis,cb,aria,xtra=[]){const b=document.createElement('button');b.className='question-grid__arrow';b.classList.add(...xtra,'u-is-circle');b.setAttribute('aria-label',aria);b.disabled=dis;b.onclick=cb;const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 -960 960 960");s.setAttribute("fill","currentColor");const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",dir==='prev'?"M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z":"M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z");s.appendChild(p);b.appendChild(s);return b;}
    _updateSubmenuHeight(subMenuElement, isExpanding) {
        if (!subMenuElement) return;
        if (isExpanding) {
            subMenuElement.style.display = 'block';
            void subMenuElement.offsetWidth;
            const scrollH = subMenuElement.scrollHeight;
            requestAnimationFrame(() => { subMenuElement.style.maxHeight = scrollH + "px"; });
        } else {
            requestAnimationFrame(() => { subMenuElement.style.maxHeight = '0'; });
        }
    }
    _updateParentSubmenuHeights(listItemElement) {
        let currentAncestor = listItemElement.parentElement?.closest('.category-tree__item--has-children');
        let level = 0;
        while (currentAncestor) {
            level++;
            const parentSubmenu = currentAncestor.querySelector(':scope > .category-tree__submenu');
            if (parentSubmenu && currentAncestor.getAttribute('aria-expanded') === 'true') {
                parentSubmenu.style.display = 'block';
                void parentSubmenu.offsetWidth;
                const newParentScrollHeight = parentSubmenu.scrollHeight;
                parentSubmenu.style.maxHeight = newParentScrollHeight + "px";
            }
            currentAncestor = currentAncestor.parentElement?.closest('.category-tree__item--has-children');
            if (level > 5) { console.error("Loop de atualização de pai muito profundo."); break; }
        }
    }
    generateCategoryTree(categoriesHierarchical) {
        const treeContainer = this.elements.categoryTreeList;
        if (!treeContainer) return;
        treeContainer.innerHTML = '';
        const createTreeNodes = (nodes, parentElement, level = 0) => {
            nodes.forEach(catNode => {
                const listItem = document.createElement('li');
                listItem.className = 'category-tree__item';
                listItem.setAttribute('role', 'treeitem');
                listItem.setAttribute('aria-checked', 'false');
                const labelWrapper = document.createElement('div');
                labelWrapper.className = 'category-tree__label-wrapper';
                const inputCheckbox = document.createElement('input');
                inputCheckbox.type = 'checkbox'; inputCheckbox.id = `cat-tree-${catNode.id_categoria}`;
                inputCheckbox.className = 'category-tree__input u-sr-only'; inputCheckbox.value = catNode.id_categoria.toString();
                inputCheckbox.tabIndex = -1; inputCheckbox.addEventListener('change', (e) => this.handleCategoryCheckboxChange(e.target));
                const label = document.createElement('label');
                label.htmlFor = inputCheckbox.id; label.className = 'category-tree__label';
                label.textContent = catNode.nome_categoria; label.tabIndex = 0;
                label.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { inputCheckbox.checked = !inputCheckbox.checked; inputCheckbox.dispatchEvent(new Event('change', { bubbles: true })); e.preventDefault(); } });
                if (catNode.subcategorias && catNode.subcategorias.length > 0) {
                    listItem.classList.add('category-tree__item--has-children'); listItem.setAttribute('aria-expanded', 'false');
                    const toggleButton = document.createElement('button');
                    toggleButton.type = 'button'; toggleButton.className = 'category-tree__toggle';
                    toggleButton.setAttribute('aria-label', `Expandir categoria ${catNode.nome_categoria}`);
                    toggleButton.setAttribute('aria-expanded', 'false');
                    toggleButton.innerHTML = `<span class="material-symbols-outlined">chevron_right</span>`;
                    labelWrapper.appendChild(toggleButton); labelWrapper.appendChild(inputCheckbox); labelWrapper.appendChild(label);
                    const subMenu = document.createElement('ul');
                    subMenu.className = 'category-tree__submenu'; subMenu.setAttribute('role', 'group');
                    createTreeNodes(catNode.subcategorias, subMenu, level + 1);
                    listItem.appendChild(labelWrapper); listItem.appendChild(subMenu);
                    const toggleAction = (event) => {
                        event.stopPropagation();
                        const isCurrentlyExpanded = listItem.getAttribute('aria-expanded') === 'true';
                        const newExpandedState = !isCurrentlyExpanded;
                        listItem.setAttribute('aria-expanded', String(newExpandedState));
                        toggleButton.setAttribute('aria-expanded', String(newExpandedState));
                        toggleButton.setAttribute('aria-label', `${newExpandedState ? 'Recolher' : 'Expandir'} categoria ${catNode.nome_categoria}`);
                        toggleButton.querySelector('.material-symbols-outlined').textContent = newExpandedState ? 'expand_more' : 'chevron_right';
                        this._updateSubmenuHeight(subMenu, newExpandedState);
                        if (newExpandedState) subMenu.classList.add('category-tree__submenu--expanded');
                        else {
                            const transitionEndHandler = () => { if (listItem.getAttribute('aria-expanded') === 'false') subMenu.classList.remove('category-tree__submenu--expanded'); subMenu.removeEventListener('transitionend', transitionEndHandler); };
                            subMenu.addEventListener('transitionend', transitionEndHandler, { once: true });
                            setTimeout(() => { if (listItem.getAttribute('aria-expanded') === 'false') subMenu.classList.remove('category-tree__submenu--expanded'); subMenu.removeEventListener('transitionend', transitionEndHandler); }, this.TRANSITION_DURATION + 70);
                        }
                        this._updateParentSubmenuHeights(listItem);
                    };
                    toggleButton.addEventListener('click', toggleAction);
                    toggleButton.addEventListener('keydown', (event) => { if (event.key === ' ' || event.key === 'Enter') { toggleAction(event); event.preventDefault(); } });
                } else {
                    labelWrapper.appendChild(inputCheckbox); labelWrapper.appendChild(label); listItem.appendChild(labelWrapper);
                }
                parentElement.appendChild(listItem);
            });
        };
        createTreeNodes(categoriesHierarchical, treeContainer);
        const parentListItems = Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children') || []);
        for (let i = parentListItems.length - 1; i >= 0; i--) this.updateParentCheckboxState(parentListItems[i]);
    }
    handleCategoryCheckboxChange(checkboxElement) {
        const isChecked = checkboxElement.checked; const listItem = checkboxElement.closest('.category-tree__item'); if (!listItem) return;
        checkboxElement.classList.remove('is-indeterminate'); listItem.setAttribute('aria-checked', String(isChecked));
        const childCheckboxes = listItem.querySelectorAll(':scope > .category-tree__submenu .category-tree__input');
        childCheckboxes.forEach(childCb => { childCb.checked = isChecked; childCb.classList.remove('is-indeterminate'); const childLi = childCb.closest('.category-tree__item'); if (childLi) childLi.setAttribute('aria-checked', String(isChecked)); });
        this.updateParentCheckboxState(listItem.parentElement?.closest('.category-tree__item'));
    }
    updateParentCheckboxState(parentListItem) {
        if (!parentListItem) return; const parentCheckbox = parentListItem.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input'); if (!parentCheckbox) return;
        const childListItems = parentListItem.querySelectorAll(':scope > .category-tree__submenu > .category-tree__item'); if (childListItems.length === 0) return;
        let todosMarcados = true, nenhumMarcado = true, algumIndeterminado = false;
        childListItems.forEach(childLi => {
            const childInput = childLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');
            if (childInput) {
                if (childInput.checked && !childInput.classList.contains('is-indeterminate')) nenhumMarcado = false;
                else if (childInput.classList.contains('is-indeterminate')) { todosMarcados = false; nenhumMarcado = false; algumIndeterminado = true; }
                else todosMarcados = false;
            } else todosMarcados = false;
        });
        parentCheckbox.classList.remove('is-indeterminate');
        if (algumIndeterminado || (!todosMarcados && !nenhumMarcado)) { parentCheckbox.checked = false; parentCheckbox.classList.add('is-indeterminate'); parentListItem.setAttribute('aria-checked', 'mixed'); }
        else if (todosMarcados) { parentCheckbox.checked = true; parentListItem.setAttribute('aria-checked', 'true'); }
        else { parentCheckbox.checked = false; parentListItem.setAttribute('aria-checked', 'false'); }
        this.updateParentCheckboxState(parentListItem.parentElement?.closest('.category-tree__item'));
    }
    getSelectedCategoriesFromTree(){const ids=[];this.elements.categoryTreeList?.querySelectorAll('.category-tree__input').forEach(cb=>{if(cb.checked&&!cb.classList.contains('is-indeterminate'))ids.push(cb.value);});return ids;}
    getSelectedDifficulties(){const diffCbs=this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])');const selSpecs=[];diffCbs?.forEach(cb=>{if(cb.checked)selSpecs.push(cb.value);});const allCb=this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');return(allCb?.checked||selSpecs.length===0)?['all']:selSpecs;}
    setCategoryTreeState(selectedIds=[]){const allCbs=Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input')||[]);allCbs.forEach(cb=>{cb.checked=selectedIds.includes(cb.value);cb.classList.remove('is-indeterminate');const li=cb.closest('.category-tree__item');if(li)li.setAttribute('aria-checked',String(cb.checked));});const pLis=Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children')||[]);for(let i=pLis.length-1;i>=0;i--)this.updateParentCheckboxState(pLis[i]);}
    setDifficultyState(difficulties=['all']){const allCb=this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');const specCbs=Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])')||[]);if(difficulties.includes('all')){if(allCb)allCb.checked=true;specCbs.forEach(cb=>cb.checked=false);}else{if(allCb)allCb.checked=false;specCbs.forEach(cb=>{cb.checked=difficulties.includes(cb.value);});}}
    showResults(userData, totalQuestions) {
        const { resultadoCard, resultadoTitulo, resultadoPontos, resultadoAcertos, resultadoErros, resultadoTempo, resultadoMensagemMotivacional, scorePanel, challengeHubContainer } = this.elements;
        if (!resultadoCard || !userData) return;
        this.hideQuizElements(); this.hideElement(scorePanel); this.hideElement(challengeHubContainer); this.hideElement(this.elements.placeholderFiltrosContainer);
        if(resultadoTitulo) resultadoTitulo.textContent = "Seu Desempenho Final";
        if(resultadoPontos) resultadoPontos.textContent = userData.pontos;
        if(resultadoAcertos) resultadoAcertos.textContent = userData.acertos;
        if(resultadoErros) resultadoErros.textContent = userData.erros;
        if(resultadoTempo) resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds);
        if(resultadoMensagemMotivacional) {
            const p = userData.pontos, t = totalQuestions, a = userData.acertos; let m = "Continue praticando para melhorar!";
            if (t > 0) { const max = t * 15; if (p >= max * 0.9) m = "Resultado Incrível! Parabéns!"; else if (p >= max * 0.7) m = "Excelente desempenho! Continue assim!"; else if (p >= max * 0.5) m = "Muito bom! Você está no caminho certo."; }
            else if (p === 0 && a === 0 && userData.erros === 0 && t === 0) m = "Nenhuma questão encontrada. Ajuste os filtros ou tente um Quiz Rápido.";
            else if (p === 0 && t > 0) m = "Ops! Nenhuma questão acertada. Revise o conteúdo e tente novamente!";
            resultadoMensagemMotivacional.textContent = m;
        }
        this.showElement(resultadoCard); resultadoTitulo?.focus();
    }
    hideResults() { this.hideElement(this.elements.resultadoCard); }
    toggleConfirmModal(show) {const o=this.elements.confirmEncerrarOverlay;if(!o)return;const m='modal--visible';if(show){this.focusedElementBeforePanel=document.activeElement;this.showElement(o);o.scrollTop;requestAnimationFrame(()=>{o.classList.add(m);this.elements.cancelEncerrarBtn?.focus();});}else{o.classList.remove(m);const end=()=>{if(!o.classList.contains(m))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforePanel?.focus();};o.addEventListener('transitionend',end,{once:true});setTimeout(()=>{if(!o.classList.contains(m))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforePanel?.focus();},this.TRANSITION_DURATION+70);}}
    scrollToQuestionStart(){const t=this.elements.questionTitle;if(this.currentSection==="question-section"&&t)t.scrollIntoView({behavior:"smooth",block:"nearest"});}
    focusNextButton(preventScroll=false){this.elements.nextBtn?.focus({preventScroll:preventScroll});}
    smoothScrollToNextButton(){const t=this.elements.navigationButtons;t&&t.scrollIntoView({behavior:"smooth",block:"nearest"});}
}

class QuizLogic {
    constructor(quizState, quizUI, userData, quizData) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.challengeHubManager = null;
        this.currentSessionId = null; // ID da sessão de quiz atual com o backend
    }

    setChallengeHubManager(manager) { this.challengeHubManager = manager; }

    applyFiltersAndStartQuiz() {
        const selCatIds = this.ui.getSelectedCategoriesFromTree();
        const selDiffs = this.ui.getSelectedDifficulties();
        this.state.setQuickQuizMode(false);
        this.state.setFilters(selCatIds, selDiffs);
        this.ui.toggleFilterPanel(false);
        this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
        this.startQuiz(selCatIds);
    }

    clearAllFiltersInPanel() { this.ui.setCategoryTreeState([]); this.ui.setDifficultyState(['all']); }

    async startQuiz(selectedCategoryIds = []) {
        this.user.reset();
        this.state.filterQuestions(this.quizData.getCategorias(), this.quizData.getRelacaoPerguntaCategorias());
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);

        const fQs = this.state.filteredQuestions;
        if (fQs.length > 0) {
            try {
                const response = await fetch(DJANGO_URLS.start_quiz_session, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({
                        modo_quiz: this.state.isQuickQuizMode ? 'Rápido' : 'Por Categoria',
                        categoria_ids: this.state.isQuickQuizMode ? [] : selectedCategoryIds,
                        total_perguntas_sessao: fQs.length,
                    }),
                });
                const data = await response.json();
                if (response.ok && data.status === 'success' && data.session_id) {
                    this.currentSessionId = data.session_id;
                    console.log("Backend: Sessão de Quiz iniciada, ID:", this.currentSessionId);
                    this.ui.hideElement(this.ui.elements.challengeHubContainer);
                    this.ui.showElement(this.ui.elements.scorePanel);
                    this.ui.displayQuizContent(true);
                    this._displayCurrentQuestion(false);
                    this.ui.startTimer();
                } else {
                    console.error("Backend: Falha ao iniciar sessão de quiz:", data.message || response.statusText);
                    this.ui.showWarning(`Não foi possível iniciar a sessão de quiz: ${data.message || 'Erro do servidor'}. Tente novamente.`);
                }
            } catch (error) {
                console.error("Erro de rede ao iniciar sessão de quiz:", error);
                this.ui.showWarning("Erro de conexão ao iniciar o quiz. Verifique sua internet.");
            }
        } else {
            this.ui.displayQuizContent(false);
            this.ui.showWarning(this.state.isQuickQuizMode ? "Nenhuma pergunta disponível para um Quiz Rápido no momento." : "Nenhuma questão encontrada com os filtros selecionados. Tente outros filtros!");
            this.ui.stopTimer();
        }
    }

    startQuickQuiz() {
        this.state.setQuickQuizMode(true);
        this.state.setFilters([], ['all']);
        this.ui.toggleFilterPanel(false); // Garante que o painel de filtros seja fechado
        this.startQuiz();
    }

    async answerQuestion(selectedOpId) {
        const currQ = this.state.getCurrentQuestion();
        if (!currQ) { console.error("Erro: Tentando responder sem questão atual."); return; }
        if (!this.currentSessionId) { console.warn("Aviso: ID da sessão de quiz não definido. A resposta não será salva no backend."); }

        const opts = this.quizData.getOpcoesPorPerguntaId(currQ.id_pergunta);
        const selOpt = opts.find(op => op.id_opcao_resposta === selectedOpId);

        if (selOpt && this.state.recordAnswer(selectedOpId)) {
            currQ.foiCorretaNaSessao = selOpt.eh_correta; // Lógica frontend para feedback imediato
            if (selOpt.eh_correta) this.user.incrementarAcertos();
            else this.user.incrementarErros();

            this.ui.disableAnswers();
            this.ui.applyAnswerFeedback(selectedOpId, opts);
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.focusNextButton(true);
            this.ui.smoothScrollToNextButton();

            if (this.currentSessionId) {
                try {
                    const response = await fetch(DJANGO_URLS.register_answer, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken'),
                        },
                        body: JSON.stringify({
                            session_id: this.currentSessionId,
                            pergunta_id: currQ.id_pergunta,
                            opcao_id: selectedOpId,
                        }),
                    });
                    const data = await response.json();
                    if (response.ok && data.status === 'success') {
                        console.log("Backend: Resposta registrada. Correta (backend):", data.foi_correta);
                        // Opcional: sincronizar estado do frontend com o backend se houver discrepâncias
                        // if (data.foi_correta !== currQ.foiCorretaNaSessao) {
                        //     console.warn("Discrepância entre frontend e backend na correção da resposta!");
                        // }
                    } else {
                        console.error("Backend: Falha ao registrar resposta:", data.message || response.statusText);
                    }
                } catch (error) {
                    console.error("Erro de rede ao registrar resposta:", error);
                }
            }
        }
    }

    nextQuestion() {
        const isLast = this.state.isLastQuestion();
        const currentQ = this.state.getCurrentQuestion();
        if (currentQ && !currentQ.hasOwnProperty('respostaDadaId') && !currentQ.foiPulada) {
            currentQ.foiPulada = true;
            this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            // Informar o backend sobre a pergunta pulada (opcional, mas bom para estatísticas mais precisas)
            if (this.currentSessionId) {
                fetch(DJANGO_URLS.register_answer, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken')},
                    body: JSON.stringify({ session_id: this.currentSessionId, pergunta_id: currentQ.id_pergunta, opcao_id: null })
                }).then(res => res.json()).then(data => console.log("Backend: Pergunta pulada registrada.", data))
                  .catch(err => console.error("Erro ao registrar pulo no backend:", err));
            }
        }
        if (this.state.goToNextQuestion()) {
            if (this.state.isQuizComplete()) this.endQuiz();
            else this._displayCurrentQuestion();
        } else if (isLast) {
            this.endQuiz();
        }
    }
    previousQuestion() { if (this.state.goToPreviousQuestion()) this._displayCurrentQuestion(); }
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
                if(shouldScroll) this.ui.scrollToQuestionStart();
                if (p.hasOwnProperty('respostaDadaId') && p.respostaDadaId !== null) this.ui.applyAnswerFeedback(p.respostaDadaId, opts);
            } else this.endQuiz(); // Pode acontecer se filteredQuestions ficar vazio inesperadamente
        };
        if(!init && el){ el.classList.add("is-fading-out"); await new Promise(resolve => { let ended = false; const handler = () => { if (!ended) { el.removeEventListener("transitionend", handler); ended = true; resolve(); } }; el.addEventListener("transitionend", handler); setTimeout(() => { if (!ended) { el.removeEventListener("transitionend", handler); ended = true; resolve(); } }, this.ui.TRANSITION_DURATION + 50); }); el.classList.remove("is-fading-out"); el.classList.add("is-transparent"); requestAnimationFrame(() => { logic(); requestAnimationFrame(() => el.classList.remove("is-transparent")); }); }
        else { logic(); if (el) el.classList.remove("is-fading-out", "is-transparent"); if (this.state.getTotalFilteredQuestions() > 0) this.state.markNavigated(); }
    }

    async endQuiz() {
        this.ui.stopTimer();
        this.ui.toggleExplanationModal(false);

        if (this.currentSessionId) {
            try {
                const response = await fetch(DJANGO_URLS.end_quiz_session, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({
                        session_id: this.currentSessionId,
                        tempo_total_segundos: this.ui.timerSeconds,
                        // O backend já deve ter os acertos/erros/pontos corretos
                    }),
                });
                const data = await response.json();
                if (response.ok && data.status === 'success') {
                    console.log("Backend: Sessão finalizada. Pontuação (backend):", data.pontuacao_final);
                    // Usar os dados do frontend para exibição, já que UserData está atualizado
                    this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
                } else {
                    console.error("Backend: Falha ao finalizar sessão:", data.message || response.statusText);
                    this.ui.showResults(this.user, this.state.getTotalFilteredQuestions()); // Mostrar com dados do frontend
                }
            } catch (error) {
                console.error("Erro de rede ao finalizar sessão:", error);
                this.ui.showResults(this.user, this.state.getTotalFilteredQuestions()); // Mostrar com dados do frontend
            }
            this.currentSessionId = null;
        } else {
            console.warn("Nenhum ID de sessão ativo para finalizar no backend.");
            this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        }
    }

    restartQuiz() {
        this.user.reset();
        this.state.fullReset();
        this.currentSessionId = null; // Limpar ID da sessão
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);
        this.ui.displayQuizContent(false); // Esconde a UI do quiz ativo
        this.ui.clearWarning();
        this.clearAllFiltersInPanel();
        if (this.challengeHubManager) this.challengeHubManager.showHub();
        this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
    }

    async forceEndQuiz() { // Já que endQuiz agora é async
        this.ui.stopTimer();
        await this.endQuiz(); // Espera a finalização da sessão no backend
        this.ui.toggleConfirmModal(false);
        this.ui.toggleExplanationModal(false);
    }
}

class App {
    constructor() {
        this.userData = new UserData();
        this.quizData = new QuizData();
        this.quizState = new QuizState();
        this.layoutManager = new LayoutManager();
        this.quizUI = new QuizUI(this.layoutManager.handleSectionChange.bind(this.layoutManager));
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData, this.quizData);
        this.challengeHubManager = new ChallengeHubManager(this.quizUI.elements, this.quizLogic);

        this.quizUI.quizState = this.quizState; // Injetar dependências
        this.quizUI.quizData = this.quizData;
        this.quizLogic.setChallengeHubManager(this.challengeHubManager);
        this.challengeHubManager.setQuizUI(this.quizUI);

        // Carregar URLs do Django
        const urlsElement = document.getElementById('django-urls');
        if (urlsElement) {
            try {
                const parsedUrls = JSON.parse(urlsElement.textContent);
                DJANGO_URLS.start_quiz_session = parsedUrls.start_quiz_session || DJANGO_URLS.start_quiz_session;
                DJANGO_URLS.register_answer = parsedUrls.register_answer || DJANGO_URLS.register_answer;
                DJANGO_URLS.end_quiz_session = parsedUrls.end_quiz_session || DJANGO_URLS.end_quiz_session;
                console.log("URLs do Django carregadas:", DJANGO_URLS);
            } catch (e) {
                console.error("Erro ao parsear URLs do Django:", e, "Usando fallbacks.");
            }
        } else {
            console.warn("Elemento #django-urls não encontrado. Usando URLs de fallback.");
        }
    }

    async initialize() {
        console.log("APP INITIALIZE: Começando.");
        try {
            if (window.djangoQuizData && typeof window.djangoQuizData === 'object' &&
                Array.isArray(window.djangoQuizData.perguntas) &&
                Array.isArray(window.djangoQuizData.categorias) &&
                Array.isArray(window.djangoQuizData.opcoesResposta)
            ) {
                this.quizData.setPreloadedData(
                    window.djangoQuizData.perguntas,
                    window.djangoQuizData.categorias,
                    window.djangoQuizData.opcoesResposta
                );
            } else {
                console.warn("APP.INITIALIZE: window.djangoQuizData não está no formato esperado ou está incompleto.");
            }

            const dadosForamCarregados = await this.quizData.loadAllData();

            if (dadosForamCarregados && this.quizData.getPerguntas().length > 0) {
                this.quizState.initialize(this.quizData.getPerguntas());
                this.challengeHubManager.updateTotalQuestionsCount(this.quizData.getTotalPerguntas());
                this.challengeHubManager.updateQuickQuizCount(this.quizState.QUICK_QUIZ_COUNT);
                if (this.quizData.getCategorias().length > 0) {
                    this.quizUI.generateCategoryTree(this.quizData.getCategoriasHierarquicamente());
                } else {
                    console.warn("App.initialize: Nenhuma categoria carregada, a árvore de categorias não será gerada.");
                }
                this.setupEventListeners();

                if (document.getElementById('home-section')) {
                    this.quizUI.currentSection = 'home-section';
                    this.quizUI.hideElement(this.quizUI.elements.questionSection);
                    this.quizUI.hideElement(this.quizUI.elements.accountSection);
                } else if (document.getElementById('question-section')) {
                    this.quizUI.currentSection = 'question-section-page';
                    if (this.challengeHubManager) this.challengeHubManager.showHub();
                    this.quizUI.hideElement(this.quizUI.elements.placeholderFiltrosContainer);
                    this.quizUI.hideElement(this.quizUI.elements.quizSectionContent);
                    this.quizUI.hideElement(this.quizUI.elements.resultadoCard);
                    this.quizUI.hideElement(this.quizUI.elements.scorePanel);
                    this.quizUI.hideElement(this.quizUI.elements.homeSection);
                    this.quizUI.hideElement(this.quizUI.elements.accountSection);
                } else if (document.getElementById('account-section')) {
                    this.quizUI.currentSection = 'account-section-page';
                    this.quizUI.hideElement(this.quizUI.elements.homeSection);
                    this.quizUI.hideElement(this.quizUI.elements.questionSection);
                } else {
                    this.quizUI.currentSection = 'home-section'; // Fallback
                    if (this.quizUI.elements.homeSection) this.quizUI.showElement(this.quizUI.elements.homeSection);
                    console.warn("App.initialize: Nenhuma seção principal identificada.");
                }
                console.log("App.initialize: Seção da página atual (lógica UI):", this.quizUI.currentSection);

            } else {
                console.error("APP.INITIALIZE: Falha ao carregar dados das perguntas. Quiz não pode ser iniciado.");
                this.handleLoadError("Não foi possível carregar as perguntas do quiz. Verifique o console.");
            }
        } catch (error) {
            console.error("APP.INITIALIZE: Erro fatal durante a inicialização:", error);
            this.handleLoadError(`Erro fatal ao inicializar o quiz: ${error.message}`);
        }
    }

    handleLoadError(message) {
        console.error("handleLoadError:", message);
        try {
            if (this.quizUI && document.getElementById('question-section')) {
                 this.quizUI.showWarning(message);
            } else if (this.quizUI && this.quizUI.elements.homeSection) {
                 if(this.quizUI.elements.homeSection) this.quizUI.showElement(this.quizUI.elements.homeSection);
                 const homeWarningContainer = this.quizUI.elements.homeSection.querySelector('.hero-block') || this.quizUI.elements.homeSection;
                 const homeWarning = document.createElement('p');
                 homeWarning.textContent = message;
                 homeWarning.style.color = 'red'; homeWarning.style.backgroundColor = 'white'; homeWarning.style.padding = '10px'; homeWarning.style.border = '1px solid red'; homeWarning.style.textAlign = 'center';
                 homeWarningContainer.prepend(homeWarning);
            } else {
                 alert(message);
            }
            this.disableCoreFunctionality();
        }
        catch (uiError) {
            console.error("Erro adicional na UI ao tentar mostrar erro de carregamento:", uiError);
            alert(message + `\nErro adicional na UI: ${uiError.message}`);
        }
    }

    disableCoreFunctionality() {
        console.warn("Desabilitando funcionalidades principais do quiz devido a erro de carregamento.");
        if (this.quizUI && this.quizUI.elements) {
            this.quizUI.hideElement(this.quizUI.elements.hubCustomizeQuizBtn);
            this.quizUI.hideElement(this.quizUI.elements.hubQuickQuizBtn);
            const goToHubLink = document.getElementById('go-to-challenges-hub-link');
            if (goToHubLink) this.quizUI.hideElement(goToHubLink);

            if (this.quizUI.elements.challengeHubContainer) {
                 const title = this.quizUI.elements.challengeHubContainer.querySelector('.challenge-hub__title');
                 if (title) title.textContent = "Erro ao Carregar";
                 const subtitle = this.quizUI.elements.challengeHubContainer.querySelector('.challenge-hub__subtitle');
                 if (subtitle) subtitle.textContent = "Não foi possível carregar as questões.";
                 if(document.getElementById('question-section') && this.quizUI.elements.challengeHubContainer.classList.contains('u-is-hidden')) {
                    this.quizUI.showElement(this.quizUI.elements.challengeHubContainer);
                 }
            }
        }
    }

    setupEventListeners() {
        this.challengeHubManager.setupEventListeners();
        this.quizUI.elements.btnFecharFiltros?.addEventListener('click', () => this.quizUI.toggleFilterPanel(false));
        this.quizUI.elements.filterPanelOverlay?.addEventListener('click', (e) => { if (e.target === this.quizUI.elements.filterPanelOverlay) this.quizUI.toggleFilterPanel(false); });
        this.quizUI.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => this.quizLogic.applyFiltersAndStartQuiz());
        this.quizUI.elements.btnLimparFiltrosPainel?.addEventListener('click', () => this.quizLogic.clearAllFiltersInPanel());
        this.quizUI.elements.btnCatSelectAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState(this.quizData.getCategorias().map(c=>c.id_categoria.toString())); });
        this.quizUI.elements.btnCatClearAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState([]); });
        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());
        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());
        this.quizUI.elements.btnExplorarMais?.addEventListener('click', () => {
            const homeLink = document.querySelector('.site-header__logo a, .main-nav__link[data-section-target-django="home"], .bottom-nav__link[data-section-target-django="home"]');
            if (homeLink && homeLink.href) window.location.href = homeLink.href;
            else console.warn("Link para home não encontrado para 'Explorar Mais'");
        });
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => { this.quizLogic.forceEndQuiz(); }); // Agora async
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => { this.quizUI.toggleConfirmModal(false); });
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (e)=>{if(e.target===this.quizUI.elements.confirmEncerrarOverlay)this.quizUI.toggleConfirmModal(false);});
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.quizUI.elements.filterPanel?.classList.contains('filter-panel--visible')) this.quizUI.toggleFilterPanel(false);
                if (this.quizUI.elements.explanationModalOverlay?.classList.contains('modal--visible')) this.quizUI.toggleExplanationModal(false);
                if (this.quizUI.elements.confirmEncerrarOverlay?.classList.contains('modal--visible')) this.quizUI.toggleConfirmModal(false);
            }
        });
        const diffInputs = this.quizUI.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]');
        const allDiffCb = this.quizUI.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        diffInputs?.forEach(input => {
            input.addEventListener('change', () => {
                if (input.value === 'all' && input.checked) { diffInputs.forEach(other => { if (other.value !== 'all') other.checked = false; }); }
                else if (input.value !== 'all' && input.checked) { if (allDiffCb) allDiffCb.checked = false; }
                const anySpecificChecked = Array.from(diffInputs).some(cb => cb.value !== 'all' && cb.checked);
                if (!anySpecificChecked && allDiffCb && !allDiffCb.checked) allDiffCb.checked = true;
            });
        });
        this.quizUI.elements.btnToggleExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(true));
        this.quizUI.elements.btnCloseExplanationModal?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.btnGotItExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.explanationModalOverlay?.addEventListener('click', (e)=>{if(e.target===this.quizUI.elements.explanationModalOverlay)this.quizUI.toggleExplanationModal(false);});

        // Event listener para o formulário de perfil (simulado, pois não há endpoint real no backend ainda)
        const profileForm = document.querySelector('#account-section .profile-form'); // Se você tiver um form com esta classe
        if (profileForm) {
            profileForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                // Lógica de submissão do formulário de perfil aqui (simulada ou real)
                console.log('Formulário de perfil submetido (simulação).');
                alert('Funcionalidade de salvar perfil ainda não implementada no backend.');
            });
        }
    }
}

// Função para obter o CSRF token dos cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', () => {
    console.log("MedQuiz: DOM completamente carregado e parseado.");
    const app = new App();
    app.initialize();
});