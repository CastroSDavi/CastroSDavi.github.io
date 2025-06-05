// File: assets/js/app/App.js

import UserData from './data/UserData.js'; //
import QuizData from './data/QuizData.js'; //
import QuizState from './core/QuizState.js'; //
import QuizLogic from './core/QuizLogic.js'; //
import ApiService from './services/ApiService.js'; //

import QuizUI from '../ui/QuizUI.js'; //
import ChallengeHub from '../ui/ChallengeHub.js'; //
import LayoutManager from '../ui/LayoutManager.js'; //
import FilterPanel from '../ui/FilterPanel.js'; //
import ResultDisplay from '../ui/ResultDisplay.js'; //
import AccountPageManager from '../ui/AccountPageManager.js'; //

import { QUICK_QUIZ_COUNT } from '../utils/constants.js'; //

export default class App {
    constructor() {
        this.apiService = new ApiService(); //
        this.userData = new UserData(); //
        this.quizData = new QuizData(this.apiService); //
        this.quizState = new QuizState(); //

        this.layoutManager = new LayoutManager(); //
        this.quizUI = new QuizUI( //
            this.layoutManager.handleActiveSectionChange.bind(this.layoutManager) //
        );

        // Injetando dependências principais na QuizUI
        this.quizUI.setQuizState(this.quizState); //
        this.quizUI.setQuizData(this.quizData); //
        this.quizUI.setApiService(this.apiService); //

        // Instanciando e configurando sub-módulos da UI
        if (this.quizUI.elements.filterPanel) { //
            const filterPanel = new FilterPanel( //
                this.quizUI.elements.filterPanel, //
                null, // quizLogic é setado depois
                this.quizState, //
                this.quizData, //
                this.quizUI, //
                this.apiService //
            );
            this.quizUI.setFilterPanelInstance(filterPanel); //
        }

        if (this.quizUI.elements.challengeHubContainer) { //
            const challengeHub = new ChallengeHub(this.quizUI); //
            this.quizUI.setChallengeHubInstance(challengeHub); //
        }

        const resultDisplay = new ResultDisplay(this.quizUI, this.quizUI.timer); //
        this.quizUI.setResultDisplayInstance(resultDisplay); //

        // Instanciando QuizLogic com todas as dependências
        this.quizLogic = new QuizLogic( //
            this.quizState, //
            this.quizUI, //
            this.userData, //
            this.quizData, //
            this.apiService //
        );

        // Injetando QuizLogic nos módulos da UI que precisam dele
        if (this.quizUI.filterPanelInstance) {
            this.quizUI.filterPanelInstance.quizLogic = this.quizLogic; //
        }
        if (this.quizUI.challengeHubInstance) {
            this.quizUI.challengeHubInstance.setQuizLogic(this.quizLogic); //
        }

        // Configurando callbacks da QuizUI para usar métodos do QuizLogic
        this.quizUI.setCallbacks({ //
            answerQuestionCallback: this.quizLogic.answerQuestion.bind(this.quizLogic), //
            navigationCallback: this.quizLogic._handleQuestionNavigation.bind(this.quizLogic), //
            toggleFavoriteCallback: this.quizLogic.toggleFavoriteCurrentQuestion.bind(this.quizLogic), //
            endSessionCallback: () => { //
                // Este callback é para o botão "Encerrar Sessão" no ScorePanel.
                // Ele deve abrir o modal de confirmação de encerramento.
                if (this.quizUI.modalManager) this.quizUI.modalManager.toggleConfirmModal(true);
            },
            restartQuizCallback: this.quizLogic.restartQuiz.bind(this.quizLogic), //
        });

        this.accountPageManager = new AccountPageManager(this.quizUI, this.apiService); //
    }

