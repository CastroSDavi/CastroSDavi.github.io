// assets/js/script.js

var DJANGO_URLS = {
    api_get_quiz_data: '/api/quiz/alldata/', // URL para buscar dados (perguntas, categorias, opções)
    start_quiz_session: '/api/quiz/start-session/',
    register_answer: '/api/quiz/register-answer/',
    end_quiz_session: '/api/quiz/end-session/'
};

class UserData {
    constructor() { this.reset(); }
    get acertos() { return this._acertos; }
    get erros() { return this._erros; }
    get pontos() { return this._pontos; }
    incrementarAcertos() { this._acertos++; this._atualizarPontos(); }
    incrementarErros() { this._erros++; this._atualizarPontos(); }
    _atualizarPontos() { this._pontos = Math.max(0, (15 * this._acertos) - (5 * this._erros)); }
    reset() { this._acertos = 0; this._erros = 0; this._pontos = 0; }
    updateFromServer(acertos, erros, pontos) {
        this._acertos = acertos;
        this._erros = erros;
        this._pontos = pontos;
    }
}

class QuizData {
    constructor() {
        this.allFetchedQuestions = [];
        this.allFetchedOptions = [];
        this.allCategories = []; // Sempre armazena todas as categorias para o painel de filtro
        this.dadosCarregadosCompletamente = false;
        this.totalQuestionsCountForHub = 0; // Para o display no hub
    }

    setQuizData(perguntasData, categoriasData, opcoesData, isInitialLoad = false) {
        this.allFetchedQuestions = Array.isArray(perguntasData) ? perguntasData : [];
        this.allFetchedOptions = Array.isArray(opcoesData) ? opcoesData : [];
        
        // As categorias são carregadas uma vez e mantidas
        if (isInitialLoad || this.allCategories.length === 0) {
            this.allCategories = Array.isArray(categoriasData) ? categoriasData : [];
        }
        if (isInitialLoad && this.allCategories.length > 0 && this.allFetchedQuestions.length > 0) {
            this.totalQuestionsCountForHub = this.allFetchedQuestions.length; // Assume que a carga inicial sem filtros dá o total
        }

        this.dadosCarregadosCompletamente = this.allFetchedQuestions.length > 0 && this.allCategories.length > 0;
        return this.dadosCarregadosCompletamente;
    }

