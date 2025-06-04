export default class Timer {
    constructor(timerDisplayElement, resultadoTempoElement = null) {
        this.timerDisplayElement = timerDisplayElement;
        this.resultadoTempoElement = resultadoTempoElement;

        this.intervalId = null;
        this.seconds = 0;
        this.isRunning = false;

        this._updateDisplay();
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

    // MÉTODO MODIFICADO para aceitar tempo inicial
    start(initialSeconds = 0) { // Default para 0 se nenhum tempo inicial for passado
        if (this.isRunning) {
            // console.log("TIMER.JS: start - Timer já está rodando.");
            return;
        }
        // Define os segundos iniciais. Garante que seja um número.
        this.seconds = parseInt(initialSeconds, 10) || 0;
        this.isRunning = true;
        this._updateDisplay(); // Atualiza o display imediatamente com o tempo inicial

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

    // MÉTODO MODIFICADO para permitir resetar para um valor específico ou 0
    reset(resetToSeconds = 0) {
        // console.log("TIMER.JS: reset - Resetando timer para", resetToSeconds, "segundos.");
        this.stop();
        this.seconds = parseInt(resetToSeconds, 10) || 0;
        this._updateDisplay();
        // Se o elemento de resultado estiver visível, também o atualiza
        if (this.resultadoTempoElement &&
            this.resultadoTempoElement.closest('.card--quiz-result') &&
            !this.resultadoTempoElement.closest('.card--quiz-result').classList.contains('u-is-hidden')) {
            // this.updateResultDisplay(this.seconds); // Passa os segundos atuais para o display de resultado
            // Correção: updateResultDisplay usa this.seconds, não precisa passar como argumento.
            this.updateResultDisplay();
        }
    }

    getCurrentSeconds() {
        return this.seconds;
    }

    updateResultDisplay() { // Não precisa de argumento, usa this.seconds
        if (this.resultadoTempoElement) {
            // console.log("TIMER.JS: updateResultDisplay - Atualizando display de resultado com", this.seconds, "segundos.");
            this.resultadoTempoElement.textContent = this._formatTime(this.seconds);
        }
    }
}