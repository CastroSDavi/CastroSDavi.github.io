// File: assets/js/ui/ResultDisplay.js

export default class ResultDisplay {
    constructor(quizUIInstance, timerInstance) {
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements;
        this.timer = timerInstance;
        this.actionOrchestrator = null;
        this.latestShareMessage = '';
        this.shareFeedbackTimeoutId = null;
        this.lastRenderedSnapshot = null;
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

        const { btnCompartilharResultado } = this.elements;
        if (btnCompartilharResultado) {
            const labelElement = btnCompartilharResultado.querySelector('.button__label');
            if (labelElement && !btnCompartilharResultado.dataset.originalLabel) {
                btnCompartilharResultado.dataset.originalLabel = labelElement.textContent.trim();
            }

            btnCompartilharResultado.addEventListener('click', () => {
                this._shareResults();
            });
        }
    }

    render(user, state) {
        const {
            resultadoCard,
            resultadoTitulo,
            resultadoSubtitle,
            resultadoPontos,
            resultadoAcertos,
            resultadoErros,
            resultadoTempo,
            resultadoMensagemMotivacional,
            resultadoScoreMeter,
            resultadoPrecisao,
            resultadoQuestoes,
            resultadoPontosPorQuestao,
            resultadoTempoMedio,
            resultadoInsightDestaqueText,
            resultadoInsightMetaText
        } = this.elements;

        if (!resultadoCard || !user || !state) {
            console.error("ResultDisplay: Faltam dados essenciais para renderizar os resultados.");
            return;
        }

        this._clearShareFeedback();

        const pontos = Number(user.pontos) || 0;
        const acertos = Number(user.acertos) || 0;
        const erros = Number(user.erros) || 0;
        const totalRespondidas = Math.max(0, acertos + erros);
        const totalQuestionsInSession = state.quiz.currentQuestionsSet.length;
        const finalSeconds = Number(state?.timer?.seconds) || 0;
        const tempoFormatado = this.timer ? this.timer._formatTime(Math.max(0, finalSeconds)) : '00:00';
        const accuracyPercent = totalRespondidas > 0
            ? Math.round((acertos / totalRespondidas) * 100)
            : 0;
        const averageSeconds = totalRespondidas > 0
            ? Math.max(0, Math.round(finalSeconds / totalRespondidas))
            : 0;
        const tempoMedioFormatado = totalRespondidas > 0 && this.timer
            ? this.timer._formatTime(averageSeconds)
            : '--:--';
        const pontosPorQuestao = totalRespondidas > 0 ? pontos / totalRespondidas : 0;
        const pontosPorQuestaoFormatado = totalRespondidas > 0
            ? pontosPorQuestao.toLocaleString('pt-BR', {
                minimumFractionDigits: pontosPorQuestao % 1 === 0 ? 0 : 1,
                maximumFractionDigits: 1
            })
            : '0';

        const subtitleText = totalRespondidas > 0
            ? `Você respondeu ${totalRespondidas} questão${totalRespondidas === 1 ? '' : 'es'} em ${tempoFormatado}.`
            : 'Nenhuma questão foi respondida nesta sessão.';

        const motivationalMessage = this._getMotivationalMessage(user, totalQuestionsInSession);
        const { destaque: insightDestaque, meta: insightMeta } = this._getInsightMessages({
            accuracyPercent,
            totalRespondidas,
            averageSeconds,
            erros
        });

        this.quizUI.hideActiveQuizElements();
        if (this.quizUI.scorePanel) this.quizUI.scorePanel.hide();
        if (this.quizUI.challengeHubInstance) this.quizUI.challengeHubInstance.hideHub();

        if (resultadoTitulo) resultadoTitulo.textContent = 'Seu Desempenho Final';
        if (resultadoSubtitle) resultadoSubtitle.textContent = subtitleText;
        if (resultadoPontos) resultadoPontos.textContent = pontos.toLocaleString('pt-BR');
        if (resultadoAcertos) resultadoAcertos.textContent = acertos.toString();
        if (resultadoErros) resultadoErros.textContent = erros.toString();
        if (resultadoTempo) resultadoTempo.textContent = tempoFormatado;
        if (resultadoMensagemMotivacional) resultadoMensagemMotivacional.textContent = motivationalMessage;
        if (resultadoQuestoes) resultadoQuestoes.textContent = totalRespondidas.toString();
        if (resultadoPontosPorQuestao) resultadoPontosPorQuestao.textContent = pontosPorQuestaoFormatado;
        if (resultadoTempoMedio) resultadoTempoMedio.textContent = totalRespondidas > 0 ? tempoMedioFormatado : '--:--';

        if (resultadoPrecisao) resultadoPrecisao.textContent = `${accuracyPercent}%`;
        if (resultadoScoreMeter) {
            const progressDegrees = Math.min(359, Math.max(0, (accuracyPercent / 100) * 360));
            resultadoScoreMeter.style.setProperty('--progress-deg', `${progressDegrees}deg`);
            resultadoScoreMeter.setAttribute('aria-label', `Precisão de ${accuracyPercent}%`);
        }

        if (resultadoInsightDestaqueText) resultadoInsightDestaqueText.textContent = insightDestaque;
        if (resultadoInsightMetaText) resultadoInsightMetaText.textContent = insightMeta;

        this.lastRenderedSnapshot = {
            pontos,
            acertos,
            erros,
            totalRespondidas,
            tempoFormatado,
            tempoMedioFormatado,
            accuracyPercent
        };
        this.latestShareMessage = this._buildShareMessage(this.lastRenderedSnapshot);

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

    _getInsightMessages({ accuracyPercent, totalRespondidas, averageSeconds, erros }) {
        let destaque;
        let meta;

        if (totalRespondidas === 0) {
            destaque = 'Sessão ainda sem respostas registradas.';
            meta = 'Inicie um novo desafio para gerar insights personalizados.';
            return { destaque, meta };
        }

        if (accuracyPercent >= 85) {
            destaque = 'Precisão excelente! Você está dominando este conteúdo.';
        } else if (accuracyPercent >= 60) {
            destaque = 'Bom aproveitamento — ajuste detalhes para chegar ao topo.';
        } else {
            destaque = 'Aproveitamento em evolução: identifique os temas que merecem reforço.';
        }

        if (erros === 0) {
            meta = 'Sem erros nesta rodada! Explore categorias mais avançadas no painel de desempenho.';
        } else if (averageSeconds <= 30) {
            meta = 'Tempo médio ágil. Experimente quizzes maiores ou com dificuldade elevada.';
        } else {
            meta = 'Acesse o painel de desempenho para revisar rapidamente as questões com erro.';
        }

        return { destaque, meta };
    }

    _buildShareMessage(snapshot) {
        if (!snapshot || snapshot.totalRespondidas === undefined) {
            return '';
        }

        const {
            pontos,
            accuracyPercent,
            totalRespondidas,
            tempoFormatado,
            tempoMedioFormatado
        } = snapshot;

        if (totalRespondidas === 0) {
            return 'Acabei de encerrar uma sessão no MedQuiz. Experimente você também!';
        }

        const pontosTexto = `${pontos} ponto${Math.abs(pontos) === 1 ? '' : 's'}`;
        const questoesTexto = totalRespondidas === 1
            ? '1 questão respondida'
            : `${totalRespondidas} questões respondidas`;
        const tempoTotalTexto = tempoFormatado ? ` em ${tempoFormatado}` : '';
        const tempoMedioTexto = tempoMedioFormatado && tempoMedioFormatado !== '--:--'
            ? ` (média de ${tempoMedioFormatado} por questão)`
            : '';

        return `Acabei de concluir um desafio no MedQuiz com ${pontosTexto}, ${accuracyPercent}% de acerto e ${questoesTexto}${tempoTotalTexto}${tempoMedioTexto}. Vamos estudar juntos?`;
    }

    _clearShareFeedback() {
        if (this.shareFeedbackTimeoutId) {
            window.clearTimeout(this.shareFeedbackTimeoutId);
            this.shareFeedbackTimeoutId = null;
        }

        const { btnCompartilharResultado } = this.elements;
        if (!btnCompartilharResultado) return;

        btnCompartilharResultado.classList.remove('is-feedback-error');
        const labelElement = btnCompartilharResultado.querySelector('.button__label');
        if (labelElement && btnCompartilharResultado.dataset.originalLabel) {
            labelElement.textContent = btnCompartilharResultado.dataset.originalLabel;
        }
    }

    _setShareFeedback(buttonElement, feedbackText, isError = false) {
        if (!buttonElement) return;

        const labelElement = buttonElement.querySelector('.button__label') || buttonElement;
        if (labelElement && !buttonElement.dataset.originalLabel) {
            buttonElement.dataset.originalLabel = labelElement.textContent.trim();
        }

        if (labelElement) {
            labelElement.textContent = feedbackText;
        }

        buttonElement.classList.toggle('is-feedback-error', Boolean(isError));

        if (this.shareFeedbackTimeoutId) {
            window.clearTimeout(this.shareFeedbackTimeoutId);
        }

        this.shareFeedbackTimeoutId = window.setTimeout(() => {
            if (labelElement && buttonElement.dataset.originalLabel) {
                labelElement.textContent = buttonElement.dataset.originalLabel;
            }
            buttonElement.classList.remove('is-feedback-error');
            this.shareFeedbackTimeoutId = null;
        }, 2800);
    }

    async _shareResults() {
        const { btnCompartilharResultado } = this.elements;
        if (!btnCompartilharResultado || !this.latestShareMessage) {
            return;
        }

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(this.latestShareMessage);
                this._setShareFeedback(btnCompartilharResultado, 'Resultado copiado!');
            } else {
                this._fallbackSharePrompt(this.latestShareMessage);
                this._setShareFeedback(btnCompartilharResultado, 'Copie e compartilhe!');
            }
        } catch (error) {
            console.warn('ResultDisplay: Falha ao copiar resultado.', error);
            this._setShareFeedback(btnCompartilharResultado, 'Não foi possível copiar', true);
        }
    }

    _fallbackSharePrompt(message) {
        const promptMessage = 'Copie o resumo abaixo para compartilhar o seu resultado:';
        window.prompt(promptMessage, message);
    }

    hide() {
        this.quizUI.hideElement(this.elements.resultadoCard);
    }
}