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
import StatisticsChartManager from '../ui/StatisticsChartManager.js';
import FavoriteManager from '../ui/FavoriteManager.js';
import { QUICK_QUIZ_COUNT } from '../utils/constants.js';
import SystemMessageCenter from '../ui/messages/SystemMessageCenter.js';

export default class App {
    constructor() {
        this.apiService = new ApiService();
        this.store = createStore(quizReducer);
        this.layoutManager = new LayoutManager();
        this.messageCenter = new SystemMessageCenter({
            toastContainerSelector: '#global-toast-stack',
        });
        this.quizUI = new QuizUI();
        this.quizUI.setMessageCenter(this.messageCenter);
        this.favoriteManager = new FavoriteManager(this.quizUI);
        this.accountPageManager = new AccountPageManager(this.quizUI);
        this.actionOrchestrator = new ActionOrchestrator(
            this.store,
            this.quizUI,
            this.apiService
        );

        this.initialQuestionSeed = null;
        this.initialQuestionIdHint = null;
        this._captureStandaloneQuestionSeed();

        this._applyUserThemePreference();
    }

    async initialize() {
        this._connectManagersToFlux();

        if (this.messageCenter) {
            this.messageCenter.consumeSeedMessages();
        }

        if (typeof window !== 'undefined') {
            window.MedQuizMessageCenter = this.messageCenter;
        }

        const initialSectionId = this._deriveInitialSectionId();
        this._ensureActiveSection(initialSectionId);

        try {
            if (initialSectionId === 'questions') {
                await this.actionOrchestrator.initializeAppData();
            }

            await this.actionOrchestrator.loadInitialSummary();

            this._setupUIComponents();
            this._determineInitialSection(initialSectionId);

            this.store.dispatch({ type: 'UI_READY' });

            const isQuizActive = this.store.getState().quiz.currentSessionId !== null;
            this.quizUI.displayQuizLayout(isQuizActive);

            if (initialSectionId === 'questions') {
                await this.actionOrchestrator.initializeQuizPage();
            }
            await this._handleDeepLinkParams(initialSectionId);

            if (initialSectionId === 'questions') {
                await this._processStandaloneQuestionSeed();
            }

            if (initialSectionId === 'account') {
                this.accountPageManager.init();
            }
        } catch (error) {
            console.error("App.js: initialize - Erro crítico durante a inicialização:", error);
            this.handleLoadError(`Erro crítico ao inicializar: ${error.message}. Verifique o console para mais detalhes.`);
        }
    }

    _applyUserThemePreference() {
        if (typeof document === 'undefined') {
            return;
        }

        const { body, documentElement } = document;
        if (!body || !documentElement) {
            return;
        }

        const theme = body.dataset?.userTheme;
        if (theme && theme !== 'light') {
            documentElement.setAttribute('data-theme', theme);
        } else {
            documentElement.removeAttribute('data-theme');
        }
    }
    
    _connectManagersToFlux() {
        this.layoutManager.setStore(this.store);
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
            challengeHub.setupEventListeners();
            challengeHub.handleStateChange(state);
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
        
    }
    
    _determineInitialSection(providedSectionId = null) {
        const initialSectionId = providedSectionId ?? this._deriveInitialSectionId();
        this._ensureActiveSection(initialSectionId);

        if (initialSectionId === 'home') {
            const totalQuestionsSpanHome = document.getElementById('hub-total-questions-count');
            const heroStatElement = document.getElementById('challenge-stat-total');
            if (totalQuestionsSpanHome || heroStatElement) {
                const state = this.store.getState();
                const totalQuestions = state.geral.totalQuestionsAvailable;
                const formattedTotal = typeof totalQuestions === 'number'
                    ? totalQuestions.toLocaleString('pt-BR')
                    : (totalQuestions || '0');
                if (totalQuestionsSpanHome) {
                    totalQuestionsSpanHome.textContent = formattedTotal;
                }
                if (heroStatElement) {
                    heroStatElement.textContent = formattedTotal;
                }
            }
        }
    }

    _deriveInitialSectionId() {
        if (typeof document === 'undefined') {
            return 'home';
        }

        const bodyPageId = document.body?.dataset?.pageId || 'home';
        const validSections = ['home', 'questions', 'account'];
        return validSections.includes(bodyPageId) ? bodyPageId : 'home';
    }

    _ensureActiveSection(targetSection) {
        if (!this.store || !targetSection) {
            return;
        }

        const currentActive = this.store.getState()?.ui?.activeSection;
        if (currentActive !== targetSection) {
            this.store.dispatch(quizActions.setActiveSection(targetSection));
        }
    }

    async _handleDeepLinkParams(initialSectionId) {
        if (typeof window === 'undefined') {
            return;
        }

        const search = window.location.search;
        if (!search || typeof search !== 'string') {
            return;
        }

        const params = new URLSearchParams(search);
        let paramsUpdated = false;

        if (initialSectionId === 'questions') {
            const predefinedSlug = params.get('predefined_slug') || params.get('challenge_slug');
            if (predefinedSlug) {
                try {
                    const handled = await this.actionOrchestrator.startPredefinedQuizBySlug(predefinedSlug);
                    if (handled) {
                        params.delete('predefined_slug');
                        params.delete('challenge_slug');
                        paramsUpdated = true;
                    }
                } catch (error) {
                    console.error('App.js: falha ao processar slug de desafio.', error);
                }
            }
        }

        const supportParam = params.get('support') || params.get('support_contact') || params.get('open_support');
        if (supportParam) {
            const normalized = String(supportParam).trim().toLowerCase();
            if (['1', 'true', 'yes', 'sim'].includes(normalized)) {
                if (this.quizUI && typeof this.quizUI.openSupportRequestModal === 'function') {
                    this.quizUI.openSupportRequestModal();
                }
                params.delete('support');
                params.delete('support_contact');
                params.delete('open_support');
                paramsUpdated = true;
            }
        }

        if (paramsUpdated) {
            const hash = window.location.hash || '';
            const newSearch = params.toString();
            const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + hash;
            window.history.replaceState({}, document.title, newUrl);
        }
    }

