// assets/js/ui/StatisticsChartManager.js

/**
 * Realiza uma mesclagem profunda (deep merge) de dois objetos, preservando propriedades aninhadas.
 * @param {object} target - O objeto de destino.
 * @param {object} source - O objeto de origem, cujas propriedades irão sobrescrever as do destino.
 * @returns {object} Um novo objeto com as propriedades mescladas.
 */
function deepMerge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

/**
 * Verifica se um item é um objeto (e não um array ou null).
 * @param {*} item - O item a ser verificado.
 * @returns {boolean}
 */
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}


export default class StatisticsChartManager {
	constructor(quizUIInstance) {
		this.quizUI = quizUIInstance;

		this.store = null;
		this.actionOrchestrator = null;
		this.hasInitialized = false;

                this.elements = {
                        overallAccuracyChartEl: document.getElementById(
                                "chart-overall-accuracy"
                        ),
			categoryPerformanceChartEl: document.getElementById(
				"chart-category-performance"
			),
			learningProgressChartEl: document.getElementById(
				"chart-learning-progress"
			),
			studyHeatmapChartEl: document.getElementById("chart-study-heatmap"),
			studyTimeChartEl: document.getElementById("chart-study-time"),
			difficultyPerformanceChartEl: document.getElementById(
				"chart-difficulty-performance"
			),
			periodSelectEl: document.getElementById("stats-period-select"),
			totalQuestionsEl: document.getElementById("metric-total-questions"),
			maxStreakEl: document.getElementById("metric-max-streak"),
			totalScoreEl: document.getElementById("metric-total-score"),
			totalStudyTimeEl: document.getElementById(
				"metric-total-study-time"
			),
			noStatsDataMessageEl: document.getElementById(
				"no-stats-data-message"
			),
                        statisticsDashboardContainer: document.querySelector(
                                ".statistics-dashboard"
                        ),
                        statisticsPeriodSummaryEl: document.getElementById(
                                "statistics-period-summary"
                        ),
                        noStatsDataTitleEl: document.querySelector(
                                "#no-stats-data-message [data-role=\"title\"]"
                        ),
                        noStatsDataDescriptionEl: document.querySelector(
                                "#no-stats-data-message [data-role=\"description\"]"
                        ),
                };
                this.charts = {};
                this.heatmapTooltip = null;

                this.insightElements = {
                        bestCategory: {
                                valueEl: document.getElementById(
                                        "insight-best-category"
                                ),
                                detailEl: document.getElementById(
                                        "insight-best-category-detail"
                                ),
                        },
                        bestDifficulty: {
                                valueEl: document.getElementById(
                                        "insight-best-difficulty"
                                ),
                                detailEl: document.getElementById(
                                        "insight-best-difficulty-detail"
                                ),
                        },
                        productiveDay: {
                                valueEl: document.getElementById(
                                        "insight-productive-day"
                                ),
                                detailEl: document.getElementById(
                                        "insight-productive-day-detail"
                                ),
                        },
                        accuracy: {
                                valueEl: document.getElementById("insight-accuracy"),
                                detailEl: document.getElementById(
                                        "insight-accuracy-detail"
                                ),
                        },
                };
                this.defaultInsightMessages = {
                        bestCategory:
                                "Complete quizzes para desbloquear esta informação.",
                        bestDifficulty:
                                "Resolva questões para descobrir em qual nível você mais acerta.",
                        productiveDay:
                                "Assim que houver atividades recentes, destacaremos o melhor dia.",
                        accuracy:
                                "Suas taxas de acerto aparecerão aqui quando você responder questões.",
                };

                this.periodHighlightsElements = {
                        container: document.getElementById("statistics-period-highlights"),
                        activeDays: {
                                valueEl: document.getElementById("summary-active-days"),
                                detailEl: document.getElementById("summary-active-days-detail"),
                        },
                        averageQuestions: {
                                valueEl: document.getElementById("summary-average-questions"),
                                detailEl: document.getElementById("summary-average-questions-detail"),
                        },
                        averageStudyTime: {
                                valueEl: document.getElementById("summary-average-study-time"),
                                detailEl: document.getElementById("summary-average-study-time-detail"),
                        },
                        sessionsCompleted: {
                                valueEl: document.getElementById("summary-sessions-completed"),
                                detailEl: document.getElementById("summary-sessions-completed-detail"),
                        },
                };

                this.periodHighlightDefaults = {
                        activeDays: {
                                detail: this.periodHighlightsElements.activeDays.detailEl?.textContent?.trim() ||
                                        "Monte uma rotina consistente de estudos.",
                        },
                        averageQuestions: {
                                detail: this.periodHighlightsElements.averageQuestions.detailEl?.textContent?.trim() ||
                                        "Resolva perguntas com frequência para ver sua média.",
                        },
                        averageStudyTime: {
                                detail: this.periodHighlightsElements.averageStudyTime.detailEl?.textContent?.trim() ||
                                        "Complete sessões para calcular seu tempo médio diário.",
                        },
                        sessionsCompleted: {
                                detail: this.periodHighlightsElements.sessionsCompleted.detailEl?.textContent?.trim() ||
                                        "Inicie um quiz para analisar seu ritmo de conclusão.",
                        },
                };

                this.accuracyTrendElements = {
                        container: document.getElementById("accuracy-trend-card"),
                        valueEl: document.getElementById("trend-accuracy-value"),
                        detailEl: document.getElementById("trend-accuracy-detail"),
                        badgeEl: document.getElementById("trend-accuracy-badge"),
                        iconEl: document.getElementById("trend-accuracy-icon"),
                };

                this.trendDefaults = {
                        detail:
                                this.accuracyTrendElements.detailEl?.textContent?.trim() ||
                                "Complete quizzes para acompanhar a evolução do seu desempenho.",
                        badge: this.accuracyTrendElements.badgeEl?.textContent?.trim() || "Sem dados",
                };

                this.loadingMessage = "Carregando dados...";
                this.summaryErrorMessage = "Não foi possível carregar o resumo do período.";
                this.trendErrorMessage = "Não foi possível carregar a variação de precisão.";

                const initialPeriodValue = this.elements.periodSelectEl
                        ? this.elements.periodSelectEl.value
                        : null;
                this.currentPeriod = this._normalizePeriodValue(initialPeriodValue);
                this._updatePeriodSummaryLabel();

                if (
                        this.elements.periodSelectEl &&
                        this.elements.periodSelectEl.value !== this.currentPeriod
                ) {
                        const matchingOption = this.elements.periodSelectEl.querySelector(
                                `option[value="${this.currentPeriod}"]`
                        );
                        if (matchingOption) {
                                this.elements.periodSelectEl.value = this.currentPeriod;
                        }
                }

                this.previousStatsState = {};
        }

        _normalizePeriodValue(rawValue) {
                const DEFAULT_PERIOD = "30d";

                if (rawValue === undefined || rawValue === null) {
                        return DEFAULT_PERIOD;
                }

                const normalizedValue = String(rawValue).trim().toLowerCase();

                if (normalizedValue === "all") {
                        return "all";
                }

                const match = normalizedValue.match(/^(\d+)(d)?$/);
                if (match) {
                        const days = parseInt(match[1], 10);
                        if (!Number.isNaN(days) && days > 0) {
                                return `${days}d`;
                        }
                }

                return DEFAULT_PERIOD;
        }

