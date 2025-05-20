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
import AccountPageManager from '../ui/AccountPageManager.js'; // Importa o novo gerenciador
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
        
        // Instanciar ResultDisplay e injetar em QuizUI
        const resultDisplay = new ResultDisplay(this.quizUI, this.quizUI.timer /* callbacks setados depois */); //
        this.quizUI.setResultDisplayInstance(resultDisplay); //

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
            this.quizUI.challengeHubInstance.setQuizLogic(this.quizLogic); //
        }
        
        // Configurar os callbacks de QuizLogic em QuizUI (que os repassará aos submódulos)
        this.quizUI.setCallbacks({
            answerQuestionCallback: this.quizLogic.answerQuestion.bind(this.quizLogic),
            navigationCallback: this.quizLogic._handleQuestionNavigation.bind(this.quizLogic), //
            toggleFavoriteCallback: this.quizLogic.toggleFavoriteCurrentQuestion.bind(this.quizLogic), //
            endSessionCallback: () => {  //
                if (this.quizUI.modalManager) this.quizUI.modalManager.toggleConfirmModal(true); //
            },
            restartQuizCallback: this.quizLogic.restartQuiz.bind(this.quizLogic), //
            // goHomeCallback é tratado no ResultDisplay, mas poderia ser exposto se necessário
        });

        // 7. Instanciar AccountPageManager (init será chamado depois, na inicialização do App)
        this.accountPageManager = new AccountPageManager(this.quizUI); //

        // console.log("APP.JS: Constructor - Todas as instâncias principais criadas e dependências configuradas.");
    }

    async initialize() {
        // console.log("APP.JS: initialize - Iniciando a lógica de inicialização da aplicação.");
        try {
            const initialDataLoaded = await this.quizData.fetchInitialData(); //

            if (initialDataLoaded) {
                // console.log("APP.JS: initialize - Dados iniciais carregados com sucesso.");
                if (this.quizUI.challengeHubInstance) { 
                    this.quizUI.challengeHubInstance.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub()); //
                    this.quizUI.challengeHubInstance.updateQuickQuizCount(QUICK_QUIZ_COUNT); //
                }

                this.setupEventListeners(); 
                // console.log("APP.JS: initialize - Event listeners configurados.");

                this.determineInitialSection(); 
                // console.log("APP.JS: initialize - Seção inicial determinada e exibida.");

                // MODIFICAÇÃO AQUI:
                // Chamar init do AccountPageManager APÓS a seção ter sido determinada e (potencialmente) tornada visível.
                const bodyPageId = document.body.dataset.pageId; //
                if (bodyPageId === 'account' && this.accountPageManager) {
                    // console.log("APP.JS: initialize - Chamando AccountPageManager.init() para a página da conta.");
                    this.accountPageManager.init();
                }


            } else {
                // console.error("APP.JS: initialize - Falha ao carregar dados iniciais (dados inválidos ou vazios da API).");
                this.handleLoadError("Não foi possível carregar os dados essenciais do quiz. A aplicação pode não funcionar como esperado."); //
            }
        } catch (error) {
            // console.error("APP.JS: initialize - Erro fatal durante a inicialização:", error);
            this.handleLoadError(`Erro crítico ao inicializar o MedQuiz: ${error.message}. Por favor, tente recarregar a página.`); //
        }
    }

    setupEventListeners() {
        // console.log("APP.JS: setupEventListeners - Configurando listeners da aplicação.");
        if (this.quizUI) { 
            this.quizUI.setupGlobalEventListeners(this.quizLogic); //
        }

        // Os listeners específicos de FilterPanel e ChallengeHub são configurados dentro de suas classes
        if (this.quizUI.filterPanelInstance) {
            this.quizUI.filterPanelInstance.setupEventListeners(); //
        }
        if (this.quizUI.challengeHubInstance) {
            this.quizUI.challengeHubInstance.setupEventListeners(); //
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { //
                if (this.quizUI && this.quizUI.modalManager && this.quizUI.modalManager.handleEscapeKey()) { //
                    // Escape foi tratado pelo ModalManager
                }
            }
        });
        // console.log("APP.JS: setupEventListeners - Listeners da aplicação configurados.");
    }

    determineInitialSection() {
        // console.log("APP.JS: determineInitialSection - Determinando seção inicial.");
        if (!this.quizUI) {
            // console.error("APP.JS: determineInitialSection - QuizUI não está instanciada.");
            return;
        }
    
        const { homeSection, questionSection, accountSection, quizSectionContent, scorePanel, resultadoCard, placeholderFiltrosContainer } = this.quizUI.elements; //
    
        // Esconder todas as seções e componentes principais inicialmente
        // Isso garante um estado limpo antes de mostrar a seção correta.
        if(homeSection) this.quizUI.hideElement(homeSection); //
        if(questionSection) this.quizUI.hideElement(questionSection); //
        if(accountSection) this.quizUI.hideElement(accountSection); //
    
        if(quizSectionContent) this.quizUI.hideElement(quizSectionContent); //
        if(scorePanel) this.quizUI.hideElement(scorePanel); //
        if(resultadoCard) this.quizUI.hideElement(resultadoCard); //
        if(placeholderFiltrosContainer) this.quizUI.hideElement(placeholderFiltrosContainer); //
    
        // Determina qual seção principal deve ser visível com base no data-attribute do body
        const bodyPageId = document.body.dataset.pageId; //
    
        if (bodyPageId === 'home' && homeSection) { //
            this.quizUI.currentSection = 'home-section'; //
            this.quizUI.showElement(homeSection); //
        } else if (bodyPageId === 'questions' && questionSection) { //
            this.quizUI.currentSection = 'question-section'; //
            this.quizUI.showElement(questionSection); // Mostra a PÁGINA de questões //
            if (this.quizUI.challengeHubInstance) { // Mostra o HUB por padrão dentro da página de questões //
                this.quizUI.challengeHubInstance.showHub(); //
            }
        } else if (bodyPageId === 'account' && accountSection) { // accountSection é o ID 'account-section-page' //
            this.quizUI.currentSection = 'account-section-page'; //
            this.quizUI.showElement(accountSection); //
            // O AccountPageManager.js, ao ser instanciado ou se a seção se tornar visível,
            // lidará com a lógica de _activateTabFromHash e carregamento de conteúdo dinâmico.
        } else {
            // Fallback para a home se nenhum bodyPageId corresponder ou elemento não encontrado
            if (homeSection) { //
                this.quizUI.currentSection = 'home-section';  //
                this.quizUI.showElement(homeSection); //
                // console.warn("APP.JS: determineInitialSection - Nenhuma seção principal identificada por data-page-id, definindo para 'home-section'.");
            } else {
                // console.error("APP.JS: determineInitialSection - Seção 'home' não encontrada para fallback.");
                // Considerar mostrar uma mensagem de erro mais proeminente se nem a home puder ser exibida.
            }
        }
        
        if (this.layoutManager) {
            this.layoutManager.handleActiveSectionChange(this.quizUI.currentSection); //
        }
        // console.log("APP.JS: determineInitialSection - Seção ativa definida como:", this.quizUI.currentSection);
    
        // Atualiza contagem na home se ela for a seção atual e os dados já foram carregados
        if (this.quizUI.currentSection === 'home-section' && this.quizData.isInitialFetchDone) { //
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count'); // Busca o elemento na home //
            // Garante que não estamos tentando atualizar o mesmo span que está no challengeHub (se tiverem o mesmo ID e ambos existirem)
            if (totalQuestionsSpanHome && this.quizUI.elements.hubTotalQuestionsCount !== totalQuestionsSpanHome) { //
                 totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub() || '0'; //
            }
        }
    }

    handleLoadError(message) {
        // console.error("APP.JS: handleLoadError - ERRO AO CARREGAR APLICAÇÃO:", message);
        try {
            const mainContent = document.querySelector('main') || document.body; //
            let errorDisplay = mainContent.querySelector('.app-critical-error-display'); //
            if (!errorDisplay) {
                errorDisplay = document.createElement('div'); //
                errorDisplay.className = 'app-critical-error-display card'; // Adiciona classe card para estilos base //
                // Estilos inline para garantir visibilidade mesmo se o CSS falhar parcialmente
                errorDisplay.style.padding = 'var(--spacing-lg, 30px)';  //
                errorDisplay.style.margin = 'var(--spacing-xl, 40px) auto'; //
                errorDisplay.style.maxWidth = '600px'; //
                errorDisplay.style.backgroundColor = 'var(--color-incorrect-bg, #fff0f1)';  //
                errorDisplay.style.color = 'var(--color-incorrect-text, #c12634)'; //
                errorDisplay.style.border = '1px solid var(--color-incorrect-border, #f1aeb5)'; //
                errorDisplay.style.borderRadius = 'var(--border-radius-lg, 12px)'; //
                errorDisplay.style.textAlign = 'center';  //
                errorDisplay.style.fontFamily = 'var(--font-family-sans, sans-serif)'; //
                
                // Insere a mensagem de erro no início do conteúdo principal
                if (mainContent.firstChild) { //
                    mainContent.insertBefore(errorDisplay, mainContent.firstChild); //
                } else {
                    mainContent.appendChild(errorDisplay); //
                }
            }
            // Define o conteúdo da mensagem de erro
            errorDisplay.innerHTML = `
                <h2 class="card__title" style="color: inherit; font-size: 1.5rem; margin-bottom: 15px;">Falha ao Carregar</h2>
                <p style="margin-bottom: 10px;">${message}</p>
                <p style="font-size: 0.9em;">Por favor, tente recarregar a página. Se o problema persistir, o serviço pode estar temporariamente indisponível.</p>
            `; //
            this.disableCoreFunctionality(); //
        } catch (uiError) {
            // console.error("APP.JS: handleLoadError - Erro ao tentar manipular UI para exibir erro:", uiError);
            // Fallback extremo se a manipulação do DOM falhar
            document.body.innerHTML = `<div style="padding:20px;text-align:center;color:red;background:white;border:1px solid red;font-family:sans-serif;">${message}</div>`; //
        }
    }

    disableCoreFunctionality() {
        // Desabilita botões principais para evitar interações com uma aplicação quebrada
        if (this.quizUI && this.quizUI.elements) { //
            if(this.quizUI.elements.hubCustomizeQuizBtn) this.quizUI.elements.hubCustomizeQuizBtn.disabled = true; //
            if(this.quizUI.elements.hubQuickQuizBtn) this.quizUI.elements.hubQuickQuizBtn.disabled = true; //
            
            const goToHubLink = document.getElementById('go-to-challenges-hub-link'); //
            if (goToHubLink) { //
                goToHubLink.style.pointerEvents = 'none'; //
                goToHubLink.style.opacity = '0.5'; //
                goToHubLink.setAttribute('aria-disabled', 'true'); //
            }
        }
        // Modifica o Challenge Hub para indicar que está indisponível
        if (this.quizUI.challengeHubInstance && this.quizUI.challengeHubInstance.elements.challengeHubContainer) { //
            const hubContainer = this.quizUI.challengeHubInstance.elements.challengeHubContainer; //
            const title = hubContainer.querySelector('.challenge-hub__title'); //
            if (title) title.textContent = "Funcionalidade Indisponível"; //
            
            const subtitle = hubContainer.querySelector('.challenge-hub__subtitle'); //
            if (subtitle) subtitle.textContent = "Não foi possível carregar os dados necessários."; //
            
            // Se o hub estiver escondido e estamos na página de questões, mostra o hub com a mensagem de erro.
            if (document.getElementById('question-section') && hubContainer.classList.contains(this.quizUI.hiddenClassName) && this.quizUI) { //
                 this.quizUI.showElement(hubContainer); //
            }
        }
    }
}