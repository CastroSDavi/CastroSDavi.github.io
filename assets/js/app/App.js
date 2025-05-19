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
import ResultDisplay from '../ui/ResultDisplay.js'; // Importar ResultDisplay
import { QUICK_QUIZ_COUNT } from '../utils/constants.js';

export default class App {
    constructor() {
        // console.log("APP.JS: Constructor - Iniciando a aplicação MedQuiz.");

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
        this.quizUI.setApiService(this.apiService); // Para FavoriteManager dentro de QuizUI

        // 4. Instanciar componentes de UI que QuizUI gerencia ou coordena
        if (this.quizUI.elements.filterPanel) {
            const filterPanel = new FilterPanel(
                this.quizUI.elements.filterPanel, // Elemento DOM do painel
                null, // QuizLogic será injetado depois em FilterPanel
                this.quizState,
                this.quizData,
                this.quizUI,
                this.apiService
            );
            this.quizUI.setFilterPanelInstance(filterPanel);
        } else {
            console.error("APP.JS: CRITICAL - Elemento do painel de filtros não encontrado. FilterPanel não instanciado.");
        }

        if (this.quizUI.elements.challengeHubContainer) {
            const challengeHub = new ChallengeHub(this.quizUI /* QuizUI já tem os elements */);
            this.quizUI.setChallengeHubInstance(challengeHub);
        } else {
            console.error("APP.JS: CRITICAL - Elemento do challenge hub não encontrado. ChallengeHub não instanciado.");
        }
        
        // Instanciar ResultDisplay e injetar em QuizUI
        // ResultDisplay precisa de QuizUI e da instância do Timer (que está em QuizUI)
        const resultDisplay = new ResultDisplay(this.quizUI, this.quizUI.timer /* callbacks setados depois */);
        this.quizUI.setResultDisplayInstance(resultDisplay);


        // 5. Lógica Principal do Quiz
        this.quizLogic = new QuizLogic(
            this.quizState,
            this.quizUI,
            this.userData,
            this.quizData,
            this.apiService
        );

        // 6. Injeção de dependências cruzadas finais (onde QuizLogic é necessário)
        if (this.quizUI.filterPanelInstance) {
            this.quizUI.filterPanelInstance.quizLogic = this.quizLogic;
        }
        if (this.quizUI.challengeHubInstance) {
            this.quizUI.challengeHubInstance.setQuizLogic(this.quizLogic);
        }
        
        // Configurar os callbacks de QuizLogic em QuizUI (que os repassará aos submódulos)
        this.quizUI.setCallbacks({
            answerQuestionCallback: this.quizLogic.answerQuestion.bind(this.quizLogic),
            navigationCallback: this.quizLogic._handleQuestionNavigation.bind(this.quizLogic),
            toggleFavoriteCallback: this.quizLogic.toggleFavoriteCurrentQuestion.bind(this.quizLogic),
            endSessionCallback: () => { // Para o botão "Encerrar" no ScorePanel
                if (this.quizUI.modalManager) this.quizUI.modalManager.toggleConfirmModal(true);
            },
            restartQuizCallback: this.quizLogic.restartQuiz.bind(this.quizLogic),
            // goHomeCallback é tratado no ResultDisplay, mas poderia ser exposto se necessário
        });


        // console.log("APP.JS: Constructor - Todas as instâncias principais criadas e dependências configuradas.");
    }

