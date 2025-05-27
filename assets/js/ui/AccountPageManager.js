// assets/js/ui/AccountPageManager.js

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
        this.defaultMenuTargetId = 'profile-info-content'; // Define um padrão
        this.lastActiveContentTargetId = this.defaultMenuTargetId; // Para lembrar a última aba
        this.activeSectionTitleElement = null;

        if (this.elements.deleteAccountForm) {
            this.elements.passwordInputDelete = this.elements.deleteAccountForm.querySelector('input[name="password"]');
        }
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
             // Se o erro foi na aba de segurança e o modal deve ser mostrado,
             // garante que a aba de segurança esteja ativa antes de tentar abrir o modal.
            const securityLink = this.elements.sidebarLinks.find(link => link.dataset.target === 'security-content');
            if (securityLink) {
                this.setActiveTab(securityLink, 'security-content');
                this._loadDynamicContent('security-content'); // Carrega se necessário
                this._updateUIVisibility(true); // Garante que o conteúdo esteja visível
                setTimeout(() => {
                    this._toggleDeleteAccountModal(true);
                }, 150); // Aumentar ligeiramente o delay
            }
        }
    }

    _scrollToContentTop() {
        // Rola o elemento que estiver visível e scrollable
        if (this.elements.contentArea && this.elements.contentArea.classList.contains('is-visible') && this.elements.contentArea.scrollHeight > this.elements.contentArea.clientHeight) {
            this.elements.contentArea.scrollTop = 0;
        } else if (this.elements.sidebar && !this.elements.sidebar.classList.contains('u-is-hidden') && this.elements.sidebar.scrollHeight > this.elements.sidebar.clientHeight && this._isMobileView()) {
             this.elements.sidebar.scrollTop = 0; // Rola a sidebar em mobile se ela estiver visível
        }
    }

    _setupEventListeners() {
        this.elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetId = link.dataset.target;
                const newHash = link.getAttribute('href');
                this.lastActiveContentTargetId = targetId; // Lembra a última aba clicada

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
                // Volta para a ÚLTIMA aba que estava ativa, ou para a padrão
                const targetLink = this.elements.sidebarLinks.find(l => l.dataset.target === this.lastActiveContentTargetId) || this.elements.sidebarLinks[0];
                const menuHash = targetLink ? targetLink.getAttribute('href') : '#';
                
                if (window.history.pushState) {
                    // O estado aqui é para mostrar o menu, mas o hash pode ser da última aba ativa para UX
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
        // ... (listeners do modal de exclusão permanecem os mesmos da resposta anterior) ...
        this.elements.btnOpenDeleteModal?.addEventListener('click', () => {
            this._toggleDeleteAccountModal(true);
        });

        this.elements.btnCancelDelete?.addEventListener('click', (event) => {
            event.preventDefault();
            this._toggleDeleteAccountModal(false);
        });

        this.elements.deleteAccountModalOverlay?.addEventListener('click', (event) => {
            if (event.target === this.elements.deleteAccountModalOverlay) {
                this._toggleDeleteAccountModal(false);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.elements.deleteAccountModalOverlay &&
                this.elements.deleteAccountModalOverlay.classList.contains('modal--visible')) {
                this._toggleDeleteAccountModal(false);
            }
        });
    }

    _isMobileView() {
        return window.innerWidth <= 768;
    }

    _adjustBodyPaddingForBottomNav() {
        if (!this.bottomNavElement) return; // Sai se a bottom nav não existir

        if (this._isMobileView()) {
            // Se o conteúdo da aba da conta está ativo, a bottom nav é escondida, então sem padding.
            if (this.bodyElement.classList.contains(this.bodyAccountContentActiveClassName)) {
                this.bodyElement.style.paddingBottom = '0';
            }
            // Se o menu da conta (sidebar) está ativo, a bottom nav é mostrada, então precisa de padding.
            else {
                this.bodyElement.style.paddingBottom = `var(--bottom-nav-height, 60px)`;
            }
        } else { // Desktop
            this.bodyElement.style.paddingBottom = ''; // Remove padding customizado
        }
    }


    _updateUIVisibility(isContentActive) {
        const isMobile = this._isMobileView();

        if (isMobile) {
            if (isContentActive) {
                this.quizUI.showElement(this.elements.backToMenuButton);
                this.quizUI.hideElement(this.elements.sidebar);
                this.quizUI.showElement(this.elements.contentArea);
                this.bodyElement.classList.add(this.bodyAccountContentActiveClassName);
                if(this.bottomNavElement) this.quizUI.hideElement(this.bottomNavElement);
            } else { // Mostrando o menu (sidebar)
                this.quizUI.hideElement(this.elements.backToMenuButton);
                this.quizUI.showElement(this.elements.sidebar);
                this.quizUI.hideElement(this.elements.contentArea);
                this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
                if(this.bottomNavElement) this.quizUI.showElement(this.bottomNavElement);
            }
        } else { // Desktop view
            this.quizUI.showElement(this.elements.sidebar);
            this.quizUI.showElement(this.elements.contentArea);
            this.quizUI.hideElement(this.elements.backToMenuButton); // Sempre escondido no desktop
            this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
            if(this.bottomNavElement) this.quizUI.hideElement(this.bottomNavElement); // Bottom nav sempre escondida no desktop
        }
        this._adjustBodyPaddingForBottomNav();
    }

    _handleResize() {
        // A visibilidade em si é determinada pelo estado atual (menu vs conteúdo)
        // O _updateUIVisibility já cuida de mostrar/esconder baseado em isMobileView e no estado.
        const currentContentSectionVisible = this.elements.contentArea && !this.elements.contentArea.classList.contains('u-is-hidden');
        const currentSidebarVisible = this.elements.sidebar && !this.elements.sidebar.classList.contains('u-is-hidden');

        if (this._isMobileView()) {
             // Se ambos estiverem visíveis (o que não deveria acontecer em mobile após _updateUIVisibility), prioriza mostrar menu.
            if (currentContentSectionVisible && currentSidebarVisible) {
                this._updateUIVisibility(false);
            } else if (currentContentSectionVisible) {
                this._updateUIVisibility(true);
            } else { // Sidebar visível ou nenhum visível (assume menu)
                this._updateUIVisibility(false);
            }
        } else { // Desktop
            this._updateUIVisibility(true); // Em desktop, o conteúdo está sempre "ativo" ao lado da sidebar
        }
    }

    _determineAndActivateTab(historyState, currentHash, isInitialLoad = false, isPopStateCall = false) {
        let targetIdToShow = null;
        let isContentViewInitially = !this._isMobileView(); // Desktop: conteúdo visível. Mobile: menu visível.

        if (historyState) {
            if (historyState.isAccountSectionContent && historyState.target) {
                targetIdToShow = historyState.target;
                isContentViewInitially = true;
            } else if (historyState.isAccountSectionMenu && historyState.target) {
                targetIdToShow = historyState.target; // Mantém o target para destacar o link certo
                isContentViewInitially = false;
            }
        }

        if (!targetIdToShow && currentHash) {
            const linkByHash = this.elements.sidebarLinks.find(link => link.getAttribute('href') === currentHash);
            if (linkByHash) {
                targetIdToShow = linkByHash.dataset.target;
                isContentViewInitially = true;
            }
        }

        const activeTabOnError = this.bodyElement.dataset.activeTabOnError;
        if (activeTabOnError && isInitialLoad && (!targetIdToShow || (historyState && !historyState.isAccountSectionMenu))) {
            const linkForErrorTab = this.elements.sidebarLinks.find(link => link.dataset.target === activeTabOnError);
            if (linkForErrorTab) {
                targetIdToShow = activeTabOnError;
                isContentViewInitially = true;
                if (!isPopStateCall && window.history.replaceState) {
                    const newHashForErrorTab = linkForErrorTab.getAttribute('href');
                    if (window.location.hash !== newHashForErrorTab) {
                        window.history.replaceState({ target: targetIdToShow, isAccountSectionContent: true }, '', newHashForErrorTab);
                    }
                }
            }
        }
        
        if (!targetIdToShow) {
            targetIdToShow = isContentViewInitially ? this.lastActiveContentTargetId : this.defaultMenuTargetId;
        }
        
        // Se, após todas as verificações, em mobile, o estado for de conteúdo mas nenhum targetId específico foi definido
        // (ex: URL base da conta, mas não é carga inicial), reverter para mostrar o menu com a última aba ativa destacada.
        if (this._isMobileView() && isContentViewInitially && !targetIdToShow && !isInitialLoad) {
             isContentViewInitially = false;
             targetIdToShow = this.lastActiveContentTargetId;
        } else if (!targetIdToShow) { // Fallback final
            targetIdToShow = this.defaultMenuTargetId;
        }
        
        this.lastActiveContentTargetId = isContentViewInitially ? targetIdToShow : this.lastActiveContentTargetId;

        const linkToActivate = this.elements.sidebarLinks.find(
            (link) => link.dataset.target === targetIdToShow
        ) || this.elements.sidebarLinks[0];

        if (linkToActivate) {
            this.setActiveTab(linkToActivate, targetIdToShow); // Passa targetIdToShow aqui
            if (isContentViewInitially) {
                this._loadDynamicContent(targetIdToShow);
            }
             if (!isPopStateCall) {
                if (isContentViewInitially) {
                    this._scrollToContentTop();
                    this.activeSectionTitleElement = document.querySelector(`#${targetIdToShow} .card__title`);
                    this.activeSectionTitleElement?.focus({ preventScroll: true });
                } else if (this._isMobileView()) {
                    this._scrollToContentTop();
                    linkToActivate.focus({ preventScroll: false });
                }
            }
        }
        
        this._updateUIVisibility(isContentViewInitially);

        if (isInitialLoad && !isPopStateCall && window.history.replaceState) {
            const currentPath = window.location.pathname;
            const expectedHash = (isContentViewInitially || this._isMobileView()) && linkToActivate ? linkToActivate.getAttribute('href') : '';
            const newState = isContentViewInitially ?
                { target: targetIdToShow, isAccountSectionContent: true } :
                { target: targetIdToShow, isAccountSectionMenu: true };
    
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
            if (isVisible) {
                this.activeSectionTitleElement = section.querySelector('.card__title');
            }
        });
        // Se estiver mostrando o menu em mobile, a "aba ativa" é o link clicado.
        // Se estiver mostrando conteúdo, e for mobile, this.lastActiveContentTargetId já foi atualizado.
        // Em desktop, a aba ativa é sempre a de conteúdo.
        if (!this._isMobileView() || (this._isMobileView() && targetId && document.getElementById(targetId)?.classList.contains('is-visible'))) {
            this.lastActiveContentTargetId = targetId;
        }

    }

    _loadDynamicContent(targetId) {
        if (targetId === 'favorite-questions-content') {
            if (this.quizUI?.favoriteManager) {
                this.quizUI.favoriteManager.loadUserFavorites();
            }
        }
    }

    _toggleDeleteAccountModal(show) {
        // ... (lógica do modal como na resposta anterior) ...
        const overlay = this.elements.deleteAccountModalOverlay;
        const dialog = this.elements.deleteAccountModalDialog;
        const passwordInput = this.elements.passwordInputDelete;

        if (!overlay || !dialog) return;

        if (show) {
            this.quizUI.focusedElementBeforeModal = document.activeElement;
            overlay.classList.remove('u-is-hidden');
            
            overlay.scrollTop; 
            dialog.scrollTop;

            requestAnimationFrame(() => {
                overlay.classList.add('modal--visible');
                this.quizUI.activeModalCount = (this.quizUI.activeModalCount || 0) + 1;
                if (this.quizUI.activeModalCount === 1) {
                    this.bodyElement.classList.add('no-scroll');
                }
                if (passwordInput) passwordInput.focus();
            });
        } else { 
            overlay.classList.remove('modal--visible');
            
            const transitionDuration = parseFloat(getComputedStyle(overlay).transitionDuration) * 1000 || 300;
            setTimeout(() => {
                overlay.classList.add('u-is-hidden');
                if (passwordInput) passwordInput.value = ''; 

                const errorMessagesContainer = dialog.querySelector('.form-message--error');
                if(errorMessagesContainer) {
                    errorMessagesContainer.innerHTML = ''; 
                    errorMessagesContainer.style.display = 'none'; 
                }
                
                this.quizUI.activeModalCount = Math.max(0, (this.quizUI.activeModalCount || 0) - 1);
                if (this.quizUI.activeModalCount === 0) {
                    this.bodyElement.classList.remove('no-scroll');
                }
                if (this.quizUI.focusedElementBeforeModal && document.body.contains(this.quizUI.focusedElementBeforeModal)) {
                    this.quizUI.focusedElementBeforeModal.focus({ preventScroll: true });
                }
                this.quizUI.focusedElementBeforeModal = null;

            }, transitionDuration);
        }
    }
}