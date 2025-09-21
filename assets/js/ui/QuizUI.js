// Arquivo Completo: assets/js/ui/QuizUI.js

// Importações dos submódulos de UI
import ModalManager from './ModalManager.js';
import Timer from './Timer.js';
import QuestionDisplay from './QuestionDisplay.js';
import ScorePanel from './ScorePanel.js';
import WarningDisplay from './WarningDisplay.js';
import { TRANSITION_DURATION } from '../utils/constants.js';

export default class QuizUI {
    constructor() {
        this.hiddenClassName = 'u-is-hidden';
        this.loadingClassName = 'is-loading';
        
        this.store = null;
        this.actionOrchestrator = null;
        
        this.previousState = {};
        this.userIsAuthenticated = false;
        
        this._cacheDOMelements();
        this._checkUserAuthentication();

        this.modalManager = new ModalManager(this);
        this.timer = new Timer(this.elements.timerDisplay, this.elements.resultadoTempo);
        this.questionDisplay = new QuestionDisplay(this);
        this.scorePanel = new ScorePanel(this);
        this.warningDisplay = new WarningDisplay(this);

        this.filterPanelInstance = null;
        this.challengeHubInstance = null;
        this.resultDisplay = null;
    }

    // --- MÉTODOS DE INJEÇÃO DE DEPENDÊNCIA ---

    setStore(store) {
        this.store = store;
        this.previousState = JSON.parse(JSON.stringify(store.getState()));

        this.modalManager?.setStore(store);
        this.timer?.setStore(store);
        this.scorePanel?.setStore(store);
        this.questionDisplay?.setStore(store);

        this.unsubscribe = this.store.subscribe(this.handleStateUpdate.bind(this));
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;

        this.modalManager?.setActionOrchestrator(orchestrator);
        this.questionDisplay?.setActionOrchestrator(orchestrator);
        this.scorePanel?.setActionOrchestrator(orchestrator);
        this.resultDisplay?.setActionOrchestrator(orchestrator); 
        this.challengeHubInstance?.setActionOrchestrator(orchestrator); 
        
        this.setupGlobalEventListeners();
    }
    
    setFilterPanelInstance(filterPanelInstance) {
        this.filterPanelInstance = filterPanelInstance;
    }

    setChallengeHubInstance(challengeHubInstance) {
        this.challengeHubInstance = challengeHubInstance;
    }

    setResultDisplayInstance(resultDisplayInstance) {
        this.resultDisplay = resultDisplayInstance;
    }

    // --- LÓGICA REATIVA ---

    handleStateUpdate() {
        if (!this.store) {
            return;
        }
        
        const currentState = this.store.getState();
        const previousSessionId = this.previousState.quiz?.currentSessionId;
        const currentSessionId = currentState.quiz?.currentSessionId;
        const wasQuizActive = previousSessionId !== null && previousSessionId !== undefined;
        const isQuizActive = currentSessionId !== null && currentSessionId !== undefined;

        const wasQuizEnded = this.previousState.quiz?.quizEnded === true;
        const isQuizEnded = currentState.quiz?.quizEnded === true;

        const previousDisplayMode = this.previousState.quiz?.quizDisplayContext?.displayMode;
        const currentDisplayMode = currentState.quiz?.quizDisplayContext?.displayMode;
        const wasInReviewMode = previousDisplayMode === 'review';
        const isInReviewMode = currentDisplayMode === 'review';

        const wasQuizVisible = wasQuizActive || wasInReviewMode;
        const isQuizVisible = isQuizActive || isInReviewMode;

        if (!wasQuizVisible && isQuizVisible) {
            this.displayQuizLayout(true);
        }

        if ((wasQuizVisible || wasQuizEnded) && !isQuizVisible && !isQuizEnded) {
            this.displayQuizLayout(false);
        }
    
        // --- INÍCIO DA ALTERAÇÃO: Lógica reativa agora delega ao ChallengeHub ---
        const hadResumableSession = !!this.previousState.quiz?.resumableSession;
        const hasResumableSession = !!currentState.quiz.resumableSession;

        if (this.challengeHubInstance) {
            if (!hadResumableSession && hasResumableSession) {
                this.challengeHubInstance.showResumeOption(currentState.quiz.resumableSession);
            } else if (hadResumableSession && !hasResumableSession) {
                this.challengeHubInstance.hideResumeOption();
            }
        }
        // --- FIM DA ALTERAÇÃO ---

        const prevQuestionIndex = this.previousState.quiz?.currentQuestionIndex ?? -1;
        if (isQuizActive && currentState.quiz.currentQuestionIndex !== prevQuestionIndex) {
            this._handleQuestionChange(currentState);
        }
    
        const prevQuestionState = this.previousState.quiz?.currentQuestionsSet[prevQuestionIndex];
        const currentQuestionState = currentState.quiz.currentQuestionsSet[currentState.quiz.currentQuestionIndex];
    
        if (currentQuestionState && currentQuestionState.respostaDadaId !== prevQuestionState?.respostaDadaId && currentQuestionState.respostaDadaId !== undefined && currentQuestionState.respostaDadaId !== null) {
            this._handleAnsweredQuestion(currentQuestionState);
        }
    
        if (!wasQuizEnded && isQuizEnded) {
            if (this.resultDisplay) {
                this.resultDisplay.render(currentState.user, currentState);
            }
        }
        
        this.previousState = JSON.parse(JSON.stringify(currentState));
    }

