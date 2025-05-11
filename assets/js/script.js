/**
 * script.js
 * - Implements a slide-out filter panel for categories and other potential filters.
 * - Loads data from separate JSON files: perguntas.json, categorias.json, opcoes_resposta.json.
 * - Supports hierarchical category display and selection in the filter panel.
 * - Quiz by Category flujo is now driven by "Apply Filters" from the panel.
 * - Quick Quiz remains N random questions.
 * - Includes a placeholder/guidance box before filters are applied.
 * - Difficulty filter now supports multiple selections.
 * - Implements detailed answer explanations in a dedicated modal.
 * - Introduces a Challenge Hub for selecting quiz modes.
 */

// --- Módulo: UserData (Gerenciamento de dados do usuário) ---
class UserData {
    constructor() {
        this.reset();
    }
    get acertos() { return this._acertos; }
    get erros() { return this._erros; }
    get pontos() { return this._pontos; }
    incrementarAcertos() { this._acertos++; this._atualizarPontos(); }
    incrementarErros() { this._erros++; this._atualizarPontos(); }
    _atualizarPontos() { this._pontos = Math.max(0, (15 * this._acertos) - (5 * this._erros)); }
    reset() { this._acertos = 0; this._erros = 0; this._pontos = 0; }
}

// --- Módulo: QuizData (Carregamento e acesso aos dados do quiz) ---
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
    getTotalPerguntas() { return this.perguntas.length; }
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

// --- Módulo: QuizState (Gerenciamento do estado atual do quiz) ---
class QuizState {
    constructor() {
        this.allQuestions = [];
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.selectedCategories = [];
        this.selectedDifficulties = ['all']; // Default para todas as dificuldades
        this.isInitialQuestionLoad = true;
        this.isQuickQuizMode = false;
        this.QUICK_QUIZ_COUNT = 10; // Pode ser ajustado
    }
    initialize(perguntas) { this.allQuestions = perguntas; this.resetQuizState(); }
    resetQuizState() {
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        this.allQuestions.forEach(q => { delete q.respostaDadaId; delete q.foiCorretaNaSessao; });
    }
    fullReset() {
        this.resetQuizState();
        this.selectedCategories = [];
        this.isQuickQuizMode = false;
        this.selectedDifficulties = ['all'];
    }
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
                const idsCatRelevantes = new Set();
                const getDescendentes = (catIdNum) => {
                    if (idsCatRelevantes.has(catIdNum) || !todasCategorias.find(c => c.id_categoria === catIdNum)) return;
                    idsCatRelevantes.add(catIdNum);
                    todasCategorias.filter(c => c.id_categoria_pai === catIdNum).forEach(sub => getDescendentes(sub.id_categoria));
                };
                this.selectedCategories.forEach(selCatIdStr => { const id = parseInt(selCatIdStr); if (!isNaN(id)) getDescendentes(id); });
                const idsPerguntasComCat = new Set(relacaoPerguntaCategorias.filter(pc => idsCatRelevantes.has(pc.id_categoria)).map(pc => pc.id_pergunta));
                perguntasPotenciais = perguntasPotenciais.filter(p => idsPerguntasComCat.has(p.id_pergunta));
            }
            if (!this.selectedDifficulties.includes('all')) {
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
    isFirstQuestion() { return this.currentQuestionIndex === 0; }
    isLastQuestion() { return this.currentQuestionIndex === this.filteredQuestions.length - 1; }
    recordAnswer(opcaoId) { const q = this.getCurrentQuestion(); if (q && !q.hasOwnProperty('respostaDadaId')) { q.respostaDadaId = opcaoId; return true; } return false; }
    markNavigated() { this.isInitialQuestionLoad = false; }
    goToQuestion(index) { if (index >= 0 && index < this.filteredQuestions.length) { this.currentQuestionIndex = index; this.markNavigated(); return true; } return false; }
    goToNextQuestion() { if (this.currentQuestionIndex < this.filteredQuestions.length) { this.currentQuestionIndex++; this.markNavigated(); return true; } return false; } // Não incrementa se já for a última para endQuiz lidar com isso
    goToPreviousQuestion() { if (this.currentQuestionIndex > 0) { this.currentQuestionIndex--; this.markNavigated(); return true; } return false; }
}

// --- Módulo: LayoutManager (Gerenciamento de elementos de layout globais) ---
// --- Módulo: LayoutManager (Gerenciamento de elementos de layout globais) ---
class LayoutManager {
    constructor() {
        this.footerElement = document.getElementById('footer') || document.querySelector('.site-footer');
        this.hiddenClassName = 'u-is-hidden';
        if (!this.footerElement) {
            console.warn("LayoutManager: Footer element não encontrado!");
        }
    }

    handleSectionChange(sectionId) {
        if (!this.footerElement) return;

        if (sectionId === 'question-section') {
            // Adiciona a classe para esconder o rodapé quando na seção de questões
            this.footerElement.classList.add(this.hiddenClassName);
        } else {
    
            this.footerElement.classList.remove(this.hiddenClassName);
        }
    }
}
// --- Módulo: ChallengeHubManager (Gerencia a UI do Hub de Desafios) ---
class ChallengeHubManager {
    constructor(uiElements, quizLogic) {
        this.elements = {
            challengeHubContainer: uiElements.challengeHubContainer,
            hubCustomizeQuizBtn: uiElements.hubCustomizeQuizBtn,
            hubQuickQuizBtn: uiElements.hubQuickQuizBtn,
            hubTotalQuestionsCount: uiElements.hubTotalQuestionsCount,
            hubQuickQuizCount: uiElements.hubQuickQuizCount,
            placeholderFiltrosContainer: uiElements.placeholderFiltrosContainer,
            closeFiltersAndShowHubBtn: uiElements.closeFiltersAndShowHubBtn
        };
        this.quizLogic = quizLogic; // Para iniciar os quizzes
        this.quizUI = null; // Será injetado pela App para interações com filterPanel
        this._validateElements();
    }

    _validateElements() {
        for (const key in this.elements) {
            if (!this.elements[key]) {
                console.warn(`ChallengeHubManager: Elemento DOM '${key}' não encontrado.`);
            }
        }
    }

    setQuizUI(quizUIInstance) {
        this.quizUI = quizUIInstance;
    }

    showHub() {
        if (this.elements.challengeHubContainer) this.quizUI.showElement(this.elements.challengeHubContainer);
        if (this.elements.placeholderFiltrosContainer) this.quizUI.hideElement(this.elements.placeholderFiltrosContainer);
    }

    hideHub() {
        if (this.elements.challengeHubContainer) this.quizUI.hideElement(this.elements.challengeHubContainer);
    }

    updateTotalQuestionsCount(count) {
        if (this.elements.hubTotalQuestionsCount) {
            this.elements.hubTotalQuestionsCount.textContent = count;
        }
    }
    
