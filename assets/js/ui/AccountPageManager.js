// assets/js/ui/AccountPageManager.js

import StatisticsChartManager from './StatisticsChartManager.js';

export default class AccountPageManager {
    constructor(quizUIInstance, apiServiceInstance) {
        this.quizUI = quizUIInstance;
        this.apiService = apiServiceInstance; 
        
        this.elements = { 
            accountSectionPage: document.getElementById('account-section-page'),
            sidebar: document.querySelector('#account-section-page .account-sidebar'),
            contentArea: document.querySelector('#account-section-page .account-content'),
            backToMenuButton: document.getElementById('account-back-to-menu'),
            sidebarLinks: null, 
            contentSections: null, 
            btnOpenDeleteModal: this.quizUI.elements.btnOpenDeleteAccountModal 
        };
        this.bodyAccountContentActiveClassName = 'body-account-content-active';
        this.bodyElement = document.body;
        this.bottomNavElement = document.querySelector('.bottom-nav');
        this.defaultMenuTargetId = 'profile-info-content';
        this.lastActiveContentTargetId = this.defaultMenuTargetId;
        this.activeSectionTitleElement = null;

        this.deleteAccountForm = this.quizUI.elements.deleteAccountForm;
        this.passwordInputDelete = this.quizUI.elements.passwordInputDeleteAccount;

        if (this.apiService) {
            this.statisticsChartManager = new StatisticsChartManager(this.quizUI, this.apiService);
        } else {
            this.statisticsChartManager = null;
        }
    }

