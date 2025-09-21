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
            resultadoInsightMetaText,
            resultadoGamificacao,
            resultadoXpGanho,
            resultadoXpTotal,
            resultadoNivelAtual,
            resultadoNivelProgress,
            resultadoNivelProgressFill,
            resultadoProgressoLabel,
            resultadoXpProximo,
            resultadoNivelAlert,
            resultadoNivelAlertText,
            resultadoConquistasWrapper,
            resultadoConquistasCount,
            resultadoConquistasList,
            resultadoConquistasEmpty,
            resultadoDailyWrapper,
            resultadoDailyStreak,
            resultadoDailyQuestions,
            resultadoDailyXp,
            resultadoDailyStatus,
            resultadoUpcomingWrapper,
            resultadoUpcomingList,
            resultadoUpcomingEmpty,
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

        const gamificationData = state.user?.gamification || null;
        const xpTotalValue = Number.isFinite(state.user?.xp) ? Number(state.user.xp) : 0;
        const xpGanhoValue = Number.isFinite(gamificationData?.xp_ganho) ? Number(gamificationData.xp_ganho) : 0;
        const levelNameValue = gamificationData?.level?.nome || null;
        const achievementsUnlockedValue = Number(
            state.user?.achievementsUnlocked ??
            (gamificationData?.achievements?.newly_unlocked?.length ?? 0)
        );

        if (resultadoGamificacao) {
            if (gamificationData) {
                this.quizUI.showElement(resultadoGamificacao);

                if (resultadoXpGanho) {
                    const formattedXpGanho = `${xpGanhoValue >= 0 ? '+' : ''}${Math.round(xpGanhoValue).toLocaleString('pt-BR')} XP`;
                    resultadoXpGanho.textContent = formattedXpGanho;
                }
                if (resultadoXpTotal) {
                    resultadoXpTotal.textContent = `${Math.round(xpTotalValue).toLocaleString('pt-BR')} XP total`;
                }
                if (resultadoNivelAtual) {
                    resultadoNivelAtual.textContent = levelNameValue || '—';
                }

                const progressPercent = Math.max(0, Math.min(Number(gamificationData?.progress?.percent ?? 0), 100));
                if (resultadoNivelProgress) {
                    resultadoNivelProgress.setAttribute('aria-valuenow', progressPercent.toFixed(0));
                }
                if (resultadoNivelProgressFill) {
                    resultadoNivelProgressFill.style.width = `${progressPercent}%`;
                }

                const xpRangeStart = Number(gamificationData?.progress?.xp_range_start ?? 0);
                const xpRangeEnd = gamificationData?.progress?.xp_range_end;
                const xpIntoLevel = Number(gamificationData?.progress?.xp_into_level ?? 0);
                if (resultadoProgressoLabel) {
                    if (typeof xpRangeEnd === 'number') {
                        const totalForLevel = Math.max(xpRangeEnd - xpRangeStart, 0);
                        resultadoProgressoLabel.textContent = `${xpIntoLevel.toLocaleString('pt-BR')} / ${totalForLevel.toLocaleString('pt-BR')} XP no nível`;
                    } else {
                        resultadoProgressoLabel.textContent = `${xpIntoLevel.toLocaleString('pt-BR')} XP neste nível`;
                    }
                }

                if (resultadoXpProximo) {
                    const xpToNext = gamificationData?.progress?.xp_to_next_level;
                    if (typeof xpToNext === 'number' && xpToNext > 0) {
                        const nextLevelName = gamificationData?.next_level?.nome || 'o próximo nível';
                        resultadoXpProximo.textContent = `${xpToNext.toLocaleString('pt-BR')} XP para ${nextLevelName}`;
                    } else if (typeof xpToNext === 'number' && xpToNext <= 0 && gamificationData?.next_level) {
                        resultadoXpProximo.textContent = `Pronto para ${gamificationData.next_level.nome}!`;
                    } else {
                        resultadoXpProximo.textContent = 'Nível máximo alcançado';
                    }
                }

                if (resultadoNivelAlert) {
                    if (gamificationData.level_up && levelNameValue) {
                        if (resultadoNivelAlertText) {
                            resultadoNivelAlertText.textContent = `Você alcançou o nível ${levelNameValue}!`;
                        }
                        this.quizUI.showElement(resultadoNivelAlert);
                    } else {
                        this.quizUI.hideElement(resultadoNivelAlert);
                    }
                }

                if (resultadoConquistasCount) {
                    resultadoConquistasCount.textContent = achievementsUnlockedValue.toString();
                }

                const recentAchievements = Array.isArray(state.user?.recentAchievements) && state.user.recentAchievements.length > 0
                    ? state.user.recentAchievements
                    : (gamificationData?.achievements?.newly_unlocked && gamificationData.achievements.newly_unlocked.length > 0
                        ? gamificationData.achievements.newly_unlocked
                        : gamificationData?.achievements?.recent || []);

                if (resultadoConquistasList) {
                    resultadoConquistasList.innerHTML = '';
                    recentAchievements.slice(0, 4).forEach((achievement) => {
                        if (!achievement) return;
                        const item = document.createElement('li');
                        item.className = 'gamification-achievements__item';

                        const icon = document.createElement('span');
                        icon.className = 'material-symbols-outlined';
                        icon.textContent = 'emoji_events';
                        icon.setAttribute('aria-hidden', 'true');
                        item.appendChild(icon);

                        const content = document.createElement('div');
                        content.className = 'gamification-achievements__item-content';

                        const title = document.createElement('strong');
                        title.textContent = achievement.nome || 'Conquista desbloqueada';
                        content.appendChild(title);

                        if (achievement.descricao) {
                            const description = document.createElement('p');
                            description.textContent = achievement.descricao;
                            content.appendChild(description);
                        }

                        if (achievement.data_conquista) {
                            const meta = document.createElement('span');
                            meta.className = 'gamification-achievements__item-meta';
                            try {
                                const data = new Date(achievement.data_conquista);
                                meta.textContent = `Desbloqueada em ${data.toLocaleDateString('pt-BR')}`;
                            } catch (err) {
                                meta.textContent = 'Conquista recente';
                            }
                            content.appendChild(meta);
                        }

                        item.appendChild(content);
                        resultadoConquistasList.appendChild(item);
                    });
                }

                if (resultadoConquistasEmpty) {
                    if (resultadoConquistasList && resultadoConquistasList.childElementCount > 0) {
                        resultadoConquistasEmpty.classList.add('u-is-hidden');
                    } else {
                        resultadoConquistasEmpty.classList.remove('u-is-hidden');
                    }
                }

                if (resultadoConquistasWrapper) {
                    if (resultadoConquistasList && resultadoConquistasList.childElementCount === 0 && !achievementsUnlockedValue) {
                        resultadoConquistasWrapper.classList.add('is-empty');
                    } else {
                        resultadoConquistasWrapper.classList.remove('is-empty');
                    }
                }

                const dailyEngagement = gamificationData?.daily_engagement || null;
                if (resultadoDailyWrapper) {
                    if (dailyEngagement) {
                        this.quizUI.showElement(resultadoDailyWrapper);
                        const streakDays = Number(dailyEngagement.streak_days) || 0;
                        if (resultadoDailyStreak) {
                            resultadoDailyStreak.textContent = `${streakDays.toLocaleString('pt-BR')} dia${streakDays === 1 ? '' : 's'}`;
                        }
                        if (resultadoDailyQuestions) {
                            const questionsToday = Number(dailyEngagement.questions_today) || 0;
                            resultadoDailyQuestions.textContent = questionsToday.toLocaleString('pt-BR');
                        }
                        if (resultadoDailyXp) {
                            const xpToday = Number(dailyEngagement.xp_today) || 0;
                            resultadoDailyXp.textContent = `${xpToday.toLocaleString('pt-BR')} XP`;
                        }
                        if (resultadoDailyStatus) {
                            const hasActivityToday = Boolean(dailyEngagement.has_activity_today);
                            if (hasActivityToday) {
                                resultadoDailyStatus.textContent = 'Sequência diária garantida hoje. Continue acumulando XP!';
                                resultadoDailyStatus.classList.remove('is-inactive');
                            } else {
                                resultadoDailyStatus.textContent = 'Você ainda precisa responder uma pergunta hoje para manter a sequência ativa.';
                                resultadoDailyStatus.classList.add('is-inactive');
                            }
                        }
                    } else {
                        this.quizUI.hideElement(resultadoDailyWrapper);
                        if (resultadoDailyStatus) {
                            resultadoDailyStatus.textContent = '';
                            resultadoDailyStatus.classList.remove('is-inactive');
                        }
                    }
                }

                if (resultadoUpcomingWrapper) {
                    const upcomingAchievements = Array.isArray(gamificationData?.achievements?.upcoming)
                        ? gamificationData.achievements.upcoming.filter((item) => item && item.progress)
                        : [];

                    if (upcomingAchievements.length > 0) {
                        if (resultadoUpcomingList) {
                            resultadoUpcomingList.innerHTML = '';
                            upcomingAchievements.forEach((achievement) => {
                                const item = document.createElement('li');
                                item.className = 'gamification-upcoming__item';

                                const icon = document.createElement('span');
                                icon.className = 'material-symbols-outlined gamification-upcoming__icon';
                                icon.textContent = achievement.progress?.percent >= 100 ? 'military_tech' : 'flag';
                                icon.setAttribute('aria-hidden', 'true');
                                item.appendChild(icon);

                                const content = document.createElement('div');
                                content.className = 'gamification-upcoming__content';

                                const title = document.createElement('strong');
                                title.textContent = achievement.nome || 'Nova conquista';
                                content.appendChild(title);

                                if (achievement.descricao) {
                                    const description = document.createElement('p');
                                    description.textContent = achievement.descricao;
                                    content.appendChild(description);
                                }

                                if (achievement.progress) {
                                    const progress = document.createElement('span');
                                    progress.className = 'gamification-upcoming__progress';
                                    const percent = Number(achievement.progress.percent) || 0;
                                    progress.textContent = `Progresso: ${achievement.progress.label} (${percent.toFixed(0)}%)`;
                                    content.appendChild(progress);

                                    if (achievement.progress.remaining_label) {
                                        const remaining = document.createElement('span');
                                        remaining.className = 'gamification-upcoming__meta';
                                        remaining.textContent = achievement.progress.remaining_label;
                                        content.appendChild(remaining);
                                    }
                                }

                                item.appendChild(content);
                                resultadoUpcomingList.appendChild(item);
                            });
                        }

                        this.quizUI.showElement(resultadoUpcomingWrapper);
                        resultadoUpcomingWrapper.classList.remove('is-empty');
                        if (resultadoUpcomingEmpty) {
                            resultadoUpcomingEmpty.classList.add('u-is-hidden');
                        }
                    } else {
                        if (resultadoUpcomingList) {
                            resultadoUpcomingList.innerHTML = '';
                        }
                        if (resultadoUpcomingEmpty) {
                            resultadoUpcomingEmpty.classList.remove('u-is-hidden');
                        }
                        this.quizUI.showElement(resultadoUpcomingWrapper);
                        resultadoUpcomingWrapper.classList.add('is-empty');
                    }
                }
            } else {
                this.quizUI.hideElement(resultadoGamificacao);
            }
        }

        this.lastRenderedSnapshot = {
            pontos,
            acertos,
            erros,
            totalRespondidas,
            tempoFormatado,
            tempoMedioFormatado,
            accuracyPercent,
            xpTotal: xpTotalValue,
            xpGanho: xpGanhoValue,
            levelName: levelNameValue,
            achievementsUnlocked: achievementsUnlockedValue,
            dailyStreak: gamificationData?.daily_engagement?.streak_days || 0,
            dailyXp: gamificationData?.daily_engagement?.xp_today || 0,
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
            tempoMedioFormatado,
            xpTotal,
            xpGanho,
            levelName,
            achievementsUnlocked,
            dailyStreak,
            dailyXp
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

        const baseMensagem = `Acabei de concluir um desafio no MedQuiz com ${pontosTexto}, ${accuracyPercent}% de acerto e ${questoesTexto}${tempoTotalTexto}${tempoMedioTexto}.`;

        const extras = [];
        if (typeof xpGanho === 'number') {
            const xpTexto = `${xpGanho >= 0 ? '+' : ''}${xpGanho} XP`;
            extras.push(`Ganhei ${xpTexto}`);
        }
        if (levelName) {
            extras.push(`Alcancei o nível ${levelName}`);
        }
        if (achievementsUnlocked) {
            extras.push(`Desbloqueei ${achievementsUnlocked} conquista${achievementsUnlocked === 1 ? '' : 's'}`);
        }
        if (typeof dailyStreak === 'number' && dailyStreak > 0) {
            const streakTexto = Number(dailyStreak).toLocaleString('pt-BR');
            const sufixo = Number(dailyStreak) === 1 ? '' : 's';
            extras.push(`Mantive uma sequência de ${streakTexto} dia${sufixo}`);
        }
        if (typeof dailyXp === 'number' && dailyXp > 0) {
            const xpHojeTexto = Number(dailyXp).toLocaleString('pt-BR');
            extras.push(`Somei ${xpHojeTexto} XP hoje`);
        }

        const extrasMensagem = extras.length ? ` ${extras.join(' e ')}.` : '';

        return `${baseMensagem}${extrasMensagem} Vamos estudar juntos?`;
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