// File: assets/js/ui/Timer.js

export default class Timer {
    constructor(timerDisplayElement, resultadoTempoElement = null) {
        // console.log("TIMER.JS: Constructor - Instanciando Timer.");
        this.timerDisplayElement = timerDisplayElement;
        this.resultadoTempoElement = resultadoTempoElement; // Opcional, para a tela de resultados

        this.intervalId = null;
        this.seconds = 0;
        this.isRunning = false;

        this._updateDisplay(); // Garante que o display inicial seja "00:00"
    }

    _formatTime(totalSeconds) {
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${secs}`;
    }

    _updateDisplay() {
        if (this.timerDisplayElement) {
            this.timerDisplayElement.textContent = this._formatTime(this.seconds);
        }
    }

    start() {
        if (this.isRunning) {
            // console.log("TIMER.JS: start - Timer já está rodando.");
            return;
        }
        this.isRunning = true;
        // console.log("TIMER.JS: start - Iniciando timer.");
        this.intervalId = setInterval(() => {
            this.seconds++;
            this._updateDisplay();
        }, 1000);
    }

    stop() {
        if (!this.isRunning) {
            // console.log("TIMER.JS: stop - Timer já está parado.");
            return;
        }
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        // console.log("TIMER.JS: stop - Timer parado em", this.seconds, "segundos.");
    }

    reset() {
        // console.log("TIMER.JS: reset - Resetando timer.");
        this.stop();
        this.seconds = 0;
        this._updateDisplay();
        // Se o elemento de resultado estiver visível, também o reseta
        if (this.resultadoTempoElement && 
            this.resultadoTempoElement.closest('.card--quiz-result') &&
            !this.resultadoTempoElement.closest('.card--quiz-result').classList.contains('u-is-hidden')) {
            this.updateResultDisplay(0);
        }
    }

    getCurrentSeconds() {
        return this.seconds;
    }

    updateResultDisplay() {
        if (this.resultadoTempoElement) {
            // console.log("TIMER.JS: updateResultDisplay - Atualizando display de resultado com", this.seconds, "segundos.");
            this.resultadoTempoElement.textContent = this._formatTime(this.seconds);
        }
    }
}