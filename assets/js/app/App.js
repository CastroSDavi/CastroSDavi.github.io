// File: assets/js/app/App.js

import UserData from './data/UserData.js';
import QuizData from './data/QuizData.js';
import QuizState from './core/QuizState.js';
import QuizLogic from './core/QuizLogic.js';
import ApiService from './services/ApiService.js';

import QuizUI from '../ui/QuizUI.js';               // Sobe um nível (para js/) e entra em ui/
import ChallengeHub from '../ui/ChallengeHub.js';   // Sobe um nível (para js/) e entra em ui/
import LayoutManager from '../ui/LayoutManager.js'; // Sobe um nível (para js/) e entra em ui/
import FilterPanel from '../ui/FilterPanel.js';     // Sobe um nível (para js/) e entra em ui/
import { QUICK_QUIZ_COUNT } from '../utils/constants.js'; // Sobe um nível (para js/) e entra em utils/

export default class App {
    constructor() {
        this.apiService = new ApiService();
        this.userData = new UserData();
        this.quizData = new QuizData(this.apiService);
        this.quizState = new QuizState();
        this.layoutManager = new LayoutManager();

        this.quizUI = new QuizUI(
            this.layoutManager.handleActiveSectionChange.bind(this.layoutManager)
        );
        // Certifique-se de que quizUI.elements.filterPanel (o elemento <aside>) existe
        // antes de passá-lo para FilterPanel.
        if (!this.quizUI.elements.filterPanel) {
            console.error("App.js: Elemento do painel de filtros não encontrado na QuizUI. Verifique o seletor em QuizUI._cacheDOMelements().");
        }

        this.filterPanel = new FilterPanel(
            this.quizUI.elements.filterPanel, // O elemento <aside> do painel
            null, // QuizLogic será injetado depois
            this.quizState,
            this.quizData,
            this.quizUI    // Passa QuizUI para FilterPanel poder chamar, ex, toggleFilterPanel
        );
        this.quizUI.setFilterPanelInstance(this.filterPanel); // Para QuizUI interagir com FilterPanel

        this.challengeHub = new ChallengeHub(
            this.quizUI.elements,
            null // QuizLogic será injetado depois
        );

        this.quizLogic = new QuizLogic(
            this.quizState,
            this.quizUI,
            this.userData,
            this.quizData,
            this.apiService
        );

        // Injeção de dependências cruzadas / setters
        this.challengeHub.setQuizLogic(this.quizLogic);
        this.challengeHub.setQuizUI(this.quizUI); // Para ChallengeHub poder usar métodos da QuizUI

        this.filterPanel.quizLogic = this.quizLogic; // Injeta QuizLogic diretamente no FilterPanel

        this.quizLogic.setChallengeHub(this.challengeHub);
        this.quizLogic.setFilterPanel(this.filterPanel); // QuizLogic precisa interagir com FilterPanel

        this.quizUI.setQuizState(this.quizState);
        this.quizUI.setQuizData(this.quizData);
    }

    async initialize() {
        try {
            const initialDataLoaded = await this.quizData.fetchInitialData();

            if (initialDataLoaded) {
                this.challengeHub.updateTotalQuestionsCount(this.quizData.getTotalPerguntasParaHub());
                this.challengeHub.updateQuickQuizCount(QUICK_QUIZ_COUNT);

                // A geração da árvore de categorias e o carregamento do estado dos filtros
                // são agora responsabilidade do FilterPanel. Ele usa quizData e quizState injetados.
                // O FilterPanel pode popular a si mesmo quando é tornado visível pela primeira vez,
                // ou podemos explicitamente chamar um método de inicialização aqui se necessário.
                // Por exemplo, FilterPanel.initializeContent() poderia ser chamado.
                // Por ora, a lógica em FilterPanel.loadCurrentFilters() (chamada por QuizUI.toggleFilterPanel) deve bastar.

                this.setupEventListeners();
                this.determineInitialSection();
            } else {
                this.handleLoadError("Não foi possível carregar os dados iniciais do quiz.");
            }
        } catch (error) {
            this.handleLoadError(`Erro fatal ao inicializar o quiz: ${error.message}.`);
        }
    }