        _getCurrentPeriodLabel() {
                if (!this.elements.periodSelectEl) {
                        return null;
                }

                const selectEl = this.elements.periodSelectEl;
                const selectedOption = selectEl.options[selectEl.selectedIndex];
                if (!selectedOption) {
                        return null;
                }

                const label =
                        selectedOption.dataset.label || selectedOption.textContent;
                return label ? label.trim() : null;
        }

        _updatePeriodSummaryLabel() {
                if (!this.elements.statisticsPeriodSummaryEl) {
                        return;
                }
                const label = this._getCurrentPeriodLabel();
                const text = label
                        ? `Exibindo desempenho dos ${label}.`
                        : "Exibindo desempenho recente.";
                this.elements.statisticsPeriodSummaryEl.textContent = text;
        }

        setStore(storeInstance) {
                this.store = storeInstance;
                if (this.store) {
                        this.previousStatsState = this.store.getState().statistics;
                        this.store.subscribe(this.handleStateUpdate.bind(this));
		}
	}

	setActionOrchestrator(orchestrator) {
		this.actionOrchestrator = orchestrator;
	}

	init() {
		if (this.hasInitialized) {
			return;
		}

		if (!this.elements.periodSelectEl) return;

                this.elements.periodSelectEl.addEventListener("change", (event) => {
                        const selectEl = event.target;
                        const normalizedPeriod = this._normalizePeriodValue(
                                selectEl.value
                        );

                        if (selectEl.value !== normalizedPeriod) {
                                const matchingOption = selectEl.querySelector(
                                        `option[value="${normalizedPeriod}"]`
                                );
                                if (matchingOption) {
                                        selectEl.value = normalizedPeriod;
                                }
                        }

                        this.currentPeriod = normalizedPeriod;
                        this._updatePeriodSummaryLabel();
                        this._triggerFetchStatistics();
                });

                const currentStats = this.store.getState().statistics;
                if (!currentStats.data && !currentStats.isLoading) {
			this._triggerFetchStatistics();
		}

		this.hasInitialized = true;
	}

        _triggerFetchStatistics() {
                if (this.actionOrchestrator) {
                        this._updatePeriodSummaryLabel();
                        this.actionOrchestrator.fetchStatistics(this.currentPeriod);
                }
        }

	handleStateUpdate() {
		if (!this.store) return;
		const newStatsState = this.store.getState().statistics;

		if (
			JSON.stringify(newStatsState) !==
			JSON.stringify(this.previousStatsState)
		) {
			this._render(newStatsState);
			this.previousStatsState = newStatsState;
		}
	}

	_render(statsState) {
		const { isLoading, data: statsData, error } = statsState;

		if (isLoading) {
			this._showLoadingPlaceholders();
			return;
		}

		this.elements.statisticsDashboardContainer?.classList.remove(
			"is-loading"
		);

		if (error) {
			this._showErrorState(error);
			return;
		}

                if (statsData && statsData.status === "success") {
                        this._updateKeyMetrics(statsData.key_metrics);
                        const hasAnyData =
                                statsData.key_metrics?.total_questions_answered > 0;

                        if (!hasAnyData) {
                                this._showNoDataInsights();
                                this._showNoPeriodHighlights();
                                this._showEmptyAccuracyTrend();
                                const currentLabel = this._getCurrentPeriodLabel();
                                if (this.elements.noStatsDataTitleEl) {
                                        this.elements.noStatsDataTitleEl.textContent =
                                                "Sem estatísticas por aqui";
                                        this.elements.noStatsDataTitleEl.style.color = "";
                                }
                                if (this.elements.noStatsDataDescriptionEl) {
                                        const description = currentLabel
                                                ? `Não encontramos atividade registrada nos ${currentLabel}. Complete um quiz para ver seus números aparecerem por aqui.`
                                                : "Não encontramos atividade registrada neste período. Complete um quiz para ver seus números aparecerem por aqui.";
                                        this.elements.noStatsDataDescriptionEl.textContent =
                                                description;
                                        this.elements.noStatsDataDescriptionEl.style.color = "";
                                }
                                if (this.elements.noStatsDataMessageEl) {
                                        this.quizUI.showElement(
                                                this.elements.noStatsDataMessageEl
                                        );
                                }
                                document
                                        .querySelectorAll(".chart-container .chart-placeholder")
                                        .forEach((p) => {
                                                this._showNoDataMessageForChart(
                                                        p.parentElement,
                                                        "Sem dados para o período."
                                                );
                                        });
                        } else {
                                if (this.elements.noStatsDataMessageEl) {
                                        this.quizUI.hideElement(
                                                this.elements.noStatsDataMessageEl
                                        );
                                }
                                this._updatePeriodHighlights(statsData.period_summary);
                                this._updateAccuracyTrend(statsData.accuracy_trend);
                                this._updateInsights(statsData);
                                this._renderOverallAccuracyChart(
                                        statsData.overall_accuracy
                                );
                                this._renderCategoryPerformanceChart(
                                        statsData.category_performance
                                );
                                this._renderLearningProgressChart(
                                        statsData.learning_progress
                                );
                                this._renderStudyHeatmapChart(statsData.study_heatmap);
                                this._renderStudyTimeChart(statsData.study_time_detail);
                                this._renderDifficultyPerformanceChart(
                                        statsData.difficulty_performance
                                );
                        }
                } else {
                        this._showErrorState(
                                statsData?.message || "Falha ao processar estatísticas."
                        );
                }
	}
    
    _renderStudyHeatmapChart(data) {
        this._destroyChart('studyHeatmap');
        const container = this.elements.studyHeatmapChartEl;

        if (!container) return;
        container.innerHTML = '';

        if (!data || data.length === 0) {
            this._showNoDataMessageForChart(container, "Sem dados de frequência para exibir.");
            return;
        }

        this._createTooltip();
        const dataMap = new Map(data.map(d => [d.date_str, d.questions_done]));
        
        const today = new Date();
        const currentYear = today.getUTCFullYear();
        const startDate = new Date(Date.UTC(currentYear, 0, 1)); // Jan 1st
        const endDate = new Date(Date.UTC(currentYear, 11, 31)); // Dec 31st

        const heatmapContainer = document.createElement('div');
        heatmapContainer.className = 'heatmap-container';

        const grid = document.createElement('div');
        grid.className = 'heatmap-grid';
        
        const graphData = this._generateGraphElements(startDate, endDate, dataMap);

        grid.appendChild(graphData.daysOfWeek);
        grid.appendChild(graphData.months);
        grid.appendChild(graphData.graph);
        heatmapContainer.appendChild(grid);
        heatmapContainer.appendChild(this._createLegend());
        container.appendChild(heatmapContainer);
    }
    
