// File: assets/js/ui/AccountPageManager.js

export default class AccountPageManager {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance; // Instância de QuizUI para interações e acesso a elementos globais
        this.elements = {
            // Elementos principais da página da conta
            accountSectionPage: document.getElementById('account-section-page'),
            sidebar: document.querySelector('#account-section-page .account-sidebar'),
            contentArea: document.querySelector('#account-section-page .account-content'),
            backToMenuButton: document.getElementById('account-back-to-menu'),
            sidebarLinks: null, // Preenchido no init
            contentSections: null, // Preenchido no init

            // Elementos do modal de exclusão de conta
            deleteAccountModalOverlay: document.getElementById('delete-account-modal-overlay'),
            deleteAccountModalDialog: document.getElementById('delete-account-modal-dialog'),
            btnOpenDeleteModal: document.getElementById('btn-open-delete-account-modal'),
            btnCancelDelete: document.getElementById('cancel-delete-account-btn'),
            // O botão de confirmação de exclusão está dentro do formulário e será tratado pelo submit do form.
            deleteAccountForm: document.getElementById('deleteAccountForm'), // O formulário em si
            passwordInputDelete: null // Preenchido no init se o form existir
        };
        this.bodyAccountContentActiveClassName = 'body-account-content-active';
        this.bodyElement = document.body;
        this.bottomNavElement = document.querySelector('.bottom-nav');
        this.defaultMenuTargetId = null;

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

        if (this.elements.sidebarLinks.length > 0) {
            this.defaultMenuTargetId = this.elements.sidebarLinks[0].dataset.target;
        }

        this._setupEventListeners();
        this._determineAndActivateTab(window.history.state, window.location.hash, true);
        this._handleResize(); // Garante estado visual correto no carregamento

        // Verificar se é para reabrir modal de deleção devido a erro
        const activeTabOnError = this.bodyElement.dataset.activeTabOnError;
        const showDeleteModalOnError = this.bodyElement.dataset.showDeleteModalOnError === 'true';

        if (activeTabOnError === 'security-content' && showDeleteModalOnError) {
            // Pequeno delay para garantir que a aba 'security-content' já foi ativada pelo _determineAndActivateTab
            setTimeout(() => {
                this._toggleDeleteAccountModal(true);
            }, 100); // Ajuste o delay se necessário
        }
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
                this._updateUIVisibility(true);

