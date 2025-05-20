// File: assets/js/ui/AccountPageManager.js

export default class AccountPageManager {
    constructor(quizUIInstance) {
        // console.log("ACCOUNTPAGEMANAGER.JS: Constructor - Instanciando AccountPageManager.");
        this.quizUI = quizUIInstance;
        this.elements = {
            accountSectionPage: document.getElementById('account-section-page'), // Elemento principal da página da conta
            sidebarLinks: null,       // Será populado em init
            contentSections: null,    // Será populado em init
        };

        // A inicialização (chamada ao this.init()) foi REMOVIDA daqui.
        // Ela será chamada pelo App.js após a seção da conta ser tornada visível.
    }

    init() {
        // console.log("ACCOUNTPAGEMANAGER.JS: init - Inicializando listeners e estado da página da conta.");
        
        // Verifica se o elemento principal da página da conta existe antes de prosseguir
        if (!this.elements.accountSectionPage) {
            // console.warn("AccountPageManager.init: Elemento principal 'account-section-page' não encontrado. Abortando inicialização do manager.");
            return;
        }
        // Verifica se a seção da conta está realmente visível antes de prosseguir com a configuração dos listeners.
        // Isso garante que o init só execute sua lógica principal se a página estiver de fato ativa.
        if (this.elements.accountSectionPage.classList.contains(this.quizUI.hiddenClassName)) {
            // console.log("AccountPageManager.init: Seção da conta está oculta. Adia a configuração de listeners e estado da aba.");
            return;
        }

        // Busca os links da barra lateral e as seções de conteúdo DENTRO da página da conta
        this.elements.sidebarLinks = this.elements.accountSectionPage.querySelectorAll('.account-sidebar__link');
        this.elements.contentSections = this.elements.accountSectionPage.querySelectorAll('.account-content__section');

        if (this.elements.sidebarLinks.length === 0 || this.elements.contentSections.length === 0) {
            // console.warn("AccountPageManager: Links da barra lateral ou seções de conteúdo não encontradas na página da conta.");
            return;
        }

        this.elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault(); // Previne a navegação padrão do hash
                const targetId = link.dataset.target;
                
                this.setActiveTab(link, targetId); // Define a aba ativa
                
                // Atualiza o hash na URL sem recarregar a página
                if (window.history.pushState) {
                    window.history.pushState(null, null, link.href);
                } else {
                    // Fallback para navegadores mais antigos
                    window.location.hash = link.href.split('#')[1];
                }
                this._loadDynamicContent(targetId); // Carrega conteúdo dinâmico para a aba, se necessário
            });
        });

        // Listener para os botões de voltar/avançar do navegador
        window.addEventListener('popstate', () => {
            this._activateTabFromHash();
        });

        // Ativa a aba correta no carregamento inicial da página (baseado no hash ou padrão)
        this._activateTabFromHash();
    }

    _activateTabFromHash() {
        // Verifica se os elementos da sidebar existem antes de prosseguir.
        if (!this.elements.sidebarLinks || this.elements.sidebarLinks.length === 0) {
            // console.log("AccountPageManager._activateTabFromHash: Links da sidebar não disponíveis. Ativação de aba adiada.");
            return;
        }

        const hash = window.location.hash;
        let activated = false; // Flag para verificar se uma aba foi ativada pelo hash

        if (hash) {
            const targetLink = Array.from(this.elements.sidebarLinks).find(
                (link) => link.getAttribute('href') === hash
            );
            if (targetLink) {
                const targetId = targetLink.dataset.target;
                this.setActiveTab(targetLink, targetId);
                this._loadDynamicContent(targetId);
                activated = true;
            }
        }
        
        // Se nenhuma aba foi ativada pelo hash (ou não há hash), ativa a primeira aba como padrão
        if (!activated) {
            const firstLink = this.elements.sidebarLinks[0];
            const firstSectionId = firstLink.dataset.target;
            const firstSection = document.getElementById(firstSectionId);

            // Verifica se a primeira seção já está visível (devido à classe 'is-visible' no HTML)
            if (firstSection && firstSection.classList.contains('is-visible')) {
                // Se já estiver visível, apenas garante que o link da sidebar correspondente esteja ativo.
                this.elements.sidebarLinks.forEach(link => link.classList.remove('is-active'));
                firstLink.classList.add('is-active');
            } else {
                // Se não estiver visível, define a aba como ativa (mostrará a seção)
                this.setActiveTab(firstLink, firstSectionId);
            }
            
            this._loadDynamicContent(firstSectionId); // Carrega conteúdo dinâmico da primeira aba, se aplicável

            // Define o hash para o primeiro link se nenhum hash estava presente, para consistência na URL
            if (!hash && window.history.replaceState && firstLink.getAttribute('href')) {
                 window.history.replaceState(null, null, firstLink.getAttribute('href'));
            }
        }
    }

    setActiveTab(clickedLink, targetId) {
        if (!this.elements.sidebarLinks || !this.elements.contentSections) {
            // console.warn("AccountPageManager: Tentativa de setActiveTab sem sidebarLinks ou contentSections cacheados.");
            return;
        }

        // Atualiza o estado ativo dos links da barra lateral
        this.elements.sidebarLinks.forEach(link => {
            link.classList.remove('is-active');
        });
        if (clickedLink) { // Garante que clickedLink não seja null/undefined
            clickedLink.classList.add('is-active');
        }

        // Alterna a visibilidade das seções de conteúdo
        this.elements.contentSections.forEach(section => {
            if (section.id === targetId) {
                section.classList.add('is-visible'); // Usa a classe .is-visible para mostrar
            } else {
                section.classList.remove('is-visible'); // Remove .is-visible para esconder
            }
        });
    }

    _loadDynamicContent(targetId) {
        // console.log(`ACCOUNTPAGEMANAGER.JS: _loadDynamicContent - Verificando conteúdo para ${targetId}`);
        if (targetId === 'favorite-questions-content') {
            // Verifica se QuizUI e FavoriteManager estão disponíveis
            if (this.quizUI && this.quizUI.favoriteManager && typeof this.quizUI.favoriteManager.loadUserFavorites === 'function') {
                const favContainer = this.quizUI.elements.favoriteQuestionsContainer; // Acessa o container via QuizUI.elements
                if (favContainer) {
                    const placeholder = favContainer.querySelector('.placeholder-text');
                    const hasItems = favContainer.querySelector('.favorite-question-item'); // Verifica se já existem itens de favoritos
                    
                    // Condição para carregar:
                    // 1. Se o placeholder estiver visível E não houver itens.
                    // 2. OU se não houver placeholder E não houver itens (primeira carga, talvez o placeholder tenha sido removido).
                    const shouldLoad = (placeholder && !placeholder.classList.contains(this.quizUI.hiddenClassName) && !hasItems) ||
                                     (!placeholder && !hasItems);

                    if (shouldLoad) {
                        // console.log("ACCOUNTPAGEMANAGER.JS: _loadDynamicContent - Chamando loadUserFavorites.");
                        this.quizUI.favoriteManager.loadUserFavorites();
                    }
                } else {
                    // console.warn("AccountPageManager: Container de questões favoritas (favoriteQuestionsContainer) não encontrado em QuizUI.elements.");
                }
            } else {
                // console.warn("AccountPageManager: FavoriteManager não está disponível ou método loadUserFavorites ausente em QuizUI.");
            }
        }
        // Adicionar lógica para carregar dinamicamente outras seções se necessário no futuro
    }
}