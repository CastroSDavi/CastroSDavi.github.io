// File: assets/js/ui/ScorePanel.js

const DEFAULT_SCORE_PANEL_SETTINGS = {
    show_points: true,
    show_correct: true,
    show_incorrect: true,
    show_streak: true,
    show_multiplier: true,
    show_timer: true,
    allow_pause: true,
    allow_manual_finish: true,
};

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

        this.currentSettings = { ...DEFAULT_SCORE_PANEL_SETTINGS };
        this.currentSettingsKey = JSON.stringify(this.currentSettings);
        this.latestRawSettings = null;

        this.scorePanelRoot = this.elements.scorePanel || null;
        this.timerContainer = this.scorePanelRoot?.querySelector('.score-panel__timer') || null;
        this.statsGroupElement = this.scorePanelRoot?.querySelector('.score-panel__stats-group') || null;
        this.contentContainer = this.scorePanelRoot?.querySelector('.score-panel__content') || null;
        this.statContainers = {
            points: this.scorePanelRoot?.querySelector('.score-panel__stat--points') || null,
            correct: this.scorePanelRoot?.querySelector('.score-panel__stat--correct') || null,
            incorrect: this.scorePanelRoot?.querySelector('.score-panel__stat--incorrect') || null,
            streak: this.scorePanelRoot?.querySelector('.score-panel__stat--streak') || null,
        };
        this.multiplierElement = this.elements.multiplicadorDisplay || null;

        this.pauseControlElement = this.elements.scorePanelControls || null;
        this.endSessionButton = this.elements.btnEncerrarSessao || null;
        this.toggleButton = this.elements.scorePanelToggle || null;
        this.toggleLabelElement = this.toggleButton?.querySelector('.score-panel__toggle-label') || null;
        this.toggleIconElement = this.toggleButton?.querySelector('.score-panel__toggle-icon') || null;
        this.lastShouldDisplayPanel = false;
        this.isCollapsed = false;

        this._setupEventListeners();
        this._updateCollapsedLayout(this.isCollapsed);
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

            this._applyScorePanelSettings(initialState.quiz?.scorePanelSettings, { force: true });

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

        this._applyScorePanelSettings(currentState.quiz?.scorePanelSettings);

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
        this.elements.btnEncerrarSessao?.addEventListener('click', (event) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (this.currentSettings?.allow_manual_finish === false) {
                return;
            }
            // Em vez de um callback, chama o orquestrador diretamente
            // para lidar com a lógica de abrir o modal.
            if (this.quizUI.modalManager) {
                this.quizUI.modalManager.toggleConfirmModal(true);
            }
        });

        this.elements.btnTogglePause?.addEventListener('click', () => {
            if (this.currentSettings?.allow_pause === false) {
                return;
            }
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

        this.toggleButton?.addEventListener('click', () => {
            this._setCollapsedState(!this.isCollapsed);
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
        this._applyScorePanelSettings(this.latestRawSettings, { force: true });
        this._updateCollapsedLayout(this.isCollapsed);
    }

    hide() {
        this.lastShouldDisplayPanel = false;
        if (this.elements.scorePanel) {
            this.quizUI.hideElement(this.elements.scorePanel);
        }
        if (this.pauseControlElement) {
            this.quizUI.hideElement(this.pauseControlElement);
        }
        if (this.endSessionButton) {
            this.quizUI.hideElement(this.endSessionButton);
        }
        this._updateCollapsedLayout(false);
    }

    _normalizeSettings(rawSettings = null) {
        const normalized = { ...DEFAULT_SCORE_PANEL_SETTINGS };
        if (!rawSettings || typeof rawSettings !== 'object') {
            return normalized;
        }

        Object.keys(normalized).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(rawSettings, key)) {
                const value = rawSettings[key];
                if (typeof value === 'string') {
                    const normalizedString = value.trim().toLowerCase();
                    if (['false', '0', 'no', 'off', 'nao', 'não'].includes(normalizedString)) {
                        normalized[key] = false;
                    } else if (['true', '1', 'yes', 'on', 'sim'].includes(normalizedString)) {
                        normalized[key] = true;
                    } else {
                        normalized[key] = Boolean(value);
                    }
                } else {
                    normalized[key] = Boolean(value);
                }
            }
        });

        return normalized;
    }

    _toggleElement(element, shouldShow) {
        if (!element) return;
        if (shouldShow) this.quizUI.showElement(element);
        else this.quizUI.hideElement(element);
    }

    _shouldDisplayPanel(settings) {
        if (!settings) return true;
        return Boolean(
            settings.show_timer ||
            settings.show_points ||
            settings.show_correct ||
            settings.show_incorrect ||
            settings.show_streak ||
            settings.allow_manual_finish
        );
    }

    _resolveQuizState() {
        if (!this.store || typeof this.store.getState !== 'function') {
            return null;
        }
        const state = this.store.getState();
        return state?.quiz || null;
    }

    _shouldDisplayForContext(quizState) {
        if (!quizState) return false;
        const hasSessionId = quizState.currentSessionId !== null && quizState.currentSessionId !== undefined;
        if (!hasSessionId) return false;
        if (quizState.quizEnded === true) return false;
        const displayMode = quizState.quizDisplayContext?.displayMode || 'challenge';
        return displayMode !== 'review';
    }

    _applyScorePanelSettings(rawSettings, { force = false } = {}) {
        this.latestRawSettings = rawSettings ?? null;
        const normalized = this._normalizeSettings(rawSettings);
        const serialized = JSON.stringify(normalized);

        const quizState = this._resolveQuizState();
        const allowByContext = this._shouldDisplayForContext(quizState);
        const shouldDisplayPanel = allowByContext && this._shouldDisplayPanel(normalized);
        const visibilityChanged = shouldDisplayPanel !== this.lastShouldDisplayPanel;

        if (!force && serialized === this.currentSettingsKey && !visibilityChanged) {
            return false;
        }

        this.currentSettings = normalized;
        this.currentSettingsKey = serialized;
        this.lastShouldDisplayPanel = shouldDisplayPanel;

        this._toggleElement(this.elements.scorePanel, shouldDisplayPanel);
        this._toggleElement(this.timerContainer, shouldDisplayPanel && normalized.show_timer);

        const showPoints = shouldDisplayPanel && normalized.show_points;
        const showCorrect = shouldDisplayPanel && normalized.show_correct;
        const showIncorrect = shouldDisplayPanel && normalized.show_incorrect;
        const showStreak = shouldDisplayPanel && normalized.show_streak;

        this._toggleElement(this.statContainers.points, showPoints);
        this._toggleElement(this.statContainers.correct, showCorrect);
        this._toggleElement(this.statContainers.incorrect, showIncorrect);
        this._toggleElement(this.statContainers.streak, showStreak);

        const hasAnyStat = showPoints || showCorrect || showIncorrect || showStreak;
        this._toggleElement(this.statsGroupElement, hasAnyStat);

        const shouldShowMultiplier = showStreak && normalized.show_multiplier;
        this._toggleElement(this.multiplierElement, shouldShowMultiplier);

        const shouldShowPause = shouldDisplayPanel && normalized.allow_pause && normalized.show_timer;
        this._toggleElement(this.pauseControlElement, shouldShowPause);

        const shouldShowFinish = shouldDisplayPanel && normalized.allow_manual_finish;
        this._toggleElement(this.endSessionButton, shouldShowFinish);
        if (this.endSessionButton) {
            this.endSessionButton.disabled = !shouldShowFinish;
        }

        if (!shouldDisplayPanel) {
            this._updateCollapsedLayout(false);
        } else {
            this._updateCollapsedLayout(this.isCollapsed);
        }

        return true;
    }

    _setCollapsedState(isCollapsed = false) {
        this.isCollapsed = Boolean(isCollapsed);
        this._updateCollapsedLayout(this.isCollapsed);
    }

    _updateCollapsedLayout(isCollapsed) {
        const questionSection = this.quizUI?.elements?.questionSection;
        if (this.scorePanelRoot) {
            this.scorePanelRoot.classList.toggle('is-collapsed', Boolean(isCollapsed));
        }
        if (questionSection) {
            questionSection.classList.toggle('is-score-panel-collapsed', Boolean(isCollapsed));
        }

        const expanded = !isCollapsed;
        if (this.toggleButton) {
            const labelText = expanded ? 'Recolher painel' : 'Expandir painel';
            this.toggleButton.setAttribute('aria-expanded', String(expanded));
            this.toggleButton.setAttribute('aria-label', labelText);
            this.toggleButton.setAttribute('title', labelText);
            if (this.toggleLabelElement) {
                this.toggleLabelElement.textContent = labelText;
            }
            if (this.toggleIconElement) {
                this.toggleIconElement.textContent = expanded ? 'chevron_left' : 'chevron_right';
            }
        }

        if (this.contentContainer) {
            this.contentContainer.setAttribute('aria-hidden', isCollapsed ? 'true' : 'false');
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
        const allowPause = this.currentSettings?.allow_pause !== false;
        const shouldEnable = hasActiveSession && allowPause;

        button.disabled = !shouldEnable;

        if (!allowPause) {
            button.setAttribute('aria-pressed', 'false');
            setButtonContent('Pausar', 'pause');
            return;
        }

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
