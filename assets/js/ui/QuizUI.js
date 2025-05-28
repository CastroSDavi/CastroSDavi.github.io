// File: assets/js/ui/QuizUI.js

// Importações dos submódulos de UI
import ModalManager from './ModalManager.js';
import Timer from './Timer.js';
import QuestionDisplay from './QuestionDisplay.js';
import ScorePanel from './ScorePanel.js';
import WarningDisplay from './WarningDisplay.js';
import FavoriteManager from './FavoriteManager.js';
// ResultDisplay é instanciado em App.js e injetado, não precisa ser importado aqui diretamente
// se QuizUI apenas o recebe e armazena.

export default class QuizUI {
    constructor(onSectionChangeCallback = null) {
        this.hiddenClassName = 'u-is-hidden';
        this.loadingClassName = 'is-loading';
        this.currentSection = null; // ID da seção principal ativa (ex: 'home-section')
        this.onSectionChange = onSectionChangeCallback; // Callback para notificar App.js sobre mudança de seção

        // Instâncias de dependências que serão injetadas
        this.quizState = null;
        this.quizData = null;
        this.apiService = null; 
        
        // Instâncias de componentes de UI que QuizUI gerencia ou coordena
        this.filterPanelInstance = null; 
        this.challengeHubInstance = null; 
        this.resultDisplay = null; // Será injetado por App.js
        
        this.userIsAuthenticated = false; // Determinado no _checkUserAuthentication
        
        this._cacheDOMelements(); // Cacheia todos os elementos DOM relevantes
        this._checkUserAuthentication(); // Verifica se o usuário está autenticado

        // Instancia submódulos de UI que são partes integrantes de QuizUI
        this.modalManager = new ModalManager(this, this.quizState, this.quizData);
        this.timer = new Timer(this.elements.timerDisplay, this.elements.resultadoTempo);
        this.questionDisplay = new QuestionDisplay(this, this.quizState, this.quizData /* callbacks serão definidos via setCallbacks */);
        this.scorePanel = new ScorePanel(this /* callback do botão encerrar será definido via setCallbacks */);
        this.warningDisplay = new WarningDisplay(this);
        // FavoriteManager precisa do ApiService e QuizState, que são injetados depois via setters
        this.favoriteManager = new FavoriteManager(this, this.apiService, this.quizState);

        // REMOVIDO: this.focusedElementBeforeModal e this.activeModalCount
        // Essas responsabilidades agora são totalmente do ModalManager.
    }

    // Métodos para injetar dependências principais
    setQuizState(quizStateInstance) {
        this.quizState = quizStateInstance;
        if (this.modalManager) this.modalManager.quizState = quizStateInstance;
        if (this.questionDisplay) this.questionDisplay.quizState = quizStateInstance;
        if (this.favoriteManager) this.favoriteManager.quizState = quizStateInstance;
        // if (this.resultDisplay) this.resultDisplay.quizState = quizStateInstance; // Se ResultDisplay precisar do QuizState
    }

    setQuizData(quizDataInstance) {
        this.quizData = quizDataInstance;
        if (this.modalManager) this.modalManager.quizData = quizDataInstance;
        if (this.questionDisplay) this.questionDisplay.quizData = quizDataInstance;
        if (this.favoriteManager && typeof this.favoriteManager.setQuizData === 'function') {
             this.favoriteManager.setQuizData(quizDataInstance);
        }
        // if (this.resultDisplay) this.resultDisplay.quizData = quizDataInstance; // Se ResultDisplay precisar do QuizData
    }
    
    setApiService(apiServiceInstance) { 
        this.apiService = apiServiceInstance;
        // Garante que o FavoriteManager (que é parte de QuizUI) receba o ApiService
        if (this.favoriteManager) this.favoriteManager.apiService = apiServiceInstance;
    }

    // Métodos para injetar instâncias de componentes de UI maiores
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

    // Método para configurar callbacks que QuizLogic fornecerá
    setCallbacks(callbacks = {}) {
        if (this.questionDisplay) {
            this.questionDisplay.answerCallback = callbacks.answerQuestionCallback;
            this.questionDisplay.navigationCallback = callbacks.navigationCallback;
            this.questionDisplay.toggleFavoriteCallback = callbacks.toggleFavoriteCallback;
        }
        if (this.scorePanel) {
            // O callback para o botão de encerrar sessão no ScorePanel agora é passado aqui
            this.scorePanel.endSessionCallback = callbacks.endSessionCallback;
        }
        if (this.resultDisplay) { 
            this.resultDisplay.restartCallback = callbacks.restartQuizCallback;
            this.resultDisplay.goHomeCallback = callbacks.goHomeCallback;
        }
    }

    _checkUserAuthentication() {
        const bodyEl = document.body;
        if (bodyEl && bodyEl.dataset.userAuthenticated === 'true') {
            this.userIsAuthenticated = true;
        } else if (bodyEl && bodyEl.dataset.userAuthenticated === 'false') {
            this.userIsAuthenticated = false;
        } else {
            // Fallback se o data-attribute não estiver presente
            const accountLinkInHeader = document.querySelector('.site-header__actions a[href*="/account/"]');
            this.userIsAuthenticated = !!accountLinkInHeader;
            // console.warn("QuizUI: Atributo data-user-authenticated não encontrado no body. Autenticação inferida pela presença do link da conta.");
        }
        // console.log("QuizUI: User authenticated status:", this.userIsAuthenticated);
    }

