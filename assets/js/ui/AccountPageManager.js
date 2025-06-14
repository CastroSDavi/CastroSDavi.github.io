// assets/js/ui/AccountPageManager.js

import { quizActions } from '../app/flux/actions.js';

export default class AccountPageManager {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        
        this.store = null;
        this.actionOrchestrator = null;
        this.statisticsChartManager = null;
        this.favoriteManager = null;

        this.hasInitialized = false;
        this.previousActiveTab = null;
        
        this.elements = { 
            accountSectionPage: document.getElementById('account-section-page'),
            sidebar: document.querySelector('#account-section-page .account-sidebar'),
            contentArea: document.querySelector('#account-section-page .account-content'),
            backToMenuButton: document.getElementById('account-back-to-menu'),
            sidebarLinks: null, 
            contentSections: null, 
            btnOpenDeleteModal: this.quizUI.elements.btnOpenDeleteAccountModal,
            deleteAccountForm: this.quizUI.elements.deleteAccountForm,
            passwordInputDelete: this.quizUI.elements.passwordInputDeleteAccount,
        };
        this.bodyAccountContentActiveClassName = 'body-account-content-active';
        this.bodyElement = document.body;
        // --- INÍCIO DA CORREÇÃO ---
        // A referência ao bottomNavElement foi removida daqui.
        // --- FIM DA CORREÇÃO ---
        this.defaultMenuTargetId = 'profile-info-content';
    }

    setStore(storeInstance) {
        this.store = storeInstance;
        if(this.store) {
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }
    
    setStatisticsChartManager(manager) {
        this.statisticsChartManager = manager;
    }

    setFavoriteManager(manager) {
        this.favoriteManager = manager;
    }

    init() {
        if (this.hasInitialized || !this.elements.accountSectionPage || (this.bodyElement.dataset.pageId !== 'account')) {
            return;
        }

        this.elements.sidebarLinks = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-sidebar__link'));
        this.elements.contentSections = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-content__section'));

        if (this.elements.sidebarLinks.length === 0 || this.elements.contentSections.length === 0) return;

        this.defaultMenuTargetId = this.elements.sidebarLinks[0]?.dataset.target || 'profile-info-content';
        
        this._setupEventListeners();
        this._setInitialTabFromURL();

        this._updateUIVisibility(!this._isMobileView());
        
        this.hasInitialized = true;
    }

    _setupEventListeners() {
        this.elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetId = link.dataset.target;
                this.store.dispatch(quizActions.setAccountPageTab(targetId));
                
                if (this._isMobileView()) {
                    this._updateUIVisibility(true);
                }
            });
        });

        this.elements.backToMenuButton?.addEventListener('click', () => {
            if (this._isMobileView()) {
                this._updateUIVisibility(false); 
            }
        });

        window.addEventListener('resize', this._handleResize.bind(this));

        this.elements.btnOpenDeleteModal?.addEventListener('click', () => {
            if (this.quizUI.modalManager) {
                this.quizUI.modalManager.toggleDeleteAccountModal(true);
            }
        });
    }

    handleStateUpdate() {
        if (!this.hasInitialized || !this.store) return;

        const currentState = this.store.getState();
        const newActiveTab = currentState.ui.accountPageActiveTab;

        if (newActiveTab !== this.previousActiveTab) {
            this.previousActiveTab = newActiveTab;
            
            this.setActiveTab(newActiveTab);
            this._loadDynamicContent(newActiveTab);
        }
    }
    
    _loadDynamicContent(targetId) {
        if (targetId === 'favorite-questions-content' && this.favoriteManager) {
            this.favoriteManager.init();
            const favoritesState = this.store.getState().user.favorites;
            if (!favoritesState.hasBeenFetched && !favoritesState.isLoading) {
                this.actionOrchestrator?.loadAndDisplayFavoriteQuestionsForAccountPage();
            }
        } else if (targetId === 'statistics-content' && this.statisticsChartManager) {
            this.statisticsChartManager.init();
        }
    }

    _setInitialTabFromURL() {
        const hash = window.location.hash;
        const activeTabOnError = this.bodyElement.dataset.activeTabOnError;
        let initialTabId = this.defaultMenuTargetId;

        if (activeTabOnError) {
            initialTabId = activeTabOnError;
        } else if (hash) {
            const linkByHash = this.elements.sidebarLinks.find(link => link.getAttribute('href') === hash);
            if (linkByHash) {
                initialTabId = linkByHash.dataset.target;
            }
        }
        
        this.store.dispatch(quizActions.setAccountPageTab(initialTabId));

        const showDeleteModalOnError = this.bodyElement.dataset.showDeleteModalOnError === 'true';
        if (activeTabOnError && showDeleteModalOnError && activeTabOnError === 'security-content') {
            setTimeout(() => {
                if (this.quizUI.modalManager) {
                    this.quizUI.modalManager.toggleDeleteAccountModal(true);
                }
            }, 150);
        }
    }

    setActiveTab(targetId) {
        if (!this.elements.sidebarLinks || !this.elements.contentSections) return;
        
        const linkToActivate = this.elements.sidebarLinks.find(link => link.dataset.target === targetId);

        this.elements.sidebarLinks.forEach(link => {
            link.classList.toggle('is-active', link === linkToActivate);
            link.setAttribute('aria-current', link === linkToActivate ? 'page' : 'false');
        });

        this.elements.contentSections.forEach(section => {
            const isVisible = section.id === targetId;
            section.classList.toggle('is-visible', isVisible);
            section.setAttribute('aria-hidden', String(!isVisible));
            if (isVisible) {
                const title = section.querySelector('.card__title');
                title?.focus({ preventScroll: true });
            }
        });
    }

    _isMobileView() { 
        return window.innerWidth <= 768; 
    }

    // --- INÍCIO DA CORREÇÃO ---
    // O método _adjustBodyPaddingForBottomNav foi completamente removido,
    // pois a lógica de espaçamento agora será tratada puramente por CSS.
    // --- FIM DA CORREÇÃO ---

    _updateUIVisibility(isContentActive) {
        const isMobile = this._isMobileView();
        if (isMobile) {
            this.quizUI.showElement(isContentActive ? this.elements.backToMenuButton : this.elements.sidebar);
            this.quizUI.hideElement(isContentActive ? this.elements.sidebar : this.elements.backToMenuButton);
            this.quizUI.showElement(isContentActive ? this.elements.contentArea : null);
            this.quizUI.hideElement(isContentActive ? null : this.elements.contentArea);
            
            this.bodyElement.classList.toggle(this.bodyAccountContentActiveClassName, isContentActive);
        } else { // Desktop
            [this.elements.sidebar, this.elements.contentArea].forEach(el => this.quizUI.showElement(el));
            this.quizUI.hideElement(this.elements.backToMenuButton);
            this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
        }
        // A chamada ao _adjustBodyPaddingForBottomNav também foi removida daqui.
    }

    _handleResize() {
        if (!this.hasInitialized) return;
        const isContentVisible = this.elements.contentArea && !this.elements.contentArea.classList.contains('u-is-hidden');
        this._updateUIVisibility(this._isMobileView() ? isContentVisible : true);
    }
    
    _scrollToContentTop() {
        if (this.elements.contentArea?.classList.contains('is-visible') && this.elements.contentArea.scrollHeight > this.elements.contentArea.clientHeight) {
            this.elements.contentArea.scrollTop = 0;
        } 
        else if (this.elements.sidebar && !this.elements.sidebar.classList.contains('u-is-hidden') && this.elements.sidebar.scrollHeight > this.elements.sidebar.clientHeight && this._isMobileView()) {
            this.elements.sidebar.scrollTop = 0;
        }
    }
}