    _generateGraphElements(startDate, endDate, dataMap) {
        const graph = document.createElement('div');
        graph.className = 'heatmap-graph';
        
        const monthsContainer = document.createElement('div');
        monthsContainer.className = 'heatmap-months';
        
        const daysContainer = document.createElement('div');
        daysContainer.className = 'heatmap-days-of-week';
        ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(day => {
            daysContainer.innerHTML += `<div>${day}</div>`;
        });

        let currentDate = new Date(startDate);
        const firstDayOfWeek = startDate.getUTCDay();

        for (let i = 0; i < firstDayOfWeek; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'heatmap-day';
            dayEl.style.visibility = 'hidden';
            graph.appendChild(dayEl);
        }

        const monthLabels = [];
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        let lastMonth = -1;
        let weekCount = 1;

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const count = dataMap.get(dateStr) || 0;
            const level = this._getContributionLevel(count);

            const dayEl = document.createElement('div');
            dayEl.className = 'heatmap-day';
            dayEl.dataset.level = level.toString();
            dayEl.dataset.date = dateStr;
            dayEl.dataset.count = count.toString();
            this._addTooltipEvents(dayEl);
            graph.appendChild(dayEl);

            const currentMonth = currentDate.getUTCMonth();
            if (currentMonth !== lastMonth) {
                monthLabels.push({ name: monthNames[currentMonth], startColumn: weekCount });
                lastMonth = currentMonth;
            }

            if (currentDate.getUTCDay() === 6) { 
                weekCount++;
            }
            
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        monthLabels.forEach(label => {
            const monthEl = document.createElement('div');
            monthEl.className = 'heatmap-month-label';
            monthEl.textContent = label.name;
            monthEl.style.gridColumnStart = label.startColumn;
            monthsContainer.appendChild(monthEl);
        });

        return { graph, months: monthsContainer, daysOfWeek: daysContainer };
    }

    _getContributionLevel(count) {
        if (count >= 20) return 4;
        if (count >= 10) return 3;
        if (count >= 5) return 2;
        if (count > 0) return 1;
        return 0;
    }

    _createTooltip() {
        if (this.heatmapTooltip) return;
        this.heatmapTooltip = document.createElement('div');
        this.heatmapTooltip.className = 'heatmap-tooltip';
        document.body.appendChild(this.heatmapTooltip);
    }

    _addTooltipEvents(element) {
        element.addEventListener('mouseover', (e) => {
            const count = e.target.dataset.count;
            const dateStr = e.target.dataset.date;
            const date = new Date(`${dateStr}T00:00:00Z`);
            const formattedDate = date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
            
            const contributions = count === '1' ? '1 questão' : `${count} questões`;
            this.heatmapTooltip.innerHTML = `<strong>${contributions}</strong> em ${formattedDate}`;
            
            const rect = e.target.getBoundingClientRect();
            this.heatmapTooltip.style.left = `${rect.left + rect.width / 2}px`;
            this.heatmapTooltip.style.top = `${rect.top}px`;
            this.heatmapTooltip.classList.add('is-visible');
        });

        element.addEventListener('mouseleave', () => {
            this.heatmapTooltip.classList.remove('is-visible');
        });
    }

    _createLegend() {
        const legend = document.createElement('div');
        legend.className = 'heatmap-legend';
        legend.innerHTML = `
            <span>Menos</span>
            <ul>
                <li style="background-color: var(--heatmap-level-0);" data-level="0"></li>
                <li style="background-color: var(--heatmap-level-1);" data-level="1"></li>
                <li style="background-color: var(--heatmap-level-2);" data-level="2"></li>
                <li style="background-color: var(--heatmap-level-3);" data-level="3"></li>
                <li style="background-color: var(--heatmap-level-4);" data-level="4"></li>
            </ul>
            <span>Mais</span>
        `;
        this._addTooltipEventsToLegend(legend);
        return legend;
    }
    
    _addTooltipEventsToLegend(legendContainer){
         legendContainer.querySelectorAll('li').forEach(item => {
            item.addEventListener('mouseover', (e) => {
                const level = e.target.dataset.level;
                let text = "Sem atividades";
                if(level === "1") text = "1-4 questões";
                else if(level === "2") text = "5-9 questões";
                else if(level === "3") text = "10-19 questões";
                else if(level === "4") text = "20+ questões";

                this.heatmapTooltip.innerHTML = `<strong>${text}</strong>`;
                const rect = e.target.getBoundingClientRect();
                this.heatmapTooltip.style.left = `${rect.left + rect.width / 2}px`;
                this.heatmapTooltip.style.top = `${rect.top}px`;
                this.heatmapTooltip.classList.add('is-visible');
            });
            item.addEventListener('mouseleave', () => {
                 this.heatmapTooltip.classList.remove('is-visible');
            });
        });
    }

	_showLoadingPlaceholders() {
		this.elements.statisticsDashboardContainer?.classList.add("is-loading");
		document
			.querySelectorAll(".chart-container .chart-placeholder")
			.forEach((p) => {
				p.textContent = "Carregando gráfico...";
				p.style.color = "var(--color-text-muted)";
				this.quizUI.showElement(p);
			});
                Object.keys(this.charts).forEach((chartKey) =>
                        this._destroyChart(chartKey)
                );
                if (this.elements.studyHeatmapChartEl) this.elements.studyHeatmapChartEl.innerHTML = '<p class="chart-placeholder" style="display:block; text-align:center;">Carregando gráfico...</p>';

                this._showLoadingInsights();
                this._showLoadingPeriodHighlights();
                this._showLoadingAccuracyTrend();

                if (this.elements.noStatsDataMessageEl) {
                        this.quizUI.hideElement(this.elements.noStatsDataMessageEl);
                }
        }

        _showErrorState(errorMessage) {
                this._updateKeyMetrics(null);
                document.querySelectorAll(".chart-container").forEach((container) => {
                        const placeholder = container.querySelector(".chart-placeholder");
                        if (placeholder) {
                                placeholder.textContent = errorMessage;
                                placeholder.style.color = "var(--color-accent-red)";
                                this.quizUI.showElement(placeholder);
                        }
                });
                this._showErrorInsights(errorMessage);
                this._showPeriodHighlightsError(errorMessage);
                this._showErrorAccuracyTrend(errorMessage);
                if (this.elements.noStatsDataTitleEl) {
                        this.elements.noStatsDataTitleEl.textContent =
                                "Erro ao carregar estatísticas";
                        this.elements.noStatsDataTitleEl.style.color =
                                "var(--color-accent-red)";
                }
                if (this.elements.noStatsDataDescriptionEl) {
                        this.elements.noStatsDataDescriptionEl.textContent =
                                errorMessage;
                        this.elements.noStatsDataDescriptionEl.style.color =
                                "var(--color-accent-red)";
                }
                if (this.elements.noStatsDataMessageEl) {
                        this.quizUI.showElement(this.elements.noStatsDataMessageEl);
                }
        }

	_hideLoadingPlaceholder(chartEl) {
		const placeholder = chartEl?.querySelector(".chart-placeholder");
		if (placeholder) this.quizUI.hideElement(placeholder);
	}

	_showNoDataMessageForChart(
		chartEl,
		message = "Sem dados para este gráfico."
	) {
        if(!chartEl) return;
		chartEl.innerHTML = '';
        const placeholder = document.createElement('p');
        placeholder.className = 'chart-placeholder';
        placeholder.style.textAlign = 'center';
		placeholder.textContent = message;
		placeholder.style.color = "var(--color-text-muted)";
        chartEl.appendChild(placeholder);
		this.quizUI.showElement(placeholder);
	}

