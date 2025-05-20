// File: assets/js/ui/AccountPageManager.js

export default class AccountPageManager {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        this.elements = {
            accountSectionPage: document.getElementById('account-section-page'),
            sidebar: document.querySelector('#account-section-page .account-sidebar'),
            contentArea: document.querySelector('#account-section-page .account-content'),
            backToMenuButton: document.getElementById('account-back-to-menu'),
            sidebarLinks: null,
            contentSections: null,
        };
        this.bodyAccountContentActiveClassName = 'body-account-content-active';
        this.bodyElement = document.body;
        this.bottomNavElement = document.querySelector('.bottom-nav');
        this.defaultMenuTargetId = null; // Será o targetId da primeira aba do menu
    }

    init() {
        if (!this.elements.accountSectionPage || (this.bodyElement.dataset.pageId !== 'account')) {
            return;
        }

        this.elements.sidebarLinks = Array.from(this.elements.accountSectionPage.querySelectorAll('.account-sidebar__link'));
        this.elements.contentSections = this.elements.accountSectionPage.querySelectorAll('.account-content__section');

        if (this.elements.sidebarLinks.length === 0 || this.elements.contentSections.length === 0) {
            return;
        }

        // Define o targetId da primeira aba como padrão para o menu
        if (this.elements.sidebarLinks.length > 0) {
            this.defaultMenuTargetId = this.elements.sidebarLinks[0].dataset.target;
        }

        this._setupEventListeners();
        // Na inicialização, determina qual aba ativar e atualiza a UI.
        // O true para isInitialLoad previne replaceState desnecessário se a URL já estiver correta.
        this._determineAndActivateTab(window.history.state, window.location.hash, true);
        this._handleResize(); // Garante estado visual correto no carregamento
    }

    _scrollToContentTop() {
        if (this.elements.contentArea) {
            this.elements.contentArea.scrollTop = 0;
            requestAnimationFrame(() => {
                if (this.elements.contentArea) this.elements.contentArea.scrollTop = 0;
            });
        }
    }

    _setupEventListeners() {
        this.elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetId = link.dataset.target;
                const newHash = link.getAttribute('href');

                this.setActiveTab(link, targetId);
                this._loadDynamicContent(targetId);
                this._scrollToContentTop();

                this._updateUIVisibility(true); // true = conteúdo da aba está ativo

                if (window.history.pushState) {
                    window.history.pushState({ target: targetId, isAccountSectionContent: true }, null, newHash);
                }
            });
        });

        this.elements.backToMenuButton?.addEventListener('click', () => {
            if (this._isMobileView()) {
                this._scrollToContentTop();
                // Ao voltar, o estado do histórico deve refletir o menu com a aba padrão
                const defaultLink = this.elements.sidebarLinks.find(l => l.dataset.target === this.defaultMenuTargetId) || this.elements.sidebarLinks[0];
                const menuHash = defaultLink ? defaultLink.getAttribute('href') : '';

                if (window.history.pushState) {
                    window.history.pushState({ isAccountSectionMenu: true, target: this.defaultMenuTargetId }, null, menuHash);
                }
                // Agora que o estado do histórico foi atualizado, _determineAndActivateTab irá lidar com a UI
                this._determineAndActivateTab({ isAccountSectionMenu: true, target: this.defaultMenuTargetId }, menuHash);

                if (defaultLink) {
                    defaultLink.focus({ preventScroll: false });
                }
            }
        });

        window.addEventListener('popstate', (event) => {
            if (this.bodyElement.dataset.pageId === 'account') {
                this._determineAndActivateTab(event.state, window.location.hash, false, true); // isPopStateCall = true
            }
        });

        window.addEventListener('resize', this._handleResize.bind(this));
    }

    _isMobileView() {
        return window.innerWidth <= 768;
    }

    _adjustBodyPaddingForBottomNav() {
        if (this._isMobileView()) {
            if (this.bodyElement.classList.contains(this.bodyAccountContentActiveClassName)) {
                this.bodyElement.style.paddingBottom = '0';
            } else {
                this.bodyElement.style.paddingBottom = `var(--bottom-nav-height, 60px)`;
            }
        } else {
            this.bodyElement.style.paddingBottom = '';
        }
    }

    // Atualiza a visibilidade do botão voltar, navbar e padding do body
    _updateUIVisibility(isContentActive) {
        if (this._isMobileView()) {
            if (isContentActive) {
                this.bodyElement.classList.add(this.bodyAccountContentActiveClassName);
                this.quizUI.showElement(this.elements.backToMenuButton);
                this.quizUI.hideElement(this.bottomNavElement);
            } else { // Menu está ativo
                this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
                this.quizUI.hideElement(this.elements.backToMenuButton);
                this.quizUI.showElement(this.bottomNavElement);
            }
        } else { // Desktop view
            this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
            this.quizUI.hideElement(this.elements.backToMenuButton);
        }
        this._adjustBodyPaddingForBottomNav();
    }

    _handleResize() {
        const isContentActive = this.bodyElement.classList.contains(this.bodyAccountContentActiveClassName);
        this._updateUIVisibility(isContentActive);
        // O _determineAndActivateTab não é estritamente necessário aqui se o estado da aba ativa
        // não muda com o resize, mas garante consistência se alguma lógica futura depender disso.
        // Vamos remover por enquanto para simplificar, já que a aba ativa não deve mudar com resize.
    }

    /**
     * Determina qual aba deve estar ativa com base no estado do histórico e no hash da URL,
     * e então ativa essa aba e atualiza a UI.
     * @param {object} historyState - O estado do window.history.
     * @param {string} currentHash - O hash atual da URL (window.location.hash).
     * @param {boolean} [isInitialLoad=false] - True se for a chamada inicial ao carregar a página.
     * @param {boolean} [isPopStateCall=false] - True se for chamada devido a um evento popstate.
     */
    _determineAndActivateTab(historyState, currentHash, isInitialLoad = false, isPopStateCall = false) {
        let targetIdToShow = null;
        let isContentView = false; // true se uma aba de conteúdo deve ser mostrada, false se o menu (sidebar)

        if (historyState) {
            if (historyState.isAccountSectionContent && historyState.target) {
                targetIdToShow = historyState.target;
                isContentView = true;
            } else if (historyState.isAccountSectionMenu) {
                targetIdToShow = historyState.target || this.defaultMenuTargetId;
                isContentView = false;
            }
        }

        // Se o estado não definiu, tenta o hash (prioriza conteúdo se houver hash)
        if (!targetIdToShow && currentHash) {
            const linkByHash = this.elements.sidebarLinks.find(
                (link) => link.getAttribute('href') === currentHash
            );
            if (linkByHash) {
                targetIdToShow = linkByHash.dataset.target;
                isContentView = true;
            }
        }

        // Fallback final: se ainda não há targetId, mostra o menu com a aba padrão selecionada
        if (!targetIdToShow) {
            targetIdToShow = this.defaultMenuTargetId;
            isContentView = false;
        }

        const linkToActivate = this.elements.sidebarLinks.find(
            (link) => link.dataset.target === targetIdToShow
        ) || this.elements.sidebarLinks[0]; // Fallback para o primeiro link

        if (linkToActivate) {
            this.setActiveTab(linkToActivate, linkToActivate.dataset.target);
            if (isContentView) {
                this._loadDynamicContent(linkToActivate.dataset.target);
            }
             // Evita scroll desnecessário no popstate ou na carga inicial da página,
             // mas permite scroll se o usuário clicou diretamente em um link (tratado no listener de clique).
            if (!isPopStateCall && !isInitialLoad) {
                this._scrollToContentTop();
            }
        }

        this._updateUIVisibility(isContentView);

        // Atualiza o histórico (replaceState) apenas se não for popstate e for necessário sincronizar
        if (!isPopStateCall && window.history.replaceState) {
            const currentPath = window.location.pathname;
            const expectedHash = linkToActivate ? linkToActivate.getAttribute('href') : '';
            const newState = isContentView ?
                { target: linkToActivate.dataset.target, isAccountSectionContent: true } :
                { isAccountSectionMenu: true, target: linkToActivate.dataset.target };

            // Se estamos mostrando conteúdo e o hash não bate, ou se estamos no menu e ainda há hash
            if (isContentView && expectedHash && expectedHash !== currentHash) {
                window.history.replaceState(newState, '', expectedHash);
            } else if (!isContentView && currentHash) {
                window.history.replaceState(newState, '', currentPath + (expectedHash || '')); // Adiciona hash do menu se houver
            } else if (!isInitialLoad && !currentHash && !expectedHash && !isContentView) {
                // Caso especial: voltando pro menu e não havia hash (ex: url base da conta)
                // Isso garante que o estado do histórico reflita "menu"
                window.history.replaceState(newState, '', currentPath);
            }
        }
    }

    setActiveTab(clickedLink, targetId) {
        if (!this.elements.sidebarLinks || !this.elements.contentSections) return;

        this.elements.sidebarLinks.forEach(link => {
            link.classList.toggle('is-active', link === clickedLink);
        });

        this.elements.contentSections.forEach(section => {
            section.classList.toggle('is-visible', section.id === targetId);
        });

        const activeSectionTitle = document.querySelector(`#${targetId} .card__title`);
        if (activeSectionTitle) {
            activeSectionTitle.setAttribute('tabindex', '-1');
            // Focar apenas se não for um popstate, para não roubar foco do botão "voltar" do navegador
            // ou se for um clique direto em um link da sidebar.
            // A lógica de foco pode ser refinada aqui se necessário.
            // if (!isPopStateCall) activeSectionTitle.focus({ preventScroll: true });
        }
    }

    _loadDynamicContent(targetId) {
        if (targetId === 'favorite-questions-content') {
            if (this.quizUI?.favoriteManager?.loadUserFavorites) {
                const favContainer = this.quizUI.elements.favoriteQuestionsContainer;
                if (favContainer) {
                    const placeholder = favContainer.querySelector('.placeholder-text');
                    const hasItems = favContainer.querySelector('.favorite-question-item');
                    const shouldLoad = (placeholder && !placeholder.classList.contains(this.quizUI.hiddenClassName) && !hasItems) || (!placeholder && !hasItems);
                    if (shouldLoad) this.quizUI.favoriteManager.loadUserFavorites();
                }
            }
        }
    }
}