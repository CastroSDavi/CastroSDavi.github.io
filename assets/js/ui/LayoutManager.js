// File: assets/js/ui/LayoutManager.js

export default class LayoutManager {
    constructor() {
        // Cacheia o footer principal do site.
        // O seletor '.site-footer' parece ser o correto baseado no seu HTML/CSS.
        this.siteFooterElement = document.querySelector('.site-footer');
        this.hiddenClassName = 'u-is-hidden'; // Assume que esta classe CSS existe e faz display: none !important;
    }

    /**
     * Lida com mudanças de layout globais baseadas na seção ativa.
     * Atualmente, foca em mostrar/esconder o footer principal.
     * @param {string} activeSectionId - O ID da seção que se tornou ativa (ex: 'home-section', 'question-section').
     */
    handleActiveSectionChange(activeSectionId) {
        if (!this.siteFooterElement) {
            // Se o footer não for encontrado, não há nada a fazer.
            // Isso pode acontecer se o seletor estiver errado ou o elemento não existir na página.
            return;
        }

        // Lógica para esconder o footer principal (.site-footer) quando
        // a seção de questões está ativa, e mostrá-lo em outras seções.
        // Esta lógica é mais relevante para telas maiores, já que em telas menores
        // o CSS já esconde o .site-footer para dar lugar à .bottom-nav.
        if (activeSectionId === 'question-section-page' || activeSectionId === 'question-section') { // ID da QuizUI ou ID da seção no HTML
            this.siteFooterElement.classList.add(this.hiddenClassName);
        } else {
            this.siteFooterElement.classList.remove(this.hiddenClassName);
        }

        // Futuramente, outras lógicas de layout baseadas na seção ativa podem ser adicionadas aqui.
        // Ex: Adicionar uma classe ao body: document.body.className = `on-${activeSectionId}`;
    }
}