        _updateKeyMetrics(keyMetrics) {
                const metrics = keyMetrics || {
                        total_questions_answered: 0,
                        max_streak: 0,
                        total_score_all_time: 0,
                        total_study_time_seconds: 0,
                };
                if (this.elements.totalQuestionsEl)
                        this.elements.totalQuestionsEl.textContent =
                                metrics.total_questions_answered.toLocaleString("pt-BR");
                if (this.elements.maxStreakEl)
                        this.elements.maxStreakEl.textContent =
                                metrics.max_streak.toLocaleString("pt-BR");
                if (this.elements.totalScoreEl)
                        this.elements.totalScoreEl.textContent =
                                metrics.total_score_all_time.toLocaleString("pt-BR");
                if (this.elements.totalStudyTimeEl) {
                        const totalSeconds = metrics.total_study_time_seconds || 0;
                        const minutes = Math.floor(totalSeconds / 60);
                        const hours = Math.floor(minutes / 60);
                        const remainingMinutes = minutes % 60;
                        this.elements.totalStudyTimeEl.textContent =
                                hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
                }
        }

        _applyStateToElement(element, state) {
                if (!element) {
                        return;
                }

                if (state && state !== "default") {
                        element.dataset.state = state;
                } else {
                        delete element.dataset.state;
                }
        }

        _setPeriodHighlightState(key, valueText, detailText, state = "default") {
                if (!this.periodHighlightsElements || !this.periodHighlightsElements[key]) {
                        return;
                }
                const item = this.periodHighlightsElements[key];
                if (item.valueEl) {
                        item.valueEl.textContent = valueText;
                        this._applyStateToElement(item.valueEl, state);
                }
                if (item.detailEl) {
                        item.detailEl.textContent = detailText;
                        this._applyStateToElement(item.detailEl, state);
                }
        }

        _showLoadingPeriodHighlights() {
                if (!this.periodHighlightsElements) {
                        return;
                }
                this.periodHighlightsElements.container?.classList.add("is-loading");
                const loadingText = this.loadingMessage;
                this._setPeriodHighlightState("activeDays", "--", loadingText, "loading");
                this._setPeriodHighlightState("averageQuestions", "--", loadingText, "loading");
                this._setPeriodHighlightState("averageStudyTime", "--", loadingText, "loading");
                this._setPeriodHighlightState("sessionsCompleted", "--", loadingText, "loading");
        }

        _showNoPeriodHighlights() {
                if (!this.periodHighlightsElements) {
                        return;
                }
                this.periodHighlightsElements.container?.classList.remove("is-loading");
                this._setPeriodHighlightState(
                        "activeDays",
                        "--",
                        this.periodHighlightDefaults.activeDays.detail,
                        "empty"
                );
                this._setPeriodHighlightState(
                        "averageQuestions",
                        "--",
                        this.periodHighlightDefaults.averageQuestions.detail,
                        "empty"
                );
                this._setPeriodHighlightState(
                        "averageStudyTime",
                        "--",
                        this.periodHighlightDefaults.averageStudyTime.detail,
                        "empty"
                );
                this._setPeriodHighlightState(
                        "sessionsCompleted",
                        "--",
                        this.periodHighlightDefaults.sessionsCompleted.detail,
                        "empty"
                );
        }

        _showPeriodHighlightsError(message) {
                if (!this.periodHighlightsElements) {
                        return;
                }
                this.periodHighlightsElements.container?.classList.remove("is-loading");
                const detail = message || this.summaryErrorMessage;
                this._setPeriodHighlightState("activeDays", "--", detail, "error");
                this._setPeriodHighlightState("averageQuestions", "--", detail, "error");
                this._setPeriodHighlightState("averageStudyTime", "--", detail, "error");
                this._setPeriodHighlightState("sessionsCompleted", "--", detail, "error");
        }

        _formatAverageValue(value) {
                const numeric = Number(value);
                if (Number.isNaN(numeric) || numeric <= 0) {
                        return "0";
                }
                const useDecimals = numeric < 10 && numeric % 1 !== 0;
                return this._formatNumber(numeric, {
                        minimumFractionDigits: useDecimals ? 1 : 0,
                        maximumFractionDigits: useDecimals ? 1 : 0,
                });
        }

        _formatDurationFromSeconds(seconds) {
                const numeric = Number(seconds);
                if (Number.isNaN(numeric) || numeric <= 0) {
                        return "0 min";
                }
                const totalMinutes = Math.round(numeric / 60);
                if (totalMinutes >= 60) {
                        const hours = Math.floor(totalMinutes / 60);
                        const remainingMinutes = totalMinutes % 60;
                        if (remainingMinutes === 0) {
                                return `${hours}h`;
                        }
                        return `${hours}h ${remainingMinutes}m`;
                }
                if (totalMinutes > 0) {
                        return `${totalMinutes} min`;
                }
                const secondsValue = Math.max(Math.round(numeric), 1);
                return `${secondsValue}s`;
        }

