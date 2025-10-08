// File: assets/js/ui/LayoutManager.js

export default class LayoutManager {
    constructor() {
        this.bodyElement = document.body;
        this.store = null;
        this.previousActiveSection = null;

        this.sectionIds = {
            home: 'home-section',
            hub: 'question-section',
            questions: 'question-section',
            account: 'account-section-page',
        };

        // --- INÍCIO DA CORREÇÃO ---
        // A referência ao bottomNavElement foi removida.
        // --- FIM DA CORREÇÃO ---
    }

    setStore(storeInstance) {
        this.store = storeInstance;
        if (this.store) {
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }

    handleStateUpdate() {
        if (!this.store) return;
        
        const state = this.store.getState();
        if (!state || !state.ui || !state.ui.uiReady) return;

        const currentActiveSectionId = state.ui.activeSection;

        if (currentActiveSectionId !== this.previousActiveSection) {
            this._updateLayout(currentActiveSectionId);
            this.previousActiveSection = currentActiveSectionId;
        }
    }
    
    _hideAllSections() {
        Object.values(this.sectionIds).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                 el.classList.add('u-is-hidden');
            }
        });
    }

    _updateLayout(activeSectionId) {
        if (!this.bodyElement) return;

        this.bodyElement.dataset.pageId = activeSectionId;
        this._hideAllSections();

        const elementIdToShow = this.sectionIds[activeSectionId];
        if (!elementIdToShow) return;

        const sectionToShow = document.getElementById(elementIdToShow);

        if (sectionToShow) {
            sectionToShow.classList.remove('u-is-hidden');
        } else {
            console.warn(`LayoutManager: Elemento da seção com ID '${elementIdToShow}' não encontrado no DOM da página atual.`);
        }

        // --- INÍCIO DA CORREÇÃO ---
        // Toda a lógica que manipulava as classes do BottomNav e do Body foi removida.
        // O controle agora é 100% via CSS, baseado no data-page-id.
        // --- FIM DA CORREÇÃO ---
    }
}