    _cacheDOMelements() {
        this.elements = {
            // Seções principais da página
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'), // O container da página de questões
            accountSection: document.getElementById('account-section-page'), // O container da página da conta

            // Elementos do ScorePanel e Timer (agora parte de QuizUI)
            scorePanel: document.querySelector('.score-panel'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            timerDisplay: document.getElementById('timer-display'), 
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),

            // Elementos do ChallengeHub
            challengeHubContainer: document.getElementById('challenge-hub-container'),
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'), // Span no hub
            hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'),
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'),
            hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),

            // Placeholder de filtros e Aviso
            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'), 
            avisoContainer: document.getElementById('aviso-container'),
            avisoMensagem: document.querySelector('#aviso-container .card--aviso p'), 

            // Elementos da Seção de Quiz Ativo (Perguntas)
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'), 
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
            
            // Botões de Ação da Pergunta
            btnToggleExplanation: document.getElementById('btn-toggle-explanation'), 
            btnToggleFavorite: document.getElementById('btn-toggle-favorite'),     
            
            // Navegação do Quiz (Anterior/Próximo)
            navigationButtons: document.querySelector('#quiz-section .quiz-navigation'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),

            // Grid de Questões
            questionGridContainer: document.getElementById('question-grid-container'),

            // Modal de Confirmação de Encerramento
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarModal: document.getElementById('confirm-encerrar-modal'), 
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn'),

            // Card de Resultado do Quiz
            resultadoCard: document.querySelector('#question-section .card--quiz-result'), 
            resultadoTitulo: document.querySelector('#question-section .card--quiz-result .quiz-results__main-title'),
            resultadoPontos: document.getElementById('resultado-pontos'),
            resultadoAcertos: document.getElementById('resultado-acertos'),
            resultadoErros: document.getElementById('resultado-erros'),
            resultadoTempo: document.getElementById('resultado-tempo'), 
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'),
            btnRecomecar: document.getElementById('btn-recomecar'),
            btnExplorarMais: document.getElementById('btn-explorar-mais'),

            // Painel de Filtros
            filterPanel: document.getElementById('filter-panel'), 
            btnFecharFiltros: document.getElementById('btn-fechar-filtros'), 
            filterPanelOverlay: document.getElementById('filter-panel-overlay'),
            
            // Modal de Explicação
            explanationModalOverlay: document.getElementById('explanation-modal-overlay'),
            explanationModalDialog: document.getElementById('explanation-modal-dialog'), 
            btnCloseExplanationModal: document.getElementById('btn-close-explanation-modal'),
            explanationModalMetaContainer: document.getElementById('explanation-modal-meta-container'),
            explanationModalDifficulty: document.getElementById('explanation-modal-difficulty'),
            explanationModalCategories: document.getElementById('explanation-modal-categories'),
            explanationModalGeneralBlock: document.getElementById('explanation-modal-general-block'),
            explanationModalGeneralText: document.getElementById('explanation-modal-general-text'),   
            explanationModalOptionsBlock: document.getElementById('explanation-modal-options-block'), 
            explanationModalOptionsList: document.getElementById('explanation-modal-options-list'),   
            explanationModalReferenceBlock: document.getElementById('explanation-modal-reference-block'),
            explanationModalReferenceText: document.getElementById('explanation-modal-reference-text'),
            explanationModalDividerGeneralOptions: document.getElementById('explanation-divider-general-options'),
            explanationModalDividerOptionsReference: document.getElementById('explanation-divider-options-reference'),
            explanationModalEmptyState: document.getElementById('explanation-modal-empty-state'), 
            btnGotItExplanation: document.getElementById('btn-got-it-explanation'),

            // Elementos da Página da Conta
            favoriteQuestionsContainer: document.getElementById('favorite-questions-container'),
            favoriteQuestionsEmptyState: document.getElementById('favorite-questions-empty-state'),
            
            // MODAL DE EXCLUSÃO DE CONTA (adicionado aqui para o ModalManager)
            deleteAccountModalOverlay: document.getElementById('delete-account-modal-overlay'),
            deleteAccountModalDialog: document.getElementById('delete-account-modal-dialog'),
            btnOpenDeleteAccountModal: document.getElementById('btn-open-delete-account-modal'), // Para AccountPageManager saber qual botão abre
            btnCancelDeleteAccountModal: document.getElementById('cancel-delete-account-btn'), // Renomeado para clareza
            deleteAccountForm: document.getElementById('deleteAccountForm'),
            passwordInputDeleteAccount: document.querySelector('#deleteAccountForm input[name="password"]') // Mais específico
        };
        // console.log("QuizUI: Elementos DOM cacheados:", this.elements);
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
    
    // --- Métodos de Controle de Layout Principal ---
    
    displayQuizLayout(showQuizLayout = true) {
        const { placeholderFiltrosContainer, quizSectionContent } = this.elements;
        
        if (showQuizLayout) {
            if (this.scorePanel) this.scorePanel.show();
            if (this.challengeHubInstance) this.challengeHubInstance.hideHub(); 
            this.showElement(quizSectionContent); 
            if (this.warningDisplay) this.warningDisplay.clear(); 
            this.hideElement(placeholderFiltrosContainer); 
            if (this.resultDisplay) this.resultDisplay.hide(); 
        } else {
            if (this.scorePanel) this.scorePanel.hide();
            this.hideElement(quizSectionContent);
            
            const resultsAreVisible = this.elements.resultadoCard && !this.elements.resultadoCard.classList.contains(this.hiddenClassName);
            const filterPanelIsOpen = this.elements.filterPanel && this.elements.filterPanel.classList.contains('filter-panel--visible');

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

        if (this.modalManager && typeof this.modalManager.toggleExplanationModal === 'function') {
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

    setupGlobalEventListeners(quizLogicInstance) {
        if (!quizLogicInstance) {
            // console.error("QuizUI: Instância de QuizLogic não fornecida para setupGlobalEventListeners.");
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