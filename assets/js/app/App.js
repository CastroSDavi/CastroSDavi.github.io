// File: assets/js/app/App.js

import UserData from './data/UserData.js';
import QuizData from './data/QuizData.js';
import QuizState from './core/QuizState.js';
import QuizLogic from './core/QuizLogic.js';
import ApiService from './services/ApiService.js'; // Certifique-se que o caminho está correto

import QuizUI from '../ui/QuizUI.js';
import ChallengeHub from '../ui/ChallengeHub.js';
import LayoutManager from '../ui/LayoutManager.js';
import FilterPanel from '../ui/FilterPanel.js';
import ResultDisplay from '../ui/ResultDisplay.js';
import AccountPageManager from '../ui/AccountPageManager.js';

import { QUICK_QUIZ_COUNT } from '../utils/constants.js';

export default class App {
    constructor() {
        // 1. Serviços e Dados
        this.apiService = new ApiService(); // Instancia o ApiService
        // console.log("App.js: ApiService instance in App constructor:", this.apiService);

        this.userData = new UserData();
        this.quizData = new QuizData(this.apiService);
        this.quizState = new QuizState();

        // 2. Gerenciadores de UI de Alto Nível e Componentes Principais
        this.layoutManager = new LayoutManager();
        this.quizUI = new QuizUI(
            this.layoutManager.handleActiveSectionChange.bind(this.layoutManager)
        );

        // 3. Injeta dependências básicas em QuizUI
        this.quizUI.setQuizState(this.quizState);
        this.quizUI.setQuizData(this.quizData);
        this.quizUI.setApiService(this.apiService); // Passa ApiService para QuizUI

        // 4. Instanciar componentes de UI que QuizUI gerencia ou coordena
        if (this.quizUI.elements.filterPanel) {
            const filterPanel = new FilterPanel(
                this.quizUI.elements.filterPanel,
                null, 
                this.quizState,
                this.quizData,
                this.quizUI,
                this.apiService // Passa ApiService para FilterPanel
            );
            this.quizUI.setFilterPanelInstance(filterPanel);
        }

        if (this.quizUI.elements.challengeHubContainer) {
            const challengeHub = new ChallengeHub(this.quizUI);
            this.quizUI.setChallengeHubInstance(challengeHub);
        }

        const resultDisplay = new ResultDisplay(this.quizUI, this.quizUI.timer);
        this.quizUI.setResultDisplayInstance(resultDisplay);

        // 5. Lógica Principal do Quiz
        this.quizLogic = new QuizLogic(
            this.quizState,
            this.quizUI,
            this.userData,
            this.quizData,
            this.apiService // Passa ApiService para QuizLogic
        );

        // 6. Injeção de dependências cruzadas finais
        if (this.quizUI.filterPanelInstance) {
            this.quizUI.filterPanelInstance.quizLogic = this.quizLogic;
        }
        if (this.quizUI.challengeHubInstance) {
            this.quizUI.challengeHubInstance.setQuizLogic(this.quizLogic);
        }

        this.quizUI.setCallbacks({
            answerQuestionCallback: this.quizLogic.answerQuestion.bind(this.quizLogic),
            navigationCallback: this.quizLogic._handleQuestionNavigation.bind(this.quizLogic),
            toggleFavoriteCallback: this.quizLogic.toggleFavoriteCurrentQuestion.bind(this.quizLogic),
            endSessionCallback: () => {
                if (this.quizUI.modalManager) this.quizUI.modalManager.toggleConfirmModal(true);
            },
            restartQuizCallback: this.quizLogic.restartQuiz.bind(this.quizLogic),
        });

        // 7. Instanciar AccountPageManager, passando a instância do ApiService
        this.accountPageManager = new AccountPageManager(this.quizUI, this.apiService);
        // console.log("App.js: AccountPageManager instance created, its ApiService:", this.accountPageManager.apiService);
    }

