// File: assets/js/ui/ResultDisplay.js

export default class ResultDisplay {
    constructor(quizUIInstance, timerInstance, callbacks = {}) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements; 
        this.timer = timerInstance; 
        this.restartCallback = callbacks.restartCallback; 
        this.goHomeCallback = callbacks.goHomeCallback;   
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.elements.btnRecomecar?.addEventListener('click', () => {
            if (this.restartCallback) this.restartCallback();
        });

        this.elements.btnExplorarMais?.addEventListener('click', () => {
            if (this.goHomeCallback) {
                this.goHomeCallback();
            } else {
                const homeLink = document.querySelector('a[href="/"], a[href*="quiz:home"], .site-header__logo a, .main-nav__link[data-section-target-django="home"], .bottom-nav__link[data-section-target-django="home"]');
                window.location.href = homeLink?.href || '/';
            }
        });
    }

    show(userData, totalQuestionsInSession) {
        // console.log("RESULTDISPLAY.JS: show - Exibindo resultados. UserData:", userData, "TotalQ:", totalQuestionsInSession);
        const { 
            resultadoCard, resultadoTitulo, resultadoPontos, resultadoAcertos, resultadoErros, 
            resultadoTempo, resultadoMensagemMotivacional, 
            placeholderFiltrosContainer, 
            challengeHubContainer 
        } = this.elements; 

        if (!resultadoCard || !userData) {
            console.error("ResultDisplay: Elemento do card de resultado ou dados do usuário ausentes.");
            return;
        }

        // ===== INÍCIO DA ALTERAÇÃO (Passo 2) =====
        // Garante que a nav inferior seja escondida na tela de resultado
        if (this.elements.bottomNavElement) {
            this.quizUI.hideElement(this.elements.bottomNavElement);
        }
        // ===== FIM DA ALTERAÇÃO =====

        // 1. Limpar a UI do quiz ativo e outros painéis
        if (this.quizUI && typeof this.quizUI.hideActiveQuizElements === 'function') {
            this.quizUI.hideActiveQuizElements(); 
        } else {
            console.error("ResultDisplay.show: quizUI.hideActiveQuizElements não é uma função ou quizUI não está definido.");
            this.quizUI.hideElement(this.quizUI.elements.quizSectionContent); 
            this.quizUI.hideElement(this.elements.questionGridContainer); 
            if (this.quizUI.questionDisplay && typeof this.quizUI.questionDisplay.hideProgressBar === 'function') {
                this.quizUI.questionDisplay.hideProgressBar();
            }
        }
        
        // 2. Esconder o painel de pontuação
        if (this.quizUI.scorePanel && typeof this.quizUI.scorePanel.hide === 'function') {
            this.quizUI.scorePanel.hide();
        } else {
            this.quizUI.hideElement(this.elements.scorePanel); 
        }
        
        // 3. Esconder o placeholder de filtros
        this.quizUI.hideElement(placeholderFiltrosContainer);
    
        // 4. Limpar quaisquer mensagens de aviso (Esta chamada pode reexibir o hub)
        if (this.quizUI.warningDisplay && typeof this.quizUI.warningDisplay.clear === 'function') {
            this.quizUI.warningDisplay.clear();
        }

        // 5. Garantir que o Challenge Hub esteja escondido APÓS limpar avisos e ANTES de mostrar resultados
        // Esta é a correção chave: re-esconder o hub aqui.
        if (challengeHubContainer) {
            this.quizUI.hideElement(challengeHubContainer); 
        } 
        if (this.quizUI.challengeHubInstance && typeof this.quizUI.challengeHubInstance.hideHub === 'function') {
            this.quizUI.challengeHubInstance.hideHub();
        }
    
        // Preencher os dados do resultado
        if (resultadoTitulo) resultadoTitulo.textContent = "O seu Desempenho Final";
        if (resultadoPontos) resultadoPontos.textContent = userData.pontos !== undefined ? userData.pontos.toString() : '0';
        if (resultadoAcertos) resultadoAcertos.textContent = userData.acertos !== undefined ? userData.acertos.toString() : '0';
        if (resultadoErros) resultadoErros.textContent = userData.erros !== undefined ? userData.erros.toString() : '0';
        
        if (this.timer && resultadoTempo && typeof this.timer._formatTime === 'function' && typeof this.timer.getCurrentSeconds === 'function') {
            resultadoTempo.textContent = this.timer._formatTime(this.timer.getCurrentSeconds());
        } else if (resultadoTempo) {
            resultadoTempo.textContent = "00:00"; 
        }

        if (resultadoMensagemMotivacional) {
            const pontos = userData.pontos || 0;
            const acertos = userData.acertos || 0;
            let mensagem = "Continue a praticar para melhorar!"; 
            if (totalQuestionsInSession > 0) {
                const maxPontosPossiveis = totalQuestionsInSession * 15; 
                if (pontos >= maxPontosPossiveis * 0.9) mensagem = "Resultado Incrível! Parabéns!"; 
                else if (pontos >= maxPontosPossiveis * 0.7) mensagem = "Excelente desempenho! Continue assim!"; 
                else if (pontos >= maxPontosPossiveis * 0.5) mensagem = "Muito bom! Está no caminho certo."; 
                else if (pontos <= 0 && acertos === 0 && (userData.erros || 0) > 0 && totalQuestionsInSession > 0) mensagem = "Ops! Nenhuma questão correta. Reveja o conteúdo e tente novamente!"; 
            } else if (pontos === 0 && acertos === 0 && (userData.erros || 0) === 0 && totalQuestionsInSession === 0) {
                mensagem = "Nenhuma questão foi jogada nesta sessão. Que tal tentar um novo desafio?"; 
            }
            resultadoMensagemMotivacional.textContent = mensagem;
        }
    
        // Mostrar o card de resultado
        this.quizUI.showElement(resultadoCard);
        if (resultadoTitulo) resultadoTitulo.focus({ preventScroll: true }); 
    }
    
    hide() {
        // console.log("RESULTDISPLAY.JS: hide - Escondendo card de resultados.");
        this.quizUI.hideElement(this.elements.resultadoCard);
    }
}