    init() {
        if (!this.elements.accountSectionPage || (this.bodyElement.dataset.pageId !== 'account')) {
            return;
        }

        this.elements.sidebarLinks = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-sidebar__link'));
        this.elements.contentSections = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-content__section'));

        if (this.elements.sidebarLinks.length === 0 || this.elements.contentSections.length === 0) {
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
                    if (this.quizUI.modalManager) {
                        this.quizUI.modalManager.toggleDeleteAccountModal(true);
                    }
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
                this.lastActiveContentTargetId = targetId; // Atualiza antes de mudar o histórico

                // Sempre mostrar conteúdo ao clicar num link da sidebar
                if (window.history.pushState) {
                    window.history.pushState({ target: targetId, isAccountSectionContent: true }, '', newHash);
                }
                this.setActiveTab(link, targetId);
                this._loadDynamicContent(targetId);
                this._updateUIVisibility(true); // Força a exibição da área de conteúdo
                this._scrollToContentTop();
                
                this.activeSectionTitleElement = document.querySelector(`#${targetId} .card__title`);
                this.activeSectionTitleElement?.focus({ preventScroll: true });
            });
        });

        this.elements.backToMenuButton?.addEventListener('click', () => {
            if (this._isMobileView()) {
                // Encontra o link que corresponde à última aba de conteúdo ativa
                const targetLink = this.elements.sidebarLinks.find(l => l.dataset.target === this.lastActiveContentTargetId) || this.elements.sidebarLinks[0];
                const menuHash = targetLink ? targetLink.getAttribute('href') : '#profile-info';
                
                // Define o estado para mostrar o menu da aba correspondente
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

        this.elements.btnOpenDeleteModal?.addEventListener('click', () => {
            if (this.quizUI.modalManager) {
                this.quizUI.modalManager.toggleDeleteAccountModal(true);
            }
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

            // ===== INÍCIO DA CORREÇÃO =====
            // Na página da conta em modo mobile, a navegação inferior principal deve estar sempre escondida
            // para não competir com o menu da própria página da conta.
            if(this.bottomNavElement) {
                this.quizUI.hideElement(this.bottomNavElement);
            }
            // ===== FIM DA CORREÇÃO =====

        } else { // Desktop
            [this.elements.sidebar, this.elements.contentArea].forEach(el => this.quizUI.showElement(el));
            this.quizUI.hideElement(this.elements.backToMenuButton);
            this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
            if(this.bottomNavElement) this.quizUI.hideElement(this.bottomNavElement); // Bottom nav sempre escondido em desktop
        }
        this._adjustBodyPaddingForBottomNav();
    }

    _handleResize() {
        // Determina se o conteúdo deve estar ativo baseado no estado atual da UI (se a área de conteúdo está visível)
        // E não apenas no this.lastActiveContentTargetId.
        const isCurrentlyShowingContent = this.elements.contentArea && !this.elements.contentArea.classList.contains('u-is-hidden');
        this._updateUIVisibility(this._isMobileView() ? isCurrentlyShowingContent : true);
    }

    // Função auxiliar para resolver qual aba e se o conteúdo deve ser mostrado
    _resolveDesiredTabState(historyState, currentHash, isInitialLoad) {
        let targetId = null;
        let showContent = !this._isMobileView(); // Default para desktop: mostrar conteúdo

        // 1. Priorizar o estado do histórico do navegador
        if (historyState && historyState.target) {
            targetId = historyState.target;
            // `isAccountSectionContent` no estado do histórico dita se o conteúdo ou o menu (no mobile) deve ser mostrado
            showContent = historyState.isAccountSectionContent !== undefined ? historyState.isAccountSectionContent : showContent;
        } 
        // 2. Se não houver estado no histórico (ex: carregamento direto com hash), usar o hash da URL
        else if (currentHash) {
            const linkByHash = this.elements.sidebarLinks.find(link => link.getAttribute('href') === currentHash);
            if (linkByHash) {
                targetId = linkByHash.dataset.target;
                showContent = true; // Se há um hash, a intenção geralmente é mostrar o conteúdo da aba
            }
        }

        // 3. Lógica para `activeTabOnError` - pode sobrescrever o targetId e showContent
        // Aplicar apenas no carregamento inicial e se a aba de erro não for a aba de menu.
        const activeTabOnError = this.bodyElement.dataset.activeTabOnError;
        if (isInitialLoad && activeTabOnError) {
            // Se `targetId` já foi definido (por hash ou state) E esse estado indica que é para mostrar o menu,
            // não sobrescrever com `activeTabOnError`, a menos que a própria aba de erro seja a que está no state/hash.
            const shouldOverrideForError = !targetId || // Se nenhum target foi definido ainda
                                         (historyState && historyState.isAccountSectionContent !== false) || // Se o state não força o menu
                                         targetId === activeTabOnError; // Ou se o target já é a aba de erro

            if (shouldOverrideForError) {
                const linkForErrorTab = this.elements.sidebarLinks.find(link => link.dataset.target === activeTabOnError);
                if (linkForErrorTab) {
                    targetId = activeTabOnError;
                    showContent = true; // Erro geralmente implica mostrar o conteúdo da aba
                }
            }
        }

        // 4. Fallback para o targetId padrão se nada foi determinado
        if (!targetId) {
            targetId = this.defaultMenuTargetId;
            // Se for mobile e cair no default no carregamento inicial, mostrar menu.
            if (isInitialLoad && this._isMobileView()) {
                showContent = false;
            }
        }
        
        // 5. Ajuste específico para mobile: se a lógica anterior decidiu mostrar conteúdo
        // para a aba padrão, mas não é um carregamento inicial explícito para conteúdo,
        // e sim um retorno ao estado "raiz" da página (sem hash específico), mostrar o menu.
        if (this._isMobileView() && showContent && targetId === this.defaultMenuTargetId &&
            !isInitialLoad && !currentHash && !(historyState && historyState.isAccountSectionContent === true)) {
            showContent = false;
        }

        return { targetId, showContent };
    }

    // Função auxiliar para atualizar o histórico do navegador
    _updateBrowserHistory(targetId, showContent, linkToActivate, isInitialLoad, isPopStateCall) {
        if (isInitialLoad && !isPopStateCall && window.history.replaceState) {
            const currentPath = window.location.pathname;
            let expectedHash = "";

            if (linkToActivate) {
                 // No mobile, se estamos mostrando o menu (showContent = false),
                 // a URL ainda deve refletir o hash da aba para a qual o menu está aberto.
                 // Se for a primeira aba (sem hash no href), então não haverá hash.
                expectedHash = linkToActivate.getAttribute('href') || "";
            }
            
            const newState = showContent ? 
                { target: targetId, isAccountSectionContent: true } : 
                { target: targetId, isAccountSectionMenu: true };

            const newFullURL = window.location.origin + currentPath + (expectedHash || '');
            
            const currentStateJSON = window.history.state ? JSON.stringify(window.history.state) : null;
            const newStateJSON = JSON.stringify(newState);

            if (window.location.href !== newFullURL || currentStateJSON !== newStateJSON) {
                window.history.replaceState(newState, '', newFullURL);
            }
        }
    }

    _determineAndActivateTab(historyState, currentHash, isInitialLoad = false, isPopStateCall = false) {
        const { targetId, showContent } = this._resolveDesiredTabState(historyState, currentHash, isInitialLoad);
        
        this.lastActiveContentTargetId = targetId;
        const linkToActivate = this.elements.sidebarLinks.find(link => link.dataset.target === targetId) || this.elements.sidebarLinks[0];

        if (linkToActivate) {
            this.setActiveTab(linkToActivate, targetId);
            if (showContent) {
                this._loadDynamicContent(targetId);
                if (!isPopStateCall) { // Não focar/scrollar em popstate para comportamento natural do navegador
                    this._scrollToContentTop();
                    this.activeSectionTitleElement = document.querySelector(`#${targetId} .card__title`);
                    this.activeSectionTitleElement?.focus({ preventScroll: true });
                }
            } else if (!isPopStateCall && this._isMobileView()) { // Se é para mostrar o menu no mobile
                this._scrollToContentTop(); // Scroll no menu da sidebar
                linkToActivate.focus({ preventScroll: false });
            }
        }

        this._updateUIVisibility(showContent);
        this._updateBrowserHistory(targetId, showContent, linkToActivate, isInitialLoad, isPopStateCall);
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
        if (targetId === 'favorite-questions-content') {
            if (this.quizUI?.favoriteManager) {
                this.quizUI.favoriteManager.loadUserFavorites();
            }
        } else if (targetId === 'statistics-content') {
            if (this.statisticsChartManager) {
                this.statisticsChartManager.init(); 
            }
        }
    }

    _scrollToContentTop() {
        // Verifica se a área de conteúdo está visível e se tem scroll
        if (this.elements.contentArea?.classList.contains('is-visible') && this.elements.contentArea.scrollHeight > this.elements.contentArea.clientHeight) {
            this.elements.contentArea.scrollTop = 0;
        } 
        // Verifica se a sidebar está visível (geralmente em mobile quando o conteúdo está oculto) e se tem scroll
        else if (this.elements.sidebar && !this.elements.sidebar.classList.contains('u-is-hidden') && this.elements.sidebar.scrollHeight > this.elements.sidebar.clientHeight && this._isMobileView()) {
            this.elements.sidebar.scrollTop = 0;
        }
    }
}