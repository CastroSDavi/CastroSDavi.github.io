// Arquivo Completo: assets/js/ui/QuizUI.js

// Importações dos submódulos de UI
import ModalManager from './ModalManager.js';
import Timer from './Timer.js';
import QuestionDisplay from './QuestionDisplay.js';
import ScorePanel from './ScorePanel.js';
import WarningDisplay from './WarningDisplay.js';
import { TRANSITION_DURATION } from '../utils/constants.js';
import { resolveSystemMessage } from './messages/index.js';

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

        this.lastSystemMessage = null;
        this.messageCenter = null;

        this.filterPanelInstance = null;
        this.challengeHubInstance = null;
        this.resultDisplay = null;
        this.currentReportQuestionId = null;
        this.currentSupportMessageMeta = null;
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

    setMessageCenter(messageCenter) {
        this.messageCenter = messageCenter;

        if (this.messageCenter) {
            this.messageCenter.setInlineRenderer(
                (messageConfig) => {
                    if (this.warningDisplay) {
                        this.warningDisplay.show(messageConfig);
                    }
                },
                () => {
                    if (this.warningDisplay) {
                        this.warningDisplay.clear();
                    }
                    this.lastSystemMessage = null;
                },
            );
        }
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

        if (this.challengeHubInstance) {
            this.challengeHubInstance.handleStateChange(currentState, this.previousState);
        }
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
        const wasInStandaloneMode = previousDisplayMode === 'standalone';
        const isInStandaloneMode = currentDisplayMode === 'standalone';

        const wasQuizVisible = wasQuizActive || wasInReviewMode || wasInStandaloneMode;
        const isQuizVisible = isQuizActive || isInReviewMode || isInStandaloneMode;

        if (!wasQuizVisible && isQuizVisible) {
            this.displayQuizLayout(true);
        }

        if ((wasQuizVisible || wasQuizEnded) && !isQuizVisible && !isQuizEnded) {
            this.displayQuizLayout(false);
        }
    
        const prevQuestionIndex = this.previousState.quiz?.currentQuestionIndex ?? -1;
        if ((isQuizActive || isInStandaloneMode) && currentState.quiz.currentQuestionIndex !== prevQuestionIndex) {
            this._handleQuestionChange(currentState);
        }
    
        const prevQuestionState = this.previousState.quiz?.currentQuestionsSet[prevQuestionIndex];
        const currentQuestionState = currentState.quiz.currentQuestionsSet[currentState.quiz.currentQuestionIndex];
    
        if (currentQuestionState && currentQuestionState.respostaDadaId !== prevQuestionState?.respostaDadaId && currentQuestionState.respostaDadaId !== undefined && currentQuestionState.respostaDadaId !== null) {
            this._handleAnsweredQuestion(currentQuestionState);
        }
    
        if (!wasQuizEnded && isQuizEnded) {
            this.questionDisplay?.resetBrowserUrl();
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
            scorePanelToggle: document.getElementById('score-panel-toggle'),
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),
            sequenciaDisplay: document.getElementById('sequencia-numero'),
            multiplicadorDisplay: document.getElementById('multiplicador-atual'),
            timerDisplay: document.getElementById('timer-display'),
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'),
            scorePanelControls: document.getElementById('score-panel-controls'),
            btnTogglePause: document.getElementById('btn-toggle-pausa'),
            btnTogglePauseLabel: document.getElementById('btn-toggle-pausa-label'),
            btnTogglePauseIcon: document.getElementById('btn-toggle-pausa-icon'),
            challengeHubContainer: document.getElementById('challenge-hub-container'),
            hubTotalQuestionsCount: document.getElementById('hub-total-questions-count'),
            challengeStatTotal: document.getElementById('challenge-stat-total'),
            hubQuickQuizCount: document.getElementById('hub-quick-quiz-count'),
            hubCustomizeQuizBtn: document.getElementById('hub-customize-quiz-btn'),
            hubQuickQuizBtn: document.getElementById('hub-quick-quiz-btn'),
            hubSmartDrillBtn: document.getElementById('hub-smart-drill-btn'),
            hubTimedQuizBtn: document.getElementById('hub-timed-quiz-btn'),
            hubFavoriteReviewBtn: document.getElementById('hub-favorite-review-btn'),
            hubRepeatLastBtn: document.getElementById('hub-repeat-last-btn'),
            hubPredefinedSection: document.getElementById('hub-predefined-section'),
            hubPredefinedList: document.getElementById('hub-predefined-list'),
            placeholderFiltrosContainer: document.getElementById('placeholder-filtros-container'),
            closeFiltersAndShowHubBtn: document.getElementById('close-filters-and-show-hub-btn'),
            avisoContainer: document.getElementById('aviso-container'),
            avisoTitle: document.querySelector('#aviso-container [data-role="message-title"]'),
            avisoBody: document.querySelector('#aviso-container [data-role="message-body"]'),
            avisoSupporting: document.querySelector('#aviso-container [data-role="message-supporting"]'),
            avisoFeatureList: document.querySelector('#aviso-container [data-role="message-feature-list"]'),
            avisoActions: document.querySelector('#aviso-container [data-role="message-actions"]'),
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
            questionReportButton: document.getElementById('question-report-button'),
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
            resultadoDailyWrapper: document.getElementById('resultado-daily-wrapper'),
            resultadoDailyStreak: document.getElementById('resultado-daily-streak'),
            resultadoDailyQuestions: document.getElementById('resultado-daily-questions'),
            resultadoDailyXp: document.getElementById('resultado-daily-xp'),
            resultadoDailyStatus: document.getElementById('resultado-daily-status'),
            resultadoUpcomingWrapper: document.getElementById('resultado-proximas-conquistas'),
            resultadoUpcomingList: document.getElementById('resultado-proximas-lista'),
            resultadoUpcomingEmpty: document.getElementById('resultado-proximas-empty'),
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
            sessionLoadingIndicator: document.getElementById('session-loading-indicator'),
            sessionLoadingMessage: document.getElementById('session-loading-message'),
            reportIssueOverlay: document.getElementById('report-issue-overlay'),
            reportIssueDialog: document.getElementById('report-issue-dialog'),
            reportIssueForm: document.getElementById('report-issue-form'),
            reportIssueTextarea: document.getElementById('report-issue-text'),
            reportIssueCancelBtn: document.getElementById('report-issue-cancel'),
            reportIssueSubmitBtn: document.getElementById('report-issue-submit'),
            reportIssueQuestionLabel: document.getElementById('report-issue-question-label'),
            reportIssueError: document.getElementById('report-issue-error'),
            reportIssueCounter: document.getElementById('report-issue-counter'),
            reportIssueTypeSummary: document.getElementById('report-issue-type-summary'),
            supportRequestOverlay: document.getElementById('support-request-overlay'),
            supportRequestDialog: document.getElementById('support-request-dialog'),
            supportRequestForm: document.getElementById('support-request-form'),
            supportRequestEmailInput: document.getElementById('support-request-email'),
            supportRequestTextarea: document.getElementById('support-request-message'),
            supportRequestCancelBtn: document.getElementById('support-request-cancel'),
            supportRequestSubmitBtn: document.getElementById('support-request-submit'),
            supportRequestError: document.getElementById('support-request-error'),
            supportRequestCounter: document.getElementById('support-request-counter'),
            supportRequestContextLabel: document.getElementById('support-request-context-label'),

            // --- INÍCIO DA ALTERAÇÃO: Remoção dos elementos do banner antigo ---
            // resumeBannerContainer: document.getElementById('resume-banner-container'),
            // resumeBannerQuestionCount: document.getElementById('resume-banner-question-count'),
            // btnBannerConfirmResume: document.getElementById('btn-banner-confirm-resume'),
            // btnBannerDiscardResume: document.getElementById('btn-banner-discard-resume'),
            // --- FIM DA ALTERAÇÃO ---
        };

        this.elements.supportRequestTypeSummary = document.getElementById('support-request-type-summary');
        this.elements.supportRequestTypeInputs = Array.from(
            document.querySelectorAll('input[name="support-request-type"]'),
        );
        this.elements.reportIssueTypeInputs = Array.from(
            document.querySelectorAll('input[name="report-issue-category"]'),
        );
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
        const { placeholderFiltrosContainer, quizSectionContent } = this.elements;
        const displayMode = this.store?.getState()?.quiz?.quizDisplayContext?.displayMode || 'challenge';

        const bodyElement = document.body;

        if (bodyElement) {
            if (showQuizLayout) {
                bodyElement.classList.add('is-quiz-active');
                bodyElement.classList.remove('is-challenge-hub-active');
            } else {
                bodyElement.classList.remove('is-quiz-active');
                bodyElement.classList.add('is-challenge-hub-active');
            }
        }

        if (showQuizLayout) {
            if (this.scorePanel) {
                if (displayMode === 'review') this.scorePanel.hide();
                else this.scorePanel.show();
            }
            if (this.challengeHubInstance) this.challengeHubInstance.hideHub();
            this.showElement(quizSectionContent);
            this.clearInlineMessages();
            this.hideElement(placeholderFiltrosContainer);
            if (this.resultDisplay) this.resultDisplay.hide();
            // --- INÍCIO DA ALTERAÇÃO: Remoção da chamada ao banner antigo ---
            // this.hideElement(this.elements.resumeBannerContainer);
            // --- FIM DA ALTERAÇÃO ---
        } else {
            this.questionDisplay?.resetBrowserUrl();
            if (this.scorePanel) this.scorePanel.hide();
            this.hideElement(quizSectionContent);
            if (this.resultDisplay) this.resultDisplay.hide();

            if (this.challengeHubInstance) this.challengeHubInstance.showHub();
            this.hideElement(placeholderFiltrosContainer);
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
                this.clearInlineMessages();
                document.body.classList.add('session-loading');
                if (this.modalManager && typeof this.modalManager.ensureScrollLock === 'function') {
                    this.modalManager.ensureScrollLock();
                } else if (typeof document !== 'undefined') {
                    const scrollbarWidth = typeof window !== 'undefined'
                        ? Math.max(0, window.innerWidth - document.documentElement.clientWidth)
                        : 0;
                    if (scrollbarWidth > 0) {
                        document.body.style.setProperty('--scroll-lock-compensation', `${scrollbarWidth}px`);
                    }
                    document.body.classList.add('no-scroll');
                }
            } else {
                this.elements.sessionLoadingIndicator.classList.remove('modal--visible');
                setTimeout(() => {
                     if (!this.elements.sessionLoadingIndicator.classList.contains('modal--visible')) {
                        this.hideElement(this.elements.sessionLoadingIndicator);
                     }
                }, 300);
                document.body.classList.remove('session-loading');
                if (this.modalManager && typeof this.modalManager.releaseScrollLock === 'function') {
                    this.modalManager.releaseScrollLock();
                } else if (typeof document !== 'undefined') {
                    document.body.classList.remove('no-scroll');
                    document.body.style.removeProperty('--scroll-lock-compensation');
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

        this.elements.reportIssueForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!this.actionOrchestrator) return;
            const textarea = this.elements.reportIssueTextarea;
            const description = textarea ? textarea.value.trim() : '';
            if (description.length < 10) {
                this.handleReportIssueError('Descreva o problema com pelo menos 10 caracteres.');
                return;
            }
            if (!Number.isInteger(this.currentReportQuestionId) || this.currentReportQuestionId <= 0) {
                this.handleReportIssueError('Nao foi possivel identificar a questao selecionada.');
                return;
            }
            this.handleReportIssueError('');
            const selectedCategory = this.getSelectedReportIssueCategory();
            this.actionOrchestrator.submitIssueReport(
                this.currentReportQuestionId,
                description,
                selectedCategory,
            );
        });

        this.elements.reportIssueCancelBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            this.closeReportIssueModal();
        });

        this.elements.reportIssueTextarea?.addEventListener('input', () => {
            this.updateReportIssueCounter();
            if (this.elements.reportIssueError) {
                this.elements.reportIssueError.textContent = '';
            }
            if (this.elements.reportIssueTextarea) {
                this.elements.reportIssueTextarea.removeAttribute('aria-invalid');
            }
        });

        if (Array.isArray(this.elements.reportIssueTypeInputs) && this.elements.reportIssueTypeInputs.length) {
            this.elements.reportIssueTypeInputs.forEach((input) => {
                input.addEventListener('change', () => {
                    this.updateReportIssueTypeSummary();
                });
            });
        }
        this.updateReportIssueTypeSummary();

        this.elements.supportRequestForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!this.actionOrchestrator) return;

            const messageField = this.elements.supportRequestTextarea;
            const emailField = this.elements.supportRequestEmailInput;

            const messageValue = messageField ? messageField.value.trim() : '';
            if (messageValue.length < 10) {
                this.handleSupportRequestError('Descreva sua reclamação com pelo menos 10 caracteres.');
                return;
            }

            const emailValue = emailField ? emailField.value.trim() : '';
            const context = this.buildSupportRequestContext();
            const origin = this.currentSupportMessageMeta ? 'inline_message' : null;
            const selectedType = this.getSelectedSupportRequestType();

            this.handleSupportRequestError('');
            this.actionOrchestrator.submitSupportRequest({
                message: messageValue,
                email: emailValue,
                origin,
                context,
                tipo: selectedType,
            });
        });

        this.elements.supportRequestCancelBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            this.closeSupportRequestModal();
        });

        this.elements.supportRequestTextarea?.addEventListener('input', () => {
            this.updateSupportRequestCounter();
            this.handleSupportRequestError('');
        });

        this.elements.supportRequestEmailInput?.addEventListener('input', () => {
            if (this.elements.supportRequestError) {
                this.elements.supportRequestError.textContent = '';
            }
        });

        if (Array.isArray(this.elements.supportRequestTypeInputs) && this.elements.supportRequestTypeInputs.length) {
            this.elements.supportRequestTypeInputs.forEach((input) => {
                input.addEventListener('change', () => {
                    this.updateSupportRequestTypeSummary();
                });
            });
        }
        this.updateSupportRequestTypeSummary();
    }

    openReportIssueModal(questionData, fallbackId = null) {
        const candidateId = (questionData && (questionData.id_pergunta ?? questionData.id)) ?? fallbackId;
        const normalizedId = Number.parseInt(candidateId, 10);
        if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
            this.showWarning('Nao foi possivel identificar a questao para relatar.', 'warning');
            return;
        }

        this.currentReportQuestionId = normalizedId;

        if (this.elements.reportIssueForm) {
            this.elements.reportIssueForm.reset();
        }

        const textarea = this.elements.reportIssueTextarea;
        if (textarea) {
            textarea.value = '';
            textarea.disabled = false;
            textarea.removeAttribute('aria-invalid');
        }

        const errorLabel = this.elements.reportIssueError;
        if (errorLabel) {
            errorLabel.textContent = '';
        }

        const questionLabel = this.elements.reportIssueQuestionLabel;
        if (questionLabel) {
            let label = `Questao #${normalizedId}`;
            if (questionData && typeof questionData.texto_pergunta === 'string') {
                const preview = questionData.texto_pergunta.replace(/\s+/g, ' ').trim();
                if (preview) {
                    const shortened = preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;
                    label = `${label} - ${shortened}`;
                }
            }
            questionLabel.textContent = label;
        }

        this.updateReportIssueTypeSummary();
        this.updateReportIssueCounter();
        this.setReportIssueLoading(false);
        if (this.modalManager && typeof this.modalManager.toggleFilterPanel === 'function') {
            this.modalManager.toggleFilterPanel(false);
        }
        this.modalManager?.toggleReportIssueModal(true);
    }

    closeReportIssueModal() {
        this.modalManager?.toggleReportIssueModal(false);
        this.setReportIssueLoading(false);
        this.currentReportQuestionId = null;
        if (this.elements.reportIssueForm) {
            this.elements.reportIssueForm.reset();
        }
        if (this.elements.reportIssueTextarea) {
            this.elements.reportIssueTextarea.disabled = false;
            this.elements.reportIssueTextarea.removeAttribute('aria-invalid');
        }
        if (this.elements.reportIssueCancelBtn) {
            this.elements.reportIssueCancelBtn.disabled = false;
        }

        this.updateReportIssueTypeSummary();
    }

    setReportIssueLoading(isLoading) {
        this.setButtonLoading(this.elements.reportIssueSubmitBtn, isLoading);
        if (this.elements.reportIssueTextarea) {
            this.elements.reportIssueTextarea.disabled = Boolean(isLoading);
        }
        if (this.elements.reportIssueCancelBtn) {
            this.elements.reportIssueCancelBtn.disabled = Boolean(isLoading);
        }
        if (Array.isArray(this.elements.reportIssueTypeInputs)) {
            this.elements.reportIssueTypeInputs.forEach((input) => {
                input.disabled = Boolean(isLoading);
            });
        }
    }

    handleReportIssueError(message) {
        if (this.elements.reportIssueError) {
            this.elements.reportIssueError.textContent = message || '';
        }
        if (this.elements.reportIssueTextarea) {
            if (message) {
                this.elements.reportIssueTextarea.setAttribute('aria-invalid', 'true');
            } else {
                this.elements.reportIssueTextarea.removeAttribute('aria-invalid');
            }
        }
    }

    handleReportIssueSuccess() {
        this.handleReportIssueError('');
        this.closeReportIssueModal();
        if (typeof this.showToast === 'function') {
            this.showToast('Relato enviado com sucesso. Obrigado!', 'success', { dismissIn: 4000 });
        }
    }

    updateReportIssueCounter() {
        if (!this.elements.reportIssueTextarea || !this.elements.reportIssueCounter) {
            return;
        }
        const value = this.elements.reportIssueTextarea.value || '';
        const maxLength = this.elements.reportIssueTextarea.getAttribute('maxlength');
        if (maxLength) {
            this.elements.reportIssueCounter.textContent = `${value.length}/${maxLength}`;
        } else {
            this.elements.reportIssueCounter.textContent = `${value.length} caracteres`;
        }
    }

    getSelectedReportIssueCategory() {
        if (!Array.isArray(this.elements.reportIssueTypeInputs)) {
            return null;
        }
        const selectedInput = this.elements.reportIssueTypeInputs.find((input) => input.checked);
        return selectedInput ? selectedInput.value : null;
    }

    updateReportIssueTypeSummary() {
        const inputs = this.elements.reportIssueTypeInputs;
        const summaryElement = this.elements.reportIssueTypeSummary;
        if (!Array.isArray(inputs)) {
            return;
        }

        let selectedValue = null;
        let selectedChip = null;
        inputs.forEach((input) => {
            const isSelected = Boolean(input.checked);
            if (isSelected) {
                selectedValue = input.value;
                selectedChip = input.closest('.report-issue-chip') || null;
            }
            const container = input.closest('.report-issue-chip');
            if (container) {
                container.dataset.selected = isSelected ? 'true' : 'false';
            }
        });

        if (summaryElement) {
            const summaryText = selectedChip?.dataset.summary || this._resolveReportIssueTypeSummary(selectedValue);
            const summaryIcon = selectedChip?.dataset.icon || this._resolveReportIssueTypeIcon(selectedValue);

            summaryElement.innerHTML = '';
            if (summaryIcon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'material-symbols-outlined report-issue-summary__icon';
                iconSpan.textContent = summaryIcon;
                summaryElement.appendChild(iconSpan);
            }
            if (summaryText) {
                const textSpan = document.createElement('span');
                textSpan.className = 'report-issue-summary__text';
                textSpan.textContent = summaryText;
                summaryElement.appendChild(textSpan);
            }
        }
    }

    _resolveReportIssueTypeSummary(value) {
        switch (value) {
            case 'statement':
                return 'Detalhe qual trecho do enunciado deve ser revisado.';
            case 'option_issue':
                return 'Identifique as alternativas afetadas e o ajuste sugerido.';
            case 'reference_issue':
                return 'Informe a referência correta ou motivo da divergência.';
            case 'other':
                return 'Descreva, com exemplos, o que encontrou de diferente.';
            case 'answer_key':
            default:
                return 'Informe a alternativa correta esperada e a evidência utilizada.';
        }
    }

    _resolveReportIssueTypeIcon(value) {
        switch (value) {
            case 'statement':
                return 'segment';
            case 'option_issue':
                return 'splitscreen';
            case 'reference_issue':
                return 'library_books';
            case 'other':
                return 'lightbulb';
            case 'answer_key':
            default:
                return 'fact_check';
        }
    }

    buildSupportRequestContext() {
        const context = {};
        const bodyElement = document.body;

        if (bodyElement?.dataset?.pageId) {
            context.page_id = bodyElement.dataset.pageId;
        }

        if (typeof window !== 'undefined' && window.location) {
            context.page_url = window.location.href;
        }

        if (this.currentSupportMessageMeta) {
            const { key, title, body, detail } = this.currentSupportMessageMeta;
            if (key) context.message_key = key;
            if (title) context.message_title = title;
            if (body) context.message_body = body;
            if (detail) context.message_detail = detail;
        }

        return Object.keys(context).length > 0 ? context : null;
    }

    openSupportRequestModal(triggerMeta = null) {
        this.currentSupportMessageMeta = triggerMeta;

        if (this.elements.supportRequestForm) {
            this.elements.supportRequestForm.reset();
        }

        const textarea = this.elements.supportRequestTextarea;
        if (textarea) {
            textarea.disabled = false;
            textarea.removeAttribute('aria-invalid');
        }

        const emailInput = this.elements.supportRequestEmailInput;
        if (emailInput) {
            emailInput.disabled = false;
        }

        const label = this.elements.supportRequestContextLabel;
        if (label) {
            const labelText = this._resolveSupportRequestContextLabel(triggerMeta);
            label.textContent = labelText;
            label.classList.toggle('u-is-hidden', !labelText);
        }
        this.handleSupportRequestError('');
        this.setSupportRequestLoading(false);
        this.updateSupportRequestCounter();
        this.updateSupportRequestTypeSummary();

        if (this.modalManager && typeof this.modalManager.toggleSupportRequestModal === 'function') {
            this.modalManager.toggleSupportRequestModal(true);
        }
    }

    closeSupportRequestModal() {
        this.handleSupportRequestError('');
        if (this.modalManager && typeof this.modalManager.toggleSupportRequestModal === 'function') {
            this.modalManager.toggleSupportRequestModal(false);
        }

        this.setSupportRequestLoading(false);

        if (this.elements.supportRequestForm) {
            this.elements.supportRequestForm.reset();
        }

        if (this.elements.supportRequestTextarea) {
            this.elements.supportRequestTextarea.disabled = false;
            this.elements.supportRequestTextarea.removeAttribute('aria-invalid');
        }
        if (this.elements.supportRequestEmailInput) {
            this.elements.supportRequestEmailInput.disabled = false;
        }
        this.updateSupportRequestCounter();
        this.updateSupportRequestTypeSummary();

        this.currentSupportMessageMeta = null;
    }

    setSupportRequestLoading(isLoading) {
        this.setButtonLoading(this.elements.supportRequestSubmitBtn, isLoading);
        if (this.elements.supportRequestTextarea) {
            this.elements.supportRequestTextarea.disabled = Boolean(isLoading);
        }
        if (this.elements.supportRequestEmailInput) {
            this.elements.supportRequestEmailInput.disabled = Boolean(isLoading);
        }
        if (this.elements.supportRequestCancelBtn) {
            this.elements.supportRequestCancelBtn.disabled = Boolean(isLoading);
        }
        if (Array.isArray(this.elements.supportRequestTypeInputs)) {
            this.elements.supportRequestTypeInputs.forEach((input) => {
                input.disabled = Boolean(isLoading);
            });
        }
    }

    handleSupportRequestError(message) {
        if (this.elements.supportRequestError) {
            this.elements.supportRequestError.textContent = message || '';
        }
        if (this.elements.supportRequestTextarea) {
            if (message) {
                this.elements.supportRequestTextarea.setAttribute('aria-invalid', 'true');
            } else {
                this.elements.supportRequestTextarea.removeAttribute('aria-invalid');
            }
        }
    }

    handleSupportRequestSuccess(message = null) {
        this.handleSupportRequestError('');
        this.closeSupportRequestModal();
        const toastMessage = message || 'Mensagem enviada com sucesso. Obrigado!';
        if (typeof this.showToast === 'function') {
            this.showToast(toastMessage, 'success', { dismissIn: 4000 });
        }
    }

    updateSupportRequestCounter() {
        if (!this.elements.supportRequestTextarea || !this.elements.supportRequestCounter) {
            return;
        }
        const value = this.elements.supportRequestTextarea.value || '';
        const maxLength = this.elements.supportRequestTextarea.getAttribute('maxlength');
        if (maxLength) {
            this.elements.supportRequestCounter.textContent = `${value.length}/${maxLength}`;
        } else {
            this.elements.supportRequestCounter.textContent = `${value.length} caracteres`;
        }
    }

    getSelectedSupportRequestType() {
        if (!Array.isArray(this.elements.supportRequestTypeInputs)) {
            return null;
        }
        const selectedInput = this.elements.supportRequestTypeInputs.find((input) => input.checked);
        return selectedInput ? selectedInput.value : null;
    }

    updateSupportRequestTypeSummary() {
        const inputs = this.elements.supportRequestTypeInputs;
        const summaryElement = this.elements.supportRequestTypeSummary;
        if (!Array.isArray(inputs) || !summaryElement) {
            return;
        }

        let selectedValue = null;
        inputs.forEach((input) => {
            const isSelected = Boolean(input.checked);
            if (isSelected) {
                selectedValue = input.value;
            }
            const optionContainer = input.closest('.support-request-type-option');
            if (optionContainer) {
                optionContainer.dataset.selected = isSelected ? 'true' : 'false';
            }
        });

        summaryElement.textContent = this._resolveSupportRequestTypeSummary(selectedValue);
    }

    _resolveSupportRequestTypeSummary(value) {
        switch (value) {
            case 'technical_issue':
                return 'Nossa equipe técnica vai investigar travamentos, lentidões ou mensagens de erro inesperadas.';
            case 'content_error':
                return 'Inclua o título da questão, alternativa e motivação para facilitar a correção do conteúdo.';
            case 'improvement':
                return 'Compartilhe ideias de novas funcionalidades, ajustes visuais ou experiências desejadas.';
            case 'general':
            default:
                return 'Use este canal para tirar dúvidas gerais sobre o MedQuiz ou receber orientação personalizada.';
        }
    }

    _resolveSupportRequestContextLabel(meta) {
        if (!meta) {
            return '';
        }
        const { title, body, key, detail } = meta;
        const primary = title || body || key || '';
        if (!primary) {
            return '';
        }
        if (detail && detail !== primary) {
            return `Referência: ${primary} — ${detail}`;
        }
        return `Referência: ${primary}`;
    }

    showWarning(messageInput, type = 'warning', isTextCentered = false) {
        const resolveOptions = {
            defaultType: type,
            defaultCentered: isTextCentered,
        };

        let messageConfig = null;

        if (this.messageCenter) {
            messageConfig = this.messageCenter.showInline(messageInput, resolveOptions);
        } else {
            messageConfig = resolveSystemMessage(messageInput, resolveOptions);

            if (!messageConfig.body && typeof messageInput === 'string') {
                messageConfig.body = messageInput;
            }

            if (!messageConfig.supportingText && messageConfig.detail) {
                messageConfig.supportingText = messageConfig.detail;
            }

            if (!messageConfig.type) {
                messageConfig.type = type;
            }

            if (typeof messageConfig.isTextCentered !== 'boolean') {
                messageConfig.isTextCentered = isTextCentered;
            }

            if (this.warningDisplay) {
                this.warningDisplay.show(messageConfig);
            } else {
                const fallbackText = messageConfig.body
                    || messageConfig.supportingText
                    || (typeof messageInput === 'string' ? messageInput : '');
                const effectiveType = messageConfig.type || type || 'info';

                if (fallbackText) {
                    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                        window.alert(`[${effectiveType.toUpperCase()}] ${fallbackText}`);
                    } else {
                        console.warn(`Mensagem (${effectiveType}):`, fallbackText);
                    }
                } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                    window.alert(`[${effectiveType.toUpperCase()}] Aviso exibido.`);
                }
            }
        }

        this.lastSystemMessage = messageConfig;
        return messageConfig;
    }

    showToast(messageInput, type = 'info', options = {}) {
        const resolveOptions = {
            defaultType: type,
            defaultCentered: options.defaultCentered ?? false,
        };

        if (this.messageCenter) {
            return this.messageCenter.showToast(messageInput, {
                resolveOptions,
                autoDismiss: options.autoDismiss !== undefined ? options.autoDismiss : true,
                dismissIn: options.dismissIn,
            });
        }

        const messageConfig = resolveSystemMessage(messageInput, resolveOptions);
        const fallbackText = messageConfig.body
            || messageConfig.supportingText
            || (typeof messageInput === 'string' ? messageInput : '');

        if (fallbackText && typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(fallbackText);
        } else if (fallbackText) {
            console.info('Toast:', fallbackText);
        }

        return null;
    }

    clearInlineMessages() {
        if (this.messageCenter) {
            this.messageCenter.clearInline();
        } else if (this.warningDisplay) {
            this.warningDisplay.clear();
        }

        this.lastSystemMessage = null;
    }

    handleSystemMessageAction(actionId) {
        switch (actionId) {
            case 'openFilters':
                if (this.modalManager && typeof this.modalManager.toggleFilterPanel === 'function') {
                    this.modalManager.toggleFilterPanel(true);
                }
                break;
            case 'returnToHub':
                this.clearInlineMessages();
                this.displayQuizLayout(false);
                break;
            case 'retryLastQuiz':
                if (this.actionOrchestrator && typeof this.actionOrchestrator.retryLastQuizRequest === 'function') {
                    this.actionOrchestrator.retryLastQuizRequest();
                }
                break;
            case 'reloadPage':
                if (typeof window !== 'undefined') {
                    window.location.reload();
                }
                break;
            case 'contactSupport':
                this.openSupportRequestModal(
                    this.lastSystemMessage
                        ? {
                            key: this.lastSystemMessage.key || null,
                            title: this.lastSystemMessage.title || null,
                            body: this.lastSystemMessage.body || null,
                            detail: this.lastSystemMessage.detail || null,
                        }
                        : null,
                );
                break;
            case 'goToLogin':
                if (typeof window !== 'undefined') {
                    const nextParam = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
                    window.location.assign(`/accounts/login/?next=${nextParam}`);
                }
                break;
            case 'goToRegister':
                if (typeof window !== 'undefined') {
                    window.location.assign('/register/');
                }
                break;
            default:
                console.warn(`QuizUI: ação de mensagem desconhecida recebida: ${actionId}`);
        }
    }
}
