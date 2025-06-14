// File: assets/js/ui/ResultDisplay.js

export default class ResultDisplay {
    constructor(quizUIInstance, timerInstance) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements; 
        this.timer = timerInstance; 
        this.actionOrchestrator = null; 
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }

    // NOVO MÉTODO DE INICIALIZAÇÃO
    init() {
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.elements.btnRecomecar?.addEventListener('click', () => {
            this.actionOrchestrator?.restartQuiz();
        });

        this.elements.btnExplorarMais?.addEventListener('click', () => {
            const homeLink = document.querySelector('a[href="/"], a[href*="quiz:home"], .site-header__logo a');
            window.location.href = homeLink?.href || '/';
        });
    }

    render(user, state) {
        const { 
            resultadoCard, resultadoTitulo, resultadoPontos, resultadoAcertos, resultadoErros, 
            resultadoTempo, resultadoMensagemMotivacional
        } = this.elements; 

        if (!resultadoCard || !user || !state) {
            console.error("ResultDisplay: Faltam dados essenciais para renderizar os resultados.");
            return;
        }

        const totalQuestionsInSession = state.quiz.currentQuestionsSet.length;

        this.quizUI.hideActiveQuizElements(); 
        if (this.quizUI.scorePanel) this.quizUI.scorePanel.hide();
        if (this.quizUI.challengeHubInstance) this.quizUI.challengeHubInstance.hideHub();
        
        if (resultadoTitulo) resultadoTitulo.textContent = "Seu Desempenho Final";
        if (resultadoPontos) resultadoPontos.textContent = user.pontos.toString();
        if (resultadoAcertos) resultadoAcertos.textContent = user.acertos.toString();
        if (resultadoErros) resultadoErros.textContent = user.erros.toString();
        
        if (this.timer && resultadoTempo) {
            const finalSeconds = state.timer.seconds;
            resultadoTempo.textContent = this.timer._formatTime(finalSeconds);
        }

        if (resultadoMensagemMotivacional) {
            resultadoMensagemMotivacional.textContent = this._getMotivationalMessage(user, totalQuestionsInSession);
        }
    
        this.quizUI.showElement(resultadoCard);
        if (resultadoTitulo) resultadoTitulo.focus({ preventScroll: true });
    }
    
    _getMotivationalMessage(userData, totalQuestionsInSession) {
        const pontos = userData.pontos || 0;
        const acertos = userData.acertos || 0;
        let mensagem = "Continue a praticar para melhorar!"; 
        
        if (totalQuestionsInSession > 0) {
            const maxPontosPossiveis = totalQuestionsInSession * 15;
            if (pontos >= maxPontosPossiveis * 0.9) mensagem = "Resultado Incrível! Parabéns!"; 
            else if (pontos >= maxPontosPossiveis * 0.7) mensagem = "Excelente desempenho! Continue assim!"; 
            else if (pontos >= maxPontosPossiveis * 0.5) mensagem = "Muito bom! Está no caminho certo."; 
            else if (pontos <= 0 && acertos === 0 && (userData.erros || 0) > 0) {
                mensagem = "Ops! Nenhuma questão correta. Reveja o conteúdo e tente novamente!";
            }
        } else if (pontos === 0 && acertos === 0 && (userData.erros || 0) === 0) {
            mensagem = "Nenhuma questão foi jogada nesta sessão. Que tal tentar um novo desafio?"; 
        }
        return mensagem;
    }

    hide() {
        this.quizUI.hideElement(this.elements.resultadoCard);
    }
}