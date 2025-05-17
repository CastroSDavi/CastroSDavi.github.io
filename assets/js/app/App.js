// File: assets/js/app/App.js

import UserData from './data/UserData.js';
import QuizData from './data/QuizData.js';
import QuizState from './core/QuizState.js';
import QuizLogic from './core/QuizLogic.js';
import ApiService from './services/ApiService.js';

import QuizUI from '../ui/QuizUI.js';
import ChallengeHub from '../ui/ChallengeHub.js';
import LayoutManager from '../ui/LayoutManager.js';
import FilterPanel from '../ui/FilterPanel.js'; // FilterPanel já importado
import { QUICK_QUIZ_COUNT } from '../utils/constants.js';
// A função debounce não é importada aqui, pois é usada internamente pelo FilterPanel.

export default class App {
    constructor() {
        console.log("APP.JS: Constructor - Iniciando a aplicação MedQuiz.");

        // Instanciação dos serviços e gerenciadores de dados/estado
        this.apiService = new ApiService(); // ApiService é instanciado primeiro
        this.userData = new UserData();
        this.quizData = new QuizData(this.apiService); // QuizData depende de ApiService
        this.quizState = new QuizState();
        this.layoutManager = new LayoutManager();

        // Instanciação dos componentes de UI
        this.quizUI = new QuizUI(
            this.layoutManager.handleActiveSectionChange.bind(this.layoutManager)
        );

        if (!this.quizUI.elements.filterPanel) {
            console.error("APP.JS: CRITICAL - Elemento do painel de filtros (filterPanel) não encontrado no DOM pela QuizUI. FilterPanel não será instanciado corretamente e suas funcionalidades podem falhar.");
        }
        
        // MODIFICADO: Passar this.apiService para o construtor do FilterPanel
        this.filterPanel = new FilterPanel(
            this.quizUI.elements.filterPanel, // O elemento DOM <aside>
            null, // QuizLogic (será injetado via setter para evitar dependência circular no construtor)
            this.quizState,
            this.quizData,
            this.quizUI,
            this.apiService // Injetando ApiService aqui para que FilterPanel possa usá-lo
        );
        this.quizUI.setFilterPanelInstance(this.filterPanel); // QuizUI pode precisar de uma referência ao FilterPanel

        this.challengeHub = new ChallengeHub(
            this.quizUI.elements,
            null // QuizLogic será injetado via setter
        );

        this.quizLogic = new QuizLogic(
            this.quizState,
            this.quizUI,
            this.userData,
            this.quizData,
            this.apiService
        );

        // Injeção de dependências cruzadas / Setters
        this.challengeHub.setQuizLogic(this.quizLogic);
        this.challengeHub.setQuizUI(this.quizUI);
        
        // FilterPanel agora recebe quizLogic via setter (ou pode ser diretamente se a ordem de instanciação permitir)
        if(this.filterPanel) { // Garante que filterPanel foi instanciado
            this.filterPanel.quizLogic = this.quizLogic; 
        }

        this.quizLogic.setChallengeHub(this.challengeHub);
        this.quizLogic.setFilterPanel(this.filterPanel);

        this.quizUI.setQuizState(this.quizState);
        this.quizUI.setQuizData(this.quizData);

        console.log("APP.JS: Constructor - Todas as instâncias principais criadas e dependências configuradas.");
    }