    updateQuickQuizCount(count) {
        if (this.elements.hubQuickQuizCount) {
            this.elements.hubQuickQuizCount.textContent = count;
        }
    }

    setupEventListeners() {
        this.elements.hubCustomizeQuizBtn?.addEventListener('click', () => {
            this.hideHub();
            if (this.quizUI) {
                this.quizUI.toggleFilterPanel(true);
                if(this.elements.placeholderFiltrosContainer) this.quizUI.showElement(this.elements.placeholderFiltrosContainer);
            }
        });

        this.elements.hubQuickQuizBtn?.addEventListener('click', () => {
            if (this.quizLogic) {
                this.quizLogic.ui.showSection('question-section'); // Garante que a seção correta está visível
                this.quizLogic.startQuickQuiz(); // Isso vai esconder o hub e mostrar o quiz
            }
        });
        
        this.elements.closeFiltersAndShowHubBtn?.addEventListener('click', () => {
            if(this.quizUI) this.quizUI.toggleFilterPanel(false);
            this.showHub(); // Mostra o hub e esconde o placeholder
        });
    }
}


// --- Módulo: QuizUI (Manipulação da Interface do Usuário) ---
class QuizUI {
    constructor(onSectionChangeCallback = null) {
        this.hiddenClassName = 'u-is-hidden';
        this.currentSection = 'home-section';
        this.QUESTOES_POR_PAGINA_GRID = 5;
        this.TRANSITION_DURATION = 300;
        this.onSectionChange = onSectionChangeCallback;
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.timerRunning = false;
        this.focusedElementBeforePanel = null;
        this.focusedElementBeforeExplanationModal = null;
        this.cacheDOMelements();
    }

