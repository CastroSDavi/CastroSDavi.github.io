// File: assets/js/app/App.js

import ApiService from './services/ApiService.js';
import { createStore } from './flux/store.js';
import { quizReducer } from './flux/reducer.js';
import ActionOrchestrator from './flux/ActionOrchestrator.js';
import { quizActions } from './flux/actions.js';
import QuizUI from '../ui/QuizUI.js';
import ChallengeHub from '../ui/ChallengeHub.js';
import LayoutManager from '../ui/LayoutManager.js';
import FilterPanel from '../ui/FilterPanel.js';
import ResultDisplay from '../ui/ResultDisplay.js';
import AccountPageManager from '../ui/AccountPageManager.js';
import BottomNavManager from '../ui/BottomNavManager.js';
import StatisticsChartManager from '../ui/StatisticsChartManager.js';
import FavoriteManager from '../ui/FavoriteManager.js';
import { QUICK_QUIZ_COUNT } from '../utils/constants.js';

export default class App {
    constructor() {
        this.apiService = new ApiService();
        this.store = createStore(quizReducer);
        this.layoutManager = new LayoutManager();
        this.bottomNavManager = new BottomNavManager();
        this.quizUI = new QuizUI();
        this.favoriteManager = new FavoriteManager(this.quizUI);
        this.accountPageManager = new AccountPageManager(this.quizUI);
        this.actionOrchestrator = new ActionOrchestrator(
            this.store,
            this.quizUI,
            this.apiService
        );
    }

    async initialize() {
        this._connectManagersToFlux();

        const currentPageId = document.body.dataset.pageId || 'home';

        try {
            if (currentPageId === 'questions') {
                await this.actionOrchestrator.initializeAppData();
            } else if (currentPageId === 'home') {
                await this.actionOrchestrator.loadInitialSummary();
            }

            this._setupUIComponents();
            this._determineInitialSection();

            this.store.dispatch({ type: 'UI_READY' });

            const isQuizActive = this.store.getState().quiz.currentSessionId !== null;
            this.quizUI.displayQuizLayout(isQuizActive);

            if (currentPageId === 'questions') {
                await this.actionOrchestrator.initializeQuizPage();
                await this._handlePendingFavoriteReview();
            } else if (currentPageId === 'account') {
                this.accountPageManager.init();
            }
        } catch (error) {
            console.error("App.js: initialize - Erro crítico durante a inicialização:", error);
            this.handleLoadError(`Erro crítico ao inicializar: ${error.message}. Verifique o console para mais detalhes.`);
        }
    }
    
    _connectManagersToFlux() {
        this.layoutManager.setStore(this.store);
        this.bottomNavManager.setStore(this.store);
        this.quizUI.setStore(this.store);
        this.accountPageManager.setStore(this.store);
        this.favoriteManager.setStore(this.store);
        
        this.quizUI.setActionOrchestrator(this.actionOrchestrator);
        this.accountPageManager.setActionOrchestrator(this.actionOrchestrator);
        this.favoriteManager.setActionOrchestrator(this.actionOrchestrator);
    }

    _setupUIComponents() {
        const state = this.store.getState();
        
        if (this.quizUI.elements.filterPanel) {
            const filterPanel = new FilterPanel(this.quizUI.elements.filterPanel, this.quizUI);
            filterPanel.setStore(this.store);
            filterPanel.setActionOrchestrator(this.actionOrchestrator);
            this.quizUI.setFilterPanelInstance(filterPanel);
            filterPanel.setupEventListeners();
        }

        if (this.quizUI.elements.challengeHubContainer) {
            const challengeHub = new ChallengeHub(this.quizUI);
            challengeHub.setActionOrchestrator(this.actionOrchestrator);
            this.quizUI.setChallengeHubInstance(challengeHub);
            const totalQuestions = typeof state.geral.totalQuestionsAvailable === 'number'
                ? state.geral.totalQuestionsAvailable.toLocaleString('pt-BR')
                : state.geral.totalQuestionsAvailable;
            challengeHub.updateTotalQuestionsCount(totalQuestions);
            const quickQuizCount = state.geral.homeSummary?.quickQuizDefaultCount ?? QUICK_QUIZ_COUNT;
            challengeHub.updateQuickQuizCount(quickQuizCount);
            challengeHub.setupEventListeners();
        }

        const resultDisplay = new ResultDisplay(this.quizUI, this.quizUI.timer);
        resultDisplay.setActionOrchestrator(this.actionOrchestrator);
        resultDisplay.init();
        this.quizUI.setResultDisplayInstance(resultDisplay);
        
        if (document.getElementById('account-section-page')) {
            const statisticsManager = new StatisticsChartManager(this.quizUI);
            statisticsManager.setStore(this.store);
            statisticsManager.setActionOrchestrator(this.actionOrchestrator);
            
            this.accountPageManager.setStatisticsChartManager(statisticsManager);
            this.accountPageManager.setFavoriteManager(this.favoriteManager);
        }
        
        this.bottomNavManager.init();
    }
    
    _determineInitialSection() {
        const bodyPageId = document.body.dataset.pageId || 'home';
        let initialSectionId = 'home';

        const validSections = ['home', 'questions', 'account'];
        if (validSections.includes(bodyPageId)) {
            initialSectionId = bodyPageId;
        }

        this.store.dispatch(quizActions.setActiveSection(initialSectionId));

        if (initialSectionId === 'home') {
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
            if (totalQuestionsSpanHome) {
                const state = this.store.getState();
                const totalQuestions = state.geral.totalQuestionsAvailable;
                const formattedTotal = typeof totalQuestions === 'number'
                    ? totalQuestions.toLocaleString('pt-BR')
                    : (totalQuestions || '0');
                totalQuestionsSpanHome.textContent = formattedTotal;
            }
        }
    }

    async _handlePendingFavoriteReview() {
        if (!this.favoriteManager || typeof this.favoriteManager.consumePendingReviewRequest !== 'function') {
            return;
        }

        const pendingReview = this.favoriteManager.consumePendingReviewRequest();
        if (!pendingReview || !pendingReview.questionId) {
            return;
        }

        await this.actionOrchestrator.reviewFavoriteQuestion(
            pendingReview.questionId,
            pendingReview.questionData || null
        );
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
        } catch (uiError) {
            console.error("App.js: Error displaying critical load error to UI:", uiError);
        }
    }
}