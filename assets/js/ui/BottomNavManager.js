// assets/js/ui/BottomNavManager.js

import { quizActions } from '../app/flux/actions.js';

export default class BottomNavManager {
    constructor() {
        this.bottomNavList = document.querySelector('.bottom-nav__list');
        this.links = this.bottomNavList ? Array.from(this.bottomNavList.querySelectorAll('.bottom-nav__link')) : [];
        
        // As dependências serão injetadas
        this.store = null;
        this.previousActiveSection = null;
    }

    /**
     * Define a instância do store e se inscreve para atualizações.
     * @param {object} storeInstance - A instância do store.
     */
    setStore(storeInstance) {
        this.store = storeInstance;
        if (this.store) {
            // Sincroniza o estado visual assim que o store é conectado
            this.handleStateUpdate();
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }

    init() {
        if (!this.bottomNavList) {
            return;
        }
        // A configuração de listeners de clique foi removida, pois
        // queremos o comportamento padrão dos links <a>.
        // this._setupEventListeners();
    }
    
    /**
     * Lida com as atualizações de estado do store,
     * mantendo o estado visual da navbar sincronizado.
     */
    handleStateUpdate() {
        if (!this.store) return;
        
        const state = this.store.getState();
        // Se o estado ainda não foi inicializado, não faz nada
        if (!state || !state.ui) return;
        
        const activeSection = state.ui.activeSection;
        
        // Apenas atualiza o DOM se a seção ativa mudou
        if (activeSection !== this.previousActiveSection) {
            this.syncVisualState(activeSection);
            this.previousActiveSection = activeSection;
        }
    }

    /**
     * Sincroniza o estado visual da navbar (a pílula ativa) com a seção ativa no store.
     * @param {string} activeSection - O ID da seção que deve estar ativa.
     */
    syncVisualState(activeSection) {
        // Remove a classe ativa do item atual
        const currentActiveItem = this.bottomNavList.querySelector('.bottom-nav__item.is-active');
        if (currentActiveItem) {
            currentActiveItem.classList.remove('is-active');
        }

        // Encontra o novo link ativo com base no estado e o ativa
        // O dataset 'section-target-django' deve corresponder aos valores em `state.ui.activeSection` ('home', 'questions', 'account')
        const newActiveLink = this.links.find(link => link.dataset.sectionTargetDjango === activeSection);
        if (newActiveLink && newActiveLink.parentElement) {
            newActiveLink.parentElement.classList.add('is-active');
        }
    }
}