    cacheDOMelements() {
        this.elements = {
            // Seções
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'),
            accountSection: document.getElementById('account-section'),
            navElements: document.querySelectorAll('[data-section]'),

            // Conteúdo Principal da Seção de Questões
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),
            scorePanel: document.querySelector('.score-panel'), // Adicionado

            // Hub de Desafios (Challenge Hub)
            challengeHubContainer: document.getElementById('challenge-hub-container'),
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'),
            hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'),
            hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'),
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'),


            // Avisos e Placeholders
            avisoContainer: document.getElementById('aviso-container'),
            avisoMensagem: document.querySelector('#aviso-container .card--aviso p'),
            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'), // Mensagem ao abrir filtros

            // Elementos do Quiz Ativo
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

            // Botões e Displays de Pontuação (Score Panel)
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            timerDisplay: document.getElementById('timer-display'),

            // Resultados do Quiz
            resultadoCard: document.querySelector('#question-section .card--quiz-result'),
            resultadoTitulo: document.querySelector('#question-section .card--quiz-result .quiz-results__title'),
            resultadoPontos: document.getElementById('resultado-pontos'),
            resultadoAcertos: document.getElementById('resultado-acertos'),
            resultadoErros: document.getElementById('resultado-erros'),
            resultadoTempo: document.getElementById('resultado-tempo'),
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'),
            btnRecomecar: document.getElementById('btn-recomecar'),
            btnExplorarMais: document.getElementById('btn-explorar-mais'),

            // Modal de Confirmação
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            // confirmEncerrarModal: document.getElementById('confirm-encerrar-modal'), // Já dentro do overlay
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn'),

            // Painel de Filtros
            // btnAbrirFiltros: document.getElementById('btn-abrir-filtros'), // Removido, o hub tem seu próprio botão
            filterPanel: document.getElementById('filter-panel'),
            btnFecharFiltros: document.getElementById('btn-fechar-filtros'),
            filterPanelOverlay: document.getElementById('filter-panel-overlay'),
            categoryTreeList: document.getElementById('category-tree-list'),
            btnCatSelectAll: document.getElementById('btn-cat-select-all'),
            btnCatClearAll: document.getElementById('btn-cat-clear-all'),
            btnLimparFiltrosPainel: document.getElementById('btn-limpar-filtros-painel'),
            btnAplicarFiltrosPainel: document.getElementById('btn-aplicar-filtros-painel'),
            filterGroupDifficulty: document.getElementById('filter-group-difficulty'),
            // filteredQuestionCountDisplay: document.getElementById('filtered-question-count-display'), // Removido

            // Modal de Explicação
            btnToggleExplanation: document.getElementById('btn-toggle-explanation'),
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
            btnGotItExplanation: document.getElementById('btn-got-it-explanation'),

             // Botões da Home (para navegação)
            startRandomQuiz: document.getElementById('start-random-quiz'), // Botão de Quiz Rápido na Home
            startCategoryQuiz: document.getElementById('start-category-quiz') // Botão de Quiz por Categoria na Home
        };
        this.sectionElements = {
            'home-section': this.elements.homeSection,
            'question-section': this.elements.questionSection,
            'account-section': this.elements.accountSection
        };
        this._validateCache();
    }

    _validateCache() {
        const optional = ['feedbackAcessivel', 'filterGroupDifficulty',
                        'explanationModalOverlay', 'explanationModalDialog', 'explanationModalTitle',
                        'btnCloseExplanationModal', 'explanationModalGeneralBlock', 'explanationModalGeneralText',
                        'explanationModalOptionsBlock', 'explanationModalOptionsList', 'explanationModalDivider',
                        'explanationModalEmptyState','btnGotItExplanation',
                        // 'btnAbrirFiltros', 'filteredQuestionCountDisplay', // Removidos ou substituídos
                        'startRandomQuizPlaceholderBtn' // Removido com o novo hub
                        ];
        for (const k in this.elements) {
            if (!this.elements[k] && !optional.includes(k) && !(k in this.sectionElements)) {
                console.warn(`QuizUI Cache: Elemento DOM '${k}' não encontrado! Verifique o HTML.`);
            }
        }
        for (const k in this.sectionElements) {
            if(!this.sectionElements[k]) {
                console.warn(`QuizUI Cache: Seção DOM '${k}' não encontrada! Verifique o HTML.`);
            }
        }
    }

    showElement(el) { el?.classList.remove(this.hiddenClassName); }
    hideElement(el) { el?.classList.add(this.hiddenClassName); }

    stopTimer() { if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; } this.timerRunning = false; }
    resetTimer() { this.stopTimer(); this.timerSeconds = 0; if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = "00:00"; if (this.elements.resultadoTempo && !this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) this.elements.resultadoTempo.textContent = "00:00"; }
    startTimer() { if (this.timerRunning) return; this.timerRunning = true; this.timerInterval = setInterval(() => { this.timerSeconds++; if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = this._formatDisplayTime(this.timerSeconds); }, 1000); }
    _formatDisplayTime(s) { const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
    updateScoreDisplay(p, a, e) { if (this.elements.pontuacaoDisplay) this.elements.pontuacaoDisplay.textContent = p; if (this.elements.acertosNumDisplay) this.elements.acertosNumDisplay.textContent = a; if (this.elements.errosNumDisplay) this.elements.errosNumDisplay.textContent = e; }

    toggleFilterPanel(show) {
        const { filterPanel: panel, filterPanelOverlay: overlay, placeholderFiltrosContainer } = this.elements;
        if (!panel || !overlay) return;
        const panelVisibleClass = 'filter-panel--visible';
        const overlayVisibleClass = 'filter-panel-overlay--visible';

        if (show) {
            this.focusedElementBeforePanel = document.activeElement;
            if (this.quizState) {
                this.setCategoryTreeState(this.quizState.selectedCategories);
                this.setDifficultyState(this.quizState.selectedDifficulties);
            }
            this.showElement(overlay); this.showElement(panel);
            this.hideElement(this.elements.challengeHubContainer); // Esconde o hub ao abrir filtros
            this.showElement(placeholderFiltrosContainer); // Mostra o placeholder de "ajuste filtros"
            panel.removeAttribute('aria-hidden'); overlay.removeAttribute('aria-hidden');
            requestAnimationFrame(() => { overlay.classList.add(overlayVisibleClass); panel.classList.add(panelVisibleClass); panel.focus(); });
        } else {
            panel.classList.remove(panelVisibleClass); overlay.classList.remove(overlayVisibleClass);
            const onTransitionEnd = () => {
                if (!panel.classList.contains(panelVisibleClass)) {
                    this.hideElement(panel); this.hideElement(overlay);
                    panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true');
                }
                panel.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforePanel?.focus();
                // Se o quiz não estiver ativo, mostrar o hub
                if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName)) {
                    this.hideElement(placeholderFiltrosContainer);
                    this.showElement(this.elements.challengeHubContainer);
                }
            };
            panel.addEventListener('transitionend', onTransitionEnd, { once: true });
            setTimeout(() => {
                if (!panel.classList.contains(panelVisibleClass)) {
                     this.hideElement(panel); this.hideElement(overlay);
                     panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true');
                     this.focusedElementBeforePanel?.focus();
                     if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName)) {
                        this.hideElement(placeholderFiltrosContainer);
                        this.showElement(this.elements.challengeHubContainer);
                    }
                }
                panel.removeEventListener('transitionend', onTransitionEnd);
            }, this.TRANSITION_DURATION + 50);
        }
    }

    getSectionUIConfig() {
        return {
            'home-section': {
                visible: [this.elements.homeSection], // homeSection é a própria seção
                hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.placeholderFiltrosContainer, this.elements.btnToggleExplanation, this.elements.scorePanel, this.elements.challengeHubContainer],
                onEnter: null
            },
            'question-section': {
                visible: [this.elements.challengeHubContainer], // Mostrar o hub por padrão
                hidden: [this.elements.scorePanel, this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.placeholderFiltrosContainer, this.elements.btnToggleExplanation],
                onEnter: () => {
                    // Se nenhum quiz estiver ativo (nem resultados sendo mostrados), mostrar o hub.
                    if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                        this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                        this.showElement(this.elements.challengeHubContainer);
                        this.hideElement(this.elements.scorePanel);
                        this.hideElement(this.elements.placeholderFiltrosContainer);
                        this.hideElement(this.elements.avisoContainer);
                    }
                }
            },
            'account-section': {
                visible: [this.elements.accountSection], // accountSection é a própria seção
                hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.placeholderFiltrosContainer, this.elements.btnToggleExplanation, this.elements.scorePanel, this.elements.challengeHubContainer],
                onEnter: null
            }
        };
    }

    showSection(sectionId) {
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
                config.onEnter?.(); // Executa a função onEnter se definida
            } else {
                console.warn(`Configuração de UI para '${sectionId}' não encontrada.`);
            }

            // Lógica específica ao sair da seção de questões ou se não for ela
            if (previousSection === 'question-section' && sectionId !== 'question-section') {
                this.toggleFilterPanel(false); // Fecha o painel de filtros
                this.toggleExplanationModal(false); // Fecha o modal de explicação
                this.hideElement(this.elements.scorePanel); // Garante que o score panel está oculto
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
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer } = this.elements;
        if (avisoContainer && avisoMensagem) {
            avisoMensagem.textContent = message;
            avisoMensagem.setAttribute("role", "alert");
            this.showElement(avisoContainer);
            this.hideElement(placeholderFiltrosContainer);
            this.hideElement(challengeHubContainer); // Esconder o hub se um aviso for mostrado
            if (this.currentSection === "question-section") this.hideQuizElements();
        }
    }

    clearWarning() {
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        this.hideElement(avisoContainer);
        avisoMensagem?.removeAttribute("role");

        // Se estiver na seção de questões e nenhum quiz/resultado estiver ativo, mostrar o hub.
        if (this.currentSection === "question-section" &&
            quizSectionContent?.classList.contains(this.hiddenClassName) &&
            resultadoCard?.classList.contains(this.hiddenClassName)) {
            this.hideElement(placeholderFiltrosContainer);
            this.showElement(challengeHubContainer);
        }
    }

    displayQuizContent(show = true) {
        const {
            quizSectionContent, btnEncerrarSessao, progressContainer, progressText,
            questionGridContainer, scorePanel, challengeHubContainer,
            placeholderFiltrosContainer, resultadoCard
        } = this.elements;

        if (show) {
            this.showElement(scorePanel);
            this.hideElement(challengeHubContainer);
            this.showElement(quizSectionContent);
            this.showElement(btnEncerrarSessao);
            this.showElement(progressContainer);
            this.showElement(progressText);
            this.showElement(questionGridContainer);
            this.clearWarning(); // Isso vai decidir se mostra o hub ou placeholder
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

            // Ao terminar/sair do quiz, decidir o que mostrar:
            if (resultadoCard && !resultadoCard.classList.contains(this.hiddenClassName)) {
                this.hideElement(challengeHubContainer); // Se mostrando resultados, hub fica oculto
            } else {
                this.showElement(challengeHubContainer); // Caso contrário, mostrar o hub
                this.hideElement(placeholderFiltrosContainer);
            }
        }
    }


    hideQuizElements() {
        const { quizSectionContent, resultadoCard, questionGridContainer, btnEncerrarSessao } = this.elements;
        this.hideElement(quizSectionContent);
        this.hideElement(resultadoCard);
        this.hideElement(questionGridContainer);
        this.hideElement(btnEncerrarSessao);
        this.hideProgressBar();
        this.toggleExplanationModal(false);
        this.hideElement(this.elements.btnToggleExplanation);
        // Não mexer no scorePanel ou challengeHub aqui, displayQuizContent ou showSection cuidam disso.
    }

    displayQuestion(perguntaObj, qNum, totalQ, categorias, relacao, isQuick) {
        if (!perguntaObj) return console.error("Tentativa de exibir questão nula.");
        let tituloCat = "Questão";
        if (isQuick) tituloCat = "Quiz Rápido";
        else {
            const ids = relacao.filter(pc=>pc.id_pergunta===perguntaObj.id_pergunta).map(pc=>pc.id_categoria);
            if(ids.length>0){
                let idToShow=ids[0];
                if(ids.length>1){ const catObjs=categorias.filter(c=>ids.includes(c.id_categoria)); if(catObjs.length>0) idToShow = catObjs.reduce((deep,cur)=>this._getCategoriaProfundidade(cur,categorias)>this._getCategoriaProfundidade(deep,categorias)?cur:deep,catObjs[0]).id_categoria;}
                let path=[]; let currentCatId=idToShow; let count=0;
                while(currentCatId!=null&&count<5){ const c=categorias.find(cat=>cat.id_categoria===currentCatId); if(c){path.unshift(c.nome_categoria);currentCatId=c.id_categoria_pai;}else break; count++;}
                tituloCat = path.length > 0 ? path.join(' › ') : "Categorias";
            }
        }
        if(this.elements.categoriaTitulo)this.elements.categoriaTitulo.innerText=tituloCat;
        if(this.elements.idQuestao)this.elements.idQuestao.innerText=qNum;
        if(this.elements.perguntaTexto)this.elements.perguntaTexto.textContent=perguntaObj.texto_pergunta;
        if(this.elements.referenciaQuestao)this.elements.referenciaQuestao.textContent=`Referência: ${perguntaObj.referencia_bibliografica||"N/A"}`;
        this.displayQuestionImage(perguntaObj.url_imagem,qNum);
        this.updateProgressBar(qNum,totalQ);
        this.elements.questionTitle?.focus({preventScroll:true});
        this.hideElement(this.elements.btnToggleExplanation);
        this.toggleExplanationModal(false);
    }
    _getCategoriaProfundidade(cat,allCats){if(!cat||!allCats)return -1;let d=0;let pId=cat.id_categoria_pai;while(pId!=null&&d<10){d++;const p=allCats.find(c=>c.id_categoria===pId);pId=p?p.id_categoria_pai:null;}return d;}
    displayQuestionImage(url,qNum){const el=this.elements.perguntaImagem;if(el){if(url?.trim()){el.src=url;el.alt=`Ilustração questão ${qNum}`;this.showElement(el);el.onerror=()=>{this.hideElement(el);console.warn(`Erro img: ${url}`);el.onerror=null;}}else{this.hideElement(el);el.src="";el.alt="";}}}
    generateAnswerButtons(id,opts,ansId,cb){const c=this.elements.respostasContainer;if(!c)return;c.innerHTML='';if(!opts||opts.length===0){c.innerHTML=`<p class="error-message">Opções para P${id} não encontradas.</p>`;return;}const hasAns=typeof ansId!=='undefined'&&ansId!==null;const baseCl='question-display__answer-option';opts.forEach(o=>{const b=document.createElement('button');b.className=baseCl;b.textContent=o.texto_opcao;b.dataset.opcaoId=o.id_opcao_resposta.toString();b.disabled=hasAns;b.style.cursor=hasAns?'default':'pointer';b.tabIndex=hasAns?-1:0;if(hasAns){b.classList.add(`${baseCl}--answered`);if(o.eh_correta)b.classList.add(`${baseCl}--correct`);else if(o.id_opcao_resposta===ansId)b.classList.add(`${baseCl}--incorrect`);}else if(cb)b.onclick=()=>cb(o.id_opcao_resposta);c.appendChild(b);});}
    disableAnswers(){const c='question-display__answer-option',a=`${c}--answered`;this.elements.respostasContainer?.querySelectorAll(`button.${c}`).forEach(b=>{b.onclick=null;b.disabled=true;b.classList.add(a);b.style.cursor="default";b.tabIndex=-1;});}

    applyAnswerFeedback(selectedOpId, opcoes) {
        const baseCl = "question-display__answer-option", corrCl = `${baseCl}--correct`, incorrCl = `${baseCl}--incorrect`;
        let userCorrect = false;
        this.elements.respostasContainer?.querySelectorAll(`button.${baseCl}`).forEach(btn => {
            const btnOpId = parseInt(btn.dataset.opcaoId);
            const optData = opcoes.find(op => op.id_opcao_resposta === btnOpId);
            if (!optData) return;
            if (btnOpId === selectedOpId) { if (optData.eh_correta) { btn.classList.add(corrCl); userCorrect = true; } else { btn.classList.add(incorrCl); } }
            else if (optData.eh_correta) btn.classList.add(corrCl);
        });
        if(this.elements.feedbackAcessivel) this.elements.feedbackAcessivel.textContent = userCorrect ? "Resposta correta!" : "Resposta incorreta.";

        const currentQ = this.quizState.getCurrentQuestion();
        const hasGeneralExpl = currentQ && currentQ.explicacao_resposta && currentQ.explicacao_resposta.trim() !== '';
        const hasOptExpl = opcoes.some(op => op.feedback_opcao && op.feedback_opcao.trim() !== '');
        if ((hasGeneralExpl || hasOptExpl) && this.elements.btnToggleExplanation) this.showElement(this.elements.btnToggleExplanation);
        else this.hideElement(this.elements.btnToggleExplanation);
    }
    toggleExplanationModal(show){const o=this.elements.explanationModalOverlay,d=this.elements.explanationModalDialog;if(!o||!d||!this.quizState||!this.quizData)return;const mVis='modal--visible';if(show){const q=this.quizState.getCurrentQuestion();if(!q)return;const opts=this.quizData.getOpcoesPorPerguntaId(q.id_pergunta);let hasCont=false;const genBlk=this.elements.explanationModalGeneralBlock,genTxt=this.elements.explanationModalGeneralText;if(q.explicacao_resposta?.trim()){genTxt.innerHTML=q.explicacao_resposta.replace(/\n/g,'<br>');this.showElement(genBlk);hasCont=true;}else this.hideElement(genBlk);const optsBlk=this.elements.explanationModalOptionsBlock,optsList=this.elements.explanationModalOptionsList;optsList.innerHTML='';let hasSpecOptFeed=false;opts.forEach(opt=>{if(opt.feedback_opcao?.trim()){hasSpecOptFeed=true;const li=document.createElement('li');const origSpan=document.createElement('span');origSpan.className='option-original-text';origSpan.textContent=`Opção: "${opt.texto_opcao}"`;li.appendChild(origSpan);const feedSpan=document.createElement('span');feedSpan.className='option-feedback-value';feedSpan.classList.add(opt.eh_correta?'correct':'incorrect');feedSpan.innerHTML=opt.feedback_opcao.replace(/\n/g,'<br>');li.appendChild(feedSpan);optsList.appendChild(li);}});if(hasSpecOptFeed){this.showElement(optsBlk);hasCont=true;}else this.hideElement(optsBlk);const div=this.elements.explanationModalDivider;if(genBlk&&!genBlk.classList.contains(this.hiddenClassName)&&optsBlk&&!optsBlk.classList.contains(this.hiddenClassName)&&div)this.showElement(div);else if(div)this.hideElement(div);const empty=this.elements.explanationModalEmptyState;if(!hasCont&&empty)this.showElement(empty);else if(empty)this.hideElement(empty);this.focusedElementBeforeExplanationModal=document.activeElement;this.showElement(o);o.scrollTop;requestAnimationFrame(()=>{o.classList.add(mVis);d.focus();});}else{o.classList.remove(mVis);const end=()=>{if(!o.classList.contains(mVis))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforeExplanationModal?.focus();};o.addEventListener('transitionend',end,{once:true});setTimeout(()=>{if(!o.classList.contains(mVis))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforeExplanationModal?.focus();},this.TRANSITION_DURATION+50);}}
    updateProgressBar(c,t){const p=this.elements.progressContainer,f=this.elements.progressBarFill,x=this.elements.progressText;if(p&&f&&x){if(t>0){f.style.width=`${Math.min(c,t)/t*100}%`;x.textContent=`${c} / ${t}`;this.showElement(p);this.showElement(x);}else this.hideProgressBar();}}
    hideProgressBar(){this.hideElement(this.elements.progressContainer);this.hideElement(this.elements.progressText);if(this.elements.progressBarFill)this.elements.progressBarFill.style.width="0%";if(this.elements.progressText)this.elements.progressText.textContent="";}
    updateNavigationButtons(isF,isL,tot){const n=this.elements.navigationButtons,p=this.elements.prevBtn,nxt=this.elements.nextBtn;if(n&&p&&nxt){if(tot<=0)this.hideElement(n);else{this.showElement(n);p.disabled=isF;nxt.disabled=false;nxt.textContent=isL?"Ver Resultado":"Próxima";}}}
    renderQuestionGrid(qs,curr,cb){const cont=this.elements.questionGridContainer;if(!cont)return;if(!qs?.length){this.hideElement(cont);return;}this.showElement(cont);cont.innerHTML='';const page=Math.floor(curr/this.QUESTOES_POR_PAGINA_GRID);const start=page*this.QUESTOES_POR_PAGINA_GRID;const end=Math.min(start+this.QUESTOES_POR_PAGINA_GRID,qs.length);const arrB='question-grid__arrow',itB='question-grid__item',itC=`${itB}--current`,itOK=`${itB}--correct`,itNO=`${itB}--incorrect`;cont.appendChild(this._createGridArrow('prev',start===0,()=>cb(Math.max(0,start-1)),'Página Anterior',[`${arrB}--left`]));for(let i=start;i<end;i++){const q=qs[i];const item=document.createElement('button');item.className=itB;item.textContent=i+1;item.dataset.index=i.toString();item.setAttribute('aria-label',`Questão ${i+1}`);item.onclick=()=>cb(i);if(q.hasOwnProperty('respostaDadaId')&&q.respostaDadaId!==null){if(q.foiCorretaNaSessao===true)item.classList.add(itOK);else if(q.foiCorretaNaSessao===false)item.classList.add(itNO);}if(i===curr)item.classList.add(itC);cont.appendChild(item);}cont.appendChild(this._createGridArrow('next',end>=qs.length,()=>cb(Math.min(qs.length-1,end)),'Próxima Página',[`${arrB}--right`]));}
    _createGridArrow(dir,dis,click,label,classes=[]){const btn=document.createElement('button');btn.className='question-grid__arrow';btn.classList.add(...classes,'u-is-circle');btn.setAttribute('aria-label',label);btn.disabled=dis;btn.onclick=click;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 -960 960 960");svg.setAttribute("fill","currentColor");const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",dir==='prev'?"M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z":"M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z");svg.appendChild(path);btn.appendChild(svg);return btn;}
    generateCategoryTree(cats){const treeCont=this.elements.categoryTreeList;if(!treeCont)return;treeCont.innerHTML='';const create=(cs,pEl,lvl=0)=>{cs.forEach(c=>{const li=document.createElement('li');li.className='category-tree__item';li.setAttribute('role','treeitem');li.setAttribute('aria-checked','false');const wr=document.createElement('div');wr.className='category-tree__label-wrapper';const inp=document.createElement('input');inp.type='checkbox';inp.id=`cat-tree-${c.id_categoria}`;inp.className='category-tree__input u-sr-only';inp.value=c.id_categoria.toString();inp.tabIndex=-1;inp.addEventListener('change',(e)=>this.handleCategoryCheckboxChange(e.target));const lbl=document.createElement('label');lbl.htmlFor=inp.id;lbl.className='category-tree__label';lbl.textContent=c.nome_categoria;lbl.tabIndex=0;lbl.addEventListener('keydown',(e)=>{if(e.key===' '||e.key==='Enter'){inp.checked=!inp.checked;inp.dispatchEvent(new Event('change',{bubbles:true}));e.preventDefault();}});if(c.subcategorias?.length>0){li.classList.add('category-tree__item--has-children');li.setAttribute('aria-expanded','false');const tgl=document.createElement('button');tgl.type='button';tgl.className='category-tree__toggle';tgl.setAttribute('aria-label',`Expandir ${c.nome_categoria}`);tgl.setAttribute('aria-expanded','false');tgl.innerHTML=`<span class="material-symbols-outlined">chevron_right</span>`;wr.appendChild(tgl);wr.appendChild(inp);wr.appendChild(lbl);const sub=document.createElement('ul');sub.className='category-tree__submenu';sub.setAttribute('role','group');create(c.subcategorias,sub,lvl+1);li.appendChild(wr);li.appendChild(sub);const tglAct=(ev)=>{ev.stopPropagation();const exp=li.getAttribute('aria-expanded')==='true';li.setAttribute('aria-expanded',String(!exp));tgl.setAttribute('aria-expanded',String(!exp));tgl.setAttribute('aria-label',`${!exp?'Recolher':'Expandir'} ${c.nome_categoria}`);sub.classList.toggle('category-tree__submenu--expanded');if(!exp)sub.style.maxHeight=sub.scrollHeight+"px";else requestAnimationFrame(()=>{sub.style.maxHeight='0';});tgl.querySelector('.material-symbols-outlined').textContent=!exp?'expand_more':'chevron_right';};tgl.addEventListener('click',tglAct);tgl.addEventListener('keydown',(ev)=>{if(ev.key===' '||ev.key==='Enter'){tglAct(ev);ev.preventDefault();}});}else{wr.appendChild(inp);wr.appendChild(lbl);li.appendChild(wr);}pEl.appendChild(li);});};create(cats,treeCont);const pLis=Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children')||[]);for(let i=pLis.length-1;i>=0;i--)this.updateParentCheckboxState(pLis[i]);}
    handleCategoryCheckboxChange(cb){const isCh=cb.checked;const li=cb.closest('.category-tree__item');if(!li)return;cb.classList.remove('is-indeterminate');li.setAttribute('aria-checked',String(isCh));const chCbs=li.querySelectorAll(':scope > .category-tree__submenu .category-tree__input');chCbs.forEach(c=>{c.checked=isCh;c.classList.remove('is-indeterminate');const chLi=c.closest('.category-tree__item');if(chLi)chLi.setAttribute('aria-checked',String(isCh));});this.updateParentCheckboxState(li.parentElement?.closest('.category-tree__item'));}
    updateParentCheckboxState(pLi){if(!pLi)return;const pCb=pLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');if(!pCb)return;const chLis=pLi.querySelectorAll(':scope > .category-tree__submenu > .category-tree__item');if(chLis.length===0)return;let allCh=true,noneCh=true,someInd=false;chLis.forEach(chLi=>{const chIn=chLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');if(chIn){if(chIn.checked&&!chIn.classList.contains('is-indeterminate'))noneCh=false;else if(chIn.classList.contains('is-indeterminate')){allCh=false;noneCh=false;someInd=true;}else allCh=false;}else allCh=false;});pCb.classList.remove('is-indeterminate');if(someInd||(!allCh&&!noneCh)){pCb.checked=false;pCb.classList.add('is-indeterminate');pLi.setAttribute('aria-checked','mixed');}else if(allCh){pCb.checked=true;pLi.setAttribute('aria-checked','true');}else{pCb.checked=false;pLi.setAttribute('aria-checked','false');}this.updateParentCheckboxState(pLi.parentElement?.closest('.category-tree__item'));}
    getSelectedCategoriesFromTree(){const ids=[];this.elements.categoryTreeList?.querySelectorAll('.category-tree__input').forEach(cb=>{if(cb.checked&&!cb.classList.contains('is-indeterminate'))ids.push(cb.value);});return ids;}
    getSelectedDifficulties(){const diffCbs=this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])');const selSpecs=[];diffCbs?.forEach(cb=>{if(cb.checked)selSpecs.push(cb.value);});const allCb=this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');return(allCb?.checked||selSpecs.length===0)?['all']:selSpecs;}
    setCategoryTreeState(selIds=[]){const allCbs=Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input')||[]);allCbs.forEach(cb=>{cb.checked=selIds.includes(cb.value);cb.classList.remove('is-indeterminate');const li=cb.closest('.category-tree__item');if(li)li.setAttribute('aria-checked',String(cb.checked));});const pLis=Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children')||[]);for(let i=pLis.length-1;i>=0;i--)this.updateParentCheckboxState(pLis[i]);}
    setDifficultyState(diffs=['all']){const allCb=this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');const specCbs=Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])')||[]);if(diffs.includes('all')){if(allCb)allCb.checked=true;specCbs.forEach(cb=>cb.checked=false);}else{if(allCb)allCb.checked=false;specCbs.forEach(cb=>{cb.checked=diffs.includes(cb.value);});}}
    updateFilteredQuestionCount(count){} // Removido - hub tem sua própria contagem
    showResults(userData, totalQuestions) {
        const { resultadoCard, resultadoTitulo, resultadoPontos, resultadoAcertos, resultadoErros, resultadoTempo, resultadoMensagemMotivacional, scorePanel, challengeHubContainer } = this.elements;
        if (!resultadoCard || !userData) return;
        this.hideQuizElements();
        this.hideElement(scorePanel); // Esconder score panel ao mostrar resultados
        this.hideElement(challengeHubContainer); // Esconder hub ao mostrar resultados
        this.hideElement(this.elements.placeholderFiltrosContainer); // Garantir que placeholder está oculto
        if(resultadoTitulo) resultadoTitulo.textContent = "Desempenho Final!";
        if(resultadoPontos) resultadoPontos.textContent = userData.pontos;
        if(resultadoAcertos) resultadoAcertos.textContent = userData.acertos;
        if(resultadoErros) resultadoErros.textContent = userData.erros;
        if(resultadoTempo) resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds);
        if(resultadoMensagemMotivacional) {
            const p = userData.pontos, t = totalQuestions; let m = "Continue praticando!";
            if (t > 0) { const max = t * 15; if (p >= max * 0.8) m = "Excelente desempenho!"; else if (p >= max * 0.5) m = "Muito bom!"; }
            else if (p === 0 && userData.acertos === 0 && userData.erros === 0) m = "Nenhuma questão encontrada/respondida.";
            resultadoMensagemMotivacional.textContent = m;
        }
        this.showElement(resultadoCard);
        resultadoTitulo?.focus();
    }
    hideResults() { this.hideElement(this.elements.resultadoCard); }
    toggleConfirmModal(show) {const o=this.elements.confirmEncerrarOverlay;if(!o)return;const m='modal--visible';if(show){this.focusedElementBeforePanel=document.activeElement;this.showElement(o);o.scrollTop;requestAnimationFrame(()=>{o.classList.add(m);this.elements.cancelEncerrarBtn?.focus();});}else{o.classList.remove(m);const end=()=>{if(!o.classList.contains(m))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforePanel?.focus();};o.addEventListener('transitionend',end,{once:true});setTimeout(()=>{if(!o.classList.contains(m))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforePanel?.focus();},this.TRANSITION_DURATION+50);}}
    scrollToQuestionStart(){const t=this.elements.questionTitle;if(this.currentSection==="question-section"&&t)t.scrollIntoView({behavior:"smooth",block:"nearest"});}
    focusNextButton(prevScroll=false){this.elements.nextBtn?.focus({preventScroll:prevScroll});}
    smoothScrollToNextButton(){const t=this.elements.navigationButtons;t&&t.scrollIntoView({behavior:"smooth",block:"nearest"});}
}