    setupEventListeners() {
        // QuizUI configura listeners para elementos que ela gerencia diretamente
        // (ex: navegação do quiz, modais não-filtro, resultados)
        this.quizUI.setupGlobalEventListeners(this.quizLogic);

        // FilterPanel configura listeners para seus elementos internos
        // (ex: botões de aplicar/limpar, checkboxes de categoria/dificuldade)
        this.filterPanel.setupEventListeners();

        // ChallengeHub configura listeners para seus botões
        this.challengeHub.setupEventListeners();

        // Listeners globais da App (ex: tecla Escape)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // QuizUI gerencia a visibilidade de seus modais/painéis
                if (this.quizUI.elements.filterPanel?.classList.contains('filter-panel--visible')) {
                    this.quizUI.toggleFilterPanel(false, this.filterPanel); // Passa a instância de filterPanel
                }
                if (this.quizUI.elements.explanationModalOverlay?.classList.contains('modal--visible')) {
                    this.quizUI.toggleExplanationModal(false);
                }
                if (this.quizUI.elements.confirmEncerrarOverlay?.classList.contains('modal--visible')) {
                    this.quizUI.toggleConfirmModal(false);
                }
            }
        });

        const profileForm = document.querySelector('#account-section .profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (event) => {
                event.preventDefault();
                alert('Funcionalidade de salvar perfil ainda não implementada no backend.');
            });
        }
    }

    determineInitialSection() {
        const homeSectionEl = this.quizUI.elements.homeSection;
        const questionSectionEl = this.quizUI.elements.questionSection;
        const accountSectionEl = this.quizUI.elements.accountSection;

        if (document.getElementById('home-section') && homeSectionEl) {
            this.quizUI.currentSection = 'home-section';
            this.quizUI.showElement(homeSectionEl);
            this.quizUI.hideElement(questionSectionEl);
            this.quizUI.hideElement(accountSectionEl);
            this.layoutManager.handleActiveSectionChange(this.quizUI.currentSection);
        } else if (document.getElementById('question-section') && questionSectionEl) {
            this.quizUI.currentSection = 'question-section-page';
            this.quizUI.showElement(questionSectionEl);
            if (this.challengeHub) this.challengeHub.showHub();
            this.quizUI.hideElement(homeSectionEl);
            this.quizUI.hideElement(accountSectionEl);
            this.quizUI.hideElement(this.quizUI.elements.placeholderFiltrosContainer);
            this.quizUI.hideElement(this.quizUI.elements.quizSectionContent);
            this.quizUI.hideElement(this.quizUI.elements.resultadoCard);
            this.quizUI.hideElement(this.quizUI.elements.scorePanel);
            this.layoutManager.handleActiveSectionChange(this.quizUI.currentSection);
        } else if (document.getElementById('account-section-page') && accountSectionEl) {
            this.quizUI.currentSection = 'account-section-page';
            this.quizUI.showElement(accountSectionEl);
            this.quizUI.hideElement(homeSectionEl);
            this.quizUI.hideElement(questionSectionEl);
            this.layoutManager.handleActiveSectionChange(this.quizUI.currentSection);
        } else {
            this.quizUI.currentSection = 'home-section';
            if (homeSectionEl) this.quizUI.showElement(homeSectionEl);
            this.layoutManager.handleActiveSectionChange(this.quizUI.currentSection);
        }

        if (this.quizUI.currentSection === 'home-section') {
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
            if (totalQuestionsSpanHome && this.quizData) {
                 totalQuestionsSpanHome.textContent = this.quizData.getTotalPerguntasParaHub() || '0';
            }
        }
    }

    handleLoadError(message) {
        console.error("APPLICATION LOAD ERROR:", message);
        try {
            const mainContent = document.querySelector('main') || document.body;
            let errorDisplay = mainContent.querySelector('.app-critical-error-display');
            if (!errorDisplay) {
                errorDisplay = document.createElement('div');
                errorDisplay.className = 'app-critical-error-display';
                errorDisplay.style.padding = '20px'; errorDisplay.style.margin = '20px';
                errorDisplay.style.backgroundColor = '#fff0f1'; errorDisplay.style.color = '#c12634';
                errorDisplay.style.border = '1px solid #f1aeb5'; errorDisplay.style.borderRadius = '8px';
                errorDisplay.style.textAlign = 'center'; errorDisplay.style.fontFamily = 'Arial, sans-serif';
                if (mainContent.firstChild) mainContent.insertBefore(errorDisplay, mainContent.firstChild);
                else mainContent.appendChild(errorDisplay);
            }
            errorDisplay.innerHTML = `<h2>Erro ao Carregar Aplicação</h2><p>${message}</p><p>Por favor, tente recarregar a página. Se o problema persistir, o serviço pode estar temporariamente indisponível.</p>`;
            this.disableCoreFunctionality();
        } catch (uiError) {
            console.error("Error in handleLoadError's UI manipulation:", uiError);
            document.body.innerHTML = `<div style="padding:20px;text-align:center;color:red;">${message}</div>`;
        }
    }

    disableCoreFunctionality() {
        if (this.quizUI && this.quizUI.elements) {
            if(this.quizUI.elements.hubCustomizeQuizBtn) this.quizUI.hideElement(this.quizUI.elements.hubCustomizeQuizBtn);
            if(this.quizUI.elements.hubQuickQuizBtn) this.quizUI.hideElement(this.quizUI.elements.hubQuickQuizBtn);
            const goToHubLink = document.getElementById('go-to-challenges-hub-link');
            if (goToHubLink) this.quizUI.hideElement(goToHubLink);
        }
        if (this.challengeHub && this.challengeHub.elements.challengeHubContainer) {
            const title = this.challengeHub.elements.challengeHubContainer.querySelector('.challenge-hub__title');
            if (title) title.textContent = "Funcionalidade Indisponível";
            const subtitle = this.challengeHub.elements.challengeHubContainer.querySelector('.challenge-hub__subtitle');
            if (subtitle) subtitle.textContent = "Não foi possível carregar as questões devido a um erro.";
            if (document.getElementById('question-section') && this.challengeHub.elements.challengeHubContainer.classList.contains('u-is-hidden')) {
                 if (this.quizUI) this.quizUI.showElement(this.challengeHub.elements.challengeHubContainer);
            }
        }
    }
}