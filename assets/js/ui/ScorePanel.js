// File: assets/js/ui/ScorePanel.js

export default class ScorePanel {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements;
        
        // As dependências serão injetadas via setters pelo QuizUI
        this.store = null;
        this.actionOrchestrator = null;
        this.previousUserState = null; // Para comparar mudanças específicas
        
        this._setupEventListeners();
    }

    /**
     * Define a instância do store e se inscreve para atualizações.
     * @param {object} storeInstance - A instância do store.
     */
    setStore(storeInstance) {
        this.store = storeInstance;
        if (this.store) {
            // Armazena o estado inicial do usuário para comparação
            this.previousUserState = { ...this.store.getState().user };
            
            // Inscreve-se para futuras atualizações
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }
    
    /**
     * Define a instância do ActionOrchestrator.
     * @param {ActionOrchestrator} orchestrator - A instância do orquestrador.
     */
    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }

    /**
     * Lida com as atualizações de estado do store.
     * Este método é o coração reativo do componente.
     */
    handleStateUpdate() {
        if (!this.store) return;
        
        const currentState = this.store.getState();
        const currentUserState = currentState.user; // Supondo que os dados do usuário estejam em `state.user`
        
        // Verifica se houve mudança nos dados do usuário para evitar re-renderizações desnecessárias
        if (
            currentUserState.pontos !== this.previousUserState.pontos ||
            currentUserState.acertos !== this.previousUserState.acertos ||
            currentUserState.erros !== this.previousUserState.erros ||
            currentUserState.xp !== this.previousUserState.xp ||
            currentUserState.currentStreak !== this.previousUserState.currentStreak ||
            currentUserState.multiplier !== this.previousUserState.multiplier
        ) {
            this._render(
                currentUserState.pontos,
                currentUserState.acertos,
                currentUserState.erros,
                currentUserState.xp,
                currentUserState.currentStreak,
                currentUserState.multiplier
            );
        }

        // Atualiza o estado anterior
        this.previousUserState = { ...currentUserState };
    }

    _setupEventListeners() {
        this.elements.btnEncerrarSessao?.addEventListener('click', () => {
            // Em vez de um callback, chama o orquestrador diretamente
            // para lidar com a lógica de abrir o modal.
            if (this.quizUI.modalManager) {
                this.quizUI.modalManager.toggleConfirmModal(true);
            }
        });
    }

    /**
     * Método privado que realmente atualiza o DOM.
     * Substitui o antigo `updateDisplay`.
     */
    _render(pontos, acertos, erros, xp = 0, streak = 0, multiplier = 1) {
        if (this.elements.pontuacaoDisplay) {
            this.elements.pontuacaoDisplay.textContent = pontos;
        }
        if (this.elements.acertosNumDisplay) {
            this.elements.acertosNumDisplay.textContent = acertos;
        }
        if (this.elements.errosNumDisplay) {
            this.elements.errosNumDisplay.textContent = erros;
        }
        if (this.elements.xpDisplay) {
            this.elements.xpDisplay.textContent = Number(xp || 0).toLocaleString('pt-BR');
        }
        if (this.elements.sequenciaDisplay) {
            this.elements.sequenciaDisplay.textContent = Number(streak || 0).toLocaleString('pt-BR');
        }
        if (this.elements.multiplicadorDisplay) {
            const multiplierNumber = Number.isFinite(multiplier) ? Number(multiplier) : 1;
            const decimals = multiplierNumber % 1 === 0 ? 0 : 1;
            this.elements.multiplicadorDisplay.textContent = `x${multiplierNumber.toFixed(decimals)}`;
            if (multiplierNumber > 1) {
                this.elements.multiplicadorDisplay.classList.add('is-active');
            } else {
                this.elements.multiplicadorDisplay.classList.remove('is-active');
            }
        }
    }

    // O método `resetDisplay` não é mais necessário, pois o reset
    // acontecerá reativamente quando o estado do usuário for resetado no store.

    show() {
        if (this.elements.scorePanel) {
            this.quizUI.showElement(this.elements.scorePanel);
        }
        if (this.elements.btnEncerrarSessao) {
            this.quizUI.showElement(this.elements.btnEncerrarSessao);
        }
    }

    hide() {
        if (this.elements.scorePanel) {
            this.quizUI.hideElement(this.elements.scorePanel);
        }
        if (this.elements.btnEncerrarSessao) {
            this.quizUI.hideElement(this.elements.btnEncerrarSessao);
        }
    }
}