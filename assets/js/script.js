/**
 * script.js
 * Principal SCRIPT do MedQuiz.
 * Gerencia a lógica do quiz, interações de UI, carregamento de dados e estado do usuário.
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

            if (!this.perguntas.length) console.warn("Nenhuma pergunta foi carregada.");
            if (!this.categorias.length) console.warn("Nenhuma categoria foi carregada.");
            if (!this.opcoesResposta.length && this.perguntas.length > 0) console.warn("Nenhuma opção de resposta carregada.");

            this._validateDataIntegrity();
            return true;
        } catch (error) {
            console.error("Erro CRÍTICO ao carregar dados JSON:", error);
            this._resetProcessedData();
            throw error;
        }
    }

    _resetProcessedData() { this.perguntas = []; this.categorias = []; this.opcoesResposta = []; }

    _validateDataIntegrity() {
        // Validações básicas para integridade dos dados carregados.
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
        if (issues === 0) console.log("Validação de dados OK.");
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
            else { const pai = catMap.get(node.id_categoria_pai); if (pai) pai.subcategorias.push(node); else { raizes.push(node);}} // Adiciona como raiz se o pai não for encontrado
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
        this.selectedDifficulties = ['all'];
        this.isInitialQuestionLoad = true;
        this.isQuickQuizMode = false;
        this.QUICK_QUIZ_COUNT = 10;
    }
    initialize(perguntas) { this.allQuestions = perguntas; this.resetQuizState(); }
    resetQuizState() {
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        this.allQuestions.forEach(q => {
            delete q.respostaDadaId;
            delete q.foiCorretaNaSessao;
            delete q.foiPulada; // Adicionado para rastrear questões puladas
        });
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
        this.resetQuizState(); // Importante para limpar estados de 'foiPulada', etc.
        if (this.isQuickQuizMode) {
            if (!this.allQuestions.length) { this.filteredQuestions = []; return this.filteredQuestions; }
            const shuffled = [...this.allQuestions].sort(() => 0.5 - Math.random());
            this.filteredQuestions = shuffled.slice(0, Math.min(this.QUICK_QUIZ_COUNT, shuffled.length));
        } else {
            let perguntasPotenciais = [...this.allQuestions];
            if (this.selectedCategories.length > 0) {
                const idsCatRelevantes = new Set();
                const getDescendentes = (catIdNum) => { // Função auxiliar recursiva para obter todos os IDs de subcategorias
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
    recordAnswer(opcaoId) { const q = this.getCurrentQuestion(); if (q && !q.hasOwnProperty('respostaDadaId')) { q.respostaDadaId = opcaoId; q.foiPulada = false; return true; } return false; }
    markNavigated() { this.isInitialQuestionLoad = false; }
    goToQuestion(index) { if (index >= 0 && index < this.filteredQuestions.length) { this.currentQuestionIndex = index; this.markNavigated(); return true; } return false; }
    goToNextQuestion() { if (this.currentQuestionIndex < this.filteredQuestions.length) { this.currentQuestionIndex++; this.markNavigated(); return true; } return false; } // Não incrementa se já passou da última
    goToPreviousQuestion() { if (this.currentQuestionIndex > 0) { this.currentQuestionIndex--; this.markNavigated(); return true; } return false; }
}

// --- Módulo: LayoutManager ---
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
            this.footerElement.classList.add(this.hiddenClassName);
        } else {
            this.footerElement.classList.remove(this.hiddenClassName);
        }
    }
}
// --- Módulo: ChallengeHubManager ---
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
        this.quizLogic = quizLogic;
        this.quizUI = null; // Será injetado pela App
        this._validateElements();
    }

    _validateElements() {
        for (const key in this.elements) {
            if (!this.elements[key]) {
                console.warn(`ChallengeHubManager: Elemento DOM '${key}' não encontrado.`);
            }
        }
    }

    setQuizUI(quizUIInstance) { this.quizUI = quizUIInstance; }
    showHub() { if (this.elements.challengeHubContainer) this.quizUI.showElement(this.elements.challengeHubContainer); if (this.elements.placeholderFiltrosContainer) this.quizUI.hideElement(this.elements.placeholderFiltrosContainer); }
    hideHub() { if (this.elements.challengeHubContainer) this.quizUI.hideElement(this.elements.challengeHubContainer); }
    updateTotalQuestionsCount(count) { if (this.elements.hubTotalQuestionsCount) this.elements.hubTotalQuestionsCount.textContent = count; }
    updateQuickQuizCount(count) { if (this.elements.hubQuickQuizCount) this.elements.hubQuickQuizCount.textContent = count; }

    setupEventListeners() {
        this.elements.hubCustomizeQuizBtn?.addEventListener('click', () => {
            this.hideHub();
            if (this.quizUI) { // quizUI deve ser setado antes
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
        this.currentSection = 'home-section'; // Seção inicial padrão
        this.QUESTOES_POR_PAGINA_GRID = 5;
        this.TRANSITION_DURATION = 300; // ms, para animações de modal/painel
        this.onSectionChange = onSectionChangeCallback; // Callback para notificar App sobre mudança de seção
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.timerRunning = false;
        this.focusedElementBeforePanel = null; // Para restaurar foco após fechar painel/modal
        this.focusedElementBeforeExplanationModal = null;
        this.cacheDOMelements();
    }

    cacheDOMelements() {
        this.elements = {
            // Seções principais
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'),
            accountSection: document.getElementById('account-section'),
            navElements: document.querySelectorAll('[data-section]'), // Links de navegação

            // Conteúdo Principal da Seção de Questões
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),
            scorePanel: document.querySelector('.score-panel'),

            // Hub de Desafios (Challenge Hub)
            challengeHubContainer: document.getElementById('challenge-hub-container'),
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'),
            hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'),
            hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'),
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'), // Botão no placeholder

            // Avisos e Placeholders
            avisoContainer: document.getElementById('aviso-container'),
            avisoMensagem: document.querySelector('#aviso-container .card--aviso p'),
            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),

            // Elementos do Quiz Ativo
            quizSectionContent: document.getElementById('quiz-section'), // Onde o quiz acontece
            questionWrap: document.querySelector('#quiz-section .card--question-wrap'), // Card que envolve a questão
            progressContainer: document.getElementById('progress-container'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressText: document.getElementById('progress-text'),
            questionTitle: document.getElementById('question-title'), // Container para número e categoria
            categoriaTitulo: document.getElementById('categoria-titulo'),
            idQuestao: document.getElementById('id-questao'), // Número da questão
            perguntaTexto: document.getElementById('pergunta-texto'),
            perguntaImagem: document.getElementById('pergunta-imagem'),
            respostasContainer: document.getElementById('respostas-container'),
            referenciaQuestao: document.getElementById('referencia-questao'),
            navigationButtons: document.querySelector('#quiz-section .quiz-navigation'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            feedbackAcessivel: document.getElementById('feedback-acessivel'), // Para leitores de tela
            questionGridContainer: document.getElementById('question-grid-container'),

            // Botões e Displays de Pontuação (Score Panel)
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            timerDisplay: document.getElementById('timer-display'),

            // Resultados do Quiz
            resultadoCard: document.querySelector('#question-section .card--quiz-result'),
            resultadoTitulo: document.querySelector('#question-section .card--quiz-result .quiz-results__main-title'),
            resultadoPontos: document.getElementById('resultado-pontos'),
            resultadoAcertos: document.getElementById('resultado-acertos'),
            resultadoErros: document.getElementById('resultado-erros'),
            resultadoTempo: document.getElementById('resultado-tempo'),
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'),
            btnRecomecar: document.getElementById('btn-recomecar'),
            btnExplorarMais: document.getElementById('btn-explorar-mais'),

            // Modal de Confirmação
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn'),

            // Painel de Filtros
            filterPanel: document.getElementById('filter-panel'),
            btnFecharFiltros: document.getElementById('btn-fechar-filtros'),
            filterPanelOverlay: document.getElementById('filter-panel-overlay'),
            categoryTreeList: document.getElementById('category-tree-list'),
            btnCatSelectAll: document.getElementById('btn-cat-select-all'),
            btnCatClearAll: document.getElementById('btn-cat-clear-all'),
            btnLimparFiltrosPainel: document.getElementById('btn-limpar-filtros-painel'),
            btnAplicarFiltrosPainel: document.getElementById('btn-aplicar-filtros-painel'),
            filterGroupDifficulty: document.getElementById('filter-group-difficulty'),

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
            startRandomQuiz: document.getElementById('start-random-quiz'),
            startCategoryQuiz: document.getElementById('start-category-quiz')
        };
        // Mapeamento de IDs de seção para seus elementos DOM principais
        this.sectionElements = {
            'home-section': this.elements.homeSection,
            'question-section': this.elements.questionSection,
            'account-section': this.elements.accountSection
        };
        this._validateCache();
    }

    _validateCache() {
        // Elementos opcionais ou que podem não estar presentes em todas as UIs
        const optionalElements = ['feedbackAcessivel', 'filterGroupDifficulty',
                        'explanationModalOverlay', 'explanationModalDialog', 'explanationModalTitle',
                        'btnCloseExplanationModal', 'explanationModalGeneralBlock', 'explanationModalGeneralText',
                        'explanationModalOptionsBlock', 'explanationModalOptionsList', 'explanationModalDivider',
                        'explanationModalEmptyState','btnGotItExplanation'
                        ];
        for (const key in this.elements) {
            if (!this.elements[key] && !optionalElements.includes(key) && !(key in this.sectionElements)) {
                console.warn(`QuizUI Cache: Elemento DOM '${key}' não encontrado! Verifique o HTML.`);
            }
        }
        for (const key in this.sectionElements) { // Valida se os elementos principais das seções foram encontrados
            if(!this.sectionElements[key]) {
                console.warn(`QuizUI Cache: Seção DOM '${key}' não encontrada! Verifique o HTML.`);
            }
        }
    }

    showElement(el) { el?.classList.remove(this.hiddenClassName); }
    hideElement(el) { el?.classList.add(this.hiddenClassName); }

    // --- Gerenciamento do Timer ---
    stopTimer() { if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; } this.timerRunning = false; }
    resetTimer() { this.stopTimer(); this.timerSeconds = 0; if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = "00:00"; if (this.elements.resultadoTempo && !this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) this.elements.resultadoTempo.textContent = "00:00"; }
    startTimer() { if (this.timerRunning) return; this.timerRunning = true; this.timerInterval = setInterval(() => { this.timerSeconds++; if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = this._formatDisplayTime(this.timerSeconds); }, 1000); }
    _formatDisplayTime(seconds) { const m = Math.floor(seconds / 60); return `${String(m).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
    // --- Atualização do Placar ---
    updateScoreDisplay(pontos, acertos, erros) { if (this.elements.pontuacaoDisplay) this.elements.pontuacaoDisplay.textContent = pontos; if (this.elements.acertosNumDisplay) this.elements.acertosNumDisplay.textContent = acertos; if (this.elements.errosNumDisplay) this.elements.errosNumDisplay.textContent = erros; }

    // --- Gerenciamento do Painel de Filtros ---
    toggleFilterPanel(show) {
        const { filterPanel: panel, filterPanelOverlay: overlay, placeholderFiltrosContainer } = this.elements;
        if (!panel || !overlay) return;
        const panelVisibleClass = 'filter-panel--visible';
        const overlayVisibleClass = 'filter-panel-overlay--visible';

        if (show) {
            this.focusedElementBeforePanel = document.activeElement;
            // Atualiza o estado dos filtros no painel com base no estado atual do quiz (se disponível)
            if (this.quizState) { // quizState é injetado na UI pela App
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
                if (!panel.classList.contains(panelVisibleClass)) { // Só esconde se a transição terminou e o painel não está visível
                    this.hideElement(panel); this.hideElement(overlay);
                    panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true');
                }
                panel.removeEventListener('transitionend', onTransitionEnd);
                this.focusedElementBeforePanel?.focus(); // Devolve o foco
                // Se o quiz não estiver ativo (ou seja, estamos na seção de questões, mas o conteúdo do quiz está oculto),
                // e o painel foi fechado, então mostramos o hub de desafios.
                if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName)) {
                    this.hideElement(placeholderFiltrosContainer);
                    this.showElement(this.elements.challengeHubContainer);
                }
            };
            panel.addEventListener('transitionend', onTransitionEnd, { once: true });
            // Fallback caso o evento transitionend não dispare
            setTimeout(() => {
                if (!panel.classList.contains(panelVisibleClass)) { this.hideElement(panel); this.hideElement(overlay); panel.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true'); this.focusedElementBeforePanel?.focus(); if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName)) { this.hideElement(placeholderFiltrosContainer); this.showElement(this.elements.challengeHubContainer); } }
                panel.removeEventListener('transitionend', onTransitionEnd);
            }, this.TRANSITION_DURATION + 50);
        }
    }

    // --- Gerenciamento de Seções ---
    getSectionUIConfig() { // Define quais elementos mostrar/esconder para cada seção
        return {
            'home-section': { visible: [this.elements.homeSection], hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.placeholderFiltrosContainer, this.elements.btnToggleExplanation, this.elements.scorePanel, this.elements.challengeHubContainer], onEnter: null },
            'question-section': { visible: [this.elements.challengeHubContainer], hidden: [this.elements.scorePanel, this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.placeholderFiltrosContainer, this.elements.btnToggleExplanation],
                onEnter: () => { // Ao entrar na seção de questões, se nenhum quiz/resultado estiver ativo, mostra o hub.
                    if (this.elements.quizSectionContent?.classList.contains(this.hiddenClassName) &&
                        this.elements.resultadoCard?.classList.contains(this.hiddenClassName)) {
                        this.showElement(this.elements.challengeHubContainer);
                        this.hideElement(this.elements.scorePanel); // Score panel deve estar oculto com o hub
                        this.hideElement(this.elements.placeholderFiltrosContainer); // Placeholder também
                        this.hideElement(this.elements.avisoContainer); // E avisos
                    }
                }
            },
            'account-section': { visible: [this.elements.accountSection], hidden: [this.elements.quizSectionContent, this.elements.resultadoCard, this.elements.btnEncerrarSessao, this.elements.questionGridContainer, this.elements.progressContainer, this.elements.progressText, this.elements.avisoContainer, this.elements.placeholderFiltrosContainer, this.elements.btnToggleExplanation, this.elements.scorePanel, this.elements.challengeHubContainer], onEnter: null }
        };
    }

    showSection(sectionId) {
        Object.values(this.sectionElements).forEach(sectionEl => { if (sectionEl) this.hideElement(sectionEl); }); // Esconde todas as seções
        const sectionToShow = this.sectionElements[sectionId];

        if (sectionToShow) {
            const previousSection = this.currentSection;
            this.showElement(sectionToShow); // Mostra a seção desejada
            this.currentSection = sectionId;
            this._updateActiveNavLinks(sectionId); // Atualiza links de navegação

            const config = this.getSectionUIConfig()[sectionId]; // Pega configuração específica da seção
            if (config) {
                config.visible?.forEach(el => this.showElement(el));
                config.hidden?.forEach(el => this.hideElement(el));
                config.onEnter?.(); // Executa ação de entrada, se houver
            } else { console.warn(`Configuração de UI para '${sectionId}' não encontrada.`); }

            // Lógica ao sair da seção de questões
            if (previousSection === 'question-section' && sectionId !== 'question-section') {
                this.toggleFilterPanel(false); // Fecha painel de filtros
                this.toggleExplanationModal(false); // Fecha modal de explicação
                this.hideElement(this.elements.scorePanel); // Garante que o score panel está oculto
            }


            if (this.onSectionChange && typeof this.onSectionChange === 'function' && previousSection !== sectionId) {
                try { this.onSectionChange(sectionId, previousSection); } catch (error) { console.error("Erro no callback onSectionChange:", error); }
            }
        } else {
            console.error(`QuizUI.showSection: Seção com ID '${sectionId}' NÃO ENCONTRADA no mapeamento sectionElements.`);
        }
    }

    _updateActiveNavLinks(activeSectionId) { this.elements.navElements?.forEach(t => { if (t) { const e = t.dataset.section === activeSectionId, s = "main-nav__link", i = "bottom-nav__link", n = "--active"; t.classList.remove(`${s}${n}`, `${i}${n}`); e ? (t.classList.contains(s) ? t.classList.add(`${s}${n}`) : t.classList.contains(i) && t.classList.add(`${i}${n}`), t.setAttribute("aria-current", "page")) : t.removeAttribute("aria-current"); } }); }

    // --- Avisos e Placeholders ---
    showWarning(message) {
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer } = this.elements;
        if (avisoContainer && avisoMensagem) {
            avisoMensagem.textContent = message;
            avisoMensagem.setAttribute("role", "alert");
            this.showElement(avisoContainer);
            this.hideElement(placeholderFiltrosContainer); // Esconder placeholder se aviso é mostrado
            this.hideElement(challengeHubContainer); // Esconder o hub se um aviso for mostrado
            if (this.currentSection === "question-section") this.hideQuizElements(); // Esconder elementos do quiz se houver aviso
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
            this.hideElement(placeholderFiltrosContainer); // Garante que placeholder de filtros está oculto
            this.showElement(challengeHubContainer); // Mostra o hub de desafios
        }
    }

    // --- Exibição do Conteúdo do Quiz ---
    displayQuizContent(show = true) { // Controla a visibilidade dos elementos principais do quiz
        const {
            quizSectionContent, btnEncerrarSessao, progressContainer, progressText,
            questionGridContainer, scorePanel, challengeHubContainer,
            placeholderFiltrosContainer, resultadoCard
        } = this.elements;

        if (show) { // Mostrando o quiz
            this.showElement(scorePanel);
            this.hideElement(challengeHubContainer);
            this.showElement(quizSectionContent);
            this.showElement(btnEncerrarSessao);
            this.showElement(progressContainer);
            this.showElement(progressText);
            this.showElement(questionGridContainer);
            this.clearWarning(); // Limpa avisos e decide se mostra hub/placeholder
            this.hideElement(placeholderFiltrosContainer); // Garante que placeholder de filtro está oculto
            this.hideElement(resultadoCard); // Garante que resultados anteriores estão ocultos
        } else { // Escondendo o quiz (ex: ao encerrar ou ir para resultados)
            this.hideElement(scorePanel);
            this.hideElement(quizSectionContent);
            this.hideElement(btnEncerrarSessao);
            this.hideProgressBar();
            this.hideElement(questionGridContainer);
            this.toggleExplanationModal(false); // Fecha modal de explicação se estiver aberto
            this.hideElement(this.elements.btnToggleExplanation);

            // Ao terminar/sair do quiz, decidir o que mostrar:
            if (resultadoCard && !resultadoCard.classList.contains(this.hiddenClassName)) {
                this.hideElement(challengeHubContainer); // Se mostrando resultados, hub fica oculto
            } else {
                this.showElement(challengeHubContainer); // Caso contrário, mostrar o hub
                this.hideElement(placeholderFiltrosContainer); // E esconder o placeholder de filtros
            }
        }
    }


    hideQuizElements() { // Usado para limpar a área do quiz (ex: ao mostrar aviso)
        const { quizSectionContent, resultadoCard, questionGridContainer, btnEncerrarSessao } = this.elements;
        this.hideElement(quizSectionContent);
        this.hideElement(resultadoCard);
        this.hideElement(questionGridContainer);
        this.hideElement(btnEncerrarSessao);
        this.hideProgressBar();
        this.toggleExplanationModal(false); // Fecha modal de explicação
        this.hideElement(this.elements.btnToggleExplanation);
    }

    displayQuestion(perguntaObj, qNum, totalQ, categorias, relacaoPerguntaCategorias, isQuickQuizMode) {
        if (!perguntaObj) return console.error("Tentativa de exibir questão nula.");
        // Define o título da categoria (ou "Quiz Rápido")
        let tituloCat = "Questão";
        if (isQuickQuizMode) {
            tituloCat = "Quiz Rápido";
        } else {
            const idsCategoriasDaPergunta = relacaoPerguntaCategorias.filter(pc => pc.id_pergunta === perguntaObj.id_pergunta).map(pc => pc.id_categoria);
            if (idsCategoriasDaPergunta.length > 0) {
                let idCategoriaParaMostrar = idsCategoriasDaPergunta[0];
                // Se houver múltiplas categorias, tenta encontrar a mais específica (mais profunda na hierarquia)
                if (idsCategoriasDaPergunta.length > 1) {
                    const categoriasObjDaPergunta = categorias.filter(c => idsCategoriasDaPergunta.includes(c.id_categoria));
                    if (categoriasObjDaPergunta.length > 0) {
                        idCategoriaParaMostrar = categoriasObjDaPergunta.reduce((categoriaMaisProfunda, categoriaAtual) => {
                            return this._getCategoriaProfundidade(categoriaAtual, categorias) > this._getCategoriaProfundidade(categoriaMaisProfunda, categorias) ? categoriaAtual : categoriaMaisProfunda;
                        }, categoriasObjDaPergunta[0]).id_categoria;
                    }
                }
                // Monta o caminho da categoria (ex: Pai > Filho > Neto)
                let caminhoHierarquico = []; let idAtual = idCategoriaParaMostrar; let iteracoes = 0;
                while (idAtual != null && iteracoes < 5) { // Limita a profundidade para evitar loops infinitos
                    const categoriaEncontrada = categorias.find(cat => cat.id_categoria === idAtual);
                    if (categoriaEncontrada) { caminhoHierarquico.unshift(categoriaEncontrada.nome_categoria); idAtual = categoriaEncontrada.id_categoria_pai; }
                    else break;
                    iteracoes++;
                }
                tituloCat = caminhoHierarquico.length > 0 ? caminhoHierarquico.join(' › ') : "Categorias";
            }
        }
        if(this.elements.categoriaTitulo) this.elements.categoriaTitulo.innerText = tituloCat;
        if(this.elements.idQuestao) this.elements.idQuestao.innerText = qNum; // Número da questão
        if(this.elements.perguntaTexto) this.elements.perguntaTexto.textContent = perguntaObj.texto_pergunta;
        if(this.elements.referenciaQuestao) this.elements.referenciaQuestao.textContent = `Referência: ${perguntaObj.referencia_bibliografica || "N/A"}`;
        this.displayQuestionImage(perguntaObj.url_imagem, qNum); // Lida com a imagem da questão
        this.updateProgressBar(qNum, totalQ);
        this.elements.questionTitle?.focus({preventScroll:true}); // Foco para acessibilidade
        this.hideElement(this.elements.btnToggleExplanation); // Esconde botão de análise
        this.toggleExplanationModal(false); // Fecha modal de análise se aberto
    }
    _getCategoriaProfundidade(cat,allCats){if(!cat||!allCats)return -1;let d=0;let pId=cat.id_categoria_pai;while(pId!=null&&d<10){d++;const p=allCats.find(c=>c.id_categoria===pId);pId=p?p.id_categoria_pai:null;}return d;}
    displayQuestionImage(url,qNum){const el=this.elements.perguntaImagem;if(el){if(url?.trim()){el.src=url;el.alt=`Ilustração questão ${qNum}`;this.showElement(el);el.onerror=()=>{this.hideElement(el);console.warn(`Erro img: ${url}`);el.onerror=null;}}else{this.hideElement(el);el.src="";el.alt="";}}}
    generateAnswerButtons(perguntaId,opcoes,respostaDadaId,callbackResposta){const cont=this.elements.respostasContainer;if(!cont)return;cont.innerHTML='';if(!opcoes||opcoes.length===0){cont.innerHTML=`<p class="error-message">Opções para P${perguntaId} não encontradas.</p>`;return;}const temResposta=typeof respostaDadaId!=='undefined'&&respostaDadaId!==null;const baseCl='question-display__answer-option';opcoes.forEach(opt=>{const btn=document.createElement('button');btn.className=baseCl;btn.textContent=opt.texto_opcao;btn.dataset.opcaoId=opt.id_opcao_resposta.toString();btn.disabled=temResposta;btn.style.cursor=temResposta?'default':'pointer';btn.tabIndex=temResposta?-1:0;if(temResposta){btn.classList.add(`${baseCl}--answered`);if(opt.eh_correta)btn.classList.add(`${baseCl}--correct`);else if(opt.id_opcao_resposta===respostaDadaId)btn.classList.add(`${baseCl}--incorrect`);}else if(callbackResposta)btn.onclick=()=>callbackResposta(opt.id_opcao_resposta);cont.appendChild(btn);});}
    disableAnswers(){const c='question-display__answer-option',a=`${c}--answered`;this.elements.respostasContainer?.querySelectorAll(`button.${c}`).forEach(b=>{b.onclick=null;b.disabled=true;b.classList.add(a);b.style.cursor="default";b.tabIndex=-1;});}

    applyAnswerFeedback(selectedOpId, opcoes) { // Aplica classes CSS de feedback visual às opções de resposta
        const baseCl = "question-display__answer-option", corrCl = `${baseCl}--correct`, incorrCl = `${baseCl}--incorrect`;
        let userCorrect = false;
        this.elements.respostasContainer?.querySelectorAll(`button.${baseCl}`).forEach(btn => {
            const btnOpId = parseInt(btn.dataset.opcaoId);
            const optData = opcoes.find(op => op.id_opcao_resposta === btnOpId);
            if (!optData) return; // Opção não encontrada, skip
            if (btnOpId === selectedOpId) { // Opção selecionada pelo usuário
                if (optData.eh_correta) { btn.classList.add(corrCl); userCorrect = true; } else { btn.classList.add(incorrCl); }
            } else if (optData.eh_correta) { // Se não foi a selecionada, mas é a correta
                btn.classList.add(corrCl);
            } // Outras opções (não selecionadas e incorretas) não recebem classe de feedback específica, a menos que desejado
        });
        if(this.elements.feedbackAcessivel) this.elements.feedbackAcessivel.textContent = userCorrect ? "Resposta correta!" : "Resposta incorreta.";

        // Mostra botão de análise se houver explicação geral ou específica das opções
        const currentQ = this.quizState.getCurrentQuestion(); // quizState é injetado
        const hasGeneralExpl = currentQ && currentQ.explicacao_resposta && currentQ.explicacao_resposta.trim() !== '';
        const hasOptExpl = opcoes.some(op => op.feedback_opcao && op.feedback_opcao.trim() !== '');
        if ((hasGeneralExpl || hasOptExpl) && this.elements.btnToggleExplanation) this.showElement(this.elements.btnToggleExplanation);
        else this.hideElement(this.elements.btnToggleExplanation);
    }
    toggleExplanationModal(show){const o=this.elements.explanationModalOverlay,d=this.elements.explanationModalDialog;if(!o||!d||!this.quizState||!this.quizData)return;const mVis='modal--visible';if(show){const q=this.quizState.getCurrentQuestion();if(!q)return;const opts=this.quizData.getOpcoesPorPerguntaId(q.id_pergunta);let hasCont=false;const genBlk=this.elements.explanationModalGeneralBlock,genTxt=this.elements.explanationModalGeneralText;if(q.explicacao_resposta?.trim()){genTxt.innerHTML=q.explicacao_resposta.replace(/\n/g,'<br>');this.showElement(genBlk);hasCont=true;}else this.hideElement(genBlk);const optsBlk=this.elements.explanationModalOptionsBlock,optsList=this.elements.explanationModalOptionsList;optsList.innerHTML='';let hasSpecOptFeed=false;opts.forEach(opt=>{if(opt.feedback_opcao?.trim()){hasSpecOptFeed=true;const li=document.createElement('li');const origSpan=document.createElement('span');origSpan.className='option-original-text';origSpan.textContent=`Opção: "${opt.texto_opcao}"`;li.appendChild(origSpan);const feedSpan=document.createElement('span');feedSpan.className='option-feedback-value';feedSpan.classList.add(opt.eh_correta?'correct':'incorrect');feedSpan.innerHTML=opt.feedback_opcao.replace(/\n/g,'<br>');li.appendChild(feedSpan);optsList.appendChild(li);}});if(hasSpecOptFeed){this.showElement(optsBlk);hasCont=true;}else this.hideElement(optsBlk);const div=this.elements.explanationModalDivider;if(genBlk&&!genBlk.classList.contains(this.hiddenClassName)&&optsBlk&&!optsBlk.classList.contains(this.hiddenClassName)&&div)this.showElement(div);else if(div)this.hideElement(div);const empty=this.elements.explanationModalEmptyState;if(!hasCont&&empty)this.showElement(empty);else if(empty)this.hideElement(empty);this.focusedElementBeforeExplanationModal=document.activeElement;this.showElement(o);o.scrollTop;requestAnimationFrame(()=>{o.classList.add(mVis);d.focus();});}else{o.classList.remove(mVis);const end=()=>{if(!o.classList.contains(mVis))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforeExplanationModal?.focus();};o.addEventListener('transitionend',end,{once:true});setTimeout(()=>{if(!o.classList.contains(mVis))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforeExplanationModal?.focus();},this.TRANSITION_DURATION+50);}}
    updateProgressBar(current,total){const p=this.elements.progressContainer,f=this.elements.progressBarFill,x=this.elements.progressText;if(p&&f&&x){if(total>0){f.style.width=`${Math.min(current,total)/total*100}%`;x.textContent=`${current} / ${total}`;this.showElement(p);this.showElement(x);}else this.hideProgressBar();}}
    hideProgressBar(){this.hideElement(this.elements.progressContainer);this.hideElement(this.elements.progressText);if(this.elements.progressBarFill)this.elements.progressBarFill.style.width="0%";if(this.elements.progressText)this.elements.progressText.textContent="";}
    updateNavigationButtons(isFirst,isLast,totalQuestions){const n=this.elements.navigationButtons,p=this.elements.prevBtn,nxt=this.elements.nextBtn;if(n&&p&&nxt){if(totalQuestions<=0)this.hideElement(n);else{this.showElement(n);p.disabled=isFirst;nxt.disabled=false; nxt.textContent=isLast?"Ver Resultado":"Próxima";}}} // Botão Próxima sempre habilitado, a lógica de quando avançar está no QuizLogic

    renderQuestionGrid(questions,currentIndex,callbackSelectQuestion){ // `questions` são as `filteredQuestions` do QuizState
        const container=this.elements.questionGridContainer;
        if(!container)return;
        if(!questions?.length){this.hideElement(container);return;}
        this.showElement(container);container.innerHTML=''; // Limpa o grid
        const currentPage=Math.floor(currentIndex/this.QUESTOES_POR_PAGINA_GRID);
        const startIndex=currentPage*this.QUESTOES_POR_PAGINA_GRID;
        const endIndex=Math.min(startIndex+this.QUESTOES_POR_PAGINA_GRID,questions.length);
        // Classes CSS para os itens do grid
        const arrowBaseClass='question-grid__arrow',itemBaseClass='question-grid__item';
        const itemCurrentClass=`${itemBaseClass}--current`,itemCorrectClass=`${itemBaseClass}--correct`;
        const itemIncorrectClass=`${itemBaseClass}--incorrect`, itemSkippedClass = `${itemBaseClass}--skipped`;

        // Botão de página anterior
        container.appendChild(this._createGridArrow('prev',startIndex===0,()=>callbackSelectQuestion(Math.max(0,startIndex-1)),'Página Anterior',[`${arrowBaseClass}--left`]));
        // Itens da página atual
        for(let i=startIndex;i<endIndex;i++){
            const question=questions[i];const item=document.createElement('button');item.className=itemBaseClass;item.textContent=i+1;item.dataset.index=i.toString();item.setAttribute('aria-label',`Questão ${i+1}`);item.onclick=()=>callbackSelectQuestion(i);
            // Aplica classes de status (respondida correta/incorreta, pulada, atual)
            if(question.hasOwnProperty('respostaDadaId')&&question.respostaDadaId!==null){ // Se foi respondida
                if(question.foiCorretaNaSessao===true)item.classList.add(itemCorrectClass);
                else if(question.foiCorretaNaSessao===false)item.classList.add(itemIncorrectClass);
            } else if (question.foiPulada) { // Se foi pulada (nova condição)
                item.classList.add(itemSkippedClass);
            }
            if(i===currentIndex)item.classList.add(itemCurrentClass); // Se é a questão atual
            container.appendChild(item);
        }
        // Botão de próxima página
        container.appendChild(this._createGridArrow('next',endIndex>=questions.length,()=>callbackSelectQuestion(Math.min(questions.length-1,endIndex)),'Próxima Página',[`${arrowBaseClass}--right`]));
    }
    _createGridArrow(direction,disabled,onClickCallback,ariaLabel,extraClasses=[]){const btn=document.createElement('button');btn.className='question-grid__arrow';btn.classList.add(...extraClasses,'u-is-circle');btn.setAttribute('aria-label',ariaLabel);btn.disabled=disabled;btn.onclick=onClickCallback;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 -960 960 960");svg.setAttribute("fill","currentColor");const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",direction==='prev'?"M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z":"M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z");svg.appendChild(path);btn.appendChild(svg);return btn;}
    // --- Gerenciamento da Árvore de Categorias e Filtros ---
    generateCategoryTree(categories){const treeContainer=this.elements.categoryTreeList;if(!treeContainer)return;treeContainer.innerHTML='';const createTreeNodes=(nodes,parentElement,level=0)=>{nodes.forEach(categoryNode=>{const listItem=document.createElement('li');listItem.className='category-tree__item';listItem.setAttribute('role','treeitem');listItem.setAttribute('aria-checked','false');const wrapper=document.createElement('div');wrapper.className='category-tree__label-wrapper';const inputCheckbox=document.createElement('input');inputCheckbox.type='checkbox';inputCheckbox.id=`cat-tree-${categoryNode.id_categoria}`;inputCheckbox.className='category-tree__input u-sr-only';inputCheckbox.value=categoryNode.id_categoria.toString();inputCheckbox.tabIndex=-1;inputCheckbox.addEventListener('change',(e)=>this.handleCategoryCheckboxChange(e.target));const label=document.createElement('label');label.htmlFor=inputCheckbox.id;label.className='category-tree__label';label.textContent=categoryNode.nome_categoria;label.tabIndex=0;label.addEventListener('keydown',(e)=>{if(e.key===' '||e.key==='Enter'){inputCheckbox.checked=!inputCheckbox.checked;inputCheckbox.dispatchEvent(new Event('change',{bubbles:true}));e.preventDefault();}});if(categoryNode.subcategorias?.length>0){listItem.classList.add('category-tree__item--has-children');listItem.setAttribute('aria-expanded','false');const toggleButton=document.createElement('button');toggleButton.type='button';toggleButton.className='category-tree__toggle';toggleButton.setAttribute('aria-label',`Expandir ${categoryNode.nome_categoria}`);toggleButton.setAttribute('aria-expanded','false');toggleButton.innerHTML=`<span class="material-symbols-outlined">chevron_right</span>`;wrapper.appendChild(toggleButton);wrapper.appendChild(inputCheckbox);wrapper.appendChild(label);const submenuList=document.createElement('ul');submenuList.className='category-tree__submenu';submenuList.setAttribute('role','group');createTreeNodes(categoryNode.subcategorias,submenuList,level+1);listItem.appendChild(wrapper);listItem.appendChild(submenuList);const toggleAction=(event)=>{event.stopPropagation();const isExpanded=listItem.getAttribute('aria-expanded')==='true';listItem.setAttribute('aria-expanded',String(!isExpanded));toggleButton.setAttribute('aria-expanded',String(!isExpanded));toggleButton.setAttribute('aria-label',`${!isExpanded?'Recolher':'Expandir'} ${categoryNode.nome_categoria}`);submenuList.classList.toggle('category-tree__submenu--expanded');if(!isExpanded)submenuList.style.maxHeight=submenuList.scrollHeight+"px";else requestAnimationFrame(()=>{submenuList.style.maxHeight='0';});toggleButton.querySelector('.material-symbols-outlined').textContent=!isExpanded?'expand_more':'chevron_right';};toggleButton.addEventListener('click',toggleAction);toggleButton.addEventListener('keydown',(event)=>{if(event.key===' '||event.key==='Enter'){toggleAction(event);event.preventDefault();}});}else{wrapper.appendChild(inputCheckbox);wrapper.appendChild(label);listItem.appendChild(wrapper);}parentElement.appendChild(listItem);});};createTreeNodes(categories,treeContainer);const parentListItems=Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children')||[]);for(let i=parentListItems.length-1;i>=0;i--)this.updateParentCheckboxState(parentListItems[i]);} // Atualiza estado dos pais após gerar a árvore
    handleCategoryCheckboxChange(checkbox){const isChecked=checkbox.checked;const listItem=checkbox.closest('.category-tree__item');if(!listItem)return;checkbox.classList.remove('is-indeterminate');listItem.setAttribute('aria-checked',String(isChecked));const childCheckboxes=listItem.querySelectorAll(':scope > .category-tree__submenu .category-tree__input');childCheckboxes.forEach(childCb=>{childCb.checked=isChecked;childCb.classList.remove('is-indeterminate');const childListItem=childCb.closest('.category-tree__item');if(childListItem)childListItem.setAttribute('aria-checked',String(isChecked));});this.updateParentCheckboxState(listItem.parentElement?.closest('.category-tree__item'));} // Propaga mudança para pais
    updateParentCheckboxState(parentListItem){if(!parentListItem)return;const parentCheckbox=parentListItem.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');if(!parentCheckbox)return;const childListItems=parentListItem.querySelectorAll(':scope > .category-tree__submenu > .category-tree__item');if(childListItems.length===0)return;let allChildrenChecked=true,noChildrenChecked=true,someChildrenIndeterminate=false;childListItems.forEach(childLi=>{const childInput=childLi.querySelector(':scope > .category-tree__label-wrapper > .category-tree__input');if(childInput){if(childInput.checked&&!childInput.classList.contains('is-indeterminate'))noChildrenChecked=false;else if(childInput.classList.contains('is-indeterminate')){allChildrenChecked=false;noChildrenChecked=false;someChildrenIndeterminate=true;}else allChildrenChecked=false;}else allChildrenChecked=false;});parentCheckbox.classList.remove('is-indeterminate');if(someChildrenIndeterminate||(!allChildrenChecked&&!noChildrenChecked)){parentCheckbox.checked=false;parentCheckbox.classList.add('is-indeterminate');parentListItem.setAttribute('aria-checked','mixed');}else if(allChildrenChecked){parentCheckbox.checked=true;parentListItem.setAttribute('aria-checked','true');}else{parentCheckbox.checked=false;parentListItem.setAttribute('aria-checked','false');}this.updateParentCheckboxState(parentListItem.parentElement?.closest('.category-tree__item'));} // Recursivamente atualiza estado dos pais
    getSelectedCategoriesFromTree(){const ids=[];this.elements.categoryTreeList?.querySelectorAll('.category-tree__input').forEach(cb=>{if(cb.checked&&!cb.classList.contains('is-indeterminate'))ids.push(cb.value);});return ids;}
    getSelectedDifficulties(){const diffCheckboxes=this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])');const selectedSpecifics=[];diffCheckboxes?.forEach(cb=>{if(cb.checked)selectedSpecifics.push(cb.value);});const allCheckbox=this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');return(allCheckbox?.checked||selectedSpecifics.length===0)?['all']:selectedSpecifics;} // Se "Todas" ou nenhuma específica, retorna ['all']
    setCategoryTreeState(selectedIds=[]){const allCheckboxes=Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__input')||[]);allCheckboxes.forEach(cb=>{cb.checked=selectedIds.includes(cb.value);cb.classList.remove('is-indeterminate');const listItem=cb.closest('.category-tree__item');if(listItem)listItem.setAttribute('aria-checked',String(cb.checked));});const parentListItems=Array.from(this.elements.categoryTreeList?.querySelectorAll('.category-tree__item--has-children')||[]);for(let i=parentListItems.length-1;i>=0;i--)this.updateParentCheckboxState(parentListItems[i]);} // Define estado inicial da árvore (usado ao abrir painel)
    setDifficultyState(difficulties=['all']){const allCheckbox=this.elements.filterGroupDifficulty?.querySelector('input[value="all"]');const specificCheckboxes=Array.from(this.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]:not([value="all"])')||[]);if(difficulties.includes('all')){if(allCheckbox)allCheckbox.checked=true;specificCheckboxes.forEach(cb=>cb.checked=false);}else{if(allCheckbox)allCheckbox.checked=false;specificCheckboxes.forEach(cb=>{cb.checked=difficulties.includes(cb.value);});}} // Define estado dos checkboxes de dificuldade

    // --- Resultados do Quiz ---
    showResults(userData, totalQuestions) {
        const { resultadoCard, resultadoTitulo, resultadoPontos, resultadoAcertos, resultadoErros, resultadoTempo, resultadoMensagemMotivacional, scorePanel, challengeHubContainer } = this.elements;
        if (!resultadoCard || !userData) return;
        this.hideQuizElements(); // Esconde elementos do quiz ativo
        this.hideElement(scorePanel); // Esconder score panel ao mostrar resultados
        this.hideElement(challengeHubContainer); // Esconder hub ao mostrar resultados
        this.hideElement(this.elements.placeholderFiltrosContainer); // Garantir que placeholder está oculto
        if(resultadoTitulo) resultadoTitulo.textContent = "Desempenho Final!";
        if(resultadoPontos) resultadoPontos.textContent = userData.pontos;
        if(resultadoAcertos) resultadoAcertos.textContent = userData.acertos;
        if(resultadoErros) resultadoErros.textContent = userData.erros;
        if(resultadoTempo) resultadoTempo.textContent = this._formatDisplayTime(this.timerSeconds); // Usa o tempo acumulado
        if(resultadoMensagemMotivacional) { // Define mensagem motivacional baseada na performance
            const p = userData.pontos, t = totalQuestions; let m = "Continue praticando!";
            if (t > 0) { const max = t * 15; if (p >= max * 0.8) m = "Excelente desempenho!"; else if (p >= max * 0.5) m = "Muito bom!"; }
            else if (p === 0 && userData.acertos === 0 && userData.erros === 0) m = "Nenhuma questão encontrada/respondida."; // Caso sem questões
            resultadoMensagemMotivacional.textContent = m;
        }
        this.showElement(resultadoCard); // Mostra o card de resultados
        resultadoTitulo?.focus(); // Foco para acessibilidade
    }
    hideResults() { this.hideElement(this.elements.resultadoCard); }
    // --- Modal de Confirmação ---
    toggleConfirmModal(show) {const o=this.elements.confirmEncerrarOverlay;if(!o)return;const m='modal--visible';if(show){this.focusedElementBeforePanel=document.activeElement;this.showElement(o);o.scrollTop;requestAnimationFrame(()=>{o.classList.add(m);this.elements.cancelEncerrarBtn?.focus();});}else{o.classList.remove(m);const end=()=>{if(!o.classList.contains(m))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforePanel?.focus();};o.addEventListener('transitionend',end,{once:true});setTimeout(()=>{if(!o.classList.contains(m))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforePanel?.focus();},this.TRANSITION_DURATION+50);}}
    // --- Scroll e Foco ---
    scrollToQuestionStart(){const t=this.elements.questionTitle;if(this.currentSection==="question-section"&&t)t.scrollIntoView({behavior:"smooth",block:"nearest"});}
    focusNextButton(preventScroll=false){this.elements.nextBtn?.focus({preventScroll:preventScroll});} // Foca no botão Próxima
    smoothScrollToNextButton(){const t=this.elements.navigationButtons;t&&t.scrollIntoView({behavior:"smooth",block:"nearest"});} // Rola suavemente para os botões de navegação
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

    applyFiltersAndStartQuiz() { // Chamado ao aplicar filtros no painel
        const selCatIds = this.ui.getSelectedCategoriesFromTree();
        const selDiffs = this.ui.getSelectedDifficulties();
        this.state.setQuickQuizMode(false); // Garante que não está em modo rápido
        this.state.setFilters(selCatIds, selDiffs);
        this.ui.toggleFilterPanel(false); // Fecha o painel
        this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer); // Esconde placeholder
        this.startQuiz();
    }
    clearAllFiltersInPanel() { // Limpa seleções no painel de filtros
        this.ui.setCategoryTreeState([]);
        this.ui.setDifficultyState(['all']);
    }
    startQuiz() { // Inicia um novo quiz (rápido ou filtrado)
        this.user.reset(); // Reseta dados do usuário (pontos, acertos, erros)
        this.state.filterQuestions(this.quizData.getCategorias(), this.quizData.getRelacaoPerguntaCategorias()); // Filtra questões
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros); // Atualiza placar
        this.ui.hideResults(); // Esconde resultados anteriores
        this.ui.resetTimer();  // Reseta e para o timer
        this.ui.toggleExplanationModal(false); // Fecha modal de explicação

        const fQs = this.state.filteredQuestions;
        if (fQs.length > 0) { // Se houver questões após filtrar
            this.ui.hideElement(this.ui.elements.challengeHubContainer); // Esconde o Hub
            this.ui.showElement(this.ui.elements.scorePanel);      // Mostra o Score Panel
            this.ui.displayQuizContent(true);                       // Mostra elementos do quiz
            this._displayCurrentQuestion(false); // Mostra a primeira questão (sem scroll se for a primeira vez)
            this.ui.startTimer(); // Inicia o timer
        } else { // Se não houver questões
            this.ui.displayQuizContent(false); // Esconde quiz, mostra hub
            this.ui.showWarning(this.state.isQuickQuizMode ? "Nenhuma pergunta para Quiz Rápido." : "Nenhuma questão encontrada para os filtros.");
            this.ui.stopTimer();
        }
    }
    startQuickQuiz() { // Inicia um quiz rápido
        this.state.setQuickQuizMode(true);
        this.state.setFilters([], ['all']); // Sem filtros de categoria, todas as dificuldades
        this.ui.toggleFilterPanel(false); // Garante que painel de filtros está fechado
        this.startQuiz();
    }
    answerQuestion(selectedOpId) { // Processa a resposta do usuário
        const currQ = this.state.getCurrentQuestion(); if (!currQ) return; // Sai se não houver questão atual
        const opts = this.quizData.getOpcoesPorPerguntaId(currQ.id_pergunta);
        const selOpt = opts.find(op => op.id_opcao_resposta === selectedOpId);
        if (selOpt && this.state.recordAnswer(selectedOpId)) { // Se a opção é válida e a resposta foi registrada com sucesso
            currQ.foiCorretaNaSessao = selOpt.eh_correta; // Marca se foi correta ou não no estado da questão
            if (selOpt.eh_correta) this.user.incrementarAcertos(); else this.user.incrementarErros();
            this.ui.disableAnswers(); // Desabilita botões de resposta
            this.ui.applyAnswerFeedback(selectedOpId, opts); // Mostra feedback visual
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros); // Atualiza placar
            this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx)); // Atualiza grid de navegação
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions()); // Atualiza botões Anterior/Próxima
            this.ui.focusNextButton(true); // Foca no botão "Próxima"
            this.ui.smoothScrollToNextButton(); // Rola para os botões de navegação
        }
    }

    nextQuestion() {
        const isLast = this.state.isLastQuestion();
        const currentQ = this.state.getCurrentQuestion();

        // Se a questão atual existe e não foi respondida (nem marcada como pulada antes), marca como pulada.
        if (currentQ && !currentQ.hasOwnProperty('respostaDadaId') && !currentQ.foiPulada) {
            currentQ.foiPulada = true;
            // Atualiza o grid para refletir que a questão foi pulada.
            this.ui.renderQuestionGrid(this.state.filteredQuestions, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
        }

        // Tenta avançar para a próxima questão no estado.
        if (this.state.goToNextQuestion()) {
            // Se conseguiu avançar e o quiz terminou (chegou ao fim do array de questões filtradas).
            if (this.state.isQuizComplete()) {
                this.endQuiz();
            } else {
                // Se conseguiu avançar e ainda há questões, exibe a próxima.
                this._displayCurrentQuestion();
            }
        } else if (isLast) {
            // Se não conseguiu avançar (goToNextQuestion retornou false) E já estava na última questão,
            // significa que o usuário clicou "Próxima" (que deveria ser "Ver Resultado") na última questão.
            this.endQuiz();
        }
        // Se não for a última e goToNextQuestion falhar (o que não deveria acontecer se não for a última), nada acontece aqui.
        // O estado do botão "Próxima" (para "Ver Resultado") é gerenciado por updateNavigationButtons.
    }

    previousQuestion() { if (this.state.goToPreviousQuestion()) this._displayCurrentQuestion(); }
    goToQuestion(idx) { // Navega para uma questão específica via grid
        // Se o índice for além do total de questões, encerra o quiz (segurança)
        if (idx >= this.state.getTotalFilteredQuestions()) {
            this.endQuiz();
        } else if (this.state.goToQuestion(idx)) { // Se a navegação para o índice for válida
            this._displayCurrentQuestion();
        }
    }

    async _displayCurrentQuestion(shouldScroll = true) { // Lógica interna para mostrar a questão atual
        const el = this.ui.elements.questionWrap, init = this.state.isInitialQuestionLoad;
        const logic = () => {
            const p = this.state.getCurrentQuestion();
            if(p){ // Se a questão existe
                const opts = this.quizData.getOpcoesPorPerguntaId(p.id_pergunta);
                this.ui.displayQuestion(p,this.state.getCurrentQuestionNumberForDisplay(),this.state.getTotalFilteredQuestions(),this.quizData.getCategorias(),this.quizData.getRelacaoPerguntaCategorias(),this.state.isQuickQuizMode);
                this.ui.generateAnswerButtons(p.id_pergunta, opts, p.respostaDadaId, (opId)=>this.answerQuestion(opId)); // `p.respostaDadaId` permite re-renderizar com estado salvo
                this.ui.updateNavigationButtons(this.state.isFirstQuestion(),this.state.isLastQuestion(),this.state.getTotalFilteredQuestions());
                this.ui.renderQuestionGrid(this.state.filteredQuestions,this.state.currentQuestionIndex,(idx)=>this.goToQuestion(idx));
                if(shouldScroll) this.ui.scrollToQuestionStart(); // Scroll suave para o topo da questão
                // Se a questão já foi respondida (ex: navegando para trás/frente), aplica feedback e mostra botão de análise se aplicável
                if (p.hasOwnProperty('respostaDadaId') && p.respostaDadaId !== null) {
                    this.ui.applyAnswerFeedback(p.respostaDadaId, opts);
                }

            } else { /* Se a questão não existe (ex: fim do quiz), encerra */ this.endQuiz(); }
        };
        // Lógica de transição visual (fade out/in) para a questão
        if(!init && el){ // Se não for o carregamento inicial da primeira questão e o elemento existir
            el.classList.add("is-fading-out");
            // Espera a transição de fade-out terminar
            await new Promise(resolve => { let ended = false; const handler = () => { if (!ended) { el.removeEventListener("transitionend", handler); ended = true; resolve(); } }; el.addEventListener("transitionend", handler); setTimeout(() => { if (!ended) { el.removeEventListener("transitionend", handler); ended = true; resolve(); } }, this.ui.TRANSITION_DURATION + 50); });
            el.classList.remove("is-fading-out"); el.classList.add("is-transparent"); // Torna transparente antes de mudar conteúdo
            requestAnimationFrame(() => { logic(); requestAnimationFrame(() => el.classList.remove("is-transparent")); }); // Muda conteúdo e faz fade-in
        } else { // Carregamento inicial ou sem elemento de transição
            logic(); if (el) el.classList.remove("is-fading-out", "is-transparent");
            if (this.state.getTotalFilteredQuestions() > 0) this.state.markNavigated(); // Marca que não é mais o carregamento inicial
        }
    }
    endQuiz() { // Finaliza o quiz e mostra resultados
        this.ui.stopTimer();
        this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
        this.ui.toggleExplanationModal(false); // Garante que modal de explicação está fechado
    }
    restartQuiz() { // Reinicia o quiz para um novo desafio
        this.user.reset(); this.state.fullReset(); // Reseta dados do usuário e estado do quiz
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults(); this.ui.resetTimer(); this.ui.toggleExplanationModal(false);
        this.ui.displayQuizContent(false); // Esconde conteúdo do quiz, mostra hub/placeholder
        this.ui.clearWarning(); this.clearAllFiltersInPanel(); // Limpa filtros no painel
        if (this.challengeHubManager) this.challengeHubManager.showHub(); // Mostra o hub de desafios
        this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer); // Garante que placeholder de filtros está oculto
    }
    forceEndQuiz() { this.ui.stopTimer(); this.endQuiz(); this.ui.toggleConfirmModal(false); this.ui.toggleExplanationModal(false); }
}

