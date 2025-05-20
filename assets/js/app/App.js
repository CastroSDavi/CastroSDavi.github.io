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
        this.layoutManager = new LayoutManager(); // LayoutManager agora é mais passivo
        this.quizUI = new QuizUI(
            // Passa o activePageId para o LayoutManager, que pode usar para lógicas globais no body
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
                this.determineInitialSection(); // Define a seção visível e chama handleActiveSectionChange

                // O AccountPageManager.init() agora é chamado aqui, APÓS a seção inicial
                // e o data-page-id terem sido processados, e APÓS o _adjustBodyPaddingForBottomNav
                // ter sido potencialmente chamado pela primeira vez via _handleResize em seu init.
                if (this.accountPageManager && document.body.dataset.pageId === 'account') {
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
                if (this.quizUI?.modalManager?.handleEscapeKey()) {
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
        const bodyEl = document.body;
        const bodyPageId = bodyEl.dataset.pageId; // Assumindo que base.html já define isso

        // Esconde todas as seções principais inicialmente
        if (homeSection) this.quizUI.hideElement(homeSection);
        if (questionSection) this.quizUI.hideElement(questionSection);
        if (accountSection) this.quizUI.hideElement(accountSection);

        // Esconde elementos de quiz ativo/resultado
        if (quizSectionContent) this.quizUI.hideElement(quizSectionContent);
        if (scorePanel) this.quizUI.hideElement(scorePanel);
        if (resultadoCard) this.quizUI.hideElement(resultadoCard);
        if (placeholderFiltrosContainer) this.quizUI.hideElement(placeholderFiltrosContainer);

        // Determina qual seção mostrar
        let activeSectionIdForLayoutManager = 'unknown';

        if (bodyPageId === 'home' && homeSection) {
            this.quizUI.currentSection = 'home-section'; // ID interno da QuizUI
            activeSectionIdForLayoutManager = 'home';     // ID para LayoutManager
            this.quizUI.showElement(homeSection);
            bodyEl.classList.remove('no-scroll'); // Garante que home não tenha no-scroll
            // Padding padrão do body para bottom-nav (se aplicável em mobile)
            if(this.accountPageManager) this.accountPageManager._adjustBodyPaddingForBottomNav();
        } else if (bodyPageId === 'questions' && questionSection) {
            this.quizUI.currentSection = 'question-section';
            activeSectionIdForLayoutManager = 'questions';
            this.quizUI.showElement(questionSection);
            if (this.quizUI.challengeHubInstance) {
                this.quizUI.challengeHubInstance.showHub();
            }
            bodyEl.classList.remove('no-scroll');
            if(this.accountPageManager) this.accountPageManager._adjustBodyPaddingForBottomNav();
        } else if (bodyPageId === 'account' && accountSection) {
            this.quizUI.currentSection = 'account-section-page';
            activeSectionIdForLayoutManager = 'account';
            this.quizUI.showElement(accountSection);
            // A classe 'no-scroll' e o padding do body para a página da conta
            // serão gerenciados pelo AccountPageManager.init() e seus métodos internos.
            // O AccountPageManager.init() será chamado após esta função em App.initialize().
        } else {
            // Fallback para a home page se nenhuma outra corresponder
            if (homeSection) {
                this.quizUI.currentSection = 'home-section';
                activeSectionIdForLayoutManager = 'home';
                this.quizUI.showElement(homeSection);
                bodyEl.classList.remove('no-scroll');
                if(this.accountPageManager) this.accountPageManager._adjustBodyPaddingForBottomNav();
            }
        }

        // Chama o LayoutManager com o ID da página ativa
        if (this.layoutManager) {
            this.layoutManager.handleActiveSectionChange(activeSectionIdForLayoutManager);
        }

        // Atualiza contagem de questões na home se for a página inicial e os dados já carregaram
        if (activeSectionIdForLayoutManager === 'home' && this.quizData.isInitialFetchDone) {
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
            if (totalQuestionsSpanHome && this.quizUI.elements.hubTotalQuestionsCount !== totalQuestionsSpanHome) {
                totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub() || '0';
            }
        }
    }

    handleLoadError(message) {
        // (Implementação do handleLoadError permanece a mesma)
        try {
            const mainContent = document.querySelector('main') || document.body;
            let errorDisplay = mainContent.querySelector('.app-critical-error-display');
            if (!errorDisplay) {
                errorDisplay = document.createElement('div');
                errorDisplay.className = 'app-critical-error-display card';
                errorDisplay.style.cssText = `
                    padding: var(--spacing-lg, 30px);
                    margin: var(--spacing-xl, 40px) auto;
                    max-width: 600px;
                    background-color: var(--color-incorrect-bg, #fff0f1);
                    color: var(--color-incorrect-text, #c12634);
                    border: 1px solid var(--color-incorrect-border, #f1aeb5);
                    border-radius: var(--border-radius-lg, 12px);
                    text-align: center;
                    font-family: var(--font-family-sans, sans-serif);
                `;
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
        // (Implementação do disableCoreFunctionality permanece a mesma)
        if (this.quizUI && this.quizUI.elements) {
            if (this.quizUI.elements.hubCustomizeQuizBtn) this.quizUI.elements.hubCustomizeQuizBtn.disabled = true;
            if (this.quizUI.elements.hubQuickQuizBtn) this.quizUI.elements.hubQuickQuizBtn.disabled = true;

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