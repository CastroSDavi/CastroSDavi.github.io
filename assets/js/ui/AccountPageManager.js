// assets/js/ui/AccountPageManager.js

import StatisticsChartManager from './StatisticsChartManager.js';

export default class AccountPageManager {
    constructor(quizUIInstance, apiServiceInstance) {
        this.quizUI = quizUIInstance;
        this.apiService = apiServiceInstance; 
        // console.log("AccountPageManager constructor: apiServiceInstance received:", this.apiService);

        this.elements = {
            accountSectionPage: document.getElementById('account-section-page'),
            sidebar: document.querySelector('#account-section-page .account-sidebar'),
            contentArea: document.querySelector('#account-section-page .account-content'),
            backToMenuButton: document.getElementById('account-back-to-menu'),
            sidebarLinks: null, 
            contentSections: null, 
            deleteAccountModalOverlay: document.getElementById('delete-account-modal-overlay'),
            deleteAccountModalDialog: document.getElementById('delete-account-modal-dialog'),
            btnOpenDeleteModal: document.getElementById('btn-open-delete-account-modal'),
            btnCancelDelete: document.getElementById('cancel-delete-account-btn'),
            deleteAccountForm: document.getElementById('deleteAccountForm'),
            passwordInputDelete: null
        };
        this.bodyAccountContentActiveClassName = 'body-account-content-active';
        this.bodyElement = document.body;
        this.bottomNavElement = document.querySelector('.bottom-nav');
        this.defaultMenuTargetId = 'profile-info-content';
        this.lastActiveContentTargetId = this.defaultMenuTargetId;
        this.activeSectionTitleElement = null;

        if (this.elements.deleteAccountForm) {
            this.elements.passwordInputDelete = this.elements.deleteAccountForm.querySelector('input[name="password"]');
        }

        if (this.apiService) {
            this.statisticsChartManager = new StatisticsChartManager(this.quizUI, this.apiService);
            // console.log("AccountPageManager constructor: StatisticsChartManager initialized with apiService:", this.statisticsChartManager.apiService);
        } else {
            console.error("AccountPageManager CRITICAL: ApiService instance is undefined. StatisticsChartManager will not be initialized correctly.");
            this.statisticsChartManager = null;
        }
        // this.hasCalledStatsInit = false; // Removido - A lógica de "já inicializado" está no StatisticsChartManager.init()
    }

    init() {
        if (!this.elements.accountSectionPage || (this.bodyElement.dataset.pageId !== 'account')) {
            return;
        }
        // console.log("AccountPageManager.init() called.");

        this.elements.sidebarLinks = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-sidebar__link'));
        this.elements.contentSections = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-content__section'));

        if (this.elements.sidebarLinks.length === 0 || this.elements.contentSections.length === 0) {
            console.warn("AccountPageManager: Links da barra lateral ou seções de conteúdo não encontrados.");
            return;
        }

        const firstLink = this.elements.sidebarLinks[0];
        if (firstLink && firstLink.dataset.target) {
            this.defaultMenuTargetId = firstLink.dataset.target;
            this.lastActiveContentTargetId = this.defaultMenuTargetId;
        }

        this._setupEventListeners();
        this._determineAndActivateTab(window.history.state, window.location.hash, true);
        this._handleResize();

        const activeTabOnError = this.bodyElement.dataset.activeTabOnError;
        const showDeleteModalOnError = this.bodyElement.dataset.showDeleteModalOnError === 'true';

        if (activeTabOnError && showDeleteModalOnError && activeTabOnError === 'security-content') {
            const securityLink = this.elements.sidebarLinks.find(link => link.dataset.target === 'security-content');
            if (securityLink) {
                this.setActiveTab(securityLink, 'security-content');
                this._loadDynamicContent('security-content');
                this._updateUIVisibility(true);
                setTimeout(() => {
                    this._toggleDeleteAccountModal(true);
                }, 150);
            }
        }
    }

