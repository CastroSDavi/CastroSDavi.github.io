// File: assets/js/ui/ScorePanel.js

export default class ScorePanel {
    constructor(quizUIInstance, endSessionCallback = null) {
        // console.log("SCOREPANEL.JS: Constructor - Instanciando ScorePanel.");
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements; // Atalho para os elementos DOM
        this.endSessionCallback = endSessionCallback;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.elements.btnEncerrarSessao?.addEventListener('click', () => {
            // console.log("SCOREPANEL.JS: Botão Encerrar Sessão clicado.");
            if (this.endSessionCallback && typeof this.endSessionCallback === 'function') {
                this.endSessionCallback(); // Chama o callback para que QuizLogic/QuizUI trate o modal de confirmação
            }
        });
    }

    updateDisplay(pontos, acertos, erros) {
        // console.log(`SCOREPANEL.JS: updateDisplay - Pontos: ${pontos}, Acertos: ${acertos}, Erros: ${erros}`);
        if (this.elements.pontuacaoDisplay) {
            this.elements.pontuacaoDisplay.textContent = pontos;
        }
        if (this.elements.acertosNumDisplay) {
            this.elements.acertosNumDisplay.textContent = acertos;
        }
        if (this.elements.errosNumDisplay) {
            this.elements.errosNumDisplay.textContent = erros;
        }
    }

    show() {
        // console.log("SCOREPANEL.JS: show - Mostrando painel de pontuação.");
        if (this.elements.scorePanel) {
            this.quizUI.showElement(this.elements.scorePanel);
        }
        if (this.elements.btnEncerrarSessao) {
             // O botão de encerrar só deve ser mostrado se houver uma sessão em andamento.
             // QuizLogic ou QuizState precisariam informar isso.
             // Por enquanto, vamos assumir que se o ScorePanel é mostrado, o botão também é.
            this.quizUI.showElement(this.elements.btnEncerrarSessao);
        }
    }

    hide() {
        // console.log("SCOREPANEL.JS: hide - Escondendo painel de pontuação.");
        if (this.elements.scorePanel) {
            this.quizUI.hideElement(this.elements.scorePanel);
        }
        if (this.elements.btnEncerrarSessao) {
            this.quizUI.hideElement(this.elements.btnEncerrarSessao);
        }
    }

    // Opcional: um método para resetar os displays para 0, caso necessário
    resetDisplay() {
        // console.log("SCOREPANEL.JS: resetDisplay - Resetando display para 0.");
        this.updateDisplay(0, 0, 0);
    }
}