    async initialize() {
        // console.log("App.js: initialize() - Starting application initialization...");
        try {
            const initialDataLoaded = await this.quizData.fetchInitialData();

            if (initialDataLoaded) {
                // console.log("App.js: Initial quiz data loaded successfully.");
                if (this.quizUI.challengeHubInstance) {
                    this.quizUI.challengeHubInstance.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub());
                    this.quizUI.challengeHubInstance.updateQuickQuizCount(QUICK_QUIZ_COUNT);
                }

                this.setupEventListeners();
                this.determineInitialSection();

                if (document.body.dataset.pageId === 'account') {
                    // console.log("App.js: Current page is 'account'. Initializing AccountPageManager...");
                    this.accountPageManager.init();
                }
                // console.log("App.js: Application initialized successfully.");
            } else {
                console.error("App.js: Failed to load initial quiz data.");
                this.handleLoadError("Não foi possível carregar os dados essenciais do quiz. A aplicação pode não funcionar como esperado.");
            }
        } catch (error) {
            console.error("App.js: Critical error during initialization:", error);
            this.handleLoadError(`Erro crítico ao inicializar o MedQuiz: ${error.message}. Por favor, tente recarregar a página.`);
        }
    }

    setupEventListeners() {
        // console.log("App.js: setupEventListeners() - Setting up global event listeners...");
        if (this.quizUI) {
            this.quizUI.setupGlobalEventListeners(this.quizLogic);
        }
        if (this.quizUI.filterPanelInstance) {
            this.quizUI.filterPanelInstance.setupEventListeners();
        }
        if (this.quizUI.challengeHubInstance) {
            this.quizUI.challengeHubInstance.setupEventListeners();
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                let modalHandled = false;
                if (this.quizUI?.modalManager) {
                    modalHandled = this.quizUI.modalManager.handleEscapeKey();
                }
                if (!modalHandled && this.accountPageManager && document.body.dataset.pageId === 'account') {
                    if (this.accountPageManager.elements.deleteAccountModalOverlay?.classList.contains('modal--visible')) {
                         this.accountPageManager._toggleDeleteAccountModal(false);
                    }
                }
            }
        });
    }

    determineInitialSection() {
        // console.log("App.js: determineInitialSection() - Determining initial visible section...");
        if (!this.quizUI || !this.quizUI.elements) {
            console.error("App.determineInitialSection: QuizUI ou seus elementos não estão definidos.");
            return;
        }
    
        const { homeSection, questionSection, accountSection, quizSectionContent, scorePanel, resultadoCard, placeholderFiltrosContainer } = this.quizUI.elements;
        const bodyEl = document.body;
        const bodyPageId = bodyEl.dataset.pageId;
    
        [homeSection, questionSection, accountSection, quizSectionContent, scorePanel, resultadoCard, placeholderFiltrosContainer].forEach(el => {
            if (el) this.quizUI.hideElement(el);
        });
    
        let activeSectionIdForLayoutManager = 'unknown';
    
        if (bodyPageId === 'home' && homeSection) {
            this.quizUI.currentSection = 'home-section';
            activeSectionIdForLayoutManager = 'home';
            this.quizUI.showElement(homeSection);
        } else if (bodyPageId === 'questions' && questionSection) {
            this.quizUI.currentSection = 'question-section';
            activeSectionIdForLayoutManager = 'questions';
            this.quizUI.showElement(questionSection);
            if (this.quizUI.challengeHubInstance) {
                this.quizUI.challengeHubInstance.showHub();
            }
        } else if (bodyPageId === 'account' && accountSection) {
            this.quizUI.currentSection = 'account-section-page';
            activeSectionIdForLayoutManager = 'account';
            this.quizUI.showElement(accountSection);
        } else {
            if (homeSection) { 
                this.quizUI.currentSection = 'home-section';
                activeSectionIdForLayoutManager = 'home';
                this.quizUI.showElement(homeSection);
            } else {
                // console.warn("App.js: No suitable initial section found.");
            }
        }
    
        if (bodyPageId !== 'account') {
            bodyEl.classList.remove('no-scroll');
            if(this.accountPageManager) this.accountPageManager._adjustBodyPaddingForBottomNav();
        }
    
        if (this.layoutManager) {
            this.layoutManager.handleActiveSectionChange(activeSectionIdForLayoutManager);
        }
    
        if (activeSectionIdForLayoutManager === 'home' && this.quizData.isInitialFetchDone) {
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
            if (totalQuestionsSpanHome && this.quizUI.elements.hubTotalQuestionsCount !== totalQuestionsSpanHome) {
                totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub()?.toLocaleString('pt-BR') || '0';
            }
        }
    }
    
    handleLoadError(message) {
        console.error("App.js: handleLoadError - ", message);
        try {
            const mainContent = document.querySelector('main') || document.body;
            let errorDisplay = mainContent.querySelector('.app-critical-error-display');
            if (!errorDisplay) {
                errorDisplay = document.createElement('div');
                errorDisplay.className = 'app-critical-error-display card';
                errorDisplay.style.cssText = `
                    padding: var(--spacing-lg, 30px); margin: var(--spacing-xl, 40px) auto;
                    max-width: 600px; background-color: var(--color-incorrect-bg, #fff0f1);
                    color: var(--color-incorrect-text, #c12634); border: 1px solid var(--color-incorrect-border, #f1aeb5);
                    border-radius: var(--border-radius-lg, 12px); text-align: center;
                    font-family: var(--font-family-sans, sans-serif); z-index: 9999; position: relative;
                `;
                if (mainContent.firstChild && mainContent !== document.body) {
                    mainContent.insertBefore(errorDisplay, mainContent.firstChild);
                } else {
                    document.body.insertBefore(errorDisplay, document.body.firstChild);
                }
            }
            errorDisplay.innerHTML = `
                <h2 class="card__title" style="color: inherit; font-size: 1.5rem; margin-bottom: 15px;">Falha ao Carregar</h2>
                <p style="margin-bottom: 10px; line-height: 1.6;">${message}</p>
                <p style="font-size: 0.9em;">Por favor, tente recarregar a página. Se o problema persistir, o serviço pode estar temporariamente indisponível.</p>
            `;
            this.disableCoreFunctionality();
        } catch (uiError) {
            console.error("App.js: Error displaying critical load error to UI:", uiError);
            document.body.innerHTML = `<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:white; color:red; padding:20px; text-align:center; z-index:10000; font-family:sans-serif;"><h1>Erro Crítico</h1><p>${message}</p></div>`;
        }
    }

    disableCoreFunctionality() {
        // console.warn("App.js: disableCoreFunctionality() - Disabling core app features due to error.");
        if (this.quizUI && this.quizUI.elements) {
            if (this.quizUI.elements.hubCustomizeQuizBtn) this.quizUI.elements.hubCustomizeQuizBtn.disabled = true;
            if (this.quizUI.elements.hubQuickQuizBtn) this.quizUI.elements.hubQuickQuizBtn.disabled = true;
    
            const goToHubLink = document.getElementById('go-to-challenges-hub-link');
            if (goToHubLink) {
                goToHubLink.style.pointerEvents = 'none';
                goToHubLink.style.opacity = '0.5';
                goToHubLink.setAttribute('aria-disabled', 'true');
            }
    
            if (this.quizUI.challengeHubInstance && this.quizUI.challengeHubInstance.elements.challengeHubContainer) {
                const hubContainer = this.quizUI.challengeHubInstance.elements.challengeHubContainer;
                if (document.body.dataset.pageId === 'questions') {
                    const title = hubContainer.querySelector('.challenge-hub__title');
                    if (title) title.textContent = "Funcionalidade Indisponível";
                    
                    const subtitle = hubContainer.querySelector('.challenge-hub__subtitle');
                    if (subtitle) subtitle.textContent = "Não foi possível carregar os dados necessários.";
                    
                    if (hubContainer.classList.contains(this.quizUI.hiddenClassName)) {
                        this.quizUI.showElement(hubContainer);
                        if (this.quizUI.elements.placeholderFiltrosContainer) this.quizUI.hideElement(this.quizUI.elements.placeholderFiltrosContainer);
                        if (this.quizUI.elements.quizSectionContent) this.quizUI.hideElement(this.quizUI.elements.quizSectionContent);
                        if (this.quizUI.elements.resultadoCard) this.quizUI.hideElement(this.quizUI.elements.resultadoCard);
                    }
                }
            }
        }
    }
}