        _updatePeriodHighlights(summaryData) {
                if (!this.periodHighlightsElements) {
                        return;
                }
                this.periodHighlightsElements.container?.classList.remove("is-loading");

                if (!summaryData || summaryData.has_activity === false) {
                        this._showNoPeriodHighlights();
                        return;
                }

                const activeDays = Number(summaryData.active_days) || 0;
                const requestedDays = summaryData.requested_days;
                const trackedDays = Number(summaryData.tracked_days) || 0;
                const activeDayRatio = Number(summaryData.active_day_ratio) || 0;
                const totalQuestions = Number(summaryData.total_questions_answered) || 0;
                const avgQuestionsActive = Number(summaryData.average_questions_per_active_day) || 0;
                const avgQuestionsPeriod = Number(summaryData.average_questions_per_day) || 0;
                const totalStudySeconds = Number(summaryData.total_study_time_seconds) || 0;
                const avgStudySeconds = Number(summaryData.average_study_time_per_active_day_seconds) || 0;
                const sessionsCompleted = Number(summaryData.sessions_completed) || 0;
                const avgSessionDurationSeconds = Number(summaryData.average_session_duration_seconds) || 0;
                const lastActivityDate = summaryData.last_activity_date;

                const activeDaysValueText = activeDays > 0
                        ? this._formatNumber(activeDays)
                        : "--";
                let activeDaysDetailText = this.periodHighlightDefaults.activeDays.detail;
                let activeState = activeDays > 0 ? "default" : "empty";
                const totalDaysForRatio = requestedDays || trackedDays;
                if (activeDays > 0 && totalDaysForRatio) {
                        const ratioPercent = Math.round((activeDayRatio || 0) * 100);
                        const ratioText = `${this._formatNumber(ratioPercent, { minimumFractionDigits: 0 })}%`;
                        activeDaysDetailText = `Atividade em ${this._formatNumber(activeDays)} de ${this._formatNumber(totalDaysForRatio)} dias (${ratioText}).`;
                } else if (activeDays > 0) {
                        const plural = activeDays === 1 ? "dia" : "dias";
                        activeDaysDetailText = `Atividade registrada em ${this._formatNumber(activeDays)} ${plural}.`;
                }
                this._setPeriodHighlightState(
                        "activeDays",
                        activeDaysValueText,
                        activeDaysDetailText,
                        activeState
                );

                const averageQuestionsValueText = avgQuestionsActive > 0
                        ? this._formatAverageValue(avgQuestionsActive)
                        : "--";
                let averageQuestionsDetailText = this.periodHighlightDefaults.averageQuestions.detail;
                let averageQuestionsState = avgQuestionsActive > 0 ? "default" : "empty";
                if (avgQuestionsActive > 0) {
                        const parts = [
                                `Média de ${this._formatAverageValue(avgQuestionsActive)} questões nos dias ativos.`,
                        ];
                        if (avgQuestionsPeriod > 0 && totalDaysForRatio) {
                                parts.push(
                                        `No período completo: ${this._formatAverageValue(avgQuestionsPeriod)} por dia.`
                                );
                        }
                        parts.push(`Total de ${this._formatQuestionCount(totalQuestions)} respondidas.`);
                        averageQuestionsDetailText = parts.join(" ");
                }
                this._setPeriodHighlightState(
                        "averageQuestions",
                        averageQuestionsValueText,
                        averageQuestionsDetailText,
                        averageQuestionsState
                );

                const averageStudyValueText = avgStudySeconds > 0
                        ? `${this._formatDurationFromSeconds(avgStudySeconds)} / dia`
                        : "--";
                let averageStudyDetailText = this.periodHighlightDefaults.averageStudyTime.detail;
                let averageStudyState = avgStudySeconds > 0 ? "default" : "empty";
                if (avgStudySeconds > 0) {
                        const parts = [
                                `Média de ${this._formatDurationFromSeconds(avgStudySeconds)} por dia ativo.`,
                        ];
                        if (totalStudySeconds > 0) {
                                parts.push(`No período: ${this._formatDurationFromSeconds(totalStudySeconds)} dedicados aos estudos.`);
                        }
                        if (lastActivityDate) {
                                const formattedDate = this._formatDate(lastActivityDate, {
                                        day: "numeric",
                                        month: "short",
                                });
                                parts.push(`Atualizado em ${formattedDate}.`);
                        }
                        averageStudyDetailText = parts.join(" ");
                }
                this._setPeriodHighlightState(
                        "averageStudyTime",
                        averageStudyValueText,
                        averageStudyDetailText,
                        averageStudyState
                );

                const sessionsValueText = sessionsCompleted > 0
                        ? this._formatNumber(sessionsCompleted)
                        : "--";
                let sessionsDetailText = this.periodHighlightDefaults.sessionsCompleted.detail;
                let sessionsState = sessionsCompleted > 0 ? "default" : "empty";
                if (sessionsCompleted > 0) {
                        const plural = sessionsCompleted === 1 ? "sessão" : "sessões";
                        const parts = [
                                `${this._formatNumber(sessionsCompleted)} ${plural} concluída${sessionsCompleted === 1 ? '' : 's'}.`,
                        ];
                        if (avgSessionDurationSeconds > 0) {
                                parts.push(`Média de ${this._formatDurationFromSeconds(avgSessionDurationSeconds)} por sessão.`);
                        }
                        sessionsDetailText = parts.join(" ");
                }
                this._setPeriodHighlightState(
                        "sessionsCompleted",
                        sessionsValueText,
                        sessionsDetailText,
                        sessionsState
                );
        }

        _resetTrendContainerState() {
                const container = this.accuracyTrendElements?.container;
                if (!container) {
                        return;
                }
                container.classList.remove(
                        "statistics-trend-card--up",
                        "statistics-trend-card--down",
                        "statistics-trend-card--flat",
                        "statistics-trend-card--empty",
                        "statistics-trend-card--error",
                        "is-loading"
                );
        }

        _setAccuracyTrendState({
                valueText,
                detailText,
                badgeText,
                icon,
                modifierClass,
                isLoading = false,
        }) {
                const elements = this.accuracyTrendElements;
                if (!elements || !elements.container) {
                        return;
                }
                this._resetTrendContainerState();
                if (modifierClass) {
                        elements.container.classList.add(modifierClass);
                }
                if (isLoading) {
                        elements.container.classList.add("is-loading");
                }
                if (elements.valueEl) {
                        elements.valueEl.textContent = valueText;
                }
                if (elements.detailEl) {
                        elements.detailEl.textContent = detailText;
                }
                if (elements.badgeEl) {
                        elements.badgeEl.textContent = badgeText;
                }
                if (elements.iconEl && icon) {
                        elements.iconEl.textContent = icon;
                }
        }

        _showLoadingAccuracyTrend() {
                if (!this.accuracyTrendElements) {
                        return;
                }
                this._setAccuracyTrendState({
                        valueText: "--",
                        detailText: this.loadingMessage,
                        badgeText: "Carregando",
                        icon: "hourglass_empty",
                        modifierClass: "statistics-trend-card--flat",
                        isLoading: true,
                });
        }

        _showEmptyAccuracyTrend() {
                if (!this.accuracyTrendElements) {
                        return;
                }
                this._setAccuracyTrendState({
                        valueText: "--",
                        detailText: this.trendDefaults.detail,
                        badgeText: this.trendDefaults.badge,
                        icon: "trending_flat",
                        modifierClass: "statistics-trend-card--empty",
                });
        }

        _showErrorAccuracyTrend(message) {
                if (!this.accuracyTrendElements) {
                        return;
                }
                this._setAccuracyTrendState({
                        valueText: "--",
                        detailText: message || this.trendErrorMessage,
                        badgeText: "Erro",
                        icon: "error",
                        modifierClass: "statistics-trend-card--error",
                });
        }

        _updateAccuracyTrend(trendData) {
                if (!this.accuracyTrendElements) {
                        return;
                }

                if (!trendData || trendData.has_data !== true) {
                        this._showEmptyAccuracyTrend();
                        return;
                }

                const finalAccuracy = Number(trendData.end_accuracy);
                const startAccuracy = Number(trendData.start_accuracy);
                const delta = Number(trendData.delta) || 0;
                const direction = trendData.direction || (delta > 0 ? "up" : delta < 0 ? "down" : "flat");
                const hasMultiplePoints = Boolean(trendData.has_multiple_points);
                const lastDate = trendData.last_date
                        ? this._formatDate(trendData.last_date, { day: "numeric", month: "short" })
                        : null;

                const accuracyValueText = Number.isFinite(finalAccuracy)
                        ? `${this._formatNumber(finalAccuracy, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 1,
                          })}%`
                        : "--";

                let modifierClass = "statistics-trend-card--flat";
                let badgeText = this.trendDefaults.badge;
                let iconName = "trending_flat";

                if (direction === "up") {
                        modifierClass = "statistics-trend-card--up";
                        badgeText = `${delta > 0 ? "+" : ""}${this._formatNumber(delta, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                        })} pts`;
                        iconName = "trending_up";
                } else if (direction === "down") {
                        modifierClass = "statistics-trend-card--down";
                        badgeText = `${this._formatNumber(delta, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                        })} pts`;
                        iconName = "trending_down";
                } else {
                        badgeText = "Estável";
                }

                let detailText = this.trendDefaults.detail;
                if (hasMultiplePoints && Number.isFinite(startAccuracy) && Number.isFinite(finalAccuracy)) {
                        const startText = `${this._formatNumber(startAccuracy, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                        })}%`;
                        const endText = `${this._formatNumber(finalAccuracy, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                        })}%`;
                        const periodLabel = this._getCurrentPeriodLabel();
                        const context = periodLabel ? `nos ${periodLabel}` : "no período analisado";
                        detailText = `Saiu de ${startText} para ${endText} ${context}.`;
                } else if (Number.isFinite(finalAccuracy)) {
                        if (lastDate) {
                                detailText = `Último registro em ${lastDate}: ${accuracyValueText} de acerto.`;
                        } else {
                                detailText = `Precisão atual de ${accuracyValueText}.`;
                        }
                }

                if (lastDate && hasMultiplePoints) {
                        detailText += ` Atualizado em ${lastDate}.`;
                }

                this._setAccuracyTrendState({
                        valueText: accuracyValueText,
                        detailText,
                        badgeText,
                        icon: iconName,
                        modifierClass,
                });
        }