// --- Módulo Principal: App (Orquestrador) ---
class App {
    constructor() {
        // Instanciação dos módulos principais
        this.userData = new UserData();
        this.quizData = new QuizData();
        this.quizState = new QuizState();
        this.layoutManager = new LayoutManager(); // Gerencia layout global (ex: footer)
        this.quizUI = new QuizUI(this.layoutManager.handleSectionChange.bind(this.layoutManager)); // UI do quiz, passa callback de mudança de seção
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData, this.quizData); // Lógica do quiz
        this.challengeHubManager = new ChallengeHubManager(this.quizUI.elements, this.quizLogic); // Gerenciador do Hub

        // Injeção de dependências onde necessário
        this.quizUI.quizState = this.quizState; // QuizUI precisa de acesso ao estado para renderizações
        this.quizUI.quizData = this.quizData;   // QuizUI precisa de acesso aos dados para o modal de explicação
        this.quizLogic.setChallengeHubManager(this.challengeHubManager); // QuizLogic pode precisar interagir com o hub
        this.challengeHubManager.setQuizUI(this.quizUI); // HubManager precisa de quizUI para interações de UI (ex: abrir painel)
    }

    async initialize() { // Método principal de inicialização
        try {
            const loaded = await this.quizData.loadAllData(); // Carrega todos os dados JSON
            if (loaded && this.quizData.getPerguntas().length > 0) { // Se carregou e há perguntas
                this.quizState.initialize(this.quizData.getPerguntas()); // Inicializa estado com as perguntas
                this.challengeHubManager.updateTotalQuestionsCount(this.quizData.getTotalPerguntas()); // Atualiza contagem no hub
                this.challengeHubManager.updateQuickQuizCount(this.quizState.QUICK_QUIZ_COUNT); // Atualiza contagem do quiz rápido no hub
                const categoriasParaArvore = this.quizData.getCategoriasHierarquicamente();
                this.quizUI.generateCategoryTree(categoriasParaArvore); // Gera árvore de categorias no painel de filtros
                this.setupEventListeners(); // Configura todos os ouvintes de eventos
                // Define a seção inicial com base no link ativo na navegação ou 'home-section' como padrão
                const initialActiveLink = document.querySelector('.main-nav__link--active, .bottom-nav__link--active');
                const initialSection = initialActiveLink?.dataset.section || 'home-section';
                this.quizUI.showSection(initialSection); // Mostra a seção inicial
            } else { this.handleLoadError("Dados carregados, mas nenhuma pergunta encontrada. Verifique os arquivos JSON."); }
        } catch (error) { this.handleLoadError(`Erro fatal ao carregar o quiz: ${error.message}. Verifique o console.`); }
    }

    handleLoadError(message) { // Lida com erros críticos de carregamento
        try {
            this.quizUI.showSection('question-section'); // Tenta mostrar a seção de questões para exibir o aviso
            this.quizUI.showWarning(message);
            this.disableCoreFunctionality(); // Desabilita botões de iniciar quiz
        } catch (uiError) { alert(message + "\nErro adicional na UI: " + uiError.message); } // Fallback
    }

    disableCoreFunctionality() { // Desabilita funcionalidades chave se o carregamento falhar
        this.quizUI.hideElement(this.quizUI.elements.hubCustomizeQuizBtn);
        this.quizUI.hideElement(this.quizUI.elements.hubQuickQuizBtn);
        this.quizUI.hideElement(this.quizUI.elements.startRandomQuiz); // Botão da home
        this.quizUI.hideElement(this.quizUI.elements.startCategoryQuiz); // Botão da home
        if (this.quizUI.elements.challengeHubContainer) { // Atualiza texto do hub para refletir o erro
             const title = this.quizUI.elements.challengeHubContainer.querySelector('.challenge-hub__title');
             if (title) title.textContent = "Erro ao Carregar";
             const subtitle = this.quizUI.elements.challengeHubContainer.querySelector('.challenge-hub__subtitle');
             if (subtitle) subtitle.textContent = "Não foi possível carregar as questões. Tente recarregar a página.";
             this.quizUI.showElement(this.quizUI.elements.challengeHubContainer); // Mostra o hub com a msg de erro
        }
    }

    setupEventListeners() { // Configura todos os event listeners da aplicação
        // Navegação principal (links de menu)
        this.quizUI.elements.navElements?.forEach(navEl => {
            navEl.addEventListener('click', (e) => {
                if (navEl.tagName === 'A') e.preventDefault(); // Previne comportamento padrão de links <a>
                const targetSection = navEl.dataset.section;
                if (targetSection && targetSection !== this.quizUI.currentSection) { // Se clicou numa seção diferente da atual
                    this.quizUI.showSection(targetSection);
                    if (targetSection === 'question-section') {
                        this.quizState.setQuickQuizMode(false); // Ao ir para seção de questões, assume modo não-rápido inicialmente
                        // A lógica de mostrar o hub/placeholder está agora em showSection e no onEnter da seção
                    }
                } else if (targetSection === 'question-section' && navEl.id === 'start-category-quiz') {
                     // Caso especial: Clicou no botão "Por Categoria" da Home, que também é um link de navegação.
                     // Se já está na seção de questões e o quiz não está ativo, abre os filtros.
                    if (this.quizUI.elements.quizSectionContent?.classList.contains(this.quizUI.hiddenClassName)) {
                        this.quizState.setQuickQuizMode(false);
                        this.quizUI.hideElement(this.quizUI.elements.challengeHubContainer);
                        this.quizUI.showElement(this.quizUI.elements.placeholderFiltrosContainer);
                        this.quizUI.toggleFilterPanel(true);
                    }
                }
            });
        });

        // Challenge Hub (eventos internos já configurados pelo ChallengeHubManager)
        this.challengeHubManager.setupEventListeners();

        // Botões da Home que iniciam quiz/navegam para seção de questões
        this.quizUI.elements.startRandomQuiz?.addEventListener('click', () => { // Botão Quiz Rápido da Home
            this.quizUI.showSection('question-section');
            this.quizLogic.startQuickQuiz();
        });
        this.quizUI.elements.startCategoryQuiz?.addEventListener('click', () => { // Botão Por Categoria da Home
            this.quizUI.showSection('question-section');
            // Prepara UI para seleção de filtros
            this.quizUI.hideElement(this.quizUI.elements.challengeHubContainer);
            this.quizUI.showElement(this.quizUI.elements.placeholderFiltrosContainer);
            this.quizUI.toggleFilterPanel(true);
        });


        // Painel de Filtros
        this.quizUI.elements.btnFecharFiltros?.addEventListener('click', () => this.quizUI.toggleFilterPanel(false));
        this.quizUI.elements.filterPanelOverlay?.addEventListener('click', (e) => { if (e.target === this.quizUI.elements.filterPanelOverlay) this.quizUI.toggleFilterPanel(false); }); // Fecha clicando fora
        this.quizUI.elements.btnAplicarFiltrosPainel?.addEventListener('click', () => this.quizLogic.applyFiltersAndStartQuiz());
        this.quizUI.elements.btnLimparFiltrosPainel?.addEventListener('click', () => this.quizLogic.clearAllFiltersInPanel());
        this.quizUI.elements.btnCatSelectAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState(this.quizData.getCategorias().map(c=>c.id_categoria.toString())); });
        this.quizUI.elements.btnCatClearAll?.addEventListener('click', () => { this.quizUI.setCategoryTreeState([]); });

        // Navegação do Quiz (Anterior/Próxima)
        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());

        // Ações de Resultado do Quiz
        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());
        this.quizUI.elements.btnExplorarMais?.addEventListener('click', () => this.handleExplorarMais()); // Volta para Home

        // Modal de Confirmação de Encerramento
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => { this.quizLogic.forceEndQuiz(); });
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => { this.quizUI.toggleConfirmModal(false); });
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (e)=>{if(e.target===this.quizUI.elements.confirmEncerrarOverlay)this.quizUI.toggleConfirmModal(false);}); // Fecha clicando fora

        // Tecla ESC para fechar modais/painéis
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.quizUI.elements.filterPanel?.classList.contains('filter-panel--visible')) this.quizUI.toggleFilterPanel(false);
                if (this.quizUI.elements.explanationModalOverlay?.classList.contains('modal--visible')) this.quizUI.toggleExplanationModal(false);
                if (this.quizUI.elements.confirmEncerrarOverlay?.classList.contains('modal--visible')) this.quizUI.toggleConfirmModal(false);
            }
        });

        // Checkboxes de Dificuldade no Painel de Filtros
        const diffInputs = this.quizUI.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]');
        const allDiffCb = this.quizUI.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        diffInputs?.forEach(input => {
            input.addEventListener('change', () => {
                if (input.value === 'all' && input.checked) { // Se "Todas" for marcado, desmarca os outros
                    diffInputs.forEach(other => { if (other.value !== 'all') other.checked = false; });
                } else if (input.value !== 'all' && input.checked) { // Se um específico for marcado, desmarca "Todas"
                    if (allDiffCb) allDiffCb.checked = false;
                }
                // Se nenhum específico estiver marcado após uma desmarcação, marca "Todas" automaticamente
                const anySpecificChecked = Array.from(diffInputs).some(cb => cb.value !== 'all' && cb.checked);
                if (!anySpecificChecked && allDiffCb && !allDiffCb.checked) allDiffCb.checked = true;
            });
        });

        // Modal de Explicação da Resposta
        this.quizUI.elements.btnToggleExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(true));
        this.quizUI.elements.btnCloseExplanationModal?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.btnGotItExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.explanationModalOverlay?.addEventListener('click', (e)=>{if(e.target===this.quizUI.elements.explanationModalOverlay)this.quizUI.toggleExplanationModal(false);}); // Fecha clicando fora
    }

    handleExplorarMais() { // Ação do botão "Explorar Mais" na tela de resultados
        this.quizUI.showSection('home-section');
    }
}

// --- Inicialização da Aplicação ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});