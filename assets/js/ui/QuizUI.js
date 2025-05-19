// File: assets/js/ui/QuizUI.js

// Importações dos novos módulos de UI
import ModalManager from './ModalManager.js';
import Timer from './Timer.js';
import QuestionDisplay from './QuestionDisplay.js';
import ScorePanel from './ScorePanel.js';
import WarningDisplay from './WarningDisplay.js';
import FavoriteManager from './FavoriteManager.js';
import ResultDisplay from './ResultDisplay.js'; 

export default class QuizUI {
    constructor(onSectionChangeCallback = null) {
        this.hiddenClassName = 'u-is-hidden';
        this.loadingClassName = 'is-loading';
        this.currentSection = null;
        this.onSectionChange = onSectionChangeCallback;

        this.quizState = null;
        this.quizData = null;
        this.apiService = null; 
        
        this.filterPanelInstance = null; 
        this.challengeHubInstance = null; 
        this.resultDisplay = null; 
        
        this.userIsAuthenticated = false;
        
        this._cacheDOMelements(); 
        this._checkUserAuthentication();

        this.modalManager = new ModalManager(this, this.quizState, this.quizData);
        this.timer = new Timer(this.elements.timerDisplay, this.elements.resultadoTempo);
        this.questionDisplay = new QuestionDisplay(this, this.quizState, this.quizData);
        this.scorePanel = new ScorePanel(this);
        this.warningDisplay = new WarningDisplay(this);
        this.favoriteManager = new FavoriteManager(this, this.apiService, this.quizState);
        // ResultDisplay é instanciado em App.js e injetado via setResultDisplayInstance
        // this.resultDisplay = new ResultDisplay(this, this.timer); // Movido para App.js
    }

    setQuizState(quizStateInstance) {
        this.quizState = quizStateInstance;
        if (this.modalManager) this.modalManager.quizState = quizStateInstance;
        if (this.questionDisplay) this.questionDisplay.quizState = quizStateInstance;
        if (this.favoriteManager) this.favoriteManager.quizState = quizStateInstance;
        if (this.resultDisplay) this.resultDisplay.quizState = quizStateInstance; // Se ResultDisplay precisar
    }

    setQuizData(quizDataInstance) {
        this.quizData = quizDataInstance;
        if (this.modalManager) this.modalManager.quizData = quizDataInstance;
        if (this.questionDisplay) this.questionDisplay.quizData = quizDataInstance;
        if (this.favoriteManager && typeof this.favoriteManager.setQuizData === 'function') {
             this.favoriteManager.setQuizData(quizDataInstance);
        }
        // if (this.resultDisplay) this.resultDisplay.quizData = quizDataInstance; // Se ResultDisplay precisar
    }
    
    setApiService(apiServiceInstance) { 
        this.apiService = apiServiceInstance;
        if (this.favoriteManager) this.favoriteManager.apiService = apiServiceInstance;
    }

    setFilterPanelInstance(filterPanelInstance) {
        this.filterPanelInstance = filterPanelInstance;
    }

    setChallengeHubInstance(challengeHubInstance) {
        this.challengeHubInstance = challengeHubInstance;
    }

    setResultDisplayInstance(resultDisplayInstance) {
        this.resultDisplay = resultDisplayInstance;
         if (this.resultDisplay && this.timer) { 
            this.resultDisplay.timer = this.timer; // Garante que ResultDisplay tenha a instância do timer
        }
    }

    setCallbacks(callbacks = {}) {
        if (this.questionDisplay) {
            this.questionDisplay.answerCallback = callbacks.answerQuestionCallback;
            this.questionDisplay.navigationCallback = callbacks.navigationCallback;
            this.questionDisplay.toggleFavoriteCallback = callbacks.toggleFavoriteCallback;
        }
        if (this.scorePanel) {
            this.scorePanel.endSessionCallback = callbacks.endSessionCallback;
        }
        if (this.resultDisplay) { 
            this.resultDisplay.restartCallback = callbacks.restartQuizCallback;
            this.resultDisplay.goHomeCallback = callbacks.goHomeCallback;
        }
    }

