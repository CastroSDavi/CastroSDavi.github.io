// assets/js/ui/BottomNavManager.js

export default class BottomNavManager {
    constructor() {
        /**
         * Encontra a lista da navbar no DOM.
         * @type {HTMLElement|null}
         */
        this.bottomNavList = document.querySelector('.bottom-nav__list');
    }

    /**
     * Inicializa o gerenciador da navbar.
     * Se a navbar existir na página, sincroniza seu estado ativo.
     */
    init() {
        if (!this.bottomNavList) {
            // Se não houver navbar na página, não faz nada.
            return;
        }
        this.syncActiveState();
    }

    /**
     * Sincroniza o estado visual da navbar com o estado renderizado pelo servidor.
     * Ele encontra o link com a classe '.bottom-nav__link--active' (do Django)
     * e aplica a classe 'is-active' ao seu elemento pai <li>, que o CSS usa
     * para posicionar a pílula indicadora.
     */
    syncActiveState() {
        // Garante que o estado anterior seja limpo
        const allItems = this.bottomNavList.querySelectorAll('.bottom-nav__item');
        allItems.forEach(item => item.classList.remove('is-active'));

        // Encontra o link que o Django marcou como ativo
        const activeLink = this.bottomNavList.querySelector('.bottom-nav__link--active');
        
        if (activeLink && activeLink.parentElement.classList.contains('bottom-nav__item')) {
            // Adiciona a classe 'is-active' ao <li> pai
            activeLink.parentElement.classList.add('is-active');
        } else {
            // Fallback: Se por algum motivo nenhum link estiver ativo (ex: em uma página não mapeada),
            // ativa o primeiro item como padrão para evitar que a pílula fique fora do lugar.
            const firstRealItem = this.bottomNavList.querySelector('.bottom-nav__item:not(.bottom-nav__pill-indicator)');
            if (firstRealItem) {
                firstRealItem.classList.add('is-active');
            }
        }
    }
}