    _handleQuestionChange(state) {
        const questionWrapper = this.elements.questionWrap;
        if (!questionWrapper) {
            this.questionDisplay.displayCurrentQuestion(state.quiz);
            return;
        }

        const isInitialLoad = state.quiz.isInitialQuestionLoad;

        const displayLogic = () => {
            this.questionDisplay.displayCurrentQuestion(state.quiz);
        };

        if (!isInitialLoad) {
            questionWrapper.classList.add("is-fading-out");
            setTimeout(() => {
                questionWrapper.classList.remove("is-fading-out");
                questionWrapper.classList.add("is-transparent");
                requestAnimationFrame(() => {
                    displayLogic();
                    requestAnimationFrame(() => questionWrapper.classList.remove("is-transparent"));
                });
            }, TRANSITION_DURATION);
        } else {
            questionWrapper.classList.remove("is-fading-out", "is-transparent");
            displayLogic();
        }
    }

    _handleAnsweredQuestion(currentQuestionState) {
        this.questionDisplay.applyAnswerFeedback(currentQuestionState.respostaDadaId, currentQuestionState.opcoes);
        this.questionDisplay.disableAnswers();
        this.questionDisplay.updateExplanationButtonVisibility(currentQuestionState);

        setTimeout(() => {
            this.questionDisplay.focusNextButton(true);
            this.questionDisplay.smoothScrollToNextButton();
        }, 100);
    }
    
    // --- MÉTODOS DE UI ---

    _checkUserAuthentication() {
        this.userIsAuthenticated = document.body.dataset.userAuthenticated === 'true';
    }