    _checkUserAuthentication() {
        const bodyEl = document.body;
        if (bodyEl && bodyEl.dataset.userAuthenticated === 'true') this.userIsAuthenticated = true;
        else if (bodyEl && bodyEl.dataset.userAuthenticated === 'false') this.userIsAuthenticated = false;
        else {
            const accountLinkInHeader = document.querySelector('.site-header__actions a[href*="/account/"]');
            this.userIsAuthenticated = !!accountLinkInHeader;
        }
    }

    _cacheDOMelements() {
        this.elements = {
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'), 
            accountSection: document.getElementById('account-section-page'),
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'), 
            scorePanel: document.querySelector('.score-panel'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            timerDisplay: document.getElementById('timer-display'), 
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),
            challengeHubContainer: document.getElementById('challenge-hub-container'),
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'), 
            hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'),
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'),
            hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),
            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'), 
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
            feedbackAcessivel: document.getElementById('feedback-acessivel'), 
            btnToggleExplanation: document.getElementById('btn-toggle-explanation'), 
            btnToggleFavorite: document.getElementById('btn-toggle-favorite'),     
            navigationButtons: document.querySelector('#quiz-section .quiz-navigation'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            questionGridContainer: document.getElementById('question-grid-container'),
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarModal: document.getElementById('confirm-encerrar-modal'), 
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn'),
            resultadoCard: document.querySelector('#question-section .card--quiz-result'),
            resultadoTitulo: document.querySelector('#question-section .card--quiz-result .quiz-results__main-title'),
            resultadoPontos: document.getElementById('resultado-pontos'),
            resultadoAcertos: document.getElementById('resultado-acertos'),
            resultadoErros: document.getElementById('resultado-erros'),
            resultadoTempo: document.getElementById('resultado-tempo'), 
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'),
            btnRecomecar: document.getElementById('btn-recomecar'),
            btnExplorarMais: document.getElementById('btn-explorar-mais'),
            filterPanel: document.getElementById('filter-panel'), 
            btnFecharFiltros: document.getElementById('btn-fechar-filtros'), 
            filterPanelOverlay: document.getElementById('filter-panel-overlay'),
            btnAplicarFiltrosPainel: document.getElementById('btn-aplicar-filtros-painel'), 
            explanationModalOverlay: document.getElementById('explanation-modal-overlay'),
            explanationModalDialog: document.getElementById('explanation-modal-dialog'), 
            btnCloseExplanationModal: document.getElementById('btn-close-explanation-modal'),
            explanationModalGeneralBlock: document.getElementById('explanation-modal-general-block'),
            explanationModalGeneralText: document.getElementById('explanation-modal-general-text'),
            explanationModalOptionsBlock: document.getElementById('explanation-modal-options-block'),
            explanationModalOptionsList: document.getElementById('explanation-modal-options-list'),
            explanationModalDivider: document.querySelector('.explanation-modal__divider'),
            explanationModalEmptyState: document.getElementById('explanation-modal-empty-state'),
            btnGotItExplanation: document.getElementById('btn-got-it-explanation'),
            favoriteQuestionsContainer: document.getElementById('favorite-questions-container'),
            favoriteQuestionsEmptyState: document.getElementById('favorite-questions-empty-state'),
        };
    }

    showElement(element) {
        element?.classList.remove(this.hiddenClassName);
    }

    hideElement(element) {
        element?.classList.add(this.hiddenClassName);
    }

    setButtonLoading(buttonElement, isLoading, originalText = null) {
        if (!buttonElement) return;
        const textDisplayElement = buttonElement.querySelector('.button__label') || buttonElement;
        if (isLoading) {
            buttonElement.classList.add(this.loadingClassName);
            buttonElement.disabled = true;
            if (!buttonElement.dataset.originalText && originalText) {
                buttonElement.dataset.originalText = originalText;
            } else if (!buttonElement.dataset.originalText && textDisplayElement.textContent !== 'Carregando...') {
                buttonElement.dataset.originalText = textDisplayElement.textContent;
            }
            textDisplayElement.textContent = 'Carregando...';
        } else {
            buttonElement.classList.remove(this.loadingClassName);
            buttonElement.disabled = false;
            if (buttonElement.dataset.originalText) {
                textDisplayElement.textContent = buttonElement.dataset.originalText;
            } else if (originalText) {
                textDisplayElement.textContent = originalText;
            }
        }
    }
    