    _captureStandaloneQuestionSeed() {
        this.initialQuestionSeed = null;
        this.initialQuestionIdHint = null;

        if (typeof document === 'undefined') {
            return;
        }

        const bodyIdRaw = document.body?.dataset?.initialQuestionId;
        const normalizedBodyId = this._normalizeQuestionId(bodyIdRaw);
        if (normalizedBodyId) {
            this.initialQuestionIdHint = normalizedBodyId;
        }

        const scriptElement = document.getElementById('initial-question-data');
        if (!scriptElement) {
            if (normalizedBodyId) {
                this.initialQuestionSeed = { question_id: normalizedBodyId };
            }
            return;
        }

        const rawContent = scriptElement.textContent || scriptElement.innerText || '';
        scriptElement.remove();

        if (!rawContent.trim()) {
            if (normalizedBodyId) {
                this.initialQuestionSeed = { question_id: normalizedBodyId };
            }
            return;
        }

        try {
            const parsed = JSON.parse(rawContent);
            if (parsed && typeof parsed === 'object') {
                const seed = { ...parsed };
                const parsedId = this._normalizeQuestionId(seed.question_id);
                if (parsedId) {
                    seed.question_id = parsedId;
                } else if (normalizedBodyId) {
                    seed.question_id = normalizedBodyId;
                }
                this.initialQuestionSeed = seed;
                return;
            }
        } catch (error) {
            console.warn('App.js: falha ao interpretar payload de questão inicial.', error);
        }

        if (normalizedBodyId) {
            this.initialQuestionSeed = { question_id: normalizedBodyId };
        }
    }

    _normalizeQuestionId(value) {
        if (value === undefined || value === null) {
            return null;
        }
        const parsed = Number.parseInt(String(value).trim(), 10);
        return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
    }

    _resolveStandaloneQuestionId(seed = null) {
        if (seed && seed.question_id) {
            return this._normalizeQuestionId(seed.question_id);
        }
        return this.initialQuestionIdHint ?? null;
    }

    async _processStandaloneQuestionSeed() {
        const seed = this.initialQuestionSeed;
        const state = this.store.getState();

        if (!seed) {
            return;
        }

        const hasActiveSession = state.quiz.currentSessionId !== null;
        if (hasActiveSession) {
            this.initialQuestionSeed = null;
            return;
        }

        const hasResumableSession = !!state.quiz.resumableSession;
        if (hasResumableSession && seed.auto_resume_if_session !== false) {
            this.actionOrchestrator._proceedWithResumedSession();
            this.initialQuestionSeed = null;
            return;
        }

        const questionId = this._resolveStandaloneQuestionId(seed);
        let questionPayload = seed.question || null;
        let scorePanelSettings = seed.score_panel_settings || null;
        let quizTitle = typeof seed.quiz_title === 'string' ? seed.quiz_title : null;
        const mode = typeof seed.mode === 'string' && seed.mode.trim() ? seed.mode.trim() : 'Standalone';

        let loadingShown = false;
        const showLoading = () => {
            if (!loadingShown) {
                const message =
                    typeof seed.loading_message === 'string' && seed.loading_message.trim()
                        ? seed.loading_message.trim()
                        : 'Carregando questão...';
                this.quizUI.showSessionLoadingIndicator(true, message);
                loadingShown = true;
            }
        };
        const hideLoading = () => {
            if (loadingShown) {
                this.quizUI.showSessionLoadingIndicator(false);
                loadingShown = false;
            }
        };

        const shouldFetchRemote = Number.isInteger(questionId) && questionId > 0;

        if (shouldFetchRemote) {
            showLoading();
        }

        if (!questionPayload && (!Number.isInteger(questionId) || questionId <= 0)) {
            hideLoading();
            this.initialQuestionSeed = null;
            return;
        }

        if (shouldFetchRemote) {
            try {
                const response = await this.apiService.getQuestionDetail(questionId);
                if (response && response.status === 'success' && response.question) {
                    questionPayload = response.question;
                    if (response.score_panel_settings) {
                        scorePanelSettings = response.score_panel_settings;
                    }
                    if (!quizTitle && typeof response.quiz_title === 'string') {
                        quizTitle = response.quiz_title;
                    }
                } else if (!questionPayload) {
                    console.warn('App.js: resposta inesperada ao tentar carregar a questão.', response);
                }
            } catch (error) {
                console.warn('App.js: falha ao buscar detalhes atualizados da questão.', error);
            }
        }

        if (!questionPayload) {
            hideLoading();
            this.initialQuestionSeed = null;
            return;
        }

        const launched = this.actionOrchestrator.launchStandaloneQuestion(questionPayload, {
            quizTitle,
            scorePanelSettings,
            mode,
        });

        hideLoading();

        if (launched) {
            this.initialQuestionSeed = null;
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
        } catch (uiError) {
            console.error("App.js: Error displaying critical load error to UI:", uiError);
        }
    }
}