    async fetchQuizData(filterParams = {}, isInitialLoad = false) {
        const url = new URL(DJANGO_URLS.api_get_quiz_data, window.location.origin);
        if (filterParams.category_ids && filterParams.category_ids.length > 0) {
            url.searchParams.append('category_ids', filterParams.category_ids.join(','));
        }
        if (filterParams.difficulty_levels && filterParams.difficulty_levels.length > 0 && !filterParams.difficulty_levels.includes('all')) {
            url.searchParams.append('difficulty_levels', filterParams.difficulty_levels.join(','));
        }
        if (filterParams.mode) {
            url.searchParams.append('mode', filterParams.mode);
        }
        if (filterParams.count) {
            url.searchParams.append('count', filterParams.count);
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Falha ao carregar dados da API: ${response.statusText} (status ${response.status})`);
            }
            const data = await response.json();
            if (data && data.perguntas && data.categorias && data.opcoesResposta) {
                return this.setQuizData(data.perguntas, data.categorias, data.opcoesResposta, isInitialLoad);
            } else {
                throw new Error("Formato de dados inválido recebido da API.");
            }
        } catch (error) {
            console.error("QUIZDATA: Erro CRÍTICO ao carregar dados da API Django:", error);
            this.allFetchedQuestions = []; this.allFetchedOptions = []; // Não reseta categorias
            this.dadosCarregadosCompletamente = false;
            throw error;
        }
    }

    getPerguntas() { return [...this.allFetchedQuestions]; }
    getTotalPerguntasDisponiveis() { return this.allFetchedQuestions.length; } // Total de perguntas após o fetch atual
    getTotalPerguntasParaHub() { return this.totalQuestionsCountForHub; }

    getCategorias() { return [...this.allCategories]; }
    getCategoriasHierarquicamente() {
        if (!this.allCategories || this.allCategories.length === 0) return [];
        const categoriasMap = new Map(this.allCategories.map(cat => [cat.id_categoria, { ...cat, subcategorias: [] }]));
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
    getOpcoesPorPerguntaId(idPergunta) { return this.allFetchedOptions.filter(op => op.id_pergunta === idPergunta).sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0)); }
    getRelacaoPerguntaCategorias() { // Necessário para exibir o título da categoria na UI da pergunta
        const relacao = [];
        this.allFetchedQuestions.forEach(p => {
            if (p.categoria_ids && Array.isArray(p.categoria_ids)) {
                p.categoria_ids.forEach(catId => {
                    if (this.allCategories.some(cat => cat.id_categoria === catId)) {
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
        this.currentQuestionsSet = []; // Perguntas atualmente carregadas para o quiz
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
        this.isQuickQuizMode = false;
        this.QUICK_QUIZ_COUNT = 10;
        this.currentSelectedCategoriesForSession = []; // Apenas para referência ao iniciar sessão
        this.currentSelectedDifficultiesForSession = ['all']; // Apenas para referência
    }

    initializeWithQuestions(questions) {
        this.currentQuestionsSet = questions.map(q => ({ ...q, respostaDadaId: undefined, foiCorretaNaSessao: undefined, foiPulada: undefined }));
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
    }
    
    resetQuizState() {
        this.currentQuestionsSet = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true;
    }
    fullReset() {
        this.resetQuizState();
        this.isQuickQuizMode = false;
        this.currentSelectedCategoriesForSession = [];
        this.currentSelectedDifficultiesForSession = ['all'];
    }
    setQuizModeAndFilters(isQuick, categories = [], difficulties = ['all']) {
        this.isQuickQuizMode = isQuick;
        this.currentSelectedCategoriesForSession = categories;
        this.currentSelectedDifficultiesForSession = difficulties;
    }
    getCurrentQuestion() { return this.currentQuestionsSet[this.currentQuestionIndex] ?? null; }
    getCurrentQuestionNumberForDisplay() { return this.currentQuestionIndex + 1; }
    getTotalFilteredQuestions() { return this.currentQuestionsSet.length; }
    isQuizComplete() { return this.currentQuestionIndex >= this.currentQuestionsSet.length; }
    isFirstQuestion() { return this.currentQuestionIndex === 0; }
    isLastQuestion() { return this.currentQuestionIndex === this.currentQuestionsSet.length - 1; }
    recordAnswer(opcaoId) { const q = this.getCurrentQuestion(); if (q && !q.hasOwnProperty('respostaDadaId')) { q.respostaDadaId = opcaoId; q.foiPulada = false; return true; } return false; }
    markNavigated() { this.isInitialQuestionLoad = false; }
    goToQuestion(index) { if (index >= 0 && index < this.currentQuestionsSet.length) { this.currentQuestionIndex = index; this.markNavigated(); return true; } return false; }
    goToNextQuestion() { if (this.currentQuestionIndex < this.currentQuestionsSet.length) { this.currentQuestionIndex++; this.markNavigated(); return true; } return false; }
    goToPreviousQuestion() { if (this.currentQuestionIndex > 0) { this.currentQuestionIndex--; this.markNavigated(); return true; } return false; }
}

class LayoutManager {
    constructor() { this.footerElement = document.getElementById('footer') || document.querySelector('.site-footer'); this.hiddenClassName = 'u-is-hidden'; }
    handleSectionChange(sectionId) { if (!this.footerElement) return; }
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
        this.hiddenClassName = 'u-is-hidden'; this.currentSection = null;
        this.QUESTOES_POR_PAGINA_GRID = 5; this.TRANSITION_DURATION = 300;
        this.onSectionChange = onSectionChangeCallback; this.timerInterval = null;
        this.timerSeconds = 0; this.timerRunning = false; this.focusedElementBeforePanel = null;
        this.focusedElementBeforeExplanationModal = null; this.cacheDOMelements();
    }
    cacheDOMelements() {
        this.elements = {
            homeSection: document.getElementById('home-section'), questionSection: document.getElementById('question-section'),
            accountSection: document.getElementById('account-section'), mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),
            scorePanel: document.querySelector('.score-panel'), challengeHubContainer: document.getElementById('challenge-hub-container'),
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'), hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'), hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'),
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'), avisoContainer: document.getElementById('aviso-container'),
            avisoMensagem: document.querySelector('#aviso-container .card--aviso p'), placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),
            quizSectionContent: document.getElementById('quiz-section'), questionWrap: document.querySelector('#quiz-section .card--question-wrap'),
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
    }
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
            // Carrega o estado atual dos filtros para o painel
            if (this.quizState) { 
                this.setCategoryTreeState(this.quizState.currentSelectedCategoriesForSession); 
                this.setDifficultyState(this.quizState.currentSelectedDifficultiesForSession);
            }
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
            this.hideElement(placeholderFiltrosContainer); this.hideElement(challengeHubContainer);
            if (document.getElementById('question-section')) { this.hideQuizElements(); }
        }
    }
    clearWarning() {
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        this.hideElement(avisoContainer); avisoMensagem?.removeAttribute("role");
        if (document.getElementById('question-section')) {
            if (quizSectionContent?.classList.contains(this.hiddenClassName) && resultadoCard?.classList.contains(this.hiddenClassName)) {
                this.hideElement(placeholderFiltrosContainer); this.showElement(challengeHubContainer);
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
    displayQuestion(perguntaObj, qNum, totalQ, todasCategoriasDoQuizData, relacaoPerguntaCategorias, isQuickQuizMode) {
        if (!perguntaObj) return;
        let tituloCat = "Questão";
        if (isQuickQuizMode) tituloCat = "Quiz Rápido";
        else {
            const idsCatPerg = relacaoPerguntaCategorias.filter(pc => pc.id_pergunta === perguntaObj.id_pergunta).map(pc => pc.id_categoria);
            if (idsCatPerg.length > 0) {
                let idCatMostrar = idsCatPerg[0];
                if (idsCatPerg.length > 1) { const catObjsPerg = todasCategoriasDoQuizData.filter(c => idsCatPerg.includes(c.id_categoria)); if (catObjsPerg.length > 0) idCatMostrar = catObjsPerg.reduce((deepest, curr) => this._getCategoriaProfundidade(curr, todasCategoriasDoQuizData) > this._getCategoriaProfundidade(deepest, todasCategoriasDoQuizData) ? curr : deepest, catObjsPerg[0]).id_categoria; }
                let caminho = []; let idAtual = idCatMostrar; let i = 0;
                while (idAtual != null && i < 5) { const catEnc = todasCategoriasDoQuizData.find(cat => cat.id_categoria === idAtual); if (catEnc) { caminho.unshift(catEnc.nome_categoria); idAtual = catEnc.id_categoria_pai; } else break; i++; }
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
    displayQuestionImage(url,qNum){const el=this.elements.perguntaImagem;if(el){if(url?.trim()){el.src=url;el.alt=`Ilustração para questão ${qNum}`;this.showElement(el);el.onerror=()=>{this.hideElement(el);el.onerror=null;}}else{this.hideElement(el);el.src="";el.alt="";}}}
    generateAnswerButtons(perguntaId,opcoes,respostaDadaId,callbackResposta){const cont=this.elements.respostasContainer;if(!cont)return;cont.innerHTML='';if(!opcoes||opcoes.length===0){return;}const temResp=typeof respostaDadaId!=='undefined'&&respostaDadaId!==null;const bCl='question-display__answer-option';opcoes.forEach(opt=>{const btn=document.createElement('button');btn.className=bCl;btn.textContent=opt.texto_opcao;btn.dataset.opcaoId=opt.id_opcao_resposta.toString();btn.disabled=temResp;btn.style.cursor=temResp?'default':'pointer';btn.tabIndex=temResp?-1:0;if(temResp){btn.classList.add(`${bCl}--answered`);if(opt.eh_correta)btn.classList.add(`${bCl}--correct`);else if(opt.id_opcao_resposta===respostaDadaId)btn.classList.add(`${bCl}--incorrect`);}else if(callbackResposta)btn.onclick=()=>callbackResposta(opt.id_opcao_resposta);cont.appendChild(btn);});}
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
    toggleExplanationModal(show){const o=this.elements.explanationModalOverlay,d=this.elements.explanationModalDialog;if(!o||!d||!this.quizState||!this.quizData)return;const mVis='modal--visible';if(show){const q=this.quizState.getCurrentQuestion();if(!q)return;const opts=this.quizData.getOpcoesPorPerguntaId(q.id_pergunta);let hasCont=false;const genBlk=this.elements.explanationModalGeneralBlock,genTxt=this.elements.explanationModalGeneralText;if(q.explicacao_resposta?.trim()){genTxt.innerHTML=q.explicacao_resposta.replace(/\n/g,'<br>');this.showElement(genBlk);hasCont=true;}else this.hideElement(genBlk);const optsBlk=this.elements.explanationModalOptionsBlock,optsList=this.elements.explanationModalOptionsList;optsList.innerHTML='';let hasSpecOptFeed=false;opts.forEach(opt=>{if(opt.feedback_opcao?.trim()){hasSpecOptFeed=true;const li=document.createElement('li');li.classList.add(opt.eh_correta?'is-correct-feedback':'is-incorrect-feedback');const origSpan=document.createElement('span');origSpan.className='option-original-text';origSpan.textContent=`Alternativa: "${opt.texto_opcao}"`;li.appendChild(origSpan);const feedSpan=document.createElement('span');feedSpan.className='option-feedback-value';feedSpan.classList.add(opt.eh_correta?'correct':'incorrect');feedSpan.innerHTML=opt.feedback_opcao.replace(/\n/g,'<br>');li.appendChild(feedSpan);optsList.appendChild(li);}});if(hasSpecOptFeed){this.showElement(optsBlk);hasCont=true;}else this.hideElement(optsBlk);const div=this.elements.explanationModalDivider;if(genBlk&&!genBlk.classList.contains(this.hiddenClassName)&&optsBlk&&!optsBlk.classList.contains(this.hiddenClassName)&&div)this.showElement(div);else if(div)this.hideElement(div);const empty=this.elements.explanationModalEmptyState;if(!hasCont&&empty)this.showElement(empty);else if(empty)this.hideElement(empty);this.focusedElementBeforeExplanationModal=document.activeElement;this.showElement(o);o.scrollTop;requestAnimationFrame(()=>{o.classList.add(mVis);d.focus();});}else{o.classList.remove(mVis);const end=()=>{if(!o.classList.contains(mVis))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforeExplanationModal?.focus();};o.addEventListener('transitionend',end,{once:true});setTimeout(()=>{if(!o.classList.contains(mVis))this.hideElement(o);o.removeEventListener('transitionend',end);this.focusedElementBeforeExplanationModal?.focus();},this.TRANSITION_DURATION+70);}}
    updateProgressBar(current,total){const p=this.elements.progressContainer,f=this.elements.progressBarFill,x=this.elements.progressText;if(p&&f&&x){if(total>0){f.style.width=`${Math.min(current,total)/total*100}%`;x.textContent=`${current} / ${total}`;this.showElement(p);this.showElement(x);}else this.hideProgressBar();}}
    hideProgressBar(){this.hideElement(this.elements.progressContainer);this.hideElement(this.elements.progressText);if(this.elements.progressBarFill)this.elements.progressBarFill.style.width="0%";if(this.elements.progressText)this.elements.progressText.textContent="";}
    updateNavigationButtons(isFirst,isLast,totalQuestions){const n=this.elements.navigationButtons,p=this.elements.prevBtn,nxt=this.elements.nextBtn;if(n&&p&&nxt){if(totalQuestions<=0)this.hideElement(n);else{this.showElement(n);p.disabled=isFirst;nxt.disabled=false;nxt.textContent=isLast?"Ver Resultado":" Avançar";}}}
    renderQuestionGrid(questions,currentIndex,callbackSelectQuestion){ const container=this.elements.questionGridContainer; if(!container)return; if(!questions?.length){this.hideElement(container);return;} this.showElement(container);container.innerHTML=''; const currentPage=Math.floor(currentIndex/this.QUESTOES_POR_PAGINA_GRID); const startIndex=currentPage*this.QUESTOES_POR_PAGINA_GRID; const endIndex=Math.min(startIndex+this.QUESTOES_POR_PAGINA_GRID,questions.length); const arrBase='question-grid__arrow',itBase='question-grid__item',itCurr=`${itBase}--current`,itCorr=`${itBase}--correct`,itIncorr=`${itBase}--incorrect`, itSkip = `${itBase}--skipped`; container.appendChild(this._createGridArrow('prev',startIndex===0,()=>callbackSelectQuestion(Math.max(0,startIndex-1)),'Página Anterior de Questões',[`${arrBase}--left`])); for(let i=startIndex;i<endIndex;i++){ const q=questions[i];const item=document.createElement('button');item.className=itBase;item.textContent=i+1;item.dataset.index=i.toString();item.setAttribute('aria-label',`Ir para Questão ${i+1}`);item.onclick=()=>callbackSelectQuestion(i); if(q.hasOwnProperty('respostaDadaId')&&q.respostaDadaId!==null){ if(q.foiCorretaNaSessao===true)item.classList.add(itCorr); else if(q.foiCorretaNaSessao===false)item.classList.add(itIncorr); } else if (q.foiPulada) item.classList.add(itSkip); if(i===currentIndex)item.classList.add(itCurr); container.appendChild(item); } container.appendChild(this._createGridArrow('next',endIndex>=questions.length,()=>callbackSelectQuestion(Math.min(questions.length-1,endIndex)),'Próxima Página de Questões',[`${arrBase}--right`])); }
    _createGridArrow(dir,dis,cb,aria,xtra=[]){const b=document.createElement('button');b.className='question-grid__arrow';b.classList.add(...xtra,'u-is-circle');b.setAttribute('aria-label',aria);b.disabled=dis;b.onclick=cb;const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 -960 960 960");s.setAttribute("fill","currentColor");const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",dir==='prev'?"M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z":"M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z");s.appendChild(p);b.appendChild(s);return b;}
    _updateSubmenuHeight(subMenuElement, isExpanding) { if (!subMenuElement) return; if (isExpanding) { subMenuElement.style.display = 'block'; void subMenuElement.offsetWidth; const scrollH = subMenuElement.scrollHeight; requestAnimationFrame(() => { subMenuElement.style.maxHeight = scrollH + "px"; }); } else { requestAnimationFrame(() => { subMenuElement.style.maxHeight = '0'; }); } }
    _updateParentSubmenuHeights(listItemElement) { let currentAncestor = listItemElement.parentElement?.closest('.category-tree__item--has-children'); let level = 0; while (currentAncestor) { level++; const parentSubmenu = currentAncestor.querySelector(':scope > .category-tree__submenu'); if (parentSubmenu && currentAncestor.getAttribute('aria-expanded') === 'true') { parentSubmenu.style.display = 'block'; void parentSubmenu.offsetWidth; const newParentScrollHeight = parentSubmenu.scrollHeight; parentSubmenu.style.maxHeight = newParentScrollHeight + "px"; } currentAncestor = currentAncestor.parentElement?.closest('.category-tree__item--has-children'); if (level > 5) break; } }
    generateCategoryTree(categoriesHierarchical) {
        const treeContainer = this.elements.categoryTreeList; if (!treeContainer) return; treeContainer.innerHTML = '';
        const createTreeNodes = (nodes, parentElement, level = 0) => {
            nodes.forEach(catNode => {
                const listItem = document.createElement('li'); listItem.className = 'category-tree__item'; listItem.setAttribute('role', 'treeitem'); listItem.setAttribute('aria-checked', 'false');
                const labelWrapper = document.createElement('div'); labelWrapper.className = 'category-tree__label-wrapper';
                const inputCheckbox = document.createElement('input'); inputCheckbox.type = 'checkbox'; inputCheckbox.id = `cat-tree-${catNode.id_categoria}`; inputCheckbox.className = 'category-tree__input u-sr-only'; inputCheckbox.value = catNode.id_categoria.toString(); inputCheckbox.tabIndex = -1; inputCheckbox.addEventListener('change', (e) => this.handleCategoryCheckboxChange(e.target));
                const label = document.createElement('label'); label.htmlFor = inputCheckbox.id; label.className = 'category-tree__label'; label.textContent = catNode.nome_categoria; label.tabIndex = 0; label.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { inputCheckbox.checked = !inputCheckbox.checked; inputCheckbox.dispatchEvent(new Event('change', { bubbles: true })); e.preventDefault(); } });
                if (catNode.subcategorias && catNode.subcategorias.length > 0) {
                    listItem.classList.add('category-tree__item--has-children'); listItem.setAttribute('aria-expanded', 'false');
                    const toggleButton = document.createElement('button'); toggleButton.type = 'button'; toggleButton.className = 'category-tree__toggle'; toggleButton.setAttribute('aria-label', `Expandir categoria ${catNode.nome_categoria}`); toggleButton.setAttribute('aria-expanded', 'false'); toggleButton.innerHTML = `<span class="material-symbols-outlined">chevron_right</span>`;
                    labelWrapper.appendChild(toggleButton); labelWrapper.appendChild(inputCheckbox); labelWrapper.appendChild(label);
                    const subMenu = document.createElement('ul'); subMenu.className = 'category-tree__submenu'; subMenu.setAttribute('role', 'group');
                    createTreeNodes(catNode.subcategorias, subMenu, level + 1); listItem.appendChild(labelWrapper); listItem.appendChild(subMenu);
                    const toggleAction = (event) => {
                        event.stopPropagation(); const isCurrentlyExpanded = listItem.getAttribute('aria-expanded') === 'true'; const newExpandedState = !isCurrentlyExpanded; listItem.setAttribute('aria-expanded', String(newExpandedState)); toggleButton.setAttribute('aria-expanded', String(newExpandedState)); toggleButton.setAttribute('aria-label', `${newExpandedState ? 'Recolher' : 'Expandir'} categoria ${catNode.nome_categoria}`); toggleButton.querySelector('.material-symbols-outlined').textContent = newExpandedState ? 'expand_more' : 'chevron_right'; this._updateSubmenuHeight(subMenu, newExpandedState);
                        if (newExpandedState) subMenu.classList.add('category-tree__submenu--expanded'); else { const transitionEndHandler = () => { if (listItem.getAttribute('aria-expanded') === 'false') subMenu.classList.remove('category-tree__submenu--expanded'); subMenu.removeEventListener('transitionend', transitionEndHandler); }; subMenu.addEventListener('transitionend', transitionEndHandler, { once: true }); setTimeout(() => { if (listItem.getAttribute('aria-expanded') === 'false') subMenu.classList.remove('category-tree__submenu--expanded'); subMenu.removeEventListener('transitionend', transitionEndHandler); }, this.TRANSITION_DURATION + 70); }
                        this._updateParentSubmenuHeights(listItem);
                    };
                    toggleButton.addEventListener('click', toggleAction); toggleButton.addEventListener('keydown', (event) => { if (event.key === ' ' || event.key === 'Enter') { toggleAction(event); event.preventDefault(); } });
                } else { labelWrapper.appendChild(inputCheckbox); labelWrapper.appendChild(label); listItem.appendChild(labelWrapper); }
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
            if (childInput) { if (childInput.checked && !childInput.classList.contains('is-indeterminate')) nenhumMarcado = false; else if (childInput.classList.contains('is-indeterminate')) { todosMarcados = false; nenhumMarcado = false; algumIndeterminado = true; } else todosMarcados = false; } else todosMarcados = false;
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
        this.state = quizState; this.ui = quizUI;
        this.user = userData; this.quizData = quizData;
        this.challengeHubManager = null; this.currentSessionId = null;
        this.isFetchingQuestions = false; // Flag para evitar múltiplas chamadas
    }

    setChallengeHubManager(manager) { this.challengeHubManager = manager; }

    async fetchAndSetQuestions(filterParams, isQuickQuiz = false) {
        if (this.isFetchingQuestions) return false;
        this.isFetchingQuestions = true;
        this.ui.showElement(this.ui.elements.placeholderFiltrosContainer); // Pode mostrar um loader aqui
        this.ui.hideElement(this.ui.elements.challengeHubContainer);
        this.ui.hideElement(this.ui.elements.quizSectionContent);
        this.ui.hideElement(this.ui.elements.avisoContainer);
        try {
            await this.quizData.fetchQuizData(filterParams);
            const questions = this.quizData.getPerguntas();
            this.state.initializeWithQuestions(questions);
            this.state.setQuizModeAndFilters(
                isQuickQuiz,
                filterParams.category_ids || [],
                filterParams.difficulty_levels || ['all']
            );
            return questions;
        } catch (error) {
            this.ui.showWarning(`Erro ao buscar perguntas: ${error.message}. Tente novamente.`);
            return null; // ou []
        } finally {
            this.isFetchingQuestions = false;
            this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer); // Esconde loader
        }
    }

    async applyFiltersAndStartQuiz() {
        const selCatIds = this.ui.getSelectedCategoriesFromTree();
        const selDiffs = this.ui.getSelectedDifficulties();
        this.ui.toggleFilterPanel(false);

        const questions = await this.fetchAndSetQuestions({ category_ids: selCatIds, difficulty_levels: selDiffs }, false);

        if (questions) {
            this.startQuiz(questions, selCatIds);
        } else {
            // fetchAndSetQuestions já deve ter mostrado um aviso se houve erro
            if (this.challengeHubManager) this.challengeHubManager.showHub(); // Volta pro hub
        }
    }

    clearAllFiltersInPanel() { this.ui.setCategoryTreeState([]); this.ui.setDifficultyState(['all']); }

    async startQuickQuiz() {
        const questions = await this.fetchAndSetQuestions({ mode: 'quick', count: this.state.QUICK_QUIZ_COUNT }, true);
        if (questions) {
            this.startQuiz(questions, []); // Sem categorias específicas para quiz rápido
        } else {
            if (this.challengeHubManager) this.challengeHubManager.showHub();
        }
    }

    async startQuiz(questionsForSession, selectedCategoryIdsForSessionStart = []) {
        this.user.reset();
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults(); this.ui.resetTimer(); this.ui.toggleExplanationModal(false);

        if (questionsForSession.length > 0) {
            const questionIdsInSession = questionsForSession.map(q => q.id_pergunta);
            try {
                const response = await fetch(DJANGO_URLS.start_quiz_session, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken'), },
                    body: JSON.stringify({
                        modo_quiz: this.state.isQuickQuizMode ? 'Rápido' : 'Por Categoria',
                        categoria_ids: this.state.isQuickQuizMode ? [] : selectedCategoryIdsForSessionStart,
                        question_ids_in_session: questionIdsInSession,
                        // total_perguntas_sessao: questionsForSession.length // O backend usa len(question_ids_in_session)
                    }),
                });
                const data = await response.json();
                if (response.ok && data.status === 'success' && data.session_id) {
                    this.currentSessionId = data.session_id;
                    this.ui.hideElement(this.ui.elements.challengeHubContainer);
                    this.ui.showElement(this.ui.elements.scorePanel);
                    this.ui.displayQuizContent(true);
                    this._displayCurrentQuestion(false); this.ui.startTimer();
                } else {
                    this.ui.showWarning(`Não foi possível iniciar a sessão de quiz: ${data.message || 'Erro do servidor'}.`);
                }
            } catch (error) {
                this.ui.showWarning("Erro de conexão ao iniciar o quiz. Verifique sua internet.");
            }
        } else {
            this.ui.displayQuizContent(false);
            this.ui.showWarning(this.state.isQuickQuizMode ? "Nenhuma pergunta disponível para um Quiz Rápido." : "Nenhuma questão encontrada com os filtros selecionados.");
            this.ui.stopTimer();
        }
    }

    async answerQuestion(selectedOpId) {
        const currQ = this.state.getCurrentQuestion();
        if (!currQ || !this.currentSessionId) return;

        const opts = this.quizData.getOpcoesPorPerguntaId(currQ.id_pergunta);
        const selOpt = opts.find(op => op.id_opcao_resposta === selectedOpId);

        if (selOpt && this.state.recordAnswer(selectedOpId)) {
            currQ.foiCorretaNaSessao = selOpt.eh_correta;
            // Não atualiza UserData diretamente aqui, espera o backend
            this.ui.disableAnswers(); this.ui.applyAnswerFeedback(selectedOpId, opts);
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            this.ui.updateNavigationButtons(this.state.isFirstQuestion(), this.state.isLastQuestion(), this.state.getTotalFilteredQuestions());
            this.ui.focusNextButton(true); this.ui.smoothScrollToNextButton();

            try {
                const response = await fetch(DJANGO_URLS.register_answer, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken'), },
                    body: JSON.stringify({ session_id: this.currentSessionId, pergunta_id: currQ.id_pergunta, opcao_id: selectedOpId }),
                });
                const data = await response.json();
                if (response.ok && data.status === 'success') {
                    this.user.updateFromServer(data.total_acertos_sessao, data.total_erros_sessao, data.pontuacao_sessao);
                    this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
                } else {
                    console.error("Backend: Falha ao registrar resposta:", data.message || response.statusText);
                }
            } catch (error) {
                console.error("Erro de rede ao registrar resposta:", error);
            }
        }
    }

    async nextQuestion() {
        const isLast = this.state.isLastQuestion();
        const currentQ = this.state.getCurrentQuestion();
        if (currentQ && !currentQ.hasOwnProperty('respostaDadaId') && !currentQ.foiPulada) {
            currentQ.foiPulada = true;
            this.ui.renderQuestionGrid(this.state.currentQuestionsSet, this.state.currentQuestionIndex, (idx) => this.goToQuestion(idx));
            if (this.currentSessionId) {
                try {
                    await fetch(DJANGO_URLS.register_answer, { // Pergunta pulada, opcao_id: null
                        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                        body: JSON.stringify({ session_id: this.currentSessionId, pergunta_id: currentQ.id_pergunta, opcao_id: null })
                    });
                } catch (err) { console.error("Erro ao registrar pulo no backend:", err); }
            }
        }
        if (this.state.goToNextQuestion()) {
            if (this.state.isQuizComplete()) this.endQuiz();
            else this._displayCurrentQuestion();
        } else if (isLast) { this.endQuiz(); }
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
                this.ui.renderQuestionGrid(this.state.currentQuestionsSet,this.state.currentQuestionIndex,(idx)=>this.goToQuestion(idx));
                if(shouldScroll) this.ui.scrollToQuestionStart();
                if (p.hasOwnProperty('respostaDadaId') && p.respostaDadaId !== null) this.ui.applyAnswerFeedback(p.respostaDadaId, opts);
            } else this.endQuiz(); // Se não houver pergunta (ex: lista vazia), encerra
        };
        if(!init && el){ el.classList.add("is-fading-out"); await new Promise(resolve => { let ended = false; const handler = () => { if (!ended) { el.removeEventListener("transitionend", handler); ended = true; resolve(); } }; el.addEventListener("transitionend", handler); setTimeout(() => { if (!ended) { el.removeEventListener("transitionend", handler); ended = true; resolve(); } }, this.ui.TRANSITION_DURATION + 50); }); el.classList.remove("is-fading-out"); el.classList.add("is-transparent"); requestAnimationFrame(() => { logic(); requestAnimationFrame(() => el.classList.remove("is-transparent")); }); }
        else { logic(); if (el) el.classList.remove("is-fading-out", "is-transparent"); if (this.state.getTotalFilteredQuestions() > 0) this.state.markNavigated(); }
    }

    async endQuiz() {
        this.ui.stopTimer(); this.ui.toggleExplanationModal(false);
        if (this.currentSessionId) {
            try {
                const response = await fetch(DJANGO_URLS.end_quiz_session, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken'), },
                    body: JSON.stringify({ session_id: this.currentSessionId, tempo_total_segundos: this.ui.timerSeconds }),
                });
                const data = await response.json();
                if (response.ok && (data.status === 'success' || data.status === 'info')) {
                     this.user.updateFromServer(data.total_acertos, data.total_erros, data.pontuacao_final);
                     this.ui.showResults(this.user, this.state.getTotalFilteredQuestions());
                } else { this.ui.showResults(this.user, this.state.getTotalFilteredQuestions()); }
            } catch (error) { this.ui.showResults(this.user, this.state.getTotalFilteredQuestions()); }
            this.currentSessionId = null;
        } else { this.ui.showResults(this.user, this.state.getTotalFilteredQuestions()); }
    }

    restartQuiz() {
        this.user.reset(); this.state.fullReset(); this.currentSessionId = null;
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults(); this.ui.resetTimer(); this.ui.toggleExplanationModal(false);
        this.ui.displayQuizContent(false); this.ui.clearWarning();
        this.clearAllFiltersInPanel();
        if (this.challengeHubManager) this.challengeHubManager.showHub();
        this.ui.hideElement(this.ui.elements.placeholderFiltrosContainer);
    }
    async forceEndQuiz() { this.ui.stopTimer(); await this.endQuiz(); this.ui.toggleConfirmModal(false); this.ui.toggleExplanationModal(false); }
}

class App {
    constructor() {
        this.userData = new UserData(); this.quizData = new QuizData();
        this.quizState = new QuizState(); this.layoutManager = new LayoutManager();
        this.quizUI = new QuizUI(this.layoutManager.handleSectionChange.bind(this.layoutManager));
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData, this.quizData);
        this.challengeHubManager = new ChallengeHubManager(this.quizUI.elements, this.quizLogic);
        this.quizUI.quizState = this.quizState; this.quizUI.quizData = this.quizData;
        this.quizLogic.setChallengeHubManager(this.challengeHubManager);
        this.challengeHubManager.setQuizUI(this.quizUI);

        const urlsElement = document.getElementById('django-urls');
        if (urlsElement) {
            try {
                const parsedUrls = JSON.parse(urlsElement.textContent);
                DJANGO_URLS.api_get_quiz_data = parsedUrls.api_get_all_quiz_data || DJANGO_URLS.api_get_quiz_data; // Mantendo compatibilidade com nome antigo no template
                DJANGO_URLS.start_quiz_session = parsedUrls.start_quiz_session || DJANGO_URLS.start_quiz_session;
                DJANGO_URLS.register_answer = parsedUrls.register_answer || DJANGO_URLS.register_answer;
                DJANGO_URLS.end_quiz_session = parsedUrls.end_quiz_session || DJANGO_URLS.end_quiz_session;
            } catch (e) { console.error("Erro ao parsear URLs do Django:", e); }
        }
    }

    async initialize() {
        try {
            // Carrega todas as categorias e a contagem total de perguntas (sem filtros) para o hub e painel de filtros.
            // Esta chamada também pode carregar um conjunto inicial de perguntas se desejado, ou ser apenas para setup.
            const dadosIniciaisCarregados = await this.quizData.fetchQuizData({}, true); // true para isInitialLoad

            if (dadosIniciaisCarregados) {
                this.challengeHubManager.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub());
                this.challengeHubManager.updateQuickQuizCount(this.quizState.QUICK_QUIZ_COUNT);
                if (this.quizData.getCategorias().length > 0) {
                    this.quizUI.generateCategoryTree(this.quizData.getCategoriasHierarquicamente());
                }
                this.setupEventListeners();

                // Atualiza a contagem de questões na home page, se o elemento existir
                const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count'); // Mesmo ID usado na home
                if (totalQuestionsSpanHome) {
                     totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub();
                }
                
                // Lógica de exibição de seção inicial
                if (document.getElementById('home-section')) { this.quizUI.currentSection = 'home-section'; this.quizUI.hideElement(this.quizUI.elements.questionSection); this.quizUI.hideElement(this.quizUI.elements.accountSection); }
                else if (document.getElementById('question-section')) { this.quizUI.currentSection = 'question-section-page'; if (this.challengeHubManager) this.challengeHubManager.showHub(); this.quizUI.hideElement(this.quizUI.elements.placeholderFiltrosContainer); this.quizUI.hideElement(this.quizUI.elements.quizSectionContent); this.quizUI.hideElement(this.quizUI.elements.resultadoCard); this.quizUI.hideElement(this.quizUI.elements.scorePanel); this.quizUI.hideElement(this.quizUI.elements.homeSection); this.quizUI.hideElement(this.quizUI.elements.accountSection); }
                else if (document.getElementById('account-section')) { this.quizUI.currentSection = 'account-section-page'; this.quizUI.hideElement(this.quizUI.elements.homeSection); this.quizUI.hideElement(this.quizUI.elements.questionSection); }
                else { this.quizUI.currentSection = 'home-section'; if (this.quizUI.elements.homeSection) this.quizUI.showElement(this.quizUI.elements.homeSection); }

            } else { this.handleLoadError("Não foi possível carregar os dados iniciais do quiz."); }
        } catch (error) { this.handleLoadError(`Erro fatal ao inicializar o quiz: ${error.message}. Tente recarregar a página.`); }
    }

    handleLoadError(message) {
        try {
            if (this.quizUI && document.getElementById('question-section')) { this.quizUI.showWarning(message); }
            else if (this.quizUI && this.quizUI.elements.homeSection) { if(this.quizUI.elements.homeSection) this.quizUI.showElement(this.quizUI.elements.homeSection); const homeWarningContainer = this.quizUI.elements.homeSection.querySelector('.hero-block') || this.quizUI.elements.homeSection; if (homeWarningContainer) { const homeWarning = document.createElement('p'); homeWarning.textContent = message; homeWarning.style.color = 'red'; homeWarning.style.backgroundColor = 'white'; homeWarning.style.padding = '10px'; homeWarning.style.border = '1px solid red'; homeWarning.style.textAlign = 'center'; homeWarningContainer.prepend(homeWarning); } else { alert(message); }
            } else { alert(message); }
            this.disableCoreFunctionality();
        } catch (uiError) { alert(message + `\nErro adicional na UI: ${uiError.message}`); }
    }

    disableCoreFunctionality() {
        if (this.quizUI && this.quizUI.elements) {
            if(this.quizUI.elements.hubCustomizeQuizBtn) this.quizUI.hideElement(this.quizUI.elements.hubCustomizeQuizBtn);
            if(this.quizUI.elements.hubQuickQuizBtn) this.quizUI.hideElement(this.quizUI.elements.hubQuickQuizBtn);
            const goToHubLink = document.getElementById('go-to-challenges-hub-link'); if (goToHubLink) this.quizUI.hideElement(goToHubLink);
            if (this.quizUI.elements.challengeHubContainer) { const title = this.quizUI.elements.challengeHubContainer.querySelector('.challenge-hub__title'); if (title) title.textContent = "Erro ao Carregar"; const subtitle = this.quizUI.elements.challengeHubContainer.querySelector('.challenge-hub__subtitle'); if (subtitle) subtitle.textContent = "Não foi possível carregar as questões."; if(document.getElementById('question-section') && this.quizUI.elements.challengeHubContainer.classList.contains('u-is-hidden')) { this.quizUI.showElement(this.quizUI.elements.challengeHubContainer); } }
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
        this.quizUI.elements.btnExplorarMais?.addEventListener('click', () => { const homeLink = document.querySelector('.site-header__logo a, .main-nav__link[data-section-target-django="home"], .bottom-nav__link[data-section-target-django="home"]'); if (homeLink && homeLink.href) window.location.href = homeLink.href; });
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => { this.quizLogic.forceEndQuiz(); });
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => { this.quizUI.toggleConfirmModal(false); });
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (e)=>{if(e.target===this.quizUI.elements.confirmEncerrarOverlay)this.quizUI.toggleConfirmModal(false);});
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (this.quizUI.elements.filterPanel?.classList.contains('filter-panel--visible')) this.quizUI.toggleFilterPanel(false); if (this.quizUI.elements.explanationModalOverlay?.classList.contains('modal--visible')) this.quizUI.toggleExplanationModal(false); if (this.quizUI.elements.confirmEncerrarOverlay?.classList.contains('modal--visible')) this.quizUI.toggleConfirmModal(false); } });
        const diffInputs = this.quizUI.elements.filterGroupDifficulty?.querySelectorAll('input[name="difficulty"]');
        const allDiffCb = this.quizUI.elements.filterGroupDifficulty?.querySelector('input[value="all"]');
        diffInputs?.forEach(input => { input.addEventListener('change', () => { if (input.value === 'all' && input.checked) { diffInputs.forEach(other => { if (other.value !== 'all') other.checked = false; }); } else if (input.value !== 'all' && input.checked) { if (allDiffCb) allDiffCb.checked = false; } const anySpecificChecked = Array.from(diffInputs).some(cb => cb.value !== 'all' && cb.checked); if (!anySpecificChecked && allDiffCb && !allDiffCb.checked) allDiffCb.checked = true; }); });
        this.quizUI.elements.btnToggleExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(true));
        this.quizUI.elements.btnCloseExplanationModal?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.btnGotItExplanation?.addEventListener('click', () => this.quizUI.toggleExplanationModal(false));
        this.quizUI.elements.explanationModalOverlay?.addEventListener('click', (e)=>{if(e.target===this.quizUI.elements.explanationModalOverlay)this.quizUI.toggleExplanationModal(false);});
        const profileForm = document.querySelector('#account-section .profile-form'); if (profileForm) { profileForm.addEventListener('submit', async (event) => { event.preventDefault(); alert('Funcionalidade de salvar perfil ainda não implementada no backend.'); }); }
    }
}

function getCookie(name) {
    let cookieValue = null; if (document.cookie && document.cookie !== '') { const cookies = document.cookie.split(';'); for (let i = 0; i < cookies.length; i++) { const cookie = cookies[i].trim(); if (cookie.substring(0, name.length + 1) === (name + '=')) { cookieValue = decodeURIComponent(cookie.substring(name.length + 1)); break; } } } return cookieValue;
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});