// --- Módulo: QuizLogic (Lógica de Negócios do Quiz) ---
class QuizLogic {
    constructor(quizState, quizUI, userData, quizData) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
        this.quizData = quizData;
        this.challengeHubManager = null; // Será injetado
    }
    setChallengeHubManager(manager) { this.challengeHubManager = manager; }

    applyFiltersAndStartQuiz() {
        const selCatIds = this.ui.getSelectedCategoriesFromTree();
        const selDiffs = this.ui.getSelectedDifficulties();
        this.state.setQuickQuizMode(false);
        this.state.setFilters(selCatIds, selDiffs);
        this.ui.toggleFilterPanel(false); // Fecha o painel de filtros
        this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer); // Esconde o placeholder de filtros
        this.startQuiz();
    }
    clearAllFiltersInPanel() {
        this.ui.setCategoryTreeState([]);
        this.ui.setDifficultyState(['all']);
        // this.ui.updateFilteredQuestionCount(this.state.allQuestions.length); // Contagem não é mais global
    }
    startQuiz() {
        this.user.reset();
        this.state.filterQuestions(this.quizData.getCategorias(), this.quizData.getRelacaoPerguntaCategorias());
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);

        const fQs = this.state.filteredQuestions;
        // this.ui.updateFilteredQuestionCount(fQs.length); // Contagem não é mais global

        if (fQs.length > 0) {
            this.ui.hideElement(this.ui.elements.challengeHubContainer); // Esconde o Hub ao iniciar
            this.ui.showElement(this.ui.elements.scorePanel);      // Mostra o Score Panel
            this.ui.displayQuizContent(true);                       // Mostra elementos do quiz
            this._displayCurrentQuestion(false);
            this.ui.startTimer();
        } else {
            this.ui.displayQuizContent(false); // Isso deve mostrar o hub e esconder o score panel
            this.ui.showWarning(this.state.isQuickQuizMode ? "Nenhuma pergunta para Quiz Rápido. Verifique o console." : "Nenhuma questão encontrada para os filtros. Tente outros.");
            this.ui.stopTimer();
        }
    }
    startQuickQuiz() {
        this.state.setQuickQuizMode(true);
        this.state.setFilters([], ['all']);
        this.ui.toggleFilterPanel(false);
        this.startQuiz();
    }
    answerQuestion(selOpId) {
        const currQ = this.state.getCurrentQuestion(); if (!currQ) return;
        const opts = this.quizData.getOpcoesPorPerguntaId(currQ.id_pergunta);
        const selOpt = opts.find(op => op.id_opcao_resposta === selOpId);
        if (selOpt && this.state.recordAnswer(selOpId)) {
            currQ.foiCorretaNaSessao = selOpt.eh_correta;
            if (selOpt.eh_correta) this.user.incrementarAcertos(); else this.user.incrementarErros();
            this.ui.disableAnswers();
            this.ui.applyAnswerFeedback(selOpId, opts);
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.focusNextButton(true);
            this.ui.smoothScrollToNextButton();
        }
    }
    nextQuestion() {
        const isLast = this.state.isLastQuestion();
        const currentQ = this.state.getCurrentQuestion();
        // Só avança se a questão atual foi respondida ou se não há mais questões para avançar (nesse caso, vai para o fim)
        if (currentQ && currentQ.hasOwnProperty('respostaDadaId')) {
            if (this.state.goToNextQuestion()) {
                if (this.state.isQuizComplete()) { // Checou se após o incremento, o quiz completou
                    this.endQuiz();
                } else {
                    this._displayCurrentQuestion();
                }
            } else if (isLast) { // Se não conseguiu avançar e era a última, então fim do quiz
                this.endQuiz();
            }
        } else if (!currentQ && this.state.isQuizComplete()) { // Se não há questão atual e o quiz está completo (ex: recarregou na tela de resultados)
             this.endQuiz();
        }
        // Se a questão atual não foi respondida, não faz nada (ou pode adicionar um aviso)
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
                if(shouldScroll)this.ui.scrollToQuestionStart();
            } else { console.error("P inválida:", this.state.currentQuestionIndex); this.endQuiz(); }
        };
        if(!init && el){
            el.classList.add("is-fading-out");
            await new Promise(resolve => { let ended = false; const handler = () => { if (!ended) { el.removeEventListener("transitionend", handler); ended = true; resolve(); } }; el.addEventListener("transitionend", handler); setTimeout(() => { if (!ended) { el.removeEventListener("transitionend", handler); ended = true; resolve(); } }, this.ui.TRANSITION_DURATION + 50); });
            el.classList.remove("is-fading-out"); el.classList.add("is-transparent");
            requestAnimationFrame(() => { logic(); requestAnimationFrame(() => el.classList.remove("is-transparent")); });
        } else { logic(); if (el) el.classList.remove("is-fading-out", "is-transparent"); if (this.state.getTotalFilteredQuestions() > 0) this.state.markNavigated(); }
    }
    endQuiz() {
        this.ui.stopTimer();
        this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        this.ui.toggleExplanationModal(false);
    }
    restartQuiz() {
        this.user.reset();
        this.state.fullReset();
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();
        this.ui.resetTimer();
        this.ui.toggleExplanationModal(false);
        this.ui.displayQuizContent(false); // Isso deve mostrar o hub e esconder o score panel
        this.ui.clearWarning();
        // this.ui.updateFilteredQuestionCount(0); // Contagem não é mais global
        this.clearAllFiltersInPanel();
        if (this.challengeHubManager) this.challengeHubManager.showHub(); // Garante que o hub é mostrado
        this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
    }
    forceEndQuiz() { this.ui.stopTimer(); this.endQuiz(); this.ui.toggleConfirmModal(false); this.ui.toggleExplanationModal(false); }
}