        _setInsight(insightKey, valueText, detailText) {
                const entry = this.insightElements
                        ? this.insightElements[insightKey]
                        : null;
                if (!entry) {
                        return;
                }

                if (entry.valueEl) {
                        entry.valueEl.textContent = valueText;
                }
                if (entry.detailEl) {
                        entry.detailEl.textContent = detailText;
                }
        }

        _showLoadingInsights() {
                Object.keys(this.insightElements || {}).forEach((key) => {
                        this._setInsight(key, "--", "Carregando dados...");
                });
        }

        _showNoDataInsights() {
                const label = this._getCurrentPeriodLabel();
                let context = "neste período";
                if (label) {
                        context = label.toLowerCase().startsWith("últimos")
                                ? `nos ${label}`
                                : `em ${label}`;
                }
                this._setInsight(
                        "bestCategory",
                        "--",
                        `Complete quizzes ${context} para descobrir sua categoria destaque.`
                );
                this._setInsight(
                        "bestDifficulty",
                        "--",
                        `Resolva questões ${context} para ver a dificuldade em que você se destaca.`
                );
                this._setInsight(
                        "productiveDay",
                        "--",
                        `Assim que houver atividades registradas ${context}, destacaremos o dia mais focado.`
                );
                this._setInsight(
                        "accuracy",
                        "--",
                        `Ainda não há respostas registradas ${context}. Complete um quiz para ver a precisão geral.`
                );
        }

        _showErrorInsights(message) {
                const fallbackMessage = message || "Não foi possível carregar os insights.";
                Object.keys(this.insightElements || {}).forEach((key) => {
                        this._setInsight(key, "--", fallbackMessage);
                });
        }

        _updateInsights(statsData) {
                if (!statsData) {
                        this._showNoDataInsights();
                        return;
                }

                const categoryPerformance = Array.isArray(
                        statsData.category_performance
                )
                        ? statsData.category_performance
                        : [];
                const topCategory = categoryPerformance.reduce((best, current) => {
                        if (!current) return best;
                        if (!best) return current;
                        const currentAccuracy = Number(current.accuracy) || 0;
                        const bestAccuracy = Number(best.accuracy) || 0;
                        return currentAccuracy > bestAccuracy ? current : best;
                }, null);
                if (topCategory && topCategory.name) {
                        const accuracyValue = Number(topCategory.accuracy) || 0;
                        const totalCount = Number(topCategory.total) || 0;
                        const detailParts = [];
                        detailParts.push(`Precisão de ${Math.round(accuracyValue)}%`);
                        if (totalCount > 0) {
                                detailParts.push(
                                        `em ${this._formatQuestionCount(totalCount)}`
                                );
                        }
                        this._setInsight(
                                "bestCategory",
                                topCategory.name,
                                `${detailParts.join(" ")}.`
                        );
                } else {
                        this._setInsight(
                                "bestCategory",
                                "--",
                                this.defaultInsightMessages.bestCategory
                        );
                }

                const difficultyPerformance = Array.isArray(
                        statsData.difficulty_performance
                )
                        ? statsData.difficulty_performance
                        : [];
                const topDifficulty = difficultyPerformance.reduce((best, current) => {
                        if (!current) return best;
                        if (!best) return current;
                        const currentAccuracy = Number(current.accuracy) || 0;
                        const bestAccuracy = Number(best.accuracy) || 0;
                        return currentAccuracy > bestAccuracy ? current : best;
                }, null);
                if (topDifficulty && topDifficulty.name) {
                        const accuracyValue = Number(topDifficulty.accuracy) || 0;
                        const totalCount = Number(topDifficulty.total) || 0;
                        const accuracyText = `${Math.round(accuracyValue)}% de acerto`;
                        const volumeText =
                                totalCount > 0
                                        ? `em ${this._formatQuestionCount(totalCount)}`
                                        : "";
                        this._setInsight(
                                "bestDifficulty",
                                topDifficulty.name,
                                volumeText
                                        ? `${accuracyText} ${volumeText}.`
                                        : `${accuracyText}.`
                        );
                } else {
                        this._setInsight(
                                "bestDifficulty",
                                "--",
                                this.defaultInsightMessages.bestDifficulty
                        );
                }

                const heatmapData = Array.isArray(statsData.study_heatmap)
                        ? statsData.study_heatmap.filter(
                                (item) =>
                                        item &&
                                        item.date_str &&
                                        Number(item.questions_done) > 0
                        )
                        : [];
                const productiveDay = heatmapData.reduce((best, current) => {
                        if (!current) return best;
                        if (!best) return current;
                        const currentCount = Number(current.questions_done) || 0;
                        const bestCount = Number(best.questions_done) || 0;
                        if (currentCount > bestCount) {
                                return current;
                        }
                        if (currentCount === bestCount && current.date_str > best.date_str) {
                                return current;
                        }
                        return best;
                }, null);
                if (productiveDay) {
                        const formattedDate = this._formatDate(productiveDay.date_str, {
                                day: "numeric",
                                month: "short",
                        });
                        const questionText = this._formatQuestionCount(
                                productiveDay.questions_done
                        );
                        this._setInsight(
                                "productiveDay",
                                formattedDate,
                                `${questionText} respondidas.`
                        );
                } else {
                        this._setInsight(
                                "productiveDay",
                                "--",
                                this.defaultInsightMessages.productiveDay
                        );
                }

                const accuracyData = statsData.overall_accuracy || {};
                const correctAnswers = Number(accuracyData.correct) || 0;
                const incorrectAnswers = Number(accuracyData.incorrect) || 0;
                const totalAnswers = correctAnswers + incorrectAnswers;
                if (totalAnswers > 0) {
                        const accuracyPercentage =
                                (correctAnswers / totalAnswers) * 100;
                        const detail = `Você acertou ${this._formatQuestionCount(
                                correctAnswers
                        )} de ${this._formatNumber(totalAnswers)} questões.`;
                        this._setInsight(
                                "accuracy",
                                `${Math.round(accuracyPercentage)}%`,
                                detail
                        );
                } else {
                        this._setInsight(
                                "accuracy",
                                "--",
                                this.defaultInsightMessages.accuracy
                        );
                }
        }

