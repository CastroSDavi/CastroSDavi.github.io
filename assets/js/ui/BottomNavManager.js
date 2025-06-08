// assets/js/ui/BottomNavManager.js

export default class BottomNavManager {
    constructor() {
        this.bottomNavList = document.querySelector('.bottom-nav__list');
        // Duração da animação da pílula deslizante em milissegundos.
        // Deve corresponder ao valor em .bottom-nav__pill-indicator (transition: transform 0.45s ...)
        this.animationDuration = 450;
        this.isNavigating = false; // Flag para evitar cliques duplos
    }

    init() {
        if (!this.bottomNavList) {
            return;
        }
        this.syncActiveState();
        this._setupEventListeners(); // <-- NOVA CHAMADA para configurar os cliques
    }
    
    // =====================================================================
    // ======================== LÓGICA ADICIONADA ========================
    // =====================================================================

    /**
     * Adiciona listeners de clique aos links da navbar para controlar a navegação.
     * @private
     */
    _setupEventListeners() {
        const links = this.bottomNavList.querySelectorAll('.bottom-nav__link');
        links.forEach(link => {
            link.addEventListener('click', (event) => this._handleLinkClick(event));
        });
    }

    /**
     * Lida com o clique em um link da navbar.
     * Previne o recarregamento imediato, executa a animação e então navega.
     * @param {Event} event - O evento de clique.
     * @private
     */
    _handleLinkClick(event) {
        if (this.isNavigating) {
            event.preventDefault(); // Evita navegação se já estiver em progresso
            return;
        }

        const link = event.currentTarget;
        const parentLi = link.parentElement;

        // Se o link clicado já está ativo, não faz nada
        if (parentLi.classList.contains('is-active')) {
            event.preventDefault();
            return;
        }
        
        // 1. Previne o comportamento padrão do link (recarregar a página)
        event.preventDefault();
        this.isNavigating = true;

        // 2. Move a pílula de animação
        this.setActiveItem(parentLi);

        // 3. Após a animação terminar, navega para a nova página
        setTimeout(() => {
            window.location.href = link.href;
        }, this.animationDuration);
    }
    
    /**
     * Define qual item (li) está ativo, movendo a classe 'is-active'.
     * @param {HTMLElement} targetLi - O elemento <li> que deve se tornar ativo.
     */
    setActiveItem(targetLi) {
        const currentActive = this.bottomNavList.querySelector('.bottom-nav__item.is-active');
        if (currentActive) {
            currentActive.classList.remove('is-active');
        }
        if (targetLi) {
            targetLi.classList.add('is-active');
        }
    }
    
    // =====================================================================
    // ======================= FIM DA LÓGICA ADICIONADA =====================
    // =====================================================================


    /**
     * Sincroniza o estado visual da navbar com o estado renderizado pelo servidor.
     * Ele encontra o link com a classe '.bottom-nav__link--active' (do Django)
     * e aplica a classe 'is-active' ao seu elemento pai <li>, que o CSS usa
     * para posicionar a pílula indicadora.
     */
    syncActiveState() {
        const activeLink = this.bottomNavList.querySelector('.bottom-nav__link--active');
        
        if (activeLink && activeLink.parentElement.classList.contains('bottom-nav__item')) {
            this.setActiveItem(activeLink.parentElement);
        } else {
            const firstRealItem = this.bottomNavList.querySelector('.bottom-nav__item:not(.bottom-nav__pill-indicator)');
            if (firstRealItem) {
                this.setActiveItem(firstRealItem);
            }
        }
    }
}