    async initialize() {
        console.log("App.js: initialize - Iniciando aplicação.");
        try {
            // Busca os dados iniciais (todas as perguntas, categorias, etc.)
            const initialDataLoaded = await this.quizData.fetchInitialData(); //

            if (initialDataLoaded) {
                console.log("App.js: initialize - Dados iniciais carregados com sucesso.");
                // Atualiza a UI do ChallengeHub com a contagem total de questões, se existir
                if (this.quizUI.challengeHubInstance) { //
                    this.quizUI.challengeHubInstance.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub()); //
                    // A contagem do Quiz Rápido pode vir do backend via ConfiguracoesGeraisQuiz,
                    // mas o frontend usa QUICK_QUIZ_COUNT como fallback ou valor padrão exibido.
                    // Se o valor de ConfiguracoesGeraisQuiz estiver disponível no quizData após fetchInitialData,
                    // você poderia usá-lo aqui. Por ora, mantém o valor do constants.js.
                    let quickQuizCountFromConfig = this.quizData.quickQuizDefaultCount || QUICK_QUIZ_COUNT; // Adicionar getter para isso em QuizData se ConfiguracoesGeraisQuiz for buscado
                    this.quizUI.challengeHubInstance.updateQuickQuizCount(quickQuizCountFromConfig); //
                }

                this.setupEventListeners(); // Configura listeners globais e de componentes da UI //
                this.determineInitialSection(); // Determina qual seção da página exibir //

                const currentPageId = document.body.dataset.pageId; //

                if (currentPageId === 'questions') { //
                    // A chamada para initializeQuizPage cuidará de mostrar o indicador de loading,
                    // tentar retomar a sessão e, se necessário, exibir o modal de decisão.
                    // O setTimeout anterior foi removido.
                    console.log("App.js: initialize - Página de questões. Chamando quizLogic.initializeQuizPage().");
                    await this.quizLogic.initializeQuizPage();
                }

                if (currentPageId === 'account') { //
                    this.accountPageManager.init(); //
                }
            } else {
                console.error("App.js: initialize - Falha ao carregar dados iniciais.");
                this.handleLoadError("Não foi possível carregar os dados essenciais do quiz. Tente recarregar a página."); //
            }
        } catch (error) {
            console.error("App.js: initialize - Erro crítico durante a inicialização:", error);
            this.handleLoadError(`Erro crítico ao inicializar: ${error.message}. Verifique o console para mais detalhes.`); //
        }
        console.log("App.js: initialize - Finalizado.");
    }

    setupEventListeners() {
        console.log("App.js: setupEventListeners - Configurando listeners.");
        if (this.quizUI) { //
            this.quizUI.setupGlobalEventListeners(this.quizLogic); //
        }
        if (this.quizUI.filterPanelInstance) { //
            this.quizUI.filterPanelInstance.setupEventListeners(); //
        }
        if (this.quizUI.challengeHubInstance) { //
            this.quizUI.challengeHubInstance.setupEventListeners(); //
            // Se houver quizzes pré-definidos listados no ChallengeHub,
            // o listener para iniciar esses quizzes seria configurado aqui ou dentro do ChallengeHub,
            // chamando algo como this.quizLogic.startPredefinedQuiz(quizId).
        }

        document.addEventListener('keydown', (e) => { //
            if (e.key === 'Escape') { //
                let modalHandled = false;
                if (this.quizUI?.modalManager) { //
                    modalHandled = this.quizUI.modalManager.handleEscapeKey(); //
                }
                // Outras lógicas de 'Esc' podem ser adicionadas aqui se necessário
            }
        });
        console.log("App.js: setupEventListeners - Listeners configurados.");
    }

    determineInitialSection() {
        console.log("App.js: determineInitialSection - Determinando seção inicial.");
        if (!this.quizUI || !this.quizUI.elements) {
            console.error("App.js: determineInitialSection - QuizUI ou seus elementos não estão disponíveis.");
            return;
        }
        const { homeSection, questionSection, accountSection, quizSectionContent, scorePanel, resultadoCard, placeholderFiltrosContainer } = this.quizUI.elements; //
        const bodyEl = document.body; //
        const bodyPageId = bodyEl.dataset.pageId; //

        const mainPanels = [ //
            homeSection, questionSection, accountSection,
            quizSectionContent, resultadoCard, placeholderFiltrosContainer
        ];
        mainPanels.forEach(el => { if (el) this.quizUI.hideElement(el); }); //
        if (scorePanel && this.quizUI.scorePanel) this.quizUI.scorePanel.hide(); //

        let activeSectionIdForLayoutManager = 'unknown'; //

        if (bodyPageId === 'home' && homeSection) { //
            this.quizUI.currentSection = 'home-section'; //
            activeSectionIdForLayoutManager = 'home'; //
            this.quizUI.showElement(homeSection); //
        } else if (bodyPageId === 'questions' && questionSection) { //
            this.quizUI.currentSection = 'question-section'; //
            activeSectionIdForLayoutManager = 'questions'; //
            this.quizUI.showElement(questionSection); //
            // Não mostra o hub ou quiz aqui; initializeQuizPage() cuidará disso.
        } else if (bodyPageId === 'account' && accountSection) { //
            this.quizUI.currentSection = 'account-section-page'; //
            activeSectionIdForLayoutManager = 'account'; //
            this.quizUI.showElement(accountSection); //
        } else { // Fallback para a home
            if (homeSection) { //
                this.quizUI.currentSection = 'home-section'; //
                activeSectionIdForLayoutManager = 'home'; //
                this.quizUI.showElement(homeSection); //
            }
        }

        if (bodyPageId !== 'account') { //
            bodyEl.classList.remove('no-scroll'); //
            if (this.accountPageManager) this.accountPageManager._adjustBodyPaddingForBottomNav(); //
        }

        if (this.layoutManager) { //
            this.layoutManager.handleActiveSectionChange(activeSectionIdForLayoutManager); //
        }

        // Atualiza a contagem de questões na home page, se aplicável
        if (activeSectionIdForLayoutManager === 'home' && this.quizData.isInitialFetchDone) { //
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count'); //
            if (totalQuestionsSpanHome && this.quizUI.elements.hubTotalQuestionsCount !== totalQuestionsSpanHome) { //
                totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub()?.toLocaleString('pt-BR') || '0'; //
            }
        }
        console.log("App.js: determineInitialSection - Seção inicial determinada:", activeSectionIdForLayoutManager);
    }

    handleLoadError(message) {
        console.error("App.js: handleLoadError - ", message); //
        try {
            const mainContent = document.querySelector('main') || document.body; //
            let errorDisplay = mainContent.querySelector('.app-critical-error-display'); //
            if (!errorDisplay) { //
                errorDisplay = document.createElement('div'); //
                errorDisplay.className = 'app-critical-error-display card'; //
                // Estilos inline são mantidos para garantir visibilidade mesmo que o CSS falhe parcialmente
                errorDisplay.style.cssText = ` 
                    padding: var(--spacing-lg, 30px); margin: var(--spacing-xl, 40px) auto;
                    max-width: 600px; background-color: var(--color-incorrect-bg, #fff0f1);
                    color: var(--color-incorrect-text, #c12634); border: 1px solid var(--color-incorrect-border, #f1aeb5);
                    border-radius: var(--border-radius-lg, 12px); text-align: center;
                    font-family: var(--font-family-sans, sans-serif); z-index: 9999; position: relative;
                `; //
                if (mainContent.firstChild && mainContent !== document.body) { //
                    mainContent.insertBefore(errorDisplay, mainContent.firstChild); //
                } else {
                    document.body.insertBefore(errorDisplay, document.body.firstChild); //
                }
            }
            errorDisplay.innerHTML = `
                <h2 class="card__title" style="color: inherit; font-size: 1.5rem; margin-bottom: 15px;">Falha ao Carregar</h2>
                <p style="margin-bottom: 10px; line-height: 1.6;">${message}</p>
                <p style="font-size: 0.9em;">Por favor, tente recarregar a página. Se o problema persistir, o serviço pode estar temporariamente indisponível.</p>
            `; //
            this.disableCoreFunctionality(); //
        } catch (uiError) {
            console.error("App.js: Error displaying critical load error to UI:", uiError);
            // document.body.innerHTML = `<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:white; color:red; padding:20px; text-align:center; z-index:10000; font-family:sans-serif;"><h1>Erro Crítico</h1><p>${message}</p></div>`; //
        }
    }

    disableCoreFunctionality() {
        console.warn("App.js: disableCoreFunctionality() - Disabling core app features due to error."); //
        if (this.quizUI && this.quizUI.elements) { //
            if (this.quizUI.elements.hubCustomizeQuizBtn) this.quizUI.elements.hubCustomizeQuizBtn.disabled = true; //
            if (this.quizUI.elements.hubQuickQuizBtn) this.quizUI.elements.hubQuickQuizBtn.disabled = true; //

            const goToHubLink = document.getElementById('go-to-challenges-hub-link'); //
            if (goToHubLink) { //
                goToHubLink.style.pointerEvents = 'none'; //
                goToHubLink.style.opacity = '0.5'; //
                goToHubLink.setAttribute('aria-disabled', 'true'); //
            }

            if (this.quizUI.challengeHubInstance && this.quizUI.challengeHubInstance.elements.challengeHubContainer) { //
                const hubContainer = this.quizUI.challengeHubInstance.elements.challengeHubContainer; //
                if (document.body.dataset.pageId === 'questions') { //
                    const title = hubContainer.querySelector('.challenge-hub__title'); //
                    if (title) title.textContent = "Funcionalidade Indisponível"; //

                    const subtitle = hubContainer.querySelector('.challenge-hub__subtitle'); //
                    if (subtitle) subtitle.textContent = "Não foi possível carregar os dados."; //

                    if (hubContainer.classList.contains(this.quizUI.hiddenClassName)) { //
                        this.quizUI.showElement(hubContainer); //
                        if (this.quizUI.elements.placeholderFiltrosContainer) this.quizUI.hideElement(this.quizUI.elements.placeholderFiltrosContainer); //
                        if (this.quizUI.elements.quizSectionContent) this.quizUI.hideElement(this.quizUI.elements.quizSectionContent); //
                        if (this.quizUI.elements.resultadoCard) this.quizUI.hideElement(this.quizUI.elements.resultadoCard); //
                    }
                }
            }
        }
    }
}