    displayQuizLayout(showQuizLayout = true) {
        const { placeholderFiltrosContainer, resultadoCard } = this.elements;
        
        if (showQuizLayout) {
            if (this.scorePanel) this.scorePanel.show();
            if (this.challengeHubInstance) this.challengeHubInstance.hideHub();
            this.showElement(this.elements.quizSectionContent); 
            if (this.warningDisplay) this.warningDisplay.clear(); 
            this.hideElement(placeholderFiltrosContainer);
            if (this.resultDisplay) this.resultDisplay.hide();
        } else {
            if (this.scorePanel) this.scorePanel.hide();
            this.hideElement(this.elements.quizSectionContent); 
            
            if (this.resultDisplay && this.elements.resultadoCard && !this.elements.resultadoCard.classList.contains(this.hiddenClassName)) {
                if (this.challengeHubInstance) this.challengeHubInstance.hideHub();
            } else {
                if (this.challengeHubInstance && 
                    (!this.elements.filterPanel || !this.elements.filterPanel.classList.contains('filter-panel--visible'))) {
                     this.challengeHubInstance.showHub();
                }
                this.hideElement(placeholderFiltrosContainer);
            }
        }
    }

    /**
     * Esconde todos os elementos visuais de um quiz que está ativamente em progresso.
     * Crucial para limpar a tela antes de mostrar resultados ou ao reiniciar o quiz.
     */
    hideActiveQuizElements() {
        // console.log("QUIZUI: hideActiveQuizElements - Escondendo elementos do quiz ativo.");
        
        // Esconde o container principal do quiz (pergunta, opções, navegação, etc.)
        this.hideElement(this.elements.quizSectionContent); 
        
        // Esconde o grid de questões explicitamente
        // Se questionGridContainer for filho de quizSectionContent, esta chamada é redundante, mas segura.
        this.hideElement(this.elements.questionGridContainer);

        // Esconde a barra de progresso através do QuestionDisplay
        if (this.questionDisplay && typeof this.questionDisplay.hideProgressBar === 'function') {
            this.questionDisplay.hideProgressBar(); 
        } else {
            // Fallback se questionDisplay não estiver pronto ou não tiver o método
            this.hideElement(this.elements.progressContainer);
            this.hideElement(this.elements.progressText);
        }

        // Fecha o modal de explicação, se estiver aberto, usando o ModalManager
        if (this.modalManager && typeof this.modalManager.toggleExplanationModal === 'function') {
            this.modalManager.toggleExplanationModal(false); 
        }
        
        // Esconde o botão de alternar explicação
        this.hideElement(this.elements.btnToggleExplanation); 
        
        // Esconde o botão de favorito (geralmente parte da UI da questão)
        this.hideElement(this.elements.btnToggleFavorite);

        // Adicional: Esconder o painel de score, pois ele é parte de um quiz ativo
        if (this.scorePanel && typeof this.scorePanel.hide === 'function') {
            this.scorePanel.hide();
        } else {
            this.hideElement(this.elements.scorePanel); // Fallback
        }
    }

    setupGlobalEventListeners(quizLogicInstance) {
        if (!quizLogicInstance) {
            return;
        }

        if (this.modalManager) {
            this.modalManager.setupEventListeners(quizLogicInstance);
        }

        this.elements.closeFiltersAndShowHubBtn?.addEventListener('click', () => {
            if (this.modalManager) this.modalManager.toggleFilterPanel(false);
            if (this.challengeHubInstance) this.challengeHubInstance.showHub(); 
            this.hideElement(this.elements.placeholderFiltrosContainer);
        });

        this.elements.btnToggleExplanation?.addEventListener('click', () => {
             if (this.modalManager) this.modalManager.toggleExplanationModal(true);
        });
    }
}
