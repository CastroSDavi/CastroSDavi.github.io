// File: assets/js/ui/AccountPageManager.js

export default class AccountPageManager {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        this.elements = {
            accountSectionPage: document.getElementById('account-section-page'),
            accountLayoutContainer: document.querySelector('#account-section-page .account-layout-container'),
            sidebar: document.querySelector('#account-section-page .account-sidebar'),
            contentArea: document.querySelector('#account-section-page .account-content'),
            backToMenuButton: document.getElementById('account-back-to-menu'),
            sidebarLinks: null,       // Será populado em init
            contentSections: null,    // Será populado em init
        };
        this.noBottomNavClassName = 'account-section--no-bottom-nav'; // Nome da classe CSS
    }

    init() {
        if (!this.elements.accountSectionPage || 
            this.elements.accountSectionPage.classList.contains(this.quizUI.hiddenClassName)) {
            return;
        }

        this.elements.sidebarLinks = this.elements.accountSectionPage.querySelectorAll('.account-sidebar__link');
        this.elements.contentSections = this.elements.accountSectionPage.querySelectorAll('.account-content__section');

        if (!this.elements.sidebarLinks || this.elements.sidebarLinks.length === 0 || 
            !this.elements.contentSections || this.elements.contentSections.length === 0) {
            return;
        }

        this._setupEventListeners();
        // Ativa a aba correta com base no hash/estado atual e ajusta a UI mobile (incluindo classes de altura)
        this._activateTabFromHashOrState(window.history.state); 
        // Garante que o estado da UI mobile (altura/visibilidade da bottom-nav) seja consistente com o tamanho da janela inicial.
        this._handleResize(); 
    }

    _scrollToContentTop() {
        if (this.elements.contentArea) {
            this.elements.contentArea.scrollTop = 0;
            requestAnimationFrame(() => {
                if (this.elements.contentArea) { // Re-check existence
                    this.elements.contentArea.scrollTop = 0;
                }
            });
        }
    }

    _setupEventListeners() {
        this.elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault(); 
                const targetId = link.dataset.target;
                
                this.setActiveTab(link, targetId);
                this._loadDynamicContent(targetId);
                this._scrollToContentTop(); 

                if (this._isMobileView()) {
                    this.elements.accountLayoutContainer?.classList.add('is-mobile-content-active');
                }
                
                if (window.history.pushState) {
                    window.history.pushState({ target: targetId, isAccountSection: true }, null, link.href);
                }
                // _updateMobileSpecificUI será chamado para ajustar a classe de altura
                this._updateMobileSpecificUI(); 
            });
        });

        this.elements.backToMenuButton?.addEventListener('click', () => {
            if (this._isMobileView()) {
                this.elements.accountLayoutContainer?.classList.remove('is-mobile-content-active');
                this._scrollToContentTop(); 

                if (window.history.pushState) {
                    window.history.pushState({ isAccountSectionMenu: true }, null, window.location.pathname); 
                }
                // _updateMobileSpecificUI será chamado para ajustar a classe de altura
                this._updateMobileSpecificUI(); 
                this.elements.sidebarLinks[0]?.focus({ preventScroll: false });
            }
        });
        
        window.addEventListener('popstate', (event) => {
            // Apenas manipula o popstate se estivermos na página da conta
            if (document.body.dataset.pageId === 'account') {
                this._handlePopState(event.state);
            }
        });

        window.addEventListener('resize', this._handleResize.bind(this));
    }

    _isMobileView() {
        return window.innerWidth <= 768;
    }

    _updateMobileSpecificUI() {
        if (!this.elements.accountLayoutContainer || !this.quizUI) return;

        const bottomNav = document.querySelector('.bottom-nav');
        const accountSectionPage = this.elements.accountSectionPage;

        if (this._isMobileView()) {
            if (this.elements.accountLayoutContainer.classList.contains('is-mobile-content-active')) {
                // CONTEÚDO ATIVO: Esconde bottom-nav, mostra botão voltar, adiciona classe para altura maior
                this.quizUI.showElement(this.elements.backToMenuButton);
                if (bottomNav) this.quizUI.hideElement(bottomNav);
                if (accountSectionPage) {
                    accountSectionPage.classList.add(this.noBottomNavClassName);
                    accountSectionPage.style.height = ''; // Remove altura inline, se houver, para CSS via classe assumir
                }
            } else { 
                // MENU ATIVO: Mostra bottom-nav, esconde botão voltar, remove classe para altura padrão
                this.quizUI.hideElement(this.elements.backToMenuButton);
                if (bottomNav) this.quizUI.showElement(bottomNav);
                if (accountSectionPage) {
                     accountSectionPage.classList.remove(this.noBottomNavClassName);
                     accountSectionPage.style.height = ''; // Remove altura inline
                }
            }
        } else { 
            // DESKTOP VIEW: Reseta classes e estilos inline de altura
            this.quizUI.hideElement(this.elements.backToMenuButton);
            this.elements.accountLayoutContainer.classList.remove('is-mobile-content-active');
            if (accountSectionPage) {
                accountSectionPage.classList.remove(this.noBottomNavClassName);
                accountSectionPage.style.height = ''; // Garante que o CSS padrão para desktop seja aplicado
            }
        }
    }
    
    _handleResize() {
        this._updateMobileSpecificUI(); // Ajusta classes de altura e visibilidade de elementos mobile

        // Se redimensionou para desktop e o modo de conteúdo mobile estava ativo,
        // precisamos garantir que a aba correta seja mostrada e o estado mobile removido.
        if (this.elements.accountLayoutContainer && !this._isMobileView()) {
            this.elements.accountLayoutContainer.classList.remove('is-mobile-content-active');
            // Reativa a aba com base no estado/hash para garantir consistência.
            // O true em _activateTabFromHashOrState previne a criação de um novo estado no histórico.
            this._activateTabFromHashOrState(window.history.state, true); 
        }
    }

    _handlePopState(state) {
        let targetSectionIdToGo = null;

        if (state && state.target) {
            targetSectionIdToGo = state.target;
        } else if (!state && window.location.hash) { 
             const linkByHash = Array.from(this.elements.sidebarLinks || []).find(
                (link) => link.getAttribute('href') === window.location.hash
            );
            if (linkByHash) targetSectionIdToGo = linkByHash.dataset.target;
        }

        this._scrollToContentTop();

        if (this._isMobileView()) {
            if (targetSectionIdToGo) { 
                this.elements.accountLayoutContainer?.classList.add('is-mobile-content-active');
                const linkToActivate = Array.from(this.elements.sidebarLinks || []).find(
                    (link) => link.dataset.target === targetSectionIdToGo
                );
                if (linkToActivate) {
                    this.setActiveTab(linkToActivate, targetSectionIdToGo);
                    this._loadDynamicContent(targetSectionIdToGo);
                }
            } else { 
                // Voltando para a visualização do menu no mobile
                this.elements.accountLayoutContainer?.classList.remove('is-mobile-content-active');
            }
        } else { 
            // Desktop: sempre tenta ativar uma aba
            this._activateTabFromHashOrState(state, true); 
        }
        this._updateMobileSpecificUI(); // Atualiza UI (incluindo classes de altura) após lógica de popstate
    }

    _activateTabFromHashOrState(state = null, isPopStateCall = false) {
        if (!this.elements.sidebarLinks || this.elements.sidebarLinks.length === 0) return;

        let targetIdFromState = state ? state.target : null;
        const hash = window.location.hash;
        let linkToActivate = null;
        let sectionIdToActivate = null;

        if (targetIdFromState) {
            linkToActivate = Array.from(this.elements.sidebarLinks).find(
                (link) => link.dataset.target === targetIdFromState
            );
            if (linkToActivate) {
                sectionIdToActivate = targetIdFromState;
            }
        }
        
        if (!linkToActivate && hash) {
            linkToActivate = Array.from(this.elements.sidebarLinks).find(
                (link) => link.getAttribute('href') === hash
            );
            if (linkToActivate) {
                 sectionIdToActivate = linkToActivate.dataset.target;
            }
        }
        
        if (linkToActivate && sectionIdToActivate) {
            this.setActiveTab(linkToActivate, sectionIdToActivate);
            this._loadDynamicContent(sectionIdToActivate);
            this._scrollToContentTop();
            
            if (this._isMobileView()) {
                this.elements.accountLayoutContainer?.classList.add('is-mobile-content-active');
            }
            
            if (!isPopStateCall && window.history.replaceState && linkToActivate.getAttribute('href')) {
                if (!this._isMobileView() || this.elements.accountLayoutContainer?.classList.contains('is-mobile-content-active')) {
                    window.history.replaceState({ target: sectionIdToActivate, isAccountSection: true }, null, linkToActivate.getAttribute('href'));
                }
            }
        } else { 
            const firstLink = this.elements.sidebarLinks[0];
            if (firstLink) {
                sectionIdToActivate = firstLink.dataset.target;
                this.setActiveTab(firstLink, sectionIdToActivate); 
                this._loadDynamicContent(sectionIdToActivate);
                this._scrollToContentTop();
                
                if (this._isMobileView()) {
                    this.elements.accountLayoutContainer?.classList.remove('is-mobile-content-active');
                    if (!isPopStateCall && window.history.replaceState) { 
                         window.history.replaceState({ isAccountSectionMenu: true }, null, window.location.pathname);
                    }
                } else { 
                    if (!hash && !isPopStateCall && window.history.replaceState && firstLink.getAttribute('href')) {
                         window.history.replaceState({ target: sectionIdToActivate, isAccountSection: true }, null, firstLink.getAttribute('href'));
                    }
                }
            }
        }
        this._updateMobileSpecificUI(); // Garante que a UI mobile (classes de altura) seja atualizada
    }

    setActiveTab(clickedLink, targetId) {
        if (!this.elements.sidebarLinks || !this.elements.contentSections) {
            return;
        }

        this.elements.sidebarLinks.forEach(link => {
            link.classList.remove('is-active');
        });
        if (clickedLink) { 
            clickedLink.classList.add('is-active');
        }

        this.elements.contentSections.forEach(section => {
            if (section.id === targetId) {
                section.classList.add('is-visible'); 
            } else {
                section.classList.remove('is-visible'); 
            }
        });
    }

    _loadDynamicContent(targetId) {
        if (targetId === 'favorite-questions-content') {
            if (this.quizUI && this.quizUI.favoriteManager && typeof this.quizUI.favoriteManager.loadUserFavorites === 'function') {
                const favContainer = this.quizUI.elements.favoriteQuestionsContainer; 
                if (favContainer) {
                    const placeholder = favContainer.querySelector('.placeholder-text');
                    const hasItems = favContainer.querySelector('.favorite-question-item'); 
                    
                    const shouldLoad = (placeholder && !placeholder.classList.contains(this.quizUI.hiddenClassName) && !hasItems) ||
                                     (!placeholder && !hasItems);

                    if (shouldLoad) {
                        this.quizUI.favoriteManager.loadUserFavorites();
                    }
                }
            }
        }
    }
}