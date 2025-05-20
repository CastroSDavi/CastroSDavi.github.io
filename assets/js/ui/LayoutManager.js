// File: assets/js/ui/LayoutManager.js

export default class LayoutManager {
    constructor() {
        this.bodyElement = document.body;
    }

    /**
     * Lida com mudanças de layout globais baseadas na seção/página ativa.
     * A visibilidade do footer é agora primariamente controlada por CSS.
     * Este método pode gerenciar outras classes globais no body, se necessário.
     *
     * @param {string} activePageId - O valor de `data-page-id` da página ativa.
     */
    handleActiveSectionChange(activePageId) {
        if (!this.bodyElement) {
            return;
        }

        // A lógica principal de visibilidade do footer foi movida para CSS
        // usando seletores como `body[data-page-id="questions"] .site-footer`.

        // Este método permanece para futuras lógicas de layout globais
        // ou para gerenciar classes no body que afetem mais do que apenas o footer.
        // Por exemplo, classes de tema ou a classe 'no-scroll' poderiam ser
        // gerenciadas aqui de forma mais centralizada se a complexidade aumentar.
    }
}