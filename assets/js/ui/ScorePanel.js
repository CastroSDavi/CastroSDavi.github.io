// File: assets/js/ui/ScorePanel.js

export default class ScorePanel {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements;
        
        // As dependências serão injetadas via setters pelo QuizUI
        this.store = null;
        this.actionOrchestrator = null;
        this.previousUserState = null; // Para comparar mudanças específicas
        this.previousTimerState = null;
        this.previousQuizState = null;
        
        this._setupEventListeners();
    }

    /**
     * Define a instância do store e se inscreve para atualizações.
     * @param {object} storeInstance - A instância do store.
     */
    setStore(storeInstance) {
        this.store = storeInstance;
        if (this.store) {
            const initialState = this.store.getState();

            this.previousUserState = { ...initialState.user };
            this.previousTimerState = { ...initialState.timer };
            this.previousQuizState = {
                currentSessionId: initialState.quiz?.currentSessionId ?? null,
                quizEnded: initialState.quiz?.quizEnded ?? false,
            };

            this._render(
                initialState.user?.pontos ?? 0,
                initialState.user?.acertos ?? 0,
                initialState.user?.erros ?? 0,
                initialState.user?.currentStreak ?? 0,
                initialState.user?.multiplier ?? 1
            );
            this._updatePauseButton(initialState.timer?.isRunning, initialState.quiz);

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
        const previousTimerState = this.previousTimerState ?? {};
        const previousQuizState = this.previousQuizState ?? {};

        if (
            currentUserState.pontos !== this.previousUserState.pontos ||
            currentUserState.acertos !== this.previousUserState.acertos ||
            currentUserState.erros !== this.previousUserState.erros ||
            currentUserState.currentStreak !== this.previousUserState.currentStreak ||
            currentUserState.multiplier !== this.previousUserState.multiplier
        ) {
            this._render(
                currentUserState.pontos,
                currentUserState.acertos,
                currentUserState.erros,
                currentUserState.currentStreak,
                currentUserState.multiplier
            );
        }

        const timerChanged = currentState.timer?.isRunning !== previousTimerState.isRunning;
        const sessionChanged =
            currentState.quiz?.currentSessionId !== previousQuizState.currentSessionId ||
            currentState.quiz?.quizEnded !== previousQuizState.quizEnded;

        if (timerChanged || sessionChanged) {
            this._updatePauseButton(currentState.timer?.isRunning, currentState.quiz);
        }

        // Atualiza o estado anterior
        this.previousUserState = { ...currentUserState };
        this.previousTimerState = { ...currentState.timer };
        this.previousQuizState = {
            currentSessionId: currentState.quiz?.currentSessionId ?? null,
            quizEnded: currentState.quiz?.quizEnded ?? false,
        };
    }

    _setupEventListeners() {
        this.elements.btnEncerrarSessao?.addEventListener('click', () => {
            // Em vez de um callback, chama o orquestrador diretamente
            // para lidar com a lógica de abrir o modal.
            if (this.quizUI.modalManager) {
                this.quizUI.modalManager.toggleConfirmModal(true);
            }
        });

        this.elements.btnTogglePause?.addEventListener('click', () => {
            if (!this.store || !this.actionOrchestrator) return;

            const state = this.store.getState();
            const hasActiveSession = Boolean(state.quiz?.currentSessionId) && state.quiz?.quizEnded !== true;

            if (!hasActiveSession) return;

            if (state.timer?.isRunning) {
                this.actionOrchestrator.pauseTimer();
            } else {
                this.actionOrchestrator.resumeTimer();
            }
        });
    }

    /**
     * Método privado que realmente atualiza o DOM.
     * Substitui o antigo `updateDisplay`.
     */
    _render(pontos, acertos, erros, streak = 0, multiplier = 1) {
        if (this.elements.pontuacaoDisplay) {
            this.elements.pontuacaoDisplay.textContent = pontos;
        }
        if (this.elements.acertosNumDisplay) {
            this.elements.acertosNumDisplay.textContent = acertos;
        }
        if (this.elements.errosNumDisplay) {
            this.elements.errosNumDisplay.textContent = erros;
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
        if (this.elements.scorePanelControls) {
            this.quizUI.showElement(this.elements.scorePanelControls);
        }
        if (this.elements.btnEncerrarSessao) {
            this.quizUI.showElement(this.elements.btnEncerrarSessao);
        }
    }

    hide() {
        if (this.elements.scorePanel) {
            this.quizUI.hideElement(this.elements.scorePanel);
        }
        if (this.elements.scorePanelControls) {
            this.quizUI.hideElement(this.elements.scorePanelControls);
        }
        if (this.elements.btnEncerrarSessao) {
            this.quizUI.hideElement(this.elements.btnEncerrarSessao);
        }
    }

    _updatePauseButton(isRunning = false, quizState = {}) {
        const button = this.elements.btnTogglePause;
        if (!button) return;

        const labelElement = this.elements.btnTogglePauseLabel;
        const iconElement = this.elements.btnTogglePauseIcon;

        const setButtonContent = (labelText, iconName) => {
            if (labelElement) labelElement.textContent = labelText;
            button.setAttribute('aria-label', labelText);
            button.setAttribute('title', labelText);
            if (iconElement) iconElement.textContent = iconName;
        };

        const hasActiveSession = Boolean(quizState?.currentSessionId) && quizState?.quizEnded !== true;

        button.disabled = !hasActiveSession;

        if (!hasActiveSession) {
            button.setAttribute('aria-pressed', 'false');
            setButtonContent('Pausar', 'pause');
            return;
        }

        if (isRunning) {
            button.setAttribute('aria-pressed', 'false');
            setButtonContent('Pausar', 'pause');
        } else {
            button.setAttribute('aria-pressed', 'true');
            setButtonContent('Retomar', 'play_arrow');
        }
    }
}
