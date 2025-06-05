// File: assets/js/ui/QuizUI.js

// Importações dos submódulos de UI
import ModalManager from './ModalManager.js';
import Timer from './Timer.js';
import QuestionDisplay from './QuestionDisplay.js';
import ScorePanel from './ScorePanel.js';
import WarningDisplay from './WarningDisplay.js';
import FavoriteManager from './FavoriteManager.js';
// ResultDisplay é instanciado em App.js e injetado

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
        this.timer = new Timer(this.elements.timerDisplay, this.elements.resultadoTempo); //
        this.questionDisplay = new QuestionDisplay(this, this.quizState, this.quizData); //
        this.scorePanel = new ScorePanel(this); //
        this.warningDisplay = new WarningDisplay(this); //
        this.favoriteManager = new FavoriteManager(this, this.apiService, this.quizState); //
    }

    setQuizState(quizStateInstance) {
        this.quizState = quizStateInstance;
        if (this.modalManager) this.modalManager.quizState = quizStateInstance;
        if (this.questionDisplay) this.questionDisplay.quizState = quizStateInstance;
        if (this.favoriteManager) this.favoriteManager.quizState = quizStateInstance;
    }

    setQuizData(quizDataInstance) {
        this.quizData = quizDataInstance;
        if (this.modalManager) this.modalManager.quizData = quizDataInstance;
        if (this.questionDisplay) this.questionDisplay.quizData = quizDataInstance;
        if (this.favoriteManager && typeof this.favoriteManager.setQuizData === 'function') {
             this.favoriteManager.setQuizData(quizDataInstance);
        }
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
            this.resultDisplay.timer = this.timer;
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
            this.resultDisplay.goHomeCallback = callbacks.goHomeCallback; //
        }
    }

    _checkUserAuthentication() {
        const bodyEl = document.body;
        if (bodyEl && bodyEl.dataset.userAuthenticated === 'true') { //
            this.userIsAuthenticated = true;
        } else if (bodyEl && bodyEl.dataset.userAuthenticated === 'false') { //
            this.userIsAuthenticated = false;
        } else {
            const accountLinkInHeader = document.querySelector('.site-header__actions a[href*="/account/"]'); //
            this.userIsAuthenticated = !!accountLinkInHeader;
        }
    }

    _cacheDOMelements() {
        this.elements = {
            homeSection: document.getElementById('home-section'), //
            questionSection: document.getElementById('question-section'), //
            accountSection: document.getElementById('account-section-page'), //

            scorePanel: document.querySelector('.score-panel'), //
            pontuacaoDisplay: document.getElementById('pontuacao'), //
            acertosNumDisplay: document.getElementById('acertos-numero'), //
            errosNumDisplay: document.getElementById('erros-numero'), //
            timerDisplay: document.getElementById('timer-display'),  //
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'), //

            challengeHubContainer: document.getElementById('challenge-hub-container'), //
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'), //
            hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'), //
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'), //
            hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'), //

            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'), //
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'),  //
            avisoContainer: document.getElementById('aviso-container'), //
            avisoMensagem: document.querySelector('#aviso-container .card--aviso p'),  //

            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),  //
            quizSectionContent: document.getElementById('quiz-section'),  //
            questionWrap: document.querySelector('#quiz-section .card--question-wrap'),  //
            progressContainer: document.getElementById('progress-container'), //
            progressBarFill: document.getElementById('progress-bar-fill'), //
            progressText: document.getElementById('progress-text'), //
            questionTitle: document.getElementById('question-title'),  //
            categoriaTitulo: document.getElementById('categoria-titulo'),  //
            idQuestao: document.getElementById('id-questao'),  //
            perguntaTexto: document.getElementById('pergunta-texto'), //
            perguntaImagem: document.getElementById('pergunta-imagem'), //
            respostasContainer: document.getElementById('respostas-container'), //
            referenciaQuestao: document.getElementById('referencia-questao'), //
            feedbackAcessivel: document.getElementById('feedback-acessivel'),  //
            
            btnToggleExplanation: document.getElementById('btn-toggle-explanation'),  //
            btnToggleFavorite: document.getElementById('btn-toggle-favorite'),      //
            
            navigationButtons: document.querySelector('#quiz-section .quiz-navigation'), //
            prevBtn: document.getElementById('prev-btn'), //
            nextBtn: document.getElementById('next-btn'), //

            questionGridContainer: document.getElementById('question-grid-container'), //

            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'), //
            confirmEncerrarModal: document.getElementById('confirm-encerrar-modal'),  //
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'), //
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn'), //

            resultadoCard: document.querySelector('#question-section .card--quiz-result'),  //
            resultadoTitulo: document.querySelector('#question-section .card--quiz-result .quiz-results__main-title'), //
            resultadoPontos: document.getElementById('resultado-pontos'), //
            resultadoAcertos: document.getElementById('resultado-acertos'), //
            resultadoErros: document.getElementById('resultado-erros'), //
            resultadoTempo: document.getElementById('resultado-tempo'),  //
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'), //
            btnRecomecar: document.getElementById('btn-recomecar'), //
            btnExplorarMais: document.getElementById('btn-explorar-mais'), //

            filterPanel: document.getElementById('filter-panel'),  //
            btnFecharFiltros: document.getElementById('btn-fechar-filtros'),  //
            filterPanelOverlay: document.getElementById('filter-panel-overlay'), //
            
            explanationModalOverlay: document.getElementById('explanation-modal-overlay'), //
            explanationModalDialog: document.getElementById('explanation-modal-dialog'),  //
            btnCloseExplanationModal: document.getElementById('btn-close-explanation-modal'), //
            explanationModalMetaContainer: document.getElementById('explanation-modal-meta-container'), //
            explanationModalDifficulty: document.getElementById('explanation-modal-difficulty'), //
            explanationModalCategories: document.getElementById('explanation-modal-categories'), //
            explanationModalGeneralBlock: document.getElementById('explanation-modal-general-block'), //
            explanationModalGeneralText: document.getElementById('explanation-modal-general-text'),    //
            explanationModalOptionsBlock: document.getElementById('explanation-modal-options-block'),  //
            explanationModalOptionsList: document.getElementById('explanation-modal-options-list'),    //
            explanationModalReferenceBlock: document.getElementById('explanation-modal-reference-block'), //
            explanationModalReferenceText: document.getElementById('explanation-modal-reference-text'), //
            explanationModalDividerGeneralOptions: document.getElementById('explanation-divider-general-options'), //
            explanationModalDividerOptionsReference: document.getElementById('explanation-divider-options-reference'), //
            explanationModalEmptyState: document.getElementById('explanation-modal-empty-state'),  //
            btnGotItExplanation: document.getElementById('btn-got-it-explanation'), //

            favoriteQuestionsContainer: document.getElementById('favorite-questions-container'), //
            favoriteQuestionsEmptyState: document.getElementById('favorite-questions-empty-state'), //
            
            deleteAccountModalOverlay: document.getElementById('delete-account-modal-overlay'), //
            deleteAccountModalDialog: document.getElementById('delete-account-modal-dialog'), //
            btnOpenDeleteAccountModal: document.getElementById('btn-open-delete-account-modal'), //
            btnCancelDeleteAccountModal: document.getElementById('cancel-delete-account-btn'), //
            deleteAccountForm: document.getElementById('deleteAccountForm'), //
            passwordInputDeleteAccount: document.querySelector('#deleteAccountForm input[name="password"]'), //

            // --- NOVOS ELEMENTOS PARA O MODAL DE DECISÃO DE RETOMADA E INDICADOR DE LOADING ---
            resumeDecisionOverlay: document.getElementById('resume-decision-overlay'),
            resumeDecisionModalDialog: document.getElementById('resume-decision-modal-dialog'),
            btnConfirmResume: document.getElementById('btn-confirm-resume'),
            btnDiscardResume: document.getElementById('btn-discard-resume'),
            sessionLoadingIndicator: document.getElementById('session-loading-indicator'),
            sessionLoadingMessage: document.getElementById('session-loading-message'),
        };
    }

    // --- Métodos Utilitários de UI ---
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
            if (!buttonElement.dataset.originalText && textDisplayElement.textContent !== 'Carregando...') {
                buttonElement.dataset.originalText = textDisplayElement.textContent;
            } else if (originalText && !buttonElement.dataset.originalText) {
                buttonElement.dataset.originalText = originalText;
            }
            // Adiciona spinner se houver um elemento para ele
            const spinner = buttonElement.querySelector('.button__spinner'); // Assumindo que você pode adicionar <span class="button__spinner"></span>
            if(spinner) this.showElement(spinner);
            if (textDisplayElement) textDisplayElement.textContent = 'Carregando...';

        } else {
            buttonElement.classList.remove(this.loadingClassName);
            buttonElement.disabled = false;
            const spinner = buttonElement.querySelector('.button__spinner');
            if(spinner) this.hideElement(spinner);
            if (buttonElement.dataset.originalText) {
                if (textDisplayElement) textDisplayElement.textContent = buttonElement.dataset.originalText;
                // delete buttonElement.dataset.originalText; // Limpa para próxima vez
            } else if (originalText) {
                if (textDisplayElement) textDisplayElement.textContent = originalText;
            }
        }
    }
    
    // --- Métodos de Controle de Layout Principal ---
    
    displayQuizLayout(showQuizLayout = true) {
        const { placeholderFiltrosContainer, quizSectionContent } = this.elements;
        
        if (showQuizLayout) {
            if (this.scorePanel) this.scorePanel.show();
            if (this.challengeHubInstance) this.challengeHubInstance.hideHub(); //
            this.showElement(quizSectionContent); 
            if (this.warningDisplay) this.warningDisplay.clear(); 
            this.hideElement(placeholderFiltrosContainer); 
            if (this.resultDisplay) this.resultDisplay.hide(); //
        } else {
            if (this.scorePanel) this.scorePanel.hide();
            this.hideElement(quizSectionContent);
            
            const resultsAreVisible = this.elements.resultadoCard && !this.elements.resultadoCard.classList.contains(this.hiddenClassName);
            const filterPanelIsOpen = this.elements.filterPanel && this.elements.filterPanel.classList.contains('filter-panel--visible'); //

            if (!resultsAreVisible && !filterPanelIsOpen) {
                if (this.challengeHubInstance) this.challengeHubInstance.showHub();
                this.hideElement(placeholderFiltrosContainer);
            } else if (filterPanelIsOpen && !resultsAreVisible) {
                this.showElement(placeholderFiltrosContainer);
                if (this.challengeHubInstance) this.challengeHubInstance.hideHub();
            }
        }
    }

    hideActiveQuizElements() {
        this.hideElement(this.elements.quizSectionContent); 
        this.hideElement(this.elements.questionGridContainer); 

        if (this.questionDisplay && typeof this.questionDisplay.hideProgressBar === 'function') {
            this.questionDisplay.hideProgressBar(); 
        } else {
            this.hideElement(this.elements.progressContainer);
            this.hideElement(this.elements.progressText);
        }

        if (this.modalManager && typeof this.modalManager.toggleExplanationModal === 'function') { //
            this.modalManager.toggleExplanationModal(false); 
        }
        
        this.hideElement(this.elements.btnToggleExplanation); 
        this.hideElement(this.elements.btnToggleFavorite);

        if (this.scorePanel && typeof this.scorePanel.hide === 'function') {
            this.scorePanel.hide(); 
        } else {
            this.hideElement(this.elements.scorePanel); 
        }
    }

    // --- NOVO MÉTODO para Indicador de Carregamento da Sessão ---
    showSessionLoadingIndicator(show, message = "Carregando...") {
        if (this.elements.sessionLoadingIndicator) {
            if (show) {
                if (this.elements.sessionLoadingMessage) {
                    this.elements.sessionLoadingMessage.textContent = message;
                }
                // Usa a classe 'modal--visible' para consistência com a transição de opacidade/visibilidade
                this.elements.sessionLoadingIndicator.classList.add('modal--visible');
                this.elements.sessionLoadingIndicator.classList.remove(this.hiddenClassName);

                // Esconde outros painéis principais para focar no indicador
                this.hideElement(this.elements.challengeHubContainer);
                this.hideElement(this.elements.quizSectionContent);
                this.hideElement(this.elements.resultadoCard);
                this.hideElement(this.elements.placeholderFiltrosContainer);
                if (this.scorePanel) this.scorePanel.hide();
                if (this.warningDisplay) this.warningDisplay.clear();

                document.body.classList.add('no-scroll'); // Impede scroll do body
            } else {
                this.elements.sessionLoadingIndicator.classList.remove('modal--visible');
                // Adiciona u-is-hidden após a transição de opacidade
                setTimeout(() => {
                     if (!this.elements.sessionLoadingIndicator.classList.contains('modal--visible')) {
                        this.hideElement(this.elements.sessionLoadingIndicator);
                     }
                }, 300); // Deve corresponder à duração da transição no CSS

                // Só remove no-scroll se nenhum outro modal estiver ativo
                if (this.modalManager && this.modalManager.activeModalCount === 0) {
                     document.body.classList.remove('no-scroll');
                }
            }
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

    _getFriendlyErrorMessage(error, defaultMessage = "Ocorreu um erro. Tente novamente.") {
        if (error && error.response && error.response.status === 0) {
            return "Não foi possível conectar ao servidor. Verifique sua conexão com a internet.";
        }
        if (error && error.data && error.data.message) {
            return error.data.message; 
        }
        if (error && error.message && error.message.includes("Failed to fetch")) {
            return "Falha de rede. Verifique sua conexão e tente novamente.";
        }
        if (error && error.message) {
            // Não retornar error.message diretamente se for um erro técnico não amigável
            return defaultMessage; 
        }
        return defaultMessage;
    }
    
    showWarning(message, type = 'warning', isTextCentered = false) {
        if (this.warningDisplay) {
            this.warningDisplay.show(message, type, isTextCentered);
        } else {
            alert(`[${type.toUpperCase()}] ${message}`); 
        }
    }
}