    _setupEventListeners() {
        this.elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetId = link.dataset.target;
                const newHash = link.getAttribute('href');
                this.lastActiveContentTargetId = targetId;

                if (window.history.pushState) {
                    window.history.pushState({ target: targetId, isAccountSectionContent: true }, '', newHash);
                }
                this.setActiveTab(link, targetId);
                this._loadDynamicContent(targetId);
                this._updateUIVisibility(true);
                this._scrollToContentTop();
                
                this.activeSectionTitleElement = document.querySelector(`#${targetId} .card__title`);
                this.activeSectionTitleElement?.focus({ preventScroll: true });
            });
        });

        this.elements.backToMenuButton?.addEventListener('click', () => {
            if (this._isMobileView()) {
                const targetLink = this.elements.sidebarLinks.find(l => l.dataset.target === this.lastActiveContentTargetId) || this.elements.sidebarLinks[0];
                const menuHash = targetLink ? targetLink.getAttribute('href') : '#profile-info';
                
                if (window.history.pushState) {
                    window.history.pushState({ target: this.lastActiveContentTargetId, isAccountSectionMenu: true }, '', menuHash);
                }
                this._determineAndActivateTab({ target: this.lastActiveContentTargetId, isAccountSectionMenu: true }, menuHash, false, false);
                targetLink?.focus({ preventScroll: false });
            }
        });

        window.addEventListener('popstate', (event) => {
            if (this.bodyElement.dataset.pageId === 'account') {
                this._determineAndActivateTab(event.state, window.location.hash, false, true);
            }
        });

        window.addEventListener('resize', this._handleResize.bind(this));

        this.elements.btnOpenDeleteModal?.addEventListener('click', () => this._toggleDeleteAccountModal(true));
        this.elements.btnCancelDelete?.addEventListener('click', (event) => {
            event.preventDefault(); this._toggleDeleteAccountModal(false);
        });
        this.elements.deleteAccountModalOverlay?.addEventListener('click', (event) => {
            if (event.target === this.elements.deleteAccountModalOverlay) this._toggleDeleteAccountModal(false);
        });
    }
    
    _isMobileView() { return window.innerWidth <= 768; }

    _adjustBodyPaddingForBottomNav() {
        if (!this.bottomNavElement) return;
        if (this._isMobileView()) {
            this.bodyElement.style.paddingBottom = this.bodyElement.classList.contains(this.bodyAccountContentActiveClassName) ? '0' : `var(--bottom-nav-height, 60px)`;
        } else {
            this.bodyElement.style.paddingBottom = '';
        }
    }

    _updateUIVisibility(isContentActive) {
        const isMobile = this._isMobileView();
        if (isMobile) {
            this.quizUI.showElement(isContentActive ? this.elements.backToMenuButton : this.elements.sidebar);
            this.quizUI.hideElement(isContentActive ? this.elements.sidebar : this.elements.backToMenuButton);
            this.quizUI.showElement(isContentActive ? this.elements.contentArea : null);
            this.quizUI.hideElement(isContentActive ? null : this.elements.contentArea);
            
            this.bodyElement.classList.toggle(this.bodyAccountContentActiveClassName, isContentActive);
            if(this.bottomNavElement) this.quizUI.showElement(isContentActive ? null : this.bottomNavElement);
            if(this.bottomNavElement) this.quizUI.hideElement(isContentActive ? this.bottomNavElement : null);
        } else {
            [this.elements.sidebar, this.elements.contentArea].forEach(el => this.quizUI.showElement(el));
            this.quizUI.hideElement(this.elements.backToMenuButton);
            this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
            if(this.bottomNavElement) this.quizUI.hideElement(this.bottomNavElement);
        }
        this._adjustBodyPaddingForBottomNav();
    }

    _handleResize() {
        const contentVisible = this.elements.contentArea && !this.elements.contentArea.classList.contains('u-is-hidden');
        this._updateUIVisibility(this._isMobileView() ? contentVisible : true);
    }

    _determineAndActivateTab(historyState, currentHash, isInitialLoad = false, isPopStateCall = false) {
        let targetIdToShow = null;
        let showContentArea = !this._isMobileView();
        const activeTabOnError = this.bodyElement.dataset.activeTabOnError;

        if (historyState && historyState.target) {
            targetIdToShow = historyState.target;
            showContentArea = historyState.isAccountSectionContent !== undefined ? historyState.isAccountSectionContent : showContentArea;
        } else if (currentHash) {
            const linkByHash = this.elements.sidebarLinks.find(link => link.getAttribute('href') === currentHash);
            if (linkByHash) {
                targetIdToShow = linkByHash.dataset.target;
                showContentArea = true;
            }
        }
        
        if (isInitialLoad && activeTabOnError && (!targetIdToShow || (historyState && !historyState.isAccountSectionMenu))) {
            const linkForErrorTab = this.elements.sidebarLinks.find(link => link.dataset.target === activeTabOnError);
            if (linkForErrorTab) {
                targetIdToShow = activeTabOnError;
                showContentArea = true;
                if (!isPopStateCall && window.history.replaceState) {
                    const newHashForErrorTab = linkForErrorTab.getAttribute('href');
                    if(window.location.hash !== newHashForErrorTab) {
                        window.history.replaceState({ target: targetIdToShow, isAccountSectionContent: true }, '', newHashForErrorTab);
                    }
                }
            }
        }

        if (!targetIdToShow) targetIdToShow = this.defaultMenuTargetId;
        
        if (this._isMobileView() && showContentArea && targetIdToShow === this.defaultMenuTargetId && !isInitialLoad && !currentHash && !(historyState && historyState.isAccountSectionContent)) {
            showContentArea = false;
        }
        
        this.lastActiveContentTargetId = targetIdToShow;
        const linkToActivate = this.elements.sidebarLinks.find(link => link.dataset.target === targetIdToShow) || this.elements.sidebarLinks[0];

        if (linkToActivate) {
            this.setActiveTab(linkToActivate, targetIdToShow);
            if (showContentArea) {
                this._loadDynamicContent(targetIdToShow); // Esta chamada irá disparar o init do StatisticsChartManager
                 if (!isPopStateCall) {
                    this._scrollToContentTop();
                    this.activeSectionTitleElement = document.querySelector(`#${targetIdToShow} .card__title`);
                    this.activeSectionTitleElement?.focus({ preventScroll: true });
                }
            } else if (!isPopStateCall && this._isMobileView()) {
                this._scrollToContentTop();
                linkToActivate.focus({ preventScroll: false });
            }
        }
        this._updateUIVisibility(showContentArea);

        if (isInitialLoad && !isPopStateCall && window.history.replaceState) {
            const currentPath = window.location.pathname;
            let expectedHash = (linkToActivate && (showContentArea || this._isMobileView())) ? linkToActivate.getAttribute('href') : '';
            const newState = showContentArea ? { target: targetIdToShow, isAccountSectionContent: true } : { target: targetIdToShow, isAccountSectionMenu: true };
            const newFullURL = window.location.origin + currentPath + (expectedHash || '');
            if (window.location.href !== newFullURL || JSON.stringify(window.history.state) !== JSON.stringify(newState)) {
                window.history.replaceState(newState, '', newFullURL);
            }
        }
    }
    
    setActiveTab(clickedLink, targetId) {
        if (!this.elements.sidebarLinks || !this.elements.contentSections) return;
        this.elements.sidebarLinks.forEach(link => {
            link.classList.toggle('is-active', link === clickedLink);
            link.setAttribute('aria-current', link === clickedLink ? 'page' : 'false');
        });
        this.elements.contentSections.forEach(section => {
            const isVisible = section.id === targetId;
            section.classList.toggle('is-visible', isVisible);
            section.setAttribute('aria-hidden', String(!isVisible));
            if (isVisible) this.activeSectionTitleElement = section.querySelector('.card__title');
        });
    }

    _loadDynamicContent(targetId) {
        // console.log(`AccountPageManager: _loadDynamicContent for targetId: ${targetId}`);
        if (targetId === 'favorite-questions-content') {
            if (this.quizUI?.favoriteManager) {
                // console.log("AccountPageManager: Calling loadUserFavorites.");
                this.quizUI.favoriteManager.loadUserFavorites();
            }
        } else if (targetId === 'statistics-content') {
            if (this.statisticsChartManager) {
                // console.log("AccountPageManager: Calling statisticsChartManager.init().");
                this.statisticsChartManager.init(); // init() do StatisticsChartManager agora lida com a inicialização única.
                                                 // Se a aba for visitada novamente, ele pode recarregar os charts via loadAndRenderAllCharts.
            } else {
                console.error("AccountPageManager CRITICAL: statisticsChartManager is null or undefined in _loadDynamicContent. ApiService was likely not passed correctly from App.js.");
            }
        }
    }

    _scrollToContentTop() {
        if (this.elements.contentArea?.classList.contains('is-visible') && this.elements.contentArea.scrollHeight > this.elements.contentArea.clientHeight) {
            this.elements.contentArea.scrollTop = 0;
        } else if (this.elements.sidebar && !this.elements.sidebar.classList.contains('u-is-hidden') && this.elements.sidebar.scrollHeight > this.elements.sidebar.clientHeight && this._isMobileView()) {
             this.elements.sidebar.scrollTop = 0;
        }
    }

    _toggleDeleteAccountModal(show) {
        const { deleteAccountModalOverlay: overlay, deleteAccountModalDialog: dialog, passwordInputDelete: passwordInput } = this.elements;
        if (!overlay || !dialog) return;

        const modalVisibleClass = 'modal--visible';
        const bodyNoScrollClass = 'no-scroll';

        if (show) {
            this.quizUI.focusedElementBeforeModal = document.activeElement;
            this.quizUI.showElement(overlay);
            overlay.scrollTop; dialog.scrollTop;

            requestAnimationFrame(() => {
                overlay.classList.add(modalVisibleClass);
                this.quizUI.activeModalCount = (this.quizUI.activeModalCount || 0) + 1;
                if (this.quizUI.activeModalCount === 1) this.bodyElement.classList.add(bodyNoScrollClass);
                if (passwordInput) passwordInput.focus();
                dialog.setAttribute('aria-hidden', 'false');
                overlay.setAttribute('aria-hidden', 'false');
            });
        } else { 
            overlay.classList.remove(modalVisibleClass);
            const transitionDuration = parseFloat(getComputedStyle(overlay).transitionDuration) * 1000 || 300;
            
            const handleTransitionEnd = () => {
                if (!overlay.classList.contains(modalVisibleClass)) {
                    this.quizUI.hideElement(overlay);
                    if (passwordInput) passwordInput.value = ''; 
                    const errorMessagesContainer = dialog.querySelector('.form-message--error');
                    if(errorMessagesContainer) { errorMessagesContainer.innerHTML = ''; errorMessagesContainer.style.display = 'none'; }
                    
                    this.quizUI.activeModalCount = Math.max(0, (this.quizUI.activeModalCount || 0) - 1);
                    if (this.quizUI.activeModalCount === 0) this.bodyElement.classList.remove(bodyNoScrollClass);

                    if (this.quizUI.focusedElementBeforeModal && document.body.contains(this.quizUI.focusedElementBeforeModal)) {
                        this.quizUI.focusedElementBeforeModal.focus({ preventScroll: true });
                    }
                    this.quizUI.focusedElementBeforeModal = null;
                    dialog.setAttribute('aria-hidden', 'true');
                    overlay.setAttribute('aria-hidden', 'true');
                }
                overlay.removeEventListener('transitionend', handleTransitionEnd);
            };
            overlay.addEventListener('transitionend', handleTransitionEnd, { once: true });
            setTimeout(() => {
                 if (!overlay.classList.contains(modalVisibleClass) && overlay.style.display !== 'none') {
                    handleTransitionEnd();
                 }
            }, transitionDuration + 50);
        }
    }
}