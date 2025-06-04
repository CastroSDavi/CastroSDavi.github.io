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

import { QUICK_QUIZ_COUNT } from '../utils/constants.js'; // Usado para atualizar a UI

export default class App {
    constructor() {
        this.apiService = new ApiService();
        this.userData = new UserData();
        this.quizData = new QuizData(this.apiService);
        this.quizState = new QuizState(); // QuizState agora tem mais informações de sessão

        this.layoutManager = new LayoutManager();
        this.quizUI = new QuizUI(
            this.layoutManager.handleActiveSectionChange.bind(this.layoutManager)
        );

        this.quizUI.setQuizState(this.quizState);
        this.quizUI.setQuizData(this.quizData);
        this.quizUI.setApiService(this.apiService);

        if (this.quizUI.elements.filterPanel) {
            const filterPanel = new FilterPanel(
                this.quizUI.elements.filterPanel,
                null,
                this.quizState,
                this.quizData,
                this.quizUI,
                this.apiService
            );
            this.quizUI.setFilterPanelInstance(filterPanel);
        }

        if (this.quizUI.elements.challengeHubContainer) {
            const challengeHub = new ChallengeHub(this.quizUI);
            // ChallengeHub agora pode precisar de uma forma de listar Quizzes Definidos
            // e chamar this.quizLogic.startPredefinedQuiz(quizId)
            this.quizUI.setChallengeHubInstance(challengeHub);
        }

        const resultDisplay = new ResultDisplay(this.quizUI, this.quizUI.timer);
        this.quizUI.setResultDisplayInstance(resultDisplay);

        this.quizLogic = new QuizLogic(
            this.quizState,
            this.quizUI,
            this.userData,
            this.quizData,
            this.apiService
        );

        if (this.quizUI.filterPanelInstance) {
            this.quizUI.filterPanelInstance.quizLogic = this.quizLogic;
        }
        if (this.quizUI.challengeHubInstance) {
            this.quizUI.challengeHubInstance.setQuizLogic(this.quizLogic);
        }

        // Callbacks para QuizUI (passados para QuestionDisplay, ScorePanel, ResultDisplay)
        // Estes já devem estar configurados para usar os métodos corretos de QuizLogic
        this.quizUI.setCallbacks({
            answerQuestionCallback: this.quizLogic.answerQuestion.bind(this.quizLogic),
            navigationCallback: this.quizLogic._handleQuestionNavigation.bind(this.quizLogic),
            toggleFavoriteCallback: this.quizLogic.toggleFavoriteCurrentQuestion.bind(this.quizLogic),
            endSessionCallback: () => {
                if (this.quizUI.modalManager) this.quizUI.modalManager.toggleConfirmModal(true);
            },
            restartQuizCallback: this.quizLogic.restartQuiz.bind(this.quizLogic),
        });

        this.accountPageManager = new AccountPageManager(this.quizUI, this.apiService);
    }

    async initialize() {
        try {
            const initialDataLoaded = await this.quizData.fetchInitialData();

            if (initialDataLoaded) {
                if (this.quizUI.challengeHubInstance) {
                    this.quizUI.challengeHubInstance.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub());
                    this.quizUI.challengeHubInstance.updateQuickQuizCount(QUICK_QUIZ_COUNT); // Pode ser atualizado para usar ConfiguracoesGeraisQuiz
                }

                this.setupEventListeners(); // Configura listeners globais e de componentes de UI
                this.determineInitialSection(); // Determina qual seção da página exibir

                // Se a página atual for a de questões, tenta retomar uma sessão
                // Isso deve ser feito após a UI inicial estar pronta.
                if (document.body.dataset.pageId === 'questions') {
                    // Adicionar uma pequena espera para garantir que a UI inicial tenha sido renderizada,
                    // especialmente se houver transições.
                    await new Promise(resolve => setTimeout(resolve, 50)); // 50ms de espera
                    await this.quizLogic.initializeQuizPage(); // Chama o método para tentar retomar
                }

                if (document.body.dataset.pageId === 'account') {
                    this.accountPageManager.init();
                }
            } else {
                this.handleLoadError("Não foi possível carregar os dados essenciais do quiz.");
            }
        } catch (error) {
            this.handleLoadError(`Erro crítico ao inicializar: ${error.message}.`);
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
            // Aqui você pode adicionar listeners para botões de quizzes pré-definidos, se eles forem
            // renderizados pelo ChallengeHub. Ex:
            // this.quizUI.challengeHubInstance.setOnPredefinedQuizSelectListener(
            //     (quizId) => this.quizLogic.startPredefinedQuiz(quizId)
            // );
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                let modalHandled = false;
                if (this.quizUI?.modalManager) {
                    modalHandled = this.quizUI.modalManager.handleEscapeKey();
                }
                // Adicione outras lógicas de 'Esc' se necessário (ex: fechar dropdowns)
                // ...
            }
        });
    }

    determineInitialSection() {
        if (!this.quizUI || !this.quizUI.elements) {
            return;
        }
        const { homeSection, questionSection, accountSection, quizSectionContent, scorePanel, resultadoCard, placeholderFiltrosContainer } = this.quizUI.elements;
        const bodyEl = document.body;
        const bodyPageId = bodyEl.dataset.pageId;

        // Esconde todos os painéis de conteúdo principal inicialmente
        const mainPanels = [
            homeSection, questionSection, accountSection,
            quizSectionContent, resultadoCard, placeholderFiltrosContainer
        ];
        mainPanels.forEach(el => { if (el) this.quizUI.hideElement(el); });
        if (scorePanel) this.quizUI.scorePanel.hide();


        let activeSectionIdForLayoutManager = 'unknown';

        if (bodyPageId === 'home' && homeSection) {
            this.quizUI.currentSection = 'home-section';
            activeSectionIdForLayoutManager = 'home';
            this.quizUI.showElement(homeSection);
        } else if (bodyPageId === 'questions' && questionSection) {
            this.quizUI.currentSection = 'question-section';
            activeSectionIdForLayoutManager = 'questions';
            this.quizUI.showElement(questionSection);
            // Não mostra o hub imediatamente; a lógica de initializeQuizPage decidirá
            // se mostra o hub ou retoma uma sessão.
        } else if (bodyPageId === 'account' && accountSection) {
            this.quizUI.currentSection = 'account-section-page';
            activeSectionIdForLayoutManager = 'account';
            this.quizUI.showElement(accountSection);
        } else {
            if (homeSection) {
                this.quizUI.currentSection = 'home-section';
                activeSectionIdForLayoutManager = 'home';
                this.quizUI.showElement(homeSection);
            }
        }

        if (bodyPageId !== 'account') {
            bodyEl.classList.remove('no-scroll'); // Certifica que no-scroll não está ativo
            if (this.accountPageManager) this.accountPageManager._adjustBodyPaddingForBottomNav();
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
        // (Implementação existente para mostrar erro na UI)
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
            // console.error("App.js: Error displaying critical load error to UI:", uiError);
            document.body.innerHTML = `<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:white; color:red; padding:20px; text-align:center; z-index:10000; font-family:sans-serif;"><h1>Erro Crítico</h1><p>${message}</p></div>`;
        }
    }

    disableCoreFunctionality() {
        // (Implementação existente para desabilitar partes da UI em caso de erro crítico)
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
                    if (subtitle) subtitle.textContent = "Não foi possível carregar os dados.";

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