    _cacheDOMelements() {
        this.elements = {
            homeSection: document.getElementById('home-section'),
            questionSection: document.getElementById('question-section'),
            accountSection: document.getElementById('account-section-page'),
            scorePanel: document.querySelector('.score-panel'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            xpDisplay: document.getElementById('xp-numero'),
            sequenciaDisplay: document.getElementById('sequencia-numero'),
            multiplicadorDisplay: document.getElementById('multiplicador-atual'),
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
            mainContentQuestoes: document.querySelector('#question-section .question-section__main-content'),
            quizSectionContent: document.getElementById('quiz-section'),
            questionWrap: document.querySelector('#quiz-section .card--question-wrap'),
            questionActions: document.querySelector('.question-display__actions'),
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
            resultadoSubtitle: document.getElementById('resultado-subtitulo'),
            resultadoPontos: document.getElementById('resultado-pontos'),
            resultadoScoreMeter: document.getElementById('resultado-score-meter'),
            resultadoPrecisao: document.getElementById('resultado-precisao'),
            resultadoQuestoes: document.getElementById('resultado-questoes'),
            resultadoPontosPorQuestao: document.getElementById('resultado-pontos-por-questao'),
            resultadoTempoMedio: document.getElementById('resultado-tempo-medio'),
            resultadoAcertos: document.getElementById('resultado-acertos'),
            resultadoErros: document.getElementById('resultado-erros'),
            resultadoTempo: document.getElementById('resultado-tempo'),
            resultadoMensagemMotivacional: document.getElementById('resultado-mensagem-motivacional'),
            resultadoInsightDestaqueText: document.getElementById('resultado-insight-destaque-text'),
            resultadoInsightMetaText: document.getElementById('resultado-insight-meta-text'),
            resultadoPainelLink: document.getElementById('resultado-painel-link'),
            btnRecomecar: document.getElementById('btn-recomecar'),
            btnExplorarMais: document.getElementById('btn-explorar-mais'),
            btnCompartilharResultado: document.getElementById('btn-compartilhar-resultado'),
            resultadoGamificacao: document.getElementById('resultado-gamificacao'),
            resultadoXpGanho: document.getElementById('resultado-xp-ganho'),
            resultadoXpTotal: document.getElementById('resultado-xp-total'),
            resultadoNivelAtual: document.getElementById('resultado-nivel-atual'),
            resultadoNivelProgress: document.getElementById('resultado-nivel-progress'),
            resultadoNivelProgressFill: document.getElementById('resultado-nivel-progress-fill'),
            resultadoProgressoLabel: document.getElementById('resultado-progresso-label'),
            resultadoXpProximo: document.getElementById('resultado-xp-proximo'),
            resultadoNivelAlert: document.getElementById('resultado-nivel-alert'),
            resultadoNivelAlertText: document.getElementById('resultado-nivel-alert-text'),
            resultadoConquistasWrapper: document.getElementById('resultado-conquistas-wrapper'),
            resultadoConquistasCount: document.getElementById('resultado-conquistas-count'),
            resultadoConquistasList: document.getElementById('resultado-conquistas-list'),
            resultadoConquistasEmpty: document.getElementById('resultado-conquistas-empty'),
            filterPanel: document.getElementById('filter-panel'),
            btnFecharFiltros: document.getElementById('btn-fechar-filtros'),
            filterPanelOverlay: document.getElementById('filter-panel-overlay'),
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
            favoriteQuestionsContainer: document.getElementById('favorite-questions-container'),
            favoriteQuestionsEmptyState: document.getElementById('favorite-questions-empty-state'),
            deleteAccountModalOverlay: document.getElementById('delete-account-modal-overlay'),
            deleteAccountModalDialog: document.getElementById('delete-account-modal-dialog'),
            btnOpenDeleteAccountModal: document.getElementById('btn-open-delete-account-modal'),
            btnCancelDeleteAccountModal: document.getElementById('cancel-delete-account-btn'),
            deleteAccountForm: document.getElementById('deleteAccountForm'),
            passwordInputDeleteAccount: document.querySelector('#deleteAccountForm input[name="password"]'),
            bottomNavElement: document.querySelector('.bottom-nav'),
            sessionLoadingIndicator: document.getElementById('session-loading-indicator'),
            sessionLoadingMessage: document.getElementById('session-loading-message'),
            
            // --- INÍCIO DA ALTERAÇÃO: Remoção dos elementos do banner antigo ---
            // resumeBannerContainer: document.getElementById('resume-banner-container'),
            // resumeBannerQuestionCount: document.getElementById('resume-banner-question-count'),
            // btnBannerConfirmResume: document.getElementById('btn-banner-confirm-resume'),
            // btnBannerDiscardResume: document.getElementById('btn-banner-discard-resume'),
            // --- FIM DA ALTERAÇÃO ---
        };
    }
    
    // --- INÍCIO DA ALTERAÇÃO: Métodos do banner antigo removidos ---
    // displayResumeBanner(resumableSession) { ... }
    // hideResumeBanner() { ... }
    // _setupResumeBannerListeners() { ... }
    // --- FIM DA ALTERAÇÃO ---

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
            const spinner = buttonElement.querySelector('.button__spinner');
            if(spinner) this.showElement(spinner);
            if (textDisplayElement) textDisplayElement.textContent = 'Carregando...';

        } else {
            buttonElement.classList.remove(this.loadingClassName);
            buttonElement.disabled = false;
            const spinner = buttonElement.querySelector('.button__spinner');
            if(spinner) this.hideElement(spinner);
            if (buttonElement.dataset.originalText) {
                if (textDisplayElement) textDisplayElement.textContent = buttonElement.dataset.originalText;
            } else if (originalText) {
                if (textDisplayElement) textDisplayElement.textContent = originalText;
            }
        }
    }
    
    displayQuizLayout(showQuizLayout = true) {
        const { placeholderFiltrosContainer, quizSectionContent, bottomNavElement } = this.elements;
        const displayMode = this.store?.getState()?.quiz?.quizDisplayContext?.displayMode || 'challenge';

        if (showQuizLayout) {
            if (this.scorePanel) {
                if (displayMode === 'review') this.scorePanel.hide();
                else this.scorePanel.show();
            }
            if (this.challengeHubInstance) this.challengeHubInstance.hideHub();
            this.showElement(quizSectionContent);
            if (this.warningDisplay) this.warningDisplay.clear();
            this.hideElement(placeholderFiltrosContainer);
            if (this.resultDisplay) this.resultDisplay.hide();
            if (bottomNavElement) this.hideElement(bottomNavElement);
            // --- INÍCIO DA ALTERAÇÃO: Remoção da chamada ao banner antigo ---
            // this.hideElement(this.elements.resumeBannerContainer);
            // --- FIM DA ALTERAÇÃO ---
        } else {
            if (this.scorePanel) this.scorePanel.hide();
            this.hideElement(quizSectionContent);
            if (this.resultDisplay) this.resultDisplay.hide();
            
            if (this.challengeHubInstance) this.challengeHubInstance.showHub();
            this.hideElement(placeholderFiltrosContainer);
            
            if (bottomNavElement) this.showElement(bottomNavElement);
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

    showSessionLoadingIndicator(show, message = "Carregando...") {
        if (this.elements.sessionLoadingIndicator) {
            if (show) {
                if (this.elements.sessionLoadingMessage) {
                    this.elements.sessionLoadingMessage.textContent = message;
                }
                this.elements.sessionLoadingIndicator.classList.add('modal--visible');
                this.elements.sessionLoadingIndicator.classList.remove(this.hiddenClassName);
                this.hideElement(this.elements.challengeHubContainer);
                this.hideElement(this.elements.quizSectionContent);
                this.hideElement(this.elements.resultadoCard);
                this.hideElement(this.elements.placeholderFiltrosContainer);
                
                // --- INÍCIO DA ALTERAÇÃO: Remoção da chamada ao banner antigo ---
                // this.hideElement(this.elements.resumeBannerContainer);
                // --- FIM DA ALTERAÇÃO ---

                if (this.scorePanel) this.scorePanel.hide();
                if (this.warningDisplay) this.warningDisplay.clear();
                document.body.classList.add('no-scroll');
            } else {
                this.elements.sessionLoadingIndicator.classList.remove('modal--visible');
                setTimeout(() => {
                     if (!this.elements.sessionLoadingIndicator.classList.contains('modal--visible')) {
                        this.hideElement(this.elements.sessionLoadingIndicator);
                     }
                }, 300);
                if (this.modalManager && this.modalManager.activeModalCount === 0) {
                     document.body.classList.remove('no-scroll');
                }
            }
        }
    }

    setupGlobalEventListeners() {
        this.elements.closeFiltersAndShowHubBtn?.addEventListener('click', () => {
            if (this.modalManager) this.modalManager.toggleFilterPanel(false); 
            if (this.challengeHubInstance) this.challengeHubInstance.showHub(); 
            this.hideElement(this.elements.placeholderFiltrosContainer); 
        });

        this.elements.btnToggleExplanation?.addEventListener('click', () => {
             if (this.modalManager) this.modalManager.toggleExplanationModal(true);
        });
    }
    
    showWarning(message, type = 'warning', isTextCentered = false) {
        if (this.warningDisplay) {
            this.warningDisplay.show(message, type, isTextCentered);
        } else {
            alert(`[${type.toUpperCase()}] ${message}`); 
        }
    }
}