                if (window.history.pushState) {
                    window.history.pushState({ target: targetId, isAccountSectionContent: true }, null, newHash);
                }
            });
        });

        this.elements.backToMenuButton?.addEventListener('click', () => {
            if (this._isMobileView()) {
                this._scrollToContentTop();
                const defaultLink = this.elements.sidebarLinks.find(l => l.dataset.target === this.defaultMenuTargetId) || this.elements.sidebarLinks[0];
                const menuHash = defaultLink ? defaultLink.getAttribute('href') : '';

                if (window.history.pushState) {
                    window.history.pushState({ isAccountSectionMenu: true, target: this.defaultMenuTargetId }, null, menuHash);
                }
                this._determineAndActivateTab({ isAccountSectionMenu: true, target: this.defaultMenuTargetId }, menuHash);
                if (defaultLink) defaultLink.focus({ preventScroll: false });
            }
        });

        window.addEventListener('popstate', (event) => {
            if (this.bodyElement.dataset.pageId === 'account') {
                this._determineAndActivateTab(event.state, window.location.hash, false, true);
            }
        });

        window.addEventListener('resize', this._handleResize.bind(this));

        // Listeners para o modal de exclusão de conta
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

        // Listener de Escape para o modal de deleção (se o ModalManager global não o cobrir)
        // Se ModalManager já lida com Escape para todos os modais, este pode ser redundante
        // ou pode ser específico se este modal não for registrado no ModalManager.
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

    _updateUIVisibility(isContentActive) {
        if (this._isMobileView()) {
            if (isContentActive) {
                this.bodyElement.classList.add(this.bodyAccountContentActiveClassName);
                this.quizUI.showElement(this.elements.backToMenuButton);
                this.quizUI.hideElement(this.bottomNavElement);
            } else {
                this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
                this.quizUI.hideElement(this.elements.backToMenuButton);
                this.quizUI.showElement(this.bottomNavElement);
            }
        } else {
            this.bodyElement.classList.remove(this.bodyAccountContentActiveClassName);
            this.quizUI.hideElement(this.elements.backToMenuButton);
        }
        this._adjustBodyPaddingForBottomNav();
    }

    _handleResize() {
        const isContentActive = this.bodyElement.classList.contains(this.bodyAccountContentActiveClassName);
        this._updateUIVisibility(isContentActive);
    }

    _determineAndActivateTab(historyState, currentHash, isInitialLoad = false, isPopStateCall = false) {
        let targetIdToShow = null;
        let isContentView = false;

        if (historyState) {
            if (historyState.isAccountSectionContent && historyState.target) {
                targetIdToShow = historyState.target;
                isContentView = true;
            } else if (historyState.isAccountSectionMenu) {
                targetIdToShow = historyState.target || this.defaultMenuTargetId;
                isContentView = false;
            }
        }

        if (!targetIdToShow && currentHash) {
            const linkByHash = this.elements.sidebarLinks.find(
                (link) => link.getAttribute('href') === currentHash
            );
            if (linkByHash) {
                targetIdToShow = linkByHash.dataset.target;
                isContentView = true;
            }
        }

        if (!targetIdToShow) {
            targetIdToShow = this.defaultMenuTargetId;
            isContentView = false;
        }
        
        // Se a view Django passou uma dica para reabrir uma aba específica (ex: após erro de formulário)
        const activeTabOnError = this.bodyElement.dataset.activeTabOnError;
        if (activeTabOnError && !isPopStateCall) { // Só considera na carga inicial ou navegação direta
            const linkForErrorTab = this.elements.sidebarLinks.find(link => link.dataset.target === activeTabOnError);
            if(linkForErrorTab) {
                targetIdToShow = activeTabOnError;
                isContentView = true; // Assume que erro de formulário ocorre em uma aba de conteúdo
                 // Atualiza o hash para refletir a aba de erro
                if (window.history.replaceState && window.location.hash !== linkForErrorTab.getAttribute('href')) {
                    window.history.replaceState({ target: targetIdToShow, isAccountSectionContent: true }, '', linkForErrorTab.getAttribute('href'));
                }
            }
        }


        const linkToActivate = this.elements.sidebarLinks.find(
            (link) => link.dataset.target === targetIdToShow
        ) || this.elements.sidebarLinks[0];

        if (linkToActivate) {
            this.setActiveTab(linkToActivate, linkToActivate.dataset.target);
            if (isContentView) {
                this._loadDynamicContent(linkToActivate.dataset.target);
            }
            if (!isPopStateCall && !isInitialLoad) {
                this._scrollToContentTop();
            }
        }

        this._updateUIVisibility(isContentView);

        if (!isPopStateCall && window.history.replaceState && !isInitialLoad) { // Evita replaceState na carga inicial se o hash já está correto
            const currentPath = window.location.pathname;
            const expectedHash = linkToActivate ? linkToActivate.getAttribute('href') : '';
            const newState = isContentView ?
                { target: linkToActivate.dataset.target, isAccountSectionContent: true } :
                { isAccountSectionMenu: true, target: linkToActivate.dataset.target };

            if ((isContentView && expectedHash && expectedHash !== currentHash) || 
                (!isContentView && currentHash !== (expectedHash || '')) ) {
                window.history.replaceState(newState, '', currentPath + (expectedHash || ''));
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
            // Foco pode ser gerenciado de forma mais inteligente, por exemplo, apenas em cliques diretos.
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
        // Outras lógicas de carregamento dinâmico podem ser adicionadas aqui para outras abas.
    }

    // Nova função para controlar o modal de exclusão
    _toggleDeleteAccountModal(show) {
        const overlay = this.elements.deleteAccountModalOverlay;
        const dialog = this.elements.deleteAccountModalDialog;
        const passwordInput = this.elements.passwordInputDelete;

        if (!overlay || !dialog) return;

        if (show) {
            overlay.classList.remove('u-is-hidden');
            // Forçar reflow para garantir transição
            overlay.scrollTop; 
            dialog.scrollTop;

            requestAnimationFrame(() => {
                overlay.classList.add('modal--visible');
                // Se o dialog também tiver classe de animação, adicionar aqui
                // dialog.classList.add('modal--dialog-visible'); 
                if (passwordInput) passwordInput.focus();
            });
            this.bodyElement.classList.add('no-scroll');
        } else {
            overlay.classList.remove('modal--visible');
            // Se o dialog também tiver classe de animação, remover aqui
            // dialog.classList.remove('modal--dialog-visible');

            // Usar o tempo de transição do CSS para esconder o overlay
            const transitionDuration = parseFloat(getComputedStyle(overlay).transitionDuration) * 1000 || 300;
            setTimeout(() => {
                overlay.classList.add('u-is-hidden');
                if (passwordInput) passwordInput.value = ''; // Limpa senha

                // Limpar mensagens de erro no modal, se houver
                const errorMessagesContainer = dialog.querySelector('.form-message--error');
                if(errorMessagesContainer) {
                    // Em vez de remover, apenas esvazia, pois o template Django pode recriá-lo
                    errorMessagesContainer.innerHTML = ''; 
                    errorMessagesContainer.style.display = 'none'; // Oculta o container de erro
                }

            }, transitionDuration);
            this.bodyElement.classList.remove('no-scroll');
        }
    }
}