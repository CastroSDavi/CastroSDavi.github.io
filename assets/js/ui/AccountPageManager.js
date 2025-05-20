// File: assets/js/ui/AccountPageManager.js

export default class AccountPageManager {
    constructor(quizUIInstance) {
        // console.log("ACCOUNTPAGEMANAGER.JS: Constructor - Instanciando AccountPageManager.");
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
        // A flag mobileViewActive foi removida pois a classe 'is-mobile-content-active' no
        // accountLayoutContainer é suficiente para gerenciar o estado da UI.
    }

    init() {
        // console.log("ACCOUNTPAGEMANAGER.JS: init - Inicializando listeners e estado da página da conta.");
        
        if (!this.elements.accountSectionPage || 
            this.elements.accountSectionPage.classList.contains(this.quizUI.hiddenClassName)) {
            // console.warn("AccountPageManager.init: Elemento principal 'account-section-page' não encontrado ou oculto. Abortando inicialização.");
            return;
        }

        this.elements.sidebarLinks = this.elements.accountSectionPage.querySelectorAll('.account-sidebar__link');
        this.elements.contentSections = this.elements.accountSectionPage.querySelectorAll('.account-content__section');

        if (this.elements.sidebarLinks.length === 0 || this.elements.contentSections.length === 0) {
            // console.warn("AccountPageManager: Links da barra lateral ou seções de conteúdo não encontradas.");
            return;
        }

        this.elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetId = link.dataset.target;
                
                // 1. Ativa a aba e mostra a seção de conteúdo correta
                this.setActiveTab(link, targetId);
                this._loadDynamicContent(targetId);

                // 2. Lida com a UI mobile e o histórico
                if (this._isMobileView()) {
                    this.elements.accountLayoutContainer?.classList.add('is-mobile-content-active');
                    // Scroll para o topo do conteúdo da seção ao abri-la no mobile
                    const targetSection = document.getElementById(targetId);
                    targetSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                // Atualiza o histórico DEPOIS de definir a aba e o modo mobile (se aplicável)
                if (window.history.pushState) {
                    window.history.pushState({ target: targetId, isAccountSection: true }, null, link.href);
                } else {
                    window.location.hash = link.href.split('#')[1];
                }
                // 3. Atualiza a UI específica do mobile (botão de voltar, bottom-nav)
                this._updateMobileSpecificUI();
            });
        });

        this.elements.backToMenuButton?.addEventListener('click', () => {
            if (this._isMobileView()) {
                this.elements.accountLayoutContainer?.classList.remove('is-mobile-content-active');
                // Não precisa chamar setActiveTab aqui, pois o menu é mostrado e nenhuma seção específica
                // de conteúdo precisa ser "ativa" quando o menu está visível no mobile.
                // O link que estava ativo permanecerá com a classe .is-active.

                if (window.history.pushState) {
                    // Volta para o estado que representa o menu (sem hash específico de seção)
                    window.history.pushState({ isAccountSectionMenu: true }, null, window.location.pathname); 
                }
                this._updateMobileSpecificUI(); // Atualiza botão de voltar, bottom-nav
                
                // Foca no primeiro item do menu para acessibilidade/feedback
                this.elements.sidebarLinks[0]?.focus({ preventScroll: false });
            }
        });
        
        window.addEventListener('popstate', (event) => {
            // Apenas manipula o popstate se estivermos na página da conta
            // e se o estado indicar que é uma navegação interna da conta.
            if (document.body.dataset.pageId === 'account') {
                this._handlePopState(event.state);
            }
        });

        window.addEventListener('resize', this._handleResize.bind(this));

        this._activateTabFromHashOrState(window.history.state); // Considera o estado atual do histórico no carregamento
        this._handleResize(); // Ajusta a UI com base na largura inicial
    }

    _isMobileView() {
        return window.innerWidth <= 768;
    }

    _updateMobileSpecificUI() {
        if (!this.elements.backToMenuButton || !this.elements.accountLayoutContainer || !this.quizUI) return;

        const bottomNav = document.querySelector('.bottom-nav');

        if (this._isMobileView()) {
            if (this.elements.accountLayoutContainer.classList.contains('is-mobile-content-active')) {
                this.quizUI.showElement(this.elements.backToMenuButton);
                if (bottomNav) this.quizUI.hideElement(bottomNav); // Esconde bottom-nav ao ver conteúdo
            } else { // Menu está ativo no mobile
                this.quizUI.hideElement(this.elements.backToMenuButton);
                if (bottomNav) this.quizUI.showElement(bottomNav); // Mostra bottom-nav ao ver menu
            }
        } else { // Desktop view
            this.quizUI.hideElement(this.elements.backToMenuButton);
            this.elements.accountLayoutContainer.classList.remove('is-mobile-content-active');
            // Em desktop, a bottom-nav já é controlada pelo CSS principal
            // Se a bottom-nav só deve aparecer em mobile, o CSS já deve tratar isso.
            // Se precisar explicitamente esconder/mostrar baseado em _isMobileView:
            // if (bottomNav) {
            //     this._isMobileView() ? this.quizUI.showElement(bottomNav) : this.quizUI.hideElement(bottomNav);
            // }
        }
    }
    
    _handleResize() {
        if (this.elements.accountLayoutContainer) {
            if (!this._isMobileView()) {
                // Se redimensionou para desktop, remove a classe de controle mobile
                // e garante que o conteúdo da aba ativa (ou primeira) seja mostrado.
                this.elements.accountLayoutContainer.classList.remove('is-mobile-content-active');
                this._activateTabFromHashOrState(window.history.state); 
            } else {
                // Se redimensionou para mobile, a lógica em _activateTabFromHashOrState e
                // os event listeners de clique já devem lidar com a transição para o modo mobile.
                // Apenas garantimos que _updateMobileSpecificUI seja chamado.
                // Se nenhuma seção de conteúdo estiver ativa no mobile (is-mobile-content-active não está presente),
                // o menu será mostrado, o que é o comportamento desejado.
            }
        }
        this._updateMobileSpecificUI();
    }

    _handlePopState(state) {
        // console.log("Popstate event, state:", state);
        let targetSectionIdToGo = null;

        if (state && state.target) {
            targetSectionIdToGo = state.target;
        } else if (!state && window.location.hash) { // Fallback para hash se o state for null (ex: refresh com hash)
             const linkByHash = Array.from(this.elements.sidebarLinks).find(
                (link) => link.getAttribute('href') === window.location.hash
            );
            if (linkByHash) targetSectionIdToGo = linkByHash.dataset.target;
        }


        if (this._isMobileView()) {
            if (targetSectionIdToGo) { // Navegando para uma seção de conteúdo específica
                this.elements.accountLayoutContainer?.classList.add('is-mobile-content-active');
                const linkToActivate = Array.from(this.elements.sidebarLinks).find(
                    (link) => link.dataset.target === targetSectionIdToGo
                );
                if (linkToActivate) {
                    this.setActiveTab(linkToActivate, targetSectionIdToGo);
                    this._loadDynamicContent(targetSectionIdToGo);
                }
            } else { // Navegando para a visualização do menu (estado é null, ou isAccountSectionMenu, ou sem target)
                this.elements.accountLayoutContainer?.classList.remove('is-mobile-content-active');
                // A aba que estava ativa visualmente (.is-active) continuará assim,
                // o que é bom para o usuário saber onde estava.
            }
        } else { // Desktop view
            // No desktop, sempre tentamos ativar uma aba, seja pelo estado, hash ou a primeira.
            this._activateTabFromHashOrState(state, true); // Passa true para indicar que é um popstate
        }
        this._updateMobileSpecificUI();
    }

    _activateTabFromHashOrState(state = null, isPopStateCall = false) {
        if (!this.elements.sidebarLinks || this.elements.sidebarLinks.length === 0) return;

        let targetIdFromState = state ? state.target : null;
        const hash = window.location.hash;
        let linkToActivate = null;
        let sectionIdToActivate = null;
        let activatedByHistoryStateOrHash = false;

        if (targetIdFromState) {
            linkToActivate = Array.from(this.elements.sidebarLinks).find(
                (link) => link.dataset.target === targetIdFromState
            );
            if (linkToActivate) {
                sectionIdToActivate = targetIdFromState;
                activatedByHistoryStateOrHash = true;
            }
        }
        
        if (!linkToActivate && hash) {
            linkToActivate = Array.from(this.elements.sidebarLinks).find(
                (link) => link.getAttribute('href') === hash
            );
            if (linkToActivate) {
                 sectionIdToActivate = linkToActivate.dataset.target;
                 activatedByHistoryStateOrHash = true;
            }
        }
        
        if (linkToActivate && sectionIdToActivate) {
            this.setActiveTab(linkToActivate, sectionIdToActivate);
            this._loadDynamicContent(sectionIdToActivate);
            
            if (this._isMobileView()) {
                // Se uma aba específica foi ativada (por hash ou state), mostra o conteúdo no mobile
                this.elements.accountLayoutContainer?.classList.add('is-mobile-content-active');
            }
            // Atualiza o history.state e a URL se não foi uma chamada de popstate que já tem o estado/URL correto
            // E se o link ativado tem um href (para o hash)
            if (!isPopStateCall && window.history.replaceState && linkToActivate.getAttribute('href')) {
                 // Para desktop, sempre atualiza o hash.
                 // Para mobile, só atualiza o hash se estiver mostrando um conteúdo específico.
                if (!this._isMobileView() || this.elements.accountLayoutContainer?.classList.contains('is-mobile-content-active')) {
                    window.history.replaceState({ target: sectionIdToActivate, isAccountSection: true }, null, linkToActivate.getAttribute('href'));
                }
            }

        } else { // Nenhuma aba específica por state ou hash, ativa a primeira como padrão
            const firstLink = this.elements.sidebarLinks[0];
            sectionIdToActivate = firstLink.dataset.target;
            this.setActiveTab(firstLink, sectionIdToActivate); // Ativa a primeira aba
            this._loadDynamicContent(sectionIdToActivate);
            
            if (this._isMobileView()) {
                // No mobile, o padrão é mostrar o menu se nenhuma aba específica foi carregada.
                this.elements.accountLayoutContainer?.classList.remove('is-mobile-content-active');
                // Limpa o hash e define o estado para "menu" se não foi uma chamada de popstate
                if (!isPopStateCall && window.history.replaceState) { 
                     window.history.replaceState({ isAccountSectionMenu: true }, null, window.location.pathname);
                }
            } else { // Desktop: define o hash para a primeira aba se não houver um e não for popstate
                if (!hash && !isPopStateCall && window.history.replaceState && firstLink.getAttribute('href')) {
                     window.history.replaceState({ target: sectionIdToActivate, isAccountSection: true }, null, firstLink.getAttribute('href'));
                }
            }
        }
        // A chamada para _updateMobileSpecificUI() foi movida para o final de init, _handleResize, e _handlePopState
        // para garantir que seja chamada após todas as manipulações de classe e estado.
        // Se for chamada aqui também, pode ser redundante ou causar um piscar, dependendo da ordem.
        // Vamos garantir que ela seja chamada uma vez no final dessas operações de alto nível.
    }

    setActiveTab(clickedLink, targetId) {
        if (!this.elements.sidebarLinks || !this.elements.contentSections) {
            // console.warn("AccountPageManager: Tentativa de setActiveTab sem sidebarLinks ou contentSections cacheados.");
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
        // console.log(`ACCOUNTPAGEMANAGER.JS: _loadDynamicContent - Verificando conteúdo para ${targetId}`);
        if (targetId === 'favorite-questions-content') {
            if (this.quizUI && this.quizUI.favoriteManager && typeof this.quizUI.favoriteManager.loadUserFavorites === 'function') {
                const favContainer = this.quizUI.elements.favoriteQuestionsContainer; 
                if (favContainer) {
                    const placeholder = favContainer.querySelector('.placeholder-text');
                    const hasItems = favContainer.querySelector('.favorite-question-item'); 
                    
                    const shouldLoad = (placeholder && !placeholder.classList.contains(this.quizUI.hiddenClassName) && !hasItems) ||
                                     (!placeholder && !hasItems);

                    if (shouldLoad) {
                        // console.log("ACCOUNTPAGEMANAGER.JS: _loadDynamicContent - Chamando loadUserFavorites.");
                        this.quizUI.favoriteManager.loadUserFavorites();
                    }
                }
            }
        }
    }
}