        _formatNumber(value, options = {}) {
                const numericValue = Number(value);
                if (Number.isNaN(numericValue) || value === null || value === undefined) {
                        if (typeof options.fallback === "string") {
                                return options.fallback;
                        }
                        if (typeof options.minimumFractionDigits === "number" && options.minimumFractionDigits > 0) {
                                return Number(0).toLocaleString("pt-BR", {
                                        minimumFractionDigits: options.minimumFractionDigits,
                                        maximumFractionDigits:
                                                typeof options.maximumFractionDigits === "number"
                                                        ? Math.max(options.maximumFractionDigits, options.minimumFractionDigits)
                                                        : options.minimumFractionDigits,
                                });
                        }
                        return "0";
                }
                const localeOptions = {};
                if (typeof options.minimumFractionDigits === "number") {
                        localeOptions.minimumFractionDigits = options.minimumFractionDigits;
                }
                if (typeof options.maximumFractionDigits === "number") {
                        localeOptions.maximumFractionDigits = Math.max(
                                options.maximumFractionDigits,
                                localeOptions.minimumFractionDigits ?? 0
                        );
                } else if (
                        typeof localeOptions.minimumFractionDigits === "number" &&
                        localeOptions.minimumFractionDigits > 0
                ) {
                        localeOptions.maximumFractionDigits = Math.max(
                                localeOptions.minimumFractionDigits,
                                2
                        );
                }
                return numericValue.toLocaleString("pt-BR", localeOptions);
        }

        _formatQuestionCount(count) {
                const numericCount = Number(count) || 0;
                const label = numericCount === 1 ? "questão" : "questões";
                return `${this._formatNumber(numericCount)} ${label}`;
        }

        _formatDate(dateStr, options = { day: "numeric", month: "long" }) {
                if (!dateStr) {
                        return "--";
                }

                const date = new Date(`${dateStr}T00:00:00Z`);
                if (Number.isNaN(date.getTime())) {
                        return dateStr;
                }

                try {
                        return date.toLocaleDateString("pt-BR", {
                                timeZone: "UTC",
                                ...options,
                        });
                } catch (error) {
                        return dateStr;
                }
        }

	_destroyChart(chartKey) {
		if (
			this.charts[chartKey] &&
			typeof this.charts[chartKey].destroy === "function"
		) {
			try {
				this.charts[chartKey].destroy();
			} catch (e) {}
		}
		this.charts[chartKey] = null;
	}

	_getChartDefaultOptions(extraOptions = {}) {
		const bodyStyles = getComputedStyle(document.body);
		const fontFamily =
			bodyStyles.getPropertyValue("--font-family-sans").trim() ||
			"Roboto, sans-serif";
			
		const defaultOptions = {
			chart: {
				fontFamily: fontFamily,
				foreColor: bodyStyles.getPropertyValue("--color-text-secondary").trim(),
				toolbar: {
					show: true,
					tools: {
						download: true,
						selection: false,
						zoom: false,
						zoomin: false,
						zoomout: false,
						pan: false,
						reset: true,
					},
				},
				animations: {
					enabled: true,
					easing: "easeinout",
					speed: 600,
				},
			},
			grid: {
				borderColor: bodyStyles.getPropertyValue("--color-gray-200").trim(),
				strokeDashArray: 4,
			},
			stroke: { width: 2.5, curve: "smooth" },
			markers: { size: 0, hover: { size: 5, sizeOffset: 2 } },
			tooltip: {
				theme: "light",
				style: { fontSize: "12px", fontFamily: fontFamily },
				x: { format: "dd MMM yy" },
			},
			legend: {
				fontFamily: fontFamily,
				fontWeight: 500,
				fontSize: "12px",
			},
			noData: {
				text: "Sem dados para exibir.",
				style: {
					color: bodyStyles.getPropertyValue("--color-text-secondary").trim(),
					fontSize: "14px",
					fontFamily: fontFamily,
				},
			},
			colors: [
				bodyStyles.getPropertyValue("--color-primary-medium").trim(),
				bodyStyles.getPropertyValue("--color-secondary-green").trim(),
				bodyStyles.getPropertyValue("--color-accent-red").trim(),
				bodyStyles.getPropertyValue("--color-accent-yellow").trim(),
			],
		};

		return deepMerge(defaultOptions, extraOptions);
	}

	_renderOverallAccuracyChart(data) {
		this._destroyChart("overallAccuracy");
		if (
			!this.elements.overallAccuracyChartEl ||
			!data ||
			(data.correct === 0 && data.incorrect === 0)
		) {
			this._showNoDataMessageForChart(
				this.elements.overallAccuracyChartEl,
				"Sem dados de precisão."
			);
			return;
		}
		this._hideLoadingPlaceholder(this.elements.overallAccuracyChartEl);
        
        const bodyStyles = getComputedStyle(document.body);
		const chartOptions = this._getChartDefaultOptions({
			chart: { type: "donut", height: 280 },
			series: [data.correct, data.incorrect],
			labels: ["Acertos", "Erros"],
            colors: [
                bodyStyles.getPropertyValue("--color-secondary-green").trim(),
                bodyStyles.getPropertyValue("--color-accent-red").trim()
            ],
			plotOptions: {
				pie: {
					donut: {
						size: "70%",
						labels: {
							show: true,
							name: { show: true },
							value: {
								show: true,
								formatter: (val, { seriesIndex, w }) => {
									const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
									return total > 0 ? ((w.globals.series[seriesIndex] / total) * 100).toFixed(0) + "%" : "0%";
								},
							},
							total: {
								show: true,
								showAlways: true,
								label: "Total Questões",
                                fontSize: '14px',
                                fontWeight: 'normal',
								formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString("pt-BR"),
							},
						},
					},
				},
			},
			legend: { position: "bottom" },
			dataLabels: { enabled: false },
			tooltip: {
				y: {
					formatter: (val) => val.toLocaleString("pt-BR") + " questões",
				},
			},
			responsive: [{
                breakpoint: 768,
                options: {
                    chart: { height: 240 },
                    legend: { position: 'bottom' }
                }
            }]
		});
		this.charts.overallAccuracy = new ApexCharts(
			this.elements.overallAccuracyChartEl,
			chartOptions
		);
		this.charts.overallAccuracy.render();
	}

    // --- INÍCIO DA ESTRATÉGIA DISRUPTIVA: Reconstrução com HTML/CSS ---
	_renderCategoryPerformanceChart(data) {
		this._destroyChart("categoryPerformance"); 
        const container = this.elements.categoryPerformanceChartEl;
		if (!container) return;

		if (!data || data.length === 0) {
			this._showNoDataMessageForChart(container, "Sem dados de categoria.");
			return;
		}

		this._hideLoadingPlaceholder(container);
		container.innerHTML = ''; // Limpa o contêiner de qualquer conteúdo anterior

		const topData = data.slice(0, 10);

		const list = document.createElement('ul');
		list.className = 'category-performance-list';

		topData.forEach(item => {
			const accuracy = parseFloat(item.accuracy.toFixed(1));

			const listItem = document.createElement('li');
			listItem.className = 'category-performance-item';

			const label = document.createElement('span');
			label.className = 'category-performance-item__label';
			label.textContent = item.name;
			label.title = item.name; // Adiciona um tooltip nativo com o nome completo

			const value = document.createElement('span');
			value.className = 'category-performance-item__value';
			value.textContent = `${accuracy.toFixed(0)}%`;

			const barContainer = document.createElement('div');
			barContainer.className = 'category-performance-item__bar-container';

			const bar = document.createElement('div');
			bar.className = 'category-performance-item__bar';

			// Adiciona a barra ao contêiner antes de animar para garantir que a transição CSS funcione
			barContainer.appendChild(bar);

            listItem.appendChild(label);
            listItem.appendChild(value);
            listItem.appendChild(barContainer);

			list.appendChild(listItem);
            
            // Usa um pequeno timeout para permitir que o elemento entre no DOM antes de animar a largura
            setTimeout(() => {
                bar.style.width = `${accuracy}%`;
            }, 50);
		});

		container.appendChild(list);
	}
    // --- FIM DA ESTRATÉGIA DISRUPTIVA ---
    
