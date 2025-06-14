// File: assets/js/ui/Timer.js

export default class Timer {
    constructor(timerDisplayElement, resultadoTempoElement = null) {
        this.timerDisplayElement = timerDisplayElement;
        this.resultadoTempoElement = resultadoTempoElement;

        // A classe não gerencia mais seu próprio estado de tempo
        this.store = null;
        this.previousSeconds = -1; // Usado para evitar atualizações desnecessárias do DOM
    }

    /**
     * Define a instância do store e se inscreve para atualizações.
     * Este método será chamado pelo QuizUI.
     * @param {object} storeInstance - A instância do store.
     */
    setStore(storeInstance) {
        this.store = storeInstance;
        if (this.store) {
            // Renderiza o estado inicial do timer assim que se conecta ao store
            this.handleStateUpdate(); 
            // Inscreve-se para reagir a futuras atualizações
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }

    /**
     * Lida com as atualizações de estado do store.
     * Este método é o coração reativo do componente.
     */
    handleStateUpdate() {
        if (!this.store) return;
        
        const state = this.store.getState();
        const currentSeconds = state.timer.seconds;

        // Apenas atualiza o DOM se os segundos realmente mudaram
        if (currentSeconds !== this.previousSeconds) {
            this._updateDisplay(currentSeconds, state.quiz.quizEnded);
            this.previousSeconds = currentSeconds;
        }
    }

    /**
     * Formata o tempo de segundos para o formato MM:SS.
     * @param {number} totalSeconds - O total de segundos a ser formatado.
     * @returns {string} O tempo formatado.
     */
    _formatTime(totalSeconds) {
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${secs}`;
    }

    /**
     * Método privado que realmente atualiza o DOM com base nos dados recebidos.
     * @param {number} seconds - Os segundos atuais a serem exibidos.
     * @param {boolean} isQuizEnded - Flag que indica se o quiz terminou.
     */
    _updateDisplay(seconds, isQuizEnded) {
        const formattedTime = this._formatTime(seconds);
        if (this.timerDisplayElement) {
            this.timerDisplayElement.textContent = formattedTime;
        }
        
        // Atualiza o display de tempo na tela de resultado apenas se o quiz terminou
        if (this.resultadoTempoElement && isQuizEnded) {
            this.resultadoTempoElement.textContent = formattedTime;
        }
    }
    
    // Os métodos start(), stop(), reset() e getCurrentSeconds() foram removidos.
    // Essa lógica agora é gerenciada pelo ActionOrchestrator e pelo estado central no store.
}