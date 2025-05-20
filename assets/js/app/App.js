// File: assets/js/app/App.js

import UserData from './data/UserData.js';
import QuizData from './data/QuizData.js';
import QuizState from './core/QuizState.js';
import QuizLogic from './core/QuizLogic.js';
import ApiService from './services/ApiService.js';

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
        this.apiService = new ApiService();
        this.userData = new UserData();
        this.quizData = new QuizData(this.apiService);
        this.quizState = new QuizState();
        
        // 2. Gerenciadores de UI de Alto Nível e Componentes Principais
        this.layoutManager = new LayoutManager();
        this.quizUI = new QuizUI(
            this.layoutManager.handleActiveSectionChange.bind(this.layoutManager)
        );

        // 3. Injetar dependências básicas em QuizUI
        this.quizUI.setQuizState(this.quizState);
        this.quizUI.setQuizData(this.quizData);
        this.quizUI.setApiService(this.apiService); 

        // 4. Instanciar componentes de UI que QuizUI gerencia ou coordena
        if (this.quizUI.elements.filterPanel) {
            const filterPanel = new FilterPanel(
                this.quizUI.elements.filterPanel, 
                null, // QuizLogic será injetado depois
                this.quizState,
                this.quizData,
                this.quizUI,
                this.apiService
            );
            this.quizUI.setFilterPanelInstance(filterPanel);
        } else {
            // console.error("APP.JS: CRITICAL - Elemento do painel de filtros não encontrado. FilterPanel não instanciado.");
        }

        if (this.quizUI.elements.challengeHubContainer) {
            const challengeHub = new ChallengeHub(this.quizUI);
            this.quizUI.setChallengeHubInstance(challengeHub);
        } else {
            // console.error("APP.JS: CRITICAL - Elemento do challenge hub não encontrado. ChallengeHub não instanciado.");
        }
        
        const resultDisplay = new ResultDisplay(this.quizUI, this.quizUI.timer);
        this.quizUI.setResultDisplayInstance(resultDisplay); 

        // 5. Lógica Principal do Quiz
        this.quizLogic = new QuizLogic(
            this.quizState,
            this.quizUI,
            this.userData,
            this.quizData,
            this.apiService
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

        // 7. Instanciar AccountPageManager
        this.accountPageManager = new AccountPageManager(this.quizUI); 
    }

    async initialize() {
        try {
            const initialDataLoaded = await this.quizData.fetchInitialData(); 

            if (initialDataLoaded) {
                if (this.quizUI.challengeHubInstance) { 
                    this.quizUI.challengeHubInstance.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub()); 
                    this.quizUI.challengeHubInstance.updateQuickQuizCount(QUICK_QUIZ_COUNT); 
                }

                this.setupEventListeners(); 
                this.determineInitialSection(); 

                // Chamar init do AccountPageManager APÓS a seção ter sido determinada
                // e a classe no-scroll (se aplicável) ter sido definida.
                const bodyPageId = document.body.dataset.pageId; 
                if (bodyPageId === 'account' && this.accountPageManager) {
                    this.accountPageManager.init();
                }

            } else {
                this.handleLoadError("Não foi possível carregar os dados essenciais do quiz. A aplicação pode não funcionar como esperado."); 
            }
        } catch (error) {
            this.handleLoadError(`Erro crítico ao inicializar o MedQuiz: ${error.message}. Por favor, tente recarregar a página.`); 
        }
    }

    setupEventListeners() {
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
                if (this.quizUI && this.quizUI.modalManager && this.quizUI.modalManager.handleEscapeKey()) { 
                    // Escape foi tratado pelo ModalManager
                }
            }
        });
    }

    determineInitialSection() {
        if (!this.quizUI) {
            return;
        }
    
        const { homeSection, questionSection, accountSection, quizSectionContent, scorePanel, resultadoCard, placeholderFiltrosContainer } = this.quizUI.elements; 
    
        if(homeSection) this.quizUI.hideElement(homeSection); 
        if(questionSection) this.quizUI.hideElement(questionSection); 
        if(accountSection) this.quizUI.hideElement(accountSection); 
    
        if(quizSectionContent) this.quizUI.hideElement(quizSectionContent); 
        if(scorePanel) this.quizUI.hideElement(scorePanel); 
        if(resultadoCard) this.quizUI.hideElement(resultadoCard); 
        if(placeholderFiltrosContainer) this.quizUI.hideElement(placeholderFiltrosContainer); 
    
        const bodyPageId = document.body.dataset.pageId; 
        const bodyEl = document.body;

        // Lógica para controlar a classe 'no-scroll' no body
        if (bodyPageId === 'account' && this.accountPageManager && this.accountPageManager._isMobileView()) {
            bodyEl.classList.add('no-scroll');
        } else {
            bodyEl.classList.remove('no-scroll');
        }

        // Lógica para exibir a seção correta
        if (bodyPageId === 'home' && homeSection) { 
            this.quizUI.currentSection = 'home-section'; 
            this.quizUI.showElement(homeSection); 
        } else if (bodyPageId === 'questions' && questionSection) { 
            this.quizUI.currentSection = 'question-section'; 
            this.quizUI.showElement(questionSection); 
            if (this.quizUI.challengeHubInstance) { 
                this.quizUI.challengeHubInstance.showHub(); 
            }
        } else if (bodyPageId === 'account' && accountSection) { 
            this.quizUI.currentSection = 'account-section-page'; 
            this.quizUI.showElement(accountSection); 
            // O init do AccountPageManager será chamado no final do initialize() do App
            // se esta for a página da conta, após a classe no-scroll ser definida.
        } else {
            if (homeSection) { 
                this.quizUI.currentSection = 'home-section';  
                this.quizUI.showElement(homeSection); 
            }
        }
        
        if (this.layoutManager) {
            this.layoutManager.handleActiveSectionChange(this.quizUI.currentSection); 
        }
    
        if (this.quizUI.currentSection === 'home-section' && this.quizData.isInitialFetchDone) { 
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count'); 
            if (totalQuestionsSpanHome && this.quizUI.elements.hubTotalQuestionsCount !== totalQuestionsSpanHome) { 
                 totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub() || '0'; 
            }
        }
    }

    handleLoadError(message) {
        try {
            const mainContent = document.querySelector('main') || document.body; 
            let errorDisplay = mainContent.querySelector('.app-critical-error-display'); 
            if (!errorDisplay) {
                errorDisplay = document.createElement('div'); 
                errorDisplay.className = 'app-critical-error-display card'; 
                errorDisplay.style.padding = 'var(--spacing-lg, 30px)';  
                errorDisplay.style.margin = 'var(--spacing-xl, 40px) auto'; 
                errorDisplay.style.maxWidth = '600px'; 
                errorDisplay.style.backgroundColor = 'var(--color-incorrect-bg, #fff0f1)';  
                errorDisplay.style.color = 'var(--color-incorrect-text, #c12634)'; 
                errorDisplay.style.border = '1px solid var(--color-incorrect-border, #f1aeb5)'; 
                errorDisplay.style.borderRadius = 'var(--border-radius-lg, 12px)'; 
                errorDisplay.style.textAlign = 'center';  
                errorDisplay.style.fontFamily = 'var(--font-family-sans, sans-serif)'; 
                
                if (mainContent.firstChild) { 
                    mainContent.insertBefore(errorDisplay, mainContent.firstChild); 
                } else {
                    mainContent.appendChild(errorDisplay); 
                }
            }
            errorDisplay.innerHTML = `
                <h2 class="card__title" style="color: inherit; font-size: 1.5rem; margin-bottom: 15px;">Falha ao Carregar</h2>
                <p style="margin-bottom: 10px;">${message}</p>
                <p style="font-size: 0.9em;">Por favor, tente recarregar a página. Se o problema persistir, o serviço pode estar temporariamente indisponível.</p>
            `; 
            this.disableCoreFunctionality(); 
        } catch (uiError) {
            document.body.innerHTML = `<div style="padding:20px;text-align:center;color:red;background:white;border:1px solid red;font-family:sans-serif;">${message}</div>`; 
        }
    }

    disableCoreFunctionality() {
        if (this.quizUI && this.quizUI.elements) { 
            if(this.quizUI.elements.hubCustomizeQuizBtn) this.quizUI.elements.hubCustomizeQuizBtn.disabled = true; 
            if(this.quizUI.elements.hubQuickQuizBtn) this.quizUI.elements.hubQuickQuizBtn.disabled = true; 
            
            const goToHubLink = document.getElementById('go-to-challenges-hub-link'); 
            if (goToHubLink) { 
                goToHubLink.style.pointerEvents = 'none'; 
                goToHubLink.style.opacity = '0.5'; 
                goToHubLink.setAttribute('aria-disabled', 'true'); 
            }
        }
        if (this.quizUI.challengeHubInstance && this.quizUI.challengeHubInstance.elements.challengeHubContainer) { 
            const hubContainer = this.quizUI.challengeHubInstance.elements.challengeHubContainer; 
            const title = hubContainer.querySelector('.challenge-hub__title'); 
            if (title) title.textContent = "Funcionalidade Indisponível"; 
            
            const subtitle = hubContainer.querySelector('.challenge-hub__subtitle'); 
            if (subtitle) subtitle.textContent = "Não foi possível carregar os dados necessários."; 
            
            if (document.getElementById('question-section') && hubContainer.classList.contains(this.quizUI.hiddenClassName) && this.quizUI) { 
                 this.quizUI.showElement(hubContainer); 
            }
        }
    }
}