    _calculateMovingAverage(data, windowSize) {
        if (!data || data.length < windowSize) return [];
        
        const smoothedData = [];
        for (let i = 0; i <= data.length - windowSize; i++) {
            const windowSlice = data.slice(i, i + windowSize);
            const sum = windowSlice.reduce((acc, point) => acc + point.y, 0);
            const average = sum / windowSize;
            
            const pointInTime = windowSlice[windowSize - 1].x;
            smoothedData.push({ x: pointInTime, y: parseFloat(average.toFixed(1)) });
        }
        return smoothedData;
    }

	_renderLearningProgressChart(data) {
		this._destroyChart("learningProgress");
		if (!this.elements.learningProgressChartEl || !data || data.length < 2) {
			this._showNoDataMessageForChart(this.elements.learningProgressChartEl, "Dados insuficientes para progresso.");
			return;
		}
		this._hideLoadingPlaceholder(this.elements.learningProgressChartEl);

		const dailyData = data.map((item) => ({
			x: new Date(item.date_str).getTime(),
			y: item.daily_accuracy,
		}));

        const movingAverageData = this._calculateMovingAverage(dailyData, 7);
        const bodyStyles = getComputedStyle(document.body);

		const chartOptions = this._getChartDefaultOptions({
			chart: {
				type: "line",
				height: 330,
                zoom: {
                    enabled: false
                },
			},
			series: [
                {
                    name: "Precisão Diária",
                    type: 'bar',
                    data: dailyData
                },
                {
                    name: 'Média Móvel (7 dias)',
                    type: 'line',
                    data: movingAverageData
                }
            ],
            colors: [
                bodyStyles.getPropertyValue("--color-primary-light").trim(),
                bodyStyles.getPropertyValue("--color-secondary-green").trim(),
            ],
			stroke: {
				width: [0, 3], 
				curve: 'smooth'
			},
            plotOptions: {
                bar: {
                    columnWidth: '60%'
                }
            },
            fill: {
                opacity: [0.8, 1],
            },
			xaxis: {
				type: "datetime",
				labels: { datetimeUTC: false, format: "dd MMM" },
			},
			yaxis: {
				min: 0,
				max: 100,
				title: { text: "Precisão" },
				labels: { formatter: (val) => val.toFixed(0) + "%" },
			},
			tooltip: {
                shared: true,
                intersect: false,
				y: { formatter: (val) => val !== undefined ? val.toFixed(1) + "%" : "N/A" },
			},
			dataLabels: { enabled: false },
            legend: {
                position: 'top',
                horizontalAlign: 'left'
            }
		});
		this.charts.learningProgress = new ApexCharts(
			this.elements.learningProgressChartEl,
			chartOptions
		);
		this.charts.learningProgress.render();
	}

	_renderStudyTimeChart(data) {
		this._destroyChart("studyTime");
		if (!this.elements.studyTimeChartEl || !data || data.data.every((d) => d === 0)) {
			this._showNoDataMessageForChart(this.elements.studyTimeChartEl, "Sem dados de tempo de estudo.");
			return;
		}
		this._hideLoadingPlaceholder(this.elements.studyTimeChartEl);
		const chartOptions = this._getChartDefaultOptions({
			chart: { type: "bar", height: 280 },
			series: [{ name: "Minutos de Estudo", data: data.data }],
			plotOptions: {
				bar: {
					borderRadius: 5,
                    columnWidth: '60%',
					dataLabels: { position: "top" },
				},
			},
			dataLabels: {
				enabled: true,
				formatter: (val) => (val > 0 ? val + "m" : ""),
				offsetY: -18,
				style: {
					fontSize: "10px",
					fontWeight: "bold",
					colors: [ getComputedStyle(document.body).getPropertyValue("--color-text-primary").trim() ],
				},
			},
			xaxis: { categories: data.labels },
			yaxis: { title: { text: "Minutos" } },
			tooltip: {
				y: { formatter: (val) => val + " min" },
			},
			responsive: [{
                breakpoint: 768,
                options: {
                    chart: { height: 260 },
                    dataLabels: { enabled: false },
                }
            }]
		});
		this.charts.studyTime = new ApexCharts(
			this.elements.studyTimeChartEl,
			chartOptions
		);
		this.charts.studyTime.render();
	}

	_renderDifficultyPerformanceChart(data) {
		this._destroyChart("difficultyPerformance");
		if (!this.elements.difficultyPerformanceChartEl || !data || data.length === 0 || data.every((d) => d.total === 0)) {
			this._showNoDataMessageForChart(this.elements.difficultyPerformanceChartEl, "Sem dados de dificuldade.");
			return;
		}
		this._hideLoadingPlaceholder(this.elements.difficultyPerformanceChartEl);
		const bodyStyles = getComputedStyle(document.body);
		const difficulties = data.map((item) => item.name);
		const accuracies = data.map((item) => parseFloat(item.accuracy.toFixed(1)));
		const difficultyColors = [
			bodyStyles.getPropertyValue("--color-secondary-green").trim(),
			bodyStyles.getPropertyValue("--color-primary-medium").trim(),
			bodyStyles.getPropertyValue("--color-accent-red").trim(),
		];
		const seriesColors = difficulties.map((d) => {
			if (d.toLowerCase().includes("fácil")) return difficultyColors[0];
			if (d.toLowerCase().includes("médio")) return difficultyColors[1];
			if (d.toLowerCase().includes("difícil")) return difficultyColors[2];
			return bodyStyles.getPropertyValue("--color-gray-500").trim();
		});
		const chartOptions = this._getChartDefaultOptions({
			chart: { type: "bar", height: 280 },
			series: [{ name: "Precisão", data: accuracies }],
			colors: seriesColors,
			plotOptions: {
				bar: {
					horizontal: true,
					barHeight: "60%",
					borderRadius: 4,
					distributed: true,
					dataLabels: { position: "top" },
				},
			},
			dataLabels: {
				enabled: true,
				formatter: (val, opts) => {
					const totalQuestions = data[opts.dataPointIndex]?.total || 0;
					return val > 0 ? `${val.toFixed(0)}% (${totalQuestions})` : "";
				},
				offsetX: 22,
				textAnchor: "start",
                style: {
                    colors: ['#333']
                }
			},
			xaxis: {
				categories: difficulties,
				min: 0,
				max: 100,
				labels: { formatter: (val) => val + "%" },
			},
			tooltip: {
				y: {
					formatter: (val, { dataPointIndex }) => {
						const totalQuestions = data[dataPointIndex]?.total || 0;
						return `${val.toFixed(1)}% (de ${totalQuestions} questões)`;
					},
				},
			},
			legend: { show: false },
			responsive: [{
                breakpoint: 768,
                options: {
                    chart: { height: 240 },
					dataLabels: {
						style: { fontSize: '10px' },
						offsetX: 15
					}
                }
            }]
		});
		this.charts.difficultyPerformance = new ApexCharts(
			this.elements.difficultyPerformanceChartEl,
			chartOptions
		);
		this.charts.difficultyPerformance.render();
	}
}