    async initialize() {
        // console.log("APP.JS: initialize - Iniciando a lógica de inicialização da aplicação.");
        try {
            const initialDataLoaded = await this.quizData.fetchInitialData();

            if (initialDataLoaded) {
                // console.log("APP.JS: initialize - Dados iniciais carregados com sucesso.");
                if (this.quizUI.challengeHubInstance) { 
                    this.quizUI.challengeHubInstance.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub());
                    this.quizUI.challengeHubInstance.updateQuickQuizCount(QUICK_QUIZ_COUNT);
                }

                this.setupEventListeners(); 
                // console.log("APP.JS: initialize - Event listeners configurados.");

                this.determineInitialSection(); 
                // console.log("APP.JS: initialize - Seção inicial determinada e exibida.");

            } else {
                console.error("APP.JS: initialize - Falha ao carregar dados iniciais (dados inválidos ou vazios da API).");
                this.handleLoadError("Não foi possível carregar os dados essenciais do quiz. A aplicação pode não funcionar como esperado.");
            }
        } catch (error) {
            console.error("APP.JS: initialize - Erro fatal durante a inicialização:", error);
            this.handleLoadError(`Erro crítico ao inicializar o MedQuiz: ${error.message}. Por favor, tente recarregar a página.`);
        }
    }

    setupEventListeners() {
        // console.log("APP.JS: setupEventListeners - Configurando listeners da aplicação.");
        if (this.quizUI) { 
            this.quizUI.setupGlobalEventListeners(this.quizLogic);
        }

        // Os listeners específicos de FilterPanel e ChallengeHub são configurados dentro de suas classes
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

        // Listener do formulário da página de conta (se existir)
        const profileForm = document.querySelector('#account-section-page .profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (event) => {
                event.preventDefault();
                // Em vez de alert, poderia chamar um método no this.quizUI.warningDisplay
                if (this.quizUI.warningDisplay) {
                    this.quizUI.warningDisplay.show('Funcionalidade de salvar perfil ainda não implementada no backend.', 'info');
                } else {
                    alert('Funcionalidade de salvar perfil ainda não implementada no backend.');
                }
            });
        }
        // console.log("APP.JS: setupEventListeners - Listeners da aplicação configurados.");
    }

    determineInitialSection() {
        // console.log("APP.JS: determineInitialSection - Determinando seção inicial.");
        if (!this.quizUI) {
            console.error("APP.JS: determineInitialSection - QuizUI não está instanciada.");
            return;
        }

        const homeSectionEl = this.quizUI.elements.homeSection;
        const questionSectionEl = this.quizUI.elements.questionSection; // O <section id="question-section">
        const accountSectionEl = this.quizUI.elements.accountSection;

        // Esconder todas as seções principais primeiro
        if(homeSectionEl) this.quizUI.hideElement(homeSectionEl);
        if(questionSectionEl) this.quizUI.hideElement(questionSectionEl); // Esconde a página de questões inteira inicialmente
        if(accountSectionEl) this.quizUI.hideElement(accountSectionEl);

        // Esconder componentes internos da página de questões que não devem aparecer de cara
        if(this.quizUI.elements.quizSectionContent) this.quizUI.hideElement(this.quizUI.elements.quizSectionContent); // Esconde <section id="quiz-section"> (conteúdo do quiz)
        if(this.quizUI.elements.scorePanel) this.quizUI.hideElement(this.quizUI.elements.scorePanel);
        if(this.quizUI.elements.resultadoCard) this.quizUI.hideElement(this.quizUI.elements.resultadoCard);
        if(this.quizUI.elements.placeholderFiltrosContainer) this.quizUI.hideElement(this.quizUI.elements.placeholderFiltrosContainer);


        if (document.getElementById('home-section') && homeSectionEl) {
            this.quizUI.currentSection = 'home-section';
            this.quizUI.showElement(homeSectionEl);
        } else if (document.getElementById('question-section') && questionSectionEl) {
            this.quizUI.currentSection = 'question-section';
            this.quizUI.showElement(questionSectionEl); // Mostra a PÁGINA de questões
            if (this.quizUI.challengeHubInstance) this.quizUI.challengeHubInstance.showHub(); // Mostra o HUB por padrão
        } else if (document.getElementById('account-section-page') && accountSectionEl) {
            this.quizUI.currentSection = 'account-section-page';
            this.quizUI.showElement(accountSectionEl);
            if (this.quizUI.favoriteManager) { 
                this.quizUI.favoriteManager.loadUserFavorites();
            }
        } else {
            this.quizUI.currentSection = 'home-section'; 
            if (homeSectionEl) this.quizUI.showElement(homeSectionEl);
        }
        
        if (this.layoutManager) {
            this.layoutManager.handleActiveSectionChange(this.quizUI.currentSection);
        }
        // console.log("APP.JS: determineInitialSection - Seção ativa definida como:", this.quizUI.currentSection);

        if (this.quizUI.currentSection === 'home-section') {
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
            if (totalQuestionsSpanHome && this.quizData && this.quizData.isInitialFetchDone &&
                this.quizUI.elements.hubTotalQuestionsCount !== totalQuestionsSpanHome) {
                 totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub() || '0';
            }
        }
    }

    handleLoadError(message) {
        // ... (inalterado)
        console.error("APP.JS: handleLoadError - ERRO AO CARREGAR APLICAÇÃO:", message);
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
                if (mainContent.firstChild) mainContent.insertBefore(errorDisplay, mainContent.firstChild);
                else mainContent.appendChild(errorDisplay);
            }
            errorDisplay.innerHTML = `
                <h2 class="card__title" style="color: inherit; font-size: 1.5rem; margin-bottom: 15px;">Falha ao Carregar</h2>
                <p style="margin-bottom: 10px;">${message}</p>
                <p style="font-size: 0.9em;">Por favor, tente recarregar a página. Se o problema persistir, o serviço pode estar temporariamente indisponível.</p>
            `;
            this.disableCoreFunctionality();
        } catch (uiError) {
            console.error("APP.JS: handleLoadError - Erro ao tentar manipular UI para exibir erro:", uiError);
            document.body.innerHTML = `<div style="padding:20px;text-align:center;color:red;background:white;border:1px solid red;font-family:sans-serif;">${message}</div>`;
        }
    }

    disableCoreFunctionality() {
        // ... (inalterado)
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
            if (document.getElementById('question-section') && hubContainer.classList.contains('u-is-hidden') && this.quizUI) {
                 this.quizUI.showElement(hubContainer);
            }
        }
    }
}