    async initialize() {
        console.log("APP.JS: initialize - Iniciando a lógica de inicialização da aplicação.");
        try {
            const initialDataLoaded = await this.quizData.fetchInitialData();

            if (initialDataLoaded) {
                console.log("APP.JS: initialize - Dados iniciais carregados com sucesso.");
                this.challengeHub.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub());
                this.challengeHub.updateQuickQuizCount(QUICK_QUIZ_COUNT);

                this.setupEventListeners();
                console.log("APP.JS: initialize - Event listeners configurados.");

                this.determineInitialSection();
                console.log("APP.JS: initialize - Seção inicial determinada e exibida.");

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
        console.log("APP.JS: setupEventListeners - Configurando listeners da aplicação.");
        this.quizUI.setupGlobalEventListeners(this.quizLogic);

        if (this.filterPanel && this.quizUI.elements.filterPanel) {
            this.filterPanel.setupEventListeners();
        } else {
            console.warn("APP.JS: setupEventListeners - FilterPanel ou seu elemento DOM não encontrado. Listeners do painel de filtros não serão configurados.");
        }

        if (this.challengeHub) {
            this.challengeHub.setupEventListeners();
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                let wasHandled = false;
                if (this.quizUI.elements.filterPanel?.classList.contains('filter-panel--visible')) {
                    this.quizUI.toggleFilterPanel(false);
                    wasHandled = true;
                }
                if (!wasHandled && this.quizUI.elements.explanationModalOverlay?.classList.contains('modal--visible')) {
                    this.quizUI.toggleExplanationModal(false);
                    wasHandled = true;
                }
                if (!wasHandled && this.quizUI.elements.confirmEncerrarOverlay?.classList.contains('modal--visible')) {
                    this.quizUI.toggleConfirmModal(false);
                }
            }
        });

        const profileForm = document.querySelector('#account-section-page .profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (event) => {
                event.preventDefault();
                alert('Funcionalidade de salvar perfil ainda não implementada no backend.');
            });
        }
        console.log("APP.JS: setupEventListeners - Listeners da aplicação configurados.");
    }

    determineInitialSection() {
        console.log("APP.JS: determineInitialSection - Determinando seção inicial.");
        const homeSectionEl = this.quizUI.elements.homeSection;
        const questionSectionEl = this.quizUI.elements.questionSection;
        const accountSectionEl = this.quizUI.elements.accountSection;

        if (document.getElementById('home-section') && homeSectionEl) {
            this.quizUI.currentSection = 'home-section';
            this.quizUI.showElement(homeSectionEl);
            this.quizUI.hideElement(questionSectionEl);
            this.quizUI.hideElement(accountSectionEl);
        } else if (document.getElementById('question-section') && questionSectionEl) {
            this.quizUI.currentSection = 'question-section-page';
            this.quizUI.showElement(questionSectionEl);
            if (this.challengeHub) this.challengeHub.showHub();
            this.quizUI.hideElement(this.quizUI.elements.placeholderFiltrosContainer);
            this.quizUI.hideElement(this.quizUI.elements.quizSectionContent);
            this.quizUI.hideElement(this.quizUI.elements.resultadoCard);
            this.quizUI.hideElement(this.quizUI.elements.scorePanel);
            this.quizUI.hideElement(homeSectionEl);
            this.quizUI.hideElement(accountSectionEl);
        } else if (document.getElementById('account-section-page') && accountSectionEl) {
            this.quizUI.currentSection = 'account-section-page';
            this.quizUI.showElement(accountSectionEl);
            this.quizUI.hideElement(homeSectionEl);
            this.quizUI.hideElement(questionSectionEl);
        } else {
            console.warn("APP.JS: determineInitialSection - Nenhuma seção principal identificada, tentando mostrar home.");
            this.quizUI.currentSection = 'home-section';
            if (homeSectionEl) this.quizUI.showElement(homeSectionEl);
        }
        
        this.layoutManager.handleActiveSectionChange(this.quizUI.currentSection);
        console.log("APP.JS: determineInitialSection - Seção ativa definida como:", this.quizUI.currentSection);

        if (this.quizUI.currentSection === 'home-section') {
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
            if (totalQuestionsSpanHome && this.quizData) {
                 totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub() || '0';
            }
        }
    }

    handleLoadError(message) {
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
        console.warn("APP.JS: disableCoreFunctionality - Desabilitando funcionalidades principais devido a erro.");
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
        if (this.challengeHub && this.challengeHub.elements.challengeHubContainer) {
            const hubContainer = this.challengeHub.elements.challengeHubContainer;
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