// --- Módulo Principal: App ---
class App {
    constructor() {
        this.userData = new UserData();
        this.quizData = new QuizData();
        this.quizState = new QuizState();
        this.layoutManager = new LayoutManager();
        this.quizUI = new QuizUI(this.layoutManager.handleSectionChange.bind(this.layoutManager));
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData, this.quizData);
        this.challengeHubManager = new ChallengeHubManager(this.quizUI.elements, this.quizLogic);

        // Injeções de dependência
        this.quizUI.quizState = this.quizState; // QuizUI precisa de quizState para alguns checks
        this.quizUI.quizData = this.quizData;   // QuizUI precisa de quizData para o modal de explicação
        this.quizLogic.setChallengeHubManager(this.challengeHubManager); // QuizLogic pode precisar interagir com o hub
        this.challengeHubManager.setQuizUI(this.quizUI); // HubManager precisa de quizUI para toggleFilterPanel
    }

    async initialize() {
        console.log("Inicializando App...");
        try {
            const loaded = await this.quizData.loadAllData();
            if (loaded && this.quizData.getPerguntas().length > 0) {
                this.quizState.initialize(this.quizData.getPerguntas());
                this.challengeHubManager.updateTotalQuestionsCount(this.quizData.getTotalPerguntas());
                this.challengeHubManager.updateQuickQuizCount(this.quizState.QUICK_QUIZ_COUNT);
                const categoriasParaArvore = this.quizData.getCategoriasHierarquicamente();
                this.quizUI.generateCategoryTree(categoriasParaArvore);
                this.setupEventListeners();
                const initialActiveLink = document.querySelector('.main-nav__link--active, .bottom-nav__link--active');
                const initialSection = initialActiveLink?.dataset.section || 'home-section';
                this.quizUI.showSection(initialSection); // Isso também chamará onEnter da seção
                console.log("App inicializado com sucesso.");
            } else {
                this.handleLoadError("Dados carregados, mas sem perguntas. Verifique os arquivos JSON.");
            }
        } catch (error) {
            console.error("Falha crítica ao inicializar o App:", error);
            this.handleLoadError(`Erro fatal ao carregar o quiz: ${error.message}. Verifique o console para mais detalhes.`);
        }
    }

    handleLoadError(message) {
        try {
            this.quizUI.showSection('question-section');
            this.quizUI.showWarning(message);
            this.disableCoreFunctionality();
        } catch (uiError) {
            console.error("Erro catastrófico na UI durante o tratamento de erro de carregamento:", uiError);
            alert(message); // Fallback
        }
    }

    disableCoreFunctionality() {
        this.quizUI.hideElement(this.quizUI.elements.hubCustomizeQuizBtn);
        this.quizUI.hideElement(this.quizUI.elements.hubQuickQuizBtn);
        this.quizUI.hideElement(this.quizUI.elements.startRandomQuiz); // Botão da home
        this.quizUI.hideElement(this.quizUI.elements.startCategoryQuiz); // Botão da home
        if (this.quizUI.elements.challengeHubContainer) {
             const title = this.quizUI.elements.challengeHubContainer.querySelector('.challenge-hub__title');
             if (title) title.textContent = "Erro ao Carregar";
             const subtitle = this.quizUI.elements.challengeHubContainer.querySelector('.challenge-hub__subtitle');
             if (subtitle) subtitle.textContent = "Não foi possível carregar as questões. Tente recarregar a página.";
             this.quizUI.showElement(this.quizUI.elements.challengeHubContainer); // Mostra o hub com a msg de erro
        }
    }

    setupEventListeners() {
        // Navegação principal
        this.quizUI.elements.navElements?.forEach(navEl => {
            navEl.addEventListener('click', (e) => {
                if (navEl.tagName === 'A') e.preventDefault();
                const targetSection = navEl.dataset.section;
                if (targetSection && targetSection !== this.quizUI.currentSection) {
                    this.quizUI.showSection(targetSection);
                    // Lógica adicional se necessário ao mudar de seção, ex: resetar filtros
                    if (targetSection === 'question-section') {
                        this.quizState.setQuickQuizMode(false);
                         // A lógica de mostrar o hub/placeholder está agora em showSection e onEnter
                    }
                } else if (targetSection === 'question-section' && navEl.id === 'start-category-quiz') {
                     // Se já está na seção de questões e clica no botão da home para "Por Categoria"
                     // e o quiz não está ativo, abre os filtros e mostra o placeholder.
                    if (this.quizUI.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName)) {
                        this.quizState.setQuickQuizMode(false);
                        this.quizUI.hideElement(this.quizUI.elements.challengeHubContainer);
                        this.quizUI.showElement(this.quizUI.elements.placeholderFiltrosContainer);
                        this.quizUI.toggleFilterPanel(true);
                    }
                }
            });
        });

        // Botões da Home que iniciam quiz/navegam para seção de questões
        this.quizUI.elements.startRandomQuiz?.addEventListener('click', () => {
            this.quizUI.showSection('question-section');
            this.quizLogic.startQuickQuiz();
        });
        this.quizUI.elements.startCategoryQuiz?.addEventListener('click', () => {
            this.quizUI.showSection('question-section');
            this.quizUI.hideElement(this.quizUI.elements.challengeHubContainer);
            this.quizUI.showElement(this.quizUI.elements.placeholderFiltrosContainer);
            this.quizUI.toggleFilterPanel(true);
        });


        // Challenge Hub (já configurado pelo ChallengeHubManager)
        this.challengeHubManager.setupEventListeners();

        // Painel de Filtros
        this.quizUI.elements.btnFecharFiltros?.addEventListener('click', () => {
            this.quizUI.toggleFilterPanel(false);
            // A lógica de mostrar o hub/placeholder ao fechar o painel está em toggleFilterPanel
        });
        this.quizUI.elements.filterPanelOverlay?.addEventListener('click', (e) => {
            if (e.target === this.quizUI.elements.filterPanelOverlay) {
                this.quizUI.toggleFilterPanel(false);
                 // A lógica de mostrar o hub/placeholder ao fechar o painel está em toggleFilterPanel
            }
        });
        this.quizUI.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => this.quizLogic.applyFiltersAndStartQuiz());
        this.quizUI.elements.btnLimparFiltrosPainel?.addEventListener('click', () => this.quizLogic.clearAllFiltersInPanel());
        this.quizUI.elements.btnCatSelectAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState(this.quizData.getCategorias().map(c=>c.id_categoria.toString())); });
        this.quizUI.elements.btnCatClearAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState([]); });

        // Navegação do Quiz
        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());

        // Ações de Resultado
        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());
        this.quizUI.elements.btnExplorarMais?.addEventListener('click', () => this.handleExplorarMais());

        // Modal de Confirmação
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => { this.quizLogic.forceEndQuiz(); });
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => { this.quizUI.toggleConfirmModal(false); });
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (e)=>{if(e.target===this.quizUI.elements.confirmEncerrarOverlay)this.quizUI.toggleConfirmModal(false);});
        
        // Tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.quizUI.elements.filterPanel?.classList.contains('filter-panel--visible')) {
                    this.quizUI.toggleFilterPanel(false);
                    // A lógica de mostrar o hub/placeholder ao fechar o painel está em toggleFilterPanel
                }
                if (this.quizUI.elements.explanationModalOverlay?.classList.contains('modal--visible')) {
                    this.quizUI.toggleExplanationModal(false);
                }
            }
        });

        // Checkboxes de Dificuldade
        const diffInputs = this.quizUI.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]');
        const allDiffCb = this.quizUI.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        diffInputs?.forEach(input => {
            input.addEventListener('change', () => {
                if (input.value === 'all' && input.checked) {
                    diffInputs.forEach(other => { if (other.value !== 'all') other.checked = false; });
                } else if (input.value !== 'all' && input.checked) {
                    if (allDiffCb) allDiffCb.checked = false;
                }
                const anySpecificChecked = Array.from(diffInputs).some(cb => cb.value !== 'all' && cb.checked);
                if (!anySpecificChecked && allDiffCb && !allDiffCb.checked) {
                    allDiffCb.checked = true; // Se nenhum específico estiver marcado, marca "Todas"
                }
            });
        });

        // Modal de Explicação
        this.quizUI.elements.btnToggleExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(true));
        this.quizUI.elements.btnCloseExplanationModal?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.btnGotItExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.explanationModalOverlay?.addEventListener('click', (e)=>{if(e.target===this.quizUI.elements.explanationModalOverlay)this.quizUI.toggleExplanationModal(false);});
    }

    handleExplorarMais() {
        this.quizUI.showSection('home-section');
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});